'use client';

// ═══════════════════════════════════════════════════════════════════════════
// ΑΝ ΤΟ ΤΑΜΕΙΟ ΧΡΕΩΝΕΙ, ΤΟ ΞΕΡΕΙ Ο ΔΙΑΚΟΜΙΣΤΗΣ ΚΑΙ ΤΟ ΛΕΕΙ ΣΤΗ ΦΟΡΜΑ
// ─────────────────────────────────────────────────────────────────────────
// Η φόρμα της εγγραφής είναι πελάτης και δεν μπορεί να διαβάσει τη μεταβλητή
// περιβάλλοντος του ταμείου. Ετσι έγραφε «Ετήσια χρέωση» και «να ολοκληρώσεις
// τη συνδρομή σου» ενώ η περιγραφή της ίδιας σελίδας, από το billingWords,
// έλεγε ότι δεν γίνεται καμία χρέωση. Το layout.tsx (διακομιστής) ρωτά την
// ίδια πηγή και περνά την απάντηση εδώ.
//
// `null` σημαίνει «χρεώνει»: η φόρμα γράφει τον κύκλο χρέωσης. Χωρίς πάροχο
// (π.χ. στον πάγκο δοκιμών) ισχύει αυτό.
// ═══════════════════════════════════════════════════════════════════════════
import { createContext, useContext, type ReactNode } from 'react';

const PlanTermsContext = createContext<string | null>(null);

export function PlanTermsProvider({ value, children }: { value: string | null; children: ReactNode }) {
  return <PlanTermsContext.Provider value={value}>{children}</PlanTermsContext.Provider>;
}

/** Η γραμμή των όρων του πακέτου όσο δεν χρεώνουμε, αλλιώς `null`. */
export const usePlanTerms = (): string | null => useContext(PlanTermsContext);
