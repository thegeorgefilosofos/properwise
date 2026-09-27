// npx tsx lib/billing/variantMap.test.ts
//
// Ο ΧΑΡΤΗΣ ΓΡΑΦΕΤΑΙ ΜΕ ΤΟ ΧΕΡΙ, ΣΕ ΠΕΔΙΟ ΙΣΤΟΣΕΛΙΔΑΣ, ΜΙΑ ΦΟΡΑ.
// Αρα το πιθανότερο λάθος είναι τυπογραφικό και το χειρότερο αποτέλεσμα είναι
// να περάσει σιωπηλά: πελάτης που πλήρωσε και δεν πήρε πακέτο, ή πακέτο που
// δόθηκε χωρίς πληρωμή. Κάθε έλεγχος εδώ ζητά το λάθος να λέγεται ονομαστικά.
import { parseVariantMap, planOfVariant } from './variantMap'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

const ENV = 'CREEM_PRODUCTS'

{
  const r = parseVariantMap('prod_a:solo:monthly, prod_b:solo:annual ,prod_c:owner:monthly', ENV)
  ok('τρία προϊόντα, καμία διαμαρτυρία', r.error === '' && r.map.size === 3)
  ok('το προϊόν δίνει πακέτο και κύκλο',
    planOfVariant(r.map, 'prod_b')?.plan === 'solo' && planOfVariant(r.map, 'prod_b')?.cycle === 'annual')
  ok('προϊόν εκτός χάρτη δεν αναβαθμίζει κανέναν', planOfVariant(r.map, 'prod_zzz') === null)
}
{
  // ΤΟ ΤΥΠΟΓΡΑΦΙΚΟ ΣΤΟ ΟΝΟΜΑ ΠΑΚΕΤΟΥ ΕΙΝΑΙ ΤΟ ΠΙΘΑΝΟΤΕΡΟ ΛΑΘΟΣ. Το
  // normalizePlan θα το γύριζε σιωπηλά σε «free»: ο πελάτης θα πλήρωνε και
  // δεν θα έπαιρνε τίποτα.
  const r = parseVariantMap('prod_a:sollo:monthly', ENV)
  ok('άγνωστο πακέτο καταγγέλλεται αντί να γίνει «free»', r.error.includes('sollo') && r.map.size === 0)
}
{
  const r = parseVariantMap('prod_a:solo:μηνιαίο', ENV)
  ok('άγνωστος κύκλος καταγγέλλεται', r.error.includes('κύκλος') && r.map.size === 0)
}
{
  const r = parseVariantMap('prod_a:solo:monthly,prod_a:owner:annual', ENV)
  ok('το ίδιο προϊόν δύο φορές είναι σφάλμα, όχι «η τελευταία νικά»',
    r.error.includes('δύο φορές') && r.map.get('prod_a')?.plan === 'solo')
}
{
  const r = parseVariantMap('prod_a-solo-monthly', ENV)
  ok('λάθος μορφή καταγγέλλεται ονομαστικά', r.error.includes('prod_a-solo-monthly'))
}
// ΤΟ ΣΦΑΛΜΑ ΛΕΕΙ ΤΗ ΜΕΤΑΒΛΗΤΗ ΤΟΥ ΕΜΠΟΡΟΥ ΠΟΥ ΤΡΕΧΕΙ. Πριν, το όνομα είχε
// προεπιλογή του πρώτου παρόχου και έστελνε σε μεταβλητή που δεν υπάρχει.
ok('κενή μεταβλητή λέει ποια μεταβλητή λείπει', parseVariantMap('', ENV).error.includes(ENV))
ok('και το undefined το ίδιο', parseVariantMap(undefined, ENV).error.includes(ENV))
ok('και το null το ίδιο', parseVariantMap(null, 'ΑΛΛΗ_ΜΕΤΑΒΛΗΤΗ').error.includes('ΑΛΛΗ_ΜΕΤΑΒΛΗΤΗ'))

console.log(fail === 0 ? `✓ variantMap: ${pass} έλεγχοι πέρασαν` : `✗ variantMap: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
