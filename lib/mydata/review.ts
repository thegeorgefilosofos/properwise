// ═══════════════════════════════════════════════════════════════════════════
// myDATA Α2: ΤΙ ΛΕΕΙ Η ΚΑΡΤΑ «ΓΙΑ ΕΛΕΓΧΟ», ΓΡΑΜΜΕΝΟ ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// Ο κινητήρας κρίνει (supabase/functions/_shared/mydataClassify.ts) και δίνει
// κωδικούς· εδώ γίνονται ΜΙΑ πρόταση ανά παραστατικό, με τη σειρά σημασίας,
// και η κατηγορία που έρχεται προσυμπληρωμένη. Στόχος (ιδιοκτήτης 23/11/2026):
// 0 πατήματα στο αυτόματο, 1 πάτημα («Σωστό») στο «Για έλεγχο».
// ═══════════════════════════════════════════════════════════════════════════
import { fe } from '@/lib/core/format';
import { BY_SLUG, resolveCategory } from '@/lib/expenses/taxonomy';
import { BANK_PAYMENT_LIMIT_CENTS, BANK_PAYMENT_LIMIT_SOURCE, UNUSUAL_FACTOR } from './limits';
import { KIND_CATEGORY, providerByAfm, providerName } from './providers';

/** Η σειρά σημασίας: ο πρώτος λόγος που υπάρχει γίνεται η πρόταση της κάρτας. */
const ORDER = ['over_limit', 'credit', 'amounts', 'pick_property', 'unusual_amount', 'doc_type', 'unknown_provider', 'new_provider'] as const;

const times = UNUSUAL_FACTOR === 2 ? 'το διπλάσιο' : `${UNUSUAL_FACTOR} φορές`;

const LINE: Record<typeof ORDER[number], string> = {
  over_limit: `Πάνω από ${fe(BANK_PAYMENT_LIMIT_CENTS / 100)} εκπίπτει μόνο αν πληρώθηκε με τράπεζα ή κάρτα (${BANK_PAYMENT_LIMIT_SOURCE.short}).`,
  credit: 'Πιστωτικό: το ποσό αφαιρείται από τις δαπάνες.',
  amounts: 'Τα σύνολα της ΑΑΔΕ δεν κλείνουν μεταξύ τους. Έλεγξε το ποσό στο παραστατικό.',
  pick_property: 'Έχεις πάνω από ένα ακίνητο: διάλεξε σε ποιο ανήκει.',
  unusual_amount: `Πάνω από ${times} του συνηθισμένου για αυτόν τον πάροχο.`,
  doc_type: 'Ασυνήθιστος τύπος παραστατικού για λογαριασμό. Έλεγξέ το μία φορά.',
  unknown_provider: 'Δεν είναι στους γνωστούς παρόχους ακινήτου. Καταχώρησέ το μόνο αν αφορά το ακίνητο.',
  new_provider: 'Πρώτη φορά από αυτόν τον πάροχο. Με το «Σωστό» οι επόμενοι λογαριασμοί του μπαίνουν μόνοι τους.',
};

/**
 * Η μία πρόταση της κάρτας, ή null όταν δεν υπάρχει λόγος. Με πάνω από ένα
 * ακίνητο τίποτα δεν μπαίνει μόνο του (η βάση δεν ξέρει σε ποιο σπίτι), οπότε
 * ο νέος πάροχος δεν υπόσχεται αυτόματο.
 */
export function reviewLine(reasons: readonly string[] | null | undefined, opts: { manyProperties?: boolean } = {}): string | null {
  const has = new Set(reasons ?? []);
  const first = ORDER.find(r => has.has(r));
  if (first === 'new_provider' && opts.manyProperties) return 'Πρώτη φορά από αυτόν τον πάροχο. Έλεγξε ποσό και ακίνητο.';
  return first ? LINE[first] : null;
}

/** Πάνω από το όριο: η κάρτα ρωτά «Πληρώθηκε με τράπεζα ή κάρτα;». */
export const asksBankPayment = (reasons: readonly string[] | null | undefined): boolean => (reasons ?? []).includes('over_limit');

/**
 * Η κατηγορία που έρχεται έτοιμη: πρώτα ό,τι έγραψε η βάση (μητρώο ή η
 * τελευταία επιβεβαίωση του χρήστη για τον ίδιο πάροχο), μετά το μητρώο, μετά
 * το όνομα του εκδότη. Κενό όταν τίποτα δεν είναι βέβαιο: ο χρήστης διαλέγει.
 */
export function suggestedCategory(d: { counterpart_afm: string; counterpart_name: string | null; category: string | null }): string {
  if (d.category && BY_SLUG[d.category]) return d.category;
  const kind = providerByAfm(d.counterpart_afm)?.kind;
  if (kind) return KIND_CATEGORY[kind].slug;
  const guess = d.counterpart_name ? resolveCategory(d.counterpart_name) : null;
  return guess && BY_SLUG[guess] ? guess : '';
}

/** Ο πάροχος: το όνομα του μητρώου, η επωνυμία του εκδότη, αλλιώς «ΑΦΜ …». */
export function displayName(d: { counterpart_afm: string; counterpart_name: string | null }): string {
  return providerName(d.counterpart_afm, d.counterpart_name) ?? `ΑΦΜ ${d.counterpart_afm}`;
}
