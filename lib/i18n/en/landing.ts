// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΡΧΙΚΗ ΣΤΑ ΑΓΓΛΙΚΑ (app/en/view.tsx): ΜΕΤΑΦΟΡΑ, ΟΧΙ ΜΕΤΑΦΡΑΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Ο αναγνώστης είναι ο Αμερικανός επενδυτής και ο ξένος ιδιοκτήτης που δεν
// ξέρει το ελληνικό φορολογικό σύστημα. Γι' αυτό η Ελλάδα λέγεται από την
// πρώτη γραμμή και κάθε ελληνικός όρος (ENFIA, E2, myAADE) εξηγείται μία φορά.
//
// ΚΑΝΕΝΑΣ ΑΡΙΘΜΟΣ ΓΡΑΜΜΕΝΟΣ ΜΕ ΤΟ ΧΕΡΙ. Τιμές, όρια, πλήθη και ποσοστά
// έρχονται από τον κώδικα, όπως και στην ελληνική αρχική (και οι τέσσερις
// μετρήσεις της ζώνης, στο landingStats.ts: από τις ίδιες πηγές που ελέγχει ο
// guard-landing-stats).
// ═══════════════════════════════════════════════════════════════════════════
import { PLANS, PLAN_ORDER, TRIAL_DAYS, TEAM_LINE, firstPlanWith } from '@/lib/billing/plans';
import { FEATURE_MIN_PLAN } from '@/lib/billing/entitlements';
import { aiLimitsFor, SCAN_LIMITS, TRIAL_SCANS_PER_MONTH } from '@/lib/billing/aiLimits';
import { billingWordsEn } from '@/lib/legal/billingWords';
import { ASSISTANT_NAME_EN as NOA, AI_DISCLOSURE_EN } from '@/lib/i18n/en/noa';
import { fmtFor } from '@/lib/core/format';
import { PLAN_COPY_EN } from './plans';
import { BRAND_ABOUT } from '@/lib/seo/organization';
import { PRODUCT_NAME } from '@/lib/core/site';
import { APP_LANGUAGE_EN } from './appScreens';

const f = fmtFor('en');
const name = (id: keyof typeof PLAN_COPY_EN) => PLAN_COPY_EN[id].name;

export const LANDING_EN = {
  title: 'Run your Greek property from a single photo',
  titleLines: ['Run your Greek property', 'from a single photo.'] as const,
  description:
    'Income, expenses, tenants, tax and deadlines for every property you own in Greece. Snap a bill and it files itself.',
  skip: 'Skip to content',
  news: { tag: 'New', text: `The “${name('free')}” plan now needs no subscription` },
  lede: [
    'Snap a bill or lease and the app fills in the details.',
    'Rental tax, form E2 and ENFIA ready before your accountant asks.',
  ] as const,
  dashboard: 'Open your dashboard',
  haveAccount: 'I have an account',
  factsLabel: 'No risk',
  facts: ['No subscription for one property', `${TRIAL_DAYS}-day trial with ${NOA}`] as const,
  appLanguage: APP_LANGUAGE_EN,
};

/** Η σύντομη ξενάγηση (app/en/TourVideo.tsx). Τα σημεία είναι η
 *  περιγραφή του βίντεο σε κείμενο: ό,τι δείχνει η εικόνα, το διαβάζει και ο
 *  αναγνώστης οθόνης. Η σημείωση γλώσσας λέει ότι οι οθόνες στο βίντεο είναι
 *  αγγλική προεπισκόπηση· ποιες οθόνες είναι ήδη αγγλικές το λέει το appScreens.ts. */
export const TOUR_EN = {
  over: 'Quick tour',
  title: 'See it work, start to finish',
  sub: 'From the notice that arrives in Greece to the file your accountant asks for.',
  play: 'Play the tour',
  videoTitle: 'PROPERWISE, a quick tour',
  pointsLabel: 'What the video shows',
  points: [
    'A bill, an ENFIA notice or a tenant message arrives while you are abroad.',
    'You snap the bill and it files itself under the right property.',
    'Every deadline shows the days left, ENFIA instalments included.',
    'Your rental tax, worked out from your own rent.',
    'A complete file for your accountant in Greece.',
    `${NOA} answers in Greek, from your own numbers.`,
  ] as const,
  note: `The video shows an English preview of the app. ${APP_LANGUAGE_EN}`,
};

export const HOW_EN = {
  over: 'How it works',
  title: 'Three steps to a property in order',
  sub: 'The app handles everything in between.',
  steps: [
    { t: 'Snap a document', d: 'Photograph a bill, lease or tax notice. It is filed under the right property once you confirm.' },
    { t: 'Stay ahead of deadlines', d: 'Payments, renewals and tax deadlines in your calendar, with reminders.' },
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
  sub: `ENFIA, form E2, lease declarations and the ${year} rental tax brackets, with their deadlines.`,
});

