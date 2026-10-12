#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Η «ΤΕΛΕΥΤΑΙΑ ΕΝΗΜΕΡΩΣΗ» ΕΝΟΣ ΟΔΗΓΟΥ ΑΚΟΛΟΥΘΕΙ ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ ΤΟΥ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ. Στο 257d87c (07/10/2026) άλλαξαν τρεις οδηγοί: ο
// kathari-apodosi-akinitou κατά 80+22 γραμμές, ο enoikio-meso-trapezas κατά
// 60+27 και ο forologia-enoikion-2026 κατά 39+20. Κανενός το `updated` δεν
// άλλαξε, οπότε ο αναγνώστης, η Google και η κάρτα κοινοποίησης έβλεπαν
// ημερομηνία παλαιότερη από το κείμενο. Το `updated` το διαβάζουν τέσσερα
// σημεία: GuideParts.tsx («Τελευταία ενημέρωση» και `dateModified`),
// app/sitemap.ts (`lastModified` του οδηγού και του κόμβου /odigos) και
// app/og/share.ts («Ενημερώθηκε» στην κάρτα).
//
// Ο ΜΕΤΡΗΜΕΝΟΣ ΘΟΡΥΒΟΣ. Από 22/09 ως 08/10/2026, 18 από τα 23 commits που
// άγγιξαν σελίδα οδηγού ή το taxText.ts δεν άλλαξαν ημερομηνία. Τα
// περισσότερα ήταν καλωδίωση ή σάρωση ύφους (π.χ. `<PublicHeader current>` σε
// δέκα σελίδες, μορφή ημερομηνίας σε οκτώ), όπου η ημερομηνία ΣΩΣΤΑ δεν
// αλλάζει. Γι' αυτό υπάρχει το --keep-date: ο φύλακας δεν κρίνει την ουσία,
// κάνει ορατή την απόφαση στο diff, με το όνομα του οδηγού. Το PR λέει γιατί.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ, ΑΠΕΝΑΝΤΙ ΣΤΟ app/odigos/guideStamps.json:
//   (α) κάλυψη: κάθε οδηγός του καταλόγου έχει σφραγίδα και καμία σφραγίδα
//       δεν μένει χωρίς οδηγό
//   (β) το αποτύπωμα του περιεχομένου (scripts/lib/guide-stamps.mjs) είναι
//       αυτό της σφραγίδας: αλλαγή χωρίς απόφαση για την ημερομηνία κοκκινίζει
//   (γ) ημερομηνία που άλλαξε χωρίς νέα σφραγίδα κοκκινίζει
//   (δ) published και updated είναι έγκυρες ημέρες, published ≤ updated και
//       updated ≤ σήμερα ΩΡΑ ΑΘΗΝΑΣ (ενημέρωση μετά τα μεσάνυχτα Αθήνας δεν
//       είναι «αύριο» για δρομέα σε UTC). Το GUIDE_TODAY=ΕΕΕΕ-ΜΜ-ΗΗ αλλάζει το
//       «σήμερα» για δοκιμή.
// Χωρίς git και χωρίς υποδιεργασία: ο ρηχός κλώνος του CI δεν έχει ιστορικό.
// ═══════════════════════════════════════════════════════════════════════════
import { readGuides, currentStamps, readLedger, contentFiles, LEDGER, GUIDES_FILE } from './lib/guide-stamps.mjs'

const gr = (iso) => iso ? iso.split('-').reverse().join('/') : '(κενό)'
const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s

const today = process.env.GUIDE_TODAY
  || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

const guides = readGuides()
const ledger = readLedger()
const now = currentStamps(guides)
const provlimata = []
const at = (g) => `${GUIDES_FILE}:${g.line}`

// (δ) οι ημερομηνίες μόνες τους
for (const g of guides) {
  if (!g.href) { provlimata.push({ pou: at(g), ti: 'οδηγός χωρίς href γραμμένο ως απλό κείμενο' }); continue }
  if (!isDay(g.published)) provlimata.push({ pou: at(g), ti: `${g.slug}: published «${g.published}» δεν είναι ημέρα ΕΕΕΕ-ΜΜ-ΗΗ` })
  if (!isDay(g.updated)) provlimata.push({ pou: at(g), ti: `${g.slug}: updated «${g.updated}» δεν είναι ημέρα ΕΕΕΕ-ΜΜ-ΗΗ` })
  if (isDay(g.published) && isDay(g.updated) && g.published > g.updated) {
    provlimata.push({ pou: at(g), ti: `${g.slug}: ενημερώθηκε ${gr(g.updated)}, πριν δημοσιευτεί ${gr(g.published)}` })
  }
  if (isDay(g.updated) && g.updated > today) {
    provlimata.push({ pou: at(g), ti: `${g.slug}: ενημέρωση ${gr(g.updated)}, μετά τη σημερινή ${gr(today)} (ώρα Αθήνας)` })
  }
}

// (α) κάλυψη
for (const g of guides) {
  if (g.href && !ledger[g.href]) provlimata.push({ pou: at(g), ti: `${g.slug}: λείπει η σφραγίδα του από το ${LEDGER}` })
}
const known = new Set(guides.map(g => g.href))
for (const href of Object.keys(ledger)) {
  if (!known.has(href)) provlimata.push({ pou: LEDGER, ti: `σφραγίδα για «${href}», που δεν είναι οδηγός του καταλόγου` })
}

// (β) περιεχόμενο και (γ) ημερομηνία
for (const g of guides) {
  const old = ledger[g.href]
  if (!g.href || !old) continue
  if (old.hash !== now[g.href].hash) {
    provlimata.push({ pou: at(g), ti: `${g.slug}: άλλαξε το περιεχόμενο (${contentFiles(g.href).join(', ')}) και η ημερομηνία ${gr(g.updated)} δεν έχει απόφαση` })
  }
  if (old.updated !== g.updated) {
    provlimata.push({ pou: at(g), ti: `${g.slug}: η ημερομηνία έγινε ${gr(g.updated)} χωρίς νέα σφραγίδα (η σφραγίδα λέει ${gr(old.updated)})` })
  }
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} ${provlimata.length === 1 ? 'πρόβλημα' : 'προβλήματα'} στην ημερομηνία ενημέρωσης των οδηγών:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.pou}  ${p.ti}`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error(`
  ΤΙ ΝΑ ΚΑΝΕΙΣ. Ρώτα πρώτα: θα ήθελε να το ξέρει όποιος διάβασε τον οδηγό χθες;
  · ΝΑΙ (νέος κανόνας, ποσό, προθεσμία, παράδειγμα, ενότητα): άλλαξε το
    \`updated\` του οδηγού στο ${GUIDES_FILE} στη σημερινή ημέρα και τρέξε
    npm run guides:stamp
  · ΟΧΙ (καλωδίωση, ύφος, μορφή, διόρθωση τυπογραφικού): κράτα την ημερομηνία
    και ονόμασε τον οδηγό, έναν έναν:
    npm run guides:stamp -- --keep-date=<οδηγός>
    Το PR γράφει για καθέναν γιατί η αλλαγή δεν είχε ουσία για τον αναγνώστη.
`)
  process.exit(1)
}
console.log(`✓ ${guides.length} οδηγοί: η ημερομηνία ενημέρωσης συμφωνεί με τη σφραγίδα του περιεχομένου τους`)
