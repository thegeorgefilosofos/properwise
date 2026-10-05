// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΠΡΟΘΕΣΜΙΕΣ: ΕΝΑ ΣΗΜΕΡΑ, ΕΝΑΣ ΚΑΝΟΝΑΣ «ΚΛΕΙΣΤΗΚΕ», ΜΙΑ ΔΙΑΤΥΠΩΣΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ (05.10.2026). Τέσσερις μηχανές έλεγαν «τι έρχεται»
// και καμία δεν μοιραζόταν με τις άλλες ούτε το σήμερα ούτε τον κανόνα
// «έγινε»:
//   · Η Επισκόπηση μετρούσε ημέρες με το ρολόι του περιηγητή (ceil σε ώρες) και
//     διάβαζε τη λήξη ασφάλισης ως μεσάνυχτα UTC· έδειχνε τη δόση ΕΝΦΙΑ που ο
//     χρήστης είχε σημειώσει πληρωμένη στο Ημερολόγιο ή στις Εκκρεμότητες.
//   · Ο συγχρονισμός του Ημερολογίου έγραφε ως «εκκρεμή» και τις περασμένες
//     προθεσμίες από την 1η Ιανουαρίου και, σε κάθε νέο συγχρονισμό, ξανάκανε
//     «εκκρεμή» όσες είχε σημειώσει πληρωμένες.
//   · Η συνδρομή ημερολογίου και οι ειδοποιήσεις δεν ήξεραν την κατάσταση
//     `paid`: ταξίδευαν και τα πληρωμένα, η ίδια φορολογική προθεσμία δύο φορές
//     (γεγονός και εκκρεμότητα) και η σημείωση της εκκρεμότητας ως JSON.
//   · Οι Εκκρεμότητες έκριναν «ληξιπρόθεσμο» με μεσάνυχτα UTC απέναντι στο
//     τώρα: προθεσμία της ίδιας ημέρας γινόταν ληξιπρόθεσμη από τις 03:00.
//   · Η Νόα έπαιρνε τις δόσεις ΕΝΦΙΑ από δεύτερο πρόγραμμα (Μάρτιος ως
//     Φεβρουάριος, πάντα δώδεκα): τον Ιανουάριο του 2027 πηδούσε την 11η και
//     12η δόση του 2026, που οι άλλες οθόνες έδειχναν.
//   · Η καρτέλα υποδοχής έγραφε «οι επόμενες προθεσμίες» πάνω από δύο που
//     είχαν ήδη περάσει.
//
// ΕΝΑΣ ΟΡΙΣΜΟΣ.
//   · ΣΗΜΕΡΑ είναι η ημέρα στην Ελλάδα (`athensToday`) και οι ημέρες μετριούνται
//     ως ημερολογιακές (`daysBetweenIso`), ποτέ σε ώρες.
//   · ΚΛΕΙΣΤΗ είναι κάθε γραμμή σε `CLOSED_STATUSES`, όποιος πίνακας κι αν την
//     έχει. Μια θεσμική προθεσμία κλείνει μία φορά για όλες τις οθόνες: αρκεί
//     ένα κλειστό γεγονός ή μία κλειστή εκκρεμότητα με το ίδιο `tax:<id>`.
//   · ΘΕΣΜΙΚΕΣ ΗΜΕΡΟΜΗΝΙΕΣ βγαίνουν ΜΟΝΟ από το lib/tax/greekTaxCalendar.ts,
//     και για τις δόσεις ΕΝΦΙΑ. Το ποσό κάθε δόσης βγαίνει από το lib/facts/enfia.
//   · Η ΔΙΑΤΥΠΩΣΗ «σήμερα», «αύριο», «σε 5 ημέρες», «πριν από 3 ημέρες» ζει
//     στο `dueText` και καμία οθόνη δεν τη γράφει ξανά.
// ═══════════════════════════════════════════════════════════════════════════
import {
  taxObligationsHorizon, greekPropertyTaxObligations, taxEventSource, taxObligationToEvent,
  type PropertyTaxProfile, type TaxObligation,
} from '@/lib/tax/greekTaxCalendar';
import type { EventDraft, EventStatus } from '@/lib/data/calendar';
import { daysBetweenIso } from '@/lib/core/time';

