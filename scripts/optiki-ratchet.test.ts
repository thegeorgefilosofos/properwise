// npx tsx scripts/optiki-ratchet.test.ts
//
// Η κρίση της καστάνιας της οπτικής σάρωσης, με σταθερά δείγματα αντί για
// περιηγητή. Η ίδια η βάση (scripts/optiki-baseline.json) ελέγχεται ότι είναι
// καλογραμμένη: μια βάση που διαβάζεται λάθος θα έβγαζε πράσινο σε κάθε άνοδο.
import { readFileSync } from 'node:fs';
import { compare, baselineFrom, signature, countsOf } from './lib/optiki-ratchet.mjs';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean) { if (cond) { pass++; } else { fail++; console.error(`✗ ${name}`); } }
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}

type F = { target: string; cls: string; sev: string; what: string; text: string; widths: number[]; themes: string[]; file?: string };
const f = (target: string, cls: string, sev: string, what: string, text = ''): F => ({ target, cls, sev, what, text, widths: [320], themes: ['dark'] });
const run = { widths: [320, 390, 768, 1280], themes: ['dark', 'light'], targets: ['overview', 'loan', '/'] };

const before: F[] = [
  f('overview', 'αναδίπλωση', 'Μεσαίο', 'λέξη ανά γραμμή: 3 λέξεις σε 3 γραμμές, πλάτος 108px', 'Έσοδα φιλοξενίας, εκτίμηση'),
  f('loan', 'επικάλυψη', 'Μεσαίο', 'το κουμπί «Ν» της Νόας σκεπάζει κείμενο (20×14px)', 'Δόση'),
  f('/', 'διπλότυπο', 'Χαμηλό', 'το ίδιο κουμπί/CTA 2 φορές', 'Ξεκίνα δωρεάν'),
];
const base = baselineFrom(before, run, 'δοκιμή');

// ═══ Η ΤΑΥΤΟΤΗΤΑ ΑΓΝΟΕΙ ΤΟΥΣ ΑΡΙΘΜΟΥΣ ══════════════════════════════════════
eq('ίδιο εύρημα με άλλα εικονοστοιχεία είναι το ίδιο εύρημα',
  signature(f('loan', 'επικάλυψη', 'Μεσαίο', 'κείμενο πάνω σε κείμενο (43×13px)', '1.234,00€')),
  signature(f('loan', 'επικάλυψη', 'Μεσαίο', 'κείμενο πάνω σε κείμενο (44×12px)', '987,50€')));
ok('άλλη σοβαρότητα είναι άλλο εύρημα',
  signature(f('loan', 'επικάλυψη', 'Μεσαίο', 'x')) !== signature(f('loan', 'επικάλυψη', 'Υψηλό', 'x')));
eq('πλήθη ανά οθόνη', countsOf(before).overview, { 'αναδίπλωση|Μεσαίο': 1 });

// ═══ ΙΔΙΑ ΣΑΡΩΣΗ: ΠΡΑΣΙΝΟ ══════════════════════════════════════════════════
const same = compare(before, run, base);
eq('καμία άνοδος στην ίδια σάρωση', same.up, []);
eq('κανένα νέο εύρημα στην ίδια σάρωση', same.fresh, []);

// ═══ ΕΝΑ ΝΕΟ ΕΥΡΗΜΑ: ΚΟΚΚΙΝΟ, ΜΕ ΤΟ ΕΥΡΗΜΑ ΟΝΟΜΑΣΤΙΚΑ ═════════════════════
const mutated = [...before, f('loan', 'αναδίπλωση', 'Υψηλό', 'λέξη ανά γραμμή: 4 λέξεις σε 4 γραμμές, πλάτος 60px', 'Μηνιαία δόση με επιτόκιο')];
const up = compare(mutated, run, base);
eq('η άνοδος φαίνεται στην κατηγορία της', up.up.map(r => `${r.key} ${r.max}→${r.now}`), ['αναδίπλωση|Υψηλό 0→1']);
eq('το νέο εύρημα τυπώνεται', up.fresh.map(x => x.text), ['Μηνιαία δόση με επιτόκιο']);

