// ═══════════════════════════════════════════════════════════════════════════
// ΕΞΑΓΩΓΗ Ε2 — ΤΟ ΑΡΧΕΙΟ ΠΑΡΑΓΕΤΑΙ ΣΤΟΝ SERVER, ΠΙΣΩ ΑΠΟ ΤΗΝ ΠΥΛΗ ΠΑΚΕΤΟΥ
//
// Το προσυμπληρωμένο Ε2 (Excel) είναι πληρωμένο παραδοτέο. Οσο χτιζόταν στον
// browser, το λουκέτο ζούσε μόνο στην οθόνη: ο δωρεάν λογαριασμός έπαιρνε το
// ίδιο αρχείο χτυπώντας τη συνάρτηση. Τώρα το βιβλίο φτιάχνεται εδώ, μόνο αφού
// η `requireFeature('e2_export')` επιβεβαιώσει το πακέτο από τη βάση.
// ═══════════════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';
import { sameOrigin, ORIGIN_DENIED } from '@/lib/api/origin';
import { requireFeature, featureDenialResponse } from '@/lib/billing/requireFeature';
import { createClient } from '@/lib/supabase/server';
import { loadE2Rows, buildE2Workbook } from '@/app/dashboard/components/e2Export';
import { workbookBytes } from '@/app/dashboard/components/xlsxStyle';

export const runtime = 'nodejs';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers)) {
    return NextResponse.json({ error: ORIGIN_DENIED }, { status: 403 });
  }

  const gate = await requireFeature('e2_export');
  if (!gate.ok) return featureDenialResponse(gate);

  let year: number;
  try {
    const body = await req.json();
    year = Math.floor(Number((body as { year?: unknown })?.year));
  } catch {
    return NextResponse.json({ error: 'Μη αναγνώσιμο αίτημα.' }, { status: 400 });
  }
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Άκυρο φορολογικό έτος.' }, { status: 422 });
  }

  const supabase = await createClient();
  const loaded = await loadE2Rows(supabase, gate.userId, year);
  const wb = buildE2Workbook(loaded, year);
  // Κανένα ακίνητο: δεν κατεβαίνει αρχείο· ο client δείχνει το ίδιο μήνυμα με πριν.
  if (!wb) return NextResponse.json({ ok: true, count: 0 });

  const bytes = workbookBytes(wb);
  const utf8 = encodeURIComponent(`Έντυπο Ε2 ${year}.xlsx`);
  return new NextResponse(bytes.slice().buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': XLSX_MIME,
      // ASCII fallback + UTF-8 όνομα, ώστε το ελληνικό filename να μη σπάει.
      'Content-Disposition': `attachment; filename="Properwise-E2-${year}.xlsx"; filename*=UTF-8''${utf8}`,
      'X-Property-Count': String(loaded.properties.length),
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
