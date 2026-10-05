// npx tsx lib/facts/prices.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΘΕ ΤΙΜΗ ΚΑΙ ΚΑΘΕ ΟΡΙΟ: ΠΟΤΕ, ΑΠΟ ΠΟΥ, ΜΕ ΤΙΣ ΙΔΙΕΣ ΛΕΞΕΙΣ
// ─────────────────────────────────────────────────────────────────────────
// Η ισότητα με το data/price-sources.json φυλάσσεται στο lib/energy/label.test.ts.
// Εδώ: η γραμμή που γράφουν οι οθόνες, ο πάροχος χωρίς ημερομηνία, τα
// φορολογικά όρια από το μητρώο ισχύος και η κλίμακα σε μία πρόταση.
// ═══════════════════════════════════════════════════════════════════════════
import { PRICE_FACTS, TELECOM_FACTS, telecomAsOf, asOfLine, asOfDate } from './prices';
import { TAX_LIMIT_GROUPS, taxLimitAsOf, bracketsSentence } from './taxLimits';
import { regulated } from '@/lib/legal/validity';
import { RENTAL_TAX_BRACKETS_2026, RENTAL_TAX_BRACKETS_2025 } from '@/lib/billing/greekTax';
import { feWhole, fpRate } from '@/lib/core/format';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) pass++;
  else { fail++; console.error(`✗ ${name}`, extra ?? ''); }
};

// ── Η γραμμή ────────────────────────────────────────────────────────────────
const power = asOfLine(PRICE_FACTS.electricity);
ok('ρεύμα: ημερομηνία και πηγή', power === `Τελευταία ενημέρωση ${asOfDate(PRICE_FACTS.electricity.checkedAt)} · Πηγή: ${PRICE_FACTS.electricity.source}`, power);
ok('ημερομηνία ηη/μμ/εεεε', asOfDate('2026-10-05') === '05/10/2026' && asOfDate('όχι') === '');
for (const [k, f] of Object.entries({ ...PRICE_FACTS, ...TELECOM_FACTS })) {
  ok(`${k}: έγκυρη ημερομηνία ελέγχου`, !!f.checkedAt && /^\d{4}-\d{2}-\d{2}$/.test(f.checkedAt) && !Number.isNaN(Date.parse(f.checkedAt)));
  ok(`${k}: πηγή με όνομα`, f.source.trim().length > 3);
}

// ── Ο πάροχος που δεν ελέγχθηκε με ημερομηνία ───────────────────────────────
const cosmote = telecomAsOf('cosmote', 'Cosmote');
ok('χωρίς ημερομηνία: δεν δανείζεται άλλου', cosmote.checkedAt === null);
ok('χωρίς ημερομηνία: το λέει', /Χωρίς ημερομηνία ελέγχου/.test(asOfLine(cosmote)) && !/Τελευταία ενημέρωση/.test(asOfLine(cosmote)));
ok('με ημερομηνία: η δική του', telecomAsOf('nova').checkedAt === TELECOM_FACTS.nova.checkedAt);

// ── Τα φορολογικά όρια από το μητρώο ισχύος ────────────────────────────────
for (const g of Object.keys(TAX_LIMIT_GROUPS) as (keyof typeof TAX_LIMIT_GROUPS)[]) {
  const a = taxLimitAsOf(g);
  const oldest = TAX_LIMIT_GROUPS[g].map(id => regulated(id).checkedAt).sort()[0];
  ok(`${g}: ο παλαιότερος έλεγχος της ομάδας`, a.checkedAt === oldest, { got: a.checkedAt, oldest });
  ok(`${g}: πηγή από το μητρώο`, a.url === regulated(TAX_LIMIT_GROUPS[g][0]).source);
}

// ── Η κλίμακα σε μία πρόταση, από τα κλιμάκια ──────────────────────────────
const b = RENTAL_TAX_BRACKETS_2026;
const want2026 = `${fpRate(b[0].rate * 100)} έως ${feWhole(b[0].to)}, ${fpRate(b[1].rate * 100)} έως ${feWhole(b[1].to)}, `
  + `${fpRate(b[2].rate * 100)} έως ${feWhole(b[2].to)} και ${fpRate(b[3].rate * 100)} πάνω από αυτά`;
ok('2026: όλα τα κλιμάκια, με «και» χωρίς κόμμα', bracketsSentence(b) === want2026, bracketsSentence(b));
ok('2025: τρία κλιμάκια', bracketsSentence(RENTAL_TAX_BRACKETS_2025).split(' έως ').length === RENTAL_TAX_BRACKETS_2025.length);
ok('ποτέ «Infinity»', !/Infinity/.test(bracketsSentence(b)));

console.log(fail ? `✗ prices: ${fail} απέτυχαν, ${pass} πέρασαν` : `✓ prices: ${pass} έλεγχοι πέρασαν`);
if (fail) process.exit(1);
