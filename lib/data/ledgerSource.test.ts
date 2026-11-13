// npx tsx lib/data/ledgerSource.test.ts
//
// ΤΑ ΤΣΙΠ ΜΕΤΡΟΥΝ ΤΗΝ ΙΔΙΑ ΛΙΣΤΑ ΠΟΥ ΑΝΟΙΓΟΥΝ (ανασκόπηση PR 576, εύρημα 2).
// Ο Προϋπολογισμός μετρούσε «2 εκκρεμούν» από δαπάνες δώδεκα μηνών, μαζί με
// τα έξοδα ενοικιαστή και χωρίς φίλτρο χρήστη· οι Δαπάνες έδειχναν όλο το
// ιστορικό, χωρίς τα έξοδα ενοικιαστή, μόνο του χρήστη. Μία ανάγνωση, ένας
// ορισμός: `ledgerSource`.
import { readFileSync } from 'node:fs';
import { makeFakeDb, type DbCall } from '../../scripts/e2e-money/fakeDb';
import * as mod from './ledgerSource';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

const ledgerSource = (mod as Record<string, unknown>).ledgerSource as
  ((db: unknown, p: string, u: string) => Promise<{ bills: unknown[]; expenses: unknown[]; error: unknown }>) | undefined;

(async () => {
  ok('υπάρχει κοινή ανάγνωση', typeof ledgerSource === 'function');
  if (ledgerSource) {
    const calls: DbCall[] = [];
    const { db } = makeFakeDb(c => { calls.push(c); return { data: [], error: null }; });
    await ledgerSource(db, 'p0', 'u1');
    const exp = calls.find(c => c.table === 'expenses');
    const bill = calls.find(c => c.table === 'bills');
    const has = (c: DbCall | undefined, m: string, col: string, v?: unknown) => !!c && c.filters.some(f => f[0] === m && f[1] === col && (v === undefined || f[2] === v));
    ok('δαπάνες: χωρίς τα έξοδα ενοικιαστή', has(exp, 'neq', 'category', 'tenant_extra'));
    ok('δαπάνες: μόνο του χρήστη', has(exp, 'eq', 'user_id', 'u1'));
    ok('δαπάνες: όλο το ιστορικό', !has(exp, 'gte', 'date'));
    ok('λογαριασμοί: μόνο του χρήστη', has(bill, 'eq', 'user_id', 'u1'));
    ok('λογαριασμοί: όλο το ιστορικό', !has(bill, 'gte', 'created_at'));
    const { db: bad } = makeFakeDb(c => (c.table === 'expenses' ? { data: null, error: { message: 'x' } } : undefined));
    ok('το σφάλμα φαίνεται', (await ledgerSource(bad, 'p0', 'u1')).error != null);
  }
  const read = (f: string) => readFileSync(f, 'utf8');
  ok('οι Δαπάνες διαβάζουν από την κοινή ανάγνωση', read('app/dashboard/components/ExpenseLedger.tsx').includes('ledgerSource('));
  ok('ο Προϋπολογισμός μετρά τα τσιπ από την κοινή ανάγνωση', read('app/dashboard/components/budget/useBudget.ts').includes('ledgerSource('));
  console.log(`ledgerSource: ${pass} πέρασαν, ${fail} απέτυχαν`);
  if (fail) process.exit(1);
})();
