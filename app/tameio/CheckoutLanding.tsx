'use client';

// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΤΑΜΕΙΟ: Η ΠΡΩΤΗ ΟΘΟΝΗ ΜΕΤΑ ΤΗΝ ΕΠΙΒΕΒΑΙΩΣΗ ΤΟΥ EMAIL
// ─────────────────────────────────────────────────────────────────────────
// Ο επισκέπτης διάλεξε πακέτο και κύκλο στον τιμοκατάλογο. Μέχρι τώρα η
// επιλογή του κατέληγε στον πίνακα: μια οθόνη με είκοσι καρτέλες, όπου η
// συνδρομή που μόλις ζήτησε ήταν ένα κουμπί κρυμμένο τρία κλικ μακριά, στις
// Ρυθμίσεις. Το ταμείο ανοίγει εδώ, αμέσως, με το πακέτο και τον κύκλο που
// ταξίδεψαν μαζί του από την πρώτη κάρτα που πάτησε.
//
// ── ΤΡΕΙΣ ΚΑΤΑΛΗΞΕΙΣ, ΚΑΙ ΚΑΜΙΑ ΔΕΝ ΕΙΝΑΙ ΑΔΙΕΞΟΔΟ ─────────────────────
// Ο σύνδεσμος του εμπόρου: η κανονική διαδρομή και φεύγουμε αμέσως.
// Ο πίνακας: όταν δεν υπάρχει τίποτα να αγοραστεί — δοκιμαστής, ή πακέτο που
//   δεν αναγνωρίζεται. Δεν λέγεται τίποτα, γιατί δεν συνέβη τίποτα.
// Αυτή η κάρτα: όταν το ταμείο δεν άνοιξε. Όταν η χρέωση δεν είναι καν
//   ενεργή, η οθόνη αυτή δεν φορτώνεται: απαντά το page.tsx χωρίς επιλογέα. Η
//   δοκιμή τρέχει έτσι κι αλλιώς και αυτό λέγεται με λέξεις — μια σιωπηλή
//   ανακατεύθυνση θα άφηνε τον χρήστη να νομίζει ότι πλήρωσε.
//
// ΓΙΑΤΙ ΔΕΝ ΖΕΙ ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ. Η συνεδρία γεννιέται στην ανταλλαγή του
// διακριτικού (app/auth/callback) και το ταμείο είναι σύνδεσμος μιας χρήσης
// με ημερομηνία λήξης: δεν επιτρέπεται να μπει σε καμία μνήμη ενδιάμεσου.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { T } from '@/components/tokens';
import { TameioCard, TAMEIO_TITLE, TAMEIO_ACTION } from './TameioCard';
import { ChipToggle } from '@/components/Theme';
import { authClient } from '@/lib/supabase/lazy';
import { PLANS, PLAN_ORDER, TRIAL_DAYS, type PlanId, type BillingCycle } from '@/lib/billing/plans';
import { planFromParam, cycleFromParam } from '@/lib/billing/entitlements';
import { fe } from '@/lib/core/format';

type Stage = 'opening' | 'choose' | 'closed' | 'anonymous';

