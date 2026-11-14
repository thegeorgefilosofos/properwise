// npx tsx lib/onboarding/firstTax.test.ts
//
// Ο ΠΡΩΤΟΣ ΦΟΡΟΣ ΕΙΝΑΙ Ο ΦΟΡΟΣ ΤΗΣ ΕΠΙΣΚΟΠΗΣΗΣ. Η κάρτα που βλέπει ο νέος
// χρήστης μόλις αποθηκεύσει και το πλακίδιο «Φόρος ενοικίου» από κάτω της
// πρέπει να λένε το ίδιο ποσό. Εδώ κλειδώνει ότι βγαίνουν από την ίδια
// συνάρτηση με τα ίδια έσοδα. Και ότι ακίνητο που δεν νοικιάζεται δεν δείχνει
// φόρο ενοικίων.
import { firstTaxOf, isRented, incomeTaxDeadline, taxDeadlineRow, deadlineDate, enfiaDeadline } from './firstTax';
import { propertyRentTax } from '@/lib/facts/rentTax';
import { writeStatus } from '@/lib/property/status';
import { greekPropertyTaxObligations } from '@/lib/tax/greekTaxCalendar';
import { monthYearLabel } from '@/lib/core/months';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };
const TODAY = '2026-11-13';

const leased = { id: 'p1', ...writeStatus('rent_long'), target_rent: 600, ownership: 100 };
const t = firstTaxOf(leased, TODAY);
const same = propertyRentTax({
  props: [leased], propertyId: 'p1', ownerClientIds: null, year: 2026, today: TODAY,
  income: new Map([['p1', { rents: [], stays: [], targetMonthly: 600, viaBank: true }]]),
});
ok('νοικιάζεται', t.rented && isRented(t.status));
ok('το ίδιο ποσό με την Επισκόπηση', t.tax === same.tax && t.tax > 0);
ok('τα ίδια έσοδα', t.annual === same.income.annual && t.annual > 0);
ok('η χρονιά από τη σημερινή μέρα', t.year === 2026);
ok('το μηνιαίο όπως γράφτηκε', t.monthly === 600);
ok('χωρίς ΕΝΦΙΑ, κενό', t.enfia === null);

const half = firstTaxOf({ ...leased, ownership: 50 }, TODAY);
ok('η συνιδιοκτησία δεν μεγαλώνει τον φόρο', half.tax <= t.tax);

const noRent = firstTaxOf({ id: 'p2', ...writeStatus('rent_long') }, TODAY);
ok('μίσθωση χωρίς ποσό: μηδέν, όχι NaN', noRent.tax === 0 && noRent.monthly === 0);

const own = firstTaxOf({ id: 'p3', ...writeStatus('own_use'), target_rent: 600, enfia: '320' }, TODAY);
ok('ιδιοχρησία: χωρίς φόρο ενοικίων', !own.rented && own.tax === 0);
ok('ο ΕΝΦΙΑ περνά ως αριθμός', own.enfia === 320);

