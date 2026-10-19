// npx tsx app/odigos/spiti-mou-3-ti-allazei/content.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΟΔΗΓΟΣ «ΣΠΙΤΙ ΜΟΥ ΙΙΙ: ΤΙ ΙΣΧΥΕ ΚΑΙ ΤΙ ΑΛΛΑΖΕΙ»
// ─────────────────────────────────────────────────────────────────────────
// Κρατά τρία πράγματα: (α) κάθε αριθμός του οδηγού βγαίνει από σταθερά του
// lib/loans/recommend.ts, όχι από το χέρι· (β) στη στήλη του ΙΙΙ τα «όχι ακόμη
// επίσημο» έρχονται ΜΟΝΟ από το SPITI_MOU_3_REPORTED και μόνο με σήμα· κανένα
// κελί δεν υπόσχεται όφελος· (γ) οι ερωτήσεις της σελίδας είναι οι ίδιες
// με του FAQPage.
//
// Και τα όρια εισοδήματος του «Σπίτι μου ΙΙ» της ΚΥΑ 200108 ΕΞ 2025 (ΦΕΚ Β΄
// 6214/20.11.2025), που ελέγχθηκαν 19/10/2026 απέναντι στα 20.000/28.000/31.000
// των δημοσιευμάτων: εκείνα είναι τα όρια πριν από την τροποποίηση.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { feWhole } from '@/lib/core/format';
import {
  SPITI_MOU, SPITI_MOU_1, SPITI_MOU_3, SPITI_MOU_3_REPORTED, SPITI_MOU_FUNDING, SPITI_MOU_INCOME_BEFORE_2025_11,
  SPITI_MOU_LEGAL, spitiMou3Line, spitiMou3ReportedCaveat, spitiMou3ReportedLines, spitiMouEligibility,
} from '@/lib/loans/recommend';
import { COMPARISON, PROGRAM_NAMES, faq, incomeChangeLine } from './content';
import Page from './page';

let pass = 0; const fail: string[] = [];
const ok = (what: string, cond: boolean) => { if (cond) pass++; else fail.push(what); };

