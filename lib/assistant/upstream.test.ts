// npx tsx lib/assistant/upstream.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// ΤΙ ΦΥΛΑΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
// ─────────────────────────────────────────────────────────────────────────
// Πριν τη διόρθωση, η διαδρομή έγραφε:
//
//     return NextResponse.json(
//       { error: data.error?.message ?? 'Σφάλμα Anthropic API' },
//       { status: response.status });
//
// Δύο πράγματα ταξίδευαν αυτούσια από τον πάροχο στον Ελληνα ιδιοκτήτη: το
// αγγλικό κείμενο και ο κωδικός. Το 429 του παρόχου έβγαινε 429 και οι
// πελάτες το διαβάζουν ως «εξαντλήθηκε το πακέτο σου».
//
// ΤΙ ΜΕΤΡΗΘΗΚΕ ΠΑΝΩ ΣΤΟΝ ΠΡΟΗΓΟΥΜΕΝΟ ΚΩΔΙΚΑ: αυτό το αρχείο, τρεχούμενο με τη
// διαδρομή ΠΡΙΝ τη διόρθωση, απέτυχε σε 2 από τους 27 ελέγχους — και οι δύο
// της τελευταίας ενότητας, γιατί `maxDuration` δεν υπήρχε πουθενά στο
// αποθετήριο. Οι υπόλοιποι εικοσιπέντε κρίνουν τη ΝΕΑ καθαρή μονάδα, που τότε
// δεν υπήρχε καθόλου: φυλάνε ό,τι δεν επιτρέπεται να ξαναγυρίσει.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  UPSTREAM_TIMEOUT_MS, upstreamFailure,
  KEY_FAILURE, TOO_LARGE_FAILURE, BUSY_FAILURE, DOWN_FAILURE, REJECTED_FAILURE,
  TIMEOUT_FAILURE, NETWORK_FAILURE, UNREADABLE_FAILURE,
  type UpstreamFailure,
} from './upstream'

