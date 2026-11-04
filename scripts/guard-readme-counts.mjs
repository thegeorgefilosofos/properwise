#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ README ΔΕΝ ΓΡΑΦΕΙ ΠΛΗΘΗ ΠΟΥ ΑΛΛΑΖΟΥΝ ΜΕ ΚΑΘΕ PR
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ (04/11/2026). Το README έγραφε «130+ guard
// scripts» και «250+ suites». Την ίδια μέρα το scripts/ είχε 165 φύλακες και το
// `npm test` έτρεχε 405 σουίτες. Το κείμενο που διαβάζει πρώτο ένας ελεγκτής
// έλεγε λιγότερα από την αλήθεια και κανείς δεν το έβλεπε, γιατί κανένας
// έλεγχος δεν το διάβαζε.
//
// ΓΙΑΤΙ ΟΧΙ ΠΑΡΑΓΟΜΕΝΟ ΜΠΛΟΚ ΜΕ ΤΟΥΣ ΑΡΙΘΜΟΥΣ. Δύο παράλληλα PR που
// προσθέτουν από έναν φύλακα θα άλλαζαν την ίδια γραμμή του README. Με squash
// το δεύτερο βγαίνει με σύγκρουση και, όπως λέει το AGENTS.md, PR με σύγκρουση
// δεν τρέχει CI καθόλου. Το πλήθος το τυπώνουν ήδη το `npm run guards` και το
// `npm test`· το README λέει πού να το δεις, όχι πόσο είναι.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ, ΑΚΡΙΒΩΣ. Στο README.md της ρίζας, αριθμός (με ή χωρίς «+»)
// και ως δύο λέξεις μετά ένα από τα ουσιαστικά που μετρούν κάτι που
// μεγαλώνει: φύλακες, σουίτες, δοκιμές, υπολογιστές, οδηγοί, συσκευές,
// σαρωτές, workflows, μεταναστεύσεις, πίνακες, συναρτήσεις, σελίδες. Ελληνικά
// και αγγλικά. Αριθμοί μέσα σε διαδρομές ή εκδόσεις («Node 22») δεν πιάνονται,
// γιατί δεν ακολουθεί τέτοιο ουσιαστικό.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs'

const ARXEIO = 'README.md'
if (!existsSync(ARXEIO)) {
  console.error(`✗ Δεν βρέθηκε το ${ARXEIO}. Ο φύλακας δεν περνά πάνω σε κενό.`)
  process.exit(1)
}

const ONOMATA = [
  'guards?', 'guardrails?', 'guard scripts?', 'suites?', 'tests?', 'checks?',
  'calculators?', 'tools?', 'guides?', 'devices?', 'scanners?', 'workflows?',
  'migrations?', 'tables?', 'functions?', 'pages?', 'mutations?',
  'φύλακ\\p{L}*', 'σουίτ\\p{L}*', 'δοκιμ\\p{L}*', 'υπολογιστ\\p{L}*',
  'εργαλεί\\p{L}*', 'οδηγ\\p{L}*', 'συσκευ\\p{L}*', 'σαρωτ\\p{L}*',
  'μεταναστεύσ\\p{L}*', 'πίνακ\\p{L}*', 'συναρτήσ\\p{L}*', 'σελίδ\\p{L}*',
]
const PLITHOS = new RegExp(
  `(?<![\\p{L}\\d./_-])\\d[\\d.,]*\\+?\\s+(?:[\\p{L}-]+\\s+){0,2}(?:${ONOMATA.join('|')})(?![\\p{L}])`,
  'giu',
)

const provlimata = []
readFileSync(ARXEIO, 'utf8').split('\n').forEach((line, i) => {
  for (const m of line.matchAll(PLITHOS)) provlimata.push({ grammi: i + 1, ti: m[0] })
})

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} πλήθη γραμμένα με το χέρι στο ${ARXEIO}:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${ARXEIO}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error(`\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: γράψε τι κάνουν και πού φαίνεται το πλήθος (\`npm run guards\`,`)
  console.error(`  \`npm test\`, lib/core/publicTools.ts), όχι τον αριθμό. Θα γεράσει με το επόμενο PR.\n`)
  process.exit(1)
}
console.log(`✓ Κανένα πλήθος που γερνά στο ${ARXEIO}`)
