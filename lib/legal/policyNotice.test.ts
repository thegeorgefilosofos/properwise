// npx tsx lib/legal/policyNotice.test.ts
import { policyNoticeDue, POLICY_CHANGE_SUMMARY } from './policyNotice'
import { POLICY_VERSION } from './identity'
import { TRIAL_SCANS_PER_MONTH } from '@/lib/billing/aiLimits'
import { PRIORITY_SUPPORT_LINE } from '@/lib/billing/plans'

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
ok('η ενημέρωση της 3.10 δεν καλύπτει τη νέα έκδοση', policyNoticeDue({ policy_notice_seen: '2026-10-03' }, '2026-10-03'))

console.log(fail ? `✗ policyNotice: ${fail} απέτυχαν από ${pass + fail}` : `✓ policyNotice: ${pass} έλεγχοι πέρασαν`)
if (fail) process.exit(1)
