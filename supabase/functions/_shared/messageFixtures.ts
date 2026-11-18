// ═══════════════════════════════════════════════════════════════════════════
// ΣΤΑΘΕΡΑ ΔΕΔΟΜΕΝΑ ΓΙΑ ΚΑΘΕ ΠΡΟΤΥΠΟ, ΣΤΙΣ ΔΥΟ ΓΛΩΣΣΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Τα χρησιμοποιούν ο έλεγχος (messageLang.test.ts) και το σενάριο που βγάζει
// τα στιγμιότυπα. Ο,τι γράφει εδώ ο «χρήστης» (τίτλοι, ονόματα) είναι λατινικό,
// ώστε ο έλεγχος «κανένα ελληνικό γράμμα στα αγγλικά» να πιάνει μόνο το δικό
// μας κείμενο.
// ═══════════════════════════════════════════════════════════════════════════
import { APP_URL } from './site.ts'
import type { CalendarEventsRow, RentPaymentsRow } from '../../../lib/supabase/tables.ts'
import { buildEmail, buildDunningEmail, noticeLabelOf } from './reminderEmail.ts'
import {
  emailShell, welcomeEmail, planUpgradedEmail, planDowngradedEmail, newPropertyEmail, feedbackRequestEmail,
  mobileLaunchEmail, referralInviteEmail, upsellEmail, legislationUpdateEmail, seasonalCampaignEmail,
  clientMessageEmail, p, type Personal,
} from './emailTemplates.ts'
import * as EN_TPL from './emailCopy/en/templates.ts'
import { CATALOG, DIGESTS } from './emailCopy.ts'
import { CATALOG_EN, DIGESTS_EN } from './emailCopy/en/index.ts'
import { firmInviteEmail } from './firmInvite.ts'
import { statementHtml, statementSubject, periodLabelOf } from './statementEmail.ts'
import { digestLayout, digestRows, digestSubject } from './marketDigestEmail.ts'
import { orgInviteEmail, testEmailHtml, confirmEmailHtml, newsLayout, updateBlock, newsSubject } from './noticeEmails.ts'
import { launchEmail } from '../notify-mobile-launch/launchEmail.ts'

export interface Fixture { name: string; el: () => string; en?: () => string }

const out = (o: { subject: string; html: string } | null) => (o ? `${o.subject}\n${o.html}` : 'null')

const ev = (id: string, title: string, category: string, date: string, amount: number | null, source: string | null = null) =>
  ({ id, title, category, event_date: date, amount, source, notes: null }) as unknown as CalendarEventsRow

const EVENTS = [
  ev('00000000-0000-4000-8000-000000000001', 'ΕΝΦΙΑ, 4η δόση', 'tax', '2026-11-30', 123.45, 'tax:enfia-instalment-2026-4'),
  ev('00000000-0000-4000-8000-000000000002', 'Boiler service', 'maintenance', '2026-11-30', 0),
  ev('00000000-0000-4000-8000-000000000003', 'Water bill', 'bills', '2026-12-01', 1234.5),
]
const PAY = new Map([['00000000-0000-4000-8000-000000000001', `${APP_URL}/plirosa/abc`]])

const rent = (id: string, tenant: string | null, prop: string | null, due: string, amount: number, m: number | null) =>
  ({ id, tenant_id: tenant, property_id: prop, due_date: due, amount, period_month: m, period_year: m ? 2026 : null }) as unknown as RentPaymentsRow
const RENT = [
  rent('r1', 't1', 'p1', '2026-11-01', 450, 11),
  rent('r2', null, 'p2', '2026-10-05', 1200.5, null),
]
const TENANTS = { t1: { id: 't1', full_name: 'Maria P.' } }
const PROPS = { p1: { id: 'p1', name: 'Kifisia flat' }, p2: { id: 'p2', name: 'Studio 2' } }
const TODAY = new Date('2026-11-18T00:00:00Z')

