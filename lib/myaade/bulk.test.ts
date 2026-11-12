// npx tsx lib/myaade/bulk.test.ts
//
// Η μαζική καταχώρηση ακινήτων (απόφαση ιδιοκτήτη 09/11/2026): ο αναλυτής του
// Ε9, η αναγνώριση εγγράφου (Ε9, πράξη, Ε1), η πράξη του 2026, ο έλεγχος της
// απάντησης για φωτογραφία, το ταβάνι των 20 και η καταχώρηση με Τ.Κ. και έτος.
//
// ΜΟΝΟ ΣΥΝΘΕΤΙΚΑ ΣΤΟΙΧΕΙΑ (το φυλάει ο guard-fixture-identities): ΑΤΑΚ 999…,
// ΑΦΜ που δεν περνά τον έλεγχο ψηφίου, «ΠΑΡΑΔΕΙΓΜΑΤΟΣ», Τ.Κ. 10000. Η διάταξη
// είναι αυτή της πραγματικής εκτύπωσης (scripts/perf-bench/e9Fixture.ts).
import { readFileSync } from 'node:fs';
import { parseE9 } from './e9';
import { parseEnfiaAct } from './enfiaAct';
import { parseMyaadeLines, INCOME_TAX_REASON } from './parse';
import { parsePhotoReply, PHOTO_PROMPT, PHOTO_ASK, PHOTO_MAX_ROWS } from './photo';
import { detectDocKind } from './detect';
import { buildDrafts, bulkWindow, deriveReview, commitRowOf, BULK_MAX } from './review';
import { newPropertyRow, commitImport } from './commit';
import { fillOnlyEmpty } from './match';
import { fakeAtak } from './fixtures';
import { fakeE9Lines, type FakeE9Row } from '@/scripts/perf-bench/e9Fixture';
import { SCAN_SHAPE } from '@/lib/assistant/scanShape';
import { makeFakeDb } from '@/scripts/e2e-money/fakeDb';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MyAadeImport } from './types';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail?: unknown) {
  if (cond) pass++; else { fail++; console.error(`✗ ${name}${detail === undefined ? '' : `\n   ${JSON.stringify(detail)}`}`); }
}

/** Έγκυρο ΑΦΜ, φτιαγμένο τη στιγμή της δοκιμής από εμφανώς δοκιμαστική βάση. */
function validTestAfm(): string {
  const base = '0000000' + '2';
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(base[i]) * 2 ** (8 - i);
  return base + String((sum % 11) % 10);
}

const okDoc = (r: ReturnType<typeof parseE9>) => (r.status === 'ok' ? r.doc : null);
const rows3: FakeE9Row[] = [
  { n: 1, street: ['ΟΔΟΣ', 'ΠΑΡΑΔΕΙΓΜΑΤΟΣ', '(ΠΡΩΗΝ ΔΟΚΙΜΗΣ)'], floor: '2', sqm: '41,79', built: '2008' },
  { n: 2, place: ['ΑΤΤΙΚΗΣ', 'ΑΘΗΝΑΙΩΝ'], floor: '2', sqm: '54,24', built: '2008' },
  { n: 3, floor: '0', sqm: '1.042,02', built: '2008', cat: '3', aux: '6,50' },
];

