// npx tsx lib/core/dictation.test.ts
//
// Η ΥΠΑΓΟΡΕΥΣΗ ΧΩΡΙΣ ΠΕΡΙΗΓΗΤΗ. Μια ψεύτικη αναγνώστρια στη θέση του
// `webkitSpeechRecognition` στέλνει τα συμβάντα με τη σειρά του Chrome. Ελέγχεται τι βλέπει το hook: καταστάσεις, κείμενο, σφάλμα,
// σιωπή. Μαζί η στίξη με λέξεις και η εισαγωγή στη θέση του δρομέα.
import {
  IDLE, reduce, errorFromCode, errorMessage, recognitionLang, transcriptOf, formatSpoken, composer,
  startSession, type DictationState, type DictationError,
} from './dictation';
import type { SpeechEvent } from './speech';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

// ── Η ΜΗΧΑΝΗ ΚΑΤΑΣΤΑΣΕΩΝ ──────────────────────────────────────────────────
{
  let s: DictationState = IDLE;
  s = reduce(s, { type: 'start' });
  ok('start: ξεκινά', s.status === 'starting' && !s.heard && s.error === null);
  s = reduce(s, { type: 'audio' });
  ok('audio: ακούει', s.status === 'listening');
  s = reduce(s, { type: 'result' });
  ok('result: σημειώνει ότι ακούστηκε λέξη', s.heard && s.status === 'listening');
  s = reduce(s, { type: 'end' });
  ok('end χωρίς σφάλμα: ηρεμία', s.status === 'idle' && s.error === null);
}
{
  let s = reduce(IDLE, { type: 'start' });
  s = reduce(s, { type: 'error', error: 'denied' });
  s = reduce(s, { type: 'end' });
  ok('το end μετά από σφάλμα ΚΡΑΤΑ το σφάλμα', s.status === 'error' && s.error === 'denied');
  s = reduce(s, { type: 'result' });
  ok('αποτέλεσμα μετά από σφάλμα δεν το σβήνει', s.status === 'error');
  s = reduce(s, { type: 'start' });
  ok('νέα έναρξη καθαρίζει το σφάλμα', s.status === 'starting' && s.error === null);
}
ok('audio εκτός έναρξης δεν αλλάζει τίποτα', reduce(IDLE, { type: 'audio' }) === IDLE);

// ── ΚΩΔΙΚΟΙ ΚΑΙ ΜΗΝΥΜΑΤΑ ──────────────────────────────────────────────────
ok('aborted δεν είναι σφάλμα', errorFromCode('aborted') === null);
ok('not-allowed: άρνηση', errorFromCode('not-allowed') === 'denied');
ok('service-not-allowed: άρνηση', errorFromCode('service-not-allowed') === 'denied');
ok('audio-capture: χωρίς μικρόφωνο', errorFromCode('audio-capture') === 'no-mic');
ok('άγνωστος κωδικός: γενικό', errorFromCode('bad-grammar') === 'other');
const all: DictationError[] = ['denied', 'no-speech', 'no-mic', 'network', 'language', 'unsupported', 'other'];
ok('κάθε σφάλμα έχει ελληνικό μήνυμα', all.every(e => /[α-ω]/i.test(errorMessage(e))));
ok('κάθε σφάλμα έχει αγγλικό μήνυμα', all.every(e => /^[\x20-\x7e]+$/.test(errorMessage(e, { lang: 'en' }))));
ok('η άρνηση λέει πώς επιτρέπεις το μικρόφωνο', /λουκέτο/.test(errorMessage('denied')) && /επίτρεψε/.test(errorMessage('denied')));
ok('ευγενικός πληθυντικός', /επιτρέψτε/.test(errorMessage('denied', { formal: true })));
ok('κανένα μήνυμα δεν έχει αποσιωπητικά', all.every(e => !/…|\.\.\./.test(errorMessage(e))));
ok('γλώσσα: ελληνικά', recognitionLang('el') === 'el-GR' && recognitionLang('') === 'el-GR');
ok('γλώσσα: αγγλικά για /en', recognitionLang('en') === 'en-US' && recognitionLang('en-GB') === 'en-US');

