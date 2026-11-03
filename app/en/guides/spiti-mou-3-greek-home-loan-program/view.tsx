import type { Metadata } from 'next';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { siteUrl } from '@/lib/core/site';
import { athensToday } from '@/lib/core/time';
import { fmtFor } from '@/lib/core/format';
import { MONTHS_GEN } from '@/lib/core/months';
import {
  SPITI_MOU, SPITI_MOU_1, SPITI_MOU_3, SPITI_MOU_3_REPORTED, SPITI_MOU_FUNDING, SPITI_MOU_INCOME_BEFORE_2025_11,
  SPITI_MOU_LEGAL, spitiMouStatus,
} from '@/lib/loans/recommend';
import { DSTI_LIMIT } from '@/lib/loans/affordability';
import { longDateEn, MONTHS_EN } from '@/lib/i18n/en/dates';
import { kyaWithGazetteEn, lawsIn, firstArticleEn } from '@/lib/i18n/en/guides/cite';
import { publicMetadata } from '../../../publicMetadata';
import { shareImage } from '../../../og/share';
import { GuideShellEn, type EnFaq } from '../GuideShellEn';

// ═══════════════════════════════════════════════════════════════════════════
// Ο οδηγός «Σπίτι μου ΙΙΙ: τι ίσχυε και τι αλλάζει» στα αγγλικά
// ─────────────────────────────────────────────────────────────────────────
// Κάθε αριθμός από το lib/loans/recommend.ts και το DSTI_LIMIT, όπως ο
// ελληνικός (./content.ts του φακέλου του). Οι ελληνικές προτάσεις εκεί
// (spitiMou3Line, spitiMouClosedSentence, ReportedLines) ξαναγράφονται εδώ
// στα αγγλικά από τις ΙΔΙΕΣ σταθερές και την ίδια κρίση κατάστασης
// (`spitiMouStatus`). Η ΠΕΕ 227/1/08.03.2024 της Τράπεζας της Ελλάδος και η
// έναρξή της (01/01/2025) είναι γραμμένες με το χέρι και στον ελληνικό οδηγό.
// ═══════════════════════════════════════════════════════════════════════════
const PATH = '/en/guides/spiti-mou-3-greek-home-loan-program';
const EL = '/odigos/spiti-mou-3-ti-allazei';
const CALC = '/en/mortgage-calculator';
const f = fmtFor('en');
const share = (x: number) => f.fpRate(x * 100);
/** «31/05/2026» (η γραφή του προγράμματος) ή ISO → «31 May 2026». */
const date = (raw: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  return longDateEn(m ? `${m[3]}-${m[2]}-${m[1]}` : raw);
};

const P1 = SPITI_MOU_1, P2 = SPITI_MOU, P3 = SPITI_MOU_3, R = SPITI_MOU_3_REPORTED, F2 = SPITI_MOU_FUNDING;
const N1 = 'Spiti mou I', N2 = 'Spiti mou II', N3 = 'Spiti mou III';
const NAMES = [N1, N2, N3] as const;
const HDB = 'Hellenic Development Bank';
const DYPA = 'DYPA';
/** «αρχές Ιανουαρίου 2027» → «early January 2027», από τον μήνα και το έτος της ετικέτας. */
const START = (() => {
  const year = /\d{4}/.exec(P3.startLabel)?.[0];
  const m = MONTHS_GEN.findIndex(g => P3.startLabel.includes(g));
  return year && m >= 0 ? `early ${MONTHS_EN[m]} ${year}` : year ? `in ${year}` : P3.startLabel;
})();
// Η νομική βάση του Ι: άρθρο, νόμος και η ΚΥΑ με το ΦΕΚ της, από τη μία σταθερά.
const P1_BASIS = (() => {
  const kyaAt = P1.legalBasis.indexOf('\u039a\u03a5\u0391');
  const law = lawsIn(P1.legalBasis.slice(0, kyaAt < 0 ? undefined : kyaAt))[0] ?? '';
  return `${firstArticleEn(P1.legalBasis)} of ${law}${kyaAt >= 0 ? ` and ${kyaWithGazetteEn(P1.legalBasis.slice(kyaAt))}` : ''}`;
})();
const P2_KYA = kyaWithGazetteEn(SPITI_MOU_LEGAL.kya);
const P2_AMEND = kyaWithGazetteEn(SPITI_MOU_LEGAL.incomeAmendment);

