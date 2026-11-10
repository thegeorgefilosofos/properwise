// Η αποδοχή του δώρου της κλήρωσης αξιολόγησης από τον σύνδεσμο του email.
// Ίδια φύλαξη με το /api/plirosa: μόνο από τη δική μας προέλευση, μόνο JSON,
// χωρίς κρυφή μνήμη. Το διακριτικό ελέγχεται στη βάση (μόνο SHA-256, μίας
// χρήσης, λήξη 14 ημερών· 20261110133000).
import { NextResponse } from 'next/server';
import { createServiceClient, serviceClientError, SERVICE_CLIENT_LOG } from '@/lib/supabase/service';
import { acceptPrize } from '@/lib/feedback/prize';
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
  let body: { token?: unknown; adult?: unknown } = {};
  try { body = await request.json(); } catch { body = {}; }
  const token = typeof body.token === 'string' ? body.token : '';

  const missing = serviceClientError(process.env);
  if (missing) {
    console.info('[doro]', SERVICE_CLIENT_LOG, missing);
    return NextResponse.json({ ok: false, kind: 'error' }, { status: 503, headers: NO_STORE });
  }
  const out = await acceptPrize(createServiceClient(), token, body.adult === true);
  const status = out.ok ? 200
    : out.kind === 'invalid' ? 404
    : out.kind === 'adult_required' ? 422
    : out.kind === 'error' ? 503 : 409;
  return NextResponse.json(out, { status, headers: NO_STORE });
}
