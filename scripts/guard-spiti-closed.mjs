#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΟΦΕΛΟΣ «ΣΠΙΤΙ ΜΟΥ ΙΙ» ΓΡΑΦΕΤΑΙ ΜΟΝΟ ΔΙΠΛΑ ΣΕ ΕΛΕΓΧΟ ΚΑΤΑΣΤΑΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ ΣΤΙΣ 28/09/2026. Το πρόγραμμα έκλεισε για νέες
// αιτήσεις στις 31/05/2026 και για υπογραφές στις 31/08/2026. Τέσσερις μήνες
// μετά, δέκα σημεία σε εννέα αρχεία το παρουσίαζαν ακόμη ως διαθέσιμο ή
// υπολόγιζαν όφελος από αυτό:
//
//   TabLoanCalculator   δόση με το μισό δάνειο άτοκο και «εκτιμώμενη
//                       εξοικονόμηση», με κριτήρια χωρίς καμία ημερομηνία·
//                       προεπιλογή «Νέος αγοραστής» με 1,80% «Σπίτι μου ΙΙ»
//   LoanAdvisor         σήμα «50% άτοκο» και «μειώνει δραστικά το κόστος»
//   LoanGuide           «το μισό δάνειο άτοκο», «+50% επιδότηση επιτοκίου»
//   greekMarket         ο μοχλός μόχλευσης: «δίνει το μισό δάνειο άτοκο»
//   TabLoanData         «Σπίτι μου ΙΙ, πολύ χαμηλό επιτόκιο», 1,00 έως 2,00%
//   TabRentROI          50% άτοκο σε ΚΑΘΕ αποθηκευμένο δάνειο πρώτης κατοικίας
//   assistantPersona    «το πιο σημαντικό για νέους αγοραστές»
//   advisory            «δίνει άτοκο ή χαμηλότοκο τμήμα δανείου»
//
// Και οι δύο προθεσμίες ζούσαν ήδη στο `SPITI_MOU`, με την κρίση τους στο
// `programStatus`. Κανένα από τα δέκα σημεία δεν τις ρωτούσε.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ, ΑΚΡΙΒΩΣ. Σε κάθε αρχείο οθόνης, δεδομένων και βοηθού (app/,
// lib/, components/), κάθε γραμμή κώδικα που ονομάζει «Σπίτι μου ΙΙ» και έχει
// λέξη οφέλους («άτοκο», «επιδότηση») στην ίδια ή στη διπλανή γραμμή πρέπει να
// έχει σε απόσταση έως έξι γραμμών ανάγνωση της κατάστασης: `spitiMouOpen`,
// `spitiMouStatus`, `spitiMouClosedLine`, `spitiMouClosedSentence`,
// `spitiMouEstimate`, `acceptsApplications` ή τις ίδιες τις προθεσμίες του
// `SPITI_MOU`. Τα σχόλια δεν μετρούν, ούτε ως παράβαση ούτε ως έλεγχος: ένα
// σχόλιο που αναφέρει τη `spitiMouOpen` δεν κρύβει τίποτα από την οθόνη.
//
// Η διπλανή γραμμή δεν μετρά όταν ανοίγει ΑΛΛΗ εγγραφή λίστας (αρχίζει με «{»):
// στον κατάλογο συνδέσμων του οδηγού, το «Σπίτι μου ΙΙ» κάθεται δίπλα στο
// «Αναβαθμίζω» και στο «Εξοικονομώ», που έχουν δικές τους επιδοτήσεις.
//
// ΕΞΑΙΡΕΣΕΙΣ ΚΑΙ ΓΙΑΤΙ:
//   lib/loans/recommend.ts      ΕΙΝΑΙ η πηγή: οι προθεσμίες, η κρίση και το
//                               ίδιο το όφελος, πίσω από την επιλεξιμότητα
//   lib/loans/programStatus.ts  η κρίση της κατάστασης για κάθε πρόγραμμα
//   *.test.ts                   οι δοκιμές περιγράφουν το όφελος για να το
//                               ελέγξουν, με δική τους ημερομηνία
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const ALLOWED = new Set(['lib/loans/recommend.ts', 'lib/loans/programStatus.ts'])
const isTest = (f) => /\.test\.tsx?$/.test(f)

// Χωρίς τόνους και πεζά: «ΑΤΟΚΟ», «άτοκο» και «Άτοκο μέρος» είναι η ίδια λέξη.
const norm = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const NAME = /σπιτι μου (ιι|ii)(?![\p{L}\d])/u
const BENEFIT = /ατοκ|επιδοτ/
const GATE = /\b(spitiMouOpen|spitiMouStatus|spitiMouClosedLine|spitiMouClosedSentence|spitiMouEstimate)\b|\bacceptsApplications\b|\bSPITI_MOU\.(applicationDeadline|contractDeadline)\b/

const NEAR_BENEFIT = 1
const NEAR_GATE = 6

/**
 * Ο κώδικας χωρίς σχόλια, με τις γραμμές στη θέση τους. Το σχόλιο γραμμής
 * κόβεται μόνο όταν δεν ακολουθεί άνω-κάτω τελεία, ώστε να μένουν τα «https://».
 */
function codeOnly(src) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  return noBlock.split('\n').map((l) => l.replace(/(^|[^:\\'"`])\/\/.*$/, '$1'))
}

const files = projectFiles("'app/**/*.ts' 'app/**/*.tsx' 'lib/**/*.ts' 'lib/**/*.tsx' 'components/**/*.ts' 'components/**/*.tsx'")
  .filter((f) => !ALLOWED.has(f) && !isTest(f))

const provlimata = []
for (const arxeio of files) {
  const raw = readFileSync(arxeio, 'utf8')
  if (!NAME.test(norm(raw))) continue
  const code = codeOnly(raw)
  const low = code.map(norm)
  low.forEach((line, i) => {
    if (!NAME.test(line)) return
    const near = (d, test) => {
      for (let j = Math.max(0, i - d); j <= Math.min(code.length - 1, i + d); j++) if (test(j)) return true
      return false
    }
    const sameItem = (j) => j === i || !/^\s*\{/.test(code[j])
    if (!near(NEAR_BENEFIT, (j) => sameItem(j) && BENEFIT.test(low[j]))) return
    if (near(NEAR_GATE, (j) => GATE.test(code[j]))) return
    provlimata.push({ arxeio, grammi: i + 1, ti: raw.split('\n')[i].trim().slice(0, 70) })
  })
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} κείμενα δίνουν όφελος «Σπίτι μου ΙΙ» χωρίς να ρωτούν αν το πρόγραμμα δέχεται αιτήσεις:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error(`\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: το πρόγραμμα έκλεισε για νέες αιτήσεις στις 31/05/2026. Δείξε το`)
  console.error(`  όφελος μόνο πίσω από \`spitiMouOpen(athensToday())\` και, όταν είναι κλειστό, γράψε`)
  console.error(`  την \`spitiMouClosedLine(today)\` από το lib/loans/recommend.ts: μία γραμμή, χωρίς`)
  console.error(`  ποσοστά, δόση ή εξοικονόμηση. Αν το κείμενο απλώς εξηγεί πώς λειτουργούσε, πάρε`)
  console.error(`  την ημερομηνία κλεισίματος από το \`SPITI_MOU.applicationDeadline\`.\n`)
  process.exit(1)
}
console.log(`✓ κάθε όφελος «Σπίτι μου ΙΙ» περνά από έλεγχο κατάστασης (${files.length} αρχεία)`)
