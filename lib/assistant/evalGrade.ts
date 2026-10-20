// ═══════════════════════════════════════════════════════════════════════════
// Ο ΒΑΘΜΟΛΟΓΗΤΗΣ ΤΗΣ ΝΟΑΣ: ΠΟΣΑ, ΗΜΕΡΟΜΗΝΙΕΣ, ΦΡΑΣΕΙΣ, ΤΑΥΤΟΤΗΤΑ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΧΩΡΙΣΤΑ ΑΠΟ ΤΙΣ ΕΡΩΤΗΣΕΙΣ. Οι ερωτήσεις (evalSuite.ts) τραβούν τις
// μηχανές φόρου, ΕΝΦΙΑ και δανείων· ο βαθμολογητής δεν χρειάζεται καμία. Εδώ
// ζει μόνο η κρίση «η απάντηση λέει αυτό που ζητήθηκε;», ώστε να δοκιμάζεται
// μόνη της, με γραμμένες απαντήσεις, χωρίς δίκτυο και χωρίς μοντέλο.
//
// ΤΙ ΚΡΙΝΕΤΑΙ. Κάθε ερώτηση δηλώνει ό,τι πρέπει να βρεθεί (ποσά με ανοχή,
// ημερομηνίες, φράσεις) και ό,τι δεν επιτρέπεται (φράσεις). Πάνω από όλες
// ισχύουν οι κανόνες ταυτότητας (lib/assistant/identity.ts) και η απαγόρευση
// έμφυλου αυτοπροσδιορισμού. Μία αποτυχία αρκεί για «λάθος».
//
// ΤΟ ΔΙΦΟΡΟΥΜΕΝΟ ΜΕΝΕΙ ΔΙΦΟΡΟΥΜΕΝΟ. Όταν βρεθεί το σωστό ποσό ΚΑΙ ένα γνωστό
// λάθος, η απάντηση δεν μετρά ως σωστή: πάει σε άνθρωπο να τη διαβάσει.
// ═══════════════════════════════════════════════════════════════════════════
import { identityProblems, normalizeGreek } from './identity';
import { extractAmounts } from './evalSet';

/** Ένα ποσό που πρέπει να βρεθεί, με την ανοχή του σε ευρώ (0,01 = στο λεπτό). */
export interface ExpectedAmount { value: number; tolerance: number; label: string }

/**
 * Μια φράση: περνά αν βρεθεί ΕΣΤΩ ΜΙΑ από τις εναλλακτικές. Οι εναλλακτικές
 * γράφονται χωρίς τόνους και με πεζά, όπως τις βλέπει το `normalizeGreek`.
 */
export interface Phrase { label: string; any: readonly string[] }

export interface Expectation {
  amounts?: readonly ExpectedAmount[];
  /** Ημερομηνίες ISO (ΕΕΕΕ-ΜΜ-ΗΗ) που πρέπει να αναφέρονται. */
  dates?: readonly string[];
  /** Γνωστά λάθος ποσά: μαζί με το σωστό κάνουν την απάντηση διφορούμενη. */
  wrongAmounts?: readonly number[];
  required?: readonly Phrase[];
  forbidden?: readonly Phrase[];
}

export interface Check { name: string; ok: boolean; detail?: string }

export interface Grade {
  verdict: 'pass' | 'fail' | 'ambiguous';
  checks: Check[];
  amounts: number[];
  dates: string[];
}

const MONTH_STEMS = [
  'ιανουαρ', 'φεβρουαρ', 'μαρτ', 'απριλ', 'μαι', 'ιουν',
  'ιουλ', 'αυγουστ', 'σεπτεμβρ', 'οκτωβρ', 'νοεμβρ', 'δεκεμβρ',
] as const;

const pad = (n: number) => String(n).padStart(2, '0');
const validDay = (d: number, m: number) => m >= 1 && m <= 12 && d >= 1 && d <= 31;

/**
 * Οι ημερομηνίες μιας απάντησης, ως «ΕΕΕΕ-ΜΜ-ΗΗ» ή, χωρίς έτος, «--ΜΜ-ΗΗ».
 * Διαβάζει «30/10/2026», «30.10.2026», «30-10», «30 Οκτωβρίου 2026», «30
 * Οκτώβριο» και το ISO «2026-10-30».
 */
