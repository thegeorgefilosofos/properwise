// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΛΟΓΙΣΤΙΚΑ ΓΡΑΦΕΙΑ — ΤΟ ΣΤΡΩΜΑ ΔΕΔΟΜΕΝΩΝ
// ─────────────────────────────────────────────────────────────────────────
// Κάθε κίνηση του γραφείου περνά από συνάρτηση της βάσης που ελέγχει ρόλο,
// ανάθεση και επίπεδο (supabase/migrations/20261104120000, 20261104130000,
// 20261104150000). Το token του ιδιοκτήτη δεν περνά ποτέ από εδώ.
// Εδώ ζει η μία πλευρά αυτής της συνομιλίας: τα σχήματα των απαντήσεων, οι
// λέξεις των ρόλων και των επιπέδων και οι κανόνες που κρίνουν τι δείχνεται.
//
// ΟΙ ΛΕΞΕΙΣ ΓΡΑΦΟΝΤΑΙ ΜΙΑ ΦΟΡΑ. «Υπεύθυνος γραφείου», «Λογιστής», «Συνεργάτης»
// εμφανίζονται στο dropdown, στη λίστα μελών, στην οθόνη του ιδιοκτήτη και στο
// ιστορικό· τέσσερις γραφές θα απέκλιναν την πρώτη φορά που άλλαζε μία.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import { FIRM_TERMS_VERSION, FIRM_UNDO_DAYS } from '@/lib/legal/firms';
import { athensToday } from '@/lib/core/time';

type Db = SupabaseClient;

// ── ΟΙ ΛΕΞΕΙΣ ──────────────────────────────────────────────────────────────
import type { FirmKind } from './firmWords';
import type { FirmRole } from './firmRoles';
export { KIND_LABEL, type FirmKind } from './firmWords';
export { ROLE_LABEL, type FirmRole } from './firmRoles';
export type AccessLevel = 'read' | 'upload' | 'keep';

/** Μία πρόταση ανά ρόλο, για το dropdown της πρόσκλησης: τι κάνει, όχι τι είναι. */
export const ROLE_HINT: Record<FirmRole, string> = {
  manager: 'Όλοι οι πελάτες, μέλη και αναθέσεις.',
  accountant: 'Οι πελάτες που του ανατίθενται.',
  associate: 'Οι πελάτες που του ανατίθενται, μόνο ανάγνωση.',
};

export const ROLES: FirmRole[] = ['manager', 'accountant', 'associate'];

export const LEVEL_LABEL: Record<AccessLevel, string> = {
  read: 'Μόνο ανάγνωση',
  upload: 'Ανέβασμα παραστατικών',
  keep: 'Τήρηση για λογαριασμό μου',
};

/** Τι σημαίνει κάθε επίπεδο, όπως το διαβάζει ο ιδιοκτήτης πριν το διαλέξει. */
export const LEVEL_HINT: Record<AccessLevel, string> = {
  read: 'Το γραφείο βλέπει τα στοιχεία σου. Δεν γράφει τίποτα.',
  upload: 'Το γραφείο ανεβάζει παραστατικά στα ακίνητά σου. Την καταχώρηση την επιβεβαιώνεις εσύ.',
  keep: 'Το γραφείο καταχωρεί πληρωμές, εισπράξεις, μισθωτές και παραστατικά στα ακίνητά σου. Ακίνητα, ρυθμίσεις και χρέωση μένουν σε σένα.',
};

export const LEVELS: AccessLevel[] = ['read', 'upload', 'keep'];

/** Η φράση όπου ένα σημείο θα οδηγούσε σε καταχώρηση ακινήτου από λογαριασμό γραφείου. */
export const FIRM_NO_PROPERTIES = 'Ο λογαριασμός γραφείου βλέπει τους πελάτες του. Ακίνητα καταχωρεί ο ιδιοκτήτης.';

// ── ΤΑ ΣΧΗΜΑΤΑ ─────────────────────────────────────────────────────────────
export interface FirmMember {
  id: string;
  userId: string | null;
  email: string;
  role: FirmRole;
  status: 'invited' | 'active';
  name: string | null;
  invitedAt: string;
  joinedAt: string | null;
  clients: number;
}

