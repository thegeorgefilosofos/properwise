import type { Metadata } from 'next';
import Link from 'next/link';
import { T } from '@/components/tokens';
import { siteUrl } from '@/lib/core/site';
import { athensToday } from '@/lib/core/time';
import { fmtFor } from '@/lib/core/format';
import { breadcrumbJsonLd, HOME_CRUMB_EN } from '@/lib/seo/breadcrumbs';
import { deadlinesOfMonth, monthKeyOf, shiftMonth } from '@/lib/seo/prothesmies';
import { DEADLINES_EN as D, deadlineTitleEn, monthLabelEn } from '@/lib/i18n/en/deadlines';
import { PublicHeader, PublicFooter, JsonLd, ToolCta, WRAP, WRAP_PAD } from '../../PublicChrome';
import { BackLink } from '../../BackLink';
import { publicMetadata } from '../../publicMetadata';
import { shareImage } from '../../og/share';
import { isEnfiaInstalment } from '../../prothesmies/MonthDeadlines';
import { H1_STYLE } from '../../prothesmies/view';

// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΠΡΟΘΕΣΜΙΕΣ ΣΤΑ ΑΓΓΛΙΚΑ: ΜΟΝΟ Ο ΚΟΜΒΟΣ, ΟΧΙ ΟΙ ΣΕΛΙΔΕΣ ΑΝΑ ΜΗΝΑ
// ─────────────────────────────────────────────────────────────────────────
// Το /prothesmies δείχνει τον τρέχοντα και τον επόμενο μήνα· το
// /prothesmies/yyyy-mm είναι δώδεκα σελίδες ανά μήνα για αναζήτηση στα
// ελληνικά. Στα αγγλικά μπαίνει μόνο ο κόμβος, μέσα από τον ίδιο διανομέα
// (καμία νέα συνάρτηση διακομιστή): ο ξένος ιδιοκτήτης ρωτά «τι λήγει
// τώρα», όχι «τι λήγει τον Ιούλιο του επόμενου έτους». Οι σελίδες ανά μήνα
// μένουν ελληνικές και η αγγλική σελίδα δεν δείχνει προς αυτές.
// ═══════════════════════════════════════════════════════════════════════════
const PATH = '/en/tax-deadlines';
const months = (today: string) => [monthKeyOf(today), shiftMonth(monthKeyOf(today), 1)];
const titleOf = (today: string) => { const [a, b] = months(today); return D.title(monthLabelEn(a), monthLabelEn(b)); };
const descOf = (today: string) => {
  const [a, b] = months(today);
  return D.description(deadlinesOfMonth(a).length + deadlinesOfMonth(b).length, monthLabelEn(a), monthLabelEn(b));
};

export function generateMetadata(): Metadata {
  const today = athensToday();
  return publicMetadata({ title: titleOf(today), description: descOf(today), url: siteUrl(PATH), image: shareImage('en-tax-deadlines') });
}

const LINK = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } as const;

function Month({ month }: { month: string }) {
  const f = fmtFor('en');
  const rows = deadlinesOfMonth(month);
  const label = monthLabelEn(month);
  return (
    <section aria-labelledby={`m-${month}`} style={{ marginTop: 'clamp(28px,4vw,40px)' }}>
      <h2 id={`m-${month}`} style={{ fontSize: 'clamp(20px,2.4vw,24px)', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 12px' }}>{label}</h2>
      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 15, color: 'var(--text-secondary)' }}>{D.none}</p>
      ) : (
        <div className="po-table-box gd-table">
          <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
            <table className="po-table po-stack" style={{ ['--tbl-min' as string]: '420px' }}>
              <caption>{D.caption(label)}</caption>
              <thead>
                <tr>
                  <th scope="col">{D.obligation}</th>
                  <th scope="col" className="num">{D.by}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(d => (
                  <tr key={d.obligation.id}>
                    <th scope="row">
                      <span style={{ display: 'block', color: 'var(--text-primary)', fontWeight: 600 }}>{deadlineTitleEn(d)}</span>
                      <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {d.shortTermOnly ? D.shortOnly : D.everyone} · {D.confidence[d.obligation.confidence]} ·{' '}
                        <a href={d.obligation.official_url} target="_blank" rel="noopener noreferrer" className="lp-link po-tap-inline"
                          style={{ color: 'var(--accent)', textDecoration: 'none' }}>{D.source}</a>
                      </span>
                    </th>
                    <td className="num gd-date po-stack-lead">{f.date(d.obligation.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

export default function Page() {
  const today = athensToday();
  const ms = months(today);
  const f = fmtFor('en');
  const items = ms.flatMap(m => deadlinesOfMonth(m));
  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'CollectionPage', name: titleOf(today), description: descOf(today), url: siteUrl(PATH), inLanguage: 'en',
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: items.map((d, i) => ({ '@type': 'ListItem', position: i + 1, name: `${f.date(d.obligation.date)} · ${deadlineTitleEn(d)}`, url: d.obligation.official_url })),
            },
          },
          breadcrumbJsonLd([{ name: D.hub, path: PATH }], HOME_CRUMB_EN),
        ],
      }} />
      <PublicHeader locale="en" />
      <main data-nohy="" style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <BackLink locale="en" />
        <h1 style={H1_STYLE}>{titleOf(today)}</h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0, textWrap: 'pretty' }}>{D.intro}</p>
        {ms.map(m => <Month key={m} month={m} />)}
        {ms.some(m => deadlinesOfMonth(m).some(isEnfiaInstalment)) && (
          <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>{D.fewer}</p>
        )}
        <ToolCta locale="en" title={D.ctaTitle} body={D.ctaBody} />
        <p style={{ margin: 'clamp(28px,4vw,40px) 0 0', fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          {D.more[0]}<Link href="/en/enfia-calculator" className="lp-link po-tap-inline" style={LINK}>{D.more[1]}</Link>
          {D.more[2]}<Link href="/en/rental-income-tax-calculator" className="lp-link po-tap-inline" style={LINK}>{D.more[3]}</Link>{D.more[4]}
        </p>
      </main>
      <PublicFooter locale="en" />
    </div>
  );
}
