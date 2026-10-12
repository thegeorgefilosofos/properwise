#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΓΡΑΦΕΙ ΤΙΣ ΣΦΡΑΓΙΔΕΣ ΤΩΝ ΟΔΗΓΩΝ (app/odigos/guideStamps.json)
// ─────────────────────────────────────────────────────────────────────────
// Δεν φυλάει, ΓΡΑΦΕΙ. Οτι το αρχείο συμφωνεί με το περιεχόμενο το φυλάει ο
// scripts/guard-guide-updated.mjs.
//
//   npm run guides:stamp
//   npm run guides:stamp -- --keep-date=plafon-3-emporikes-misthoseis-2026,airbnb-takk-2026
//
// Ο ΚΑΝΟΝΑΣ ΤΗΣ ΑΡΝΗΣΗΣ. Οδηγός που άλλαξε περιεχόμενο ΚΑΙ κράτησε την ίδια
// ημερομηνία δεν σφραγίζεται σιωπηλά: ή αλλάζει το `updated` στο guides.ts ή
// ονομάζεται στο --keep-date. Δεν υπάρχει «όλοι»: κάθε οδηγός γράφεται με το
// όνομά του, για να διαβάζεται η απόφαση στο PR. Ονομα στο --keep-date που
// δεν χρειάζεται (το περιεχόμενο δεν άλλαξε ή η ημερομηνία άλλαξε) είναι
// επίσης άρνηση: η λίστα λέει μόνο την αλήθεια.
// Σε άρνηση το αρχείο δεν αγγίζεται καθόλου.
// ═══════════════════════════════════════════════════════════════════════════
import { writeFileSync } from 'node:fs'
import { readGuides, currentStamps, readLedger, LEDGER, GUIDES_FILE } from './lib/guide-stamps.mjs'

const keep = new Set(process.argv.slice(2)
  .filter(a => a.startsWith('--keep-date='))
  .flatMap(a => a.slice('--keep-date='.length).split(','))
  .map(s => s.trim()).filter(Boolean))

const guides = readGuides()
const ledger = readLedger()
const now = currentStamps(guides)
const slugs = new Set(guides.map(g => g.slug))

const arnisi = []
const kept = []
for (const s of keep) if (!slugs.has(s)) arnisi.push(`--keep-date=${s}: δεν υπάρχει τέτοιος οδηγός`)

for (const g of guides) {
  const old = ledger[g.href]
  const changed = old && old.hash !== now[g.href].hash
  const sameDate = old && old.updated === g.updated
  if (changed && sameDate) {
    if (keep.has(g.slug)) kept.push(g.slug)
    else arnisi.push(`${g.slug}: άλλαξε το περιεχόμενο με την ίδια ημερομηνία (${g.updated.split('-').reverse().join('/')}). Αλλαξε το updated στο ${GUIDES_FILE}:${g.line} ή ονόμασέ τον στο --keep-date`)
  } else if (keep.has(g.slug)) {
    arnisi.push(`--keep-date=${g.slug}: περιττό, ${!old ? 'ο οδηγός είναι νέος' : !changed ? 'το περιεχόμενο δεν άλλαξε' : 'η ημερομηνία άλλαξε'}`)
  }
}

if (arnisi.length) {
  console.error(`✗ Το ${LEDGER} δεν γράφτηκε:\n`)
  for (const a of arnisi) console.error(`  ${a}`)
  process.exit(1)
}

const sorted = Object.fromEntries(Object.keys(now).sort().map(h => [h, { hash: now[h].hash, updated: now[h].updated }]))
const out = {
  'σημείωση': 'Παράγεται από το npm run guides:stamp. Μην το γράφεις με το χέρι. Το φυλάει ο scripts/guard-guide-updated.mjs.',
  guides: sorted,
}
writeFileSync(LEDGER, JSON.stringify(out, null, 2) + '\n')
console.log(`✓ ${guides.length} σφραγίδες στο ${LEDGER}`)
if (kept.length) {
  console.log('\n  Κράτησαν την ημερομηνία τους με αλλαγμένο περιεχόμενο (γράψε στο PR γιατί, για τον καθένα):')
  for (const s of kept) console.log(`    ${s}`)
}
