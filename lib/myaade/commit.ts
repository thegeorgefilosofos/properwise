// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΤΑΧΩΡΗΣΗ ΚΑΙ Η ΑΝΑΙΡΕΣΗ ΜΙΑΣ ΕΙΣΑΓΩΓΗΣ ΑΠΟ ΤΟ myAADE
// ─────────────────────────────────────────────────────────────────────────
// Η ΣΕΙΡΑ ΤΗΣ ΚΑΤΑΧΩΡΗΣΗΣ:
//   1. Μία γραμμή στο `myaade_imports`. Εδώ μετρά το όριο των 10 σε 24 ώρες, ΣΤΗ
//      ΒΑΣΗ: αν έχει εξαντληθεί, δεν γράφεται τίποτα άλλο.
//   2. Τα ακίνητα: νέα με `properties.add`, υπάρχοντα μόνο στα κενά πεδία.
//   3. Το σύνολο της πράξης: ΑΝΤΙΚΑΘΙΣΤΑ το ποσό του ίδιου έτους (statement.ts).
//   4. Τι δημιουργήθηκε και τι αντικαταστάθηκε, στη γραμμή του βήματος 1.
//   5. `syncOwnerTaxDeadlines`, με αναμονή: δόσεις, υπενθυμίσεις και «Πλήρωσα»
//      βγαίνουν από την υπάρχουσα μηχανή. Η εισαγωγή ΔΕΝ γράφει γεγονότα
//      ημερολογίου· ένας γραφέας, ένα κλειδί, κανένα διπλότυπο.
//
// ΚΑΘΕ ΒΗΜΑ ΠΟΥ ΑΠΟΤΥΓΧΑΝΕΙ ΛΕΓΕΤΑΙ ΜΕ ΤΟ ΟΝΟΜΑ ΤΟΥ. Τίποτα από όσα γράφτηκαν
// πριν δεν σβήνεται αυτόματα: η αναίρεση είναι επιλογή του χρήστη.
//
// ΤΟ PDF ΔΕΝ ΑΓΓΙΖΕΙ ΤΗ ΒΑΣΗ. Εδώ φτάνουν μόνο οι τιμές που επιβεβαίωσε ο
// χρήστης. Το ΑΦΜ της πράξης δεν περνά καν από αυτό το αρχείο.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import * as properties from '@/lib/data/properties';
import * as documents from '@/lib/data/documents';
import * as settings from '@/lib/data/settings';
import * as billing from '@/lib/data/billing';
import * as expenses from '@/lib/data/expenses';
import * as tenants from '@/lib/data/tenants';
import * as bills from '@/lib/data/bills';
import { read } from '@/lib/data/read';
import { ENFIA_TITLE, archiveCategoryFor } from '@/lib/billing/documents';
import { syncOwnerTaxDeadlines } from '@/lib/calendar/taxSync';
import { sameTaxpayer, taxpayerScope } from '@/lib/facts/taxpayer';
import { PAY_UNDO_HOURS } from '@/lib/reminders/payLink';
import { atakDigits, isAtak } from '@/lib/property/atak';
import { grDate } from '@/lib/core/format';
import { athensToday, athensTime } from '@/lib/core/time';
import { fillOnlyEmpty, type KnownProperty } from './match';
import { planStatement, type Replaced, type SettingsTotal } from './statement';

const TABLE = 'myaade_imports';

/** Πόσες εισαγωγές χωρούν σε 24 ώρες. Το ίδιο νούμερο φυλάει η βάση (20261030150000). */
export const MYAADE_DAILY_IMPORTS = 10;
/** Πόσες ώρες ισχύει η αναίρεση: όσο και στο «Πλήρωσα». */
export const IMPORT_UNDO_HOURS = PAY_UNDO_HOURS;

/** Μια γραμμή που επιβεβαίωσε ο χρήστης. */
export interface CommitRow {
  /** `null` = νέο ακίνητο· αλλιώς το υπάρχον, όπου συμπληρώνονται μόνο τα κενά. */
  existingId: string | null;
  name: string;
  address: string | null;
  atak: string | null;
  sqm: number | null;
  ownershipPct: number | null;
  floor: string | null;
}

export interface CommitInput {
  userId: string;
  year: number | null;
  total: number | null;
  foundCount: number;
  rows: readonly CommitRow[];
  known: readonly KnownProperty[];
  docDate: string;
  /** Επαγγελματικός λογαριασμός: η καρτέλα «Ιδιοκτήτης» στην οποία ανήκει η πράξη. */
  clientId?: string | null;
}

export type CommitOutcome =
  | { ok: true; batchId: string; created: string[]; filled: number; statement: 'inserted' | 'updated' | 'same' | 'none'; failures: string[] }
  | { ok: false; reason: 'daily_limit' | 'failed' };

