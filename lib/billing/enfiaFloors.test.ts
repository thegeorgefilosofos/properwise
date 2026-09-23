// Τρέξε: npx tsx lib/billing/enfiaFloors.test.ts
//
// Η ΕΤΙΚΕΤΑ ΛΕΕΙ ΤΟΥΣ ΟΡΟΦΟΥΣ ΠΟΥ ΠΑΙΡΝΕΙ ΤΟ ΚΛΕΙΔΙ. Η `enfiaFloorKeyFromValue`
// είναι η αντιστοίχιση ορόφου → κλειδί που ακολουθεί τον νόμο. Για κάθε όροφο
// από τον 1ο ώς τον 12ο, η ετικέτα του κλειδιού που επιστρέφει πρέπει να
// περιέχει αυτόν τον όροφο: ρητά («4ος και 5ος») ή ως «και πάνω» από τον
// μικρότερο που γράφει. Το «5ος και άνω» πάνω στο `fifth_plus` κόβεται εδώ,
// γιατί ο 5ος αντιστοιχίζεται στο `fourth`.
import { ENFIA_FLOOR_COEF, enfiaFloorKeyFromValue } from './enfia'
import { ENFIA_FLOOR_LABEL } from './enfiaFloors'

let passed = 0, failed = 0
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; console.error('✗ ' + name) } }

/** Οι όροφοι που δηλώνει μια ετικέτα: οι ρητοί αριθμοί και, με «πάνω/άνω», όλοι οι επόμενοι. */
function floorsOf(label: string): (n: number) => boolean {
  const nums = (label.match(/\d+/g) || []).map(Number)
  const open = /πάνω|άνω/.test(label)
  return n => nums.includes(n) || (open && nums.length > 0 && n >= Math.min(...nums))
}

for (const key of Object.keys(ENFIA_FLOOR_COEF)) {
  ok(`ετικέτα για το κλειδί ${key}`, typeof ENFIA_FLOOR_LABEL[key as keyof typeof ENFIA_FLOOR_COEF] === 'string')
}

for (let n = 1; n <= 12; n++) {
  const key = enfiaFloorKeyFromValue(n) as keyof typeof ENFIA_FLOOR_COEF
  const label = ENFIA_FLOOR_LABEL[key]
  ok(`${n}ος όροφος → «${label}» τον περιλαμβάνει`, !!label && floorsOf(label)(n))
  // Και ανάποδα: κανένα ΑΛΛΟ κλειδί δεν δηλώνει τον ίδιο όροφο.
  for (const other of Object.keys(ENFIA_FLOOR_LABEL) as (keyof typeof ENFIA_FLOOR_COEF)[]) {
    if (other === key) continue
    ok(`${n}ος όροφος δεν δηλώνεται και στο «${ENFIA_FLOOR_LABEL[other]}»`, !floorsOf(ENFIA_FLOOR_LABEL[other])(n))
  }
}

ok('ο 5ος παίρνει 1,02 όπως ο 4ος', ENFIA_FLOOR_COEF[enfiaFloorKeyFromValue(5) as keyof typeof ENFIA_FLOOR_COEF] === 1.02)
ok('ο 6ος παίρνει 1,03', ENFIA_FLOOR_COEF[enfiaFloorKeyFromValue(6) as keyof typeof ENFIA_FLOOR_COEF] === 1.03)

console.log(failed === 0 ? `✓ enfiaFloors: ${passed} έλεγχοι πέρασαν` : `✗ enfiaFloors: ${failed} απέτυχαν από ${passed + failed}`)
if (failed > 0) process.exit(1)
