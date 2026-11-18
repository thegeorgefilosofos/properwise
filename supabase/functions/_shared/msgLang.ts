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
