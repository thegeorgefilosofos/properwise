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
import { instalmentRows } from '@/app/dashboard/components/rentInstalments';
import type { Tenant } from '@/app/dashboard/components/TabTenantTypes';

type Row = Record<string, unknown>;
interface Write {
  label: string;
  expect: 'ok' | 'deny';
  table: string;
  op: 'insert' | 'upsert' | 'update';
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

const writes: Write[] = [];
let current: Pick<Write, 'label' | 'expect'> = { label: '', expect: 'ok' };

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

async function flow(label: string, fn: () => PromiseLike<unknown>, expect: 'ok' | 'deny' = 'ok') {
  current = { label, expect };
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

function statement(w: Write): string {
  const t = `public.${ident(w.table)}`;
  if (w.op === 'update') {
    const cols = Object.keys(w.rows[0]).map(ident);
    const where = w.where.map(([k, v]) => `t.${ident(k)} = ${lit(v)}`).join(' and ') || 'true';
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
  if (w.expect === 'ok') {
    return `do $w$ declare n int; begin
  ${s};
  get diagnostics n = row_count;
  if n = 0 and '${w.op}' = 'update' then raise exception 'ΡΟΗ «${name}»: η ενημέρωση δεν βρήκε γραμμή'; end if;
  raise notice 'write-flow: ${name} (% γραμμές)', n;
exception when others then
  if sqlerrm like 'ΡΟΗ «%' then raise; end if;
  raise exception 'ΡΟΗ «${name}» δεν γράφεται: % [%]', sqlerrm, sqlstate;
end $w$;`;
  }
  return `do $w$ declare n int; begin
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
    'set role authenticated;',
    `set session "probe.uid" = ${lit(A)};`,
    ...writes.map(block),
    'reset role;',
    // Τα triggers της ενημέρωσης: ο λογαριασμός που πληρώθηκε έχει νέο updated_at.
    `do $w$ begin
  if not exists (select 1 from public.bills where id = ${lit(BILL)} and paid and updated_at > created_at) then
    raise exception 'ΡΟΗ «λογαριασμός»: η πληρωμή δεν γράφτηκε ή το updated_at δεν το έγραψε το trigger';
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
