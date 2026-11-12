// npx tsx lib/legal/giftLimitsTruth.test.ts
//
// ΟΙ ΜΗΝΕΣ ΧΩΡΙΣ ΧΡΕΩΣΗ ΔΕΝ ΕΧΟΥΝ ΤΟ ΟΡΙΟ ΤΗΣ ΔΟΚΙΜΗΣ (έλεγχος PR 559, 12/11/2026).
// Από τη 20261112170000 οι μήνες χωρίς χρέωση του προγράμματος πρόσκλησης και
// το δώρο της κλήρωσης έχουν τα όρια του πακέτου τους· το όριο σαρώσεων της
// δοκιμής και το μικρότερο όριο ερωτήσεων μένουν μόνο στη δοκιμή και στον
// συνεργάτη χωρίς μήνες χωρίς χρέωση. Ο §6 των Όρων το είπε, αλλά η ενότητα για
// τη Νόα στους Όρους και στην Πολιτική απορρήτου (ελληνικά και αγγλικά) έδενε
// ακόμη τους «μήνες χωρίς χρέωση» με το όριο της δοκιμής. Εδώ διαβάζεται το
// κείμενο των τεσσάρων πηγών και κάθε πρόταση με το όριο της δοκιμής ή το
// «μικρότερο όριο» ελέγχεται: οι μήνες χωρίς χρέωση εμφανίζονται μόνο ως
// εξαίρεση («δεν έχει σε ισχύ»), ποτέ ως αποδέκτες του ορίου.
import { readFileSync } from 'node:fs'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }

const SOURCES = [
  { file: 'app/terms/page.tsx', lang: 'el' },
  { file: 'app/privacy/page.tsx', lang: 'el' },
  { file: 'lib/i18n/en/legal/terms.ts', lang: 'en' },
  { file: 'lib/i18n/en/legal/privacy.ts', lang: 'en' },
] as const

const RULES = {
  el: {
    // Το όριο της δοκιμής γράφεται πάντα από τη σταθερά· το «μικρότερο όριο» είναι το όριο ερωτήσεων.
    cap: /\$\{TRIAL_SCANS_PER_MONTH\}|μικρότερο όριο/,
    gift: /χωρίς χρέωση/g,
    // Η μόνη επιτρεπτή μορφή: εξαίρεση του συνεργάτη που ΔΕΝ έχει μήνες χωρίς χρέωση.
    excluded: /δεν έχει σε ισχύ μήνες χωρίς χρέωση/g,
    giftWord: /πρόγραμμα πρόσκλησης|προγράμματος πρόσκλησης|κλήρωσης/,
    planLimits: /μήνες χωρίς χρέωση του προγράμματος πρόσκλησης και το δώρο της κλήρωσης έχουν τα όρια του πακέτου τους/,
  },
  en: {
    cap: /\$\{TRIAL_SCANS_PER_MONTH\}|lower limit/,
    gift: /without charge/g,
    excluded: /no months without charge in force/g,
    giftWord: /invitation program|referral programme|prize-draw/,
    planLimits: /[Mm]onths without charge from the referral programme and the prize-draw gift have the limits of their plan/,
  },
} as const

// Πρόταση: ως την τελεία ή την άνω τελεία. Οι αριθμοί δεν έχουν τελεία εδώ (σταθερές).
const sentences = (text: string) => text.split(/(?<=[.·;])\s+/)

for (const { file, lang } of SOURCES) {
  const src = readFileSync(file, 'utf8')
  const r = RULES[lang]
  const capped = sentences(src).filter(s => r.cap.test(s) && !s.trim().startsWith('//') && !s.trim().startsWith('*'))
  ok(`${file}: βρίσκει τις προτάσεις με το όριο της δοκιμής`, capped.length >= 1)
  for (const s of capped) {
    const gifts = (s.match(r.gift) ?? []).length
    const excluded = (s.match(r.excluded) ?? []).length
    ok(`${file}: οι μήνες χωρίς χρέωση δεν παίρνουν το όριο της δοκιμής: «${s.slice(0, 120)}…»`, gifts === excluded)
    ok(`${file}: το πρόγραμμα πρόσκλησης και η κλήρωση λείπουν από την πρόταση του ορίου: «${s.slice(0, 120)}…»`, !r.giftWord.test(s))
  }
  ok(`${file}: λέει ότι οι μήνες χωρίς χρέωση και το δώρο έχουν τα όρια του πακέτου τους`, r.planLimits.test(src))
}

console.log(fail ? `✗ giftLimitsTruth: ${fail} απέτυχαν από ${pass + fail}` : `✓ giftLimitsTruth: ${pass} έλεγχοι πέρασαν`)
if (fail) process.exit(1)
