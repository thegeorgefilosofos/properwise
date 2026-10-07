'use client';
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΕΠΙΛΟΓΕΑΣ ΤΩΝ ΔΗΜΟΣΙΩΝ ΥΠΟΛΟΓΙΣΤΩΝ, ΣΕ ΔΙΚΟ ΤΟΥ ΑΡΧΕΙΟ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΧΩΡΙΣΤΑ ΑΠΟ ΤΟ app/ToolParts.tsx. Το `CustomSelect` έρχεται από το
// UIComponents της εφαρμογής, που μπαίνει ΟΛΟΚΛΗΡΟ στο πακέτο του περιηγητή:
// ημερολόγιο, μαζικές ενέργειες, πεδία αριθμών, 7,2 KB gzip στο κρίσιμο
// μονοπάτι. Οσο ο επιλογέας ζούσε στο ToolParts, τα πλήρωνε κάθε υπολογιστής·
// η καθαρή απόδοση, που δεν έχει κανέναν επιλογέα, ζούσε 0,4 KB κάτω από το
// όριο του scripts/perf-budget.mjs. Τώρα τα πληρώνει μόνο όποιος τον
// εισάγει: ΕΝΦΙΑ, βραχυχρόνια, ρεύμα.
// ═══════════════════════════════════════════════════════════════════════════
import type { ReactNode } from 'react';
import { CustomSelect } from '@/app/dashboard/components/UIComponents';
import { TOOL_LABEL, ToolHint, spanClass, type ToolSpan } from '@/app/ToolParts';

/**
 * Επιλογέας με την ετικέτα των πεδίων από πάνω του.
 *
 * Η ΕΤΙΚΕΤΑ ΤΗΝ ΓΡΑΦΕΙ Η ΣΕΛΙΔΑ, ΟΧΙ ΤΟ ΧΕΙΡΙΣΤΗΡΙΟ. Το `CustomSelect` φέρνει
 * τη δική του ετικέτα, με το στιλ των φορμών της εφαρμογής: πεζά, μεγαλύτερα,
 * άλλο βάρος. Δίπλα στα πεδία κειμένου, που έχουν κεφαλαία ετικέτα, η ίδια
 * σειρά θα είχε δύο τυπογραφίες. Περνά μόνο `ariaLabel`, ώστε ο αναγνώστης
 * οθόνης να ακούει το ίδιο που διαβάζει το μάτι. (Ο εγγενής `<select>` δεν
 * επιτρέπεται: scripts/guard-native-fields.mjs.)
 */
export function ToolSelect({ label, value, onChange, options, hint, span }: {
  label: string; value: string; onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
  hint?: ReactNode; span?: ToolSpan;
}) {
  return (
    <div className={spanClass(span)}>
      <span style={TOOL_LABEL}>{label}</span>
      <CustomSelect ariaLabel={label} value={value} onChange={onChange} options={[...options]}/>
      {hint && <ToolHint>{hint}</ToolHint>}
    </div>
  );
}
