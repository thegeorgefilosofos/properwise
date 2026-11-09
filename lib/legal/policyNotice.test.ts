// npx tsx lib/legal/policyNotice.test.ts
import { policyNoticeDue, POLICY_CHANGE_SUMMARY, policyChangeSummary } from './policyNotice'
import { POLICY_VERSION } from './identity'
import { MERCHANT_NAMES } from './merchant'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }

ok('παλιός λογαριασμός χωρίς ίχνος: τη βλέπει', policyNoticeDue({ consent_policy_version: '2026-09' }, null))
ok('χωρίς στοιχεία λογαριασμού: τη βλέπει', policyNoticeDue(null, null))
ok('την έκλεισε σε αυτή τη συσκευή: όχι', !policyNoticeDue({ consent_policy_version: '2026-09' }, POLICY_VERSION))
ok('την έκλεισε σε άλλη συσκευή: όχι', !policyNoticeDue({ policy_notice_seen: POLICY_VERSION }, null))
ok('εγγράφηκε με αυτή την έκδοση: όχι', !policyNoticeDue({ consent_policy_version: POLICY_VERSION }, null))
ok('έκλεισε παλιότερη ενημέρωση: τη βλέπει', policyNoticeDue({ policy_notice_seen: '2026-09' }, '2026-09'))
// Η ΕΚΔΟΣΗ 2026-11-09 (νομικός έλεγχος 09/11/2026): η περίληψη λέει το
// δικαίωμα του νόμου ως δικαίωμα του νόμου και δεν γράφει ποσό ή προθεσμία.
ok('η πρόταση λέει το δικαίωμα υπαναχώρησης του νόμου', POLICY_CHANGE_SUMMARY.includes('δικαίωμα υπαναχώρησης του νόμου'))
ok('η πρόταση δεν λέει «εγγύηση»', !/εγγύηση/i.test(POLICY_CHANGE_SUMMARY))
ok('η πρόταση δεν γράφει αριθμούς', !/\d/.test(policyChangeSummary()))
ok('η πρόταση λέει τις δύο συγκαταθέσεις', POLICY_CHANGE_SUMMARY.includes('χωριστές συγκαταθέσεις'))
ok('δεν ονομάζει πωλητή που ίσως δεν πουλά', !Object.values(MERCHANT_NAMES).some(n => POLICY_CHANGE_SUMMARY.includes(n)))
ok('η ενημέρωση της 3.10 δεν καλύπτει τη νέα έκδοση', policyNoticeDue({ policy_notice_seen: '2026-10-03' }, '2026-10-03'))

console.log(fail ? `✗ policyNotice: ${fail} απέτυχαν από ${pass + fail}` : `✓ policyNotice: ${pass} έλεγχοι πέρασαν`)
if (fail) process.exit(1)
