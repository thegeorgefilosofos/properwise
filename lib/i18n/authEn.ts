'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΑΓΓΛΙΚΟ ΚΕΙΜΕΝΟ ΤΗΣ ΕΙΣΟΔΟΥ ΦΤΑΝΕΙ ΜΟΝΟ ΣΤΙΣ ΑΓΓΛΙΚΕΣ ΣΕΛΙΔΕΣ
// ─────────────────────────────────────────────────────────────────────────
// ΜΕΤΡΗΜΕΝΟ (02.11.2026, scripts/perf-budget.mjs). Η σύνδεση, η εγγραφή και η
// επαναφορά έγιναν δίγλωσσες με `useLocale()` και `en ? AUTH_EN.x : '…'`:
// το λεξικό (lib/i18n/en/auth.ts) εισαγόταν στατικά από τα κοινά components,
// οπότε κατέβαινε ΚΑΙ στις ελληνικές σελίδες μαζί με ό,τι τραβούσε από πίσω
// του (πακέτα, δικαιώματα, κανόνες κωδικού). Το /login πήγε 163,4 → 178,1 KB
// και το /signup 170,6 → 185,1 KB, πάνω από την ανοχή, για κείμενο που ο
// Ελληνας επισκέπτης δεν βλέπει ποτέ.
//
// ΤΩΡΑ ΤΟ ΛΕΞΙΚΟ ΤΟ ΔΙΝΕΙ ΤΟ LAYOUT ΤΟΥ /en. Το app/en/AuthEnProvider.tsx
// είναι το ΜΟΝΟ component πελάτη που εισάγει το λεξικό. Το βάζουν μόνο τα
// layouts κάτω από το app/en. Οι οθόνες ρωτούν `useAuthEn()`: `null` σημαίνει
// ελληνικά. Εδώ ζει μόνο ο τύπος — `import type`, που δεν φτάνει στο πακέτο.
//
// ΜΗΝ ΞΑΝΑΕΙΣΑΓΕΙΣ ΤΟ lib/i18n/en/auth.ts ΣΕ COMPONENT ΠΕΛΑΤΗ ΕΞΩ ΑΠΟ ΤΟ /en.
// ═══════════════════════════════════════════════════════════════════════════
import { createContext, useContext } from 'react';
import type { AUTH_EN, authFailedEn } from '@/lib/i18n/en/auth';
import type { PLAN_COPY_EN } from '@/lib/i18n/en/plans';

export type AuthEn = typeof AUTH_EN & {
  /** «Τι δεν έγινε. Γιατί.» στα αγγλικά (lib/i18n/en/auth.ts). */
  failed: typeof authFailedEn;
  /** Τα ονόματα των πακέτων στα αγγλικά, για τη σύνοψη της εγγραφής. */
  plans: typeof PLAN_COPY_EN;
};

export const AuthEnContext = createContext<AuthEn | null>(null);

/** Το αγγλικό κείμενο της οθόνης, ή `null` στις ελληνικές σελίδες. */
export function useAuthEn(): AuthEn | null {
  return useContext(AuthEnContext);
}
