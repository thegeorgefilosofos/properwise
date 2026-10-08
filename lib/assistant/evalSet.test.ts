// npx tsx lib/assistant/evalSet.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΣΕΤ ΑΞΙΟΛΟΓΗΣΗΣ ΤΗΣ ΝΟΑΣ, ΧΩΡΙΣ ΔΙΚΤΥΟ
// ─────────────────────────────────────────────────────────────────────────
// Το ίδιο το τρέξιμο (scripts/noa-eval.ts) θέλει κλειδί και δεν μπαίνει στο CI.
// Εδώ κλειδώνεται ό,τι κρίνει αν το τρέξιμο λέει αλήθεια: ότι κάθε αναμενόμενο
// ποσό βγαίνει από τον κώδικα, ότι καμία απάντηση και κανένα ποσό ερώτησης δεν
// υπάρχει ήδη στο prompt, ότι ο βαθμολογητής ξεχωρίζει το διφορούμενο και ότι
// το σώμα της κλήσης είναι αυτό που δέχεται ο πάροχος.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import {
  NOA_EVAL_CASES, EVAL_CONTEXT, extractAmounts, scoreAnswer, evalRequestBody, runEval, evalSummary,
} from './evalSet';
import {
  noaSystemBlocks, buildPersonalPrompt, packsFor, DEFAULT_PREFS,
} from '../../app/dashboard/components/assistantPersona';
import { incomeStatement } from '../accounting/statement';
import type { TaxBracket } from '../billing/greekTax';
import { fn } from '../core/format';
import { roundHalfUp } from '../core/money';
import { athensNowLabel, athensToday } from '../core/time';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } };

// ── 1. ΤΟ ΣΧΗΜΑ ─────────────────────────────────────────────────────────────
ok('τουλάχιστον 20 ερωτήσεις', NOA_EVAL_CASES.length >= 20);
ok('τουλάχιστον 15 μετρούν στο ποσοστό',
  NOA_EVAL_CASES.filter(c => c.category === 'in-prompt-method').length >= 15);
ok('μοναδικά ονόματα', new Set(NOA_EVAL_CASES.map(c => c.id)).size === NOA_EVAL_CASES.length);
for (const c of NOA_EVAL_CASES) {
  ok(`${c.id}: όνομα σε kebab`, /^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id));
  ok(`${c.id}: θετικό αναμενόμενο`, Number.isFinite(c.expected) && c.expected > 0);
  ok(`${c.id}: θετική ανοχή`, c.tolerance > 0);
  ok(`${c.id}: έχει πηγή και ποσά ερώτησης`, c.source.length > 0 && c.inputs.length > 0);
  // Η ερώτηση πρέπει να φορτώνει τη γνώση του φόρου, αλλιώς μετράμε άλλο πακέτο.
  ok(`${c.id}: φορτώνει το πακέτο του φόρου`, packsFor(c.question).includes('tax'));
}

// ── 2. ΚΑΜΙΑ ΑΠΑΝΤΗΣΗ ΚΑΙ ΚΑΝΕΝΑ ΠΟΣΟ ΤΗΣ ΕΡΩΤΗΣΗΣ ΣΤΟ PROMPT ───────────────
// Ελέγχεται ΟΛΟ το κείμενο που στέλνει ο εκτελεστής (γνώση και προσωπικό), όχι
// μόνο το πακέτο του φόρου. Με όρια ψηφίων: το «2.550» δεν βρίσκεται μέσα στο
// «12.550», ούτε το «520» μέσα στο «5.200».
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const forms = (n: number) => [...new Set([fn(roundHalfUp(n, 0)), fn(n, 2), String(Math.round(n))])];
const appearsIn = (text: string, n: number) =>
  forms(n).some(f => new RegExp(`(?<!\\d)(?<!\\d[.,])${esc(f)}(?!\\d)(?![.,]\\d)`).test(text));
const today = `${athensNowLabel()} (ISO: ${athensToday()}, ώρα Ελλάδας)`;
const personal = buildPersonalPrompt(DEFAULT_PREFS, EVAL_CONTEXT, undefined, { today });
const systemFor = (q: string) =>
  (noaSystemBlocks([{ role: 'user', content: q }], personal) ?? []).map(b => b.text).join('\n\n');

