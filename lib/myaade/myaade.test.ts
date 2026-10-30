// npx tsx lib/myaade/myaade.test.ts
//
// Η εισαγωγή από το myAADE: αναλυτής της πράξης ΕΝΦΙΑ πάνω σε ΣΥΝΘΕΤΙΚΑ
// έγγραφα (κείμενο και PDF), «δεν αναγνωρίστηκε» αντί για λάθος αριθμούς,
// ταίριασμα με τα ακίνητα της εφαρμογής, όριο πακέτου, αντικατάσταση του
// συνόλου από διορθωτική πράξη και το παράθυρο αναίρεσης.
import { readFileSync, readdirSync } from 'node:fs';
import { extractPdfText } from '@/lib/pdf/pdfText';
import { enfiaTotalsByProperty } from '@/lib/calendar/enfiaTotals';
import { PAY_UNDO_HOURS } from '@/lib/reminders/payLink';
import { parseEnfiaAct } from './enfiaAct';
import { detectDocKind } from './detect';
import { isValidRf, rfCompact } from './rf';
import { matchProperty, addressKey, fillOnlyEmpty, type KnownProperty } from './match';
import { freeSlots, overLimit, excessOf } from './planLimit';
import { planStatement } from './statement';
import { canUndoImport, newPropertyRow, statementDocRow, MYAADE_DAILY_IMPORTS, IMPORT_UNDO_HOURS } from './commit';
import PDFDocument from 'pdfkit';
import { fakeAtak } from './fixtures';

// ═══════════════════════════════════════════════════════════════════════════
// ΣΥΝΘΕΤΙΚΕΣ ΠΡΑΞΕΙΣ ΕΝΦΙΑ: ΠΟΤΕ ΠΡΑΓΜΑΤΙΚΑ ΣΤΟΙΧΕΙΑ
// ─────────────────────────────────────────────────────────────────────────
// Το αποθετήριο είναι δημόσιο. Καμία πραγματική πράξη δεν μπαίνει εδώ: τα
// αρχεία του ιδιοκτήτη ζουν στο `local-samples/`, που το αγνοεί το git. Τα PDF
// των δοκιμών παράγονται όταν τρέχει η δοκιμή, με pdfkit.
//
// Η ΔΙΑΤΑΞΗ ΕΙΝΑΙ ΥΠΟΘΕΣΗ, όπως και οι ετικέτες του `labels.ts`: κεφαλίδα με
// «Ετικέτα: τιμή», ο Πίνακας 1 με μία γραμμή ανά ΑΤΑΚ και τα ποσά στο τέλος.
// Να επιβεβαιωθεί με πραγματικό PDF· τότε αλλάζει αυτή η γεννήτρια.
//
// ΤΑ ΣΤΟΙΧΕΙΑ ΕΙΝΑΙ ΕΜΦΑΝΩΣ ΨΕΥΤΙΚΑ (το φυλάει ο guard-fixture-identities):
//   · ΑΦΜ που ΔΕΝ περνά τον έλεγχο ψηφίου (`FAKE_AFM`). Όπου χρειάζεται
//     έγκυρο, φτιάχνεται τη στιγμή της δοκιμής (`validTestAfm`).
//   · ΑΤΑΚ με το πρόθεμα `999` (`fakeAtak`).
//   · Διεύθυνση «Οδός Παραδείγματος» (η σύμβαση του guard-private-street).
//   · Ταυτότητα Οφειλής μόνο τη στιγμή της δοκιμής (`rfFor`).
// ═══════════════════════════════════════════════════════════════════════════

/** ΑΦΜ που δεν περνά τον έλεγχο ψηφίου: δεν μπορεί να είναι κανενός. */
const FAKE_AFM = '123456789';

/** Έγκυρο ΑΦΜ, φτιαγμένο τη στιγμή της δοκιμής από εμφανώς δοκιμαστική βάση. */
function validTestAfm(): string {
  const base = '0000000' + '1';
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(base[i]) * 2 ** (8 - i);
  return base + String((sum % 11) % 10);
}

