// ═══════════════════════════════════════════════════════════════════════════
// ΕΞΟΔΑ ΑΓΟΡΑΣ ΑΚΙΝΗΤΟΥ: η δημόσια σελίδα
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Πριν από τη δόση ο αγοραστής ρωτά «πόσα θα δώσω πάνω από την
// τιμή». Η εφαρμογή το απαντούσε μόνο μέσα στην καρτέλα Δάνειο, με κλίμακες και
// πάγια που η ίδια σημειώνει «ενδεικτικά». Εδώ η απάντηση είναι δημόσια και
// κάθε ποσό λέει την πηγή του: ό,τι δεν έχει επαληθευμένη επίσημη πηγή δεν
// γράφεται ως αριθμός, γράφεται από τον χρήστη.
//
// ΟΙ ΠΗΓΕΣ, ΕΛΕΓΜΕΝΕΣ ΣΤΙΣ 27/10/2026:
//   · φόρος μεταβίβασης 3% και 3% υπέρ Δήμων, βάση η μεγαλύτερη αξία, απαλλαγή
//     πρώτης κατοικίας: ν.5219/2025 (ΦΕΚ Α΄ 130/2025), άρθρα 24, 25, 27, 40 έως 44·
//   · ΦΠΑ 24% στο τίμημα του νεόδμητου και αναστολή με αίτηση του κατασκευαστή:
//     Κώδικας ΦΠΑ (ΦΕΚ Α΄ 162/2024), άρθρα 24, 26, 70· προθεσμία από το άρθρο
//     12 ν.5246/2025 και το μητρώο ισχύος (`new-build-vat-suspension`)·
//   · τέλη Κτηματολογίου: ΔΕΝ υπολογίζονται. Το 5‰ της ΚΥΑ 2/2026 (ΦΕΚ Β΄
//     64/2026) δεν επαληθεύτηκε στο επίσημο κείμενο· τα γράφει ο χρήστης.
//
// Η σελίδα είναι Server Component (για SEO και ταχύτητα)· μόνο ο υπολογιστής
// είναι πελάτης και ο υπολογισμός γίνεται στη συσκευή.
// ═══════════════════════════════════════════════════════════════════════════
import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { T } from '@/components/tokens';
import { siteUrl } from '@/lib/core/site';
import { athensToday } from '@/lib/core/time';
import { fe, feWhole, fpRate } from '@/lib/core/format';
import {
  TRANSFER_TAX_RATE, NEW_BUILD_VAT_SUSPENDED_UNTIL, firstHomeExemption,
} from '@/lib/accounting/transfer';
import { purchaseCosts } from '@/lib/tools/exodaAgoras';
import { PublicHeader, PublicFooter, JsonLd, SectionHead, ToolLede, ToolSources, ToolCta, TOOL_PRIVACY_FAQ, WRAP, WRAP_PAD } from '../PublicChrome';
import { ToolGuides } from '../odigos/ToolGuides';
import { hy } from '@/components/Hyphen';
import { BackLink } from '../BackLink';
import { shareImage } from '../og/share';
import { publicMetadata } from '../publicMetadata';
import { PAGE_UPDATED } from '../pageUpdated';
import { ToolLedger } from '../ToolParts';
import { toolJsonLd, ToolByline } from '../toolSeo';
import { PurchaseCostsCalculator } from './PurchaseCostsCalculator';
import { SPEC, PATH, purchaseInputOf } from './spec';
import { ledgerRows, MAIN_PCT, MUNICIPAL_PCT, VAT_PCT, SERVICES_VAT_PCT } from './lines';

const URL = siteUrl(PATH);
const TOTAL_PCT = fpRate(TRANSFER_TAX_RATE * 100);
const TITLE = 'Έξοδα αγοράς ακινήτου: φόρος μεταβίβασης και όλα τα κόστη';
const DESC = `Φόρος μεταβίβασης (${TOTAL_PCT}), ΦΠΑ νεόδμητου, τέλη, αμοιβές και πόσα μετρητά θέλει η αγορά `
  + 'εκτός δανείου, με την πηγή κάθε ποσού. Δωρεάν, χωρίς εγγραφή.';

export function generateMetadata(): Metadata {
  return publicMetadata({ title: TITLE, description: DESC, url: URL, image: shareImage('exoda-agoras-akinitou') });
}

const LINK = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } as const;
const PROSE = { fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 } as const;

// ΤΑ ΟΡΙΑ ΤΗΣ ΑΠΑΛΛΑΓΗΣ ΑΠΟ ΤΗ ΣΥΝΑΡΤΗΣΗ ΠΟΥ ΤΑ ΕΦΑΡΜΟΖΕΙ, ΟΧΙ ΓΡΑΜΜΕΝΑ ΕΔΩ.
const SINGLE = firstHomeExemption({ married: false });
const MARRIED = firstHomeExemption({ married: true });
const KID = firstHomeExemption({ married: false, children: 1 }) - SINGLE;
const THIRD_KID = firstHomeExemption({ married: false, children: 3 }) - firstHomeExemption({ married: false, children: 2 });

