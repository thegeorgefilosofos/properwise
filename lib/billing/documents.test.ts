// Τεστ για την καθολική δρομολόγηση εγγράφων (lib/billing/documents.ts).
// Τρέξε με: npx tsx lib/billing/documents.test.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { navLabel } from '../nav/labels';
import {
  classifyDocType, classifySubtype, validateDoc, planDocSave, docSummaryLine,
  DOC_TYPES, DOC_TYPE_LABELS, DOC_FIELD_LABELS, ARCHIVE_CATEGORIES,
  archiveCategoryFor, resolveBillCategory, normalizeScannedDoc, isDocumentary,
  DOC_KINDS, KIND_OPTIONS, kindOf, applyKind, docForm, docTargets, fieldOptions, fieldValue, withField,
  selectLine, withPropertyLine, archiveOptions, folderForDoc, FOLDERS, BILL_CATEGORIES,
  SCAN_NUM_KEYS, SCAN_MAX_LINES, PROPERTY_TARGET, compactRow, shelfPath, lineUnset, LINE_NONE,
  commonMonthOf, PEA_EXPIRY_TITLE,
  type ScannedDoc, type DocType, type DocKindId, type DocField,
} from './documents';
import { SYSTEM_PROMPT, SCAN_KEYS } from './scanPrompt';
import { SCAN_SHAPE } from '../assistant/scanShape';
import { EXPENSE_MAP, matchPaymentToBills } from './parse';

let passed = 0, failed = 0;
const fails: string[] = [];
function check(name: string, cond: boolean) {
  if (cond) { passed++; } else { failed++; fails.push(name); }
}
function eq<T>(name: string, a: T, b: T) {
  check(`${name} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`, JSON.stringify(a) === JSON.stringify(b));
}

const TODAY = '2026-07-06';
const doc = (o: Partial<ScannedDoc>): ScannedDoc =>
  ({ doc_type: 'other', confidence: 90, ...o });

// ── classifyDocType ──────────────────────────────────────────────────────────
eq('classify: bill by category+amount', classifyDocType(doc({ doc_type: 'other', category: 'electricity', amount: 42 })), 'bill');
eq('classify: lease by monthly_rent field', classifyDocType(doc({ doc_type: 'other', monthly_rent: 600 })), 'lease');
eq('classify: lease by keyword', classifyDocType(doc({ doc_type: 'other', title: 'Ιδιωτικό Συμφωνητικό Μίσθωσης Κατοικίας' })), 'lease');
eq('classify: insurance by keyword', classifyDocType(doc({ doc_type: 'bill', title: 'Ασφαλιστήριο Συμβόλαιο Interamerican' })), 'insurance');
eq('classify: insurance by policy_number', classifyDocType(doc({ doc_type: 'other', policy_number: 'POL-123' })), 'insurance');
eq('classify: tax by ΕΝΦΙΑ keyword', classifyDocType(doc({ doc_type: 'other', title: 'Εκκαθαριστικό ΕΝΦΙΑ 2026' })), 'tax');
eq('classify: deed by keyword', classifyDocType(doc({ doc_type: 'other', title: 'Συμβόλαιο Αγοραπωλησίας Ακινήτου' })), 'deed');
eq('classify: deed by purchase_price', classifyDocType(doc({ doc_type: 'other', purchase_price: 180000 })), 'deed');
// Ο ΑΤΑΚ ΔΕΝ ΚΑΝΕΙ ΤΙΤΛΟ: τον γράφουν και ο ΕΝΦΙΑ και το Ε9.
eq('classify: ο ΑΤΑΚ μόνος του δεν είναι τίτλος', classifyDocType(doc({ doc_type: 'other', atak: '12345678901' })), 'other');
eq('classify: government by keyword', classifyDocType(doc({ doc_type: 'other', title: 'Βεβαίωση Πολεοδομίας' })), 'government');
eq('classify: payment by keyword', classifyDocType(doc({ doc_type: 'other', title: 'Απόδειξη Πληρωμής', amount: 50 })), 'payment');
eq('classify: respect valid AI type when no keywords', classifyDocType(doc({ doc_type: 'bill' })), 'bill');
eq('classify: fallback other', classifyDocType(doc({ doc_type: 'other', title: 'κάτι ασαφές' })), 'other');
// Προτεραιότητα: ο έγκυρος και συγκεκριμένος τύπος του μοντέλου κερδίζει τα
// πεδία. Τα ισχυρά πεδία μετρούν μόνο όταν το μοντέλο είπε «other».
eq('classify: ο τύπος του μοντέλου κερδίζει το monthly_rent', classifyDocType(doc({ doc_type: 'bill', monthly_rent: 500 })), 'bill');

// ── validateDoc ──────────────────────────────────────────────────────────────
eq('validate bill: amount blocking', validateDoc(doc({ doc_type: 'bill' })).blocking, ['amount']);
eq('validate bill: complete', validateDoc(doc({ doc_type: 'bill', amount: 40, provider: 'ΔΕΗ', due_date: '2026-08-01' })).blocking, []);
eq('validate lease: name+rent blocking', validateDoc(doc({ doc_type: 'lease' })).blocking, ['tenant_name', 'monthly_rent']);
eq('validate lease: complete blocking empty', validateDoc(doc({ doc_type: 'lease', tenant_name: 'Α', monthly_rent: 600 })).blocking, []);
eq('validate insurance: provider blocking', validateDoc(doc({ doc_type: 'insurance' })).blocking, ['provider']);
eq('validate deed: no blocking', validateDoc(doc({ doc_type: 'deed' })).blocking, []);
eq('validate government: no blocking', validateDoc(doc({ doc_type: 'government' })).blocking, []);
eq('validate payment: amount blocking', validateDoc(doc({ doc_type: 'payment' })).blocking, ['amount']);

// ── planDocSave: bill ────────────────────────────────────────────────────────
{
  const p = planDocSave(doc({ doc_type: 'bill', category: 'electricity', provider: 'ΔΕΗ', amount: 88.5, due_date: '2026-08-10', period: 'Ιούν 2026', kwh: 320 }), TODAY);
  check('bill: has bill payload', !!p.bill);
  eq('bill: bill.category', p.bill!.category, 'electricity');
  eq('bill: bill.paid false', p.bill!.paid, false);
  eq('bill: bill.amount', p.bill!.amount, 88.5);
  check('bill: has expense', !!p.expense);
  eq('bill: expense.category label', p.expense!.category, 'Ρεύμα');
  eq('bill: expense.group', p.expense!.expense_group, 'fixed');
  check('bill: has calendar (due_date present)', Array.isArray(p.calendar) && p.calendar.length === 1);
  eq('bill: calendar event_date', p.calendar![0].event_date, '2026-08-10');
  check('bill: targets include Ημερολόγιο', p.targets.includes('Ημερολόγιο'));
  check('bill: archived', !!p.archive);
  eq('bill: not reconcile', !!p.reconcile, false);
}
// bill without due_date → no calendar
{
  const p = planDocSave(doc({ doc_type: 'bill', category: 'water', provider: 'ΕΥΔΑΠ', amount: 30 }), TODAY);
  eq('bill no due: no calendar', p.calendar, undefined);
  check('bill no due: expense.date falls back to today', p.expense!.date === TODAY);
  check('bill no due: targets exclude Ημερολόγιο', !p.targets.includes('Ημερολόγιο'));
}
// common bill → κοινόχρηστα signals
{
  const p = planDocSave(doc({ doc_type: 'bill', category: 'common', provider: 'Διαχείριση', amount: 45, millesimi: 12, issue_date: '2026-07-02' }), TODAY);
  eq('common: commonMonthAmount', p.commonMonthAmount, 45);
  eq('common: commonMillesimi', p.commonMillesimi, 12);
  check('common: targets include Κοινόχρηστα', p.targets.includes('Κοινόχρηστα'));
}
// ── Ο ΜΗΝΑΣ ΤΩΝ ΚΟΙΝΟΧΡΗΣΤΩΝ ΕΙΝΑΙ ΤΟΥ ΧΑΡΤΙΟΥ (έλεγχος 18/10/2026, APP-6) ──
{
  const sep = planDocSave(doc({ doc_type: 'bill', category: 'common', provider: 'Διαχείριση', amount: 120, issue_date: '2026-10-05', period_from: '2026-09-01', period_to: '2026-09-30' }), '2026-10-18');
  eq('κοινόχρηστα Σεπτεμβρίου που σαρώνονται τον Οκτώβριο: θέση 8', sep.commonMonthIndex, 8);
  const byIssue = planDocSave(doc({ doc_type: 'bill', category: 'common', provider: 'Διαχείριση', amount: 120, issue_date: '2026-03-04' }), '2026-10-18');
  eq('χωρίς περίοδο: ο μήνας της έκδοσης', byIssue.commonMonthIndex, 2);
  const lastYear = planDocSave(doc({ doc_type: 'bill', category: 'common', provider: 'Διαχείριση', amount: 140, period_from: '2025-12-01', period_to: '2025-12-31' }), '2026-01-10');
  check('Δεκέμβριος που σαρώνεται τον Ιανουάριο: όχι στο Ιστορικό του νέου έτους', lastYear.commonMonthAmount === undefined && lastYear.commonMonthIndex === undefined);
  check('και η φόρμα δεν υπόσχεται Κοινόχρηστα', !lastYear.targets.includes('Κοινόχρηστα'));
  const noDate = planDocSave(doc({ doc_type: 'bill', category: 'common', provider: 'Διαχείριση', amount: 120 }), '2026-10-18');
  check('χωρίς ημερομηνία δεν μαντεύουμε μήνα', noDate.commonMonthIndex === undefined && noDate.commonMonthAmount === undefined);
  eq('commonMonthOf: πρώτη έγκυρη ημερομηνία', commonMonthOf(['', '2026-05-31'], '2026-10-18'), 4);
  eq('commonMonthOf: άλλο έτος', commonMonthOf(['2025-05-31'], '2026-10-18'), null);
}
// ── ΤΟ ΠΑΛΑΙΟΤΕΡΟ ΠΕΑ ΔΕΝ ΓΥΡΙΖΕΙ ΠΙΣΩ ΤΗΝ ΚΑΤΗΓΟΡΙΑ (PR #402) ─────────────
{
  const pea = planDocSave(doc({ doc_type: 'government', subtype: 'pea', pea_class: 'Δ', expiry_date: '2030-01-01' }), '2026-10-18');
  eq('ΠΕΑ σε ισχύ: φρουρός από το γεγονός λήξης', JSON.stringify(pea.replaceIfNewerEvent), JSON.stringify({ title: PEA_EXPIRY_TITLE, value: '2030-01-01' }));
  eq('ΠΕΑ: το γεγονός λήξης έχει τον ίδιο τίτλο με τον φρουρό', pea.calendar?.[0]?.title, PEA_EXPIRY_TITLE);
  const expired = planDocSave(doc({ doc_type: 'government', subtype: 'pea', pea_class: 'Δ', expiry_date: '2020-01-01' }), '2026-10-18');
  check('ληγμένο ΠΕΑ: μόνο συμπλήρωση, χωρίς φρουρό', !expired.propertyReplace && !expired.replaceIfNewerEvent && !!expired.property);
}
// unknown category coerced to 'other'
{
  const p = planDocSave(doc({ doc_type: 'bill', category: 'nonsense' as string, provider: 'X', amount: 10 }), TODAY);
  eq('bill unknown cat → other', p.bill!.category, 'other');
  eq('bill unknown cat → expense label Άλλο', p.expense!.category, 'Άλλο');
}

