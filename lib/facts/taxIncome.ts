// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΕΤΗΣΙΟ ΕΙΣΟΔΗΜΑ ΓΙΑ ΤΟΝ ΦΟΡΟ, ΑΝΑ ΑΚΙΝΗΤΟ: ΜΙΑ ΒΑΣΗ ΓΙΑ ΚΑΘΕ ΟΘΟΝΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (έλεγχος 19/10/2026, #6). Ο φόρος του ίδιου ακινήτου ήταν
// 1.811,71€ στην Επισκόπηση και 1.515,20€ στη Σύγκριση και τρίτος αριθμός στο
// Ενοικιαστής → Φόρος. Τρεις βάσεις:
//   · Επισκόπηση: το μίσθωμα × 12 (`yieldIncome`).
//   · Σύγκριση και τα «άλλα ακίνητα» της ενοποίησης: οι δόσεις σε ετήσιο ρυθμό
//     (`propertyIncome`), δηλαδή χωρίς τη δόση που καθυστερεί.
//   · Ενοικιαστής → Φόρος: το μίσθωμα × 12, μόνο του, χωρίς ενοποίηση και χωρίς
//     ποσοστό ιδιοκτησίας.
//
// ΠΟΙΑ ΒΑΣΗ ΕΙΝΑΙ ΣΩΣΤΗ, ΚΑΤΑ ΤΗ ΜΗΧΑΝΗ ΠΟΥ ΥΠΑΡΧΕΙ ΗΔΗ. Το Ε2 δηλώνει
// δεδουλευμένα: «ό,τι οφείλεται, ανεξάρτητα από την είσπραξη» και τα
// ανείσπρακτα φεύγουν από τη στ. 13 μόνο με διαταγή πληρωμής ή αγωγή (άρθρο 39
// ΚΦΕ). Το λένε ήδη τα lib/billing/e2Reconcile.ts (κωδικός `unpaid`),
// lib/billing/e2.ts (στ. 16) και lib/accounting/statement.ts (§4). Άρα μια δόση
// που καθυστερεί δεν μικραίνει τον φόρο. Η βάση είναι:
//   1. ΜΕ ΜΙΣΘΩΣΗ ΚΑΙ ΜΙΣΘΩΜΑ: το συμφωνημένο μίσθωμα × 12 («αναμενόμενα με
//      βάση τη μίσθωση»), όχι οι δόσεις σε ετήσιο ρυθμό.
//   2. ΜΕ ΔΙΑΜΟΝΕΣ: δεν υπάρχει συμβόλαιο έτους. Τα δηλωτέα ως σήμερα σε ετήσιο
//      ρυθμό, εκτίμηση μέσα στη χρονιά.
//   3. ΜΕ ΔΟΣΕΙΣ ΧΩΡΙΣ ΜΙΣΘΩΜΑ ΤΡΕΧΟΝΤΟΣ ΕΝΟΙΚΙΑΣΤΗ: οι δόσεις σε ετήσιο ρυθμό, εκτίμηση.
//   4. ΜΙΣΘΩΜΕΝΟ ΧΩΡΙΣ ΚΑΜΙΑ ΚΑΤΑΓΡΑΦΗ: ο στόχος ενοικίου × 12, εκτίμηση. Ίδια
//      εφεδρεία με το Ε2 («μισθωμένο» χωρίς στοιχεία, `target_rent` × μήνες).
//   5. ΧΩΡΙΣ ΜΙΣΘΩΣΗ (ιδιοχρησία, κενό, πώληση): μόνο ό,τι εισπράχθηκε μέσα στο
//      έτος, χωρίς προβολή. Ο ενοικιαστής που έφυγε τον Ιούνιο δηλώνεται για
//      όσα πλήρωσε· νέα δόση δεν έρχεται (lib/facts/income, κανόνας 1).
//
// Οι 1–3 είναι ακριβώς ο `yieldIncome`: η απόδοση και ο φόρος πατούν στο ίδιο
// έσοδο, οπότε το πλακίδιο «Έσοδα» και ο φόρος δίπλα του δεν διαφωνούν.
//
// ΤΙ ΔΕΝ ΚΑΝΕΙ. Δεν αγγίζει κλίμακες, έκπτωση ή ενοποίηση: αυτά ζουν στα
// lib/billing/greekTax.ts και lib/billing/consolidate.ts. Δίνει μόνο το ποσό
// πάνω στο οποίο εφαρμόζονται, για όλο το ακίνητο (το μερίδιο το βγάζει η
// `taxpayerRentSources` με το ποσοστό ιδιοκτησίας).
// ═══════════════════════════════════════════════════════════════════════════
import type { IncomeRent } from '@/lib/income/propertyIncome';
import type { StayAmountLike } from '@/lib/clients/stayAmounts';
import { roundHalfUp } from '@/lib/core/money';
import { rentIncome, yieldIncome } from './income';
import { isLease, type PropertyStatus } from './status';

