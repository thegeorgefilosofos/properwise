// ═══════════════════════════════════════════════════════════════════════════
// ΠΟΙΟ ΜΗΝΥΜΑ ΠΑΙΡΝΕΙ ΑΥΤΟΜΑΤΗ ΑΠΑΝΤΗΣΗ, ΚΑΙ ΠΟΙΟΣ ΔΕΝ ΠΡΕΠΕΙ ΠΟΤΕ ΝΑ ΤΗΝ ΠΑΡΕΙ
// ─────────────────────────────────────────────────────────────────────────
// Καθαρές συναρτήσεις, χωρίς βάση και χωρίς δίκτυο: κρίνουν μόνο πάνω στα
// μεταδεδομένα του μηνύματος. Η διαδρομή του webhook τις ρωτά πριν ξοδέψει
// οτιδήποτε — μια κλήση στη βάση, μια αποστολή στον πάροχο.
//
// ── ΤΟ ΦΡΕΝΟ ΤΟΥ ΒΡΟΧΟΥ ΕΙΝΑΙ ΔΙΠΛΟ ──────────────────────────────────────
// Μια αυτόματη απάντηση που φεύγει σε λάθος αποστολέα γεννά βρόχο: το δικό μας
// «το λάβαμε» χτυπά ένα no-reply, εκείνο απαντά, εμείς ξανα-απαντάμε. Δύο
// ανεξάρτητα φρένα το σταματούν και τα δύο ζουν εδώ ή δίπλα:
//
//   1. `isAutomatedSender` κόβει τους αποστολείς που ΔΕΝ διαβάζει άνθρωπος
//      (no-reply, mailer-daemon, postmaster) ΚΑΙ κάθε διεύθυνση του δικού μας
//      τομέα — δεν απαντάμε ποτέ στον εαυτό μας ή στα εξερχόμενά μας.
//   2. Η περίοδος ησυχίας ανά αποστολέα (στη βάση) εγγυάται ΜΙΑ απάντηση, ακόμη
//      κι αν το πρώτο φρένο κάποτε αστοχήσει.
// ═══════════════════════════════════════════════════════════════════════════

import { MAIL_DOMAIN } from '@/lib/legal/identity';

/** Τα τοπικά μέρη των δημόσιων διευθύνσεων που δέχονται αυτόματη επιβεβαίωση. */
export const SUPPORT_LOCALPARTS = ['support', 'privacy', 'security'] as const;

/** Ο βαθμός ευαισθησίας: όσο μεγαλύτερος, τόσο πιο ευαίσθητο το θέμα. */
const SENSITIVITY = { support: 1, privacy: 2, security: 3 } as const;

type SupportKind = (typeof SUPPORT_LOCALPARTS)[number];

/**
 * Η σκέτη διεύθυνση του αποστολέα, σε πεζά, ή κενό όταν δεν αναγνωρίζεται.
 *
 * Δέχεται και τη μορφή «Ονομα <a@b>», όπως τη γράφει ο πελάτης αλληλογραφίας.
 * Ο,τι δεν έχει καθαρό `τοπικό@τομέας` (π.χ. όνομα χωρίς αγκύλες) γίνεται κενό:
 * καλύτερα καμία απάντηση παρά απάντηση σε μισοδιαβασμένη διεύθυνση.
 */
export function senderAddress(from: string): string {
  const raw = (from || '').trim();
  const inside = /<([^<>]+)>/.exec(raw);
  const addr = (inside ? inside[1] : raw).trim().toLowerCase();
  if (/\s/.test(addr)) return '';
  const at = addr.lastIndexOf('@');
  if (at < 1 || at === addr.length - 1) return '';
  return addr;
}

/**
 * Ποιας δημόσιας διεύθυνσης είναι παραλήπτης το μήνυμα, ή `null`.
 *
 * Ταιριάζει `τοπικό@τομέας` όπου το τοπικό (πεζά, πριν από κάθε `+`) ανήκει στα
 * `SUPPORT_LOCALPARTS` και ο τομέας σε έναν από τους δικούς μας.
 *
 * ΟΤΑΝ ΤΑΙΡΙΑΖΟΥΝ ΠΟΛΛΑ, ΝΙΚΑ ΤΟ ΠΙΟ ΕΥΑΙΣΘΗΤΟ: security > privacy > support.
 * Ενα μήνυμα σε security@ ΚΑΙ support@ αφορά αναφορά ευπάθειας· η διεύθυνση της
 * ασφάλειας δεν πρέπει να υποβαθμιστεί επειδή έτυχε να μπει και η υποστήριξη.
 */
export function supportRecipientKind(
  recipients: readonly string[], domains: readonly string[],
): SupportKind | null {
  const doms = domains.map(d => (d || '').trim().toLowerCase()).filter(Boolean);
  if (!doms.length) return null;

  let best: SupportKind | null = null;
  for (const r of recipients) {
    const inside = /<([^<>]+)>/.exec((r || '').trim());
    const addr = (inside ? inside[1] : (r || '')).trim().toLowerCase();
    const at = addr.lastIndexOf('@');
    if (at < 1) continue;
    const local = addr.slice(0, at).split('+')[0];
    const domain = addr.slice(at + 1);
    if (!doms.includes(domain)) continue;
    if (!(SUPPORT_LOCALPARTS as readonly string[]).includes(local)) continue;

    const kind = local as SupportKind;
    if (best === null || SENSITIVITY[kind] > SENSITIVITY[best]) best = kind;
  }
  return best;
}

/**
 * Πρέπει να ΜΗΝ απαντήσουμε αυτόματα σε αυτόν τον αποστολέα;
 *
 * true όταν: η διεύθυνση λείπει ή δεν αναγνωρίζεται· το τοπικό μέρος είναι
 * μηχανή (no-reply, mailer-daemon, postmaster, bounce, abuse, notifications)
 * ή περιέχει `noreply`/`no-reply`· Η ο τομέας είναι ο δικός μας — το κύριο
 * φρένο του βρόχου, ώστε να μην απαντάμε ποτέ στις δικές μας διευθύνσεις ή
 * στα εξερχόμενά μας.
 */
export function isAutomatedSender(from: string): boolean {
  const addr = senderAddress(from);
  if (!addr) return true;

  const at = addr.lastIndexOf('@');
  const local = addr.slice(0, at);
  const domain = addr.slice(at + 1);

  if (domain === MAIL_DOMAIN) return true;
  if (/no-?reply/i.test(local)) return true;
  return /^(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|bounce(s)?|abuse|notifications?)$/i.test(local);
}
