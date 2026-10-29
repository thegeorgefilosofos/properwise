// ═══════════════════════════════════════════════════════════════════════════
// Η ΣΕΛΙΔΑ ΤΩΝ ΠΡΟΘΕΣΜΙΩΝ: σκελετός, διαδρομή, σχήμα και σύνδεσμοι
// ─────────────────────────────────────────────────────────────────────────
// Κοινός για τη ρίζα (τρέχων και επόμενος μήνας) και για κάθε μήνα. Το σχήμα
// είναι ItemList: κάθε προθεσμία μία γραμμή, με την ημερομηνία στο όνομα και
// την επίσημη πηγή ως διεύθυνση. Οχι Event: μια προθεσμία δεν είναι εκδήλωση
// με τόπο· η Google δεν δείχνει τέτοια ως αποτέλεσμα εκδήλωσης.
// ═══════════════════════════════════════════════════════════════════════════
import type { ReactNode } from 'react';
import Link from 'next/link';
import { T } from '@/components/tokens';
import { siteUrl } from '@/lib/core/site';
import { grDate } from '@/lib/core/format';
import { breadcrumbJsonLd } from '@/lib/seo/breadcrumbs';
import {
  PROTHESMIES_PATH, deadlinesOfMonth, monthLabel, monthPath, shiftMonth, upcomingMonths,
} from '@/lib/seo/prothesmies';
import { PublicHeader, PublicFooter, JsonLd, ToolCta, WRAP, WRAP_PAD } from '../PublicChrome';
import { BackLink } from '../BackLink';
import { MonthDeadlines, isEnfiaInstalment } from './MonthDeadlines';
import { ENFIA_FEWER_HINT } from '@/lib/tax/greekTaxCalendar';

export const HUB_NAME = 'Προθεσμίες ιδιοκτήτη';
export const GUIDE_PATH = '/odigos/forologikes-prothesmies-idioktiton';

/** Το σχήμα μιας σελίδας με τους μήνες της. */
export function prothesmiesJsonLd({ name, description, path, months, crumbs }: {
  name: string; description: string; path: string; months: readonly string[];
  crumbs: readonly { name: string; path: string }[];
}) {
  const items = months.flatMap(m => deadlinesOfMonth(m));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage', name, description, url: siteUrl(path), inLanguage: 'el',
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: items.map((d, i) => ({
            '@type': 'ListItem', position: i + 1,
            name: `${grDate(d.obligation.date)} · ${d.obligation.title}`,
            url: d.obligation.official_url,
          })),
        },
      },
      breadcrumbJsonLd(crumbs),
    ],
  };
}

const link = (href: string, text: ReactNode) => (
  <Link href={href} className="lp-link po-tap-inline" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{text}</Link>
);

/** Ο σκελετός: τίτλος, εισαγωγή, μήνες, πλοήγηση, υπενθυμίσεις. */
/** Το ύφος του τίτλου της σελίδας· ο ίδιος ο `<h1>` γράφεται στη σελίδα. */
export const H1_STYLE = { fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: T.weight.bold, letterSpacing: '-0.035em', lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' } as const;

export function ProthesmiesPage({ heading, intro, months, today, nav, jsonLd }: {
  heading: ReactNode; intro: ReactNode; months: readonly string[]; today: string;
  /** Ο μήνας της σελίδας, για προηγούμενο/επόμενο. Κενό στη ρίζα. */
  nav?: string; jsonLd: object;
}) {
  const ahead = upcomingMonths(today).filter(m => !months.includes(m));
  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={jsonLd} />
      <PublicHeader />
      <main data-nohy="" style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <BackLink />
        {heading}
        <p className="po-just" style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>{intro}</p>

        {months.map(m => <MonthDeadlines key={m} month={m} linkTitle={!nav} />)}
        {/* Η σημείωση για τις λιγότερες δόσεις, μία φορά ανά σελίδα. */}
        {months.some(m => deadlinesOfMonth(m).some(isEnfiaInstalment)) && (
          <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>{ENFIA_FEWER_HINT}</p>
        )}

        {nav && (
          <nav aria-label="Άλλοι μήνες" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginTop: 24 }}>
            {deadlinesOfMonth(shiftMonth(nav, -1)).length > 0
              ? link(monthPath(shiftMonth(nav, -1)), `Προηγούμενος μήνας: ${monthLabel(shiftMonth(nav, -1))}`) : <span />}
            {deadlinesOfMonth(shiftMonth(nav, 1)).length > 0
              ? link(monthPath(shiftMonth(nav, 1)), `Επόμενος μήνας: ${monthLabel(shiftMonth(nav, 1))}`) : <span />}
          </nav>
        )}

        <ToolCta
          title="Οι υπενθυμίσεις έρχονται μόνες τους"
          body={<>Η εφαρμογή γράφει αυτές τις προθεσμίες στο ημερολόγιο του ακινήτου σου και σου στέλνει υπενθύμιση με
            email ή ειδοποίηση στο κινητό, με το ποσό της δόσης όταν το ξέρει.</>} />

        <section style={{ marginTop: 'clamp(28px,4vw,40px)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 10px' }}>Οι επόμενοι μήνες</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
            {ahead.map(m => <li key={m}>{link(monthPath(m), monthLabel(m))}</li>)}
            {nav && <li>{link(PROTHESMIES_PATH, 'Τρέχων και επόμενος μήνας')}</li>}
          </ul>
          <p style={{ margin: '16px 0 0', fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            Τι σημαίνει κάθε προθεσμία και ποιος την κάνει το εξηγεί ο {link(GUIDE_PATH, 'οδηγός για τις φορολογικές προθεσμίες')}.
            Το ποσό του ΕΝΦΙΑ το βγάζει ο {link('/ypologismos-enfia', 'υπολογισμός ΕΝΦΙΑ')} και τον φόρο των ενοικίων ο{' '}
            {link('/ypologismos-forou-enoikion', 'υπολογισμός φόρου ενοικίων')}.
          </p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
