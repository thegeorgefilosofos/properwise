// ═══════════════════════════════════════════════════════════════════════════
// ΤΙ ΕΓΓΡΑΦΟ ΑΝΕΒΗΚΕ: ΠΡΑΞΗ ΕΝΦΙΑ, Ε9 Ή ΚΑΤΙ ΑΛΛΟ
// ─────────────────────────────────────────────────────────────────────────
// Κοιτά ΜΟΝΟ τις πρώτες γραμμές (κεφαλίδα), όχι όλο το κείμενο: ένα
// εκκαθαριστικό φόρου εισοδήματος μπορεί να αναφέρει «ΕΝΦΙΑ» σε υποσημείωση και
// δεν είναι γι' αυτό πράξη ΕΝΦΙΑ. Οι φράσεις ζουν στο `labels.ts`, ως υποθέσεις.
// ═══════════════════════════════════════════════════════════════════════════
import { fold } from '@/lib/tax/aadeE2';
import { ENFIA_ACT_MARKS, E9_MARKS } from './labels';
import type { MyAadeDocKind } from './types';

/** Πόσες γραμμές μετρούν ως κεφαλίδα. */
export const HEAD_LINES = 25;

const matches = (head: string, groups: readonly (readonly RegExp[])[]) =>
  groups.some(g => g.every(re => re.test(head)));

/** Το είδος του εγγράφου από τις γραμμές του PDF (έξοδος του `extractPdfText`). */
export function detectDocKind(lines: readonly string[]): MyAadeDocKind {
  const head = lines.slice(0, HEAD_LINES).map(fold).join('\n');
  // Η πράξη ΕΝΦΙΑ λέγεται και «δήλωση ΕΝΦΙΑ»: ελέγχεται πρώτη, ώστε η λέξη
  // «ΔΗΛΩΣΗ» να μην τη στείλει στο Ε9.
  if (matches(head, ENFIA_ACT_MARKS)) return 'enfia_act';
  if (matches(head, E9_MARKS)) return 'e9';
  return 'unknown';
}
