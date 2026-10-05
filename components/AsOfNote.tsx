// ═══════════════════════════════════════════════════════════════════════════
// «ΤΕΛΕΥΤΑΙΑ ΕΝΗΜΕΡΩΣΗ · ΠΗΓΗ», ΜΙΑ ΓΡΑΜΜΗ, ΙΔΙΑ ΠΑΝΤΟΥ
// ─────────────────────────────────────────────────────────────────────────
// Το κείμενο βγαίνει από το `asOfLine` του καταλόγου τιμών (lib/facts/prices.ts)·
// εδώ μόνο το σχήμα: μικρά γράμματα, χωρίς πλαίσιο, η πηγή σύνδεσμος όταν έχει
// διεύθυνση. Καθαρό στοιχείο χωρίς κατάσταση, για δημόσιες σελίδες και οθόνες.
// ═══════════════════════════════════════════════════════════════════════════
import type { CSSProperties } from 'react';
import { asOfLine, type AsOf } from '@/lib/facts/prices';

export function AsOfNote({ fact, style }: { fact: AsOf; style?: CSSProperties }) {
  const line = asOfLine(fact);
  const cut = line.lastIndexOf('Πηγή: ');
  const head = cut >= 0 ? line.slice(0, cut + 'Πηγή: '.length) : line;
  return (
    <p className="po-asof" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', lineHeight: 1.5, margin: '8px 0 0', ...style }}>
      {head}
      {cut >= 0 && (fact.url
        ? <a href={fact.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}>{fact.source}</a>
        : fact.source)}
    </p>
  );
}
