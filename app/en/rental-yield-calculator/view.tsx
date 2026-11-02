import { Suspense } from 'react';
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/core/site';
import { athensParts, athensToday } from '@/lib/core/time';
import { fmtFor } from '@/lib/core/format';
import { rentalBracketsForYear } from '@/lib/billing/greekTax';
import { PRESUMPTIVE_DEDUCTION_RATE } from '@/lib/billing/presumptive';
import { YIELD_PAGE_EN, yieldFaqEn } from '@/lib/i18n/en/tools/yield';
import { rateScaleEn } from '@/lib/i18n/en/tools/rent';
import { enToolLabel } from '@/lib/i18n/en/tools';
import { ToolCta } from '../../PublicChrome';
import { publicMetadata } from '../../publicMetadata';
import { shareImage } from '../../og/share';
import { PAGE_UPDATED, limitsChecked } from '../../pageUpdated';
import { ApodosiCalculator } from '../../kathari-apodosi/ApodosiCalculator';
import { ToolPageEn } from '../ToolPageEn';

// Η καθαρή απόδοση στα αγγλικά: ο ίδιος υπολογιστής, οι ίδιες πηγές.
const PATH = '/en/rental-yield-calculator';
const EL = '/kathari-apodosi';
const D = YIELD_PAGE_EN;

export function generateMetadata(): Metadata {
  return publicMetadata({ title: D.title(athensParts().year), description: D.description, url: siteUrl(PATH), image: shareImage('en-rental-yield-calculator') });
}

export default function Page() {
  const { year } = athensParts();
  const f = fmtFor('en');
  const faq = yieldFaqEn({ year, deduction: f.fpRate(PRESUMPTIVE_DEDUCTION_RATE * 100), scale: rateScaleEn(rentalBracketsForYear(year)) });
  return (
    <ToolPageEn path={PATH} name={D.title(year)} label={enToolLabel(EL)} description={D.description}
      h1={D.h1} lede={D.lede} lawYear={year}
      sources={{ kind: 'yield', checked: limitsChecked(EL), updated: PAGE_UPDATED[EL] }} faq={faq}>
      <Suspense fallback={<div style={{ minHeight: 420 }} aria-hidden/>}>
        <ApodosiCalculator year={year} today={athensToday()} cta={<ToolCta locale="en" title={D.ctaTitle} body={D.ctaBody} />}/>
      </Suspense>
    </ToolPageEn>
  );
}
