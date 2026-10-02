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
import { Btn } from '@/components/Theme';
import { billingWords } from '@/lib/legal/billingWords';
import { merchant } from '@/lib/billing/merchant';
import CheckoutLanding from './CheckoutLanding';
import { StandaloneCard, CARD_TITLE, CARD_BODY } from '../StandaloneCard';

export default function Page() {
  const w = billingWords();
  if (w.live) return <CheckoutLanding firstCharge={w.firstCharge} moneyBack={w.moneyBack} securedBy={w.securedBy} securedHref={merchant().site} securedLead={w.securedByLead} securedLogo={merchant().logo}/>;
  return (
    <StandaloneCard>
      <h1 style={CARD_TITLE}>Δεν χρειάζεται πληρωμή</h1>
      <p style={CARD_BODY}>
        {w.firstCharge} Όταν ενεργοποιηθεί, το πακέτο το διαλέγεις από τον «Λογαριασμό».
      </p>
      <div style={{ marginTop: 24, display: 'grid' }}><Btn variant="primary" field href="/dashboard">Συνέχεια στην εφαρμογή</Btn></div>
    </StandaloneCard>
  );
}
