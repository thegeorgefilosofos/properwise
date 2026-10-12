// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΜΙΣΘΩΤΕΣ: ΠΟΙΟΣ ΕΙΝΑΙ «Ο ΤΡΕΧΩΝ», ΓΡΑΜΜΕΝΟ ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// Τριάντα κλήσεις στον πίνακα `tenants` από δεκαπέντε αρχεία. Οι μισές ρωτούν
// το ίδιο πράγμα — «ποιος μένει τώρα στο ακίνητο;» — και το ρωτούν με ΤΕΣΣΕΡΙΣ
// διαφορετικούς τρόπους:
//
//     .order('created_at', desc).limit(1)      βεβαίωση ενοικίου, πύλη, Ε2
//     .order('updated_at', desc).limit(1)      Επισκόπηση, βοηθός, συμβόλαιο
//     .neq('status', 'past')                   ημερολόγιο
//     (καμία συνθήκη)                          λογαριασμοί, ασφάλιση, απογραφή
//
// ΔΕΝ ΕΙΝΑΙ ΘΕΩΡΗΤΙΚΟ. Ο ιδιοκτήτης που άλλαξε μισθωτή έχει δύο γραμμές. Η
// «τελευταία δημιουργημένη» και η «τελευταία ενημερωμένη» δεν είναι ο ίδιος
// άνθρωπος: αν διορθώσεις το ΑΦΜ του παλιού μισθωτή, εκείνος γίνεται ο πιο
// πρόσφατα ενημερωμένος. Και καμία από τις δύο δεν κοιτάζει καν αν έχει φύγει.
// Αποτέλεσμα: η βεβαίωση ενοικίου έβγαινε στο όνομα άλλου ανθρώπου από αυτόν
// που δείχνει η Επισκόπηση, για το ίδιο ακίνητο, την ίδια στιγμή.
//
// Ο ΚΑΝΟΝΑΣ ΥΠΗΡΧΕ ΗΔΗ, σε μία γραμμή μέσα στην καρτέλα Μισθωτές:
//
//     const isPastTenant = t => t.status === 'past' || !!t.move_out_date
//
// Δεν τον έβλεπε κανένα από τα υπόλοιπα δεκατέσσερα αρχεία. Εδώ γίνεται η μία
// πηγή και το «τρέχων» παύει να είναι θέμα γνώμης.
//
// ΚΑΙ ΤΟ `user_id`: δέκα από τις τριάντα αναγνώσεις ζητούσαν μισθωτές με σκέτο
// `property_id`, στηριγμένες αποκλειστικά στην RLS. Όπου ο καλών ξέρει τον
// χρήστη, το στρώμα προσθέτει το φίλτρο — δεύτερη κλειδαριά, όχι διακοσμητικό.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantsRow } from '@/lib/supabase/tables';
import { read, type ReadResult } from './read';
import type { DbError } from '@/lib/supabase/writeResult';

const TABLE = 'tenants';

export type Db = SupabaseClient;
export type TenantRow = TenantsRow;

export interface Outcome { data: null; error: { message?: string; code?: string } | null }

/** Το ελάχιστο που χρειάζεται μια οθόνη για να πει ποιος μένει εδώ. */
export const NAME_COLUMNS = 'id,full_name';

/** Οι στήλες που κρίνουν αν ο μισθωτής έχει φύγει. Ζητούνται ΠΑΝΤΑ μαζί. */
const STATUS_COLUMNS = 'status,move_out_date';

/** Το σχήμα που κρίνει το «έφυγε». Δύο στήλες, καμία παραπάνω. */
export interface TenantStatus {
  status?: string | null;
  move_out_date?: string | null;
}

/**
 * Έφυγε;
 *
 * ΔΥΟ ΣΤΗΛΕΣ, ΟΧΙ ΜΙΑ. Η κατάσταση γράφεται `past` όταν ο χρήστης πατά «Αποχώρηση»,
 * αλλά η ημερομηνία αποχώρησης μπορεί να μπει και μόνη της — από τη σάρωση
 * συμβολαίου, από την εισαγωγή δεδομένων, από διόρθωση. Ένα φίλτρο που κοιτάζει
 * μόνο το `status` αφήνει μέσα ανθρώπους που έχουν ήδη φύγει.
 */
