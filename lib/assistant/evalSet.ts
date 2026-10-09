// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΕΡΩΤΗΣΕΙΣ ΦΟΡΟΥ ΠΟΥ ΜΕΤΡΑΝΕ ΤΗ ΝΟΑ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Η Νόα απαντά σε ερωτήσεις φόρου κάθε μέρα και κανείς δεν είχε
// μετρήσει πόσες φορές βγάζει σωστό ποσό. Από τα επεξεργασμένα παραδείγματα του
// πακέτου φόρου ελεγχόταν ένα, με το χέρι. Εδώ ζουν ερωτήσεις με απάντηση που
// βγαίνει από τις ίδιες μηχανές με τις οθόνες (greekTax, presumptive, statement)
// και ένας βαθμολογητής που διαβάζει τα ποσά της απάντησης.
//
// ΤΙ ΜΕΤΡΑΕΙ ΚΑΙ ΤΙ ΟΧΙ. Μετράει συμφωνία με τους υπολογιστές της εφαρμογής, όχι
// νομική αλήθεια: λάθος σε υπολογιστή περνά και στο αναμενόμενο. Η ερώτηση είναι
// μία, χωρίς δεδομένα ακινήτου, οπότε το ποσοστό είναι κάτω όριο για ό,τι
// βλέπει ο χρήστης με τα δικά του δεδομένα.
//
// ΚΑΜΙΑ ΑΠΑΝΤΗΣΗ ΜΕΣΑ ΣΤΟ PROMPT. Ούτε το ποσό της ερώτησης ούτε το αναμενόμενο
// εμφανίζεται στη γνώση της Νόας (το ελέγχει το evalSet.test.ts): αλλιώς θα
// μετρούσαμε αντιγραφή, όχι μέθοδο.
//
// ΤΟ ΔΙΦΟΡΟΥΜΕΝΟ ΔΕΝ ΕΙΝΑΙ ΕΠΙΤΥΧΙΑ. Μια σωστή απάντηση για μετρητά λέει και το
// σημερινό ποσό και το ποσό με την κύρωση. Μια λάθος λέει το ίδιο ζεύγος με
// αντίστροφο νόημα. Όταν μέσα στην απάντηση υπάρχει και το σωστό και ένα γνωστό
// λάθος ποσό, η απάντηση πάει σε άνθρωπο να τη διαβάσει.
//
// Ο εκτελεστής είναι το scripts/noa-eval.ts. Δεν τρέχει στο CI: χρειάζεται
// κλειδί και το μοντέλο δεν απαντά ίδια κάθε φορά.
// ═══════════════════════════════════════════════════════════════════════════
import { rentalIncomeTax, rentalBracketsForYear, art15BracketsForAge, type TaxBracket } from '../billing/greekTax';
import { PRESUMPTIVE_DEDUCTION_RATE, presumptiveDeductionRateForYear } from '../billing/presumptive';
import { incomeStatement } from '../accounting/statement';
import { feWhole } from '../core/format';
import { identityProblems } from './identity';
import { modelFor } from './model';

export interface NoaEvalCase {
  /** Σταθερό όνομα, για σύγκριση ανάμεσα σε δύο τρεξίματα. */
  id: string;
  question: string;
  /** Το ποσό σε ευρώ, όπως το βγάζει ο υπολογιστής της εφαρμογής. */
  expected: number;
  /** Πόσα ευρώ απόκλιση μετράνε ακόμη ως σωστό (στρογγυλέματα). */
  tolerance: number;
  /** Ποια συνάρτηση έβγαλε το `expected`. */
  source: string;
  /**
   * 'in-prompt-method': η μέθοδος είναι στη γνώση της Νόας και μετράει στο
   * ποσοστό. 'not-in-prompt': θέλει γνώση που το prompt δεν έχει (μνήμη του
   * μοντέλου) και αναφέρεται χωριστά.
   */
  category: 'in-prompt-method' | 'not-in-prompt';
  /** Γνωστά λάθος ποσά: αν εμφανιστούν μαζί με το σωστό, η απάντηση είναι διφορούμενη. */
  wrong?: number[];
  /**
   * Η λάθος μέθοδος που ψάχνει η ερώτηση: φορολογητέο και κλίμακα. Η Νόα δείχνει
   * ΠΑΝΤΑ την ανάλυση κλιμακίων, οπότε αν ένα κλιμάκιο της λάθος μεθόδου ήταν
   * ίσο με το σωστό ποσό, η λάθος απάντηση θα περνούσε (το evalSet.test.ts
   * το απαγορεύει).
   */
  wrongMethod?: { taxable: number; brackets: readonly TaxBracket[] };
  /** Τα ποσά της ερώτησης (ευρώ). Ούτε αυτά επιτρέπεται να υπάρχουν στο prompt. */
  inputs: number[];
}

