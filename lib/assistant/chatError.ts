// ═══════════════════════════════════════════════════════════════════════════
// ΤΙ ΕΙΔΟΥΣ ΑΡΝΗΣΗ ΕΙΝΑΙ Η ΑΠΑΝΤΗΣΗ ΤΗΣ ΝΟΑΣ
// ─────────────────────────────────────────────────────────────────────────
// Η διαδρομή /api/anthropic αρνείται για πέντε πολύ διαφορετικούς λόγους και
// καθένας θέλει άλλη πρόταση στην οθόνη: όριο ερωτήσεων (429), πακέτο χωρίς
// τη Νόα (403 με `reason: 'plan'`), λείπει το κλειδί, λάθος στο αίτημα
// (400/413) ή βλάβη.
//
// ΤΙ ΓΙΝΟΤΑΝ (έλεγχος 12.11.2026, εύρημα 11). Το 403 του πακέτου έπεφτε στη
// «βλάβη» και ο χρήστης του δωρεάν πακέτου διάβαζε «δοκίμασε ξανά σε λίγο».
// Οσο κι αν ξαναδοκίμαζε, η απάντηση θα ήταν ίδια· και δεν μάθαινε ποτέ ότι
// η Νόα υπάρχει σε άλλο πακέτο.
//
// Χωρίς React, ώστε η επιλογή να ελέγχεται (chatError.test.ts).
// ═══════════════════════════════════════════════════════════════════════════

/** Τα είδη της άρνησης, όπως τα αποδίδει το πάνελ (PropertyAssistant). */
export type ChatErrKind = 'limit' | 'plan' | 'key' | 'service';

export interface ChatErr {
  kind: ChatErrKind;
  /** Το κείμενο του διακομιστή, όταν λέει στον χρήστη τι να κάνει. Αλλιώς κενό. */
  message: string;
}

/** Η απάντηση μιας αποτυχημένης κλήσης σε είδος και μήνυμα. */
export function classifyChatError(status: number, data: unknown): ChatErr {
  const body = (data && typeof data === 'object' ? data : {}) as { error?: unknown; reason?: unknown };
  const error = typeof body.error === 'string' ? body.error : '';
  if (status === 429) return { kind: 'limit', message: error };
  if (status === 403 && body.reason === 'plan') return { kind: 'plan', message: error };
  if (error.includes('ANTHROPIC_API_KEY')) return { kind: 'key', message: '' };
  // 400/413: ο διακομιστής λέει ΤΙ να αλλάξει ο χρήστης· το γενικό «δοκίμασε
  // ξανά» θα τον έβαζε να ξαναστείλει το ίδιο πράγμα.
  return { kind: 'service', message: status === 400 || status === 413 ? error : '' };
}