export const hasLeft = (t: TenantStatus): boolean =>
  t.status === 'past' || !!t.move_out_date;

/**
 * Ποιος μένει τώρα: όσοι δεν έχουν φύγει, νεότερη μίσθωση πρώτη.
 *
 * Η ΣΕΙΡΑ ΕΙΝΑΙ Η ΕΝΑΡΞΗ ΤΗΣ ΜΙΣΘΩΣΗΣ, όχι η ώρα που γράφτηκε η γραμμή. Το
 * `created_at` λέει πότε ο ιδιοκτήτης πληκτρολόγησε, το `updated_at` πότε
 * διόρθωσε κάτι — κανένα από τα δύο δεν είναι πληροφορία για το ποιος μένει στο
 * σπίτι. Όταν λείπει η ημερομηνία έναρξης, πέφτουμε πίσω στη δημιουργία, ώστε
 * ημιτελής καταχώρηση να μη βγει μπροστά από πλήρη.
 */
export function sortCurrentFirst<T extends TenantStatus & { lease_start?: string | null; created_at?: string | null }>(rows: T[]): T[] {
  return [...rows]
    .filter(t => !hasLeft(t))
    .sort((a, b) => String(b.lease_start || b.created_at || '').localeCompare(String(a.lease_start || a.created_at || '')));
}

// ── ΑΝΑΓΝΩΣΗ ───────────────────────────────────────────────────────────────

/**
 * Ο τρέχων μισθωτής ενός ακινήτου, ή `null` αν το ακίνητο είναι κενό.
 *
 * Η ΕΠΙΛΟΓΗ ΓΙΝΕΤΑΙ ΕΔΩ, ΟΧΙ ΣΤΗ ΒΑΣΗ. Ένα `.neq('status','past').limit(1)` δεν
 * μπορεί να εκφράσει τον κανόνα των δύο στηλών ούτε την εφεδρική ταξινόμηση και
 * κάθε οθόνη που θα προσπαθούσε θα τον έγραφε λίγο αλλιώς. Οι μισθωτές ενός
 * ακινήτου είναι λίγοι· η ταξινόμηση σε μνήμη κοστίζει μηδέν και λέει την αλήθεια.
 *
 * Οι στήλες κατάστασης προστίθενται πάντα στο αίτημα, ακόμη κι αν ο καλών δεν τις
 * ζήτησε — χωρίς αυτές η ερώτηση δεν απαντιέται.
 */
export async function current<T = Partial<TenantsRow>>(
  db: Db, propertyId: string, columns: string, userId?: string,
): Promise<T | null> {
  const rows = await currentAll<T>(db, propertyId, columns, userId);
  return rows[0] ?? null;
}

/**
 * Ο τρέχων μισθωτής, με το σφάλμα ορατό.
 *
 * ΤΟ ΧΡΕΙΑΖΕΤΑΙ Η ΛΟΓΙΣΤΙΚΗ: από το `e_payment` του μισθωτή κρίνεται η τεκμαρτή
 * έκπτωση 5%. Αποτυχία εδώ διαβαζόταν ως «δεν υπάρχει μισθωτής» και η οθόνη
 * επέλεγε μόνη της ποιο καθεστώς να εφαρμόσει σε φόρο που θα δηλωθεί.
 */
export async function currentWithError<T = Partial<TenantsRow>>(
  db: Db, propertyId: string, columns: string, userId?: string,
): Promise<{ row: T | null; error: DbError | null }> {
  let q = db.from(TABLE).select(withStatus(columns)).eq('property_id', propertyId);
  if (userId) q = q.eq('user_id', userId);
  const { rows, error } = await read<T>(q.order('created_at', { ascending: false }));
  const sorted = sortCurrentFirst(rows as (T & TenantStatus & { lease_start?: string | null; created_at?: string | null })[]) as T[];
  return { row: sorted[0] ?? null, error };
}

