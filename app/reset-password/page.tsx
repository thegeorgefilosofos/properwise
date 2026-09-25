'use client'
import { T, Btn } from '@/components/Theme'
import { useState, useEffect, useSyncExternalStore } from 'react'
import { authClient } from '@/lib/supabase/lazy';
import { leaveDevice } from '@/lib/localPrivacy'
import Link from 'next/link'
import AuthAside, { AuthMobileBrand } from '../AuthAside'
import PasswordEye from '../PasswordEye'
import { checkPassword, PASSWORD_MIN_LABEL, PASSWORD_MSG } from '@/lib/auth/password'
import PasswordStrength from '@/components/PasswordStrength'
import { failed } from '@/lib/core/dbError';
import { BackLink } from '../BackLink'

// ═══════════════════════════════════════════════════════════════════════════
// Επαναφορά κωδικού, δύο καταστάσεις:
//  • request: ο χρήστης δίνει email → στέλνουμε σύνδεσμο επαναφοράς.
//  • update:  ο χρήστης ήρθε από τον σύνδεσμο (PASSWORD_RECOVERY) → ορίζει νέο κωδικό.
// Ίδιο «δωμάτιο» με Σύνδεση/Εγγραφή (κοινό AuthAside).
// ═══════════════════════════════════════════════════════════════════════════

type Mode = 'checking' | 'request' | 'sent' | 'update' | 'done'

const MISMATCH = 'Οι κωδικοί δεν ταιριάζουν.'

// ── Ο ΣΥΝΔΕΣΜΟΣ ΓΥΡΙΖΕΙ ΩΣ `?code=`, ΟΧΙ ΩΣ `#type=recovery` ──────────────
// Ο πελάτης είναι PKCE (@supabase/ssr), οπότε ο έλεγχος του κατάγματος δεν
// ταίριαζε ποτέ. Και ο κωδικός ανταλλάσσεται ΜΟΝΟ στη συσκευή που ζήτησε την
// επαναφορά: σε άλλη συσκευή, ή με σύνδεσμο που έληξε (`error_code`), δεν
// ερχόταν κανένα γεγονός και η οθόνη έδειχνε σιωπηλά ξανά τη φόρμα αίτησης.
type Link = 'none' | 'checking' | 'failed'
// Η διεύθυνση δεν αλλάζει χωρίς πλοήγηση: η συνδρομή δεν έχει τι να ακούσει.
const URL_NEVER_CHANGES = () => () => {}
const readLink = (): Link => {
  const q = new URLSearchParams(window.location.search)
  const h = new URLSearchParams(window.location.hash.slice(1))
  if (q.has('error_code') || h.has('error_code') || q.has('error') || h.has('error')) return 'failed'
  return q.has('code') || h.has('access_token') ? 'checking' : 'none'
}

// ═══ ΣΤΗΝ ΕΠΑΝΑΦΟΡΑ ΤΟ ΠΑΝΕΛ ΛΕΕΙ ΤΙ ΠΡΟΣΤΑΤΕΥΕΙ, ΟΧΙ ΤΙ ΠΟΥΛΑΕΙ ═══════════
// Ηταν τα ίδια τρία σημεία με την εγγραφή (σάρωση, Νόα, οικονομικά): διαφήμιση
// σε οθόνη όπου κάποιος ίσως φοβάται ότι μπήκε άλλος στον λογαριασμό του. Τα
// τρία εδώ είναι όσα κάνει πράγματι η φόρμα από κάτω: το signOut({ scope:
// 'others' }) του updatePassword, ο έλεγχος διαρροής του PasswordStrength και
// το ότι αλλάζει μόνο ο κωδικός.
const RESET_PILLARS = [
  { label: 'Κλείνουν οι άλλες συνδέσεις', text: 'Με τον νέο κωδικό αποσυνδέονται όλες οι άλλες συσκευές του λογαριασμού. Μένει ανοιχτή μόνο η συσκευή όπου τον άλλαξες.' },
  { label: 'Κωδικός που έχει διαρρεύσει δεν περνά', text: 'Πριν τον δεχτούμε, ελέγχουμε αν ο κωδικός υπάρχει σε γνωστή διαρροή δεδομένων.' },
  { label: 'Τα δεδομένα σου δεν αγγίζονται', text: 'Ακίνητα, έγγραφα και κινήσεις μένουν όπως τα άφησες. Αλλάζει μόνο ο τρόπος που μπαίνεις.' },
]

