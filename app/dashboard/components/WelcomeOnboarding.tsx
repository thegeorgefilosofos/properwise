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
import { useId } from 'react';
import { createClient } from '@/lib/supabase/client';
import { T, TT, Btn, useOverlayShell } from '@/components/Theme';
import { BrandLogo } from '@/components/BrandMark';
import { vocative } from '@/lib/greekName';
import { saved } from '@/components/dbWrite';
import { trackOnboarding, PRODUCT_EVENTS } from '@/lib/analytics/events';

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
 * Ο δρόμος ως τον πρώτο φόρο, όπως θα τον περπατήσει: τρία βήματα, μία γραμμή
 * το καθένα. Ο αριθμός κάθε βήματος βγαίνει από τη θέση του.
 */
const PATH: readonly string[] = [
  'Τύπος και κατάσταση',
  'Το μίσθωμα, αν υπάρχει',
  'Ο φόρος σου, αμέσως',
];

export default function WelcomeOnboarding({ userId, name, onAddProperty, onClose }: Props) {
  const supabase = createClient();
  const titleId = useId();
  const descId = useId();
  const greet = vocative(name);

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

  // ΕΝΑ ΑΡΙΣΤΕΡΟ ΠΕΡΙΘΩΡΙΟ ΓΙΑ ΟΛΑ. Λογότυπο, τίτλος, κείμενο, βήματα και
  // κουμπί ξεκινούν στην ίδια κατακόρυφη· τα κενά είναι του `T.sp`.
  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId} className="ob-scrim">
      <div ref={panelRef} tabIndex={-1} className="ob-card">
        <BrandLogo size={20} />

        <h2 id={titleId} style={{ ...TT.displaySm, margin: `${T.sp.xxl}px 0 0` }}>
          {greet ? `Καλώς ήρθες, ${greet}` : 'Καλώς ήρθες'}
        </h2>
        <p id={descId} style={{ ...TT.body, textWrap: 'balance', color: 'var(--text-secondary)', margin: `${T.sp.sm}px 0 0` }}>
          Φόρος, προθεσμίες και έγγραφα των ακινήτων σου, σε ένα σημείο.
        </p>

        {/* Μία ήσυχη ομάδα με λεπτές διαχωριστικές, όχι τρία σκόρπια κουτιά. */}
        <ol className="ob-path" aria-label="Τα βήματα">
          {PATH.map((title, i) => (
            <li key={title} className="ob-path-row">
              <span className="ob-path-num" aria-hidden>{i + 1}</span>
              <span style={{ ...TT.label, color: 'var(--text-primary)', minWidth: 0 }}>{title}</span>
            </li>
          ))}
        </ol>

        <div style={{ display: 'grid', marginTop: T.sp.xxl }}>
          <Btn variant="primary" size="lg" onClick={addProperty}>Πρόσθεσε το πρώτο σου ακίνητο</Btn>
        </div>
        {/* Η μαζική καταχώρηση από Ε9 ή ΕΝΦΙΑ δεν χάνεται: είναι η πρώτη
            κάρτα του οδηγού και κουμπί της κενής οθόνης. Εδώ θα ήταν δεύτερη
            επιλογή ίσου βάρους δίπλα στη μία που μετρά. */}
        <div className="ob-quiet">
          <Btn variant="ghost" onClick={later}>Αργότερα</Btn>
        </div>
      </div>
    </div>
  );
}
