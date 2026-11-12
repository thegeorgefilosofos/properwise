// Τεστ για τον έλεγχο διπλών της τραπεζικής εισαγωγής (lib/accounting/bankImport.ts).
//
// ΤΟ ΟΡΙΟ ΤΩΝ 1.000 ΓΡΑΜΜΩΝ. Η οθόνη διάβαζε όλα τα αποτυπώματα του χρήστη με
// ένα ερώτημα και το PostgREST έκοβε την απάντηση στις 1.000: οι παλιότερες
// κινήσεις ξαναγύριζαν για έλεγχο ως καινούργιες. Η ψεύτικη βάση εδώ κόβει
// όπως το PostgREST και κρατά μετρητή αιτημάτων. Τα δεδομένα είναι συνθετικά.
import { createClient } from '@supabase/supabase-js'
import { parseBankCsv, legacyKeyOf, findKnownKeys, dedupKeyChunks, type BankTxn } from './bankImport'

let passed = 0, failed = 0

/** Οι τιμές ενός `in.(a,"b,c")` όπως τις χωρίζει το PostgREST. */
function parseInList(v: string): string[] {
  if (!v.startsWith('in.(') || !v.endsWith(')')) return []
  const body = v.slice(4, -1), out: string[] = []
  let cur = '', quoted = false
  for (const ch of body) {
    if (ch === '"') quoted = !quoted
    else if (ch === ',' && !quoted) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}
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

  // ── Το πραγματικό URL του postgrest-js μένει μικρό ─────────────────────────
  // Ο postgrest-js βάζει εισαγωγικά σε τιμές με κόμμα ή παρένθεση και
  // κωδικοποιεί με URLSearchParams: το «(» γίνεται %28, τρεις χαρακτήρες.
  // Περιγραφές γεμάτες κόμματα και παρενθέσεις είναι η χειρότερη περίπτωση.
  {
    const urls: string[] = []
    const fakeFetch = (async (input: RequestInfo | URL) => {
      urls.push(String(input instanceof Request ? input.url : input))
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
    const db = createClient('http://localhost:54321', 'anon-key-dokimi', { global: { fetch: fakeFetch }, auth: { persistSession: false } })
    const user = '00000000-0000-4000-8000-000000000000'
    const nasty: BankTxn[] = Array.from({ length: 120 }, (_, i) => ({
      date: '2026-03-05', amount: -10, raw: '', key: `v2|k${i}`,
      description: `(${i}),`.padEnd(200, '(,) '),
    }))
    const { error } = await findKnownKeys(nasty, keys => db.from('bank_transactions').select('dedup_hash').eq('user_id', user).in('dedup_hash', keys))
    ok('postgrest-js: χωρίς σφάλμα', error === null)
    ok('postgrest-js: έγιναν αιτήματα', urls.length > 1)
    const longest = Math.max(...urls.map(u => u.length))
    ok("postgrest-js: κάθε URL κάτω από 6.000 χαρακτήρες", longest < 6000)
    // Η λίστα `in.(…)` διαβάζεται τιμή προς τιμή, με τα εισαγωγικά, όπως τη
    // διαβάζει το PostgREST: ένα κλειδί ρωτήθηκε μόνο αν βγαίνει ακέραιο.
    const asked = new Set(urls.flatMap(u => parseInList(new URL(u).searchParams.get('dedup_hash') || '')))
    ok('postgrest-js: κάθε παλιό κλειδί ρωτήθηκε ακέραιο', nasty.every(t => asked.has(legacyKeyOf(t))))
    ok('postgrest-js: κάθε νέο κλειδί ρωτήθηκε', nasty.every(t => asked.has(t.key)))
    ok('postgrest-js: τίποτα άλλο', asked.size === nasty.length * 2)
  }
  // ── Μισό ζεύγος surrogate στο κόψιμο των 200 ───────────────────────────────
  // Το `.slice(0, 200)` μπορούσε να κόψει ένα emoji στη μέση. Το μισό ζεύγος
  // ρίχνει το encodeURIComponent και η εισαγωγή σταματούσε χωρίς μήνυμα.
  {
    const head = '2026-03-05|-10|'
    const description = 'α'.repeat(200 - head.length - 1) + '🏠 ΕΝΟΙΚΙΟ'
    const t: BankTxn = { date: '2026-03-05', amount: -10, description, raw: '', key: 'v2|emoji' }
    const k = legacyKeyOf(t)
    const lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(k)
    ok('παλιό κλειδί χωρίς μισό ζεύγος', !lone)
    ok('παλιό κλειδί έως 200', k.length <= 200)
    let threw = false
    try { dedupKeyChunks([t]) } catch { threw = true }
    ok('οι ομάδες φτιάχνονται χωρίς εξαίρεση', !threw)
    // Οταν το κόψιμο δεν πέφτει σε ζεύγος, το κλειδί μένει ΙΔΙΟ με όσα έχει η βάση.
    const plain: BankTxn = { date: '2026-03-05', amount: 800, description: 'β'.repeat(300), raw: '', key: 'v2|x' }
    ok('κλειδί χωρίς emoji ίδιο με το παλιό κόψιμο', legacyKeyOf(plain) === `2026-03-05|800|${'β'.repeat(300)}`.slice(0, 200))
  }
  // ── Εξαίρεση στην αναζήτηση γίνεται σφάλμα, όχι απόρριψη ─────────────────────
  {
    let rejected = false, res: { error: unknown } | null = null
    try { res = await findKnownKeys(all.slice(0, 3), () => { throw new Error('δίκτυο') }) } catch { rejected = true }
    ok('η εξαίρεση δεν ξεφεύγει', !rejected)
    ok('η εξαίρεση επιστρέφεται ως σφάλμα', res !== null && res.error instanceof Error)
  }

  console.log(`bankImport (διπλές) — ${passed} passed, ${failed} failed (σύνολο ${passed + failed})`)
  if (failed > 0) { process.exit(1) }
  console.log('όλα πέρασαν')
})()
