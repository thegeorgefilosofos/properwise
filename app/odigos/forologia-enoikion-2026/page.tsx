// ═══════════════════════════════════════════════════════════════════════════
// ΟΔΗΓΟΣ-ΠΥΛΩΝΑΣ: ΦΟΡΟΛΟΓΙΑ ΕΝΟΙΚΙΩΝ 2026 — η δημόσια σελίδα
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Τα εργαλεία απαντούν «πόσο», ο οδηγός απαντά «γιατί». Ο ιδιοκτήτης
// που ψάχνει «φορολογία ενοικίων 2026» θέλει να καταλάβει την κλίμακα, την έκπτωση
// και την προϋπόθεση της τράπεζας ΠΡΙΝ βάλει νούμερα. Αυτή η σελίδα το εξηγεί με
// πηγές και δένει με τον υπολογιστή, χωρίς εγγραφή.
//
// ΚΑΘΕ ΑΡΙΘΜΟΣ ΕΙΝΑΙ ΕΠΑΛΗΘΕΥΜΕΝΟΣ και ΚΑΘΕ ΝΟΜΟΣ ΣΩΣΤΑ ΑΠΟΔΟΣΜΕΝΟΣ: η κλίμακα
// (ν.5246/2025, όριο 36.000€) και η τραπεζική είσπραξη (ν.5222/2025, κύρωση από
// 1.7.2027 με την Α.1187/2026) είναι ΔΥΟ ΞΕΧΩΡΙΣΤΕΣ διατάξεις — δες lib/billing.
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

const TITLE = 'Φορολογία ενοικίων 2026: πλήρης οδηγός';
const DESC =
  'Πώς φορολογούνται τα ενοίκια το 2026: η κλίμακα 15 / 25 / 35 / 45% (όριο 36.000€), '
  + 'η τεκμαρτή έκπτωση 5% και η προϋπόθεση της τραπεζικής είσπραξης (ν.5222/2025, από '
  + '1.7.2027). Με παραδείγματα σε ευρώ και πηγές. Ενδεικτικός οδηγός, όχι εκκαθαριστικό.';
const URL = siteUrl('/odigos/forologia-enoikion-2026');
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
    q: 'Ισχύει η νέα κλίμακα στη δήλωση του 2026 (εισοδήματα 2025);',
    a: 'Όχι. Σύμφωνα με το άρθρο 47 παρ. 3 του ν.5246/2025, η νέα κλίμακα εφαρμόζεται '
     + 'για εισοδήματα από το φορολογικό έτος 2026, που δηλώνονται το 2027. Για τα εισοδήματα '
     + 'του 2025 ισχύει ακόμη η προηγούμενη κλίμακα (15 / 35 / 45%).',
  },
  {
    q: 'Φορολογείται όλο το ενοίκιο με 25% ή 35%;',
    a: 'Όχι. Η κλίμακα είναι κλιμακωτή: κάθε τμήμα του εισοδήματος φορολογείται με τον '
     + 'δικό του συντελεστή. Μόνο το ποσό πάνω από τα 36.000€ φτάνει στο 45%.',
  },
  {
    q: 'Η έκπτωση 5% θέλει αποδείξεις;',
    a: 'Όχι για την τεκμαρτή δαπάνη της περ. α΄ της παρ. 3 του άρθρου 39 ΚΦΕ: αναγνωρίζεται '
     + 'ποσοστό 5% για επισκευές και συντήρηση χωρίς προσκόμιση δικαιολογητικών.',
  },
  {
    q: 'Από πότε χάνω το 5% αν εισπράττω μετρητά;',
    a: 'Η προϋπόθεση της τραπεζικής είσπραξης θεσπίστηκε με το άρθρο 210 του ν.5222/2025, '
     + 'αλλά η έναρξη των κυρώσεων μετατέθηκε στην 1η Ιουλίου 2027 (απόφαση ΑΑΔΕ Α.1187/2026). '
     + 'Για τα εισοδήματα του 2025 και του 2026 η έκπτωση δίνεται ανεξάρτητα από τον τρόπο είσπραξης.',
  },
  {
    q: 'Ισχύει το ίδιο για βραχυχρόνια μίσθωση;',
    a: 'Όχι απευθείας. Η βραχυχρόνια έχει δικά της τέλη (Τέλος Ανθεκτικότητας στην Κλιματική '
     + 'Κρίση, τέλος παρεπιδημούντων) και ξεχωριστή αξιολόγηση. Δες τη σύγκριση βραχυχρόνιας '
     + 'και μακροχρόνιας.',
  },
  {
    q: 'Ο ΕΝΦΙΑ αφαιρείται από τα ενοίκια;',
    a: 'Όχι. Ο ΕΝΦΙΑ είναι φόρος κατοχής και υπολογίζεται χωριστά· δεν εκπίπτει από το '
     + 'εισόδημα ενοικίων στην κλασική εικόνα αυτού του οδηγού.',
  },
];

