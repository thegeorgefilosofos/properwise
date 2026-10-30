// ═══════════════════════════════════════════════════════════════════════════
//  ΟΙ ΕΓΓΡΑΦΕΣ ΤΗΣ ΕΦΑΡΜΟΓΗΣ, ΟΠΩΣ ΤΙΣ ΣΤΕΛΝΕΙ, ΣΕ ΠΡΑΓΜΑΤΙΚΟ POSTGRES
// ─────────────────────────────────────────────────────────────────────────
//  ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ. Το scripts/db/rls-probe.sql γράφει γραμμές ΜΕ ΤΟ ΧΕΡΙ,
//  σε SQL. Οι γραμμές της εφαρμογής όμως τις χτίζουν οι συναρτήσεις του
//  lib/data· εκεί γεννήθηκαν τα σφάλματα που έφτασαν στην παραγωγή:
//
//    calendar_events.recurrence_exdates  null σε NOT NULL, κάθε εισαγωγή στο
//                                        ημερολόγιο απορριπτόταν (#423)
//    user_properties.sqm                 «Το ακίνητο δεν αποθηκεύτηκε» με κενό
//                                        εμβαδόν (PROPERWISE-9)
//
//  Κανένα δεν φαινόταν σε δοκιμή μονάδας, γιατί η δοκιμή μονάδας δεν ξέρει τι
//  δέχεται η βάση· και κανένα στο rls-probe, γιατί εκεί η γραμμή είναι γραμμένη
//  σωστά από τον άνθρωπο που ξέρει το σχήμα.
//
//  ΤΙ ΚΑΝΕΙ. Καλεί τις ΠΡΑΓΜΑΤΙΚΕΣ συναρτήσεις εγγραφής του lib/data με πελάτη
//  που ΚΑΤΑΓΡΑΦΕΙ ό,τι θα έστελνε ο supabase-js: πίνακα, γραμμές, `onConflict`,
//  `ignoreDuplicates`, φίλτρα. Τα μεταφράζει σε SQL με την ίδια σημασία που
//  τους δίνει το PostgREST (ένωση κλειδιών ως στήλες, `null` όπου λείπει) και τα
//  τυπώνει. Το scripts/db-replay.sh τα τρέχει ως `authenticated`, με τον
//  χρήστη συνδεδεμένο, σε κλώνο της βάσης. Ετσι κρίνονται μαζί:
//
//    · NOT NULL, CHECK, ξένα κλειδιά και τύποι, πάνω στη γραμμή της εφαρμογής·
//    · στήλη που η εφαρμογή στέλνει και ο πίνακας δεν έχει·
//    · το `ON CONFLICT` κάθε upsert: βρίσκει ευρετήριο που ταιριάζει;
//    · η RLS στη γραφή (WITH CHECK): ο χρήστης γράφει στα δικά του, όχι σε ξένα·
//    · η RLS του `bills` για τρίτους: το μέλος του οργανισμού βλέπει και
//      διορθώνει λογαριασμό του ιδιοκτήτη, ο ξένος και ο ανώνυμος τίποτα·
//    · τα triggers που τρέχουν πάνω σε αυτές τις εγγραφές.
//
//  ΧΡΗΣΗ: npx tsx scripts/db/write-flows.ts > ροές.sql   (το καλεί το db-replay)
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import * as properties from '@/lib/data/properties';
import * as calendar from '@/lib/data/calendar';
import * as expenses from '@/lib/data/expenses';
import * as tenants from '@/lib/data/tenants';
import * as bills from '@/lib/data/bills';
import * as rent from '@/lib/data/rent';
import * as documents from '@/lib/data/documents';
import { newPropertyRow, statementDocRow } from '@/lib/myaade/commit';
import { matchProperty } from '@/lib/myaade/match';
import { planStatement } from '@/lib/myaade/statement';
import { fakeAtak } from '@/lib/myaade/fixtures';
import { instalmentRows } from '@/app/dashboard/components/rentInstalments';
import type { Tenant } from '@/app/dashboard/components/TabTenantTypes';