// ── 1. Το Ε9 με τη διάταξη της πραγματικής εκτύπωσης ───────────────────
{
  const lines = fakeE9Lines(rows3);
  ok('αναγνώριση: Ε9', detectDocKind(lines) === 'e9');
  const d = okDoc(parseE9(lines));
  ok('τρία ακίνητα', d?.properties.length === 3, d?.properties.length);
  ok('είδος, πηγή, έτος, χωρίς ποσά ΕΝΦΙΑ', d?.kind === 'e9' && d.source === 'pdf' && d.year === 2026 && d.total === null && d.mainTax === null, d && [d.kind, d.year, d.total]);
  const [a, b, c] = d?.properties ?? [];
  ok('ΑΤΑΚ σε δύο γραμμές (6 + 5): ενώνεται', a?.atak === fakeAtak(1) && b?.atak === fakeAtak(2) && c?.atak === fakeAtak(3), d?.properties.map(p => p.atak));
  ok('οδός που τυλίγεται πάνω και κάτω, με αριθμό', a?.address === 'ΟΔΟΣ ΠΑΡΑΔΕΙΓΜΑΤΟΣ (ΠΡΩΗΝ ΔΟΚΙΜΗΣ) 11', a?.address);
  ok('νομός, δήμος, διαμέρισμα, Τ.Κ.', a?.prefecture === 'ΑΤΤΙΚΗΣ' && a.municipality === 'ΑΘΗΝΑΙΩΝ' && a.district === 'ΑΘΗΝΑΙΩΝ' && a.postcode === '10000', a);
  ok('χωρίς δήμο: δύο κελιά, κανένα διαμέρισμα', b?.municipality === 'ΑΘΗΝΑΙΩΝ' && b.district === null && !b.check, b);
  ok('υποδιαστολή με κόμμα: 41,79 και 1.042,02', a?.sqm === 41.79 && b?.sqm === 54.24 && c?.sqm === 1042.02, d?.properties.map(p => p.sqm));
  ok('ποσοστό από τρία κομμάτια «100,» «0000» «0»: 100', a?.ownershipPct === 100 && b?.ownershipPct === 100, d?.properties.map(p => p.ownershipPct));
  ok('όροφος, κατηγορία, έτος, δικαίωμα', a?.floor === '2' && c?.floor === '0' && c?.category === '3' && a?.yearBuilt === 2008 && a?.right === '1', [a, c]);
  ok('βοηθητικοί χώροι όταν τυπώνονται', c?.auxSqm === 6.5 && a?.auxSqm === null, [a?.auxSqm, c?.auxSqm]);
  ok('καμία προειδοποίηση, κανένα γήπεδο', d?.warnings.length === 0 && d?.landRows === 0, d?.warnings);
  ok('ΑΦΜ που δεν περνά τον έλεγχο: δεν κρατιέται', d?.afm === null);
  ok('ονοματεπώνυμο και αριθμός παροχής δεν περνούν πουθενά',
    !JSON.stringify(d).includes('ΠΑΠΑΔΟΠΟΥΛΟΣ') && !JSON.stringify(d).includes('123456789'));
}

// ── 2. Ακραίες περιπτώσεις ────────────────────────────────────────────
{
  const afm = validTestAfm();
  ok('έγκυρο ΑΦΜ υπόχρεου: μόνο για τον έλεγχο «άλλος ΑΦΜ»', okDoc(parseE9(fakeE9Lines(rows3, { afm })))?.afm === afm);

  const noPct = okDoc(parseE9(fakeE9Lines([{ n: 1 }, { n: 2, pct: null }])));
  ok('ποσοστό που δεν τυπώθηκε: null και ΠΟΤΕ 100· η γραμμή θέλει έλεγχο',
    noPct?.properties[1].ownershipPct === null && noPct.properties[1].check && noPct.properties[0].ownershipPct === 100, noPct?.properties.map(p => [p.ownershipPct, p.check]));
  ok('και λέγεται με τον αριθμό', !!noPct?.warnings.some(w => w.includes('1 ακίνητο') && w.includes('ποσοστό συνιδιοκτησίας')), noPct?.warnings);

  const half = okDoc(parseE9(fakeE9Lines([{ n: 1, pct: ['50,', '0000', '0'] }])));
  ok('μισό ποσοστό: 50', half?.properties[0].ownershipPct === 50, half?.properties[0].ownershipPct);

  const one = okDoc(parseE9(fakeE9Lines([{ n: 4, atakOneLine: true }])));
  ok('ΑΤΑΚ σε μία γραμμή: διαβάζεται επίσης', one?.properties[0].atak === fakeAtak(4), one?.properties[0]);

  const land = okDoc(parseE9(fakeE9Lines(rows3, { land: 2 })));
  ok('Πίνακας 2: μετριέται, δεν περνά ως ακίνητο', land?.landRows === 2 && land.properties.length === 3, [land?.landRows, land?.properties.length]);
  const onlyLand = parseE9(fakeE9Lines([], { land: 1 }));
  ok('Ε9 μόνο με γήπεδα: άρνηση που το λέει', onlyLand.status === 'unrecognized' && onlyLand.reason.includes('γήπεδα'), onlyLand);
  const empty = parseE9(fakeE9Lines([]));
  ok('Ε9 χωρίς ακίνητα: «δεν αναγνωρίστηκε», όχι άδειο αποτέλεσμα', empty.status === 'unrecognized' && empty.kind === 'e9');

  const dup = okDoc(parseE9(fakeE9Lines([{ n: 1 }, { n: 1 }])));
  ok('ο ίδιος ΑΤΑΚ δύο φορές: μία γραμμή, με ένδειξη', dup?.properties.length === 1 && !!dup.warnings.some(w => w.includes('δύο φορές')));
}

