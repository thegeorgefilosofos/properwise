// npx tsx lib/assistant/promptTaxFacts.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΝΟΥΜΕΡΑ ΦΟΡΟΥ ΠΟΥ ΞΕΡΕΙ Η ΝΟΑ ΕΙΝΑΙ ΤΑ ΝΟΥΜΕΡΑ ΤΗΣ ΜΗΧΑΝΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Το πακέτο φόρου έχει κλίμακες και επεξεργασμένα παραδείγματα γραμμένα σε
// πρόζα. Ως τώρα ελεγχόταν ένα («48.000 → 13.320»), με το χέρι. Εδώ κάθε
// κλίμακα και κάθε παράδειγμα ξαναβγαίνει από τις σταθερές της greekTax και από
// το incomeStatement: όποιος αλλάξει συντελεστή χωρίς να αλλάξει την πρόζα,
// το μαθαίνει εδώ και όχι από χρήστη που πήρε λάθος ποσό.
//
// Και ο κανόνας των μετρητών: η πρόζα έλεγε ότι με μετρητά φορολογείται το
// 100%, ενώ η κύρωση ισχύει από την ημερομηνία του `FIRST_YEAR_BANK_RECEIPT`
// (Α.1187/2026, ΦΕΚ Β΄ 5590/17.09.2026, lib/billing/presumptive.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { KNOWLEDGE_PACKS, packsFor } from '../../app/dashboard/components/assistantPersona';
import { incomeStatement } from '../accounting/statement';
import {
  RENTAL_TAX_BRACKETS_2026, RENTAL_TAX_BRACKETS_2025, BUSINESS_INCOME_BRACKETS_2026, CORPORATE_TAX_RATE_2026,
  ADVANCE_TAX_RATE_SOLE, ADVANCE_TAX_RATE_COMPANY, YOUTH_UP_TO_25_BRACKETS_2026, YOUTH_26_30_BRACKETS_2026,
  FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT, rentalIncomeTax, rentalBracketsForYear,
} from '../billing/greekTax';
import { PRESUMPTIVE_DEDUCTION_RATE, presumptiveDeductionRateForYear } from '../billing/presumptive';
import { fn, feWhole, grDateOf } from '../core/format';
import { roundHalfUp } from '../core/money';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } };

const p = KNOWLEDGE_PACKS.tax;
const R = (n: number) => fn(roundHalfUp(n, 0));
const pc = (r: number) => fn(roundHalfUp(r * 100, 2));
const k = (n: number) => `${n / 1000}k`;

// Οι προτάσεις του πακέτου που μιλούν για μετρητά και ποιες από αυτές λένε ότι
// τα μετρητά χάνουν την έκπτωση. Χωρίς τόνους και πεζά: «χάνεται», «ΧΑΝΕΤΑΙ».
const flat = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const sentencesOf = (pack: string) => pack.split(/(?<=[.·;])\s+/);
const cashSentences = (pack: string) => sentencesOf(pack).filter(x => /μετρητ/.test(flat(x)));
const loses = (t: string) =>
  /(100%|χωρις( την)?( τεκμαρτη)? εκπτωσ|χωρις \d|χαν(ετ|ει|ουν)|δεν (της )?δινεται|σε ολο το)/.test(t);

