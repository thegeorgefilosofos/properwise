// ═══════════════════════════════════════════════════════════════════════════
// «ΚΑΤΑΧΩΡΗΣΗ ΟΛΩΝ» ΣΤΑ ΕΙΣΕΡΧΟΜΕΝΑ (αξιολόγηση σχεδίασης 3, 23/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Πέντε λογαριασμοί ήθελαν δέκα πατήματα. Όπως στην ουρά παραστατικών του Ramp,
// ό,τι είναι πλήρες καταχωρείται με ένα πάτημα και αναιρείται με ένα ακόμη. Ο
// λογαριασμός χωρίς ποσό, χωρίς ημερομηνία ή χωρίς πάροχο μένει μόνος του: εκεί
// η φόρμα ζητά χέρι και καμία μαζική κίνηση δεν μαντεύει για λογαριασμό του.
// ═══════════════════════════════════════════════════════════════════════════

import { MONTHS_NOM, MONTHS_GEN, MONTHS_SHORT } from '@/lib/core/months';

/** Το ποσό όπως το γράφει ο άνθρωπος: «97,50» ή «97.50». */
export const draftAmount = (s: string | undefined): number => parseFloat((s || '').replace(',', '.'));

/** Όσοι έχουν πάροχο, θετικό ποσό και ημερομηνία, με τη σειρά της ουράς. */
export function bulkReady<R extends { id: string; vendor: string | null }>(
  rows: readonly R[], drafts: Readonly<Record<string, { amount: string; date: string } | undefined>>,
): R[] {
  return rows.filter(r => {
    const d = drafts[r.id];
    if (!d || !r.vendor || !d.date) return false;
    const n = draftAmount(d.amount);
    return Number.isFinite(n) && n > 0;
  });
}

/** Χωρίς τόνους και διαλυτικά, σε πεζά: «ΦΕΒΡΟΥΑΡΙΟΥ» και «Φεβρουαρίου» είναι το ίδιο. */
const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const NAMES = MONTHS_NOM.map((n, i) => [fold(n), fold(MONTHS_GEN[i])] as const);

/**
 * Ο ΜΗΝΑΣ ΤΟΥ ΛΟΓΑΡΙΑΣΜΟΥ ΣΤΗ ΓΡΑΜΜΗ, ΟΧΙ Η ΗΜΕΡΑ ΛΗΞΗΣ (αξιολόγηση σχεδίασης 3).
 * Πέντε γραμμές «ΔΕΗ 10/09» διέφεραν μόνο στο ποσό, ενώ το θέμα έλεγε «Λογαριασμός
 * ρεύματος Ιανουαρίου 2026». Μήνας μόνο με χρονιά δίπλα του: χωρίς χρονιά δεν
 * μαντεύουμε ποιον Ιανουάριο εννοεί.
 */
export function billMonth(subject: string | null | undefined): string | null {
  if (!subject) return null;
  const words = fold(subject).split(/[^a-zα-ω0-9]+/u);
  for (let k = 0; k + 1 < words.length; k++) {
    const i = NAMES.findIndex(([nom, gen]) => words[k] === nom || words[k] === gen);
    if (i >= 0 && /^20\d\d$/.test(words[k + 1])) return `${MONTHS_SHORT[i]} ${words[k + 1]}`;
  }
  return null;
}

/** Το κουμπί, ή `null` όταν δεν υπάρχουν τουλάχιστον δύο: με έναν δεν υπάρχει «όλων». */
export const bulkLabel = (n: number): string | null => (n >= 2 ? `Καταχώρηση όλων (${n})` : null);
