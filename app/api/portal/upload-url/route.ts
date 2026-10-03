// ═══════════════════════════════════════════════════════════════════════════
// ΔΙΕΥΘΥΝΣΗ ΑΝΕΒΑΣΜΑΤΟΣ ΓΙΑ ΜΙΑ ΦΩΤΟΓΡΑΦΙΑ ΤΗΣ ΠΥΛΗΣ ΕΝΟΙΚΙΑΣΤΗ
// ─────────────────────────────────────────────────────────────────────────
// Ο ενοικιαστής δεν έχει λογαριασμό: η ταυτότητά του είναι το κουπόνι του
// συνδέσμου και, όταν ο ιδιοκτήτης το όρισε, ο κωδικός. Τα δύο τα κρίνει η
// βάση (`portal_upload_slot`), που μετρά τον λάθος κωδικό στο ίδιο κλείδωμα με
// την είσοδο και κόβει στις είκοσι φωτογραφίες την ώρα. Μόνο μετά ο ρόλος
// υπηρεσίας υπογράφει διεύθυνση για ΜΙΑ διαδρομή μέσα στον φάκελο του
// κουπονιού. Η λογική και ο λόγος της ζουν στο lib/portal/uploadSlot.ts.
//
// Ο ΑΝΩΝΥΜΟΣ ΔΕΝ ΓΡΑΦΕΙ ΠΙΑ ΑΠΕΥΘΕΙΑΣ ΣΤΟ BUCKET: η πολιτική εισαγωγής έφυγε
// στο 20261003110000. Αυτή η διαδρομή είναι ο μόνος δρόμος.
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { sameOrigin, ORIGIN_DENIED } from '@/lib/api/origin';
import { createServiceClient, serviceClientError, SERVICE_CLIENT_LOG } from '@/lib/supabase/service';
import { grantPortalUpload, readUploadAsk, type SlotClient } from '@/lib/portal/uploadSlot';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  // Τη φωνάζει μόνο η σελίδα της πύλης, από τον ίδιο ιστότοπο.
  if (!sameOrigin(request.headers)) {
    return NextResponse.json({ error: ORIGIN_DENIED }, { status: 403, headers: NO_STORE });
  }

  const ask = readUploadAsk(await request.json().catch(() => null));
  if ('error' in ask) return NextResponse.json({ error: ask.error }, { status: 400, headers: NO_STORE });

  const missing = serviceClientError(process.env);
  if (missing) {
    console.info('[portal/upload-url]', SERVICE_CLIENT_LOG, missing);
    return NextResponse.json({ error: 'Η αποστολή φωτογραφιών δεν είναι διαθέσιμη αυτή τη στιγμή.' }, { status: 503, headers: NO_STORE });
  }
  const service: SlotClient = createServiceClient();

  const reply = await grantPortalUpload(service, ask, Date.now(), crypto.randomUUID().slice(0, 8));
  return NextResponse.json(reply.body, { status: reply.status, headers: NO_STORE });
}
