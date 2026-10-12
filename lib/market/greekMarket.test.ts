// Έλεγχοι για τα ΜΕΤΡΗΜΕΝΑ μεγέθη του lib/market/greekMarket.ts.
// Τρέξε: npx tsx lib/market/greekMarket.test.ts
//
// Ο λόγος ύπαρξης: η προεπιλεγμένη ετήσια ανατίμηση στις Αποδόσεις δεν είναι πια
// σταθερά «3%» χωρίς πηγή, αλλά προκύπτει από τον δείκτη τιμών κατοικιών της
// Τράπεζας της Ελλάδος. Αν κάποιος αλλάξει τον δείκτη, ο έλεγχος πρέπει να δείξει
// ότι άλλαξε και η προεπιλογή — και όχι να το μάθει ο χρήστης στην οθόνη.
import { HISTORY_INDEX, HISTORY_ANCHORS, historyPriceCagr, BENCHMARKS, REGIONS, YIELD_LEVERS } from './greekMarket';
import { FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT } from '../billing/greekTax';
import { PRESUMPTIVE_DEDUCTION_RATE, presumptiveDeductionRateForYear } from '../billing/presumptive';
import { fpRate, grDateOf } from '../core/format';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean) { if (cond) { pass++; } else { fail++; console.error(`✗ ${name}`); } }
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}

const last = HISTORY_INDEX[HISTORY_INDEX.length - 1];
const first = HISTORY_INDEX[0];

// ═══ Ο ΔΕΙΚΤΗΣ ΕΙΝΑΙ ΣΥΝΕΠΗΣ ═══════════════════════════════════════════════
ok('ο δείκτης είναι χρονολογικά αύξων', HISTORY_INDEX.every((p, i) => i === 0 || p.year === HISTORY_INDEX[i - 1].year + 1));
ok('όλες οι τιμές είναι θετικές', HISTORY_INDEX.every(p => p.price > 0 && p.rent > 0));
ok('η κορυφή-άγκυρα υπάρχει στον δείκτη', HISTORY_INDEX.some(p => p.year === HISTORY_ANCHORS.peakYear));
ok('ο πυθμένας-άγκυρα υπάρχει στον δείκτη', HISTORY_INDEX.some(p => p.year === HISTORY_ANCHORS.troughYear));
{
  const trough = HISTORY_INDEX.find(p => p.year === HISTORY_ANCHORS.troughYear)!;
  ok('ο πυθμένας είναι πράγματι το χαμηλότερο σημείο', HISTORY_INDEX.every(p => p.price >= trough.price));
}

// ═══ CAGR: ΜΕΤΡΗΜΕΝΗ, ΟΧΙ ΕΠΙΝΟΗΜΕΝΗ ══════════════════════════════════════
{
  const c10 = historyPriceCagr(10);
  eq('10ετία: εύρος ετών', [c10.fromYear, c10.toYear, c10.years], [last.year - 10, last.year, 10]);
  ok('10ετία: ισχυρή ανάκαμψη (>5%)', c10.pct > 5);
  // Επαλήθευση με ανεξάρτητο υπολογισμό από τον ίδιο δείκτη.
  const from10 = HISTORY_INDEX.find(p => p.year === last.year - 10)!;
  const expect10 = Math.round(((Math.pow(last.price / from10.price, 1 / 10) - 1) * 100) * 10) / 10;
  eq('10ετία: συμφωνεί με τον απευθείας υπολογισμό', c10.pct, expect10);

  // Ζητάμε 20 έτη αλλά ο δείκτης ξεκινά το 2007: παίρνουμε ό,τι υπάρχει, με
  // ΕΙΛΙΚΡΙΝΗ αναφορά του πραγματικού εύρους (ώστε η οθόνη να μη λέει «20ετία»).
  const c20 = historyPriceCagr(20);
  eq('πάνω από τα διαθέσιμα έτη → η αρχή του δείκτη', c20.fromYear, first.year);
  eq('πάνω από τα διαθέσιμα έτη → πραγματικό εύρος', c20.years, last.year - first.year);
  ok('η μακρά περίοδος περιλαμβάνει την κρίση, άρα είναι σχεδόν επίπεδη', c20.pct < 2);
  ok('οι δύο ορίζοντες δίνουν ΔΙΑΦΟΡΕΤΙΚΟ αριθμό', c10.pct !== c20.pct);

  // Καμία από τις δύο δεν είναι η παλιά επινοημένη σταθερά «3».
  ok('η προεπιλογή δεν είναι πια η σταθερά 3', c10.pct !== 3 && c20.pct !== 3);

  eq('ένα έτος → η τελευταία ετήσια μεταβολή',
    historyPriceCagr(1).pct,
    Math.round(((last.price / HISTORY_INDEX[HISTORY_INDEX.length - 2].price - 1) * 100) * 10) / 10);
  ok('μηδέν/αρνητικό όρισμα δεν σκάει', Number.isFinite(historyPriceCagr(0).pct) && Number.isFinite(historyPriceCagr(-5).pct));
}

