import type { Metadata } from 'next';
import Link from 'next/link';
import { siteUrl } from '@/lib/core/site';
import { athensToday } from '@/lib/core/time';
import { fmtFor } from '@/lib/core/format';
import { AADE_DESTINATIONS } from '@/lib/tax/aade';
import { AADE_CALENDAR_URL } from '@/lib/tax/greekTaxCalendar';
import { ENFIA_INSTALMENTS, ENFIA_MIN_INSTALMENT } from '@/lib/tools/enfiaSchedule';
import { publicMetadata } from '../../../publicMetadata';
import { shareImage } from '../../../og/share';
import { enfiaInstalments, enfiaIssueBasis, instalmentStatus, obligationOf } from '../../../odigos/enfia-2026-pliromi-doseis-pistopoiitiko/schedule';
import { GuideShellEn, type EnFaq } from '../GuideShellEn';

// ═══════════════════════════════════════════════════════════════════════════
// Ο οδηγός «ΕΝΦΙΑ 2026: πληρωμή, δόσεις, πιστοποιητικό» στα αγγλικά
// ─────────────────────────────────────────────────────────────────────────
// Οι δόσεις και η κατάστασή τους βγαίνουν από το ίδιο schedule.ts με τον
// ελληνικό (φορολογικό ημερολόγιο). Η απόφαση της ΑΑΔΕ διαβάζεται από τις
// σημειώσεις του ημερολογίου (`enfiaIssueBasis`) και γράφεται με τον αριθμό
// της. Τα μενού του myAADE μένουν με τα ελληνικά τους ονόματα, όπως στην οθόνη.
// ═══════════════════════════════════════════════════════════════════════════
const PATH = '/en/guides/enfia-payment-instalments-certificate';
const EL = '/odigos/enfia-2026-pliromi-doseis-pistopoiitiko';
const f = fmtFor('en');
const long = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${d}, ${y}`; };

/** Ο οδηγός αφορά το εκκαθαριστικό αυτού του έτους, όπως ο ελληνικός. */
const YEAR = 2026;
const DATES = enfiaInstalments(YEAR);
const N = DATES.length;
const FIRST = DATES[0];
const LAST = DATES[N - 1];
const FIRST_OBL = obligationOf(YEAR, 'enfia-first');
const ISSUED = FIRST_OBL.confidence === 'statutory';
const BASIS = enfiaIssueBasis(YEAR);
const DECISION = BASIS ? /(\d+\/\d{2}-\d{2}-\d{4})/.exec(BASIS.decision)?.[1] ?? '' : '';
const AUTOFILE = obligationOf(YEAR, 'income-autofile').date;
const PORTAL = AADE_DESTINATIONS.enfia;
const ENFIA_PATH = PORTAL.steps.slice(0, -1);
const PATH_TEXT = ENFIA_PATH.map(s => `“${s}”`).join(' › ');
const RULE = `up to ${ENFIA_INSTALMENTS} monthly instalments, the last one no later than ${long(LAST).split(' ')[0]} of the following year, as the law provides. Each instalment must be at least ${f.feWhole(ENFIA_MIN_INSTALMENT)}, so a small amount means fewer instalments.`;
const RANGE = ISSUED
  ? `The exact dates are on the assessment notice; for ${YEAR} they run from ${long(FIRST)} to ${long(LAST)}.`
  : `The exact dates are on the assessment notice; for ${YEAR} they haven’t been announced yet and, as in recent years, are expected to run from ${long(FIRST)} to ${long(LAST)}.`;
const MITOS_CERT = 'https://mitos.gov.gr/index.php/%CE%94%CE%94:%CE%A0%CE%B9%CF%83%CF%84%CE%BF%CF%80%CE%BF%CE%B9%CE%B7%CF%84%CE%B9%CE%BA%CF%8C_%CE%95%CE%9D.%CE%A6.%CE%99.%CE%91.';
const GOV_FINALIZE = 'https://www.gov.gr/arxes/anexartete-arkhe-demosion-esodon-aade/anexartete-arkhe-demosion-esodon-aade/egkuroteta-oristikopoiese-pistopoietikou-enphia';

const H1 = `ENFIA ${YEAR}: payment, instalments, the ENFIA certificate and its finalization`;
const DESC = `When each ${YEAR} ENFIA instalment is due, where to click on myAADE to pay, how to get an ENFIA certificate for a sale and who finalizes it.`;

export function generateMetadata(): Metadata {
  return publicMetadata({ title: H1, description: DESC, url: siteUrl(PATH), type: 'article', image: shareImage('en-guide-enfia-payment') });
}

const FAQ: EnFaq[] = [
  { q: `When is ENFIA ${YEAR} paid?`, a: `In one payment or in ${RULE} ${RANGE} Each instalment is due on the last working day of its month. If the last day of the month falls on a weekend or holiday, the instalment is due on the previous working day.` },
  { q: 'In how many instalments can ENFIA be paid?', a: `In one payment or in ${RULE} With ${N} instalments, the first is due on ${long(FIRST)} and the last on ${long(LAST)}.` },
  { q: 'How do I pay ENFIA?', a: `Sign in to ${PORTAL.portal} with your TAXISnet credentials and go to ${PATH_TEXT}. The assessment notice shows a payment ID. You pay with it through your bank’s web banking.` },
  { q: 'How do I get an ENFIA certificate?', a: `Online, at no cost, from ${PORTAL.portal}: ${PATH_TEXT}, then Certificates, where you enter the property’s ATAK number. For a sale, the certificate only confirms that the property appears on form E9 for the previous five years (six, including the year of transfer, if it is issued after that year’s assessment). You don’t need to have paid overdue ENFIA to get it.` },
  { q: 'What is finalizing the ENFIA certificate?', a: 'It is the final use of the certificate in a deed, and the notary does it, not the owner. The notary checks that the certificate is valid and finalizes it by citing it in and attaching it to the deed. After that it can’t be used again: a second deed needs a new certificate.' },
];

const EXT = { target: '_blank', rel: 'noopener noreferrer', className: 'lp-link', style: { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } } as const;
const LINK = EXT.style;

export default function Page() {
  const today = athensToday();
  const { left, next } = instalmentStatus(DATES, today);
  const sections = [
    {
      id: 'instalments', over: '1. Instalments', title: `When each ${YEAR} instalment is due`,
      body: <>
        <p className="lg-p">Each instalment is due on the last working day of its month. If the last day of the month falls on a weekend or holiday, it is due on the previous working day: the dates in the table already allow for that.</p>
        <p className="lg-p">{next
          ? `Today, ${long(today)}, ${left} of the ${N} instalments remain. The next one is due on ${long(next)}.`
          : `All ${YEAR} ENFIA instalments are past due. The next assessment and its first instalment are on the tax deadlines page.`}</p>
        <div className="po-table-box gd-table gd-table-wide" style={{ marginTop: 14 }}>
          <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
            <table className="po-table" style={{ ['--tbl-min' as string]: '300px' }}>
              <caption>{`ENFIA ${YEAR} instalments`}</caption>
              <thead><tr><th scope="col">Instalment</th><th scope="col">Due</th></tr></thead>
              <tbody>
                {DATES.map((d, i) => (
                  <tr key={d}>
                    <th scope="row">
                      <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-primary)' }}>{`Instalment ${i + 1}`}</span>
                      <span style={{ display: 'block', marginTop: 2, fontSize: 13, color: 'var(--text-tertiary)' }}>
                        {d < today ? 'Past due' : d === next ? 'Next' : FIRST_OBL.confidence === 'statutory' ? 'Date set by law' : 'Last year’s date'}
                      </span>
                    </th>
                    <td className="gd-date"><time dateTime={d}>{f.date(d)}</time></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>,
    },
    {
      id: 'pay', over: '2. Payment', title: 'Where to click to pay',
      body: <>
        <ol className="lg-ul">
          <li>Sign in to <a href={PORTAL.url} {...EXT}>{PORTAL.portal}</a> with your TAXISnet credentials.</li>
          <li>{`Go to ${PATH_TEXT}. There you see and save your assessment notice.`}</li>
          <li>The assessment notice shows a payment ID.</li>
          <li>Pay through your bank’s web banking, with that payment ID.</li>
        </ol>
        <div className="lg-note lg-note-tip" style={{ marginTop: 16 }}>If you pay in instalments, each one is due on the date in the table above. When the end of the month falls on a weekend or holiday, the instalment is due earlier, not later.</div>
      </>,
    },
    {
      id: 'check', over: '3. Before you pay', title: 'Check that the amount is right',
      body: <>
        <p className="lg-p">The assessment comes from what you declared on form E9 (your property register). If a purchase, sale or inheritance wasn’t declared, the assessment doesn’t reflect it. So before you pay, it is worth comparing it with an independent estimate.</p>
        <p className="lg-p">In the <Link href="/en/enfia-calculator" className="lp-link" style={LINK}>ENFIA calculator</Link> you enter floor area, zone price, age and floor and get an indicative estimate. If it is far off the assessment, check your E9 or ask your accountant. How the tax is calculated is explained in the guide <Link href="/en/guides/how-enfia-is-calculated" className="lp-link" style={LINK}>How ENFIA is calculated</Link>.</p>
      </>,
    },
    {
      id: 'certificate', over: '4. Certificate', title: 'The ENFIA certificate for a sale',
      body: <>
        <p className="lg-p">The ENFIA certificate (Article 60 of the Tax Procedure Code, Law 5104/2024) is required by the notary when a property is transferred or a right is created over it, such as a mortgage or a pre-notation. The owner gets it online, at no cost, with TAXISnet credentials. Only for the property of a deceased person, on acceptance of an inheritance, can the notary issue it digitally with the heir’s authorization.</p>
        <p className="lg-p">For a sale, the certificate only confirms that the property appears on the ENFIA return (form E9) for the previous five years. If it is issued after that year’s assessment, it covers six years, including the year of transfer. You don’t need to have paid overdue ENFIA to get it: this applies from 01.06.2023, under Article 16 of Law 5036/2023.</p>
        <p className="lg-p">A certificate issued after that year’s assessment is valid until December 31 of the year of issue. Before the assessment is out, it is valid until it is cited in and attached to the deed (AADE Decision A.1085/2023, Article 3).</p>
        <ol className="lg-ul">
          <li>Sign in to <a href={PORTAL.url} {...EXT}>{PORTAL.portal}</a>{` and go to ${PATH_TEXT}.`}</li>
          <li>From the available actions choose Certificates.</li>
          <li>Enter the ATAK (the property’s tax ID number) of the property you need the certificate for. Best to have it noted beforehand.</li>
        </ol>
        <div className="lg-note lg-note-tip" style={{ marginTop: 16 }}>The five-year E9 limit applies to sales. For other transfers, such as a parental gift or a donation, check with the notary exactly what is needed.</div>
      </>,
    },
    {
      id: 'finalization', over: '5. Finalization', title: 'The notary does it',
      body: <>
        <p className="lg-p">“Finalizing ENFIA” concerns the certificate, not the tax. The notary, as a certified user, checks on TAXISnet that the certificate you provided is “in force” and finalizes it by citing it in and attaching it to the deed. After that the same certificate can’t be used again: a second deed needs a new one. A year’s certificates are finalized by the end of January of the following year.</p>
        <p className="lg-p">{`It has nothing to do with the automatic finalization of the income tax return: pre-filled returns left unchanged until ${long(AUTOFILE).replace(/, \d{4}$/, '')} are finalized by AADE. See the `}<Link href="/en/tax-deadlines" className="lp-link" style={LINK}>tax deadlines for property owners</Link>.</p>
      </>,
    },
  ];
  return (
    <GuideShellEn el={EL} path={PATH} h1={H1} description={DESC} about={`ENFIA ${YEAR}: payment, instalments, the ENFIA certificate and its finalization`}
      intro={<>
        <p className="lg-p">{ISSUED
          ? `The ${YEAR} ENFIA assessment notices are posted on ${PORTAL.portal}, the online portal of AADE, the Greek tax authority. ENFIA, Greece’s annual property tax, is paid in one payment or in ${RULE} ${RANGE}`
          : `The ${YEAR} ENFIA assessment hasn’t been issued yet. The dates on this page follow last year’s schedule and will be confirmed when it is issued.`}</p>
        <p className="lg-p">This guide answers what people look for when it is time to act: when each instalment is due, where to click to pay, how to get an ENFIA certificate for a sale and what finalizing it means.</p>
      </>}
      sections={sections}
      sources={[
        BASIS
          ? `ENFIA ${YEAR} assessment: AADE Decision A.${DECISION}. Instalments and deadlines: Law 4223/2013, Article 6, as codified in Law 5219/2025 (each instalment by the last working day of its month).`
          : `ENFIA instalments and deadlines: Law 4223/2013, Article 6, as codified in Law 5219/2025. The ${YEAR} assessment is announced by AADE.`,
        `Access to the assessment (${ENFIA_PATH.map(s => `“${s}”`).join(' › ')}) and payment with the payment ID through web banking: AADE press releases of ${f.date(`${YEAR}-03-15`)} and ${f.date(`${YEAR}-05-08`)}.`,
        'ENFIA certificate, legal basis: Article 60 of Law 5104/2024 (Tax Procedure Code), formerly Article 54A of Law 4987/2022 as amended by Article 16 of Law 5036/2023. From 01.06.2023, for a sale it only confirms that the property appears on the ENFIA return for the previous five years (six, including the year of transfer, if it is issued after that year’s assessment). Start: AADE press release of 31.05.2023.',
        <>{'Form, content, validity and issuing procedure of the certificate: AADE Decision A.1085/2023 (Government Gazette B 3617/31.05.2023), as amended by A.1082/2024 (validity for deceased persons) and A.1114/2024 (Government Gazette B 4293/22.07.2024, new templates and digital issue by the notary on acceptance of an inheritance) · '}<a href={MITOS_CERT} {...EXT}>ENFIA certificate in the National Register of Administrative Procedures</a>.</>,
        <>{'Finalization by the notary: '}<a href={GOV_FINALIZE} {...EXT}>Validity and finalization of the ENFIA certificate on gov.gr</a>.</>,
        <>{'Automatic finalization of the income tax return and every other deadline: '}<a href={AADE_CALENDAR_URL} {...EXT}>AADE tax calendar</a>.</>,
      ]}
      faq={FAQ} faqTitle="What people ask about paying ENFIA"
      cta={{ title: 'Before you pay, check your amount', href: '/en/enfia-calculator', action: 'Check your amount',
        body: 'Enter floor area, zone price, age and floor and compare the estimate with your assessment notice. The calculation runs on your device.' }} />
  );
}
