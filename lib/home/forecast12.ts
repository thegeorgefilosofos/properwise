// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΕΠΟΜΕΝΟΙ 12 ΜΗΝΕΣ: Ο ΜΗΝΑΣ ΠΟΥ ΣΕ ΣΤΡΙΜΩΧΝΕΙ, ΑΠΟ ΤΩΡΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΕΛΕΙΠΕ. Η εφαρμογή ήξερε ήδη κάθε κομμάτι: τις δώδεκα δόσεις του ΕΝΦΙΑ με
// ημερομηνία, τις οκτώ του φόρου εισοδήματος, τη δόση του δανείου, το ενοίκιο
// του μισθωτηρίου και πότε λήγει, την ανανέωση της ασφάλισης, τους
// λογαριασμούς που έρχονται κάθε δίμηνο. Τα έλεγε σε πέντε διαφορετικές
// καρτέλες. Κανείς δεν τα έβαζε στον ίδιο μήνα, οπότε ο ιδιοκτήτης μάθαινε τον
// Φεβρουάριο ότι εκεί έπεφταν μαζί η τελευταία δόση ΕΝΦΙΑ, η τελευταία του
// φόρου και η δόση του δανείου.
//
// ΤΙ ΚΑΝΕΙ ΚΑΙ ΤΙ ΔΕΝ ΚΑΝΕΙ. ΚΑΜΙΑ ΝΕΑ ΜΗΧΑΝΗ ΠΟΣΩΝ. Κάθε ποσό εδώ είναι η
// έξοδος μιας μηχανής που ήδη υπάρχει και ήδη δείχνεται σε άλλη οθόνη:
//
//   ΕΝΦΙΑ             enfiaYear (lib/facts/enfia.ts) → enfiaInstalments
//   φόρος εισοδήματος INCOME_TAX_INSTALMENTS (lib/tax/greekTaxCalendar.ts) πάνω
//                     στο σαρωμένο εκκαθαριστικό ή στην εκτίμηση φόρου ενοικίων
//                     της ίδιας οθόνης
//   δάνειο            loanInstalment (lib/loans/shape.ts), ημερομηνίες με τη
//                     σύμβαση του loanProgress (lib/loans/progress.ts addMonths)
//   λογαριασμοί       mergeLedger (lib/expenses/ledger.ts) και expectedSeries
//                     (lib/expenses/expected.ts)
//   διαμονές          hostPayout ?? stayTotal, ο κανόνας του hostingReceipts
//
// Εδώ γίνεται ΜΟΝΟ η τοποθέτηση στους μήνες και η σήμανση: βέβαιο (χαρτί,
// μισθωτήριο, σύμβαση) ή αναμενόμενο (εκτίμηση, συνήθεια, ανανέωση).
//
// ΔΕΝ ΕΙΝΑΙ ΤΟ ΤΑΜΕΙΟ. Το lib/home/cash.ts λέει ρητά «Δεν προβλέπει, δεν
// ετησιοποιεί»· το «Σου οφείλουν / Οφείλεις» μένει όπως είναι. Αυτό εδώ είναι
// άλλη ερώτηση με άλλη κάρτα: «τι έρχεται». Ό,τι έχει ήδη λήξει δεν μπαίνει·
// το λέει το Ταμείο.
//
// ΚΑΜΙΑ ΕΤΥΜΗΓΟΡΙΑ. Ο πιο σφιχτός μήνας λέγεται με το όνομά του και με τις
// χρεώσεις που πέφτουν μαζί, όχι με κόκκινο. Ο ΕΝΦΙΑ δεν είναι αποτυχία.
//
// ΤΟ ΑΓΝΩΣΤΟ ΔΕΝ ΓΙΝΕΤΑΙ ΜΗΔΕΝ. Μίσθωση που λήγει δίνει «κενό;» στους επόμενους
// μήνες, ποτέ μηδενικό ενοίκιο. Δόση φόρου χωρίς εκκαθαριστικό δίνει «λείπει».
// ═══════════════════════════════════════════════════════════════════════════

import { enfiaYear, type EnfiaSettings, type EnfiaFacts } from '@/lib/facts/enfia';
import { enfiaDueDates } from '@/lib/facts/deadlines';
import { INCOME_TAX_INSTALMENTS, lastWorkingDayOfMonth } from '@/lib/tax/greekTaxCalendar';
import { loanInstalment, isActiveLoan, type LoanRow } from '@/lib/loans/shape';
import { addMonths } from '@/lib/loans/progress';
import { expectedSeries, seriesKey, cadenceLabel } from '@/lib/expenses/expected';
import { entryName, type LedgerEntry } from '@/lib/expenses/ledger';
import { resolveCategory } from '@/lib/expenses/taxonomy';
import { hostPayout, type StayAmountLike } from '@/lib/clients/stayAmounts';
import { stayTotal } from '@/lib/clients/clients';
import { roundHalfUp } from '../core/money';
import { MONTHS_NOM, MONTHS_GEN, MONTHS_ACC, monthGen } from '../core/months';
import { grDate } from '../core/format';
import { instalmentPeriods, monthsPerInstalment, type PaymentFreq } from '@/lib/rent/frequency';

