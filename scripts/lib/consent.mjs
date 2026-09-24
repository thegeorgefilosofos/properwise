// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΚΔΟΣΗ ΤΗΣ ΣΥΓΚΑΤΑΘΕΣΗΣ ΣΤΟΥΣ ΣΑΡΩΤΕΣ, ΑΠΟ ΤΗΝ ΠΗΓΗ ΤΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Τέσσερις σαρωτές έγραφαν «2026-08» με το χέρι για να κρύψουν το πλαίσιο
// cookies. Μόλις το πλαίσιο πήρε την έκδοση από τα νομικά κείμενα και αυτή
// έγινε «2026-09», το πλαίσιο ξαναβγήκε σε κάθε σελίδα και ο έλεγχος αφής
// μετρούσε το δικό του «Απόρρητο» αντί για τη σελίδα.
//
// Εδώ η έκδοση διαβάζεται από το lib/legal/identity.ts: αλλάζει μία φορά
// εκεί και οι σαρωτές ακολουθούν.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './paths.mjs';

const src = readFileSync(join(repoRoot, 'lib/legal/identity.ts'), 'utf8');
const m = src.match(/export const POLICY_VERSION\s*=\s*'([^']+)'/);
if (!m) throw new Error('consent.mjs: δεν βρέθηκε το POLICY_VERSION στο lib/legal/identity.ts');

/** Η τρέχουσα έκδοση της Πολιτικής απορρήτου. */
export const POLICY_VERSION = m[1];

/** Ό,τι γράφει το πλαίσιο cookies στο localStorage όταν πατηθεί «Το κατάλαβα». */
export const CONSENT_SEED = JSON.stringify({ v: POLICY_VERSION, ts: 'x' });

/**
 * Σενάριο αρχικοποίησης για `addInitScript`: η σελίδα ανοίγει σαν να έχει ήδη
 * δει την ενημέρωση. Ως κείμενο, γιατί τρέχει μέσα στη σελίδα και δεν βλέπει
 * τις μεταβλητές αυτού του αρχείου.
 */
export const SEED_CONSENT = `try { localStorage.setItem('pos-cookie-consent', ${JSON.stringify(CONSENT_SEED)}) } catch { /* κενό */ }`;
