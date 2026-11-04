#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΝΑΠΡΟΣΑΡΜΟΓΗ ΕΝΟΙΚΙΟΥ ΣΤΙΣ ΟΘΟΝΕΣ ΠΑΙΡΝΕΙ ΤΟΝ ΔΕΙΚΤΗ ΑΠΟ ΜΙΑ ΣΥΝΑΡΤΗΣΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ. Η καρτέλα του μισθωτή υπολόγιζε την αναπροσαρμογή με τη μέση
// ετήσια μεταβολή ενός έτους (`cpiFor`), ενώ το παράθυρο της ειδοποίησης και ο
// δημόσιος υπολογιστής με τη δωδεκάμηνη μεταβολή του μήνα ισχύος
// (`rentIndexFor`). Για ενοίκιο 700€ με ισχύ τον Ιούλιο 2026 η μία οθόνη έδινε
// άλλο νέο μίσθωμα από την άλλη (03/11/2026) και ο ιδιοκτήτης θα υπέγραφε
// έγγραφο με όποιο από τα δύο τύχαινε.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ. Κανένα αρχείο του app/ και του components/ δεν εισάγει τα
// ετήσια μεγέθη του lib/market/cpi (`cpiFor`, `CPI_BY_YEAR`, `CPI_YEARS`,
// `CPI_LATEST_YEAR`). Η αναπροσαρμογή περνά από `rentIndexFor` και
// `rentAdjustmentPct`. Τα ετήσια μένουν για το lib, όπου τεκμηριώνονται.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const files = projectFiles("'app/**/*.ts' 'app/**/*.tsx' 'components/**/*.tsx'")
  .filter(f => !/\.test\.tsx?$/.test(f))
const ANNUAL = /\b(cpiFor|CPI_BY_YEAR|CPI_YEARS|CPI_LATEST_YEAR)\b/g

const provlimata = []
for (const arxeio of files) {
  const src = readFileSync(arxeio, 'utf8')
  if (!src.includes('lib/market/cpi')) continue
  src.split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return
    for (const m of line.matchAll(ANNUAL)) provlimata.push({ arxeio, grammi: i + 1, ti: m[0] })
  })
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} χρήσεις του ετήσιου ΔΤΚ σε οθόνη:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  console.error(`\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: rentIndexFor(μήνας ισχύος) και rentAdjustmentPct(), όπως το\n  RentAdjustmentModal. Ένας δείκτης, ένα ποσό, σε κάθε οθόνη και κάθε έγγραφο.\n`)
  process.exit(1)
}
console.log(`✓ ο ΔΤΚ της αναπροσαρμογής από μία πηγή σε ${files.length} αρχεία`)