/** Πόσοι μήνες. Ο τρέχων και οι έντεκα επόμενοι. */
export const FORECAST_MONTHS = 12;

export type FlowKind = 'rent' | 'stay' | 'enfia' | 'income_tax' | 'loan' | 'insurance' | 'bill' | 'recurring';

/**
 * ΒΕΒΑΙΟ: υπάρχει χαρτί ή σύμβαση (εκκαθαριστικό, μισθωτήριο, σταθερό επιτόκιο,
 * καταχωρημένος λογαριασμός). ΑΝΑΜΕΝΟΜΕΝΟ: εκτίμηση, συνήθεια ή ανανέωση.
 * Στην οθόνη: συμπαγές το πρώτο, διακεκομμένο το δεύτερο.
 */
export type Certainty = 'actual' | 'expected';

export interface ForecastLine {
  kind: FlowKind;
  /** «ΕΝΦΙΑ 8/12», «Ενοίκιο», «Δόση δανείου». */
  label: string;
  /** Από πού βγήκε, με λέξεις: «εκκαθαριστικό ΕΝΦΙΑ 2026», «μισθωτήριο». */
  source: string;
  /** Πάντα θετικό· η φορά το λέει το `dir`. */
  amount: number;
  dir: 'in' | 'out';
  certainty: Certainty;
  /** ISO, όταν η ημέρα είναι γνωστή. */
  date: string | null;
}

/**
 * Ό,τι ΔΕΝ ξέρουμε, στη θέση του. `vacancy` = μετά τη λήξη μίσθωσης («κενό;»),
 * `missing` = υπάρχει χρέωση, λείπει το ποσό, `unrecorded` = η δόση ενοικίου
 * του τρέχοντος μήνα έληξε και δεν έχει σημειωθεί αν μπήκε, `owed` = έληξε
 * απλήρωτη και είναι ήδη στο Ταμείο.
 */
export interface ForecastGap {
  kind: 'vacancy' | 'missing' | 'unrecorded' | 'owed';
  flow: FlowKind;
  label: string;
  hint: string;
  /**
   * ΜΟΝΟ για το σχέδιο: το μηνιαίο μίσθωμα που θα έλειπε, ώστε το άδειο πλαίσιο
   * του «κενό;» να έχει το ύψος ενός μήνα. Δεν μπαίνει σε κανένα άθροισμα.
   */
  level?: number;
}

export interface ForecastMonth {
  /** «2026-10». */
  ym: string;
  year: number;
  /** 1–12. */
  month: number;
  lines: ForecastLine[];
  gaps: ForecastGap[];
  inActual: number;
  inExpected: number;
  outActual: number;
  outExpected: number;
  /** Εισροές μείον εκροές του μήνα. */
  net: number;
  /** Το άθροισμα των `net` ως και αυτόν τον μήνα, με αφετηρία το μηδέν. */
  cumulative: number;
}

export interface Forecast {
  months: ForecastMonth[];
  /** Ο μήνας με το χαμηλότερο καθαρό, ανάμεσα σε όσους έχουν εκροή. */
  tightest: { index: number; net: number; drivers: ForecastLine[] } | null;
  /** Καμία γραμμή και κανένα κενό: η κάρτα δείχνει οδηγία. */
  empty: boolean;
  /** Πόσοι μήνες έχουν έστω μία γραμμή. */
  monthsWithLines: number;
  gapCount: number;
}

// ── ΕΙΣΟΔΟΙ ─────────────────────────────────────────────────────────────────

/** Περίοδος του `rent_payments`, πληρωμένη ή όχι. */
export interface RentPeriodLike {
  amount: number | null;
  due_date?: string | null;
  paid: boolean | null;
  period_year?: number | null;
  period_month?: number | null;
}

/** Το σαρωμένο εκκαθαριστικό φόρου εισοδήματος: ποσό και φορολογικό έτος. */
export interface IncomeTaxStatement {
  taxYear: number;
  amount: number;
}

