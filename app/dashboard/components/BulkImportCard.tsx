'use client';
// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΡΤΑ «ΟΛΑ ΤΑ ΑΚΙΝΗΤΑ ΜΑΖΙ», ΠΡΩΤΗ ΕΠΙΛΟΓΗ ΣΤΟ ΝΕΟ ΑΚΙΝΗΤΟ
// ─────────────────────────────────────────────────────────────────────────
// Απόφαση ιδιοκτήτη (10/11/2026): σε ΚΑΘΕ νέα καταχώρηση, με ή χωρίς ακίνητα,
// το πρώτο βήμα δείχνει πρώτα τη μαζική καταχώρηση από το Ε9 ή την πράξη ΕΝΦΙΑ
// (MyaadeImport.tsx) και από κάτω την καταχώρηση με το χέρι. Ως τις 09/11
// φαινόταν μόνο χωρίς κανένα ακίνητο. Μία πρόταση, μία ενέργεια: τα «πώς» και
// «τι κρατάμε» ζουν στο ίδιο το παράθυρο της εισαγωγής.
//
// ΟΤΑΝ ΥΠΑΡΧΟΥΝ ΗΔΗ ΑΚΙΝΗΤΑ, η κάρτα λέει ακριβώς ό,τι κάνει η εισαγωγή
// (lib/myaade/match.ts): ίδιος ΑΤΑΚ → «υπάρχει», ίδια διεύθυνση σε ακίνητο
// χωρίς ΑΤΑΚ → «Ίσως υπάρχει» και ερώτηση. ΔΕΝ υπόσχεται «ποτέ διπλό»: ακίνητο
// χωρίς ΑΤΑΚ και με άλλη γραφή διεύθυνσης φαίνεται νέο. Γι' αυτό η δεύτερη
// πρόταση στέλνει τον χρήστη στη λίστα, που βλέπει πριν από κάθε καταχώρηση.
// ═══════════════════════════════════════════════════════════════════════════
import { FileStack } from 'lucide-react';
import { T, TT, Btn } from '@/components/Theme';
import { BULK_MAX } from '@/lib/myaade/planLimit';

export function BulkImportCard({ onStart, hasProperties = false }: { onStart: () => void; hasProperties?: boolean }) {
  return (
    <section aria-label="Μαζική καταχώρηση" style={{
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: T.sp.md,
      padding: T.sp.lg, borderRadius: T.radius.inner, border: '1px solid var(--accent-border)', background: 'var(--accent-soft)',
    }}>
      <span style={{ display: 'flex', alignItems: 'flex-start', gap: T.sp.md, flex: '1 1 220px', minWidth: 0 }}>
        <FileStack size={20} aria-hidden style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ display: 'flex', flexDirection: 'column', gap: T.sp.xs, minWidth: 0 }}>
          <span style={{ ...TT.bodySm, fontWeight: 600, color: 'var(--text-primary)' }}>Όλα τα ακίνητά σου μαζί</span>
          <span style={{ ...TT.caption }}>{`Από το Ε9 ή την πράξη ΕΝΦΙΑ, σε PDF ή φωτογραφία. Έως ${BULK_MAX} με τη μία.${hasProperties ? ' Όσα έχεις ήδη τα ψάχνουμε με τον ΑΤΑΚ ή τη διεύθυνση. Ελέγχεις τη λίστα πριν από κάθε καταχώρηση.' : ''}`}</span>
        </span>
      </span>
      <Btn variant="primary" onClick={onStart}>Ανέβασε έγγραφο</Btn>
    </section>
  );
}
