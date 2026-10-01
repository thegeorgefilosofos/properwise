// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΠΡΟΣΥΜΠΛΗΡΩΜΕΝΟ Ε2 ΚΑΙ Ο ΦΑΚΕΛΟΣ ΤΟΥ ΛΟΓΙΣΤΗ: ΤΟ ΣΤΡΩΜΑ ΔΕΔΟΜΕΝΩΝ
// ─────────────────────────────────────────────────────────────────────────
// Οι πίνακες `e2_prefilled` και `accountant_packs` (20261001120000) μιλούν με
// την εφαρμογή ΜΟΝΟ από εδώ. Τους χρειάζονται τρεις οθόνες: η σύγκριση στη
// Λογιστική, ο φάκελος του λογιστή και ο χώρος εργασίας του λογιστή. Γραμμένο
// τρεις φορές, το σχήμα της γραμμής θα απέκλινε στην πρώτη νέα στήλη.
//
// ΑΠΟΤΥΧΙΑ ΔΕΝ ΕΙΝΑΙ «ΤΙΠΟΤΑ». Η ανάγνωση γυρίζει `failed`: ένα προσυμπληρωμένο
// που δεν διαβάστηκε δεν επιτρέπεται να εμφανιστεί ως «δεν ανέβηκε», γιατί η
// οθόνη θα έστελνε τον χρήστη να το ξανανεβάσει πάνω από τα σωστά.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AadeE2Row, E2IncomeColumn } from '@/lib/tax/aadeE2';
import type { E2PrefilledRow, AccountantPacksRow } from '@/lib/supabase/tables';
import { safeRelPath } from '@/lib/storage/scopedUpload';

type Db = SupabaseClient;

const BUCKET = 'property-files';

/** Μία αποθηκευμένη γραμμή, με το ποιος και πότε την ανέβασε. */
export interface StoredE2Row extends AadeE2Row {
  ownerAfm: string;
  source: 'pdf' | 'paste' | 'manual';
  uploadedBy: 'owner' | 'accountant';
  sourceFile: string | null;
  updatedAt: string;
}

const COLUMNS = 'row_no,atak,address,category,tenant_name,tenant_afm,lease_from,lease_to,months,monthly_rent,ownership_pct,gross,income_column,lease_decl_ref,owner_afm,source,uploaded_by,source_file,updated_at';

const num = (v: number | string | null): number | null => (v == null || v === '' ? null : Number(v));

function fromRow(r: Pick<E2PrefilledRow, 'row_no' | 'atak' | 'address' | 'category' | 'tenant_name' | 'tenant_afm' | 'lease_from' | 'lease_to' | 'months' | 'monthly_rent' | 'ownership_pct' | 'gross' | 'income_column' | 'lease_decl_ref' | 'owner_afm' | 'source' | 'uploaded_by' | 'source_file' | 'updated_at'>): StoredE2Row {
  return {
    rowNo: r.row_no, atak: r.atak, address: r.address, category: r.category,
    tenantName: r.tenant_name, tenantAfm: r.tenant_afm,
    from: r.lease_from ? String(r.lease_from).slice(0, 10) : null,
    to: r.lease_to ? String(r.lease_to).slice(0, 10) : null,
    months: num(r.months), monthlyRent: num(r.monthly_rent), ownershipPct: num(r.ownership_pct),
    gross: Number(r.gross) || 0, incomeColumn: (Number(r.income_column) || 13) as E2IncomeColumn,
    leaseDeclRef: r.lease_decl_ref, ownerAfm: r.owner_afm,
    source: r.source as StoredE2Row['source'], uploadedBy: r.uploaded_by as StoredE2Row['uploadedBy'],
    sourceFile: r.source_file, updatedAt: r.updated_at,
  };
}

/** Οι γραμμές του προσυμπληρωμένου ενός ιδιοκτήτη για ένα έτος, όλων των ΑΦΜ. */
export async function listPrefilled(db: Db, ownerId: string, year: number): Promise<{ rows: StoredE2Row[]; failed: boolean }> {
  const { data, error } = await db.from('e2_prefilled').select(COLUMNS)
    .eq('user_id', ownerId).eq('tax_year', year)
    .order('owner_afm').order('row_no', { ascending: true, nullsFirst: false });
  if (error) { console.error('[e2Prefilled] ανάγνωση:', error); return { rows: [], failed: true }; }
  return { rows: (data ?? []).map(r => fromRow(r as Parameters<typeof fromRow>[0])), failed: false };
}

/**
 * Αντικαθιστά σε μία συναλλαγή τις γραμμές ενός ΑΦΜ για ένα έτος. Το ίδιο για
 * ιδιοκτήτη και λογιστή: η βάση γράφει ποιος το έκανε και αρνείται όποιον δεν
 * έχει ζωντανή σύνδεση.
 */