// ── planDocSave: payment (paid + reconcile) ──────────────────────────────────
{
  const p = planDocSave(doc({ doc_type: 'payment', category: 'electricity', provider: 'ΔΕΗ', amount: 88.5, issue_date: '2026-07-01' }), TODAY);
  eq('payment: bill.paid true', p.bill!.paid, true);
  eq('payment: expense.paid true', p.expense!.paid, true);
  eq('payment: reconcile true', p.reconcile, true);
  check('payment: no calendar reminder', p.calendar === undefined);
  eq('payment: expense.date uses issue_date', p.expense!.date, '2026-07-01');
}

// ── planDocSave: lease → tenant ──────────────────────────────────────────────
{
  const p = planDocSave(doc({ doc_type: 'lease', tenant_name: 'Γ. Παπαδόπουλος', monthly_rent: 650, lease_start: '2026-09-01', lease_end: '2029-08-31', deposit: 1300, afm: '090000045' }), TODAY);
  check('lease: has tenant', !!p.tenant);
  eq('lease: tenant.full_name', p.tenant!.full_name, 'Γ. Παπαδόπουλος');
  eq('lease: tenant.monthly_rent', p.tenant!.monthly_rent, 650);
  eq('lease: tenant.lease_end', p.tenant!.lease_end, '2029-08-31');
  eq('lease: tenant.deposit_amount', p.tenant!.deposit_amount, 1300);
  // Έγκυρο ΑΦΜ (checksum της ΑΑΔΕ)· το άκυρο δεν γράφεται, βλ. παρακάτω.
  eq('lease: tenant.afm', p.tenant!.afm, '090000045');
  eq('lease: archived as Μισθωτήριο', p.archive!.category, 'Μισθωτήριο / Συμβόλαιο');
  check('lease: no bill/expense', !p.bill && !p.expense);
}

// ── planDocSave: insurance → settings + expense + calendar ────────────────────
{
  const p = planDocSave(doc({ doc_type: 'insurance', provider: 'Interamerican', premium: 240, expiry_date: '2027-03-15', policy_number: 'POL-9' }), TODAY);
  check('insurance: has settings', !!p.settings);
  eq('insurance: settings.company', p.settings!.insurance_company, 'Interamerican');
  eq('insurance: settings.policy', p.settings!.insurance_policy, 'POL-9');
  eq('insurance: settings.expiry', p.settings!.insurance_expiry, '2027-03-15');
  check('insurance: ΚΑΜΙΑ συμπλήρωση κενών στο ακίνητο', p.property === undefined);
  check('insurance: premium → expense', !!p.expense);
  eq('insurance: expense label', p.expense!.category, 'Ασφάλεια Κτιρίου');
  check('insurance: expiry → calendar', Array.isArray(p.calendar) && p.calendar.length === 1);
  eq('insurance: calendar high priority', p.calendar![0].priority, 'high');
  check('insurance: targets', p.targets.includes(PROPERTY_TARGET) && p.targets.includes('Ημερολόγιο') && p.targets.includes('Δαπάνες') && p.targets.includes(navLabel('documents')));
  check('insurance: κανένα «Αρχείο» που δεν υπάρχει στο μενού', !p.targets.includes('Αρχείο'));
  // Και στο ίδιο το ακίνητο, που διαβάζουν οι προθεσμίες και η Νόα· ΟΧΙ το μηνιαίο insurance_amount.
  eq('insurance: εταιρεία και λήξη στο ακίνητο', p.propertyReplace, { insurance_company: 'Interamerican', insurance_expiry: '2027-03-15' });
}
// insurance without premium/expiry → settings (μόνο τα κενά: χωρίς λήξη δεν ξέρουμε αν είναι το τρέχον) + archive only
{
  const p = planDocSave(doc({ doc_type: 'insurance', provider: 'ΕΘΝΙΚΗ' }), TODAY);
  check('insurance minimal: settings only', !!p.settingsFill && !p.settings && !p.expense && !p.calendar);
}

// insurance coverage must NOT be lost (review fix)
{
  const p = planDocSave(doc({ doc_type: 'insurance', provider: 'ERGO', premium: 300, coverage: 150000, expiry_date: '2027-01-01' }), TODAY);
  check('insurance: coverage in expense notes', String(p.expense!.notes).includes('150.000'));
  check('insurance: coverage in archive note', !!p.archive!.note && p.archive!.note.includes('150.000'));
  eq('insurance: archive date = expiry', p.archive!.date, '2027-01-01');
}

// ── planDocSave: deed → στήλες ακινήτου, ΟΧΙ σημείωση ────────────────────────
// Ο ΑΤΑΚ είναι το μοναδικό κλειδί ταύτισης με το έντυπο Ε2. Όσο έμενε σε
// ελεύθερο κείμενο, η καρτέλα συμφωνίας τον ζητούσε ενώ η σάρωση τον είχε ήδη
// διαβάσει. Οι στήλες υπάρχουν — ρωτήθηκε η βάση, δεν υποτέθηκε.
{
  const p = planDocSave(doc({ doc_type: 'deed', provider: 'Συμβ. Παπαδοπούλου', purchase_price: 180000, year_built: 2004, sqm: 78, atak: '11122233344', obj_value: 95000, purchase_date: '2019-05-20' }), TODAY);
  check('deed: property has safe cols', !!p.property);
  eq('deed: property.purchase_price', p.property!.purchase_price, 180000);
  eq('deed: property.year_built', p.property!.year_built, 2004);
  eq('deed: property.sqm', p.property!.sqm, 78);
  eq('deed: ο ΑΤΑΚ γράφεται στη στήλη του', p.property!.atak, '11122233344');
  eq('deed: η αντικειμενική στη στήλη της', p.property!.obj_value, 95000);
  eq('deed: η ημερομηνία αγοράς στη στήλη της', p.property!.purchase_date, '2019-05-20');
  check('deed: ΔΕΝ επαναλαμβάνονται στη σημείωση', !(p.archive!.note || '').includes('ΑΤΑΚ') && !(p.archive!.note || '').includes('Αντικειμενική'));
  check('deed: ο συμβολαιογράφος (χωρίς στήλη) μένει στη σημείωση', (p.archive!.note || '').includes('Παπαδοπούλου'));
  eq('deed: archive date = purchase_date', p.archive!.date, '2019-05-20');
  check('deed: targets include Στοιχεία ακινήτου', p.targets.includes('Στοιχεία ακινήτου'));
}
// Ο ΑΤΑΚ με κενά γύρω του δεν γράφεται ημιτελής, ούτε δημιουργεί άδεια εγγραφή.
{
  const p = planDocSave(doc({ doc_type: 'deed', atak: '  11122233344  ' }), TODAY);
  eq('deed: ο ΑΤΑΚ καθαρίζεται', p.property!.atak, '11122233344');
}
{
  const p = planDocSave(doc({ doc_type: 'deed', atak: '   ' }), TODAY);
  check('deed: κενός ΑΤΑΚ δεν γράφει τίποτα', p.property === undefined);
}
// ΜΙΣΟΔΙΑΒΑΣΜΕΝΟΣ ΑΤΑΚ ΔΕΝ ΓΡΑΦΕΤΑΙ. Γραφόταν ό,τι δεν ήταν κενό: ένας ΑΤΑΚ
// που η σάρωση διάβασε μισό περνούσε στη στήλη και μετά η καρτέλα Ε2 δεν
// ταίριαζε καμία γραμμή — χωρίς να φαίνεται γιατί, αφού «ΑΤΑΚ υπάρχει».
{
  const p = planDocSave(doc({ doc_type: 'deed', atak: '111222' }), TODAY);
  check('deed: μισός ΑΤΑΚ δεν γράφεται', p.property?.atak === undefined);
}
// ΤΟ Ε9 ΕΙΝΑΙ ΤΟ ΕΓΓΡΑΦΟ ΤΟΥ ΑΤΑΚ ΚΑΙ ΚΑΤΑΤΑΣΣΕΤΑΙ ΣΤΑ ΦΟΡΟΛΟΓΙΚΑ.
// Το έγγραφο περνά από την εξομάλυνση, όπως στην καταχώρηση: ο τίτλος «Ε9»
// δίνει τον υποτύπο.
{
  const p = planDocSave(normalizeScannedDoc(doc({ doc_type: 'tax', title: 'Ε9', atak: '  111-222-333 44 ' })), TODAY);
  eq('tax: ο ΑΤΑΚ του Ε9 γράφεται στη στήλη του', p.property!.atak, '11122233344');
  check('tax: targets include Στοιχεία ακινήτου', p.targets.includes('Στοιχεία ακινήτου'));
}
{
  const p = planDocSave(normalizeScannedDoc(doc({ doc_type: 'tax', title: 'ΕΝΦΙΑ', amount: 320 })), TODAY);
  check('tax χωρίς ΑΤΑΚ: καμία εγγραφή στο ακίνητο', p.property === undefined);
}
// Ο κανόνας «συμπληρώνουμε κενά» ελέγχεται στο lib/core/prefill.test.ts.
// deed with no structured fields → archive only
{
  const p = planDocSave(doc({ doc_type: 'deed', title: 'Τίτλος' }), TODAY);
  check('deed empty: no property write', p.property === undefined);
  check('deed empty: targets = φάκελος μόνο', p.targets.length === 1 && p.targets[0] === navLabel('documents'));
}

// ── planDocSave: άλλο φορολογικό → υπενθύμιση, ΟΧΙ δαπάνη «ΕΝΦΙΑ» ─────────────
// Κάθε φορολογικό γινόταν δαπάνη «ΕΝΦΙΑ»: η βεβαίωση οφειλής του δήμου και ο
// φόρος εισοδήματος φόρτωναν το ακίνητο με φόρο που δεν είναι δικός του.
{
  const p = planDocSave(doc({ doc_type: 'tax', provider: 'ΑΑΔΕ', amount: 520, due_date: '2026-10-31', tax_year: 2026 }), TODAY);
  check('tax: NO property write', p.property === undefined);
  check('tax: ΚΑΜΙΑ δαπάνη', p.expense === undefined);
  check('tax: has calendar', Array.isArray(p.calendar) && p.calendar.length === 1);
  eq('tax: η υπενθύμιση κρατά το ποσό', p.calendar![0].amount, 520);
  eq('tax: κατηγορία φόρου', p.calendar![0].category, 'tax');
  check('tax: targets Ημερολόγιο, όχι Δαπάνες', p.targets.includes('Ημερολόγιο') && !p.targets.includes('Δαπάνες'));
  eq('tax: το ποσό μένει στο έγγραφο', p.archive!.amount, 520);
}

// ── planDocSave: government/other → archive only ─────────────────────────────
{
  const g = planDocSave(doc({ doc_type: 'government', title: 'ΑΜΑ' }), TODAY);
  eq('gov: targets φάκελος μόνο', g.targets, [navLabel('documents')]);
  check('gov: only archive', !g.bill && !g.expense && !g.tenant && !g.property && !g.settings && !!g.archive);
  const o = planDocSave(doc({ doc_type: 'other', title: 'κάτι' }), TODAY);
  eq('other: targets φάκελος μόνο', o.targets, [navLabel('documents')]);
}

// ── custom fields flow into notes ────────────────────────────────────────────
{
  const p = planDocSave(doc({ doc_type: 'bill', category: 'electricity', provider: 'ΔΕΗ', amount: 40, custom: [{ label: 'Ρολόι', value: 'νυχτερινό' }] }), TODAY);
  check('custom: note appears in expense', String(p.expense!.notes).includes('Ρολόι: νυχτερινό'));
}

