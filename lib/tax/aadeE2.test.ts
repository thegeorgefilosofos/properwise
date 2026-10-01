// npx tsx lib/tax/aadeE2.test.ts
//
// Το προσυμπληρωμένο έρχεται με τρεις μορφές (εκτύπωση σε PDF, αντιγραφή
// πίνακα, προβολή λεπτομερειών) και η ερώτηση είναι πάντα η ίδια: διαβάστηκε
// το ΣΩΣΤΟ νούμερο στο ΣΩΣΤΟ πεδίο και, όπου δεν είμαστε βέβαιοι, το λέμε;
import PDFDocument from 'pdfkit';
import { parseAadeE2, validateAadeRow, fieldOf, type AadeE2Row } from './aadeE2';
import { extractPdfText } from '@/lib/pdf/pdfText';

let pass = 0, fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++; else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}
function ok(name: string, cond: boolean) { if (cond) pass++; else { fail++; console.error(`✗ ${name}`); } }

// Έγκυρα ΑΦΜ (ψηφίο ελέγχου σωστό) και ένα άκυρο.
const OWNER = '094014201', T1 = '123456783', T2 = '987654324', T3 = '111222336';
const BAD = '123456789';

// ═══ ΕΠΙΚΕΦΑΛΙΔΕΣ: ΑΝΤΙΣΤΟΙΧΙΣΗ ΣΤΗΛΩΝ ═══════════════════════════════════
eq('ΑΦΜ μισθωτή πριν από «μισθωτή»', fieldOf('ΑΦΜ μισθωτή'), 'tenantAfm');
eq('Α.Τ.ΑΚ. με τελείες', fieldOf('Α.Τ.ΑΚ.'), 'atak');
eq('μηνιαίο πριν από μήνες', fieldOf('Μηνιαίο μίσθωμα'), 'monthly');
eq('μήνες', fieldOf('Μήνες'), 'months');
eq('αριθμός δήλωσης πριν από μίσθωση', fieldOf('Αρ. Δήλωσης Μίσθωσης'), 'decl');
eq('ιδιοχρησιμοποίηση πριν από ακαθάριστο', fieldOf('Ακαθάριστο: Ιδιοχρησιμοποίηση'), 'g15');
eq('ο αριθμός στήλης κρίνει πρώτος', fieldOf('Ακαθάριστο εισόδημα (στ. 13)'), 'g13');
eq('και οι επικεφαλίδες της δικής μας εξαγωγής', fieldOf('Έναρξη μίσθωσης (στ. 8)'), 'from');

