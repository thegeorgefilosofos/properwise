// npx tsx lib/billing/climateLevyCategories.test.ts
//
// ΤΑ ΠΟΣΑ ΤΟΥ ΠΙΝΑΚΑ ΤΑΚΚ ΤΟΥ ΟΔΗΓΟΥ AIRBNB. Οι γραμμές της βραχυχρόνιας είναι
// οι τιμές που χρεώνει η εφαρμογή (ίδια αναφορά, όχι αντίγραφο)· οι υπόλοιπες
// κατηγορίες καρφώνονται στα ποσά του άρθρου 44 ν.5177/2025 και της
// Α.1202/2024, όπως τα γράφει το εγκεκριμένο κείμενο (05.10.2026).
import {
  CLIMATE_LEVY_CATEGORIES, CLIMATE_LEVY_AREA_SQM, MUNICIPAL_ACCOM_TAX_MAX_RATE,
  levyByMonth, levyReturnDeadline,
} from './climateLevyCategories';
import { CLIMATE_LEVY_FROM_2025, climateLevyRates, MUNICIPAL_ACCOM_TAX_RATE } from './greekTax';
import { lastWorkingDayOfMonth } from '../tax/greekTaxCalendar';
import { nightsBetween } from '../core/greek';

let passed = 0, failed = 0;
const fails: string[] = [];
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; fails.push(name); } };

// ── Ο πίνακας ──────────────────────────────────────────────────────────────
const by = Object.fromEntries(CLIMATE_LEVY_CATEGORIES.map(c => [c.id, c.rates]));
ok('έξι κατηγορίες, με τη σειρά του οδηγού',
  CLIMATE_LEVY_CATEGORIES.map(c => c.id).join() === 'str-small,str-house-large,tourist-small,tourist-large,tourist-villa,furnished-rooms');
ok('η βραχυχρόνια ως 80 τ.μ. είναι το CLIMATE_LEVY_FROM_2025.small, όχι αντίγραφο', by['str-small'] === CLIMATE_LEVY_FROM_2025.small);
ok('η μονοκατοικία άνω των 80 είναι το CLIMATE_LEVY_FROM_2025.large, όχι αντίγραφο', by['str-house-large'] === CLIMATE_LEVY_FROM_2025.large);
const pin = (id: string, high: number, low: number) =>
  ok(`${id}: ${high} / ${low}`, by[id].high === high && by[id].low === low);
pin('str-small', 8, 2);
pin('str-house-large', 15, 4);
pin('tourist-small', 8, 2);
pin('tourist-large', 15, 4);
pin('tourist-villa', 15, 4);
pin('furnished-rooms', 2, 0.5);
ok('υψηλή περίοδος πάντα πάνω από τη χαμηλή', CLIMATE_LEVY_CATEGORIES.every(c => c.rates.high > c.rates.low));

// ── Το κατώφλι των 80 τ.μ. είναι αυτό που χρεώνει η μηχανή ────────────────
ok('κατώφλι 80 τ.μ.', CLIMATE_LEVY_AREA_SQM === 80);
ok('μονοκατοικία ακριβώς στο κατώφλι: μικρό κλιμάκιο (>80, όχι ≥80)',
  climateLevyRates(CLIMATE_LEVY_AREA_SQM, true) === CLIMATE_LEVY_FROM_2025.small);
ok('μονοκατοικία ένα τ.μ. πάνω: μεγάλο κλιμάκιο',
  climateLevyRates(CLIMATE_LEVY_AREA_SQM + 1, true) === CLIMATE_LEVY_FROM_2025.large);
ok('διαμέρισμα πάνω από το κατώφλι: μικρό κλιμάκιο',
  climateLevyRates(CLIMATE_LEVY_AREA_SQM * 2, false) === CLIMATE_LEVY_FROM_2025.small);