// ΤΟ ΛΥΜΕΝΟ ΠΑΡΑΔΕΙΓΜΑ ΕΙΝΑΙ Η ΠΡΟΕΠΙΛΟΓΗ ΤΗΣ ΦΟΡΜΑΣ, ΑΠΟ ΤΗΝ ΙΔΙΑ ΜΗΧΑΝΗ.
const EX = purchaseCosts(purchaseInputOf(SPEC));

function faq(vatUntil: string): { q: string; a: string }[] {
  return [
    {
      q: 'Πόσος είναι ο φόρος μεταβίβασης ακινήτου;',
      a: `${MAIN_PCT} επί της φορολογητέας αξίας, δηλαδή της μεγαλύτερης από το τίμημα και την αντικειμενική αξία, `
       + `συν πρόσθετος φόρος ${MUNICIPAL_PCT} επί του φόρου υπέρ των Δήμων: συνολικά ${TOTAL_PCT} της αξίας. `
       + 'Τον πληρώνει ο αγοραστής (ν.5219/2025, άρθρα 24, 25 και 27).',
    },
    {
      q: 'Ποια είναι τα όρια της απαλλαγής πρώτης κατοικίας;',
      a: `Για αγορά κατοικίας η αξία απαλλάσσεται έως ${feWhole(SINGLE)} για τον άγαμο και έως ${feWhole(MARRIED)} `
       + `για τον έγγαμο ή το μέρος συμφώνου συμβίωσης, συν ${feWhole(KID)} για καθένα από τα δύο πρώτα τέκνα και `
       + `${feWhole(THIRD_KID)} για το τρίτο και κάθε επόμενο (ν.5219/2025, άρθρο 41). Πάνω από το όριο ο φόρος `
       + 'υπολογίζεται μόνο στη διαφορά. Η απαλλαγή έχει προϋποθέσεις: ανάμεσά τους να μην έχεις ήδη κατοικία '
       + 'που καλύπτει τις στεγαστικές ανάγκες της οικογένειας και να κρατήσεις το ακίνητο τουλάχιστον πέντε χρόνια (άρθρα 40 και 44).',
    },
    {
      q: 'Πληρώνω ΦΠΑ σε νεόδμητο;',
      a: `Στην αγορά νεόδμητου από κατασκευαστή ο ΦΠΑ είναι ${VAT_PCT} στο τίμημα (Κώδικας ΦΠΑ, άρθρα 24 και 26). `
       + `Με αίτηση του κατασκευαστή η εφαρμογή του ΦΠΑ αναστέλλεται έως ${vatUntil} και πληρώνεις φόρο μεταβίβασης `
       + 'αντί για ΦΠΑ (άρθρο 70, όπως ισχύει μετά τον ν.5246/2025). Ρώτα τον πωλητή αν έχει υπαχθεί στην αναστολή.',
    },
    {
      q: 'Πόσα είναι τα τέλη του Κτηματολογίου;',
      a: 'Ο υπολογιστής δεν βάζει δικό του ποσό για τα τέλη του Κτηματολογίου, '
       + 'γιατί ο συντελεστής δεν επαληθεύτηκε στο επίσημο κείμενο: γράψε το ποσό που δίνει το Κτηματολόγιο '
       + 'ή ο συμβολαιογράφος.',
    },
    {
      q: 'Πόσο κοστίζουν μεσίτης, συμβολαιογράφος και δικηγόρος;',
      a: 'Ο υπολογιστής δεν βάζει δικό του ποσό για αυτές τις αμοιβές: δεν βρέθηκε επίσημη πηγή που να '
       + 'επαληθεύεται για ποσό ή ποσοστό. Γράψε τα ποσά των προσφορών σου χωρίς ΦΠΑ και ο υπολογιστής '
       + `προσθέτει ΦΠΑ ${SERVICES_VAT_PCT}. Όσα μένουν μηδέν λέγονται κάτω από την ανάλυση.`,
    },
    {
      q: 'Πόσα μετρητά χρειάζομαι αν πάρω δάνειο;',
      a: 'Την ίδια συμμετοχή στο τίμημα και όλα τα έξοδα της αγοράς, αν το δάνειο πηγαίνει μόνο στο τίμημα. '
       + `Στο παράδειγμα, τίμημα ${fe(EX.price)} με δάνειο ${fe(EX.loan)} θέλει ${fe(EX.downPayment)} ίδια συμμετοχή `
       + `και ${fe(EX.total)} φόρο μεταβίβασης: ${fe(EX.cashNeeded)} μετρητά, πριν από τα τέλη του Κτηματολογίου και τις αμοιβές.`,
    },
    TOOL_PRIVACY_FAQ,
  ];
}

