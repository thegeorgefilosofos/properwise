// ═══════════════════════════════════════════════════════════════════════════
// /verify ΧΩΡΙΣ ΚΩΔΙΚΟ, η πόρτα για όποιον έχει το χαρτί και όχι το QR
// ─────────────────────────────────────────────────────────────────────────
// Ο διαμεσολαβητής άφηνε δημόσιο μόνο το «/verify/…». Ο υπάλληλος τράπεζας που
// πληκτρολογούσε τη σύντομη διεύθυνση από ένα εκτυπωμένο έγγραφο έπεφτε στη
// φόρμα «Καλώς όρισες ξανά», δηλαδή σε σύνδεση λογαριασμού που δεν έχει και
// δεν χρειάζεται. Εδώ γράφει τον κωδικό του εγγράφου και πηγαίνει στην ίδια
// σελίδα που ανοίγει και το QR. Εκτός ευρετηρίου, όπως κάθε σελίδα επαλήθευσης.
// ═══════════════════════════════════════════════════════════════════════════
import Link from 'next/link';
import { StandaloneCard, CARD_TITLE } from '../StandaloneCard';
import { noindexPage } from '@/lib/seo/noindex';
import VerifyLookup from './VerifyLookup';

export const metadata = noindexPage('Επαλήθευση εγγράφου', 'Έλεγχος γνησιότητας εγγράφου που εκδόθηκε από το PROPERWISE, με τον κωδικό του.');

export default function VerifyPage() {
  return (
    <StandaloneCard>
      {/* Η κοινή κάρτα του ταμείου (app/StandaloneCard.tsx): λογότυπο της
          κεφαλίδας και τίτλος 24, όπως στο /verify/<κωδικός>. */}
      <h1 style={CARD_TITLE}>Επαλήθευση γνησιότητας εγγράφου</h1>
      <VerifyLookup />

      <p style={{ fontSize: 13, lineHeight: 1.6, margin: '20px 0 0' }}>
        <Link href="/privacy" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Πολιτική απορρήτου</Link>
      </p>
    </StandaloneCard>
  );
}
