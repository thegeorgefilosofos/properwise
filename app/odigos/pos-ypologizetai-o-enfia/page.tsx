// ═══════════════════════════════════════════════════════════════════════════
// ΟΔΗΓΟΣ-ΠΥΛΩΝΑΣ: ΕΝΦΙΑ ΠΩΣ ΥΠΟΛΟΓΙΖΕΤΑΙ — η δημόσια σελίδα
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Ο ιδιοκτήτης ρωτά «πώς βγαίνει ο ΕΝΦΙΑ μου» και βρίσκει πίνακες
// ζώνης χωρίς εξήγηση. Ο οδηγός δείχνει τον τύπο, τους συντελεστές και ένα
// παράδειγμα σε ευρώ με πηγές, τον δένει με τον υπολογιστή.
//
// ΚΑΘΕ ΣΥΝΤΕΛΕΣΤΗΣ ΑΠΟ ΤΟΝ ΠΥΡΗΝΑ. Οι πίνακες (ζώνη, παλαιότητα, όροφος, μειώσεις)
// είναι ΑΥΤΟΥΣΙΟΙ από lib/billing/enfia.ts (δοκιμασμένο): ENFIA_ZONE_TAX,
// ENFIA_AGE_BANDS, ENFIA_FLOOR_COEF, ENFIA_WEALTH_REDUCTION. Νομική βάση:
// ν.4223/2013 όπως ισχύει με ν.4916/2022.
//
// Server Component για SEO/ταχύτητα. Καμία εξάρτηση από 'use client'.
// ═══════════════════════════════════════════════════════════════════════════
import Link from 'next/link';
import type { Metadata } from 'next';
import { T } from '@/components/tokens';
import { SITE, siteUrl } from '@/lib/core/site';
import { PublicHeader, PublicFooter, JsonLd, SectionHead, WRAP, WRAP_PAD } from '../../PublicChrome';
import { hy } from '@/components/Hyphen';
import { BackLink } from '../../BackLink';

const TITLE = 'ΕΝΦΙΑ: πώς υπολογίζεται (2026)';
const DESC =
  'Πώς υπολογίζεται ο ΕΝΦΙΑ: ο κύριος φόρος από την τιμή ζώνης επί τα τετραγωνικά, με '
  + 'συντελεστές παλαιότητας και ορόφου, η αυτόματη μείωση ανά συνολική αξία και οι '
  + 'απαλλαγές. Με παράδειγμα σε ευρώ και πηγές. Ενδεικτικός οδηγός, όχι εκκαθαριστικό.';
const URL = siteUrl('/odigos/pos-ypologizetai-o-enfia');
const UPDATED = '2026-09-21';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESC,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESC, url: URL, siteName: 'PROPERWISE', locale: 'el_GR', type: 'article' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
};

