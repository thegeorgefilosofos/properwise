import type { Metadata } from 'next';
import { siteUrl } from '@/lib/core/site';
import { athensParts } from '@/lib/core/time';
import { fmtFor } from '@/lib/core/format';
import {
  ENFIA_ZONE_TAX, ENFIA_FLOOR_COEF, ENFIA_WEALTH_REDUCTION, ENFIA_REDUCTIONS, ENFIA_AGE_BANDS,
  ENFIA_SURCHARGE_THRESHOLD, ENFIA_SURCHARGE_BRACKETS, ENFIA_EXTRA_TAX_FREE, ENFIA_EXTRA_BRACKETS,
  estimateENFIA, zoneKeyFromPricePerSqm, enfiaAgeKeyFromYears, enfiaAgeCoef,
} from '@/lib/billing/enfia';
import { enfiaAgeChoicesEn, ENFIA_FLOOR_EN } from '@/lib/i18n/en/tools/enfia';
import { publicMetadata } from '../../../publicMetadata';
import { shareImage } from '../../../og/share';
import { GuideTable } from '../../../odigos/GuideParts';
import { GuideShellEn, type EnFaq } from '../GuideShellEn';

// Ο οδηγός «Πώς υπολογίζεται ο ΕΝΦΙΑ» στα αγγλικά. Οι πίνακες και το
// παράδειγμα από το lib/billing/enfia.ts (`estimateENFIA`), με το ίδιο ακίνητο
// με τον ελληνικό οδηγό.
const PATH = '/en/guides/how-enfia-is-calculated';
const EL = '/odigos/pos-ypologizetai-o-enfia';
const f = fmtFor('en');
const pct = (n: number) => f.fpRate(n);
const rate = (r: number) => f.fpRate(r * 100);
const reduction = (key: string) => ENFIA_REDUCTIONS.find(r => r.key === key)!;
const INSURANCE = reduction('insurance'), INS_OVER = INSURANCE.pctOver!;
const LOW_INCOME = reduction('low_income'), LARGE_FAMILY = reduction('large_family');
const ZONE_TAXES = Object.values(ENFIA_ZONE_TAX);

const H1 = 'How ENFIA, Greece’s annual property tax, is calculated';
const DESC = 'How ENFIA works: zone price times floor area, age and floor coefficients, the automatic reduction and the exemptions. With a worked example in euros.';

export function generateMetadata(): Metadata {
  return publicMetadata({ title: `${H1} (${athensParts().year})`, description: DESC, url: siteUrl(PATH), type: 'article', image: shareImage('en-guide-enfia') });
}

const zoneRange = (key: string) => {
  const [a, b] = key.split('_');
  if (a === 'over') return `Over ${f.feWhole(Number(b))}`;
  if (a === '0') return `Up to ${f.feWhole(Number(b))}`;
  return `${f.fn(Number(a))} – ${f.feWhole(Number(b))}`;
};
const ZONE = Object.entries(ENFIA_ZONE_TAX).map(([k, tax]) => [zoneRange(k), f.feRate(tax)] as const);
const FLOOR_BANDS: [string, keyof typeof ENFIA_FLOOR_COEF][] = [
  ['Basement', 'basement'], ['Ground and 1st floor', 'ground'], ['2nd and 3rd floor', 'second'],
  ['4th and 5th floor', 'fourth'], ['6th floor and up', 'fifth_plus'],
];
const FLOOR = FLOOR_BANDS.map(([label, key]) => [label, f.fn(ENFIA_FLOOR_COEF[key], 2)] as const);
const WEALTH = ENFIA_WEALTH_REDUCTION.map((w, i) => [
  w.limit === Infinity ? `Over ${f.feWhole(ENFIA_WEALTH_REDUCTION[i - 1].limit)}` : `Up to ${f.feWhole(w.limit)}`, pct(w.pct),
] as const);
const WEALTH_LAST = ENFIA_WEALTH_REDUCTION.filter(w => w.pct > 0).at(-1)!;

// Το ίδιο διαμέρισμα με το παράδειγμα του ελληνικού οδηγού.
const EX = { sqm: 90, price: 2_000, years: 12, floor: 'third' } as const;
const EX_ZONE = zoneKeyFromPricePerSqm(EX.price)!;
const EX_AGE = enfiaAgeKeyFromYears(EX.years)!;
const EX_VALUE = EX.sqm * EX.price;
const EX_RES = estimateENFIA({ sqm: EX.sqm, zone: EX_ZONE, floor: EX.floor, age: EX_AGE, totalValue: EX_VALUE, propertyValue: EX_VALUE })!;

