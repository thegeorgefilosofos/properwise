// npx tsx app/dashboard/components/roi/model.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΜΟΝΤΕΛΟ ΤΗΣ ΑΠΟΔΟΣΗΣ, ΧΩΡΙΣ ΟΘΟΝΗ
// ─────────────────────────────────────────────────────────────────────────
// Οι συναρτήσεις αυτές ζούσαν μέσα στο TabRentROI.tsx και ελέγχονταν μόνο
// μέσα από τον πάγκο. Εδώ ελέγχονται μόνες τους: η αναφορά βραχυχρόνιας ανά
// περιοχή, το ταβάνι των προβολών, η ιστορική διαδρομή, τα τρία σενάρια
// ευαισθησίας και η πρόταση της πληρότητας ισοσκελισμού που τυπώνουν οι αναφορές.
// ═══════════════════════════════════════════════════════════════════════════
import { fp } from '@/lib/core/format';
import { SHORT_TERM, HISTORY_INDEX } from '@/lib/market/greekMarket';
import { leverage, propertyTotalReturn } from '@/lib/market/returns';
import { stRefFor, clampReturn, benchShort, historyPath, sensitivityScenarios, breakEvenText } from './model';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, got?: unknown) => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${got !== undefined ? ` (got ${JSON.stringify(got)})` : ''}`); }
};

// ── Αναφορά βραχυχρόνιας ανά περιοχή ──────────────────────────────────────
{
  const center = SHORT_TERM.find(s => s.key === 'ath_center');
  ok('το Κολωνάκι διαβάζει το κέντρο της Αθήνας', stRefFor('ath_kolonaki') === center);
  ok('η Μύκονος διαβάζει το κοινό προφίλ με τη Σαντορίνη', stRefFor('mykonos').key === 'mykonos_santorini');
  ok('άγνωστη περιοχή πέφτει στην πρώτη αναφορά', stRefFor('δεν_υπάρχει') === SHORT_TERM[0]);
  ok('κλειδί που είναι ήδη ζώνη μένει ως έχει', stRefFor('crete').key === 'crete');
}

// ── Ταβάνι των πολυετών προβολών ─────────────────────────────────────────
{
  ok('πάνω από 35 κόβεται στο 35', clampReturn(50) === 35);
  ok('κάτω από −30 κόβεται στο −30', clampReturn(-40) === -30);
  ok('NaN και άπειρο γίνονται 0', clampReturn(NaN) === 0 && clampReturn(Infinity) === 0);
  ok('μέσα στο εύρος μένει ίδιο', clampReturn(6.8) === 6.8);
}

// ── Σύντομα ονόματα εναλλακτικών ─────────────────────────────────────────
{
  ok('S&P 500 με το σύντομο όνομα', benchShort('sp500', 'x') === 'S&P 500');
  ok('άγνωστο κλειδί κρατά το όνομα που δόθηκε', benchShort('άγνωστο', 'Κάτι άλλο') === 'Κάτι άλλο');
}

// ── Ιστορική διαδρομή ─────────────────────────────────────────────────────
{
  const ten = historyPath(185000, '10');
  ok('η 10ετία ξεκινά το 2016', ten[0].year === 2016, ten[0]);
  ok('η 20ετία ξεκινά το 2007', historyPath(185000, '20')[0].year === 2007);
  ok('το τελευταίο σημείο είναι η αξία σήμερα', ten[ten.length - 1].value === 185000, ten[ten.length - 1]);
  const bare = historyPath(0, '10');
  const latest = HISTORY_INDEX[HISTORY_INDEX.length - 1];
  ok('χωρίς αξία δείχνει τον δείκτη', bare[bare.length - 1].value === Math.round(latest.price));
}

// ── Τα τρία σενάρια ευαισθησίας ──────────────────────────────────────────
{
  const input = { nVal: 200000, ltv: '70', loanRate: '3.5', nLoanYears: 25, grossYieldExact: 6, opexPctOfRent: 25, ifree: '0', netYield: 4.2, nAppr: 3 };
  const rows = sensitivityScenarios(input);
  ok('τρία σενάρια, με τη σειρά τους', rows.map(r => r.key).join() === 'bad,base,good');
  const base = rows[1];
  const lev = leverage({ price: 200000, ltvPct: 70, loanRatePct: 3.5, loanYears: 25, grossYieldPct: 6, opexPctOfRent: 25, interestFreePct: 0 });
  ok('το βασικό είναι οι τρέχουσες παραδοχές', base.roe === lev.cashOnCash && base.cashFlow === lev.cashFlow);
  ok('η συνολική απόδοση του βασικού', base.totalReturn === clampReturn(propertyTotalReturn(4.2, 3)));
  ok('το δυσμενές αποδίδει λιγότερο από το ευνοϊκό', rows[0].roe < rows[2].roe && rows[0].totalReturn < rows[2].totalReturn);
  const low = sensitivityScenarios({ ...input, loanRate: '0.5' });
  const zero = leverage({ price: 200000, ltvPct: 70, loanRatePct: 0, loanYears: 25, grossYieldPct: 6, opexPctOfRent: 25, interestFreePct: 0 });
  ok('το επιτόκιο του ευνοϊκού δεν πέφτει κάτω από το μηδέν', low[2].roe === zero.cashOnCash);
}

// ── Η πρόταση της πληρότητας ισοσκελισμού ────────────────────────────────
{
  ok('χωρίς μακροχρόνιο ενοίκιο, τίποτα', breakEvenText(null, fp) === '');
  ok('άπειρη: μη εφικτή', breakEvenText(Infinity, fp) === 'μη εφικτή με αυτά τα στοιχεία');
  ok('πάνω από 100: λέει γιατί', breakEvenText(334, fp) === `δεν επιτυγχάνεται ούτε με πλήρη πληρότητα (θα χρειαζόταν ${fp(334)})`);
  ok('κάτω από 100: το ποσοστό', breakEvenText(55, fp) === fp(55));
}

console.log(fail ? `✗ roi/model: ${fail} απέτυχαν από ${pass + fail}` : `✓ roi/model: ${pass} έλεγχοι πέρασαν`);
if (fail) process.exit(1);