// Οι ερωτήσεις τροφοδοτούν ΚΑΙ την ορατή λίστα ΚΑΙ το δομημένο σχήμα — μία πηγή.
const FAQ: { q: string; a: string }[] = [
  {
    q: 'Ο ΕΝΦΙΑ εξαρτάται από το εισόδημά μου;',
    a: 'Όχι. Ο ΕΝΦΙΑ είναι φόρος κατοχής: υπολογίζεται από τα χαρακτηριστικά του ακινήτου '
     + '(τιμή ζώνης, τετραγωνικά, παλαιότητα, όροφος) και τη συνολική αξία της περιουσίας, '
     + 'όχι από το εισόδημα. Τον πληρώνεις ακόμη και αν το ακίνητο είναι κενό.',
  },
  {
    q: 'Τι είναι η τιμή ζώνης;',
    a: 'Είναι η αντικειμενική αξία ανά τετραγωνικό της περιοχής, όπως την ορίζει το κράτος. '
     + 'Κατατάσσει το ακίνητο σε κλιμάκιο και δίνει τον βασικό φόρο ανά τ.μ. (από 2,00€ έως '
     + '16,20€). Τη βρίσκεις στο συμβόλαιο ή στον χάρτη αντικειμενικών αξιών.',
  },
  {
    q: 'Πληρώνεται μονομιάς;',
    a: 'Όχι. Η ΑΑΔΕ εκδίδει την εκκαθάριση μέσα στη χρονιά και ο φόρος πληρώνεται σε '
     + 'μηνιαίες δόσεις. Ο ακριβής αριθμός δόσεων και οι ημερομηνίες ορίζονται κάθε έτος.',
  },
  {
    q: 'Πληρώνω λιγότερο αν το σπίτι είναι ασφαλισμένο;',
    a: 'Ναι, αν το ακίνητο είναι ασφαλισμένο για σεισμό, πυρκαγιά και πλημμύρα για '
     + 'τουλάχιστον 3 μήνες: η μείωση είναι 20% (αξία κατοικίας έως 500.000€) ή 10% (πάνω από '
     + '500.000€). Είναι μέτρο με ημερομηνία, επιβεβαίωσέ το για το τρέχον έτος.',
  },
  {
    q: 'Υπάρχει απαλλαγή για πολύτεκνους ή αναπηρία;',
    a: 'Ναι, 100% απαλλαγή για τρίτεκνους/πολύτεκνους και για αναπηρία ≥80%, με εισοδηματικά '
     + 'και περιουσιακά κριτήρια (εισόδημα έως 12.000€, προσαυξημένο ανά μέλος · κτίσματα '
     + 'έως 150 τ.μ.). Τα κριτήρια ελέγχονται από την ΑΑΔΕ.',
  },
  {
    q: 'Ο ΕΝΦΙΑ αφαιρείται από τον φόρο ενοικίων;',
    a: 'Όχι. Είναι χωριστός φόρος και δεν εκπίπτει από το εισόδημα από ενοίκια. Δες τον '
     + 'οδηγό φορολογίας ενοικίων για την κλίμακα εισοδήματος.',
  },
];

// Βασικός φόρος ανά τιμή ζώνης — αυτούσιο ENFIA_ZONE_TAX (άρθρο 4 ν.4223/2013 / ν.4916/2022).
const ZONE: { range: string; tax: string }[] = [
  { range: 'έως 750€', tax: '2,00€' },
  { range: '751 – 1.500€', tax: '2,80€' },
  { range: '1.501 – 2.500€', tax: '3,70€' },
  { range: '2.501 – 3.000€', tax: '4,50€' },
  { range: '3.001 – 3.500€', tax: '7,60€' },
  { range: '3.501 – 4.000€', tax: '9,20€' },
  { range: '4.001 – 4.500€', tax: '11,10€' },
  { range: '4.501 – 5.000€', tax: '13,40€' },
  { range: 'πάνω από 5.000€', tax: '16,20€' },
];

// Συντελεστής παλαιότητας — αυτούσιο ENFIA_AGE_BANDS.
const AGE: { band: string; coef: string }[] = [
  { band: 'έως 4 έτη', coef: '1,25' },
  { band: '5 – 9 έτη', coef: '1,20' },
  { band: '10 – 14 έτη', coef: '1,15' },
  { band: '15 – 19 έτη', coef: '1,10' },
  { band: '20 – 25 έτη', coef: '1,05' },
  { band: '26 έτη και άνω', coef: '1,00' },
];

// Συντελεστής ορόφου — αυτούσιο ENFIA_FLOOR_COEF.
const FLOOR: { floor: string; coef: string }[] = [
  { floor: 'υπόγειο', coef: '0,98' },
  { floor: 'ισόγειο και 1ος', coef: '1,00' },
  { floor: '2ος και 3ος', coef: '1,01' },
  { floor: '4ος και 5ος', coef: '1,02' },
  { floor: '6ος και άνω', coef: '1,03' },
];

