// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΠΕΔΙΑ ΤΟΥ «Ε2: ΤΙ ΓΡΑΦΩ ΠΟΥ», ΟΠΩΣ ΤΑΞΙΔΕΥΟΥΝ ΣΤΗ ΔΙΕΥΘΥΝΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Η προεπιλογή είναι παράδειγμα: διαμέρισμα 70 τ.μ., μισθωμένο όλο τον χρόνο
// με 600€, ολόκληρο του ιδιοκτήτη. Το έτος το βάζει ο υπολογιστής, από όσα
// δηλώνονται σήμερα.
// ═══════════════════════════════════════════════════════════════════════════
import { declarationYear } from '@/lib/core/declarationYear';

export const SPEC = {
  etos: '', typos: 'apartment', xrisi: 'lease', misthosi: 'residential',
  enoikio: '600', apo: '1', eos: '12', pososto: '100', tm: '70', orofos: '',
} as const;

export const PATH = '/symplirosi-e2';

/** Οι τύποι ακινήτου, με τα κλειδιά της εφαρμογής (lib/billing/e2.ts). */
export const PROP_TYPES = [
  { value: 'apartment', label: 'Διαμέρισμα' },
  { value: 'house', label: 'Μονοκατοικία' },
  { value: 'maisonette', label: 'Μεζονέτα' },
  { value: 'shop', label: 'Κατάστημα' },
  { value: 'office', label: 'Γραφείο' },
  { value: 'warehouse', label: 'Αποθήκη' },
  { value: 'parking', label: 'Χώρος στάθμευσης' },
  { value: 'land', label: 'Οικόπεδο ή αγρός' },
] as const;

/**
 * Η χρονιά που ανοίγει ο υπολογιστής χωρίς `etos` στη διεύθυνση: η χρήση που
 * δηλώνεται σήμερα (`declarationYear`), όπως ο υπολογιστής φόρου ενοικίων.
 *
 * ΓΙΑΤΙ (έλεγχος 12/11/2026). Ανοιγε πάντα στο πρώτο από τα προσφερόμενα έτη,
 * δηλαδή στο περσινό: τον Νοέμβριο έδειχνε τη χρήση που δηλώθηκε ήδη τον
 * Ιούλιο, ενώ ο ιδιοκτήτης ετοιμάζει πλέον τη φετινή. Εκτός των προσφερόμενων
 * δεν βγαίνει ποτέ· αν συμβεί, πέφτει στην πιο πρόσφατη.
 */
export function openingYear(today: string, years: readonly number[]): number {
  const y = declarationYear(today);
  return years.includes(y) ? y : years[years.length - 1];
}
