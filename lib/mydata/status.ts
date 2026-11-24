// ═══════════════════════════════════════════════════════════════════════════
// myDATA: ΤΙ ΛΕΕΙ Η ΟΘΟΝΗ, ΓΡΑΜΜΕΝΟ ΜΙΑ ΦΟΡΑ ΚΑΙ ΔΟΚΙΜΑΣΜΕΝΟ
// ─────────────────────────────────────────────────────────────────────────
// Η κάρτα του λογιστή, η γραμμή του πελάτη στον Λογαριασμό και τα Εισερχόμενα
// διαβάζουν από εδώ: κατάσταση, γραμμή συγχρονισμού, πρόοδος, σφάλμα με λύση
// σε μία φράση. Η βάση δίνει κωδικούς (ERROR_CODES στο
// supabase/functions/_shared/mydata.ts)· εδώ γίνονται λέξεις. Ώρες Αθήνας,
// ημερομηνίες dd/mm/yyyy, ποσά «1.234,50€».
// ═══════════════════════════════════════════════════════════════════════════
import { GREECE_TZ } from '@/lib/core/time';
import { fe } from '@/lib/core/format';
import { MYDATA_JOINT_VERSION } from '@/lib/legal/mydataJoint';
import { csvCell } from '@/lib/core/csv';
import { MYDATA_PENDING_DAYS, MYDATA_EXPIRY_NOTICE_DAYS } from './retention';

const dt = new Intl.DateTimeFormat('en-GB', {
  timeZone: GREECE_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
});

/** «23/11/2026 03:10», ώρα Αθήνας. */
export function athensStamp(iso: string): string {
  const parts: Record<string, string> = {};
  for (const p of dt.formatToParts(new Date(iso))) parts[p.type] = p.value;
  return `${parts.day}/${parts.month}/${parts.year} ${String(Number(parts.hour) % 24).padStart(2, '0')}:${parts.minute}`;
}

/** «κανένα νέο», «1 νέο», «12 νέα». */
export function newCount(n: number): string {
  if (!n) return 'κανένα νέο';
  return n === 1 ? '1 νέο' : `${n.toLocaleString('el-GR')} νέα`;
}

/** Η μία γραμμή κατάστασης: «Συγχρονίστηκε 23/11/2026 03:10 · 12 νέα». */
export function syncedLine(lastSyncAt: string | null, added: number): string {
  if (!lastSyncAt) return 'Δεν έχει συγχρονιστεί ακόμη.';
  return `Συγχρονίστηκε ${athensStamp(lastSyncAt)} · ${newCount(added)}`;
}

/**
 * Η ίδια γραμμή από την πλευρά του πελάτη: «Τελευταία άντληση από τον
 * λογιστή: 23/11/2026». Ε2: η άντληση γίνεται μόνο όταν την ξεκινά ο λογιστής,
 * οπότε η γραμμή λέει ποιος και πότε, όχι «συγχρόνισε».
 */
export function clientSyncedLine(lastSyncAt: string | null): string {
  if (!lastSyncAt) return 'Τα παραστατικά έρχονται όταν ο λογιστής σου ξεκινήσει την άντληση από τον χώρο του.';
  return `Τελευταία άντληση από τον λογιστή: ${athensStamp(lastSyncAt).slice(0, 10)}`;
}

/** Ποσό σε λεπτά, με πρόσημο για το πιστωτικό: «124,00€», «-12,40€». */
export function centsLabel(cents: number, credit = false): string {
  return fe(((credit ? -1 : 1) * cents) / 100);
}

// ── Η κατάσταση κάθε πελάτη στον πίνακα του λογιστή ─────────────────────────

