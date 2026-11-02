// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΕΝΑ ΣΗΜΕΙΟ ΜΟΡΦΟΠΟΙΗΣΗΣ ΤΗΣ ΠΛΕΥΡΑΣ DENO
// ─────────────────────────────────────────────────────────────────────────
// Οι συναρτήσεις edge τρέχουν σε Deno και ΔΕΝ μπορούν να εισάγουν το
// lib/core/format.ts της εφαρμογής (άλλο runtime, άλλα aliases). Οπότε κάθε
// μία είχε γράψει τη δική της: πέντε αντίγραφα, με τέσσερις διαφορές.
//
//   send-monthly-statements   «450,00€»   με απλό κενό
//   send-reminders            «450,00€»   μέσω style:'currency', σε τρία σημεία
//   send-market-digest        «3,50%»      και «—» όταν λείπει τιμή
//   _shared/emailCopy         «450,00€»   με απλό κενό
//
// Το ίδιο ποσό έφευγε σε τρία email με τρεις διαδρομές. Εδώ γράφεται μία φορά,
// με τους ΙΔΙΟΥΣ κανόνες με την οθόνη (lib/core/format.ts): δύο δεκαδικά πάντα
// και το ευρώ κολλητά στον αριθμό, χωρίς κενό («1.234,50€»).
// ═══════════════════════════════════════════════════════════════════════════
const LOCALE = 'el-GR'
const TWO = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const
const UPTO2 = { maximumFractionDigits: 2 } as const
const num = (n: unknown): number => (typeof n === 'number' && isFinite(n) ? n : Number(n) || 0)

/** `eur(1234.5)` → «1.234,50€», χωρίς κενό πριν το ευρώ. */
export const eur = (n: unknown): string => `${num(n).toLocaleString(LOCALE, TWO)}€`

/** `pct(3.5)` → «3,50%». */
export const pct = (n: unknown): string => `${num(n).toLocaleString(LOCALE, TWO)}%`

/**
 * Ποσοστό που ΔΕΝ είναι αποτέλεσμα στήλης (πληρότητα, μερίδιο): `pctRate(72.5)` →
 * «72,5%», `pctRate(50)` → «50%». Το ίδιο με το `fpRate` της οθόνης. Χωρίς αυτό
 * το email έγραφε `String(72.5)` → «72.5%», με τελεία.
 */
export const pctRate = (n: unknown): string => `${num(n).toLocaleString(LOCALE, UPTO2)}%`

/**
 * «14/08/2026» από ISO ημερομηνία ή σφραγίδα χρόνου, όπως το `grDate` της οθόνης.
 * Το `new Date(iso).toLocaleDateString('el-GR')` έγραφε «14/8/2026», χωρίς το
 * μηδενικό· σε ζώνη δυτικά του UTC έγραφε και την προηγούμενη ημέρα.
 */
export const grDate = (iso: string | null | undefined): string => {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso ?? '')
}

/** Πλήθος με ελληνικούς χωριστές χιλιάδων, χωρίς δεκαδικά. */
export const cnt = (n: unknown): string => Math.round(num(n)).toLocaleString(LOCALE)
