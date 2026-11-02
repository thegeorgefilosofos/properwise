// ═══════════════════════════════════════════════════════════════════════════
// Ο ΥΠΟΛΟΓΙΣΤΗΣ ΣΤΕΓΑΣΤΙΚΟΥ ΣΤΑ ΑΓΓΛΙΚΑ (/en/mortgage-calculator)
// ─────────────────────────────────────────────────────────────────────────
// Ο ίδιος υπολογισμός (lib/tools/stegastiko.ts, lib/loans/affordability.ts)·
// εδώ μόνο λέξεις. Οι τιμές της αγοράς έρχονται από τις ίδιες σειρές της ΕΚΤ·
// ο μήνας γράφεται από την ημερομηνία παρατήρησης (`asOf`), όχι από το ελληνικό
// κείμενο της σειράς.
// ═══════════════════════════════════════════════════════════════════════════
import type { MarketFact, MortgageMarket } from '@/lib/tools/stegastiko';
import { freshFact, startRates } from '@/lib/tools/stegastiko';
import { fmtFor } from '@/lib/core/format';

const f = fmtFor('en');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthOf = (fact: MarketFact) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fact.asOf);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : fact.asOf;
};
const SOURCE = 'ECB, with Bank of Greece data';

export const MORTGAGE_EN = {
  loan: 'The loan', amount: 'Loan amount', term: 'Term', years: 'years',
  rate: 'Interest rate', fixed: 'Fixed', floating: 'Floating',
  fixedRate: 'Fixed rate', margin: 'Bank margin',
  fixedHint: 'The nominal rate on the bank’s offer.',
  euriborHint: 'The index in your contract, usually 3-month.',
  marginHint: 'The margin on the offer, above Euribor.',
  /** Η τιμή της αγοράς ως βοήθεια, όσο το πεδίο την κρατά. */
  fixedMarket: (fact: MarketFact) => `Average rate on new mortgages fixed for over 1 year, ${monthOf(fact)}, ${SOURCE}. If your offer says something else, enter that.`,
  euriborMarket: (fact: MarketFact) => `3-month Euribor, monthly average, ${monthOf(fact)}, ECB. If your offer says something else, enter that.`,
  marginMarket: (m: MortgageMarket): string | null => {
    const fl = freshFact(m.floating);
    if (!fl || !startRates(m).spread) return null;
    return `New mortgages, floating or fixed for up to 1 year, ${f.fp(fl.value)} (${monthOf(fl)}, ${SOURCE}), minus Euribor. If your offer says something else, enter that.`;
  },
  clampYears: (max: number) => `Maximum term ${max} years; calculated with ${max}.`,
  clampRate: (max: string) => `Maximum rate ${max}; calculated with ${max}.`,
  paper: 'Mortgage payment',
  pAmount: 'Amount', pFloating: 'Floating', notGiven: 'not given', pIncome: 'Net income', pDebts: 'Other payments',
  yearsOf: (n: string) => `${n} years`,
  needLoan: 'The payment needs an amount and a term.',
  needFixed: 'Enter the rate on your offer to see the payment. You’ll find it on the bank’s offer or its rate sheet.',
  needFloating: 'Enter Euribor and the bank’s margin to see the payment.',
  monthly: 'Monthly payment', totalInterest: 'Total interest',
  say: (m: string, i: string) => `Monthly payment ${m}. Total interest ${i}.`,
  plus1: (eur: string, pay: string) => `This payment holds while Euribor stays at ${eur}. If it rises by one point, it becomes ${pay}.`,
  principal: 'Principal', interest: 'Interest', total: (n: string) => `Total of ${n} payments`,
  y1Interest: 'First-year interest', y1Principal: 'First-year principal', y1Share: 'Interest share, first year',
  schedule: 'Interest and principal by year',
  colYear: 'Year', colInterest: 'Interest', colPrincipal: 'Principal', colBalance: 'Balance',
  onlyFirst: (n: number) => `Only the first ${n} years`, allYears: (n: number) => `All ${n} years`,
  howMuch: 'How much can I borrow',
  income: 'Net monthly income', incomeHint: 'For the household, after taxes and social security.',
  debts: 'Other monthly payments', debtsHint: 'Personal loans, cards, another mortgage.',
  first: 'First time borrowing?', yes: 'Yes', no: 'No',
  firstHint: (first: string, other: string) =>
    `All payments together up to ${first} of net income the first time; up to ${other} if you already own property or have had a mortgage.`,
  capNeedRate: 'The maximum loan uses the rate and term above. Fill those in first.',
  capNeedIncome: 'Enter your net monthly income to see how large a loan fits.',
  upTo: 'Loan up to', payUpTo: 'Payment up to',
  sayCap: (l: string, p: string) => `Loan up to ${l}, with a payment up to ${p}.`,
  within: (loan: string, burden: string, share: string, limit: string) =>
    `A loan of ${loan} needs ${burden} a month together with your other payments, or ${share} of income: within the ${limit} limit.`,
  overBy: (loan: string, burden: string, share: string, limit: string, over: string) =>
    `A loan of ${loan} needs ${burden} a month together with your other payments, or ${share} of income: over the ${limit} limit by ${over} a month.`,
  capNote: 'This is the maximum the debt-service-to-income limit allows, not an approval. The bank also checks your down payment, income stability and payment history.',
  notLead: 'What it includes and what it doesn’t.',
  not: 'The payment uses the standard amortizing loan formula, the same every month for the whole term. It does not include application, valuation or lien registration fees, insurance premiums or changes in Euribor. To compare offers, look at the APR each offer states.',
};

export const MORTGAGE_PAGE_EN = {
  title: (year: number) => `Greek mortgage calculator ${year}: payment, interest, how much you can borrow`,
  h1: 'Mortgage calculator for Greece: monthly payment and how much you can borrow',
  description: 'Monthly payment, total interest and the largest mortgage your income allows under the Bank of Greece limit. Market rates from the ECB. No sign-up.',
  lede: 'Monthly payment and total interest for a fixed or floating rate, and the largest loan the Bank of Greece limit allows for your income.',
  ctaTitle: 'Already have a mortgage?',
  ctaBody: 'PROPERWISE keeps the loan with each property, tracks every payment and shows what the interest does to your yield.',
};

export function mortgageFaqEn(x: { first: string; other: string }) {
  return [
    {
      q: 'How is the monthly mortgage payment calculated?',
      a: 'With the standard amortizing loan formula: the payment stays the same every month and, early on, is mostly interest. As the balance falls, more of each payment goes to principal.',
    },
    {
      q: 'How much can I borrow on my salary in Greece?',
      a: `The Bank of Greece caps the payment: all loan payments together up to ${x.first} of net income for first-time borrowers and ${x.other} for everyone else (Executive Committee Act 227/1/08.03.2024, from 1 Jan 2025). What counts is whether you are borrowing for the first time, not whether it is your first home.`,
    },
    {
      q: 'Fixed or floating?',
      a: 'A fixed rate keeps the payment the same for the fixed period. A floating rate follows Euribor plus the bank’s margin, so the payment changes when Euribor moves. The calculator shows what one point more on Euribor would do to a floating payment.',
    },
    {
      q: 'Is this a loan offer?',
      a: 'No. It is an estimate. The bank decides on approval and terms, and its offer states the full cost, including fees, as an APR.',
    },
  ];
}
