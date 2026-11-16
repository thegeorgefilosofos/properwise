// npx tsx lib/auth/signupConsent.test.ts
//
// Η ΑΠΟΔΕΙΞΗ ΣΥΓΚΑΤΑΘΕΣΗΣ ΔΕΝ ΧΑΝΕΤΑΙ ΣΙΩΠΗΛΑ. Η αποδοχή δίνεται με το πάτημα
// του κουμπιού· αν η `signUp` με email ή η επιστροφή της Google (`oauth=1`)
// πάψουν να γράφουν πότε και ποια έκδοση, εδώ κοκκινίζει.
import { consentStamp, signupData, oauthPatch } from './signupConsent'
import { POLICY_VERSION } from '../legal/identity'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

const NOW = new Date('2026-11-13T10:00:00Z')
const NONE = { product: false, market: false }

const s = consentStamp(NOW)
ok('σφραγίδα: ώρα', s.consent_terms_accepted_at === NOW.toISOString())
ok('σφραγίδα: έκδοση', s.consent_policy_version === POLICY_VERSION && !!POLICY_VERSION)

// ── Email: τα `data` της signUp ──
const d = signupData({ news: NONE }, NOW)
ok('email: consent_terms_accepted_at', d.consent_terms_accepted_at === NOW.toISOString())
ok('email: consent_policy_version', d.consent_policy_version === POLICY_VERSION)
const df = signupData({ firm: { account_kind: 'firm', consent_terms_accepted_at: 'x' }, news: NONE, refCode: 'ABC', plan: 'owner', cycle: 'annual' }, NOW)
ok('email: το γραφείο δεν σβήνει τη σφραγίδα', df.consent_terms_accepted_at === NOW.toISOString() && df.account_kind === 'firm')
ok('email: πρόσκληση και πακέτο', df.referred_by === 'ABC' && df.chosen_plan === 'owner' && df.chosen_cycle === 'annual')
ok('email: χωρίς πρόσκληση, χωρίς referred_by', !('referred_by' in d) && !('chosen_plan' in d))

// ── Google: η επιστροφή oauth=1 ──
const q = new URLSearchParams('oauth=1')
const p = oauthPatch({}, q, NONE, NOW)
ok('google: consent_terms_accepted_at', p.consent_terms_accepted_at === NOW.toISOString())
ok('google: consent_policy_version', p.consent_policy_version === POLICY_VERSION)
const kept = oauthPatch({ consent_terms_accepted_at: '2025-01-01T00:00:00Z', consent_policy_version: 'old' }, q, NONE, NOW)
ok('google: η ΠΡΩΤΗ απόδειξη δεν ξαναγράφεται', !('consent_terms_accepted_at' in kept) && !('consent_policy_version' in kept))
ok('google: πρόσκληση από τη διεύθυνση', oauthPatch({}, new URLSearchParams('oauth=1&ref=XYZ'), NONE, NOW).referred_by === 'XYZ')

console.log(`${fail ? '✗' : '✓'} απόδειξη συγκατάθεσης εγγραφής: ${pass} περνούν${fail ? `, ${fail} αποτυγχάνουν` : ''}`)
if (fail) process.exit(1)
