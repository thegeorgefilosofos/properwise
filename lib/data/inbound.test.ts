// npx tsx lib/data/inbound.test.ts
//
// Η ΚΑΤΑΧΩΡΗΣΗ ΑΝΑΙΡΕΙΤΑΙ (αξιολόγηση σχεδίασης 3). Με την «Καταχώρηση όλων»
// τέσσερις λογαριασμοί γίνονται δαπάνες με ένα πάτημα· ένα λάθος πάτημα πρέπει
// να γυρίζει πίσω με ένα ακόμη, χωρίς να μείνει δαπάνη ή να χαθεί εισερχόμενο.
import { unfile } from './inbound';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

type Row = Record<string, unknown> & { id: string };
function fakeDb(tables: Record<string, Row[]>, failOn?: { table: string; op: 'update' | 'delete' }) {
  const from = (name: string) => {
    let op: 'update' | 'delete' | 'select' = 'select';
    let patch: Record<string, unknown> = {};
    const filters: ((r: Row) => boolean)[] = [];
    const run = () => {
      if (failOn && failOn.table === name && failOn.op === op) return { data: null, error: { message: 'δίκτυο' } };
      const t = tables[name] ?? [];
      const hit = t.filter(r => filters.every(f => f(r)));
      if (op === 'update') hit.forEach(r => Object.assign(r, patch));
      if (op === 'delete') hit.forEach(r => t.splice(t.indexOf(r), 1));
      return { data: null, error: null };
    };
    const q = {
      update(p: Record<string, unknown>) { op = 'update'; patch = p; return q; },
      delete() { op = 'delete'; return q; },
      eq(c: string, v: unknown) { filters.push(r => r[c] === v); return q; },
      in(c: string, v: unknown[]) { filters.push(r => v.includes(r[c])); return q; },
      then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) { return Promise.resolve(run()).then(res, rej); },
    };
    return q;
  };
  return { from } as never;
}

async function main() {
  {
    const tables = {
      inbound_messages: [{ id: 'm1', status: 'filed', expense_id: 'x1' }, { id: 'm2', status: 'filed', expense_id: 'x2' }],
      expenses: [{ id: 'x1' }, { id: 'x2' }],
    };
    const { error } = await unfile(fakeDb(tables), 'm1', 'x1');
    ok('χωρίς σφάλμα', error === null);
    ok('το εισερχόμενο γυρίζει στην ουρά', tables.inbound_messages[0].status === 'pending' && tables.inbound_messages[0].expense_id === null);
    ok('η δαπάνη σβήνεται', !tables.expenses.some(x => x.id === 'x1'));
    ok('οι άλλες μένουν', tables.expenses.some(x => x.id === 'x2') && tables.inbound_messages[1].status === 'filed');
  }
  {
    const tables = { inbound_messages: [{ id: 'm1', status: 'filed', expense_id: 'x1' }], expenses: [{ id: 'x1' }] };
    const { error } = await unfile(fakeDb(tables, { table: 'inbound_messages', op: 'update' }), 'm1', 'x1');
    ok('αποτυχία στο εισερχόμενο: λέγεται', error !== null);
    ok('αποτυχία στο εισερχόμενο: η δαπάνη μένει', tables.expenses.length === 1);
  }
  {
    const tables = { inbound_messages: [{ id: 'm1', status: 'filed', expense_id: 'x1' }], expenses: [{ id: 'x1' }] };
    const { error } = await unfile(fakeDb(tables, { table: 'expenses', op: 'delete' }), 'm1', 'x1');
    ok('αποτυχία στη δαπάνη: λέγεται', error !== null);
    ok('αποτυχία στη δαπάνη: το εισερχόμενο ξανακλείνει, καμία διπλή', tables.inbound_messages[0].status === 'filed' && tables.inbound_messages[0].expense_id === 'x1');
  }
}

main().then(() => {
  console.log(`data/inbound.test.ts: ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
});
