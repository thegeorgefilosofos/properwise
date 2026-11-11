// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΡΟΩΘΗΣΗ ΤΩΝ EMAIL ΥΠΟΣΤΗΡΙΞΗΣ: ΜΙΑ ΡΟΥΤΙΝΑ, ΚΑΜΙΑ ΣΙΩΠΗΛΗ ΑΠΩΛΕΙΑ
// ─────────────────────────────────────────────────────────────────────────
// Κάθε email στο support@/privacy@/security@ γράφεται πρώτα στο `support_inbox`
// ως `pending`, με το ακριβές θέμα και reply_to που θα σταλούν. Μετά το προωθεί
// αυτή η ρουτίνα, από δύο σημεία:
//   · αμέσως, όταν φτάνει (app/api/inbound)·
//   · από το cron κάθε 10 λεπτά (app/api/support/forward), για ό,τι έμεινε.
// Κάθε προσπάθεια: δέσμευση της γραμμής (support_forward_claim, skip locked) →
// σώμα από τον πάροχο → αποστολή με κλειδί γενιάς → αποτέλεσμα στη βάση
// (support_forward_settle). Οι κανόνες για retry/config/message ζουν στη βάση.
// Μετά από 7 ημέρες: failed με ειδοποίηση (support_forward_expire).
// ═══════════════════════════════════════════════════════════════════════════
import { forwardKey, forwardSupport, type ForwardResult } from '@/lib/inbound/priority';
import type { BodyResult } from '@/lib/inbound/fetchBody';

/** Μία γραμμή όπως τη δίνει η support_forward_claim. */
export interface ClaimedRow {
  id: string; provider_id: string; reply_to: string | null; forward_subject: string | null;
  plan_rank: number; forward_gen: number;
}

export type Settled = { state: string | null; result: ForwardResult };

export interface ForwardDeps {
  to: string | undefined;
  apiKey: string | undefined;
  ownDomains: string[];
  fetchBody: (providerId: string) => Promise<BodyResult>;
  settle: (id: string, outcome: 'sent' | 'retry' | 'config' | 'message', code: string, uncertain: boolean) => Promise<{ state: string | null; error: unknown }>;
  fetcher?: typeof fetch;
}

/**
 * Μία προσπάθεια για μία δεσμευμένη γραμμή. Σφάλμα στη σημείωση του αποτελέσματος
 * πετιέται: ο καλών απαντά 5xx, ώστε τίποτα να μη χαθεί σιωπηλά.
 */
export async function forwardOne(row: ClaimedRow, deps: ForwardDeps): Promise<Settled> {
  let result: ForwardResult;
  const body = await deps.fetchBody(row.provider_id);
  if (!body.ok) {
    // Το σώμα δεν ήρθε: τίποτα δεν στάλθηκε, ξανά αργότερα με την ίδια γενιά.
    result = { ok: false, kind: 'retry', uncertain: false, code: 'body', reason: body.reason };
  } else {
    result = await forwardSupport({
      to: deps.to, apiKey: deps.apiKey, key: forwardKey(row.provider_id, row.forward_gen),
      replyTo: row.reply_to ?? '', subject: row.forward_subject ?? '(χωρίς θέμα)',
      body: body.body, urgent: false,
    }, deps.fetcher ?? fetch, deps.ownDomains);
  }
  const { state, error } = result.ok
    ? await deps.settle(row.id, 'sent', 'sent', false)
    : await deps.settle(row.id, result.kind, result.code, result.uncertain);
  if (error || state === null) throw new Error('support_forward_settle');
  return { state, result };
}

/** Ο απολογισμός μιας εκτέλεσης, για την απάντηση και τις ειδοποιήσεις. */
export interface ForwardTally { sent: number; pending: number; failed: number; codes: string[] }

/** Προωθεί όσες δεσμευμένες γραμμές δόθηκαν, μία μία. */
export async function forwardAll(rows: ClaimedRow[], deps: ForwardDeps): Promise<ForwardTally> {
  const t: ForwardTally = { sent: 0, pending: 0, failed: 0, codes: [] };
  for (const row of rows) {
    const { state, result } = await forwardOne(row, deps);
    if (state === 'sent') t.sent++;
    else if (state === 'failed') t.failed++;
    else t.pending++;
    if (!result.ok) t.codes.push(result.code);
  }
  return t;
}