/** Έγκυρη Ταυτότητα Οφειλής των δοκιμών, φτιαγμένη τη στιγμή της δοκιμής. */
const testRf = (): string => rfFor('TEST' + 'ONLY' + '0001');

interface FakeProperty {
  atak: string; address: string; municipality: string; kind: string; floor: string; sqm: string; pct: string; tax: string;
}

const fakeProperty = (n: number, tax: string, over: Partial<FakeProperty> = {}): FakeProperty => ({
  atak: fakeAtak(n), address: `Οδός Παραδείγματος ${10 + n}`, municipality: 'Δήμος Δοκιμής',
  kind: 'Διαμέρισμα', floor: String(n), sqm: `${60 + n},00`, pct: '100,00', tax, ...over,
});

interface ActOptions {
  year?: number;
  afm?: string;
  corrective?: boolean;
  properties?: FakeProperty[];
  payable?: string | null;
  gross?: string | null;
  instalments?: string | null;
  rf?: string | null;
  /** Χωρίς γραμμή επικεφαλίδων στον πίνακα: ο αναλυτής πέφτει στη μορφή των τιμών. */
  noHeader?: boolean;
}

const TABLE_HEADER = ['Α.Τ.ΑΚ.', 'Διεύθυνση', 'Δήμος / Δ. Κοινότητα', 'Είδος', 'Όροφος', 'Επιφάνεια (τ.μ.)', 'Ποσοστό', 'Φόρος'];

/** Οι γραμμές μιας πράξης όπως θα τις έβγαζε το `extractPdfText`: στήλες με tab. */
function enfiaActLines(o: ActOptions = {}): string[] {
  const year = o.year ?? 2026;
  const props = o.properties ?? [fakeProperty(1, '412,30'), fakeProperty(2, '430,90')];
  const lines = [
    'ΑΝΕΞΑΡΤΗΤΗ ΑΡΧΗ ΔΗΜΟΣΙΩΝ ΕΣΟΔΩΝ',
    `${o.corrective ? 'ΔΙΟΡΘΩΤΙΚΗ ' : ''}ΔΗΛΩΣΗ ΕΝΦΙΑ - ΠΡΑΞΗ ΠΡΟΣΔΙΟΡΙΣΜΟΥ ΦΟΡΟΥ ΕΤΟΥΣ ${year}`,
    `Φορολογικό έτος:\t${year}`,
    `Α.Φ.Μ.:\t${o.afm ?? FAKE_AFM}`,
    'Ονοματεπώνυμο:\tΔΟΚΙΜΑΣΤΙΚΟΣ ΦΟΡΟΛΟΓΟΥΜΕΝΟΣ',
    `Ημερομηνία έκδοσης:\t15/03/${year}`,
    'ΠΙΝΑΚΑΣ 1. ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΩΝ',
  ];
  if (!o.noHeader) lines.push(TABLE_HEADER.join('\t'));
  for (const p of props) lines.push([p.atak, p.address, p.municipality, p.kind, p.floor, p.sqm, p.pct, p.tax].join('\t'));
  if (o.gross !== null) lines.push(`Συνολικός φόρος:\t${o.gross ?? '843,20'}`);
  if (o.payable !== null) lines.push(`Ποσό για καταβολή:\t${o.payable ?? '843,20'}`);
  if (o.instalments !== null) lines.push(`Αριθμός δόσεων:\t${o.instalments ?? '12'}`);
  if (o.rf !== null && o.rf !== undefined) lines.push(`Ταυτότητα Οφειλής:\t${o.rf}`);
  return lines;
}

/**
 * Το ίδιο κείμενο ως πραγματικό PDF, με γραμματοσειρά Type0 και χάρτη
 * ToUnicode (Roboto), όπως τα PDF του myAADE. Κάθε κελί σε δική του στήλη, ώστε
 * το `extractPdfText` να ξαναβρεί τα tab.
 */
