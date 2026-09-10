// npx tsx lib/billing/merchant/creem.test.ts
//
// ΔΥΟ ΚΑΤΑΛΟΓΟΙ ΚΑΤΑΣΤΑΣΕΩΝ ΠΟΥ ΜΟΙΑΖΟΥΝ ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΟΙ ΙΔΙΟΙ
// ─────────────────────────────────────────────────────────────────────────
// Ο πάροχος γράφει «canceled» με ΕΝΑ λάμδα, η εφαρμογή «cancelled» με δύο.
// Σκέτη σύγκριση συμβολοσειρών θα άφηνε κάθε ακύρωση αδιάβαστη — δηλαδή ο
// συνδρομητής που ακύρωσε θα κρατούσε πρόσβαση για πάντα.
//
// ΚΑΙ ΤΟ ΑΝΤΙΣΤΡΟΦΟ, ΠΟΥ ΕΙΝΑΙ ΧΕΙΡΟΤΕΡΟ. Το «scheduled_cancel» σημαίνει «θα
// ακυρωθεί στο τέλος της περιόδου»: ο συνδρομητής έχει πληρώσει τον μήνα και
// τον δικαιούται ολόκληρο. Διαβασμένο ως λήξη, θα του έκοβε πρόσβαση που έχει
// ήδη πληρώσει — το χειρότερο σφάλμα που μπορεί να κάνει ένα σύστημα χρέωσης.
//
// Καθε ισχυρισμός εδώ δοκιμάζεται πάνω στο ΑΛΗΘΙΝΟ σχήμα του παρόχου, όπως το
// δίνει η επίσημη προδιαγραφή του: φάκελος «eventType» και «object», προϊόν
// και πελάτης ως αντικείμενα με «id», ημερομηνία «current_period_end_date».
import { createHmac } from 'node:crypto';
import { creemPort, CREEM_KEY_ENV, CREEM_PRODUCTS_ENV, CREEM_SECRET_ENV, SIGNATURE_HEADER } from './creem';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

const PRODUCTS = 'prod_a:solo:monthly,prod_b:solo:annual,prod_c:owner:monthly';
const env = { [CREEM_KEY_ENV]: 'k', [CREEM_PRODUCTS_ENV]: PRODUCTS, [CREEM_SECRET_ENV]: 's' };

/** Ενα γεγονός στο σχήμα που στέλνει όντως ο πάροχος. */
const event = (over: Record<string, unknown> = {}, name = 'subscription.active') => ({
  id: 'evt_1',
  eventType: name,
  created_at: 1728734325927,
  object: {
    id: 'sub_1',
    object: 'subscription',
    product: { id: 'prod_a', name: 'Solo' },
    customer: { id: 'cust_1', email: 'a@b.gr' },
    status: 'active',
    current_period_end_date: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-09-07T10:00:00.000Z',
    metadata: { user_id: 'u1' },
    ...over,
  },
});

// ── Ρύθμιση ───────────────────────────────────────────────────────────────
{
  ok('χωρίς κλειδί δεν μιλά', !creemPort.canTalk({}));
  ok('χωρίς κλειδί δεν πουλά', !creemPort.isLive({}));
  ok('με κλειδί μιλά, χωρίς χάρτη', creemPort.canTalk({ [CREEM_KEY_ENV]: 'k' }));
  // Η ΔΙΑΦΟΡΑ ΕΙΝΑΙ ΠΡΑΓΜΑΤΙΚΗ: η πύλη πελάτη χρειάζεται μόνο το κλειδί, γιατί
  // η συνδρομή υπάρχει ήδη. Ενώνοντάς τα, υπάρχων συνδρομητής θα έχανε τα
  // παραστατικά του επειδή λείπει μεταβλητή που αφορά ΝΕΕΣ αγορές.
  ok('με κλειδί χωρίς χάρτη ΔΕΝ πουλά', !creemPort.isLive({ [CREEM_KEY_ENV]: 'k' }));
  ok('με κλειδί και χάρτη πουλά', creemPort.isLive(env));
  ok('το σφάλμα ρύθμισης ονομάζει τη μεταβλητή που λείπει',
     creemPort.configError({}).includes(CREEM_KEY_ENV)
     && creemPort.configError({ [CREEM_KEY_ENV]: 'k' }).includes(CREEM_PRODUCTS_ENV));
  ok('πλήρης ρύθμιση δεν παραπονιέται', creemPort.configError(env) === '');
}

