// npx tsx lib/billing/morWebhook.apply.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Ο WEBHOOK ΟΛΟΚΛΗΡΟΣ, ΑΠΟ ΤΟ ΣΩΜΑ ΩΣ ΤΗ ΓΡΑΜΜΗ ΤΗΣ ΒΑΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΔΕΝ ΑΡΚΟΥΣΑΝ ΟΙ ΚΑΘΑΡΕΣ ΣΥΝΑΡΤΗΣΕΙΣ. Η σουίτα «morWebhook.test.ts»
// δοκιμάζει τις τρεις κρίσεις που βγήκαν από τη ροή (σειρά, σφραγίδα δοκιμής,
// τύπος προφίλ). Η ίδια η ροή, δηλαδή ΤΙ γράφεται στη βάση και ΤΙ απαντά ο
// webhook στον έμπορο, δεν ελεγχόταν πουθενά: ένα λάθος πεδίο στο `upsert` ή
// ένας κλάδος που γυρίζει 200 αντί για 422 θα φαινόταν μόνο σε πελάτη που
// πλήρωσε και δεν πήρε πακέτο.
//
// ΤΙ ΕΙΝΑΙ ΑΛΗΘΙΝΟ ΚΑΙ ΤΙ ΨΕΥΤΙΚΟ. Αληθινά: το σώμα στο σχήμα που στέλνει ο
// Creem (όπως στο merchant/creem.test.ts), η θύρα του εμπόρου, ο χάρτης
// προϊόντων, οι κανόνες πρόσβασης. Ψεύτικα μόνο όσα θα χτυπούσαν δίκτυο: η
// βάση (που θυμάται κάθε ανάγνωση και κάθε εγγραφή) και ο αποστολέας των
// ειδοποιήσεων. Η ώρα δίνεται σταθερή, ώστε το «ισχύει ακόμη» να μην
// εξαρτάται από τη μέρα που τρέχει η σουίτα.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import { applyMerchantEvent, type MerchantEventDeps } from './morWebhook';
import type { MerchantAlert } from './merchantAlert';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

// ΤΑ ΑΡΧΕΙΑ ΚΑΤΑΓΡΑΦΗΣ ΤΟΥ WEBHOOK ΣΙΩΠΟΥΝ ΕΔΩ, αλλά κρατιούνται: μερικοί
// έλεγχοι ρωτούν τι ΓΡΑΦΤΗΚΕ, γιατί το αρχείο είναι ο μόνος μάρτυρας μιας
// απόφασης που δεν αφήνει ίχνος στη βάση.
const logged: string[] = [];
console.info = (...parts: unknown[]) => { logged.push(parts.map(String).join(' ')); };

// ── Η ΡΥΘΜΙΣΗ: ΟΛΟΚΛΗΡΟΣ Ο ΧΑΡΤΗΣ, ΤΕΣΣΕΡΑ ΠΑΚΕΤΑ ΣΕ ΔΥΟ ΚΥΚΛΟΥΣ ────────
const FULL = 'prod_a:solo:monthly,prod_b:solo:annual,prod_c:owner:monthly,prod_d:owner:annual,'
  + 'prod_e:agency:monthly,prod_f:agency:annual,prod_g:office:monthly,prod_h:office:annual';
const ENV = {
  MERCHANT_PROVIDER: 'creem',
  CREEM_API_KEY: 'k',
  CREEM_PRODUCTS: FULL,
  CREEM_WEBHOOK_SECRET: 's',
};

const NOW = '2026-09-27T12:00:00.000Z';
const FUTURE = '2026-11-01T00:00:00.000Z';
const PAST = '2026-09-01T00:00:00.000Z';
/** Η ώρα του φακέλου, σε χιλιοστά εποχής, όπως τη στέλνει ο πάροχος. */
const AT = Date.parse('2026-09-27T11:00:00.000Z');
const AT_ISO = new Date(AT).toISOString();

