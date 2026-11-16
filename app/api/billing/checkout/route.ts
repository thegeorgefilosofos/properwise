// ═══════════════════════════════════════════════════════════════════════════
// Ο ΔΡΟΜΟΣ ΠΡΟΣ ΤΟ ΤΑΜΕΙΟ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΤΑΜΕΙΟ ΦΤΙΑΧΝΕΤΑΙ ΕΔΩ ΚΑΙ ΟΧΙ ΑΠΟ ΣΥΝΗΘΕΙΑ. Κουβαλά ποιος πληρώνει, τι
// αγοράζει και — το κρισιμότερο — ΑΝ ΔΙΚΑΙΟΥΤΑΙ ΔΟΚΙΜΗ. Αν το έφτιαχνε ο
// περιηγητής, οποιοσδήποτε θα έβαζε ξένο αναγνωριστικό, άλλη παραλλαγή, ή θα
// ζητούσε δοκιμή που έχει ήδη ξοδέψει.
//
// ΕΔΩ ΜΕΝΕΙ Η ΤΑΥΤΟΤΗΤΑ: ο χρήστης έρχεται από τη ΣΥΝΕΔΡΙΑ, όχι από το αίτημα,
// και η μισή συνεδρία δεν περνά. Η ΑΠΟΦΑΣΗ (πακέτο, συνθήκη πώλησης,
// δοκιμαστής, συνδρομή που τρέχει, probe, ταμείο) ζει στο flow.ts, ώστε να
// τρέχει σε δοκιμή χωρίς το next/headers (flow.test.ts).
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSecondStep } from '@/lib/auth/secondStep';
import { merchant } from '@/lib/billing/merchant';
import * as billing from '@/lib/data/billing';
import { reportRoute } from '@/lib/observability/route';
import { checkoutResponse, CHECKOUT_PROFILE_COLUMNS, type CheckoutProfile } from './flow';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Απαιτείται σύνδεση.' }, { status: 401 });
  // Η μισή συνεδρία (συσκευή δηλωμένη, εξαψήφιος όχι) δεν περνά:
  // lib/auth/secondStep.ts.
  const denied = await requireSecondStep(supabase, user);
  if (denied) return denied;

  const q = request.nextUrl.searchParams;
  return checkoutResponse(
    { plan: (q.get('plan') || '').trim(), cycle: (q.get('cycle') || '').trim(), probe: q.get('probe') === '1' },
    {
      env: process.env,
      mor: merchant(),
      user: { id: user.id, email: user.email },
      readProfile: () => billing.profile<CheckoutProfile>(supabase, user.id, CHECKOUT_PROFILE_COLUMNS),
      report: (route, what, f) => { void reportRoute(route, what, f); },
    },
  );
}
