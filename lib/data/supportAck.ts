// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΔΥΟ ΚΛΗΣΕΙΣ ΤΗΣ ΑΥΤΟΜΑΤΗΣ ΕΠΙΒΕΒΑΙΩΣΗΣ, ΜΕΣΩ ΣΥΝΑΡΤΗΣΕΩΝ ΤΗΣ ΒΑΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Καμία από τις δύο δεν αγγίζει πίνακα με το χέρι. Το `name_for_email` διαβάζει
// `auth.users`, που κανένας πελάτης δεν βλέπει· το `try_support_ack` γράφει
// στον κατάλογο της υποστήριξης, που κανένας πελάτης δεν αγγίζει. Και οι δύο
// είναι SECURITY DEFINER με δικαίωμα μόνο στον ρόλο υπηρεσίας — γι' αυτό τις
// καλεί η διαδρομή του webhook με τον πελάτη υπηρεσίας, όχι με τον περιηγητή.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbError } from '@/lib/supabase/writeResult';

export type Db = SupabaseClient;

/**
 * Το όνομα λογαριασμού για μια διεύθυνση, ή κενό όταν άγνωστο.
 *
 * ΤΟ ΚΕΝΟ ΔΕΝ ΕΙΝΑΙ ΣΦΑΛΜΑ. Η συνάρτηση γυρίζει κενό και για «δεν υπάρχει
 * χρήστης» και για «υπάρχει αλλά χωρίς όνομα»· την προσφώνηση της άγνοιας την
 * αποφασίζει η εφαρμογή, όχι η βάση.
 */
export async function nameForEmail(db: Db, email: string): Promise<{ name: string; error: DbError | null }> {
  const { data, error } = await db.rpc('name_for_email', { p_email: email });
  return { name: typeof data === 'string' ? data : '', error: (error as DbError) ?? null };
}

/**
 * Πρέπει να σταλεί επιβεβαίωση σε αυτή τη διεύθυνση τώρα;
 *
 * Ατομικό dedup/cooldown στη βάση: `send` είναι `true` μόνο στην πρώτη επαφή ή
 * αφού περάσει η περίοδος ησυχίας, `false` μέσα σε αυτήν. Η προεπιλογή των έξι
 * ωρών είναι το φρένο του βρόχου: ακόμη κι αν όλα τα άλλα αστοχήσουν, ένας
 * αποστολέας παίρνει το πολύ μία απάντηση ανά εξάωρο.
 */
export async function trySupportAck(
  db: Db, email: string, cooldown = '6 hours',
): Promise<{ send: boolean; error: DbError | null }> {
  const { data, error } = await db.rpc('try_support_ack', { p_email: email, p_cooldown: cooldown });
  return { send: data === true, error: (error as DbError) ?? null };
}
