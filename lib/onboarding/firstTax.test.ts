// npx tsx lib/onboarding/firstTax.test.ts
//
// Ο ΠΡΩΤΟΣ ΦΟΡΟΣ ΕΙΝΑΙ Ο ΦΟΡΟΣ ΤΗΣ ΕΠΙΣΚΟΠΗΣΗΣ. Η κάρτα που βλέπει ο νέος
// χρήστης μόλις αποθηκεύσει και το πλακίδιο «Φόρος ενοικίου» από κάτω της
// πρέπει να λένε το ίδιο ποσό. Εδώ κλειδώνει ότι βγαίνουν από την ίδια
// συνάρτηση με τα ίδια έσοδα. Και ότι ακίνητο που δεν νοικιάζεται δεν δείχνει
// φόρο ενοικίων.
import { firstTaxOf, firstDeadlines, isRented, incomeTaxDeadline } from './firstTax';
import { propertyRentTax } from '@/lib/facts/rentTax';
import { writeStatus } from '@/lib/property/status';

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

const dl = firstDeadlines('rent_long', TODAY);
ok('δύο επόμενες προθεσμίες', dl.length === 2);
ok('από σήμερα και μετά', dl.every(d => d.date >= TODAY));
ok('με τη σειρά', dl[0].date <= dl[1].date);

// Η ΓΡΑΜΜΗ ΚΑΤΩ ΑΠΟ ΤΟΝ ΦΟΡΟ ΕΝΟΙΚΙΩΝ ΤΗΣ ΥΠΟΔΟΧΗΣ: ίδιος φόρος, ποτέ ΕΝΦΙΑ.
for (const day of [TODAY, '2026-01-10', '2026-06-15', '2026-12-31']) {
  const inc = incomeTaxDeadline('rent_long', day);
  ok(`προθεσμία φόρου εισοδήματος (${day})`, !!inc && /^income-/.test(inc.kind) && inc.date >= day);
  ok(`όχι ΕΝΦΙΑ (${day})`, !inc || !/ΕΝΦΙΑ/.test(inc.title));
}

console.log(`${pass} πέρασαν, ${fail} απέτυχαν`);
if (fail) process.exit(1);
