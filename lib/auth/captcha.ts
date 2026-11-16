// ═══════════════════════════════════════════════════════════════════════════
// ΕΛΕΓΧΟΣ ΚΑΤΑ ΤΩΝ BOTS ΣΤΙΣ ΦΟΡΜΕΣ ΤΟΥ ΛΟΓΑΡΙΑΣΜΟΥ (Cloudflare Turnstile)
// ─────────────────────────────────────────────────────────────────────────
// Έλεγχος ετοιμότητας για κλίμακα, 10/11/2026: εγγραφή, σύνδεση και επαναφορά
// κωδικού καλούσαν τη Supabase Auth απευθείας από τον περιηγητή, χωρίς κανένα
// φράγμα για σενάρια. Κάθε ψεύτικη εγγραφή τρώει ένα email από το ημερήσιο
// όριο του παρόχου και πέντε σαρώσεις AI· με αρκετές, οι πραγματικοί χρήστες
// μένουν χωρίς email επιβεβαίωσης.
//
// ΕΝΕΡΓΟ ΜΟΝΟ ΜΕ ΚΛΕΙΔΙ. Χωρίς `NEXT_PUBLIC_TURNSTILE_SITE_KEY` τίποτα δεν
// φορτώνεται και οι φόρμες στέλνουν ακριβώς ό,τι έστελναν. Ο έλεγχος γίνεται
// στη Supabase («Bot and Abuse Protection»), που απορρίπτει αίτημα χωρίς
// έγκυρο `captchaToken` μόλις ενεργοποιηθεί εκεί. Τα δύο ανοίγουν μαζί:
// οδηγίες στο docs/ops/turnstile.md.
//
// Καθαρό αρχείο, χωρίς React: το διαβάζουν η φόρμα και οι δοκιμές.
// ═══════════════════════════════════════════════════════════════════════════
import type { Locale } from '@/lib/i18n/locale'

/** Το δημόσιο κλειδί ιστοτόπου του Turnstile. Κενό σημαίνει «ανενεργό». */
export const TURNSTILE_SITE_KEY: string = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim()

/** Είναι ενεργός ο έλεγχος σε αυτή την έκδοση; */
export const captchaEnabled = (key: string = TURNSTILE_SITE_KEY): boolean => key.length > 0

/** Το σενάριο του Turnstile, με ρητή απόδοση (όχι αυτόματη σάρωση της σελίδας). */
export const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

/**
 * Πόσο περιμένουμε το διακριτικό τη στιγμή της υποβολής. Συνήθως είναι ήδη
 * έτοιμο: ο έλεγχος τρέχει όσο ο επισκέπτης γράφει.
 */
export const CAPTCHA_WAIT_MS = 10_000

/** Το μήνυμα όταν ο έλεγχος δεν ολοκληρώθηκε. Λέει τι να κάνει, χωρίς «bot». */
export function captchaFailedMessage(locale: Locale): string {
  return locale === 'en'
    ? "The security check didn't complete. Wait a moment and try again."
    : 'Ο έλεγχος ασφαλείας δεν ολοκληρώθηκε. Περίμενε λίγο και δοκίμασε ξανά.'
}

/**
 * Το μήνυμα όταν το σενάριο της Cloudflare δεν φόρτωσε καθόλου. Δύο αιτίες:
 * σύνδεση που έπεσε ή επέκταση αποκλεισμού διαφημίσεων ή ιχνηλατών. Το μήνυμα
 * λέει και τις δύο και ποια διεύθυνση να επιτρέψει.
 */
export function captchaBlockedMessage(locale: Locale): string {
  return locale === 'en'
    ? "The security check didn't load. Check your connection or, if you use a blocking extension, allow challenges.cloudflare.com."
    : 'Ο έλεγχος ασφαλείας δεν φόρτωσε. Έλεγξε τη σύνδεσή σου ή, αν έχεις επέκταση αποκλεισμού, επίτρεψε το challenges.cloudflare.com.'
}

/**
 * Οι επιλογές της κλήσης Auth: με διακριτικό μόνο όταν υπάρχει. Χωρίς κλειδί
 * επιστρέφει κενό αντικείμενο, ώστε η κλήση να μένει ίδια με πριν.
 */
export function captchaOptions(token: string | undefined): { captchaToken?: string } {
  return token ? { captchaToken: token } : {}
}

/**
 * Περιμένει το διακριτικό ως `ms` χιλιοστά. `undefined` όταν ο έλεγχος είναι
 * ανενεργός, `null` όταν δεν ήρθε εγκαίρως ή όταν `dead()` λέει ότι δεν θα έρθει.
 */
export async function waitForToken(
  read: () => string | null,
  enabled: boolean,
  ms: number = CAPTCHA_WAIT_MS,
  step = 100,
  /** Ο έλεγχος δεν μπορεί να ολοκληρωθεί (π.χ. το σενάριο δεν φόρτωσε): σταματά αμέσως. */
  dead: () => boolean = () => false,
): Promise<string | null | undefined> {
  if (!enabled) return undefined
  const until = Date.now() + ms
  for (;;) {
    const t = read()
    if (t) return t
    if (dead() || Date.now() >= until) return null
    await new Promise(r => setTimeout(r, step))
  }
}
