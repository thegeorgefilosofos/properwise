'use client'
import { Btn, LinkBtn, ChipToggle } from '@/components/ThemeCore'
import { T } from '@/components/tokens'
import { KIND_LABEL, type FirmKind } from '@/lib/data/firmWords'
import { FIRM_TERMS_VERSION } from '@/lib/legal/firms'
import FirmTermsCheck, { FIRM_TERMS_NEEDED } from '@/app/accountant/workspace/FirmTerms'
import { useState, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { leakedAtSubmit } from '@/lib/auth/leakGate'
import { leaveDevice } from '@/lib/localPrivacy'
import { authClient, mayHaveSession } from '@/lib/supabase/lazy';
import Link from 'next/link'
import AlreadySignedIn from '../AlreadySignedIn'
import { AuthMobileBrand } from '../AuthMobileBrand'
import PasswordEye from '../PasswordEye'
import GoogleButton, { useEmailFirst } from '../GoogleButton'
import { countSignupStep } from '@/lib/analytics/signupFunnel'
import { BackLink } from '../BackLink'
import MailSent from '../MailSent'
import { emailProblem, suggestEmail, EMAIL_MSG } from '@/lib/auth/emailCheck'
import { checkPassword, PASSWORD_MIN_HINT, PASSWORD_MIN_LABEL, PASSWORD_MIN_LENGTH, PASSWORD_MSG } from '@/lib/auth/password'
import { hy } from '@/components/Hyphen'
import { SAY, failed as failedEl } from '@/lib/core/dbError';
import { PLANS, TRIAL_DAYS } from '@/lib/billing/plans';
// Καθαρή λογική, χωρίς React/Supabase: ασφαλής σε 'use client'.
import { planFromParam, cycleFromParam, planAtLeast, TRIAL_PLAN } from '@/lib/billing/entitlements';
import { continuation, carried } from '@/lib/auth/continuation';
import { secondStepPending } from '@/lib/auth/mfa';
import { fe } from '@/lib/core/format';
// Η μορφή του κωδικού πρόσκλησης ζει δίπλα στη γεννήτριά του, όχι εδώ.
import { isReferralCode } from '@/lib/referral/code';
import { oauthPatch, signupData } from '@/lib/auth/signupConsent'
import { applyNews, newsParam, pendingNews, type NewsChoice } from '@/lib/auth/signupNews'
import { usePlanTerms, useTrialBadge, useSignupCta } from './PlanTerms'
import { localeOfPath, type Locale } from '@/lib/i18n/locale'
import { useCaptcha } from '../useCaptcha'
import { captchaOptions } from '@/lib/auth/captcha'
import { localHref } from '@/lib/i18n/paths'
import { useAuthEn, type AuthEn } from '@/lib/i18n/authEn'
import { fmtFor } from '@/lib/core/format'

// Η έκδοση των Όρων που δέχεται ο χρήστης. Ήταν καρφωτή εδώ ως «2026-07», ενώ
// οι δύο σελίδες που υπογράφει γράφουν «Αύγουστος 2026»: η απόδειξη
// συγκατάθεσης έδειχνε σε κείμενο άλλου μήνα. Μία πηγή, στο μητρώο που κρατά
// ήδη κάθε νομικό στοιχείο.

// ═══════════════════════════════════════════════════════════════════════════
// Εγγραφή, στα χρώματα του app (design tokens, theme-aware). Κοινό marketing
// panel (AuthAside) με Σύνδεση/Επαναφορά. Google-first, με email ως δεύτερη οδό.
// Ο έλεγχος ισχύος κωδικού είναι κοινός (lib/auth/password) με επαναφορά/ρυθμίσεις.
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// ΜΙΑ ΠΕΡΙΟΧΗ ΑΦΗΣ ΓΙΑ ΤΑ ΔΥΟ ΠΛΑΙΣΙΑ ΑΠΟΔΟΧΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Η σελίδα έχει ΔΥΟ δρόμους προς την ίδια αποδοχή όρων: τη φόρμα με το
// ηλεκτρονικό ταχυδρομείο και την επιστροφή από τον πάροχο ταυτότητας. Το
// τετράγωνο είναι 16 εικονοστοιχεία και στους δύο, δηλαδή κάτω από τον μισό
// κανόνα των 44 και η λύση ήταν γραμμένη μόνο στον πρώτο.
//
// Μεγαλώνει η ΠΕΡΙΟΧΗ, όχι το σχήμα: ετικέτα 44 × 44 γύρω από το τετράγωνο, με
// αρνητικό περιθώριο που επιστρέφει τον χώρο. Οπτικά τίποτα δεν κουνιέται.
// Γραμμένη μία φορά, ώστε ο δεύτερος δρόμος να μη μείνει ξανά πίσω.
// ═══════════════════════════════════════════════════════════════════════════
const TAP: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 44, height: 44, flexShrink: 0, cursor: 'pointer',
};

// Ο σύνδεσμος δεν αλλάζει χωρίς πλοήγηση: η συνδρομή δεν έχει τι να ακούσει.
const SEARCH_NEVER_CHANGES = () => () => {}
const readSearch = () => window.location.search

// ═══ Ο ΣΥΝΔΕΣΜΟΣ ΕΠΙΒΕΒΑΙΩΣΗΣ, ΓΡΑΜΜΕΝΟΣ ΜΙΑ ΦΟΡΑ ═════════════════════════════
// Η πρώτη αποστολή περνούσε από την ανταλλαγή του διακριτικού και κρατούσε το
// πακέτο· η επαναποστολή δεν είχε καθόλου διεύθυνση επιστροφής, οπότε ο
// σύνδεσμος που ξαναστελνόταν άνοιγε στη γενική διεύθυνση του έργου: καμία
// συνεδρία, κανένα πακέτο και ο άνθρωπος κοιτούσε πάλι τη «Σύνδεση». Και οι
// δύο αποστολές περνούν πλέον από εδώ.
// ΚΑΙ ΚΟΥΒΑΛΑ ΤΟ «next». Γραφόταν μόνο το ταμείο ή ο πίνακας, οπότε ο λογιστής
// που ερχόταν από τον χώρο του και επιβεβαίωνε το email του κατέληγε στον
// πίνακα. Ο προορισμός βγαίνει από το lib/auth/continuation.ts.
/** Το γραφείο προσγειώνεται στον χώρο του, όχι στον πίνακα του ιδιοκτήτη. */
const firmQuery = (query: string) => {
  const q = new URLSearchParams(query)
  q.delete('plan'); q.delete('cycle')
  q.set('next', '/accountant/workspace')
  return `?${q.toString()}`
}

const confirmRedirect = (query: string) =>
  `${window.location.origin}/auth/callback?next=${encodeURIComponent(continuation(query))}`

/**
 * Η ΕΠΙΣΤΡΟΦΗ ΑΠΟ ΤΗΝ GOOGLE ΠΡΟΣΓΕΙΩΝΕΤΑΙ ΧΩΡΙΣ ΝΑ ΠΗΔΑ ΤΟ ΔΕΥΤΕΡΟ ΒΗΜΑ.
 *
 * Με δηλωμένη συσκευή, η συνεδρία που φέρνει η Google είναι «aal1». Ο
 * διαμεσολαβητής τη γύριζε στη σύνδεση για τον εξαψήφιο, αλλά ΧΩΡΙΣ το «next»:
 * μετά τον κωδικό ο λογιστής κατέληγε στον πίνακα. Εδώ η εκκρεμότητα στέλνει
 * κατευθείαν στη σύνδεση, με τη συνέχεια στη διεύθυνση. Αγνωστο επίπεδο
 * σημαίνει κι αυτό σύνδεση: εκεί η ίδια οθόνη το λέει και δεν ανοίγει τίποτα.
 */
async function land(supabase: Awaited<ReturnType<typeof authClient>>, query: string) {
  const { data: levels, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error || secondStepPending(levels)) { window.location.replace(`${localHref(localeOfPath(window.location.pathname), '/login')}${carried(query)}`); return }
  window.location.replace(continuation(query))
}

// ═══ Ο ΜΕΤΡΗΤΗΣ ΙΣΧΥΟΣ ΚΑΤΕΒΑΙΝΕΙ ΜΕΤΑ ΤΗΝ ΕΝΥΔΑΤΩΣΗ, ΟΧΙ ΠΡΙΝ ═══════════════
// Φαίνεται μόνο αφού γραφτεί ή αγγιχτεί ο κωδικός, άρα δεν έχει θέση στο JS που
// κρατά την πρώτη απόδοση (μετρημένο 07.10.2026: ~0,9 KB gzip από το αρχικό
// φορτίο της εγγραφής). Ζητείται αμέσως μετά την προσάρτηση, οπότε όταν
// πληκτρολογηθεί ο πρώτος χαρακτήρας είναι ήδη εδώ και αποδίδεται ΣΥΓΧΡΟΝΑ,
// όπως πριν: κρατιέται σε κατάσταση και όχι πίσω από `lazy`/`Suspense`, που
// θα τον έβγαζε ένα καρέ αργότερα και θα μετακινούσε τη φόρμα κάτω από το
// δάχτυλο. Η επαναφορά κωδικού και οι Ρυθμίσεις το εισάγουν όπως πριν.
// Αν δεν κατέβει (δίκτυο), ο μετρητής απλώς λείπει: η υποβολή κρίνει τον
// κωδικό μόνη της (`checkPassword`) και ο έλεγχος διαρροής αποτυγχάνει
// ανοιχτά, όπως όταν πέφτει το δίκτυο.
type Strength = (props: Parameters<typeof import('@/components/PasswordStrength').default>[0]) => ReactNode

/** Ως πότε ένας λογαριασμός της Google μετρά ως «μόλις δημιουργήθηκε». */
const FRESH_MS = 15 * 60 * 1000

/**
 * Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΟΥ ΧΩΝΙΟΥ ΚΑΙ ΓΙΑ ΤΗΝ GOOGLE. Το signed_up γραφόταν μόνο στο
 * app/auth/callback/route.ts (η δίδυμη διαδρομή του email)· η Google επιστρέφει
 * εδώ και δεν περνά από εκεί, οπότε καμία εγγραφή Google δεν μετρούσε. Το «μία
 * φορά ανά χρήστη» το εγγυάται το product_events_signup_once_idx
 * (scripts/db/product-events.sql), όχι ο κώδικας.
 *
 * Με όριο 1,5 δευτερολέπτου: η μέτρηση δεν καθυστερεί ποτέ την άφιξη. Ούτε
 * σκέτο `void`, γιατί το location.replace που ακολουθεί θα έκοβε την κλήση.
 * Χωρίς φορτίο: ούτε πηγή ούτε καμπάνια δένονται με τον λογαριασμό. Η εισαγωγή
 * κατ' απαίτηση κρατά το βάρος της σελίδας ίδιο.
 */
const countSignup = (supabase: Awaited<ReturnType<typeof authClient>>) => Promise.race([
  import('@/lib/analytics/events').then(m => m.track(supabase, m.PRODUCT_EVENTS.signed_up)),
  new Promise<void>(r => setTimeout(r, 1500)),
]).catch(() => {})

// Η απόδειξη της επιστροφής από την Google (`oauthPatch`) και τα `data` της
// εγγραφής με email (`signupData`) ζουν στο lib/auth/signupConsent.ts, με test.

