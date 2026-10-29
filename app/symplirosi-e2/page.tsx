// ═══════════════════════════════════════════════════════════════════════════
// ΔΩΡΕΑΝ ΟΔΗΓΟΣ: «Ε2: ΤΙ ΓΡΑΦΩ ΠΟΥ» — /symplirosi-e2
// ─────────────────────────────────────────────────────────────────────────
// Ο επισκέπτης δίνει τύπο, χρήση, μίσθωμα και διάστημα· η σελίδα δείχνει τι
// μπαίνει σε κάθε στήλη του Ε2 και σε ποιον κωδικό του Ε1 πηγαίνει το ποσό.
// Η μηχανή είναι η ίδια με το Ε2 της πύλης του λογιστή (lib/tools/e2Odigos.ts →
// lib/billing/e2.ts), με τις πηγές της: Ε2 Φ-01.002 και Ε1 πίνακας 4Δ2.
// ═══════════════════════════════════════════════════════════════════════════
import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { T } from '@/components/tokens';
import { siteUrl } from '@/lib/core/site';
import { athensToday } from '@/lib/core/time';
import { fe } from '@/lib/core/format';
import { e2Guide } from '@/lib/tools/e2Odigos';
import { E2_USE } from '@/lib/billing/e2';
import { PublicHeader, PublicFooter, JsonLd, SectionHead, ToolLede, ToolSources, ToolCta, TOOL_PRIVACY_FAQ, WRAP, WRAP_PAD } from '../PublicChrome';
import { ToolGuides } from '../odigos/ToolGuides';
import { guideAt } from '../odigos/guides';
import { hy } from '@/components/Hyphen';
import { BackLink } from '../BackLink';
import { shareImage } from '../og/share';
import { publicMetadata } from '../publicMetadata';
import { PAGE_UPDATED } from '../pageUpdated';
import { toolJsonLd, ToolByline, ToolOnwardLinks } from '../toolSeo';
import { E2Calculator } from './E2Calculator';
import { PATH } from './spec';

const URL = siteUrl(PATH);
const H1 = 'Ε2: τι γράφω πού';
const TITLE = 'Συμπλήρωση Ε2 βήμα βήμα: τι γράφεις σε κάθε στήλη και σε ποιον κωδικό του Ε1';
const DESC = 'Δώσε τύπο ακινήτου, χρήση, μίσθωμα και μήνες: η σελίδα δείχνει τι γράφεις σε κάθε στήλη του Ε2 και σε ποιον κωδικό του Ε1 πηγαίνει το ποσό.';

export const metadata: Metadata = publicMetadata({ title: TITLE, description: DESC, url: URL, image: shareImage('symplirosi-e2') });

// ── ΤΑ ΠΑΡΑΔΕΙΓΜΑΤΑ, ΑΠΟ ΤΗ ΜΗΧΑΝΗ ─────────────────────────────────────────
const YEAR = Number(PAGE_UPDATED[PATH].slice(0, 4)) - 1;
const HOME = e2Guide({ year: YEAR, propType: 'apartment', use: 'lease', leaseCategory: 'residential', monthly: 600, from: `${YEAR}-03-01`, ownershipPct: 50 });
const SHOP = e2Guide({ year: YEAR, propType: 'shop', use: 'lease', leaseCategory: 'commercial', monthly: 1000 });
const col = (g: ReturnType<typeof e2Guide>, no: number) => g.cells.find(c => c.no === no)?.value ?? '';