// ── 3. Ποιο έγγραφο: Ε9, πράξη ή Ε1 ───────────────────────────────────
{
  ok('το Ε9 περνά από τον αναλυτή του Ε9', (() => { const r = parseMyaadeLines(fakeE9Lines(rows3)); return r.status === 'ok' && r.doc.kind === 'e9'; })());
  const e1 = parseMyaadeLines([
    'ΑΝΕΞΑΡΤΗΤΗ ΑΡΧΗ ΔΗΜΟΣΙΩΝ ΕΣΟΔΩΝ', 'ΠΡΑΞΗ ΔΙΟΙΚΗΤΙΚΟΥ ΠΡΟΣΔΙΟΡΙΣΜΟΥ ΦΟΡΟΥ ΕΙΣΟΔΗΜΑΤΟΣ', 'ΕΚΚΑΘΑΡΙΣΤΙΚΟ ΣΗΜΕΙΩΜΑ', 'ΦΟΡΟΛΟΓΙΚΟ ΕΤΟΣ\t2025',
  ]);
  ok('Ε1: άρνηση με το όνομά του', e1.status === 'unrecognized' && e1.kind === 'unknown' && e1.reason === INCOME_TAX_REASON, e1);
  const other = parseMyaadeLines(['ΛΟΓΑΡΙΑΣΜΟΣ ΡΕΥΜΑΤΟΣ', 'ΠΟΣΟ ΠΛΗΡΩΜΗΣ\t45,00']);
  ok('άλλο έγγραφο: άρνηση με λόγο', other.status === 'unrecognized' && other.kind === 'unknown' && other.reason.length > 10);
}

