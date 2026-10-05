// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΔΕΥΤΕΡΟ REEL: «ΒΑΛΕ ΤΟ ΑΚΙΝΗΤΟ ΣΟΥ ΣΕ ΤΑΞΗ»
// ─────────────────────────────────────────────────────────────────────────
// ΧΡΗΣΗ:  npx tsx scripts/marketing/reelTaxi.ts   (μετά: reelTaxiSound.ts)
//
// Η ΙΔΕΑ ΕΙΝΑΙ Η ΥΠΟΓΡΑΦΗ ΤΗΣ ΜΑΡΚΑΣ, ΣΕ ΕΙΚΟΝΑ. Επτά χαρτιά σκόρπια και
// στραβά (τα επτά είδη εγγράφων που διαβάζει η σάρωση) και στον χτύπο
// κουμπώνουν σε μία καθαρή λίστα. Χάος, τάξη. Μετά έξι κεφάλαια των πέντε
// χτύπων, ένα για κάθε δουλειά που κάνει το PROPERWISE. Στο τέλος τα έξι
// γίνονται ένα: το σήμα και η υπογραφή.
//
// ΚΑΜΙΑ ΛΕΙΤΟΥΡΓΙΑ ΔΕΝ ΓΡΑΦΕΤΑΙ ΑΠΟ ΜΝΗΜΗΣ. Τα είδη εγγράφων από τη σάρωση
// (lib/billing/documents.ts), οι πάροχοι και οι ασφαλιστικές από τους
// καταλόγους της εφαρμογής, οι προθεσμίες από το φορολογικό ημερολόγιο, ο
// λογαριασμός από το ακίνητο επίδειξης, τα καθαρά από την incomeStatement.
// Ό,τι δεν υπάρχει στον κώδικα δεν υπάρχει και στο βίντεο.
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ASSISTANT_ACC, ASSISTANT_NAME, ASSISTANT_INITIAL } from '../../lib/assistant/identity';
import { DEMO_PROPERTY, demoExpenses } from '../../lib/demo/sample';
import { DOC_TYPES } from '../../lib/billing/documents';
import { PROVIDERS, CATALOGUE_MONTH_GEN, TARIFFS_LABEL } from '../../lib/energy/catalogue';
import { INSURANCE_COMPANIES } from '../../app/dashboard/components/insurance/catalog';
import { greekPropertyTaxObligations, type TaxObligationKind } from '../../lib/tax/greekTaxCalendar';
import { WHO_LABEL } from '../../lib/accounting/dossier';
import { athensToday } from '../../lib/core/time';
import { feRate } from '../../lib/core/format';
import { C, esc, ico, mark } from './igKit';
import { S, UP, eur, SEG, RATE, yearAhead } from './rentFacts';
import { BASE_CSS, BG_JS, MOTION_JS, mask, shoot, W } from './reelKit';
import { TAXI } from './reelTaxiTimeline';

const OUT_VIDEO = join(process.cwd(), 'docs/marketing/reels/reel-2');
const OUT_DOC = join(process.cwd(), 'docs/marketing/instagram/reel-2');
const TAGLINE = 'Βάλε το ακίνητό σου σε τάξη.';

