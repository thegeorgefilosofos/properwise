// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΡΑΞΗ ΕΝΦΙΑ ΔΙΑΒΑΖΕΤΑΙ ΣΕ ΑΛΛΟ ΝΗΜΑ
// ─────────────────────────────────────────────────────────────────────────
// Ο αναγνώστης PDF (lib/pdf/pdfText.ts) αποσυμπιέζει ροές και τοποθετεί κάθε
// γλύφο. Σε πολυσέλιδο αρχείο αυτό είναι δευτερόλεπτα όπου, στο κύριο νήμα, η
// σελίδα δεν απαντά ούτε σε κύλιση. Εδώ τρέχει σε Web Worker: η οθόνη μένει
// ζωντανή και δείχνει «σελίδα 2 από 3».
//
// Το αρχείο είναι ξένο (το κατέβασε ο χρήστης, δεν το φτιάξαμε εμείς). Ο
// εργάτης έχει δικό του καθολικό περιβάλλον, χωρίς DOM και συνεδρία· πίσω
// περνούν μόνο οι γραμμές κειμένου, η αιτία αποτυχίας και η πρόοδος. Τίποτα
// δεν καταγράφεται.
// ═══════════════════════════════════════════════════════════════════════════
import { extractPdfText, type PdfTextResult } from '@/lib/pdf/pdfText';

export interface MyaadeWorkerRequest { buffer: ArrayBuffer }
export type MyaadeWorkerReply =
  | { kind: 'page'; page: number; pages: number }
  | { kind: 'done'; result: PdfTextResult }
  | { kind: 'error' };

const post = (m: MyaadeWorkerReply) => (self as unknown as Worker).postMessage(m);

self.onmessage = (e: MessageEvent<MyaadeWorkerRequest>) => {
  try {
    const result = extractPdfText(new Uint8Array(e.data.buffer), { onPage: (page, pages) => post({ kind: 'page', page, pages }) });
    post({ kind: 'done', result });
  } catch {
    post({ kind: 'error' });
  }
};
