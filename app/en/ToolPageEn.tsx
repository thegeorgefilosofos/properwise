import type { ReactNode } from 'react';
import { T } from '@/components/tokens';
import { ORG_ID, PRODUCT_NAME, SITE, siteUrl } from '@/lib/core/site';
import { breadcrumbJsonLd, HOME_CRUMB_EN } from '@/lib/seo/breadcrumbs';
import { TOOL_SHELL_EN } from '@/lib/i18n/en/tools/shell';
import { PublicHeader, PublicFooter, JsonLd, SectionHead, ToolLede, ToolSources, WRAP, WRAP_PAD } from '../PublicChrome';
import { BackLink } from '../BackLink';

// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΟΙΝΗ ΣΕΛΙΔΑ ΤΩΝ ΑΓΓΛΙΚΩΝ ΥΠΟΛΟΓΙΣΤΩΝ
// ─────────────────────────────────────────────────────────────────────────
// Ιδια σειρά με τις ελληνικές (κεφαλίδα, τίτλος, εισαγωγή, υπολογιστής,
// πηγές, συχνές ερωτήσεις), ίδια συστατικά με `locale="en"`. Κάθε αγγλικός
// υπολογιστής δίνει μόνο τα δικά του: τίτλο, εισαγωγή, πηγές, ερωτήσεις.
// ═══════════════════════════════════════════════════════════════════════════
type SourcesKind = Parameters<typeof ToolSources>[0]['kind'];

export function ToolPageEn({ path, name, label, description, h1, lede, lawYear, sources, faq, children, after }: {
  path: string; name: string; label: string; description: string; h1: string; lede: ReactNode;
  lawYear?: number;
  sources: { kind: SourcesKind; checked: string | null; updated?: string | null };
  faq: readonly { q: string; a: string }[];
  children: ReactNode;
  after?: ReactNode;
}) {
  const url = siteUrl(path);
  const allFaq = [...faq, TOOL_SHELL_EN.privacy];
  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebApplication', name, url, applicationCategory: 'FinanceApplication', operatingSystem: 'Web',
            inLanguage: 'en', description, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
            publisher: { '@type': 'Organization', '@id': ORG_ID, name: PRODUCT_NAME, url: SITE },
          },
          breadcrumbJsonLd([{ name: 'Tools', path: '/en/tools' }, { name: label, path }], HOME_CRUMB_EN),
          { '@type': 'FAQPage', inLanguage: 'en', mainEntity: allFaq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        ],
      }} />
      <PublicHeader locale="en" />
      <main style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <BackLink locale="en" parent={{ href: '/en/tools', label: 'Tools' }} />
        <div className="lp-eyebrow">{TOOL_SHELL_EN.eyebrow}</div>
        <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: T.weight.bold, letterSpacing: '-0.035em',
          lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
          {h1}
        </h1>
        <ToolLede locale="en" lawYear={lawYear}>{lede}</ToolLede>
        {children}
        <ToolSources locale="en" {...sources} />
        {after}
        <section className="po-tool-more" style={{ marginTop: 'clamp(44px,6vw,72px)' }}>
          <SectionHead over={TOOL_SHELL_EN.faqOver} title={TOOL_SHELL_EN.faqTitle} />
          <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {allFaq.map(f => (
              <details key={f.q} className="lp-faq">
                <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '17px 0', fontSize: 15,
                  fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  {f.q}
                  <span className="lp-plus" style={{ color: 'var(--accent)', fontSize: 20, fontWeight: 450,
                    lineHeight: 1, transition: 'transform .2s', flexShrink: 0 }}>+</span>
                </summary>
                <p style={{ margin: '0 0 18px', fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)', textWrap: 'pretty' }}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
        <p style={{ margin: 'clamp(28px,4vw,40px) 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--text-tertiary)' }}>{TOOL_SHELL_EN.byline}</p>
      </main>
      <PublicFooter locale="en" />
    </div>
  );
}
