import { Suspense } from 'react';
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/core/site';
import { athensToday } from '@/lib/core/time';
import { fmtFor } from '@/lib/core/format';
import { e2Guide } from '@/lib/tools/e2Odigos';
import { E2_USE } from '@/lib/billing/e2';
import { E2_PAGE_EN, e2FaqEn } from '@/lib/i18n/en/tools/e2';
import { enToolLabel } from '@/lib/i18n/en/tools';
import { ToolCta } from '../../PublicChrome';
import { publicMetadata } from '../../publicMetadata';
import { shareImage } from '../../og/share';
import { PAGE_UPDATED } from '../../pageUpdated';
import { E2Calculator } from '../../symplirosi-e2/E2Calculator';
import { ToolPageEn } from '../ToolPageEn';
import E2En from './en';

// Ο οδηγός Ε2 στα αγγλικά: η ίδια μηχανή, τα ίδια παραδείγματα με τον
// ελληνικό (lib/tools/e2Odigos.ts). Οι τιμές του εντύπου μένουν ελληνικές.
const PATH = '/en/form-e2-guide';
const EL = '/symplirosi-e2';
const D = E2_PAGE_EN;
const f = fmtFor('en');

export function generateMetadata(): Metadata {
  return publicMetadata({ title: D.title, description: D.description, url: siteUrl(PATH), image: shareImage('en-form-e2-guide') });
}

const YEAR = Number(PAGE_UPDATED[EL].slice(0, 4)) - 1;
const HOME = e2Guide({ year: YEAR, propType: 'apartment', use: 'lease', leaseCategory: 'residential', monthly: 600, from: `${YEAR}-03-01`, ownershipPct: 50 });
const SHOP = e2Guide({ year: YEAR, propType: 'shop', use: 'lease', leaseCategory: 'commercial', monthly: 1000 });

export default function Page() {
  const faq = e2FaqEn({
    rent: f.fe(600), months: HOME.cells.find(c => c.no === 10)?.value ?? '', gross: f.fe(HOME.gross),
    home: { code: HOME.e1.lines[0]?.code, spouse: HOME.e1.lines[0]?.spouseCode },
    shop: { code: SHOP.e1.lines[0]?.code, spouse: SHOP.e1.lines[0]?.spouseCode },
    vacant: E2_USE.vacant, ownUse: E2_USE.ownUse, shortTerm: E2_USE.shortTerm,
  });
  return (
    <ToolPageEn path={PATH} name={D.h1} label={enToolLabel(EL)} description={D.description}
      h1={D.h1} lede={D.lede} sources={{ kind: 'e2', checked: null, updated: PAGE_UPDATED[EL] }} faq={faq}>
      <Suspense fallback={<div style={{ minHeight: 720 }} aria-hidden/>}>
        <E2En><E2Calculator today={athensToday()} cta={<ToolCta locale="en" title={D.ctaTitle} body={D.ctaBody} />}/></E2En>
      </Suspense>
    </ToolPageEn>
  );
}
