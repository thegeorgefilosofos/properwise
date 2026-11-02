import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { siteUrl } from '@/lib/core/site';
import { fmtFor } from '@/lib/core/format';
import {
  CLIMATE_LEVY_FROM_2025, FIRST_YEAR_CURRENT_LEVY, MUNICIPAL_ACCOM_TAX_RATE, STR_INDIVIDUAL_MAX_PROPERTIES,
  FIRST_YEAR_NEW_BRACKETS, FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT, rentalBracketsForYear,
} from '@/lib/billing/greekTax';
import { PRESUMPTIVE_DEDUCTION_RATE } from '@/lib/billing/presumptive';
import {
  CLIMATE_LEVY_CATEGORIES, CLIMATE_LEVY_AREA_SQM, MUNICIPAL_ACCOM_TAX_MAX_RATE, type ClimateLevyCategory,
} from '@/lib/billing/climateLevyCategories';
import { AADE_DESTINATIONS } from '@/lib/tax/aade';
import { taxLimitAsOf } from '@/lib/facts/taxLimits';
import { THESS_STR_FREEZE as THESS, ATHENS_STR_FREEZE as ATHENS } from '@/lib/market/greekMarket';
import { gazetteEn, lawEn, kyaEn, articleEn, countEn } from '@/lib/i18n/en/guides/cite';
import { publicMetadata } from '../../../publicMetadata';
import { shareImage } from '../../../og/share';
import { GuideTable } from '../../../odigos/GuideParts';
import { LAW_5222_PDF } from '../../../odigos/fek';
import {
  EXAMPLE_SQM, APARTMENT, LARGE_HOUSE, SPLIT_STAY, SPLIT_APARTMENT, SPLIT_LARGE_HOUSE,
  YEAR_NIGHTS, yearLevy, INCOME_EXAMPLE,
} from '../../../odigos/airbnb-takk-2026/examples';
import { GuideShellEn, type EnFaq } from '../GuideShellEn';

// Ο οδηγός «Φορολογία Airbnb 2026» στα αγγλικά. Ιδια ποσά, ίδια παραδείγματα
// (app/odigos/airbnb-takk-2026/examples.ts) και ίδιες παραπομπές με τον
// ελληνικό· οι διαδρομές του myAADE μένουν με τα ελληνικά ονόματα των μενού,
// όπως τα βλέπει ο χρήστης στην οθόνη.
const PATH = '/en/guides/airbnb-tax-greece-2026';
const EL = '/odigos/airbnb-takk-2026';
const f = fmtFor('en');
const eur = (n: number) => (Number.isInteger(n) ? f.feWhole(n) : f.fe(n));
const pct = (rate: number) => f.fpRate(rate * 100);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
const dayMonth = (iso: string) => { const [, m, d] = iso.split('-').map(Number); return `${MONTHS[m - 1].slice(0, 3)} ${d}`; };

const SQM = CLIMATE_LEVY_AREA_SQM;
const SMALL = CLIMATE_LEVY_FROM_2025.small;
const LARGE = CLIMATE_LEVY_FROM_2025.large;
const rates = (id: ClimateLevyCategory) => CLIMATE_LEVY_CATEGORIES.find(c => c.id === id)!.rates;
const TOURIST_SMALL = rates('tourist-small');
const TOURIST_LARGE = rates('tourist-large');
const BRACKETS = rentalBracketsForYear(FIRST_YEAR_NEW_BRACKETS);
const TOP = BRACKETS[BRACKETS.length - 1];
const SCALE_SHORT = `${BRACKETS.map(b => f.fn(b.rate * 100)).join(' / ')}%`;
const SCALE_LONG = BRACKETS
  .map(b => (b.to === Infinity ? `${pct(b.rate)} above ${eur(b.from)}` : `${pct(b.rate)} up to ${eur(b.to)}`)).join(' / ');
