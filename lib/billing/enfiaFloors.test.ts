// Τρέξε: npx tsx lib/billing/enfiaFloors.test.ts
//
// Η ΕΤΙΚΕΤΑ ΛΕΕΙ ΤΟΥΣ ΟΡΟΦΟΥΣ ΠΟΥ ΠΑΙΡΝΕΙ ΤΟ ΚΛΕΙΔΙ. Η `enfiaFloorKeyFromValue`
// είναι η αντιστοίχιση ορόφου → κλειδί που ακολουθεί τον νόμο. Για κάθε όροφο
// από τον 1ο ως τον 12ο, η ετικέτα του κλειδιού που επιστρέφει πρέπει να
// περιέχει αυτόν τον όροφο: ρητά («4ος και 5ος») ή ως «και πάνω» από τον
// μικρότερο που γράφει. Το «5ος και άνω» πάνω στο `fifth_plus` κόβεται εδώ,
// γιατί ο 5ος αντιστοιχίζεται στο `fourth`.
import { ENFIA_FLOOR_COEF, enfiaFloorKeyFromValue } from './enfia'
import { ENFIA_FLOOR_LABEL, ENFIA_FLOOR_SHORT } from './enfiaFloors'
import { readFileSync } from 'node:fs'

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

// ═══ #398: «ΟΡΟΦΟΣ 2ος ΟΡΟΦΟΣ» ΣΤΟ ΧΑΡΤΙ ΤΗΣ ΕΚΤΙΜΗΣΗΣ ═══════════════════════
// Το χαρτί του υπολογιστή και οι κάρτες των σειρών βάζουν την ετικέτα δίπλα
// στο κλειδί «Όροφος». Η σύντομη ετικέτα δεν ξαναλέει τη λέξη και βγαίνει από
// την ετικέτα του μενού, ώστε να υπάρχει μία πηγή.
for (const key of Object.keys(ENFIA_FLOOR_COEF) as (keyof typeof ENFIA_FLOOR_COEF)[]) {
  const short = ENFIA_FLOOR_SHORT[key]
  ok(`σύντομη ετικέτα για το ${key}`, typeof short === 'string' && short.length > 0)
  ok(`«Όροφος ${short}» δεν λέει «όροφος» δεύτερη φορά`, !/όροφ/iu.test(short))
  ok(`η σύντομη του ${key} είναι η ετικέτα του μενού χωρίς τη λέξη`, ENFIA_FLOOR_LABEL[key].startsWith(short))
}
ok('«2ος όροφος» → «2ος»', ENFIA_FLOOR_SHORT.second === '2ος')
ok('«Ισόγειο» μένει ίδιο', ENFIA_FLOOR_SHORT.ground === ENFIA_FLOOR_LABEL.ground)
ok('«4ος και 5ος» μένει ίδιο', ENFIA_FLOOR_SHORT.fourth === ENFIA_FLOOR_LABEL.fourth)
// Κανένα ζεύγος «Όροφος» με την ετικέτα του μενού στις τρεις επιφάνειες που το είχαν.
for (const f of ['app/ypologismos-enfia/EnfiaCalculator.tsx', 'scripts/marketing/seires.ts', 'scripts/marketing/reelSeires.ts']) {
  const src = readFileSync(f, 'utf8')
  const bad = src.split('\n').filter(l => /['"]Όροφος['"]\s*,\s*(v:\s*)?[^\]}]*(ENFIA_FLOOR_LABEL|floorLabel|FLOORS\.find)/.test(l))
  ok(`${f}: το κλειδί «Όροφος» παίρνει τη σύντομη ετικέτα`, bad.length === 0)
}

console.log(failed === 0 ? `✓ enfiaFloors: ${passed} έλεγχοι πέρασαν` : `✗ enfiaFloors: ${failed} απέτυχαν από ${passed + failed}`)
if (failed > 0) process.exit(1)