// ── 1. ΤΑ ΕΠΕΞΕΡΓΑΣΜΕΝΑ ΠΑΡΑΔΕΙΓΜΑΤΑ ────────────────────────────────────────
for (const g of [6000, 12000, 18000, 24000, 30000, 48000]) {
  const t = incomeStatement({ regime: 'individual_longterm', grossIncome: g, rentsPaidViaBank: true }).incomeTax;
  ok(`ενοίκιο ${R(g)} → ${R(t)}`, p.includes(`${R(g)} → ${R(t)}`));
}
// Τα μετρητά από το έτος μετά την έναρξη της κύρωσης, όλο το έτος μετά από
// αυτήν. ΟΧΙ το incomeStatement: δεν ξέρει το έτος και μηδενίζει την
// έκπτωση όποτε rentsPaidViaBank είναι false (lib/assistant/evalSet.ts).
const cashYear = FIRST_YEAR_BANK_RECEIPT + 1;
const cashTaxable = 20000 * (1 - presumptiveDeductionRateForYear(cashYear, false));
const cashTax = rentalIncomeTax(cashTaxable, rentalBracketsForYear(cashYear));
const cashExample = `φορολογητέο ${R(cashTaxable)} → ${R(cashTax)}`;
// Ό,τι λείπει από τις προτάσεις των μετρητών: το παράδειγμα (βρίσκεται από τα
// νούμερα της μηχανής) και κάθε πρόταση που λέει ότι τα μετρητά χάνουν την
// έκπτωση πρέπει να γράφουν την ημερομηνία της κύρωσης.
const cashUndated = (pack: string, from: string): string[] => {
  const example = sentencesOf(pack).filter(x => x.includes(cashExample));
  const undated = [...new Set([...example, ...cashSentences(pack).filter(x => loses(flat(x)))])]
    .filter(x => !x.includes(from)).map(x => `«${x.slice(0, 90)}…»`);
  return example.length ? undated : [`δεν βρέθηκε η πρόταση με «${cashExample}»`, ...undated];
};
{
  ok(`μετρητά ${cashYear}: χωρίς έκπτωση`, cashTaxable === 20000);
  ok('μετρητά: φορολογητέο και φόρος', p.includes(cashExample));
  const sole = incomeStatement({ regime: 'business', businessForm: 'sole', grossIncome: 30000, itemizedExpenses: 0 });
  ok('ατομική: φόρος και προκαταβολή',
    p.includes(`κέρδος ${R(30000)} → φόρος ${R(sole.incomeTax)} (κλίμακα άρθρου 15) + προκαταβολή ${pc(ADVANCE_TAX_RATE_SOLE)}% (${R(sole.advanceTax)})`));
  const co = incomeStatement({ regime: 'business', businessForm: 'company', grossIncome: 50000, itemizedExpenses: 0 });
  ok('νομικό πρόσωπο: φόρος και προκαταβολή',
    p.includes(`κέρδος ${R(50000)} → ${pc(CORPORATE_TAX_RATE_2026)}% = ${R(co.incomeTax)} + προκαταβολή ${pc(ADVANCE_TAX_RATE_COMPANY)}% (${R(co.advanceTax)})`));
  const y25 = incomeStatement({ regime: 'business', businessForm: 'sole', grossIncome: 20000, taxpayerAge: 24 });
  ok('νέοι έως 25', p.includes(`έως ${R(20000)} → ${feWhole(y25.incomeTax)}`));
  const y30 = incomeStatement({ regime: 'business', businessForm: 'sole', grossIncome: 25000, taxpayerAge: 28 });
  ok('νέοι 26 έως 30', p.includes(`με ${R(25000)} → ${R(y30.incomeTax)}`));
}