export default function ResetPasswordPage() {
  // Ο ΣΥΝΔΕΣΜΟΣ ΤΟΥ EMAIL ΛΕΕΙ ΗΔΗ ΣΕ ΠΟΙΑ ΟΘΟΝΗ ΕΙΜΑΣΤΕ. Ηταν
  // `setMode('update')` μέσα σε effect: ο χρήστης που πάτησε τον σύνδεσμο
  // επαναφοράς έβλεπε για ένα καρέ τη φόρμα «στείλε μου σύνδεσμο», δηλαδή τη
  // φόρμα που μόλις είχε συμπληρώσει. Η διεύθυνση είναι εξωτερική πηγή και
  // διαβάζεται κατά την απόδοση, με ξεχωριστή απάντηση για τον διακομιστή.
  const link = useSyncExternalStore(URL_NEVER_CHANGES, readLink, () => 'none' as Link)
  const [modeOverride, setMode] = useState<Mode | null>(null)
  const mode: Mode = modeOverride ?? (link === 'checking' ? 'checking' : 'request')
  const [exchangeFailed, setExchangeFailed] = useState(false)
  const linkFailed = link === 'failed' || exchangeFailed
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  /** Κλείστηκαν οι άλλες συνεδρίες μετά την αλλαγή; Το λέει η οθόνη «done». */
  const [othersOut, setOthersOut] = useState(false)

  useEffect(() => {
    // Διαβάζεται ΠΡΙΝ φορτωθεί ο πελάτης: η επιτυχής ανταλλαγή σβήνει το `code`.
    const arrived = readLink()
    // Ο ΚΑΘΑΡΙΣΜΟΣ ΠΡΕΠΕΙ ΝΑ ΕΠΙΒΙΩΣΕΙ ΤΗΣ ΑΝΑΒΟΛΗΣ. Με τον πελάτη να φορτώνεται
    // ασύγχρονα, η οθόνη μπορεί να αποπροσαρτηθεί ΠΡΙΝ γραφτεί η συνδρομή. Χωρίς
    // τη σημαία, θα γραφόταν συνδρομή σε οθόνη που δεν υπάρχει και δεν θα την
    // έσβηνε ποτέ κανείς.
    let sub: { unsubscribe: () => void } | null = null
    let gone = false
    void (async () => {
      const supabase = await authClient()
      if (gone) return
      // Αν ο χρήστης ήρθε από τον σύνδεσμο email, το Supabase εκπέμπει PASSWORD_RECOVERY.
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') setMode('update')
      })
      sub = data.subscription
      if (arrived !== 'checking') return
      // Η ανταλλαγή τρέχει στην αρχικοποίηση του πελάτη. Αν ο κωδικός έμεινε
      // στη διεύθυνση, δεν ανταλλάχθηκε: λείπει ο επαληθευτής αυτής της συσκευής.
      const { error } = await supabase.auth.initialize()
      if (gone) return
      if (error || new URLSearchParams(window.location.search).has('code')) { setExchangeFailed(true); setMode('request') }
      else setMode('update')
    })()
    return () => { gone = true; sub?.unsubscribe() }
  }, [])

  async function sendReset(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    const supabase = await authClient()
    const redirectTo = `${window.location.origin}/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    setLoading(false)
    if (error) setError(failed('Το μήνυμα επαναφοράς δεν στάλθηκε', error)); else setMode('sent')
  }

  const [leakedPw, setLeakedPw] = useState<string | null>(null)
  // ΤΟ ΕΥΡΗΜΑ ΔΙΑΡΡΟΗΣ ΦΤΑΝΕΙ ΩΣ ΤΗΝ ΥΠΟΒΟΛΗ. Πριν, ζούσε μόνο μέσα στο
  // PasswordStrength: η οθόνη προειδοποιούσε και μετά δεχόταν τον κωδικό.
  // Κρατιέται ο ΙΔΙΟΣ ο κωδικός, όχι σημαία, ώστε η φραγή να παύει μόνη της
  // μόλις ο χρήστης αλλάξει έστω έναν χαρακτήρα.
  const pwOk = checkPassword(password).ok && !(leakedPw !== null && leakedPw === password)

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!pwOk) { setError(leakedPw === password ? PASSWORD_MSG.leaked : PASSWORD_MSG.weak); return }
    if (password !== confirm) { setError(MISMATCH); return }
    setLoading(true)
    const supabase = await authClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setLoading(false); setError(failed('Ο κωδικός δεν άλλαξε', error)); return }
    // ═══ ΟΙ ΑΛΛΕΣ ΣΥΣΚΕΥΕΣ ΚΛΕΙΝΟΥΝ ΜΑΖΙ ΜΕ ΤΟΝ ΠΑΛΙΟ ΚΩΔΙΚΟ ═══════════════
    // Η οθόνη έλεγε «ο νέος κωδικός ισχύει σε όλες τις συσκευές σου» και
    // καμία συνεδρία δεν έκλεινε. Οποιος αλλάζει κωδικό επειδή υποψιάζεται
    // διαρροή νόμιζε ότι προστατεύτηκε, ενώ όποιος κρατούσε συνεδρία έμενε
    // μέσα. Κλείνουν όλες εκτός από αυτή· αν αποτύχει, το λέμε και δείχνουμε
    // πού γίνεται με το χέρι, αντί να υποσχεθούμε κάτι που δεν έγινε.
    // ΚΑΙ ΟΙ ΤΟΠΙΚΕΣ ΚΟΠΙΕΣ ΑΥΤΗΣ ΤΗΣ ΣΥΣΚΕΥΗΣ ΦΕΥΓΟΥΝ. Η επαναφορά είναι
    // γεγονός ασφαλείας και ο σύνδεσμος μπορεί να άνοιξε σε κοινόχρηστο
    // μηχάνημα· ο πίνακας τα ξαναφορτώνει από τον διακομιστή.
    const { error: outError } = await supabase.auth.signOut({ scope: 'others' })
    leaveDevice()
    setLoading(false)
    setOthersOut(!outError)
    setMode('done')
  }

  // Ο ΛΟΓΟΣ ΛΕΓΕΤΑΙ ΠΑΝΩ ΣΤΟ ΠΕΔΙΟ, ΟΧΙ ΣΕ ΣΒΗΣΤΟ ΚΟΥΜΠΙ. Η ασυμφωνία δεν
  // φωνάζει όσο ο χρήστης ακόμη πληκτρολογεί: μόνο όταν ό,τι έγραψε δεν μπορεί
  // πια να καταλήξει στον ίδιο κωδικό.
  const mismatch = confirm.length > 0 &&
    (confirm.length >= password.length ? confirm !== password : !password.startsWith(confirm))

  const field: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
    borderRadius: T.radius.btn, padding: '10px 16px', minHeight: T.h.lg, color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit', transition: 'border-color .15s',
  }
  const label: React.CSSProperties = {
    fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: 8,
    textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: T.font.sans,
  }
  const eye = (
    <PasswordEye show={show} onToggle={() => setShow(s => !s)} />
  )

  const errBox = error && (
    <div role="alert" style={{ background: 'var(--negative-soft)', border: '1px solid var(--negative-border)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--negative)' }}>{error}</div>
  )

  // Τυποποιημένες επικεφαλίδες/υποκείμενα, ίδια ακριβώς με Σύνδεση/Εγγραφή.
  const h2s: React.CSSProperties = { fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: '0 0 8px' }
  const subs: React.CSSProperties = { fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: 1.6 }

  const mailIcon = (
    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--accent)' }}>
      <svg aria-hidden="true" width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 6 12 13 2 6" /></svg>
    </div>
  )
  const successIcon = (
    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--positive-soft)', border: '1px solid var(--positive-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--positive)' }}>
      <svg aria-hidden="true" width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
    </div>
  )

  return (
    <div className="auth-split" style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', fontFamily: T.font.sans }}>

      <a href="#main" className="skip-link">Μετάβαση στη φόρμα</a>

      {/* LEFT, κοινό marketing panel (AuthAside) */}
      <AuthAside
        headline="Νέος κωδικός,"
        accent="ίδια δεδομένα."
        sub="Ξέχασες τον κωδικό σου; Ορίζεις καινούριο και τα δεδομένα σου μένουν όπως τα άφησες."
        pillars={RESET_PILLARS}
      />

      {/* RIGHT, form: <main>, όπως στη Σύνδεση και στην Εγγραφή. */}
      <main id="main" className="auth-main" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 40px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <AuthMobileBrand />

          {mode === 'checking' && (
            <>
              <BackLink home />
              <h1 style={h2s}>Επαναφορά κωδικού</h1>
              <p role="status" style={subs}>Έλεγχος συνδέσμου…</p>
            </>
          )}

          {mode === 'request' && (
            <>
              {/* Ο ίδιος δρόμος πίσω με κάθε άλλη κατάσταση της Σύνδεσης και της
                  Εγγραφής: εδώ και στο «sent» έλειπε. */}
              <BackLink home />
              <h1 style={h2s}>Επαναφορά κωδικού</h1>
              {linkFailed && (
                <div role="alert" style={{ background: 'var(--warning-soft)', border: '1px solid var(--warning-border)', borderRadius: T.radius.inner, padding: '12px 14px', fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)', marginBottom: 16 }}>
                  Ο σύνδεσμος έληξε ή άνοιξε σε άλλη συσκευή. Ζήτησε νέο εδώ και άνοιξέ τον στην ίδια συσκευή.
                </div>
              )}
              <p style={subs}>Δώσε το email σου και θα σου στείλουμε έναν σύνδεσμο για να ορίσεις νέο κωδικό.</p>
              <form onSubmit={sendReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label htmlFor="rp-email" style={label}>Ηλεκτρονικό ταχυδρομείο</label>
                  <input id="rp-email" name="email" autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="onoma@email.com" style={field}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'} />
                </div>
                {errBox}
                {/* `field` γιατί η υποβολή κρατά όλο το πλάτος της φόρμας, όπως πριν. */}
                <Btn variant="primary" type="submit" field disabled={loading}>{loading ? 'Αποστολή…' : 'Στείλε σύνδεσμο'}</Btn>
              </form>
              <p style={{ fontSize: 13, marginTop: T.sp.xxl }}>
                <Link href="/login" className="lp-link po-tap" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Επιστροφή στη σύνδεση</Link>
              </p>
            </>
          )}

          {mode === 'sent' && (
            <div role="status">
              <BackLink home />
              <div style={{ textAlign: 'center' }}>
              {mailIcon}
              <h1 style={h2s}>Έλεγξε το email σου</h1>
              <p style={subs}>Αν υπάρχει λογαριασμός με αυτό το email, θα λάβεις σύνδεσμο επαναφοράς. Δες και τον φάκελο ανεπιθύμητων.</p>
              <Link href="/login" className="lp-link po-tap" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>Επιστροφή στη σύνδεση</Link>
              </div>
            </div>
          )}

          {mode === 'update' && (
            <>
              {/* ΤΟ ΤΕΤΑΡΤΟ ΑΔΙΕΞΟΔΟ ΤΗΣ ΙΔΙΑΣ ΟΙΚΟΓΕΝΕΙΑΣ. Οι δύο πρώτες οθόνες
                  της επαναφοράς προσφέρουν «Επιστροφή στη σύνδεση» και η
                  τελευταία «Μετάβαση στον πίνακα». Αυτή εδώ, όπου ο χρήστης
                  φτάνει από σύνδεσμο σε email, δεν είχε τίποτα: ούτε πίσω,
                  ούτε αρχική. Οποιος άνοιξε τον σύνδεσμο κατά λάθος έμενε
                  μπροστά σε μια φόρμα που δεν ζήτησε. */}
              <BackLink home />
              <h1 style={h2s}>Όρισε νέο κωδικό</h1>
              <p style={subs}>{`Διάλεξε έναν ισχυρό κωδικό, ${PASSWORD_MIN_LABEL.toLowerCase()}.`}</p>
              <form onSubmit={updatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label htmlFor="rp-password" style={label}>Νέος κωδικός</label>
                  <div style={{ position: 'relative' }}>
                    <input id="rp-password" name="new-password" autoComplete="new-password" type={show ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder={PASSWORD_MIN_LABEL} aria-describedby={password ? 'rp-pw-req' : undefined} style={{ ...field, paddingRight: 48 }}
                      onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'} />
                    {eye}
                  </div>
                  {password && <PasswordStrength password={password} id="rp-pw-req" onLeaked={setLeakedPw} />}
                </div>
                <div>
                  <label htmlFor="rp-confirm" style={label}>Επιβεβαίωση</label>
                  <input id="rp-confirm" name="new-password" autoComplete="new-password" type={show ? 'text' : 'password'} required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Ξαναγράψε τον κωδικό" aria-invalid={mismatch || undefined} aria-describedby={mismatch ? 'rp-confirm-err' : undefined} style={field}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'} />
                  {mismatch && <p id="rp-confirm-err" style={{ fontSize: 12, color: 'var(--negative-on-container)', margin: '6px 0 0', lineHeight: 1.5 }}>{MISMATCH}</p>}
                </div>
                {errBox}
                {/* Πατήσιμο πάντα, όπως στην Εγγραφή: το σβηστό κουμπί δεν έλεγε
                    γιατί. Ο λόγος έρχεται από τον updatePassword, στο πλαίσιο. */}
                <Btn variant="primary" type="submit" field disabled={loading}>{loading ? 'Αποθήκευση…' : 'Αποθήκευση κωδικού'}</Btn>
              </form>
            </>
          )}

          {mode === 'done' && (
            <div style={{ textAlign: 'center' }} role="status">
              {successIcon}
              <h1 style={h2s}>Ο κωδικός άλλαξε</h1>
              <p style={subs}>{othersOut
                ? 'Αποσυνδέσαμε κάθε άλλη συσκευή όπου ήταν ανοιχτός ο λογαριασμός σου.'
                : 'Ο νέος κωδικός ισχύει, αλλά οι άλλες συσκευές δεν αποσυνδέθηκαν. Κλείσ’ τες με την «Αποσύνδεση από όλες τις συσκευές», στην ενότητα Ασφάλεια.'}</p>
              {/* Προορισμός και όχι ενέργεια: με `href` γίνεται σύνδεσμος που ανοίγει
                  και σε νέα καρτέλα, με την ίδια ακριβώς όψη. */}
              <Btn variant="primary" href="/dashboard" field>Μετάβαση στον πίνακα</Btn>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
