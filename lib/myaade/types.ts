// ═══════════════════════════════════════════════════════════════════════════
// ΤΙ ΒΓΑΖΕΙ Η ΕΙΣΑΓΩΓΗ ΑΠΟ ΤΟ myAADE: ΕΝΑΣ ΤΥΠΟΣ, ΧΩΡΙΣ ΒΑΣΗ ΚΑΙ ΧΩΡΙΣ REACT
// ─────────────────────────────────────────────────────────────────────────
// Ο αναλυτής (`enfiaAct.ts`) γεμίζει αυτόν τον τύπο από το κείμενο του PDF. Η
// οθόνη (`MyaadeImport.tsx`) τον δείχνει για επιβεβαίωση και η καταχώρηση
// (`commit.ts`) γράφει μόνο ό,τι επιβεβαίωσε ο χρήστης.
//
// ΚΑΝΕΝΑ ΝΟΥΜΕΡΟ ΑΠΟ ΜΑΝΤΕΨΙΑ. Όπου ο αναλυτής δεν είναι βέβαιος, το πεδίο
// μένει `null` και γράφεται προειδοποίηση. Ένα έγγραφο που δεν αναγνωρίζεται
// δίνει `status: 'unrecognized'`, ποτέ ένα «άδειο» αποτέλεσμα σαν να διαβάστηκε.
// ═══════════════════════════════════════════════════════════════════════════

/** Τι έγγραφο είναι. Το Ε9 αναγνωρίζεται αλλά δεν διαβάζεται ακόμη (Φάση 2). */
export type MyAadeDocKind = 'enfia_act' | 'e9' | 'unknown';

/** Ένα ακίνητο όπως το τυπώνει η πράξη. Ό,τι δεν βρέθηκε είναι `null`. */
export interface MyAadeProperty {
  atak: string | null;
  address: string | null;
  /** Δήμος ή Δημοτική Κοινότητα. */
  municipality: string | null;
  sqm: number | null;
  ownershipPct: number | null;
  /** Είδος όπως το γράφει το έγγραφο (π.χ. «Διαμέρισμα»). Δεν μεταφράζεται. */
  kind: string | null;
  floor: string | null;
  /** Ο φόρος της γραμμής, αν η πράξη τον αναλύει ανά ακίνητο. */
  tax: number | null;
  /** Κάποιο πεδίο βγήκε από τη θέση του και όχι από επικεφαλίδα: «Έλεγξέ το». */
  check: boolean;
}

/** Η πράξη ΕΝΦΙΑ, όπως τη διάβασε ο αναλυτής. */
export interface MyAadeImport {
  kind: 'enfia_act';
  year: number | null;
  /** Μόνο για τον έλεγχο «άλλος ΑΦΜ». Δεν αποθηκεύεται πουθενά. */
  afm: string | null;
  /** Το ποσό που πληρώνεται, όλα τα ακίνητα του ΑΦΜ. Από αυτό βγαίνουν οι δόσεις. */
  total: number | null;
  mainTax: number | null;
  supplementaryTax: number | null;
  /** Όπως τα τυπώνει το έγγραφο, ΜΟΝΟ για σύγκριση με τη μηχανή. Δεν γράφονται. */
  printedInstalments: { count: number | null; amount: number | null } | null;
  issueDate: string | null;
  firstDueDate: string | null;
  /** Ταυτότητα Οφειλής, μόνο αν περνά τον έλεγχο ISO 11649. Δεν αποθηκεύεται (Φάση 2). */
  paymentRef: string | null;
  /** Διορθωτική πράξη: αντικαθιστά το σύνολο του ίδιου έτους. */
  corrective: boolean;
  properties: MyAadeProperty[];
  /** Ό,τι δεν στέκει, με τα νούμερα μέσα. Η οθόνη τα δείχνει όλα. */
  warnings: string[];
}

export type MyAadeParse =
  | { status: 'ok'; doc: MyAadeImport }
  | { status: 'unrecognized'; kind: MyAadeDocKind; reason: string };
