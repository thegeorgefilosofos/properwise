import type { Metadata } from 'next';
import { siteUrl } from '@/lib/core/site';
import { fmtFor } from '@/lib/core/format';
import {
  RENTAL_TAX_BRACKETS_2026, rentalIncomeTax, rentalBracketsForYear, FIRST_YEAR_NEW_BRACKETS,
  FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT, STR_INDIVIDUAL_MAX_PROPERTIES,
} from '@/lib/billing/greekTax';
import { PRESUMPTIVE_DEDUCTION_RATE } from '@/lib/billing/presumptive';
import { publicMetadata } from '../../../publicMetadata';
import { shareImage } from '../../../og/share';
import { GuideTable } from '../../../odigos/GuideParts';
import { bracketSlices } from '../../../odigos/taxText';
import { LAW_5222_PDF, LAW_5246_PDF } from '../../../odigos/fek';
import { GuideShellEn, type EnFaq } from '../GuideShellEn';

// Ο οδηγός «Φορολογία ενοικίων 2026» στα αγγλικά. Κάθε συντελεστής, όριο και
// ημερομηνία από το lib/billing· τα ποσά των παραδειγμάτων είναι τα ίδια
// ενοίκια με τον ελληνικό οδηγό και ο φόρος τους βγαίνει από το `rentalIncomeTax`.
const PATH = '/en/guides/greek-rental-income-tax-2026';
const EL = '/odigos/forologia-enoikion-2026';
const f = fmtFor('en');
const pct = (rate: number) => f.fpRate(rate * 100);
const NEW = RENTAL_TAX_BRACKETS_2026;
const OLD_YEAR = FIRST_YEAR_NEW_BRACKETS - 1;
const OLD = rentalBracketsForYear(OLD_YEAR);
const SCALE = `${NEW.map(b => f.fn(b.rate * 100)).join(' / ')}%`;
const THRESHOLD = NEW[NEW.length - 1].from;
const TOP = pct(NEW[NEW.length - 1].rate);
const DEDUCTION = pct(PRESUMPTIVE_DEDUCTION_RATE);
const TAXED = f.fpRate((1 - PRESUMPTIVE_DEDUCTION_RATE) * 100);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const BANK_FROM = `1 ${MONTHS[FIRST_MONTH_BANK_RECEIPT - 1]} ${FIRST_YEAR_BANK_RECEIPT}`;
const words = (year: number) => {
  const parts = rentalBracketsForYear(year).map(b => (b.to === Infinity ? `${pct(b.rate)} over ${f.feWhole(b.from)}` : `${pct(b.rate)} up to ${f.feWhole(b.to)}`));
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
};

const H1 = `Greek rental income tax in 2026: brackets, the ${DEDUCTION} deduction and the bank rule`;
const DESC = `How rent is taxed in Greece in 2026: brackets of ${SCALE}, a ${DEDUCTION} standard deduction and the bank payment rule of Law 5222/2025. With examples.`;

export function generateMetadata(): Metadata {
  return publicMetadata({ title: H1, description: DESC, url: siteUrl(PATH), type: 'article', image: shareImage('en-guide-rental-income-tax') });
}

function example(gross: number, deduction = true) {
  const ded = deduction ? gross * PRESUMPTIVE_DEDUCTION_RATE : 0;
  const taxable = gross - ded;
  const tax = rentalIncomeTax(taxable, NEW);
  return { gross, ded, taxable, tax, eff: (tax / gross) * 100 };
}
type Ex = ReturnType<typeof example>;
const rows = (e: Ex) => [
  ['Gross rent', f.fe(e.gross)], [`Deduction ${DEDUCTION}`, f.fe(e.ded)], ['Taxable', f.fe(e.taxable)],
  ['Tax', f.fe(e.tax)], ['Effective rate on gross rent', f.fp(e.eff)],
] as const;
const EX1_MONTHLY = 650, EX2_MONTHLY = 1_800, EX3_GROSS = 40_000;
const EX1 = example(EX1_MONTHLY * 12), EX2 = example(EX2_MONTHLY * 12);
const EX3 = example(EX3_GROSS), EX3_CASH = example(EX3_GROSS, false);
const [EX2_LOW, EX2_HIGH] = bracketSlices(EX2.taxable, NEW);

