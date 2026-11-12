// ═══════════════════════════════════════════════════════════════════════════
// ΑΠΟ ΤΗ ΣΑΡΩΣΗ ΣΤΗ ΜΑΖΙΚΗ: ΠΟΙΟ ΑΡΧΕΙΟ ΠΑΕΙ ΠΟΥ (12/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Το Ε9 και η πράξη ΕΝΦΙΑ του myAADE έχουν συνήθως πολλά ακίνητα. Από τη
// «Σάρωση εγγράφου» περνούσαν πρώτα από AI (μία σάρωση από το πακέτο, το PDF
// στον πάροχο), μετά αρχειοθετούνταν σε ΕΝΑ ακίνητο και μόνο στο τέλος
// εμφανιζόταν η μαζική καταχώρηση.
//
// Τώρα:
//   PDF κάτω από `SNIFF_MAX_BYTES`  Διαβάζεται στη συσκευή και η κεφαλίδα κρίνει
//                                   (detect.ts). Ε9 ή πράξη ΕΝΦΙΑ: κατευθείαν
//                                   στη μαζική, χωρίς AI και χωρίς σάρωση από
//                                   το πακέτο. Το αντίγραφο στον Φάκελο είναι
//                                   επιλογή της μαζικής (κλειστή εξ ορισμού)
//                                   και από εκεί υπάρχει δρόμος πίσω στη σάρωση.
//   Ό,τι άλλο                       Κανονική σάρωση. Αν η σάρωση πει Ε9 ή ΕΝΦΙΑ,
//                                   το βήμα ελέγχου προτείνει τη μαζική ΠΡΙΝ από
//                                   την καταχώρηση (`offersBulk`: για PDF μόνο
//                                   αν η συσκευή δεν πρόλαβε να το κρίνει).
//
// Καθαρές συναρτήσεις: η οθόνη (DocumentScan.tsx) μόνο τις καλεί.
// ═══════════════════════════════════════════════════════════════════════════
import type { MyAadeDocKind } from './types';

/**
 * Πάνω από αυτό το μέγεθος το PDF δεν διαβάζεται στη συσκευή πριν από τη
 * σάρωση. Το Ε9 και η πράξη του myAADE είναι λίγες σελίδες και λίγα KB· ένα
 * PDF πολλών MB είναι σχεδόν πάντα σαρωμένο χαρτί χωρίς κείμενο, όπου η
 * ανάγνωση στη συσκευή θα καθυστερούσε κάθε σάρωση χωρίς να βρει τίποτα.
 */
export const SNIFF_MAX_BYTES = 5 * 1024 * 1024;

const isPdf = (mime: string, name = '') => mime === 'application/pdf' || /\.pdf$/i.test(name);

/** Αν το αρχείο διαβάζεται στη συσκευή πριν από τη σάρωση. */
export function shouldSniff(f: { type: string; name: string; size: number }): boolean {
  return isPdf(f.type, f.name) && f.size > 0 && f.size < SNIFF_MAX_BYTES;
}

export type ScanRoute = 'bulk' | 'scan';

/**
 * Πού πάει το αρχείο μετά την ανάγνωση στη συσκευή.
 *
 * `kind` είναι ό,τι βρήκε το `detectDocKind` στις γραμμές του PDF, ή `null`
 * όταν δεν διαβάστηκε (σαρωμένο, κλειδωμένο, μεγάλο). Μόνο PDF με κεφαλίδα Ε9
 * ή πράξης ΕΝΦΙΑ πάει στη μαζική: μια φωτογραφία δεν έχει κείμενο για να κρίνει
 * η κεφαλίδα, οπότε περνά από τη σάρωση.
 */
export function scanRoute(kind: MyAadeDocKind | null | undefined, mime: string, name = ''): ScanRoute {
  if (!isPdf(mime, name)) return 'scan';
  return kind === 'e9' || kind === 'enfia_act' ? 'bulk' : 'scan';
}

/**
 * Τι έμαθε η ανάγνωση στη συσκευή.
 *   read        διαβάστηκε· `kind` είναι ό,τι βρήκε η κεφαλίδα
 *   unreadable  κλειδωμένο, σαρωμένο χαρτί χωρίς κείμενο, χαλασμένο
 *   timeout     δεν πρόλαβε (`SNIFF_TIMEOUT_MS`)
 *   error       ο αναγνώστης δεν φορτώθηκε (χωρίς σύνδεση, παλιά έκδοση)
 *   skipped     δεν δοκιμάστηκε (`shouldSniff`: π.χ. από `SNIFF_MAX_BYTES` και πάνω)
 */
