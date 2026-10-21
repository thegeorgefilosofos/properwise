// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΑΡΧΕΙΟ: ΜΙΑ ΑΜΥΝΑ ΓΡΑΜΜΕΝΗ ΤΕΣΣΕΡΙΣ ΦΟΡΕΣ, ΜΕ ΤΕΣΣΕΡΑ ΔΙΑΦΟΡΕΤΙΚΑ ΟΡΙΑ
// ─────────────────────────────────────────────────────────────────────────
// Πέντε στήλες του `property_documents` (`amount`, `provider_afm`,
// `period_from`, `period_to`, `issue_date`) ήρθαν με το migration
// 20260730090000. Η βάση είναι σε δωρεάν βαθμίδα, χωρίς αντίγραφα ασφαλείας,
// και το migration μπορεί να μην έχει τρέξει ακόμη — οπότε ο κώδικας γράφει
// αμυντικά: αν λείπει στήλη, ξαναδοκιμάζει χωρίς αυτήν, ώστε το χαρτί του
// χρήστη να μη χάνεται ποτέ επειδή λείπει μια στήλη.
//
// ΣΩΣΤΗ ΑΠΟΦΑΣΗ, ΓΡΑΜΜΕΝΗ ΤΕΣΣΕΡΙΣ ΦΟΡΕΣ ΚΑΙ ΤΙΣ ΤΕΣΣΕΡΙΣ ΑΛΛΙΩΣ:
//
//   • η σάρωση αφαιρεί ΜΙΑ στήλη τη φορά, με τον σωστό βρόχο·
//   • η διόρθωση του Αρχείου έχει τον ίδιο βρόχο, με δική της λίστα στηλών·
//   • η αρχειοθέτηση PDF ξέρει ΜΟΝΟ το `supplier` — τίποτε άλλο·
//   • η εκκρεμότητα, στο πρώτο σφάλμα, ξαναγράφει με φορτίο που πετάει ΚΑΙ ΤΙΣ
//     ΠΕΝΤΕ στήλες μαζί. Δηλαδή αν έλειπε μόνο το `issue_date`, το παραστατικό
//     αρχειοθετούνταν και χωρίς ποσό, χωρίς ΑΦΜ και χωρίς περίοδο — δηλαδή
//     χωρίς τίποτα από όσα το κάνουν απόδειξη αντί για εικόνα.
//
// Η λίστα των προαιρετικών στηλών ζει τώρα σε ένα σημείο και ο βρόχος επίσης.
//
// ΚΑΙ ΤΡΕΙΣ ΑΝΑΓΝΩΣΕΙΣ ΧΩΡΙΣ ΧΡΗΣΤΗ: το Αρχείο, τα παραστατικά παρόχου στις
// Επαφές και το πλήθος εγγράφων στην Επισκόπηση.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PropertyDocumentsRow } from '@/lib/supabase/tables';
import { read, rows as readRows } from './read';
import { forInsert, forUpdate } from './notNull';
import type { DbError } from '@/lib/supabase/writeResult';
import { INCOME_TAX_TITLE, incomeTaxYearOf, ENFIA_TITLE, enfiaYearOf } from '@/lib/billing/documents';

const TABLE = 'property_documents';

export type Db = SupabaseClient;
export type { PropertyDocumentsRow };
export type DocumentPatch = Record<string, unknown>;

/**
 * Στήλες που μπορεί να μην υπάρχουν ακόμη στη βάση.
 *
 * Ήταν γραμμένες δύο φορές με το ίδιο περιεχόμενο, μία φορά μισές και μία φορά
 * καθόλου. Η σειρά μετράει: αφαιρείται μία τη φορά, ξεκινώντας από όποια
 * αναφέρει το σφάλμα, ποτέ όλες μαζί.
 */
export const OPTIONAL_COLUMNS = [
  'amount', 'provider_afm', 'period_from', 'period_to', 'issue_date', 'supplier', 'statement_total',
] as const;

/**
 * Εκτελεί μια γραφή και, αν αποτύχει επειδή λείπει προαιρετική στήλη, την
 * αφαιρεί και ξαναδοκιμάζει. Μία στήλη τη φορά.
 */
