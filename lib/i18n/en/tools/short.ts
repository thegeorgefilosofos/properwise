// ═══════════════════════════════════════════════════════════════════════════
// ΒΡΑΧΥΧΡΟΝΙΑ Ή ΜΑΚΡΟΧΡΟΝΙΑ ΣΤΑ ΑΓΓΛΙΚΑ (/en/short-term-vs-long-term-rental)
// ─────────────────────────────────────────────────────────────────────────
// Ο ίδιος υπολογισμός (lib/tools/shortVsLong.ts)· εδώ μόνο λέξεις. Ο αριθμός
// ακινήτων, η τεκμαρτή έκπτωση και το τέλος παρεπιδημούντων έρχονται από τις
// σταθερές του lib/billing. Οσα η ελληνική σελίδα γράφει με το χέρι (ΦΠΑ, όριο
// τετραγωνικών) εδώ λέγονται χωρίς αριθμό.
// ═══════════════════════════════════════════════════════════════════════════
import { STR_INDIVIDUAL_MAX_PROPERTIES, MUNICIPAL_ACCOM_TAX_RATE, CLIMATE_LEVY_FROM_2025 } from '@/lib/billing/greekTax';
import { PRESUMPTIVE_DEDUCTION_RATE } from '@/lib/billing/presumptive';
import { fmtFor } from '@/lib/core/format';

const f = fmtFor('en');
const WORD = ['zero', 'one', 'two', 'three', 'four', 'five'];
const word = (n: number) => WORD[n] ?? f.fn(n);

export const SHORT_EN = {
  rent: 'Monthly rent', night: 'Nightly rate', occ: 'Occupancy', fee: 'Platform fee',
  cleaning: 'Cleaning', perNight: '€/night', fixed: 'Fixed costs', perMonth: '€/month', sqm: 'Floor area', sqmUnit: 'm²',
  type: 'Property type', types: { flat: 'Apartment', house: 'Detached house' } as Record<string, string>,
  season: 'When it fills', even: 'All year', high: 'Mostly in summer',
  seasonHigh: (nights: number, levy: string) =>
    `Bookings fall first in the seven months of the high season, up to ${nights} nights, when the fee is ${levy} per night. This changes what guests pay, not what you keep.`,
  seasonEven: (high: string, low: string) =>
    `Bookings are spread evenly across the twelve months. The fee is ${high} per night from April to October and ${low} in the other months.`,
  hint: 'The nightly rate is your own, without the climate crisis resilience fee that guests pay and you pass on to the state. Use the average you achieve over the year, not the peak rate. Fixed costs are electricity, water and internet, which a long-term tenant pays.',
  clampOcc: 'Occupancy goes up to 100%; calculated with 100%.',
  clampFee: 'The platform fee goes up to 100%; calculated with 100%.',
  paper: 'Short-term vs long-term rental',
  pNight: 'Nightly rate', pProperty: 'Property', pCleaning: (x: string) => `${x} per night, on average`,
  pFixed: (x: string) => `${x} per month`,
  gapEven: 'Difference per year',
  gapFor: (short: boolean) => `In favor of ${short ? 'short-term' : 'long-term'}, per year`,
  longNet: 'Long-term, net', shortNet: 'Short-term, net',
  sayEven: 'Both options leave you with essentially the same.',
  say: (short: boolean, gap: string, long: string, shortNet: string) =>
    `${short ? 'Short-term' : 'Long-term'} leaves you ${gap} more per year. Long-term ${long}, short-term ${shortNet} net.`,
  breakEven: 'Break-even occupancy',
  never: 'With these figures, short-term does not catch up with long-term even at full occupancy.',
  first: 'Short-term comes out ahead from the very first booking.',
  from: ['From ', ' occupancy and up, short-term leaves you more, which means from ', ' nights a year.'] as const,
  money: 'Where the money goes, per year',
  category: 'Category', long: 'Long-term', longShort: 'Long', short: 'Short-term', shortShort: 'Short',
  lines: {
    gross: 'Takings', levy: 'Resilience fee', tax: 'Income tax', platform: 'Platform fee',
    running: 'Cleaning and fixed costs', net: 'Net',
  },
  na: 'n/a',
  moneyNote: 'For short-term, takings include the resilience fee that guests pay and you pass on, which is why it is deducted on the next line.',
  miss: 'If occupancy falls short',
  colOcc: 'Occupancy', colNet: 'Net', colNetSr: ' short-term', colDiff: 'Difference', colDiffSr: ' versus long-term',
  yours: 'yours', nights: (n: string) => `${n} nights`,
  notLead: 'What it assumes and what it doesn’t.',
  not: (firstLevyYear: number, flatHigh: string, flatLow: string, houseHigh: string, houseLow: string) =>
    `It assumes an individual with up to ${word(STR_INDIVIDUAL_MAX_PROPERTIES)} properties who provides no services beyond bed linen: a ${f.fpRate(PRESUMPTIVE_DEDUCTION_RATE * 100)} standard deduction and no municipal accommodation tax. `
    + `From ${word(STR_INDIVIDUAL_MAX_PROPERTIES + 1)} properties and up, the activity becomes a business: different brackets, no deduction, plus the ${f.fpRate(MUNICIPAL_ACCOM_TAX_RATE * 100)} municipal accommodation tax, VAT and business bookkeeping. `
    + `The climate crisis resilience fee uses the amounts in force from ${firstLevyYear}: ${flatHigh} and ${flatLow} per night for apartments, ${houseHigh} and ${houseLow} for large detached houses, with the high season from April to October (Law 5162/2024). `
    + 'Not included: ENFIA, insurance, furniture and equipment, gaps for renovation, your own time.',
  amaOver: 'Before you decide',
  amaTitle: 'Short-term rentals: AMA “red zones” and non-transferable registration',
  amaBody: 'New registrations in the short-term rental property registry (AMA, the registration number every short-term rental in Greece needs) are suspended in central Athens and in central Thessaloniki for a set period. The AMA number does not transfer: on a sale or gift the property is removed from the registry, and the new owner cannot register again inside a suspended zone. Inheritance is not affected. Check the zone before you invest.',
  amaSource: 'Source (Greek)',
};

