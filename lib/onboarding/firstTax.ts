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
export interface TaxDeadlineRow {
  id: string; title: string; date: string
  /**
   * Η υποχρέωση από την οποία βγήκε η γραμμή και το ποσό της δόσης, ώστε η
   * εφαρμογή στα αγγλικά να γράψει τίτλο και ημερομηνία από τα ίδια δεδομένα
   * (lib/i18n/en/app/overview.ts) και όχι από το ελληνικό κείμενο.
   */
  ob?: Pick<TaxObligation, 'id' | 'kind' | 'date' | 'confidence'>
  amount?: number
}

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
  return { id: o.id, title: SHORT_TITLE[o.kind] ?? o.title, date: deadlineDate(o), ob: o };
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

/** Ο ΕΝΦΙΑ του εκκαθαριστικού που πληρώνεται και η επόμενη δόση του, όταν το ποσό είναι γνωστό. */
export interface EnfiaPlan {
  /** Το έτος του εκκαθαριστικού που έγραψε ο χρήστης. */
  year: number;
  /**
   * Η επόμενη δόση του `year`· όταν δεν μένει καμία (`paidOff`), η τελευταία
   * του. `null` χωρίς ποσό, γιατί χωρίς ποσό δεν ξέρουμε πόσες δόσεις υπάρχουν.
   */
  row: TaxDeadlineRow | null;
  /** Η προθεσμία της τελευταίας δόσης του `year` έχει περάσει. */
  paidOff: boolean;
  /**
   * Μόνο με `paidOff`: το επόμενο εκκαθαριστικό, ΧΩΡΙΣ ποσό και χωρίς αριθμό
   * δόσης («ΕΝΦΙΑ 2027 · Μάρτιος 2027»). Ούτε το ποσό ούτε το πλήθος του είναι
   * γνωστά πριν εκδοθεί.
   */
  next: TaxDeadlineRow | null;
  /** Πόσες δόσεις, το ποσό των πρώτων και της τελευταίας· 0 χωρίς ποσό. */
  count: number;
  each: number;
  last: number;
  /**
   * Τα κλειδιά του ημερολογίου για τις δόσεις αυτού του εκκαθαριστικού
   * (`enfia-instalment-2026-6`…)· κενό χωρίς ποσό. Η ατζέντα κρύβει όσες δόσεις
   * του ίδιου έτους δεν είναι εδώ: 85€ δεν έχουν 9η δόση.
   */
  ids: string[];
  /**
   * Το έτος είναι γραμμένο ως εκδοθέν στο ημερολόγιο (ENFIA_ISSUED). Αλλιώς δεν
   * υπάρχει ούτε ποσό ούτε δόση: μόνο «ΕΝΦΙΑ {έτος} · {Μήνας έτος}» (`next`).
   */
  issued: boolean;
}

/** Το κλειδί ατζέντας μιας δόσης ΕΝΦΙΑ που δεν ανήκει στο εκκαθαριστικό (`tax:enfia-instalment-2026-9` για 85€). */
export function enfiaOutsidePlan(key: string, plan: Pick<EnfiaPlan, 'year' | 'ids'> | null | undefined): boolean {
  if (!plan || !plan.ids.length) return false;
  const m = /^tax:(enfia-(?:first|instalment|last)-(\d{4})(?:-\d+)?)$/.exec(key);
  return !!m && Number(m[2]) === plan.year && !plan.ids.includes(m[1]);
}

/**
 * Η ΔΙΑΙΡΕΣΗ ΣΕ ΚΟΜΜΑΤΙΑ ΠΟΥ ΑΘΡΟΙΖΟΝΤΑΙ ΣΤΟ ΣΥΝΟΛΟ (κριτική σχεδίασης r6). Η
 * πρόταση «12 δόσεις των 26,66€, η τελευταία 26,74€» έλεγε δώδεκα των 26,66 και
 * μετά τη διέψευδε: 12 × 26,66 = 319,92. Τα κομμάτια εδώ είναι ξένα μεταξύ
 * τους: 11 των 26,66 και μία των 26,74, δηλαδή 320.
 */
