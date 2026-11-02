import { Suspense } from 'react';
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/core/site';
import { athensParts, athensToday } from '@/lib/core/time';
import { fmtFor } from '@/lib/core/format';
import { regulated } from '@/lib/legal/validity';
import { BUY_PAGE_EN, buyFaqEn } from '@/lib/i18n/en/tools/buy';
import { enToolLabel } from '@/lib/i18n/en/tools';
import { ToolCta } from '../../PublicChrome';
import { publicMetadata } from '../../publicMetadata';
import { shareImage } from '../../og/share';
import { PAGE_UPDATED } from '../../pageUpdated';
import { PurchaseCostsCalculator } from '../../exoda-agoras-akinitou/PurchaseCostsCalculator';
import { ToolPageEn } from '../ToolPageEn';

// Τα έξοδα αγοράς στα αγγλικά: ο ίδιος υπολογιστής, οι ίδιες πηγές. Η λήξη της
// αναστολής ΦΠΑ από το ίδιο μητρώο ισχύος (lib/legal/validity.ts).
const PATH = '/en/property-purchase-costs';
const EL = '/exoda-agoras-akinitou';
const D = BUY_PAGE_EN;

export function generateMetadata(): Metadata {
  return publicMetadata({ title: D.title, description: D.description, url: siteUrl(PATH), image: shareImage('en-property-purchase-costs') });
}

export default function Page() {
  const vatUntil = fmtFor('en').date(regulated('new-build-vat-suspension').validTo);
  return (
    <ToolPageEn path={PATH} name={D.title} label={enToolLabel(EL)} description={D.description}
      h1={D.h1} lede={D.lede} lawYear={athensParts().year}
      sources={{ kind: 'buy', checked: null, updated: PAGE_UPDATED[EL] }} faq={buyFaqEn({ vatUntil })}>
      <Suspense fallback={<div style={{ minHeight: 420 }} aria-hidden/>}>
        <PurchaseCostsCalculator today={athensToday()} vatUntil={vatUntil} cta={<ToolCta locale="en" title={D.ctaTitle} body={D.ctaBody} />}/>
      </Suspense>
    </ToolPageEn>
  );
}