type Err = { message?: string | null; code?: string | null } | null;
const isPropertyLimit = (e: Err) => /PROPERTY_LIMIT/.test(e?.message ?? '');

/** Η γραμμή του ακινήτου, μόνο με ό,τι υπάρχει. Το κενό αφήνεται στην προεπιλογή της βάσης. */
export function newPropertyRow(userId: string, r: CommitRow, clientId: string | null = null): Record<string, unknown> {
  const row: Record<string, unknown> = { user_id: userId, name: r.name.trim().slice(0, 120) };
  // Ο ιδιοκτήτης της πράξης: έτσι το σύνολο πηγαίνει στον σωστό φορολογούμενο (taxpayerOf).
  if (clientId) row.client_id = clientId;
  if (r.address?.trim()) row.address = r.address.trim();
  if (isAtak(r.atak)) row.atak = atakDigits(r.atak);
  if (r.sqm && r.sqm > 0) row.sqm = r.sqm;
  if (r.ownershipPct && r.ownershipPct > 0 && r.ownershipPct <= 100) row.ownership = r.ownershipPct;
  if (r.floor?.trim()) row.floor = r.floor.trim();
  return row;
}

/** Η γραμμή «ΕΝΦΙΑ YYYY» του Αρχείου, όπως τη γράφει και η σάρωση, χωρίς αρχείο. */
export function statementDocRow(year: number, total: number, docDate: string): Record<string, unknown> {
  return {
    kind: 'document',
    category: archiveCategoryFor({ doc_type: 'tax', subtype: 'enfia' } as Parameters<typeof archiveCategoryFor>[0]),
    title: `${ENFIA_TITLE} ${year}`,
    amount: total,
    statement_total: true,
    doc_date: docDate,
    // ΤΟ PDF ΔΕΝ ΑΠΟΘΗΚΕΥΕΤΑΙ: η γραμμή κρατά μόνο το σύνολο. Το Αρχείο τη
    // δείχνει χωρίς «Άνοιγμα», όπως κάθε στοιχείο χωρίς αρχείο.
    file_path: '',
    notes: 'Από την εισαγωγή myAADE',
  };
}

/** Τα ακίνητα του ίδιου φορολογούμενου με το `target` (ο κανόνας του enfiaTotals.ts). */
async function taxpayerProperties(db: SupabaseClient, userId: string, target: string): Promise<{ ids: string[]; error: Err }> {
  const [list, prof] = await Promise.all([
    properties.listWithError<{ id: string; client_id: string | null }>(db, userId, { columns: 'id,client_id' }),
    billing.profileOutcome<{ profile_type: string | null }>(db, userId, 'profile_type'),
  ]);
  if (list.error) return { ids: [], error: list.error };
  if (prof.error) return { ids: [], error: prof.error };
  let owners: Set<string> | null = null;
  if (prof.data?.profile_type === 'professional') {
    const res = await read<{ id: string }>(db.from('clients').select('id').eq('user_id', userId).eq('type', 'owner'));
    if (res.error) return { ids: [], error: res.error };
    owners = new Set(res.rows.map(r => r.id));
  }
  const scope = taxpayerScope(prof.data?.profile_type ?? null, owners);
  return { ids: sameTaxpayer(list.rows, target, scope).map(p => p.id), error: null };
}

async function writeStatement(
  db: SupabaseClient, userId: string, year: number, total: number, target: string, docDate: string,
): Promise<{ result: 'inserted' | 'updated' | 'same'; documentId: string | null; replaced: Replaced[]; error: string | null }> {
  const fail = (error: string) => ({ result: 'same' as const, documentId: null, replaced: [], error });
  const scope = await taxpayerProperties(db, userId, target);
  if (scope.error) return fail('Το σύνολο του ΕΝΦΙΑ δεν γράφτηκε: τα ακίνητα του φορολογούμενου δεν διαβάστηκαν.');
  const ids = scope.ids.includes(target) ? scope.ids : [...scope.ids, target];
  const [rowsRes, conf] = await Promise.all([
    documents.enfiaStatementRowsOfYear(db, ids, userId, year),
    settings.acrossPropertiesWithError<Record<string, unknown>>(db, ids, 'services', userId),
  ]);
  if (rowsRes.error || conf.error) return fail('Το σύνολο του ΕΝΦΙΑ δεν γράφτηκε: τα υπάρχοντα ποσά δεν διαβάστηκαν.');

  const sets: SettingsTotal[] = Object.entries(conf.data).map(([propertyId, data]) => ({ propertyId, data: data ?? {} }));
  const plan = planStatement(year, total, rowsRes.rows, sets, target);
  let documentId: string | null = null;
  if (plan.insertOn) {
    const ins = await documents.add(db, plan.insertOn, userId, statementDocRow(year, total, docDate));
    if (ins.error) return fail('Το σύνολο του ΕΝΦΙΑ δεν γράφτηκε στο Αρχείο.');
    documentId = ins.id;
  }
  for (const u of plan.docUpdates) {
    const res = await documents.update(db, [u.id], { amount: u.amount });
    if (res.error) return { result: 'updated', documentId, replaced: plan.replaced, error: 'Ένα παλιό σύνολο ΕΝΦΙΑ του ίδιου έτους δεν αντικαταστάθηκε.' };
  }
  for (const s of plan.settingsUpdates) {
    const res = await settings.put(db, s.propertyId, userId, 'services', s.data);
    if (res.error) return { result: 'updated', documentId, replaced: plan.replaced, error: 'Το «Σύνολο εκκαθαριστικού» του Υπολογισμού ΕΝΦΙΑ δεν ενημερώθηκε.' };
  }
  const result = plan.insertOn ? 'inserted' : plan.replaced.length ? 'updated' : 'same';
  return { result, documentId, replaced: plan.replaced, error: null };
}

