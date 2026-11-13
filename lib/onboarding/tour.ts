// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΕΡΙΗΓΗΣΗ ΤΗΣ ΠΡΩΤΗΣ ΕΙΣΟΔΟΥ: ΤΡΙΑ ΣΗΜΕΙΑ, ΕΝΑ ΠΡΑΓΜΑ ΤΟ ΚΑΘΕΝΑ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΤΡΙΑ ΚΑΙ ΓΙΑΤΙ ΑΥΤΑ. Ο νέος χρήστης μόλις είδε τον φόρο του πρώτου
// ακινήτου. Η περιήγηση δείχνει πού ζουν τα τρία πράγματα που θα ξαναψάξει:
// οι προθεσμίες και οι φόροι, τα έγγραφα για τον λογιστή και η Νόα. Ο
// επιλογέας ακινήτων έφυγε (13/11/2026): με ένα ακίνητο δεν έχει τι να
// αλλάξει και το βέλος του λέει μόνο του ότι ανοίγει λίστα. Ό,τι άλλο κάνει η εφαρμογή εμφανίζεται μόνο του, όταν αποκτήσει νόημα
// (lib/nav/disclosure.ts): μια περιήγηση που τα δείχνει όλα δεν θυμάται κανείς.
//
// ΚΑΘΕ ΒΗΜΑ ΔΕΙΧΝΕΙ ΠΡΑΓΜΑΤΙΚΟ ΣΤΟΙΧΕΙΟ. Οι επιλογείς είναι λίστα με σειρά
// προτίμησης: σε υπολογιστή η πλαϊνή μπάρα, σε κινητό η κάτω μπάρα ή το
// κουμπί της Επισκόπησης. Κρατιέται το πρώτο ΟΡΑΤΟ. Βήμα χωρίς ορατό στόχο
// παραλείπεται, αντί να δείξει κάρτα που δεν δείχνει τίποτα.
//
// Η ΟΛΟΚΛΗΡΩΣΗ ΚΑΙ Η ΑΠΟΡΡΙΨΗ ΓΡΑΦΟΝΤΑΙ ΣΤΗ ΒΑΣΗ. Η στήλη
// `onboarding_progress.completed` υπήρχε από την πρώτη μετανάστευση και δεν
// τη διάβαζε ούτε την έγραφε κανείς: είναι ακριβώς το «τελείωσε την
// υποδοχή». Χωρίς νέα μετανάστευση. Το τοπικό κλειδί είναι δίχτυ για την
// αποτυχημένη εγγραφή, ώστε η περιήγηση να μην ξανανοίξει στην ίδια συσκευή.
// ═══════════════════════════════════════════════════════════════════════════
import { ASSISTANT_NAME } from '@/lib/assistant/identity';

export interface TourStep {
  id: 'deadlines' | 'documents' | 'assistant';
  /** Επιλογείς CSS με σειρά προτίμησης· κρατιέται ο πρώτος ορατός. */
  targets: readonly string[];
  title: string;
  body: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'deadlines',
    targets: ['.sidebar-item[data-nav="calendar"]', '.bottom-nav-item[data-tour-nav="calendar"]'],
    title: 'Προθεσμίες και φόροι',
    body: 'Οι δόσεις ΕΝΦΙΑ και φόρου εισοδήματος είναι ήδη στο Ημερολόγιο.',
  },
  {
    id: 'documents',
    targets: ['.quick-add-btn', '.tour-scan'],
    // Ενας όρος για το έγγραφο: «παραστατικό» στο περιεχόμενο, «Σάρωση» στην πράξη.
    title: 'Σάρωση παραστατικών',
    body: 'Με τη Σάρωση, κάθε παραστατικό καταχωρείται έτοιμο για τον λογιστή.',
  },
  {
    id: 'assistant',
    targets: ['.pa-fab'],
    // Ο τίτλος δεν επαναλαμβάνει το κουμπί από κάτω του («Ρώτα τη Νόα»):
    // τρεις ίδιες φράσεις στην ίδια οθόνη (κριτική σχεδίασης r2).
    title: `Η ${ASSISTANT_NAME}`,
    // Η Νόα συστήνεται με το όνομά της (στον τίτλο), ποτέ με τίτλο ρόλου.
    // Το όνομα το λέει ο τίτλος· το σώμα δεν το ξαναγράφει (κριτική σχεδίασης r3).
    body: 'Απαντά για τα ακίνητά σου, με τα δικά σου στοιχεία.',
  },
];

/** Ορατό στοιχείο: έχει διαστάσεις και πέφτει μέσα στο πλάτος του παραθύρου. */
export function isVisibleRect(r: { width: number; height: number; left: number; right: number }, viewportWidth: number): boolean {
  return r.width > 0 && r.height > 0 && r.right > 0 && r.left < viewportWidth;
}