/** Ενα γεγονός στο σχήμα που στέλνει όντως ο πάροχος. */
const event = (over: Record<string, unknown> = {}, name = 'subscription.active', createdAt: number = AT) => JSON.stringify({
  id: 'evt_1',
  eventType: name,
  created_at: createdAt,
  object: {
    id: 'sub_1',
    object: 'subscription',
    product: { id: 'prod_a', name: 'Solo' },
    customer: { id: 'cust_1', email: 'a@b.gr' },
    status: 'active',
    current_period_end_date: FUTURE,
    updated_at: '2026-09-27T10:00:00.000Z',
    metadata: { user_id: 'u1' },
    ...over,
  },
});

// ── Η ΨΕΥΤΙΚΗ ΒΑΣΗ ────────────────────────────────────────────────────────
type Row = Record<string, unknown>;
interface FakeDb {
  db: SupabaseClient;
  rows: Row[];
  upserts: { row: Row; opts: unknown }[];
  rpcs: { fn: string; args: Record<string, unknown> }[];
  reads: string[];
  /** Πόσες φορές ζητήθηκε πελάτης. Μηδέν σημαίνει «δεν άγγιξε τη βάση». */
  opened: number;
}

/**
 * Μια βάση με μία πίνακα, που απαντά στις αναγνώσεις από τις γραμμές της και
 * θυμάται κάθε εγγραφή. Τα `fail*` ρίχνουν σφάλμα στο αντίστοιχο σημείο.
 */
function fakeDb(rows: Row[] = [], fail: { lookup?: boolean; upsert?: boolean; rpc?: boolean } = {}): FakeDb & { factory: () => SupabaseClient } {
  const state: FakeDb = { db: null as unknown as SupabaseClient, rows, upserts: [], rpcs: [], reads: [], opened: 0 };
  const from = (table: string) => ({
    select(cols: string) {
      return {
        eq(col: string, val: unknown) {
          return {
            async maybeSingle() {
              state.reads.push(`${table}:${cols}:${col}=${String(val)}`);
              if (fail.lookup && col === 'mor_subscription_id') return { data: null, error: { message: 'κάτω' } };
              const hit = state.rows.find(r => r[col] === val) ?? null;
              if (!hit) return { data: null, error: null };
              const picked: Row = {};
              for (const c of cols.split(',').map(s => s.trim())) picked[c] = hit[c] ?? null;
              return { data: picked, error: null };
            },
          };
        },
      };
    },
    async upsert(row: Row, opts: unknown) {
      state.upserts.push({ row, opts });
      if (fail.upsert) return { error: { message: 'δεν γράφτηκε' } };
      const at = state.rows.findIndex(r => r.user_id === row.user_id);
      if (at >= 0) state.rows[at] = { ...state.rows[at], ...row }; else state.rows.push({ ...row });
      return { error: null };
    },
  });
  state.db = {
    from,
    async rpc(fn: string, args: Record<string, unknown>) {
      state.rpcs.push({ fn, args });
      return { error: fail.rpc ? { message: 'η μέτρηση απέτυχε' } : null };
    },
  } as unknown as SupabaseClient;
  return { ...state, get rows() { return state.rows; }, get upserts() { return state.upserts; },
    get rpcs() { return state.rpcs; }, get reads() { return state.reads; }, get opened() { return state.opened; },
    factory: () => { state.opened++; return state.db; } };
}

/** Ενας αποστολέας ειδοποιήσεων που θυμάται τι του ζητήθηκε. */
function fakeAlerts(result: boolean | 'throw' = true) {
  const sent: MerchantAlert[] = [];
  const sendAlert = async (a: MerchantAlert) => {
    sent.push(a);
    if (result === 'throw') throw new Error('το δίκτυο έπεσε');
    return result;
  };
  return { sent, sendAlert };
}

/** Μία κλήση του webhook, με τα ψεύτικα στη θέση του δικτύου. */
async function run(raw: string, db: ReturnType<typeof fakeDb>, alerts = fakeAlerts(), extra: MerchantEventDeps = {}) {
  const res = await applyMerchantEvent(raw, {
    env: ENV, db: db.factory, sendAlert: alerts.sendAlert, now: () => NOW, ...extra,
  });
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}