const LINE_3 = `Announced at the Thessaloniki International Fair (${date(P3.announcedOn)}). No official text with the terms has been published yet, and applications are not open. According to the ${HDB}, it starts in ${START}.`;
function closedSentence(today: string): string {
  const s = spitiMouStatus(today);
  if (s.acceptsApplications) return '';
  return s.state === 'applications-closed'
    ? `For ${N2}, the application deadline passed on ${date(P2.applicationDeadline)}. Those already approved can sign until ${date(P2.contractDeadline)}.`
    : `For ${N2}, the application deadline passed on ${date(P2.applicationDeadline)}. Those approved could sign until ${date(P2.contractDeadline)}.`;
}
const REPORTED = [
  `A loan of up to ${f.feWhole(R.maxAmount)} for a home worth up to ${f.feWhole(R.maxPropertyValue)}, financing up to ${f.fpRate(R.maxLtvPct)} of the value.`,
  `Income up to ${f.feWhole(R.incomeSingle)} for single people, ${f.feWhole(R.incomeMarriedBase)} for couples and ${f.feWhole(R.incomeSingleParentBase)} for single-parent families, plus ${f.feWhole(R.incomePerChild)} per child.`,
  `${f.fn(R.sqmPerChildAboveFour)} m² more for each child beyond the fourth.`,
  `About ${f.fn(R.beneficiaries)} beneficiaries, according to the Minister of Social Cohesion.`,
];
const CAVEAT = `These figures come from ministers’ statements and press reports (${R.source.label}). They are not the program’s terms: they will apply only as written in the Joint Ministerial Decision.`;
const INCOME_CHANGE = (() => {
  const b = SPITI_MOU_INCOME_BEFORE_2025_11;
  return `${P2_AMEND} raised the income limits: single people from ${f.feWhole(b.incomeSingle)} to ${f.feWhole(P2.incomeSingle)}, couples from ${f.feWhole(b.incomeMarriedBase)} to ${f.feWhole(P2.incomeMarriedBase)} (per child from ${f.feWhole(b.incomePerChild)} to ${f.feWhole(P2.incomePerChild)}), single-parent families from ${f.feWhole(b.incomeSingleParentBase)} to ${f.feWhole(P2.incomeSingleParentBase)}. The minimum stayed at ${f.feWhole(P2.incomeMin)}.`;
})();
const DSTI = `All loan payments together can take up to ${share(DSTI_LIMIT.firstTimeBuyer)} of net income if you are borrowing for the first time, and ${share(DSTI_LIMIT.other)} if you have had a mortgage before or already own property (Bank of Greece Executive Committee Act 227/1/08.03.2024, from 1 January 2025). The limit applies with or without a program.`;

