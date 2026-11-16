#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΜΙΑ ΝΕΑ ΔΥΝΑΤΟΤΗΤΑ ΑΝΟΙΓΕΙ ΜΕ ΤΗ ΣΕΙΡΑ ΤΩΝ ΟΡΩΝ, ΑΠΟ ΤΟ lib/billing/rollout.ts
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ. Οι Όροι χρήσης, ο τιμοκατάλογος και η Νόα υπόσχονταν «νέες
// δυνατότητες νωρίτερα» στα πακέτα από FEATURE_MIN_PLAN.early_access και πάνω.
// Ο έλεγχος υποσχέσεων της 10/11/2026 βρήκε ότι κανένας κώδικας δεν το τηρούσε:
// το `early_access` χρησιμοποιούνταν μόνο σε ετικέτες και κάθε δυνατότητα
// έφτανε σε όλους μαζί. Ηταν πληρωμένο προνόμιο χωρίς μηχανισμό.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ, ΔΥΟ ΚΑΝΟΝΕΣ:
//   1. Αρχείο οθόνης (app/dashboard/**, components/**) που ανακοινώνει
//      δυνατότητα ως νέα («Νέα δυνατότητα», «Πρώτη πρόσβαση») εισάγει το
//      '@/lib/billing/rollout'.
//   2. ΤΟ IMPORT ΔΕΝ ΕΙΝΑΙ ΚΛΕΙΔΩΜΑ. Κάθε εγγραφή του ROLLOUT με ημερομηνία
//      (`opens: 'ΕΕΕΕ-ΜΜ-ΗΗ'`) κλειδώνεται κάπου στο app/, components/ ή lib/
//      με `isAvailable('<id>'`, εκτός από το ίδιο το μητρώο και τις δοκιμές.
//      Χωρίς αυτό, η ημερομηνία θα ήταν υπόσχεση που ο κώδικας δεν τηρεί.
//   3. Κάθε εγγραφή με `gate: '<συνάρτηση>'` έχει τουλάχιστον έναν καλούντα της
//      πύλης στον κώδικα (`rpc('<συνάρτηση>'`), ή είναι ρητά `pending: true` ώσπου
//      να γραφτεί ο κώδικας που την καλεί. Μια πύλη που δεν καλεί κανείς δεν
//      κλειδώνει τίποτα.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const files = projectFiles("'app/dashboard/**/*.tsx' 'components/**/*.tsx'")
  .filter(f => !/\.test\.tsx?$/.test(f))
const MARK = /Νέα δυνατότητα|Πρώτη πρόσβαση/
const USES = /from\s+['"]@\/lib\/billing\/rollout['"]/

const provlimata = []
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  if (!MARK.test(src) || USES.test(src)) continue
  const lines = src.split('\n')
  const i = lines.findIndex(l => MARK.test(l))
  provlimata.push({ arxeio: f, grammi: i + 1, ti: lines[i].trim().slice(0, 80) })
}

// ── 2. Κάθε εγγραφή με ημερομηνία κλειδώνεται ────────────────────────────
const REGISTRY = 'lib/billing/rollout.ts'
const reg = readFileSync(REGISTRY, 'utf8')
const body = reg.slice(reg.indexOf('export const ROLLOUT'), reg.indexOf('};', reg.indexOf('export const ROLLOUT')))
const dated = [...body.matchAll(/^\s*(\w+)\s*:\s*\{[^}]*opens:\s*'(\d{4}-\d{2}-\d{2})'/gm)].map(m => m[1])
const gates = projectFiles("'app/**/*.ts' 'app/**/*.tsx' 'components/**/*.tsx' 'lib/**/*.ts'")
  // Το μητρώο μετρά κι αυτό: δεν καλεί τίποτα, άρα ένας «καλών» μέσα του μόνο σε
  // σχόλιο θα φαινόταν, αν τα σχόλια δεν έσβηναν (η μετάλλαξη το αποδεικνύει).
  .filter(f => !/\.test\.tsx?$/.test(f))
  // Τα σχόλια δεν καλούν τίποτα: ένα «rpc('mobile_access'» σε σχόλιο δεν είναι καλών.
  .map(f => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1'))
for (const id of dated) {
  if (!gates.some(src => src.includes(`isAvailable('${id}'`))) {
    provlimata.push({ arxeio: REGISTRY, grammi: reg.split('\n').findIndex(l => new RegExp(`^\\s*${id}\\s*:`).test(l)) + 1, ti: `«${id}» έχει ημερομηνία και δεν την κλειδώνει κανείς με isAvailable('${id}', …)` })
  }
}

// ── 3. Κάθε πύλη έχει καλούντα, ή εκκρεμεί ρητά ─────────────────────────
const gated = [...body.matchAll(/^\s*(\w+)\s*:\s*\{([^}]*)\}/gm)]
  .map(m => ({ id: m[1], gate: /gate:\s*'(\w+)'/.exec(m[2])?.[1], pending: /pending:\s*true/.test(m[2]) }))
  .filter(e => e.gate && !e.pending)
for (const e of gated) {
  if (!gates.some(src => src.includes(`rpc('${e.gate}'`))) {
    provlimata.push({ arxeio: REGISTRY, grammi: reg.split('\n').findIndex(l => new RegExp(`^\\s*${e.id}\\s*:`).test(l)) + 1, ti: `«${e.id}» κλειδώνει με την ${e.gate}() και δεν την καλεί κανείς· γράψε τον καλούντα ή δήλωσέ τη pending: true` })
  }
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} νέες δυνατότητες εκτός σειράς διάθεσης:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και άλλες ${provlimata.length - 30}`)
  console.error(`\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: γράψε τη δυνατότητα στο ROLLOUT του lib/billing/rollout.ts με
  opens: 'ΕΕΕΕ-ΜΜ-ΗΗ' και άνοιξέ την μόνο όταν isAvailable(id, effectivePlan(…)), στην
  οθόνη και στη διαδρομή του διακομιστή αν έχει.
  Οι Όροι υπόσχονται ότι ανοίγει πρώτα στα πακέτα προτεραιότητας.\n`)
  process.exit(1)
}
console.log(`✓ καμία νέα δυνατότητα εκτός σειράς διάθεσης σε ${files.length} αρχεία, ${dated.length} με ημερομηνία κλειδωμένες`)
