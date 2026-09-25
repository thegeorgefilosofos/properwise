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
import type { CSSProperties, ReactNode } from 'react';
import { SITE, siteUrl, PRODUCT_NAME } from '@/lib/core/site';
import { monthGen } from '@/lib/core/months';
import { T } from '@/components/tokens';
import { SectionHead, WRAP, WRAP_PAD } from '../PublicChrome';
import { BackLink } from '../BackLink';
import { TocSpy } from '../TocSpy';
import { GUIDES, guideShareImageUrl, type Guide } from './guides';

const HUB = { href: '/odigos', label: 'Οδηγοί' } as const;

/** Μια ερώτηση με προαιρετικό σύνδεσμο κάτω από την απάντηση (όχι στο σχήμα). */
export type GuideFaqItem = { q: string; a: string; link?: { href: string; label: string } };

/**
 * Ο ΣΥΝΔΕΣΜΟΣ ΜΕΣΑ ΣΤΟ ΚΕΙΜΕΝΟ ΥΠΟΓΡΑΜΜΙΖΕΤΑΙ. Με μόνο χρώμα και βάρος
 * ξεχώριζε από το σώμα με αντίθεση ~1,2:1 στο σκοτεινό και ~1,05:1 στο φωτεινό,
 * κάτω από το 3:1 που ζητά το WCAG 1.4.1 όταν το χρώμα είναι το μόνο σημάδι.
 * Η γραμμή είναι λεπτή και μισοδιάφανη, ώστε να μη βαραίνει την παράγραφο.
 */
export const LINK_STYLE = {
  color: 'var(--accent)', fontWeight: 600,
  textDecoration: 'underline', textDecorationThickness: '1px', textUnderlineOffset: '3px',
  textDecorationColor: 'color-mix(in srgb, var(--accent) 45%, transparent)',
} as const;

/**
 * Η ΣΤΗΛΗ ΤΟΥ ΟΔΗΓΟΥ ΕΧΕΙ ΜΕΤΡΟ ΑΝΑΓΝΩΣΗΣ. Στα 1440 το κείμενο έπιανε όλο το
 * 1044 του WRAP, περίπου 150 χαρακτήρες ανά γραμμή. Η σελίδα κρατά το WRAP,
 * ώστε η επιστροφή να στέκεται κάτω από το λογότυπο. Η στήλη `.gd` είναι το
 * μέτρο (720, ή ό,τι αφήνει η δεξιά στήλη) και ό,τι είναι μέσα της κλείνει
 * στην ίδια δεξιά άκρη (globals.css, «ΜΙΑ ΔΕΞΙΑ ΑΚΡΗ»).
 */
export function GuideMain({ children, rail }: { children: ReactNode; rail?: GuideRailProps }) {
  return (
    <main style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
      <div className="gd-layout">
        {rail && <GuideRail {...rail} />}
        <div className="gd">
          <BackLink parent={HUB} />
          {children}
        </div>
      </div>
    </main>
  );
}

type GuideRailProps = {
  sections: readonly GuideSection[];
  /** Ο υπολογισμός του οδηγού, ο ίδιος με το `GuideCta` πιο κάτω. */
  cta: { href: string; action: string };
};

/**
 * Η ΔΕΞΙΑ ΣΤΗΛΗ ΤΗΣ ΜΕΓΑΛΗΣ ΟΘΟΝΗΣ. Σε 24 ιντσών οθόνη (1920) η στήλη των 720
 * καθόταν αριστερά στο μέτρο των 1044 και άφηνε άδειο το δεξί της τρίτο, ενώ
 * η κεφαλίδα από πάνω έφτανε ως την άκρη. Εκεί μπαίνουν τα περιεχόμενα,
 * καρφωμένα όσο κυλάς και με την ενότητα που διαβάζεις σημειωμένη και ο
 * υπολογισμός του οδηγού. Το μέτρο του κειμένου δεν αλλάζει. Κάτω από τα 1200
 * η στήλη κρύβεται και μένει το ευρετήριο μέσα στο κείμενο (`GuideToc`).
 */
