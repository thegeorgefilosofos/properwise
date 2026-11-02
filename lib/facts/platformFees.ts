// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΡΟΜΗΘΕΙΑ ΤΗΣ ΠΛΑΤΦΟΡΜΑΣ ΜΕΤΡΑ ΜΙΑ ΦΟΡΑ ΣΤΗΝ ΑΠΟΔΟΣΗ ΚΑΙ ΣΤΟ ΤΑΜΕΙΟ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ (07.10.2026). Το `client_stays.platform_fee` γράφεται ανά διαμονή.
// Η Επισκόπηση δεν το διάβαζε καθόλου: η καθαρή απόδοση και το «Καθαρό
// αποτέλεσμα» έβγαιναν από το δηλωτέο ακαθάριστο μείον τις δαπάνες, σαν η
// Airbnb να μην κράτησε τίποτα. Οι Αποδόσεις έβαζαν στη θέση της το ποσοστό
// του πεδίου «Προμήθεια πλατφόρμας» επί των εσόδων, όχι αυτό που κρατήθηκε
// πραγματικά. Ίδια ετικέτα, «Καθαρή απόδοση προ φόρου», δύο αριθμοί, κανένας
// από τους δύο με την προμήθεια της διαμονής.
//
// Ο ΚΑΝΟΝΑΣ, όπως τον κάνει ο λογιστής:
//   · Η προμήθεια της διαμονής είναι καταγραφή, όχι εκτίμηση. Μετρά στην
//     καθαρή απόδοση και στο ταμείο. Όπου υπάρχει, το ποσοστό του μοντέλου
//     δεν μπαίνει (lib/facts/yield: `yieldCosts`).
//   · ΜΙΑ ΦΟΡΑ. Αν έχεις περάσει την προμήθεια και ως δαπάνη (κατηγορία
//     «Προμήθεια πλατφόρμας»), ο μήνας της δαπάνης μετρά από τη δαπάνη και οι
//     διαμονές του ίδιου μήνα δεν ξαναμετρούν. Ο κανόνας του μήνα είναι ο ίδιος
//     με το ημερολόγιο και τη Λογιστική (`monthsWithOwnPlatformFee` του
//     lib/tax/shortTermTax.ts): το διαβάζουμε, δεν το ξαναγράφουμε.
//   · ΙΔΙΕΣ ΔΙΑΜΟΝΕΣ ΜΕ ΤΑ ΕΣΟΔΑ. Με το μερίδιο νυχτών του έτους (`yearShare`).
//     Το έσοδο του έτους από διαμονές είναι οι διαμονές ως σήμερα συν οι
//     κλεισμένες κρατήσεις έως 31/12 (lib/facts/income, κανόνας 3), οπότε και η
//     ετήσια προμήθεια: όσες κρατήθηκαν ως σήμερα συν όσες γράφουν οι
//     κλεισμένες κρατήσεις. Όχι προβολή με συντελεστή.
//
// ΤΙ ΔΕΝ ΑΛΛΑΖΕΙ. Το δηλωτέο ακαθάριστο, το Ε2 και ο φόρος ενοικίου μένουν στο
// ακαθάριστο: για φυσικό πρόσωπο το εισόδημα ακινήτων φορολογείται με την
// τεκμαρτή έκπτωση και η προμήθεια δεν αφαιρείται. Εδώ μιλάμε για απόδοση και
// ταμείο, με την ετικέτα να το λέει (PLATFORM_FEE_LABELS.note).
// ═══════════════════════════════════════════════════════════════════════════
import { platformFee, type StayAmountLike } from '@/lib/clients/stayAmounts';
import { monthsWithOwnPlatformFee, type CategorisedExpense } from '@/lib/tax/shortTermTax';
import { roundHalfUp } from '@/lib/core/money';
import { yearShare } from './hosting';
import type { RentIncome } from './income';

