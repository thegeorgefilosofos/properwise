// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΤΡΕΞΙΜΟ ΚΑΙ Η ΑΝΑΦΟΡΑ ΤΗΣ ΑΞΙΟΛΟΓΗΣΗΣ ΤΗΣ ΝΟΑΣ
// ─────────────────────────────────────────────────────────────────────────
// Καθαρές συναρτήσεις: ο εκτελεστής (scripts/noa-eval.ts) δίνει τον τρόπο που
// ρωτά το μοντέλο και παίρνει πίσω γραμμές, σύνοψη ανά κατηγορία, JSON και
// κείμενο αναφοράς. Δοκιμάζονται χωρίς δίκτυο (evalReport.test.ts).
//
// ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ ΕΞΟΔΟΥ, ΟΧΙ ΔΥΟ. «Έλεγξε» (0), «ΔΕΝ ΕΛΕΓΧΘΗΚΕ» (2) και
// «σφάλμα» (1). Χωρίς κλειδί το τρέξιμο ΔΕΝ είναι πράσινο: ένα 0 θα διαβαζόταν
// ως «η Νόα πέρασε» σε ό,τι κοιτά μόνο τον κωδικό εξόδου.
// ═══════════════════════════════════════════════════════════════════════════
import { gradeAnswer, type Check } from './evalGrade';
import { SUITE_CATEGORIES, CATEGORY_LABEL, type SuiteCase, type SuiteCategory } from './evalSuite';
import { fn } from '../core/format';

export const EXIT = { checked: 0, error: 1, notChecked: 2 } as const;
/** Η λέξη που τυπώνεται όταν δεν έγινε έλεγχος. Ένα σημείο, ίδια παντού. */
export const NOT_CHECKED = 'ΔΕΝ ΕΛΕΓΧΘΗΚΕ';

export interface SuiteRow {
  id: string;
  category: SuiteCategory;
  knowledge: SuiteCase['knowledge'];
  verdict: 'pass' | 'fail' | 'ambiguous' | 'error';
  checks: Check[];
  /** Η απάντηση όπως τη βλέπει ο χρήστης, ή το μήνυμα σφάλματος της κλήσης. */
  answer: string;
}

/**
 * Ρωτά κάθε ερώτηση με τη σειρά και κρατά ΚΑΘΕ αποτέλεσμα. Ένα σφάλμα κλήσης
 * (429, 529, λήξη χρόνου) γράφεται ως 'error' και το τρέξιμο συνεχίζει: οι
 * απαντήσεις που πληρώθηκαν δεν χάνονται και δεν μετρούν ως λάθος της Νόας.
 */
export async function runSuite(
  cases: readonly SuiteCase[],
  ask: (c: SuiteCase) => Promise<string>,
  onRow: (row: SuiteRow) => void = () => {},
): Promise<SuiteRow[]> {
  const rows: SuiteRow[] = [];
  for (const c of cases) {
    let row: SuiteRow;
    try {
      const answer = await ask(c);
      const g = gradeAnswer(c.expect, answer);
      row = { id: c.id, category: c.category, knowledge: c.knowledge, verdict: g.verdict, checks: g.checks, answer };
    } catch (err) {
      const answer = err instanceof Error ? err.message : String(err);
      row = { id: c.id, category: c.category, knowledge: c.knowledge, verdict: 'error', checks: [], answer };
    }
    rows.push(row);
    onRow(row);
  }
  return rows;
}

export interface CategorySummary {
  category: SuiteCategory;
  label: string;
  /** Ερωτήσεις που απαντήθηκαν (χωρίς τα σφάλματα κλήσης). */
  answered: number;
  passed: number;
  ambiguous: number;
  errors: number;
  /** Ποσοστό σωστών επί των απαντημένων· `null` όταν δεν απαντήθηκε καμία. */
  pct: number | null;
}

export interface SuiteSummary {
  categories: CategorySummary[];
  /** Μόνο όσα η Νόα ΞΕΡΕΙ (in-prompt): αυτό είναι το νούμερο της ορθότητας. */
  headline: { answered: number; passed: number; pct: number | null };
  /** Όσα θέλουν γνώση που δεν έχει: δείχνει πού λείπει γνώση. */
  outside: { answered: number; passed: number; pct: number | null };
  errors: number;
  /** Ποιοι έλεγχοι απέτυχαν πιο συχνά, για να ξέρει κανείς από πού να αρχίσει. */
  failedChecks: { name: string; count: number }[];
}

const pctOf = (passed: number, answered: number) => (answered ? Math.round((passed / answered) * 1000) / 10 : null);

