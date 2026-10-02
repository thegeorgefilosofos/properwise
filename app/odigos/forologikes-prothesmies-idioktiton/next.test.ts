// ═══════════════════════════════════════════════════════════════════════════
// Ο ΟΔΗΓΟΣ ΠΡΟΘΕΣΜΙΩΝ ΧΤΙΖΕΤΑΙ ΚΑΘΕ ΜΕΡΑ (02.10.2026).
//
// Πριν: στις 27 και 28.2.2027, 16 και 17.7.2027, 16 και 17.3.2030, 30 και
// 31.3.2030 ένα είδος έπεφτε λίγες μέρες έξω από το δωδεκάμηνο, η αναζήτηση
// πετούσε σφάλμα και η ανακατασκευή της σελίδας αποτύγχανε. Εδώ ελέγχεται κάθε
// μέρα από το 2026 ως το 2031.
//
// Τρέξε: npx tsx app/odigos/forologikes-prothesmies-idioktiton/next.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { upcomingRows, nextOfKind } from './next'
import { greekPropertyTaxObligations, type TaxObligation } from '@/lib/tax/greekTaxCalendar'

let passed = 0, failed = 0
const fails: string[] = []
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; if (fails.length < 40) fails.push(name) } }

const KINDS: TaxObligation['kind'][] = ['enfia-issue', 'enfia-first', 'enfia-last', 'e9', 'income-autofile', 'income-decl']
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)

let days = 0, missingInRows = 0, threw = 0, tripled = 0
for (let t = Date.UTC(2026, 0, 1); t <= Date.UTC(2031, 11, 31); t += 86400000) {
  const today = iso(t)
  days++
  try {
    const rows = upcomingRows(today)
    for (const k of KINDS) {
      const o = nextOfKind(rows, k, today)
      if (!o || o.kind !== k || o.date < today) { ok(`${today} ${k}: επόμενη εμφάνιση`, false); continue }
      if (!rows.includes(o)) missingInRows++
    }
    const first = nextOfKind(rows, 'enfia-first', today)
    const last = nextOfKind(greekPropertyTaxObligations(Number(first.date.slice(0, 4)), 'owner'), 'enfia-last', first.date)
    if (!last || last.date <= first.date) ok(`${today}: τελευταία δόση μετά την πρώτη`, false)
    if (rows.some(r => r.date < today)) ok(`${today}: καμία περασμένη γραμμή`, false)
    const seen = new Map<string, number>()
    for (const r of rows) seen.set(r.kind, (seen.get(r.kind) ?? 0) + 1)
    if ([...seen.values()].some(n => n > 2)) tripled++
  } catch (e) {
    threw++
    ok(`${today}: πέταξε ${(e as Error).message}`, false)
  }
}
ok(`έλεγχος ${days} ημερών`, days > 2000)
ok('καμία μέρα δεν πετάει', threw === 0)
ok(`κάθε είδος βρίσκεται μέσα στον πίνακα (λείπει ${missingInRows})`, missingInRows === 0)
ok('κανένα είδος τρεις φορές', tripled === 0)

// Οι συγκεκριμένες μέρες που έριχναν τη σελίδα.
for (const d of ['2027-02-27', '2027-02-28', '2027-07-16', '2027-07-17', '2030-03-16', '2030-03-17', '2030-03-30', '2030-03-31']) {
  const rows = upcomingRows(d)
  ok(`${d}: όλα τα είδη στον πίνακα`, KINDS.every(k => rows.some(r => r.kind === k)))
}

// Το περιθώριο δεν διπλασιάζει είδος που υπάρχει ήδη στο δωδεκάμηνο.
{
  const rows = upcomingRows('2026-10-02')
  const n = (k: string) => rows.filter(r => r.kind === k).length
  ok('2.10.2026: ένα Ε9', n('e9') === 1)
  ok('2.10.2026: μία δήλωση εισοδήματος', n('income-decl') === 1)
}

console.log(`\nnext.ts — ${passed} passed, ${failed} failed (σύνολο ${passed + failed})`)
if (failed) { console.log('FAILED:\n' + fails.map(f => '  ✗ ' + f).join('\n')); process.exit(1) }
console.log('όλα πέρασαν')