type FaqItem = { q: string; a: string };
const FAQ: FaqItem[] = [
  {
    q: 'Τι γράφω στη στήλη 13;',
    a: `Το ακαθάριστο που αναλογεί στο δικό σου ποσοστό: μηνιαίο μίσθωμα επί μήνες επί ποσοστό. Διαμέρισμα με ${fe(600)} `
     + `από τον Μάρτιο, μισό δικό σου: ${col(HOME, 10)} μήνες, στη στήλη 13 ${fe(HOME.gross)}.`,
  },
  {
    q: 'Σε ποιον κωδικό του Ε1 πηγαίνει το ενοίκιο;',
    a: `Ανάλογα με τον τύπο: κατοικία στον ${HOME.e1.lines[0]?.code} (${HOME.e1.lines[0]?.spouseCode} για τον ή τη σύζυγο), `
     + `κατάστημα ή γραφείο στον ${SHOP.e1.lines[0]?.code} (${SHOP.e1.lines[0]?.spouseCode}). ${HOME.e1.note}`,
  },
  {
    q: 'Τι γράφω για κενό ή ιδιοχρησιμοποιούμενο ακίνητο;',
    a: `Στη στήλη 17 «${E2_USE.vacant}» για το κενό ή «${E2_USE.ownUse}» για όσο το χρησιμοποιείς εσύ, χωρίς μίσθωμα και χωρίς κωδικό στο Ε1.`,
  },
  {
    q: 'Και η βραχυχρόνια μίσθωση;',
    a: `Στη στήλη 17 γράφεται «${E2_USE.shortTerm}» και το ακαθάριστο είναι το άθροισμα των διαμονών, όχι μηνιαίο μίσθωμα. `
     + 'Ο οδηγός αυτός δεν τις ζητά· τα καθαρά της τα δείχνει η σύγκριση βραχυχρόνιας και μακροχρόνιας μίσθωσης.',
  },
  {
    q: 'Πού γράφω τις δαπάνες του ακινήτου;',
    a: 'Πουθενά στο Ε2. Η τεκμαρτή έκπτωση των δαπανών εφαρμόζεται μόνη της στην εκκαθάριση. Οι δαπάνες ανακαίνισης '
     + 'που δίνουν μείωση φόρου δηλώνονται χωριστά, στους δικούς τους κωδικούς του Ε1.',
  },
  TOOL_PRIVACY_FAQ,
];

const LINK = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } as const;

export default function Page() {
  const today = athensToday();
  const guide = guideAt('/odigos/forologia-enoikion-2026');
  const jsonLd = toolJsonLd({ name: 'Ε2: τι γράφω πού', url: URL, description: DESC, faq: FAQ });
  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={jsonLd} />
      <PublicHeader />
      <main style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <BackLink />
        <div className="lp-eyebrow">Οδηγός συμπλήρωσης</div>
        <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: T.weight.bold, letterSpacing: '-0.035em', lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
          {H1}
        </h1>
        <ToolLede>{`Τι γράφεις σε κάθε στήλη του Ε2 για ένα ακίνητο και σε ποιον κωδικό του Ε1 πηγαίνει το ποσό, με τη μηχανή που γεμίζει το Ε2 του λογιστή.`}</ToolLede>

        <Suspense fallback={<div style={{ minHeight: 720 }} aria-hidden/>}>
          <E2Calculator today={today} cta={
            <ToolCta title="Θέλεις όλο το Ε2 έτοιμο για τον λογιστή;"
              body="Το PROPERWISE γεμίζει το Ε2 για όλα σου τα ακίνητα από τις μισθώσεις και τις εισπράξεις, με όλους τους μισθωτές και τα διαστήματα· το δίνει έτοιμο στον λογιστή σου."/>
          }/>
        </Suspense>

        <ToolSources kind="e2" checked={null} updated={PAGE_UPDATED[PATH]} />

        <section className="po-tool-more" style={{ marginTop: 'clamp(44px,6vw,72px)' }}>
          <SectionHead over="Συχνές ερωτήσεις" title="Ό,τι ρωτούν πριν υποβάλουν το Ε2" />
          <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {FAQ.map(f => (
              <details key={f.q} className="lp-faq">
                <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '17px 0', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  {f.q}
                  <span className="lp-plus" style={{ color: 'var(--accent)', fontSize: 20, fontWeight: T.weight.body, lineHeight: 1, transition: 'transform .2s', flexShrink: 0 }}>+</span>
                </summary>
                <p className="po-just" style={{ margin: '0 0 18px', fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)' }}>{hy(f.a)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
          <SectionHead over="Και μετά" title="Από το Ε2 στον φόρο" />
          <p className="po-just" style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>{hy(<>
            Πόσος φόρος βγαίνει από αυτό το ακαθάριστο το δείχνει ο{' '}
            <Link href="/ypologismos-forou-enoikion" className="lp-link" style={LINK}>υπολογισμός φόρου ενοικίων</Link>
            · την κλίμακα και την τεκμαρτή έκπτωση τις εξηγεί ο οδηγός{' '}
            <Link href={guide.href} className="lp-link" style={LINK}>{guide.title}</Link>. Για τη βραχυχρόνια, η{' '}
            <Link href="/vraxyxronia-i-makroxronia" className="lp-link" style={LINK}>σύγκριση βραχυχρόνιας και μακροχρόνιας</Link>.
          </>)}</p>
          <ToolOnwardLinks />
        </section>
        <ToolByline />
        <ToolGuides tool="/symplirosi-e2" />
      </main>
      <PublicFooter />
    </div>
  );
}
