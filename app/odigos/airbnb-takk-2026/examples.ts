// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΠΑΡΑΔΕΙΓΜΑΤΑ ΤΟΥ ΟΔΗΓΟΥ AIRBNB, ΥΠΟΛΟΓΙΣΜΕΝΑ
// ─────────────────────────────────────────────────────────────────────────
// Η σελίδα γράφει μόνο τα ΔΕΔΟΜΕΝΑ κάθε παραδείγματος (νύχτες, ημερομηνίες,
// μίσθωμα). Κάθε ποσό που προκύπτει βγαίνει από τις συναρτήσεις της μηχανής:
// το τέλος από το `climateLevyForNights`/`levyByMonth`, ο φόρος από το
// `rentalIncomeTax` με την κλίμακα του έτους και η έκπτωση από το
// PRESUMPTIVE_DEDUCTION_RATE. Η δοκιμή (examples.test.ts) καρφώνει τα ποσά
// του εγκεκριμένου κειμένου (05.10.2026): 32 + 8 = 40, 60 + 16 = 76,
// 720 + 60 = 780, 1.470 και 12.000 · 11.400 · 1.710.
// ═══════════════════════════════════════════════════════════════════════════
import {
  climateLevyRates, rentalIncomeTax, rentalBracketsForYear, marginalRate, FIRST_YEAR_NEW_BRACKETS,
} from '@/lib/billing/greekTax';
import { PRESUMPTIVE_DEDUCTION_RATE } from '@/lib/billing/presumptive';
import { levyByMonth } from '@/lib/billing/climateLevyCategories';

/** «Διαμέρισμα 100 τ.μ. ή μονοκατοικία 100 τ.μ.»: το ίδιο εμβαδόν, άλλο ποσό. */
export const EXAMPLE_SQM = 100;

/** Τα δύο ακίνητα των παραδειγμάτων, με τα ποσά που τους χρεώνει η μηχανή. */
export const APARTMENT = climateLevyRates(EXAMPLE_SQM, false);
export const LARGE_HOUSE = climateLevyRates(EXAMPLE_SQM, true);

// ── Κράτηση από Οκτώβριο σε Νοέμβριο ────────────────────────────────────────
// Άφιξη 28/10, αναχώρηση 05/11: τέσσερις νύχτες σε κάθε μήνα, δύο ειδικά
// στοιχεία, δύο μηνιαίες δηλώσεις.
export const SPLIT_STAY = { arrival: '2026-10-28', departure: '2026-11-05' } as const;

const splitOf = (sqm: number, isHouse: boolean) => {
  const months = levyByMonth(SPLIT_STAY.arrival, SPLIT_STAY.departure, sqm, isHouse);
  return { months, total: months.reduce((s, m) => s + m.levy, 0) };
};
export const SPLIT_APARTMENT = splitOf(EXAMPLE_SQM, false);
export const SPLIT_LARGE_HOUSE = splitOf(EXAMPLE_SQM, true);

// ── Μια χρονιά ──────────────────────────────────────────────────────────────
export const YEAR_NIGHTS = { high: 90, low: 30 } as const;
export const yearLevy = (r: { high: number; low: number }) => ({
  high: YEAR_NIGHTS.high * r.high,
  low: YEAR_NIGHTS.low * r.low,
  total: YEAR_NIGHTS.high * r.high + YEAR_NIGHTS.low * r.low,
});

// ── Φόρος εισοδήματος ───────────────────────────────────────────────────────
// Φυσικό πρόσωπο, έως δύο ακίνητα, χωρίς υπηρεσίες, μόνο εισόδημα από ακίνητα.
const INCOME_GROSS = 12_000;
const INCOME_TAXABLE = INCOME_GROSS * (1 - PRESUMPTIVE_DEDUCTION_RATE);
export const INCOME_EXAMPLE = {
  year: FIRST_YEAR_NEW_BRACKETS,
  gross: INCOME_GROSS,
  taxable: INCOME_TAXABLE,
  rate: marginalRate(INCOME_TAXABLE, rentalBracketsForYear(FIRST_YEAR_NEW_BRACKETS)),
  tax: rentalIncomeTax(INCOME_TAXABLE, rentalBracketsForYear(FIRST_YEAR_NEW_BRACKETS)),
} as const;
