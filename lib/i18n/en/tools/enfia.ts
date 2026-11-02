// ═══════════════════════════════════════════════════════════════════════════
// Ο ΥΠΟΛΟΓΙΣΤΗΣ ΕΝΦΙΑ ΣΤΑ ΑΓΓΛΙΚΑ (app/ypologismos-enfia, /en/enfia-calculator)
// ─────────────────────────────────────────────────────────────────────────
// Ο ίδιος υπολογισμός (lib/billing/enfia.ts, lib/tools/*)· εδώ μόνο λέξεις.
// Οι ετικέτες ορόφου και παλαιότητας βγαίνουν από τα ΙΔΙΑ κλειδιά και τα ΙΔΙΑ
// όρια ετών του νόμου, ώστε κάθε επιλογή να σημαίνει ακριβώς ό,τι η ελληνική.
// ═══════════════════════════════════════════════════════════════════════════
import { ENFIA_AGE_BANDS, ENFIA_PRE_YEAR, ENFIA_CENTURY_YEARS, ENFIA_REDUCTIONS, enfiaOldBuildingYears, enfiaReductionInForce, enfiaReductionRate, type ENFIA_FLOOR_COEF } from '@/lib/billing/enfia';
import { fmtFor } from '@/lib/core/format';

type FloorKey = keyof typeof ENFIA_FLOOR_COEF;

export const ENFIA_FLOOR_EN: Record<FloorKey, string> = {
  basement: 'Basement',
  ground: 'Ground floor',
  first: '1st floor',
  second: '2nd floor',
  third: '3rd floor',
  fourth: '4th or 5th floor',
  fifth_plus: '6th floor or higher',
};

/** Η σύντομη ετικέτα δίπλα στο κλειδί «Floor» του χαρτιού (#398): «Floor 3rd», όχι «Floor 3rd floor». */
export const ENFIA_FLOOR_SHORT_EN: Record<FloorKey, string> = {
  basement: 'Basement',
  ground: 'Ground',
  first: '1st',
  second: '2nd',
  third: '3rd',
  fourth: '4th or 5th',
  fifth_plus: '6th or higher',
};

/** Οι ζώνες παλαιότητας στα αγγλικά, από τα ίδια όρια του ENFIA_AGE_BANDS. */
export function enfiaAgeChoicesEn(taxYear: number): { key: string; label: string }[] {
  const yrs = enfiaOldBuildingYears(taxYear);
  const out: { key: string; label: string }[] = [];
  let prev = -1;
  for (const b of ENFIA_AGE_BANDS) {
    let label: string;
    if (b.key === 'pre1930') {
      const p = yrs.pre1930;
      if (!p) continue;
      label = `Built before ${ENFIA_PRE_YEAR} (${p.from === p.to ? p.to : `${p.from} to ${p.to}`})`;
    } else if (b.key === 'over100') {
      label = `Over ${ENFIA_CENTURY_YEARS} years old (up to ${yrs.over100.to})`;
    } else if (b.maxYears === Infinity) {
      label = `${prev + 1} years or more`;
    } else if (prev < 0) {
      label = `Up to ${b.maxYears} years`;
    } else {
      label = `${prev + 1}–${b.maxYears} years`;
    }
    if (typeof b.maxYears === 'number' && Number.isFinite(b.maxYears)) prev = b.maxYears;
    out.push({ key: b.key, label });
  }
  return out;
}

export const ENFIA_EN = {
  eyebrow: 'Calculator',
  sqm: 'Floor area', sqmUnit: 'm²',
  zone: 'Zone price', zoneUnit: '€/m²',
  zoneHint: ['On the deed, on form E9 or on the ', 'map of objective values', '.'] as const,
  floor: 'Floor',
  age: 'Building age',
  ageHint: `Years count from the most recent building permit (without a permit, from construction); “before ${ENFIA_PRE_YEAR}” depends on the year the building was erected.`,
  share: 'Ownership share', shareHint: 'If the property is co-owned.',
  aux: 'Ancillary spaces', auxHint: 'Storage room or parking space. Optional.',
  clamp: (pct: string) => `The ownership share is between 1% and 100%; calculated with ${pct}.`,
  paper: (year: number) => `ENFIA estimate ${year}`,
  empty: 'Enter the floor area and zone price to see the estimate.',
  annual: 'ENFIA per year',
  perMonth: 'Per month',
  perInstalment: (n: number) => `Per instalment, ${n} instalments`,
  sayMonthly: (a: string, m: string) => `ENFIA ${a} a year, ${m} a month.`,
  sayInstalments: (a: string, n: number, i: string) => `ENFIA ${a} a year, in ${n} instalments of ${i}.`,
  sayOnce: (a: string) => `ENFIA ${a} a year, paid at once.`,
  value: 'Objective value of the property (estimate)',
  yourShare: (pct: string) => `Your share (${pct})`,
  zoneTax: 'Base zone tax',
  floorCoef: 'Floor coefficient',
  ageCoef: 'Age coefficient',
  basic: 'Main building tax',
  auxRow: (c: string) => `Ancillary spaces (coefficient ${c}, no floor coefficient)`,
  extra: (t: string) => `Additional tax (value above ${t})`,
  surcharge: (t: string) => `Surcharge (property above ${t})`,
  reduction: (pct: string, b: string | null) => `Automatic reduction ${pct}${b ? ` (property up to ${b})` : ''}`,
  notIncludedLead: 'What it doesn’t include.',
  notIncluded: (relief: string | null) =>
    `The estimate covers one building and assumes your total real estate equals that building. If you own other properties, plots or storage units, the reduction and the surcharge change, so the amount on your assessment will differ. It does not include the legal reductions and exemptions that depend on criteria (low income, families with three or more children, disability), the reduction for an insured home${relief ? `, ${relief}` : ''}, or the special coefficients for plots and frontage. If you think you qualify for a reduction or exemption, check with your accountant.`,
  estimate: 'It is an estimate to give you the order of magnitude, not tax advice.',
  caption: (n: number, year: number) => n === 1 ? `The ${year} instalment` : `The ${n} instalments of ${year}`,
  upcoming: 'Upcoming instalments',
  colNo: 'Instalment', colDue: 'Due', colAmount: 'Amount',
  next: 'next', past: 'past due',
  onlyNext: 'Upcoming only', all: (n: number) => `All ${n} instalments`,
  schedule: (max: number, min: string, year: number, confirmed: boolean) =>
    `ENFIA is paid at once or in up to ${max} monthly instalments, the last one at the latest in February of the following year, as the law provides. Each instalment must be at least ${min}, so for a small amount there are fewer instalments. The exact dates are on the assessment; ${confirmed ? `for ${year} they are those in the table, the last working day of each month.` : `for ${year} they have not been announced, and the table shows the last working day of each month, as in recent years.`} The last instalment takes the rounding difference, so the instalments add up exactly to the annual amount.`,
};

