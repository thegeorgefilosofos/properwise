// npx tsx lib/facts/yield.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// ΜΙΑ ΚΑΘΑΡΗ ΑΠΟΔΟΣΗ ΠΡΟ ΦΟΡΟΥ, ΟΧΙ ΔΥΟ
// ─────────────────────────────────────────────────────────────────────────
// Το ίδιο βραχυχρόνιο ακίνητο έβγαζε «Καθαρή απόδοση προ φόρου» 3,01% στην
// Επισκόπηση και 1,70% στις Αποδόσεις. Η Επισκόπηση αφαιρούσε τις
// καταγεγραμμένες δαπάνες· οι Αποδόσεις πρόσθεταν από πάνω προμήθεια
// πλατφόρμας, καθαρισμό και τέλη του μοντέλου, ακόμη κι όταν ο χρήστης τα
// είχε ήδη καταγράψει ως δαπάνες. Εδώ ο κανόνας του `yieldCosts`:
//   · ό,τι καταγράφηκε μετρά μία φορά·
//   · εκτίμηση μπαίνει μόνο για είδος χωρίς καταγεγραμμένη γραμμή·
//   · με εκτίμηση μέσα, η ετικέτα είναι «Εκτιμώμενη καθαρή απόδοση προ φόρου».
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { propertyYield, yieldCosts, netPreTaxLabel, YIELD_LABELS, YIELD_SHORT_LABELS, YIELD_INLINE_LABELS, expenseParts, expensePartsShort } from './index';
import { fe, fp } from '@/lib/core/format';
import { computeYields } from '@/lib/billing/propertyFacts';
import { yields } from '@/lib/market/returns';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, got?: unknown) => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${got !== undefined ? ` (got ${JSON.stringify(got)})` : ''}`); }
};
const r2 = (n: number) => Math.round(n * 100) / 100;

// Αξία 200.000€, ετήσια έσοδα 10.000€, καταγεγραμμένες δαπάνες 3.980€ →
// καθαρή (10.000 − 3.980) / 200.000 = 3,01%. Το μοντέλο της βραχυχρόνιας
// εκτιμά προμήθεια 1.500€, καθαρισμό 800€, τέλος ανθεκτικότητας 320€: με
// αυτά από πάνω, (10.000 − 3.980 − 2.620) / 200.000 = 1,70%.
const VALUE = 200000, INCOME = 10000, RECORDED = 3980;
const MODEL = { platform_fee: 1500, cleaning: 800, climate_levy: 320 };

// ── Η Επισκόπηση: μόνο καταγραφές ────────────────────────────────────────
const overview = computeYields(INCOME / 12, VALUE, RECORDED);
ok('Επισκόπηση: καθαρή 3,01%', r2(overview.netYield) === 3.01, overview.netYield);

// ── Χωρίς εκτιμήσεις, η ίδια βάση και η ίδια ετικέτα ─────────────────────
{
  const c = yieldCosts({ recorded: RECORDED });
  ok('χωρίς μοντέλο: σύνολο = καταγραφές', c.total === RECORDED, c.total);
  ok('χωρίς μοντέλο: βάση «recorded»', c.basis === 'recorded');
  ok('χωρίς μοντέλο: ετικέτα ίδια με την Επισκόπηση', netPreTaxLabel(c) === YIELD_LABELS.net_pre_tax);
}

// ── Όλα τα κόστη του μοντέλου ήδη καταγεγραμμένα: ΙΔΙΟΣ αριθμός ─────────────
{
  // Οι κατηγορίες όπως γράφονται στη βάση· η τρίτη δεν έχει δική της κατηγορία
  // δαπάνης, οπότε το τέλος ανθεκτικότητας εδώ δεν δίνεται στο μοντέλο.
  const c = yieldCosts({
    recorded: RECORDED,
    recordedCategories: ['Προμήθεια Airbnb', 'Καθαριότητα', 'Ρεύμα', null],
    modelled: { platform_fee: MODEL.platform_fee, cleaning: MODEL.cleaning },
  });
  ok('καταγεγραμμένα: καμία εκτίμηση από πάνω', c.modelled === 0 && c.total === RECORDED, c);
  ok('καταγεγραμμένα: τα είδη αναφέρονται ως ήδη καταγεγραμμένα',
    c.recordedKinds.join() === 'platform_fee,cleaning', c.recordedKinds);
  const roi = yields(INCOME / 12, VALUE, c.total, 0);
  ok('Αποδόσεις = Επισκόπηση όταν τα κόστη έχουν καταγραφεί (3,01%)', roi.netYield === r2(overview.netYield), roi.netYield);
  ok('ίδια ετικέτα και στις δύο οθόνες', netPreTaxLabel(c) === YIELD_LABELS.net_pre_tax);
}

// ── Το παλιό λάθος: εκτίμηση πάνω σε καταγραφή = διπλή δαπάνη ─────────────
{
  const old = yields(INCOME / 12, VALUE, RECORDED + MODEL.platform_fee + MODEL.cleaning + MODEL.climate_levy, 0);
  ok('η παλιά πρόσθεση έβγαζε 1,70%', old.netYield === 1.7, old.netYield);
  const c = yieldCosts({
    recorded: RECORDED, recordedCategories: ['platform_fee', 'cleaning'], modelled: MODEL,
  });
  // Μένει μόνο το τέλος ανθεκτικότητας, που δεν έχει κατηγορία δαπάνης.
  ok('μόνο ό,τι λείπει μπαίνει ως εκτίμηση', c.modelled === MODEL.climate_levy && c.modelledKinds.join() === 'climate_levy', c);
  const now = yields(INCOME / 12, VALUE, c.total, 0);
  ok('καθαρή με μόνο το τέλος που λείπει = 2,85%', now.netYield === 2.85, now.netYield);
  ok('με εκτίμηση μέσα, η ετικέτα το λέει', netPreTaxLabel(c) === YIELD_LABELS.net_pre_tax_estimated);
  ok('και στο στενό πλακίδιο', netPreTaxLabel(c, true) === YIELD_SHORT_LABELS.net_pre_tax_estimated);
}

// ── Τίποτα καταγεγραμμένο: η εκτίμηση μπαίνει όλη, με άλλο όνομα ───────────
{
  const c = yieldCosts({ recorded: RECORDED, modelled: MODEL });
  ok('χωρίς καταγραφές: όλη η εκτίμηση', c.modelled === 2620 && c.total === 6600, c);
  const y = propertyYield({ annualIncome: INCOME, value: VALUE, annualExpenses: c.total });
  ok('εκτιμώμενη καθαρή 1,70%', r2(y.net_pre_tax) === 1.7, y.net_pre_tax);
  ok('ετικέτα διαφορετική από της Επισκόπησης', netPreTaxLabel(c) !== YIELD_LABELS.net_pre_tax);
  ok('η ετικέτα λέει «προ φόρου»', YIELD_LABELS.net_pre_tax_estimated.includes('προ φόρου'));
}

// ── Αρνητικά και άκυρα ποσά δεν αλλάζουν τίποτα ──────────────────────────
{
  const c = yieldCosts({ recorded: RECORDED, modelled: { platform_fee: -50, cleaning: NaN } });
  ok('αρνητικό ή NaN μοντέλο αγνοείται', c.total === RECORDED && c.basis === 'recorded', c);
}

// ── Η οθόνη των Αποδόσεων περνά από τον κανόνα ───────────────────────────
{
  const src = readFileSync('app/dashboard/components/TabRentROI.tsx', 'utf8');
  ok('οι Αποδόσεις καλούν το yieldCosts', /yieldCosts\(\{/.test(src));
  ok('η ετικέτα της καθαρής βγαίνει από το netPreTaxLabel', /netPreTaxLabel\(costs, true\)/.test(src));
  ok('καμία τυφλή πρόσθεση μοντέλου πάνω στα έξοδα', !/nOpex \+ stCosts/.test(src));
}

// ── Η γραμμή της Επισκόπησης: «Απόδοση: μεικτή 4,03% · καθαρή προ φόρου 3,01%» ─
{
  ok('οι λέξεις της γραμμής', YIELD_INLINE_LABELS.title === 'Απόδοση' && YIELD_INLINE_LABELS.gross === 'μεικτή'
    && YIELD_INLINE_LABELS.net_pre_tax === 'καθαρή προ φόρου');
  const line = `${YIELD_INLINE_LABELS.title}: ${YIELD_INLINE_LABELS.gross} ${fp(4.03)} · ${YIELD_INLINE_LABELS.net_pre_tax} ${fp(3.01)}`;
  ok('η γραμμή γράφεται όπως ζητήθηκε', line === 'Απόδοση: μεικτή 4,03% · καθαρή προ φόρου 3,01%', line);
  const ov = readFileSync('app/dashboard/components/OverviewTab.tsx', 'utf8');
  ok('η Επισκόπηση δεν γράφει πια «Απόδοση.»', !/>Απόδοση\.<\/strong>/.test(ov));
  ok('η Επισκόπηση δεν κατεβάζει σε πεζά ολόκληρες ετικέτες', !/YIELD_LABELS\.(gross|net_pre_tax)\.toLowerCase\(\)/.test(ov));
  ok('η Επισκόπηση παίρνει τις λέξεις από το lib/facts', /YIELD_INLINE_LABELS\.net_pre_tax\}/.test(ov));
}

// ── Το πλακίδιο «Δαπάνες έτους» στο μισό πλάτος ──────────────────────────
{
  const y = { year: 2026, paid: 9894.7, scheduled: 265, overdue: 0, total: 10159.7, entries: [] };
  const short = expensePartsShort(y, fe);
  ok('σύντομο: ίδια ποσά, πρώτα το ποσό', short === '9.894,70€ πληρωμένες + 265,00€ έως 31/12', short);
  ok('σύντομο: το μισό μήκος του πλήρους', short.length * 1.5 < expenseParts(y, fe).length, `${short.length} / ${expenseParts(y, fe).length}`);
  ok('σύντομο: ληξιπρόθεσμες όταν υπάρχουν', expensePartsShort({ ...y, overdue: 40 }, fe).endsWith('+ 40,00€ ληξιπρόθεσμες'));
  const ov = readFileSync('app/dashboard/components/OverviewTab.tsx', 'utf8');
  ok('η Επισκόπηση γράφει το σύντομο στο πλακίδιο', (ov.match(/sub: expensePartsShort\(yExp, fmtEur\)/g) || []).length === 2);
}

console.log(fail ? `✗ yield: ${fail} απέτυχαν από ${pass + fail}` : `✓ yield: ${pass} έλεγχοι πέρασαν`);
if (fail) process.exit(1);
