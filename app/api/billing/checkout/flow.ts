// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΠΟΦΑΣΗ ΤΟΥ ΤΑΜΕΙΟΥ, ΧΩΡΙΣ ΤΟ next/headers
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΒΓΗΚΕ ΑΠΟ ΤΗ route.ts. Η διαδρομή φορτώνει το lib/supabase/server, που
// εισάγει το next/headers και εκτός αιτήματος του Next δεν τρέχει σε Node.
// Έτσι η μόνη δοκιμή της ήταν ο checkoutGate.test.ts, που κοιτάζει τη ΣΕΙΡΑ
// των ελέγχων στο κείμενο· το τι απαντά σε δοκιμαστή, σε συνδρομητή ή στο
// probe δεν το έτρεχε κανείς (έλεγχος ετοιμότητας πληρωμών 12/11/2026,
// ενότητα 5). Η απόφαση ζει πλέον εδώ, με τον έμπορο, το περιβάλλον και το
// προφίλ ως ορίσματα· το flow.test.ts την τρέχει ολόκληρη.
//
// Η ΤΑΥΤΟΤΗΤΑ ΜΕΝΕΙ ΣΤΗ ΔΙΑΔΡΟΜΗ. Συνεδρία και δεύτερο βήμα ελέγχονται εκεί,
// πριν φτάσει οτιδήποτε εδώ, ώστε όποιος διαβάζει τη route.ts να βλέπει ποιος
// την προστατεύει (scripts/guard-api-auth.mjs).
//
// ── ΤΕΣΣΕΡΙΣ ΕΛΕΓΧΟΙ ΠΡΙΝ ΑΝΟΙΞΕΙ ───────────────────────────────────────
// ΠΑΚΕΤΟ: γνωστό, πληρωμένο, σε γνωστό κύκλο.
// ΣΥΝΘΗΚΗ: η μία συνθήκη πώλησης (lib/legal/checkout.ts), πριν από κάθε
//   απάντηση «ανοιχτό» και πριν ζητηθεί σύνδεσμος από τον έμπορο.
// ΔΟΚΙΜΑΣΤΗΣ: όποιος έχει την ιδιότητα ΔΕΝ πληρώνει ποτέ.
// ΣΥΝΔΡΟΜΗ ΠΟΥ ΤΡΕΧΕΙ: δεύτερο ταμείο θα έφτιαχνε δεύτερη συνδρομή.
//
// ── ΚΑΙ Η ΕΡΩΤΗΣΗ ΔΕΝ ΕΙΝΑΙ ΑΓΟΡΑ ───────────────────────────────────────
// Με `probe` απαντάμε από τη ρύθμιση, ΧΩΡΙΣ να ζητήσουμε ταμείο από τον
// έμπορο: αλλιώς κάθε άνοιγμα των Ρυθμίσεων θα άφηνε από μία αχρησιμοποίητη
// συνεδρία πληρωμής στον πίνακά του.
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { PLANS, type PlanId, type BillingCycle } from '@/lib/billing/plans';
import type { BillingEnv, MerchantPort } from '@/lib/billing/merchant';
import { isEntitled, isMorStatus } from '@/lib/billing/subscription';
import { billingWords, REVOKED_CHECKOUT_REFUSAL } from '@/lib/legal/billingWords';
import { checkoutState } from '@/lib/legal/checkout';
import { IDENTITY } from '@/lib/legal/identity';
import { SITE } from '@/lib/core/site';
import type { RouteFailure } from '@/lib/observability/route';

/** Ο σύνδεσμος πληρωμής δεν ζει για πάντα σε ένα ιστορικό περιηγητή. */
export const LINK_MINUTES = 30;

/** Οσα διαβάζει το ταμείο από το προφίλ του αγοραστή. */
export interface CheckoutProfile {
  profile_type: string | null;
  trial_used_at: string | null;
  tester_since: string | null;
  full_name: string | null;
  subscription_status: string | null;
  mor_ends_at: string | null;
  /** Πρόσβαση που έκλεισε από επιστροφή ή αμφισβήτηση· και η συνδρομή της. */
  mor_revoked_at: string | null;
  mor_subscription_id: string | null;
}

/** Οι στήλες του `CheckoutProfile`, για το `select`. */
export const CHECKOUT_PROFILE_COLUMNS =
  'profile_type, trial_used_at, tester_since, full_name, subscription_status, mor_ends_at, mor_revoked_at, mor_subscription_id';

export interface CheckoutAsk { plan: string; cycle: string; probe: boolean }

