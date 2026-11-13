'use client';

// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΣΤΟΙΧΕΙΑ ΠΟΥ ΦΤΑΝΟΥΝ ΣΕ ΚΑΘΕ ΣΕΛΙΔΑ (ThemeCore)
// ─────────────────────────────────────────────────────────────────────────
// Το Theme.tsx είναι η βιβλιοθήκη του πίνακα ελέγχου: Modal, SideSheet, KPIGrid,
// Tile, Bar, EmptyState και άλλα πολλά, σχεδόν 2.000 γραμμές. Το root layout
// όμως χρειάζεται μόνο κουμπιά και το παράθυρο επιβεβαίωσης (CookieConsent,
// Toast, ConfirmDialog, error) και η εγγραφή μόνο κουμπιά. Επειδή όλα ζούσαν
// σε ΕΝΑ module, κάθε δημόσια σελίδα κατέβαζε ολόκληρη τη βιβλιοθήκη, γιατί ο
// bundler δεν σπάει ένα module στα δύο (11/11/2026, μέτρηση perf:budget).
//
// Εδώ ζει ό,τι χρειάζεται το κρίσιμο μονοπάτι των δημόσιων σελίδων. Το
// Theme.tsx τα ξαναεξάγει αυτούσια, οπότε όποιος γράφει
// `from '@/components/Theme'` δεν χρειάζεται να αλλάξει τίποτα. Αρχεία που
// φορτώνουν σε δημόσια σελίδα εισάγουν από ΕΔΩ.
// ═══════════════════════════════════════════════════════════════════════════

import { type ReactNode, type CSSProperties, type MouseEvent, type PointerEvent, type Ref, useState, useEffect, useRef, useSyncExternalStore, useId } from 'react';
import { T, TT } from './tokens';
import { backdropDismiss } from '@/lib/ui/dismiss';

// ═══ useOverlayShell — η συμπεριφορά κάθε επικάλυψης, μία φορά ════════════
// Escape, εστίαση μέσα και επιστροφή μετά, κλείδωμα κύλισης φόντου. Ήταν
// γραμμένη στο Modal και ΘΑ ξαναγραφόταν στο SideSheet — δηλαδή θα φτιάχναμε
// ακριβώς τη διπλοεγγραφή που ήρθαμε να σβήσουμε. Ζει εδώ, τη μοιράζονται.
// ── Η ΣΤΟΙΒΑ ΤΩΝ ΑΝΟΙΧΤΩΝ ΕΠΙΚΑΛΥΨΕΩΝ ────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ, ΜΕΤΡΗΜΕΝΟ. Κάθε επικάλυψη έδενε δικό της ακροατή Escape στο
// `document`. Όταν ένα παράθυρο ανοίγει ΜΕΣΑ σε ντοσιέ —«Επεξεργασία» μέσα
// στην καρτέλα επαφής, «Σάρωση απόδειξης» μέσα στην καρτέλα ενοικιαστή— και
// τα δύο άκουγαν και ένα Escape έκλεινε ΚΑΙ ΤΑ ΔΥΟ: ο χρήστης ήθελε να
// κλείσει τη φόρμα και βρισκόταν πίσω στη λίστα, με το ντοσιέ χαμένο.
// Οκτώ ζευγάρια σε πέντε οθόνες.
//
// Εδώ μένει ποια είναι ανοιχτή και με ποια σειρά. Στο Escape απαντά ΜΟΝΟ η
// κορυφαία και το z-index ανεβαίνει με το βάθος — αλλιώς Modal και SideSheet
// είχαν ΤΟ ΙΔΙΟ 1000 και κέρδιζε όποιο έτυχε να γραφτεί τελευταίο στο DOM.
// Η φόρμα επεξεργασίας ζωγραφιζόταν ΚΑΤΩ από το πέπλο του ντοσιέ: ο χρήστης
// πατούσε «Επεξεργασία» και δεν έβλεπε τίποτα.
// ── Η ΕΠΙΣΤΡΟΦΗ ΤΗΣ ΕΣΤΙΑΣΗΣ ΔΕΝ ΑΝΑΒΕΙ ΔΑΧΤΥΛΙΔΙ ΜΕΤΑ ΑΠΟ ΚΛΙΚ ────────────
// ΤΟ ΣΦΑΛΜΑ (09/11/2026, πύλη λογιστή). Ο λογιστής πατούσε με το ποντίκι
// «Καταχώρηση», έγραφε στη φόρμα, πατούσε «Αποθήκευση» και το παράθυρο
// έκλεινε: η εστίαση γύριζε με `focus()` στο κουμπί που το άνοιξε και ο
// Chrome έβαζε το μπλε δαχτυλίδι του `:focus-visible`, γιατί το τελευταίο
// εστιασμένο στοιχείο (το πεδίο) το είχε. Το δαχτυλίδι έμενε ώσπου να κάνει
// κλικ αλλού: μοιάζει με κουμπί κολλημένο σε επιλογή.
//
// Η ΕΠΙΣΤΡΟΦΗ ΜΕΝΕΙ (ο χρήστης πληκτρολογίου συνεχίζει από εκεί που ήταν). Αν
// όμως το τελευταίο που άγγιξε ήταν ποντίκι ή δάχτυλο, το στοιχείο παίρνει
// `data-quiet-focus`, που σβήνει το δαχτυλίδι (globals.css)· το χάνει στο
// πρώτο πλήκτρο ή μόλις φύγει η εστίαση. Πατάς Tab, το δαχτυλίδι γυρίζει.
let lastInputPointer = false;
let lastKey = '';
let pointerWatched = false;
function watchPointer() {
  if (pointerWatched || typeof document === 'undefined') return;
  pointerWatched = true;
  document.addEventListener('pointerdown', () => { lastInputPointer = true; }, true);
  document.addEventListener('keydown', e => { lastInputPointer = false; lastKey = e.key; }, true);
}
// Από τη φόρτωση και όχι από το πρώτο παράθυρο: αλλιώς το κλικ που άνοιξε το
// ΠΡΩΤΟ παράθυρο δεν μετρούσε.
watchPointer();
function restoreFocus(el: HTMLElement, openedByPointer: boolean) {
  // Ανοιξε με κλικ και έκλεισε με κλικ ή με Escape: κανένα δαχτυλίδι. Με Tab
  // μέσα στο παράθυρο ο άνθρωπος πλοηγείται με πληκτρολόγιο και το δαχτυλίδι μένει.
  if (lastInputPointer || (openedByPointer && lastKey === 'Escape')) quietFocus(el);
  el.focus();
}
/**
 * Σβήνει το δαχτυλίδι εστίασης ενός στοιχείου ώσπου να πατηθεί πλήκτρο ή να
 * φύγει η εστίαση. Για ό,τι άνοιξε με ποντίκι και έκλεισε χωρίς Tab (π.χ. το
 * μενού του ActionMenu που κλείνει με Escape).
 */
export function quietFocus(el: HTMLElement) {
  el.setAttribute('data-quiet-focus', '');
  const done = () => {
    el.removeAttribute('data-quiet-focus');
    el.removeEventListener('blur', done);
    document.removeEventListener('keydown', done, true);
  };
  el.addEventListener('blur', done);
  document.addEventListener('keydown', done, true);
}

const overlayStack: symbol[] = [];
const overlayWatchers = new Set<() => void>();
const notifyOverlays = () => overlayWatchers.forEach(fn => fn());
export const OVERLAY_BASE_Z = 1000;
/** Παράθυρο που ανοίγει πάνω από τη Νόα: πάνω από τον πίνακα και το κουμπί της
 *  (1200/1201), κάτω από το Toast (2000) και το ConfirmDialog (10000). */
export const ABOVE_ASSISTANT_Z = 1400;

