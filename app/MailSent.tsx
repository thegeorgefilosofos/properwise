'use client';

// ═══════════════════════════════════════════════════════════════════════════
// Η ΟΘΟΝΗ «ΣΟΥ ΣΤΕΙΛΑΜΕ EMAIL», ΜΙΑ ΦΟΡΑ ΓΙΑ ΟΛΕΣ ΤΙΣ ΡΟΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Η ΜΟΡΦΗ ΜΕΝΕΙ ΟΠΩΣ ΤΗΝ ΞΕΡΕΙ Ο ΧΡΗΣΤΗΣ: σήμα, τίτλος, κείμενο και κουμπί στο
// κέντρο. Αλλάζει μόνο ό,τι την έκανε να φαίνεται πρόχειρη (φωτογραφημένο από
// τον ιδιοκτήτη, 28.09.2026):
//
//   · ΤΟ ΚΕΙΜΕΝΟ ΠΕΡΑ ΠΕΡΑ, ΜΕ ΤΗΝ ΤΕΛΕΥΤΑΙΑ ΓΡΑΜΜΗ ΣΤΟ ΚΕΝΤΡΟ (`po-just-c`).
//     Κεντραρισμένη παράγραφος έδινε κάθε γραμμή με άλλο μήκος.
//   · Η ΔΙΕΥΘΥΝΣΗ ΣΕ ΔΙΚΟ ΤΗΣ ΣΗΜΑ, ΚΑΤΩ ΑΠΟ ΤΟΝ ΤΙΤΛΟ. Μέσα στην πρόταση
//     έσπαγε στη μέση και τραβούσε μαζί της τις διπλανές λέξεις· σε δική της
//     γραμμή ανάμεσα σε δύο παραγράφους, η πρώτη έβγαινε στενότερη από τη
//     δεύτερη. Ως σήμα ελέγχεται με μια ματιά και το κείμενο γίνεται ΜΙΑ
//     παράγραφος με τις άκρες του κουμπιού.
//   · ΤΟ ΚΟΥΜΠΙ ΣΤΟ ΠΛΑΤΟΣ ΤΗΣ ΣΤΗΛΗΣ, ώστε να έχει τις ίδιες άκρες με το
//     κείμενο από πάνω του αντί να κρέμεται στη μέση.
//   · Η ΤΕΛΕΥΤΑΙΑ ΦΡΑΣΗ ΔΕΝ ΚΟΒΕΤΑΙ. Με συλλαβισμό, το «ανεπιθύμητων» έσπαγε
//     και άφηνε μόνο του το «μητων.» στην κεντραρισμένη τελευταία γραμμή.
//     Οι σελίδες που καλούν κρατούν ενωμένη την τελευταία λέξη με `nowrap`·
//     ολόκληρη η φράση άνοιγε ποτάμια στην προτελευταία γραμμή.
//   · ΙΔΙΑ ΟΨΗ ΣΤΗΝ ΕΓΓΡΑΦΗ ΚΑΙ ΣΤΗΝ ΕΠΑΝΑΦΟΡΑ ΚΩΔΙΚΟΥ. Είχαν η καθεμία δικό
//     της αντίγραφο, με άλλο τίτλο και άλλες αποστάσεις.
// ═══════════════════════════════════════════════════════════════════════════
import type { ReactNode } from 'react';
import { T } from '@/components/Theme';
import { hy } from '@/components/Hyphen';

const PARA = { fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 } as const;

export default function MailSent({ title, email, body, action, footer }: {
  title: string;
  email: string;
  /** Μία παράγραφος: τι στάλθηκε και τι κάνει ο χρήστης. */
  body: ReactNode;
  /** Η κύρια ενέργεια, στο πλάτος της στήλης. */
  action?: ReactNode;
  /** Η γραμμή κάτω από την ενέργεια: διόρθωση διεύθυνσης, σύνδεση. */
  footer: ReactNode;
}) {
  return (
    <div role="status" style={{ textAlign: 'center' }}>
      <div aria-hidden="true" style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-soft)',
        border: '1px solid var(--accent-border)', color: 'var(--accent)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', margin: `0 auto ${T.sp.xl}px` }}>
        <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 6 12 13 2 6" />
        </svg>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: `0 0 ${T.sp.md}px` }}>
        {title}
      </h1>

      <div style={{ display: 'inline-block', maxWidth: '100%', padding: '6px 14px', borderRadius: T.radius.pill,
        border: '1px solid var(--border-default)', fontSize: 14, fontWeight: 600, lineHeight: 1.5,
        color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
        {email}
      </div>

      <p className="po-just-c" style={{ ...PARA, marginTop: T.sp.lg }}>{hy(body)}</p>

      {action && <div style={{ marginTop: T.sp.xxl, display: 'grid' }}>{action}</div>}

      <p style={{ margin: `${T.sp.lg}px 0 0`, fontSize: 13, lineHeight: 1.6, color: 'var(--text-tertiary)' }}>
        {footer}
      </p>
    </div>
  );
}