// ── ΤΟ ΚΕΙΜΕΝΟ ─────────────────────────────────────────────────────────────
const ev = (...r: [string, boolean][]): SpeechEvent => ({
  resultIndex: 0,
  results: Object.assign(r.map(([t, f]) => Object.assign([{ transcript: t }], { isFinal: f })), { length: r.length }),
});
{
  const t = transcriptOf(ev(['καλημέρα', true], [' σας', false]));
  ok('τελικό και ενδιάμεσο χωριστά', t.final === 'καλημέρα' && t.interim === 'σας');
  const u = transcriptOf(ev(['ένα', true], [' δύο', true]));
  ok('τα τελικά ενώνονται με ένα κενό', u.final === 'ένα δύο');
}
ok('τελεία και κεφαλαίο μετά', formatSpoken('ο υδραυλικός ήρθε τελεία πλήρωσα μετρητά', 'el-GR') === 'ο υδραυλικός ήρθε. Πλήρωσα μετρητά');
ok('κόμμα χωρίς κενό πριν', formatSpoken('ρεύμα κόμμα νερό', 'el-GR') === 'ρεύμα, νερό');
ok('ερωτηματικό: το ελληνικό «;»', formatSpoken('ήρθε ο λογαριασμός ερωτηματικό', 'el-GR') === 'ήρθε ο λογαριασμός;');
ok('νέα γραμμή', formatSpoken('πρώτο νέα γραμμή δεύτερο', 'el-GR') === 'πρώτο\nΔεύτερο');
ok('λέξη που περιέχει «τελεία» δεν αλλάζει', formatSpoken('τελείωσε η δουλειά', 'el-GR') === 'τελείωσε η δουλειά');
ok('αγγλικά: period', formatSpoken('paid in cash period thanks', 'en-US') === 'paid in cash. Thanks');

// ── ΕΙΣΑΓΩΓΗ ΣΤΟ ΔΡΟΜΕΑ ───────────────────────────────────────────────────
{
  const c = composer({ value: '', start: 0, end: 0, multiline: false });
  ok('άδειο πεδίο: κεφαλαίο με τόνο', c('άλλαξα τη βρύση').value === 'Άλλαξα τη βρύση');
}
{
  const c = composer({ value: 'Πλήρωσα ΔΕΗ', start: 11, end: 11, multiline: false });
  const r = c('και νερό');
  ok('στο τέλος: ένα κενό ανάμεσα', r.value === 'Πλήρωσα ΔΕΗ και νερό' && r.caret === r.value.length);
}
{
  const c = composer({ value: 'ΑρχήΤέλος', start: 4, end: 4, multiline: false });
  const r = c('μέση');
  ok('στη μέση: κενά και από τις δύο πλευρές', r.value === 'Αρχή μέση Τέλος' && r.caret === 'Αρχή μέση'.length);
}
{
  const c = composer({ value: 'Πρώτο. ', start: 7, end: 7, multiline: false });
  ok('μετά από τελεία: κεφαλαίο', c('δεύτερο').value === 'Πρώτο. Δεύτερο');
}
{
  const c = composer({ value: 'να αλλάξει', start: 3, end: 10, multiline: false });
  ok('η επιλογή αντικαθίσταται', c('να μείνει').value === 'να να μείνει');
}
{
  const c = composer({ value: 'Α', start: 1, end: 1, multiline: false });
  ok('μονογραμμικό: η νέα γραμμή γίνεται κενό', c('β\nγ').value === 'Α β γ');
  const m = composer({ value: '', start: 0, end: 0, multiline: true });
  ok('πολυγραμμικό: η νέα γραμμή μένει', m('β\nγ').value === 'Β\nγ');
}
{
  const c = composer({ value: 'Χ', start: 1, end: 1, multiline: false });
  ok('τα ενδιάμεσα δεν συσσωρεύονται', c('ένα').value === 'Χ ένα' && c('ένα δύο').value === 'Χ ένα δύο');
  ok('κενό αποτέλεσμα: η αρχική τιμή', c('').value === 'Χ');
}

// ── Η ΣΥΝΕΔΡΙΑ, ΜΕ ΨΕΥΤΙΚΗ ΑΝΑΓΝΩΣΤΡΙΑ ────────────────────────────────────
type Fake = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  started: number; stopped: number;
  start(): void; stop(): void; abort(): void;
  onresult: (e: SpeechEvent) => void; onerror: (e: { error?: string }) => void; onend: () => void;
};
const created: Fake[] = [];
let throwOnStart = false;
class FakeRecognition implements Fake {
  lang = ''; interimResults = false; continuous = false; maxAlternatives = 0;
  started = 0; stopped = 0;
  onresult: Fake['onresult'] = () => {}; onerror: Fake['onerror'] = () => {}; onend: Fake['onend'] = () => {};
  constructor() { created.push(this); }
  start() { if (throwOnStart) throw new Error('busy'); this.started++; }
  stop() { this.stopped++; setTimeout(() => this.onend(), 0); }
  abort() { this.stopped++; }
}
const g = globalThis as unknown as Record<string, unknown>;