export interface ClientRow {
  ownerId: string;
  name: string;
  consent: boolean;
  status: 'pending' | 'ok' | 'forbidden' | 'error' | 'paused' | null;
  lastSyncAt: string | null;
  lastNew: number;
  error: string | null;
  nextRetryAt: string | null;
  pending: number;
  /** Ο λογιστής έχει επιβεβαιώσει το ΑΦΜ του πελάτη (χωρίς αυτό δεν δίνεται άδεια). */
  afmConfirmed?: boolean;
  /** Παραστατικά σε καραντίνα: η ανάγνωση δεν τα δέχτηκε, ξαναζητούνται. */
  quarantined?: number;
  /** Ο πελάτης άλλαξε το ΑΦΜ του προφίλ μετά τη σύνδεση (μόνο η ώρα, ποτέ η τιμή). */
  afmChangedAt?: string | null;
}

export type Tone = 'ok' | 'wait' | 'warn' | 'off';

export interface RowState {
  label: string;
  /** Η λύση σε μία φράση, ή κενό όταν δεν χρειάζεται τίποτα. */
  fix: string;
  tone: Tone;
  /** Σειρά ταξινόμησης «προβλήματα πρώτα». */
  rank: number;
}

const DOWN = new Set(['rate', 'server', 'empty', 'network', 'timeout']);

/** Τι λέει η γραμμή του πελάτη και τι κάνει ο λογιστής γι' αυτό. */
export function rowState(r: ClientRow): RowState {
  if (!r.consent && r.afmChangedAt) {
    return { label: 'Χωρίς άδεια', fix: 'Ο πελάτης άλλαξε ΑΦΜ μετά τη σύνδεση. Έλεγξέ το στο myAADE σου πριν το επιβεβαιώσεις.', tone: 'warn', rank: 0 };
  }
  if (!r.consent && r.afmConfirmed === false) {
    return { label: 'Χωρίς άδεια', fix: 'Επιβεβαίωσε πρώτα το ΑΦΜ του πελάτη από το myAADE σου.', tone: 'off', rank: 3 };
  }
  if (!r.consent) return { label: 'Χωρίς άδεια', fix: 'Ο πελάτης πατά «Επιτρέπω» στον Λογαριασμό του.', tone: 'off', rank: 3 };
  if (r.status === 'paused') {
    return { label: 'Σε παύση', fix: 'Ο σύνδεσμος με τον πελάτη χρειάζεται ανανέωση ή αποδοχή των όρων του γραφείου.', tone: 'warn', rank: 0 };
  }
  if (r.error === 'quarantine' || (r.quarantined ?? 0) > 0) {
    return { label: 'Θέλει έλεγχο', fix: 'Κάποια παραστατικά δεν διαβάστηκαν. Τα ελέγχουμε και ξαναζητούνται με το επόμενο «Φέρε τώρα».', tone: 'warn', rank: 0 };
  }
  // Για ΑΦΜ χωρίς επιχείρηση η ΑΑΔΕ μπορεί να αρνείται· δεν ξαναδοκιμάζεται μόνο του.
  if (r.status === 'forbidden') return { label: 'Άρνηση ΑΑΔΕ', fix: 'Η ΑΑΔΕ δεν δίνει παραστατικά για αυτό το ΑΦΜ μέσω λογιστή. Έλεγξε την εξουσιοδότηση στο myAADE.', tone: 'warn', rank: 0 };
  if (r.status === 'error') {
    if (r.error && DOWN.has(r.error)) {
      return { label: 'Η ΑΑΔΕ δεν απαντά', fix: 'Πάτα «Φέρε τώρα» σε λίγο.', tone: 'wait', rank: 1 };
    }
    if (r.error === 'no_afm') return { label: 'Λείπει ΑΦΜ', fix: 'Ο πελάτης συμπληρώνει το ΑΦΜ του στον Λογαριασμό.', tone: 'warn', rank: 0 };
    if (r.error === 'parse' || r.error === 'aade_error') {
      return { label: 'Μη αναγνώσιμη απάντηση', fix: 'Το ελέγχουμε. Ξαναδοκίμασε με «Φέρε τώρα».', tone: 'wait', rank: 1 };
    }
    return { label: 'Δεν ολοκληρώθηκε', fix: 'Πάτα «Φέρε τώρα».', tone: 'warn', rank: 0 };
  }
  if (r.status === 'ok') return { label: 'Εντάξει', fix: '', tone: 'ok', rank: 2 };
  return { label: 'Σε αναμονή', fix: 'Τα πρώτα παραστατικά έρχονται με το «Φέρε τώρα».', tone: 'wait', rank: 1 };
}

