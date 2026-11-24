// ═══════════════════════════════════════════════════════════════════════════
// myDATA Α2: ΤΙ ΛΕΕΙ Η ΚΑΡΤΑ «ΓΙΑ ΕΛΕΓΧΟ», ΓΡΑΜΜΕΝΟ ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// Ο κινητήρας κρίνει (supabase/functions/_shared/mydataClassify.ts) και δίνει
// κωδικούς· εδώ γίνονται ΜΙΑ πρόταση ανά παραστατικό, με τη σειρά σημασίας,
// και η κατηγορία που έρχεται προσυμπληρωμένη. Στόχος (ιδιοκτήτης 23/11/2026):
// 0 πατήματα στο αυτόματο, 1 πάτημα («Καταχώρηση») στο «Για έλεγχο».
//
// ΧΩΡΙΣ ΦΟΡΟΛΟΓΙΚΗ ΚΡΙΣΗ (θωράκιση 24/11/2026, Κ1 λογιστικού ελέγχου). Η
// κάρτα δεν λέει ποτέ τι αφαιρείται από τον φόρο: για ιδιοκτήτη με εισόδημα
// από ακίνητα ισχύει άλλο καθεστώς από την επιχείρηση, και το καθεστώς του
// χρήστη δεν το ξέρουμε. Ρωτά μόνο «Πώς πληρώθηκε;» και το κρίνει ο λογιστής.
// ═══════════════════════════════════════════════════════════════════════════
import { fe } from '@/lib/core/format';
import { BY_SLUG, resolveCategory } from '@/lib/expenses/taxonomy';
import { BANK_PAYMENT_LIMIT_CENTS, UNUSUAL_FACTOR } from './limits';
import { KIND_CATEGORY, providerByAfm, providerName } from './providers';

/** Η σειρά σημασίας: ο πρώτος λόγος που υπάρχει γίνεται η πρόταση της κάρτας. */
const ORDER = ['credit', 'over_limit', 'amounts', 'pick_property', 'unusual_amount', 'doc_type', 'unknown_provider', 'provider_unchecked', 'new_provider'] as const;

const times = UNUSUAL_FACTOR === 2 ? 'το διπλάσιο' : `${UNUSUAL_FACTOR} φορές`;

const LINE: Record<typeof ORDER[number], string> = {
  over_limit: `Καθαρή αξία πάνω από ${fe(BANK_PAYMENT_LIMIT_CENTS / 100)}. Σημείωσε πώς πληρώθηκε.`,
  credit: 'Πιστωτικό: το ποσό αφαιρείται από τις δαπάνες.',
  amounts: 'Τα σύνολα της ΑΑΔΕ δεν κλείνουν μεταξύ τους. Έλεγξε το ποσό στο παραστατικό.',
  pick_property: 'Έχεις πάνω από ένα ακίνητο: διάλεξε σε ποιο ανήκει.',
  unusual_amount: `Πάνω από ${times} του συνηθισμένου για αυτόν τον πάροχο.`,
  doc_type: 'Ασυνήθιστος τύπος παραστατικού για λογαριασμό. Έλεγξέ το μία φορά.',
  unknown_provider: 'Δεν είναι στους γνωστούς παρόχους ακινήτου. Καταχώρησέ το μόνο αν αφορά το ακίνητο.',
  provider_unchecked: 'Γνωστός πάροχος που δεν έχει επιβεβαιωθεί ακόμη. Έλεγξε ποσό και ακίνητο.',
  new_provider: 'Πρώτη φορά από αυτόν τον πάροχο για αυτό το ακίνητο. Έλεγξε ποσό και ακίνητο.',
};

/**
 * Η μία πρόταση της κάρτας, ή null όταν δεν υπάρχει λόγος. Καμία δεν υπόσχεται
 * αυτόματη καταχώρηση: την κρίνει η βάση ανά πάροχο ΚΑΙ ακίνητο, και μόνο για
 * πάροχο που έχει επιβεβαιώσει άνθρωπος.
 */
export function reviewLine(reasons: readonly string[] | null | undefined, opts: { manyProperties?: boolean } = {}): string | null {
  const has = new Set(reasons ?? []);
  const first = ORDER.find(r => has.has(r));
  if (first === 'new_provider' && opts.manyProperties) return 'Πρώτη φορά από αυτόν τον πάροχο. Διάλεξε ακίνητο και έλεγξε το ποσό.';
  return first ? LINE[first] : null;
}

// ── «ΠΩΣ ΠΛΗΡΩΘΗΚΕ;» ──────────────────────────────────────────────────────

/** Η κατηγορία της ταξινομίας όπου η ερώτηση γίνεται σε κάθε ποσό. */
export const PAY_ALWAYS_SLUG = 'renovation';

/**
 * Ρωτά η κάρτα «Πώς πληρώθηκε;»; Ποτέ σε πιστωτικό (δεν πληρώνεται). Σε κάθε
 * ποσό για ανακαίνιση. Για τις άλλες κατηγορίες όταν η ΚΑΘΑΡΗ αξία (προ ΦΠΑ)
 * ξεπερνά το όριο. Η τιμή του ορίου δεν αλλάζει (data/accounting-sources.json).
 */
export function asksPayment(d: { is_credit: boolean | null; net_cents: number | string | null }, slug: string): boolean {
  if (d.is_credit) return false;
  if (slug === PAY_ALWAYS_SLUG) return true;
  return Number(d.net_cents ?? 0) > BANK_PAYMENT_LIMIT_CENTS;
}

export type PaymentAnswer = 'bank' | 'cash' | 'unpaid';

/** Οι τρεις απαντήσεις, ουδέτερες, με τη σειρά που φαίνονται. */
export const PAYMENT_CHOICES: readonly { key: PaymentAnswer; label: string }[] = [
  { key: 'bank', label: 'Τράπεζα ή κάρτα' },
  { key: 'cash', label: 'Μετρητά' },
  { key: 'unpaid', label: 'Δεν πληρώθηκε ακόμη' },
];

/**
 * Τα πεδία πληρωμής της δαπάνης. Η ημερομηνία πληρωμής είναι ΜΟΝΟ ό,τι έγραψε
 * ο χρήστης (yyyy-mm-dd), ποτέ η ημερομηνία έκδοσης: το παραστατικό εκδίδεται
 * πριν πληρωθεί (Μ7 λογιστικού ελέγχου).
 */
export function paymentFields(answer: PaymentAnswer | null, date: string): { paid: boolean; payment_method: string | null; paid_on: string | null } {
  if (answer !== 'bank' && answer !== 'cash') return { paid: false, payment_method: null, paid_on: null };
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) ? date : null;
  return { paid: true, payment_method: answer === 'bank' ? 'Ηλεκτρονική πληρωμή' : 'Μετρητά', paid_on: iso };
}

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