// ── metadata sanity ──────────────────────────────────────────────────────────
check('DOC_TYPES has 8 entries', DOC_TYPES.length === 8);
check('every DocType has a label', DOC_TYPES.every(t => !!DOC_TYPE_LABELS[t.id]));
// ΤΑ ΠΟΣΑ ΤΗΣ ΣΥΝΟΨΗΣ ΓΡΑΦΟΝΤΑΙ ΟΠΩΣ ΠΑΝΤΟΥ ΑΛΛΟΥ: δύο δεκαδικά και αχώριστο
// κενό πριν από το ευρώ. Εδώ έβγαινε «88,5€» και «600€/μήνα» από απευθείας
// κλήση `toLocaleString`, δηλαδή τρίτη μορφή ευρώ δίπλα στις άλλες δύο της ίδιας
// οθόνης. Ο κοινός τύπος `fe` είναι ο μόνος που γράφει ποσό.
eq('η σύνοψη προτιμά πάροχο και ποσό', docSummaryLine(doc({ doc_type: 'bill', provider: 'ΔΕΗ', amount: 88.5 })), 'ΔΕΗ — 88,50€');
eq('η σύνοψη μίσθωσης γράφει το μίσθωμα', docSummaryLine(doc({ doc_type: 'lease', tenant_name: 'Α', monthly_rent: 600 })), 'Α — 600,00€/μήνα');

// Κάλυψη: κάθε τύπος εγγράφου κατατάσσεται στον εαυτό του όταν το σήμα είναι ισχυρό (κύκλος)
const strong: Record<DocType, Partial<ScannedDoc>> = {
  bill: { category: 'electricity', amount: 10 },
  payment: { title: 'Απόδειξη Πληρωμής', amount: 10 },
  lease: { monthly_rent: 500 },
  deed: { purchase_price: 1 },
  insurance: { policy_number: 'x' },
  tax: { title: 'ΕΝΦΙΑ' },
  government: { title: 'Πολεοδομία' },
  other: { title: 'ασαφές' },
};
(Object.keys(strong) as DocType[]).forEach(t => {
  eq(`round-trip ${t}`, classifyDocType(doc({ doc_type: 'other', ...strong[t] })), t);
});

// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΠΕΝΤΕ ΠΕΔΙΑ ΣΤΟ ΠΑΡΑΣΤΑΤΙΚΟ + ΕΝΑ ΣΗΜΕΙΟ ΓΙΑ ΤΟΝ ΦΑΚΕΛΟ
// ═══════════════════════════════════════════════════════════════════════════

// ── Ένα σημείο αλήθειας για τον φάκελο του Αρχείου ─────────────────────────
eq('φάκελος: λογαριασμός ρεύματος', archiveCategoryFor(doc({ doc_type: 'bill', category: 'electricity' })), 'Λογαριασμός Ρεύματος');
eq('φάκελος: απόδειξη ρεύματος (ίδιο ράφι)', archiveCategoryFor(doc({ doc_type: 'payment', category: 'electricity' })), 'Λογαριασμός Ρεύματος');
eq('φάκελος: νερό από ΟΝΟΜΑ παρόχου χωρίς κατηγορία', archiveCategoryFor(doc({ doc_type: 'bill', provider: 'ΕΥΔΑΠ' })), 'Λογαριασμός Νερού');
eq('φάκελος: ρεύμα από ΟΝΟΜΑ παρόχου (ΔΕΗ)', archiveCategoryFor(doc({ doc_type: 'bill', provider: 'ΔΕΗ Α.Ε.' })), 'Λογαριασμός Ρεύματος');
eq('φάκελος: αέριο', archiveCategoryFor(doc({ doc_type: 'bill', category: 'gas' })), 'Λογαριασμός Φυσικού Αερίου');
eq('φάκελος: άγνωστος πάροχος → Άλλο Έγγραφο', archiveCategoryFor(doc({ doc_type: 'bill', provider: 'Κάτι Άγνωστο' })), 'Άλλο Έγγραφο');
eq('φάκελος: μισθωτήριο', archiveCategoryFor(doc({ doc_type: 'lease' })), 'Μισθωτήριο / Συμβόλαιο');
// Κάθε ράφι που δίνει η συνάρτηση ΠΡΕΠΕΙ να υπάρχει στην ταξινομία του Αρχείου.
(['bill', 'payment', 'lease', 'deed', 'insurance', 'tax', 'government', 'other'] as DocType[]).forEach(t => {
  check(`ταξινομία: το ράφι του ${t} υπάρχει`, (ARCHIVE_CATEGORIES as readonly string[]).includes(archiveCategoryFor(doc({ doc_type: t }))));
});
['electricity', 'water', 'gas', 'internet', 'common', 'insurance', 'taxes', 'municipal', 'security', 'elevator', 'pool', 'cleaner'].forEach(c => {
  check(`ταξινομία: το ράφι της κατηγορίας ${c} υπάρχει`, (ARCHIVE_CATEGORIES as readonly string[]).includes(archiveCategoryFor(doc({ doc_type: 'bill', category: c }))));
});
// Η διόρθωση ζει ΜΕΣΑ στο σχέδιο: planDocSave και archiveCategoryFor δεν αποκλίνουν.
{
  const d = doc({ doc_type: 'bill', category: 'water', provider: 'ΕΥΔΑΠ', amount: 42 });
  eq('planDocSave.archive.category === archiveCategoryFor', planDocSave(d, TODAY).archive!.category, archiveCategoryFor(d));
}

// ── resolveBillCategory ────────────────────────────────────────────────────
eq('κατηγορία: έγκυρη από OCR', resolveBillCategory({ category: 'gas' }), 'gas');
eq('κατηγορία: από πάροχο όταν λείπει', resolveBillCategory({ provider: 'COSMOTE' }), 'internet');
eq('κατηγορία: «other» + πάροχος ΔΕΗ → electricity', resolveBillCategory({ category: 'other', provider: 'ΔΕΗ' }), 'electricity');
eq('κατηγορία: τίποτα → other', resolveBillCategory({}), 'other');

// ── validateDoc: ΑΦΜ & περίοδος είναι recommended, ΟΧΙ blocking ─────────────
{
  const v = validateDoc(doc({ doc_type: 'bill', amount: 88.5, provider: 'ΔΕΗ', due_date: '2026-07-20' }));
  eq('θολό χαρτί: το ΑΦΜ δεν μπλοκάρει', v.blocking, []);
  check('ζητάμε ΑΦΜ', v.recommended.includes('provider_afm'));
  check('ζητάμε περίοδο', v.recommended.includes('period_from'));
  eq('τίποτα άκυρο', v.invalid, []);
}
{
  const v = validateDoc(doc({
    doc_type: 'bill', amount: 88.5, provider: 'ΔΕΗ', due_date: '2026-07-20',
    provider_afm: '090000045', period_from: '2026-06-01', period_to: '2026-06-30',
  }));
  eq('πλήρες: τίποτα σε recommended', v.recommended, []);
  eq('πλήρες: τίποτα σε invalid', v.invalid, []);
}
// Άκυρο checksum: το λέμε, δεν το περνάμε για σωστό — και ΔΕΝ μπλοκάρουμε.
{
  const v = validateDoc(doc({ doc_type: 'bill', amount: 10, provider_afm: '090000046' }));
  check('άκυρο ΑΦΜ → invalid', v.invalid.includes('provider_afm'));
  check('άκυρο ΑΦΜ δεν μπλοκάρει την αποθήκευση', !v.blocking.includes('provider_afm'));
}
{
  const v = validateDoc(doc({ doc_type: 'bill', amount: 10, period_from: '2026-07-01', period_to: '2026-06-01' }));
  check('ανάποδη περίοδος → invalid', v.invalid.includes('period_from'));
}
{
  const v = validateDoc(doc({ doc_type: 'lease', tenant_name: 'Α', monthly_rent: 600, afm: '111111111' }));
  check('άκυρο ΑΦΜ ενοικιαστή → invalid', v.invalid.includes('afm'));
}
check('κάθε νέο πεδίο έχει ελληνική ετικέτα', ['provider_afm', 'period_from', 'period_to', 'issue_date'].every(k => !!DOC_FIELD_LABELS[k]));

// ── normalizeScannedDoc: μεταφράζει, δεν μαντεύει ──────────────────────────
{
  const n = normalizeScannedDoc(doc({ doc_type: 'bill', period: 'Ιούνιος 2026', provider_afm: '090 000 045' }));
  eq('normalize: ΑΦΜ μόνο ψηφία', n.provider_afm, '090000045');
  eq('normalize: περίοδος από κείμενο (από)', n.period_from, '2026-06-01');
  eq('normalize: περίοδος από κείμενο (έως)', n.period_to, '2026-06-30');
  eq('normalize: το κείμενο διατηρείται για την οθόνη', n.period, 'Ιούνιος 2026');
}
{
  const n = normalizeScannedDoc(doc({ doc_type: 'bill', period: 'εκκαθαριστικός λογαριασμός' }));
  eq('normalize: χωρίς μήνα δεν επινοεί (από)', n.period_from, undefined);
  eq('normalize: χωρίς μήνα δεν επινοεί (έως)', n.period_to, undefined);
}
{
  const n = normalizeScannedDoc(doc({ doc_type: 'bill', period: 'Ιούνιος 2026', period_from: '2026-06-05', period_to: '2026-07-04' }));
  eq('normalize: δεν πατάει ό,τι έδωσε το AI', [n.period_from, n.period_to], ['2026-06-05', '2026-07-04']);
}

