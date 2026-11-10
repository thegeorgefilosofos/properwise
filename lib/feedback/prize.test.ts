// npx tsx lib/feedback/prize.test.ts
// Κλήρωση αξιολόγησης: ο κώδικας κάνει ό,τι γράφουν οι Όροι (#klirosi).
import { readFileSync } from 'node:fs';
import { isPrizeTokenShape, peekPrize, acceptPrize, PRIZE_ACCEPT_DAYS, PRIZE_PATH } from './prize';
import type { SupabaseClient } from '@supabase/supabase-js';

let p = 0, f = 0;
const ok = (c: boolean, m: string) => { if (c) p++; else { f++; console.error('✗', m); } };
const eq = (a: unknown, b: unknown, m: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);

const SQL = readFileSync('supabase/migrations/20261110133000_i_klirosi_axiologisis_opos_oi_oroi.sql', 'utf8');
const TERMS = readFileSync('app/terms/page.tsx', 'utf8');
const COPY = readFileSync('supabase/functions/_shared/emailCopy/product.ts', 'utf8');
const POLICY = readFileSync('supabase/functions/_shared/emailPolicy.ts', 'utf8');
const ROBOTS = readFileSync('app/robots.ts', 'utf8');
const LAYOUT = readFileSync('app/doro/[token]/layout.tsx', 'utf8');
const ACTIONS = readFileSync('app/doro/[token]/PrizeActions.tsx', 'utf8');
const FEEDBACK = readFileSync('app/dashboard/components/Feedback.tsx', 'utf8');
// Χωρίς σχόλια SQL: οι έλεγχοι κρίνουν κώδικα, όχι περιγραφή.
const CODE = SQL.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');

/** Πελάτης υπηρεσίας που απαντά ό,τι του δώσουμε και θυμάται τι ζητήθηκε. */
function fakeDb(reply: { data: unknown; error: unknown }) {
  const calls: { fn: string; args: unknown }[] = [];
  const db = { rpc: async (fn: string, args: unknown) => { calls.push({ fn, args }); return reply; } } as unknown as SupabaseClient;
  return { db, calls };
}

