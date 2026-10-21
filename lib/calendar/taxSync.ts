// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΘΕΣΜΙΚΕΣ ΠΡΟΘΕΣΜΙΕΣ ΜΠΑΙΝΟΥΝ ΜΟΝΕΣ ΤΟΥΣ ΣΤΟ ΗΜΕΡΟΛΟΓΙΟ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΚΕΝΟ (20.10.2026). Η κύρια υπόσχεση είναι «δεν χάνεις προθεσμία». Οι δόσεις
// ΕΝΦΙΑ, το Ε1/Ε2, το Ε9 και οι μηνιαίες δηλώσεις της βραχυχρόνιας φαίνονταν
// στην Επισκόπηση, αλλά στο `calendar_events` —από όπου διαβάζουν το email, το
// push και η συνδρομή του κινητού— έμπαιναν μόνο με «⋯ → Συγχρονισμός
// δεδομένων → Φορολογικά». Οποιος δεν το έβρισκε, δεν έπαιρνε τίποτα.
//
// ΕΝΑΣ ΓΡΑΦΕΑΣ, ΤΡΕΙΣ ΑΦΟΡΜΕΣ. Αυτό το αρχείο είναι ο μόνος που γράφει `tax:*`:
//   · όταν αποθηκεύεται ακίνητο ή αλλάζει η κατάστασή του (καρτέλες),
//   · κάθε πρωί στις 05:00 UTC, πριν από τις ειδοποιήσεις (app/api/push, pg_cron),
//   · όταν ο χρήστης πατήσει «Ανανέωση τώρα» στο Ημερολόγιο.
// Οι ημερομηνίες βγαίνουν από το lib/tax/greekTaxCalendar.ts μέσω του
// `taxEventsToWrite` (lib/facts/deadlines) και από πουθενά αλλού.
//
// ΟΙ ΚΑΝΟΝΕΣ, ΜΕ ΤΗ ΣΕΙΡΑ ΠΟΥ ΕΦΑΡΜΟΖΟΝΤΑΙ.
//   1. ΚΛΕΙΔΙ: η πηγή `tax:<id>` ανά ακίνητο. Η βάση κρατά μία γραμμή ανά κλειδί
//      (calendar_events_tax_once), άρα δύο γραφείς μαζί δεν διπλογράφουν.
//   2. ΚΑΤΑΣΤΑΣΗ: ό,τι έκλεισε μένει κλειστό, ό,τι πέρασε δεν γεννιέται ως νέα
//      εκκρεμότητα (`taxEventsToWrite`). Η μηχανή δεν ανοίγει ποτέ ξανά γραμμή.
//   3. ΑΛΛΑΓΕΣ ΤΟΥ ΧΡΗΣΤΗ: το `auto_hash` κρατά τι έγραψε η μηχανή. Γραμμή που
//      δεν ταιριάζει πια (μετακίνηση, άλλος τίτλος, σημείωση) την άλλαξε ο
//      χρήστης και ο συγχρονισμός δεν αγγίζει το περιεχόμενό της, ούτε τη σβήνει.
//   4. ΕΝΑ ΕΚΚΑΘΑΡΙΣΤΙΚΟ: ο ΕΝΦΙΑ, το Ε1 και το Ε9 είναι του φορολογούμενου, όχι
//      του ακινήτου. Οταν μια τέτοια προθεσμία κλείσει σε ένα ακίνητο, κλείνει
//      και στα άλλα του ίδιου ιδιοκτήτη· όχι όμως αν ο χρήστης έχει ορίσει ο ίδιος
//      την κατάσταση εκείνης της γραμμής (π.χ. την ξανάνοιξε). Οι μηνιαίες της
//      βραχυχρόνιας μένουν ανά ακίνητο.
//   5. ΠΑΛΙΑ ΠΟΥ ΔΕΝ ΙΣΧΥΟΥΝ ΠΙΑ (το ακίνητο έπαψε να είναι βραχυχρόνιο): φεύγουν
//      μόνο αν είναι μελλοντικά, ανοιχτά και ανέγγιχτα. Τίποτε άλλο δεν σβήνεται.
//   6. ΔΟΣΕΙΣ ΕΝΦΙΑ ΠΟΥ ΔΕΝ ΥΠΑΡΧΟΥΝ (20.10.2026). Με γνωστό σύνολο
//      εκκαθαριστικού οι δόσεις είναι όσες βγάζει ο κανόνας των 10€
//      (lib/calendar/enfiaTotals.ts). Οσες είχε γράψει η μηχανή πάνω από αυτές
//      φεύγουν αν είναι ανοιχτές και ανέγγιχτες, ακόμη και περασμένες: μια «8η δόση»
//      που δεν υπήρξε ποτέ δεν είναι ληξιπρόθεσμη, είναι λάθος. Ό,τι άλλαξε ή
//      έκλεισε ο χρήστης μένει. Δεν ξαναγεννιούνται, γιατί η μηχανή δεν τις
//      βγάζει· και αν η ανάγνωση του συνόλου αποτύχει, δεν γράφεται τίποτα.
//
// ΣΥΝΙΔΙΟΚΤΗΣΙΑ ΚΑΙ ΟΜΑΔΑ. Η γραμμή ανήκει πάντα στον ΙΔΙΟΚΤΗΤΗ του ακινήτου
// (`user_properties.user_id`): εκείνου είναι το εκκαθαριστικό και σε εκείνον
// φεύγουν οι υπενθυμίσεις. Το ποσοστό συνιδιοκτησίας δεν αλλάζει την προθεσμία
// και οι λοιποί συνιδιοκτήτες της καρτέλας δεν είναι χρήστες: δεν παίρνουν
// γραμμές. Μέλος ομάδας που βλέπει το ακίνητο δεν γράφει δικά του αντίγραφα.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarEventsRow } from '@/lib/supabase/tables';
import type { DbError } from '@/lib/supabase/writeResult';
import { taxEventsToWrite, isClosedStatus } from '@/lib/facts/deadlines';
import {
  taxProfileOf, taxObligationOfEventSource, taxKindOfEventSource, TAX_SOURCE_PREFIX, type PropertyTaxProfile,
} from '@/lib/tax/greekTaxCalendar';
import { readEnfiaCounts } from './enfiaTotals';
import type { StatusRow } from '@/lib/property/status';
import { athensToday } from '@/lib/core/time';
import * as calendar from '@/lib/data/calendar';
import * as properties from '@/lib/data/properties';

