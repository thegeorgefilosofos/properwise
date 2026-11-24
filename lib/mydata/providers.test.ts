// npx tsx lib/mydata/providers.test.ts
//
// ΤΟ ΜΗΤΡΩΟ ΠΑΡΟΧΩΝ: ΚΑΘΕ ΕΓΓΡΑΦΗ ΜΕ ΠΗΓΗ, ΚΑΘΕ ΑΦΜ ΜΕ ΣΩΣΤΟ ΨΗΦΙΟ ΕΛΕΓΧΟΥ.
//
// Το μητρώο αποφασίζει τι καταχωρείται χωρίς πάτημα. Ενα λάθος ΑΦΜ εδώ θα
// έβαζε ξένα παραστατικά ως δαπάνες ακινήτου· γι' αυτό ελέγχονται όλες οι
// εγγραφές, όχι δείγμα. Η κατηγορία κάθε είδους πρέπει να είναι ΑΚΡΙΒΩΣ αυτή
// της ταξινομίας (ετικέτα και ομάδα), αφού η βάση τη γράφει χωρίς την εφαρμογή.
import { PROVIDERS, NOT_PROPERTY, KIND_CATEGORY, KINDS, providerByAfm, providerName, providerKind, kadNotProperty, NOT_PROPERTY_KAD, type Provider } from './providers';

// Οι τιμές E3_585_001 έως 016 του ExpensesClassificationTypeClassificationType στο
// SimpleTypes-v2.0.2.xsd της ΑΑΔΕ, όπως τις απαριθμεί το σχήμα.
const AADE_EXPENSE_CODES: ReadonlySet<string> = new Set(Array.from({ length: 16 }, (_, i) => `E3_585_${String(i + 1).padStart(3, '0')}`));
import { BY_SLUG } from '../expenses/taxonomy';
import { groupForCategory } from '../expenses/groups';
import { isValidAfm } from '../core/greek';
import { BANK_PAYMENT_LIMIT_CENTS, UNUSUAL_FACTOR } from './limits';

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
  ok(`${p.name}: γνωστά είδη`, Array.isArray(p.kinds) && p.kinds.every(k => KINDS.includes(k)));
  // Πάροχοι 24/11/2026: κανένας δεν έχει ελεγχθεί από άνθρωπο ακόμη.
  ok(`${p.name}: checkedAt null ως τον έλεγχο του ιδιοκτήτη`, p.checkedAt === null);
  for (const f of p.formerAfm ?? []) {
    ok(`${p.name} πρώην ${f.name}: ΑΦΜ με σωστό ψηφίο ελέγχου`, isValidAfm(f.afm));
    ok(`${p.name} πρώην ${f.name}: μοναδικό ΑΦΜ μαζί με τα τρέχοντα`, !afms.has(f.afm));
    afms.add(f.afm);
    ok(`${p.name} πρώην ${f.name}: πηγή και απόσπασμα`, /^https:\/\//.test(f.source) && f.quote.includes(f.afm));
    ok(`${p.name} πρώην ${f.name}: αναγνωρίζεται ως ο ίδιος πάροχος`, providerByAfm(f.afm)?.afm === p.afm);
    ok(`${p.name} πρώην ${f.name}: δείχνει την παλιά επωνυμία`, providerName(f.afm, null) === f.name);
    ok(`${p.name} πρώην ${f.name}: ημερομηνία ISO ή κενή`, f.until === null || /^\d{4}-\d{2}-\d{2}$/.test(f.until));
  }
}
// Οι πάροχοι του ιδιοκτήτη (24/11/2026, έρευνα v2). Ποτέ το 094014201 (HELLENiQ/ΕΚΟ καύσιμα).
const has = (afm: string) => providerByAfm(afm) !== null;
for (const a of ['999717970', '997998048', '998102480', '997104531', '800750372', '099936189', '800599796']) ok(`νέος πάροχος ${a} στο μητρώο`, has(a));
for (const a of ['094493766', '998283692', '998808439']) ok(`παλιό ΑΦΜ ${a} αναγνωρίζεται`, has(a));
ok('ποτέ το 094014201', !has('094014201'));
ok('όχι Elinoil (καύσιμα με το ίδιο ΑΦΜ)', !has('094004190'));
ok('όχι Eunice (χαμηλή βεβαιότητα)', !has('800481500'));
ok('ΕΥΑΘ χωρίς ΑΦΜ (μία πηγή)', !PROVIDERS.some(p => /ΕΥΑΘ/.test(p.name)));
const ote = providerByAfm('094019245');
ok('ΟΤΕ: πηγή από τον ίδιο τον πάροχο, όχι από τρίτο', !!ote && /telekom\.gr|cosmote\.gr|ote\.gr/.test(ote.source) && !/frogmobile/.test(ote.source));
ok('Ήρων: γενικοί όροι του heron.gr', /heron\.gr/.test(providerByAfm('099810593')?.source ?? '') && /γενικοι-οροι/.test(decodeURI(providerByAfm('099810593')?.source ?? '')));
ok('Enerwave: η πρώην Elpedison', /Elpedison/i.test(providerByAfm('999717970')?.name ?? ''));
// Το είδος: ένα και μόνο από το μητρώο, αλλιώς κανένα. Η αυτόματη καταχώρηση δεν μαντεύει.
const fake = (kinds: Provider['kinds']): Provider => ({ afm: '090000045', name: 'x', kinds, source: 'https://x', quote: '090000045', checkedAt: null });
ok('είδος: ένα δηλωμένο', providerKind(fake(['water'])) === 'water');
ok('είδος: κανένα δηλωμένο: κανένα', providerKind(fake([])) === null);
ok('είδος: ρεύμα και αέριο: κανένα (δεν μαντεύουμε)', providerKind(fake(['electricity', 'gas'])) === null);
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
ok('συντελεστής ασυνήθιστου ποσού: 2', UNUSUAL_FACTOR === 2);

