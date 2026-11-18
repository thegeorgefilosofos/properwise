// ═══════════════════════════════════════════════════════════════════════════
// Η ΓΛΩΣΣΑ ΤΩΝ ΜΗΝΥΜΑΤΩΝ ΕΝΟΣ ΧΡΗΣΤΗ, ΣΤΗΝ ΠΛΕΥΡΑ DENO
// ─────────────────────────────────────────────────────────────────────────
// Ο κανόνας ζει ΜΙΑ φορά, στο lib/i18n/locale.ts (msgLocale): η επιλογή του
// Λογαριασμού (`msg_locale`), αλλιώς η γλώσσα της εφαρμογής (`app_locale`),
// αλλιώς ελληνικά. Εδώ μόνο διαβάζεται ο λογαριασμός με το κλειδί υπηρεσίας.
//
// ΑΠΟΤΥΧΙΑ ΑΝΑΓΝΩΣΗΣ ΔΕΝ ΣΤΑΜΑΤΑ ΤΟ ΜΗΝΥΜΑ. Μια υπενθύμιση στα ελληνικά είναι
// λιγότερο κακό από μια υπενθύμιση που δεν έφυγε: η αποτυχία δίνει 'el'.
// ═══════════════════════════════════════════════════════════════════════════
import { msgLocale } from '../../../lib/i18n/locale.ts'
import type { Lang } from './emailTemplates.ts'

/** Ο,τι χρειάζεται από τον πελάτη Supabase: μόνο η ανάγνωση χρήστη. */
interface AdminReader {
  auth: { admin: { getUserById(id: string): Promise<{ data: { user: { user_metadata?: Record<string, unknown> | null } | null } | null; error: unknown }> } }
}

/** Η γλώσσα από τα μεταδεδομένα ενός λογαριασμού που έχει ήδη διαβαστεί. */
export const msgLangOfMeta = (meta: Record<string, unknown> | null | undefined): Lang => msgLocale(meta)

/** Διαβάζει μία φορά ανά χρήστη και κρατά την απάντηση για την ίδια εκτέλεση. */
export function msgLangReader(db: AdminReader): (userId: string) => Promise<Lang> {
  const seen = new Map<string, Lang>()
  return async (userId: string) => {
    const hit = seen.get(userId)
    if (hit) return hit
    let lang: Lang = 'el'
    try {
      const { data, error } = await db.auth.admin.getUserById(userId)
      if (!error) lang = msgLocale(data?.user?.user_metadata)
    } catch { /* ελληνικά */ }
    seen.set(userId, lang)
    return lang
  }
}

/**
 * Η γλώσσα του λογαριασμού με αυτή τη διεύθυνση, για τους αποστολείς που
 * ξέρουν μόνο το email του παραλήπτη (send-lifecycle-email, από την ουρά).
 * Ρωτά τον διαχειριστή ταυτότητας με το κλειδί υπηρεσίας και κρατά ΜΟΝΟ την
 * ακριβή αντιστοιχία (το `filter` ψάχνει και μέρος της διεύθυνσης). Χωρίς
 * λογαριασμό ή με αποτυχία: `null` και ο καλών αποφασίζει.
 */
export async function msgLangByEmail(
  supabaseUrl: string, serviceKey: string, email: string, fetcher: typeof fetch = fetch,
): Promise<Lang | null> {
  const want = String(email || '').trim().toLowerCase()
  if (!want || !supabaseUrl || !serviceKey) return null
  try {
    const res = await fetcher(`${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(want)}&per_page=50`, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    })
    if (!res.ok) return null
    const body = await res.json() as { users?: { email?: string | null; user_metadata?: Record<string, unknown> | null }[] }
    const user = (body.users || []).find(u => String(u.email || '').trim().toLowerCase() === want)
    return user ? msgLocale(user.user_metadata) : null
  } catch { return null }
}
