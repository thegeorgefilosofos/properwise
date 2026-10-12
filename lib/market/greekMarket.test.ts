// Έλεγχοι για τα ΜΕΤΡΗΜΕΝΑ μεγέθη του lib/market/greekMarket.ts.
// Τρέξε: npx tsx lib/market/greekMarket.test.ts
//
// Ο λόγος ύπαρξης: η προεπιλεγμένη ετήσια ανατίμηση στις Αποδόσεις δεν είναι πια
// σταθερά «3%» χωρίς πηγή, αλλά προκύπτει από τον δείκτη τιμών κατοικιών της
// Τράπεζας της Ελλάδος. Αν κάποιος αλλάξει τον δείκτη, ο έλεγχος πρέπει να δείξει
// ότι άλλαξε και η προεπιλογή — και όχι να το μάθει ο χρήστης στην οθόνη.
import { HISTORY_INDEX, HISTORY_ANCHORS, historyPriceCagr, BENCHMARKS, REGIONS, YIELD_LEVERS, type YieldLever } from './greekMarket';
import { FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT } from '../billing/greekTax';
import { PRESUMPTIVE_DEDUCTION_RATE, presumptiveDeductionRateForYear } from '../billing/presumptive';
import { ENFIA_REDUCTIONS } from '../billing/enfia';
import { fe, fpRate, grDateOf } from '../core/format';

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

