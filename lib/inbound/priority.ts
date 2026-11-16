// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΡΟΤΕΡΑΙΟΤΗΤΑ ΣΤΟ EMAIL ΥΠΟΣΤΗΡΙΞΗΣ, ΧΩΡΙΣ ΝΑ ΤΗΝ ΠΛΑΣΤΟΓΡΑΦΕΙ ΚΑΝΕΙΣ
// ─────────────────────────────────────────────────────────────────────────
// Οι Όροι (ενότητα «Υποστήριξη») λένε ότι στο πακέτο από
// firstPlanWith(PRIORITY_SUPPORT_LINE) και πάνω «τα μηνύματά σου στη διεύθυνση
// αυτή απαντώνται πριν από τα υπόλοιπα».
//
// ΤΟ FROM ΔΕΝ ΕΙΝΑΙ ΤΑΥΤΟΤΗΤΑ. Ο καθένας γράφει στο From τη διεύθυνση ενός
// πελάτη «Επαγγελματίας+». Ο πάροχος παραλαβής (Resend) ΔΕΝ δίνει αποτέλεσμα
// SPF/DKIM/DMARC: το μήνυμα έρχεται με `headers: Record<string, string>`, μία
// τιμή ανά όνομα κεφαλίδας, οπότε ένα `Authentication-Results` που έγραψε ο
// ίδιος ο αποστολέας δεν ξεχωρίζει από αυτό του παραλήπτη. Επαλήθευση από εδώ
// δεν γίνεται.
//
// ΑΡΑ ΓΙΑ ΤΑ EMAIL ΑΠΟ ΕΞΩ Η ΣΗΜΑΝΣΗ ΕΙΝΑΙ ΥΠΟΨΙΑ, ΟΧΙ ΠΡΟΝΟΜΙΟ:
//   · στο inbox της υποστήριξης: «[Πιθανή προτεραιότητα, μη επαληθευμένη · <πακέτο>]»
//     και κανονική σπουδαιότητα (X-Priority 3). Ο άνθρωπος απαντά στη διεύθυνση
//     του From· αν το μήνυμα ήταν πλαστό, η απάντηση φτάνει στον πραγματικό
//     κάτοχο και όχι στον πλαστογράφο.
//   · στο `support_inbox`: `priority_claimed` και `sender_verified = false`.
//   · στην αυτόματη επιβεβαίωση: καμία λέξη για προτεραιότητα.
//
// Η ΕΓΓΥΗΜΕΝΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ ΠΕΡΝΑ ΑΠΟ ΤΗ ΦΟΡΜΑ (app/api/support). Εκεί ο
// αποστολέας είναι η συνεδρία, η βάση δίνει διεύθυνση και πακέτο
// (`support_submit`) και το θέμα γράφει «[Προτεραιότητα · <πακέτο>]».
//
// ΓΙΑΤΙ ΟΧΙ ΣΤΟ support@. Το SUPPORT_FORWARD_TO πρέπει να είναι εξωτερικό
// inbox. Η διεύθυνση support@ και ο τομέας της παραλαμβάνονται από τον Resend
// inbound και φτάνουν σε αυτή τη διαδρομή: προώθηση εκεί θα ξαναερχόταν εδώ ως
// νέο εισερχόμενο (βρόχος). Βλ. docs/ops/inbound-email.md.
// ═══════════════════════════════════════════════════════════════════════════
import { PLANS, PLAN_ORDER, PRIORITY_SUPPORT_LINE, firstPlanWith, type PlanId } from '@/lib/billing/plans';
import { SEND_URL } from '@/lib/inbound/sendAck';
import { IDENTITY } from '@/lib/legal/identity';
import type { FetchedBody } from '@/lib/inbound/fetchBody';

/** Η μεταβλητή περιβάλλοντος με τη διεύθυνση που διαβάζει τα μηνύματα υποστήριξης. */
export const FORWARD_ENV = 'SUPPORT_FORWARD_TO';