export interface CheckoutDeps {
  env: BillingEnv;
  mor: MerchantPort;
  /** Ο χρήστης της ΣΥΝΕΔΡΙΑΣ, ποτέ του αιτήματος. */
  user: { id: string; email?: string | null };
  readProfile: () => Promise<CheckoutProfile | null>;
  now?: () => number;
  /** Η αναφορά αποτυχίας (Sentry). Παίρνει όνομα, ποτέ το κείμενο του εμπόρου. */
  report?: (route: string, what: string, f?: RouteFailure) => void;
}

export async function checkoutResponse(ask: CheckoutAsk, deps: CheckoutDeps): Promise<NextResponse> {
  const { env, mor } = deps;
  const { plan, cycle, probe } = ask;
  const words = () => billingWords(env, IDENTITY, mor);
  /** Η απάντηση όταν δεν υπάρχει ταμείο. Ιδια διατύπωση με τους Ορους. */
  const closed = () => NextResponse.json({ available: false, url: null, note: words().chargingToday });

  // Το «free» ΕΙΝΑΙ στο PLANS (είναι πραγματικό επίπεδο), αλλά δεν έχει τιμή:
  // δεν στήνεται ταμείο για δωρεάν πακέτο. Χωρίς αυτόν τον ρητό αποκλεισμό, το
  // `plan in PLANS` θα το άφηνε να περάσει και ο πάροχος θα ζητούσε προϊόν που
  // δεν υπάρχει.
  if (!Object.hasOwn(PLANS, plan) || plan === 'free' || (cycle !== 'monthly' && cycle !== 'annual')) {
    return NextResponse.json({ error: 'Άγνωστο πακέτο ή κύκλος.' }, { status: 400 });
  }

  // ΞΕΡΕΙ Ο ΑΓΟΡΑΣΤΗΣ ΑΠΟ ΠΟΙΟΝ ΑΓΟΡΑΖΕΙ; Το ταμείο άνοιγε με μόνο ζωντανό
  // κλειδί, ενώ ο φορέας ήταν ανώνυμος (νομική αξιολόγηση 20/10/2026). Η οθόνη
  // κρύβει πλέον το κουμπί, αλλά ένας σελιδοδείκτης φτάνει εδώ κατευθείαν: η
  // άρνηση ζει στον διακομιστή, στην ΙΔΙΑ συνθήκη με τα κείμενα.
  const gate = checkoutState(env, IDENTITY, mor);
  if (!gate.live) {
    // ΤΟ «ΓΙΑΤΙ ΟΧΙ» ΤΑΞΙΔΕΥΕΙ ΜΟΝΟ ΠΡΟΣ ΤΑ ΜΕΣΑ. Ονόματα μεταβλητών δεν
    // εκτίθενται σε δημόσια διεύθυνση· ο διαχειριστής βλέπει την αιτία στο
    // /api/billing/diagnostic.
    console.info(gate.closedBy === 'identity'
      ? `[${mor.id}] το ταμείο μένει κλειστό: η ταυτότητα του πωλητή δεν έχει δημοσιευθεί`
      : `[${mor.id}] η χρέωση δεν είναι ρυθμισμένη`);
    return closed();
  }

  const profile = await deps.readProfile();

  // Ο ΔΟΚΙΜΑΣΤΗΣ ΔΕΝ ΕΧΕΙ ΤΙ ΝΑ ΑΓΟΡΑΣΕΙ. Δεν είναι σφάλμα, είναι η κατάστασή
  // του: το προϊόν του δίνεται ολόκληρο και χωρίς συνδρομή στον έμπορο.
  if (profile?.tester_since) {
    return NextResponse.json({ available: false, url: null, tester: true });
  }

  // ── ΠΡΟΣΒΑΣΗ ΠΟΥ ΕΚΛΕΙΣΕ ΑΠΟ ΕΠΙΣΤΡΟΦΗ: ΠΡΩΤΑ Η ΥΠΟΣΤΗΡΙΞΗ ──────────────
  // Η συνδρομή στον έμπορο δεν ακυρώνεται μόνη της με την επιστροφή· μια νέα
  // αγορά θα έστηνε δεύτερη δίπλα της (έλεγχος του PR 558, M2). Το ταμείο μένει
  // κλειστό ώσπου η υποστήριξη να ακυρώσει την παλιά και να σβήσει την
  // καταγραφή. Και το probe το λέει, ώστε η οθόνη να μη δείξει κουμπί.
  if (profile?.mor_revoked_at && profile.mor_subscription_id) {
    if (probe) return NextResponse.json({ available: false, url: null, revoked: true, note: REVOKED_CHECKOUT_REFUSAL });
    return NextResponse.json({ error: REVOKED_CHECKOUT_REFUSAL }, { status: 409 });
  }

  // ── ΔΕΥΤΕΡΟ ΤΑΜΕΙΟ ΠΑΝΩ ΣΕ ΣΥΝΔΡΟΜΗ ΠΟΥ ΙΣΧΥΕΙ ΑΚΟΜΗ ─────────────────────
  // Μια διεύθυνση γραμμένη με το χέρι ή ένας παλιός σελιδοδείκτης άνοιγαν
  // ταμείο δίπλα στο πρώτο: δύο συνδρομές, δύο χρεώσεις τον μήνα.
  //
  // ΤΟ `past_due` ΜΕΤΡΑ ΖΩΝΤΑΝΟ ΚΑΙ ΜΕΤΑ ΤΗ ΧΑΡΗ, ΕΠΙΤΗΔΕΣ. Το ερώτημα εδώ δεν
  // είναι «έχει πρόσβαση;» αλλά «ζει συνδρομή στον έμπορο;». Ο έμπορος
  // ξαναδοκιμάζει την είσπραξη· μια νέα αγορά θα χρέωνε δύο φορές τη μέρα που
  // θα περάσει η κάρτα. Η λύση είναι η κάρτα, από τη διαχείριση συνδρομής.
  // Γι' αυτό η `isEntitled` καλείται ΧΩΡΙΣ `pastDueSince`.
  const now = deps.now ? deps.now() : Date.now();
  const morStatus = (profile?.subscription_status || '').trim();
  if (isMorStatus(morStatus) && isEntitled({ status: morStatus, endsAt: profile?.mor_ends_at ?? null }, new Date(now).toISOString())) {
    // Η ΕΡΩΤΗΣΗ «ΕΙΝΑΙ ΑΝΟΙΧΤΟ ΤΟ ΤΑΜΕΙΟ;» ΘΕΛΕΙ ΑΠΑΝΤΗΣΗ ΚΑΙ ΓΙΑ ΤΟΝ ΣΥΝΔΡΟΜΗΤΗ.
    // Η οθόνη χρέωσης δείχνει την «Αλλαγή πακέτου» μόνο όταν η ερώτηση απαντά
    // «ναι» (έλεγχος 27.09.2026, D6). Ταμείο δεν ανοίγει.
    if (probe) return NextResponse.json({ available: true, subscribed: true, url: null, note: words().chargingToday });
    return NextResponse.json({
      error: 'Υπάρχει ήδη ενεργή συνδρομή. Η αλλαγή πακέτου γίνεται από τη διαχείριση συνδρομής.',
    }, { status: 409 });
  }

  // Ο ΤΥΠΟΣ ΠΡΟΦΙΛ ΔΕΝ ΑΡΝΕΙΤΑΙ ΠΩΛΗΣΗ (έλεγχος 28.09.2026). Ο,τι ανοίγει το
  // κρίνει το πακέτο· τον τύπο τον ξαναγράφει ο webhook (`profileTypeToWrite`).

  if (probe) return NextResponse.json({ available: true, url: null, note: words().chargingToday });

  // Η ΑΠΟΦΑΣΗ ΔΕΝ ΞΕΡΕΙ ΤΙ ΕΙΝΑΙ ΠΑΡΑΛΛΑΓΗ. Ζητά «Ιδιοκτήτης+, ετήσια» και
  // παίρνει διεύθυνση: η μετάφραση στη γλώσσα του παρόχου ζει στη θύρα.
  const { url, error } = await mor.openCheckout({
    buyer: { userId: deps.user.id, email: deps.user.email, name: profile?.full_name },
    plan: plan as PlanId,
    cycle: cycle as BillingCycle,
    redirectUrl: `${SITE}/dashboard?checkout=ok`,
    // Η ΔΟΚΙΜΗ ΕΙΝΑΙ ΜΙΑ ΑΝΑ ΛΟΓΑΡΙΑΣΜΟ. Το πότε δόθηκε το γράφει ο webhook,
    // όταν δει την πρώτη συνδρομή σε δοκιμή, όχι εδώ.
    skipTrial: !!profile?.trial_used_at,
    expiresAt: new Date(now + LINK_MINUTES * 60_000).toISOString(),
  }, env);

  if (error) {
    console.info(`[${mor.id}] το ταμείο δεν άνοιξε:`, error);
    // Το `error` του εμπόρου είναι ελεύθερο κείμενο: ταξιδεύει μόνο το όνομά του.
    deps.report?.('api/billing/checkout', `${mor.id} checkout not opened`, { status: 502 });
    return NextResponse.json({ error: 'Το ταμείο δεν άνοιξε.' }, { status: 502 });
  }
  return NextResponse.json({ available: !!url, url, note: words().chargingToday });
}
