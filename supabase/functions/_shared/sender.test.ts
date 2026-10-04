// Ο αποστολέας των email: η τελεία στο τέλος δεν σταματά πια την παράδοση.
// Τρέξε: npx tsx supabase/functions/_shared/sender.test.ts
import { senderFrom, DEFAULT_FROM, REPLY_TO } from './sender.mjs'
import { IDENTITY } from '../../../lib/legal/identity'

let passed = 0, failed = 0
function eq(name: string, got: unknown, want: unknown) {
  if (got === want) passed++; else { failed++; console.log(`  ✗ ${name}\n     πήρε ${JSON.stringify(got)}\n     ήθελε ${JSON.stringify(want)}`) }
}
const quiet = console.error
console.error = () => {}

eq('η τιμή του περιστατικού: τελεία στο τέλος', senderFrom('PROPERWISE <no-reply@properwise.gr>.'), 'PROPERWISE <no-reply@properwise.gr>')
eq('κενά και αλλαγή γραμμής στο τέλος', senderFrom('  PROPERWISE <no-reply@properwise.gr>\n'), 'PROPERWISE <no-reply@properwise.gr>')
eq('σωστή τιμή μένει ίδια', senderFrom('Ομάδα PROPERWISE <hello@properwise.gr>'), 'Ομάδα PROPERWISE <hello@properwise.gr>')
eq('σκέτη διεύθυνση', senderFrom('no-reply@properwise.gr'), 'no-reply@properwise.gr')
eq('κενό: ο προεπιλεγμένος', senderFrom(''), DEFAULT_FROM)
eq('χωρίς τιμή: ο προεπιλεγμένος', senderFrom(undefined), DEFAULT_FROM)
eq('χωρίς γωνίες ενώ έχει όνομα: ο προεπιλεγμένος', senderFrom('PROPERWISE no-reply@properwise.gr'), DEFAULT_FROM)
eq('χωρίς @: ο προεπιλεγμένος', senderFrom('PROPERWISE <no-reply>'), DEFAULT_FROM)
eq('εισαγωγικά γύρω από όλη την τιμή: ο προεπιλεγμένος', senderFrom('"PROPERWISE <no-reply@properwise.gr>"'), DEFAULT_FROM)
eq('ο προεπιλεγμένος περνά τον δικό του έλεγχο', senderFrom(DEFAULT_FROM), DEFAULT_FROM)
// Η απάντηση σε email φτάνει στην ίδια διεύθυνση υποστήριξης που γράφουν οι Όροι.
eq('το Reply-To είναι έγκυρο', senderFrom(REPLY_TO), REPLY_TO)
eq('το Reply-To είναι η διεύθυνση υποστήριξης', REPLY_TO.match(/<([^>]+)>/)?.[1], IDENTITY.supportEmail)

console.error = quiet
console.log(`\nsender: ${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
