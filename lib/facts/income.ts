// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΕΣΟΔΑ ΕΝΟΙΚΙΟΥ: ΤΙ ΜΠΗΚΕ, ΤΙ ΠΡΟΒΛΕΠΕΙ Η ΜΙΣΘΩΣΗ, ΤΙ ΥΠΟΘΕΤΟΥΜΕ
// ─────────────────────────────────────────────────────────────────────────
// Ο υπολογισμός ζει στο lib/income/propertyIncome.ts (διαμονές, αλλιώς δόσεις,
// αλλιώς εκτίμηση από το μίσθωμα). Εδώ μπαίνουν δύο κανόνες που κάθε οθόνη
// εφάρμοζε μόνη της ή δεν εφάρμοζε καθόλου:
//
//   1. ΧΩΡΙΣ ΜΙΣΘΩΣΗ, ΚΑΜΙΑ ΕΚΤΙΜΗΣΗ. Ακίνητο σε ιδιοχρησία, κενό, προς πώληση
//      ή αμφισβητούμενο δεν παίρνει «έσοδα» από τον στόχο ενοικίου ή από
//      ξεχασμένο μίσθωμα. Ό,τι εισπράχθηκε ΠΡΑΓΜΑΤΙΚΑ μέσα στο έτος (ο
//      ενοικιαστής που έφυγε τον Ιούνιο) μένει: είναι χρήμα που μπήκε και
//      δηλώνεται. Αναμενόμενα και ετήσιος ρυθμός μηδενίζονται.
//   2. Ο ΕΤΗΣΙΟΣ ΡΥΘΜΟΣ ΕΙΝΑΙ ΕΚΤΙΜΗΣΗ ΚΑΙ ΤΟ ΛΕΕΙ. Τα «ως σήμερα» επί 12 / μήνες
//      δεν είναι γεγονός· όποια οθόνη τα δείχνει, τα δείχνει με το `estimated`.
//
// ΑΝΑΜΕΝΟΜΕΝΑ ΜΕ ΒΑΣΗ ΤΗ ΜΙΣΘΩΣΗ: το μηνιαίο μίσθωμα του ενοικιαστή επί 12.
// Ποτέ ο στόχος του ακινήτου: εκείνος δεν συμφωνήθηκε με κανέναν.
// ═══════════════════════════════════════════════════════════════════════════
import { propertyIncome, type PropertyIncomeInput, type IncomeSource } from '@/lib/income/propertyIncome';
import { roundHalfUp } from '@/lib/core/money';
import { isLease, type PropertyStatus } from './status';

export interface RentIncome {
  status: PropertyStatus;
  /** Από πού βγήκαν τα ποσά. */
  source: IncomeSource;
  /** Εισπράχθηκαν μέσα στο έτος ως και σήμερα. */
  received: number;
  /** Ετήσιο με βάση τη μίσθωση (μίσθωμα × 12)· 0 χωρίς μίσθωση ή χωρίς μίσθωμα. */
  expected: number;
  /** Ο ετήσιος ρυθμός· 0 χωρίς μίσθωση. */
  annualized: number;
  /** Το ποσό δεν είναι βέβαιο: εκτίμηση από μίσθωμα ή διαμονές χωρίς βάση ποσού. */
  estimated: boolean;
  /** Ο ετήσιος ρυθμός είναι προβολή (μέσα στη χρονιά): δείχνεται ΜΟΝΟ με τη λέξη «εκτίμηση». */
  projected: boolean;
  /** Διαμονές με απροσδιόριστη βάση ποσού. */
  unresolvedStays: number;
}

export interface RentIncomeInput extends PropertyIncomeInput {
  status: PropertyStatus;
}

export function rentIncome(i: RentIncomeInput): RentIncome {
  const let_ = isLease(i.status);
  const inc = propertyIncome({ ...i, estimateMonthly: let_ ? i.estimateMonthly : null });
  // Χωρίς μίσθωση μένει μόνο ό,τι εισπράχθηκε πραγματικά (δόσεις ή διαμονές).
  const realSource = inc.source === 'rent' || inc.source === 'stays';
  const monthly = Number(i.estimateMonthly) || 0;
  return {
    status: i.status,
    source: let_ ? inc.source : realSource ? inc.source : 'none',
    received: let_ || realSource ? inc.receivedToDate : 0,
    expected: let_ && monthly > 0 ? roundHalfUp(monthly * 12, 2) : 0,
    annualized: let_ ? inc.annualized : 0,
    estimated: let_ && inc.estimated,
    // Ο ρυθμός μέσα στη χρονιά είναι προβολή· σε κλεισμένο έτος είναι ίσος με τα εισπραγμένα.
    projected: let_ && inc.annualized !== inc.receivedToDate,
    unresolvedStays: inc.unresolvedStays,
  };
}