export interface ForecastInput {
  /** Σήμερα, Αθήνα, «YYYY-MM-DD». */
  today: string;
  /**
   * Ο τρέχων μισθωτής. `null` χωρίς μίσθωση. `freq` και `dueDay` όπως στην
   * καρτέλα του: μια τριμηνιαία δόση είναι τρία μισθώματα στον πρώτο μήνα της.
   */
  lease: {
    monthlyRent: number | null; start: string | null; end: string | null;
    freq?: PaymentFreq | string | null; dueDay?: number | null;
  } | null;
  /** Περίοδοι ενοικίου, πληρωμένες και απλήρωτες. */
  rentPeriods?: readonly RentPeriodLike[];
  /** Διαμονές βραχυχρόνιας. Μετρούν μόνο όσες έχουν άφιξη μέσα στο παράθυρο. */
  stays?: readonly (StayAmountLike & { check_in?: string | null })[];
  /** Ο ΕΝΦΙΑ: ό,τι παίρνει η `enfiaYear`, συν τις δόσεις που έκλεισαν. */
  enfia?: { settings: EnfiaSettings; facts: EnfiaFacts; closedRefs?: ReadonlySet<string> } | null;
  /**
   * Ο φόρος εισοδήματος. ΜΟΝΟ φυσικό πρόσωπο με εισόδημα από το ακίνητο: η
   * εταιρεία έχει άλλους κανόνες δόσεων και το κενό ακίνητο δεν φορολογείται.
   * `estimate`: η εκτίμηση φόρου ενοικίων της οθόνης για το έτος της.
   */
  incomeTax?: { statements: readonly IncomeTaxStatement[]; estimate: IncomeTaxStatement | null } | null;
  loans?: readonly LoanRow[];
  insurance?: { expiry: string | null; amount: number | null } | null;
  /** Το ενιαίο ημερολόγιο λογαριασμών και δαπανών (`mergeLedger`). */
  ledger?: readonly LedgerEntry[];
}

// ── ΜΗΝΕΣ ΩΣ ΑΡΙΘΜΟΙ ─────────────────────────────────────────────────────────

