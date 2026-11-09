// npx tsx lib/legal/policyNotice.test.ts
import { readFileSync } from 'node:fs'
import { policyNoticeDue, POLICY_CHANGE_SUMMARY, policyChangeSummary, firmNoticeDue, FIRM_NOTICE_VERSION, FIRM_NOTICE_BODY, FIRM_NOTICE_TITLE, FIRM_NOTICE_HREF } from './policyNotice'
import { POLICY_VERSION } from './identity'
import { TRIAL_SCANS_PER_MONTH } from '@/lib/billing/aiLimits'
import { PRIORITY_SUPPORT_LINE } from '@/lib/billing/plans'
import { MERCHANT_NAMES } from './merchant'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }

ok('παλιός λογαριασμός χωρίς ίχνος: τη βλέπει', policyNoticeDue({ consent_policy_version: '2026-09' }, null))
ok('χωρίς στοιχεία λογαριασμού: τη βλέπει', policyNoticeDue(null, null))
ok('την έκλεισε σε αυτή τη συσκευή: όχι', !policyNoticeDue({ consent_policy_version: '2026-09' }, POLICY_VERSION))
ok('την έκλεισε σε άλλη συσκευή: όχι', !policyNoticeDue({ policy_notice_seen: POLICY_VERSION }, null))
ok('εγγράφηκε με αυτή την έκδοση: όχι', !policyNoticeDue({ consent_policy_version: POLICY_VERSION }, null))
ok('έκλεισε παλιότερη ενημέρωση: τη βλέπει', policyNoticeDue({ policy_notice_seen: '2026-09' }, '2026-09'))
ok('η πρόταση λέει το όριο από τη σταθερά', POLICY_CHANGE_SUMMARY.includes(`${TRIAL_SCANS_PER_MONTH} τον μήνα`))
ok('η πρόταση λέει την υποστήριξη με τη λέξη του τιμοκαταλόγου', POLICY_CHANGE_SUMMARY.includes(PRIORITY_SUPPORT_LINE))
ok('χωρίς τομέα παραλαβής δεν αναφέρει παραλαβή email', !policyChangeSummary('').includes('παραλαβή'))
ok('με τομέα παραλαβής την αναφέρει', policyChangeSummary('in.example.gr').includes('παραλαβή των email'))
ok('δεν ονομάζει πωλητή που ίσως δεν πουλά', !Object.values(MERCHANT_NAMES).some(n => POLICY_CHANGE_SUMMARY.includes(n)))
ok('η ενημέρωση της 3.10 δεν καλύπτει τη νέα έκδοση', policyNoticeDue({ policy_notice_seen: '2026-10-03' }, '2026-10-03'))

// ── Η ενημέρωση των γραφείων (ΑΠ-11): μία φορά, μόνο σε ιδιοκτήτη από πριν ──
const V = FIRM_NOTICE_VERSION
const owner = { created_at: '2026-10-01T09:00:00Z', user_metadata: { consent_policy_version: '2026-10-04' } }
ok('ιδιοκτήτης από πριν: τη βλέπει', firmNoticeDue(owner, null, V))
ok('λογαριασμός γραφείου: όχι', !firmNoticeDue({ ...owner, user_metadata: { account_kind: 'firm' } }, null, V))
ok('λογαριασμός της ίδιας ημέρας (Αθήνα): όχι', !firmNoticeDue({ created_at: '2026-11-04T22:30:00Z' }, null, V))
ok('λογαριασμός της παραμονής (Αθήνα): τη βλέπει', firmNoticeDue({ created_at: '2026-11-04T21:30:00Z' }, null, V))
ok('νεότερος λογαριασμός: όχι', !firmNoticeDue({ created_at: '2026-11-09T10:00:00Z' }, null, V))
ok('άγνωστη ημερομηνία: όχι', !firmNoticeDue({ user_metadata: {} }, null, V) && !firmNoticeDue({ created_at: 'x' }, null, V))
ok('χωρίς λογαριασμό: όχι', !firmNoticeDue(null, null, V))
ok('την έκλεισε σε αυτή τη συσκευή: όχι', !firmNoticeDue(owner, V, V))
ok('την έκλεισε σε άλλη συσκευή: όχι', !firmNoticeDue({ ...owner, user_metadata: { firm_notice_seen: V } }, null, V))
ok('έκλεισε τη γενική γραμμή της ίδιας έκδοσης: τη βλέπει ακόμη', firmNoticeDue({ ...owner, user_metadata: { policy_notice_seen: V } }, null, V))
ok('σε επόμενη έκδοση πολιτικής: δεν ξαναβγαίνει', !firmNoticeDue(owner, null, '2027-01-10'))
ok('ζει στην τρέχουσα έκδοση της πολιτικής', FIRM_NOTICE_VERSION === POLICY_VERSION || !firmNoticeDue(owner, null))
ok('δύο προτάσεις', (FIRM_NOTICE_BODY.match(/\./g) ?? []).length === 2)
ok('λέει ότι ενημερώθηκε η Πολιτική απορρήτου', FIRM_NOTICE_BODY.includes('Πολιτική απορρήτου'))
ok('κανένα κόμμα πριν από «και»', !/,\s+και\s/.test(FIRM_NOTICE_BODY + FIRM_NOTICE_TITLE))
ok('ο σύνδεσμος δείχνει την ενότητα των γραφείων', FIRM_NOTICE_HREF === '/privacy#grafeia')
ok('η ενότητα υπάρχει στην Πολιτική απορρήτου', readFileSync('app/privacy/page.tsx', 'utf8').includes(`id: '${FIRM_NOTICE_HREF.split('#')[1]}'`))

console.log(fail ? `✗ policyNotice: ${fail} απέτυχαν από ${pass + fail}` : `✓ policyNotice: ${pass} έλεγχοι πέρασαν`)
if (fail) process.exit(1)
