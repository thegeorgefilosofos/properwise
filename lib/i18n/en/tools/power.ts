// ═══════════════════════════════════════════════════════════════════════════
// Η ΣΥΓΚΡΙΣΗ ΤΙΜΟΛΟΓΙΩΝ ΡΕΥΜΑΤΟΣ ΣΤΑ ΑΓΓΛΙΚΑ (app/sygkrisi-timologion-revmatos, /en/electricity-tariffs)
// ─────────────────────────────────────────────────────────────────────────
// Ο ίδιος κατάλογος και ο ίδιος τύπος (lib/tools/revma.ts, lib/energy/*).
// Τα ονόματα των παρόχων και των τιμολογίων είναι εμπορικά ονόματα και
// μένουν όπως τα γράφει ο πάροχος· μεταφράζονται μόνο οι περιγραφές. Ο
// μήνας του καταλόγου («Οκτωβρίου 2026») διαβάζεται από το lib και γράφεται
// στα αγγλικά με τον ίδιο αριθμό μήνα· κανένα δεδομένο δεν ξαναγράφεται.
// ═══════════════════════════════════════════════════════════════════════════
import { fmtFor } from '@/lib/core/format';
import { MONTHS_GEN } from '@/lib/core/months';
import { POWER_COLOURS, type PowerColour, type PowerRow, type Unranked } from '@/lib/tools/revma';
import { CATALOGUE_MONTH_GEN, TARIFFS_VERIFIED } from '@/lib/energy/catalogue';
import { RAAEY_READ_AT } from '@/lib/energy/raaeyCatalogue';
import { fixedBase, fixedTier2 } from '@/lib/energy/fixedCharge';

const f = fmtFor('en');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

/** «Οκτωβρίου 2026» (γενική, όπως στον κατάλογο) → «October 2026». */
const monthEn = (gen: string | null | undefined): string => {
  const s = String(gen ?? '').trim();
  const i = MONTHS_GEN.findIndex(m => s.startsWith(m));
  return i < 0 ? s : `${MONTHS[i]}${s.slice(MONTHS_GEN[i].length)}`;
};
const CATALOGUE_MONTH = monthEn(CATALOGUE_MONTH_GEN);

/** Το χρώμα της ΡΑΑΕΥ ανά τιμή του επιλογέα· ίδια σειρά με το POWER_COLOURS. */
const COLOUR_EN: Record<PowerColour, string> = {
  ola: 'All tariffs', mple: 'Fixed (blue)', prasino: 'Special (green)', kitrino: 'Variable (yellow)', paketo: 'Fixed monthly amount',
};
const badgeOf = (c: PowerColour) => POWER_COLOURS.find(x => x.value === c)?.badge ?? '';
/** Η ετικέτα του χρώματος, από τα ΙΔΙΑ κλειδιά του καταλόγου. */
const BADGE_EN: Record<string, { label: string; meaning: string }> = {
  [badgeOf('mple')]: { label: 'BLUE', meaning: 'Fixed price for the whole contract' },
  [badgeOf('prasino')]: { label: 'GREEN', meaning: 'Special tariff. The price is announced on the 1st of each month' },
  [badgeOf('kitrino')]: { label: 'YELLOW', meaning: 'Variable price. It changes during the contract' },
  [badgeOf('paketo')]: { label: 'FLAT', meaning: 'Fixed amount every month, with an annual kWh allowance' },
  VNM: { label: 'VNM', meaning: 'Virtual net metering, with solar panels' },
};

/** Οι πάροχοι με ελληνικό όνομα, μεταγραμμένοι· οι υπόλοιποι μένουν ως έχουν. */
const PROVIDER_EN: Record<string, string> = {
  dei: 'DEI (PPC)', heron: 'Heron', wattvolt: 'Watt+Volt (now Protergia)', fysiko_aerio: 'Fysiko Aerio Ellados',
};

const UNRANKED_EN: Record<Unranked, string> = {
  retro: 'The final price is announced after the month ends, so it can’t be calculated in advance',
  unknown: `RAAEY has no ${CATALOGUE_MONTH} price yet, or lists it in tiers that aren’t calculated here`,
  'other-month': `The price isn’t for ${CATALOGUE_MONTH}, so it is shown without a rank`,
  conditional: 'It requires taking part in a solar scheme, so it isn’t ranked',
  'no-allowance': 'The package’s kWh allowance isn’t published as a number',
  'over-allowance': 'Your usage exceeds the package allowance and the overage charge isn’t on record',
};

type T = PowerRow['t'];

const fixedEn = (t: T, ebill: boolean): string => {
  const tier = fixedTier2(t, ebill);
  const base = f.fe(fixedBase(t, ebill));
  return tier ? `${base} up to ${f.fn(tier.threshold)} kWh a month, ${f.fe(tier.fixed)} above that` : base;
};

