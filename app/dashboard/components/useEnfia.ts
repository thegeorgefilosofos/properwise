'use client';

// ═══════════════════════════════════════════════════════════════════════════
// Ο ΕΝΦΙΑ ΤΗΣ ΛΟΓΙΣΤΙΚΗΣ, ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΡΙΑ ΠΟΣΑ ΣΤΗΝ ΙΔΙΑ ΟΘΟΝΗ. Η Κατάσταση Αποτελεσμάτων έγραφε «ΕΝΦΙΑ
// −108,78€» από δική της εκτίμηση (αξία και τετραγωνικά του ακινήτου). Λίγο πιο
// κάτω, ο Υπολογισμός ΕΝΦΙΑ έγραφε «ΕΝΦΙΑ τον χρόνο 428,00€ · Περσινό ποσό» και
// στο πλακίδιο της εκτίμησης 155,40€ από τη ΔΙΚΗ ΤΟΥ φόρμα. Ο πίνακας κρατούσε
// τις ρυθμίσεις του μόνος του και τίποτα από αυτές δεν έφτανε στην Κατάσταση:
// η πρόβλεψη φόρου αγνοούσε τα 428€ που ο ιδιοκτήτης είχε μόλις γράψει.
//
// ΤΩΡΑ Η ΑΠΑΝΤΗΣΗ ΒΓΑΙΝΕΙ ΕΔΩ ΚΑΙ ΟΙ ΔΥΟ ΤΗ ΔΙΑΒΑΖΟΥΝ. Η Λογιστική κρατά τις
// ρυθμίσεις (ένα `useBillsSettings`, όχι δύο αντίγραφα που θα απέκλιναν) και
// περνά στον πίνακα και τις ρυθμίσεις και το αποτέλεσμα. Η σειρά αξιοπιστίας
// είναι αυτή του `enfiaInUse`: φετινό, περσινό, εκτίμηση.
//
// ΜΙΑ ΕΚΤΙΜΗΣΗ, ΟΧΙ ΔΥΟ. Όταν ο ιδιοκτήτης έχει συμπληρώσει τη φόρμα του
// πίνακα (ζώνη, εμβαδόν, όροφος), η εκτίμηση βγαίνει από εκεί: είναι δικά του
// στοιχεία. Αλλιώς βγαίνει από τα στοιχεία της καρτέλας του ακινήτου με την
// `estimateENFIAFromFacts`. Το ίδιο νούμερο φαίνεται στο πλακίδιο της
// εκτίμησης και, όταν είναι αυτό σε χρήση, στην Κατάσταση.
// ═══════════════════════════════════════════════════════════════════════════

import { useBillsSettings } from './BillsSettings';
import {
  estimateENFIA, estimateENFIAFromFacts, enfiaInUse, enfiaLastYearAnnual,
  type ENFIAResult, type EnfiaInUse,
} from '@/lib/billing/enfia';
import { resolveEnfia } from '@/lib/billing/propertyFacts';

// Το «Δεν γνωρίζω» ΔΕΝ είναι απουσία επιλογής: είναι η ουδέτερη επιλογή, με
// συντελεστή 1,00. Ο χρήστης πρέπει να μπορεί να τη διαλέξει ρητά και να
// είναι αυτή που βρίσκει μπροστά του.
export const ENFIA_UNKNOWN = '';

export const ENFIA_DEFAULTS = {
  // Φετινό, αν το έχει ήδη στα χέρια του.
  enfiaAnnual: '', enfiaMonthly: '',
  // Περσινό: το ένα από τα δύο αρκεί.
  enfiaLastAnnual: '', enfiaLastInstalment: '', enfiaLastCount: ENFIA_UNKNOWN,
  // Εκτίμηση, μόνο όταν δεν υπάρχει κανένα από τα δύο.
  enfiaSqm: '', enfiaZone: ENFIA_UNKNOWN, enfiaFloor: ENFIA_UNKNOWN, enfiaAge: ENFIA_UNKNOWN,
  enfiaOwnership: '100', enfiaTotalVal: '', enfiaPropVal: '',
  enfiaReductions: [] as string[],
};

export type EnfiaSettings = typeof ENFIA_DEFAULTS;

/** Τα στοιχεία του ακινήτου που ξέρει ήδη η εφαρμογή. */
export interface EnfiaFacts {
  /** Το «ΕΝΦΙΑ που πληρώνεις» της καρτέλας του ακινήτου, ήδη στο μερίδιο. */
  stored?: number | null;
  value?: number | null;
  sqm?: number | null;
  yearBuilt?: number | string | null;
  floor?: string | number | null;
  propType?: string | null;
  ownershipPct?: number | null;
}

