// npx tsx lib/rent/split.test.ts
//
// Η ΔΟΣΗ ΔΕΝ ΕΙΝΑΙ ΤΟ ΜΙΣΘΩΜΑ. Το `amount` = ενοίκιο + υπηρεσίες που
// χρεώνονται στον μισθωτή. Το Ε2 και ο φόρος άθροιζαν το `amount` και
// δήλωναν τις υπηρεσίες ως εισόδημα από ακίνητο.
import { rentIncomeOf, servicesOf, hasRentSplit } from './split';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

ok('με ανάλυση: μετρά το ενοίκιο', rentIncomeOf({ amount: 1100, base_rent: 1000, services_charge: 100 }) === 1000);
ok('με ανάλυση: οι υπηρεσίες χωριστά', servicesOf({ amount: 1100, base_rent: 1000, services_charge: 100 }) === 100);
ok('χωρίς στήλη υπηρεσιών: η διαφορά', servicesOf({ amount: 1100, base_rent: 1000 }) === 100);
ok('παλιά γραμμή: ολόκληρο το ποσό', rentIncomeOf({ amount: 1100 }) === 1100 && !hasRentSplit({ amount: 1100 }));
ok('παλιά γραμμή: καμία υπηρεσία δεν μαντεύεται', servicesOf({ amount: 1100 }) === 0);
ok('ενοίκιο μηδέν είναι ανάλυση, όχι παλιά γραμμή', hasRentSplit({ amount: 50, base_rent: 0 }) && rentIncomeOf({ amount: 50, base_rent: 0 }) === 0);
ok('κενό ποσό: μηδέν', rentIncomeOf({ amount: null }) === 0);
ok('ποτέ αρνητικό', servicesOf({ amount: 900, base_rent: 1000 }) === 0);

console.log(fail === 0 ? `✓ rent/split: ${pass} έλεγχοι πέρασαν` : `✗ rent/split: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
