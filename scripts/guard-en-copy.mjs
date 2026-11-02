#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΑΓΓΛΙΚΟ ΚΕΙΜΕΝΟ ΕΙΝΑΙ ΑΓΓΛΙΚΟ, ΔΕΝ ΛΕΕΙ «FREE» ΔΙΠΛΑ ΣΕ ΤΙΜΗ ΚΑΙ Η ΝΟΑ ΔΕΝ ΕΧΕΙ ΦΥΛΟ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ. Οι φύλακες του αποθετηρίου κρατούν τους κανόνες ύφους στα
// ΕΛΛΗΝΙΚΑ: «δωρεάν» δίπλα σε πακέτο, «βοηθός» για τη Νόα. Η αγγλική βιτρίνα
// (02.11.2026) είναι τυφλό σημείο τους — στο πρώτο πέρασμα το κουμπί του
// πακέτου χωρίς συνδρομή γράφτηκε «Start free», δίπλα σε τιμή 0€, ακριβώς η
// υπόσχεση που ο ελληνικός κανόνας απαγορεύει. Και ένα ελληνικό «ή» ξέμεινε
// μέσα σε αγγλική φράση τιμής, ορατό μόνο στον αναγνώστη που δεν το διαβάζει.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ. Τα αγγλικά λεξικά (lib/i18n/en/**) και οι αγγλικές σελίδες
// (app/en/**, app/og/shareEn.ts), χωρίς σχόλια:
//   1. ΚΑΝΕΝΑΣ ΕΛΛΗΝΙΚΟΣ ΧΑΡΑΚΤΗΡΑΣ. Εξαίρεση ΜΟΝΟ η λέξη «Ελληνικά», το
//      όνομα της γλώσσας όπως το γράφει ο επιλογέας. Τα σχόλια μένουν ελληνικά.
//   2. ΚΑΝΕΝΑ «FREE» ΚΟΝΤΑ ΣΕ ΤΙΜΗ, ΠΑΚΕΤΟ, ΣΥΝΔΡΟΜΗ ή ΔΟΚΙΜΗ (±120
//      χαρακτήρες). Το πακέτο χωρίς συνδρομή λέγεται «no subscription».
//   3. Η ΝΟΑ ΔΕΝ ΕΙΝΑΙ «ASSISTANT» ΚΑΙ ΔΕΝ ΕΙΝΑΙ «SHE» ή «HE».
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const files = projectFiles("'lib/i18n/en/**/*.ts' 'lib/i18n/en/**/*.tsx' 'app/en/**/*.tsx' 'app/en/**/*.ts' 'app/og/shareEn.ts'")
  .filter(f => !/\.test\.ts$/.test(f))
if (!files.length) {
  console.error('✗ Κανένα αγγλικό αρχείο δεν βρέθηκε. Αν μετακινήθηκαν, άλλαξε και ο φύλακας.')
  process.exit(1)
}

const ALLOWED_GREEK = new Set(['Ελληνικά'])
const GREEK = /[\p{Script=Greek}]+/gu
const PRICEY = /€|\bfe(?:Whole)?\(|\bprice|\bplan\b|\bplans\b|subscription|\btrial\b|\bcost|\bpay\b|\bcharge/i

// Σχόλια έξω, γραμμές ίδιες: το «αρχείο:γραμμή» μένει σωστό.
const blank = (m) => m.replace(/[^\n]/g, ' ')
const code = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, blank)
  .replace(/(^|[^:'"`])\/\/.*$/gm, (m, pre) => pre + blank(m.slice(pre.length)))
  // Οι εισαγωγές είναι διαδρομές (lib/assistant/…), όχι κείμενο.
  .replace(/^import [^\n]*$/gm, blank)

const problems = []
const lineAt = (t, i) => t.slice(0, i).split('\n').length
for (const f of files) {
  const t = code(readFileSync(f, 'utf8'))
  for (const m of t.matchAll(GREEK)) {
    if (ALLOWED_GREEK.has(m[0])) continue
    problems.push(`${f}:${lineAt(t, m.index)}  ελληνικοί χαρακτήρες σε αγγλικό κείμενο: «${m[0]}»`)
  }
  // Το αναγνωριστικό του πακέτου (`'free'`, `PLANS.free`) είναι κώδικας, όχι λέξη.
  for (const m of t.matchAll(/\bfree\b/gi)) {
    const before = t[m.index - 1], after = t[m.index + 4]
    const quoted = /['"]/.test(before ?? '') && /['"]/.test(after ?? '')
    if (before === '.' || quoted || /^\s*:/.test(t.slice(m.index + 4, m.index + 8))) continue
    const near = t.slice(Math.max(0, m.index - 120), m.index + 120)
    if (PRICEY.test(near)) problems.push(`${f}:${lineAt(t, m.index)}  «free» κοντά σε τιμή ή πακέτο — γράψε «no subscription» ή «pay as you go»`)
  }
  for (const m of t.matchAll(/\bassistant\b/gi)) problems.push(`${f}:${lineAt(t, m.index)}  «assistant»: η Νόα λέγεται με το όνομά της`)
  for (const m of t.matchAll(/\bNoa\b[^.?!]{0,60}?\b(she|he|her|hers|him|his|herself|himself)\b/g)) {
    problems.push(`${f}:${lineAt(t, m.index)}  «${m[1]}» για τη Νόα: δεν έχει φύλο — επανέλαβε το όνομα`)
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} προβλήματα στο αγγλικό κείμενο:\n`)
  for (const p of problems.slice(0, 30)) console.error('  ' + p)
  if (problems.length > 30) console.error(`  … και ${problems.length - 30} ακόμη`)
  console.error(`
  ΤΙ ΝΑ ΚΑΝΕΙΣ: το κείμενο των αγγλικών σελίδων γράφεται στα αγγλικά, χωρίς
  «free» δίπλα σε τιμή (το πακέτο λέγεται «no subscription»). Η Νόα λέγεται
  με το όνομά της, χωρίς «assistant», «she» ή «he». Ελληνικό όνομα που πρέπει να
  φανεί (π.χ. ενός νόμου) γράφεται με λατινικούς χαρακτήρες, όπως «ENFIA».
`)
  process.exit(1)
}
console.log(`✓ αγγλικό κείμενο σε ${files.length} αρχεία: χωρίς ελληνικά, χωρίς «free» δίπλα σε τιμή, η Νόα χωρίς φύλο`)
