// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΛΗΡΟΤΗΤΑ ΤΟΥ ΦΑΚΕΛΟΥ: ΕΝΑΣ ΜΕΤΡΗΤΗΣ ΓΙΑ ΟΘΟΝΗ, ΑΡΧΕΙΟ ΚΑΙ ΣΥΝΑΝΤΗΣΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ (05.10.2026). Τρία σημεία μετρούσαν «τι λείπει»
// από τον ίδιο κατάλογο (lib/accounting/dossier.ts) με τρεις κανόνες:
//   · Η ΟΘΟΝΗ (AccountantDossier) μετρούσε το ΑΤΑΚ, το ΑΜΑ και το
//     προσυμπληρωμένο Ε2 μόνο με τσεκ: ακίνητα με καταχωρημένο ΑΤΑΚ έβλεπαν
//     «λείπει το ΑΤΑΚ». Ό,τι βγάζει η εφαρμογή μετρούσε «έτοιμο» εξ ορισμού
//     όταν δεν δινόταν κανόνας δεδομένων.
//   · Ο ΦΑΚΕΛΟΣ ΤΟΥ ΑΚΙΝΗΤΟΥ (Excel) έγραφε στην κεφαλίδα «Ο φάκελος είναι
//     πλήρης» και από κάτω, στο ίδιο φύλλο, κενά στα δεδομένα.
//   · Ο ΦΑΚΕΛΟΣ ΤΗΣ ΣΥΝΑΝΤΗΣΗΣ (ανά ΑΦΜ) μετρούσε το ΑΤΑΚ, το ΑΜΑ και το
//     προσυμπληρωμένο Ε2 ΔΥΟ φορές: μία από τα στοιχεία του ακινήτου και μία
//     από τον κατάλογο, όσο ο χρήστης δεν το είχε τσεκάρει. Και πετούσε κάθε
//     γραμμή που βγάζει η εφαρμογή, έτοιμη ή όχι.
//
// ΕΝΑΣ ΟΡΙΣΜΟΣ.
//   · Ο ΚΑΤΑΛΟΓΟΣ είναι του `requirementsFor`, για τα ακίνητα του πεδίου (όλο
//     το χαρτοφυλάκιο στην οθόνη, ένα ακίνητο στο αρχείο του, ένας ΑΦΜ στη
//     συνάντηση).
//   · ΕΓΙΝΕ, με αυτή τη σειρά:
//       1. όπου η εφαρμογή ΞΕΡΕΙ από δεδομένα, κρίνουν τα δεδομένα και το τσεκ
//          δεν μετράει: ΑΤΑΚ σε κάθε ακίνητο, ΑΜΑ σε κάθε βραχυχρόνιο,
//          προσυμπληρωμένο Ε2 ανεβασμένο (όταν η οθόνη το ξέρει)·
//       2. ό,τι βγάζει η εφαρμογή είναι έτοιμο μόνο όταν η χρήση έχει τα
//          δεδομένα του (`appItemReady`), ποτέ εξ ορισμού·
//       3. όλα τα άλλα, με το τσεκ του χρήστη.
//   · ΠΛΗΡΗΣ είναι ο φάκελος μόνο όταν δεν λείπει τίποτα από τον κατάλογο ΚΑΙ
//     δεν έμεινε κανένα κενό στα δεδομένα (`gaps`). Η φράση το λέει όποτε
//     λείπουν μόνο δεδομένα.
// ═══════════════════════════════════════════════════════════════════════════
import {
  requirementsFor, readiness,
  type DossierContext, type DossierProperty, type Readiness, type Requirement,
} from '@/lib/accounting/dossier';

export interface CompletenessProperty extends DossierProperty {
  /** Το ΑΤΑΚ του ακινήτου. `undefined` = δεν διαβάστηκε· τότε κρίνει το τσεκ. */
  atak?: string | null;
  /** Ο ΑΜΑ του ακινήτου. `undefined` = δεν διαβάστηκε. */
  ama?: string | null;
}

/** Τι κατέγραψε η χρήση, για τις γραμμές που βγάζει η εφαρμογή. */
export interface YearData {
  /** Περίοδοι ενοικίου μέσα στη χρήση. */
  rent: boolean;
  /** Διαμονές μέσα στη χρήση. */
  stays: boolean;
  /** Δαπάνες ή λογαριασμοί μέσα στη χρήση. */
  costs: boolean;
}

