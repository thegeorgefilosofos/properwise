#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΠΛΗΡΗΣ ΣΤΟΙΧΙΣΗ ΧΩΡΙΣ ΣΥΛΛΑΒΙΣΜΟ ΕΙΝΑΙ ΠΟΤΑΜΙΑ ΛΕΥΚΟΥ, ΚΑΙ ΤΟ CSS ΤΟΝ ΣΒΗΝΕΙ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ, ΦΩΤΟΓΡΑΦΗΜΕΝΟ ΑΠΟ ΤΟΝ ΙΔΙΟΚΤΗΤΗ. Η επεξήγηση πίσω από κάθε ⓘ
// έβγαινε «Υψηλότερο   ποσό   ανά   διανυκτέρευση» — κενά έξι φορές το
// κανονικό, μέσα σε κουτί 272 εικονοστοιχείων.
//
// Η ΑΙΤΙΑ ΗΤΑΝ ΜΙΑ ΔΗΛΩΣΗ ΠΟΥ ΕΜΟΙΑΖΕ ΒΟΗΘΗΤΙΚΗ. Ο κανόνας έγραφε
//
//     .po-just { text-align: justify; text-wrap: pretty; }
//
// και το `pretty` στεκόταν εκεί για να μη μένει μία λέξη μόνη στην τελευταία
// γραμμή. Ο αλγόριθμος του `pretty` στο Chromium όμως ΔΕΝ κοιτά μαλακά
// ενωτικά: όση δουλειά κι αν έκανε ο συλλαβιστής, το CSS την πετούσε.
//
// ΜΕΤΡΗΜΕΝΟ ΣΕ ΠΡΑΓΜΑΤΙΚΟ CHROMIUM, ΙΔΙΟ ΚΕΙΜΕΝΟ ΣΕ ΚΟΥΤΙ 272, ΤΕΣΣΕΡΙΣ ΦΟΡΕΣ:
//
//     text-wrap    ενωτικά   γραμμές   μέγιστο κενό
//     pretty       με           4        26,6 px
//     pretty       χωρίς        4        26,6 px   ← ίδιο, δηλαδή τα αγνοεί
//     wrap         χωρίς        4        12,4 px
//     wrap         με           5         4,8 px   ← το φυσικό κενό της Inter
//
// ΓΙΑΤΙ ΦΥΛΑΚΑΣ ΚΑΙ ΟΧΙ ΜΟΝΟ ΔΙΟΡΘΩΣΗ. Η δήλωση διαβάζεται ως καλή πρακτική.
// Οποιος γράψει την επόμενη στοιχισμένη οθόνη θα τη γράψει ξανά — και το
// αποτέλεσμα δεν κοκκινίζει πουθενά: το κείμενο είναι σωστό, η στοίχιση
// υπάρχει, ο συλλαβιστής τρέχει. Σπάει μόνο η ΕΜΦΑΝΙΣΗ — μόνο στο μάτι.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ. Το ίδιο σύνολο δηλώσεων —κανόνας CSS ή αντικείμενο style—
// να μη συνδυάζει ΠΛΗΡΗ ΣΤΟΙΧΙΣΗ με οτιδήποτε ακυρώνει τον συλλαβισμό:
// `text-wrap: pretty` ή `text-wrap: balance` ή `hyphens: none`.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const files = projectFiles("'app/**/*.css' 'app/**/*.tsx' 'components/**/*.tsx'")

/** Ο,τι ακυρώνει τα μαλακά ενωτικά, με το όνομα που θα δει ο αναγνώστης. */
const AKYRWNEI = [
  { re: /text-wrap\s*:\s*(pretty|balance)|textWrap\s*:\s*['"](pretty|balance)['"]/, ti: 'text-wrap: pretty ή balance' },
  { re: /hyphens\s*:\s*none|hyphens\s*:\s*['"]none['"]/, ti: 'hyphens: none' },
]
const STOIXISI = /text-align\s*:\s*justify|textAlign\s*:\s*['"]justify['"]/

/** Σχόλια έξω, με τις γραμμές τους μέσα ώστε η αναφορά να δείχνει σωστά. */
const kathara = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/^\s*\/\/.*$/gm, '')

/**
 * Τα «μπλοκ»: ό,τι ζει ανάμεσα σε δύο άγκιστρα του ίδιου βάθους.
 *
 * Πιάνει και τον κανόνα CSS (`.po-just { … }`) και το αντικείμενο του JSX
 * (`style={{ … }}`), γιατί και τα δύο είναι σύνολα δηλώσεων μέσα σε άγκιστρα.
 * Δεν χρειάζεται αναλυτής: οι δύο δηλώσεις που ψάχνουμε δεν σπάνε σε γραμμές.
 */
function blocks(src) {
  const out = []
  const stack = []
  let line = 1
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (c === '\n') line++
    else if (c === '{') stack.push({ start: i + 1, line })
    else if (c === '}') {
      const b = stack.pop()
      if (b) out.push({ text: src.slice(b.start, i), line: b.line })
    }
  }
  return out
}

const provlimata = []
for (const file of files) {
  const src = kathara(readFileSync(file, 'utf8'))
  if (!STOIXISI.test(src)) continue
  for (const b of blocks(src)) {
    if (!STOIXISI.test(b.text)) continue
    for (const a of AKYRWNEI) {
      if (!a.re.test(b.text)) continue
      provlimata.push({ file, gr: b.line, ti: a.ti })
      break
    }
  }
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} σημεία στοιχίζουν πλήρως και ταυτόχρονα ακυρώνουν τον συλλαβισμό:\n`)
  for (const p of provlimata) console.error(`  ${p.file}:${p.gr}  «${p.ti}» δίπλα σε «text-align: justify»`)
  console.error(`
  ΤΟ ΑΠΟΤΕΛΕΣΜΑ ΔΕΝ ΚΟΚΚΙΝΙΖΕΙ ΠΟΥΘΕΝΑ ΑΛΛΟΥ. Το κείμενο μένει σωστό, η
  στοίχιση υπάρχει, ο συλλαβιστής τρέχει — και ο περιηγητής πετά τα μαλακά
  ενωτικά, οπότε η γραμμή κλείνει τεντώνοντας τα κενά. Μετρημένο: μέγιστο κενό
  26,6 εικονοστοιχεία εκεί που το φυσικό είναι 4,2.

  Διάλεξε ΕΝΑ από τα δύο. Πλήρης στοίχιση ΜΕ συλλαβισμό, ή ριγμένη δεξιά άκρη
  με ό,τι ζύγιση θέλεις. Τα δύο μαζί δεν συνυπάρχουν στο Chromium.
`)
  process.exit(1)
}

console.log(`✓ καμία πλήρης στοίχιση δεν ακυρώνει τον συλλαβισμό της, σε ${files.length} αρχεία`)
