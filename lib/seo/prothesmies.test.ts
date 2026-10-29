// npx tsx lib/seo/prothesmies.test.ts
// Οι σελίδες των προθεσμιών λένε μόνο ό,τι έχει το φορολογικό ημερολόγιο.
import {
  parseMonthKey, monthKey, shiftMonth, monthLabel, monthLabelAcc, deadlinesOfMonth, upcomingMonths, monthPath,
} from './prothesmies';
import { greekPropertyTaxObligations } from '@/lib/tax/greekTaxCalendar';

let p = 0, f = 0;
const ok = (c: boolean, m: string) => { if (c) p++; else { f++; console.error('✗', m); } };
const eq = (a: unknown, b: unknown, m: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);

// ── Κλειδιά μήνα ───────────────────────────────────────────────────────────
eq(parseMonthKey('2026-10'), { year: 2026, month: 10 }, 'μήνας');
for (const bad of ['2026-13', '2026-1', '26-10', '2026-10-01', '', 'abcd-ef', '../etc']) ok(parseMonthKey(bad) === null, `όχι μήνας: «${bad}»`);
eq(monthKey(2027, 1), '2027-01', 'μηδενικό μπροστά');
eq(shiftMonth('2026-12', 1), '2027-01', 'αλλαγή χρονιάς προς τα μπρος');
eq(shiftMonth('2027-01', -1), '2026-12', 'και προς τα πίσω');
eq(monthLabel('2026-10'), 'Οκτώβριος 2026', 'ονομαστική');
eq(monthLabelAcc('2026-10'), 'Οκτώβριο 2026', 'αιτιατική');
eq(monthLabelAcc('2026-05'), 'Μάιο 2026', 'αιτιατική του Μαΐου');
eq(monthPath('2026-10'), '/prothesmies/2026-10', 'διαδρομή');

// ── Μόνο ό,τι έχει το ημερολόγιο ─────────────────────────────────────────────
const oct = deadlinesOfMonth('2026-10');
ok(oct.length > 0, 'ο Οκτώβριος έχει προθεσμίες');
ok(oct.every(d => d.obligation.date.startsWith('2026-10')), 'όλες μέσα στον μήνα');
ok(oct.every(d => /^https:\/\//.test(d.obligation.official_url)), 'όλες με επίσημη πηγή');
ok(oct.every((d, i) => i === 0 || oct[i - 1].obligation.date <= d.obligation.date), 'με σειρά ημερομηνίας');
eq(new Set(oct.map(d => d.obligation.id)).size, oct.length, 'καμία προθεσμία δύο φορές');
const cal = [...greekPropertyTaxObligations(2026, 'owner'), ...greekPropertyTaxObligations(2026, 'short_term')]
  .filter(o => o.date.startsWith('2026-10'));
eq([...new Set(cal.map(o => o.id))].sort(), oct.map(d => d.obligation.id).sort(), 'ακριβώς οι προθεσμίες του ημερολογίου');
const ownerIds = new Set(greekPropertyTaxObligations(2026, 'owner').map(o => o.id));
ok(oct.every(d => d.shortTermOnly === !ownerIds.has(d.obligation.id)), 'σωστή σήμανση «μόνο για βραχυχρόνια»');
// Ιανουάριος: η δόση ΕΝΦΙΑ του περσινού εκκαθαριστικού.
ok(deadlinesOfMonth('2027-01').some(d => /^enfia-/.test(d.obligation.kind)), 'ο Ιανουάριος έχει τη δόση του περσινού ΕΝΦΙΑ');
eq(deadlinesOfMonth('δεν-είναι'), [], 'κακό κλειδί, καμία γραμμή');

// ── Οι μήνες του χάρτη ────────────────────────────────────────────────────
const up = upcomingMonths('2026-10-29');
eq(up[0], '2026-10', 'ξεκινά από τον τρέχοντα');
ok(up.length <= 12 && up.every(m => deadlinesOfMonth(m).length > 0), 'έως δώδεκα, όλοι με προθεσμία');

console.log(`prothesmies: ${p} ✓ · ${f} ✗`);
if (f) process.exit(1);
