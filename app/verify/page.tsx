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
import type { Metadata } from 'next';
import { StandaloneCard, CARD_TITLE } from '../StandaloneCard';
import { noindexPage } from '@/lib/seo/noindex';
import { requestLocale } from '@/lib/i18n/serverLocale';
import { VERIFY_EN, LINK_EN } from '@/lib/i18n/en/recipients';
import LangSwitcher from '../LangSwitcher';
import VerifyLookup from './VerifyLookup';

// ΙΔΙΑ ΔΙΕΥΘΥΝΣΗ ΚΑΙ ΣΤΑ ΑΓΓΛΙΚΑ (lib/i18n/locale.ts, isRecipientPath): το
// κείμενο το διαλέγει ο διακομιστής· στη φόρμα φτάνουν μόνο οι λέξεις της.
export async function generateMetadata(): Promise<Metadata> {
  return (await requestLocale()) === 'en'
    ? noindexPage(VERIFY_EN.title, VERIFY_EN.metaDescription)
    : noindexPage('Επαλήθευση εγγράφου', 'Έλεγχος ότι ένα έγγραφο είναι καταχωρημένο στο μητρώο του PROPERWISE, με τον αριθμό του.');
}

export default async function VerifyPage() {
  const en = (await requestLocale()) === 'en';
  return (
    <StandaloneCard aside={<LangSwitcher place="bar" here={en ? 'en' : 'el'} />}>
      {/* Η κοινή κάρτα του ταμείου (app/StandaloneCard.tsx): λογότυπο της
          κεφαλίδας και τίτλος 24, όπως στο /verify/<κωδικός>. */}
      <h1 style={CARD_TITLE}>{en ? VERIFY_EN.title : 'Επαλήθευση εγγράφου'}</h1>
      <VerifyLookup en={en ? { printed: VERIFY_EN.printed, label: VERIFY_EN.codeLabel, missing: VERIFY_EN.codeMissing, check: VERIFY_EN.check } : undefined} />

      <p style={{ fontSize: 13, lineHeight: 1.6, margin: '20px 0 0' }}>
        <Link href={en ? '/en/privacy' : '/privacy'} className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none' }}>{en ? LINK_EN.privacyPolicy : 'Πολιτική απορρήτου'}</Link>
      </p>
    </StandaloneCard>
  );
}
