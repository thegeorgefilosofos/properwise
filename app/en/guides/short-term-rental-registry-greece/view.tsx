import type { Metadata } from 'next';
import { siteUrl } from '@/lib/core/site';
import { fmtFor } from '@/lib/core/format';
import { GOV_SHORT_TERM } from '@/lib/tax/aade';
import { THESS_STR_FREEZE as THESS, ATHENS_STR_FREEZE as ATHENS } from '@/lib/market/greekMarket';
import { STR_SPECS_FEK, STR_SPECS_FROM } from '@/lib/accounting/strSpecs';
import { gazetteEn, lawEn, kyaEn, articleEn } from '@/lib/i18n/en/guides/cite';
import { publicMetadata } from '../../../publicMetadata';
import { shareImage } from '../../../og/share';
import { GuideShellEn, type EnFaq } from '../GuideShellEn';

// Ο οδηγός «Βραχυχρόνια 2026: ΑΜΑ και προδιαγραφές» στα αγγλικά. Ημερομηνίες,
// ζώνες και παραπομπές από τις ίδιες σταθερές με τον ελληνικό
// (lib/market/greekMarket.ts, lib/accounting/strSpecs.ts).
const PATH = '/en/guides/short-term-rental-registry-greece';
const EL = '/odigos/vraxyxronia-ama-prodiagrafes-2026';
const TAX_GUIDE = '/en/guides/airbnb-tax-greece-2026';
const f = fmtFor('en');

// ΤΑ ΠΡΟΣΤΙΜΑ ΔΕΝ ΕΧΟΥΝ ΣΤΑΘΕΡΑ ΣΤΟ lib. Ο ελληνικός οδηγός τα γράφει στο
// κείμενο («5.000€», «50%»), από τα άρθρα που παραθέτει: 111 παρ. 5 περ. α΄
// ν.4446/2016 και άρθρο 3 παρ. 5–6 ν.5170/2025. Εδώ τα ίδια ποσά, μία φορά.
const MIN_FINE = 5_000;
const GROSS_SHARE = 50;
const FINE = f.feWhole(MIN_FINE);
const SHARE = f.fpRate(GROSS_SHARE);

/** «01/10/2025» (όπως το δίνει το strSpecs) → «1 Oct 2025». */
const fromGreekDate = (d: string) => { const [dd, mm, yyyy] = d.split('/'); return f.date(`${yyyy}-${mm}-${dd}`); };
const SPECS_FROM = fromGreekDate(STR_SPECS_FROM);
const ATHENS_AREA = 'the 1st, 2nd and 3rd municipal districts of Athens';
const THESS_AREA = 'the 1st Municipal Community of Thessaloniki';
const ATHENS_TO = f.date(ATHENS.to);
const THESS_FROM = f.date(THESS.from);
const THESS_TO = f.date(THESS.to);
const THESS_BASIS = `as added by ${articleEn(THESS.article)} of ${lawEn(THESS.law)} (${gazetteEn(THESS.fek)})`;

const H1 = 'Short-term rentals in Greece, 2026: the AMA registry number and safety requirements';
const DESC = 'Greek short-term rentals in 2026: the freeze on new AMA numbers in central Athens, why the AMA doesn’t transfer, safety requirements and fines.';

export function generateMetadata(): Metadata {
  return publicMetadata({ title: 'Greek short-term rental registry (AMA) and requirements, 2026', description: DESC, url: siteUrl(PATH), type: 'article', image: shareImage('en-guide-str-registry') });
}

const FAQ: EnFaq[] = [
  { q: 'I’m buying an apartment with an AMA in central Athens. Can I keep letting it short-term?', a: `Not with the seller’s AMA. In ${ATHENS_AREA}, where new registrations are frozen until ${ATHENS_TO}, a sale removes the property from the registry, and the new owner can’t register it again while the freeze lasts.` },
  { q: 'Does the same apply to a gift or an inheritance?', a: 'To a gift, yes: it is a transfer between living persons, like a sale. In the freeze zones the property is removed from the registry and the recipient can’t register it again while the restriction lasts. Inheritance is not covered by that removal. For your own case, ask your accountant or notary.' },
  { q: 'Is having an AMA enough, or must it appear in the listing?', a: `It must appear in every listing, on Airbnb, Booking or any other platform. Not showing the AMA is penalized like not registering: a fine of ${SHARE} of the year’s gross income, at least ${FINE}, doubled for a new violation within a year of the fine being imposed.` },
  { q: 'What is the fine for a missing safety requirement?', a: `${FINE}. If a new inspection within a year of the fine being served finds another violation, the fine doubles; for each further identical violation it quadruples.` },
  { q: 'What do I file every month?', a: 'The Short-Term Stay Declaration for the previous month’s departures, by the 20th. You also pay over to AADE the climate crisis resilience fee you collected, by the end of the following month.' },
];