// ── planDocSave: το παραστατικό κρατά ΠΟΣΟ, ΑΦΜ, ΠΕΡΙΟΔΟ, ΕΚΔΟΣΗ ───────────
{
  const p = planDocSave(doc({
    doc_type: 'bill', category: 'electricity', provider: 'ΔΕΗ', amount: 88.5,
    due_date: '2026-07-20', issue_date: '2026-07-01', provider_afm: '090000045',
    period_from: '2026-06-01', period_to: '2026-06-30', period: 'Ιούνιος 2026',
  }), TODAY);
  eq('αρχείο: ποσό', p.archive!.amount, 88.5);
  eq('αρχείο: ΑΦΜ παρόχου', p.archive!.provider_afm, '090000045');
  eq('αρχείο: περίοδος από', p.archive!.period_from, '2026-06-01');
  eq('αρχείο: περίοδος έως', p.archive!.period_to, '2026-06-30');
  eq('αρχείο: ημ. έκδοσης', p.archive!.issue_date, '2026-07-01');
  eq('αρχείο: ράφι ρεύματος', p.archive!.category, 'Λογαριασμός Ρεύματος');
  eq('λογαριασμός: γράφεται και η περίοδος', p.bill!.period, 'Ιούνιος 2026');
}
// Άκυρο ΑΦΜ ΔΕΝ αποθηκεύεται ως σωστό.
{
  const p = planDocSave(doc({ doc_type: 'bill', category: 'water', provider: 'ΕΥΔΑΠ', amount: 42, provider_afm: '090000046' }), TODAY);
  eq('αρχείο: άκυρο ΑΦΜ δεν γράφεται', p.archive!.provider_afm, undefined);
}
// Χωρίς ποσό → undefined (NULL), ΠΟΤΕ 0: το μηδέν θα μολύνει κάθε άθροισμα.
{
  const p = planDocSave(doc({ doc_type: 'other', title: 'Βεβαίωση' }), TODAY);
  eq('αρχείο: χωρίς ποσό → undefined', p.archive!.amount, undefined);
}
{
  const p = planDocSave(doc({ doc_type: 'bill', category: 'gas', provider: 'ΔΕΠΑ', amount: 0 }), TODAY);
  eq('αρχείο: ποσό 0 → undefined', p.archive!.amount, undefined);
}
// Ασφαλιστήριο: το ασφάλιστρο ΕΙΝΑΙ το ποσό του παραστατικού.
{
  const p = planDocSave(doc({ doc_type: 'insurance', provider: 'Interamerican', premium: 240, expiry_date: '2027-01-01' }), TODAY);
  eq('αρχείο: ασφάλιστρο ως ποσό', p.archive!.amount, 240);
}
// Η περίοδος από ΚΕΙΜΕΝΟ φτάνει στο αρχείο όταν προηγηθεί normalizeScannedDoc.
{
  const p = planDocSave(normalizeScannedDoc(doc({ doc_type: 'bill', category: 'water', provider: 'ΕΥΔΑΠ', amount: 55, period: '01/04/2026 - 30/06/2026' })), TODAY);
  eq('αρχείο: περίοδος από ελεύθερο κείμενο', [p.archive!.period_from, p.archive!.period_to], ['2026-04-01', '2026-06-30']);
}
// Ό,τι γράφεται στο αρχείο μπορεί να ξαναδιαβαστεί ως υποψήφιος ταιριάσματος:
// το παραστατικό και ο λογαριασμός μιλούν την ίδια γλώσσα.
{
  const scanned = normalizeScannedDoc(doc({
    doc_type: 'payment', category: 'electricity', provider: 'ΔΕΗ', amount: 88.5,
    issue_date: '2026-07-30', provider_afm: '090000045', period: 'Ιούλιος 2026',
  }));
  const a = planDocSave(scanned, TODAY).archive!;
  const twoBills = [
    { id: 'jun', category: 'electricity', amount: 88.5, due_date: '2026-07-20', provider: 'ΔΕΗ', period: 'Ιούνιος 2026' },
    { id: 'jul', category: 'electricity', amount: 88.5, due_date: '2026-08-20', provider: 'ΔΕΗ', period: 'Ιούλιος 2026' },
  ];
  const r = matchPaymentToBills({
    amount: a.amount!, date: a.issue_date!, category: 'electricity',
    provider: a.supplier, provider_afm: a.provider_afm,
    period_from: a.period_from, period_to: a.period_to,
  }, twoBills);
  eq('end-to-end: η απόδειξη Ιουλίου εξοφλεί τον Ιούλιο', [r.verdict, r.best?.bill.id], ['confident', 'jul']);
}

// ── Η ΕΠΟΜΕΝΗ ΧΡΕΩΣΗ ΜΠΑΙΝΕΙ ΜΟΝΗ ΤΗΣ ΣΤΟ ΗΜΕΡΟΛΟΓΙΟ ────────────────────────
// Ο χρήστης σαρώνει μια απόδειξη συνδρομής και δεν κάνει τίποτε άλλο. Αν το
// χαρτί λέει κάθε πότε χρεώνεται, ξέρουμε πότε ξαναχρεώνεται.
{
  const sub = (over: Record<string, unknown> = {}) => planDocSave(normalizeScannedDoc(doc({
    doc_type: 'bill', category: 'streaming', provider: 'Netflix', amount: 12.49,
    issue_date: '2026-08-11', ...over,
  })), TODAY);

  const yearly = sub({ billing_period: 'yearly' }).calendar || [];
  const renewal = yearly.find(e => e.title.startsWith('Ανανέωση'));
  eq('ετήσια συνδρομή: γεγονός ανανέωσης σε έναν χρόνο', renewal?.event_date, '2027-08-11');
  eq('κατηγορία συμβολαίου, όχι υπενθύμιση', renewal?.category, 'contract');
  check('η σημείωση λέει πότε ειδοποιεί', /08\/08\/2027/.test(String(renewal?.notes)));
  check('και γιατί', /ακυρώσεις/.test(String(renewal?.notes)));

  const monthly = (sub({ billing_period: 'Μηνιαία συνδρομή' }).calendar || [])
    .find(e => e.title.startsWith('Ανανέωση'));
  eq('μηνιαία: σε έναν μήνα', monthly?.event_date, '2026-09-11');

  // ΧΩΡΙΣ ΠΕΡΙΟΔΟ ΔΕΝ ΜΑΝΤΕΥΟΥΜΕ. Μια εφάπαξ αγορά δεν λήγει και ένα γεγονός
  // «ανανέωση» σε ημερομηνία που δεν υπάρχει είναι θόρυβος με ημερομηνία.
  check('χωρίς περίοδο, κανένα γεγονός ανανέωσης',
    !(sub().calendar || []).some(e => e.title.startsWith('Ανανέωση')));
  check('εφάπαξ, κανένα γεγονός ανανέωσης',
    !(sub({ billing_period: 'εφάπαξ' }).calendar || []).some(e => e.title.startsWith('Ανανέωση')));
}

// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΕΙΔΗ ΕΓΓΡΑΦΟΥ ΚΑΙ Η ΦΟΡΜΑ ΤΟΥΣ: ΜΙΑ ΠΗΓΗ ΓΙΑ ΦΟΡΜΑ, ΕΛΕΓΧΟ, ΑΠΟΘΗΚΕΥΣΗ, ΑΝΑΓΝΩΣΗ
// ═══════════════════════════════════════════════════════════════════════════
const VALID_AFM = '090000045';
const VALID_ATAK = '11122233344';
const OTHER_ATAK = '99988877766';
const kindIds = DOC_KINDS.map(k => k.value);
const asKind = (v: DocKindId, o: Partial<ScannedDoc> = {}): ScannedDoc => applyKind(doc(o), v);

// ── Το μητρώο ───────────────────────────────────────────────────────────────
check('είδη: μοναδικές τιμές', new Set(kindIds).size === kindIds.length);
check('είδη: μοναδικό ζεύγος τύπου και υποτύπου',
  new Set(DOC_KINDS.map(k => `${k.doc_type}/${k.subtype ?? ''}`)).size === DOC_KINDS.length);
check('είδη: κάθε τύπος του DocType έχει είδος χωρίς υποτύπο',
  DOC_TYPES.every(t => DOC_KINDS.some(k => k.doc_type === t.id && !k.subtype)));
eq('είδη: οι ομάδες του dropdown με τη σειρά τους',
  KIND_OPTIONS.filter(o => o.header).map(o => o.header),
  ['Λογαριασμοί και πληρωμές', 'Μίσθωση', 'Ακίνητο', 'Φορολογικά', 'Άλλα']);
eq('είδη: η σειρά του dropdown', kindIds,
  ['bill', 'payment', 'lease', 'rent_in', 'deed', 'insurance', 'pea', 'ama', 'enfia', 'e9', 'e1', 'e2', 'e3', 'income_tax', 'tax', 'government', 'other']);
check('είδη: κάθε ράφι υπάρχει στην ταξινομία',
  DOC_KINDS.every(k => k.shelf === null || (ARCHIVE_CATEGORIES as readonly string[]).includes(k.shelf)));
for (const v of kindIds) {
  eq(`είδη: το ${v} διαλέγεται και ξαναδιαβάζεται`, kindOf(asKind(v))?.value, v);
  check(`είδη: το ${v} έχει φόρμα`, !!docForm(asKind(v)));
}
{
  const a = applyKind(doc({ doc_type: 'bill', amount: 42, provider: 'ΔΕΗ' }), 'lease');
  eq('αλλαγή τύπου: οι τιμές μένουν', [a.amount, a.provider, a.doc_type], [42, 'ΔΕΗ', 'lease']);
  const b = applyKind(doc({ doc_type: 'other', is_document: false }), 'deed');
  eq('αλλαγή τύπου: ο χρήστης διάλεξε, άρα είναι έγγραφο', kindOf(b)?.value, 'deed');
}
// ΜΗ ΕΓΓΡΑΦΟ: κενός τύπος, κρυμμένα πεδία, καμία καταχώρηση πριν διαλέξει ο χρήστης.
{
  const n = doc({ doc_type: 'other', is_document: false });
  eq('μη έγγραφο: κανένα είδος', kindOf(n), null);
  eq('μη έγγραφο: καμία φόρμα', docForm(n), null);
  eq('μη έγγραφο: ζητά τύπο', validateDoc(n).blocking, ['kind']);
  eq('μη έγγραφο: «Θα ενημερωθούν» κενό', docTargets(n, true), []);
  check('μη έγγραφο: ο τύπος έχει ετικέτα για το μήνυμα', !!DOC_FIELD_LABELS.kind);
}

// ── Κάθε τύπος έχει τα υποχρεωτικά του ──────────────────────────────────────
const REQUIRED: Record<DocKindId, string[]> = {
  bill: ['amount'], payment: ['amount'], rent_in: ['amount'],
  lease: ['tenant_name', 'monthly_rent'], insurance: ['provider'],
  enfia: ['tax_year'], e9: ['tax_year'], e1: ['tax_year'], e2: ['tax_year'], e3: ['tax_year'],
  income_tax: ['tax_year'], tax: ['tax_year'],
  deed: [], pea: [], ama: [], government: [], other: [],
};
const allFields = (d: ScannedDoc): DocField[] => (docForm(d)?.groups || []).flatMap(g => g.rows.flat());
for (const v of kindIds) {
  const empty = asKind(v);
  eq(`υποχρεωτικά: ${v} (σχήμα)`, allFields(empty).filter(f => f.required).map(f => f.key), REQUIRED[v]);
  eq(`υποχρεωτικά: ${v} (έλεγχος)`, validateDoc(empty).blocking, REQUIRED[v]);
}
// Τα φορολογικά έντυπα δεν ζητούν ποσό.
check('Ε1: κανένα ποσό στα ζητούμενα', !validateDoc(asKind('e1')).recommended.includes('amount'));

// ── Σειρές: ζεύγη ή πλήρες πλάτος, ποτέ τρία ────────────────────────────────
const CONTEXTS: Partial<ScannedDoc>[] = [
  {}, { category: 'electricity' }, { category: 'common' }, { category: 'internet' },
  { provider_country: 'IE' }, { lines: [{ atak: VALID_ATAK }, { atak: OTHER_ATAK }] },
];
for (const v of kindIds) {
  for (const c of CONTEXTS) {
    const f = docForm(asKind(v, c))!;
    check(`σειρές: ${v} ${JSON.stringify(c)} έως δύο πεδία`, f.groups.every(g => g.rows.every(r => r.length >= 1 && r.length <= 2)));
  }
}
{
  // Υπότιτλοι ομάδων μόνο στα είδη με έξι πεδία και πάνω.
  const titled = kindIds.filter(v => docForm(asKind(v, { category: 'electricity' }))!.groups.some(g => g.title));
  eq('υπότιτλοι: μόνο λογαριασμός, μισθωτήριο, τίτλος', titled, ['bill', 'lease', 'deed']);
  check('υπότιτλοι: όσα τους έχουν έχουν τουλάχιστον έξι πεδία', titled.every(v => allFields(asKind(v)).length >= 6));
}
{
  // Ο συνοδός της κατηγορίας: χιλιοστά στα κοινόχρηστα, επανάληψη στις
  // συνδρομές, κανείς αλλού. Χωρίς συνοδό η κατηγορία απλώνεται.
  const row = (c: Partial<ScannedDoc>) => docForm(asKind('bill', c))!.groups[1].rows.find(r => r[0].key === 'category')!.map(f => f.key);
  eq('κατηγορία + χιλιοστά', row({ category: 'common' }), ['category', 'millesimi']);
  eq('κατηγορία + επανάληψη', row({ category: 'streaming' }), ['category', 'billing_period']);
  eq('κατηγορία μόνη της', row({ category: 'water' }), ['category']);
  const keys = (c: Partial<ScannedDoc>) => allFields(asKind('bill', c)).map(f => f.key);
  check('παροχή και kWh μόνο στο ρεύμα', keys({ category: 'electricity' }).includes('account_num') && !keys({ category: 'water' }).includes('kwh'));
  check('ΦΠΑ εκδότη μόνο σε ξένο εκδότη', keys({ provider_vat: 'IE6388047V' }).includes('provider_vat') && !keys({ provider_afm: VALID_AFM }).includes('provider_vat'));
  check('η κατηγορία ρεύματος βγαίνει και από τον πάροχο', keys({ provider: 'ΔΕΗ' }).includes('kwh'));
  check('γραμμή ΕΝΦΙΑ μόνο με πολλές γραμμές',
    allFields(asKind('enfia', { lines: [{}, {}] })).some(f => f.key === 'line') && !allFields(asKind('enfia', { lines: [{}] })).some(f => f.key === 'line'));
}

