import { Suspense } from 'react';
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/core/site';
import { athensParts, athensToday } from '@/lib/core/time';
import { SHORT_PAGE_EN, shortFaqEn } from '@/lib/i18n/en/tools/short';
import { enToolLabel } from '@/lib/i18n/en/tools';
import { ToolCta } from '../../PublicChrome';
import { publicMetadata } from '../../publicMetadata';
import { shareImage } from '../../og/share';
import { PAGE_UPDATED, limitsChecked } from '../../pageUpdated';
import { ShortVsLongCalculator } from '../../vraxyxronia-i-makroxronia/ShortVsLongCalculator';
import { ToolPageEn } from '../ToolPageEn';

// Βραχυχρόνια ή μακροχρόνια, στα αγγλικά: ο ίδιος υπολογιστής, οι ίδιες πηγές.
const PATH = '/en/short-term-vs-long-term-rental';
const EL = '/vraxyxronia-i-makroxronia';
const D = SHORT_PAGE_EN;

export function generateMetadata(): Metadata {
  return publicMetadata({ title: D.title, description: D.description, url: siteUrl(PATH), image: shareImage('en-short-term-vs-long-term-rental') });
}

export default function Page() {
  const faq = shortFaqEn();
  return (
    <ToolPageEn path={PATH} name={D.title} label={enToolLabel(EL)} description={D.description}
      h1={D.h1} lede={D.lede} lawYear={athensParts().year}
      sources={{ kind: 'short', checked: limitsChecked(EL), updated: PAGE_UPDATED[EL] }} faq={faq}>
      <Suspense fallback={<div style={{ minHeight: 420 }} aria-hidden/>}>
        <ShortVsLongCalculator today={athensToday()} cta={<ToolCta locale="en" title={D.ctaTitle} body={D.ctaBody} />}/>
      </Suspense>
    </ToolPageEn>
  );
}
