// ═══════════════════════════════════════════════════════════════════════════
// Η ΥΛΟΠΟΙΗΣΗ ΓΙΑ CREEM
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΔΕΥΤΕΡΟΣ ΕΜΠΟΡΟΣ. Ο πρώτος πάροχος έμεινε χωρίς έγκριση και ο δεύτερος
// αποκλείστηκε από τον ιδιοκτήτη. Χωρίς έμπορο δεν εισπράττεται ευρώ, δηλαδή
// ολόκληρο το προϊόν κρέμεται από απόφαση τρίτου. Η θύρα γράφτηκε ακριβώς γι'
// αυτό: ένας νέος πάροχος μπαίνει σε ΕΝΑ αρχείο.
//
// ΓΙΑΤΙ MERCHANT OF RECORD ΚΑΙ ΟΧΙ ΑΠΛΟΣ ΠΑΡΟΧΟΣ ΠΛΗΡΩΜΩΝ. Χωρίς εταιρεία με
// ΑΦΜ και έναρξη εργασιών δεν εκδίδεται τιμολόγιο και δεν αποδίδεται ΦΠΑ OSS
// για πελάτη άλλης χώρας της ΕΕ. Ο merchant of record πουλά στο ΔΙΚΟ ΤΟΥ όνομα
// και αναλαμβάνει και τα δύο. Κοστίζει περισσότερο· επιτρέπει πώληση σήμερα.
//
// ΤΙ ΕΠΑΛΗΘΕΥΤΗΚΕ ΑΠΟ ΤΗΝ ΕΠΙΣΗΜΗ ΠΡΟΔΙΑΓΡΑΦΗ (openapi.json του παρόχου, όχι
// από άρθρα σύγκρισης):
//
//     διακομιστές       https://api.creem.io · https://test-api.creem.io
//     ταυτοποίηση       κεφαλίδα «x-api-key»
//     ταμείο            POST /v1/checkouts            → checkout_url
//     πύλη πελάτη       POST /v1/customers/billing    → customer_portal_link
//     ανάγνωση          GET  /v1/subscriptions?subscription_id=…
//     αλλαγή πακέτου    POST /v1/subscriptions/{id}/upgrade
//     ακύρωση           POST /v1/subscriptions/{id}/cancel
//     υπογραφή          κεφαλίδα «creem-signature», HMAC-SHA256 στο ωμό σώμα
//
// ΤΟ ΑΝΑΓΝΩΡΙΣΤΙΚΟ ΤΟΥ ΛΟΓΑΡΙΑΣΜΟΥ ΤΑΞΙΔΕΥΕΙ ΣΤΟ «metadata». Ο πάροχος το
// επιστρέφει αυτούσιο στη συνδρομή και σε κάθε γεγονός της, οπότε ο webhook
// ξέρει ποιον αφορά χωρίς να ψάξει με ηλεκτρονικό ταχυδρομείο — που θα ήταν
// λάθος, γιατί ο πελάτης μπορεί να πληρώσει με άλλο.
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac, timingSafeEqual } from 'node:crypto';
import { parseVariantMap, planOfVariant } from '../lemon';
import type { MorStatus, MorSubscription } from '../subscription';
import { isMorStatus } from '../subscription';
import type {
  BillingEnv, MerchantPort, CheckoutOrder, ChangeOrder,
  CheckoutResult, PortalResult, ChangeResult, ReadEvent, SubscriptionState,
} from './port';
import type { PlanId, BillingCycle } from '../plans';

// ── ΟΙ ΜΕΤΑΒΛΗΤΕΣ, ΟΝΟΜΑΤΙΣΜΕΝΕΣ ΜΙΑ ΦΟΡΑ ────────────────────────────────
export const CREEM_KEY_ENV = 'CREEM_API_KEY';
export const CREEM_PRODUCTS_ENV = 'CREEM_PRODUCTS';
export const CREEM_SECRET_ENV = 'CREEM_WEBHOOK_SECRET';
/** Οποιαδήποτε τιμή εκτός από κενό στέλνει τις κλήσεις στον δοκιμαστικό. */
export const CREEM_TEST_ENV = 'CREEM_TEST_MODE';
export const SIGNATURE_HEADER = 'creem-signature';

const PROD_API = 'https://api.creem.io';
const TEST_API = 'https://test-api.creem.io';

const key = (env: BillingEnv): string => (env[CREEM_KEY_ENV] || '').trim();
const isTest = (env: BillingEnv): boolean => !!(env[CREEM_TEST_ENV] || '').trim();
const base = (env: BillingEnv): string => (isTest(env) ? TEST_API : PROD_API);

