// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΣΑΡΩΜΕΝΑ ΠΡΟΣΧΕΔΙΑ ΤΟΥ ΦΑΚΕΛΟΥ ΖΟΥΝ ΠΑΝΩ ΑΠΟ ΤΗΝ ΚΑΡΤΕΛΑ.
//
// Ζούσαν σε `useState` του TabDocuments και η καρτέλα ξαναστήνεται σε κάθε
// αλλαγή καρτέλας ή ακινήτου (`key={selected.id}` στο page.tsx). Ενα πάτημα
// στο Ημερολόγιο έσβηνε σαρώσεις που είχαν ήδη μετρήσει στο όριο του μήνα.
//
// Εδώ κρατιούνται ανά χρήστη και ακίνητο (`userId:propertyId`), στη μνήμη της
// σελίδας: επιβιώνουν από αλλαγή καρτέλας και ακινήτου, ΟΧΙ από ανανέωση.
//
// Η ΕΝΗΜΕΡΩΣΗ ΓΡΑΦΕΙ ΣΤΟ ΚΑΤΑΣΤΗΜΑ, ΟΧΙ ΣΤΟ ΣΤΙΓΜΙΟΤΥΠΟ. Η σάρωση παρτίδας
// τρέχει ασύγχρονα· αν ο χρήστης φύγει στη μέση, τα αποτελέσματα που έρχονται
// μετά γράφονται κανονικά και τα βρίσκει όταν γυρίσει.
//
// ΕΝΑΣ ΦΥΛΑΚΑΣ ΑΝΑΝΕΩΣΗΣ, ΟΧΙ ΕΝΑΣ ΑΝΑ ΚΑΡΤΕΛΑ. Η ερώτηση του περιηγητή πριν
// από ανανέωση ή κλείσιμο ζει εδώ και ισχύει όσο ΟΠΟΙΟΔΗΠΟΤΕ κλειδί έχει μη
// αποθηκευμένα· και όταν η καρτέλα του Φακέλου δεν είναι ανοιχτή.
//
// ΚΑΙ ΔΕΝ ΜΠΛΟΚΑΡΕΙ ΠΟΤΕ ΤΗΝ ΑΠΟΣΥΝΔΕΣΗ. Κάθε σκληρή πλοήγηση της εφαρμογής
// (αποσύνδεση, διαγραφή λογαριασμού, χαμένη συνεδρία) περνά από το
// `hardNavigate`, που πρώτα καλεί το `releaseAllKept`: τα προσχέδια σβήνουν και
// ο φύλακας φεύγει ΠΡΙΝ από την πλοήγηση. Αλλιώς ένα «Ακύρωση» στην ερώτηση
// άφηνε ονόματα και ποσά στην οθόνη χωρίς συνεδρία από πίσω.
// ═══════════════════════════════════════════════════════════════════════════
import { onHardNavigate } from '@/lib/core/navigate'

type Listener = () => void

export interface KeptStore<T> {
  get(key: string): T[]
  set(key: string, next: T[] | ((prev: T[]) => T[])): void
  subscribe(key: string, fn: Listener): () => void
  /** Κρατά μόνο όσα περνούν το `keep`· δεν ειδοποιεί όταν δεν φεύγει τίποτα. */
  prune(key: string, keep: (item: T) => boolean): void
  /** Υπάρχει κλειδί με μη αποθηκευμένα; */
  hasUnsaved(): boolean
  /** Σβήνει τα πάντα. */
  clear(): void
  /** Πόσα κλειδιά έχουν ακροατές (για τη δοκιμή: τα άδεια σύνολα φεύγουν). */
  listenedKeys(): number
}

const EMPTY: never[] = []

/** Καταστάσεις προσχεδίου που ΔΕΝ χρειάζονται τίποτα άλλο από τον χρήστη. */
const SETTLED = new Set(['saved', 'failed'])

/** Τελειωμένο: αποθηκεύτηκε ή η σάρωση απέτυχε (δεν υπάρχει τίποτα να χαθεί). */
export function isSettled(d: { status: string }): boolean {
  return SETTLED.has(d.status)
}

/** Υπάρχει σάρωση που δεν έχει ακόμη καταχωρηθεί (ή τρέχει ακόμη); */
export function hasUnsaved(drafts: readonly { status: string }[]): boolean {
  return drafts.some(d => !isSettled(d))
}

/** Τρέχει ακόμη ανάγνωση ή αποθήκευση; Μετά από επιστροφή στην καρτέλα το τοπικό `busy` έχει χαθεί. */
export function isWorking(drafts: readonly { status: string }[]): boolean {
  return drafts.some(d => d.status === 'pending' || d.status === 'scanning' || d.status === 'saving')
}

// ── Ο ένας φύλακας για όλα τα καταστήματα ───────────────────────────────────
const stores = new Set<KeptStore<unknown>>()
let guarding = false
const stopUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }

function syncGuard(): void {
  if (typeof window === 'undefined') return
  const want = anyKeptUnsaved()
  if (want === guarding) return
  guarding = want
  if (want) window.addEventListener('beforeunload', stopUnload)
  else window.removeEventListener('beforeunload', stopUnload)
}

/** Εχει κάποιο κατάστημα μη αποθηκευμένα; Η αποσύνδεση ρωτά ΠΡΙΝ λήξει η συνεδρία. */
export function anyKeptUnsaved(): boolean {
  return [...stores].some(s => s.hasUnsaved())
}

/** Σβήνει όλα τα προσχέδια και τον φύλακα. Καλείται πριν από κάθε σκληρή πλοήγηση. */
export function releaseAllKept(): void {
  for (const s of stores) s.clear()
  syncGuard()
}

onHardNavigate(releaseAllKept)

export function createKeptStore<T extends { status: string }>(): KeptStore<T> {
  const data = new Map<string, T[]>()
  const listeners = new Map<string, Set<Listener>>()
  const emit = (key: string) => listeners.get(key)?.forEach(fn => fn())
  const store: KeptStore<T> = {
    get: (key) => data.get(key) ?? (EMPTY as T[]),
    set: (key, next) => {
      const prev = data.get(key) ?? (EMPTY as T[])
      const value = typeof next === 'function' ? (next as (p: T[]) => T[])(prev) : next
      if (value.length === 0) data.delete(key); else data.set(key, value)
      emit(key)
      syncGuard()
    },
    prune: (key, keep) => {
      const prev = data.get(key)
      if (!prev || prev.every(keep)) return
      store.set(key, prev.filter(keep))
    },
    subscribe: (key, fn) => {
      let set = listeners.get(key)
      if (!set) { set = new Set(); listeners.set(key, set) }
      set.add(fn)
      return () => {
        const s = listeners.get(key)
        if (!s) return
        s.delete(fn)
        if (s.size === 0) listeners.delete(key)
      }
    },
    hasUnsaved: () => [...data.values()].some(hasUnsaved),
    clear: () => {
      const keys = [...data.keys()]
      data.clear()
      keys.forEach(emit)
    },
    listenedKeys: () => listeners.size,
  }
  stores.add(store as unknown as KeptStore<unknown>)
  return store
}