const DEDUCTION = pct(PRESUMPTIVE_DEDUCTION_RATE);
const LEVY_FROM = f.date(`${FIRST_YEAR_CURRENT_LEVY}-01-01`);
const BANK_FROM = f.date(`${FIRST_YEAR_BANK_RECEIPT}-${String(FIRST_MONTH_BANK_RECEIPT).padStart(2, '0')}-01`);
const RESIDENT_FEE = pct(MUNICIPAL_ACCOM_TAX_RATE);
const MAX = `up to ${countEn(STR_INDIVIDUAL_MAX_PROPERTIES)} properties`;
const BUSINESS = `${countEn(STR_INDIVIDUAL_MAX_PROPERTIES + 1)} or more properties`;
const ATHENS_AREA = 'the 1st, 2nd and 3rd municipal districts of Athens';
const THESS_AREA = 'the 1st Municipal Community of Thessaloniki';
const [OCT, NOV] = SPLIT_APARTMENT.months;
const [OCT_H, NOV_H] = SPLIT_LARGE_HOUSE.months;
const YEAR_APT = yearLevy(APARTMENT);
const YEAR_HOUSE = yearLevy(LARGE_HOUSE);
const CLIMATE_STEPS = AADE_DESTINATIONS['climate-fee'].steps.map(s => `“${s}”`).join(' › ');
const REGISTRY = AADE_DESTINATIONS['str-registry'];
/** Πότε ελέγχθηκαν τα ποσά του τέλους, από το μητρώο ισχύος (ίδια πηγή με τους υπολογιστές). */
const LEVY_ASOF = taxLimitAsOf('short');

const LEVY_LABEL: Record<ClimateLevyCategory, string> = {
  'str-small': `Short-term rental apartment (any size) or detached house up to ${SQM} m²`,
  'str-house-large': `Short-term rental detached house over ${SQM} m²`,
  'tourist-small': `Furnished tourist residence under ${SQM} m²`,
  'tourist-large': `Furnished tourist residence of ${SQM} m² or more`,
  'tourist-villa': 'Furnished tourist villa',
  'furnished-rooms': 'Furnished rooms and apartments to let',
};

const H1 = `Airbnb tax in Greece in ${FIRST_YEAR_NEW_BRACKETS}: the climate resilience fee, income tax and local fees`;
const DESC = 'How much the climate resilience fee is per night in 2026, what changes on November 1, how it is filed on myAADE and how Airbnb income is taxed in Greece.';

export function generateMetadata(): Metadata {
  return publicMetadata({ title: `Greek climate resilience fee on Airbnb in ${FIRST_YEAR_NEW_BRACKETS}: amounts, filing, tax`, description: DESC, url: siteUrl(PATH), type: 'article', image: shareImage('en-guide-airbnb-tax') });
}

const FAQ: EnFaq[] = [
  { q: 'Who pays the climate resilience fee?', a: 'The guest, per night. The host is responsible for collecting it and paying it over to AADE every month. If you charge it to the guest, it is not your cost; it becomes one only if you don’t collect it.' },
  { q: 'How much is the fee per night?', a: `For a short-term rental apartment (any size) or a detached house up to ${SQM} m²: ${eur(SMALL.high)} in the high season (April to October) and ${eur(SMALL.low)} in the low season (November to March). For detached houses over ${SQM} m²: ${eur(LARGE.high)} and ${eur(LARGE.low)}. A ${EXAMPLE_SQM} m² apartment pays ${eur(APARTMENT.high)} / ${eur(APARTMENT.low)}.` },
  { q: 'Do I owe the municipal visitor fee?', a: `The municipal visitor fee is ${RESIDENT_FEE} of the rent (Article 30, Law 5143/2024); according to AADE’s short-term rental FAQ it is charged on the net rent, before VAT and the climate fee. According to the same FAQ (Q. 26), an individual with ${MAX} and no registered business doesn’t owe it; the law itself doesn’t state this exemption.` },
  { q: 'Do I need to charge VAT?', a: `No, if you only let the property (property income with the ${DEDUCTION} standard deduction). If you provide any service beyond bed linen (such as cleaning during the stay, breakfast or a reception), the activity counts as a business, is subject to VAT and loses the standard deduction. Your accountant decides this.` },
  { q: 'Do I need a property registry number (AMA)?', a: `Yes. Every short-term rental is registered in AADE’s Short-Term Rental Property Registry, and the registry number (AMA) must appear in every listing (Airbnb, Booking). In ${ATHENS_AREA}, no new AMA numbers are issued until ${f.date(ATHENS.to)}. The same applies in ${THESS_AREA} from ${f.date(THESS.from)} to ${f.date(THESS.to)}.` },
  { q: 'How is short-term rental income taxed?', a: `Without services, on the same progressive rental brackets (${SCALE_SHORT}) from tax year ${FIRST_YEAR_NEW_BRACKETS}, after a ${DEDUCTION} standard deduction. The climate fee and the visitor fee are separate from income tax.` },
  { q: 'How much is the fee from November 1, 2026?', a: `From November 1 through March the low rate applies: ${eur(SMALL.low)} per night for a short-term rental apartment (${eur(LARGE.low)} for a detached house over ${SQM} m²). From April 1 through October the high rate applies (${eur(SMALL.high)} / ${eur(LARGE.high)}).` },
  { q: 'A stay from October into November: how many receipts?', a: `Two special receipts, one per month, when the stay covers months with different rates; not one at departure. For a stay from ${dayMonth(SPLIT_STAY.arrival)} to ${dayMonth(SPLIT_STAY.departure)} (${OCT.nights}+${NOV.nights} nights) the total is ${eur(SPLIT_APARTMENT.total)} for an apartment or ${eur(SPLIT_LARGE_HOUSE.total)} for a detached house over ${SQM} m². Each month goes into its own monthly return.` },
  { q: 'Do I file a return for a month with no bookings?', a: 'No. There is no nil return when there were no stays and no special receipts were issued for the month.' },
];

