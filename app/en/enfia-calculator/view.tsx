import { Suspense } from 'react';
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/core/site';
import { athensParts, athensToday } from '@/lib/core/time';
import { fmtFor } from '@/lib/core/format';
import { ENFIA_AGE_BANDS, ENFIA_PRE_YEAR, ENFIA_CENTURY_YEARS, ENFIA_REDUCTIONS, ENFIA_SURCHARGE_THRESHOLD, enfiaOldBuildingYears } from '@/lib/billing/enfia';
import { enfiaSignupHref } from '@/lib/tools/enfiaCarry';
import { ENFIA_PAGE_EN, enfiaFaqEn, smallSettlementReliefEn } from '@/lib/i18n/en/tools/enfia';
import { enToolLabel } from '@/lib/i18n/en/tools';
import { ToolCta } from '../../PublicChrome';
import { publicMetadata } from '../../publicMetadata';
import { shareImage } from '../../og/share';
import { PAGE_UPDATED, limitsChecked } from '../../pageUpdated';
import { EnfiaCalculator } from '../../ypologismos-enfia/EnfiaCalculator';
import { SPEC } from '../../ypologismos-enfia/spec';
import { ToolPageEn } from '../ToolPageEn';

// Ο υπολογιστής ΕΝΦΙΑ στα αγγλικά. Ο ίδιος υπολογιστής (locale από τη διαδρομή),
// οι ίδιες πηγές και ημερομηνίες ελέγχου με το /ypologismos-enfia.
const PATH = '/en/enfia-calculator';
const EL = '/ypologismos-enfia';
const D = ENFIA_PAGE_EN;

export function generateMetadata(): Metadata {
  return publicMetadata({ title: D.title(athensParts().year), description: D.description, url: siteUrl(PATH), image: shareImage('en-enfia-calculator') });
}

const band = (key: string) => ENFIA_AGE_BANDS.find(b => b.key === key)!;
const reduction = (key: string) => ENFIA_REDUCTIONS.find(x => x.key === key)!;

export default function Page() {
  const { year } = athensParts();
  const f = fmtFor('en');
  const insurance = reduction('insurance');
  const faq = enfiaFaqEn(year, {
    surcharge: f.feWhole(ENFIA_SURCHARGE_THRESHOLD),
    ageNew: { max: band('y0_4').maxYears as number, coef: f.fn(band('y0_4').coef, 2) },
    age26: { from: (band('y20_25').maxYears as number) + 1, coef: f.fn(band('y26_plus').coef, 2) },
    pre: { year: ENFIA_PRE_YEAR, coef: f.fn(band('pre1930').coef, 2) },
    over: { years: ENFIA_CENTURY_YEARS, coef: f.fn(band('over100').coef, 2), to: enfiaOldBuildingYears(year).over100.to },
    lowIncome: f.fpRate(reduction('low_income').pct),
    insurance: f.fpRate(insurance.pct),
    insuranceOver: { pct: f.fpRate(insurance.pctOver!.pct), above: f.feWhole(insurance.pctOver!.above) },
    small: smallSettlementReliefEn(year),
  });
  return (
    <ToolPageEn path={PATH} name={D.title(year)} label={enToolLabel(EL)} description={D.description}
      h1={D.h1(year)} lede={D.lede} lawYear={year}
      sources={{ kind: 'enfia', checked: limitsChecked(EL), updated: PAGE_UPDATED[EL] }} faq={faq}>
      <Suspense fallback={<div style={{ minHeight: 420 }} aria-hidden/>}>
        <EnfiaCalculator year={year} today={athensToday()} cta={
          <ToolCta locale="en" href={enfiaSignupHref(SPEC)} title={D.ctaTitle} body={D.ctaBody} />
        }/>
      </Suspense>
    </ToolPageEn>
  );
}
