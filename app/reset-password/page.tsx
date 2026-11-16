'use client'
import { T, Btn, LinkBtn } from '@/components/Theme'
import { useState, useEffect, useSyncExternalStore } from 'react'
import { authClient } from '@/lib/supabase/lazy';
import { leaveDevice } from '@/lib/localPrivacy'
import Link from 'next/link'
import { AuthMobileBrand } from '../AuthMobileBrand'
import PasswordEye from '../PasswordEye'
import { checkPassword, PASSWORD_MIN_HINT, PASSWORD_MIN_LABEL, PASSWORD_MSG } from '@/lib/auth/password'
import PasswordStrength from '@/components/PasswordStrength'
import { leakedAtSubmit } from '@/lib/auth/leakGate'
import { failed as failedEl } from '@/lib/core/dbError';
import { BackLink } from '../BackLink'
import MailSent from '../MailSent'
import type { Locale } from '@/lib/i18n/locale'
import { localHref } from '@/lib/i18n/paths'
import { useAuthEn } from '@/lib/i18n/authEn'
import { useCaptcha } from '../useCaptcha'
import { captchaOptions } from '@/lib/auth/captcha'

// ═══════════════════════════════════════════════════════════════════════════
// Επαναφορά κωδικού, δύο καταστάσεις:
//  • request: ο χρήστης δίνει email → στέλνουμε σύνδεσμο επαναφοράς.
//  • update:  ο χρήστης ήρθε από τον σύνδεσμο (PASSWORD_RECOVERY) → ορίζει νέο κωδικό.
// Ίδιο «δωμάτιο» με Σύνδεση/Εγγραφή (κοινό AuthAside).
// ═══════════════════════════════════════════════════════════════════════════

type Mode = 'checking' | 'request' | 'sent' | 'update' | 'done'

const MISMATCH_EL = 'Οι κωδικοί δεν ταιριάζουν.'

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

