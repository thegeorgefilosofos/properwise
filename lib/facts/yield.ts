// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΠΟΔΟΣΗ: ΜΙΑ ΣΥΝΑΡΤΗΣΗ, Η ΒΑΣΗ ΓΡΑΦΕΤΑΙ ΠΑΝΤΑ
// ─────────────────────────────────────────────────────────────────────────
// Δύο συναρτήσεις έκαναν την ίδια διαίρεση: `computeYields`
// (lib/billing/propertyFacts.ts, Επισκόπηση, Σύγκριση) και `yields`
// (lib/market/returns.ts, Αποδόσεις). Η πρώτη έβγαζε την καθαρή ΠΡΟ φόρου, η
// δεύτερη και ΜΕΤΑ φόρου· οι οθόνες έγραφαν και τις δύο «Καθαρή απόδοση»:
// δύο διαφορετικά ποσοστά για το ίδιο ακίνητο με το ίδιο όνομα.
//
// Τώρα ο τύπος ζει εδώ και οι δύο παλιές συναρτήσεις τον καλούν. Η ετικέτα
// βγαίνει από το `basis` (YIELD_LABELS): «προ φόρου» ή «μετά φόρου», πάντα.
// ═══════════════════════════════════════════════════════════════════════════
export interface YieldInput {
  /** Ετήσια έσοδα (ενοίκια ή ακαθάριστο φιλοξενίας). */
  annualIncome: number;
  /** Αξία ακινήτου. */
  value: number;
  /** Ετήσιες δαπάνες λειτουργίας (lib/facts/expenses: `total`). */
  annualExpenses: number;
  /** Ετήσιος φόρος εισοδήματος που αναλογεί· χωρίς αυτόν δεν υπάρχει «μετά φόρου». */
  annualTax?: number | null;
}

export interface PropertyYield {
  /** Ποσοστά, χωρίς στρογγυλοποίηση· 0 όταν λείπει η αξία. */
  gross: number;
  net_pre_tax: number;
  /** `null` όταν δεν δόθηκε φόρος: δεν επινοούμε μηδενικό φόρο. */
  net_after_tax: number | null;
}

const fin = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);
const pos = (n: unknown): number => Math.max(0, fin(n));

export function propertyYield(i: YieldInput): PropertyYield {
  const value = pos(i.value);
  const income = pos(i.annualIncome);
  const exp = pos(i.annualExpenses);
  const pct = (x: number) => (value > 0 ? (x / value) * 100 : 0);
  return {
    gross: pct(income),
    net_pre_tax: pct(income - exp),
    net_after_tax: i.annualTax == null ? null : pct(income - exp - pos(i.annualTax)),
  };
}
