// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΡΧΙΚΗ ΣΤΑ ΑΓΓΛΙΚΑ (app/en/view.tsx): ΜΕΤΑΦΟΡΑ, ΟΧΙ ΜΕΤΑΦΡΑΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Ο αναγνώστης είναι ο Αμερικανός επενδυτής και ο ξένος ιδιοκτήτης που δεν
// ξέρει το ελληνικό φορολογικό σύστημα. Γι' αυτό η Ελλάδα λέγεται από την
// πρώτη γραμμή και κάθε ελληνικός όρος (ENFIA, E2, myAADE) εξηγείται μία φορά.
//
// ΚΑΝΕΝΑΣ ΑΡΙΘΜΟΣ ΓΡΑΜΜΕΝΟΣ ΜΕ ΤΟ ΧΕΡΙ. Τιμές, όρια, πλήθη και ποσοστά
// έρχονται από τον κώδικα, όπως και στην ελληνική αρχική (και οι τέσσερις
// μετρήσεις της ζώνης: από τις ίδιες πηγές που ελέγχει ο guard-landing-stats).
// ═══════════════════════════════════════════════════════════════════════════
import { PLANS, PLAN_ORDER, TRIAL_DAYS, TEAM_LINE, firstPlanWith } from '@/lib/billing/plans';
import { FEATURE_MIN_PLAN } from '@/lib/billing/entitlements';
import { aiLimitsFor, SCAN_LIMITS, TRIAL_SCANS_PER_MONTH } from '@/lib/billing/aiLimits';
import { RENTAL_TAX_BRACKETS_2026 } from '@/lib/billing/greekTax';
import { DOC_TYPES } from '@/lib/billing/documents';
import { PROVIDERS } from '@/lib/energy/catalogue';
import { READ_INSURERS } from '@/app/dashboard/components/insurance/catalog';
import { billingWordsEn } from '@/lib/legal/billingWords';
import { ASSISTANT_NAME_EN as NOA, AI_DISCLOSURE_EN } from '@/lib/i18n/en/noa';
import { fmtFor } from '@/lib/core/format';
import { PLAN_COPY_EN } from './plans';

const f = fmtFor('en');
const name = (id: keyof typeof PLAN_COPY_EN) => PLAN_COPY_EN[id].name;
const rate = (r: number) => f.fpRate(r * 100);

export const LANDING_EN = {
  title: 'Run your Greek property from a single photo',
  titleLines: ['Run your Greek property', 'from a single photo.'] as const,
  description:
    'Income, expenses, tenants, tax and deadlines for every property you own in Greece. Snap a bill and it files itself.',
  skip: 'Skip to content',
  news: { tag: 'New', text: `The “${name('free')}” plan now needs no subscription` },
  lede: [
    'Bills, leases, receipts: the app reads them and files them where they belong.',
    'Rent, expenses, rental tax, form E2 and ENFIA, Greece’s annual property tax, ready before your accountant asks.',
  ] as const,
  dashboard: 'Open your dashboard',
  haveAccount: 'I have an account',
  factsLabel: 'No risk',
  facts: ['No subscription for one property', `${TRIAL_DAYS}-day trial with ${NOA}`] as const,
  appLanguage: 'The app is in Greek today. English is on the way.',
};

/** Η ζώνη των τεσσάρων μετρήσεων. Ολα από την πηγή τους. */
export function statsEn() {
  const docKinds = DOC_TYPES.filter(d => d.id !== 'other').length;
  const low = rate(RENTAL_TAX_BRACKETS_2026[0].rate);
  const high = rate(RENTAL_TAX_BRACKETS_2026[RENTAL_TAX_BRACKETS_2026.length - 1].rate);
  return [
    { n: String(docKinds), u: 'document types', l: 'Bills, leases and government documents.' },
    { n: String(PROVIDERS.length), u: 'power providers', l: 'Their tariffs, with the month last checked.' },
    { n: String(READ_INSURERS), u: 'insurers', l: 'Home and commercial cover, compared by coverage.' },
    { n: String(RENTAL_TAX_BRACKETS_2026.length), u: 'tax brackets', l: `On rental income, ${low} to ${high} (Law 5246/2025).` },
  ];
}

export const HOW_EN = {
  over: 'How it works',
  title: 'Three steps to a property in order',
  sub: 'You take the photo and ask. The app handles everything in between.',
  steps: [
    { t: 'Snap a document', d: 'Photograph a bill, lease or tax notice. The app reads the amount, provider and due date and files it under the right property. Nothing is saved until you confirm.' },
    { t: 'Stay ahead of deadlines', d: 'Payments, renewals and tax deadlines go into your device’s calendar, with a reminder before each one.' },
    { t: 'Hand over a clean file', d: 'Your accountant’s file, form E2 included, downloads in one click.' },
  ],
};

