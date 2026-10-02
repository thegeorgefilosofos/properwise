// ═══════════════════════════════════════════════════════════════════════════
// Ο ΟΡΙΖΟΝΤΑΣ ΤΟΥ ΟΔΗΓΟΥ ΠΡΟΘΕΣΜΙΩΝ, χωρίς React ώστε να ελέγχεται κάθε μέρα.
//
// ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΚΛΕΙΝΕΙ (02.10.2026). Το παράθυρο ήταν [σήμερα, ίδια μέρα του
// επόμενου έτους) και το `nextOf` ΠΕΤΟΥΣΕ σφάλμα όταν ένα είδος έλειπε. Λείπει
// όταν η φετινή εμφάνιση μόλις πέρασε και η επόμενη μετατίθεται σε εργάσιμη
// λίγες μέρες μετά το όριο: στις 27 και 28.2.2027 το Ε9 του 2028 πέφτει στις
// 29.2.2028, στις 16 και 17.3.2030 η έκδοση ΕΝΦΙΑ του 2031 πέφτει Δευτέρα 17.3.
// Η σελίδα είναι στατική με `revalidate`, οπότε το σφάλμα έριχνε την ανακατασκευή
// της σελίδας εκείνες τις μέρες.
//
// Τώρα το όριο είναι κλειστό με περιθώριο μίας εβδομάδας (καλύπτει κάθε
// μετάθεση σε εργάσιμη) και η αναζήτηση είδους, αν δεν το βρει στον πίνακα,
// πηγαίνει στα επόμενα έτη της ίδιας μηχανής. Δεν πετάει ποτέ.
// ═══════════════════════════════════════════════════════════════════════════
import { greekPropertyTaxObligations, type TaxObligation } from '@/lib/tax/greekTaxCalendar'

/** Πόσες μέρες πέρα από τον δωδεκάμηνο δεχόμαστε, για τις μεταθέσεις σε εργάσιμη. */
const MARGIN_DAYS = 7

function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/**
 * ΟΙ ΕΠΟΜΕΝΟΙ ΔΩΔΕΚΑ ΜΗΝΕΣ, ΑΠΟ ΣΗΜΕΡΑ. Οι ετήσιες υποχρεώσεις του ιδιοκτήτη
 * (προφίλ `owner`, κοινές σε ιδιοκατοίκηση, μακροχρόνια και βραχυχρόνια) από
 * σήμερα ως την ίδια μέρα του επόμενου έτους. Οι μηνιαίες της βραχυχρόνιας δεν
 * μπαίνουν εδώ ως 24 γραμμές: περιγράφονται μία φορά, στη δική τους ενότητα.
 *
 * Το περιθώριο δέχεται ΜΟΝΟ είδος που δεν υπάρχει ήδη στο δωδεκάμηνο, ώστε ο
 * πίνακας να μη δείχνει το ίδιο Ε9 δύο φορές.
 */
export function upcomingRows(today: string): TaxObligation[] {
  const year = Number(today.slice(0, 4))
  const yearOn = addDaysISO(`${year + 1}${today.slice(4)}`, 0)
  const until = addDaysISO(yearOn, MARGIN_DAYS)
  const all = [
    ...greekPropertyTaxObligations(year - 1, 'owner'),
    ...greekPropertyTaxObligations(year, 'owner'),
    ...greekPropertyTaxObligations(year + 1, 'owner'),
  ].sort((a, b) => a.date.localeCompare(b.date))
  const base = all.filter(o => o.date >= today && o.date < yearOn)
  const have = new Set(base.map(o => o.kind))
  const extra = all.filter(o => o.date >= yearOn && o.date <= until && !have.has(o.kind))
  return [...base, ...extra]
}

/**
 * Η πρώτη επερχόμενη εμφάνιση του είδους: από τον πίνακα αν είναι εκεί, αλλιώς
 * από τα επόμενα έτη της μηχανής. Κάθε έτος έχει όλα τα είδη του ιδιοκτήτη,
 * οπότε η τελευταία γραμμή είναι δίχτυ για τον τύπο, όχι για τα δεδομένα.
 */
export function nextOfKind(rows: readonly TaxObligation[], kind: TaxObligation['kind'], today: string): TaxObligation {
  const inRows = rows.find(r => r.kind === kind)
  if (inRows) return inRows
  const year = Number(today.slice(0, 4))
  const later = [year, year + 1, year + 2]
    .flatMap(y => greekPropertyTaxObligations(y, 'owner'))
    .filter(o => o.kind === kind)
    .sort((a, b) => a.date.localeCompare(b.date))
  return later.find(o => o.date >= today) ?? later[later.length - 1]
}