async function main() {
  const T = 'A'.repeat(43);

  // ── Οι Όροι και ο κώδικας λένε τα ίδια ─────────────────────────────────────
  ok(TERMS.includes('στο τέλος κάθε ημερολογιακού μήνα') && /Αν δεν απαντήσει μέσα σε 14[\s\u00A0]ημέρες, το δώρο κληρώνεται εκ νέου/.test(TERMS),
    'οι Όροι γράφουν μηνιαία κλήρωση και 14 ημέρες (αν άλλαξαν, ξαναδές τον κώδικα)');
  eq(PRIZE_ACCEPT_DAYS, 14, 'οι ημέρες αποδοχής είναι όσες οι Όροι');
  ok(CODE.includes(`v_days    int := ${PRIZE_ACCEPT_DAYS};`) && CODE.includes('make_interval(days => v_days)') && CODE.includes("'acceptDays', v_days"),
    'η βάση βάζει λήξη 14 ημερών και στέλνει τις ίδιες ημέρες στο email');
  ok(!/\b14\b/.test(COPY.slice(COPY.indexOf('feedback_prize_won:'), COPY.indexOf('best_practice_tip'))) && !COPY.slice(COPY.indexOf('feedback_prize_won:'), COPY.indexOf('best_practice_tip')).includes('χωρίς χρέωση'),
    'το email δεν γράφει με το χέρι ημέρες ούτε «χωρίς χρέωση»');
  ok(/'M' \|\| extract\(year from timezone\('UTC', p_ts\)\)/.test(CODE) && !/floor\(m::numeric \/ 4\)/.test(CODE),
    'η καμπάνια είναι ο ημερολογιακός μήνας, όχι τετράμηνο');
  ok(CODE.includes("'0 3 * * *'") && CODE.includes("cron.unschedule('feedback-draw-monthly')"),
    'το cron τρέχει κάθε μέρα, για να πιάνει τις λήξεις των 14 ημερών');

  // ── Η πίστωση γίνεται με την αποδοχή, όχι με την κλήρωση ─────────────────────
  const offerNew = CODE.slice(CODE.indexOf('function private.feedback_prize_offer_new'), CODE.indexOf('function public.draw_feedback_winner'));
  const accept = CODE.slice(CODE.indexOf('function private.feedback_prize_accept'), CODE.indexOf('function public.accept_feedback_prize_token'));
  ok(offerNew.length > 0 && !offerNew.includes('billing_profiles'), 'η κλήρωση ΔΕΝ πιστώνει τίποτα');
  ok(accept.includes('insert into public.billing_profiles') && accept.includes("'agency'") && accept.includes("interval '12 months'"),
    'η αποδοχή πιστώνει έναν χρόνο «Επαγγελματίας» (agency), όπως οι Όροι');
  ok(/p_adult is distinct from true then return jsonb_build_object\('ok', false, 'kind', 'adult_required'\)/.test(accept),
    'χωρίς «Είμαι άνω των 18» δεν γίνεται αποδοχή');
  ok(accept.includes('adult_confirmed_at = now()') && /check \(status <> 'accepted' or \(accepted_at is not null and adult_confirmed_at is not null/.test(CODE),
    'η δήλωση ηλικίας γράφεται με ημερομηνία και ώρα· η βάση δεν δέχεται αποδοχή χωρίς αυτήν');

  // ── Νέα κλήρωση ανάμεσα στους υπόλοιπους του ίδιου μήνα ─────────────────────
  ok(offerNew.includes('where f.campaign_id = p_campaign and f.in_pool') && /not exists \(select 1 from public\.feedback_prize_offers o\s+where o\.campaign_id = p_campaign and o\.user_id = f\.user_id\)/.test(offerNew),
    'η νέα κλήρωση είναι ανάμεσα στους συμμετέχοντες του ίδιου μήνα που δεν κληρώθηκαν ήδη');
  ok(/unique \(campaign_id, user_id\)/.test(CODE) && /on public\.feedback_prize_offers \(campaign_id\) where status in \('pending', 'accepted'\)/.test(CODE),
    'κανείς δεν κληρώνεται δύο φορές για τον ίδιο μήνα· ο μήνας έχει το πολύ έναν ενεργό νικητή');
  ok(/set status = 'expired'\s+where status = 'pending' and expires_at <= now\(\)/.test(CODE), 'όσα έληξαν σημειώνονται και ξανακληρώνονται');
  ok(/from public\.feedback_campaign_winners where campaign_id = p_campaign\) then\s+return null;/.test(CODE),
    'ο μήνας κλείνει με την αποδοχή: σβησμένος λογαριασμός δεν φέρνει δεύτερη κλήρωση');
  ok(/update public\.user_feedback f\s+set campaign_id = \(select c\.campaign_id from public\.feedback_campaign\(f\.created_at\) c\)\s+where f\.campaign_id !~ '\^M'/.test(CODE),
    'οι συμμετοχές του μήνα με την παλιά καμπάνια περνούν στον μήνα τους');
  ok(!accept.includes('comp_months_granted') && accept.includes("greatest(coalesce(billing_profiles.comp_until, now()), now()) + interval '12 months'")
    && accept.includes("public.plan_rank(billing_profiles.comp_plan) > public.plan_rank('agency')"),
    'η πίστωση προστίθεται, κρατά το ανώτερο πακέτο και δεν αγγίζει τον μετρητή της πρόσκλησης');

  // ── Το διακριτικό: μίας χρήσης, μη προβλέψιμο, μόνο το SHA-256 στη βάση ─────
  ok(offerNew.includes('gen_random_bytes(32)') && offerNew.includes("encode(sha256(convert_to(v_token, 'UTF8')), 'hex')"),
    'διακριτικό 256 bit και στη βάση μόνο το SHA-256 του');
  ok(/token_hash\s+text not null unique check \(token_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/.test(CODE), 'η στήλη δέχεται μόνο αποτύπωμα');
  ok(accept.includes("if o.status = 'accepted' then return jsonb_build_object('ok', false, 'kind', 'used')"), 'μίας χρήσης: δεύτερη αποδοχή απορρίπτεται');
  ok(/revoke all on table public\.feedback_prize_offers from public, anon, authenticated/.test(CODE)
    && /revoke all on function public\.accept_feedback_prize_token\(text, boolean\) from public, anon, authenticated/.test(CODE)
    && /grant execute on function public\.accept_my_feedback_prize\(boolean\) to authenticated/.test(CODE),
    'ο πίνακας και η αποδοχή με διακριτικό μόνο για την υπηρεσία· ο συνδεδεμένος αποδέχεται μόνο το δικό του');
  ok(/accept_my_feedback_prize[\s\S]*?private\.mfa_satisfied\(\)/.test(CODE), 'η αποδοχή μέσα από την εφαρμογή περνά από το δεύτερο βήμα');

  for (const bad of ['', 'x', 'a'.repeat(42), 'a'.repeat(44), '../../etc', null, 42]) ok(!isPrizeTokenShape(bad), `απορρίπτεται: ${String(bad).slice(0, 12)}`);
  ok(isPrizeTokenShape(T), 'δεκτό: 43 χαρακτήρες base64url');

  // ── Η σελίδα και το email ───────────────────────────────────────────────────
  // κυριολεκτικό-πρότυπο: το robots.ts γράφει τη διαδρομή από τη σταθερά.
  ok(PRIZE_PATH === '/doro' && LAYOUT.includes("NOINDEX as metadata") && ROBOTS.includes('`${PRIZE_PATH}/`') && ROBOTS.includes("from '@/lib/feedback/prize'"),
    'η σελίδα του συνδέσμου δεν μπαίνει σε ευρετήριο');
  ok(/disabled=\{busy \|\| !adult\}/.test(ACTIONS) && ACTIONS.includes('Είμαι άνω των 18') && ACTIONS.includes('Αποδέχομαι το δώρο'),
    'στη σελίδα το κουμπί μένει ανενεργό χωρίς τη δήλωση ηλικίας');
  ok(FEEDBACK.includes("rpc('accept_my_feedback_prize', { p_adult: true })") && FEEDBACK.includes('Είμαι άνω των 18'),
    'η αποδοχή γίνεται και μέσα στην εφαρμογή');
  // κυριολεκτικό-πρότυπο: ψάχνουμε το «${token}» όπως είναι γραμμένο στο email.
  ok(COPY.includes('feedback_prize_won:') && COPY.includes('/doro/${token}') && COPY.includes("'Αποδέχομαι το δώρο'"),
    'το email έχει τον σύνδεσμο αποδοχής');
  ok(POLICY.includes("'feedback_prize_won'") && CODE.includes("'transactional'"), 'το email είναι συναλλακτικό: το ζητούν οι Όροι');

  // ── Η πλευρά της εφαρμογής ──────────────────────────────────────────────────
  {
    const { db, calls } = fakeDb({ data: { ok: true }, error: null });
    eq(await acceptPrize(db, T, false), { ok: false, kind: 'adult_required' }, 'χωρίς δήλωση ηλικίας ούτε καν φτάνει στη βάση');
    eq(calls.length, 0, 'καμία κλήση χωρίς δήλωση');
    eq(await acceptPrize(db, 'κακό', true), { ok: false, kind: 'invalid' }, 'λάθος σχήμα: άκυρο, χωρίς κλήση');
    eq(await acceptPrize(db, T, true), { ok: true }, 'αποδοχή');
    eq(calls, [{ fn: 'accept_feedback_prize_token', args: { p_token: T, p_adult: true } }], 'ζητά από τη βάση με τη δήλωση');
  }
  for (const kind of ['used', 'expired', 'invalid', 'adult_required']) {
    const { db } = fakeDb({ data: { ok: false, kind }, error: null });
    eq(await acceptPrize(db, T, true), { ok: false, kind }, `η βάση λέει ${kind}`);
  }
  {
    const { db } = fakeDb({ data: { ok: false, kind: 'κάτι-άλλο' }, error: null });
    eq(await acceptPrize(db, T, true), { ok: false, kind: 'error' }, 'άγνωστη απάντηση: σφάλμα, όχι επιτυχία');
  }
  {
    const { db } = fakeDb({ data: null, error: { message: 'down' } });
    eq(await acceptPrize(db, T, true), { ok: false, kind: 'error' }, 'πεσμένη βάση: σφάλμα');
    eq(await peekPrize(db, T), { ok: false, kind: 'error' }, 'πεσμένη βάση στη σελίδα: σφάλμα');
  }
  {
    const { db } = fakeDb({ data: { ok: true, expires_at: '2026-11-24T03:00:00Z' }, error: null });
    eq(await peekPrize(db, T), { ok: true, expiresAt: '2026-11-24T03:00:00Z' }, 'η σελίδα παίρνει τη λήξη');
  }

  console.log(`κλήρωση αξιολόγησης: ${p} ✓ · ${f} ✗`);
  if (f) process.exit(1);
}
main();
