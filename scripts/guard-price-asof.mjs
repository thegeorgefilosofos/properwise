#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΘΕ ΟΘΟΝΗ ΠΟΥ ΔΕΙΧΝΕΙ ΤΙΜΗ ΑΓΟΡΑΣ Ή ΦΟΡΟΛΟΓΙΚΟ ΟΡΙΟ ΓΡΑΦΕΙ ΠΟΤΕ ΚΑΙ ΑΠΟ ΠΟΥ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ (05.10.2026). Οι τιμές internet και τηλεόρασης της
// καρτέλας Παρόχων (πάνω από σαράντα) δεν είχαν στην οθόνη ούτε ημερομηνία ούτε
// πηγή· οι πηγές ήταν σχόλια στον κώδικα. Τα ασφάλιστρα είχαν ημερομηνία μόνο
// στην πύλη φρεσκάδας, αόρατη. Η κάρτα της κλίμακας στη Λογιστική, το πλαίσιο
// του ΕΝΦΙΑ, η κλίμακα στις Αποδόσεις (γραμμένη με το χέρι) και οι πηγές των
// δημόσιων υπολογιστών έδειχναν όρια χωρίς πότε ελέγχθηκαν. Έξι οθόνες.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ, ΑΚΡΙΒΩΣ. Κάθε .tsx του app/ και του components/ που ΔΕΙΧΝΕΙ
// κατάλογο τιμών ή φορολογικά όρια (τα ονόματα στο `SHOWS` παρακάτω) πρέπει να
// γράφει και τη γραμμή «Τελευταία ενημέρωση · Πηγή» με έναν από τους τρόπους
// του `DATED`: `<AsOfNote>`, `asOfLine(…)`, `taxLimitAsOf(…)` (lib/facts), η
// γραμμή του ρεύματος ή του αερίου, ή τα πλαίσια των δημόσιων σελίδων
// (`<ToolSources>`, `<GuideUpdated>`). Οι εισαγωγές σβήνονται πριν από τον
// έλεγχο: ένα `import { AsOfNote }` χωρίς χρήση δεν γράφει τίποτα στην οθόνη.
//
// ΕΞΑΙΡΕΣΗ, ΜΙΑ ΚΑΙ ΓΙΑΤΙ: υπολογιστής δημόσιας σελίδας (π.χ.
// RentTaxCalculator.tsx) περνά αν το `page.tsx` του ίδιου φακέλου γράφει το
// πλαίσιο πηγών: η γραμμή κάθεται μία φορά στη σελίδα, όχι μέσα στο εργαλείο.
//
// Τρέξε: node scripts/guard-price-asof.mjs
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { projectFiles } from './lib/git-files.mjs'

const files = projectFiles("'app/**/*.tsx' 'components/**/*.tsx'")
  .filter(f => !/\.test\.|\.testkit\./.test(f))

/** Ονόματα που βάζουν στην οθόνη κατάλογο τιμών ή φορολογικά όρια. */
const SHOWS = /\b(INTERNET_PLANS|TV_PACKS|computeLiveQuotes|GAS_PROVIDERS|bracketsLabelForYear|bracketsSentence|taxRows|CLIMATE_LEVY_FROM_2025)\b/
/** Τρόποι να γραφτεί η γραμμή ημερομηνίας και πηγής. */
const DATED = /<AsOfNote\b|\basOfLine\(|\btaxLimitAsOf\(|\bPRICES_UPDATED_LINE\b|\bGAS_VERIFIED\b|<ToolSources\b|<GuideUpdated\b/

const stripImports = src => src.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
const stripComments = src => src
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
const body = f => stripComments(stripImports(readFileSync(f, 'utf8')))

const provlimata = []
for (const f of files) {
  const src = body(f)
  const m = SHOWS.exec(src)
  if (!m || DATED.test(src)) continue
  const page = join(dirname(f), 'page.tsx')
  if (page !== f && existsSync(page) && DATED.test(body(page))) continue
  provlimata.push({ arxeio: f, grammi: src.slice(0, m.index).split('\n').length, ti: m[1] })
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} ${provlimata.length === 1 ? 'οθόνη δείχνει' : 'οθόνες δείχνουν'} τιμές ή φορολογικά όρια χωρίς ημερομηνία και πηγή:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error('\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: βάλε δίπλα στον πίνακα ή στο όριο <AsOfNote fact={…} /> με εγγραφή του')
  console.error('  lib/facts/prices.ts (τιμές αγοράς) ή taxLimitAsOf(…) του lib/facts/taxLimits.ts')
  console.error('  (φορολογικά όρια). Νέα τιμή χωρίς ημερομηνία ελέγχου μπαίνει στον κατάλογο με')
  console.error('  checkedAt: null και η οθόνη το λέει, αντί να δανειστεί άλλη ημερομηνία.\n')
  process.exit(1)
}
console.log(`✓ κάθε οθόνη με τιμές ή φορολογικά όρια γράφει πότε και από πού (${files.length} αρχεία)`)