export type SniffOutcome = 'read' | 'unreadable' | 'timeout' | 'error' | 'skipped';
export type SniffResult =
  | { outcome: 'read'; kind: MyAadeDocKind }
  | { outcome: Exclude<SniffOutcome, 'read'> };

/**
 * Η ανάγνωση στη συσκευή, φραγμένη ώστε να ΤΕΛΕΙΩΝΕΙ ΠΑΝΤΑ (έλεγχος PR #547).
 *
 * Ηταν `setSniffing(true); await import(…)` χωρίς `finally`: αν το chunk δεν
 * κατέβαινε (χωρίς σύνδεση, ή έκδοση που άλλαξε στο μεταξύ), η ένδειξη έμενε
 * αναμμένη για πάντα. Το παράθυρο δεν έκλεινε (`scanBusy`) και κάθε επόμενο
 * αρχείο αγνοούνταν. Εδώ το `setBusy(false)` τρέχει σε κάθε έξοδο και η
 * αποτυχία γίνεται `error`, οπότε η σάρωση συνεχίζει κανονικά.
 *
 * Ο φορτωτής δίνεται απ' έξω, ώστε η οθόνη να κρατά το δυναμικό import και ο
 * έλεγχος να δοκιμάζει την αποτυχία του χωρίς δίκτυο.
 */
export async function sniffBeforeScan(
  file: File,
  load: () => Promise<{ sniffMyaade: (f: File) => Promise<SniffResult> }>,
  setBusy: (on: boolean) => void,
): Promise<SniffResult> {
  setBusy(true);
  try {
    const { sniffMyaade } = await load();
    return await sniffMyaade(file);
  } catch {
    return { outcome: 'error' };
  } finally {
    setBusy(false);
  }
}

/**
 * Αν το βήμα ελέγχου (ή η οθόνη επιτυχίας) προτείνει τη μαζική.
 *
 * ΦΩΤΟΓΡΑΦΙΑ: όταν η σάρωση είπε Ε9 ή ΕΝΦΙΑ, όπως πριν.
 * PDF: ΜΟΝΟ όταν η συσκευή δεν πρόλαβε να το κρίνει (`timeout`, `error`) ή δεν
 * το δοκίμασε (`skipped`). Ενα PDF που διαβάστηκε και η κεφαλίδα του δεν είναι
 * Ε9 ή πράξη, ή που είναι κλειδωμένο ή σαρωμένο, θα έβγαινε «λάθος έγγραφο» και
 * στη μαζική, που διαβάζει με τον ίδιο αναγνώστη: η κάρτα θα ήταν αδιέξοδο.
 */
export function offersBulk(
  scanKind: string | null | undefined,
  file: { type: string; name: string } | null | undefined,
  sniff: SniffOutcome | null | undefined,
): boolean {
  if (scanKind !== 'e9' && scanKind !== 'enfia') return false;
  if (!file || !isPdf(file.type, file.name)) return true;
  return sniff === 'timeout' || sniff === 'error' || sniff === 'skipped';
}

/**
 * Ο τίτλος της κάρτας στο βήμα ελέγχου. Η σάρωση κρατά έως `max` γραμμές
 * (SCAN_MAX_LINES), οπότε στο όριο τα ακίνητα μπορεί να είναι περισσότερα:
 * το λέμε, αντί να υποσχεθούμε ακριβή αριθμό που δεν ξέρουμε.
 */
export function bulkOfferTitle(lines: number, max: number): string {
  if (lines <= 0) return 'Το έγγραφο έχει τα ακίνητά σου';
  if (lines === 1) return 'Βρέθηκε 1 ακίνητο';
  if (lines >= max) return `Βρέθηκαν τουλάχιστον ${max} ακίνητα`;
  return `Βρέθηκαν ${lines} ακίνητα`;
}

/** Το κουμπί της κάρτας: «όλα» μόνο όταν είναι περισσότερα από ένα. */
export function bulkOfferAction(lines: number): string {
  return lines === 1 ? 'Μαζική καταχώρηση' : 'Καταχώρησε όλα';
}