const priceMonthEn = (t: T): string => {
  if (t.raaeyUnknown) return `Price for ${monthEn(t.priceMonth)}. RAAEY has no ${CATALOGUE_MONTH} price yet`;
  if (t.priceMonth) return `Price for ${monthEn(t.priceMonth)}`;
  return t.priceUnsupported ? `${CATALOGUE_MONTH} price in tiers that aren’t calculated here` : `The ${CATALOGUE_MONTH} price isn’t known yet`;
};

/** Τα ίδια γεγονότα με το `facts` του app/sygkrisi-timologion-revmatos/PowerCompare.tsx. */
function factsEn(t: T, ebill: boolean): string[] {
  const out: string[] = [];
  if (t.type === 'fixed_monthly') {
    out.push(t.flat_annual_kwh ? `Package of ${f.fn(t.flat_annual_kwh)} kWh a year` : 'No published kWh limit');
  } else {
    out.push(t.kwh_day == null ? (t.priceUnsupported ? 'Tiered in more than two steps' : 'No known price')
      : t.priceStatus !== 'retro' ? `${f.feRate(t.kwh_day)} per kWh${t.kwh_tier2 != null && t.tier2_threshold != null ? (t.tier2_scope === 'all' ? `, ${f.feRate(t.kwh_tier2)} for all kWh above ${f.fn(t.tier2_threshold)}` : `, ${f.feRate(t.kwh_tier2)} from kWh ${f.fn(t.tier2_threshold + 1)}`) : ''}`
      : t.kwh_day > 0 ? `${f.feRate(t.kwh_day)} base price, settled afterwards`
      : 'The month’s price is announced the following month');
    if (t.kwh_night) out.push(`Night ${f.feRate(t.kwh_night)}`);
    out.push(t.no_fixed ? 'No standing charge' : `Standing charge ${fixedEn(t, ebill)}`);
  }
  out.push(priceMonthEn(t));
  const c = t.conditions;
  if (c && (c.price || c.fixed)) out.push('Discount conditions apply (see the provider)');
  out.push(t.contract_months ? `${t.contract_months}-month contract` : 'No commitment');
  return out;
}

export const POWER_EN = {
  colours: POWER_COLOURS.map(c => ({ value: c.value, label: COLOUR_EN[c.value] })),
  colour: (c: PowerColour) => COLOUR_EN[c],
  badge: (b: string) => BADGE_EN[b]?.label ?? b,
  meaning: (b: string) => BADGE_EN[b]?.meaning ?? '',
  provider: (value: string, label: string) => PROVIDER_EN[value] ?? label,
  unranked: (u: Unranked) => UNRANKED_EN[u],
  facts: factsEn,
  usageMonth: 'Usage per month', usageYear: 'Usage per year', usageHint: 'From your bill, in the kWh for the period.',
  per: 'The figure is', perMonth: 'Per month', perYear: 'Per year', perYearHint: 'Spread evenly over twelve months.',
  night: 'Night usage', nightHint: 'Only with a night meter. Otherwise 0.',
  ebill: 'E-bill', yes: 'Yes', no: 'No', ebillHint: 'On some tariffs, with direct debit, the standing charge is lower.',
  kind: 'Tariff type',
  paper: 'Electricity tariff comparison', pUsage: 'Usage', pNight: 'Night', pEbill: 'E-bill', pKind: 'Type', pChecked: 'Prices checked',
  kwhLine: (m: string, y?: string) => (y ? `${m} kWh a month (${y} a year)` : `${m} kWh a month`),
  updated: `Last updated: ${f.date(RAAEY_READ_AT)}`,
  source: 'Source: the comparison tool of RAAEY (energycost.gr).',
  catalogue: (ranked: boolean) => ` Prices for ${CATALOGUE_MONTH}, unless another month is shown${ranked ? '; only those are ranked.' : '.'}`,
  rankUntil: (d: string) => ` The ranking holds until ${d}; after that, if prices aren’t updated, the table stays indicative.`,
  empty: 'Enter your usage to see what you would pay on each tariff.',
  noneRanked: (kwh: string) => `In this type, no tariff can be ranked for ${kwh}. The reason is shown under each one.`,
  sayNone: 'No tariff of this type can be ranked.',
  cheapest: 'Cheapest per month', perYearShort: 'Per year',
  forUsage: (kwh: string) => ` for ${kwh}. `,
  sayBest: (m: string, name: string, y: string) => `Cheapest per month ${m}, with ${name}. Per year ${y}.`,
  stale: (rankUntil: string) => ({
    lead: `Prices may have changed: they were checked on ${f.date(TARIFFS_VERIFIED)} and RAAEY’s new list is pending.`,
    body: `The ranking held until ${f.date(rankUntil)}. Providers announce new prices every month, so the table stays indicative: alphabetical, with no ranking and no cheapest.`,
  }),
  staleLink: ['Current prices are published by ', 'RAAEY, Greece’s energy regulator, in its official comparison tool', '.'] as const,
  range: (lo: string, hi: string, kwh: string) => ['Indicatively, from ', lo, ' to ', hi, ` a month for ${kwh}.`] as const,
  sayRange: (lead: string, lo?: string, hi?: string) => (lo && hi ? `${lead} Indicatively, unranked: from ${lo} to ${hi} a month.` : `${lead} Indicatively, unranked.`),
  count: (n: number, kwh: string, ranked: boolean) => `${n} tariffs for ${kwh}${ranked ? ', from the cheapest.' : ', alphabetically by provider.'}`,
  noAmount: 'No amount', perYearOf: (y: string) => `${y} a year`, outOfRank: 'Not ranked',
  confirm: 'Before you sign, confirm the price on the provider’s page: ',
  providerTitle: (p: string) => `${p}’s prices, on its own page`,
  showFirst: (n: number) => `Show only the first ${n}`,
  showRest: (n: number) => `Show the other ${n} tariffs`,
  scopeLead: 'What it covers and what it doesn’t.',
  scope: (etmear: string, vat: string) =>
    `The amount is the supplier’s charge (standing charge and energy) plus the ETMEAR renewables levy (${etmear} per kWh), with ${vat} VAT on both. `
    + `For fixed-amount packages it counts the package amount with ${vat} VAT and the overage charge where it is on record. `
    + 'It doesn’t include network charges (HEDNO, IPTO), public service charges, excise duty, municipal fees or the ERT broadcasting fee: '
    + 'they are the same whichever provider you choose, so they don’t change the ranking, but your bill will be higher. '
    + 'Per-kWh prices and standing charges in the rows exclude VAT. Where there is a loyalty discount, the discounted price counts; '
    + 'promotional prices don’t. Dynamic tariffs, student tariffs and tariffs settled twice a year are not compared. It is an ',
  scopeStrong: 'estimate',
  scopeEnd: ' to give you the order of magnitude; before you sign, confirm the price on the provider’s page.',
};

