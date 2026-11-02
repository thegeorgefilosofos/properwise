import { Suspense } from 'react';
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/core/site';
import { athensParts, athensToday } from '@/lib/core/time';
import { fmtFor } from '@/lib/core/format';
import { DSTI_LIMIT } from '@/lib/loans/affordability';
import { MORTGAGE_PAGE_EN, mortgageFaqEn } from '@/lib/i18n/en/tools/mortgage';
import { enToolLabel } from '@/lib/i18n/en/tools';
import { ToolCta } from '../../PublicChrome';
import { publicMetadata } from '../../publicMetadata';
import { shareImage } from '../../og/share';
import { MortgageCalculator } from '../../ypologismos-stegastikou-daneiou/MortgageCalculator';
import { readMortgageMarket } from '../../ypologismos-stegastikou-daneiou/marketRates';
import { ToolPageEn } from '../ToolPageEn';

// Ο υπολογιστής στεγαστικού στα αγγλικά: ο ίδιος υπολογιστής, οι ίδιες τιμές
// αγοράς (μία ανάγνωση ανά ώρα, όπως η ελληνική σελίδα).
const PATH = '/en/mortgage-calculator';
const EL = '/ypologismos-stegastikou-daneiou';
const D = MORTGAGE_PAGE_EN;

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return publicMetadata({ title: D.title(athensParts().year), description: D.description, url: siteUrl(PATH), image: shareImage('en-mortgage-calculator') });
}

export default async function Page() {
  const today = athensToday();
  const market = await readMortgageMarket(today);
  const f = fmtFor('en');
  const faq = mortgageFaqEn({ first: f.fpRate(DSTI_LIMIT.firstTimeBuyer * 100), other: f.fpRate(DSTI_LIMIT.other * 100) });
  return (
    <ToolPageEn path={PATH} name={D.title(athensParts().year)} label={enToolLabel(EL)} description={D.description}
      h1={D.h1} lede={D.lede}
      sources={{ kind: 'loan', checked: null }} faq={faq}>
      <Suspense fallback={<div style={{ minHeight: 420 }} aria-hidden/>}>
        <MortgageCalculator market={market} today={today} cta={<ToolCta locale="en" title={D.ctaTitle} body={D.ctaBody} />}/>
      </Suspense>
    </ToolPageEn>
  );
}
