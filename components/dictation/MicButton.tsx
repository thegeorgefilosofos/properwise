'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΜΙΚΡΟΦΩΝΟ ΜΕΣΑ ΣΤΟ ΠΕΔΙΟ
// ─────────────────────────────────────────────────────────────────────────
// Οπως στην αναζήτηση του Google: πατάς, μιλάς και το κείμενο γράφεται εκεί
// που ήταν ο δρομέας. Σταματά μόνο του στη σιωπή ή με δεύτερο πάτημα· αν
// αρχίσεις να πληκτρολογείς, σταματά για να μη γράφουν δύο χέρια μαζί.
//
// ΤΙ ΑΚΟΥΕΙ Ο ΑΝΑΓΝΩΣΤΗΣ ΟΘΟΝΗΣ. Το κουμπί λέγεται πάντα «Υπαγόρευση» και το
// `aria-pressed` λέει αν είναι ανοιχτό: το όνομα δεν αλλάζει κάτω από τα
// δάχτυλα του χρήστη. Η ζωντανή περιοχή ανακοινώνει «Ακούω» και «Σταμάτησε»,
// και το σφάλμα διαβάζεται ως ειδοποίηση με το επόμενο βήμα μέσα του.
//
// ΤΙ ΔΕΝ ΑΠΟΔΙΔΕΤΑΙ. Οπου ο περιηγητής δεν έχει αναγνώριση ομιλίας (Firefox),
// δεν υπάρχει κουμπί και το πεδίο δεν κρατά χώρο γι' αυτό.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { useDictation } from './useDictation';

type Engine = typeof import('@/lib/core/dictation');

type Field = HTMLInputElement | HTMLTextAreaElement;

const isEn = () => typeof document !== 'undefined' && /^en\b/i.test(document.documentElement.lang || '');

/** Οι λέξεις του κουμπιού, στη γλώσσα της σελίδας. */
const words = (en: boolean) => en
  ? { label: 'Dictation', on: 'Listening', off: 'Stopped' }
  : { label: 'Υπαγόρευση', on: 'Ακούω', off: 'Σταμάτησε' };

export function MicGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" />
    </svg>
  );
}

export interface MicField {
  /** Υπάρχει υπαγόρευση σε αυτόν τον περιηγητή. Χωρίς αυτήν, τίποτα δεν αποδίδεται. */
  supported: boolean;
  /** Το κουμπί, για μέσα στο πεδίο. `null` όπου δεν υποστηρίζεται. */
  button: ReactNode;
  /** Το μήνυμα σφάλματος, για κάτω από το πεδίο. */
  note: ReactNode;
}

/**
 * Συνδέει ένα ελεγχόμενο πεδίο με την υπαγόρευση.
 *
 * @param getField το στοιχείο του πεδίου, για τη θέση του δρομέα
 * @param enabled  ψευδές: το hook δεν αποδίδει τίποτα (για τα κοινά πεδία
 *                 όπου η υπαγόρευση είναι επιλογή του καλούντα)
 */
