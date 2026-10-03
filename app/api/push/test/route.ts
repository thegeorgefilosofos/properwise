// ═══════════════════════════════════════════════════════════════════════════
// ΔΟΚΙΜΑΣΤΙΚΗ ΕΙΔΟΠΟΙΗΣΗ: Ο ΧΡΗΣΤΗΣ ΒΛΕΠΕΙ ΤΩΡΑ ΟΤΙ ΦΤΑΝΕΙ
// ─────────────────────────────────────────────────────────────────────────
// Ο διακόπτης άναβε και κανείς δεν μάθαινε αν δουλεύει ώσπου να λήξει κάτι,
// ίσως σε εβδομάδες. Αν κάπου στη διαδρομή κάτι έσπαγε (κλειδιά, άδεια του
// συστήματος, «Εστίαση» στο iPhone), το μάθαινε ο χρήστης τη μέρα που η
// ειδοποίηση έπρεπε να έρθει και δεν ήρθε. Τώρα το βλέπει με ένα πάτημα.
//
// ΜΟΝΟ ΣΤΗ ΣΥΣΚΕΥΗ ΠΟΥ ΤΟ ΖΗΤΗΣΕ ΚΑΙ ΜΟΝΟ ΑΝ ΕΙΝΑΙ ΔΙΚΗ ΤΟΥ. Η διεύθυνση
// έρχεται από το αίτημα, αλλά διαβάζεται με την ταυτότητα του χρήστη: η RLS
// δεν δίνει ξένη γραμμή, άρα δεν φεύγει μήνυμα σε ξένο τηλέφωνο. Η συνδρομή
// δεν σβήνεται και δεν μετρά αποτυχία εδώ· αυτά είναι δουλειά του πρωινού.
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSecondStep } from '@/lib/auth/secondStep';
import { sameOrigin, ORIGIN_DENIED } from '@/lib/api/origin';
import * as devices from '@/lib/data/pushSubscriptions';
import { sendPush, vapidKeys } from '@/lib/push/send';
import { PUSH_URL } from '@/lib/push/message';
import { endpointHost } from '@/lib/push/subscription';

export async function POST(request: Request) {
  if (!sameOrigin(request.headers)) {
    return NextResponse.json({ error: ORIGIN_DENIED }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Απαιτείται σύνδεση.' }, { status: 401 });
  // Η μισή συνεδρία (συσκευή δηλωμένη, εξαψήφιος όχι) δεν περνά:
  // lib/auth/secondStep.ts.
  const denied = await requireSecondStep(supabase, user);
  if (denied) return denied;

  const keys = vapidKeys(process.env);
  if ('missing' in keys) {
    console.info('[push/test] λείπει το', keys.missing);
    return NextResponse.json({ error: 'Οι ειδοποιήσεις δεν είναι ρυθμισμένες.' }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { endpoint?: unknown } | null;
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
  const { row: sub, error } = endpoint ? await devices.ownByEndpoint(supabase, endpoint) : { row: null, error: null };
  if (error) {
    console.info('[push/test] η συνδρομή δεν διαβάστηκε:', error.message);
    return NextResponse.json({ error: 'Η συσκευή δεν διαβάστηκε. Δοκίμασε ξανά σε λίγο.' }, { status: 502 });
  }
  if (!sub) return NextResponse.json({ error: 'Η συσκευή δεν είναι γραμμένη. Σβήσε και άναψε ξανά τον διακόπτη.' }, { status: 404 });

  const outcome = await sendPush(sub, {
    title: 'PROPERWISE',
    body: 'Δοκιμαστική ειδοποίηση: φτάνει σε αυτή τη συσκευή.',
    url: PUSH_URL,
  }, keys);
  if (outcome.sent) return NextResponse.json({ sent: true });

  console.info(`[push/test] ${endpointHost(sub.endpoint)}: ${outcome.status || 'χωρίς κωδικό'} ${outcome.reason}`);
  return NextResponse.json({
    error: outcome.gone
      ? 'Η συσκευή ακύρωσε τη συνδρομή. Σβήσε και άναψε ξανά τον διακόπτη.'
      : 'Η υπηρεσία ειδοποιήσεων δεν τη δέχτηκε τώρα. Δοκίμασε ξανά σε λίγο.',
  }, { status: 502 });
}
