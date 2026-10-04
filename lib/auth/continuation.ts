// ═══════════════════════════════════════════════════════════════════════════
// ΠΟΥ ΣΥΝΕΧΙΖΕΙ ΚΑΝΕΙΣ ΜΟΛΙΣ ΜΠΕΙ
// ──────────────────────────────────────────────────────────────────────
// ΤΙ ΕΣΠΑΓΕ. Ο χώρος του λογιστή στέλνει τον ασύνδετο στο
// «/login?next=/accountant/workspace». Η σύνδεση διάβαζε μόνο «plan» και
// «cycle», οπότε το «next» χανόταν και ο λογιστής κατέληγε στον πίνακα του
// ιδιοκτήτη. Το ίδιο και σε κάθε άλλο βήμα: ο σύνδεσμος προς την εγγραφή, η
// επιστροφή από την Google, ο σύνδεσμος του email και το «Έχεις ήδη
// συνδεθεί» έγραφαν ο καθένας τον δικό του προορισμό, ο καθένας με άλλα κενά.
//
// Τώρα ο προορισμός βγαίνει ΜΟΝΟ εδώ, με μία σειρά:
//   1. έγκυρο πακέτο → το ταμείο, με το πακέτο και τον κύκλο του·
//   2. αλλιώς «next», ΜΟΝΟ αν το δέχεται το `safeNext` (lib/auth/redirect.ts)·
//   3. αλλιώς ο πίνακας.
//
// ── ΔΥΟ ΑΠΑΓΟΡΕΥΣΕΙΣ ΠΑΝΩ ΑΠΟ ΤΟ `safeNext` ─────────────────────────────
// · Η αποκωδικοποίηση γίνεται μία φορά ακόμη και ελέγχεται κι αυτή. Το
//   «/%2F%2Fkako.gr» είναι σήμερα αθώα διαδρομή, αλλά όποιος το
//   αποκωδικοποιήσει ξανά κάτω από εμάς βρίσκει «//kako.gr».
// · Οι σελίδες εισόδου δεν είναι προορισμός: «next=/login» θα ξανάνοιγε τη
//   φόρμα πάνω από ήδη συνδεδεμένο χρήστη.
//
// ΚΑΙ ΤΙ ΤΑΞΙΔΕΥΕΙ. Οι σύνδεσμοι ανάμεσα σε σύνδεση και εγγραφή και η
// επιστροφή από την Google κουβαλούν ΜΟΝΟ τη συνέχεια (`carried`): ποτέ
// «code», διακριτικό ή οτιδήποτε άλλο έτυχε να βρίσκεται στη διεύθυνση.
// ═══════════════════════════════════════════════════════════════════════════
import { safeNext, HOME } from './redirect'
import { planFromParam, cycleFromParam, checkoutLanding } from '../billing/entitlements'

type Source = URLSearchParams | string

const params = (src: Source) => (typeof src === 'string' ? new URLSearchParams(src) : src)

/** Οι σελίδες της εισόδου. Προορισμός εκεί θα ξανάνοιγε τη φόρμα. */
const AUTH_PAGES = ['/login', '/signup', '/auth']

/** Το «next» αν είναι δικό μας και όχι σελίδα εισόδου, αλλιώς κενό. */
function ownNext(raw: string | null): string {
  const v = safeNext(raw, '')
  if (!v) return ''
  let once: string
  try { once = decodeURIComponent(v) } catch { return '' }
  if (safeNext(once, '') !== once.trim()) return ''
  const path = v.split(/[?#]/)[0]
  if (AUTH_PAGES.some(p => path === p || path.startsWith(p + '/'))) return ''
  return v
}

/** Πού πηγαίνει ο χρήστης μόλις ολοκληρωθεί η είσοδος (και το δεύτερο βήμα). */
export function continuation(src: Source): string {
  const q = params(src)
  const plan = planFromParam(q.get('plan'))
  if (plan) return checkoutLanding(plan, cycleFromParam(q.get('cycle')))
  return ownNext(q.get('next')) || HOME
}

/**
 * Η συνέχεια ως «?…» για τον επόμενο σταθμό (σύνδεση ↔ εγγραφή, Google).
 * Κενό όταν δεν υπάρχει τίποτα να κουβαληθεί.
 */
export function carried(src: Source): string {
  const q = params(src)
  const out = new URLSearchParams()
  const plan = planFromParam(q.get('plan'))
  if (plan) {
    out.set('plan', plan)
    out.set('cycle', cycleFromParam(q.get('cycle')))
  } else {
    const next = ownNext(q.get('next'))
    if (next) out.set('next', next)
  }
  const s = out.toString()
  return s ? `?${s}` : ''
}

/** Παράμετροι που δεν ταξιδεύουν ποτέ μέσα σε «next»: διακριτικά και σφάλματα του παρόχου. */
const NEVER_CARRIED = /code|token|secret|password|^error/i

/**
 * Η ΔΙΕΥΘΥΝΣΗ ΤΗΣ ΣΥΝΔΕΣΗΣ ΟΤΑΝ Ο ΔΙΑΜΕΣΟΛΑΒΗΤΗΣ ΚΛΕΙΝΕΙ ΤΗΝ ΠΟΡΤΑ.
 *
 * Ο διαμεσολαβητής (proxy.ts) άλλαζε μόνο τη διαδρομή σε «/login» και κρατούσε
 * την αναζήτηση όπως ήταν: η σελίδα που ζητήθηκε χανόταν και ό,τι έτυχε να
 * είναι στη διεύθυνση («code» μαζί) περνούσε στη σύνδεση. Τώρα η αναζήτηση
 * γράφεται από την αρχή: πακέτο και κύκλος αν είναι έγκυρα, αλλιώς «next» με
 * τη διαδρομή που ζητήθηκε, χωρίς διακριτικά και με τους ίδιους ελέγχους.
 * Ο σκέτος πίνακας δεν χρειάζεται «next»: είναι ήδη ο προορισμός.
 */
export function loginSearch(pathname: string, search: string): string {
  const original = new URLSearchParams(search)
  const kept = new URLSearchParams()
  original.forEach((v, k) => { if (!NEVER_CARRIED.test(k)) kept.append(k, v) })
  const q = new URLSearchParams()
  for (const k of ['plan', 'cycle']) { const v = original.get(k); if (v) q.set(k, v) }
  if (pathname !== HOME) {
    const rest = kept.toString()
    q.set('next', rest ? `${pathname}?${rest}` : pathname)
  }
  return carried(q)
}
