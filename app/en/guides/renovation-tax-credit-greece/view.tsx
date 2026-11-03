import type { Metadata } from 'next';
import Link from 'next/link';
import { siteUrl, PRODUCT_NAME } from '@/lib/core/site';
import { fmtFor } from '@/lib/core/format';
import { REGULATORY_UPDATES_2026 } from '@/lib/accounting/updates2026';
import {
  ANAK_KYA, ANAK_KYA_AMEND, ANAK_KYA_AMEND2, ANAK_PCT_I, ANAK_PCT_II, ANAK_PCT_I_MAX, ANAK_PCT_II_MAX,
  ANAK_PER_SQM, ANAK_CAP, ANAK_OTHER_COSTS, ANAK_MAX_SQM, ANAK_MAX_SQM_LARGE_FAMILY, ANAK_PERMIT_BY,
  ANAK_ENERGY_CLASS, ANAK_YEARS, ANAK_ELIGIBILITY_OPEN_TO, ANAK_ELIGIBILITY_CLOSED_TO,
} from '@/lib/accounting/anakainisi2026';
import {
  renovationCredit, RENO_39B_CAP, RENO_39B_YEARS, RENO_39B_PER_YEAR, RENO_39B_FROM, RENO_39B_TO,
  RENO_39B_LAW, RENO_39B_KYA, RENO_39B_OLD_RATE, RENO_39B_MATERIALS_SHARE,
} from '@/lib/accounting/renovation39b';
import { longDateEn, isoOfDmy } from '@/lib/i18n/en/dates';
import { countEn, firstArticleEn, greekLetterEn, kyaWithGazetteEn, lawsIn } from '@/lib/i18n/en/guides/cite';
import { publicMetadata } from '../../../publicMetadata';
import { shareImage } from '../../../og/share';
import { GuideShellEn, type EnFaq } from '../GuideShellEn';

// ═══════════════════════════════════════════════════════════════════════════
// Ο οδηγός «Έκπτωση φόρου για ανακαίνιση» στα αγγλικά
// ─────────────────────────────────────────────────────────────────────────
// Ο ίδιος κανόνας με τον ελληνικό: όριο, έτη, μερίδιο υλικών, παράθυρο
// δαπανών και παλιός συντελεστής από το lib/accounting/renovation39b.ts, τα
// παραδείγματα από τη `renovationCredit`. Το «Ανακαινίζω 2026» από το
// lib/accounting/anakainisi2026.ts: εκεί οι προτάσεις είναι ελληνικές, οπότε
// εδώ ξαναγράφονται στα αγγλικά από τις ΙΔΙΕΣ σταθερές. Τα έτη 2024 και 2025
// της «κλειστής κατοικίας» είναι γραμμένα μέσα στο ελληνικό ANAK_SCOPE_TEXT,
// όχι σε σταθερά: εδώ ακολουθούν το ίδιο κείμενο.
// ═══════════════════════════════════════════════════════════════════════════
const PATH = '/en/guides/renovation-tax-credit-greece';
const EL = '/odigos/ekptosi-forou-anakainisis';
const f = fmtFor('en');

const ANAKAINIZO_HREF = REGULATORY_UPDATES_2026.find(u => u.id === 'anakainizo-2026')?.sourceHref;
if (!ANAKAINIZO_HREF) throw new Error('Missing the source link of the anakainizo-2026 entry in lib/accounting/updates2026.ts');

const CAP = f.feWhole(RENO_39B_CAP);
const PER_YEAR = f.feWhole(RENO_39B_PER_YEAR);
const YEARS = countEn(RENO_39B_YEARS);
const FROM = longDateEn(isoOfDmy(RENO_39B_FROM));
const TO = longDateEn(isoOfDmy(RENO_39B_TO));
const MAT_DIV = f.fn(1 / RENO_39B_MATERIALS_SHARE);
const SHARE = `${f.fn(1)}/${MAT_DIV}`;
const OLD_PCT = f.fpRate(RENO_39B_OLD_RATE * 100);
const OLD_TIMES = f.fn(1 / RENO_39B_OLD_RATE, 1);
const [ITC, NEW_LAW] = lawsIn(RENO_39B_LAW);
const ARTICLE = firstArticleEn(RENO_39B_LAW);
const KYA = kyaWithGazetteEn(RENO_39B_KYA);