{
  const sys = systemFor(NOA_EVAL_CASES[0].question);
  // Ο ανιχνευτής πιάνει ό,τι πρέπει: τα παραδείγματα του prompt (48.000 → 13.320
  // και το 20.000 των μετρητών), όχι όμως ένα ποσό που απλώς τα περιέχει.
  ok('ο ανιχνευτής βρίσκει το παράδειγμα του prompt', appearsIn(sys, 13320) && appearsIn(sys, 20000));
  ok('ο ανιχνευτής σέβεται τα όρια ψηφίων', !appearsIn('12.550 και 5.200', 2550) && !appearsIn('5.200', 520));
}
for (const c of NOA_EVAL_CASES) {
  const sys = systemFor(c.question);
  ok(`${c.id}: το prompt δεν έχει την απάντηση`, sys.length > 30000 && !appearsIn(sys, c.expected));
  ok(`${c.id}: το prompt δεν έχει τα ποσά της ερώτησης`, c.inputs.every(n => !appearsIn(sys, n)));
  ok(`${c.id}: η ερώτηση δεν έχει την απάντηση`, !appearsIn(c.question, c.expected));
  ok(`${c.id}: τα ποσά της ερώτησης είναι γραμμένα μέσα της`, c.inputs.every(n => appearsIn(c.question, n)));
}

// ── 3. ΤΑ ΑΝΑΜΕΝΟΜΕΝΑ ΒΓΑΙΝΟΥΝ ΑΠΟ ΤΟΝ ΚΩΔΙΚΑ ──────────────────────────────
// Για το 2026 μέσω τράπεζας οι δύο μηχανές πρέπει να συμφωνούν. Για τα μετρητά
// μόνο το presumptive.ts ξέρει το έτος, οπότε εκεί δεν συγκρίνεται.
for (const c of NOA_EVAL_CASES.filter(x => /^rent-2026-bank-/.test(x.id))) {
  const want = incomeStatement({ regime: 'individual_longterm', grossIncome: c.inputs[0], rentsPaidViaBank: true }).incomeTax;
  ok(`${c.id}: συμφωνεί με το incomeStatement`, Math.abs(c.expected - want) < 0.005);
}
{
  const probe = NOA_EVAL_CASES.find(c => c.id === 'rent-2026-cash-15000');
  ok('υπάρχει το τεστ των μετρητών του 2026', !!probe);
  ok('τα μετρητά του 2026 ξεχωρίζουν το σωστό από το «100% φορολογητέο»',
    !!probe?.wrong?.length && Math.abs(probe.expected - probe.wrong[0]) > probe.tolerance);
  const bank = NOA_EVAL_CASES.find(c => c.id === 'rent-2026-bank-15000');
  ok('τα μετρητά του 2026 δίνουν ό,τι και η τράπεζα', !!bank && bank.expected === probe?.expected);
  const y27 = NOA_EVAL_CASES.find(c => c.id === 'rent-2027-cash-22000');
  ok('το 2027 σε μετρητά έχει λάθος ποσό την κύρωση όλου του χρόνου', !!y27?.wrong?.length
    && y27.wrong[0] > y27.expected && /ισόποσα κάθε μήνα/.test(y27.question));
  ok('κάθε λάθος ποσό απέχει από το σωστό', NOA_EVAL_CASES.every(c =>
    (c.wrong ?? []).every(w => Math.abs(w - c.expected) > c.tolerance)));
}