/** Ενας παραλήπτης με ΚΑΘΕ πεδίο του καταλόγου γεμάτο, για να φανεί κάθε κλάδος. */
const RICH: Personal = {
  name: 'Maria Papadopoulou', appUrl: APP_URL, unsubUrl: `${APP_URL}/unsubscribe/t`, plan: 'individual',
  properties: 3, propertyName: 'Kifisia flat', period: '10/2026', collected: 1234.5, expected: 1500, outstanding: 265.5,
  net: 980.25, amount: 450, tenantName: 'John Smith', daysOverdue: 12, deadlineDate: '30/11/2026',
  installmentNo: 4, installmentsTotal: 12, portfolioValue: 350000, occupancy: 72.5, days: 14, discountPct: 20,
  discountCode: 'BF20', trialDaysLeft: 5, billingLive: true, daysLeft: 7, invoiceAmount: 59.9, invoiceNumber: 'INV-1001',
  referralCode: 'MARIA10', rewardLabel: 'one free month', friendName: 'Nikos', device: 'iPhone', location: 'Athens',
  headline: 'Law 5000/2026', summaryText: 'A short summary.', leaseEndDate: '31/12/2026', insurerName: 'Acme Insurance',
  policyEndDate: '15/01/2027', certificateName: 'EPC', certificateEndDate: '01/02/2027', appointmentTitle: 'Viewing',
  appointmentDate: '20/11/2026', appointmentTime: '18:00', maintenanceTitle: 'Boiler service', maintenanceDate: '22/11/2026',
  contractorName: 'Fix Ltd', billType: 'Electricity', billDueDate: '25/11/2026', guestName: 'Anna', checkinDate: '19/11/2026',
  checkoutDate: '24/11/2026', cleaningDate: '24/11/2026', gapNights: 3, gapFrom: '01/12/2026', gapTo: '04/12/2026',
  reviewsCount: 18, rating: 4.8, featureName: 'Bank import', featureBenefit: 'Fewer clicks.', assistantSkill: 'loan comparisons',
  anniversaryYears: 2, clientName: 'Maria P.', requestItem: 'Bank statement', accountantName: 'Kostas', accountantEmail: 'acc@example.com',
  token: 'A'.repeat(43), expiresOn: '30/11/2026', acceptDays: 14, cardLast4: '4242', marketRent: 520, sharePct: 50,
  digestItems: [{ title: 'Water bill', detail: '45,00€' }, { title: 'Rent', detail: 'Kifisia flat' }],
}
/** Ο ίδιος χωρίς κανένα προαιρετικό πεδίο: οι κλάδοι της απουσίας. */
const BARE: Personal = { appUrl: APP_URL }

const ROWS = [
  { primary: 'Kifisia flat', secondary: 'John Smith', expected: 450, paid: 450 },
  { primary: 'Studio 2', secondary: 'Rent', expected: 1200.5, paid: 600 },
  { primary: 'Loft', secondary: 'Rent', expected: 300, paid: 0 },
  { primary: 'Garage', secondary: 'Rent', expected: 0, paid: 0 },
]
const RATES_CUR = { euribor_3m: 2.15, euribor_6m: 2.2, euribor_12m: 2.3, ecb_rate: 2, bog_housing_new: 3.4 }
const RATES_PREV = { euribor_3m: 2.1, euribor_6m: 2.2, euribor_12m: 2.35, ecb_rate: 2, bog_housing_new: null }
const UPDATES = [{ id: 'u1', title: 'Bank import', body_html: '<p>Upload a CSV.</p>', cta_label: '', cta_url: `${APP_URL}/x` }, { id: 'u2', title: 'Faster PDFs', body_html: '<p>Twice as fast.</p>' }]
const LAUNCH = { ios: 'https://www.apple.com/app-store/', android: 'https://play.google.com/store/search?q=PROPERWISE&c=apps', app: `${APP_URL}/dashboard` }

