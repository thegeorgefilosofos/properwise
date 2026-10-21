// Τρέξε: npx tsx supabase/functions/calendar-feed/target.test.ts
//
// Η ΣΥΝΔΡΟΜΗ ΕΝΟΣ ΑΚΙΝΗΤΟΥ ΜΕΝΕΙ ΣΥΝΔΡΟΜΗ ΕΝΟΣ ΑΚΙΝΗΤΟΥ (έλεγχος 21/10/2026,
// εύρημα D). Η παλιά διεύθυνση `?token=…&property=X` ανακατευθύνεται με το
// `property`, ώστε η νέα διαδρομή να δείχνει μόνο εκείνο.
import { legacyFeedPath } from './target.ts'

let passed = 0, failed = 0
function eq(name: string, got: unknown, want: unknown) {
  if (got === want) passed++; else { failed++; console.log(`  ✗ ${name}\n     πήρε ${JSON.stringify(got)}\n     ήθελε ${JSON.stringify(want)}`) }
}
const q = (s: string) => legacyFeedPath(new URLSearchParams(s))
const T = 'a'.repeat(64)
const P = '3f2504e0-4f89-11d3-9a0c-0305e82c3301'

eq('χωρίς ακίνητο: όλη η συνδρομή', q(`token=${T}`), `/imerologio/${T}.ics`)
eq('με ακίνητο: περνά', q(`token=${T}&property=${P}`), `/imerologio/${T}.ics?property=${P}`)
eq('ακίνητο με κεφαλαία: πεζά', q(`token=${T}&property=${P.toUpperCase()}`), `/imerologio/${T}.ics?property=${P}`)
eq('κενό ακίνητο: σαν να μην υπάρχει', q(`token=${T}&property=`), `/imerologio/${T}.ics`)
eq('ακίνητο σε λάθος μορφή: δεν ανοίγει πλατύτερα', q(`token=${T}&property=all`), null)
eq('ακίνητο με έγχυση: απορρίπτεται', q(`token=${T}&property=${P}%26x%3D1`), null)
eq('κουπόνι σε λάθος μορφή', q(`token=zz&property=${P}`), null)
eq('κουπόνι κεφαλαία: πεζά', q(`token=${'A'.repeat(32)}`), `/imerologio/${'a'.repeat(32)}.ics`)

console.log(failed ? `✗ calendar-feed: ${failed} απέτυχαν από ${passed + failed}` : `✓ calendar-feed: ${passed} έλεγχοι πέρασαν`)
if (failed) process.exit(1)
