// ΧΩΡΙΣ 'use client' ΚΑΙ ΧΩΡΙΣ ΤΗ ΒΙΒΛΙΟΘΗΚΗ ΤΟΥ EXCEL.
// ═══════════════════════════════════════════════════════════════════════════
// Η ΣΥΓΚΡΙΣΗ ΜΕ ΤΟ ΠΡΟΣΥΜΠΛΗΡΩΜΕΝΟ, ΑΝΑ ΑΦΜ, ΑΠΟ ΤΗΝ ΙΔΙΑ ΦΟΡΤΩΣΗ ΜΕ ΤΟ Ε2
// ─────────────────────────────────────────────────────────────────────────
// Τη χρειάζονται δύο: η κάρτα της Λογιστικής που τη δείχνει και ο φάκελος του
// λογιστή που τη γράφει σε φύλλο. Αν την υπολόγιζε ο καθένας μόνος του, η
// οθόνη θα έλεγε «3 διαφορές» και ο φάκελος «2» για την ίδια χρονιά.
//
// ΤΟ Ε2 ΕΙΝΑΙ ΕΝΑ ΑΝΑ ΑΦΜ. Τα ακίνητα ομαδοποιούνται με το `owner_afm` των
// ρυθμίσεών τους, όπως ακριβώς τα ομαδοποιεί το βιβλίο Ε2 (e2Export.ts). Τα
// ακίνητα χωρίς ΑΦΜ μένουν σε δική τους ομάδα, που δεν συγκρίνεται με τίποτα.
// ═══════════════════════════════════════════════════════════════════════════
import type { E2Property, E2RowDetail, E2Payment, E2Stay } from '@/lib/billing/e2';
import { appLinesOf, reconcilePrefilled, type AppLeaseLine, type PrefilledReconciliation } from '@/lib/billing/e2Reconcile';
import type { AadeE2Row } from '@/lib/tax/aadeE2';
import { readStatus } from '@/lib/property/status';
import { shortTermYearSummary } from '@/lib/tax/shortTermTax';
import { rentIncomeOf } from '@/lib/rent/split';

/** Ό,τι φορτώνει η `loadE2Rows` και χρειάζεται η σύγκριση. */
export interface E2Loaded {
  properties: E2Property[];
  rows: E2RowDetail[];
  afmByProp: Map<string, string>;
  paymentsByProp: Map<string, E2Payment[]>;
  staysByProp: Map<string, E2Stay[]>;
}

export interface AfmGroup {
  /** Κενό για τα ακίνητα χωρίς ΑΦΜ ιδιοκτήτη. */
  afm: string;
  /** Θέσεις μέσα στο `properties`/`rows`, με τη σειρά τους. */
  idx: number[];
}

/** Οι υπόχρεοι, με τη σειρά που εμφανίζονται· τα ακίνητα χωρίς ΑΦΜ στο τέλος. */
export function afmGroups(loaded: Pick<E2Loaded, 'properties' | 'afmByProp'>): AfmGroup[] {
  const groups = new Map<string, number[]>();
  loaded.properties.forEach((p, i) => {
    const afm = loaded.afmByProp.get(p.id) || '';
    const g = groups.get(afm);
    if (g) g.push(i); else groups.set(afm, [i]);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => Number(a === '') - Number(b === ''))
    .map(([afm, idx]) => ({ afm, idx }));
}

/**
 * Οι γραμμές της εφαρμογής μιας ομάδας, με τα στοιχεία που εξηγούν διαφορές:
 * προμήθεια πλατφόρμας και τέλος ανθεκτικότητας από την ίδια
 * `shortTermYearSummary` του Ε2, ανείσπρακτα από τις δόσεις του έτους.
 */
export function appLinesForGroup(loaded: E2Loaded, group: AfmGroup, year: number, declRefs: ReadonlyMap<string, string> = new Map()): AppLeaseLine[] {
  return group.idx.flatMap(i => {
    const p = loaded.properties[i];
    const shortTerm = readStatus(p) === 'rent_short';
    const stayYear = shortTerm ? shortTermYearSummary(loaded.staysByProp.get(p.id) || [], year) : null;
    const due = shortTerm ? [] : (loaded.paymentsByProp.get(p.id) || []).filter(x => x.period_year === year);
    const unpaid = due.reduce((s, x) => s + (x.paid ? 0 : rentIncomeOf(x)), 0);
    return appLinesOf(p, loaded.rows[i], {
      shortTerm,
      declRef: declRefs.get(p.id) ?? null,
      evidence: {
        platformFees: stayYear?.platformFees ?? null,
        climateLevy: stayYear?.collectedLevy ?? null,
        unpaid: unpaid > 0 ? unpaid : null,
      },
    });
  });
}

/** Η σύγκριση μιας ομάδας με τις αποθηκευμένες γραμμές του ίδιου ΑΦΜ. */
export function compareGroup(
  loaded: E2Loaded, group: AfmGroup, aade: readonly (AadeE2Row & { ownerAfm: string })[], year: number,
  declRefs?: ReadonlyMap<string, string>,
): PrefilledReconciliation {
  return reconcilePrefilled(appLinesForGroup(loaded, group, year, declRefs), aade.filter(r => r.ownerAfm === group.afm));
}