export const FIXTURES: Fixture[] = [
  // ── Κέλυφος ───────────────────────────────────────────────────────────
  { name: 'shell-default', el: () => emailShell({ bodyHtml: p('x') }) },
  { name: 'shell-unsub', el: () => emailShell({ bodyHtml: p('x'), preheader: 'pre', unsubUrl: `${APP_URL}/unsubscribe/t` }),
    en: () => emailShell({ bodyHtml: p('x'), preheader: 'pre', unsubUrl: `${APP_URL}/unsubscribe/t`, lang: 'en' }) },
  { name: 'shell-footer', el: () => emailShell({ bodyHtml: p('x'), footerNote: 'note', width: 480 }) },
  // ── Υπενθυμίσεις προθεσμιών ───────────────────────────────────────────
  ...(['7days', '3days', '1day', 'today', 'overdue'] as const).flatMap(t => [
    { name: `reminder-${t}-1`, el: () => out(buildEmail(EVENTS.slice(0, 1), t, PAY)), en: () => out(buildEmail(EVENTS.slice(0, 1), t, PAY, 'en')) },
    { name: `reminder-${t}-3`, el: () => out(buildEmail(EVENTS, t)), en: () => out(buildEmail(EVENTS, t, new Map(), 'en')) },
  ]),
  // ── Όχληση ενοικίου ───────────────────────────────────────────────────
  { name: 'dunning-1', el: () => out(buildDunningEmail(RENT.slice(0, 1), TENANTS, PROPS, TODAY, 'Υπενθύμιση', 1)),
    en: () => out(buildDunningEmail(RENT.slice(0, 1), TENANTS, PROPS, TODAY, noticeLabelOf(1, 'en'), 1, 'en')) },
  { name: 'dunning-2', el: () => out(buildDunningEmail(RENT, TENANTS, PROPS, TODAY, 'Δεύτερη υπενθύμιση', 2)),
    en: () => out(buildDunningEmail(RENT, TENANTS, PROPS, TODAY, noticeLabelOf(2, 'en'), 2, 'en')) },
  { name: 'dunning-3', el: () => out(buildDunningEmail(RENT, TENANTS, PROPS, TODAY, 'Τελική υπόμνηση', 3)),
    en: () => out(buildDunningEmail(RENT, TENANTS, PROPS, TODAY, noticeLabelOf(3, 'en'), 3, 'en')) },
  // ── Πρότυπα του emailTemplates.ts ─────────────────────────────────────
  ...(['free', 'individual', 'professional'] as const).map(plan =>
    ({ name: `welcome-${plan}`, el: () => out(welcomeEmail({ name: 'Maria Papadopoulou', plan })) })),
  ...(['solo', 'owner', 'agency', 'office'] as const).map(plan =>
    ({ name: `upgraded-${plan}`, el: () => out(planUpgradedEmail({ name: 'Maria', plan })) })),
  { name: 'downgraded-free', el: () => out(planDowngradedEmail({ name: 'Maria', plan: 'free' })) },
  { name: 'downgraded-owner', el: () => out(planDowngradedEmail({ plan: 'owner' })) },
  { name: 'new-property', el: () => out(newPropertyEmail({ name: 'Maria', propertyName: 'Kifisia flat' })) },
  { name: 'feedback', el: () => out(feedbackRequestEmail({ name: 'Maria' })) },
  { name: 'mobile-launch', el: () => out(mobileLaunchEmail({})) },
  { name: 'referral', el: () => out(referralInviteEmail({ name: 'Maria' })) },
  { name: 'upsell', el: () => out(upsellEmail({ name: 'Maria', toPlan: 'owner' })) },
  { name: 'upsell-disc', el: () => out(upsellEmail({ name: 'Maria', toPlan: 'agency', discountPct: 20, discountCode: 'BF20', seasonLabel: 'Black Friday' })) },
  { name: 'legislation', el: () => out(legislationUpdateEmail({ name: 'Maria', headline: 'Law 5000/2026', summaryHtml: 'Summary.' })) },
  { name: 'seasonal', el: () => out(seasonalCampaignEmail({ name: 'Maria', season: 'christmas', discountPct: 10, discountCode: 'XMAS' })) },
  { name: 'client-message', el: () => clientMessageEmail({ text: `Hello {{name}},\n\nSee ${APP_URL}.`, senderEmail: 'agent@example.com' }) },
  { name: 'client-message-anon', el: () => clientMessageEmail({ text: 'Hello' }) },
  // ── Οι αγγλικές εκδοχές των προτύπων του emailTemplates.ts (ίδια ονόματα, μόνο αγγλικά) ──
  ...(['free', 'individual', 'professional'] as const).map(plan =>
    ({ name: `welcome-${plan}-en`, el: () => out(welcomeEmail({ name: 'Maria', plan })), en: () => out(EN_TPL.welcomeEmail({ name: 'Maria', plan })) })),
  ...(['solo', 'owner', 'agency', 'office'] as const).map(plan =>
    ({ name: `upgraded-${plan}-en`, el: () => out(planUpgradedEmail({ name: 'Maria', plan })), en: () => out(EN_TPL.planUpgradedEmail({ name: 'Maria', plan })) })),
  { name: 'downgraded-free-en', el: () => out(planDowngradedEmail({ plan: 'free' })), en: () => out(EN_TPL.planDowngradedEmail({ plan: 'free' })) },
  { name: 'downgraded-owner-en', el: () => out(planDowngradedEmail({ plan: 'owner' })), en: () => out(EN_TPL.planDowngradedEmail({ plan: 'owner' })) },
  { name: 'new-property-en', el: () => out(newPropertyEmail({ propertyName: 'Kifisia flat' })), en: () => out(EN_TPL.newPropertyEmail({ propertyName: 'Kifisia flat' })) },
  { name: 'feedback-en', el: () => out(feedbackRequestEmail({})), en: () => out(EN_TPL.feedbackRequestEmail({})) },
  { name: 'mobile-launch-en', el: () => out(mobileLaunchEmail({})), en: () => out(EN_TPL.mobileLaunchEmail({})) },
  { name: 'referral-en', el: () => out(referralInviteEmail({})), en: () => out(EN_TPL.referralInviteEmail({})) },
  { name: 'upsell-en', el: () => out(upsellEmail({ toPlan: 'owner' })), en: () => out(EN_TPL.upsellEmail({ toPlan: 'owner' })) },
  { name: 'upsell-disc-en', el: () => out(upsellEmail({ toPlan: 'agency', discountPct: 20, discountCode: 'BF20', seasonLabel: 'Black Friday' })), en: () => out(EN_TPL.upsellEmail({ toPlan: 'agency', discountPct: 20, discountCode: 'BF20', seasonLabel: 'Black Friday' })) },
  { name: 'legislation-en', el: () => out(legislationUpdateEmail({ headline: 'Law 5000/2026', summaryHtml: 'Summary.' })), en: () => out(EN_TPL.legislationUpdateEmail({ headline: 'Law 5000/2026', summaryHtml: 'Summary.' })) },
  { name: 'seasonal-en', el: () => out(seasonalCampaignEmail({ season: 'christmas', discountPct: 10, discountCode: 'XMAS' })), en: () => out(EN_TPL.seasonalCampaignEmail({ season: 'christmas', discountPct: 10, discountCode: 'XMAS' })) },
  { name: 'client-message-en', el: () => clientMessageEmail({ text: 'Hello', senderEmail: 'agent@example.com' }), en: () => clientMessageEmail({ text: 'Hello', senderEmail: 'agent@example.com', lang: 'en' }) },
  // ── Ο κατάλογος: κάθε μήνυμα, γεμάτο και άδειο, στις δύο γλώσσες ──────
  ...Object.keys({ ...CATALOG, ...DIGESTS }).sort().flatMap(id => {
    const el = { ...CATALOG, ...DIGESTS }[id], en = { ...CATALOG_EN, ...DIGESTS_EN }[id]
    return [
      { name: `catalog-${id}`, el: () => out(el(RICH)), en: en ? () => out(en(RICH)) : undefined },
      { name: `catalog-${id}-bare`, el: () => out(el(BARE)), en: en ? () => out(en(BARE)) : undefined },
    ]
  }),
  // ── Πρόσκληση σε γραφείο και σε ομάδα ─────────────────────────────────
  { name: 'firm-invite', el: () => out(firmInviteEmail({ firmName: 'Acme & Co', role: 'associate', inviterEmail: 'boss@example.com', inviterName: 'Boss', inviteeEmail: 'new@example.com' })),
    en: () => out(firmInviteEmail({ firmName: 'Acme & Co', role: 'associate', inviterEmail: 'boss@example.com', inviterName: 'Boss', inviteeEmail: 'new@example.com' }, 'en')) },
  { name: 'firm-invite-anon', el: () => out(firmInviteEmail({ firmName: '', role: 'manager', inviterEmail: '', inviteeEmail: 'new@example.com' })),
    en: () => out(firmInviteEmail({ firmName: '', role: 'manager', inviterEmail: '', inviteeEmail: 'new@example.com' }, 'en')) },
  { name: 'org-invite', el: () => out(orgInviteEmail('Acme', 'boss@example.com', 'admin', `${APP_URL}/signup`)), en: () => out(orgInviteEmail('Acme', 'boss@example.com', 'admin', `${APP_URL}/signup`, 'en')) },
  { name: 'org-invite-anon', el: () => out(orgInviteEmail('', '', 'member', `${APP_URL}/signup`)), en: () => out(orgInviteEmail('', '', 'member', `${APP_URL}/signup`, 'en')) },
  // ── Δοκιμή, επιβεβαίωση, κυκλοφορία, ενημερωτικό ──────────────────────
  { name: 'test-notification', el: () => out(testEmailHtml()), en: () => out(testEmailHtml('en')) },
  { name: 'confirm-address', el: () => out(confirmEmailHtml(`${APP_URL}/epivevaiosi-email/t`, 'owner@example.com')), en: () => out(confirmEmailHtml(`${APP_URL}/epivevaiosi-email/t`, 'owner@example.com', 'en')) },
  { name: 'mobile-app-out', el: () => out(launchEmail(LAUNCH)), en: () => out(launchEmail(LAUNCH, 'en')) },
  { name: 'newsletter', el: () => `${newsSubject(UPDATES)}\n${newsLayout(UPDATES.map(u => updateBlock(u)).join(''), `${APP_URL}/unsubscribe/t`)}`,
    en: () => `${newsSubject(UPDATES, 'en')}\n${newsLayout(UPDATES.map(u => updateBlock(u, 'en')).join(''), `${APP_URL}/unsubscribe/t`, 'en')}` },
  // ── Μηνιαία κατάσταση και επιτόκια ────────────────────────────────────
  { name: 'statement', el: () => `${statementSubject(periodLabelOf(2026, 10))}\n${statementHtml(ROWS, 1950.5, 1050, periodLabelOf(2026, 10))}`,
    en: () => `${statementSubject(periodLabelOf(2026, 10, 'en'), 'en')}\n${statementHtml(ROWS, 1950.5, 1050, periodLabelOf(2026, 10, 'en'), 'en')}` },
  { name: 'market-digest', el: () => `${digestSubject()}\n${digestLayout(digestRows(RATES_CUR, RATES_PREV), `${APP_URL}/unsubscribe/t`)}`,
    en: () => `${digestSubject('en')}\n${digestLayout(digestRows(RATES_CUR, RATES_PREV, 'en'), `${APP_URL}/unsubscribe/t`, 'en')}` },
]
