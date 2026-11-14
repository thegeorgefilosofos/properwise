// ═══════════════════════════════════════════════════════════════════════════
// «ΤΕΛΕΥΤΑΙΑ ΕΝΗΜΕΡΩΣΗ · ΠΗΓΗ», ΜΙΑ ΓΡΑΜΜΗ, ΙΔΙΑ ΠΑΝΤΟΥ
// ─────────────────────────────────────────────────────────────────────────
// Το κείμενο βγαίνει από το `asOfLine` του καταλόγου τιμών (lib/facts/prices.ts)·
// εδώ μόνο το σχήμα: μικρά γράμματα, χωρίς πλαίσιο, η πηγή σύνδεσμος όταν έχει
// διεύθυνση. Καθαρό στοιχείο χωρίς κατάσταση, για δημόσιες σελίδες και οθόνες.
// ═══════════════════════════════════════════════════════════════════════════
import { Fragment, type CSSProperties } from 'react';
import { asOfLine, type AsOf } from '@/lib/facts/prices';

const LINK: CSSProperties = { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 };

/**
 * @param pending Νόμος ή απόφαση που εκκρεμεί για τους ίδιους κανόνες
 *   (`taxLimitPending`, lib/facts/taxLimits). Γράφεται σε δεύτερη γραμμή,
 *   ώστε το «ελεγμένοι» να μη διαβάζεται σαν «τίποτα δεν αλλάζει».
 */
export function AsOfNote({ fact, style, pending }: { fact: AsOf; style?: CSSProperties; pending?: readonly { title: string; href: string }[] }) {
  const line = asOfLine(fact);
  const cut = line.lastIndexOf('Πηγή: ');
  const head = cut >= 0 ? line.slice(0, cut + 'Πηγή: '.length) : line;
  return (
    <p className="po-asof" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', lineHeight: 1.5, margin: '8px 0 0', ...style }}>
      {head}
      {cut >= 0 && (fact.url
        ? <a href={fact.url} target="_blank" rel="noopener noreferrer" style={LINK}>{fact.source}</a>
        : fact.source)}
      {pending && pending.length > 0 && (
        // Οι σύνδεσμοι κάθονται απευθείας μέσα στην πρόταση, χωρίς δικό τους
        // περιτύλιγμα: είναι σύνδεσμοι κειμένου και κρίνονται ως τέτοιοι.
        <span style={{ display: 'block', marginTop: 2 }}>
          {pending.length === 1 ? 'Εκκρεμεί: ' : 'Εκκρεμούν: '}
          {pending.map((p, i) => (
            <Fragment key={p.title}>{i > 0 && ' · '}<a href={p.href} target="_blank" rel="noopener noreferrer" style={LINK}>{p.title}</a></Fragment>
          ))}
        </span>
      )}
    </p>
  );
}