async function withoutMissingColumns<R>(
  payload: DocumentPatch,
  run: (p: DocumentPatch) => PromiseLike<{ data?: R; error: { message?: string } | null }>,
): Promise<{ data: R | null; error: { message?: string } | null }> {
  const p: DocumentPatch = { ...payload };
  for (let i = 0; i <= OPTIONAL_COLUMNS.length; i++) {
    const { data, error } = await run(p);
    if (!error) return { data: (data ?? null) as R | null, error: null };
    const message = error.message ?? '';
    const missing = OPTIONAL_COLUMNS.find(c => c in p && new RegExp(`\\b${c}\\b`, 'i').test(message));
    if (!missing) return { data: null, error };
    delete p[missing];
  }
  return { data: null, error: { message: 'Το έγγραφο δεν καταχωρήθηκε' } };
}

// ── ΑΝΑΓΝΩΣΗ ───────────────────────────────────────────────────────────────

/** Τα έγγραφα ενός ακινήτου: νεότερο πρώτο. */
export async function ofProperty<T = Partial<PropertyDocumentsRow>>(
  db: Db, propertyId: string, columns: string, userId?: string,
): Promise<T[]> {
  let q = db.from(TABLE).select(columns).eq('property_id', propertyId);
  if (userId) q = q.eq('user_id', userId);
  return readRows<T>(q.order('created_at', { ascending: false }));
}

/**
 * Τα παραστατικά ενός εκδότη, από το ΑΦΜ του. Αυτό ζητά ο λογιστής.
 *
 * Αν η στήλη `provider_afm` δεν υπάρχει ακόμη, το ερώτημα αποτυγχάνει ολόκληρο
 * και η απάντηση είναι «κανένα» — όχι σφάλμα στην οθόνη.
 */
export async function ofSupplierAfm<T = Partial<PropertyDocumentsRow>>(
  db: Db, propertyId: string, afm: string, columns: string, userId?: string, limit = 50,
): Promise<T[]> {
  let q = db.from(TABLE).select(columns).eq('property_id', propertyId).eq('provider_afm', afm);
  if (userId) q = q.eq('user_id', userId);
  // Η απόρριψη του σφάλματος μένει ρητή, όπως ήταν: αποτυχία σημαίνει «κανένα».
  const { rows, error } = await read<T>(q.order('doc_date', { ascending: false }).limit(limit));
  return error ? [] : rows;
}

/** Τα έγγραφα που έχουν δεθεί με έναν αντισυμβαλλόμενο (π.χ. `tenant:<id>`). */
export async function ofSupplier<T = Partial<PropertyDocumentsRow>>(
  db: Db, propertyId: string, supplier: string, columns: string, userId?: string,
): Promise<T[]> {
  let q = db.from(TABLE).select(columns).eq('property_id', propertyId).eq('supplier', supplier);
  if (userId) q = q.eq('user_id', userId);
  const { rows, error } = await read<T>(q);
  return error ? [] : rows;
}

/**
 * Τα σαρωμένα εκκαθαριστικά φόρου εισοδήματος του ακινήτου: έτος και ποσό.
 *
 * Για τις δόσεις του φόρου στους επόμενους 12 μήνες. Με το σφάλμα ορατό: η
 * αποτυχία δεν επιτρέπεται να διαβαστεί «δεν υπάρχει εκκαθαριστικό». Το νεότερο
 * έγγραφο κάθε έτους κερδίζει, όπως και στο Αρχείο.
 */
export async function incomeTaxStatementsWithError(
  db: Db, propertyId: string, userId: string,
): Promise<{ statements: { taxYear: number; amount: number }[]; error: DbError | null }> {
  const q = db.from(TABLE).select('title,amount,created_at').eq('property_id', propertyId).eq('user_id', userId)
    .ilike('title', `${INCOME_TAX_TITLE} %`).order('created_at', { ascending: false });
  const { rows, error } = await read<{ title: string | null; amount: number | null }>(q);
  const byYear = new Map<number, number>();
  for (const r of rows) {
    const y = incomeTaxYearOf(r.title);
    // Κενό ποσό σημαίνει «η σάρωση δεν το βρήκε», όχι μηδέν. Μηδέν ή αρνητικό
    // (επιστροφή) είναι εκκαθαριστικό χωρίς δόσεις και περνά ως τέτοιο.
    if (r.amount == null || String(r.amount).trim() === '') continue;
    const a = Number(r.amount);
    if (y && Number.isFinite(a) && !byYear.has(y)) byYear.set(y, Math.max(0, a));
  }
  return { statements: [...byYear].map(([taxYear, amount]) => ({ taxYear, amount })), error };
}

