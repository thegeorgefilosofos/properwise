// Κάθε ορατή συμβολοσειρά της ανακοίνωσης και κάθε κείμενο κοινοποίησης, από το copyFails του
// scripts/marketing/shorts/qa.ts, συν οι κανόνες ακρίβειας της ανακοίνωσης (plan.md, «Τι λέμε και τι όχι»).
//
//   npx tsx docs/marketing/kamari/2026-11-24-aade-syndesi/qa-copy.ts; echo "κωδικός: $?"
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFails } from '../../../../scripts/marketing/shorts/qa';
import { PLANS } from '../../../../lib/billing/plans';

const here = dirname(fileURLToPath(import.meta.url));
const film = readFileSync(join(here, 'film.html'), 'utf8');
const copy = readFileSync(join(here, 'share-copy.md'), 'utf8');
const plan = readFileSync(join(here, 'plan.md'), 'utf8');

const visible: string[] = [];
for (const m of film.matchAll(/\[CUT\[\d\], CUT\[\d\], '([^']+)'\]/g)) visible.push(m[1]);
for (const m of film.matchAll(/cap: '([^']+)'/g)) visible.push(m[1]);
for (const m of film.matchAll(/const (?:HOOK|TITLE|MSG) = \[([^\]]+)\]/g)) for (const x of m[1].matchAll(/'([^']+)'/g)) visible.push(x[1]);
for (const m of film.matchAll(/const (?:TEASE|SUB|PLAN) = '([^']+)'/g)) visible.push(m[1]);
for (const m of film.matchAll(/<div id="badge">([^<]+)<\/div>/g)) visible.push(m[1]);
const PLAN = /const PLAN = '([^']+)'/.exec(film)![1];
// Το πρότυπο της πρόσκλησης με το όνομα του πακέτου στη θέση της παρεμβολής.
const CTA = /const CTA = `([^`]+)`/.exec(film)![1].replace(/\$\{PLAN\}/, PLAN);
visible.push(CTA);

const fails: string[] = [];
// Το όνομα του πακέτου όπως στον κώδικα.
if (PLAN !== PLANS.owner.name) fails.push(`πακέτο «${PLAN}» ≠ PLANS.owner.name «${PLANS.owner.name}»`);

const sections = copy.split(/^## /m).slice(1).map((s) => ({ where: s.split('\n')[0], text: s.slice(s.indexOf('\n') + 1).trim() }));
const li = readFileSync(join(here, 'linkedin.md'), 'utf8').split(/^## /m).slice(1)
  .map((x) => ({ where: 'LinkedIn: ' + x.split('\n')[0], text: x.slice(x.indexOf('\n') + 1).trim() }));
for (const v of visible) fails.push(...copyFails(v, 'ταινία'));
for (const s of [...sections, ...li]) fails.push(...copyFails(s.text, s.where));
for (const x of li.filter((y) => y.where.includes('Ανάρτηση'))) {
  const lines = x.text.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
  if (lines.length < 4 || lines.length > 7) fails.push(`${x.where}: ${lines.length} γραμμές (4 έως 7)`);
  if (/\d/.test(x.text)) fails.push(`${x.where}: ψηφίο`);
  if (!lines[lines.length - 1].trim().endsWith(';')) fails.push(`${x.where}: δεν τελειώνει με ερώτηση`);
  const tags = x.text.match(/#\S+/g) ?? [];
  if (tags.length < 3 || tags.length > 4) fails.push(`${x.where}: ${tags.length} hashtags`);
}
const first = li.find((y) => y.where.includes('Πρώτο σχόλιο'));
if (!first || !first.text.includes('https://properwise.gr/?utm_source=linkedin&utm_medium=social&utm_campaign=aade')) fails.push('LinkedIn: πρώτο σχόλιο χωρίς τον σύνδεσμο');

// Ακρίβεια της ανακοίνωσης: καμία λέξη που υπονοεί επίσημη σχέση με την ΑΑΔΕ ή κάτι που δεν χτίζεται.
const FORBIDDEN: [RegExp, string][] = [
  [/—/, 'μεγάλη παύλα'], [/δωρεάν/i, '«δωρεάν»'], [/βοηθ/i, '«βοηθός»'],
  [/επίσημ/i, '«επίσημη»'], [/συνεργ/i, '«συνεργασία»'], [/πλήρως αυτόματ/i, '«πλήρως αυτόματα»'],
  [/απευθείας/i, '«απευθείας»'], [/gov\.gr/i, 'gov.gr'],
  // Κανένας μήνας κυκλοφορίας (ο κώδικας δεν έχει ημερομηνία). Ο «Ιούνιος» του LinkedIn Β είναι η εποχή των δηλώσεων.
  [/Ιανουάρ|Φεβρουάρ|Μάρτ|Απρίλ|Μάι|Ιούλ|Αύγουστ|Σεπτέμβρ|Οκτώβρ|Νοέμβρ|Δεκέμβρ/, 'ημερομηνία κυκλοφορίας'],
];
for (const s of [...visible.map((text) => ({ where: 'ταινία', text })), ...sections, ...li]) {
  for (const [re, what] of FORBIDDEN) if (re.test(s.text)) fails.push(`${s.where}: ${what}`);
}
// Κάθε ψηφίο των ορατών κειμένων και του share-copy στον πίνακα αριθμών του plan.md.
const table = plan.slice(plan.indexOf('## Αριθμοί'), plan.indexOf('## Αποφάσεις'));
const all = [...visible, ...sections.map((s) => s.text.replace(/https?:\S+/g, '').replace(/`[^`]*`/g, ''))].join('\n');
for (const tok of new Set(all.match(/[\dΑ-Ωα-ω]*\d[\d.,/€]*/g) ?? [])) {
  const t = tok.replace(/[.,]$/, '');
  if (!table.includes(t)) fails.push(`ψηφίο χωρίς γραμμή στον πίνακα: «${t}»`);
}

console.log(`ορατές συμβολοσειρές: ${visible.length} · ενότητες: ${sections.length} · LinkedIn: ${li.length}`);
for (const v of visible) console.log('  ·', v);
if (fails.length) { console.log('ΑΠΟΤΥΧΙΕΣ:\n' + fails.join('\n')); process.exit(1); }
console.log('✓ καμία αποτυχία');
