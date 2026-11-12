// npx tsx lib/billing/billingErrors.test.ts
//
// Ο ΛΟΓΟΣ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ ΦΤΑΝΕΙ ΣΤΗΝ ΟΘΟΝΗ ΧΡΕΩΣΗΣ.
// Ευρήματα 12 και 13 του ελέγχου της 12.11.2026: η κάρτα έγραφε «δοκίμασε
// ξανά σε λίγο» πάνω από το 409 της ενεργής συνδρομής και «δεν αναγνωρίζεται»
// πάνω από το όριο προσπαθειών και τη βλάβη.
import { readFileSync } from 'node:fs'
import { doorErrorMessage, testerErrorMessage, serverReason, TESTER_SAY } from './billingErrors'
import { MFA_REQUIRED, MFA_SAY } from '@/lib/auth/mfa'
import { ORIGIN_DENIED } from '@/lib/api/origin'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

const ACTIVE = 'Υπάρχει ήδη ενεργή συνδρομή. Η αλλαγή πακέτου γίνεται από τη διαχείριση συνδρομής.'

// ── ΟΙ ΠΟΡΤΕΣ ΤΟΥ ΠΑΡΟΧΟΥ ─────────────────────────────────────────────────
ok('το 409 λέει ότι υπάρχει ήδη συνδρομή', doorErrorMessage(409, { error: ACTIVE }, 'Το ταμείο') === ACTIVE)
ok('το 403 του δεύτερου βήματος λέει τη φράση, όχι τον κωδικό',
  doorErrorMessage(403, { error: MFA_REQUIRED, message: MFA_SAY.ask }, 'Το ταμείο') === MFA_SAY.ask)
ok('το 403 χωρίς φράση πέφτει στη φράση του δεύτερου βήματος',
  doorErrorMessage(403, { error: MFA_REQUIRED }, 'Το ταμείο') === MFA_SAY.ask)
ok('ο κωδικός μηχανής δεν δείχνεται ποτέ', !doorErrorMessage(403, { error: MFA_REQUIRED }, 'Το ταμείο').includes('mfa'))
ok('το 502 λέει τον λόγο του', doorErrorMessage(502, { error: 'Το ταμείο δεν άνοιξε.' }, 'Το ταμείο') === 'Το ταμείο δεν άνοιξε.')
ok('χωρίς λόγο: το γενικό μήνυμα με το όνομα της πόρτας',
  doorErrorMessage(500, {}, 'Η διαχείριση συνδρομής') === 'Η διαχείριση συνδρομής δεν άνοιξε. Δοκίμασε ξανά σε λίγο.')
ok('200 χωρίς διεύθυνση (κλειστό ταμείο): γενικό μήνυμα', doorErrorMessage(200, { error: 'x' }, 'Το ταμείο').startsWith('Το ταμείο δεν άνοιξε'))
ok('σώμα που δεν διαβάστηκε', doorErrorMessage(500, null, 'Το ταμείο').startsWith('Το ταμείο δεν άνοιξε'))
ok('μη κείμενο στο error αγνοείται', serverReason({ error: 42 }) === '')

// ── Ο ΚΩΔΙΚΟΣ ΔΟΚΙΜΑΣΤΗ ───────────────────────────────────────────────────
ok('403: λάθος κωδικός', testerErrorMessage(403, { error: 'Ο κωδικός δεν αναγνωρίζεται.' }) === TESTER_SAY.wrong)
ok('429: το μήνυμα του ορίου από τον διακομιστή',
  testerErrorMessage(429, { error: 'Πολλές προσπάθειες. Δοκίμασε ξανά αύριο.' }) === 'Πολλές προσπάθειες. Δοκίμασε ξανά αύριο.')
ok('429 χωρίς σώμα: δικό του μήνυμα ορίου', testerErrorMessage(429, null) === TESTER_SAY.tooMany)
ok('500: βλάβη, όχι λάθος κωδικός', testerErrorMessage(500, { error: 'Η εξαργύρωση δεν ολοκληρώθηκε.' }) === TESTER_SAY.server)
ok('502: βλάβη, όχι λάθος κωδικός', testerErrorMessage(502, {}) === TESTER_SAY.server)
ok('κανένα 5xx δεν λέει «δεν αναγνωρίζεται»', ![500, 502, 503].some(s => testerErrorMessage(s, {}) === TESTER_SAY.wrong))
ok('403 άλλης προέλευσης: όχι «δεν αναγνωρίζεται»', testerErrorMessage(403, { error: ORIGIN_DENIED }) === TESTER_SAY.origin)
ok('και το μήνυμα λέει τι να κάνει', TESTER_SAY.origin === 'Δεν έγινε. Ανανέωσε τη σελίδα και δοκίμασε ξανά.')
ok('403 δεύτερου βήματος: η φράση του', testerErrorMessage(403, { error: MFA_REQUIRED, message: MFA_SAY.ask }) === MFA_SAY.ask)

// ── Η ΚΑΡΤΑ ΧΡΗΣΙΜΟΠΟΙΕΙ ΤΙΣ ΕΠΙΛΟΓΕΣ ────────────────────────────────────
{
  const src = readFileSync('app/dashboard/components/Billing.tsx', 'utf8')
  ok('οι πόρτες περνούν από το doorErrorMessage', src.includes('notifyError(doorErrorMessage(res.status, body, what))'))
  ok('ο κωδικός δοκιμαστή περνά από το testerErrorMessage', src.includes('notifyError(testerErrorMessage(res.status, body))'))
  ok('κανένα σκέτο «δεν αναγνωρίζεται» για κάθε αποτυχία', !src.includes("notifyError('Ο κωδικός δεν αναγνωρίζεται.')"))
}

console.log(fail === 0 ? `✓ billingErrors: ${pass} έλεγχοι πέρασαν` : `✗ billingErrors: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