export interface CompletenessInput extends Omit<DossierContext, 'properties' | 'statuses'> {
  properties: readonly CompletenessProperty[];
  /** Όσα τσέκαρε ο χρήστης (`accountant_dossier.have_ids`). */
  ticked: readonly string[];
  data: YearData;
  /** Το προσυμπληρωμένο Ε2, όταν η οθόνη το ξέρει. Χωρίς αυτό κρίνει το τσεκ. */
  prefilled?: 'uploaded' | 'not_uploaded';
  /** Κενά στα δεδομένα, ως φράσεις. Δεν μετρούν στο Χ / Υ, αλλά κρατούν το «πλήρης». */
  gaps?: readonly string[];
}

export type DoneBy = 'data' | 'app' | 'tick';

export interface CompletenessItem extends Requirement {
  done: boolean;
  /** Ποιος το κρίνει. Μόνο το `tick` αλλάζει με το κουτάκι. */
  by: DoneBy;
  /** Όταν κρίνουν τα δεδομένα και λείπει: σε ποια ακίνητα. */
  missingFor?: string[];
}

export interface Completeness extends Readiness {
  items: CompletenessItem[];
  /** Τα ids που μετρούν ως έγινε, για όσους κρατούν ακόμη λίστα. */
  doneIds: string[];
  gaps: string[];
  /** Τίποτα από τον κατάλογο και κανένα κενό δεδομένων. */
  complete: boolean;
}

/** Ό,τι βγάζει η εφαρμογή είναι έτοιμο μόνο όταν η χρήση έχει αυτό από το οποίο βγαίνει. */
export function appItemReady(id: string, d: YearData): boolean {
  if (id === 'expenses') return d.costs;
  if (id === 'e2' || id === 'lease_contract') return d.rent;
  if (id === 'e2_short') return d.stays;
  return d.rent || d.stays || d.costs;
}

const yearStatuses = (p: DossierProperty) => (p.yearStatuses && p.yearStatuses.length ? p.yearStatuses : [p.status]);
const has = (v: string | null | undefined) => !!String(v ?? '').trim();

/** Κρίνουν τα δεδομένα; Επιστρέφει τα ακίνητα που λείπουν, ή `null` όταν δεν ξέρουμε. */
function fromData(id: string, input: CompletenessInput): string[] | null {
  if (id === 'atak') {
    const ps = input.properties;
    if (!ps.length || ps.some(p => p.atak === undefined)) return null;
    return ps.filter(p => !has(p.atak)).map(p => p.name);
  }
  if (id === 'ama') {
    const ps = input.properties.filter(p => yearStatuses(p).includes('rent_short'));
    if (!ps.length || ps.some(p => p.ama === undefined)) return null;
    return ps.filter(p => !has(p.ama)).map(p => p.name);
  }
  if (id === 'e2_prefilled' && input.prefilled) {
    return input.prefilled === 'uploaded' ? [] : ['όλο το ΑΦΜ'];
  }
  return null;
}

export function dossierCompleteness(input: CompletenessInput): Completeness {
  const reqs = requirementsFor({ ...input, statuses: input.properties.map(p => p.status), properties: input.properties });
  const ticked = new Set(input.ticked);
  const items: CompletenessItem[] = reqs.map(r => {
    if (r.who === 'app') return { ...r, done: appItemReady(r.id, input.data), by: 'app' };
    const missing = fromData(r.id, input);
    if (missing) {
      return missing.length
        ? { ...r, done: false, by: 'data', missingFor: missing }
        : { ...r, done: true, by: 'data' };
    }
    return { ...r, done: ticked.has(r.id), by: 'tick' };
  });
  const doneIds = items.filter(i => i.done).map(i => i.id);
  const base = readiness(reqs, doneIds);
  const gaps = [...(input.gaps ?? [])];
  const complete = base.blocking.length + base.pending.length === 0 && gaps.length === 0;
  const message = base.blocking.length + base.pending.length === 0 && gaps.length > 0
    ? `Τα δικαιολογητικά είναι πλήρη. ${gaps.length === 1 ? 'Μένει ένα κενό' : `Μένουν ${gaps.length} κενά`} στα δεδομένα.`
    : base.message;
  return { ...base, message, items, doneIds, gaps, complete };
}
