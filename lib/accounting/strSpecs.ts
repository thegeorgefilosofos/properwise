// ═══════════════════════════════════════════════════════════════════════════
// ΤΙ ΠΡΕΠΕΙ ΝΑ ΕΧΕΙ ΤΟ ΑΚΙΝΗΤΟ ΒΡΑΧΥΧΡΟΝΙΑΣ, ΩΣ ΛΙΣΤΑ ΕΡΓΑΣΙΩΝ
// ─────────────────────────────────────────────────────────────────────────
// Η εφαρμογή έλεγε ήδη τι χρειάζεται (το `str-technical-specs` στο
// lib/accounting/updates2026.ts και ο οδηγός /odigos/vraxyxronia-ama-prodiagrafes-2026)
// αλλά ως ΚΕΙΜΕΝΟ: μία εργασία «συγκέντρωσε τα δικαιολογητικά» χωρίς τίποτα να
// τσεκάρεις. Εδώ τα ίδια στοιχεία γίνονται πρότυπο εκκρεμοτήτων, ένα ανά γραμμή.
//
// ΠΗΓΕΣ. Άρθρο 3 ν.5170/2025 (ΦΕΚ Α΄ 6/20.01.2025) για πυροσβεστήρα, ανιχνευτή
// καπνού, φαρμακείο και σήμανση διαφυγής, από 01/10/2025. Η εγκύκλιος του
// Υπουργείου Τουρισμού 19567/25.09.2025 (διορθωμένη επανέκδοση της
// 19231/19.09.2025) απαριθμεί τα υπόλοιπα. Ο κατάλογος διαβάστηκε μόνο σε
// δευτερογενείς πηγές· ποιο στοιχείο στηρίζεται σε ποια πράξη θέλει ανάγνωση του
// πρωτογενούς κειμένου (το μητρώο είναι το data/accounting-sources.json,
// `str_safety`). Γι' αυτό καμία πράξη δεν φαίνεται ακόμη στην οθόνη: το
// updates2026.ts γράφει ν.5073/2023 για τις προδιαγραφές συνολικά και το μητρώο
// το άρθρο 3 ν.5170/2025 για τέσσερα στοιχεία. Δύο βάσεις στην ίδια οθόνη θα
// ήταν χειρότερες από καμία, ώσπου να διαβαστεί η εγκύκλιος.
//
// ΚΑΝΕΝΑ ΔΙΑΣΤΗΜΑ ΑΝΑΝΕΩΣΗΣ ΔΕΝ ΥΠΟΛΟΓΙΖΕΤΑΙ: ο νόμος δεν ορίζει κανένα. Το
// «ετήσια» στο ασφαλιστήριο είναι η συνήθης διάρκεια του συμβολαίου, όχι κανόνας,
// και ο χρήστης το αλλάζει. Κανένας αριθμός (κιλά πυροσβεστήρα, πρόστιμα) δεν
// μπαίνει σε ετικέτα: τα πρόστιμα ζουν μόνο στο updates2026.ts.
// ═══════════════════════════════════════════════════════════════════════════

export type StrSpecKind = 'document' | 'equipment' | 'space';

export interface StrSpec {
  id: string;
  label: string;
  kind: StrSpecKind;
  priority: 'critical' | 'high';
  recurring: 'none' | 'yearly';
  /** Μόνο στα έγγραφα: πώς μπαίνει η λήξη τους στο ημερολόγιο. */
  note?: string;
}

/** Υπό όρο: ΥΔΕ ή βεβαίωση απεντόμωσης συχνά δεν γράφει λήξη. */
const DOC_NOTE = 'Αν το έγγραφο γράφει ημερομηνία λήξης, βάλ’ την ως προθεσμία· μπαίνει στο ημερολόγιο.';

export const STR_SPECS: readonly StrSpec[] = [
  { id: 'insurance', label: 'Ασφαλιστήριο αστικής ευθύνης', kind: 'document', priority: 'critical', recurring: 'yearly', note: DOC_NOTE },
  { id: 'extinguisher', label: 'Πυροσβεστήρας', kind: 'equipment', priority: 'critical', recurring: 'none' },
  { id: 'smoke_detector', label: 'Ανιχνευτής καπνού', kind: 'equipment', priority: 'critical', recurring: 'none' },
  { id: 'first_aid', label: 'Φαρμακείο πρώτων βοηθειών', kind: 'equipment', priority: 'critical', recurring: 'none' },
  { id: 'escape_signage', label: 'Σήμανση διαφυγής', kind: 'equipment', priority: 'critical', recurring: 'none' },
  { id: 'electrician', label: 'Υπεύθυνη δήλωση ηλεκτρολόγου (ΥΔΕ)', kind: 'document', priority: 'high', recurring: 'none', note: DOC_NOTE },
  { id: 'pest_control', label: 'Βεβαίωση μυοκτονίας και απεντόμωσης', kind: 'document', priority: 'high', recurring: 'none', note: DOC_NOTE },
  { id: 'natural_light', label: 'Φυσικός φωτισμός στους χώρους', kind: 'space', priority: 'high', recurring: 'none' },
  { id: 'ventilation', label: 'Αερισμός στους χώρους', kind: 'space', priority: 'high', recurring: 'none' },
];

