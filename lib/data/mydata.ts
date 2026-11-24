// ═══════════════════════════════════════════════════════════════════════════
// myDATA ΜΕΣΩ ΛΟΓΙΣΤΗ: ΟΙ ΚΛΗΣΕΙΣ ΤΗΣ ΕΦΑΡΜΟΓΗΣ ΕΧΟΥΝ ΕΝΑ ΣΠΙΤΙ
// ─────────────────────────────────────────────────────────────────────────
// Η κάρτα του λογιστή, η γραμμή του πελάτη και τα Εισερχόμενα καλούν από εδώ.
// Ολα τα γραψίματα περνούν από συναρτήσεις της βάσης που κρίνουν μόνες τους
// ποιος ρωτά (20261123100000)· η εφαρμογή δεν γράφει ποτέ απευθείας στους
// πίνακες myDATA. Το κλειδί του λογιστή περνά μία φορά προς τη συνάρτηση
// άκρου και δεν επιστρέφει ποτέ.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbError } from '@/lib/supabase/writeResult';
import type { MydataDocsRow } from '@/lib/supabase/tables';
import { row as expenseRow, addRow, idByDedup } from './expenses';
import type { ClientRow, Connection } from '@/lib/mydata/status';
import { MYDATA_CONSENT_VERSION, MYDATA_CONSENT_HASH } from '@/lib/mydata/consentText';

export type Db = SupabaseClient;

const FN = 'mydata-sync';

/** Η σύνδεση του λογιστή, χωρίς κανένα μυστικό (δεν υπάρχει στον πίνακα). */
export const CONNECTION_COLUMNS = 'aade_user_id,has_key,status,last_sync_at,last_sync_new,last_error_code,lease_id,lease_at,last_manual_at';

export async function connection(db: Db, accountantId: string): Promise<{ data: Connection | null; error: DbError | null }> {
  const { data, error } = await db.from('mydata_connections').select(CONNECTION_COLUMNS).eq('accountant_id', accountantId).maybeSingle();
  return { data: (data as Connection | null) ?? null, error: error as DbError | null };
}

/**
 * Ο πίνακας του λογιστή: όλοι οι συνδεδεμένοι πελάτες, με την κατάσταση της
 * άδειας. `secondStep`: η βάση ζητά δεύτερο βήμα ταυτοποίησης (κάθε ενέργεια
 * myDATA του λογιστή το θέλει, θωράκιση 24/11/2026).
 */
export async function clientsStatus(db: Db): Promise<{ rows: ClientRow[]; error: DbError | null; secondStep: boolean }> {
  const { data, error } = await db.rpc('mydata_clients_status');
  return { rows: Array.isArray(data) ? data as ClientRow[] : [], error: error as DbError | null, secondStep: (error as DbError | null)?.code === '42501' };
}

interface FnAnswer { ok?: boolean; reason?: string; verified?: boolean; retryAt?: string | null; added?: number; failed?: number; partial?: boolean }

async function invoke(db: Db, body: Record<string, unknown>): Promise<FnAnswer> {
  const { data, error } = await db.functions.invoke(FN, { body });
  if (data && typeof data === 'object') return data as FnAnswer;
  // Οι μη-2xx απαντήσεις φτάνουν ως σφάλμα· το σώμα τους κρατά τον κωδικό.
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try { return await ctx.json() as FnAnswer; } catch { /* σώμα χωρίς JSON */ }
  }
  return { ok: false, reason: 'network' };
}

/** «Σύνδεση»: η συνάρτηση δοκιμάζει το κλειδί στην ΑΑΔΕ και το φυλάει στο Vault. */
export function connect(db: Db, aadeUserId: string, subscriptionKey: string): Promise<FnAnswer> {
  return invoke(db, { action: 'connect', aadeUserId: aadeUserId.trim(), key: subscriptionKey.trim() });
}

/** «Συγχρονισμός τώρα» (manual) ή ο αυτόματος των 12 ωρών (auto). */
export function sync(db: Db, kind: 'manual' | 'auto'): Promise<FnAnswer> {
  return invoke(db, { action: 'sync', kind });
}

/**
 * «Επιβεβαίωση ΑΦΜ»: ο λογιστής γράφει το ΑΦΜ του πελάτη όπως το ξέρει. Η βάση
 * δεν λέει αν συμφωνεί με το προφίλ του πελάτη· η άδεια το ελέγχει.
 */
export async function confirmAfm(db: Db, ownerId: string, afm: string): Promise<{ ok: boolean; reason?: string; error: DbError | null }> {
  const { data, error } = await db.rpc('mydata_confirm_afm', { p_owner: ownerId, p_afm: afm.trim() });
  const r = data as { ok?: boolean; reason?: string } | null;
  return { ok: !error && r?.ok === true, reason: r?.reason, error: error as DbError | null };
}