// ── 3β. Η ΛΑΘΟΣ ΑΝΑΛΥΣΗ ΔΕΝ ΠΕΡΙΕΧΕΙ ΤΟ ΣΩΣΤΟ ΠΟΣΟ ─────────────────────────
// Η Νόα δείχνει ΠΑΝΤΑ την ανάλυση κλιμακίων και ο βαθμολογητής δέχεται το σωστό
// ποσό όπου κι αν βρεθεί. Στους 24 ετών με 22.000 κέρδος το σωστό ποσό ήταν
// ίσο με το κλιμάκιο 26% της κανονικής κλίμακας: η απάντηση που αγνοούσε την
// ηλικία περνούσε ως σωστή. Κανένα κλιμάκιο και κανένα σύνολο της λάθος
// μεθόδου δεν επιτρέπεται να πέφτει πάνω στο σωστό.
const slices = (taxable: number, brackets: readonly TaxBracket[]) => brackets
  .map(b => ({ b, amt: Math.max(0, Math.min(taxable, b.to) - b.from) }))
  .filter(x => x.amt > 0)
  .map(x => ({ ...x, tax: x.amt * x.b.rate }));
{
  const youth = NOA_EVAL_CASES.filter(c => /^sole-2026-age\d+-/.test(c.id));
  ok('υπάρχουν ερωτήσεις νέων', youth.length >= 2);
  for (const c of youth) ok(`${c.id}: έχει λάθος μέθοδο την κανονική κλίμακα`, !!c.wrongMethod && !!c.wrong?.length);
  for (const c of NOA_EVAL_CASES.filter(x => x.wrong?.length)) {
    ok(`${c.id}: έχει λάθος μέθοδο`, !!c.wrongMethod);
    if (!c.wrongMethod) continue;
    const sl = slices(c.wrongMethod.taxable, c.wrongMethod.brackets);
    const total = sl.reduce((a, x) => a + x.tax, 0);
    ok(`${c.id}: το σύνολο της λάθος μεθόδου είναι το λάθος ποσό`,
      c.wrong!.some(w => Math.abs(w - total) < 0.005));
    const hit = [...sl.map(x => x.tax), total].filter(t => Math.abs(t - c.expected) <= c.tolerance);
    ok(`${c.id}: κανένα κλιμάκιο της λάθος μεθόδου δεν είναι το σωστό (${hit.join(', ')})`, hit.length === 0);
    // Η πλήρης λάθος ανάλυση, όπως θα την έγραφε η Νόα, δεν περνά.
    const text = sl.map(x => `${fn(x.amt, 0)}×${fn(x.b.rate * 100, 0)}%=${fn(x.tax, 2)}€`).join(', ')
      + `, σύνολο ${fn(total, 2)}€.`;
    ok(`${c.id}: η λάθος ανάλυση δεν περνά (${text})`, scoreAnswer(c, text).verdict !== 'pass');
  }
}

// ── 4. Ο ΒΑΘΜΟΛΟΓΗΤΗΣ ───────────────────────────────────────────────────────
{
  const probe = NOA_EVAL_CASES.find(c => c.id === 'rent-2026-cash-15000')!;
  const right = fn(probe.expected, 2), wrong = fn(probe.wrong![0], 0);
  ok('τα ποσά διαβάζονται με ελληνική γραφή',
    JSON.stringify(extractAmounts('φόρος 2.362,50€ σε 15.000€, όχι 2362,5 ή 13320.')) === '[2362.5,15000,2362.5,13320]');
  ok('το σωστό ποσό περνά', scoreAnswer(probe, `Ο φόρος είναι ${right}€.`).verdict === 'pass');
  ok('το λάθος ποσό μόνο του αποτυγχάνει', scoreAnswer(probe, `Ο φόρος είναι ${wrong}€.`).verdict === 'fail');
  // Μια απάντηση που λέει και τα δύο ποσά δεν είναι επιτυχία: τη διαβάζει άνθρωπος.
  ok('σωστό και λάθος μαζί: διφορούμενο',
    scoreAnswer(probe, `${right}€ τώρα, ${wrong}€ από 01/07/2027.`).verdict === 'ambiguous');
  ok('«2.362,5 €» περνά', scoreAnswer(probe, 'Περίπου 2.362,5 € τον χρόνο.').verdict === 'pass');
  ok('«2362,50» περνά', scoreAnswer(probe, 'Θα πληρώσεις 2362,50 ευρώ.').verdict === 'pass');
  ok('απάντηση χωρίς ποσό αποτυγχάνει', scoreAnswer(probe, 'Ρώτα τον λογιστή σου.').verdict === 'fail');
  ok('καθαρή απάντηση: κανένα πρόβλημα ταυτότητας', scoreAnswer(probe, `Ο φόρος είναι ${right}€.`).identity.length === 0);
  // Ο κανόνας ταυτότητας ελέγχεται με τη φράση που απαγορεύει (μόνο εδώ, ως δοκιμή).
  ok('«ο βοηθός σου» σημαίνεται', JSON.stringify(scoreAnswer(probe, 'Είμαι ο βοηθός σου.').identity) === '["gendered-assistant"]');
}

