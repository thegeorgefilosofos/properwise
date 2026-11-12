// ═══════════════════════════════════════════════════════════════════════════
// ΤΙ ΛΕΕΙ Η ΟΘΟΝΗ ΧΡΕΩΣΗΣ ΟΤΑΝ Ο ΔΙΑΚΟΜΙΣΤΗΣ ΛΕΕΙ «ΟΧΙ»
// ─────────────────────────────────────────────────────────────────────────
// Οι διαδρομές της χρέωσης ξέρουν ΓΙΑΤΙ αρνήθηκαν και το γράφουν στο `error`:
// «Υπάρχει ήδη ενεργή συνδρομή» (409 του ταμείου), «Πολλές προσπάθειες» (429
// του κωδικού δοκιμαστή), το δεύτερο βήμα της σύνδεσης (403). Η κάρτα τα
// πετούσε όλα και έγραφε το ίδιο γενικό μήνυμα: «δοκίμασε ξανά σε λίγο» σε
// άνθρωπο που όσο κι αν ξαναδοκιμάσει θα πάρει το ίδιο (έλεγχος 12.11.2026,
// ευρήματα 12 και 13).
//
// Χωρίς React, ώστε η επιλογή να ελέγχεται (billingErrors.test.ts).
// ═══════════════════════════════════════════════════════════════════════════

import { MFA_REQUIRED, MFA_SAY } from '@/lib/auth/mfa';
import { ORIGIN_DENIED } from '@/lib/api/origin';

/** Το σώμα μιας άρνησης, όπως το γράφουν οι διαδρομές. */
export interface ErrorBody { error?: unknown; message?: unknown }

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Ο λόγος του διακομιστή σε ανθρώπινη γλώσσα, ή κενό.
 *
 * Το δεύτερο βήμα (lib/auth/secondStep.ts) γράφει στο `error` κωδικό μηχανής
 * (`mfa_required`) και τη φράση στο `message`: ο κωδικός δεν δείχνεται ποτέ.
 */
export function serverReason(body: ErrorBody | null | undefined): string {
  if (!body) return '';
  const err = text(body.error);
  if (err === MFA_REQUIRED) return text(body.message) || MFA_SAY.ask;
  return err;
}

/**
 * Το μήνυμα όταν μια πόρτα του παρόχου (ταμείο ή διαχείριση συνδρομής) δεν
 * άνοιξε. `what` είναι το όνομα της πόρτας («Το ταμείο»).
 */
export function doorErrorMessage(status: number, body: ErrorBody | null | undefined, what: string): string {
  const reason = serverReason(body);
  if (reason && status >= 400) return reason;
  return `${what} δεν άνοιξε. Δοκίμασε ξανά σε λίγο.`;
}

export const TESTER_SAY = {
  wrong: 'Ο κωδικός δεν αναγνωρίζεται.',
  tooMany: 'Πολλές προσπάθειες. Δοκίμασε ξανά αύριο.',
  server: 'Η εξαργύρωση δεν ολοκληρώθηκε. Ο κωδικός μπορεί να είναι σωστός· δοκίμασε ξανά σε λίγο.',
  /** Το αίτημα δεν ήρθε από τη σελίδα της εφαρμογής (403 ORIGIN_DENIED): ο κωδικός δεν κρίθηκε καν. */
  origin: 'Δεν έγινε. Ανανέωσε τη σελίδα και δοκίμασε ξανά.',
} as const;

/**
 * Το μήνυμα όταν ο κωδικός δοκιμαστή δεν πέρασε.
 *
 * Ο διακομιστής δίνει ΙΔΙΑ απάντηση σε «λάθος κωδικό» και «δεν υπάρχει
 * πρόγραμμα» (403) και αυτό μένει. Το όριο προσπαθειών (429) και η βλάβη
 * (5xx) όμως δεν είναι «λάθος κωδικός»: ο χρήστης που διαβάζει
 * «δεν αναγνωρίζεται» για βλάβη θα καεί ξαναγράφοντας τον σωστό κωδικό.
 */
export function testerErrorMessage(status: number, body: ErrorBody | null | undefined): string {
  if (status === 429) return serverReason(body) || TESTER_SAY.tooMany;
  if (status >= 500) return TESTER_SAY.server;
  if (status === 403 && text(body?.error) === MFA_REQUIRED) return serverReason(body);
  if (status === 403 && text(body?.error) === ORIGIN_DENIED) return TESTER_SAY.origin;
  if (status === 401) return serverReason(body) || TESTER_SAY.wrong;
  return TESTER_SAY.wrong;
}
