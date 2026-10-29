// ═══════════════════════════════════════════════════════════════════════════
// ΝΕΟ ΔΙΑΚΡΙΤΙΚΟ «ΠΛΗΡΩΣΑ» ΓΙΑ ΜΙΑ ΠΡΟΘΕΣΜΙΑ (διακομιστής, service role)
// ─────────────────────────────────────────────────────────────────────────
// Γράφει μόνο το αποτύπωμα και επιστρέφει το διακριτικό στον καλούντα, που το
// βάζει στον σύνδεσμο του email ή στην ειδοποίηση. Αποτυχία εγγραφής δίνει
// `null`: η υπενθύμιση φεύγει κανονικά, απλώς χωρίς το κουμπί. Το ίδιο και όσο
// ο πίνακας δεν υπάρχει ακόμη (isMissingTable): χωρίς θόρυβο στα αρχεία.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import { newPayToken, payTokenExpiry, isMissingTable } from './payLink';

export async function mintPayToken(
  db: SupabaseClient, userId: string, eventId: string, channel: 'email' | 'push', now: Date,
): Promise<string | null> {
  const { token, hash } = await newPayToken();
  const { error } = await db.from('reminder_pay_tokens').insert({
    user_id: userId, event_id: eventId, token_hash: hash, channel, expires_at: payTokenExpiry(now),
  });
  if (error && !isMissingTable(error)) console.error('[plirosa] διακριτικό δεν γράφτηκε:', error.code ?? error.message);
  return error ? null : token;
}
