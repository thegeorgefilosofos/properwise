// npx tsx lib/reminders/payLink.test.ts
// «Πλήρωσα»: διακριτικό, κανόνας δαπάνης και εξαργύρωση με επανάληψη, IDOR, λήξη, αναίρεση.
import {
  newPayToken, hashPayToken, isPayTokenShape, payUrl, expenseForPaidEvent, canUndo, payTokenExpiry, payDedupHash, isMissingTable,
  PAY_TOKEN_DAYS, PAY_UNDO_HOURS,
} from './payLink';
import { redeemPayToken, undoPayToken, peekPayToken } from './payRedeem';
import { mintPayToken } from './payMint';
import type { SupabaseClient } from '@supabase/supabase-js';

let p = 0, f = 0;
const ok = (c: boolean, m: string) => { if (c) p++; else { f++; console.error('✗', m); } };
const eq = (a: unknown, b: unknown, m: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);

async function main() {
// ── Το διακριτικό ────────────────────────────────────────────────────────────
const a = await newPayToken(), b = await newPayToken();
ok(isPayTokenShape(a.token) && isPayTokenShape(b.token), 'σχήμα: 43 χαρακτήρες base64url (256 bit)');
ok(a.token !== b.token && a.hash !== b.hash, 'δύο διακριτικά, δύο διαφορετικά');
eq(await hashPayToken(a.token), a.hash, 'το αποτύπωμα είναι ντετερμινιστικό');
ok(/^[0-9a-f]{64}$/.test(a.hash) && !a.hash.includes(a.token), 'στη βάση μόνο SHA-256, όχι το διακριτικό');
for (const bad of ['', 'x', 'a'.repeat(42), 'a'.repeat(44), '../../etc', null, 42]) ok(!isPayTokenShape(bad), `απορρίπτεται: ${String(bad).slice(0, 12)}`);
eq(payUrl('https://properwise.gr/', 'T'), 'https://properwise.gr/plirosa/T', 'ο σύνδεσμος');
const now = new Date('2026-10-29T10:00:00Z');
eq(payTokenExpiry(now), new Date(now.getTime() + PAY_TOKEN_DAYS * 86_400_000).toISOString(), `λήξη σε ${PAY_TOKEN_DAYS} μέρες`);

// ── Ο κανόνας της δαπάνης ─────────────────────────────────────────────────
const enfia = { id: 'e1', title: 'ΕΝΦΙΑ, 8η δόση', amount: 26.33, source: 'tax:enfia-instalment-2026-8', property_id: 'p1' };
eq(expenseForPaidEvent(enfia), { category: 'enfia', amount: 26.33, description: 'ΕΝΦΙΑ, 8η δόση', dedupHash: 'reminder-pay:e1' }, 'δόση ΕΝΦΙΑ με ποσό: δαπάνη ΕΝΦΙΑ');
eq(expenseForPaidEvent({ ...enfia, amount: null }), null, 'χωρίς ποσό: καμία δαπάνη');
eq(expenseForPaidEvent({ ...enfia, source: 'tax:e9-2026' }), null, 'Ε9: καμία δαπάνη');
eq(expenseForPaidEvent({ ...enfia, source: 'manual' }), null, 'δική σου υπενθύμιση: καμία δαπάνη');
eq(expenseForPaidEvent({ ...enfia, property_id: null }), null, 'χωρίς ακίνητο: καμία δαπάνη');

// ── Η αναίρεση ─────────────────────────────────────────────────────────────
const used = new Date(now.getTime() - 60_000).toISOString();
ok(canUndo(used, null, now), 'αναίρεση λίγο μετά');
ok(!canUndo(used, used, now), 'όχι δεύτερη αναίρεση');
ok(!canUndo(null, null, now), 'όχι αναίρεση χωρίς πληρωμή');
ok(!canUndo(new Date(now.getTime() - (PAY_UNDO_HOURS * 3_600_000 + 1000)).toISOString(), null, now), `όχι μετά από ${PAY_UNDO_HOURS} ώρες`);

// ── Η εξαργύρωση, πάνω σε ψεύτικη βάση με τη συμπεριφορά του PostgREST ───────
type Row = Record<string, unknown>;
function fakeDb(tables: Record<string, Row[]>, missing: string[] = []) {
  const from = (t: string) => {
    const rows = tables[t] ??= [];
    let op: 'select' | 'update' | 'insert' | 'delete' = 'select', patch: Row = {}, ins: Row | null = null, dedupIgnore = false;
    const where: ((r: Row) => boolean)[] = [];
    const q = {
      select: () => q, update: (x: Row) => { op = 'update'; patch = x; return q; },
      insert: (x: Row) => { op = 'insert'; ins = x; return q; }, delete: () => { op = 'delete'; return q; },
      upsert: (x: Row[] | Row) => { op = 'insert'; ins = Array.isArray(x) ? x[0] : x; dedupIgnore = true; return q; },
      eq: (k: string, v: unknown) => { where.push(r => r[k] === v); return q; },
      is: (k: string, v: unknown) => { where.push(r => (r[k] ?? null) === v); return q; },
      gt: (k: string, v: string) => { where.push(r => String(r[k]) > v); return q; },
      gte: (k: string, v: string) => { where.push(r => String(r[k]) >= v); return q; },
      lte: (k: string, v: string) => { where.push(r => String(r[k]) <= v); return q; },
      limit: () => q,
      run(single: boolean) {
        if (missing.includes(t)) return { data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${t}' in the schema cache` } };
        if (op === 'insert') {
          if (t === 'expenses' && rows.some(r => r.dedup_hash === (ins as Row).dedup_hash)) return dedupIgnore ? { data: null, error: null } : { data: null, error: { code: '23505' } };
          const r = { id: `${t}-${rows.length + 1}`, ...(ins as Row) }; rows.push(r); return { data: r, error: null };
        }
        const hit = rows.filter(r => where.every(w => w(r)));
        if (op === 'update') hit.forEach(r => Object.assign(r, patch));
        if (op === 'delete') hit.forEach(r => rows.splice(rows.indexOf(r), 1));
        return { data: single ? (hit[0] ?? null) : hit, error: null };
      },
      maybeSingle: async () => q.run(true),
      then: (res: (v: unknown) => unknown) => Promise.resolve(q.run(false)).then(res),
    };
    return q;
  };
  return { from } as unknown as SupabaseClient;
}

const tok = await newPayToken();
const tables: Record<string, Row[]> = {
  reminder_pay_tokens: [{ id: 't1', user_id: 'u1', event_id: 'e1', token_hash: tok.hash, used_at: null, undone_at: null, expires_at: payTokenExpiry(now) }],
  calendar_events: [{ ...enfia, user_id: 'u1', status: 'pending' }, { id: 'e2', user_id: 'u2', title: 'Ξένο', amount: 99, source: 'tax:enfia-instalment-2026-8', property_id: 'p9', status: 'pending' }],
  expenses: [],
};
const db = fakeDb(tables);
const peek1 = await peekPayToken(db, tok.token, now);
ok(peek1.ok && !peek1.used && peek1.expenseEligible, 'η σελίδα δείχνει χωρίς να πληρώνει και ρωτά για τη δαπάνη');
eq(tables.calendar_events[0].status, 'pending', 'το άνοιγμα δεν άλλαξε τίποτα');

const r1 = await redeemPayToken(db, tok.token, now, '2026-10-29', true);
ok(r1.ok && r1.kind === 'paid' && r1.expense, 'πρώτο πάτημα με επιβεβαίωση: πληρωμένη και δαπάνη');
eq(tables.calendar_events[0].status, 'paid', 'η προθεσμία έκλεισε');
eq(tables.expenses.length, 1, 'μία δαπάνη');
eq([tables.expenses[0].category, tables.expenses[0].amount, tables.expenses[0].user_id, tables.expenses[0].property_id], ['enfia', 26.33, 'u1', 'p1'], 'η δαπάνη: ΕΝΦΙΑ, ποσό, χρήστης και ακίνητο του γεγονότος');
const r2 = await redeemPayToken(db, tok.token, now, '2026-10-29', true);
ok(!r2.ok && r2.kind === 'used', 'δεύτερο πάτημα (επανάληψη): απορρίπτεται');
eq(tables.expenses.length, 1, 'και καμία δεύτερη δαπάνη');

const u1 = await undoPayToken(db, tok.token, now);
ok(u1.ok && u1.kind === 'undone' && u1.expense, 'αναίρεση, με τη δαπάνη');
eq([tables.calendar_events[0].status, tables.expenses.length], ['pending', 0], 'η προθεσμία ξανανοίγει, η δαπάνη σβήνει');
ok(!(await undoPayToken(db, tok.token, now)).ok, 'όχι δεύτερη αναίρεση');
ok(!(await redeemPayToken(db, tok.token, now, '2026-10-29', true)).ok, 'και ο ίδιος σύνδεσμος δεν ξαναπληρώνει');

// Χωρίς επιβεβαίωση δαπάνης (το κουμπί της ειδοποίησης): μόνο πληρωμένη.
const push = await newPayToken();
tables.reminder_pay_tokens.push({ id: 't0', user_id: 'u1', event_id: 'e1', token_hash: push.hash, used_at: null, undone_at: null, expires_at: payTokenExpiry(now) });
const rp = await redeemPayToken(db, push.token, now, '2026-10-29', false);
ok(rp.ok && rp.kind === 'paid' && !rp.expense, 'ειδοποίηση: πληρωμένη χωρίς δαπάνη');
eq([tables.calendar_events[0].status, tables.expenses.length], ['paid', 0], 'η προθεσμία κλείνει, καμία δαπάνη');
const up = await undoPayToken(db, push.token, now);
ok(up.ok && !up.expense, 'αναίρεση χωρίς δαπάνη: δεν λέει ότι έσβησε δαπάνη');
eq(tables.calendar_events[0].status, 'pending', 'και η προθεσμία ξανανοίγει');
eq(payDedupHash('e1'), 'reminder-pay:e1', 'ένα αποτύπωμα ανά γεγονός');

// IDOR: διακριτικό του u1 που δείχνει σε γεγονός του u2.
const evil = await newPayToken();
tables.reminder_pay_tokens.push({ id: 't2', user_id: 'u1', event_id: 'e2', token_hash: evil.hash, used_at: null, undone_at: null, expires_at: payTokenExpiry(now) });
const r3 = await redeemPayToken(db, evil.token, now, '2026-10-29', true);
ok(!r3.ok && r3.kind === 'invalid', 'IDOR: γεγονός άλλου χρήστη, απορρίπτεται');
eq(tables.calendar_events[1].status, 'pending', 'και το ξένο γεγονός μένει ανέγγιχτο');
eq(tables.reminder_pay_tokens.find(r => r.id === 't2')?.used_at, null, 'και το διακριτικό ελευθερώνεται');

// Λήξη.
const old = await newPayToken();
tables.reminder_pay_tokens.push({ id: 't3', user_id: 'u1', event_id: 'e1', token_hash: old.hash, used_at: null, undone_at: null, expires_at: new Date(now.getTime() - 1000).toISOString() });
const r4 = await redeemPayToken(db, old.token, now, '2026-10-29', true);
ok(!r4.ok && r4.kind === 'expired', 'ληγμένο: απορρίπτεται');
const unknown = await newPayToken();
ok(!(await redeemPayToken(db, unknown.token, now, '2026-10-29', true)).ok, 'άγνωστο διακριτικό: απορρίπτεται');

// ── Η προεπιλογή του εξόδου: τσεκαρισμένο ΜΟΝΟ χωρίς υπάρχον έξοδο ─────────
{
  const ev = { ...enfia, user_id: 'u1', status: 'pending', event_date: '2026-10-30' };
  const mk = async (rows: Row[], missing: string[] = []) => {
    const t = await newPayToken();
    const tb: Record<string, Row[]> = {
      reminder_pay_tokens: [{ id: 'd1', user_id: 'u1', event_id: 'e1', token_hash: t.hash, used_at: null, undone_at: null, expires_at: payTokenExpiry(now) }],
      calendar_events: [ev], expenses: rows,
    };
    return { t, tb, db: fakeDb(tb, missing) };
  };
  const exp = (o: Row = {}) => ({ id: 'x1', user_id: 'u1', property_id: 'p1', amount: 26.33, date: '2026-10-28', category: 'enfia', ...o });

  let c = await mk([]);
  let pk = await peekPayToken(c.db, c.t.token, now);
  ok(pk.ok && pk.expenseEligible && pk.expenseDefault && !pk.expenseDuplicate, 'χωρίς έξοδο: τσεκαρισμένο, χωρίς σημείωση');

  c = await mk([exp()]);
  pk = await peekPayToken(c.db, c.t.token, now);
  ok(pk.ok && pk.expenseDuplicate && !pk.expenseDefault, 'με έξοδο ΕΝΦΙΑ ίδιου ποσού στο διάστημα: ξετσεκαρισμένο και σημείωση');

  c = await mk([exp({ property_id: 'p2' })]);
  pk = await peekPayToken(c.db, c.t.token, now);
  ok(pk.ok && pk.expenseDefault && !pk.expenseDuplicate, 'έξοδο άλλου ακινήτου: δεν μετρά');

  c = await mk([exp({ user_id: 'u2' })]);
  pk = await peekPayToken(c.db, c.t.token, now);
  ok(pk.ok && pk.expenseDefault, 'έξοδο άλλου χρήστη: δεν μετρά');

  c = await mk([], ['expenses']);
  pk = await peekPayToken(c.db, c.t.token, now);
  ok(pk.ok && !pk.expenseDefault && !pk.expenseDuplicate, 'η ανάγνωση εξόδων απέτυχε: ξετσεκαρισμένο (άγνωστο ≠ «δεν υπάρχει»)');

  // Idempotent καταχώρηση: η ίδια δαπάνη από δύο διαδρομές γράφεται μία φορά.
  c = await mk([]);
  ok((await redeemPayToken(c.db, c.t.token, now, '2026-10-29', true)).ok, 'πληρωμή με έξοδο');
  await import('@/lib/data/expenses').then(m => m.insertDeduped(c.db, [{ user_id: 'u1', property_id: 'p1', amount: 26.33, category: 'enfia', date: '2026-10-29', description: 'x', dedup_hash: payDedupHash('e1') }]));
  eq(c.tb.expenses.length, 1, 'δεύτερη εγγραφή με το ίδιο αποτύπωμα: καμία νέα γραμμή (ON CONFLICT … DO NOTHING)');
}

// ── Πριν τη μετανάστευση: ο πίνακας των διακριτικών δεν υπάρχει ──────────────
{
  ok(isMissingTable({ code: '42P01' }) && isMissingTable({ code: 'PGRST205' }), 'αναγνωρίζει «δεν υπάρχει ο πίνακας»');
  ok(!isMissingTable({ code: '23505' }) && !isMissingTable(null), 'άλλα σφάλματα δεν είναι «λείπει ο πίνακας»');
  const tb: Record<string, Row[]> = { calendar_events: [{ ...enfia, user_id: 'u1', status: 'pending' }], expenses: [] };
  const db0 = fakeDb(tb, ['reminder_pay_tokens']);
  const quiet = console.error; let noise = 0; console.error = () => { noise++; };
  const minted = await mintPayToken(db0, 'u1', 'e1', 'push', now);
  console.error = quiet;
  eq(minted, null, 'χωρίς πίνακα: κανένα διακριτικό, άρα η ειδοποίηση φεύγει χωρίς «Πλήρωσα»');
  eq(noise, 0, 'και χωρίς σφάλμα στα αρχεία');
  const t0 = await newPayToken();
  const pk0 = await peekPayToken(db0, t0.token, now);
  ok(!pk0.ok && pk0.kind === 'error', 'η σελίδα: «Δεν φορτώθηκε τώρα», όχι κατάρρευση');
  const r0 = await redeemPayToken(db0, t0.token, now, '2026-10-29', true);
  ok(!r0.ok && r0.kind === 'error', 'το POST: προσωρινό σφάλμα (503), τίποτα δεν άλλαξε');
  eq(tb.calendar_events[0].status, 'pending', 'και η προθεσμία μένει ανοιχτή');
}

console.log(`payLink: ${p} ✓ · ${f} ✗`);
if (f) process.exit(1);
}
void main();