const fromPlan = (min: keyof typeof FEATURE_MIN_PLAN) => `, from “${PLAN_COPY_EN[FEATURE_MIN_PLAN[min]].name}”`;
export const WORKS_EN = {
  over: 'Compatibility',
  title: 'Keep everything that already works',
  sub: 'Export anytime, in the format your accountant expects.',
  more: (n: number) => `See all (${n})`,
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
  sub: `Indicative, using the app’s ${year} rental tax brackets.`,
});

export const SECURITY_EN = {
  over: 'Security',
  title: 'Your data belongs to you',
  items: [
    { t: 'Encrypted connection', d: 'Always over TLS, on every device and network.', i: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4' },
    { t: 'Per-user isolation', d: 'Only you see your data, plus the people you choose.', i: 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z' },
    { t: 'No model training', d: 'Our AI provider is contractually bound not to train models on your data.', i: 'M12 2v4M12 18v4M2 12h4M18 12h4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
    { t: 'Database in the EU', d: 'Database, sign-in and files hosted in Frankfurt.', i: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20' },
  ],
  fine: 'Which providers process data outside the EU, and under which contracts, is set out on',
  fineLink: 'our About page',
};

export const PRICING_HEAD_EN = {
  title: 'What each plan costs',
  more: 'See everything each plan includes',
};

export const FAQ_HEAD_EN = {
  over: 'FAQ',
  title: 'What owners ask before they start',
  more: 'More questions',
  less: 'Fewer questions',
};

export const FINAL_EN = {
  title: 'Your property, under control.',
  lines: ['Every document in its place, every deadline on time.'] as const,
};

const monthsSaved = PLAN_ORDER
  .filter(id => PLANS[id].priceMonthly > 0)
  .reduce((most, id) => Math.max(most, Math.round(12 - PLANS[id].priceAnnual / PLANS[id].priceMonthly)), 0);

export const FAQ_PRICE_Q_EN = 'How much does it cost?';

export function faqEn() {
  const w = billingWordsEn();
  return [
    // Πρώτα τι είναι: η ίδια πρόταση με το `description` του οργανισμού (app/landingContent.ts).
    { q: `What is ${PRODUCT_NAME}?`, a: BRAND_ABOUT.en },
    { q: FAQ_PRICE_Q_EN, a: `“${name('free')}” has no subscription for one property and includes every tax tool. With ${NOA} it costs ${f.fe(PLANS.solo.priceMonthly)} a month or ${f.fe(PLANS.solo.priceAnnual)} a year. Up to ${f.fe(PLANS.office.priceMonthly)} a month for unlimited properties, with team roles from “${name(firstPlanWith(TEAM_LINE))}”. Paying annually saves up to ${monthsSaved} months.` },
    { q: 'Who is it for?', a: 'Property owners in Greece, from one apartment to an agency managing client portfolios. Homes, commercial space, storage and land, on long-term or short-term lets.' },
    { q: 'How does photo scanning work?', a: `Photograph a bill, lease, insurance policy or ENFIA statement. The app reads amount, provider and due date; nothing is saved until you approve. ${SCAN_LIMITS.free} scans a month without a subscription, ${TRIAL_SCANS_PER_MONTH} during the trial, unlimited with a subscription.` },
    { q: 'Does it replace my accountant?', a: 'No, it supports them: you arrive with your figures ready instead of hunting for them in June. The app’s calculations are indicative, not binding.' },
    { q: 'Is my data safe?', a: 'Encrypted connections and per-account isolation in the database. Our AI provider is contractually bound not to train models on your documents. Database and files are hosted in Frankfurt; anything that leaves the EU is listed on our About page.' },
    { q: `What language does ${NOA} speak?`, a: `Greek, in writing or, in Chrome and Safari, by voice. ${NOA} sees your properties, expenses and deadlines and refers legal and accounting questions to a professional. ${AI_DISCLOSURE_EN}` },
    { q: `How many questions can I ask ${NOA}?`, a: `${NOA} is not included in the no-subscription “${name('free')}” plan. From ${aiLimitsFor('solo').perMonth} questions a month (${name('solo')}) to ${aiLimitsFor('office').perMonth} (${name('office')}), renewed on the 1st, with a daily limit from ${aiLimitsFor('solo').perDay} to ${aiLimitsFor('office').perDay}.` },
    { q: 'What happens when the trial ends?', a: w.afterTrialShort },
    { q: 'What happens to my data if I stop?', a: w.lapsedRetentionShort },
    { q: 'Does it work on mobile?', a: 'Yes, on phone, tablet and computer. Add it to your home screen like an app.' },
    { q: 'How quickly can I start?', a: 'Sign-up takes under a minute, with Google or email. Your first property needs a few details, and there is demo data to explore.' },
  ];
}

// Τα μέρη της αρχικής ζουν στο ./landingParts: τα φορτώνει και ο
// LandingCalculator, που τρέχει στον browser και δεν πρέπει να τραβήξει το
// billingWords (αυτό φέρνει μαζί τον κώδικα του εμπόρου, μόνο για τον διακομιστή).
export { PARTS_EN } from './landingParts';
