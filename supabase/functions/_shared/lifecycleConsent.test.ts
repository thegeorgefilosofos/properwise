// Εμπορικό email κύκλου ζωής μόνο με ρητό «ναι»· τα συναλλακτικά φεύγουν πάντα.
// Τρέξε: npx tsx supabase/functions/_shared/lifecycleConsent.test.ts
import { readFileSync } from 'node:fs'
import { COMMERCIAL, prefsFromRow } from './lifecycleConsent.ts'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) { if (cond) passed++; else { failed++; console.log('  ✗ ' + name) } }

const APP = 'https://app.example'

// ── Η απόφαση από τη γραμμή ──────────────────────────────────────────────
ok('ρητό true: φεύγει', prefsFromRow([{ product_news: true, unsubscribe_token: 't1' }], APP)?.optedIn === true)
ok('false: δεν φεύγει', prefsFromRow([{ product_news: false, unsubscribe_token: 't1' }], APP)?.optedIn === false)
// Αυτές οι τρεις περνούσαν με το παλιό `!== false`.
ok('λείπει η στήλη: δεν είναι συναίνεση', prefsFromRow([{ unsubscribe_token: 't1' }], APP)?.optedIn === false)
ok('null: δεν είναι συναίνεση', prefsFromRow([{ product_news: null, unsubscribe_token: 't1' }], APP)?.optedIn === false)
ok('κείμενο "true": δεν είναι συναίνεση', prefsFromRow([{ product_news: 'true', unsubscribe_token: 't1' }], APP)?.optedIn === false)

ok('χωρίς γραμμή: null', prefsFromRow([], APP) === null)
ok('χωρίς διακριτικό: null', prefsFromRow([{ product_news: true, unsubscribe_token: '' }], APP) === null)
ok('μη κείμενο διακριτικό: null', prefsFromRow([{ product_news: true, unsubscribe_token: 42 }], APP) === null)
ok('μονή γραμμή (όχι πίνακας) διαβάζεται', prefsFromRow({ product_news: true, unsubscribe_token: 't2' }, APP)?.optedIn === true)
ok('σύνδεσμος απεγγραφής από το διακριτικό', prefsFromRow([{ product_news: true, unsubscribe_token: ' t3 ' }], APP)?.unsubUrl === `${APP}/unsubscribe/t3`)

// ── Τα συναλλακτικά δεν περνούν από τη συναίνεση ────────────────────────
for (const e of ['welcome', 'plan_upgraded', 'plan_downgraded', 'new_property'])
  ok(`το ${e} είναι συναλλακτικό`, !COMMERCIAL.has(e))
for (const e of ['upsell', 'seasonal', 'legislation', 'feedback', 'referral_invite', 'mobile_launch'])
  ok(`το ${e} είναι εμπορικό`, COMMERCIAL.has(e))

// ── Η συνάρτηση χρησιμοποιεί τον κανόνα και όχι το παλιό φίλτρο ─────────
const src = readFileSync(new URL('../send-lifecycle-email/index.ts', import.meta.url), 'utf8')
ok('το send-lifecycle-email δεν ρωτά `product_news !== false`', !/product_news\s*!==\s*false/.test(src))
ok('το send-lifecycle-email περνά από το prefsFromRow', /prefsFromRow\(/.test(src))

console.log(`lifecycleConsent: ✓ ${passed} · ✗ ${failed}`)
if (failed) process.exit(1)
