// npx tsx app/api/billing/checkout/flow.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΔΡΟΜΟΣ ΠΡΟΣ ΤΟ ΤΑΜΕΙΟ, ΜΕ ΣΥΜΠΕΡΙΦΟΡΑ ΚΑΙ ΟΧΙ ΜΕ ΚΕΙΜΕΝΟ
// ─────────────────────────────────────────────────────────────────────────
// ΠΗΓΗ: έλεγχος ετοιμότητας πληρωμών 12/11/2026, ενότητα 5: «Δεν υπάρχει τεστ
// του handler της διαδρομής (tester, 409, probe)». Η route.ts φορτώνει το
// next/headers και δεν τρέχει σε Node, οπότε ο checkoutGate.test.ts κοιτούσε
// μόνο τη ΣΕΙΡΑ των ελέγχων στο κείμενο. Η απόφαση ζει πλέον στο flow.ts, με
// τον έμπορο, το περιβάλλον και το προφίλ ως ορίσματα· εδώ τρέχει ολόκληρη.
//
// ΑΛΗΘΙΝΑ: η θύρα του Creem (ρύθμιση, χάρτης, configError), η συνθήκη του
// ταμείου, οι κανόνες πρόσβασης, τα λόγια χρέωσης. ΨΕΥΤΙΚΑ: το προφίλ της βάσης
// και το `openCheckout`, που θα χτυπούσε τον έμπορο.
// ═══════════════════════════════════════════════════════════════════════════
import { checkoutResponse, LINK_MINUTES, type CheckoutProfile } from './flow';
import { creemPort } from '@/lib/billing/merchant/creem';
import type { CheckoutOrder, MerchantPort } from '@/lib/billing/merchant';
import { SITE } from '@/lib/core/site';
import { billingWords } from '@/lib/legal/billingWords';
import { PAST_DUE_GRACE_DAYS } from '@/lib/billing/subscription';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };
console.info = () => {};

const FULL = 'prod_a:solo:monthly,prod_b:solo:annual,prod_c:owner:monthly,prod_d:owner:annual,'
  + 'prod_e:agency:monthly,prod_f:agency:annual,prod_g:office:monthly,prod_h:office:annual';
const LIVE = { CREEM_API_KEY: 'creem_live_k', CREEM_PRODUCTS: FULL, CREEM_WEBHOOK_SECRET: 's', VERCEL_ENV: 'production' };
const CLOSED = { ...LIVE, CREEM_API_KEY: 'creem_test_k' };

const NOW = Date.parse('2026-11-12T10:00:00.000Z');
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

const blank: CheckoutProfile = {
  profile_type: null, trial_used_at: null, tester_since: null, full_name: 'Μαρία',
  subscription_status: null, mor_ends_at: null,
};

/** Ενας έμπορος που θυμάται κάθε ταμείο που του ζητήθηκε. */
function fakeMerchant(result: { url: string | null; error: string } = { url: 'https://pay.example/c/1', error: '' }) {
  const orders: CheckoutOrder[] = [];
  const mor: MerchantPort = {
    ...creemPort,
    async openCheckout(order) { orders.push(order); return result; },
  };
  return { mor, orders };
}

async function ask(
  q: { plan?: string; cycle?: string; probe?: boolean },
  o: { env?: Record<string, string>; profile?: (Partial<CheckoutProfile> & Record<string, unknown>) | null; merchant?: ReturnType<typeof fakeMerchant> } = {},
) {
  const m = o.merchant ?? fakeMerchant();
  let profileReads = 0;
  const reports: { route: string; what: string; status?: number }[] = [];
  const res = await checkoutResponse(
    { plan: q.plan ?? 'owner', cycle: q.cycle ?? 'monthly', probe: !!q.probe },
    {
      env: o.env ?? LIVE,
      mor: m.mor,
      user: { id: 'u1', email: 'a@b.gr' },
      readProfile: async () => { profileReads++; return o.profile === null ? null : { ...blank, ...(o.profile ?? {}) }; },
      now: () => NOW,
      report: (route, what, f) => { reports.push({ route, what, status: f?.status }); },
    },
  );
  return { status: res.status, body: await res.json() as Record<string, unknown>, orders: m.orders, profileReads, reports };
}

