// ═══════════════════════════════════════════════════════════════════════════
// Ο ΥΠΟΛΟΓΙΣΤΗΣ ΦΟΡΟΥ ΕΝΟΙΚΙΩΝ ΣΤΑ ΑΓΓΛΙΚΑ (/en/rental-income-tax-calculator)
// ─────────────────────────────────────────────────────────────────────────
// Ο ίδιος υπολογισμός (lib/billing/greekTax.ts, lib/billing/presumptive.ts)·
// εδώ μόνο λέξεις. Κάθε αριθμός έρχεται ως όρισμα από τις ίδιες σταθερές.
// ═══════════════════════════════════════════════════════════════════════════
import { FILING_CLOSED_FROM_MONTH } from '@/lib/core/declarationYear';
import { rentalBracketsForYear, FIRST_YEAR_NEW_BRACKETS, type TaxBracket } from '@/lib/billing/greekTax';
import { presumptiveDeductionRateForYear } from '@/lib/billing/presumptive';
import { fmtFor } from '@/lib/core/format';

const f = fmtFor('en');
const pct = (rate: number) => f.fpRate(rate * 100);

/** «15 / 25 / 35 / 45%», με αγγλική γραφή αριθμών. */
export const rateScaleEn = (brackets: readonly TaxBracket[]): string =>
  `${brackets.map(b => f.fn(b.rate * 100)).join(' / ')}%`;

/** Πότε δηλώνεται το εισόδημα μιας χρονιάς, ειπωμένο από σήμερα. Ο ίδιος κανόνας με το ελληνικό. */
export function filingNoteEn(year: number, today: string): string {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  const filed = year + 1;
  if (y > filed || (y === filed && m >= FILING_CLOSED_FROM_MONTH)) return `filed in ${filed}`;
  return y === filed ? 'filed this year' : `filed in ${filed}`;
}

export const RENT_EN = {
  monthly: 'Monthly rent',
  months: 'Months rented', monthsUnit: 'months',
  year: 'Income year',
  yearHint: (year: number, filing: string, scale: string) => year >= FIRST_YEAR_NEW_BRACKETS
    ? `Income for ${year}, ${filing}. Brackets ${scale} (Law 5246/2025).`
    : `Income for ${year}, ${filing}. Brackets ${scale}, without the middle bracket.`,
  clamp: (max: number) => `Up to ${max} months; calculated with ${max}.`,
  bank: 'Rent is paid through a bank',
  bankOn: (deduction: string, from: string) =>
    `Required for the ${deduction} standard deduction from ${from} (Law 5222/2025).`,
  bankOffFirst: (from: string, cost: string, year: number) =>
    `Rent collected in cash from ${from} is taxed on 100% (Law 5222/2025). The lost deduction costs you ${cost} for ${year}.`,
  bankOff: (cost: string) =>
    `Rent collected in cash is taxed on 100% (Law 5222/2025). The lost deduction costs you ${cost} a year.`,
  paper: (year: number) => `Rental income tax estimate ${year}`,
  months2: 'Months', annual: 'Annual rent', collection: 'Collected',
  viaBank: 'through a bank', inCash: 'in cash',
  tax: 'Tax', keep: 'You keep',
  say: (tax: string, net: string) => `Tax ${tax}. You keep ${net}.`,
  incomeTax: 'Income tax',
  incomeTaxSub: (taxable: string, deduction: string) =>
    `On taxable income of ${taxable}: the rent minus the standard deduction of ${deduction}.`,
  keepYear: 'You keep per year',
  perMonth: 'Net per month', share: 'Tax as a share of rent', marginal: 'Marginal rate',
  caption: (year: number) => `The ${year} brackets`,
  colIncome: 'Income', colRate: 'Rate', colTax: 'Tax in bracket',
  over: 'Over',
  notLead: 'What it doesn’t include.',
  not: (deduction: string) => `The calculation covers rental income only, with the ${deduction} standard deduction the law grants without receipts. It does not include your other income, ENFIA or special cases (short-term rentals, co-ownership, companies, vacant periods, unpaid rent).`,
};

