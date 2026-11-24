// npx tsx lib/mydata/status.test.ts
//
// Ο,τι λέει η οθόνη για τον συγχρονισμό myDATA: γραμμή κατάστασης σε ώρα
// Αθήνας, πρόοδος, κατάσταση ανά πελάτη με λύση σε μία φράση, ταξινόμηση και
// αναζήτηση για 200 πελάτες, όριο «Φέρε τώρα», έλεγχος μορφής κλειδιού.
import {
  athensStamp, syncedLine, clientSyncedLine, newCount, centsLabel, rowState, sortRows, filterRows,
  cardPhase, progressLine, attention, aadeDownLine, manualWaitMinutes, keyShape, runReason, LOG_ACTION, groupRows, expiringSoon, accessLogCsv, type ClientRow, type Connection,
} from './status';
import { readFileSync } from 'node:fs';
import { MYDATA_JOINT_VERSION } from '@/lib/legal/mydataJoint';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name); } };

// ── Ώρα Αθήνας, dd/mm/yyyy hh:mm ─────────────────────────────────────────
ok('χειμώνας: UTC+2', athensStamp('2026-11-23T01:10:00Z') === '23/11/2026 03:10');
ok('καλοκαίρι: UTC+3', athensStamp('2026-07-01T00:10:00Z') === '01/07/2026 03:10');
ok('αλλαγή μέρας στην Αθήνα', athensStamp('2026-12-31T22:30:00Z') === '01/01/2027 00:30');
ok('η γραμμή του λογιστή', syncedLine('2026-11-23T01:10:00Z', 12) === 'Συγχρονίστηκε 23/11/2026 03:10 · 12 νέα');
ok('ένα νέο, ενικός', newCount(1) === '1 νέο');
ok('μηδέν: «κανένα νέο»', syncedLine('2026-11-23T01:10:00Z', 0).endsWith('· κανένα νέο'));
ok('χιλιάδες με τελεία', newCount(1234) === '1.234 νέα');
ok('ποτέ συγχρονισμένο', syncedLine(null, 0) === 'Δεν έχει συγχρονιστεί ακόμη.');
ok('η γραμμή του πελάτη', clientSyncedLine('2026-11-23T01:10:00Z') === 'Τελευταία άντληση από τον λογιστή: 23/11/2026');

// ── Ποσά από λεπτά, χωρίς επανυπολογισμό ──────────────────────────────────
ok('8850 λεπτά → 88,50€', centsLabel(8850) === '88,50€');
ok('123450 λεπτά → 1.234,50€', centsLabel(123450) === '1.234,50€');
ok('πιστωτικό → αρνητικό', centsLabel(1240, true) === '-12,40€');

