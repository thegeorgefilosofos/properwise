// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΚΠΤΩΣΗ ΦΟΡΟΥ ΑΝΑΚΑΙΝΙΣΗΣ ΣΤΑ ΑΓΓΛΙΚΑ (/en/renovation-tax-credit-calculator)
// ─────────────────────────────────────────────────────────────────────────
// Ο ίδιος υπολογισμός (lib/accounting/renovation39b.ts)· εδώ μόνο λέξεις. Το
// όριο, τα έτη, το μερίδιο υλικών και οι ημερομηνίες έρχονται από εκεί.
// ═══════════════════════════════════════════════════════════════════════════
import {
  RENO_39B_CAP, RENO_39B_YEARS, RENO_39B_PER_YEAR, RENO_39B_MATERIALS_SHARE, RENO_39B_FROM, RENO_39B_TO,
} from '@/lib/accounting/renovation39b';
import { fmtFor } from '@/lib/core/format';

const f = fmtFor('en');
/** «01/01/2024» (η γραφή του μητρώου) → «1 Jan 2024». */
const dmy = (s: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  return m ? f.date(`${m[3]}-${m[2]}-${m[1]}`) : s;
};
export const RENO_FROM_EN = dmy(RENO_39B_FROM);
export const RENO_TO_EN = dmy(RENO_39B_TO);
const SHARE = `${f.fn(1)}/${f.fn(Math.round(1 / RENO_39B_MATERIALS_SHARE))}`;
const YEARS = f.fn(RENO_39B_YEARS);

export const RENO_EN = {
  costs: 'Your costs',
  services: 'Services (labor)',
  servicesHint: 'Fees for tradespeople and contractors, invoiced to your Greek tax number (AFM) and paid electronically.',
  materials: 'Materials', materialsHint: `Count up to ${SHARE} of the value of the services.`,
  taxes: `Your tax over the ${YEARS} years (optional)`,
  taxYear: (i: number) => `Tax, year ${i}`,
  taxNote: 'Your income tax for each year, as shown on the assessment. The credit never exceeds it, and any excess is not refunded.',
  paper: 'Renovation tax credit',
  notGiven: 'not given',
  needServices: 'Enter the amount for services to see the credit.',
  total: 'Total tax credit', perYear: 'Per year', eligible: 'Eligible cost',
  say: (t: string, y: string) => `Tax credit ${t}, ${y} a year for ${YEARS} years.`,
  counted: `Materials counted (up to ${SHARE} of services)`,
  cap: 'Cap, across all years',
  equal: 'Tax credit, equal to the cost',
  shares: `Per year, in ${YEARS} equal shares`,
  byYear: 'The credit each year',
  colYear: 'Year', colTax: 'Tax', colCredit: 'Credit', year: (i: number) => `Year ${i}`,
  noteTax: (applied: string, total: string) => `In years with no tax, the credit is zero. In total, your tax falls by ${applied} out of the ${total} the cost allows.`,
  noteNoTax: 'Each year, the credit does not exceed that year’s tax. Enter your tax for each year to see how much you would actually get.',
  window: ` It applies to costs from ${RENO_FROM_EN} to ${RENO_TO_EN}.`,
};

export const RENO_PAGE_EN = {
  title: `Greek renovation tax credit calculator: up to ${f.feWhole(RENO_39B_CAP)} (Article 39B)`,
  h1: 'Greek renovation tax credit: how much it cuts your tax',
  description: `How much renovation services reduce your Greek income tax: up to ${f.feWhole(RENO_39B_CAP)} over ${YEARS} years, materials up to ${SHARE} of services, never more than each year’s tax.`,
  lede: 'The cut in your Greek income tax for renovation services, per year and in total, under Article 39B of the Income Tax Code.',
  ctaTitle: 'Keep the invoices where you can find them.',
  ctaBody: 'PROPERWISE keeps renovation invoices with the property and reminds you which year’s credit is coming up.',
};

export function renoFaqEn() {
  return [
    {
      q: 'How large is the renovation tax credit?',
      a: `The tax cut equals the eligible cost, up to ${f.fe(RENO_39B_CAP)} in total across all years, in ${YEARS} equal annual shares, or up to ${f.fe(RENO_39B_PER_YEAR)} a year.`,
    },
    {
      q: 'What if my tax is lower than the annual share?',
      a: 'Each year’s credit cannot exceed that year’s tax, and any excess is neither refunded nor carried forward. Enter your tax for each year in the calculator to see the credit you would actually get.',
    },
    {
      q: 'How much in materials counts?',
      a: `Materials count up to ${SHARE} of the value of the services. Anything above that does not count, however much you bought.`,
    },
    {
      q: 'Which costs qualify?',
      a: `Costs from ${RENO_FROM_EN} to ${RENO_TO_EN}, invoiced to the owner’s Greek tax number (AFM), paid electronically, to a provider tax-resident or with a permanent establishment in Greece (Joint Ministerial Decision A.1153/2025). The same cost cannot also be deducted as a business expense.`,
    },
  ];
}
