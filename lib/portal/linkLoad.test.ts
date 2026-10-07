// npx tsx lib/portal/linkLoad.test.ts
//
// ΤΙ ΦΥΛΑΓΕΤΑΙ. Οι τρεις σελίδες με κουπόνι (πύλη ενοικιαστή, στοιχεία
// διαμονής, πύλη λογιστή) ξεχωρίζουν «δεν βρέθηκε» από «δεν απάντησε» και
// στο δεύτερο δεν βεβαιώνουν τίποτα για τον σύνδεσμο. Ελέγχει και ότι κάθε
// σελίδα χρησιμοποιεί τα κοινά λόγια και έχει κουμπί που ξαναρωτά.
import { readFileSync } from 'node:fs'
import { linkLoad, LINK_SAY } from './linkLoad'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

// ── 1. Η ΑΠΑΝΤΗΣΗ ───────────────────────────────────────────────────────────
ok('δεδομένα: ισχύει', linkLoad({ data: { property: {} }, error: null }) === 'ok')
ok('κενό: δεν βρέθηκε', linkLoad({ data: null, error: null }) === 'notfound')
ok('σφάλμα: δεν ξέρουμε', linkLoad({ data: null, error: { message: 'TypeError: Failed to fetch' } }) === 'offline')
ok('σφάλμα με δεδομένα: πάλι δεν ξέρουμε', linkLoad({ data: { x: 1 }, error: { message: 'x' } }) === 'offline')
const metaFound = (d: unknown) => !!(d as { found?: boolean } | null)?.found
ok('portal_meta found:false: δεν βρέθηκε', linkLoad({ data: { found: false }, error: null }, metaFound) === 'notfound')
ok('portal_meta found:true: ισχύει', linkLoad({ data: { found: true }, error: null }, metaFound) === 'ok')

// ── 2. ΤΑ ΛΟΓΙΑ ─────────────────────────────────────────────────────────────
const words = Object.values(LINK_SAY).join(' ')
ok('καμία διαβεβαίωση ότι ο σύνδεσμος είναι εντάξει', !/εντάξει|δεν έχει πρόβλημα|είναι μια χαρά/u.test(words))
ok('το σφάλμα δεν ζητά νέο σύνδεσμο', !/νέο σύνδεσμο|ενημερωμένο/u.test(LINK_SAY.offlineBody))
for (const [k, v] of Object.entries(LINK_SAY)) {
  ok(`${k}: χωρίς «&», «→» ή κόμμα πριν από «και»`, !/[&→]|,\s*(και|κι)(?!\p{L})/u.test(v))
}

// ── 3. ΟΙ ΤΡΕΙΣ ΣΕΛΙΔΕΣ ─────────────────────────────────────────────────────
for (const page of ['app/portal/[token]/page.tsx', 'app/checkin/[token]/page.tsx', 'app/accountant/[token]/page.tsx']) {
  const src = readFileSync(page, 'utf8')
  ok(`${page}: δεν λέει ότι ο σύνδεσμος είναι εντάξει`, !/σύνδεσμός σου είναι εντάξει|σύνδεσμος δεν έχει πρόβλημα/u.test(src))
  ok(`${page}: κοινά λόγια σφάλματος`, src.includes('LINK_SAY.offlineBody') && src.includes('LINK_SAY.notFoundTitle'))
  ok(`${page}: κουμπί που ξαναρωτά`, /onClick=\{\(\) => setTries\(t => t \+ 1\)\}>\{LINK_SAY\.retry\}/.test(src))
}

console.log(`linkLoad: ✓ ${pass} · ✗ ${fail}`)
if (fail) process.exit(1)
