// ═══════════════════════════════════════════════════════════════════════════
// ΑΝΑΦΟΡΑ ΑΠΟ ΔΙΑΔΡΟΜΗ API — ΜΟΝΟ ΓΙΑ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΣΥΝΕΒΑΙΝΕ. Καμία από τις διαδρομές του app/api δεν ανέφερε τίποτα. Μια
// εγγραφή χρέωσης που απέτυχε μετά την αλλαγή στον έμπορο, μια διαγραφή
// λογαριασμού που κόλλησε, ένα ανέβασμα που δεν πήρε υπογεγραμμένο σύνδεσμο:
// όλα έμεναν σε ένα `console.info` που κανείς δεν διαβάζει, ώσπου να γράψει ο
// πελάτης.
//
// ── ΤΙ ΤΑΞΙΔΕΥΕΙ ΚΑΙ ΤΙ ΟΧΙ ───────────────────────────────────────────────
// Ταξιδεύει μια ΣΤΑΘΕΡΗ ετικέτα που γράφει ο κώδικας («[api/x] write failed
// 502»), ο κωδικός του σφάλματος (SQLSTATE, απαρίθμηση του εμπόρου) και, από
// την αιτία, ΜΟΝΟ ο τύπος της και τα πλαίσια της στοίβας της.
//
// ΠΟΤΕ το μήνυμα της αιτίας. Το μήνυμα της Supabase, του εμπόρου ή της
// Anthropic μπορεί να κουβαλά email, ΑΦΜ ή κείμενο χρήστη και ο `scrub()` του
// αναφορέα καθαρίζει μόνο κλειδιά του `extra`, όχι τιμές. Και ΠΟΤΕ «η στοίβα
// χωρίς την πρώτη γραμμή»: η V8 βάζει στην κορυφή της στοίβας ΟΛΕΣ τις γραμμές
// ενός πολύγραμμου μηνύματος (μετρημένο). Κρατιούνται μόνο γραμμές `at …`.
//
// ΜΟΝΟ ΔΙΑΚΟΜΙΣΤΗΣ: το πακέτο `server-only` δεν είναι εγκατεστημένο και η
// εισαγωγή του θα έσπαγε τη σουίτα του tsx, γι' αυτό το λέμε εδώ, σε σχόλιο.
// ═══════════════════════════════════════════════════════════════════════════
import { after } from 'next/server'
import { captureError } from './report'

export interface RouteFailure {
  /** Ο κωδικός HTTP που απάντησε η διαδρομή. */
  status?: number
  /** Κωδικός μηχανής: SQLSTATE, απαρίθμηση εμπόρου. Ποτέ ελεύθερο κείμενο. */
  code?: string | null
  /** Η αιτία. Διαβάζονται μόνο ο τύπος και τα πλαίσια της στοίβας της. */
  cause?: unknown
}

/** Ο τύπος της αιτίας, χωρίς το μήνυμά της. */
export function causeNameOf(cause: unknown): string {
  try {
    return cause instanceof Error ? String(cause.name || 'Error').slice(0, 60) : typeof cause
  } catch {
    return 'unknown'
  }
}

/** Μόνο οι γραμμές `at …` της στοίβας: οι γραμμές του μηνύματος μένουν εδώ. */
function causeFrames(cause: unknown): string {
  try {
    if (!(cause instanceof Error)) return ''
    return String(cause.stack ?? '').split('\n')
      .filter(l => /^\s+at /.test(l)).slice(0, 6).map(s => s.trim()).join(' | ')
  } catch {
    // Η στοίβα μπορεί να είναι getter που πετάει.
    return ''
  }
}

/** Ο κωδικός ενός σφάλματος βάσης (SQLSTATE ή PGRST), ποτέ το μήνυμά του. */
export function codeOf(e: unknown): string | null {
  try {
    const c = (e as { code?: unknown } | null)?.code
    return typeof c === 'string' && c ? c.slice(0, 60) : null
  } catch {
    return null
  }
}

/** Το σφάλμα και τα συνοδευτικά του, έτοιμα για τον αναφορέα. Καθαρή συνάρτηση. */
export function buildRouteReport(route: string, what: string, f: RouteFailure = {}) {
  const label = `[${route}] ${what}${f.status ? ` ${f.status}` : ''}`
  const error = new Error(label)
  error.name = 'RouteError'
  const extra: Record<string, unknown> = { route, status: f.status ?? null, code: f.code ?? null }
  if (f.cause !== undefined) {
    extra.causeName = causeNameOf(f.cause)
    extra.causeFrames = causeFrames(f.cause)
  }
  return { error, extra }
}

/**
 * Αναφέρει αποτυχία διαδρομής. Δεν πετάει ποτέ.
 *
 * Το `after()` κρατά τη συνάρτηση ζωντανή ώσπου να φύγει ο φάκελος, αφού
 * απαντήσει η διαδρομή. Εξω από αίτημα (σουίτα, σενάριο) το `after()` πετάει,
 * οπότε πιάνεται: η αποστολή έχει ήδη ξεκινήσει.
 */
export function reportRoute(route: string, what: string, f: RouteFailure = {}): Promise<void> {
  const r = buildRouteReport(route, what, f)
  const sent = captureError(r.error, r.extra)
  try { after(() => sent) } catch { /* εκτός αιτήματος */ }
  return sent
}
