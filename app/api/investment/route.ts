// ═══════════════════════════════════════════════════════════════════════════
// ΕΠΕΝΔΥΤΙΚΗ ΑΝΑΛΥΣΗ (IRR / NPV / DSCR) — Η ΠΥΛΗ ΖΕΙ ΣΤΟΝ SERVER
//
// Η οθόνη κρύβει το πληρωμένο μπλοκ όταν το πακέτο δεν φτάνει, αλλά ένα λουκέτο
// μόνο στο JS ξεκλειδώνει με «View source». Εδώ ο υπολογισμός γίνεται στον
// server και δεν επιστρέφεται καθόλου αν το πακέτο δεν είναι «Επαγγελματίας»:
// η `requireFeature('investment_analysis')` διαβάζει το πλάνο από τη βάση
// (`public.user_plan_rank`) και κόβει με 403 πριν τρέξει η μηχανή.
// ═══════════════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';
import { sameOrigin, ORIGIN_DENIED } from '@/lib/api/origin';
import { requireFeature, featureDenialResponse } from '@/lib/billing/requireFeature';
import { analyzeInvestment } from './analyze';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers)) {
    return NextResponse.json({ error: ORIGIN_DENIED }, { status: 403 });
  }

  const gate = await requireFeature('investment_analysis');
  if (!gate.ok) return featureDenialResponse(gate);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Μη αναγνώσιμο αίτημα.' }, { status: 400 });
  }

  const outcome = analyzeInvestment(body);
  return NextResponse.json(outcome.body, { status: outcome.status });
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
