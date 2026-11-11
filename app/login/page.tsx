'use client'
import { T, Btn, LinkBtn } from '@/components/Theme'
import { useState, useEffect, useSyncExternalStore } from 'react'
import { leaveDevice } from '@/lib/localPrivacy'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/supabase/lazy';
import { secondStepPending, MFA_SAY as MFA_SAY_EL } from '@/lib/auth/mfa';
import Link from 'next/link'
import AlreadySignedIn from '../AlreadySignedIn'
import { AuthMobileBrand } from '../AuthMobileBrand'
import PasswordEye from '../PasswordEye'
import GoogleButton, { useEmailFirst } from '../GoogleButton'
import { BackLink } from '../BackLink'
import { IDENTITY } from '@/lib/legal/identity';
import { continuation, carried } from '@/lib/auth/continuation';
import type { Locale } from '@/lib/i18n/locale';
import { localHref } from '@/lib/i18n/paths';
import { useAuthEn } from '@/lib/i18n/authEn';
import { useCaptcha } from '../useCaptcha';
import { captchaOptions } from '@/lib/auth/captcha';

// ΤΟ ΠΑΚΕΤΟ ΠΟΥ ΤΑΞΙΔΕΨΕ ΩΣ ΕΔΩ ΔΕΝ ΧΑΝΕΤΑΙ ΣΤΗΝ ΠΟΡΤΑ. Ο διαμεσολαβητής στέλνει
// το ανώνυμο «/tameio?plan=…&cycle=…» στη σύνδεση κρατώντας τη διεύθυνση· η
// σύνδεση όμως πήγαινε ΠΑΝΤΑ στον πίνακα. Τώρα γυρίζει στο ταμείο με το ίδιο
// πακέτο, όπως και η εγγραφή.
// ΚΑΙ ΤΟ «next» (04.10.2026). Ο χώρος του λογιστή στέλνει εδώ με
// «?next=/accountant/workspace» και η σύνδεση το αγνοούσε: ο λογιστής
// κατέληγε στον πίνακα. Η σειρά και οι έλεγχοι ζουν στο lib/auth/continuation.ts.
const afterSignIn = () => continuation(window.location.search)

// Η διεύθυνση δεν αλλάζει χωρίς πλοήγηση· στον διακομιστή είναι κενή.
const SEARCH_NEVER_CHANGES = () => () => {}
const readSearch = () => window.location.search

/** Οι νομικοί σύνδεσμοι κάτω από τη φόρμα: υπογραμμισμένοι όπως το `.po-link`. */
const LEGAL_LINK: React.CSSProperties = {
  color: 'var(--accent)', whiteSpace: 'nowrap',
  textDecorationLine: 'underline', textUnderlineOffset: 3, textDecorationThickness: 1,
}

// ═══════════════════════════════════════════════════════════════════════════
// Σύνδεση, στα χρώματα του app (design tokens, theme-aware light/dark).
// Δύο στήλες σε desktop· σε κινητό το marketing panel κρύβεται (auth-* classes).
// ═══════════════════════════════════════════════════════════════════════════

// ═══ ΤΟ ΚΕΙΜΕΝΟ ΤΟΥ ΣΦΑΛΜΑΤΟΣ ΦΤΑΝΕΙ ΜΕΤΑ ΤΗΝ ΕΝΥΔΑΤΩΣΗ ══════════════════════
// ΜΕΤΡΗΜΕΝΟ (07.10.2026, scripts/perf-budget.mjs). Το lib/core/dbError.ts μαζί
// με τους κανόνες κωδικού του lib/auth/password.ts κατέβαιναν στο αρχικό JS
// της σύνδεσης για τρία μηνύματα που γράφονται μόνο ΑΦΟΥ αποτύχει κάτι. Η
// σελίδα είχε 2,8 KB περιθώριο ως το όριο· με αυτό και με το πάνελ στο
// layout.tsx έχει 6,2 (173,7 → 170,3 KB). Το αρχείο ζητιέται μόλις ενυδατωθεί
// η σελίδα (βλ. το πρώτο effect), οπότε είναι ήδη εκεί όταν χρειαστεί· το
// μήνυμα είναι το ίδιο, από την ίδια `failed`.
//
// ΑΝ ΔΕΝ ΦΤΑΣΕΙ ΠΟΤΕ, Η ΦΟΡΜΑ ΔΕΝ ΚΟΛΛΑ. Χωρίς δίκτυο και για το ίδιο το αρχείο,
// το «τι δεν έγινε» λέγεται μόνο του, αντί να μείνει το κουμπί σε «Σύνδεση…».
const dbError = () => import('@/lib/core/dbError')
async function failed(what: string, e: unknown): Promise<string> {
  try { return (await dbError()).failed(what, e) }
  catch { return `${what}.` }
}