function GuideRail({ sections, cta }: GuideRailProps) {
  return (
    <nav aria-label="Σε αυτόν τον οδηγό" className="lg-toc gd-rail">
      <div className="lg-toc-d">
        <div className="lg-toc-h">Σε αυτόν τον οδηγό</div>
        <TocList sections={sections} />
      </div>
      <Link href={cta.href} className="lp-cta lp-primary lp-press gd-rail-cta">{cta.action}</Link>
      <TocSpy />
    </nav>
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
      {/* Μία λέξη που δεν σπάει: το «Νομική / βάση και πηγές» κοβόταν στα 390. */}
      <a href={`#${SOURCES_SECTION.id}`} className="lp-link" style={{ ...LINK_STYLE, whiteSpace: 'nowrap' }}>Πηγές</a>
    </p>
  );
}

/** Μια αριθμημένη ενότητα του οδηγού: η άγκυρα, το «πάνω» και ο τίτλος της. */
export type GuideSection = { id: string; over: string; title: string };

/** Η ενότητα των πηγών, ίδια σε κάθε οδηγό· τα περιεχόμενα την προσθέτουν μόνα τους. */
const SOURCES_SECTION = { id: 'piges', title: 'Νομική βάση και πηγές' } as const;

/** Κεφαλίδα ενότητας μέσα στον οδηγό. */
export function GuideH2({ over, title, id }: { over: string; title: string; id?: string }) {
  return <div id={id} style={{ marginTop: 'clamp(40px,5vw,60px)', marginBottom: 16 }}><SectionHead over={over} title={title} /></div>;
}

/**
 * ΤΑ ΠΕΡΙΕΧΟΜΕΝΑ ΤΟΥ ΟΔΗΓΟΥ, ΟΠΩΣ ΣΤΙΣ ΝΟΜΙΚΕΣ ΣΕΛΙΔΕΣ. Ο οδηγός ΕΝΦΙΑ είναι
 * 5.500 εικονοστοιχεία με έξι ενότητες και ο αναγνώστης που ήθελε μόνο τις
 * απαλλαγές κυλούσε στα τυφλά. Ίδιες κλάσεις με το legal-shell: κουτί δύο
 * στηλών στον υπολογιστή, πτυσσόμενο στο κινητό. Οι τίτλοι έρχονται από τον
 * ίδιο πίνακα που τροφοδοτεί τις κεφαλίδες, οπότε δεν ξεφεύγουν.
 */
/** Ο κατάλογος των ενοτήτων, ίδιος στο κείμενο και στη δεξιά στήλη. */
function TocList({ sections }: { sections: readonly GuideSection[] }) {
  return (
    <ol className="lg-toc-list">
      {[...sections, SOURCES_SECTION].map((s, i) => (
        <li key={s.id}>
          <a href={`#${s.id}`}><span className="lg-toc-n">{i + 1}</span>{s.title}</a>
        </li>
      ))}
    </ol>
  );
}

export function GuideToc({ sections }: { sections: readonly GuideSection[] }) {
  const list = <TocList sections={sections} />;
  return (
    <nav aria-label="Σε αυτόν τον οδηγό" className="lg-toc" style={{ marginTop: 'clamp(24px,3vw,32px)' }}>
      <details className="lg-toc-m"><summary>Σε αυτόν τον οδηγό</summary>{list}</details>
      <div className="lg-toc-d"><div className="lg-toc-h">Σε αυτόν τον οδηγό</div>{list}</div>
    </nav>
  );
}

/**
 * Η ενότητα «Νομική βάση και πηγές», όπου δείχνει η γραμμή της ημερομηνίας.
 * Χωρίς το σήμα «Νομική βάση»: ακριβώς από πάνω του στεκόταν ο τίτλος με τις
 * ίδιες λέξεις.
 */
