// ═══════════════════════════════════════════════════════════════════════════
// Η ΔΙΕΥΘΥΝΣΗ ΠΟΥ ΦΕΥΓΕΙ ΠΡΟΣ ΤΗ ΜΕΤΡΗΣΗ ΕΠΙΣΚΕΨΙΜΟΤΗΤΑΣ
// ─────────────────────────────────────────────────────────────────────────
// Το app/VercelAnalytics.tsx έστελνε μόνο origin και μονοπάτι. Σωστά για το
// query string, που μπορεί να κουβαλά token επαναφοράς ή κωδικό OAuth· όμως
// έκοβε μαζί και τα utm. Καμία ανάρτηση δεν συνδεόταν με επίσκεψη ή εγγραφή:
// το ταμπλό έδειχνε «άμεση επίσκεψη» για ό,τι ερχόταν από LinkedIn ή Meta.
//
// ΛΙΣΤΑ ΕΠΙΤΡΕΠΟΜΕΝΩΝ, ΟΧΙ ΑΠΑΓΟΡΕΥΜΕΝΩΝ. Περνούν ΜΟΝΟ τα πέντε κλειδιά utm.
// Οποιοδήποτε άλλο (token, code, email, next) κόβεται χωρίς να χρειάζεται
// κανείς να ξέρει το όνομά του. Οι σελίδες με μυστικό μέσα στη διαδρομή δεν
// μετρώνται καθόλου, όπως πριν.
//
// ΚΑΙ ΑΝ Η ΔΙΕΥΘΥΝΣΗ ΔΕΝ ΔΙΑΒΑΖΕΤΑΙ, ΔΕΝ ΦΕΥΓΕΙ. Το παλιό `catch` επέστρεφε το
// γεγονός όπως ήταν, δηλαδή μαζί με όλο το query string.
// ═══════════════════════════════════════════════════════════════════════════

/** Τα μόνα κλειδιά του query string που φεύγουν. */
export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

/** Μέγιστο μήκος τιμής utm: αρκεί για όνομα καμπάνιας, όχι για κείμενο. */
const UTM_MAX = 100;

/** Διαδρομές όπου το μονοπάτι κουβαλά μυστικό· δεν μετρώνται καθόλου. */
export const SECRET_PATH =
  /^\/(portal|accountant|checkin|verify|imerologio|unsubscribe|reset-password|epivevaiosi-email|auth)\//;

/**
 * Η διεύθυνση για τη μέτρηση: origin, μονοπάτι και μόνο τα utm. `null` όταν η
 * σελίδα δεν μετριέται ή η διεύθυνση δεν διαβάζεται.
 */
export function analyticsUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (SECRET_PATH.test(u.pathname)) return null;
  const keep = new URLSearchParams();
  for (const k of UTM_KEYS) {
    const v = u.searchParams.get(k);
    if (v && v.length <= UTM_MAX) keep.set(k, v);
  }
  const q = keep.toString();
  return u.origin + u.pathname + (q ? `?${q}` : '');
}