export type SortKey = 'status' | 'name' | 'last';

/** Ταξινόμηση του πίνακα· η προεπιλογή φέρνει πρώτα όσους θέλουν κάτι. */
export function sortRows(rows: ClientRow[], key: SortKey): ClientRow[] {
  const byName = (a: ClientRow, b: ClientRow) => a.name.localeCompare(b.name, 'el');
  return [...rows].sort((a, b) => {
    if (key === 'name') return byName(a, b);
    if (key === 'last') return (b.lastSyncAt ?? '').localeCompare(a.lastSyncAt ?? '') || byName(a, b);
    return rowState(a).rank - rowState(b).rank || byName(a, b);
  });
}

export interface RowGroup { key: string; label: string; fix: string; tone: Tone; rank: number; rows: ClientRow[] }

/**
 * Α2: οι πελάτες σε ομάδες ανά κατάσταση, για το τηλέφωνο. Στον πίνακα η ίδια
 * πρόταση («Ο σύνδεσμος με τον πελάτη χρειάζεται ανανέωση…») επαναλαμβανόταν σε
 * κάθε γραμμή· εδώ λέγεται ΜΙΑ φορά ανά ομάδα και οι πελάτες ακολουθούν. Ομάδα
 * σημαίνει ίδια ετικέτα ΚΑΙ ίδια λύση. Πρώτα όσοι θέλουν κάτι, αλφαβητικά μέσα.
 */
export function groupRows(rows: ClientRow[]): RowGroup[] {
  const by = new Map<string, RowGroup>();
  for (const r of rows) {
    const st = rowState(r);
    const key = `${st.label}|${st.fix}`;
    const g = by.get(key) ?? { key, label: st.label, fix: st.fix, tone: st.tone, rank: st.rank, rows: [] };
    g.rows.push(r);
    by.set(key, g);
  }
  const groups = [...by.values()];
  for (const g of groups) g.rows.sort((a, b) => a.name.localeCompare(b.name, 'el'));
  return groups.sort((a, b) => a.rank - b.rank || b.rows.length - a.rows.length || a.label.localeCompare(b.label, 'el'));
}

/** Φίλτρο αναζήτησης χωρίς τόνους και κεφαλαία. */
export function filterRows(rows: ClientRow[], q: string): ClientRow[] {
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const needle = fold(q);
  return needle ? rows.filter(r => fold(r.name).includes(needle)) : rows;
}

// ── Η κατάσταση της κάρτας ─────────────────────────────────────────────────

/** Η σύνδεση του λογιστή. Κανένα διαπιστευτήριο: το κλειδί δεν φυλάσσεται (Ε2). */
export interface Connection {
  status: string;
  last_sync_at: string | null;
  last_sync_new: number;
  last_error_code: string | null;
  lease_id: string | null;
  lease_at: string | null;
  last_manual_at: string | null;
  /** Ε-1: η έκδοση της ρύθμισης άρθρου 26 που δέχτηκε το γραφείο και πότε. */
  joint_version: string | null;
  joint_at: string | null;
  /** Το τελευταίο τρέξιμο σταμάτησε στο όριο χρόνου. */
  last_partial: boolean;
}

export type CardPhase = 'terms' | 'rejected' | 'syncing' | 'ready';

/**
 * Σε ποια όψη είναι η κάρτα. `terms`: πρώτα η ρύθμιση άρθρου 26 (καμία ή
 * παλιά έκδοση, Ε-1/Ε-2). `rejected`: η ΑΑΔΕ δεν δέχτηκε το κλειδί που
 * δόθηκε στο τελευταίο τρέξιμο. Αν υπάρχει κλειδί στη μνήμη το ξέρει μόνο η κάρτα.
 */
