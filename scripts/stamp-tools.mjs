#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΓΡΑΦΕΙ ΤΙΣ ΣΦΡΑΓΙΔΕΣ ΤΩΝ ΥΠΟΛΟΓΙΣΤΩΝ (app/toolStamps.json)
// ─────────────────────────────────────────────────────────────────────────
// Δεν φυλάει, ΓΡΑΦΕΙ. Οτι το αρχείο συμφωνεί με το περιεχόμενο το φυλάει ο
// scripts/guard-tool-updated.mjs. Ίδιος κανόνας με το scripts/stamp-guides.mjs:
//
//   npm run tools:stamp -- --updated=ypologismos-enfia            (σήμερα, ώρα Αθήνας)
//   npm run tools:stamp -- --updated=ypologismos-enfia@2026-10-18 (ημέρα της αλλαγής)
//   npm run tools:stamp -- --keep-date=kathari-apodosi
//
// Υπολογιστής που άλλαξε περιεχόμενο δεν σφραγίζεται σιωπηλά: ή παίρνει νέα
// ημερομηνία (--updated) ή ονομάζεται στο --keep-date. Κάθε υπολογιστής με το
// όνομά του, για να διαβάζεται η απόφαση στο PR. Ονομα που δεν χρειάζεται
// είναι άρνηση. Σε άρνηση το αρχείο δεν αγγίζεται.
// ═══════════════════════════════════════════════════════════════════════════
import { TOOL_ENGINES, TOOL_LEDGER, toolHash, readToolLedger, writeToolLedger, athensToday, isDay } from './lib/tool-stamps.mjs'

const today = athensToday()
const arg = (name) => process.argv.slice(2).filter(a => a.startsWith(`--${name}=`))
  .flatMap(a => a.slice(name.length + 3).split(',')).map(s => s.trim()).filter(Boolean)

const slugOf = (p) => p.slice(1)
const paths = Object.keys(TOOL_ENGINES)
const bySlug = new Map(paths.map(p => [slugOf(p), p]))
const keep = new Set(arg('keep-date'))
const updated = new Map(arg('updated').map(s => { const [slug, day] = s.split('@'); return [slug, day ?? today] }))

const ledger = readToolLedger()
const arnisi = []
for (const s of [...keep, ...updated.keys()]) if (!bySlug.has(s)) arnisi.push(`${s}: δεν υπάρχει τέτοιος υπολογιστής (${[...bySlug.keys()].join(', ')})`)
for (const s of keep) if (updated.has(s)) arnisi.push(`${s}: και --updated και --keep-date`)
for (const [s, d] of updated) {
  if (!isDay(d)) arnisi.push(`--updated=${s}: «${d}» δεν είναι ημέρα ΕΕΕΕ-ΜΜ-ΗΗ`)
  else if (d > today) arnisi.push(`--updated=${s}: ${d} είναι μετά τη σημερινή ${today} (ώρα Αθήνας)`)
}

const next = {}
for (const p of paths) {
  const s = slugOf(p)
  const old = ledger[p]
  const hash = toolHash(p)
  const changed = !old || old.hash !== hash
  if (updated.has(s)) { next[p] = { hash, updated: updated.get(s) }; continue }
  if (keep.has(s)) {
    if (!changed) arnisi.push(`--keep-date=${s}: περιττό, το περιεχόμενο δεν άλλαξε`)
    next[p] = { hash, updated: old?.updated ?? null }
    continue
  }
  if (old && changed) arnisi.push(`${s}: άλλαξε το περιεχόμενο. Δώσε --updated=${s} ή --keep-date=${s}`)
  next[p] = { hash, updated: old?.updated ?? null }
}
for (const p of Object.keys(ledger)) if (!(p in TOOL_ENGINES)) arnisi.push(`${p}: σφραγίδα για υπολογιστή που δεν υπάρχει στο TOOL_ENGINES`)

if (arnisi.length) {
  console.error(`✗ Το ${TOOL_LEDGER} δεν γράφτηκε:\n`)
  for (const a of arnisi) console.error(`  ${a}`)
  process.exit(1)
}
writeToolLedger(next)
console.log(`✓ ${paths.length} σφραγίδες στο ${TOOL_LEDGER}`)
for (const s of keep) console.log(`  ${s}: κράτησε την ημερομηνία του με αλλαγμένο περιεχόμενο (γράψε στο PR γιατί)`)