/** Το πρώτο πακέτο με προτεραιότητα, όπως το γράφει ο τιμοκατάλογος και οι Όροι. */
export const PRIORITY_FROM: PlanId = firstPlanWith(PRIORITY_SUPPORT_LINE);

export interface SupportPriority {
  /** Το πακέτο που αντιστοιχεί στο επίπεδο (`plan_rank` = θέση στο PLAN_ORDER). */
  plan: PlanId;
  rank: number;
  /** Το πακέτο του From δικαιούται προτεραιότητα. Ο αποστολέας δεν έχει επαληθευτεί. */
  claimed: boolean;
}

/** Από επίπεδο της βάσης σε υποψία προτεραιότητας. Άγνωστο ή άκυρο επίπεδο: όχι. */
export function supportPriority(rank: number | null | undefined): SupportPriority {
  const r = Number.isInteger(rank) && (rank as number) >= 0 && (rank as number) < PLAN_ORDER.length ? rank as number : 0;
  return { plan: PLAN_ORDER[r], rank: r, claimed: r >= PLAN_ORDER.indexOf(PRIORITY_FROM) };
}

/**
 * Το θέμα όπως φτάνει στο inbox. «Προτεραιότητα» σκέτο μόνο για αποστολέα που
 * επαληθεύτηκε από τη συνεδρία (φόρμα)· για email από έξω «πιθανή, μη επαληθευμένη».
 */
export function forwardSubject(subject: string, p: SupportPriority, verified = false): string {
  // Χωρίς αλλαγές γραμμής: το θέμα έρχεται από τον αποστολέα και γίνεται κεφαλίδα.
  const s = (subject || '').replace(/[\r\n]+/g, ' ').trim() || '(χωρίς θέμα)';
  if (!p.claimed) return s;
  return verified
    ? `[Προτεραιότητα · ${PLANS[p.plan].name}] ${s}`
    : `[Πιθανή προτεραιότητα, μη επαληθευμένη · ${PLANS[p.plan].name}] ${s}`;
}

/**
 * Το Idempotency-Key μιας προώθησης: μήνυμα και γενιά. Ο πάροχος το κρατά 24
 * ώρες. Η γενιά αλλάζει μόνο μετά από σίγουρη αποτυχία (support_forward_settle),
 * όπως στην ουρά email (_shared/outboxKey.ts).
 */
export const forwardKey = (providerId: string, gen = 0): string => `support-forward/${providerId}/${gen}`;

/** Γιατί δεν γίνεται προώθηση σε δικό μας τομέα, όπως το διαβάζει ο χειριστής. */
export const OWN_DOMAIN_REASON =
  `το ${FORWARD_ENV} δείχνει σε τομέα που παραλαμβάνουμε (Resend inbound): η προώθηση θα ξαναερχόταν εδώ, βρόχος. Όρισε εξωτερικό inbox (docs/ops/inbound-email.md)`;

/**
 * Τι σημαίνει μια αποτυχία, για το τι κάνουμε μετά.
 *   retry   : δίκτυο, 5xx, 429, 409 concurrent_idempotent_requests· ίδιο κλειδί.
 *   config  : 401, 403, κενή ρύθμιση, 422 που αναφέρει domain ή sender· λάθος
 *             ΔΙΚΟ ΜΑΣ, δεν μετρά στις προσπάθειες του μηνύματος.
 *   message : κάθε άλλο 4xx (και 409 invalid_idempotent_request)· πρόβλημα του
 *             ίδιου του μηνύματος, μετρά, failed στις 3.
 * `uncertain`: το αίτημα ίσως έφτασε (δίκτυο, 5xx, 409)· η γενιά του κλειδιού
 * δεν αλλάζει, αλλιώς νέο κλειδί θα έστελνε δεύτερο μήνυμα.
 */
export type FailKind = 'retry' | 'config' | 'message';
export type ForwardResult =
  | { ok: true }
  | { ok: false; kind: FailKind; uncertain: boolean; code: string; reason: string };

const CONFIG_422 = /domain|sender|\bfrom\b/i;