/**
 * Καταστάσεις που ΔΕΝ είναι ανοιχτή προθεσμία, σε κάθε πίνακα: οι εκκρεμότητες
 * κλείνουν με `done`/`skipped`, τα γεγονότα του ημερολογίου με `paid`/`cancelled`.
 * Οι υπόλοιπες γραφές είναι παλιές τιμές που υπάρχουν ακόμη σε γραμμές.
 */
export const CLOSED_STATUSES: ReadonlySet<string> = new Set([
  'done', 'skipped', 'paid', 'cancelled', 'canceled', 'completed',
]);

export const isClosedStatus = (status: string | null | undefined): boolean =>
  CLOSED_STATUSES.has(String(status ?? '').trim().toLowerCase());

/**
 * Πόσο πίσω μένει ορατή μια ανοιχτή θεσμική προθεσμία που πέρασε: συνήθως
 * προλαβαίνεις ακόμη, με πρόστιμο. Ίδιος αριθμός για Επισκόπηση και Νόα.
 */
export const DEADLINE_LOOKBACK_DAYS = 45;

const ISO = /^\d{4}-\d{2}-\d{2}/;
const day = (v: string | null | undefined): string => {
  const s = String(v ?? '').slice(0, 10);
  return ISO.test(s) ? s : '';
};

/** Ημερολογιακές ημέρες από το `today` ως την `date`. `null` χωρίς ημερομηνία. */
export function daysFrom(today: string, date: string | null | undefined): number | null {
  const d = day(date), t = day(today);
  return d && t ? daysBetweenIso(t, d) : null;
}

/** Ληξιπρόθεσμη: ημερομηνία πριν από σήμερα και γραμμή ανοιχτή. Προθεσμία σήμερα δεν είναι. */
export function isOverdue(date: string | null | undefined, today: string, status?: string | null): boolean {
  const d = day(date);
  return !!d && d < day(today) && !isClosedStatus(status);
}

/**
 * Η απόσταση σε λέξεις, ίδια σε κάθε οθόνη. Ποτέ «σε -3 ημέρες», ποτέ «σε 1 ημέρες».
 * Το «έληξε» ή το «λήγει» το βάζει η πρόταση γύρω της, αν χρειάζεται.
 */
export function dueText(days: number | null | undefined): string | null {
  if (days == null || !Number.isFinite(days)) return null;
  if (days === 0) return 'σήμερα';
  if (days === 1) return 'αύριο';
  if (days === -1) return 'χθες';
  if (days > 1) return `σε ${days} ημέρες`;
  return `πριν από ${-days} ημέρες`;
}

/** Το ίδιο, για αρχή φράσης ή μόνο του σε ετικέτα: «Σήμερα», «Πριν από 3 ημέρες». */
export function dueTextStart(days: number | null | undefined): string | null {
  const t = dueText(days);
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : null;
}

/**
 * Το φορολογικό προφίλ από μια κατάσταση που έχει ήδη διαβαστεί. Ίδια
 * αντιστοίχιση με το `taxProfileOf` του ημερολογίου, για οθόνες που κρατούν
 * μόνο την κατάσταση και όχι τη γραμμή.
 */
export function taxProfileOfStatus(status: string | null | undefined): PropertyTaxProfile {
  return status === 'rent_short' ? 'short_term' : status === 'rent_long' ? 'long_term' : 'owner';
}

// ── ΚΛΕΙΣΤΕΣ ΘΕΣΜΙΚΕΣ ΠΡΟΘΕΣΜΙΕΣ ────────────────────────────────────────────

/** Η σημείωση μιας εκκρεμότητας: είτε απλό κείμενο είτε η μορφή `__cv: 2` με την ταυτότητα μέσα. */
export function taskNoteOf(raw: string | null | undefined): { note: string; ref: string | null } {
  const text = String(raw ?? '');
  if (text.startsWith('{')) {
    try {
      const p = JSON.parse(text) as { __cv?: number; note?: unknown; ref?: unknown };
      if (p && p.__cv === 2) {
        return { note: typeof p.note === 'string' ? p.note.trim() : '', ref: typeof p.ref === 'string' && p.ref ? p.ref : null };
      }
    } catch { /* απλό κείμενο που ξεκινά με άγκιστρο */ }
  }
  return { note: text.trim(), ref: null };
}

export interface TaxCarrierEvent { source?: string | null; status?: string | null }
export interface TaxCarrierTask { note?: string | null; ref?: string | null; status?: string | null; completed?: boolean | null }