// ── Κάθε πεδίο έχει προορισμό: αλλάζει το σχέδιο αποθήκευσης ────────────────
const LINES = [{ atak: VALID_ATAK, address: 'Κυψέλης 10', sqm: 80, storage_sqm: 6, floor: '2', year_built: 1985, amount: 210 },
  { atak: OTHER_ATAK, address: 'Πατησίων 5', sqm: 55, amount: 140 }];
const BASE: Record<DocKindId, Partial<ScannedDoc>> = {
  bill: { category: 'electricity', amount: 50 }, payment: { category: 'electricity', amount: 50 },
  // Η κατάθεση έχει «πάροχο», την τράπεζα: ο ενοικιαστής πρέπει να γράφεται παρόλα αυτά.
  rent_in: { amount: 600, provider: 'Τράπεζα' }, lease: { tenant_name: 'Α', monthly_rent: 600 }, deed: {},
  insurance: { provider: 'Interamerican' }, pea: {}, ama: {},
  enfia: { tax_year: 2026, property_amount: 300, lines: LINES }, e9: { tax_year: 2025, atak: VALID_ATAK, lines: LINES },
  e1: { tax_year: 2025 }, e2: { tax_year: 2025 }, e3: { tax_year: 2025 }, income_tax: { tax_year: 2025 }, tax: { tax_year: 2025 },
  government: {}, other: {},
};
// Ό,τι χρειάζεται ένα πεδίο για να φανεί (π.χ. η παροχή θέλει ρεύμα).
const CONTEXT: Partial<Record<keyof ScannedDoc, Partial<ScannedDoc>>> = {
  millesimi: { category: 'common' }, billing_period: { category: 'internet' },
};
const SAMPLE: Partial<Record<keyof ScannedDoc, string>> = {
  provider_afm: VALID_AFM, afm: VALID_AFM, atak: VALID_ATAK, ama: '00001234567', account_num: '1 23456789-01 7',
  provider_country: 'NL', provider_vat: 'IE6388047V', category: 'water', billing_period: 'yearly', pea_class: 'B',
  tax_year: '2024', line: '1', rent_due_day: '5',
};
const sampleOf = (f: DocField): string => SAMPLE[f.key]
  ?? (f.input === 'date' ? '2026-05-01' : f.input === 'money' || f.input === 'number' ? '123' : 'Δοκιμή');
const VISIBILITY: Partial<ScannedDoc>[] = [{}, { category: 'electricity' }, { category: 'common' }, { category: 'internet' }, { provider_vat: 'IE6388047V' }];
for (const v of kindIds) {
  // Όλα τα πεδία του είδους, με όποιο πλαίσιο τα κάνει ορατά.
  const fieldsOf = new Map<string, DocField>();
  for (const ctx of VISIBILITY) for (const f of allFields(asKind(v, { ...BASE[v], ...ctx }))) if (!fieldsOf.has(f.key)) fieldsOf.set(f.key, f);
  for (const [key, f] of fieldsOf) {
    check(`προορισμός: ${v}.${key} δηλωμένος`, !!f.dest && !!f.label);
    const without = asKind(v, { ...BASE[v], ...CONTEXT[f.key] });
    delete (without as unknown as Record<string, unknown>)[f.key];
    const withIt = withField(without, f, sampleOf(f));
    check(`προορισμός: ${v}.${key} φαίνεται με την τιμή του`, allFields(withIt).some(x => x.key === f.key));
    check(`προορισμός: ${v}.${key} αλλάζει το σχέδιο`,
      JSON.stringify(planDocSave(withIt, TODAY)) !== JSON.stringify(planDocSave(without, TODAY)));
  }
}
// Οι Σημειώσεις και τα δικά σου πεδία: κοινά σε κάθε είδος, γράφονται στον Φάκελο.
for (const v of kindIds) {
  const p = planDocSave(asKind(v, { ...BASE[v], notes: 'Αρ. πρωτοκόλλου 55', custom: [{ label: 'Κωδικός', value: 'Χ1' }] }), TODAY);
  check(`σημειώσεις: ${v} στον Φάκελο`, (p.archive?.note || '').includes('Αρ. πρωτοκόλλου 55'));
  check(`δικό σου πεδίο: ${v} ως «Όνομα: Τιμή» στον Φάκελο`, (p.archive?.note || '').includes('Κωδικός: Χ1'));
}

// ── Κανένα πεδίο χωρίς χρήση: η ανάγνωση ζητά ό,τι δείχνει η φόρμα και μόνο ──
{
  const formKeys = new Set<string>();
  for (const v of kindIds) for (const c of CONTEXTS) for (const f of allFields(asKind(v, { ...c, provider_vat: 'IE6388047V' }))) formKeys.add(f.key);
  const asked = SCAN_KEYS.map(k => k.key as string);
  check('ανάγνωση: μοναδικά κλειδιά', new Set(asked).size === asked.length);
  // Δύο πεδία δεν τα διαβάζει η ανάγνωση: τα βγάζει η φόρμα από τις γραμμές.
  const derived = new Set(['line', 'property_amount']);
  for (const k of formKeys) {
    if (!derived.has(k)) check(`ανάγνωση: ζητείται το πεδίο ${k}`, asked.includes(k));
  }
  for (const k of SCAN_KEYS) {
    check(`ανάγνωση: το ${k.key} φαίνεται στη φόρμα ή λέει ποιος το διαβάζει`, formKeys.has(k.key) || !!k.use);
    check(`ανάγνωση: το prompt ζητά το ${k.key}`, SYSTEM_PROMPT.includes(`"${k.key}":`));
  }
  // Όσα δεν φαίνονται: ο αναγνώστης τους υπάρχει πράγματι.
  const src = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
  const CONSUMER: Record<string, string[]> = {
    provider_phone: ['app', 'dashboard', 'components', 'DocumentScan.tsx'],
    provider_email: ['app', 'dashboard', 'components', 'DocumentScan.tsx'],
    confidence: ['app', 'dashboard', 'components', 'DocumentScan.tsx'],
    landlord_name: ['app', 'dashboard', 'components', 'LeaseModal.tsx'],
    owners: ['app', 'dashboard', 'components', 'OwnerSplit.tsx'],
    photo_category: ['app', 'dashboard', 'components', 'scanDoc.ts'],
  };
  for (const [k, file] of Object.entries(CONSUMER)) check(`ανάγνωση: το ${k} το διαβάζει το ${file.at(-1)}`, src(...file).includes(`.${k}`));
  // Και όσα πάνε σε σημείωση ή στήλη χωρίς πεδίο: αλλάζουν το σχέδιο.
  const effect = (v: DocKindId, o: Partial<ScannedDoc>) =>
    JSON.stringify(planDocSave(asKind(v, { ...BASE[v], ...o }), TODAY)) !== JSON.stringify(planDocSave(asKind(v, BASE[v]), TODAY));
  check('ανάγνωση: vat_rate → bills.vat_rate', effect('bill', { vat_rate: 24 }));
  check('ανάγνωση: cubic_meters → σημείωση', effect('bill', { cubic_meters: 12 }));
  check('ανάγνωση: coverage → σημείωση ασφαλιστηρίου', effect('insurance', { coverage: 150000 }));
  check('ανάγνωση: period → bills.period', effect('bill', { period: 'Ιούνιος 2026' }));
  // Όσα έφυγαν από το prompt.
  for (const gone of ['customer_afm', 'plan_name', 'net_amount', 'vat_amount']) {
    check(`prompt: δεν ζητά πια το ${gone}`, !SYSTEM_PROMPT.includes(`"${gone}"`));
  }
  eq('prompt: ένας συντελεστής ΦΠΑ, όχι δύο', SYSTEM_PROMPT.split('"vat_rate"').length - 1, 1);
  check('prompt: χωράει στο όριο του διακομιστή', SYSTEM_PROMPT.length < SCAN_SHAPE.maxSystemChars);
  check('prompt: παραλείπει τα κενά κλειδιά', SYSTEM_PROMPT.includes('παράλειψε όσα είναι null'));
  check('prompt: ζητά κάθε υποτύπο', DOC_KINDS.filter(k => k.subtype).every(k => SYSTEM_PROMPT.includes(k.subtype!)));
  check('prompt: ξεκινά με το τι διαβάζει', SYSTEM_PROMPT.startsWith('Διαβάζεις έγγραφα ακινήτων στην Ελλάδα'));
  // Κάθε αριθμητικό πεδίο της φόρμας γίνεται αριθμός στην ανάγνωση.
  for (const k of formKeys) {
    const f = kindIds.flatMap(v => allFields(asKind(v, { category: 'common' }))).concat(kindIds.flatMap(v => allFields(asKind(v, { category: 'electricity' })))).find(x => x.key === k);
    if (f && (f.input === 'money' || f.input === 'number' || f.options === 'tax_year') && !derived.has(k)) {
      check(`ανάγνωση: το ${k} γίνεται αριθμός`, (SCAN_NUM_KEYS as readonly string[]).includes(k));
    }
  }
  check('ανάγνωση: όριο γραμμών', SCAN_MAX_LINES === 8 && SYSTEM_PROMPT.includes(`έως ${SCAN_MAX_LINES}`));
}

