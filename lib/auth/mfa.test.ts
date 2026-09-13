// npx tsx lib/auth/mfa.test.ts
//
// ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΓΕΝΝΑ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ. Η εγγραφή συσκευής TOTP ήταν πλήρης, η
// οθόνη έγραφε «Ενεργή» και η σύνδεση δεν ζητούσε ποτέ τον εξαψήφιο κωδικό:
// μηδέν αναφορές `aal2` σε ολόκληρο το app, το lib και το supabase. Καθε
// έλεγχος εδώ θα ΕΠΕΦΤΕ πριν, γιατί το αρχείο που ελέγχει δεν υπήρχε.
import {
  AAL2, MFA_SAY, aalOfToken, hasVerifiedFactor, secondStepPending, sessionNeedsSecondStep,
} from './mfa'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }
const eq = (n: string, got: unknown, want: unknown) =>
  ok(`${n}\n   πήρα:     ${JSON.stringify(got)}\n   περίμενα: ${JSON.stringify(want)}`, got === want)

/** Διακριτικό τριών μερών, με το φορτίο γραμμένο σε base64url όπως ο πάροχος. */
const token = (claims: Record<string, unknown>): string => {
  const json = JSON.stringify(claims)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `kefalida.${b64}.ypografi`
}

// ── ΤΟ ΕΠΙΠΕΔΟ ΔΙΑΒΑΖΕΤΑΙ ΑΠΟ ΤΟ ΔΙΑΚΡΙΤΙΚΟ ────────────────────────────────
eq('aal1 στο φορτίο', aalOfToken(token({ aal: 'aal1', sub: 'x' })), 'aal1')
eq('aal2 στο φορτίο', aalOfToken(token({ aal: AAL2, sub: 'x' })), AAL2)
eq('χωρίς αξίωση aal', aalOfToken(token({ sub: 'x' })), null)
eq('αριθμός αντί για κείμενο δεν γίνεται δεκτός', aalOfToken(token({ aal: 2 })), null)

// ΤΟ ΕΛΛΗΝΙΚΟ ΟΝΟΜΑ ΣΤΟ ΠΡΟΦΙΛ ΕΣΠΑΓΕ ΤΟΝ ΑΠΛΟ ΑΠΟΚΩΔΙΚΟΠΟΙΗΤΗ. Το φορτίο
// κουβαλά `user_metadata`: με σκέτο `atob` τα πολυβάθμια ψηφία γίνονται
// σκουπίδια, το `JSON.parse` πετάει και το επίπεδο βγαίνει null — δηλαδή ο
// έλεγχος θα απέτυχε ΜΟΝΟ για τους χρήστες με ελληνικό όνομα.
eq('ελληνικό όνομα στο φορτίο δεν χαλά την ανάγνωση',
  aalOfToken(token({ aal: AAL2, user_metadata: { full_name: 'Δημήτρης Παπαδόπουλος' } })), AAL2)

// ── Ο,ΤΙ ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΡΙΤΙΚΟ ──────────────────────────────────────────────
eq('κενό', aalOfToken(''), null)
eq('τίποτα', aalOfToken(null), null)
eq('χωρίς τρία μέρη', aalOfToken('ena.dyo'), null)
eq('φορτίο που δεν είναι JSON', aalOfToken('a.###.b'), null)

// ── ΟΙ ΠΑΡΑΓΟΝΤΕΣ ─────────────────────────────────────────────────────────
ok('επαληθευμένος παράγοντας μετράει', hasVerifiedFactor([{ status: 'verified' }]))
ok('μισοτελειωμένος δεν μετράει', !hasVerifiedFactor([{ status: 'unverified' }]))
ok('κενός κατάλογος δεν μετράει', !hasVerifiedFactor([]))
ok('απόν κατάλογος δεν μετράει', !hasVerifiedFactor(undefined))
ok('ένας επαληθευμένος ανάμεσα σε εκκρεμείς αρκεί',
  hasVerifiedFactor([{ status: 'unverified' }, { status: 'verified' }]))