/**
 * Υπάρχει ανοιχτό παράθυρο ή ντοσιέ αυτή τη στιγμή;
 *
 * Το χρειάζεται όποια ΟΘΟΝΗ ακούει Escape για δικό της λόγο — οι Εκκρεμότητες
 * το χρησιμοποιούν για να καθαρίσουν τη μαζική επιλογή. Χωρίς αυτό, ο χρήστης
 * που διάλεξε δέκα εργασίες, πάτησε «Διαγραφή» και μετά μετάνιωσε με Escape
 * ακύρωνε την ερώτηση ΚΑΙ έχανε τις δέκα επιλογές: πλήρωνε την ακύρωση
 * ξαναδιαλέγοντας τα πάντα.
 *
 * Η εναλλακτική ήταν να απαριθμεί κάθε οθόνη τα δικά της παράθυρα με το χέρι
 * (`showTemplates || showAddModal || !!receiptItem || …`) — κατάλογος που
 * ξεμένει πίσω την επόμενη φορά που θα προστεθεί παράθυρο, σιωπηλά.
 */
export const isOverlayOpen = (): boolean => overlayStack.length > 0;

// ═══ ΤΟ ΚΛΕΙΔΩΜΑ ΤΗΣ ΚΥΛΙΣΗΣ ΜΕΤΡΑΕΙ, ΔΕΝ ΘΥΜΑΤΑΙ (11/11/2026) ═══════════════
// Κάθε επικάλυψη κρατούσε την τιμή που βρήκε (`prev`) και την ξανάγραφε στο
// κλείσιμο, κάτι που είναι σωστό μόνο όταν κλείνουν με την ανάποδη σειρά από
// αυτή που άνοιξαν. Και το φύλλο φίλτρων του Αρχείου (ArchiveFilters) είχε δικό
// του κλείδωμα, μόνο στο `body`: στον πίνακα όμως κυλά η `.app-content`, που
// έμενε ξεκλείδωτη πίσω από το φύλλο (μετρημένο στη σκηνή `documents`).
//
// Τώρα υπάρχει ΕΝΑ κλείδωμα για όλες: η πρώτη επικάλυψη κλειδώνει και κρατά
// τις αρχικές τιμές, η τελευταία που φεύγει τις γυρίζει, με όποια σειρά κι αν
// κλείσουν.
let scrollLocks = 0;
let scrollSaved: Array<[HTMLElement, string]> = [];
export function lockScroll(): () => void {
  if (scrollLocks++ === 0) {
    const targets = [document.querySelector<HTMLElement>('.app-content'), document.body]
      .filter((el): el is HTMLElement => !!el);
    scrollSaved = targets.map(el => [el, el.style.overflow]);
    targets.forEach(el => { el.style.overflow = 'hidden'; });
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    if (--scrollLocks > 0) return;
    scrollSaved.forEach(([el, v]) => { el.style.overflow = v; });
    scrollSaved = [];
  };
}

// Εξάγεται για τη μία επικάλυψη που ΔΕΝ είναι Modal (WelcomeOnboarding): παίρνει
// την ίδια εστίαση και παγίδα Tab, με `onClose` που δεν κάνει τίποτα.
export function useOverlayShell(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Πού γυρίζει η εστίαση όταν κλείσει. Χωρίς αυτό, ο χρήστης πληκτρολογίου
  // πέφτει στο <body> και ξαναρχίζει το Tab από την κορυφή της σελίδας.
  const returnTo = useRef<HTMLElement | null>(null);
  // Σταθερή ταυτότητα ανά επικάλυψη, χωρίς ref: το `useState` με αρχικοποιητή
  // τρέχει ΜΙΑ φορά και διαβάζεται ελεύθερα στην απόδοση — ένα ref δεν
  // επιτρέπεται να διαβαστεί εκεί και το Symbol πρέπει να είναι διαθέσιμο στην
  // απόδοση για να βγει το βάθος από τη στοίβα.
  const [id] = useState(() => Symbol('overlay'));

  // ── ΤΟ ΦΟΝΤΟ ΚΛΕΙΝΕΙ ΜΟΝΟ ΑΝ ΤΟ ΠΑΤΗΜΑ ΞΕΚΙΝΗΣΕ ΕΚΕΙ ─────────────────────
  // Πάτημα μέσα σε πεδίο, σύρσιμο επιλογής κειμένου έξω από το πλαίσιο, άφημα:
  // το `click` πέφτει στον κοινό πρόγονο, δηλαδή στο φόντο και το παράθυρο
  // έκλεινε με ό,τι είχε γραφτεί (έλεγχος 19/10/2026, αναπαραγμένο στο
  // Chromium). Ο κανόνας ζει στο lib/ui/dismiss.ts και δοκιμάζεται εκεί.
  const [guard] = useState(backdropDismiss);
  const backdrop = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => guard.down(e),
    onClick: (e: MouseEvent<HTMLDivElement>) => { if (guard.click(e)) onClose(); },
  };

  // Το βάθος ΔΙΑΒΑΖΕΤΑΙ από τη στοίβα, δεν αντιγράφεται σε state. Ένα
  // `setDepth` μέσα σε effect θα προκαλούσε δεύτερη απόδοση όλου του
  // παραθύρου σε κάθε άνοιγμα — και η στοίβα είναι εξωτερικό σύστημα, οπότε
  // αυτό ακριβώς είναι η δουλειά του useSyncExternalStore.
  const depth = useSyncExternalStore(
    (cb) => { overlayWatchers.add(cb); return () => { overlayWatchers.delete(cb); }; },
    () => Math.max(0, overlayStack.indexOf(id)),
    () => 0,
  );

  useEffect(() => {
    if (!open) return;
    overlayStack.push(id);
    notifyOverlays();
    const onKey = (e: KeyboardEvent) => {
      // Μόνο η κορυφαία απαντά και στο Escape και στο Tab. Οι από κάτω αγνοούν.
      if (overlayStack[overlayStack.length - 1] !== id) return;
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;

      // ── Η ΕΣΤΙΑΣΗ ΕΒΓΑΙΝΕ ΑΠΟ ΤΟ ΠΑΡΑΘΥΡΟ ─────────────────────────────
      // Το παράθυρο έπαιρνε σωστά την εστίαση στο άνοιγμα και τη γύριζε στο
      // κλείσιμο, αλλά ΤΙΠΟΤΑ δεν την κρατούσε μέσα. Ο χρήστης πληκτρολογίου
      // που πατούσε Tab μετά το τελευταίο κουμπί έβγαινε στη σελίδα ΑΠΟ ΚΑΤΩ:
      // σε στοιχεία που δεν βλέπει (τα σκεπάζει το πέπλο) και που δεν μπορεί
      // να πατήσει με το ποντίκι. Ο δείκτης εστίασης εξαφανιζόταν και η
      // πλοήγηση γινόταν μαντεψιά — ενώ ο αναγνώστης οθόνης συνέχιζε να λέει
      // «διάλογος». Το ίδιο έκανε και το Shift+Tab προς τα πίσω.
      //
      // Ο κανόνας ζει ΕΔΩ και όχι στο κάθε παράθυρο: το Modal και το SideSheet
      // μοιράζονται αυτό το κέλυφος, οπότε διορθώνονται και τα δύο μαζί και
      // κάθε επόμενη επικάλυψη το παίρνει χωρίς να το ζητήσει.
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(el => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) { e.preventDefault(); panel.focus(); return; }

      const first = items[0], last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !panel.contains(active)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const i = overlayStack.lastIndexOf(id);
      if (i !== -1) overlayStack.splice(i, 1);
      notifyOverlays();
    };
  }, [open, onClose, id]);

  // ── ΕΣΤΙΑΣΗ ΜΕΣΑ ΚΑΙ ΕΠΙΣΤΡΟΦΗ ΜΕΤΑ ───────────────────────────────────
  // Το ίδιο το πλαίσιο, όχι το πρώτο κουμπί: το πρώτο κουμπί κάθε παραθύρου
  // είναι το «×» και μια εστίαση που ξεκινά από το κλείσιμο διαβάζεται σαν
  // πρόταση να φύγεις. Με tabIndex -1 ο αναγνώστης οθόνης διαβάζει τον τίτλο
  // και το Tab συνεχίζει από εκεί, μέσα στο παράθυρο.
  //
  // ΤΟ `autoFocus` ΔΕΝ ΠΑΤΙΕΤΑΙ ΠΙΑ. Ο React το εφαρμόζει στη φάση commit, που
  // τρέχει ΠΡΙΝ από αυτό το effect — οπότε το `panelRef.focus()` έπαιρνε πίσω
  // την εστίαση και το πεδίο έμενε άδειο. Στο «Νέα εργασία σε επιλεγμένα» και
  // στο «Νέα εκκρεμότητα» ο δρομέας δεν ήταν πουθενά: ο χρήστης άνοιγε παράθυρο
  // για να γράψει και έπρεπε πρώτα να κλικάρει. Αν κάτι ΜΕΣΑ στο πλαίσιο έχει
  // ήδη την εστίαση, δεν του την παίρνουμε.
  useEffect(() => {
    if (!open) return;
    watchPointer();
    const openedByPointer = lastInputPointer;
    returnTo.current = (document.activeElement as HTMLElement | null) ?? null;
    const panel = panelRef.current;
    const inside = panel && returnTo.current && panel.contains(returnTo.current);
    if (!inside) panel?.focus();
    const back = inside ? null : returnTo.current;
    return () => { if (back?.isConnected) restoreFocus(back, openedByPointer); };
  }, [open]);

  // ── ΤΟ ΦΟΝΤΟ ΔΕΝ ΚΥΛΑ ───────────────────────────────────────────────────
  // Με ανοιχτό παράθυρο, το σύρσιμο πάνω στο σκοτεινό φόντο κυλούσε τη σελίδα
  // από πίσω: ο χρήστης έκλεινε το παράθυρο και έβρισκε άλλο σημείο της λίστας
  // από αυτό που άφησε. Κλειδώνει η `.app-content`, που είναι ο πραγματικός
  // κύλινδρος της εφαρμογής (το `body` δεν κυλά — το κέλυφος έχει overflow
  // hidden) και το `document.body` για τις δημόσιες σελίδες που δεν το έχουν.
  useEffect(() => {
    if (!open) return;
    return lockScroll();
  }, [open]);

  return { panelRef, z: OVERLAY_BASE_Z + depth * 10, backdrop };
}

// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΚΛΕΙΣΙΜΟ, ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΜΕΤΡΗΘΗΚΕ (24/08/2026). Εννέα κουμπιά «Κλείσιμο», σε ΕΞΙ γεωμετρίες και
// ΤΕΣΣΕΡΑ διαφορετικά σύμβολα:
//
//     ×  (U+00D7)   το πλαϊνό φύλλο, το παράθυρο, η ειδοποίηση
//     ✕  (U+2715)   η αναβάθμιση, το μηνιαίο μήνυμα
//     IconX         τα έγγραφα, γραμμένο τοπικά μέσα στο ίδιο αρχείο
//     X             το ημερολόγιο
//
// Και τα μεγέθη: 26 × 26, 40 × 44, T.h.sm, T.h.md, γεμίσματα των 11. Δηλαδή το
// ίδιο κουμπί, στην ίδια θέση, με άλλη επιφάνεια σε κάθε οθόνη· δύο από αυτά
// κάτω από τον κανόνα των 44 στο δάχτυλο, μετρημένα στον πάγκο κινητού.
//
// ΓΙΑΤΙ ΕΧΕΙ ΣΗΜΑΣΙΑ ΠΕΡΑ ΑΠΟ ΤΗΝ ΑΙΣΘΗΤΙΚΗ. Το κλείσιμο είναι το κουμπί που
// πατά ο χρήστης όταν έχει ήδη αποφασίσει να φύγει. Αν αστοχήσει, δεν φεύγει:
// πατά ό,τι υπάρχει από πίσω, δηλαδή κάνει κάτι που δεν ζήτησε.
//
// Το ύψος βγαίνει από το T.h.md, που στην αφή ανεβαίνει μόνο του στα 44.
// ═══════════════════════════════════════════════════════════════════════════
export function CloseButton({ onClose, tone = 'default', style, label = 'Κλείσιμο' }: {
  onClose: () => void;
  /** «onMedia» για πάνω σε φωτογραφία, όπου το τριτεύον γκρι χάνεται. */
  tone?: 'default' | 'onMedia';
  style?: CSSProperties;
  label?: string;
}) {
  // ΤΟ ΚΛΕΙΣΙΜΟ ΔΕΝ ΕΧΕΙ ΔΙΚΗ ΤΟΥ ΓΕΩΜΕΤΡΙΑ ΠΙΑ. Το κουτί, ο στόχος αφής, η
  // ακτίνα και η αιώρηση είναι ΤΟΥ ΕΙΚΟΝΙΔΙΟΥ — δηλαδή του `IconBtn` — και το
  // μόνο που μένει εδώ είναι ΠΟΙΟ εικονίδιο, με ποιο όνομα. Οι δύο χειριστές
  // `onMouseEnter/onMouseLeave` που έγραφαν `style.color` έφυγαν μαζί: η
  // `.po-ico` ξέρει επιπλέον τι είναι `:focus-visible` και τι είναι αφή, που
  // αυτοί δεν ήξεραν. Η μία ορατή διαφορά είναι ότι στην αιώρηση ανάβει τώρα
  // και φόντο, όπως σε κάθε άλλο κουμπί εικονιδίου της εφαρμογής.
  return (
    <IconBtn onClick={onClose} label={label} title={label} size="md" round
      tone={tone === 'onMedia' ? 'media' : undefined} style={style}>
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={2} strokeLinecap="round" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </IconBtn>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ΤΕΣΣΕΡΑ ΠΛΑΤΗ ΠΑΡΑΘΥΡΟΥ, ΟΧΙ ΔΕΚΑΟΚΤΩ
//
// ΜΕΤΡΗΜΕΝΟ: 340, 380, 400, 420, 440, 460, 480, 500, 520, 540, 560, 600, 620,
// 640, 680, 720, 760, 860. Δεκαοκτώ τιμές για τέσσερα πράγματα. Ο χρήστης το
// είδε ως εξής: άνοιξε «Νέα επαφή» και πήρε ένα παράθυρο, άνοιξε «Επεξεργασία
// αντικειμένου» στην ίδια οθόνη και πήρε άλλο, αισθητά πλατύτερο. Δύο
// παράθυρα της ίδιας εφαρμογής, στην ίδια συσκευή, με άλλο μέγεθος.
//
// Η κλίμακα λέει ΤΙ είναι το παράθυρο, όχι πόσα εικονοστοιχεία θέλει:
//
//   sm  440  μια ερώτηση, μια επιβεβαίωση, μια στήλη
//   md  620  μια φόρμα
//   lg  760  φόρμα με δύο στήλες ή πίνακας
//   xl  980  χώρος εργασίας με καρτέλες και πίνακες
//
// Το ίδιο μέτρο ισχύει και για το SideSheet: το ντοσιέ επαφής είναι μια στήλη
// άρα sm, του επισκέπτη έχει φόρμες άρα lg, του ενοικιαστή έχει καρτέλες και
// πίνακες άρα xl. Το πλάτος βγαίνει από το είδος του περιεχομένου.
//
// Οπως η κλίμακα τύπου και η κλίμακα αποστάσεων: το πλήθος των τιμών είναι
// απόφαση, όχι αποτέλεσμα του τι χρειάστηκε η κάθε οθόνη τη μέρα που γράφτηκε.
// ══════════════════════════════════════════════════════════════════════════
export const MODAL_WIDTH = { sm: 440, md: 620, lg: 760, xl: 980 } as const;
export type ModalSize = keyof typeof MODAL_WIDTH;
// ═══ Modal, ΜΙΑ επιφάνεια για κάθε παράθυρο ═══════════════════════════════
// Πριν, κάθε modal έφτιαχνε μόνο του overlay/πλαίσιο: 7 διαφορετικές
// διαφάνειες και 8 διαφορετικά radius, οπότε το app έμοιαζε με πολλά apps.
// Εδώ ορίζεται μία φορά: ίδιο scrim, ίδιο radius, ίδια κεφαλίδα (εικονίδιο +
// τίτλος + υπότιτλος + ×), ίδιο padding, ίδιο υποσέλιδο ενεργειών.
// Κλείνει με Escape ή με πάτημα που ΞΕΚΙΝΗΣΕ και ΤΕΛΕΙΩΣΕ στο φόντο (βλ.
// `useOverlayShell`). Οποιος έχει αλλαγές ρωτά πρώτα με `confirmDiscard`.
// Το περιεχόμενο κυλά, header/footer όχι.
//
// ── ΣΤΟ ΤΗΛΕΦΩΝΟ, ΦΥΛΛΟ ΑΠΟ ΚΑΤΩ (08/11/2026) ─────────────────────────────
// Κάτω από τα 560 (το όριο τηλεφώνου του globals.css) το ίδιο παράθυρο
// κάθεται στον πάτο, σε όλο το πλάτος, με γωνίες μόνο πάνω. Το κεντραρισμένο
// κουτί έχανε 16 από κάθε πλευρά σε οθόνη 360 και τα κουμπιά του κάθονταν
// στη μέση του ύψους, μακριά από τον αντίχειρα. Η γεωμετρία ζει στις κλάσεις
// `.po-modal*` του globals.css· εδώ μένουν τα tokens (πλάτος, ακτίνα) ως
// μεταβλητές, ώστε οι media queries να φτάνουν εκεί που το inline δεν φτάνει.
// Η συμπεριφορά (Escape, παγίδα Tab, κλείδωμα κύλισης) είναι ΑΚΡΙΒΩΣ η ίδια:
// ζει στο useOverlayShell και δεν αγγίχτηκε.
// ══════════════════════════════════════════════════════════════════════════

// ── ΤΟ ΠΛΗΚΤΡΟΛΟΓΙΟ ΤΗΣ ΟΘΟΝΗΣ ΔΕΝ ΣΚΕΠΑΖΕΙ ΤΟ ΦΥΛΛΟ ──────────────────────
// Σε iOS και σε Chrome Android το πληκτρολόγιο μικραίνει μόνο το ΟΡΑΤΟ
// παράθυρο· ένα φύλλο καρφωμένο στον πάτο της διάταξης μένει από κάτω του,
// μαζί με το πεδίο που γράφεις και τα κουμπιά. Εδώ μετριέται πόσο σκεπάζει
// (`--kb`) και πόσο ύψος φαίνεται (`--vvh`)· το CSS του τηλεφώνου ανεβάζει το
// φύλλο πάνω από το πληκτρολόγιο και το χωρά στο ορατό ύψος. Με μεγέθυνση
// (scale > 1) δεν μετράμε τίποτα: εκεί το ορατό μικραίνει από το τσίμπημα,
// όχι από πληκτρολόγιο. Σε γραφείο οι μεταβλητές μένουν αδιάβαστες.
function useKeyboardInset(open: boolean, ref: { current: HTMLElement | null }) {
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    const el = ref.current;
    if (!open || !vv || !el) return;
    const sync = () => {
      const zoomed = vv.scale > 1.01;
      const kb = zoomed ? 0 : Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      el.style.setProperty('--kb', `${kb}px`);
      if (zoomed) el.style.removeProperty('--vvh');
      else el.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
    };
    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => { vv.removeEventListener('resize', sync); vv.removeEventListener('scroll', sync); };
  }, [open, ref]);
}