// Η κλίμακα ενοικίων 2026 — ίδια αριθμητική με lib/billing/greekTax (RENTAL_TAX_BRACKETS_2026).
const SCALE: { range: string; rate: string }[] = [
  { range: '0 – 12.000€', rate: '15%' },
  { range: '12.000,01 – 24.000€', rate: '25%' },
  { range: '24.000,01 – 36.000€', rate: '35%' },
  { range: 'πάνω από 36.000€', rate: '45%' },
];

// Οι πηγές/νομική βάση, ορατές όπως στα εργαλεία (E-E-A-T).
const SOURCES: string[] = [
  'Κλίμακα ενοικίων 2026 (15 / 25 / 35 / 45%, όριο 36.000€): άρθρο 8 ν.5246/2025 (ΦΕΚ Α΄ 198/11.11.2025) · έναρξη ισχύος άρθρο 47 παρ. 3.',
  'Τεκμαρτή έκπτωση 5%: άρθρο 39 παρ. 3 περ. α΄ ν.4172/2013 (ΚΦΕ).',
  'Τραπεζική είσπραξη μισθωμάτων: άρθρο 210 ν.5222/2025 (προσθήκη παρ. 5 στο άρθρο 39 ΚΦΕ) · έναρξη κυρώσεων 1.7.2027 με την απόφαση ΑΑΔΕ Α.1187/2026 (ΦΕΚ Β΄ 5590/17.09.2026).',
];

