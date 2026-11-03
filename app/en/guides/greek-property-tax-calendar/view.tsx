import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { siteUrl, PRODUCT_NAME } from '@/lib/core/site';
import { athensToday } from '@/lib/core/time';
import { fmtFor } from '@/lib/core/format';
import {
  greekPropertyTaxObligations, TAXHEAVEN_CALENDAR_URL, AADE_CALENDAR_URL, INCOME_TAX_INSTALMENTS, type TaxObligation,
} from '@/lib/tax/greekTaxCalendar';
import { ENFIA_INSTALMENTS, ENFIA_MIN_INSTALMENT } from '@/lib/tools/enfiaSchedule';
import { DEADLINES_EN, obligationTitleEn } from '@/lib/i18n/en/deadlines';
import { longDateEn, dayMonthEn, monthNameEn } from '@/lib/i18n/en/dates';
import { countEn } from '@/lib/i18n/en/guides/cite';
import { publicMetadata } from '../../../publicMetadata';
import { shareImage } from '../../../og/share';
import { upcomingRows, nextOfKind } from '../../../odigos/forologikes-prothesmies-idioktiton/next';
import { GuideShellEn, type EnFaq } from '../GuideShellEn';

// ═══════════════════════════════════════════════════════════════════════════
// Ο οδηγός «Φορολογικές προθεσμίες ιδιοκτήτη» στα αγγλικά
// ─────────────────────────────────────────────────────────────────────────
// Ο πίνακας και κάθε ημερομηνία του κειμένου από το ίδιο ημερολόγιο
// (lib/tax/greekTaxCalendar.ts) και τον ίδιο ορίζοντα (../../../odigos/…/next.ts)
// με τον ελληνικό οδηγό. Οι τίτλοι ανά είδος υποχρέωσης από το
// lib/i18n/en/deadlines.ts, όχι από το ελληνικό `title`. Οι «30 ημέρες» του Ε9
// και η «20ή» του μήνα της βραχυχρόνιας ζουν μόνο μέσα στις σημειώσεις του
// ημερολογίου (προστατευμένο αρχείο) και ο ελληνικός οδηγός τις γράφει με το
// χέρι· εδώ τις ακολουθεί.
// ═══════════════════════════════════════════════════════════════════════════
const PATH = '/en/guides/greek-property-tax-calendar';
const EL = '/odigos/forologikes-prothesmies-idioktiton';
const f = fmtFor('en');

const H1 = 'Greek property tax calendar for owners';
const DESC = 'When ENFIA is paid, when form E9 is needed, when the Greek income tax return is due and what short-term rentals file every month, with sources.';

export function generateMetadata(): Metadata {
  return publicMetadata({ title: H1, description: DESC, url: siteUrl(PATH), type: 'article', image: shareImage('en-guide-tax-calendar') });
}

/** Ποιος κάνει την ενέργεια· το εκκαθαριστικό το εκδίδει η ΑΑΔΕ. */
const WHO: Record<TaxObligation['who'], string> = { owner: 'You', app: 'You', accountant: 'Your accountant' };
const whoOf = (o: TaxObligation): string => (o.kind === 'enfia-issue' ? 'AADE' : WHO[o.who]);
const month1 = (iso: string) => Number(iso.slice(5, 7));
const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** Η πρώτη και η τελευταία δόση του εκκαθαριστικού της χρονιάς, από το ημερολόγιο (όπως το ../odigos/enfiaText.ts). */
function enfiaEnds(year: number) {
  const obl = greekPropertyTaxObligations(year, 'owner');
  const first = obl.find(o => o.kind === 'enfia-first')!;
  const last = obl.find(o => o.kind === 'enfia-last')!;
  return { first, last, issued: first.confidence === 'statutory' && last.confidence === 'statutory' };
}
const enfiaRule = (year: number) =>
  `up to ${ENFIA_INSTALMENTS} monthly installments, the last one no later than ${monthNameEn(month1(enfiaEnds(year).last.date))} of the following year, as the law provides. Each installment must be at least ${f.feWhole(ENFIA_MIN_INSTALMENT)}, so a small amount means fewer installments.`;
function enfiaDates(year: number) {
  const { first, last, issued } = enfiaEnds(year);
  return issued
    ? `The exact dates are on the assessment notice; for ${year} they run from ${longDateEn(first.date)} to ${longDateEn(last.date)}.`
    : `The exact dates are on the assessment notice; for ${year} they haven’t been announced yet and, as in recent years, are expected to run from ${longDateEn(first.date)} to ${longDateEn(last.date)}.`;
}