const run = (opts: { continuous?: boolean; silenceMs?: number; noSpeechMs?: number } = {}) => {
  const states: DictationState[] = [];
  const texts: string[] = [];
  const ends: { final: string; error: DictationError | null }[] = [];
  const session = startSession({
    lang: 'el-GR', ...opts,
    onState: s => states.push(s), onText: t => texts.push(t), onEnd: (final, error) => ends.push({ final, error }),
  });
  return { session, states, texts, ends, rec: created[created.length - 1] };
};
const tick = (ms: number) => new Promise(r => setTimeout(r, ms));

async function sessions() {
  delete g.webkitSpeechRecognition; delete g.SpeechRecognition;
  {
    const r = run();
    ok('χωρίς αναγνώστρια: null και «δεν υποστηρίζεται»', r.session === null && r.ends[0]?.error === 'unsupported');
  }
  g.webkitSpeechRecognition = FakeRecognition;
  {
    const r = run({ continuous: true, silenceMs: 30, noSpeechMs: 1000 });
    ok('ρυθμίσεις: ελληνικά, ενδιάμεσα, συνεχής', r.rec.lang === 'el-GR' && r.rec.interimResults && r.rec.continuous && r.rec.started === 1);
    ok('αμέσως μετά την έναρξη: ακούει', r.states.at(-1)?.status === 'listening');
    r.rec.onresult(ev(['πλήρωσα', false]));
    ok('ενδιάμεσο κείμενο φτάνει', r.texts.at(-1) === 'πλήρωσα');
    r.rec.onresult(ev(['πλήρωσα τον υδραυλικό', true]));
    ok('τελικό αντικαθιστά το ενδιάμεσο', r.texts.at(-1) === 'πλήρωσα τον υδραυλικό');
    await tick(60);
    ok('η σιωπή σταματά την ακρόαση', r.rec.stopped === 1);
    ok('τέλος με το τελικό κείμενο, χωρίς σφάλμα', r.ends.length === 1 && r.ends[0].final === 'πλήρωσα τον υδραυλικό' && r.ends[0].error === null);
    ok('τελική κατάσταση: ηρεμία', r.states.at(-1)?.status === 'idle');
  }
  {
    const r = run({ noSpeechMs: 20 });
    await tick(50);
    ok('καμία λέξη: «δεν άκουσα»', r.ends[0]?.error === 'no-speech' && r.states.at(-1)?.status === 'error');
  }
  {
    const r = run({ noSpeechMs: 1000 });
    r.rec.onerror({ error: 'not-allowed' });
    r.rec.onend();
    ok('άρνηση μικροφώνου: σφάλμα που μένει μετά το end', r.ends[0]?.error === 'denied' && r.states.at(-1)?.error === 'denied');
    r.rec.onend();
    ok('δεύτερο end δεν ξανακαλεί', r.ends.length === 1);
  }
  {
    const r = run({ noSpeechMs: 1000 });
    r.rec.onerror({ error: 'aborted' });
    r.session!.abort();
    ok('abort: τέλος χωρίς σφάλμα', r.ends.length === 1 && r.ends[0].error === null && r.states.at(-1)?.status === 'idle');
  }
  {
    const r = run({ continuous: false, noSpeechMs: 1000 });
    ok('Νόα: στάση στην πρώτη παύση', r.rec.continuous === false);
    r.rec.onresult(ev(['τι φόρο πληρώνω ερωτηματικό', true]));
    r.session!.stop();
    await tick(5);
    ok('στίξη και στο τελικό της συνεδρίας', r.ends[0]?.final === 'τι φόρο πληρώνω;');
  }
  {
    throwOnStart = true;
    const r = run();
    throwOnStart = false;
    ok('η αναγνώστρια αρνείται να ξεκινήσει: σφάλμα και τέλος', r.session === null && r.ends[0]?.error === 'other');
  }
  delete g.webkitSpeechRecognition;
}

sessions().then(() => {
  console.log(`${pass} πέρασαν, ${fail} απέτυχαν`);
  if (fail) process.exit(1);
});