/**
 * Τα σαρωμένα εκκαθαριστικά ΕΝΦΙΑ πολλών ακινήτων: ακίνητο, έτος και ΣΥΝΟΛΟ.
 *
 * Από το σύνολο βγαίνει πόσες δόσεις έχει το εκκαθαριστικό (lib/calendar/
 * enfiaTotals.ts). Με το σφάλμα ορατό: «δεν διαβάστηκε» δεν είναι «δεν
 * υπάρχει». Κενό ποσό (η σάρωση δεν βρήκε σύνολο) δεν περνά.
 *
 * ΜΟΝΟ Ο,ΤΙ ΣΗΜΑΔΕΨΕ Η ΣΑΡΩΣΗ (έλεγχος 21/10/2026, εύρημα E). Ο τίτλος
 * «ΕΝΦΙΑ YYYY» δεν αποδεικνύει ότι το ποσό είναι σύνολο: ένα αρχείο που
 * μετονομάστηκε, ή ποσό γραμμένο στο χέρι στη «Διόρθωση αναγνώρισης», είναι
 * συχνά το μερίδιο ενός ακινήτου και έβγαζε λιγότερες δόσεις από τις
 * αληθινές. Μετρά μόνο η γραμμή με `statement_total` (20261021120000), που
 * τη γράφει η σάρωση όταν διάβασε το σύνολο (`planDocSave`).
 */
export async function enfiaStatementsWithError(
  db: Db, propertyIds: string[], userId: string,
): Promise<{ statements: { propertyId: string; year: number; amount: number }[]; error: DbError | null }> {
  if (propertyIds.length === 0) return { statements: [], error: null };
  const q = db.from(TABLE).select('property_id,title,amount').in('property_id', propertyIds).eq('user_id', userId)
    .ilike('title', `${ENFIA_TITLE} %`).eq('statement_total', true);
  const { rows, error } = await read<{ property_id: string; title: string | null; amount: number | null }>(q);
  const statements: { propertyId: string; year: number; amount: number }[] = [];
  for (const r of rows) {
    const y = enfiaYearOf(r.title);
    if (r.amount == null || String(r.amount).trim() === '') continue;
    const a = Number(r.amount);
    if (y && Number.isFinite(a) && a > 0) statements.push({ propertyId: r.property_id, year: y, amount: a });
  }
  return { statements, error };
}

/** Πόσα έγγραφα έχει αυτό το ακίνητο. Χωρίς να κατεβεί καμία γραμμή. */
export async function count(db: Db, propertyId: string, userId?: string): Promise<number> {
  let q = db.from(TABLE).select('id', { count: 'exact', head: true }).eq('property_id', propertyId);
  if (userId) q = q.eq('user_id', userId);
  const { count: n } = await q;
  return n ?? 0;
}

/** Πόσα έγγραφα έχει ο χρήστης σε όλα του τα ακίνητα. `null` όταν η μέτρηση
 *  απέτυχε: άγνωστο δεν σημαίνει μηδέν (πίνακας «Από πού ξεκινάς»). */
export async function countOfUser(db: Db, userId: string): Promise<number | null> {
  const { count: n, error } = await db.from(TABLE).select('id', { count: 'exact', head: true }).eq('user_id', userId);
  return error ? null : n ?? 0;
}

// ── ΕΓΓΡΑΦΗ ────────────────────────────────────────────────────────────────

/** Νέο έγγραφο. Επιστρέφει το κλειδί του, ή `null` αν δεν χρειάστηκε. */
export async function add(
  db: Db, propertyId: string, userId: string, patch: DocumentPatch,
): Promise<{ id: string | null; error: { message?: string } | null }> {
  const { data, error } = await withoutMissingColumns<{ id?: string } | null>(
    { ...patch, property_id: propertyId, user_id: userId },
    p => db.from(TABLE).insert(forInsert(TABLE, p)).select('id').single(),
  );
  return { id: data?.id ?? null, error };
}

/** Ενημέρωση ενός ή περισσότερων εγγράφων, με την ίδια άμυνα στηλών. */
export async function update(db: Db, ids: string[], patch: DocumentPatch) {
  if (ids.length === 0) return { data: null, error: null };
  return withoutMissingColumns<null>(patch, p => db.from(TABLE).update(forUpdate(TABLE, p)).in('id', ids));
}

export function remove(db: Db, id: string) {
  return db.from(TABLE).delete().eq('id', id);
}

export function removeMany(db: Db, ids: string[]) {
  return db.from(TABLE).delete().in('id', ids);
}
