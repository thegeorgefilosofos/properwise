// ═══════════════════════════════════════════════════════════════════════════
// ΤΙ ΕΙΝΑΙ ΑΥΤΟ ΤΟ PDF, ΣΤΗ ΣΥΣΚΕΥΗ, ΠΡΙΝ ΦΥΓΕΙ ΟΤΙΔΗΠΟΤΕ
// ─────────────────────────────────────────────────────────────────────────
// Η Σάρωση το φορτώνει με δυναμικό import, μόνο όταν ανέβει PDF: ο αναγνώστης
// PDF και οι ετικέτες της κεφαλίδας δεν μπαίνουν στο πρώτο φόρτωμα.
// Καμία αποτυχία δεν σταματά τη σάρωση: `null` σημαίνει «δεν ξέρουμε» και η
// κανονική ροή συνεχίζει. Τίποτα από το περιεχόμενο δεν καταγράφεται.
// ═══════════════════════════════════════════════════════════════════════════
import { readPdfText } from './readPdf';
import { detectDocKind } from './detect';
import type { MyAadeDocKind } from './types';

/**
 * Πόσο περιμένει η σάρωση. Το Ε9 και η πράξη διαβάζονται σε κλάσματα του
 * δευτερολέπτου· ό,τι αργεί περισσότερο δεν είναι αυτό που ψάχνουμε και η
 * σάρωση δεν πρέπει να κρέμεται για τα 20 δευτερόλεπτα του `PDF_TIMEOUT_MS`.
 */
export const SNIFF_TIMEOUT_MS = 4_000;

/** Το είδος του PDF από την κεφαλίδα του, ή `null` όταν δεν διαβάστηκε. */
export async function sniffMyaadeKind(file: File): Promise<MyAadeDocKind | null> {
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), SNIFF_TIMEOUT_MS); });
    const res = await Promise.race([readPdfText(file, () => {}), late]).finally(() => clearTimeout(timer));
    if (!res) return null;
    if (res.failure) return null;
    return detectDocKind(res.lines);
  } catch {
    return null;
  }
}