// ── 2. ΟΙ ΚΛΙΜΑΚΕΣ ΣΕ ΠΡΟΖΑ ─────────────────────────────────────────────────
{
  const b = RENTAL_TAX_BRACKETS_2026;
  const prose = `${pc(b[0].rate)}% έως ${R(b[0].to)}€, ${pc(b[1].rate)}% από ${R(b[1].from)}–${R(b[1].to)}, ${pc(b[2].rate)}% από ${R(b[2].from)}–${R(b[2].to)}, ${pc(b[3].rate)}% άνω των ${R(b[3].from)}`;
  ok(`κλίμακα ενοικίων 2026: ${prose}`, p.includes(prose));
  const biz = BUSINESS_INCOME_BRACKETS_2026.map(x =>
    `${pc(x.rate)}% (${x.to === Infinity ? k(x.from) + '+' : (x.from === 0 ? '0' : k(x.from).replace('k', '')) + '–' + k(x.to)})`).join(', ');
  ok(`κλίμακα άρθρου 15: ${biz}`, p.includes(biz));
  const o = RENTAL_TAX_BRACKETS_2025;
  const old = `${pc(o[0].rate)}% (έως ${k(o[0].to)}) / ${pc(o[1].rate)}% (${k(o[1].from)}–${k(o[1].to)}) / ${pc(o[2].rate)}% (>${k(o[2].from)})`;
  ok(`κλίμακα ενοικίων 2025: ${old}`, p.includes(old));
  ok('τεκμαρτή έκπτωση', p.includes(`ακαθάριστο − ${pc(PRESUMPTIVE_DEDUCTION_RATE)}%`));
  ok('μειωμένη κλίμακα νέων',
    p.includes(`έως 25 ετών → ${pc(YOUTH_UP_TO_25_BRACKETS_2026[0].rate)}% για εισόδημα έως ${R(YOUTH_UP_TO_25_BRACKETS_2026[1].to)}€`)
    && p.includes(`26–30 ετών → ${pc(YOUTH_26_30_BRACKETS_2026[0].rate)}% έως ${R(YOUTH_26_30_BRACKETS_2026[1].to)}€`));
}

// ── 3. ΟΙ ΕΡΩΤΗΣΕΙΣ ΦΟΡΟΥ ΦΟΡΤΩΝΟΥΝ ΑΥΤΟ ΤΟ ΠΑΚΕΤΟ ────────────────────────
for (const q of [
  'Πόσο φόρο θα πληρώσω για ενοίκια 15.000€ τον χρόνο;',
  'Τι ΕΝΦΙΑ πληρώνει διαμέρισμα 80 τ.μ.;',
  'Έχω ατομική επιχείρηση με κέρδος 45.000€, πόσος είναι ο φόρος;',
  'Εισέπραξα 20.000€ ενοίκια το 2025, πόσο φόρο;',
]) ok(`«${q}» φορτώνει τον φόρο`, packsFor(q).includes('tax'));

