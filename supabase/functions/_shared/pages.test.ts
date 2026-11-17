// Τρέξε: npx tsx supabase/functions/_shared/pages.test.ts
import { allPages, PAGE_SIZE } from './pages.ts'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) { if (cond) passed++; else { failed++; console.log('  ✗ ' + name) } }

// Ψεύτικος διακομιστής: 2.500 γραμμές, κόβει ΠΑΝΤΑ στις 1.000 όπως το PostgREST.
const ALL = Array.from({ length: 2500 }, (_, i) => ({ id: i }))
const calls: [number, number][] = []
const server = (from: number, to: number) => {
  calls.push([from, to])
  const end = Math.min(to + 1, from + 1000)
  return Promise.resolve({ data: ALL.slice(from, end), error: null })
}

void (async () => {
const r = await allPages(server)
ok('διαβάζει και τις 2.500', r.rows.length === 2500 && r.error === null)
ok('καμία διπλή ή χαμένη γραμμή', new Set(r.rows.map(x => x.id)).size === 2500 && r.rows[2499].id === 2499)
ok('σελίδες μικρότερες από το όριο του διακομιστή', PAGE_SIZE < 1000 && calls.every(([f, t]) => t - f + 1 === PAGE_SIZE))

// Ακριβές πολλαπλάσιο: μία ακόμη άδεια σελίδα και τέλος.
const exact = Array.from({ length: PAGE_SIZE * 2 }, (_, i) => i)
const r2 = await allPages((f, t) => Promise.resolve({ data: exact.slice(f, t + 1), error: null }))
ok('ακριβές πολλαπλάσιο της σελίδας', r2.rows.length === PAGE_SIZE * 2)

// Σφάλμα στη δεύτερη σελίδα: σταματά και το λέει.
let n = 0
const r3 = await allPages((f, t) => Promise.resolve(++n === 2 ? { data: null, error: { message: 'boom' } } : { data: ALL.slice(f, t + 1), error: null }))
ok('το σφάλμα δεν κρύβεται', r3.error?.message === 'boom' && r3.rows.length === PAGE_SIZE)

console.log(`pages: ${passed} πέρασαν, ${failed} απέτυχαν`)
if (failed) process.exit(1)
})()
