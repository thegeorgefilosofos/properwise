// npx tsx lib/i18n/taxTitleEn.test.ts
// Ο αγγλικός τίτλος από τη γραμμή του ημερολογίου (`source = tax:<id>`) πρέπει
// να είναι ΙΔΙΟΣ με αυτόν που δείχνει η εφαρμογή για την ίδια υποχρέωση.
import { greekPropertyTaxObligations, taxEventSource } from '@/lib/tax/greekTaxCalendar';
import { obligationTitleEn } from './en/deadlines';
import { taxEventTitleEn } from './taxTitleEn';

let p = 0, f = 0;
const ok = (c: boolean, m: string) => { if (c) p++; else { f++; console.error('✗', m); } };

for (const year of [2025, 2026, 2027]) {
  for (const o of greekPropertyTaxObligations(year, 'short_term')) {
    const fromRow = taxEventTitleEn(taxEventSource(o.id), o.title);
    const single = o.kind === 'enfia-first' && o.title.includes('μία δόση');
    ok(single ? fromRow === 'ENFIA: payment in a single installment' : fromRow === obligationTitleEn(o),
      `${o.id}: «${fromRow}» αντί για «${obligationTitleEn(o)}»`);
    ok(!!fromRow && !/[\p{Script=Greek}]/u.test(fromRow), `${o.id}: χωρίς ελληνικό γράμμα`);
  }
}
ok(taxEventTitleEn('bills', 'ΔΕΗ') === null, 'γραμμή χωρίς φόρο: ο τίτλος του χρήστη μένει');
ok(taxEventTitleEn(null, 'x') === null, 'χωρίς πηγή: τίποτα');
ok(taxEventTitleEn('tax:unknown-2026', 'x') === null, 'άγνωστο είδος: τίποτα');
ok(taxEventTitleEn('tax:enfia-issue-2026', 'ΕΝΦΙΑ, έκδοση εκκαθαριστικού (αναμένεται)') === 'ENFIA: assessment notice issued (expected)', 'το «αναμένεται» περνά');

console.log(`taxTitle — ${p} passed, ${f} failed`);
if (f) process.exit(1);