/**
 * Οι θεσμικές προθεσμίες (`tax:<id>`) που έκλεισαν, σε όποιον πίνακα κι αν
 * έκλεισαν. Γεγονός ημερολογίου με κλειστή κατάσταση ή εκκρεμότητα κλειστή.
 */
export function closedTaxRefs(
  events: readonly TaxCarrierEvent[] = [], tasks: readonly TaxCarrierTask[] = [],
): Set<string> {
  const out = new Set<string>();
  for (const e of events) {
    const src = String(e.source ?? '');
    if (src.startsWith('tax:') && isClosedStatus(e.status)) out.add(src);
  }
  for (const t of tasks) {
    const ref = t.ref ?? taskNoteOf(t.note).ref;
    if (ref && ref.startsWith('tax:') && (t.completed === true || isClosedStatus(t.status))) out.add(ref);
  }
  return out;
}

// ── ΟΙ ΘΕΣΜΙΚΕΣ ΠΡΟΘΕΣΜΙΕΣ ─────────────────────────────────────────────────

/**
 * Όλες οι θεσμικές προθεσμίες από σήμερα ως το τέλος του ορίζοντα, χωρίς τις
 * κλειστές. Ό,τι γράφει το Ημερολόγιο και ό,τι δείχνει η υποδοχή.
 */
export function upcomingTaxObligations(
  today: string, profile: PropertyTaxProfile, closed: ReadonlySet<string> = new Set(),
): TaxObligation[] {
  const t = day(today);
  return taxObligationsHorizon(t, profile)
    .filter(o => o.date >= t && !closed.has(taxEventSource(o.id)));
}

/**
 * Μία γραμμή ανά ΕΙΔΟΣ θεσμικής προθεσμίας: η επόμενη ανοιχτή. Περασμένη μένει
 * μόνο όταν το είδος δεν έχει επόμενη, για `DEADLINE_LOOKBACK_DAYS` ημέρες.
 *
 * Οι ενδιάμεσες δόσεις ΕΝΦΙΑ δεν μένουν ποτέ περασμένες: τις διαδέχεται πάντα
 * η επόμενη πληρωμή της ίδιας σειράς. Μια κλειστή προθεσμία (δόση πληρωμένη
 * νωρίτερα) αφήνει να φανεί η επόμενη του ίδιου είδους αμέσως, όχι όταν
 * περάσει η ημερομηνία της.
 *
 * Επισκόπηση, Εκκρεμότητες και Νόα το καλούν· κανείς δεν το ξαναγράφει.
 */
