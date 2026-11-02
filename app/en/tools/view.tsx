import type { Metadata } from 'next';
import { T } from '@/components/tokens';
import { siteUrl } from '@/lib/core/site';
import { TOPICS, topicAnchor } from '@/lib/core/topics';
import { breadcrumbJsonLd, HOME_CRUMB_EN } from '@/lib/seo/breadcrumbs';
import { enTools, TOPIC_EN, type EnTool } from '@/lib/i18n/en/tools';
import { TOOLS_HUB_EN as H } from '@/lib/i18n/en/pages';
import { PublicHeader, PublicFooter, JsonLd, WRAP, WRAP_PAD } from '../../PublicChrome';
import { HubSection, type HubItem } from '../../HubParts';
import { BackLink } from '../../BackLink';
import { shareImage } from '../../og/share';
import { publicMetadata } from '../../publicMetadata';

// Ο κόμβος των εργαλείων στα αγγλικά. Ιδια δομή με το app/ergaleia/page.tsx,
// μόνο με τους υπολογισμούς που έχουν αγγλική σελίδα.
const PATH = '/en/tools';
const URL = siteUrl(PATH);
const TOOLS = enTools();
export const metadata: Metadata = publicMetadata({ title: H.title, description: H.description(TOOLS.length), url: URL, image: shareImage('en-tools') });

const item = (t: EnTool): HubItem => ({ href: t.href, kicker: H.kicker, title: t.label, desc: t.desc });
const GROUPS = [
  ...TOPICS.map(t => ({ id: topicAnchor(t.id), title: TOPIC_EN[t.id], lede: H.ledes[t.id] as string | undefined, tools: TOOLS.filter(x => x.topic === t.id) })),
  { id: 'thema-alla', title: H.other, lede: undefined, tools: TOOLS.filter(x => !x.topic) },
].filter(g => g.tools.length > 0);

export default function Page() {
  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'CollectionPage', name: H.title, description: H.description(TOOLS.length), url: URL, inLanguage: 'en',
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: GROUPS.flatMap(g => g.tools).map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: siteUrl(t.href), name: t.label })),
            },
          },
          breadcrumbJsonLd([{ name: H.crumb, path: PATH }], HOME_CRUMB_EN),
        ],
      }} />
      <PublicHeader locale="en" />
      <main data-nohy="" style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <BackLink locale="en" />
        <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: T.weight.bold, letterSpacing: '-0.035em',
          lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
          {H.title}
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0, textWrap: 'pretty' }}>{H.lede}</p>
        {GROUPS.map(g => (
          <HubSection key={g.id} id={g.id} over={H.count(g.tools.length)} title={g.title} lede={g.lede}
            items={g.tools.map(item)} cta={H.cta} />
        ))}
      </main>
      <PublicFooter locale="en" />
    </div>
  );
}