// ── 4. Η πράξη του 2026: σύνολο από τα ΣΥΝΟΛΑ, όχι από το «ΠΛΗΡΩΤΕΟ ΜΕΧΡΙ» ─
// Η διάταξη της πραγματικής πράξης (09/11/2026), με συνθετικά στοιχεία.
{
  const row = (n: number, tax: string) => [
    'ΑΤΤΙΚΗΣ, ΑΘΗΝΑΙΩΝ, ΟΔΟΣ',
    [String(n), fakeAtak(n), `ΠΑΡΑΔΕΙΓΜΑΤΟΣ, ${10 + n}, 10000`, '2', '1', '1', String(n), `${60 + n},00`, '1990', '1 100,00000', 'NAI', '1.000,00', tax, '50.000,00'].join('\t'),
  ];
  const instalment = (k: number, date: string) => `${k}\t${date}\t18,75 €`;
  const lines = [
    'Ε Ν Φ Ι Α', 'Υ Π Η Ρ Ε Τ Ο Υ Μ Ε Π Ι Σ Τ Α\tΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ\t2026', 'Ημερομηνία Εκτύπωσης: 09.11.2026',
    'ΠΡΑΞΗ ΔΙΟΙΚΗΤΙΚΟΥ ΠΡΟΣΔΙΟΡΙΣΜΟΥ ΕΝΦΙΑ', 'ΣΤΟΙΧΕΙΑ ΦΟΡΟΛΟΓΟΥΜΕΝΟΥ', 'ΑΡΙΘΜΟΣ ΦΟΡΟΛΟΓΙΚΟΥ ΜΗΤΡΩΟΥ (ΑΦΜ)\t123456789',
    'ΕΠΩΝΥΜΟ\tΠΑΠΑΔΟΠΟΥΛΟΣ', 'ΟΝΟΜΑ\tΓΕΩΡΓΙΟΣ', 'ΗΜΕΡΟΜΗΝΙΑ ΕΚΔΟΣΗΣ ΠΡΑΞΗΣ\t15.03.2026', 'ΣΤΟΙΧΕΙΑ ΕΚΚΑΘΑΡΙΣΗΣ ΕΝΦΙΑ 2026',
    'Πίνακας\tΠλήθος\tΑξία\tΚύριος Φόρος\tΈκπτωση/Προσαύξηση\tΈκπτωση\tΠοσό', '1\t2\t100.000,00 €\t300,00 €', '2',
    'ΣΥΝΟΛΑ\t2\t100.000,00 €\t300,00 €\t-75,00 €\t225,00 €', 'ΤΕΛΙΚΟ ΕΝΦΙΑΠΟΣΟ', 'Α/Α δόσης\tΠροθεσμία\tΠοσό',
    `225,00 €\t${instalment(1, '31.03.2026')}`, instalment(2, '30.04.2026'), 'ΤΑΥΤΟΤΗΤΑ ΟΦΕΙΛΗΣ',
    `ΠΛΗΡΩΤΕΟ ΜΕΧΡΙ\t${instalment(11, '29.01.2027')}`, instalment(12, '26.02.2027'), '31.03.2026',
    'ΣΤΟΙΧΕΙΑ ΟΙΚΟΠΕΔΩΝ (εντός σχεδίου ή οικισμού) ΚΑΙ ΚΤΙΣΜΑΤΩΝ (εντός & εκτός σχεδίου) - ΠΙΝΑΚΑΣ 1 ΕΝΤΥΠΟΥ Ε9',
    ...row(1, '150,00'), ...row(2, '150,00'),
    'ΣΤΟΙΧΕΙΑ ΓΗΠΕΔΩΝ - ΠΙΝΑΚΑΣ 2 ΕΝΤΥΠΟΥ Ε9', 'ΔΕΝ ΔΗΛΩΘΗΚΑΝ ΑΚΙΝΗΤΑ ΣΤΟΝ ΠΙΝΑΚΑ 2 ΕΝΤΥΠΟΥ Ε9',
  ];
  const r = parseEnfiaAct(lines);
  const d = r.status === 'ok' ? r.doc : null;
  ok('πράξη 2026: αναγνωρίζεται', !!d, r);
  ok('πράξη 2026: σύνολο η τελευταία στήλη των ΣΥΝΟΛΩΝ, όχι το ποσό της 11ης δόσης', d?.total === 225, d?.total);
  ok('πράξη 2026: κύριος φόρος από τα ΣΥΝΟΛΑ, κανένας συμπληρωματικός', d?.mainTax === 300 && d.supplementaryTax === null, [d?.mainTax, d?.supplementaryTax]);
  ok('πράξη 2026: η λήξη της 11ης δόσης δεν γίνεται «πρώτη προθεσμία»', d?.firstDueDate !== '2027-01-29', d?.firstDueDate);
  ok('πράξη 2026: έτος και ημερομηνία έκδοσης', d?.year === 2026 && d.issueDate === '2026-03-15', [d?.year, d?.issueDate]);
  const [a] = d?.properties ?? [];
  ok('πράξη 2026: οδός από δύο γραμμές, με αριθμό, χωρίς Τ.Κ.', a?.address === 'ΟΔΟΣ ΠΑΡΑΔΕΙΓΜΑΤΟΣ 11' && a.postcode === '10000' && a.municipality === 'ΑΘΗΝΑΙΩΝ', a);
  ok('πράξη 2026: τ.μ., όροφος, ποσοστό, φόρος, έτος, κατηγορία, δικαίωμα',
    a?.sqm === 61 && a.floor === '1' && a.ownershipPct === 100 && a.tax === 150 && a.yearBuilt === 1990 && a.category === '1' && a.right === '1' && !a.check, a);
  ok('πράξη 2026: ο φόρος ανά ακίνητο συμφωνεί με τον κύριο φόρο', !d?.warnings.some(w => w.includes('αθροίζουν')), d?.warnings);
}