// ── Κατηγοριοποίηση: ο συγκεκριμένος τύπος του μοντέλου κερδίζει ──────────────
eq('Ε9 με ΑΤΑΚ → φορολογικό', classifyDocType(doc({ doc_type: 'tax', subtype: 'e9', atak: VALID_ATAK })), 'tax');
eq('Ε9 με ΑΤΑΚ → υποτύπος e9', normalizeScannedDoc(doc({ doc_type: 'tax', subtype: 'e9', atak: VALID_ATAK })).subtype, 'e9');
eq('ΕΝΦΙΑ με αντικειμενική → φορολογικό', classifyDocType(doc({ doc_type: 'tax', title: 'Εκκαθαριστικό ΕΝΦΙΑ 2026', obj_value: 95000 })), 'tax');
eq('ΕΝΦΙΑ: ο υποτύπος βγαίνει από τον τίτλο', normalizeScannedDoc(doc({ doc_type: 'tax', title: 'Εκκαθαριστικό ΕΝΦΙΑ 2026', obj_value: 95000 })).subtype, 'enfia');
eq('Ε1 από τον τίτλο', [classifyDocType(doc({ title: 'Ε1 2025' })), classifySubtype(doc({ doc_type: 'tax', title: 'Ε1 2025' }))], ['tax', 'e1']);
eq('φόρος εισοδήματος από τον τίτλο', classifySubtype(doc({ doc_type: 'tax', title: 'Πράξη διοικητικού προσδιορισμού φόρου εισοδήματος' })), 'income_tax');
eq('ΠΕΑ από τον τίτλο υπερισχύει', classifyDocType(doc({ doc_type: 'bill', title: 'Πιστοποιητικό Ενεργειακής Απόδοσης' })), 'government');
eq('ΠΕΑ: υποτύπος', normalizeScannedDoc(doc({ doc_type: 'government', title: 'Πιστοποιητικό Ενεργειακής Απόδοσης' })).subtype, 'pea');
eq('ΑΜΑ: υποτύπος', normalizeScannedDoc(doc({ doc_type: 'government', title: 'Βεβαίωση ΑΜΑ' })).subtype, 'ama');
eq('ο υποτύπος άλλου τύπου δεν περνά', classifySubtype(doc({ doc_type: 'bill', title: 'ΕΝΦΙΑ' })), undefined);
for (const ai of ['bill', 'other'] as DocType[]) {
  const bill = (o: Partial<ScannedDoc>) => classifyDocType(doc({ doc_type: ai, category: 'electricity', amount: 84.5, ...o }));
  eq(`«Εκκαθαριστικός λογαριασμός» ΔΕΗ → bill (μοντέλο ${ai})`, bill({ title: 'Εκκαθαριστικός λογαριασμός', provider: 'ΔΕΗ' }), 'bill');
  eq(`«Εκκαθάριση κοινοχρήστων» → bill (μοντέλο ${ai})`, bill({ category: 'common', title: 'Εκκαθάριση κοινοχρήστων Οκτωβρίου' }), 'bill');
  eq(`«Καλαμαριά» δεν είναι ΑΜΑ (μοντέλο ${ai})`, bill({ category: 'electrician', provider: 'Ηλεκτρολόγος Καλαμαριάς' }), 'bill');
  eq(`«ενοικιαστή» στη σημείωση (μοντέλο ${ai})`, bill({ notes: 'Η παροχή είναι στο όνομα του ενοικιαστή' }), 'bill');
  eq(`«υπηρεσίες ασφαλείας» (μοντέλο ${ai})`, bill({ category: 'security', notes: 'Μηνιαίες υπηρεσίες ασφαλείας' }), 'bill');
  eq(`«κάλυψη 5G» (μοντέλο ${ai})`, bill({ category: 'internet', notes: 'Πλήρης κάλυψη 5G' }), 'bill');
  eq(`«Το έγγραφο είναι…» (μοντέλο ${ai})`, bill({ notes: 'Το έγγραφο είναι λογαριασμός ρεύματος' }), 'bill');
}
{
  // Η ΣΗΜΕΙΩΣΗ ΤΟΥ ΙΔΙΟΚΤΗΤΗ: μια γενική εικόνα, το μοντέλο λέει other/5 και
  // γράφει τι ΔΕΝ περιέχει. Η άρνηση έγινε «Μισθωτήριο».
  const owner = doc({ doc_type: 'other', confidence: 5, notes: 'Η εικόνα δεν περιέχει στοιχεία λογαριασμού, πληρωμής ή μισθωτηρίου.' });
  eq('η σημείωση του ιδιοκτήτη → other', classifyDocType(owner), 'other');
  check('η σημείωση του ιδιοκτήτη: δεν είναι έγγραφο', !isDocumentary(owner));
  eq('is_document false → other', classifyDocType(doc({ doc_type: 'bill', is_document: false, title: 'Μισθωτήριο' })), 'other');
  check('έγγραφο με στοιχεία', isDocumentary(doc({ doc_type: 'tax', tax_year: 2025 })));
}

// ── Εξομάλυνση: ταυτοδύναμη, δεν πατά επιλογές του χρήστη ───────────────────
eq('υποτύπος άλλου τύπου φεύγει', normalizeScannedDoc(doc({ doc_type: 'bill', subtype: 'e9' })).subtype, undefined);
eq('«Άλλο φορολογικό» μένει άλλο φορολογικό', normalizeScannedDoc(asKind('tax', { title: 'ΕΝΦΙΑ 2026' })).subtype, null);
eq('κατηγορία ΠΕΑ με ελληνικό Β', normalizeScannedDoc(doc({ doc_type: 'government', pea_class: 'Β+' })).pea_class, 'B+');
eq('κατηγορία ΠΕΑ από την ευρωπαϊκή κλίμακα', normalizeScannedDoc(doc({ doc_type: 'government', pea_class: 'c' })).pea_class, 'Γ');
eq('άκυρη κατηγορία ΠΕΑ φεύγει', normalizeScannedDoc(doc({ doc_type: 'government', pea_class: 'X' })).pea_class, undefined);
eq('ΑΜΑ μόνο ψηφία', normalizeScannedDoc(doc({ ama: ' 123-456 ' })).ama, '123456');
eq('ημέρα πληρωμής εκτός μήνα φεύγει', normalizeScannedDoc(doc({ rent_due_day: 40 })).rent_due_day, undefined);
eq('ημέρα πληρωμής ακέραια', normalizeScannedDoc(doc({ rent_due_day: 5.4 })).rent_due_day, 5);
eq('όροφος ως κείμενο', normalizeScannedDoc(doc({ floor: 2 as unknown as string })).floor, '2');
{
  const one = normalizeScannedDoc(doc({ doc_type: 'tax', subtype: 'e9', tax_year: 2025, lines: [LINES[0]] }));
  eq('Ε9 με μία γραμμή: ανεβαίνει', [one.atak, one.sqm, one.storage_sqm, one.floor, one.year_built, one.line], [VALID_ATAK, 80, 6, '2', 1985, 0]);
  const cleared = { ...one }; delete cleared.sqm;
  eq('Ε9: δεύτερο πέρασμα δεν ξαναγεμίζει ό,τι άδειασε ο χρήστης', normalizeScannedDoc(cleared).sqm, undefined);
  const enfia1 = normalizeScannedDoc(doc({ doc_type: 'tax', subtype: 'enfia', amount: 210, lines: [{ atak: VALID_ATAK }] }));
  eq('ΕΝΦΙΑ με ένα ακίνητο: το σύνολο είναι το ποσό του', enfia1.property_amount, 210);
  const enfia2 = normalizeScannedDoc(doc({ doc_type: 'tax', subtype: 'enfia', amount: 350, lines: LINES }));
  eq('ΕΝΦΙΑ με πολλά ακίνητα: κανένα ποσό μόνο του', enfia2.property_amount, undefined);
  const enfia0 = normalizeScannedDoc(doc({ doc_type: 'tax', subtype: 'enfia', amount: 350 }));
  eq('ΕΝΦΙΑ χωρίς ανάλυση: κανένα ποσό μόνο του', enfia0.property_amount, undefined);
  // Αλλαγή σε ΕΝΦΙΑ από άλλο τύπο: η μοναδική γραμμή φαίνεται αμέσως στη φόρμα
  // και η καταχώρηση δεν γράφει ποσό που ο χρήστης δεν είδε.
  const switched = applyKind(normalizeScannedDoc(doc({ doc_type: 'tax', amount: 210, lines: [{ atak: VALID_ATAK }] })), 'enfia');
  eq('αλλαγή σε ΕΝΦΙΑ: η γραμμή ανεβαίνει', [switched.property_amount, switched.line], [210, 0]);
  const emptied = { ...switched }; delete emptied.property_amount;
  eq('αλλαγή σε ΕΝΦΙΑ: ό,τι άδειασε ο χρήστης μένει άδειο', normalizeScannedDoc(emptied).property_amount, undefined);
  for (const d of [one, enfia1, enfia2, normalizeScannedDoc(doc({ doc_type: 'bill', period: 'Ιούνιος 2026', provider_afm: '090 000 045' }))]) {
    eq(`εξομάλυνση ταυτοδύναμη (${d.doc_type}/${d.subtype ?? ''})`, normalizeScannedDoc(d), d);
  }
}

// ── Γραμμές Ε9 και ΕΝΦΙΑ ─────────────────────────────────────────────────────
{
  const e = asKind('enfia', { tax_year: 2026, amount: 350, lines: LINES });
  const mine = withPropertyLine(e, VALID_ATAK);
  eq('ΕΝΦΙΑ: προεπιλογή η γραμμή του ακινήτου', [mine.line, mine.atak, mine.property_amount], [0, VALID_ATAK, 210]);
  const none = withPropertyLine(e, '12312312312');
  eq('ΕΝΦΙΑ: χωρίς ταίριασμα η ερώτηση μένει ανοιχτή', [none.line, none.property_amount], [undefined, undefined]);
  check('ΕΝΦΙΑ: χωρίς ταίριασμα η γραμμή «λείπει»', lineUnset(none) && !lineUnset(mine));
  eq('ΕΝΦΙΑ: αναπάντητο ≠ «Κανένα από αυτά»', [fieldValue(none, allFields(e).find(f => f.key === 'line')!), fieldValue(selectLine(none, -1), allFields(e).find(f => f.key === 'line')!)], ['', LINE_NONE.value]);
  eq('ΕΝΦΙΑ: το «Κανένα από αυτά» είναι απάντηση', withField(none, allFields(e).find(f => f.key === 'line')!, LINE_NONE.value).line, -1);
  check('ΕΝΦΙΑ: χωρίς ποσό η οθόνη λέει γιατί', /όλα τα ακίνητα του ΑΦΜ/.test(docForm(none)!.info || ''));
  check('ΕΝΦΙΑ: με ποσό το μήνυμα φεύγει', !docForm(mine)!.info);
  const p = planDocSave(none, TODAY);
  check('ΕΝΦΙΑ πολλές γραμμές χωρίς ταίριασμα: καμία δαπάνη', p.expense === undefined);
  eq('ΕΝΦΙΑ: το Αρχείο κρατά το σύνολο', p.archive!.amount, 350);
  eq('ΕΝΦΙΑ: ο χρήστης διαλέγει άλλη γραμμή', [selectLine(none, 1).atak, selectLine(none, 1).property_amount], [OTHER_ATAK, 140]);
  eq('ΕΝΦΙΑ: δεν ξαναδιαλέγει πάνω από τον χρήστη', withPropertyLine(selectLine(e, 1), VALID_ATAK).line, 1);
  const opts = fieldOptions(allFields(e).find(f => f.key === 'line')!, e, TODAY);
  eq('ΕΝΦΙΑ: γραμμές «ΑΤΑΚ · ποσό»', opts.map(o => o.label), [`ΑΤΑΚ ${VALID_ATAK} · 210,00€`, `ΑΤΑΚ ${OTHER_ATAK} · 140,00€`]);
  const e9 = withPropertyLine(asKind('e9', { tax_year: 2025, lines: LINES }), OTHER_ATAK);
  eq('Ε9: η γραμμή του ακινήτου', [e9.atak, e9.sqm, e9.floor], [OTHER_ATAK, 55, undefined]);
  const e9opt = fieldOptions(allFields(e9).find(f => f.key === 'line')!, e9, TODAY)[0];
  eq('Ε9: γραμμή «ΑΤΑΚ · m²» με διεύθυνση, όροφο και έτος από κάτω', [e9opt.label, e9opt.description], [`ΑΤΑΚ ${VALID_ATAK} · 80 m²`, 'Κυψέλης 10 · Όροφος 2 · 1985']);
}