/** Η γραμμή ενός λογαριασμού που υπάρχει ήδη (τη γεννά η σκανδάλη της βάσης). */
const profile = (over: Row = {}): Row => ({
  user_id: 'u1', plan: 'free', subscription_status: null, mor_subscription_id: null,
  mor_ends_at: null, mor_event_at: null, trial_used_at: null, profile_type: null, ...over,
});

async function main() {
  // ── 1. ΕΝΕΡΓΗ ΣΥΝΔΡΟΜΗ: ΤΟ ΠΑΚΕΤΟ ΚΑΙ ΤΑ mor_* ΓΡΑΦΟΝΤΑΙ ─────────────────
  {
    const db = fakeDb([profile()]);
    const r = await run(event(), db);
    ok('ενεργή: απαντά 200 ok', r.status === 200 && r.body.ok === true);
    ok('ενεργή: ΜΙΑ εγγραφή', db.upserts.length === 1);
    const w = db.upserts[0]?.row ?? {};
    ok('το πακέτο βγαίνει από το προϊόν', w.plan === 'solo' && w.billing_cycle === 'monthly');
    ok('η κατάσταση γράφεται στη γλώσσα μας', w.subscription_status === 'active');
    ok('ο λογαριασμός από το metadata', w.user_id === 'u1');
    ok('η συνδρομή, ο πελάτης και το προϊόν του εμπόρου',
       w.mor_subscription_id === 'sub_1' && w.mor_customer_id === 'cust_1' && w.mor_variant_id === 'prod_a');
    ok('η ανανέωση από το τέλος της περιόδου', w.mor_renews_at === FUTURE);
    ok('η ενεργή δεν έχει λήξη', w.mor_ends_at === null);
    ok('η ώρα του γεγονότος από τον φάκελο', w.mor_event_at === AT_ISO);
    // ΧΩΡΙΣ ΑΥΤΟ Η ΕΓΓΡΑΦΗ ΘΑ ΗΤΑΝ ΕΝΗΜΕΡΩΣΗ ΠΟΥ ΜΠΟΡΕΙ ΝΑ ΑΓΓΙΞΕΙ ΜΗΔΕΝ ΓΡΑΜΜΕΣ.
    ok('upsert πάνω στον λογαριασμό', JSON.stringify(db.upserts[0]?.opts) === JSON.stringify({ onConflict: 'user_id' }));
    ok('ο τύπος προφίλ συμπληρώνεται από την αγορά', w.profile_type === 'individual');
    ok('καμία σφραγίδα δοκιμής σε πληρωμένη', !('trial_used_at' in w));
    ok('η μέτρηση λέει «ξεκίνησε συνδρομή»',
       db.rpcs.length === 1 && db.rpcs[0].fn === 'log_event_for' && db.rpcs[0].args.p_event === 'subscription_started');
  }

  // Η ΔΗΛΩΣΗ ΤΟΥ ΧΡΗΣΤΗ ΔΕΝ ΞΑΝΑΓΡΑΦΕΤΑΙ.
  {
    const db = fakeDb([profile({ profile_type: 'professional' })]);
    await run(event(), db);
    ok('δηλωμένος τύπος προφίλ δεν πατιέται', !('profile_type' in (db.upserts[0]?.row ?? {})));
  }

  // Η ΔΟΚΙΜΗ ΤΟΥ ΕΜΠΟΡΟΥ ΣΦΡΑΓΙΖΕΤΑΙ ΜΕ ΤΗΝ ΩΡΑ ΤΟΥ ΓΕΓΟΝΟΤΟΣ.
  {
    const db = fakeDb([profile()]);
    await run(event({ status: 'trialing' }), db);
    const w = db.upserts[0]?.row ?? {};
    ok('σε δοκιμή: πρόσβαση στο πακέτο', w.plan === 'solo' && w.subscription_status === 'on_trial');
    ok('σε δοκιμή: η σφραγίδα γράφεται', w.trial_used_at === AT_ISO);
    // Με κανονική έκφραση και όχι με το όνομα αυτούσιο: το ίδιο γεγονός στέλνει
    // και επιστολή και ο κατάλογος μηνυμάτων θα απαριθμούσε τη σουίτα ως πηγή.
    ok('σε δοκιμή: η μέτρηση λέει «ξεκίνησε δοκιμή»', /^trial_start/.test(String(db.rpcs[0]?.args.p_event)));
  }

  // ── 2. ΑΚΥΡΩΣΗ ΜΕ ΠΕΡΙΟΔΟ ΠΟΥ ΤΡΕΧΕΙ: ΤΟ ΠΑΚΕΤΟ ΜΕΝΕΙ ─────────────────────
  // Το χειρότερο λάθος ενός συστήματος χρέωσης: να κόψει μήνα πληρωμένο.
  for (const status of ['scheduled_cancel', 'canceled']) {
    const db = fakeDb([profile({ mor_subscription_id: 'sub_1', subscription_status: 'active' })]);
    const r = await run(event({ status, product: { id: 'prod_d' }, canceled_at: '2026-09-27T10:59:00.000Z' }, 'subscription.canceled'), db);
    const w = db.upserts[0]?.row ?? {};
    ok(`${status}: απαντά 200`, r.status === 200 && r.body.ok === true);
    ok(`${status}: το πακέτο μένει ώς το τέλος της περιόδου`, w.plan === 'owner' && w.billing_cycle === 'annual');
    ok(`${status}: η κατάσταση είναι «ακυρωμένη»`, w.subscription_status === 'cancelled');
    ok(`${status}: η λήξη είναι το τέλος της περιόδου, όχι το πάτημα`, w.mor_ends_at === FUTURE);
  }
  // ΚΑΙ ΟΤΑΝ Η ΠΕΡΙΟΔΟΣ ΤΕΛΕΙΩΣΕ, ΤΕΛΕΙΩΝΕΙ ΚΑΙ ΤΟ ΠΑΚΕΤΟ.
  {
    const db = fakeDb([profile({ mor_subscription_id: 'sub_1', subscription_status: 'cancelled' })]);
    await run(event({ status: 'canceled', current_period_end_date: PAST }, 'subscription.expired'), db);
    const w = db.upserts[0]?.row ?? {};
    ok('ληγμένη περίοδος: πίσω στο δωρεάν', w.plan === 'free' && w.mor_ends_at === PAST);
    ok('χωρίς πρόσβαση, καμία μέτρηση «ξεκίνησε»', db.rpcs.length === 0);
  }

  // ── 3. ΤΟ ΚΑΘΥΣΤΕΡΗΜΕΝΟ ΔΕΝ ΓΡΑΦΕΙ ΠΑΝΩ ΑΠΟ ΤΟ ΝΕΟΤΕΡΟ ───────────────────
  {
    const later = new Date(AT + 60_000).toISOString();
    const db = fakeDb([profile({ plan: 'solo', mor_subscription_id: 'sub_1', subscription_status: 'active', mor_event_at: later })]);
    const r = await run(event({ status: 'canceled', current_period_end_date: PAST }, 'subscription.canceled'), db);
    ok('παλαιότερο γεγονός: 200 με «stale»', r.status === 200 && r.body.skipped === 'stale');
    ok('παλαιότερο γεγονός: καμία εγγραφή', db.upserts.length === 0);
    ok('και το πακέτο μένει όπως ήταν', db.rows[0].plan === 'solo');
  }
  {
    const earlier = new Date(AT - 60_000).toISOString();
    const db = fakeDb([profile({ mor_subscription_id: 'sub_1', subscription_status: 'active', mor_event_at: earlier })]);
    await run(event(), db);
    ok('νεότερο γεγονός εφαρμόζεται', db.upserts.length === 1);
  }

  // ── 4. ΞΕΝΗ ΣΥΝΔΡΟΜΗ ΔΕΝ ΓΡΑΦΕΙ ΠΑΝΩ ΣΕ ΖΩΝΤΑΝΗ ──────────────────────────
  // Η επιστροφή χρημάτων μιας ΠΑΛΙΑΣ συνδρομής δεν κατεβάζει στο δωρεάν
  // λογαριασμό που πληρώνει ήδη μια καινούργια.
  {
    const db = fakeDb([profile({ plan: 'agency', mor_subscription_id: 'sub_live', subscription_status: 'active' })]);
    const alerts = fakeAlerts();
    const r = await run(event({ id: 'sub_old', status: 'canceled', current_period_end_date: PAST }, 'subscription.canceled'), db, alerts);
    ok('ξένη, χωρίς πρόσβαση: 200 με «other_subscription»', r.status === 200 && r.body.skipped === 'other_subscription');
    ok('ξένη, χωρίς πρόσβαση: καμία εγγραφή', db.upserts.length === 0);
    ok('ο λογαριασμός κρατά τη ζωντανή', db.rows[0].mor_subscription_id === 'sub_live' && db.rows[0].plan === 'agency');
    ok('καμία ειδοποίηση διπλής συνδρομής', alerts.sent.length === 0);
  }
  // Η ΚΑΤΑΓΕΓΡΑΜΜΕΝΗ ΠΟΥ ΕΧΕΙ ΗΔΗ ΛΗΞΕΙ ΔΕΝ ΜΠΛΟΚΑΡΕΙ ΤΙΠΟΤΑ.
  {
    const db = fakeDb([profile({ mor_subscription_id: 'sub_old', subscription_status: 'cancelled', mor_ends_at: PAST })]);
    const alerts = fakeAlerts();
    const r = await run(event({ id: 'sub_new' }), db, alerts);
    ok('νέα αγορά μετά από λήξη: γράφεται', r.status === 200 && db.upserts[0]?.row.mor_subscription_id === 'sub_new');
    ok('και δεν ειδοποιεί για διπλή χρέωση', alerts.sent.length === 0);
  }

  // ── 5. ΔΥΟ ΖΩΝΤΑΝΕΣ ΣΥΝΔΡΟΜΕΣ: ΓΡΑΦΕΤΑΙ Η ΝΕΑ ΚΑΙ ΦΤΑΝΕΙ ΣΕ ΑΝΘΡΩΠΟ ─────
  {
    const db = fakeDb([profile({ plan: 'solo', mor_subscription_id: 'sub_old', subscription_status: 'active' })]);
    const alerts = fakeAlerts();
    const r = await run(event({ id: 'sub_new', product: { id: 'prod_e' } }), db, alerts);
    ok('διπλή: η νέα γράφεται', r.status === 200 && db.upserts[0]?.row.mor_subscription_id === 'sub_new'
       && db.upserts[0]?.row.plan === 'agency');
    ok('διπλή: ΜΙΑ ειδοποίηση', alerts.sent.length === 1);
    const a = alerts.sent[0];
    ok('το θέμα λέει τι να ελεγχθεί', !!a && a.subject.includes('διπλή χρέωση'));
    ok('το σώμα ονομάζει και τις δύο συνδρομές και τον λογαριασμό',
       !!a && a.text.includes('sub_old') && a.text.includes('sub_new') && a.text.includes('u1'));
    ok('κανένα email πελάτη στο μήνυμα', !!a && !a.text.includes('a@b.gr') && !a.subject.includes('a@b.gr'));
    ok('και το αρχείο καταγραφής το λέει', logged.some(l => l.includes('ΔΥΟ ΖΩΝΤΑΝΕΣ ΣΥΝΔΡΟΜΕΣ') && l.includes('sub_old')));
  }
  // Η ΑΠΟΤΥΧΙΑ ΤΗΣ ΕΙΔΟΠΟΙΗΣΗΣ ΔΕΝ ΡΙΧΝΕΙ ΤΗΝ ΠΛΗΡΩΜΗ. Ενα σφάλμα εδώ θα
  // γύριζε 5xx στον έμπορο, που θα ξανάστελνε ΟΛΟ το γεγονός.
  for (const result of [false, 'throw'] as const) {
    const db = fakeDb([profile({ mor_subscription_id: 'sub_old', subscription_status: 'active' })]);
    const alerts = fakeAlerts(result);
    const r = await run(event({ id: 'sub_new' }), db, alerts);
    ok(`ειδοποίηση που ${result === 'throw' ? 'πετά' : 'αποτυγχάνει'}: 200 ok`, r.status === 200 && r.body.ok === true);
    ok(`ειδοποίηση που ${result === 'throw' ? 'πετά' : 'αποτυγχάνει'}: η εγγραφή έγινε`, db.upserts.length === 1);
  }
  // ΑΝ Η ΕΓΓΡΑΦΗ ΑΠΟΤΥΧΕΙ, Η ΕΙΔΟΠΟΙΗΣΗ ΠΕΡΙΜΕΝΕΙ ΤΗΝ ΕΠΑΝΑΛΗΨΗ. Ο έμπορος
  // ξαναστέλνει το γεγονός· μία ειδοποίηση ανά επιτυχημένη εγγραφή, όχι ανά
  // προσπάθεια.
  {
    const db = fakeDb([profile({ mor_subscription_id: 'sub_old', subscription_status: 'active' })], { upsert: true });
    const alerts = fakeAlerts();
    const r = await run(event({ id: 'sub_new' }), db, alerts);
    ok('εγγραφή που απέτυχε: 502 write_failed', r.status === 502 && r.body.error === 'write_failed');
    ok('εγγραφή που απέτυχε: καμία ειδοποίηση ακόμη', alerts.sent.length === 0);
  }

  // ── 6. ΠΡΟΪΟΝ ΕΚΤΟΣ ΧΑΡΤΗ: 422, ΚΑΙ Η ΒΑΣΗ ΔΕΝ ΑΓΓΙΖΕΤΑΙ ──────────────────
  {
    const db = fakeDb([profile()]);
    const r = await run(event({ product: { id: 'prod_zzz' } }), db);
    ok('άγνωστο προϊόν: 422 unknown_variant', r.status === 422 && r.body.error === 'unknown_variant');
    ok('άγνωστο προϊόν: ούτε πελάτης βάσης δεν ζητήθηκε', db.opened === 0 && db.upserts.length === 0);
  }

  // ── 7. ΧΩΡΙΣ user_id: Ο ΛΟΓΑΡΙΑΣΜΟΣ ΑΠΟ ΤΗ ΣΥΝΔΡΟΜΗ, ΠΟΤΕ ΑΠΟ ΤΟ EMAIL ───
  {
    const db = fakeDb([profile({ user_id: 'u7', mor_subscription_id: 'sub_1', subscription_status: 'active' })]);
    const r = await run(event({ metadata: {} }, 'subscription.update'), db);
    ok('χωρίς user_id: βρίσκεται από τη συνδρομή', r.status === 200 && db.upserts[0]?.row.user_id === 'u7');
    ok('η αναζήτηση έγινε με το αναγνωριστικό συνδρομής',
       db.reads.some(x => x.includes('mor_subscription_id=sub_1')));
  }
  {
    const db = fakeDb([profile({ user_id: 'u7', mor_subscription_id: 'sub_other' })]);
    const alerts = fakeAlerts();
    const r = await run(event({ metadata: {} }), db, alerts);
    ok('χωρίς user_id και χωρίς καταγεγραμμένη συνδρομή: 422 no_account',
       r.status === 422 && r.body.error === 'no_account');
    ok('και καμία εγγραφή σε ξένο λογαριασμό', db.upserts.length === 0);
    ok('πληρωμή χωρίς λογαριασμό: ειδοποίηση στην υποστήριξη', alerts.sent.length === 1
       && /χωρίς λογαριασμό/.test(alerts.sent[0].subject) && alerts.sent[0].text.includes('sub_1'));
  }
  {
    const db = fakeDb([], { lookup: true });
    const r = await run(event({ metadata: {} }), db);
    ok('η αναζήτηση που απέτυχε ζητά επανάληψη: 502', r.status === 502 && r.body.error === 'lookup_failed');
  }

  // ── 8. ΕΠΙΣΤΡΟΦΗ ΧΡΗΜΑΤΩΝ: ΕΙΔΟΠΟΙΗΣΗ, ΟΧΙ ΑΛΛΑΓΗ ΠΡΟΣΒΑΣΗΣ ──────────────
  {
    const db = fakeDb([profile({ plan: 'solo', mor_subscription_id: 'sub_9', subscription_status: 'active' })]);
    const alerts = fakeAlerts();
    const raw = JSON.stringify({
      id: 'evt_r', eventType: 'refund.created', created_at: AT,
      object: { id: 'ref_1', refund_amount: 499, refund_currency: 'eur', subscription: { id: 'sub_9' }, customer: { email: 'a@b.gr' } },
    });
    const r = await run(raw, db, alerts);
    ok('επιστροφή: 200 ok με «alerted»', r.status === 200 && r.body.ok === true && r.body.alerted === true);
    ok('επιστροφή: μία ειδοποίηση για τη συνδρομή', alerts.sent.length === 1 && alerts.sent[0].text.includes('sub_9'));
    ok('επιστροφή: η βάση δεν αγγίζεται', db.opened === 0 && db.upserts.length === 0 && db.rows[0].plan === 'solo');
    const failing = fakeAlerts(false);
    const r2 = await run(raw, fakeDb(), failing);
    ok('επιστροφή χωρίς αποστολή: πάλι 200, με alerted false', r2.status === 200 && r2.body.alerted === false);
  }

  // ── 9. Ο,ΤΙ ΔΕΝ ΕΙΝΑΙ ΣΥΝΔΡΟΜΗ, Ο,ΤΙ ΔΕΝ ΔΙΑΒΑΖΕΤΑΙ, Ο,ΤΙ ΕΙΝΑΙ ΔΙΚΗ ΜΑΣ ΒΛΑΒΗ
  {
    const db = fakeDb();
    const bad = await run('{όχι json', db);
    ok('σώμα που δεν είναι JSON: 400', bad.status === 400 && bad.body.error === 'bad_request');
    const other = await run(JSON.stringify({ eventType: 'checkout.completed', object: {} }), db);
    ok('ταμείο που ολοκληρώθηκε: 200, δεν ζητά επανάληψη', other.status === 200);
    const broken = await run(event({ status: 'ουφ' }), db);
    ok('συνδρομή σε άγνωστη κατάσταση: 422 ώστε να ξαναέρθει', broken.status === 422);
    const config = await run(event(), db, fakeAlerts(), { env: { ...ENV, CREEM_PRODUCTS: '' } });
    ok('χάρτης κενός: 500 not_configured, όχι 422', config.status === 500 && config.body.error === 'not_configured');
    ok('κανένα από αυτά δεν άγγιξε τη βάση', db.opened === 0);
  }
  {
    const r = await run(event(), fakeDb(), fakeAlerts(), { db: () => { throw new Error('λείπει το κλειδί υπηρεσίας'); } });
    ok('πελάτης υπηρεσίας που δεν φτιάχνεται: 500 not_configured', r.status === 500 && r.body.error === 'not_configured');
  }
  // Η ΜΕΤΡΗΣΗ ΔΕΝ ΜΠΛΟΚΑΡΕΙ ΤΗΝ ΠΛΗΡΩΜΗ.
  {
    const db = fakeDb([profile()], { rpc: true });
    const r = await run(event(), db);
    ok('μέτρηση που απέτυχε: 200 ok, το πακέτο γράφτηκε', r.status === 200 && db.upserts.length === 1);
  }
}

main().then(() => {
  console.log(fail === 0 ? `✓ morWebhook (ροή): ${pass} έλεγχοι πέρασαν` : `✗ morWebhook (ροή): ${fail} απέτυχαν από ${pass + fail}`);
  if (fail > 0) process.exit(1);
});
