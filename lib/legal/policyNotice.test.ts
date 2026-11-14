// npx tsx lib/legal/policyNotice.test.ts
import { readFileSync } from 'node:fs'
import { policyNoticeDue, policyNoticeCopy, sawLegalReview, sawBulkImport, sawBackups, sawKeepCopy, LEGAL_REVIEW_VERSION, BULK_VERSION, BACKUP_VERSION, KEEP_COPY_VERSION, firmNoticeDue, FIRM_NOTICE_VERSION, FIRM_NOTICE_BODY, FIRM_NOTICE_TITLE, FIRM_NOTICE_HREF, FIRM_NOTICE_POLICIES } from './policyNotice'
import { POLICY_VERSION, POLICY_DATE, versionSeq } from './identity'
import { athensToday } from '@/lib/core/time'
import { MERCHANT_NAMES } from './merchant'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }

ok('παλιός λογαριασμός χωρίς ίχνος: τη βλέπει', policyNoticeDue({ consent_policy_version: '2026-09' }, null))
ok('χωρίς στοιχεία λογαριασμού: τη βλέπει', policyNoticeDue(null, null))
ok('την έκλεισε σε αυτή τη συσκευή: όχι', !policyNoticeDue({ consent_policy_version: '2026-09' }, POLICY_VERSION))
ok('την έκλεισε σε άλλη συσκευή: όχι', !policyNoticeDue({ policy_notice_seen: POLICY_VERSION }, null))
ok('εγγράφηκε με αυτή την έκδοση: όχι', !policyNoticeDue({ consent_policy_version: POLICY_VERSION }, null))
ok('έκλεισε παλιότερη ενημέρωση: τη βλέπει', policyNoticeDue({ policy_notice_seen: '2026-09' }, '2026-09'))
// ── Η ΠΡΩΤΗ ΕΠΙΣΚΟΠΗΣΗ ΤΟΥ ΝΕΟΥ ΛΟΓΑΡΙΑΣΜΟΥ (κριτική σχεδίασης r2, 13/11/2026) ──
// Ο χρήστης που μόλις δέχτηκε τους Όρους στην εγγραφή δεν διαβάζει «Νέοι Όροι
// και Απόρρητο» λίγα λεπτά μετά. Ο λογαριασμός που ΔΕΝ έχει καταγράψει αποδοχή
// της τρέχουσας έκδοσης τη βλέπει πάντα: καμία απόκρυψη χωρίς ίχνος.
{
  const now = new Date().toISOString()
  const fresh = { created_at: now, user_metadata: { consent_terms_accepted_at: now, consent_policy_version: POLICY_VERSION } }
  ok('νέος λογαριασμός με αποδοχή της τρέχουσας έκδοσης: ούτε γραμμή', !policyNoticeDue(fresh.user_metadata, null))
  ok('νέος λογαριασμός με αποδοχή της τρέχουσας έκδοσης: ούτε κάρτα γραφείων', !firmNoticeDue(fresh, null))
  ok('αποδοχή παλιότερης έκδοσης: τη βλέπει', policyNoticeDue({ consent_terms_accepted_at: now, consent_policy_version: '2026-11-12' } as Record<string, unknown>, null))
  ok('αποδοχή χωρίς καταγεγραμμένη έκδοση: τη βλέπει', policyNoticeDue({ consent_terms_accepted_at: now } as Record<string, unknown>, null))
  ok('έκδοση σε άλλη μορφή (αριθμός): τη βλέπει', policyNoticeDue({ consent_policy_version: 20261112 }, null))
  ok('χωρίς στοιχεία λογαριασμού στον νέο χρήστη: τη βλέπει', policyNoticeDue({}, null))
}
// ── Τι λέει η ειδοποίηση: ανάλογα με το τι έχει ήδη δει (09/11/2026) ──
// Καμία ειδοποίηση δεν χάνεται επειδή ήρθε νεότερη: η 2026-11-09 (νομικός
// έλεγχος), η 2026-11-10 (μαζική), η 2026-11-11 (αντίγραφα ασφαλείας), η
// 2026-11-12 (αντίγραφο της σάρωσης, PR 547) και η 2026-11-12.2 (Όροι, PR 559).
const sawKeep = policyNoticeCopy({ policy_notice_seen: '2026-11-12' }, null)
const sawBackup = policyNoticeCopy({ policy_notice_seen: '2026-11-11' }, null)
const sawBulk = policyNoticeCopy({ policy_notice_seen: '2026-11-10' }, null)
const sawReview = policyNoticeCopy({ policy_notice_seen: '2026-11-09' }, null)
const missedReview = policyNoticeCopy({ policy_notice_seen: '2026-10-03', consent_policy_version: '2026-09' }, '2026-10-03')
const never = policyNoticeCopy(null, null)
const all = [sawKeep, sawBackup, sawBulk, sawReview, missedReview, never]
const backups = (c: { summary: string }) => c.summary.includes('αντίγραφα ασφαλείας φυλάσσονται στη Φρανκφούρτη') && c.summary.includes('κάθε Κυριακή') && c.summary.includes('μόνο το κλειδί')
const keepCopy = (c: { summary: string }) => c.summary.includes('«Κράτα αντίγραφο στον Φάκελο»') && c.summary.includes('ΑΦΜ') && c.summary.includes('το πρωτότυπο μπαίνει ολόκληρο')
const trialTerms = (c: { summary: string }) => c.summary.includes('Οι Όροι λένε πλέον ότι η δοκιμή έχει δικό της όριο') && c.summary.includes('κοινό μηνιαίο απόθεμα') && c.summary.includes('έχουν τα όρια του πακέτου τους') && c.summary.includes('πότε αλλάζεις πακέτο')
// Η ΕΚΔΟΣΗ: νέα, μετά την 2026-11-12 που ήδη είναι στην παραγωγή, χωρίς μελλοντική ημερομηνία.
ok('η έκδοση είναι η δεύτερη της 2026-11-12', POLICY_VERSION === '2026-11-12.2' && POLICY_DATE === '2026-11-12' && versionSeq(POLICY_VERSION) === '2' && versionSeq('2026-11-12') === '')
ok('ως κείμενο: μετά την 2026-11-12, πριν από την 2026-11-13', POLICY_VERSION > '2026-11-12' && POLICY_VERSION < '2026-11-13')
ok('η ημερομηνία της έκδοσης δεν είναι μελλοντική', POLICY_DATE <= athensToday())
ok('όλοι μαθαίνουν για τη δοκιμή, τα δώρα και την αλλαγή πακέτου', all.every(trialTerms))
ok('η αλλαγή των Όρων έρχεται τελευταία', all.every(c => c.summary.endsWith('μέσα από την εφαρμογή.')))
ok('η 2026-11-12.2 στέλνει στους Όρους', all.every(c => c.href === '/terms' && c.headline.includes('Όρους')))
// Η 2026-11-12.2 άλλαξε ΚΑΙ την Πολιτική απορρήτου (όρια της δοκιμής, έλεγχος PR 559):
// και όποιος είδε την 2026-11-12 πρέπει να το μάθει από την επικεφαλίδα.
const privacyLimits = (c: { summary: string }) => c.summary.includes('η Πολιτική απορρήτου λέει ότι το όριο των σαρώσεων της δοκιμής') && c.summary.includes('ισχύουν μόνο στη δοκιμή και στον συνεργάτη που δεν έχει σε ισχύ μήνες χωρίς χρέωση')
ok('είδε την 2026-11-12: ΜΟΝΟ η 2026-11-12.2, σε Όρους και Πολιτική', !keepCopy(sawKeep) && !backups(sawKeep) && sawKeep.headline === 'Ενημερώσαμε τους Όρους και την Πολιτική απορρήτου.' && sawKeep.short === 'Νέοι Όροι και Απόρρητο.')
ok('όλοι μαθαίνουν ότι άλλαξε η Πολιτική απορρήτου για τα όρια της δοκιμής', all.every(privacyLimits) && all.every(c => c.headline.includes('Πολιτική απορρήτου') && c.short.includes('Απόρρητο')))
ok('τα όρια της Πολιτικής έρχονται πριν από τους Όρους', all.every(c => c.summary.indexOf('η Πολιτική απορρήτου λέει ότι το όριο') < c.summary.indexOf('Οι Όροι λένε πλέον')))
ok('τα όρια της Πολιτικής έρχονται μετά το αντίγραφο της σάρωσης', [sawBackup, sawBulk, sawReview, missedReview, never].every(c => c.summary.indexOf('Κράτα αντίγραφο') < c.summary.indexOf('η Πολιτική απορρήτου λέει ότι το όριο')))
ok('είδε την 2026-11-12 σε αυτή τη συσκευή: το ίδιο', policyNoticeCopy({}, KEEP_COPY_VERSION).summary === sawKeep.summary)
ok('εγγράφηκε με την 2026-11-12: μόνο οι Όροι', sawKeepCopy({ consent_policy_version: '2026-11-12' }, null) && !sawKeepCopy({ consent_policy_version: '2026-11-11' }, null))
ok('όποιος έκλεισε την ειδοποίηση της 2026-11-12 τη βλέπει ξανά, μία φορά', policyNoticeDue({ policy_notice_seen: '2026-11-12' }, '2026-11-12') && !policyNoticeDue({ policy_notice_seen: POLICY_VERSION }, null) && !policyNoticeDue({}, POLICY_VERSION))
ok('όποιος εγγράφεται με την 2026-11-12.2 δεν τη βλέπει', !policyNoticeDue({ consent_policy_version: '2026-11-12.2' }, null))
ok('το «2026-11-12.2» μετρά ως «είδε» κάθε παλιότερη', sawKeepCopy({ policy_notice_seen: '2026-11-12.2' }, null) && sawLegalReview(null, '2026-11-12.2'))
ok('άκυρο αύξον δεν μετρά', !sawKeepCopy({ policy_notice_seen: '2026-11-12.x' }, null) && !sawKeepCopy({ policy_notice_seen: '2026-11-12.10' }, null))
const notKeep = [sawBackup, sawBulk, sawReview, missedReview, never]
ok('όσοι δεν είδαν την 2026-11-12 μαθαίνουν και για το αντίγραφο της σάρωσης', notKeep.every(keepCopy))
ok('το αντίγραφο της σάρωσης έρχεται μετά τα αντίγραφα ασφαλείας', notKeep.every(c => c.summary.indexOf('Κράτα αντίγραφο') > c.summary.indexOf('αντίγραφα ασφαλείας')))
ok('είδε την 2026-11-11: το αντίγραφο της σάρωσης και οι Όροι', !backups(sawBackup) && !sawBackup.summary.includes('μαζική καταχώρηση ακινήτων η φωτογραφία') && sawBackup.headline === 'Ενημερώσαμε τους Όρους και την Πολιτική απορρήτου.')
ok('είδε την 2026-11-11 σε αυτή τη συσκευή: το ίδιο', policyNoticeCopy({}, BACKUP_VERSION).summary === sawBackup.summary)
ok('εγγράφηκε με την 2026-11-11', sawBackups({ consent_policy_version: '2026-11-11' }, null) && !sawBackups({ consent_policy_version: '2026-11-10' }, null))
const others = [sawBulk, sawReview, missedReview, never]
ok('όσοι δεν είδαν την 2026-11-11 μαθαίνουν και για τα αντίγραφα ασφαλείας', others.every(backups))
ok('είδε την 2026-11-10 (λογαριασμός): χωρίς μαζική και νομικό έλεγχο', !sawBulk.summary.includes('μαζική καταχώρηση ακινήτων η φωτογραφία') && !sawBulk.summary.includes('υπαναχώρησης'))
ok('είδε την 2026-11-10 σε αυτή τη συσκευή: το ίδιο', policyNoticeCopy({}, BULK_VERSION).summary === sawBulk.summary)
ok('εγγράφηκε με την 2026-11-10: χωρίς τη μαζική καταχώρηση', sawBulkImport({ consent_policy_version: '2026-11-10' }, null) && !sawBulkImport({ consent_policy_version: '2026-11-09' }, null))
ok('είδε την 2026-11-09 (λογαριασμός): η μαζική καταχώρηση και τα αντίγραφα', sawReview.summary.includes('δεν αποθηκεύεται') && sawReview.summary.includes('PDF διαβάζεται μόνο στη συσκευή') && !sawReview.summary.includes('υπαναχώρησης') && !sawReview.summary.includes('συγκαταθέσεις')
  && sawReview.summary.indexOf('μαζική καταχώρηση') < sawReview.summary.indexOf('αντίγραφα ασφαλείας'))
