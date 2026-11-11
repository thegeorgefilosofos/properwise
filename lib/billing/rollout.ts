// ═══════════════════════════════════════════════════════════════════════════
// Η ΣΕΙΡΑ ΔΙΑΘΕΣΗΣ ΤΩΝ ΝΕΩΝ ΔΥΝΑΤΟΤΗΤΩΝ, ΜΕ ΜΗΧΑΝΙΣΜΟ
// ─────────────────────────────────────────────────────────────────────────
// Οι Όροι χρήσης (ενότητα «Προτεραιότητα στις νέες δυνατότητες») υπόσχονται ότι
// κάθε νέα δυνατότητα «ενσωματώνεται πρώτα» στα πακέτα από
// FEATURE_MIN_PLAN.early_access και πάνω, «με πρώτο το Επαγγελματίας+». Ως τις
// 10/11/2026 δεν το έλεγχε τίποτα. Απόφαση ιδιοκτήτη: «Ας τα κάνει ο κώδικας».
//
// ΤΟ ΠΑΚΕΤΟ ΕΙΝΑΙ ΤΟ ΕΝΕΡΓΟ ΠΑΚΕΤΟ (effectivePlan), ΜΑΖΙ ΜΕ ΤΗ ΔΟΚΙΜΗ. Οι Όροι
// δίνουν στη δοκιμή τις δυνατότητες του «Ιδιοκτήτης+» και το plans.ts γράφει
// σε αυτές τις «Νέες δυνατότητες νωρίτερα». Ο Συνεργάτης είναι «Επαγγελματίας».
// Η βάση κρίνει με την ίδια `public.user_plan_rank`.
//
// ΠΩΣ ΜΠΑΙΝΕΙ ΜΙΑ ΝΕΑ ΔΥΝΑΤΟΤΗΤΑ:
//   1. Μία γραμμή στο ROLLOUT: `id: { label: '…', opens: 'ΕΕΕΕ-ΜΜ-ΗΗ' },` με τη
//      μέρα που ανοίγει για ΟΛΟΥΣ. Το «Επαγγελματίας+» την παίρνει
//      EARLY_ACCESS_DAYS + OFFICE_LEAD_DAYS νωρίτερα, τα υπόλοιπα πακέτα
//      προτεραιότητας EARLY_ACCESS_DAYS νωρίτερα (stagedRelease).
//   2. Ο κώδικας που την ανοίγει ρωτά `isAvailable('<id>', effectivePlan(…))`,
//      στην οθόνη ΚΑΙ στη διαδρομή του διακομιστή αν έχει.
//   3. Ο φύλακας `scripts/guard-rollout.mjs` κοκκινίζει αν εγγραφή με ημερομηνία
//      δεν κλειδώνεται πουθενά με `isAvailable`, ή αν μια οθόνη γράψει «Νέα
//      δυνατότητα» χωρίς να περνά από εδώ.
//
// ΤΙ ΔΕΝ ΜΠΑΙΝΕΙ ΕΔΩ: διορθώσεις σφαλμάτων, ενημερώσεις ασφαλείας και ό,τι
// χρειάζεται για να μένει η Υπηρεσία σύμφωνη με τη σύμβαση (Όροι: «διατίθενται
// ταυτόχρονα σε όλα τα πακέτα»).
//
// Η ΕΦΑΡΜΟΓΗ ΚΙΝΗΤΟΥ ΑΝΟΙΓΕΙ ΜΕ ΤΑ ΚΥΜΑΤΑ ΤΗΣ ΒΑΣΗΣ, ΟΧΙ ΜΕ ΗΜΕΡΟΜΗΝΙΑ. Η σειρά
// ζει στα `release_waves` και η `public.mobile_access()` τη λέει για τον
// συνδεδεμένο χρήστη. Η εφαρμογή δεν υπάρχει ακόμη, άρα κανείς δεν καλεί την
// πύλη: η εγγραφή είναι `pending` και ο φύλακας το απαιτεί, ώσπου να υπάρξει
// κώδικας που την καλεί.
// ═══════════════════════════════════════════════════════════════════════════
import { PLAN_ORDER, type PlanId } from './plans';
import { EARLY_ACCESS_DAYS, FEATURE_MIN_PLAN, planAtLeast } from './entitlements';

/**
 * Πόσες ημέρες πριν από τα άλλα πακέτα προτεραιότητας ανοίγει το «Επαγγελματίας+».
 * Οι Όροι λένε μόνο «με πρώτο»· μία ημέρα το κάνει πρώτο χωρίς να γίνει χωριστό
 * προνόμιο που δεν υποσχεθήκαμε. Ίδια με την `public.office_lead_days()`.
 */
export const OFFICE_LEAD_DAYS = 1;