// ── 5. ΤΟ ΣΩΜΑ ΤΗΣ ΚΛΗΣΗΣ ──────────────────────────────────────────────────
{
  const ROUTE = readFileSync(new URL('../../app/api/anthropic/route.tsx', import.meta.url), 'utf8');
  const allowed = [...(ROUTE.match(/const ALLOWED = new Set\(\[([^\]]*)\]\)/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(m => m[1]);
  ok('βρέθηκαν τα μοντέλα που δέχεται η διαδρομή', allowed.length >= 2);
  for (const c of NOA_EVAL_CASES) {
    const sys = noaSystemBlocks([{ role: 'user', content: c.question }], personal)!;
    const body = evalRequestBody(c, sys) as Record<string, unknown> & ReturnType<typeof evalRequestBody>;
    ok(`${c.id}: χωρίς temperature/top_p/top_k`, !('temperature' in body) && !('top_p' in body) && !('top_k' in body));
    ok(`${c.id}: cache_control μόνο στο πρώτο μπλοκ`,
      body.system.length === 2 && 'cache_control' in body.system[0] && !('cache_control' in body.system[1]));
    ok(`${c.id}: max_tokens όσο ο πελάτης`, body.max_tokens === 1800);
    ok(`${c.id}: μοντέλο που δέχεται η διαδρομή`, allowed.includes(body.model));
    ok(`${c.id}: ένα μήνυμα χρήστη, η ερώτηση`, body.messages.length === 1 && body.messages[0].content === c.question);
  }
}

// ── 6. ΕΝΑ ΣΦΑΛΜΑ ΤΟΥ ΠΑΡΟΧΟΥ ΔΕΝ ΣΒΗΝΕΙ ΤΟ ΤΡΕΞΙΜΟ ───────────────────────
// Το scripts/noa-eval.ts περίμενε κάθε κλήση χωρίς try/catch: ένα 529 στην
// προτελευταία ερώτηση έβγαζε το script με 1, χωρίς ποσοστό και χωρίς --out,
// ενώ οι προηγούμενες απαντήσεις είχαν ήδη πληρωθεί.
async function providerErrors() {
  const head = NOA_EVAL_CASES.filter(c => c.category === 'in-prompt-method');
  const failAt = head[head.length - 2].id;
  const seen: string[] = [];
  const rows = await runEval(NOA_EVAL_CASES, async c => {
    if (c.id === failAt) throw new Error('ο πάροχος απάντησε 529');
    return `Ο φόρος είναι ${fn(c.expected, 2)}€.`;
  }, r => seen.push(r.id));
  ok('όλες οι ερωτήσεις έχουν γραμμή, ακόμη και μετά το σφάλμα', rows.length === NOA_EVAL_CASES.length);
  ok('κάθε γραμμή αναφέρθηκε τη στιγμή που βγήκε', seen.join() === NOA_EVAL_CASES.map(c => c.id).join());
  const bad = rows.find(r => r.id === failAt);
  ok('η αποτυχημένη κλήση γράφεται ως σφάλμα με το μήνυμά της',
    bad?.verdict === 'error' && bad.answer === 'ο πάροχος απάντησε 529' && bad.found.length === 0);
  ok('οι υπόλοιπες βαθμολογούνται', rows.filter(r => r.id !== failAt).every(r => r.verdict === 'pass'));
  const sum = evalSummary(rows);
  ok('το σφάλμα δεν μετρά ως αποτυχία της Νόας',
    sum.errors === 1 && sum.answered === head.length - 1 && sum.passed === head.length - 1);
}

providerErrors().catch(err => { fail++; console.error('✗ runEval έριξε σφάλμα:', err) }).finally(() => {
  console.log(fail === 0 ? `✓ evalSet: ${pass} έλεγχοι πέρασαν` : `✗ evalSet: ${fail} απέτυχαν από ${pass + fail}`);
  if (fail > 0) process.exit(1);
});
