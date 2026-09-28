// ═══════════════════════════════════════════════════════════════════════════
// Ο ΧΑΡΤΗΣ «ΑΝΑΓΝΩΡΙΣΤΙΚΟ ΕΜΠΟΡΟΥ → ΠΑΚΕΤΟ ΚΑΙ ΚΥΚΛΟΣ»
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΖΕΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΗΝ ΥΛΟΠΟΙΗΣΗ ΕΝΟΣ ΕΜΠΟΡΟΥ. Η μορφή
// «αναγνωριστικό:πακέτο:κύκλος» είναι δική ΜΑΣ σύμβαση· από έμπορο σε έμπορο
// αλλάζει μόνο το όνομα της μεταβλητής που την κρατά. Εγραφόταν στο αρχείο του
// πρώτου παρόχου και ο δεύτερος την εισήγαγε από εκεί: όταν ο πρώτος έφυγε,
// ο αναλυτής θα έφευγε μαζί του. Εδώ δεν ανήκει σε κανέναν.
//
// ΚΑΜΙΑ ΠΑΡΑΛΛΑΓΗ ΔΕΝ ΜΑΝΤΕΥΕΤΑΙ. Ποιο πακέτο δίνει ποιο αναγνωριστικό
// ορίζεται σε μεταβλητή περιβάλλοντος, γιατί τα αναγνωριστικά γεννιούνται στο
// κατάστημα και δεν υπάρχουν μέσα στον κώδικα. Αναγνωριστικό εκτός χάρτη δεν
// αναβαθμίζει κανέναν.
//
// ΓΙΑΤΙ ΚΕΙΜΕΝΟ ΚΑΙ ΟΧΙ JSON. Η τιμή γράφεται στο πεδίο μεταβλητής του Vercel,
// με το χέρι, μία φορά. Το JSON εκεί σημαίνει εισαγωγικά μέσα σε εισαγωγικά και
// ένα ξεχασμένο κόμμα που ρίχνει ΟΛΟΝ τον χάρτη. Η μορφή είναι:
//
//     CREEM_PRODUCTS="prod_a:solo:monthly,prod_b:solo:annual,prod_c:owner:monthly"
//
// Κάθε λάθος καταγγέλλεται ονομαστικά, με τη γραμμή που το προκάλεσε.
// ═══════════════════════════════════════════════════════════════════════════
import { PLANS, normalizePlan, BILLING_CYCLES, type BillingCycle } from './plans';
import type { VariantPlan } from './subscription';

export interface VariantMapResult {
  map: Map<string, VariantPlan>;
  /** Κενό όταν όλα διαβάστηκαν. Αλλιώς τι ακριβώς δεν διαβάστηκε. */
  error: string;
}

/**
 * Διαβάζει τον χάρτη από την τιμή μιας μεταβλητής.
 *
 * @param envName Το όνομα της μεταβλητής, για τα μηνύματα σφάλματος. Είναι
 *   υποχρεωτικό: ένα προεπιλεγμένο όνομα θα έστελνε όποιον διαβάζει το σφάλμα
 *   να ψάξει μεταβλητή που ο έμπορός του δεν έχει.
 */
export function parseVariantMap(raw: string | undefined | null, envName: string): VariantMapResult {
  const map = new Map<string, VariantPlan>();
  const text = (raw || '').trim();
  if (!text) return { map, error: `Ο χάρτης παραλλαγών είναι κενός. Όρισε τη μεταβλητή ${envName}.` };

  const bad: string[] = [];
  for (const entry of text.split(',').map(e => e.trim()).filter(Boolean)) {
    const [variantId, planRaw, cycleRaw] = entry.split(':').map(p => (p || '').trim());
    if (!variantId || !planRaw || !cycleRaw) { bad.push(`«${entry}»: περιμένει μορφή variant:πακέτο:κύκλος`); continue; }
    // ΟΧΙ normalizePlan ΕΔΩ: εκείνο επιστρέφει «free» για ό,τι δεν αναγνωρίζει,
    // δηλαδή θα δεχόταν τυπογραφικό και θα χάριζε πακέτο χωρίς να πει λέξη.
    if (!(planRaw in PLANS)) { bad.push(`«${entry}»: άγνωστο πακέτο «${planRaw}»`); continue; }
    if (!BILLING_CYCLES.includes(cycleRaw as BillingCycle)) { bad.push(`«${entry}»: άγνωστος κύκλος «${cycleRaw}»`); continue; }
    if (map.has(variantId)) { bad.push(`«${entry}»: η παραλλαγή ${variantId} ορίζεται δύο φορές`); continue; }
    map.set(variantId, { plan: normalizePlan(planRaw), cycle: cycleRaw as BillingCycle });
  }

  return { map, error: bad.length ? `Ο χάρτης παραλλαγών έχει σφάλματα: ${bad.join(' · ')}` : '' };
}

/** Ποιο πακέτο δίνει ένα αναγνωριστικό. `null` όταν δεν είναι στον χάρτη. */
export function planOfVariant(map: Map<string, VariantPlan>, variantId: string): VariantPlan | null {
  return map.get(variantId) ?? null;
}
