// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΨΕΥΤΙΚΑ ΤΟΥ WEBHOOK, ΣΕ ΕΝΑ ΣΗΜΕΙΟ
// ─────────────────────────────────────────────────────────────────────────
// Δύο σουίτες στέλνουν αληθινά σώματα του Creem στο `applyMerchantEvent`: η
// «morWebhook.apply.test.ts» (η ροή μιας εγγραφής) και η
// «morWebhook.lifecycle.test.ts» (η μηχανή καταστάσεων: ανανέωση, αποτυχημένη
// πληρωμή, επιστροφή, αμφισβήτηση, σειρά άφιξης). Αν η ψεύτικη βάση ζούσε σε
// δύο αντίγραφα, θα απέκλιναν και η μία σουίτα θα δοκίμαζε κάτι που η άλλη
// δεν βλέπει.
//
// ΑΛΗΘΙΝΑ: το σχήμα του σώματος, η θύρα του εμπόρου, ο χάρτης προϊόντων, οι
// κανόνες πρόσβασης. ΨΕΥΤΙΚΑ μόνο όσα θα χτυπούσαν δίκτυο: η βάση (θυμάται
// κάθε ανάγνωση και κάθε εγγραφή) και ο αποστολέας ειδοποιήσεων.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import { applyMerchantEvent, type MerchantEventDeps } from './morWebhook';
import type { MerchantAlert } from './merchantAlert';

/** Ολόκληρος ο χάρτης: τέσσερα πακέτα σε δύο κύκλους. */
export const FULL = 'prod_a:solo:monthly,prod_b:solo:annual,prod_c:owner:monthly,prod_d:owner:annual,'
  + 'prod_e:agency:monthly,prod_f:agency:annual,prod_g:office:monthly,prod_h:office:annual';

export const ENV = {
  MERCHANT_PROVIDER: 'creem',
  CREEM_API_KEY: 'k',
  CREEM_PRODUCTS: FULL,
  CREEM_WEBHOOK_SECRET: 's',
};

export type Row = Record<string, unknown>;

export interface FakeDb {
  db: SupabaseClient;
  rows: Row[];
  upserts: { row: Row; opts: unknown }[];
  rpcs: { fn: string; args: Record<string, unknown> }[];
  reads: string[];
  /** Πόσες φορές ζητήθηκε πελάτης. Μηδέν σημαίνει «δεν άγγιξε τη βάση». */
  opened: number;
  /** Πόσες ανακλήσεις πρόσβασης έγιναν πράγματι. */
  revokes: number;
  factory: () => SupabaseClient;
}

/**
 * Μια βάση με έναν πίνακα, που απαντά στις αναγνώσεις από τις γραμμές της και
 * θυμάται κάθε εγγραφή. Τα `fail*` ρίχνουν σφάλμα στο αντίστοιχο σημείο.
 */
export function fakeDb(rows: Row[] = [], fail: { lookup?: boolean; upsert?: boolean; rpc?: boolean; revoke?: boolean } = {}): FakeDb {
  const state = { rows, upserts: [] as FakeDb['upserts'], rpcs: [] as FakeDb['rpcs'], reads: [] as string[], opened: 0, revokes: 0 };
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
  /**
   * Η `public.revoke_mor_access` της μετανάστευσης 20261112190000, με την ίδια
   * συνθήκη σε ΕΝΑ βήμα: συνδρομή, τελευταία πληρωμένη συναλλαγή, όχι ήδη
   * κλειστή, όχι η ίδια αναφορά. Η ίδια αναφορά δίνει `already_same_ref`,
   * άλλη αναφορά σε ήδη κλειστή δίνει `already`. Η πραγματική ελέγχεται στο db-replay
   * (scripts/db/billing-grace-probe.sql).
   */
  const revoke = async (a: Record<string, unknown>) => {
    if (fail.revoke) return { data: null, error: { message: 'δεν γράφτηκε' } };
    const row = state.rows.find(r => r.mor_subscription_id === a.p_subscription);
    if (!row) return { data: { outcome: 'unmatched' }, error: null };
    if (row.mor_revoked_ref === a.p_reference) return { data: { outcome: 'already_same_ref' }, error: null };
    if (row.mor_revoked_at) return { data: { outcome: 'already' }, error: null };
    if (!row.mor_last_transaction_id || row.mor_last_transaction_id !== a.p_transaction) return { data: { outcome: 'not_latest' }, error: null };
    Object.assign(row, {
      plan: 'free', subscription_status: 'expired', mor_renews_at: null, mor_ends_at: a.p_at,
      mor_past_due_at: null, hold_plan: null, hold_until: null,
      mor_revoked_at: a.p_at, mor_revoked_reason: a.p_reason, mor_revoked_ref: a.p_reference,
    });
    state.revokes++;
    return { data: { outcome: 'revoked', user_id: row.user_id }, error: null };
  };
  const db = {
    from,
    async rpc(fn: string, args: Record<string, unknown>) {
      state.rpcs.push({ fn, args });
      if (fn === 'revoke_mor_access') return revoke(args);
      return { error: fail.rpc ? { message: 'η μέτρηση απέτυχε' } : null };
    },
  } as unknown as SupabaseClient;
  return {
    db,
    get rows() { return state.rows; },
    get upserts() { return state.upserts; },
    get rpcs() { return state.rpcs; },
    get reads() { return state.reads; },
    get opened() { return state.opened; },
    get revokes() { return state.revokes; },
    factory: () => { state.opened++; return db; },
  };
}

