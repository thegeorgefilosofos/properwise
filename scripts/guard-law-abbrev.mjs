#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// «ν. 5255/2025», ΜΕ ΚΕΝΟ ΜΕΤΑ ΤΗ ΣΥΝΤΟΜΟΓΡΑΦΙΑ ΤΟΥ ΝΟΜΟΥ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ. Ο φιλολογικός έλεγχος του reel της αναπροσαρμογής βρήκε
// «άρθρο 59 ν.5255/2025» στην υποσημείωση, στο PDF και στον υπολογιστή
// (04/11/2026). Μετά τη συντομογραφία μπαίνει κενό. Η ίδια γραφή υπήρχε σε 161
// γραμμές κειμένου χρήστη και σε 68 αρχεία: δεν ήταν τυπογραφικό, ήταν συνήθεια.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ. Κάθε «ν.» που ακολουθείται αμέσως από ψηφίο, σε app/, lib/ και
// components/ (.ts, .tsx), εκτός από δοκιμές. Το «ν.» πρέπει να μην είναι
// τέλος λέξης (το «Ιαν.5» δεν είναι νόμος).
//
// ΕΞΑΙΡΕΣΕΙΣ ΚΑΙ ΓΙΑΤΙ: οι προστατευμένες διαδρομές (lib/tax/**,
// lib/billing/greekTax.ts, lib/billing/enfia.ts, lib/legal/validity.ts) αλλάζουν
// μόνο με πηγή, όχι για στίξη. Εκεί η γραφή μένει μέχρι να τις αγγίξει άνθρωπος.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const PROTECTED = /^(lib\/tax\/|lib\/billing\/greekTax\.ts$|lib\/billing\/enfia\.ts$|lib\/legal\/validity\.ts$)/
const files = projectFiles("'app/**/*.ts' 'app/**/*.tsx' 'lib/**/*.ts' 'lib/**/*.tsx' 'components/**/*.tsx'")
  .filter(f => !/\.test\.tsx?$/.test(f) && !PROTECTED.test(f))
const TIGHT = /(?<![\p{L}])ν\.\d/gu

const provlimata = []
for (const arxeio of files) {
  const src = readFileSync(arxeio, 'utf8')
  if (!src.includes('ν.')) continue
  src.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(TIGHT)) provlimata.push({ arxeio, grammi: i + 1, ti: line.slice(Math.max(0, m.index - 12), m.index + 14).trim() })
  })
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} φορές «ν.» κολλημένο στον αριθμό του νόμου:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error(`\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: κενό μετά τη συντομογραφία, «ν. 5255/2025».\n`)
  process.exit(1)
}
console.log(`✓ «ν. αριθμός» με κενό σε ${files.length} αρχεία`)