// Αυτόματη μείωση κύριου φόρου ανά συνολική αξία — αυτούσιο ENFIA_WEALTH_REDUCTION.
const WEALTH: { value: string; pct: string }[] = [
  { value: 'έως 100.000€', pct: '30%' },
  { value: 'έως 150.000€', pct: '25%' },
  { value: 'έως 250.000€', pct: '20%' },
  { value: 'έως 300.000€', pct: '15%' },
  { value: 'έως 400.000€', pct: '10%' },
  { value: 'πάνω από 400.000€', pct: '0%' },
];

const SOURCES: string[] = [
  'Κύριος φόρος (τιμή ζώνης, συντελεστές παλαιότητας και ορόφου): άρθρο 4 ν.4223/2013, όπως ισχύει με τον ν.4916/2022.',
  'Αυτόματη μείωση ανά συνολική αξία και προσαύξηση μεγάλης περιουσίας: άρθρα 7 και 4 (Ενότητα Ε΄) ν.4223/2013, όπως ισχύει με τον ν.4916/2022.',
  'Μείωση ασφαλισμένης κατοικίας 10-20%: απόφαση ΑΑΔΕ Α.1005/2026 · πίνακες αντικειμενικών αξιών ΑΑΔΕ.',
];

function H2({ over, title }: { over: string; title: string }) {
  return <div style={{ marginTop: 'clamp(40px,5vw,60px)', marginBottom: 16 }}><SectionHead over={over} title={title} /></div>;
}