type Row = Record<string, unknown>;
interface Write {
  label: string;
  expect: 'ok' | 'deny';
  /** Ποιος είναι συνδεδεμένος όταν στέλνεται η εγγραφή. */
  uid: string;
  table: string;
  op: 'insert' | 'upsert' | 'update' | 'delete';
  rows: Row[];
  onConflict?: string;
  ignoreDuplicates?: boolean;
  where: [string, unknown][];
}

/** Οι δύο ιδιοκτήτες και ό,τι τους ανήκει. Σταθερά, για να διαβάζεται το SQL. */
export const A = '7e570000-0000-4000-8000-00000000000a';
export const B = '7e570000-0000-4000-8000-00000000000b';
export const PA = '7e570000-0000-4000-8000-0000000000a1';
export const PB = '7e570000-0000-4000-8000-0000000000b1';
const TA = '7e570000-0000-4000-8000-0000000000a2';
const BILL = '7e570000-0000-4000-8000-0000000000a3';
/** Ο οργανισμός του Α και το μέλος του με δικαίωμα επεξεργασίας. */
const ORG = '7e570000-0000-4000-8000-0000000000a4';
export const M = '7e570000-0000-4000-8000-00000000000c';
/** Η εισαγωγή από το myAADE: δύο καταγραφές, ένα ακίνητο, μία γραμμή «ΕΝΦΙΑ 2026». */
const IMP = '7e570000-0000-4000-8000-0000000000a5';
const IMP2 = '7e570000-0000-4000-8000-0000000000a6';
const IP1 = '7e570000-0000-4000-8000-0000000000a7';
const IDOC = '7e570000-0000-4000-8000-0000000000a8';
const IATAK = fakeAtak(1);

const writes: Write[] = [];
/** Σήμα για το `.is(στήλη, null)`: γίνεται `στήλη is null`, όχι `= null`. */
const IS_NULL = Symbol('is null');
let current: Pick<Write, 'label' | 'expect' | 'uid'> = { label: '', expect: 'ok', uid: A };

/** Πελάτης που δεν στέλνει τίποτα: γράφει τι θα έστελνε. */
function recorder(): SupabaseClient {
  const from = (table: string) => {
    const w: Write = { ...current, table, op: 'insert', rows: [], where: [] };
    const arr = (x: Row | Row[]) => (Array.isArray(x) ? x : [x]);
    const result = () => ({ data: w.op === 'update' ? null : { id: w.rows[0]?.id ?? null }, error: null });
    const q = {
      insert(x: Row | Row[]) { w.op = 'insert'; w.rows = arr(x); writes.push(w); return q; },
      upsert(x: Row | Row[], o: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
        w.op = 'upsert'; w.rows = arr(x); w.onConflict = o.onConflict; w.ignoreDuplicates = !!o.ignoreDuplicates; writes.push(w); return q;
      },
      update(x: Row) { w.op = 'update'; w.rows = [x]; writes.push(w); return q; },
      delete() { w.op = 'delete'; w.rows = [{}]; writes.push(w); return q; },
      in(k: string, v: unknown[]) { if (v.length !== 1) throw new Error('το write-flows γράφει ένα `in` μόνο με μία τιμή'); w.where.push([k, v[0]]); return q; },
      is(k: string, v: unknown) { if (v !== null) throw new Error('το write-flows ξέρει μόνο `is null`'); w.where.push([k, IS_NULL]); return q; },
      eq(k: string, v: unknown) { w.where.push([k, v]); return q; },
      select() { return q; },
      single() { return Promise.resolve(result()); },
      maybeSingle() { return Promise.resolve(result()); },
      then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) { return Promise.resolve(result()).then(res, rej); },
    };
    return q;
  };
  return { from } as unknown as SupabaseClient;
}

async function flow(label: string, fn: () => PromiseLike<unknown>, expect: 'ok' | 'deny' = 'ok', uid = A) {
  current = { label, expect, uid };
  const before = writes.length;
  await fn();
  if (writes.length === before) throw new Error(`η ροή «${label}» δεν έγραψε τίποτα`);
}

