'use client';
// ═══════════════════════════════════════════════════════════════════════════
// «ΑΚΟΥΣΕ»: ΤΑ ΒΑΣΙΚΑ ΠΟΣΑ ΦΩΝΑΧΤΑ
// ─────────────────────────────────────────────────────────────────────────
// Για όποιον βλέπει λίγο και δεν χρησιμοποιεί αναγνώστη οθόνης: ένα πάτημα
// και ακούει τα ποσά της χρονιάς, ολογράφως («χίλια διακόσια ευρώ και
// πενήντα λεπτά»). Ο αναγνώστης οθόνης τα διαβάζει ήδη από τη σελίδα.
//
// ΦΑΙΝΕΤΑΙ ΜΟΝΟ ΟΤΑΝ ΤΟ ΖΗΤΗΣΕΙΣ ΚΑΙ ΜΟΝΟ ΟΤΑΝ ΔΟΥΛΕΥΕΙ. Ανάβει από τις
// Ρυθμίσεις («Ανάγνωση ποσών») και δεν αποδίδεται όπου ο περιηγητής δεν έχει
// σύνθεση φωνής. Τα ποσά έρχονται έτοιμα από τον υπολογισμό της οθόνης·
// εδώ μόνο γίνονται λέξεις.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState, useSyncExternalStore } from 'react';
import { spokenEuro } from '@/lib/core/spokenAmount';
import { speakGreek, stopSpeaking, ttsSupported } from '@/lib/core/speak';
import { useA11yPrefs } from './useA11yPrefs';

const NEVER = () => () => {};

export interface SpokenFigure { label: string; amount: number }

/** Το κείμενο που διαβάζεται: «Τίτλος. Ετικέτα: ποσό. Ετικέτα: ποσό.» */
export function spokenFigures(title: string, figures: readonly SpokenFigure[]): string {
  const parts = figures.filter(f => Number.isFinite(f.amount)).map(f => `${f.label}: ${spokenEuro(f.amount)}.`);
  return [title ? `${title}.` : '', ...parts].filter(Boolean).join(' ');
}

export function SpeakIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg aria-hidden="true" width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
  );
}

/**
 * Το κουμπί. `always`: φαίνεται και χωρίς τη ρύθμιση (για το δείγμα μέσα
 * στις ίδιες τις Ρυθμίσεις).
 */
export function SpeakAmount({ title, figures, label, always = false, text, variant = 'pill' }: {
  title: string;
  figures: readonly SpokenFigure[];
  /**
   * Τι διαβάζεται, ως συνέχεια του «Άκουσε» για τον αναγνώστη οθόνης: «τα ποσά
   * της χρονιάς». Το ορατό ρήμα μένει η αρχή του ονόματος, ώστε όποιος
   * χειρίζεται την οθόνη με φωνή να λέει ό,τι βλέπει.
   */
  label: string;
  always?: boolean;
  /** Ορατό κείμενο στη θέση του «Άκουσε» (π.χ. «Άκουσε ένα παράδειγμα»). */
  text?: string;
  /**
   * `icon`: στρογγυλό κουμπί με το ηχείο, ίδιας γεωμετρίας με το μικρόφωνο
   * (στόχος 44, ορατός κύκλος 32). Για κεφαλίδες, όπου ένα περιγραμμένο
   * κουμπί με λέξη ήταν πιο ψηλό από την ίδια την κεφαλίδα.
   */
  variant?: 'pill' | 'icon';
}) {
  const [prefs] = useA11yPrefs();
  const supported = useSyncExternalStore(NEVER, ttsSupported, () => false);
  const [speaking, setSpeaking] = useState(false);
  // Η οθόνη που κλείνει δεν συνεχίζει να μιλά.
  useEffect(() => () => { if (speaking) stopSpeaking(); }, [speaking]);
  if (!supported || (!always && !prefs.speakAmounts)) return null;

  const press = () => {
    if (speaking) { stopSpeaking(); setSpeaking(false); return; }
    const ok = speakGreek(spokenFigures(title, figures), { start: () => setSpeaking(true), end: () => setSpeaking(false) });
    if (ok) setSpeaking(true);
  };
  if (variant === 'icon') {
    // Όνομα σταθερό, κατάσταση στο `aria-pressed`: το όνομα δεν αλλάζει κάτω
    // από τα δάχτυλα του χρήστη, όπως και στο μικρόφωνο.
    const name = `Άκουσε ${label}`;
    return (
      <button type="button" className="po-mic po-speak-icon" aria-pressed={speaking} aria-label={name}
        title={speaking ? 'Σταμάτα την ανάγνωση' : name} onClick={press}>
        {speaking ? <StopIcon /> : <SpeakIcon size={18} />}
      </button>
    );
  }
  return (
    <button type="button" className="po-speak" data-on={speaking || undefined} onClick={press}>
      <SpeakIcon />
      {text && !speaking
        ? <span>{text}</span>
        : <>
            <span>{speaking ? 'Σταμάτα' : 'Άκουσε'}</span>
            <span className="sr-only">{speaking ? ' την ανάγνωση' : ` ${label}`}</span>
          </>}
    </button>
  );
}