export const featuresEn = (year: number) => [
  { t: `${NOA}, in Greek`, d: 'Compares and suggests using your own numbers, not generalities.', i: 'M21 12a8 8 0 0 1-8 8H8l-5 3 1.4-4.2A8 8 0 1 1 21 12M8.5 12h.01M12 12h.01M15.5 12h.01' },
  { t: 'Utilities and insurance', d: 'Electricity and home insurance, from published tariffs.', i: 'M3 12h4l3 8 4-16 3 8h4' },
  { t: 'Mortgages without surprises', d: 'Payments, rates and transfer costs, with a bank comparison.', i: 'M3 21h18M5 21V7l8-4v18M19 21V11l-6-4' },
  { t: 'Yield and letting scenarios', d: 'Net yield after tax, short-term lets side by side with long-term.', i: 'M18 7a6 6 0 1 0 0 10M4 10h9M4 14h9' },
  { t: `Taxes for ${year}`, d: 'Obligations, deadlines and each year’s tax brackets.', i: 'M9 7h6M9 11h6M9 15h4M5 3h14v18l-3-2-2 2-2-2-2 2-3-2z' },
  { t: 'Documents and deadlines', d: 'Contracts and certificates together, with a reminder before they expire.', i: 'M4 4h6l2 2h8v12H4zM4 10h16' },
];

export const FEATURES_HEAD_EN = (year: number) => ({
  over: 'Features',
  title: 'Designed for the Greek property market',
  sub: `ENFIA, building service charges, lease declarations, the ${year} rental tax brackets. All under Greek law and on its deadlines.`,
});

const fromPlan = (min: keyof typeof FEATURE_MIN_PLAN) => `, from “${PLAN_COPY_EN[FEATURE_MIN_PLAN[min]].name}”`;
export const WORKS_EN = {
  over: 'Compatibility',
  title: 'Keep everything that already works',
  sub: 'Export your data whenever you like, in the format your accountant expects.',
  items: [
    { t: 'myAADE', d: 'the Greek tax authority’s portal: lease declarations, checked for completeness' },
    { t: 'Form E2', d: 'the rental income schedule: codes mapped, ready for your accountant' },
    { t: 'Accounting software', d: `SoftOne, Epsilon, QuickBooks, Xero${fromPlan('accounting_journal')}` },
    { t: 'Accountant’s file', d: 'everything your accountant asks for, with what is missing' },
    { t: 'Airbnb, Booking.com', d: 'bookings via iCal, no double entries' },
    { t: 'Bank transactions', d: `CSV with rent matching${fromPlan('bank_import')}` },
    { t: 'Excel', d: 'export any table, no lock-in' },
    { t: 'Google account', d: 'sign in without a new password' },
  ],
};

export const CALC_HEAD_EN = (year: number) => ({
  over: 'See for yourself',
  title: 'What does your property really earn?',
  sub: `An indicative net yield, using the same ${year} rental tax brackets that run inside the app.`,
});