function H2({ over, title }: { over: string; title: string }) {
  return <div style={{ marginTop: 'clamp(40px,5vw,60px)', marginBottom: 16 }}><SectionHead over={over} title={title} /></div>;
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
        about: 'Φορολογία εισοδήματος από ακίνητη περιουσία στην Ελλάδα',
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
          Φορολογία ενοικίων 2026: πλήρης οδηγός
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 18px' }}>
          Ενημέρωση με βάση τη νομοθεσία όπως ισχύει τον Σεπτέμβριο 2026.
        </p>

        {/* Εισαγωγή */}
        <p className="lg-p">
          {hy('Αν εκμισθώνεις ακίνητο στην Ελλάδα, το εισόδημα από ενοίκια δεν μπαίνει στην ίδια κλίμακα με τον μισθό ή τη σύνταξη. Φορολογείται αυτοτελώς, με δική του προοδευτική κλίμακα, από το πρώτο ευρώ.')}
        </p>
        <p className="lg-p">
          {hy('Για τα εισοδήματα που αποκτώνται το φορολογικό έτος 2026 (και δηλώνονται το 2027) ισχύει η αναμορφωμένη κλίμακα του άρθρου 8 του ν.5246/2025: 15%, 25%, 35% και 45%. Το κρίσιμο όριο του τρίτου κλιμακίου δεν είναι πλέον οι 35.000€· το 35% καλύπτει έως και τις 36.000€ φορολογητέου εισοδήματος.')}
        </p>
        <p className="lg-p">
          {hy('Ο οδηγός δεν υπόσχεται «μαγική εξοικονόμηση». Στόχος του είναι να ξέρεις την τάξη μεγέθους πριν μιλήσεις με τον λογιστή σου.')}
        </p>

        {/* 1. Η κλίμακα 2026 */}
        <H2 over="1. Η κλίμακα" title="15 / 25 / 35 / 45% (όριο 36.000€)" />
        <p className="lg-p">
          {hy('Νομική βάση: άρθρο 8 ν.5246/2025, που τροποποιεί την παρ. 4 του άρθρου 40 του Κώδικα Φορολογίας Εισοδήματος (ν.4172/2013). Έναρξη ισχύος για εισοδήματα από το φορολογικό έτος 2026.')}
        </p>
        <div className="po-table-box" style={{ marginTop: 14 }}>
          <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
            <table className="po-table" style={{ '--tbl-min': '300px' } as React.CSSProperties}>
              <caption>Εισόδημα από ακίνητη περιουσία (ανά έτος)</caption>
              <thead>
                <tr><th scope="col">Εισόδημα</th><th scope="col" className="num">Συντελεστής</th></tr>
              </thead>
              <tbody>
                {SCALE.map(s => (
                  <tr key={s.range}>
                    <th scope="row">{s.range}</th>
                    <td className="num">{s.rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <ul className="lg-ul" style={{ marginTop: 16 }}>
          <li>{hy('Κλιμακωτή φορολόγηση: κάθε τμήμα του φορολογητέου εισοδήματος φορολογείται με τον δικό του συντελεστή.')}</li>
          <li>{hy('Χωρίς αφορολόγητο τύπου μισθωτών: από το πρώτο ευρώ ισχύει το 15%.')}</li>
          <li>{hy('Το φορολογητέο ποσό είναι συνήθως το 95% των ακαθάριστων μισθωμάτων (δες την επόμενη ενότητα).')}</li>
          <li>{hy('Το κλιμάκιο 35% φτάνει έως και τις 36.000€. Το 45% αρχίζει πάνω από τις 36.000€.')}</li>
        </ul>
        <p className="lg-p">
          {hy('Σύγκριση με έως το 2025: έως το φορολογικό έτος 2025 ίσχυε (απλοποιημένα) 15 / 35 / 45%, με το μεσαίο κλιμάκιο περίπου 12.001–35.000€. Από το 2026 παρεμβάλλεται το 25% (12.000,01–24.000) και το όριο του 45% μετατοπίζεται πάνω από τις 36.000€.')}
        </p>

        {/* 2. Τεκμαρτή έκπτωση 5% */}
        <H2 over="2. Δαπάνες" title="Τεκμαρτή έκπτωση 5%" />
        <p className="lg-p">
          {hy('Νομική βάση: άρθρο 39 παρ. 3 περ. α΄ ν.4172/2013 (ΚΦΕ). Για φυσικό πρόσωπο που εκμισθώνει ή παραχωρεί ακίνητο, εκπίπτει ποσοστό πέντε τοις εκατό (5%) για δαπάνες επισκευής, συντήρησης, ανακαίνισης ή άλλες πάγιες και λειτουργικές δαπάνες, χωρίς προσκόμιση αποδείξεων για αυτή την τεκμαρτή δαπάνη.')}
        </p>
        <ul className="lg-ul">
          <li>{hy('Ακαθάριστα ενοίκια έτους: Ε')}</li>
          <li>{hy('Τεκμαρτή έκπτωση: 0,05 × Ε')}</li>
          <li>{hy('Φορολογητέο (κατά κανόνα): 0,95 × Ε')}</li>
        </ul>

        {/* 3. Τραπεζική είσπραξη */}
        <H2 over="3. Τρόπος πληρωμής" title="Η προϋπόθεση της τραπεζικής είσπραξης" />
        <p className="lg-p">
          <strong style={{ color: 'var(--text-primary)' }}>Σωστή παραπομπή (όχι ν.5246/2025):</strong>{' '}
          {hy('άρθρο 210 του ν.5222/2025 (ΦΕΚ Α΄ 134/28.07.2025), που πρόσθεσε παρ. 5 στο άρθρο 39 ΚΦΕ. Αν η εξόφληση μισθώματος δεν γίνει σε τραπεζικό λογαριασμό του εκμισθωτή γνωστοποιημένο στην ΑΑΔΕ, δεν εφαρμόζεται η περ. α΄ της παρ. 3· χάνεται η τεκμαρτή έκπτωση 5%.')}
        </p>
        <div className="po-table-box" style={{ marginTop: 14 }}>
          <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
            <table className="po-table" style={{ '--tbl-min': '420px' } as React.CSSProperties}>
              <caption>Χρονική πορεία της διάταξης</caption>
              <thead>
                <tr><th scope="col">Βήμα</th><th scope="col">Τι λέει</th><th scope="col">Πηγή</th></tr>
              </thead>
              <tbody>
                <tr><th scope="row">Θέσπιση</th><td>Προσθήκη παρ. 5 στο άρθρο 39 ΚΦΕ</td><td>ν.5222/2025, άρθρο 210</td></tr>
                <tr><th scope="row">1η μετάθεση</th><td>Ισχύς από 1.4.2026</td><td>ν.5264/2025, άρθρο 129 παρ. 1</td></tr>
                <tr><th scope="row">Τρέχουσα</th><td>Έναρξη 1.7.2027</td><td>Α.1187/2026 · ΦΕΚ Β΄ 5590/17.09.2026</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="lg-note" style={{ marginTop: 16 }}>
          {hy('Για τα εισοδήματα του 2025 και του 2026: η κλίμακα και η τεκμαρτή έκπτωση 5% ισχύουν κανονικά. Η κυρωτική σύνδεση «χωρίς τραπεζική είσπραξη, χωρίς 5%» δεν έχει ακόμη ενεργοποιηθεί· ξεκινά την 1η Ιουλίου 2027. Ο ν.5246/2025 ρυθμίζει την κλίμακα· δεν είναι η διάταξη της υποχρεωτικής πληρωμής μέσω τράπεζας.')}
        </div>

        {/* 4. Παραδείγματα */}
        <H2 over="4. Στην πράξη" title="Τρία αριθμημένα παραδείγματα" />
        <p className="lg-p" style={{ marginBottom: 8 }}>
          {hy('Υποθέσεις: φυσικό πρόσωπο, μακροχρόνια μίσθωση, τεκμαρτή έκπτωση 5%, κλίμακα 2026.')}
        </p>

        <h3 style={eg}>Παράδειγμα 1 · Μηνιαίο ενοίκιο 650€ (ετήσιο 7.800€)</h3>
        <p className="lg-p">
          {hy('Ακαθάριστα 7.800 · έκπτωση 390 · φορολογητέο 7.410 · φόρος 1.111,50€ (όλο στο 15%). Πραγματικός συντελεστής επί ακαθαρίστου: 14,25%.')}
        </p>

        <h3 style={eg}>Παράδειγμα 2 · Μηνιαίο ενοίκιο 1.800€ (ετήσιο 21.600€)</h3>
        <p className="lg-p">
          {hy('Ακαθάριστα 21.600 · έκπτωση 1.080 · φορολογητέο 20.520.')}
        </p>
        <ul className="lg-ul">
          <li>12.000 × 15% = 1.800</li>
          <li>8.520 × 25% = 2.130</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>Σύνολο = 3.930€</strong> (πραγματικός ≈ 18,19%)</li>
        </ul>

        <h3 style={eg}>Παράδειγμα 3 · Το όριο των 36.000€</h3>
        <p className="lg-p">
          {hy('Α. Φορολογητέο ακριβώς 36.000€ · φόρος 9.000€ (χωρίς καθόλου 45%).')}
        </p>
        <p className="lg-p">
          {hy('Β. Ακαθάριστο 40.000€ με 5% έκπτωση · φορολογητέο 38.000 · φόρος 9.900€.')}
        </p>
        <p className="lg-p">
          {hy('Γ. Ίδιο ακαθάριστο χωρίς την έκπτωση 5% · φορολογητέο 40.000 · φόρος 10.800€ (διαφορά 900€). Η περίπτωση Γ αφορά χρήσεις από το 2027, όταν ισχύσει η κύρωση της τραπεζικής είσπραξης· για 2025-2026 εφαρμόζεται η περίπτωση Β.')}
        </p>

        {/* 5. Πηγές / νομική βάση */}
        <H2 over="5. Τεκμηρίωση" title="Νομική βάση και πηγές" />
        <div className="po-tool-sources" aria-label="Νομική βάση και πηγές" style={{ display: 'block' }}>
          <span className="po-src-badge">Νομική βάση</span>
          <ul className="lg-ul" style={{ marginTop: 12 }}>
            {SOURCES.map((s, i) => <li key={i}>{hy(s)}</li>)}
          </ul>
        </div>

        {/* CTA · υπολογιστής */}
        <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
          <SectionHead over="Υπολόγισε" title="Δες τον δικό σου φόρο, τώρα" />
          <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0, textWrap: 'pretty' }}>
            {hy('Βάλε το ενοίκιο και τους μήνες στον ')}
            <Link href="/ypologismos-forou-enoikion" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              υπολογισμό φόρου ενοικίων 2026
            </Link>
            {hy(', χωρίς εγγραφή· ο υπολογισμός γίνεται στη συσκευή σου. Ο ΕΝΦΙΑ υπολογίζεται χωριστά (')}
            <Link href="/ypologismos-enfia" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              υπολογισμός ΕΝΦΙΑ
            </Link>
            {hy('), ενώ τα τρία μαζί ως ποσοστό της αξίας τα βγάζει η ')}
            <Link href="/kathari-apodosi" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              καθαρή απόδοση
            </Link>.
          </p>
        </section>

        {/* Συχνές ερωτήσεις */}
        <section className="po-tool-more" style={{ marginTop: 'clamp(44px,6vw,72px)' }}>
          <SectionHead over="Συχνές ερωτήσεις" title="Χωρίς υπερβολές" />
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
          {hy('Ο παρών οδηγός και κάθε συνδεδεμένος υπολογισμός είναι ενδεικτικοί. Δεν αποτελούν επίσημο εκκαθαριστικό της ΑΑΔΕ, ούτε φορολογική γνωμοδότηση, ούτε υποκαθιστούν λογιστή ή φοροτεχνικό.')}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

const eg: React.CSSProperties = {
  fontSize: 16, fontWeight: 680, letterSpacing: '-0.01em', color: 'var(--text-primary)',
  margin: '22px 0 6px',
};
