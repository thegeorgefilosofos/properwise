// npx tsx lib/auth/secondStep.test.ts
//
// ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΓΕΝΝΑ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ. Ο διαμεσολαβητής εξαιρεί το /api/**,
// οπότε η μισή συνεδρία (συσκευή TOTP δηλωμένη, διακριτικό «aal1») περνούσε
// σε κάθε διαδρομή εκτός από τη διαγραφή λογαριασμού: ταμείο, αλλαγή
// πακέτου, Νόα, εξαγωγή Ε2. Εδώ ελέγχεται η πύλη που μπήκε σε όλες.
import { MFA_REQUIRED, MFA_SAY } from './mfa'
import { requireSecondStep, secondStepMissing } from './secondStep'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }
const eq = (n: string, got: unknown, want: unknown) =>
  ok(`${n}\n   πήρα:     ${JSON.stringify(got)}\n   περίμενα: ${JSON.stringify(want)}`, JSON.stringify(got) === JSON.stringify(want))

/** Διακριτικό τριών μερών, με το φορτίο σε base64url όπως ο πάροχος. */
const token = (claims: Record<string, unknown>): string => {
  const bytes = new TextEncoder().encode(JSON.stringify(claims))
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return `kefalida.${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.ypografi`
}

type Read = { data: { session: { access_token: string } | null }; error: { message: string } | null }
type Fake = Parameters<typeof secondStepMissing>[0] & { reads: number }
/** Ψεύτικος πελάτης: μετρά πόσες φορές διαβάστηκε η συνεδρία. */
const client = (read: Read): Fake => {
  const c = {
    reads: 0,
    auth: { getSession: async () => { c.reads++; return read } },
  }
  return c as unknown as Fake
}
const session = (claims: Record<string, unknown>): Read =>
  ({ data: { session: { access_token: token(claims) } }, error: null })

const VERIFIED = { factors: [{ status: 'verified' }] }
const HALF = { factors: [{ status: 'unverified' }] }
const NONE = { factors: [] }

async function main() {
  // ── Ο ΧΡΗΣΤΗΣ ΧΩΡΙΣ 2FA ΔΕΝ ΠΛΗΡΩΝΕΙ ΤΙΠΟΤΑ ────────────────────────────
  // Ούτε καν ανάγνωση της συνεδρίας: η απάντηση βγαίνει από τους παράγοντες.
  {
    const c = client(session({ aal: 'aal1' }))
    eq('χωρίς συσκευή: περνά', await requireSecondStep(c, NONE), null)
    eq('χωρίς συσκευή: η συνεδρία δεν διαβάστηκε καν', c.reads, 0)
    eq('χωρίς κατάλογο παραγόντων: περνά', await requireSecondStep(c, {}), null)
  }
  // Ο μισοτελειωμένος παράγοντας (εγκαταλελειμμένη εγγραφή) δεν κλειδώνει κανέναν.
  eq('μόνο μισοτελειωμένη συσκευή: περνά', await requireSecondStep(client(session({ aal: 'aal1' })), HALF), null)

  // ── Η ΜΙΣΗ ΣΥΝΕΔΡΙΑ ΚΟΒΕΤΑΙ ──────────────────────────────────────────────
  {
    const res = await requireSecondStep(client(session({ aal: 'aal1' })), VERIFIED)
    ok('συσκευή με aal1: κόβεται', res !== null)
    if (res) {
      eq('συσκευή με aal1: 403', res.status, 403)
      eq('συσκευή με aal1: ο κωδικός και η φράση της σύνδεσης', await res.json(), { error: MFA_REQUIRED, message: MFA_SAY.ask })
    }
  }
  eq('ο κωδικός είναι αυτός που σηκώνει και η βάση', MFA_REQUIRED, 'mfa_required')

  // ── ΜΕΤΑ ΤΟΝ ΕΞΑΨΗΦΙΟ ΠΕΡΝΑ ─────────────────────────────────────────────
  eq('συσκευή με aal2: περνά', await requireSecondStep(client(session({ aal: 'aal2' })), VERIFIED), null)
  ok('συσκευή με aal2: δεν χρωστά', !(await secondStepMissing(client(session({ aal: 'aal2' })), VERIFIED)))

  // ── ΤΟ ΑΓΝΩΣΤΟ ΚΛΕΙΝΕΙ ──────────────────────────────────────────────────
  // Συνεδρία που δεν διαβάστηκε, που λείπει ή που δεν λέει επίπεδο είναι
  // ακριβώς η μορφή που θα έστηνε κάποιος για να γλιτώσει τον εξαψήφιο.
  ok('σφάλμα ανάγνωσης συνεδρίας: χρωστά',
    await secondStepMissing(client({ data: { session: null }, error: { message: 'cookie' } }), VERIFIED))
  ok('χωρίς συνεδρία: χρωστά',
    await secondStepMissing(client({ data: { session: null }, error: null }), VERIFIED))
  ok('διακριτικό χωρίς aal: χρωστά', await secondStepMissing(client(session({ sub: 'x' })), VERIFIED))

  console.log(fail === 0 ? `✓ auth/secondStep: ${pass} έλεγχοι πέρασαν` : `✗ auth/secondStep: ${fail} απέτυχαν από ${pass + fail}`)
  if (fail > 0) process.exit(1)
}

main()