let pass = 0, fail = 0
function ok(name: string, cond: boolean) { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) pass++; else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`) }
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

const ALL: UpstreamFailure[] = [
  KEY_FAILURE, TOO_LARGE_FAILURE, BUSY_FAILURE, DOWN_FAILURE, REJECTED_FAILURE,
  TIMEOUT_FAILURE, NETWORK_FAILURE, UNREADABLE_FAILURE,
]

// ═══ Ο ΚΩΔΙΚΟΣ: ΤΟ 429 ΤΟΥ ΠΑΡΟΧΟΥ ΔΕΝ ΕΙΝΑΙ ΤΟ 429 ΤΟΥ ΠΑΚΕΤΟΥ ════════════
// Ο πελάτης της σάρωσης (scanDoc.ts) γυρίζει `quota` σε κάθε 429 και το
// PropertyAssistant δείχνει το μήνυμα ορίου. Ενα 429 από τον πάροχο θα έλεγε
// σε συνδρομητή με άθικτο πακέτο ότι τελείωσαν οι ερωτήσεις του.
eq('429 του παρόχου γίνεται 503', upstreamFailure(429).status, 503)
ok('κανένα σφάλμα παρόχου δεν βγαίνει ως 429', ALL.every(f => f.status !== 429))

// ═══ ΤΟ 413 ΕΙΝΑΙ Η ΜΟΝΗ ΕΞΑΙΡΕΣΗ, ΚΑΙ ΜΕ ΛΟΓΟ ════════════════════════════
// Το scanDoc.ts:203 διαβάζει ονομαστικά το 413 και λέει «μίκρυνε το αρχείο».
// Αν το μεταφράζαμε σε 502, ο χρήστης θα διάβαζε «βλάβη» για κάτι που λύνεται.
eq('413 του παρόχου μένει 413', upstreamFailure(413).status, 413)
ok('το μήνυμα του 413 λέει τι να κάνει', /μικρότερη/.test(upstreamFailure(413).message))

// ═══ ΤΟ ΚΛΕΙΔΙ: ΤΟ ΣΗΜΑΔΙ ΠΟΥ ΨΑΧΝΟΥΝ ΟΙ ΠΕΛΑΤΕΣ ══════════════════════════
for (const s of [401, 403]) {
  eq(`${s} είναι πρόβλημα ρύθμισης, όχι του χρήστη`, upstreamFailure(s).status, 500)
  ok(`${s} κουβαλά το σημάδι του κλειδιού`, upstreamFailure(s).message.includes('ANTHROPIC_API_KEY'))
}
const clients = ['app/dashboard/components/PropertyAssistant.tsx', 'app/dashboard/components/scanDoc.ts']
ok('οι πελάτες ψάχνουν όντως αυτό το σημάδι',
  clients.every(f => /API_KEY'\)/.test(read(f))))

// ═══ ΟΙ ΒΛΑΒΕΣ ΤΟΥ ΠΑΡΟΧΟΥ ════════════════════════════════════════════════
eq('500 του παρόχου γίνεται 503', upstreamFailure(500).status, 503)
eq('529 «overloaded» γίνεται 503', upstreamFailure(529).status, 503)
eq('503 του παρόχου γίνεται 503', upstreamFailure(503).status, 503)
eq('400 γίνεται 502', upstreamFailure(400).status, 502)
eq('404 γίνεται 502', upstreamFailure(404).status, 502)
eq('422 γίνεται 502', upstreamFailure(422).status, 502)

// ═══ ΤΟ ΚΕΙΜΕΝΟ ΕΙΝΑΙ ΕΛΛΗΝΙΚΟ ΚΑΙ ΤΕΛΕΙΩΝΕΙ ══════════════════════════════
// Τρεις οθόνες δείχνουν το `error` αυτούσιο. Ο,τι γράφεται εδώ το διαβάζει
// ιδιοκτήτης ακινήτου, όχι προγραμματιστής.
ok('κάθε μήνυμα έχει ελληνικά', ALL.every(f => /[α-ωΑ-Ωά-ώΆ-Ώ]{4,}/.test(f.message)))
ok('κανένα μήνυμα δεν είναι κενό', ALL.every(f => f.message.trim().length > 20))
ok('κάθε μήνυμα κλείνει με τελεία', ALL.every(f => f.message.trim().endsWith('.')))
ok('κανένα μήνυμα δεν κουβαλά ορολογία του παρόχου',
  ALL.every(f => !/anthropic|claude|rate_limit|overloaded/i.test(f.message.replace('ANTHROPIC_API_KEY', ''))))

// ═══ Η ΔΕΞΑΜΕΝΗ: ΠΟΤΕ ΓΥΡΙΖΕΙ ΤΟ ΧΡΗΜΑ ΚΑΙ ΠΟΤΕ ΟΧΙ ═══════════════════════
// Σφάλμα του παρόχου σημαίνει ότι δεν παρήχθησαν tokens. Χρονικό όριο και
// σώμα που δεν διαβάζεται σημαίνουν ότι πιθανότατα παρήχθησαν.
ok('κάθε σφάλμα του παρόχου γυρίζει και τη δεξαμενή',
  [400, 401, 403, 404, 413, 422, 429, 500, 503, 529].every(s => upstreamFailure(s).pool))
eq('το χρονικό όριο ΔΕΝ γυρίζει τη δεξαμενή', TIMEOUT_FAILURE.pool, false)
eq('το αδιάβαστο σώμα ΔΕΝ γυρίζει τη δεξαμενή', UNREADABLE_FAILURE.pool, false)
eq('η πτώση δικτύου γυρίζει και τη δεξαμενή', NETWORK_FAILURE.pool, true)

// ═══ ΤΟ ΧΡΟΝΙΚΟ ΟΡΙΟ ΔΕΝΕΤΑΙ ΜΕ ΟΣΑ ΥΠΑΡΧΟΥΝ ΗΔΗ ══════════════════════════
// Το νούμερο δεν κρίνεται μόνο του: κρίνεται απέναντι στην υπομονή του πελάτη
// και απέναντι στο ταβάνι της πλατφόρμας. Αν κάποιος αλλάξει το ένα από τα
// τρία, εδώ φαίνεται.
const route = read('app/api/anthropic/route.tsx')
const maxDuration = Number(route.match(/maxDuration\s*=\s*(\d+)/)?.[1])
ok('η διαδρομή δηλώνει maxDuration', Number.isFinite(maxDuration))
ok('μένει περιθώριο τουλάχιστον δέκα δευτερολέπτων για την επιστροφή της χρέωσης',
  UPSTREAM_TIMEOUT_MS / 1000 <= maxDuration - 10)

const scanTimeout = Number(read('app/dashboard/components/scanDoc.ts').match(/timeoutMs\s*=\s*(\d+)/)?.[1])
ok('ο πελάτης της σάρωσης δηλώνει δικό του όριο', Number.isFinite(scanTimeout))
ok('ο διακομιστής δεν περιμένει περισσότερο από τον πιο υπομονετικό πελάτη',
  UPSTREAM_TIMEOUT_MS <= scanTimeout)

console.log(fail === 0 ? `✓ upstream: ${pass} έλεγχοι πέρασαν` : `✗ upstream: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