/** Το ουδέτερο «ακίνητο» της αξιολόγησης: καμία παρεμβολή από δεδομένα χρήστη. */
export const EVAL_CONTEXT = 'Δεν έχει επιλεγεί ακίνητο. Ο χρήστης κάνει γενική ερώτηση.';

const TOLERANCE = 1;

/** Φόρος ενοικίων ιδιώτη: η κλίμακα του έτους πάνω στο ακαθάριστο μείον την τεκμαρτή του έτους. */
const rentTax = (gross: number, year: number, bank: boolean) =>
  rentalIncomeTax(gross * (1 - presumptiveDeductionRateForYear(year, bank)), rentalBracketsForYear(year));

// ΠΟΤΕ incomeStatement ΓΙΑ ΜΕΤΡΗΤΑ: δεν ξέρει το έτος και μηδενίζει την
// έκπτωση όποτε `rentsPaidViaBank` είναι false (statement.ts). Ο κανόνας του
// έτους ζει στο presumptiveDeductionRateForYear.
function rentCase(year: number, gross: number, bank: boolean): NoaEvalCase {
  const how = bank ? 'μέσω τράπεζας' : year === 2027 ? 'σε μετρητά, ισόποσα κάθε μήνα' : 'σε μετρητά';
  const expected = rentTax(gross, year, bank);
  // ΤΟ ΛΑΘΟΣ ΠΟΥ ΨΑΧΝΟΥΜΕ ΣΤΑ ΜΕΤΡΗΤΑ. Ως το 2027 είναι το «φορολογείται το
  // 100%» (η κύρωση πριν από την ώρα της)· από το 2028 είναι το αντίθετο, η
  // τεκμαρτή που δεν δίνεται πια.
  const full = rentalIncomeTax(gross, rentalBracketsForYear(year));
  const kept = rentalIncomeTax(gross * (1 - PRESUMPTIVE_DEDUCTION_RATE), rentalBracketsForYear(year));
  const wrong = bank ? null : Math.abs(full - expected) > TOLERANCE ? full : kept;
  const wrongTaxable = wrong === full ? gross : gross * (1 - PRESUMPTIVE_DEDUCTION_RATE);
  return {
    id: `rent-${year}-${bank ? 'bank' : 'cash'}-${gross}`,
    question: `Είμαι ιδιώτης και νοικιάζω ένα διαμέρισμα με μακροχρόνια μίσθωση κατοικίας. Το ακίνητο είναι εξ ολοκλήρου δικό μου και δεν έχω άλλο εισόδημα. Για το φορολογικό έτος ${year} εισέπραξα ${feWhole(gross)} ενοίκια ${how}. Πόσο φόρο εισοδήματος θα πληρώσω για αυτά;`,
    expected,
    tolerance: TOLERANCE,
    source: `rentalIncomeTax · presumptiveDeductionRateForYear(${year}, ${bank}) · rentalBracketsForYear(${year})`,
    category: 'in-prompt-method',
    ...(wrong != null ? { wrong: [wrong], wrongMethod: { taxable: wrongTaxable, brackets: rentalBracketsForYear(year) } } : {}),
    inputs: [gross],
  };
}