// ── 4. ΜΕΤΡΗΤΑ: Η ΚΥΡΩΣΗ ΕΧΕΙ ΗΜΕΡΟΜΗΝΙΑ ──────────────────────────────────
// Η πρόζα της μεθοδολογίας έλεγε «ΜΟΝΟ αν εισπράττεται μέσω τράπεζας· με
// μετρητά φορολογείται το 100%», χωρίς ημερομηνία. Η ίδια γνώση λίγο πιο κάτω
// έλεγε ότι η κύρωση ξεκινά την BANK_FROM, οπότε για μετρητά του 2026 η Νόα
// είχε δύο μεθόδους με δύο ποσά (το lib/assistant/evalSet.ts το μετρά).
{
  const from = grDateOf(FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT);
  const method = p.slice(p.indexOf('ΜΕΘΟΔΟΛΟΓΙΑ ΕΝΟΙΚΙΩΝ'), p.indexOf('ΠΑΝΤΑ δείξε'));
  ok('βρέθηκε η πρόταση της μεθοδολογίας', method.length > 0);
  ok(`η μεθοδολογία λέει από πότε μετράει ο τρόπος είσπραξης (${from})`, method.includes(from));
  ok('η μεθοδολογία δεν λέει πια «με μετρητά φορολογείται το 100%» χωρίς ημερομηνία',
    !/ΜΟΝΟ αν εισπράττεται μέσω τράπεζας· με μετρητά φορολογείται το 100%/.test(p));

  // ΟΧΙ ΜΟΝΟ Η ΜΕΘΟΔΟΛΟΓΙΑ. Δύο προτάσεις πιο κάτω, στο ίδιο σημείο, έμενε το
  // «Με ΜΕΤΡΗΤΑ (χωρίς …): φορολογητέο … → …» χωρίς ημερομηνία: για μετρητά
  // του 2026 οδηγούσε σε φόρο χωρίς την έκπτωση, που ισχύει ακόμη. Κάθε
  // πρόταση όλου του πακέτου που λέει ότι τα μετρητά χάνουν την έκπτωση πρέπει
  // να λέει μέσα της και από πότε.
  //
  // ΠΡΩΤΑ ΤΑ ΝΟΥΜΕΡΑ, ΜΕΤΑ Η ΔΙΑΤΥΠΩΣΗ. Η πρώτη εκδοχή έβρισκε την πρόταση
  // μόνο από τη διατύπωση («100%», «χωρίς την έκπτωση», «χωρίς 5», «χάνεται»).
  // Το «Με ΜΕΤΡΗΤΑ (χωρίς έκπτωση): φορολογητέο …» χωρίς ημερομηνία, ή απλώς
  // «Με ΜΕΤΡΗΤΑ: φορολογητέο …», έμενε πράσινο. Τώρα η πρόταση με το
  // παράδειγμα των μετρητών βρίσκεται από το φορολογητέο και τον φόρο που
  // βγάζει η μηχανή, όπως κι αν είναι γραμμένη. Οι υπόλοιπες βρίσκονται από ένα
  // πλατύτερο ταίριασμα. Ο ίδιος έλεγχος τρέχει πιο κάτω πάνω σε πειραγμένα
  // αντίγραφα του πακέτου, ώστε να φαίνεται ότι πιάνει τις αναδιατυπώσεις.
  const problems = cashUndated(p, from);
  ok(`όλες οι προτάσεις για τα μετρητά λένε από πότε${problems.length ? `: ${problems.join(' | ')}` : ''}`,
    problems.length === 0);
  ok('βρέθηκαν οι τρεις προτάσεις που λένε ότι τα μετρητά χάνουν την έκπτωση',
    cashSentences(p).filter(x => loses(flat(x))).length >= 3);

  // Η πρόταση του παραδείγματος, ξαναγραμμένη χωρίς ημερομηνία με τους
  // τρόπους που περνούσαν την πρώτη εκδοχή του ελέγχου μαζί με την αρχική
  // διατύπωση του λάθους. Τα νούμερα έρχονται από τη μηχανή.
  const example = sentencesOf(p).find(x => x.includes(cashExample)) ?? '';
  ok('βρέθηκε η πρόταση του παραδείγματος των μετρητών', example.length > 0);
  for (const undated of [
    `Με ΜΕΤΡΗΤΑ (χωρίς ${pc(PRESUMPTIVE_DEDUCTION_RATE)}%): ${cashExample} (= δημοσιευμένο παράδειγμα)·`,
    `Με ΜΕΤΡΗΤΑ (χωρίς έκπτωση): ${cashExample} (= δημοσιευμένο παράδειγμα)·`,
    `Με ΜΕΤΡΗΤΑ (χωρίς τεκμαρτή έκπτωση): ${cashExample} (= δημοσιευμένο παράδειγμα)·`,
    `Με ΜΕΤΡΗΤΑ: ${cashExample} (= δημοσιευμένο παράδειγμα)·`,
  ]) {
    ok(`πιάνεται χωρίς ημερομηνία: «${undated.slice(0, 50)}…»`, cashUndated(p.replace(example, undated), from).length > 0);
  }
  // Και οι άλλες δύο, χωρίς ημερομηνία και με άλλα λόγια.
  for (const undated of [
    'Με μετρητά δεν δίνεται η τεκμαρτή έκπτωση.',
    'Με μετρητά χάνεις την έκπτωση και πληρώνεις φόρο σε όλο το ενοίκιο.',
    'Όποιος εισπράττει μετρητά φορολογείται χωρίς την τεκμαρτή έκπτωση.',
  ]) {
    ok(`πιάνεται χωρίς ημερομηνία: «${undated}»`, cashUndated(`${p}. ${undated}`, from).length > 0);
  }
}

console.log(fail === 0 ? `✓ promptTaxFacts: ${pass} έλεγχοι πέρασαν` : `✗ promptTaxFacts: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
