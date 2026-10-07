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
} from '@/lib/billing/greekTax';
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

// ── Κανένας οδηγός δεν ξαναγράφει την κλίμακα με το χέρι ─────────────────
const FILES = [
  'app/odigos/forologia-enoikion-2026/page.tsx',
  'app/odigos/enoikio-meso-trapezas/page.tsx',
  'app/odigos/kathari-apodosi-akinitou/page.tsx',
  'app/ypologismos-forou-enoikion/page.tsx',
  'app/ypologismos-forou-enoikion/RentTaxCalculator.tsx',
];
const HAND = [/15 \/ 25 \/ 35 \/ 45%/, /15 \/ 35 \/ 45%/, /15% \/ 25%/, /36\.000€/, /1\.197€/, /5\.903€/, /01\/07\/2027/];
for (const f of FILES) {
  const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const re of HAND) ok(`${f}: χωρίς χειρόγραφο ${re.source}`, !re.test(code));
}

console.log(fail ? `✗ taxText: ${fail} απέτυχαν, ${pass} πέρασαν` : `✓ taxText: ${pass} έλεγχοι πέρασαν`);
if (fail) process.exit(1);
