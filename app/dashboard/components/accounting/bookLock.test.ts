// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΚΛΕΙΔΩΜΑ ΤΗΣ ΧΡΗΣΗΣ ΔΕΝ ΧΑΝΕΤΑΙ (02.10.2026).
//
// Πριν: η διαγραφή του παλιού κλειδώματος δεν ελεγχόταν και, αν η εισαγωγή του
// νέου αποτύγχανε, το παλιό είχε ήδη σβηστεί. Εδώ μια ψεύτικη βάση με τις ίδιες
// δύο πράξεις δείχνει τι μένει σε κάθε αποτυχία.
//
// Τρέξε: npx tsx app/dashboard/components/accounting/bookLock.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { relockYear, type BookLock } from './bookLock'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

type S = { sig: string }
function fakeDb(start: BookLock<S> | null, fails: { remove?: boolean; insert?: number[] }) {
  let rows: BookLock<S>[] = start ? [start] : []
  let inserts = 0
  return {
    get rows() { return rows },
    io: {
      remove: async () => {
        if (fails.remove) return { error: new Error('delete') }
        rows = []
        return { error: null }
      },
      insert: async (l: BookLock<S>) => {
        inserts++
        if (fails.insert?.includes(inserts)) return { error: new Error('insert') }
        rows.push(l)
        return { error: null }
      },
    },
  }
}

const OLD: BookLock<S> = { snapshot: { sig: 'old' }, locked_at: '2026-09-01T10:00:00Z' }
const NEW: BookLock<S> = { snapshot: { sig: 'new' }, locked_at: '2026-10-02T10:00:00Z' }

;(async () => {
  {
    const db = fakeDb(OLD, {})
    const r = await relockYear(db.io, NEW, OLD)
    ok('επιτυχία: το νέο κλείδωμα', r.error === null && r.closing === NEW && db.rows.length === 1 && db.rows[0] === NEW)
  }
  {
    const db = fakeDb(OLD, { remove: true })
    const r = await relockYear(db.io, NEW, OLD)
    ok('αποτυχία διαγραφής: σφάλμα και καμία εισαγωγή', !!r.error && r.closing === OLD && db.rows.length === 1 && db.rows[0] === OLD)
  }
  {
    const db = fakeDb(OLD, { insert: [1] })
    const r = await relockYear(db.io, NEW, OLD)
    ok('αποτυχία εισαγωγής: το παλιό ξαναγράφεται', !!r.error && r.closing === OLD && !r.lost && db.rows.length === 1 && db.rows[0] === OLD)
  }
  {
    const db = fakeDb(OLD, { insert: [1, 2] })
    const r = await relockYear(db.io, NEW, OLD)
    ok('αποτυχία και της επαναφοράς: η οθόνη λέει ανοιχτή και το λέει', !!r.error && r.closing === null && r.lost && db.rows.length === 0)
  }
  {
    const db = fakeDb(null, { insert: [1] })
    const r = await relockYear(db.io, NEW, null)
    ok('πρώτο κλείδωμα που αποτυγχάνει: ανοιχτή χρήση', !!r.error && r.closing === null && !r.lost && db.rows.length === 0)
  }
  console.log(`\nbookLock.ts — ${pass} passed, ${fail} failed`)
  if (fail) process.exit(1)
})()