const P = { color: 'var(--text-primary)' } as const;
const LINK = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } as const;
const taxGuide = <a href={TAX_GUIDE} className="lp-link" style={LINK}>Airbnb tax in Greece</a>;

export default function Page() {
  const sections = [
    {
      id: 'registry', over: '1. The registry', title: 'The Short-Term Rental Registry and the AMA number',
      body: <>
        <p className="lg-p">Every property let short-term is registered in AADE’s Short-Term Rental Property Registry and receives a property registry number (AMA). The property’s manager registers it, separately for each property, online on myAADE (AADE’s portal).</p>
        <p className="lg-p">Registering is not enough. The AMA must appear prominently in every listing of the property, on Airbnb, Booking or any other platform, and in any other advertising. The current obligations are collected on the <a href={GOV_SHORT_TERM} target="_blank" rel="noopener noreferrer" className="lp-link" style={LINK}>short-term rental page on gov.gr</a>.</p>
      </>,
    },
    {
      id: 'freeze', over: '2. Athens and Thessaloniki', title: `Freeze on new registrations until the end of ${ATHENS.to.slice(0, 4)}`,
      body: <>
        <p className="lg-p">{`In ${ATHENS_AREA}, new registrations are frozen until ${ATHENS_TO}. No new AMA is issued there. The measure was introduced by Law 5162/2024 and extended by ${kyaEn(ATHENS.extension)}.`}</p>
        <p className="lg-p">{`In ${THESS_AREA} a similar freeze applies: from ${THESS_FROM} to ${THESS_TO} no property can be registered there for the first time. The measure was introduced by ${lawEn(THESS.law)}.`}</p>
        <p className="lg-p">Before a new registration or a purchase, check which municipal district the property belongs to. The freeze covers new registrations; what happens to a property that already has an AMA when it changes owner is explained in the next section.</p>
      </>,
    },
    {
      id: 'transfer', over: '3. Before you buy', title: 'Why the AMA doesn’t transfer',
      body: <>
        <p className="lg-p">The AMA does not pass to a new owner with the property. The registration is made by the property’s manager, so a new owner who wants to keep letting short-term needs a registration of their own. In the freeze zones the law goes further: on a sale or a gift, that is, a transfer between living persons, the property is removed from the registry and a new registration is not allowed while the restriction lasts. Inheritance is not covered by that removal.</p>
        <div className="lg-note lg-note-tip" style={{ marginTop: 16 }}>{`For buyers: if you buy in central Athens or in ${THESS_AREA} counting on short-term rental income, the seller’s AMA doesn’t pass to you and you can’t register again while the freeze lasts (in Athens until ${ATHENS_TO}, in Thessaloniki until ${THESS_TO}). “Has an AMA” in a sale listing gives you no right to short-term letting. Check the zone before you commit.`}</div>
      </>,
    },
    {
      id: 'requirements', over: '4. Suitability', title: 'What the property must have',
      body: <>
        <p className="lg-p">Every short-term rental must meet suitability requirements. It must have:</p>
        <ul className="lg-ul">
          <li>Main living spaces with natural light, ventilation and air conditioning.</li>
          <li>Civil liability insurance.</li>
          <li>An electrician’s certificate and a residual-current device (RCD).</li>
          <li>Fire safety: extinguishers, smoke detectors and exit signs.</li>
          <li>A pest-control and disinfestation certificate.</li>
          <li>A first-aid kit and a guide with emergency phone numbers.</li>
        </ul>
        <p className="lg-p">{`All of the above apply from ${SPECS_FROM}, under Article 3 of Law 5170/2025 (cases a to d). Details are set out in Ministry of Tourism circular 19567/25.09.2025. Compliance is inspected on site by Ministry of Tourism staff, who notify the manager at least ten days ahead.`}</p>
      </>,
    },
    {
      id: 'fines', over: '5. Penalties', title: 'The fines',
      body: <>
        <ul className="lg-ul">
          <li><strong style={P}>Not registering, or not showing the AMA in the listing:</strong>{` a fine of ${SHARE} of the year’s gross income, at least ${FINE}. It doubles for a new violation within a year of the fine being imposed.`}</li>
          <li><strong style={P}>Breaching the suitability requirements, or refusing entry for an inspection:</strong>{` a fine of ${FINE}. It doubles for a new violation within a year of the fine being served, and quadruples for each further identical violation.`}</li>
        </ul>
        <p className="lg-p">{`The ${SHARE} fine also applies to a property that is registered but doesn’t show its AMA in the listing.`}</p>
      </>,
    },
    {
      id: 'monthly', over: '6. Every month', title: 'The monthly obligations',
      body: <>
        <ul className="lg-ul">
          <li><strong style={P}>Short-Term Stay Declaration on myAADE:</strong> for each month’s departures, by the 20th of the following month.</li>
          <li><strong style={P}>Climate crisis resilience fee:</strong> what you collected from guests is paid over to AADE every month, by the end of the following month.</li>
        </ul>
        <p className="lg-p">Confirm the exact date of each deadline on myAADE. The per-night fee amounts and income tax are covered in the guide {taxGuide}.</p>
      </>,
    },
  ];
  return (
    <GuideShellEn el={EL} path={PATH} h1={H1} description={DESC} about="Greek short-term rental registry (AMA), suitability requirements and fines"
      intro={<>
        <p className="lg-p">{`Before the taxes on short-term letting come the rules: whether the property can be registered with AADE, the Greek tax authority, what it must have to count as suitable, and what you file every month. Two rules also matter to anyone thinking of buying: the freeze on new registrations in central Athens (and, from ${THESS_FROM}, in ${THESS_AREA}) and, from ${SPECS_FROM}, the suitability requirements for every property.`}</p>
        <p className="lg-p">This guide explains the rules and the fines, with sources. The climate crisis resilience fee, the municipal visitor fee and income tax are covered in the guide {taxGuide}.</p>
      </>}
      sections={sections}
      sources={[
        `Freeze on new registrations in the 1st, 2nd and 3rd municipal districts of Athens: Article 111(2A) of Law 4446/2016 as added by Article 29(1) of Law 5162/2024 · extended until ${ATHENS_TO} by ${kyaEn(ATHENS.extension)} (${gazetteEn(ATHENS.fek)}).`,
        `Freeze on new registrations in ${THESS_AREA} from ${THESS_FROM} to ${THESS_TO}: Article 111(2B) of Law 4446/2016 ${THESS_BASIS}.`,
        `Removal from the registry on a transfer between living persons (for value or as a gift) in the freeze zones: Article 111(2C) of Law 4446/2016 ${THESS_BASIS}.`,
        'Registration per property and display of the AMA on every platform and advertising medium: Article 111(2) of Law 4446/2016 · Decision POL.1187/2017 (Government Gazette B 4232/04.12.2017), as in force.',
        `Fine for not registering or not showing the AMA: Article 111(5)(a) of Law 4446/2016, as replaced by Law 5073/2023 (Government Gazette A 204/12.12.2023) · ${SHARE} of the tax year’s gross income, at least ${FINE}, doubled for a new violation within one year of the fine being imposed.`,
        `Suitability requirements: Article 3 of Law 5170/2025 (${gazetteEn(STR_SPECS_FEK)}), cases a to d, from ${SPECS_FROM} · implementing details: Ministry of Tourism circular 19567/25.09.2025.`,
        `Fines for breaching the requirements: Article 3 of Law 5170/2025, paragraphs 5 and 6 · ${FINE}, doubled for a new violation within one year, quadrupled for each further one · on-site inspection by Ministry of Tourism staff (para. 2).`,
        'Short-Term Stay Declaration: by the 20th of the month after departure (AADE FAQ, 23.09.2025) · payment of the climate crisis resilience fee: by the last day of the following month (Article 53(2) of Law 4389/2016, as replaced by Article 30 of Law 5073/2023).',
      ]}
      faq={FAQ} faqTitle="What people ask before they let or buy"
      cta={{ title: 'Short-term or long-term?', href: '/en/short-term-vs-long-term-rental', action: 'Compare short-term and long-term',
        body: 'The comparison shows from what occupancy short-term letting pays off, with the climate fee and other fees in the calculation. In the freeze zones it only makes sense for a property that already has an AMA and isn’t transferred between living persons.' }} />
  );
}