const ISO = /^(\d{4})-(\d{2})-(\d{2})/;
const isoDay = (v: string | null | undefined): string | null => {
  const m = v ? ISO.exec(v) : null;
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};
/** Απόλυτος μήνας: έτος × 12 + (μήνας − 1). */
const idxOf = (iso: string): number => +iso.slice(0, 4) * 12 + (+iso.slice(5, 7) - 1);
const ymOf = (idx: number): string => `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
const pos = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const cents = (n: number) => roundHalfUp(n, 2);
/** Προς τα κάτω στο λεπτό, με τη διόρθωση του δυαδικού δεκαδικού (enfiaSchedule.ts). */
const centsDown = (n: number) => Math.floor(n * 100 + 1e-9) / 100;

/**
 * Οι δόσεις του φόρου εισοδήματος ενός φορολογικού έτους.
 *
 * ΤΟ ΠΛΗΘΟΣ ΚΑΙ Ο ΜΗΝΑΣ ΕΙΝΑΙ ΤΟΥ ΝΟΜΟΥ, ΟΧΙ ΔΙΚΑ ΜΑΣ. ΚΦΕ άρθρο 67 παρ. 4,
 * όπως γράφεται δίπλα στη σταθερά (lib/tax/greekTaxCalendar.ts): ισόποσες
 * μηνιαίες δόσεις, η πρώτη ως την τελευταία εργάσιμη του Ιουλίου του επόμενου
 * έτους και κάθε επόμενη ως την τελευταία εργάσιμη του μήνα της. Οι ημέρες
 * βγαίνουν από την ίδια `lastWorkingDayOfMonth` με τις δόσεις ΕΝΦΙΑ.
 *
 * ΤΑ ΛΕΠΤΑ ΚΛΕΙΝΟΥΝ ΟΠΩΣ ΣΤΟΝ ΕΝΦΙΑ: οι πρώτες κόβονται προς τα κάτω και η
 * τελευταία παίρνει τη διαφορά, ώστε το άθροισμα να είναι ΠΑΝΤΑ το ποσό.
 */
// ═══ «ΔΕΗ ΙΟΥΝΙΟΥ» ΤΟΝ ΝΟΕΜΒΡΙΟ ═══════════════════════════════════════════
// Η σειρά που προβάλλεται παίρνει το όνομα της ΤΕΛΕΥΤΑΙΑΣ της εμφάνισης. Οταν
// ο χρήστης (ή η σάρωση) ονομάζει τον λογαριασμό με την περίοδό του, η πρόβλεψη
// του Νοεμβρίου έγραφε «ΔΕΗ Ιουνίου» και η κάρτα έλεγε «Πέφτουν μαζί: ΔΕΗ
// Ιουνίου 91,35€» τον Νοέμβριο. Ο μήνας της περιόδου βγαίνει από το όνομα:
// η προβολή κρατά μόνο τον πάροχο, ο πραγματικός λογαριασμός που λήγει άλλον
// μήνα λέει ρητά ποια περίοδο αφορά.
// Χωρίς τόνους και πεζά, γράμμα προς γράμμα: «ΙΟΥΝΙΟΥ» και «Ιουνίου» είναι η
// ίδια λέξη και το μήκος μένει ίδιο, ώστε οι θέσεις να ισχύουν στο πρωτότυπο.
const fold = (t: string): string => Array.from(t, c => (c.normalize('NFD')[0] ?? c).toLowerCase()).join('');
const MONTH_WORDS: [RegExp, number][] = [MONTHS_GEN, MONTHS_NOM, MONTHS_ACC].flatMap(list =>
  list.map((w, i): [RegExp, number] => [new RegExp(`(^|[\\s(,/–-])${fold(w)}(\\s+\\d{4})?(?=$|[\\s),/–-])`, 'u'), i]));

/** Το όνομα χωρίς τον μήνα της περιόδου μαζί με τον μήνα (0–11). */
export function splitPeriod(title: string): { base: string; period: number | null } {
  const folded = fold(title);
  if (folded.length !== title.length) return { base: title, period: null };
  for (const [re, i] of MONTH_WORDS) {
    const m = folded.match(re);
    if (!m) continue;
    const base = (title.slice(0, m.index! + m[1].length) + title.slice(m.index! + m[0].length))
      .replace(/\(\s*\)/g, '').replace(/\s*[-–,/]\s*$/, '').replace(/^\s*[-–,/]\s*/, '').replace(/\s{2,}/g, ' ').trim();
    if (base) return { base, period: i };
  }
  return { base: title, period: null };
}

/** Πραγματικός λογαριασμός: η περίοδος λέγεται όταν δεν συμπίπτει με τη λήξη. */
export function billLabel(title: string, dueIso: string): string {
  const { base, period } = splitPeriod(title);
  if (period === null || period === +dueIso.slice(5, 7) - 1) return title;
  return `${base} (περίοδος ${monthGen(period)})`;
}

export function incomeTaxInstalments(amount: number, taxYear: number): { no: number; date: string; amount: number }[] {
  if (!(amount > 0)) return [];
  const each = centsDown(amount / INCOME_TAX_INSTALMENTS);
  const out = [];
  for (let i = 0; i < INCOME_TAX_INSTALMENTS; i++) {
    const m = 6 + i; // Ιούλιος = 6, με αρίθμηση της JavaScript
    const last = i === INCOME_TAX_INSTALMENTS - 1;
    out.push({
      no: i + 1,
      date: lastWorkingDayOfMonth(taxYear + 1 + Math.floor(m / 12), m % 12),
      amount: last ? cents(amount - each * (INCOME_TAX_INSTALMENTS - 1)) : each,
    });
  }
  return out;
}

// ── Η ΣΥΝΑΡΤΗΣΗ ──────────────────────────────────────────────────────────────

export function forecast12(input: ForecastInput): Forecast {
  const today = isoDay(input.today);
  if (!today) return { months: [], tightest: null, empty: true, monthsWithLines: 0, gapCount: 0 };
  const first = idxOf(today);
  const last = first + FORECAST_MONTHS - 1;
  const lines: { idx: number; line: ForecastLine }[] = [];
  const gaps: { idx: number; gap: ForecastGap }[] = [];

  // Γραμμή με ημερομηνία: μπαίνει αν πέφτει από σήμερα και μετά, μέσα στο
  // παράθυρο. ΧΩΡΙΣ ημερομηνία (μήνας μόνο): μόνο στους ΕΠΟΜΕΝΟΥΣ μήνες. Στον
  // τρέχοντα δεν ξέρουμε αν πέρασε ήδη, οπότε δεν τη μαντεύουμε.
  const put = (idx: number, line: ForecastLine) => {
    if (idx < first || idx > last) return;
    if (line.date ? line.date < today : idx === first) return;
    if (!(line.amount > 0)) return;
    lines.push({ idx, line: { ...line, amount: cents(line.amount) } });
  };
  const putDated = (line: ForecastLine & { date: string }) => put(idxOf(line.date), line);
  const gapAt = (idx: number, gap: ForecastGap) => { if (idx >= first && idx <= last) gaps.push({ idx, gap }); };

  // ── ΕΝΟΙΚΙΟ ΜΑΚΡΟΧΡΟΝΙΑΣ ──────────────────────────────────────────────
  // Ο ΜΗΝΑΣ ΜΕ ΚΑΤΑΓΡΑΦΗ ΛΕΕΙ ΤΗΝ ΑΛΗΘΕΙΑ ΤΟΥ. Πληρωμένη περίοδος δεν είναι
  // μελλοντικό χρήμα· απλήρωτη μπαίνει με το ποσό και την προθεσμία της. Μήνας
  // χωρίς καταγραφή παίρνει τη δόση του μισθωτηρίου, μέσα στη διάρκειά του.
  //
  // ΟΙ ΔΟΣΕΙΣ ΑΠΟ ΤΗ ΓΕΝΝΗΤΡΙΑ ΤΟΥ `rent_payments`, ΟΧΙ ΜΗΝΑ-ΜΗΝΑ. Με μίσθωμα
  // κάθε μήνα, η τριμηνιαία δόση του Οκτωβρίου (τρία μισθώματα) έπαιρνε δίπλα
  // της και Νοέμβριο και Δεκέμβριο: δύο μισθώματα που δεν θα έρθουν ποτέ. Το
  // `instalmentPeriods` (lib/rent/frequency.ts) είναι ο κανόνας που γράφει και
  // τις δόσεις στη βάση· εδώ απλώς συνεχίζει ως το τέλος του παραθύρου.
  const byMonth = new Map<number, RentPeriodLike[]>();
  for (const p of input.rentPeriods ?? []) {
    if (!p.period_year || !p.period_month) continue;
    const k = p.period_year * 12 + (p.period_month - 1);
    const l = byMonth.get(k);
    if (l) l.push(p); else byMonth.set(k, [p]);
  }
  const lease = input.lease;
  const monthly = pos(lease?.monthlyRent);
  const leaseStart = isoDay(lease?.start);
  const leaseEnd = isoDay(lease?.end);
  const freq = (lease?.freq ?? null) as PaymentFreq | null;
  const step = monthsPerInstalment(freq);
  // Χωρίς έναρξη, οι δόσεις μετρούν από τον τρέχοντα μήνα. Με έναρξη πολύ πίσω,
  // η αφετηρία έρχεται κοντά στο παράθυρο με ακέραια βήματα, ώστε η φάση της
  // τριμηνιαίας να μένει ίδια και ο φρουρός των 600 δόσεων να μην την κόβει.
  const startIdx = leaseStart ? idxOf(leaseStart) : first;
  const anchor = `${ymOf(startIdx + Math.max(0, Math.floor((first - startIdx) / step) * step))}-01`;
  const periods = new Map<number, { months: number; due: string }>();
  if (lease && monthly) {
    for (const p of instalmentPeriods({
      startISO: anchor, lastYear: Math.floor(last / 12), lastMonth: (last % 12) + 1,
      freq, dueDay: lease.dueDay ?? 1,
    })) periods.set(p.year * 12 + (p.month - 1), { months: p.months, due: p.due_date });
  }
  const endIdx = leaseEnd ? idxOf(leaseEnd) : Infinity;
  for (let idx = first; idx <= last; idx++) {
    const recs = byMonth.get(idx);
    if (recs && recs.length) {
      for (const r of recs) {
        if (r.paid) continue;
        const due = isoDay(r.due_date);
        if (due && due < today) {
          // Ληξιπρόθεσμη του τρέχοντος μήνα: τη μετρά το Ταμείο, όχι εδώ. Λέγεται
          // όμως στη θέση της, ώστε ο μήνας να μη φαίνεται φτωχότερος απ' ό,τι είναι.
          gapAt(idx, { kind: 'owed', flow: 'rent', label: 'Ενοίκιο', hint: `Έληγε ${grDate(due)}. Φαίνεται στο Ταμείο, πιο πάνω.` });
          continue;
        }
        put(idx, { kind: 'rent', label: 'Ενοίκιο', source: 'δόση ενοικίου', amount: pos(r.amount), dir: 'in', certainty: 'actual', date: due });
      }
      continue;
    }
    if (!lease || !monthly) continue;
    if (leaseStart && idx < idxOf(leaseStart)) continue;
    if (idx > endIdx) {
      // Ο μήνας της λήξης εισπράττεται· από τον επόμενο, «κενό;». Μία φορά ανά
      // μήνα, ποτέ ως μηδενικό ενοίκιο.
      gapAt(idx, { kind: 'vacancy', flow: 'rent', label: 'Ενοίκιο', hint: `Η μίσθωση λήγει ${grDate(leaseEnd)}.`, level: monthly });
      continue;
    }
    const p = periods.get(idx);
    // Μήνας μέσα σε δόση που ξεκίνησε νωρίτερα (διμηνιαία, τριμηνιαία): ήδη μετρημένος.
    if (!p) continue;
    if (idx === first && p.due < today) {
      // Η ΔΟΣΗ ΤΟΥ ΜΗΝΑ ΕΛΗΞΕ ΚΑΙ ΔΕΝ ΕΧΕΙ ΓΡΑΜΜΗ. Δεν ξέρουμε αν μπήκε: ούτε
      // ποσό ούτε μηδέν. Χωρίς αυτό, ο τρέχων μήνας έβγαινε «ο πιο σφιχτός»
      // μόνο επειδή δεν είχε σημειωθεί η είσπραξη.
      gapAt(idx, { kind: 'unrecorded', flow: 'rent', label: 'Ενοίκιο',
        hint: `Η δόση έληγε ${grDate(p.due)} και δεν έχει σημειωθεί αν μπήκε. Σημείωσέ τη στον Ενοικιαστή.` });
      continue;
    }
    // Η τελευταία δόση πριν από τη λήξη δεν μετρά μήνες μετά από αυτήν.
    const months = Math.min(p.months, endIdx - idx + 1);
    put(idx, {
      kind: 'rent', label: 'Ενοίκιο', source: step > 1 ? `μισθωτήριο, δόση ${months} μηνών` : 'μισθωτήριο',
      amount: monthly * months, dir: 'in', certainty: 'actual', date: p.due,
    });
  }

  // ── ΒΡΑΧΥΧΡΟΝΙΑ: ΜΟΝΟ ΚΡΑΤΗΣΕΙΣ ΠΟΥ ΥΠΑΡΧΟΥΝ ────────────────────────────
  for (const s of input.stays ?? []) {
    const d = isoDay(s.check_in);
    if (!d) continue;
    putDated({ kind: 'stay', label: 'Κράτηση', source: 'κράτηση', amount: hostPayout(s) ?? stayTotal(s), dir: 'in', certainty: 'actual', date: d });
  }

  // ── ΕΝΦΙΑ: ΤΡΙΑ ΕΚΚΑΘΑΡΙΣΤΙΚΑ ΜΠΟΡΕΙ ΝΑ ΠΕΦΤΟΥΝ ΜΕΣΑ ΣΤΟ ΠΑΡΑΘΥΡΟ ────────
  // Τον Ιανουάριο τρέχουν οι δόσεις 11 και 12 του περσινού· από τον Μάρτιο του
  // επόμενου έτους, οι δόσεις του επόμενου. Κάθε δόση από την ίδια μηχανή με τη
  // Λογιστική, με τον αριθμό της.
  let hasEnfia = false;
  if (input.enfia) {
    const year = +today.slice(0, 4);
    const closed = input.enfia.closedRefs ?? new Set<string>();
    for (const y of [year - 1, year, year + 1]) {
      const e = enfiaYear(input.enfia.settings, y, input.enfia.facts);
      if (!(e.annual > 0)) continue;
      const refs = new Map(enfiaDueDates(y).map(d => [d.no, d.ref]));
      const declared = e.inUse.source === 'declared';
      // ΒΕΒΑΙΟ ΜΟΝΟ ΜΕ ΧΑΡΤΙ ΚΑΙ ΗΜΕΡΟΜΗΝΙΕΣ ΤΟΥ ΝΟΜΟΥ. Το δηλωμένο ποσό πάνω
      // σε εκκαθαριστικό που δεν έχει βγει ακόμη είναι υπόθεση ότι θα μείνει ίδιο.
      const actual = declared && e.datesConfirmed && y <= year;
      // Η πηγή με λέξεις της γραμμής, όχι η ετικέτα του πλακιδίου («ΕΝΦΙΑ
      // έτους (εκτίμηση)» δίπλα σε «ΕΝΦΙΑ 9/12» θα έλεγε τη λέξη δύο φορές).
      const source = actual ? `εκκαθαριστικό ΕΝΦΙΑ ${y}`
        : declared ? 'με το ποσό που έχεις δηλώσει'
        : e.inUse.source === 'lastYear' ? 'με το περσινό ποσό'
        : e.estimateBasis === 'market' ? 'εκτίμηση από την εμπορική αξία'
        : 'εκτίμηση από τα στοιχεία του ακινήτου';
      for (const i of e.instalments) {
        const ref = refs.get(i.no);
        if (ref && closed.has(ref)) continue;
        const before = lines.length;
        putDated({ kind: 'enfia', label: `ΕΝΦΙΑ ${i.no}/${e.instalments.length}`, source, amount: i.amount, dir: 'out', certainty: actual ? 'actual' : 'expected', date: i.date });
        if (lines.length > before) hasEnfia = true;
      }
    }
  }

  // ── ΦΟΡΟΣ ΕΙΣΟΔΗΜΑΤΟΣ ─────────────────────────────────────────────────
  // Τρία φορολογικά έτη αγγίζουν το παράθυρο (οι δόσεις του Τ τρέχουν από τον
  // Ιούλιο του Τ+1 ως τον Φεβρουάριο του Τ+2). Το ποσό: το εκκαθαριστικό του
  // έτους· για το τρέχον έτος, η εκτίμηση της οθόνης. Χωρίς κανένα από τα δύο,
  // ο μήνας της δόσης γράφει «λείπει», όπως ήδη η Λογιστική.
  if (input.incomeTax) {
    const year = +today.slice(0, 4);
    for (const T of [year - 2, year - 1, year]) {
      // ΕΚΚΑΘΑΡΙΣΤΙΚΟ ΜΕ ΜΗΔΕΝ Η ΕΠΙΣΤΡΟΦΗ ΕΙΝΑΙ ΕΚΚΑΘΑΡΙΣΤΙΚΟ. Δεν έχει δόσεις
      // και δεν «λείπει»· αλλιώς η κάρτα θα ζητούσε να σαρωθεί ξανά.
      const st = input.incomeTax.statements.find(s => s.taxYear === T && Number.isFinite(s.amount));
      const est = !st && input.incomeTax.estimate?.taxYear === T && input.incomeTax.estimate.amount > 0 ? input.incomeTax.estimate : null;
      if (st && !(st.amount > 0)) continue;
      if (st || est) {
        const base = (st ?? est) as IncomeTaxStatement;
        for (const i of incomeTaxInstalments(base.amount, T)) {
          putDated({
            kind: 'income_tax', label: `Φόρος εισοδήματος ${i.no}/${INCOME_TAX_INSTALMENTS}`,
            source: st ? `εκκαθαριστικό φόρου εισοδήματος ${T}` : `εκτίμηση φόρου ενοικίων ${T}`,
            amount: i.amount, dir: 'out', certainty: st ? 'actual' : 'expected', date: i.date,
          });
        }
      } else {
        // Οι ημερομηνίες χωρίς ποσό: μόνο για να βρεθεί ο μήνας του «λείπει».
        for (let i = 0; i < INCOME_TAX_INSTALMENTS; i++) {
          const m = 6 + i;
          const date = lastWorkingDayOfMonth(T + 1 + Math.floor(m / 12), m % 12);
          if (date < today) continue;
          gapAt(idxOf(date), { kind: 'missing', flow: 'income_tax', label: `Φόρος εισοδήματος ${i + 1}/${INCOME_TAX_INSTALMENTS}`,
            // Το εκκαθαριστικό του τρέχοντος έτους δεν έχει εκδοθεί ακόμη: δεν
            // ζητάμε να σαρωθεί χαρτί που δεν υπάρχει.
            hint: T >= year ? `Το ποσό θα το δώσει το εκκαθαριστικό ${T}, όταν εκδοθεί.` : `Λείπει το εκκαθαριστικό ${T}. Σάρωσέ το για να μπει το ποσό.` });
        }
      }
    }
  }

  // ── ΔΑΝΕΙΑ ─────────────────────────────────────────────────────────────
  // Η δόση k πέφτει στο addMonths(έναρξη, k), η σύμβαση του loanProgress· η
  // τελευταία είναι η `years × 12`. Το κυμαινόμενο λέγεται «με το σημερινό
  // επιτόκιο»: κανένα σενάριο Euribor εδώ.
  for (const row of input.loans ?? []) {
    if (!isActiveLoan(row)) continue;
    const amount = loanInstalment(row);
    if (!(amount > 0)) continue;
    const fixed = row.rate_type !== 'variable' && row.rate_type !== 'mixed' && pos(row.fixed_rate) > 0;
    const label = row.bank ? `Δόση δανείου, ${row.bank}` : 'Δόση δανείου';
    const start = isoDay(row.start_date);
    const total = Math.round(pos(row.years) * 12);
    for (let idx = first; idx <= last; idx++) {
      if (start) {
        const k = idx - idxOf(start);
        if (k < 1 || k > total) continue;
        put(idx, { kind: 'loan', label, source: fixed ? 'σύμβαση δανείου' : 'με το σημερινό επιτόκιο', amount, dir: 'out', certainty: fixed ? 'actual' : 'expected', date: addMonths(start, k) });
      } else {
        put(idx, { kind: 'loan', label, source: 'χωρίς ημερομηνία έναρξης', amount, dir: 'out', certainty: 'expected', date: null });
      }
    }
  }

  // ── ΑΣΦΑΛΙΣΗ: Η ΑΝΑΝΕΩΣΗ ΣΤΗ ΛΗΞΗ ─────────────────────────────────────
  let hasInsurance = false;
  const exp = isoDay(input.insurance?.expiry);
  if (exp && exp >= today && idxOf(exp) <= last) {
    const premium = pos(input.insurance?.amount);
    if (premium) {
      putDated({ kind: 'insurance', label: 'Ασφάλιστρο, ανανέωση', source: 'ίδιο ποσό με το τρέχον συμβόλαιο', amount: premium, dir: 'out', certainty: 'expected', date: exp });
      hasInsurance = true;
    } else {
      gapAt(idxOf(exp), { kind: 'missing', flow: 'insurance', label: 'Ασφάλιστρο, ανανέωση', hint: `Η ασφάλιση λήγει ${grDate(exp)}. Γράψε το ασφάλιστρο για να μπει το ποσό.` });
      hasInsurance = true;
    }
  }

  // ── ΛΟΓΑΡΙΑΣΜΟΙ ΚΑΙ Ο,ΤΙ ΕΡΧΕΤΑΙ ΚΑΘΕ ΤΟΣΟ ─────────────────────────────
  // Ο,τι καλύπτει ήδη δική του ροή δεν ξαναμετρά: ο ΕΝΦΙΑ γραμμένος και ως
  // δαπάνη, το ασφάλιστρο της ανανέωσης.
  const covered = (cat: string): boolean => {
    const slug = resolveCategory(cat);
    return (slug === 'enfia' && hasEnfia) || (slug === 'insurance' && hasInsurance);
  };
  const ledger = input.ledger ?? [];
  const seen = new Set<string>();
  for (const e of ledger) {
    const d = isoDay(e.date);
    const when = isoDay(e.due) ?? d;
    // Ο ΜΗΝΑΣ ΤΗΣ ΛΗΞΗΣ ΕΙΝΑΙ ΚΑΙ ΑΥΤΟΣ ΚΑΤΕΙΛΗΜΜΕΝΟΣ. Ο λογαριασμός του
    // Οκτωβρίου που λήγει τον Νοέμβριο μπαίνει τον Νοέμβριο· χωρίς αυτό, ο
    // Νοέμβριος έπαιρνε και την προβολή της σειράς και έβγαινε με δύο ΔΕΗ.
    if (d) seen.add(`${seriesKey(e)}@${d.slice(0, 7)}`);
    if (when && !e.paid) seen.add(`${seriesKey(e)}@${when.slice(0, 7)}`);
    if (e.paid || covered(e.category)) continue;
    if (!when) continue;
    putDated({ kind: 'bill', label: billLabel(entryName(e), when), source: 'καταχώρηση', amount: e.amount, dir: 'out', certainty: 'actual', date: when });
  }
  const now = new Date(`${today}T12:00:00`);
  for (const s of expectedSeries(ledger as LedgerEntry[], now)) {
    if (covered(s.category)) continue;
    for (let idx = idxOf(`${s.lastMonth}-01`) + s.everyMonths; idx <= last; idx += s.everyMonths) {
      const ym = ymOf(idx);
      if (seen.has(`${s.key}@${ym}`)) continue;
      const date = `${ym}-${String(s.typicalDay).padStart(2, '0')}`;
      put(idx, { kind: 'recurring', label: splitPeriod(entryName(s)).base, source: `εκτίμηση από τους τελευταίους λογαριασμούς, συνήθως ${cadenceLabel(s.everyMonths)}`, amount: s.typicalAmount, dir: 'out', certainty: 'expected', date });
    }
  }

  // ── ΣΥΝΑΡΜΟΛΟΓΗΣΗ ─────────────────────────────────────────────────────
  const months: ForecastMonth[] = [];
  let cumulative = 0;
  for (let idx = first; idx <= last; idx++) {
    const ls = lines.filter(l => l.idx === idx).map(l => l.line)
      .sort((a, b) => (a.dir === b.dir ? b.amount - a.amount : a.dir === 'in' ? -1 : 1));
    const sum = (dir: 'in' | 'out', c: Certainty) => cents(ls.filter(l => l.dir === dir && l.certainty === c).reduce((s, l) => s + l.amount, 0));
    const inActual = sum('in', 'actual'), inExpected = sum('in', 'expected');
    const outActual = sum('out', 'actual'), outExpected = sum('out', 'expected');
    const net = cents(inActual + inExpected - outActual - outExpected);
    cumulative = cents(cumulative + net);
    months.push({
      ym: ymOf(idx), year: Math.floor(idx / 12), month: (idx % 12) + 1,
      lines: ls, gaps: gaps.filter(g => g.idx === idx).map(g => g.gap),
      inActual, inExpected, outActual, outExpected, net, cumulative,
    });
  }

  // Ο ΠΙΟ ΣΦΙΧΤΟΣ: το χαμηλότερο καθαρό ανάμεσα σε όσους μήνες έχουν εκροή·
  // στην ισοπαλία ο νωρίτερος, γιατί εκείνος έρχεται πρώτος. Το «γιατί» είναι
  // οι τρεις μεγαλύτερες εκροές του, αυτές που πέφτουν μαζί.
  let tightest: Forecast['tightest'] = null;
  for (let index = 0; index < months.length; index++) {
    const m = months[index];
    if (m.outActual + m.outExpected <= 0) continue;
    // Μήνας με ενοίκιο που δεν ξέρουμε αν μπήκε δεν κρίνεται: το καθαρό του
    // είναι χαμηλό από έλλειψη καταγραφής, όχι από τις χρεώσεις του.
    if (m.gaps.some(g => g.kind === 'unrecorded' || g.kind === 'owed')) continue;
    if (tightest === null || m.net < tightest.net) {
      tightest = { index, net: m.net, drivers: m.lines.filter(l => l.dir === 'out').slice(0, 3) };
    }
  }

  const monthsWithLines = months.filter(m => m.lines.length > 0).length;
  const gapCount = gaps.length;
  return { months, tightest, empty: monthsWithLines === 0 && gapCount === 0, monthsWithLines, gapCount };
}