const FAQ: EnFaq[] = [
  {
    q: `Do the new brackets apply to the ${FIRST_YEAR_NEW_BRACKETS} tax return (${OLD_YEAR} income)?`,
    a: `No. Under Article 47(3) of Law 5246/2025, the new brackets apply to income from tax year ${FIRST_YEAR_NEW_BRACKETS}, declared in ${FIRST_YEAR_NEW_BRACKETS + 1}. ${OLD_YEAR} income still uses the previous brackets (${OLD.map(b => f.fn(b.rate * 100)).join(' / ')}%).`,
  },
  {
    q: `Is all my rent taxed at ${pct(NEW[1].rate)} or ${pct(NEW[2].rate)}?`,
    a: `No. Tax is progressive: each slice of income is taxed at its own rate. Only the amount above ${f.feWhole(THRESHOLD)} reaches ${TOP}.`,
  },
  {
    q: `Does the ${DEDUCTION} deduction need receipts?`,
    a: `No. Article 39(3)(a) of the Greek Income Tax Code presumes ${DEDUCTION} for repairs and upkeep without any receipts.`,
  },
  {
    q: `When do I lose the ${DEDUCTION} if I collect rent in cash?`,
    a: `The bank requirement was introduced by Article 210 of Law 5222/2025, but the penalty was postponed to ${BANK_FROM} (AADE Decision A.1187/2026). For ${FIRST_YEAR_BANK_RECEIPT - 2} and ${FIRST_YEAR_BANK_RECEIPT - 1} income, the deduction applies however the rent is collected.`,
  },
  {
    q: 'Does the same apply to short-term rentals?',
    a: `For income tax, yes, if you are an individual with up to ${STR_INDIVIDUAL_MAX_PROPERTIES} short-term properties and provide no services beyond bed linen: the same brackets and the same ${DEDUCTION} deduction. With more properties, the income is business income. Short-term rentals also pay the climate crisis resilience fee per night.`,
  },
  {
    q: 'Is ENFIA deducted from rental income?',
    a: 'No. ENFIA, Greece’s annual property tax, is charged on ownership and calculated separately; it is not deducted from rental income.',
  },
];

const LINK = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } as const;
const h3 = { fontSize: 18, fontWeight: 600, margin: '28px 0 8px', letterSpacing: '-0.01em' } as const;