// ── Κατάσταση ανά πελάτη ──────────────────────────────────────────────────
const row = (p: Partial<ClientRow>): ClientRow => ({
  ownerId: 'o', name: 'Πελάτης', consent: true, status: 'ok', lastSyncAt: null, lastNew: 0, error: null, nextRetryAt: null, pending: 0, ...p,
});
const s403 = rowState(row({ status: 'forbidden', error: 'forbidden' }));
ok('403: «Άρνηση ΑΑΔΕ» με λύση', s403.label === 'Άρνηση ΑΑΔΕ' && /myAADE/.test(s403.fix) && s403.tone === 'warn');
const sDown = rowState(row({ status: 'error', error: 'server', nextRetryAt: '2026-11-23T12:05:00Z' }));
// Ε2: καμία αυτόματη νέα προσπάθεια· ο λογιστής ξαναπατά.
ok('5xx: «Η ΑΑΔΕ δεν απαντά» χωρίς υπόσχεση αυτόματης προσπάθειας', sDown.label === 'Η ΑΑΔΕ δεν απαντά' && sDown.fix === 'Πάτα «Φέρε τώρα» σε λίγο.');
ok('429: ίδια όψη', rowState(row({ status: 'error', error: 'rate' })).label === 'Η ΑΑΔΕ δεν απαντά');
ok('χωρίς άδεια: λύση από τον πελάτη', rowState(row({ consent: false, status: null })).fix.includes('«Επιτρέπω»'));
ok('χωρίς ΑΦΜ: λύση', /ΑΦΜ/.test(rowState(row({ status: 'error', error: 'no_afm' })).fix));
ok('σχήμα: δεν φορτώνει τον λογιστή', rowState(row({ status: 'error', error: 'parse' })).tone === 'wait');
ok('άγνωστο: λέει τι να πατήσει', rowState(row({ status: 'error', error: 'unknown' })).fix === 'Πάτα «Φέρε τώρα».');
// Ε2: η ΑΑΔΕ μπορεί να αρνείται ΑΦΜ χωρίς επιχείρηση· η οθόνη το λέει τίμια.
ok('403: λέει ότι η ΑΑΔΕ δεν δίνει παραστατικά για αυτό το ΑΦΜ', /δεν δίνει παραστατικά για αυτό το ΑΦΜ/.test(s403.fix));
ok('εντάξει: χωρίς λύση', rowState(row({})).fix === '');
// Αξιολόγηση 23/11/2026: οι νέες καταστάσεις έχουν όνομα και λύση.
const sQ = rowState(row({ status: 'error', error: 'quarantine', quarantined: 2 }));
ok('H1: καραντίνα: «Θέλει έλεγχο», όχι «Εντάξει»', sQ.label === 'Θέλει έλεγχο' && sQ.tone === 'warn');
ok('H1: καραντίνα χωρίς σφάλμα στη γραμμή φαίνεται κι αυτή', rowState(row({ status: 'ok', quarantined: 1 })).label === 'Θέλει έλεγχο');
const sP = rowState(row({ status: 'paused' }));
ok('H2: παύση: «Σε παύση» με λύση ανανέωσης', sP.label === 'Σε παύση' && /ανανέωση/.test(sP.fix));
ok('B1: χωρίς επιβεβαιωμένο ΑΦΜ: ο λογιστής ξέρει τι κάνει πρώτα', /ΑΦΜ/.test(rowState(row({ consent: false, status: null, afmConfirmed: false })).fix));
// Δεύτερη αξιολόγηση: ο πελάτης άλλαξε ΑΦΜ μετά τη σύνδεση.
const sAfm = rowState(row({ consent: false, status: null, afmConfirmed: false, afmChangedAt: '2026-11-22T10:00:00Z' }));
ok('N1: αλλαγή ΑΦΜ μετά τη σύνδεση: προειδοποίηση με λύση από το myAADE', sAfm.tone === 'warn' && /myAADE/.test(sAfm.fix));
ok('N1: η επιβεβαίωση λέει «από το myAADE σου»', /myAADE/.test(rowState(row({ consent: false, status: null, afmConfirmed: false })).fix));
ok('N7: η ανάγνωση του κλειδιού έχει λέξεις', !!LOG_ACTION.key_read);
ok('M4: κάθε νέα ενέργεια του αρχείου έχει λέξεις', ['consent_paused', 'afm_confirmed', 'sync_done', 'page_rejected', 'invalid_quarantined', 'cancel_flagged'].every(a => !!LOG_ACTION[a]));
for (const e of ['forbidden', 'server', 'rate', 'no_afm', 'parse', 'unknown', 'network']) {
  const st = rowState(row({ status: e === 'forbidden' ? 'forbidden' : 'error', error: e }));
  ok(`κάθε σφάλμα έχει λύση (${e})`, st.fix.length > 0 && st.fix.endsWith('.'));
}

// ── 200 πελάτες: ταξινόμηση και αναζήτηση ─────────────────────────────────
const many: ClientRow[] = Array.from({ length: 200 }, (_, i) => row({
  ownerId: `o${i}`, name: i === 7 ? 'Παπαδόπουλος Γιώργος' : `Πελάτης ${String(i).padStart(3, '0')}`,
  status: i % 50 === 0 ? 'forbidden' : 'ok', consent: i % 9 !== 0,
}));
const sorted = sortRows(many, 'status');
ok('ταξινόμηση: τα προβλήματα πρώτα', rowState(sorted[0]).rank === 0);
ok('ταξινόμηση: χωρίς άδεια στο τέλος', rowState(sorted[sorted.length - 1]).label === 'Χωρίς άδεια');
ok('ταξινόμηση: δεν χάνει γραμμή', sorted.length === 200);
ok('αναζήτηση χωρίς τόνους', filterRows(many, 'παπαδοπουλος').length === 1);
ok('κενή αναζήτηση: όλοι', filterRows(many, '  ').length === 200);
ok('ταξινόμηση κατά όνομα', sortRows(many, 'name')[0].name <= sortRows(many, 'name')[1].name);
ok('προσοχή: μόνο όσοι θέλουν κάτι', attention(many) === many.filter(r => r.consent && r.status === 'forbidden').length);

