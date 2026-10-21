// npx tsx lib/assistant/evalSuite.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΣΕΤ ΤΗΣ ΝΟΑΣ ΚΑΙ Η ΑΝΑΦΟΡΑ ΤΟΥ, ΧΩΡΙΣ ΔΙΚΤΥΟ
// ─────────────────────────────────────────────────────────────────────────
// Κλειδώνει ό,τι κάνει το ποσοστό αξιόπιστο: ότι κάθε κατηγορία έχει
// ερωτήσεις, ότι κάθε αναμενόμενο βγαίνει από τη μηχανή του, ότι κανένα ποσό
// που βγαίνει με μέθοδο δεν είναι ήδη γραμμένο στο prompt, ότι η σωστή
// απάντηση περνά και η λάθος όχι. Και ότι χωρίς έλεγχο ο κωδικός δεν είναι 0.
// ═══════════════════════════════════════════════════════════════════════════
import { NOA_SUITE, SUITE_CATEGORIES, CATEGORY_LABEL, type SuiteCase } from './evalSuite';
import { gradeAnswer } from './evalGrade';
import { runSuite, summarize, suiteMarkdown, notCheckedMarkdown, exitCodeFor, EXIT, NOT_CHECKED } from './evalReport';
import { EVAL_CONTEXT } from './evalSet';
import { noaSystemBlocks, buildPersonalPrompt, DEFAULT_PREFS } from '../../app/dashboard/components/assistantPersona';
import { estimateENFIA } from '../billing/enfia';
import { enfiaInstalments, ENFIA_MIN_INSTALMENT } from '../tools/enfiaSchedule';
import { maxMonthlyPayment, DSTI_LIMIT } from '../loans/affordability';
import { greekPropertyTaxObligations } from '../tax/greekTaxCalendar';
import { fn, fpRate, feWhole, grDate } from '../core/format';
import { presumptiveDeductionRateForYear } from '../billing/presumptive';
import { STR_INDIVIDUAL_MAX_PROPERTIES, NEW_PROFESSIONAL_BRACKETS_2026, BUSINESS_INCOME_BRACKETS_2026 } from '../billing/greekTax';
import { ENFIA_EXTRA_BRACKETS, ENFIA_EXTRA_TAX_FREE } from '../billing/enfia';
import { INCOME_TAX_INSTALMENTS } from '../tax/greekTaxCalendar';
import { roundHalfUp } from '../core/money';
import { athensNowLabel, athensToday } from '../core/time';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } };
const byId = (id: string) => NOA_SUITE.find(c => c.id === id);

// ── 1. ΤΟ ΣΧΗΜΑ ─────────────────────────────────────────────────────────────
ok('τουλάχιστον 40 ερωτήσεις', NOA_SUITE.length >= 40);
ok('μοναδικά ονόματα', new Set(NOA_SUITE.map(c => c.id)).size === NOA_SUITE.length);
for (const k of SUITE_CATEGORIES) {
  ok(`${k}: έχει ερωτήσεις`, NOA_SUITE.some(c => c.category === k));
  ok(`${k}: έχει ελληνικό όνομα`, /\p{Script=Greek}/u.test(CATEGORY_LABEL[k]));
}
ok('τουλάχιστον 25 ερωτήσεις με γνώση στο prompt', NOA_SUITE.filter(c => c.knowledge === 'in-prompt').length >= 25);
ok('τουλάχιστον 8 ερωτήσεις άρνησης, ταυτότητας ή παραπομπής',
  NOA_SUITE.filter(c => c.category === 'identity' || c.category === 'scope').length >= 8);
