#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΟΘΟΝΕΣ ΔΕΝ ΑΘΡΟΙΖΟΥΝ ΠΟΣΑ: ΤΑ ΔΙΑΒΑΖΟΥΝ ΑΠΟ ΤΟ lib/facts
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ (05.10.2026, λογαριασμός επίδειξης, Παγκράτι 2026).
// Τέσσερις οθόνες έδιναν τέσσερα ποσά για τις ίδιες δαπάνες, γιατί καθεμία
// έκανε τη δική της πρόσθεση: η Επισκόπηση 10.159,70€ στο πλακίδιο και άλλη
// προβολή στην απόδοση, το Χαρτοφυλάκιο ≈12.192€ (×12 / μήνες πάνω σε ήδη
// ετήσιο σύνολο), η Νόα «πληρωμένες» μαζί με όσες λήγουν τον Δεκέμβριο. Και
// η Νόα άθροιζε τις διαμονές ΟΛΩΝ των ετών ως «έσοδα φιλοξενίας».
//
// Στη μέτρηση εκείνης της ημέρας το app/dashboard είχε 170 αθροίσματα
// `.reduce((s, x) => s + …)` σε 47 αρχεία· με την πρώτη μεταφορά στο lib/facts
// έμειναν 165. Δεν είναι όλα λάθος· είναι όλα σημεία όπου ένα ποσό ορίζεται
// ξανά, έξω από τη μία πηγή.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ, ΑΚΡΙΒΩΣ. Κάθε `.reduce(` με αθροιστή στην αρχή του σώματος
// (`(s, x) => s + …`, επίσης με αποδόμηση ή τύπο στα ορίσματα) σε .ts/.tsx του
// app/dashboard, χωρίς τα τεστ. Τα σχόλια σβήνονται πριν από τη μέτρηση.
// ΚΑΣΤΑΝΙΑ ΑΝΑ ΑΡΧΕΙΟ (scripts/facts-sums-baseline.json): κανένα αρχείο δεν
// παίρνει ούτε ένα παραπάνω, νέο αρχείο ξεκινά από το μηδέν και όταν ένα
// αρχείο κατεβαίνει, το όριό του κατεβαίνει μαζί.
//
// ΤΙ ΝΑ ΚΑΝΕΙΣ ΟΤΑΝ ΚΟΚΚΙΝΙΖΕΙ: το ποσό ανήκει σε συνάρτηση του lib/facts
// (δαπάνες έτους, έσοδα ενοικίου, εισπράξεις φιλοξενίας, ΕΝΦΙΑ, απόδοση) ή σε
// καθαρή συνάρτηση του lib/ με τεστ. Η οθόνη το εμφανίζει.
//
// Τρέξε: node scripts/guard-facts-sums.mjs            έλεγχος
//        node scripts/guard-facts-sums.mjs --write    ξαναγράφει τη βάση (ΜΟΝΟ προς τα κάτω)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const BASE = 'scripts/facts-sums-baseline.json'
const WRITE = process.argv.includes('--write')

const files = projectFiles("'app/dashboard/**/*.tsx' 'app/dashboard/**/*.ts'")
  .filter(f => !/\.test\.|\.testkit\./.test(f))