/**
 * ΤΑ ΕΝΗΜΕΡΩΤΙΚΑ, ΟΠΩΣ ΤΑ ΔΙΑΛΕΞΕ. Η βάση κλείνει και τα δύο όταν δημιουργεί
 * τη γραμμή για όποιον δεν τσέκαρε και τα δύο (migration 20260925120000)· εδώ
 * γράφεται ρητά η επιλογή, για την περίπτωση που η γραμμή υπάρχει ήδη ή που
 * τσεκάρθηκε μόνο το ένα (lib/auth/signupNews.ts).
 */
async function newsNow(supabase: Awaited<ReturnType<typeof authClient>>, userId: string, meta: Record<string, unknown>) {
  // Η ΕΠΙΛΟΓΗ ΠΟΥ ΔΕΝ ΓΡΑΦΤΗΚΕ ΔΕΝ ΠΕΡΝΑ ΣΙΩΠΗΛΑ. Ο χρήστης που είπε «όχι» και
  // λαμβάνει ενημερωτικό είναι ακριβώς αυτό που ο νόμος απαγορεύει· επιστρέφεται
  // το σφάλμα και η οθόνη το δείχνει, με τη διέξοδο να ξαναδοκιμάσει.
  const pending = pendingNews(meta)
  return pending ? applyNews(supabase, userId, pending) : null
}

// «Τι δεν έγινε. Γιατί.» στη γλώσσα της σελίδας: το αγγλικό κείμενο το δίνει
// μόνο το layout του /en (lib/i18n/authEn.ts), αλλιώς ελληνικά από το dbError.
const failedIn = (A: AuthEn | null, el: string, en: string | undefined, e?: unknown) =>
  A ? A.failed(en ?? el, e) : failedEl(el, e)

function OrDivider({ word = 'ή' }: { word?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>{word}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
    </div>
  )
}

