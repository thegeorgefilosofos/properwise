// ═══════════════════════════════════════════════════════════════════════════
// ΕΙΣΟΔΟΣ, ΕΓΓΡΑΦΗ ΚΑΙ ΕΠΑΝΑΦΟΡΑ ΚΩΔΙΚΟΥ ΣΤΑ ΑΓΓΛΙΚΑ
// ─────────────────────────────────────────────────────────────────────────
// Οι ίδιες οθόνες (app/login, app/signup, app/reset-password) με την ίδια
// λογική: η γλώσσα βγαίνει από τη διαδρομή (/en/…) και αλλάζει μόνο το
// κείμενο. Μετά τη σύνδεση η εφαρμογή είναι ελληνική και η εγγραφή το λέει
// σε μία ήσυχη γραμμή.
// ═══════════════════════════════════════════════════════════════════════════
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password';
import { TRIAL_DAYS } from '@/lib/billing/plans';
import { captureError, worthReporting } from '@/lib/observability/report';
import { declarationYear } from '@/lib/core/declarationYear';
import { athensToday } from '@/lib/core/time';

export const AUTH_EN = {
  or: 'or',
  email: 'Email',
  emailPlaceholder: 'name@example.com',
  password: 'Password',
  passwordPlaceholder: 'Your password',
  passwordHint: `At least ${PASSWORD_MIN_LENGTH} characters`,
  showPassword: 'Show password',
  google: 'Continue with Google',
  terms: 'Terms',
  privacy: 'Privacy Policy',
  login: {
    metaTitle: 'Log in · PROPERWISE',
    metaDescription: 'Log in to your PROPERWISE account with email or Google.',
    title: 'Welcome back',
    mfaTitle: 'Two-step verification',
    noAccount: 'Don’t have an account?',
    create: 'Create an account',
    forgot: 'Forgot your password?',
    code: 'Six-digit code',
    noDevice: 'No access to your authenticator app?',
    noDeviceLink: 'Write to us from your account’s email',
    noDeviceSubject: 'Reset two-step verification',
    confirmFailed: 'If you opened the link on another device or in another browser, your email is usually already confirmed: just log in. Otherwise, enter your email and choose “Resend the confirmation email”.',
    needEmail: 'Enter your account email first.',
    resend: 'Resend the confirmation email',
    resent: (email: string) => ['We sent a new confirmation link to ', email, '. Check your spam folder too.'] as const,
    verifying: 'Verifying…', verify: 'Verify',
    signingIn: 'Logging in…', signIn: 'Log in',
    signingOut: 'Logging out…', signOut: 'Log out',
    legal: ['By continuing, you accept the ', '. See also our ', '.'] as const,
    failed: 'Login failed',
    notResent: 'The email was not resent',
  },
  mfa: {
    ask: 'Enter the six-digit code from your authenticator app.',
    wrong: 'That code is not correct. Try again.',
    stuck: 'We can’t complete the second step right now. Try again in a moment.',
  },
  signup: {
    title: 'Create your account',
    haveAccount: 'Already have an account?',
    login: 'Log in',
    appLanguage: 'The app itself is in Greek for now. English is on the way.',
    metaTitle: 'Sign up · PROPERWISE',
    metaDescription: (owner: string, trialPlan: string) => `Create an account on the “${owner}” plan, with no subscription. Every new account starts with a ${TRIAL_DAYS}-day trial of “${trialPlan}”.`,
    name: 'Full name', optional: '(optional)', namePlaceholder: 'First and last name',
    consent: ['I accept the ', ' and have read the ', '.'] as const,
    legal: ['By continuing with email or Google, you accept the ', ' and have read the ', '.'] as const,
    value: 'Your properties, in order: bills, leases and deadlines on one screen.',
    emailEmpty: 'Enter your email.',
    emailInvalid: 'That email doesn’t look right. Check the @ and the ending (e.g. .com).',
    emailSuggest: 'Did you mean',
    consentAria: 'I accept the Terms of use and have read the Privacy Policy',
    consentNeeded: 'You need to accept the Terms of use to continue.',
    newsProduct: 'Send me news about PROPERWISE features. You can stop them from the link in any email.',
    newsMarket: 'Send me the property market newsletter. You can stop it from the link in any email.',
    creating: 'Creating…',
    whyLeaked: 'This password appears in a known data breach. Choose another.',
    whyWeak: 'The password doesn’t meet the requirements yet.',
    whyEmpty: 'Enter a password to continue.',
    whyConsent: 'You need to accept the Terms of use.',
    oneMore: 'One more step',
    oauthConsent: ['Before you continue with ', ', you need to accept the Terms of use and read the Privacy Policy.'] as const,
    continue: 'Continue',
    cancelling: 'Cancelling…', cancel: 'Cancel',
    freshDeleted: 'If you cancel, the account that was just created is deleted.',
    mailTitle: 'Check your email',
    mailBody: (subscribe: boolean) => [
      `If there isn’t already an account with this address, we sent you a confirmation link. Click it to sign in${subscribe ? ' and complete your subscription' : ''}. If there is one, `,
      'log in',
      '. Check your spam folder too.',
    ] as const,
    resent: 'We sent it again', resend: 'Resend the email',
    wrongAddress: 'Wrong address?', other: 'Use another',
    referral: (code: string) => [`You were invited. The code `, code, ` is recorded with your sign-up and counts for the person who invited you. The ${TRIAL_DAYS}-day trial is the same for everyone.`] as const,
    perMonth: '/month', perYear: '/year',
    monthly: 'Billed monthly', annual: 'Billed annually',
    trial: `${TRIAL_DAYS}-day trial`,
    trialOn: (plan: string) => ` on “${plan}”`,
    failed: 'Sign-up failed',
    acceptFailed: 'Your acceptance was not saved',
    newsFailed: 'Your choice about newsletters was not saved',
    notDeleted: 'The account was not deleted',
    notResent: 'The email was not resent',
    exists: 'An account with this email already exists.',
    weak: `The password is too weak. Use at least ${PASSWORD_MIN_LENGTH} characters.`,
    tooMany: 'Too many attempts. Try again in a moment.',
    invalidEmail: 'That email doesn’t look valid.',
  },
  reset: {
    metaTitle: 'Reset your password',
    metaDescription: 'Set a new password for your PROPERWISE account.',
    title: 'Reset your password',
    checking: 'Checking the link…',
    linkFailed: 'The link has expired or was opened on another device. Request a new one here and open it on the same device.',
    intro: 'Enter your email and we’ll send you a link to set a new password.',
    sending: 'Sending…', send: 'Send link',
    back: 'Back to log in',
    mailBody: 'If there is an account with this address, we sent you a reset link. Click it to set a new password. Check your spam folder too.',
    updateTitle: 'Set a new password',
    updateIntro: `Choose a strong password of at least ${PASSWORD_MIN_LENGTH} characters.`,
    newPassword: 'New password',
    confirm: 'Confirm',
    confirmPlaceholder: 'Type the password again',
    mismatch: 'The passwords don’t match.',
    saving: 'Saving…', save: 'Save password',
    doneTitle: 'Your password has changed',
    doneOthersOut: 'We signed you out on every other device where your account was open.',
    doneOthersIn: 'Your new password is active, but your other devices were not signed out. Close them with “Sign out of all devices” under “Account”, in the “Security” section.',
    toApp: 'Continue to the app',
    notSent: 'The reset email was not sent',
    notChanged: 'The password was not changed',
  },
  signedIn: {
    title: 'You’re already logged in',
    body: (home: boolean, signup: boolean) => [
      'The account ',
      ` is active on this device. You can continue ${home ? 'to your dashboard' : 'where you were going'}${signup ? ' or, if you like, log out to create a new account' : ' or log out to sign in with another account'}.`,
    ] as const,
    open: 'Open your dashboard', go: 'Continue',
    signingOut: 'Logging out…',
    outNew: 'Log out and create a new account', outSwitch: 'Log out and switch accounts',
  },
  inApp: {
    title: (target: string) => `To sign in with Google, open this page in ${target}.`,
    body: 'Google doesn’t allow sign-in inside in-app browsers like this one. With the email form above, you can stay right here.',
    chrome: 'Chrome', safari: 'Safari', browser: 'your browser',
    openChrome: 'Open in Chrome', openSafari: 'Open in Safari',
    safariHint: 'If it doesn’t open, tap the three dots at the top right and choose to open in Safari.',
    menuSafari: 'Tap the three dots at the top right and choose to open in Safari.',
    menuBrowser: 'Open the app’s menu and choose to open in your browser.',
  },
  pw: {
    checks: {
      len: `At least ${PASSWORD_MIN_LENGTH} characters`,
      lower: 'One lowercase letter (a–z)',
      upper: 'One uppercase letter (A–Z)',
      digit: 'One number (0–9)',
      symbol: 'One symbol (!@#$…)',
    } as Record<string, string>,
    leaked: 'This password appears in a known data breach. Choose another.',
    leakedMany: 'This password appears in known data breaches more than 100,000 times. Choose another.',
    weak: 'The password doesn’t meet all the security requirements.',
    common: 'This password is too common. Choose another.',
  },
};

