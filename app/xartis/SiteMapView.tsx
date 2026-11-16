// ═══════════════════════════════════════════════════════════════════════════
// Ο ΧΑΡΤΗΣ ΙΣΤΟΤΟΠΟΥ: /xartis ΚΑΙ /en/sitemap, ΜΙΑ ΣΥΝΘΕΣΗ ΓΙΑ ΤΙΣ ΔΥΟ ΓΛΩΣΣΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Οι σελίδες και οι ημερομηνίες τους έρχονται από το app/siteCatalog.ts, τις
// ίδιες πηγές με το /sitemap.xml. Κάθε σύνδεσμος του χάρτη έχει `data-xm`: από
// εκεί τους μαζεύει το app/siteCatalog.test.ts και τους βάζει δίπλα στο
// sitemap(). Η αγγλική σελίδα δείχνει μόνο σελίδες με αγγλική εκδοχή· οι μήνες
// των προθεσμιών είναι μόνο ελληνικοί και το λέει.
//
// Server Component, χωρίς 'use client' και χωρίς σενάριο: λίστες και άγκυρες.
// ═══════════════════════════════════════════════════════════════════════════
import Link from 'next/link';
import type { ReactNode } from 'react';
import { T } from '@/components/tokens';
import { SITE_HOST, siteUrl } from '@/lib/core/site';
import { grDate } from '@/lib/core/format';
import { breadcrumbJsonLd, HOME_CRUMB_EN } from '@/lib/seo/breadcrumbs';
import { ORG_REF, organizationNode } from '@/lib/seo/organization';
import type { Locale } from '@/lib/i18n/locale';
import { PublicHeader, PublicFooter, JsonLd, WRAP, WRAP_PAD } from '../PublicChrome';
import { BackLink } from '../BackLink';
import { LocaleLink } from '../LangSwitcher';
import { siteCatalog, catalogCounts, XARTIS_PATH, type MapEntry, type MapGroup } from '../siteCatalog';

const EN_PATH = '/en/sitemap';

const COPY = {
  el: {
    title: 'Χάρτης ιστότοπου: όλες οι σελίδες του PROPERWISE',
    h1: 'Όλες οι σελίδες του PROPERWISE',
    eyebrow: 'Χάρτης ιστότοπου',
    crumb: 'Χάρτης ιστότοπου',
    description: (n: number) => `Οι ${n} δημόσιες σελίδες του PROPERWISE ανά ενότητα: εργαλεία, οδηγοί, προθεσμίες ανά μήνα, λογιστές, λογαριασμός και νομικά, με ημερομηνία ενημέρωσης.`,
    lede: (n: number, g: number) => `${n} σελίδες σε ${g} ενότητες. Δίπλα σε κάθε σελίδα, η ημέρα της τελευταίας ουσιαστικής αλλαγής της, η ίδια που διαβάζουν οι μηχανές αναζήτησης.`,
    jump: 'Ενότητες του χάρτη',
    pages: (n: number) => `${n} ${n === 1 ? 'σελίδα' : 'σελίδες'}`,
    deadlines: (n: number) => n === 0 ? 'χωρίς προθεσμία' : `${n} ${n === 1 ? 'προθεσμία' : 'προθεσμίες'}`,
    monthsUpdated: 'Ενημέρωση ημερολογίου',
    updated: 'Ενημέρωση',
    root: 'Η αρχή του ιστότοπου',
    here: 'Είσαι εδώ',
    enOnly: null as string | null,
    machines: 'Για μηχανές και εργαλεία',
    machinesLede: 'Τα ίδια στοιχεία, στις μορφές που διαβάζουν οι μηχανές αναζήτησης, τα εργαλεία τεχνητής νοημοσύνης και οι αναγνώστες ροών.',
    files: {
      sitemap: 'Ο χάρτης για τις μηχανές αναζήτησης, με ελληνικές και αγγλικές εκδοχές.',
      robots: 'Ποιες περιοχές μένουν εκτός ευρετηρίου.',
      llms: 'Το PROPERWISE σε μία σελίδα για τα εργαλεία τεχνητής νοημοσύνης.',
      feed: 'Η ροή RSS των οδηγών, με την ημερομηνία ενημέρωσης του καθενός.',
      humans: 'Η ομάδα και τα εργαλεία πίσω από τον ιστότοπο.',
      security: 'Πού αναφέρεις ευπάθεια ασφαλείας (RFC 9116).',
    },
  },
  en: {
    title: 'Site map: every page on PROPERWISE',
    h1: 'Every page on PROPERWISE',
    eyebrow: 'Site map',
    crumb: 'Site map',
    description: (n: number) => `The ${n} public English pages of PROPERWISE, grouped as tools, guides, tax deadlines, accountants, account and legal, each with the date it was last updated.`,
    lede: (n: number, g: number) => `${n} pages in ${g} sections. Next to each page is the day it last changed in substance, the same date search engines read.`,
    jump: 'Site map sections',
    pages: (n: number) => `${n} ${n === 1 ? 'page' : 'pages'}`,
    deadlines: (n: number) => `${n}`,
    monthsUpdated: 'Calendar updated',
    updated: 'Updated',
    root: 'Where the site begins',
    here: 'You are here',
    enOnly: 'The month-by-month deadline pages are in Greek only.',
    machines: 'For machines and tools',
    machinesLede: 'The same information, in the formats read by search engines, AI tools and feed readers.',
    files: {
      sitemap: 'The map for search engines, with Greek and English versions.',
      robots: 'Which areas stay out of search indexes.',
      llms: 'PROPERWISE on one page, for AI tools (in Greek).',
      feed: 'The RSS feed of our guides, each with its update date (in Greek).',
      humans: 'The team and the tools behind the site.',
      security: 'Where to report a security vulnerability (RFC 9116).',
    },
  },
} as const;