export interface Box { top: number; left: number; width: number; height: number }

export type CaretEdge = 'top' | 'bottom' | 'left' | 'right';

export interface CardPlace {
  top: number; left: number; width: number;
  /** Η ακμή της κάρτας που κοιτά τον στόχο και η θέση του βέλους πάνω της. */
  caret: { edge: CaretEdge; offset: number };
}

/** Η κάρτα δεν ανεβαίνει πάνω από την μπάρα της κορυφής (64 ύψος και 8 αέρας). */
export const TOUR_TOP = 72;

/**
 * Πού κάθεται η κάρτα: ΠΑΝΤΑ ΔΙΠΛΑ ΣΤΟΝ ΣΤΟΧΟ, με βέλος στο κέντρο του.
 *
 * - Στενή οθόνη (< 640): όλο το πλάτος, πάνω από στόχο του κάτω μισού ή κάτω
 *   από στόχο του πάνω.
 * - Φαρδιά, στόχος στο αριστερό τρίτο (πλαϊνή μπάρα): ΚΑΤΩ από τον στόχο,
 *   μέσα στη στήλη της μπάρας, ως τη δεξιά ακμή του στόχου (τουλάχιστον 240).
 *   Δεξιά της μπάρας η κάρτα έκοβε στη μέση το ποσό του φόρου και τη λίστα
 *   «Από πού ξεκινάς» (κριτική σχεδίασης r3)· εδώ σκεπάζει μόνο στοιχεία της
 *   μπάρας κάτω από το πέπλο. Δεξιά της μόνο όταν από κάτω δεν χωρά.
 * - Φαρδιά, στόχος κάτω δεξιά (το κουμπί της Νόας): ΑΡΙΣΤΕΡΑ του, ώστε η
 *   κάρτα να μη σκεπάζει ούτε τον στόχο ούτε τη στήλη από πάνω του.
 * - Αλλιώς κάτω ή πάνω, όπου χωρά.
 *
 * Πάντα μέσα στο παράθυρο και ποτέ πάνω από το `TOUR_TOP`.
 */
export function placeCard(target: Box, card: { width: number; height: number }, vw: number, vh: number, gap = 14, edge = 16, top0 = TOUR_TOP): CardPlace {
  const cx = target.left + target.width / 2;
  const cy = target.top + target.height / 2;
  const minTop = Math.max(edge, top0);
  const clampY = (y: number) => Math.max(minTop, Math.min(y, vh - card.height - edge));
  const along = (pos: number, size: number) => Math.min(Math.max(20, pos), size - 20);
  const vertical = (width: number, left: number): CardPlace => {
    const below = target.top + target.height + gap;
    const fitsBelow = below + card.height + edge <= vh;
    const preferAbove = cy > vh / 2 || !fitsBelow;
    const top = preferAbove ? clampY(target.top - gap - card.height) : clampY(below);
    return { top, left, width, caret: { edge: preferAbove ? 'bottom' : 'top', offset: along(cx - left, width) } };
  };
  if (vw < 640) return vertical(vw - edge * 2, edge);
  const width = Math.min(card.width, vw - edge * 2);
  const right = target.left + target.width + gap;
  if (target.left < vw / 3) {
    const below = target.top + target.height + gap;
    const left = Math.max(edge, target.left);
    // Ως τη δεξιά ακμή του στόχου, ώστε να μένει μέσα στη στήλη της μπάρας.
    const colWidth = Math.min(width, Math.max(240, target.left + target.width - left));
    if (below >= minTop && below + card.height + edge <= vh && left + colWidth + edge <= vw) {
      return { top: below, left, width: colWidth, caret: { edge: 'top', offset: along(cx - left, colWidth) } };
    }
    if (right + width + edge <= vw) {
      const top = clampY(target.top - 8);
      return { top, left: right, width, caret: { edge: 'left', offset: along(cy - top, card.height) } };
    }
  }
  const leftOf = target.left - gap - width;
  if (cx > vw / 2 && cy > vh / 2 && leftOf >= edge) {
    // Η κάρτα τελειώνει πάνω από τον πάτο του στόχου, όχι στο κέντρο του: έτσι
    // το βέλος δείχνει τον στόχο και η κάρτα δεν κατεβαίνει κάτω από αυτόν.
    const top = clampY(target.top + target.height - card.height);
    return { top, left: leftOf, width, caret: { edge: 'right', offset: along(cy - top, card.height) } };
  }
  const left = Math.min(Math.max(edge, cx - width / 2), vw - width - edge);
  return vertical(width, left);
}
