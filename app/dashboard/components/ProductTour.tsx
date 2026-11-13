'use client';

// ═══════════════════════════════════════════════════════════════════════════
// ProductTour: η σύντομη περιήγηση μετά τον πρώτο φόρο
// ─────────────────────────────────────────────────────────────────────────
// ΤΑ ΒΗΜΑΤΑ ΚΑΙ Ο ΛΟΓΟΣ ΤΟΥΣ ζουν στο lib/onboarding/tour.ts. Εδώ μένει μόνο
// η όψη: ένα φωτεινό παράθυρο πάνω στο πραγματικό στοιχείο και μία κάρτα
// δίπλα του.
//
// ΠΡΟΣΒΑΣΙΜΟΤΗΤΑ. Η κάρτα είναι `dialog` με όνομα και περιγραφή από το ίδιο το
// βήμα. Το `useOverlayShell` δίνει την εστίαση στην κάρτα, κρατά το Tab μέσα,
// κλειδώνει την κύλιση από πίσω και επιστρέφει την εστίαση όπου ήταν. Το
// Escape κλείνει και γράφει την απόρριψη. Η αλλαγή βήματος ανακοινώνεται από
// ζωντανή περιοχή, ενώ η εστίαση μένει στο κουμπί που πατήθηκε: ο χρήστης του
// πληκτρολογίου πατά Enter ξανά και ξανά χωρίς να ψάχνει το κουμπί.
//
// ΚΙΝΗΣΗ. Το παράθυρο γλιστρά από στόχο σε στόχο σε 240ms. Με
// `prefers-reduced-motion` πηδά (globals.css, `.ob-spot`).
//
// ΔΕΝ ΦΟΡΤΩΝΕΤΑΙ ΣΕ ΚΑΝΕΝΑΝ ΑΛΛΟ. Μπαίνει με `dynamic` από το lazyTabs.tsx
// και αποδίδεται μόνο όταν ο νέος χρήστης πατήσει «Δες πού είναι τι».
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useId, useLayoutEffect, useState } from 'react';
import { T, TT, Btn, CloseButton, useOverlayShell } from '@/components/Theme';
import { TOUR_STEPS, isVisibleRect, placeCard, type TourStep, type Box } from '@/lib/onboarding/tour';

interface Props {
  /** Τέλος ή απόρριψη: ο γονέας γράφει ότι έγινε και κλείνει. */
  onDone: (how: 'finished' | 'dismissed') => void;
}

const PAD = 6;

/** Το πρώτο ορατό στοιχείο από τους επιλογείς του βήματος. */
function findTarget(step: TourStep): HTMLElement | null {
  for (const sel of step.targets) {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      if (isVisibleRect(el.getBoundingClientRect(), window.innerWidth)) return el;
    }
  }
  return null;
}

export default function ProductTour({ onDone }: Props) {
  // Μόνο τα βήματα με ορατό στόχο τη στιγμή που ξεκινά η περιήγηση.
  const [steps] = useState(() => TOUR_STEPS.filter(s => findTarget(s)));
  const [i, setI] = useState(0);
  const [spot, setSpot] = useState<Box | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const dismiss = () => onDone('dismissed');
  const { panelRef, z } = useOverlayShell(true, dismiss);

  const step = steps[i];
  const last = i === steps.length - 1;

  // Χωρίς κανένα ορατό στόχο δεν υπάρχει τι να δείξει: τελειώνει αμέσως.
  useEffect(() => { if (steps.length === 0) onDone('finished'); }, [steps.length, onDone]);

  // Ο στόχος στο οπτικό πεδίο και μετά η μέτρηση. Ξαναμετρά σε αλλαγή μεγέθους
  // και κύλισης, ώστε το παράθυρο να μένει πάνω στο στοιχείο.
  useLayoutEffect(() => {
    if (!step) return;
    const el = findTarget(step);
    // Ο στόχος χάθηκε στο μεταξύ: η κάρτα μένει, χωρίς φως σε λάθος σημείο.
    if (!el) { const r = requestAnimationFrame(() => setSpot(null)); return () => cancelAnimationFrame(r); }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const box = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
        setSpot(box);
        const card = panelRef.current;
        const size = { width: 360, height: card?.offsetHeight || 220 };
        setPos(placeCard(box, size, window.innerWidth, window.innerHeight));
      });
    };
    measure();
    // Η ομαλή κύλιση τελειώνει μετά το πρώτο καρέ: μία μέτρηση ακόμη όταν σταθεί.
    const settle = window.setTimeout(measure, reduce ? 0 : 360);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    if (panelRef.current) ro?.observe(panelRef.current);
    return () => {
      cancelAnimationFrame(raf); window.clearTimeout(settle);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      ro?.disconnect();
    };
  }, [step, panelRef]);

  if (!step) return null;

  return (
    <div className="ob-tour" style={{ zIndex: z }}>
      {/* Το πέπλο είναι η σκιά του παραθύρου: ένα στοιχείο, χωρίς τρύπες να
          συντηρηθούν. Δεν δέχεται πάτημα, ώστε ένα άστοχο άγγιγμα να μην
          κλείνει την περιήγηση ούτε να πατά το στοιχείο από κάτω. */}
      <div className="ob-tour-catch" aria-hidden />
      {spot && (
        <div className="ob-spot" aria-hidden
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }} />
      )}

      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" data-keeps-fab aria-labelledby={titleId} aria-describedby={bodyId}
        className="ob-tour-card"
        style={pos ? { top: pos.top, left: pos.left, width: pos.width } : { visibility: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: T.sp.sm }}>
          <span style={{ ...TT.caption, flex: 1 }}>{`Βήμα ${i + 1} από ${steps.length}`}</span>
          <CloseButton onClose={dismiss} label="Κλείσιμο περιήγησης" style={{ margin: -6 }} />
        </div>
        {/* Η αλλαγή βήματος ακούγεται από εδώ· η εστίαση μένει στο κουμπί. */}
        <div aria-live="polite">
          <h2 id={titleId} style={{ ...TT.h2, margin: `${T.sp.xs}px 0 0` }}>{step.title}</h2>
          <p id={bodyId} style={{ ...TT.bodySm, margin: `${T.sp.sm}px 0 0` }}>{step.body}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: T.sp.sm, marginTop: T.sp.lg }}>
          <div className="ob-dots" aria-hidden>
            {steps.map((s, k) => <span key={s.id} className={k === i ? 'on' : undefined} />)}
          </div>
          {i === 0
            ? <Btn variant="ghost" onClick={dismiss}>Παράλειψη</Btn>
            : <Btn variant="ghost" onClick={() => setI(i - 1)}>Πίσω</Btn>}
          <Btn variant="primary" onClick={() => (last ? onDone('finished') : setI(i + 1))}>{last ? 'Τέλος' : 'Επόμενο'}</Btn>
        </div>
      </div>
    </div>
  );
}
