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
import { transferCosts, transferTaxOn, notaryFee, firstHomeExemption } from '@/lib/accounting/transfer';
import { mortgageCosts } from '@/lib/loans/mortgageCosts';
import {
  loanPurchaseCosts, areaGrossYield, euriborPeriod, presetsFor, AREA_OPTIONS, LOAN_TYPE_OPTIONS, PROP_TYPE_OPTIONS,
  PROPERTY_TYPES, isNewBuildType, CHILDREN_OPTIONS, NATURAL_BORROWERS, BUSINESS_BORROWERS,
} from './model';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, got?: unknown) => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${got !== undefined ? ` (got ${JSON.stringify(got)})` : ''}`); }
};
const r2 = (n: number) => Math.round(n * 100) / 100;

// ── ΤΑ ΕΞΟΔΑ ΑΓΟΡΑΣ ΤΟΥ ΔΑΝΕΙΟΥ ΕΙΝΑΙ ΤΑ ΕΞΟΔΑ ΑΓΟΡΑΣ ΤΗΣ ΛΟΓΙΣΤΙΚΗΣ (#7) ───────
// Για 200.000€ το Δάνειο έγραφε 1.520€ συμβολαιογραφικά και 950€ Κτηματολόγιο,
// η Λογιστική 1.984€ και 1.020€. Τώρα και τα δύο βγαίνουν από το `transferCosts`.
{
  const buy = transferCosts({ side: 'buy', price: 200000, useLawyer: true })
  const line = (k: string) => buy.lines.find(l => l.key === k)?.amount ?? 0
  const cash = loanPurchaseCosts({ value: 200000, loanAmount: 0, firstHome: false, married: false, children: 0, newBuild: false, agentPct: null })
  ok('χωρίς δάνειο: ίδιο σύνολο με τη Λογιστική', r2(cash.total) === r2(buy.totalCosts), [cash.total, buy.totalCosts]);
  ok('ίδια συμβολαιογραφικά με τη Λογιστική', r2(cash.notary) === r2(line('notary')), [cash.notary, line('notary')]);
  ok('ίδιο Κτηματολόγιο με τη Λογιστική (5‰ συν πάγιο)', r2(cash.landReg) === r2(line('cadastre')), cash.landReg);
  ok('ίδιος φόρος μεταβίβασης', r2(cash.tax) === r2(line('transferTax')));
  // 200.000€: (120.000 × 0,8% + 80.000 × 0,7%) × 1,24 = 1.520 × 1,24.
  ok('η κλίμακα με ΦΠΑ', r2(line('notary')) === r2(notaryFee(200000) * 1.24) && notaryFee(200000) === 1520);
  ok('κατώτατη αμοιβή', notaryFee(10000) === 200);

  // Με δάνειο προστίθενται ΜΟΝΟ τα έξοδα της υποθήκης, επί του κεφαλαίου.
  const loan = loanPurchaseCosts({ value: 200000, loanAmount: 50000, firstHome: false, married: false, children: 0, newBuild: false, agentPct: null })
  const m = mortgageCosts(50000, notaryFee(200000))
  ok('με δάνειο: Λογιστική + υποθήκη', r2(loan.total) === r2(buy.totalCosts + m.total), [loan.total, buy.totalCosts, m.total]);
  ok('η εγγραφή της υποθήκης μετρά στο δάνειο, όχι στην αξία', m.registration === 50);
  ok('τα ίδια κεφάλαια = προκαταβολή + έξοδα', r2(loan.totalCash) === r2(150000 + loan.total));
  ok('η ανάλυση λέει τα δύο συμβολαιογραφικά', loan.breakdown.map(b => b.l).join() === 'Συμβολαιογραφικά αγοράς,Συμβολαιογραφικά υποθήκης (εκτίμηση)');

  // Μεσίτης και πρώτη κατοικία περνούν στο transferCosts με τους ίδιους όρους.
  const fh = loanPurchaseCosts({ value: 220000, loanAmount: 150000, firstHome: true, married: false, children: 0, newBuild: false, agentPct: 2 })
  ok('πρώτη κατοικία: φόρος μόνο πάνω από το όριο', fh.tax === transferTaxOn(220000, firstHomeExemption({ married: false })));
  ok('μεσίτης 2% συν ΦΠΑ, όπως στη Λογιστική', r2(fh.agent) === r2(220000 * 0.02 * 1.24));
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

// ── ΝΕΟΔΜΗΤΟ ΧΩΡΙΣ ΑΝΑΣΤΟΛΗ: ΦΠΑ ΣΤΟ ΤΙΜΗΜΑ (άρθρα 24, 26, 70 Κώδικα ΦΠΑ) ─────
// Η αναστολή δίνεται με αίτηση του κατασκευαστή, άρα δεν είναι δεδομένη. Ο
// παλιός κώδικας είχε μόνο το νεόδμητο σε αναστολή: εδώ έβγαζε ΦΜΑ 6.180€.
{
  const vat = loanPurchaseCosts({ value: 200000, loanAmount: 0, firstHome: true, married: false, children: 0, newBuild: true, newBuildVat: true, agentPct: null })
  ok('νεόδμητο με ΦΠΑ: 24% στο τίμημα, 48.000€', vat.tax === 48000)
  ok('νεόδμητο με ΦΠΑ: η απαλλαγή πρώτης κατοικίας δεν εφαρμόζεται', vat.purchase.lines.some(l => l.key === 'vat') && !vat.purchase.lines.some(l => l.key === 'transferTax'))
  const susp = loanPurchaseCosts({ value: 200000, loanAmount: 0, firstHome: false, married: false, children: 0, newBuild: true, agentPct: null })
  ok('νεόδμητο σε αναστολή: ΦΜΑ 6.180€', susp.tax === 6180)
  ok('δύο επιλογές νεόδμητου στον τύπο ακινήτου', isNewBuildType('new_residence') && isNewBuildType('new_residence_vat') && !isNewBuildType('residence'))
  ok('η επιλογή με ΦΠΑ υπάρχει στη λίστα', PROPERTY_TYPES.some(p => p.value === 'new_residence_vat'))
}

console.log(fail ? `✗ loan/calc/model: ${fail} απέτυχαν από ${pass + fail}` : `✓ loan/calc/model: ${pass} έλεγχοι πέρασαν`);
if (fail) process.exit(1);