export function Modal({ open, onClose, title, ariaLabel, subtitle, icon, size = 'md', children, footer, footerInfo, className }: {
  open: boolean; onClose: () => void;
  /** Προστίθεται στο πέπλο (`po-modal-scrim`): για όψη που αφορά ένα μόνο παράθυρο, π.χ. το φόντο του οδηγού. */
  className?: string;
  /** Δέχεται και JSX (π.χ. τίτλος με <InfoHint>). Για τεχνολογίες υποβοήθησης δώσε ariaLabel. */
  title: ReactNode; ariaLabel?: string; subtitle?: ReactNode; icon?: ReactNode;
  size?: ModalSize; children: ReactNode; footer?: ReactNode; footerInfo?: ReactNode;
}) {
  const { panelRef, z, backdrop } = useOverlayShell(open, onClose);
  const scrimRef = useRef<HTMLDivElement>(null);
  useKeyboardInset(open, scrimRef);
  // Ο ΤΙΤΛΟΣ ΟΝΟΜΑΖΕΙ ΤΟ ΠΑΡΑΘΥΡΟ, ΟΠΟΙΑ ΜΟΡΦΗ ΚΙ ΑΝ ΕΧΕΙ. Το όνομα έβγαινε
  // από `typeof title === 'string'`, οπότε κάθε τίτλος με JSX (π.χ. με
  // <InfoHint>) άφηνε το dialog ανώνυμο και ο τίτλος δεν ήταν καν επικεφαλίδα.
  const titleId = useId();
  const subId = useId();
  if (!open) return null;
  return (
    <div ref={scrimRef} className={className ? `po-modal-scrim ${className}` : 'po-modal-scrim'} {...backdrop} role="dialog" aria-modal="true" aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : titleId} aria-describedby={subtitle ? subId : undefined}
      style={{ position: 'fixed', inset: 0, background: T.scrim, zIndex: z, overscrollBehavior: 'contain' }}>
      <div ref={panelRef} tabIndex={-1} onClick={e => e.stopPropagation()} className="po-modal"
        style={{ '--modal-w': `${MODAL_WIDTH[size]}px`, '--modal-r': `${T.radius.modal}px`, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--elev-3)', outline: 'none', overscrollBehavior: 'contain' } as CSSProperties}>
        {/* Λαβή: μόνο σήμα «φύλλο», στο τηλέφωνο. Δεν σέρνεται· κλείνεις με ×, φόντο ή Escape. */}
        <span className="po-modal-grip" aria-hidden="true" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          {icon && (
            <div style={{ width: T.h.lg, height: T.h.lg, borderRadius: 10, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id={titleId} style={{ ...TT.h2, margin: 0 }}>{title}</h2>
            {subtitle && <div id={subId} className="po-subline" style={{ ...TT.bodySm }}>{subtitle}</div>}
          </div>
          <CloseButton onClose={onClose} style={{ margin: -6 }} />
        </div>

        <div className="po-modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: T.sp.xl }}>
          {children}
        </div>

        {(footer || footerInfo) && (
          <div className="po-modal-foot" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: T.sp.md, borderTop: '1px solid var(--border-subtle)', flexShrink: 0, flexWrap: 'wrap' }}>
            {footerInfo && <span style={{ ...TT.bodySm, flex: '1 1 240px' }}>{footerInfo}</span>}
            {/* ΤΑ ΚΟΥΜΠΙΑ ΤΟΥ ΥΠΟΣΕΛΙΔΟΥ ΜΟΙΡΑΖΟΝΤΑΙ ΤΗ ΓΡΑΜΜΗ ΣΕ ΤΗΛΕΦΩΝΟ. Το
                «Ακύρωση» και το «Καταχώρηση» είχαν το πλάτος του λεκτικού τους
                και κάθονταν δεξιά: δύο κουμπιά άνισα, με το αριστερό να αρχίζει
                στη μέση του πουθενά. Ο κανόνας ζει στην `.act-row`.

                ΚΑΙ ΜΕΝΟΥΝ ΔΕΞΙΑ ΟΤΑΝ ΤΥΛΙΓΟΥΝ. Με μακρύ `footerInfo` η σειρά των
                κουμπιών έπεφτε μόνη της στη δεύτερη γραμμή και το
                `space-between` την άφηνε αριστερά, με τη μισή γραμμή άδεια. Το
                `margin-left: auto` την κρατά στη δεξιά άκρη σε κάθε περίπτωση. */}
            <div className="act-row" style={{ display: 'flex', gap: T.sp.sm, marginLeft: 'auto' }}>{footer}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ pressable — ΤΟ ΠΛΗΚΤΡΟΛΟΓΙΟ ΓΙΑ ΟΣΑ ΔΕΝ ΕΙΝΑΙ ΚΟΥΜΠΙΑ ════════════════
//
// ΤΟ ΣΦΑΛΜΑ, ΜΕΤΡΗΜΕΝΟ: τριάντα έξι στοιχεία της εφαρμογής έχουν `onClick`
// πάνω σε `<div>`. Ένα `div` δεν εστιάζεται με Tab, δεν ενεργοποιείται με Enter
// ή κενό και ο αναγνώστης οθόνης το ανακοινώνει ως κείμενο — δηλαδή δεν
// υπάρχει. Πρακτικά: κάρτα ακινήτου, γραμμή απογραφής, επιλογή ασφαλιστηρίου,
// ημέρα ημερολογίου — όλα αδύνατα χωρίς ποντίκι.
//
// ΤΟ ΠΡΟΣΩΠΟ ΠΟΥ ΤΟ ΠΛΗΡΩΝΕΙ ΕΙΝΑΙ ΓΡΑΜΜΕΝΟ ΣΤΗ ΣΤΡΑΤΗΓΙΚΗ: ο πενηντάρης που
// τον αγχώνει ο λογιστής. Ο ίδιος άνθρωπος, δέκα χρόνια μετά ή με τρέμουλο,
// δεν σημαδεύει με ποντίκι. Και η οδηγία προσβασιμότητας για ψηφιακές υπηρεσίες
// προς καταναλωτές δεν είναι πια σύσταση.
//
// ΓΙΑΤΙ ΒΟΗΘΟΣ ΚΑΙ ΟΧΙ COMPONENT. Ένα `<Pressable>` που τυλίγει, θα ήταν
// `<button>` — και `<button>` ΔΕΝ επιτρέπεται να περιέχει άλλο `<button>`. Οι
// μισές από αυτές τις γραμμές έχουν μέσα τους κουμπιά «Επεξεργασία» και
// «Διαγραφή»: το τύλιγμα θα παρήγαγε άκυρο HTML και θα έσπαγε την πλοήγηση με
// Tab. Ο βοηθός δίνει τις ίδιες ιδιότητες χωρίς να αγγίξει ούτε τη διάταξη ούτε
// τη δομή — μηδενικό οπτικό ρίσκο, μία πηγή αλήθειας.
//
//     <div {...pressable(() => onEdit(item), `Επεξεργασία ${item.name}`)} style={…}>
//
// ΜΙΑ ΕΞΑΙΡΕΣΗ, ΜΕΤΡΗΜΕΝΗ, ΣΕ ΤΡΙΑ ΣΗΜΕΙΑ. Το JSX spread κρύβει τις ιδιότητες
// από τη στατική ανάλυση: ο μεταγλωττιστής του React παύει να βλέπει τι δέχεται
// το στοιχείο και αρχίζει να αναφέρει τις μεταλλάξεις `currentTarget.style`
// των ΔΙΠΛΑΝΩΝ χειριστών (hover γραμμένο επιτακτικά αντί για CSS). Εκεί οι
// ιδιότητες γράφονται ρητά — δύο λέξεις παραπάνω είναι φθηνότερες από μια
// καστάνια που ανεβαίνει και ο αναγνώστης του JSX βλέπει αμέσως ότι το div
// είναι κουμπί.
//
// ΤΟ ΚΕΝΟ ΘΕΛΕΙ preventDefault, ΑΛΛΙΩΣ Η ΣΕΛΙΔΑ ΚΥΛΑΕΙ. Είναι η προεπιλεγμένη
// ενέργεια του πλήκτρου και χωρίς αυτό ο χρήστης πατά «κενό» για να ανοίξει μια
// γραμμή και η οθόνη πηδά μια σελίδα κάτω.
export function pressable<E extends { key: string; preventDefault: () => void }>(
  onActivate: () => void,
  label?: string,
  /**
   * ΓΙΑ ΟΣΑ ΑΝΟΙΓΟΥΝ ΚΑΙ ΚΛΕΙΝΟΥΝ. Χωρίς αυτό, ο αναγνώστης οθόνης ακούει
   * «κουμπί» και τίποτα άλλο: δεν μαθαίνει ούτε ότι υπάρχει κρυμμένο
   * περιεχόμενο ούτε αν είναι ήδη ανοιχτό. Ο χρήστης που βλέπει το βελάκι το
   * ξέρει· ο χρήστης που ακούει, όχι.
   *
   * Μένει `undefined` όταν δεν δίνεται, οπότε καμία υπάρχουσα χρήση δεν
   * αποκτά ιδιότητα που δεν της ταιριάζει.
   */
  expanded?: boolean,
): {
  role: 'button'; tabIndex: 0; 'aria-label': string | undefined;
  'aria-expanded': boolean | undefined;
  onClick: () => void; onKeyDown: (e: E) => void;
} {
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    'aria-expanded': expanded,
    onClick: onActivate,
    onKeyDown: (e: E) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      onActivate();
    },
  };
}

// ═══ Btn, κουμπιά σε 3 ρόλους ═════════════════════════════════════════════
export function Btn({ children, onClick, variant = 'secondary', disabled, type, href, newTab, field, size, title, className, ref, expanded, haspopup, controls, describedBy, dimmed }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost'; disabled?: boolean; type?: 'button' | 'submit';
  /**
   * ΤΡΕΙΣ ΙΚΑΝΟΤΗΤΕΣ ΠΟΥ ΕΛΕΙΠΑΝ ΚΑΙ ΚΡΑΤΟΥΣΑΝ 26 ΚΟΥΜΠΙΑ ΧΕΙΡΟΠΟΙΗΤΑ
   * ─────────────────────────────────────────────────────────────────────
   * Η σημείωση της καστάνιας `hand-buttons` τις ονόμασε μία προς μία, αφού
   * δοκιμάστηκε μετανάστευση σε 93 κουμπιά και ΜΕΤΑΝΑΣΤΕΥΣΑΝ ΜΗΔΕΝ: δεκατέσσερα
   * μπλοκάρονταν από `className`, εφτά από `ref`, πέντε από `aria-expanded`.
   * Και οι τρεις είναι ΔΙΑΒΙΒΑΣΗ, όχι όψη: το κουμπί βγαίνει εικονοστοιχείο
   * προς εικονοστοιχείο ίδιο με πριν — γι' αυτό είναι η φθηνότερη κίνηση και
   * γι' αυτό γίνεται πρώτη.
   *
   * ΤΟ `className` ΠΡΟΣΤΙΘΕΤΑΙ, ΔΕΝ ΑΝΤΙΚΑΘΙΣΤΑ. Η `po-btn` κουβαλά ολόκληρη
   * την όψη· αν ένα σημείο μπορούσε να τη σβήσει, θα ξαναγεννιόταν ακριβώς το
   * πρόβλημα που λύθηκε. Οι κλάσεις που έρχονται από έξω (`po-hov-fill`,
   * `acc-toggle`, `po-box`) είναι ΣΥΜΒΟΛΑΙΑ ΣΥΜΠΕΡΙΦΟΡΑΣ — αιώρηση, σχήμα
   * σειράς — και κάθονται ΔΙΠΛΑ στην όψη, όχι πάνω της.
   */
  className?: string;
  /** Για popover που μετριέται με `getBoundingClientRect` ώστε να σταθεί το portal. */
  ref?: Ref<HTMLButtonElement>;
  /**
   * ΔΕΝ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΜΕ ΤΟ `aria-pressed` ΤΟΥ ChipToggle. Το «πατημένο» λέει
   * κατάσταση επιλογής· το «ανοιγμένο» λέει ότι κάτι ΑΛΛΟ φάνηκε εξαιτίας του.
   * Ο αναγνώστης οθόνης τα ανακοινώνει διαφορετικά και ο χρήστης περιμένει
   * διαφορετικά. Γι' αυτό το ChipToggle ΔΕΝ αντικαθιστά αυτά τα κουμπιά.
   */
  expanded?: boolean;
  haspopup?: boolean | 'menu' | 'listbox' | 'dialog';
  controls?: string;
  /** Συμπλήρωμα του λεκτικού, όχι αντικατάστασή του: «Εξαγωγή Excel» με τίτλο
   *  «Εξαγωγή σε Excel (.xlsx)». Οταν δεν προσθέτει πληροφορία, μένει κενό. */
  title?: string;
  /**
   * ΟΤΑΝ Η ΕΝΕΡΓΕΙΑ ΕΙΝΑΙ ΠΡΟΟΡΙΣΜΟΣ, ΤΟ ΣΤΟΙΧΕΙΟ ΕΙΝΑΙ ΣΥΝΔΕΣΜΟΣ.
   *
   * Ενα `<button onClick={() => router.push(…)}>` δείχνει ίδιο και δεν είναι:
   * δεν ανοίγει σε νέα καρτέλα με μεσαίο κλικ, δεν αντιγράφεται με δεξί κλικ,
   * δεν το βλέπει η μηχανή αναζήτησης και ο αναγνώστης οθόνης το ανακοινώνει
   * ως κουμπί ενώ αλλάζει σελίδα. Η όψη μένει ΑΚΡΙΒΩΣ ίδια, γιατί ζει στην
   * κλάση, όχι στο στοιχείο.
   */
  href?: string;
  /** Ανοίγει σε νέα καρτέλα, με το `rel` που απαιτεί η ασφάλεια. */
  newTab?: boolean;
  /**
   * ΤΟ ΚΟΥΜΠΙ ΠΟΥ ΖΕΙ ΜΕΣΑ ΣΕ ΠΛΕΓΜΑ ΦΟΡΜΑΣ, ΩΣ ΠΕΔΙΟ.
   *
   * Οταν η αποθήκευση κάθεται στο κενό κελί μιας σειράς πεδίων, το κανονικό
   * κουμπί δεν ζυγίζει: είναι 36 ψηλό δίπλα σε πεδία των 40 και όσο πλατύ το
   * λεκτικό του, δηλαδή μισό κελί. Με `field` παίρνει ΑΚΡΙΒΩΣ το ύψος και το
   * πλάτος του διπλανού πεδίου, οπότε η σειρά διαβάζεται ως τέσσερα ίσα κουτιά.
   */
  field?: boolean;
  /**
   * ΤΟ ΥΨΟΣ ΤΟΥ ΚΟΥΜΠΙΟΥ ΟΤΑΝ ΚΑΘΕΤΑΙ ΣΕ ΣΕΙΡΑ ΜΕ ΑΛΛΑ ΧΕΙΡΙΣΤΗΡΙΑ.
   *
   * ΤΙ ΜΕΤΡΗΘΗΚΕ. Η κλίμακα του έργου ορίζει 36 για τα κουμπιά και 40 για τα
   * πεδία φόρμας, οπότε κάθε γραμμή εργαλείων που έχει και τα δύο είναι εξ
   * ορισμού αστοίχιστη. Σε έξι οθόνες:
   *
   *   Δαπάνες        ομάδα καρτελών 44  δίπλα σε κουμπί 36
   *   Απογραφή       τρεις επιλογείς 40  δίπλα σε κουμπί 36
   *   Ημερολόγιο     επιλογέας 38  δίπλα σε πεδίο αναζήτησης 36
   *   Αρχείο         πεδίο 36  δίπλα σε επιλογέα 38
   *   Ταυτότητα      κουμπί 36  δίπλα σε πεδίο 40
   *   Εκκρεμότητες   38 · 35 · 35 · 34 στην ίδια γραμμή
   *
   * Το `field` το έλυνε ήδη, αλλά επιβάλλει και πλάτος 100% γιατί φτιάχτηκε για
   * κελί πλέγματος. Σε γραμμή εργαλείων το κουμπί θέλει το ύψος χωρίς το πλάτος.
   */
  size?: 'md' | 'lg';
  /**
   * ΤΟ ΚΟΥΜΠΙ ΠΟΥ ΔΕΙΧΝΕΙ ΣΒΗΣΜΕΝΟ ΑΛΛΑ ΜΕΝΕΙ ΠΑΤΗΣΙΜΟ ΚΑΙ ΛΕΕΙ ΓΙΑΤΙ.
   *
   * Η υποβολή της εγγραφής δεν γίνεται `disabled`: θα έβγαινε από τη σειρά Tab
   * και ο χρήστης πληκτρολογίου δεν θα τη συναντούσε ποτέ. Μένει κανονική, με
   * σβηστή όψη (`dimmed`) και τον λόγο σε λέξεις (`describedBy`). Ηταν ο λόγος
   * που το κουμπί της ζωγραφιζόταν στο χέρι, με άλλο σχήμα από τα αδέλφια του.
   */
  describedBy?: string;
  dimmed?: boolean;
}) {
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    // Το padding έδινε ύψος ~38: κάτω από το ελάχιστο μέγεθος αφής, σε 148
    // σημεία. Το `minHeight` από την κοινή κλίμακα το ανεβάζει στα 44 όταν ο
    // δείκτης είναι δάχτυλο, χωρίς να αλλάξει τίποτα στο ποντίκι.
    //
    // ── Η ΔΗΜΟΣΙΑ ΠΛΕΥΡΑ ΔΗΛΩΝΕΙ ΤΗ ΔΙΚΗ ΤΗΣ ΚΛΙΜΑΚΑ, ΜΙΑ ΦΟΡΑ ────────────────
    // Στη βιτρίνα μετρήθηκαν πέντε σχήματα κουμπιού (01.10.2026): χάπι 44 με
    // 15px στην κεφαλίδα, γωνία 10 και 40 με 13px στην εγγραφή, 36 στον πίνακα
    // των πακέτων, 37 στη σελίδα 404, 36 δίπλα σε πεδίο 40 στην επαλήθευση. Οι
    // τέσσερις μεταβλητές `--btn-*` ορίζονται ΜΟΝΟ στα περιτυλίγματα της
    // δημόσιας πλευράς (globals.css) και δίνουν σε κάθε `Btn` εκεί το σχήμα της
    // αρχικής. Μέσα στην εφαρμογή δεν ορίζονται και ισχύουν οι εφεδρικές, δηλαδή
    // ακριβώς ό,τι ίσχυε ως τώρα.
    minHeight: `var(--btn-h, ${(field || size === 'lg') ? T.h.lg : T.h.md})`,
    ...(field ? { display: 'flex', width: '100%' } : null),
    padding: 'var(--btn-pad, 9px 18px)', borderRadius: `var(--btn-radius, ${T.radius.btn}px)`,
    fontSize: 'var(--btn-fs, 12px)', fontWeight: 700, fontFamily: T.font.sans,
    cursor: (disabled || dimmed) ? 'not-allowed' : 'pointer', opacity: (disabled || dimmed) ? 0.5 : 1,
    transition: 'background-color 0.15s cubic-bezier(0.2,0,0,1), border-color 0.15s cubic-bezier(0.2,0,0,1), color 0.15s cubic-bezier(0.2,0,0,1), box-shadow 0.15s cubic-bezier(0.2,0,0,1), transform 0.15s cubic-bezier(0.2,0,0,1), opacity 0.15s cubic-bezier(0.2,0,0,1)',
    // ΠΑΧΟΣ ΚΑΙ ΕΙΔΟΣ ΕΙΝΑΙ ΓΕΩΜΕΤΡΙΑ: κρατούν το ύψος ίδιο και στις τρεις
    // παραλλαγές, ώστε το περίγραμμα του δευτερεύοντος να μη μετακινεί τα
    // διπλανά του. Το ΧΡΩΜΑ όμως είναι όψη και ζει στο CSS — το `border`
    // ολόκληρο εδώ έγραφε `transparent` ενσωματωμένα και νικούσε την κλάση:
    // μετρήθηκε ότι το δευτερεύον κουμπί ΔΕΝ είχε καθόλου ορατό περίγραμμα.
    borderWidth: 1, borderStyle: 'solid',
  };
  // ── ΤΟ ΧΡΩΜΑ ΕΦΥΓΕ ΑΠΟ ΕΔΩ ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΟΛΟ ΤΟ ΝΟΗΜΑ ────────────────
  //
  // Οι τρεις παραλλαγές ζωγράφιζαν τον εαυτό τους σε `style`, δηλαδή ΜΕΣΑ στο
  // στοιχείο. Το ενσωματωμένο style κερδίζει κάθε κανόνα κλάσης: όσο το χρώμα
  // γραφόταν εδώ, κανένα `:hover` δεν μπορούσε ΠΟΤΕ να ισχύσει. Μετρήθηκε στον
  // περιηγητή — και οι τρεις παραλλαγές έδιναν ακριβώς το ίδιο χρώμα πριν και
  // μετά την αιώρηση.
  //
  // Εδώ μένει η ΓΕΩΜΕΤΡΙΑ (διάταξη, περιθώρια, ακτίνα, γραμματοσειρά). Η ΟΨΗ —
  // φόντο, χρώμα κειμένου, περίγραμμα και οι τρεις καταστάσεις τους — ζει στο
  // `.po-btn[data-variant]` του globals.css, όπου το CSS ξέρει τι είναι
  // αιώρηση, τι είναι πάτημα, τι είναι εστίαση με πληκτρολόγιο και τι είναι
  // οθόνη αφής.
  //
  // Η ΤΡΙΤΕΥΟΥΣΑ ΕΝΕΡΓΕΙΑ ΔΕΝ ΕΙΝΑΙ ΜΠΛΕ. Το `--info` είναι διαφορετικό και πιο
  // βαθύ μπλε από το `--accent` της κύριας: το «Ακύρωση» τραβούσε το μάτι
  // περισσότερο από το «Αποθήκευση» δίπλα του. Ενα μπλε και μόνο στην κύρια.
  // ── ΤΟ ΚΥΡΙΟ ΚΟΥΜΠΙ ΤΗΣ ΕΦΑΡΜΟΓΗΣ ΔΕΝ ΕΙΧΕ ΑΙΩΡΗΣΗ ──────────────────────
  //
  // Το `transition` από πάνω απαριθμούσε έξι ιδιότητες — background, border,
  // color, shadow, transform, opacity — και ΚΑΜΙΑ τους δεν άλλαζε ποτέ: δεν
  // υπήρχε ούτε `:hover`, ούτε `:active`, ούτε κατάσταση εστίασης. Νεκρή
  // δήλωση σε πεντακόσια σημεία και ένα κουμπί που δεν απαντά στο ποντίκι.
  //
  // Η ΑΠΑΝΤΗΣΗ ΕΙΝΑΙ CSS, ΟΧΙ JAVASCRIPT. Η εφαρμογή έχει ήδη 310 χειροκίνητους
  // χειριστές `onMouseEnter/onMouseLeave` που γράφουν `style.background` —
  // δηλαδή αιώρηση που δεν ξέρει τι είναι `:focus-visible`, δεν ξέρει τι είναι
  // αφή και ξαναγράφεται σε κάθε στοιχείο από την αρχή. Εδώ μπαίνει ΜΙΑ κλάση
  // (`po-btn` στο globals.css) και ο ρόλος δηλώνεται με `data-variant`.
  //
  // ΚΑΙ ΤΟ `disabled` ΓΙΝΕΤΑΙ ΑΛΗΘΙΝΟ. Το component δεχόταν `disabled` και
  // απλώς δεν περνούσε το `onClick`: το κουμπί έμενε εστιάσιμο, ανακοινωνόταν
  // ως ενεργό από τους αναγνώστες οθόνης και το `:disabled` του CSS δεν
  // ταίριαζε ποτέ. Τώρα δηλώνεται στο ίδιο το στοιχείο.
  const cls = className ? `po-btn ${className}` : 'po-btn';
  if (href) {
    return (
      <a
        href={href}
        className={cls}
        data-variant={variant}
        title={title}
        target={newTab ? '_blank' : undefined}
        rel={newTab ? 'noopener noreferrer' : undefined}
        // Ο σύνδεσμος πλοηγεί μόνος του· το `onClick` εδώ μόνο παρατηρεί (π.χ. μέτρηση).
        onClick={onClick}
        style={{ ...base, textDecoration: 'none' }}
      >{children}</a>
    );
  }
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cls}
      data-variant={variant}
      title={title}
      disabled={disabled}
      aria-expanded={expanded}
      aria-haspopup={haspopup}
      aria-controls={controls}
      aria-describedby={describedBy}
      onClick={disabled ? undefined : onClick}
      style={base}
    >{children}</button>
  );
}