/** Τα αρχεία για μηχανές, με τη σειρά που τα ψάχνει όποιος ξέρει πού να κοιτάξει. */
const FILES = [
  ['/sitemap.xml', 'sitemap'], ['/robots.txt', 'robots'], ['/llms.txt', 'llms'],
  ['/odigos/feed.xml', 'feed'], ['/humans.txt', 'humans'], ['/.well-known/security.txt', 'security'],
] as const;

/** Η σελίδα στη γλώσσα της σελίδας, ή `null` όταν δεν έχει αγγλική. */
const view = (e: MapEntry, locale: Locale) => locale === 'en' ? e.en : { path: e.path, label: e.label };

/** Οι ομάδες όπως τις δείχνει η σελίδα: στα αγγλικά, μόνο σελίδες με αγγλική εκδοχή. */
function groupsFor(locale: Locale): MapGroup[] {
  const all = siteCatalog();
  return locale === 'en' ? all.map(g => ({ ...g, entries: g.entries.filter(e => e.en) })) : all;
}

/** Τίτλος, περιγραφή και διεύθυνση της σελίδας, για το publicMetadata(…) της. */
export function siteMapMeta(locale: Locale): { title: string; description: string; url: string } {
  const c = COPY[locale];
  const counts = catalogCounts(siteCatalog());
  return { title: c.title, description: c.description(locale === 'en' ? counts.en : counts.el), url: siteUrl(locale === 'en' ? EN_PATH : XARTIS_PATH) };
}

