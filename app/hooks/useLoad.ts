'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΣΥΓΧΡΟΝΗ ΦΟΡΤΩΣΗ, ΓΡΑΜΜΕΝΗ ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΜΟΤΙΒΟ. Δεκαεννέα οθόνες γράφουν το ίδιο πράγμα:
//
//     const load = useCallback(async () => { … setRows(data) }, [x])
//     useEffect(() => { load() }, [load])
//
// Είναι ΑΚΡΙΒΩΣ αυτό που συνιστά η τεκμηρίωση της React για φόρτωση δεδομένων
// σε effect: το effect συγχρονίζει με εξωτερικό σύστημα (τη βάση) και η
// κατάσταση γράφεται στην απάντηση, δηλαδή σε callback, όχι σύγχρονα.
//
// ΓΙΑΤΙ ΤΟ ΕΠΙΣΗΜΑΙΝΕΙ ΠΑΡ' ΟΛΑ ΑΥΤΑ Ο ΚΑΝΟΝΑΣ. Το `react-hooks/set-state-in-effect`
// ακολουθεί την κλήση μέσα στη `load` και βρίσκει `setState`. ΔΕΝ ξεχωρίζει αν
// αυτό συμβαίνει πριν ή μετά από `await`: για τον κανόνα, κάθε γραφή που
// φτάνεται από το σώμα του effect είναι σύγχρονη. Η διάκριση όμως είναι όλη η
// ουσία — μετά το `await` δεν υπάρχει «αλυσιδωτή απόδοση», υπάρχει απάντηση
// δικτύου που ήρθε αργότερα.
//
// ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΧΡΕΙΑΖΕΤΑΙ ΚΑΝ ΕΞΑΙΡΕΣΗ. Μέσα εδώ η `load` είναι ΠΑΡΑΜΕΤΡΟΣ:
// ο κανόνας δεν έχει σώμα να ακολουθήσει, οπότε δεν επισημαίνει τίποτα. Αυτό
// είναι ταυτόχρονα το όφελος και ο κίνδυνος, γι' αυτό υπάρχει ο ΟΡΟΣ πιο κάτω
// και ο φύλακας που τον επιβάλλει (scripts/guard-use-load.mjs).
//
// Ο ΟΡΟΣ, ΓΡΑΜΜΕΝΟΣ ΩΣΤΕ ΝΑ ΕΛΕΓΧΕΤΑΙ: η `load` ΔΕΝ γράφει κατάσταση πριν από
// το πρώτο της `await`. Μια `setLoading(true)` στην πρώτη γραμμή είναι σύγχρονη
// γραφή, όσο ασύγχρονη κι αν είναι η συνέχεια — και ακριβώς αυτή θα κρυβόταν
// εδώ αν δεν την έπιανε ο φύλακας.
//
// ── Η ΠΑΛΙΑ ΑΠΑΝΤΗΣΗ ΔΕΝ ΓΡΑΦΕΙ ΠΑΝΩ ΣΤΗ ΝΕΑ (07/10/2026) ─────────────────
// ΤΟ ΣΦΑΛΜΑ. Το hook έτρεχε τη φόρτωση και τίποτα άλλο: χωρίς αρίθμηση, χωρίς
// ακύρωση. Η Επισκόπηση έχει έντεκα ζωντανές συνδρομές και καθεμία ξανάτρεχε
// ολόκληρη τη φόρτωση (~20 ερωτήματα) στο ίδιο συμβάν. Δέκα συμβάντα σε ένα
// δευτερόλεπτο ήταν δέκα παράλληλες φορτώσεις· όποια απαντούσε ΤΕΛΕΥΤΑΙΑ
// έγραφε την κατάσταση, ακόμη κι αν ήταν η παλαιότερη. Το ίδιο στους
// επισκέπτες: μια εισαγωγή iCal εκατό κρατήσεων έφερνε εκατό συμβάντα και
// εκατό φορτώσεις διαμονών.
//
// ΤΙ ΚΑΝΕΙ ΤΩΡΑ.
//   1. ΑΡΙΘΜΗΣΗ. Κάθε εκτέλεση παίρνει αύξοντα αριθμό και ένα `LoadTurn`. Το
//      `turn.isLatest()` λέει αν στο μεταξύ ξεκίνησε νεότερη· το `turn.signal`
//      ακυρώνεται τη στιγμή που ξεκινά η νεότερη. Η φόρτωση που ελέγχει το
//      `isLatest()` μετά το `await` δεν γράφει ποτέ παλιά απάντηση.
//   2. ΣΥΓΧΩΝΕΥΣΗ. Η `reload()` που επιστρέφει το hook μαζεύει όσες κλήσεις
//      έρθουν μέσα σε ~300ms σε ΜΙΑ φόρτωση. Είναι αυτό που δίνεται στις
//      ζωντανές συνδρομές: ριπή συμβάντων, μία φόρτωση.
//   3. Η αρχική φόρτωση και κάθε αλλαγή της `load` τρέχουν αμέσως, όπως πριν·
//      μια εκκρεμής συγχωνευμένη `reload()` απορροφάται από αυτήν.
//
// Μια `load` χωρίς παράμετρο δουλεύει όπως πάντα: το `turn` απλώς αγνοείται.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from 'react'

