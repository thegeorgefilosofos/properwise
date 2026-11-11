// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΚΑΝΕΙΣ ΔΕΝ ΕΠΙΑΣΕ
// ─────────────────────────────────────────────────────────────────────────
// Οτι πετάει μια διαδρομή API χωρίς `catch` γινόταν 500 και μια γραμμή στα
// αρχεία καταγραφής της πλατφόρμας. Εδώ το Next καλεί το `onRequestError` και
// η αναφορά φεύγει από τον ίδιο αναφορέα με τις υπόλοιπες, χωρίς SDK.
//
// ΔΙΑΔΡΟΜΕΣ, ΑΠΟΔΟΣΗ ΣΕΛΙΔΑΣ ΚΑΙ SERVER ACTION (έλεγχος ετοιμότητας 10/11/2026).
// Ως τότε μόνο οι διαδρομές API έφταναν στη Sentry: σελίδα που έπεφτε στον
// server, όπως η διακοπή της 27/07, φαινόταν μόνο από τους χρήστες. Μένουν έξω:
//   · ο proxy, που τρέχει σε κάθε αίτημα και έχει δικό του χειρισμό·
//   · τα σήματα πλοήγησης του Next (redirect, notFound, δυναμική απόδοση), που
//     δεν είναι σφάλματα: έρχονται με `digest` που αρχίζει από NEXT_ ή DYNAMIC_;
//   · η διακοπή αιτήματος από τον ίδιο τον επισκέπτη (AbortError).
// Για τις σελίδες το `routePath` είναι το πρότυπο (π.χ. /portal/[token]), όχι
// η πραγματική διεύθυνση, άρα token στη διαδρομή δεν ταξιδεύει ποτέ.
//
// ΤΙ ΤΑΞΙΔΕΥΕΙ. Το αρχείο της διαδρομής (`routePath`, π.χ. /api/push), η
// μέθοδος και ο ΤΥΠΟΣ της εξαίρεσης στην ετικέτα, ώστε δύο διαφορετικά σφάλματα
// της ίδιας διαδρομής να μη γίνονται ένα θέμα με κοινό φρένο. ΠΟΤΕ το
// `request.path` (κουβαλά query string), οι κεφαλίδες (cookie), το μήνυμα ή το
// digest της εξαίρεσης.
//
// ΤΟ `await` ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟ κατά την τεκμηρίωση του Next: χωρίς αυτό η
// συνάρτηση μπορεί να τελειώσει πριν φύγει ο φάκελος.
// ═══════════════════════════════════════════════════════════════════════════
import type { Instrumentation } from 'next'
import { captureError } from '@/lib/observability/report'
import { buildRouteReport, causeNameOf } from '@/lib/observability/route'

const REPORTED = new Set<string>(['route', 'render', 'action'])

/** Τα σήματα πλοήγησης του Next πετιούνται ως εξαιρέσεις, αλλά δεν είναι σφάλματα. */
function isNavigationSignal(err: unknown): boolean {
  try {
    const digest = (err as { digest?: unknown } | null)?.digest
    return typeof digest === 'string' && /^(NEXT_|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT_SIDE_RENDERING)/.test(digest)
  } catch {
    return false
  }
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (!REPORTED.has(context.routeType)) return
  if (isNavigationSignal(err) || causeNameOf(err) === 'AbortError') return
  const kind = context.routeType === 'route' ? request.method : context.routeType
  const r = buildRouteReport(context.routePath, `${kind} unhandled ${causeNameOf(err)}`, { status: 500, cause: err })
  await captureError(r.error, r.extra)
}
