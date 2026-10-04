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
// · Η διαδρομή κρίνεται ΑΦΟΥ λυθούν τα «.» και «..». Το «/.//kako.gr» περνά
//   το `safeNext` (δεύτερος χαρακτήρας τελεία) και ο περιηγητής το κάνει
//   «//kako.gr». Το «/dashboard/../login» είναι στην ουσία σελίδα εισόδου.
//   Επιστρέφεται η ΛΥΜΕΝΗ μορφή, ώστε κανείς παρακάτω να μην τη λύσει αλλιώς.
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

/** Ψεύτικη αφετηρία μόνο για να λυθεί η διαδρομή· δεν βγαίνει ποτέ προς τα έξω. */
const BASE = 'http://n'

/** Η διαδρομή λυμένη όπως θα τη λύσει ο περιηγητής, ή κενό αν φεύγει από εμάς. */
function resolved(v: string): string {
  if (safeNext(v, '') !== v.trim()) return ''
  let u: URL
  try { u = new URL(v, BASE) } catch { return '' }
  if (u.origin !== BASE || u.pathname.startsWith('//')) return ''
  if (AUTH_PAGES.some(p => u.pathname === p || u.pathname.startsWith(p + '/'))) return ''
  return u.pathname + u.search + u.hash
}

/** Το «next» αν είναι δικό μας και όχι σελίδα εισόδου, αλλιώς κενό. */
function ownNext(raw: string | null): string {
  const v = safeNext(raw, '')
  if (!v) return ''
  // Και η μορφή μετά από ΜΙΑ ακόμη αποκωδικοποίηση περνά τους ίδιους ελέγχους.
  let once: string
  try { once = decodeURIComponent(v) } catch { return '' }
  if (!resolved(once)) return ''
  return resolved(v)
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

/**
 * ΟΙ ΜΟΝΕΣ ΠΑΡΑΜΕΤΡΟΙ ΠΟΥ ΤΑΞΙΔΕΥΟΥΝ ΜΕΣΑ ΣΕ «next». Επιτρεπτές, όχι
 * απαγορευμένες: ένας κατάλογος απαγορεύσεων ξεχνά πάντα το επόμενο όνομα
 * διακριτικού («state», «session_id», «jwt», «sig»…). Ο πίνακας διαβάζει από
 * τη διεύθυνση μόνο «tab» και «action» (lib/nav/history.ts readLaunchShortcut)
 * και αυτές είναι οι παράμετροι των πραγματικών συνδέσμων: το ημερολόγιο, ο
 * χώρος του λογιστή και οι συντομεύσεις του manifest. Το «checkout=ok» μένει
 * έξω: δεν το διαβάζει κανείς και μια πληρωμή δεν «ξαναγίνεται» μετά τη σύνδεση.
 */
const CARRIED_KEYS = ['tab', 'action']

/**
 * Η ΔΙΕΥΘΥΝΣΗ ΤΗΣ ΣΥΝΔΕΣΗΣ ΟΤΑΝ Ο ΔΙΑΜΕΣΟΛΑΒΗΤΗΣ ΚΛΕΙΝΕΙ ΤΗΝ ΠΟΡΤΑ.
 *
 * Ο διαμεσολαβητής (proxy.ts) άλλαζε μόνο τη διαδρομή σε «/login» και κρατούσε
 * την αναζήτηση όπως ήταν: η σελίδα που ζητήθηκε χανόταν και ό,τι έτυχε να
 * είναι στη διεύθυνση («code» μαζί) περνούσε στη σύνδεση. Τώρα η αναζήτηση
 * γράφεται από την αρχή: πακέτο και κύκλος αν είναι έγκυρα, αλλιώς «next» με
 * τη διαδρομή που ζητήθηκε και ΜΟΝΟ τις παραμέτρους του `CARRIED_KEYS`, με
 * τους ίδιους ελέγχους. Ο πίνακας χωρίς καμία από αυτές δεν χρειάζεται «next»:
 * είναι ήδη ο προορισμός. Με «?tab=calendar» όμως χρειάζεται, αλλιώς ο
 * σύνδεσμος του ημερολογίου άνοιγε την αρχική καρτέλα.
 */
export function loginSearch(pathname: string, search: string): string {
  const original = new URLSearchParams(search)
  const kept = new URLSearchParams()
  for (const k of CARRIED_KEYS) { const v = original.get(k); if (v !== null) kept.set(k, v) }
  const rest = kept.toString()
  const q = new URLSearchParams()
  for (const k of ['plan', 'cycle']) { const v = original.get(k); if (v) q.set(k, v) }
  if (pathname !== HOME || rest) q.set('next', rest ? `${pathname}?${rest}` : pathname)
  return carried(q)
}
