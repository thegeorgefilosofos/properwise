'use client';
// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΡΤΑ «ΟΛΑ ΤΑ ΑΚΙΝΗΤΑ ΜΑΖΙ», ΠΡΩΤΗ ΕΠΙΛΟΓΗ ΣΤΟ ΝΕΟ ΑΚΙΝΗΤΟ
// ─────────────────────────────────────────────────────────────────────────
// Απόφαση ιδιοκτήτη (09/11/2026): ο νέος χρήστης, χωρίς κανένα ακίνητο, βλέπει
// πρώτα τη μαζική καταχώρηση από το Ε9 ή την πράξη ΕΝΦΙΑ (MyaadeImport.tsx)
// και από κάτω την καταχώρηση με το χέρι. Μία πρόταση, μία ενέργεια: τα
// «πώς» και «τι κρατάμε» ζουν στο ίδιο το παράθυρο της εισαγωγής.
// ═══════════════════════════════════════════════════════════════════════════
import { FileStack } from 'lucide-react';
import { T, TT, Btn } from '@/components/Theme';
import { BULK_MAX } from '@/lib/myaade/planLimit';

export function BulkImportCard({ onStart }: { onStart: () => void }) {
  return (
    <section aria-label="Μαζική καταχώρηση" style={{
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: T.sp.md,
      padding: T.sp.lg, borderRadius: T.radius.inner, border: '1px solid var(--accent-border)', background: 'var(--accent-soft)',
    }}>
      <span style={{ display: 'flex', alignItems: 'flex-start', gap: T.sp.md, flex: '1 1 220px', minWidth: 0 }}>
        <FileStack size={20} aria-hidden style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ display: 'flex', flexDirection: 'column', gap: T.sp.xs, minWidth: 0 }}>
          <span style={{ ...TT.bodySm, fontWeight: 600, color: 'var(--text-primary)' }}>Όλα τα ακίνητά σου μαζί</span>
          <span style={{ ...TT.caption }}>{`Από το Ε9 ή την πράξη ΕΝΦΙΑ, σε PDF ή φωτογραφία. Έως ${BULK_MAX} με τη μία.`}</span>
        </span>
      </span>
      <Btn variant="primary" onClick={onStart}>Ανέβασε έγγραφο</Btn>
    </section>
  );
}