export default function Page() {
  const sections = [
    {
      id: 'brackets', over: '1. The brackets', title: `${SCALE} (top rate from ${f.feWhole(THRESHOLD)})`,
      body: <>
        <p className="lg-p">{`Legal basis: Article 8 of Law 5246/2025, amending Article 40(4) of the Greek Income Tax Code (Law 4172/2013). It applies to income from tax year ${FIRST_YEAR_NEW_BRACKETS}.`}</p>
        <GuideTable caption="Income from property (per year)" head={['Income', 'Rate']} min="280px"
          rows={NEW.map(b => [b.to === Infinity ? `Over ${f.feWhole(b.from)}` : `${f.fn(b.from)} – ${f.feWhole(b.to)}`, pct(b.rate)] as const)} />
        <ul className="lg-ul" style={{ marginTop: 16 }}>
          <li><strong style={{ color: 'var(--text-primary)' }}>Progressive:</strong> each slice of taxable income is taxed at its own rate.</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>No tax-free allowance like salaries have:</strong> {pct(NEW[0].rate)} applies from the first euro.</li>
          <li>{`Taxable income is usually ${TAXED} of gross rent (see the next section).`}</li>
        </ul>
        <p className="lg-p">{`Up to tax year ${OLD_YEAR}, the brackets were: ${words(OLD_YEAR)}. From ${FIRST_YEAR_NEW_BRACKETS}: ${words(FIRST_YEAR_NEW_BRACKETS)}.`}</p>
      </>,
    },
    {
      id: 'deduction', over: '2. Expenses', title: `The ${DEDUCTION} standard deduction`,
      body: <>
        <p className="lg-p">{`Legal basis: Article 39(3)(a) of the Income Tax Code. An individual who lets property deducts ${DEDUCTION} for repairs, maintenance, renovation and other running costs, without receipts for this presumed expense.`}</p>
        <ul className="lg-ul">
          <li><strong style={{ color: 'var(--text-primary)' }}>Gross rent for the year:</strong> R</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>Standard deduction:</strong> {f.fn(PRESUMPTIVE_DEDUCTION_RATE, 2)} × R</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>Taxable (as a rule):</strong> {f.fn(1 - PRESUMPTIVE_DEDUCTION_RATE, 2)} × R</li>
        </ul>
      </>,
    },
    {
      id: 'bank', over: '3. How rent is paid', title: 'The bank collection rule',
      body: <>
        <p className="lg-p">{`Legal basis: Article 210 of Law 5222/2025, which added paragraph 5 to Article 39 of the Income Tax Code. If rent is not paid into the landlord’s bank account declared to AADE (Greece’s tax authority), the ${DEDUCTION} standard deduction is lost.`}</p>
        <div className="lg-note lg-note-tip" style={{ marginTop: 16 }}>
          {`For ${FIRST_YEAR_BANK_RECEIPT - 2} and ${FIRST_YEAR_BANK_RECEIPT - 1} income, the ${DEDUCTION} deduction applies however the rent is collected. The penalty, no bank payment and no ${DEDUCTION}, starts on ${BANK_FROM}.`}
        </div>
      </>,
    },
    {
      id: 'examples', over: '4. In practice', title: 'Three examples in euros',
      body: <>
        <p className="lg-p">{`Assumptions: an individual, a long-term lease, the ${DEDUCTION} deduction, the ${FIRST_YEAR_NEW_BRACKETS} brackets.`}</p>
        <h3 style={h3}>{`Example 1: rent of ${f.feWhole(EX1_MONTHLY)} a month (${f.feWhole(EX1.gross)} a year)`}</h3>
        <p className="lg-p">{`All taxable income stays in the ${pct(NEW[0].rate)} bracket.`}</p>
        <GuideTable caption="Example 1" head={['Step', 'Result']} min="260px" rows={rows(EX1)} />
        <h3 style={h3}>{`Example 2: rent of ${f.feWhole(EX2_MONTHLY)} a month (${f.feWhole(EX2.gross)} a year)`}</h3>
        <p className="lg-p">{`The first ${f.feWhole(EX2_LOW.width)} is taxed at ${pct(EX2_LOW.rate)} (${f.feWhole(EX2_LOW.tax)}) and the remaining ${f.feWhole(EX2_HIGH.width)} at ${pct(EX2_HIGH.rate)} (${f.feWhole(EX2_HIGH.tax)}).`}</p>
        <GuideTable caption="Example 2" head={['Step', 'Result']} min="260px" rows={rows(EX2)} />
        <h3 style={h3}>{`Example 3: gross rent of ${f.feWhole(EX3_GROSS)}, with and without the deduction`}</h3>
        <GuideTable caption={`Example 3, with the ${DEDUCTION} deduction`} head={['Step', 'Result']} min="260px" rows={rows(EX3)} />
        <GuideTable caption="Example 3, rent collected in cash (no deduction)" head={['Step', 'Result']} min="260px" rows={rows(EX3_CASH)} />
        <p className="lg-p" style={{ marginTop: 16 }}>{`Difference: ${f.feWhole(EX3_CASH.tax - EX3.tax)}. The cash case shows the tax when a whole year’s rent is collected in cash, as from ${FIRST_YEAR_BANK_RECEIPT + 1}; in ${FIRST_YEAR_BANK_RECEIPT} the penalty covers only rent collected from 1 ${MONTHS[FIRST_MONTH_BANK_RECEIPT - 1]}.`}</p>
      </>,
    },
  ];
  return (
    <GuideShellEn el={EL} path={PATH} h1={H1} description={DESC} about="Tax on rental income in Greece"
      intro={<>
        <p className="lg-p">If you let a property in Greece, rental income is not taxed with your salary or pension. It has its own progressive brackets, from the first euro.</p>
        <p className="lg-p">{`For income earned in tax year ${FIRST_YEAR_NEW_BRACKETS} (declared in ${FIRST_YEAR_NEW_BRACKETS + 1}), the reformed brackets of Article 8 of Law 5246/2025 apply. Rental income is declared on form E2, the schedule of property income inside the Greek income tax return (form E1), filed on myAADE, the AADE online portal.`}</p>
        <p className="lg-p">This guide gives you the order of magnitude before you talk to your accountant.</p>
      </>}
      sections={sections}
      sources={[
        <>{`Rental income brackets ${FIRST_YEAR_NEW_BRACKETS} (${SCALE}): Article 8 of `}<a href={LAW_5246_PDF} target="_blank" rel="noopener noreferrer" hrefLang="el" className="lp-link" style={LINK}>Law 5246/2025 (Government Gazette A 198/11.11.2025)</a>{', in force under Article 47(3).'}</>,
        `Standard deduction ${DEDUCTION}: Article 39(3)(a) of Law 4172/2013 (Income Tax Code).`,
        <>{'Collecting rent through a bank: Article 210 of '}<a href={LAW_5222_PDF} target="_blank" rel="noopener noreferrer" hrefLang="el" className="lp-link" style={LINK}>Law 5222/2025 (Government Gazette A 134/28.07.2025)</a>{`; start postponed to ${BANK_FROM} by AADE Decision A.1187/2026.`}</>,
      ]}
      faq={FAQ} faqTitle="What people ask about rental income tax"
      cta={{ title: 'Your own rental income tax', href: '/en/rental-income-tax-calculator', action: 'Calculate your tax',
        body: 'Enter the rent and the months. The calculation runs on your device. ENFIA is calculated separately.' }} />
  );
}
