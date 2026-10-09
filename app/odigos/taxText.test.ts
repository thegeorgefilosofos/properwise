// npx tsx app/odigos/taxText.test.ts
//
// ΟΙ ΓΡΑΦΕΣ ΤΗΣ ΚΛΙΜΑΚΑΣ ΑΚΟΛΟΥΘΟΥΝ ΤΑ ΚΛΙΜΑΚΙΑ. Οι οδηγοί και ο υπολογιστής
// ενοικίων έγραφαν «15 / 25 / 35 / 45%», «όριο 36.000€» και «τα πρώτα 12.000€
// με 15% (1.800€)» με το χέρι (ως 07/10/2026). Τώρα τα γράφει το ./taxText.ts.
// Ο έλεγχος κρατά δύο πράγματα: ότι οι γραφές βγαίνουν ΑΠΟ τα κλιμάκια (αλλάζει
// το κλιμάκιο, αλλάζει το κείμενο) και ότι για τη σημερινή κλίμακα το κείμενο
// είναι ακριβώς αυτό που διάβαζε ο αναγνώστης πριν από τη μεταφορά.
import { readFileSync } from 'node:fs';
import {
  RENTAL_TAX_BRACKETS_2026, RENTAL_TAX_BRACKETS_2025, rentalIncomeTax, type TaxBracket,
  rentalBracketsForYear, CORPORATE_TAX_RATE_2026, DIVIDEND_WITHHOLDING_RATE, MUNICIPAL_ACCOM_TAX_RATE,
} from '@/lib/billing/greekTax';
import { TRANSFER_TAX_RATE, NEW_BUILD_VAT_RATE } from '@/lib/accounting/transfer';
import { PRESUMPTIVE_DEDUCTION_RATE } from '@/lib/billing/presumptive';
import { COMMERCIAL_STAMP_DUTY } from '@/app/dashboard/components/TabTenantHelpers';
import { fpRate } from '@/lib/core/format';
import { ratePct, rateScale, rateScaleEach, rateSeries, topBracketFrom, bracketSlices } from './taxText';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

// ── Από τα κλιμάκια ──────────────────────────────────────────────────────
const FAKE: TaxBracket[] = [{ from: 0, to: 10_000, rate: 0.1 }, { from: 10_000, to: Infinity, rate: 0.3 }];
ok('rateScale ακολουθεί τα κλιμάκια', rateScale(FAKE) === '10 / 30%');
ok('rateScaleEach ακολουθεί τα κλιμάκια', rateScaleEach(FAKE) === '10% / 30%');
ok('rateSeries ακολουθεί τα κλιμάκια', rateSeries(FAKE) === '10% και 30%');
ok('topBracketFrom: η αρχή του ανώτερου', topBracketFrom(FAKE) === 10_000);
for (const brackets of [RENTAL_TAX_BRACKETS_2026, RENTAL_TAX_BRACKETS_2025, FAKE]) {
  for (const t of [0, 1, 7_980, 12_000, 20_520, 36_000, 40_000, 123_456.78]) {
    const sum = bracketSlices(t, brackets).reduce((a, s) => a + s.tax, 0);
    ok(`bracketSlices(${t}) αθροίζει στο rentalIncomeTax`, Math.abs(sum - rentalIncomeTax(t, brackets)) < 1e-9);
  }
}

// ── Η σημερινή κλίμακα: ίδιο κείμενο με πριν ─────────────────────────────
ok('2026: «15 / 25 / 35 / 45%»', rateScale(RENTAL_TAX_BRACKETS_2026) === '15 / 25 / 35 / 45%');
ok('2025: «15 / 35 / 45%»', rateScale(RENTAL_TAX_BRACKETS_2025) === '15 / 35 / 45%');
ok('2026: «15% / 25% / 35% / 45%»', rateScaleEach(RENTAL_TAX_BRACKETS_2026) === '15% / 25% / 35% / 45%');
ok('2026: «15%, 25%, 35% και 45%»', rateSeries(RENTAL_TAX_BRACKETS_2026) === '15%, 25%, 35% και 45%');
ok('ratePct(0.05) → «5%»', ratePct(0.05) === '5%');
{
  const [low, high] = bracketSlices(20_520, RENTAL_TAX_BRACKETS_2026);
  ok('παράδειγμα 2: 12.000 με 15% = 1.800', low.width === 12_000 && low.rate === 0.15 && Math.abs(low.tax - 1_800) < 1e-9);
  ok('παράδειγμα 2: 8.520 με 25% = 2.130', Math.abs(high.width - 8_520) < 1e-9 && high.rate === 0.25 && Math.abs(high.tax - 2_130) < 1e-9);
}

