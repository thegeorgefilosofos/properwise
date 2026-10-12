// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΚΑΝΕΙΣ ΔΕΝ ΕΠΙΑΣΕ
// ─────────────────────────────────────────────────────────────────────────
// Οτι πετάει μια διαδρομή API χωρίς `catch` γινόταν 500 και μια γραμμή στα
// αρχεία καταγραφής της πλατφόρμας. Εδώ το Next καλεί το `onRequestError` και
// η αναφορά φεύγει από τον ίδιο αναφορέα με τις υπόλοιπες, χωρίς SDK.
//
// ΜΟΝΟ ΔΙΑΔΡΟΜΕΣ ΓΙΑ ΤΩΡΑ. Απόδοση σελίδας, server action και proxy μένουν
// έξω: θέλουν δική τους απόφαση για το τι είναι θόρυβος.
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

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (context.routeType !== 'route') return
  const r = buildRouteReport(context.routePath, `${request.method} unhandled ${causeNameOf(err)}`, { status: 500, cause: err })
  await captureError(r.error, r.extra)
}