// ── 5. Φωτογραφία: αυστηρός έλεγχος της απάντησης ─────────────────────
{
  ok('prompt και οδηγία χωρούν στο σχήμα της σάρωσης',
    PHOTO_PROMPT.length < SCAN_SHAPE.maxSystemChars && PHOTO_ASK.length < SCAN_SHAPE.maxTextChars, [PHOTO_PROMPT.length, PHOTO_ASK.length]);
  ok('το prompt ζητά έως 20 γραμμές, όσες η εισαγωγή', PHOTO_MAX_ROWS === BULK_MAX && PHOTO_PROMPT.includes(`έως ${BULK_MAX}`));
  const e1 = parsePhotoReply({ doc: 'other', other: 'Εκκαθαριστικό φόρου εισοδήματος Ε1', rows: [] }, 2026);
  ok('φωτογραφία Ε1: άρνηση με το όνομά του', e1.status === 'unrecognized' && e1.kind === 'unknown' && e1.reason === INCOME_TAX_REASON, e1);
  const bill = parsePhotoReply({ doc: 'other', other: 'Λογαριασμός ρεύματος' }, 2026);
  ok('άλλη φωτογραφία: λέει τι δείχνει', bill.status === 'unrecognized' && bill.reason.includes('Λογαριασμός ρεύματος'), bill);
  ok('απάντηση που δεν είναι αντικείμενο: άρνηση', parsePhotoReply('κείμενο', 2026).status === 'unrecognized' && parsePhotoReply(null, 2026).status === 'unrecognized');
  const r = parsePhotoReply({
    doc: 'e9', year: 2026, count: 2, total: 999, rows: [
      { atak: `${fakeAtak(1).slice(0, 6)} ${fakeAtak(1).slice(6)}`, dimos: 'ΑΘΗΝΑΙΩΝ', street: 'ΠΑΡΑΔΕΙΓΜΑΤΟΣ', no: '11', tk: '10000', floor: 2, sqm: '41,79', built: 2008, right: '1', pct: '100,00' },
      { atak: '12345', street: 'ΠΑΡΑΔΕΙΓΜΑΤΟΣ', no: 12, sqm: 120000, pct: 140, built: 3000, tk: '1000', floor: 'πολύ ψηλά' },
    ],
  }, 2026);
  const d = r.status === 'ok' ? r.doc : null;
  ok('φωτογραφία Ε9: δύο γραμμές, πηγή «photo», ΚΑΝΕΝΑ ποσό ΕΝΦΙΑ από Ε9', d?.properties.length === 2 && d.source === 'photo' && d.total === null && d.kind === 'e9', d);
  const [a, b] = d?.properties ?? [];
  ok('ΑΤΑΚ με κενό στη μέση: ενώνεται· κόμμα σε κείμενο: αριθμός', a?.atak === fakeAtak(1) && a.sqm === 41.79 && a.ownershipPct === 100 && a.floor === '2' && a.yearBuilt === 2008 && !a.check, a);
  ok('ό,τι δεν στέκει γίνεται null και θέλει έλεγχο', b?.atak === null && b.sqm === null && b.ownershipPct === null && b.yearBuilt === null && b.postcode === null && b.floor === null && b.check, b);
  ok('και λέγεται: ΑΤΑΚ και ποσοστό', !!d?.warnings.some(w => w.includes('ΑΤΑΚ')) && !!d?.warnings.some(w => w.includes('ποσοστό')), d?.warnings);
  const many = parsePhotoReply({ doc: 'enfia_act', count: 25, total: '843,20', rows: Array.from({ length: 30 }, (_, i) => ({ atak: fakeAtak(i + 1), sqm: 50, pct: 100 })) }, 2026);
  const m = many.status === 'ok' ? many.doc : null;
  ok('φωτογραφία πράξης: έως 20 γραμμές, «found» 25, σύνολο από την απάντηση για έλεγχο', m?.properties.length === PHOTO_MAX_ROWS && m.found === 25 && m.total === 843.2, m && [m.properties.length, m.found, m.total]);
  ok('φωτογραφία χωρίς ακίνητα: άρνηση, όχι άδεια λίστα', parsePhotoReply({ doc: 'e9', rows: [] }, 2026).status === 'unrecognized');
}