// ── Όψεις της κάρτας ──────────────────────────────────────────────────────
const conn = (p: Partial<Connection>): Connection => ({
  status: 'active', last_sync_at: null, last_sync_new: 0, last_error_code: null,
  lease_id: null, lease_at: null, last_manual_at: null, joint_version: MYDATA_JOINT_VERSION, joint_at: '2026-11-24T08:00:00Z',
  last_partial: false, ...p,
});
const now = new Date('2026-11-23T10:00:00Z');
// Ε-1/Ε-2: χωρίς αποδοχή της τρέχουσας ρύθμισης, πρώτα η ρύθμιση.
ok('Ε-1: χωρίς σύνδεση: η ρύθμιση', cardPhase(null, now) === 'terms');
ok('Ε-2: παλιά έκδοση της ρύθμισης: ξανά η ρύθμιση', cardPhase(conn({ joint_version: '2026-01-01' }), now) === 'terms');
ok('Ε-1: με αποδοχή: έτοιμη', cardPhase(conn({}), now) === 'ready');
ok('Ε2: κλειδί που απορρίφθηκε στο τελευταίο τρέξιμο', cardPhase(conn({ last_error_code: 'auth' }), now) === 'rejected');
ok('συγχρονισμός σε εξέλιξη', cardPhase(conn({ lease_id: 'l', lease_at: '2026-11-23T09:58:00Z' }), now) === 'syncing');
ok('ξεχασμένη μίσθωση δεν δείχνει «σε εξέλιξη»', cardPhase(conn({ lease_id: 'l', lease_at: '2026-11-23T09:40:00Z' }), now) === 'ready');

const prog = [
  row({ lastSyncAt: '2026-11-23T09:59:00Z', lastNew: 100 }), row({ lastSyncAt: '2026-11-23T09:59:30Z', lastNew: 48 }),
  row({ lastSyncAt: '2026-11-22T01:00:00Z', lastNew: 5 }), row({ consent: false }), row({}),
];
ok('πρόοδος: «Πελάτης 3 από 4 · 148 παραστατικά»', progressLine('2026-11-23T09:58:00Z', prog) === 'Πελάτης 3 από 4 · 148 παραστατικά');

// ── Η ΑΑΔΕ εκτός ─────────────────────────────────────────────────────────
const downRows = [
  row({ status: 'error', error: 'server', nextRetryAt: '2026-11-23T12:20:00Z' }),
  row({ status: 'error', error: 'rate', nextRetryAt: '2026-11-23T12:05:00Z' }), row({ consent: false, status: null }),
];
ok('όλοι χωρίς απάντηση: χωρίς υπόσχεση αυτόματης προσπάθειας', aadeDownLine(downRows) === 'Η ΑΑΔΕ δεν απαντά. Πάτα «Φέρε τώρα» σε λίγο.');
ok('κάποιοι εντάξει: όχι «εκτός»', aadeDownLine([...downRows, row({})]) === null);
ok('κανένας με άδεια: τίποτα', aadeDownLine([row({ consent: false, status: null })]) === null);

// ── Όριο 5 λεπτών, κλειδί, μηνύματα ───────────────────────────────────────
ok('«τώρα» πριν 2 λεπτά: 3 λεπτά αναμονή', manualWaitMinutes('2026-11-23T09:58:00Z', now) === 3);
ok('«τώρα» πριν 6 λεπτά: καμία αναμονή', manualWaitMinutes('2026-11-23T09:54:00Z', now) === 0);
ok('κλειδί: κενό', keyShape('  ') === 'empty');
ok('κλειδί: σύντομο', keyShape('abc123') === 'short');
ok('κλειδί: σύμβολα', keyShape('abcd-efgh-ijkl-mnop') === 'chars');
ok('κλειδί: σωστό', keyShape('abcdEFGH12345678') === 'ok');
for (const r of ['busy', 'too_soon', 'auth', 'no_key', 'mfa_required', 'disabled', 'joint_terms', 'bad_key_shape', 'bad_user', 'no_clients', 'no_actor', 'x']) {
  ok(`μήνυμα με λύση (${r})`, runReason(r).endsWith('.') && !/—/.test(runReason(r)));
}
ok('Ε-2: η ρύθμιση που άλλαξε λέγεται', /ρύθμιση/.test(runReason('joint_terms')));
// Ε2: καμία λέξη για νυχτερινή ή αυτόματη άντληση σε ό,τι λέει η οθόνη.
{
  const src = readFileSync('lib/mydata/status.ts', 'utf8');
  ok('Ε2: κανένα «απόψε», «κάθε νύχτα» ή «Νέα προσπάθεια στις»', !/απόψε|κάθε νύχτα|νυχτερ|Νέα προσπάθεια στις|συνεχίζει μόνος/.test(src));
}
ok('Ε2: η γραμμή του πελάτη χωρίς «απόψε»', /λογιστής σου/.test(clientSyncedLine(null)) && !/απόψε/.test(clientSyncedLine(null)));
ok('Ε2: η χρήση του κλειδιού και η αποδοχή έχουν λέξεις', !!LOG_ACTION.key_used && !!LOG_ACTION.joint_accepted);

