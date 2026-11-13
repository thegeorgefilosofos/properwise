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

/**
 * Το κουμπί. `always`: φαίνεται και χωρίς τη ρύθμιση (για το δείγμα μέσα
 * στις ίδιες τις Ρυθμίσεις).
 */
export function SpeakAmount({ title, figures, label, always = false }: {
  title: string;
  figures: readonly SpokenFigure[];
  /**
   * Τι διαβάζεται, ως συνέχεια του «Άκουσε» για τον αναγνώστη οθόνης: «τα ποσά
   * της χρονιάς». Το ορατό ρήμα μένει η αρχή του ονόματος, ώστε όποιος
   * χειρίζεται την οθόνη με φωνή να λέει ό,τι βλέπει.
   */
  label: string;
  always?: boolean;
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
  return (
    <button type="button" className="po-speak" data-on={speaking || undefined} onClick={press}>
      <SpeakIcon />
      <span>{speaking ? 'Σταμάτα' : 'Άκουσε'}</span>
      <span className="sr-only">{speaking ? ' την ανάγνωση' : ` ${label}`}</span>
    </button>
  );
}