/** Όλοι όσοι μένουν τώρα (συγκατοίκηση), νεότερη μίσθωση πρώτη. */
export async function currentAll<T = Partial<TenantsRow>>(
  db: Db, propertyId: string, columns: string, userId?: string,
): Promise<T[]> {
  // ΕΝΑ ΜΟΝΟΠΑΤΙ: η απλή εκδοχή είναι η ίδια ανάγνωση, χωρίς το σφάλμα της.
  return (await currentAllWithError<T>(db, propertyId, columns, userId)).rows;
}

/**
 * Οι τωρινοί μισθωτές, με το σφάλμα ορατό. Η Επισκόπηση βγάζει από εδώ το
 * ενοίκιο του Ταμείου: αποτυχία διαβαζόταν ως «κανένας μισθωτής» και το ποσό
 * έπεφτε σιωπηλά στον στόχο ενοικίου ή στο μηδέν.
 */
export async function currentAllWithError<T = Partial<TenantsRow>>(
  db: Db, propertyId: string, columns: string, userId?: string,
): Promise<ReadResult<T>> {
  const { rows, error } = await ofPropertyWithError<T>(db, propertyId, withStatus(columns), userId);
  return { rows: sortCurrentFirst(rows as (T & TenantStatus & { lease_start?: string | null; created_at?: string | null })[]) as T[], error };
}

/** Κάθε μισθωτής του ακινήτου, παρελθόντες μαζί, νεότερη καταχώρηση πρώτη. */
export async function ofProperty<T = Partial<TenantsRow>>(
  db: Db, propertyId: string, columns: string, userId?: string,
): Promise<T[]> {
  return (await ofPropertyWithError<T>(db, propertyId, columns, userId)).rows;
}

/** Κάθε μισθωτής του ακινήτου, με το σφάλμα ορατό. */
export async function ofPropertyWithError<T = Partial<TenantsRow>>(
  db: Db, propertyId: string, columns: string, userId?: string,
): Promise<ReadResult<T>> {
  let q = db.from(TABLE).select(columns).eq('property_id', propertyId);
  if (userId) q = q.eq('user_id', userId);
  return read<T>(q.order('created_at', { ascending: false }));
}

/** Οι μισθωτές όλου του χαρτοφυλακίου ενός χρήστη. */
export async function ofUser<T = Partial<TenantsRow>>(
  db: Db, userId: string, columns: string,
): Promise<T[]> {
  return (await ofUserWithError<T>(db, userId, columns)).rows;
}

/** Οι μισθωτές όλου του χαρτοφυλακίου, με το σφάλμα ορατό: από αυτούς βγαίνει ο φόρος του Ε1. */
export async function ofUserWithError<T = Partial<TenantsRow>>(
  db: Db, userId: string, columns: string,
): Promise<ReadResult<T>> {
  return read<T>(db.from(TABLE).select(columns).eq('user_id', userId)
    .order('created_at', { ascending: false }));
}

/**
 * Ο τρέχων μισθωτής ΑΝΑ ΑΚΙΝΗΤΟ, σε έναν χάρτη.
 *
 * Το χαρτοφυλάκιο ρωτούσε το ίδιο πράγμα με ένα ερώτημα και μετά κρατούσε την
 * πρώτη γραμμή κάθε ακινήτου — δηλαδή εφάρμοζε τον τέταρτο ορισμό, τον σιωπηλό.
 */
export async function currentByProperty<T extends TenantStatus & { property_id?: string | null }>(
  db: Db, userId: string, columns: string,
): Promise<Map<string, T>> {
  const rows = await ofUser<T>(db, userId, withStatus(columns.includes('property_id') ? columns : `property_id,${columns}`));
  const byProperty = new Map<string, T[]>();
  for (const r of rows) {
    const pid = String(r.property_id || '');
    if (!pid) continue;
    const arr = byProperty.get(pid);
    if (arr) arr.push(r); else byProperty.set(pid, [r]);
  }
  const out = new Map<string, T>();
  for (const [pid, list] of byProperty) {
    const first = sortCurrentFirst(list as (T & { lease_start?: string | null; created_at?: string | null })[])[0];
    if (first) out.set(pid, first as T);
  }
  return out;
}

