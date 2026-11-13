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
// ΤΩΡΑ ΜΙΑ ΟΘΟΝΗ ΛΕΕΙ ΤΡΙΑ ΠΡΑΓΜΑΤΑ: τι κάνει η εφαρμογή για εκείνον, τι θα
// γίνει τώρα (ο δρόμος ως τον φόρο του) και μία ενέργεια. Τα ποσά του
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
import { PRODUCT_NAME } from '@/lib/core/site';
import { vocative } from '@/lib/greekName';
import { saved } from '@/components/dbWrite';
import { trackOnboarding, PRODUCT_EVENTS } from '@/lib/analytics/events';

interface Props {
  userId: string;
  /** Το όνομα του λογαριασμού, αν το δήλωσε. Χωρίς όνομα, χαιρετισμός χωρίς όνομα. */
  name?: string;
  onAddProperty: () => void;                 // άνοιγμα οδηγού προσθήκης
  onScanCreate?: () => void;                 // παλιά είσοδος· η σάρωση ζει πλέον στον πίνακα
  onMyaade?: () => void;                     // μαζική καταχώρηση από το Ε9 ή την πράξη ΕΝΦΙΑ
  onProfile?: (v: 'individual' | 'professional') => void;
  onClose: () => void;                       // «Αργότερα» ή Escape
}

/** Ο δρόμος ως τον πρώτο φόρο, όπως θα τον περπατήσει. Ο αριθμός κάθε βήματος βγαίνει από τη θέση του. */
const PATH: readonly [string, string][] = [
  ['Τι ακίνητο είναι', 'Τύπος, κατάσταση και ένα όνομα'],
  ['Πόσο νοικιάζεται', 'Το μηνιαίο μίσθωμα, αν νοικιάζεται'],
  ['Ο φόρος του', 'Αμέσως μετά την αποθήκευση, με τις επόμενες προθεσμίες'],
];

export default function WelcomeOnboarding({ userId, name, onAddProperty, onMyaade, onClose }: Props) {
  const supabase = createClient();
  const titleId = useId();
  const descId = useId();
  const greet = vocative(name);

  const mark = async () => {
    await saved('Η πρόοδος της υποδοχής δεν αποθηκεύτηκε', supabase.from('onboarding_progress')
      .upsert({ user_id: userId, welcomed: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }));
  };
  const addProperty = async () => { await mark(); onAddProperty(); };
  const myaade = async () => { await mark(); onMyaade?.(); };
  // Μία οθόνη πλέον: η «κάρτα» του γεγονότος είναι πάντα η πρώτη.
  const later = async () => {
    void trackOnboarding(supabase, { event: PRODUCT_EVENTS.welcome_later, card: 1 });
    await mark(); onClose();
  };
  const { panelRef } = useOverlayShell(true, later);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId} className="ob-scrim">
      <div ref={panelRef} tabIndex={-1} className="ob-card">
        <BrandLogo size={20} />

        <h2 id={titleId} style={{ ...TT.displaySm, margin: `${T.sp.xxl}px 0 0` }}>
          {greet ? `Καλώς ήρθες, ${greet}` : 'Καλώς ήρθες'}
        </h2>
        <p id={descId} style={{ ...TT.body, color: 'var(--text-secondary)', margin: `${T.sp.sm}px 0 0` }}>
          {`Το ${PRODUCT_NAME} δείχνει τον φόρο κάθε ακινήτου σου, βάζει μόνο του τις προθεσμίες στο ημερολόγιο και κρατά τα έγγραφα έτοιμα για τον λογιστή.`}
        </p>

        <ol className="ob-path" aria-label="Τι θα γίνει τώρα">
          {PATH.map(([title, sub], i) => (
            <li key={title} className="ob-path-row">
              <span className="ob-path-num" aria-hidden>{i + 1}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ ...TT.label, display: 'block', color: 'var(--text-primary)' }}>{title}</span>
                <span style={{ ...TT.caption, display: 'block', marginTop: 2 }}>{sub}</span>
              </span>
            </li>
          ))}
        </ol>

        <div style={{ display: 'grid', marginTop: T.sp.xxl }}>
          <Btn variant="primary" size="lg" onClick={addProperty}>Πρόσθεσε το πρώτο σου ακίνητο</Btn>
        </div>
        <div className="ob-quiet">
          {onMyaade && <Btn variant="ghost" onClick={myaade}>Από Ε9 ή ΕΝΦΙΑ, όλα μαζί</Btn>}
          <Btn variant="ghost" onClick={later}>Αργότερα</Btn>
        </div>
      </div>
    </div>
  );
}
