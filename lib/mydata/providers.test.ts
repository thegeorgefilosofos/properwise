// npx tsx lib/mydata/providers.test.ts
//
// ΤΟ ΜΗΤΡΩΟ ΠΑΡΟΧΩΝ: ΚΑΘΕ ΕΓΓΡΑΦΗ ΜΕ ΠΗΓΗ, ΚΑΘΕ ΑΦΜ ΜΕ ΣΩΣΤΟ ΨΗΦΙΟ ΕΛΕΓΧΟΥ.
//
// Το μητρώο αποφασίζει τι καταχωρείται χωρίς πάτημα. Ενα λάθος ΑΦΜ εδώ θα
// έβαζε ξένα παραστατικά ως δαπάνες ακινήτου· γι' αυτό ελέγχονται όλες οι
// εγγραφές, όχι δείγμα. Η κατηγορία κάθε είδους πρέπει να είναι ΑΚΡΙΒΩΣ αυτή
// της ταξινομίας (ετικέτα και ομάδα), αφού η βάση τη γράφει χωρίς την εφαρμογή.
import { PROVIDERS, NOT_PROPERTY, KIND_CATEGORY, KINDS, providerByAfm, providerName } from './providers';

// Οι τιμές E3_585_001 έως 016 του ExpensesClassificationTypeClassificationType στο
// SimpleTypes-v2.0.2.xsd της ΑΑΔΕ, όπως τις απαριθμεί το σχήμα.
const AADE_EXPENSE_CODES: ReadonlySet<string> = new Set(Array.from({ length: 16 }, (_, i) => `E3_585_${String(i + 1).padStart(3, '0')}`));
import { BY_SLUG } from '../expenses/taxonomy';
import { groupForCategory } from '../expenses/groups';
import { isValidAfm } from '../core/greek';
import { BANK_PAYMENT_LIMIT_CENTS, BANK_PAYMENT_LIMIT_SOURCE, UNUSUAL_FACTOR } from './limits';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name); } };

ok('το μητρώο δεν είναι άδειο', PROVIDERS.length > 0);
const afms = new Set<string>();
for (const p of PROVIDERS) {
  ok(`${p.name}: ΑΦΜ με σωστό ψηφίο ελέγχου`, isValidAfm(p.afm));
  ok(`${p.name}: μοναδικό ΑΦΜ`, !afms.has(p.afm));
  afms.add(p.afm);
  ok(`${p.name}: πηγή https`, /^https:\/\/[^\s]+$/.test(p.source));
  ok(`${p.name}: τι γράφει η πηγή`, p.quote.includes(p.afm));
  ok(`${p.name}: γνωστό είδος`, KINDS.includes(p.kind));
}
for (const n of NOT_PROPERTY) {
  ok(`λίστα άρνησης ${n.name}: ΑΦΜ με σωστό ψηφίο`, isValidAfm(n.afm));
  ok(`λίστα άρνησης ${n.name}: πηγή`, /^https:\/\//.test(n.source) && n.quote.includes(n.afm));
}

for (const k of KINDS) {
  const c = KIND_CATEGORY[k];
  const cat = BY_SLUG[c.slug];
  ok(`${k}: η κατηγορία υπάρχει στην ταξινομία`, !!cat);
  ok(`${k}: ίδια ετικέτα με την ταξινομία`, cat?.label === c.label);
  ok(`${k}: ίδια ομάδα με τις ομάδες`, groupForCategory(cat) === c.group);
  ok(`${k}: εκπεστέα κατηγορία ακινήτου`, cat?.deductible === true);
}

// Οι κωδικοί χαρακτηρισμού είναι τιμές του ExpensesClassificationTypeClassificationType
// και ExpensesClassificationCategoryType του SimpleTypes-v2.0.2.xsd.
for (const k of KINDS) {
  const c = KIND_CATEGORY[k];
  if (c.e3) ok(`${k}: E3 στον κατάλογο του XSD`, AADE_EXPENSE_CODES.has(c.e3));
}

ok('αναζήτηση: γνωστό ΑΦΜ', providerByAfm(PROVIDERS[0].afm)?.afm === PROVIDERS[0].afm);
ok('αναζήτηση: κενά γύρω από το ΑΦΜ', providerByAfm(` ${PROVIDERS[0].afm} `)?.afm === PROVIDERS[0].afm);
ok('αναζήτηση: πρόθεμα EL', providerByAfm(`EL${PROVIDERS[0].afm}`)?.afm === PROVIDERS[0].afm);
ok('όνομα: γνωστός πάροχος αντί για ΑΦΜ', providerName(PROVIDERS[0].afm, null) === PROVIDERS[0].name);
ok('όνομα: η επωνυμία του εκδότη όταν δεν είναι στο μητρώο', providerName('099000049', 'Υδραυλικές Εργασίες') === 'Υδραυλικές Εργασίες');
ok('όνομα: τίποτα γνωστό: null', providerName('099000049', null) === null);

ok('όριο: 500€ σε λεπτά, όπως το άρθρο 23 ΚΦΕ', BANK_PAYMENT_LIMIT_CENTS === 500 * 100);
ok('όριο: η πηγή γράφει νόμο και ΠΟΛ', /4172\/2013/.test(BANK_PAYMENT_LIMIT_SOURCE.law) && /1216\/2014/.test(BANK_PAYMENT_LIMIT_SOURCE.circular));
ok('όριο: χωρίς ανθρώπινο checkedAt ακόμη', BANK_PAYMENT_LIMIT_SOURCE.checkedAt === null);
ok('συντελεστής ασυνήθιστου ποσού: 2', UNUSUAL_FACTOR === 2);

console.log(`mydata providers: ${pass} ✓ · ${fail} ✗`);
if (fail) process.exit(1);
