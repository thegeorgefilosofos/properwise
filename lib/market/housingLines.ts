// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΕΠΙΤΟΚΙΑ ΣΤΕΓΑΣΤΙΚΩΝ ΟΠΩΣ ΤΑ ΜΑΘΑΙΝΕΙ Η ΝΟΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ (18/10/2026). Η Νόα διάβαζε τη στήλη `bog_housing_new` του
// market_rates και την έλεγε «Μέσο επιτόκιο νέου στεγαστικού δανείου… περίπου
// 3,39%». Η στήλη κρατούσε την τιμή της σειράς F (κυμαινόμενο ή σταθερό έως 1
// έτος), όχι τον μέσο όρο. Η δημόσια σελίδα την απέρριπτε ήδη, γιατί περνά από
// την ταυτότητα της τιμής· η Νόα δεν περνούσε.
//
// Εδώ κάθε γραμμή βγαίνει από την ταυτότητα και ΜΟΝΟ από σειρά του καταλόγου
// του lib/market/ecb.ts, με την ετικέτα του καταλόγου, τον μήνα και την πηγή
// της. Τιμή άλλης σειράς δεν δίνεται με αυτό το όνομα.
// ═══════════════════════════════════════════════════════════════════════════
import { catalogEntry, ECB_SERIES, isStale, type MarketKey, type Provenance } from '@/lib/market/ecb'
import { monthNom } from '@/lib/core/months'
import { fp } from '@/lib/core/format'

/** Με τη σειρά που τα γράφει και η δημόσια σελίδα του στεγαστικού. */
const HOUSING: readonly MarketKey[] = ['bog_housing_new', 'bog_housing_floating', 'bog_housing_fixed']

const lowerFirst = (s: string): string => s.charAt(0).toLocaleLowerCase('el') + s.slice(1)

/**
 * Μία γραμμή ανά επιτόκιο στεγαστικού που έχει ταυτότητα από τη σειρά του.
 * Κενή λίστα όταν δεν υπάρχει καμία: η Νόα τότε δεν λέει νούμερο.
 */
export function housingLines(p: Provenance | null | undefined, today: string): string[] {
  return HOUSING.flatMap(key => {
    const v = catalogEntry(p, key)
    const spec = ECB_SERIES.find(s => s.key === key)
    const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(v?.asOf ?? '')
    if (!v || !spec || !m) return []
    const name = key === 'bog_housing_new' ? `${spec.label} στην Ελλάδα` : `Νέα στεγαστικά στην Ελλάδα, ${lowerFirst(spec.label)}`
    const stale = isStale(key, v.asOf, today) ? ', η πηγή δεν έχει δώσει νεότερη τιμή' : ''
    return [`${name}: ${fp(v.value)} (${monthNom(Number(m[2]) - 1)} ${m[1]}, ${v.basis}, πηγή ${v.source}${stale}).`]
  })
}