function enfiaActPdf(lines: readonly string[], opts: { pagesOf?: number } = {}): Promise<Uint8Array> {
  const ROBOTO = 'node_modules/pdfmake/fonts/Roboto/Roboto-Regular.ttf';
  return new Promise(resolve => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 20 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.font(ROBOTO).fontSize(7);
    const COL = 100;
    let y = 30;
    lines.forEach((line, i) => {
      if (opts.pagesOf && i > 0 && i % opts.pagesOf === 0) { doc.addPage(); doc.font(ROBOTO).fontSize(7); y = 30; }
      line.split('\t').forEach((cell, k) => doc.text(cell, 20 + k * COL, y, { lineBreak: false }));
      y += 14;
    });
    doc.end();
  });
}

/** Ένα PDF χωρίς κείμενο: μόνο γραφικά, όπως μια σάρωση. */
function imageOnlyPdf(): Promise<Uint8Array> {
  return new Promise(resolve => {
    const doc = new PDFDocument({ size: 'A4', margin: 20 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.rect(40, 40, 200, 100).fill('#888888');
    doc.end();
  });
}

/** Τα ψηφία ελέγχου για ένα σώμα αναφοράς: για τα συνθετικά fixtures και τις δοκιμές. */
function rfFor(body: string): string {
  const b = rfCompact(body);
  for (let c = 0; c < 100; c++) {
    const candidate = `RF${String(c).padStart(2, '0')}${b}`;
    if (isValidRf(candidate)) return candidate;
  }
  throw new Error('αδύνατη αναφορά');
}

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail?: unknown) {
  if (cond) pass++; else { fail++; console.error(`✗ ${name}${detail === undefined ? '' : `\n   ${JSON.stringify(detail)}`}`); }
}
const okDoc = (r: ReturnType<typeof parseEnfiaAct>) => (r.status === 'ok' ? r.doc : null);

async function run() {
  // ── 1. Η βασική πράξη, από κείμενο ─────────────────────────────────────
  {
    const doc = okDoc(parseEnfiaAct(enfiaActLines()));
    ok('η πράξη αναγνωρίζεται', !!doc);
    ok('έτος από την ετικέτα', doc?.year === 2026, doc?.year);
    ok('σύνολο από το «Ποσό για καταβολή»', doc?.total === 843.2, doc?.total);
    ok('δύο ακίνητα', doc?.properties.length === 2);
    const p = doc?.properties[0];
    ok('ΑΤΑΚ, διεύθυνση, Δήμος, είδος, όροφος κατά στήλη',
      p?.atak === fakeAtak(1) && p?.address === 'Οδός Παραδείγματος 11' && p?.municipality === 'Δήμος Δοκιμής'
      && p?.kind === 'Διαμέρισμα' && p?.floor === '1', p);
    ok('τ.μ., ποσοστό και φόρος ως αριθμοί', p?.sqm === 61 && p?.ownershipPct === 100 && p?.tax === 412.3, p);
    ok('από επικεφαλίδα: χωρίς σημαία ελέγχου', p?.check === false);
    ok('ΑΦΜ που δεν περνά τον έλεγχο: κανένα ΑΦΜ και προειδοποίηση',
      doc?.afm === null && !!doc?.warnings.some(w => w.includes('ΑΦΜ')), doc?.warnings);
    ok('οι δόσεις που τυπώνονται κρατιούνται μόνο για σύγκριση', doc?.printedInstalments?.count === 12);
    ok('το άθροισμα των ακινήτων βγάζει το σύνολο: καμία προειδοποίηση γι’ αυτό',
      !doc?.warnings.some(w => w.includes('αθροίζουν')), doc?.warnings);
    ok('ημερομηνία έκδοσης σε ISO', doc?.issueDate === '2026-03-15', doc?.issueDate);
    ok('όχι διορθωτική', doc?.corrective === false);
  }

  // ── 2. Έγκυρο ΑΦΜ (φτιαγμένο τώρα) και Ταυτότητα Οφειλής ─────────────
  {
    const afm = validTestAfm();
    const rf = testRf();
    ok('η Ταυτότητα των δοκιμών περνά το mod 97', isValidRf(rf));
    const doc = okDoc(parseEnfiaAct(enfiaActLines({ afm, rf })));
    ok('έγκυρο ΑΦΜ διαβάζεται', doc?.afm === afm);
    ok('έγκυρη Ταυτότητα Οφειλής διαβάζεται', doc?.paymentRef === rf, doc?.paymentRef);
    const bad = rf.slice(0, 2) + (rf.slice(2, 4) === '00' ? '01' : '00') + rf.slice(4);
    const docBad = okDoc(parseEnfiaAct(enfiaActLines({ rf: bad })));
    ok('λάθος ψηφία ελέγχου: καμία Ταυτότητα και προειδοποίηση',
      docBad?.paymentRef === null && !!docBad?.warnings.some(w => w.includes('ταυτότητα οφειλής')), docBad?.warnings);
  }

  // ── 3. Το ίδιο έγγραφο ως PDF, μία και δύο σελίδες ───────────────────
  {
    const lines = enfiaActLines({ properties: [1, 2, 3].map(n => fakeProperty(n, n === 3 ? '0,00' : n === 1 ? '412,30' : '430,90')) });
    const fromText = okDoc(parseEnfiaAct(lines));
    for (const pagesOf of [0, 6]) {
      const res = extractPdfText(await enfiaActPdf(lines, { pagesOf }));
      ok(`PDF (${pagesOf ? 'δύο σελίδες' : 'μία σελίδα'}): το κείμενο βγαίνει`, res.failure === null, res.failure);
      const doc = okDoc(parseEnfiaAct(res.lines));
      ok(`PDF (${pagesOf ? 'δύο σελίδες' : 'μία σελίδα'}): ίδιο αποτέλεσμα με το κείμενο`,
        JSON.stringify(doc) === JSON.stringify(fromText), { pdf: res.lines.slice(0, 12) });
    }
  }

  // ── 4. «Δεν αναγνωρίστηκε», ΠΟΤΕ λάθος αριθμοί ───────────────────────
  {
    const income = ['ΑΝΕΞΑΡΤΗΤΗ ΑΡΧΗ ΔΗΜΟΣΙΩΝ ΕΣΟΔΩΝ', 'ΠΡΑΞΗ ΔΙΟΙΚΗΤΙΚΟΥ ΠΡΟΣΔΙΟΡΙΣΜΟΥ ΦΟΡΟΥ ΕΙΣΟΔΗΜΑΤΟΣ', 'Ποσό για καταβολή:\t1.250,00'];
    const r1 = parseEnfiaAct(income);
    ok('εκκαθαριστικό εισοδήματος: δεν αναγνωρίζεται ως ΕΝΦΙΑ', r1.status === 'unrecognized' && r1.kind === 'unknown', r1);
    const e9 = ['ΔΗΛΩΣΗ ΣΤΟΙΧΕΙΩΝ ΑΚΙΝΗΤΩΝ (Ε9)', `${fakeAtak(1)}\tΟδός Παραδείγματος 1`];
    const r2 = parseEnfiaAct(e9);
    ok('Ε9: αναγνωρίζεται ως Ε9, δεν διαβάζεται ακόμη', r2.status === 'unrecognized' && r2.kind === 'e9', r2);
    ok('ο ανιχνευτής: πράξη, Ε9, άγνωστο',
      detectDocKind(enfiaActLines()) === 'enfia_act' && detectDocKind(e9) === 'e9' && detectDocKind(['Τιμολόγιο ρεύματος']) === 'unknown');
    const empty = parseEnfiaAct(['ΔΗΛΩΣΗ ΕΝΦΙΑ - ΠΡΑΞΗ ΠΡΟΣΔΙΟΡΙΣΜΟΥ ΦΟΡΟΥ', 'Κείμενο χωρίς τίποτα']);
    ok('μοιάζει με πράξη αλλά χωρίς ποσό και ακίνητα: δεν αναγνωρίστηκε', empty.status === 'unrecognized' && empty.kind === 'enfia_act', empty);
    const img = extractPdfText(await imageOnlyPdf());
    ok('PDF χωρίς κείμενο: ρητή αιτία', img.failure === 'no_text', img.failure);
    const conflict = okDoc(parseEnfiaAct([...enfiaActLines({ gross: null }), 'Ποσό για καταβολή:\t900,00']));
    ok('δύο διαφορετικά ποσά για καταβολή: κανένα σύνολο, με προειδοποίηση',
      conflict?.total === null && !!conflict?.warnings.some(w => w.includes('διαφορετικές τιμές')), conflict?.warnings);
    const sumOff = okDoc(parseEnfiaAct(enfiaActLines({ payable: '900,00', gross: '900,00' })));
    ok('τα ποσά των ακινήτων δεν βγάζουν το σύνολο: προειδοποίηση, το σύνολο μένει όπως γράφεται',
      sumOff?.total === 900 && !!sumOff?.warnings.some(w => w.includes('αθροίζουν')), sumOff?.warnings);
    const noTotal = okDoc(parseEnfiaAct(enfiaActLines({ payable: null, gross: null })));
    ok('χωρίς ποσό: σύνολο κενό, ποτέ υπολογισμένο από τα ακίνητα', noTotal?.total === null && noTotal?.properties.length === 2);
  }

  // ── 5. Μειώσεις, διορθωτική, δόσεις, χωρίς επικεφαλίδες ──────────────
  {
    const reduced = okDoc(parseEnfiaAct(enfiaActLines({ gross: '900,00', payable: '843,20' })));
    ok('μετά από μείωση: οι δόσεις βγαίνουν από το ποσό για καταβολή', reduced?.total === 843.2
      && !!reduced?.warnings.some(w => w.includes('για καταβολή')), reduced?.warnings);
    ok('διορθωτική πράξη', okDoc(parseEnfiaAct(enfiaActLines({ corrective: true })))?.corrective === true);
    const small = okDoc(parseEnfiaAct(enfiaActLines({ properties: [fakeProperty(1, '67,20')], payable: '67,20', gross: '67,20', instalments: '12' })));
    ok('η πράξη γράφει άλλο πλήθος δόσεων από τη μηχανή: προειδοποίηση', !!small?.warnings.some(w => w.includes('δόσεις')), small?.warnings);
    const shape = okDoc(parseEnfiaAct(enfiaActLines({ noHeader: true })));
    const s = shape?.properties[0];
    ok('χωρίς επικεφαλίδες: ΑΤΑΚ από τη μορφή, όλα σημαδεμένα, κανένα ποσό μαντεμένο',
      s?.atak === fakeAtak(1) && s?.check === true && s?.tax === null && s?.sqm === null, s);
    const dup = okDoc(parseEnfiaAct(enfiaActLines({ properties: [fakeProperty(1, '412,30'), fakeProperty(1, '412,30')], payable: '412,30', gross: '412,30' })));
    ok('ο ίδιος ΑΤΑΚ δύο φορές: μία γραμμή', dup?.properties.length === 1 && !!dup?.warnings.some(w => w.includes('δύο φορές')));
  }

  // ── 6. Ταίριασμα με την εφαρμογή ─────────────────────────────────────
  {
    const known: KnownProperty[] = [
      { id: 'a', name: 'Με ΑΤΑΚ', address: 'κάπου αλλού 1', atak: fakeAtak(1) },
      { id: 'b', name: 'Χωρίς ΑΤΑΚ', address: 'ΠΑΡΑΔΕΙΓΜΑΤΟΣ 12, Αθήνα', atak: null },
      { id: 'c', name: 'Άλλος ΑΤΑΚ', address: 'Οδός Παραδείγματος 13', atak: fakeAtak(9) },
    ];
    ok('ΑΤΑΚ: υπάρχει ήδη', JSON.stringify(matchProperty({ atak: fakeAtak(1), address: null }, known)) === '{"status":"exists","id":"a"}');
    ok('διεύθυνση: μόνο πρόταση', JSON.stringify(matchProperty({ atak: fakeAtak(2), address: 'Οδός Παραδείγματος 12' }, known)) === '{"status":"maybe","id":"b"}');
    ok('ακίνητο με άλλο ΑΤΑΚ δεν προτείνεται ποτέ', matchProperty({ atak: fakeAtak(3), address: 'Οδός Παραδείγματος 13' }, known).status === 'new');
    ok('άλλος αριθμός, άλλο ακίνητο', matchProperty({ atak: null, address: 'Οδός Παραδείγματος 14' }, known).status === 'new');
    ok('κανονικοποίηση διεύθυνσης', addressKey('Οδός Παραδείγματος 12, Αθήνα') === addressKey('παραδειγματος 12'));
    ok('διεύθυνση χωρίς αριθμό δεν ταιριάζει', addressKey('Οδός Παραδείγματος') === null);
    const patch = fillOnlyEmpty({ id: 'x', name: 'x', address: 'Γραμμένη', atak: null, sqm: 0, floor: '' }, { atak: fakeAtak(4), sqm: 70, floor: '2', address: 'Άλλη' });
    ok('μόνο τα κενά πεδία συμπληρώνονται', JSON.stringify(patch) === JSON.stringify({ atak: fakeAtak(4), sqm: 70, floor: '2' }), patch);
  }

  // ── 7. Το όριο του πακέτου ──────────────────────────────────────────
  {
    ok('δωρεάν, κανένα ακίνητο: μία θέση', freeSlots(1, 0) === 1);
    ok('δωρεάν, γεμάτο: καμία', freeSlots(1, 1) === 0 && freeSlots(1, 3) === 0);
    ok('χωρίς όριο', freeSlots(Infinity, 40) === Infinity && overLimit([0, 1, 2], Infinity).length === 0);
    ok('οι πρώτες χωρούν, οι υπόλοιπες «Εκτός πακέτου»', JSON.stringify(overLimit([0, 2, 5], 1)) === '[2,5]');
    ok('πόσα πάνω από το όριο', excessOf(3, 1) === 2 && excessOf(1, 1) === 0);
  }

  // ── 8. Η διορθωτική πράξη ΑΝΤΙΚΑΘΙΣΤΑ το σύνολο ─────────────────────
  {
    const rows = [{ id: 'd1', property_id: 'p1', amount: 900 }, { id: 'd2', property_id: 'p2', amount: 900 }];
    const sets = [
      { propertyId: 'p1', data: { enfiaStatementTotal: '950,00', enfiaStatementYear: '2026', other: 'μένει' } },
      { propertyId: 'p2', data: { enfiaStatementTotal: '700', enfiaStatementYear: '2025' } },
    ];
    const plan = planStatement(2026, 843.2, rows, sets, 'p1');
    ok('καμία δεύτερη γραμμή', plan.insertOn === null);
    ok('κάθε γραμμή του έτους παίρνει το νέο ποσό', JSON.stringify(plan.docUpdates) === JSON.stringify([{ id: 'd1', amount: 843.2 }, { id: 'd2', amount: 843.2 }]));
    ok('το «Σύνολο εκκαθαριστικού» του ίδιου έτους ενημερώνεται, του άλλου όχι',
      plan.settingsUpdates.length === 1 && plan.settingsUpdates[0].data.enfiaStatementTotal === '843,2' && plan.settingsUpdates[0].data.other === 'μένει', plan.settingsUpdates);
    ok('τα παλιά ποσά κρατιούνται για την αναίρεση', plan.replaced.length === 3);
    // Μετά την αντικατάσταση, ο κανόνας «το μεγαλύτερο κερδίζει» βλέπει μόνο το νέο.
    const facts = [
      ...rows.map(r => ({ propertyId: r.property_id, year: 2026, amount: 843.2 })),
      { propertyId: 'p1', year: 2026, amount: 843.2 },
    ];
    const totals = enfiaTotalsByProperty([{ id: 'p1' }, { id: 'p2' }], null, facts);
    ok('μετά τη διορθωτική, οι δόσεις βγαίνουν από το ΜΙΚΡΟΤΕΡΟ νέο σύνολο', totals.get('p1')?.[2026] === 843.2 && totals.get('p2')?.[2026] === 843.2, Object.fromEntries(totals));
    // Αν είχε γραφτεί δεύτερη γραμμή, θα κέρδιζε το παλιό: αυτό αποφεύγεται.
    const wrong = enfiaTotalsByProperty([{ id: 'p1' }], null, [{ propertyId: 'p1', year: 2026, amount: 900 }, { propertyId: 'p1', year: 2026, amount: 843.2 }]);
    ok('(γιατί: δύο γραμμές θα κρατούσαν το παλιό 900)', wrong.get('p1')?.[2026] === 900);
    const first = planStatement(2026, 843.2, [], [], 'p9');
    ok('χωρίς υπάρχουσα γραμμή: μία νέα στο ακίνητο-στόχο', first.insertOn === 'p9' && !first.docUpdates.length);
    const same = planStatement(2026, 843.2, [{ id: 'd1', property_id: 'p1', amount: 843.2 }], [{ propertyId: 'p1', data: { enfiaStatementTotal: '843,20', enfiaStatementYear: '2026' } }], 'p1');
    ok('η ίδια πράξη δεύτερη φορά: τίποτα δεν αλλάζει', !same.insertOn && !same.docUpdates.length && !same.settingsUpdates.length);
    const row = statementDocRow(2026, 843.2, '2026-03-15');
    ok('η γραμμή του Αρχείου: «ΕΝΦΙΑ 2026», σύνολο, χωρίς αρχείο',
      row.title === 'ΕΝΦΙΑ 2026' && row.statement_total === true && row.amount === 843.2 && row.file_path === '', row);
  }

  // ── 9. Νέο ακίνητο: μόνο ό,τι υπάρχει ───────────────────────────────
  {
    const r = newPropertyRow('u', { existingId: null, name: ' Διαμέρισμα ', address: null, atak: '123', sqm: null, ownershipPct: 50, floor: ' 2 ' });
    ok('μισός ΑΤΑΚ δεν γράφεται, κενά πεδία λείπουν', JSON.stringify(r) === JSON.stringify({ user_id: 'u', name: 'Διαμέρισμα', ownership: 50, floor: '2' }), r);
  }

  // ── 10. Αναίρεση και όριο ημέρας ────────────────────────────────────
  {
    const now = new Date('2026-10-30T12:00:00Z');
    ok('η αναίρεση κρατά όσο το «Πλήρωσα»', IMPORT_UNDO_HOURS === PAY_UNDO_HOURS);
    ok('μέσα στο παράθυρο', canUndoImport(new Date(now.getTime() - 3_600_000).toISOString(), null, now));
    ok('μετά το παράθυρο όχι', !canUndoImport(new Date(now.getTime() - (IMPORT_UNDO_HOURS * 3_600_000 + 1000)).toISOString(), null, now));
    ok('αναιρεμένη δεν ξαναναιρείται', !canUndoImport(now.toISOString(), now.toISOString(), now));
    const mig = readdirSync('supabase/migrations').find(f => f.includes('myaade'));
    const sql = mig ? readFileSync(`supabase/migrations/${mig}`, 'utf8') : '';
    ok('το όριο της βάσης είναι το ίδιο με της οθόνης', sql.includes(`v_used >= ${MYAADE_DAILY_IMPORTS}`) && sql.includes(`interval '${IMPORT_UNDO_HOURS} hours'`));
  }

  // ── 11. Τα fixtures είναι ψεύτικα ───────────────────────────────────
  ok('το ΑΦΜ των fixtures δεν περνά τον έλεγχο', FAKE_AFM.length === 9 && !okDoc(parseEnfiaAct(enfiaActLines()))?.afm);
}

run().then(() => {
  console.log(fail === 0 ? `✓ myaade: ${pass} έλεγχοι πέρασαν` : `✗ myaade: ${fail} απέτυχαν από ${pass + fail}`);
  process.exit(fail ? 1 : 0);
});