/** «Αφαίρεση κλειδιού». Το μυστικό σβήνει και από το Vault. */
export async function removeKey(db: Db): Promise<{ ok: boolean; error: DbError | null }> {
  const { data, error } = await db.rpc('mydata_key_remove');
  return { ok: !error && (data as { ok?: boolean } | null)?.ok === true, error: error as DbError | null };
}

// ── Η πλευρά του πελάτη ────────────────────────────────────────────────────

export interface MyConsent {
  accountantId: string;
  windowFrom: string;
  grantedAt: string;
  status: 'pending' | 'ok' | 'forbidden' | 'error' | 'paused';
  lastSyncAt: string | null;
  lastNew: number;
  error: string | null;
  nextRetryAt: string | null;
}

export async function myConsent(db: Db): Promise<{ data: MyConsent | null; error: DbError | null }> {
  const { data, error } = await db.rpc('mydata_my_consent');
  return { data: (data as MyConsent | null) ?? null, error: error as DbError | null };
}

/**
 * «Επιτρέπω», με την έκδοση και το αποτύπωμα του κειμένου που έδειξε η οθόνη
 * (lib/mydata/consentText.ts) και το ρητό τικ για πιθανά δεδομένα υγείας. Με
 * ενεργή άδεια σε άλλον λογιστή η βάση απαντά `switch_confirm` και το πλήθος
 * όσων θα σβήσουν· η αλλαγή γίνεται μόνο με `switchConfirmed`.
 */
export async function grant(
  db: Db, accountantId: string, fromYear: number, opts: { health: boolean; switchConfirmed?: boolean },
): Promise<{ ok: boolean; reason?: string; pending: number; deleted: number; error: DbError | null }> {
  const { data, error } = await db.rpc('mydata_consent_grant', {
    p_accountant: accountantId, p_from_year: fromYear,
    p_text_version: MYDATA_CONSENT_VERSION, p_text_hash: MYDATA_CONSENT_HASH,
    p_health: opts.health, p_switch: opts.switchConfirmed === true,
  });
  const r = data as { ok?: boolean; reason?: string; pending?: number; deleted?: number } | null;
  return { ok: !error && r?.ok === true, reason: r?.reason, pending: Number(r?.pending ?? 0), deleted: Number(r?.deleted ?? 0), error: error as DbError | null };
}

export async function revoke(db: Db, accountantId: string): Promise<{ ok: boolean; deleted: number; error: DbError | null }> {
  const { data, error } = await db.rpc('mydata_consent_revoke', { p_accountant: accountantId });
  const r = data as { ok?: boolean; deleted?: number } | null;
  return { ok: !error && r?.ok === true, deleted: Number(r?.deleted ?? 0), error: error as DbError | null };
}

export interface LogRow { at: string; action: string; n: number | null }

/** Το ιστορικό πρόσβασης που βλέπει ο πελάτης: τα τελευταία, πιο πρόσφατα πρώτα. */
export async function accessLog(db: Db, clientId: string, limit = 8): Promise<{ rows: LogRow[]; error: DbError | null }> {
  const { data, error } = await db.from('mydata_access_log').select('at,action,n')
    .eq('client_id', clientId).order('at', { ascending: false }).limit(limit);
  return { rows: (data as LogRow[] | null) ?? [], error: error as DbError | null };
}

// ── Τα Εισερχόμενα: «Για έλεγχο» ──────────────────────────────────────────

export const DOC_COLUMNS = 'id,mark,counterpart_afm,counterpart_name,doc_type,issue_date,title,net_cents,vat_cents,gross_cents,is_credit,tier,category,review_reasons,needs_attention';
// Το `id` έχει προεπιλογή στη βάση, άρα ο παραγόμενος τύπος το δηλώνει κενό·
// σε γραμμή που διαβάστηκε υπάρχει πάντα.
// Α2: `tier`, `category` (προσυμπληρωμένη) και `review_reasons` (κωδικοί) τα
// γράφει ο συγχρονισμός· σε παλιές γραμμές είναι κενά.
// Θωράκιση: τα πεδία του εκδότη και τα ποσά είναι κενά ΜΟΝΟ σε απορριφθέν
// (ελαχιστοποίηση· κανόνας `mydata_docs_fields_or_minimized`). Οσα διαβάζει η
// οθόνη (εκκρεμή, αυτόματα, ακυρωμένα) τα έχουν πάντα.
type Filled = 'counterpart_afm' | 'doc_type' | 'issue_date' | 'title' | 'net_cents' | 'vat_cents' | 'gross_cents';
export type PendingDoc = { id: string } & { [K in Filled]: NonNullable<MydataDocsRow[K]> }
  & Pick<MydataDocsRow, 'mark' | 'counterpart_name' | 'is_credit'>
  & Partial<Pick<MydataDocsRow, 'tier' | 'category' | 'review_reasons' | 'needs_attention'>>;