ok('είδε την 2026-11-09: «Ενημερώσαμε τους Όρους και την Πολιτική απορρήτου.»', sawReview.headline === 'Ενημερώσαμε τους Όρους και την Πολιτική απορρήτου.' && sawReview.href === '/terms')
ok('είδε την 2026-11-09 σε αυτή τη συσκευή: μόνο η προσθήκη', policyNoticeCopy({}, LEGAL_REVIEW_VERSION).summary === sawReview.summary)
ok('εγγράφηκε με την 2026-11-09: μόνο η προσθήκη', sawLegalReview({ consent_policy_version: '2026-11-09' }, null))
ok('έκλεισε ήδη την τρέχουσα αλλού: η δική της περίληψη', sawLegalReview({ policy_notice_seen: POLICY_VERSION }, null))
ok('δεν είδε την 2026-11-09: πρώτα ο νομικός έλεγχος, μετά η προσθήκη', missedReview.summary.includes('δικαίωμα υπαναχώρησης του νόμου') && missedReview.summary.includes('χωριστές συγκαταθέσεις')
  && missedReview.summary.indexOf('υπαναχώρησης') < missedReview.summary.indexOf('δεν αποθηκεύεται') && missedReview.summary.includes('PDF διαβάζεται μόνο στη συσκευή')
  && missedReview.summary.indexOf('δεν αποθηκεύεται') < missedReview.summary.indexOf('αντίγραφα ασφαλείας φυλάσσονται'))
