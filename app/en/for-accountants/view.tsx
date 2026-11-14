import type { Metadata } from 'next';
import Link from 'next/link';
import { T } from '@/components/tokens';
import { SITE, siteUrl, PRODUCT_NAME } from '@/lib/core/site';
import { organizationNode, ORG_REF } from '@/lib/seo/organization';
import { athensParts } from '@/lib/core/time';
import { IDENTITY } from '@/lib/legal/identity';
import { billingWordsEn } from '@/lib/legal/billingWords';
import { signupCtaEn } from '@/lib/billing/trialOffer';
import { TRIAL_DAYS } from '@/lib/billing/plans';
import { FEATURE_MIN_PLAN } from '@/lib/billing/entitlements';
import {
  PRO_PAID_TARGET, PRO_PAID_BONUS_MONTHS, STREAK_TARGET_MONTHS,
  PARTNER_WELCOME_MONTHS, PARTNER_MONTHLY_FREE_MONTHS, partnerWelcomeTier,
} from '@/lib/referral/referral';
import { ACCOUNTANT_LINK_DAYS } from '@/lib/data/accountantLink';
import { gapsOf, readinessOf, type ClientCounts, type Gap } from '@/lib/data/accountant';
import { PACK_FILES } from '@/lib/accounting/meetingPack';
import { PLAN_COPY_EN } from '@/lib/i18n/en/plans';
import { ASSISTANT_NAME_EN as NOA, AI_DISCLOSURE_EN } from '@/lib/i18n/en/noa';
import { LANDING_EN } from '@/lib/i18n/en/landing';
import { countEn } from '@/lib/i18n/en/guides/cite';
import { breadcrumbJsonLd, HOME_CRUMB_EN } from '@/lib/seo/breadcrumbs';
import { PublicHeader, PublicFooter, JsonLd, SectionHead, WRAP, WRAP_PAD } from '../../PublicChrome';
import { BackLink } from '../../BackLink';
import { LINK_STYLE } from '../../linkStyle';
import { MailLink } from '../../legal-shell';
import { publicMetadata } from '../../publicMetadata';
import { shareImage } from '../../og/share';
import { GuideH2 as H2 } from '../../odigos/GuideParts';

// ═══════════════════════════════════════════════════════════════════════════
// «ΓΙΑ ΛΟΓΙΣΤΕΣ» ΣΤΑ ΑΓΓΛΙΚΑ (/en/for-accountants, ζεύγος του /logistes)
// ─────────────────────────────────────────────────────────────────────────
// Ιδιος κανόνας με την ελληνική: κάθε πρόταση αντιστοιχεί σε κάτι που κάνει ο
// κώδικας, κάθε αριθμός από την πηγή του (διάρκεια συνδέσμου, πακέτα,
// στόχοι του προγράμματος, αρχεία του φακέλου). Το παράδειγμα της λίστας
// περνά από τα ίδια `gapsOf`/`readinessOf`: εδώ μεταφράζεται μόνο η φράση,
// από το κλειδί κάθε έλλειψης. Τα ονόματα των αρχείων του φακέλου μένουν
// ελληνικά, όπως είναι μέσα στο zip, με αγγλική εξήγηση δίπλα.
// ═══════════════════════════════════════════════════════════════════════════
const PATH = '/en/for-accountants';
/** Ο χώρος του λογιστή, στα ελληνικά: σκέτο <a>, για πλήρη πλοήγηση. */
const WORKSPACE = '/accountant/workspace';
const URL = siteUrl(PATH);
const H1 = 'For accountants: your clients’ rent and form E2, in Excel';
const TITLE = `For accountants: rent and form E2 in Excel · ${PRODUCT_NAME}`;
const DESC = 'Property owners in Greece send you one link: rent, expenses, stays and form E2 by tax number, in Excel. All your clients in one list, with what is missing.';

export function generateMetadata(): Metadata {
  return publicMetadata({ title: TITLE, description: DESC, url: URL, image: shareImage('en-for-accountants') });
}

const plan = (id: keyof typeof PLAN_COPY_EN) => PLAN_COPY_EN[id].name;
const months = (n: number): string => (n === 1 ? 'one month' : `${countEn(n)} months`);
const LINK_PLAN = plan(FEATURE_MIN_PLAN.e2_export);
const PARTNER = { fromOwner: plan(partnerWelcomeTier('owner')), otherwise: plan(partnerWelcomeTier('office')) };

