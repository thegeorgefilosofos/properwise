// ═══════════════════════════════════════════════════════════════════════════
// Ο ΕΝΦΙΑ ΤΟΥ ΕΤΟΥΣ: ΜΙΑ ΠΗΓΗ, ΜΑΖΙ ΜΕ ΤΙΣ ΔΟΣΕΙΣ ΚΑΙ ΤΙΣ ΗΜΕΡΟΜΗΝΙΕΣ ΤΟΥΣ
// ─────────────────────────────────────────────────────────────────────────
// Η `enfiaForYear` ζούσε στο app/dashboard/components/useEnfia.ts, αρχείο
// πελάτη· την καλούσε μόνο η Λογιστική. Η Επισκόπηση έγραφε δίπλα στα
// στοιχεία του ακινήτου «Εκτιμώμενος ΕΝΦΙΑ» το ωμό `user_properties.enfia`,
// δηλαδή άλλο ποσό από την Κατάσταση για το ίδιο έτος και με λάθος όνομα: το
// ποσό εκείνο είναι του εκκαθαριστικού, όχι εκτίμηση. Ο Προϋπολογισμός και οι
// Λογαριασμοί είχαν δική τους σειρά πηγών (lib/billing/propertyFacts.ts
// `resolveEnfia`, ανάποδα από εδώ).
//
// Εδώ ο κανόνας: δηλωμένο φετινό (φόρμα ή καρτέλα) > περσινό > εκτίμηση, με
// την πηγή του· και οι δώδεκα δόσεις με ημερομηνία από το φορολογικό ημερολόγιο
// (lib/tools/enfiaSchedule.ts). Τα ποσά τα υπολογίζει το lib/billing/enfia.ts.
// ═══════════════════════════════════════════════════════════════════════════
import {
  estimateENFIA, estimateENFIAFromFacts, atticaMainlandFromPostcode, enfiaInUse, enfiaLastYearAnnual,
  type ENFIAResult, type EnfiaInUse,
} from '@/lib/billing/enfia';
import { resolveEnfia } from '@/lib/billing/propertyFacts';
import { enfiaInstalments, grDateLong, type EnfiaInstalment } from '@/lib/tools/enfiaSchedule';
import { enfiaDueDates } from './deadlines';
import { ENFIA_LABELS } from './labels';

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
  /** Ο ΤΚ του ακινήτου· κρίνει αν ισχύει η μείωση του μικρού οικισμού (Αττική). */
  postalCode?: string | null;
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
  /** Ηπειρωτική Αττική από τον ΤΚ· `null` όταν δεν ξέρουμε. */
  atticaMainland: boolean | null;
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
  const atticaMainland = atticaMainlandFromPostcode(facts.postalCode);
  const detailed = estimateENFIA({
    sqm: num(s.enfiaSqm),
    zone: s.enfiaZone,
    floor: s.enfiaFloor || undefined,
    age: s.enfiaAge || undefined,
    ownership: num(s.enfiaOwnership) || 100,
    totalValue: num(s.enfiaTotalVal),
    propertyValue: num(s.enfiaPropVal),
    reductions: s.enfiaReductions || [],
    atticaMainland,
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
    atticaMainland,
  };
}


export interface EnfiaYear extends EnfiaNow {
  year: number;
  /** Το ετήσιο σε χρήση. */
  annual: number;
  /** Η ετικέτα που λέει από πού βγήκε. */
  label: string;
  /** Οι δώδεκα δόσεις του έτους, με ημερομηνία· κενό χωρίς ποσό. */
  instalments: EnfiaInstalment[];
  /**
   * `true` όταν και οι δώδεκα ημερομηνίες είναι του νόμου, για εκκαθαριστικό
   * που έχει εκδοθεί. Αλλιώς οι ενδιάμεσες είναι προβολή του περσινού μοτίβου.
   */
  datesConfirmed: boolean;
}

/** Ο ΕΝΦΙΑ του έτους με την ετικέτα και τις δόσεις του. Η μία απάντηση για κάθε οθόνη. */
export function enfiaYear(s: EnfiaSettings, year: number, facts: EnfiaFacts = {}): EnfiaYear {
  const now = enfiaForYear(s, year, facts);
  const annual = now.inUse.annual;
  const src = now.inUse.source;
  const label = ENFIA_LABELS[src];
  // ΟΙ ΗΜΕΡΟΜΗΝΙΕΣ ΕΙΝΑΙ ΤΟΥ ΦΟΡΟΛΟΓΙΚΟΥ ΗΜΕΡΟΛΟΓΙΟΥ, τα ποσά του προγράμματος
  // δόσεων. Το πρόγραμμα έβγαζε πάντα Μάρτιο ως Φεβρουάριο· το ημερολόγιο ξέρει
  // τον μήνα έκδοσης κάθε εκκαθαριστικού. Όπου το ημερολόγιο δεν έχει ημερομηνία
  // (έτος χωρίς απόφαση), μένει η προβολή και το `datesConfirmed` το λέει.
  const due = enfiaDueDates(year);
  const byNo = new Map(due.map(d => [d.no, d]));
  const instalments = enfiaInstalments(annual, year).map(i => {
    const d = byNo.get(i.no);
    return d ? { ...i, date: d.date, label: grDateLong(d.date) } : i;
  });
  const datesConfirmed = instalments.length > 0
    && instalments.every(i => byNo.get(i.no)?.confidence === 'statutory');
  return { ...now, year, annual, label, instalments, datesConfirmed };
}
