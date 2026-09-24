#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΣΧΟΛΙΑ ΤΟΥ ΦΥΛΛΟΥ ΣΤΥΛ ΤΗΣ ΑΡΧΙΚΗΣ ΔΕΝ ΦΤΑΝΟΥΝ ΣΤΟΝ ΕΠΙΣΚΕΠΤΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΜΕΤΡΗΘΗΚΕ. Το ενσωματωμένο φύλλο της αρχικής ήταν 63,5 KB και τα 48,9
// ήταν σχόλια CSS: ελληνική πρόζα που εξηγεί τις αποφάσεις σχεδίασης. Ο
// μεταγλωττιστής δεν αγγίζει ό,τι ζει μέσα σε ανάστροφα εισαγωγικά, οπότε η
// πρόζα ταξίδευε σε κάθε πρώτη επίσκεψη ΔΥΟ φορές, στο HTML και στο φορτίο της
// React: περίπου 98 KB που δεν διαβάζει κανείς.
//
// Ο ΚΑΝΟΝΑΣ. Μέσα σε `<style>{`…`}</style>` των αρχείων της αρχικής, κάθε
// σχόλιο γράφεται ως σχόλιο JavaScript μέσα σε παρεμβολή: `${/* … */''}`.
// Μένει δίπλα στον κανόνα που εξηγεί και ο μεταγλωττιστής το πετά.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'

const FILES = [
  'app/page.tsx',
  'app/ScrollStory.tsx',
  'app/ShowcasePanels.tsx',
  'app/LandingShowcase.tsx',
  'app/LandingCalculator.tsx',
]

const BLOCK = /<style[^>]*>\{`([\s\S]*?)`\}<\/style>/g
const findings = []
for (const file of FILES) {
  const src = readFileSync(file, 'utf8')
  for (const b of src.matchAll(BLOCK)) {
    const body = b[1]
    const start = b.index + b[0].indexOf(body)
    for (const c of body.matchAll(/\/\*/g)) {
      if (body.slice(Math.max(0, c.index - 2), c.index) === '${') continue
      const line = src.slice(0, start + c.index).split('\n').length
      findings.push(`  ${file}:${line}`)
    }
  }
}

if (findings.length) {
  console.error(`\n✗ ${findings.length} σχόλια CSS μέσα σε φύλλο στυλ της αρχικής:\n`)
  for (const f of findings) console.error(f)
  console.error("\n  Γράψ' τα ως `${/* … */''}`: ο μεταγλωττιστής τα πετά και δεν στέλνονται στον επισκέπτη.")
  process.exit(1)
}

console.log(`✓ κανένα σχόλιο CSS στα φύλλα στυλ της αρχικής (${FILES.length} αρχεία)`)
