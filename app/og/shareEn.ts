// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΚΑΡΤΕΣ ΚΟΙΝΟΠΟΙΗΣΗΣ ΤΩΝ ΑΓΓΛΙΚΩΝ ΣΕΛΙΔΩΝ
// ─────────────────────────────────────────────────────────────────────────
// Ο σύνδεσμος μιας αγγλικής σελίδας σε LinkedIn ή WhatsApp δείχνει αγγλική
// κάρτα, από την ίδια διαδρομή (/og/<slug>) και το ίδιο πλαίσιο με τις
// ελληνικές. Κλειδί «en-…», ώστε να μη συγκρούεται ποτέ με ελληνικό slug.
// ═══════════════════════════════════════════════════════════════════════════
import type { ShareCard } from './share';
import { LANDING_EN } from '@/lib/i18n/en/landing';
import { enTools } from '@/lib/i18n/en/tools';

export const EN_SHARE_CARDS: Record<string, ShareCard> = {
  'en-home': { kind: 'calc', over: '', title: LANDING_EN.titleLines[0], accent: LANDING_EN.titleLines[1],
    chips: ['One property, no subscription', 'Income and expenses', 'Tax and ENFIA', 'Deadlines'], path: '/en' },
  'en-pricing': { kind: 'page', over: 'Pricing', title: 'What each plan includes',
    chips: ['Line by line', 'Questions to Noa', 'Document scanning', 'Form E2 export'], path: '/en/pricing' },
  'en-enfia-calculator': { kind: 'calc', over: 'Calculator', title: 'Estimate ENFIA on your Greek property',
    chips: ['Floor area', 'Zone price', 'Floor', 'Building age'], path: '/en/enfia-calculator' },
  'en-rental-income-tax-calculator': { kind: 'calc', over: 'Calculator', title: 'Tax on your rental income in Greece',
    chips: ['Monthly rent', 'Months rented', 'Income year', 'Standard deduction'], path: '/en/rental-income-tax-calculator' },
  'en-rental-yield-calculator': { kind: 'calc', over: 'Calculator', title: 'Net rental yield on a Greek property',
    chips: ['Property value', 'Rent', 'ENFIA', 'Expenses'], path: '/en/rental-yield-calculator' },
  'en-short-term-vs-long-term-rental': { kind: 'calc', over: 'Calculator', title: 'Short-term or long-term rental in Greece',
    chips: ['Nightly rate', 'Occupancy', 'Resilience fee', 'Break-even'], path: '/en/short-term-vs-long-term-rental' },
  'en-mortgage-calculator': { kind: 'calc', over: 'Calculator', title: 'Mortgage payment and how much you can borrow',
    chips: ['Monthly payment', 'Total interest', 'Fixed or floating', 'Income limit'], path: '/en/mortgage-calculator' },
  'en-property-purchase-costs': { kind: 'calc', over: 'Calculator', title: 'What it costs to buy a property in Greece',
    chips: ['Transfer tax', 'VAT on new builds', 'Fees', 'Cash needed'], path: '/en/property-purchase-costs' },
  'en-renovation-tax-credit-calculator': { kind: 'calc', over: 'Calculator', title: 'Greek tax credit for renovation',
    chips: ['Services', 'Materials', 'Per year', 'Cap'], path: '/en/renovation-tax-credit-calculator' },
  'en-rent-increase-calculator': { kind: 'calc', over: 'Calculator', title: 'Rent increase in Greece, by the lease clause',
    chips: ['Fixed rate', 'ELSTAT CPI', 'Year by year', 'Commercial cap'], path: '/en/rent-increase-calculator' },
  'en-form-e2-guide': { kind: 'calc', over: 'Filing guide', title: 'Greek form E2, column by column',
    chips: ['Each column', 'E1 code', 'Vacant or own use', 'Your share'], path: '/en/form-e2-guide' },
  'en-electricity-tariffs': { kind: 'calc', over: 'Comparison', title: 'Electricity tariffs in Greece, for your usage',
    chips: ['Fixed (blue)', 'Special (green)', 'Variable (yellow)', 'Per month'], path: '/en/electricity-tariffs' },
  'en-tax-deadlines': { kind: 'page', over: 'Deadlines', title: 'Tax deadlines for property owners in Greece',
    chips: ['ENFIA', 'Tax return', 'Short-term rentals', 'Official sources'], path: '/en/tax-deadlines' },
  'en-guide-airbnb-tax': { kind: 'page', over: 'Guide', title: 'Airbnb tax in Greece in 2026',
    chips: ['Climate fee', 'Nov 1 change', 'myAADE return', 'Income tax'], path: '/en/guides/airbnb-tax-greece-2026' },
  'en-guide-str-registry': { kind: 'page', over: 'Guide', title: 'Short-term rental registry (AMA) in Greece',
    chips: ['Athens freeze', 'AMA transfer', 'Safety requirements', 'Fines'], path: '/en/guides/short-term-rental-registry-greece' },
  'en-guide-enfia-payment': { kind: 'page', over: 'Guide', title: 'ENFIA 2026: payment and instalments',
    chips: ['Instalment dates', 'Paying on myAADE', 'ENFIA certificate', 'Finalization'], path: '/en/guides/enfia-payment-instalments-certificate' },
  'en-trust': { kind: 'page', over: 'Trust', title: 'Who we are and where your data goes',
    chips: ['EU servers', 'Providers', 'What we never do', 'Your rights'], path: '/en/trust' },
  'en-guides': { kind: 'page', over: 'Guides', title: 'Greek property tax and costs, in plain English',
    chips: ['Rental income tax', 'ENFIA', 'Net yield', 'Sources'], path: '/en/guides' },
  'en-guide-rental-income-tax': { kind: 'page', over: 'Guide', title: 'Greek rental income tax in 2026',
    chips: ['Brackets', 'Standard deduction', 'Bank rule', 'Examples'], path: '/en/guides/greek-rental-income-tax-2026' },
  'en-guide-enfia': { kind: 'page', over: 'Guide', title: 'How ENFIA is calculated',
    chips: ['Zone price', 'Coefficients', 'Reductions', 'Example'], path: '/en/guides/how-enfia-is-calculated' },
  'en-guide-net-yield': { kind: 'page', over: 'Guide', title: 'Net rental yield in Greece',
    chips: ['Gross vs net', 'Tax bracket', 'ENFIA', 'Payback'], path: '/en/guides/net-rental-yield' },
  'en-tools': { kind: 'calc', over: 'Tools', title: 'Calculators for property owners in Greece',
    chips: enTools().map(t => t.label).slice(0, 4), path: '/en/tools' },
};
