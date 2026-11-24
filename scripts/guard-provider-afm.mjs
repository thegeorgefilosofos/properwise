#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΘΕ ΑΦΜ ΤΟΥ ΜΗΤΡΩΟΥ ΠΑΡΟΧΩΝ ΠΕΡΝΑ ΤΟ ΨΗΦΙΟ ΕΛΕΓΧΟΥ ΚΑΙ ΕΙΝΑΙ ΜΟΝΑΔΙΚΟ
// ─────────────────────────────────────────────────────────────────────────
// Το μητρώο (lib/mydata/providers.ts) αποφασίζει ποιο παραστατικό αναγνωρίζεται
// ως λογαριασμός ρεύματος, νερού ή τηλεφώνου. Ενα λάθος ψηφίο ή ένα ΑΦΜ γραμμένο
// δύο φορές (μία ως τρέχον, μία ως παλιό `formerAfm` άλλου παρόχου) θα έδινε το
// παραστατικό σε λάθος πάροχο. Και ένα συγκεκριμένο ΑΦΜ δεν μπαίνει ΠΟΤΕ: το
// 094014201 εμφανίστηκε σε κοινό έγγραφο προώθησης της Enerwave, αλλά ανήκει
// στα καύσιμα του ομίλου (έρευνα παρόχων 24/11/2026).
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ. Κάθε `afm: '…'` του αρχείου (τρέχοντα, `formerAfm`, λίστα
// άρνησης): εννέα ψηφία, ψηφίο ελέγχου mod 11 της ΑΑΔΕ, καμία επανάληψη. Και
// το απαγορευμένο ΑΦΜ πουθενά στο αρχείο, ούτε σε σχόλιο ή απόσπασμα.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'

const FILE = 'lib/mydata/providers.ts'
const NEVER = ['094014201']
const src = readFileSync(FILE, 'utf8')
const lineOf = (i) => src.slice(0, i).split('\n').length

/** Ο κανόνας της ΑΑΔΕ: Σ d_i·2^(9-i), i=1..8, mod 11, mod 10 = d9. */
export function afmOk(a) {
  if (!/^\d{9}$/.test(a) || a === '000000000') return false
  let sum = 0
  for (let i = 0; i < 8; i++) sum += Number(a[i]) * 2 ** (8 - i)
  return (sum % 11) % 10 === Number(a[8])
}

const provlimata = []
const seen = new Map()
let n = 0
for (const m of src.matchAll(/\bafm:\s*'([^']*)'/g)) {
  n++
  const afm = m[1]
  const grammi = lineOf(m.index)
  if (!afmOk(afm)) provlimata.push(`${FILE}:${grammi}  «${afm}» δεν περνά το ψηφίο ελέγχου`)
  if (seen.has(afm)) provlimata.push(`${FILE}:${grammi}  «${afm}» υπάρχει ήδη στη γραμμή ${seen.get(afm)}`)
  else seen.set(afm, grammi)
}
for (const bad of NEVER) {
  const i = src.indexOf(bad)
  if (i >= 0) provlimata.push(`${FILE}:${lineOf(i)}  «${bad}» δεν μπαίνει ποτέ στο μητρώο (ΑΦΜ καυσίμων, όχι παρόχου ακινήτου)`)
}
if (n === 0) provlimata.push(`${FILE}: δεν βρέθηκε κανένα ΑΦΜ· ο φύλακας δεν ελέγχει τίποτα`)

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} προβλήματα στα ΑΦΜ του μητρώου παρόχων:\n`)
  for (const p of provlimata) console.error(`  ${p}`)
  console.error('\n  Κάθε ΑΦΜ (τρέχον ή `formerAfm`) με σωστό ψηφίο ελέγχου, μία φορά, με πηγή του ίδιου του παρόχου.\n')
  process.exit(1)
}
console.log(`✓ ${n} ΑΦΜ στο μητρώο παρόχων, όλα με σωστό ψηφίο ελέγχου και μοναδικά`)