// ── Τέλος παρεπιδημούντων ──────────────────────────────────────────────────
ok('παρεπιδημούντων 0,5% βασικό', MUNICIPAL_ACCOM_TAX_RATE === 0.005);
ok('παρεπιδημούντων έως 0,75%', MUNICIPAL_ACCOM_TAX_MAX_RATE === 0.0075);
ok('το ανώτατο πάνω από το βασικό', MUNICIPAL_ACCOM_TAX_MAX_RATE > MUNICIPAL_ACCOM_TAX_RATE);

// ── Προθεσμία δήλωσης απόδοσης ─────────────────────────────────────────────
ok('στοιχεία Οκτωβρίου: έως 30/11', levyReturnDeadline(2026, 9) === '2026-11-30');
ok('στοιχεία Νοεμβρίου: έως 31/12', levyReturnDeadline(2026, 10) === '2026-12-31');
ok('στοιχεία Δεκεμβρίου: έως 31/01 του επόμενου έτους', levyReturnDeadline(2026, 11) === '2027-01-31');
ok('στοιχεία Ιανουαρίου 2028: έως 29/02 (δίσεκτο)', levyReturnDeadline(2028, 0) === '2028-02-29');
// Το φορολογικό ημερολόγιο της εφαρμογής βάζει την απόδοση στην τελευταία
// εργάσιμη· το 2026 συμπίπτει με την τελευταία ημέρα για τους δύο μήνες του
// παραδείγματος, οπότε ο οδηγός και το ημερολόγιο λένε το ίδιο.
ok('ημερολόγιο Νοεμβρίου 2026 = 30/11', lastWorkingDayOfMonth(2026, 10) === levyReturnDeadline(2026, 9));
ok('ημερολόγιο Δεκεμβρίου 2026 = 31/12', lastWorkingDayOfMonth(2026, 11) === levyReturnDeadline(2026, 10));

// ── Διαμονή που περνά από Οκτώβριο σε Νοέμβριο ───────────────────────────
{
  const apt = levyByMonth('2026-10-28', '2026-11-05', 100, false);
  ok('δύο μήνες, ένα στοιχείο ο καθένας', apt.length === 2);
  ok('οι νύχτες αθροίζουν όσες το nightsBetween', apt.reduce((s, m) => s + m.nights, 0) === nightsBetween('2026-10-28', '2026-11-05'));
  ok('Οκτώβριος: 28 έως 31, 4 νύχτες', apt[0].month0 === 9 && apt[0].firstNight === 28 && apt[0].lastNight === 31 && apt[0].nights === 4);
  ok('Νοέμβριος: 1 έως 4, 4 νύχτες', apt[1].month0 === 10 && apt[1].firstNight === 1 && apt[1].lastNight === 4 && apt[1].nights === 4);
  ok('διαμέρισμα 4 × 8 = 32', apt[0].rate === 8 && apt[0].levy === 32);
  ok('διαμέρισμα 4 × 2 = 8', apt[1].rate === 2 && apt[1].levy === 8);
  const house = levyByMonth('2026-10-28', '2026-11-05', 100, true);
  ok('μονοκατοικία 4 × 15 = 60', house[0].rate === 15 && house[0].levy === 60);
  ok('μονοκατοικία 4 × 4 = 16', house[1].rate === 4 && house[1].levy === 16);
  ok('διαμονή που αλλάζει χρονιά: δύο μήνες σε δύο έτη',
    levyByMonth('2026-12-30', '2027-01-02').map(m => `${m.year}-${m.month0}:${m.nights}`).join() === '2026-11:2,2027-0:1');
  ok('αναχώρηση την ημέρα της άφιξης: καμία νύχτα', levyByMonth('2026-10-28', '2026-10-28').length === 0);
}

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\nclimateLevyCategories.ts — ${passed} passed, ${failed} failed (σύνολο ${passed + failed})`);
if (failed) { console.log('FAILED:\n' + fails.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
console.log('όλα πέρασαν');
