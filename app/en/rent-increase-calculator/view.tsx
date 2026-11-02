import { Suspense } from 'react';
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/core/site';
import { athensToday } from '@/lib/core/time';
import { fmtFor } from '@/lib/core/format';
import { COMMERCIAL_RENT_CAP_2026 as CAP } from '@/lib/documents/rentAdjustment';
import { RENT_INDEX, RENT_INDEX_LATEST, CPI_SOURCE_URL, CPI_CONFIRMED_AT, rentAdjustmentPct } from '@/lib/market/cpi';
import { adjustPlan } from '@/lib/tools/anaprosarmogi';
import { RAISE_PAGE_EN, raiseFaqEn, monthEn, periodEn } from '@/lib/i18n/en/tools/raise';
import { enToolLabel } from '@/lib/i18n/en/tools';
import { ToolCta } from '../../PublicChrome';
import { publicMetadata } from '../../publicMetadata';
import { shareImage } from '../../og/share';
import { PAGE_UPDATED } from '../../pageUpdated';
import { AdjustCalculator } from '../../anaprosarmogi-enoikiou/AdjustCalculator';
import { ToolPageEn } from '../ToolPageEn';
import RaiseEn from './en';

// Η αναπροσαρμογή ενοικίου στα αγγλικά: ο ίδιος υπολογιστής, ο ίδιος ΔΤΚ, τα
// ίδια παραδείγματα με τον ελληνικό (lib/tools/anaprosarmogi.ts).
const PATH = '/en/rent-increase-calculator';
const EL = '/anaprosarmogi-enoikiou';
const D = RAISE_PAGE_EN;
const f = fmtFor('en');
const CAP_YEAR = Number(CAP.from.slice(0, 4));
const CAP_PCT = f.fpRate(CAP.pct);

export function generateMetadata(): Metadata {
  return publicMetadata({ title: D.title, description: D.description(CAP_PCT, CAP_YEAR), url: siteUrl(PATH), image: shareImage('en-rent-increase-calculator') });
}

// Τα ίδια παραδείγματα με τις ελληνικές ερωτήσεις· τα ποσά από την `adjustPlan`.
const EX_RES = { rent: 600, pct: 3, years: 3 } as const;
const RES = adjustPlan({
  rent: EX_RES.rent, lease: 'residential', basis: 'percent', pct: EX_RES.pct, share75: false,
  startYm: `${CAP_YEAR + 1}-01`, years: EX_RES.years, existingLease: true,
});
const EX_COM = { rent: 1_500, pct: 5 } as const;
const COM = adjustPlan({
  rent: EX_COM.rent, lease: 'commercial', basis: 'percent', pct: EX_COM.pct, share75: false,
  startYm: CAP.from.slice(0, 7), years: 2, existingLease: true,
});
const LATEST = RENT_INDEX[RENT_INDEX_LATEST];
const LATEST_75 = rentAdjustmentPct(LATEST, true);

const NUM = { color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' } as const;
const SRC_LINK = { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 } as const;

export default function Page() {
  const faq = raiseFaqEn({
    year: CAP_YEAR, cap: CAP_PCT, capFrom: f.date(CAP.from), capTo: f.date(CAP.to),
    com: { rent: f.feWhole(EX_COM.rent), pct: f.fpRate(EX_COM.pct), to: f.fe(COM.rows[0].to), uncapped: f.fe(COM.rows[0].uncapped), next: f.fe(COM.rows[1].to) },
    latest: { month: monthEn(RENT_INDEX_LATEST), pct: f.fpRate(LATEST), period: periodEn(RENT_INDEX_LATEST), pct75: f.fpRate(LATEST_75) },
    res: { rent: f.feWhole(EX_RES.rent), pct: f.fpRate(EX_RES.pct), years: EX_RES.years, rows: RES.rows.map(r => f.fe(r.to)).join(', '),
      simple: f.fe(EX_RES.rent * (1 + (EX_RES.pct / 100) * EX_RES.years)) },
  });
  return (
    <ToolPageEn path={PATH} name={D.title} label={enToolLabel(EL)} description={D.description(CAP_PCT, CAP_YEAR)}
      h1={D.h1} lede={D.lede(CAP_PCT)}
      sources={{ kind: 'adjust', checked: CPI_CONFIRMED_AT, updated: PAGE_UPDATED[EL] }} faq={faq}>
      <aside className="po-tool-sources" aria-label={D.indexLabel} style={{ margin: '0 0 clamp(20px,3vw,28px)' }}>
        <span className="po-src-badge">{D.indexBadge}</span>
        <span className="po-src-txt">
          {D.indexFor(monthEn(RENT_INDEX_LATEST))}
          <strong style={NUM}>{f.fpRate(LATEST)}</strong> (75%: <strong style={NUM}>{f.fpRate(LATEST_75)}</strong>)
          {D.indexChange(periodEn(RENT_INDEX_LATEST))}
          <a href={CPI_SOURCE_URL} rel="noopener noreferrer" className="lp-link" style={SRC_LINK}>ELSTAT</a>
          {D.indexChecked(f.date(CPI_CONFIRMED_AT))}
        </span>
      </aside>
      <Suspense fallback={<div style={{ minHeight: 640 }} aria-hidden/>}>
        <RaiseEn><AdjustCalculator today={athensToday()} cta={<ToolCta locale="en" title={D.ctaTitle} body={D.ctaBody} />}/></RaiseEn>
      </Suspense>
    </ToolPageEn>
  );
}
