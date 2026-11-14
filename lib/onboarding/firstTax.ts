// ═══════════════════════════════════════════════════════════════════════════
// Ο ΠΡΩΤΟΣ ΦΟΡΟΣ: ΤΟ ΠΟΣΟ ΠΟΥ ΒΛΕΠΕΙ Ο ΝΕΟΣ ΧΡΗΣΤΗΣ ΜΟΛΙΣ ΑΠΟΘΗΚΕΥΣΕΙ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΜΕΤΡΗΘΗΚΕ (13/11/2026). Ο νέος λογαριασμός περνούσε τέσσερις κάρτες
// υποδοχής και τον οδηγό, αποθήκευε και έβλεπε «Καθαρό 0,00€». Ο φόρος του
// ακινήτου υπήρχε, αλλά ως πλακίδιο 2.170 εικονοστοιχεία πιο κάτω σε
// υπολογιστή και 3.218 σε κινητό: τρεις με τέσσερις οθόνες κύλισης, χωρίς
// τίποτα να λέει ότι είναι εκεί.
//
// ΕΝΑΣ ΥΠΟΛΟΓΙΣΜΟΣ, Ο ΙΔΙΟΣ ΜΕ ΤΗΝ ΕΠΙΣΚΟΠΗΣΗ. Δεν υπάρχει εδώ κλίμακα ούτε
// συντελεστής: το ποσό βγαίνει από την `propertyRentTax` (lib/facts/rentTax.ts),
// την ίδια που γράφει το πλακίδιο «Φόρος ενοικίου». Αν γράφονταν δύο, η κάρτα
// του πρώτου ακινήτου θα έλεγε άλλο ποσό από την οθόνη που ανοίγει από κάτω.
//
// Για το ΠΡΩΤΟ ακίνητο τα έσοδα είναι μόνο ο στόχος ή το μίσθωμα του οδηγού:
// δεν υπάρχουν ακόμη εισπράξεις, διαμονές ή ενοικιαστής. Ο ίδιος δρόμος δίνει
// και την προεπισκόπηση μέσα στον οδηγό, πριν από την αποθήκευση.
// ═══════════════════════════════════════════════════════════════════════════
import { propertyRentTax } from '@/lib/facts/rentTax';
import { readStatus, type PropertyStatus, type StatusRow } from '@/lib/property/status';
import { taxProfileOfStatus } from '@/lib/facts/deadlines';
import { greekPropertyTaxObligations, type TaxObligation } from '@/lib/tax/greekTaxCalendar';
import { monthYearLabel } from '@/lib/core/months';
import { grDate, fe } from '@/lib/core/format';
import { enfiaInstalmentCount, enfiaInstalments } from '@/lib/tools/enfiaSchedule';

/** Οι στήλες του ακινήτου που χρειάζεται ο πρώτος φόρος. */
export interface FirstTaxProperty extends StatusRow {
  id: string;
  target_rent?: number | string | null;
  ownership?: number | string | null;
  enfia?: number | string | null;
}

export interface FirstTax {
  status: PropertyStatus;
  /** Νοικιάζεται, άρα έχει φόρο ενοικίων. */
  rented: boolean;
  /** Ο μηνιαίος στόχος ή το μίσθωμα που γράφτηκε· 0 χωρίς ποσό. */
  monthly: number;
  /** Τα ετήσια έσοδα για τον φόρο, όλου του ακινήτου. */
  annual: number;
  /** Ο φόρος ενοικίων της χρονιάς, όλου του ακινήτου, όπως στην Επισκόπηση. */
  tax: number;
  /** Ο ΕΝΦΙΑ που δήλωσε ο χρήστης, ανά έτος· `null` χωρίς τιμή. */
  enfia: number | null;
  year: number;
}

const positive = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Νοικιάζεται; Μόνο οι δύο μισθώσεις έχουν φόρο ενοικίων. */
export const isRented = (s: PropertyStatus): boolean => s === 'rent_long' || s === 'rent_short';

/**
 * Ο φόρος ενοικίων ενός ακινήτου χωρίς ακόμη εισπράξεις: ο ίδιος υπολογισμός με
 * την Επισκόπηση, για έναν ιδιώτη με αυτό το ένα ακίνητο.
 */
export function firstTaxOf(p: FirstTaxProperty, today: string): FirstTax {
  const status = readStatus(p);
  const year = Number(today.slice(0, 4));
  const monthly = positive(p.target_rent);
  const income = new Map([[p.id, { rents: [], stays: [], targetMonthly: monthly || null, viaBank: true }]]);
  const r = propertyRentTax({ props: [p], propertyId: p.id, ownerClientIds: null, income, year, today });
  const enfia = positive(p.enfia);
  return {
    status, rented: isRented(status), monthly,
    annual: r.income.annual, tax: r.tax,
    enfia: enfia > 0 ? enfia : null, year,
  };
}