/** Η επικεφαλίδα της σελίδας· το `<h1>` το γράφει η ίδια η σελίδα. */
export const siteMapH1 = (locale: Locale): string => COPY[locale].h1;
export const H1_STYLE = { fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: T.weight.bold, letterSpacing: '-0.035em', lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' } as const;

function Row({ e, locale, self }: { e: MapEntry; locale: Locale; self: string }) {
  const c = COPY[locale];
  const v = view(e, locale);
  if (!v) return null;
  const here = v.path === self;
  return (
    <li className="xm-row">
      <Link href={v.path} data-xm="" aria-current={here ? 'page' : undefined}
        className={e.hub ? 'lp-link xm-link xm-hub' : 'lp-link xm-link'}>
        {v.label}
        {here && <span className="xm-here">{c.here}</span>}
      </Link>
      <time dateTime={e.updated} className="xm-date" title={`${c.updated} ${grDate(e.updated)}`}>{grDate(e.updated)}</time>
    </li>
  );
}

function Group({ g, locale, self, wide }: { g: MapGroup; locale: Locale; self: string; wide?: boolean }) {
  const c = COPY[locale];
  const id = `xm-${g.id}`;
  const [hub, ...rest] = g.entries;
  const months = g.id === 'prothesmies';
  return (
    <section aria-labelledby={id} className={wide ? 'xm-card xm-wide' : 'xm-card'}>
      <header className="xm-head">
        <h2 id={id} className="xm-title">{locale === 'en' ? g.titleEn : g.title}</h2>
        <span className="xm-count">{c.pages(g.entries.length)}</span>
      </header>
      {months ? (
        <>
          <ul className="xm-list">{hub && <Row e={hub} locale={locale} self={self} />}</ul>
          {rest.length > 0 && (
            <ul className="xm-list xm-cols">
              {rest.map(e => (
                <li key={e.path} className="xm-row">
                  <Link href={e.path} data-xm="" className="lp-link xm-link">{e.label}</Link>
                  <span className="xm-date">{c.deadlines(e.deadlines ?? 0)}</span>
                </li>
              ))}
            </ul>
          )}
          {rest.length > 0 && (
            <p className="xm-note">
              {c.monthsUpdated}: <time dateTime={rest[0].updated}>{grDate(rest[0].updated)}</time>
            </p>
          )}
        </>
      ) : (
        <ul className="xm-list">{g.entries.map(e => <Row key={e.path} e={e} locale={locale} self={self} />)}</ul>
      )}
      {months && c.enOnly && (
        <p className="xm-note">
          {c.enOnly}{' '}
          <LocaleLink to="el" href={`${XARTIS_PATH}#xm-prothesmies`} className="lp-link xm-inline">{COPY.el.eyebrow}</LocaleLink>
        </p>
      )}
    </section>
  );
}

export function SiteMapView({ locale, heading }: { locale: Locale; heading: ReactNode }) {
  const c = COPY[locale];
  const self = locale === 'en' ? EN_PATH : XARTIS_PATH;
  const groups = groupsFor(locale).filter(g => g.entries.length > 0);
  const root = groups.find(g => g.id === 'arxiki')?.entries[0];
  const sections = groups.filter(g => g.id !== 'arxiki');
  const byId = (id: MapGroup['id']) => sections.find(g => g.id === id);
  const pair = [byId('ergaleia'), byId('odigoi')].filter((g): g is MapGroup => !!g);
  const months = byId('prothesmies');
  const trio = [byId('logistes'), byId('logariasmos'), byId('nomika')].filter((g): g is MapGroup => !!g);
  const total = groups.reduce((n, g) => n + g.entries.length, 0);
  const url = siteUrl(self);
  const rootView = root && view(root, locale);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      organizationNode(),
      {
        '@type': 'CollectionPage',
        '@id': `${url}#page`,
        url,
        name: c.title,
        description: c.description(total),
        inLanguage: locale,
        isPartOf: { '@type': 'WebSite', url: siteUrl(locale === 'en' ? '/en' : '/'), publisher: ORG_REF },
        publisher: ORG_REF,
        breadcrumb: { '@id': `${url}#breadcrumb` },
      },
      { '@id': `${url}#breadcrumb`, ...(locale === 'en' ? breadcrumbJsonLd([{ name: c.crumb, path: self }], HOME_CRUMB_EN) : breadcrumbJsonLd([{ name: c.crumb, path: self }])) },
    ],
  };

  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={jsonLd} />
      <PublicHeader locale={locale} />
      <main data-nohy="" style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <BackLink locale={locale} />
        <div className="lp-eyebrow">{c.eyebrow}</div>
        {heading}
        <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0, maxWidth: 720, textWrap: 'pretty' }}>
          {c.lede(total, sections.length)}
        </p>

        <nav aria-label={c.jump} className="xm-jump">
          {sections.map(g => (
            <a key={g.id} href={`#xm-${g.id}`} className="lp-link xm-chip">
              {locale === 'en' ? g.titleEn : g.title}
              <span className="xm-chip-n">{g.entries.length}</span>
            </a>
          ))}
        </nav>

        {root && rootView && (
          <div className="xm-root">
            <span className="xm-root-host">{SITE_HOST}</span>
            <span className="xm-root-sub">{c.root}</span>
            <ul className="xm-list xm-root-list"><Row e={root} locale={locale} self={self} /></ul>
          </div>
        )}

        <div className="xm-grid">
          {pair.map(g => <Group key={g.id} g={g} locale={locale} self={self} />)}
          {months && <Group g={months} locale={locale} self={self} wide />}
        </div>
        <div className="xm-trio">
          {trio.map(g => <Group key={g.id} g={g} locale={locale} self={self} />)}
        </div>

        <section aria-labelledby="xm-files" className="xm-files">
          <h2 id="xm-files" className="xm-title">{c.machines}</h2>
          <p className="xm-note" style={{ marginTop: 6 }}>{c.machinesLede}</p>
          <ul className="xm-file-list">
            {FILES.map(([path, key]) => (
              <li key={path} className="xm-file">
                <a href={path} className="lp-link xm-file-path">{path}</a>
                <span className="xm-file-desc">{c.files[key]}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