export interface StayPlatformFees {
  /** Προμήθειες των διαμονών ως σήμερα, χωρίς τους μήνες με δική σου δαπάνη. */
  toDate: number;
  /**
   * Οι προμήθειες του έτους: ως σήμερα και των κλεισμένων κρατήσεων έως το
   * `through` (ή, για παλιούς καλούντες, ως σήμερα επί `annualFactor`). Αυτό
   * αφαιρείται στην απόδοση.
   */
  annual: number;
  /** Προμήθειες διαμονών που ΔΕΝ μέτρησαν: ο μήνας τους έχει δαπάνη προμήθειας. */
  coveredByExpenses: number;
  /** Πόσοι μήνες του έτους έχουν δική σου δαπάνη προμήθειας. */
  ownMonths: number;
  /** Διαμονές που μέτρησαν με προμήθεια. */
  stays: number;
}

const ZERO: StayPlatformFees = { toDate: 0, annual: 0, coveredByExpenses: 0, ownMonths: 0, stays: 0 };
const iso = (d: string | null | undefined) => (d || '').slice(0, 10);
const cents = (n: number) => roundHalfUp(n, 2);

export interface StayPlatformFeesInput {
  year: number;
  /** Σημερινή ημερομηνία Αθήνας, ISO. */
  today: string;
  /** Οι γραμμές δαπανών του έτους (κατηγορία, ημερομηνία). */
  expenses?: readonly CategorisedExpense[] | null;
  /** Πόσες φορές το «ως σήμερα» χωρά στο έτος (έσοδο ετήσιο / έσοδο ως σήμερα). */
  annualFactor?: number;
  /** Μετρά στο `annual` και τις κλεισμένες κρατήσεις με άφιξη έως αυτή την ημερομηνία, ISO. */
  through?: string;
}

/** Οι προμήθειες των διαμονών του έτους, μία φορά, χωρίς όσες είναι ήδη δαπάνη. */
export function stayPlatformFees(stays: readonly StayAmountLike[], i: StayPlatformFeesInput): StayPlatformFees {
  const t = iso(i.today);
  const own = monthsWithOwnPlatformFee(i.expenses ?? []);
  const through = iso(i.through);
  let toDate = 0, booked = 0, covered = 0, count = 0;
  for (const s of stays) {
    const arrival = iso(s.check_in || s.check_out);
    if (!arrival) continue;
    const future = arrival > t;
    if (future && !(through && arrival <= through)) continue;
    const fee = platformFee(s);
    if (fee <= 0) continue;
    const { share } = yearShare(s, i.year);
    if (share <= 0) continue;
    // Ο μήνας της άφιξης, όπως στις παραγόμενες γραμμές του ημερολογίου.
    if (own.has(arrival.slice(0, 7))) { if (!future) covered += fee * share; continue; }
    if (future) { booked += fee * share; continue; }
    toDate += fee * share;
    count++;
  }
  const f = Number.isFinite(i.annualFactor) && (i.annualFactor as number) > 0 ? (i.annualFactor as number) : 1;
  return {
    toDate: cents(toDate), annual: cents(through ? toDate + booked : toDate * f), coveredByExpenses: cents(covered),
    ownMonths: [...own].filter(m => m.startsWith(`${i.year}-`)).length, stays: count,
  };
}

/**
 * Οι προμήθειες που αφαιρούνται στην απόδοση ενός ακινήτου, με τον ίδιο ρυθμό
 * με το έσοδό του. Μηδέν όταν το έσοδο δεν βγαίνει από διαμονές: η μίσθωση με
 * μισθωτήριο δεν έχει πλατφόρμα.
 */
export function yieldPlatformFees(
  income: Pick<RentIncome, 'source' | 'received' | 'annualized'>,
  stays: readonly StayAmountLike[], i: Omit<StayPlatformFeesInput, 'annualFactor'>,
): StayPlatformFees {
  if (income.source !== 'stays' || !(income.annualized > 0)) return ZERO;
  // Ίδια βάση με το έσοδο: ως σήμερα + κλεισμένες κρατήσεις έως 31/12.
  return stayPlatformFees(stays, { ...i, through: `${i.year}-12-31` });
}