function Table({ caption, head, rows, min }: { caption: string; head: [string, string]; rows: [string, string][]; min: string }) {
  return (
    <div className="po-table-box" style={{ marginTop: 14 }}>
      <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
        <table className="po-table" style={{ '--tbl-min': min } as React.CSSProperties}>
          <caption>{caption}</caption>
          <thead>
            <tr><th scope="col">{head[0]}</th><th scope="col" className="num">{head[1]}</th></tr>
          </thead>
          <tbody>
            {rows.map(([a, b]) => (
              <tr key={a}><th scope="row">{a}</th><td className="num">{b}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Page() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: TITLE,
        description: DESC,
        inLanguage: 'el',
        datePublished: UPDATED,
        dateModified: UPDATED,
        mainEntityOfPage: URL,
        author: { '@type': 'Organization', name: 'PROPERWISE', url: SITE },
        publisher: { '@type': 'Organization', name: 'PROPERWISE', url: SITE },
        about: 'Ενιαίος Φόρος Ιδιοκτησίας Ακινήτων (ΕΝΦΙΑ) και ο υπολογισμός του',
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
    <div className="po-tool-page" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={jsonLd} />
      <PublicHeader />

      <main style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <BackLink />
        <div className="lp-eyebrow">Οδηγός</div>
        <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: 680, letterSpacing: '-0.035em',
          lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
          ΕΝΦΙΑ: πώς υπολογίζεται
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 18px' }}>
          Ενημέρωση με βάση τη νομοθεσία όπως ισχύει τον Σεπτέμβριο 2026.
        </p>

        <p className="lg-p">
          {hy('Ο ΕΝΦΙΑ (Ενιαίος Φόρος Ιδιοκτησίας Ακινήτων) είναι φόρος κατοχής: τον πληρώνεις κάθε χρόνο επειδή έχεις το ακίνητο, ανεξάρτητα από το αν το νοικιάζεις, αν είναι κενό ή ποιο είναι το εισόδημά σου. Υπολογίζεται από τα χαρακτηριστικά του ακινήτου και τη συνολική αξία της περιουσίας σου.')}
        </p>
        <p className="lg-p">
          {hy('Ο οδηγός δείχνει τον τύπο, τους συντελεστές και ένα παράδειγμα σε ευρώ. Επειδή ο πλήρης τύπος περιλαμβάνει και άλλους συντελεστές (πρόσοψης, επιφάνειας), το αποτέλεσμα είναι ενδεικτική εκτίμηση, όχι το επίσημο εκκαθαριστικό.')}
        </p>

        {/* 1. Ο κύριος φόρος */}
        <H2 over="1. Ο πυρήνας" title="Ο κύριος φόρος του κτίσματος" />
        <p className="lg-p">
          {hy('Ο κύριος φόρος κάθε κτίσματος προκύπτει πολλαπλασιαστικά:')}
        </p>
        <div className="lg-note" style={{ marginTop: 12 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Τετραγωνικά × Βασικός φόρος ζώνης × Συντελεστής παλαιότητας × Συντελεστής ορόφου</strong>
        </div>
        <p className="lg-p" style={{ marginTop: 16 }}>
          {hy('Ο βασικός φόρος ζώνης βγαίνει από την τιμή ζώνης (αντικειμενική αξία ανά τ.μ.) της περιοχής. Νομική βάση: άρθρο 4 ν.4223/2013, όπως ισχύει με τον ν.4916/2022.')}
        </p>
        <Table caption="Βασικός φόρος ανά τιμή ζώνης (€/τ.μ.)"
          head={['Τιμή ζώνης (€/τ.μ.)', 'Βασικός φόρος']} min="320px"
          rows={ZONE.map(z => [z.range, z.tax])} />
        <Table caption="Συντελεστής παλαιότητας κτίσματος"
          head={['Παλαιότητα', 'Συντελεστής']} min="280px"
          rows={AGE.map(a => [a.band, a.coef])} />
        <Table caption="Συντελεστής ορόφου"
          head={['Όροφος', 'Συντελεστής']} min="280px"
          rows={FLOOR.map(f => [f.floor, f.coef])} />

        {/* 2. Παράδειγμα */}
        <H2 over="2. Παράδειγμα" title="Ένα διαμέρισμα, βήμα βήμα" />
        <p className="lg-p">
          {hy('Διαμέρισμα 90 τ.μ., σε περιοχή με τιμή ζώνης 2.000€/τ.μ. (κλιμάκιο 1.501-2.500, βασικός φόρος 3,70€/τ.μ.), 12 ετών (συντελεστής 1,15), στον 3ο όροφο (1,01):')}
        </p>
        <ul className="lg-ul">
          <li>{hy('Κύριος φόρος: 90 × 3,70 × 1,15 × 1,01 = περίπου 386,78€.')}</li>
          <li>{hy('Αντικειμενική αξία περίπου 90 × 2.000 = 180.000€. Ο ιδιοκτήτης ενός μόνο ακινήτου έχει συνολική αξία ίση με αυτή, οπότε δικαιούται αυτόματη μείωση 20% (κλιμάκιο έως 250.000€).')}</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>{hy('Τελικός ΕΝΦΙΑ: περίπου 309€ τον χρόνο.')}</strong></li>
        </ul>

        {/* 3. Αυτόματη μείωση */}
        <H2 over="3. Η έκπτωση όλων" title="Αυτόματη μείωση ανά συνολική αξία" />
        <p className="lg-p">
          {hy('Κάθε φυσικό πρόσωπο παίρνει αυτόματη μείωση του κύριου φόρου, ανάλογα με τη συνολική αξία της ακίνητης περιουσίας του. Δεν χρειάζεται αίτηση: εφαρμόζεται στην εκκαθάριση.')}
        </p>
        <Table caption="Αυτόματη μείωση κύριου φόρου"
          head={['Συνολική αξία περιουσίας', 'Μείωση']} min="320px"
          rows={WEALTH.map(w => [w.value, w.pct])} />

        {/* 4. Απαλλαγές */}
        <H2 over="4. Με κριτήρια" title="Απαλλαγές και ειδικές μειώσεις" />
        <ul className="lg-ul">
          <li>{hy('Ασφαλισμένη κατοικία (σεισμός, πυρκαγιά, πλημμύρα, τουλάχιστον 3 μήνες): μείωση 20% για αξία κατοικίας έως 500.000€, ή 10% πάνω από αυτό (απόφαση ΑΑΔΕ Α.1005/2026).')}</li>
          <li>{hy('Κύρια κατοικία μικρού οικισμού (2026): μείωση 50% για οικισμούς έως 1.500 κατοίκους, με αξία κατοικίας έως 400.000€.')}</li>
          <li>{hy('Τρίτεκνοι, πολύτεκνοι και αναπηρία ≥80%: πλήρης απαλλαγή (100%) με εισοδηματικά και περιουσιακά κριτήρια.')}</li>
        </ul>

        {/* 5. Μεγάλη περιουσία */}
        <H2 over="5. Μεγάλη περιουσία" title="Προσαύξηση και πρόσθετος φόρος" />
        <p className="lg-p">
          {hy('Για συνολική αξία περιουσίας πάνω από 500.000€, ο κύριος φόρος προσαυξάνεται κλιμακωτά από 5% έως 20%. Επιπλέον, κάθε ακίνητο με αξία πάνω από 400.000€ επιβαρύνεται με πρόσθετο φόρο (κλιμακωτά 0,2% έως 1,0% επί της αξίας), εφόσον η συνολική περιουσία ξεπερνά τις 300.000€. Οι περισσότεροι ιδιοκτήτες κατοικίας δεν φτάνουν αυτά τα όρια.')}
        </p>

        {/* 6. Πηγές */}
        <H2 over="6. Τεκμηρίωση" title="Νομική βάση και πηγές" />
        <div className="po-tool-sources" aria-label="Νομική βάση και πηγές" style={{ display: 'block' }}>
          <span className="po-src-badge">Νομική βάση</span>
          <ul className="lg-ul" style={{ marginTop: 12 }}>
            {SOURCES.map((s, i) => <li key={i}>{hy(s)}</li>)}
          </ul>
        </div>

        {/* CTA */}
        <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
          <SectionHead over="Υπολόγισε" title="Δες τον δικό σου ΕΝΦΙΑ" />
          <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0, textWrap: 'pretty' }}>
            {hy('Βάλε τετραγωνικά, τιμή ζώνης, παλαιότητα και όροφο στον ')}
            <Link href="/ypologismos-enfia" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              υπολογισμό ΕΝΦΙΑ
            </Link>
            {hy(', χωρίς εγγραφή. Για τον φόρο των ενοικίων δες τον ')}
            <Link href="/odigos/forologia-enoikion-2026" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              οδηγό φορολογίας ενοικίων 2026
            </Link>
            {hy(' και, για τη συνολική εικόνα ως ποσοστό της αξίας, την ')}
            <Link href="/kathari-apodosi" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              καθαρή απόδοση
            </Link>.
          </p>
        </section>

        {/* Συχνές ερωτήσεις */}
        <section className="po-tool-more" style={{ marginTop: 'clamp(44px,6vw,72px)' }}>
          <SectionHead over="Συχνές ερωτήσεις" title="Ό,τι ρωτούν για τον ΕΝΦΙΑ" />
          <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {FAQ.map(f => (
              <details key={f.q} className="lp-faq">
                <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '17px 0', fontSize: 15,
                  fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  {f.q}
                  <span className="lp-plus" style={{ color: 'var(--accent)', fontSize: 20, fontWeight: 450, lineHeight: 1, transition: 'transform .2s', flexShrink: 0 }}>+</span>
                </summary>
                <p className="po-just" style={{ margin: '0 0 18px', fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
                  {hy(f.a)}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Αποποίηση */}
        <div className="lg-note" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
          {hy('Ο παρών οδηγός και κάθε συνδεδεμένος υπολογισμός είναι ενδεικτικοί. Ο πλήρης τύπος του ΕΝΦΙΑ περιλαμβάνει και συντελεστές πρόσοψης και επιφάνειας, ενώ τα μέτρα με ημερομηνία λήξης αλλάζουν. Δεν αποτελούν επίσημο εκκαθαριστικό της ΑΑΔΕ ούτε υποκαθιστούν λογιστή ή φοροτεχνικό.')}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