export interface Firm {
  id: string;
  name: string;
  afm: string | null;
  kind: FirmKind;
  phone: string | null;
  address: string | null;
  role: FirmRole;
  firmOnly: boolean;
  /** Η έκδοση των όρων που αποδέχτηκε το γραφείο (ο Υπεύθυνος) και το μέλος (20261108090000). */
  termsVersion: string | null;
  myTermsVersion: string | null;
  members: FirmMember[];
}

export interface FirmInvite { id: string; firmName: string; role: FirmRole; invitedAt: string }

export interface ClientLevel { ownerId: string; level: AccessLevel; mine: boolean; myLevel: AccessLevel | null }

export interface AccessEntry { at: string; action: string; ownerId: string; member: string; owner: string }

export interface OwnerFirm {
  accountantId: string;
  name: string;
  linkedAt: string;
  firmId: string | null;
  firmName: string | null;
  firmKind: FirmKind | null;
  accessLevel: AccessLevel;
  members: { userId: string; name: string; role: FirmRole }[];
  lastOpenedAt: string | null;
}

export interface FirmDay { firmId: string; firmName: string; total: number; counts: Partial<Record<RecordKind, number>> }

export type RecordKind = 'document' | 'tenant' | 'bill' | 'rent' | 'expense' | 'event';

export interface OpenItem { kind: 'bill' | 'rent' | 'event'; id: string; propertyId: string; property: string; name: string; amount: number; due: string }

export interface ClientProperty { id: string; name: string; hasLoan: boolean }

// ── ΟΙ ΚΛΗΣΕΙΣ ─────────────────────────────────────────────────────────────
/** «Δεν διαβάστηκε» δεν είναι «δεν υπάρχει»: το `failed` το κρατά χωριστό. */
// Το `secondStep` ξεχωρίζει την άρνηση «λείπει το δεύτερο βήμα» (20261104150000):
// η οθόνη τότε ζητά συσκευή αντί να πει «δεν διαβάστηκε».
type Read<T> = { ok: true; data: T } | { ok: false; secondStep?: boolean };

async function rpcRead<T>(db: Db, fn: string, args?: Record<string, unknown>): Promise<Read<T>> {
  const { data, error } = await db.rpc(fn, args);
  if (error) return { ok: false, secondStep: reasonOf(error.message) === 'mfa_required' };
  return { ok: true, data: data as T };
}

type Done = { ok: true; data?: Record<string, unknown> } | { ok: false; reason: string };

async function rpcDo(db: Db, fn: string, args: Record<string, unknown>): Promise<Done> {
  const { data, error } = await db.rpc(fn, args);
  if (error) return { ok: false, reason: reasonOf(error.message) };
  const d = (data ?? {}) as Record<string, unknown>;
  if (d.ok === false) return { ok: false, reason: String(d.reason ?? 'error') };
  return { ok: true, data: d };
}

/** Το `firm_record:property` του σφάλματος γίνεται `property`. */
export function reasonOf(message: string | undefined): string {
  const m = /firm_record:([a-z_]+)/.exec(message ?? '');
  if (m) return m[1];
  if (/mfa_required/.test(message ?? '')) return 'mfa_required';
  if (/firm_account/.test(message ?? '')) return 'firm_account';
  return 'error';
}

export const myFirm = (db: Db) => rpcRead<Firm | null>(db, 'my_firm');
export const myFirmInvites = async (db: Db): Promise<FirmInvite[]> => {
  const r = await rpcRead<FirmInvite[]>(db, 'my_firm_invites');
  return r.ok && Array.isArray(r.data) ? r.data : [];
};
export const clientLevels = async (db: Db): Promise<Read<ClientLevel[]>> => {
  const r = await rpcRead<ClientLevel[]>(db, 'firm_client_levels');
  return r.ok ? { ok: true, data: Array.isArray(r.data) ? r.data : [] } : r;
};
export const accessHistory = async (db: Db, limit = 200): Promise<Read<AccessEntry[]>> => {
  const r = await rpcRead<AccessEntry[]>(db, 'firm_access_history', { p_limit: limit });
  return r.ok ? { ok: true, data: Array.isArray(r.data) ? r.data : [] } : r;
};

