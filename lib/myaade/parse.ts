// ═══════════════════════════════════════════════════════════════════════════
// ΠΟΙΟΣ ΑΝΑΛΥΤΗΣ ΔΙΑΒΑΖΕΙ ΤΟ PDF: ΠΡΑΞΗ ΕΝΦΙΑ, Ε9 Ή ΑΡΝΗΣΗ ΜΕ ΛΟΓΟ
// ─────────────────────────────────────────────────────────────────────────
// Η μαζική καταχώρηση (απόφαση ιδιοκτήτη 09/11/2026) δέχεται και τα δύο
// έγγραφα του myAADE. Η κεφαλίδα κρίνει (detect.ts)· κάθε άλλο έγγραφο
// επιστρέφει `unrecognized` με μία πρόταση που λέει τι ανέβηκε και τι θέλουμε.
// Το εκκαθαριστικό φόρου εισοδήματος (Ε1) είναι το πιο συχνό λάθος: λέγεται
// με το όνομά του.
// ═══════════════════════════════════════════════════════════════════════════
import { fold } from '@/lib/tax/aadeE2';
import { detectDocKind, HEAD_LINES } from './detect';
import { parseEnfiaAct } from './enfiaAct';
import { parseE9 } from './e9';
import type { MyAadeParse } from './types';

/** Ο τίτλος κάθε άρνησης εγγράφου: ένας, ίδιος για PDF και φωτογραφία. */
export const WRONG_DOC_TITLE = 'Αυτό δεν είναι Ε9 ούτε πράξη ΕΝΦΙΑ';
/** Τι θέλουμε, σε μία γραμμή. */
export const WANT_DOC = 'Ανέβασε το Ε9 ή την πράξη ΕΝΦΙΑ του myAADE, σε PDF ή φωτογραφία.';

/** Εκκαθαριστικό ή δήλωση φόρου εισοδήματος, από την κεφαλίδα. */
export const INCOME_TAX = /ΦΟΡΟΥ ΕΙΣΟΔΗΜΑΤΟΣ|ΦΟΡΟΛΟΓΙΑΣ ΕΙΣΟΔΗΜΑΤΟΣ|(?<!\p{L})Ε ?1(?!\d)/u;
export const INCOME_TAX_REASON = 'Είναι εκκαθαριστικό ή δήλωση φόρου εισοδήματος (Ε1). Τα ακίνητα είναι στο Ε9 και στην πράξη ΕΝΦΙΑ.';

/** Το PDF του myAADE, από τις γραμμές του. Καθαρή συνάρτηση. */
export function parseMyaadeLines(lines: readonly string[]): MyAadeParse {
  const kind = detectDocKind(lines);
  if (kind === 'enfia_act') return parseEnfiaAct(lines);
  if (kind === 'e9') return parseE9(lines);
  const head = lines.slice(0, HEAD_LINES).map(fold).join('\n');
  return {
    status: 'unrecognized', kind,
    reason: INCOME_TAX.test(head) ? INCOME_TAX_REASON : 'Δεν βρήκαμε στην κεφαλίδα ούτε «Βεβαίωση δηλωθείσας περιουσιακής κατάστασης» ούτε «Πράξη προσδιορισμού ΕΝΦΙΑ».',
  };
}