/**
 * Η ΠΡΟΘΕΣΜΙΑ ΠΟΥ ΑΝΗΚΕΙ ΣΤΟ ΠΟΣΟ (κριτική σχεδίασης r3, 13/11/2026).
 *
 * Το ποσό είναι ο φόρος ενοικίων του φορολογικού έτους `incomeYear` (τα
 * μισθώματα του 2026). Αυτός ο φόρος δηλώνεται και πληρώνεται το ΕΠΟΜΕΝΟ
 * έτος: με τη δήλωση του `incomeYear + 1`. Στο ημερολόγιο
 * (lib/tax/greekTaxCalendar.ts) κάθε υποχρέωση κρατά το έτος ΔΗΛΩΣΗΣ, οπότε η
 * σωστή γραμμή είναι η `income-decl` του `incomeYear + 1`.
 *
 * ΤΙ ΗΤΑΝ ΛΑΘΟΣ. Η γραμμή έπαιρνε την επόμενη προθεσμία φόρου εισοδήματος από
 * σήμερα: τον Νοέμβριο του 2026 αυτή ήταν «5η δόση 30/11/2026», δόση της
 * δήλωσης 2026, δηλαδή του φόρου για τα εισοδήματα του 2025. Δίπλα στον φόρο
 * των ενοικίων του 2026 έλεγε «πληρώνεις 1.026€ ως τις 30/11/2026». Ενας νέος
 * ιδιοκτήτης χωρίς ενοίκια το 2025 δεν χρωστά τίποτα εκείνη τη μέρα.
 *
 * Η ημερομηνία της δήλωσης ανακοινώνεται κάθε χρόνο· το ημερολόγιο τη δίνει με
 * `confidence: 'announced'`, οπότε η γραμμή γράφει μόνο μήνα και έτος
 * (`deadlineDate`), ποτέ μέρα που δεν είναι γνωστή.
 */
export function incomeTaxDeadline(status: PropertyStatus, incomeYear: number): TaxObligation | null {
  if (!isRented(status) || !Number.isInteger(incomeYear)) return null;
  return greekPropertyTaxObligations(incomeYear + 1, taxProfileOfStatus(status)).find(o => o.kind === 'income-decl') ?? null;
}

/** Η μία γραμμή κάτω από το ποσό: σύντομος τίτλος και ημερομηνία στην ακρίβεια που ξέρουμε. */
export interface TaxDeadlineRow { id: string; title: string; date: string }

/**
 * ΣΥΝΤΟΜΟΙ ΤΙΤΛΟΙ ΓΙΑ ΤΙΣ ΜΙΚΡΕΣ ΚΑΡΤΕΣ (κριτική σχεδίασης r4). Ο τίτλος του
 * ημερολογίου («Δήλωση εισοδήματος (Ε1/Ε2 ακινήτων)») μένει στο Ημερολόγιο· στην
 * υποδοχή και στον οδηγό ο κωδικός του εντύπου ήταν ορολογία και στα 320
 * ακουμπούσε την ημερομηνία. Ό,τι δεν έχει σύντομο όνομα κρατά τον τίτλο του.
 */
const SHORT_TITLE: Partial<Record<TaxObligation['kind'], string>> = {
  'income-decl': 'Δήλωση φόρου εισοδήματος',
};

/**
 * Η ΗΜΕΡΟΜΗΝΙΑ ΣΤΗΝ ΑΚΡΙΒΕΙΑ ΠΟΥ ΞΕΡΕΙ Ο ΚΩΔΙΚΑΣ (κριτική σχεδίασης r4). Προθεσμία
 * του νόμου (`statutory`): ολόκληρη, ηη/μμ/εεεε. Προθεσμία που ανακοινώνεται κάθε
 * χρόνο (`announced`): μόνο ο μήνας και το έτος («Ιούλιος 2027»). Η μέρα δεν είναι
 * γνωστή πριν από την ανακοίνωση της ΑΑΔΕ· η ημέρα με την ετικέτα «Περυσινή
 * ημερομηνία» κάτω από ένα 2027 διαβαζόταν σαν αντίφαση.
 */
export function deadlineDate(o: Pick<TaxObligation, 'date' | 'confidence'>): string {
  return o.confidence === 'statutory' ? grDate(o.date) : monthYearLabel(o.date.slice(0, 7));
}

/** Μία προθεσμία του ημερολογίου ως γραμμή της κάρτας. */
export function deadlineRowOf(o: TaxObligation): TaxDeadlineRow {
  return { id: o.id, title: SHORT_TITLE[o.kind] ?? o.title, date: deadlineDate(o) };
}

/**
 * Η ΓΡΑΜΜΗ ΚΑΤΩ ΑΠΟ ΤΟΝ ΦΟΡΟ ΕΝΟΙΚΙΩΝ, ΓΡΑΜΜΕΝΗ ΜΙΑ ΦΟΡΑ. Υποδοχή και οδηγός
 * διαβάζουν αυτή: μία γραμμή, η δήλωση που φορολογεί το ίδιο εισόδημα. Ο ΕΝΦΙΑ
 * ζει στο Ημερολόγιο.
 */
