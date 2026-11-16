// Τρέξε: npx tsx lib/data/readAll.test.ts
// Το όριο των 1.000 γραμμών του PostgREST δεν κόβει πια σιωπηλά αθροίσματα
// (καθολικό δαπανών) ούτε λίστες αποστολής (συσκευές ειδοποιήσεων).
import { readFileSync } from 'node:fs';
import { readAll, PAGE_SIZE } from './read';

let passed = 0, failed = 0;
function ok(name: string, cond: boolean) { if (cond) passed++; else { failed++; console.log('  ✗ ' + name); } }

// Ψεύτικος PostgREST: 2.500 γραμμές, κόβει πάντα στις 1.000.
const ALL = Array.from({ length: 2500 }, (_, i) => ({ id: i, amount: 1 }));
const server = (from: number, to: number) =>
  Promise.resolve({ data: ALL.slice(from, Math.min(to + 1, from + 1000)), error: null });

void (async () => {
  const r = await readAll<{ id: number; amount: number }>(server);
  ok('όλες οι 2.500 γραμμές', r.rows.length === 2500 && r.error === null);
  ok('το άθροισμα δεν κόβεται', r.rows.reduce((s, x) => s + x.amount, 0) === 2500);
  ok('καμία διπλή', new Set(r.rows.map(x => x.id)).size === 2500);
  ok('σελίδα κάτω από το όριο του διακομιστή', PAGE_SIZE < 1000);

  let n = 0;
  const r2 = await readAll<{ id: number }>((f, t) => Promise.resolve(++n === 3
    ? { data: null, error: { message: 'boom' } as never } : { data: ALL.slice(f, t + 1), error: null }));
  ok('το σφάλμα μένει ορατό', r2.error?.message === 'boom' && r2.rows.length === 2 * PAGE_SIZE);

  // Οι δύο αναγνώσεις «όλων» περνούν πλέον από τις σελίδες.
  const exp = readFileSync('lib/data/expenses.ts', 'utf8');
  ok('το καθολικό διαβάζεται σε σελίδες όταν δεν ζητήθηκε όριο',
    /if \(opts\.limit\) return read<T>\(ledgerQuery/.test(exp) && /return readAll<T>\(\(from, to\) => ledgerQuery\(db, propertyId, opts\)\.order\('id', \{ ascending: true \}\)\.range\(from, to\)\)/.test(exp));
  const push = readFileSync('lib/data/pushSubscriptions.ts', 'utf8');
  ok('οι συσκευές διαβάζονται σε σελίδες', push.includes("readAll<SendRow>((from, to) => db.from(TABLE).select(SEND_COLUMNS).order('user_id').order('id').range(from, to))"));

  console.log(`readAll: ${passed} πέρασαν, ${failed} απέτυχαν`);
  if (failed) process.exit(1);
})();
