// ═══════════════════════════════════════════════════════════════════════════
// ΠΟΙΟΣ ΕΜΠΟΡΟΣ, ΚΑΙ ΠΟΙΟΣ ΤΟ ΑΠΟΦΑΣΙΖΕΙ
// ─────────────────────────────────────────────────────────────────────────
// Η ΑΠΟΦΑΣΗ ΔΕΝ ΠΑΙΡΝΕΤΑΙ ΕΔΩ. Παίρνεται στο lib/legal/merchant.ts, μαζί με
// το εμπορικό όνομα, γιατί τη χρειάζονται και τα νομικά κείμενα: αν η επιλογή
// ζούσε εδώ, η Πολιτική απορρήτου θα φόρτωνε ΚΑΘΕ υλοποίηση εμπόρου για να
// μάθει μία λέξη. Εδώ γίνεται μόνο η αντιστοίχιση αναγνωριστικού σε θύρα.
// ═══════════════════════════════════════════════════════════════════════════
import { merchantId, type MerchantId } from '@/lib/legal/merchant';
import { lemonPort } from './lemon';
import { creemPort } from './creem';
import type { MerchantPort, BillingEnv } from './port';

export * from './port';

/** Ο κατάλογος. Ενας νέος πάροχος μπαίνει εδώ και στο lib/legal/merchant.ts. */
const PORTS: Record<MerchantId, MerchantPort> = {
  lemon: lemonPort,
  creem: creemPort,
};

/**
 * Ο έμπορος αυτής της εγκατάστασης.
 *
 * @param env το περιβάλλον, ρητά, ώστε οι σουίτες να μην πειράζουν τη διεργασία
 */
export function merchant(env: BillingEnv = process.env): MerchantPort {
  return PORTS[merchantId(env)];
}