// ═══ 1. ΑΝΤΙΓΡΑΦΗ ΠΙΝΑΚΑ ΑΠΟ ΤΟ myAADE (tab ανάμεσα στα κελιά) ═════════════
{
  const text = [
    'ΑΝΑΛΥΤΙΚΗ ΚΑΤΑΣΤΑΣΗ ΜΙΣΘΩΜΑΤΩΝ ΑΚΙΝΗΤΗΣ ΠΕΡΙΟΥΣΙΑΣ',
    `Φορολογικό έτος 2025\tΑ.Φ.Μ.: ${OWNER}`,
    ['Α/Α', 'Α.Τ.ΑΚ.', 'Διεύθυνση', 'Κατηγορία', 'Ονοματεπώνυμο μισθωτή', 'ΑΦΜ μισθωτή', 'Από', 'Έως', 'Μήνες', 'Μηνιαίο μίσθωμα', 'Ποσοστό', 'Ακαθάριστο: Εκμίσθωση', 'Ακαθάριστο: Δωρεάν παραχώρηση', 'Ακαθάριστο: Ιδιοχρησιμοποίηση', 'Αρ. Δήλωσης'].join('\t'),
    ['1', '01234567890', 'Πατησίων 10, Αθήνα 10434', 'Διαμέρισμα', 'Παπαδόπουλος Γεώργιος', T1, '01/01/2025', '31/12/2025', '12', '600,00', '100,00', '7.200,00', '', '', '45678912'].join('\t'),
    ['2', '01234567891', 'Ερμού 5, Πάτρα', 'Κατάστημα', 'ΑΛΦΑ ΟΕ', T2, '01/03/2025', '31/12/2025', '10', '1.234,56', '50,00', '6.172,80', '', '', '45678913'].join('\t'),
    ['3', '01234567892', 'Κύπρου 3, Βόλος', 'Διαμέρισμα', '', '', '01/01/2025', '31/12/2025', '12', '', '100,00', '', '', '1.800,00', ''].join('\t'),
    ['', '', 'ΣΥΝΟΛΟ', '', '', '', '', '', '', '', '', '13.372,80', '', '1.800,00', ''].join('\t'),
  ].join('\n');
  const r = parseAadeE2(text);
  eq('πίνακας: μορφή', r.layout, 'table');
  eq('πίνακας: τρεις γραμμές, το σύνολο έξω', r.rows.length, 3);
  eq('πίνακας: έτος από την κεφαλίδα', r.year, 2025);
  eq('πίνακας: ΑΦΜ υπόχρεου από την κεφαλίδα', r.ownerAfm, OWNER);
  const [a, b, c] = r.rows;
  eq('γραμμή 1', [a.rowNo, a.atak, a.tenantAfm, a.from, a.to, a.months, a.monthlyRent, a.ownershipPct, a.gross, a.incomeColumn, a.leaseDeclRef],
    [1, '01234567890', T1, '2025-01-01', '2025-12-31', 12, 600, 100, 7200, 13, '45678912']);
  ok('γραμμή 1 χωρίς προβλήματα', a.issues.length === 0 && !a.check);
  eq('γραμμή 2: ελληνικοί αριθμοί με χιλιάδες και δεκαδικά', [b.monthlyRent, b.ownershipPct, b.gross], [1234.56, 50, 6172.8]);
  eq('γραμμή 2: διεύθυνση και κατηγορία', [b.address, b.category, b.tenantName], ['Ερμού 5, Πάτρα', 'Κατάστημα', 'ΑΛΦΑ ΟΕ']);
  eq('γραμμή 3: ιδιοχρησιμοποίηση στη στ. 15', [c.incomeColumn, c.gross, c.tenantAfm], [15, 1800, null]);
}

// ═══ 2. ΕΚΤΥΠΩΣΗ ΣΕ PDF (πραγματικό PDF, ελληνική γραμματοσειρά) ═══════════
type Doc = InstanceType<typeof PDFDocument>;
async function makePdf(draw: (doc: Doc) => void): Promise<Uint8Array> {
  return new Promise(resolve => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 24 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.font('node_modules/pdfmake/fonts/Roboto/Roboto-Regular.ttf').fontSize(8);
    draw(doc);
    doc.end();
  });
}

