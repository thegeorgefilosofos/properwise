// npx tsx lib/legal/policyNotice.test.ts
import { readFileSync } from 'node:fs'
import { policyNoticeDue, policyNoticeCopy, sawLegalReview, LEGAL_REVIEW_VERSION, firmNoticeDue, FIRM_NOTICE_VERSION, FIRM_NOTICE_BODY, FIRM_NOTICE_TITLE, FIRM_NOTICE_HREF, FIRM_NOTICE_POLICIES } from './policyNotice'
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
// ── Τι λέει η ειδοποίηση: ανάλογα με το τι έχει ήδη δει (09/11/2026) ──
// Η νομική ενημέρωση της 2026-11-09 δεν χάνεται επειδή ήρθε η 2026-11-10.
const sawReview = policyNoticeCopy({ policy_notice_seen: '2026-11-09' }, null)
const missedReview = policyNoticeCopy({ policy_notice_seen: '2026-10-03', consent_policy_version: '2026-09' }, '2026-10-03')
const never = policyNoticeCopy(null, null)
const all = [sawReview, missedReview, never]
ok('είδε την 2026-11-09 (λογαριασμός): μόνο η προσθήκη', sawReview.summary.includes('δεν αποθηκεύεται') && sawReview.summary.includes('PDF διαβάζεται μόνο στη συσκευή') && !sawReview.summary.includes('υπαναχώρησης') && !sawReview.summary.includes('συγκαταθέσεις'))
ok('είδε την 2026-11-09: «Ενημερώσαμε την Πολιτική απορρήτου.»', sawReview.headline === 'Ενημερώσαμε την Πολιτική απορρήτου.' && !sawReview.short.includes('Όροι') && sawReview.href === '/privacy')
ok('είδε την 2026-11-09 σε αυτή τη συσκευή: μόνο η προσθήκη', policyNoticeCopy({}, LEGAL_REVIEW_VERSION).headline === sawReview.headline)
ok('εγγράφηκε με την 2026-11-09: μόνο η προσθήκη', sawLegalReview({ consent_policy_version: '2026-11-09' }, null))
ok('έκλεισε ήδη την 2026-11-10 αλλού: η δική της περίληψη', sawLegalReview({ policy_notice_seen: POLICY_VERSION }, null))
ok('δεν είδε την 2026-11-09: πρώτα ο νομικός έλεγχος, μετά η προσθήκη', missedReview.summary.includes('δικαίωμα υπαναχώρησης του νόμου') && missedReview.summary.includes('χωριστές συγκαταθέσεις')
  && missedReview.summary.indexOf('υπαναχώρησης') < missedReview.summary.indexOf('δεν αποθηκεύεται') && missedReview.summary.includes('PDF διαβάζεται μόνο στη συσκευή'))
ok('δεν είδε την 2026-11-09: «Ενημερώσαμε τους Όρους και την Πολιτική απορρήτου.»', missedReview.headline === 'Ενημερώσαμε τους Όρους και την Πολιτική απορρήτου.' && missedReview.href === '/terms')
ok('χωρίς κανένα ίχνος: όπως όποιος δεν την είδε', never.summary === missedReview.summary && never.headline === missedReview.headline)
ok('άκυρο ίχνος δεν μετρά ως «είδε»', !sawLegalReview({ policy_notice_seen: 'x', consent_policy_version: 20261109 }, 'ναι'))
ok('η περίληψη δεν λέει «εγγύηση»', all.every(c => !/εγγύηση/i.test(c.summary)))
ok('η περίληψη δεν γράφει αριθμούς', all.every(c => !/\d/.test(c.summary + c.headline + c.short)))
ok('δεν ονομάζει πωλητή που ίσως δεν πουλά', all.every(c => !Object.values(MERCHANT_NAMES).some(n => c.summary.includes(n))))
ok('όποιος έκλεισε την ειδοποίηση της 2026-11-09 βλέπει τη νέα', (POLICY_VERSION as string) !== '2026-11-09' && policyNoticeDue({ policy_notice_seen: '2026-11-09' }, '2026-11-09'))
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
ok('ζει στην τρέχουσα έκδοση της πολιτικής', FIRM_NOTICE_POLICIES.includes(POLICY_VERSION) && firmNoticeDue(owner, null))
ok('στην 2026-11-09 τη βλέπει ακόμη', firmNoticeDue(owner, null, '2026-11-09'))
ok('στην 2026-11-10 τη βλέπει ακόμη', firmNoticeDue(owner, null, '2026-11-10'))
ok('όποιος την έκλεισε δεν την ξαναβλέπει στην 2026-11-10', !firmNoticeDue({ ...owner, user_metadata: { firm_notice_seen: V } }, null, '2026-11-10'))
ok('όποιος την έκλεισε στην 2026-11-05 δεν την ξαναβλέπει στην 2026-11-09', !firmNoticeDue({ ...owner, user_metadata: { firm_notice_seen: V } }, null, '2026-11-09'))
ok('δύο προτάσεις', (FIRM_NOTICE_BODY.match(/\./g) ?? []).length === 2)
ok('λέει ότι ενημερώθηκε η Πολιτική απορρήτου', FIRM_NOTICE_BODY.includes('Πολιτική απορρήτου'))
ok('κανένα κόμμα πριν από «και»', !/,\s+και\s/.test(FIRM_NOTICE_BODY + FIRM_NOTICE_TITLE))
ok('ο σύνδεσμος δείχνει την ενότητα των γραφείων', FIRM_NOTICE_HREF === '/privacy#grafeia')
ok('η ενότητα υπάρχει στην Πολιτική απορρήτου', readFileSync('app/privacy/page.tsx', 'utf8').includes(`id: '${FIRM_NOTICE_HREF.split('#')[1]}'`))

console.log(fail ? `✗ policyNotice: ${fail} απέτυχαν από ${pass + fail}` : `✓ policyNotice: ${pass} έλεγχοι πέρασαν`)
if (fail) process.exit(1)