export function nextTaxObligations(
  today: string, profile: PropertyTaxProfile,
  closed: ReadonlySet<string> = new Set(), lookbackDays: number = DEADLINE_LOOKBACK_DAYS,
): TaxObligation[] {
  const t = day(today);
  if (!t) return [];
  const year = Number(t.slice(0, 4));
  const cutoff = shift(t, -Math.max(0, lookbackDays));
  const horizon = taxObligationsHorizon(t, profile);
  const seen = new Set(horizon.map(o => o.id));
  // Ο ορίζοντας ξεκινά την 1.1: οι περσινές που πέρασαν μέσα στο παράθυρο
  // έρχονται από την ίδια μηχανή, όχι από αντίγραφο.
  const pool = [
    ...greekPropertyTaxObligations(year - 1, profile).filter(o => o.date < `${year}-01-01` && !seen.has(o.id)),
    ...horizon,
  ]
    .filter(o => o.date >= cutoff && !closed.has(taxEventSource(o.id)))
    .sort((a, b) => a.date.localeCompare(b.date));

  const pick = new Map<string, TaxObligation>();
  for (const o of pool) {
    if (o.kind === 'enfia-instalment' && o.date < t) continue;
    const cur = pick.get(o.kind);
    if (cur && cur.date >= t) continue;
    pick.set(o.kind, o);
  }
  return [...pick.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const shift = (iso: string, days: number): string => {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Τα γεγονότα που γράφει ο συγχρονισμός «Φορολογικά» του Ημερολογίου.
 *
 * ΤΟ ΣΦΑΛΜΑ. Ο συγχρονισμός έγραφε ΟΛΟ τον ορίζοντα από την 1η Ιανουαρίου ως
 * «εκκρεμή»: τον Οκτώβριο το Ημερολόγιο έδειχνε την 1η δόση ΕΝΦΙΑ και το Ε9 ως
 * ληξιπρόθεσμα και οι ειδοποιήσεις έλεγαν «η προθεσμία πέρασε». Και επειδή
 * σβήνει και ξαναγράφει, κάθε νέο πάτημα έκανε «εκκρεμή» ό,τι ο χρήστης είχε
 * σημειώσει πληρωμένο.
 *
 * Ο ΚΑΝΟΝΑΣ. Από σήμερα και μετά γράφονται όλες, με την κατάσταση που ήδη είχαν
 * (ή «εκκρεμής» αν είναι καινούριες). Περασμένη ξαναγράφεται μόνο αν υπήρχε
 * ήδη, με την κατάστασή της: τίποτα από όσα έγραψε ο χρήστης δεν χάνεται και
 * τίποτα περασμένο δεν γεννιέται ως νέα εκκρεμότητα.
 */
export function taxEventsToWrite(
  today: string, profile: PropertyTaxProfile,
  existing: readonly { source?: string | null; status?: string | null }[] = [],
): EventDraft[] {
  const t = day(today);
  const had = new Map<string, string>();
  for (const e of existing) if (e.source) had.set(e.source, String(e.status || 'pending'));
  const out: EventDraft[] = [];
  for (const o of taxObligationsHorizon(t, profile)) {
    const src = taxEventSource(o.id);
    const prev = had.get(src);
    if (o.date < t && prev === undefined) continue;
    out.push({ ...taxObligationToEvent(o), status: (prev ?? 'pending') as EventStatus });
  }
  return out;
}

// ── ΟΙ ΔΟΣΕΙΣ ΕΝΦΙΑ ────────────────────────────────────────────────────────

export interface EnfiaDue {
  /** Το εκκαθαριστικό στο οποίο ανήκει η δόση. */
  year: number;
  /** Αύξων αριθμός δόσης, 1 ως 12. */
  no: number;
  date: string;
  /** `tax:<id>` της προθεσμίας. */
  ref: string;
  /** `statutory` αν το εκκαθαριστικό έχει εκδοθεί, αλλιώς «περυσινή» ημερομηνία. */
  confidence: TaxObligation['confidence'];
}

const ENFIA_KINDS = new Set(['enfia-first', 'enfia-instalment', 'enfia-last']);

/** Ο αριθμός δόσης μιας θεσμικής προθεσμίας ΕΝΦΙΑ, από το ίδιο της το κλειδί. */
function enfiaNo(o: TaxObligation): number {
  if (o.kind === 'enfia-first') return 1;
  if (o.kind === 'enfia-last') return 12;
  const m = /-(\d+)$/.exec(o.id);
  return m ? Number(m[1]) : 0;
}

/** Το έτος του εκκαθαριστικού, από το κλειδί (`enfia-first-2026`, `enfia-instalment-2026-8`). */
function enfiaYearOf(o: TaxObligation): number {
  const m = /-(\d{4})(?:-\d+)?$/.exec(o.id);
  return m ? Number(m[1]) : Number(o.date.slice(0, 4));
}

/** Οι ημερομηνίες των δόσεων ενός εκκαθαριστικού, όπως τις ξέρει το φορολογικό ημερολόγιο. */
export function enfiaDueDates(year: number): EnfiaDue[] {
  return greekPropertyTaxObligations(year, 'owner')
    .filter(o => ENFIA_KINDS.has(o.kind))
    .map(o => ({ year, no: enfiaNo(o), date: o.date, ref: taxEventSource(o.id), confidence: o.confidence }))
    .filter(d => d.no > 0)
    .sort((a, b) => a.no - b.no);
}

/**
 * Η επόμενη ανοιχτή δόση ΕΝΦΙΑ από σήμερα, σε όποιο εκκαθαριστικό κι αν ανήκει:
 * τον Ιανουάριο του 2027 είναι η 11η του 2026, όχι κάποια του 2027.
 */
export function nextEnfiaDue(today: string, closed: ReadonlySet<string> = new Set()): EnfiaDue | null {
  const t = day(today);
  if (!t) return null;
  const next = taxObligationsHorizon(t, 'owner')
    .filter(o => ENFIA_KINDS.has(o.kind) && o.date >= t && !closed.has(taxEventSource(o.id)))[0];
  return next
    ? { year: enfiaYearOf(next), no: enfiaNo(next), date: next.date, ref: taxEventSource(next.id), confidence: next.confidence }
    : null;
}
