// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ CRON ΤΗΣ ΠΡΟΩΘΗΣΗΣ ΥΠΟΣΤΗΡΙΞΗΣ (κάθε 10 λεπτά, pg_cron, 20261110134000)
// ─────────────────────────────────────────────────────────────────────────
// Ο,τι δεν προωθήθηκε τη στιγμή που ήρθε (δίκτυο, 5xx, λάθος ρύθμισης) ξανα-
// δοκιμάζεται εδώ, χωρίς να περιμένει νέο email. Πρώτα: ό,τι εκκρεμεί πάνω από
// 7 ημέρες γίνεται failed, με ειδοποίηση. Μετά: έως 20 δεσμευμένες γραμμές
// (skip locked), από τη νωρίτερη `next_attempt_at`. Ταυτότητα: το κοινό μυστικό
// των εργασιών. Στα logs και στις ειδοποιήσεις μόνο αριθμοί και κωδικοί.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { cronSecretOk, CRON_SECRET_ENV } from '@/lib/api/cronSecret';
import { createServiceClient, serviceClientError, SERVICE_CLIENT_LOG } from '@/lib/supabase/service';
import { forwardAll, type ClaimedRow } from '@/lib/support/forwarder';
import { forwardDeps } from '@/lib/support/forwardDeps';
import { reportRoute, codeOf } from '@/lib/observability/route';

const ROUTE = 'api/support/forward';
const BATCH = 20;
const log = (...parts: unknown[]) => console.info('[support-forward]', ...parts);

export async function POST(request: Request) {
  if (!cronSecretOk(request.headers, process.env[CRON_SECRET_ENV])) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const missing = serviceClientError(process.env);
  if (missing) {
    log(SERVICE_CLIENT_LOG, missing);
    return NextResponse.json({ error: 'not_configured' }, { status: 500 });
  }
  const db = createServiceClient();

  const { data: expired, error: expireError } = await db.rpc('support_forward_expire');
  if (expireError) {
    void reportRoute(ROUTE, 'expire failed', { status: 500, code: codeOf(expireError) });
    return NextResponse.json({ error: 'expire_failed' }, { status: 500 });
  }
  if (Number(expired) > 0) {
    log(`έληξαν ${expired} μηνύματα χωρίς προώθηση`);
    void reportRoute(ROUTE, 'support forward expired', { status: 200, code: `expired:${expired}` });
  }

  const { data: claimed, error: claimError } = await db.rpc('support_forward_claim', { p_limit: BATCH });
  if (claimError) {
    void reportRoute(ROUTE, 'claim failed', { status: 500, code: codeOf(claimError) });
    return NextResponse.json({ error: 'claim_failed' }, { status: 500 });
  }

  let tally;
  try {
    tally = await forwardAll((claimed ?? []) as ClaimedRow[], forwardDeps(db));
  } catch {
    void reportRoute(ROUTE, 'settle failed', { status: 500 });
    return NextResponse.json({ error: 'settle_failed' }, { status: 500 });
  }
  if (tally.failed) void reportRoute(ROUTE, 'support forward failed', { status: 200, code: tally.codes.join(',').slice(0, 60) });
  if (tally.codes.some(c => c.startsWith('config:'))) void reportRoute(ROUTE, 'support forward misconfigured', { status: 200, code: tally.codes.find(c => c.startsWith('config:')) ?? null });
  log(`προωθήθηκαν ${tally.sent}, εκκρεμούν ${tally.pending}, απέτυχαν ${tally.failed}`);
  return NextResponse.json({ ok: true, expired: Number(expired) || 0, ...tally });
}