// ── ΜΙΣΘΩΣΕΙΣ ΕΝΟΣ ΕΤΟΥΣ ──────────────────────────────────────────────────
//
// Ο «ΤΡΕΧΩΝ» ΕΙΝΑΙ ΕΡΩΤΗΣΗ ΓΙΑ ΤΟ ΣΗΜΕΡΑ. Το Ε2 ρωτά για ένα έτος που έχει
// κλείσει. Με τον τρέχοντα μισθωτή, το Ε2 του 2025 που βγήκε αφού ξεκίνησε νέα
// μίσθωση το 2026 έγραφε το όνομα και το ΑΦΜ του νέου μισθωτή δίπλα στο ενοίκιο
// του παλιού, με μήνες 0 και κενές ημερομηνίες.

/** Το σχήμα που χρειάζεται η κρίση «μίσθωση μέσα στο έτος». */
export interface LeaseDates extends TenantStatus {
  lease_start?: string | null;
  lease_end?: string | null;
}

const isoDay = (v: string | null | undefined): string | null => {
  const s = String(v ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z')) ? s : null;
};

/**
 * Πότε τελείωσε στην πράξη η μίσθωση: η νωρίτερη από τη λήξη του συμβολαίου
 * και την αποχώρηση. Μισθωτής με συμβόλαιο ως το 2027 που έφυγε τον Ιούνιο
 * δεν πλήρωσε ενοίκιο τον Ιούλιο.
 */
export function leaseEndOf(t: LeaseDates): string | null {
  const ends = [isoDay(t.lease_end), isoDay(t.move_out_date)].filter((d): d is string => !!d).sort();
  return ends[0] ?? null;
}

/**
 * Οι μισθώσεις ενός ακινήτου που καλύπτουν το `year`, παλαιότερη πρώτη.
 *
 * Με ημερομηνία έναρξης: μετρά αν η έναρξη είναι ως το τέλος του έτους και η
 * λήξη (ή αποχώρηση) από την αρχή του και μετά.
 *
 * ΧΩΡΙΣ ΗΜΕΡΟΜΗΝΙΑ ΕΝΑΡΞΗΣ δεν ξέρουμε πότε ξεκίνησε. Μετρά μόνο αν καμία
 * χρονολογημένη μίσθωση δεν καλύπτει το έτος και ο μισθωτής δεν είχε φύγει πριν
 * από αυτό. Αλλιώς ο νέος μισθωτής χωρίς ημερομηνία θα έμπαινε σε κάθε
 * παλαιότερο Ε2.
 */
export function leasesInYear<T extends LeaseDates & { created_at?: string | null }>(rows: readonly T[], year: number): T[] {
  const ys = `${year}-01-01`, ye = `${year}-12-31`;
  const endsInTime = (t: T) => { const e = leaseEndOf(t); return !e || e >= ys; };
  const dated = rows.filter(t => { const s = isoDay(t.lease_start); return !!s && s <= ye && endsInTime(t); });
  const chosen = dated.length ? dated
    : rows.filter(t => !isoDay(t.lease_start) && endsInTime(t) && (!hasLeft(t) || !!leaseEndOf(t)));
  return [...chosen].sort((a, b) =>
    String(isoDay(a.lease_start) || a.created_at || '').localeCompare(String(isoDay(b.lease_start) || b.created_at || '')));
}

/**
 * Οι μισθώσεις κάθε ακινήτου μέσα στο `year`, με ένα ερώτημα για όλο το
 * χαρτοφυλάκιο. Το `known` λέει ποια ακίνητα έχουν καταχωρημένο έστω και έναν
 * μισθωτή, σε οποιοδήποτε έτος: ακίνητο με ιστορικό μισθώσεων και καμία μέσα
 * στο έτος ήταν κενό εκείνο το έτος, όχι «μισθωμένο χωρίς στοιχεία».
 */
export async function inYearByProperty<T extends LeaseDates & { property_id?: string | null }>(
  db: Db, userId: string, year: number, columns: string,
): Promise<{ inYear: Map<string, T[]>; known: Set<string>; error: DbError | null }> {
  const cols = withStatus(columns.includes('property_id') ? columns : `property_id,${columns}`);
  // Το σφάλμα επιστρέφεται: ο καλών είναι το Ε2, όπου «καμία μίσθωση» είναι
  // μηδενικό εισόδημα, όχι κενό ακίνητο.
  const { rows, error } = await ofUserWithError<T>(db, userId, [...new Set([...cols.split(','), 'id', 'lease_end'])].join(','));
  const byProperty = new Map<string, T[]>();
  for (const r of rows) {
    const pid = String(r.property_id || '');
    if (!pid) continue;
    const arr = byProperty.get(pid);
    if (arr) arr.push(r); else byProperty.set(pid, [r]);
  }
  const inYear = new Map<string, T[]>();
  for (const [pid, list] of byProperty) {
    const leases = leasesInYear(list as (T & { created_at?: string | null })[], year);
    if (leases.length) inYear.set(pid, leases);
  }
  return { inYear, known: new Set(byProperty.keys()), error };
}

// ── ΕΓΓΡΑΦΗ ────────────────────────────────────────────────────────────────

/**
 * Ό,τι γράφεται σε μισθωτή.
 *
 * Όπως και στα ακίνητα, ΔΕΝ είναι `Partial<TenantsRow>`: το «καθάρισε αυτό το
 * πεδίο» γράφεται με ρητό `null` και το `Partial` το απέρριπτε.
 */
export type TenantPatch = { [K in keyof TenantsRow]?: TenantsRow[K] | null };

/** Νέος μισθωτής. Το ακίνητο και ο χρήστης μπαίνουν εδώ, όχι στον καλούντα. */
export function add(db: Db, propertyId: string, userId: string, patch: TenantPatch) {
  return db.from(TABLE).insert({ ...patch, property_id: propertyId, user_id: userId });
}

/** Νέος μισθωτής, με τη γραμμή πίσω. */
export function addReturning(db: Db, propertyId: string, userId: string, patch: TenantPatch, columns = '*') {
  return db.from(TABLE).insert({ ...patch, property_id: propertyId, user_id: userId }).select(columns).single();
}

export function update(db: Db, id: string, patch: TenantPatch) {
  return db.from(TABLE).update(patch).eq('id', id);
}

export function updateReturning(db: Db, id: string, patch: TenantPatch, columns = '*') {
  return db.from(TABLE).update(patch).eq('id', id).select(columns).single();
}

export function remove(db: Db, id: string) {
  return db.from(TABLE).delete().eq('id', id);
}

/**
 * Αποχώρηση.
 *
 * ΓΡΑΦΕΙ ΚΑΙ ΤΙΣ ΔΥΟ ΣΤΗΛΕΣ, γιατί και οι δύο κρίνουν το «έφυγε». Όποιος έγραφε
 * μόνο το `status` άφηνε ακίνητο που φαινόταν κενό αλλού και κατοικημένο εδώ.
 */
export function markPast(db: Db, id: string, moveOutDate: string) {
  return db.from(TABLE).update({ status: 'past', move_out_date: moveOutDate }).eq('id', id);
}

// ── Βοηθητικά ──────────────────────────────────────────────────────────────

/** Οι στήλες του καλούντος συν εκείνες που κρίνουν το «έφυγε», χωρίς διπλά. */
function withStatus(columns: string): string {
  if (columns === '*') return columns;
  const asked = new Set(columns.split(',').map(c => c.trim()).filter(Boolean));
  for (const c of STATUS_COLUMNS.split(',')) asked.add(c);
  asked.add('lease_start');
  asked.add('created_at');
  return [...asked].join(',');
}
