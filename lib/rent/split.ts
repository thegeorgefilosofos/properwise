// ═══════════════════════════════════════════════════════════════════════════
// ΕΝΟΙΚΙΟ ΚΑΙ ΥΠΗΡΕΣΙΕΣ ΣΤΗΝ ΙΔΙΑ ΔΟΣΗ: ΚΑΘΑΡΗ ΛΟΓΙΚΗ, ΚΑΜΙΑ ΒΑΣΗ
// ═══════════════════════════════════════════════════════════════════════════
//
// Το `amount` μιας δόσης είναι ό,τι ζητείται από τον μισθωτή: βασικό ενοίκιο
// ΣΥΝ υπηρεσίες που του μετακυλίονται (ίντερνετ, συνδρομές, καθαρισμός,
// στάθμευση). Οι υπηρεσίες δεν είναι μίσθωμα. Το Ε2 και ο φόρος άθροιζαν το
// `amount`, δηλαδή δήλωναν τη χρέωση του Netflix ως εισόδημα από ακίνητο.
//
// Το ενοίκιο γράφεται χωριστά στο `base_rent` από τη στιγμή που μπήκε η στήλη.
// Οι παλαιότερες γραμμές δεν το έχουν: εκεί μετρά ολόκληρο το ποσό και όποιος
// καλεί οφείλει να το επισημάνει (`hasRentSplit`).

export interface RentSplit { amount?: number | null; base_rent?: number | null; services_charge?: number | null }

/** Έχει η δόση χωριστό ενοίκιο ή είναι παλιά γραμμή με ενιαίο ποσό; */
export const hasRentSplit = (p: RentSplit): boolean => p.base_rent != null;

/** Το μίσθωμα της δόσης, χωρίς υπηρεσίες. Παλιά γραμμή: ολόκληρο το ποσό. */
export function rentIncomeOf(p: RentSplit): number {
  return Math.max(0, Number(hasRentSplit(p) ? p.base_rent : p.amount) || 0);
}

/** Οι υπηρεσίες της δόσης που ΔΕΝ είναι μίσθωμα. Παλιά γραμμή: μηδέν. */
export function servicesOf(p: RentSplit): number {
  if (!hasRentSplit(p)) return 0;
  const s = p.services_charge != null ? Number(p.services_charge) : (Number(p.amount) || 0) - (Number(p.base_rent) || 0);
  return Math.max(0, s || 0);
}
