// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΚΟΙΝΑ ΚΟΜΜΑΤΙΑ ΤΩΝ ΤΕΣΣΑΡΩΝ ΟΔΗΓΩΝ
// ─────────────────────────────────────────────────────────────────────────
// Κάθε οδηγός έγραφε με το χέρι τη στήλη, την ημερομηνία, τις πηγές, τις
// συχνές ερωτήσεις και το δομημένο σχήμα, τέσσερις φορές. Οι διορθώσεις
// έπρεπε να γίνουν τέσσερις φορές και η πρώτη που ξεχνιόταν άφηνε έναν οδηγό
// διαφορετικό από τους άλλους: π.χ. το «+» των ερωτήσεων που διάβαζε ο
// αναγνώστης οθόνης ως «συν», ή ο οδηγός απόδοσης χωρίς ημερομηνία.
//
// Server Components, καμία εξάρτηση από 'use client' (εκτός του BackLink).
// ═══════════════════════════════════════════════════════════════════════════
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SITE, siteUrl, PRODUCT_NAME } from '@/lib/core/site';
import { monthGen } from '@/lib/core/months';
import { hy } from '@/components/Hyphen';
import { SectionHead, WRAP, WRAP_PAD, READING } from '../PublicChrome';
import { BackLink } from '../BackLink';
import { SHARE_IMAGE } from '@/lib/core/site';
import { GUIDES, type Guide } from './guides';

const HUB = { href: '/odigos', label: 'Οδηγοί' } as const;

/** Μια ερώτηση με προαιρετικό σύνδεσμο κάτω από την απάντηση (όχι στο σχήμα). */
export type GuideFaqItem = { q: string; a: string; link?: { href: string; label: string } };

const LINK_STYLE = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } as const;

/**
 * Η ΣΤΗΛΗ ΤΟΥ ΟΔΗΓΟΥ ΕΧΕΙ ΜΕΤΡΟ ΑΝΑΓΝΩΣΗΣ. Στα 1440 το κείμενο έπιανε όλο το
 * 1044 του WRAP, περίπου 150 χαρακτήρες ανά γραμμή. Η σελίδα κρατά το WRAP,
 * ώστε η επιστροφή να στέκεται κάτω από το λογότυπο· η στήλη σταματά στο READING.
 */
export function GuideMain({ children }: { children: ReactNode }) {
  return (
    <main style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
      <div style={{ maxWidth: READING }}>
        <BackLink parent={HUB} />
        {children}
      </div>
    </main>
  );
}

/** «23 Σεπτεμβρίου 2026» από ISO ημερομηνία. */
function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${monthGen(m - 1)} ${y}`;
}

/**
 * Η ΑΚΡΙΒΗΣ ΗΜΕΡΟΜΗΝΙΑ ΚΑΙ ΤΟ ΠΟΥ ΣΤΗΡΙΖΕΤΑΙ Ο ΟΔΗΓΟΣ. Το «όπως ισχύει τον
 * Σεπτέμβριο» δεν έλεγε ποια μέρα και ο οδηγός απόδοσης δεν είχε καθόλου
 * ημερομηνία. Ο σύνδεσμος πάει στις πηγές του ίδιου του οδηγού.
 */
export function GuideUpdated({ guide }: { guide: Guide }) {
  return (
    <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 18px' }}>
      Τελευταία ενημέρωση: <time dateTime={guide.updated}>{longDate(guide.updated)}</time>
      {' · '}
      <a href="#piges" className="lp-link" style={LINK_STYLE}>Νομική βάση και πηγές</a>
    </p>
  );
}

/** Κεφαλίδα ενότητας μέσα στον οδηγό. */
export function GuideH2({ over, title, id }: { over: string; title: string; id?: string }) {
  return <div id={id} style={{ marginTop: 'clamp(40px,5vw,60px)', marginBottom: 16 }}><SectionHead over={over} title={title} /></div>;
}

/** Η ενότητα «Νομική βάση και πηγές», όπου δείχνει η γραμμή της ημερομηνίας. */
export function GuideSources({ over, sources }: { over: string; sources: string[] }) {
  return (
    <>
      <GuideH2 id="piges" over={over} title="Νομική βάση και πηγές" />
      <div className="po-tool-sources" aria-label="Νομική βάση και πηγές" style={{ display: 'block' }}>
        <span className="po-src-badge">Νομική βάση</span>
        <ul className="lg-ul" style={{ marginTop: 12 }}>
          {sources.map((s, i) => <li key={i}>{hy(s)}</li>)}
        </ul>
      </div>
    </>
  );
}

/**
 * ΟΙ ΣΥΧΝΕΣ ΕΡΩΤΗΣΕΙΣ. Το «+» είναι διακόσμηση και κρύβεται από τον αναγνώστη
 * οθόνης, που αλλιώς διάβαζε «...ανά διανυκτέρευση; συν». Όπου η απάντηση
 * παραπέμπει σε άλλη σελίδα, ο σύνδεσμος μπαίνει κάτω της.
 */
export function GuideFaq({ title, faq }: { title: string; faq: GuideFaqItem[] }) {
  return (
    <section className="po-tool-more" style={{ marginTop: 'clamp(44px,6vw,72px)' }}>
      <SectionHead over="Συχνές ερωτήσεις" title={title} />
      <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {faq.map(f => (
          <details key={f.q} className="lp-faq">
            <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '17px 0', fontSize: 15,
              fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              {f.q}
              <span className="lp-plus" aria-hidden="true" style={{ color: 'var(--accent)', fontSize: 20, fontWeight: 450, lineHeight: 1, transition: 'transform .2s', flexShrink: 0 }}>+</span>
            </summary>
            <p className="po-just" style={{ margin: '0 0 18px', fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
              {hy(f.a)}
            </p>
            {f.link && (
              <p style={{ margin: '-6px 0 18px', fontSize: 14 }}>
                <Link href={f.link.href} className="lp-link" style={LINK_STYLE}>{f.link.label}</Link>
              </p>
            )}
          </details>
        ))}
      </div>
    </section>
  );
}

/** Οι άλλοι οδηγοί, ώστε κανένας να μη μένει αδιέξοδο. */
export function RelatedGuides({ current }: { current: Guide }) {
  return (
    <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
      <SectionHead over="Σχετικοί οδηγοί" title="Διάβασε ακόμη" />
      <ul className="lg-ul">
        {GUIDES.filter(g => g.href !== current.href).map(g => (
          <li key={g.href}>
            <Link href={g.href} className="lp-link" style={LINK_STYLE}>{g.title}</Link>
            {hy(`: ${g.desc}`)}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Το δομημένο σχήμα του οδηγού: άρθρο με εικόνα και δύο ημερομηνίες, διαδρομή
 * Αρχική · Οδηγοί · οδηγός και οι συχνές ερωτήσεις.
 */
export function guideJsonLd({ guide, headline, description, about, faq }: {
  guide: Guide; headline: string; description: string; about: string; faq: GuideFaqItem[];
}) {
  const url = siteUrl(guide.href);
  const org = { '@type': 'Organization', name: PRODUCT_NAME, url: SITE };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline,
        description,
        inLanguage: 'el',
        image: siteUrl(SHARE_IMAGE.url),
        datePublished: guide.published,
        dateModified: guide.updated,
        mainEntityOfPage: url,
        author: org,
        publisher: org,
        about,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Αρχική', item: SITE },
          { '@type': 'ListItem', position: 2, name: HUB.label, item: siteUrl(HUB.href) },
          { '@type': 'ListItem', position: 3, name: guide.title, item: url },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };
}
