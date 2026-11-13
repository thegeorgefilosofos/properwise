'use client';

// ═══════════════════════════════════════════════════════════════════════════
// WelcomeOnboarding: η πρώτη είσοδος, σε μία οθόνη
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΜΕΤΡΗΘΗΚΕ ΚΑΙ ΓΙΑΤΙ ΑΛΛΑΞΕ (13/11/2026). Η υποδοχή ήταν τέσσερις κάρτες
// με ποσά ενός φανταστικού ακινήτου και στην τελευταία δύο ερωτήσεις για
// νομική μορφή. Ο νέος χρήστης χρειαζόταν τέσσερα πατήματα για να φτάσει στον
// οδηγό, διάβαζε ποσά που δεν ήταν δικά του και στα 375 η ερώτηση της κάρτας
// κοβόταν σε «Πόσο φόρο θα πληρώσω φέτ…». Μετά την αποθήκευση έβλεπε ένα
// μηδενικό «Καθαρό» και ο φόρος του ήταν τρεις οθόνες πιο κάτω.
//
// ΤΩΡΑ ΜΙΑ ΟΘΟΝΗ ΛΕΕΙ ΤΡΙΑ ΠΡΑΓΜΑΤΑ, ΜΕ ΛΙΓΑ ΛΟΓΙΑ: τι κάνει η εφαρμογή για
// εκείνον, τι θα γίνει τώρα (ο δρόμος ως τον φόρο του) και μία ενέργεια. Τα ποσά του
// παραδείγματος ζουν στο «Δες ένα παράδειγμα» της κενής οθόνης, όπου λέγονται
// παράδειγμα. Ο τύπος προφίλ αλλάζει από τον Λογαριασμό και η νομική μορφή από
// τον Φάκελο του λογιστή· η προεπιλογή (ιδιώτης, φυσικό πρόσωπο) είναι η
// απάντηση της μεγάλης πλειονότητας και δεν κρύβει τίποτα που θα χρειαστεί.
//
// ΚΛΕΙΝΕΙ ΜΕ Escape, ΓΙΑΤΙ ΤΩΡΑ ΤΟ Escape ΓΡΑΦΕΙ. Πριν, το Escape δεν έκανε
// τίποτα επειδή θα έκλεινε την υποδοχή χωρίς να γράψει `welcomed`. Εδώ το
// Escape καλεί το ίδιο «Αργότερα», που πρώτα γράφει και μετά κλείνει. Το
// κλικ στο φόντο δεν κλείνει: ένα άστοχο άγγιγμα δεν είναι απόφαση.
// ═══════════════════════════════════════════════════════════════════════════
import { useId, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Btn, fe, useOverlayShell, T } from '@/components/Theme';
import { athensToday } from '@/lib/core/time';
import { writeStatus } from '@/lib/property/status';
import { DEMO_PROPERTY } from '@/lib/demo/sample';
import { firstTaxOf, taxDeadlineRow } from '@/lib/onboarding/firstTax';
import { ONBOARDING_STEPS } from '@/lib/onboarding/steps';
import { vocative } from '@/lib/greekName';
import { saved } from '@/components/dbWrite';
import { trackOnboarding, PRODUCT_EVENTS } from '@/lib/analytics/events';
import { useBackButton } from '@/components/useBackButton';

interface Props {
  userId: string;
  /** Το όνομα του λογαριασμού, αν το δήλωσε. Χωρίς όνομα, χαιρετισμός χωρίς όνομα. */
  name?: string;
  onAddProperty: () => void;                 // άνοιγμα οδηγού προσθήκης
  onScanCreate?: () => void;                 // παλιά είσοδος· η σάρωση ζει πλέον στον πίνακα
  onMyaade?: () => void;                     // δεν αποδίδεται πια εδώ· η μαζική ζει στον οδηγό και στην κενή οθόνη
  onProfile?: (v: 'individual' | 'professional') => void;
  onClose: () => void;                       // «Αργότερα» ή Escape
}

/**
 * Η ΜΙΚΡΟΓΡΑΦΙΑ ΤΗΣ ΚΑΡΤΑΣ ΤΟΥ ΦΟΡΟΥ: η υποδοχή δείχνει το προϊόν, όχι μόνο
 * λόγια. Το ποσό βγαίνει από την ίδια `firstTaxOf` με την πραγματική κάρτα,
 * για το ακίνητο του παραδείγματος (lib/demo/sample.ts) και λέγεται
 * «Παράδειγμα». Η γραμμή από κάτω είναι η επόμενη προθεσμία ΤΟΥ ΙΔΙΟΥ ΦΟΡΟΥ
 * (φόρος εισοδήματος, με τον οποίο πληρώνεται ο φόρος ενοικίων), όχι ο ΕΝΦΙΑ.
 */
