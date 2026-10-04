// npx tsx lib/legal/policyNotice.test.ts
import { policyNoticeDue, POLICY_CHANGE_SUMMARY, policyChangeSummary } from './policyNotice'
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

console.log(fail ? `✗ policyNotice: ${fail} απέτυχαν από ${pass + fail}` : `✓ policyNotice: ${pass} έλεγχοι πέρασαν`)
if (fail) process.exit(1)
