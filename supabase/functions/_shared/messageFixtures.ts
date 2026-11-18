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
  clientMessageEmail, p,
} from './emailTemplates.ts'

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
]
