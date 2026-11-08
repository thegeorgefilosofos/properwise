// npx tsx lib/core/rowFromForm.test.ts
//
// Η ΓΡΑΜΜΗ ΑΠΟ ΤΗ ΦΟΡΜΑ. Το '' σε στήλη ημερομηνίας έριχνε ολόκληρη την
// εγγραφή (Postgres 22007, 06/11/2026). Ελέγχονται και οι δύο κατευθύνσεις:
// τι γίνεται null ΚΑΙ τι δεν επιτρέπεται να πειραχτεί.
import { rowFromForm, cleanValue } from './rowFromForm'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

// Η επισκευή όπως την κρατά η φόρμα, με κενή ημερομηνία (η προεπιλογή της).
const repair = rowFromForm({ repair_date: '', cost: 120, technician: '  Γ. Μάστορας ', description: 'Βρύση' })
ok('η κενή ημερομηνία γίνεται null, όχι ""', repair.repair_date === null)
ok('το κείμενο κόβεται στις άκρες', repair.technician === 'Γ. Μάστορας')
ok('ο αριθμός μένει αριθμός', repair.cost === 120)
ok('το συμπληρωμένο κείμενο μένει', repair.description === 'Βρύση')

ok('σκέτα κενά διαστήματα γίνονται null', cleanValue('   ') === null)
ok('NaN από parseFloat("") γίνεται null', cleanValue(parseFloat('')) === null)
ok('Infinity γίνεται null', cleanValue(Infinity) === null)
ok('το μηδέν ΔΕΝ γίνεται null', cleanValue(0) === 0)
ok('το false ΔΕΝ γίνεται null', cleanValue(false) === false)
ok('το null μένει null', cleanValue(null) === null)
ok('το undefined μένει undefined (η στήλη δεν αγγίζεται)', cleanValue(undefined) === undefined)
const arr = ['a']
ok('ο πίνακας περνά ο ίδιος', cleanValue(arr) === arr)
ok('η έγκυρη ημερομηνία μένει', cleanValue('2026-11-06') === '2026-11-06')

const keys = Object.keys(rowFromForm({ a: '', b: 1, c: undefined }))
ok('κανένα κλειδί δεν χάνεται ούτε προστίθεται', keys.join(',') === 'a,b,c')

console.log(fail === 0 ? `✓ rowFromForm: ${pass} έλεγχοι πέρασαν` : `✗ rowFromForm: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