function soleCase(profit: number, opts: { age?: number; advance?: boolean; firstThreeYears?: boolean } = {}): NoaEvalCase {
  const s = incomeStatement({
    regime: 'business', businessForm: 'sole', grossIncome: profit, itemizedExpenses: 0,
    taxpayerAge: opts.age, firstThreeYears: opts.firstThreeYears,
  });
  const who = opts.age ? `Είμαι ${opts.age} ετών και έχω` : opts.firstThreeYears ? 'Είμαι 40 ετών και ξεκίνησα δραστηριότητα πέρσι (πρώτη τριετία). Έχω' : 'Έχω';
  const ask = opts.advance
    ? 'Πόση προκαταβολή φόρου θα βεβαιωθεί για τον επόμενο χρόνο;'
    : 'Πόσο φόρο εισοδήματος θα πληρώσω;';
  const tag = opts.advance ? 'advance' : opts.age ? `age${opts.age}` : opts.firstThreeYears ? 'first3' : 'tax';
  // ΤΟ ΛΑΘΟΣ ΠΟΥ ΨΑΧΝΟΥΜΕ ΣΤΟΥΣ ΝΕΟΥΣ: η κανονική κλίμακα, σαν να μην υπήρχε η ηλικία.
  const noAge = opts.age && !opts.advance
    ? incomeStatement({ regime: 'business', businessForm: 'sole', grossIncome: profit, itemizedExpenses: 0 })
    : null;
  const youthWrong = noAge && Math.abs(noAge.incomeTax - s.incomeTax) > TOLERANCE ? noAge.incomeTax : null;
  return {
    id: `sole-2026-${tag}-${profit}`,
    question: `${who} ατομική επιχείρηση. Το καθαρό κέρδος μου για το φορολογικό έτος 2026 ήταν ${feWhole(profit)} και δεν έχω άλλο εισόδημα. ${ask}`,
    expected: opts.advance ? s.advanceTax : s.incomeTax,
    tolerance: TOLERANCE,
    source: `incomeStatement({ regime: 'business', businessForm: 'sole' })${opts.advance ? '.advanceTax' : '.incomeTax'}`,
    // Η κλίμακα της πρώτης τριετίας δεν είναι στη γνώση της Νόας.
    category: opts.firstThreeYears ? 'not-in-prompt' : 'in-prompt-method',
    ...(youthWrong != null ? { wrong: [youthWrong], wrongMethod: { taxable: profit, brackets: art15BracketsForAge() } } : {}),
    inputs: [profit],
  };
}

function companyCase(profit: number): NoaEvalCase {
  const s = incomeStatement({ regime: 'business', businessForm: 'company', grossIncome: profit, itemizedExpenses: 0 });
  return {
    id: `company-2026-tax-${profit}`,
    question: `Έχω ΙΚΕ, δηλαδή νομικό πρόσωπο. Το καθαρό κέρδος της για το φορολογικό έτος 2026 ήταν ${feWhole(profit)}. Πόσο φόρο εισοδήματος θα πληρώσει η εταιρεία;`,
    expected: s.incomeTax,
    tolerance: TOLERANCE,
    source: `incomeStatement({ regime: 'business', businessForm: 'company' }).incomeTax`,
    category: 'in-prompt-method',
    inputs: [profit],
  };
}

/**
 * Οι ερωτήσεις. Τα ποσά διαλέχτηκαν ώστε να ΜΗΝ υπάρχουν στο prompt (ούτε
 * ερώτηση ούτε απάντηση): τα 20.000, 18.000 και 16.000 των παραδειγμάτων του
 * πακέτου φόρου θα μετρούσαν αντιγραφή.
 */
export const NOA_EVAL_CASES: readonly NoaEvalCase[] = [
  // 2026, μέσω τράπεζας: η νέα κλίμακα ενοικίων με την τεκμαρτή.
  ...[9600, 14200, 15000, 27000, 33000, 40000, 52000].map(g => rentCase(2026, g, true)),
  // 2026 σε μετρητά: η κύρωση δεν ισχύει ακόμη, άρα ίδιο ποσό με την τράπεζα.
  // Το «σε μετρητά φορολογείται το 100%» είναι το λάθος που ψάχνουμε.
  rentCase(2026, 15000, false),
  rentCase(2026, 26000, false),
  // 2025: η παλιά κλίμακα· ο τρόπος είσπραξης δεν μετράει.
  rentCase(2025, 21000, true),
  rentCase(2025, 38000, true),
  rentCase(2025, 21000, false),
  // 2027: η κύρωση πιάνει μόνο τους μήνες από τον Ιούλιο. 2028: όλη τη χρήση.
  rentCase(2027, 22000, false),
  rentCase(2028, 17000, false),
  // Επιχείρηση: η κλίμακα του άρθρου 15, η προκαταβολή, το νομικό πρόσωπο.
  soleCase(45000),
  soleCase(45000, { advance: true }),
  soleCase(70000),
  companyCase(80000),
  // Νέοι έως 30: η μειωμένη κλίμακα, που είναι στη γνώση της Νόας. Κέρδος πάνω
  // από το κλιμάκιο του 26%: ως εκεί ο φόρος του νέου έως 25 είναι ίσος με το
  // κλιμάκιο 26% της κανονικής κλίμακας και η λάθος ανάλυση θα περνούσε.
  soleCase(34000, { age: 24 }),
  soleCase(23000, { age: 28 }),
  // Εκτός prompt: μετριέται χωριστά, δεν μπαίνει στο ποσοστό.
  soleCase(15000, { firstThreeYears: true }),
];

/**
 * Τα ποσά μιας απάντησης, με ελληνική γραφή: «2.362,50€», «2.362,5» (και με
 * κενό πριν από το σύμβολο), «2362,50», «13.320». Η τελεία χωρίζει χιλιάδες,
 * το κόμμα δεκαδικά.
 */
