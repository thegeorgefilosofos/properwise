// npx tsx lib/home/markDone.test.ts
//
// «ΠΛΗΡΩΘΗΚΕ» ΑΠΟ ΤΗ ΓΡΑΜΜΗ ΤΗΣ ΕΚΚΡΕΜΟΤΗΤΑΣ, ΜΕ ΑΝΑΙΡΕΣΗ (αξιολόγηση σχεδίασης 3).
// Η δόση ΕΝΦΙΑ ήθελε τρία πατήματα: γραμμή, εύρεση στο Ημερολόγιο, «Ολοκλήρωση».
// Τώρα ένα. Η προθεσμία κλείνει εκεί που την κλείνει και το Ημερολόγιο: στο
// `calendar_events.status` της πηγής της (lib/facts/deadlines, `closedTaxRefs`).
import { markDone } from './markDone';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

type Row = Record<string, unknown> & { id: string };
/** Ψεύτικη βάση ενός πίνακα: φίλτρα eq/in, select, update, insert, delete. */
function fakeDb(seed: Row[], fail?: 'read' | 'write') {
  const table = seed.map(r => ({ ...r }));
  let seq = 0;
  const builder = () => {
    let op: 'select' | 'update' | 'insert' | 'delete' = 'select';
    let patch: Record<string, unknown> = {};
    let ins: Record<string, unknown> | null = null;
    const filters: ((r: Row) => boolean)[] = [];
    let one = false;
    const run = () => {
      if (fail === 'read' && op === 'select' && !ins) return { data: null, error: { message: 'δίκτυο' } };
      if (fail === 'write' && op !== 'select') return { data: null, error: { message: 'δίκτυο' } };
      if (op === 'insert' && ins) {
        const r = { ...ins, id: `new${++seq}` } as Row; table.push(r);
        return { data: one ? { id: r.id } : [r], error: null };
      }
      const hit = table.filter(r => filters.every(f => f(r)));
      if (op === 'update') { hit.forEach(r => Object.assign(r, patch)); return { data: null, error: null }; }
      if (op === 'delete') { hit.forEach(r => table.splice(table.indexOf(r), 1)); return { data: null, error: null }; }
      return { data: one ? (hit[0] ?? null) : hit, error: null };
    };
    const q = {
      select() { return q; },
      eq(c: string, v: unknown) { filters.push(r => r[c] === v); return q; },
      in(c: string, v: unknown[]) { filters.push(r => v.includes(r[c])); return q; },
      update(p: Record<string, unknown>) { op = 'update'; patch = p; return q; },
      insert(r: Record<string, unknown>) { op = 'insert'; ins = r; return q; },
      delete() { op = 'delete'; return q; },
      maybeSingle() { one = true; return q; },
      single() { one = true; return q; },
      then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) { return Promise.resolve(run()).then(res, rej); },
    };
    return q;
  };
  return { db: { from: () => builder() } as never, table };
}

const scope = { propertyId: 'p1', userId: 'u1' };
const target = { source: 'tax:enfia-instalment-2026-11', title: 'ΕΝΦΙΑ, 9η δόση', date: '2026-11-30' };

async function main() {
  // ── Υπάρχει γεγονός στο Ημερολόγιο: κλείνει, η αναίρεση το ανοίγει ─────────
  {
    const { db, table } = fakeDb([{ id: 'e1', property_id: 'p1', source: target.source, status: 'pending' }]);
    const r = await markDone(db, scope, target);
    ok('χωρίς σφάλμα', r.error === null);
    ok('το γεγονός κλείνει', table[0].status === 'paid');
    ok('υπάρχει αναίρεση', typeof r.undo === 'function');
    const u = await r.undo!();
    ok('η αναίρεση χωρίς σφάλμα', u.error === null);
    ok('η αναίρεση το ξανανοίγει', table[0].status === 'pending');
    ok('καμία νέα γραμμή', table.length === 1);
  }

  // ── Δεν υπάρχει γεγονός: γράφεται κλειστό, η αναίρεση το σβήνει ───────────
  {
    const { db, table } = fakeDb([{ id: 'x', property_id: 'p2', source: target.source, status: 'pending' }]);
    const r = await markDone(db, scope, target);
    ok('χωρίς σφάλμα όταν λείπει', r.error === null);
    const mine = table.filter(x => x.property_id === 'p1');
    ok('γράφεται μία γραμμή για αυτό το ακίνητο', mine.length === 1);
    ok('κλειστή, με την πηγή της', mine[0]?.status === 'paid' && mine[0]?.source === target.source);
    ok('με την ημερομηνία της προθεσμίας', mine[0]?.event_date === target.date);
    ok('το άλλο ακίνητο μένει ανέγγιχτο', table.find(x => x.id === 'x')?.status === 'pending');
    await r.undo!();
    ok('η αναίρεση σβήνει ό,τι γράφτηκε', table.filter(x => x.property_id === 'p1').length === 0);
  }

  // ── Σφάλμα δικτύου: λέγεται, τίποτα δεν αλλάζει ───────────────────────────
  {
    const { db, table } = fakeDb([{ id: 'e1', property_id: 'p1', source: target.source, status: 'pending' }], 'read');
    const r = await markDone(db, scope, target);
    ok('η αποτυχία ανάγνωσης φτάνει στον καλούντα', r.error !== null && r.undo === null);
    ok('τίποτα δεν γράφεται χωρίς ανάγνωση', table[0].status === 'pending' && table.length === 1);
  }
  {
    const { db, table } = fakeDb([{ id: 'e1', property_id: 'p1', source: target.source, status: 'pending' }], 'write');
    const r = await markDone(db, scope, target);
    ok('η αποτυχία εγγραφής φτάνει στον καλούντα', r.error !== null && r.undo === null);
    ok('η κατάσταση μένει ανοιχτή', table[0].status === 'pending');
  }

  // ── Ήδη κλειστό: τίποτα να γίνει, τίποτα να αναιρεθεί ─────────────────────
  {
    const { db, table } = fakeDb([{ id: 'e1', property_id: 'p1', source: target.source, status: 'paid' }]);
    const r = await markDone(db, scope, target);
    ok('ήδη κλειστό: χωρίς σφάλμα', r.error === null);
    ok('ήδη κλειστό: η αναίρεση δεν ανοίγει κάτι που έκλεισε αλλού', r.undo === null && table[0].status === 'paid');
  }

  // ── Χωρίς ημερομηνία δεν γράφεται γεγονός-φάντασμα ────────────────────────
  {
    const { db, table } = fakeDb([]);
    const r = await markDone(db, scope, { ...target, date: null });
    ok('χωρίς ημερομηνία και χωρίς γεγονός: σφάλμα, όχι γραμμή', r.error !== null && table.length === 0);
  }
}

main().then(() => {
  console.log(`home/markDone.test.ts: ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
});