// ── 6. Ταβάνι: έως 20 ανά εισαγωγή, μέσα στο όριο του πακέτου ────────
{
  const big = okDoc(parseE9(fakeE9Lines(Array.from({ length: 23 }, (_, i) => ({ n: i + 1 })))));
  ok('23 ακίνητα στο Ε9: διαβάζονται όλα', big?.properties.length === 23, big?.properties.length);
  const doc = big as MyAadeImport;
  const w = bulkWindow(doc, []);
  ok('φαίνονται τα πρώτα 20, μένουν 3', w.shown.length === BULK_MAX && w.hidden === 3 && w.total === 23 && w.shown[0] === 0 && w.shown[19] === 19, w);
  const drafts = buildDrafts(doc, [], 5);
  ok('με όριο πακέτου 5: 20 γραμμές, τσεκαρισμένες οι 5, οι 15 «εκτός πακέτου»',
    drafts.length === BULK_MAX && drafts.filter(r => r.include).length === 5 && drafts.filter(r => r.overPlan).length === 15, drafts.map(r => r.include));
  const rv = deriveReview({ rows: drafts, year: '2026', total: '', slots: 5, left: 5, owners: [], ownerId: null, dailyLimit: 10, currentYear: 2026 });
  ok('και καμία αντίρρηση: 5 νέα, 15 εκτός', !rv.blockers.length && rv.newCount === 5 && rv.leftOut === 15 && !rv.writesTotal, rv.blockers);
  // Η ΔΕΥΤΕΡΗ ΕΙΣΑΓΩΓΗ ΔΕΙΧΝΕΙ ΤΑ ΕΠΟΜΕΝΑ: όσα πέρασαν αναγνωρίζονται από τον ΑΤΑΚ.
  const known = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, name: `Α${i}`, address: null, atak: fakeAtak(i + 1) }));
  const w2 = bulkWindow(doc, known);
  ok('δεύτερη εισαγωγή: μπαίνουν σίγουρα τα 3 που λείπουν', w2.shown.filter(i => i >= 20).length === 3 && w2.shown.length === BULK_MAX, w2);
  const d2 = buildDrafts(doc, known, Infinity);
  ok('…και μετά όσα υπάρχουν, για να συμπληρωθούν τα κενά τους', d2.filter(r => r.match.status === 'new').length === 3 && d2.length === BULK_MAX, d2.map(r => r.match.status));
  const found = bulkWindow({ ...doc, properties: doc.properties.slice(0, 20), found: 25 }, []);
  ok('έγγραφο με 25 όπου δόθηκαν 20 (φωτογραφία): μένουν 5', found.hidden === 5 && found.total === 25, found);
}