/** Γράφει όσα επιβεβαίωσε ο χρήστης. */
export async function commitImport(db: SupabaseClient, input: CommitInput): Promise<CommitOutcome> {
  const reserved = await db.from(TABLE)
    .insert({ user_id: input.userId, kind: 'enfia_act', tax_year: input.year, found_count: input.foundCount })
    .select('id').single();
  if (reserved.error) return { ok: false, reason: reserved.error.code === '54000' || /MYAADE_DAILY_LIMIT/.test(reserved.error.message ?? '') ? 'daily_limit' : 'failed' };
  const batchId = (reserved.data as { id?: string } | null)?.id;
  if (!batchId) return { ok: false, reason: 'failed' };

  const failures: string[] = [];
  const created: string[] = [];
  let filled = 0;
  let firstId: string | null = null;
  let limitHit = false;
  for (const r of input.rows) {
    if (r.existingId) {
      const cur = input.known.find(k => k.id === r.existingId);
      firstId ??= r.existingId;
      if (!cur) continue;
      const patch = fillOnlyEmpty(cur, r);
      if (!Object.keys(patch).length) continue;
      const res = await properties.update(db, r.existingId, patch, input.userId);
      if (res.error) failures.push(`Τα κενά του «${cur.name}» δεν συμπληρώθηκαν.`); else filled++;
      continue;
    }
    if (limitHit) { failures.push(`Το «${r.name}» δεν προστέθηκε: το πακέτο δεν χωρά άλλο ακίνητο.`); continue; }
    const res = await properties.add(db, newPropertyRow(input.userId, r, input.clientId ?? null));
    if (res.error || !res.data) {
      limitHit = isPropertyLimit(res.error);
      failures.push(limitHit ? `Το «${r.name}» δεν προστέθηκε: το πακέτο δεν χωρά άλλο ακίνητο.` : `Το «${r.name}» δεν προστέθηκε.`);
      continue;
    }
    created.push(res.data.id);
    firstId ??= res.data.id;
  }

  let statement: 'inserted' | 'updated' | 'same' | 'none' = 'none';
  let documentId: string | null = null;
  let replaced: Replaced[] = [];
  if (input.year && input.total && input.total > 0 && firstId) {
    const s = await writeStatement(db, input.userId, input.year, input.total, firstId, input.docDate);
    statement = s.result; documentId = s.documentId; replaced = s.replaced;
    if (s.error) failures.push(s.error);
  }

  const rec = await db.from(TABLE).update({ created_property_ids: created, document_id: documentId, replaced }).eq('id', batchId);
  if (rec.error) failures.push('Η εισαγωγή δεν καταγράφηκε για αναίρεση· τα στοιχεία της αποθηκεύτηκαν.');

  // Με αναμονή: η επόμενη οθόνη δείχνει ήδη τις δόσεις με τα ποσά τους.
  const sync = await syncOwnerTaxDeadlines(db, input.userId);
  if (sync.error) failures.push('Οι προθεσμίες θα ενημερωθούν στον επόμενο συγχρονισμό.');

  return { ok: true, batchId, created, filled, statement, failures };
}

// ── Η ΑΝΑΙΡΕΣΗ ──────────────────────────────────────────────────────────────

export interface ImportBatch {
  id: string;
  created_at: string;
  undone_at: string | null;
  tax_year: number | null;
  created_property_ids: string[];
  document_id: string | null;
  replaced: Replaced[];
}

const BATCH_COLUMNS = 'id,created_at,undone_at,tax_year,created_property_ids,document_id,replaced';