export interface TaxIncomeInput {
  status: PropertyStatus;
  rents: readonly IncomeRent[];
  stays: readonly StayAmountLike[];
  year: number;
  today: string;
  /** Το μηνιαίο μίσθωμα του τρέχοντος ενοικιαστή. */
  leaseMonthly?: number | null;
  /** Ο στόχος ενοικίου του ακινήτου: μόνο ως εκτίμηση, κανόνας 4. */
  targetMonthly?: number | null;
}

export type TaxIncomeBasis = 'lease' | 'stays' | 'payments' | 'target' | 'received' | 'none';

export interface TaxIncome {
  /** Το ετήσιο ποσό για τον φόρο, όλου του ακινήτου, σε ευρώ. */
  annual: number;
  basis: TaxIncomeBasis;
  /** Το ποσό δεν είναι βέβαιο: προβολή μέσα στη χρονιά, διαμονές χωρίς βάση ή στόχος. */
  estimated: boolean;
}

const NONE: TaxIncome = { annual: 0, basis: 'none', estimated: false };

/** Το ετήσιο εισόδημα του ακινήτου για τον φόρο ενοικίων. Βλ. τους πέντε κανόνες από πάνω. */
export function annualIncomeForTax(i: TaxIncomeInput): TaxIncome {
  const fi = rentIncome({
    status: i.status, rents: i.rents, stays: i.stays, year: i.year, today: i.today,
    estimateMonthly: Number(i.leaseMonthly) > 0 ? Number(i.leaseMonthly) : null,
  });
  if (!isLease(i.status)) {
    // Κανόνας 5: τα εισπραγμένα, χωρίς προβολή.
    return fi.received > 0 ? { annual: fi.received, basis: 'received', estimated: false } : NONE;
  }
  const yi = yieldIncome(fi);
  if (yi.basis !== 'none') return { annual: yi.annual, basis: yi.basis, estimated: yi.estimated };
  const target = Number(i.targetMonthly) || 0;
  return target > 0 ? { annual: roundHalfUp(target * 12, 2), basis: 'target', estimated: true } : NONE;
}

/** Τα στοιχεία ενός ακινήτου όπως τα φορτώνει κάθε οθόνη για τον φόρο. */
export interface TaxIncomeRow {
  rents?: readonly IncomeRent[];
  stays?: readonly StayAmountLike[];
  /** Το μίσθωμα του τρέχοντος ενοικιαστή (`tenants.monthly_rent`). */
  leaseMonthly?: number | null;
  /** Ο στόχος του ακινήτου (`user_properties.target_rent`). */
  targetMonthly?: number | null;
  /** Εισπράττεται μέσω τράπεζας; Χωρίς δήλωση, ναι. */
  viaBank?: boolean;
}

/** Το ίδιο, από τη γραμμή που κρατά η οθόνη: μία ανάγνωση για όλους. */
export function taxIncomeOf(status: PropertyStatus, row: TaxIncomeRow | undefined, year: number, today: string): TaxIncome {
  return annualIncomeForTax({
    status, rents: row?.rents ?? [], stays: row?.stays ?? [], year, today,
    leaseMonthly: row?.leaseMonthly, targetMonthly: row?.targetMonthly,
  });
}

/**
 * Ο στόχος ενοικίου του κανόνα 4, με ΜΙΑ σειρά για κάθε οθόνη: το ενοίκιο που
 * γράφτηκε στις Αποδόσεις (`rent_config.actual_rent`), ο στόχος της ίδιας
 * καρτέλας, ο στόχος του ακινήτου. Η σειρά είναι αυτή που είχαν ήδη η
 * Επισκόπηση και οι Αποδόσεις για τα άλλα ακίνητα· η Σύγκριση δεν διάβαζε το
 * `rent_config` και ένα ακίνητο χωρίς ενοικιαστή έμενε έξω από την ενοποίησή της.
 */
export function targetMonthlyOf(
  cfg: { actual_rent?: number | null; target_rent?: number | null } | null | undefined,
  propertyTarget: number | null | undefined,
): number {
  return Number(cfg?.actual_rent) || Number(cfg?.target_rent) || Number(propertyTarget) || 0;
}
