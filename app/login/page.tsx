'use client'
import { T, Btn } from '@/components/Theme'
import { useState, useEffect } from 'react'
import { leaveDevice } from '@/lib/localPrivacy'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/supabase/lazy';
import { secondStepPending, MFA_SAY } from '@/lib/auth/mfa';
import Link from 'next/link'
import AlreadySignedIn from '../AlreadySignedIn'
import AuthAside from '../AuthAside'
import GoogleG from '../GoogleG'
import { BackLink } from '../BackLink'
import { SAY, failed } from '@/lib/core/dbError';

// ═══════════════════════════════════════════════════════════════════════════
// Σύνδεση, στα χρώματα του app (design tokens, theme-aware light/dark).
// Δύο στήλες σε desktop· σε κινητό το marketing panel κρύβεται (auth-* classes).
// ═══════════════════════════════════════════════════════════════════════════

/** Η ανταλλαγή του διακριτικού απέτυχε και μας έστειλε εδώ. */
const failedConfirm = () => {
  try { return new URLSearchParams(window.location.search).get('confirm') === 'failed' }
  catch { return false }
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  // ── ΤΟ ΔΕΥΤΕΡΟ ΒΗΜΑ ─────────────────────────────────────────────────────
  // Το `factorId` ΕΙΝΑΙ ΚΑΙ Η ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΟΘΟΝΗΣ: όσο κρατά αναγνωριστικό
  // συσκευής, η ίδια φόρμα δείχνει το πεδίο του εξαψήφιου κωδικού αντί για το
  // ζεύγος email και κωδικού. Δεν υπάρχει δεύτερη σημαία που θα μπορούσε
  // κάποτε να αποκλίνει από αυτό.
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)

  const trans = (m: string) =>
    /invalid login/i.test(m) ? 'Λάθος email ή κωδικός.'
    : /email not confirmed/i.test(m) ? 'Επιβεβαίωσε πρώτα το email σου από τον σύνδεσμο που σου στείλαμε.'
    : /rate limit|too many/i.test(m) ? SAY.tooManyTries
    : m

  /**
   * Ζητά τον εξαψήφιο κωδικό της δηλωμένης συσκευής.
   *
   * ΑΝ Η ΣΥΣΚΕΥΗ ΔΕΝ ΒΡΕΘΕΙ, Η ΣΥΝΕΔΡΙΑ ΚΛΕΙΝΕΙ. Το `listFactors` επιστρέφει
   * μόνο ΕΠΑΛΗΘΕΥΜΕΝΟΥΣ παράγοντες· σφάλμα ή κενή απάντηση σημαίνει είτε
   * αποτυχία δικτύου είτε παράγοντα άλλου τύπου, που αυτή η οθόνη δεν ξέρει να
   * ζητήσει. Και στις δύο περιπτώσεις η συνεδρία «aal1» ΔΕΝ επιτρέπεται να
   * μείνει ζωντανή: θα ήταν ακριβώς η παράκαμψη που ο έλεγχος κλείνει.
   */
  async function askSecondStep(supabase: Awaited<ReturnType<typeof authClient>>) {
    const { data: list, error: listError } = await supabase.auth.mfa.listFactors()
    const device = listError ? undefined : (list?.totp ?? [])[0]
    if (!device) {
      await supabase.auth.signOut()
      setSessionEmail(null); setFactorId(null)
      setError(MFA_SAY.stuck)
      return
    }
    setCode(''); setError('')
    setFactorId(device.id)
  }

  /** Η επαλήθευση του εξαψήφιου. Επιτυχία σημαίνει συνεδρία «aal2». */
  async function verifySecondStep(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId) return
    setVerifying(true); setError('')
    const supabase = await authClient()
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeError || !challenge) { setError(MFA_SAY.wrong); setVerifying(false); return }
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code })
    if (error) {
      // ΕΝΑ ΜΗΝΥΜΑ ΓΙΑ ΚΑΘΕ ΑΠΟΤΥΧΙΑ. Το «λάθος κωδικός» και το «έληξε η
      // πρόκληση» δεν επιτρέπεται να ξεχωρίζουν από έξω.
      setError(MFA_SAY.wrong); setCode(''); setVerifying(false); return
    }
    router.push('/dashboard')
  }

  useEffect(() => {
    // Ο πελάτης φορτώνεται μετά το πρώτο σχεδίασμα, οπότε το effect ξετυλίγεται
    // μέσα σε ασύγχρονη συνάρτηση: το ίδιο το effect ΔΕΝ επιτρέπεται να
    // επιστρέψει υπόσχεση, γιατί η React διαβάζει την επιστροφή ως καθαρισμό.
    void (async () => {
    const supabase = await authClient()
    supabase.auth.getUser().then(async ({ data }) => {
      setSessionEmail(data.user?.email ?? null)
      // ── Η ΣΥΝΕΔΡΙΑ ΠΟΥ ΧΡΩΣΤΑΕΙ ΤΟ ΔΕΥΤΕΡΟ ΒΗΜΑ ──────────────────────
      // Ο διαμεσολαβητής στέλνει εδώ όποιον κρατά συνεδρία «aal1» ενώ έχει
      // δηλωμένη συσκευή. Χωρίς αυτή τη γραμμή θα έβλεπε «είσαι ήδη
      // συνδεδεμένος» με ένα κουμπί που τον γυρίζει πίσω εδώ: κλειστός
      // βρόχος, χωρίς κανένα σημείο να δώσει τον εξαψήφιο κωδικό.
      if (data.user) {
        const { data: levels, error: levelError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (levelError) { setError(MFA_SAY.stuck); return }
        if (secondStepPending(levels)) await askSecondStep(supabase)
      }
      // Ο ΣΥΝΔΕΣΜΟΣ ΕΠΙΒΕΒΑΙΩΣΗΣ ΠΟΥ ΔΕΝ ΔΟΥΛΕΨΕ ΛΕΓΕΤΑΙ ΜΕ ΛΕΞΕΙΣ. Η
      // ανταλλαγή του διακριτικού (app/auth/callback) καταλήγει εδώ όταν
      // αποτύχει· χωρίς αυτό, όποιος μόλις πάτησε «Επιβεβαίωση» στο email του
      // έβλεπε γυμνή φόρμα εισόδου και κανένα ίχνος του τι πήγε στραβά.
      //
      // ΜΟΝΟ ΣΕ ΑΣΥΝΔΕΤΟ: αν η συνεδρία υπάρχει, ο σύνδεσμος έκανε τη δουλειά
      // του και δεν υπάρχει τίποτα να διορθωθεί.
      if (!data.user && failedConfirm()) {
        setError('Ο σύνδεσμος επιβεβαίωσης δεν ισχύει πια. Συνδέσου με τον κωδικό σου, ή ζήτησε νέο σύνδεσμο από την εγγραφή.')
      }
    })
    })()
  }, [])

  async function signOut() {
    setSigningOut(true)
    const supabase = await authClient()
    await supabase.auth.signOut()
    // Αλλάζει λογαριασμός στην ΙΔΙΑ συσκευή: τα προσωπικά του προηγούμενου
    // δεν περνούν στον επόμενο.
    leaveDevice()
    setSessionEmail(null); setSigningOut(false)
    // Η μισοτελειωμένη πρόκληση φεύγει μαζί με τη συνεδρία: αλλιώς η οθόνη θα
    // ζητούσε κωδικό για συσκευή που δεν ανήκει πια σε καμία συνεδρία.
    setFactorId(null); setCode('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = await authClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(failed('Η σύνδεση δεν έγινε', error)); setLoading(false); return }

    // ═══ ΤΟ ΔΕΥΤΕΡΟ ΒΗΜΑ, ΠΟΥ ΔΕΝ ΖΗΤΙΟΤΑΝ ΠΟΤΕ ══════════════════════════
    // ΤΙ ΜΕΤΡΗΘΗΚΕ: μηδέν αναφορές «aal2» σε app, lib και supabase. Εδώ η
    // γραμμή ήταν `else router.push('/dashboard')`. Η συνεδρία που γεννά το
    // `signInWithPassword` είναι «aal1»: ένας κωδικός που διέρρευσε άνοιγε
    // ολόκληρο τον λογαριασμό ΜΕ τη συσκευή TOTP δηλωμένη, ενεργή στην οθόνη
    // των Ρυθμίσεων και γραμμένη στο ιστορικό ασφαλείας.
    const { data: levels, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aalError) {
      // ΑΓΝΩΣΤΟ ΕΠΙΠΕΔΟ ΣΗΜΑΙΝΕΙ ΚΛΕΙΣΤΑ. Το «δεν ξέραμε, άρα προχώρα» είναι
      // ακριβώς η παράκαμψη που ήρθε να κλείσει ο έλεγχος. Η συνεδρία «aal1»
      // δεν μένει ζωντανή στο παρασκήνιο.
      await supabase.auth.signOut()
      setError(MFA_SAY.stuck); setLoading(false); return
    }
    if (!secondStepPending(levels)) { router.push('/dashboard'); return }
    await askSecondStep(supabase)
    setLoading(false)
  }

  // Η `signInWithOAuth` ΕΙΝΑΙ ΚΑΙ ΕΓΓΡΑΦΗ. Οποιος πατούσε εδώ χωρίς λογαριασμό
  // αποκτούσε έναν, χωρίς να δει ποτέ τους Ορους και χωρίς καμία απόδειξη
  // συγκατάθεσης στο προφίλ του: ακριβώς το κενό που το app/signup/page.tsx
  // περιγράφει ως διορθωμένο, ζωντανό μία διαδρομή παραδίπλα.
  //
  // Η επιστροφή πάει τώρα στο `/signup?oauth=login`, που ελέγχει αν υπάρχει ήδη
  // συγκατάθεση. Αν υπάρχει, προωθεί στον πίνακα χωρίς να το καταλάβει κανείς.
  // Αν δεν υπάρχει, σταματά και ρωτά. Δεν συμπληρώνεται ποτέ εδώ: μια απόδειξη
  // που γράφτηκε χωρίς να δοθεί είναι χειρότερη από απόδειξη που λείπει.
  async function signInWithGoogle() {
    const supabase = await authClient()
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/signup?oauth=login` } })
  }

  // ΤΟ ΚΟΥΜΠΙ ΕΙΝΑΙ ΕΝΑ, ΟΠΟΤΕ ΚΑΙ Η ΣΗΜΑΙΑ ΤΟΥ ΕΙΝΑΙ ΜΙΑ. Δύο ξεχωριστές
  // συνθήκες μέσα στο `disabled` και μέσα στο `opacity` θα απέκλιναν την πρώτη
  // φορά που θα άλλαζε η μία.
  const busy = factorId ? (verifying || code.length !== 6) : loading

  const field: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
    borderRadius: T.radius.btn, padding: '10px 16px', minHeight: T.h.lg,
    color: 'var(--text-primary)', fontSize: 14,
    fontFamily: 'inherit', transition: 'border-color .15s',
  }
  const label: React.CSSProperties = {
    fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700,
    display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em',
    fontFamily: T.font.sans,
  }

  return (
    <div className="auth-split" style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', fontFamily: T.font.sans }}>

      <a href="#main" className="skip-link">Μετάβαση στη φόρμα</a>

      {/* LEFT, κοινό marketing panel (AuthAside) */}
      <AuthAside />

      {/* ── ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ ΕΙΝΑΙ <main>, ΚΑΙ ΛΕΓΕΤΑΙ ─────────────────────────
          Μετρημένο: `document.querySelectorAll('main').length === 0` και καμία
          περιοχή στο προσβάσιμο δέντρο. Ο χρήστης αναγνώστη οθόνης δεν είχε
          τρόπο να πηδήξει στο κύριο μέρος — έπρεπε να διασχίσει ολόκληρη τη
          στήλη παρουσίασης κάθε φορά. */}
      {/* RIGHT, form */}
      <main id="main" className="auth-main" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 40px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* ── ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΜΙΑ ΦΟΡΜΑ ─────────────────────────────────
              ΤΟ ΔΕΥΤΕΡΟ ΒΗΜΑ ΔΕΝ ΠΗΡΕ ΔΙΚΗ ΤΟΥ ΦΟΡΜΑ, ΕΠΙΤΗΔΕΣ. Μια δεύτερη θα
              σήμαινε δεύτερο κουμπί υποβολής ζωγραφισμένο στο χέρι, δηλαδή
              δεύτερη όψη για την ίδια ενέργεια — και ο φύλακας των κουμπιών
              μετρά ακριβώς αυτό. Εδώ αλλάζουν τα πεδία, όχι το κουμπί.

              ΚΑΙ Η «ΗΔΗ ΣΥΝΔΕΔΕΜΕΝΟΣ» ΥΠΟΧΩΡΕΙ ΟΣΟ ΕΚΚΡΕΜΕΙ ΤΟ ΒΗΜΑ: αλλιώς
              όποιον στέλνει εδώ ο διαμεσολαβητής θα έβλεπε «μετάβαση στον
              πίνακα» και θα γύριζε αμέσως πίσω. Κλειστός βρόχος. */}
          {sessionEmail && !factorId ? (
            <AlreadySignedIn email={sessionEmail} onSignOut={signOut} signingOut={signingOut} mode="login" />
          ) : (<>
          {/* ΣΕ ΚΙΝΗΤΟ ΔΕΝ ΥΠΗΡΧΕ ΚΑΝΕΝΑΣ ΔΡΟΜΟΣ ΠΙΣΩ. Το λογότυπο ζει στο
              αριστερό πάνελ, που κρύβεται κάτω από τις 900 και δεν ήταν καν
              σύνδεσμος. Όποιος άνοιγε τη Σύνδεση από την αρχική έμενε εκεί. */}
          <BackLink home />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: '0 0 6px' }}>
            {factorId ? 'Επαλήθευση δύο βημάτων' : 'Καλώς όρισες ξανά'}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: 1.5 }}>
            {factorId ? MFA_SAY.ask : (<>
              Δεν έχεις λογαριασμό;{' '}
              <Link href="/signup" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Δημιούργησε λογαριασμό</Link>
            </>)}
          </p>

          {/* Ο πάροχος ταυτότητας ΞΕΚΙΝΑΕΙ σύνδεση. Στο δεύτερο βήμα η σύνδεση
              έχει ήδη ξεκινήσει: ένα κουμπί που την ξαναρχίζει θα ήταν δρόμος
              γύρω από την πρόκληση, όχι επιλογή. */}
          {!factorId && (<>
          {/* `field` γιατί ο πάροχος κρατά όλο το πλάτος της στήλης, όπως πριν.
              Το `.auth-hov` έφυγε μαζί με το στυλ: την αιώρηση τη δίνει πλέον το
              `.po-btn[data-variant=secondary]`, που ξέρει και εστίαση με πληκτρολόγιο. */}
          <Btn variant="secondary" field onClick={signInWithGoogle}>
            <GoogleG />Συνέχισε με Google
          </Btn>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>ή</span>
            <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          </div>
          </>)}

          <form onSubmit={factorId ? verifySecondStep : handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {factorId ? (
              <div>
                <label htmlFor="login-mfa-code" style={label}>Εξαψήφιος κωδικός</label>
                <input id="login-mfa-code" name="one-time-code" inputMode="numeric" maxLength={6} autoComplete="one-time-code"
                  value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456"
                  style={{ ...field, maxWidth: 200, fontFamily: T.font.mono, letterSpacing: '0.3em' }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'} />
              </div>
            ) : (<>
            <div>
              <label htmlFor="login-email" style={label}>Ηλεκτρονικό ταχυδρομείο</label>
              <input id="login-email" name="email" autoComplete="email" type="email" value={email} required onChange={e => setEmail(e.target.value)} placeholder="onoma@email.com" style={field}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label htmlFor="login-password" style={{ ...label, marginBottom: 0 }}>Κωδικός</label>
                <Link href="/reset-password" className="lp-link po-tap" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>Ξέχασες τον κωδικό;</Link>
              </div>
              <div style={{ position: 'relative' }}>
                <input id="login-password" name="password" autoComplete="current-password" type={show ? 'text' : 'password'} value={password} required onChange={e => setPassword(e.target.value)} placeholder="Ο κωδικός σου" style={{ ...field, paddingRight: 48 }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'} />
                {/* ΜΕΝΕΙ ΧΕΙΡΟΠΟΙΗΤΟ: το IconBtn δεν προωθεί `aria-pressed` και το μάτι
                    είναι διακόπτης — ο στόχος αφής είναι ήδη 44×44. */}
                <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'} aria-pressed={show}
                  style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {show
                    ? <svg aria-hidden="true" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
                    : <svg aria-hidden="true" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.9 17.9A10.7 10.7 0 0 1 12 19c-6.5 0-10-7-10-7a19 19 0 0 1 5.1-5.9M9.9 4.2A10.9 10.9 0 0 1 12 4c6.5 0 10 7 10 7a19 19 0 0 1-2.2 3.2M1 1l22 22M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>}
                </button>
              </div>
            </div>
            </>)}

            {error && (
              <div role="alert" style={{ background: 'var(--negative-soft)', border: '1px solid var(--negative-border)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--negative)' }}>
                {trans(error)}
              </div>
            )}

            <Btn variant="primary" type="submit" field disabled={busy}>
              {factorId
                ? (verifying ? 'Επαλήθευση…' : 'Επαλήθευση')
                : (loading ? 'Σύνδεση…' : 'Σύνδεση')}
            </Btn>
          </form>

          {/* ── Ο ΔΡΟΜΟΣ ΓΙΑ ΟΠΟΙΟΝ ΕΧΑΣΕ ΤΟ ΤΗΛΕΦΩΝΟ ΤΟΥ ────────────────────
              ΧΩΡΙΣ ΑΥΤΟ, Η ΟΘΟΝΗ ΕΙΝΑΙ ΑΔΙΕΞΟΔΟ: η συνεδρία «aal1» ζει, ο
              διαμεσολαβητής τον γυρίζει εδώ από κάθε σελίδα και δεν υπάρχει
              κουμπί να την κλείσει. Η έξοδος δεν παρακάμπτει τίποτα — σβήνει
              τη μισή συνεδρία αντί να την αφήσει ζωντανή. */}
          {factorId ? (
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Btn variant="ghost" onClick={signOut} disabled={signingOut}>
                {signingOut ? 'Έξοδος…' : 'Έξοδος από τη σύνδεση'}
              </Btn>
            </div>
          ) : (
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 24, lineHeight: 1.6 }}>
            Συνεχίζοντας, αποδέχεσαι τους{' '}
            <Link href="/terms" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Όρους χρήσης</Link>{' '}και την{' '}
            <Link href="/privacy" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Πολιτική απορρήτου</Link>.
          </p>
          )}
          </>)}
        </div>
      </main>
    </div>
  )
}
