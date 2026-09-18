// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΠΟΣΤΟΛΗ ΤΗΣ ΕΠΙΒΕΒΑΙΩΣΗΣ ΠΑΡΑΛΑΒΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Το ίδιο σχήμα με το fetchBody, από την άλλη κατεύθυνση: εκεί ΖΗΤΑΜΕ κείμενο
// από τον πάροχο, εδώ του ΔΙΝΟΥΜΕ ένα μήνυμα να στείλει. Το κλειδί έρχεται ως
// όρισμα από μεταβλητή περιβάλλοντος και δεν γράφεται ποτέ σε αρχείο καταγραφής.
//
// Ο αποστολέας και το reply_to είναι Η ΙΔΙΑ ΔΙΕΥΘΥΝΣΗ ΠΟΥ ΕΓΡΑΨΕ Ο ΠΕΛΑΤΗΣ:
// όποιος γράφει στο privacy@ παίρνει απάντηση από privacy@ και η δική του
// απάντηση γυρίζει στο ίδιο γραμματοκιβώτιο — όχι στο support@. Η απάντηση του
// πελάτη πρέπει να φτάνει σε άνθρωπο, στο σωστό νήμα, όχι σε κενό.
// ═══════════════════════════════════════════════════════════════════════════

import { replyAckEmail } from '@/lib/email/ack';
import { IDENTITY } from '@/lib/legal/identity';

/** Η διεύθυνση αποστολής μηνυμάτων του παρόχου. Γραμμένη μία φορά. */
export const SEND_URL = 'https://api.resend.com/emails';

/** Ποια δημόσια διεύθυνση δέχτηκε το μήνυμα — ορίζει αποστολέα και reply_to. */
export type AckKind = 'support' | 'privacy' | 'security';

/** Η διεύθυνση και το εμφανιζόμενο όνομα του αποστολέα, ανά είδος. */
const ACK_FROM: Record<AckKind, { address: string; label: string }> = {
  support:  { address: IDENTITY.supportEmail,  label: 'PROPERWISE Support' },
  privacy:  { address: IDENTITY.privacyEmail,  label: 'PROPERWISE Privacy' },
  security: { address: IDENTITY.securityEmail, label: 'PROPERWISE Security' },
};

export interface AckInput {
  to: string;
  name: string;
  apiKey: string | undefined;
  /** Η δημόσια διεύθυνση που γράφτηκε· λείπει σημαίνει υποστήριξη (εφεδρεία). */
  kind?: AckKind;
}

export type AckResult = { ok: true } | { ok: false; reason: string };

/**
 * Στέλνει την επιβεβαίωση παραλαβής στον αποστολέα.
 *
 * @param fetcher Δίνεται ως όρισμα ώστε ο έλεγχος να μη χτυπά δίκτυο.
 */
export async function sendReplyAck(
  input: AckInput, fetcher: typeof fetch = fetch,
): Promise<AckResult> {
  const key = (input.apiKey || '').trim();
  if (!key) return { ok: false, reason: 'χωρίς κλειδί παρόχου' };

  const to = (input.to || '').trim();
  if (!to) return { ok: false, reason: 'χωρίς παραλήπτη' };

  const box = ACK_FROM[input.kind ?? 'support'];
  const replyTo = box.address;
  const from = `${box.label} <${replyTo}>`;

  const { subject, html } = replyAckEmail(input.name);

  let res: Response;
  try {
    res = await fetcher(SEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, reply_to: replyTo, to, subject, html }),
    });
  } catch {
    // Η ΑΙΤΙΑ ΔΕΝ ΤΑΞΙΔΕΥΕΙ. Το μήνυμα ενός σφάλματος δικτύου κουβαλά συχνά
    // διεύθυνση και υποδομή· ο καλών χρειάζεται μόνο «δεν απάντησε».
    return { ok: false, reason: 'ο πάροχος δεν απάντησε' };
  }
  if (!res.ok) return { ok: false, reason: `ο πάροχος απάντησε ${res.status}` };
  return { ok: true };
}
