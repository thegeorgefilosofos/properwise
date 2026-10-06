#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΜΙΑ ΓΡΑΦΗ ΗΜΕΡΟΜΗΝΙΑΣ ΣΤΗΝ ΟΘΟΝΗ: ηη/μμ/εεεε, ΠΟΤΕ ISO, ΠΟΤΕ ΤΕΛΕΙΕΣ ΑΠΟ ΚΩΔΙΚΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ (06/10/2026). Ο οπτικός έλεγχος της δημόσιας
// σελίδας βρήκε ΠΕΝΤΕ γραφές ημερομηνίας: «27 Σεπτεμβρίου 2026», «2026-10-04»,
// «26/08/2026», «05.10.2026», «Οκτώβριος 2026» — και στον ίδιο οδηγό (39Β) το
// «01.01.2024» δίπλα στο «1.1.2024». Η κεφαλίδα του /trust, των Όρων και του
// Απορρήτου έγραφε «Έκδοση 2026-10-04»: η τιμή-μηχανής της απόδειξης
// συγκατάθεσης, τυπωμένη αυτούσια. Επτά σημεία συναρμολογούσαν με το χέρι την
// έναρξη της τραπεζικής είσπραξης ως `1.${μήνας}.${έτος}` και δύο έκαναν
// `split('-').reverse().join('.')`, ενώ το `grDate` (lib/core/format.ts) και το
// `asOfLine` (lib/facts/prices.ts) γράφουν «05/10/2026» — η μορφή που ορίζει
// και το docs/facts.md.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ, ΑΚΡΙΒΩΣ. Στα app/, components/, lib/ (όχι δοκιμές, όχι σχόλια):
//   1. ISO ημερομηνία (εεεε-μμ-ηη) ΜΕΣΑ σε ελληνικό κείμενο: συμβολοσειρά ή
//      κείμενο JSX που έχει και ελληνικά γράμματα και ISO. Μια σκέτη τιμή
//      ('2026-10-04', `checkedAt`, `dateTime`, JSON-LD) δεν έχει ελληνικά και
//      δεν πιάνεται: είναι δεδομένο, όχι πρόταση.
//   2. Ημερομηνία με τελείες ΣΥΝΑΡΜΟΛΟΓΗΜΕΝΗ από κώδικα: `.reverse().join('.')`
//      ή template `1.${…}.${…YEAR…}`. Η τελεία μένει μόνο εκεί που τη γράφει η
//      πηγή: «ΦΕΚ Β΄ 5933/05.11.2025» αντιγράφεται όπως δημοσιεύτηκε και είναι
//      γραμμένο με το χέρι, όχι παραγόμενο· και η παραπομπή σε δελτίο τύπου
//      («Δελτία Τύπου ΑΑΔΕ 15.03.${YEAR}») εξαιρείται, ακόμη κι όταν το έτος
//      είναι μεταβλητή.
//
// ΕΞΑΙΡΕΣΕΙΣ. Οι οδηγίες προς το μοντέλο που ζητούν ISO ως ΜΟΡΦΗ εργαλείου
// (γράφουν «YYYY-MM-DD» ή «ISO» στην ίδια γραμμή): εκεί το ISO είναι η
// προδιαγραφή του ορίσματος, όχι κείμενο για άνθρωπο. Και οι προστατευμένες
// διαδρομές (lib/tax/**, lib/billing/greekTax.ts, lib/billing/enfia.ts,
// lib/legal/validity.ts), που αλλάζουν μόνο με πηγή.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const PROTECTED = /^(lib\/tax\/|lib\/billing\/greekTax\.ts$|lib\/billing\/enfia\.ts$|lib\/legal\/validity\.ts$)/
const files = projectFiles("'app/**/*.ts' 'app/**/*.tsx' 'components/**/*.ts' 'components/**/*.tsx' 'lib/**/*.ts' 'lib/**/*.tsx'")
  .filter(f => !/\.test\.|\.testkit\./.test(f) && !PROTECTED.test(f))

