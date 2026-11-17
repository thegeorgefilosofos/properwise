// Τρέξε: npx tsx supabase/functions/_shared/marketingAudience.test.ts
import { audience, batchKey, type PrefRow } from './marketingAudience.ts'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) { if (cond) passed++; else { failed++; console.log('  ✗ ' + name) } }

const users = [
  { id: 'a', email: 'a@x' }, // ναι
  { id: 'b', email: 'b@x' }, // απεγγραφή
  { id: 'c', email: 'c@x' }, // χωρίς γραμμή (π.χ. κόπηκε η ανάγνωση)
  { id: 'd', email: 'd@x' }, // ναι, χωρίς token
  { id: 'e', email: 'e@x' }, // τιμή που δεν είναι true
]
const prefs: PrefRow[] = [
  { user_id: 'a', product_news: true, unsubscribe_token: 'tok-a' },
  { user_id: 'b', product_news: false, unsubscribe_token: 'tok-b' },
  { user_id: 'd', product_news: true, unsubscribe_token: '' },
  { user_id: 'e', product_news: 'true', unsubscribe_token: 'tok-e' },
]
const r = audience(users, prefs, 'product_news')
ok('μόνο ο ρητός «ναι» με token', r.recipients.length === 1 && r.recipients[0].id === 'a' && r.recipients[0].token === 'tok-a')
ok('η απεγγραφή σέβεται', !r.recipients.some(x => x.id === 'b'))
ok('χωρίς γραμμή: δεν στέλνεται', !r.recipients.some(x => x.id === 'c'))
ok('χωρίς token: δεν στέλνεται και μετριέται', !r.recipients.some(x => x.id === 'd') && r.skippedNoToken === 1)
ok('μόνο ακριβώς true', !r.recipients.some(x => x.id === 'e'))
ok('το digest κοιτά τη δική του στήλη', audience(users, [{ user_id: 'a', product_news: true, market_news: false, unsubscribe_token: 't' }], 'market_news').recipients.length === 0)

// Κενός χάρτης (π.χ. αποτυχία ανάγνωσης): κανείς.
ok('κενές προτιμήσεις: κανένας παραλήπτης', audience(users, [], 'product_news').recipients.length === 0)

void (async () => {
  const k1 = await batchKey('nl', [{ id: 'a', email: '', token: '' }, { id: 'b', email: '', token: '' }])
  const k2 = await batchKey('nl', [{ id: 'a', email: '', token: '' }, { id: 'b', email: '', token: '' }])
  const k3 = await batchKey('nl', [{ id: 'a', email: '', token: '' }])
  ok('ίδια παρτίδα, ίδιο κλειδί', k1 === k2 && k1.startsWith('nl-'))
  ok('άλλη παρτίδα, άλλο κλειδί', k1 !== k3)
  const k4 = await batchKey('nl', [{ id: 'a', email: '', token: '' }, { id: 'b', email: '', token: '' }], 'άλλο μήνυμα')
  ok('άλλο μήνυμα στους ίδιους, άλλο κλειδί', k1 !== k4)
  console.log(`marketingAudience: ${passed} πέρασαν, ${failed} απέτυχαν`)
  if (failed) process.exit(1)
})()