export function GuideSources({ over, sources }: { over: string; sources: string[] }) {
  return (
    <>
      <GuideH2 id={SOURCES_SECTION.id} over={over} title={SOURCES_SECTION.title} />
      <div className="po-tool-sources" aria-label={SOURCES_SECTION.title} style={{ display: 'block' }}>
        <ul className="lg-ul">
          {sources.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </div>
    </>
  );
}

/**
 * ΠΙΝΑΚΑΣ ΔΥΟ ΣΤΗΛΩΝ: ΕΤΙΚΕΤΑ ΚΑΙ ΤΙΜΗ. Απλωμένος στα 720 της στήλης άφηνε
 * ~550 εικονοστοιχεία ανάμεσα στο «έως 750€» και στο «2,00€» και το μάτι
 * έχανε τη γραμμή. Η `.gd-table` τον κρατά στενό, με εναλλασσόμενο φόντο.
 */
export function GuideTable({ caption, head, rows, min }: {
  caption: string; head: [string, string]; rows: readonly (readonly [string, string])[]; min: string;
}) {
  return (
    <div className="po-table-box gd-table" style={{ marginTop: 14 }}>
      <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
        <table className="po-table" style={{ '--tbl-min': min } as CSSProperties}>
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

/**
 * Η ΕΠΟΜΕΝΗ ΚΙΝΗΣΗ ΤΟΥ ΑΝΑΓΝΩΣΤΗ ΕΙΝΑΙ ΚΟΥΜΠΙ, ΟΧΙ ΣΥΝΔΕΣΜΟΣ ΣΕ ΠΑΡΑΓΡΑΦΟ.
 * Ο υπολογισμός και οι άλλοι οδηγοί στέκονταν ως τρεις ισοβαρείς σύνδεσμοι
 * στην ίδια πρόταση και η κύρια ενέργεια δεν ξεχώριζε. Οι οδηγοί πάνε στο
 * «Διάβασε ακόμη»· εδώ μένει ο υπολογισμός, με τη σταθερή φράση των δημόσιων
 * υπολογισμών κάτω από το κουμπί.
 */
export function GuideCta({ title, href, action, children }: {
  title: string; href: string; action: string; children: ReactNode;
}) {
  return (
    <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
      <SectionHead over="Υπολόγισε" title={title} />
      <div style={{
        padding: 'clamp(16px, 4vw, 22px)', borderRadius: T.radius.card,
        border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)',
      }}>
        <p style={{ margin: '0 0 16px', fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)', textWrap: 'pretty' }}>
          {children}
        </p>
        <Link href={href} className="lp-cta lp-primary lp-press" style={{
          display: 'inline-flex', alignItems: 'center', height: T.h.lg, padding: '0 24px',
          borderRadius: T.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none',
        }}>
          {action}
        </Link>
        <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>
          Με τα δικά σου δεδομένα. Δωρεάν, χωρίς εγγραφή.
        </p>
      </div>
    </section>
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
            <p style={{ margin: '0 0 18px', fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
              {f.a}
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
            {`: ${g.desc}`}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Το δομημένο σχήμα του οδηγού: άρθρο με την εικόνα του οδηγού και δύο
 * ημερομηνίες, διαδρομή Αρχική · Οδηγοί · οδηγός και οι συχνές ερωτήσεις.
 *
 * ΕΝΑ ΟΝΟΜΑ ΑΝΑ ΟΔΗΓΟ. Ο τίτλος του άρθρου είναι η επικεφαλίδα της σελίδας
 * (`headline`) και η διαδρομή κρατά το σύντομο όνομα του καταλόγου, που είναι
 * η αρχή της ίδιας επικεφαλίδας. Ο εκδότης δηλώνεται μία φορά με `@id` και
 * λογότυπο, όπως τον ζητά η Google για άρθρα.
 */
export function guideJsonLd({ guide, headline, description, about, faq }: {
  guide: Guide; headline: string; description: string; about: string; faq: GuideFaqItem[];
}) {
  const url = siteUrl(guide.href);
  const orgId = `${SITE}#org`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': orgId,
        name: PRODUCT_NAME,
        url: SITE,
        logo: { '@type': 'ImageObject', url: siteUrl('/icons/icon-512.png'), width: 512, height: 512 },
      },
      {
        '@type': 'Article',
        headline,
        description,
        inLanguage: 'el',
        image: siteUrl(guideShareImageUrl(guide)),
        datePublished: guide.published,
        dateModified: guide.updated,
        mainEntityOfPage: url,
        author: { '@id': orgId },
        publisher: { '@id': orgId },
        about: { '@type': 'Thing', name: about },
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