export interface FirmFields { name: string; afm: string; kind: FirmKind; phone: string; address: string }
export const saveFirm = (db: Db, f: FirmFields) =>
  rpcDo(db, 'firm_save', { p_name: f.name, p_afm: f.afm, p_kind: f.kind, p_phone: f.phone, p_address: f.address });
export const invite = (db: Db, email: string, role: FirmRole) => rpcDo(db, 'firm_invite', { p_email: email, p_role: role });
/**
 * ΤΟ EMAIL ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ, ΜΕΤΑ ΤΗΝ ΠΡΟΣΚΛΗΣΗ (supabase/functions/send-firm-invite).
 *
 * Η `firm_invite` γράφει μόνο τη γραμμή· μήνυμα δεν έφευγε ποτέ, ενώ η οθόνη
 * έγραφε «Η πρόσκληση στάλθηκε.». Η συνάρτηση ξαναελέγχει στη βάση ότι ο
 * καλών είναι Υπεύθυνος και ότι η διεύθυνση είναι εκκρεμής πρόσκληση του
 * γραφείου του. Εδώ λέγεται μόνο αν έφυγε μήνυμα: η πρόσκληση υπάρχει ήδη,
 * οπότε κάθε αποτυχία (δίκτυο, όριο, πάροχος) είναι απλώς «δεν στάλθηκε».
 */
