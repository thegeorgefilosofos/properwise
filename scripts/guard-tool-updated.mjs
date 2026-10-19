#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Η ΗΜΕΡΟΜΗΝΙΑ ΠΕΡΙΕΧΟΜΕΝΟΥ ΕΝΟΣ ΥΠΟΛΟΓΙΣΤΗ ΑΚΟΛΟΥΘΕΙ ΤΗ ΣΕΛΙΔΑ ΚΑΙ ΤΗ ΜΗΧΑΝΗ ΤΟΥ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ. Ζωντανό https://properwise.gr/sitemap.xml (18/10/2026, 17:04
// UTC): ypologismos-enfia 2026-08-26 και ypologismos-forou-enoikion 2026-08-26,
// ενώ ο οδηγός που εξηγεί τον ίδιο πίνακα έγραφε 2026-10-13. Το #401 (18/10)
// είχε αλλάξει H1, λυμένα παραδείγματα και FAQ JSON-LD και των δύο σελίδων και
// η σελίδα ΕΝΦΙΑ τύπωνε «Τελευταία ενημέρωση 26/08/2026» δίπλα στο παράδειγμα
// με συντελεστή 0,60 (13/10). Η ημερομηνία ήταν μόνο ο έλεγχος των ορίων. Η
// Google διαβάζει μόνο το lastmod.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ, ΑΠΕΝΑΝΤΙ ΣΤΟ app/toolStamps.json:
//   (α) κάλυψη: κάθε υπολογιστής του TOOL_ENGINES έχει σφραγίδα και καμία
//       σφραγίδα δεν μένει χωρίς υπολογιστή
//   (β) το αποτύπωμα σελίδας και μηχανής (scripts/lib/tool-stamps.mjs) είναι
//       της σφραγίδας: αλλαγή χωρίς απόφαση για την ημερομηνία κοκκινίζει
//   (γ) η ημερομηνία είναι ημέρα ΕΕΕΕ-ΜΜ-ΗΗ ή `null` και όχι μετά τη σημερινή
//       ώρα Αθήνας (TOOL_TODAY=ΕΕΕΕ-ΜΜ-ΗΗ για δοκιμή)
//   (δ) κάθε υπολογιστής του TOOL_ENGINES υπάρχει ως σελίδα
// Χωρίς git: ο ρηχός κλώνος του CI δεν έχει ιστορικό.
// ═══════════════════════════════════════════════════════════════════════════
import { existsSync } from 'node:fs'
import { TOOL_ENGINES, TOOL_LEDGER, toolFiles, toolHash, readToolLedger, athensToday, isDay } from './lib/tool-stamps.mjs'

const today = athensToday()
const gr = (iso) => iso ? iso.split('-').reverse().join('/') : '(κενό)'
const ledger = readToolLedger()
const provlimata = []

for (const p of Object.keys(TOOL_ENGINES)) {
  const slug = p.slice(1)
  if (!existsSync(`app${p}/page.tsx`)) provlimata.push({ pou: `app${p}/page.tsx`, ti: `${slug}: η σελίδα δεν υπάρχει` })
  const old = ledger[p]
  if (!old) { provlimata.push({ pou: TOOL_LEDGER, ti: `${slug}: λείπει η σφραγίδα του` }); continue }
  if (old.updated !== null && !isDay(old.updated)) provlimata.push({ pou: TOOL_LEDGER, ti: `${slug}: updated «${old.updated}» δεν είναι ημέρα ΕΕΕΕ-ΜΜ-ΗΗ` })
  else if (old.updated && old.updated > today) provlimata.push({ pou: TOOL_LEDGER, ti: `${slug}: ενημέρωση ${gr(old.updated)}, μετά τη σημερινή ${gr(today)} (ώρα Αθήνας)` })
  if (old.hash !== toolHash(p)) {
    provlimata.push({ pou: `app${p}/`, ti: `${slug}: άλλαξε το περιεχόμενο (${toolFiles(p).join(', ')}) και η ημερομηνία ${gr(old.updated)} δεν έχει απόφαση` })
  }
}
for (const p of Object.keys(ledger)) {
  if (!(p in TOOL_ENGINES)) provlimata.push({ pou: TOOL_LEDGER, ti: `σφραγίδα για «${p}», που δεν είναι υπολογιστής του TOOL_ENGINES` })
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} ${provlimata.length === 1 ? 'πρόβλημα' : 'προβλήματα'} στην ημερομηνία περιεχομένου των υπολογιστών:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.pou}  ${p.ti}`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error(`
  ΤΙ ΝΑ ΚΑΝΕΙΣ. Ρώτα πρώτα: θα ήθελε να το ξέρει όποιος άνοιξε τον υπολογιστή χθες;
  · ΝΑΙ (κανόνας, ποσό, παράδειγμα, ερώτηση FAQ, τίτλος): νέα ημερομηνία,
    npm run tools:stamp -- --updated=<υπολογιστής>
  · ΟΧΙ (καλωδίωση, ύφος, μορφή, αναδιάρθρωση χωρίς αλλαγή αποτελέσματος):
    npm run tools:stamp -- --keep-date=<υπολογιστής>
    Το PR γράφει για καθέναν γιατί η αλλαγή δεν είχε ουσία για τον αναγνώστη.
`)
  process.exit(1)
}
console.log(`✓ ${Object.keys(TOOL_ENGINES).length} υπολογιστές: η ημερομηνία περιεχομένου συμφωνεί με τη σφραγίδα σελίδας και μηχανής`)