// ── ΘΩΡΑΚΙΣΗ 24/11/2026: ΚΑΔ ΠΟΥ ΔΕΝ ΑΦΟΡΟΥΝ ΑΚΙΝΗΤΟ (ΥΓΕΙΑ, ΠΡΟΣΩΠΙΚΗ ΚΑΤΑΝΑΛΩΣΗ) ──
// Πηγή των κωδικών: NACE Rev. 2 (Eurostat) / ΣΤΑΚΟΔ-08 (ΕΛΣΤΑΤ). Μετρά το πρόθεμα
// των ψηφίων: 86.21.10.00 είναι «86», το 47.79 ΔΕΝ είναι 47.73.
{
  ok('ΚΑΔ: ιατρείο (86.21) είναι υγεία', kadNotProperty('86.21.10.00')?.group === 'health');
  ok('ΚΑΔ: φαρμακείο (47.73) είναι υγεία', kadNotProperty('47.73.10.01')?.group === 'health');
  ok('ΚΑΔ: σούπερ μάρκετ (47.11) είναι προσωπική κατανάλωση', kadNotProperty('47.11.10.00')?.group === 'personal');
  ok('ΚΑΔ: υδραυλικές εργασίες (43.22) αφορούν ακίνητο', kadNotProperty('43.22.11.01') === null);
  ok('ΚΑΔ: 47.79 δεν πιάνεται από το 47.7x της υγείας', kadNotProperty('47.79.10.00') === null);
  ok('ΚΑΔ: κενό ή σκουπίδια: τίποτα', kadNotProperty('') === null && kadNotProperty('abc') === null);
  ok('ΚΑΔ: κάθε γραμμή έχει πηγή και περιγραφή', NOT_PROPERTY_KAD.every(k => /^\d{2,4}$/.test(k.prefix) && k.label.length > 3 && k.source.length > 10));
}

console.log(`mydata providers: ${pass} ✓ · ${fail} ✗`);
if (fail) process.exit(1);