// ── Οι καταστάσεις, μία προς μία ─────────────────────────────────────────
{
  const st = (s: string) => {
    const r = creemPort.readEvent(event({ status: s }), env);
    return r.ok ? r.event.sub.status : null;
  };
  ok('active → active', st('active') === 'active');
  ok('trialing → on_trial', st('trialing') === 'on_trial');
  ok('paused → paused', st('paused') === 'paused');
  ok('past_due → past_due', st('past_due') === 'past_due');
  ok('unpaid → unpaid', st('unpaid') === 'unpaid');
  // Ενα λάμδα εκεί, δύο εδώ.
  ok('canceled (ένα λάμδα) → cancelled (δύο)', st('canceled') === 'cancelled');
  // Πληρωμένη περίοδος που τρέχει ακόμη.
  ok('scheduled_cancel → cancelled, όχι λήξη', st('scheduled_cancel') === 'cancelled');
  const unknown = creemPort.readEvent(event({ status: 'ουφ' }), env);
  ok('άγνωστη κατάσταση δεν μαντεύεται', !unknown.ok);
  ok('και ζητά επανάληψη, γιατί είναι συνδρομή', !unknown.ok && unknown.ours === true);
}

// ── Η ΛΗΞΗ ΤΗΣ ΠΡΟΣΒΑΣΗΣ ΕΙΝΑΙ ΤΟ ΤΕΛΟΣ ΤΗΣ ΠΕΡΙΟΔΟΥ, ΟΧΙ Η ΣΤΙΓΜΗ ΤΟΥ ΠΑΤΗΜΑΤΟΣ
{
  const r = creemPort.readEvent(event({
    status: 'canceled',
    canceled_at: '2026-09-07T09:00:00.000Z',
    current_period_end_date: '2026-11-01T00:00:00.000Z',
  }), env);
  ok('η ακύρωση κρατά την πληρωμένη περίοδο',
     r.ok && r.event.sub.endsAt === '2026-11-01T00:00:00.000Z');
  const active = creemPort.readEvent(event(), env);
  ok('η ενεργή δεν έχει λήξη', active.ok && active.event.sub.endsAt === null);
}

// ── Ο φάκελος: ποιον αφορά, ποιο πακέτο, πότε συνέβη ─────────────────────
{
  const r = creemPort.readEvent(event(), env);
  ok('το γεγονός διαβάζεται', r.ok);
  ok('ο λογαριασμός βγαίνει από το metadata', r.ok && r.event.sub.userId === 'u1');
  ok('το προϊόν γίνεται πακέτο', r.ok && r.event.plan?.plan === 'solo' && r.event.plan?.cycle === 'monthly');
  ok('ο πελάτης διαβάζεται από αντικείμενο', r.ok && r.event.sub.customerId === 'cust_1');
  // Ο φάκελος στέλνει χιλιοστά εποχής· η σειρά των γεγονότων κρέμεται από αυτό.
  ok('η ώρα του γεγονότος έρχεται από τον φάκελο',
     r.ok && r.event.occurredAt === new Date(1728734325927).toISOString());
  // Ο πάροχος στέλνει άλλοτε αντικείμενο κι άλλοτε σκέτο αναγνωριστικό.
  const flat = creemPort.readEvent(event({ product: 'prod_b', customer: 'cust_9' }), env);
  ok('προϊόν ως σκέτο κείμενο διαβάζεται',
     flat.ok && flat.event.plan?.cycle === 'annual' && flat.event.sub.customerId === 'cust_9');
}

// ── Τι ΔΕΝ μας αφορά· τι είναι δική μας βλάβη ────────────────────────
{
  const other = creemPort.readEvent({ eventType: 'checkout.completed', object: {} }, env);
  ok('το ταμείο δεν είναι συνδρομή', !other.ok && other.ours === false);
  ok('και δεν χρεώνεται στη ρύθμισή μας', !other.ok && other.config !== true);

  const noMap = creemPort.readEvent(event(), { ...env, [CREEM_PRODUCTS_ENV]: '' });
  ok('χάρτης κενός είναι ΔΙΚΗ ΜΑΣ ρύθμιση', !noMap.ok && noMap.config === true);

  const unknownProduct = creemPort.readEvent(event({ product: { id: 'prod_zzz' } }), env);
  ok('άγνωστο προϊόν διαβάζεται αλλά δεν δίνει πακέτο',
     unknownProduct.ok && unknownProduct.event.plan === null);

  const noObject = creemPort.readEvent({ eventType: 'subscription.active' }, env);
  ok('συνδρομή χωρίς αντικείμενο ζητά επανάληψη', !noObject.ok && noObject.ours === true);
}