export default function ResetPasswordPage() {
  // Η ΙΔΙΑ ΟΘΟΝΗ ΣΤΑ ΑΓΓΛΙΚΑ (/en/reset-password): ίδια ροή, άλλο κείμενο.
  // Το κείμενο το δίνει το layout του /en (lib/i18n/authEn.ts): `null` = ελληνικά.
  const A = useAuthEn(), R = A?.reset
  const locale: Locale = A ? 'en' : 'el'
  const failed = (el: string, en_: string | undefined, e: unknown) => A ? A.failed(en_ ?? el, e) : failedEl(el, e)
  const MISMATCH = R ? R.mismatch : MISMATCH_EL
  const captcha = useCaptcha(locale)
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
    const redirectTo = `${window.location.origin}${localHref(locale, '/reset-password')}`
    const captchaToken = await captcha.token()
    if (captchaToken === null) { setLoading(false); setError(captcha.failMessage()); return }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo, ...captchaOptions(captchaToken) })
    captcha.reset()
    setLoading(false)
    if (error) setError(failed('Το μήνυμα επαναφοράς δεν στάλθηκε', R?.notSent, error)); else setMode('sent')
  }

  const [leakedPw, setLeakedPw] = useState<string | null>(null)
  // ΤΟ ΕΥΡΗΜΑ ΔΙΑΡΡΟΗΣ ΦΤΑΝΕΙ ΩΣ ΤΗΝ ΥΠΟΒΟΛΗ. Πριν, ζούσε μόνο μέσα στο
  // PasswordStrength: η οθόνη προειδοποιούσε και μετά δεχόταν τον κωδικό.
  // Κρατιέται ο ΙΔΙΟΣ ο κωδικός, όχι σημαία, ώστε η φραγή να παύει μόνη της
  // μόλις ο χρήστης αλλάξει έστω έναν χαρακτήρα.
  const pwOk = checkPassword(password).ok && !(leakedPw !== null && leakedPw === password)

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!pwOk) { setError(leakedPw === password ? (A ? A.pw.leaked : PASSWORD_MSG.leaked) : (A ? A.pw.weak : PASSWORD_MSG.weak)); return }
    if (password !== confirm) { setError(MISMATCH); return }
    setLoading(true)
    // ΤΟ `loading` ΣΒΗΝΕΙ ΣΕ ΚΑΘΕ ΕΞΟΔΟ ΑΚΟΜΗ ΚΑΙ ΣΕ ΕΞΑΙΡΕΣΗ (π.χ. δίκτυο που κόπηκε):
    // αλλιώς τα πεδία έμεναν κλειδωμένα και το κουμπί σβηστό ως την ανανέωση.
    try {
      // Η υποβολή ρωτά η ίδια: ο έλεγχος του πεδίου μπορεί να μην έχει απαντήσει ακόμη.
      if (await leakedAtSubmit(password)) {
        setLeakedPw(password); setLoading(false); setError(A ? A.pw.leaked : PASSWORD_MSG.leaked); return
      }
      const supabase = await authClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) { setLoading(false); setError(failed('Ο κωδικός δεν άλλαξε', R?.notChanged, error)); return }
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
    } finally {
      setLoading(false)
    }
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
    fontSize: 'var(--fs-base)', lineHeight: 1.3, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 8, fontFamily: T.font.sans,
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

  const successIcon = (
    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--positive-soft)', border: '1px solid var(--positive-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--positive)' }}>
      <svg aria-hidden="true" width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
    </div>
  )

  // Το περίγραμμα των δύο στηλών, ο σύνδεσμος παράκαμψης και το πάνελ
  // (AuthAside) ζουν στο layout.tsx, στον διακομιστή, όπως στη Σύνδεση και στην
  // Εγγραφή. Εδώ μένει μόνο ό,τι έχει κατάσταση: το <main> της φόρμας.
  return (
    <main id="main" className="auth-main" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 40px' }}>
      <div className="auth-form">
        <AuthMobileBrand />

        {mode === 'checking' && (
          <>
            <BackLink home locale={locale} />
            <h1 style={h2s}>{R ? R.title : 'Επαναφορά κωδικού'}</h1>
            <p role="status" style={subs}>{R ? R.checking : 'Έλεγχος συνδέσμου…'}</p>
          </>
        )}

        {mode === 'request' && (
          <>
            {/* Ο ίδιος δρόμος πίσω με κάθε άλλη κατάσταση της Σύνδεσης και της
                Εγγραφής: εδώ και στο «sent» έλειπε. */}
            <BackLink home locale={locale} />
            <h1 style={h2s}>{R ? R.title : 'Επαναφορά κωδικού'}</h1>
            {linkFailed && (
              <div role="alert" style={{ background: 'var(--warning-soft)', border: '1px solid var(--warning-border)', borderRadius: T.radius.inner, padding: '12px 14px', fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)', marginBottom: 16 }}>
                {R ? R.linkFailed : 'Ο σύνδεσμος έληξε ή άνοιξε σε άλλη συσκευή. Ζήτησε νέο εδώ και άνοιξέ τον στην ίδια συσκευή.'}
              </div>
            )}
            <p style={subs}>{R ? R.intro : 'Δώσε το email σου και θα σου στείλουμε έναν σύνδεσμο για να ορίσεις νέο κωδικό.'}</p>
            <form onSubmit={sendReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label htmlFor="rp-email" style={label}>{A ? A.email : 'Ηλεκτρονικό ταχυδρομείο'}</label>
                <input id="rp-email" name="email" autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder={A ? A.emailPlaceholder : 'onoma@email.com'} style={field}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'} />
              </div>
              {errBox}
              {captcha.slot}
              {/* `field` γιατί η υποβολή κρατά όλο το πλάτος της φόρμας, όπως πριν. */}
              <Btn variant="primary" type="submit" field disabled={loading}>{loading ? (R ? R.sending : 'Αποστολή…') : (R ? R.send : 'Στείλε σύνδεσμο')}</Btn>
            </form>
            <p style={{ fontSize: 13, marginTop: T.sp.xxl }}>
              <Link href={localHref(locale, '/login')} className="lp-link po-tap" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{R ? R.back : 'Επιστροφή στη σύνδεση'}</Link>
            </p>
          </>
        )}

        {mode === 'sent' && (
          <>
            <BackLink home locale={locale} />
            {/* Η ΙΔΙΑ ΟΨΗ ΜΕ ΤΗΝ ΕΓΓΡΑΦΗ (app/MailSent.tsx). Εδώ η επιφύλαξη
                είναι στο ίδιο το «σου στείλαμε»: η επαναφορά δεν λέει ποτέ αν
                υπάρχει λογαριασμός, ώστε να μη γίνεται μηχανή ελέγχου email. */}
            <MailSent
              title={A ? A.signup.mailTitle : 'Άνοιξε το email σου'}
              email={email.trim()}
              body={R ? R.mailBody : <>Αν υπάρχει λογαριασμός με αυτή τη διεύθυνση, σου στείλαμε σύνδεσμο επαναφοράς. Πάτησέ τον για να ορίσεις νέο κωδικό. Δες και τον φάκελο με <span style={{ whiteSpace: 'nowrap' }}>τα ανεπιθύμητα.</span></>}
              footer={<>
                {A ? A.signup.wrongAddress : 'Λάθος διεύθυνση;'}{' '}
                <LinkBtn onClick={() => setMode('request')}>{A ? A.signup.other : 'Γράψε άλλη'}</LinkBtn>
                {' · '}
                <Link href={localHref(locale, '/login')} className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{A ? A.signup.login : 'Σύνδεση'}</Link>
              </>}
            />
          </>
        )}

        {mode === 'update' && (
          <>
            {/* ΤΟ ΤΕΤΑΡΤΟ ΑΔΙΕΞΟΔΟ ΤΗΣ ΙΔΙΑΣ ΟΙΚΟΓΕΝΕΙΑΣ. Οι δύο πρώτες οθόνες
                της επαναφοράς προσφέρουν «Επιστροφή στη σύνδεση» και η
                τελευταία «Συνέχεια στην εφαρμογή». Αυτή εδώ, όπου ο χρήστης
                φτάνει από σύνδεσμο σε email, δεν είχε τίποτα: ούτε πίσω,
                ούτε αρχική. Οποιος άνοιξε τον σύνδεσμο κατά λάθος έμενε
                μπροστά σε μια φόρμα που δεν ζήτησε. */}
            <BackLink home locale={locale} />
            <h1 style={h2s}>{R ? R.updateTitle : 'Όρισε νέο κωδικό'}</h1>
            <p style={subs}>{R ? R.updateIntro : `Διάλεξε έναν ισχυρό κωδικό, ${PASSWORD_MIN_LABEL.toLowerCase()}.`}</p>
            <form onSubmit={updatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label htmlFor="rp-password" style={label}>{R ? R.newPassword : 'Νέος κωδικός'}</label>
                <div style={{ position: 'relative' }}>
                  <input id="rp-password" name="new-password" autoComplete="new-password" type={show ? 'text' : 'password'} required readOnly={loading} value={password} onChange={e => setPassword(e.target.value)} placeholder={A ? A.passwordHint : PASSWORD_MIN_HINT} aria-describedby={password ? 'rp-pw-req' : undefined} style={{ ...field, paddingRight: 48 }}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'} />
                  {eye}
                </div>
                {password && <PasswordStrength password={password} id="rp-pw-req" onLeaked={setLeakedPw} />}
              </div>
              <div>
                <label htmlFor="rp-confirm" style={label}>{R ? R.confirm : 'Επιβεβαίωση'}</label>
                <input id="rp-confirm" name="new-password" autoComplete="new-password" type={show ? 'text' : 'password'} required readOnly={loading} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={R ? R.confirmPlaceholder : 'Ξαναγράψε τον κωδικό'} aria-invalid={mismatch || undefined} aria-describedby={mismatch ? 'rp-confirm-err' : undefined} style={field}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'} />
                {mismatch && <p id="rp-confirm-err" style={{ fontSize: 12, color: 'var(--negative-on-container)', margin: '6px 0 0', lineHeight: 1.5 }}>{MISMATCH}</p>}
              </div>
              {errBox}
              {/* Πατήσιμο πάντα, όπως στην Εγγραφή: το σβηστό κουμπί δεν έλεγε
                  γιατί. Ο λόγος έρχεται από τον updatePassword, στο πλαίσιο. */}
              <Btn variant="primary" type="submit" field disabled={loading}>{loading ? (R ? R.saving : 'Αποθήκευση…') : (R ? R.save : 'Αποθήκευση κωδικού')}</Btn>
            </form>
          </>
        )}

        {mode === 'done' && (
          <div style={{ textAlign: 'center' }} role="status">
            {successIcon}
            <h1 style={h2s}>{R ? R.doneTitle : 'Ο κωδικός άλλαξε'}</h1>
            <p style={subs}>{R ? (othersOut ? R.doneOthersOut : R.doneOthersIn) : othersOut
              ? 'Αποσυνδέσαμε κάθε άλλη συσκευή όπου ήταν ανοιχτός ο λογαριασμός σου.'
              : 'Ο νέος κωδικός ισχύει, αλλά οι άλλες συσκευές δεν αποσυνδέθηκαν. Κλείσ’ τες με την «Αποσύνδεση από όλες τις συσκευές», στον «Λογαριασμό», ενότητα «Ασφάλεια».'}</p>
            {/* Προορισμός και όχι ενέργεια: με `href` γίνεται σύνδεσμος που ανοίγει
                και σε νέα καρτέλα, με την ίδια ακριβώς όψη. */}
            <Btn variant="primary" href="/dashboard" field>{R ? R.toApp : 'Συνέχεια στην εφαρμογή'}</Btn>
          </div>
        )}
      </div>
    </main>
  )
}