// ── ΟΙ ΚΥΡΙΕΣ ΡΟΕΣ ─────────────────────────────────────────────────────────
const db = recorder();
const scope = { propertyId: PA, userId: A };

async function flows() {
  // Ο οδηγός «Νέο ακίνητο» με τα προαιρετικά κενά: εμβαδόν, τύπος και ποσοστό
  // συνιδιοκτησίας φτάνουν ως null (PROPERWISE-9).
  await flow('νέο ακίνητο από τον οδηγό, με κενά προαιρετικά', () => properties.add(db, {
    id: PA, user_id: A, name: 'Δοκιμή εγγραφών', address: 'Οδός Δοκιμής 1, Αθήνα',
    sqm: null, prop_type: null, ownership: null, floor: null, year_built: null,
    co_owners: [], purchase_date: null, enfia: null, obj_value: null,
  }));

  await flow('γεγονός ημερολογίου, χωρίς εξαιρέσεις επανάληψης (#423)', () =>
    calendar.insert(db, [calendar.row(scope, 'manual', { title: 'Δόση ΕΝΦΙΑ', category: 'tax', event_date: '2026-11-30', amount: 100 })]));
  await flow('προθεσμίες σε παρτίδα, με και χωρίς ποσό', () =>
    calendar.insert(db, [
      calendar.row(scope, 'tax:e2', { title: 'Ε2', category: 'tax', event_date: '2027-06-30' }),
      calendar.row(scope, 'manual', { title: 'Συντήρηση λέβητα', category: 'maintenance', event_date: '2026-12-01', amount: 80, recurring: true, recurring_interval: 'yearly' }),
    ]));

  await flow('δαπάνη από τη φόρμα', () =>
    expenses.insert(db, [expenses.row(scope, { amount: 84.5, description: 'ΔΕΗ', date: '2026-10-29', category: 'electricity', paid: true })]));
  const bank = [expenses.row(scope, { amount: 12, description: 'Κίνηση τράπεζας', date: '2026-10-01', category: 'other', paid: true })]
    .map(r => ({ ...r, dedup_hash: 'write-flows-bank-1' }));
  await flow('εισαγωγή κινήσεων τράπεζας', () => expenses.insertFromBank(db, bank));
  await flow('η ίδια εισαγωγή ξανά, μετά από διακοπή', () => expenses.insertFromBank(db, bank));

  const tenant = {
    id: TA, property_id: PA, user_id: A, full_name: 'Μισθωτής Δοκιμής', monthly_rent: 500,
    lease_start: '2026-01-01', lease_end: '2028-12-31', payment_frequency: 'monthly', rent_due_day: 5,
  } as unknown as Tenant;
  await flow('νέος μισθωτής', () => tenants.add(db, PA, A, {
    id: TA, full_name: 'Μισθωτής Δοκιμής', monthly_rent: 500, lease_start: '2026-01-01', lease_end: '2028-12-31',
    payment_frequency: 'monthly', rent_due_day: 5, email: null, phone: null,
  }));
  await flow('πρόγραμμα ενοικίου της μίσθωσης', () => rent.upsertPeriods(db, instalmentRows(tenant, PA, A), { ignoreDuplicates: true }));
  await flow('το ίδιο πρόγραμμα ξανά (δεύτερο άνοιγμα της οθόνης)', () => rent.upsertPeriods(db, instalmentRows(tenant, PA, A), { ignoreDuplicates: true }));
  await flow('είσπραξη του Ιανουαρίου', () => rent.upsertPeriod(db, {
    tenant_id: TA, property_id: PA, user_id: A, period_year: 2026, period_month: 1, amount: 500, paid: true, paid_date: '2026-01-05',
  }));

  await flow('νέος λογαριασμός', () => bills.add(db, PA, A, { id: BILL, name: 'ΔΕΗ', type: 'electricity', amount: 84.5, due_date: '2026-11-15', paid: false }));
  await flow('ο λογαριασμός πληρώθηκε', () => bills.update(db, BILL, { paid: true }));

  // ── Ο Α ΔΕΝ ΓΡΑΦΕΙ ΣΤΑ ΤΟΥ Β ─────────────────────────────────────────────
  const foreign = { propertyId: PB, userId: B };
  await flow('ΞΕΝΗ δαπάνη στο όνομα του Β', () =>
    expenses.insert(db, [expenses.row(foreign, { amount: 1, description: 'ξένη', date: '2026-10-29', category: 'other' })]), 'deny');
  await flow('ΞΕΝΟ γεγονός στο όνομα του Β', () =>
    calendar.insert(db, [calendar.row(foreign, 'manual', { title: 'ξένο', category: 'reminder', event_date: '2026-11-01' })]), 'deny');
  await flow('ΞΕΝΟ ακίνητο στο όνομα του Β', () => properties.add(db, { user_id: B, name: 'ξένο' }), 'deny');
  await flow('ΞΕΝΟΣ μισθωτής στο ακίνητο του Β', () => tenants.add(db, PB, B, { full_name: 'ξένος' }), 'deny');
  await flow('ΞΕΝΟ ακίνητο: αλλαγή ονόματος στο ακίνητο του Β', () => properties.update(db, PB, { name: 'κλεμμένο' }), 'deny');

  // ── ΤΟ ΜΕΛΟΣ ΤΟΥ ΟΡΓΑΝΙΣΜΟΥ ΓΡΑΦΕΙ, Ο ΞΕΝΟΣ ΟΧΙ ─────────────────────────
  // Η πολιτική ενημέρωσης του `bills` είναι ΕΝΑ OR: «δικό μου» ή «του
  // ιδιοκτήτη μου, με δικαίωμα επεξεργασίας». Και τα δύο σκέλη ελέγχονται εδώ.
  await flow('μέλος του οργανισμού διορθώνει λογαριασμό του ιδιοκτήτη', () => bills.update(db, BILL, { amount: 90 }), 'ok', M);
  await flow('ΞΕΝΟΣ: αλλαγή ποσού σε λογαριασμό του Α', () => bills.update(db, BILL, { amount: 1 }), 'deny', B);

  // ── Η ΕΙΣΑΓΩΓΗ ΑΠΟ ΤΟ myAADE (lib/myaade/commit.ts) ────────────────────
  // Οι εγγραφές με τη σειρά του `commitImport`. Οι αποφάσεις (υπάρχει ήδη; τι
  // αντικαθίσταται;) βγαίνουν από τις ίδιες καθαρές συναρτήσεις της οθόνης.
  const row = { existingId: null, name: 'Διαμέρισμα, Οδός Παραδείγματος 11', address: 'Οδός Παραδείγματος 11', atak: IATAK, sqm: 61, ownershipPct: 100, floor: '1' };
  await flow('εισαγωγή myAADE: καταγραφή (όριο ημέρας)', () => db.from('myaade_imports').insert({ id: IMP, user_id: A, kind: 'enfia_act', tax_year: 2026, found_count: 1 }));
  await flow('εισαγωγή myAADE: νέο ακίνητο', () => properties.add(db, { ...newPropertyRow(A, row), id: IP1 }));
  await flow('εισαγωγή myAADE: το σύνολο «ΕΝΦΙΑ 2026», χωρίς αρχείο', () =>
    documents.add(db, IP1, A, { ...statementDocRow(2026, 843.2, '2026-03-15'), id: IDOC }));
  await flow('εισαγωγή myAADE: τι δημιούργησε, για την αναίρεση', () =>
    db.from('myaade_imports').update({ created_property_ids: [IP1], document_id: IDOC, replaced: [] }).eq('id', IMP));

  // Η ΙΔΙΑ ΠΡΑΞΗ ΔΕΥΤΕΡΗ ΦΟΡΑ: το ακίνητο ταιριάζει με ΑΤΑΚ και το σύνολο είναι
  // ήδη το ίδιο. Γράφεται μόνο η καταγραφή· κανένα ακίνητο, καμία γραμμή.
  if (matchProperty({ atak: IATAK, address: null }, [{ id: IP1, name: row.name, address: row.address, atak: IATAK }]).status !== 'exists') {
    throw new Error('η δεύτερη εισαγωγή δεν βρίσκει το ακίνητο με τον ΑΤΑΚ του');
  }
  const again = planStatement(2026, 843.2, [{ id: IDOC, property_id: IP1, amount: 843.2 }], [], IP1);
  if (again.insertOn || again.docUpdates.length) throw new Error('η δεύτερη εισαγωγή θα έγραφε δεύτερο σύνολο');
  await flow('εισαγωγή myAADE ξανά: μόνο καταγραφή', () => db.from('myaade_imports').insert({ id: IMP2, user_id: A, kind: 'enfia_act', tax_year: 2026, found_count: 1 }));

  // ΔΙΟΡΘΩΤΙΚΗ ΠΡΑΞΗ ΜΕ ΜΙΚΡΟΤΕΡΟ ΠΟΣΟ: η ίδια γραμμή αλλάζει ποσό.
  const corrective = planStatement(2026, 700, [{ id: IDOC, property_id: IP1, amount: 843.2 }], [], IP1);
  if (corrective.insertOn || corrective.docUpdates.length !== 1) throw new Error('η διορθωτική δεν αντικαθιστά');
  await flow('διορθωτική πράξη: αντικαθιστά το σύνολο', () => documents.update(db, [IDOC], { amount: corrective.docUpdates[0].amount }));

  // Ο ΞΕΝΟΣ: ούτε καταγραφή στο όνομα του Α ούτε αναίρεση της εισαγωγής του.
  await flow('ΞΕΝΗ καταγραφή εισαγωγής στο όνομα του Α', () => db.from('myaade_imports').insert({ user_id: A, kind: 'enfia_act', tax_year: 2026, found_count: 1 }), 'deny', B);
  await flow('ΞΕΝΟΣ: αναίρεση της εισαγωγής του Α', () => db.from('myaade_imports').update({ undone_at: '2026-10-30T12:00:00Z' }).eq('id', IMP), 'deny', B);

  // Η ΑΝΑΙΡΕΣΗ: σήμανση πρώτα, μετά ό,τι δημιούργησε η εισαγωγή.
  await flow('αναίρεση εισαγωγής: σήμανση', () => db.from('myaade_imports').update({ undone_at: '2026-10-30T12:00:00Z' }).eq('id', IMP).is('undone_at', null));
  await flow('αναίρεση εισαγωγής: η γραμμή του συνόλου', () => documents.remove(db, IDOC));
  await flow('αναίρεση εισαγωγής: το ακίνητο', () => properties.remove(db, IP1, A));
  await flow('ΔΕΥΤΕΡΗ αναίρεση της ίδιας εισαγωγής', () => db.from('myaade_imports').update({ undone_at: '2026-10-30T13:00:00Z' }).eq('id', IMP), 'deny');
}

