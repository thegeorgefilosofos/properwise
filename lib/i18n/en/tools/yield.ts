// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΘΑΡΗ ΑΠΟΔΟΣΗ ΣΤΑ ΑΓΓΛΙΚΑ (/en/rental-yield-calculator)
// ─────────────────────────────────────────────────────────────────────────
// Ο ίδιος υπολογισμός (lib/tools/apodosi.ts)· εδώ μόνο λέξεις.
// ═══════════════════════════════════════════════════════════════════════════

export const YIELD_EN = {
  property: 'The property', costs: 'What it costs you',
  value: 'Property value', monthly: 'Monthly rent', months: 'Months rented', monthsUnit: 'months',
  clamp: (max: number) => `Up to ${max} months; calculated with ${max}.`,
  enfia: 'ENFIA per year', enfiaHint: 'Greece’s annual property tax. Due even when the property is empty.', enfiaLink: 'Calculate it',
  expenses: 'Expenses per year', expensesHint: 'Maintenance, insurance, building charges you pay yourself.',
  other: 'Other rent per year', otherHint: 'Gross, from your other properties. It pushes this one into a higher bracket.',
  afterTax: 'Yield after tax', net: 'Net yield', gross: 'Gross yield', grossShort: 'Gross',
  keep: 'You keep', tax: 'Tax', enfiaShort: 'ENFIA', expensesShort: 'Expenses',
  noCosts: 'No ENFIA or expenses entered, so the yield deducts tax only. Fill in both to see the net yield.',
  needValue: 'Yield needs a value. Enter what the property is worth, or what you would pay for it, and the rest follows.',
  split: (parts: string) => `Where the rent goes: ${parts}.`,
  paper: (name: string) => (name ? `Net yield · ${name}` : 'Net rental yield'),
  pValue: 'Value', pMonths: 'Months', pOther: 'Other rent',
  notEntered: 'not entered',
  annual: 'Annual rent', incomeTax: 'Income tax', keepYear: 'You keep per year',
  perMonth: 'Net per month', payback: 'Payback years', needs: 'Needs a value', never: 'Never pays back',
  marginal: 'Marginal rate',
  printName: 'Name for the printout', printPh: 'e.g. Downtown apartment, 3rd floor',
  notLead: 'What it includes and what it doesn’t.',
  not: (year: number, scale: string, deduction: string, from: string) =>
    `Tax uses the ${year} rental income brackets (${scale}) and the ${deduction} standard deduction, which from ${from} requires rent to be paid through a bank (Law 5222/2025); here, payment through a bank is assumed. It does not include changes in value, a loan and interest, buying or selling costs, renovation, unpaid rent, short-term rentals, companies or income other than rent.`,
};

export const YIELD_PAGE_EN = {
  title: (year: number) => `Net rental yield calculator ${year}: after Greek tax and ENFIA`,
  h1: 'Net rental yield: what a Greek property really earns',
  description: 'Gross and net rental yield on a property in Greece, after income tax, ENFIA and running costs. No sign-up.',
  lede: 'Gross yield is the rent over the value. Net yield is what is left after tax, ENFIA (Greece’s annual property tax) and expenses.',
  ctaTitle: 'Comparing more than one property?',
  ctaBody: 'PROPERWISE tracks actual rent, expenses and taxes for every property you own, so the yield you see is the one you got.',
};

export function yieldFaqEn(x: { deduction: string; scale: string; year: number }) {
  return [
    {
      q: 'What is the difference between gross and net yield?',
      a: 'Gross yield is the annual rent divided by the property’s value. Net yield subtracts income tax, ENFIA and your running costs first. The gap between the two is often larger than owners expect.',
    },
    {
      q: 'How is the tax calculated?',
      a: `With the ${x.year} rental income brackets (${x.scale}) on the rent minus the ${x.deduction} standard deduction. If you have other rental income, enter it: it pushes this property’s rent into a higher bracket.`,
    },
    {
      q: 'Why does other rent matter?',
      a: 'Greek rental income is taxed on your total from all properties. Rent from another property fills the lower brackets first, so the rent from this one is taxed at a higher rate.',
    },
    {
      q: 'What value should I enter?',
      a: 'What the property is worth today, or what you would pay for it. Not the objective value used for ENFIA, which is usually lower than the market price.',
    },
  ];
}
