// Το κόστος των μετρητών ανά χρήση (presumptive.ts). Τρέξε: npx tsx lib/billing/presumptive.test.ts
//
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ (20.10.2026). Ο υπολογιστής φόρου ενοικίων έγραφε για το 2027
// «η έκπτωση που χάνεται κοστίζει 54,00€» πάνω από φόρο που διέφερε μόνο κατά
// 27€: το κόστος έβγαινε με ολόκληρη την έκπτωση, ο φόρος με τη μισή.
import { cashReceiptTaxCost, presumptiveDeductionRateForYear, PRESUMPTIVE_DEDUCTION_RATE } from './presumptive';
import { rentalIncomeTax, rentalBracketsForYear, FIRST_YEAR_BANK_RECEIPT } from './greekTax';

let passed = 0, failed = 0;
const fails: string[] = [];
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; fails.push(name); } };
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

const GROSS = 600 * 12;
const taxFor = (year: number, viaBank: boolean) =>
  rentalIncomeTax(GROSS * (1 - presumptiveDeductionRateForYear(year, viaBank)), rentalBracketsForYear(year));

// Πριν από την κύρωση ο τρόπος είσπραξης δεν κοστίζει τίποτα.
ok('2026: μηδέν', near(cashReceiptTaxCost(GROSS, 2026, rentalBracketsForYear(2026)), 0));

// 2027: μισή χρήση. 7.200€ × 2,5% × 15% = 27€, ίσο με τη διαφορά των δύο φόρων της κάρτας.
const c27 = cashReceiptTaxCost(GROSS, FIRST_YEAR_BANK_RECEIPT, rentalBracketsForYear(FIRST_YEAR_BANK_RECEIPT));
ok('2027: 27€', near(c27, 27));
ok('2027: ίσο με τη διαφορά των φόρων', near(c27, taxFor(2027, false) - taxFor(2027, true)));
ok('2027: φόρος μετρητοίς 1.053€', near(taxFor(2027, false), 1053));

// 2028: ολόκληρη η χρήση. 7.200€ × 5% × 15% = 54€.
const c28 = cashReceiptTaxCost(GROSS, FIRST_YEAR_BANK_RECEIPT + 1, rentalBracketsForYear(FIRST_YEAR_BANK_RECEIPT + 1));
ok('2028: 54€', near(c28, GROSS * PRESUMPTIVE_DEDUCTION_RATE * 0.15));
ok('2028: ίσο με τη διαφορά των φόρων', near(c28, taxFor(2028, false) - taxFor(2028, true)));
ok('2028: φόρος μετρητοίς 1.080€', near(taxFor(2028, false), 1080));

// Πάνω κλιμάκιο: 48.000€ το 2028, η χαμένη έκπτωση 2.400€ φορολογείται στο 45%.
ok('2028, 48.000€: 1.080€', near(cashReceiptTaxCost(48_000, 2028, rentalBracketsForYear(2028)), 2_400 * 0.45));

console.log(`presumptive: ${passed} passed, ${failed} failed`);
if (failed) { for (const f of fails) console.error('  ✗ ' + f); process.exit(1); }