// ── Η ΠΡΟΚΛΗΣΗ ΣΤΗΝ ΟΘΟΝΗ ΣΥΝΔΕΣΗΣ ────────────────────────────────────────
// Η μορφή είναι ακριβώς αυτή που επιστρέφει το
// `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`.
ok('με συσκευή δηλωμένη και συνεδρία aal1, ζητιέται κωδικός',
  secondStepPending({ currentLevel: 'aal1', nextLevel: AAL2 }))
ok('όταν το βήμα έχει ήδη γίνει, δεν ξαναζητιέται',
  !secondStepPending({ currentLevel: AAL2, nextLevel: AAL2 }))
ok('χωρίς δηλωμένη συσκευή δεν ζητιέται τίποτα',
  !secondStepPending({ currentLevel: 'aal1', nextLevel: 'aal1' }))
ok('χωρίς συνεδρία δεν ζητιέται τίποτα',
  !secondStepPending({ currentLevel: null, nextLevel: null }))
ok('κενή απάντηση δεν μπλοκάρει τη σύνδεση', !secondStepPending(null))

// ── Η ΕΤΥΜΗΓΟΡΙΑ ΤΟΥ ΔΙΑΜΕΣΟΛΑΒΗΤΗ ────────────────────────────────────────
// ΕΔΩ ΖΕΙ Η ΟΥΣΙΑ. Ο κατάλογος παραγόντων έρχεται από το `auth.getUser()`,
// δηλαδή από τον διακομιστή ταυτότητας· το επίπεδο από το υπογεγραμμένο
// διακριτικό. Ο επισκέπτης δεν γράφει καμία από τις δύο τιμές.
const VERIFIED = [{ status: 'verified' }]

ok('χρήστης με συσκευή και διακριτικό aal1 γυρίζει στη σύνδεση',
  sessionNeedsSecondStep(token({ aal: 'aal1' }), VERIFIED))
ok('ο ίδιος χρήστης με διακριτικό aal2 περνά',
  !sessionNeedsSecondStep(token({ aal: AAL2 }), VERIFIED))
ok('χρήστης χωρίς συσκευή περνά με aal1',
  !sessionNeedsSecondStep(token({ aal: 'aal1' }), []))

// ΤΟ ΑΓΝΩΣΤΟ ΚΛΕΙΝΕΙ ΤΗΝ ΠΟΡΤΑ. Διακριτικό που δεν διαβάζεται, ή χωρίς αξίωση
// `aal`, είναι ακριβώς η μορφή που θα κατασκεύαζε κάποιος για να γλιτώσει το
// δεύτερο βήμα. Το κόστος του λάθους εδώ είναι ένας εξαψήφιος κωδικός ακόμη.
ok('διακριτικό χωρίς aal δεν περνά όποιον έχει συσκευή',
  sessionNeedsSecondStep(token({ sub: 'x' }), VERIFIED))
ok('χαλασμένο διακριτικό δεν περνά όποιον έχει συσκευή',
  sessionNeedsSecondStep('oxi-diakritiko', VERIFIED))
ok('απόν διακριτικό δεν περνά όποιον έχει συσκευή',
  sessionNeedsSecondStep(null, VERIFIED))
// ΚΑΙ ΤΟ ΑΝΤΙΣΤΡΟΦΟ ΔΕΝ ΚΛΕΙΔΩΝΕΙ ΚΑΝΕΝΑΝ: όποιος δεν δήλωσε ποτέ συσκευή δεν
// επιτρέπεται να μείνει έξω επειδή δεν διαβάστηκε το διακριτικό του.
ok('χαλασμένο διακριτικό δεν κλειδώνει όποιον δεν έχει συσκευή',
  !sessionNeedsSecondStep('oxi-diakritiko', []))

// ── ΤΑ ΛΟΓΙΑ ΤΗΣ ΟΘΟΝΗΣ ΖΟΥΝ ΣΕ ΕΝΑ ΣΗΜΕΙΟ ────────────────────────────────
// Γραμμένα δύο φορές, θα απέκλιναν: η σύνδεση θα εξηγούσε αλλιώς το ίδιο βήμα
// από ό,τι οι Ρυθμίσεις.
ok('κανένα μήνυμα δεν είναι κενό', Object.values(MFA_SAY).every(v => v.length > 20))

console.log(fail === 0 ? `✓ auth/mfa: ${pass} έλεγχοι πέρασαν` : `✗ auth/mfa: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
