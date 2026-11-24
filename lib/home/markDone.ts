// ═══════════════════════════════════════════════════════════════════════════
// «ΠΛΗΡΩΘΗΚΕ» ΑΠΟ ΤΗ ΓΡΑΜΜΗ ΤΗΣ ΕΚΚΡΕΜΟΤΗΤΑΣ (αξιολόγηση σχεδίασης 3, 23/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Η δόση ΕΝΦΙΑ ήθελε τρία πατήματα: γραμμή, εύρεση στο Ημερολόγιο, «Ολοκλήρωση».
// Τώρα ένα, από την Επισκόπηση, με αναίρεση.
//
// ΚΛΕΙΝΕΙ ΕΚΕΙ ΠΟΥ ΤΗΝ ΚΛΕΙΝΕΙ ΚΑΙ ΤΟ ΗΜΕΡΟΛΟΓΙΟ. Μια θεσμική προθεσμία είναι
// κλειστή όταν το γεγονός της πηγής της (`calendar_events.source`) έχει
// κλειστή κατάσταση (lib/facts/deadlines, `closedTaxRefs`). Δεύτερος τρόπος
// να κλείσει δεν υπάρχει, οπότε η Επισκόπηση και το Ημερολόγιο δεν διαφωνούν.
//
// Αν το γεγονός δεν έχει γραφτεί ακόμη στο Ημερολόγιο, γράφεται κλειστό, με την
// ημερομηνία της προθεσμίας. Χωρίς ημερομηνία δεν γράφεται τίποτα: ένα γεγονός
// χωρίς ημέρα θα ήταν φάντασμα στο Ημερολόγιο.
//
// Η ΑΝΑΙΡΕΣΗ ΓΥΡΙΖΕΙ ΑΚΡΙΒΩΣ ΟΣΑ ΑΛΛΑΞΑΝ: την προηγούμενη κατάσταση ή τη γραμμή
// που γράφτηκε. Ό,τι ήταν ήδη κλειστό δεν έχει αναίρεση, γιατί δεν το έκλεισε
// αυτό το πάτημα.
// ═══════════════════════════════════════════════════════════════════════════
import * as calendar from '@/lib/data/calendar';
import type { DbError } from '@/lib/supabase/writeResult';

export interface DoneTarget {
  /** Η πηγή της προθεσμίας στο Ημερολόγιο, π.χ. `tax:enfia-instalment-2026-11`. */
  source: string;
  title: string;
  /** YYYY-MM-DD, ή `null` όταν η προθεσμία δεν έχει ημέρα. */
  date: string | null;
}

type Undo = () => Promise<{ error: DbError | null }>;
export interface DoneResult { error: DbError | null; undo: Undo | null }

/** Οι προθεσμίες που είναι πληρωμή. Οι υπόλοιπες θεσμικές είναι δηλώσεις. */
const PAYMENT = /^tax:(enfia-(first|instalment|last)|income-instalment|str-climate-fee)\b/;
/** Η έκδοση του εκκαθαριστικού δεν είναι πράξη του ιδιοκτήτη· δεν «γίνεται». */
const NOT_OWNERS = /^tax:enfia-issue\b/;

/**
 * Η λέξη του κουμπιού στη γραμμή της Εκκρεμότητας, ή `null` όταν η γραμμή δεν
 * κλείνει από εκεί. Κλείνουν μόνο οι θεσμικές προθεσμίες (`tax:`), γιατί μόνο
 * αυτές κλείνουν από το Ημερολόγιο με τον ίδιο τρόπο.
 */
export function doneLabel(key: string): 'Πληρώθηκε' | 'Έγινε' | null {
  if (!key.startsWith('tax:') || NOT_OWNERS.test(key)) return null;
  return PAYMENT.test(key) ? 'Πληρώθηκε' : 'Έγινε';
}

const CLOSED = new Set(['paid', 'cancelled']);
const NO_DATE: DbError = { message: 'Η προθεσμία δεν έχει ημερομηνία' } as DbError;

export async function markDone(db: calendar.Db, scope: calendar.Scope, t: DoneTarget): Promise<DoneResult> {
  const { row, error } = await calendar.stateBySourceWithError(db, scope.propertyId, t.source);
  if (error) return { error, undo: null };

  if (row) {
    if (CLOSED.has(String(row.status))) return { error: null, undo: null };
    const before = (row.status ?? 'pending') as calendar.EventStatus;
    const { error: e } = await calendar.update(db, row.id, { status: 'paid' });
    if (e) return { error: e, undo: null };
    return { error: null, undo: async () => calendar.update(db, row.id, { status: before }) };
  }

  if (!t.date) return { error: NO_DATE, undo: null };
  const { data, error: e } = await calendar.add(db, scope, t.source, {
    title: t.title, category: 'tax', event_date: t.date, status: 'paid',
  });
  if (e || !data?.id) return { error: (e as DbError) ?? NO_DATE, undo: null };
  const id = data.id;
  return { error: null, undo: async () => calendar.remove(db, id) };
}
