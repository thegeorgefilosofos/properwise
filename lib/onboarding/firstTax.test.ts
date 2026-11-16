// npx tsx lib/onboarding/firstTax.test.ts
//
// Ο ΠΡΩΤΟΣ ΦΟΡΟΣ ΕΙΝΑΙ Ο ΦΟΡΟΣ ΤΗΣ ΕΠΙΣΚΟΠΗΣΗΣ. Η κάρτα που βλέπει ο νέος
// χρήστης μόλις αποθηκεύσει και το πλακίδιο «Φόρος ενοικίου» από κάτω της
// πρέπει να λένε το ίδιο ποσό. Εδώ κλειδώνει ότι βγαίνουν από την ίδια
// συνάρτηση με τα ίδια έσοδα. Και ότι ακίνητο που δεν νοικιάζεται δεν δείχνει
// φόρο ενοικίων.
import { firstTaxOf, isRented, incomeTaxDeadline, taxDeadlineRow, deadlineDate, enfiaDeadline, enfiaSplitParts, enfiaSplitText, enfiaOutsidePlan } from './firstTax';
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
// ── Ο ΕΝΦΙΑ ΤΟΥ ΑΚΙΝΗΤΟΥ ΠΟΥ ΔΕΝ ΝΟΙΚΙΑΖΕΤΑΙ (r4, r5) ──
for (const day of ['2026-11-14', '2027-01-10', '2027-03-01', '2026-12-31']) {
  const e = enfiaDeadline('own_use', day, 320);
  const pool = e && e.row ? greekPropertyTaxObligations(e.year, 'owner', { enfiaInstalments: { [e.year]: e.count } }).filter(o => o.id === e.row!.id) : [];
  // Μετά την 12η δόση και πριν από το νέο εκκαθαριστικό (1/3/2027) η γραμμή είναι η τελευταία δόση.
  ok(`ΕΝΦΙΑ (${day}): δόση από το ημερολόγιο`, !!e && pool.length === 1 && (e.paidOff ? pool[0].date < day && !!e.next : pool[0].date >= day) && /^enfia-(first|instalment|last)/.test(pool[0].id));
  ok(`ΕΝΦΙΑ (${day}): η ημερομηνία στην ακρίβεια του ημερολογίου`, !!e && pool.length === 1 && e.row!.date === deadlineDate(pool[0]));
}
{
  const jan = enfiaDeadline('vacant', '2027-01-10', 320);
  ok('Ιανουάριος 2027: η δόση είναι ακόμη του ΕΝΦΙΑ 2026', !!jan && jan.year === 2026 && !jan.paidOff);
  const mar = enfiaDeadline('vacant', '2027-03-01', 320);
  ok('1/3/2027: το 2026 εξοφλημένο, το 2027 μόνο ως μήνας', !!mar && mar.year === 2026 && mar.paidOff && mar.next?.title === 'ΕΝΦΙΑ 2027');
  // ΠΛΗΘΟΣ ΔΟΣΕΩΝ ΑΠΟ ΤΟ ΠΟΣΟ: 60€ είναι έξι δόσεις (10€ η καθεμία), ως τον Αύγουστο.
  const small = enfiaDeadline('own_use', '2026-11-14', 60);
  ok('60€ στις 14/11/2026: ΟΧΙ η 9η δόση του 2026', !!small && small.row?.id !== 'enfia-instalment-2026-9' && small.count === 6);
  ok('60€: έξι δόσεις των 10,00€', !!small && small.each === 10 && small.last === 10);
}
{
  // ΚΑΝΕΝΑ ΕΚΚΑΘΑΡΙΣΤΙΚΟ ΠΟΥ ΔΕΝ ΕΚΔΟΘΗΚΕ (κριτική σχεδίασης r6): κάτω από 90€ οι
  // δόσεις του 2026 έχουν τελειώσει στις 16/11/2026. Το έτος μένει 2026, η γραμμή
  // είναι η τελευταία δόση του και το 2027 βγαίνει μόνο ως μήνας, χωρίς ποσό.
  const D = '2026-11-16';
  for (const [amount, count, lastId, lastDate] of [
    [60, 6, 'enfia-instalment-2026-6', '31/08/2026'],
    [85, 8, 'enfia-instalment-2026-8', '30/10/2026'],
    [9, 1, 'enfia-first-2026', '31/03/2026'],
  ] as const) {
    const e = enfiaDeadline('own_use', D, amount);
    ok(`${amount}€: έτος 2026, όχι 2027`, !!e && e.year === 2026);
    ok(`${amount}€: ${count} δόσεις`, !!e && e.count === count);
    ok(`${amount}€: εξοφλημένο εκκαθαριστικό`, !!e && e.paidOff);
    ok(`${amount}€: η γραμμή είναι η τελευταία δόση του 2026`, !!e && e.row?.id === lastId && e.row?.date === lastDate);
    ok(`${amount}€: το 2027 χωρίς ποσό και χωρίς αριθμό δόσης`, !!e && e.next?.title === 'ΕΝΦΙΑ 2027' && e.next?.date === monthYearLabel('2027-03') && !/€|δόση/.test(`${e.next?.title} ${e.next?.date}`));
    ok(`${amount}€: κανένα ποσό του 2027`, !!e && !/2027/.test(e.row?.id ?? ''));
  }
  const nine = enfiaDeadline('own_use', D, 9)!;
  ok('9€: ποτέ «1η δόση» δίπλα στο «Σε μία δόση»', !/1η/.test(nine.row?.title ?? '') && enfiaSplitText(nine) === 'Σε μία δόση.');
  ok('9€: η γραμμή λέει το ποσό της μίας δόσης', nine.row?.title === 'Πληρωμή σε μία δόση 9,00€');
  const eightyFive = enfiaDeadline('own_use', D, 85)!;
  ok('85€: «7 δόσεις των 10,62€ και μία των 10,66€.»', enfiaSplitText(eightyFive) === '7\u00a0δόσεις των 10,62€ και μία των 10,66€.');
  // Πριν από την έκδοση του 2027 (Ιανουάριος), το εκκαθαριστικό που ισχύει είναι του 2026.
  const febSmall = enfiaDeadline('own_use', '2027-01-20', 60);
  ok('Ιανουάριος 2027, 60€: εκκαθαριστικό 2026, εξοφλημένο', !!febSmall && febSmall.year === 2026 && febSmall.paidOff);
  // Η ατζέντα δεν δείχνει 9η δόση για 85€ (οκτώ δόσεις), δείχνει την 9η για 320€.
  ok('85€: η 9η δόση του 2026 είναι εκτός εκκαθαριστικού', enfiaOutsidePlan('tax:enfia-instalment-2026-9', eightyFive) && enfiaOutsidePlan('tax:enfia-last-2026', eightyFive));
  ok('85€: η 8η δόση και το 2027 μένουν', !enfiaOutsidePlan('tax:enfia-instalment-2026-8', eightyFive) && !enfiaOutsidePlan('tax:enfia-first-2027', eightyFive));
  ok('320€: η 9η δόση μένει', !enfiaOutsidePlan('tax:enfia-instalment-2026-9', enfiaDeadline('own_use', D, 320)));
  ok('άλλα κλειδιά: ποτέ', !enfiaOutsidePlan('tax:income-decl-2027', eightyFive) && !enfiaOutsidePlan('setup:details', eightyFive));
  // Με δόση που μένει, καμία γραμμή «επόμενο εκκαθαριστικό».
  const live = enfiaDeadline('own_use', D, 320)!;
  ok('320€: δόση που μένει, χωρίς επόμενο εκκαθαριστικό', !live.paidOff && live.next === null);
}
{
  // ΤΑ ΚΟΜΜΑΤΙΑ ΑΘΡΟΙΖΟΝΤΑΙ ΣΤΟ ΣΥΝΟΛΟ (κριτική σχεδίασης r6).
  for (const amount of [9, 15, 27.44, 60, 85, 99.99, 120, 180.28, 320, 1234.57]) {
    const e = enfiaDeadline('own_use', '2026-11-16', amount)!;
    const parts = enfiaSplitParts(e);
    const sum = parts.reduce((s, p) => s + p.n * p.amount, 0);
    ok(`${amount}€: τα κομμάτια αθροίζονται στο σύνολο`, Math.abs(sum - amount) < 0.005);
    ok(`${amount}€: τα κομμάτια μετρούν όσες δόσεις`, parts.reduce((s, p) => s + p.n, 0) === e.count);
  }
  const big = enfiaDeadline('own_use', '2026-11-16', 320)!;
  ok('320€: «11 δόσεις των 26,66€ και μία των 26,74€.»', enfiaSplitText(big) === '11\u00a0δόσεις των 26,66€ και μία των 26,74€.');
  const even = enfiaDeadline('own_use', '2026-11-16', 120)!;
  ok('120€: «12 δόσεις των 10,00€.»', enfiaSplitText(even) === '12\u00a0δόσεις των 10,00€.');
  ok('χωρίς ποσό: καμία πρόταση', enfiaSplitText({ count: 0, each: 0, last: 0 }) === '');
}
{
  // Το ποσό της δόσης όπως το βγάζει η ατζέντα (enfiaInstalments): 320 / 12, κάτω στο λεπτό.
  const big = enfiaDeadline('own_use', '2026-11-14', 320);
  ok('320€ στις 14/11/2026: «9η δόση 26,66€», 30/11/2026', !!big && big.row?.title === '9η δόση 26,66€' && big.row?.date === '30/11/2026' && big.count === 12);
  ok('320€: η τελευταία παίρνει τη διαφορά', !!big && big.each === 26.66 && Math.abs(big.each * 11 + big.last - 320) < 0.001);
  // Χωρίς ποσό δεν υπάρχει γραμμή δόσης: δεν ξέρουμε πόσες είναι.
  const none = enfiaDeadline('own_use', '2026-11-14');
  ok('χωρίς ποσό: έτος, καμία δόση', !!none && none.year === 2026 && none.row === null && none.count === 0);
}
ok('ακίνητο που δεν νοικιάζεται: καμία γραμμή', taxDeadlineRow('own_use', 2026) === null && taxDeadlineRow('vacant', 2026) === null);

console.log(`${pass} πέρασαν, ${fail} απέτυχαν`);
if (fail) process.exit(1);