export function taxDeadlineRow(status: PropertyStatus, incomeYear: number): TaxDeadlineRow | null {
  const o = incomeTaxDeadline(status, incomeYear);
  return o ? deadlineRowOf(o) : null;
}

const ENFIA_DUE = new Set<TaxObligation['kind']>(['enfia-first', 'enfia-instalment', 'enfia-last']);

/** Ο ΕΝΦΙΑ του έτους που πληρώνεται και η επόμενη δόση του, όταν το ποσό είναι γνωστό. */
export interface EnfiaPlan {
  year: number;
  /** Η επόμενη δόση· `null` χωρίς ποσό, γιατί χωρίς ποσό δεν ξέρουμε πόσες δόσεις υπάρχουν. */
  row: TaxDeadlineRow | null;
  /** Πόσες δόσεις, το ποσό των πρώτων και της τελευταίας· 0 χωρίς ποσό. */
  count: number;
  each: number;
  last: number;
}

/** «ΕΝΦΙΑ, 9η δόση» → «9η δόση»: ο τίτλος της κάρτας λέει ήδη «ΕΝΦΙΑ». */
const enfiaShort = (title: string): string => {
  const t = title.replace(/^ΕΝΦΙΑ,\s*/, '');
  return t.charAt(0).toLocaleUpperCase('el') + t.slice(1);
};

/** Ο αριθμός της δόσης από το κλειδί του ημερολογίου (`enfia-instalment-2026-9` → 9). */
const instalmentNo = (o: TaxObligation, count: number): number =>
  o.kind === 'enfia-first' ? 1 : o.kind === 'enfia-last' ? count : Number(o.id.split('-').pop());

/**
 * Ο ΕΝΦΙΑ ΤΟΥ ΑΚΙΝΗΤΟΥ ΠΟΥ ΔΕΝ ΝΟΙΚΙΑΖΕΤΑΙ (κριτική σχεδίασης r4 και r5). Για
 * ιδιοχρησία ή κενό, ο φόρος που υπάρχει είναι ο ΕΝΦΙΑ.
 *
 * ΤΟ ΕΤΟΣ: του ΕΝΦΙΑ που πληρώνεται τώρα. Οι δόσεις του έτους Υ τρέχουν ως τον
 * Φεβρουάριο του Υ+1, οπότε τον Ιανουάριο του 2027 η επόμενη δόση είναι ακόμη
 * του ΕΝΦΙΑ 2026. Αν δεν μένει καμία δόση του τρέχοντος έτους, του επόμενου.
 *
 * ΟΙ ΔΟΣΕΙΣ: από το ποσό (r5). Ο νόμος θέλει τουλάχιστον 10€ τη δόση
 * (`enfiaInstalmentCount`, lib/tools/enfiaSchedule.ts), οπότε 60€ είναι έξι
 * δόσεις ως τον Αύγουστο. Χωρίς το πλήθος το ημερολόγιο υποθέτει δώδεκα και η
 * γραμμή έλεγε «9η δόση 30/11/2026», πληρωμή που δεν υπάρχει. Το πλήθος
 * περνά στο ημερολόγιο (`enfiaInstalments`), όπως το περνούν η ατζέντα και ο
 * συγχρονισμός. Χωρίς ποσό δεν βγαίνει γραμμή δόσης καθόλου.
 *
 * ΤΟ ΠΟΣΟ ΤΗΣ ΔΟΣΗΣ: από την ίδια `enfiaInstalments` με την ατζέντα (οι πρώτες
 * κόβονται προς τα κάτω στο λεπτό, η τελευταία παίρνει τη διαφορά).
 */
export function enfiaDeadline(status: PropertyStatus, today: string, annual?: number | null): EnfiaPlan | null {
  const y = Number(today.slice(0, 4));
  if (!Number.isInteger(y)) return null;
  const profile = taxProfileOfStatus(status);
  const total = typeof annual === 'number' && annual > 0 ? annual : 0;
  const count = enfiaInstalmentCount(total);
  for (const year of [y - 1, y, y + 1]) {
    const opts = count ? { enfiaInstalments: { [year]: count } } : {};
    const o = greekPropertyTaxObligations(year, profile, opts).find(x => ENFIA_DUE.has(x.kind) && x.date >= today);
    if (!o) continue;
    if (!count) return { year, row: null, count: 0, each: 0, last: 0 };
    const plan = enfiaInstalments(total, year, count);
    const inst = plan[instalmentNo(o, plan.length) - 1];
    const each = plan[0]?.amount ?? 0, last = plan[plan.length - 1]?.amount ?? 0;
    const row = inst ? { id: o.id, title: `${enfiaShort(o.title)} ${fe(inst.amount)}`, date: deadlineDate(o) } : null;
    return { year, row, count: plan.length, each, last };
  }
  return null;
}
