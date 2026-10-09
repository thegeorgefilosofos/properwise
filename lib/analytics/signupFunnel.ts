// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΧΩΝΙ ΤΗΣ ΕΓΓΡΑΦΗΣ, ΑΝΩΝΥΜΑ
// ─────────────────────────────────────────────────────────────────────────
// Η εγγραφή δεν έχει ακόμη χρήστη, οπότε το `track` (lib/analytics/events.ts)
// δεν τη βλέπει. Εδώ μετράμε ΜΟΝΟ πόσες φορές έγινε κάθε βήμα, ανά ημέρα και
// κατηγορία: κανένα cookie, καμία αποθήκευση στη συσκευή, κανένα αναγνωριστικό.
// Η βάση κρατά αθροίσματα (public.signup_funnel), όχι επισκέψεις.
//
// Η ΠΗΓΗ ΕΙΝΑΙ Η ΠΡΩΤΗ ΕΠΑΦΗ ΑΥΤΗΣ ΤΗΣ ΦΟΡΤΩΣΗΣ. Οι σύνδεσμοί μας οδηγούν σε
// σελίδα εργαλείου και από εκεί στην εγγραφή με ήπια πλοήγηση: στο /signup η
// διεύθυνση δεν έχει πια `utm_source` και, αν ο referrer κόπηκε (εφαρμογή
// YouTube του iOS προς Safari, επικολλημένος σύνδεσμος), η επίσκεψη μετρούσε
// «direct». Η διεύθυνση άφιξης διαβάζεται από την καταγραφή πλοήγησης της ίδιας
// καρτέλας, το ίδιο είδος πληροφορίας με το location.search και το
// document.referrer που ήδη διαβάζονται. Τίποτα δεν αποθηκεύεται στη συσκευή,
// κανένα cookie, κανένα νέο πεδίο: φεύγει μόνο η λέξη του καταλόγου.
//
// ΟΙ ΚΑΤΑΛΟΓΟΙ ΕΙΝΑΙ ΚΛΕΙΣΤΟΙ ΚΑΙ ΕΙΝΑΙ ΟΙ ΙΔΙΟΙ ΜΕ ΤΗΣ ΒΑΣΗΣ. Η συνάρτηση
// count_signup_step απορρίπτει σιωπηλά ό,τι δεν ξέρει· ένα βήμα που
// προστίθεται μόνο εδώ δεν θα μετρηθεί ποτέ. Το τεστ διαβάζει το migration.
// ═══════════════════════════════════════════════════════════════════════════
import { inAppBrowser } from '@/lib/core/inAppBrowser';

export const SIGNUP_STEPS = {
  /** Άνοιξε η σελίδα εγγραφής. */
  view: 'view',
  /** Πάτησε «Συνέχισε με Google». */
  google: 'google',
  /** Είδε την οδηγία της εφαρμογής αντί για το κουμπί της Google. */
  app_note: 'app_note',
  /** Πάτησε «Άνοιγμα στον Chrome». */
  chrome: 'chrome',
  /** Πάτησε εγγραφή αλλά η φόρμα τον σταμάτησε (κωδικός, αποδοχή όρων). */
  invalid: 'invalid',
  /** Η φόρμα email πέρασε και έφυγε προς τη βάση. */
  submit: 'submit',
  /** Η βάση δέχτηκε την εγγραφή: στάλθηκε το email επιβεβαίωσης. */
  sent: 'sent',
  /** Η βάση απέρριψε την εγγραφή. */
  error: 'error',
} as const;
export type SignupStep = typeof SIGNUP_STEPS[keyof typeof SIGNUP_STEPS];

export const SIGNUP_SOURCES = [
  'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'x', 'google', 'search', 'internal', 'direct', 'other',
] as const;
export type SignupSource = typeof SIGNUP_SOURCES[number];

/** Από την εφαρμογή στην κατηγορία πηγής, για όσους ήρθαν μέσα από αυτήν. */
const APP_SOURCE: Record<string, SignupSource> = {
  Instagram: 'instagram', Threads: 'instagram', Facebook: 'facebook', Messenger: 'facebook',
  LinkedIn: 'linkedin', TikTok: 'tiktok', X: 'x',
};

