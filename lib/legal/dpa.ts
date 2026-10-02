// ═══════════════════════════════════════════════════════════════════════════
// ΣΥΜΒΑΣΗ ΕΠΕΞΕΡΓΑΣΙΑΣ ΓΙΑ ΤΑ ΣΤΟΙΧΕΙΑ ΤΟΥ ΕΝΟΙΚΙΑΣΤΗ (άρθρο 28 GDPR)
// ─────────────────────────────────────────────────────────────────────────
// Οταν ο ιδιοκτήτης ανεβάζει όνομα, ΑΦΜ ή μισθωτήριο του ενοικιαστή, εκείνος
// είναι ο υπεύθυνος επεξεργασίας και το PROPERWISE ο εκτελών. Το άρθρο 28§3
// θέλει σύμβαση γραμμένη και αποδεκτή. Οι όροι της ζουν στους Όρους χρήσης
// (/terms#epexergasia). Εδώ ζει μόνο το «την αποδέχτηκε, ποια έκδοση, πότε».
//
// Η αποδοχή ζητείται τη στιγμή που χρειάζεται, όχι στην εγγραφή: όποιος δεν
// ανεβάσει ποτέ στοιχεία τρίτου δεν έχει λόγο να τη διαβάσει. Χωρίς αποδοχή
// τα στοιχεία δεν αποθηκεύονται και ο χρήστης το διαβάζει.
// ═══════════════════════════════════════════════════════════════════════════

export const DPA_VERSION = '2026-10';
export const DPA_HREF = '/terms#epexergasia';
/** Το γεγονός που ανοίγει το παράθυρο αποδοχής (DpaModal). */
export const DPA_EVENT = 'pos:dpa-request';

type Meta = { dpa_version?: unknown } | null | undefined;

/** Η αποδοχή ισχύει μόνο για την τρέχουσα έκδοση. */
export function dpaAccepted(meta: Meta): boolean {
  return !!meta && meta.dpa_version === DPA_VERSION;
}

export interface DpaRequestDetail {
  resolve: (ok: boolean) => void;
  /** Το σημειώνει το παράθυρο όταν αναλάβει το αίτημα. */
  handled: boolean;
}

type AuthLike = {
  auth: {
    getUser: () => Promise<{ data: { user: { user_metadata?: Meta } | null }; error: unknown }>;
  };
};

/**
 * Επιστρέφει true αν η σύμβαση είναι ήδη αποδεκτή ή αν ο χρήστης την αποδεχτεί
 * τώρα. Αν δεν υπάρχει παράθυρο να ρωτήσει (π.χ. εκτός ταμπλό), επιστρέφει
 * false: χωρίς αποδοχή δεν αποθηκεύεται τίποτα.
 */
export async function ensureDpa(db: AuthLike): Promise<boolean> {
  const { data, error } = await db.auth.getUser();
  if (!error && dpaAccepted(data?.user?.user_metadata)) return true;
  if (typeof window === 'undefined') return false;
  return new Promise<boolean>(resolve => {
    const detail: DpaRequestDetail = { resolve, handled: false };
    window.dispatchEvent(new CustomEvent<DpaRequestDetail>(DPA_EVENT, { detail }));
    if (!detail.handled) resolve(false);
  });
}
