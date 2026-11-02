import { Suspense } from 'react';
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/core/site';
import { athensParts, athensToday } from '@/lib/core/time';
import { regulated } from '@/lib/legal/validity';
import { RENO_PAGE_EN, renoFaqEn } from '@/lib/i18n/en/tools/reno';
import { enToolLabel } from '@/lib/i18n/en/tools';
import { ToolCta } from '../../PublicChrome';
import { publicMetadata } from '../../publicMetadata';
import { shareImage } from '../../og/share';
import { PAGE_UPDATED } from '../../pageUpdated';
import { RenoCalculator } from '../../ypologismos-ekptosis-anakainisis/RenoCalculator';
import { ToolPageEn } from '../ToolPageEn';
import RenoEn from './en';

// Η έκπτωση φόρου ανακαίνισης στα αγγλικά: ο ίδιος υπολογιστής, οι ίδιες πηγές
// και ο ίδιος έλεγχος του μητρώου ισχύος (renovation-39b).
const PATH = '/en/renovation-tax-credit-calculator';
const EL = '/ypologismos-ekptosis-anakainisis';
const D = RENO_PAGE_EN;

export function generateMetadata(): Metadata {
  return publicMetadata({ title: D.title, description: D.description, url: siteUrl(PATH), image: shareImage('en-renovation-tax-credit-calculator') });
}

export default function Page() {
  return (
    <ToolPageEn path={PATH} name={D.title} label={enToolLabel(EL)} description={D.description}
      h1={D.h1} lede={D.lede} lawYear={athensParts().year}
      sources={{ kind: 'reno', checked: regulated('renovation-39b').checkedAt, updated: PAGE_UPDATED[EL] }} faq={renoFaqEn()}>
      <Suspense fallback={<div style={{ minHeight: 560 }} aria-hidden/>}>
        <RenoEn><RenoCalculator today={athensToday()} cta={<ToolCta locale="en" title={D.ctaTitle} body={D.ctaBody} />}/></RenoEn>
      </Suspense>
    </ToolPageEn>
  );
}
