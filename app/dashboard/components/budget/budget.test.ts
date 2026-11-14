// npx tsx app/dashboard/components/budget/budget.test.ts
//
// Τα σφάλματα του ελέγχου του Προϋπολογισμού (13/11/2026), γραμμένα πρώτα ως
// τεστ που αποτύγχαναν πάνω στον παλιό κώδικα:
//   · το «Δείξε μου» έγραφε πραγματικές δαπάνες
//   · αποτυχημένη φόρτωση έμοιαζε με άδειο προϋπολογισμό
//   · το Netflix έπεφτε στην «Ασφάλεια»
//   · στόχοι που δεν όρισε κανείς (390€ έναντι 415€)
//   · 2.527,00 έναντι 2.526,89 και 1.728,00 έναντι 1.727,88
//   · δύο ονόματα για το ίδιο πράγμα
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as plan from './plan';
const { parseTarget, planTotal, progress, yearly, orderCats, demoRows, anyFailed, suggestTarget } = plan;
// Τα νέα (ανασκόπηση): λείπουν από τον παλιό κώδικα, οπότε ορίζονται με εφεδρεία που αποτυγχάνει.
const nameToCommit: (d: string, c: string) => string | null = (plan as Record<string, unknown>).nameToCommit as never ?? (() => 'λείπει');
const importRow: (c: string) => { bucket: string; slug: string } = (plan as Record<string, unknown>).importRow as never ?? (() => ({ bucket: 'λείπει', slug: 'λείπει' }));
const importBucket = (c: string) => importRow(c).bucket;
const spentTotal: (a: Record<string, number>) => number = (plan as Record<string, unknown>).spentTotal as never ?? (() => -1);
import { CATS } from './model';
import * as tax from '@/lib/expenses/taxonomy';
const { BUDGET_BUCKETS, BY_SLUG, resolveCategory, budgetBucket } = tax;
const bucketSlug: (b: string) => string = (tax as Record<string, unknown>).bucketSlug as never ?? ((b: string) => b);
import { hasMatchingInstalment } from '@/lib/reminders/payDuplicate';
import { attentionOf, matchesLedgerFilter, sumCents, overdueWord, pendingWord, overWord } from '@/lib/expenses/attention';

let pass = 0, fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}
function ok(name: string, cond: boolean) {
  if (cond) { pass++; } else { fail++; console.error(`✗ ${name}`); }
}
const here = join(process.cwd(), 'app/dashboard/components');
const src = (f: string) => readFileSync(join(here, f), 'utf8');

