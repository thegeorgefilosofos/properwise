'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΥΠΑΓΟΡΕΥΣΗ: ΤΟ ΕΝΑ HOOK, ΓΙΑ ΤΗ ΝΟΑ ΚΑΙ ΓΙΑ ΚΑΘΕ ΠΕΔΙΟ
// ─────────────────────────────────────────────────────────────────────────
// Η Νόα είχε δική της υπαγόρευση γραμμένη μέσα στη συνομιλία. Τα πεδία
// κειμένου θα χρειάζονταν δεύτερη. Δύο υλοποιήσεις της ίδιας φωνής σημαίνουν
// δύο συμπεριφορές σιωπής, δύο σύνολα μηνυμάτων λάθους και ένα σφάλμα που
// διορθώνεται στη μία και μένει στην άλλη. Εδώ ζει η μία.
//
// Η ΜΗΧΑΝΗ ΚΑΤΕΒΑΙΝΕΙ ΜΟΝΟ ΟΤΑΝ ΧΡΕΙΑΣΤΕΙ. Το `lib/core/dictation` φορτώνεται
// με δυναμική εισαγωγή στο πρώτο πάτημα, ή λίγο νωρίτερα με το `preload`
// (όταν ο δείκτης ή η εστίαση φτάσει στο κουμπί). Η ενεργοποίηση από τον
// χρήστη διαρκεί αρκετά δευτερόλεπτα, οπότε η αναμονή δεν τη χαλάει.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { speechSupported } from '@/lib/core/speech';
import type { DictationError, DictationState, InsertionPoint, Session } from '@/lib/core/dictation';

type Engine = typeof import('@/lib/core/dictation');

let enginePromise: Promise<Engine> | null = null;
/** Η μηχανή, μία φορά ανά σελίδα. */
export const loadDictation = (): Promise<Engine> =>
  (enginePromise ??= import('@/lib/core/dictation'));

const NEVER = () => () => {};
/**
 * Υποστηρίζει ο περιηγητής υπαγόρευση; Ο διακομιστής λέει «όχι», ώστε το κουμπί
 * να μην αποδοθεί ποτέ πριν μάθουμε. Ένα κουμπί που εμφανίζεται και μετά
 * δεν δουλεύει είναι χειρότερο από το να λείπει.
 */
export function useDictationSupported(): boolean {
  return useSyncExternalStore(NEVER, speechSupported, () => false);
}

/** Η γλώσσα της σελίδας, όπως τη δηλώνει το `<html lang>`. */
const pageLang = (): string =>
  (typeof document !== 'undefined' && document.documentElement.lang) || 'el';

export interface DictationOptions {
  /** Ευγενικός πληθυντικός στα μηνύματα (η ρύθμιση της Νόας). */
  formal?: boolean;
  /** Συνεχής ακρόαση ως τη σιωπή (πεδία) ή στάση στην πρώτη παύση (Νόα). */
  continuous?: boolean;
  /** Ολο το κείμενο ως τώρα (με στίξη) και το τελικό του κομμάτι. */
  onText?: (text: string, final: string) => void;
  /** Τέλος: το τελικό κείμενο και το σφάλμα. */
  onEnd?: (final: string, error: DictationError | null) => void;
}

export interface StartOptions {
  /** Τρέχει με τη μηχανή φορτωμένη, ακριβώς πριν ανοίξει το μικρόφωνο. */
  prepare?: (engine: Engine) => void;
}

export interface Dictation {
  supported: boolean;
  status: DictationState['status'];
  error: DictationError | null;
  /** Το μήνυμα του σφάλματος, στη γλώσσα της σελίδας. Κενό όταν δεν υπάρχει. */
  message: string;
  listening: boolean;
  start: (opts?: StartOptions) => Promise<void>;
  stop: () => void;
  toggle: (opts?: StartOptions) => void;
  /** Σβήνει το μήνυμα σφάλματος (π.χ. όταν ο χρήστης αρχίσει να γράφει). */
  clear: () => void;
  preload: () => void;
}

export function useDictation(opts: DictationOptions = {}): Dictation {
  const supported = useDictationSupported();
  const [state, setState] = useState<DictationState>({ status: 'idle', error: null, heard: false });
  const [message, setMessage] = useState('');
  const sessionRef = useRef<Session | null>(null);
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; });

  const stop = useCallback(() => { sessionRef.current?.stop(); }, []);
  const clear = useCallback(() => {
    setMessage('');
    setState(s => (s.status === 'error' ? { status: 'idle', error: null, heard: false } : s));
  }, []);
  const preload = useCallback(() => { if (supported) void loadDictation(); }, [supported]);

  const start = useCallback(async (so?: StartOptions) => {
    if (sessionRef.current) return;
    const engine = await loadDictation();
    if (sessionRef.current) return;
    so?.prepare?.(engine);
    setMessage('');
    const lang = pageLang();
    // Κρατιέται ΠΡΙΝ από το `startSession`, γιατί εκείνη μπορεί να τελειώσει
    // σύγχρονα (π.χ. «δεν υποστηρίζεται») και να καλέσει το `onEnd` αμέσως.
    let mine: Session | null = null;
    let done = false;
    mine = engine.startSession({
      lang: engine.recognitionLang(lang),
      continuous: optsRef.current.continuous,
      onState: setState,
      onText: (text, final) => optsRef.current.onText?.(text, final),
      onEnd: (final, error) => {
        done = true;
        if (sessionRef.current === mine) sessionRef.current = null;
        setMessage(error ? engine.errorMessage(error, { lang, formal: optsRef.current.formal }) : '');
        optsRef.current.onEnd?.(final, error);
      },
    });
    if (!done) sessionRef.current = mine;
  }, []);

  const toggle = useCallback((so?: StartOptions) => {
    if (sessionRef.current) stop(); else void start(so);
  }, [start, stop]);

  // Η σελίδα που κλείνει δεν αφήνει το μικρόφωνο ανοιχτό.
  useEffect(() => () => { sessionRef.current?.abort(); sessionRef.current = null; }, []);

  return {
    supported,
    status: state.status,
    error: state.error,
    message,
    listening: state.status === 'listening' || state.status === 'starting',
    start, stop, toggle, clear, preload,
  };
}

export type { InsertionPoint, DictationError };
