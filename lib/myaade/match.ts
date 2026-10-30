// ═══════════════════════════════════════════════════════════════════════════
// ΠΟΙΟ ΑΚΙΝΗΤΟ ΤΗΣ ΠΡΑΞΗΣ ΥΠΑΡΧΕΙ ΗΔΗ ΣΤΗΝ ΕΦΑΡΜΟΓΗ
// ─────────────────────────────────────────────────────────────────────────
// ΜΕ ΑΤΑΚ ΤΟ ΤΑΙΡΙΑΣΜΑ ΕΙΝΑΙ ΒΕΒΑΙΟ: ο ΑΤΑΚ είναι ο αριθμός του ακινήτου στην
// ΑΑΔΕ. Τότε η γραμμή είναι «Υπάρχει ήδη» και συμπληρώνονται μόνο τα κενά.
//
// ΜΕ ΔΙΕΥΘΥΝΣΗ ΜΟΝΟ ΠΡΟΤΑΣΗ, ΠΟΤΕ ΑΥΤΟΜΑΤΟ. Δύο διαμερίσματα της ίδιας
// πολυκατοικίας έχουν την ίδια διεύθυνση. Η γραμμή γίνεται «Ίσως υπάρχει» και ο
// χρήστης διαλέγει. Ακίνητο της εφαρμογής που έχει ήδη ΑΛΛΟ ΑΤΑΚ δεν προτείνεται.
// ═══════════════════════════════════════════════════════════════════════════
import { fold } from '@/lib/tax/aadeE2';
import { atakDigits, isAtak } from '@/lib/property/atak';

export interface KnownProperty {
  id: string;
  name: string;
  address: string | null;
  atak: string | null;
  sqm?: number | null;
  ownership?: number | null;
  floor?: string | null;
}

export type MatchResult =
  | { status: 'new' }
  | { status: 'exists'; id: string }
  | { status: 'maybe'; id: string };

/**
 * Η διεύθυνση σε συγκρίσιμη μορφή: κεφαλαία χωρίς τόνους, χωρίς «οδός»,
 * σημεία στίξης και πόλη μετά το κόμμα. «Οδός Παραδείγματος 12, Αθήνα» και
 * «ΠΑΡΑΔΕΙΓΜΑΤΟΣ 12» δίνουν το ίδιο.
 */
export function addressKey(raw: string | null | undefined): string | null {
  const first = String(raw ?? '').split(/[,\n]/)[0];
  // Το `\b` της JavaScript ξέρει μόνο λατινικά: τα όρια λέξης γράφονται με \p{L}.
  const f = fold(first).replace(/(?<!\p{L})(ΟΔΟΣ|ΟΔ|ΛΕΩΦΟΡΟΣ|ΛΕΩΦ|ΠΛΑΤΕΙΑ|ΠΛ)(?!\p{L})/gu, ' ')
    .replace(/[^\p{L}\d ]/gu, ' ').replace(/\s+/g, ' ').trim();
  const num = /(?<!\d)(\d{1,4})(?!\d)/.exec(f);
  const words = f.replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!num || words.length < 3) return null;
  return `${words}|${num[1]}`;
}

/** Ταίριασμα μιας γραμμής της πράξης με τα ακίνητα της εφαρμογής. Καθαρή συνάρτηση. */
export function matchProperty(
  row: { atak: string | null; address: string | null }, known: readonly KnownProperty[],
): MatchResult {
  const atak = atakDigits(row.atak);
  if (isAtak(atak)) {
    const hit = known.find(k => atakDigits(k.atak) === atak);
    if (hit) return { status: 'exists', id: hit.id };
  }
  const key = addressKey(row.address);
  if (key) {
    const hit = known.find(k => !isAtak(k.atak) && addressKey(k.address) === key);
    if (hit) return { status: 'maybe', id: hit.id };
  }
  return { status: 'new' };
}

/**
 * Μόνο τα κενά πεδία ενός υπάρχοντος ακινήτου (κανόνας του Ε9 στη σάρωση).
 * Τίποτα που έγραψε ο χρήστης δεν αλλάζει. Το 0 στο εμβαδόν σημαίνει «δεν δόθηκε».
 */
export function fillOnlyEmpty(
  current: KnownProperty, found: { atak: string | null; sqm: number | null; floor: string | null; address: string | null },
): Record<string, string | number> {
  const patch: Record<string, string | number> = {};
  if (!isAtak(current.atak) && isAtak(found.atak)) patch.atak = atakDigits(found.atak);
  if (!(Number(current.sqm) > 0) && found.sqm && found.sqm > 0) patch.sqm = found.sqm;
  if (!String(current.floor ?? '').trim() && found.floor?.trim()) patch.floor = found.floor.trim();
  if (!String(current.address ?? '').trim() && found.address?.trim()) patch.address = found.address.trim();
  return patch;
}