// ── Η υπογραφή ───────────────────────────────────────────────────────────
{
  const body = JSON.stringify(event());
  const good = createHmac('sha256', 's').update(body, 'utf8').digest('hex');
  const h = (v: string) => new Headers({ [SIGNATURE_HEADER]: v });
  ok('γνήσια υπογραφή περνά', creemPort.verifyWebhook(body, h(good), env));
  ok('αλλοιωμένο σώμα κόβεται', !creemPort.verifyWebhook(body + ' ', h(good), env));
  ok('λάθος υπογραφή κόβεται', !creemPort.verifyWebhook(body, h('00'.repeat(32)), env));
  ok('χωρίς κεφαλίδα κόβεται', !creemPort.verifyWebhook(body, new Headers(), env));
  ok('χωρίς μυστικό κόβεται', !creemPort.verifyWebhook(body, h(good), { ...env, [CREEM_SECRET_ENV]: '' }));
  // Το μήκος δεν είναι μυστικό, αλλά η διαφορά του δεν επιτρέπεται να ρίξει.
  ok('υπογραφή άλλου μήκους δεν πετά', creemPort.verifyWebhook(body, h('abc'), env) === false);
}

// ── Ποιο πακέτο τρέχει· ποιο ζητήθηκε ────────────────────────────────
{
  const state = { status: 'active' as const, variantId: 'prod_c', renewsAt: null, trialEndsAt: null };
  ok('planOf βρίσκει το πακέτο', creemPort.planOf(state, env)?.plan === 'owner');
  ok('isAt αναγνωρίζει το ίδιο πακέτο', creemPort.isAt(state, 'owner', 'monthly', env));
  ok('isAt δεν μπερδεύει κύκλο', !creemPort.isAt(state, 'owner', 'annual', env));
  ok('χωρίς προϊόν δεν υπάρχει πακέτο',
     creemPort.planOf({ ...state, variantId: null }, env) === null);
}

// ── Τι θέλει ακύρωση όταν διαγράφεται λογαριασμός ────────────────────────
{
  ok('η ενεργή ακυρώνεται', creemPort.needsCancelling('active'));
  ok('η δοκιμή ακυρώνεται', creemPort.needsCancelling('on_trial'));
  ok('η καθυστερημένη ακυρώνεται', creemPort.needsCancelling('past_due'));
  // ΔΕΥΤΕΡΗ ΑΚΥΡΩΣΗ ΕΠΙΣΤΡΕΦΕΙ ΣΦΑΛΜΑ ΚΑΙ ΘΑ ΜΠΛΟΚΑΡΕ ΤΗ ΔΙΑΓΡΑΦΗ.
  ok('η ήδη ακυρωμένη δεν ξαναακυρώνεται', !creemPort.needsCancelling('cancelled'));
  ok('η ληγμένη δεν ακυρώνεται', !creemPort.needsCancelling('expired'));
  ok('το κενό δεν ακυρώνεται', !creemPort.needsCancelling(null));
}