export function cardPhase(c: Connection | null, now: Date = new Date()): CardPhase {
  if (!c || c.joint_version !== MYDATA_JOINT_VERSION) return 'terms';
  if (c.lease_id && c.lease_at && now.getTime() - Date.parse(c.lease_at) < 10 * 60_000) return 'syncing';
  if (c.last_error_code === 'auth') return 'rejected';
  return 'ready';
}

/** «Πελάτης 3 από 12 · 148 παραστατικά»: όσοι τελείωσαν ΜΕΤΑ την αρχή του τρεξίματος. */
export function progressLine(leaseAt: string, rows: ClientRow[]): string {
  const consented = rows.filter(r => r.consent);
  const done = consented.filter(r => r.lastSyncAt && r.lastSyncAt >= leaseAt);
  const docs = done.reduce((s, r) => s + (r.lastNew || 0), 0);
  const at = Math.min(done.length + 1, Math.max(consented.length, 1));
  return `Πελάτης ${at} από ${consented.length} · ${docs.toLocaleString('el-GR')} ${docs === 1 ? 'παραστατικό' : 'παραστατικά'}`;
}

/** Πόσοι πελάτες θέλουν κάτι από τον λογιστή μετά το τελευταίο τρέξιμο. */
export function attention(rows: ClientRow[]): number {
  return rows.filter(r => r.consent && rowState(r).tone === 'warn').length;
}

/**
 * Η ΑΑΔΕ δεν απαντά για ΚΑΝΕΝΑΝ πελάτη: η γραμμή κατάστασης το λέει μία φορά.
 * Αν απαντά για κάποιους, δεν είναι «εκτός». Καμία αυτόματη νέα προσπάθεια (Ε2).
 */
export function aadeDownLine(rows: ClientRow[]): string | null {
  const on = rows.filter(r => r.consent && r.status !== 'pending');
  if (!on.length) return null;
  const down = on.filter(r => rowState(r).label === 'Η ΑΑΔΕ δεν απαντά');
  if (down.length !== on.length) return null;
  return 'Η ΑΑΔΕ δεν απαντά. Πάτα «Φέρε τώρα» σε λίγο.';
}

/** Λεπτά ως το επόμενο «Συγχρονισμός τώρα» (όριο 5 λεπτών), ή 0. */
export function manualWaitMinutes(lastManualAt: string | null, now: Date = new Date()): number {
  if (!lastManualAt) return 0;
  const left = Date.parse(lastManualAt) + 5 * 60_000 - now.getTime();
  return left > 0 ? Math.ceil(left / 60_000) : 0;
}

/** Η απάντηση της συνάρτησης σε λέξεις, για το aria-live. */
export function runReason(reason: string | undefined): string {
  switch (reason) {
    case 'busy': return 'Η άντληση τρέχει ήδη.';
    case 'too_soon': return 'Ξανά σε λίγα λεπτά: μία άντληση ανά 5 λεπτά.';
    case 'auth':
    case 'key_rejected': return 'Η ΑΑΔΕ δεν δέχεται αυτό το user id με αυτό το κλειδί. Έλεγξέ τα στο myDATA REST API.';
    case 'no_key':
    case 'bad_key_shape': return 'Το κλειδί έχει 16 έως 200 λατινικά γράμματα και ψηφία.';
    case 'bad_user': return 'Γράψε το user id χωρίς κενά.';
    case 'no_clients': return 'Πρόσθεσε πρώτα έναν πελάτη.';
    case 'joint_terms': return 'Αποδέξου πρώτα τη ρύθμιση για τη Σύνδεση myDATA.';
    case 'no_actor': return 'Η άντληση ξεκινά μόνο από τον δικό σου λογαριασμό.';
    case 'mfa_required': return 'Ολοκλήρωσε πρώτα το δεύτερο βήμα σύνδεσης.';
    case 'disabled': return 'Η σύνδεση myDATA δεν είναι ακόμη ανοιχτή.';
    default: return 'Η άντληση δεν ξεκίνησε. Δοκίμασε ξανά σε λίγο.';
  }
}

