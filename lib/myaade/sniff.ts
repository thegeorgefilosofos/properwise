// ═══════════════════════════════════════════════════════════════════════════
// ΤΙ ΕΙΝΑΙ ΑΥΤΟ ΤΟ PDF, ΣΤΗ ΣΥΣΚΕΥΗ, ΠΡΙΝ ΦΥΓΕΙ ΟΤΙΔΗΠΟΤΕ
// ─────────────────────────────────────────────────────────────────────────
// Η Σάρωση το φορτώνει με δυναμικό import, μόνο όταν ανέβει PDF: ο αναγνώστης
// PDF και οι ετικέτες της κεφαλίδας δεν μπαίνουν στο πρώτο φόρτωμα.
// Καμία αποτυχία δεν σταματά τη σάρωση: η κανονική ροή συνεχίζει. Τίποτα από
// το περιεχόμενο δεν καταγράφεται.
// ═══════════════════════════════════════════════════════════════════════════
import { readPdfText, PdfReadError } from './readPdf';
import { detectDocKind } from './detect';
import type { SniffResult } from './route';

/**
 * Πόσο περιμένει η σάρωση πριν συνεχίσει χωρίς απάντηση. ΕΠΙΛΟΓΗ ΠΡΟΪΟΝΤΟΣ.
 *
 * Ζεστός, ο αναγνώστης διαβάζει το Ε9 ή την πράξη σε κλάσματα του
 * δευτερολέπτου. Κρύος, στο πρώτο PDF της επίσκεψης, κατεβάζει πρώτα τον εργάτη
 * και τον αναγνώστη PDF, που σε αργή σύνδεση κινητού παίρνει μερικά
 * δευτερόλεπτα· τα 4 της πρώτης έκδοσης έκοβαν ακριβώς αυτή την περίπτωση και
 * έστελναν στο AI ένα Ε9 που θα διαβαζόταν στη συσκευή. Τα 8 χωρούν το κρύο
 * φόρτωμα και μένουν πολύ κάτω από τα 20 του `PDF_TIMEOUT_MS`: ο χρήστης βλέπει
 * «Ανοίγω το PDF…» και η αναμονή μένει σύντομη. Αν περάσουν, τίποτα δεν
 * χάνεται: η σάρωση συνεχίζει και το βήμα ελέγχου προτείνει τη μαζική.
 * Το chunk ζητείται και από πριν, μόλις ανοίξει η Σάρωση (DocumentScan.tsx).
 */
export const SNIFF_TIMEOUT_MS = 8_000;

/** Το αποτέλεσμα της ανάγνωσης, με το γιατί όταν δεν βγήκε είδος. */
export async function sniffMyaade(file: File): Promise<SniffResult> {
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<'late'>(resolve => { timer = setTimeout(() => resolve('late'), SNIFF_TIMEOUT_MS); });
    const res = await Promise.race([readPdfText(file, () => {}), late]).finally(() => clearTimeout(timer));
    if (res === 'late') return { outcome: 'timeout' };
    if (res.failure) return { outcome: 'unreadable' };
    return { outcome: 'read', kind: detectDocKind(res.lines) };
  } catch (e) {
    // Το ίδιο το αρχείο δεν ανοίγει (χαλασμένο, όχι PDF): ούτε η μαζική θα το
    // διάβαζε. Ό,τι άλλο σημαίνει «δεν ξέρουμε»: ο αναγνώστης δεν κατέβηκε, ή το
    // σενάριο του εργάτη δεν φορτώθηκε (`PdfWorkerLoadError`, δεν είναι PdfReadError).
    return { outcome: e instanceof PdfReadError ? 'unreadable' : 'error' };
  }
}
