// ═══════════════════════════════════════════════════════════════════════════
// ΣΥΓΚΡΙΣΗ ΤΙΜΟΛΟΓΙΩΝ ΡΕΥΜΑΤΟΣ: η δημόσια σελίδα
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΠΕΜΠΤΟ ΕΡΓΑΛΕΙΟ. Ο πίνακας ελέγχου συγκρίνει ήδη τιμολόγια με την
// κατανάλωση του ιδιοκτήτη. Η ίδια ερώτηση («ποιο ρεύμα μου βγαίνει φθηνότερο»)
// ψάχνεται κάθε μήνα από όποιον δεν μας ξέρει ακόμη. Η σελίδα του απαντά με τον
// ίδιο κατάλογο και τον ίδιο τύπο· κανένας αριθμός δεν γράφεται εδώ δεύτερη φορά.
//
// ΤΟ ΤΙΜΗΜΑ ΜΙΑΣ ΛΑΘΟΣ ΤΙΜΗΣ ΕΙΝΑΙ Η ΕΜΠΙΣΤΟΣΥΝΗ. Γι' αυτό η σελίδα λέει πάντα
// πότε ελέγχθηκαν οι τιμές και ποιον μήνα αφορούν και σταματά να κατατάσσει
// μόλις ο κατάλογος περάσει το κατώφλι παλαιότητας (lib/tools/revma.ts).
//
// ΚΟΣΤΟΣ: μηδέν. Στατική απόδοση, ο υπολογισμός γίνεται στη συσκευή, κανένα
// αίτημα σε βάση, κανένα AI, καμία εξωτερική υπηρεσία.
// ═══════════════════════════════════════════════════════════════════════════
import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { T, fdLong } from '@/components/tokens';
import { siteUrl } from '@/lib/core/site';
import { athensToday } from '@/lib/core/time';
import { feRate } from '@/lib/core/format';
import { TARIFFS_VERIFIED, TARIFFS_MAX_AGE_DAYS, CATALOGUE_MONTH_GEN } from '@/lib/energy/catalogue';
import { ETMEAR } from '@/lib/energy/tariff';
import { PublicHeader, PublicFooter, JsonLd, SectionHead, ToolLede, ToolSources, TOOL_PRIVACY_FAQ, WRAP, WRAP_PAD } from '../PublicChrome';
import { hy } from '@/components/Hyphen';
import { BackLink } from '../BackLink';
import { shareImage } from '../og/share';
import { publicMetadata } from '../publicMetadata';
import { PowerCompare } from './PowerCompare';

// Τίτλος ως 60 και περιγραφή ως 155 χαρακτήρες, όσα δείχνει η αναζήτηση.
// Η ΦΡΑΣΗ ΠΟΥ ΓΡΑΦΕΙ Ο ΚΟΣΜΟΣ (Bing, 03.10.2026): «σύγκριση τιμολογίων
// ρεύματος», «φθηνότερο ρεύμα». Η πρώτη δεκάδα γράφει στον τίτλο τη χρονιά ή
// τον μήνα: όποιος δεν τη γράφει μοιάζει παλιός.
const TITLE = 'Σύγκριση τιμολογίων ρεύματος 2026: ποιο είναι φθηνότερο για την κατανάλωσή σου';
const DESC =
  'Τι θα πλήρωνες τον μήνα με κάθε τιμολόγιο ρεύματος: σταθερά, κυμαινόμενα, πράσινα. '
  + 'Με τις κιλοβατώρες σου και την ημερομηνία ελέγχου των τιμών.';
const URL = siteUrl('/sygkrisi-timologion-revmatos');

// Ο τίτλος είναι απόλυτος και η εικόνα κοινοποίησης μπαίνει πάντα (publicMetadata).
export const metadata: Metadata = publicMetadata({ title: TITLE, description: DESC, url: URL, image: shareImage('sygkrisi-timologion-revmatos') });

