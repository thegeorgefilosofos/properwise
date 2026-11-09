#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Η `.act-row` ΕΙΝΑΙ FLEX: ΚΑΝΟΝΑΣ ΠΛΕΓΜΑΤΟΣ ΠΑΝΩ ΤΗΣ ΔΕΝ ΚΑΝΕΙ ΤΙΠΟΤΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ. Στις 29/10/2026 η `.act-row` (globals.css, έως
// 560) έγινε από πλέγμα δύο στηλών `display: flex !important`. Δύο οθόνες
// κρατούσαν δικό τους `grid-template-columns: 1fr` για να στοιβάζουν τα
// κουμπιά στο τηλέφωνο, και οι δύο έμειναν νεκρές χωρίς να το δει κανείς:
//
//   RentReceived  στα 360 το «Καταχώρηση · 400,00€» (nowrap) έβγαινε έξω από
//                 κουμπί 135 εικονοστοιχείων, κολλητά στις άκρες
//   PortfolioTab  τα τρία κουμπιά της κεφαλίδας έσπαγαν σε δύο γραμμές το
//                 καθένα, ακριβώς ό,τι έλεγε το σχόλιο ότι διορθώθηκε
//
// Οι σαρωτές διάταξης δεν το είδαν: κείμενο που ξεχειλίζει από κουμπί χωρίς
// `overflow: hidden` δεν «κόβεται» για αυτούς.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ. Κάθε κανόνας CSS (σε .css ή σε <style> μέσα σε .tsx) που ο
// επιλογέας του λήγει στην `.act-row` και δηλώνει `grid-template-*`. Για
// στοίβαξη: `.act-row > * { flex: 1 1 100%; }`.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const files = projectFiles("'app/**/*.tsx' 'app/**/*.css' 'components/**/*.tsx' 'lib/**/*.tsx'")
const RULE = /([^{}]*\.act-row(?::[\w-]+(?:\([^)]*\))?)*)\s*\{([^{}]*)\}/g
const provlimata = []

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(RULE)) {
    if (!/grid-template-(columns|rows|areas)/.test(m[2])) continue
    const grammi = src.slice(0, m.index + m[0].indexOf('.act-row')).split('\n').length
    provlimata.push({ arxeio: file, grammi, ti: `${m[1].trim().split('\n').pop().trim()} { ${m[2].trim()} }` })
  }
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} κανόνες πλέγματος πάνω σε .act-row, που είναι flex και τους αγνοεί:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti.slice(0, 100)}»`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error(`\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: για να στοιβαχτούν τα κουμπιά γράψε
  \`.act-row > * { flex: 1 1 100%; }\` μέσα στο ίδιο @media. Το
  grid-template-columns δεν πιάνει: η .act-row έχει display: flex !important.\n`)
  process.exit(1)
}
console.log(`✓ Κανένας νεκρός κανόνας πλέγματος πάνω σε .act-row, σε ${files.length} αρχεία`)