// ── Η ΓΡΑΜΜΗ ΚΑΤΩ ΑΠΟ ΤΟΝ ΦΟΡΟ: Η ΔΗΛΩΣΗ ΠΟΥ ΦΟΡΟΛΟΓΕΙ ΤΟ ΙΔΙΟ ΕΙΣΟΔΗΜΑ ──
// Ο φόρος ενοικίων του έτους Υ δηλώνεται με τη δήλωση του Υ+1. Η γραμμή δεν
// είναι ποτέ δόση της προηγούμενης δήλωσης (κριτική σχεδίασης r3, 13/11/2026).
for (const st of ['rent_long', 'rent_short'] as const) {
  for (const Y of [2026, 2027]) {
    const o = incomeTaxDeadline(st, Y);
    ok(`${st} ${Y}: η δήλωση του ${Y + 1}`, !!o && o.kind === 'income-decl' && o.id === `income-decl-${Y + 1}`);
    ok(`${st} ${Y}: ημερομηνία μέσα στο ${Y + 1}`, !!o && o.date.startsWith(`${Y + 1}-`));
    const row = taxDeadlineRow(st, Y);
    // Η δήλωση ανακοινώνεται κάθε χρόνο: μόνο μήνας και έτος, ποτέ μέρα (r4).
    ok(`${st} ${Y}: ανακοινώσιμη προθεσμία`, !!o && o.confidence === 'announced');
    ok(`${st} ${Y}: μήνας και έτος του ${Y + 1}, χωρίς μέρα`, !!row && !!o && row.date === monthYearLabel(o.date.slice(0, 7)) && row.date.endsWith(` ${Y + 1}`) && !/\\d{2}\//.test(row.date));
    ok(`${st} ${Y}: σύντομος τίτλος, όχι ΕΝΦΙΑ, όχι δόση`, !!row && row.title === 'Δήλωση φόρου εισοδήματος' && !/ΕΝΦΙΑ|δόση|Ε1/.test(row.title));
  }
}
// Η ΧΡΟΝΙΑ ΒΓΑΙΝΕΙ ΑΠΟ ΤΟ ΠΟΣΟ, ΟΧΙ ΑΠΟ ΤΟ ΣΗΜΕΡΑ: στις 13/11/2026 ο φόρος είναι
// του 2026 και η γραμμή είναι του 2027, όχι η 5η δόση του Νοεμβρίου 2026.
{
  const t2 = firstTaxOf({ id: 'p9', ...writeStatus('rent_long'), target_rent: 600 }, TODAY);
  const row = taxDeadlineRow('rent_long', t2.year);
  ok('13/11/2026: φόρος του 2026, γραμμή στο 2027', t2.year === 2026 && !!row && row.date === 'Ιούλιος 2027' && row.id === 'income-decl-2027');
}
// ── Η ΑΚΡΙΒΕΙΑ ΤΗΣ ΗΜΕΡΟΜΗΝΙΑΣ (r4): του νόμου ολόκληρη, ανακοινώσιμη μόνο μήνας ──
ok('προθεσμία του νόμου: ηη/μμ/εεεε', deadlineDate({ date: '2027-07-30', confidence: 'statutory' }) === '30/07/2027');
ok('ανακοινώσιμη: «Ιούλιος 2027»', deadlineDate({ date: '2027-07-15', confidence: 'announced' }) === 'Ιούλιος 2027');
// ── Ο ΕΝΦΙΑ ΤΟΥ ΑΚΙΝΗΤΟΥ ΠΟΥ ΔΕΝ ΝΟΙΚΙΑΖΕΤΑΙ (r4) ──
for (const day of ['2026-11-14', '2027-01-10', '2027-03-01', '2026-12-31']) {
  const e = enfiaDeadline('own_use', day);
  const pool = e ? greekPropertyTaxObligations(e.year, 'owner').filter(o => o.id === e.row.id) : [];
  ok(`ΕΝΦΙΑ (${day}): επόμενη δόση από το ημερολόγιο`, !!e && pool.length === 1 && pool[0].date >= day && /^enfia-(first|instalment|last)/.test(pool[0].id));
  ok(`ΕΝΦΙΑ (${day}): η ημερομηνία στην ακρίβεια του ημερολογίου`, !!e && pool.length === 1 && e.row.date === deadlineDate(pool[0]));
}
{
  const jan = enfiaDeadline('vacant', '2027-01-10');
  ok('Ιανουάριος 2027: η δόση είναι ακόμη του ΕΝΦΙΑ 2026', !!jan && jan.year === 2026);
}
ok('ακίνητο που δεν νοικιάζεται: καμία γραμμή', taxDeadlineRow('own_use', 2026) === null && taxDeadlineRow('vacant', 2026) === null);

console.log(`${pass} πέρασαν, ${fail} απέτυχαν`);
if (fail) process.exit(1);