// ═══ IconBtn · ΤΟ ΚΟΥΜΠΙ ΠΟΥ ΕΙΝΑΙ ΜΟΝΟ ΕΙΚΟΝΙΔΙΟ ══════════════════════════
//
// ΓΙΑΤΙ ΔΕΝ ΗΤΑΝ ΠΟΤΕ `Btn`. Το `Btn` γράφει `padding: 9px 18px` και λεκτικό
// 12/700: ένα «×» των 13 εικονοστοιχείων μέσα του βγαίνει κουτί 49 φαρδύ για
// γλυφή 13. Εξήντα εννέα σημεία το ζωγράφιζαν μόνα τους, με άλλο μέγεθος και
// άλλο αρνητικό περιθώριο το καθένα.
//
// ΤΟ ΚΟΥΤΙ ΕΙΝΑΙ Ο ΣΤΟΧΟΣ ΑΦΗΣ, ΟΧΙ Η ΓΛΥΦΗ. Το εικονίδιο μένει 12 ή 14· το
// κουτί γύρω του ανεβαίνει στα 44 όταν ο δείκτης είναι δάχτυλο, με το ίδιο
// `T.h` που χρησιμοποιεί κάθε άλλο χειριστήριο. Χωρίς αυτό, μια «×» των 20 δεν
// πατιέται σε κανένα κινητό — και ήταν έτσι σε δεκάδες σημεία.
//
// Η ΟΨΗ ΖΕΙ ΣΤΟ `.po-ico` του globals.css, όπως και του `Btn`: εκεί το CSS ξέρει
// τι είναι αιώρηση, τι είναι εστίαση με πληκτρολόγιο και τι είναι οθόνη αφής.
export function IconBtn({ children, onClick, label, tone, size = 'sm', round, disabled, type, title, style, className, ref, expanded, haspopup, controls }: {
  children: ReactNode;
  onClick?: () => void;
  /** Το όνομα για τον αναγνώστη οθόνης. ΥΠΟΧΡΕΩΤΙΚΟ: χωρίς λεκτικό, είναι το μόνο που ακούγεται. */
  label: string;
  /** «media» για πάνω σε φωτογραφία, όπου το τριτεύον γκρι εξαφανίζεται. */
  tone?: 'danger' | 'accent' | 'media';
  size?: 'sm' | 'md';
  /** Κύκλος αντί για τετράγωνο — για δείκτες και μετρητές, όχι για ενέργειες. */
  round?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  title?: string;
  /**
   * ΜΟΝΟ ΘΕΣΗ, ΟΧΙ ΟΨΗ. Το κουμπί κλεισίματος καρφώνεται πότε στη γωνία ενός
   * παραθύρου και πότε τραβιέται με αρνητικό περιθώριο για να μη σπρώξει την
   * κεφαλίδα. Χρώμα, φόντο και περίγραμμα μένουν στην `.po-ico`.
   */
  style?: CSSProperties;
  /** Προστίθεται στην `po-ico`, δεν την αντικαθιστά: συμβόλαιο συμπεριφοράς δίπλα στην όψη. */
  className?: string;
  /** Για popover που μετριέται ώστε να σταθεί το portal. */
  ref?: Ref<HTMLButtonElement>;
  /** «Ανοιγμένο», που δεν είναι το ίδιο με «πατημένο»: άλλη πληροφορία, άλλη ανακοίνωση. */
  expanded?: boolean;
  haspopup?: boolean | 'menu' | 'listbox' | 'dialog';
  controls?: string;
}) {
  const box = size === 'md' ? T.h.md : T.h.sm;
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={className ? `po-ico ${className}` : 'po-ico'}
      data-tone={tone}
      aria-label={label}
      title={title}
      disabled={disabled}
      aria-expanded={expanded}
      aria-haspopup={haspopup}
      aria-controls={controls}
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: box, height: box, minWidth: box, minHeight: box,
        borderRadius: round ? '50%' : T.radius.chip,
        cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0, padding: 0,
        ...style,
      }}
    >{children}</button>
  );
}

