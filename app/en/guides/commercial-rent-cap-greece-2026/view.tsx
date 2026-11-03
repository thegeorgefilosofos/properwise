import type { Metadata } from 'next';
import Link from 'next/link';
import { siteUrl, PRODUCT_NAME } from '@/lib/core/site';
import { fmtFor } from '@/lib/core/format';
import { COMMERCIAL_RENT_CAP_2026 as CAP, computeRentAdjustment } from '@/lib/documents/rentAdjustment';
import { COMMERCIAL_STAMP_DUTY } from '@/lib/billing/commercialLease';
import { RENT_ADJUSTMENT_SHARE } from '@/lib/market/cpi';
import { longDateEn } from '@/lib/i18n/en/dates';
import { publicMetadata } from '../../../publicMetadata';
import { shareImage } from '../../../og/share';
import { GuideShellEn, type EnFaq } from '../GuideShellEn';

// ═══════════════════════════════════════════════════════════════════════════
// Ο οδηγός «Πλαφόν στις επαγγελματικές μισθώσεις 2026» στα αγγλικά
// ─────────────────────────────────────────────────────────────────────────
// Το όριο, η περίοδος και το έτος βάσης από το `COMMERCIAL_RENT_CAP_2026`, το
// παράδειγμα από την `computeRentAdjustment`, το τέλος από το
// `COMMERCIAL_STAMP_DUTY` και το μερίδιο του ΔΤΚ από το `RENT_ADJUSTMENT_SHARE`
// (ο ελληνικός οδηγός το γράφει με το χέρι). Οι αριθμοί νόμων, το ΠΔ 34/1995,
// τα 15.000 τ.μ. του εμπορικού κέντρου και το 100% του Δημοσίου είναι γραμμένα
// με το χέρι στον ελληνικό οδηγό, χωρίς σταθερά· εδώ τον ακολουθούν.
// ═══════════════════════════════════════════════════════════════════════════
const PATH = '/en/guides/commercial-rent-cap-greece-2026';
const EL = '/odigos/plafon-3-emporikes-misthoseis-2026';
const f = fmtFor('en');

const CAP_PCT = f.fpRate(CAP.pct);
const FROM = longDateEn(CAP.from);
const TO = longDateEn(CAP.to);
const YEAR = Number(CAP.from.slice(0, 4));
const BASE_YEAR = YEAR - 1;
const CAP_FACTOR = f.fn(1 + CAP.pct / 100, 2);
const STAMP = f.fpRate(COMMERCIAL_STAMP_DUTY * 100);
const CPI_SHARE = f.fpRate(RENT_ADJUSTMENT_SHARE * 100);
const EX = { rent: 1_500, clause: 5, low: 2 } as const;
const R = computeRentAdjustment({ currentRent: EX.rent, method: 'percent', percent: EX.clause, capPct: CAP.pct });
const R_LOW = computeRentAdjustment({ currentRent: EX.rent, method: 'percent', percent: EX.low, capPct: CAP.pct });
const DIFF = R.uncappedRent - R.newRent;
const stamp = (rent: number) => f.fe(rent * COMMERCIAL_STAMP_DUTY);

const H1 = `Greece’s ${CAP_PCT} cap on commercial rent increases in ${YEAR}: who it covers`;
const DESC = `In ${YEAR}, rent increases on existing commercial leases in Greece stop at ${CAP_PCT} of the ${BASE_YEAR} rent. Who it covers and who it doesn’t, with an example.`;

export function generateMetadata(): Metadata {
  return publicMetadata({ title: H1, description: DESC, url: siteUrl(PATH), type: 'article', image: shareImage('en-guide-rent-cap') });
}

const EXEMPT = [
  'Real estate investment companies (REICs) and companies majority-owned by alternative investment funds (AIFs).',
  'Operators of shopping centers with at least 15,000 m² of floor space.',
  'Companies wholly owned by the Greek state.',
];