const productMap = (env: BillingEnv) => parseVariantMap(env[CREEM_PRODUCTS_ENV], CREEM_PRODUCTS_ENV);

/** Το αναγνωριστικό προϊόντος για ένα πακέτο και κύκλο. Κενό όταν λείπει. */
function productFor(env: BillingEnv, plan: PlanId, cycle: BillingCycle): string {
  const { map } = productMap(env);
  for (const [id, v] of map) if (v.plan === plan && v.cycle === cycle) return id;
  return '';
}

// ═══ Η ΑΝΤΙΣΤΟΙΧΙΣΗ ΚΑΤΑΣΤΑΣΕΩΝ, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΤΑΥΤΟΤΙΚΗ ════════════
//
// Ο πάροχος ορίζει επτά καταστάσεις, η εφαρμογή επτά· ΔΕΝ είναι οι ίδιες.
// Δύο διαφορές που θα κόστιζαν πρόσβαση σε πληρωμένο συνδρομητή:
//
//   · «canceled» με ΕΝΑ λάμδα εκεί, «cancelled» με δύο εδώ. Σκέτη σύγκριση
//     συμβολοσειρών θα άφηνε την ακύρωση αδιάβαστη.
//   · «scheduled_cancel» σημαίνει «θα ακυρωθεί στο τέλος της περιόδου», δηλαδή
//     ο συνδρομητής ΕΧΕΙ ΑΚΟΜΗ πρόσβαση και την έχει πληρώσει. Αντιστοιχεί στη
//     δική μας «cancelled», που ακριβώς αυτό σημαίνει: ακυρωμένη με ισχύ ώς τη
//     λήξη. Το να τη διαβάζαμε ως «expired» θα έκοβε πρόσβαση πληρωμένου μήνα.
//
// Ο πάροχος ΔΕΝ έχει κατάσταση «expired»: το τέλος έρχεται ως γεγονός
// «subscription.expired» με την κατάσταση σε «canceled». Η λήξη της πρόσβασης
// κρίνεται από την ημερομηνία, όπως ήδη κάνει η `isEntitled`.
const STATUS: Record<string, MorStatus> = {
  active: 'active',
  trialing: 'on_trial',
  paused: 'paused',
  past_due: 'past_due',
  unpaid: 'unpaid',
  canceled: 'cancelled',
  scheduled_cancel: 'cancelled',
};

const readStatus = (raw: unknown): MorStatus | null => {
  const s = String(raw || '').trim();
  if (STATUS[s]) return STATUS[s];
  // Αν ο πάροχος προσθέσει αύριο κατάσταση με το ΔΙΚΟ μας όνομα, τη δεχόμαστε.
  return isMorStatus(s) ? s : null;
};

/** Ενα πεδίο που ο πάροχος στέλνει άλλοτε ως αντικείμενο κι άλλοτε ως κείμενο. */
const idOf = (v: unknown): string => {
  if (typeof v === 'string') return v.trim();
  if (v && typeof v === 'object') return String((v as { id?: unknown }).id || '').trim();
  return '';
};

const str = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
};

