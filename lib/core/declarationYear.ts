// ═══════════════════════════════════════════════════════════════════════════
// Η ΧΡΟΝΙΑ ΕΙΣΟΔΗΜΑΤΟΣ ΠΟΥ ΜΕΤΡΑ ΣΗΜΕΡΑ
// ─────────────────────────────────────────────────────────────────────────
// Τα εισοδήματα μιας χρονιάς δηλώνονται την επόμενη και η προθεσμία κλείνει τον
// Ιούλιο (lib/tax/greekTaxCalendar.ts). Από τον Ιανουάριο ως τον Ιούλιο η
// ερώτηση που μετρά είναι η ΠΕΡΣΙΝΗ χρήση, που δηλώνεται τώρα· από τον
// Αύγουστο η τρέχουσα.
//
// ΓΙΑΤΙ ΕΙΝΑΙ ΕΔΩ (02.10.2026). Ο κανόνας ζούσε μόνο στον δημόσιο υπολογιστή
// φόρου ενοικίων (`FILING_CLOSED_FROM_MONTH = 8`). Η Λογιστική άνοιγε πάντα στο
// τρέχον έτος, οπότε τον Μάρτιο ο ιδιοκτήτης που ετοίμαζε το Ε2 έβλεπε τη
// χρήση με τρεις μήνες δεδομένων αντί για εκείνη που δηλώνει. Και ο
// υπολογιστής είχε καρφωμένα τα έτη ['2025', '2026']: με `etos=2027` έπεφτε
// σιωπηλά στην κλίμακα του 2025.
// ═══════════════════════════════════════════════════════════════════════════

/** Ο πρώτος μήνας (1 ως 12) μετά το κλείσιμο της δήλωσης εισοδήματος. */
export const FILING_CLOSED_FROM_MONTH = 8

const partsOf = (today: string) => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) })

/** Η χρήση που αφορά σήμερα τον ιδιοκτήτη: η περσινή ως τον Ιούλιο, η τρέχουσα μετά. */
export function declarationYear(today: string): number {
  const { y, m } = partsOf(today)
  return m >= FILING_CLOSED_FROM_MONTH ? y : y - 1
}

/**
 * Οι χρήσεις που προσφέρει ένας υπολογιστής σήμερα: η περσινή (δηλώνεται
 * φέτος ή δηλώθηκε) και η τρέχουσα. Ποτέ πριν από το `firstYear`, δηλαδή την
 * πρώτη χρονιά με τεκμηριωμένη κλίμακα.
 */
export function offeredIncomeYears(today: string, firstYear: number): number[] {
  const { y } = partsOf(today)
  const out = [y - 1, y].filter(x => x >= firstYear)
  return out.length ? out : [firstYear]
}

/** Μια χρονιά από τη διεύθυνση ή από τον χρήστη, κλειδωμένη μέσα στις διαθέσιμες. */
function clampYear(want: number, years: readonly number[]): number {
  const first = years[0], last = years[years.length - 1]
  if (!Number.isFinite(want)) return last
  return Math.min(last, Math.max(first, Math.trunc(want)))
}

/**
 * Η χρονιά που ισχύει για ένα `etos` της διεύθυνσης: τέσσερα ψηφία κλειδωμένα
 * μέσα στις προσφερόμενες, αλλιώς η χρονιά της δήλωσης. Μόνο πρωτογενείς τιμές
 * μέσα και έξω, ώστε η οθόνη να μη χρειάζεται να κρατά τον πίνακα των ετών.
 */
export function incomeYearFor(etos: string, today: string, firstYear: number): number {
  const years = offeredIncomeYears(today, firstYear)
  return clampYear(/^\d{4}$/.test(etos) ? Number(etos) : declarationYear(today), years)
}