// ── Οι συντελεστές από τη σταθερά: ίδιο κείμενο με το χειρόγραφο (08/10/2026) ──
// Το Δάνειο, η Λογιστική, η Τιμολόγηση και η Κατάσταση έγραφαν αυτά τα ποσοστά
// με το χέρι (scripts/guard-tax-literals.mjs). Τώρα τα γράφει η σταθερά· για
// τις σημερινές τιμές ο αναγνώστης διαβάζει ακριβώς ό,τι διάβαζε.
ok('κλίμακα έτους 2025: «15 / 35 / 45%»', rateScale(rentalBracketsForYear(2025)) === '15 / 35 / 45%');
ok('κλίμακα έτους 2026: «15 / 25 / 35 / 45%»', rateScale(rentalBracketsForYear(2026)) === '15 / 25 / 35 / 45%');
ok('ΦΜΑ «3,09%»', fpRate(TRANSFER_TAX_RATE * 100) === '3,09%');
ok('ΦΠΑ νεόδμητων «24%»', fpRate(NEW_BUILD_VAT_RATE * 100) === '24%');
ok('Ψηφιακό Τέλος Συναλλαγής «3,6%»', fpRate(COMMERCIAL_STAMP_DUTY * 100) === '3,6%');
ok('νομικά πρόσωπα «22%»', fpRate(CORPORATE_TAX_RATE_2026 * 100) === '22%');
ok('μέρισμα «5%»', fpRate(DIVIDEND_WITHHOLDING_RATE * 100) === '5%');
ok('τέλος παρεπιδημούντων «0,5%»', fpRate(MUNICIPAL_ACCOM_TAX_RATE * 100) === '0,5%');
ok('τεκμαρτή έκπτωση «5%»', fpRate(PRESUMPTIVE_DEDUCTION_RATE * 100) === '5%');
ok('βάση του φόρου «95%»', fpRate((1 - PRESUMPTIVE_DEDUCTION_RATE) * 100) === '95%');
ok('αρχική: «15% ως 45%»', ratePct(RENTAL_TAX_BRACKETS_2026[0].rate) === '15%' && ratePct(RENTAL_TAX_BRACKETS_2026[RENTAL_TAX_BRACKETS_2026.length - 1].rate) === '45%' && RENTAL_TAX_BRACKETS_2026.length === 4);

// ── Κανένας οδηγός δεν ξαναγράφει την κλίμακα με το χέρι ─────────────────
const FILES = [
  'app/odigos/forologia-enoikion-2026/page.tsx',
  'app/odigos/enoikio-meso-trapezas/page.tsx',
  'app/odigos/kathari-apodosi-akinitou/page.tsx',
  'app/ypologismos-forou-enoikion/page.tsx',
  'app/ypologismos-forou-enoikion/RentTaxCalculator.tsx',
  'app/kathari-apodosi/ApodosiCalculator.tsx',
];
const HAND = [/15 \/ 25 \/ 35 \/ 45%/, /15 \/ 35 \/ 45%/, /15% \/ 25%/, /36\.000€/, /1\.197€/, /5\.903€/, /01\/07\/2027/];
for (const f of FILES) {
  const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const re of HAND) ok(`${f}: χωρίς χειρόγραφο ${re.source}`, !re.test(code));
}

console.log(fail ? `✗ taxText: ${fail} απέτυχαν, ${pass} πέρασαν` : `✓ taxText: ${pass} έλεγχοι πέρασαν`);
if (fail) process.exit(1);