async function main() {
  // ── Το ταμείο: τι στέλνεται στον έμπορο ──────────────────────────────────
  {
    let sent: { url: string; init: RequestInit } | null = null;
    const fake: typeof fetch = async (url, init) => {
      sent = { url: String(url), init: init || {} };
      return new Response(JSON.stringify({ checkout_url: 'https://creem.io/c/1' }), { status: 200 });
    };
    const order = {
      buyer: { userId: 'u1', email: 'a@b.gr' },
      plan: 'solo' as const, cycle: 'monthly' as const,
      redirectUrl: 'https://properwise.gr/ok', skipTrial: false,
    };
    const r = await creemPort.openCheckout(order, env, fake);
    ok('το ταμείο επιστρέφει διεύθυνση', r.url === 'https://creem.io/c/1' && r.error === '');
    const s = sent as unknown as { url: string; init: RequestInit } | null;
    ok('χτυπά τον διακομιστή παραγωγής', !!s && s.url === 'https://api.creem.io/v1/checkouts');
    const body = JSON.parse(String(s?.init.body || '{}'));
    ok('στέλνει το σωστό προϊόν', body.product_id === 'prod_a');
    // ΧΩΡΙΣ ΑΥΤΟ, Ο WEBHOOK ΔΕΝ ΞΕΡΕΙ ΠΟΙΟΝ ΑΦΟΡΑ Η ΠΛΗΡΩΜΗ.
    ok('στέλνει τον λογαριασμό στο metadata', body.metadata?.user_id === 'u1');
    ok('στέλνει τη διεύθυνση επιστροφής', body.success_url === 'https://properwise.gr/ok');
    ok('ταυτοποιείται με x-api-key',
       (s?.init.headers as Record<string, string> | undefined)?.['x-api-key'] === 'k');

    const test = await creemPort.openCheckout(order, { ...env, CREEM_TEST_MODE: '1' }, fake);
    ok('η δοκιμαστική λειτουργία αλλάζει διακομιστή',
       test.url !== null && String((sent as unknown as { url: string }).url).startsWith('https://test-api.creem.io'));

    const missing = await creemPort.openCheckout({ ...order, plan: 'agency' as const }, env, fake);
    ok('πακέτο εκτός χάρτη δεν ανοίγει ταμείο', missing.url === null && missing.error.includes('agency'));
  }

  // ── Οταν ο έμπορος απαντά άσχημα ─────────────────────────────────────────
  {
    // ΑΠΑΝΤΗΣΗ ΠΥΛΗΣ ΜΕ HTML. Ενα σκέτο `.json()` θα έσκαγε και ο χρήστης θα
    // διάβαζε «Εσωτερικό σφάλμα» αντί για την αιτία.
    const html: typeof fetch = async () => new Response('<html>502</html>', { status: 502 });
    const r = await creemPort.subscriptionState('sub_1', env, html);
    ok('HTML αντί για JSON δεν σκάει', r.after === null && r.error.includes('502'));

    const json: typeof fetch = async () => new Response(JSON.stringify({ message: 'no such subscription' }), { status: 404 });
    const r2 = await creemPort.subscriptionState('sub_x', env, json);
    ok('το μήνυμα του εμπόρου φτάνει στον καλούντα', r2.error === 'no such subscription');

    const boom: typeof fetch = async () => { throw new Error('ECONNRESET'); };
    const r3 = await creemPort.subscriptionState('sub_1', env, boom);
    ok('σφάλμα δικτύου δεν πετά έξω', r3.after === null && r3.error === 'ECONNRESET');
  }

  // ── Η πύλη πελάτη: δύο κλήσεις, γιατί ανοίγει για ΠΕΛΑΤΗ ─────────────────
  {
    const calls: string[] = [];
    const fake: typeof fetch = async (url) => {
      const u = String(url);
      calls.push(u);
      if (u.includes('/v1/subscriptions')) {
        return new Response(JSON.stringify({ id: 'sub_1', customer: { id: 'cust_7' }, status: 'active' }), { status: 200 });
      }
      return new Response(JSON.stringify({ customer_portal_link: 'https://creem.io/p/7' }), { status: 200 });
    };
    const r = await creemPort.portalUrl('sub_1', env, fake);
    ok('η πύλη επιστρέφει διεύθυνση', r.url === 'https://creem.io/p/7');
    ok('βρίσκει πρώτα τον πελάτη της συνδρομής',
       calls.length === 2 && calls[0].includes('subscription_id=sub_1') && calls[1].endsWith('/v1/customers/billing'));
  }

  // ── Η αλλαγή πακέτου δεν τερματίζει τη δοκιμή ────────────────────────────
  {
    let body: Record<string, unknown> = {};
    const fake: typeof fetch = async (_u, init) => {
      body = JSON.parse(String(init?.body || '{}'));
      return new Response(JSON.stringify({ id: 'sub_1', status: 'active', product: { id: 'prod_c' } }), { status: 200 });
    };
    const base = { subscriptionId: 'sub_1', plan: 'owner' as const, cycle: 'monthly' as const };
    await creemPort.changePlan({ ...base, kind: 'upgrade', onTrial: true }, env, fake);
    // ΧΩΡΙΣ ΑΥΤΟ, ΜΙΑ ΑΝΑΒΑΘΜΙΣΗ ΜΕΣΑ ΣΤΗ ΔΟΚΙΜΗ ΘΑ ΧΡΕΩΝΕ ΤΗΝ ΙΔΙΑ ΜΕΡΑ.
    ok('σε δοκιμή δεν χρεώνεται τίποτα σήμερα', body.update_behavior === 'proration-none');
    await creemPort.changePlan({ ...base, kind: 'upgrade', onTrial: false }, env, fake);
    ok('η αναβάθμιση χρεώνεται αμέσως', body.update_behavior === 'proration-charge-immediately');
    await creemPort.changePlan({ ...base, kind: 'downgrade', onTrial: false }, env, fake);
    ok('η υποβάθμιση δεν χρεώνει αμέσως', body.update_behavior === 'proration-charge');
    const after = await creemPort.changePlan({ ...base, kind: 'upgrade', onTrial: false }, env, fake);
    ok('η νέα κατάσταση επιστρέφεται', after.after?.variantId === 'prod_c' && after.after?.status === 'active');
  }
}

main().then(() => {
  console.log(`merchant/creem — ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
  console.log('✓ όλα πέρασαν');
});
