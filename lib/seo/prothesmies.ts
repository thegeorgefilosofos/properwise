// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΠΡΟΘΕΣΜΙΕΣ ΤΟΥ ΙΔΙΟΚΤΗΤΗ, ΜΗΝΑ ΜΗΝΑ — /prothesmies και /prothesmies/yyyy-mm
// ─────────────────────────────────────────────────────────────────────────
// ΜΙΑ ΠΗΓΗ. Κάθε γραμμή των σελίδων βγαίνει από το φορολογικό ημερολόγιο της
// εφαρμογής (lib/tax/greekTaxCalendar.ts), το ίδιο που γράφει τις προθεσμίες
// στο Ημερολόγιο και στέλνει τις υπενθυμίσεις. Δεν υπάρχει εδώ ούτε μία
// ημερομηνία ή υποχρέωση γραμμένη στο χέρι· ό,τι δεν έχει το ημερολόγιο δεν
// το λέει ούτε η σελίδα.
//
// ΔΥΟ ΚΟΙΝΑ. Οι υποχρεώσεις κάθε ιδιοκτήτη (προφίλ `owner`: ΕΝΦΙΑ, Ε9,
// δήλωση εισοδήματος) και όσες αφορούν μόνο τη βραχυχρόνια μίσθωση
// (`short_term`). Η ίδια υποχρέωση δεν γράφεται δύο φορές· όσες είναι μόνο της
// βραχυχρόνιας το λένε.
// ═══════════════════════════════════════════════════════════════════════════
import {
  greekPropertyTaxObligations, CONFIDENCE_LABEL, type TaxObligation,
} from '@/lib/tax/greekTaxCalendar';
import { MONTHS_NOM } from '@/lib/core/months';

/**
 * Η ημερομηνία του χάρτη για τις σελίδες των προθεσμιών: η τελευταία αλλαγή
 * του ΚΩΔΙΚΑ τους. Οι ημερομηνίες των προθεσμιών αλλάζουν μόνο με το
 * φορολογικό ημερολόγιο, δηλαδή με νέα έκδοση· τότε αλλάζει και αυτή.
 */
export const PROTHESMIES_UPDATED = '2026-10-29';

/** Η ρίζα των σελίδων. */
export const PROTHESMIES_PATH = '/prothesmies';

/** Μια προθεσμία του μήνα, με το κοινό της. */
export interface MonthDeadline {
  obligation: TaxObligation;
  /** `true` όταν αφορά μόνο όποιον έχει ακίνητο σε βραχυχρόνια μίσθωση. */
  shortTermOnly: boolean;
  /** «Ημερομηνία του νόμου» ή «Περυσινή ημερομηνία». */
  confidenceLabel: string;
}

/** «2026-10» → { year: 2026, month: 10 }, ή `null` για ό,τι δεν είναι μήνας. */
export function parseMonthKey(key: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(String(key ?? '').trim());
  if (!m) return null;
  const year = Number(m[1]), month = Number(m[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return { year, month };
}

/** { 2026, 10 } → «2026-10». */
export const monthKey = (year: number, month: number): string => `${year}-${String(month).padStart(2, '0')}`;

/** Ο μήνας της ημερομηνίας «YYYY-MM-DD» ως κλειδί. */
export const monthKeyOf = (isoDay: string): string => String(isoDay).slice(0, 7);

/** Ο επόμενος ή ο προηγούμενος μήνας. */
export function shiftMonth(key: string, by: number): string {
  const p = parseMonthKey(key);
  if (!p) return key;
  const i = p.year * 12 + (p.month - 1) + by;
  return monthKey(Math.floor(i / 12), (i % 12) + 1);
}

/** «Οκτώβριο 2026»: η αιτιατική, για «τον …». Οι ελληνικοί μήνες τη σχηματίζουν χωρίς το τελικό -ς. */
export function monthLabelAcc(key: string): string {
  const p = parseMonthKey(key);
  return p ? `${MONTHS_NOM[p.month - 1].replace(/ς$/, '')} ${p.year}` : key;
}

/** «Οκτώβριος 2026». */
export function monthLabel(key: string): string {
  const p = parseMonthKey(key);
  return p ? `${MONTHS_NOM[p.month - 1]} ${p.year}` : key;
}

/**
 * Οι προθεσμίες του μήνα, με σειρά ημερομηνίας. Οι υποχρεώσεις ενός μήνα
 * μπορεί να ανήκουν στο εκκαθαριστικό του προηγούμενου έτους (οι δόσεις ΕΝΦΙΑ
 * του Ιανουαρίου και του Φεβρουαρίου), γι' αυτό ρωτιούνται τρία έτη.
 */
export function deadlinesOfMonth(key: string): MonthDeadline[] {
  const p = parseMonthKey(key);
  if (!p) return [];
  const years = [p.year - 1, p.year, p.year + 1];
  const owner = years.flatMap(y => greekPropertyTaxObligations(y, 'owner'));
  const str = years.flatMap(y => greekPropertyTaxObligations(y, 'short_term'));
  const ownerIds = new Set(owner.map(o => o.id));
  const seen = new Set<string>();
  const out: MonthDeadline[] = [];
  for (const o of [...owner, ...str]) {
    if (monthKeyOf(o.date) !== key || seen.has(o.id)) continue;
    seen.add(o.id);
    out.push({ obligation: o, shortTermOnly: !ownerIds.has(o.id), confidenceLabel: CONFIDENCE_LABEL[o.confidence] });
  }
  return out.sort((a, b) => a.obligation.date.localeCompare(b.obligation.date) || a.obligation.id.localeCompare(b.obligation.id));
}

/**
 * Οι μήνες που ανοίγουν ως σελίδα: από τον τρέχοντα και δώδεκα μπροστά, όσοι
 * έχουν τουλάχιστον μία προθεσμία. Αυτούς δηλώνει ο χάρτης του ιστότοπου και
 * αυτούς χτίζει το `generateStaticParams`.
 */
export function upcomingMonths(today: string, count = 12): string[] {
  const start = monthKeyOf(today);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const k = shiftMonth(start, i);
    if (deadlinesOfMonth(k).length) out.push(k);
  }
  return out;
}

/** Η διαδρομή της σελίδας ενός μήνα. */
export const monthPath = (key: string): string => `${PROTHESMIES_PATH}/${key}`;
