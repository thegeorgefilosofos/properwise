import type { Metadata } from 'next';
import { siteUrl } from '@/lib/core/site';
import { fmtFor } from '@/lib/core/format';
import { FIRST_YEAR_NEW_BRACKETS } from '@/lib/billing/greekTax';
import { PRESUMPTIVE_DEDUCTION_RATE } from '@/lib/billing/presumptive';
import { propertyYield } from '@/lib/tools/apodosi';
import { estimateENFIA, zoneKeyFromPricePerSqm, enfiaAgeKeyFromYears } from '@/lib/billing/enfia';
import { publicMetadata } from '../../../publicMetadata';
import { shareImage } from '../../../og/share';
import { GuideShellEn, type EnFaq } from '../GuideShellEn';

// Ο οδηγός «Καθαρή απόδοση ακινήτου» στα αγγλικά. Το ίδιο διαμέρισμα με τον
// ελληνικό οδηγό, με τον ίδιο υπολογισμό (`propertyYield`, `estimateENFIA`).
const PATH = '/en/guides/net-rental-yield';
const EL = '/odigos/kathari-apodosi-akinitou';
const f = fmtFor('en');
const pctOf = (r: number | null) => f.fp((r ?? 0) * 100);
const rate = (r: number) => f.fpRate(r * 100);

const H1 = 'Net rental yield in Greece: what is left after tax and costs';
const DESC = 'Gross versus net rental yield on a Greek property: income tax at your own bracket, ENFIA and running costs, with a worked example.';

export function generateMetadata(): Metadata {
  return publicMetadata({ title: H1, description: DESC, url: siteUrl(PATH), type: 'article', image: shareImage('en-guide-net-yield') });
}

const EX_VALUE = 200_000, EX_MONTHLY = 700, EX_EXPENSES = 800, EX_OTHER_GROSS = 12_000;
const EX_ENFIA_INPUT = { sqm: 100, zonePrice: 2_000, years: 12, floor: 'third' } as const;
const EX_ENFIA = estimateENFIA({
  sqm: EX_ENFIA_INPUT.sqm, zone: zoneKeyFromPricePerSqm(EX_ENFIA_INPUT.zonePrice)!, floor: EX_ENFIA_INPUT.floor,
  age: enfiaAgeKeyFromYears(EX_ENFIA_INPUT.years)!, totalValue: EX_VALUE, propertyValue: EX_VALUE,
})!.annual;
const yieldWith = (otherRentalIncome: number) => propertyYield({
  value: EX_VALUE, monthlyRent: EX_MONTHLY, monthsRented: 12, enfia: EX_ENFIA, expenses: EX_EXPENSES,
  otherRentalIncome, year: FIRST_YEAR_NEW_BRACKETS, viaBank: true,
});
const BASE = yieldWith(0), STACKED = yieldWith(EX_OTHER_GROSS);
const DEDUCTION = rate(PRESUMPTIVE_DEDUCTION_RATE);

const FAQ: EnFaq[] = [
  {
    q: 'What is the difference between gross and net yield?',
    a: 'Gross yield is a year’s rent divided by the property’s value, before any cost. Net yield is what is left after income tax, ENFIA and running costs, divided by the same value.',
  },
  {
    q: 'Why does the tax depend on my other rent?',
    a: 'Greek rental income is taxed on your total from all properties, at progressive rates. Rent from another property fills the lower brackets first, so this property’s rent is taxed at your marginal rate.',
  },
  {
    q: 'Is ENFIA part of the calculation?',
    a: 'Yes. ENFIA, Greece’s annual property tax, is due every year whether the property is let or empty, so it reduces the net yield.',
  },
  {
    q: 'How many years until the property pays for itself?',
    a: 'A rough comparison measure is the value divided by the net annual income. It ignores price changes, financing and vacancies, so treat it as a comparison between properties, not a forecast.',
  },
];

