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
import BrandMark from '@/components/BrandMark';
import { T } from '@/components/tokens';
import { noindexPage } from '@/lib/seo/noindex';
import VerifyLookup from './VerifyLookup';

export const metadata = noindexPage('Επαλήθευση εγγράφου', 'Έλεγχος γνησιότητας εγγράφου που εκδόθηκε από το PROPERWISE, με τον κωδικό του.');

export default function VerifyPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: T.font.sans, color: 'var(--text-primary)' }}>
      <div style={{ width: '100%', maxWidth: 460, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: '30px 30px 26px', boxShadow: 'var(--elev-1)' }}>
        {/* Η ίδια κεφαλίδα με το /verify/<κωδικός>: σήμα και, από κάτω, ο τίτλος. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: T.sp.lg, borderBottom: '1px solid var(--border-subtle)' }}>
          <BrandMark size={34} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>PROPERWISE</div>
            <h1 style={{ fontSize: 16, color: 'var(--text-primary)', fontWeight: 700, lineHeight: 1.3, margin: '2px 0 0', textWrap: 'balance' }}>Επαλήθευση γνησιότητας εγγράφου</h1>
          </div>
        </div>

        <VerifyLookup />

        <p style={{ fontSize: 12, lineHeight: 1.6, margin: '20px 0 0' }}>
          <Link href="/privacy" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Πολιτική απορρήτου</Link>
        </p>
      </div>
    </main>
  );
}