// ── Η αριστερή στήλη των τριών οθονών (app/AuthAside.tsx) ──────────────────
export const ASIDE_EN = {
  foot: 'Designed for the Greek property market',
  login: {
    headline: 'Your Greek property,', accent: 'without a drawer full of paper.',
    sub: 'Income, expenses, leases and taxes, for one property or a whole portfolio in Greece.',
    pillars: () => [
      { label: 'From photo to the right place', text: 'Photograph a bill, lease or insurance policy. The app reads it, you check the details, and it is filed.' },
      { label: 'Noa, by voice or text', text: 'Ask in Greek and get answers from your own property data.' },
      { label: 'Your finances, clearly', text: `Yield, bills, deadlines and ${declarationYear(athensToday())} taxes, on one screen.` },
    ],
  },
  signup: {
    headline: 'Your properties,', accent: 'in order.',
    sub: 'Add your properties and photograph your first electricity or water bill. The rest fills in as you go.',
  },
  reset: {
    headline: 'A new password,', accent: 'the same data.',
    sub: 'Forgot your password? Set a new one and your data stays exactly as you left it.',
    pillars: [
      { label: 'Other sessions are closed', text: 'With a new password, every other device on the account is signed out. Only the device where you changed it stays signed in.' },
      { label: 'Your data stays untouched', text: 'Properties, documents and transactions stay as you left them. Only the way you sign in changes.' },
    ],
  },
  skip: 'Skip to the form',
};

