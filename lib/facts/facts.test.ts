// npx tsx lib/facts/facts.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// ΕΝΑΣ ΑΡΙΘΜΟΣ, ΜΙΑ ΕΤΙΚΕΤΑ: ΜΕ ΤΑ ΔΕΔΟΜΕΝΑ ΤΟΥ ΛΟΓΑΡΙΑΣΜΟΥ ΕΠΙΔΕΙΞΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Τα δεδομένα είναι αυτούσια του scripts/db/staging-demo.sql (Παγκράτι,
// Κουκάκι), όχι της παραγωγής. «Σήμερα» είναι 05.10.2026.
//
// ΤΙ ΕΒΓΑΖΑΝ ΟΙ ΟΘΟΝΕΣ ΠΡΙΝ, για το Παγκράτι και το 2026:
//   · Επισκόπηση, πλακίδιο: 10.159,70€· απόδοση με δαπάνες από άλλη προβολή.
//   · Χαρτοφυλάκιο, ετήσιες δαπάνες: 10.159,70 × 12 / 10 ≈ 12.192€.
//   · Χαρτοφυλάκιο, «Καθαρό ως σήμερα»: έσοδα ως σήμερα − δαπάνες ως τις 31/12.
// ΤΩΡΑ: πληρωμένες ως σήμερα 9.894,70€ + προγραμματισμένες έως 31/12 265,00€
// = 10.159,70€, με αυτές τις λέξεις, από μία συνάρτηση.
// ═══════════════════════════════════════════════════════════════════════════
import {
  propertyStatus, propertyStatusLabel, isLease,
  yearExpenses, expenseParts, EXPENSE_LABELS,
  rentIncome, hostingReceipts,
  propertyYield, YIELD_LABELS,
  enfiaYear, ENFIA_DEFAULTS, ENFIA_LABELS,
  taxpayerScope, sameTaxpayer,
} from './index';
import { computeYields } from '@/lib/billing/propertyFacts';
import { yields } from '@/lib/market/returns';
import type { LedgerExpense } from '@/lib/expenses/ledger';
import type { IncomeRent } from '@/lib/income/propertyIncome';
import type { StayAmountLike } from '@/lib/clients/stayAmounts';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) pass++; else { fail++; console.error(`✗ ${name}${detail ? `  (${detail})` : ''}`); }
}
const eur = (n: number) => new Intl.NumberFormat('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + '€';
const TODAY = '2026-10-05';
const YEAR = 2026;

// ── Το Παγκράτι, όπως το γράφει το staging-demo.sql ─────────────────────────
// Το `expenses.paid` είναι `true` εξ ορισμού στη βάση· το σενάριο δεν το ορίζει.
const PANGRATI = { status_detail: 'rented', rental_mode: 'long_term', value: 150000, enfia: 340 };
const EXP: [string, number][] = [
  ['2026-01-20', 88.50], ['2026-03-20', 94.20], ['2026-05-20', 61.00], ['2026-07-20', 130.40],
  ['2026-02-10', 24.60], ['2026-08-10', 31.20], ['2026-01-15', 29.90], ['2026-06-15', 29.90],
  ['2026-04-01', 180.00], ['2026-06-01', 340.00], ['2026-03-05', 45.00], ['2026-02-18', 8000.00],
  ['2026-05-06', 480.00], ['2026-09-12', 120.00], ['2026-10-03', 90.00], ['2026-11-20', 65.00],
  ['2026-04-22', 150.00], ['2026-12-01', 200.00],
];
const expenses: LedgerExpense[] = EXP.map(([date, amount], i) => ({ id: `e${i}`, date, amount, paid: true, category: 'x' }));
const rents: IncomeRent[] = Array.from({ length: 12 }, (_, k) => ({
  amount: 650, paid: true, period_year: 2026, period_month: k + 1,
  due_date: `2026-${String(k + 1).padStart(2, '0')}-05`,
  paid_date: k === 11 ? '2027-01-08' : `2026-${String(k + 1).padStart(2, '0')}-05`,
}));

// ── Το Κουκάκι ────────────────────────────────────────────────────────────
const KOUKAKI = { status_detail: 'rent_short', rental_mode: 'short_term' };
const STAYS: [string, string, number, number][] = [
  ['2026-05-10', '2026-05-14', 508, 60], ['2026-06-10', '2026-06-14', 608, 75],
  ['2026-07-10', '2026-07-14', 808, 100], ['2026-07-20', '2026-07-24', 908, 120],
  ['2026-08-05', '2026-08-09', 1008, 135], ['2026-08-18', '2026-08-22', 908, 110],
  ['2026-09-05', '2026-09-09', 408, 0], ['2026-09-20', '2026-09-24', 508, 0],
];
const stays: StayAmountLike[] = STAYS.map(([check_in, check_out, gross, fee]) => ({
  check_in, check_out, nights: 4, gross_guest_paid: gross, climate_levy: 8, platform_fee: fee,
  total: gross - 8 - fee, amount_basis: 'gross',
}));

// ═══ 1. ΚΑΤΑΣΤΑΣΗ ═══════════════════════════════════════════════════════════
ok('Παγκράτι: μακροχρόνια μίσθωση', propertyStatus(PANGRATI) === 'rent_long' && propertyStatusLabel(PANGRATI) === 'Μακροχρόνια μίσθωση');
ok('Κουκάκι: βραχυχρόνια μίσθωση', propertyStatus(KOUKAKI) === 'rent_short');
ok('παλιό «seasonal» χωρίς rental_mode: βραχυχρόνια', propertyStatus({ status_detail: 'seasonal' }) === 'rent_short');
ok('ιδιοχρησία: όχι μίσθωση', !isLease(propertyStatus({ status_detail: 'own_use' })));
ok('rental_mode ποτέ «own_use»: η παλιά συνθήκη της Λογιστικής ήταν πάντα αληθής',
  ({ rental_mode: null } as { rental_mode: string | null }).rental_mode !== 'own_use' && !isLease(propertyStatus({ status_detail: 'own_use', rental_mode: null })));

// ═══ 2. ΔΑΠΑΝΕΣ ΕΤΟΥΣ ═══════════════════════════════════════════════════════
const y = yearExpenses([], expenses, YEAR, TODAY);
ok('πληρωμένες ως σήμερα 9.894,70€', y.paid === 9894.70, String(y.paid));
ok('προγραμματισμένες έως 31/12 265,00€', y.scheduled === 265.00, String(y.scheduled));
ok('ληξιπρόθεσμες 0', y.overdue === 0);
ok('σύνολο 10.159,70€ = άθροισμα των μερών', y.total === 10159.70 && y.total === Math.round((y.paid + y.scheduled + y.overdue) * 100) / 100, String(y.total));
ok('οι λέξεις', expenseParts(y, eur) === `${EXPENSE_LABELS.paid} 9.894,70€ + ${EXPENSE_LABELS.scheduled} 265,00€`, expenseParts(y, eur));
ok('ετικέτα συνόλου', EXPENSE_LABELS.total === 'Δαπάνες έτους');
// Το ×12/μήνες του Χαρτοφυλακίου έβγαζε άλλο νούμερο από το πλακίδιο.
const oldPortfolio = Math.round(y.total * (12 / 10));
ok('η παλιά ετησιοποίηση του Χαρτοφυλακίου ΔΕΝ είναι το σύνολο (το σφάλμα)', oldPortfolio !== Math.round(y.total) && oldPortfolio === 12192, String(oldPortfolio));
// Απλήρωτος λογαριασμός που έληξε: ληξιπρόθεσμος, όχι πληρωμένος, όχι προγραμματισμένος.
const yb = yearExpenses([{ id: 'b1', amount: 50, due_date: '2026-09-30', paid: false }], expenses, YEAR, TODAY);
ok('ληξιπρόθεσμος λογαριασμός: στο δικό του μέρος', yb.overdue === 50 && yb.paid === 9894.70 && yb.total === 10209.70);
ok('και φαίνεται στις λέξεις', expenseParts(yb, eur).endsWith(`${EXPENSE_LABELS.overdue} 50,00€`));
// Κλεισμένο έτος: τίποτα προγραμματισμένο.
ok('κλεισμένο έτος: όλα πληρωμένα', yearExpenses([], expenses, YEAR, '2027-02-01').scheduled === 0);

// ═══ 3. ΕΣΟΔΑ ΕΝΟΙΚΙΟΥ ══════════════════════════════════════════════════════
const inc = rentIncome({ status: propertyStatus(PANGRATI), rents, stays: [], year: YEAR, today: TODAY, value: 150000, estimateMonthly: 650 });
ok('εισπραγμένα ως σήμερα 6.500,00€', inc.received === 6500, String(inc.received));
ok('αναμενόμενα με βάση τη μίσθωση 7.800,00€', inc.expected === 7800);
ok('ετήσιος ρυθμός 7.800,00€, σημειωμένος ως προβολή', inc.annualized === 7800 && inc.projected === true);
const own = rentIncome({ status: 'own_use', rents: [], stays: [], year: YEAR, today: TODAY, estimateMonthly: 650 });
ok('ιδιοχρησία με ξεχασμένο μίσθωμα: κανένα έσοδο', own.received === 0 && own.expected === 0 && own.annualized === 0 && own.source === 'none');
const left = rentIncome({ status: 'vacant', rents: rents.slice(0, 5), stays: [], year: YEAR, today: TODAY, estimateMonthly: 650 });
ok('κενό από τον Ιούνιο: μένουν όσα εισπράχθηκαν, χωρίς αναμενόμενα', left.received === 3250 && left.expected === 0 && left.annualized === 0);

// ═══ 4. ΕΙΣΠΡΑΞΕΙΣ ΦΙΛΟΞΕΝΙΑΣ ═══════════════════════════════════════════════
const h = hostingReceipts(stays, YEAR, TODAY);
ok('Κουκάκι: δηλωτέο ακαθάριστο 5.600,00€', h.declarable === 5600, String(h.declarable));
ok('Κουκάκι: μπήκαν στον λογαριασμό 5.000,00€', h.payout === 5000, String(h.payout));
ok('οκτώ διαμονές, τριάντα δύο νύχτες, καμία απροσδιόριστη', h.stays === 8 && h.nights === 32 && h.unresolved === 0);
const hinc = rentIncome({ status: propertyStatus(KOUKAKI), rents: [], stays, year: YEAR, today: TODAY });
ok('έσοδα φιλοξενίας = δηλωτέο της ίδιας συνάρτησης', hinc.received === h.declarable);
// Κράτηση που περνά την αλλαγή του έτους: ίδιο κλάσμα νυχτών και στα δύο ποσά.
const nye: StayAmountLike = { check_in: '2026-12-30', check_out: '2027-01-03', nights: 4, gross_guest_paid: 408, climate_levy: 8, platform_fee: 40, total: 360 };
const hn = hostingReceipts([nye], 2027, '2027-02-01');
ok('Πρωτοχρονιά: δύο από τέσσερις νύχτες στο 2027 και στα δύο ποσά', hn.declarable === 200 && hn.payout === 180 && hn.nights === 2);

// «Ως σήμερα» σημαίνει ως σήμερα: η κράτηση του Δεκεμβρίου δεν έχει μπει στον
// λογαριασμό στις 28/09, η σημερινή άφιξη μετρά (ήταν το staysOfYearToDate).
const td = hostingReceipts([
  { check_in: '2026-06-01', check_out: '2026-06-08', nights: 7, total: 700, amount_basis: 'payout' },
  { check_in: '2026-09-28', check_out: '2026-10-02', nights: 4, total: 400, amount_basis: 'payout' },
  { check_in: '2026-12-20', check_out: '2026-12-27', nights: 7, total: 900, amount_basis: 'payout' },
], 2026, '2026-09-28');
ok('ως σήμερα: η μελλοντική κράτηση μένει έξω, η σημερινή άφιξη μετρά', td.payout === 1100 && td.stays === 2, String(td.payout));

// ═══ 5. ΑΠΟΔΟΣΗ ═════════════════════════════════════════════════════════════
const yl = propertyYield({ annualIncome: 7800, value: 150000, annualExpenses: y.total });
ok('μεικτή 5,2%', Math.abs(yl.gross - 5.2) < 1e-9);
ok('καθαρή προ φόρου με τις δαπάνες έτους', Math.abs(yl.net_pre_tax - (7800 - 10159.70) / 1500) < 1e-9);
ok('χωρίς φόρο δεν υπάρχει «μετά φόρου»', yl.net_after_tax === null);
const cy = computeYields(650, 150000, y.total);
ok('Επισκόπηση (computeYields) = ίδια συνάρτηση', cy.grossYield === yl.gross && cy.netYield === yl.net_pre_tax);
const ry = yields(650, 150000, y.total, 500);
ok('Αποδόσεις (yields) = ίδια συνάρτηση', ry.netYield === Math.round(yl.net_pre_tax * 100) / 100 &&
  ry.netYieldAfterTax === Math.round(propertyYield({ annualIncome: 7800, value: 150000, annualExpenses: y.total, annualTax: 500 }).net_after_tax! * 100) / 100);
ok('οι ετικέτες λένε τη βάση', YIELD_LABELS.net_pre_tax.includes('προ φόρου') && YIELD_LABELS.net_after_tax.includes('μετά φόρου'));

// ═══ 6. ΕΝΦΙΑ ═══════════════════════════════════════════════════════════════
const ef = enfiaYear(ENFIA_DEFAULTS, YEAR, { stored: PANGRATI.enfia, value: 150000, sqm: 78, yearBuilt: 1998 });
ok('Παγκράτι: ΕΝΦΙΑ του εκκαθαριστικού 340,00€', ef.annual === 340 && ef.label === ENFIA_LABELS.declared, `${ef.annual} ${ef.label}`);
ok('δώδεκα δόσεις που αθροίζουν στο ετήσιο', ef.instalments.length === 12 && Math.round(ef.instalments.reduce((s, x) => s + x.amount, 0) * 100) / 100 === 340);
ok('πρώτη δόση τέλος Μαρτίου, τελευταία Φεβρουάριο του επόμενου', ef.instalments[0].date.startsWith('2026-03') && ef.instalments[11].date.startsWith('2027-02'));
const efEst = enfiaYear(ENFIA_DEFAULTS, YEAR, { value: 150000, sqm: 78, yearBuilt: 1998 });
ok('χωρίς ποσό εκκαθαριστικού: «εκτίμηση» στην ετικέτα', efEst.label === ENFIA_LABELS.estimate || efEst.label === ENFIA_LABELS.none);

// ═══ 7. ΦΟΡΟΛΟΓΟΥΜΕΝΟΣ ══════════════════════════════════════════════════════
const props = [{ id: 'a', client_id: null }, { id: 'b', client_id: null }];
ok('ιδιώτης: ένας φορολογούμενος', taxpayerScope('individual', new Set(['x'])) === null && sameTaxpayer(props, 'a', taxpayerScope('individual', null)).length === 2);
ok('επαγγελματίας με Πελατολόγιο που δεν διαβάστηκε: ποτέ η ένωση', sameTaxpayer(props, 'a', taxpayerScope('professional', null)).length === 1);
ok('επαγγελματίας χωρίς ιδιοκτήτες: ποτέ η ένωση', sameTaxpayer(props, 'a', taxpayerScope('professional', new Set())).length === 1);

console.log(fail ? `✗ facts: ${fail} απέτυχαν από ${pass + fail}` : `✓ facts: ${pass} έλεγχοι πέρασαν`);
if (fail) process.exit(1);
