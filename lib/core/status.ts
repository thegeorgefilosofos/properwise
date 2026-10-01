// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΗΣ ΚΑΤΑΣΤΑΣΗΣ, ΓΡΑΜΜΕΝΟ ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΗΤΑΝ ΛΑΘΟΣ. Πέντε οθόνες έδιναν στην ίδια κατάσταση άλλο χρώμα:
//   · «Εκκρεμεί»   κίτρινο στο ημερολόγιο, γκρι στη λογιστική, γκρι στον
//                  ενοικιαστή, κόκκινο στη μηνιαία κατάσταση του email·
//   · «Ακυρώθηκε»  κόκκινο στο ημερολόγιο, δηλαδή ίδιο με το ληξιπρόθεσμο·
//   · «Ολοκληρώθηκε» γαλάζιο στις εργασίες, πράσινο αλλού·
//   · η καθυστέρηση πληρωμής πράσινο → ΜΠΛΕ → κίτρινο → κόκκινο, ενώ το μπλε
//     σε αυτή την εφαρμογή σημαίνει «πάτησέ με», όχι «λίγο αργά».
// Και η ίδια λέξη γραφόταν δύο τρόπους: «Εκπρόθεσμο» και «Ληξιπρόθεσμο».
// Ο ιδιοκτήτης δεν μάθαινε ποτέ ότι «κόκκινο = χρωστάει».
//
// Ο ΚΑΝΟΝΑΣ. Χρώμα έχει ό,τι ζητά απόφαση. Το εκκρεμές δεν έχει ακόμη συμβεί,
// άρα είναι ουδέτερο· το ακυρωμένο δεν θα συμβεί, άρα σβήνει.
//
//   πληρώθηκε / ολοκληρώθηκε → θετικό     μερικώς   → προσοχή
//   ληξιπρόθεσμο              → αρνητικό   εκκρεμεί  → ουδέτερο
//   σε εξέλιξη                → γαλάζιο    ακυρώθηκε → σβηστό (3η βαθμίδα)
//
// Η λέξη μένει πάντα ο φορέας της πληροφορίας: το χρώμα τη συνοδεύει, δεν την
// αντικαθιστά. Το ίδιο λεξιλόγιο ακολουθούν και τα email
// (supabase/functions/_shared/emailPalette.ts · EMAIL_TONE).
// ═══════════════════════════════════════════════════════════════════════════

export type StatusKind = 'paid' | 'done' | 'partial' | 'pending' | 'overdue' | 'active' | 'cancelled'
export type StatusTone = 'positive' | 'warning' | 'negative' | 'accent' | 'neutral' | 'muted'

export const STATUS_TONE: Record<StatusKind, StatusTone> = {
  paid: 'positive',
  done: 'positive',
  partial: 'warning',
  pending: 'neutral',
  overdue: 'negative',
  active: 'accent',
  cancelled: 'muted',
}

/** Οι λέξεις. «Ληξιπρόθεσμο» και όχι «Εκπρόθεσμο»: μία λέξη για μία κατάσταση. */
export const STATUS_LABEL: Record<StatusKind, string> = {
  paid: 'Πληρώθηκε',
  done: 'Ολοκληρώθηκε',
  partial: 'Μερικώς',
  pending: 'Εκκρεμεί',
  overdue: 'Ληξιπρόθεσμο',
  active: 'Σε εξέλιξη',
  cancelled: 'Ακυρώθηκε',
}

const isSignal = (t: StatusTone): t is 'positive' | 'warning' | 'negative' | 'accent' => t !== 'neutral' && t !== 'muted'

/** Το μελάνι του τόνου πάνω στην επιφάνεια (κουκκίδα, κείμενο δίπλα σε κουκκίδα). */
export const toneColor = (t: StatusTone): string =>
  isSignal(t) ? `var(--${t})` : t === 'neutral' ? 'var(--text-secondary)' : 'var(--text-tertiary)'

/** Το σήμα: μελάνι πάνω στο απαλό φόντο του ίδιου τόνου, με περίγραμμα. */
export const tonePill = (t: StatusTone): { color: string; background: string; border: string } =>
  isSignal(t)
    ? { color: `var(--${t}-on-container)`, background: `var(--${t}-soft)`, border: `1px solid var(--${t}-border)` }
    : { color: toneColor(t), background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }

export const statusColor = (k: StatusKind): string => toneColor(STATUS_TONE[k])
export const statusPill = (k: StatusKind) => tonePill(STATUS_TONE[k])
