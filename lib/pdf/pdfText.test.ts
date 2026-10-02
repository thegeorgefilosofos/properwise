// npx tsx lib/pdf/pdfText.test.ts
//
// Η ανάγνωση κειμένου PDF χωρίς βιβλιοθήκη: γραμματοσειρές με χάρτη Unicode
// (ελληνικά) και χωρίς (τυπικές γραμματοσειρές), στήλες χωρισμένες με tab,
// σελίδες με τη σειρά τους και ρητή αιτία όταν δεν υπάρχει κείμενο.
import PDFDocument from 'pdfkit';
import { extractPdfText } from './pdfText';

let pass = 0, fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++; else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}

type Doc = InstanceType<typeof PDFDocument>;
function pdf(draw: (doc: Doc) => void, compress = true): Promise<Uint8Array> {
  return new Promise(resolve => {
    const doc = new PDFDocument({ size: 'A4', margin: 30, compress });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
    draw(doc);
    doc.end();
  });
}

const ROBOTO = 'node_modules/pdfmake/fonts/Roboto/Roboto-Regular.ttf';

async function run() {
  // Τυπική γραμματοσειρά (WinAnsi): οι αριθμοί και τα λατινικά βγαίνουν ακέραια.
  {
    const r = extractPdfText(await pdf(doc => {
      doc.font('Helvetica').fontSize(10);
      doc.text('ATAK', 30, 40, { lineBreak: false });
      doc.text('01234567890', 200, 40, { lineBreak: false });
      doc.text('7.200,00', 400, 40, { lineBreak: false });
    }));
    eq('Helvetica: μία γραμμή, τρεις στήλες', r.lines, ['ATAK\t01234567890\t7.200,00']);
  }
  // Ελληνικά μέσω ToUnicode και χωρίς συμπίεση.
  for (const compress of [true, false]) {
    const r = extractPdfText(await pdf(doc => {
      doc.font(ROBOTO).fontSize(10);
      doc.text('Ακαθάριστο εισόδημα', 30, 40, { lineBreak: false });
      doc.text('6.172,80 €', 300, 40, { lineBreak: false });
      doc.text('Παπαδόπουλος Γεώργιος', 30, 60, { lineBreak: false });
    }, compress));
    eq(`Roboto (συμπίεση ${compress}): ελληνικά και σειρά γραμμών`, r.lines, ['Ακαθάριστο εισόδημα\t6.172,80 €', 'Παπαδόπουλος Γεώργιος']);
  }
  // Δύο σελίδες: η σειρά των σελίδων κρατιέται.
  {
    const r = extractPdfText(await pdf(doc => {
      doc.font(ROBOTO).fontSize(10).text('Σελίδα πρώτη', 30, 40);
      doc.addPage().font(ROBOTO).fontSize(10).text('Σελίδα δεύτερη', 30, 40);
    }));
    eq('δύο σελίδες', [r.pages, r.lines], [2, ['Σελίδα πρώτη', 'Σελίδα δεύτερη']]);
  }
  // Λέξεις του ίδιου κελιού μένουν μαζί, με απλό κενό.
  {
    const r = extractPdfText(await pdf(doc => {
      doc.font(ROBOTO).fontSize(9).text('Πατησίων 10, Αθήνα', 30, 40, { lineBreak: false });
    }));
    eq('κενά μέσα στο κελί', r.lines, ['Πατησίων 10, Αθήνα']);
  }
}

run().then(() => {
  console.log(fail === 0 ? `✓ pdfText: ${pass} έλεγχοι πέρασαν` : `✗ pdfText: ${fail} απέτυχαν από ${pass + fail}`);
  process.exit(fail ? 1 : 0);
});
