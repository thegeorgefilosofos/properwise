#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΒΑΣΗ ΤΗΣ ΑΝΑΠΡΟΣΑΡΜΟΓΗΣ ΕΙΝΑΙ Ο ΟΡΟΣ ΤΟΥ ΜΙΣΘΩΤΗΡΙΟΥ, ΟΧΙ ΤΟ 288 ΑΚ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ. Η καρτέλα της αναπροσαρμογής έγραφε «Βάσει του Αστικού Κώδικα
// (άρθρο 288 ΑΚ), ο εκμισθωτής έχει δικαίωμα να αναπροσαρμόσει το μίσθωμα μία
// φορά τον χρόνο», είχε πλακίδιο «Νομική βάση: Αρ. 288 ΑΚ» και «Συχνότητα: Μία
// φορά/έτος» και η υπογεγραμμένη ειδοποίηση προς μισθωτή επικαλούνταν «το
// άρθρο 288 ΑΚ» (04/11/2026). Τέσσερις γραμμές σε δύο αρχεία. Το 288 ΑΚ είναι η
// γενική ρήτρα καλής πίστης· δεν δίνει δικαίωμα αύξησης και καμία διάταξη δεν
// ορίζει «μία φορά τον χρόνο». Η αύξηση γίνεται όπως και όποτε την ορίζει το
// μισθωτήριο· για υφιστάμενη επαγγελματική μίσθωση το 2026 ισχύει από πάνω το
// όριο του `commercialCapPhrase` στο lib/documents/rentCapNote.ts.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ. Γραμμές κώδικα (όχι σχόλια) σε app/, lib/, components/ και
// scripts/marketing/ (.ts, .tsx, .mjs) που
//   1. επικαλούνται το άρθρο 288 ΑΚ («288 ΑΚ», «Αρ. 288», «άρθρο 288 …
//      Αστικού Κώδικα»), ή
//   2. μιλούν για αναπροσαρμογή μισθώματος και της δίνουν συχνότητα νόμου
//      («μία φορά τον χρόνο/το έτος», «φορά/έτος»).
//
// ΕΞΑΙΡΕΣΕΙΣ ΚΑΙ ΓΙΑΤΙ: οι γραμμές σχολίων (// ή *) γράφουν ιστορικό, όπως το
// lib/market/cpi.ts. Οι προστατευμένες διαδρομές (lib/legal/validity.ts,
// lib/tax/**, docs/legal/**) αλλάζουν μόνο με πηγή: εκεί ο φύλακας αναφέρει,
// δεν κοκκινίζει. Οι δοκιμές, που γράφουν το λάθος για να το αρνηθούν. Και
// αυτό το αρχείο, που γράφει τα μοτίβα.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const SELF = 'scripts/guard-rent-adjust-basis.mjs'
const PROTECTED = /^(lib\/tax\/|lib\/billing\/greekTax\.ts$|lib\/billing\/enfia\.ts$|lib\/legal\/validity\.ts$|docs\/legal\/)/
const files = projectFiles("'app/**/*.ts' 'app/**/*.tsx' 'lib/**/*.ts' 'lib/**/*.tsx' 'components/**/*.tsx' 'components/**/*.ts' 'scripts/marketing/**/*.ts' 'scripts/marketing/**/*.mjs'")
  .filter(f => f !== SELF && !/\.test\.(ts|tsx|mjs)$/.test(f))

const ART_288 = /(?<!\d)288\s*Α\.?\s?Κ\.?(?!\p{L})|(?:άρθρ\p{L}*|αρ\.)\s*288(?!\d)/iu
const RENT = /αναπροσαρμ|μίσθωμ/iu
const YEARLY = /μία\s+φορά\s+(?:τον|το|ανά)\s+(?:χρόνο|έτος)|φορά\s*\/\s*έτος/iu
const COMMENT = /^\s*(\/\/|\*|\/\*)/

const provlimata = [], prostatevmena = []
for (const arxeio of files) {
  const src = readFileSync(arxeio, 'utf8')
  if (!src.includes('288') && !/φορά/u.test(src)) continue
  src.split('\n').forEach((line, i) => {
    if (COMMENT.test(line)) return
    const ti = ART_288.test(line) ? 'άρθρο 288 ΑΚ' : (RENT.test(line) && YEARLY.test(line)) ? 'αναπροσαρμογή «μία φορά τον χρόνο»' : null
    if (!ti) return
    ;(PROTECTED.test(arxeio) ? prostatevmena : provlimata).push({ arxeio, grammi: i + 1, ti })
  })
}

for (const p of prostatevmena) console.warn(`  ! ${p.arxeio}:${p.grammi}  «${p.ti}» σε προστατευμένη διαδρομή: θέλει άνθρωπο με πηγή`)
if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} φορές λάθος νομική βάση αναπροσαρμογής μισθώματος:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error(`\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: το 288 ΑΚ είναι η καλή πίστη, όχι δικαίωμα αύξησης. Γράψε «όπως ορίζει ο όρος`
    + `\n  αναπροσαρμογής του μισθωτηρίου» και, για επαγγελματική μίσθωση, το όριο από το commercialCapPhrase`
    + `\n  του lib/documents/rentCapNote.ts. Συχνότητα νόμου δεν υπάρχει: τη λέει η σύμβαση.\n`)
  process.exit(1)
}
console.log(`✓ η αναπροσαρμογή μισθώματος στηρίζεται στον όρο του μισθωτηρίου σε ${files.length} αρχεία`)