const FAQ: EnFaq[] = [
  {
    q: 'Does ENFIA depend on my income?',
    a: 'Not for the calculation. ENFIA is a tax on ownership: it comes from the property’s features (zone price, floor area, age, floor) and the total value of your real estate, not your income. Income matters only for some reductions and exemptions. You pay it even if the property is empty.',
  },
  {
    q: 'What is the zone price?',
    a: `The objective value per square meter set for the area in AADE’s tables of objective values. It places the property in a band with a base tax per m² from ${f.feRate(Math.min(...ZONE_TAXES))} to ${f.feRate(Math.max(...ZONE_TAXES))}. You find it on the deed, on form E9 (your property register at AADE) or on the map of objective values.`,
  },
  {
    q: 'Do I pay less if my home is insured?',
    a: `Yes, if the home was insured against earthquake, fire and flood for at least three months of the previous year. For a full year, the reduction is ${pct(INSURANCE.pct)} (home value up to ${f.feWhole(INS_OVER.above)}) or ${pct(INS_OVER.pct)} (above). It needs an application on AADE’s myPROPERTY by each year’s deadline.`,
  },
  {
    q: 'Is ENFIA deducted from rental income tax?',
    a: 'No. It is a separate tax and is not deducted from rental income.',
  },
];

export default function Page() {
  const { year } = athensParts();
  const ages = enfiaAgeChoicesEn(year);
  const AGE = ENFIA_AGE_BANDS.flatMap(b => {
    const label = ages.find(a => a.key === b.key)?.label;
    return label ? [[label, f.fn(b.coef, 2)] as const] : [];
  });
  const sections = [
    {
      id: 'main-tax', over: '1. The core', title: 'The main tax on a building',
      body: <>
        <p className="lg-p">The main tax on each building is a product:</p>
        <div className="lg-note lg-note-tip" style={{ marginTop: 12 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Floor area × base zone tax × age coefficient × floor coefficient</strong>
        </div>
        <p className="lg-p" style={{ marginTop: 16 }}>The base zone tax comes from the zone price (objective value per m²) of the area. Legal basis: Article 4 of Law 4223/2013, as in force and codified in the Property Tax Code (Law 5219/2025).</p>
        <GuideTable caption="Base tax per m²" head={['Zone price', '€ per m²']} min="280px" rows={ZONE} />
        <p className="lg-p">The age coefficient counts from the year of the most recent building permit (without a permit, from the year of construction):</p>
        <GuideTable caption="Building age coefficient" head={['Age', 'Coefficient']} min="260px" rows={AGE} />
        <p className="lg-p">And the floor coefficient:</p>
        <GuideTable caption="Floor coefficient" head={['Floor', 'Coefficient']} min="260px" rows={FLOOR} />
      </>,
    },
    {
      id: 'example', over: '2. Example', title: 'One apartment, step by step',
      body: <>
        <p className="lg-p">{`An apartment of ${EX.sqm} m² in an area with a zone price of ${f.feWhole(EX.price)}/m² (base tax ${f.feRate(ENFIA_ZONE_TAX[EX_ZONE])}/m²), ${EX.years} years old (coefficient ${f.fn(enfiaAgeCoef(EX_AGE), 2)}), on the ${ENFIA_FLOOR_EN[EX.floor].toLowerCase()} (coefficient ${f.fn(ENFIA_FLOOR_COEF[EX.floor], 2)}).`}</p>
        <ul className="lg-ul">
          <li><strong style={{ color: 'var(--text-primary)' }}>Main tax:</strong>{` ${EX.sqm} × ${f.fn(ENFIA_ZONE_TAX[EX_ZONE], 2)} × ${f.fn(enfiaAgeCoef(EX_AGE), 2)} × ${f.fn(ENFIA_FLOOR_COEF[EX.floor], 2)} = ${f.fe(EX_RES.basic)}.`}</li>
          <li>{`Objective value about ${EX.sqm} × ${f.fn(EX.price)} = ${f.feWhole(EX_VALUE)}. An owner of this one property has total real estate of the same value, so the automatic reduction is ${pct(EX_RES.reductionPct)}.`}</li>
        </ul>
        <div className="gd-result">
          <span className="gd-result-k">Final ENFIA</span>
          <span className="gd-result-v">{`${f.fe(EX_RES.annual)} a year`}</span>
        </div>
      </>,
    },
    {
      id: 'reduction', over: '3. Automatic', title: 'Automatic reduction by total value',
      body: <>
        <p className="lg-p">{`Every individual whose real estate is worth up to ${f.feWhole(WEALTH_LAST.limit)} in total gets an automatic reduction of the main tax, from ${pct(ENFIA_WEALTH_REDUCTION[0].pct)} down to ${pct(WEALTH_LAST.pct)}, depending on the band of total value.`}</p>
        <GuideTable caption="Automatic reduction of the main tax" head={['Total real estate value', 'Reduction']} min="280px" rows={WEALTH} />
      </>,
    },
    {
      id: 'exemptions', over: '4. With criteria', title: 'Exemptions and special reductions',
      body: <>
        <ul className="lg-ul">
          <li><strong style={{ color: 'var(--text-primary)' }}>Insured home (earthquake, fire, flood):</strong>{` ${pct(INSURANCE.pct)} for a home worth up to ${f.feWhole(INS_OVER.above)} or ${pct(INS_OVER.pct)} above that, on application.`}</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>Low income (main home):</strong>{` ${pct(LOW_INCOME.pct)}, subject to income and property limits.`}</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>Families with three or more children, disability of 80% or more:</strong>{` full exemption (${pct(LARGE_FAMILY.pct)}), subject to income and property limits.`}</li>
        </ul>
        <p className="lg-p">If you think you qualify, check with your accountant before the assessment is issued.</p>
      </>,
    },
    {
      id: 'large', over: '5. Large holdings', title: 'Surcharge and additional tax',
      body: <>
        <p className="lg-p">{`For total real estate worth more than ${f.feWhole(ENFIA_SURCHARGE_THRESHOLD)}, the main tax is increased progressively, from ${pct(ENFIA_SURCHARGE_BRACKETS[0].pct)} to ${pct(ENFIA_SURCHARGE_BRACKETS.at(-1)!.pct)}.`}</p>
        <p className="lg-p">{`In addition, any property worth more than ${f.feWhole(ENFIA_EXTRA_TAX_FREE)} pays an additional tax on the part of its value above ${f.feWhole(ENFIA_EXTRA_TAX_FREE)}, progressively from ${rate(ENFIA_EXTRA_BRACKETS[0].rate)} to ${rate(ENFIA_EXTRA_BRACKETS.at(-1)!.rate)}.`}</p>
      </>,
    },
  ];
  return (
    <GuideShellEn el={EL} path={PATH} h1={H1} description={DESC} about="ENFIA, the Greek unified property tax, and how it is calculated"
      intro={<>
        <p className="lg-p">ENFIA (the Unified Property Ownership Tax) is a tax on ownership: you pay it every year because you own the property, whether you let it or it stands empty. AADE, Greece’s tax authority, calculates it from your property register (form E9).</p>
        <p className="lg-p">This guide shows the formula, the coefficients and a worked example. The full formula also has coefficients for frontage and size, so the result is an estimate.</p>
      </>}
      sections={sections}
      sources={[
        'ENFIA is governed by the Property Tax Code (Law 5219/2025, Government Gazette A 130/18.07.2025), which codified Articles 1 to 8 of Law 4223/2013.',
        'Main tax (zone price, age and floor coefficients): Article 4 of Law 4223/2013, as amended by Law 4916/2022.',
        'Zone prices: AADE tables of objective values.',
        'Automatic reduction by total value and surcharge on large holdings: Articles 7 and 4 of Law 4223/2013, as amended by Law 4916/2022.',
        'Reductions and exemptions with criteria: Article 7 of Law 4223/2013.',
        'Insured home reduction: AADE decision A.1005/2026.',
      ]}
      faq={FAQ} faqTitle="What people ask about ENFIA"
      cta={{ title: 'ENFIA on your own property', href: '/en/enfia-calculator', action: 'Calculate your ENFIA',
        body: 'Enter floor area, zone price, age and floor. The calculation runs on your device.' }} />
  );
}
