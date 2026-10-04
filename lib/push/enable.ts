// ═══════════════════════════════════════════════════════════════════════════
// ΕΝΑ ΠΑΤΗΜΑ: ΑΔΕΙΑ, ΕΓΓΡΑΦΗ ΣΤΗΝ ΥΠΗΡΕΣΙΑ PUSH ΚΑΙ ΑΠΟΘΗΚΕΥΣΗ ΤΗΣ ΣΥΣΚΕΥΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Το ίδιο βήμα το κάνουν δύο σημεία: ο διακόπτης των Ρυθμίσεων και το πλωτό
// μήνυμα που ανοίγει μόλις το PROPERWISE τρέξει πρώτη φορά από την αρχική οθόνη
// του iPhone (app/PwaProvider.tsx). Γραμμένο δύο φορές, το ένα θα ξεχνούσε
// κάποτε να αποθηκεύσει τη συσκευή και οι ειδοποιήσεις δεν θα έφταναν ποτέ.
//
// Η ΑΔΕΙΑ ΖΗΤΙΕΤΑΙ ΜΟΝΟ ΜΕΣΑ ΣΕ ΠΑΤΗΜΑ. Το Safari αρνείται το
// `requestPermission()` που δεν ξεκινά από χειρονομία του χρήστη· γι' αυτό η
// συνάρτηση καλείται μόνο από κουμπί και ποτέ στη φόρτωση.
// ═══════════════════════════════════════════════════════════════════════════
import type { createClient } from '@/lib/supabase/client';
import * as devices from '@/lib/data/pushSubscriptions';
import { readSubscription, type RawSubscription } from './subscription';
import { subscribeDevice, setDeviceNotify } from './client';

type Db = ReturnType<typeof createClient>;

export type EnableReason = 'unsupported' | 'unconfigured' | 'denied' | 'failed' | 'stored' | 'signedOut';
export type EnableOutcome = { ok: true } | { ok: false; reason: EnableReason };

/** Ό,τι λέμε στον χρήστη για κάθε λόγο αποτυχίας. Μία πηγή για κάθε οθόνη. */
export const ENABLE_REASONS: Record<EnableReason, string> = {
  denied: 'Ο περιηγητής δεν έδωσε άδεια. Δίνεται από τις ρυθμίσεις του για αυτή τη σελίδα.',
  failed: 'Η εγγραφή δεν ολοκληρώθηκε. Σε iPhone χρειάζεται πρώτα προσθήκη στην αρχική οθόνη.',
  unsupported: 'Αυτός ο περιηγητής δεν στέλνει ειδοποιήσεις με την εφαρμογή κλειστή.',
  unconfigured: 'Οι ειδοποιήσεις συσκευής δεν είναι ρυθμισμένες σε αυτή την εγκατάσταση.',
  stored: 'Η συνδρομή δεν αποθηκεύτηκε. Δοκίμασε ξανά σε λίγο.',
  signedOut: 'Συνδέσου ξανά και άνοιξε τις ειδοποιήσεις από τις Ρυθμίσεις.',
};

/**
 * Άδεια, εγγραφή, αποθήκευση. `userId` όταν η οθόνη τον ξέρει ήδη· αλλιώς
 * διαβάζεται από τη συνεδρία.
 */
export async function enableDevicePush(db: Db, userId?: string): Promise<EnableOutcome> {
  const outcome = await subscribeDevice();
  if (!outcome.ok) return outcome;
  const checked = readSubscription(outcome.subscription.toJSON() as RawSubscription);
  if (!checked) return { ok: false, reason: 'failed' };
  let uid = userId;
  if (!uid) {
    // Αποτυχία ανάγνωσης της συνεδρίας ≠ αποσυνδεδεμένος: λέγεται χωριστά.
    const { data, error } = await db.auth.getUser();
    if (error && !data.user) return { ok: false, reason: 'signedOut' };
    uid = data.user?.id;
  }
  if (!uid) return { ok: false, reason: 'signedOut' };
  const { error } = await devices.save(db, uid, checked, navigator.userAgent);
  if (error) return { ok: false, reason: 'stored' };
  setDeviceNotify(true);
  return { ok: true };
}