type Cell = { text: string; kind: 'official' | 'reported' | 'none' };
const off = (text: string): Cell => ({ text, kind: 'official' });
const rep = (text: string): Cell => ({ text, kind: 'reported' });
const NONE: Cell = { text: 'Not announced', kind: 'none' };
const NOT_FOUND: Cell = { text: 'Not found in an official source', kind: 'none' };
const ROWS: { label: string; cells: [Cell, Cell, Cell] }[] = [
  { label: 'Run by', cells: [off(`${DYPA}, the Public Employment Service`), off(`${HDB}, with Recovery and Resilience Facility funds`), off(HDB)] },
  { label: 'Age', cells: [off(`${P1.ageMin} to ${P1.ageMax}`), off(`${P2.ageMin} to ${P2.ageMax}`), off(`Up to ${P3.ageMax}; the minimum hasn’t been announced`)] },
  { label: 'Income, single', cells: [off(`${f.feWhole(P1.incomeMin)} to ${f.feWhole(P1.incomeSingle)}`), off(`${f.feWhole(P2.incomeMin)} to ${f.feWhole(P2.incomeSingle)}`), rep(`Up to ${f.feWhole(R.incomeSingle)}`)] },
  { label: 'Income, couple', cells: [off(`Up to ${f.feWhole(P1.incomeMarriedBase)}, plus ${f.feWhole(P1.incomePerChild)} per child`), off(`Up to ${f.feWhole(P2.incomeMarriedBase)}, plus ${f.feWhole(P2.incomePerChild)} per child`), rep(`Up to ${f.feWhole(R.incomeMarriedBase)}, plus ${f.feWhole(R.incomePerChild)} per child`)] },
  { label: 'Income, single parent', cells: [NOT_FOUND, off(`Up to ${f.feWhole(P2.incomeSingleParentBase)}, plus ${f.feWhole(P2.incomePerChild)} per child after the first`), rep(`Up to ${f.feWhole(R.incomeSingleParentBase)}`)] },
  { label: 'Property value', cells: [off(`Up to ${f.feWhole(P1.maxPropertyValue)}`), off(`Up to ${f.feWhole(P2.maxPropertyValue)}`), rep(`Up to ${f.feWhole(R.maxPropertyValue)}`)] },
  { label: 'Floor area', cells: [off(`Up to ${P1.maxSqm} m²`), off(`Up to ${P2.maxSqm} m²`), rep(`${f.fn(R.sqmPerChildAboveFour)} m² more for each child beyond the fourth`)] },
  { label: 'Building age', cells: [off(`At least ${P1.minBuildingAgeYears} years old`), off(`Built in ${P2.maxYearBuilt} or earlier`), NONE] },
  { label: 'Loan amount', cells: [off(`Up to ${f.feWhole(P1.maxAmount)}`), off(`Up to ${f.feWhole(P2.maxAmount)}`), rep(`Up to ${f.feWhole(R.maxAmount)}`)] },
  { label: 'Loan to value', cells: [off(`Up to ${f.fpRate(P1.maxLtv)}`), off(`Up to ${f.fpRate(P2.maxLtv)}`), rep(`Up to ${f.fpRate(R.maxLtvPct)}`)] },
  { label: 'Term', cells: [off(`Up to ${P1.maxYears} years`), off(`${P2.minYears} to ${P2.maxYears} years`), NONE] },
  { label: 'Funding', cells: [
    off(`${share(P1.interestFreeShare)} from ${DYPA} without interest, ${share(1 - P1.interestFreeShare)} from the bank at its own rate. For families with three or more children, the whole loan without interest`),
    off(`${share(F2.interestFreeShare)} without interest, ${share(1 - F2.interestFreeShare)} from the bank at its own rate. With ${F2.largeFamilyChildren} or more children, the bank’s rate is cut by ${share(F2.largeFamilyRateCut)}`),
    NONE,
  ] },
  { label: 'Applications', cells: [off(`${date(P1.applicationsFrom)} to ${date(P1.applicationsTo)}`), off(`Until ${date(P2.applicationDeadline)}; signing until ${date(P2.contractDeadline)}`), off(`From ${START}, according to the ${HDB}`)] },
];

const H1 = `${N3}: what the earlier programs offered and what changes`;
const DESC = `What Greece’s state home loans ${N1} and ${N2} offered, what is official for ${N3}, what has only been reported and what to do meanwhile.`;

export function generateMetadata(): Metadata {
  return publicMetadata({ title: H1, description: DESC, url: siteUrl(PATH), type: 'article', image: shareImage('en-guide-spiti-mou-3') });
}