export const POWER_PAGE_EN = {
  title: 'Greek electricity tariffs compared: what you would pay each month',
  h1: 'Electricity tariffs in Greece: what each one would cost you',
  description: 'What you would pay each month on every residential electricity tariff in Greece, with the date prices were checked and the regulator as the source.',
  lede: 'What you would pay per month and per year on every electricity tariff, for your own kWh. Prices come from RAAEY, Greece’s energy regulator, which labels tariffs blue (fixed), green (special, priced monthly) and yellow (variable).',
  ctaTitle: 'With your own bills, not an estimate?',
  ctaBody: 'In PROPERWISE you keep the electricity bills of each property, and the same comparison runs on their actual kWh.',
};

export function powerFaqEn(x: { vat: string; etmear: string; maxAgeDays: number }) {
  return [
    {
      q: 'What do the blue, green and yellow labels mean?',
      a: 'They are RAAEY’s labels for how the price is set. Blue: a fixed price for the whole contract. Green: a special tariff whose price is announced on the 1st of each month. Yellow: a variable price that changes during the contract. The color says nothing about where the energy comes from. Dynamic tariffs, with an hourly price and a smart meter, are not compared, because their price doesn’t follow from a formula.',
    },
    {
      q: 'What does the amount include?',
      a: `The supplier’s charge, meaning the standing charge and energy, plus the ETMEAR renewables levy (${x.etmear} per kWh) and ${x.vat} VAT. It doesn’t include network charges, public service charges, excise duty, municipal fees or the ERT broadcasting fee. Those are the same with every provider, so they don’t change the ranking, but your bill will be higher than the amount shown.`,
    },
    {
      q: 'How current are the prices?',
      a: `Prices were last updated on ${f.date(TARIFFS_VERIFIED)}, from RAAEY’s list on energycost.gr. They are for ${CATALOGUE_MONTH}, unless a tariff shows another month; only ${CATALOGUE_MONTH} prices are ranked. Providers announce new prices every month. Once more than ${x.maxAgeDays} days have passed since the check, the page stops ranking and shows prices as indicative only. Before you sign, confirm the price on the provider’s page.`,
    },
    {
      q: 'Where do I find my usage?',
      a: 'On your electricity bill, in the kWh for the period. If the bill is an estimate, use the settlement bill, which comes from an actual meter reading. If you have the yearly figure, enter it, choose “Per year” and the page spreads it evenly over twelve months.',
    },
  ];
}