export function useMicField({ value, onChange, multiline = false, getField, enabled = true }: {
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  getField: () => Field | null;
  enabled?: boolean;
}): MicField {
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => { valueRef.current = value; onChangeRef.current = onChange; });
  const writerRef = useRef<ReturnType<Engine['fieldWriter']> | null>(null);
  const caretRef = useRef<number | null>(null);
  const [announce, setAnnounce] = useState('');

  const d = useDictation({
    continuous: true,
    onText: text => {
      // Ο συγγραφέας γράφει μόνο πάνω σε δική του τιμή (lib/core/dictation.ts,
      // `fieldWriter`): αν ο χρήστης πληκτρολόγησε, το αποτέλεσμα πετιέται.
      const r = writerRef.current?.apply(text, valueRef.current);
      if (!r) return;
      caretRef.current = r.caret;
      // Η νέα τιμή ισχύει αμέσως, πριν από την επόμενη απόδοση: δύο αποτελέσματα
      // που φτάνουν πριν προλάβει η React δεν πρέπει να μοιάζουν με πληκτρολόγηση.
      valueRef.current = r.value;
      onChangeRef.current(r.value);
    },
    onEnd: (_final, error) => {
      writerRef.current = null;
      setAnnounce(error ? '' : words(isEn()).off);
    },
  });

  // Ο δρομέας πηγαίνει στο τέλος του κειμένου που μόλις γράφτηκε, μετά την
  // απόδοση που έφερε τη νέα τιμή. Χωρίς εστίαση: στο κινητό η εστίαση θα
  // άνοιγε το πληκτρολόγιο πάνω από το πεδίο που μιλάς.
  useLayoutEffect(() => {
    const at = caretRef.current;
    if (at == null) return;
    caretRef.current = null;
    const el = getField();
    if (!el || el.value !== value) return;
    try { el.setSelectionRange(at, at); } catch { /* πεδίο χωρίς επιλογή */ }
    if (el instanceof HTMLTextAreaElement && el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight;
  }, [value, getField]);

  // Ο χρήστης πληκτρολογεί: η υπαγόρευση κλείνει ΧΩΡΙΣ να παραδώσει ό,τι
  // είχε ακούσει και το μήνυμα σβήνει. Οι δικές μας αλλαγές περνούν από τη
  // React και δεν βγάζουν συμβάν `input`. Με `abort` και όχι `stop`: το `stop`
  // παραδίδει ακόμη ένα αποτέλεσμα, που θα έσβηνε όσα μόλις γράφτηκαν.
  const { listening, abort, clear, message } = d;
  useEffect(() => {
    const el = getField();
    if (!el) return;
    const onInput = () => { if (listening) { writerRef.current = null; abort(); } if (message) clear(); };
    el.addEventListener('input', onInput);
    return () => el.removeEventListener('input', onInput);
  }, [getField, listening, abort, clear, message]);

  const wasListening = useRef(false);
  useEffect(() => {
    if (d.status === 'listening' && !wasListening.current) setAnnounce(words(isEn()).on);
    wasListening.current = d.status === 'listening';
  }, [d.status]);

  const press = useCallback(() => {
    if (d.listening) { d.stop(); return; }
    setAnnounce('');
    d.toggle({
      prepare: engine => {
        const el = getField();
        const v = valueRef.current;
        const start = el?.selectionStart ?? v.length;
        const end = el?.selectionEnd ?? start;
        // Πεδίο που δεν έχει εστιαστεί ποτέ αναφέρει δρομέα στην αρχή· το
        // φυσικό εκεί είναι να συνεχίσει το κείμενο, όχι να γράψει μπροστά του.
        const focused = typeof document !== 'undefined' && document.activeElement === el;
        const touched = focused || start !== 0 || end !== 0;
        writerRef.current = engine.fieldWriter({
          value: v,
          start: touched ? start : v.length,
          end: touched ? end : v.length,
          multiline,
        });
      },
    });
  }, [d, getField, multiline]);

  if (!enabled || !d.supported) return { supported: false, button: null, note: null };
  const w = words(isEn());
  const state = d.listening ? 'listening' : d.status === 'error' ? 'error' : 'idle';
  return {
    supported: true,
    button: (
      <>
        <button type="button" className="po-mic" data-state={state} aria-label={w.label} aria-pressed={d.listening}
          title={w.label} onClick={press} onPointerEnter={d.preload} onFocus={d.preload}>
          <MicGlyph />
        </button>
        <span className="sr-only" role="status" aria-live="polite">{announce}</span>
      </>
    ),
    note: d.message ? <p className="po-dictate-note" role="alert">{d.message}</p> : null,
  };
}

/**
 * Υπαγόρευση γύρω από οποιοδήποτε `<input>` ή `<textarea>`.
 *
 * Το πεδίο μένει όπως είναι· το περιτύλιγμα του δίνει χώρο δεξιά για το
 * κουμπί (μόνο όπου υποστηρίζεται) και βάζει το μήνυμα σφάλματος από κάτω.
 * Το `style` πηγαίνει στο εξωτερικό κουτί, ώστε να πάρει τη θέση που είχε το
 * πεδίο σε flex ή grid.
 */
export function Dictation({ value, onChange, multiline = false, style, className, children }: {
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  style?: CSSProperties;
  className?: string;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const getField = useCallback((): Field | null => box.current?.querySelector('input, textarea') ?? null, []);
  const m = useMicField({ value, onChange, multiline, getField });
  return (
    <div style={style} className={className}>
      <div ref={box} className="po-dictate" data-mic={m.supported ? (multiline ? 'multi' : 'single') : undefined}>
        {children}
        {m.button}
      </div>
      {m.note}
    </div>
  );
}