// ── Η σελίδα ────────────────────────────────────────────────────────────────
export const RENT_PAGE_EN = {
  title: (year: number) => `Greek rental income tax calculator ${year}`,
  h1: (year: number) => `Greek rental income tax ${year}: calculate it with your own rent`,
  description: (year: number) =>
    `Estimate the Greek tax on your rental income with the ${year} brackets (${rateScaleEn(rentalBracketsForYear(year))}) `
    + `and the ${pct(presumptiveDeductionRateForYear(year, true))} standard deduction. No sign-up.`,
  lede: (deduction: string) => `With the brackets for the year you choose and the ${deduction} standard deduction.`,
  ctaTitle: 'Rather not calculate it again next year?',
  ctaBody: 'PROPERWISE keeps rents, bills and expenses organized all year and exports what your accountant asks for in one click.',
  exampleOver: (year: number) => `Worked example ${year}`,
  exampleTitle: (gross: string, tax: string) => `${gross} rent a year, ${tax} tax`,
  exampleLede: (monthly: string, months: string, year: number, deduction: string) =>
    `Monthly rent of ${monthly} for ${months} months, income for ${year}, with that year’s brackets and the ${deduction} standard deduction.`,
  deductionRow: (d: string) => `Standard deduction ${d}`,
  taxable: 'Taxable income',
  slice: (width: string, rate: string, to: string | null) => `${width} at ${rate}${to ? ` (bracket up to ${to})` : ''}`,
  exampleKeep: (net: string) => `You keep ${net} a year.`,
  exampleBank: 'The example assumes rent is paid through a bank. ',
  exampleAnyway: (year: number) => `For ${year} rent, the deduction applies however the rent is collected. `,
  exampleOpen: 'Open the example in the calculator',
  fileOver: 'Filing', fileTitle: 'How rent is declared on form E2',
  fileLede: (year: number) => `Rent goes on form E2, the schedule of property income, which you complete inside the Greek income tax return (form E1) of the following year: rent for ${year} is declared in ${year + 1}.`,
  // Η διαδρομή του lib/tax/aade.ts (AADE_DESTINATIONS.income), με τα ονόματα
  // του μενού μεταφρασμένα: η πύλη είναι μόνο στα ελληνικά.
  fileSteps: (portal: string) => [
    `On ${portal}, the online portal of AADE (Greece’s tax authority), with your TAXISnet credentials: Applications · Personal Income Tax Return · form E2 is completed inside the return. The portal is in Greek.`,
    'The lease table on E2 comes pre-filled from lease declarations and platform data. Check every row: address, tenant, months, monthly rent and gross amount.',
    'Each lease of the year is one row. For a co-owned property, each owner declares only their share on their own E2: the gross amount is the rent times the share.',
  ],
};

export function rentFaqEn(x: {
  firstYear: number; scaleWords: string; deduction: string; taxedShare: string; bankFrom: string;
  bankYear: number; strMax: number; strBusiness: number;
}) {
  return [
    {
      q: `How is rental income taxed in Greece from ${x.firstYear}?`,
      a: `With its own progressive brackets, separate from salaries: ${x.scaleWords}. Each bracket is taxed only on the income inside it, not your whole income at the top rate.`,
    },
    {
      q: `What is the ${x.deduction} standard deduction?`,
      a: `Greek law presumes expenses of ${x.deduction} of the gross rental income, with no receipts needed. Tax is calculated on the remaining ${x.taxedShare}.`,
    },
    {
      q: 'What changes if I collect rent in cash?',
      a: `Under Law 5222/2025 (Article 210), the ${x.deduction} standard deduction applies only if rent is paid electronically or through a bank; in cash, tax is calculated on 100% instead of ${x.taxedShare}. `
        + `The penalty starts on ${x.bankFrom} (AADE Decision A.1187/2026): for ${x.bankYear - 2} and ${x.bankYear - 1} income the deduction applies however the rent is collected.`,
    },
    {
      q: 'Is ENFIA included?',
      a: 'No. ENFIA is Greece’s annual property tax, charged on ownership and calculated separately from the objective value, zone, floor and age of the property. It is not deducted from rental income.',
    },
    {
      q: 'Does it apply to short-term rentals?',
      a: `Yes, for an individual with up to ${x.strMax} ${x.strMax === 1 ? 'property' : 'properties'} who provides no services beyond bed linen: the income is taxed with the same brackets and the same ${x.deduction} standard deduction. `
        + `Short-term rentals also pay the climate crisis resilience fee per night. From ${x.strBusiness} properties, or with other services, the activity becomes a business.`,
    },
  ];
}
