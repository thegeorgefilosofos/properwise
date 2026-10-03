// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΚΛΕΙΔΩΜΑ ΤΗΣ ΧΡΗΣΗΣ ΔΕΝ ΧΑΝΕΤΑΙ ΣΤΗ ΜΕΣΗ ΤΗΣ ΑΝΤΙΚΑΤΑΣΤΑΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Το κλείδωμα γράφεται με διαγραφή και μετά εισαγωγή (τα policies του πίνακα
// `book_closings` είναι insert και delete, χωρίς update). Το σφάλμα της
// διαγραφής αγνοούνταν και, αν η διαγραφή πετύχαινε ενώ η εισαγωγή αποτύγχανε,
// το ΠΑΛΙΟ κλείδωμα είχε ήδη σβηστεί: η χρήση που ήταν κλειστή έμενε ανοιχτή
// χωρίς κανείς να το ζητήσει (02.10.2026).
//
// Τώρα: αποτυχία διαγραφής σταματά πριν από οτιδήποτε άλλο· αποτυχία εισαγωγής
// ξαναγράφει το προηγούμενο κλείδωμα αν υπήρχε. Η οθόνη μαθαίνει τι ισχύει
// πραγματικά στη βάση, όχι τι ελπίζαμε.
// ═══════════════════════════════════════════════════════════════════════════

export interface BookLock<S> { snapshot: S; locked_at: string }
type Res = { error: unknown }

export interface RelockResult<S> {
  /** Το κλείδωμα που ισχύει πλέον στη βάση (ή `null`). */
  closing: BookLock<S> | null
  /** Το σφάλμα που πρέπει να δει ο χρήστης, ή `null` όταν πέτυχε. */
  error: unknown
  /** Η διαγραφή πέρασε αλλά ούτε το νέο ούτε το παλιό κλείδωμα ξαναγράφτηκε. */
  lost: boolean
}

export async function relockYear<S>(
  io: { remove: () => PromiseLike<Res>; insert: (lock: BookLock<S>) => PromiseLike<Res> },
  next: BookLock<S>,
  prev: BookLock<S> | null,
): Promise<RelockResult<S>> {
  const del = await io.remove()
  if (del.error) return { closing: prev, error: del.error, lost: false }
  const ins = await io.insert(next)
  if (!ins.error) return { closing: next, error: null, lost: false }
  if (!prev) return { closing: null, error: ins.error, lost: false }
  const back = await io.insert(prev)
  return back.error
    ? { closing: null, error: ins.error, lost: true }
    : { closing: prev, error: ins.error, lost: false }
}