// ── Α2: στο τηλέφωνο ομάδες ανά κατάσταση, η εξήγηση μία φορά ─────────────
{
  const base = (i: number, p: Partial<ClientRow>): ClientRow => ({
    ownerId: `o${i}`, name: `Πελάτης ${String.fromCharCode(0x391 + (i % 20))}${i}`, consent: true, status: 'ok', lastSyncAt: '2026-11-23T01:10:00Z',
    lastNew: 1, error: null, nextRetryAt: null, pending: 0, afmConfirmed: true, quarantined: 0, ...p,
  });
  const rows = [
    base(1, {}), base(2, { error: 'quarantine', status: 'error', quarantined: 1 }), base(3, { status: 'paused' }),
    base(4, { error: 'quarantine', status: 'error', quarantined: 2 }), base(5, {}), base(6, { error: 'quarantine', status: 'error', quarantined: 1 }),
    base(7, { consent: false, status: null }), base(8, { consent: false, status: null, afmConfirmed: false }),
  ];
  const g = groupRows(rows);
  const check = g.find(x => x.label === 'Θέλει έλεγχο');
  ok('Α2 ομάδες: «Θέλει έλεγχο» με τρεις', check?.rows.length === 3);
  ok('Α2 ομάδες: η εξήγηση μία φορά ανά ομάδα', check?.fix === rowState(rows[1]).fix && g.filter(x => x.label === 'Θέλει έλεγχο').length === 1);
  ok('Α2 ομάδες: «Σε παύση» μία', g.find(x => x.label === 'Σε παύση')?.rows.length === 1);
  ok('Α2 ομάδες: όσοι θέλουν κάτι πρώτα', g[0].tone === 'warn' && g[g.length - 1].tone !== 'warn');
  ok('Α2 ομάδες: «Εντάξει» χωρίς εξήγηση', g.find(x => x.label === 'Εντάξει')?.fix === '');
  ok('Α2 ομάδες: χωρίς άδεια με διαφορετική λύση σε χωριστή ομάδα', g.filter(x => x.label === 'Χωρίς άδεια').length === 2);
  ok('Α2 ομάδες: κάθε πελάτης ακριβώς μία φορά', g.reduce((s, x) => s + x.rows.length, 0) === rows.length);
  ok('Α2 ομάδες: αλφαβητικά μέσα στην ομάδα', check!.rows.map(r => r.name).join() === [...check!.rows].sort((a, b) => a.name.localeCompare(b.name, 'el')).map(r => r.name).join());
  ok('Α2 ομάδες: κενό, κενό', groupRows([]).length === 0);
}
ok('Α2 αρχείο: αυτόματη καταχώρηση με λέξεις', !!LOG_ACTION.auto_filed && !!LOG_ACTION.auto_undone && !!LOG_ACTION.not_property);

// ── Κ-9: ειδοποίηση πριν σβήσουν τα εκκρεμή ─────────────────────────────────
{
  const expiring = expiringSoon;
  const t0 = new Date('2026-11-24T10:00:00Z');
  const ago = (d: number) => new Date(t0.getTime() - d * 86_400_000).toISOString();
  // 90 ημέρες ζωή, ειδοποίηση τις τελευταίες 14: λήψη πριν 80 ημέρες μετρά, πριν 70 όχι.
  ok('Κ-9: μετρά όσα σβήνουν μέσα στις επόμενες ημέρες ειδοποίησης', expiring?.([ago(80), ago(70), ago(89.9), ago(10)], t0) === 2);
  ok('Κ-9: τίποτα κοντά: μηδέν', expiring?.([ago(1)], t0) === 0);
  // ── Ε-9: εξαγωγή του αρχείου πρόσβασης για το γραφείο ───────────────────────
  const csv = accessLogCsv;
  const out = csv?.([{ at: '2026-11-23T01:10:00Z', action: 'sync_fetch', afm: '099000013', n: 7 }, { at: '2026-11-23T01:11:00Z', action: '=cmd', afm: null, n: null }]) ?? '';
  const lines = out.split('\r\n');
  ok('Ε-9: επικεφαλίδα στα ελληνικά', lines[0] === 'Ημερομηνία;Ενέργεια;ΑΦΜ πελάτη;Πλήθος');
  ok('Ε-9: ώρα Αθήνας, λέξεις της ενέργειας', lines[1] === '23/11/2026 03:10;Ο λογιστής έφερε παραστατικά;099000013;7');
  ok('Ε-9: ασφαλές απέναντι σε τύπους λογιστικού φύλλου', !lines[2]?.includes(';=cmd'));
}

console.log(`mydata status: ${pass} ✓ · ${fail} ✗`);
if (fail) process.exit(1);