const P = { color: 'var(--text-primary)' } as const;

/** Πίνακας πολλών στηλών, ίδια σήμανση με τον ελληνικό οδηγό (.po-table, αριθμοί δεξιά). */
function Table({ caption, head, rows, min }: { caption: string; head: readonly string[]; rows: readonly (readonly string[])[]; min: string }) {
  return (
    <div className="po-table-box" style={{ marginTop: 14 }}>
      <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
        <table className="po-table" style={{ '--tbl-min': min } as CSSProperties}>
          <caption>{caption}</caption>
          <thead><tr>{head.map((h, i) => <th key={h} scope="col" className={i ? 'num' : undefined}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r[0]}>
                <th scope="row">{r[0]}</th>
                {r.slice(1).map((c, i) => <td key={i} className="num">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
const H3: CSSProperties = { fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)', margin: '22px 0 6px' };
const EXT = { target: '_blank', rel: 'noopener noreferrer', className: 'lp-link', style: { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } } as const;

export default function Page() {
  const sections = [
    {
      id: 'fee', over: '1. The amounts', title: 'Climate resilience fee 2026: how much per night',
      body: <>
        <p className="lg-p">{`The climate crisis resilience fee is charged per night and per room or apartment. AADE’s FAQ on the monthly return note that it replaced the old overnight-stay tax. The current amounts (from ${LEVY_FROM}) were set by Article 24 of Law 5162/2024 and are codified in Article 44 of Law 5177/2025 (A 21); they apply under Decision A.1202/2024 (Government Gazette B 7301/31.12.2024).`}</p>
        <Table caption="High season (Apr–Oct) and low season (Nov–Mar) rates" head={['Type (short-term and similar)', 'Apr – Oct', 'Nov – Mar']} min="300px"
          rows={CLIMATE_LEVY_CATEGORIES.map(c => [LEVY_LABEL[c.id], eur(c.rates.high), eur(c.rates.low)])} />
        <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>
          {`Rates checked ${f.date(LEVY_ASOF.checkedAt)} in the app’s validity register, against the law and AADE`}
          {LEVY_ASOF.url && <>{' · '}<a href={LEVY_ASOF.url} {...EXT}>source</a></>}.
        </p>
        <p className="lg-p" style={{ marginTop: 14 }}>{`For an Airbnb host the first two rows are what matter: ${eur(SMALL.high)} / ${eur(SMALL.low)}, unless the property is a detached house over ${SQM} m².`}</p>
        <h3 style={H3}>{`A ${EXAMPLE_SQM} m² apartment or a ${EXAMPLE_SQM} m² house: which one pays ${eur(LARGE_HOUSE.high)}`}</h3>
        <p className="lg-p">{`Decision A.1202/2024 and Article 44 of Law 5177/2025 (the codified former Article 53 after Article 24 of Law 5162/2024) say that short-term rentals that “are detached houses over eighty (${SQM}) m²” pay ${eur(LARGE.high)} (high season) / ${eur(LARGE.low)} (low season). An apartment pays ${eur(SMALL.high)} / ${eur(SMALL.low)} whatever its size.`}</p>
        <h3 style={H3}>Furnished tourist residences</h3>
        <p className="lg-p">{`Furnished tourist residences are a separate category: ${eur(TOURIST_SMALL.high)} under ${SQM} m² and ${eur(TOURIST_LARGE.high)} from ${SQM} m² up in the high season (${eur(TOURIST_SMALL.low)} / ${eur(TOURIST_LARGE.low)} in the low season). Here the higher rate starts at ${SQM} m²; for a short-term rental house, only above ${SQM} m². Don’t confuse them with a short-term rental apartment.`}</p>
      </>,
    },
    {
      id: 'november', over: '2. From November 1', title: 'What changes on November 1: stays that run from October into November',
      body: <>
        <p className="lg-p">From November 1 through March the low rate applies. When a stay covers months with different rates, the special receipt is issued separately for each month, not at departure (AADE FAQ, Q. 7; Decision A.1202/2024).</p>
        <p className="lg-p">{`Example: a ${OCT.nights + NOV.nights}-night booking, arriving ${dayMonth(SPLIT_STAY.arrival)} and leaving ${dayMonth(SPLIT_STAY.departure)}: ${OCT.nights} nights in ${MONTHS[OCT.month0]} (${OCT.firstNight}–${OCT.lastNight}) and ${NOV.nights} in ${MONTHS[NOV.month0]} (${NOV.firstNight}–${NOV.lastNight}). Two special receipts, one per month.`}</p>
        <Table caption={`Stay ${dayMonth(SPLIT_STAY.arrival)}–${dayMonth(SPLIT_STAY.departure)}, one receipt per month`} min="600px"
          head={['Type', `${MONTHS[OCT.month0].slice(0, 3)} · ${OCT.nights} ${OCT.nights === 1 ? 'night' : 'nights'}`, `${MONTHS[NOV.month0].slice(0, 3)} · ${NOV.nights} ${NOV.nights === 1 ? 'night' : 'nights'}`, 'Total']}
          rows={([
            ['Short-term rental apartment (any size)', OCT, NOV, SPLIT_APARTMENT.total],
            [`Detached house over ${SQM} m²`, OCT_H, NOV_H, SPLIT_LARGE_HOUSE.total],
          ] as const).map(([label, a, b, total]) => [label, `${a.nights} × ${eur(a.rate)} = ${eur(a.levy)}`, `${b.nights} × ${eur(b.rate)} = ${eur(b.levy)}`, eur(total)])} />
        <p className="lg-p" style={{ marginTop: 14 }}>{`Two monthly returns: for ${MONTHS[OCT.month0]} receipts by ${f.date(OCT.deadline)}, for ${MONTHS[NOV.month0]} receipts by ${f.date(NOV.deadline)}. The deadline follows the month the receipt was issued, not the month the platform “closes” the booking.`}</p>
      </>,
    },
    {
      id: 'who-pays', over: '3. Who pays', title: 'Who pays the fee and who pays it over',
      body: <>
        <p className="lg-p">The fee is borne by the guest. The landlord collects it with the special receipt and pays it over to the tax authority in monthly returns (Decision A.1202/2024, para. 2).</p>
        <p className="lg-p">{`Individuals with no obligation to register a business, letting ${MAX}, file under the category “short-term rental properties”. In the field for the number of businesses they enter 0 (AADE FAQ, Q. 11).`}</p>
      </>,
    },
    {
      id: 'filing', over: '4. The return', title: 'How to file the climate fee return on myAADE, step by step',
      body: <>
        <ol className="lg-ul">
          <li>{`Sign in to myAADE, AADE’s online portal, and follow the menus ${CLIMATE_STEPS} (FAQ, Q. 11).`}</li>
          <li>Choose the reference year and tax period (month), then the property category (for you: short-term rental).</li>
          <li>Enter total nights, free nights and taxable nights. Free stays carry no fee and are subtracted from taxable nights (FAQ, Q. 11).</li>
          <li>You can save a draft and finalize it later (FAQ, Q. 10).</li>
          <li>Deadline: the last day of the month after the month the special receipt was issued (FAQ, Q. 7; AADE service page).</li>
          <li>Nil return: not needed for a month with no stays and no special receipts (FAQ, Q. 12).</li>
          <li>Once finalized, you can’t correct it in the same application; changes go only through a request in the “My Requests” application (FAQ, Q. 3–4).</li>
          <li>On final submission the return counts as received; payment is by payment ID. If the due date passes without payment, Articles 52 and 53 of Law 5104/2024 apply (FAQ, Q. 6).</li>
          <li>Under the short-term category you also enter the number of rooms or apartments available, beds where asked, and the rooms used during the month (FAQ, Q. 11).</li>
        </ol>
        <p className="lg-p" style={{ marginTop: 14 }}>Initial returns, on time or late, must be filed electronically (FAQ, Q. 8). Late initial returns for periods from 01.01.2024 onward go through the same application (FAQ, Q. 2).</p>
      </>,
    },
    {
      id: 'receipt', over: '5. The receipt', title: 'The special climate fee receipt and myDATA',
      body: <>
        <p className="lg-p">The official title is “Special Receipt – Proof of Collection of the Climate Crisis Resilience Fee”. It is issued to the guest at the end of the stay, before departure; when the rate changes, it is issued separately for each month.</p>
        <p className="lg-p">According to AADE’s short-term rental FAQ (Q. 21), short-term rental income is the agreed rent (or the amount kept under a cancellation policy); it includes neither VAT, the visitor fee nor the climate fee.</p>
        <p className="lg-p">{`On myDATA (AADE’s e-invoicing platform): the same FAQ (Q. 16) tie bookkeeping and myDATA obligations to individuals who registered a business because of short-term rentals (${BUSINESS}) and to legal entities. If you have ${MAX} and no registered business, ask your accountant what applies to you before assuming you must transmit documents to myDATA.`}</p>
      </>,
    },
    {
      id: 'example', over: '6. Example', title: 'What the climate fee adds up to over a year',
      body: <>
        <p className="lg-p">{`An apartment with ${YEAR_NIGHTS.high} nights in the high season and ${YEAR_NIGHTS.low} in the low season:`}</p>
        <GuideTable caption="Apartment, one year" head={['Calculation', 'Amount']} min="260px" rows={[
          [`${YEAR_NIGHTS.high} × ${eur(APARTMENT.high)}`, eur(YEAR_APT.high)],
          [`${YEAR_NIGHTS.low} × ${eur(APARTMENT.low)}`, eur(YEAR_APT.low)],
          ['Total climate fee', eur(YEAR_APT.total)],
        ]} />
        <p className="lg-p" style={{ marginTop: 14 }}>{`The same use in a detached house over ${SQM} m²: ${YEAR_NIGHTS.high} × ${eur(LARGE_HOUSE.high)} + ${YEAR_NIGHTS.low} × ${eur(LARGE_HOUSE.low)} = ${eur(YEAR_HOUSE.total)}.`}</p>
        <p className="lg-p">If you charge the fee to the guest, it doesn’t reduce your net income, but it raises the final price the guest sees.</p>
      </>,
    },
    {
      id: 'visitor-fee', over: '7. The municipal fee', title: `Municipal visitor fee of ${RESIDENT_FEE}`,
      body: <p className="lg-p">{`The visitor accommodation fee is ${RESIDENT_FEE} of the short-term rent for stays under six months (Article 30, Law 5143/2024); a municipal council decision can raise it to ${pct(MUNICIPAL_ACCOM_TAX_MAX_RATE)}. The guest bears it; the landlord collects it and pays it over to the municipality. According to AADE’s short-term rental FAQ (23.09.2025, Q. 27 and 59) it is charged on the net rent, before VAT and the climate fee. According to the same FAQ (Q. 26) it is owed only by those who registered a business (owners of ${BUSINESS}, legal entities and those who provide services); an individual with ${MAX} and no registered business doesn’t owe it. The law itself doesn’t state this exemption.`}</p>,
    },
    {
      id: 'income-tax', over: '8. The tax', title: `Income tax on Airbnb income in ${FIRST_YEAR_NEW_BRACKETS} and VAT`,
      body: <>
        <p className="lg-p">{`If you are an individual with ${MAX} and provide no service beyond bed linen, short-term rental income is property income (Article 39A of the Income Tax Code). From tax year ${FIRST_YEAR_NEW_BRACKETS} it is taxed at ${SCALE_LONG} (Article 40(4) of the Income Tax Code, as replaced by Article 8 of Law 5246/2025), after the ${DEDUCTION} standard deduction (Article 39(3)(a) of the Income Tax Code). With ${BUSINESS}, or as a legal entity, the income is business income (Article 39A of the Income Tax Code; see also AADE’s short-term rental FAQ of 23.09.2025, Q. 8–9). From ${BANK_FROM} the ${DEDUCTION} deduction is allowed only if the rent is paid into a bank account of yours declared to AADE (Article 39(5) of the Income Tax Code, Article 210 of Law 5222/2025; Decision A.1187/2026).`}</p>
        <p className="lg-p">{`Example (an individual with ${MAX}, no services, property income only): gross rent ${eur(INCOME_EXAMPLE.gross)} (excluding the climate fee), less ${DEDUCTION}, taxable ${eur(INCOME_EXAMPLE.taxable)}, tax for ${INCOME_EXAMPLE.year}: ${f.fn(INCOME_EXAMPLE.taxable)} × ${pct(INCOME_EXAMPLE.rate)} = ${eur(INCOME_EXAMPLE.tax)}. The example assumes you pay expenses by the electronic means Article 15(6) of the Income Tax Code requires.`}</p>
        <div className="lg-note lg-note-tip" style={{ marginTop: 16 }}>{`Watch the services: if you provide any service beyond bed linen (such as cleaning during the stay, breakfast or a reception), the activity counts as a business (Article 39A of the Income Tax Code), needs a business registration and is subject to VAT; the ${DEDUCTION} standard deduction no longer applies. Your accountant decides the distinction and the VAT rate.`}</div>
      </>,
    },
    {
      id: 'compare', over: '9. Comparison', title: 'Short-term or long-term: what each leaves you with, fee included',
      body: <p className="lg-p">The climate fee changes the cost of short-term against long-term letting, even if you charge it to the guest: it raises the final price and affects the occupancy you need for it to pay off. To see the order of magnitude with your own figures, <Link href="/en/short-term-vs-long-term-rental" className="lp-link" style={EXT.style}>compare short-term and long-term rental</Link>: occupancy, price and fees go into the same calculation.</p>,
    },
    {
      id: 'ama', over: '10. Registry', title: 'The AMA registry number: before you list',
      body: <>
        <p className="lg-p">Every short-term rental is registered in AADE’s Short-Term Rental Property Registry and receives a property registry number (AMA), which must appear in every listing, on Airbnb, Booking or any other platform. Registration is on <a href={REGISTRY.url} {...EXT}>{REGISTRY.portal}</a>{`, under ${REGISTRY.steps.map(s => `“${s}”`).join(' › ')}.`}</p>
        <div className="lg-note lg-note-tip" style={{ marginTop: 16 }}>{`In ${ATHENS_AREA}, no new AMA numbers are issued until ${f.date(ATHENS.to)} (extended by ${kyaEn(ATHENS.extension)}). In ${THESS_AREA} a similar freeze applies from ${f.date(THESS.from)} to ${f.date(THESS.to)}. In these zones, deregistration on a transfer between living persons (for value or as a gift) rules out re-registration while the restriction lasts; inheritance is not covered by that deregistration. Every short-term rental must also meet safety requirements, such as a fire extinguisher, a smoke detector and a first-aid kit, with fines if they are missing. Whether your property can be registered, and exactly what it needs, is something to check with your accountant before you list.`}</div>
      </>,
    },
  ];
  return (
    <GuideShellEn el={EL} path={PATH} h1={H1} description={DESC} about="Taxation of short-term rentals and the climate crisis resilience fee in Greece"
      intro={<>
        <p className="lg-p">Short-term rentals (Airbnb, Booking) in Greece are not taxed exactly like a classic lease. Income, when no services are provided, falls into the same brackets as rent; on top come the climate crisis resilience fee and, for some hosts, the municipal visitor fee. AADE is the Greek tax authority.</p>
        <div className="lg-note lg-note-tip" style={{ marginTop: 16 }}>
          <strong style={P}>At a glance</strong>
          <ul className="lg-ul" style={{ marginTop: 8 }}>
            <li>{`Short-term rental rates from ${LEVY_FROM}: ${eur(SMALL.high)} (Apr–Oct) and ${eur(SMALL.low)} (Nov–Mar) for an apartment of any size or a detached house up to ${SQM} m²; ${eur(LARGE.high)} and ${eur(LARGE.low)} only for a detached house over ${SQM} m².`}</li>
            <li>Who pays: the guest; you collect it and pay it over.</li>
            <li>Return on myAADE: by the last day of the month after the month the special receipt was issued.</li>
            <li>{`From November 1: the rate drops to ${eur(SMALL.low)} (or ${eur(LARGE.low)} for a detached house over ${SQM} m²); a stay that spans months needs a separate receipt per month.`}</li>
            <li>{`Income tax (individual, ${MAX}, no services): from tax year ${FIRST_YEAR_NEW_BRACKETS}, the rental brackets ${SCALE_SHORT} (${pct(TOP.rate)} above ${eur(TOP.from)}) after the ${DEDUCTION} standard deduction.`}</li>
          </ul>
        </div>
      </>}
      sections={sections}
      sources={[
        <>{'Climate crisis resilience fee: Article 44 of Law 5177/2025 (Government Gazette A 21/14.02.2025); formerly Article 53 of Law 4389/2016 as replaced by Article 30 of Law 5073/2023 (Government Gazette A 204/11.12.2023) and amended by Article 24 of Law 5162/2024 (Government Gazette A 198/05.12.2024); codified in Article 44 with Article 53 repealed (Article 63 of Law 5177/2025). Return and special receipt procedure: Decision A.1217/2023 as amended by A.1202/2024 (Government Gazette B 7301/31.12.2024). Return FAQ: PDF, Jan. 2026 · '}<a href={AADE_DESTINATIONS['climate-fee'].url} {...EXT}>service page on myAADE</a>.</>,
        `Municipal visitor fee: Article 30 of Law 5143/2024 (Government Gazette A 161/11.10.2024); see also Article 111(5A) of Law 4446/2016; procedure: Joint Ministerial Decision 16405/2025 (Government Gazette B 1491/31.03.2025); exemption for individuals with ${MAX}: only in AADE’s short-term rental FAQ (Q. 26; basis of calculation Q. 27), not in the law.`,
        <>{`Income tax: Article 39A of the Income Tax Code (Article 27 of Law 5073/2023); brackets of Article 40(4) of the Income Tax Code from tax year ${FIRST_YEAR_NEW_BRACKETS} (Article 8 of Law 5246/2025); standard deduction ${DEDUCTION} (Article 39(3)(a) of the Income Tax Code); the bank-payment condition (Article 39(5) of the Income Tax Code, added by Article 210 of Law 5222/2025, Government Gazette A 134/28.07.2025) starts on ${BANK_FROM}: the start was set by Article 129(1) of Law 5264/2025 and moved by Article 48 of Law 5294/2026 and Decision A.1187/2026 (Government Gazette B 5590/17.09.2026); `}<a href={LAW_5222_PDF} {...EXT}>official PDF of Law 5222/2025</a>.</>,
        `AMA in listings: Article 111 of Law 4446/2016; Circular POL.1187/2017. Athens freeze, 1st–3rd municipal districts, until ${f.date(ATHENS.to)}: Article 111(2A) as added by Article 29(1) of Law 5162/2024; extended by ${kyaEn(ATHENS.extension)} (${gazetteEn(ATHENS.fek)}). Thessaloniki freeze ${f.date(THESS.from)}–${f.date(THESS.to)}: Article 111(2B). Deregistration in zones 2A/2B only on a transfer between living persons: Article 111(2C). Paragraphs 2B and 2C were added by ${articleEn(THESS.article)} of ${lawEn(THESS.law)} (${gazetteEn(THESS.fek)}). Safety requirements: Article 3 of Law 5170/2025 (Government Gazette A 6/20.01.2025) from 01.10.2025.`,
      ]}
      faq={FAQ} faqTitle="What hosts ask before they list"
      cta={{ title: 'Short-term or long-term?', href: '/en/short-term-vs-long-term-rental', action: 'Compare the two',
        body: 'The comparison shows from what occupancy short-term letting pays off, with the climate fee and other fees in the calculation. If you only want the income tax, use the rental income tax calculator.' }} />
  );
}
