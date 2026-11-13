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
// και αποδίδεται μόνο όταν ο χρήστης πατήσει «Σύντομη περιήγηση» στη λίστα
// «Από πού ξεκινάς». Δεν ανοίγει ποτέ μόνη της: ο δρόμος ως τον πρώτο φόρο
// είναι τέσσερα πατήματα χωρίς κανένα πέπλο ανάμεσα.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useId, useLayoutEffect, useState } from 'react';
import { T, TT, Btn, useOverlayShell } from '@/components/Theme';
import { useBackButton } from '@/components/useBackButton';
import { TOUR_STEPS, isVisibleRect, placeCard, type TourStep, type Box, type CardPlace } from '@/lib/onboarding/tour';

interface Props {
  /** Τέλος ή απόρριψη: ο γονέας γράφει ότι έγινε και κλείνει. */
  onDone: (how: 'finished' | 'dismissed') => void;
}

// Δύο εικονοστοιχεία αέρα γύρω από τον στόχο: με έξι το φως έπεφτε πάνω στα
// διπλανά στοιχεία της μπάρας και τα έδειχνε κι εκείνα.
const PAD = 2;
const EDGE = 4;

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
  const [spot, setSpot] = useState<(Box & { radius: number }) | null>(null);
  const [pos, setPos] = useState<CardPlace | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const dismiss = () => onDone('dismissed');
  const { panelRef, z } = useOverlayShell(true, dismiss);
  // «Πίσω» του περιηγητή: ένα βήμα πίσω, στο πρώτο κλείνει, όπως τα κουμπιά της κάρτας.
  useBackButton(rearm => { if (i > 0) { setI(i - 1); rearm(); } else dismiss(); });

  const step = steps[i];
  const last = i === steps.length - 1;

  // Η περιήγηση κυλά τη σελίδα ως τους στόχους της. Στο τέλος ο χρήστης
  // γυρίζει εκεί όπου ήταν, όχι στη μέση της Επισκόπησης.
  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>('.app-content');
    const y = scroller?.scrollTop ?? 0;
    return () => { scroller?.scrollTo({ top: y }); };
  }, []);

  // ΤΟ «ΠΙΣΩ» ΕΞΑΦΑΝΙΖΕΤΑΙ ΣΤΟ ΠΡΩΤΟ ΒΗΜΑ. Αν η εστίαση ήταν πάνω του, θα
  // έπεφτε στο <body>, έξω από την κάρτα· πηγαίνει στο κύριο κουμπί.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || panel.contains(document.activeElement)) return;
    panel.querySelector<HTMLElement>('.ob-tour-foot [data-variant="primary"]')?.focus();
  }, [i, panelRef]);

  // Χωρίς κανένα ορατό στόχο δεν υπάρχει τι να δείξει: τελειώνει αμέσως.
  useEffect(() => { if (steps.length === 0) onDone('finished'); }, [steps.length, onDone]);

  // Ο στόχος στο οπτικό πεδίο και μετά η μέτρηση. Ξαναμετρά σε αλλαγή μεγέθους
  // και κύλισης, ώστε το παράθυρο να μένει πάνω στο στοιχείο.
  useLayoutEffect(() => {
    if (!step) return;
    // Ο ΣΤΟΧΟΣ ΜΠΟΡΕΙ ΝΑ ΕΜΦΑΝΙΣΤΕΙ ΕΝΑ ΚΑΡΕ ΑΡΓΟΤΕΡΑ. Το κουμπί της Νόας
    // αποσύρεται στα άλλα βήματα και ξαναμπαίνει μόλις η κάρτα δηλώσει
    // `data-keeps-fab`, δηλαδή μετά από αυτό το εφέ. Λίγες ήσυχες επαναλήψεις·
    // αν δεν βρεθεί, η κάρτα μένει χωρίς φως σε λάθος σημείο.
    let detach = () => {};
    let timer = 0;
    let tries = 0;
    const attach = () => {
      const el = findTarget(step);
      if (!el) {
        if (tries++ < 20) timer = window.setTimeout(attach, 50);
        else setSpot(null);
        return;
      }
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      let raf = 0;
      const measure = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const r = el.getBoundingClientRect();
          // Μέσα στο παράθυρο: ο στόχος στην άκρη (η Νόα, η κάτω μπάρα) δεν
          // κόβει το δαχτυλίδι του.
          const vw = window.innerWidth, vh = window.innerHeight;
          const left = Math.max(EDGE, r.left - PAD), top = Math.max(EDGE, r.top - PAD);
          const box = { top, left, width: Math.min(vw - EDGE, r.right + PAD) - left, height: Math.min(vh - EDGE, r.bottom + PAD) - top };
          // Η ακτίνα του φωτός είναι η ακτίνα του στόχου συν το περιθώριο: οι
          // δύο καμπύλες μένουν ομόκεντρες, όποιο σχήμα κι αν έχει ο στόχος
          // (χάπι η Νόα, 10 τα κουμπιά, 12 τα στοιχεία της πλαϊνής μπάρας).
          const own = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
          setSpot({ ...box, radius: Math.min(own, r.height / 2) + PAD });
          const card = panelRef.current;
          const size = { width: 360, height: card?.offsetHeight || 220 };
          setPos(placeCard(box, size, window.innerWidth, window.innerHeight, 16));
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
      detach = () => {
        cancelAnimationFrame(raf); window.clearTimeout(settle);
        window.removeEventListener('resize', measure);
        window.removeEventListener('scroll', measure, true);
        ro?.disconnect();
      };
    };
    // Πρώτη προσπάθεια στο επόμενο καρέ, όχι μέσα στο εφέ: έτσι καμία ενημέρωση
    // κατάστασης δεν γίνεται σύγχρονα εδώ.
    timer = window.setTimeout(attach, 0);
    return () => { window.clearTimeout(timer); detach(); };
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
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height, borderRadius: spot.radius }} />
      )}

      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" data-keeps-fab={step.id === 'assistant' ? '' : undefined} aria-labelledby={titleId} aria-describedby={bodyId}
        className="ob-tour-card"
        style={pos ? { top: pos.top, left: pos.left, width: pos.width } : { visibility: 'hidden' }}>
        {/* Το βέλος δείχνει το κέντρο του στόχου, στην ακμή που τον κοιτά. */}
        {pos && <span className="ob-caret" data-edge={pos.caret.edge} aria-hidden
          style={pos.caret.edge === 'left' || pos.caret.edge === 'right' ? { top: pos.caret.offset } : { left: pos.caret.offset }} />}
        {/* Η αλλαγή βήματος ακούγεται από εδώ· η εστίαση μένει στο κουμπί. Η
            πρόοδος φαίνεται μόνο στις κουκκίδες· ο αναγνώστης οθόνης την ακούει. */}
        <div aria-live="polite">
          <span className="sr-only">{`Βήμα ${i + 1} από ${steps.length}. `}</span>
          <div className="ob-tour-head">
            <h2 id={titleId} style={{ ...TT.h2, margin: 0 }}>{step.title}</h2>
            <Btn variant="ghost" className="ob-tour-skip" onClick={dismiss}>Παράλειψη</Btn>
          </div>
          <p id={bodyId} style={{ ...TT.bodySm, margin: `${T.sp.sm}px 0 0` }}>{step.body}</p>
        </div>
        <div className="ob-tour-foot">
          <div className="ob-dots" aria-hidden>
            {steps.map((s, k) => <span key={s.id} className={k === i ? 'on' : undefined} />)}
          </div>
          {i > 0 && <Btn variant="ghost" onClick={() => setI(i - 1)}>Πίσω</Btn>}
          <Btn variant="primary" onClick={() => (last ? onDone('finished') : setI(i + 1))}>{last ? 'Τέλος' : 'Επόμενο'}</Btn>
        </div>
      </div>
    </div>
  );
}