// Τα δύο παραδείγματα και η δαπάνη πάνω από το όριο, όπως στον ελληνικό οδηγό.
const EX1 = { services: 12000, materials: 4000 };
const EX2 = { services: 9000, materials: 5000 };
const R1 = renovationCredit(EX1);
const R2 = renovationCredit(EX2);
const OVER = 25000;
const R_OVER = renovationCredit({ services: OVER, materials: 0 });

// «Ανακαινίζω 2026», από τις σταθερές της δράσης.
const ANAK = 'Anakainizo 2026';
const ANAK_RATES = `${f.fpRate(ANAK_PCT_I)} (income category I) or ${f.fpRate(ANAK_PCT_II)} (category II), rising to ${f.fpRate(ANAK_PCT_I_MAX)} and ${f.fpRate(ANAK_PCT_II_MAX)} with top-ups`;
const ANAK_CAPS = `up to ${f.feWhole(ANAK_PER_SQM)} per m² of main living space and up to ${f.feWhole(ANAK_CAP)} per home, including VAT`;
const ANAK_OTHER = `plus up to ${f.feWhole(ANAK_OTHER_COSTS)} at 100% for engineers, the energy performance certificate, the Electronic Building ID and permits`;
const ANAK_SCOPE = `homes with up to ${ANAK_MAX_SQM} m² of main living space (${ANAK_MAX_SQM_LARGE_FAMILY} m² for families with three or more children who will live there), a building permit dated no later than ${longDateEn(isoOfDmy(ANAK_PERMIT_BY))} and energy class ${greekLetterEn(ANAK_ENERGY_CLASS)} or lower. That covers vacant homes (unused in 2024 and 2025) that will become a main home or be let long-term as a main home, and homes the applicant already lives in`;
const ANAK_OBLIGATION = `The renovated home, vacant or owner-occupied, must remain a main home for at least ${countEn(ANAK_YEARS)} years after the work is completed, with no short-term rental, subletting or free use by others`;
const ANAK_STATUS = `Eligibility certificates closed on ${longDateEn(isoOfDmy(ANAK_ELIGIBILITY_OPEN_TO))} for owner-occupied homes and on ${longDateEn(isoOfDmy(ANAK_ELIGIBILITY_CLOSED_TO))} for vacant ones. Only people who already hold a certificate can apply for funding. The certificate is not an approval: eligibility is checked again`;

const H1 = `Greek renovation tax credit: up to ${CAP} over ${YEARS} years`;
const DESC = `In Greece the renovation tax credit equals what you spend, up to ${CAP} over ${YEARS} years, for costs until ${TO}. Conditions and worked examples.`;

export function generateMetadata(): Metadata {
  return publicMetadata({ title: H1, description: DESC, url: siteUrl(PATH), type: 'article', image: shareImage('en-guide-renovation-credit') });
}

const FAQ: EnFaq[] = [
  {
    q: `Is the credit ${OLD_PCT} of the cost?`,
    a: `Not any more. ${OLD_PCT} applied to costs from 2020 to 2022. For costs from ${FROM} to ${TO}, the tax cut equals the eligible cost, up to ${CAP} in total across all years.`,
  },
  {
    q: 'Over how many years is the credit spread?',
    a: `In ${YEARS} equal annual shares, so at most ${PER_YEAR} a year. In any year the credit cannot exceed the tax you owe for that year, and anything left over is not refunded.`,
  },
  {
    q: 'Does a cost I paid in cash count?',
    a: 'No. The cost must be paid electronically (card, bank transfer or instant payment) and invoiced to your Greek tax number (AFM). A cash payment means no credit, however correct the invoice.',
  },
  {
    q: 'How much in materials counts?',
    a: `Materials count up to ${SHARE} of the value of the services. With ${f.feWhole(EX2.services)} of labor, up to ${f.feWhole(R2.materialsCounted)} of materials counts; anything above that is not an eligible cost.`,
  },
  {
    q: `Is this the same as ${ANAK}?`,
    a: `No. ${ANAK} (officially the Home Renovation program) is a grant of ${ANAK_RATES}, ${ANAK_CAPS}. ${ANAK_STATUS}. The ${ARTICLE} credit reduces your income tax instead.`,
  },
];

const LINK = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } as const;
const STRONG = { color: 'var(--text-primary)' } as const;