export type TaxRow = calendar.TaxRow;

/** Το περιεχόμενο που γράφει η μηχανή. Η κατάσταση ΔΕΝ είναι περιεχόμενο. */
type Content = Pick<CalendarEventsRow, 'title' | 'event_date' | 'category' | 'priority' | 'notes' | 'amount'>;

const text = (v: string | null | undefined) => String(v ?? '').trim();
const status = (v: string | null | undefined) => text(v).toLowerCase() || 'pending';

/**
 * Το αποτύπωμα του περιεχομένου. FNV-1a 32 bit: δεν φυλάει μυστικό, ξεχωρίζει
 * μόνο «το ίδιο» από «άλλο» και δίνει το ίδιο αποτέλεσμα σε περιηγητή και
 * διακομιστή. Το μηδενικό ποσό και το κενό είναι το ίδιο ποσό: η φόρμα του
 * Ημερολογίου γράφει το ένα εκεί που η μηχανή γράφει το άλλο.
 */
export function contentHash(c: Partial<Content>): string {
  const amount = typeof c.amount === 'number' && c.amount > 0 ? c.amount.toFixed(2) : '';
  const key = [text(c.title), text(c.event_date).slice(0, 10), text(c.category), text(c.priority) || 'medium', text(c.notes), amount].join('␞');
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** `<αποτύπωμα περιεχομένου>.<κατάσταση που έγραψε η μηχανή>`. */
const stamp = (c: Partial<Content>, st: string) => `${contentHash(c)}.${status(st)}`;

const parts = (h: string | null | undefined): { content: string; status: string } | null => {
  const m = /^([0-9a-f]{8})\.(.+)$/.exec(String(h ?? ''));
  return m ? { content: m[1], status: m[2] } : null;
};

/** Το περιεχόμενο άλλαξε από τον χρήστη. Γραμμή χωρίς αποτύπωμα: του παλιού συγχρονισμού. */
export function contentEdited(r: Pick<TaxRow, 'auto_hash'> & Partial<Content>): boolean {
  const p = parts(r.auto_hash);
  return !!p && p.content !== contentHash(r);
}

/** Την κατάσταση την όρισε ο χρήστης (π.χ. «πληρώθηκε» ή «ξανάνοιξε»). */
function statusTouched(r: Pick<TaxRow, 'auto_hash' | 'status'>): boolean {
  const p = parts(r.auto_hash);
  return !!p && p.status !== status(r.status);
}

/** Προθεσμία του φορολογούμενου (ΕΝΦΙΑ, Ε1, Ε9) και όχι ενός ακινήτου. */
export function isPersonLevel(source: string | null | undefined): boolean {
  return !!taxObligationOfEventSource(source)?.profiles.includes('owner');
}

/**
 * Δόση ΕΝΦΙΑ πάνω από το πλήθος του εκκαθαριστικού (κανόνας 6). Μόνο με γνωστό
 * πλήθος για το έτος της· η 1η δόση δεν περισσεύει ποτέ.
 */
export function isSurplusEnfiaInstalment(
  source: string | null | undefined, counts: Readonly<Record<number, number>>,
): boolean {
  const kind = taxKindOfEventSource(source);
  if (kind !== 'enfia-instalment' && kind !== 'enfia-last') return false;
  const id = String(source).slice(TAX_SOURCE_PREFIX.length);
  const m = kind === 'enfia-last' ? /-(\d{4})$/.exec(id) : /-(\d{4})-(\d{1,2})$/.exec(id);
  if (!m) return false;
  const count = counts[Number(m[1])];
  const no = kind === 'enfia-last' ? 12 : Number(m[2]);
  return typeof count === 'number' && count >= 1 && no > count;
}

export interface TaxSyncPlan {
  insert: calendar.EventDraft[];
  update: { id: string; patch: Partial<CalendarEventsRow> }[];
  remove: string[];
  /** Πόσες προθεσμίες έχει το ακίνητο μετά τον συγχρονισμό. */
  total: number;
}

/**
 * Το σχέδιο για ΕΝΑ ακίνητο. Καθαρή συνάρτηση: γραμμές μέσα, ενέργειες έξω.
 *
 * @param closedElsewhere πηγή → κλειστή κατάσταση, για προθεσμίες του
 *        φορολογούμενου που έκλεισαν σε ΑΛΛΟ ακίνητο του ίδιου ιδιοκτήτη.
 * @param enfiaInstalments έτος → πλήθος δόσεων ΕΝΦΙΑ, όπου το σύνολο του
 *        εκκαθαριστικού είναι γνωστό (κανόνας 6)· αλλιώς δώδεκα.
 */
export function planTaxSync(
  today: string, profile: PropertyTaxProfile, existing: readonly TaxRow[],
  closedElsewhere: ReadonlyMap<string, string> = new Map(),
  enfiaInstalments: Readonly<Record<number, number>> = {},
): TaxSyncPlan {
  const bySource = new Map<string, TaxRow>();
  for (const r of existing) if (r.source && !bySource.has(r.source)) bySource.set(r.source, r);

  const desired = taxEventsToWrite(today, profile, [...bySource.values()], { enfiaInstalments });
  const plan: TaxSyncPlan = { insert: [], update: [], remove: [], total: desired.length };
  const wanted = new Set<string>();

  for (const d of desired) {
    const src = d.source as string;
    wanted.add(src);
    const r = bySource.get(src);
    const elsewhere = closedElsewhere.get(src);
    const propagate = !!elsewhere && isPersonLevel(src);

    if (!r) {
      const st = propagate ? elsewhere : String(d.status ?? 'pending');
      plan.insert.push({ ...d, status: st as calendar.EventStatus, auto_hash: stamp(d, st) });
      continue;
    }

    const patch: Partial<CalendarEventsRow> = {};
    let st = status(r.status);
    if (propagate && !isClosedStatus(r.status) && !statusTouched(r)) {
      st = status(elsewhere);
      patch.status = elsewhere;
    }
    const content: Content = {
      title: d.title, event_date: d.event_date, category: d.category,
      priority: d.priority ?? 'medium', notes: d.notes ?? null, amount: d.amount ?? null,
    };
    if (!contentEdited(r)) {
      if (contentHash(r) !== contentHash(content)) Object.assign(patch, content);
      const next = stamp(content, st);
      if (r.auto_hash !== next) patch.auto_hash = next;
    }
    if (Object.keys(patch).length) plan.update.push({ id: r.id, patch });
  }

  for (const r of bySource.values()) {
    if (wanted.has(r.source as string)) continue;
    if (isClosedStatus(r.status) || contentEdited(r) || statusTouched(r)) continue;
    if (text(r.event_date).slice(0, 10) < today && !isSurplusEnfiaInstalment(r.source, enfiaInstalments)) continue;
    plan.remove.push(r.id);
  }
  return plan;
}

// ── ΤΟ ΓΡΑΨΙΜΟ ──────────────────────────────────────────────────────────────

export interface SyncProperty extends StatusRow { id: string; client_id?: string | null }

export interface SyncOutcome {
  error: DbError | null;
  /** Πόσες προθεσμίες έχει κάθε ακίνητο μετά τον συγχρονισμό. */
  totals: Record<string, number>;
  inserted: number;
  updated: number;
  removed: number;
}

const PROPERTY_COLUMNS = 'id,status_detail,rental_mode,client_id';

/**
 * Συγχρονίζει ΟΛΑ τα ακίνητα ενός ιδιοκτήτη. Ολα μαζί και όχι ένα-ένα, γιατί ο
 * κανόνας 4 χρειάζεται να ξέρει τι έκλεισε στα υπόλοιπα.
 *
 * Δουλεύει με τον πελάτη του περιηγητή (RLS: μόνο τα δικά του) και με τον
 * πελάτη υπηρεσίας (το πρόγραμμα του πρωινού). Το `ownerId` είναι πάντα ο
 * ιδιοκτήτης των ακινήτων, όχι όποιος πάτησε το κουμπί.
 */
export async function syncOwnerTaxDeadlines(
  db: SupabaseClient, ownerId: string,
  opts: { today?: string; properties?: readonly SyncProperty[] } = {},
): Promise<SyncOutcome> {
  const out: SyncOutcome = { error: null, totals: {}, inserted: 0, updated: 0, removed: 0 };
  const today = opts.today ?? athensToday();

  let props = opts.properties;
  if (!props) {
    const res = await properties.listWithError<SyncProperty>(db, ownerId, { columns: PROPERTY_COLUMNS });
    if (res.error) return { ...out, error: res.error };
    props = res.rows;
  }
  if (!props.length) return out;

  const [{ rows, error }, enfia] = await Promise.all([
    calendar.taxRowsOf(db, props.map(p => p.id)),
    readEnfiaCounts(db, ownerId, props),
  ]);
  if (error) return { ...out, error };
  // Χωρίς το σύνολο του εκκαθαριστικού δεν ξέρουμε πόσες δόσεις ΕΝΦΙΑ ισχύουν:
  // δεν γράφεται τίποτα, ώστε όσες έσβησε ο κανόνας 6 να μην ξαναγεννηθούν.
  if (enfia.error) return { ...out, error: enfia.error };

  const byProperty = new Map<string, TaxRow[]>();
  const closedElsewhere = new Map<string, Map<string, string>>();
  for (const r of rows) {
    const list = byProperty.get(r.property_id);
    if (list) list.push(r); else byProperty.set(r.property_id, [r]);
  }
  // Για κάθε ακίνητο: τι έκλεισε στα ΑΛΛΑ. Η πρώτη κλειστή κατάσταση κερδίζει.
  for (const p of props) {
    const m = new Map<string, string>();
    for (const r of rows) {
      if (r.property_id === p.id || !r.source || !isClosedStatus(r.status)) continue;
      if (!m.has(r.source)) m.set(r.source, String(r.status));
    }
    closedElsewhere.set(p.id, m);
  }

  for (const p of props) {
    const plan = planTaxSync(today, taxProfileOf(p), byProperty.get(p.id) ?? [], closedElsewhere.get(p.id), enfia.counts.get(p.id));
    out.totals[p.id] = plan.total;
    const scope = { propertyId: p.id, userId: ownerId };

    const ins = await calendar.insertOnce(db, plan.insert.map(d => calendar.row(scope, 'tax:', d)));
    if (ins.error) { out.error = out.error ?? (ins.error as DbError); continue; }
    out.inserted += plan.insert.length;

    for (const u of plan.update) {
      const { error: e } = await calendar.update(db, u.id, u.patch);
      if (e) { out.error = out.error ?? e; continue; }
      out.updated++;
    }
    for (let i = 0; i < plan.remove.length; i += calendar.BATCH) {
      const part = plan.remove.slice(i, i + calendar.BATCH);
      const { error: e } = await calendar.remove(db, part);
      if (e) { out.error = out.error ?? e; continue; }
      out.removed += part.length;
    }
  }
  return out;
}

// ── ΟΛΟΙ ΟΙ ΙΔΙΟΚΤΗΤΕΣ, ΚΑΘΕ ΠΡΩΙ ───────────────────────────────────────────

/** Ακίνητα ανά σελίδα ανάγνωσης. */
const PAGE = 500;

export interface SweepOutcome {
  /** Η ανάγνωση των ακινήτων απέτυχε: τίποτα δεν γράφτηκε. */
  readError: DbError | null;
  owners: number;
  inserted: number;
  updated: number;
  removed: number;
  /** Ιδιοκτήτες που δεν συγχρονίστηκαν· οι υπόλοιποι συνεχίζουν. */
  failed: number;
}

/**
 * Το πρωινό πέρασμα, ΜΟΝΟ με τον πελάτη υπηρεσίας (app/api/push, πριν από τις
 * ειδοποιήσεις). Ιδιο `syncOwnerTaxDeadlines` με την καρτέλα, ανά ιδιοκτήτη·
 * τον Ιανουάριο φέρνει μόνο του τις ημερομηνίες του νέου έτους.
 */
export async function syncAllTaxDeadlines(db: SupabaseClient, today: string = athensToday()): Promise<SweepOutcome> {
  const out: SweepOutcome = { readError: null, owners: 0, inserted: 0, updated: 0, removed: 0, failed: 0 };
  const byOwner = new Map<string, SyncProperty[]>();
  let after: string | null = null;
  for (;;) {
    const page: { rows: (SyncProperty & { user_id: string })[]; error: DbError | null } =
      await properties.pageAfter<SyncProperty & { user_id: string }>(db, `${PROPERTY_COLUMNS},user_id`, after, PAGE);
    if (page.error) return { ...out, readError: page.error };
    for (const r of page.rows) {
      const list = byOwner.get(r.user_id);
      if (list) list.push(r); else byOwner.set(r.user_id, [r]);
    }
    if (page.rows.length < PAGE) break;
    after = page.rows[page.rows.length - 1].id;
  }
  out.owners = byOwner.size;
  for (const [ownerId, props] of byOwner) {
    const res = await syncOwnerTaxDeadlines(db, ownerId, { today, properties: props });
    out.inserted += res.inserted; out.updated += res.updated; out.removed += res.removed;
    if (res.error) out.failed++;
  }
  return out;
}