/** Το πακέτο που ανοίγει πρώτο, κατά τους Όρους: το ανώτερο της κλίμακας. */
export const FIRST_IN_LINE: PlanId = PLAN_ORDER[PLAN_ORDER.length - 1];

/** Από πότε ανοίγει η δυνατότητα ανά πακέτο (ημερομηνία Αθήνας, ΕΕΕΕ-ΜΜ-ΗΗ). */
export type Release = Record<PlanId, string>;

const DAY = 86400000;
const shift = (iso: string, days: number): string =>
  new Date(Date.parse(`${iso}T00:00:00Z`) - days * DAY).toISOString().slice(0, 10);

/** Είναι το πακέτο μέσα στην προτεραιότητα της σειράς διάθεσης; */
export function hasEarlyAccess(plan: PlanId): boolean {
  return planAtLeast(plan, FEATURE_MIN_PLAN.early_access);
}

/**
 * Η σειρά των Όρων: όλοι από `everyone`, τα πακέτα προτεραιότητας νωρίτερα κατά
 * EARLY_ACCESS_DAYS και το πρώτο της σειράς επιπλέον OFFICE_LEAD_DAYS.
 */
export function stagedRelease(everyone: string): Release {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(everyone)) throw new Error(`rollout: ημερομηνία «${everyone}» όχι ΕΕΕΕ-ΜΜ-ΗΗ`);
  const out = {} as Release;
  for (const p of PLAN_ORDER) {
    if (p === FIRST_IN_LINE) out[p] = shift(everyone, EARLY_ACCESS_DAYS + OFFICE_LEAD_DAYS);
    else if (hasEarlyAccess(p)) out[p] = shift(everyone, EARLY_ACCESS_DAYS);
    else out[p] = everyone;
  }
  return out;
}

export interface RolloutEntry {
  /** Πώς λέγεται στην οθόνη. */
  label: string;
  /** Η μέρα που ανοίγει για ΟΛΟΥΣ, ή `null` όσο δεν έχει ημερομηνία (κλειστό για όλους). */
  opens: string | null;
  /**
   * Κλείδωμα στον server αντί για ημερομηνία: το όνομα της συνάρτησης της βάσης
   * που ρωτά ο πελάτης (με τη συνεδρία) πριν ανοίξει. Τότε το `isAvailable` δεν
   * αποφασίζει τίποτα· αποφασίζει η βάση.
   */
  gate?: 'mobile_access';
  /**
   * Η πύλη υπάρχει στη βάση, αλλά δεν την καλεί ακόμη κανένας κώδικας (π.χ. η
   * εφαρμογή κινητού δεν έχει γραφτεί). Ο φύλακας δέχεται εγγραφή με `gate` μόνο
   * αν έχει καλούντα ή είναι `pending`. Οθόνες και Νόα δεν τη δείχνουν ως ενεργή.
   */
  pending?: true;
}

/**
 * ΤΟ ΜΗΤΡΩΟ. Κάθε δυνατότητα που ανακοινώνεται ως «νέα» ζει εδώ, μία γραμμή η
 * καθεμία, στη μορφή της κεφαλίδας (ο φύλακας τη διαβάζει ως κείμενο).
 * Σήμερα: μόνο η εφαρμογή κινητού, με πύλη στη βάση που εκκρεμεί (pending).
 */
export const ROLLOUT: Record<string, RolloutEntry> = {
  mobile_app: { label: 'Εφαρμογή κινητού', opens: null, gate: 'mobile_access', pending: true },
};

/** Η σημερινή ημερομηνία Αθήνας, ΕΕΕΕ-ΜΜ-ΗΗ. */
function athensDay(now: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(now));
}

/**
 * Έχει ανοίξει η δυνατότητα για αυτό το πακέτο σήμερα; Άγνωστη ή χωρίς
 * ημερομηνία: όχι.
 *
 * @param plan Το ενεργό πακέτο (effectivePlan), με τη δοκιμή.
 * @param now  ms, για ελεγξιμότητα.
 */
export function isAvailable(id: string, plan: PlanId, now: number = Date.now()): boolean {
  const entry = ROLLOUT[id];
  if (!entry?.opens) return false;
  return athensDay(now) >= stagedRelease(entry.opens)[plan];
}

/**
 * Οι δυνατότητες που το πακέτο έχει ήδη, ενώ οι υπόλοιποι όχι ακόμη. Την
 * ενημέρωση της Νόας τη γράφει αυτό, ώστε να μη λέει ποτέ κάτι που ο κώδικας
 * δεν ανοίγει. Κενό όταν δεν τρέχει καμία σταδιακή διάθεση.
 */
export function openEarlyFor(plan: PlanId, now: number = Date.now()): string[] {
  return Object.entries(ROLLOUT)
    .filter(([id]) => isAvailable(id, plan, now) && !isAvailable(id, PLAN_ORDER[0], now))
    .map(([, e]) => e.label);
}
