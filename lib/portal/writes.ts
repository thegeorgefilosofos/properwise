// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΕΓΓΡΑΦΕΣ ΤΗΣ ΠΥΛΗΣ ΚΑΙ ΤΙ ΑΠΑΝΤΗΣΑΝ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΚΛΕΙΝΕΙ. Ο κωδικός της πύλης ελεγχόταν μόνο στην ανάγνωση: η
// δήλωση πληρωμής, το αίτημα βλάβης και οι φωτογραφίες γράφονταν με σκέτο το
// κουπόνι. Από το 20261003110000 ζητούν κι αυτές τον κωδικό και ο λάθος
// κωδικός μετρά στο ίδιο κλείδωμα με την είσοδο.
//
// Η ΒΑΣΗ ΑΠΑΝΤΑ ΜΕ ΤΕΣΣΕΡΙΣ ΤΡΟΠΟΥΣ και η οθόνη πρέπει να τους ξεχωρίζει,
// γιατί ο καθένας ζητά άλλη κίνηση από τον ενοικιαστή:
//   true      έγινε
//   false     δεν έγινε· γενικό «δοκίμασε ξανά»
//   null      ο κωδικός δεν έγινε δεκτός (ο ιδιοκτήτης τον άλλαξε στο μεταξύ)
//   σφάλμα    `portal_locked` ή `portal_rate_limited`, αλλιώς δίκτυο ή βάση
//
// Ο τύπος έμεινε boolean επίτηδες: ένα παλιό ανοιχτό παράθυρο που διαβάζει
// «false ή σφάλμα σημαίνει αποτυχία» δεν δείχνει ποτέ επιτυχία που δεν έγινε.
// ═══════════════════════════════════════════════════════════════════════════

/** Ο,τι επιστρέφει ο πελάτης Supabase από μια κλήση `rpc`. */
export interface RpcResult {
  data: unknown;
  error: { code?: string | null; message?: string | null } | null;
}

export type PortalWriteOutcome = 'ok' | 'refused' | 'pin' | 'locked' | 'rate_limited';

/** Τι σημαίνει η απάντηση της βάσης για τον ενοικιαστή. */
export function portalWriteOutcome(r: RpcResult): PortalWriteOutcome {
  if (r.error) {
    const m = r.error.message || '';
    if (m.includes('portal_locked')) return 'locked';
    if (m.includes('portal_rate_limited')) return 'rate_limited';
    return 'refused';
  }
  if (r.data === true) return 'ok';
  if (r.data === null) return 'pin';
  return 'refused';
}

/**
 * Τα κοινά μηνύματα. Το «refused» δεν είναι εδώ: το γράφει κάθε κουμπί με τα
 * δικά του λόγια, γιατί μόνο εκείνο ξέρει τι δεν έγινε.
 */
export const PORTAL_SAY = {
  pin: 'Ο κωδικός της πύλης δεν έγινε δεκτός. Ίσως τον άλλαξε ο ιδιοκτήτης: ξαναφόρτωσε τη σελίδα και βάλε τον νέο.',
  locked: 'Πολλές αποτυχημένες προσπάθειες κωδικού. Δοκίμασε ξανά σε 15 λεπτά.',
  declareLimit: 'Έστειλες πολλές δηλώσεις μέσα σε μία ώρα. Δοκίμασε ξανά αργότερα.',
  requestLimit: 'Έστειλες πολλά αιτήματα μέσα σε μία ώρα. Δοκίμασε ξανά αργότερα ή τηλεφώνησε στον ιδιοκτήτη.',
  photoLimit: 'Ανέβηκαν πολλές φωτογραφίες μέσα σε μία ώρα. Στείλε τις υπόλοιπες αργότερα.',
} as const;

/**
 * Το μήνυμα για μια απάντηση που δεν είναι «ok». Το `refused` και το όριο
 * ρυθμού είναι του καλούντος· τα υπόλοιπα είναι κοινά.
 */
export function portalWriteMessage(o: Exclude<PortalWriteOutcome, 'ok'>, refused: string, limit: string): string {
  if (o === 'pin') return PORTAL_SAY.pin;
  if (o === 'locked') return PORTAL_SAY.locked;
  if (o === 'rate_limited') return limit;
  return refused;
}

/** Η κλήση `rpc` του πελάτη, όσο χρειάζεται εδώ. */
export type RpcCall = (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;

/**
 * Κλήση εγγραφής της πύλης με τον κωδικό.
 *
 * ΓΙΑ ΤΗ ΜΕΤΑΒΑΣΗ ΜΟΝΟ. Η εφαρμογή και η βάση ανεβαίνουν από δύο αγωγούς που
 * ξεκινούν μαζί. Αν η σελίδα φτάσει πρώτη, η βάση δεν ξέρει ακόμη το `p_pin`
 * και το PostgREST απαντά PGRST202 («δεν υπάρχει συνάρτηση με αυτά τα
 * ορίσματα»). Τότε ξαναρωτάμε χωρίς αυτό: είναι ακριβώς η κλήση της
 * προηγούμενης έκδοσης, προς τη συνάρτηση της προηγούμενης έκδοσης. Μόλις
 * τρέξει η μετανάστευση, το PGRST202 δεν ξαναβγαίνει και ο κλάδος σβήνεται.
 */
export async function callPortalWrite(
  rpc: RpcCall, fn: string, args: Record<string, unknown>, pin: string | null,
): Promise<RpcResult> {
  const first = await rpc(fn, { ...args, p_pin: pin });
  if (first.error?.code === 'PGRST202') return rpc(fn, args);
  return first;
}
