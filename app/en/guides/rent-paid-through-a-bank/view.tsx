import type { Metadata } from 'next';
import Link from 'next/link';
import { siteUrl } from '@/lib/core/site';
import { fmtFor } from '@/lib/core/format';
import {
  FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT, FIRST_YEAR_NEW_BRACKETS, RENTAL_TAX_BRACKETS_2026,
  rentalBracketsForYear, rentalIncomeTax, marginalRate, type TaxBracket,
} from '@/lib/billing/greekTax';
import { PRESUMPTIVE_DEDUCTION_RATE } from '@/lib/billing/presumptive';
import { longDateEn } from '@/lib/i18n/en/dates';
import { publicMetadata } from '../../../publicMetadata';
import { shareImage } from '../../../og/share';
import { topBracketFrom } from '../../../odigos/taxText';
import { LAW_5246_PDF, LAW_5222_PDF } from '../../../odigos/fek';
import { GuideShellEn, type EnFaq } from '../GuideShellEn';

// ═══════════════════════════════════════════════════════════════════════════
// Ο οδηγός «Ενοίκιο μέσω τράπεζας» στα αγγλικά
// ─────────────────────────────────────────────────────────────────────────
// Η έναρξη, η έκπτωση και η κλίμακα από το lib/billing, τα ποσά των δύο
// παραδειγμάτων από την `rentalIncomeTax`, όπως στον ελληνικό οδηγό (ίδια
// ενοίκια). Οι αριθμοί νόμων και αποφάσεων και οι δύο προηγούμενες
// ημερομηνίες έναρξης (1 Απριλίου και 1 Οκτωβρίου 2026) είναι γραμμένοι με το
// χέρι στον ελληνικό οδηγό, χωρίς σταθερά· εδώ τους ακολουθεί, όπως ο αγγλικός
// οδηγός της φορολογίας ενοικίων.
// ═══════════════════════════════════════════════════════════════════════════
const PATH = '/en/guides/rent-paid-through-a-bank';
const EL = '/odigos/enoikio-meso-trapezas';
const RENT_GUIDE = '/en/guides/greek-rental-income-tax-2026';
const f = fmtFor('en');
const pct = (rate: number) => f.fpRate(rate * 100);
const scale = (b: readonly TaxBracket[]) => `${b.map(x => f.fn(x.rate * 100)).join(' / ')}%`;
const series = (b: readonly TaxBracket[]) => {
  const p = b.map(x => pct(x.rate));
  return `${p.slice(0, -1).join(', ')} and ${p[p.length - 1]}`;
};

const BANK_FROM_ISO = `${FIRST_YEAR_BANK_RECEIPT}-${String(FIRST_MONTH_BANK_RECEIPT).padStart(2, '0')}-01`;
const BANK_FROM = longDateEn(BANK_FROM_ISO);
const DEDUCTION = pct(PRESUMPTIVE_DEDUCTION_RATE);
const TAXED = pct(1 - PRESUMPTIVE_DEDUCTION_RATE);
const NEW = RENTAL_TAX_BRACKETS_2026;
const OLD = rentalBracketsForYear(FIRST_YEAR_NEW_BRACKETS - 1);
const THRESHOLD = f.feWhole(topBracketFrom(NEW));
const TOP = pct(NEW[NEW.length - 1].rate);
const Y1 = FIRST_YEAR_BANK_RECEIPT - 2;
const Y2 = FIRST_YEAR_BANK_RECEIPT - 1;

/** Ενα ενοίκιο όλο τον χρόνο, μόνο εισόδημα από ακίνητα: φόρος με και χωρίς την έκπτωση. */
function bankExample(monthly: number) {
  const gross = monthly * 12;
  const taxable = gross * (1 - PRESUMPTIVE_DEDUCTION_RATE);
  const tax = rentalIncomeTax(taxable, NEW);
  const taxCash = rentalIncomeTax(gross, NEW);
  return {
    monthly, gross, taxable, tax, taxCash, deduction: gross - taxable, diff: taxCash - tax,
    rate: marginalRate(taxable, NEW), rateCash: marginalRate(gross, NEW),
    eff: (tax / gross) * 100, effCash: (taxCash / gross) * 100,
  };
}
const EX = bankExample(700);
const EX_HIGH = bankExample(1_800);