const MARK: CSSProperties = { display: 'block', marginTop: 4, fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--warning)' };
const STRONG = { color: 'var(--text-primary)' } as const;
const LINK = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } as const;
function CellView({ c }: { c: Cell }) {
  if (c.kind === 'reported') return <td>{c.text}<span style={MARK}>not yet official</span></td>;
  if (c.kind === 'none') return <td style={{ color: 'var(--text-tertiary)' }}>{c.text}</td>;
  return <td>{c.text}</td>;
}
function Ext({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" hrefLang="el" className="lp-link" style={LINK}>{children}</a>;
}

export default function Page() {
  const today = athensToday();
  const closed = closedSentence(today);
  const FAQ: EnFaq[] = [
    { q: `When does ${N3} open?`, a: `${LINE_3} Until then, there is no way to check whether you are eligible.` },
    { q: `Is ${N2} still running?`, a: closed ? `${closed} The new round is ${N3}.` : `It accepts applications until ${date(P2.applicationDeadline)}, on the terms of the body that runs it.` },
    { q: `Are the ${f.feWhole(R.maxAmount)} loan and the ${f.feWhole(R.maxPropertyValue)} value official?`, a: `Not yet. ${CAVEAT}` },
    { q: 'What was the age limit in the earlier programs?', a: `In ${N1}, ${P1.ageMin} to ${P1.ageMax}; in ${N2}, ${P2.ageMin} to ${P2.ageMax}. For ${N3}, the government’s detailed list of the measures announced at the Fair gives a maximum age of ${P3.ageMax}.` },
    { q: `What changed in ${N2} income limits in November 2025?`, a: INCOME_CHANGE },
    { q: 'How large a monthly payment can I take on?', a: `${DSTI} The mortgage calculator shows how much loan your income supports.` },
  ];
  const sections = [
    {
      id: 'spiti-mou-1', over: '1. The first', title: `${N1}: what it offered`,
      body: <>
        <p className="lg-p">{`The first program was run by ${DYPA}, the Public Employment Service; legal basis: ${P1_BASIS}. Applications ran from ${date(P1.applicationsFrom)} to ${date(P1.applicationsTo)}. It was for young people and couples aged ${P1.ageMin} to ${P1.ageMax}, for a first home worth up to ${f.feWhole(P1.maxPropertyValue)} and up to ${P1.maxSqm} m², in a building at least ${P1.minBuildingAgeYears} years old.`}</p>
        <p className="lg-p">{`The loan went up to ${f.feWhole(P1.maxAmount)}. ${share(P1.interestFreeShare)} came from ${DYPA} without interest and the rest from the bank at its own rate. How many loans were finally signed was not found in an official report.`}</p>
      </>,
    },
    {
      id: 'spiti-mou-2', over: '2. The second', title: `${N2}: what it offered`,
      body: <>
        <p className="lg-p">{`The second was run by the ${HDB} with Recovery and Resilience Facility funds; legal basis: ${P2_KYA}. It raised the age limit to ${P2.ageMax}, the loan to ${f.feWhole(P2.maxAmount)} and the property value to ${f.feWhole(P2.maxPropertyValue)}. Applications closed on ${date(P2.applicationDeadline)} and signing on ${date(P2.contractDeadline)}.`}</p>
        <p className="lg-p">{INCOME_CHANGE}</p>
        <p className="lg-p">The limits still quoted in older articles are often the ones from before that change. The table below shows the latest.</p>
      </>,
    },
    {
      id: 'spiti-mou-3', over: '3. The new one', title: `${N3}: what is official`,
      body: <>
        <ul className="lg-ul">
          <li><strong style={STRONG}>Announced:</strong>{` at the Thessaloniki International Fair, ${date(P3.announcedOn)}.`}</li>
          <li><strong style={STRONG}>Run by:</strong>{` the ${HDB} (HDB).`}</li>
          <li><strong style={STRONG}>Budget:</strong>{` ${f.fn(P3.budgetEur / 1e9)} billion euros, according to the HDB.`}</li>
          <li><strong style={STRONG}>Start:</strong>{` ${START}, according to the HDB. This is not an application date.`}</li>
          <li><strong style={STRONG}>Age:</strong>{` up to ${P3.ageMax}, according to the government’s detailed list of the measures.`}</li>
        </ul>
        <p className="lg-p">No other criterion has been published in an official text: not income, not property value, not which banks take part.</p>
        <aside aria-label="Reported, not yet official" className="lg-note lg-note-tip" style={{ marginTop: 16, borderLeftColor: 'var(--warning)', background: 'color-mix(in srgb, var(--warning) 7%, var(--bg-elevated))' }}>
          <strong style={{ ...STRONG, display: 'block', marginBottom: 8 }}>Reported, not yet official</strong>
          <ul className="lg-ul" style={{ marginBottom: 10 }}>{REPORTED.map(l => <li key={l}>{l}</li>)}</ul>
          <span>{`${CAVEAT} `}</span>
          <span>{'Sources: '}<Ext href={R.source.url}>{R.source.label}</Ext>{' · '}<Ext href={R.beneficiariesSource}>Ministry of Social Cohesion</Ext>{'.'}</span>
        </aside>
      </>,
    },
    {
      id: 'comparison', over: '4. Comparison', title: 'I, II and III, criterion by criterion',
      body: <>
        <p className="lg-p">In the III column, anything marked “not yet official” comes from statements and press reports, not from the Joint Ministerial Decision.</p>
        <div className="po-table-box" style={{ marginTop: 14 }}>
          <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
            <table className="po-table tbl-fixed" style={{ ['--tbl-min' as string]: '680px' }}>
              <caption>{`${NAMES.join(', ')}: the criteria one by one`}</caption>
              <colgroup><col style={{ width: '19%' }} />{NAMES.map(n => <col key={n} style={{ width: '27%' }} />)}</colgroup>
              <thead><tr><th scope="col">Criterion</th>{NAMES.map(n => <th key={n} scope="col">{n}</th>)}</tr></thead>
              <tbody>
                {ROWS.map(row => (
                  <tr key={row.label}><th scope="row">{row.label}</th>{row.cells.map((c, i) => <CellView key={i} c={c} />)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>,
    },
    {
      id: 'from-today', over: '5. From today', title: 'What to do until the terms are out',
      body: <>
        <ul className="lg-ul">
          <li><strong style={STRONG}>Measure the payment, not the program.</strong>{` ${DSTI}`}</li>
          <li><strong style={STRONG}>Keep your gov.gr credentials active.</strong>{` In ${N2}, the eligibility certificate was issued online on gov.gr and taken to the bank. For ${N3}, no list of documents has been published yet.`}</li>
          <li><strong style={STRONG}>Don’t commit on limits that haven’t been written.</strong>{' A down payment or a preliminary contract that counts on an income or value limit is a risk until the decision is published.'}</li>
        </ul>
        <p className="lg-p">The <Link href={CALC} className="lp-link" style={LINK}>mortgage calculator</Link> shows the payment at banks’ current rates, without a state program.</p>
      </>,
    },
  ];
  return (
    <GuideShellEn el={EL} path={PATH} h1={H1} description={DESC} about={`Greek state-backed home loan programs ${N1}, ${N2} and ${N3}`}
      intro={<>
        <p className="lg-p">{`${N3} (“My Home III”) is the next round of Greece’s state-backed home loans for young people and families. ${LINE_3}`}</p>
        {closed && <p className="lg-p">{closed}</p>}
        <p className="lg-p">This guide puts side by side what the two earlier programs offered, what the body running the new one has said officially and what has only been reported. It doesn’t judge whether you are eligible: that will only be possible under the terms of the decision.</p>
        <div className="lg-note lg-note-tip" style={{ marginTop: 16 }}>{`The official details for ${N3} were checked on ${date(P3.checkedAt)}, and for ${N1} and ${N2} on ${date(SPITI_MOU_LEGAL.checkedAt)}. This guide will be updated when the decision for the new program is published.`}</div>
      </>}
      sections={sections}
      sources={[
        <>{`${N1}: ${P1_BASIS}. `}<Ext href={P1.sources.portal}>stegasi.gov.gr</Ext>{' · '}<Ext href={P1.sources.qa}>HDB questions and answers</Ext>{' · '}<Ext href={P1.sources.terms}>{`${DYPA} announcement of the terms`}</Ext>{' · '}<Ext href={P1.sources.opening}>applications open</Ext>{' · '}<Ext href={P1.sources.closing}>applications close</Ext>{'.'}</>,
        <>{`${N2}: ${P2_KYA}, as amended, most recently for income and deadlines by ${P2_AMEND}. `}<Ext href={SPITI_MOU_LEGAL.sources.kya}>the decision at the HDB</Ext>{' · '}<Ext href={SPITI_MOU_LEGAL.sources.incomeAmendment}>ministries’ announcement of the wider limits</Ext>{' · '}<Ext href={SPITI_MOU_LEGAL.sources.portal}>stegasi.gov.gr</Ext>{' · '}<Ext href={SPITI_MOU_LEGAL.sources.certificate}>eligibility certificate on gov.gr</Ext>{'.'}</>,
        <>{`${N3}: `}<Ext href={P3.sources.announcement}>the Prime Minister’s speech at the Fair</Ext>{' · '}<Ext href={P3.sources.pressConference}>press conference</Ext>{' · '}<Ext href={P3.sources.hdb}>HDB press release</Ext>{' · '}<Ext href={P3.sources.measures}>detailed list of the measures</Ext>{'.'}</>,
        <>{'Not yet official: '}<Ext href={R.source.url}>{R.source.label}</Ext>{' · '}<Ext href={R.beneficiariesSource}>statement by the Minister of Social Cohesion</Ext>{'.'}</>,
        'Payment limit: Bank of Greece Executive Committee Act 227/1/08.03.2024, in force from 1 January 2025.',
      ]}
      faq={FAQ} faqTitle={`What people ask about ${N3}`}
      cta={{ title: 'The payment on your own loan', href: CALC, action: 'Calculate your mortgage payment',
        body: 'Enter the amount, term and income. The calculator shows the payment, each year’s interest and how much loan fits the Bank of Greece limit.' }} />
  );
}
