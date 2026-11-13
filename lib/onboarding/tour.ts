// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΕΡΙΗΓΗΣΗ ΤΗΣ ΠΡΩΤΗΣ ΕΙΣΟΔΟΥ: ΤΕΣΣΕΡΑ ΣΗΜΕΙΑ, ΕΝΑ ΠΡΑΓΜΑ ΤΟ ΚΑΘΕΝΑ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΤΕΣΣΕΡΑ ΚΑΙ ΓΙΑΤΙ ΑΥΤΑ. Ο νέος χρήστης μόλις είδε τον φόρο του πρώτου
// ακινήτου. Η περιήγηση δείχνει πού ζουν τα τέσσερα πράγματα που θα ξαναψάξει:
// τα ακίνητα, οι προθεσμίες και οι φόροι, τα έγγραφα για τον λογιστή και η
// Νόα. Ό,τι άλλο κάνει η εφαρμογή εμφανίζεται μόνο του, όταν αποκτήσει νόημα
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
import { ASSISTANT_NAME, ASSISTANT_ACC } from '@/lib/assistant/identity';

export interface TourStep {
  id: 'properties' | 'deadlines' | 'documents' | 'assistant';
  /** Επιλογείς CSS με σειρά προτίμησης· κρατιέται ο πρώτος ορατός. */
  targets: readonly string[];
  title: string;
  body: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'properties',
    targets: ['.topbar-switch-root'],
    title: 'Τα ακίνητά σου',
    body: 'Από εδώ αλλάζεις ακίνητο ή προσθέτεις το επόμενο. Κάθε οθόνη δείχνει το ακίνητο που διαλέγεις εδώ.',
  },
  {
    id: 'deadlines',
    targets: ['.sidebar-item[data-nav="calendar"]', '.bottom-nav-item[data-tour-nav="calendar"]'],
    title: 'Προθεσμίες και φόροι',
    body: 'Οι δόσεις ΕΝΦΙΑ, οι δηλώσεις και οι δόσεις του φόρου μπαίνουν μόνες τους στο Ημερολόγιο, με την επίσημη ημερομηνία τους.',
  },
  {
    id: 'documents',
    targets: ['.quick-add-btn', '.tour-scan'],
    title: 'Έγγραφα για τον λογιστή',
    body: 'Φωτογράφισε έναν λογαριασμό ή μια απόδειξη. Η δαπάνη μπαίνει στη σωστή κατηγορία και ο φάκελος του λογιστή μένει ενημερωμένος.',
  },
  {
    id: 'assistant',
    targets: ['.pa-fab'],
    title: `Ρώτα ${ASSISTANT_ACC}`,
    body: `Γράψε όπως θα ρωτούσες άνθρωπο, π.χ. «πόσο φόρο θα πληρώσω φέτος;». Η ${ASSISTANT_NAME} απαντά στα ελληνικά, με βάση τα δικά σου δεδομένα.`,
  },
];

/** Ορατό στοιχείο: έχει διαστάσεις και πέφτει μέσα στο πλάτος του παραθύρου. */
export function isVisibleRect(r: { width: number; height: number; left: number; right: number }, viewportWidth: number): boolean {
  return r.width > 0 && r.height > 0 && r.right > 0 && r.left < viewportWidth;
}

export interface Box { top: number; left: number; width: number; height: number }

/**
 * Πού κάθεται η κάρτα. Σε στενή οθόνη, κολλημένη πάνω ή κάτω σε όλο το πλάτος,
 * στην αντίθετη μεριά από τον στόχο. Σε φαρδιά, δεξιά από στόχο της πλαϊνής
 * μπάρας, αλλιώς κάτω ή πάνω, όπου χωρά, πάντα μέσα στο παράθυρο.
 */
export function placeCard(target: Box, card: { width: number; height: number }, vw: number, vh: number, gap = 14, edge = 16): { top: number; left: number; width: number } {
  if (vw < 640) {
    const width = vw - edge * 2;
    const below = target.top + target.height / 2 < vh / 2;
    return { width, left: edge, top: below ? Math.max(edge, vh - card.height - edge) : edge };
  }
  const width = Math.min(card.width, vw - edge * 2);
  const clampX = (x: number) => Math.min(Math.max(edge, x), vw - width - edge);
  const clampY = (y: number) => Math.min(Math.max(edge, y), vh - card.height - edge);
  const right = target.left + target.width + gap;
  if (target.left < vw / 3 && right + width + edge <= vw) {
    return { width, left: right, top: clampY(target.top + target.height / 2 - card.height / 2) };
  }
  const below = target.top + target.height + gap;
  const left = clampX(target.left + target.width / 2 - width / 2);
  if (below + card.height + edge <= vh) return { width, left, top: below };
  return { width, left, top: clampY(target.top - gap - card.height) };
}