export const SECURITY_EN = {
  over: 'Security',
  title: 'Your data belongs to you',
  sub: 'Encrypted connections, per-user isolation and a database in the European Union.',
  lede: 'Bills, contracts and details about your property or your clients are some of the most sensitive data there is. We protect them accordingly.',
  items: [
    { t: 'Encrypted connection', d: 'Your connection to the app always runs over TLS, on every device and network.', i: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4' },
    { t: 'Per-user isolation', d: 'You see only your own data. Access goes only to the people you choose.', i: 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z' },
    { t: 'No model training', d: 'Our AI provider is contractually bound not to train models on your data.', i: 'M12 2v4M12 18v4M2 12h4M18 12h4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
    { t: 'Database in the EU', d: 'Your database, sign-in and files are hosted in Frankfurt.', i: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20' },
  ],
  fine: 'Which providers process data outside the EU, and under which contracts, is set out on',
  fineLink: 'our About page',
};

export const WHY_EN = {
  over: 'Why it exists',
  title: 'Nobody bought property to do bookkeeping',
  body: [
    'Greece’s property tax rules change every year, and the deadlines keep multiplying.',
    'Form E2, ENFIA, short-term rental declarations, the standard deduction, building service charges, long-term rent reviews: each has its own deadline, and the responsibility is always yours.',
    'That is why we built PROPERWISE. It keeps track of every property’s costs, tax obligations and deadlines, under the rules of the year you are filing for.',
    'Tax is worked out from your own figures, deadlines go into your device’s calendar, and every receipt is filed from a single photo. Your accountant’s file downloads in one click.',
  ],
  close: 'You make the decisions. PROPERWISE does the rest.',
  about: 'Who we are and where your data lives',
};

export const PRICING_HEAD_EN = {
  over: 'Pricing',
  title: 'What each plan costs',
  sub: 'Every plan includes everything in the one before it.',
  more: 'See everything each plan includes',
};

export const FAQ_HEAD_EN = {
  over: 'FAQ',
  title: 'What owners ask before they start',
  sub: 'Limits and charges, before you begin.',
  more: 'More questions',
  less: 'Fewer questions',
};

export const FINAL_EN = {
  title: 'Your property, under control.',
  lines: ['Every document in its place, every deadline on time.', 'Your next tax return will find your file ready.'] as const,
};

const monthsSaved = PLAN_ORDER
  .filter(id => PLANS[id].priceMonthly > 0)
  .reduce((most, id) => Math.max(most, Math.round(12 - PLANS[id].priceAnnual / PLANS[id].priceMonthly)), 0);

export const FAQ_PRICE_Q_EN = 'How much does it cost?';

export function faqEn() {
  const w = billingWordsEn();
  return [
    { q: FAQ_PRICE_Q_EN, a: `“${name('free')}” has no subscription for one property and includes every tax tool. With ${NOA} it costs ${f.fe(PLANS.solo.priceMonthly)} a month or ${f.fe(PLANS.solo.priceAnnual)} a year. The larger plans go up to ${f.fe(PLANS.office.priceMonthly)} a month for unlimited properties. Teams with roles start on the “${name(firstPlanWith(TEAM_LINE))}” plan. Paying annually saves you up to ${monthsSaved} months and lowers the monthly cost.` },
    { q: 'Who is it for?', a: 'Anyone who owns property in Greece, from an individual with one apartment to a real estate office managing portfolios for clients. It covers homes, commercial space, storage units and land, on long-term or short-term lets.' },
    { q: 'How does photo scanning work?', a: `Photograph a bill, lease, insurance policy or ENFIA statement. The app reads the amount, provider and due date and files them under the right property. You see what it understood first and fix it with a tap: nothing is saved without you. Without a subscription you get ${SCAN_LIMITS.free} scans a month, ${TRIAL_SCANS_PER_MONTH} during the trial and unlimited scans with a subscription.` },
    { q: 'Does it replace my accountant?', a: 'No, it supports them. It keeps your obligations and deadlines current all year, so you reach your accountant with your figures ready to export instead of hunting for them in June. The app’s calculations are indicative, not binding.' },
    { q: 'Is my data safe?', a: 'Your connection is always encrypted, and every account is isolated at the database level: you see your own data and only what you choose to share. Our AI provider is contractually bound not to train models on your documents. The database and files are hosted in Frankfurt; anything that leaves the EU is listed on our About page.' },
    { q: `What language does ${NOA} speak?`, a: `Greek. ${NOA} reads and writes Greek, and in Chrome or Safari you can also ask by voice and hear the answers. ${NOA} sees your own properties, expenses and deadlines, and refers legal and accounting questions to the right professional. ${AI_DISCLOSURE_EN}` },
    { q: `How many questions can I ask ${NOA}?`, a: `${NOA} is not included in the no-subscription “${name('free')}” plan. On the other plans only the number of questions changes: from ${aiLimitsFor('solo').perMonth} a month (${name('solo')}) to ${aiLimitsFor('office').perMonth} (${name('office')}), renewed on the 1st of each month. Each day you can use up to about a third of your monthly allowance, from ${aiLimitsFor('solo').perDay} to ${aiLimitsFor('office').perDay} questions.` },
    { q: 'What happens when the trial ends?', a: w.afterTrialShort },
    { q: 'What happens to my data if I stop?', a: w.lapsedRetentionShort },
    { q: 'Does it work on mobile?', a: 'Yes. It adapts to phone, tablet and computer, and scanning works best with your phone or tablet camera. You can also add it to your home screen like an app.' },
    { q: 'How quickly can I start?', a: 'Sign-up takes less than a minute, with Google or email. Add your first property with a few basic details, and its picture fills in with every document you add. If you would like to see how it works first, there is demo data.' },
  ];
}

// Τα μέρη της αρχικής ζουν στο ./landingParts: τα φορτώνει και ο
// LandingCalculator, που τρέχει στον browser και δεν πρέπει να τραβήξει το
// billingWords (αυτό φέρνει μαζί τον κώδικα του εμπόρου, μόνο για τον διακομιστή).
export { PARTS_EN } from './landingParts';