// ── Σχέδιο αποθήκευσης ανά είδος ────────────────────────────────────────────
{
  const p = planDocSave(asKind('rent_in', { tenant_name: 'Γ. Παπαδόπουλος', amount: 650, issue_date: '2026-10-02' }), TODAY);
  check('είσπραξη ενοικίου: καμία δαπάνη', p.expense === undefined && p.bill === undefined);
  check('είσπραξη ενοικίου: καμία συμφωνία λογαριασμών', !p.reconcile);
  eq('είσπραξη ενοικίου: ράφι', p.archive!.category, 'Είσπραξη ενοικίου');
  eq('είσπραξη ενοικίου: ο ενοικιαστής στο Αρχείο', [p.archive!.supplier, p.archive!.amount], ['Γ. Παπαδόπουλος', 650]);
  eq('είσπραξη ενοικίου: φάκελος Τραπεζικά', folderForDoc(p.archive!.category), 'bank');
  check('είσπραξη ενοικίου: λέει πού σημειώνεται', (docForm(asKind('rent_in'))!.note || '').includes(navLabel('tenant')));
}
{
  // Η λήξη είναι δεδομένο της δοκιμής, όχι προθεσμία: τις δόσεις τις δίνει η μηχανή.
  const due = '2026-07-31';
  const p = planDocSave(asKind('enfia', { tax_year: 2026, property_amount: 210, amount: 350, due_date: due, atak: VALID_ATAK }), TODAY);
  check('ΕΝΦΙΑ: κανένα γεγονός ημερολογίου', p.calendar === undefined);
  eq('ΕΝΦΙΑ: δαπάνη με το ποσό του ακινήτου', [p.expense!.amount, p.expense!.category, p.expense!.date], [210, EXPENSE_MAP.taxes.cat, due]);
  eq('ΕΝΦΙΑ: τίτλος στον Φάκελο', p.archive!.title, 'ΕΝΦΙΑ 2026');
  eq('ΕΝΦΙΑ: ο ΑΤΑΚ μόνο αν λείπει', p.property, { atak: VALID_ATAK });
}
{
  const p = planDocSave(asKind('income_tax', { tax_year: 2025, amount: 1200, due_date: '2026-07-31' }), TODAY);
  check('φόρος εισοδήματος: καμία δαπάνη', p.expense === undefined);
  eq('φόρος εισοδήματος: 1η δόση χωρίς ποσό', [p.calendar![0].title, p.calendar![0].amount, p.calendar![0].category], ['Φόρος εισοδήματος 2025: 1η δόση', null, 'tax']);
  eq('φόρος εισοδήματος: το ποσό στο έγγραφο', p.archive!.amount, 1200);
}
for (const v of ['e1', 'e2', 'e3'] as DocKindId[]) {
  const p = planDocSave(asKind(v, { tax_year: 2024, amount: 999, issue_date: '2025-06-30' }), TODAY);
  check(`${v}: μόνο αρχειοθέτηση`, !p.expense && !p.calendar && !p.property && !p.bill);
  eq(`${v}: κανένα ποσό φόρου`, p.archive!.amount, undefined);
  eq(`${v}: τίτλος με έτος`, p.archive!.title, `Ε${v.slice(1)} 2024`);
}
check('Ε2: παραπέμπει στη Λογιστική', (docForm(asKind('e2'))!.info || '').includes(navLabel('accounting')));
{
  const without = planDocSave(asKind('e9', { tax_year: 2025, sqm: 80 }), TODAY);
  eq('Ε9 χωρίς ΑΤΑΚ: μόνο αρχειοθέτηση', [without.property, without.targets], [undefined, [navLabel('documents')]]);
  eq('Ε9 χωρίς ΑΤΑΚ: «Θα ενημερωθούν» το λέει', docTargets(asKind('e9', { tax_year: 2025, sqm: 80 }), true), [navLabel('documents')]);
  const withAtak = planDocSave(asKind('e9', { tax_year: 2025, atak: VALID_ATAK, sqm: 80, storage_sqm: 6, floor: '2ος', year_built: 1985 }), TODAY);
  eq('Ε9 με ΑΤΑΚ: τα κενά του ακινήτου', withAtak.property, { atak: VALID_ATAK, sqm: 80, storage_sqm: 6, floor: '2ος', year_built: 1985 });
  check('Ε9: κανένα ποσό, δαπάνη ή γεγονός', !withAtak.expense && !withAtak.calendar && withAtak.archive!.amount === undefined);
  eq('Ε9: «(μόνο κενά)»', docTargets(asKind('e9', { tax_year: 2025, atak: VALID_ATAK }), true), [`${PROPERTY_TARGET} (μόνο κενά)`, navLabel('documents')]);
}
{
  // Λογαριασμός: συντελεστής από το χαρτί ή κανένας· ανανέωση μόνο σε συνδρομές.
  eq('λογαριασμός χωρίς συντελεστή → vat_rate null', planDocSave(asKind('bill', { category: 'water', amount: 30 }), TODAY).bill!.vat_rate, null);
  eq('λογαριασμός με συντελεστή', planDocSave(asKind('bill', { category: 'water', amount: 30, vat_rate: 13 }), TODAY).bill!.vat_rate, 13);
  const dei = planDocSave(asKind('bill', { category: 'electricity', provider: 'ΔΕΗ', amount: 88, issue_date: '2026-08-01', billing_period: 'monthly' }), TODAY);
  check('ρεύμα: καμία «Ανανέωση»', !(dei.calendar || []).some(e => e.title.startsWith('Ανανέωση')));
  const net = planDocSave(asKind('bill', { category: 'internet', provider: 'Nova', amount: 30, issue_date: '2026-08-01', billing_period: 'yearly' }), TODAY);
  check('internet: ανανέωση', (net.calendar || []).some(e => e.title.startsWith('Ανανέωση')));
  // Πάροχος και παροχή στο ακίνητο, μόνο αν λείπουν.
  const p = planDocSave(asKind('bill', { category: 'electricity', provider: 'ΔΕΗ', amount: 88, account_num: '1 23456789-01 7' }), TODAY);
  eq('ρεύμα: ο αριθμός παροχής στο ακίνητο', p.property, { power_supply_no: '123456789017' });
  eq('ρεύμα: ο πάροχος στο ακίνητο', p.settingsFill, { electricity_provider: 'ΔΕΗ' });
  check('ρεύμα: η σημείωση κρατά την παροχή για τον οδηγό', String(p.bill!.notes).includes('Παροχή: 1 23456789-01 7'));
  eq('ρεύμα: μισή παροχή δεν γράφεται', planDocSave(asKind('bill', { category: 'electricity', amount: 88, account_num: '1234' }), TODAY).property, undefined);
  eq('νερό: η παροχή δεν είναι ρεύματος', planDocSave(asKind('bill', { category: 'water', amount: 30, account_num: '123456789017' }), TODAY).property, undefined);
  eq('θα ενημερωθούν: λογαριασμός ρεύματος με αρχείο',
    docTargets(asKind('bill', { category: 'electricity', provider: 'ΔΕΗ', amount: 88, due_date: '2026-08-20' }), true),
    ['Λογαριασμοί', 'Δαπάνες', 'Ημερολόγιο', `${PROPERTY_TARGET} (μόνο κενά)`, navLabel('documents')]);
  check('θα ενημερωθούν: χωρίς αρχείο, χωρίς Φάκελο', !docTargets(asKind('bill', { category: 'water', amount: 30 }), false).includes(navLabel('documents')));
}
{
  const p = planDocSave(asKind('lease', { tenant_name: 'Α', monthly_rent: 600, afm: '111111111', rent_due_day: 5 }), TODAY);
  eq('μισθωτήριο: άκυρο ΑΦΜ δεν γράφεται', p.tenant!.afm, null);
  eq('μισθωτήριο: ημέρα πληρωμής', p.tenant!.rent_due_day, 5);
  eq('μισθωτήριο: στους Ενοικιαστές', p.targets, [navLabel('tenant'), navLabel('documents')]);
}
{
  const p = planDocSave(asKind('pea', { pea_class: 'Β', issue_date: '2026-01-10', expiry_date: '2036-01-10' }), TODAY);
  eq('ΠΕΑ: η κατηγορία αντικαθιστά', p.propertyReplace, { pea_class: 'B' });
  eq('ΠΕΑ: λήξη στο ημερολόγιο', [p.calendar![0].title, p.calendar![0].category], ['Λήξη ΠΕΑ', 'contract']);
  eq('ΠΕΑ: ράφι', p.archive!.category, 'Τεχνική Έκθεση');
  check('ΠΕΑ χωρίς λήξη: καμία λήξη', planDocSave(asKind('pea', { pea_class: 'A' }), TODAY).calendar === undefined);
}
{
  eq('ΑΜΑ: στο ακίνητο, μόνο αν λείπει', planDocSave(asKind('ama', { ama: '00001234567' }), TODAY).property, { ama: '00001234567' });
  eq('ΑΜΑ: χωρίς ψηφία τίποτα', planDocSave(asKind('ama', { ama: 'ΑΒΓ' }), TODAY).property, undefined);
}
eq('τίτλος ιδιοκτησίας: δικό του ράφι', planDocSave(asKind('deed', { purchase_price: 1 }), TODAY).archive!.category, 'Τίτλος ιδιοκτησίας');
eq('τίτλος ιδιοκτησίας: φάκελος Έγγραφα ακινήτου', folderForDoc('Τίτλος ιδιοκτησίας'), 'property');
{
  const p = planDocSave(asKind('bill', { category: 'water', amount: 30, period_from: '2026-07-01', period_to: '2026-06-01' }), TODAY);
  eq('ανάποδη περίοδος δεν γράφεται', [p.archive!.period_from, p.archive!.period_to], [undefined, undefined]);
  check('άκυρος ΑΤΑΚ → invalid', validateDoc(asKind('deed', { atak: '123' })).invalid.includes('atak'));
}

// ── Ράφια, φάκελοι, κατηγορίες ──────────────────────────────────────────────
{
  const opts = archiveOptions();
  eq('ράφια: όλα, μία φορά', opts.map(o => o.value).sort(), [...ARCHIVE_CATEGORIES].sort());
  eq('ράφια: ομαδοποιημένα ανά φάκελο', opts.filter(o => o.header).map(o => o.header),
    ['Συμβόλαια', 'Έγγραφα ακινήτου', 'Φόροι και ΕΝΦΙΑ', 'Λογαριασμοί', 'Πάροχοι', 'Τραπεζικά']);
  check('ράφια: κάθε επικεφαλίδα είναι φάκελος', opts.filter(o => o.header).every(o => FOLDERS.some(f => f.label === o.header)));
  eq('παλιά ράφια βρίσκουν φάκελο', folderForDoc('tenant'), 'property');
  eq('κατηγορίες: κάθε κλειδί δαπάνης μία φορά', BILL_CATEGORIES.map(c => c.value).sort(), Object.keys(EXPENSE_MAP).sort());
  eq('κατηγορίες: ομάδες', BILL_CATEGORIES.filter(c => c.header).map(c => c.header), ['Πάγια', 'Συντήρηση', 'Άλλο']);
}