ok('δεν είδε την 2026-11-09: «Ενημερώσαμε τους Όρους και την Πολιτική απορρήτου.»', missedReview.headline === 'Ενημερώσαμε τους Όρους και την Πολιτική απορρήτου.' && missedReview.href === '/terms')
ok('χωρίς κανένα ίχνος: όπως όποιος δεν την είδε', never.summary === missedReview.summary && never.headline === missedReview.headline)
ok('άκυρο ίχνος δεν μετρά ως «είδε»', !sawLegalReview({ policy_notice_seen: 'x', consent_policy_version: 20261109 }, 'ναι'))
ok('η περίληψη δεν λέει «εγγύηση»', all.every(c => !/εγγύηση/i.test(c.summary)))
ok('η περίληψη δεν γράφει αριθμούς', all.every(c => !/\d/.test(c.summary + c.headline + c.short)))
ok('κανένα κόμμα πριν από «και» στην περίληψη', all.every(c => !/,\s+και\s/.test(c.summary + c.headline + c.short)))
ok('καμία παύλα στην περίληψη', all.every(c => !/[—–]/.test(c.summary + c.headline + c.short)))
ok('δεν ονομάζει πωλητή που ίσως δεν πουλά', all.every(c => !Object.values(MERCHANT_NAMES).some(n => c.summary.includes(n))))
ok('όποιος έκλεισε την ειδοποίηση της 2026-11-09 βλέπει τη νέα', (POLICY_VERSION as string) !== '2026-11-09' && policyNoticeDue({ policy_notice_seen: '2026-11-09' }, '2026-11-09'))
ok('όποιος έκλεισε την ειδοποίηση της 2026-11-10 τη βλέπει ξανά, μία φορά', (POLICY_VERSION as string) !== '2026-11-10' && policyNoticeDue({ policy_notice_seen: '2026-11-10' }, '2026-11-10') && !policyNoticeDue({ policy_notice_seen: POLICY_VERSION }, null))
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
ok('στην 2026-11-11 τη βλέπει ακόμη', firmNoticeDue(owner, null, '2026-11-11'))
ok('στην 2026-11-12 τη βλέπει ακόμη', firmNoticeDue(owner, null, '2026-11-12'))
ok('στην 2026-11-12.2 τη βλέπει ακόμη', firmNoticeDue(owner, null, '2026-11-12.2'))
ok('όποιος την έκλεισε δεν την ξαναβλέπει στην 2026-11-11', !firmNoticeDue({ ...owner, user_metadata: { firm_notice_seen: V } }, null, '2026-11-11'))
ok('όποιος την έκλεισε δεν την ξαναβλέπει στην 2026-11-10', !firmNoticeDue({ ...owner, user_metadata: { firm_notice_seen: V } }, null, '2026-11-10'))
ok('όποιος την έκλεισε στην 2026-11-05 δεν την ξαναβλέπει στην 2026-11-09', !firmNoticeDue({ ...owner, user_metadata: { firm_notice_seen: V } }, null, '2026-11-09'))
ok('δύο προτάσεις', (FIRM_NOTICE_BODY.match(/\./g) ?? []).length === 2)
ok('λέει ότι ενημερώθηκε η Πολιτική απορρήτου', FIRM_NOTICE_BODY.includes('Πολιτική απορρήτου'))
ok('κανένα κόμμα πριν από «και»', !/,\s+και\s/.test(FIRM_NOTICE_BODY + FIRM_NOTICE_TITLE))
ok('ο σύνδεσμος δείχνει την ενότητα των γραφείων', FIRM_NOTICE_HREF === '/privacy#grafeia')
ok('η ενότητα υπάρχει στην Πολιτική απορρήτου', readFileSync('app/privacy/page.tsx', 'utf8').includes(`id: '${FIRM_NOTICE_HREF.split('#')[1]}'`))

console.log(fail ? `✗ policyNotice: ${fail} απέτυχαν από ${pass + fail}` : `✓ policyNotice: ${pass} έλεγχοι πέρασαν`)
if (fail) process.exit(1)