/** Μέσα στο παράθυρο αναίρεσης; Καθαρή συνάρτηση· η βάση το ξαναελέγχει. */
export const canUndoImport = (createdAt: string, undoneAt: string | null, now: Date = new Date()): boolean =>
  !undoneAt && now.getTime() - new Date(createdAt).getTime() <= IMPORT_UNDO_HOURS * 3_600_000;

/** Ως πότε αναιρείται μια εισαγωγή, σε ώρα Ελλάδας: «dd/mm/yyyy HH:MM». */
export function undoUntilLabel(createdAt: string): string {
  const end = new Date(new Date(createdAt).getTime() + IMPORT_UNDO_HOURS * 3_600_000);
  return `${grDate(athensToday(end))} ${athensTime(end)}`;
}

/** Η τελευταία εισαγωγή που αναιρείται ακόμη, αν υπάρχει. */
export async function lastUndoable(db: SupabaseClient, userId: string, now: Date = new Date()): Promise<ImportBatch | null> {
  const since = new Date(now.getTime() - IMPORT_UNDO_HOURS * 3_600_000).toISOString();
  const res = await read<ImportBatch>(db.from(TABLE).select(BATCH_COLUMNS).eq('user_id', userId)
    .is('undone_at', null).gt('created_at', since).order('created_at', { ascending: false }).limit(1));
  const b = res.rows[0];
  return b && (b.created_property_ids.length || b.document_id || b.replaced.length) ? b : null;
}

/** Πόσες εισαγωγές μένουν στις τρέχουσες 24 ώρες. `null` όταν η μέτρηση απέτυχε. */
export async function importsLeft(db: SupabaseClient, userId: string, now: Date = new Date()): Promise<number | null> {
  const since = new Date(now.getTime() - 24 * 3_600_000).toISOString();
  const { count, error } = await db.from(TABLE).select('id', { count: 'exact', head: true }).eq('user_id', userId).gt('created_at', since);
  return error ? null : Math.max(0, MYAADE_DAILY_IMPORTS - (count ?? 0));
}

/** Ακίνητο που ο χρήστης έχει ήδη δουλέψει: δεν σβήνεται στην αναίρεση. */
async function touched(db: SupabaseClient, propertyId: string, ownDoc: string | null): Promise<boolean> {
  const counts = await Promise.all([
    expenses.countOfProperty(db, propertyId), tenants.countOfProperty(db, propertyId),
    bills.countOfProperty(db, propertyId), documents.countExcept(db, propertyId, ownDoc),
  ]);
  // Αμφιβολία = το ακίνητο μένει. Μια μέτρηση που απέτυχε δεν σημαίνει «άδειο».
  return counts.some(n => n === null || n > 0);
}

export type UndoOutcome =
  | { ok: true; removed: number; kept: number }
  | { ok: false; reason: 'expired' | 'failed' };

/** Αναιρεί μια εισαγωγή: σβήνει ό,τι δημιούργησε και δεν άγγιξε κανείς, επιστρέφει τα ποσά. */
export async function undoImport(db: SupabaseClient, userId: string, batch: ImportBatch, now: Date = new Date()): Promise<UndoOutcome> {
  if (!canUndoImport(batch.created_at, batch.undone_at, now)) return { ok: false, reason: 'expired' };
  // ΠΡΩΤΑ η σήμανση: η πολιτική της βάσης κλείνει στις 24 ώρες, οπότε αν δεν
  // περάσει εδώ δεν σβήνεται τίποτα.
  const mark = await db.from(TABLE).update({ undone_at: now.toISOString() }).eq('id', batch.id).is('undone_at', null).select('id');
  if (mark.error) return { ok: false, reason: 'failed' };
  if (!(mark.data as unknown[] | null)?.length) return { ok: false, reason: 'expired' };

  let removed = 0, kept = 0;
  for (const id of batch.created_property_ids) {
    if (await touched(db, id, batch.document_id)) { kept++; continue; }
    const res = await properties.remove(db, id, userId);
    if (res.error) kept++; else removed++;
  }
  if (batch.document_id) await documents.remove(db, batch.document_id);
  for (const r of batch.replaced) {
    if (r.t === 'doc') await documents.update(db, [r.id], { amount: r.amount });
    else {
      const cur = await settings.sectionWithError<Record<string, unknown>>(db, r.property_id, 'services', userId);
      if (!cur.error && cur.data) await settings.put(db, r.property_id, userId, 'services', { ...cur.data, enfiaStatementTotal: r.total, enfiaStatementYear: r.year });
    }
  }
  await syncOwnerTaxDeadlines(db, userId);
  return { ok: true, removed, kept };
}