function previewOf(today: string) {
  const t = firstTaxOf({ id: 'demo', ...writeStatus('rent_long'), target_rent: DEMO_PROPERTY.monthlyRent }, today);
  const next = taxDeadlineRow('rent_long', today);
  return { year: t.year, tax: t.tax, next };
}

export default function WelcomeOnboarding({ userId, name, onAddProperty, onClose }: Props) {
  const supabase = createClient();
  const titleId = useId();
  const descId = useId();
  const greet = vocative(name);
  const [preview] = useState(() => previewOf(athensToday()));

  const mark = async () => {
    await saved('Η πρόοδος της υποδοχής δεν αποθηκεύτηκε', supabase.from('onboarding_progress')
      .upsert({ user_id: userId, welcomed: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }));
  };
  const addProperty = async () => { await mark(); onAddProperty(); };
  // Μία οθόνη πλέον: η «κάρτα» του γεγονότος είναι πάντα η πρώτη.
  const later = async () => {
    void trackOnboarding(supabase, { event: PRODUCT_EVENTS.welcome_later, card: 1 });
    await mark(); onClose();
  };
  const { panelRef } = useOverlayShell(true, later);
  // Το «Πίσω» του περιηγητή είναι το «Αργότερα»: γράφει και κλείνει, δεν βγάζει από τον πίνακα.
  useBackButton(() => { void later(); });

  // ΕΝΑ ΑΡΙΣΤΕΡΟ ΠΕΡΙΘΩΡΙΟ ΓΙΑ ΟΛΑ, ΚΕΝΑ ΣΤΟ ΠΛΕΓΜΑ ΤΩΝ 8 (globals.css, .ob-*).
  // Σε κινητό η κάρτα γίνεται φύλλο που ακουμπά στο κάτω μέρος· σε υπολογιστή
  // μένει παράθυρο στο κέντρο.
  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId} className="ob-scrim">
      {/* Οι ακτίνες από την κλίμακα (components/tokens.ts): το φύλλο στυλ τις
          διαβάζει ως μεταβλητές, ώστε να μη γράφονται δεύτερη φορά ως ψηφία. */}
      <div ref={panelRef} tabIndex={-1} className="ob-card"
        style={{ '--modal-r': `${T.radius.modal}px`, '--radius-inner': `${T.radius.inner}px` } as React.CSSProperties}>
        <h2 id={titleId} className="ob-title">
          {greet ? `Καλώς ήρθες, ${greet}` : 'Καλώς ήρθες'}
        </h2>
        <p id={descId} className="ob-sub">
          Φόρος, προθεσμίες και έγγραφα των ακινήτων σου, σε ένα σημείο.
        </p>

        {/* Η μικρογραφία είναι εικόνα του προϊόντος, όχι περιεχόμενο: ο
            αναγνώστης οθόνης την προσπερνά. */}
        <div className="ob-preview" aria-hidden>
          <div className="ob-preview-head">
            <span>{`Φόρος ενοικίων ${preview.year}`}</span>
            <span className="ob-preview-tag">Παράδειγμα</span>
          </div>
          <div className="ob-preview-amount">{fe(preview.tax)}</div>
          {preview.next && (
            <div className="ob-preview-row">
              <span className="po-elide">{preview.next.title}</span>
              <span className="ob-preview-date">{preview.next.date}</span>
            </div>
          )}
        </div>

        {/* Τα ίδια τρία βήματα με τη ράγα του οδηγού (lib/onboarding/steps.ts). */}
        <ol className="ob-steps" aria-label="Τα βήματα">
          {ONBOARDING_STEPS.map((st, i) => (
            <li key={st.id} className="ob-step" data-now={i === 0 ? '' : undefined} style={{ animationDelay: `${120 + i * 40}ms` }}>
              <span className="ob-node" aria-hidden>{i + 1}</span>
              <span className="ob-step-label">{st.label}</span>
            </li>
          ))}
        </ol>

        <div className="ob-actions">
          <Btn variant="primary" size="lg" onClick={addProperty}>Πρόσθεσε το πρώτο σου ακίνητο</Btn>
          {/* Η μαζική καταχώρηση από Ε9 ή ΕΝΦΙΑ δεν χάνεται: είναι η πρώτη
              κάρτα του οδηγού και κουμπί της κενής οθόνης. Εδώ θα ήταν δεύτερη
              επιλογή ίσου βάρους δίπλα στη μία που μετρά. */}
          <Btn variant="ghost" size="lg" onClick={later}>Αργότερα</Btn>
        </div>
      </div>
    </div>
  );
}