export type InviteMail = 'sent' | 'failed' | 'off';
export async function sendInviteEmail(db: Db, email: string): Promise<InviteMail> {
  try {
    const { data, error } = await db.functions.invoke('send-firm-invite', { body: { email } });
    if (error) {
      // Η συνάρτηση λέει `no_resend_key` (500, όπως οι αδελφές της) όταν η εγκατάσταση δεν έχει πάροχο
      // email. Κάθε άλλη άρνηση (δίκτυο, όριο, πάροχος, 404) είναι «δεν στάλθηκε».
      const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
      const body = typeof ctx?.json === 'function' ? await ctx.json().catch(() => null) : null;
      return (body as { error?: string } | null)?.error === 'no_resend_key' ? 'off' : 'failed';
    }
    return (data as { sent?: boolean } | null)?.sent === true ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

/**
 * Τι λέει η οθόνη μετά την «Αποστολή». «Στάλθηκε email» μόνο όταν όντως
 * στάλθηκε· αλλιώς η πρόσκληση καταχωρήθηκε και το μέλος συνδέεται στην πύλη
 * (`portal`, π.χ. «properwise.gr/accountant/workspace») με αυτή τη διεύθυνση.
 * `member`: η διεύθυνση ανήκει ήδη σε ενεργό μέλος, οπότε δεν στέλνεται τίποτα.
 */
export function inviteOutcome(o: { existing: boolean; member: boolean; mail: InviteMail | null; email: string; portal: string }): string {
  if (o.member) return 'Η διεύθυνση ανήκει ήδη σε μέλος του γραφείου.';
  const first = o.existing ? 'Η διεύθυνση είχε ήδη πρόσκληση.' : 'Η πρόσκληση καταχωρήθηκε.';
  if (o.mail === 'sent') return `${first} ${o.existing ? 'Στάλθηκε ξανά' : 'Στάλθηκε'} email στο ${o.email}.`;
  const why = o.mail === 'off' ? 'Η αποστολή email δεν είναι ενεργή.' : 'Το email δεν στάλθηκε.';
  return `${first} ${why} Για να την αποδεχτεί, το μέλος συνδέεται στο ${o.portal} με τη διεύθυνση ${o.email}.`;
}
export const answerInvite = (db: Db, id: string, accept: boolean) => rpcDo(db, 'firm_invite_answer', { p_id: id, p_accept: accept });
/**
 * Αποδοχή των όρων επεξεργασίας (Οροι `#grafeia`) στην έκδοση που δείχνει η
 * οθόνη. Η βάση τη γράφει μόνο αν είναι η τρέχουσα· ως τότε δεν δείχνει πελάτη.
 */
export const acceptFirmTerms = (db: Db) => rpcDo(db, 'firm_accept_terms', { p_version: FIRM_TERMS_VERSION });

/** Τι λείπει για να δει το μέλος πελάτες: η δική του αποδοχή, του γραφείου ή τίποτα. */
export function termsGap(f: Pick<Firm, 'termsVersion' | 'myTermsVersion'> | null): 'mine' | 'firm' | null {
  if (!f) return null;
  if (f.myTermsVersion !== FIRM_TERMS_VERSION) return 'mine';
  if (f.termsVersion !== FIRM_TERMS_VERSION) return 'firm';
  return null;
}
export const setRole = (db: Db, memberId: string, role: FirmRole) => rpcDo(db, 'firm_member_update', { p_id: memberId, p_role: role, p_remove: false });
export const removeMember = (db: Db, memberId: string) => rpcDo(db, 'firm_member_update', { p_id: memberId, p_role: null, p_remove: true });
export const assign = (db: Db, owners: string[], userId: string, on: boolean) =>
  rpcDo(db, 'firm_assign', { p_owners: owners, p_user: userId, p_on: on });
/** Ο υπεύθυνος βγάζει πελάτη από τη λίστα του γραφείου (τακτοποίηση, όχι ανάκληση). */
export const dropFirmClient = (db: Db, ownerId: string) => rpcDo(db, 'firm_drop_client', { p_owner: ownerId });

// Οι καταχωρήσεις (20261104130000).
export const record = (db: Db, ownerId: string, propertyId: string, kind: Exclude<RecordKind, 'event'>, row: Record<string, unknown>) =>
  rpcDo(db, 'firm_record', { p_owner: ownerId, p_property: propertyId, p_kind: kind, p_row: row });
export const removeRecord = (db: Db, kind: Exclude<RecordKind, 'event'>, id: string) =>
  rpcDo(db, 'firm_record_delete', { p_kind: kind, p_id: id });

/**
 * Η «Αναίρεση» του μηνύματος, ολόκληρη: η γραμμή ΚΑΙ το αρχείο.
 *
 * Η `firm_record_delete` σβήνει μόνο τη γραμμή του παραστατικού και επιστρέφει
 * τη διαδρομή του αρχείου (`filePath`). Το αρχείο το είχε ανεβάσει το ίδιο το
 * μέλος· μόνο αυτό μπορεί να το σβήσει (property_files_firm_unupload).
 * Οσο η αναίρεση έσβηνε μόνο τη γραμμή, το PDF έμενε στον φάκελο του πελάτη,
 * αόρατο από την εφαρμογή και χωρίς τρόπο να βρεθεί ξανά.
 */
export async function undoRecord(db: Db, kind: Exclude<RecordKind, 'event'>, id: string): Promise<Done> {
  const r = await removeRecord(db, kind, id);
  if (!r.ok) return r;
  const path = r.data?.filePath;
  if (kind === 'document' && typeof path === 'string' && path) {
    await db.storage.from('property-files').remove([path]);
  }
  return r;
}
export const markPaid = (db: Db, kind: OpenItem['kind'], id: string, paidOn: string, method: string | null) =>
  rpcDo(db, 'firm_mark_paid', { p_kind: kind, p_id: id, p_paid_on: paidOn, p_method: method });
export const openItems = async (db: Db, ownerId: string): Promise<Read<OpenItem[]>> => {
  const r = await rpcRead<OpenItem[]>(db, 'firm_open_items', { p_owner: ownerId });
  return r.ok ? { ok: true, data: Array.isArray(r.data) ? r.data : [] } : r;
};
export const clientProperties = async (db: Db, ownerId: string): Promise<Read<ClientProperty[]>> => {
  const r = await rpcRead<ClientProperty[]>(db, 'firm_client_properties', { p_owner: ownerId });
  return r.ok ? { ok: true, data: Array.isArray(r.data) ? r.data : [] } : r;
};

// Η πλευρά του ιδιοκτήτη.
export const ownerFirms = async (db: Db): Promise<Read<OwnerFirm[]>> => {
  const r = await rpcRead<OwnerFirm[]>(db, 'my_accountants');
  return r.ok ? { ok: true, data: Array.isArray(r.data) ? r.data : [] } : r;
};
export const setLevel = (db: Db, firmId: string, level: AccessLevel) => rpcDo(db, 'owner_set_firm_level', { p_firm: firmId, p_level: level });
export const revokeFirm = (db: Db, firmId: string) => rpcDo(db, 'owner_revoke_firm', { p_firm: firmId });
export const firmDay = async (db: Db, day: string): Promise<Read<FirmDay[]>> => {
  const r = await rpcRead<FirmDay[]>(db, 'owner_firm_day', { p_day: day });
  return r.ok ? { ok: true, data: Array.isArray(r.data) ? r.data : [] } : r;
};

/**
 * Η «Αναίρεση όλων» μιας μέρας, ολόκληρη: οι γραμμές ΚΑΙ τα αρχεία.
 *
 * Από το 20261109100000 η `owner_undo_firm_day` επιστρέφει τις διαδρομές των
 * παραστατικών που έσβησε (`filePaths`)· τα αρχεία τα σβήνει ο περιηγητής, όπως
 * στο `undoRecord`. Η βάση πριν από εκείνη τη μετανάστευση δεν τις στέλνει: τότε
 * η αναίρεση γίνεται όπως πριν και το αρχείο μένει, χωρίς σφάλμα.
 */
export async function undoFirmDay(db: Db, firmId: string, day: string): Promise<Done> {
  const r = await rpcDo(db, 'owner_undo_firm_day', { p_firm: firmId, p_day: day });
  if (!r.ok) return r;
  const paths = Array.isArray(r.data?.filePaths) ? (r.data.filePaths as unknown[]).filter((p): p is string => typeof p === 'string' && p !== '') : [];
  if (paths.length > 0) await db.storage.from('property-files').remove(paths);
  return r;
}

/** Μία μέρα που ο ιδιοκτήτης βλέπει και αναιρεί: «Σήμερα», «Χθες». */
export interface UndoDay { day: string; word: string; lower: string }

const DAY_WORD = [['Σήμερα', 'σήμερα'], ['Χθες', 'χθες'], ['Προχθές', 'προχθές']] as const;

/**
 * Οι μέρες της αναίρεσης, νεότερη πρώτη: `FIRM_UNDO_DAYS` ημερολογιακές μέρες
 * Αθήνας, όπως τις υπόσχεται η Πολιτική απορρήτου και τις ελέγχει η βάση
 * (20261109100000). Ημερολογιακές, όχι 24ωρα: στις 00:10 το «χθες» είναι η
 * μέρα που τελείωσε πριν από δέκα λεπτά. Δέχεται το «σήμερα» της Αθήνας
 * (`athensToday()`) σε «YYYY-MM-DD», σταθερό κλειδί για τα hooks.
 */
export function undoDaysFrom(today: string): UndoDay[] {
  const base = Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
  return Array.from({ length: FIRM_UNDO_DAYS }, (_, i) => {
    const [word, lower] = DAY_WORD[i] ?? DAY_WORD[DAY_WORD.length - 1];
    return { day: new Date(base - i * 86_400_000).toISOString().slice(0, 10), word, lower };
  });
}

/** Ανήκει η στιγμή του ημερολογίου σε αυτή τη μέρα της Αθήνας; */
export const inAthensDay = (at: string, day: string) => athensToday(new Date(at)) === day;

// ── ΟΙ ΚΑΝΟΝΕΣ ─────────────────────────────────────────────────────────────

/** Τι μπορεί να κάνει ο ρόλος. Η βάση το επιβάλλει· εδώ μόνο δεν δείχνεται το κουμπί. */
export const canManage = (role: FirmRole | null | undefined) => role === 'manager';
export const canAct = (role: FirmRole | null | undefined) => role === 'manager' || role === 'accountant';

/** Τα είδη καταχώρησης που επιτρέπει το επίπεδο, με τη σειρά του μενού «Καταχώρηση». */
export function entryKinds(level: AccessLevel | null | undefined): ('document' | 'bill' | 'rent' | 'tax' | 'loan' | 'tenant')[] {
  if (level === 'keep') return ['document', 'bill', 'rent', 'tax', 'loan', 'tenant'];
  if (level === 'upload') return ['document'];
  return [];
}

export const ENTRY_LABEL = {
  document: 'Παραστατικό',
  bill: 'Πληρωμή λογαριασμού',
  rent: 'Είσπραξη ενοικίου',
  tax: 'Δόση φόρου',
  loan: 'Δόση δανείου',
  tenant: 'Μισθωτής',
} as const;

/**
 * Ποια εκκρεμότητα ανήκει σε ποιο είδος του μενού «Καταχώρηση».
 *
 * ΛΕΞΗ ΠΟΥ ΑΡΧΙΖΕΙ ΑΠΟ «ΦΟΡ», ΟΧΙ ΟΠΟΙΑ ΤΟ ΠΕΡΙΕΧΕΙ. Ο έλεγχος ήταν
 * `/ΕΝΦΙΑ|φόρ|φορ/i` οπουδήποτε στο όνομα: «Προμήθεια πλατφόρμας», «Μεταφορά
 * επίπλων», «Διαφορά κοινοχρήστων» έβγαιναν δόσεις φόρου, έφευγαν από την
 * «Πληρωμή λογαριασμού» και εμφανίζονταν στη «Δόση φόρου».
 */
const TAX_WORD = /(?<!\p{L})(ενφια|φ[οό]ρ(ος|ου|ο|οι|ων|ολογ))/iu;
const LOAN_WORD = /(?<!\p{L})δ[αά]νει/iu;
export function itemsFor(kind: string, all: OpenItem[]): OpenItem[] {
  const isTax = (i: OpenItem) => TAX_WORD.test(i.name);
  if (kind === 'rent') return all.filter(i => i.kind === 'rent');
  if (kind === 'tax') return all.filter(i => i.kind !== 'rent' && isTax(i));
  if (kind === 'loan') return all.filter(i => i.kind === 'event' && LOAN_WORD.test(i.name));
  if (kind === 'bill') return all.filter(i => i.kind === 'bill' && !isTax(i));
  return [];
}

/**
 * «Λογιστικό Γραφείο Παπαδόπουλος»: σήμερα καταχώρησε 3 πληρωμές και 1 μισθωτή.
 * Το όνομα πρώτο, σε εισαγωγικά: «Το γραφείο Λογιστικό Γραφείο …» το έλεγε δύο φορές.
 *
 * Μία πρόταση ανά γραφείο, όχι μία ειδοποίηση ανά εγγραφή. Οι λογαριασμοί, οι
 * δόσεις και οι δαπάνες είναι για τον ιδιοκτήτη το ίδιο πράγμα: «πληρωμές».
 */
export function daySentence(d: FirmDay, when = 'σήμερα'): string {
  const c = d.counts;
  const pay = (c.bill ?? 0) + (c.event ?? 0) + (c.expense ?? 0);
  const parts: string[] = [];
  const say = (n: number, one: string, many: string) => { if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`); };
  say(pay, 'πληρωμή', 'πληρωμές');
  say(c.rent ?? 0, 'είσπραξη', 'εισπράξεις');
  say(c.tenant ?? 0, 'μισθωτή', 'μισθωτές');
  say(c.document ?? 0, 'παραστατικό', 'παραστατικά');
  if (parts.length === 0) return '';
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} και ${parts[parts.length - 1]}`;
  return `«${d.firmName}»: ${when} καταχώρησε ${list}.`;
}

/**
 * Μία γραμμή του ημερολογίου κινήσεων όπως τη διαβάζει ο ιδιοκτήτης.
 *
 * ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΚΡΑΤΑ ΜΟΝΟ ΤΙ ΚΑΙ ΠΟΙΑ ΠΕΔΙΑ (20261104150000). Το «πριν/μετά»
 * ζει στην αναίρεση, που ο περιηγητής δεν βλέπει· για μισθωτή δεν κρατά ούτε
 * ετικέτα. Το ποσό ζει στη γραμμή, όχι εδώ.
 */
export interface LogEntry {
  id: string;
  kind: string;
  action: 'insert' | 'update' | 'delete' | 'mark_paid' | string;
  label: string | null;
  fields: string[] | null;
  member_name: string | null;
  at: string;
}

const KIND_WORD: Record<string, string> = {
  document: 'Παραστατικό', tenant: 'Μισθωτής', bill: 'Λογαριασμός', rent: 'Είσπραξη ενοικίου', expense: 'Δαπάνη', event: 'Δόση',
};

/** Τα πεδία που αλλάζουν συχνότερα, με το όνομα που έχουν στις φόρμες. */
const FIELD_WORD: Record<string, string> = {
  amount: 'ποσό', date: 'ημερομηνία', doc_date: 'ημερομηνία', issue_date: 'ημερομηνία έκδοσης', due_date: 'λήξη',
  payment_date: 'ημερομηνία πληρωμής', paid_date: 'ημερομηνία πληρωμής', paid_at: 'ημερομηνία πληρωμής',
  title: 'τίτλος', name: 'όνομα', description: 'περιγραφή', category: 'κατηγορία', notes: 'σημειώσεις',
  period: 'περίοδος', period_month: 'μήνας', period_year: 'έτος', method: 'τρόπος πληρωμής', payment_method: 'τρόπος πληρωμής',
  full_name: 'ονοματεπώνυμο', phone: 'τηλέφωνο', email: 'email', afm: 'ΑΦΜ', lease_start: 'έναρξη μίσθωσης',
  lease_end: 'λήξη μίσθωσης', monthly_rent: 'μίσθωμα', deposit: 'εγγύηση', status: 'κατάσταση', paid: 'πληρωμή',
  supplier: 'προμηθευτής', store_vendor: 'προμηθευτής', vat_rate: 'ΦΠΑ', vat_amount: 'ΦΠΑ',
};

/** «άλλαξε ποσό και λήξη» ή, για πεδία χωρίς όνομα, «άλλαξαν 3 πεδία». */
function changed(fields: string[] | null): string {
  const words = [...new Set((fields ?? []).map(f => FIELD_WORD[f]).filter(Boolean))];
  const n = fields?.length ?? 0;
  if (words.length === 0) return n === 1 ? 'άλλαξε 1 πεδίο' : n > 1 ? `άλλαξαν ${n} πεδία` : 'άλλαξε';
  const list = words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} και ${words[words.length - 1]}`;
  return `άλλαξε ${list}`;
}

// Η ΠΛΗΡΩΜΗ ΧΩΡΙΣ ΓΕΝΟΣ. Το «σημειώθηκε πληρωμένο» έμπαινε δίπλα σε «Δόση»,
// «Είσπραξη ενοικίου» (θηλυκά) και «Λογαριασμός» (αρσενικό): ουδέτερο επίθετο
// που δεν συμφωνούσε με κανένα από τα τρία.
const ACTION_WORD: Record<string, string> = {
  insert: 'καταχωρήθηκε', delete: 'αφαιρέθηκε', mark_paid: 'σημειώθηκε η πληρωμή', revert: 'επανήλθε',
};

/** «Λογαριασμός «ΔΕΗ Μάρτιος» · άλλαξε ποσό και λήξη». */
export function logLine(r: Pick<LogEntry, 'kind' | 'action' | 'label' | 'fields'>): string {
  const what = r.label ? `${KIND_WORD[r.kind] ?? r.kind} «${r.label}»` : (KIND_WORD[r.kind] ?? r.kind);
  return `${what} · ${r.action === 'update' ? changed(r.fields) : ACTION_WORD[r.action] ?? r.action}`;
}

/** Τα σφάλματα των καταχωρήσεων σε μία πρόταση που λέει τι να κάνεις. */
export function reasonText(reason: string): string {
  switch (reason) {
    case 'not_allowed': return 'Ο πελάτης δεν έχει δώσει αυτή την άδεια στο γραφείο.';
    // Το γραφείο γράφει ως εκτελών την επεξεργασία (20261105090000).
    case 'dpa': return 'Ο πελάτης πρέπει πρώτα να αποδεχτεί τους όρους επεξεργασίας. Μόλις τους αποδεχτεί στην εφαρμογή, η καταχώρηση ανοίγει.';
    case 'property': return 'Το ακίνητο δεν ανήκει σε αυτόν τον πελάτη.';
    case 'type': return 'Δεκτά είναι PDF, JPG και PNG.';
    case 'size': return 'Το αρχείο ξεπερνά τα 50 MB.';
    case 'no_loan': return 'Το ακίνητο δεν έχει δάνειο. Δόση καταχωρείται μόνο σε υπάρχον δάνειο.';
    case 'already_paid': return 'Έχει ήδη σημειωθεί ως πληρωμένο.';
    case 'future': return 'Η ημερομηνία πληρωμής δεν μπορεί να είναι μελλοντική.';
    case 'not_payable': return 'Αυτό δεν είναι μία δόση που κλείνει με πληρωμή.';
    case 'paid_at': return 'Γράψε πότε πληρώθηκε ο λογαριασμός.';
    case 'amount': return 'Γράψε το ποσό που πληρώθηκε.';
    case 'too_late': return 'Πέρασαν 24 ώρες. Την αφαίρεση την κάνει πλέον ο ιδιοκτήτης.';
    case 'not_ours': return 'Αλλάζεις μόνο ό,τι καταχώρησε το γραφείο σου.';
    case 'window': return 'Η αναίρεση γίνεται για σήμερα και χθες. Ανανέωσε τη σελίδα.';
    case 'mfa_required': return 'Χρειάζεται ο δεύτερος κωδικός σύνδεσης.';
    case 'not_manager': return 'Μόνο ο υπεύθυνος του γραφείου το κάνει αυτό.';
    case 'last_manager': return 'Το γραφείο χρειάζεται τουλάχιστον έναν υπεύθυνο.';
    case 'email': return 'Η διεύθυνση email δεν είναι έγκυρη.';
    case 'afm': return 'Ο ΑΦΜ έχει 9 ψηφία.';
    case 'name': return 'Γράψε την επωνυμία του γραφείου.';
    case 'in_other_firm': return 'Είσαι ήδη μέλος άλλου γραφείου με πελάτες. Αποχώρησε πρώτα από εκείνο.';
    case 'firm_account': return FIRM_NO_PROPERTIES;
    case 'terms_version': return 'Οι όροι άλλαξαν στο μεταξύ. Ανανέωσε τη σελίδα και διάβασέ τους ξανά.';
    case 'owner_account': return 'Ο λογαριασμός σου έχει δικά του ακίνητα. Για το γραφείο χρησιμοποίησε άλλη διεύθυνση email.';
    default: return 'Δεν ολοκληρώθηκε. Δοκίμασε ξανά.';
  }
}

export type Scope = 'mine' | 'all';
export type StatusFilter = 'all' | 'blocked' | 'ready';

/**
 * Τα φίλτρα του χώρου του γραφείου. Το «Οι πελάτες μου» κρατά όσους μου
 * ανατέθηκαν· ο υπεύθυνος που δεν έχει αναθέσει κανέναν στον εαυτό του τα
 * βλέπει όλα στο «Όλοι». Το «Υπεύθυνος» κρατά όσους έχει αναλάβει το μέλος.
 */
/*
 * «ΕΤΟΙΜΟΙ» ΕΙΝΑΙ ΟΣΟΙ Η ΚΑΡΤΑ ΓΡΑΦΕΙ «ΕΤΟΙΜΟΣ». Το φίλτρο κρατούσε όποιον δεν
 * είχε εκκρεμότητα που μπλοκάρει, δηλαδή και τους «Σχεδόν έτοιμους», ενώ η
 * σύνοψη από πάνω μετρά μόνο όσους δεν έχουν κανένα κενό: «1 έτοιμος» στον
 * τίτλο και δύο κάρτες στο φίλτρο «Έτοιμοι». Το `complete` (κανένα κενό) το
 * δίνει ο καλών· όπου λείπει, ισχύει ο παλιός κανόνας.
 */
export function filterClients<T extends { ownerId: string; assignees?: { userId: string }[]; blocking: boolean; complete?: boolean }>(
  rows: T[], meta: Map<string, ClientLevel>, f: { scope: Scope; assignee: string; status: StatusFilter },
): T[] {
  return rows.filter(r => {
    if (f.scope === 'mine' && !meta.get(r.ownerId)?.mine) return false;
    if (f.assignee === '-') { if ((r.assignees?.length ?? 0) > 0) return false; }
    else if (f.assignee && !(r.assignees ?? []).some(a => a.userId === f.assignee)) return false;
    if (f.status === 'blocked' && !r.blocking) return false;
    if (f.status === 'ready' && (r.blocking || r.complete === false)) return false;
    return true;
  });
}

/** Η ενέργεια του ιστορικού σε λέξη. */
export const ACTION_LABEL: Record<string, string> = {
  open: 'Άνοιξε τον φάκελο',
  export: 'Κατέβασε',
  request: 'Ζήτησε έγγραφο',
  upload: 'Ανέβασε παραστατικό',
  record: 'Καταχώρησε',
};