export default function CheckoutLanding() {
  const [stage, setStage] = useState<Stage>('opening');
  const [note, setNote] = useState('');
  const [what, setWhat] = useState('');
  // Η σύνδεση ξέρει να γυρίσει εδώ με το πακέτο (lib/billing/entitlements.ts,
  // `checkoutLanding`), αρκεί να της το πει η διεύθυνση.
  const [signIn, setSignIn] = useState('/login');

  // Ο κύκλος του επιλογέα. Ξεκινά μηνιαίος: είναι η μικρότερη δέσμευση και
  // όποιος θέλει ετήσια το λέει μόνος του.
  const [cycle, setCycle] = useState<BillingCycle>('monthly');

  /**
   * Ζητά τον σύνδεσμο του ταμείου και φεύγει.
   *
   * ΤΟ ΙΔΙΟ ΜΟΝΟΠΑΤΙ ΚΑΙ ΓΙΑ ΤΙΣ ΔΥΟ ΑΦΕΤΗΡΙΕΣ — αυτόν που ήρθε με πακέτο στη
   * διεύθυνση και αυτόν που το διάλεξε εδώ. Δύο αντίγραφα θα απέκλιναν στην
   * πρώτη αλλαγή και η μία από τις δύο διαδρομές θα έσπαγε σιωπηλά.
   */
  const open = useCallback(async (plan: PlanId, cyc: BillingCycle) => {
    setStage('opening');
    setWhat(`${PLANS[plan].name}, ${cyc === 'annual'
      ? `με ετήσια χρέωση ${fe(PLANS[plan].priceAnnual)}`
      : `με μηνιαία χρέωση ${fe(PLANS[plan].priceMonthly)}`}`);
    try {
      const res = await fetch(`/api/billing/checkout?plan=${plan}&cycle=${cyc}`);
      const body = await res.json() as { url?: string | null; tester?: boolean; note?: string };
      if (body.url) { window.location.replace(body.url); return; }
      // Ο δοκιμαστής δεν έχει τι να αγοράσει: το προϊόν του δίνεται ολόκληρο.
      if (body.tester) { window.location.replace('/dashboard'); return; }
      setNote(body.note || '');
      setStage('closed');
    } catch {
      setStage('closed');
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const q = new URLSearchParams(window.location.search);
      const plan = planFromParam(q.get('plan'));

      // Η ΣΥΝΕΔΡΙΑ ΠΡΩΤΑ. Χωρίς αυτήν το ταμείο θα απαντούσε 401 και η οθόνη
      // θα έλεγε «δεν άνοιξε» για κάτι που απλώς δεν ρωτήθηκε ποτέ σωστά.
      const { data, error } = await (await authClient()).auth.getUser();
      if (!alive) return;
      // Σφάλμα ανάγνωσης δεν είναι «συνδεδεμένος». Αν δεν μπορούμε να
      // αποδείξουμε τη συνεδρία, το ταμείο θα απαντούσε 401 και η οθόνη θα
      // κατηγορούσε τη χρέωση για κάτι που δεν έφταιξε.
      if (error || !data.user) {
        if (plan) setSignIn(`/login?plan=${plan}&cycle=${cycleFromParam(q.get('cycle'))}`);
        setStage('anonymous');
        return;
      }

      // ── ΧΩΡΙΣ ΠΑΚΕΤΟ ΔΕΝ ΠΑΕΙ ΣΤΟΝ ΠΙΝΑΚΑ, ΡΩΤΑΕΙ ─────────────────────
      // ΕΔΩ ΗΤΑΝ Η ΔΙΑΡΡΟΗ ΤΟΥ ΧΩΝΙΟΥ, ΚΑΙ ΗΤΑΝ ΣΤΗ ΣΥΝΗΘΕΣΤΕΡΗ ΔΙΑΔΡΟΜΗ.
      // Το κουμπί «Ξεκίνα τη δοκιμή» της αρχικής και της κεφαλίδας πάει στο
      // /signup ΧΩΡΙΣ πακέτο — πακέτο κουβαλά μόνο όποιος πάτησε κάρτα μέσα
      // στον τιμοκατάλογο. Ολοι οι υπόλοιποι έφταναν εδώ με άδεια διεύθυνση,
      // ανακατευθύνονταν σιωπηλά στον πίνακα και δεν τους ρωτούσε ΠΟΤΕ
      // κανείς τι πακέτο θέλουν: η δοκιμή έτρεχε τριάντα ημέρες και μετά ο
      // λογαριασμός έμενε σε αναμονή, χωρίς να έχει δει ούτε μία φορά τιμή.
      if (!plan) { setStage('choose'); return; }

      await open(plan, cycleFromParam(q.get('cycle')));
    })();
    return () => { alive = false; };
  }, [open]);

  return (
    <TameioCard>
        <h1 style={TAMEIO_TITLE}>
          {stage === 'choose' ? 'Διάλεξε πακέτο' : 'Ολοκλήρωση συνδρομής'}
        </h1>

        {/* Η ΕΠΙΛΟΓΗ ΦΑΙΝΕΤΑΙ ΣΕ ΚΑΘΕ ΚΑΤΑΛΗΞΗ. Ο χρήστης την έκανε τρεις
            οθόνες πριν και ανάμεσα μεσολάβησε ένα email: το να τη δει
            γραμμένη είναι η μόνη απόδειξη ότι ταξίδεψε σωστά. */}
        {what && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, paddingTop: T.sp.xl }}>
            Το πακέτο σου: <strong style={{ color: 'var(--text-primary)' }}>{what}</strong>.
          </div>
        )}

        {/* ── Ο ΕΠΙΛΟΓΕΑΣ ──────────────────────────────────────────────────
            ΤΕΣΣΕΡΙΣ ΣΕΙΡΕΣ, ΟΧΙ ΤΕΣΣΕΡΙΣ ΚΑΡΤΕΣ. Ο τιμοκατάλογος της αρχικής
            πουλάει: έχει χαρακτηριστικά, σήματα και σύγκριση. Εδώ ο χρήστης
            ΕΧΕΙ ΗΔΗ αποφασίσει να ξεκινήσει — του λείπει μόνο το ποιο. Μια
            σειρά ανά πακέτο, όνομα αριστερά, ποσό δεξιά, ίδιος άξονας με την
            κάρτα της εγγραφής.
            ΤΟ ΟΡΙΟ ΑΚΙΝΗΤΩΝ ΕΙΝΑΙ ΤΟ ΜΟΝΟ ΧΑΡΑΚΤΗΡΙΣΤΙΚΟ ΠΟΥ ΜΕΝΕΙ, γιατί
            είναι το μόνο που αποφασίζει πραγματικά ποιο πακέτο χρειάζεται. */}
        {stage === 'choose' && (
          <div style={{ paddingTop: T.sp.xl }}>
            {/* Η ράγα έμεινε χωρίς γέμισμα: το ενεργό `seg` ανεβαίνει με ΤΟ ΙΔΙΟ --bg-elevated
                και πάνω σε γεμισμένη ράγα δεν θα ξεχώριζε από αυτήν. */}
            <div style={{ display: 'flex', gap: 4, padding: 4, marginBottom: 14,
              border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner }}>
              {([['monthly', 'Μηνιαία'], ['annual', 'Ετήσια']] as const).map(([v, lab]) => (
                // seg επειδή η ράγα από πάνω έχει ήδη δικό της περίγραμμα, grow για ίσα μερίδια
                <ChipToggle key={v} on={cycle === v} onClick={() => setCycle(v)} shape="seg" grow>
                  {lab}
                </ChipToggle>
              ))}
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {PLAN_ORDER.filter(id => id !== 'free').map(id => {
                const p = PLANS[id];
                const price = cycle === 'annual' ? p.priceAnnual : p.priceMonthly;
                const limit = Number.isFinite(p.maxProperties)
                  ? (p.maxProperties === 1 ? '1 ακίνητο' : `Έως ${p.maxProperties} ακίνητα`)
                  : 'Απεριόριστα ακίνητα';
                return (
                  <button key={id} type="button" onClick={() => open(id, cycle)}
                    className="po-choice"
                    style={{ display: 'grid', gridTemplateColumns: '1fr auto', columnGap: 14, rowGap: 2,
                      alignItems: 'baseline', width: '100%', minHeight: 58, padding: '11px 14px', textAlign: 'left',
                      // ΤΟ ΠΕΡΙΓΡΑΜΜΑ ΚΑΙ ΤΟ ΦΟΝΤΟ ΤΑ ΔΙΝΕΙ Η `po-choice`. Γραμμένα εδώ,
                      // ακύρωναν την κλάση: στην οθόνη που ΖΗΤΑΕΙ ΤΗΝ ΚΑΡΤΑ, η σειρά του
                      // πακέτου δεν αντιδρούσε ούτε στο ποντίκι ούτε στο πληκτρολόγιο.
                      borderRadius: T.radius.inner, borderWidth: 1, borderStyle: 'solid',
                      cursor: 'pointer', fontFamily: T.font.sans }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>{p.name}</span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right',
                      fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fe(price)}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)' }}>{limit}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {cycle === 'annual' ? 'τον χρόνο' : 'τον μήνα'}
                    </span>
                  </button>
                );
              })}
            </div>

            <p style={{ margin: '14px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--text-tertiary)' }}>
              Οι πρώτες {TRIAL_DAYS} ημέρες είναι χωρίς χρέωση και το πακέτο το αλλάζεις όποτε θέλεις από τις Ρυθμίσεις.
            </p>
          </div>
        )}

        {stage === 'opening' && (
          <div role="status" style={{ padding: '26px 0 4px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Ανοίγει το ταμείο…</div>
        )}

        {stage === 'closed' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '14px 0 0' }}>
              Η πληρωμή δεν άνοιξε αυτή τη στιγμή. {note || 'Η δοκιμή σου τρέχει κανονικά και τη συνδρομή την ολοκληρώνεις όποτε θέλεις από τις Ρυθμίσεις.'}
            </p>
            <Link href="/dashboard" style={TAMEIO_ACTION}>Συνέχεια στην εφαρμογή</Link>
          </>
        )}

        {stage === 'anonymous' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '14px 0 0' }}>
              Ο σύνδεσμος άνοιξε χωρίς ενεργή συνεδρία. Συνδέσου με το email σου
              {signIn === '/login' ? ' και συνέχισε τη συνδρομή από τις Ρυθμίσεις.' : ' και η πληρωμή ανοίγει ξανά με το ίδιο πακέτο.'}
            </p>
            <Link href={signIn} style={TAMEIO_ACTION}>Σύνδεση</Link>
          </>
        )}
    </TameioCard>
  );
}