export function extractAmounts(text: string): number[] {
  const out: number[] = [];
  const re = /(?<![\d.,])(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?(?!\d)/g;
  for (const m of (text || '').matchAll(re)) {
    const n = Number(m[0].replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

export interface EvalScore {
  verdict: 'pass' | 'fail' | 'ambiguous';
  found: number[];
  /** Οι κανόνες ταυτότητας που παραβιάζει η απάντηση (lib/assistant/identity.ts). */
  identity: string[];
}

export function scoreAnswer(c: NoaEvalCase, answer: string): EvalScore {
  const found = extractAmounts(answer);
  const near = (x: number) => found.some(n => Math.abs(n - x) <= c.tolerance);
  const right = near(c.expected);
  const wrong = (c.wrong ?? []).some(near);
  return {
    verdict: right ? (wrong ? 'ambiguous' : 'pass') : 'fail',
    found,
    identity: identityProblems(answer).map(p => p.rule.id),
  };
}

/** Μια γραμμή του τρεξίματος: η απάντηση και η βαθμολογία της, ή το σφάλμα της κλήσης. */
export interface EvalRow {
  id: string;
  category: NoaEvalCase['category'];
  verdict: EvalScore['verdict'] | 'error';
  expected: number;
  found: number[];
  identity: string[];
  /** Η απάντηση της Νόας, ή το μήνυμα σφάλματος όταν `verdict` είναι 'error'. */
  answer: string;
}

/**
 * Ρωτά κάθε ερώτηση με τη σειρά και κρατά ΚΑΘΕ αποτέλεσμα.
 *
 * ΕΝΑ 429 ΔΕΝ ΣΒΗΝΕΙ ΤΟ ΤΡΕΞΙΜΟ. Ως τώρα το σφάλμα μιας κλήσης (429, 529,
 * λήξη χρόνου) έβγαινε από τον βρόχο: οι απαντήσεις που είχαν ήδη πληρωθεί
 * δεν έμπαιναν στο ποσοστό ούτε στο αρχείο --out. Τώρα η ερώτηση γράφεται ως
 * 'error' και το τρέξιμο συνεχίζει.
 */
export async function runEval(
  cases: readonly NoaEvalCase[],
  ask: (c: NoaEvalCase) => Promise<string>,
  onRow: (row: EvalRow) => void = () => {},
): Promise<EvalRow[]> {
  const rows: EvalRow[] = [];
  for (const c of cases) {
    let row: EvalRow;
    try {
      const answer = await ask(c);
      const s = scoreAnswer(c, answer);
      row = { id: c.id, category: c.category, verdict: s.verdict, expected: c.expected, found: s.found, identity: s.identity, answer };
    } catch (err) {
      const answer = err instanceof Error ? err.message : String(err);
      row = { id: c.id, category: c.category, verdict: 'error', expected: c.expected, found: [], identity: [], answer };
    }
    rows.push(row);
    onRow(row);
  }
  return rows;
}

/**
 * Το ποσοστό: μόνο οι ερωτήσεις με μέθοδο μέσα στο prompt που ΑΠΑΝΤΗΘΗΚΑΝ.
 * Ένα σφάλμα του παρόχου δεν είναι λάθος της Νόας, οπότε δεν μετρά ούτε ως
 * αποτυχία· μετριέται χωριστά.
 */
export function evalSummary(rows: readonly EvalRow[]) {
  const head = rows.filter(r => r.category === 'in-prompt-method' && r.verdict !== 'error');
  return {
    passed: head.filter(r => r.verdict === 'pass').length,
    answered: head.length,
    errors: rows.filter(r => r.verdict === 'error').length,
  };
}

type Block = { type: 'text'; text: string };

/**
 * Το σώμα της κλήσης, όπως το στέλνει ο διακομιστής για τη Νόα: ίδιο
 * `max_tokens` με τον πελάτη, ένα `cache_control` στο πρώτο μπλοκ και ΚΑΘΟΛΟΥ
 * temperature/top_p/top_k, που το μοντέλο τα απορρίπτει (route.tsx).
 */
export function evalRequestBody(c: NoaEvalCase, system: readonly Block[], model: string = modelFor(c.question)) {
  return {
    model,
    max_tokens: 1800,
    system: system.map((b, i) => (i === 0
      ? { type: 'text' as const, text: b.text, cache_control: { type: 'ephemeral' as const } }
      : { type: 'text' as const, text: b.text })),
    messages: [{ role: 'user' as const, content: c.question }],
  };
}
