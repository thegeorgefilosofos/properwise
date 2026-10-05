// npx tsx lib/accounting/taxpayer.test.ts
//
// ΓΙΑΤΙ ΓΡΑΦΤΗΚΕ. Η Λογιστική ενοποιούσε τον φόρο ενοικίων σε ΟΛΑ τα ακίνητα του
// λογαριασμού. Ο διαχειριστής με δύο ιδιοκτήτες των 12.000€ έβλεπε για τον
// καθένα μερίδιο του φόρου των 24.000€ — μεγαλύτερο από τον φόρο που θα του
// έβγαζε η ΑΑΔΕ στα δικά του 12.000€.
import { sameTaxpayer, taxpayerOf, ACCOUNT_HOLDER } from './taxpayer'
import { consolidateIndividual, type StatementInput } from './statement'
import { rentalBracketsForYear } from '../billing/greekTax'

let pass = 0, fail = 0
function ok(name: string, cond: boolean) { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }

const input = (gross: number): StatementInput => ({ regime: 'individual_longterm', grossIncome: gross, enfia: 0, rentsPaidViaBank: true })
const props = [
  { id: 'a', client_id: 'owner1' },
  { id: 'b', client_id: 'owner2' },
  { id: 'c', client_id: null },
  { id: 'd', client_id: 'guest1' },
]
const owners = new Set(['owner1', 'owner2'])
const brackets = rentalBracketsForYear(2026)
const taxShareOf = (ps: { id: string }[], id: string) =>
  consolidateIndividual(ps.map(p => ({ id: p.id, input: input(12000) })), brackets).perProperty.find(x => x.id === id)!.taxShare
const alone = consolidateIndividual([{ id: 'a', input: input(12000) }], brackets).incomeTax

// ═══ ΚΑΘΕ ΙΔΙΟΚΤΗΤΗΣ ΕΙΝΑΙ ΧΩΡΙΣΤΟΣ ΦΟΡΟΛΟΓΟΥΜΕΝΟΣ ═══════════════════════════
ok('ιδιοκτήτης 1: μόνο το δικό του ακίνητο', JSON.stringify(sameTaxpayer(props, 'a', owners).map(p => p.id)) === '["a"]')
ok('ιδιοκτήτης 2: μόνο το δικό του ακίνητο', JSON.stringify(sameTaxpayer(props, 'b', owners).map(p => p.id)) === '["b"]')
ok('φόρος ιδιοκτήτη 1 = φόρος των δικών του 12.000€', taxShareOf(sameTaxpayer(props, 'a', owners), 'a') === alone)
ok('ο φόρος ΟΛΟΥ του λογαριασμού ήταν μεγαλύτερος (το σφάλμα)', taxShareOf(props, 'a') > alone)

// ═══ Ο «ΠΕΛΑΤΗΣ» ΔΕΝ ΕΙΝΑΙ ΦΟΡΟΛΟΓΟΥΜΕΝΟΣ ══════════════════════════════════
// Ακίνητο συνδεδεμένο με επισκέπτη ανήκει στον κάτοχο, μαζί με το ασύνδετο.
ok('επισκέπτης → κάτοχος', taxpayerOf(props[3], owners) === ACCOUNT_HOLDER)
ok('κάτοχος: ασύνδετο + συνδεδεμένο με επισκέπτη', JSON.stringify(sameTaxpayer(props, 'c', owners).map(p => p.id)) === '["c","d"]')

// ═══ Ο ΙΔΙΩΤΗΣ ΔΕΝ ΑΛΛΑΖΕΙ ═════════════════════════════════════════════════
ok('χωρίς πελατολόγιο (ιδιώτης): όλα', sameTaxpayer(props, 'a', null).length === 4)
// ΕΠΑΓΓΕΛΜΑΤΙΑΣ ΧΩΡΙΣ ΚΑΡΤΕΛΕΣ «ΙΔΙΟΚΤΗΤΗΣ» (05.10.2026): ως τότε έπαιρνε την
// ένωση όλων των ακινήτων που διαχειρίζεται. Χωρίς γνωστό ιδιοκτήτη, μόνο το ίδιο.
ok('επαγγελματίας χωρίς ιδιοκτήτες: μόνο το ίδιο το ακίνητο', JSON.stringify(sameTaxpayer(props, 'a', new Set()).map(p => p.id)) === '["a"]')
ok('επαγγελματίας χωρίς ιδιοκτήτες: ποτέ η ένωση του λογαριασμού', sameTaxpayer(props, 'c', new Set()).length === 1)

console.log(`taxpayer: ${pass} ✓ · ${fail} ✗`)
if (fail) process.exit(1)
