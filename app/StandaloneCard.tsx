// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΥΤΟΤΕΛΗΣ ΚΑΡΤΑ: ΤΑΜΕΙΟ ΚΑΙ ΕΠΑΛΗΘΕΥΣΗ ΕΓΓΡΑΦΟΥ, ΜΙΑ ΠΡΟΔΙΑΓΡΑΦΗ
// ─────────────────────────────────────────────────────────────────────────
// Χωρίς `'use client'`, επίτηδες: τη χρησιμοποιούν σελίδες του διακομιστή
// (/tameio όταν η χρέωση δεν είναι ενεργή, /verify) και το CheckoutLanding.tsx
// στον περιηγητή.
//
// ΓΙΑΤΙ ΕΓΙΝΕ ΚΟΙΝΗ (01.10.2026). Το ταμείο και η επαλήθευση είναι οι δύο
// σελίδες με μία κάρτα στη μέση της οθόνης και ήταν δύο διαφορετικές κάρτες:
// 440 με γέμισμα 30/28 η μία, 460 με 30/30/26 η άλλη· τίτλος 24 στο ταμείο, 16
// στην επαλήθευση· σήμα 34 με λέξη 15 στη μία, σήμα 34 με δύο γραμμές κεφαλαίων
// στην άλλη. Και ο τίτλος του ταμείου, χωρίς δικό του ύψος γραμμής, έπαιρνε το
// 1,5 του σώματος και στα 360 έσπαγε σε δύο αραιές σειρές.
//
// Τώρα: πλάτος 440, γέμισμα 28 (24 στο τηλέφωνο), το λογότυπο της κεφαλίδας
// της βιτρίνας, τίτλος 24 με ύψος γραμμής 1,2 και σώμα 15 σε κάθε πλάτος.
// Στο σκούρο της βιτρίνας και με το σχήμα κουμπιού της (`po-standalone`).
// ═══════════════════════════════════════════════════════════════════════════
import type { CSSProperties, ReactNode } from 'react';
import { BrandLogo } from '@/components/BrandMark';
import { T } from '@/components/tokens';

/** Ο τίτλος της κάρτας. */
export const CARD_TITLE: CSSProperties = {
  fontSize: 24, fontWeight: 700, lineHeight: 1.2, color: 'var(--text-primary)', letterSpacing: '-0.02em',
  margin: `${T.sp.xl}px 0 0`, textWrap: 'balance',
};

/** Το κείμενο της κάρτας: 15 σε κάθε πλάτος, ίδιο με το σώμα της βιτρίνας. */
export const CARD_BODY: CSSProperties = {
  fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '12px 0 0', textWrap: 'pretty',
};

/** Το ψιλό κείμενο της κάρτας, κάτω από ενέργειες και επιλογές. */
export const CARD_NOTE: CSSProperties = {
  fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.55, margin: '14px 0 0',
};

export function StandaloneCard({ children }: { children: ReactNode }) {
  return (
    <main className="pub-root po-standalone" data-mode="dark" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(16px, 4vw, 24px)', fontFamily: T.font.sans }}>
      <div className="po-standalone-card">
        {/* Το σήμα με τη λέξη, όπως στην κεφαλίδα: όχι τίτλος, απλό στοιχείο. */}
        <div style={{ paddingBottom: T.sp.lg, borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
          <BrandLogo />
        </div>
        {children}
      </div>
    </main>
  );
}
