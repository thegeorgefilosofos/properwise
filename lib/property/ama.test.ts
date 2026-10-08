// Δοκιμές συμμόρφωσης ΑΜΑ. Τρέξε: npx tsx lib/property/ama.test.ts
import {
  amaState, amaRequired, amaNeedsAttention, amaSummary, isValidAmaFormat,
  amaLengthLooksUnusual, cleanAma, AMA_COPY, strBusinessNotice,
} from './ama';
import { STR_INDIVIDUAL_MAX_PROPERTIES, STR_BUSINESS_RULE_FROM_YEAR, isMunicipalTaxExempt } from '@/lib/billing/greekTax';
import { fn } from '@/lib/core/format';
import { writeStatus, STATUSES } from './status';

let passed = 0, failed = 0; const fails: string[] = [];
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; fails.push(name); } };

const AMA = '12345678901';

// ═══ Ο ΕΛΕΓΧΟΣ ΟΔΗΓΕΙΤΑΙ ΑΠΟ ΤΟ readStatus, ΟΧΙ ΑΠΟ ΔΙΑΚΟΠΤΗ ═══════════════
// Ήταν το δομικό λάθος: ο ΑΜΑ κρυβόταν πίσω από τρίτο ανεξάρτητο διακόπτη
// «Βραχυχρόνια μίσθωση» στο OccupancyPanel, ενώ το readStatus ήδη ήξερε.
// Εδώ ελέγχεται ότι ΚΑΘΕ τρόπος με τον οποίο η βάση λέει «βραχυχρόνια»
// πυροδοτεί τον έλεγχο και ότι κανένα πεδίο-διακόπτης δεν συμμετέχει.
ok('rental_mode short_term → ζητείται ΑΜΑ', amaState({ rental_mode: 'short_term' }) === 'missing');
ok('status_detail seasonal (παλιά δεδομένα) → ζητείται ΑΜΑ', amaState({ status_detail: 'seasonal' }) === 'missing');
ok('writeStatus(rent_short) → ζητείται ΑΜΑ', amaState(writeStatus('rent_short')) === 'missing');
ok('μακροχρόνια → ΔΕΝ ζητείται', amaState(writeStatus('rent_long')) === 'not_required');
ok('κενό → ΔΕΝ ζητείται', amaState(writeStatus('vacant')) === 'not_required');
ok('ιδιοχρησία → ΔΕΝ ζητείται', amaState(writeStatus('own_use')) === 'not_required');
ok('null row → ΔΕΝ ζητείται', amaState(null) === 'not_required' && amaState(undefined) === 'not_required');
ok('καμία άλλη κατάσταση δεν ζητά ΑΜΑ', STATUSES
  .filter(s => s.key !== 'rent_short')
  .every(s => amaState({ ...writeStatus(s.key), ama: null }) === 'not_required'));
// Κανένας «διακόπτης»: ένα πεδίο shortTerm στη γραμμή δεν αλλάζει τίποτα.
ok('πλασματικός διακόπτης shortTerm δεν ενεργοποιεί τίποτα',
  amaState({ status_detail: 'rented', rental_mode: 'long_term', ...({ shortTerm: true } as object) }) === 'not_required');
ok('πλασματικός διακόπτης shortTerm=false δεν απενεργοποιεί τίποτα',
  amaState({ rental_mode: 'short_term', ...({ shortTerm: false } as object) }) === 'missing');

