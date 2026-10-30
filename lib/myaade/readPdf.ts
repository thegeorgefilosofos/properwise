// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ PDF ΤΟΥ myAADE, ΣΕ WEB WORKER, ΜΕ ΟΡΙΑ ΚΑΙ ΠΡΟΟΔΟ
// ─────────────────────────────────────────────────────────────────────────
// Το ίδιο σχήμα με το lib/core/readSheet.ts:
//
//   ΧΡΟΝΟΣ    Ένα αρχείο φτιαγμένο για να κολλήσει τον αναγνώστη κολλά τον
//             εργάτη, όχι τη σελίδα. Μετά από `PDF_TIMEOUT_MS` ο εργάτης
//             τερματίζεται και ο χρήστης παίρνει μήνυμα.
//   ΠΡΟΟΔΟΣ   Ο εργάτης λέει ποια σελίδα διαβάζει· η οθόνη το ανακοινώνει.
//   ΕΦΕΔΡΕΙΑ  Αν ο περιηγητής δεν φτιάξει εργάτη, το αρχείο διαβάζεται στο
//             κύριο νήμα, όπως πριν. Δηλωμένα εδώ, όχι σιωπηλά.
//
// Το μέγεθος το κόβει ο καλών πριν φτάσει εδώ (`MAX_SCAN_MB`).
// ═══════════════════════════════════════════════════════════════════════════
import type { PdfTextResult } from '@/lib/pdf/pdfText';
import type { MyaadeWorkerReply } from '@/app/dashboard/components/myaadeWorker';

/** Είκοσι δευτερόλεπτα φτάνουν για δεκάδες σελίδες. */
export const PDF_TIMEOUT_MS = 20_000;

/** Αποτυχία με ελληνικό μήνυμα, έτοιμο για την οθόνη. */
export class PdfReadError extends Error {}

export type OnPage = (page: number, pages: number) => void;

/** Το κείμενο του PDF, στον εργάτη όπου γίνεται. */
export async function readPdfText(file: File, onPage: OnPage): Promise<PdfTextResult> {
  const buffer = await file.arrayBuffer();
  if (typeof Worker !== 'undefined') {
    try {
      return await inWorker(buffer, onPage);
    } catch (e) {
      if (e instanceof PdfReadError) throw e;
      // Ο εργάτης δεν ξεκίνησε καθόλου (το buffer δεν μεταφέρθηκε): κύριο νήμα.
    }
  }
  const { extractPdfText } = await import('@/lib/pdf/pdfText');
  return extractPdfText(new Uint8Array(buffer), { onPage });
}

function inWorker(buffer: ArrayBuffer, onPage: OnPage): Promise<PdfTextResult> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('../../app/dashboard/components/myaadeWorker.ts', import.meta.url));
    } catch (e) { reject(e); return; }
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new PdfReadError('Το αρχείο άργησε πολύ να διαβαστεί. Κατέβασέ το ξανά από το myAADE.'));
    }, PDF_TIMEOUT_MS);
    const end = () => { clearTimeout(timer); worker.terminate(); };
    worker.onmessage = (ev: MessageEvent<MyaadeWorkerReply>) => {
      const m = ev.data;
      if (m.kind === 'page') { onPage(m.page, m.pages); return; }
      end();
      if (m.kind === 'done') resolve(m.result);
      else reject(new PdfReadError('Το PDF δεν διαβάστηκε. Κατέβασέ το ξανά από το myAADE.'));
    };
    // Ό,τι σκάει ανεξέλεγκτα μέσα στον εργάτη το ελέγχει το ίδιο το ξένο
    // αρχείο: άρνηση στα ελληνικά, όχι δεύτερη ανάγνωση στο κύριο νήμα.
    worker.onerror = () => { end(); reject(new PdfReadError('Το PDF δεν διαβάστηκε. Κατέβασέ το ξανά από το myAADE.')); };
    worker.postMessage({ buffer }, [buffer]);
  });
}