/** Η ανταλλαγή του διακριτικού απέτυχε και μας έστειλε εδώ. */
// Η ετικέτα του κουμπιού επαναποστολής: τη δείχνει η οδηγία του σφάλματος
// επιβεβαίωσης («Ξαναστείλε το email επιβεβαίωσης»), άρα ζει σε μία σταθερά.
const RESEND_LABEL = 'Ξαναστείλε το email επιβεβαίωσης'

const failedConfirm = () => {
  try { return new URLSearchParams(window.location.search).get('confirm') === 'failed' }
  catch { return false }
}

function OrDivider({ word = 'ή' }: { word?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
      <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>{word}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  // ── Η ΙΔΙΑ ΟΘΟΝΗ ΣΤΑ ΑΓΓΛΙΚΑ (/en/login) ───────────────────────────────
  // Ιδια ροή, ίδιοι έλεγχοι· αλλάζει μόνο το κείμενο (lib/i18n/en/auth.ts).
  // Το κείμενο το δίνει το layout του /en (lib/i18n/authEn.ts): εδώ `null`
  // σημαίνει ελληνικά και το αγγλικό λεξικό δεν μπαίνει στο πακέτο του /login.
  const A = useAuthEn(), L = A?.login
  const locale: Locale = A ? 'en' : 'el'
  const MFA_SAY = A ? A.mfa : MFA_SAY_EL
  const captcha = useCaptcha(locale)
  const fail = (el: string, en_: string | undefined, e: unknown) => A ? Promise.resolve(A.failed(en_ ?? el, e)) : failed(el, e)
  const [email, setEmail] = useState('')
  // Μέσα σε Instagram, Facebook ή TikTok χωρίς κουμπί προς Safari ή Chrome η
  // φόρμα του email έρχεται πρώτη και η σημείωση για τη Google από κάτω.
  const emailFirst = useEmailFirst()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  // Ο ΠΡΟΟΡΙΣΜΟΣ ΤΑΞΙΔΕΥΕΙ ΣΤΗΝ ΕΓΓΡΑΦΗ. Ο σύνδεσμος «Δημιούργησε λογαριασμό»
  // ήταν σκέτο «/signup»: όποιος ερχόταν με πακέτο ή με «next» και δεν είχε
  // λογαριασμό τα άφηνε στην πόρτα.
  const query = useSyncExternalStore(SEARCH_NEVER_CHANGES, readSearch, () => '')
  const carry = carried(query)

  // ── ΤΟ ΔΕΥΤΕΡΟ ΒΗΜΑ ─────────────────────────────────────────────────────
  // Το `factorId` ΕΙΝΑΙ ΚΑΙ Η ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΟΘΟΝΗΣ: όσο κρατά αναγνωριστικό
  // συσκευής, η ίδια φόρμα δείχνει το πεδίο του εξαψήφιου κωδικού αντί για το
  // ζεύγος email και κωδικού. Δεν υπάρχει δεύτερη σημαία που θα μπορούσε
  // κάποτε να αποκλίνει από αυτό.
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)

  // ── ΤΟ EMAIL ΠΟΥ ΔΕΝ ΕΠΙΒΕΒΑΙΩΘΗΚΕ ΕΧΕΙ ΔΡΟΜΟ ΑΠΟ ΕΔΩ ────────────────────
  // Το μήνυμα έλεγε σωστά τι φταίει και δεν έδινε κανένα επόμενο βήμα: ο
  // σύνδεσμος επιβεβαίωσης ξαναζητιόταν μόνο από την εγγραφή, δηλαδή με όνομα,
  // κωδικό και συγκατάθεση από την αρχή. Εδώ το email είναι ήδη γραμμένο.
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [resent, setResent] = useState(false)

  /**
   * Ζητά τον εξαψήφιο κωδικό της δηλωμένης συσκευής.
   *
   * ΑΝ Η ΣΥΣΚΕΥΗ ΔΕΝ ΒΡΕΘΕΙ, Η ΣΥΝΕΔΡΙΑ ΚΛΕΙΝΕΙ. Το `listFactors` επιστρέφει
   * μόνο ΕΠΑΛΗΘΕΥΜΕΝΟΥΣ παράγοντες· σφάλμα ή κενή απάντηση σημαίνει είτε
   * αποτυχία δικτύου είτε παράγοντα άλλου τύπου, που αυτή η οθόνη δεν ξέρει να
   * ζητήσει. Και στις δύο περιπτώσεις η συνεδρία «aal1» ΔΕΝ επιτρέπεται να
   * μείνει ζωντανή: θα ήταν ακριβώς η παράκαμψη που ο έλεγχος κλείνει.
   */
  // Το μήνυμα «δεν γίνεται τώρα» έρχεται ως όρισμα, στη γλώσσα της σελίδας.
  async function askSecondStep(supabase: Awaited<ReturnType<typeof authClient>>, stuck: string) {
    const { data: list, error: listError } = await supabase.auth.mfa.listFactors()
    const device = listError ? undefined : (list?.totp ?? [])[0]
    if (!device) {
      await supabase.auth.signOut()
      setSessionEmail(null); setFactorId(null)
      setError(stuck)
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
    router.push(afterSignIn())
  }

  useEffect(() => {
    void dbError().catch(() => {})
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
        if (secondStepPending(levels)) await askSecondStep(supabase, MFA_SAY.stuck)
      }
      // Ο ΣΥΝΔΕΣΜΟΣ ΕΠΙΒΕΒΑΙΩΣΗΣ ΠΟΥ ΔΕΝ ΔΟΥΛΕΨΕ ΛΕΓΕΤΑΙ ΜΕ ΛΕΞΕΙΣ. Η
      // ανταλλαγή του διακριτικού (app/auth/callback) καταλήγει εδώ όταν
      // αποτύχει· χωρίς αυτό, όποιος μόλις πάτησε «Επιβεβαίωση» στο email του
      // έβλεπε γυμνή φόρμα εισόδου και κανένα ίχνος του τι πήγε στραβά.
      //
      // ΜΟΝΟ ΣΕ ΑΣΥΝΔΕΤΟ: αν η συνεδρία υπάρχει, ο σύνδεσμος έκανε τη δουλειά
      // του και δεν υπάρχει τίποτα να διορθωθεί.
      // ΚΑΙ ΤΟ ΚΟΥΜΠΙ ΤΗΣ ΕΠΑΝΑΠΟΣΤΟΛΗΣ ΕΜΦΑΝΙΖΕΤΑΙ ΑΜΕΣΩΣ. Το μήνυμα ζητούσε
      // email και κωδικό «για να σου στείλουμε νέο», αλλά η «Σύνδεση» μόνο
      // δοκίμαζε είσοδο· το κουμπί έβγαινε μόνο μετά από δεύτερο σφάλμα.
      //
      // ΚΑΙ ΣΥΝΗΘΩΣ ΔΕΝ ΧΑΛΑΣΕ ΤΙΠΟΤΑ. Η πιο συχνή αποτυχία είναι ο σύνδεσμος που
      // άνοιξε σε ΑΛΛΗ συσκευή ή άλλο πρόγραμμα περιήγησης από εκείνο της
      // εγγραφής: ο πάροχος έχει ήδη επιβεβαιώσει τη διεύθυνση, μόνο η ανταλλαγή
      // κωδικού (PKCE) θέλει το ίδιο πρόγραμμα. Το μήνυμα έλεγε «δεν ισχύει πια»
      // και έστελνε σε επαναποστολή άνθρωπο που μπορούσε απλώς να συνδεθεί.
      if (!data.user && failedConfirm()) {
        setError(L ? L.confirmFailed : 'Αν άνοιξες τον σύνδεσμο σε άλλη συσκευή ή άλλο πρόγραμμα περιήγησης, το email σου είναι συνήθως ήδη επιβεβαιωμένο: απλώς συνδέσου. Αλλιώς γράψε το email σου και πάτησε «Ξαναστείλε το email επιβεβαίωσης».')
        setUnconfirmed(true)
      }
    })
    })()
    // Το L και το MFA_SAY δεν αλλάζουν όσο ζει η σελίδα: τα δίνει το layout.
  }, [L, MFA_SAY.stuck])

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
    setError(''); setUnconfirmed(false); setResent(false)
    setLoading(true)
    const supabase = await authClient()
    const captchaToken = await captcha.token()
    if (captchaToken === null) { setError(captcha.failMessage()); setLoading(false); return }
    const { error } = await supabase.auth.signInWithPassword({ email, password, options: captchaOptions(captchaToken) })
    captcha.reset()
    if (error) {
      const message = await fail('Η σύνδεση δεν έγινε', L?.failed, error)
      setError(message)
      setUnconfirmed(error.code === 'email_not_confirmed')
      setLoading(false); return
    }

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
    if (!secondStepPending(levels)) { router.push(afterSignIn()); return }
    await askSecondStep(supabase, MFA_SAY.stuck)
    setLoading(false)
  }

  // Η `signInWithOAuth` ΕΙΝΑΙ ΚΑΙ ΕΓΓΡΑΦΗ. Οποιος πατούσε εδώ χωρίς λογαριασμό
  // αποκτούσε έναν, χωρίς να δει ποτέ τους Ορους και χωρίς καμία απόδειξη
  // συγκατάθεσης στο προφίλ του: ακριβώς το κενό που το app/signup/page.tsx
  // περιγράφει ως διορθωμένο, ζωντανό μία διαδρομή παραδίπλα.
  //
  // Η επιστροφή πάει τώρα στο `/signup?oauth=login`, που ελέγχει αν υπάρχει ήδη
  // συγκατάθεση. Αν υπάρχει, προωθεί στο ταμείο ή στον πίνακα χωρίς να το καταλάβει κανείς.
  // Αν δεν υπάρχει, σταματά και ρωτά. Δεν συμπληρώνεται ποτέ εδώ: μια απόδειξη
  // που γράφτηκε χωρίς να δοθεί είναι χειρότερη από απόδειξη που λείπει.
  //
  // ΚΑΙ ΤΟ ΠΑΚΕΤΟ ΤΑΞΙΔΕΥΕΙ ΜΑΖΙ. Η σύνδεση με κωδικό γυρίζει στο ταμείο με το
  // πακέτο και τον κύκλο (`afterSignIn`)· η Google τα έχανε στην επιστροφή και
  // όποιος ερχόταν από τον τιμοκατάλογο κατέληγε στον πίνακα.
  // Το ίδιο και το «next». Η επιστροφή κουβαλά ΜΟΝΟ τη συνέχεια που πέρασε τον
  // έλεγχο (`carried`), ποτέ ό,τι άλλο έτυχε να βρίσκεται στη διεύθυνση.
  async function signInWithGoogle() {
    const back = new URLSearchParams(carried(window.location.search))
    back.set('oauth', 'login')
    const supabase = await authClient()
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}${localHref(locale, '/signup')}?${back.toString()}` } })
    if (error) setError(await fail('Η σύνδεση δεν έγινε', L?.failed, error))
  }

  /** Νέος σύνδεσμος επιβεβαίωσης, με την ίδια επιστροφή που δίνει η εγγραφή. */
  async function resendConfirmation() {
    if (!email.trim()) {
      setError(L ? L.needEmail : 'Γράψε πρώτα το email του λογαριασμού σου.')
      document.getElementById('login-email')?.focus()
      return
    }
    const supabase = await authClient()
    // Η Supabase ελέγχει διακριτικό και στην επαναποστολή, όχι μόνο στη σύνδεση.
    const captchaToken = await captcha.token()
    if (captchaToken === null) { setError(captcha.failMessage()); return }
    const { error } = await supabase.auth.resend({
      type: 'signup', email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(afterSignIn())}`, ...captchaOptions(captchaToken) },
    })
    captcha.reset()
    if (error) { setError(await fail('Το email δεν ξαναστάλθηκε', L?.notResent, error)); return }
    setError(''); setResent(true)
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

  // Το περίγραμμα των δύο στηλών, ο σύνδεσμος παράκαμψης και το πάνελ
  // (AuthAside) ζουν στο layout.tsx, στον διακομιστή. Εδώ μένει μόνο ό,τι έχει
  // κατάσταση: η στήλη της φόρμας.
  //
  // ── ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ ΕΙΝΑΙ <main> ΚΑΙ ΛΕΓΕΤΑΙ ─────────────────────────────
  // Μετρημένο: `document.querySelectorAll('main').length === 0` και καμία
  // περιοχή στο προσβάσιμο δέντρο. Ο χρήστης αναγνώστη οθόνης δεν είχε τρόπο
  // να πηδήξει στο κύριο μέρος — έπρεπε να διασχίσει ολόκληρη τη στήλη
  // παρουσίασης κάθε φορά.
  return (
    <main id="main" className="auth-main" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 40px' }}>
      {/* ── ΤΟ ΔΕΥΤΕΡΟ ΒΗΜΑ ΣΕ ΜΙΑ ΣΤΗΛΗ (09/11/2026) ─────────────────────
          Στον υπολογιστή το πεδίο του κωδικού είχε 200 πλάτος και το κουμπί
          από κάτω 460: δύο δεξιές ακμές, η μία στη μέση της στήλης. Τώρα η
          στήλη του βήματος είναι 420 και πεδίο, κουμπί και βοήθεια πιάνουν
          όλο το πλάτος της, όπως στο βήμα κωδικού της Google ή της Apple. */}
      <div className="auth-form" style={factorId ? { maxWidth: 420 } : undefined}>
        <AuthMobileBrand />
        {/* ── ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΜΙΑ ΦΟΡΜΑ ─────────────────────────────────
            ΤΟ ΔΕΥΤΕΡΟ ΒΗΜΑ ΔΕΝ ΠΗΡΕ ΔΙΚΗ ΤΟΥ ΦΟΡΜΑ, ΕΠΙΤΗΔΕΣ. Μια δεύτερη θα
            σήμαινε δεύτερο κουμπί υποβολής ζωγραφισμένο στο χέρι, δηλαδή
            δεύτερη όψη για την ίδια ενέργεια — και ο φύλακας των κουμπιών
            μετρά ακριβώς αυτό. Εδώ αλλάζουν τα πεδία, όχι το κουμπί.

            ΚΑΙ Η «ΗΔΗ ΣΥΝΔΕΔΕΜΕΝΟΣ» ΥΠΟΧΩΡΕΙ ΟΣΟ ΕΚΚΡΕΜΕΙ ΤΟ ΒΗΜΑ: αλλιώς
            όποιον στέλνει εδώ ο διαμεσολαβητής θα έβλεπε «μετάβαση στον
            πίνακα» και θα γύριζε αμέσως πίσω. Κλειστός βρόχος. */}
        {sessionEmail && !factorId ? (
          <AlreadySignedIn email={sessionEmail} onSignOut={signOut} signingOut={signingOut} mode="login" next={continuation(query)} />
        ) : (<>
        {/* ΣΕ ΚΙΝΗΤΟ ΔΕΝ ΥΠΗΡΧΕ ΚΑΝΕΝΑΣ ΔΡΟΜΟΣ ΠΙΣΩ. Το λογότυπο ζει στο
            αριστερό πάνελ, που κρύβεται κάτω από τις 900 και δεν ήταν καν
            σύνδεσμος. Όποιος άνοιγε τη Σύνδεση από την αρχική έμενε εκεί. */}
        <BackLink home locale={locale} />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: '0 0 6px' }}>
          {factorId ? (L ? L.mfaTitle : 'Επαλήθευση δύο βημάτων') : (L ? L.title : 'Καλώς όρισες ξανά')}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: 1.5 }}>
          {factorId ? MFA_SAY.ask : (<>
            {L ? L.noAccount : 'Δεν έχεις λογαριασμό;'}{' '}
            <Link href={`${localHref(locale, '/signup')}${carry}`} className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>{L ? L.create : 'Δημιούργησε λογαριασμό'}</Link>
          </>)}
        </p>

        {/* Ο πάροχος ταυτότητας ΞΕΚΙΝΑΕΙ σύνδεση. Στο δεύτερο βήμα η σύνδεση
            έχει ήδη ξεκινήσει: ένα κουμπί που την ξαναρχίζει θα ήταν δρόμος
            γύρω από την πρόκληση, όχι επιλογή. */}
        {!factorId && !emailFirst && (<>
        {/* `field` γιατί ο πάροχος κρατά όλο το πλάτος της στήλης, όπως πριν.
            Το `.auth-hov` έφυγε μαζί με το στυλ: την αιώρηση τη δίνει πλέον το
            `.po-btn[data-variant=secondary]`, που ξέρει και εστίαση με πληκτρολόγιο. */}
        <GoogleButton onClick={signInWithGoogle} />
        <OrDivider word={A ? A.or : undefined} />
        </>)}

        <form onSubmit={factorId ? verifySecondStep : handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {factorId ? (
            <div>
              <label htmlFor="login-mfa-code" className="po-field-label">{L ? L.code : 'Εξαψήφιος κωδικός'}</label>
              <input id="login-mfa-code" name="one-time-code" inputMode="numeric" maxLength={6} autoComplete="one-time-code"
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456"
                style={{ ...field, fontFamily: T.font.mono, fontSize: 18, letterSpacing: code ? '0.3em' : 'normal' }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'} />
            </div>
          ) : (<>
          <div>
            <label htmlFor="login-email" className="po-field-label">{A ? A.email : 'Ηλεκτρονικό ταχυδρομείο'}</label>
            <input id="login-email" name="email" autoComplete="email" type="email" value={email} required onChange={e => setEmail(e.target.value)} placeholder={A ? A.emailPlaceholder : 'onoma@email.com'} style={field}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'} />
          </div>
          <div>
            {/* Η ΣΕΙΡΑ ΤΗΣ ΕΤΙΚΕΤΑΣ ΚΡΑΤΑ ΤΟ ΥΨΟΣ ΤΗΣ ΕΤΙΚΕΤΑΣ (01.10.2026). Το
                «Ξέχασες τον κωδικό;» έχει στόχο αφής 44 και φούσκωνε ολόκληρη τη
                σειρά: στο τηλέφωνο η ετικέτα «Κωδικός» απείχε 30 από το πεδίο
                της, ενώ η «Ηλεκτρονικό ταχυδρομείο» από πάνω 12. Ο στόχος
                μένει 44 (`po-tap-inline`, ψευδοστοιχείο γύρω από το λεκτικό) και
                η σειρά έχει το ύψος του κειμένου, ίδιο με κάθε άλλη ετικέτα.
                Ύψος γραμμής ακέραιο (18, όχι 1,4 × 13 = 18,2): με το δεκαδικό ο
                στόχος έβγαινε 43,99 και ο σαρωτής αφής τον έκοβε. */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
              <label htmlFor="login-password" className="po-field-label" style={{ marginBottom: 0 }}>{A ? A.password : 'Κωδικός'}</label>
              <Link href={localHref(locale, '/reset-password')} className="lp-link po-tap-inline" style={{ fontSize: 13, lineHeight: '18px', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{L ? L.forgot : 'Ξέχασες τον κωδικό;'}</Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input id="login-password" name="password" autoComplete="current-password" type={show ? 'text' : 'password'} value={password} required onChange={e => setPassword(e.target.value)} placeholder={A ? A.passwordPlaceholder : 'Ο κωδικός σου'} style={{ ...field, paddingRight: 48 }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'} />
              <PasswordEye show={show} onToggle={() => setShow(s => !s)} />
            </div>
          </div>
          </>)}

          {error && (
            <div role="alert" style={{ background: 'var(--negative-soft)', border: '1px solid var(--negative-border)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--negative)' }}>
              {error}
            </div>
          )}
          {!factorId && unconfirmed && !resent && (
            <Btn variant="secondary" field onClick={resendConfirmation}>{L ? L.resend : RESEND_LABEL}</Btn>
          )}
          {!factorId && resent && (
            <p role="status" style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              {L ? L.resent(email.trim())[0] : 'Σου στείλαμε νέο σύνδεσμο επιβεβαίωσης στο '}<strong style={{ color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{email.trim()}</strong>{L ? L.resent(email.trim())[2] : '. Δες και τον φάκελο ανεπιθύμητων.'}
            </p>
          )}

          {!factorId && captcha.slot}
          <Btn variant="primary" type="submit" field disabled={busy}>
            {factorId
              ? (verifying ? (L ? L.verifying : 'Επαλήθευση…') : (L ? L.verify : 'Επαλήθευση'))
              : (loading ? (L ? L.signingIn : 'Σύνδεση…') : (L ? L.signIn : 'Σύνδεση'))}
          </Btn>
        </form>

        {!factorId && emailFirst && (<>
          <OrDivider word={A ? A.or : undefined} />
          <GoogleButton onClick={signInWithGoogle} />
        </>)}

        {/* ── Ο ΔΡΟΜΟΣ ΓΙΑ ΟΠΟΙΟΝ ΕΧΑΣΕ ΤΟ ΤΗΛΕΦΩΝΟ ΤΟΥ ────────────────────
            ΧΩΡΙΣ ΑΥΤΟ, Η ΟΘΟΝΗ ΕΙΝΑΙ ΑΔΙΕΞΟΔΟ: η συνεδρία «aal1» ζει, ο
            διαμεσολαβητής τον γυρίζει εδώ από κάθε σελίδα και δεν υπάρχει
            κουμπί να την κλείσει. Η έξοδος δεν παρακάμπτει τίποτα — σβήνει
            τη μισή συνεδρία αντί να την αφήσει ζωντανή. */}
        {factorId ? (
          /* ── Ο ΔΡΟΜΟΣ ΓΙΑ ΟΠΟΙΟΝ ΑΛΛΑΞΕ ΤΗΛΕΦΩΝΟ ─────────────────────────
             Κωδικοί ανάκτησης δεν υπάρχουν, οπότε όποιος έχασε τη συσκευή
             με την εφαρμογή επαλήθευσης έβλεπε μόνο την «Έξοδο»: κλειδωμένος,
             χωρίς να ξέρει σε ποιον να γράψει. Το email του λογαριασμού είναι
             το πρώτο στοιχείο ταυτότητας που μπορεί να ελεγχθεί.

             ΚΑΤΩ ΑΠΟ ΤΟ ΚΟΥΜΠΙ, Η ΕΡΩΤΗΣΗ ΣΕ ΜΙΑ ΣΕΙΡΑ ΚΑΙ Ο ΣΥΝΔΕΣΜΟΣ ΣΤΗΝ
             ΕΠΟΜΕΝΗ (09/11/2026). Μέσα στη φόρμα, ανάμεσα στο πεδίο και στο
             κουμπί, η πρόταση έπιανε δύο σειρές και ο σύνδεσμος κοβόταν στη
             μέση. Χωριστά, ο σύνδεσμος χωράει ολόκληρος σε μία σειρά.

             ΧΩΡΙΣ ΑΥΤΟ, Η ΟΘΟΝΗ ΕΙΝΑΙ ΑΔΙΕΞΟΔΟ: η συνεδρία «aal1» ζει, ο
             διαμεσολαβητής τον γυρίζει εδώ από κάθε σελίδα και δεν υπάρχει
             κουμπί να την κλείσει. Η έξοδος δεν παρακάμπτει τίποτα: σβήνει τη
             μισή συνεδρία αντί να την αφήσει ζωντανή. Ήσυχη, αριστερά στη
             στήλη, όπως κάθε άλλο στοιχείο της· ήταν το μόνο κεντραρισμένο. */
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              <span style={{ display: 'block' }}>{L ? L.noDevice : 'Δεν έχεις πρόσβαση στην εφαρμογή επαλήθευσης;'}</span>
              <a href={`mailto:${IDENTITY.supportEmail}?subject=${encodeURIComponent(L ? L.noDeviceSubject : 'Επαναφορά δεύτερου βήματος')}`} className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, display: 'inline-block' }}>{L ? L.noDeviceLink : 'Γράψε μας από το email του λογαριασμού σου'}</a>
            </p>
            <LinkBtn tone="quiet" onClick={signOut} disabled={signingOut}>
              {signingOut ? (L ? L.signingOut : 'Αποσύνδεση…') : (L ? L.signOut : 'Αποσύνδεση')}
            </LinkBtn>
          </div>
        ) : (
        /* ═══ Η ΓΡΑΜΜΗ ΤΩΝ ΟΡΩΝ ΕΣΠΑΓΕ ΓΙΑ ΕΝΑ ΚΟΜΜΑ ΚΑΙ ΜΙΑ ΤΕΛΕΙΑ ═════════
            ΜΕΤΡΗΜΕΝΟ ΣΕ CHROMIUM, 1440: η πρόταση θέλει 401,7 εικονοστοιχεία
            σε μία γραμμή και η στήλη της φόρμας δίνει 400. Επεφτε έξω κατά
            ΕΝΑ ΚΑΙ ΕΦΤΑ, οπότε το «απορρήτου.» κατέβαινε μόνο του σε δεύτερη
            σειρά — ορφανή λέξη κάτω από μια γεμάτη γραμμή, στην τελευταία
            εικόνα πριν από τη σύνδεση.

            ΤΙ ΔΕΝ ΕΚΑΝΑ. Δεν έκοψα λέξεις: «Συνεχίζοντας» είναι η πράξη που
            ενεργοποιεί τη συναίνεση και «Όρους χρήσης» είναι το όνομα του
            εγγράφου, ίδιο σε υποσέλιδο, εγγραφή και ρυθμίσεις. Χωρίς κόμμα
            βγαίνει 398,8 και χωρίς τελεία 398,7: χωράει με ΕΝΑ εικονοστοιχείο
            περιθώριο, δηλαδή σπάει ξανά με την πρώτη εφεδρική γραμματοσειρά.

            Η ΥΠΟΣΗΜΕΙΩΣΗ ΔΕΝ ΕΙΝΑΙ ΠΕΔΙΟ ΤΗΣ ΦΟΡΜΑΣ. Παίρνει δέκα
            εικονοστοιχεία παραπάνω από κάθε πλευρά — 420 συνολικά, με 18
            περιθώριο — και τα δανείζεται από το γέμισμα των 40 του <main>,
            που υπάρχει σε κάθε πλάτος. Σε τηλέφωνο το «calc» συρρικνώνεται
            μαζί με τη στήλη, οπότε τίποτα δεν βγαίνει από την οθόνη· εκεί
            τυλίγει — και το «balance» μοιράζει τις δύο σειρές αντί να αφήσει
           πάλι μία λέξη μόνη της. Οι δύο σύνδεσμοι δεν σπάνε ΜΕΣΑ τους: στα
           390 το «Όρους χρήσης» χωριζόταν σε δύο σειρές.
           ΚΑΙ ΣΕ ΜΙΑ ΓΡΑΜΜΗ ΣΤΟΝ ΥΠΟΛΟΓΙΣΤΗ (27.09.2026): «Όρους» αντί για
           «Όρους χρήσης», όπως στην εγγραφή· ο σύνδεσμος οδηγεί εκεί.
           ΚΑΙ ΞΑΝΑ ΣΕ ΜΙΑ ΓΡΑΜΜΗ (05/11/2026). Με το «Δες και την» η πρόταση
           θέλει 490 στα 13px και η στήλη έδινε 400 (440 από τα 1440): έσπαγε σε
           κάθε υπολογιστή. Στα 12px θέλει 452 και η στήλη γίνεται 460 από τα
           768 (.auth-form): χωράει χωρίς να βγαίνει από τις ευθείες των πεδίων.
           Στο τηλέφωνο τυλίγει, όπως πριν. */
        /* ΑΡΙΣΤΕΡΑ, ΟΠΩΣ ΚΑΘΕ ΑΛΛΟ ΣΤΟΙΧΕΙΟ ΤΗΣ ΦΟΡΜΑΣ (01.10.2026). Ηταν το
           μόνο κεντραρισμένο στοιχείο της στήλης και, φαρδύτερο κατά 20, το
           μόνο που ξέφευγε από τις ευθείες των πεδίων. Ιδια θέση και ίδιο
           μέγεθος με τη συναίνεση της εγγραφής.
           Η ΠΟΛΙΤΙΚΗ ΑΠΟΡΡΗΤΟΥ ΔΕΝ ΓΙΝΕΤΑΙ ΑΠΟΔΕΚΤΗ. Είναι ενημέρωση (άρθρα 13
           και 14 ΓΚΠΔ), όχι σύμβαση: «αποδέχεσαι» λέγεται μόνο για τους Όρους. */
        /* ΥΠΟΓΡΑΜΜΙΣΜΕΝΟΙ, ΟΠΩΣ ΚΑΘΕ ΣΥΝΔΕΣΜΟΣ ΜΕΣΑ ΣΕ ΠΡΟΤΑΣΗ (20.10.2026).
           Ηταν μόνο χρώμα: για όποιον δεν ξεχωρίζει το γαλάζιο από το γκρι, δύο
           λέξεις χωρίς καμία ένδειξη ότι πατιούνται. Ιδια γραμμή με το
           `.po-link`: 1px, 3px κάτω από τα γράμματα. */
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 20, marginBottom: 0, lineHeight: 1.6, textWrap: 'pretty' }}>
          {L ? L.legal[0] : <>Συνεχίζοντας, αποδέχεσαι τους{' '}</>}
          <Link href={localHref(locale, '/terms')} className="lp-link" style={LEGAL_LINK}>{A ? A.terms : 'Όρους'}</Link>{L ? L.legal[1] : <>. Δες και την{' '}</>}
          <Link href={localHref(locale, '/privacy')} className="lp-link" style={LEGAL_LINK}>{A ? A.privacy : 'Πολιτική απορρήτου'}</Link>{L ? L.legal[2] : '.'}
        </p>
        )}
        </>)}
      </div>
    </main>
  )
}