// Το παράδειγμα της λίστας: ίδιοι αριθμοί και ίδιος κριτής με την ελληνική σελίδα.
const SAMPLE: ClientCounts = {
  ownerId: 'example', name: 'Example', afm: 'example', linkedAt: '',
  lastActivity: null, requests: [], properties: 2, expenses: 18, uncategorised: 2,
  noSupplierAfm: 3, rentsUnpaid: 0, stays: 24, staysNoFee: 1, openRequests: 0,
  e2: { aadeRows: 0, aadeChangedAt: null, packs: [] },
};
const SAMPLE_GAPS = gapsOf(SAMPLE);
const SAMPLE_READY = readinessOf(SAMPLE_GAPS);
const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
/** Η φράση κάθε έλλειψης στα αγγλικά, από το κλειδί της (lib/data/accountant.ts). */
const gapEn = (g: Gap): string => ({
  no_properties: 'No property entered yet',
  no_expenses: 'No expenses entered for the tax year',
  uncategorised: n(SAMPLE.uncategorised, 'expense without a category', 'expenses without a category'),
  no_supplier_afm: n(SAMPLE.noSupplierAfm, 'expense without the supplier’s tax number', 'expenses without the supplier’s tax number'),
  stays_no_fee: n(SAMPLE.staysNoFee, 'platform booking without its commission', 'platform bookings without their commission'),
  rents_unpaid: n(SAMPLE.rentsUnpaid, 'unpaid rent', 'unpaid rents'),
  owner_afm: 'No tax number (AFM) entered',
  aade_e2: 'The pre-filled E2 hasn’t been uploaded',
  aade_diff: 'The pre-filled E2 doesn’t match',
  pack: 'The accountant’s file hasn’t been sent',
} as Record<string, string>)[g.key] ?? g.item;
const READY_EN = SAMPLE_GAPS.length === 0 ? 'Ready' : SAMPLE_READY.blocking === 0 ? 'Almost ready' : 'Not ready to file';

const PACK_YEAR = athensParts().year - 1;
const PACK_TREE: { name: string; what: string; depth?: 1 }[] = [
  { name: PACK_FILES.cover, what: 'One page: who, what, how much and what is missing.' },
  { name: PACK_FILES.e2(PACK_YEAR), what: 'Form E2 for the tax number, column by column with the form’s numbering, with Supplements I and II.' },
  { name: PACK_FILES.review, what: 'A comparison with AADE’s pre-filled form by property, short-term stays and what is missing.' },
  { name: `${PACK_FILES.papers}/`, what: 'The year’s invoices and receipts.' },
  { name: '…/', what: 'One subfolder for each property under the tax number.', depth: 1 },
  { name: `${PACK_FILES.aade}/`, what: 'The original pre-filled form, once it has been uploaded.' },
];

const FAQ = [
  {
    q: 'Do I need an account to see a client’s figures?',
    a: 'No. The link the owner sends you opens without an account or a password, read-only. You need an account once, to see all your clients together, ask for what is missing and download the file they send you.',
  },
  {
    q: 'How long is the link valid?',
    a: `${countEn(ACCOUNTANT_LINK_DAYS)} days from the moment the owner creates it. They can revoke it at any time: the old one stops working immediately and a new one is created.`.replace(/^./, c => c.toUpperCase()),
  },
  {
    q: 'Can I change a client’s figures?',
    a: 'No. You ask the owner for anything missing with a request, and they enter it. On their behalf, you upload only AADE’s pre-filled form E2, for the comparison.',
  },
  {
    q: 'Can I see tenants or guests through the link?',
    a: 'No. The link carries amounts and property details, no third party’s identity: no tenant, no guest, no supplier. Tenants, tax numbers and invoices exist only in the file the owner sends you.',
  },
  {
    q: 'Does the E2 in Excel follow the form?',
    a: 'Yes. The columns follow form E2 with its numbering, one sheet per tax number, with Supplements I and II. Anything the app doesn’t record, such as transfers or a payment order for unpaid rent, is listed on the review sheet for you to fill in.',
  },
];

