// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΣΥΝΟΛΟ ΤΗΣ ΠΡΑΞΗΣ ΑΝΤΙΚΑΘΙΣΤΑ, ΔΕΝ ΠΡΟΣΤΙΘΕΤΑΙ
// ─────────────────────────────────────────────────────────────────────────
// ΑΠΟ ΠΟΥ ΔΙΑΒΑΖΕΤΑΙ ΤΟ ΣΥΝΟΛΟ. Το lib/calendar/enfiaTotals.ts μαζεύει δύο πηγές
// για κάθε φορολογούμενο και έτος: τις γραμμές «ΕΝΦΙΑ YYYY» του Αρχείου με
// `statement_total` και το «Σύνολο εκκαθαριστικού» των ρυθμίσεων `services`.
// Όταν διαφωνούν, κρατά το ΜΕΓΑΛΥΤΕΡΟ (`enfiaTotals.ts`, «το μεγαλύτερο σύνολο
// κερδίζει»).
//
// Ο ΚΙΝΔΥΝΟΣ. Μια διορθωτική πράξη που ΜΕΙΩΝΕΙ τον φόρο θα έχανε από το παλιό
// σύνολο, αν γραφόταν ως δεύτερη γραμμή. Οι υπενθυμίσεις θα έγραφαν τις παλιές
// δόσεις, με τα παλιά ποσά.
//
// Ο ΚΑΝΟΝΑΣ. Για το έτος της πράξης, ΚΑΘΕ πηγή συνόλου του ίδιου φορολογούμενου
// παίρνει το νέο ποσό: οι υπάρχουσες γραμμές ενημερώνονται και το «Σύνολο
// εκκαθαριστικού» των ρυθμίσεων επίσης. Νέα γραμμή γράφεται ΜΟΝΟ όταν δεν
// υπάρχει καμία. Έτσι ο κανόνας του μεγαλύτερου βλέπει μία τιμή και δεν
// χρειάζεται να αλλάξει. Τα παλιά ποσά κρατιούνται για την αναίρεση.
// ═══════════════════════════════════════════════════════════════════════════
import { parseAmount } from '@/lib/core/greek';

/** Μια γραμμή «ΕΝΦΙΑ YYYY» με `statement_total` του ίδιου έτους. */
export interface StatementRow { id: string; property_id: string; amount: number | null }

/** Το «Σύνολο εκκαθαριστικού» ενός ακινήτου, όπως ζει στις ρυθμίσεις `services`. */
export interface SettingsTotal { propertyId: string; data: Record<string, unknown> }

/** Ό,τι χρειάζεται η αναίρεση για να επιστρέψει ένα ποσό. */
export type Replaced =
  | { t: 'doc'; id: string; amount: number | null }
  | { t: 'set'; property_id: string; total: string; year: string };

export interface StatementPlan {
  /** Νέα γραμμή στο ακίνητο-στόχο, όταν δεν υπάρχει καμία για το έτος. */
  insertOn: string | null;
  docUpdates: { id: string; amount: number }[];
  settingsUpdates: { propertyId: string; data: Record<string, unknown> }[];
  replaced: Replaced[];
}

/** Το ποσό όπως το γράφει η οθόνη του Υπολογισμού ΕΝΦΙΑ: ελληνική υποδιαστολή. */
export const settingsAmount = (n: number): string => String(n).replace('.', ',');

/**
 * Το σχέδιο εγγραφής του συνόλου. Καθαρή συνάρτηση.
 *
 * @param rows     οι γραμμές του έτους στα ακίνητα του ΙΔΙΟΥ φορολογούμενου
 * @param settings οι ρυθμίσεις `services` των ίδιων ακινήτων
 * @param target   το ακίνητο όπου μπαίνει νέα γραμμή, αν χρειαστεί
 */
export function planStatement(
  year: number, total: number, rows: readonly StatementRow[], settings: readonly SettingsTotal[], target: string,
): StatementPlan {
  const cents = (n: number | null) => (n == null ? null : Math.round(Number(n) * 100));
  const want = cents(total);
  const plan: StatementPlan = { insertOn: null, docUpdates: [], settingsUpdates: [], replaced: [] };

  if (!rows.length) plan.insertOn = target;
  for (const r of rows) {
    if (cents(r.amount) === want) continue;
    plan.docUpdates.push({ id: r.id, amount: total });
    plan.replaced.push({ t: 'doc', id: r.id, amount: r.amount });
  }

  for (const s of settings) {
    const y = String(s.data.enfiaStatementYear ?? '').trim();
    const raw = String(s.data.enfiaStatementTotal ?? '').trim();
    if (y !== String(year) || !raw) continue;
    // Η ίδια ανάγνωση με το `enfiaTotalOfSettings`, ώστε «ίδιο ποσό» να σημαίνει το ίδιο και στα δύο.
    if (cents(parseAmount(raw)) === want) continue;
    plan.settingsUpdates.push({ propertyId: s.propertyId, data: { ...s.data, enfiaStatementTotal: settingsAmount(total) } });
    plan.replaced.push({ t: 'set', property_id: s.propertyId, total: raw, year: y });
  }
  return plan;
}
