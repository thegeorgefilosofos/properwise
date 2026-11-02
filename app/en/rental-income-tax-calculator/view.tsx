import { Suspense } from 'react';
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/core/site';
import { athensToday } from '@/lib/core/time';
import { fmtFor } from '@/lib/core/format';
import { RENTAL_TAX_BRACKETS_2026, FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT, FIRST_YEAR_NEW_BRACKETS, STR_INDIVIDUAL_MAX_PROPERTIES } from '@/lib/billing/greekTax';
import { PRESUMPTIVE_DEDUCTION_RATE, bankReceiptMatters } from '@/lib/billing/presumptive';
import { AADE_DESTINATIONS } from '@/lib/tax/aade';
import { RENT_PAGE_EN, rentFaqEn } from '@/lib/i18n/en/tools/rent';
import { enToolLabel } from '@/lib/i18n/en/tools';
import { ToolCta, SectionHead } from '../../PublicChrome';
import { ToolLedger } from '../../ToolParts';
import { publicMetadata } from '../../publicMetadata';
import { shareImage } from '../../og/share';
import { PAGE_UPDATED, limitsChecked } from '../../pageUpdated';
import { RentTaxCalculator } from '../../ypologismos-forou-enoikion/RentTaxCalculator';
import { rentPageYear, rentExample } from '../../ypologismos-forou-enoikion/seo';
import { ToolPageEn } from '../ToolPageEn';
import RentEn from './en';

// Ο υπολογιστής φόρου ενοικίων στα αγγλικά. Ο ίδιος υπολογιστής (locale από τη
// διαδρομή), το ίδιο λυμένο παράδειγμα (seo.ts), οι ίδιες πηγές.
const PATH = '/en/rental-income-tax-calculator';
const EL = '/ypologismos-forou-enoikion';
const D = RENT_PAGE_EN;
const f = fmtFor('en');
const pct = (rate: number) => f.fpRate(rate * 100);
const firstOf = (y: number, m: number) => f.date(`${y}-${String(m).padStart(2, '0')}-01`);
const PROSE = { fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 } as const;
const LINK = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } as const;

const SCALE_WORDS = (() => {
  const parts = RENTAL_TAX_BRACKETS_2026.map(b => (b.from === 0 ? `${pct(b.rate)} up to ${f.feWhole(b.to)}`
    : b.to === Infinity ? `${pct(b.rate)} over ${f.feWhole(b.from)}`
    : `${pct(b.rate)} from ${f.fn(b.from)} to ${f.feWhole(b.to)}`));
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
})();

export function generateMetadata(): Metadata {
  const year = rentPageYear(athensToday());
  return publicMetadata({ title: D.title(year), description: D.description(year), url: siteUrl(PATH), image: shareImage('en-rental-income-tax-calculator') });
}

export default function Page() {
  const today = athensToday();
  const year = rentPageYear(today);
  const ex = rentExample(year);
  const deduction = pct(PRESUMPTIVE_DEDUCTION_RATE);
  const faq = rentFaqEn({
    firstYear: FIRST_YEAR_NEW_BRACKETS, scaleWords: SCALE_WORDS, deduction,
    taxedShare: f.fpRate((1 - PRESUMPTIVE_DEDUCTION_RATE) * 100),
    bankFrom: firstOf(FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT), bankYear: FIRST_YEAR_BANK_RECEIPT,
    strMax: STR_INDIVIDUAL_MAX_PROPERTIES, strBusiness: STR_INDIVIDUAL_MAX_PROPERTIES + 1,
  });
  const income = AADE_DESTINATIONS.income;
  const banks = bankReceiptMatters(year);
  const after = (
    <>
      <section className="po-tool-more" style={{ marginTop: 'clamp(44px,6vw,72px)' }}>
        <SectionHead over={D.exampleOver(year)} title={D.exampleTitle(f.fe(ex.gross), f.fe(ex.tax))} />
        <p style={{ ...PROSE, marginBottom: 16 }}>{D.exampleLede(f.fe(ex.monthly), f.fn(ex.months), year, pct(ex.rate))}</p>
        <ToolLedger rows={[
          { k: 'Annual rent', v: f.fe(ex.gross) },
          { k: D.deductionRow(pct(ex.rate)), v: f.feSigned(-ex.deduction) },
          { k: D.taxable, v: f.fe(ex.taxable) },
          ...ex.slices.map(s => ({
            k: D.slice(f.fe(s.width), pct(s.rate), s.to === Infinity ? null : f.feWhole(s.to)),
            v: f.fe(s.tax), kind: 'param' as const,
          })),
          { k: 'Income tax', v: f.fe(ex.tax), kind: 'total' },
        ]}/>
        <p style={{ ...PROSE, marginTop: 16 }}>
          {D.exampleKeep(f.fe(ex.net))}{' '}{banks ? D.exampleBank : D.exampleAnyway(year)}
          <a href={ex.href.replace(EL, PATH)} className="lp-link" style={LINK}>{D.exampleOpen}</a>.
        </p>
      </section>
      <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
        <SectionHead over={D.fileOver} title={D.fileTitle} />
        <p style={{ ...PROSE, marginBottom: 12 }}>{D.fileLede(year)}</p>
        <ol className="lg-ul">
          {D.fileSteps(income.portal).map(t => <li key={t}>{t}</li>)}
        </ol>
      </section>
    </>
  );
  return (
    <ToolPageEn path={PATH} name={D.title(year)} label={enToolLabel(EL)} description={D.description(year)}
      h1={D.h1(year)} lede={D.lede(deduction)} lawYear={year}
      sources={{ kind: 'rent', checked: limitsChecked(EL), updated: PAGE_UPDATED[EL] }} faq={faq} after={after}>
      <Suspense fallback={<div style={{ minHeight: 420 }} aria-hidden/>}>
        <RentEn><RentTaxCalculator today={today} cta={<ToolCta locale="en" title={D.ctaTitle} body={D.ctaBody} />}/></RentEn>
      </Suspense>
    </ToolPageEn>
  );
}
