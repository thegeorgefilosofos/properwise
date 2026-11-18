// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΣΦΑΛΜΑΤΑ ΤΗΣ ΕΦΑΡΜΟΓΗΣ ΣΤΑ ΑΓΓΛΙΚΑ (δίδυμο του lib/core/dbError.ts)
// ─────────────────────────────────────────────────────────────────────────
// Ιδια αναγνώριση με το `failed` (κωδικός Postgres πρώτα, μετά το κείμενο),
// ίδια αναφορά σφάλματος· αλλάζει μόνο η γλώσσα της εξήγησης. Ο έλεγχος
// app/dashboard/appLocale.test.ts κοκκινίζει όταν ένας κωδικός ή ένα πλήρες
// μήνυμα υπάρχει μόνο στα ελληνικά. Φτάνει με το λεξικό της οθόνης (appEn).
// ═══════════════════════════════════════════════════════════════════════════
import { captureError, worthReporting } from '@/lib/observability/report';
import { isPlanRequired } from '@/lib/core/dbError';
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password';

export const BY_CODE_EN: Record<string, string> = {
  '23505': 'An entry with these details already exists.',
  '23503': 'This record is linked to something that no longer exists. Refresh the page.',
  '23502': 'A required detail is missing.',
  '23514': 'A value is outside the allowed range.',
  '22P02': 'A value isn’t in the right format.',
  '22003': 'The number is too large for this field.',
  '42501': 'You don’t have permission for this record.',
  '42P01': 'This action isn’t available right now.',
  '42703': 'The app asked for a field that doesn’t exist in the database. An update is needed.',
  '57014': 'That took too long and was stopped. Try again.',
  '53300': 'The server is handling many requests. Try again in a moment.',
  'PGRST301': 'Your session has expired. Log in again.',
  'PGRST116': 'The record wasn’t found. It may have been deleted elsewhere.',
};

const BY_TEXT_EN: [RegExp, string][] = [
  [/failed to fetch|networkerror|network request failed|load failed/i, 'You’re offline. Check your connection and try again.'],
  [/email rate limit|over_email_send_rate/i, 'Too many emails requested in a short time. Try again in a minute.'],
  [/rate limit|too many requests|over_request_rate/i, 'Too many attempts in a short time. Try again in a moment.'],
  [/invalid login credentials/i, 'Wrong email or password.'],
  [/user already registered|already been registered/i, 'An account with this email already exists.'],
  [/email not confirmed/i, 'You haven’t confirmed your email yet.'],
  [/token has expired|otp_expired|expired/i, 'The link has expired. Request a new one.'],
  [/at least|password.*(weak|short)|6 char/i, `The password is too weak. It needs at least ${PASSWORD_MIN_LENGTH} characters.`],
  [/row-level security|violates row.level/i, 'You don’t have permission for this record.'],
  [/jwt|not authenticated|session.*(missing|expired)/i, 'Your session has expired. Log in again.'],
  [/aborted|timeout|timed out/i, 'That took too long. Try again.'],
];

export const PLAN_REQUIRED_EN = 'This action opens on a higher plan.';
export const RETRY_EN = 'Try again.';

/** Ο λόγος στα αγγλικά, ή `null` όταν δεν αναγνωρίζεται. */
export function dbReasonEn(e: unknown): string | null {
  if (isPlanRequired(e)) return PLAN_REQUIRED_EN;
  const d = e && typeof e === 'object' ? (e as { code?: string | null; message?: string | null; details?: string | null }) : { message: typeof e === 'string' ? e : null };
  const code = (d.code ?? '').toString().trim();
  if (code && BY_CODE_EN[code]) return BY_CODE_EN[code];
  const text = `${d.message ?? ''} ${d.details ?? ''}`;
  if (!text.trim()) return null;
  for (const [re, en] of BY_TEXT_EN) if (re.test(text)) return en;
  return null;
}

/** «Τι δεν έγινε. Γιατί.» στα αγγλικά: `failedEn('The language didn’t change', error)`. */
export function failedEn(what: string, e?: unknown): string {
  if (e !== undefined && worthReporting(e)) captureError(e, { failed: what });
  return `${what.trim().replace(/[.:·]+$/, '')}. ${dbReasonEn(e) ?? RETRY_EN}`;
}

/** Τα πλήρη μηνύματα του `SAY`, ένα προς ένα. */
export const SAY_EN = {
  tooManyTries: 'Too many attempts. Try again in a moment.',
  accountNotDeleted: 'The account wasn’t deleted. Try again in a moment.',
  changeFailed: 'The change couldn’t be made. Try again.',
  archiveFailed: 'Archiving failed. The PDF has already downloaded.',
  archiveAsk: 'Save it to the property’s documents?',
  nameRequired: 'Full name is required.',
  aiQuotaSpent: 'Your plan’s questions are used up; they renew automatically.',
  scanQuotaSpent: 'You’ve used this month’s scans. They renew on the 1st of next month.',
} as const;

/** Το λεξικό της οθόνης (lib/i18n/appEn.tsx, κλειδί `errors`). */
export const ERRORS_EN = { failed: failedEn, reason: dbReasonEn, say: SAY_EN, planRequired: PLAN_REQUIRED_EN, retry: RETRY_EN };