// ── Τα σφάλματα του παρόχου ταυτότητας, στα αγγλικά ─────────────────────────
// Ιδια αναγνώριση με το lib/core/dbError.ts (το μήνυμα του Supabase), ίδια
// αναφορά σφάλματος· αλλάζει μόνο η γλώσσα της εξήγησης.
const BY_TEXT_EN: [RegExp, string][] = [
  [/failed to fetch|networkerror|network request failed|load failed/i, 'You’re offline. Check your connection and try again.'],
  [/email rate limit|over_email_send_rate/i, 'Too many emails requested in a short time. Try again in a minute.'],
  [/rate limit|too many requests|over_request_rate/i, 'Too many attempts in a short time. Try again in a moment.'],
  [/invalid login credentials/i, 'Wrong email or password.'],
  [/user already registered|already been registered/i, 'An account with this email already exists.'],
  [/email not confirmed/i, 'You haven’t confirmed your email yet.'],
  [/token has expired|otp_expired|expired/i, 'The link has expired. Request a new one.'],
  [/at least|password.*(weak|short)|6 char/i, `The password is too weak. It needs at least ${PASSWORD_MIN_LENGTH} characters.`],
  [/jwt|not authenticated|session.*(missing|expired)/i, 'Your session has expired. Log in again.'],
  [/aborted|timeout|timed out/i, 'That took too long. Try again.'],
];

/** «Τι δεν έγινε. Γιατί.» στα αγγλικά, όπως το `failed` του dbError. */
export function authFailedEn(what: string, e?: unknown): string {
  if (e !== undefined && worthReporting(e)) captureError(e, { failed: what });
  const d = e && typeof e === 'object' ? (e as { message?: string | null; details?: string | null }) : { message: typeof e === 'string' ? e : null };
  const text = `${d.message ?? ''} ${d.details ?? ''}`;
  const reason = BY_TEXT_EN.find(([re]) => re.test(text))?.[1] ?? 'Try again.';
  return `${what.trim().replace(/[.:·]+$/, '')}. ${reason}`;
}