export function extractDates(text: string): string[] {
  const t = normalizeGreek(text);
  const out = new Set<string>();
  for (const m of t.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (validDay(d, mo)) out.add(`${y}-${pad(mo)}-${pad(d)}`);
  }
  for (const m of t.matchAll(/(?<![\d.,/-])(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}|\d{2}))?(?!\d|[.,]\d)/g)) {
    const [d, mo] = [Number(m[1]), Number(m[2])];
    if (!validDay(d, mo)) continue;
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
    out.add(y ? `${y}-${pad(mo)}-${pad(d)}` : `--${pad(mo)}-${pad(d)}`);
  }
  for (const m of t.matchAll(/(?<!\d)(\d{1,2})(?:η|ης)?\s+(\p{L}+)(?:\s+(\d{4}))?/gu)) {
    const d = Number(m[1]);
    const mi = MONTH_STEMS.findIndex(s => m[2].startsWith(s));
    if (mi < 0 || !validDay(d, mi + 1)) continue;
    out.add(m[3] ? `${m[3]}-${pad(mi + 1)}-${pad(d)}` : `--${pad(mi + 1)}-${pad(d)}`);
  }
  return [...out];
}

/** Λέει η απάντηση αυτή την ημερομηνία; Χωρίς έτος στο κείμενο αρκεί μέρα και μήνας. */
export function mentionsDate(found: readonly string[], iso: string): boolean {
  return found.includes(iso) || found.includes(`--${iso.slice(5)}`);
}

/** Βρίσκεται κάποια από τις εναλλακτικές; Η σύγκριση γίνεται χωρίς τόνους και πεζά. */
export function hasPhrase(text: string, p: Phrase): boolean {
  const t = normalizeGreek(text);
  return p.any.some(a => t.includes(normalizeGreek(a)));
}

// ── ΚΑΝΟΝΕΣ ΠΟΥ ΙΣΧΥΟΥΝ ΣΕ ΚΑΘΕ ΑΠΑΝΤΗΣΗ ────────────────────────────────────
// Ο έμφυλος αυτοπροσδιορισμός: ο κανόνας του PERSONA_BRIEF («ποτέ σίγουρος,
// σίγουρη, έτοιμος, έτοιμη…»). Οι κανόνες του identity.ts πιάνουν τις
// ετικέτες («ο βοηθός σου», «δωρεάν Νόα»), όχι το «είμαι σίγουρη».
const SELF_GENDERED = /(?<![\p{L}])(?:ειμαι|δεν ειμαι|ημουν|νιωθω)\s+(?:πολυ\s+)?(?:σιγουρ|ετοιμ|χαρουμεν|ευχαριστημεν|βεβαι|περηφαν)(?:ος|η)(?![\p{L}])/u;
// Το ουσιαστικό «βοηθός» σε οποιαδήποτε πτώση, όχι το ρήμα «βοηθώ» ούτε η «βοήθεια».
const HELPER_NOUN = /(?<![\p{L}])βοηθ(?:ος|ο|ου|οι|ους|ων)(?![\p{L}])/u;

/** Οι έλεγχοι ταυτότητας που περνά κάθε απάντηση, όποια κι αν είναι η ερώτηση. */
export function identityChecks(answer: string): Check[] {
  const norm = normalizeGreek(answer);
  const rules = identityProblems(answer).map(p => p.rule.id);
  const self = norm.match(SELF_GENDERED)?.[0];
  const helper = norm.match(HELPER_NOUN)?.[0];
  return [
    { name: 'ταυτότητα', ok: rules.length === 0, ...(rules.length ? { detail: rules.join(', ') } : {}) },
    { name: 'χωρίς φύλο', ok: !self, ...(self ? { detail: self } : {}) },
    { name: 'όχι «βοηθός»', ok: !helper, ...(helper ? { detail: helper } : {}) },
  ];
}

/** Βαθμολογεί μία απάντηση απέναντι σε όσα δηλώνει η ερώτηση. */
export function gradeAnswer(e: Expectation, answer: string): Grade {
  const amounts = extractAmounts(answer);
  const dates = extractDates(answer);
  const near = (x: number, tol: number) => amounts.some(n => Math.abs(n - x) <= tol + 1e-9);
  const checks: Check[] = [];
  for (const a of e.amounts ?? []) {
    checks.push({ name: `ποσό: ${a.label}`, ok: near(a.value, a.tolerance) });
  }
  for (const d of e.dates ?? []) {
    checks.push({ name: `ημερομηνία ${d}`, ok: mentionsDate(dates, d) });
  }
  for (const p of e.required ?? []) {
    checks.push({ name: `λέει: ${p.label}`, ok: hasPhrase(answer, p) });
  }
  for (const p of e.forbidden ?? []) {
    checks.push({ name: `δεν λέει: ${p.label}`, ok: !hasPhrase(answer, p) });
  }
  checks.push(...identityChecks(answer));
  const allOk = checks.every(c => c.ok);
  const tol = Math.max(0.01, ...(e.amounts ?? []).map(a => a.tolerance));
  const wrong = (e.wrongAmounts ?? []).some(w => near(w, tol));
  return { verdict: allOk ? (wrong ? 'ambiguous' : 'pass') : 'fail', checks, amounts, dates };
}
