// ═══════════════════════════════════════════════════════════════════════════
// ΑΝΑΠΡΟΣΑΡΜΟΓΗ ΕΝΟΙΚΙΟΥ ΑΝΑ ΕΤΟΣ: η μηχανή του δημόσιου υπολογιστή
// ─────────────────────────────────────────────────────────────────────────
// ΚΑΝΕΝΑΣ ΝΕΟΣ ΚΑΝΟΝΑΣ ΕΔΩ. Ο υπολογισμός μιας αναπροσαρμογής, το πλαφόν των
// επαγγελματικών μισθώσεων του 2026 και η στρογγυλοποίηση στο λεπτό ζουν στο
// lib/documents/rentAdjustment.ts (`computeRentAdjustment`, `rentCapPct`), τα
// ίδια που γράφουν την υπογεγραμμένη ειδοποίηση της εφαρμογής. Ο δείκτης, το
// 75% και η στρογγυλοποίησή του στο δέκατο ζουν στο lib/market/cpi.ts. Εδώ
// μόνο αλυσιδώνονται, ένα έτος τη φορά: κάθε αναπροσαρμογή ξεκινά από το
// μίσθωμα που άφησε η προηγούμενη, όπως πληρώνεται στην πράξη.
//
// Ο ΔΕΙΚΤΗΣ ΕΧΕΙ ΜΗΝΑ Ή ΕΙΝΑΙ ΥΠΟΘΕΣΗ. Για κάθε έτος του πίνακα, αν η ΕΛΣΤΑΤ
// έχει ανακοινώσει τη δωδεκάμηνη μεταβολή για τον μήνα της αναπροσαρμογής, η
// γραμμή την παίρνει από τον πίνακα `RENT_INDEX` και το λέει. Αλλιώς παίρνει
// το ποσοστό που έγραψε ο χρήστης και σημαδεύεται ως υπόθεση. Δεν
// κληρονομείται ο δείκτης άλλου μήνα, δεν προβλέπεται κανένας.
// ═══════════════════════════════════════════════════════════════════════════
import { computeRentAdjustment, rentCapPct, COMMERCIAL_RENT_CAP_2026 } from '@/lib/documents/rentAdjustment';
import { RENT_INDEX, rentAdjustmentPct } from '@/lib/market/cpi';

export type LeaseKind = 'residential' | 'commercial';
export type AdjustBasis = 'percent' | 'cpi';

/**
 * Πόσα έτη δείχνει ο πίνακας. Όριο της οθόνης, όχι του νόμου: πέρα από τη
 * δεκαετία κάθε γραμμή με ΔΤΚ είναι υπόθεση πάνω σε υπόθεση.
 */
export const YEARS_MAX = 10;

export interface AdjustPlanInput {
  /** Το μηνιαίο μίσθωμα πριν από την πρώτη αναπροσαρμογή. */
  rent: number;
  lease: LeaseKind;
  basis: AdjustBasis;
  /**
   * Για `percent`: ο όρος της σύμβασης, % τον χρόνο. Για `cpi`: η δωδεκάμηνη
   * μεταβολή που υποθέτει ο χρήστης για μήνες χωρίς ανακοίνωση της ΕΛΣΤΑΤ.
   */
  pct: number;
  /** Μόνο για `cpi`: η σύμβαση ορίζει το 75% της μεταβολής. */
  share75: boolean;
  /** Ο μήνας της πρώτης αναπροσαρμογής, «ΕΕΕΕ-ΜΜ». Οι επόμενες τον ίδιο μήνα. */
  startYm: string;
  years: number;
  /**
   * Μόνο για επαγγελματική: η μίσθωση υπογράφηκε πριν από την έναρξη του
   * ορίου (υφιστάμενη). Νέα μίσθωση του 2026 δεν έχει όριο.
   */
  existingLease: boolean;
}

