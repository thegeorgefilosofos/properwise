// ═══════════════════════════════════════════════════════════════════════════
// ΔΙΑΒΑΣΜΑ ΞΕΝΟΥ ΦΥΛΛΟΥ EXCEL, ΜΕ ΟΡΙΑ
// ─────────────────────────────────────────────────────────────────────────
// Ένα σημείο για ό,τι μπαίνει στην εφαρμογή από αρχείο που δεν φτιάξαμε εμείς.
// Επιβάλλει τρία όρια που καμία οθόνη δεν επέβαλλε μόνη της:
//
//   ΜΕΓΕΘΟΣ   Ένα φύλλο 200 MB δεν είναι κατάσταση εξόδων, είναι επίθεση
//             μνήμης. Το όριο κόβει πριν καν ξεκινήσει η ανάγνωση.
//   ΧΡΟΝΟΣ    Ο αναλυτής μπορεί να κολλήσει σε φύλλο φτιαγμένο γι' αυτό. Ο
//             εργάτης τερματίζεται και ο χρήστης παίρνει μήνυμα, όχι παγωμένη
//             οθόνη.
//   ΑΠΟΜΟΝΩΣΗ Η ανάγνωση γίνεται σε Web Worker, με δικό του καθολικό
//             περιβάλλον. Μόλυνση πρωτοτύπου από κακόβουλο φύλλο μένει εκεί.
//
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΕΦΕΔΡΕΙΑ. Αν ο περιηγητής δεν φτιάξει εργάτη, το αρχείο
// διαβάζεται στο κύριο νήμα, όπως γινόταν πάντα. Η εναλλακτική θα ήταν να
// αρνηθούμε να διαβάσουμε το αρχείο ΤΟΥ ΙΔΙΟΥ ΤΟΥ ΧΡΗΣΤΗ — και το να μη
// δουλεύει η εισαγωγή είναι βέβαιη ζημιά, ενώ ο κίνδυνος είναι υποθετικός.
// Η εφεδρεία δηλώνεται εδώ ρητά, δεν συμβαίνει σιωπηλά.
// ═══════════════════════════════════════════════════════════════════════════

/** Ένα φύλλο εξόδων δεν ξεπερνά τα δέκα megabyte. Ό,τι μεγαλύτερο δεν είναι φύλλο εξόδων. */
export const MAX_SHEET_BYTES = 10 * 1024 * 1024;

/** Δεκαπέντε δευτερόλεπτα φτάνουν και για δεκάδες χιλιάδες γραμμές. */
export const SHEET_TIMEOUT_MS = 15_000;

export class SheetError extends Error {}

/**
 * Διαβάζει το πρώτο φύλλο ενός αρχείου Excel και το επιστρέφει ως CSV.
 *
 * @throws SheetError με ελληνικό μήνυμα έτοιμο για την οθόνη.
 */
export async function readSheetAsCsv(file: File): Promise<string> {
  if (file.size > MAX_SHEET_BYTES) {
    throw new SheetError(`Το αρχείο είναι πολύ μεγάλο (όριο ${Math.round(MAX_SHEET_BYTES / 1024 / 1024)} MB).`);
  }
  const buffer = await file.arrayBuffer();

  if (typeof Worker !== 'undefined') {
    try {
      return await inWorker(buffer);
    } catch (e) {
      if (e instanceof SheetError) throw e;
      // Ο εργάτης δεν ξεκίνησε καθόλου: πέφτουμε στο κύριο νήμα.
    }
  }
  return inMainThread(buffer);
}

function inWorker(buffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('../../app/dashboard/components/sheetWorker.ts', import.meta.url));
    } catch (e) { reject(e); return; }

    const timer = setTimeout(() => {
      worker.terminate();
      reject(new SheetError('Το αρχείο άργησε πολύ να διαβαστεί. Δοκίμασε να το αποθηκεύσεις ως CSV.'));
    }, SHEET_TIMEOUT_MS);

    worker.onmessage = (ev: MessageEvent<{ csv?: string; error?: string }>) => {
      clearTimeout(timer); worker.terminate();
      if (ev.data.error || typeof ev.data.csv !== 'string') reject(new SheetError(ev.data.error || 'Το αρχείο δεν διαβάστηκε.'));
      else resolve(ev.data.csv);
    };
    // ═══ Η ΑΠΟΜΟΝΩΣΗ ΚΡΑΤΟΥΣΕ ΑΠΟ ΣΥΜΠΤΩΣΗ, ΟΧΙ ΑΠΟ ΑΠΟΦΑΣΗ ══════════════════
    // Το σκέτο `Error` εδώ δεν είναι SheetError, οπότε η readSheetAsCsv το
    // προσπερνούσε και ξαναδιάβαζε στο ΚΥΡΙΟ νήμα. Το `onerror` όμως το ρίχνει
    // οτιδήποτε σκάει ανεξέλεγκτα ΜΕΣΑ στον εργάτη, δηλαδή το ελέγχει το ίδιο
    // το ξένο αρχείο.
    //
    // ΤΙ ΜΕΤΡΗΘΗΚΕ (07/09/2026, με εκτέλεση σε αντίγραφο εκτός αποθετηρίου,
    // με ψεύτικο εργάτη που πεθαίνει αμέσως):
    //
    //   με μεταφορά buffer, όπως κάνει ο περιηγητής   TypeError «Cannot perform
    //                                     Construct on a detached ArrayBuffer»
    //   χωρίς μεταφορά buffer                          ΔΙΑΒΑΣΕ, CSV 9 χαρακτήρων
    //
    // Η δεύτερη ανάγνωση δηλαδή ΔΕΝ πετύχαινε — αλλά μόνο επειδή το postMessage
    // από κάτω περνά το buffer στη λίστα μεταφοράς, που το αποσυνδέει. Την
    // απομόνωση την κρατούσε μια λίστα μεταφοράς. Αν έφευγε αύριο το `[buffer]`
    // από τη γραμμή του postMessage, η SheetJS 0.18.5 που κουβαλά μέσα του το
    // xlsx-js-style θα διάβαζε ξένα byte στο κύριο νήμα — το μέτρησα, διαβάζει.
    // Ο,τι έφτανε στον χρήστη ήταν TypeError αντί για ελληνική άρνηση.
    //
    // Ο constructor από πάνω εξακολουθεί να ρίχνει σκέτο Error, άρα ο
    // περιηγητής που δεν φτιάχνει εργάτες κρατά τη δηλωμένη εφεδρεία του.
    worker.onerror = () => { clearTimeout(timer); worker.terminate(); reject(new SheetError('Το αρχείο δεν διαβάστηκε.')); };
    worker.postMessage({ buffer }, [buffer]);
  });
}

async function inMainThread(buffer: ArrayBuffer): Promise<string> {
  const XLSX = (await import('xlsx-js-style')).default;
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const first = wb.SheetNames[0];
  if (!first) throw new SheetError('Το αρχείο δεν έχει φύλλα.');
  return XLSX.utils.sheet_to_csv(wb.Sheets[first], { dateNF: 'yyyy-mm-dd' });
}
