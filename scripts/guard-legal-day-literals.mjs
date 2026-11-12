#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΗΜΕΡΕΣ, ΟΙ ΜΗΝΕΣ ΚΑΙ ΟΙ ΗΜΕΡΟΜΗΝΙΕΣ ΤΗΣ ΠΡΟΣΤΑΣΙΑΣ ΒΓΑΙΝΟΥΝ ΑΠΟ ΤΟΥΣ ΚΑΝΟΝΕΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ (12/11/2026). Ο ν. 5221/2025 άλλαξε την αίτηση
// αναστολής από 5 σε 15 εργάσιμες και την ανακοπή του 954 §4 από 15 σε 30. Και
// τα δύο καθεστώτα ισχύουν παράλληλα. Ένα «15 εργάσιμες» γραμμένο με το χέρι σε
// οθόνη είναι σωστό για τη μισή περίπτωση και λάθος για την άλλη· και δεν θα
// άλλαζε μαζί με τον κανόνα. Στο ίδιο αποθετήριο το «πριν από κάθε πλειστηριασμό»
// έμεινε γραμμένο μήνες μετά την αλλαγή του νόμου.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ, ΑΚΡΙΒΩΣ. Κάθε γραμμή που δεν είναι σχόλιο, στα αρχεία του
// app/dashboard/components/prostasia/ και στο lib/legal/enforcement/copy.ts:
//   · ψηφίο ή αριθμητικό (δύο, τρεις, δεκαπέντε…) δίπλα σε «ημέρ», «εργάσιμ», «μήν»·
//   · ψηφίο δίπλα σε «%» σε γραμμή με ελληνικό κείμενο (το CSS «100%» μένει ελεύθερο)·
//   · ημερομηνία ΗΗ/ΜΜ/ΕΕΕΕ ή ΕΕΕΕ-ΜΜ-ΗΗ.
// Οι αριθμοί έρχονται από τα `params` των κανόνων (rules.ts) μέσω του copy.ts
// (fmtCount, ruleSpan, grDate). Δοκιμές εξαιρούνται.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const files = [
  ...projectFiles("'app/dashboard/components/prostasia/**/*.tsx' 'app/dashboard/components/prostasia/**/*.ts'"),
  ...projectFiles("'lib/legal/enforcement/copy.ts'"),
].filter(f => !/\.test\.tsx?$/.test(f))

const WORDS = '(?:δύο|τρεις|τρία|τέσσερις|πέντε|έξι|επτά|εφτά|οκτώ|δέκα|δεκαπέντε|είκοσι|τριάντα|σαράντα|εξήντα|ενενήντα)'
const UNIT = '(?:ημέρ|ημερ|εργάσιμ|εργασίμ|μήν|μην)'
const RULES = [
  { re: new RegExp(`\\d+\\s*${UNIT}`, 'iu'), why: 'ψηφίο δίπλα σε ημέρες ή μήνες' },
  { re: new RegExp(`(?<![\\p{L}])${WORDS}\\s+${UNIT}`, 'iu'), why: 'αριθμητικό δίπλα σε ημέρες ή μήνες' },
  { re: /\d+(?:[.,]\d+)?\s*%(?=.*\p{Script=Greek})|(?<=\p{Script=Greek}.*)\d+(?:[.,]\d+)?\s*%/u, why: 'ποσοστό γραμμένο με το χέρι' },
  { re: /\b\d{2}\/\d{2}\/\d{4}\b|\b20\d{2}-\d{2}-\d{2}\b/, why: 'ημερομηνία γραμμένη με το χέρι' },
]

const provlimata = []
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((line, n) => {
    const t = line.trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*')) return
    for (const r of RULES) {
      const m = r.re.exec(line)
      if (m) provlimata.push({ arxeio: f, grammi: n + 1, ti: `${r.why}: ${m[0]}` })
    }
  })
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} αριθμοί προθεσμιών γραμμένοι με το χέρι στην Προστασία ιδιοκτήτη:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error('\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: διάβασε τον αριθμό από τα params του κανόνα (lib/legal/enforcement/rules.ts)')
  console.error('  με ruleSpan(), fmtCount() ή grDate() του copy.ts. Αν ο αριθμός δεν υπάρχει σε κανόνα,')
  console.error('  δεν έχει επαληθευτεί από δύο πηγές και δεν μπαίνει στην οθόνη.\n')
  process.exit(1)
}
console.log(`✓ κανένας αριθμός προθεσμίας γραμμένος με το χέρι σε ${files.length} αρχεία της Προστασίας ιδιοκτήτη`)