for (const c of NOA_SUITE) {
  ok(`${c.id}: όνομα σε kebab`, /^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id));
  ok(`${c.id}: έχει πηγή`, c.source.length > 3);
  const e = c.expect;
  ok(`${c.id}: ζητά κάτι συγκεκριμένο`, !!(e.amounts?.length || e.dates?.length || e.required?.length));
  for (const a of e.amounts ?? []) ok(`${c.id}: πεπερασμένο ποσό ${a.label}`, Number.isFinite(a.value) && a.tolerance >= 0);
  for (const d of e.dates ?? []) ok(`${c.id}: ISO ημερομηνία`, /^\d{4}-\d{2}-\d{2}$/.test(d));
  for (const w of e.wrongAmounts ?? []) {
    ok(`${c.id}: το λάθος απέχει από το σωστό`, (e.amounts ?? []).every(a => Math.abs(a.value - w) > a.tolerance));
  }
}

// ── 2. ΤΑ ΑΝΑΜΕΝΟΜΕΝΑ ΒΓΑΙΝΟΥΝ ΑΠΟ ΤΟΝ ΚΩΔΙΚΑ ──────────────────────────────
// Ξαναϋπολογίζονται εδώ από τις μηχανές, ανεξάρτητα από το evalSuite.ts.
{
  const amt = (id: string, i = 0) => byId(id)?.expect.amounts?.[i]?.value;
  const base = { zone: '1501_2500', floor: 'second', age: 'y10_14', year: 2026 };
  ok('ΕΝΦΙΑ 82 τ.μ. από το estimateENFIA', amt('enfia-2026-sqm-82') === estimateENFIA({ sqm: 82, ...base })!.annual);
  ok('ΕΝΦΙΑ 62% από το estimateENFIA', amt('enfia-2026-ownership-62') === estimateENFIA({ sqm: 100, ownership: 62, ...base })!.annual);
  ok('δόση ΕΝΦΙΑ 84,70 από το enfiaInstalments', amt('enfia-instalments-84-70', 1) === enfiaInstalments(84.7, 2026)[0].amount);
  ok('ελάχιστη δόση από τη σταθερά', amt('enfia-min-instalment') === ENFIA_MIN_INSTALMENT);
  ok('μέγιστη δόση πρωτοαγοραστή', amt('loan-max-payment-first-2150') === roundHalfUp(maxMonthlyPayment(2150, true), 2));
  ok('όριο DSTI λοιπών', amt('loan-dsti-other') === roundHalfUp(DSTI_LIMIT.other * 100, 2));
  const decl = greekPropertyTaxObligations(2026, 'long_term').find(o => o.id === 'income-decl-2026')!;
  ok('προθεσμία δήλωσης από το ημερολόγιο', byId('deadline-income-decl-2026')?.expect.dates?.[0] === decl.date);
  // Η μετάθεση σε εργάσιμη μετρά: το 20ό του Ιουνίου 2026 είναι Σάββατο.
  ok('Μητρώο βραχυχρόνιας: η εργάσιμη μετά το Σάββατο', byId('deadline-str-registry-2026-05')?.expect.dates?.[0] === '2026-06-22');
  ok('οι ερωτήσεις φόρου έρχονται από το evalSet', NOA_SUITE.filter(c => c.category === 'rent_tax' || c.category === 'business_tax').length >= 20);
}

// ── 3. ΚΑΝΕΝΑ ΑΠΟΤΕΛΕΣΜΑ ΜΕΘΟΔΟΥ ΣΤΟ PROMPT ─────────────────────────────────
// Αν το αναμενόμενο υπάρχει ήδη στη γνώση της Νόας, μετράμε αντιγραφή, όχι
// μέθοδο. Με όρια ψηφίων, όπως στο evalSet.test.ts.
// «4,5%», «0,2%», «9%»: το ποσοστό με το σύμβολο, όπως το γράφει η γνώση.
const pc = (r: number) => fpRate(roundHalfUp(r * 100, 2));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const forms = (n: number) => [...new Set([fn(n, 2), Number.isInteger(n) ? fn(n) : '', String(n).replace('.', ',')].filter(Boolean))];
const appearsIn = (text: string, n: number) =>
  forms(n).some(f => new RegExp(`(?<!\\d)(?<!\\d[.,])${esc(f)}(?!\\d)(?![.,]\\d)`).test(text));