const S = {
  link: { id: 'link', over: '1. The link', title: 'How a client reaches you' },
  portal: { id: 'tax-year', over: '2. The client’s year', title: 'What you see for each client' },
  folder: { id: 'file', over: '3. The file', title: 'Form E2 in Excel, one file per tax number' },
  list: { id: 'clients', over: '4. Your clients', title: 'All your clients in one list' },
  ask: { id: 'requests', over: '5. Requests', title: 'Ask for what is missing, without a phone call' },
  noa: { id: 'noa', over: `6. ${NOA}`, title: 'Simple questions for the owner, accounting for you' },
  partner: { id: 'partners', over: '7. Partnership', title: 'Partner program for accounting firms' },
} as const;

const strong = { color: 'var(--text-primary)' } as const;
const box = { padding: 'clamp(16px, 4vw, 22px)', borderRadius: T.radius.card, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' } as const;
const cta = { display: 'inline-flex', alignItems: 'center', minHeight: T.h.lg, padding: '0 24px', borderRadius: T.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' } as const;

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    organizationNode(),
    { '@type': 'WebPage', '@id': `${URL}#webpage`, url: URL, name: H1, description: DESC, inLanguage: 'en',
      isPartOf: { '@id': `${SITE}/#website` }, publisher: ORG_REF,
      audience: { '@type': 'Audience', audienceType: 'Accountants and tax advisors' },
      about: { '@type': 'Thing', name: 'Clients’ rent, expenses and Greek form E2 in Excel for accountants' } },
    breadcrumbJsonLd([{ name: 'For accountants', path: PATH }], HOME_CRUMB_EN),
    { '@type': 'FAQPage', inLanguage: 'en', mainEntity: FAQ.map(x => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) },
  ],
};

