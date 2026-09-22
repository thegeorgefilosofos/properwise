// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΥΛΗ ΤΩΝ ΔΥΝΑΤΟΤΗΤΩΝ, ΣΤΟΝ SERVER — ΟΧΙ ΜΟΝΟ ΣΤΗΝ ΟΘΟΝΗ
//
// Το `hasFeature` στην οθόνη κρύβει ή κλειδώνει ένα κουμπί. Είναι σωστό για την
// εμπειρία, αλλά δεν σταματά κανέναν: όποιος διαβάσει το JS ή χτυπήσει κατευθείαν
// ένα endpoint παρακάμπτει το λουκέτο. Η πληρωμένη δουλειά που τρέχει στον server
// (εξαγωγή Ε2, επενδυτική ανάλυση) πρέπει να ελέγχει το πακέτο ΕΚ ΝΕΟΥ, εκεί που
// ο χρήστης δεν φτάνει.
//
// Η ΑΥΘΕΝΤΙΑ ΕΙΝΑΙ Η ΒΑΣΗ, ΟΧΙ Ο,ΤΙ ΣΤΕΛΝΕΙ Ο ΠΕΛΑΤΗΣ. Το πλάνο διαβάζεται από
// την `public.user_plan_rank(uuid)` — την ίδια συνάρτηση που κρίνει τα όρια AI
// και τις πολιτικές RLS. Έτσι δεν εφευρίσκουμε δεύτερο κανόνα πακέτου εδώ: ο
// server και η βάση λένε πάντα το ίδιο πράγμα.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PLAN_RANK_ORDER } from '@/lib/billing/aiLimits';
import {
  requiredPlanForFeature, planAtLeast, FEATURE_LABEL,
  type Feature, type PlanId,
} from '@/lib/billing/entitlements';

/** Η πύλη άνοιξε: ο χρήστης είναι συνδεδεμένος και το πακέτο του φτάνει. */
export type FeatureGrant = { ok: true; plan: PlanId; userId: string };
/** Η πύλη έκλεισε: 401 (χωρίς σύνδεση), 403 (χαμηλό πακέτο) ή 500 (αποτυχία ελέγχου). */
export type FeatureDenial = { ok: false; status: 401 | 403 | 500; error: string; plan: PlanId | null };
export type FeatureGate = FeatureGrant | FeatureDenial;

export const SIGN_IN_REQUIRED = 'Απαιτείται σύνδεση.';
export const PLAN_CHECK_FAILED = 'Δεν μπόρεσα να επιβεβαιώσω το πακέτο σου. Δοκίμασε ξανά σε λίγο.';

/** Μήνυμα αναβάθμισης — η ίδια φιλική ετικέτα που βλέπει ο χρήστης στην οθόνη. */
export function upgradeMessage(feature: Feature): string {
  return `Το «${FEATURE_LABEL[feature]}» ανοίγει σε ανώτερο πακέτο.`;
}

/**
 * Επιβεβαιώνει, στον server, ότι ο συνδεδεμένος χρήστης δικαιούται τη δυνατότητα.
 *
 * Ο `client` δίνεται μόνο στα tests (dependency injection). Στην παραγωγή μένει
 * κενός και φορτώνεται τεμπέλικα ο πραγματικός server client — έτσι το `next/headers`
 * δεν αγγίζεται όταν τρέχουν τα unit tests μέσω `tsx`.
 */
export async function requireFeature(
  feature: Feature,
  client?: SupabaseClient,
): Promise<FeatureGate> {
  let supabase = client;
  if (!supabase) {
    const { createClient } = await import('@/lib/supabase/server');
    supabase = await createClient();
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: SIGN_IN_REQUIRED, plan: null };

  const { data, error } = await supabase.rpc('user_plan_rank', { p_uid: user.id });
  if (error) return { ok: false, status: 500, error: PLAN_CHECK_FAILED, plan: null };

  // Ο δείκτης έρχεται από τη βάση (0 = δωρεάν). Ο,τιδήποτε εκτός ορίων πέφτει σε
  // «free»: μια απάντηση που ανοίγει πύλη κατά λάθος θα ήταν χειρότερη από άρνηση.
  const rank = typeof data === 'number' ? data : Number(data);
  const plan: PlanId = PLAN_RANK_ORDER[Number.isFinite(rank) ? rank : 0] ?? 'free';

  if (!planAtLeast(plan, requiredPlanForFeature(feature))) {
    return { ok: false, status: 403, error: upgradeMessage(feature), plan };
  }
  return { ok: true, plan, userId: user.id };
}

/** Μετατρέπει μια άρνηση σε έτοιμη απόκριση για route handler. */
export function featureDenialResponse(denial: FeatureDenial): NextResponse {
  return NextResponse.json(
    denial.plan ? { error: denial.error, plan: denial.plan } : { error: denial.error },
    { status: denial.status },
  );
}
