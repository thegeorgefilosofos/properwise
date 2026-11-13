// ═══════════════════════════════════════════════════════════════════════════
// ΓΙΑΤΙ ΕΙΝΑΙ ΚΛΕΙΣΤΟ ΤΟ ΤΑΜΕΙΟ: ΜΟΝΟ ΓΙΑ ΔΙΑΧΕΙΡΙΣΤΗ
// ─────────────────────────────────────────────────────────────────────────
// ΠΗΓΗ: έλεγχος ετοιμότητας πληρωμών 12/11/2026, «Λείπει (κώδικας)» 5. Η
// απόφαση και η διατύπωση ζουν στο lib/billing/checkoutDiagnosis.ts· εδώ μόνο
// ποιος ρωτά.
//
// ΤΡΕΙΣ ΠΟΡΤΕΣ, ΜΕ ΑΥΤΗ ΤΗ ΣΕΙΡΑ, ΟΠΩΣ ΚΑΘΕ ΔΙΑΔΡΟΜΗ ΜΕ ΣΥΝΕΔΡΙΑ:
//   1. συνεδρία (`auth.getUser`)·
//   2. δεύτερο βήμα (`requireSecondStep`)·
//   3. ο κατάλογος διαχειριστών `app_admins`, που διαβάζεται με τον πελάτη
//      ΤΟΥ ΧΡΗΣΤΗ: η πολιτική `app_admins_self` δείχνει μόνο τη δική του
//      γραμμή και η `mfa_app_admins` τίποτα χωρίς δεύτερο βήμα. Ιδια πηγή με
//      τα εργαλεία των επιτοκίων (`useIsAdmin`), κανένα email στον κώδικα.
//
// Η ΑΠΑΝΤΗΣΗ ΔΕΝ ΚΡΑΤΙΕΤΑΙ ΣΕ CACHE: η ρύθμιση αλλάζει με κάθε διάταξη.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSecondStep } from '@/lib/auth/secondStep';
import { checkoutDiagnosis } from '@/lib/billing/checkoutDiagnosis';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Απαιτείται σύνδεση.' }, { status: 401, headers: NO_STORE });
  const denied = await requireSecondStep(supabase, user);
  if (denied) return denied;

  const email = (user.email || '').trim();
  const { data: admin, error } = email
    ? await supabase.from('app_admins').select('email').eq('email', email).maybeSingle()
    : { data: null, error: null };
  if (error) {
    console.info('[billing/diagnostic] ο κατάλογος διαχειριστών δεν διαβάστηκε:', error.message);
    return NextResponse.json({ error: 'Ο έλεγχος δεν ολοκληρώθηκε.' }, { status: 502, headers: NO_STORE });
  }
  // ΑΠΟΤΥΓΧΑΝΕΙ ΚΛΕΙΣΤΑ: χωρίς γραμμή στον κατάλογο, καμία λέξη για τη ρύθμιση.
  if (!admin) return NextResponse.json({ error: 'Μόνο για διαχειριστές.' }, { status: 403, headers: NO_STORE });

  return NextResponse.json(checkoutDiagnosis(process.env), { headers: NO_STORE });
}