export default function Page() {
  const words = billingWordsEn();
  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={jsonLd} />
      <PublicHeader locale="en" />
      <main style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <div className="gd">
          <BackLink locale="en" />
          <div className="lp-eyebrow">For accountants</div>
          <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>{H1}</h1>
          <p className="lg-p">{`Owners keep their rent, expenses, stays and invoices in ${PRODUCT_NAME} all year. You get a read-only link and see their tax year the way you will declare it: a row per property, anything missing listed first, and an Excel file that opens in your own software.`}</p>
          <p className="lg-p" style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>{LANDING_EN.appLanguage}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '22px 0 0' }}>
            <a href={`#${S.folder.id}`} className="lp-cta lp-primary lp-press" style={cta}>See what the file looks like</a>
            <Link href="/en/signup" className="lp-cta lp-press" style={{ ...cta, border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>{signupCtaEn()}</Link>
          </div>

          <H2 {...S.link} />
          <ol className="lg-ul">
            <li><strong style={strong}>The owner creates it from their Accounting tab</strong>{` and sends it to you. It covers all their properties, is valid for ${countEn(ACCOUNTANT_LINK_DAYS)} days and can be revoked at any time: the old one stops at once. It is available from the “${LINK_PLAN}” plan.`}</li>
            <li><strong style={strong}>You open it without an account.</strong>{' No password, no email. You choose the tax year; the default is the previous one, where you spend most of your time.'}</li>
            <li><strong style={strong}>With your own account, you keep it.</strong>{' You paste the link into your client list and find it there with the others, no bookmarks needed.'}</li>
          </ol>

          <H2 {...S.portal} />
          <ul className="lg-ul">
            <li><strong style={strong}>What is missing, before any figure.</strong>{' Anything that stops the year from closing is listed first.'}</li>
            <li><strong style={strong}>The year’s rent as on form E2.</strong>{' Accrued, with the months let and, next to them, how much of it was collected.'}</li>
            <li><strong style={strong}>Short-term rentals with the declarable gross.</strong>{' Without the climate crisis resilience fee, which isn’t income; a stay that crosses the new year is split by its nights.'}</li>
            <li><strong style={strong}>The year’s expenses by category.</strong>{' With date and amount in the file.'}</li>
            <li><strong style={strong}>The property’s identity.</strong>{' Address, ATAK (the property’s tax ID number), floor area and co-ownership share. Where a property is co-owned, income and expenses are also shown for the owner’s share.'}</li>
            <li><strong style={strong}>An indicative tax, labeled as such.</strong>{' Below the recorded amounts, as a cross-check; the tax itself is yours to work out.'}</li>
          </ul>
          <p className="lg-p">A download button gives you an .xlsx file with numeric cells, on sheets for properties, expenses, stays and what is missing. For stays it lists the year’s nights, declarable gross, climate fee, platform commission and the basis of each amount. The calculation is the same as on screen, so file and screen never disagree.</p>
          <div className="lg-note lg-note-tip" style={{ marginTop: 16 }}>The link carries no third party’s identity: no tenant, no guest, no supplier. The tenant’s tax number, which form E2 asks for, is held by the owner and goes into the file they send you.</div>

          <H2 {...S.folder} />
          <p className="lg-p">{`From their Accounting tab, the owner builds one file for each tax number and tax year and sends it to their accountant. Two spouses’ properties don’t go on the same form: each taxpayer has their own E2. The file for tax year ${PACK_YEAR} contains these files, named in Greek as they appear in the zip:`}</p>
          <ul aria-label="The files in the accountant’s file" style={{ ...box, margin: '14px 0 0', listStyle: 'none', display: 'grid', gap: 12 }}>
            {PACK_TREE.map(x => (
              <li key={x.name} style={{ paddingLeft: x.depth ? 20 : 0 }}>
                <span lang="el" style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{x.name}</span>
                <span style={{ display: 'block', fontSize: 14, lineHeight: 1.55, color: 'var(--text-secondary)' }}>{x.what}</span>
              </li>
            ))}
          </ul>
          <p className="lg-p" style={{ marginTop: 16 }}>You download it from your client list, for as long as the link is valid. You don’t build a file from the client’s data: you see what they sent you. You can upload AADE’s pre-filled form E2 on their behalf; the comparison runs on the owner’s device when they open it, and your list shows only whether it matches or how many differences were found.</p>
          <p className="lg-p">The owner can also download the same form E2 in Excel on their own, with one sheet per tax number, a review sheet with the ATAK numbers for the cross-check with form E9, filing notes and table 4D2 of form E1.</p>

          <H2 {...S.list} />
          <ul className="lg-ul">
            <li><strong style={strong}>Clients who can’t close come first.</strong>{' Each client shows in a word how ready they are for the tax year you chose, as in the example below.'}</li>
            <li><strong style={strong}>What each one is missing, in plain words.</strong>{' Expenses without a category, expenses without the supplier’s tax number, platform bookings without their commission, unpaid rent, a pre-filled form not uploaded or not matching, a file not yet sent.'}</li>
            <li><strong style={strong}>When they were last active.</strong>{' Two clients with the same gaps are different work when one of them entered something yesterday.'}</li>
            <li><strong style={strong}>Search by name or tax number</strong>{' once you have many clients.'}</li>
            <li><strong style={strong}>Amounts in one tap.</strong>{' Each client’s income and expenses, and a download of everything: one Excel workbook per client, in one folder.'}</li>
          </ul>
          <figure style={{ ...box, margin: '16px 0 0' }}>
            <figcaption style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{`Example client · ${SAMPLE.properties} properties`}</span>
              <span style={{ fontSize: 13, fontWeight: SAMPLE_READY.blocking > 0 ? 700 : 500, color: 'var(--text-primary)' }}>{READY_EN}</span>
            </figcaption>
            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
              {SAMPLE_GAPS.map(g => (
                <li key={g.key} style={{ fontSize: 14, lineHeight: 1.5, padding: '8px 0', borderTop: '1px solid var(--border-subtle)',
                  color: g.blocking ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: g.blocking ? 600 : 400 }}>{gapEn(g)}</li>
              ))}
            </ul>
          </figure>
          <p className="lg-p" style={{ marginTop: 16 }}>When a client leaves, you remove them from your list. That isn’t a revocation: revoking belongs to the owner, and nothing of theirs is deleted.</p>

          <H2 {...S.ask} />
          <ul className="lg-ul">
            <li><strong style={strong}>“Request it” next to each gap,</strong>{' with an optional note: which expense, from when, why you need it now.'}</li>
            <li><strong style={strong}>The owner sees it in their Accounting tab</strong>{' with your name, and closes it with “Sent” or “Doesn’t apply”.'}</li>
            <li><strong style={strong}>Your list shows it as pending</strong>{' with the date you sent it. If you sent it by mistake, you can withdraw it.'}</li>
          </ul>

          <H2 {...S.noa} />
          <p className="lg-p">{`On the plans that include ${NOA}, from “${plan('solo')}” up, the owner asks about their own data: what is pending, how much went on maintenance, which tab something is on. ${NOA} answers from their properties, expenses and deadlines. ${AI_DISCLOSURE_EN}`}</p>
          <p className="lg-p">{`For taxes, tax returns and accounting questions, ${NOA} explicitly refers the owner to an accountant or tax advisor; for legal questions, to a lawyer or notary. Tax amounts are indicative. For anything binding, the answer belongs to a professional, not to the app.`}</p>

          <H2 {...S.partner} />
          <p className="lg-p">With a professional account, you invite your clients with a personal link. An account counts once it is activated, meaning the new owner has added a property and scanned a document.</p>
          <ul className="lg-ul">
            <li><strong style={strong}>Monthly target.</strong>{` If ${PRO_PAID_TARGET} accounts with a subscription to any plan are activated within the same calendar month, you earn ${months(PRO_PAID_BONUS_MONTHS)} of “${plan('agency')}”. The reward is credited when you claim it from the program screen.`}</li>
            <li><strong style={strong}>Partner status.</strong>{` If you hit the target for ${countEn(STREAK_TARGET_MONTHS)} consecutive completed months, you become a partner. On becoming one you earn ${months(PARTNER_WELCOME_MONTHS)} of “${PARTNER.fromOwner}” if you are on “${plan('solo')}” or “${plan('owner')}”, otherwise ${months(PARTNER_WELCOME_MONTHS)} of “${PARTNER.otherwise}”.`}</li>
            <li><strong style={strong}>From then on,</strong>{` every month that hits the target gives you ${months(PARTNER_MONTHLY_FREE_MONTHS)} of subscription without charge, with priority access to new features.`}</li>
          </ul>
          <p className="lg-p">{`${words.compMonths}${words.partnerTarget ? ` ${words.partnerTarget}` : ''} The person you invite starts with the ${TRIAL_DAYS}-day trial, like every new account; the link gives them no extra benefit.`}</p>
          <p className="lg-p"><Link href="/en/terms#systaseis" className="lp-link po-tap" style={LINK_STYLE}>The program terms</Link></p>

          <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
            <div style={box}>
              <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Start with your first client</h2>
              <p style={{ margin: '0 0 16px', fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)' }}>Create an account and paste the link the owner sent you. If you already have an account, your clients are one tap away.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <Link href="/en/signup" className="lp-cta lp-primary lp-press" style={cta}>{signupCtaEn()}</Link>
                {/* Πλήρης πλοήγηση: ο χώρος του λογιστή είναι ελληνικός και το `<html lang>` το γράφει ο διακομιστής. */}
                <a href={WORKSPACE} hrefLang="el" className="lp-cta lp-press" style={{ ...cta, border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>Your clients</a>
              </div>
              <p style={{ margin: '16px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{'For a firm with many clients, or a question before you start, write to us at '}<MailLink to={IDENTITY.supportEmail} />{'.'}</p>
            </div>
          </section>

          <section className="po-tool-more" style={{ marginTop: 'clamp(44px,6vw,72px)' }}>
            <SectionHead over="FAQ" title="What accountants ask" />
            <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {FAQ.map(x => (
                <details key={x.q} className="lp-faq">
                  <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '17px 0', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    {x.q}
                    <span className="lp-plus" style={{ color: 'var(--accent)', fontSize: 20, fontWeight: T.weight.body, lineHeight: 1, transition: 'transform .2s', flexShrink: 0 }}>+</span>
                  </summary>
                  <p style={{ margin: '0 0 18px', fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)', textWrap: 'pretty' }}>{x.a}</p>
                </details>
              ))}
            </div>
          </section>

          <div className="lg-note lg-note-fine" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>Amounts are as the owner entered them. The indicative tax is a cross-check, not an assessment; the accountant reviews and files the return.</div>
        </div>
      </main>
      <PublicFooter locale="en" />
    </div>
  );
}