// ═══ ChipToggle · ΤΟ ΠΛΑΚΙΔΙΟ ΠΟΥ ΘΥΜΑΤΑΙ ΤΙ ΔΙΑΛΕΞΕΣ ═════════════════════
//
// ΔΕΝ ΕΙΝΑΙ ΕΝΕΡΓΕΙΑ, ΕΙΝΑΙ ΚΑΤΑΣΤΑΣΗ. Το `Btn` έχει ΡΟΛΟ (κύριο, δευτερεύον,
// ήσυχο)· αυτό εδώ έχει ΚΑΤΑΣΤΑΣΗ (επιλεγμένο ή όχι) και τη λέει με
// `aria-pressed`, ώστε ο αναγνώστης οθόνης να ανακοινώσει «πατημένο». Εβδομήντα
// τρία σημεία το έγραφαν μόνα τους — φίλτρα, ετικέτες, τμηματικοί επιλογείς —
// και τα μισά ΔΕΝ δήλωναν καθόλου την κατάσταση στην προσιτότητα: φαινόταν
// μόνο με χρώμα.
//
// ΤΟ `seg` ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΠΡΑΓΜΑ ΜΕΣΑ ΣΕ ΡΑΓΑ. Οταν τα πλακίδια κάθονται σε
// κουτί που έχει ήδη περίγραμμα — ένα δεύτερο περίγραμμα ανά πλακίδιο δίνει
// διπλή γραμμή· εκεί το ενεργό ξεχωρίζει με επιφάνεια και σκιά.
export function ChipToggle({ children, on, onClick, shape = 'chip', disabled, title, grow, size = 'sm', className }: {
  children: ReactNode;
  on: boolean;
  onClick?: () => void;
  shape?: 'chip' | 'seg';
  disabled?: boolean;
  title?: string;
  /** Μοιράζεται ίσα το πλάτος της σειράς — για τμηματικό επιλογέα δύο ή τριών επιλογών. */
  grow?: boolean;
  /**
   * ΤΟ ΥΨΟΣ ΟΤΑΝ ΤΟ ΠΛΑΚΙΔΙΟ ΚΑΘΕΤΑΙ ΣΕ ΣΕΙΡΑ ΜΕ ΠΕΔΙΟ.
   *
   * ΤΙ ΜΕΤΡΗΘΗΚΕ ΚΑΙ ΓΙΑΤΙ ΑΞΙΖΕΙ ΝΑ ΓΡΑΦΤΕΙ. Το `Btn` έχει ήδη αυτή την
   * επιλογή, με ολόκληρο κείμενο από πάνω του: «κάθε γραμμή εργαλείων που έχει
   * και τα δύο είναι εξ ορισμού αστοίχιστη». Το πλακίδιο δεν την πήρε ποτέ,
   * γιατί όσο τα φίλτρα γράφονταν στο χέρι ο καθένας έβαζε το ύψος που
   * χρειαζόταν — 40 δίπλα σε πεδίο, 32 όταν ήταν μόνο του.
   *
   * Με τη μετανάστευση όλα προσγειώθηκαν στο ένα πρωτογενές, που έγραφε ΜΟΝΟ
   * `T.h.sm`: ο σαρωτής στοίχισης βρήκε αμέσως «Όλοι» στα 32 δίπλα σε
   * αναζήτηση στα 40, στις καρτέλες Ενοικιαστές και Απογραφή, στα 768 και στα
   * 1280. Δηλαδή έλειπε το ΙΔΙΟ πράγμα που έλειπε από το `Btn` πριν από αυτό.
   */
  size?: 'sm' | 'lg';
  /** Προστίθεται στην `po-chip`, δεν την αντικαθιστά. */
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className ? `po-chip ${className}` : 'po-chip'}
      data-shape={shape}
      aria-pressed={on}
      title={title}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        minHeight: size === 'lg' ? T.h.lg : T.h.sm, padding: '0 12px', borderRadius: T.radius.chip,
        // ΤΟ ΒΑΡΟΣ ΔΕΝ ΑΛΛΑΖΕΙ ΜΕ ΤΗΝ ΕΠΙΛΟΓΗ (21/10/2026). Με 600 στο ενεργό και
        // 500 στα άλλα, κάθε πάτημα φάρδαινε το λεκτικό και έσπρωχνε τα διπλανά
        // πλακίδια: η οπτική σάρωση το βρήκε σε οκτώ καρτέλες, στα 390 και στα
        // 1280. Το ενεργό ξεχωρίζει ήδη με επιφάνεια, περίγραμμα και χρώμα.
        fontSize: 'var(--fs-xs)', fontWeight: 500, fontFamily: T.font.sans,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...(grow ? { flex: 1, minWidth: 0 } : null),
      }}
    >{children}</button>
  );
}

