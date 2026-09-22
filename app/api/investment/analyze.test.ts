// npx tsx app/api/investment/analyze.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΠΥΡΗΝΑΣ ΤΟΥ ΕΝΔΕΙΚΤΙΚΟΥ ENDPOINT, ΕΛΕΓΜΕΝΟΣ
//
// Η πύλη πακέτου (401/403/500) ελέγχεται στο requireFeature.test.ts. Εδώ
// ελέγχεται ο καθαρός πυρήνας: έγκυρη είσοδος → 200 με το ίδιο αποτέλεσμα που
// δίνει η μηχανή· λείπον/άκυρο πεδίο → 422· κανένα «σχεδόν σωστό» δεν περνά.
// ═══════════════════════════════════════════════════════════════════════════
import { analyzeInvestment, INVALID_INPUT } from './analyze';
import { dealAnalysis, type DealInput } from '@/lib/market/returns';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { if (cond) { pass++ } else { fail++; console.error('✗ ' + name) } };
const eq = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++ } else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`) }
};

const VALID: DealInput = {
  price: 200000, ltvPct: 60, loanRatePct: 4, loanYears: 25,
  grossYieldPct: 5, holdYears: 10,
};

// ── ΕΓΚΥΡΗ ΕΙΣΟΔΟΣ → 200, ΙΔΙΟ ΑΠΟΤΕΛΕΣΜΑ ΜΕ ΤΗ ΜΗΧΑΝΗ ─────────────────────
{
  const out = analyzeInvestment({ ...VALID });
  eq('έγκυρο: status 200', out.status, 200);
  if (out.status === 200) {
    ok('έγκυρο: ok true', out.body.ok === true);
    eq('έγκυρο: ίδιο IRR/NPV/DSCR με dealAnalysis', out.body.result, dealAnalysis(VALID));
  }
}

// ── ΑΡΙΘΜΟΙ ΩΣ ΚΕΙΜΕΝΟ ΓΙΝΟΝΤΑΙ ΔΕΚΤΟΙ (ΤΟ FORM ΣΤΕΛΝΕΙ STRINGS) ───────────
{
  const out = analyzeInvestment({
    price: '200000', ltvPct: '60', loanRatePct: '4', loanYears: '25',
    grossYieldPct: '5', holdYears: '10',
  });
  eq('string αριθμοί: status 200', out.status, 200);
  if (out.status === 200) eq('string αριθμοί: ίδιο αποτέλεσμα', out.body.result, dealAnalysis(VALID));
}

// ── ΠΡΟΑΙΡΕΤΙΚΑ ΠΕΔΙΑ ΠΕΡΝΟΥΝ ΣΤΗ ΜΗΧΑΝΗ ──────────────────────────────────
{
  const withOpt = { ...VALID, appreciationPct: 2, discountRatePct: 7 };
  const out = analyzeInvestment(withOpt);
  if (out.status === 200) eq('προαιρετικά: περνούν', out.body.result, dealAnalysis(withOpt as DealInput));
}

// ── ΛΕΙΠΟΝ ΥΠΟΧΡΕΩΤΙΚΟ ΠΕΔΙΟ → 422 ────────────────────────────────────────
{
  const { price, ...rest } = VALID; void price;
  const out = analyzeInvestment(rest);
  eq('λείπει price: 422', out.status, 422);
  if (out.status === 422) eq('λείπει price: μήνυμα', out.body.error, INVALID_INPUT);
}

// ── ΑΚΥΡΟ ΠΕΔΙΟ (NaN, null, κείμενο) → 422, ΟΧΙ ΨΕΥΤΙΚΟ ΜΗΔΕΝ ──────────────
{
  eq('τιμή "abc": 422', analyzeInvestment({ ...VALID, price: 'abc' }).status, 422);
  eq('τιμή null: 422', analyzeInvestment({ ...VALID, grossYieldPct: null }).status, 422);
  eq('κενό σώμα: 422', analyzeInvestment({}).status, 422);
  eq('όχι αντικείμενο: 422', analyzeInvestment(42).status, 422);
  eq('null σώμα: 422', analyzeInvestment(null).status, 422);
}

console.log(`\nanalyzeInvestment: ${pass} πέρασαν, ${fail} απέτυχαν`);
if (fail > 0) process.exit(1);