const plain = (s: string) => s.replace(/[­⁠]/g, '');
const ENTITY: Record<string, string> = { amp: '&', quot: '"', '#x27': "'", lt: '<', gt: '>' };
const unescape = (s: string) => s.replace(/&(amp|quot|#x27|lt|gt);/g, (_, e: string) => ENTITY[e]);

// ── Τα όρια του ΙΙ, όπως τα γράφει η ΚΥΑ 200108 ΕΞ 2025 ──
ok('ΙΙ: άγαμος έως 25.000€', SPITI_MOU.incomeSingle === 25_000);
ok('ΙΙ: ζευγάρι έως 35.000€', SPITI_MOU.incomeMarriedBase === 35_000);
ok('ΙΙ: 5.000€ ανά παιδί', SPITI_MOU.incomePerChild === 5_000);
ok('ΙΙ: μονογονεϊκή έως 39.000€', SPITI_MOU.incomeSingleParentBase === 39_000);
ok('ΙΙ: κατώτατο 10.000€', SPITI_MOU.incomeMin === 10_000);
ok('ΙΙ πριν από την τροποποίηση: 20.000/28.000/4.000/31.000€',
  SPITI_MOU_INCOME_BEFORE_2025_11.incomeSingle === 20_000 && SPITI_MOU_INCOME_BEFORE_2025_11.incomeMarriedBase === 28_000
  && SPITI_MOU_INCOME_BEFORE_2025_11.incomePerChild === 4_000 && SPITI_MOU_INCOME_BEFORE_2025_11.incomeSingleParentBase === 31_000);
ok('ΙΙ: η τροποποίηση με ΦΕΚ', /200108 ΕΞ 2025.*6214\/20\.11\.2025/.test(SPITI_MOU_LEGAL.incomeAmendment));
// Η χρηματοδότηση βγήκε σε σταθερά: η κρίση επιλεξιμότητας τη διαβάζει από εκεί.
{
  const e = spitiMouEligibility({ amount: 100_000, propertyValue: 150_000, years: 25, purpose: 'first_home', children: 3 }, '2026-01-15');
  ok('η επιλεξιμότητα διαβάζει το SPITI_MOU_FUNDING',
    e.interestFreeShare === SPITI_MOU_FUNDING.interestFreeShare && e.rateSubsidyShare === SPITI_MOU_FUNDING.largeFamilyRateCut);
}

// ── (α) Οι αριθμοί από σταθερές ──
const allCells = COMPARISON.flatMap(r => r.cells.map(c => c.text)).join(' | ');
for (const [what, n] of [
  ['Ι ποσό', SPITI_MOU_1.maxAmount], ['Ι αξία', SPITI_MOU_1.maxPropertyValue], ['Ι άγαμος', SPITI_MOU_1.incomeSingle],
  ['ΙΙ ποσό', SPITI_MOU.maxAmount], ['ΙΙ αξία', SPITI_MOU.maxPropertyValue], ['ΙΙ άγαμος', SPITI_MOU.incomeSingle],
  ['ΙΙ μονογονεϊκή', SPITI_MOU.incomeSingleParentBase],
] as const) ok(`ο πίνακας γράφει ${what} από τη σταθερά (${feWhole(n)})`, allCells.includes(feWhole(n)));
ok('το παλιό όριο του ΙΙ μόνο στη γραμμή της αλλαγής, όχι στον πίνακα',
  !allCells.includes(feWhole(SPITI_MOU_INCOME_BEFORE_2025_11.incomeMarriedBase))
  && incomeChangeLine().includes(feWhole(SPITI_MOU_INCOME_BEFORE_2025_11.incomeMarriedBase)));
// Κανένα ποσό με διαχωριστικό χιλιάδων γραμμένο με το χέρι στη σελίδα ή στο περιεχόμενο.
for (const f of ['app/odigos/spiti-mou-3-ti-allazei/page.tsx', 'app/odigos/spiti-mou-3-ti-allazei/content.ts']) {
  const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const hits = code.match(/\b\d{1,3}\.\d{3}\b(?!\/)/g) ?? [];
  ok(`${f}: κανένα ποσό γραμμένο με το χέρι (${hits.join(', ') || 'κανένα'})`, hits.length === 0);
}

// ── (β) Η στήλη του ΙΙΙ ──
ok('τρεις στήλες, με το ΙΙΙ από τη σταθερά', PROGRAM_NAMES.length === 3 && PROGRAM_NAMES[2] === SPITI_MOU_3.name);
const R = SPITI_MOU_3_REPORTED;
const reportedValues = [R.maxAmount, R.maxPropertyValue, R.incomeSingle, R.incomeMarriedBase, R.incomePerChild, R.incomeSingleParentBase].map(feWhole);
for (const row of COMPARISON) {
  const c = row.cells[2];
  ok(`ΙΙΙ «${row.label}»: γνωστό είδος κελιού`, ['official', 'reported', 'none'].includes(c.kind));
  if (c.kind === 'official') ok(`ΙΙΙ «${row.label}»: το επίσημο κελί δεν έχει όριο του Τύπου`, reportedValues.every(v => !c.text.includes(v)));
  ok(`ΙΙΙ «${row.label}»: κανένα όφελος`, !/άτοκ|επιδότ/i.test(c.text));
}
ok('ΙΙΙ: η ηλικία από το SPITI_MOU_3', COMPARISON.find(r => r.label === 'Ηλικία')!.cells[2].text.includes(String(SPITI_MOU_3.ageMax)));
ok('ΙΙΙ: το ποσό δανείου είναι «όχι ακόμη επίσημο»', COMPARISON.find(r => r.label === 'Ποσό δανείου')!.cells[2].kind === 'reported');
ok('κανένα κελί δεν λέει «άτοκο» ή «επιδότηση»', !/άτοκ|επιδότ/i.test(allCells));

// ── (γ) Η σελίδα και το FAQPage ──
const FAQ = faq('2026-10-19');
ok('4 έως 6 ερωτήσεις', FAQ.length >= 4 && FAQ.length <= 6);
ok('η ερώτηση για το ΙΙΙ απαντά με την πρόταση της σταθεράς', FAQ[0].a.startsWith(spitiMou3Line()));
ok('η ερώτηση για τα όρια του Τύπου απαντά με την επιφύλαξη', FAQ.some(f => f.a.includes(spitiMou3ReportedCaveat())));

const html = unescape(plain(renderToStaticMarkup(Page())));
ok('η σελίδα έχει το πλαίσιο «όχι ακόμη επίσημο»', html.includes('Τι έχει ειπωθεί, όχι ακόμη επίσημο'));
for (const l of spitiMou3ReportedLines()) ok(`το πλαίσιο έχει: ${l.slice(0, 40)}…`, html.includes(l));
ok('το πλαίσιο έχει την επιφύλαξη και την πηγή', html.includes(spitiMou3ReportedCaveat()) && html.includes(R.source.url));
ok('η σελίδα δείχνει πότε ελέγχθηκε', html.includes('θα ενημερωθεί όταν δημοσιευτεί η ΚΥΑ'));
ok('σύνδεσμος στον υπολογιστή στεγαστικού', html.includes('href="/ypologismos-stegastikou-daneiou"'));
ok('η υπογραφή της ομάδας', html.includes('Ομάδα Properwise'));
const ld = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  .map(m => JSON.parse(m[1]) as { '@graph'?: { '@type': string; mainEntity?: { name: string }[] }[] });
const faqLd = ld.flatMap(x => x['@graph'] ?? []).find(n => n['@type'] === 'FAQPage');
ok('FAQPage με τις ίδιες ερωτήσεις', !!faqLd && faqLd.mainEntity!.map(e => e.name).join('|') === FAQ.map(f => f.q).join('|'));
for (const f of FAQ) ok(`η ερώτηση στη σελίδα: ${f.q}`, html.includes(f.q));

// ── Οι σύνδεσμοι προς τον οδηγό ──
const calc = readFileSync('app/ypologismos-stegastikou-daneiou/page.tsx', 'utf8');
ok('ο υπολογιστής στεγαστικού δείχνει τον οδηγό από την ερώτηση για το ΙΙΙ', calc.includes("guideAt('/odigos/spiti-mou-3-ti-allazei')") && calc.includes('link: { href: SPITI_GUIDE.href'));
const data = readFileSync('app/dashboard/components/TabLoanData.tsx', 'utf8');
ok('η κάρτα του ΙΙΙ στον κατάλογο δείχνει τον οδηγό', data.includes("guide:'/odigos/spiti-mou-3-ti-allazei'"));

if (fail.length) { console.error(`\n✗ odigos spiti-mou-3: ${fail.length} αποτυχίες\n`); for (const f of fail) console.error('  ' + f); process.exit(1); }
console.log(`✓ odigos spiti-mou-3: ${pass} έλεγχοι πέρασαν`);