// ═══ ΠΤΩΣΗ: ΠΡΑΣΙΝΟ ΜΕ ΥΠΟΔΕΙΞΗ ════════════════════════════════════════════
const fewer = compare(before.slice(1), run, base);
eq('η πτώση δεν είναι άνοδος', fewer.up, []);
eq('η πτώση φαίνεται για να κατέβει η βάση', fewer.down.map(r => r.key), ['αναδίπλωση|Μεσαίο']);

// ═══ ΜΕΡΙΚΗ ΣΑΡΩΣΗ: ΜΕΤΡΟΥΝ ΜΟΝΟ ΟΙ ΟΘΟΝΕΣ ΠΟΥ ΕΤΡΕΞΑΝ ════════════════════
const only = compare(before.filter(x => x.target === 'loan'), { ...run, targets: ['loan'] }, base);
eq('μια οθόνη δεν «ρίχνει» τις άλλες', only.down, []);
eq('και δεν κρύβει άνοδο της ίδιας', compare([...before, f('loan', 'επικάλυψη', 'Μεσαίο', 'νέο')].filter(x => x.target === 'loan'), { ...run, targets: ['loan'] }, base).up.map(r => r.key), ['επικάλυψη|Μεσαίο']);

// ═══ ΝΕΑ ΣΕΛΙΔΑ ΣΤΟΝ ΧΑΡΤΗ: ΞΕΚΙΝΑ ΑΠΟ ΜΗΔΕΝ ══════════════════════════════
const newPage = compare([...before, f('/odigos/neos', 'διπλότυπο', 'Χαμηλό', 'το ίδιο κουμπί/CTA 2 φορές', 'Ξεκίνα δωρεάν')], { ...run, targets: [...run.targets, '/odigos/neos'] }, base);
eq('το εύρημα νέας σελίδας είναι νέο', newPage.up.map(r => `${r.key} ${r.max}→${r.now}`), ['διπλότυπο|Χαμηλό 1→2']);

// ═══ ΑΛΛΑ ΠΛΑΤΗ: ΔΕΝ ΚΡΙΝΕΤΑΙ ══════════════════════════════════════════════
ok('λιγότερα πλάτη δεν κρίνονται', !!compare(before, { ...run, widths: [390] }, base).refused);
ok('ένα θέμα δεν κρίνεται', !!compare(before, { ...run, themes: ['dark'] }, base).refused);
ok('ίδια πλάτη με άλλη σειρά κρίνονται', !compare(before, { ...run, widths: [1280, 768, 390, 320] }, base).refused);

// ═══ Η ΑΛΗΘΙΝΗ ΒΑΣΗ ΕΙΝΑΙ ΚΑΛΟΓΡΑΜΜΕΝΗ ════════════════════════════════════
const real = JSON.parse(readFileSync(new URL('./optiki-baseline.json', import.meta.url), 'utf8'));
ok('η βάση έχει σημείωση', typeof real.σημείωση === 'string' && real.σημείωση.length > 80);
ok('η βάση έχει πλάτη και θέματα', Array.isArray(real.widths) && real.widths.length > 0 && Array.isArray(real.themes) && real.themes.length > 0);
const sevs = new Set<string>();
for (const t of Object.values(real.counts) as Record<string, number>[]) for (const k of Object.keys(t)) sevs.add(k.split('|')[1]);
ok('κάθε σοβαρότητα της βάσης είναι γνωστή', [...sevs].every(s => ['Υψηλό', 'Μεσαίο', 'Χαμηλό'].includes(s)));
const total = (Object.values(real.counts) as Record<string, number>[]).reduce((n, t) => n + Object.values(t).reduce((a, b) => a + b, 0), 0);
ok('τα πλήθη συμφωνούν με τις ταυτότητες', total >= real.known.length);
ok('η βάση δεν έχει σελίδα που δεν φόρτωσε', !Object.values(real.counts).some((t) => Object.keys(t as object).some(k => k.startsWith('σφάλμα|'))));

console.log(`\noptiki-ratchet: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