export interface EnfiaNow {
  /** Το ποσό σε χρήση και από πού ήρθε. */
  inUse: EnfiaInUse;
  /** Το φετινό δηλωμένο προέρχεται από τον πίνακα ή από την καρτέλα του ακινήτου. */
  declaredFrom: 'form' | 'property' | null;
  /** Το περσινό, όπως το έγραψε ο ιδιοκτήτης (0 όταν λείπει). */
  lastYear: number;
  /** Η ανάλυση της φόρμας του πίνακα, όταν έχει συμπληρωθεί. */
  detailed: ENFIAResult | null;
  /** Η εκτίμηση που θα χρησιμοποιούνταν (0 όταν δεν βγαίνει καμία). */
  estimate: number;
  /** Από πού βγαίνει η εκτίμηση. */
  estimateFrom: 'form' | 'facts' | null;
}

const num = (v: string): number => parseFloat(v) || 0;

/**
 * Ο ΕΝΦΙΑ ενός ακινήτου για ένα έτος. Καθαρή συνάρτηση: ό,τι γράφει η φόρμα του
 * πίνακα και ό,τι ξέρει η καρτέλα του ακινήτου, μία απάντηση.
 */
export function enfiaForYear(s: EnfiaSettings, year: number, facts: EnfiaFacts = {}): EnfiaNow {
  const lastYear = enfiaLastYearAnnual({
    annual: s.enfiaLastAnnual, instalment: s.enfiaLastInstalment, instalments: s.enfiaLastCount,
  });
  // Ο όροφος και η παλαιότητα περνούν ΟΠΩΣ ΕΙΝΑΙ: κενό σημαίνει άγνωστο και η
  // μηχανή το μεταφράζει σε 1,00. Καμία προεπιλογή που να σπρώχνει προς τα πάνω.
  const detailed = estimateENFIA({
    sqm: num(s.enfiaSqm),
    zone: s.enfiaZone,
    floor: s.enfiaFloor || undefined,
    age: s.enfiaAge || undefined,
    ownership: num(s.enfiaOwnership) || 100,
    totalValue: num(s.enfiaTotalVal),
    propertyValue: num(s.enfiaPropVal),
    reductions: s.enfiaReductions || [],
    year,
  });
  const fromFacts = detailed ? null : estimateENFIAFromFacts({
    value: facts.value, sqm: facts.sqm, yearBuilt: facts.yearBuilt, floor: facts.floor,
    taxYear: year, propType: facts.propType, ownershipPct: facts.ownershipPct,
  });
  const estimate = detailed?.annual ?? fromFacts?.annual ?? 0;

  // ΤΟ ΦΕΤΙΝΟ ΤΟΥ ΠΙΝΑΚΑ ΠΡΙΝ ΑΠΟ ΤΟ ΠΟΣΟ ΤΗΣ ΚΑΡΤΕΛΑΣ. Και τα δύο είναι ποσά
  // που έγραψε ο ιδιοκτήτης· αυτό του πίνακα ζητά ρητά το ΦΕΤΙΝΟ εκκαθαριστικό,
  // ενώ της καρτέλας μπορεί να γράφτηκε πριν από χρόνια. Και μόνο έτσι μια
  // διόρθωση στον πίνακα φαίνεται αμέσως στην Κατάσταση.
  const formDeclared = enfiaInUse(s.enfiaAnnual, s.enfiaMonthly, 0).annual;
  const stored = resolveEnfia({ propertyEnfia: facts.stored }).annual;
  const declared = formDeclared || stored;
  const inUse = enfiaInUse(declared, '', estimate, lastYear);

  return {
    inUse,
    declaredFrom: formDeclared > 0 ? 'form' : stored > 0 ? 'property' : null,
    lastYear,
    detailed,
    estimate,
    estimateFrom: detailed ? 'form' : fromFacts ? 'facts' : null,
  };
}

/** Οι ρυθμίσεις ΕΝΦΙΑ του ακινήτου: μία ανάγνωση για Κατάσταση και πίνακα. */
export function useEnfiaSettings(propertyId: string, userId: string) {
  return useBillsSettings(propertyId, userId, 'services', ENFIA_DEFAULTS);
}

/** Ό,τι χρειάζεται ο πίνακας ΕΝΦΙΑ από τον γονέα του. */
export interface EnfiaState {
  settings: EnfiaSettings;
  update: (patch: Partial<EnfiaSettings>) => void;
  loading: boolean;
  now: EnfiaNow;
}