// Ο αθροιστής: πρώτο όρισμα, μετά `=>` και αμέσως `όρισμα +`.
const SUM = /\.reduce\(\s*\(\s*([A-Za-z_$][\w$]*)\s*,\s*(?:\{[^}]*\}|\[[^\]]*\]|[A-Za-z_$][\w$]*)\s*(?::[^)]*)?\)\s*=>\s*\(?\s*\1\s*\+/g

/** Σβήνει σχόλια, κρατώντας τις γραμμές στη θέση τους. */
const stripComments = src => src
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')

const found = {}
const where = {}
for (const f of files) {
  const src = stripComments(readFileSync(f, 'utf8'))
  let m, n = 0
  SUM.lastIndex = 0
  while ((m = SUM.exec(src))) {
    n++
    ;(where[f] ||= []).push(src.slice(0, m.index).split('\n').length)
  }
  if (n) found[f] = n
}
const total = Object.values(found).reduce((s, n) => s + n, 0)

const base = existsSync(BASE) ? JSON.parse(readFileSync(BASE, 'utf8')) : { files: {} }
const limits = base.files || {}

if (WRITE) {
  const up = Object.entries(found).filter(([f, n]) => n > (limits[f] ?? 0))
  if (up.length && existsSync(BASE)) {
    console.error('✗ Η βάση δεν ανεβαίνει με --write:')
    for (const [f, n] of up) console.error(`  ${f}: ${limits[f] ?? 0} → ${n}`)
    process.exit(1)
  }
  writeFileSync(BASE, JSON.stringify({
    σημείωση: base.σημείωση || 'Αθροίσματα ποσών μέσα σε οθόνες του app/dashboard, ανά αρχείο. Μόνο προς τα κάτω. Πρώτη μέτρηση 170 σε 47 αρχεία στις 05.10.2026, 165 μετά την πρώτη μεταφορά (Μία πηγή αλήθειας, lib/facts). Κάθε άθροισμα που φεύγει πηγαίνει σε συνάρτηση του lib/facts ή του lib/ με τεστ.',
    total,
    files: Object.fromEntries(Object.entries(found).sort()),
  }, null, 2) + '\n')
  console.log(`✓ βάση: ${total} αθροίσματα σε ${Object.keys(found).length} αρχεία`)
  process.exit(0)
}

const over = Object.entries(found).filter(([f, n]) => n > (limits[f] ?? 0))
if (over.length) {
  console.error(`\n✗ ${over.length} ${over.length === 1 ? 'αρχείο οθόνης αθροίζει' : 'αρχεία οθόνης αθροίζουν'} ποσά πάνω από το όριό ${over.length === 1 ? 'του' : 'τους'}:\n`)
  for (const [f, n] of over.slice(0, 30)) {
    console.error(`  ${f}:${(where[f] || []).join(',')}  ${n} αθροίσματα, όριο ${limits[f] ?? 0}`)
  }
  if (over.length > 30) console.error(`  … και ${over.length - 30} ακόμη`)
  console.error('\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: το ποσό υπολογίζεται στο lib/facts (δαπάνες έτους, έσοδα ενοικίου,')
  console.error('  εισπράξεις φιλοξενίας, ΕΝΦΙΑ, απόδοση) ή σε καθαρή συνάρτηση του lib/ με τεστ·')
  console.error('  η οθόνη μόνο το εμφανίζει. Ο χάρτης είναι στο docs/facts.md.\n')
  process.exit(1)
}
const down = Object.entries(limits).filter(([f, n]) => (found[f] ?? 0) < n)
if (down.length) {
  console.error(`\n✗ Η μέτρηση έπεσε σε ${down.length} ${down.length === 1 ? 'αρχείο' : 'αρχεία'} και το όριο έμεινε:\n`)
  for (const [f, n] of down.slice(0, 30)) console.error(`  ${f}: ${found[f] ?? 0} αθροίσματα, όριο ${n}`)
  console.error('\n  ΤΖΟΓΟΣ ΣΕ ΚΑΣΤΑΝΙΑ ΕΙΝΑΙ ΚΑΣΤΑΝΙΑ ΠΟΥ ΔΕΝ ΠΙΑΝΕΙ ΤΗΝ ΕΠΟΜΕΝΗ.')
  console.error('  ΔΙΟΡΘΩΣΗ: node scripts/guard-facts-sums.mjs --write — η βελτίωση κλειδώνει.\n')
  process.exit(1)
}
console.log(`✓ ${total} αθροίσματα ποσών σε οθόνες, κανένα πάνω από το όριο του αρχείου του (${files.length} αρχεία)`)