const ISO = /(?<![\w-])(?:19|20)\d\d-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?![\w-])/
const GREEK = /[Ͱ-Ͽἀ-῿]/
const SPEC = /YYYY-MM-DD|εεεε-μμ-ηη|(?<![\p{L}\p{N}])ISO(?![\p{L}\p{N}])/u
// Συμβολοσειρές και κείμενο JSX μιας γραμμής.
const SEGMENTS = /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|>[^<>{}]+</g
const DOTTED_BUILD = [
  /\.reverse\(\)\s*\.join\(\s*['"]\.['"]\s*\)/,
  // «1.${μήνας}.${ΕΤΟΣ}» μέσα σε οποιοδήποτε template.
  /(?<![\w.])\d{1,2}\.(?:\d{1,2}|\$\{[^}]+\})\.\$\{[^}]*(?:YEAR|[Yy]ear)[^}]*\}/,
  // «${ημέρα}.${μήνας}.${…}»: η ημέρα από μεταβλητή.
  /\$\{[^}]*(?:DAY|[Dd]ay|\bd\b|\bdd\b)[^}]*\}\.\$\{[^}]+\}\.\$\{/,
]

const CITATION = /(?:ΦΕΚ|Τύπου)[^·;:]*$/u

const provlimata = []
for (const f of files) {
  let block = false
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    let t = line.trim()
    if (block) { if (t.includes('*/')) block = false; return }
    if (/^(\/\*|\{\/\*|\$\{\/\*)/.test(t)) { if (!t.includes('*/')) block = true; return }
    if (t.startsWith('//') || t.startsWith('*')) return
    t = t.replace(/\s\/\/\s.*$/, '').replace(/\{\/\*.*?\*\/\}/g, '')
    if (/console\.(log|warn|error|info)/.test(t)) return
    for (const re of DOTTED_BUILD) {
      for (const m of t.matchAll(new RegExp(re.source, 'g'))) {
        // Παραπομπή σε δημοσίευμα («Δελτία Τύπου ΑΑΔΕ 15.03.${YEAR}», «ΦΕΚ …»):
        // γράφεται όπως το γράφει η πηγή, ακόμη κι όταν το έτος είναι μεταβλητή.
        if (CITATION.test(t.slice(Math.max(0, m.index - 90), m.index))) continue
        provlimata.push({ arxeio: f, grammi: i + 1, ti: t.slice(Math.max(0, m.index - 40), m.index + 50), pos: 'ημερομηνία με τελείες από κώδικα → grDate / grDateOf' })
      }
    }
    if (!ISO.test(t) || SPEC.test(t)) return
    for (const m of t.matchAll(SEGMENTS)) {
      if (GREEK.test(m[0]) && ISO.test(m[0])) {
        provlimata.push({ arxeio: f, grammi: i + 1, ti: m[0].slice(0, 90), pos: 'ISO μέσα σε ελληνικό κείμενο → grDate' })
        break
      }
    }
  })
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} ημερομηνίες εκτός της γραφής της οθόνης:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  ${p.pos}\n    «${p.ti}»`)
  if (provlimata.length > 30) console.error(`\n  … και ${provlimata.length - 30} ακόμη.`)
  console.error(`\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: η ημερομηνία που διαβάζει άνθρωπος γράφεται «05/10/2026» με το`)
  console.error(`  grDate (ISO) ή το grDateOf (έτος, μήνας) του lib/core/format.ts· ολογράφως`)
  console.error(`  με το grDateLong, ο μήνας μόνος με το monthYearLabel. Το ISO μένει για`)
  console.error(`  dateTime, JSON-LD, ονόματα αρχείων και ορίσματα.\n`)
  process.exit(1)
}
console.log(`✓ καμία ISO ή συναρμολογημένη ημερομηνία με τελείες σε κείμενο, σε ${files.length} αρχεία`)