// ── 7. Η καταχώρηση: Τ.Κ., έτος, είδος εισαγωγής ─────────────────────
async function commitChecks() {
  const doc = okDoc(parseE9(fakeE9Lines(rows3))) as MyAadeImport;
  const drafts = buildDrafts(doc, [], Infinity);
  const row = commitRowOf(drafts[0]);
  ok('η γραμμή φεύγει με Τ.Κ. και έτος', row.postalCode === '10000' && row.yearBuilt === 2008 && row.ownershipPct === 100, row);
  const db = newPropertyRow('u', row);
  ok('και φτάνει έτσι στη βάση', db.postal_code === '10000' && db.year_built === 2008 && db.atak === fakeAtak(1) && db.floor === '2', db);
  ok('Τ.Κ. ή έτος εκτός μορφής: δεν γράφονται', (() => { const r = newPropertyRow('u', { ...row, postalCode: '123', yearBuilt: 1700 }); return !('postal_code' in r) && !('year_built' in r); })());
  const bad = deriveReview({ rows: drafts.map((r, i) => (i ? r : { ...r, postcode: '12', yearBuilt: '2099' })), year: '2026', total: '', slots: Infinity, left: 5, owners: [], ownerId: null, dailyLimit: 10, currentYear: 2026 });
  ok('Τ.Κ. και έτος που δεν στέκουν: εμπόδια με λόγο', bad.blockers.some(b => b.id === 'postcode') && bad.blockers.some(b => b.id === 'built'), bad.blockers);
  ok('υπάρχον ακίνητο: Τ.Κ. και έτος μόνο αν λείπουν',
    JSON.stringify(fillOnlyEmpty({ id: 'x', name: 'x', address: 'α', atak: null, postal_code: '', year_built: null }, { atak: null, sqm: null, floor: null, address: null, postalCode: '10000', yearBuilt: 2008 })) === JSON.stringify({ postal_code: '10000', year_built: 2008 })
    && !Object.keys(fillOnlyEmpty({ id: 'x', name: 'x', address: 'α', atak: null, postal_code: '11111', year_built: 1990 }, { atak: null, sqm: null, floor: null, address: null, postalCode: '10000', yearBuilt: 2008 })).length
    && !Object.keys(fillOnlyEmpty({ id: 'x', name: 'x', address: 'α', atak: null }, { atak: null, sqm: null, floor: null, address: null, postalCode: '10000', yearBuilt: 2008 })).length);

  let n = 0;
  const fake = makeFakeDb(c => {
    if (c.table === 'myaade_imports' && c.op === 'insert') return { data: { id: 'b1' }, error: null };
    if (c.table === 'user_properties' && c.op === 'insert') return { data: { id: `new${n++}` }, error: null };
    return undefined;
  });
  const out = await commitImport(fake.db as unknown as SupabaseClient, {
    userId: 'u1', kind: 'e9', year: doc.year, total: null, foundCount: drafts.length, rows: drafts.map(commitRowOf), known: [], docDate: '2026-11-09',
  });
  const imp = fake.calls.find(c => c.table === 'myaade_imports' && c.op === 'insert');
  ok('Ε9: η εισαγωγή καταγράφεται ως «e9», τρία νέα ακίνητα, κανένα σύνολο ΕΝΦΙΑ',
    out.ok && out.created.length === 3 && out.statement === 'none' && (imp?.payload as { kind?: string })?.kind === 'e9'
    && !fake.calls.some(c => c.table === 'property_documents' && c.op === 'insert'), { out, imp: imp?.payload });
}

// ── 8. Η διεύθυνση μένει σε κεφαλαία, όπως την τυπώνει η ΑΑΔΕ ────────
// Τα πεζά θα ήθελαν τόνους που δεν βγαίνουν από τα κεφαλαία (review.ts, suggestName).
{
  const doc = okDoc(parseE9(fakeE9Lines([{ n: 1, street: ['ΟΔΟΣ', 'ΠΑΡΑΔΕΙΓΜΑΤΟΣ', '(ΑΝΩΝΥΜΟΣ)'], floor: '2' }]))) as MyAadeImport;
  const want = 'ΟΔΟΣ ΠΑΡΑΔΕΙΓΜΑΤΟΣ (ΑΝΩΝΥΜΟΣ) 11';
  const d = buildDrafts(doc, [], Infinity)[0];
  ok('κεφαλαία: η διεύθυνση της γραμμής όπως στο έγγραφο', d?.address === want, d?.address);
  ok('κεφαλαία: το όνομα κρατά τη διεύθυνση αυτούσια, χωρίς πεζά χωρίς τόνο', d?.name.includes(want) && !/Ανωνυμος|Οδος|Παραδειγματος/.test(d.name), d?.name);
  const db = newPropertyRow('u', commitRowOf(d));
  ok('κεφαλαία: έτσι φτάνει και στη βάση', db.address === want && String(db.name).includes(want), db);
  ok('κεφαλαία: ο δήμος μένει «ΑΘΗΝΑΙΩΝ» (όχι «Αθηναιων»)', doc.properties[0].municipality === 'ΑΘΗΝΑΙΩΝ', doc.properties[0].municipality);
}