const FAQ: EnFaq[] = [
  {
    q: 'Does it apply to residential leases?',
    a: `No. The cap applies only to existing commercial leases under Presidential Decree 34/1995. In ${YEAR} there is no general state cap on residential rents; there, an increase needs an explicit rent review clause in the lease or a new agreement the tenant accepts.`,
  },
  {
    q: `What if my lease says ${f.fpRate(EX.clause)}?`,
    a: `In ${YEAR} the increase cannot exceed ${CAP_PCT} of the ${BASE_YEAR} rent. With rent of ${f.feWhole(EX.rent)}, the new rent goes up to ${f.feWhole(R.newRent)}, not ${f.feWhole(R.uncappedRent)}. If the clause gives less than ${CAP_PCT}, the clause applies.`,
  },
  {
    q: `Does it apply to a lease I sign in ${YEAR}?`,
    a: `No. On a new lease signed in ${YEAR}, the rent is set freely.`,
  },
  {
    q: 'Which landlords are exempt?',
    a: `${EXEMPT.join(' ')} If you’re not sure whether you fall into one of these, check with a lawyer or an accountant.`,
  },
  {
    q: `What happens in ${YEAR + 1}?`,
    a: `The rule sets the cap only for ${FROM} to ${TO}. For the ${YEAR + 1} increase, check with a lawyer or an accountant what will apply then.`,
  },
];

const LINK = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } as const;
const STRONG = { color: 'var(--text-primary)' } as const;

