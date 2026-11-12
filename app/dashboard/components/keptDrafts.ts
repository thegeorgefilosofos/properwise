// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΣΑΡΩΜΕΝΑ ΠΡΟΣΧΕΔΙΑ ΤΟΥ ΦΑΚΕΛΟΥ ΖΟΥΝ ΠΑΝΩ ΑΠΟ ΤΗΝ ΚΑΡΤΕΛΑ.
//
// Ζούσαν σε `useState` του TabDocuments και η καρτέλα ξαναστήνεται σε κάθε
// αλλαγή καρτέλας ή ακινήτου (`key={selected.id}` στο page.tsx). Ενα πάτημα
// στο Ημερολόγιο έσβηνε σαρώσεις που είχαν ήδη μετρήσει στο όριο του μήνα.
//
// Εδώ κρατιούνται ανά ακίνητο, στη μνήμη της σελίδας: επιβιώνουν από αλλαγή
// καρτέλας και ακινήτου, ΟΧΙ από ανανέωση ή αποσύνδεση (η αποσύνδεση κάνει
// πλήρη φόρτωση, άρα δεν μένει τίποτα σε κοινή συσκευή). Για την ανανέωση
// ρωτά ο περιηγητής (`hasUnsaved` + beforeunload στην καρτέλα).
//
// Η ΕΝΗΜΕΡΩΣΗ ΓΡΑΦΕΙ ΣΤΟ ΚΑΤΑΣΤΗΜΑ, ΟΧΙ ΣΤΟ ΣΤΙΓΜΙΟΤΥΠΟ. Η σάρωση παρτίδας
// τρέχει ασύγχρονα· αν ο χρήστης φύγει στη μέση, τα αποτελέσματα που έρχονται
// μετά γράφονται κανονικά και τα βρίσκει όταν γυρίσει.
// ═══════════════════════════════════════════════════════════════════════════

type Listener = () => void

export interface KeptStore<T> {
  get(key: string): T[]
  set(key: string, next: T[] | ((prev: T[]) => T[])): void
  subscribe(key: string, fn: Listener): () => void
}

const EMPTY: never[] = []

export function createKeptStore<T>(): KeptStore<T> {
  const data = new Map<string, T[]>()
  const listeners = new Map<string, Set<Listener>>()
  return {
    get: (key) => data.get(key) ?? (EMPTY as T[]),
    set: (key, next) => {
      const prev = data.get(key) ?? (EMPTY as T[])
      const value = typeof next === 'function' ? (next as (p: T[]) => T[])(prev) : next
      if (value.length === 0) data.delete(key); else data.set(key, value)
      listeners.get(key)?.forEach(fn => fn())
    },
    subscribe: (key, fn) => {
      let set = listeners.get(key)
      if (!set) { set = new Set(); listeners.set(key, set) }
      set.add(fn)
      return () => { set!.delete(fn) }
    },
  }
}

/** Καταστάσεις προσχεδίου που ΔΕΝ χρειάζονται τίποτα άλλο από τον χρήστη. */
const SETTLED = new Set(['saved', 'failed'])

/** Υπάρχει σάρωση που δεν έχει ακόμη καταχωρηθεί (ή τρέχει ακόμη); */
export function hasUnsaved(drafts: readonly { status: string }[]): boolean {
  return drafts.some(d => !SETTLED.has(d.status))
}

/** Τρέχει ακόμη ανάγνωση ή αποθήκευση; Μετά από επιστροφή στην καρτέλα το τοπικό `busy` έχει χαθεί. */
export function isWorking(drafts: readonly { status: string }[]): boolean {
  return drafts.some(d => d.status === 'pending' || d.status === 'scanning' || d.status === 'saving')
}
