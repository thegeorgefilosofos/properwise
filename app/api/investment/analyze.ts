// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΚΑΘΑΡΟ ΚΟΜΜΑΤΙ ΤΗΣ ΕΠΕΝΔΥΤΙΚΗΣ ΑΝΑΛΥΣΗΣ — ΕΛΕΓΞΙΜΟ ΧΩΡΙΣ ΑΙΤΗΜΑ
//
// Η μηχανή (`dealAnalysis`) είναι ήδη καθαρή συνάρτηση. Εδώ ζει μόνο ο έλεγχος
// εισόδου: τι στέλνει ο client, τι είναι έγκυρο, ποιο σφάλμα γυρίζει. Ο έλεγχος
// πακέτου και η προέλευση μένουν στο route — έτσι αυτό το αρχείο τρέχει σε unit
// test με `tsx`, χωρίς να αγγίζει `next/headers` ή τη βάση.
// ═══════════════════════════════════════════════════════════════════════════
import { dealAnalysis, type DealInput, type DealResult } from '@/lib/market/returns';

const REQUIRED = ['price', 'ltvPct', 'loanRatePct', 'loanYears', 'grossYieldPct', 'holdYears'] as const;
const OPTIONAL = ['opexPctOfRent', 'buyCostsPct', 'interestFreePct', 'rentGrowthPct', 'appreciationPct', 'sellCostsPct', 'discountRatePct'] as const;

export const INVALID_INPUT = 'Λείπουν ή είναι άκυρα τα στοιχεία της ανάλυσης.';

const numOrNull = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
  return Number.isFinite(n) ? n : null;
};

/** Δέχεται μόνο έγκυρους αριθμούς· ένα λείπον υποχρεωτικό πεδίο ακυρώνει το αίτημα. */
function coerceDealInput(body: unknown): DealInput | null {
  if (!body || typeof body !== 'object') return null;
  const src = body as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const k of REQUIRED) {
    const n = numOrNull(src[k]);
    if (n === null) return null;
    out[k] = n;
  }
  for (const k of OPTIONAL) {
    const n = numOrNull(src[k]);
    if (n !== null) out[k] = n;
  }
  return out as unknown as DealInput;
}

export type AnalyzeOutcome =
  | { status: 200; body: { ok: true; result: DealResult } }
  | { status: 422; body: { error: string } };

/** Καθαρός πυρήνας του endpoint: έλεγχος εισόδου + η ίδια μηχανή που τρέχει στην οθόνη. */
export function analyzeInvestment(body: unknown): AnalyzeOutcome {
  const input = coerceDealInput(body);
  if (!input) return { status: 422, body: { error: INVALID_INPUT } };
  return { status: 200, body: { ok: true, result: dealAnalysis(input) } };
}
