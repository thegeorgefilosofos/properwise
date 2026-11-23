// npx tsx lib/i18n/en/legal/common.test.ts
// Κάθε πάροχος του μητρώου έχει αγγλική διατύπωση· καμία γραμμή δεν βγαίνει
// με ελληνικά στην αγγλική πολιτική.
import { subprocessors } from '@/lib/legal/subprocessors'
import { subprocessorLineEn, subprocessorNameEn } from './common'
import { privacySectionsEn } from './privacy'
import { termsSectionsEn, termsDisclaimerEn } from './terms'
import { readFileSync } from 'node:fs'
import { MYDATA_ON } from '@/lib/mydata/flag'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }
const GREEK = /[Ͱ-Ͽἀ-῿]/

for (const s of subprocessors()) {
  ok(`${s.name}: αγγλική γραμμή χωρίς ελληνικά («${subprocessorLineEn(s).slice(0, 60)}…»)`, !GREEK.test(subprocessorLineEn(s)))
  ok(`${s.name}: αγγλικό όνομα`, !GREEK.test(subprocessorNameEn(s)))
}
const all = JSON.stringify(privacySectionsEn())
ok('η πολιτική απορρήτου χωρίς ελληνικούς χαρακτήρες', !GREEK.test(all))
// Ιδιο πλήθος ενοτήτων με την ελληνική: η μετάφραση δεν χάνει ούτε προσθέτει ενότητα.
// ΟΙ ΕΝΟΤΗΤΕΣ ΠΙΣΩ ΑΠΟ ΣΗΜΑΙΑ (π.χ. `MYDATA_ON ? [{ h: '…' }] : []`) μετριούνται
// χωριστά: πρέπει να είναι ΙΔΙΕΣ σε πλήθος και στις δύο γλώσσες και να μπαίνουν
// στη μέτρηση μόνο όταν η σημαία είναι ανοιχτή, όπως στη σελίδα.
const gatedIn = (src: string) => [...src.matchAll(/\.\.\.\((\w+_ON) \? \[\{ h: '/g)].map(m => m[1]).sort()
const elSrc = readFileSync('app/privacy/page.tsx', 'utf8')
const enSrc = readFileSync('lib/i18n/en/legal/privacy.ts', 'utf8')
ok('οι ενότητες πίσω από σημαία είναι ίδιες στις δύο γλώσσες', JSON.stringify(gatedIn(elSrc)) === JSON.stringify(gatedIn(enSrc)))
const onFlags = new Set(gatedIn(elSrc).filter(f => f === 'MYDATA_ON' && MYDATA_ON))
const elSections = (elSrc.match(/\{ h: '/g) ?? []).length - gatedIn(elSrc).filter(f => !onFlags.has(f)).length
ok(`ίδιο πλήθος ενοτήτων με την ελληνική (${elSections})`, privacySectionsEn().length === elSections)

const termsAll = JSON.stringify(termsSectionsEn()) + termsDisclaimerEn()
ok('οι Όροι χωρίς ελληνικούς χαρακτήρες', !GREEK.test(termsAll))
const elTerms = (readFileSync('app/terms/page.tsx', 'utf8').match(/\{ h: '/g) ?? []).length
ok(`Όροι: ίδιο πλήθος ενοτήτων με την ελληνική (${elTerms})`, termsSectionsEn().length === elTerms)
// Οι άγκυρες που παραπέμπουν άλλες σελίδες (#ypanachorisi, #systaseis…) μένουν ίδιες.
const ids = (src: string) => [...src.matchAll(/id: '([a-z-]+)'/g)].map(m => m[1]).join(',')
ok('Όροι: ίδιες άγκυρες με την ελληνική', ids(readFileSync('app/terms/page.tsx', 'utf8')) === termsSectionsEn().filter(s => s.id).map(s => s.id).join(','))

console.log(fail === 0 ? `✓ en legal: ${pass} έλεγχοι πέρασαν` : `✗ en legal: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
