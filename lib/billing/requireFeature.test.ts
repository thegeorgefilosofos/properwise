// npx tsx lib/billing/requireFeature.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΥΛΗ ΤΩΝ ΔΥΝΑΤΟΤΗΤΩΝ ΣΤΟΝ SERVER, ΕΛΕΓΜΕΝΗ
//
// Ένα πληρωμένο endpoint που εμπιστεύεται την οθόνη είναι ανοιχτή πόρτα. Εδώ
// επιβεβαιώνουμε ότι η `requireFeature` κλείνει την πόρτα στις σωστές περιπτώσεις:
// χωρίς σύνδεση → 401, αποτυχία βάσης → 500, χαμηλό πακέτο → 403, αρκετό → άνοιγμα.
// Το πλάνο διαβάζεται από την `public.user_plan_rank`, οπότε ο δείκτης εδώ είναι
// ο ίδιος που δίνει η βάση στην παραγωγή.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import { PLAN_RANK_ORDER } from '@/lib/billing/aiLimits';
import { FEATURE_LABEL } from '@/lib/billing/entitlements';
import { requireFeature, SIGN_IN_REQUIRED, PLAN_CHECK_FAILED } from './requireFeature';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { if (cond) { pass++ } else { fail++; console.error('✗ ' + name) } };
const eq = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++ } else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`) }
};

const UID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const rankOf = (plan: string) => PLAN_RANK_ORDER.indexOf(plan as never);

// Ψεύτικος client: δίνει τον χρήστη και τον δείκτη πακέτου που ζητά το κάθε σενάριο.
const fake = (
  user: { id: string } | null,
  rank: number | null,
  rpcError = false,
) => ({
  auth: { getUser: async () => ({ data: { user } }) },
  rpc: async (name: string, args: { p_uid: string }) => {
    // Επιβεβαιώνει ότι ρωτάμε τη σωστή συνάρτηση, με το uid του χρήστη.
    ok('ρωτά την user_plan_rank με το uid', name === 'user_plan_rank' && args.p_uid === UID);
    return rpcError ? { data: null, error: { message: 'db down' } } : { data: rank, error: null };
  },
} as unknown as SupabaseClient);

async function main() {
  // ── ΧΩΡΙΣ ΣΥΝΔΕΣΗ → 401, ΧΩΡΙΣ ΝΑ ΑΓΓΙΞΕΙ ΤΗ ΒΑΣΗ ───────────────────────
  {
    const r = await requireFeature('e2_export', fake(null, null));
    ok('anon: κλειστή', r.ok === false);
    if (!r.ok) { eq('anon: 401', r.status, 401); eq('anon: μήνυμα σύνδεσης', r.error, SIGN_IN_REQUIRED); }
  }

  // ── ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ → 500 (ΠΟΤΕ ΑΝΟΙΓΜΑ ΣΤΑ ΤΥΦΛΑ) ──────────────────────
  {
    const r = await requireFeature('e2_export', fake({ id: UID }, null, true));
    ok('db error: κλειστή', r.ok === false);
    if (!r.ok) { eq('db error: 500', r.status, 500); eq('db error: μήνυμα', r.error, PLAN_CHECK_FAILED); }
  }

  // ── ΔΩΡΕΑΝ ΠΑΚΕΤΟ → 403 ΓΙΑ ΠΛΗΡΩΜΕΝΗ ΔΥΝΑΤΟΤΗΤΑ ───────────────────────
  {
    const r = await requireFeature('e2_export', fake({ id: UID }, rankOf('free')));
    ok('free vs e2_export: κλειστή', r.ok === false);
    if (!r.ok) {
      eq('free: 403', r.status, 403);
      eq('free: επιστρέφει το πακέτο', r.plan, 'free');
      ok('free: μήνυμα με την ετικέτα', r.error.includes(FEATURE_LABEL.e2_export));
    }
  }

  // ── ΑΚΡΙΒΩΣ ΤΟ ΕΛΑΧΙΣΤΟ ΠΑΚΕΤΟ → ΑΝΟΙΓΜΑ (e2_export = solo) ─────────────
  {
    const r = await requireFeature('e2_export', fake({ id: UID }, rankOf('solo')));
    ok('solo vs e2_export: ανοιχτή', r.ok === true);
    if (r.ok) { eq('solo: πλάνο', r.plan, 'solo'); eq('solo: uid', r.userId, UID); }
  }

  // ── ΨΗΛΟΤΕΡΟ ΠΑΚΕΤΟ ΚΑΛΥΠΤΕΙ ΤΑ ΑΠΟ ΚΑΤΩ ──────────────────────────────
  {
    const r = await requireFeature('e2_export', fake({ id: UID }, rankOf('agency')));
    ok('agency vs e2_export: ανοιχτή', r.ok === true);
  }

  // ── ΕΠΕΝΔΥΤΙΚΗ ΑΝΑΛΥΣΗ ΘΕΛΕΙ agency: owner ΔΕΝ ΦΤΑΝΕΙ ───────────────────
  {
    const owner = await requireFeature('investment_analysis', fake({ id: UID }, rankOf('owner')));
    ok('owner vs investment: κλειστή', owner.ok === false);
    if (!owner.ok) eq('owner: 403', owner.status, 403);
    const agency = await requireFeature('investment_analysis', fake({ id: UID }, rankOf('agency')));
    ok('agency vs investment: ανοιχτή', agency.ok === true);
  }

  // ── ΔΕΙΚΤΗΣ ΕΚΤΟΣ ΟΡΙΩΝ → ΠΕΦΤΕΙ ΣΕ free (ΑΣΦΑΛΗΣ ΑΡΝΗΣΗ) ──────────────
  {
    const r = await requireFeature('e2_export', fake({ id: UID }, 999));
    ok('rank εκτός ορίων: κλειστή', r.ok === false);
    if (!r.ok) eq('rank εκτός ορίων: πλάνο free', r.plan, 'free');
  }

  console.log(`\nrequireFeature: ${pass} πέρασαν, ${fail} απέτυχαν`);
  if (fail > 0) process.exit(1);
}

main();