const faqFor = (at: { autofile: string; issue: string; first: string }): EnFaq[] => [
  {
    q: 'What if a deadline falls on a weekend or a holiday?',
    a: 'It moves to the next working day. Installments due at the end of a month fall due on the last working day of that month. The dates in the table already allow for this.',
  },
  {
    q: 'When is the ENFIA assessment notice issued?',
    a: `In recent years, around the middle of ${monthNameEn(month1(at.issue))}. AADE announces the exact date each year. The tax is paid in one go or in ${enfiaRule(Number(at.first.slice(0, 4)))} ${enfiaDates(Number(at.first.slice(0, 4)))}`,
  },
  {
    q: 'Do I need to file form E9 every year?',
    a: 'No. Form E9 is filed when something changes in your property: a purchase, a sale, a parental gift, a donation, an inheritance or a legalization. The deadline is 30 days from the change. If nothing changed, you don’t file.',
  },
  {
    q: 'Will my tax return be filed automatically?',
    a: `Automatic filing mostly affects people with pre-filled income only, meaning employees and pensioners. With form E2 you usually aren’t in that group, but form E2 is now pre-filled from lease declarations and the platforms. Check your return by ${dayMonthEn(at.autofile)}.`,
  },
  {
    q: 'What deadlines does a short-term rental have?',
    a: 'Two every month. By the 20th, the short-term stay declaration for the previous month’s departures. By the end of the month, payment of the climate crisis resilience fee collected the month before.',
  },
];

const EXT = { target: '_blank', rel: 'noopener noreferrer', hrefLang: 'el', className: 'lp-link', style: { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } } as const;
const LINK = EXT.style;
const STRONG = { color: 'var(--text-primary)' } as const;