async function pdfCases() {
  // Οι στήλες με τη σειρά του εντύπου. Οι κενές στήλες ΔΕΝ τυπώνουν τίποτα.
  const X = [24, 44, 104, 214, 274, 364, 414, 464, 512, 544, 592, 634, 690, 744];
  const bytes = await makePdf(doc => {
    doc.fontSize(11).text('ΑΝΑΛΥΤΙΚΗ ΚΑΤΑΣΤΑΣΗ ΜΙΣΘΩΜΑΤΩΝ ΑΚΙΝΗΤΗΣ ΠΕΡΙΟΥΣΙΑΣ (Ε2)', 24, 24);
    doc.fontSize(8).text(`Φορολογικό έτος 2025     Α.Φ.Μ. υπόχρεου: ${OWNER}`, 24, 42);
    const head = ['Α/Α', 'Α.Τ.ΑΚ.', 'Διεύθυνση', 'Κατηγορία', 'Μισθωτής', 'ΑΦΜ', 'Από', 'Έως', 'Μήνες', 'Μηνιαίο', '%', 'Ακαθάριστο', 'Ιδιοχρ.', 'Αρ. Δήλωσης'];
    head.forEach((h, i) => doc.text(h, X[i], 70, { lineBreak: false }));
    const rows = [
      ['1', '01234567890', 'Πατησίων 10, Αθήνα', 'Διαμέρισμα', 'Παπαδόπουλος Γ.', T1, '01/01/2025', '31/12/2025', '12', '600,00', '100,00', '7.200,00', '', '45678912'],
      ['2', '01234567891', 'Ερμού 5, Πάτρα', 'Κατάστημα', 'Νικολάου Μ.', T3, '01/07/2025', '31/12/2025', '6', '800,00', '50,00', '2.400,00', '', '45678913'],
      ['3', '01234567893', 'Ακτή 1, Χανιά', 'Διαμέρισμα', '', '', '', '', '7', '', '100,00', '9.350,00', '', ''],
    ];
    rows.forEach((r, k) => r.forEach((v, i) => { if (v) doc.text(v, X[i], 90 + k * 16, { lineBreak: false }); }));
    doc.text('ΣΥΝΟΛΟ', X[2], 150, { lineBreak: false });
    doc.text('18.950,00', X[11], 150, { lineBreak: false });
  });
  const pdf = extractPdfText(bytes);
  eq('PDF: διαβάστηκε', pdf.failure, null);
  ok('PDF: οι στήλες χωρίζονται με tab', pdf.lines.some(l => l.split('\t').length >= 8));
  const r = parseAadeE2(pdf.lines.join('\n'));
  eq('PDF: τρεις γραμμές', r.rows.length, 3);
  eq('PDF: έτος και ΑΦΜ υπόχρεου', [r.year, r.ownerAfm], [2025, OWNER]);
  const [a, b, c] = r.rows;
  eq('PDF γραμμή 1', [a.atak, a.tenantAfm, a.from, a.to, a.months, a.monthlyRent, a.ownershipPct, a.gross, a.leaseDeclRef],
    ['01234567890', T1, '2025-01-01', '2025-12-31', 12, 600, 100, 7200, '45678912']);
  eq('PDF γραμμή 1: μισθωτής και διεύθυνση', [a.tenantName, a.address], ['Παπαδόπουλος Γ.', 'Πατησίων 10, Αθήνα']);
  eq('PDF γραμμή 2: συνιδιοκτησία 50%', [b.months, b.monthlyRent, b.ownershipPct, b.gross], [6, 800, 50, 2400]);
  // Βραχυχρόνια: χωρίς ημερομηνίες, χωρίς μηνιαίο. Ο μοναδικός αριθμός με
  // υποδιαστολή μετά το ποσοστό είναι το ακαθάριστο και η γραμμή σημαδεύεται.
  eq('PDF γραμμή 3: βραχυχρόνια', [c.atak, c.months, c.gross, c.monthlyRent], ['01234567893', 7, 9350, null]);
  ok('PDF: γραμμή χωρίς ΑΦΜ και ημερομηνίες σημαδεύεται για έλεγχο', c.check);

  // Σάρωση χωρίς κείμενο: ρητή αιτία, όχι «κενό έντυπο».
  const empty = await makePdf(doc => { doc.rect(40, 40, 200, 100).fill('#000'); });
  eq('PDF χωρίς κείμενο', extractPdfText(empty).failure, 'no_text');
  eq('δεν είναι PDF', extractPdfText(new TextEncoder().encode('hello')).failure, 'not_pdf');
}

// ═══ 3. ΠΡΟΒΟΛΗ ΛΕΠΤΟΜΕΡΕΙΩΝ: «Ετικέτα: τιμή» ═══════════════════════════════
{
  const text = [
    'Α.Τ.ΑΚ.: 01234567890',
    'Διεύθυνση: Πατησίων 10',
    `ΑΦΜ μισθωτή: ${T1}`,
    'Μήνες: 12',
    'Μηνιαίο μίσθωμα: 600,00 €',
    'Ακαθάριστο εισόδημα: 7.200,00 €',
    '',
    'Α.Τ.ΑΚ.: 01234567891',
    `ΑΦΜ μισθωτή: ${BAD}`,
    'Μήνες: 10',
    'Ακαθάριστο εισόδημα: 5.000,00 €',
  ].join('\n');
  const r = parseAadeE2(text);
  eq('ετικέτες: μορφή', r.layout, 'labels');
  eq('ετικέτες: δύο γραμμές', r.rows.length, 2);
  eq('ετικέτες: πρώτη γραμμή', [r.rows[0].atak, r.rows[0].tenantAfm, r.rows[0].months, r.rows[0].monthlyRent, r.rows[0].gross], ['01234567890', T1, 12, 600, 7200]);
  ok('ετικέτες: λάθος ΑΦΜ λέγεται με το νούμερο', r.rows[1].issues.some(i => i.includes(BAD) && /ψηφίο ελέγχου/.test(i)));
  ok('ετικέτες: και η γραμμή σημαδεύεται', r.rows[1].check);
}
{
  // Ετικέτα και τιμή σε διαδοχικές γραμμές.
  const text = ['Α.Τ.ΑΚ.', '01234567890', 'ΑΦΜ μισθωτή', T2, 'Μήνες', '5', 'Ακαθάριστο εισόδημα', '2.500,00'].join('\n');
  const r = parseAadeE2(text);
  eq('ετικέτα από πάνω: μία γραμμή', r.rows.map(x => [x.atak, x.tenantAfm, x.months, x.gross]), [['01234567890', T2, 5, 2500]]);
}