export default function Page() {
  const sections = [
    {
      id: 'what', over: '1. The credit', title: `What ${ARTICLE} reduces`,
      body: <>
        <p className="lg-p">{`The rule covers energy, functional and aesthetic upgrades to buildings carried out from ${FROM} to ${TO}. It does not deduct the cost from your income. It cuts the tax itself by an amount equal to the eligible cost. The cut doesn’t come all at once: it is spread in ${YEARS} equal annual shares, and in each year it cannot exceed the tax you owe.`}</p>
      </>,
    },
    {
      id: 'limit', over: '2. The cap', title: 'One cap for the cost and the credit',
      body: <>
        <p className="lg-p">{`${CAP} is both the maximum eligible cost and the maximum tax credit, across all years together. Spread over ${YEARS} years, that is at most ${PER_YEAR} a year. Anyone working with the old ${OLD_PCT} sees at most ${f.feWhole(RENO_39B_CAP * RENO_39B_OLD_RATE)}, which is ${OLD_TIMES} times less than they are entitled to.`}</p>
        <p className="lg-p">{`Spending more than the cap doesn’t raise the credit. A renovation with an eligible cost of ${f.feWhole(OVER)} also gives at most ${f.feWhole(R_OVER.total)}. Nor can one year’s credit exceed that year’s tax: if your annual tax is below ${PER_YEAR}, the credit for that year is cut to the amount of tax.`}</p>
      </>,
    },
    {
      id: 'conditions', over: '3. Conditions', title: 'Payment, invoices, materials',
      body: <>
        <ul className="lg-ul">
          <li><strong style={STRONG}>Electronic payment.</strong>{' Card, bank transfer or instant payment. A cost paid in cash doesn’t count, however correct the invoice.'}</li>
          <li><strong style={STRONG}>Invoices in your name.</strong>{' An invoice to your Greek tax number (AFM) for every job and every purchase of materials.'}</li>
          <li><strong style={STRONG}>A provider established in Greece.</strong>{' The contractor or supplier is tax-resident in Greece or has a permanent establishment there.'}</li>
          <li><strong style={STRONG}>{`Materials up to ${SHARE} of services.`}</strong>{` Materials count only up to ${SHARE} of the value of the services. Anything above that is left out.`}</li>
        </ul>
        <p className="lg-p">Keep invoices and proof of payment for each property from the first day. That is what your accountant asks for when the tax return comes round.</p>
      </>,
    },
    {
      id: 'example', over: '4. Example', title: 'Two renovations, step by step',
      body: <>
        <p className="lg-p">{`An apartment renovation with ${f.feWhole(EX1.services)} of labor and ${f.feWhole(EX1.materials)} of materials, all paid electronically and invoiced to the owner’s tax number.`}</p>
        <ul className="lg-ul">
          <li><strong style={STRONG}>Materials limit:</strong>{` ${f.feWhole(EX1.services)} / ${MAT_DIV} = ${f.feWhole(EX1.services * RENO_39B_MATERIALS_SHARE)}. Materials come to ${f.feWhole(EX1.materials)}, so they count in full.`}</li>
          <li><strong style={STRONG}>Eligible cost:</strong>{` ${f.feWhole(EX1.services)} + ${f.feWhole(R1.materialsCounted)} = ${f.feWhole(R1.eligible)}, exactly at the cap.`}</li>
          <li><strong style={STRONG}>{`Tax credit: ${f.feWhole(R1.total)},`}</strong>{` or ${f.feWhole(R1.perYear)} a year for ${YEARS} years, as long as each year’s tax is high enough.`}</li>
        </ul>
        <p className="lg-p">{`Now a different mix: ${f.feWhole(EX2.services)} of labor and ${f.feWhole(EX2.materials)} of materials, ${f.feWhole(EX2.services + EX2.materials)} in total.`}</p>
        <ul className="lg-ul">
          <li><strong style={STRONG}>Materials limit:</strong>{` ${f.feWhole(EX2.services)} / ${MAT_DIV} = ${f.feWhole(R2.materialsCounted)}. Materials come to ${f.feWhole(EX2.materials)}, so only ${f.feWhole(R2.materialsCounted)} counts.`}</li>
          <li><strong style={STRONG}>Eligible cost:</strong>{` ${f.feWhole(EX2.services)} + ${f.feWhole(R2.materialsCounted)} = ${f.feWhole(R2.eligible)}. The other ${f.feWhole(EX2.materials - R2.materialsCounted)} of materials doesn’t count.`}</li>
          <li><strong style={STRONG}>{`Tax credit: ${f.feWhole(R2.total)},`}</strong>{` or ${f.feWhole(R2.perYear)} a year for ${YEARS} years, instead of ${f.feWhole(EX2.services + EX2.materials)} if all the materials counted.`}</li>
        </ul>
        <div className="lg-note lg-note-tip" style={{ marginTop: 16 }}>The mix is already visible in the quote. Ask the contractor for an itemized quote that separates labor from materials.</div>
      </>,
    },
    {
      id: 'confirm', over: '5. What to confirm', title: 'The spending window and enough tax',
      body: <>
        <p className="lg-p">{`The rule applies to costs from ${FROM} to ${TO}, under ${KYA}. Before you commission the work, confirm two things with your accountant:`}</p>
        <ul className="lg-ul">
          <li>{`That your cost falls inside the window. The dates of the invoice and the payment are what count; work invoiced after ${TO} doesn’t count unless the window is extended again.`}</li>
          <li>{`That your tax is high enough to absorb up to ${PER_YEAR} a year. The credit never exceeds each year’s tax, and anything left over is not refunded.`}</li>
        </ul>
        <p className="lg-p">{`If you let property as a business: the same cost cannot be deducted both as a business expense and as an ${ARTICLE} credit.`}</p>
      </>,
    },
    {
      id: 'anakainizo', over: '6. Don’t confuse it', title: `How it differs from ${ANAK}`,
      body: <>
        <p className="lg-p">{`${ANAK} (“I Renovate 2026”), officially the Home Renovation program, is a grant, not a tax cut. It covers ${ANAK_SCOPE}. The grant is ${ANAK_RATES}. It is paid ${ANAK_CAPS}, ${ANAK_OTHER}. ${ANAK_OBLIGATION}.`}</p>
        <p className="lg-p">{`${ANAK_STATUS}. In subsidized programs, costs incurred before you are accepted usually don’t qualify, so approval comes first and the work after. The terms are those set by the decisions in the sources below. Announcements about the second stage are on the `}<a href={ANAKAINIZO_HREF} target="_blank" rel="noopener noreferrer" hrefLang="el" className="lp-link" style={LINK}>program page on stegasi.gov.gr</a>{' (in Greek).'}</p>
      </>,
    },
  ];
  return (
    <GuideShellEn el={EL} path={PATH} h1={H1} description={DESC} about={`Greek renovation tax credit: ${ARTICLE} of the Income Tax Code, cap and conditions`}
      intro={<>
        <p className="lg-p">{`${ARTICLE} of the Greek Income Tax Code (${ITC}) cuts your tax by an amount equal to the eligible cost of a renovation, up to ${CAP} in total. You will still hear “${OLD_PCT}”: that was the rule for costs from 2020 to 2022, and under it the benefit comes out ${OLD_TIMES} times smaller than today’s.`}</p>
        <p className="lg-p">{`This guide shows how the credit is worked out, which conditions to meet before you pay the first invoice and what to confirm before ${TO}.`}</p>
      </>}
      sections={sections}
      sources={[
        `Renovation tax credit: ${ARTICLE} of the Income Tax Code (${ITC}), as replaced by ${NEW_LAW}, in force from ${FROM} · a tax cut equal to the eligible cost · up to ${CAP} across all years, in ${YEARS} equal annual shares · materials up to ${SHARE} of the value of the services · electronic payment and invoices to the owner’s tax number.`,
        `${KYA}: how the rule applies to costs from ${FROM} to ${TO}, conditions for providers and invoices, and the bar on also deducting the same cost as a business expense.`,
        `Home Renovation (${ANAK}): ${kyaWithGazetteEn(ANAK_KYA)}, as amended by ${kyaWithGazetteEn(ANAK_KYA_AMEND)} and ${kyaWithGazetteEn(ANAK_KYA_AMEND2)} · a grant of ${ANAK_RATES} · the grant reaches ${ANAK_CAPS}, ${ANAK_OTHER}.`,
      ]}
      faq={FAQ} faqTitle="What people ask about the renovation tax credit"
      cta={{ title: 'Your own renovation credit', href: '/en/renovation-tax-credit-calculator', action: 'Calculate your credit',
        body: <>{`Enter labor, materials and, if you like, your tax for each year, and see the credit year by year. For what the renovation does to your yield, the `}<Link href="/en/rental-yield-calculator" className="lp-link" style={LINK}>rental yield calculator</Link>{` works it out the same way the ${PRODUCT_NAME} dashboard does.`}</> }} />
  );
}
