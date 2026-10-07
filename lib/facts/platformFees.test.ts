// npx tsx lib/facts/platformFees.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// ΕΠΙΣΚΟΠΗΣΗ ΚΑΙ ΑΠΟΔΟΣΕΙΣ: ΙΔΙΟ ΕΣΟΔΟ, ΙΔΙΑ ΠΡΟΜΗΘΕΙΑ, ΙΔΙΑ ΚΑΘΑΡΗ (07.10.2026)
// ─────────────────────────────────────────────────────────────────────────
// Δύο ορισμοί διέφεραν ανάμεσα στις δύο καρτέλες:
//   1. Η προμήθεια της πλατφόρμας. Η Επισκόπηση αγνοούσε το `platform_fee` των
//      διαμονών· οι Αποδόσεις έβαζαν το ποσοστό του πεδίου επί των εσόδων.
//   2. Το έσοδο μίσθωσης. Η Επισκόπηση έπαιρνε το μίσθωμα × 12· οι Αποδόσεις
//      τις δόσεις σε ετήσιο ρυθμό.
// Εδώ αναπαράγεται κάθε απόκλιση με τον παλιό υπολογισμό κάθε καρτέλας και
// φαίνεται ότι ο νέος, κοινός, δίνει τον ίδιο αριθμό και στις δύο.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import {
  rentIncome, yieldIncome, yieldCosts, yieldCostParts, stayPlatformFees, yieldPlatformFees,
  INCOME_LABELS, YIELD_INCOME_LABELS, PLATFORM_FEE_LABELS,
} from './index';
import { propertyIncome, type IncomeRent } from '@/lib/income/propertyIncome';
import { computeYields } from '@/lib/billing/propertyFacts';
import { yields } from '@/lib/market/returns';
import { fe } from '@/lib/core/format';
import type { StayAmountLike } from '@/lib/clients/stayAmounts';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, got?: unknown) => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${got !== undefined ? ` (got ${JSON.stringify(got)})` : ''}`); }
};
const r2 = (n: number) => Math.round(n * 100) / 100;

// ═══ 1. Η ΠΡΟΜΗΘΕΙΑ ΤΗΣ ΠΛΑΤΦΟΡΜΑΣ ══════════════════════════════════════
// Βραχυχρόνιο, αξία 200.000€, σήμερα 01/07/2026. Τρεις διαμονές ως σήμερα με
// ρητή ανάλυση (ακαθάριστο, τέλος ανθεκτικότητας, προμήθεια) και μία τον
// Αύγουστο που δεν έχει έρθει. Καταγεγραμμένες δαπάνες έτους 3.000€.
const YEAR = 2026, TODAY = '2026-07-01', VALUE = 200000, RECORDED = 3000;
const stay = (ci: string, co: string, gross: number, fee: number): StayAmountLike =>
  ({ check_in: ci, check_out: co, gross_guest_paid: gross, climate_levy: 40, platform_fee: fee, total: gross - 40 - fee });
const STAYS = [
  stay('2026-03-10', '2026-03-15', 1000, 150),
  stay('2026-05-05', '2026-05-10', 1200, 180),
  stay('2026-06-01', '2026-06-06', 800, 120),
  stay('2026-08-01', '2026-08-06', 900, 135), // δεν έχει έρθει: δεν μετρά
];
const fi = rentIncome({ status: 'rent_short', rents: [], stays: STAYS, year: YEAR, today: TODAY, value: VALUE, estimateMonthly: null });
const yi = yieldIncome(fi);
ok('διαμονές: το έσοδο της απόδοσης είναι ο ετήσιος ρυθμός', yi.basis === 'stays' && yi.annual === fi.annualized, yi);
ok('διαμονές: το δηλωτέο ως σήμερα (χωρίς το τέλος)', fi.received === 960 + 1160 + 760, fi.received);
const factor = fi.annualized / fi.received;

// ── Η ΠΑΛΙΑ ΑΠΟΚΛΙΣΗ ─────────────────────────────────────────────────────
// Επισκόπηση: έσοδο μείον καταγεγραμμένες δαπάνες, καμία προμήθεια.
const oldOverview = computeYields(fi.annualized / 12, VALUE, RECORDED).netYield;
// Αποδόσεις: το ποσοστό του πεδίου (15%) επί του εσόδου, ως εκτίμηση.
const FIELD_PCT = 0.15;
const oldRoiCosts = yieldCosts({ recorded: RECORDED, recordedCategories: [], modelled: { platform_fee: fi.annualized * FIELD_PCT } });
const oldRoi = yields(fi.annualized / 12, VALUE, oldRoiCosts.total).netYield;
ok('ΠΡΙΝ: οι δύο καθαρές διέφεραν', Math.abs(r2(oldOverview) - oldRoi) >= 0.05, { oldOverview: r2(oldOverview), oldRoi });
ok('ΠΡΙΝ: οι Αποδόσεις έλεγαν «Εκτιμώμενη»', oldRoiCosts.basis === 'estimated');

// ── Ο ΝΕΟΣ ΚΑΝΟΝΑΣ, ΙΔΙΟΣ ΚΑΙ ΣΤΙΣ ΔΥΟ ──────────────────────────────────
{
  const fees = yieldPlatformFees(fi, STAYS, { year: YEAR, today: TODAY, expenses: [] });
  ok('οι προμήθειες ως σήμερα είναι όσες κρατήθηκαν', fees.toDate === 450, fees);
  ok('σε ετήσιο ρυθμό με τον συντελεστή του εσόδου', fees.annual === Math.round(450 * factor * 100) / 100, fees);
  ok('η διαμονή του Αυγούστου δεν μετρά', fees.stays === 3, fees.stays);
  // Η Επισκόπηση περνά τις δαπάνες της· οι Αποδόσεις τις ίδιες και το μοντέλο.
  const ovCosts = yieldCosts({ recorded: RECORDED, recordedCategories: [], stayFees: fees.annual });
  const roiCosts = yieldCosts({ recorded: RECORDED, recordedCategories: [], stayFees: fees.annual, modelled: { platform_fee: fi.annualized * FIELD_PCT } });
  const ov = computeYields(yi.annual / 12, VALUE, ovCosts.total).netYield;
  const roi = yields(yi.annual / 12, VALUE, roiCosts.total).netYield;
  ok('ΤΩΡΑ: ίδια καθαρή στις δύο καρτέλες', r2(ov) === roi, { ov: r2(ov), roi });
  ok('ΤΩΡΑ: το ποσοστό του πεδίου δεν μπαίνει πάνω από την προμήθεια των διαμονών', roiCosts.modelled === 0 && roiCosts.recordedKinds.includes('platform_fee'), roiCosts);
  ok('ΤΩΡΑ: καταγραφή, όχι εκτίμηση· η ετικέτα μένει «Καθαρή απόδοση προ φόρου»', roiCosts.basis === 'recorded' && ovCosts.basis === 'recorded');
  ok('ΤΩΡΑ: η Επισκόπηση αφαιρεί την προμήθεια', r2(ov) < r2(oldOverview));
  ok('η αφαίρεση φαίνεται με λέξεις', yieldCostParts(ovCosts, fe) === `μετά από ${fe(RECORDED)} έξοδα και ${fe(fees.annual)} ${PLATFORM_FEE_LABELS.short}`, yieldCostParts(ovCosts, fe));
}

// ── ΜΙΑ ΦΟΡΑ: η προμήθεια του Μαΐου είναι ήδη δαπάνη ─────────────────────
{
  const ledger = [
    { category: 'Ρεύμα', date: '2026-05-20' },
    { category: 'platform_fee', date: '2026-05-31' }, // «Προμήθεια Airbnb Μαΐου», 180€ μέσα στις 3.000€
  ];
  const fees = yieldPlatformFees(fi, STAYS, { year: YEAR, today: TODAY, expenses: ledger });
  ok('ο μήνας με δαπάνη προμήθειας δεν ξαναμετρά από τις διαμονές', fees.toDate === 150 + 120, fees);
  ok('η προμήθεια του Μαΐου φαίνεται ως καλυμμένη από τη δαπάνη', fees.coveredByExpenses === 180 && fees.ownMonths === 1, fees);
  const c = yieldCosts({ recorded: RECORDED, recordedCategories: ledger.map(e => e.category), stayFees: fees.annual, modelled: { platform_fee: 999 } });
  ok('με δαπάνη ΚΑΙ προμήθειες διαμονών, καμία εκτίμηση από πάνω', c.modelled === 0 && c.total === RECORDED + fees.annual, c);
  // Ο ίδιος κανόνας μήνα με το ημερολόγιο και τη Λογιστική: η ελληνική ετικέτα της κατηγορίας μετρά επίσης.
  const greek = stayPlatformFees(STAYS, { year: YEAR, today: TODAY, expenses: [{ category: 'Προμήθεια πλατφόρμας', date: '2026-03-31' }] });
  ok('η κατηγορία με ελληνικό όνομα αναγνωρίζεται', greek.toDate === 180 + 120, greek);
}

// ── Χωρίς διαμονές, καμία προμήθεια· χωρίς προμήθεια στη διαμονή, τίποτα επινοημένο ──
{
  const lease = rentIncome({ status: 'rent_long', rents: [{ amount: 650, paid: true, paid_date: '2026-06-05', period_year: 2026, period_month: 6 }], stays: [], year: YEAR, today: TODAY, estimateMonthly: 650 });
  ok('μίσθωση με δόσεις: καμία προμήθεια', yieldPlatformFees(lease, STAYS, { year: YEAR, today: TODAY }).annual === 0);
  const noFee = STAYS.map(s => ({ ...s, platform_fee: null }));
  ok('διαμονές χωρίς προμήθεια: μηδέν, όχι ποσοστό', stayPlatformFees(noFee, { year: YEAR, today: TODAY }).toDate === 0);
  // Διαμονή που περνά την Πρωτοχρονιά: μόνο το μερίδιο νυχτών του έτους.
  const nye = [stay('2025-12-30', '2026-01-03', 800, 100)];
  ok('διαμονή της Πρωτοχρονιάς: το μερίδιο του έτους', stayPlatformFees(nye, { year: YEAR, today: TODAY }).toDate === 50);
}

// ═══ 2. ΤΟ ΕΣΟΔΟ ΜΙΣΘΩΣΗΣ ════════════════════════════════════════════════
// Μίσθωμα 650€, σήμερα 07/10/2026. Δόσεις Ιανουαρίου ως Σεπτεμβρίου πληρωμένες,
// η δόση Οκτωβρίου έληξε στις 05/10 και δεν έχει μπει.
{
  const T = '2026-10-07';
  const rents: IncomeRent[] = Array.from({ length: 10 }, (_, k) => ({
    amount: 650, period_year: 2026, period_month: k + 1,
    due_date: `2026-${String(k + 1).padStart(2, '0')}-05`,
    paid: k < 9, paid_date: k < 9 ? `2026-${String(k + 1).padStart(2, '0')}-05` : null,
  }));
  // ΠΡΙΝ: οι Αποδόσεις διάβαζαν το `propertyIncome` (δόσεις σε ετήσιο ρυθμό).
  const oldRoi = propertyIncome({ rents, stays: [], year: 2026, today: T, estimateMonthly: 650 }).annualized;
  // ΠΡΙΝ: η Επισκόπηση το `rentIncome(...).expected` (μίσθωμα × 12).
  const fiL = rentIncome({ status: 'rent_long', rents, stays: [], year: 2026, today: T, estimateMonthly: 650 });
  const oldOverview = fiL.expected;
  ok('ΠΡΙΝ: δύο ετήσια έσοδα για το ίδιο ακίνητο', oldRoi === 7020 && oldOverview === 7800, { oldRoi, oldOverview });
  ok('ΠΡΙΝ: δύο μεικτές αποδόσεις', computeYields(oldOverview / 12, VALUE, 0).grossYield !== yields(oldRoi / 12, VALUE, 0).grossYield);
  // ΤΩΡΑ: ένα.
  const y = yieldIncome(fiL);
  ok('ΤΩΡΑ: η απόδοση στο μίσθωμα × 12', y.annual === 7800 && y.basis === 'lease', y);
  ok('ΤΩΡΑ: το ταμείο χωριστά, όσα μπήκαν', y.received === 9 * 650, y.received);
  ok('ΤΩΡΑ: ίδια μεικτή στις δύο καρτέλες', r2(computeYields(y.annual / 12, VALUE, 0).grossYield) === yields(y.annual / 12, VALUE, 0).grossYield);
  ok('η ετικέτα λέει τη βάση με τις λέξεις του lib/facts', y.label === YIELD_INCOME_LABELS.lease && y.label.includes(INCOME_LABELS.expected), y.label);
  ok('δεν είναι εκτίμηση', y.estimated === false);
  // Μίσθωση χωρίς καμία δόση: η απόδοση στο μίσθωμα, αλλά κανένα «εισπραγμένα».
  const none = yieldIncome(rentIncome({ status: 'rent_long', rents: [], stays: [], year: 2026, today: T, estimateMonthly: 650 }));
  ok('χωρίς δόσεις: μίσθωμα × 12, χωρίς ψεύτικο ταμείο', none.annual === 7800 && none.received === null, none);
  // Δόσεις χωρίς τρέχον μίσθωμα (ο ενοικιαστής έφυγε): ετήσιος ρυθμός, εκτίμηση.
  const left = yieldIncome(rentIncome({ status: 'rent_long', rents, stays: [], year: 2026, today: T, estimateMonthly: null }));
  ok('δόσεις χωρίς μίσθωμα: ετήσιος ρυθμός με τη λέξη', left.basis === 'payments' && left.annual === 7020 && left.estimated, left);
  ok('χωρίς μίσθωση: τίποτα', yieldIncome(rentIncome({ status: 'vacant', rents: [], stays: [], year: 2026, today: T, estimateMonthly: 650 })).basis === 'none');
}

// ═══ 3. ΟΙ ΔΥΟ ΚΑΡΤΕΛΕΣ ΔΙΑΒΑΖΟΥΝ ΤΟΝ ΙΔΙΟ ΚΑΝΟΝΑ ═══════════════════════
{
  const ov = readFileSync('app/dashboard/components/OverviewTab.tsx', 'utf8');
  const roi = readFileSync('app/dashboard/components/TabRentROI.tsx', 'utf8');
  for (const [name, src] of [['Επισκόπηση', ov], ['Αποδόσεις', roi]] as const) {
    ok(`${name}: έσοδο από το yieldIncome`, /yieldIncome\(/.test(src));
    ok(`${name}: προμήθεια από το yieldPlatformFees`, /yieldPlatformFees\(/.test(src));
    ok(`${name}: η προμήθεια περνά στο yieldCosts`, /stayFees: stayFees(\?\.annual \?\? 0|\.annual)/.test(src));
  }
  ok('Αποδόσεις: όχι πια propertyIncome για την απόδοση', !/setRecorded\(propertyIncome\(/.test(roi));
  ok('Αποδόσεις: όχι πια recorded.annualized στο έσοδο', !/useRecorded \? recorded!\.annualized/.test(roi));
  ok('Επισκόπηση: η καθαρή αφαιρεί όλο το yieldCosts', /computeYields\(incomeMonthly, propValue, costs\.total\)/.test(ov));
  ok('Επισκόπηση: το καθαρό αποτέλεσμα επίσης', /annualRent - costs\.total - estTax/.test(ov));
}

console.log(fail ? `✗ platformFees: ${fail} απέτυχαν από ${pass + fail}` : `✓ platformFees: ${pass} έλεγχοι πέρασαν`);
if (fail) process.exit(1);