/**
 * Η κατηγορία της πηγής. Κρατά ΜΟΝΟ τη λέξη του καταλόγου, ποτέ τη διεύθυνση
 * από την οποία ήρθε ο επισκέπτης. Σειρά: η εφαρμογή (το πιο αξιόπιστο), το
 * `utm_source` των συνδέσμων μας (της τρέχουσας διεύθυνσης, αλλιώς της
 * διεύθυνσης άφιξης `landingSearch`), μετά ο referrer.
 */
export function signupSource(ua: string, search: string, referrer: string, host: string, landingSearch = ''): SignupSource {
  const app = inAppBrowser(ua)?.app;
  if (app && APP_SOURCE[app]) return APP_SOURCE[app];
  const utm = (new URLSearchParams(search).get('utm_source')
    || new URLSearchParams(landingSearch).get('utm_source') || '').toLowerCase();
  const byName = (s: string): SignupSource | null =>
    /instagram|^ig$/.test(s) ? 'instagram'
    : /facebook|^fb$|messenger/.test(s) ? 'facebook'
    : /linkedin|lnkd/.test(s) ? 'linkedin'
    : /tiktok/.test(s) ? 'tiktok'
    : /youtube|youtu\.be|^yt$/.test(s) ? 'youtube'
    : /(^|\.)x\.com$|twitter|^t\.co$/.test(s) ? 'x'
    : /google/.test(s) ? 'google'
    : /bing|duckduckgo|yahoo|ecosia|brave|yandex/.test(s) ? 'search'
    : null;
  if (utm) return byName(utm) ?? 'other';
  if (!referrer) return 'direct';
  let ref = '';
  try { ref = new URL(referrer).hostname.replace(/^www\./, ''); } catch { return 'other'; }
  if (ref === host.replace(/^www\./, '')) return 'internal';
  return byName(ref) ?? 'other';
}

/**
 * Το query της διεύθυνσης με την οποία άνοιξε η καρτέλα, από την καταγραφή
 * πλοήγησης του ίδιου του περιηγητή. Επιβιώνει την ήπια πλοήγηση ως το
 * /signup. Κενό αν λείπει ή αν κάτι αποτύχει: τότε μένει η σημερινή συμπεριφορά.
 * Ο καλών κρατά μόνο το `utm_source`, ποτέ ολόκληρο το query.
 */
export function landingQuery(
  perf: Pick<Performance, 'getEntriesByType'> | undefined = globalThis.performance,
): string {
  try {
    const name = (perf?.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined)?.name;
    return name ? new URL(name).search : '';
  } catch { return ''; }
}

/** Κινητό ή ταμπλέτα, από το User-Agent. */
export const isMobileUa = (ua: string) => /Mobi|Android|iPhone|iPad/i.test(ua);

type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<unknown> };
let client: Promise<Rpc> | null = null;
const counted = new Set<SignupStep>();

/**
 * Μετρά ένα βήμα. ΠΟΤΕ δεν πετάει και ΠΟΤΕ δεν καθυστερεί την εγγραφή. Κάθε
 * βήμα μετριέται μία φορά ανά φόρτωση σελίδας, εκτός από όσα επαναλαμβάνονται
 * από τη φύση τους (invalid, error): εκεί θέλουμε να δούμε πόσες φορές.
 */
export function countSignupStep(step: SignupStep): void {
  if (typeof window === 'undefined') return;
  if (step !== 'invalid' && step !== 'error') {
    if (counted.has(step)) return;
    counted.add(step);
  }
  const ua = navigator.userAgent;
  const args = {
    p_step: step,
    p_source: signupSource(ua, window.location.search, document.referrer, window.location.hostname, landingQuery()),
    p_in_app: inAppBrowser(ua) !== null,
    p_mobile: isMobileUa(ua),
  };
  try {
    client ??= import('@/lib/supabase/lazy').then(m => m.authClient() as unknown as Promise<Rpc>);
    client.then(c => c.rpc('count_signup_step', args)).then(undefined, () => {});
  } catch { /* η μέτρηση δεν σπάει ποτέ την εγγραφή */ }
}
