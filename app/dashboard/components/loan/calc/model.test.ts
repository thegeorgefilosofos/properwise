// npx tsx app/dashboard/components/loan/calc/model.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΜΟΝΤΕΛΟ ΤΟΥ ΥΠΟΛΟΓΙΣΤΗ ΔΑΝΕΙΟΥ, ΧΩΡΙΣ ΟΘΟΝΗ
// ─────────────────────────────────────────────────────────────────────────
// Ζούσε στην κορυφή του TabLoanCalculator.tsx και ελεγχόταν μόνο μέσα από τον
// πάγκο. Εδώ: η κλιμακωτή αμοιβή του συμβολαιογράφου, το ενοίκιο-αναφορά ανά
// περιοχή, η περίοδος του Euribor, τα έτοιμα σενάρια και οι επιλογές πεδίων.
// ═══════════════════════════════════════════════════════════════════════════
import { greekWhen, MONTH_MEAN } from '@/lib/market/ecb';
import { monthGen } from '@/lib/core/months';
import { regionByKey, GREECE_AVG_GROSS_YIELD } from '@/lib/market/greekMarket';
import { LOAN_TYPES } from '../../TabLoanData';
import {
  calcNotaryFees, areaGrossYield, euriborPeriod, presetsFor, AREA_OPTIONS, LOAN_TYPE_OPTIONS, PROP_TYPE_OPTIONS,
  PROPERTY_TYPES, CHILDREN_OPTIONS, NATURAL_BORROWERS, BUSINESS_BORROWERS,
} from './model';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, got?: unknown) => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${got !== undefined ? ` (got ${JSON.stringify(got)})` : ''}`); }
};
const r2 = (n: number) => Math.round(n * 100) / 100;

// ── Η κλιμακωτή αμοιβή του συμβολαιογράφου ───────────────────────────────
{
  // 100.000€: 0,8% = 800 · υποθήκη 40% = 320 · κτηματολόγιο 0,475% = 475 ·
  // δικηγόρος 0,3% με κατώτατο 300 = 300 · ενεγγύηση 0,1% = 100.
  const a = calcNotaryFees(100000);
  ok('αμοιβή αγοράς και υποθήκης', r2(a.notary) === 1120, a.notary);
  ok('κτηματολόγιο', r2(a.landReg) === 475, a.landReg);
  ok('δικηγόρος με κατώτατο', a.legal === 300, a.legal);
  ok('σύνολο', r2(a.total) === 1995, a.total);
  ok('η ανάλυση λέει μόνο τα δύο συμβολαιογραφικά', a.breakdown.map(b => b.l).join() === 'Συμβολαιογραφικά αγοράς,Συμβολαιογραφικά υποθήκης');
  // 200.000€: 120.000 × 0,8% + 80.000 × 0,7% = 960 + 560.
  ok('δεύτερο κλιμάκιο', r2(calcNotaryFees(200000).breakdown[0].v) === 1520);
  ok('κατώτατη αμοιβή 200€', calcNotaryFees(10000).breakdown[0].v === 200);
  ok('ο δικηγόρος έχει ταβάνι 1.500€', calcNotaryFees(2000000).legal === 1500);
}

// ── Ενοίκιο-αναφορά ανά περιοχή ──────────────────────────────────────────
{
  const kolonaki = regionByKey('ath_kolonaki');
  const a = areaGrossYield('attica_center_prime');
  ok('η ακριβή ζώνη του κέντρου διαβάζει το Κολωνάκι', !!kolonaki && a.pct === kolonaki.grossYield && a.label === kolonaki.label);
  const other = areaGrossYield('other');
  ok('«Άλλη περιοχή» πέφτει στον εθνικό μέσο', other.pct === GREECE_AVG_GROSS_YIELD && other.label === 'Εθνικός μέσος όρος');
  ok('κάθε επιλογή περιοχής έχει τεκμηριωμένη απόδοση', AREA_OPTIONS.every(o => areaGrossYield(o.value).pct > 0));
}

// ── Η περίοδος του Euribor ───────────────────────────────────────────────
{
  ok('μέσος όρος μήνα', euriborPeriod('2026-09-15', MONTH_MEAN) === `μέσος όρος ${monthGen(8)} 2026`);
  ok('τιμή ημέρας', euriborPeriod('2026-09-30', 'fixing') === `fixing, ${greekWhen('2026-09-30', 'fixing')}`);
  ok('χωρίς ημερομηνία δεν σκάει', typeof euriborPeriod('', MONTH_MEAN) === 'string');
}

// ── Έτοιμα σενάρια και επιλογές ──────────────────────────────────────────
{
  const p = presetsFor('2.95');
  ok('τέσσερα έτοιμα σενάρια', p.map(x => x.id).join() === 'first_buyer,investor,commercial,renovation');
  ok('ο νέος αγοραστής παίρνει το επιτόκιο της σύγκρισης', p[0].values.rate === '2.95');
  ok('μία επιλογή ανά τύπο δανείου', LOAN_TYPE_OPTIONS.length === Object.keys(LOAN_TYPES).length);
  ok('μία επιλογή ανά τύπο ακινήτου', PROP_TYPE_OPTIONS.length === PROPERTY_TYPES.length);
  ok('έως πέντε τέκνα', CHILDREN_OPTIONS.length === 6 && CHILDREN_OPTIONS[3].description === '+80.000€');
  ok('φυσικά και νομικά πρόσωπα χωριστά', !NATURAL_BORROWERS.some(b => BUSINESS_BORROWERS.includes(b)));
}

console.log(fail ? `✗ loan/calc/model: ${fail} απέτυχαν από ${pass + fail}` : `✓ loan/calc/model: ${pass} έλεγχοι πέρασαν`);
if (fail) process.exit(1);
