// ═══════════════════════════════════════════════════════════════════════════
// Η ΦΟΡΜΑ ΥΠΟΣΤΗΡΙΞΗΣ: ΤΙ ΔΕΧΕΤΑΙ
// ─────────────────────────────────────────────────────────────────────────
// Οι Όροι («Υποστήριξη») υπόσχονται στο «Επαγγελματίας+» ότι τα μηνύματά του
// απαντώνται πριν από τα υπόλοιπα. Από email δεν μπορούμε να ξέρουμε ποιος
// έγραψε (lib/inbound/priority.ts)· από τη φόρμα ξέρουμε, γιατί ο αποστολέας
// είναι η συνεδρία. Εδώ ζει ό,τι κρίνεται χωρίς δίκτυο: όρια και μηνύματα.
// ═══════════════════════════════════════════════════════════════════════════

/** Τα όρια του κειμένου. Το θέμα είναι προαιρετικό. */
export const SUPPORT_SUBJECT_MAX = 150;
export const SUPPORT_MESSAGE_MIN = 10;
export const SUPPORT_MESSAGE_MAX = 5000;

export type SupportInput = { subject: string; message: string };
export type SupportCheck = { ok: true; value: SupportInput } | { ok: false; error: string };

/** Καθαρίζει και ελέγχει ό,τι έστειλε η οθόνη. Το θέμα γίνεται μία γραμμή. */
export function checkSupport(raw: { subject?: unknown; message?: unknown }): SupportCheck {
  const subject = String(raw.subject ?? '').replace(/[\r\n]+/g, ' ').trim();
  const message = String(raw.message ?? '').trim();
  if (subject.length > SUPPORT_SUBJECT_MAX) return { ok: false, error: `Το θέμα έχει όριο ${SUPPORT_SUBJECT_MAX} χαρακτήρες.` };
  if (message.length < SUPPORT_MESSAGE_MIN) return { ok: false, error: 'Γράψε λίγα λόγια για το τι χρειάζεσαι.' };
  if (message.length > SUPPORT_MESSAGE_MAX) return { ok: false, error: `Το μήνυμα έχει όριο ${SUPPORT_MESSAGE_MAX} χαρακτήρες.` };
  return { ok: true, value: { subject: subject || 'Μήνυμα από την εφαρμογή', message } };
}
