#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΝΕΝΑ COMPONENT ΠΕΛΑΤΗ ΕΞΩ ΑΠΟ ΤΟ app/en ΔΕΝ ΕΙΣΑΓΕΙ ΑΓΓΛΙΚΟ ΛΕΞΙΚΟ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ. Η αγγλική βιτρίνα (#467, 02.11.2026) έκανε τους
// υπολογιστές δίγλωσσους με `en ? ENFIA_EN.x : '…'` μέσα στο ίδιο component
// πελάτη. Το λεξικό (lib/i18n/en/**) εισαγόταν στατικά, άρα κατέβαινε ΚΑΙ
// στις ελληνικές σελίδες: το /ypologismos-enfia πήγε 190,0 → 199,7 KB στο
// κρίσιμο μονοπάτι και του έμειναν 0,8 KB από την ανοχή του perf:budget.
// Το ίδιο είχε ήδη γίνει μία φορά στην είσοδο (/login +14,7 KB, /signup
// +14,5 KB) και διορθώθηκε με το AuthEnProvider· ξαναέγινε σε επτά
// υπολογιστές την ίδια μέρα, γιατί ο κανόνας ζούσε μόνο σε σχόλιο.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ. Κάθε αρχείο με 'use client' στα app/, components/, lib/
// ΕΞΩ από το app/en/** και το lib/i18n/en/**: καμία εισαγωγή ΤΙΜΗΣ από το
// `@/lib/i18n/en/…` (ή σχετική διαδρομή προς αυτό). Το `import type` περνά·
// δεν φτάνει στο πακέτο. Τα αγγλικά φτάνουν με πάροχο που ζει κάτω από το
// app/en (βλ. lib/i18n/toolEn.ts και lib/i18n/authEn.ts).
//
// ΓΝΩΣΤΟ ΧΡΕΟΣ, ΜΟΝΟ ΝΑ ΜΙΚΡΑΙΝΕΙ. Ο πίνακας των πακέτων
// (components/PlanMatrix.tsx) υπολογίζει και τις δύο γλώσσες σε επίπεδο
// αρχείου· θέλει δική του αλλαγή. Αρχείο της λίστας που δεν εισάγει πια
// λεξικό κόβει κι αυτό: η λίστα πρέπει να μικρύνει μαζί του.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const DEBT = new Set(['components/PlanMatrix.tsx'])

const files = projectFiles("'app/**/*.tsx' 'app/**/*.ts' 'components/**/*.tsx' 'components/**/*.ts' 'lib/**/*.tsx' 'lib/**/*.ts'")
  .filter(f => !f.startsWith('app/en/') && !f.startsWith('lib/i18n/en/') && !/\.test\.tsx?$/.test(f))

// Περνά τα αρχικά σχόλια με απλή σάρωση, χωρίς regex που μπορεί να κολλήσει.
function isClient(t) {
  let i = 0
  for (;;) {
    while (i < t.length && /\s/.test(t[i])) i++
    if (t.startsWith('//', i)) { const n = t.indexOf('\n', i); if (n < 0) return false; i = n + 1; continue }
    if (t.startsWith('/*', i)) { const n = t.indexOf('*/', i + 2); if (n < 0) return false; i = n + 2; continue }
    return t.startsWith("'use client'", i) || t.startsWith('"use client"', i)
  }
}
// `import { X } from '@/lib/i18n/en/…'`, πολλές γραμμές, όχι `import type`.
const VALUE_IMPORT = /^import\s+(?!type\b)[^;]*?from\s+['"]((?:@\/lib\/i18n\/en|(?:\.\.?\/)+(?:lib\/)?i18n\/en|\.\/en)\/[^'"]*)['"]/gm

const provlimata = []
let clients = 0
for (const f of files) {
  const t = readFileSync(f, 'utf8')
  if (!isClient(t)) continue
  clients++
  // Το `./en/…` είναι λεξικό μόνο μέσα στο lib/i18n· αλλού είναι ο πάροχος του φακέλου.
  const hits = [...t.matchAll(VALUE_IMPORT)]
    .filter(m => m[1].includes('i18n/en/') || (f.startsWith('lib/i18n/') && m[1].startsWith('./en/')))
  if (DEBT.has(f)) {
    if (!hits.length) provlimata.push({ arxeio: f, grammi: 1, ti: 'δεν εισάγει πια λεξικό — βγάλ\' το από τη λίστα DEBT του φύλακα' })
    continue
  }
  for (const m of hits) provlimata.push({ arxeio: f, grammi: t.slice(0, m.index).split('\n').length, ti: m[1] })
}

if (!clients) {
  console.error('✗ Δεν βρέθηκε κανένα component πελάτη. Αν άλλαξε η δομή, άλλαξε και ο φύλακας.')
  process.exit(1)
}
if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} components πελάτη έξω από το app/en εισάγουν αγγλικό λεξικό:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error(`
  ΤΙ ΝΑ ΚΑΝΕΙΣ: το λεξικό κατεβαίνει έτσι και στις ελληνικές σελίδες. Βάλε
  τα αγγλικά σε πάροχο κάτω από το app/en (π.χ. app/en/<σελίδα>/en.tsx με
  ToolEnContext, lib/i18n/toolEn.ts) και διάβασέ τα με useToolEn()/useToolDict().
  Για τύπους αρκεί το «import type».
`)
  process.exit(1)
}
console.log(`✓ κανένα από τα ${clients} components πελάτη έξω από το app/en δεν εισάγει αγγλικό λεξικό`)
