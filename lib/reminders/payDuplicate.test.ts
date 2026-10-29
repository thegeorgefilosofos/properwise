// npx tsx lib/reminders/payDuplicate.test.ts
// Το έξοδο ΕΝΦΙΑ που υπάρχει ήδη για τη δόση: τι μετρά ως «η ίδια δόση».
import { hasMatchingInstalment, duplicateWindow, DUPLICATE_WINDOW_DAYS } from './payDuplicate';

let p = 0, f = 0;
const ok = (c: boolean, m: string) => { if (c) p++; else { f++; console.error('✗', m); } };

const due = '2026-10-30';
const amt = 26.33;
const row = (o: Partial<{ amount: number | string | null; date: string | null; category: string | null }> = {}) =>
  ({ amount: amt, date: due, category: 'enfia', ...o });

ok(!hasMatchingInstalment([], amt, due), 'κανένα έξοδο: δεν υπάρχει διπλό');
ok(hasMatchingInstalment([row()], amt, due), 'ίδιο ποσό, ίδια μέρα, ΕΝΦΙΑ: διπλό');
ok(hasMatchingInstalment([row({ amount: '26.33' })], amt, due), 'ποσό ως κείμενο (numeric του PostgREST): διπλό');
ok(hasMatchingInstalment([row({ amount: amt + 0.01 })], amt, due), 'ένα λεπτό διαφορά: διπλό');
ok(!hasMatchingInstalment([row({ amount: amt + 0.02 })], amt, due), 'δύο λεπτά διαφορά: άλλο έξοδο');
ok(hasMatchingInstalment([row({ date: '2026-10-15' })], amt, due), `${DUPLICATE_WINDOW_DAYS} μέρες πριν: διπλό`);
ok(hasMatchingInstalment([row({ date: '2026-11-14' })], amt, due), `${DUPLICATE_WINDOW_DAYS} μέρες μετά: διπλό`);
ok(!hasMatchingInstalment([row({ date: '2026-10-14' })], amt, due), 'έξω από το παράθυρο: άλλη δόση');
ok(!hasMatchingInstalment([row({ date: '2026-11-30' })], amt, due), 'η επόμενη δόση: όχι διπλό');
ok(hasMatchingInstalment([row({ category: 'Φορολογικό / ΕΝΦΙΑ' })], amt, due), 'παλιά ονομασία κατηγορίας: διπλό');
ok(!hasMatchingInstalment([row({ category: 'electricity' })], amt, due), 'άλλη κατηγορία, ίδιο ποσό: όχι διπλό');
ok(!hasMatchingInstalment([row({ date: null })], amt, due), 'χωρίς ημερομηνία: όχι διπλό');
const w = duplicateWindow(due);
ok(w.from === '2026-10-15' && w.to === '2026-11-14', `παράθυρο ανάγνωσης: ${w.from} – ${w.to}`);

console.log(`payDuplicate: ${p} ✓ · ${f} ✗`);
if (f) process.exit(1);