export default function Page() {
  const sections = [
    {
      id: 'gap', over: '1. The difference', title: 'Gross and net yield',
      body: <>
        <p className="lg-p">Gross yield ignores every cost, so it is always higher than net yield. An owner who compares it with a deposit rate or a bond compares two different things.</p>
        <ul className="lg-ul">
          <li><strong style={{ color: 'var(--text-primary)' }}>Tax, at your own bracket.</strong> The property is taxed at the rate of the bracket its rent falls into, after your other rental income.</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>ENFIA.</strong> A tax on ownership, paid every year, even with the property empty.</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>Expenses.</strong> Maintenance, insurance and building charges that fall on the owner.</li>
        </ul>
      </>,
    },
    {
      id: 'example', over: '2. Example', title: 'One apartment, step by step',
      body: <>
        <p className="lg-p">{`An apartment of ${f.fn(EX_ENFIA_INPUT.sqm)} m² worth ${f.feWhole(EX_VALUE)} (zone price ${f.feWhole(EX_ENFIA_INPUT.zonePrice)}/m², ${EX_ENFIA_INPUT.years} years old, 3rd floor), let for ${f.feWhole(EX_MONTHLY)} a month all year, with ${f.feWhole(EX_EXPENSES)} of expenses, ${FIRST_YEAR_NEW_BRACKETS} brackets, rent paid through a bank.`}</p>
        <ul className="lg-ul">
          <li><strong style={{ color: 'var(--text-primary)' }}>Gross rent:</strong>{` ${f.feWhole(EX_MONTHLY)} × 12 = ${f.feWhole(BASE.gross)}.`}</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>{`Standard deduction ${DEDUCTION}:`}</strong>{` −${f.feWhole(BASE.deduction)}, so taxable income is ${f.feWhole(BASE.taxable)}.`}</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>{`Tax, as your only rental income (bracket ${rate(BASE.marginal)}):`}</strong>{` ${f.fe(BASE.tax)}.`}</li>
          <li>{`${f.fe(BASE.gross)} − ${f.fe(BASE.tax)} (tax) − ${f.fe(BASE.enfia)} (ENFIA) − ${f.fe(BASE.expenses)} (expenses) = `}<strong style={{ color: 'var(--text-primary)' }}>{`${f.fe(BASE.net)} net.`}</strong></li>
          <li><strong style={{ color: 'var(--text-primary)' }}>Gross yield:</strong>{` ${f.fn(BASE.gross)} / ${f.fn(EX_VALUE)} = ${pctOf(BASE.grossYield)}.`}</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>{`Net yield: ${f.fn(BASE.net)} / ${f.fn(EX_VALUE)} = ${pctOf(BASE.netYield)}.`}</strong>{` A gap of ${f.fn((BASE.yieldGap ?? 0) * 100, 2)} percentage points.`}</li>
        </ul>
        <p className="lg-p">{`The same apartment, for an owner who already collects ${f.feWhole(EX_OTHER_GROSS)} a year in rent from another property, is taxed ${f.fe(STACKED.tax)} instead of ${f.fe(BASE.tax)}, and its net yield falls to ${pctOf(STACKED.netYield)}.`}</p>
      </>,
    },
    {
      id: 'payback', over: '3. Payback', title: 'How many years to earn back the value',
      body: <p className="lg-p">{`A rough comparison measure: value divided by net annual income. In the example, ${f.fn(EX_VALUE)} / ${f.fn(BASE.net)} ≈ ${f.fn(BASE.paybackYears ?? 0)} years, with today’s rent and costs.`}</p>,
    },
  ];
  return (
    <GuideShellEn el={EL} path={PATH} h1={H1} description={DESC} about="Net rental yield of residential property in Greece"
      intro={<>
        <p className="lg-p">{`“A yield of ${pctOf(BASE.grossYield)}”: twelve months of rent over the value. That is gross yield, the money before tax, ENFIA and costs.`}</p>
        <p className="lg-p">This guide shows, with sources, what is really left: gross yield minus tax at your own bracket, ENFIA and expenses.</p>
      </>}
      sections={sections}
      sources={[
        `Rental income brackets ${FIRST_YEAR_NEW_BRACKETS}: Article 8 of Law 5246/2025 · standard deduction ${DEDUCTION}: Article 39(3)(a) of the Income Tax Code (Law 4172/2013).`,
        'ENFIA: Law 4223/2013, as in force and codified in the Property Tax Code (Law 5219/2025).',
      ]}
      faq={FAQ} faqTitle="What people ask about rental yield"
      cta={{ title: 'The net yield of your property', href: '/en/rental-yield-calculator', action: 'Calculate your net yield',
        body: 'Enter your own value, rent, ENFIA and expenses, with tax at your own bracket.' }} />
  );
}