/** Ο έλεγχος μορφής του κλειδιού, πριν φύγει οτιδήποτε (απόκριση αμέσως). */
export function keyShape(key: string): 'empty' | 'short' | 'chars' | 'ok' {
  const k = key.trim();
  if (!k) return 'empty';
  if (/[^A-Za-z0-9]/.test(k)) return 'chars';
  if (k.length < 16 || k.length > 200) return 'short';
  return 'ok';
}

/** Οι λέξεις του αρχείου πρόσβασης, για τον πελάτη. */
export const LOG_ACTION: Record<string, string> = {
  consent_granted: 'Έδωσες άδεια',
  consent_revoked: 'Η άδεια ανακλήθηκε',
  sync_fetch: 'Ο λογιστής έφερε παραστατικά',
  sync_failed: 'Ο συγχρονισμός δεν ολοκληρώθηκε',
  provider_ignored: 'Αγνοείς έναν πάροχο',
  consent_paused: 'Η άδεια σε παύση ως την ανανέωση του συνδέσμου',
  afm_confirmed: 'Ο λογιστής επιβεβαίωσε το ΑΦΜ σου',
  sync_done: 'Ο συγχρονισμός ολοκληρώθηκε',
  page_rejected: 'Μια σελίδα απορρίφθηκε γιατί η άδεια είχε κοπεί',
  invalid_quarantined: 'Κάποια παραστατικά δεν διαβάστηκαν και ξαναζητούνται',
  cancel_flagged: 'Ακυρώθηκε στην ΑΑΔΕ παραστατικό που είχες καταχωρήσει',
  cancel_removed_expense: 'Ακυρώθηκε στην ΑΑΔΕ· η δαπάνη αφαιρέθηκε',
  key_read: 'Ο λογιστής χρησιμοποίησε το κλειδί του myDATA',
  key_used: 'Ο λογιστής χρησιμοποίησε το κλειδί του myDATA',
  joint_accepted: 'Ο λογιστής αποδέχτηκε τη ρύθμιση για τη Σύνδεση myDATA',
  auto_filed: 'Λογαριασμοί γνωστών παρόχων καταχωρήθηκαν αυτόματα',
  auto_undone: 'Αναίρεσες αυτόματη καταχώρηση',
  not_property: 'Παραστατικά που δεν αφορούν ακίνητα δεν κρατήθηκαν',
  reissue_linked: 'Επανέκδοση παραστατικού δέθηκε με την ίδια δαπάνη',
};

/**
 * Κ-9: πόσα εκκρεμή σβήνουν μέσα στις επόμενες `MYDATA_EXPIRY_NOTICE_DAYS`
 * ημέρες, με την ημερομηνία λήψης (`fetched_at`) και το όριο της βάσης.
 */
export function expiringSoon(fetchedAt: string[], now: Date = new Date()): number {
  const life = MYDATA_PENDING_DAYS * 86_400_000;
  const notice = MYDATA_EXPIRY_NOTICE_DAYS * 86_400_000;
  return fetchedAt.filter(f => {
    const left = Date.parse(f) + life - now.getTime();
    return Number.isFinite(left) && left <= notice;
  }).length;
}

/**
 * Ε-9: το αρχείο πρόσβασης ως CSV για το γραφείο, κοινό εργαλείο λογοδοσίας
 * των από κοινού υπευθύνων (Όροι, «Σύνδεση myDATA»). Ώρα Αθήνας, ενέργεια σε
 * λέξεις, κελιά ουδέτερα για το λογιστικό φύλλο. Κανένα κλειδί: δεν υπάρχει.
 */
export function accessLogCsv(rows: { at: string; action: string; afm: string | null; n: number | null }[]): string {
  const head = ['Ημερομηνία', 'Ενέργεια', 'ΑΦΜ πελάτη', 'Πλήθος'];
  const body = rows.map(r => [athensStamp(r.at), LOG_ACTION[r.action] ?? r.action, r.afm ?? '', r.n ?? ''].map(v => csvCell(v)).join(';'));
  return [head.join(';'), ...body].join('\r\n');
}
