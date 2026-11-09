// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΠΟΣΥΝΔΕΣΗ, ΜΙΑ ΦΟΡΑ ΓΙΑ ΠΙΝΑΚΑ ΚΑΙ ΠΥΛΗ ΛΟΓΙΣΤΗ
// ─────────────────────────────────────────────────────────────────────────
// Ζούσε μόνο στον πίνακα του ιδιοκτήτη (useDashboard). Η πύλη του λογιστή δεν
// είχε καμία έξοδο: ο λογιστής που ήθελε να μπει ως ιδιοκτήτης έπρεπε να
// σβήσει τα cookies. Και μια δεύτερη, απλούστερη γραφή θα ξεχνούσε τα δύο
// βήματα που δεν φαίνονται: τη συνδρομή ειδοποιήσεων της συσκευής και τα
// προσωπικά δεδομένα της στον περιηγητή.
//
// ΣΕΙΡΑ: πρώτα οι ειδοποιήσεις (το σβήσιμο της γραμμής θέλει τη συνεδρία που
// θα λήξει, μετά η RLS δεν το επιτρέπει), μετά η συνεδρία, μετά ο περιηγητής.
// Αν η αποσύνδεση αποτύχει, τίποτα δεν έχει σβηστεί από τη συσκευή.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import { unsubscribeDevice, setDeviceNotify } from '@/lib/push/client';
import * as pushDevices from '@/lib/data/pushSubscriptions';
import { leaveDevice } from '@/lib/localPrivacy';

/** `true` όταν η συνεδρία έληξε και η συσκευή καθάρισε· `false` αν η αποσύνδεση δεν έγινε. */
export async function endSession(db: SupabaseClient): Promise<boolean> {
  try {
    const gone = await unsubscribeDevice();
    if (gone) await pushDevices.remove(db, gone);
    setDeviceNotify(false);
  } catch { /* η αποσύνδεση δεν σταματά για μια συνδρομή */ }
  const { error } = await db.auth.signOut();
  if (error) return false;
  leaveDevice();
  return true;
}

/** Το μήνυμα όταν η αποσύνδεση δεν έγινε, ίδιο σε κάθε σημείο. */
export const SIGN_OUT_FAILED = 'Δεν έγινε η αποσύνδεση. Δες τη σύνδεσή σου στο δίκτυο και δοκίμασε ξανά. Τα δεδομένα σου στη συσκευή δεν πειράχτηκαν.';
