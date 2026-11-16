#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΔΟΣΕΙΣ ΤΟΥ ΦΟΡΟΥ ΕΙΣΟΔΗΜΑΤΟΣ ΕΙΝΑΙ ΤΗΣ ΠΑΡ. 6 ΤΟΥ ΑΡΘΡΟΥ 67 ΚΦΕ, ΟΧΙ ΤΗΣ ΠΑΡ. 4
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ. Οι οκτώ μηνιαίες δόσεις παραπέμπονταν στο «ΚΦΕ άρθρο 67 παρ. 4
// (περ. α΄)». Η παρ. 4 είναι η κοινή δήλωση των συζύγων. Η σωστή διάταξη είναι
// η παρ. 6, τρίτο εδάφιο, του άρθρου 67 ν. 4172/2013, όπως αντικαταστάθηκε με
// το άρθρο 84 ν. 5162/2024 (ΦΕΚ Α΄ 198/05.12.2024): «Η καταβολή του φόρου
// γίνεται σε οκτώ (8) ισόποσες μηνιαίες δόσεις». Το #550 το διόρθωσε στο
// lib/tax· η λάθος παραπομπή είχε μείνει σε 4 αρχεία, 5 σημεία
// (data/accounting-sources.json ×2, lib/legal/validity.ts, lib/home/forecast12.ts,
// app/dashboard/components/assistantPersona.ts), το τελευταίο σε κείμενο που
// διαβάζει ο βοηθός στον χρήστη.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ. Κάθε κείμενο του αποθετηρίου (.ts, .tsx, .js, .mjs, .json, .md).
// Μια παραπομπή στην παρ. 4 του άρθρου 67 («67 παρ. 4», «67 §4», «παρ. 4 του
// άρθρου 67», «Article 67(4)») είναι λάθος όταν στις γύρω γραμμές (±5) μιλά για
// δόσεις («δόσ», «instal»).
//
// ΕΞΑΙΡΕΣΕΙΣ ΚΑΙ ΓΙΑΤΙ: γραμμή που μιλά για συζύγους ή κοινή δήλωση («σύζυγ»,
// «κοινή δήλωση», «spouse», «joint») είναι η γνήσια χρήση της παρ. 4 και μένει.
// Ο ίδιος ο φύλακας και ο κατάλογος μεταλλάξεων γράφουν τη λάθος μορφή επίτηδες.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const SELF = new Set(['scripts/guard-kfe67-instalments.mjs', 'scripts/lib/mutations.mjs'])
const files = projectFiles().filter(f => /\.(tsx?|m?js|json|md)$/.test(f) && f !== 'package-lock.json' && !SELF.has(f))

const PAR4 = [
  /67\s*(?:παρ\.?|§)\s*4(?!\d)/u,
  /παρ\.?\s*4\s+(?:\S+\s+){0,2}άρθρου\s*67(?!\d)/u,
  /(?:article|art\.?)\s*67\s*(?:\(4\)|§\s*4(?!\d)|para(?:graph)?\.?\s*4(?!\d))/iu,
]
const INSTALMENT = /δόσ|instal/iu
const SPOUSES = /σύζυγ|κοινή δήλωση|spous|joint/iu

const provlimata = []
for (const arxeio of files) {
  const src = readFileSync(arxeio, 'utf8')
  if (!src.includes('67')) continue
  const lines = src.split('\n')
  lines.forEach((line, i) => {
    if (!PAR4.some(re => re.test(line)) || SPOUSES.test(line)) return
    const around = lines.slice(Math.max(0, i - 5), i + 6).join('\n')
    if (INSTALMENT.test(around)) provlimata.push({ arxeio, grammi: i + 1, ti: line.trim().slice(0, 100) })
  })
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} παραπομπές των δόσεων φόρου εισοδήματος στην παρ. 4 του άρθρου 67 ΚΦΕ:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error(`\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: οι δόσεις είναι στην παρ. 6 (τρίτο εδάφιο) του άρθρου 67 ν. 4172/2013,`)
  console.error(`  όπως αντικαταστάθηκε με το άρθρο 84 ν. 5162/2024. Γράψε «ΚΦΕ άρθρο 67 παρ. 6».`)
  console.error(`  Η παρ. 4 είναι η κοινή δήλωση των συζύγων.\n`)
  process.exit(1)
}
console.log(`✓ καμία παραπομπή των δόσεων στην παρ. 4 του άρθρου 67 ΚΦΕ σε ${files.length} αρχεία`)
