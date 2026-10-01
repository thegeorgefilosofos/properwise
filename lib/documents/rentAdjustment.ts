import { fe, fp } from '../core/format';
// ═══════════════════════════════════════════════════════════════════════════
// rentAdjustment — Καθαρός υπολογισμός αναπροσαρμογής μισθώματος (νομικό έγγραφο).
// Μέθοδοι: ποσοστό (συμφωνημένο), ΔΤΚ/πληθωρισμός (ΕΛΣΤΑΤ), ή χειροκίνητο νέο ποσό.
// ═══════════════════════════════════════════════════════════════════════════

export type AdjMethod = 'percent' | 'cpi' | 'manual';

export interface AdjInput {
  currentRent: number;
  method: AdjMethod;
  percent?: number;        // για 'percent'
  cpiPct?: number;         // για 'cpi' (μεταβολή ΔΤΚ)
  newRentManual?: number;  // για 'manual'
  /** Ανώτατο ποσοστό που επιτρέπει ο νόμος για αυτή τη μίσθωση (βλ. `rentCapPct`). */
  capPct?: number | null;
}

export interface AdjResult {
  currentRent: number;
  newRent: number;
  increase: number;
  pctApplied: number;
  /** Το μίσθωμα κόπηκε στο νόμιμο όριο; Τότε το `uncappedRent` είναι αυτό που ζητήθηκε. */
  capped: boolean;
  uncappedRent: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// ΠΛΑΦΟΝ 3% ΣΤΙΣ ΕΠΑΓΓΕΛΜΑΤΙΚΕΣ ΜΙΣΘΩΣΕΙΣ ΤΟΥ 2026
// ─────────────────────────────────────────────────────────────────────────
// Ο υπολογισμός εφάρμοζε τον όρο της σύμβασης όπως ήταν: 1.500€ με όρο 5%
// έδιναν 1.575€ σε υπογεγραμμένη ειδοποίηση, ενώ ο νόμος επιτρέπει 1.545€.
//
// ΠΗΓΗ: άρθρο 59 ν.5255/2025 · άρθρο 96 ν.5007/2022, όπως τα γράφει ο οδηγός
// app/odigos/plafon-3-emporikes-misthoseis-2026 και η εγγραφή
// `commercial-rent-cap-3pct` του lib/accounting/updates2026.ts. Στις ΥΦΙΣΤΑΜΕΝΕΣ
// επαγγελματικές μισθώσεις (ΠΔ 34/1995), αναπροσαρμογή από 1.1.2026 έως
// 31.12.2026 όχι πάνω από 3% επί του μισθώματος του 2025. Δεν αφορά κατοικία,
// ούτε μίσθωση που υπογράφεται μέσα στο 2026. Οι τρεις εξαιρούμενοι εκμισθωτές
// (ΑΕΕΑΠ/ΟΣΕΚΑ, εμπορικά κέντρα άνω των 15.000 τ.μ., εταιρείες 100% του
// Δημοσίου) δεν αναγνωρίζονται από τα δεδομένα· η οθόνη τους αναφέρει.
// ═══════════════════════════════════════════════════════════════════════════
export const COMMERCIAL_RENT_CAP_2026 = { pct: 3, from: '2026-01-01', to: '2026-12-31' } as const;

/**
 * Το ανώτατο ποσοστό αναπροσαρμογής για αυτή τη μίσθωση και ημερομηνία ισχύος,
 * ή `null` όταν δεν ισχύει όριο. Μίσθωση χωρίς έναρξη θεωρείται υφιστάμενη.
 */
export function rentCapPct(o: { leaseCategory?: string | null; leaseStart?: string | null; effectiveDate: string }): number | null {
  const { pct, from, to } = COMMERCIAL_RENT_CAP_2026;
  if (o.leaseCategory !== 'commercial') return null;
  const d = (o.effectiveDate || '').slice(0, 10);
  if (d < from || d > to) return null;
  if (o.leaseStart && o.leaseStart.slice(0, 10) >= from) return null;
  return pct;
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export function computeRentAdjustment(i: AdjInput): AdjResult {
  const cur = r2(i.currentRent);
  let newRent = cur, pct = 0;
  if (i.method === 'manual') {
    newRent = r2(i.newRentManual || 0);
    pct = cur > 0 ? r2((newRent / cur - 1) * 100) : 0;
  } else {
    pct = i.method === 'cpi' ? (Number(i.cpiPct) || 0) : (Number(i.percent) || 0);
    newRent = r2(cur * (1 + pct / 100));
  }
  const uncappedRent = newRent;
  const cap = i.capPct;
  const capped = cap != null && cur > 0 && pct > cap;
  if (capped) { pct = cap; newRent = r2(cur * (1 + cap / 100)); }
  return { currentRent: cur, newRent, increase: r2(newRent - cur), pctApplied: pct, capped, uncappedRent };
}

// Κείμενο νομικής ειδοποίησης (καθαρό, τυποποιημένο).
//
// Ο ΔΕΙΚΤΗΣ ΧΩΡΙΣ ΕΤΟΣ ΔΕΝ ΕΙΝΑΙ ΔΕΙΚΤΗΣ. Το κείμενο έλεγε «βάσει της μεταβολής
// του Δείκτη Τιμών Καταναλωτή (ΕΛΣΤΑΤ)» και σταματούσε εκεί: ο μισθωτής έπαιρνε
// υπογεγραμμένο έγγραφο με ένα ποσοστό και καμία ένδειξη ΠΟΙΑΣ περιόδου είναι,
// άρα κανέναν τρόπο να το ελέγξει. Η ΕΛΣΤΑΤ ανακοινώνει μεταβολή κάθε μήνα και
// μέση ετήσια κάθε χρόνο· χωρίς το έτος, το νούμερο δεν επαληθεύεται.
export function adjustmentNoticeText(o: {
  tenantName?: string; address?: string; effectiveDate: string; method: AdjMethod; res: AdjResult;
  /** Το δωδεκάμηνο του δείκτη, π.χ. «Ιουλίου 2025 ως Ιουνίου 2026». Μόνο για 'cpi'. */
  cpiPeriod?: string;
  /** Η σύμβαση προβλέπει το 75% της μεταβολής (τυπικό σε επαγγελματική μίσθωση). */
  cpiShare75?: boolean;
}): string {
  // Η ΒΑΣΗ ΓΡΑΦΕΤΑΙ ΟΛΟΚΛΗΡΗ: ΜΕΤΡΟ, ΠΕΡΙΟΔΟΣ, ΚΑΙ ΑΝ ΕΦΑΡΜΟΣΤΗΚΕ ΤΟ 75%.
  // Ο μισθωτής παίρνει υπογεγραμμένο έγγραφο με ένα ποσοστό· χωρίς αυτά τα τρία
  // δεν έχει κανέναν τρόπο να το επαληθεύσει στην ΕΛΣΤΑΤ και δύο διαφορετικές
  // βάσεις δίνουν δύο διαφορετικά νούμερα από τον ΙΔΙΟ δείκτη.
  const basis = o.method === 'cpi'
    ? `βάσει ${o.cpiShare75 ? 'του 75% ' : ''}της δωδεκάμηνης μεταβολής του Δείκτη Τιμών Καταναλωτή (ΕΛΣΤΑΤ)${o.cpiPeriod ? `, ${o.cpiPeriod}` : ''}`
    : o.method === 'percent' ? 'σύμφωνα με τον όρο αναπροσαρμογής του μισθωτηρίου'
    : 'κατόπιν συμφωνίας των μερών';
  // Οταν η μεταβολή κόπηκε στο νόμιμο όριο, το έγγραφο λέει ΓΙΑΤΙ το ποσό
  // διαφέρει από τον όρο του μισθωτηρίου.
  const cap = o.res.capped
    ? `, εντός του ορίου ${fp(o.res.pctApplied)} του άρθρου 59 ν.5255/2025 για το 2026`
    : '';
  return `Προς τον/την μισθωτή${o.tenantName ? ` κ. ${o.tenantName}` : ''},\n\n`
    + `Σας γνωστοποιώ ότι, ${basis}${cap}, το μηνιαίο μίσθωμα του ακινήτου${o.address ? ` επί της οδού ${o.address}` : ''} `
    + `αναπροσαρμόζεται από ${o.effectiveDate}. Το ισχύον μίσθωμα ανέρχεται σε ${fe(o.res.currentRent)} και `
    + `το νέο μηνιαίο μίσθωμα διαμορφώνεται σε ${fe(o.res.newRent)} `
    + `(μεταβολή ${fp(o.res.pctApplied)}).\n\n`
    + `Παρακαλώ όπως καταβάλλετε το νέο μίσθωμα από την ανωτέρω ημερομηνία. Η παρούσα επέχει θέση έγγραφης ειδοποίησης.`;
}