// ═══ ΟΙ ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ ═══════════════════════════════════════════════════
const short = writeStatus('rent_short');
ok('(α) δεν δηλώθηκε', amaState({ ...short }) === 'missing');
ok('(β) δηλώθηκε αλλά δεν επιβεβαιώθηκε στην αγγελία', amaState({ ...short, ama: AMA }) === 'unconfirmed');
ok('(γ) εντάξει', amaState({ ...short, ama: AMA, ama_listed_confirmed_at: '2026-07-01T10:00:00Z' }) === 'ok');
ok('κενό string επιβεβαίωσης δεν μετράει', amaState({ ...short, ama: AMA, ama_listed_confirmed_at: '   ' }) === 'unconfirmed');
ok('άκυρη μορφή ΑΜΑ = σαν να λείπει', amaState({ ...short, ama: 'ΑΜΑ-1234' }) === 'missing');
ok('η επιβεβαίωση χωρίς ΑΜΑ δεν σώζει τίποτα', amaState({ ...short, ama: '', ama_listed_confirmed_at: '2026-07-01' }) === 'missing');

ok('amaRequired μόνο στη βραχυχρόνια', amaRequired(short) && !amaRequired(writeStatus('rent_long')));
ok('amaNeedsAttention: missing & unconfirmed', amaNeedsAttention({ ...short }) && amaNeedsAttention({ ...short, ama: AMA }));
ok('amaNeedsAttention: όχι στο ok', !amaNeedsAttention({ ...short, ama: AMA, ama_listed_confirmed_at: 'x' }));
ok('amaNeedsAttention: όχι σε μη βραχυχρόνια', !amaNeedsAttention(writeStatus('vacant')));

// ═══ ΜΟΡΦΗ ═════════════════════════════════════════════════════════════════
ok('μόνο ψηφία είναι έγκυρα', isValidAmaFormat('123') && !isValidAmaFormat('12a3') && !isValidAmaFormat('') && !isValidAmaFormat(null));
ok('κενά γύρω γύρω αγνοούνται', isValidAmaFormat('  12345678901  '));
ok('cleanAma κρατά μόνο ψηφία', cleanAma(' 123-456 789 ') === '123456789');
ok('ασυνήθιστο μήκος προειδοποιεί, δεν απορρίπτει', amaLengthLooksUnusual('123') && isValidAmaFormat('123'));
ok('τυπικό μήκος δεν προειδοποιεί', !amaLengthLooksUnusual(AMA));
ok('άκυρη μορφή δεν δίνει προειδοποίηση μήκους (δίνει άκυρο)', !amaLengthLooksUnusual('abc'));

// ═══ ΣΥΝΟΨΗ ΧΑΡΤΟΦΥΛΑΚΙΟΥ ══════════════════════════════════════════════════
const portfolio = [
  { id: 'a', ...writeStatus('rent_short') },                                                        // missing
  { id: 'b', ...writeStatus('rent_short'), ama: AMA },                                              // unconfirmed
  { id: 'c', ...writeStatus('rent_short'), ama: AMA, ama_listed_confirmed_at: '2026-07-01' },        // ok
  { id: 'd', ...writeStatus('rent_long') },                                                          // not_required
];
const sum = amaSummary(portfolio);
ok('σύνοψη: 1 missing / 1 unconfirmed / 1 ok', sum.missing.length === 1 && sum.unconfirmed.length === 1 && sum.ok.length === 1);
ok('σύνοψη: 3 ακίνητα βραχυχρόνιας', sum.shortTermCount === 3);
ok('σύνοψη: χειρότερη κατάσταση = missing', sum.worst === 'missing');
ok('σύνοψη: χωρίς missing → unconfirmed', amaSummary(portfolio.filter(p => p.id !== 'a')).worst === 'unconfirmed');
ok('σύνοψη: όλα εντάξει → ok', amaSummary([portfolio[2]]).worst === 'ok');
ok('σύνοψη: καμία βραχυχρόνια → not_required', amaSummary([portfolio[3]]).worst === 'not_required');
ok('σύνοψη: κενό χαρτοφυλάκιο', (() => { const s = amaSummary([]); return s.worst === 'not_required' && s.shortTermCount === 0; })());

