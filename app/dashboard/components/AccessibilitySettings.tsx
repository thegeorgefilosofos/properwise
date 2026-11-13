'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΠΡΟΣΒΑΣΙΜΟΤΗΤΑ: ΟΙ ΡΥΘΜΙΣΕΙΣ ΣΕ ΜΙΑ ΕΝΟΤΗΤΑ
// ─────────────────────────────────────────────────────────────────────────
// Μέγεθος κειμένου, υψηλή αντίθεση, λιγότερη κίνηση, ανάγνωση ποσών και η
// εξήγηση της υπαγόρευσης. Ηταν δύο διακόπτες χαμένοι στο «Εμφάνιση και
// γλώσσα»· όποιος τα ψάχνει ψάχνει τη λέξη «Προσβασιμότητα».
//
// Κάθε αλλαγή ισχύει αμέσως σε όλη την εφαρμογή και τη θυμάται αυτή η
// συσκευή (lib/core/a11yPrefs.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { useSyncExternalStore } from 'react';
import { SetList, SetRow } from './SettingsKit';
import { SegmentControl, Toggle } from './UIComponents';
import { useA11yPrefs } from '@/components/useA11yPrefs';
import { useDictationSupported } from '@/components/dictation/useDictation';
import { SpeakAmount } from '@/components/SpeakAmount';
import { ttsSupported } from '@/lib/core/speak';
import type { TextSize } from '@/lib/core/a11yPrefs';

const NEVER = () => () => {};
const REDUCED = '(prefers-reduced-motion: reduce)';
function subscribeMotion(cb: () => void): () => void {
  try {
    const m = window.matchMedia(REDUCED);
    m.addEventListener('change', cb);
    return () => m.removeEventListener('change', cb);
  } catch { return () => {}; }
}
const deviceReduces = (): boolean => {
  try { return window.matchMedia(REDUCED).matches; } catch { return false; }
};

const TEXT_OPTS: { value: TextSize; label: string }[] = [
  { value: 'normal', label: 'Κανονικό' },
  { value: 'large', label: 'Μεγάλο' },
  { value: 'xlarge', label: 'Πολύ μεγάλο' },
];

/** Οι επιλογές δεν απλώνονται σε όλο το πλάτος του υπολογιστή: τρεις λέξεις σε
 *  ράγα 1.700 εικονοστοιχείων δεν διαβάζονται ως μία ερώτηση. */
const SEG_WIDTH = { maxWidth: 440 } as const;

/** Το δείγμα της ανάγνωσης: ένα ποσό με χιλιάδες και λεπτά, ώστε να ακουστούν και τα δύο. */
const SAMPLE = [{ label: 'Παράδειγμα', amount: 1234.56 }];

export function AccessibilitySettings() {
  const [prefs, update] = useA11yPrefs();
  const osReduces = useSyncExternalStore(subscribeMotion, deviceReduces, () => false);
  const canSpeak = useSyncExternalStore(NEVER, ttsSupported, () => false);
  const canDictate = useDictationSupported();

  return (
    <SetList>
      <SetRow title="Μέγεθος κειμένου" desc="Μεγαλώνει κείμενο, εικονίδια και κουμπιά μαζί, σε όλη την εφαρμογή.">
        <div style={SEG_WIDTH}>
          <SegmentControl ariaLabel="Μέγεθος κειμένου" value={prefs.text}
            onChange={v => update({ text: v as TextSize })} options={TEXT_OPTS} />
        </div>
      </SetRow>
      <SetRow title="Υψηλή αντίθεση" desc="Κείμενο που ξεχωρίζει καθαρά από το φόντο και περιγράμματα που φαίνονται. Ισχύει στο σκοτεινό και στο φωτεινό θέμα."
        control={<Toggle on={prefs.contrast} onChange={v => update({ contrast: v })} ariaLabel="Υψηλή αντίθεση" />} />
      <SetRow title="Λιγότερη κίνηση"
        desc={osReduces
          ? 'Η συσκευή σου ζητά ήδη λιγότερη κίνηση και η εφαρμογή την ακολουθεί.'
          : 'Η εφαρμογή ακολουθεί τη ρύθμιση της συσκευής σου. Με «Πάντα λιγότερη» σβήνουν τα εφέ κίνησης εδώ, ό,τι κι αν λέει η συσκευή.'}>
        <div style={SEG_WIDTH}>
          <SegmentControl ariaLabel="Λιγότερη κίνηση" value={prefs.motion}
            onChange={v => update({ motion: v === 'reduce' ? 'reduce' : 'system' })}
            options={[{ value: 'system', label: 'Όπως η συσκευή' }, { value: 'reduce', label: 'Πάντα λιγότερη' }]} />
        </div>
      </SetRow>
      {canSpeak && (
        <SetRow title="Ανάγνωση ποσών" desc="Κουμπί «Άκουσε» δίπλα στα βασικά ποσά, όπως ο φόρος στην Επισκόπηση. Τα διαβάζει φωναχτά στα ελληνικά, ολογράφως."
          control={<Toggle on={prefs.speakAmounts} onChange={v => update({ speakAmounts: v })} ariaLabel="Ανάγνωση ποσών" />}>
          <SpeakAmount always title="" figures={SAMPLE} label="ένα παράδειγμα ποσού" />
        </SetRow>
      )}
      {canDictate && (
        <SetRow title="Υπαγόρευση"
          desc="Πάτα το μικρόφωνο μέσα σε σημειώσεις, περιγραφές και αναζητήσεις και μίλα. Οι λέξεις «τελεία», «κόμμα», «ερωτηματικό» και «νέα γραμμή» γράφονται ως στίξη. Τη φωνή τη μετατρέπει σε κείμενο ο περιηγητής σου και συνήθως τη στέλνει για αναγνώριση στον πάροχό του (Google στο Chrome, Microsoft στο Edge, Apple στο Safari). Η εφαρμογή λαμβάνει μόνο το κείμενο." />
      )}
    </SetList>
  );
}
