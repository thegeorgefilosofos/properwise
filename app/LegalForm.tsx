'use client';

import { useRef, useState } from 'react';
import { Btn } from '@/components/Theme';

// ═══════════════════════════════════════════════════════════════════════════
// ΕΝΤΥΠΟ ΠΡΟΣ ΑΝΤΙΓΡΑΦΗ, ΟΧΙ ΛΙΣΤΑ ΜΕ ΚΟΥΚΚΙΔΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Το υπόδειγμα υπαναχώρησης του Παραρτήματος Ι(Β) της Οδηγίας 2011/83/ΕΕ
// τυπωνόταν ως `<ul>`: το «Με το παρόν σας γνωστοποιώ…» διαβαζόταν σαν όρος
// ανάμεσα σε όρους και όποιος το αντέγραφε έπαιρνε κουκκίδες μαζί. Εδώ είναι
// ένα μπλοκ με τις γραμμές του και ένα κουμπί που το αντιγράφει καθαρό.
//
// ΟΙ ΓΡΑΜΜΕΣ ΕΡΧΟΝΤΑΙ ΩΣ `lines` ΚΑΙ ΟΧΙ ΩΣ ΠΑΙΔΙΑ, ΕΠΙΤΗΔΕΣ. Το `hy()` του
// κελύφους συλλαβίζει κάθε κείμενο που βρίσκει στα παιδιά· μαλακά ενωτικά μέσα
// σε έντυπο θα έφευγαν με την αντιγραφή και θα έσπαγαν λέξεις στο email.
// ═══════════════════════════════════════════════════════════════════════════

export function LegalForm({ lines, label }: { lines: readonly string[]; label: string }) {
  const [copied, setCopied] = useState(false);
  const pre = useRef<HTMLPreElement>(null);
  const text = lines.join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // ΟΤΑΝ ΤΟ ΠΡΟΧΕΙΡΟ ΕΙΝΑΙ ΚΛΕΙΣΤΟ, ΤΟ ΚΕΙΜΕΝΟ ΕΠΙΛΕΓΕΤΑΙ. Σε περιβάλλον
      // χωρίς άδεια το `writeText` απορρίπτεται· αντί για κουμπί που δεν κάνει
      // τίποτα, το μπλοκ επιλέγεται ολόκληρο για αντιγραφή με το χέρι.
      const el = pre.current;
      const sel = window.getSelection();
      if (!el || !sel) return;
      const r = document.createRange();
      r.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(r);
    }
  };

  return (
    <figure className="lg-form-box">
      <pre ref={pre} className="lg-form" aria-label={label}>{text}</pre>
      <figcaption className="lg-form-actions">
        <Btn onClick={copy}>{copied ? 'Αντιγράφηκε' : 'Αντιγραφή εντύπου'}</Btn>
        <span role="status" className="sr-only">{copied ? 'Το έντυπο αντιγράφηκε' : ''}</span>
      </figcaption>
    </figure>
  );
}
