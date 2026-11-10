// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΥΛΗ ΤΗΣ ΥΠΟΒΟΛΗΣ: ΚΑΝΕΝΑΣ ΚΩΔΙΚΟΣ ΔΕΝ ΟΡΙΖΕΤΑΙ ΧΩΡΙΣ ΕΛΕΓΧΟ ΔΙΑΡΡΟΗΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ (10/11/2026). Το PasswordStrength ρωτά το Have I Been
// Pwned 450 ms μετά το τελευταίο πλήκτρο και μετά περιμένει το δίκτυο. Όποιος
// επικολλούσε κωδικό και πατούσε αμέσως υποβολή πρόφταινε την απάντηση: ο
// διαρρεύσας κωδικός γινόταν δεκτός. Γι' αυτό κάθε `signUp` και κάθε
// `updateUser({ password })` περνά πρώτα από εδώ (guard-password-leak).
//
// ΓΙΑΤΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ. Είναι μικρό και φορτώνεται στατικά. Ο ίδιος ο έλεγχος
// (`leakedPassword.ts`) φορτώνει δυναμικά ΜΕΣΑ στο όριο χρόνου, ώστε το όριο
// να μετρά από το πάτημα και όχι από το τέλος ενός αργού φορτώματος.
//
// ΑΠΟΤΥΓΧΑΝΕΙ ΑΝΟΙΧΤΑ. Αν η υπηρεσία σιωπήσει ή αργήσει, η υποβολή προχωρά: ο
// έλεγχος βελτίωσης δεν κλειδώνει έξω πελάτη επειδή έπεσε τρίτη υπηρεσία. Η
// σιωπή καταγράφεται ΜΙΑ φορά ανά συνεδρία, μόνο με τον λόγο της: ούτε
// κωδικός, ούτε hash. Ο περιηγητής χωρίς Web Crypto δεν καταγράφεται καθόλου,
// γιατί δεν είναι βλάβη της υπηρεσίας.
// ═══════════════════════════════════════════════════════════════════════════

/** Πόσο περιμένει η υποβολή, φόρτωμα και δίκτυο μαζί, πριν προχωρήσει. */
export const SUBMIT_TIMEOUT_MS = 2000

type Failure = 'timeout' | 'unavailable'

const SESSION_KEY = 'pw-leak-check-reported'
let reportedHere = false

/** Η πρώτη σιωπή της συνεδρίας φτάνει στην αναφορά σφαλμάτων· οι επόμενες όχι. */
function reportOnce(reason: Failure): void {
  if (reportedHere) return
  reportedHere = true
  try {
    if (globalThis.sessionStorage?.getItem(SESSION_KEY)) return
    globalThis.sessionStorage?.setItem(SESSION_KEY, '1')
  } catch { /* ιδιωτική περιήγηση: αρκεί η σημαία της σελίδας */ }
  void import('@/lib/observability/report')
    .then(m => m.captureError(new Error('leaked-password check unavailable at submit'), { reason }))
    .catch(() => {})
}

/**
 * Είναι ο κωδικός σε γνωστή διαρροή; Για τη στιγμή της υποβολής.
 *
 * `true` μόνο όταν η υπηρεσία απάντησε «βρέθηκε». Σε σιωπή, σφάλμα, λήξη
 * χρόνου ή περιηγητή χωρίς Web Crypto: `false` και η υποβολή προχωρά.
 */
export async function leakedAtSubmit(password: string, timeoutMs = SUBMIT_TIMEOUT_MS): Promise<boolean> {
  const ctl = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<'timeout'>(resolve => {
    timer = setTimeout(() => { ctl.abort(); resolve('timeout') }, timeoutMs)
  })
  try {
    const outcome = await Promise.race([
      import('./leakedPassword')
        .then(m => m.checkLeakedPasswordDetailed(password, ctl.signal))
        .then(o => o.reason === 'checked' ? (o.result.leaked ? 'leaked' as const : 'clean' as const)
          : o.reason === 'unavailable' ? 'unavailable' as const
          : o.reason === 'aborted' ? 'timeout' as const
          : 'skip' as const)
        .catch(() => 'unavailable' as const),
      deadline,
    ])
    if (outcome === 'timeout' || outcome === 'unavailable') reportOnce(outcome)
    return outcome === 'leaked'
  } finally {
    clearTimeout(timer)
  }
}