// ── 9. Βοηθητικοί χώροι και ΕΝΦΙΑ ανά ακίνητο ──────────────────────────
// Οι βοηθητικοί του Ε9 → `storage_sqm`, όπως η σάρωση Ε9. Ο φόρος της γραμμής
// της πράξης → `enfia` του ακινήτου (απόφαση 12/11/2026). Το σύνολο ανά ΑΦΜ
// διαβάζεται ΜΟΝΟ από τα σύνολα (enfiaTotals.ts), ποτέ από αυτή τη στήλη.
{
  const doc = okDoc(parseE9(fakeE9Lines(rows3))) as MyAadeImport;
  const drafts = buildDrafts(doc, [], Infinity);
  ok('βοηθητικοί: στο πεδίο της Επεξεργασίας, με κόμμα', drafts[2]?.storageSqm === '6,5' && drafts[0]?.storageSqm === '', drafts.map(d => d.storageSqm));
  const row = commitRowOf(drafts[2]);
  ok('βοηθητικοί: φεύγουν με τη γραμμή, Ε9 χωρίς ΕΝΦΙΑ', row.storageSqm === 6.5 && row.enfia === null, row);
  ok('βοηθητικοί: στο νέο ακίνητο ως storage_sqm', newPropertyRow('u', row).storage_sqm === 6.5);
  ok('βοηθητικοί: διόρθωση στην Επεξεργασία', newPropertyRow('u', commitRowOf({ ...drafts[2], storageSqm: '8,25' })).storage_sqm === 8.25);
  ok('βοηθητικοί: κενό ή μηδέν δεν γράφεται', !('storage_sqm' in newPropertyRow('u', commitRowOf(drafts[0]))) && !('storage_sqm' in newPropertyRow('u', commitRowOf({ ...drafts[2], storageSqm: '0' }))));

  const found = { atak: null, sqm: null, floor: null, address: null, storageSqm: 6.5, enfia: 150 };
  const base = { id: 'x', name: 'x', address: 'α', atak: null };
  ok('υπάρχον: βοηθητικοί και ΕΝΦΙΑ μόνο αν λείπουν',
    JSON.stringify(fillOnlyEmpty({ ...base, storage_sqm: null, enfia: 0 }, found)) === JSON.stringify({ storage_sqm: 6.5, enfia: 150 })
    && !Object.keys(fillOnlyEmpty({ ...base, storage_sqm: 4, enfia: 99.9 }, found)).length);
  ok('υπάρχον: χωρίς τις στήλες (δεν διαβάστηκαν) δεν αγγίζονται', !Object.keys(fillOnlyEmpty(base, found)).length);

  const act = buildDrafts({ ...doc, kind: 'enfia_act', total: 300, properties: doc.properties.map((p, i) => ({ ...p, tax: i === 0 ? 150 : i === 1 ? 150 : null })) }, [], Infinity);
  const actRows = act.map(commitRowOf);
  ok('πράξη: ο φόρος κάθε γραμμής, αυτούσιος, όχι το σύνολο', actRows[0].enfia === 150 && actRows[1].enfia === 150 && actRows[2].enfia === null, actRows.map(r => r.enfia));
  ok('πράξη: στο νέο ακίνητο ως enfia', newPropertyRow('u', actRows[0]).enfia === 150 && !('enfia' in newPropertyRow('u', actRows[2])));

  // Η στήλη ανά ακίνητο δεν διαβάζεται από τον υπολογισμό των δόσεων: αλλιώς
  // το σύνολο θα μετρούσε δεύτερη φορά.
  const totalsSrc = readFileSync('lib/calendar/enfiaTotals.ts', 'utf8').replace(/\/\/.*$/gm, '');
  ok('enfiaTotals.ts: καμία ανάγνωση του user_properties.enfia', !/\.enfia\b|['",\s]enfia['",\s]|user_properties|propertyEnfia/.test(totalsSrc));
}

commitChecks().then(() => {
  console.log(fail === 0 ? `✓ μαζική καταχώρηση: ${pass} έλεγχοι πέρασαν` : `✗ μαζική καταχώρηση: ${fail} απέτυχαν από ${pass + fail}`);
  process.exit(fail ? 1 : 0);
});