// ── Πεδία: τιμές και αλλαγές ────────────────────────────────────────────────
{
  const d = asKind('bill', { category: 'electricity', amount: 50 });
  const f = (k: string) => allFields(d).find(x => x.key === k)!;
  eq('πεδίο: το ΑΦΜ μόνο ψηφία', withField(d, f('provider_afm'), '090 000 045').provider_afm, VALID_AFM);
  eq('πεδίο: ποσό με υποδιαστολή', withField(d, f('amount'), '84,5').amount, 84.5);
  eq('πεδίο: το κενό σβήνει', 'amount' in withField(d, f('amount'), ''), false);
  const withPeriod = { ...d, period: 'Ιούνιος 2026' };
  eq('πεδίο: η περίοδος σβήνει το «Στο χαρτί»', withField(withPeriod, f('period_from'), '2026-06-01').period, undefined);
  eq('πεδίο: η κατηγορία δείχνει ό,τι θα γραφτεί', fieldValue(doc({ doc_type: 'bill', provider: 'ΔΕΗ' }), f('category')), 'electricity');
  const year = allFields(asKind('e9')).find(x => x.key === 'tax_year')!;
  eq('έτος: φέτος και πέντε πίσω, με ό,τι διάβασε η σάρωση', fieldOptions(year, asKind('e9', { tax_year: 2018 }), '2026-10-13').map(o => o.value),
    ['2026', '2025', '2024', '2023', '2022', '2021', '2018']);
  eq('έτος: γίνεται αριθμός', withField(asKind('e9'), year, '2025').tax_year, 2025);
  const day = allFields(asKind('lease')).find(x => x.key === 'rent_due_day')!;
  eq('ημέρα πληρωμής: έως 31', withField(asKind('lease'), day, '45').rent_due_day, 31);
}

// ── Ευρήματα ελέγχου 13/10 ───────────────────────────────────────────────────
{
  // Η απόδειξη πληρωμής δεν γράφει στο ακίνητο ούτε στους παρόχους.
  const p = planDocSave(asKind('payment', { category: 'electricity', provider: 'Eurobank', amount: 84.5, account_num: '123456789017' }), TODAY);
  eq('απόδειξη: κανένα στοιχείο ακινήτου', [p.property, p.settingsFill, p.targets.includes(PROPERTY_TARGET)], [undefined, undefined, false]);
  const b = planDocSave(asKind('bill', { category: 'electricity', provider: 'ΔΕΗ', amount: 84.5, account_num: '123456789017' }), TODAY);
  check('λογαριασμός: γράφει παροχή και πάροχο', !!b.property && !!b.settingsFill);
}
{
  // Είσπραξη ενοικίου: ο ενοικιαστής κερδίζει τον «πάροχο» (την τράπεζα).
  const p = planDocSave(asKind('rent_in', { tenant_name: 'Γ. Παπαδόπουλος', provider: 'Eurobank', amount: 650 }), TODAY);
  eq('είσπραξη ενοικίου: ο ενοικιαστής, όχι η τράπεζα', p.archive!.supplier, 'Γ. Παπαδόπουλος');
  eq('είσπραξη ενοικίου: χωρίς ενοικιαστή η τράπεζα', planDocSave(asKind('rent_in', { provider: 'Eurobank', amount: 650 }), TODAY).archive!.supplier, 'Eurobank');
}
{
  // «Θα ενημερωθούν» με το σημερινό: συνδρομή χωρίς ημερομηνίες βγάζει ανανέωση.
  const sub = asKind('bill', { category: 'internet', provider: 'Nova', amount: 30, billing_period: 'yearly' });
  check('θα ενημερωθούν: συνδρομή χωρίς ημερομηνίες → Ημερολόγιο', docTargets(sub, true, TODAY).includes(navLabel('calendar')));
  check('θα ενημερωθούν: ίδιο με την καταχώρηση', planDocSave(sub, TODAY).targets.includes(navLabel('calendar')));
}
{
  // Μόνο κενά δεν είναι τιμή.
  const ins = asKind('insurance');
  const f = allFields(ins).find(x => x.key === 'provider')!;
  const blank = withField(ins, f, '   ');
  eq('κενά: η Ασφαλιστική «   » σβήνει', 'provider' in blank, false);
  check('κενά: η Ασφαλιστική «   » λείπει', validateDoc({ ...ins, provider: '   ' }).blocking.includes('provider'));
  check('κενά: χωρίς τίποτα να γραφτεί, όχι «Στοιχεία ακινήτου»', !planDocSave({ ...ins, provider: '   ' }, TODAY).targets.includes(PROPERTY_TARGET));
  eq('κενά: το κείμενο κρατά τα κενά του όσο γράφεται', withField(ins, f, 'ΔΕΗ ').provider, 'ΔΕΗ ');
}
{
  // Το όνομα στον τίτλο δεν πατά συγκεκριμένο ζεύγος τύπου και υποτύπου.
  const rent = doc({ doc_type: 'payment', subtype: 'rent_in', title: 'Απόδειξη είσπραξης ενοικίου βάσει μισθωτηρίου', confidence: 92 });
  eq('τίτλος: είσπραξη ενοικίου με «μισθωτηρίου» μένει είσπραξη', [classifyDocType(rent), normalizeScannedDoc({ ...rent, doc_type: classifyDocType(rent) }).subtype], ['payment', 'rent_in']);
  eq('τίτλος: «μισθωτηρίου» στη μέση δεν κάνει μισθωτήριο', classifyDocType(doc({ doc_type: 'payment', title: 'Απόδειξη πληρωμής βάσει μισθωτηρίου' })), 'payment');
  eq('τίτλος: στην αρχή υπερισχύει', classifyDocType(doc({ doc_type: 'bill', title: 'Μισθωτήριο κατοικίας' })), 'lease');
}
{
  // Ζεύγος στο τηλέφωνο μόνο για σύντομες τιμές.
  const rows = (v: DocKindId, c: Partial<ScannedDoc> = {}) => docForm(asKind(v, c))!.groups.flatMap(g => g.rows).filter(r => r.length > 1);
  const keysOf = (r: DocField[]) => r.map(f => f.key).join('+');
  const compact = (v: DocKindId, c?: Partial<ScannedDoc>) => rows(v, c).filter(compactRow).map(keysOf);
  const wide = (v: DocKindId, c?: Partial<ScannedDoc>) => rows(v, c).filter(r => !compactRow(r)).map(keysOf);
  check('ζεύγος: ποσό ποτέ σε δύο στήλες', kindIds.every(v => rows(v, { category: 'electricity' }).filter(compactRow).every(r => r.every(f => f.input !== 'money'))));
  check('ζεύγος: κείμενο ποτέ σε δύο στήλες', kindIds.every(v => rows(v, { category: 'electricity' }).filter(compactRow).every(r => r.every(f => f.input !== 'text'))));
  check('ζεύγος: Τίμημα και Αντικειμενική σε μία στήλη', wide('deed').includes('purchase_date+purchase_price') && wide('deed').includes('obj_value+atak'));
  check('ζεύγος: αριθμός παροχής σε μία στήλη', wide('bill', { category: 'electricity' }).includes('account_num+kwh'));
  check('ζεύγος: αριθμός συμβολαίου σε μία στήλη', wide('insurance').includes('policy_number+expiry_date'));
  check('ζεύγος: ημερομηνίες, ΑΦΜ και έτος σε δύο', compact('bill').includes('period_from+period_to') && compact('bill').includes('provider_afm+issue_date') && compact('e1').includes('tax_year+issue_date'));
}
{
  // Η κατηγορία ΠΕΑ αντικαθιστά μόνο από ισχύον πιστοποιητικό.
  eq('ΠΕΑ χωρίς λήξη: μόνο αν λείπει', [planDocSave(asKind('pea', { pea_class: 'A' }), TODAY).property, planDocSave(asKind('pea', { pea_class: 'A' }), TODAY).propertyReplace], [{ pea_class: 'A' }, undefined]);
  eq('ΠΕΑ ληγμένο: μόνο αν λείπει', planDocSave(asKind('pea', { pea_class: 'A', expiry_date: '2020-01-01' }), TODAY).propertyReplace, undefined);
  check('ΠΕΑ ληγμένο: «(μόνο κενά)»', docTargets(asKind('pea', { pea_class: 'A', expiry_date: '2020-01-01' }), true, TODAY).includes(`${PROPERTY_TARGET} (μόνο κενά)`));
  // Το ασφαλιστήριο αντικαθιστά μόνο με λήξη και μόνο νεότερη (ο έλεγχος στην καταχώρηση).
  const withExp = planDocSave(asKind('insurance', { provider: 'Interamerican', expiry_date: '2027-03-01' }), TODAY);
  eq('ασφαλιστήριο με λήξη: φρουρός η λήξη', withExp.replaceIfNewer, { column: 'insurance_expiry', value: '2027-03-01' });
  eq('ασφαλιστήριο με λήξη: αντικατάσταση', withExp.propertyReplace, { insurance_company: 'Interamerican', insurance_expiry: '2027-03-01' });
  const noExp = planDocSave(asKind('insurance', { provider: 'Interamerican', policy_number: 'Π-1' }), TODAY);
  eq('ασφαλιστήριο χωρίς λήξη: μόνο τα κενά', [noExp.settings, noExp.propertyReplace, noExp.settingsFill, noExp.property],
    [undefined, undefined, { insurance_company: 'Interamerican', insurance_policy: 'Π-1' }, { insurance_company: 'Interamerican' }]);
}
{
  // Τα ράφια με μία γραφή, κάτω από τον φάκελό τους.
  const opts = archiveOptions();
  eq('ράφια: ετικέτα κάτω από τον φάκελο', opts.find(o => o.value === 'Λογαριασμός Ρεύματος')!.label, 'Ρεύμα');
  eq('ράφια: με τον φάκελο όπου δεν φαίνεται η επικεφαλίδα', shelfPath('Λογαριασμός Ρεύματος'), 'Λογαριασμοί › Ρεύμα');
  check('ράφια: κάθε ετικέτα χωρά στο κουμπί του τηλεφώνου (έως 24 χαρακτήρες)', opts.every(o => o.label.length <= 24));
  eq('ράφια: φορολογικά', shelfPath('ΕΝΦΙΑ / Φορολογικά'), 'Φόροι και ΕΝΦΙΑ › Φορολογικά έγγραφα');
  check('ράφια: πρώτο γράμμα μόνο κεφαλαίο', opts.every(o => !/\s\p{Lu}\p{Ll}/u.test(o.label.replace(/ΕΝΦΙΑ/g, ''))));
  check('ράφια: κάθε ετικέτα μία φορά', new Set(opts.map(o => o.label)).size === opts.length);
}
check('χώρα εκδότη: κείμενο, όχι κωδικός', allFields(asKind('bill', { provider_country: 'IE' })).find(f => f.key === 'provider_country')!.input === 'text');
{
  // Τα πεδία του λογαριασμού: το ποσό πρώτο στη Χρέωση· στην απόδειξη πριν από την κατηγορία.
  eq('λογαριασμός: Ποσό και Λήξη πρώτα στη Χρέωση', docForm(asKind('bill', { category: 'electricity' }))!.groups[1].rows[0].map(f => f.key), ['amount', 'due_date']);
  const pay = docForm(asKind('payment'))!.groups[0].rows.map(r => r[0].key);
  check('απόδειξη: Ποσό πριν από Κατηγορία', pay.indexOf('amount') < pay.indexOf('category'));
}

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\ndocuments.ts — ${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n' + fails.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
console.log('✓ όλα πέρασαν');