// ═══ ΚΑΘΕ ΕΝΑΛΛΑΚΤΙΚΗ ΕΧΕΙ ΠΗΓΗ/ΣΗΜΕΙΩΣΗ (ο κανόνας που έσπασε η «ανατίμηση 3%») ══
ok('όλες οι εναλλακτικές έχουν note', BENCHMARKS.every(b => b.note.trim().length > 20));
ok('όλες οι εναλλακτικές έχουν και 10ετία και 20ετία', BENCHMARKS.every(b => Number.isFinite(b.ret10) && Number.isFinite(b.ret20)));

// ═══ ΟΙ ΠΕΡΙΟΧΕΣ ΕΧΟΥΝ ΤΕΚΜΗΡΙΩΜΕΝΗ ΑΠΟΔΟΣΗ (fallback του «ενοίκιο = 4% της αξίας») ══
// Το πραγματικό εύρος σήμερα είναι 2,9% (Μύκονος) έως 7,0%. Τα όρια είναι φαρδιά
// επίτηδες: ελέγχουν ότι κανένα κλειδί δεν έμεινε άδειο ή με προφανώς λάθος τιμή.
ok('κάθε περιοχή έχει μεικτή απόδοση σε λογικό εύρος', REGIONS.every(r => r.grossYield >= 2.5 && r.grossYield <= 8));
ok('κάθε περιοχή έχει note', REGIONS.every(r => r.note.trim().length > 10));
ok('τα κλειδιά περιοχών είναι μοναδικά', new Set(REGIONS.map(r => r.key)).size === REGIONS.length);

// ═══ Ο ΜΟΧΛΟΣ ΤΗΣ ΤΡΑΠΕΖΑΣ ΛΕΕΙ ΤΗΝ ΗΜΕΡΟΜΗΝΙΑ ΤΗΣ ΜΗΧΑΝΗΣ ═════════════════
// Έγραφε «Από την 1η Απριλίου 2026 … με μετρητά η έκπτωση του 5% χάνεται» και
// «Αυξάνει αμέσως την καθαρή απόδοση», ενώ η μηχανή δίνει την έκπτωση στα
// μετρητά ως την έναρξη της κύρωσης. Κάθε ημερομηνία και κάθε ποσοστό της
// κάρτας πρέπει να είναι αυτά που υπολογίζουν τον φόρο.
{
  const bank = YIELD_LEVERS.find(l => l.key === 'bank_rent');
  ok('υπάρχει ο μοχλός της τράπεζας', !!bank);
  const from = grDateOf(FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT);
  const deduction = fpRate(PRESUMPTIVE_DEDUCTION_RATE * 100);
  const kept = fpRate((1 - PRESUMPTIVE_DEDUCTION_RATE) * 100);
  const text = bank ? [bank.gain, bank.impact, bank.detail, bank.risk].join(' ') : '';
  ok(`η κάρτα λέει από πότε μετράει η τράπεζα (${from})`, !!bank && bank.impact.includes(from) && bank.detail.includes(from));
  const dates = text.match(/\d{2}\/\d{2}\/\d{4}/g) ?? [];
  ok(`καμία άλλη ημερομηνία από την έναρξη της κύρωσης: ${dates.join(', ')}`, dates.length > 0 && dates.every(d => d === from));
  ok('καμία ημερομηνία γραμμένη ολογράφως («1η Απριλίου 2026»)', !/\d+η\s+\p{L}+\s+\d{4}/u.test(text));
  ok('η απόφαση της ΑΑΔΕ που ορίζει την έναρξη', !!bank && bank.detail.includes('Α.1187/2026'));
  ok(`το μέγεθος: φόρος στο ${kept}`, bank?.gain === `φόρος στο ${kept}`);
  ok(`η έκπτωση ${deduction} στην πρόταση`, !!bank && bank.impact.includes(deduction));
  const pcts = text.match(/\d+(,\d+)?%/g) ?? [];
  ok(`κάθε ποσοστό της κάρτας από τη σταθερά: ${pcts.join(', ')}`, pcts.every(x => x === deduction || x === kept));
  // Η μηχανή: πριν από την έναρξη η έκπτωση δίνεται και με μετρητά. Η κάρτα δεν
  // λέει πια ότι η τράπεζα ανεβάζει «αμέσως» την απόδοση.
  ok('η μηχανή δίνει την έκπτωση στα μετρητά πριν από την έναρξη',
    presumptiveDeductionRateForYear(FIRST_YEAR_BANK_RECEIPT - 1, false) === PRESUMPTIVE_DEDUCTION_RATE);
  ok('η κάρτα δεν υπόσχεται άμεση άνοδο της απόδοσης', !/αμέσως/.test(text));
}

console.log(fail === 0 ? `✓ greekMarket: ${pass} έλεγχοι πέρασαν` : `✗ greekMarket: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
