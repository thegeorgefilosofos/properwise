// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΤΑΜΕΙΟ ΡΩΤΑ ΠΡΩΤΑ ΑΝ ΥΠΑΡΧΕΙ ΧΡΕΩΣΗ ΝΑ ΑΝΟΙΞΕΙ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ. Με τη χρέωση ανενεργή, η οθόνη ζητούσε να διαλέξεις πακέτο, με
// τιμές και κύκλο χρέωσης· σε ΚΑΘΕ πάτημα απαντούσε «Η πληρωμή δεν άνοιξε
// αυτή τη στιγμή». Όσο ο έμπορος δεν είναι ενεργός αυτό δεν είναι αποτυχία,
// είναι η κατάσταση: δεν ρωτάμε τίποτα και λέμε ευθέως ότι δεν χρειάζεται
// πληρωμή, με τις λέξεις που λένε το ίδιο στους Όρους και στην εγγραφή
// (lib/legal/billingWords.ts, διαβάζεται μόνο στον διακομιστή).
//
// Όταν η χρέωση είναι ενεργή, όλη η δουλειά γίνεται στον περιηγητή και ο λόγος
// γράφεται στο CheckoutLanding.tsx.
// ═══════════════════════════════════════════════════════════════════════════
import Link from 'next/link';
import { billingWords } from '@/lib/legal/billingWords';
import CheckoutLanding from './CheckoutLanding';
import { TameioCard, TAMEIO_TITLE, TAMEIO_ACTION } from './TameioCard';

export default function Page() {
  const w = billingWords();
  if (w.live) return <CheckoutLanding/>;
  return (
    <TameioCard>
      <h1 style={TAMEIO_TITLE}>Δεν χρειάζεται πληρωμή</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '14px 0 0' }}>
        {w.firstCharge} Όταν ενεργοποιηθεί, το πακέτο το διαλέγεις από τις Ρυθμίσεις.
      </p>
      <Link href="/dashboard" style={TAMEIO_ACTION}>Συνέχεια στην εφαρμογή</Link>
    </TameioCard>
  );
}
