// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΡΤΑ ΤΟΥ ΤΑΜΕΙΟΥ, ΚΟΙΝΗ ΓΙΑ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ ΚΑΙ ΓΙΑ ΤΟΝ ΠΕΡΙΗΓΗΤΗ
// ─────────────────────────────────────────────────────────────────────────
// Χωρίς `'use client'`, επίτηδες: τη χρησιμοποιούν και η σελίδα του διακομιστή
// (όταν η χρέωση δεν είναι ενεργή) και το CheckoutLanding.tsx (όταν είναι).
// Δύο αντίγραφα της ίδιας κάρτας θα απέκλιναν στην πρώτη αλλαγή.
// ═══════════════════════════════════════════════════════════════════════════
import type { CSSProperties, ReactNode } from 'react';
import BrandMark from '@/components/BrandMark';
import { T } from '@/components/tokens';

/** Ο τίτλος της κάρτας, στο μέγεθος των άλλων οθονών εισόδου. */
export const TAMEIO_TITLE: CSSProperties = {
  fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: `${T.sp.xl}px 0 0`,
};

/** Η μία ενέργεια της κάρτας. */
export const TAMEIO_ACTION: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: 20,
  borderRadius: T.radius.pill, background: 'var(--accent)', color: 'var(--accent-text)',
  fontSize: 14, fontWeight: 700, textDecoration: 'none',
};

export function TameioCard({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: T.font.sans, color: 'var(--text-primary)' }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: '30px 28px', boxShadow: 'var(--elev-1)' }}>
        {/* Ο ΚΥΡΙΟΣ ΤΙΤΛΟΣ ΗΤΑΝ ΛΕΖΑΝΤΑ 11 ΕΙΚΟΝΟΣΤΟΙΧΕΙΩΝ κάτω από το όνομα του
            προϊόντος: στο μάτι τίτλος ήταν το λογότυπο και ο αναγνώστης οθόνης
            άκουγε ως κεφαλίδα της σελίδας κάτι που έμοιαζε υπότιτλος. Το σήμα
            μένει απλό στοιχείο και ο τίτλος (TAMEIO_TITLE) παίρνει το μέγεθος
            των άλλων οθονών εισόδου. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: T.sp.xl, borderBottom: '1px solid var(--border-subtle)' }}>
          <BrandMark size={34} />
          <div style={{ fontSize: 15, fontWeight: 700 }}>PROPERWISE</div>
        </div>
        {children}
      </div>
    </div>
  );
}