async function main() {
  // ── 1. ΑΓΝΩΣΤΟ ΠΑΚΕΤΟ Ή ΚΥΚΛΟΣ: 400 ΠΡΙΝ ΑΠΟ ΟΤΙΔΗΠΟΤΕ ΑΛΛΟ ──────────────
  for (const q of [{ plan: 'platinum' }, { plan: 'free' }, { plan: 'owner', cycle: 'weekly' }, { plan: '__proto__' }]) {
    const r = await ask(q);
    ok(`400 για ${q.plan}/${q.cycle ?? 'monthly'}`, r.status === 400 && r.orders.length === 0 && r.profileReads === 0);
  }

  // ── 2. ΚΛΕΙΣΤΟ ΤΑΜΕΙΟ: 200 ΜΕ available:false, ΟΧΙ 503 ───────────────────
  {
    const r = await ask({}, { env: CLOSED });
    ok('κλειστό: 200 με available false', r.status === 200 && r.body.available === false && r.body.url === null);
    ok('κλειστό: η φράση των Ορων', r.body.note === billingWords(CLOSED, undefined, creemPort).chargingToday);
    ok('κλειστό: ούτε προφίλ ούτε έμπορος', r.profileReads === 0 && r.orders.length === 0);
    const probe = await ask({ probe: true }, { env: {} });
    ok('κλειστό και στο probe', probe.body.available === false);
  }

  // ── 3. Ο ΔΟΚΙΜΑΣΤΗΣ ΔΕΝ ΑΓΟΡΑΖΕΙ ───────────────────────────────────────
  {
    const r = await ask({}, { profile: { tester_since: '2026-09-01T00:00:00Z' } });
    ok('δοκιμαστής: available false με tester', r.status === 200 && r.body.available === false && r.body.tester === true);
    ok('δοκιμαστής: κανένα ταμείο', r.orders.length === 0);
  }

  // ── 4. ΣΥΝΔΡΟΜΗ ΠΟΥ ΙΣΧΥΕΙ: 409· ΤΟ PROBE ΛΕΕΙ «ΣΥΝΔΡΟΜΗΤΗΣ» ────────────
  for (const [name, p] of [
    ['ενεργή', { subscription_status: 'active' }],
    ['σε δοκιμή', { subscription_status: 'on_trial' }],
    ['ακυρωμένη που τρέχει', { subscription_status: 'cancelled', mor_ends_at: iso(NOW + 5 * DAY) }],
    // Η ΚΑΡΤΑ ΘΕΛΕΙ ΕΝΗΜΕΡΩΣΗ, ΟΧΙ ΔΕΥΤΕΡΗ ΣΥΝΔΡΟΜΗ: ο έμπορος ξαναδοκιμάζει την
    // είσπραξη και μια νέα αγορά θα χρέωνε δύο φορές μόλις πετύχει.
    ['σε καθυστέρηση πληρωμής', { subscription_status: 'past_due', mor_past_due_at: iso(NOW - DAY) }],
    ['σε καθυστέρηση πέρα από τη χάρη', { subscription_status: 'past_due', mor_past_due_at: iso(NOW - (PAST_DUE_GRACE_DAYS + 3) * DAY) }],
  ] as const) {
    const r = await ask({}, { profile: p });
    ok(`${name}: 409`, r.status === 409 && typeof r.body.error === 'string' && r.orders.length === 0);
    const probe = await ask({ probe: true }, { profile: p });
    ok(`${name}: το probe λέει ανοιχτό με subscribed`, probe.body.available === true && probe.body.subscribed === true && probe.body.url === null);
  }
  for (const [name, p] of [
    ['ακυρωμένη που έληξε', { subscription_status: 'cancelled', mor_ends_at: iso(NOW - DAY) }],
    ['ανείσπρακτη', { subscription_status: 'unpaid' }],
    ['μετά από επιστροφή χρημάτων', { subscription_status: 'expired', mor_ends_at: iso(NOW - DAY) }],
  ] as const) {
    const r = await ask({}, { profile: p });
    ok(`${name}: ανοίγει νέο ταμείο`, r.status === 200 && r.orders.length === 1);
  }

  // ── 5. PROBE ΓΙΑ ΛΟΓΑΡΙΑΣΜΟ ΧΩΡΙΣ ΣΥΝΔΡΟΜΗ: ΑΠΑΝΤΗΣΗ ΧΩΡΙΣ ΤΑΜΕΙΟ ───────────
  {
    const r = await ask({ probe: true });
    ok('probe: available true, χωρίς σύνδεσμο', r.status === 200 && r.body.available === true && r.body.url === null);
    ok('probe: ΚΑΜΙΑ συνεδρία πληρωμής στον έμπορο', r.orders.length === 0);
    ok('probe: η φράση της ζωντανής χρέωσης', r.body.note === billingWords(LIVE, undefined, creemPort).chargingToday);
  }

  // ── 6. ΤΟ ΤΑΜΕΙΟ: ΤΙ ΖΗΤΙΕΤΑΙ ΑΠΟ ΤΟΝ ΕΜΠΟΡΟ ─────────────────────────────
  {
    const r = await ask({ plan: 'agency', cycle: 'annual' }, { profile: { trial_used_at: '2026-08-01T00:00:00Z' } });
    const o = r.orders[0];
    ok('ταμείο: 200 με τον σύνδεσμο', r.status === 200 && r.body.available === true && r.body.url === 'https://pay.example/c/1');
    ok('ταμείο: ο αγοραστής από τη συνεδρία', o?.buyer.userId === 'u1' && o?.buyer.email === 'a@b.gr' && o?.buyer.name === 'Μαρία');
    ok('ταμείο: το πακέτο και ο κύκλος που ζητήθηκαν', o?.plan === 'agency' && o?.cycle === 'annual');
    ok('ταμείο: η επιστροφή στον πίνακα', o?.redirectUrl === `${SITE}/dashboard?checkout=ok`);
    ok('ταμείο: η δοκιμή είναι μία ανά λογαριασμό', o?.skipTrial === true);
    ok('ταμείο: ο σύνδεσμος λήγει', o?.expiresAt === iso(NOW + LINK_MINUTES * 60_000));
    const fresh = await ask({}, { profile: null });
    ok('χωρίς προφίλ ακόμη: ανοίγει, χωρίς παράλειψη δοκιμής', fresh.status === 200 && fresh.orders[0]?.skipTrial === false);
  }

  // ── 7. Ο ΕΜΠΟΡΟΣ ΑΡΝΕΙΤΑΙ: 502· ΤΟ ΚΕΙΜΕΝΟ ΤΟΥ ΔΕΝ ΤΑΞΙΔΕΥΕΙ ─────────────
  {
    const r = await ask({}, { merchant: fakeMerchant({ url: null, error: 'ο έμπορος απάντησε 500: key creem_live_k invalid' }) });
    ok('άρνηση εμπόρου: 502', r.status === 502 && r.body.error === 'Το ταμείο δεν άνοιξε.');
    ok('άρνηση εμπόρου: καμία λέξη του εμπόρου στην απάντηση', !JSON.stringify(r.body).includes('creem_live_k'));
    ok('άρνηση εμπόρου: αναφορά με όνομα, όχι με κείμενο', r.reports.length === 1
       && r.reports[0].route === 'api/billing/checkout' && r.reports[0].status === 502 && !r.reports[0].what.includes('invalid'));
  }
  {
    const r = await ask({}, { merchant: fakeMerchant({ url: null, error: '' }) });
    ok('χωρίς σύνδεσμο και χωρίς σφάλμα: available false', r.status === 200 && r.body.available === false);
  }
}

main().then(() => {
  console.log(fail === 0 ? `✓ checkout (ροή): ${pass} έλεγχοι πέρασαν` : `✗ checkout (ροή): ${fail} απέτυχαν από ${pass + fail}`);
  if (fail > 0) process.exit(1);
});