// ── 1. ΤΟ ΠΑΡΑΔΕΙΓΜΑ ΔΕΝ ΓΡΑΦΕΙ ΠΟΤΕ ΣΤΟΥΣ ΠΙΝΑΚΕΣ ΤΟΥ ΧΡΗΣΤΗ ────────────────
{
  const hook = src('budget/useBudget.ts');
  ok('το useBudget δεν καλεί insertReturning', !/insertReturning\s*\(/.test(hook));
  ok('το useBudget δεν καλεί expenses.insert', !/expenses\.insert\s*\(/.test(hook));
  const rows = demoRows(new Date(2026, 10, 13));
  ok('το παράδειγμα έχει γραμμές', rows.length > 0);
  ok('κάθε γραμμή του παραδείγματος είναι demo-', rows.every(r => r.id.startsWith('demo-')));
  ok('καμία ημερομηνία μετά το σήμερα', rows.every(r => r.date <= '2026-11-13'));
}

// ── 2. ΑΠΟΤΥΧΗΜΕΝΗ ΦΟΡΤΩΣΗ ΔΕΝ ΕΙΝΑΙ ΑΔΕΙΟΣ ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ ────────────────────
{
  const hook = src('budget/useBudget.ts');
  // Η ανάγνωση του καθολικού ζει πλέον στο lib/data/ledgerSource (επανέλεγχος PR 576).
  const srcFile = readFileSync(join(process.cwd(), 'lib/data/ledgerSource.ts'), 'utf8');
  ok('δαπάνες με ορατό σφάλμα', hook.includes('ledgerSource(') && srcFile.includes('expenseStore.ledgerWithError('));
  ok('λογαριασμοί με ορατό σφάλμα', srcFile.includes('billStore.ofPropertyWithError'));
  ok('στόχοι με ορατό σφάλμα', hook.includes('settings.sectionWithError('));
  ok('το σφάλμα γίνεται κατάσταση', /setLoadError\(true\)/.test(hook));
  eq('ένα σφάλμα αρκεί', anyFailed([{ error: null }, { error: { message: 'x' } }]), true);
  eq('χωρίς σφάλμα', anyFailed([{ error: null }, null]), false);
  const ui = src('BillsBudget.tsx');
  ok('η οθόνη έχει «Δοκίμασε ξανά»', ui.includes('Δοκίμασε ξανά'));
}

// ── 3. ΤΟ NETFLIX ΕΙΝΑΙ ΣΥΝΔΡΟΜΗ ──────────────────────────────────────────────
{
  eq('streaming → Συνδρομές', importBucket('streaming'), 'subscriptions');
  eq('gas → Θέρμανση', importBucket('gas'), 'heating');
  eq('plumber → Επισκευές', importBucket('plumber'), 'maintenance');
  eq('φόρος χωρίς λέξη ΕΝΦΙΑ → αταξινόμητος', importBucket('taxes'), 'other');
  eq('έσοδο → όχι δαπάνη', importBucket('rent_income'), '');
  const imp = src('BudgetImport.tsx');
  ok('η εισαγωγή δεν έχει δικό της πίνακα', !/streaming:\s*'insurance'/.test(imp) && imp.includes('importRow('));
}

// ── 4. ΚΑΝΕΝΑΣ ΣΤΟΧΟΣ ΠΟΥ ΔΕΝ ΟΡΙΣΕΣ ─────────────────────────────────────────
{
  ok('οι κατηγορίες δεν έχουν προεπιλεγμένο ποσό', CATS.every(c => !('default' in c)));
  const keys = CATS.map(c => c.key);
  eq('χωρίς στόχους → κανένας στόχος', planTotal({}, keys), null);
  eq('άθροισμα όσων όρισες', planTotal({ water: '25', heating: '60' }, keys), 85);
  eq('ο συνολικός νικά', planTotal({ total: '300', water: '25' }, keys), 300);
  eq('κενό = χωρίς στόχο', parseTarget(''), null);
  eq('ρητό μηδέν = στόχος', parseTarget('0'), 0);
  eq('κόμμα δεκαδικών', parseTarget('12,5'), 12.5);
  ok('το useBudget δεν ξεκινά με 390', !src('budget/useBudget.ts').includes("total: '390'"));
  eq('πρόταση από ιστορικό, με τους ήσυχους μήνες', suggestTarget([0, 101.2, 98.8]), 67);
  eq('χωρίς ιστορικό καμία πρόταση', suggestTarget([0, 0]), null);
}

// ── 5. ΤΟ ΠΟΣΟΣΤΟ ΔΕΝ ΣΤΑΜΑΤΑ ΣΤΟ 100 ─────────────────────────────────────────
{
  const p = progress(519.99, 390);
  eq('133% και όχι 100%', p?.pct, 133);
  eq('η ράβδος σταματά στο 100', p?.bar, 100);
  eq('υπέρβαση', p?.over, true);
  eq('πόσο πέρασες, σε λεπτά', p?.left, -129.99);
  eq('χωρίς στόχο, χωρίς πρόοδο', progress(10, null), null);
}

// ── 6. ΜΙΑ ΣΤΡΟΓΓΥΛΟΠΟΙΗΣΗ ─────────────────────────────────────────────────────
{
  eq('143,99 × 12 = 1.727,88', yearly(143.99), 1727.88);
  eq('άθροισμα σε λεπτά', sumCents([0.1, 0.2, 2526.59]), 2526.89);
  const ui = src('BillsBudget.tsx');
  ok('η οθόνη δεν δείχνει το στρογγυλεμένο annualCost', !ui.includes('annualCost'));
  ok('η οθόνη δεν δείχνει το στρογγυλεμένο ytdActual του πυρήνα', !ui.includes('annual.ytdActual'));
}

// ── 7. ΕΝΑ ΟΝΟΜΑ ΑΝΑ ΠΡΑΓΜΑ ─────────────────────────────────────────────────────
{
  eq('οι κατηγορίες του Προϋπολογισμού από το λεξιλόγιο', CATS.map(c => c.label), BUDGET_BUCKETS.map(b => b.label));
  eq('Internet με το όνομα των Δαπανών', CATS.find(c => c.key === 'internet')?.label, BY_SLUG.internet.label);
  ok('κανένα κόμμα μέσα σε όνομα', CATS.every(c => !c.label.includes(',')));
  ok('το γράφημα δεν λέει «Λοιπά»', !/'Λοιπά'/.test(src('budget/charts.tsx')));
}

// ── 8. ΤΙ ΧΡΕΙΑΖΕΤΑΙ ΕΣΕΝΑ ─────────────────────────────────────────────────────
{
  const e = (o: Partial<{ date: string; due: string | null; amount: number; paid: boolean; category: string; group: string | null }>) =>
    ({ date: '2026-11-05', due: null, amount: 10, paid: true, category: 'electricity', group: null, ...o });
  const rows = [
    e({ paid: false, due: '2026-11-05', amount: 78 }),
    e({ paid: false, due: '2026-11-20', amount: 45 }),
    e({ paid: false, due: null, amount: 180, category: 'heating' }),
    e({ paid: true, amount: 140, category: 'plumber' }),
  ];
  const a = attentionOf(rows, '2026-11-13');
  eq('ληξιπρόθεσμα', a.overdue, { n: 1, sum: 78 });
  eq('εκκρεμή που δεν έληξαν', a.pending, { n: 2, sum: 225 });
  eq('φίλτρο ληξιπρόθεσμων', rows.filter(r => matchesLedgerFilter(r, { kind: 'overdue' }, '2026-11-13')).length, 1);
  eq('φίλτρο κουβά', rows.filter(r => matchesLedgerFilter(r, { kind: 'buckets', buckets: ['maintenance'], month: '2026-11', label: '' }, '2026-11-13')).length, 1);
  eq('λέξεις', [overdueWord(1), overdueWord(3), pendingWord(1), pendingWord(2), overWord(1), overWord(4)],
    ['1 ληξιπρόθεσμη', '3 ληξιπρόθεσμες', '1 εκκρεμεί', '2 εκκρεμούν', '1 κατηγορία σε υπέρβαση', '4 κατηγορίες σε υπέρβαση'].map(x => x.replace(' ', '\u00a0')));
}

// ── 9. Η ΣΕΙΡΑ ΤΩΝ ΚΑΤΗΓΟΡΙΩΝ ────────────────────────────────────────────────
{
  const r = (key: string, actual: number, target: number | null, projectedOver = false) => ({ key, label: key, actual, target, projectedOver });
  const { active, idle } = orderCats([r('a', 10, 50), r('b', 180, 60), r('c', 0, 20), r('d', 45, 40), r('e', 30, 40, true)]);
  eq('υπέρβαση πρώτα, μετά πρόβλεψη, μετά ποσό', active.map(x => x.key), ['b', 'd', 'e', 'a']);
  eq('χωρίς κίνηση χωριστά', idle.map(x => x.key), ['c']);
}

// ═══ ΔΕΥΤΕΡΟΣ ΕΛΕΓΧΟΣ (ανασκόπηση PR 576) ════════════════════════════════════
// Γραμμένα πριν από τις διορθώσεις: απέτυχαν πάνω στο 71263c5.

// ── R1. ΤΟ ΟΝΟΜΑ ΓΡΑΦΕΤΑΙ ΣΕ ΠΡΟΣΧΕΔΙΟ ΚΑΙ ΑΠΟΘΗΚΕΥΕΤΑΙ ΣΤΟ ΤΕΛΟΣ ──────────────
{
  const ui = src('BillsBudget.tsx');
  ok('το πεδίο «Όνομα» δεν μετονομάζει σε κάθε πλήκτρο', !/label="Όνομα"[^>]*onChange=\{[^}]*renameCategory/.test(ui));
  eq('κενό όνομα δεν αποθηκεύεται', nameToCommit('   ', 'Θέρμανση'), null);
  eq('ίδιο όνομα δεν αποθηκεύεται', nameToCommit('Θέρμανση ', 'Θέρμανση'), null);
  eq('όνομα δύο λέξεων', nameToCommit(' Θέρμανση σπιτιού ', 'Θέρμανση'), 'Θέρμανση σπιτιού');
}

// ── R3. Η ΑΦΑΙΡΕΣΗ ΛΕΕΙ ΤΙ ΑΦΑΙΡΕΙ ΚΑΙ ΜΟΙΑΖΕΙ ΕΠΙΚΙΝΔΥΝΗ ──────────────────────
{
  const ui = src('BillsBudget.tsx');
  ok('«Αφαίρεση κατηγορίας» με κόκκινο μελάνι', /bud-textbtn-danger[^\n]{0,200}>Αφαίρεση κατηγορίας</.test(ui));
  ok('η αναίρεση μένει', src('budget/useBudget.ts').includes("label: 'Αναίρεση'"));
}

// ── R4. ΜΙΑ ΣΤΡΟΓΓΥΛΟΠΟΙΗΣΗ, ΤΟΥ lib/core/money ────────────────────────────────
{
  eq('1,005 → 1,01 όπως το cents()', sumCents([1.005]), 1.01);
  eq('563,925 → 563,93 όπως το cents()', sumCents([563.925]), 563.93);
}

// ── R5. Η ΕΙΣΑΓΩΓΗ ΓΡΑΦΕΙ ΠΡΑΓΜΑΤΙΚΗ ΚΑΤΗΓΟΡΙΑ ΚΑΙ ΓΥΡΙΖΕΙ ΣΤΟΝ ΙΔΙΟ ΚΟΥΒΑ ────
{
  for (const pc of ['electricity', 'water', 'gas', 'internet', 'streaming', 'insurance', 'taxes', 'municipal', 'security', 'common', 'maintenance', 'elevator', 'pool', 'gardener', 'cleaner', 'plumber', 'electrician', 'other']) {
    const r = importRow(pc);
    ok(`«${pc}» γράφει κατηγορία του λεξιλογίου (${r.slug})`, resolveCategory(r.slug) === r.slug);
    eq(`«${pc}» γυρίζει στον ίδιο κουβά`, budgetBucket(r.slug), r.bucket);
  }
  for (const b of BUDGET_BUCKETS.filter(x => x.key !== 'services')) {
    eq(`ο κουβάς «${b.key}» γράφεται ως κατηγορία που γυρίζει σε αυτόν`, budgetBucket(bucketSlug(b.key)), b.key);
  }
  eq('οι «Υπηρεσίες και ΕΝΦΙΑ» δεν μαντεύουν κατηγορία', bucketSlug('services'), 'other');
  ok('ποτέ «services» στη βάση', importRow('taxes').slug !== 'services' && bucketSlug('services') !== 'services');
  eq('το έσοδο δεν εισάγεται', importRow('rent_income').bucket, '');
}

// ── R10. Η ΚΡΥΜΜΕΝΗ ΚΑΤΗΓΟΡΙΑ ΔΕΝ ΚΡΥΒΕΙ ΧΡΗΜΑΤΑ ────────────────────────────────
// Απόφαση: η απόκρυψη αφορά τη γραμμή και τον στόχο, όχι τα λεφτά. Το «Ξόδεψες»
// ισούται πάντα με τον μήνα των Δαπανών.
{
  eq('το σύνολο μετρά κάθε κουβά', spentTotal({ water: 31, heating: 180, c_x: 10.5 }), 221.5);
  ok('το useBudget δεν αθροίζει μόνο τις ορατές κατηγορίες', /viewActualTotal\s*=\s*spentTotal\(/.test(src('budget/useBudget.ts')));
}

// ═══ ΤΡΙΤΟΣ ΕΛΕΓΧΟΣ (επανέλεγχος στο ebd4cef) ═════════════════════════════════
// Γραμμένα πριν από τις διορθώσεις: απέτυχαν πάνω στο ebd4cef.

// ── N1. ΕΝΦΙΑ ΜΟΝΟ ΟΤΑΝ ΕΙΝΑΙ ΕΝΦΙΑ ─────────────────────────────────────────────
{
  const row = (cat: string, matched: string) => (importRow as unknown as (c: string, m?: string) => { bucket: string; slug: string })(cat, matched);
  eq('ΕΝΦΙΑ από την τράπεζα → enfia', row('taxes', 'ΕΝΦΙΑ').slug, 'enfia');
  eq('ENFIA από την τράπεζα → enfia', row('taxes', 'ENFIA').slug, 'enfia');
  for (const kw of ['ΑΑΔΕ', 'AADE', 'ΕΦΟΡΙΑ ΑΘΗΝΩΝ', 'ΔΗΜΟΣΙΑ ΕΣΟΔΑ', 'ΕΦΚΑ', 'ΙΚΑ', 'ΤΕΒΕ']) {
    const r = row('taxes', kw);
    ok(`«${kw}» δεν γράφεται ΕΝΦΙΑ (${r.slug})`, resolveCategory(r.slug) !== 'enfia');
    ok(`«${kw}» δεν γράφεται ως εκπιπτόμενο`, !tax.isDeductible(r.slug));
  }
  const efka = row('taxes', 'ΕΦΚΑ');
  ok('πληρωμή ΕΦΚΑ δεν σβήνει την υπενθύμιση ΕΝΦΙΑ',
    !hasMatchingInstalment([{ amount: 120, date: '2026-11-10', category: efka.slug }], 120, '2026-11-12'));
  ok('η χειροκίνητη επιλογή κουβά δεν γράφει ποτέ ΕΝΦΙΑ', BUDGET_BUCKETS.every(b => resolveCategory(bucketSlug(b.key)) !== 'enfia'));
}

// ── N2. ΟΙ ΚΡΥΜΜΕΝΕΣ ΣΕ ΜΙΑ ΗΣΥΧΗ ΓΡΑΜΜΗ ──────────────────────────────────────
{
  const split = (plan as Record<string, unknown>).hiddenSpend as ((a: Record<string, number>, keys: string[]) => number) | undefined;
  eq('ό,τι δεν είναι ορατή κατηγορία πάει στις κρυμμένες', split?.({ water: 31, heating: 180, c_x: 10.5 }, ['water']), 190.5);
  const ui = src('BillsBudget.tsx');
  ok('η λίστα έχει γραμμή «Κρυμμένες κατηγορίες»', ui.includes('Κρυμμένες κατηγορίες'));
  ok('η κρυμμένη κατηγορία δεν ξαναμπαίνει ως κανονική γραμμή', !/\.\.\.hiddenBaseCats\.filter/.test(ui));
  ok('το μήνυμα λέει πού πήγαν τα ποσά', /κρυμμέν/.test(src('budget/useBudget.ts').split('removeCategory')[1]?.slice(0, 900) ?? ''));
}

// ── N3. ΜΙΑ ΑΝΑΓΝΩΣΗ ΚΑΘΟΛΙΚΟΥ, ΟΧΙ ΤΡΕΙΣ ────────────────────────────────────────
{
  const hook = src('budget/useBudget.ts');
  ok('χωρίς δεύτερη ανάγνωση δαπανών', !hook.includes('expenses.ledgerWithError('));
  ok('χωρίς δεύτερη ανάγνωση λογαριασμών', !hook.includes('billStore.ofPropertyWithError('));
  eq('μία κλήση στην κοινή ανάγνωση', (hook.match(/ledgerSource\(/g) || []).length, 1);
}

// ── N4. ΕΝΑΣ ΑΡΙΘΜΟΣ ΥΠΕΡΒΑΣΗΣ ΣΤΗΝ ΠΡΩΤΗ ΟΘΟΝΗ ─────────────────────────────────
{
  ok('η γραμμή υπέρβασης δεν έχει δικό της ποσό', /key: 'over'[^\n]*amount: null/.test(src('BillsBudget.tsx')));
}

// ── N6. ΤΟ ΠΑΡΑΔΕΙΓΜΑ ΔΕΝ ΔΕΙΧΝΕΙ ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΕΝΟΙΚΙΟ ─────────────────────────
{
  const hook = src('budget/useBudget.ts');
  ok('στο παράδειγμα κανένα πραγματικό έσοδο', /setIncome\(demoRef\.current \? 0 :/.test(hook));
  ok('στο παράδειγμα καμία πραγματική δόση', /setLoanMonthly\(demoRef\.current \? 0 :/.test(hook));
}

console.log(`budget: ${pass} πέρασαν, ${fail} απέτυχαν`);
if (fail) process.exit(1);
