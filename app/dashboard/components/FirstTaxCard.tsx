'use client';

// ═══════════════════════════════════════════════════════════════════════════
// FirstTaxCard: ο φόρος του πρώτου ακινήτου, τη στιγμή που αποθηκεύεται
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Ως τις 13/11/2026 ο νέος χρήστης αποθήκευε το πρώτο του
// ακίνητο και έβλεπε «Καθαρό 0,00€». Ο φόρος του υπήρχε ήδη, ως πλακίδιο
// τρεις με τέσσερις οθόνες πιο κάτω. Το πράγμα που ήρθε να μάθει ήταν η
// μόνη πληροφορία που έπρεπε να ψάξει.
//
// ΤΟ ΠΟΣΟ ΔΕΝ ΥΠΟΛΟΓΙΖΕΤΑΙ ΕΔΩ. Βγαίνει από την `firstTaxOf`
// (lib/onboarding/firstTax.ts), που καλεί την ίδια `propertyRentTax` με το
// πλακίδιο «Φόρος ενοικίου» της Επισκόπησης. Οι προθεσμίες βγαίνουν από το
// φορολογικό ημερολόγιο. Τίποτα γραμμένο με το χέρι.
//
// ΧΩΡΙΣ ΑΔΙΕΞΟΔΟ. Μίσθωση χωρίς ποσό δεν δείχνει μηδέν σαν να ήταν φόρος:
// λέει τι λείπει και ανοίγει την επεξεργασία στο σημείο που το ζητά. Ακίνητο
// που δεν νοικιάζεται λέει ότι δεν έχει φόρο ενοικίων και δείχνει τον ΕΝΦΙΑ
// (αν τον δήλωσε) και τις επόμενες προθεσμίες του.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { T, TT, Btn, Modal, fe } from '@/components/Theme';
import { grDate } from '@/lib/core/format';
import { athensToday } from '@/lib/core/time';
import { firstTaxOf, firstDeadlines, type FirstTaxProperty } from '@/lib/onboarding/firstTax';

interface Props {
  property: FirstTaxProperty & { name: string };
  /** Η περιήγηση δεν έχει γίνει ακόμη: η κάρτα την προτείνει. */
  offerTour: boolean;
  onTour: () => void;
  /** Κλείσιμο χωρίς περιήγηση (Escape, ×, «Παράλειψη»). */
  onClose: () => void;
  /** Ανοίγει την επεξεργασία του ακινήτου, για το μίσθωμα που λείπει. */
  onAddRent: () => void;
}

const row: React.CSSProperties = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: T.sp.md, padding: '10px 0', borderTop: '1px solid var(--border-subtle)' };

export default function FirstTaxCard({ property, offerTour, onTour, onClose, onAddRent }: Props) {
  const [today] = useState(athensToday);
  const t = firstTaxOf(property, today);
  const deadlines = firstDeadlines(t.status, today);
  const hasTax = t.rented && t.annual > 0;

  return (
    <Modal open onClose={onClose} size="sm"
      title="Το ακίνητο αποθηκεύτηκε"
      subtitle={property.name}
      icon={<svg aria-hidden="true" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
      footer={offerTour ? <>
        <Btn variant="ghost" size="lg" onClick={onClose}>Παράλειψη</Btn>
        <Btn variant="primary" size="lg" onClick={onTour}>Γνώρισε την εφαρμογή</Btn>
      </> : <Btn variant="primary" size="lg" onClick={onClose}>Εντάξει</Btn>}>

      {hasTax ? (
        <section aria-labelledby="first-tax-label">
          <div id="first-tax-label" style={{ ...TT.label }}>{`Φόρος ενοικίων ${t.year}`}</div>
          <div className="ob-figure" style={{ ...TT.display, fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', marginTop: T.sp.sm }}>{fe(t.tax)}</div>
          <p style={{ ...TT.bodySm, margin: `${T.sp.sm}px 0 0` }}>
            {`Ενδεικτικά, για έσοδα ${fe(t.annual)} τον χρόνο.`}
          </p>
        </section>
      ) : t.rented ? (
        <section>
          <div style={{ ...TT.label }}>{`Φόρος ενοικίων ${t.year}`}</div>
          <p style={{ ...TT.body, margin: `${T.sp.sm}px 0 ${T.sp.md}px` }}>
            Λείπει το μηνιαίο μίσθωμα.
          </p>
          <div style={{ display: 'grid' }}>
            <Btn variant="secondary" size="lg" onClick={onAddRent}>Πρόσθεσε μίσθωμα</Btn>
          </div>
        </section>
      ) : (
        <section>
          <div style={{ ...TT.label }}>Φόρος ενοικίων</div>
          <p style={{ ...TT.body, margin: `${T.sp.sm}px 0 0` }}>
            Δεν νοικιάζεται, άρα δεν έχει φόρο ενοικίων.
          </p>
        </section>
      )}

      {(t.enfia != null || deadlines.length > 0) && (
        <section aria-labelledby="first-tax-next">
          <div id="first-tax-next" style={{ ...TT.label, marginBottom: T.sp.xs }}>Επόμενες προθεσμίες</div>
          {t.enfia != null && (
            <div style={row}>
              <span style={{ ...TT.body }}>ΕΝΦΙΑ</span>
              <span style={{ ...TT.figure, whiteSpace: 'nowrap' }}>{`${fe(t.enfia)} τον χρόνο`}</span>
            </div>
          )}
          {deadlines.map(d => (
            <div key={d.id} style={row}>
              <span style={{ ...TT.body, minWidth: 0 }}>{d.title}</span>
              <span style={{ ...TT.figure, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{grDate(d.date)}</span>
            </div>
          ))}
          <p style={{ ...TT.caption, margin: `${T.sp.xs}px 0 0` }}>Μπήκαν ήδη στο Ημερολόγιο.</p>
        </section>
      )}
    </Modal>
  );
}