// ── ΜΙΑ ΚΛΗΣΗ, ΜΙΑ ΜΕΤΑΦΡΑΣΗ ΣΦΑΛΜΑΤΟΣ ───────────────────────────────────
// ΤΟ ΣΩΜΑ ΔΙΑΒΑΖΕΤΑΙ ΩΣ ΚΕΙΜΕΝΟ ΠΡΩΤΑ. Απάντηση πύλης ή εξισορροπητή έρχεται
// με HTML: ένα σκέτο `.json()` θα έσκαγε και ο χρήστης θα διάβαζε «Εσωτερικό
// σφάλμα» αντί για την αιτία. Το ίδιο λάθος βρέθηκε και διορθώθηκε στη
// διαδρομή του βοηθού.
async function call(
  env: BillingEnv, method: 'GET' | 'POST', path: string,
  body: unknown, fetcher: typeof fetch = fetch,
): Promise<{ data: Record<string, unknown> | null; error: string }> {
  const apiKey = key(env);
  if (!apiKey) return { data: null, error: `Λείπει η μεταβλητή: ${CREEM_KEY_ENV}.` };
  let res: Response;
  try {
    res = await fetcher(`${base(env)}${path}`, {
      method,
      headers: { 'x-api-key': apiKey, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      // ΧΡΟΝΙΚΟ ΟΡΙΟ. Κολλημένο αίτημα προς τον έμπορο κρατά τη serverless
      // συνάρτηση ώς το όριο της πλατφόρμας και ο χρήστης βλέπει σπίναρ.
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    const why = e instanceof Error && e.name === 'TimeoutError'
      ? 'ο έμπορος δεν απάντησε εγκαίρως'
      : (e instanceof Error ? e.message : 'άγνωστο σφάλμα δικτύου');
    return { data: null, error: why };
  }
  const raw = await res.text();
  let parsed: unknown = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = null; }
  if (!res.ok) {
    const msg = (parsed && typeof parsed === 'object'
      ? String((parsed as { message?: unknown; error?: unknown }).message
        || (parsed as { error?: unknown }).error || '')
      : '').trim();
    return { data: null, error: msg || `ο έμπορος απάντησε ${res.status}` };
  }
  return { data: (parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}), error: '' };
}

/** Η συνδρομή του παρόχου, μεταφρασμένη στη δική μας γλώσσα. */
function toState(sub: Record<string, unknown> | null | undefined): SubscriptionState {
  const s = sub || {};
  return {
    status: readStatus(s.status),
    variantId: idOf(s.product) || null,
    renewsAt: str(s.current_period_end_date) ?? str(s.next_transaction_date),
    trialEndsAt: readStatus(s.status) === 'on_trial' ? str(s.current_period_end_date) : null,
  };
}

async function fetchSubscription(
  subscriptionId: string, env: BillingEnv, fetcher?: typeof fetch,
): Promise<{ sub: Record<string, unknown> | null; error: string }> {
  const q = `/v1/subscriptions?subscription_id=${encodeURIComponent(subscriptionId)}`;
  const { data, error } = await call(env, 'GET', q, null, fetcher);
  if (error) return { sub: null, error };
  return { sub: data, error: '' };
}

export const creemPort: MerchantPort = {
  id: 'creem',
  name: 'Creem',

  // ΠΩΛΗΣΗ ΘΕΛΕΙ ΚΛΕΙΔΙ ΚΑΙ ΧΑΡΤΗ. Χωρίς χάρτη προϊόντων το ταμείο δεν ξέρει
  // τι πουλά, οπότε δεν ανοίγει καθόλου.
  isLive: (env) => !!key(env) && productMap(env).map.size > 0,

  // ΟΜΙΛΙΑ ΘΕΛΕΙ ΜΟΝΟ ΚΛΕΙΔΙ. Η πύλη πελάτη και η ανάγνωση συνδρομής αφορούν
  // συνδρομές που ΥΠΑΡΧΟΥΝ ήδη: ενώνοντάς τα με το `isLive`, ένας υπάρχων
  // συνδρομητής θα έχανε τα παραστατικά του επειδή λείπει μεταβλητή πώλησης.
  canTalk: (env) => !!key(env),

  configError(env) {
    if (!key(env)) return `Λείπει η μεταβλητή: ${CREEM_KEY_ENV}.`;
    const { map, error } = productMap(env);
    if (error) return error;
    return map.size > 0 ? '' : `Λείπει η μεταβλητή: ${CREEM_PRODUCTS_ENV}.`;
  },

  async openCheckout(order: CheckoutOrder, env, fetcher): Promise<CheckoutResult> {
    const productId = productFor(env, order.plan, order.cycle);
    if (!productId) return { url: null, error: `κανένα προϊόν για «${order.plan}:${order.cycle}»` };
    const customer = order.buyer.email ? { email: order.buyer.email } : undefined;
    const { data, error } = await call(env, 'POST', '/v1/checkouts', {
      product_id: productId,
      success_url: order.redirectUrl,
      // ΤΟ «request_id» ΓΥΡΙΖΕΙ ΠΙΣΩ ΣΤΟ ΓΕΓΟΝΟΣ. Χρησιμεύει για να ενωθεί μια
      // πληρωμή με το πάτημα που την ξεκίνησε, όταν ψάχνουμε στα αρχεία.
      request_id: `${order.buyer.userId}:${order.plan}:${order.cycle}`,
      metadata: { user_id: order.buyer.userId },
      ...(customer ? { customer } : {}),
      ...(order.discountCode ? { discount_code: order.discountCode } : {}),
    }, fetcher);
    if (error) return { url: null, error };
    const url = str(data?.checkout_url);
    return url ? { url, error: '' } : { url: null, error: 'ο έμπορος δεν επέστρεψε διεύθυνση ταμείου' };
  },

  // ΔΥΟ ΚΛΗΣΕΙΣ, ΓΙΑΤΙ Η ΠΥΛΗ ΑΝΟΙΓΕΙ ΓΙΑ ΠΕΛΑΤΗ ΚΑΙ ΟΧΙ ΓΙΑ ΣΥΝΔΡΟΜΗ. Η
  // εφαρμογή κρατά το αναγνωριστικό ΣΥΝΔΡΟΜΗΣ, γιατί αυτό κρατούσε και ο
  // προηγούμενος έμπορος. Η πρώτη κλήση βρίσκει τον πελάτη της συνδρομής.
  async portalUrl(subscriptionId, env, fetcher): Promise<PortalResult> {
    const { sub, error } = await fetchSubscription(subscriptionId, env, fetcher);
    if (error) return { url: null, error };
    const customerId = idOf(sub?.customer);
    if (!customerId) return { url: null, error: 'η συνδρομή δεν έχει πελάτη' };
    const { data, error: e2 } = await call(env, 'POST', '/v1/customers/billing', { customer_id: customerId }, fetcher);
    if (e2) return { url: null, error: e2 };
    const url = str(data?.customer_portal_link);
    return url ? { url, error: '' } : { url: null, error: 'ο έμπορος δεν επέστρεψε διεύθυνση πύλης' };
  },

  async subscriptionState(subscriptionId, env, fetcher): Promise<ChangeResult> {
    const { sub, error } = await fetchSubscription(subscriptionId, env, fetcher);
    if (error) return { after: null, error };
    return { after: toState(sub), error: '' };
  },

  async changePlan(order: ChangeOrder, env, fetcher): Promise<ChangeResult> {
    const productId = productFor(env, order.plan, order.cycle);
    if (!productId) return { after: null, error: `κανένα προϊόν για «${order.plan}:${order.cycle}»` };
    // ΣΕ ΔΟΚΙΜΗ ΔΕΝ ΧΡΕΩΝΕΤΑΙ ΤΙΠΟΤΑ ΣΗΜΕΡΑ. Το «proration-none» αφήνει τη
    // δοκιμή να τρέξει ώς το τέλος της· χωρίς αυτό, μια αναβάθμιση μέσα στη
    // δοκιμή θα έβγαζε χρέωση την ίδια μέρα, δηλαδή θα τερμάτιζε τη δοκιμή που
    // ο ίδιος ο ιστότοπός μας υπόσχεται.
    const behavior = order.onTrial
      ? 'proration-none'
      : (order.kind === 'downgrade' ? 'proration-charge' : 'proration-charge-immediately');
    const { data, error } = await call(
      env, 'POST', `/v1/subscriptions/${encodeURIComponent(order.subscriptionId)}/upgrade`,
      { product_id: productId, update_behavior: behavior }, fetcher,
    );
    if (error) return { after: null, error };
    return { after: toState(data), error: '' };
  },

  async cancel(subscriptionId, env, fetcher): Promise<ChangeResult> {
    const { data, error } = await call(
      env, 'POST', `/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {}, fetcher,
    );
    if (error) return { after: null, error };
    return { after: toState(data), error: '' };
  },

  // ΤΙ ΘΕΛΕΙ ΑΚΥΡΩΣΗ ΟΤΑΝ ΔΙΑΓΡΑΦΕΤΑΙ ΛΟΓΑΡΙΑΣΜΟΣ. Οσο η συνδρομή μπορεί να
  // ξαναχρεώσει, πρέπει να σταματήσει. Η ήδη ακυρωμένη και η ληγμένη όχι:
  // δεύτερη ακύρωση επιστρέφει σφάλμα και θα μπλόκαρε τη διαγραφή.
  needsCancelling: (status) =>
    status === 'active' || status === 'on_trial' || status === 'past_due' || status === 'unpaid' || status === 'paused',

  planOf(state, env) {
    if (!state.variantId) return null;
    return planOfVariant(productMap(env).map, state.variantId);
  },

  isAt: (state, plan, cycle, env) =>
    !!state.variantId && state.variantId === productFor(env, plan, cycle),

  // ΣΥΓΚΡΙΣΗ ΣΤΑΘΕΡΟΥ ΧΡΟΝΟΥ. Μια σκέτη `===` σε συμβολοσειρές διαρρέει, μέσα
  // από τον χρόνο απάντησης, πόσοι χαρακτήρες της υπογραφής μαντεύτηκαν σωστά.
  verifyWebhook(rawBody, headers, env) {
    const secret = (env[CREEM_SECRET_ENV] || '').trim();
    const sent = (headers.get(SIGNATURE_HEADER) || '').trim();
    if (!secret || !sent) return false;
    const mine = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    const a = Buffer.from(mine, 'utf8');
    const b = Buffer.from(sent, 'utf8');
    // Το `timingSafeEqual` πετά όταν τα μήκη διαφέρουν· το μήκος δεν είναι
    // μυστικό, οπότε ο έλεγχος γίνεται πρώτος και ρητά.
    return a.length === b.length && timingSafeEqual(a, b);
  },

  readEvent(payload: unknown, env): ReadEvent {
    const p = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
    const name = String(p.eventType || '').trim();
    // ΜΟΝΟ ΤΑ ΓΕΓΟΝΟΤΑ ΣΥΝΔΡΟΜΗΣ ΜΑΣ ΑΦΟΡΟΥΝ. Παραγγελίες, παραστατικά και
    // ταμεία που ολοκληρώθηκαν παίρνουν 200: η συνδρομή έρχεται με δικό της
    // γεγονός αμέσως μετά· ένα 422 εδώ θα ζητούσε επανάληψη για πάντα.
    const ours = name.startsWith('subscription.');
    if (!ours) return { ok: false, reason: `γεγονός «${name || 'χωρίς όνομα'}» εκτός συνδρομών`, ours: false };

    const obj = (p.object && typeof p.object === 'object' ? p.object : null) as Record<string, unknown> | null;
    if (!obj) return { ok: false, reason: 'το γεγονός δεν κουβαλά αντικείμενο', ours: true };

    const id = idOf(obj.id);
    const status = readStatus(obj.status);
    const productId = idOf(obj.product);
    const customerId = idOf(obj.customer);
    if (!id) return { ok: false, reason: 'η συνδρομή δεν έχει αναγνωριστικό', ours: true };
    if (!status) return { ok: false, reason: `άγνωστη κατάσταση «${String(obj.status)}»`, ours: true };
    if (!productId) return { ok: false, reason: 'η συνδρομή δεν έχει προϊόν', ours: true };

    const { map, error } = productMap(env);
    if (map.size === 0) {
      // ΔΙΚΗ ΜΑΣ ΡΥΘΜΙΣΗ ΣΠΑΣΜΕΝΗ, ΟΧΙ ΓΕΓΟΝΟΣ. Το να ζητάς από τον έμπορο να
      // ξαναστείλει δεν διορθώνει μεταβλητή περιβάλλοντος.
      return {
        ok: false, ours: true, config: true,
        reason: error || `Ο χάρτης προϊόντων δεν έδωσε κανένα προϊόν. Ελεγξε τη μεταβλητή ${CREEM_PRODUCTS_ENV}.`,
      };
    }

    const meta = (obj.metadata && typeof obj.metadata === 'object' ? obj.metadata : {}) as Record<string, unknown>;
    const sub: MorSubscription = {
      id,
      status,
      variantId: productId,
      customerId,
      userId: str(meta.user_id),
      renewsAt: str(obj.current_period_end_date) ?? str(obj.next_transaction_date),
      // ΠΟΤΕ ΤΕΛΕΙΩΝΕΙ Η ΠΡΟΣΒΑΣΗ. Σε ακύρωση ο πάροχος κρατά την πληρωμένη
      // περίοδο: το τέλος είναι η λήξη της, όχι η στιγμή που πατήθηκε η
      // ακύρωση. Το `canceled_at` είναι η στιγμή του πατήματος και δεν κόβει
      // πρόσβαση που ο συνδρομητής έχει ήδη πληρώσει.
      endsAt: status === 'cancelled' ? (str(obj.current_period_end_date) ?? str(obj.canceled_at)) : null,
    };

    // ΠΟΤΕ ΣΥΝΕΒΗ, ΩΣΤΕ ΕΝΑ ΚΑΘΥΣΤΕΡΗΜΕΝΟ ΝΑ ΜΗ ΓΡΑΨΕΙ ΠΑΝΩ ΣΕ ΝΕΟΤΕΡΟ. Ο
    // φάκελος στέλνει χιλιοστά εποχής· η συνδρομή στέλνει ISO. Προτιμάται το
    // πρώτο, γιατί αφορά το ΓΕΓΟΝΟΣ και όχι το αντικείμενο.
    const created = typeof p.created_at === 'number' && isFinite(p.created_at)
      ? new Date(p.created_at).toISOString()
      : null;
    const occurredAt = created ?? str(obj.updated_at);

    return { ok: true, event: { name, sub, plan: planOfVariant(map, productId), occurredAt } };
  },
};