export async function replacePrefilled(db: Db, o: {
  ownerId: string; year: number; ownerAfm: string; source: StoredE2Row['source'];
  file: string | null; rows: readonly AadeE2Row[];
}): Promise<{ ok: true; count: number } | { ok: false; reason: 'not_linked' | 'error' }> {
  const rows = o.rows.map(r => ({
    row_no: r.rowNo, atak: r.atak, address: r.address, category: r.category,
    tenant_name: r.tenantName, tenant_afm: r.tenantAfm, lease_from: r.from, lease_to: r.to,
    months: r.months, monthly_rent: r.monthlyRent, ownership_pct: r.ownershipPct,
    gross: r.gross, income_column: r.incomeColumn, lease_decl_ref: r.leaseDeclRef,
  }));
  const { data, error } = await db.rpc('e2_prefilled_replace', {
    p_owner: o.ownerId, p_year: o.year, p_owner_afm: o.ownerAfm, p_source: o.source, p_file: o.file, p_rows: rows,
  });
  if (error) {
    console.error('[e2Prefilled] αντικατάσταση:', error);
    return { ok: false, reason: error.code === '42501' ? 'not_linked' : 'error' };
  }
  return { ok: true, count: Number(data) || 0 };
}

/** Ονομα αρχείου χωρίς διαδρομές και χαρακτήρες που δεν ταξιδεύουν. */
const safeName = (name: string): string =>
  (String(name || 'arxeio').normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)) || 'arxeio';

/**
 * Το πρωτότυπο αρχείο της ΑΑΔΕ, στον φάκελο ΤΟΥ ΙΔΙΟΚΤΗΤΗ ακόμη κι όταν το
 * ανεβάζει ο λογιστής: εκεί το βρίσκουν και οι δύο και εκεί το σβήνει η διαγραφή του
 * λογαριασμού. Η βάση επιτρέπει στον λογιστή ΜΟΝΟ αυτόν τον υποφάκελο.
 */
export async function uploadAadeOriginal(db: Db, ownerId: string, year: number, file: Blob, name: string): Promise<{ path: string } | { error: string }> {
  const rel = safeRelPath(`aade-e2/${year}/${Date.now()}-${safeName(name)}`);
  if (!rel) return { error: 'Μη έγκυρο όνομα αρχείου.' };
  const path = `${ownerId}/${rel}`;
  const { error } = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/pdf', upsert: false });
  if (error) { console.error('[e2Prefilled] ανέβασμα πρωτοτύπου:', error); return { error: error.message }; }
  return { path };
}

/** Σύνδεσμος λήψης για αρχείο του φακέλου (πρωτότυπο ΑΑΔΕ ή φάκελος λογιστή). */
export async function fileUrl(db: Db, path: string, downloadName?: string): Promise<string | null> {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, 60 * 10, downloadName ? { download: downloadName } : undefined);
  if (error) { console.error('[e2Prefilled] σύνδεσμος αρχείου:', error); return null; }
  return data?.signedUrl ?? null;
}

// ── Ο ΦΑΚΕΛΟΣ ΑΝΑ ΑΦΜ ─────────────────────────────────────────────────────

export interface PackStatus {
  ownerAfm: string;
  aadeDifferences: number | null;
  aadeCheckedAt: string | null;
  missingCount: number;
  missingTop: string[];
  filePath: string | null;
  sizeBytes: number | null;
  sharedAt: string | null;
}

/**
 * Γράφει την κατάσταση της σύγκρισης ή του φακέλου. Ο λογιστής τη βλέπει στη
 * λίστα του χωρίς να διαβάζει τα δεδομένα του ιδιοκτήτη: πλήθη και ημερομηνίες.
 */
export async function savePackStatus(db: Db, userId: string, year: number, ownerAfm: string, patch: {
  aadeDifferences?: number | null; missingCount?: number; missingTop?: readonly string[];
}): Promise<boolean> {
  const row: Record<string, unknown> = { user_id: userId, tax_year: year, owner_afm: ownerAfm };
  if ('aadeDifferences' in patch) { row.aade_differences = patch.aadeDifferences; row.aade_checked_at = new Date().toISOString(); }
  if (patch.missingCount != null) row.missing_count = patch.missingCount;
  if (patch.missingTop) row.missing_top = patch.missingTop.slice(0, 5).map(s => s.slice(0, 200));
  const { error } = await db.from('accountant_packs').upsert(row, { onConflict: 'user_id,tax_year,owner_afm' });
  if (error) { console.error('[e2Prefilled] κατάσταση φακέλου:', error); return false; }
  return true;
}

/**
 * Ο αριθμός δήλωσης μίσθωσης που κατέγραψε ο ιδιοκτήτης, ανά ακίνητο: η πιο
 * πρόσφατη γραμμή `lease_declaration_submitted` του activity_log
 * (app/dashboard/components/LeaseDeclaration.tsx).
 */
export async function declRefsByProperty(db: Db, userId: string): Promise<Map<string, string>> {
  const { data, error } = await db.from('activity_log').select('entity_id,metadata,created_at')
    .eq('user_id', userId).eq('action', 'lease_declaration_submitted')
    .order('created_at', { ascending: false });
  const out = new Map<string, string>();
  if (error) { console.error('[e2Prefilled] αριθμοί δήλωσης:', error); return out; }
  for (const r of data ?? []) {
    const id = String(r.entity_id ?? '');
    const ref = (r.metadata as Record<string, unknown> | null)?.reference;
    if (id && !out.has(id) && typeof ref === 'string' && ref.trim()) out.set(id, ref.trim());
  }
  return out;
}