// ═══ LinkBtn · ΕΝΕΡΓΕΙΑ ΠΟΥ ΔΙΑΒΑΖΕΤΑΙ ΩΣ ΣΥΝΔΕΣΜΟΣ ═══════════════════════
//
// ΓΙΑΤΙ ΟΧΙ `<a>`. Δεν πάει πουθενά: ανοίγει πεδίο, επαναφέρει τιμή, αποκαλύπτει
// ενότητα. Ενα `<a href="#">` θα το ανακοίνωνε ως σύνδεσμο, θα άλλαζε το URL και
// θα άνοιγε σε νέα καρτέλα με μεσαίο κλικ — τρία ψέματα. Μένει `<button>` και
// δανείζεται μόνο την ΟΨΗ του συνδέσμου.
//
// ΚΑΙ ΓΙΑΤΙ ΥΠΟΓΡΑΜΜΙΣΜΕΝΟ. Εικοσι έξι σημεία το έγραφαν με σκέτο χρώμα accent
// μέσα σε πρόταση: για όποιον δεν διακρίνει το μπλε από το γκρι, δεν υπήρχε
// καμία ένδειξη ότι πατιέται.
export function LinkBtn({ children, onClick, tone, disabled, type, title, className, ref }: {
  children: ReactNode;
  onClick?: () => void;
  tone?: 'quiet' | 'danger';
  disabled?: boolean;
  type?: 'button' | 'submit';
  title?: string;
  /** Προστίθεται στην `po-link`, δεν την αντικαθιστά. */
  className?: string;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={className ? `po-link ${className}` : 'po-link'}
      data-tone={tone}
      title={title}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
    >{children}</button>
  );
}