export default function Page() {
  const sections = [
    {
      id: 'the-cap', over: '1. The rule', title: 'What the cap sets',
      body: <>
        <p className="lg-p">{`On existing commercial leases under Presidential Decree 34/1995, a rent increase from ${FROM} to ${TO} may not exceed ${CAP_PCT} of the ${BASE_YEAR} rent. The cap applies even if market rents rose further. The legal basis is Article 59 of Law 5255/2025 and Article 96 of Law 5007/2022.`}</p>
        <p className="lg-p">{`${CAP_PCT} is a ceiling, not a required increase. If the clause in the lease gives a smaller increase, the clause applies.`}</p>
      </>,
    },
    {
      id: 'which-leases', over: '2. Scope', title: 'Which leases it covers',
      body: <>
        <p className="lg-p">The cap applies when all three are true:</p>
        <ul className="lg-ul">
          <li>The lease is commercial or professional and governed by Presidential Decree 34/1995.</li>
          <li>{`The lease already exists, meaning it wasn’t signed in ${YEAR}.`}</li>
          <li>{`The increase takes effect between ${FROM} and ${TO}.`}</li>
        </ul>
        <p className="lg-p">{`The calculation starts from the ${BASE_YEAR} rent, not the rent in the original lease. The same goes for a clause linked to the consumer price index: if the change the lease calls for exceeds ${CAP_PCT}, the increase stops at ${CAP_PCT}.`}</p>
      </>,
    },
    {
      id: 'outside', over: '3. Outside the cap', title: 'Homes and new leases',
      body: <>
        <p className="lg-p">{`The cap doesn’t apply to residential leases. In ${YEAR} there is no general state cap on residential rents. There, rent goes up only through an explicit rent review clause in the lease or a new agreement the tenant accepts.`}</p>
        <p className="lg-p">{`Nor does it apply to a new commercial lease you sign in ${YEAR}. There, the rent is set freely.`}</p>
      </>,
    },
    {
      id: 'exemptions', over: '4. Exemptions', title: 'Which landlords are exempt',
      body: <>
        <p className="lg-p">Three kinds of landlord are not bound by the cap:</p>
        <ul className="lg-ul">{EXEMPT.map(x => <li key={x}>{x}</li>)}</ul>
        <p className="lg-p">{`If you’re not sure whether you fall into one of these, check with a lawyer or an accountant before you apply an increase above ${CAP_PCT}.`}</p>
      </>,
    },
    {
      id: 'example', over: '5. Example', title: `A ${f.fpRate(EX.clause)} clause, a ${CAP_PCT} cap`,
      body: <>
        <p className="lg-p">{`A commercial lease with rent of ${f.feWhole(EX.rent)} a month in ${BASE_YEAR}. The lease provides for a ${f.fpRate(EX.clause)} increase each year.`}</p>
        <ul className="lg-ul">
          <li><strong style={STRONG}>Under the lease clause:</strong>{` ${f.feWhole(EX.rent)} × ${f.fpRate(EX.clause)} = ${f.feWhole(R.uncappedRent - EX.rent)}, so ${f.feWhole(R.uncappedRent)}.`}</li>
          <li><strong style={STRONG}>{`With the cap: ${f.feWhole(EX.rent)} × ${CAP_PCT} = ${f.feWhole(R.increase)}, so up to ${f.feWhole(R.newRent)}.`}</strong></li>
          <li><strong style={STRONG}>Difference:</strong>{` ${f.feWhole(R.uncappedRent)} − ${f.feWhole(R.newRent)} = ${f.feWhole(DIFF)} a month, or ${f.feWhole(DIFF * 12)} over twelve months.`}</li>
        </ul>
        <div className="lg-note lg-note-tip" style={{ marginTop: 16 }}>{`If the clause gave ${f.fpRate(EX.low)}, the new rent would be ${f.feWhole(EX.rent)} × ${f.fn(1 + EX.low / 100, 2)} = ${f.feWhole(R_LOW.newRent)}. That is below the ${f.feWhole(R.newRent)} cap, so the clause applies unchanged.`}</div>
      </>,
    },
    {
      id: 'in-practice', over: '6. In practice', title: 'What the landlord does',
      body: <>
        <ul className="lg-ul">
          <li>Read the rent review clause: a percentage or an index, and the month it applies.</li>
          <li>{`Work out the rent under the clause and compare it with the ${BASE_YEAR} rent × ${CAP_FACTOR}. Keep the lower of the two.`}</li>
          <li>The <Link href="/en/rent-increase-calculator" className="lp-link" style={LINK}>rent increase calculator</Link>{` does the comparison for you and shows the rent year by year, with the cap in ${YEAR}.`}</li>
          <li>{`Charge the right amount. The Digital Transaction Duty of ${STAMP} is worked out on the rent: on ${f.feWhole(R.newRent)} it is ${stamp(R.newRent)} a month, instead of ${stamp(R.uncappedRent)} on ${f.feWhole(R.uncappedRent)}. It isn’t owed if the lease has lawfully opted into VAT.`}</li>
          <li>If the clause is worded unclearly or you are considering an exemption, check with a lawyer or an accountant before you send the notice to the tenant.</li>
        </ul>
      </>,
    },
  ];
  return (
    <GuideShellEn el={EL} path={PATH} h1={H1} description={DESC} about={`The ${CAP_PCT} cap on rent increases for existing commercial leases in Greece in ${YEAR}`}
      intro={<>
        <p className="lg-p">{`If you let commercial property on a lease that is already running, a rent increase in ${YEAR} has a ceiling: ${CAP_PCT} of the ${BASE_YEAR} rent. The cap applies from ${FROM} to ${TO}, even if the clause in the lease gives a higher percentage.`}</p>
        <p className="lg-p">This guide shows which leases the cap covers, which it leaves out, which landlords are exempt and how much the rent changes in a worked example.</p>
      </>}
      sections={sections}
      sources={[
        `Cap of ${CAP_PCT} on the ${BASE_YEAR} rent for increases on existing commercial leases (Presidential Decree 34/1995), from ${FROM} to ${TO} · Article 59 of Law 5255/2025 · Article 96 of Law 5007/2022.`,
        `Outside the cap: residential leases, new leases signed in ${YEAR} and landlords that are real estate investment companies, companies majority-owned by alternative investment funds, shopping center operators of at least 15,000 m² or companies wholly owned by the state (same provisions).`,
        `Digital Transaction Duty of ${STAMP} on the rent of a commercial lease, replacing stamp duty at the same rate · Article 6 of Law 5177/2025.`,
        `Rent increases linked to the consumer price index: the twelve-month change or ${CPI_SHARE} of it, as the lease specifies (ELSTAT monthly release).`,
      ]}
      faq={FAQ} faqTitle="What people ask about the cap"
      cta={{ title: 'The capped rent, net', href: '/en/rental-yield-calculator', action: 'See what you keep',
        body: `In the rental yield calculator you enter the new rent and see what is left after tax, ENFIA and costs. The ${PRODUCT_NAME} dashboard works it out the same way.` }} />
  );
}
