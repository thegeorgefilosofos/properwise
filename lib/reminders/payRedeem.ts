// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΞΑΡΓΥΡΩΣΗ ΤΟΥ «ΠΛΗΡΩΣΑ» ΚΑΙ Η ΑΝΑΙΡΕΣΗ ΤΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Τρέχει ΜΟΝΟ στον διακομιστή, με τον service role: το διακριτικό είναι το
// κλειδί, όχι η συνεδρία. Γι' αυτό κάθε έλεγχος που θα έκανε η RLS γίνεται εδώ
// ρητά:
//
//   1. Το διακριτικό ταιριάζει, δεν έληξε, δεν χρησιμοποιήθηκε: ΕΝΑ ατομικό
//      UPDATE … WHERE used_at IS NULL AND expires_at > now() RETURNING. Δεύτερο
//      πάτημα (ή επανάληψη ληφθέντος αιτήματος) δεν επιστρέφει γραμμή.
//   2. Το γεγονός ανήκει στον χρήστη του διακριτικού (IDOR): `user_id` μέσα
//      στο ερώτημα και στην ενημέρωση (lib/data/calendar.ts).
//   3. Η δαπάνη γράφεται ΜΟΝΟ όταν το ζητήσει ο χρήστης (`withExpense`, από
//      τη σελίδα επιβεβαίωσης), με `dedup_hash`, οπότε δεν διπλασιάζεται ποτέ·
//      η αναίρεση σβήνει ΜΟΝΟ αυτήν, με το ίδιο αποτύπωμα.
//
// Κάθε ανάγνωση κοιτά το `error`: μια πεσμένη σύνδεση δεν διαβάζεται ποτέ ως
// «άκυρος σύνδεσμος».
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import { expenseForPaidEvent, hashPayToken, isPayTokenShape, canUndo, payDedupHash, type PaidEvent } from './payLink';
import * as expenses from '@/lib/data/expenses';
import { duplicateWindow, hasMatchingInstalment } from './payDuplicate';
import * as calendar from '@/lib/data/calendar';

export type PayOutcome =
  | { ok: true; kind: 'paid' | 'undone'; title: string; amount: number | null; expense: boolean }
  | { ok: false; kind: 'invalid' | 'used' | 'expired' | 'not_undoable' | 'error' };

export type PayPeek =
  | {
    ok: true; title: string; amount: number | null; used: boolean; undoable: boolean;
    /** Η δόση μπορεί να γραφτεί και ως έξοδο. */
    expenseEligible: boolean;
    /** Υπάρχει ήδη έξοδο για αυτή τη δόση (lib/reminders/payDuplicate.ts). */
    expenseDuplicate: boolean;
    /** Τσεκαρισμένο από προεπιλογή: μόνο όταν ξέρουμε ότι ΔΕΝ υπάρχει ήδη. */
    expenseDefault: boolean;
  }
  | { ok: false; kind: 'invalid' | 'expired' | 'error' };

interface TokenRow { id: string; user_id: string; event_id: string; used_at: string | null; undone_at: string | null; expires_at: string }
type EventRow = PaidEvent & { user_id: string; status: string | null; event_date: string };

const TOKENS = 'reminder_pay_tokens';
const TOKEN_COLS = 'id,user_id,event_id,used_at,undone_at,expires_at';
const EVENT_COLS = 'id,user_id,title,amount,source,property_id,status,event_date';

async function tokenByHash(db: SupabaseClient, hash: string): Promise<{ t: TokenRow | null; failed: boolean }> {
  const { data, error } = await db.from(TOKENS).select(TOKEN_COLS).eq('token_hash', hash).maybeSingle<TokenRow>();
  return { t: data ?? null, failed: !!error };
}

/** Τι λέει ένα διακριτικό χωρίς να το εξαργυρώσει: για τη σελίδα επιβεβαίωσης. */
export async function peekPayToken(db: SupabaseClient, token: string, now: Date): Promise<PayPeek> {
  if (!isPayTokenShape(token)) return { ok: false, kind: 'invalid' };
  const { t, failed } = await tokenByHash(db, await hashPayToken(token));
  if (failed) return { ok: false, kind: 'error' };
  if (!t) return { ok: false, kind: 'invalid' };
  if (!t.used_at && new Date(t.expires_at) <= now) return { ok: false, kind: 'expired' };
  const { row: e, error } = await calendar.ofUserById<EventRow>(db, t.user_id, t.event_id, EVENT_COLS);
  if (error) return { ok: false, kind: 'error' };
  if (!e) return { ok: false, kind: 'invalid' };
  const x = expenseForPaidEvent(e);
  // Χωρίς ημερομηνία ο έλεγχος δεν γίνεται: άγνωστο, άρα ξετσεκαρισμένο.
  const dup = !x || !e.property_id ? false
    : e.event_date ? await duplicateExpense(db, t.user_id, e.property_id, x.amount, e.event_date) : null;
  return {
    ok: true, title: e.title, amount: e.amount, used: !!t.used_at && !t.undone_at,
    undoable: canUndo(t.used_at, t.undone_at, now), expenseEligible: !!x,
    expenseDuplicate: dup === true,
    // Αγνωστο (η ανάγνωση απέτυχε) σημαίνει ΞΕΤΣΕΚΑΡΙΣΜΕΝΟ: ένα διπλό έξοδο στο
    // Ε2 κοστίζει περισσότερο από ένα που ο χρήστης προσθέτει μόνος του.
    expenseDefault: !!x && dup === false,
  };
}

