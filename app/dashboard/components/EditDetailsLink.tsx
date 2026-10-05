// ═══════════════════════════════════════════════════════════════════════════
// «ΕΠΙΣΤΡΕΨΕ ΣΤΑ ΣΤΟΙΧΕΙΑ ΤΟΥ ΑΚΙΝΗΤΟΥ», ΜΕ ΕΝΑ ΠΑΤΗΜΑ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ (05.10.2026). Τέσσερα σημεία της Λογιστικής έλεγαν «Όρισε το
// ΑΦΜ του ιδιοκτήτη στην «Επεξεργασία στοιχείων» από το μενού κάθε ακινήτου».
// Ο χρήστης έπρεπε να βρει μόνος του το μενού, να διαλέξει το ακίνητο, να
// ανοίξει τον οδηγό και να φτάσει στο τέταρτο βήμα. Τώρα το όνομα είναι
// σύνδεσμος: ανοίγει τον οδηγό του ακινήτου στο βήμα «Επαφές» με τον κέρσορα
// στο ΑΦΜ (`AddPropertyWizard`, `focus="owner_afm"`).
//
// Ένα ακίνητο: ο σύνδεσμος είναι η ίδια η «Επεξεργασία στοιχείων». Πολλά: ένας
// σύνδεσμος ανά ακίνητο, με το όνομά του. Χωρίς χειριστή (π.χ. σε οθόνη χωρίς
// οδηγό) μένει το παλιό κείμενο, που λέει πού είναι.
// ═══════════════════════════════════════════════════════════════════════════
import { Fragment } from 'react';
import { LinkBtn } from '@/components/Theme';

type Target = { id?: string | null; name?: string | null };

/** Πόσα ονόματα χωρούν σε μία πρόταση πριν γίνει κατάλογος. */
const MAX_NAMED = 6;

export function EditDetailsLink({ properties, onEdit }: {
  properties: readonly Target[];
  onEdit?: (propertyId: string) => void;
}) {
  const targets = properties.filter((p): p is { id: string; name?: string | null } => !!p.id);
  if (!onEdit || targets.length === 0) return <>«Επεξεργασία στοιχείων» από το μενού του ακινήτου</>;
  if (targets.length === 1) {
    return <><LinkBtn onClick={() => onEdit(targets[0].id)}>Επεξεργασία στοιχείων</LinkBtn> του ακινήτου</>;
  }
  const shown = targets.slice(0, MAX_NAMED);
  const rest = targets.length - shown.length;
  return (
    <>
      «Επεξεργασία στοιχείων» κάθε ακινήτου:{' '}
      {shown.map((p, i) => (
        <Fragment key={p.id}>
          {i > 0 && ' · '}
          <LinkBtn onClick={() => onEdit(p.id)}>{p.name?.trim() || 'Ακίνητο'}</LinkBtn>
        </Fragment>
      ))}
      {rest > 0 && ` και ${rest === 1 ? '1 ακόμη' : `${rest} ακόμη`}`}
    </>
  );
}