/** Ενας αποστολέας ειδοποιήσεων που θυμάται τι του ζητήθηκε. */
export function fakeAlerts(result: boolean | 'throw' = true) {
  const sent: MerchantAlert[] = [];
  const sendAlert = async (a: MerchantAlert) => {
    sent.push(a);
    if (result === 'throw') throw new Error('το δίκτυο έπεσε');
    return result;
  };
  return { sent, sendAlert };
}

/** Η γραμμή ενός λογαριασμού που υπάρχει ήδη (τη γεννά η σκανδάλη της βάσης). */
export const profile = (over: Row = {}): Row => ({
  user_id: 'u1', plan: 'free', subscription_status: null, mor_subscription_id: null,
  mor_ends_at: null, mor_event_at: null, mor_past_due_at: null, mor_revoked_at: null,
  mor_revoked_reason: null, mor_revoked_ref: null, mor_last_transaction_id: null,
  trial_used_at: null, profile_type: null, ...over,
});

/** Ενα γεγονός συνδρομής στο σχήμα που στέλνει όντως ο πάροχος. */
export function subEvent(
  over: Record<string, unknown>, name: string, createdAt: number, periodEnd: string,
): string {
  return JSON.stringify({
    id: 'evt_1',
    eventType: name,
    created_at: createdAt,
    object: {
      id: 'sub_1',
      object: 'subscription',
      product: { id: 'prod_a', name: 'Solo' },
      customer: { id: 'cust_1', email: 'a@b.gr' },
      status: 'active',
      current_period_end_date: periodEnd,
      updated_at: '2026-09-27T10:00:00.000Z',
      metadata: { user_id: 'u1' },
      ...over,
    },
  });
}

/**
 * Επιστροφή χρημάτων ή αμφισβήτηση, στο σχήμα της τεκμηρίωσης του Creem: η
 * συνδρομή έρχεται ολόκληρη ως αντικείμενο και η συναλλαγή δίπλα της.
 */
export function moneyEvent(
  kind: 'refund' | 'dispute', createdAt: number,
  over: {
    subscription?: unknown; refund?: number | null; paid?: number | null; net?: number; id?: string;
    transaction?: string; currency?: string;
  } = {},
): string {
  const paid = over.paid === undefined ? 499 : over.paid;
  // ΚΑΘΑΡΟ ΚΑΙ ΜΙΚΤΟ: το `amount` της συναλλαγής είναι πριν από φόρο και
  // έκπτωση, το `amount_paid` όσα πλήρωσε ο πελάτης.
  const net = over.net ?? 419;
  const subscription = 'subscription' in over ? over.subscription : { id: 'sub_1', object: 'subscription', metadata: { user_id: 'u1' } };
  const tx = { id: over.transaction ?? 'tran_1', amount: net, ...(paid === null ? {} : { amount_paid: paid }), tax_amount: 80, currency: 'EUR' };
  const amount = over.refund === undefined ? paid : over.refund;
  const object = kind === 'refund'
    ? { id: over.id ?? 'ref_1', object: 'refund', status: 'succeeded',
        ...(amount === null ? {} : { refund_amount: amount }), refund_currency: over.currency ?? 'EUR',
        transaction: tx, subscription, customer: { id: 'cust_1', email: 'a@b.gr' }, created_at: createdAt }
    : { id: over.id ?? 'disp_1', object: 'dispute', ...(amount === null ? {} : { amount }), currency: over.currency ?? 'EUR',
        transaction: tx, subscription, customer: { id: 'cust_1', email: 'a@b.gr' }, created_at: createdAt };
  return JSON.stringify({ id: `evt_${kind}`, eventType: `${kind}.created`, created_at: createdAt, object });
}

/** Μία κλήση του webhook, με τα ψεύτικα στη θέση του δικτύου. */
export async function runWebhook(
  raw: string, db: FakeDb, alerts: ReturnType<typeof fakeAlerts>, now: string, extra: MerchantEventDeps = {},
) {
  const res = await applyMerchantEvent(raw, {
    env: ENV, db: db.factory, sendAlert: alerts.sendAlert, now: () => now, ...extra,
  });
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}