export interface AdjustRow {
  /** 1 για την πρώτη αναπροσαρμογή. */
  n: number;
  /** Ο μήνας ισχύος, «ΕΕΕΕ-ΜΜ». */
  ym: string;
  from: number;
  to: number;
  increase: number;
  /** Για `cpi`: η δωδεκάμηνη μεταβολή και αν είναι της ΕΛΣΤΑΤ ή υπόθεση. */
  index: { pct: number; official: boolean } | null;
  /** Το ποσοστό του όρου: ο όρος, ή ο δείκτης (ή το 75% του, στο δέκατο). */
  clausePct: number;
  /** Το ποσοστό που εφαρμόστηκε τελικά. */
  appliedPct: number;
  /** Το νόμιμο όριο της γραμμής, ή `null` όταν δεν ισχύει όριο. */
  capPct: number | null;
  capped: boolean;
  /** Το μίσθωμα κατά τον όρο, πριν από το όριο. */
  uncapped: number;
}

export interface AdjustPlan {
  rows: AdjustRow[];
  /** Το μίσθωμα μετά την τελευταία αναπροσαρμογή του πίνακα. */
  final: number;
  /** Κάποια γραμμή πήρε δείκτη που η ΕΛΣΤΑΤ δεν έχει ανακοινώσει. */
  assumed: boolean;
  /** Κάποια γραμμή κόπηκε στο νόμιμο όριο. */
  cappedAny: boolean;
}

const YM = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** «2026-07» + 2 έτη → «2028-07». */
export const ymPlusYears = (ym: string, k: number): string => `${Number(ym.slice(0, 4)) + k}${ym.slice(4)}`;

/** Ο δείκτης της ΕΛΣΤΑΤ για αναπροσαρμογή ΑΚΡΙΒΩΣ αυτόν τον μήνα, ή `null`. */
export const officialIndex = (ym: string): number | null =>
  Object.prototype.hasOwnProperty.call(RENT_INDEX, ym) ? RENT_INDEX[ym] : null;

/** Τα έτη όπως τα δέχεται ο πίνακας: ακέραια, από 1 ως `YEARS_MAX`. */
export const clampYears = (y: number): number =>
  Math.min(YEARS_MAX, Math.max(1, Math.floor(Number.isFinite(y) ? y : 1)));

/**
 * Ο πίνακας της αναπροσαρμογής, ένα έτος τη φορά.
 *
 * Κενός όταν δεν υπάρχει μίσθωμα ή ο μήνας δεν είναι «ΕΕΕΕ-ΜΜ».
 */
export function adjustPlan(i: AdjustPlanInput): AdjustPlan {
  const rows: AdjustRow[] = [];
  if (!(i.rent > 0) || !YM.test(i.startYm)) return { rows, final: Math.max(0, i.rent || 0), assumed: false, cappedAny: false };
  const years = clampYears(i.years);
  // Νέα επαγγελματική μίσθωση: έναρξη την πρώτη μέρα του ορίου, οπότε η
  // `rentCapPct` τη βγάζει εκτός, με τον ίδιο κανόνα που εφαρμόζει η εφαρμογή.
  const leaseStart = i.existingLease ? null : COMMERCIAL_RENT_CAP_2026.from;
  let rent = i.rent;
  for (let n = 1; n <= years; n++) {
    const ym = ymPlusYears(i.startYm, n - 1);
    let index: AdjustRow['index'] = null;
    let clausePct: number;
    if (i.basis === 'cpi') {
      const off = officialIndex(ym);
      index = off === null ? { pct: i.pct, official: false } : { pct: off, official: true };
      clausePct = rentAdjustmentPct(index.pct, i.share75);
    } else {
      clausePct = i.pct;
    }
    const capPct = rentCapPct({ leaseCategory: i.lease, leaseStart, effectiveDate: `${ym}-01` });
    const r = computeRentAdjustment({ currentRent: rent, method: 'percent', percent: clausePct, capPct });
    rows.push({
      n, ym, from: r.currentRent, to: r.newRent, increase: r.increase, index, clausePct,
      appliedPct: r.pctApplied, capPct, capped: r.capped, uncapped: r.uncappedRent,
    });
    rent = r.newRent;
  }
  return {
    rows,
    final: rows[rows.length - 1].to,
    assumed: rows.some(r => r.index !== null && !r.index.official),
    cappedAny: rows.some(r => r.capped),
  };
}