// ═══ Η ΕΚΠΤΩΣΗ ΕΝΦΙΑ ΜΕ ΑΣΦΑΛΙΣΗ ΛΕΕΙ ΤΑ ΝΟΥΜΕΡΑ ΤΟΥ ΠΙΝΑΚΑ ΤΟΥ ΕΝΦΙΑ ════════
// ΤΑ ΕΓΡΑΦΕ ΜΕ ΤΟ ΧΕΡΙ (12/10/2026): «20% λιγότερος ΕΝΦΙΑ», «έως 500.000,00€»,
// «η μείωση είναι 10%», δίπλα στο ENFIA_REDUCTIONS που υπολογίζει τη μείωση.
// Και έστελνε την αίτηση «στο myAADE», ενώ γίνεται στο myPROPERTY (Α.1005/2026·
// Συχνές ερωτήσεις ΑΑΔΕ 14/01/2026,
// https://www.aade.gr/sites/default/files/2026-01/FAQs_asfalismenwn_katoik2026.pdf).
// Το `leverDrift` λέει τι διαφωνεί· ελέγχεται και ο ίδιος, με το παλιό κείμενο
// και με σταθερά που άλλαξε, ώστε να μην περνά πράσινος χωρίς να βλέπει.
{
  type Reduction = (typeof ENFIA_REDUCTIONS)[number];
  type Card = Pick<YieldLever, 'gain' | 'impact' | 'detail' | 'risk'>;
  const leverDrift = (l: Card | undefined, rd: Reduction | undefined): string[] => {
    if (!l) return ['λείπει ο μοχλός enfia_insurance'];
    if (!rd?.pctOver) return ['λείπει η μείωση insurance ή το κατώφλι της'];
    const pct = fpRate(rd.pct), over = fpRate(rd.pctOver.pct), above = fe(rd.pctOver.above);
    const text = [l.gain, l.impact, l.detail, l.risk].join(' ');
    const out: string[] = [];
    // «έως»: για λιγότερο από ολόκληρο το έτος η μείωση δίνεται αναλογικά.
    if (l.gain !== `έως ${pct} λιγότερος ΕΝΦΙΑ`) out.push(`gain «${l.gain}», η σταθερά λέει έως ${pct}`);
    if (!l.impact.includes(above)) out.push(`το κατώφλι ${above} λείπει από το impact`);
    if (!l.impact.includes(over)) out.push(`το ${over} πάνω από το κατώφλι λείπει από το impact`);
    const pcts = text.match(/\d+(,\d+)?%/g) ?? [];
    const stray = pcts.filter(x => x !== pct && x !== over);
    if (stray.length) out.push(`ποσοστά που δεν βγαίνουν από τη σταθερά: ${stray.join(', ')}`);
    const amounts = text.match(/\d{1,3}(?:\.\d{3})*(?:,\d+)?€/g) ?? [];
    const strayAmt = amounts.filter(x => x !== above);
    if (strayAmt.length) out.push(`ποσά που δεν βγαίνουν από τη σταθερά: ${strayAmt.join(', ')}`);
    if (!text.includes('myPROPERTY')) out.push('η αίτηση δεν λέει myPROPERTY');
    if (!/σεισμ/u.test(l.detail) || !/πυρκαγι/u.test(l.detail) || !/πλημμ[υύ]ρ/u.test(l.detail)) out.push('το detail δεν λέει και τους τρεις κινδύνους');
    // Μετρά η ασφάλιση του προηγούμενου έτους, αναλογικά κάτω από ολόκληρο το
    // έτος (ίδια πηγή· και ο οδηγός app/odigos/pos-ypologizetai-o-enfia).
    if (!/προηγούμεν/u.test(l.detail)) out.push('το detail δεν λέει ότι μετρά το προηγούμενο έτος');
    if (!/αναλογικ/u.test(l.detail)) out.push('το detail δεν λέει ότι κάτω από ολόκληρο το έτος η μείωση είναι αναλογική');
    // Όχι διαδρομή μενού με «·»: δεν υπάρχει εγγραφή στο AADE_DESTINATIONS.
    if (/myAADE\s*·/u.test(text)) out.push('διαδρομή μενού «myAADE · …» χωρίς εγγραφή στο AADE_DESTINATIONS');
    return out;
  };

  const lever = YIELD_LEVERS.find(l => l.key === 'enfia_insurance');
  const rd = ENFIA_REDUCTIONS.find(r => r.key === 'insurance');
  const drift = leverDrift(lever, rd);
  ok(`η κάρτα της ασφάλισης συμφωνεί με το ENFIA_REDUCTIONS: ${drift.join(' | ')}`, drift.length === 0);

  // Ο έλεγχος βλέπει: το κείμενο ως τις 12/10/2026 δεν περνά.
  const OLD: Card = {
    gain: '20% λιγότερος ΕΝΦΙΑ',
    impact: 'Για ακίνητα αξίας έως 500.000,00€· για μεγαλύτερη αξία η μείωση είναι 10%. Χρειάζεται ένα φθηνό ασφαλιστήριο τριών κινδύνων.',
    detail: 'Χρειάζεται κάλυψη σεισμού, πυρκαγιάς και πλημμύρας για τουλάχιστον τρεις μήνες, στην πλήρη αξία, από εγγεγραμμένο ασφαλιστή. Η αίτηση γίνεται στο myAADE, με προθεσμία γύρω στα μέσα Φεβρουαρίου.',
    risk: 'Απαιτεί πλήρη κάλυψη και των τριών κινδύνων και εμπρόθεσμη δήλωση. Αλλιώς η μείωση χάνεται για ολόκληρη τη χρονιά.',
  };
  {
    const oldDrift = leverDrift(OLD, rd);
    ok('το παλιό κείμενο δεν περνά (myAADE χωρίς myPROPERTY)', oldDrift.includes('η αίτηση δεν λέει myPROPERTY'));
    ok('το παλιό κείμενο δεν περνά (χωρίς προηγούμενο έτος)', oldDrift.some(x => x.includes('προηγούμενο έτος')));
    ok('το παλιό κείμενο δεν περνά (χωρίς αναλογική μείωση)', oldDrift.some(x => x.includes('αναλογική')));
    ok('το παλιό κείμενο δεν περνά (gain χωρίς «έως»)', oldDrift.some(x => x.startsWith('gain ')));
  }
  // Ο έλεγχος βλέπει: ένα πρόχειρο που απορρίφθηκε πριν μπει στον κώδικα
  // (12/10/2026), με «μέσα στο έτος» και «myAADE · myPROPERTY». Δεν κυκλοφόρησε
  // ποτέ· μένει ως παράδειγμα δύο λαθών που ο έλεγχος πρέπει να πιάνει.
  if (lever) {
    const REJECTED: Card = { ...lever,
      detail: 'Χρειάζεται κάλυψη σεισμού, πυρκαγιάς και πλημμύρας για τουλάχιστον τρεις μήνες μέσα στο έτος, με κεφάλαιο τουλάχιστον όσο η αξία ανακατασκευής, από ασφαλιστική εγγεγραμμένη στο μητρώο της Τράπεζας της Ελλάδος. Η αίτηση γίνεται στο myAADE · myPROPERTY, με προθεσμία γύρω στα μέσα Φεβρουαρίου.' };
    const d = leverDrift(REJECTED, rd);
    ok('το απορριφθέν πρόχειρο δεν περνά (μέσα στο έτος, χωρίς αναλογικά)', d.some(x => x.includes('προηγούμενο έτος')) && d.some(x => x.includes('αναλογική')));
    ok('το απορριφθέν πρόχειρο δεν περνά (διαδρομή μενού χωρίς πηγή)', d.some(x => x.includes('AADE_DESTINATIONS')));
  }
  // Ο έλεγχος βλέπει: αν άλλαζε ο νόμος και μόνο η σταθερά, κάθε κομμάτι κοκκινίζει.
  if (rd?.pctOver) {
    ok('νέο ποσοστό στη σταθερά, παλιό στο κείμενο: κόκκινο',
      leverDrift(lever, { ...rd, pct: rd.pct + 5 }).length > 0);
    ok('νέο ποσοστό πάνω από το κατώφλι: κόκκινο',
      leverDrift(lever, { ...rd, pctOver: { ...rd.pctOver, pct: rd.pctOver.pct + 5 } }).length > 0);
    ok('νέο κατώφλι: κόκκινο',
      leverDrift(lever, { ...rd, pctOver: { ...rd.pctOver, above: rd.pctOver.above + 100_000 } }).length > 0);
  }
}

console.log(fail === 0 ? `✓ greekMarket: ${pass} έλεγχοι πέρασαν` : `✗ greekMarket: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
