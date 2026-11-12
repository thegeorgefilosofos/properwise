// Τεστ για τον έλεγχο διπλών της τραπεζικής εισαγωγής (lib/accounting/bankImport.ts).
//
// ΤΟ ΟΡΙΟ ΤΩΝ 1.000 ΓΡΑΜΜΩΝ. Η οθόνη διάβαζε όλα τα αποτυπώματα του χρήστη με
// ένα ερώτημα και το PostgREST έκοβε την απάντηση στις 1.000: οι παλιότερες
// κινήσεις ξαναγύριζαν για έλεγχο ως καινούργιες. Η ψεύτικη βάση εδώ κόβει
// όπως το PostgREST και κρατά μετρητή αιτημάτων. Τα δεδομένα είναι συνθετικά.
import { parseBankCsv, legacyKeyOf, findKnownKeys, dedupKeyChunks, type BankTxn } from './bankImport'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) { if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) } }

const CAP = 1000
const header = 'Ημερομηνία;Περιγραφή;Ποσό;Υπόλοιπο'
const lineOf = (i: number) => {
  const d = new Date(Date.UTC(2024, 0, 1) + i * 86400000)
  const dd = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
  return `${dd};Κίνηση δοκιμής ${i};-${(i % 97) + 1},00;${10000 - i},00`
}

// 1.500 κινήσεις έχουν ήδη εισαχθεί. Η βάση έχει τα αποτυπώματά τους.
const all = parseBankCsv([header, ...Array.from({ length: 1500 }, (_, i) => lineOf(i))].join('\n'))
const db: string[] = all.map(t => t.key)
const fakeLookup = (calls: string[][]) => (keys: string[]) => {
  calls.push(keys)
  const want = new Set(keys)
  return Promise.resolve({ data: db.filter(h => want.has(h)).slice(0, CAP).map(dedup_hash => ({ dedup_hash })), error: null })
}

;(async () => {
  // ── Το ίδιο αρχείο ξαναφορτώνεται: ΟΛΕΣ είναι γνωστές ακόμη και μετά τη χιλιοστή ──
  {
    const calls: string[][] = []
    const { seen, error } = await findKnownKeys(all, fakeLookup(calls))
    ok('χωρίς σφάλμα', error === null)
    ok('όλες οι 1.500 αναγνωρίζονται', all.every(t => seen.has(t.key)))
    ok('και η κίνηση 1.400 (μετά το όριο των 1.000)', seen.has(all[1399].key))
    ok('καμία ομάδα πάνω από 200 κλειδιά', calls.every(c => c.length <= 200))
    ok('ρωτήθηκε κάθε αποτύπωμα του αρχείου', all.every(t => calls.some(c => c.includes(t.key))))
  }
  // ── Η παλιά πλήρης ανάγνωση με το όριο έχανε τις παλιότερες ──────────────────
  {
    const capped = new Set(db.slice(0, CAP))
    ok('(η παλιά ανάγνωση έχανε 500 κινήσεις)', all.filter(t => !capped.has(t.key)).length === 500)
  }
  // ── Το παλιό αποτύπωμα ρωτιέται κι αυτό ─────────────────────────────────────
  {
    const t = parseBankCsv('Ημερομηνία;Περιγραφή;Ποσό\n05/03/2026;Ενοίκιο Μαρτίου;800,00')
    const legacy = legacyKeyOf(t[0])
    const { seen } = await findKnownKeys(t, keys => Promise.resolve({ data: keys.includes(legacy) ? [{ dedup_hash: legacy }] : [], error: null }))
    ok('το παλιό κλειδί βρίσκεται', seen.has(legacy))
  }
  // ── Μακριά ελληνικά κλειδιά: η ομάδα μικραίνει για να χωρά στο URL ───────────
  {
    const long: BankTxn[] = Array.from({ length: 300 }, (_, i) => ({ date: '2026-03-05', description: 'Περιγραφή '.repeat(15) + i, amount: -10, raw: '', key: `v2|k${i}` }))
    const chunks = dedupKeyChunks(long)
    ok('όλα τα κλειδιά μπαίνουν σε ομάδα', chunks.flat().length === 600)
    ok('κάθε ομάδα χωρά στο όριο χαρακτήρων', chunks.every(c => c.length === 1 || c.reduce((n, k) => n + encodeURIComponent(k).length + 3, 0) <= 6000))
  }
  // ── Το σφάλμα δεν γίνεται σιωπηλά «καμία διπλή» ─────────────────────────────
  {
    const { error } = await findKnownKeys(all, () => Promise.resolve({ data: null, error: { message: 'δίκτυο' } }))
    ok('το σφάλμα επιστρέφεται', error !== null)
  }
  // ── Άδειο αρχείο: κανένα αίτημα ─────────────────────────────────────────────
  {
    const calls: string[][] = []
    await findKnownKeys([], fakeLookup(calls))
    ok('κανένα αίτημα χωρίς κινήσεις', calls.length === 0)
  }

  console.log(`bankImport (διπλές) — ${passed} passed, ${failed} failed (σύνολο ${passed + failed})`)
  if (failed > 0) { process.exit(1) }
  console.log('όλα πέρασαν')
})()
