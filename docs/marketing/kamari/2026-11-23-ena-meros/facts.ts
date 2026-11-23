// Οι ημερομηνίες και οι μέρες του plan.md, από τον κώδικα και μόνο.
//   npx tsx docs/marketing/kamari/2026-11-23-ena-meros/facts.ts [εεεε-μμ-ηη]
// Τυπώνει τις φορολογικές υποχρεώσεις των επόμενων 45 ημερών ανά προφίλ και την
// προθεσμία της έκπτωσης ανακαίνισης με τις μέρες που μένουν.
import { taxObligationsHorizon } from '../../../../lib/tax/greekTaxCalendar';
import { RENO_39B_TO, RENO_39B_FROM, RENO_39B_CAP, RENO_39B_YEARS } from '../../../../lib/accounting/renovation39b';

const today = process.argv[2] ?? '2026-11-23';
const DAY = 86400000;
const days = (iso: string) => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / DAY);
const end = new Date(Date.parse(today + 'T00:00:00Z') + 45 * DAY).toISOString().slice(0, 10);
for (const p of ['owner', 'long_term', 'short_term'] as const) {
  console.log(p);
  for (const o of taxObligationsHorizon(today, p).filter((o) => o.date >= today && o.date <= end)) console.log(`  ${o.date} · ${o.title} · ${days(o.date)} ημέρες · ${o.confidence}`);
}
const [d, m, y] = RENO_39B_TO.split('/');
console.log(`ανακαίνιση: ${RENO_39B_FROM} έως ${RENO_39B_TO} · ${days(`${y}-${m}-${d}`)} ημέρες · έως ${RENO_39B_CAP}€ σε ${RENO_39B_YEARS} έτη`);
