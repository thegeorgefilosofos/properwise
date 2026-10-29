// ═══════════════════════════════════════════════════════════════════════════
// POST /api/plirosa — «Πλήρωσα» και αναίρεση, χωρίς σύνδεση
// ─────────────────────────────────────────────────────────────────────────
// Σώμα: { token, action: 'pay' | 'undo', expense?: true }. Η δαπάνη γράφεται
// μόνο με `expense: true`, που το στέλνει η σελίδα επιβεβαίωσης όταν ο χρήστης
// το επιλέξει· το κουμπί της ειδοποίησης δεν το στέλνει ποτέ. Το διακριτικό είναι το κλειδί
// (lib/reminders/payLink.ts): 256 bit, μόνο το αποτύπωμα στη βάση, μίας
// χρήσης, με λήξη, δεμένο σε χρήστη και γεγονός.
//
// CSRF. Δεν υπάρχει συνεδρία να κλέψει κανείς: χωρίς το διακριτικό, ένα ξένο
// site δεν έχει τι να στείλει. Επιπλέον, όταν ο περιηγητής δηλώνει `Origin`,
// πρέπει να είναι ο δικός μας· το service worker στέλνει από το ίδιο origin.
// Και μόνο `application/json`: μια φόρμα άλλου site δεν μπορεί να το στείλει
// χωρίς preflight CORS, που εδώ δεν απαντιέται.
// Μόνο POST: το GET της σελίδας επιβεβαίωσης δεν αλλάζει τίποτα.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { createServiceClient, serviceClientError, SERVICE_CLIENT_LOG } from '@/lib/supabase/service';
import { redeemPayToken, undoPayToken } from '@/lib/reminders/payRedeem';
import { athensToday } from '@/lib/core/time';
import { siteUrl } from '@/lib/core/site';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(siteUrl('/')).origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ ok: false, kind: 'forbidden' }, { status: 403, headers: NO_STORE });
  }
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return NextResponse.json({ ok: false, kind: 'unsupported' }, { status: 415, headers: NO_STORE });
  }
  let body: { token?: unknown; action?: unknown; expense?: unknown } = {};
  try { body = await request.json(); } catch { body = {}; }
  const token = typeof body.token === 'string' ? body.token : '';
  const action = body.action === 'undo' ? 'undo' : 'pay';

  const missing = serviceClientError(process.env);
  if (missing) {
    console.info('[plirosa]', SERVICE_CLIENT_LOG, missing);
    return NextResponse.json({ ok: false, kind: 'error' }, { status: 503, headers: NO_STORE });
  }
  const db = createServiceClient();
  const now = new Date();
  const out = action === 'undo' ? await undoPayToken(db, token, now) : await redeemPayToken(db, token, now, athensToday(), body.expense === true);
  // Σφάλμα βάσης (και πίνακας που δεν υπάρχει ακόμη) είναι 503: προσωρινό, όχι
  // βλάβη του αιτήματος. Η σελίδα και το service worker δείχνουν «δοκίμασε ξανά».
  const status = out.ok ? 200 : out.kind === 'invalid' ? 404 : out.kind === 'error' ? 503 : 409;
  return NextResponse.json(out, { status, headers: NO_STORE });
}