/** Η μείωση των μικρών οικισμών (lib/tools/enfiaRelief.ts), στα αγγλικά. Ιδια πηγή, ίδιοι αριθμοί. */
export function smallSettlementReliefEn(year: number): string | null {
  const rd = ENFIA_REDUCTIONS.find(r => r.key === 'small_settlement_2026');
  if (!rd || !enfiaReductionInForce('small_settlement_2026', year)) return null;
  const num = fmtFor('en');
  const rate = enfiaReductionRate('small_settlement_2026', year);
  const pop = rd.population ? ` of up to ${num.fn(rd.population.base)} residents (up to ${num.fn(rd.population.border)} in border areas)` : '';
  const cap = rd.maxHomeValue != null ? ` worth up to ${num.feWhole(rd.maxHomeValue)}` : '';
  const what = rate >= 100 ? 'the full exemption' : `the ${num.fn(rate)}% reduction`;
  return `${what} for ${year} on a main home${cap} in a settlement${pop}, outside the Attica Region (except the Islands regional unit)`;
}

// ── Η σελίδα (app/en/enfia-calculator) ─────────────────────────────────────
export const ENFIA_PAGE_EN = {
  title: (year: number) => `ENFIA calculator ${year}: Greek property tax for your property`,
  h1: (year: number) => `ENFIA ${year}: estimate the Greek property tax on your property`,
  description: 'Estimate ENFIA, Greece’s annual property tax, from your property’s floor area, zone price, floor and age. No sign-up.',
  lede: 'ENFIA is Greece’s annual tax on real estate. It depends on the floor area, the zone price, the floor and the age of the building.',
  ctaTitle: 'Own more than one property?',
  ctaBody: 'PROPERWISE estimates ENFIA for all your properties together, with the reduction that matches your total real estate, and reminds you of every instalment before it falls due.',
  official: ['The official amount is on the AADE assessment. On ', ', with your TAXISnet credentials: '] as const,
};

export function enfiaFaqEn(year: number, f: {
  surcharge: string; ageNew: { max: number; coef: string }; age26: { from: number; coef: string };
  pre: { year: number; coef: string }; over: { years: number; coef: string; to: number };
  lowIncome: string; insurance: string; insuranceOver: { pct: string; above: string }; small: string | null;
}) {
  return [
    {
      q: 'How is ENFIA calculated?',
      a: 'The main building tax is the floor area times the base tax of the zone, times the floor coefficient, times the age coefficient, times your ownership share. On top of that come the automatic reduction, which depends on the total value of your real estate, and the surcharge, if that value exceeds '
        + `${f.surcharge}.`,
    },
    {
      q: 'Where do I find the zone price?',
      a: 'On the property deed, on form E9 (the Greek register of your real estate) or on the AADE map of objective values. It is the price in euros per square meter set for the property’s area.',
    },
    {
      q: 'Why do newer buildings pay more?',
      a: `The age coefficient falls as the years pass: a building up to ${f.ageNew.max} years old has a coefficient of ${f.ageNew.coef}, while one ${f.age26.from} years or older has ${f.age26.coef}. `
        + `For old buildings the law has two more: ${f.pre.coef} for those erected before ${f.pre.year} and ${f.over.coef} for those over ${f.over.years} years old. `
        + `Years count from the most recent building permit or, without a permit, from the year of construction (for ENFIA ${year}, over ${f.over.years} years means up to ${f.over.to}). `
        + `“Before ${f.pre.year}” depends on the year the building was erected, even if there is a newer permit.`,
    },
    {
      q: 'Are there exemptions?',
      a: `Yes, with criteria: a ${f.lowIncome} reduction for low income on a main home; a full exemption for families with three or more children, large families and people with a disability of 80% or more, subject to income and property limits; `
        + `a ${f.insurance} reduction for an insured home (${f.insuranceOver.pct} for a value above ${f.insuranceOver.above}). `
        + (f.small ? `${f.small.charAt(0).toUpperCase()}${f.small.slice(1)} also applies. ` : '')
        + 'The calculator does not apply them, because they depend on details you do not give it. If you think you qualify for any of these legal reductions or exemptions, check with your accountant.',
    },
    {
      q: 'Is this exactly what I will pay?',
      a: 'No. It is an estimate for one building and assumes your total real estate is only that building. If you own other properties, plots or storage units, both the reduction and the surcharge change. The official amount comes from the AADE assessment.',
    },
  ];
}
