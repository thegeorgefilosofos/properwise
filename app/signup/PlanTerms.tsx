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
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PlanId } from '@/lib/billing/plans';

/** Το λεκτικό του κουμπιού ανά πακέτο του `?plan=`· `none` χωρίς πακέτο. */
export type SignupCtas = Record<PlanId | 'none', string>;

interface SignupTerms { planTerms: string | null; trialBadge: string | null; ctas?: SignupCtas | null }

const PlanTermsContext = createContext<SignupTerms>({ planTerms: null, trialBadge: null, ctas: null });

export function PlanTermsProvider({ value, children }: { value: SignupTerms; children: ReactNode }) {
  return <PlanTermsContext.Provider value={value}>{children}</PlanTermsContext.Provider>;
}

/** Η γραμμή των όρων του πακέτου όσο δεν χρεώνουμε, αλλιώς `null`. */
export const usePlanTerms = (): string | null => useContext(PlanTermsContext).planTerms;

/** Το σήμα της δοκιμής δίπλα στον τίτλο, από το `billingWords().trialBadge`. */
export const useTrialBadge = (): string | null => useContext(PlanTermsContext).trialBadge;

/**
 * ΤΟ ΛΕΚΤΙΚΟ ΤΟΥ ΚΟΥΜΠΙΟΥ ΕΡΧΕΤΑΙ ΕΤΟΙΜΟ ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ (07.10.2026).
 *
 * Το `signupCta` ζει στο lib/billing/trialOffer.ts, δίπλα στο `TRIAL_OFFER`,
 * που διαβάζει τα όρια της δοκιμής από το aiLimits και το όνομα της Νόας από
 * το lib/assistant/identity. Η εισαγωγή του από τη φόρμα κατέβαζε και τα τρία
 * στον περιηγητή: μετρημένα ~4 KB gzip στο αρχικό JS της εγγραφής, για μία
 * λέξη στο κουμπί. Το layout.tsx ρωτά την ίδια συνάρτηση για κάθε πακέτο και
 * περνά τον πίνακα εδώ· ο κανόνας μένει γραμμένος μία φορά.
 *
 * Χωρίς πάροχο (ο πάγκος του scripts/e2e-signup αποδίδει σκέτη τη σελίδα) η
 * ίδια συνάρτηση φορτώνεται αργότερα, εκτός του αρχικού φορτίου.
 */
export function useSignupCta(plan: PlanId | null): string {
  const ctas = useContext(PlanTermsContext).ctas;
  const key = plan ?? 'none';
  const [late, setLate] = useState<{ key: string; label: string } | null>(null);
  useEffect(() => {
    if (ctas) return;
    let live = true;
    import('@/lib/billing/trialOffer')
      .then(m => { if (live) setLate({ key, label: m.signupCta(plan) }); })
      .catch(() => {});
    return () => { live = false; };
  }, [ctas, key, plan]);
  if (ctas) return ctas[key];
  return late?.key === key ? late.label : '';
}
