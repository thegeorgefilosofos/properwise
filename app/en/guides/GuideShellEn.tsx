import type { ReactNode } from 'react';
import { T } from '@/components/tokens';
import { ORG_ID, PRODUCT_NAME, SITE, siteUrl } from '@/lib/core/site';
import { fmtFor } from '@/lib/core/format';
import { breadcrumbJsonLd, HOME_CRUMB_EN } from '@/lib/seo/breadcrumbs';
import { GUIDE_SHELL_EN as S, enGuides } from '@/lib/i18n/en/guides';
import { PublicHeader, PublicFooter, JsonLd, SectionHead, WRAP, WRAP_PAD } from '../../PublicChrome';
import { BackLink } from '../../BackLink';
import { LocaleLink } from '../../LangSwitcher';
import { guideAt } from '../../odigos/guides';
import { GuideH2 } from '../../odigos/GuideParts';

// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΟΙΝΗ ΣΕΛΙΔΑ ΤΩΝ ΑΓΓΛΙΚΩΝ ΟΔΗΓΩΝ
// ─────────────────────────────────────────────────────────────────────────
// Ιδια διάταξη με τους ελληνικούς (στήλη `.gd`, ευρετήριο, ενότητες, πηγές,
// υπολογισμός, ερωτήσεις, σχετικοί). Οι ημερομηνίες είναι του ελληνικού οδηγού.
// ═══════════════════════════════════════════════════════════════════════════
export type EnSection = { id: string; over: string; title: string; body: ReactNode };
export type EnFaq = { q: string; a: string };

const LINK = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } as const;

export function GuideShellEn({ el, path, h1, description, about, intro, sections, sources, faq, faqTitle, cta }: {
  el: string; path: string; h1: string; description: string; about: string;
  intro: ReactNode; sections: readonly EnSection[]; sources: readonly ReactNode[];
  faq: readonly EnFaq[]; faqTitle: string;
  cta: { title: string; href: string; action: string; body: ReactNode };
}) {
  const guide = guideAt(el);
  const f = fmtFor('en');
  const toc = [...sections, { id: 'sources', title: S.sourcesTitle }];
  const related = enGuides().filter(g => g.el !== el);
  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Article', headline: h1, description, inLanguage: 'en',
            datePublished: guide.published, dateModified: guide.updated, mainEntityOfPage: siteUrl(path),
            author: { '@id': ORG_ID }, publisher: { '@type': 'Organization', '@id': ORG_ID, name: PRODUCT_NAME, url: SITE },
            about: { '@type': 'Thing', name: about },
          },
          breadcrumbJsonLd([{ name: 'Guides', path: '/en/guides' }, { name: h1, path }], HOME_CRUMB_EN),
          { '@type': 'FAQPage', inLanguage: 'en', mainEntity: faq.map(x => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) },
        ],
      }} />
      <PublicHeader locale="en" current="odigos" />
      <main style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <div className="gd">
          <BackLink locale="en" parent={{ href: '/en/guides', label: 'Guides' }} />
          <div className="lp-eyebrow">{S.eyebrow}</div>
          <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: T.weight.bold, letterSpacing: '-0.035em',
            lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
            {h1}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>
            {S.updated}: <time dateTime={guide.updated}>{f.date(guide.updated)}</time>{' · '}
            <a href="#sources" className="lp-link" style={LINK}>{S.sources}</a>{' · '}
            {S.translated}{' '}<LocaleLink to="el" href={el} className="lp-link">{S.readGreek}</LocaleLink>
          </p>
          <nav aria-label={S.toc} className="lg-toc" style={{ marginTop: 'clamp(24px,3vw,32px)' }}>
            <div className="lg-toc-h">{S.toc}</div>
            <ol className="lg-toc-list">
              {toc.map((s, i) => <li key={s.id}><a href={`#${s.id}`}><span className="lg-toc-n">{i + 1}</span>{s.title}</a></li>)}
            </ol>
          </nav>
          {intro}
          {sections.map(s => (
            <section key={s.id}>
              <GuideH2 id={s.id} over={s.over} title={s.title} />
              {s.body}
            </section>
          ))}
          <GuideH2 id="sources" over={`${sections.length + 1}. ${S.sources}`} title={S.sourcesTitle} />
          <div className="po-tool-sources" style={{ display: 'block' }}>
            <ul className="lg-ul">{sources.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
          <section className="po-tool-more" style={{ marginTop: 'clamp(44px,6vw,72px)' }}>
            <SectionHead over={S.calcOver} title={cta.title} />
            <p className="lg-p">{cta.body}</p>
            <a href={cta.href} className="lp-cta lp-primary lp-press" style={{ display: 'inline-flex', marginTop: 8 }}>{cta.action}</a>
            <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>{S.calcNote}</p>
          </section>
          <section className="po-tool-more" style={{ marginTop: 'clamp(44px,6vw,72px)' }}>
            <SectionHead over={S.faqOver} title={faqTitle} />
            <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {faq.map(x => (
                <details key={x.q} className="lp-faq">
                  <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '17px 0', fontSize: 15,
                    fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    {x.q}
                    <span className="lp-plus" style={{ color: 'var(--accent)', fontSize: 20, fontWeight: T.weight.body,
                      lineHeight: 1, transition: 'transform .2s', flexShrink: 0 }}>+</span>
                  </summary>
                  <p style={{ margin: '0 0 18px', fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)', textWrap: 'pretty' }}>{x.a}</p>
                </details>
              ))}
            </div>
          </section>
          {related.length > 0 && (
            <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
              <SectionHead over={S.related} title="Read next" />
              <ul className="lg-ul">
                {related.map(g => <li key={g.href}><a href={g.href} className="lp-link" style={LINK}>{g.title}</a>: {g.desc}</li>)}
              </ul>
            </section>
          )}
          <div className="lg-note lg-note-fine" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>{S.disclaimer}</div>
        </div>
      </main>
      <PublicFooter locale="en" />
    </div>
  );
}
