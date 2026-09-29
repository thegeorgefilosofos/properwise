// ═══════════════════════════════════════════════════════════════════════════
// ΕΓΚΑΤΑΣΤΑΣΗ ΣΤΗΝ ΑΡΧΙΚΗ ΟΘΟΝΗ: ΤΙ ΜΠΟΡΕΙ Η ΣΥΣΚΕΥΗ ΚΑΙ ΠΟΙΟΣ ΚΡΑΤΑ ΤΗΝ ΠΡΟΣΚΛΗΣΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ iPhone ΔΕΝ ΕΒΛΕΠΕ ΤΙΠΟΤΑ. Η πρόσκληση άνοιγε μόνο με το
// `beforeinstallprompt`, που το Safari δεν στέλνει ποτέ. Το σχόλιο έλεγε «στο
// iOS το λέμε με λόγια», ο κώδικας δεν το έλεγε πουθενά μέσα στην εφαρμογή. Και
// επειδή στο iPhone οι ειδοποιήσεις φτάνουν ΜΟΝΟ σε εφαρμογή της αρχικής
// οθόνης, ο διακόπτης τους κρυβόταν κι αυτός: ο χρήστης iPhone δεν μάθαινε ούτε
// ότι μπορεί να την εγκαταστήσει ούτε ότι έτσι παίρνει ειδοποιήσεις.
//
// ΤΟ ΓΕΓΟΝΟΣ ΤΟΥ ANDROID ΕΡΧΕΤΑΙ ΜΙΑ ΦΟΡΑ ΑΝΑ ΕΓΓΡΑΦΟ. Αν ο χρήστης πει «Όχι
// τώρα» στο πλωτό μήνυμα, το ίδιο γεγονός μένει εδώ, ώστε το κουμπί των
// Ρυθμίσεων να ανοίξει το ίδιο παράθυρο όποτε το ζητήσει ο ίδιος.
// ═══════════════════════════════════════════════════════════════════════════

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Το γεγονός που ακούει όποια οθόνη δείχνει κουμπί εγκατάστασης. */
export const INSTALL_EVENT = 'pos-install-changed';

let deferred: BeforeInstallPromptEvent | null = null;

/** Κρατά (ή ξεχνά) την πρόσκληση του περιηγητή και το λέει σε όποιον ακούει. */
export function holdPrompt(e: BeforeInstallPromptEvent | null): void {
  deferred = e;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(INSTALL_EVENT));
}

/** Υπάρχει πρόσκληση που μπορεί να ανοίξει τώρα; */
export const canPrompt = (): boolean => deferred !== null;

/**
 * Ανοίγει το παράθυρο εγκατάστασης του περιηγητή.
 *
 * Η πρόσκληση χρησιμοποιείται ΜΙΑ φορά: μετά το `prompt()` ο περιηγητής δεν
 * δέχεται δεύτερη κλήση στο ίδιο γεγονός, οπότε ξεχνιέται όποια κι αν είναι η
 * απάντηση.
 */
export async function runPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const e = deferred;
  if (!e) return 'unavailable';
  holdPrompt(null);
  await e.prompt();
  const { outcome } = await e.userChoice;
  return outcome;
}

/**
 * iPhone ή iPad, με οποιονδήποτε περιηγητή: όλοι είναι WebKit και όλοι
 * εγκαθιστούν από την «Κοινή χρήση».
 *
 * ΤΟ iPad ΔΗΛΩΝΕΙ Mac. Από το iPadOS 13 το Safari στέλνει την ταυτότητα του
 * υπολογιστή· το ξεχωρίζει μόνο η οθόνη αφής, που Mac δεν έχει.
 */
export function isAppleMobile(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> & { platform?: string }): boolean {
  if (/iPhone|iPad|iPod/.test(nav.userAgent)) return true;
  return nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1;
}

/** Τρέχει ήδη ως εφαρμογή της αρχικής οθόνης; */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPhone/iPad στον περιηγητή: εκεί η εγκατάσταση γίνεται με το χέρι. */
export function needsManualInstall(): boolean {
  return typeof navigator !== 'undefined' && isAppleMobile(navigator) && !isInstalled();
}
