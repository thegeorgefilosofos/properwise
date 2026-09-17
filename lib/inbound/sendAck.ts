// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΠΟΣΤΟΛΗ ΤΗΣ ΕΠΙΒΕΒΑΙΩΣΗΣ ΠΑΡΑΛΑΒΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Το ίδιο σχήμα με το fetchBody, από την άλλη κατεύθυνση: εκεί ΖΗΤΑΜΕ κείμενο
// από τον πάροχο, εδώ του ΔΙΝΟΥΜΕ ένα μήνυμα να στείλει. Το κλειδί έρχεται ως
// όρισμα από μεταβλητή περιβάλλοντος και δεν γράφεται ποτέ σε αρχείο καταγραφής.
//
// Ο αποστολέας και το reply_to είναι η διεύθυνση υποστήριξης: η απάντηση του
// πελάτη σε αυτό το μήνυμα πρέπει να φτάνει σε άνθρωπο, όχι σε κενό.
// ═══════════════════════════════════════════════════════════════════════════

import { replyAckEmail } from '@/lib/email/ack';
import { IDENTITY } from '@/lib/legal/identity';

/** Η διεύθυνση αποστολής μηνυμάτων του παρόχου. Γραμμένη μία φορά. */
export const SEND_URL = 'https://api.resend.com/emails';

/** Η διεύθυνση υποστήριξης, ως αποστολέας και ως reply_to. */
const REPLY_TO = IDENTITY.supportEmail;
const FROM = `PROPERWISE Support <${REPLY_TO}>`;

export interface AckInput {
  to: string;
  name: string;
  apiKey: string | undefined;
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

  const { subject, html } = replyAckEmail(input.name);

  let res: Response;
  try {
    res = await fetcher(SEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to, subject, html }),
    });
  } catch {
    // Η ΑΙΤΙΑ ΔΕΝ ΤΑΞΙΔΕΥΕΙ. Το μήνυμα ενός σφάλματος δικτύου κουβαλά συχνά
    // διεύθυνση και υποδομή· ο καλών χρειάζεται μόνο «δεν απάντησε».
    return { ok: false, reason: 'ο πάροχος δεν απάντησε' };
  }
  if (!res.ok) return { ok: false, reason: `ο πάροχος απάντησε ${res.status}` };
  return { ok: true };
}