// ═══ 4. ΚΕΙΜΕΝΟ ΧΩΡΙΣ TAB (αντιγραφή από προβολέα PDF) ════════════════════
{
  const text = [
    `1  01234567890  Πατησίων 10, Αθήνα  Παπαδόπουλος Γ.  ${T1}  01/01/2025  31/12/2025  12  600,00  100,00  7.200,00`,
    `2  01234567891  Ερμού 5  ${BAD}  01/02/2025  31/12/2025  11  500,00  100,00  5.500,00`,
  ].join('\n');
  const r = parseAadeE2(text);
  eq('κείμενο: μορφή', r.layout, 'text');
  eq('κείμενο: δύο γραμμές', r.rows.length, 2);
  eq('κείμενο: ποσά στη θέση τους', [r.rows[0].months, r.rows[0].monthlyRent, r.rows[0].ownershipPct, r.rows[0].gross], [12, 600, 100, 7200]);
  ok('κείμενο: η πράξη επιβεβαιώνει, οπότε η γραμμή δεν θέλει έλεγχο', !r.rows[0].check);
  ok('κείμενο: λάθος ΑΦΜ λέγεται', r.rows[1].issues.some(i => i.includes(BAD)));
}

// ═══ 5. ΕΛΕΓΧΟΙ ΓΡΑΜΜΗΣ ════════════════════════════════════════════════════
{
  const base: AadeE2Row = {
    rowNo: 1, atak: '01234567890', address: null, category: null, tenantName: null, tenantAfm: T1,
    from: '2025-01-01', to: '2025-12-31', months: 12, monthlyRent: 600, ownershipPct: 100,
    gross: 7200, incomeColumn: 13, leaseDeclRef: null,
  };
  eq('σωστή γραμμή: κανένα πρόβλημα', validateAadeRow(base, 2025), []);
  ok('ασυνέπεια μηνιαίου και ακαθαρίστου λέγεται με τα νούμερα',
    validateAadeRow({ ...base, gross: 6900 }).some(i => i.includes('7.200,00€') && i.includes('6.900,00€')));
  ok('ΑΤΑΚ με λάθος πλήθος ψηφίων', validateAadeRow({ ...base, atak: '123' }).some(i => /11 ψηφία/.test(i)));
  ok('μήνες πάνω από 12', validateAadeRow({ ...base, months: 13 }).some(i => /0 έως 12/.test(i)));
  ok('διάστημα εκτός έτους', validateAadeRow(base, 2024).some(i => /δεν πέφτει μέσα στο 2024/.test(i)));
  ok('χωρίς ΑΤΑΚ: λέγεται πώς θα γίνει η ταύτιση', validateAadeRow({ ...base, atak: null }).some(i => /ΑΦΜ μισθωτή/.test(i)));
}

// ═══ 6. ΤΙΠΟΤΑ ΓΙΑ ΔΙΑΒΑΣΜΑ ════════════════════════════════════════════════
{
  const r = parseAadeE2('Καλημέρα\nΔεν υπάρχει πίνακας εδώ');
  eq('χωρίς γραμμές: άδειο αποτέλεσμα', [r.layout, r.rows.length], ['empty', 0]);
  eq('κενό κείμενο', parseAadeE2('').layout, 'empty');
}

pdfCases().then(() => {
  console.log(fail === 0 ? `✓ aadeE2: ${pass} έλεγχοι πέρασαν` : `✗ aadeE2: ${fail} απέτυχαν από ${pass + fail}`);
  process.exit(fail ? 1 : 0);
});