/** Η κρίση μιας απάντησης του παρόχου (status και σώμα). Καθαρή, για δοκιμή. */
export function classifyResend(status: number, body: string): ForwardResult {
  if (status >= 200 && status < 300) return { ok: true };
  let name = '';
  let message = '';
  try { const j = JSON.parse(body) as { name?: unknown; message?: unknown }; name = String(j?.name ?? ''); message = String(j?.message ?? ''); } catch { /* όχι JSON */ }
  const fail = (kind: FailKind, uncertain: boolean, code: string): ForwardResult =>
    ({ ok: false, kind, uncertain, code, reason: `ο πάροχος απάντησε ${status}${name ? ` (${name})` : ''}` });
  if (status === 409) {
    return name === 'concurrent_idempotent_requests' ? fail('retry', true, '409') : fail('message', true, `message:409`);
  }
  if (status === 429) return fail('retry', false, '429');
  if (status >= 500) return fail('retry', true, String(status));
  if (status === 401 || status === 403) return fail('config', false, `config:${status}`);
  if (status === 422 && CONFIG_422.test(`${name} ${message}`)) return fail('config', false, 'config:422');
  return fail('message', false, `message:${status}`);
}

export interface ForwardInput {
  to: string | undefined;
  apiKey: string | undefined;
  /** Το πλήρες Idempotency-Key (forwardKey). */
  key: string;
  /** Η ακριβής διεύθυνση απάντησης, όπως αποθηκεύτηκε στην πρώτη προσπάθεια. */
  replyTo: string;
  /** Το ακριβές θέμα, όπως αποθηκεύτηκε στην πρώτη προσπάθεια (forwardSubject). */
  subject: string;
  body: FetchedBody;
  /** Εγγυημένη προτεραιότητα (φόρμα, πακέτο που τη δικαιούται): X-Priority 1. */
  urgent?: boolean;
}

/**
 * Μία προσπάθεια προώθησης στο inbox της υποστήριξης, με ακριβώς το σώμα που
 * δόθηκε. Η απόφαση για το τι γίνεται μετά είναι του καλούντος (forwarder.ts).
 *
 * @param fetcher    Δίνεται ως όρισμα ώστε ο έλεγχος να μη χτυπά δίκτυο.
 * @param ownDomains Οι τομείς που παραλαμβάνουμε· εκεί δεν προωθούμε.
 */
export async function forwardSupport(
  input: ForwardInput, fetcher: typeof fetch = fetch, ownDomains: string[] = [],
): Promise<ForwardResult> {
  const config = (code: string, reason: string): ForwardResult => ({ ok: false, kind: 'config', uncertain: false, code, reason });
  const to = (input.to || '').trim();
  if (!to) return config('config:env', `χωρίς ${FORWARD_ENV}`);
  // Σε δικό μας τομέα η προώθηση θα ξαναερχόταν εδώ ως νέο εισερχόμενο.
  const toDomain = to.slice(to.lastIndexOf('@') + 1).replace(/>$/, '').toLowerCase();
  if (ownDomains.some(d => d.toLowerCase() === toDomain)) return config('config:own-domain', OWN_DOMAIN_REASON);
  const key = (input.apiKey || '').trim();
  if (!key) return config('config:key', 'χωρίς κλειδί παρόχου');

  const payload: Record<string, unknown> = {
    from: `PROPERWISE Support <${IDENTITY.supportEmail}>`,
    to,
    reply_to: input.replyTo,
    subject: input.subject,
  };
  if (input.urgent) payload.headers = { 'X-Priority': '1' };
  if (input.body.html) payload.html = input.body.html;
  payload.text = input.body.text ?? (input.body.html ? undefined : '(κενό μήνυμα)');

  let res: Response;
  try {
    res = await fetcher(SEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': input.key },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, kind: 'retry', uncertain: true, code: 'network', reason: 'ο πάροχος δεν απάντησε' };
  }
  if (res.ok) return { ok: true };
  return classifyResend(res.status, await res.text().catch(() => ''));
}