export async function pendingDocs(db: Db, clientId: string, limit = 50): Promise<{ rows: PendingDoc[]; error: DbError | null }> {
  const { data, error } = await db.from('mydata_docs').select(DOC_COLUMNS)
    .eq('client_id', clientId).eq('status', 'pending').order('issue_date', { ascending: false }).limit(limit);
  return { rows: (data as PendingDoc[] | null) ?? [], error: error as DbError | null };
}

/** Το αποτύπωμα της δαπάνης που γεννά ένα παραστατικό: ένα ανά ΜΑΡΚ. */
export const dedupOf = (mark: number | string): string => `mydata:${mark}`;

/**
 * Η πληρωμή, όπως την είπε ο χρήστης στο «Πώς πληρώθηκε;» (lib/mydata/review.ts,
 * `paymentFields`). Η ημερομηνία πληρωμής είναι μόνο ό,τι έγραψε ο ίδιος.
 */
export interface Payment { paid: boolean; payment_method: string | null; paid_on: string | null }

/**
 * Η δαπάνη από το παραστατικό, με τα ποσά ΟΠΩΣ ΤΑ ΕΔΩΣΕ Η ΑΑΔΕ: μικτό και
 * ΦΠΑ από τα λεπτά της βάσης, με πρόσημο για το πιστωτικό. Η οθόνη δεν δίνει
 * ποσό: δίνει μόνο ακίνητο, κατηγορία και, όπου ρωτά, πώς πληρώθηκε. Η
 * ημερομηνία της δαπάνης είναι της έκδοσης· της πληρωμής μένει κενή αν δεν
 * τη γράψει ο χρήστης (θωράκιση 24/11/2026, Μ7 λογιστικού ελέγχου).
 */
export function expenseFromDoc(d: PendingDoc, scope: { propertyId: string; userId: string }, category: string, vendorLabel: string, payment?: Payment) {
  const sign = d.is_credit ? -1 : 1;
  return {
    ...expenseRow(scope, {
      description: d.title,
      amount: (sign * Number(d.gross_cents)) / 100,
      category,
      date: d.issue_date,
      paid: payment?.paid === true,
      payment_method: payment?.paid ? payment.payment_method : null,
      store_vendor: vendorLabel,
      supplier_afm: /^\d{9}$/.test(d.counterpart_afm) ? d.counterpart_afm : null,
      notes: `myDATA · ΜΑΡΚ ${d.mark}`,
    }),
    vat_amount: (sign * Number(d.vat_cents)) / 100,
    paid_on: payment?.paid ? payment.paid_on : null,
    dedup_hash: dedupOf(d.mark),
  };
}

export interface FileOutcome { expenseId: string | null; error: DbError | null; linked: boolean }

/**
 * Καταχώρηση με ένα πάτημα. Πρώτα η δαπάνη (με την RLS των δαπανών), μετά το
 * δέσιμο, που η βάση το κάνει μόνο αν τα ποσά είναι ακριβώς της ΑΑΔΕ. Αν η
 * δαπάνη υπήρχε ήδη (δεύτερο πάτημα, δεύτερη καρτέλα), δένεται αυτή.
 */
export async function fileDoc(
  db: Db, d: PendingDoc, scope: { propertyId: string; userId: string }, category: string, vendorLabel: string,
  opts: { slug?: string; payment?: Payment } = {},
): Promise<FileOutcome> {
  const row = expenseFromDoc(d, scope, category, vendorLabel, opts.payment);
  let expenseId: string | null = null;
  const { data, error } = await addRow(db, row);
  if (error && error.code !== '23505') return { expenseId: null, error: error as DbError, linked: false };
  if (data?.id) expenseId = data.id;
  else {
    const found = await idByDedup(db, scope.userId, row.dedup_hash);
    if (found.error || !found.id) return { expenseId: null, error: found.error, linked: false };
    expenseId = found.id;
  }
  // Η κατηγορία (slug) μένει στο παραστατικό: το επόμενο του ίδιου παρόχου έρχεται με αυτήν.
  const { data: link, error: linkError } = await db.rpc('mydata_doc_filed', { p_doc: d.id, p_expense: expenseId, p_category: opts.slug ?? null });
  const linked = !linkError && (link as { ok?: boolean } | null)?.ok === true;
  return { expenseId, error: (linkError as DbError) ?? null, linked };
}

/** Η δαπάνη που ο χρήστης έχει ήδη περάσει μόνος του και μοιάζει με αυτό το παραστατικό. */
export interface MatchCandidate { expenseId: string; description: string; amount: number; date: string; vendor: string | null }