export function summarize(rows: readonly SuiteRow[]): SuiteSummary {
  const categories = SUITE_CATEGORIES.map(category => {
    const all = rows.filter(r => r.category === category);
    const answered = all.filter(r => r.verdict !== 'error');
    const passed = answered.filter(r => r.verdict === 'pass').length;
    return {
      category, label: CATEGORY_LABEL[category],
      answered: answered.length, passed,
      ambiguous: answered.filter(r => r.verdict === 'ambiguous').length,
      errors: all.length - answered.length,
      pct: pctOf(passed, answered.length),
    };
  }).filter(c => c.answered + c.errors > 0);
  const part = (k: SuiteCase['knowledge']) => {
    const a = rows.filter(r => r.knowledge === k && r.verdict !== 'error');
    const p = a.filter(r => r.verdict === 'pass').length;
    return { answered: a.length, passed: p, pct: pctOf(p, a.length) };
  };
  const counts = new Map<string, number>();
  for (const r of rows) for (const c of r.checks) if (!c.ok) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
  return {
    categories,
    headline: part('in-prompt'),
    outside: part('not-in-prompt'),
    errors: rows.filter(r => r.verdict === 'error').length,
    failedChecks: [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}

const pctText = (p: number | null) => (p == null ? '—' : `${fn(p, 1)}%`);
const VERDICT: Record<SuiteRow['verdict'], string> = { pass: 'σωστό', fail: 'λάθος', ambiguous: 'διφορούμενο', error: 'σφάλμα κλήσης' };

export interface ReportMeta { date: string; model: string; cases: number }

/** Η αναφορά στα ελληνικά, σε Markdown. Χωρίς κανένα στοιχείο χρήστη: οι ερωτήσεις είναι γενικές. */
export function suiteMarkdown(rows: readonly SuiteRow[], meta: ReportMeta): string {
  const s = summarize(rows);
  const out: string[] = [];
  out.push(`# Ορθότητα της Νόας, ${meta.date}`, '');
  out.push(`Μοντέλο: \`${meta.model}\` · ερωτήσεις: ${meta.cases} · απαντήθηκαν: ${rows.length - s.errors} · σφάλματα κλήσης: ${s.errors}`, '');
  out.push(`**Με γνώση στο prompt: ${s.headline.passed}/${s.headline.answered} σωστά (${pctText(s.headline.pct)}).** Αυτό είναι το νούμερο της ορθότητας.`, '');
  out.push(`Εκτός γνώσης: ${s.outside.passed}/${s.outside.answered} (${pctText(s.outside.pct)}). Δεν μετρά στο νούμερο· δείχνει πού λείπει γνώση.`, '');
  out.push('## Ανά κατηγορία', '');
  out.push('| Κατηγορία | Σωστά | Απαντήθηκαν | Ποσοστό | Διφορούμενα | Σφάλματα |', '|---|---:|---:|---:|---:|---:|');
  for (const c of s.categories) out.push(`| ${c.label} | ${c.passed} | ${c.answered} | ${pctText(c.pct)} | ${c.ambiguous} | ${c.errors} |`);
  out.push('');
  if (s.failedChecks.length) {
    out.push('## Έλεγχοι που απέτυχαν', '');
    for (const f of s.failedChecks) out.push(`- ${f.name}: ${f.count}`);
    out.push('');
  }
  const look = rows.filter(r => r.verdict !== 'pass');
  if (look.length) {
    out.push('## Θέλουν ανάγνωση', '');
    for (const r of look) {
      const why = r.checks.filter(c => !c.ok).map(c => (c.detail ? `${c.name} (${c.detail})` : c.name)).join(' · ');
      out.push(`### ${r.id} · ${VERDICT[r.verdict]}`, '', why ? `Απέτυχε: ${why}` : '', '', '```text', r.answer.trim(), '```', '');
    }
  }
  out.push('Μετρά συμφωνία με τις μηχανές της εφαρμογής, όχι νομική αλήθεια. Οι ερωτήσεις είναι γενικές, χωρίς δεδομένα ακινήτου.');
  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

/** Η αναφορά όταν δεν έγινε έλεγχος: λέει ρητά γιατί, ώστε να μη διαβαστεί ως επιτυχία. */
export function notCheckedMarkdown(reason: string, meta: ReportMeta): string {
  return `# Ορθότητα της Νόας, ${meta.date}\n\n**${NOT_CHECKED}.** ${reason}\n\nΕρωτήσεις στο σετ: ${meta.cases}. Καμία δεν στάλθηκε.\n`;
}

/** Ο κωδικός εξόδου: σφάλμα κλήσης κοκκινίζει, έλλειψη κλειδιού δεν πρασινίζει. */
export function exitCodeFor(state: { checked: boolean; errors: number }): number {
  if (!state.checked) return EXIT.notChecked;
  return state.errors ? EXIT.error : EXIT.checked;
}
