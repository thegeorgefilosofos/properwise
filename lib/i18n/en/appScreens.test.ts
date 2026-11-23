// npx tsx lib/i18n/en/appScreens.test.ts
//
// Η ΑΓΓΛΙΚΗ ΣΕΛΙΔΑ ΛΕΕΙ ΑΛΗΘΕΙΑ ΓΙΑ ΤΗ ΓΛΩΣΣΑ ΤΗΣ ΕΦΑΡΜΟΓΗΣ (Χ8, 23/11/2026).
// Το /en έγραφε «The app is in Greek today» ενώ Επισκόπηση, Δαπάνες,
// Ενοικιαστές και Λογαριασμός ήταν ήδη στα αγγλικά. Η πρόταση βγαίνει πλέον
// από τη λίστα των αγγλικών οθονών, που είναι δεμένη με τα λεξικά της εφαρμογής.
import { APP_EN_SCREENS, APP_LANGUAGE_EN } from './appScreens'
import { LANDING_EN, TOUR_EN } from './landing'
import { AUTH_EN } from './auth'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

const names = Object.values(APP_EN_SCREENS)
ok('ονομάζει κάθε αγγλική οθόνη', names.length >= 4 && names.every(n => APP_LANGUAGE_EN.includes(n)))
for (const [where, text] of [['αρχική', LANDING_EN.appLanguage], ['ξενάγηση', TOUR_EN.note], ['εγγραφή', AUTH_EN.signup.appLanguage]] as const) {
  ok(`${where}: όχι «in Greek today»`, !/in Greek (today|for now)\. English is on the way/.test(text))
  ok(`${where}: η ίδια πρόταση`, text.includes(APP_LANGUAGE_EN))
}
ok('χωρίς κόμμα πριν από το «and»', !/, and /.test(APP_LANGUAGE_EN))

console.log(`appScreens: ${pass} πέρασαν, ${fail} απέτυχαν`)
if (fail) process.exit(1)
