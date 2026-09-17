// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΠΟΦΑΣΗ «ΑΠΑΝΤΩ Ή ΟΧΙ», ΜΑΚΡΙΑ ΑΠΟ ΤΟ ΚΕΛΥΦΟΣ ΤΟΥ NEXT
// ─────────────────────────────────────────────────────────────────────────
// Η καθαρή λογική της αυτόματης επιβεβαίωσης ζει εδώ, όπως ζει και η καθαρή
// λογική κάθε άλλης διαδρομής μακριά από το route: δοκιμάζεται με ψεύτικη βάση
// και ψεύτικο αποστολέα, χωρίς next/server και χωρίς δίκτυο. Η διαδρομή απλώς
// υπολογίζει τον παραλήπτη, φτιάχνει τον πελάτη υπηρεσίας και επιστρέφει ό,τι
// αποφασίζει αυτή η συνάρτηση.
//
// ── Η ΣΕΙΡΑ ΤΩΝ ΦΡΕΝΩΝ, ΚΑΙ ΓΙΑΤΙ ΑΥΤΗ ───────────────────────────────────
//
// ΠΡΩΤΑ Ο ΑΥΤΟΜΑΤΟΣ ΑΠΟΣΤΟΛΕΑΣ. no-reply, mailer-daemon, ο δικός μας τομέας:
// σε αυτούς δεν απαντάμε ΠΟΤΕ, ούτε καν καταγράφουμε. Είναι το κύριο φρένο του
// βρόχου και μπαίνει πριν από κάθε άλλο ξόδεμα.
//
// ΜΕΤΑ Η ΠΕΡΙΟΔΟΣ ΗΣΥΧΙΑΣ. Το `try_support_ack` απαντά ατομικά αν αυτός ο
// αποστολέας δικαιούται απάντηση τώρα. `false` σημαίνει «μόλις του απαντήσαμε»:
// δεν είναι σφάλμα, είναι ακριβώς το δεύτερο φρένο του βρόχου.
//
// ΤΟ ΟΝΟΜΑ ΔΕΝ ΜΠΛΟΚΑΡΕΙ ΠΟΤΕ ΤΗΝ ΑΠΑΝΤΗΣΗ. Αν η αναζήτηση του ονόματος
// αποτύχει, στέλνουμε την επιβεβαίωση με προσφώνηση χωρίς όνομα. Μια αποτυχία
// ανάγνωσης δεν αξίζει να στερήσει από τον πελάτη την επιβεβαίωση που περιμένει.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js';
import { senderAddress, isAutomatedSender } from '@/lib/inbound/support';
import { nameForEmail, trySupportAck } from '@/lib/data/supportAck';
import { sendReplyAck, type AckInput, type AckResult } from '@/lib/inbound/sendAck';

/** Ο,τι επιστρέφει η απόφαση: κωδικός, σώμα και οι γραμμές καταγραφής της. */
export interface AckOutcome {
  status: number;
  body: Record<string, unknown>;
  logs: string[];
}

/** Ο αποστολέας της επιβεβαίωσης, ως όρισμα ώστε ο έλεγχος να μη χτυπά δίκτυο. */
export interface AckDeps {
  send?: (input: AckInput) => Promise<AckResult>;
}

/**
 * Η απόφαση και η εκτέλεση της αυτόματης επιβεβαίωσης για έναν αποστολέα.
 *
 * @param db     Ο πελάτης υπηρεσίας (παρακάμπτει την RLS).
 * @param from   Ο αποστολέας, όπως τον έγραψε το ταχυδρομείο («Ονομα <a@b>»).
 * @param apiKey Το κλειδί του παρόχου, από το περιβάλλον.
 */
export async function handleReplyAck(
  db: SupabaseClient, from: string, apiKey: string | undefined, deps: AckDeps = {},
): Promise<AckOutcome> {
  const send = deps.send ?? ((input: AckInput) => sendReplyAck(input));

  // ΠΡΩΤΟ ΦΡΕΝΟ: αυτόματος αποστολέας ή δική μας διεύθυνση. Ούτε καταγραφή.
  if (isAutomatedSender(from)) {
    return { status: 200, body: { ok: true, acked: false }, logs: ['αυτόματος αποστολέας, καμία απάντηση'] };
  }

  const sender = senderAddress(from);

  // ΔΕΥΤΕΡΟ ΦΡΕΝΟ: dedup/cooldown, ατομικά στη βάση.
  const ack = await trySupportAck(db, sender);
  if (ack.error) {
    // 500: κάτι δικό μας χάλασε στη βάση· ο πάροχος ξαναδοκιμάζει.
    return { status: 500, body: { error: 'ack_failed' }, logs: [`η καταγραφή της επιβεβαίωσης απέτυχε: ${ack.error.message}`] };
  }
  if (!ack.send) {
    return { status: 200, body: { ok: true, acked: false }, logs: ['ήδη απαντήθηκε πρόσφατα'] };
  }

  const logs: string[] = [];

  // Το όνομα είναι στολίδι, όχι προϋπόθεση: η αποτυχία του δεν ρίχνει την απάντηση.
  const nm = await nameForEmail(db, sender);
  if (nm.error) logs.push(`το όνομα δεν διαβάστηκε, συνεχίζω χωρίς: ${nm.error.message}`);
  const name = nm.error ? '' : nm.name;

  const res = await send({ to: sender, name, apiKey });
  if (!res.ok) {
    // 502: ο πάροχος δεν δέχτηκε το μήνυμα· να ξαναδοκιμάσει.
    logs.push(`η επιβεβαίωση δεν στάλθηκε: ${res.reason}`);
    return { status: 502, body: { error: 'ack_send_failed' }, logs };
  }

  logs.push('στάλθηκε επιβεβαίωση παραλαβής');
  return { status: 200, body: { ok: true, acked: true }, logs };
}
