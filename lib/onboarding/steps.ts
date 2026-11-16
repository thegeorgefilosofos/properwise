// ═══════════════════════════════════════════════════════════════════════════
// Ο ΔΡΟΜΟΣ ΩΣ ΤΟΝ ΠΡΩΤΟ ΦΟΡΟ, ΓΡΑΜΜΕΝΟΣ ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΜΕΤΡΗΘΗΚΕ (κριτική σχεδίασης, 13/11/2026). Η υποδοχή υποσχόταν τρία
// βήματα και ο οδηγός έδειχνε τέσσερα με άλλα ονόματα («Τύπος», «Βασικά»,
// «Οικονομικά», «Σύνοψη»). Ο χρήστης μετρούσε τρία και έβρισκε πέντε οθόνες.
//
// ΤΩΡΑ ΕΝΑΣ ΠΙΝΑΚΑΣ ΤΑ ΛΕΕΙ ΚΑΙ ΣΤΑ ΔΥΟ. Η υποδοχή (WelcomeOnboarding) και η
// ράγα του οδηγού για νέο ακίνητο (AddPropertyWizard) διαβάζουν το ίδιο
// `ONBOARDING_STEPS`. Τα δύο πρώτα είναι οθόνες του οδηγού· το τρίτο είναι ο
// προορισμός: η Επισκόπηση που ανοίγει με τον φόρο του χρήστη στην κορυφή.
//
// ΤΑ ΠΛΑΚΙΔΙΑ ΤΟΥ ΠΡΩΤΟΥ ΒΗΜΑΤΟΣ. Εξι τύποι και τέσσερις καταστάσεις καλύπτουν
// σχεδόν κάθε νέο λογαριασμό· οι υπόλοιποι είναι ένα πάτημα πιο κάτω («Όλοι
// οι τύποι» και «Όλες οι καταστάσεις», με το ίδιο σχήμα). Επιλογή που δεν
// ανήκει στους πρώτους ανοίγει τη λίστα μόνη της, ώστε η επεξεργασία ενός
// οικοπέδου να μη δείχνει τίποτα επιλεγμένο.
// ═══════════════════════════════════════════════════════════════════════════
import { PROPERTY_TYPES } from '@/lib/property/types';
import { STATUSES, type PropertyStatus } from '@/lib/property/status';

export interface OnboardingStep {
  id: 'type' | 'rent' | 'tax';
  /** Ονοματική φράση, ίδια στην υποδοχή και στη ράγα του οδηγού. */
  label: string;
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  { id: 'type', label: 'Τύπος ακινήτου' },
  { id: 'rent', label: 'Μίσθωμα' },
  { id: 'tax', label: 'Ο φόρος σου' },
];

/**
 * ΤΟ ΔΕΥΤΕΡΟ ΒΗΜΑ ΣΕ ΑΚΙΝΗΤΟ ΠΟΥ ΔΕΝ ΝΟΙΚΙΑΖΕΤΑΙ (κριτική σχεδίασης r3). Ιδιοχρησία,
 * κενό, ανακαίνιση: δεν υπάρχει μίσθωμα να γραφτεί, οπότε το βήμα δεν λέγεται
 * «Μίσθωμα» ούτε ζητά «στόχο ενοικίου». Ζητά τον ΕΝΦΙΑ, τον φόρο που έχει
 * πράγματι αυτό το ακίνητο. Η ράγα του οδηγού αλλάζει το όνομα μόλις διαλεχτεί
 * η κατάσταση.
 */
export const NOT_RENTED_STEP_LABEL = 'ΕΝΦΙΑ';

/** Τα ονόματα της ράγας για την κατάσταση που διαλέχτηκε· χωρίς κατάσταση, της υποδοχής. */
export function stepLabels(rented: boolean | null): string[] {
  return ONBOARDING_STEPS.map(s => (s.id === 'rent' && rented === false ? NOT_RENTED_STEP_LABEL : s.label));
}

type PropertyType = typeof PROPERTY_TYPES[number];

/** Οι έξι τύποι που φαίνονται πρώτοι, με τη σειρά του μητρώου. */
export const PRIMARY_TYPES: readonly PropertyType[] = ['apartment', 'house', 'maisonette', 'studio', 'office', 'shop'];

/** Οι τέσσερις καταστάσεις που φαίνονται πρώτες. */
export const PRIMARY_STATUSES: readonly PropertyStatus[] = ['rent_long', 'rent_short', 'vacant', 'own_use'];

/** Οι υπόλοιποι τύποι, για το «Όλοι οι τύποι». */
export const MORE_TYPES: readonly PropertyType[] = PROPERTY_TYPES.filter(t => !PRIMARY_TYPES.includes(t));

/** Οι υπόλοιπες καταστάσεις, για το «Όλες οι καταστάσεις». */
export const MORE_STATUSES: readonly PropertyStatus[] = STATUSES.map(s => s.key).filter(k => !PRIMARY_STATUSES.includes(k));

/** Η λίστα των υπολοίπων ανοίγει μόνη της όταν η επιλογή ζει εκεί. */
export const typeNeedsMore = (t: string | null | undefined): boolean => !!t && !(PRIMARY_TYPES as readonly string[]).includes(t);
export const statusNeedsMore = (s: PropertyStatus | null | undefined): boolean => !!s && !PRIMARY_STATUSES.includes(s);

/**
 * Το όνομα που παίρνει το νέο ακίνητο όταν ο χρήστης δεν έγραψε δικό του: η
 * διεύθυνση, αν υπάρχει, αλλιώς ο τύπος («Διαμέρισμα»). Αλλάζει από τα
 * «Βασικά στοιχεία» όποτε θέλει.
 */
export function defaultPropertyName(typeLabel: string, address?: string | null): string {
  const a = (address ?? '').trim();
  return a || typeLabel;
}