export default function Page() {
  const today = athensToday();
  const rows = upcomingRows(today);
  const nextOf = (kind: TaxObligation['kind']) => nextOfKind(rows, kind, today);
  const first = nextOf('enfia-first');
  const at = {
    issue: nextOf('enfia-issue'), first, e9: nextOf('e9'),
    autofile: nextOf('income-autofile'), decl: nextOf('income-decl'),
  };
  const firstYear = Number(at.first.date.slice(0, 4));
  // Το εκκαθαριστικό που πληρώνεται ακόμη: η επόμενη ενδιάμεση δόση του, όπως στον ελληνικό οδηγό.
  const running = rows.find(r => r.kind === 'enfia-instalment');
  const runningId = running ? /-(\d{4})-(\d{1,2})$/.exec(running.id) : null;
  const runningLast = runningId
    ? greekPropertyTaxObligations(Number(runningId[1]), 'owner').find(o => o.kind === 'enfia-last')
    : undefined;
  const ordinal = (n: number) => { const t = n % 100; return t >= 11 && t <= 13 ? `${n}th` : `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`; };
  const FAQ = faqFor({ autofile: at.autofile.date, issue: at.issue.date, first: at.first.date });

  const sections: { id: string; over: string; title: string; body: ReactNode }[] = [
    {
      id: 'next-12-months', over: '1. Calendar', title: 'The next twelve months',
      body: <>
        <div className="po-table-box gd-table gd-table-wide" style={{ marginTop: 14 }}>
          <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
            <table className="po-table" style={{ ['--tbl-min' as string]: '300px' }}>
              <caption>Tax deadlines for property owners, next twelve months</caption>
              <thead><tr><th scope="col">{DEADLINES_EN.obligation}</th><th scope="col">{DEADLINES_EN.by}</th></tr></thead>
              <tbody>
                {rows.map(o => (
                  <tr key={o.id}>
                    <th scope="row">
                      <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-primary)' }}>{obligationTitleEn(o)}</span>
                      <span style={{ display: 'block', marginTop: 2, fontSize: 13, color: 'var(--text-tertiary)' }}>
                        {`${whoOf(o)} · ${DEADLINES_EN.confidence[o.confidence]}`}
                      </span>
                    </th>
                    <td className="gd-date"><time dateTime={o.date}>{f.date(o.date)}</time></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>,
    },
    {
      id: 'enfia', over: '2. ENFIA', title: 'Assessment notice and installments',
      body: <>
        {running && runningId && runningLast && (
          <p className="lg-p">{`The ${runningId[1]} assessment is still being paid: the ${ordinal(Number(runningId[2]))} installment is due on ${longDateEn(running.date)} and the last on ${longDateEn(runningLast.date)}. Each installment is due on the last working day of its month.`}</p>
        )}
        <p className="lg-p">{`ENFIA is Greece’s annual tax on owning property. The next assessment notice is expected around ${longDateEn(at.issue.date)}. The tax is paid in one go or in ${enfiaRule(firstYear)} ${enfiaDates(firstYear)}${running ? '' : ' Each installment is due on the last working day of its month.'}`}</p>
        <p className="lg-p">The assessment is based on what you have declared on form E9. That is why the E9 check comes first in the calendar.</p>
      </>,
    },
    {
      id: 'e9', over: '3. Form E9', title: 'Only when something changes',
      body: <>
        <p className="lg-p">{`Form E9, your property register at AADE, isn’t filed every year. It is filed within 30 days of any change: a purchase, a sale, a parental gift, a donation, an inheritance or a legalization. The calendar adds one reminder to check it on the last working day of the month before ENFIA is issued (next: ${longDateEn(at.e9.date)}), so that a forgotten change is fixed before it reaches the assessment.`}</p>
      </>,
    },
    {
      id: 'tax-return', over: '4. Income tax return', title: `${monthNameEn(month1(at.autofile.date))} and ${monthNameEn(month1(at.decl.date))}`,
      body: <>
        <ul className="lg-ul">
          <li><strong style={STRONG}>{`${dayMonthEn(at.autofile.date)}:`}</strong>{' the last day to correct a pre-filled return by filing it yourself. Returns left unchanged are filed automatically by AADE the next day. This mostly affects employees and pensioners with pre-filled income only.'}</li>
          <li>{`From ${dayMonthEn(addDays(at.autofile.date, 2))} to ${dayMonthEn(at.decl.date)}: a return that was filed automatically can be corrected with an amended return, without penalties.`}</li>
          <li><strong style={STRONG}>{`${dayMonthEn(at.decl.date)}:`}</strong>{` the deadline for the income tax return (form E1). Rent is declared on form E2. Filing on time and paying in one go earns a discount on the tax, and the tax can be paid in up to ${countEn(INCOME_TAX_INSTALMENTS)} installments.`}</li>
        </ul>
        <div className="lg-note lg-note-tip" style={{ marginTop: 16 }}>{`With one rented apartment and form E2, you’re usually not in the automatic filing group. Form E2 is now pre-filled from lease declarations and the platforms, though, so checking by ${dayMonthEn(at.autofile.date)} is worth it either way.`}</div>
      </>,
    },
    {
      id: 'short-term', over: '5. Short-term rentals', title: 'Two obligations every month',
      body: <>
        <ul className="lg-ul">
          <li><strong style={STRONG}>Short-term stay declaration:</strong>{' for each month’s departures, by the 20th of the next month, in AADE’s Short-Term Rental Property Registry.'}</li>
          <li><strong style={STRONG}>Climate crisis resilience fee:</strong>{' the host collects it from the guest and pays it over every month, by the end of the month after it was collected.'}</li>
        </ul>
        <p className="lg-p">Both are deadlines set by law, moved to a working day where needed. The fee per night and the income tax on short-term rentals are in the guide <Link href="/en/guides/airbnb-tax-greece-2026" className="lp-link" style={LINK}>Airbnb tax in Greece</Link>.</p>
      </>,
    },
    {
      id: 'certainty', over: '6. Certainty', title: 'A date set by law, or last year’s',
      body: <>
        <p className="lg-p">{`Every row in the table says how certain its date is. “${DEADLINES_EN.confidence.statutory}” means a fixed deadline in the law. “${DEADLINES_EN.confidence.announced}” means AADE announces the exact date each year and the table shows where it fell last year. Confirm those on AADE’s tax calendar before you act.`}</p>
      </>,
    },
  ];

  return (
    <GuideShellEn el={EL} path={PATH} h1={H1} description={DESC} about="Tax deadlines for property owners in Greece: ENFIA, form E9, income tax return, short-term rentals"
      intro={<>
        <p className="lg-p">{`A property owner in Greece has four fixed points in the year: the ENFIA assessment notice and its installments, the check of form E9, the check of the pre-filled tax return in ${monthNameEn(month1(at.autofile.date))} and the filing of the income tax return in ${monthNameEn(month1(at.decl.date))}. If you rent out short-term, add two obligations every month.`}</p>
        <p className="lg-p">{`The table shows the next twelve months as the ${PRODUCT_NAME} calendar sees them: moved to a working day where needed, with who acts and whether the date is set by law or last year’s. Of the ENFIA installments in between, only the next one is shown. The two short-term rental obligations aren’t in the table because they repeat every month; section 5 explains them.`}</p>
        <p className="lg-p">Everything together, monthly ones included, month by month: the <Link href="/en/tax-deadlines" className="lp-link" style={LINK}>tax deadlines for property owners</Link> this month and next, from the same calendar.</p>
      </>}
      sections={sections}
      sources={[
        `ENFIA: Law 4223/2013, as in force and as codified in the Property Tax Code (Law 5219/2025). Up to ${ENFIA_INSTALMENTS} installments, each at least ${f.feWhole(ENFIA_MIN_INSTALMENT)}, under the law; AADE announces the assessment and the exact dates each year.`,
        'Form E9: a deadline of 30 days from each change, Article 6(3) of Law 4223/2013, as codified in Law 5219/2025.',
        'Income tax return (forms E1 and E2): deadlines and automatic filing of pre-filled returns as announced by AADE for each tax year.',
        'Short-term rentals: short-term stay declaration in AADE’s Short-Term Rental Property Registry · climate crisis resilience fee, Article 44 of Law 5177/2025 (formerly Article 53 of Law 4389/2016).',
        <><a href={AADE_CALENDAR_URL} {...EXT}>AADE tax calendar</a>{' · double-checked against the '}<a href={TAXHEAVEN_CALENDAR_URL} {...EXT}>Taxheaven calendar</a>{'.'}</>,
      ]}
      faq={FAQ} faqTitle="What people ask about the deadlines"
      cta={{ title: 'ENFIA on your own property', href: '/en/enfia-calculator', action: 'Estimate your ENFIA',
        body: `Before the assessment arrives, estimate ENFIA from your property’s zone price, floor area and floor. In the ${PRODUCT_NAME} dashboard, the deadlines on this page go into each property’s calendar.` }} />
  );
}