export const SHORT_PAGE_EN = {
  title: 'Short-term vs long-term rental in Greece: which pays more',
  h1: 'Short-term or long-term rental: which leaves you more in Greece',
  description: 'Compare an Airbnb-style short-term let with a long-term lease in Greece, after income tax, the climate resilience fee, platform fees and running costs.',
  lede: 'What each option leaves you with after Greek tax, the climate crisis resilience fee, the platform fee and running costs, and the occupancy at which short-term starts to pay.',
  ctaTitle: 'Whichever you choose, the costs need keeping in order.',
  ctaBody: 'PROPERWISE keeps rents, bills and expenses per property and prepares the figures for form E2 (the Greek schedule of property income) for your accountant.',
};

export function shortFaqEn() {
  const x = {
    deduction: f.fpRate(PRESUMPTIVE_DEDUCTION_RATE * 100),
    levyHigh: f.feWhole(CLIMATE_LEVY_FROM_2025.small.high), levyLow: f.feWhole(CLIMATE_LEVY_FROM_2025.small.low),
  };
  return [
    {
      q: 'How is short-term rental income taxed in Greece?',
      a: `For an individual with up to ${word(STR_INDIVIDUAL_MAX_PROPERTIES)} properties and no services beyond bed linen, the same way as long-term rent: the rental income brackets of Law 5246/2025 with the ${x.deduction} standard deduction. From ${word(STR_INDIVIDUAL_MAX_PROPERTIES + 1)} properties, it is a business.`,
    },
    {
      q: 'What is the climate crisis resilience fee?',
      a: `A fee per night that guests pay and you pass on to the state. For apartments it is ${x.levyHigh} per night from April to October and ${x.levyLow} in the other months; larger detached houses pay more.`,
    },
    {
      q: 'What is break-even occupancy?',
      a: 'The share of nights a year the property must be booked for short-term to leave you as much as a long-term lease, after all costs. Below it, a long-term lease leaves more.',
    },
    {
      q: 'Do I need a registration number?',
      a: 'Yes. Every short-term rental in Greece needs an AMA number from the AADE registry, and new registrations are suspended in some central zones of Athens and Thessaloniki.',
    },
  ];
}
