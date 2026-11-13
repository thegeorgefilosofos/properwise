'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΕΠΟΜΕΝΟ ΒΗΜΑ, ΑΜΕΣΩΣ ΚΑΤΩ ΑΠΟ ΤΟ ΑΠΟΤΕΛΕΣΜΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΕΛΕΙΠΕ (13/11/2026). Ο επισκέπτης έβγαζε τον ΕΝΦΙΑ του και η σελίδα
// σταματούσε εκεί: η μόνη πρόταση ζούσε στο τέλος, κάτω από τα ψιλά, γενική
// για όλους τους υπολογιστές. Τα δύο τρίτα των επισκέψεων έβλεπαν μία σελίδα
// και έφευγαν. Η στιγμή που ο αριθμός έχει αξία είναι αμέσως μετά τον αριθμό.
//
// ΕΝΑ ΗΣΥΧΟ ΣΤΟΙΧΕΙΟ, ΟΧΙ ΔΙΑΦΗΜΙΣΗ. Ιδιο πλάτος, ίδια ακτίνα και ίδιο
// εσωτερικό περιθώριο με την κάρτα του αποτελέσματος από πάνω, ώστε να
// διαβάζεται ως συνέχειά της. Μία πρόταση, το πολύ μία γραμμή κάτω της, ΕΝΑ
// κύριο κουμπί. Το «Τι σημαίνει αυτό» είναι δευτερεύον: σύνδεσμος κειμένου
// δίπλα στο κουμπί, ποτέ δεύτερο κουμπί.
//
// ΚΑΘΕ ΥΠΟΣΧΕΣΗ ΕΔΩ ΕΙΝΑΙ ΚΩΔΙΚΑΣ. Η φράση έρχεται από τη σελίδα, που ξέρει
// ποια προθεσμία γράφει το ημερολόγιο για αυτόν τον υπολογισμό (οι λόγοι στο
// lib/tools/calcCarry.ts) και η γραμμή του κόστους από το
// lib/legal/billingWords.ts. Εδώ μόνο η διάταξη και το πάτημα.
//
// ΤΟ ΠΑΤΗΜΑ ΓΡΑΦΕΙ ΤΟ ΠΡΟΧΕΙΡΟ ΚΑΙ ΜΕΤΑ ΦΕΥΓΕΙ. Οι τιμές μένουν στη συσκευή
// (lib/tools/calcDraft.ts)· η διεύθυνση λέει μόνο τι ζητήθηκε. Ο συνδεδεμένος
// πηγαίνει κατευθείαν στον πίνακα, ο επισκέπτης στην εγγραφή με συνέχεια τον
// πίνακα. Το «συνδεδεμένος» το λέει το cookie της συνεδρίας, χωρίς να φορτωθεί
// ο πελάτης της βάσης (lib/supabase/lazy.ts): η σελίδα μένει ελαφριά.
// ═══════════════════════════════════════════════════════════════════════════
import Link from 'next/link';
import { useId, useSyncExternalStore } from 'react';
import { T } from '@/components/tokens';
import { mayHaveSession } from '@/lib/supabase/lazy';
import { saveCalcDraft, type CalcTool } from '@/lib/tools/calcDraft';
import { ToolMeaning, ToolMeaningLink } from './ToolMeaning';

export interface ToolSave {
  tool: CalcTool;
  /** Οι τιμές του υπολογιστή όπως είναι τώρα· γράφονται μόνο όσα άλλαξαν. */
  values: Readonly<Record<string, string>>;
  /** Για επισκέπτη: η εγγραφή με συνέχεια τον πίνακα. */
  signupHref: string;
  /** Για συνδεδεμένο: ο πίνακας, που ανοίγει τον οδηγό. */
  appHref: string;
}

// Το cookie δεν ειδοποιεί όταν αλλάζει· διαβάζεται σε κάθε απόδοση και στον
// διακομιστή απαντά πάντα «όχι», ώστε η ενυδάτωση να ξεκινά από το ίδιο σημείο.
const noSubscribe = () => () => {};
const signedOut = () => false;

/** Η λέξη του κύριου κουμπιού, ίδια σε κάθε υπολογιστή. */
const SAVE_LABEL = 'Αποθήκευσε το ακίνητο';

export function ToolNextStep({ title, line, save, meaning }: {
  /** Μία σύντομη πρόταση: τι κερδίζει όποιος αποθηκεύσει. */
  title?: string;
  /** Το πολύ μία γραμμή από κάτω. */
  line?: string;
  /** Χωρίς αυτό μένει μόνο ο σύνδεσμος του οδηγού. */
  save?: ToolSave;
  /** Ο οδηγός «Τι σημαίνει αυτό» (lib/core/publicTools.ts, `meaning`). */
  meaning?: string;
}) {
  const id = useId();
  // Στην πρώτη απόδοση, στον διακομιστή και στον περιηγητή, πάντα η εγγραφή:
  // το cookie διαβάζεται μετά την ενυδάτωση και αλλάζει μόνο ο προορισμός,
  // όχι το κείμενο ή το μέγεθος του κουμπιού.
  const signedIn = useSyncExternalStore(noSubscribe, mayHaveSession, signedOut);

  if (!save || !title) return <ToolMeaning href={meaning} />;

  return (
    <section className="po-noprint po-next" aria-labelledby={id} style={{
      marginTop: T.sp.md, padding: 'clamp(18px, 4vw, 26px)', borderRadius: T.radius.card,
      background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
    }}>
      <p id={id} className="po-next-title">{title}</p>
      {line && <p className="po-next-line">{line}</p>}
      <div className="po-next-acts">
        <Link
          href={signedIn ? save.appHref : save.signupHref}
          // Το πρόχειρο γράφεται ΠΡΙΝ φύγει η σελίδα. Αν η συσκευή δεν το
          // κρατήσει (ιδιωτικό παράθυρο), η διαδρομή μένει ίδια και ο οδηγός
          // απλώς ανοίγει κενός: τίποτα δεν σπάει.
          onClick={() => { saveCalcDraft(save.tool, save.values); }}
          className="lp-cta lp-primary po-next-go"
          style={{ height: T.h.lg, padding: '0 24px', borderRadius: T.radius.pill, textDecoration: 'none' }}
        >
          {SAVE_LABEL}
        </Link>
        {meaning && <ToolMeaningLink href={meaning} />}
      </div>
    </section>
  );
}