// ── ΜΕΤΑΦΡΑΣΗ ΣΕ SQL, ΜΕ ΤΗ ΣΗΜΑΣΙΑ ΤΟΥ PostgREST ───────────────────────────
const lit = (v: unknown) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const ident = (s: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error(`όνομα που δεν περιμέναμε: ${s}`);
  return s;
};
const jsonLit = (x: unknown) => {
  const s = JSON.stringify(x);
  if (s.includes('$j$')) throw new Error('το JSON περιέχει τον οριοθέτη');
  return `$j$${s}$j$::json`;
};

const whereOf = (w: Write) =>
  w.where.map(([k, v]) => (v === IS_NULL ? `t.${ident(k)} is null` : `t.${ident(k)} = ${lit(v)}`)).join(' and ') || 'true';

function statement(w: Write): string {
  const t = `public.${ident(w.table)}`;
  if (w.op === 'delete') return `delete from ${t} t where ${whereOf(w)}`;
  if (w.op === 'update') {
    const cols = Object.keys(w.rows[0]).map(ident);
    const where = whereOf(w);
    return `update ${t} t set (${cols.join(', ')}) = (select ${cols.map(c => 'r.' + c).join(', ')} from json_populate_record(null::${t}, ${jsonLit(w.rows[0])}) r) where ${where}`;
  }
  // Οι στήλες είναι η ΕΝΩΣΗ των κλειδιών όλων των γραμμών (supabase-js,
  // defaultToNull): όπου λείπει κλειδί, φτάνει null, όχι η προεπιλογή.
  const cols: string[] = [];
  for (const r of w.rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(ident(k));
  let sql = `insert into ${t} (${cols.join(', ')}) select ${cols.join(', ')} from json_populate_recordset(null::${t}, ${jsonLit(w.rows)})`;
  if (w.op === 'upsert') {
    const key = (w.onConflict ?? '').split(',').map(s => ident(s.trim())).filter(Boolean);
    if (!key.length) throw new Error(`upsert χωρίς onConflict στο ${w.table}: το PostgREST θα διάλεγε το πρωτεύον κλειδί`);
    const rest = cols.filter(c => !key.includes(c));
    sql += ` on conflict (${key.join(', ')}) ` + (w.ignoreDuplicates || !rest.length
      ? 'do nothing'
      : `do update set ${rest.map(c => `${c} = excluded.${c}`).join(', ')}`);
  }
  return sql;
}

function block(w: Write, i: number): string {
  const name = `${i + 1}. ${w.label}`.replace(/'/g, "''");
  const s = statement(w);
  const who = `set session "probe.uid" = ${lit(w.uid)};\n`;
  if (w.expect === 'ok') {
    return who + `do $w$ declare n int; begin
  ${s};
  get diagnostics n = row_count;
  if n = 0 and '${w.op}' in ('update', 'delete') then raise exception 'ΡΟΗ «${name}»: η εντολή δεν βρήκε γραμμή'; end if;
  raise notice 'write-flow: ${name} (% γραμμές)', n;
exception when others then
  if sqlerrm like 'ΡΟΗ «%' then raise; end if;
  raise exception 'ΡΟΗ «${name}» δεν γράφεται: % [%]', sqlerrm, sqlstate;
end $w$;`;
  }
  return who + `do $w$ declare n int; begin
  ${s};
  get diagnostics n = row_count;
  if n > 0 then raise exception 'ΔΙΑΡΡΟΗ: «${name}» έγραψε % γραμμές', n; end if;
  raise notice 'write-flow: ${name} (καμία γραμμή, σωστά)';
exception when insufficient_privilege then
  raise notice 'write-flow: ${name} (άρνηση RLS, σωστά)';
end $w$;`;
}

async function main() {
  await flows();
  const out: string[] = [
    '-- Παράγεται από το scripts/db/write-flows.ts. Μην το επεξεργάζεσαι.',
    '\\set ON_ERROR_STOP 1',
    `create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('probe.uid', true), '')::uuid $$;`,
    'grant select, insert, update, delete on all tables in schema public to authenticated;',
    'grant usage, select on all sequences in schema public to authenticated;',
    // Οι δύο ιδιοκτήτες, με τα triggers της εγγραφής (προφίλ χρέωσης, ταχυδρομείο, ημερολόγιο).
    `insert into auth.users(id, email) values (${lit(A)}, 'write-a@probe.test'), (${lit(B)}, 'write-b@probe.test');`,
    `insert into public.user_properties(id, user_id, name) values (${lit(PB)}, ${lit(B)}, 'Του Β');`,
    // Ο Α έχει οργανισμό· ο Μ είναι ενεργό μέλος του με δικαίωμα επεξεργασίας.
    `insert into auth.users(id, email) values (${lit(M)}, 'write-m@probe.test');`,
    `insert into public.organizations(id, owner_user_id, name) values (${lit(ORG)}, ${lit(A)}, 'Γραφείο Α');`,
    `insert into public.organization_members(org_id, user_id, email, status, can_edit) values (${lit(ORG)}, ${lit(M)}, 'write-m@probe.test', 'active', true);`,
    'set role authenticated;',
    ...writes.map(block),
    // ── ΠΟΙΟΣ ΒΛΕΠΕΙ ΤΟΝ ΛΟΓΑΡΙΑΣΜΟ ΤΟΥ Α ──────────────────────────────────
    `set session "probe.uid" = ${lit(M)};`,
    `do $w$ begin
  if (select count(*) from public.bills where id = ${lit(BILL)}) <> 1 then
    raise exception 'ΡΟΗ «μέλος»: το μέλος του οργανισμού δεν βλέπει τον λογαριασμό του ιδιοκτήτη';
  end if;
  raise notice 'write-flow: το μέλος του οργανισμού βλέπει τον λογαριασμό του ιδιοκτήτη';
end $w$;`,
    `set session "probe.uid" = ${lit(B)};`,
    `do $w$ begin
  if (select count(*) from public.bills where user_id = ${lit(A)}) <> 0 then
    raise exception 'ΔΙΑΡΡΟΗ: ο Β βλέπει λογαριασμούς του Α';
  end if;
  raise notice 'write-flow: ο ξένος δεν βλέπει λογαριασμό του Α (σωστά)';
end $w$;`,
    // Ο ανώνυμος έχει GRANT στην παραγωγή· μόνο η RLS τον σταματά. Το ίδιο εδώ.
    'reset role;',
    'grant select, insert, update, delete on public.bills to anon;',
    'set role anon;',
    `set session "probe.uid" = '';`,
    `do $w$ declare n int; begin
  if (select count(*) from public.bills) <> 0 then
    raise exception 'ΔΙΑΡΡΟΗ: ο ανώνυμος βλέπει λογαριασμούς';
  end if;
  update public.bills set amount = 0;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ΔΙΑΡΡΟΗ: ο ανώνυμος άλλαξε % λογαριασμούς', n; end if;
  raise notice 'write-flow: ο ανώνυμος δεν βλέπει ούτε αλλάζει λογαριασμό (σωστά)';
end $w$;`,
    'reset role;',
    // ── Η ΕΙΣΑΓΩΓΗ ΑΠΟ ΤΟ myAADE, ΣΤΗ ΒΑΣΗ ─────────────────────────────────
    `do $w$ begin
  if (select count(*) from public.user_properties where user_id = ${lit(A)} and atak = ${lit(IATAK)}) <> 0 then
    raise exception 'ΡΟΗ «αναίρεση εισαγωγής»: το ακίνητο της εισαγωγής έμεινε';
  end if;
  if (select count(*) from public.myaade_imports where user_id = ${lit(A)}) <> 2 then
    raise exception 'ΡΟΗ «εισαγωγή myAADE»: οι καταγραφές δεν είναι δύο (μία ανά εισαγωγή)';
  end if;
  if (select undone_at from public.myaade_imports where id = ${lit(IMP)}) <> '2026-10-30T12:00:00Z'::timestamptz then
    raise exception 'ΡΟΗ «αναίρεση εισαγωγής»: η δεύτερη αναίρεση ή ο ξένος άλλαξαν τη σήμανση';
  end if;
  raise notice 'write-flow: εισαγωγή, δεύτερη εισαγωγή χωρίς διπλότυπο, διορθωτική και αναίρεση στη βάση όπως η οθόνη';
end $w$;`,
    // Ο ΞΕΝΟΣ ΔΕΝ ΒΛΕΠΕΙ τις εισαγωγές του Α.
    'set role authenticated;',
    `set session "probe.uid" = ${lit(B)};`,
    `do $w$ begin
  if (select count(*) from public.myaade_imports where user_id = ${lit(A)}) <> 0 then
    raise exception 'ΔΙΑΡΡΟΗ: ο Β βλέπει εισαγωγές του Α';
  end if;
  raise notice 'write-flow: ο ξένος δεν βλέπει τις εισαγωγές του Α (σωστά)';
end $w$;`,
    // ΤΟ ΟΡΙΟ ΤΩΝ 10 ΣΕ 24 ΩΡΕΣ: ο Α έχει ήδη δύο, η ενδέκατη απορρίπτεται.
    `set session "probe.uid" = ${lit(A)};`,
    `do $w$ declare i int; begin
  for i in 1..8 loop
    insert into public.myaade_imports (user_id, kind, tax_year, found_count) values (${lit(A)}, 'enfia_act', 2026, 0);
  end loop;
  begin
    insert into public.myaade_imports (user_id, kind, tax_year, found_count) values (${lit(A)}, 'enfia_act', 2026, 0);
    raise exception 'ΡΟΗ «όριο εισαγωγών»: η ενδέκατη εισαγωγή σε 24 ώρες πέρασε';
  exception when sqlstate '54000' then
    raise notice 'write-flow: η ενδέκατη εισαγωγή σε 24 ώρες απορρίπτεται (σωστά)';
  end;
end $w$;`,
    // Ο ΧΡΟΝΟΣ ΔΕΝ ΔΙΝΕΤΑΙ ΑΠΟ ΤΟΝ ΠΕΡΙΗΓΗΤΗ: ένα παλιό created_at δεν παρακάμπτει το όριο.
    'reset role;',
    `delete from public.myaade_imports where user_id = ${lit(A)} and id not in (${lit(IMP)}, ${lit(IMP2)});`,
    'set role authenticated;',
    `do $w$ declare v timestamptz; begin
  insert into public.myaade_imports (user_id, kind, created_at) values (${lit(A)}, 'enfia_act', '2000-01-01') returning created_at into v;
  if v < now() - interval '1 minute' then raise exception 'ΡΟΗ «όριο εισαγωγών»: ο περιηγητής όρισε παλιά ώρα'; end if;
  raise notice 'write-flow: η ώρα της εισαγωγής είναι της βάσης (σωστά)';
end $w$;`,
    // Η ΑΝΑΙΡΕΣΗ ΚΛΕΙΝΕΙ ΣΤΙΣ 24 ΩΡΕΣ.
    'reset role;',
    `update public.myaade_imports set created_at = now() - interval '25 hours' where id = ${lit(IMP2)};`,
    'set role authenticated;',
    `do $w$ declare n int; begin
  update public.myaade_imports set undone_at = now() where id = ${lit(IMP2)};
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ΡΟΗ «αναίρεση εισαγωγής»: αναιρέθηκε μετά από 24 ώρες'; end if;
  raise notice 'write-flow: η αναίρεση κλείνει στις 24 ώρες (σωστά)';
end $w$;`,
    'reset role;',
    // Τα triggers της ενημέρωσης: ο λογαριασμός που πληρώθηκε έχει νέο updated_at.
    `do $w$ begin
  if not exists (select 1 from public.bills where id = ${lit(BILL)} and paid and updated_at > created_at) then
    raise exception 'ΡΟΗ «λογαριασμός»: η πληρωμή δεν γράφτηκε ή το updated_at δεν το έγραψε το trigger';
  end if;
  if (select amount from public.bills where id = ${lit(BILL)}) <> 90 then
    raise exception 'ΡΟΗ «μέλος»: η διόρθωση του μέλους δεν γράφτηκε ή την άλλαξε ο ξένος';
  end if;
  if (select count(*) from public.expenses where user_id = ${lit(A)} and dedup_hash = 'write-flows-bank-1') <> 1 then
    raise exception 'ΡΟΗ «τράπεζα»: η δεύτερη εισαγωγή διπλογράφει';
  end if;
  if (select count(*) from public.rent_payments where tenant_id = ${lit(TA)} and period_year = 2026 and period_month = 1 and paid) <> 1 then
    raise exception 'ΡΟΗ «είσπραξη»: ο Ιανουάριος δεν είναι μία πληρωμένη δόση';
  end if;
  if (select name from public.user_properties where id = ${lit(PB)}) <> 'Του Β' then
    raise exception 'ΔΙΑΡΡΟΗ: ο Α άλλαξε το ακίνητο του Β';
  end if;
  raise notice 'write-flow: τα αποτελέσματα στη βάση είναι αυτά που περιμένει η οθόνη';
end $w$;`,
  ];
  process.stdout.write(out.join('\n') + '\n');
}

void main().catch(e => { console.error(String(e)); process.exit(1); });
