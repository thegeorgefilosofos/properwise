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
import { YIELD_INCOME_LABELS, YIELD_INCOME_SHORT_LABELS } from './labels';

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

// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΕΣΟΔΟ ΤΗΣ ΑΠΟΔΟΣΗΣ: ΕΝΑΣ ΟΡΙΣΜΟΣ ΓΙΑ ΕΠΙΣΚΟΠΗΣΗ ΚΑΙ ΑΠΟΔΟΣΕΙΣ (07.10.2026)
// ─────────────────────────────────────────────────────────────────────────
// Για το ίδιο ακίνητο με μίσθωση 650€ τον μήνα, εννέα πληρωμένες δόσεις και
// μία καθυστερημένη, η Επισκόπηση έγραφε μεικτή απόδοση πάνω σε 7.800€ (το
// μίσθωμα × 12) και οι Αποδόσεις πάνω στις δόσεις σε ετήσιο ρυθμό, 7.020€. Δύο
// ποσοστά με το ίδιο όνομα για το ίδιο ακίνητο.
//
// Ο ΚΑΝΟΝΑΣ, όπως τον κάνει ο λογιστής:
//   · ΑΠΟΔΟΣΗ = ό,τι αποδίδει το ακίνητο με τους όρους που ισχύουν. Με μίσθωση
//     και μίσθωμα, το «αναμενόμενα με βάση τη μίσθωση» (μίσθωμα × 12). Μια
//     καθυστερημένη δόση είναι οφειλή του ενοικιαστή, όχι πτώση της απόδοσης.
//   · ΤΑΜΕΙΟ = ό,τι εισπράχθηκε ως σήμερα («εισπραγμένα ως σήμερα»). Γράφεται
//     δίπλα, ποτέ στη θέση του πρώτου.
//   · ΔΙΑΜΟΝΕΣ: δεν υπάρχει συμβόλαιο έτους, οπότε το δηλωτέο ως σήμερα σε
//     ετήσιο ρυθμό, που μέσα στη χρονιά είναι εκτίμηση και το λέει.
//   · ΔΟΣΕΙΣ ΧΩΡΙΣ ΜΙΣΘΩΜΑ ΤΡΕΧΟΝΤΟΣ ΕΝΟΙΚΙΑΣΤΗ: ο ετήσιος ρυθμός τους, εκτίμηση.
// ═══════════════════════════════════════════════════════════════════════════

export type YieldIncomeBasis = 'lease' | 'stays' | 'payments' | 'none';

export interface YieldIncome {
  /** Το ετήσιο έσοδο πάνω στο οποίο βγαίνει η απόδοση. */
  annual: number;
  basis: YieldIncomeBasis;
  /** Το ταμείο: ό,τι εισπράχθηκε ως σήμερα. `null` όταν δεν καταγράφηκε τίποτα. */
  received: number | null;
  /** Το ετήσιο ποσό δεν είναι βέβαιο (προβολή μέσα στη χρονιά ή διαμονές χωρίς βάση ποσού). */
  estimated: boolean;
  /** Η βάση με λέξεις (YIELD_INCOME_LABELS). Κενό όταν δεν υπάρχει έσοδο. */
  label: string;
  /** Η ίδια σε στενό πλακίδιο (YIELD_INCOME_SHORT_LABELS). */
  shortLabel: string;
}

/** Το ετήσιο έσοδο της απόδοσης και το ταμείο, από τα έσοδα του `rentIncome`. */
export function yieldIncome(fi: RentIncome): YieldIncome {
  const recorded = fi.source === 'stays' || fi.source === 'rent';
  const received = recorded ? fi.received : null;
  if (fi.source === 'stays') {
    return { annual: fi.annualized, basis: 'stays', received, estimated: fi.estimated || fi.projected,
      label: YIELD_INCOME_LABELS.stays, shortLabel: YIELD_INCOME_SHORT_LABELS.stays };
  }
  if (fi.expected > 0) {
    return { annual: fi.expected, basis: 'lease', received, estimated: false,
      label: YIELD_INCOME_LABELS.lease, shortLabel: YIELD_INCOME_SHORT_LABELS.lease };
  }
  if (fi.source === 'rent') {
    return { annual: fi.annualized, basis: 'payments', received, estimated: fi.estimated || fi.projected,
      label: YIELD_INCOME_LABELS.payments, shortLabel: YIELD_INCOME_SHORT_LABELS.payments };
  }
  return { annual: 0, basis: 'none', received, estimated: false, label: '', shortLabel: '' };
}