export default function Page() {
  const today = athensToday();
  const FAQ = faq(NEW_BUILD_VAT_SUSPENDED_UNTIL);
  const jsonLd = toolJsonLd({ name: 'Έξοδα αγοράς ακινήτου', url: URL, description: DESC, faq: FAQ });

  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={jsonLd} />

      <PublicHeader />

      <main style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <BackLink />
        <div className="lp-eyebrow">Υπολογιστής</div>
        <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: T.weight.bold, letterSpacing: '-0.035em',
          lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
          {TITLE}
        </h1>
        <ToolLede>Ο φόρος μεταβίβασης, τα τέλη και οι αμοιβές της αγοράς, γραμμή γραμμή με την πηγή τους. Μαζί, πόσα μετρητά χρειάζεσαι εκτός δανείου.</ToolLede>

        {/* Ο υπολογιστής διαβάζει τη διεύθυνση, άρα θέλει όριο αναμονής: χωρίς
            αυτό ολόκληρη η σελίδα βγαίνει από τη στατική απόδοση. */}
        <Suspense fallback={<div style={{ minHeight: 900 }} aria-hidden/>}>
          <PurchaseCostsCalculator today={today} vatUntil={NEW_BUILD_VAT_SUSPENDED_UNTIL} cta={
            <ToolCta
              title="Θέλεις να κρατάς μαζί τα έξοδα, το δάνειο και το ακίνητο;"
              body="Το PROPERWISE κρατά τα έξοδα της αγοράς, το δάνειο και τα παραστατικά του ακινήτου σε ένα σημείο, έτοιμα για τον λογιστή σου."
            />
          }/>
        </Suspense>

        <ToolSources kind="buy" checked={null} updated={PAGE_UPDATED[PATH]} />

        {/* ── ΛΥΜΕΝΟ ΠΑΡΑΔΕΙΓΜΑ ─────────────────────────────────────────────
            Η προεπιλογή της φόρμας, από την ίδια μηχανή και την ίδια ανάλυση
            (`ledgerRows`): ό,τι διαβάζεται εδώ είναι ό,τι δείχνει η φόρμα. */}
        <section className="po-tool-more" style={{ marginTop: 'clamp(44px,6vw,72px)' }}>
          <SectionHead over="Λυμένο παράδειγμα" title={`${fe(EX.price)} τίμημα, ${fe(EX.total)} φόρος μεταβίβασης`} />
          <p className="po-just" style={{ ...PROSE, marginBottom: 16 }}>{hy(
            `Μεταχειρισμένη κατοικία με τίμημα ${fe(EX.price)} και αντικειμενική αξία όχι μεγαλύτερη από το τίμημα, χωρίς απαλλαγή πρώτης κατοικίας.`)}</p>
          <ToolLedger rows={ledgerRows(EX, 0)}/>
          <p className="po-just" style={{ ...PROSE, marginTop: 16 }}>{hy(<>
            Με δάνειο {fe(EX.loan)} χρειάζεσαι {fe(EX.cashNeeded)} σε μετρητά, πριν από τα τέλη του
            Κτηματολογίου και τις αμοιβές μεσίτη, συμβολαιογράφου και δικηγόρου. Τη δόση του δανείου τη δείχνει ο{' '}
            <Link href={`/ypologismos-stegastikou-daneiou?poso=${EX.loan}`} className="lp-link" style={LINK}>υπολογισμός στεγαστικού δανείου</Link>.
          </>)}</p>
        </section>

        <section className="po-tool-more" style={{ marginTop: 'clamp(44px,6vw,72px)' }}>
          <SectionHead over="Συχνές ερωτήσεις" title="Ό,τι ρωτούν πριν υπογράψουν" />
          <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {FAQ.map(f => (
              <details key={f.q} className="lp-faq">
                <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '17px 0', fontSize: 15,
                  fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  {f.q}
                  <span className="lp-plus" style={{ color: 'var(--accent)', fontSize: 20, fontWeight: T.weight.body,
                    lineHeight: 1, transition: 'transform .2s', flexShrink: 0 }}>+</span>
                </summary>
                <p className="po-just" style={{ margin: '0 0 18px', fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
                  {hy(f.a)}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
          <SectionHead over="Και μετά" title="Μετά την αγορά: δόση, ΕΝΦΙΑ και απόδοση" />
          <p className="po-just" style={PROSE}>{hy(<>
            Τη μηνιαία δόση και πόσο δάνειο επιτρέπει το εισόδημά σου τα δείχνει ο{' '}
            <Link href="/ypologismos-stegastikou-daneiou" className="lp-link" style={LINK}>υπολογισμός στεγαστικού δανείου</Link>.
            Κάθε χρόνο θα πληρώνεις{' '}
            <Link href="/ypologismos-enfia" className="lp-link" style={LINK}>ΕΝΦΙΑ</Link>
            {' '}για το ακίνητο. Αν θα το νοικιάσεις, η{' '}
            <Link href="/kathari-apodosi" className="lp-link" style={LINK}>καθαρή απόδοση</Link>
            {' '}δείχνει τι μένει μετά τον φόρο και τα έξοδα.
          </>)}</p>
        </section>
        <ToolByline />
        <ToolGuides tool="/exoda-agoras-akinitou" />
      </main>

      <PublicFooter />
    </div>
  );
}