/** Τι μαθαίνει μια εκτέλεση της φόρτωσης για τον εαυτό της. */
export type LoadTurn = {
  /** Ακυρώνεται μόλις ξεκινήσει νεότερη εκτέλεση ή φύγει η οθόνη. */
  signal: AbortSignal
  /** Αληθές όσο καμία νεότερη εκτέλεση δεν έχει ξεκινήσει. Ελέγχεται μετά το `await`. */
  isLatest: () => boolean
}

export type LoadFn = (turn: LoadTurn) => Promise<unknown>

/** Το παράθυρο συγχώνευσης της `reload()`, σε ms. */
export const COALESCE_MS = 300

type Timers = {
  setTimeout: (fn: () => void, ms: number) => unknown
  clearTimeout: (id: unknown) => void
}

const realTimers: Timers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: id => globalThis.clearTimeout(id as ReturnType<typeof globalThis.setTimeout>),
}

/**
 * Ο μηχανισμός χωρίς React, για να ελέγχεται σε σκέτο Node
 * (app/hooks/useLoad.test.ts). Το hook είναι λεπτό περιτύλιγμα γύρω του.
 */
export function createLoadRunner(opts: { coalesceMs?: number; timers?: Timers } = {}) {
  const coalesceMs = opts.coalesceMs ?? COALESCE_MS
  const timers = opts.timers ?? realTimers
  let seq = 0
  let controller: AbortController | null = null
  let latestLoad: LoadFn | null = null
  // Η εκκρεμής συγχωνευμένη κλήση: ο χρονομετρητής και όσοι την περιμένουν.
  let timer: unknown = null
  let waiters: Array<{ resolve: () => void; reject: (e: unknown) => void }> = []

  const settle = (p: Promise<unknown>) => {
    const ws = waiters
    if (!ws.length) return   // κανείς δεν περιμένει: η απόρριψη μένει ορατή όπως πριν
    waiters = []
    p.then(() => ws.forEach(w => w.resolve()), e => ws.forEach(w => w.reject(e)))
  }

  const clearPending = () => {
    if (timer !== null) { timers.clearTimeout(timer); timer = null }
  }

  /** Τρέχει ΤΩΡΑ. Κάθε προηγούμενη εκτέλεση παύει να είναι η τελευταία. */
  const run = (load?: LoadFn): Promise<void> => {
    if (load) latestLoad = load
    const fn = latestLoad
    clearPending()
    controller?.abort()
    const mine = ++seq
    const ctrl = new AbortController()
    controller = ctrl
    const turn: LoadTurn = { signal: ctrl.signal, isLatest: () => mine === seq }
    // Ξεκινά ΣΥΓΧΡΟΝΑ, όπως πριν· ένα σύγχρονο throw γίνεται απόρριψη.
    let p: Promise<void>
    try { p = fn ? Promise.resolve(fn(turn)).then(() => undefined) : Promise.resolve() }
    catch (e) { p = Promise.reject(e) }
    // Όσοι περίμεναν συγχωνευμένη φόρτωση, εξυπηρετούνται από αυτήν.
    settle(p)
    return p
  }

  /** Συγχωνεύει: όσες κλήσεις έρθουν μέσα στο παράθυρο γίνονται μία φόρτωση. */
  const schedule = (): Promise<void> => {
    if (coalesceMs <= 0) return run()
    const p = new Promise<void>((resolve, reject) => { waiters.push({ resolve, reject }) })
    if (timer === null) timer = timers.setTimeout(() => { timer = null; void run().catch(() => {}) }, coalesceMs)
    return p
  }

  /** Η οθόνη έφυγε: καμία απάντηση δεν είναι πια η τελευταία. */
  const cancel = () => {
    clearPending()
    controller?.abort()
    controller = null
    seq++
    // Όσοι περίμεναν δεν μένουν κρεμασμένοι για πάντα.
    const ws = waiters
    waiters = []
    ws.forEach(w => w.resolve())
  }

  return { run, schedule, cancel }
}

export type Reload = (opts?: { immediate?: boolean }) => Promise<void>

/**
 * Τρέχει την ασύγχρονη φόρτωση στην προσάρτηση και σε κάθε αλλαγή της.
 *
 * Η `load` ΠΡΕΠΕΙ να είναι σταθεροποιημένη με `useCallback`, αλλιώς τρέχει σε
 * κάθε απόδοση — ακριβώς όπως και με χειρόγραφο `useEffect`.
 *
 * Επιστρέφει `reload()`: συγχωνευμένη (~300ms) επανάληψη της ΤΡΕΧΟΥΣΑΣ `load`,
 * για ζωντανές συνδρομές και ριπές. Με `{ immediate: true }` τρέχει αμέσως.
 * Η φόρτωση που δέχεται `turn` και ελέγχει `turn.isLatest()` μετά το `await`
 * δεν γράφει ποτέ απάντηση παλαιότερη από την τελευταία. Το `coalesceMs`
 * διαβάζεται μία φορά, στην προσάρτηση.
 */
export function useLoad(load: LoadFn, opts?: { coalesceMs?: number }): Reload {
  const [runner] = useState(() => createLoadRunner({ coalesceMs: opts?.coalesceMs }))
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
    void runner.run(load)
  }, [load, runner])
  useEffect(() => () => runner.cancel(), [runner])
  return useCallback<Reload>(
    o => (o?.immediate ? runner.run(loadRef.current) : runner.schedule()),
    [runner],
  )
}
