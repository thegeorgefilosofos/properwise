import type { Metadata } from 'next';
import { siteUrl } from '@/lib/core/site';
import { RECOMMENDED_PLAN } from '@/lib/billing/plans';
import { TRIAL_PLAN } from '@/lib/billing/entitlements';
import { trialOfferEn } from '@/lib/billing/trialOffer';
import { billingWordsEn, PRICES_VAT_EN, CANCEL_ANYTIME_EN } from '@/lib/legal/billingWords';
import { breadcrumbJsonLd, HOME_CRUMB_EN } from '@/lib/seo/breadcrumbs';
import { PLAN_COPY_EN } from '@/lib/i18n/en/plans';
import { PRICING_EN } from '@/lib/i18n/en/pages';
import { PlanMatrix } from '@/components/PlanMatrix';
import { PublicHeader, PublicFooter, JsonLd, WRAP, WRAP_PAD } from '../../PublicChrome';
import { BackLink } from '../../BackLink';
import { publicMetadata } from '../../publicMetadata';
import { shareImage } from '../../og/share';
import { PaymentsBadge } from '../../paketa/PaymentsBadge';

// Οι τιμές στα αγγλικά: ο ίδιος πίνακας (components/PlanMatrix.tsx) με
// `locale="en"`, οι ίδιοι αριθμοί από το lib/billing/plans.ts.
const PATH = '/en/pricing';
const URL = siteUrl(PATH);
export const metadata: Metadata = publicMetadata({ title: PRICING_EN.title, description: PRICING_EN.description, url: URL, image: shareImage('en-pricing') });

export default function Page() {
  const words = billingWordsEn();
  return (
    <div className="pub-root min-h-dvh" data-mode="dark">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebPage', name: PRICING_EN.title, description: PRICING_EN.description, url: URL, inLanguage: 'en' },
          breadcrumbJsonLd([{ name: PRICING_EN.crumb, path: PATH }], HOME_CRUMB_EN),
        ],
      }} />
      <PublicHeader current="paketa" locale="en" />
      <main style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <BackLink locale="en" />
        <div className="lp-eyebrow">{PRICING_EN.eyebrow}</div>
        <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: 700, letterSpacing: '-0.035em',
          lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
          {PRICING_EN.h1}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 6px', textWrap: 'pretty' }}>
          {PRICING_EN.lede}
        </p>
        <div style={{ marginTop: 'clamp(22px,3vw,34px)' }}><PlanMatrix recommended={RECOMMENDED_PLAN} headingLevel={2} locale="en" /></div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'clamp(14px,2vw,22px)' }}><PaymentsBadge locale="en" /></div>
        <p className="fineprint" style={{ fontSize: 'var(--fs-base)', lineHeight: 1.6, color: 'var(--text-tertiary)', margin: '22px 0 0', textWrap: 'pretty' }}>
          {trialOfferEn(PLAN_COPY_EN[TRIAL_PLAN].name)} {words.firstCharge} {PRICES_VAT_EN} {CANCEL_ANYTIME_EN} {words.moneyBack}
        </p>
      </main>
      <PublicFooter locale="en" />
    </div>
  );
}
