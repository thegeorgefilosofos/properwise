'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΤΙΚ ΤΩΝ ΟΡΩΝ ΕΠΕΞΕΡΓΑΣΙΑΣ ΤΟΥ ΓΡΑΦΕΙΟΥ
// ─────────────────────────────────────────────────────────────────────────
// Ενα κείμενο, μία θέση στον κώδικα: στην αποδοχή πρόσκλησης και στην
// ανανέωση της αποδοχής. Η βάση (20261108090000) δεν δείχνει πελάτη σε γραφείο
// ή μέλος χωρίς την τρέχουσα αποδοχή· το τικ δεν είναι διακόσμηση.
// Ετικέτα για το κουτί και χωριστή για το κείμενο: ο σύνδεσμος δεν τσεκάρει.
// ═══════════════════════════════════════════════════════════════════════════
import Link from 'next/link';

export const FIRM_TERMS_NEEDED = 'Χρειάζεται να αποδεχτείς τους όρους επεξεργασίας.';

export default function FirmTermsCheck({ id, checked, onChange }: { id: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <input id={id} type="checkbox" className="po-check" checked={checked} aria-required="true"
        onChange={e => onChange(e.target.checked)} style={{ marginTop: 6, flexShrink: 0 }} />
      {/* Ο ΣΤΟΧΟΣ ΕΙΝΑΙ ΚΟΥΤΙ ΚΑΙ ΕΤΙΚΕΤΑ ΜΑΖΙ· ΧΡΕΙΑΖΕΤΑΙ 44. Δύο γραμμές των
          13 με διάστιχο 1,5 έδιναν 39 στα 390· τα 4 πάνω και κάτω τον φέρνουν
          στο δάπεδο χωρίς να αλλάξει το κείμενο. */}
      <label htmlFor={id} style={{ display: 'block', padding: '4px 0', fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 1.5, cursor: 'pointer' }}>
        Αποδέχομαι τους{' '}
        <Link href="/terms#grafeia" className="lp-link po-tap-inline" target="_blank"
          style={{ color: 'var(--accent)', textDecorationLine: 'underline', textUnderlineOffset: 3, fontWeight: 600 }}>
          όρους επεξεργασίας
        </Link>{' '}
        για λογαριασμό των πελατών του γραφείου.
      </label>
    </div>
  );
}