export default function SignupPage() {
  // ── Η ΙΔΙΑ ΟΘΟΝΗ ΣΤΑ ΑΓΓΛΙΚΑ (/en/signup) ──────────────────────────────
  // Ιδια ροή, ίδια συναίνεση, ίδιοι έλεγχοι· αλλάζει μόνο το κείμενο. Η
  // εφαρμογή μετά την εγγραφή είναι ελληνική και η οθόνη το λέει.
  // Το κείμενο το δίνει το layout του /en (lib/i18n/authEn.ts): εδώ `null`
  // σημαίνει ελληνικά και το αγγλικό λεξικό δεν μπαίνει στο πακέτο του /signup.
  const A = useAuthEn(), S = A?.signup
  const locale: Locale = A ? 'en' : 'el'
  const captcha = useCaptcha(locale)
  const failed = (el: string, en_: string | undefined, e?: unknown) => failedIn(A, el, en_, e)
  const PW_MSG = A ? { leaked: A.pw.leaked, weak: A.pw.weak, common: A.pw.common } : PASSWORD_MSG
  // Από το billingWords, στον διακομιστή (layout.tsx): `null` όσο το ταμείο χρεώνει.
  const planTerms = usePlanTerms()
  const trialBadge = useTrialBadge()
  // ── ΙΔΙΟΚΤΗΤΗΣ Ή ΓΡΑΦΕΙΟ ───────────────────────────────────────────────
  // Ο τύπος του λογαριασμού ορίζεται εδώ και δεν αλλάζει: ο λογαριασμός
  // γραφείου βλέπει πελάτες και δεν καταχωρεί ακίνητα (20261104120000). Το
  // γραφείο το γράφει η πρώτη συνδεδεμένη επίσκεψη στον χώρο του, από τα
  // στοιχεία που κρατά εδώ το προφίλ: πριν από την επιβεβαίωση δεν υπάρχει
  // συνεδρία. Πέντε πεδία συνολικά, σε ένα βήμα. Μόνο στα ελληνικά: ΑΦΜ και
  // λογιστικό γραφείο δεν έχουν νόημα για τον ξενόγλωσσο ιδιοκτήτη.
  const [accountKind, setAccountKind] = useState<'owner' | 'firm'>('owner')
  const [firmName, setFirmName] = useState('')
  const [firmAfm, setFirmAfm] = useState('')
  const [firmKind, setFirmKind] = useState<FirmKind>('accounting')
  // Οι όροι επεξεργασίας για λογαριασμό των πελατών (Οροι #grafeia). Η έκδοση
  // ταξιδεύει στο προφίλ και γίνεται αποδοχή του γραφείου όταν αυτό στηθεί.
  const [firmTerms, setFirmTerms] = useState(false)
  // Μέσα σε Instagram, Facebook ή TikTok χωρίς κουμπί προς Safari ή Chrome η
  // φόρμα του email έρχεται πρώτη και η σημείωση για τη Google από κάτω.
  const emailFirst = useEmailFirst()
  const [email, setEmail] = useState('')
  // ΤΟ EMAIL ΕΛΕΓΧΕΤΑΙ ΣΤΟ ΠΕΔΙΟ, ΜΕ ΕΛΛΗΝΙΚΑ (lib/auth/emailCheck.ts). Το σφάλμα
  // φαίνεται μόλις φύγει κανείς από το πεδίο ή πατήσει υποβολή, όχι όσο γράφει.
  const [emailTouched, setEmailTouched] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [consent, setConsent] = useState(false)
  // ΕΝΗΜΕΡΩΤΙΚΑ: ΑΝΕΝΕΡΓΑ ΑΠΟ ΠΡΟΕΠΙΛΟΓΗ (28.09.2026, απόφαση ιδιοκτήτη).
  // Από 25.09 το κουτί ξεκινούσε τσεκαρισμένο, πάνω στο άρθρο 11 παρ. 3
  // ν. 3471/2006. Το κείμενο όμως υπόσχεται και «νέα της αγοράς ακινήτων»,
  // που δεν είναι «δικά μας παρόμοια προϊόντα»: γι' αυτό το μέρος χρειάζεται
  // συγκατάθεση· συγκατάθεση με προτσεκαρισμένο κουτί δεν είναι έγκυρη.
  // Την παραμονή της πρώτης μαζικής επισκεψιμότητας η ασφαλής πλευρά κερδίζει.
  // ΚΑΙ ΔΥΟ ΚΟΥΤΙΑ ΑΠΟ 09/11/2026, ένα για κάθε σκοπό (lib/auth/signupNews.ts).
  const [news, setNews] = useState<NewsChoice>({ product: false, market: false })
  // Το κουμπί της Google δεν έχει «υποβολή» για να δείξει το πρόβλημα. Χωρίς
  // αυτό, το πάτημα χωρίς αποδοχή δεν έκανε τίποτα και έμοιαζε με βλάβη.
  const [consentTouched, setConsentTouched] = useState(false)
  // Η ΔΙΕΥΘΥΝΣΗ ΕΙΝΑΙ ΕΞΩΤΕΡΙΚΗ ΠΗΓΗ, ΟΧΙ ΚΑΤΑΣΤΑΣΗ. Ηταν τρεις προεπιλογές που
  // ένα effect διόρθωνε μετά την πρώτη απόδοση: όποιος ερχόταν από σύνδεσμο
  // πρόσκλησης με πακέτο έβλεπε για ένα καρέ ΑΛΛΟ πακέτο από αυτό που πάτησε.
  // Το `useSyncExternalStore` δίνει ξεχωριστή τιμή στον διακομιστή, άρα καμία
  // ασυμφωνία ενυδάτωσης. Ο σύνδεσμος δεν αλλάζει χωρίς πλοήγηση, οπότε η
  // συνδρομή δεν έχει τι να ακούσει.
  const query = useSyncExternalStore(SEARCH_NEVER_CHANGES, readSearch, () => '')
  const refCode = new URLSearchParams(query).get('ref') || ''
  // ΤΟ ΠΑΚΕΤΟ ΠΟΥ ΔΙΑΛΕΞΕ Ο ΕΠΙΣΚΕΠΤΗΣ ΣΤΟΝ ΤΙΜΟΚΑΤΑΛΟΓΟ. Φτάνει ως `?plan=`
  // από την κάρτα που πάτησε. Χωρίς αυτό, η μόνη απόφαση που πήρε στην αρχική
  // σελίδα χανόταν στη μετάβαση και η εγγραφή ξεκινούσε σαν να μην είχε
  // επιλέξει ποτέ τίποτα. Κρατιέται στο προφίλ, ώστε στη λήξη της δοκιμής να
  // ξέρουμε ΚΑΙ εμείς ΚΑΙ ο χρήστης ποιο πακέτο περιμένει.
  const firm = accountKind === 'firm'
  // Το γραφείο δεν διαλέγει πακέτο: πληρώνουν οι πελάτες του.
  const chosenPlan = firm ? null : planFromParam(new URLSearchParams(query).get('plan'))
  // ΚΑΙ Ο ΚΥΚΛΟΣ ΤΑΞΙΔΕΥΕΙ ΜΑΖΙ ΤΟΥ. Το πακέτο έφτανε μόνο του, οπότε η
  // επιλογή «ετήσια, με δύο μήνες δωρεάν» —η ακριβώς μισή απόφαση και η πιο
  // ακριβή— χανόταν στη μετάβαση: ο χρήστης κατέληγε στο ταμείο με μηνιαία
  // χρέωση, δηλαδή σε ΑΛΛΟ ποσό από εκείνο που πάτησε.
  const chosenCycle = cycleFromParam(new URLSearchParams(query).get('cycle'))
  const cta = useSignupCta(chosenPlan)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  /** Ηρθε από τη σύνδεση με Google και δεν έχει δεχτεί ποτέ τους Ορους. */
  const [needsConsent, setNeedsConsent] = useState<string | null>(null)
  /** Ο λογαριασμός της Google δημιουργήθηκε μόλις τώρα, άρα η «Ακύρωση» τον σβήνει. */
  const [freshAccount, setFreshAccount] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [show, setShow] = useState(false)
  const [pwTouched, setPwTouched] = useState(false)
  const [resent, setResent] = useState(false)
  /** Γιατί δεν ξαναστάλθηκε. Κενό όσο δεν έχει αποτύχει. */
  const [resendErr, setResendErr] = useState('')
  const [leakedPw, setLeakedPw] = useState<string | null>(null)
  // ΤΟ ΕΥΡΗΜΑ ΔΙΑΡΡΟΗΣ ΦΤΑΝΕΙ ΩΣ ΤΗΝ ΥΠΟΒΟΛΗ. Πριν, ζούσε μόνο μέσα στο
  // PasswordStrength: η οθόνη προειδοποιούσε και μετά δεχόταν τον κωδικό.
  // Κρατιέται ο ΙΔΙΟΣ ο κωδικός, όχι σημαία, ώστε η φραγή να παύει μόνη της
  // μόλις ο χρήστης αλλάξει έστω έναν χαρακτήρα.
  const leaked = leakedPw !== null && leakedPw === password
  const pw = checkPassword(password)
  const trans = (m: string) =>
    /already registered|already exists/i.test(m) ? (S ? S.exists : 'Υπάρχει ήδη λογαριασμός με αυτό το email.')
    : /weak|at least|6 char/i.test(m) ? (S ? S.weak : `Ο κωδικός είναι πολύ αδύναμος. Χρησιμοποίησε ${PASSWORD_MIN_LABEL.toLowerCase()}.`)
    : /rate limit|too many/i.test(m) ? (S ? S.tooMany : SAY.tooManyTries)
    : /valid email/i.test(m) ? (S ? S.invalidEmail : 'Το email δεν φαίνεται έγκυρο.')
    : m
  // Η ΚΟΡΥΦΗ ΤΟΥ ΧΩΝΙΟΥ, ανώνυμα (lib/analytics/signupFunnel.ts). Οι επιστροφές
  // από την Google (`oauth=…`) δεν είναι νέα επίσκεψη και δεν μετρώνται.
  const [PasswordStrength, setPasswordStrength] = useState<Strength | null>(null)
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('oauth')) countSignupStep('view')
    import('@/components/PasswordStrength').then(m => setPasswordStrength(() => m.default), () => {})
  }, [])
  useEffect(() => {
    // Ασύγχρονο ξετύλιγμα: το effect δεν επιστρέφει ποτέ υπόσχεση.
    // Χωρίς cookie συνεδρίας και χωρίς επιστροφή στη διεύθυνση, η απάντηση
    // είναι ήδη γνωστή: κανένας χρήστης. Ο πελάτης δεν φορτώνει (lib/supabase/lazy.ts).
    if (!mayHaveSession()) return
    void (async () => {
    const supabase = await authClient()
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user
      if (!u) { setSessionEmail(null); return }
      // ΕΠΙΣΤΡΟΦΗ ΑΠΟ ΤΗΝ GOOGLE. Συμπληρώνουμε ΜΟΝΟ ό,τι λείπει: ο χρήστης
      // που ξανασυνδέεται δεν επιτρέπεται να δει τη σφραγίδα συγκατάθεσής του
      // να ξαναγράφεται με σημερινή ημερομηνία — η απόδειξη είναι η ΠΡΩΤΗ.
      const q = new URLSearchParams(window.location.search)
      // ═══ ΔΥΟ ΔΙΑΔΡΟΜΕΣ ΕΠΙΣΤΡΟΦΗΣ ΚΑΙ Η ΔΙΑΦΟΡΑ ΤΟΥΣ ΕΙΝΑΙ Η ΣΥΓΚΑΤΑΘΕΣΗ ═══
      //
      // «oauth=1» σημαίνει ότι ο χρήστης πάτησε «Συνέχισε με Google» σε αυτή τη
      // σελίδα, με τη γραμμή αποδοχής ορατή ακριβώς κάτω από το κουμπί: το
      // πάτημα είναι η αποδοχή, μένει να καταγραφεί.
      //
      // «oauth=login» έρχεται από τη σελίδα σύνδεσης, όπου ΔΕΝ υπάρχει κουτί.
      // Και η `signInWithOAuth` είναι ΚΑΙ εγγραφή: ο πρωτοεμφανιζόμενος
      // αποκτούσε λογαριασμό χωρίς να δει ποτέ τους Ορους. Ηταν ακριβώς το
      // κενό που το σχόλιο παρακάτω περιγράφει ως διορθωμένο, ζωντανό μία
      // διαδρομή παραδίπλα.
      //
      // ΤΟ ΝΑ ΣΥΜΠΛΗΡΩΘΕΙ ΕΔΩ Η ΣΥΓΚΑΤΑΘΕΣΗ ΘΑ ΗΤΑΝ ΧΕΙΡΟΤΕΡΟ ΑΠΟ ΤΟ ΚΕΝΟ:
      // θα κατασκεύαζε απόδειξη για κάτι που δεν συνέβη. Οποιος έρχεται από τη
      // σύνδεση και ΔΕΝ έχει ήδη συγκατάθεση σταματά εδώ και ερωτάται. Οποιος
      // έχει, προχωρά χωρίς να το καταλάβει.
      const oauth = q.get('oauth')
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>
      // ΤΟ ΠΑΚΕΤΟ ΤΑΞΙΔΕΥΕΙ ΚΑΙ ΑΠΟ ΤΗ ΣΥΝΔΕΣΗ. Η επιστροφή «oauth=login»
      // πήγαινε πάντα στον πίνακα, οπότε όποιος ερχόταν από τον τιμοκατάλογο
      // με πακέτο και διάλεγε Google δεν έφτανε ποτέ στο ταμείο.
      // ΚΑΙ ΤΟ «next», με την ίδια σειρά που ισχύει παντού (continuation).
      if (oauth === 'login') {
        if (meta.consent_terms_accepted_at) { await land(supabase, window.location.search); return }
        setFreshAccount(!!u.created_at && Date.now() - Date.parse(u.created_at) < FRESH_MS)
        setNeedsConsent(u.email ?? '')
        return
      }
      if (oauth === '1') {
        const patch = oauthPatch(meta, q)
        if (Object.keys(patch).length) {
          // Η `updateUser` ΔΕΝ ΠΕΤΑΕΙ, ΕΠΙΣΤΡΕΦΕΙ `{ error }`. Το `try/catch`
          // που την τύλιγε δεν έπιανε τίποτα: μια αποτυχημένη εγγραφή της
          // συγκατάθεσης περνούσε σιωπηλά και ο λογαριασμός έμπαινε χωρίς
          // απόδειξη. Τώρα ο χρήστης μένει εδώ, βλέπει τι έγινε και ξαναδοκιμάζει.
          const { error } = await supabase.auth.updateUser({ data: patch })
          if (error) {
            setError(failedIn(A, 'Η αποδοχή δεν καταχωρήθηκε', S?.acceptFailed, error))
            setConsent(true)
            setFreshAccount(!!u.created_at && Date.now() - Date.parse(u.created_at) < FRESH_MS)
            setNeedsConsent(u.email ?? '')
            return
          }
        }
        const newsError = await newsNow(supabase, u.id, { ...meta, ...patch })
        if (newsError) {
          setError(failedIn(A, 'Η επιλογή των ενημερωτικών δεν καταχωρήθηκε', S?.newsFailed, newsError))
          setConsent(true)
          setNeedsConsent(u.email ?? '')
          return
        }
        if (u.created_at && Date.now() - Date.parse(u.created_at) < FRESH_MS) await countSignup(supabase)
        await land(supabase, window.location.search)
        return
      }
      setSessionEmail(u.email ?? null)
    })
    })()
    // Το A και το S δεν αλλάζουν όσο ζει η σελίδα: τα δίνει το layout.
  }, [A, S])

  /** Γράφει την απόδειξη συγκατάθεσης ΜΟΝΟ αφού δοθεί και μετά ανοίγει τον πίνακα. */
  async function acceptOauthConsent() {
    // ΤΟ ΤΕΤΡΑΓΩΝΟ ΕΙΝΑΙ ΠΙΑ ΠΙΟ ΚΑΤΩ ΑΠΟ ΤΟ ΚΟΥΜΠΙ, ΑΡΑ ΔΕΙΧΝΕΤΑΙ. Χωρίς
    // αυτό, όποιος πατούσε «Συνέχισε με Google» χωρίς αποδοχή έβλεπε το κουμπί
    // να μην κάνει τίποτα: το μήνυμα υπήρχε, αλλά εκτός οθόνης.
    if (!consent) {
      setConsentTouched(true)
      const box = document.getElementById('su-consent-oauth')
      box?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      box?.focus()
      return
    }
    setError('')
    const supabase = await authClient()
    // Το προφίλ διαβάζεται ώστε να συμπληρωθεί ΜΟΝΟ ό,τι λείπει. Αν δεν
    // διαβαστεί, δεν γράφουμε στα τυφλά πάνω σε ό,τι υπάρχει.
    const { data, error: readError } = await supabase.auth.getUser()
    if (readError) { setError(failed('Η αποδοχή δεν καταχωρήθηκε', S?.acceptFailed, readError)); return }
    const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>
    const patch = oauthPatch(meta, new URLSearchParams(window.location.search), news)
    const { error } = await supabase.auth.updateUser({ data: patch })
    if (error) { setError(failed('Η αποδοχή δεν καταχωρήθηκε', S?.acceptFailed, error)); return }
    const newsError = data.user ? await newsNow(supabase, data.user.id, { ...meta, ...patch }) : null
    if (newsError) { setError(failed('Η επιλογή των ενημερωτικών δεν καταχωρήθηκε', S?.newsFailed, newsError)); return }
    // Από το created_at και όχι από το freshAccount: ο κλάδος του oauth=1 με
    // σφάλμα στα ενημερωτικά φέρνει εδώ νέο λογαριασμό χωρίς να το ορίσει.
    if (data.user?.created_at && Date.now() - Date.parse(data.user.created_at) < FRESH_MS) await countSignup(supabase)
    await land(supabase, window.location.search)
  }

  // ═══ Η «ΑΚΥΡΩΣΗ» ΔΕΝ ΑΦΗΝΕΙ ΠΙΣΩ ΛΟΓΑΡΙΑΣΜΟ ΠΟΥ ΚΑΝΕΙΣ ΔΕΝ ΘΕΛΗΣΕ ═══════════
  // Η `signInWithOAuth` δημιουργεί τον λογαριασμό πριν δει ο άνθρωπος τους
  // Ορους. Οταν εδώ λέει «όχι», η αποσύνδεση μόνη της κρατούσε στη βάση email
  // και προφίλ Google χωρίς καμία αποδοχή: δεδομένα που δεν έχουμε λόγο να
  // κρατάμε. Ο λογαριασμός που γεννήθηκε ΤΩΡΑ σβήνεται από τη μία διαδρομή
  // διαγραφής (/api/account/delete), με ό,τι εκείνη φυλάει. Ενας παλιός
  // λογαριασμός χωρίς συγκατάθεση ΔΕΝ σβήνεται από ένα κουμπί «Ακύρωση»· μόνο
  // αποσυνδέεται.
  async function declineOauthConsent() {
    setSigningOut(true); setError('')
    if (freshAccount) {
      const res = await fetch('/api/account/delete', { method: 'POST' }).catch(() => null)
      if (!res?.ok) {
        const body = await res?.json().catch(() => null) as { error?: string } | null
        setError(body?.error || failed('Ο λογαριασμός δεν διαγράφηκε', S?.notDeleted))
        setSigningOut(false)
        return
      }
    }
    await signOut()
    setNeedsConsent(null)
  }

  async function signOut() {
    setSigningOut(true)
    const supabase = await authClient()
    await supabase.auth.signOut()
    // Αλλάζει λογαριασμός στην ΙΔΙΑ συσκευή: τα προσωπικά του προηγούμενου
    // δεν περνούν στον επόμενο.
    leaveDevice()
    setSessionEmail(null); setSigningOut(false)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Η ΕΓΓΡΑΦΗ ΜΕΣΩ GOOGLE ΕΧΑΝΕ ΤΡΙΑ ΠΡΑΓΜΑΤΑ ΠΟΥ Η ΕΓΓΡΑΦΗ ΜΕ EMAIL ΚΡΑΤΑ
  // ─────────────────────────────────────────────────────────────────────
  // Η φόρμα email γράφει στο προφίλ πότε έγιναν δεκτοί οι Όροι, ποια έκδοση,
  // ποιος έστειλε την πρόσκληση και ποιο πακέτο διάλεξε ο επισκέπτης. Η
  // `signInWithOAuth` δεν δέχεται `data`, οπότε η διαδρομή της Google δεν
  // έγραφε ΤΙΠΟΤΑ από τα τέσσερα:
  //
  //   • Καμία απόδειξη συγκατάθεσης. Η αρχή λογοδοσίας του GDPR ζητά να
  //     μπορούμε να δείξουμε ΠΟΤΕ και ΤΙ δέχθηκε ο χρήστης. Χειρότερα: το
  //     κουμπί δούλευε χωρίς καν να τσεκαριστεί το κουτί, άρα γινόταν
  //     λογαριασμός χωρίς αποδοχή των Όρων.
  //   • Καμία πρόσκληση. Ο συστήνων δεν έπαιρνε ποτέ τον μήνα του και δεν
  //     το μάθαινε κανείς — ο νέος χρήστης υπήρχε, απλώς χωρίς πατέρα.
  //   • Κανένα πακέτο. Ο επισκέπτης που πάτησε «Ιδιοκτήτης» στον τιμοκατάλογο
  //     έφτανε σαν να μην είχε διαλέξει ποτέ.
  //
  // Η λύση δεν χρειάζεται αποθήκευση στον περιηγητή: ό,τι ξέρουμε ταξιδεύει
  // στη διεύθυνση επιστροφής και γράφεται μόλις υπάρξει συνεδρία.
  // ═══════════════════════════════════════════════════════════════════════
  async function signInWithGoogle() {
    countSignupStep('google')
    // ΕΝΑ ΠΑΤΗΜΑ (13.11.2026). Ως τότε το κουμπί ζητούσε πρώτα το κουτί των
    // Όρων, που καθόταν ~450px πιο κάτω, κάτω από το όριο της οθόνης στο κινητό:
    // το πάτημα έκανε κύλιση αντί για Google. Στο χωνί, ένα πάτημα «google» και
    // καμία εγγραφή. Η αποδοχή δίνεται πλέον με το πάτημα, με τη γραμμή
    // `googleLegal` ορατή ακριβώς κάτω από το κουμπί. Η απόδειξη γράφεται
    // στην επιστροφή `oauth=1` (`oauthPatch`). Στη Σύνδεση δεν ισχύει το ίδιο:
    // εκεί η επιστροφή είναι `oauth=login` και ο νέος λογαριασμός περνά από το
    // «Ένα βήμα ακόμη» με κουτί, πριν γραφτεί οποιαδήποτε απόδειξη.
    setError('')
    const supabase = await authClient()
    // Η ΣΥΝΕΧΕΙΑ (πακέτο ή «next») ΕΡΧΕΤΑΙ ΕΛΕΓΜΕΝΗ ΑΠΟ ΤΟ `carried`: στη
    // διεύθυνση επιστροφής δεν γράφεται ποτέ τίποτα που δεν πέρασε τον έλεγχο.
    const back = new URLSearchParams(carried(query))
    back.set('oauth', '1')
    if (refCode) back.set('ref', refCode)
    back.set('news', newsParam(news))
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${localHref(locale, '/signup')}?${back.toString()}` },
    })
    if (error) setError(failed('Η εγγραφή δεν ολοκληρώθηκε', S?.failed, error))
  }

  // ═══ Η ΕΠΑΝΑΠΟΣΤΟΛΗ ΠΟΥ ΔΕΝ ΕΓΙΝΕ ΚΑΙ ΚΛΕΙΔΩΣΕ ΤΟ ΚΟΥΜΠΙ ═══════════════════
  // ΤΙ ΕΒΛΕΠΕ Ο ΝΕΟΣ ΧΡΗΣΤΗΣ. Δεν έφτασε το email επιβεβαίωσης, πατούσε
  // «Ξαναστείλε το email»· το κουμπί γινόταν «Το ξαναστείλαμε ✓» και
  // ΚΛΕΙΔΩΝΕ. Το `error` της κλήσης πεταγόταν. Οταν η επαναποστολή είχε
  // απορριφθεί, ο άνθρωπος περίμενε ένα email που δεν έφυγε ποτέ, χωρίς τρόπο
  // να ξαναδοκιμάσει, στην ΠΡΩΤΗ οθόνη που βλέπει από το προϊόν.
  //
  // Η ΑΠΟΡΡΙΨΗ ΕΙΝΑΙ Η ΚΑΝΟΝΙΚΗ ΠΕΡΙΠΤΩΣΗ, ΟΧΙ Η ΣΠΑΝΙΑ. Ο πάροχος ταυτότητας
  // περιορίζει τις επαναποστολές ανά διεύθυνση και ανά λεπτό: όποιος πατήσει
  // δύο φορές γρήγορα, ή είχε μόλις ζητήσει εγγραφή, πέφτει πάνω στο όριο. Το
  // μήνυμα λέει ακριβώς αυτό, γιατί «δοκίμασε σε ένα λεπτό» είναι οδηγία που
  // λύνει το πρόβλημα· ένα ✓ που δεν ισχύει δεν λύνει τίποτα.
  async function resend() {
    setResendErr('')
    const supabase = await authClient()
    // Η Supabase ελέγχει διακριτικό και στην επαναποστολή. Το πλαίσιο του
    // ελέγχου μετακομίζει στην οθόνη «Άνοιξε το email σου» μαζί με το κουμπί.
    const captchaToken = await captcha.token()
    if (captchaToken === null) { setResendErr(captcha.failMessage()); return }
    const { error } = await supabase.auth.resend({
      type: 'signup', email: email.trim(),
      options: { emailRedirectTo: confirmRedirect(query), ...captchaOptions(captchaToken) },
    })
    captcha.reset()
    if (error) { setResendErr(failed('Το email δεν ξαναστάλθηκε', S?.notResent, error)); return }
    setResent(true)
  }

  // ΕΝΑ ΠΑΤΗΜΑ, ΜΙΑ ΕΓΓΡΑΦΗ. Το `loading` ανάβει μόνο μετά τους ασύγχρονους
  // ελέγχους (ΑΦΜ γραφείου, διαρροή κωδικού) και ως τότε δεύτερο πάτημα
  // περνούσε κι αυτό: δύο `signUp`, δύο email. Η σημαία ref αλλάζει αμέσως,
  // χωρίς να περιμένει απόδοση.
  const submitting = useRef(false)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading || submitting.current) return
    submitting.current = true
    // Το `loading` σβήνει σε κάθε έξοδο ακόμη και όταν πεταχτεί εξαίρεση (δίκτυο που
    // κόπηκε στο `signUp`): αλλιώς η φόρμα έμενε κλειδωμένη ως την ανανέωση.
    try { await submitForm() } finally { submitting.current = false; setLoading(false) }
  }

  async function submitForm() {
    // Ο έλεγχος ψηφίου φορτώνει μόνο για το γραφείο: ο ιδιοκτήτης δεν τον πληρώνει σε βάρος σελίδας.
    if (firm && !firmTerms) {
      setError(FIRM_TERMS_NEEDED)
      countSignupStep('invalid')
      return
    }
    if (firm && (!firmName.trim() || !(await import('@/lib/core/greek')).isValidAfm(firmAfm))) {
      setError(!firmName.trim() ? 'Γράψε την επωνυμία του γραφείου.' : 'Ο ΑΦΜ του γραφείου δεν περνά τον έλεγχο ψηφίου.')
      countSignupStep('invalid')
      return
    }
    // Η ΑΠΟΔΟΧΗ ΤΩΝ ΟΡΩΝ ΕΙΝΑΙ Η ΙΔΙΑ Η ΥΠΟΒΟΛΗ (13.11.2026): η γραμμή κάτω από
    // το κουμπί τη λέει και η απόδειξη γράφεται παρακάτω, όπως πάντα.
    if (emailProblem(email)) {
      setEmailTouched(true)
      document.getElementById('su-email')?.focus()
      countSignupStep('invalid')
      return
    }
    if (!pw.ok) {
      setPwTouched(true)
      setError(pw.common ? PW_MSG.common : PW_MSG.weak)
      countSignupStep('invalid')
      return
    }
    // ΔΙΑΡΡΟΗ: ό,τι ξέρει ήδη το πεδίο, αλλιώς ρωτά η ίδια η υποβολή, γιατί ο
    // έλεγχος του πεδίου μπορεί να μην έχει απαντήσει (κωδικός που επικολλήθηκε,
    // lib/auth/leakGate.ts). Ένα μπλοκ για τις δύο περιπτώσεις: το /signup είναι
    // στο όριο βάρους του (docs/perf/budget.json). Ένας κωδικός που διέρρευσε
    // περνά ήδη την πολιτική ισχύος, οπότε η σειρά μετά το `pw.ok` δεν αλλάζει
    // κανένα μήνυμα. Το `loading` κλειδώνει και το πεδίο: αλλιώς ο χρήστης τον
    // άλλαζε όσο περίμενε και αποθηκευόταν ο προηγούμενος, που δεν τον ξέρει.
    setLoading(true)
    if (leaked || await leakedAtSubmit(password)) {
      setLoading(false)
      setLeakedPw(password)
      setPwTouched(true)
      setError(PW_MSG.leaked)
      countSignupStep('invalid')
      return
    }
    countSignupStep('submit')
    setError(''); setLoading(true)
    const supabase = await authClient()
    const captchaToken = await captcha.token()
    if (captchaToken === null) { setError(captcha.failMessage()); setLoading(false); countSignupStep('error'); return }
    // Αποδεικτικό συγκατάθεσης (GDPR, αρχή λογοδοσίας): καταγράφουμε στο προφίλ
    // του χρήστη ΠΟΤΕ αποδέχθηκε τους Όρους και την Πολιτική και ΠΟΙΑ έκδοσή τους,
    // ώστε η αποδοχή να είναι αποδείξιμη και να ζητηθεί εκ νέου αν αλλάξουν ουσιωδώς.
    const { error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: {
        ...captchaOptions(captchaToken),
        // Ο ΣΥΝΔΕΣΜΟΣ ΤΟΥ EMAIL ΠΕΡΝΑΕΙ ΑΠΟ ΤΗΝ ΑΝΤΑΛΛΑΓΗ ΤΟΥ ΔΙΑΚΡΙΤΙΚΟΥ.
        // Εδειχνε κατευθείαν στον πίνακα, ο οποίος ζητά συνεδρία — και συνεδρία
        // δεν υπάρχει ακόμη τη στιγμή που πατιέται ο σύνδεσμος. Ο
        // διαμεσολαβητής έστελνε τον νέο χρήστη στη φόρμα εισόδου, κρατώντας το
        // διακριτικό στη διεύθυνση: ο λογαριασμός άνοιγε, αλλά ο άνθρωπος
        // κατέληγε να κοιτά «Σύνδεση» αντί για την εφαρμογή του.
        emailRedirectTo: confirmRedirect(firm ? firmQuery(query) : query),
        data: signupData({
          firm: firm ? { account_kind: 'firm', firm_name: firmName.trim(), firm_afm: firmAfm, firm_kind: firmKind, firm_terms_version: FIRM_TERMS_VERSION } : null,
          news, refCode, plan: chosenPlan, cycle: chosenCycle,
        }),
      },
    })
    // ΤΟ `loading` ΕΠΑΝΕΡΧΕΤΑΙ ΚΑΙ ΣΤΗΝ ΕΠΙΤΥΧΙΑ, ΟΧΙ ΜΟΝΟ ΣΤΟ ΣΦΑΛΜΑ.
    // Οσο έμενε αναμμένο, η οθόνη «Ανοιξε το email σου» το κουβαλούσε από κάτω
    // της: όποιος πατούσε «Γράψε άλλη» γύριζε στη φόρμα και έβρισκε το κουμπί
    // κλειδωμένο στο «Δημιουργία…», για πάντα. Καμία διέξοδος εκτός από
    // ανανέωση της σελίδας και ο χρήστης δεν είχε τρόπο να το μαντέψει.
    captcha.reset()
    setLoading(false)
    countSignupStep(error ? 'error' : 'sent')
    if (error) setError(failed('Η εγγραφή δεν ολοκληρώθηκε', S?.failed, error))
    else setDone(true)
  }

  const field: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
    borderRadius: T.radius.btn, padding: '10px 16px', minHeight: T.h.lg, color: 'var(--text-primary)',
    fontSize: 14, fontFamily: 'inherit', transition: 'border-color .15s',
  }
  // Το κείμενο αποδοχής και οι δύο σύνδεσμοί του, ίδια και στα δύο πλαίσια.
  // Οι σύνδεσμοι δεν σπάνε ΜΕΣΑ τους: στα 390 έμενε «Πολιτική» στη μία γραμμή
  // και «απορρήτου.» στην άλλη, όπως είχε ήδη διορθωθεί στη Σύνδεση.
  // Οι σύνδεσμοι συναίνεσης έχουν po-tap-inline: στόχο 44 σε ψευδοστοιχείο,
  // 13px κάτω από τη γραμμή των 18. Χωρίς χώρο κάτω από τη σειρά, ο στόχος
  // σκέπαζε τα πρώτα 13px του επόμενου στοιχείου και έκλεβε πατήματα από το
  // κουμπί (ο σαρωτής διάταξης: «ξεχειλίζει πάνω στον επόμενο 13px»). Το κενό
  // είναι πραγματικό, όχι αρνητικό margin, ώστε ο στόχος να μην πατά σε τίποτα.
  const CONSENT_TAP_ROOM = 14
  // ΜΙΑ ΓΡΑΜΜΗ ΣΤΟΝ ΥΠΟΛΟΓΙΣΤΗ (27.09.2026). «Όρους χρήσης» γίνεται «Όρους»:
  // το κείμενο ήταν 452 εικονοστοιχεία σε ετικέτα 374 ως 394 και έσπαγε σε δύο.
  // Ο σύνδεσμος οδηγεί στους Όρους χρήσης και το aria-label του κουτιού τους
  // ονομάζει ολόκληρους.
  // ΚΑΙ «pretty», ΟΧΙ «balance» (01.10.2026): η ισορροπημένη αναδίπλωση μοίραζε
  // τις δύο σειρές εξίσου και έκοβε την πρώτη στη μέση της στήλης, με μισή
  // γραμμή άδεια δεξιά. Το «pretty» γεμίζει τη σειρά και φυλάει μόνο το τέλος
  // από ορφανή λέξη.
  const consentText: React.CSSProperties = { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, cursor: 'pointer', textWrap: 'pretty' }
  // Υπογραμμισμένοι, ίδια γραμμή με το `.po-link` και τη σύνδεση (20.10.2026):
  // το χρώμα μόνο του δεν λέει «πατιέται» σε όποιον δεν ξεχωρίζει τόνους.
  const consentLink: React.CSSProperties = { color: 'var(--accent)', textDecorationLine: 'underline', textUnderlineOffset: 3, textDecorationThickness: 1, fontWeight: 600, whiteSpace: 'nowrap' }
  // Η ΑΠΟΔΟΧΗ ΚΑΤΩ ΑΠΟ ΤΟ «ΣΥΝΕΧΙΣΕ ΜΕ GOOGLE» (13.11.2026). Το πάτημα του
  // κουμπιού γράφει την απόδειξη στην επιστροφή `oauth=1`, οπότε η γραμμή
  // στέκεται ακριβώς από κάτω του, όπου κι αν βρίσκεται το κουμπί.
  const googleLegal = (
    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '8px 0 0', lineHeight: 1.6, textAlign: 'center', textWrap: 'pretty' }}>
      {S ? S.legalGoogle[0] : <>Συνεχίζοντας με Google, αποδέχεσαι τους{' '}</>}
      <Link href={localHref(locale, '/terms')} className="lp-link" style={consentLink}>{A ? A.terms : 'Όρους'}</Link>{S ? S.legalGoogle[1] : <> και έχεις διαβάσει την{' '}</>}
      <Link href={localHref(locale, '/privacy')} className="lp-link" style={consentLink}>{A ? A.privacy : 'Πολιτική απορρήτου'}</Link>{S ? S.legalGoogle[2] : '.'}
    </p>
  )
  // Τα κουτιά των ενημερωτικών, με το ίδιο ιδίωμα αφής με το πρώτο. Δύο, ένα
  // για κάθε σκοπό, ατσεκάριστα και προαιρετικά: η εγγραφή προχωρά ό,τι κι
  // αν διαλέξεις (νομικός έλεγχος 09/11/2026, Π-5).
  const newsBox = (id: string, key: keyof NewsChoice, text: string) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingBottom: CONSENT_TAP_ROOM }}>
      <label htmlFor={id} style={{ ...TAP, margin: -14 }}>
        <input id={id} type="checkbox" checked={news[key]} onChange={e => { const on = e.target.checked; setNews(n => ({ ...n, [key]: on })) }}
          className="po-check" />
      </label>
      <label htmlFor={id} style={consentText}>{text}</label>
    </div>
  )
  const newsRow = (id: string) => (
    <>
      {newsBox(`${id}-product`, 'product', S ? S.newsProduct : 'Να μου στέλνετε νέα για τις λειτουργίες του PROPERWISE. Σταματούν από τον σύνδεσμο σε κάθε email.')}
      {newsBox(`${id}-market`, 'market', S ? S.newsMarket : 'Να μου στέλνετε το ενημερωτικό για την αγορά ακινήτων. Σταματά από τον σύνδεσμο σε κάθε email.')}
    </>
  )
  const errorBox: React.CSSProperties = { background: 'var(--negative-soft)', border: '1px solid var(--negative-border)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--negative)' }
  const focus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = 'var(--accent)' }
  const blur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = 'var(--border-default)' }

  /**
   * Τι λείπει, σε μία φράση. Κενό όταν η φόρμα είναι έτοιμη.
   *
   * ΕΝΑΣ ΛΟΓΟΣ ΤΗ ΦΟΡΑ, με τη σειρά που θα τον συναντήσει ο χρήστης: μια λίστα
   * με τρία «λείπει» δεν λέει από πού να αρχίσει.
   */
  const emailIssue = emailProblem(email)
  const emailMsg = emailIssue === 'empty' ? (S ? S.emailEmpty : EMAIL_MSG.empty) : emailIssue ? (S ? S.emailInvalid : EMAIL_MSG.invalid) : ''
  const emailShown = emailTouched && !!emailIssue
  // Η πρόταση για τυπογραφικό στον πάροχο (gmail.con): μόνο αφού φύγει από το πεδίο.
  const emailHint = emailTouched && !emailIssue ? suggestEmail(email) : null
  const why = loading ? ''
    : emailIssue ? emailMsg
    : leaked ? (S ? S.whyLeaked : 'Ο κωδικός βρίσκεται σε γνωστή διαρροή. Διάλεξε άλλον.')
    // Με άδειο πεδίο δεν λέγεται «δεν πληροί» (02.10.2026): ο αναγνώστης οθόνης
    // το ανακοίνωνε πριν γραφτεί ούτε ένας χαρακτήρας. Λέγεται τι λείπει.
    : !pw.ok ? (password ? (S ? S.whyWeak : 'Ο κωδικός δεν πληροί ακόμη τις προϋποθέσεις.') : (S ? S.whyEmpty : 'Γράψε κωδικό για να συνεχίσεις.'))
    : ''

  return (
    // Το περίγραμμα των δύο στηλών και το πάνελ αριστερά αποδίδονται στον
    // διακομιστή, στο layout.tsx: εδώ ζει μόνο ό,τι έχει κατάσταση.
    // ── ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ ΕΙΝΑΙ <main> ΚΑΙ ΛΕΓΕΤΑΙ ─────────────────────────
    // Μετρημένο: καμία περιοχή στο προσβάσιμο δέντρο, ούτε ένα <main>.
      <main id="main" className="auth-main" style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'var(--auth-top) 40px 48px' }}>
        <div className="auth-form">
          <AuthMobileBrand />
          {needsConsent ? (
            /* Ηρθε από τη σύνδεση με Google, ο λογαριασμός δημιουργήθηκε και οι
               Οροι δεν έχουν γίνει ποτέ δεκτοί. Δεν προχωρά χωρίς ρητή αποδοχή
               και δεν γράφεται τίποτα στο προφίλ πριν από αυτήν. */
            <div>
              {/* Η «Ακύρωση» αποσυνδέει, δηλαδή είναι δρόμος πίσω στη φόρμα.
                  Δεν είναι όμως δρόμος πίσω στην ΑΡΧΙΚΗ: όποιος μπήκε με
                  Google μόνο και μόνο για να δει τι είναι αυτό, χρειάζεται
                  έξοδο που δεν του ζητά να αποφασίσει τίποτα. */}
              <BackLink home locale={locale} />
              <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: '0 0 8px' }}>{S ? S.oneMore : 'Ένα βήμα ακόμη'}</h1>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px' }}>
                {S ? S.oauthConsent[0] : 'Πριν συνεχίσεις με το '}<strong style={{ color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{needsConsent}</strong>{S ? S.oauthConsent[1] : ', χρειάζεται να αποδεχτείς τους Όρους χρήσης και να διαβάσεις την Πολιτική απορρήτου.'}
              </p>
              {/* ΤΟ ΙΔΙΟ ΠΛΑΙΣΙΟ, ΜΕ ΤΟ ΙΔΙΟ ΙΔΙΩΜΑ. Εδώ το τετράγωνο ήταν γυμνό
                  16 × 16, ενώ το αδελφό του παρακάτω έχει ετικέτα 44 × 44 γύρω
                  του με αρνητικό περιθώριο. Δύο δρόμοι για την ΙΔΙΑ αποδοχή
                  όρων, ο ένας με στόχο αφής μισό του κανόνα. */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingBottom: CONSENT_TAP_ROOM }}>
                <label htmlFor="su-consent-oauth" style={{ ...TAP, margin: '-12px -14px -14px -14px' }}>
                  <input id="su-consent-oauth" type="checkbox" checked={consent}
                    onChange={e => { setConsent(e.target.checked); if (e.target.checked) setConsentTouched(false) }}
                    aria-label={S ? S.consentAria : 'Αποδέχομαι τους Όρους χρήσης και διάβασα την Πολιτική απορρήτου'}
                    className="po-check" />
                </label>
                <label htmlFor="su-consent-oauth" style={consentText}>
                  {S ? S.consent[0] : <>Αποδέχομαι τους{' '}</>}
                  <Link href={localHref(locale, '/terms')} className="lp-link po-tap-inline" style={consentLink}>{A ? A.terms : 'Όρους'}</Link>{S ? S.consent[1] : <> και διάβασα την{' '}</>}
                  <Link href={localHref(locale, '/privacy')} className="lp-link po-tap-inline" style={consentLink}>{A ? A.privacy : 'Πολιτική απορρήτου'}</Link>{S ? S.consent[2] : '.'}
                </label>
              </div>
              {consentTouched && !consent && (
                <p role="alert" style={{ fontSize: 12, color: 'var(--negative-on-container)', margin: '0 0 12px', lineHeight: 1.5 }}>
                  {S ? S.consentNeeded : 'Χρειάζεται να αποδεχτείς τους Όρους χρήσης για να συνεχίσεις.'}
                </p>
              )}
              {newsRow('su-news-oauth')}
              {error && (
                <div role="alert" style={{ ...errorBox, marginBottom: 12 }}>{error}</div>
              )}
              {/* `field` γιατί και τα δύο έπιαναν όλο το πλάτος της κάρτας. */}
              <Btn variant="primary" field onClick={acceptOauthConsent}>
                {S ? S.continue : 'Συνέχεια'}
              </Btn>
              <div style={{ marginTop: 10 }}>
                <Btn variant="secondary" field onClick={declineOauthConsent} disabled={signingOut}>
                  {signingOut ? (S ? S.cancelling : 'Ακύρωση…') : (S ? S.cancel : 'Ακύρωση')}
                </Btn>
              </div>
              {freshAccount && (
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, margin: '10px 0 0' }}>
                  {S ? S.freshDeleted : 'Αν ακυρώσεις, ο λογαριασμός που μόλις δημιουργήθηκε διαγράφεται.'}
                </p>
              )}
            </div>
          ) : sessionEmail ? (
            <AlreadySignedIn email={sessionEmail} onSignOut={signOut} signingOut={signingOut} mode="signup" next={continuation(query)} />
          ) : done ? (
            <>
              {/* ΤΟ ΑΔΙΕΞΟΔΟ. Η οθόνη «Ανοιξε το email σου» είχε ΕΝΑ κουμπί, το
                  «Ξαναστείλε» και τίποτα άλλο. Ο δρόμος πίσω μπαίνει πάνω, όπως
                  σε κάθε άλλη κατάσταση αυτής της σελίδας· η διόρθωση της
                  διεύθυνσης και η σύνδεση κάτω, δίπλα στην ενέργεια που κάποιος
                  δοκιμάζει πρώτη. Η όψη ζει στο app/MailSent.tsx, κοινή με την
                  επαναφορά κωδικού.

                  «ΣΟΥ ΣΤΕΙΛΑΜΕ» ΔΕΝ ΙΣΧΥΕΙ ΠΑΝΤΑ. Με επιβεβαίωση email, ο πάροχος
                  ταυτότητας απαντά «επιτυχία» και για διεύθυνση που έχει ήδη
                  λογαριασμό, χωρίς να στείλει τίποτα· γι' αυτό λέγονται και οι
                  δύο δρόμοι. Και η «συνδρομή» λέγεται μόνο όσο το ταμείο χρεώνει. */}
              <BackLink home locale={locale} />
              <MailSent
                title={S ? S.mailTitle : 'Άνοιξε το email σου'}
                email={email.trim()}
                body={S ? <>{S.mailBody(!!chosenPlan && !planTerms)[0]}<Link href={`${localHref(locale, '/login')}${carried(query)}`} className="lp-link" style={consentLink}>{S.mailBody(false)[1]}</Link>{S.mailBody(false)[2]}</> : <>Αν δεν υπάρχει ήδη λογαριασμός με αυτή τη διεύθυνση, σου στείλαμε σύνδεσμο επιβεβαίωσης. Πάτησέ τον για να μπεις{chosenPlan && !planTerms ? ' και να ολοκληρώσεις τη συνδρομή σου' : ''}. Αν υπάρχει ήδη, <Link href={`/login${carried(query)}`} className="lp-link" style={consentLink}>συνδέσου</Link>. Δες και τον φάκελο με <span style={{ whiteSpace: 'nowrap' }}>τα ανεπιθύμητα.</span></>}
                action={
                  /* Η σβηστή όψη μετά την αποστολή είναι το disabled του .po-btn. */
                  <>
                    {captcha.slot}
                    <Btn variant="primary" field onClick={resend} disabled={resent}>
                      {resent ? (S ? S.resent : 'Το ξαναστείλαμε') : (S ? S.resend : 'Ξαναστείλε το email')}
                    </Btn>
                    {/* Η αποτυχία κάθεται ΚΑΤΩ από το κουμπί που την προκάλεσε, με
                        το κουμπί ακόμη πατήσιμο. */}
                    {resendErr && (
                      <p role="alert" style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--negative)', fontWeight: 600 }}>{resendErr}</p>
                    )}
                  </>
                }
                footer={<>
                  {S ? S.wrongAddress : 'Λάθος διεύθυνση;'}{' '}
                  <LinkBtn onClick={() => { setDone(false); setResent(false); setResendErr(''); }}>{S ? S.other : 'Γράψε άλλη'}</LinkBtn>
                  {' · '}
                  <Link href={`${localHref(locale, '/login')}${carried(query)}`} className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{S ? S.login : 'Σύνδεση'}</Link>
                </>}
              />
            </>
          ) : (
            <>
              {/* ΣΕ ΚΙΝΗΤΟ ΔΕΝ ΥΠΗΡΧΕ ΚΑΝΕΝΑΣ ΔΡΟΜΟΣ ΠΙΣΩ. Το λογότυπο ζει στο
                  αριστερό πάνελ, που κρύβεται κάτω από τις 900 και δεν ήταν καν
                  σύνδεσμος. */}
              <BackLink home locale={locale} />
              {/* Η ΔΟΚΙΜΗ ΕΙΝΑΙ ΠΡΟΣΦΩΝΗΣΗ ΠΑΝΩ ΑΠΟ ΤΟΝ ΤΙΤΛΟ (01.10.2026). Ως σήμα
                  δίπλα στον τίτλο δεν χωρούσε στη στήλη των 400 και κατέβαινε
                  μόνο του σε δική του σειρά, ανάμεσα στον τίτλο και στο «Έχεις
                  ήδη λογαριασμό;»: τρία στοιχεία με τρία διαφορετικά κενά.
                  Ως μάτι πάνω από τον τίτλο κάθεται εκεί που το βάζει κάθε
                  δημόσια σελίδα (βλ. `lp-eyebrow`) και τίτλος και υπότιτλος
                  μένουν ζευγάρι. Λέγεται ΜΙΑ φορά: με διαλεγμένο πακέτο τη λέει
                  η κάρτα του πακέτου. Το κείμενο έρχεται από το billingWords. */}
              {/* Το γραφείο δεν πληρώνει και δεν έχει δοκιμή: η ετικέτα της δοκιμής δεν το αφορά. */}
              {!chosenPlan && !firm && trialBadge && <div className="lp-eyebrow" style={{ marginBottom: 10 }}>{trialBadge}</div>}
              <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2, margin: '0 0 8px' }}>{S ? S.title : 'Δημιουργία λογαριασμού'}</h1>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 24px' }}>
                {S ? S.haveAccount : 'Έχεις ήδη λογαριασμό;'}{' '}
                <Link href={`${localHref(locale, '/login')}${carried(query)}`} className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{S ? S.login : 'Σύνδεση'}</Link>
              </p>
              {/* Η ΑΞΙΑ, ΣΕ ΜΙΑ ΓΡΑΜΜΗ, ΕΚΕΙ ΠΟΥ ΚΡΥΒΕΤΑΙ ΤΟ ΠΑΝΕΛ (13.11.2026). Κάτω από
                  τα 860 το AuthAside δεν φαίνεται και η σελίδα ζητούσε email
                  και κωδικό χωρίς να λέει ούτε μία φορά τι παίρνεις. Το κείμενο
                  βγαίνει από τις στήλες του πάνελ (AuthAside.tsx). */}
              <p className="auth-mobile-only" style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '-12px 0 20px', textWrap: 'pretty' }}>
                {S ? S.value : 'Τα ακίνητά σου σε τάξη: λογαριασμοί, μισθώσεις και προθεσμίες σε μία οθόνη.'}
              </p>
              {/* Η ΕΦΑΡΜΟΓΗ ΕΙΝΑΙ ΕΛΛΗΝΙΚΗ: η αγγλική εγγραφή το λέει πριν, ήσυχα. */}
              {S && <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.5, margin: '-14px 0 24px' }}>{S.appLanguage}</p>}

              {/* ══ Η ΠΡΟΣΚΛΗΣΗ ΛΕΓΕΤΑΙ ΚΑΙ ΛΕΓΕΤΑΙ ΜΟΝΟ ΟΣΟ ΕΙΝΑΙ ΑΛΗΘΕΙΑ ══
                  Το `?ref=` διαβαζόταν σε κατάσταση, ταξίδευε στη Google και
                  γραφόταν στο προφίλ, αλλά δεν αποδιδόταν πουθενά: ο
                  προσκεκλημένος δεν μάθαινε ποτέ ότι η πρόσκληση καταγράφηκε,
                  ενώ το `?plan=` δίπλα του έπαιρνε ολόκληρο πλαίσιο.

                  ΓΙΑΤΙ ΔΕΝ ΓΡΑΦΕΙ «ΚΕΡΔΙΣΕΣ ΕΝΑΝ ΜΗΝΑ». Η `redeem_referral`
                  καταγράφει τη σύσταση και τίποτε άλλο· η
                  `sync_comp_from_referrals` πιστώνει μήνες ΜΟΝΟ στον
                  συστήνοντα. Δώρο στον νέο χρήστη δεν απονέμει κανένας κώδικας
                  και αποφασίστηκε ρητά να μην χτιστεί: παίρνει τη δοκιμή, όπως
                  κάθε νέος λογαριασμός. Οι σταθερές που το περιέγραφαν έφυγαν
                  από το lib/referral, ώστε να μη διαβάζονται ως εκκρεμότητα.

                  ΓΙΑΤΙ ΟΥΔΕΤΕΡΟ ΚΑΙ ΟΧΙ ΜΠΛΕ: το accent πλαίσιο ανήκει στην
                  επιλογή που έκανε ο επισκέπτης. Δύο έντονα πλαίσια στη σειρά
                  θα διάβαζαν και τα δύο ως προσφορά.

                  ΚΑΙ ΓΙΑΤΙ ΠΕΡΝΑΕΙ ΑΠΟ isReferralCode: ο κωδικός έρχεται από τη
                  διεύθυνση, δηλαδή τον γράφει ο καθένας. Οτι δεν έχει τη μορφή
                  της γεννήτριας δεν τυπώνεται στην οθόνη· ταξιδεύει όπως πριν
                  και το κρίνει ο server. */}
              {isReferralCode(refCode) && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', marginBottom: chosenPlan ? 12 : 24, borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-tertiary)', flexShrink: 0, marginTop: 8 }} />
                  {/* ΤΕΣΣΕΡΙΣ ΩΣ ΠΕΝΤΕ ΓΡΑΜΜΕΣ ΣΕ ΣΤΗΛΗ 400. Το πλαίσιο αφαιρεί το γέμισμα των 14 κι
                      την κουκκίδα με το κενό της, οπότε στο κείμενο μένουν 354: 208 χαρακτήρες
                      στα 13. Ριγμένη δεξιά άκρη ακριβώς πάνω από το πλαίσιο του τιμοκαταλόγου
                      διαβάζεται ως δεύτερη, πρόχειρη σημείωση. Στοίχιση με συλλαβισμό, ποτέ
                      χωρίς. Ο κωδικός είναι PO με επτά λατινικά ή ψηφία: ο συλλαβισμός
                      δεν αγγίζει λατινικά, οπότε μένει ακέραιος. */}
                  <span className="po-just" style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    {S ? <>{S.referral(refCode.trim())[0]}<strong style={{ color: 'var(--text-primary)' }}>{refCode.trim()}</strong>{S.referral(refCode.trim())[2]}</> : hy(<>Ήρθες με πρόσκληση. Ο κωδικός <strong style={{ color: 'var(--text-primary)' }}>{refCode.trim()}</strong> καταγράφεται με την εγγραφή και μετράει σε εκείνον που σε κάλεσε. Η δοκιμή των {TRIAL_DAYS} ημερών είναι ίδια για όλους.</>)}
                  </span>
                </div>
              )}

              {/* Η ΕΠΙΛΟΓΗ ΤΟΥ ΤΙΜΟΚΑΤΑΛΟΓΟΥ, ΕΠΙΒΕΒΑΙΩΜΕΝΗ. Ο επισκέπτης πάτησε
                  μια συγκεκριμένη κάρτα· το να μην την ξαναδεί πουθενά τον
                  αφήνει να αναρωτιέται αν καταγράφηκε.

                  ΓΙΑΤΙ ΔΕΝ ΓΡΑΦΕΙ «ΚΑΜΙΑ ΧΡΕΩΣΗ». Το έγραφε όσο δεν ζητούσαμε
                  κάρτα και ήταν αληθές τότε. Σήμερα το επόμενο βήμα ΕΙΝΑΙ η
                  κάρτα, οπότε η ίδια φράση θα στεκόταν δίπλα της λέγοντας το
                  αντίθετο. Στη θέση της μπαίνει το μόνο που ισχύει και πριν και
                  μετά: πόσο, πότε και ότι αλλάζει όποτε θέλει ο χρήστης.

                  ΚΑΙ ΤΟ ΠΟΣΟ ΓΡΑΦΕΤΑΙ ΟΛΟΚΛΗΡΟ, ΜΕ ΤΟΝ ΚΥΚΛΟ ΤΟΥ. Το επόμενο
                  βήμα μετά την επιβεβαίωση του email είναι το ταμείο, δηλαδή
                  μια κάρτα. Ο άνθρωπος που πάτησε «ετήσια, με δύο μήνες
                  δωρεάν» πρέπει να δει ΕΔΩ τα 99,00€ που θα δει και εκεί: μια
                  εγγραφή που δείχνει άλλο ποσό από την πληρωμή είναι ο πιο
                  σίγουρος τρόπος να εγκαταλειφθεί το ταμείο.

                  ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΓΡΑΦΕΙ ΕΔΩ ΤΗΝ ΗΜΕΡΟΜΗΝΙΑ ΤΗΣ ΠΡΩΤΗΣ ΧΡΕΩΣΗΣ.
                  Η οθόνη είναι `'use client'`: δεν μπορεί να ρωτήσει αν η
                  χρέωση είναι ρυθμισμένη, γιατί η απάντηση ζει σε μεταβλητή
                  περιβάλλοντος του διακομιστή. Μια καρφωτή πρόταση «χρεώνεσαι
                  την 31η ημέρα» θα ήταν ψέμα σε κάθε εγκατάσταση χωρίς
                  ρυθμισμένο ταμείο — ακριβώς το είδος του ψέματος που
                  διορθώνει ολόκληρο αυτό το πέρασμα. Η ημερομηνία λέγεται εκεί
                  που την ξέρει ο διακομιστής: στα ψιλά γράμματα του
                  τιμοκαταλόγου, στους Ορους και στο ίδιο το ταμείο.

                  ΚΑΙ ΓΙΑΤΙ ΕΦΥΓΕ Ο ΟΡΟΣ ΓΙΑ ΤΟ ΠΑΚΕΤΟ ΕΠΑΓΓΕΛΜΑΤΙΑ. Ελεγε ότι
                  «ισχύει εφόσον δηλώσεις τον αντίστοιχο τρόπο χρήσης», γιατί ο
                  τύπος προφίλ δηλωνόταν στο καλωσόρισμα και το ταμείο απαντούσε
                  403 σε όποιον δεν τον είχε ακόμη. Πλέον τον γράφει η ίδια η
                  αγορά, στον webhook: ο όρος δεν υπάρχει, άρα δεν λέγεται. */}
              {/* ── ΔΥΟ ΣΕΙΡΕΣ, ΔΥΟ ΣΤΗΛΕΣ, ΕΝΑΣ ΑΞΟΝΑΣ ────────────────────────────
                  ΤΕΣΣΕΡΙΣ ΓΡΑΦΕΣ ΧΡΕΙΑΣΤΗΚΑΝ ΚΑΙ ΟΛΕΣ ΟΙ ΠΡΟΗΓΟΥΜΕΝΕΣ ΕΠΕΣΑΝ
                  ΣΤΟ ΙΔΙΟ: ΤΥΠΟΓΡΑΦΙΚΗ ΑΝΟΜΟΙΟΓΕΝΕΙΑ. Η τελευταία είχε τέσσερα
                  μεγέθη σε δύο σειρές (16 για το όνομα, 15 για το ποσό, 15 σε
                  άλλο βάρος για τον κύκλο, 12,5 για τους όρους) και ένα
                  περιθώριο ανάμεσά τους. Κάθε στοιχείο ήταν σωστό μόνο του και
                  κανένα δεν ζύγιζε με το διπλανό.

                  ΤΟ ΣΧΗΜΑ ΕΙΝΑΙ ΠΛΕΓΜΑ, ΟΧΙ ΔΥΟ ΠΑΡΑΓΡΑΦΟΙ. Δύο στήλες, δύο
                  σειρές, ένας άξονας αριστερά και ένας δεξιά:

                      Ιδιοκτήτης+                99,00€
                      Ετήσια χρέωση          Δοκιμή 30 ημερών

                  Αριστερά ΤΙ ΕΙΝΑΙ, δεξιά ΤΙ ΠΛΗΡΩΝΕΙΣ. Η πάνω σειρά κρατά την
                  ταυτότητα, η κάτω τους όρους. Δύο μεγέθη συνολικά, δύο βάρη,
                  δύο χρώματα — και τα δύο κελιά κάθε σειράς μοιράζονται
                  γραμμή βάσης. Χωρίς περιθώριο ανάμεσα: τις χωρίζει μόνο το
                  ύψος γραμμής, όπως δύο σειρές του ίδιου πίνακα.

                  Η ΗΜΕΡΟΜΗΝΙΑ ΤΗΣ ΠΡΩΤΗΣ ΧΡΕΩΣΗΣ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ, για τον λόγο
                  που εξηγείται παραπάνω: η οθόνη είναι πελάτης και δεν ξέρει αν
                  η χρέωση είναι ρυθμισμένη. */}
              {chosenPlan && (
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr auto', columnGap: 16, rowGap: 2,
                  alignItems: 'baseline', padding: '14px 16px', marginBottom: 24, borderRadius: 10,
                  background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
                }}>
                  <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.45, color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>
                    {A ? A.plans[chosenPlan].name : PLANS[chosenPlan].name}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.45, color: 'var(--text-primary)', textAlign: 'right', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {/* Η ΤΙΜΗ ΛΕΕΙ ΚΑΙ ΤΗΝ ΠΕΡΙΟΔΟ. Σκέτο «79,90€» δεν έλεγε αν είναι
                        τον μήνα ή τον χρόνο. */}
                    {(A ? fmtFor('en').fe : fe)(chosenCycle === 'annual' ? PLANS[chosenPlan].priceAnnual : PLANS[chosenPlan].priceMonthly)}
                    <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{chosenCycle === 'annual' ? (S ? S.perYear : '/χρόνο') : (S ? S.perMonth : '/μήνα')}</span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.45, color: 'var(--text-tertiary)' }}>
                    {planTerms ?? (chosenCycle === 'annual' ? (S ? S.annual : 'Ετήσια χρέωση') : (S ? S.monthly : 'Μηνιαία χρέωση'))}
                  </span>
                  {/* Η ΔΟΚΙΜΗ ΔΙΝΕΙ ΤΟ TRIAL_PLAN, ΟΧΙ ΟΠΟΙΟ ΠΑΚΕΤΟ ΔΙΑΛΕΞΕΣ. Πάνω από
                      αυτό η ταμπέλα λέει σε ποιο πακέτο τρέχει η δοκιμή. */}
                  <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.45, color: 'var(--text-tertiary)', textAlign: 'right', whiteSpace: planAtLeast(TRIAL_PLAN, chosenPlan) ? 'nowrap' : undefined }}>
                    {A && S ? <>{S.trial}{!planAtLeast(TRIAL_PLAN, chosenPlan) && S.trialOn(A.plans[TRIAL_PLAN].name)}</> : <>Δοκιμή {TRIAL_DAYS} ημερών{!planAtLeast(TRIAL_PLAN, chosenPlan) && <> στο «{PLANS[TRIAL_PLAN].name}»</>}</>}
                  </span>
                </div>
              )}

              {/* ΙΔΙΟΚΤΗΤΗΣ Ή ΓΡΑΦΕΙΟ: ΟΧΙ ΠΙΑ ΠΡΩΤΗ ΑΠΟΦΑΣΗ (13.11.2026). Η ράγα με
                  τα δύο κουμπιά καθόταν πάνω από όλα τα πεδία, ~80px και μία
                  ερώτηση πριν από το πρώτο πεδίο, για τη μειοψηφία των γραφείων.
                  Το γραφείο μπαίνει από τον σύνδεσμο κάτω από τη φόρμα· όσο
                  είναι επιλεγμένο, η ένδειξη μένει εδώ με τον δρόμο πίσω. */}
              {!A && firm && (
                <div role="note" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 14px', marginBottom: 20, borderRadius: T.radius.inner, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>
                  Λογαριασμός λογιστή ή γραφείου
                  <LinkBtn className="po-tap-inline" onClick={() => { setAccountKind('owner'); setError('') }}>Είμαι ιδιοκτήτης</LinkBtn>
                </div>
              )}

              {!emailFirst && !firm && <>
                <GoogleButton onClick={signInWithGoogle} funnel />
                {googleLegal}
                <OrDivider word={A ? A.or : undefined} />
              </>}

              <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {firm && <>
                  <div>
                    <label htmlFor="su-firm" className="po-field-label">Επωνυμία γραφείου</label>
                    <input id="su-firm" name="organization" autoComplete="organization" type="text" value={firmName} onChange={e => setFirmName(e.target.value)} required style={field} onFocus={focus} onBlur={blur} />
                  </div>
                  <div>
                    <div>
                      <label htmlFor="su-afm" className="po-field-label">ΑΦΜ</label>
                      <input id="su-afm" name="afm" inputMode="numeric" type="text" value={firmAfm} onChange={e => setFirmAfm(e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="123456789" required style={{ ...field, fontVariantNumeric: 'tabular-nums' }} onFocus={focus} onBlur={blur} />
                    </div>
                  </div>
                  {/* ΔΥΟ ΕΙΔΗ, ΔΥΟ ΚΟΥΜΠΙΑ. Ίδια ράγα με τον τύπο λογαριασμού: ένα
                      dropdown για δύο επιλογές κρύβει τη μία από τις δύο. */}
                  <div>
                    <span id="su-kind" className="po-field-label">Είδος</span>
                    <div role="group" aria-labelledby="su-kind" className="po-seg" style={{
                      display: 'flex', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                      borderRadius: T.radius.chip, padding: 4, gap: 2, flexWrap: 'wrap',
                    }}>
                      {(Object.keys(KIND_LABEL) as FirmKind[]).map(k => (
                        <ChipToggle key={k} shape="seg" grow on={firmKind === k} onClick={() => setFirmKind(k)}>{KIND_LABEL[k]}</ChipToggle>
                      ))}
                    </div>
                  </div>
                </>}
                <div>
                  <label htmlFor="su-email" className="po-field-label">{A ? A.email : 'Ηλεκτρονικό ταχυδρομείο'}</label>
                  {/* ΧΩΡΙΣ ΤΟ ΟΝΟΜΑΤΕΠΩΝΥΜΟ (13.11.2026). Ηταν προαιρετικό, άρα δεν
                      χρειαζόταν για τίποτα, αλλά έπιανε ~86px πάνω από το email
                      και διαβαζόταν ως ένα ακόμη πεδίο. Το όνομα γράφεται όποτε
                      θέλει ο χρήστης, στις Ρυθμίσεις. */}
                  <input id="su-email" name="email" autoComplete="email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={email}
                    onChange={e => setEmail(e.target.value)} readOnly={loading} placeholder={A ? A.emailPlaceholder : 'onoma@email.com'}
                    aria-invalid={emailShown || undefined} aria-describedby={emailShown ? 'su-email-err' : emailHint ? 'su-email-hint' : undefined}
                    style={field} onFocus={focus}
                    onBlur={e => { blur(e); if (email.trim()) setEmailTouched(true) }} />
                  {emailShown && (
                    <p id="su-email-err" role="alert" style={{ fontSize: 13, color: 'var(--negative-on-container)', margin: '6px 0 0', lineHeight: 1.5 }}>{emailMsg}</p>
                  )}
                  {emailHint && (
                    <p id="su-email-hint" style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.5 }}>
                      {S ? S.emailSuggest : EMAIL_MSG.suggest}{' '}
                      <LinkBtn onClick={() => setEmail(emailHint)}>{emailHint}</LinkBtn>{S ? '?' : ';'}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="su-password" className="po-field-label">{A ? A.password : 'Κωδικός'}</label>
                  <div style={{ position: 'relative' }}>
                    <input id="su-password" name="new-password" autoComplete="new-password" type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} readOnly={loading} placeholder={A ? A.passwordHint : PASSWORD_MIN_HINT} required minLength={PASSWORD_MIN_LENGTH} aria-describedby={(password || pwTouched) ? "su-pw-req" : undefined} style={{ ...field, paddingRight: 48 }} onFocus={focus} onBlur={e => { blur(e); setPwTouched(true) }} />
                    <PasswordEye show={show} onToggle={() => setShow(s => !s)} />
                  </div>

                  {/* Μετρητής ισχύος + λίστα προϋποθέσεων (κοινό component) —
                      εμφανίζεται μόλις ο χρήστης αρχίσει να πληκτρολογεί.

                      Η ΑΝΑΦΟΡΑ ΤΟΥ ΠΕΔΙΟΥ ΑΚΟΛΟΥΘΕΙ ΤΗΝ ΥΠΑΡΞΗ ΤΟΥ ΣΤΟΧΟΥ. Το
                      `aria-describedby="su-pw-req"` δηλωνόταν ΠΑΝΤΑ, ενώ ο
                      στόχος αποδίδεται υπό συνθήκη. Μια σπασμένη αναφορά δεν
                      αγνοείται απλώς: καταπίνει και το placeholder, οπότε ο
                      χρήστης αναγνώστη οθόνης εστίαζε το άδειο πεδίο και δεν
                      άκουγε ΚΑΝΕΝΑΝ κανόνα κωδικού. Μετρημένο με
                      Accessibility.getPartialAXTree: description=undefined. */}
                  {(password || pwTouched) && PasswordStrength && <PasswordStrength password={password} id="su-pw-req" onLeaked={setLeakedPw} />}
                </div>

                {error && (
                  <div role="alert" style={errorBox}>
                    {trans(error)}
                  </div>
                )}

                {firm && <FirmTermsCheck id="su-firm-terms" checked={firmTerms} onChange={on => { setFirmTerms(on); setError('') }} />}
                {newsRow('su-news')}

                {/* ── ΤΟ ΑΝΕΝΕΡΓΟ ΚΟΥΜΠΙ ΠΟΥ ΔΕΝ ΕΛΕΓΕ ΓΙΑΤΙ ───────────────────
                    Ηταν `disabled`, δηλαδή ΕΞΩ από τη σειρά Tab. Ο χρήστης
                    πληκτρολογίου περνούσε ονοματεπώνυμο, email, κωδικό, κουτί
                    όρων, δύο συνδέσμους — και έβγαινε από τη φόρμα χωρίς να
                    συναντήσει ποτέ το κουμπί. Πατώντας Enter μέσα σε πεδίο,
                    τίποτα: καμία υποβολή, καμία εξήγηση, κενό `role=alert`.
                    Δηλαδή η εγγραφή έμοιαζε χαλασμένη.

                    Δοκιμάστηκε πρώτα `aria-disabled`: το κουμπί μένει
                    εστιάσιμο, αλλά ο αναγνώστης οθόνης το ανακοινώνει ως
                    «μη διαθέσιμο», οπότε ο χρήστης δεν το πατά — και πάλι δεν
                    μαθαίνει γιατί. Το ίδιο έκανε και ο αυτοματισμός δοκιμών,
                    που αρνήθηκε να το πατήσει.

                    Μένει λοιπόν ΚΑΝΟΝΙΚΟ κουμπί ΚΑΙ ΣΤΗΝ ΟΨΗ. Ηταν σβησμένο
                    στο 0,5 με δρομέα «απαγορεύεται», δηλαδή λευκό σε ανοιχτό
                    μπλε περίπου 2:1, ενώ πατιόταν και δούλευε: η εξαίρεση της
                    WCAG για ανενεργά στοιχεία δεν ισχύει σε κουμπί που κάνει
                    κάτι. Ο λόγος λέγεται με λέξεις μέσω aria-describedby πριν
                    το πάτημα και ο handleSubmit τον δείχνει πάνω στο πεδίο που
                    φταίει. Κανείς δεν μένει με κουμπί που σωπαίνει. */}
                {/* Ο λόγος, σε λέξεις, ΠΡΙΝ το πάτημα. Ο βλέπων χρήστης βλέπει το
                    κουμπί σβησμένο και μαντεύει· ο χρήστης αναγνώστη οθόνης δεν
                    έχει ούτε αυτό. */}
                <p id="su-cta-why" className="sr-only">{why}</p>
                {/* Το κοινό κύριο κουμπί, όπως στη Σύνδεση και στην Επαναφορά: ήταν
                    χειροποίητο «χάπι» επειδή το Btn δεν περνούσε ούτε το
                    `aria-describedby` ούτε τη σβηστή όψη χωρίς `disabled`. */}
                {/* ΤΟ ΛΕΚΤΙΚΟ ΑΚΟΛΟΥΘΕΙ ΤΟ ΠΑΚΕΤΟ ΠΟΥ ΗΡΘΕ ΑΠΟ ΤΗΝ ΚΑΡΤΑ. Ηταν σταθερό
                    «Ξεκίνα τη δοκιμή», οπότε όποιος πάτησε «Ξεκίνα δωρεάν» στην
                    αρχική διάβαζε εδώ ότι ξεκινά δοκιμή. Ο ίδιος κανόνας με την
                    κάρτα που πάτησε (lib/billing/trialOffer.ts), έτοιμος από το layout. */}
                {captcha.slot}
                <Btn variant="primary" type="submit" field describedBy={why ? 'su-cta-why' : undefined}>
                  {loading ? (S ? S.creating : 'Δημιουργία…') : firm ? 'Δημιουργία γραφείου' : cta}
                </Btn>
                {/* ── Η ΑΠΟΔΟΧΗ, ΜΙΑ ΓΡΑΜΜΗ ΚΑΤΩ ΑΠΟ ΤΗΝ ΕΝΕΡΓΕΙΑ (13.11.2026) ─────────
                    Ηταν υποχρεωτικό κουτί πάνω από το κουμπί, το οποίο σε κινητό
                    κατέληγε στα y=764 και το κουμπί στα 1011, δηλαδή εκτός
                    οθόνης. Οι Όροι (/terms) λένε ήδη «Με τη δημιουργία
                    λογαριασμού […] αποδέχεσαι τους παρόντες Όρους». Η ίδια
                    γραμμή στέκεται και κάτω από το «Συνέχισε με Google»
                    (`googleLegal`), ώστε να φαίνεται όπου φαίνεται το κουμπί.
                    Στη Σύνδεση η γραμμή ΔΕΝ μετρά ως αποδοχή: ο νέος λογαριασμός
                    από εκεί περνά από το «Ένα βήμα ακόμη». Η απόδειξη (πότε, ποια
                    έκδοση) γράφεται στο `signupData` και στο `oauthPatch`.
                    Οι συγκαταθέσεις που ΔΕΝ είναι σύμβαση μένουν χωριστά κουτιά:
                    τα δύο ενημερωτικά (ατσεκάριστα) και οι όροι του γραφείου.
                    Η Πολιτική απορρήτου δεν «γίνεται αποδεκτή»: είναι ενημέρωση. */}
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '-4px 0 0', lineHeight: 1.6, textWrap: 'pretty' }}>
                  {S ? S.legal[0] : <>Συνεχίζοντας με email, αποδέχεσαι τους{' '}</>}
                  <Link href={localHref(locale, '/terms')} className="lp-link" style={consentLink}>{A ? A.terms : 'Όρους'}</Link>{S ? S.legal[1] : <> και έχεις διαβάσει την{' '}</>}
                  <Link href={localHref(locale, '/privacy')} className="lp-link" style={consentLink}>{A ? A.privacy : 'Πολιτική απορρήτου'}</Link>{S ? S.legal[2] : '.'}
                </p>
              </form>
              {emailFirst && !firm && <>
                <OrDivider word={A ? A.or : undefined} />
                <GoogleButton onClick={signInWithGoogle} funnel />
                {googleLegal}
              </>}
              {!A && !firm && (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '24px 0 0', lineHeight: 1.5 }}>
                  Λογιστής ή γραφείο;{' '}
                  <LinkBtn className="po-tap-inline" onClick={() => { setAccountKind('firm'); setError('') }}>Λογαριασμός γραφείου</LinkBtn>
                </p>
              )}
            </>
          )}
        </div>
      </main>
  )
}
