import { Suspense } from 'react';
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/core/site';
import { athensToday } from '@/lib/core/time';
import { fmtFor } from '@/lib/core/format';
import { TARIFFS_MAX_AGE_DAYS } from '@/lib/energy/catalogue';
import { ETMEAR, ELECTRICITY_VAT_PCT } from '@/lib/energy/tariff';
import { POWER_PAGE_EN, powerFaqEn } from '@/lib/i18n/en/tools/power';
import { enToolLabel } from '@/lib/i18n/en/tools';
import { ToolCta } from '../../PublicChrome';
import { publicMetadata } from '../../publicMetadata';
import { shareImage } from '../../og/share';
import { PAGE_UPDATED } from '../../pageUpdated';
import { PowerCompare } from '../../sygkrisi-timologion-revmatos/PowerCompare';
import { ToolPageEn } from '../ToolPageEn';
import PowerEn from './en';

// Η σύγκριση τιμολογίων ρεύματος στα αγγλικά: ο ίδιος κατάλογος, ο ίδιος
// τύπος και η ίδια ημερομηνία ελέγχου με το /sygkrisi-timologion-revmatos.
const PATH = '/en/electricity-tariffs';
const EL = '/sygkrisi-timologion-revmatos';
const D = POWER_PAGE_EN;

export function generateMetadata(): Metadata {
  return publicMetadata({ title: D.title, description: D.description, url: siteUrl(PATH), image: shareImage('en-electricity-tariffs') });
}

export default function Page() {
  const f = fmtFor('en');
  const faq = powerFaqEn({ vat: f.fpRate(ELECTRICITY_VAT_PCT), etmear: f.feRate(ETMEAR), maxAgeDays: TARIFFS_MAX_AGE_DAYS });
  return (
    <ToolPageEn path={PATH} name={D.h1} label={enToolLabel(EL)} description={D.description}
      h1={D.h1} lede={D.lede} sources={{ kind: 'power', checked: PAGE_UPDATED[EL] }} faq={faq}>
      <Suspense fallback={<div style={{ minHeight: 640 }} aria-hidden/>}>
        <PowerEn><PowerCompare serverToday={athensToday()} cta={<ToolCta locale="en" title={D.ctaTitle} body={D.ctaBody} />}/></PowerEn>
      </Suspense>
    </ToolPageEn>
  );
}
