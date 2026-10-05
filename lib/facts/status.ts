// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΤΑΣΤΑΣΗ ΤΟΥ ΑΚΙΝΗΤΟΥ: ΜΙΑ ΤΙΜΗ, ΑΠΟ ΜΙΑ ΑΝΑΓΝΩΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Η βάση κρατά δύο στήλες για το ίδιο πράγμα (`status_detail`, `rental_mode`).
// Το lib/property/status.ts ξέρει να τις διαβάζει μαζί· όπου μια οθόνη διάβαζε
// μία από τις δύο ωμή, το ίδιο ακίνητο είχε άλλη κατάσταση σε άλλη οθόνη. Η
// Λογιστική έγραφε `rented: rental_mode !== 'own_use'`, που είναι πάντα αληθές
// (το `rental_mode` δεν παίρνει ποτέ αυτή την τιμή): ακίνητο σε ιδιοχρησία
// έβγαινε «μισθωμένο» στο Ε2 της πρόβλεψης.
// ═══════════════════════════════════════════════════════════════════════════
import { readStatus, BY_KEY, type PropertyStatus, type StatusRow } from '@/lib/property/status';

export type { PropertyStatus, StatusRow };

/** Η κατάσταση του ακινήτου. Η ΜΟΝΗ ανάγνωση των δύο στηλών. */
export const propertyStatus = (row: StatusRow | null | undefined): PropertyStatus => readStatus(row);

/** Η ετικέτα της κατάστασης, ίδια σε κάθε οθόνη. */
export const propertyStatusLabel = (row: StatusRow | null | undefined): string => BY_KEY[readStatus(row)].label;

/** Μίσθωση, με οποιονδήποτε τρόπο. Μόνο τότε υπάρχουν έσοδα ενοικίου και απόδοση. */
export const isLease = (s: PropertyStatus): boolean => s === 'rent_long' || s === 'rent_short';