export function enfiaSplitParts(p: Pick<EnfiaPlan, 'count' | 'each' | 'last'>): { n: number; amount: number }[] {
  if (p.count <= 0) return [];
  if (p.count === 1) return [{ n: 1, amount: p.last }];
  return p.last === p.each ? [{ n: p.count, amount: p.each }] : [{ n: p.count - 1, amount: p.each }, { n: 1, amount: p.last }];
}

/** «11 δόσεις των 26,66€ και μία των 26,74€.», «12 δόσεις των 10,00€.», «Σε μία δόση.» */
export function enfiaSplitText(p: Pick<EnfiaPlan, 'count' | 'each' | 'last'>): string {
  const parts = enfiaSplitParts(p);
  if (!parts.length) return '';
  if (p.count === 1) return 'Σε μία δόση.';
  const many = (n: number, a: number) => n === 1 ? `μία δόση των ${fe(a)}` : `${n}\u00a0δόσεις των ${fe(a)}`;
  const [first, second] = parts;
  return second ? `${many(first.n, first.amount)} και μία των ${fe(second.amount)}.` : `${many(first.n, first.amount)}.`;
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
 * Ο ΕΝΦΙΑ ΤΟΥ ΑΚΙΝΗΤΟΥ ΠΟΥ ΔΕΝ ΝΟΙΚΙΑΖΕΤΑΙ (κριτική σχεδίασης r4, r5 και r6). Για
 * ιδιοχρησία ή κενό, ο φόρος που υπάρχει είναι ο ΕΝΦΙΑ.
 *
 * ΤΟ ΕΤΟΣ: του εκκαθαριστικού που έχει ο χρήστης στο χέρι, δηλαδή του
 * τελευταίου που εκδόθηκε. Από την έκδοση του Υ (μέσα Μαρτίου) είναι το Υ·
 * πριν από αυτήν, το Υ−1, του οποίου οι δόσεις τρέχουν ως τον Φεβρουάριο.
 *
 * ΟΧΙ ΣΤΟ ΕΠΟΜΕΝΟ ΕΤΟΣ ΜΕ ΤΟ ΙΔΙΟ ΠΟΣΟ (r6). Ως τώρα, όταν δεν έμενε δόση του
 * τρέχοντος έτους, η γραμμή πήγαινε στο επόμενο με το ΠΟΣΟ ΠΟΥ ΕΓΡΑΨΕ Ο
 * ΧΡΗΣΤΗΣ: 85€ τον Νοέμβριο του 2026 έβγαιναν «ΕΝΦΙΑ 2027 · 1η δόση 10,62€».
 * Το εκκαθαριστικό του 2027 δεν έχει εκδοθεί· ούτε το ποσό του ούτε το πλήθος
 * των δόσεων του είναι γνωστά. Συνέβαινε σε κάθε σύνολο κάτω από 90€. Τώρα το
 * έτος μένει του εκκαθαριστικού, η γραμμή δείχνει την τελευταία του δόση
 * (`paidOff`) και το επόμενο εκκαθαριστικό βγαίνει μόνο ως μήνας, χωρίς ποσό.
 *
 * ΟΙ ΔΟΣΕΙΣ: από το ποσό (r5). Ο νόμος θέλει τουλάχιστον 10€ τη δόση
 * (`enfiaInstalmentCount`, lib/tools/enfiaSchedule.ts), οπότε 60€ είναι έξι
 * δόσεις ως τον Αύγουστο. Το πλήθος περνά στο ημερολόγιο, όπως το περνούν η
 * ατζέντα και ο συγχρονισμός. Με μία δόση ο τίτλος είναι του ημερολογίου
 * («Πληρωμή σε μία δόση»), ποτέ «1η δόση». Χωρίς ποσό δεν βγαίνει γραμμή.
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
  const issueOf = (year: number) => greekPropertyTaxObligations(year, profile).find(x => x.kind === 'enfia-issue');
  const issued = (year: number) => issueOf(year)?.confidence === 'statutory';
  const issueY = issueOf(y);
  const bill = issueY && issueY.date <= today ? y : y - 1;
  const dueOf = (year: number) => greekPropertyTaxObligations(year, profile, { enfiaInstalments: { [year]: count } })
    .filter(x => ENFIA_DUE.has(x.kind)).sort((a, b) => a.date.localeCompare(b.date));
  // ΕΤΟΣ ΧΩΡΙΣ ΕΚΔΟΣΗ ΣΤΟ ΗΜΕΡΟΛΟΓΙΟ (κριτική σχεδίασης r7). Από την ανάρτηση της
  // ΑΑΔΕ τον Μάρτιο ως την ημέρα που το έτος γραφτεί στο ENFIA_ISSUED, ούτε οι
  // ημερομηνίες ούτε το πλήθος των δόσεων του είναι γνωστά στον κώδικα: το
  // ημερολόγιο βγάζει μόνο την 1η και τη 12η. Ως τώρα η γραμμή έγραφε τότε
  // «Τελευταία δόση 10,00€ · Φεβρουάριος 2028» για 60€, δόση που δεν υπάρχει.
  // Μένει το προηγούμενο εκκαθαριστικό, αν έχει ακόμη δόση· αλλιώς μόνο το
  // έτος και ο μήνας, χωρίς ποσό και χωρίς αριθμό δόσης.
  const year = !issued(bill) && count && issued(bill - 1) && dueOf(bill - 1).some(x => x.date >= today) ? bill - 1 : bill;
  if (!issued(year)) {
    // ΠΕΡΣΙΝΟΣ ΜΗΝΑΣ ΠΟΥ ΠΕΡΑΣΕ, ΤΟ ΕΠΟΜΕΝΟ ΕΤΟΣ (κριτική σχεδίασης r8). Την 1/2/2026 η
    // γραμμή έγραφε «ΕΝΦΙΑ 2025 · Μάρτιος 2025», μήνα του περασμένου χρόνου· τώρα
    // «ΕΝΦΙΑ 2026 · Μάρτιος 2026». Μέσα στο ίδιο έτος (Απρίλιος 2027) μένει
    // «ΕΝΦΙΑ 2027 · Μάρτιος 2027»: εκείνο είναι το εκκαθαριστικό που πληρώνεται.
    // Και στις δύο περιπτώσεις χωρίς ποσό: το ποσό που γράφτηκε δεν ανήκει εκεί.
    const firstOf = (yr: number) => greekPropertyTaxObligations(yr, profile).find(x => x.kind === 'enfia-first');
    const shown = year < y && (firstOf(year)?.date ?? today) < today ? year + 1 : year;
    const first = firstOf(shown);
    // Μόνο ο μήνας: το εκκαθαριστικό που ξέρει ο χρήστης δεν είναι αυτό.
    const next = first ? { id: first.id, title: `ΕΝΦΙΑ ${shown}`, date: monthYearLabel(first.date.slice(0, 7)), ob: first } : null;
    return { year: shown, row: null, paidOff: false, next, count: 0, each: 0, last: 0, ids: [], issued: false };
  }
  if (!count) return { year, row: null, paidOff: false, next: null, count: 0, each: 0, last: 0, ids: [], issued: true };
  const due = dueOf(year);
  const plan = enfiaInstalments(total, year, count);
  const each = plan[0]?.amount ?? 0, last = plan[plan.length - 1]?.amount ?? 0;
  const upcoming = due.find(x => x.date >= today);
  const paidOff = !upcoming;
  const o = upcoming ?? due[due.length - 1];
  const inst = o ? plan[instalmentNo(o, plan.length) - 1] : undefined;
  // ΕΞΟΦΛΗΜΕΝΟ: η περασμένη δόση χωρίς ποσό, ως ημερομηνία που πέρασε (r7). Ο
  // τίτλος της μίας δόσης είναι του ημερολογίου, ποτέ «1η δόση».
  const row = !o || !inst ? null
    : paidOff ? { id: o.id, title: plan.length === 1 ? enfiaShort(o.title) : 'Τελευταία δόση', date: deadlineDate(o), ob: o }
    : { id: o.id, title: `${enfiaShort(o.title)} ${fe(inst.amount)}`, date: deadlineDate(o), ob: o, amount: inst.amount };
  const nextFirst = paidOff ? greekPropertyTaxObligations(year + 1, profile).find(x => x.kind === 'enfia-first') : undefined;
  const next = nextFirst ? { id: nextFirst.id, title: `ΕΝΦΙΑ ${year + 1}`, date: deadlineDate(nextFirst), ob: nextFirst } : null;
  return { year, row, paidOff, next, count: plan.length, each, last, ids: due.map(x => x.id), issued: true };
}