const H1 = `Rent through a bank in Greece: what changes from ${BANK_FROM}`;
const DESC = `From ${BANK_FROM}, residential rent taken in cash in Greece loses the ${DEDUCTION} standard deduction. What counts as a bank payment, and what applies to ${Y1} and ${Y2}.`;

export function generateMetadata(): Metadata {
  return publicMetadata({ title: H1, description: DESC, url: siteUrl(PATH), type: 'article', image: shareImage('en-guide-rent-bank') });
}

const FAQ: EnFaq[] = [
  {
    q: `When do I lose the ${DEDUCTION} if I take rent in cash?`,
    a: `From ${BANK_FROM} (AADE Decision A.1187/2026, Government Gazette B 5590/17.09.2026). For ${Y1} and ${Y2} income, the deduction applies however the rent is collected.`,
  },
  {
    q: 'How much more tax do I pay with cash?',
    a: `The deduction you lose, ${DEDUCTION} of gross rent, is taxed at your bracket’s rate. With ${f.feWhole(EX.monthly)} a month and the ${FIRST_YEAR_NEW_BRACKETS} brackets, the tax rises from ${f.feWhole(EX.tax)} to ${f.feWhole(EX.taxCash)}, or ${f.feWhole(EX.diff)} a year. With ${f.feWhole(EX_HIGH.monthly)} a month the difference reaches ${f.feWhole(EX_HIGH.diff)}.`,
  },
  {
    q: 'Does a payment through IRIS count?',
    a: 'Yes. The law asks for rent to be paid by electronic or bank means into a landlord’s account declared to AADE. A deposit, a bank transfer and IRIS all pay rent into such an account; cash in hand does not.',
  },
  {
    q: `Does it affect the ${Y2} and ${FIRST_YEAR_BANK_RECEIPT} tax returns?`,
    a: `No. The ${Y2} return covers ${Y1} income, for which the ${DEDUCTION} deduction applies however the rent is collected. The same holds for ${Y2} income, declared in ${FIRST_YEAR_BANK_RECEIPT}.`,
  },
  {
    q: 'Do the rental tax brackets change?',
    a: `Not under this rule. The brackets of ${scale(NEW)} were set by Law 5246/2025 and apply to income from ${FIRST_YEAR_NEW_BRACKETS}. Collecting rent through a bank is a separate rule, in Law 5222/2025, with its own start date.`,
  },
];

const LINK = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } as const;
const STRONG = { color: 'var(--text-primary)' } as const;