/** «Είναι η ίδια με …;»: η βάση ψάχνει με τον ανεκτικό κανόνα (20261124100000, §4). */
export async function matchDoc(db: Db, docId: string, propertyId: string | null, label: string): Promise<{ data: MatchCandidate | null; error: DbError | null }> {
  const { data, error } = await db.rpc('mydata_doc_match', { p_doc: docId, p_property: propertyId, p_label: label });
  return { data: (data as MatchCandidate | null) ?? null, error: error as DbError | null };
}

/** «Είναι η ίδια»: δένει το παραστατικό με τη δαπάνη, αφού η βάση την ξαναελέγξει. */
export async function linkDoc(db: Db, docId: string, expenseId: string, propertyId: string | null, label: string): Promise<{ ok: boolean; error: DbError | null }> {
  const { data, error } = await db.rpc('mydata_doc_link', { p_doc: docId, p_expense: expenseId, p_property: propertyId, p_label: label });
  return { ok: !error && (data as { ok?: boolean } | null)?.ok === true, error: error as DbError | null };
}

/** «Δεν αφορά ακίνητο». Η βάση σβήνει αμέσως εκδότη, ποσά και ημερομηνία· μένει ο ΜΑΡΚ. */
export async function dismissDoc(db: Db, id: string): Promise<{ error: DbError | null }> {
  const { error } = await db.rpc('mydata_doc_dismiss', { p_doc: id });
  return { error: error as DbError | null };
}

/**
 * Ακυρώσεις από τον εκδότη για παραστατικά που ο χρήστης είχε ήδη καταχωρήσει
 * (`cancelled_after_filing`) ή δέσει με δαπάνη που πέρασε ο ίδιος
 * (`cancelled_linked`). Καμία δαπάνη δεν σβήστηκε: περιμένει την απόφασή του.
 */
export async function attentionDocs(db: Db, clientId: string): Promise<{ rows: PendingDoc[]; error: DbError | null }> {
  const { data, error } = await db.from('mydata_docs').select(DOC_COLUMNS)
    .eq('client_id', clientId).in('needs_attention', ['cancelled_after_filing', 'cancelled_linked']).order('issue_date', { ascending: false }).limit(20);
  return { rows: (data as PendingDoc[] | null) ?? [], error: error as DbError | null };
}

/** «Σβήσε τη δαπάνη» (remove) ή «Κράτησέ τη». Σβήνει μόνο τη δαπάνη που γέννησε αυτό το παραστατικό. */
export async function cancelAck(db: Db, docId: string, remove: boolean): Promise<{ ok: boolean; error: DbError | null }> {
  const { data, error } = await db.rpc('mydata_cancel_ack', { p_doc: docId, p_remove: remove });
  return { ok: !error && (data as { ok?: boolean } | null)?.ok === true, error: error as DbError | null };
}

export async function ignoreProvider(db: Db, counterpartAfm: string): Promise<{ dismissed: number; error: DbError | null }> {
  const { data, error } = await db.rpc('mydata_ignore_provider', { p_afm: counterpartAfm });
  return { dismissed: Number((data as { dismissed?: number } | null)?.dismissed ?? 0), error: error as DbError | null };
}

// ── Α2: ό,τι μπήκε μόνο του και ό,τι δεν αφορά ακίνητα ───────────────────────

/** Οσα καταχωρήθηκαν χωρίς πάτημα τις τελευταίες `days` ημέρες, πιο πρόσφατα πρώτα. */
export async function autoDocs(db: Db, clientId: string, days = 30, now: Date = new Date()): Promise<{ rows: PendingDoc[]; error: DbError | null }> {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const { data, error } = await db.from('mydata_docs').select(DOC_COLUMNS)
    .eq('client_id', clientId).eq('filed_by', 'auto').eq('status', 'filed').gte('decided_at', since)
    .order('decided_at', { ascending: false }).limit(20);
  return { rows: (data as PendingDoc[] | null) ?? [], error: error as DbError | null };
}

/** «Αναίρεση»: σβήνει μόνο τη δαπάνη του ίδιου ΜΑΡΚ, το παραστατικό ξαναγίνεται «Για έλεγχο». */
export async function undoAuto(db: Db, docId: string): Promise<{ ok: boolean; error: DbError | null }> {
  const { data, error } = await db.rpc('mydata_auto_undo', { p_doc: docId });
  return { ok: !error && (data as { ok?: boolean } | null)?.ok === true, error: error as DbError | null };
}

/** Πόσα παραστατικά δεν αφορούσαν ακίνητα και δεν κρατήθηκαν (μόνο το πλήθος υπάρχει). */
export async function notPropertyCount(db: Db, clientId: string): Promise<{ n: number; error: DbError | null }> {
  const { data, error } = await db.from('mydata_consents').select('not_property')
    .eq('client_id', clientId).is('revoked_at', null).maybeSingle();
  return { n: Number((data as { not_property?: number } | null)?.not_property ?? 0), error: error as DbError | null };
}