// ── Τα γεγονότα ──────────────────────────────────────────────────────────
const DOCS = DOC_TYPES.filter(d => d.id !== 'other').map(d => d.label);
if (DOCS.length !== 7) throw new Error(`Το χάος έχει επτά χαρτιά· η σάρωση ξέρει ${DOCS.length} είδη.`);
const N_INSURERS = INSURANCE_COMPANIES.filter(i => /^https:\/\//.test(i.url || '')).length;
const today = athensToday();
// Τρεις προθεσμίες του επόμενου δωδεκαμήνου, τρία διαφορετικά είδη και τρεις
// διαφορετικές μέρες: δύο γραμμές με την ίδια ημερομηνία μοιάζουν με λάθος.
// Οι ημερομηνίες από το ημερολόγιο, οι τίτλοι σύντομοι για να χωρούν σε μία γραμμή.
const SHORT: Partial<Record<TaxObligationKind, string>> = {
  e9: 'Ε9, μεταβολές ακινήτων', 'enfia-first': 'ΕΝΦΙΑ, πρώτη δόση', 'income-decl': 'Δήλωση εισοδήματος, Ε1 και Ε2',
};
const AHEAD = [0, 1].flatMap(d => greekPropertyTaxObligations(Number(today.slice(0, 4)) + d, 'long_term')).filter(o => o.date >= today);
const DEADLINES = (Object.keys(SHORT) as TaxObligationKind[])
  .map(k => AHEAD.filter(o => o.kind === k).sort((a, b) => a.date.localeCompare(b.date))[0])
  .filter(o => o !== undefined).sort((a, b) => a.date.localeCompare(b.date));
if (DEADLINES.length < 3) throw new Error('Το ημερολόγιο δεν έχει τις τρεις προθεσμίες του επόμενου δωδεκαμήνου.');
const toastFound = DEADLINES.find(o => o.kind === 'enfia-first');
if (!toastFound) throw new Error('Λείπει η πρώτη δόση του ΕΝΦΙΑ.');
const TOAST = toastFound;
// Η πρώτη υπενθύμιση φεύγει επτά μέρες πριν (reminder_7days στο supabase/functions/send-reminders).
const REMIND_DAYS = 7;
const MONTHS = ['ΙΑΝ', 'ΦΕΒ', 'ΜΑΡ', 'ΑΠΡ', 'ΜΑΪ', 'ΙΟΥΝ', 'ΙΟΥΛ', 'ΑΥΓ', 'ΣΕΠ', 'ΟΚΤ', 'ΝΟΕ', 'ΔΕΚ'];
const found = demoExpenses(S.year).find(e => e.category === 'electricity');
if (!found) throw new Error('Το ακίνητο επίδειξης δεν έχει λογαριασμό ρεύματος.');
const BILL = found;
const billDate = BILL.date.split('-').reverse().join('.');
const Y = yearAhead();
// Η σύγκριση δείχνει τα ίδια τα τιμολόγια του καταλόγου: η χαμηλότερη τιμή
// kWh κάθε παρόχου για κατοικία, από τη φθηνότερη στην ακριβότερη. Χωρίς ονόματα.
// ΜΟΝΟ ΤΙΜΕΣ ΤΟΥ ΜΗΝΑ ΤΟΥ ΠΙΝΑΚΑ, με τον ίδιο κανόνα που βγάζει τον νικητή
// στην εφαρμογή: μια τιμή Αυγούστου δίπλα σε τιμές Οκτωβρίου δεν είναι
// σύγκριση. Εξω τα μη εμπορικά διαθέσιμα, τα φοιτητικά και όσα δεν έχουν
// σταθερή τιμή kWh (δυναμικό, πάγιο μηνιαίο). Ο αριθμός στην οθόνη είναι οι
// πάροχοι με τέτοια τιμή, όχι όλος ο κατάλογος.
const TARIFFS = PROVIDERS.map(g => Math.min(...g.tariffs
  .filter(t => t.segment === 'residential' && !t.studentOnly && !t.notAvailable && t.priceMonth === CATALOGUE_MONTH_GEN
    && t.type !== 'dynamic' && t.type !== 'fixed_monthly' && (t.kwh_day ?? 0) > 0)
  .map(t => t.kwh_day as number)))
  .filter(Number.isFinite).sort((a, b) => a - b);
const N_PROVIDERS = TARIFFS.length;
if (N_PROVIDERS < 5) throw new Error(`Μόνο ${N_PROVIDERS} πάροχοι με τιμή ${CATALOGUE_MONTH_GEN}: η σύγκριση δεν στέκει.`);
// Η σάρωση: ο λογαριασμός σε μεγέθυνση, στο κέντρο της σκηνής.
// Στη σάρωση το έγγραφο έχει το ύψος του περιεχομένου του: χωρίς άδειο χαρτί κάτω.
const SCAN = { k: 1.5, h: 392, x: Math.round((1080 - 380 * 1.5) / 2), y: 640 };

// ── Εικονίδια: γραμμή, ίδιο πάχος παντού ──────────────────────────────────
const svg = (d: string, c: string, px: number, sw = 2) =>
  `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${d.split('|').map(x => `<path d="${x}"/>`).join('')}</svg>`;
const I = {
  camera: 'M4 8h3l2-3h6l2 3h3v11H4z|M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7',
  chat: 'M21 12a8 8 0 0 1-8 8H8l-5 3 1.4-4.2A8 8 0 1 1 21 12',
  cal: 'M4 6h16v14H4z|M4 10h16|M8 3v4|M16 3v4',
  bars: 'M5 20V11|M12 20V5|M19 20v-6|M3 20h18',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  grid: 'M4 4h7v7H4z|M13 4h7v7h-7z|M4 13h7v7H4z|M13 13h7v7h-7z',
  doc: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z|M14 3v5h5|M9 13h6|M9 17h4',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9|M10 21a2 2 0 0 0 4 0',
  bank: 'M3 21h18|M5 21V10|M19 21V10|M9 21v-7|M15 21v-7|M12 3l9 5H3z',
  shield: 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z',
  sync: 'M4 12a8 8 0 0 1 14-5l2 2|M20 4v5h-5|M20 12a8 8 0 0 1-14 5l-2-2|M4 20v-5h5',
};

const CHAPTERS = [
  { key: 'ΣΑΡΩΣΗ · 7 ΕΙΔΗ ΕΓΓΡΑΦΩΝ', t1: 'Φωτογράφισε.', t2: 'Καταχωρείται.' },
  { key: `${UP(ASSISTANT_NAME)} · ΠΑΡΑΔΕΙΓΜΑ`, t1: `Ρώτα ${ASSISTANT_ACC}.`, t2: 'Στα ελληνικά.' },
  { key: 'ΦΟΡΟΙ ΚΑΙ ΠΡΟΘΕΣΜΙΕΣ', t1: 'Κάθε προθεσμία,', t2: 'πριν λήξει.' },
  { key: 'ΣΥΓΚΡΙΣΗ', t1: 'Σύγκρινε.', t2: 'Κράτα το καλύτερο.' },
  { key: 'ΦΑΚΕΛΟΣ ΛΟΓΙΣΤΗ', t1: 'Έτοιμο για', t2: 'τον λογιστή.' },
  { key: 'ΤΑΜΠΛΟ', t1: 'Όλα με', t2: 'μια ματιά.' },
];
const RECAP = [
  { i: I.camera, t: 'Σάρωση' }, { i: I.chat, t: ASSISTANT_NAME }, { i: I.cal, t: 'Προθεσμίες' },
  { i: I.bars, t: 'Σύγκριση' }, { i: I.folder, t: 'Λογιστής' }, { i: I.grid, t: 'Ταμπλό' },
];
const HOOK = ['Λογαριασμοί.', 'Μισθωτήρια.', 'ΕΝΦΙΑ.', 'Προθεσμίες.'];

// ── Τα επτά έγγραφα του χάους ────────────────────────────────────────────
// Κάθε είδος με τη δική του μορφή, όπως το ξέρει ο ιδιοκτήτης: ο λογαριασμός
// με τον γραμμωτό κώδικα, η απόδειξη ταμείου με τη σκισμένη άκρη, το
// μισθωτήριο με τις υπογραφές. Επτά ίδιες κάρτες με γκρι γραμμές δεν είναι
// χάος, είναι πρότυπο· και το μάτι το καταλαβαίνει στο πρώτο μισό δευτερόλεπτο.
// Τα ποσά είναι του ακινήτου επίδειξης, όπως στο υπόλοιπο reel. Κανένα
// λογότυπο, καμία επωνυμία αρχής ή εταιρείας: γενικά έγγραφα.
const EXP = (cat: string) => {
  const e = demoExpenses(S.year).find(x => x.category === cat);
  if (!e) throw new Error(`Το ακίνητο επίδειξης δεν έχει δαπάνη «${cat}».`);
  return e;
};
const ddmm = (iso: string) => iso.split('-').reverse().join('.');
const PEA_SCALE = ['Α+', 'Α', 'Β+', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η'];
const PEA_COLORS = ['#1f9d55', '#38b26a', '#7cc25a', '#b6cf45', '#e3d23a', '#f0b43a', '#ec8a36', '#e2603a', '#cf3e3a'];
if (!PEA_SCALE.includes(DEMO_PROPERTY.energyClass)) throw new Error('Άγνωστη ενεργειακή κλάση στο ακίνητο επίδειξης.');
const stamp = (t: string, rot: number, pos: string) => `<span class="stamp mono" style="${pos};transform:rotate(${rot}deg)">${esc(t)}</span>`;
const lines = (ws: number[]) => ws.map(w => `<i style="width:${w}%"></i>`).join('');
// Ο λογαριασμός εμφανίζεται δύο φορές: στο χάος και στη σάρωση. Ίδιο έγγραφο,
// ώστε ο θεατής να βλέπει το χαρτί του χάους να μπαίνει σε τάξη. Τα πεδία που
// «διαβάζει» η σάρωση έχουν id: τα πλαίσια μετριούνται πάνω τους, δεν γράφονται.
const billHtml = (pre: string, stamped = true) => `
    <div class="band mono"><span id="${pre}-kind">ΛΟΓΑΡΙΑΣΜΟΣ ΡΕΥΜΑΤΟΣ</span></div>
    <div class="pad"><div class="kv"><span>Έκδοση</span><b id="${pre}-date">${esc(ddmm(EXP('electricity').date))}</b></div><div class="kv"><span>Περίοδος</span><b>2 μήνες</b></div>
    ${lines([92, 70, 84])}<div class="due"><span class="mono">ΠΟΣΟ ΠΛΗΡΩΜΗΣ</span><b id="${pre}-amt">${esc(eur(EXP('electricity').amount))}</b></div><div class="bar"></div></div>
    ${stamped ? stamp('ΛΗΓΕΙ', -12, 'right:30px;top:172px') : ''}`;
const DOC_FACES: Record<string, { w: number; h: number; html: string }> = {
  bill: { w: 380, h: 540, html: billHtml('hb') },
  payment: { w: 250, h: 560, html: `
    <div class="rc mono"><div class="c">ΑΠΟΔΕΙΞΗ</div><div class="c s">ΠΑΡΟΧΗΣ ΥΠΗΡΕΣΙΩΝ</div><hr>
    <div class="l"><span>ΥΔΡΑΥΛΙΚΟΣ</span></div><div class="l"><span>ΜΠΑΤΑΡΙΑ ΜΠΑΝΙΟΥ</span></div><div class="l"><span>ΕΡΓΑΣΙΑ</span></div><hr>
    <div class="l t"><span>ΣΥΝΟΛΟ</span><b>${esc(eur(EXP('plumber').amount))}</b></div><div class="c s">${esc(ddmm(EXP('plumber').date))}</div><div class="bar sm"></div></div>` },
  lease: { w: 380, h: 520, html: `
    <div class="pad"><div class="ttl2">ΜΙΣΘΩΤΗΡΙΟ</div><div class="c s mono">ΚΑΤΟΙΚΙΑΣ</div>
    <div class="art mono">ΑΡΘΡΟ 1</div>${lines([96, 90, 94, 60])}<div class="art mono">ΑΡΘΡΟ 2</div>${lines([92, 88, 70])}
    <div class="sig"><span>Εκμισθωτής</span><span>Μισθωτής</span></div></div>` },
  deed: { w: 370, h: 520, html: `
    <div class="pad"><div class="ttl2" style="font-size:24px">ΣΥΜΒΟΛΑΙΟ</div><div class="c s mono">ΑΓΟΡΑΠΩΛΗΣΙΑΣ ΑΚΙΝΗΤΟΥ</div>
    ${lines([96, 92, 95, 88, 94, 70, 90, 84])}<span class="seal mono">ΑΚΡΙΒΕΣ<br>ΑΝΤΙΓΡΑΦΟ</span></div>` },
  insurance: { w: 440, h: 310, html: `
    <div class="band mono" style="background:#233a5e">ΑΣΦΑΛΙΣΤΗΡΙΟ ΚΑΤΟΙΚΙΑΣ</div>
    <div class="pad"><div class="cov"><span>✓ Πυρκαγιά</span><span>✓ Σεισμός</span><span>✓ Θραύση κρυστάλλων</span></div>
    <div class="due"><span class="mono">ΕΤΗΣΙΟ ΑΣΦΑΛΙΣΤΡΟ</span><b>${esc(eur(EXP('insurance').amount))}</b></div></div>
    ${stamp('ΑΝΑΝΕΩΣΗ', 9, 'right:22px;top:92px')}` },
  tax: { w: 390, h: 500, html: `
    <div class="pad"><div class="ttl2" style="font-size:24px">ΕΚΚΑΘΑΡΙΣΤΙΚΟ ΕΝΦΙΑ</div><div class="c s mono">ΕΤΟΣ ${S.year}</div>
    <div class="grid">${Array.from({ length: 12 }, () => '<i></i>').join('')}</div>
    <div class="due"><span class="mono">ΠΟΣΟ ΦΟΡΟΥ</span><b>${esc(eur(EXP('enfia').amount))}</b></div></div>
    ${stamp('ΕΚΚΡΕΜΕΙ', -8, 'left:24px;bottom:120px')}` },
  government: { w: 360, h: 520, html: `
    <div class="pad"><div class="ttl2" style="font-size:22px;line-height:1.15">ΠΙΣΤΟΠΟΙΗΤΙΚΟ ΕΝΕΡΓΕΙΑΚΗΣ ΑΠΟΔΟΣΗΣ</div>
    <div class="pea">${PEA_SCALE.map((c, i) => `<span style="width:${34 + i * 7}%;background:${PEA_COLORS[i]}${c === DEMO_PROPERTY.energyClass ? ';outline:3px solid #1a2332;outline-offset:2px' : ''}">${esc(c)}</span>`).join('')}</div>
    <div class="qr"></div></div>` },
};
if (DOC_TYPES.filter(d => d.id !== 'other').some(d => !DOC_FACES[d.id])) throw new Error('Λείπει μορφή εγγράφου για κάποιο είδος της σάρωσης.');
const DOC_IDS = DOC_TYPES.filter(d => d.id !== 'other').map(d => d.id);
// Θέση (x, y), βάθος z, γωνίες X, Y, Z. Τα κοντινά μεγαλύτερα και λίγο θολά, τα μακρινά μικρότερα.
const CHAOS = [
  // Κάθε έγγραφο έχει τη δική του ζώνη και επικαλύπτεται μόνο στις άκρες: χάος
  // που διαβάζεται. Ο λογαριασμός μπροστά αριστερά, με το ποσό του ακάλυπτο.
  [70, 560, 90, 8, -16, -8], [660, 500, -240, -10, 22, 12], [620, 900, 30, 6, -14, 7], [150, 980, -380, -8, 16, -6],
  [380, 1200, 200, 12, 10, -5], [-90, 1330, 280, -6, 24, 13], [730, 1400, -130, 10, -20, -12],
].map((c, i) => [...c, DOC_FACES[DOC_IDS[i]].w, DOC_FACES[DOC_IDS[i]].h]);

const DATA = {
  R: TAXI, today, scan: SCAN, nProv: N_PROVIDERS, nIns: N_INSURERS,
  accent: C.accent, ink: C.ink, paper: C.paper, panel: C.panel,
  // Χάος σε τρεις διαστάσεις: θέση, βάθος, γωνίες, μέγεθος του εγγράφου.
  // Τάξη: μία γραμμή κάτω από την άλλη, όλες στο ίδιο επίπεδο.
  chaos: CHAOS,
};

const avatar = (px: number, bg: string, fg: string) =>
  `<span class="av" style="width:${px}px;height:${px}px;font-size:${Math.round(px * .5)}px;background:${bg};color:${fg}">${esc(ASSISTANT_INITIAL)}</span>`;
const chapterHead = (i: number) => `
    <div class="L mono chk" style="top:334px">${String(i + 1).padStart(2, '0')} · ${esc(CHAPTERS[i].key)}</div>
    <div class="L" style="top:382px">${mask(`t${i}a`, esc(CHAPTERS[i].t1), 'ttl')}${mask(`t${i}b`, `<span class="acc">${esc(CHAPTERS[i].t2)}</span>`, 'ttl')}</div>`;

function html(): string {
  const parts = [{ v: Y.tax, c: SEG.tax }, { v: Y.enfia, c: SEG.enfia }, { v: Y.other, c: SEG.other }, { v: Y.net, c: C.accent }];
  return `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${BASE_CSS}
  .av{display:inline-flex;align-items:center;justify-content:center;border-radius:28%;font-weight:800;flex:none}
  .ttl{font-size:92px;font-weight:850;letter-spacing:-.045em;line-height:1.03;white-space:nowrap}
  .chk{font-size:22px;color:${C.muted}}
  .hk{font-size:112px;font-weight:850;letter-spacing:-.05em;line-height:1.03;white-space:nowrap}
  .stack{position:absolute;left:90px;top:350px;width:900px;height:130px}
  .stack .mk{position:absolute;left:0;top:0}

  /* Χαρτιά και γραμμές */
  .card{position:absolute;border-radius:20px;overflow:hidden;will-change:transform}
  #desk{position:absolute;inset:0;perspective:1500px;perspective-origin:50% 55%}
  #cam{position:absolute;inset:0;transform-style:preserve-3d}
  .card{overflow:visible;left:0;top:0}
  .card .row{border-radius:20px}
  .doc{position:absolute;inset:0;border-radius:14px;overflow:hidden;color:#1a2332;
    background:linear-gradient(160deg,#ffffff 0%,#f1f4f8 55%,#e6ebf2 100%);
    box-shadow:0 50px 90px -30px #000000d0, 0 12px 24px -12px #00000080}
  .doc .pad{padding:26px 26px}
  .doc .band{background:#1a2c48;color:#e9eef6;font-size:15px;padding:16px 26px;letter-spacing:.16em}
  .doc i{display:block;height:9px;border-radius:5px;background:#d3dae4;margin-top:12px}
  .doc .kv{display:flex;justify-content:space-between;font-size:17px;color:#566274;margin-top:8px}
  .doc .kv b{color:#1a2332}
  .doc .due{display:flex;justify-content:space-between;align-items:flex-end;margin-top:26px;padding-top:16px;border-top:2px solid #1a2332}
  .doc .due span{font-size:13px;color:#566274}
  .doc .due b{font-size:40px;font-weight:850;letter-spacing:-.04em}
  .doc .bar{height:46px;margin-top:22px;background:repeating-linear-gradient(90deg,#1a2332 0 3px,transparent 3px 5px,#1a2332 5px 6px,transparent 6px 10px,#1a2332 10px 14px,transparent 14px 16px)}
  .doc .bar.sm{height:34px;margin-top:16px}
  .doc .ttl2{font-size:28px;font-weight:850;letter-spacing:.06em;text-align:center}
  .doc .c{text-align:center}
  .doc .s{font-size:13px;color:#566274;margin-top:6px;letter-spacing:.12em}
  .doc .art{font-size:12px;color:#566274;margin-top:20px}
  .doc .sig{display:flex;justify-content:space-between;margin-top:38px;font-size:14px;color:#566274}
  .doc .sig span{width:44%;border-top:1.5px solid #1a2332;padding-top:8px;text-align:center}
  .doc .seal{position:absolute;right:30px;bottom:30px;width:118px;height:118px;border-radius:50%;border:3px solid #3f6fc9;color:#3f6fc9;
    display:flex;align-items:center;justify-content:center;text-align:center;font-size:12px;line-height:1.3;transform:rotate(-14deg);box-shadow:inset 0 0 0 6px #fff, inset 0 0 0 8px #3f6fc9}
  .doc .cov{display:flex;flex-direction:column;gap:8px;font-size:18px;font-weight:600}
  .doc .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:22px}
  .doc .grid i{margin:0;height:26px;border-radius:4px;background:#e1e6ed}
  .doc .pea{display:flex;flex-direction:column;gap:5px;margin-top:22px}
  .doc .pea span{display:block;height:26px;border-radius:0 13px 13px 0;color:#fff;font-size:15px;font-weight:800;padding-left:10px;line-height:26px}
  .doc .qr{position:absolute;right:26px;bottom:26px;width:74px;height:74px;
    background:conic-gradient(#1a2332 25%,transparent 0 50%,#1a2332 0 75%,transparent 0) 0 0/18px 18px;border:6px solid #1a2332}
  .doc .rc{padding:22px 18px;font-size:13px;color:#1a2332;letter-spacing:.06em}
  .doc .rc hr{border:0;border-top:2px dashed #9aa6b6;margin:14px 0}
  .doc .rc .l{display:flex;justify-content:space-between;margin-top:9px}
  .doc .rc .t{font-weight:800;font-size:16px}
  .doc.torn{border-radius:6px 6px 0 0;-webkit-mask:linear-gradient(#000 0 0) top/100% calc(100% - 12px) no-repeat, conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) bottom/20px 12px repeat-x}
  .stamp{position:absolute;padding:8px 14px;border:3px solid ${SEG.tax};color:${SEG.tax};border-radius:8px;font-size:18px;font-weight:700;letter-spacing:.16em;
    background:#ffffffb0;mix-blend-mode:multiply}
  #sweep{position:absolute;left:90px;top:600px;width:850px;height:672px;overflow:hidden;pointer-events:none;border-radius:20px}
  #sweep i{position:absolute;top:-200px;width:240px;height:1100px;background:linear-gradient(90deg,transparent,#ffffff30,transparent);transform:rotate(18deg)}
  .kick0{font-size:22px;color:${C.muted};display:flex;align-items:center;gap:16px}
  .kick0 i{display:block;width:44px;height:3px;border-radius:3px;background:${C.accent}}
  .wd{position:absolute;left:0;top:0;will-change:transform,filter,opacity}
  .row{position:absolute;inset:0;display:flex;align-items:center;gap:22px;padding:0 26px;background:linear-gradient(180deg,${C.lift},${C.panel});
    border:1.5px solid ${C.rule};font-size:32px;font-weight:700;letter-spacing:-.015em}
  .row .ic{width:52px;height:52px;border-radius:14px;background:${C.ground};border:1.5px solid ${C.rule};display:flex;align-items:center;justify-content:center;flex:none}
  .row .ok{margin-left:auto}

  #prog{position:absolute;left:90px;right:90px;top:284px;display:flex;gap:10px;opacity:0}
  #prog i{flex:1;height:5px;border-radius:3px;background:${C.rule};overflow:hidden;display:block;position:relative}
  #prog b{position:absolute;inset:0;background:${C.accent};transform-origin:left center;transform:scaleX(0)}

  /* 01 · Σάρωση: ο λογαριασμός του χάους, σε μεγέθυνση ×${SCAN.k} */
  #sbWrap{position:absolute;left:${SCAN.x}px;top:${SCAN.y}px;width:380px;height:${SCAN.h}px;transform-origin:0 0}
  #sbDoc{position:absolute;inset:0}
  .hl{position:absolute;border:2.5px solid ${C.accent};border-radius:9px;background:${C.accent}24;opacity:0;
    box-shadow:0 0 0 4px ${C.accent}1c, 0 0 24px ${C.accent}55}
  .hl span{position:absolute;left:-2.5px;bottom:100%;margin-bottom:5px;padding:3px 7px;border-radius:5px;background:${C.accent};color:${C.onAccent};
    font-family:'Roboto Mono',monospace;font-size:10.5px;font-weight:700;letter-spacing:.12em;white-space:nowrap}
  .vf{position:absolute;width:64px;height:64px;border-color:${C.accent};border-style:solid;border-width:0}
  #beam{position:absolute;left:${SCAN.x - 18}px;width:${380 * SCAN.k + 36}px;height:4px;border-radius:2px;background:linear-gradient(90deg,transparent,${C.accent} 12%,#e6f0ff 50%,${C.accent} 88%,transparent);
    box-shadow:0 0 36px 10px ${C.accent}80;opacity:0}
  #beamGlow{position:absolute;left:${SCAN.x}px;width:${380 * SCAN.k}px;height:140px;background:linear-gradient(0deg,${C.accent}33,transparent);opacity:0}
  .sheet{position:absolute;left:150px;width:780px;top:1150px;padding:26px 30px 16px;border-radius:32px;background:linear-gradient(180deg,#1b2537f5,#121a29f5);
    border:1.5px solid ${C.rule};box-shadow:0 -30px 80px -30px #000, 0 1px 0 #ffffff14 inset}
  .sheet .hd{display:flex;align-items:center;gap:16px;font-size:30px;font-weight:750;letter-spacing:-.015em}
  .sheet .hd .okc{width:46px;height:46px;border-radius:50%;background:${C.ok}26;display:flex;align-items:center;justify-content:center}
  .sheet .hd .mono{margin-left:auto;font-size:16px;color:${C.faint}}
  .sheet .f{display:flex;justify-content:space-between;align-items:baseline;gap:20px;padding:14px 0;border-top:1.5px solid ${C.rule};margin-top:12px}
  .sheet .f span{font-family:'Roboto Mono',monospace;font-size:17px;letter-spacing:.12em;color:${C.faint}}
  .sheet .f b{font-size:28px;font-weight:700;letter-spacing:-.01em}

  /* 02 · Νόα: η απάντηση είναι κάρτα της εφαρμογής, με την ανάλυση */
  .ub{position:absolute;right:90px;top:650px;padding:24px 34px;border-radius:38px 38px 12px 38px;background:${C.accent};color:${C.onAccent};
    font-size:36px;font-weight:650;letter-spacing:-.02em;white-space:nowrap;box-shadow:0 24px 60px -24px ${C.accent}90}
  .nr{display:flex;align-items:center;gap:18px;font-size:30px;font-weight:750}
  .dots{display:flex;gap:9px;margin-left:6px}
  .dots i{width:12px;height:12px;border-radius:50%;background:${C.muted};display:block}
  .ans{position:absolute;left:90px;width:850px;top:852px;padding:32px 36px 26px;border-radius:12px 36px 36px 36px;
    background:linear-gradient(180deg,${C.lift},${C.panel});border:1.5px solid ${C.rule};box-shadow:0 50px 100px -40px #000, 0 1px 0 #ffffff12 inset}
  .ans .k{font-size:19px;color:${C.muted}}
  .big{font-size:104px;font-weight:850;letter-spacing:-.05em;color:${C.accent};white-space:nowrap;line-height:1.05}
  .mbar{display:flex;gap:4px;height:18px;border-radius:9px;overflow:hidden;width:100%;transform-origin:left center;margin-top:16px}
  .mbar i{display:block;border-radius:4px}
  .ans .r{display:flex;justify-content:space-between;align-items:center;padding:15px 0;border-top:1.5px solid ${C.rule};font-size:27px;color:${C.muted}}
  .ans .r:first-of-type{margin-top:20px}
  .ans .r b{color:${C.ink};font-weight:700}
  .ans .r .d{display:inline-block;width:13px;height:13px;border-radius:4px;margin-right:14px}
  .ans .ft{font-size:18px;color:${C.accent};margin-top:14px}

  /* 03 · Προθεσμίες: ειδοποίηση του κινητού και ο χρόνος που απομένει */
  .toast{position:absolute;left:90px;width:850px;top:640px;padding:22px 26px;border-radius:38px;display:flex;gap:20px;align-items:flex-start;
    background:#2a3650b8;backdrop-filter:blur(26px) saturate(1.4);border:1px solid #ffffff22;box-shadow:0 40px 90px -30px #000}
  .toast .ti{width:60px;height:60px;border-radius:15px;background:linear-gradient(160deg,#1f3150,${C.ground});border:1px solid #ffffff22;display:flex;align-items:center;justify-content:center;flex:none}
  .toast .l1{display:flex;justify-content:space-between;font-size:19px;color:#c3cedd;letter-spacing:.02em}
  .toast .l1 b{letter-spacing:.14em;font-weight:700;color:${C.ink}}
  .toast .tb{font-size:29px;font-weight:750;margin-top:6px;letter-spacing:-.015em}
  .toast .bd{font-size:24px;color:#c3cedd;margin-top:4px}
  .tl{position:absolute;left:145px;top:880px;width:3px;height:420px;border-radius:2px;background:linear-gradient(180deg,${C.accent}aa,${C.rule})}
  .dl{position:absolute;left:90px;width:850px;display:flex;align-items:center;gap:30px}
  .dl .dd{width:112px;height:112px;border-radius:26px;background:linear-gradient(180deg,${C.lift},${C.panel});border:1.5px solid ${C.rule};display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none;
    box-shadow:0 20px 40px -20px #000}
  .dl .dd b{font-size:48px;font-weight:850;line-height:1;letter-spacing:-.03em}
  .dl .dd span{font-size:16px;color:${C.accent};margin-top:6px}
  .dl .tx{font-size:31px;font-weight:700;letter-spacing:-.015em;line-height:1.22}
  .dl .tg{font-size:18px;color:${C.accent};margin-top:10px}

  /* 04 · Σύγκριση: τα ίδια τα τιμολόγια της εφαρμογής */
  .sh{position:absolute;left:90px;width:850px;display:flex;align-items:flex-end;gap:28px}
  .sh b{font-size:150px;font-weight:850;letter-spacing:-.05em;line-height:.8;color:${C.accent}}
  .sh .lb{font-size:40px;font-weight:750;letter-spacing:-.02em;line-height:1.1}
  .sh .sm{font-size:17px;color:${C.faint};margin-top:10px}
  .bars{position:absolute;left:90px;width:850px;height:130px;display:flex;align-items:flex-end;gap:12px}
  .bars i{flex:1;border-radius:10px 10px 4px 4px;background:#26344b;transform-origin:bottom center;display:block;position:relative}
  .bars i.lo{background:linear-gradient(180deg,#b9d2fb,${C.accent})}
  .axis{position:absolute;left:90px;width:850px;display:flex;justify-content:space-between;font-size:16px;color:${C.faint}}
  .shields{position:absolute;left:90px;width:850px;display:flex;justify-content:space-between}
  .shields span{width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:#1a2436;border:1.5px solid ${C.rule}}
  .loan{position:absolute;left:90px;width:850px;display:flex;align-items:center;gap:26px;padding-top:28px;border-top:1.5px solid ${C.rule}}
  .loan .li{width:84px;height:84px;border-radius:22px;background:${C.accent}1c;display:flex;align-items:center;justify-content:center;flex:none}
  .loan .lb{font-size:36px;font-weight:750;letter-spacing:-.02em}
  .loan .sm{font-size:17px;color:${C.faint};margin-top:8px}
  .sep{position:absolute;left:90px;width:850px;height:1.5px;background:${C.rule}}

  /* 05 · Λογιστής: ένας φάκελος με ετικέτα, τρία έγγραφα μέσα */
  .fbk{position:absolute;left:190px;top:800px;width:700px;height:560px;border-radius:30px;background:linear-gradient(180deg,#24406b,#1a2c48);box-shadow:0 60px 120px -40px #000}
  .ftab{position:absolute;left:190px;top:748px;width:360px;height:70px;border-radius:22px 22px 0 0;background:#24406b;padding:18px 26px;font-size:16px;color:#cfe0ff;letter-spacing:.14em}
  .fdoc{position:absolute;left:250px;width:580px;height:420px;border-radius:16px;background:linear-gradient(170deg,#fff,#eef2f7);color:#1a2332;padding:16px 24px;
    box-shadow:0 -10px 30px -12px #00000070}
  .fdoc .hd{display:flex;align-items:center;gap:12px;font-size:21px;font-weight:800;letter-spacing:.06em}
  .fdoc .hd em{margin-left:auto;font-style:normal;font-size:14px;color:#566274;letter-spacing:.12em;font-weight:600}
  .fdoc .g{display:grid;grid-template-columns:2fr 1fr 1fr;gap:6px;margin-top:16px}
  .fdoc .g i{display:block;height:22px;border-radius:4px;background:#e1e6ed}
  .ffr{position:absolute;left:190px;top:1000px;width:700px;height:360px;border-radius:30px;
    background:linear-gradient(180deg,#5d8ee6,#3f6fc9 60%,#3461bb);box-shadow:0 -1px 0 #ffffff55 inset, 0 -20px 40px -20px #00000060;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
  .ffr .w{font-size:24px;letter-spacing:.2em;color:#ffffffc8;font-weight:700}
  .badge{position:absolute;left:90px;width:850px;top:1392px;display:flex;justify-content:center}
  .badge span{display:flex;align-items:center;gap:14px;padding:16px 26px;border-radius:999px;background:${C.ok}1f;border:1.5px solid ${C.ok}55;font-size:27px;font-weight:700;color:${C.ink}}

  /* 06 · Ταμπλό */
  #stage3d{position:absolute;left:0;right:0;top:620px;height:1300px;perspective:2200px;perspective-origin:50% 30%}
  #phone{position:absolute;left:258px;top:0;width:564px;height:1160px;border-radius:86px;padding:15px;
    background:linear-gradient(145deg,#2b3446,#0c1019 40%,#1b2230);box-shadow:0 0 0 2px #3a465c inset, 0 90px 160px -40px #000}
  .scr{position:relative;width:100%;height:100%;border-radius:72px;overflow:hidden;background:linear-gradient(180deg,#0d1422,#070b12 60%)}
  .isl{position:absolute;left:50%;top:18px;width:150px;height:42px;margin-left:-75px;border-radius:21px;background:#000}
  .sb{display:flex;justify-content:space-between;padding:26px 44px 0;font-size:21px;font-weight:700}
  .app{padding:40px 34px 0}
  .ah{display:flex;align-items:center;gap:14px;font-size:22px;font-weight:700}
  .ah .m{width:46px;height:46px;border-radius:14px;background:${C.panel};border:1.5px solid ${C.rule};display:flex;align-items:center;justify-content:center}
  .ah .y{margin-left:auto;font-size:17px;color:${C.faint}}
  .hkk{font-size:16px;color:${C.faint};margin-top:34px}
  .an{font-size:74px;font-weight:850;letter-spacing:-.045em;color:${C.accent};margin-top:8px;white-space:nowrap}
  .rw{display:flex;justify-content:space-between;align-items:center;padding:17px 0;border-top:1.5px solid ${C.rule};font-size:21px;color:${C.muted}}
  .rw b{color:${C.ink};font-weight:700}
  .nx{display:flex;align-items:center;gap:16px;margin-top:22px;padding:18px 20px;border-radius:24px;background:${C.accent}14;border:1.5px solid ${C.accent}40}
  .nxi{width:48px;height:48px;border-radius:14px;background:${C.accent}22;display:flex;align-items:center;justify-content:center;flex:none}
  .nxk{font-size:13px;color:${C.accent};letter-spacing:.12em}
  .nxt{font-size:20px;font-weight:700;margin-top:4px}
  .nxd{margin-left:auto;font-size:20px;font-weight:800;white-space:nowrap}
  .chip{position:absolute;display:flex;align-items:center;gap:14px;padding:18px 28px 18px 20px;border-radius:999px;font-size:30px;font-weight:650;
    background:linear-gradient(180deg,${C.lift}f2,${C.panel}f2);border:1.5px solid ${C.rule};white-space:nowrap;box-shadow:0 30px 60px -24px #000}
  .chip .ci{width:40px;height:40px;border-radius:50%;background:${C.accent}22;display:flex;align-items:center;justify-content:center}

  /* Ανακεφαλαίωση και μάρκα */
  .tile{position:absolute;width:270px;height:270px;border-radius:34px;background:linear-gradient(180deg,${C.lift},${C.panel});border:1.5px solid ${C.rule};
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;font-size:32px;font-weight:750;letter-spacing:-.015em;box-shadow:0 40px 80px -36px #000}
  .tile .tic{width:92px;height:92px;border-radius:26px;background:${C.accent}1c;display:flex;align-items:center;justify-content:center}
  .ctr{position:absolute;left:150px;right:150px;display:flex;justify-content:center;text-align:center}
  .word{font-size:96px;font-weight:800;letter-spacing:.02em}
  .tag{font-size:54px;font-weight:700;letter-spacing:-.03em}
  .rule{width:64px;height:3px;border-radius:3px;background:${C.accent}}
  .url{font-size:24px;color:${C.faint}}
  #bloom{position:absolute;left:50%;top:780px;width:1200px;height:1200px;margin:-600px 0 0 -600px;border-radius:50%;
    background:radial-gradient(closest-side, ${C.accent}40, transparent);opacity:0}
  </style></head><body>
  <div id="bg"></div>

  <!-- 0 · Χάος και τάξη -->
  <section id="H">
    <div id="desk"><div id="cam">
    ${DOCS.map((d, i) => `<div class="card" id="cd${i}">
      <div class="doc deco${DOC_IDS[i] === 'payment' ? ' torn' : ''}" id="pf${i}">${DOC_FACES[DOC_IDS[i]].html}</div>
      <div class="row" id="rf${i}"><span class="ic">${svg(I.doc, C.accent, 28)}</span><span>${esc(d)}</span><span class="ok" id="ok${i}">${ico.check(C.ok, 34)}</span></div>
    </div>`).join('')}
    </div></div>
    <div id="sweep" class="deco"><i id="swi"></i></div>
    <div class="L mono kick0" id="k0" style="top:296px"><i></i>ΙΔΙΟΚΤΗΤΗΣ ΑΚΙΝΗΤΟΥ;</div>
    <div class="stack">
      ${[...HOOK, 'Σκόρπια παντού.'].map((w, i) => `<div class="hk wd" id="w${i}">${esc(w)}</div>`).join('')}
      ${mask('o1', 'Ένα μέρος', 'hk')}
    </div>
    <div class="L" style="top:465px">${mask('o2', '<span class="acc">για όλα.</span>', 'hk')}</div>
  </section>

  <!-- Μόνο στο εξώφυλλο: η υπογραφή κάτω από τη λίστα -->
  <div class="L" id="cvf" style="top:1452px;opacity:0;display:flex;align-items:center;gap:18px">${mark(46, C.ink)}<span style="font-size:30px;font-weight:800;letter-spacing:.16em">PROPERWISE</span><span class="mono" style="font-size:20px;color:${C.muted};margin-left:10px">${esc(UP(TAGLINE))}</span></div>

  <div id="prog">${CHAPTERS.map((_, i) => `<i><b id="pb${i}"></b></i>`).join('')}</div>

  <!-- 01 · Σάρωση -->
  <section id="ch0">
    ${chapterHead(0)}
    <div id="sbWrap" class="deco">
      <div class="doc" id="sbDoc">${billHtml('sb', false)}</div>
      ${['ΕΙΔΟΣ', 'ΗΜΕΡΟΜΗΝΙΑ', 'ΠΟΣΟ'].map((l, k) => `<div class="hl" id="hl${k}"><span>${l}</span></div>`).join('')}
    </div>
    <div id="beamGlow" class="deco"></div><div id="beam" class="deco"></div>
    ${[[0, 0, 'top', 'left'], [1, 0, 'top', 'right'], [0, 1, 'bottom', 'left'], [1, 1, 'bottom', 'right']].map(([cx, cy, v, h], k) =>
      `<div class="vf deco" id="vf${k}" style="left:${cx ? SCAN.x + 380 * SCAN.k + 26 - 64 : SCAN.x - 26}px;top:${cy ? SCAN.y + SCAN.h * SCAN.k + 26 - 64 : SCAN.y - 26}px;border-${v}-width:6px;border-${h}-width:6px;border-${v}-${h}-radius:22px"></div>`).join('')}
    <div class="sheet" id="res">
      <div class="hd"><span class="okc">${ico.check(C.ok, 28)}</span>Καταχωρήθηκε<span class="mono">ΣΑΡΩΣΗ</span></div>
      <div class="f" id="sf0"><span>ΕΙΔΟΣ</span><b>${esc(BILL.description)}</b></div>
      <div class="f" id="sf1"><span>ΗΜΕΡΟΜΗΝΙΑ</span><b>${esc(billDate)}</b></div>
      <div class="f" id="sf2"><span>ΠΟΣΟ</span><b style="color:${C.accent}">${esc(eur(BILL.amount))}</b></div>
    </div>
  </section>

  <!-- 02 · Νόα -->
  <section id="ch1">
    ${chapterHead(1)}
    <div class="ub" id="ub">Πόσα θα μου μείνουν καθαρά;</div>
    <div class="L nr" id="nr" style="top:770px">${avatar(52, C.accent, C.onAccent)}<span>${esc(ASSISTANT_NAME)}</span><span class="dots" id="dots"><i></i><i></i><i></i></span></div>
    <div class="ans" id="ans">
      <div class="k mono">ΚΑΘΑΡΑ ΣΤΗΝ ΤΣΕΠΗ · 12 ΜΗΝΕΣ</div>
      ${mask('nb', esc(eur(Y.net)), 'big')}
      <div class="mbar" id="nbar">${parts.map(x => `<i style="flex:${x.v};background:${x.c}"></i>`).join('')}</div>
      ${[['Ενοίκια 12 μηνών', eur(Y.gross), C.ink], [`Φόρος εισοδήματος ${RATE}`, `−${eur(Y.tax)}`, SEG.tax], ['ΕΝΦΙΑ', `−${eur(Y.enfia)}`, SEG.enfia], ['Επισκευές και άλλα έξοδα', `−${eur(Y.other)}`, SEG.other]]
        .map(([l, v, c], k) => `<div class="r" id="nr${k}"><span><i class="d" style="background:${c}"></i>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}
      <div class="ft mono" id="nft">${Y.pNet}€ ΣΤΑ 100€ ΜΕΝΟΥΝ ΣΤΗΝ ΤΣΕΠΗ ΣΟΥ</div>
    </div>
  </section>

  <!-- 03 · Προθεσμίες -->
  <section id="ch2">
    ${chapterHead(2)}
    <div class="tl deco" id="tline"></div>
    ${DEADLINES.map((o, i) => {
      const [, m, d] = o.date.split('-');
      return `<div class="dl" id="dl${i}" style="top:${860 + i * 170}px"><div class="dd"><b>${Number(d)}</b><span class="mono">${MONTHS[Number(m) - 1]}</span></div>
        <div><div class="tx">${esc(SHORT[o.kind] ?? o.title)}</div><div class="tg mono">${esc(UP(WHO_LABEL[o.who]))}</div></div></div>`;
    }).join('')}
    <div class="toast" id="toast"><span class="ti">${mark(32, C.ink)}</span><div style="flex:1">
      <div class="l1"><b class="mono">PROPERWISE</b><span>τώρα</span></div>
      <div class="tb">Υπενθύμιση προθεσμίας</div>
      <div class="bd">${esc(SHORT[TOAST.kind] ?? TOAST.title)}: λήγει σε ${REMIND_DAYS} ημέρες.</div></div></div>
  </section>

  <!-- 04 · Σύγκριση -->
  <section id="ch3">
    ${chapterHead(3)}
    <div class="sh" id="s0" style="top:650px"><b id="n0">0</b><div><div class="lb">πάροχοι ρεύματος</div><div class="sm mono">ΧΑΜΗΛΟΤΕΡΗ kWh ΑΝΑ ΠΑΡΟΧΟ · ΡΑΑΕΥ, ${esc(UP(TARIFFS_LABEL))}</div></div></div>
    <div class="bars deco" id="bars" style="top:810px">${TARIFFS.map((v, k) => `<i id="bt${k}" class="${k === 0 ? 'lo' : ''}" style="height:${Math.round(40 + 60 * (v - TARIFFS[0]) / (TARIFFS[TARIFFS.length - 1] - TARIFFS[0] || 1))}%"></i>`).join('')}</div>
    <div class="axis mono" id="ax" style="top:952px"><span>${esc(feRate(TARIFFS[0]))}/kWh</span><span>${esc(feRate(TARIFFS[TARIFFS.length - 1]))}/kWh</span></div>
    <div class="sep" style="top:1010px"></div>
    <div class="sh" id="s1" style="top:1040px"><b id="n1">0</b><div><div class="lb">ασφαλιστικές</div><div class="sm mono">ΣΥΓΚΡΙΣΗ ΑΝΑ ΚΑΛΥΨΗ</div></div></div>
    <div class="shields deco" id="shl" style="top:1190px">${Array.from({ length: N_INSURERS }, (_, k) => `<span id="sd${k}">${svg(I.shield, C.faint, 24)}</span>`).join('')}</div>
    <div class="loan" id="s2" style="top:1270px"><span class="li">${svg(I.bank, C.accent, 46, 1.8)}</span><div><div class="lb">Στεγαστικό δάνειο</div><div class="sm mono">ΔΟΣΗ, ΕΠΙΤΟΚΙΟ, ΣΥΓΚΡΙΣΗ ΤΡΑΠΕΖΩΝ</div></div></div>
  </section>

  <!-- 05 · Λογιστής -->
  <section id="ch4">
    ${chapterHead(4)}
    <div class="fbk deco" id="fb"></div>
    <div class="ftab mono" id="ftab">ΦΑΚΕΛΟΣ ΛΟΓΙΣΤΗ · ${S.year}</div>
    ${[['ΕΝΤΥΠΟ Ε2', 'ΜΙΣΘΩΜΑΤΑ'], ['ΔΗΛΩΣΗ ΜΙΣΘΩΣΗΣ', 'myAADE'], ['ΕΞΑΓΩΓΗ', 'EXCEL']].map(([t, e], k) =>
      `<div class="fdoc deco" id="dc${k}"><div class="hd">${svg(I.doc, '#3f6fc9', 26)}${esc(t)}<em>${esc(e)}</em></div><div class="g">${Array.from({ length: 12 }, () => '<i></i>').join('')}</div></div>`).join('')}
    <div class="ffr deco" id="ff">${mark(56, '#ffffffd0')}<span class="w">PROPERWISE</span></div>
    <div class="badge" id="bdg"><span>${ico.check(C.ok, 30)}Ό,τι ζητά ο λογιστής, σε έναν φάκελο.</span></div>
  </section>

  <!-- 06 · Ταμπλό -->
  <section id="ch5">
    ${chapterHead(5)}
    <div id="stage3d" class="deco"><div id="phone"><div class="scr">
      <div class="isl"></div>
      <div class="sb"><span>9:41</span><span class="mono" style="font-size:17px;letter-spacing:.06em">PROPERWISE</span></div>
      <div class="app">
        <div class="ah"><span class="m">${mark(24, C.ink)}</span><span>${esc(DEMO_PROPERTY.name)}</span><span class="y mono">12 ΜΗΝΕΣ</span></div>
        <div class="hkk mono">ΚΑΘΑΡΑ ΣΤΗΝ ΤΣΕΠΗ</div>
        <div class="an">${esc(eur(Y.net))}</div>
        <div class="mbar" style="width:100%;height:16px;margin-top:20px">${parts.map(x => `<i style="flex:${x.v};background:${x.c}"></i>`).join('')}</div>
        <div style="margin-top:26px">
          ${[['Ενοίκια', eur(Y.gross)], ['Φόρος εισοδήματος', `−${eur(Y.tax)}`], ['ΕΝΦΙΑ', `−${eur(Y.enfia)}`], ['Επισκευές και άλλα', `−${eur(Y.other)}`]]
            .map(([l, v]) => `<div class="rw"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}
        </div>
        <div class="nx"><span class="nxi">${svg(I.bell, C.accent, 24)}</span><div><div class="mono nxk">ΕΠΟΜΕΝΗ ΠΡΟΘΕΣΜΙΑ</div><div class="nxt">${esc(SHORT[DEADLINES[0].kind] ?? DEADLINES[0].title)}</div></div>
          <b class="nxd">${Number(DEADLINES[0].date.slice(8))} ${MONTHS[Number(DEADLINES[0].date.slice(5, 7)) - 1]}</b></div>
      </div>
    </div></div></div>
    <div class="chip" id="cp0" style="right:150px;top:1370px"><span class="ci">${svg(I.sync, C.accent, 24)}</span>Airbnb · Booking.com</div>
    <div class="chip" id="cp1" style="left:90px;top:1370px"><span class="ci">${svg(I.shield, C.accent, 24)}</span>Δεδομένα στην ΕΕ</div>
  </section>

  <!-- Ανακεφαλαίωση -->
  <section id="RC">
    <div class="L" style="top:360px">${mask('r1', 'Ένα μέρος', 'hk')}${mask('r2', '<span class="acc">για όλα.</span>', 'hk')}</div>
    ${RECAP.map((r, i) => `<div class="tile" id="tl${i}" style="left:${90 + (i % 3) * 290}px;top:${700 + Math.floor(i / 3) * 300}px"><span class="tic">${svg(r.i, C.accent, 50, 1.8)}</span>${esc(r.t)}</div>`).join('')}
  </section>

  <!-- Η μάρκα -->
  <section id="EN">
    <div id="bloom" class="deco"></div>
    <div class="ctr" id="e0" style="top:600px">${mark(150, C.ink)}</div>
    <div class="ctr" style="top:802px">${mask('e1', 'PROPERWISE', 'word')}</div>
    <div class="ctr" id="e2" style="top:945px"><span class="rule"></span></div>
    <div class="ctr" style="top:988px">${mask('e3', esc(TAGLINE), 'tag')}</div>
    <div class="ctr mono url" id="e5" style="top:1082px;color:${C.muted}">ΓΙΑ ΚΑΘΕ ΙΔΙΟΚΤΗΤΗ ΑΚΙΝΗΤΟΥ ΣΤΗΝ ΕΛΛΑΔΑ</div>
    <div class="ctr mono url" id="e4" style="top:1170px">PROPERWISE.GR · ΣΥΝΔΕΣΜΟΣ ΣΤΟ BIO</div>
  </section>

  <div class="vig"></div><div class="grain"></div>
  <script>
  const D = ${JSON.stringify(DATA)};
  const R = D.R, CH = R.chapters;
  ${MOTION_JS}
  ${BG_JS}

  // Ένα κεφάλαιο μπαίνει από δεξιά και φεύγει αριστερά, πάνω σε χτύπο.
  const chapter = i => {
    const c = CH[i], n = i < 5 ? CH[i + 1] : R.recap;
    const inn = eo(p(T, c - .3, c + .3)), out = ei(p(T, n - .3, n + .02));
    const el = $('ch' + i);
    op(el, T >= c - .3 && T < n + .05 ? 1 : 0);
    // Η σκηνή δεν στέκει ποτέ ακίνητη: ένα αργό πλησίασμα σε όλο το κεφάλαιο,
    // γύρω από το κέντρο, όσο χωρά χωρίς να βγει κείμενο από τις ζώνες.
    const push = eio(p(T, c, n));
    el.style.transformOrigin = '540px 960px';
    tf(el, 'translateX(' + (W * (1 - inn) - W * out) + 'px) translateY(' + (-10 * push) + 'px) scale(' + (1 + .015 * push) + ')');
    rev('t' + i + 'a', c + .05, null, .55); rev('t' + i + 'b', c + .17, null, .55);
    return T - c;
  };
  const W = ${W};
  let HL = null;

  window.render = t => {
    T = t;
    bgPaint(t);

    // ── 0 · Χάος και τάξη ───────────────────────────────────────────────
    // ΤΟ ΤΕΛΟΣ ΔΕΝΕΙ ΜΕ ΤΗΝ ΑΡΧΗ. Μετά το R.loop η σκηνή του χάους ξαναμπαίνει
    // όπως στο καρέ 0, ώστε η επανάληψη του Instagram να μη φαίνεται.
    const lp = eio(p(t, R.loop, R.dur - .04));
    const tt = t;
    if (t >= R.loop) { t = 0; T = 0; }
    const outH = ei(p(t, CH[0] - .3, CH[0] + .02));
    op($('H'), tt >= R.loop ? lp : t < CH[0] + .05 ? 1 : 0);
    tf($('H'), 'translateX(' + (-W * outH) + 'px)');
    // Οι λέξεις του χάους: μπαίνουν από θολό σε καθαρό και φεύγουν ολόκληρες
    // πριν μπει η επόμενη· δύο λέξεις μαζί στο ίδιο σημείο δεν διαβάζονται.
    const starts = [...R.words, R.scatter];
    starts.forEach((s, i) => {
      const el = $('w' + i), a = s === 0 ? 1 : eo(p(t, s, s + .45));
      const b = ei(p(t, (starts[i + 1] ?? R.snap) - .28, (starts[i + 1] ?? R.snap) - .04));
      op(el, a * (1 - b));
      el.style.filter = 'blur(' + ((1 - a) * 16 + b * 12) + 'px)';
      tf(el, 'translateY(' + ((1 - a) * 22 - b * 18) + 'px) scale(' + (1.07 - .07 * a) + ')');
    });
    op($('k0'), 1 - eo(p(t, R.snap - .2, R.snap + .1)));
    rev('o1', R.snap + .15, null, .55); rev('o2', R.snap + .28, null, .55);

    // Η κάμερα πλησιάζει αργά το χάος· στο κούμπωμα γυρίζει ίσια.
    const snapAll = eio(p(t, R.snap, R.snap + .7));
    tf($('cam'), 'translateZ(' + (140 * p(t, 0, R.snap) * (1 - snapAll)) + 'px) rotateZ(' + (Math.sin(t * .5) * 1.2 * (1 - snapAll)) + 'deg)');
    D.chaos.forEach(([x, y, z, rx, ry, rz, w, h], i) => {
      const k = spring(p(t, R.snap + i * .05, R.snap + .85 + i * .05));
      const u = 1 - k;
      const fx = Math.sin(t * .8 + i * 1.7) * 16, fy = Math.cos(t * .6 + i * 1.3) * 14;
      const frx = Math.sin(t * .5 + i) * 6, fry = Math.cos(t * .45 + i * 2) * 7, frz = Math.sin(t * .4 + i * 3) * 4;
      const el = $('cd' + i);
      el.style.width = lerp(w, 850, k) + 'px';
      el.style.height = lerp(h, 84, k) + 'px';
      tf(el, 'translate3d(' + (lerp(x, 90, k) + fx * u) + 'px,' + (lerp(y, 600 + i * 96, k) + fy * u) + 'px,' + (z * u) + 'px)' +
        ' rotateX(' + (rx + frx) * u + 'deg) rotateY(' + (ry + fry) * u + 'deg) rotateZ(' + (rz + frz) * u + 'deg)');
      // Βάθος πεδίου: ό,τι είναι μακριά ή πολύ κοντά θολώνει λίγο.
      const blur = Math.max(0, Math.abs(z - 40) - 120) / 90 * u;
      const f = eo(p(k, .2, .6));
      $('pf' + i).style.filter = blur > .05 ? 'blur(' + blur.toFixed(2) + 'px)' : 'none';
      op($('pf' + i), 1 - f); op($('rf' + i), f);
      const o = spring(p(t, R.snap + .55 + i * .06, R.snap + 1.2 + i * .06));
      op($('ok' + i), cl(o * 1.5)); tf($('ok' + i), 'scale(' + (.4 + .6 * o) + ')');
    });
    // Μια λάμψη περνά πάνω από τη λίστα μόλις μπει σε τάξη.
    const sw = eio(p(t, R.snap + 1.05, R.snap + 1.65));
    op($('sweep'), t > R.snap + 1 && t < R.snap + 1.7 ? 1 : 0);
    $('swi').style.left = (-300 + 1300 * sw) + 'px';
    t = tt; T = tt;

    // ── Η γραμμή προόδου των κεφαλαίων ──────────────────────────────────
    op($('prog'), eo(p(t, CH[0] - .2, CH[0] + .2)) * (1 - eo(p(t, R.recap - .3, R.recap))));
    CH.forEach((c, i) => tf($('pb' + i), 'scaleX(' + p(t, c, (CH[i + 1] ?? R.recap)) + ')'));

    // ── 01 · Σάρωση ─────────────────────────────────────────────────────
    let u = chapter(0);
    // Τα πλαίσια μετριούνται μία φορά, πάνω στα ίδια τα πεδία του εγγράφου.
    if (!HL) {
      HL = ['kind', 'date', 'amt'].map((f, k) => {
        const el = $('sb-' + f); let x = 0, y = 0;
        for (let e = el; e && e.id !== 'sbDoc'; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
        const b = $('hl' + k), pad = 5;
        b.style.left = (x - pad) + 'px'; b.style.top = (y - pad) + 'px';
        b.style.width = (el.offsetWidth + 2 * pad) + 'px'; b.style.height = (el.offsetHeight + 2 * pad) + 'px';
        return 1;
      });
    }
    const bi = eo(p(u, 0, .6)), dim = eo(p(u, 1.5, 1.9));
    tf($('sbWrap'), 'translateY(' + (70 * (1 - bi) - 30 * dim) + 'px) rotate(' + (-3 * (1 - bi)) + 'deg) scale(' + D.scan.k * (1 - .03 * dim) + ')');
    op($('sbDoc'), 1 - .35 * dim);
    for (let k = 0; k < 4; k++) { const v = eo(p(u, .3, .65)); op($('vf' + k), v * (1 - dim)); tf($('vf' + k), 'scale(' + (1.12 - .12 * v) + ')'); }
    const sc = eio(p(u, .5, 1.25)), on = u > .45 && u < 1.35 ? 1 : 0;
    op($('beam'), on); op($('beamGlow'), on * .9);
    $('beam').style.top = (D.scan.y + D.scan.h * D.scan.k * sc) + 'px';
    $('beamGlow').style.top = (D.scan.y + D.scan.h * D.scan.k * sc - 140) + 'px';
    [.8, .8 + .15, 1.1].forEach((s, k) => { const v = eo(p(u, s, s + .3)); op($('hl' + k), v * (1 - .6 * dim)); tf($('hl' + k), 'scale(' + (1.08 - .08 * v) + ')'); });
    const rs = spring(p(u, 1.5, 2.4));
    op($('res'), cl(rs * 1.6)); tf($('res'), 'translateY(' + (140 * (1 - rs)) + 'px)');
    for (let k = 0; k < 3; k++) { const v = eo(p(u, 1.7 + k * .1, 2.1 + k * .1)); op($('sf' + k), v); tf($('sf' + k), 'translateX(' + (30 * (1 - v)) + 'px)'); }

    // ── 02 · Νόα ────────────────────────────────────────────────────────
    u = chapter(1);
    const ub = eo(p(u, .15, .6)); op($('ub'), ub); tf($('ub'), 'translateY(' + (50 * (1 - ub)) + 'px)');
    op($('nr'), eo(p(u, .55, .85)));
    op($('dots'), u > .55 && u < 1.0 ? 1 : 0);
    Array.from($('dots').children).forEach((d, i) => tf(d, 'translateY(' + (-7 * Math.max(0, Math.sin((u - .55) * 9 - i * .9))) + 'px)'));
    const an = eo(p(u, .94, 1.4)); op($('ans'), an); tf($('ans'), 'translateY(' + (40 * (1 - an)) + 'px) scale(' + (.97 + .03 * an) + ')');
    rev('nb', CH[1] + 1.05, null, .55);
    tf($('nbar'), 'scaleX(' + eo(p(u, 1.25, 1.9)) + ')');
    for (let k = 0; k < 4; k++) { const v = eo(p(u, 1.35 + k * .1, 1.75 + k * .1)); op($('nr' + k), v); tf($('nr' + k), 'translateY(' + (14 * (1 - v)) + 'px)'); }
    op($('nft'), eo(p(u, 1.9, 2.3)));

    // ── 03 · Προθεσμίες ─────────────────────────────────────────────────
    u = chapter(2);
    tf($('tline'), 'scaleY(' + eo(p(u, .2, 1.0)) + ')'); $('tline').style.transformOrigin = 'top';
    for (let k = 0; k < 3; k++) { const v = eo(p(u, .3 + k * .15, .8 + k * .15)); op($('dl' + k), v); tf($('dl' + k), 'translateX(' + (40 * (1 - v)) + 'px)'); }
    const ts = spring(p(u, 1.15, 2.0));
    op($('toast'), cl(ts * 1.6)); tf($('toast'), 'translateY(' + (-150 * (1 - ts)) + 'px) scale(' + (.94 + .06 * ts) + ')');

    // ── 04 · Σύγκριση ───────────────────────────────────────────────────
    u = chapter(3);
    [[0, D.nProv], [1, D.nIns]].forEach(([k, n]) => { const v = eio(p(u, .3 + k * .55, 1.1 + k * .55)); $('n' + k).textContent = String(Math.round(n * v)); });
    for (let k = 0; k < 3; k++) { const v = eo(p(u, .2 + k * .5, .7 + k * .5)); op($('s' + k), v); tf($('s' + k), 'translateX(' + (50 * (1 - v)) + 'px)'); }
    for (let k = 0; k < D.nProv; k++) { const v = eo(p(u, .4 + k * .06, .9 + k * .06)); tf($('bt' + k), 'scaleY(' + v + ')'); }
    op($('ax'), eo(p(u, 1.0, 1.3)));
    for (let k = 0; k < D.nIns; k++) { const on = u > .9 + k * .035; $('sd' + k).style.background = on ? 'rgba(138,180,248,.16)' : '#1a2436'; $('sd' + k).style.borderColor = on ? 'rgba(138,180,248,.5)' : '${C.rule}'; }

    // ── 05 · Λογιστής ───────────────────────────────────────────────────
    u = chapter(4);
    const fo = eo(p(u, .1, .6));
    ['fb', 'ftab', 'ff'].forEach(id => { op($(id), fo); tf($(id), 'translateY(' + (70 * (1 - fo)) + 'px)'); });
    [0, 1, 2].forEach(k => {
      const s = .4 + k * .3, v = spring(p(u, s, s + .85));
      op($('dc' + k), u > s ? 1 : 0);
      // Κάθε έγγραφο κάθεται λίγο χαμηλότερα από το προηγούμενο: διαβάζονται και οι τρεις τίτλοι.
      $('dc' + k).style.top = lerp(470, 820 + k * 56, v) + 'px';
      tf($('dc' + k), 'rotate(' + lerp(k % 2 ? 5 : -5, 0, v) + 'deg)');
    });
    const bd = spring(p(u, 1.75, 2.55)); op($('bdg'), cl(bd * 1.5)); tf($('bdg'), 'translateY(' + (30 * (1 - bd)) + 'px)');

    // ── 06 · Ταμπλό ─────────────────────────────────────────────────────
    u = chapter(5);
    const ph = eo(p(u, .1, 1.1));
    tf($('phone'), 'translateY(' + (820 * (1 - ph) + Math.sin(u * 1.5) * 7) + 'px) rotateX(' + (30 - 22 * ph) + 'deg) rotateY(' + (-20 + 12 * ph) + 'deg) rotateZ(' + (4 - 4 * ph) + 'deg)');
    [1.1, 1.5].forEach((s, k) => { const v = spring(p(u, s, s + 1)); op($('cp' + k), cl(v * 1.6)); tf($('cp' + k), 'translateY(' + (36 * (1 - v)) + 'px) scale(' + (.86 + .14 * v) + ')'); });

    // ── Ανακεφαλαίωση: έξι πλακίδια σε πλέγμα, μετά γίνονται ένα ───────
    const inR = t >= R.recap - .3 && t < R.end + .3;
    op($('RC'), inR ? 1 - eo(p(t, R.end - .15, R.end + .2)) : 0);
    rev('r1', R.recap + .05, R.end - .5, .55); rev('r2', R.recap + .17, R.end - .5, .55);
    const gather = eio(p(t, R.end - .6, R.end));
    for (let k = 0; k < 6; k++) {
      const s = R.recap + .1 + k * .15, v = spring(p(t, s, s + .9));
      const x = 90 + (k % 3) * 290, y = 700 + Math.floor(k / 3) * 300;
      const gx = (540 - 135 - x) * gather, gy = (670 - y) * gather;
      op($('tl' + k), cl(v * 1.6) * (1 - gather));
      tf($('tl' + k), 'translate(' + gx + 'px,' + (gy + 60 * (1 - v)) + 'px) scale(' + ((.6 + .4 * v) * (1 - .7 * gather)) + ') rotate(' + ((k % 2 ? 8 : -8) * (1 - v)) + 'deg)');
    }

    // ── Η μάρκα ─────────────────────────────────────────────────────────
    op($('EN'), eo(p(t, R.end - .1, R.end + .25)) * (1 - lp));
    const m0 = spring(p(t, R.end, R.end + 1.1));
    op($('e0'), cl(m0 * 1.5)); tf($('e0'), 'scale(' + (.5 + .5 * m0) + ')');
    op($('bloom'), .9 * eo(p(t, R.end, R.end + 1.4)));
    rev('e1', R.end + .3, null, .7); rev('e3', R.end + .8, null, .8);
    const q = eo(p(t, R.end + .55, R.end + 1.2)); op($('e2'), q); tf($('e2'), 'scaleX(' + q + ')');
    op($('e5'), eo(p(t, R.end + .9, R.end + 1.3)));
    op($('e4'), eo(p(t, R.end + 1.1, R.end + 1.5)));
  };
  </script>
  </body></html>`;
}

// ── Η λεζάντα ────────────────────────────────────────────────────────────
const CAPTION = [
  'Λογαριασμοί, μισθωτήρια, ΕΝΦΙΑ, προθεσμίες. Όλα σε ένα μέρος.',
  '',
  'Τι κάνει το PROPERWISE, σε 30 δευτερόλεπτα:',
  '',
  `Σάρωση. Φωτογραφίζεις λογαριασμό, απόδειξη ή μισθωτήριο και καταχωρείται μόνο του. ${DOCS.length} είδη εγγράφων.`,
  `${ASSISTANT_NAME}. Ρωτάς στα ελληνικά «πόσα θα μου μείνουν καθαρά;» και παίρνεις απάντηση με τα δικά σου νούμερα.`,
  `Προθεσμίες. ΕΝΦΙΑ, Ε9, δήλωση εισοδήματος. Υπενθύμιση ${REMIND_DAYS} ημέρες πριν λήξουν.`,
  `Σύγκριση. ${N_PROVIDERS} πάροχοι ρεύματος με τιμές ${CATALOGUE_MONTH_GEN} από τη ΡΑΑΕΥ, ${N_INSURERS} ασφαλιστικές, στεγαστικά δάνεια τραπεζών.`,
  'Λογιστής. Ε2, δήλωση μίσθωσης και Excel σε έναν φάκελο.',
  'Ταμπλό. Όλα με μια ματιά, σε κινητό και υπολογιστή.',
  '',
  `Στο παράδειγμα του βίντεο, από ${eur(Y.gross)} ενοίκια τον χρόνο μένουν ${eur(Y.net)} καθαρά στην τσέπη.`,
  '',
  'Αποθήκευσέ το για την επόμενη προθεσμία. Στείλ\' το σε κάποιον που νοικιάζει σπίτι.',
  '',
  'Εσύ πού κρατάς σήμερα τα χαρτιά του ακινήτου σου; Πες μας στα σχόλια.',
  '',
  `${TAGLINE} Σύνδεσμος στο bio.`,
  '',
  '#ακίνητα #ιδιοκτήτες #ενοίκια #ΕΝΦΙΑ #PROPERWISE',
].join('\n');

async function main() {
  mkdirSync(OUT_DOC, { recursive: true });
  await shoot({
    html: html(), dur: TAXI.dur, outDir: OUT_VIDEO, file: 'reel.mp4',
    checkAt: [1.0, 4.2, 7.5, 11.1, 14.7, 18.3, 21.9, 25.5, 27.9, 30.6, 31.7],
    // Το εξώφυλλο: η λίστα σε τάξη, χωρίς τη λάμψη που περνά, κεντραρισμένη στο
    // 3:4 του πλέγματος του προφίλ (y 240 ως 1680) με την υπογραφή από κάτω.
    cover: {
      t: TAXI.snap + 1.45, path: join(OUT_DOC, 'cover.jpg'),
      prep: "document.getElementById('sweep').style.opacity='0';document.getElementById('H').style.transform='translateY(90px)';document.getElementById('cvf').style.opacity='1'",
    },
  });
  if (process.env.REEL_PREVIEW) return;
  writeFileSync(join(OUT_DOC, 'caption.md'), CAPTION + '\n');
  writeFileSync(join(OUT_DOC, 'README.md'), [
    '# Instagram: το δεύτερο reel, «Βάλε το ακίνητό σου σε τάξη»',
    '',
    'Όλες οι δυνατότητες του PROPERWISE σε 30 δευτερόλεπτα. Παράγεται σε δύο βήματα',
    '(θέλει ffmpeg με libx264):',
    '',
    '    npx tsx scripts/marketing/reelTaxi.ts        # η εικόνα',
    '    npx tsx scripts/marketing/reelTaxiSound.ts   # η μουσική και το τελικό αρχείο',
    '',
    'Το βίντεο γράφεται στο `docs/marketing/reels/reel-2/PROPERWISE-reel-2.mp4`, έξω από το git.',
    'Εδώ μένουν η λεζάντα (`caption.md`) και το εξώφυλλο (`cover.jpg`).',
    '',
    'Οι προθεσμίες του τρίτου κεφαλαίου έρχονται από το φορολογικό ημερολόγιο τη μέρα',
    'που τρέχει η μηχανή: ξανατρέξ\' τη πριν από κάθε ανάρτηση.',
    '',
  ].join('\n'));
  console.log('✓ docs/marketing/instagram/reel-2/');
}

main().catch(e => { console.error(e); process.exit(1); });