/** Υπάρχει ήδη έξοδο ΕΝΦΙΑ για τη δόση; `null` όταν η ανάγνωση απέτυχε. */
async function duplicateExpense(db: SupabaseClient, userId: string, propertyId: string, amount: number, eventDate: string): Promise<boolean | null> {
  const w = duplicateWindow(eventDate);
  const { rows, error } = await expenses.inWindow(db, userId, propertyId, w.from, w.to);
  if (error) return null;
  return hasMatchingInstalment(rows, amount, eventDate);
}

/**
 * «Πλήρωσα»: σημειώνει τη δόση πληρωμένη και, ΜΟΝΟ αν το ζήτησε ο χρήστης
 * (`withExpense`) και ισχύει ο κανόνας, γράφει τη δαπάνη.
 */
export async function redeemPayToken(
  db: SupabaseClient, token: string, now: Date, payDay: string, withExpense: boolean,
): Promise<PayOutcome> {
  if (!isPayTokenShape(token)) return { ok: false, kind: 'invalid' };
  const hash = await hashPayToken(token);
  const { data: claimed, error: claimErr } = await db.from(TOKENS)
    .update({ used_at: now.toISOString() })
    .eq('token_hash', hash).is('used_at', null).gt('expires_at', now.toISOString())
    .select(TOKEN_COLS).maybeSingle<TokenRow>();
  if (claimErr) return { ok: false, kind: 'error' };
  if (!claimed) {
    const { t, failed } = await tokenByHash(db, hash);
    if (failed) return { ok: false, kind: 'error' };
    return { ok: false, kind: !t ? 'invalid' : t.used_at ? 'used' : 'expired' };
  }
  const release = () => db.from(TOKENS).update({ used_at: null }).eq('id', claimed.id);

  const { row: ev, error: evErr } = await calendar.ofUserById<EventRow>(db, claimed.user_id, claimed.event_id, EVENT_COLS);
  if (evErr || !ev) { await release(); return { ok: false, kind: evErr ? 'error' : 'invalid' }; }

  const { error: upErr } = await calendar.setStatusOfUser(db, claimed.user_id, ev.id, 'paid');
  if (upErr) { await release(); return { ok: false, kind: 'error' }; }

  const x = withExpense ? expenseForPaidEvent(ev) : null;
  if (x && ev.property_id) {
    const row = { ...expenses.row({ propertyId: ev.property_id, userId: claimed.user_id }, {
      amount: x.amount, description: x.description, date: payDay, category: x.category, paid: true,
      notes: 'Καταχωρήθηκε από το «Πλήρωσα» της υπενθύμισης.',
    }), dedup_hash: x.dedupHash };
    const ins = await expenses.insertDeduped(db, [row]);
    if (ins.error) {
      // Η προθεσμία έκλεισε αλλά η δαπάνη όχι: ξανανοίγει, ώστε να μη μείνει μισή πράξη.
      await calendar.setStatusOfUser(db, claimed.user_id, ev.id, ev.status === 'paid' ? 'paid' : 'pending');
      await release();
      return { ok: false, kind: 'error' };
    }
  }
  return { ok: true, kind: 'paid', title: ev.title, amount: ev.amount, expense: !!x };
}

/** Αναίρεση: ξανανοίγει την προθεσμία και σβήνει τη δαπάνη που γράφτηκε. */
export async function undoPayToken(db: SupabaseClient, token: string, now: Date): Promise<PayOutcome> {
  if (!isPayTokenShape(token)) return { ok: false, kind: 'invalid' };
  const { t, failed } = await tokenByHash(db, await hashPayToken(token));
  if (failed) return { ok: false, kind: 'error' };
  if (!t) return { ok: false, kind: 'invalid' };
  if (!canUndo(t.used_at, t.undone_at, now)) return { ok: false, kind: 'not_undoable' };
  const { data: marked, error: markErr } = await db.from(TOKENS).update({ undone_at: now.toISOString() })
    .eq('id', t.id).is('undone_at', null).select('id').maybeSingle<{ id: string }>();
  if (markErr) return { ok: false, kind: 'error' };
  if (!marked) return { ok: false, kind: 'not_undoable' };
  const { row: ev, error: evErr } = await calendar.ofUserById<EventRow>(db, t.user_id, t.event_id, EVENT_COLS);
  if (evErr) return { ok: false, kind: 'error' };
  const { error } = await calendar.setStatusOfUser(db, t.user_id, t.event_id, 'pending');
  if (error) return { ok: false, kind: 'error' };
  // Σβήνει τη δαπάνη ΑΝ γράφτηκε: το αποτύπωμα είναι ένα ανά γεγονός.
  const del = await expenses.removeByDedup(db, t.user_id, payDedupHash(t.event_id));
  if (del.error) return { ok: false, kind: 'error' };
  return { ok: true, kind: 'undone', title: ev?.title ?? '', amount: ev?.amount ?? null, expense: del.removed > 0 };
}
