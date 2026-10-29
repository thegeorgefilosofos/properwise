// ═══════════════════════════════════════════════════════════════════════════
// ΥΠΑΡΧΕΙ ΗΔΗ ΕΞΟΔΟ ΓΙΑ ΑΥΤΗ ΤΗ ΔΟΣΗ;
// ─────────────────────────────────────────────────────────────────────────
// Η σελίδα του «Πλήρωσα» προτείνει να καταχωρηθεί η δόση ΕΝΦΙΑ και ως έξοδο.
// Πολλοί όμως την έχουν ήδη περάσει με το χέρι, από το εκκαθαριστικό ή από την
// εισαγωγή κινήσεων τράπεζας. Ενα τσεκαρισμένο κουτί εκεί θα έγραφε το ίδιο
// ποσό δεύτερη φορά στα έξοδα του Ε2.
//
// ΤΟ ΚΡΙΤΗΡΙΟ: ίδιο ακίνητο (το εξασφαλίζει η ανάγνωση), κατηγορία ΕΝΦΙΑ όπως
// την αναγνωρίζει η ταξινομία (και με παλιές ονομασίες, π.χ. «Φορολογικό /
// ΕΝΦΙΑ»), ποσό ίδιο ως το λεπτό και ημερομηνία μέσα σε ±15 ημέρες από την
// προθεσμία της δόσης. Οι δόσεις ΕΝΦΙΑ απέχουν έναν μήνα, οπότε το παράθυρο
// δεν πιάνει ποτέ τη διπλανή δόση· πιάνει όμως την πληρωμή λίγο πριν ή μετά.
// ═══════════════════════════════════════════════════════════════════════════
import { resolveCategory } from '@/lib/expenses/taxonomy';

/** Πόσες μέρες γύρω από την προθεσμία μετρά ένα έξοδο ως «αυτή η δόση». */
export const DUPLICATE_WINDOW_DAYS = 15;
/** Η ανοχή στο ποσό: ένα λεπτό, για στρογγυλέματα. */
export const DUPLICATE_AMOUNT_TOLERANCE = 0.01;

export interface ExpenseProbe { amount: number | string | null; date: string | null; category: string | null }

const DAY = 86_400_000;
const dayOf = (iso: string | null | undefined): number =>
  typeof iso === 'string' ? Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) : NaN;

/** Το διάστημα [από, έως] της ανάγνωσης, σε YYYY-MM-DD. */
export function duplicateWindow(eventDate: string): { from: string; to: string } {
  const d = dayOf(eventDate);
  const at = (t: number) => new Date(t).toISOString().slice(0, 10);
  return { from: at(d - DUPLICATE_WINDOW_DAYS * DAY), to: at(d + DUPLICATE_WINDOW_DAYS * DAY) };
}

/** Μετρά κάποιο από τα έξοδα ως η ίδια δόση; */
export function hasMatchingInstalment(rows: readonly ExpenseProbe[], amount: number, eventDate: string): boolean {
  const target = dayOf(eventDate);
  if (!Number.isFinite(target) || !(amount > 0)) return false;
  return rows.some(r => {
    const a = Number(r.amount);
    if (!Number.isFinite(a) || Math.abs(a - amount) > DUPLICATE_AMOUNT_TOLERANCE + 1e-9) return false;
    if (!r.date || Math.abs(dayOf(r.date) - target) > DUPLICATE_WINDOW_DAYS * DAY) return false;
    return resolveCategory(r.category) === 'enfia';
  });
}