// Οι απαντήσεις παίρνουν τους αριθμούς τους από τις πηγές τους: το κατώφλι από
// τον κατάλογο, το ΕΤΜΕΑΡ από τον τύπο. Το ίδιο κείμενο τροφοδοτεί και το
// δομημένο σχήμα, ώστε σελίδα και μηχανή αναζήτησης να λένε το ίδιο.
const FAQ: { q: string; a: string; link?: { text: string; href: string } }[] = [
  {
    q: 'Τι σημαίνουν τα χρώματα μπλε, πράσινο και κίτρινο;',
    a: 'Είναι η σήμανση της ΡΑΑΕΥ για το πώς ορίζεται η τιμή. Μπλε: σταθερή τιμή για όλη τη '
     + 'διάρκεια της σύμβασης. Πράσινο: ειδικό τιμολόγιο, με τιμή που ανακοινώνεται την πρώτη '
     + 'κάθε μήνα. Κίτρινο: κυμαινόμενη τιμή που αλλάζει μέσα στη σύμβαση. Το χρώμα δεν λέει '
     + 'από πού προέρχεται η ενέργεια. Τα δυναμικά τιμολόγια, με ωριαία τιμή και έξυπνο '
     + 'μετρητή, δεν μπαίνουν στη σύγκριση, γιατί η τιμή τους δεν βγαίνει από τύπο.',
  },
  {
    q: 'Τι περιλαμβάνει το ποσό;',
    a: 'Τη χρέωση του προμηθευτή, δηλαδή πάγιο και ενέργεια, μαζί με το ΕΤΜΕΑΡ '
     + `(${feRate(ETMEAR)} ανά κιλοβατώρα) και ΦΠΑ 6%. Δεν περιλαμβάνει χρεώσεις δικτύου, ΥΚΩ, `
     + 'ΕΦΚ, δημοτικά τέλη ούτε τέλος ΕΡΤ. Αυτά είναι ίδια σε κάθε πάροχο, οπότε δεν αλλάζουν τη '
     + 'σειρά, αλλά ο λογαριασμός σου θα βγει μεγαλύτερος από το ποσό της σύγκρισης.',
  },
  {
    q: 'Πόσο φρέσκες είναι οι τιμές;',
    a: `Τελευταία ενημέρωση τιμών: ${fdLong(TARIFFS_VERIFIED)}, από τον πίνακα της ΡΑΑΕΥ στο energycost.gr. `
     + `Οι τιμές είναι ${CATALOGUE_MONTH_GEN}, εκτός όπου κάποιο τιμολόγιο γράφει άλλον μήνα· μόνο οι τιμές `
     + `${CATALOGUE_MONTH_GEN} μπαίνουν στη σειρά. Οι πάροχοι ανακοινώνουν νέες τιμές κάθε `
     + `μήνα. Όταν περάσουν πάνω από ${TARIFFS_MAX_AGE_DAYS} ημέρες από τον έλεγχο, η σελίδα σταματά `
     + 'να κατατάσσει και δείχνει τις τιμές μόνο ως ενδεικτικές. Πριν υπογράψεις, επιβεβαίωσε την '
     + 'τιμή στη σελίδα του παρόχου.',
  },
  {
    q: 'Πού βρίσκω την κατανάλωσή μου;',
    a: 'Στον λογαριασμό ρεύματος, στις κιλοβατώρες της περιόδου. Αν ο λογαριασμός είναι έναντι, '
     + 'πάρε τον εκκαθαριστικό, που βγαίνει με πραγματική μέτρηση. Αν έχεις τον αριθμό του χρόνου, '
     + 'γράψ’ τον ως ετήσιο και η σελίδα τον μοιράζει στους δώδεκα μήνες.',
  },
  TOOL_PRIVACY_FAQ,
];

export default function Page() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'Σύγκριση τιμολογίων ρεύματος',
        url: URL,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web',
        inLanguage: 'el',
        description: DESC,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };

  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={jsonLd} />

      <PublicHeader />

      <main style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <BackLink />
        <div className="lp-eyebrow">Σύγκριση</div>
        <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: 680, letterSpacing: '-0.035em',
          lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
          Σύγκριση τιμολογίων ρεύματος για την κατανάλωσή σου
        </h1>
        <ToolLede>Τι θα πλήρωνες τον μήνα και τον χρόνο με κάθε τιμολόγιο ρεύματος, για τις δικές σου κιλοβατώρες.</ToolLede>

        {/* Ο πυρήνας διαβάζει τη διεύθυνση, άρα θέλει όριο αναμονής: χωρίς αυτό
            η σελίδα βγαίνει από τη στατική απόδοση και χάνει το SEO της. Η
            σημερινή μέρα του διακομιστή είναι μόνο η πρώτη απόδοση· ο περιηγητής
            την ξανακρίνει (PowerCompare). */}
        <Suspense fallback={<div style={{ minHeight: 640 }} aria-hidden/>}>
          <PowerCompare serverToday={athensToday()}/>
        </Suspense>

        <ToolSources kind="power" />

        <section className="po-tool-more" style={{ marginTop: 'clamp(44px,6vw,72px)' }}>
          <SectionHead over="Συχνές ερωτήσεις" title="Ό,τι ρωτούν πριν αλλάξουν πάροχο" />
          <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {FAQ.map(f => (
              <details key={f.q} className="lp-faq">
                <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '17px 0', fontSize: 15,
                  fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  {f.q}
                  <span className="lp-plus" style={{ color: 'var(--accent)', fontSize: 20, fontWeight: 450,
                    lineHeight: 1, transition: 'transform .2s', flexShrink: 0 }}>+</span>
                </summary>
                <p className="po-just" style={{ margin: '0 0 18px', fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
                  {hy(f.a)}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Το ρεύμα είναι ένα από τα πάγια του ιδιοκτήτη: στη βραχυχρόνια το
            πληρώνει ο ίδιος, στη μακροχρόνια ο ενοικιαστής. Η σύγκριση των δύο
            το ζητά ως πεδίο. */}
        <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
          <SectionHead over="Και μετά" title="Όταν το ρεύμα το πληρώνεις εσύ" />
          <p className="po-just" style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>{hy(<>
            Στη βραχυχρόνια μίσθωση το ρεύμα, το νερό και το ίντερνετ τα πληρώνει ο ιδιοκτήτης.
            Η{' '}
            <Link href="/vraxyxronia-i-makroxronia" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              σύγκριση βραχυχρόνιας και μακροχρόνιας
            </Link>{' '}τα ζητά ως πάγια και δείχνει από ποια πληρότητα και πάνω συμφέρει. Και η{' '}
            <Link href="/kathari-apodosi" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              καθαρή απόδοση
            </Link>{' '}λέει τι μένει από το ενοίκιο μετά τον φόρο, τον ΕΝΦΙΑ και τις δαπάνες.
          </>)}</p>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