// ═══ ΚΕΙΜΕΝΟ ═══════════════════════════════════════════════════════════════
ok('κείμενο για τις τρεις καταστάσεις', (['missing', 'unconfirmed', 'ok'] as const).every(k => AMA_COPY[k].title.length > 5 && AMA_COPY[k].body.length > 20));
ok('το missing αναφέρει το πραγματικό μέγεθος (12.145)', AMA_COPY.missing.body.includes('12.145'));
ok('το unconfirmed μιλά για την ΑΓΓΕΛΙΑ', AMA_COPY.unconfirmed.body.includes('καταχώρηση') || AMA_COPY.unconfirmed.body.includes('αγγελία'));
ok('τόνοι σημασιολογικοί', AMA_COPY.missing.tone === 'negative' && AMA_COPY.unconfirmed.tone === 'warning' && AMA_COPY.ok.tone === 'positive');

// ═══ ΠΟΛΛΑ ΒΡΑΧΥΧΡΟΝΙΑ ΣΤΟ ΙΔΙΟ ΑΦΜ: ΧΡΕΙΑΖΕΤΑΙ ΕΝΑΡΞΗ ═══════════════════════
const STR = (n: number, o: Partial<{ individual: boolean; filesAsBusiness: boolean; year: number }> = {}) =>
  strBusinessNotice({ shortTermCount: n, individual: true, filesAsBusiness: false, year: 2026, ...o });
ok('έναρξη: 2 βραχυχρόνια → καμία ειδοποίηση', STR(2) === null);
ok('έναρξη: 3 βραχυχρόνια → ειδοποίηση', STR(3) !== null);
ok('έναρξη: νομικό πρόσωπο → καμία', STR(5, { individual: false }) === null);
ok('έναρξη: δηλωμένη επιχείρηση → καμία', STR(5, { filesAsBusiness: true }) === null);
ok('έναρξη: έτος πριν από τον κανόνα → καμία', STR(5, { year: STR_BUSINESS_RULE_FROM_YEAR - 1 }) === null);
ok('έναρξη: πρώτο έτος του κανόνα → ειδοποίηση', STR(5, { year: STR_BUSINESS_RULE_FROM_YEAR }) !== null);
ok('έναρξη: όριο δεμένο στη σταθερά', STR(STR_INDIVIDUAL_MAX_PROPERTIES + 1) !== null && STR(STR_INDIVIDUAL_MAX_PROPERTIES) === null);
// Ένας κανόνας, δύο χρήσεις: ειδοποίηση και εξαίρεση από το τέλος δεν χωρίζουν.
ok('έναρξη: ίδιο όριο με την εξαίρεση του τέλους παρεπιδημούντων',
  [1, 2, 3, 4, 5, 6].every(n => (STR(n) !== null) === !isMunicipalTaxExempt({ propertyCount: n, individual: true })));
for (const n of [3, 7]) {
  const c = STR(n)!;
  const txt = `${c.title} ${c.body}`;
  ok(`έναρξη ${n}: χωρίς κόμμα πριν από «και»`, !/,\s*και(?![\p{L}\p{N}])/u.test(txt));
  ok(`έναρξη ${n}: χωρίς «βοηθός»/«δωρεάν»/ποσοστό`, !/βοηθός|δωρεάν|%/.test(txt));
  ok(`έναρξη ${n}: χωρίς «από το πρώτο» ή «Ε.20»`, !txt.includes('από το πρώτο') && !txt.includes('Ε.20'));
  const digits = txt.match(/\d+(?:[./]\d+)*/g) || [];
  const allowed = new Set([fn(n), fn(STR_INDIVIDUAL_MAX_PROPERTIES), '39', '5073/2023']);
  ok(`έναρξη ${n}: κάθε ψηφίο από τον κώδικα`, digits.every(d => allowed.has(d)));
  ok(`έναρξη ${n}: ο αριθμός στον τίτλο`, c.title.includes(fn(n)));
}

console.log(`\nama — ${passed} passed, ${failed} failed (σύνολο ${passed + failed})`);
if (failed) { console.log('FAILED:\n' + fails.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
console.log('όλα πέρασαν');