const today = `${athensNowLabel()} (ISO: ${athensToday()}, ώρα Ελλάδας)`;
const personal = buildPersonalPrompt(DEFAULT_PREFS, EVAL_CONTEXT, undefined, { today });
const systemFor = (q: string) => (noaSystemBlocks([{ role: 'user', content: q }], personal) ?? []).map(b => b.text).join('\n\n');
for (const c of NOA_SUITE.filter(x => x.computed?.length && x.category !== 'rent_tax' && x.category !== 'business_tax')) {
  const sys = systemFor(c.question);
  ok(`${c.id}: φτιάχνεται system`, sys.length > 30000);
  for (const n of c.computed!) ok(`${c.id}: το ${fn(n, 2)} δεν είναι στο prompt`, !appearsIn(sys, n));
  for (const n of c.inputs ?? []) ok(`${c.id}: το ${fn(n, 2)} της ερώτησης δεν είναι στο prompt`, !appearsIn(sys, n));
  for (const n of c.computed!) ok(`${c.id}: η ερώτηση δεν λέει την απάντηση`, !appearsIn(c.question, n));
}

// ── 3β. ΤΟ «ΞΕΡΕΙ / ΔΕΝ ΞΕΡΕΙ» ΛΕΕΙ ΑΛΗΘΕΙΑ ─────────────────────────────────
// Η ετικέτα `knowledge` αποφασίζει τι μετρά στο νούμερο. Για τα γεγονότα που
// κρίνουν μια κατηγορία ελέγχεται απέναντι στο ίδιο το prompt: αν κάποιος
// προσθέσει στη γνώση τον κανόνα των δύο ακινήτων, το τεστ λέει να αλλάξει η
// ετικέτα, ώστε η ερώτηση να μπει στο νούμερο.
{
  const facts: [string, RegExp][] = [
    ['presumptive-cash-cutoff-date', /01\/07\/2027/],
    ['enfia-min-instalment', /ελάχιστ\p{L}*\s+(?:ποσ\p{L}*\s+)?δόσ|δόσ\p{L}*[^.]{0,40}(?:κάτω από|τουλάχιστον) 10/u],
    ['deadline-income-decl-2026', /15 Ιουλίου|15\/07/],
    ['deadline-str-registry-2026-05', /έως την 20|20ή του/],
    ['str-2-no-business', /έως 2 ακίνητα|έως δύο ακίνητα|3\+ ακίνητα|τρία ή περισσότερα ακίνητα/],
    ['str-municipal-rate-business', /παρεπιδημούντων \(0,5%/],
    // Οι κανόνες που μπήκαν στη γνώση στις 20/10/2026, με τη διατύπωση που
    // τους γράφει το assistantPersona.ts και τα ποσά από τις ίδιες σταθερές.
    ['presumptive-taxable-2027-cash-18400', new RegExp(`με μετρητά παίρνει τεκμαρτή έκπτωση ${esc(fpRate(presumptiveDeductionRateForYear(2027, false) * 100))}`)],
    ['enfia-instalments-84-70', /κομμένο προς τα κάτω στο λεπτό/],
    ['enfia-instalments-9-40', /πληρώνεται σε μία δόση, εφάπαξ/],
    ['deadline-autofile-2026', new RegExp(esc(grDate(byId('deadline-autofile-2026')?.expect.dates?.[0] ?? '')))],
    ['deadline-enfia-8-2026', new RegExp(`8η ${esc(grDate(byId('deadline-enfia-8-2026')?.expect.dates?.[0] ?? ''))}`)],
    ['deadline-enfia-last-2026', new RegExp(`τελευταία ${esc(grDate(byId('deadline-enfia-last-2026')?.expect.dates?.[0] ?? ''))}`)],
    ['deadline-income-tax-instalments', new RegExp(`έως ${INCOME_TAX_INSTALMENTS} ισόποσες μηνιαίες δόσεις`)],
    [`str-${STR_INDIVIDUAL_MAX_PROPERTIES + 1}-business`, new RegExp(`Με ${STR_INDIVIDUAL_MAX_PROPERTIES + 1} ή περισσότερα ακίνητα[^.]*έναρξη εργασιών`)],
    [`str-municipal-${STR_INDIVIDUAL_MAX_PROPERTIES}-exempt`, new RegExp(`έως ${STR_INDIVIDUAL_MAX_PROPERTIES} ακίνητα βραχυχρόνιας εξαιρείται`)],
    // Οι δύο τελευταίοι (21/10/2026): το πρώτο κλιμάκιο του νέου επαγγελματία
    // απέναντι στο κανονικό και το πρώτο και το τελευταίο κλιμάκιο του
    // πρόσθετου φόρου, με τα ποσοστά από τις σταθερές.
    ['sole-2026-first3-15000', new RegExp(`ΝΕΟΣ ΕΠΑΓΓΕΛΜΑΤΙΑΣ[^•]*${esc(pc(NEW_PROFESSIONAL_BRACKETS_2026[0].rate))} αντί ${esc(pc(BUSINESS_INCOME_BRACKETS_2026[0].rate))}`)],
    [`enfia-2026-extra-560000`, new RegExp(`ΠΡΟΣΘΕΤΟΣ ΦΟΡΟΣ ΑΞΙΑΣ[^•]*${esc(pc(ENFIA_EXTRA_BRACKETS[0].rate))} από ${esc(feWhole(ENFIA_EXTRA_TAX_FREE))} έως ${esc(feWhole(ENFIA_EXTRA_BRACKETS[0].upto))}[^•]*${esc(pc(ENFIA_EXTRA_BRACKETS.at(-1)!.rate))} πάνω από ${esc(feWhole(ENFIA_EXTRA_BRACKETS.at(-2)!.upto))}`)],
  ];
  // ΚΑΙ ΚΑΜΙΑ ΕΡΩΤΗΣΗ ΔΕΝ ΜΕΝΕΙ «ΕΚΤΟΣ» ΧΩΡΙΣ ΛΟΓΟ. Από τις δεκαέξι του #413
  // δεν μένει καμία: οι δύο τελευταίες (η κλίμακα της πρώτης τριετίας και ο
  // πρόσθετος φόρος της αξίας στον ΕΝΦΙΑ) μπήκαν στη γνώση στις 21/10/2026.
  // Μία εδώ σημαίνει ότι κάποιος έβγαλε κανόνα από τη γνώση ή πρόσθεσε ερώτηση
  // χωρίς να την ελέγξει απέναντι στο prompt. Οι προθεσμίες μένουν έξω από
  // τη μέτρηση: η ετικέτα τους ακολουθεί τον ορίζοντα της μέρας (evalSuite.ts).
  const outside = NOA_SUITE.filter(c => c.knowledge === 'not-in-prompt' && c.category !== 'deadlines').map(c => c.id).sort();
  ok(`καμία ερώτηση εκτός γνώσης (${outside.join(', ')})`, outside.length === 0);
  for (const [id, re] of facts) {
    const c = byId(id);
    ok(`${id}: υπάρχει`, !!c);
    if (!c) continue;
    const inPrompt = re.test(systemFor(c.question));
    ok(`${id}: η ετικέτα «${c.knowledge}» συμφωνεί με το prompt`, inPrompt === (c.knowledge === 'in-prompt'));
  }
}

// ── 4. Η ΣΩΣΤΗ ΑΠΑΝΤΗΣΗ ΠΕΡΝΑ, Η ΛΑΘΟΣ ΟΧΙ ─────────────────────────────────
// Για κάθε ερώτηση με ποσά ή ημερομηνίες χτίζεται μια «τέλεια» απάντηση από
// τα ίδια τα αναμενόμενα, με τις φράσεις που ζητούνται. Αν δεν περνά, ο
// βαθμολογητής ή η ερώτηση είναι χαλασμένα: η Νόα δεν θα μπορούσε ποτέ να
// πάρει «σωστό».
const perfect = (c: SuiteCase) => [
  ...(c.expect.amounts ?? []).map(a => `${fn(a.value, 2)}`),
  ...(c.expect.dates ?? []).map(d => d.split('-').reverse().join('/')),
  ...(c.expect.required ?? []).map(p => p.any[0]),
].join(', ') + '.';
for (const c of NOA_SUITE) {
  ok(`${c.id}: η τέλεια απάντηση περνά (${perfect(c)})`, gradeAnswer(c.expect, perfect(c)).verdict === 'pass');
  ok(`${c.id}: η κενή απάντηση αποτυγχάνει`, gradeAnswer(c.expect, 'Δεν ξέρω.').verdict === 'fail');
}

// ── 5. ΤΟ ΤΡΕΞΙΜΟ ΚΑΙ Η ΑΝΑΦΟΡΑ ─────────────────────────────────────────────
async function report() {
  const failAt = 'loan-dsti-other';
  const rows = await runSuite(NOA_SUITE, async c => {
    if (c.id === failAt) throw new Error('ο πάροχος απάντησε 529');
    if (c.category === 'enfia') return 'Ως βοηθός σου, δεν ξέρω.';
    return perfect(c);
  });
  ok('μία γραμμή ανά ερώτηση', rows.length === NOA_SUITE.length);
  const s = summarize(rows);
  ok('το σφάλμα μετριέται χωριστά', s.errors === 1);
  const enfia = s.categories.find(c => c.category === 'enfia')!;
  ok('ΕΝΦΙΑ: 0% όταν όλες αποτυγχάνουν', enfia.pct === 0 && enfia.passed === 0 && enfia.answered > 0);
  const loans = s.categories.find(c => c.category === 'loans')!;
  ok('δάνεια: το σφάλμα δεν μετρά ως λάθος', loans.errors === 1 && loans.passed === loans.answered && loans.pct === 100);
  ok('ο πιο συχνός αποτυχημένος έλεγχος είναι της ταυτότητας ή του ποσού',
    s.failedChecks.length > 0 && s.failedChecks[0].count >= 1);
  const inPrompt = NOA_SUITE.filter(c => c.knowledge === 'in-prompt' && c.id !== failAt);
  ok('το νούμερο μετρά μόνο τη γνώση του prompt', s.headline.answered === inPrompt.length);
  const md = suiteMarkdown(rows, { date: '2026-10-20', model: 'δοκιμή', cases: rows.length });
  ok('η αναφορά έχει πίνακα ανά κατηγορία', md.includes('| Κατηγορία |') && md.includes(`| ${CATEGORY_LABEL.enfia} |`));
  ok('η αναφορά δείχνει τις λάθος απαντήσεις', md.includes('### enfia-2026-sqm-82 · λάθος'));
  ok('η αναφορά γράφει δεκαδικό με κόμμα', /\d+,\d%/.test(md));
  ok('κανένα «undefined» ή «NaN»', !/undefined|NaN/.test(md));
  ok('η αναφορά χωρίς έλεγχο λέει «ΔΕΝ ΕΛΕΓΧΘΗΚΕ»',
    notCheckedMarkdown('Λείπει κλειδί.', { date: '2026-10-20', model: 'x', cases: 1 }).includes(NOT_CHECKED));
}

// ── 6. ΧΩΡΙΣ ΕΛΕΓΧΟ ΔΕΝ ΒΓΑΙΝΕΙ 0 ───────────────────────────────────────────
ok('χωρίς κλειδί: όχι πράσινο', exitCodeFor({ checked: false, errors: 0 }) === EXIT.notChecked && exitCodeFor({ checked: false, errors: 0 }) !== EXIT.checked);
ok('με σφάλμα κλήσης: κόκκινο', exitCodeFor({ checked: true, errors: 2 }) === EXIT.error);
ok('ελέγχθηκε: 0', exitCodeFor({ checked: true, errors: 0 }) === 0);

report().catch(err => { fail++; console.error('✗ η αναφορά έριξε σφάλμα:', err) }).finally(() => {
  console.log(fail === 0 ? `✓ evalSuite: ${pass} έλεγχοι πέρασαν` : `✗ evalSuite: ${fail} απέτυχαν από ${pass + fail}`);
  if (fail > 0) process.exit(1);
});