export default function Page() {
  const sections = [
    {
      id: 'the-rule', over: '1. The rule', title: 'What changes',
      body: <>
        <p className="lg-p">{`Legal basis: Article 210 of Law 5222/2025 added paragraph 5 to Article 39 of the Greek Income Tax Code. As a rule, a ${DEDUCTION} presumed expense for repairs and upkeep is taken off gross rent without receipts (Article 39(3)(a) of the Income Tax Code), so ${TAXED} is taxed. The new paragraph adds a condition: if the rent is not paid into the landlord’s bank account declared to AADE, the deduction doesn’t apply.`}</p>
        <ul className="lg-ul">
          <li><strong style={STRONG}>Collected through a bank:</strong>{` ${TAXED} of gross rent is taxable.`}</li>
          <li><strong style={STRONG}>{`Collected in cash, from ${BANK_FROM}:`}</strong>{' all of it is taxable.'}</li>
          <li><strong style={STRONG}>The brackets don’t change:</strong>{` ${series(NEW)}, with ${TOP} only above ${THRESHOLD}. They are set by a separate rule (Law 5246/2025), with its own start date.`}</li>
        </ul>
        <p className="lg-p">The brackets and the deduction are explained in full in the guide <Link href={RENT_GUIDE} className="lp-link" style={LINK}>Greek rental income tax in 2026</Link>.</p>
      </>,
    },
    {
      id: 'start', over: '2. Start date', title: `From ${BANK_FROM}`,
      body: <>
        <p className="lg-p">{`The penalty starts on ${BANK_FROM}, under AADE Decision A.1187/2026 (Government Gazette B 5590/17.09.2026). It is the third start date to be set:`}</p>
        <ul className="lg-ul">
          <li><strong style={STRONG}>1 April 2026:</strong>{' the original start, under Article 129(1) of Law 5264/2025.'}</li>
          <li><strong style={STRONG}>1 October 2026:</strong>{' the first postponement, under Article 48 of Law 5294/2026.'}</li>
          <li><strong style={STRONG}>{`${BANK_FROM}:`}</strong>{' the current start, under Decision A.1187/2026.'}</li>
        </ul>
        <div className="lg-note lg-note-tip" style={{ marginTop: 16 }}>{`For ${FIRST_YEAR_BANK_RECEIPT}, the penalty covers rent collected in cash from ${BANK_FROM}. How the year is split on the tax return is something to confirm with your accountant.`}</div>
      </>,
    },
    {
      id: 'bank-payment', over: '3. How rent is paid', title: 'What counts as paying through a bank',
      body: <>
        <p className="lg-p">The law asks for rent to be paid by electronic or bank means into a landlord’s account declared to AADE. In practice:</p>
        <ul className="lg-ul">
          <li>A deposit of the rent into your account.</li>
          <li>A bank transfer from the tenant’s account.</li>
          <li>A payment through IRIS, Greece’s real-time instant payment system.</li>
        </ul>
        <p className="lg-p">Cash in hand doesn’t meet the condition. If you’re not sure whether another way of paying meets it, check with your accountant.</p>
      </>,
    },
    {
      id: 'transition', over: '4. In the meantime', title: `${Y1} and ${Y2} income`,
      body: <>
        <p className="lg-p">{`For ${Y1} and ${Y2} income, the ${DEDUCTION} standard deduction applies however the rent is collected. Even if the tenant pays in cash during those years, taxable income stays at ${TAXED} of gross rent.`}</p>
        <ul className="lg-ul">
          <li><strong style={STRONG}>{`${Y1} income, ${Y2} return:`}</strong>{` brackets of ${scale(OLD)} and the ${DEDUCTION} deduction.`}</li>
          <li><strong style={STRONG}>{`${Y2} income, ${FIRST_YEAR_BANK_RECEIPT} return:`}</strong>{` brackets of ${scale(NEW)} and the ${DEDUCTION} deduction.`}</li>
          <li><strong style={STRONG}>{`Rent from ${BANK_FROM}:`}</strong>{` the ${DEDUCTION} deduction only when collected through a bank.`}</li>
        </ul>
        <p className="lg-p">{`Until ${BANK_FROM} you have time to change how the rent is paid at no tax cost.`}</p>
      </>,
    },
    {
      id: 'example', over: '5. Example', title: `What the ${DEDUCTION} is worth in euros`,
      body: <>
        <p className="lg-p">{`An apartment let for ${f.feWhole(EX.monthly)} a month all year, the only income from property, with the ${FIRST_YEAR_NEW_BRACKETS} brackets:`}</p>
        <ul className="lg-ul">
          <li><strong style={STRONG}>Gross rent:</strong>{` ${f.feWhole(EX.monthly)} × 12 = ${f.feWhole(EX.gross)}.`}</li>
          <li><strong style={STRONG}>Collected through a bank:</strong>{` ${TAXED} is taxable, or ${f.feWhole(EX.taxable)}. Tax: ${f.feWhole(EX.taxable)} × ${pct(EX.rate)} = ${f.feWhole(EX.tax)}.`}</li>
          <li><strong style={STRONG}>Collected in cash:</strong>{` all of it is taxable, or ${f.feWhole(EX.gross)}. Tax: ${f.feWhole(EX.gross)} × ${pct(EX.rateCash)} = ${f.feWhole(EX.taxCash)}.`}</li>
          <li><strong style={STRONG}>{`Difference: ${f.feWhole(EX.diff)} a year.`}</strong>{` That is the ${f.feWhole(EX.deduction)} deduction taxed at ${pct(EX.rateCash)}. Tax as a share of gross rent rises from ${f.fpRate(EX.eff)} to ${f.fpRate(EX.effCash)}.`}</li>
        </ul>
        <p className="lg-p">{`The cost grows with the bracket. With rent of ${f.feWhole(EX_HIGH.monthly)} a month (${f.feWhole(EX_HIGH.gross)} gross), taxable income is ${f.feWhole(EX_HIGH.taxable)} with the deduction and ${f.feWhole(EX_HIGH.gross)} without it. The tax goes from ${f.feWhole(EX_HIGH.tax)} to ${f.feWhole(EX_HIGH.taxCash)}, ${f.feWhole(EX_HIGH.diff)} more: the ${f.feWhole(EX_HIGH.deduction)} deduction is now taxed at ${pct(EX_HIGH.rateCash)}.`}</p>
        <div className="lg-note lg-note-tip" style={{ marginTop: 16 }}>{`The amounts use the ${FIRST_YEAR_NEW_BRACKETS} brackets. If the brackets change for ${FIRST_YEAR_NEW_BRACKETS + 1} income, the amounts change too. If you have other rents, the deduction you lose is taxed at your own marginal bracket.`}</div>
      </>,
    },
    {
      id: 'next-steps', over: '6. In practice', title: 'What to do now',
      body: <>
        <ul className="lg-ul">
          <li>Ask your tenant to pay the rent into an account or through IRIS.</li>
          <li>Give them the IBAN of the account you collect rent into.</li>
          <li>Make sure the account is declared to AADE. How to declare it is something to confirm with your accountant.</li>
          <li>Keep proof for every rent payment: the account statement or the deposit slip.</li>
          <li>{`If your tenant pays in cash today, agree the change with them before ${BANK_FROM}.`}</li>
        </ul>
      </>,
    },
  ];
  return (
    <GuideShellEn el={EL} path={PATH} h1={H1} description={DESC} about={`Collecting residential rent through a bank and the ${DEDUCTION} standard deduction in Greek income tax`}
      intro={<>
        <p className="lg-p">{`From ${BANK_FROM}, the ${DEDUCTION} standard deduction on residential rent applies only if the rent is paid by bank or electronic means. A landlord who takes the rent in cash loses the deduction and is taxed on all of the rent instead of ${TAXED}.`}</p>
        <p className="lg-p">{`The rule was passed in 2025 and its start date has been moved twice. For ${Y1} and ${Y2} income, the deduction applies however the rent is collected. This guide explains what changes, what it costs in euros and what to ask your tenant before it starts.`}</p>
      </>}
      sections={sections}
      sources={[
        <>{'Collecting rent through a bank: Article 210 of '}<a href={LAW_5222_PDF} target="_blank" rel="noopener noreferrer" hrefLang="el" className="lp-link" style={LINK}>Law 5222/2025 (Government Gazette A 134/28.07.2025)</a>{', adding paragraph 5 to Article 39 of the Income Tax Code.'}</>,
        `Start date: set at 1 April 2026 by Article 129(1) of Law 5264/2025 (Government Gazette A 239/19.12.2025), moved to 1 October 2026 by Article 48 of Law 5294/2026 (Government Gazette A 58/08.04.2026) and to ${BANK_FROM} by AADE Decision A.1187/2026 (Government Gazette B 5590/17.09.2026).`,
        `Standard deduction of ${DEDUCTION}: Article 39(3)(a) of Law 4172/2013 (Income Tax Code).`,
        <>{`Rental income brackets ${FIRST_YEAR_NEW_BRACKETS} (${scale(NEW)}, top rate above ${THRESHOLD}): Article 8 of `}<a href={LAW_5246_PDF} target="_blank" rel="noopener noreferrer" hrefLang="el" className="lp-link" style={LINK}>Law 5246/2025 (Government Gazette A 198/11.11.2025)</a>{'.'}</>,
      ]}
      faq={FAQ} faqTitle="What people ask about rent through a bank"
      cta={{ title: 'Your own rental income tax', href: '/en/rental-income-tax-calculator', action: 'Calculate your tax',
        body: 'Enter the rent and the months. The calculation runs on your device.' }} />
  );
}
