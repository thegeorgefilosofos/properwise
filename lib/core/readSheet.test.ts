// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΠΟΜΟΝΩΣΗ ΤΟΥ ΞΕΝΟΥ ΦΥΛΛΟΥ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΚΡΑΤΙΕΤΑΙ ΑΠΟ ΣΥΜΠΤΩΣΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΜΕΤΡΗΘΗΚΕ (07/09/2026, με εκτέλεση σε αντίγραφο εκτός αποθετηρίου):
//
//   structuredClone({buffer}, {transfer:[buffer]})   byteLength 10 · μετά 0
//   XLSX.read(αποσυνδεδεμένο buffer)                 TypeError «Cannot perform
//                                                    Construct on a detached
//                                                    ArrayBuffer»
//
// ΤΙ ΣΗΜΑΙΝΕΙ. Το `worker.postMessage({ buffer }, [buffer])` ΜΕΤΑΦΕΡΕΙ το
// buffer: μόλις επιστρέψει, το αντίγραφο του κύριου νήματος έχει μηδέν byte.
// Αρα η παλιά διαδρομή του `onerror` — που απέρριπτε με σκέτο `Error` και
// άφηνε τη readSheetAsCsv να ξαναδιαβάσει στο κύριο νήμα — ΔΕΝ κατάφερνε να
// αναλύσει τα ξένα byte: έσκαγε με TypeError. Η απομόνωση κρατούσε ΚΑΤΑ
// ΣΥΜΠΤΩΣΗ, από την αποσύνδεση του buffer, όχι από απόφαση.
//
// ΓΙ' ΑΥΤΟ ΥΠΑΡΧΟΥΝ ΔΥΟ ΕΛΕΓΧΟΙ ΓΙΑ ΤΟΝ ΝΕΚΡΟ ΕΡΓΑΤΗ. Ο πρώτος στήνει τη
// μεταφορά όπως τη κάνει ο περιηγητής. Ο δεύτερος ΔΕΝ τη στήνει: δείχνει τι
// θα γινόταν αν κάποιος αφαιρούσε αύριο τη λίστα μεταφοράς — με τον παλιό
// κώδικα η SheetJS 0.18.5 (μέσα στο xlsx-js-style) διάβαζε ΟΝΤΩΣ τα ξένα byte
// στο κύριο νήμα. Ο δεύτερος έλεγχος είναι που κάνει την απομόνωση απόφαση.
//
// Τρέξε: npx tsx lib/core/readSheet.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { readSheetAsCsv, SheetError, MAX_SHEET_BYTES } from './readSheet';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name); } };

// Σκέτο κείμενο με κόμματα: η SheetJS το διαβάζει ως CSV χωρίς να χρειάζεται
// έγκυρο zip, οπότε η «επιτυχής ανάγνωση» είναι μετρήσιμη.
const bytes = () => new TextEncoder().encode('α,β\n1,2\n').buffer as ArrayBuffer;
const fileOf = (size: number) => ({ size, arrayBuffer: async () => bytes() }) as unknown as File;

/**
 * Εργάτης που πεθαίνει πριν προλάβει να απαντήσει, όπως θα τον σκότωνε φύλλο
 * φτιαγμένο γι' αυτό. Το `transfers` λέει αν το postMessage αποσυνδέει το
 * buffer, δηλαδή αν αντιγράφει τον περιηγητή ή τη χειρότερη εκδοχή.
 */
const deadWorker = (transfers: boolean) => class {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_url: URL) { setTimeout(() => this.onerror?.(), 0); }
  postMessage(data: unknown, transfer?: Transferable[]) {
    if (transfers && transfer) structuredClone(data, { transfer });
  }
  terminate() { /* τίποτα */ }
};

const g = globalThis as unknown as Record<string, unknown>;
const realWorker = g.Worker;

async function refusal(f: File): Promise<string> {
  try { await readSheetAsCsv(f); return 'ΔΙΑΒΑΣΤΗΚΕ ΚΑΝΟΝΙΚΑ'; }
  catch (e) { return e instanceof SheetError ? e.message : `ΑΛΛΟ ΕΙΔΟΣ: ${(e as Error).constructor.name}`; }
}

async function main() {
  // ── Το όριο μεγέθους κόβει πριν καν διαβαστεί το αρχείο ─────────────────
  ok('το πολύ μεγάλο αρχείο κόβεται πριν την ανάγνωση',
    (await refusal(fileOf(MAX_SHEET_BYTES + 1))).includes('πολύ μεγάλο'));

  // ── ΕΠΕΦΤΕ ΠΡΙΝ: με μεταφορά ο νεκρός εργάτης έδινε TypeError, όχι άρνηση ─
  g.Worker = deadWorker(true);
  ok('ο νεκρός εργάτης δίνει άρνηση σε ελληνικά, όχι σφάλμα χρόνου εκτέλεσης',
    (await refusal(fileOf(4))) === 'Το αρχείο δεν διαβάστηκε.');

  // ── ΕΠΕΦΤΕ ΠΡΙΝ: χωρίς μεταφορά, το ξένο φύλλο κέρδιζε ανάγνωση χωρίς ────
  // απομόνωση. Αυτός ο έλεγχος κρατά την άρνηση ΑΝΕΞΑΡΤΗΤΑ από την
  // αποσύνδεση του buffer, δηλαδή την κάνει απόφαση αντί για σύμπτωση.
  g.Worker = deadWorker(false);
  ok('ούτε με ακέραιο buffer ο νεκρός εργάτης δίνει δεύτερη ανάγνωση',
    (await refusal(fileOf(4))) === 'Το αρχείο δεν διαβάστηκε.');

  // ── Η ΔΗΛΩΜΕΝΗ ΕΦΕΔΡΕΙΑ ΜΕΝΕΙ: χωρίς εργάτες, το αρχείο του χρήστη ─────
  // διαβάζεται. Το να μη δουλεύει η εισαγωγή είναι βέβαιη ζημιά.
  delete g.Worker;
  let fellBack = false;
  try { await readSheetAsCsv(fileOf(4)); fellBack = true; } catch { fellBack = false; }
  ok('χωρίς εργάτες, η δηλωμένη εφεδρεία εξακολουθεί να διαβάζει', fellBack);

  if (realWorker !== undefined) g.Worker = realWorker;

  console.log(fail === 0 ? `✓ readSheet: ${pass} έλεγχοι πέρασαν` : `✗ readSheet: ${fail} απέτυχαν από ${pass + fail}`);
  if (fail > 0) process.exit(1);
}

main();
