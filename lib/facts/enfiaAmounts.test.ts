// npx tsx lib/facts/enfiaAmounts.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΠΟΣΟ ΤΗΣ ΔΟΣΗΣ ΣΤΗΝ ΥΠΕΝΘΥΜΙΣΗ (29/10/2026)
// ─────────────────────────────────────────────────────────────────────────
// Με γνωστό το σύνολο του εκκαθαριστικού, κάθε δόση ΕΝΦΙΑ του ημερολογίου
// γράφεται με το ποσό της από το `enfiaInstalments`· το ποσό φτάνει ως το
// κείμενο της ειδοποίησης. Χωρίς σύνολο, τίποτα δεν αλλάζει: ίδιο γεγονός,
// ίδιο κείμενο με πριν.
// ═══════════════════════════════════════════════════════════════════════════
import { taxEventsToWrite } from './deadlines';
import { enfiaInstalments, enfiaInstalmentCount, ENFIA_MIN_INSTALMENT } from '@/lib/tools/enfiaSchedule';
import { deadlineItems } from '@/lib/calendar/deadlines';
import { dailyPush } from '@/lib/push/message';
import { enfiaTotalsByProperty, enfiaCountsByProperty } from '@/lib/calendar/enfiaTotals';

let p = 0, f = 0;
const ok = (c: boolean, m: string) => { if (c) p++; else { f++; console.error('✗', m); } };
const eq = (a: unknown, b: unknown, m: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}\n   πήρα:    ${JSON.stringify(a)}\n   περίμενα: ${JSON.stringify(b)}`);

const TODAY = '2026-01-15';
const YEAR = 2026;
const enfia = (rows: ReturnType<typeof taxEventsToWrite>) =>
  rows.filter(r => /^tax:enfia-(first|instalment|last)-2026/.test(String(r.source)));

// ── Με σύνολο: κάθε δόση έχει το ποσό της ─────────────────────────────────
const TOTAL = 315.97;
const n = enfiaInstalmentCount(TOTAL);
const withTotal = enfia(taxEventsToWrite(TODAY, 'owner', [], { enfiaInstalments: { [YEAR]: n } }, { enfiaTotals: { [YEAR]: TOTAL } }));
const plan = enfiaInstalments(TOTAL, YEAR);
eq(withTotal.length, n, 'όσες δόσεις, τόσα γεγονότα');
ok(withTotal.every(r => typeof r.amount === 'number' && r.amount > 0), 'κάθε δόση έχει ποσό');
eq(withTotal.map(r => r.amount), plan.map(i => i.amount), 'τα ποσά είναι του enfiaInstalments, με τη σειρά του');
const sum = Math.round(withTotal.reduce((s, r) => s + (r.amount ?? 0), 0) * 100);
eq(sum, Math.round(TOTAL * 100), 'το άθροισμα κλείνει ακριβώς στο λεπτό');
ok(withTotal.every(r => Math.round((r.amount ?? 0) * 100) === (r.amount ?? 0) * 100), 'κανένα ποσό με κλάσμα λεπτού');
eq(withTotal[0].amount, 26.33, '315,97 σε 12: 26,33 η δόση');
eq(withTotal[n - 1].amount, 26.34, 'και η τελευταία παίρνει τη διαφορά');

// ── Το όριο των 10€ ανά δόση ───────────────────────────────────────────────
const SMALL = 47.5;
const m = enfiaInstalmentCount(SMALL);
eq(m, 4, '47,50€ δίνει τέσσερις δόσεις');
const small = enfia(taxEventsToWrite(TODAY, 'owner', [], { enfiaInstalments: { [YEAR]: m } }, { enfiaTotals: { [YEAR]: SMALL } }));
eq(small.length, m, 'ο κανόνας του ορίου κρατά τέσσερα γεγονότα');
ok(small.every(r => (r.amount ?? 0) >= ENFIA_MIN_INSTALMENT), `καμία δόση κάτω από ${ENFIA_MIN_INSTALMENT}€`);
eq(Math.round(small.reduce((s, r) => s + (r.amount ?? 0), 0) * 100), 4750, 'και τα τέσσερα κλείνουν στα 47,50€');

// ── Χωρίς σύνολο: ακριβώς όπως πριν ───────────────────────────────────────
const before = enfia(taxEventsToWrite(TODAY, 'owner', []));
ok(before.every(r => r.amount == null), 'χωρίς σύνολο, καμία δόση δεν παίρνει ποσό');
const other = enfia(taxEventsToWrite(TODAY, 'owner', [], {}, { enfiaTotals: { 2025: 500 } }));
ok(other.every(r => r.amount == null), 'σύνολο άλλου έτους δεν δίνει ποσό σε αυτό');

// ── Ως την ειδοποίηση ──────────────────────────────────────────────────────
const eighth = withTotal[7];
const date = String(eighth.event_date).slice(0, 10);
const yesterday = (iso: string) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
const items = (amount: number | null) => deadlineItems({
  properties: [{ id: 'p1', name: 'Αλεξάνδρας 12' }],
  events: [{ id: 'e8', property_id: 'p1', title: eighth.title, event_date: date, amount, source: eighth.source }],
  tasks: [], bills: [], rent: [], from: TODAY, to: '2027-03-01',
});
const msg = dailyPush(items(eighth.amount ?? null), yesterday(date));
eq(msg?.title.startsWith('ΕΝΦΙΑ, 8η δόση'), true, 'ο τίτλος λέει ποια δόση');
eq(msg?.body, `Λήγει αύριο, ${String(eighth.amount?.toFixed(2)).replace('.', ',')}€`, 'το σώμα λέει πότε και πόσο');
const bare = dailyPush(items(null), yesterday(date));
eq(bare?.body, 'Λήγει αύριο', 'χωρίς ποσό, το σώμα είναι το σημερινό');

// ── Ενας φορολογούμενος, ένα σύνολο ───────────────────────────────────────
const props = [{ id: 'a', client_id: null }, { id: 'b', client_id: null }];
const facts = [{ propertyId: 'a', year: YEAR, amount: TOTAL }];
eq(enfiaTotalsByProperty(props, null, facts).get('b'), { [YEAR]: TOTAL }, 'ιδιώτης: το σύνολο του ενός ακινήτου ισχύει και στο άλλο');
eq(enfiaTotalsByProperty(props, new Set(), facts).get('b'), {}, 'κάθε ακίνητο μόνο του: το άλλο μένει χωρίς σύνολο');
eq(enfiaCountsByProperty(props, null, facts).get('a'), { [YEAR]: n }, 'το πλήθος δόσεων βγαίνει από το ίδιο σύνολο');

console.log(`enfiaAmounts: ${p} ✓ · ${f} ✗`);
if (f) process.exit(1);
