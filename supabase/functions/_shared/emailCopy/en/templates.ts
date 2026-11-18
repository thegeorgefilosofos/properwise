// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΠΡΟΤΥΠΑ ΤΟΥ emailTemplates.ts ΣΤΑ ΑΓΓΛΙΚΑ (welcome, πακέτο, ακίνητο…)
// ─────────────────────────────────────────────────────────────────────────
// Ενα δίδυμο για κάθε πρότυπο που καλεί η send-lifecycle-email με `event`.
// Ιδια υπογραφή, ίδια γεγονότα· τα όρια ακινήτων από το ίδιο αντίγραφο.
// ═══════════════════════════════════════════════════════════════════════════
import {
  eyebrow, h, p, bullets, button, note, packageOf, PACKAGE_MAX_PROPERTIES,
  type Ctx, type Plan, type PackageId, type Season,
} from '../../emailTemplates.ts'
import { esc } from '../kit.ts'
import { APP_URL } from '../../site.ts'
import { shell, hi, PACKAGE_NAME_EN } from './kit.ts'

type Out = { subject: string; html: string }
const app = (c: Ctx) => c.appUrl || APP_URL
const dashOf = (c: Ctx) => `${app(c)}/dashboard`

function packagePerks(pkg: PackageId): string[] {
  const max = PACKAGE_MAX_PROPERTIES[pkg]
  const limit = max == null ? 'Unlimited properties' : max === 1 ? '1 property, with all the basics' : `Up to ${max} properties`
  switch (pkg) {
    case 'solo': return [`${limit}.`, 'Noa in Greek, for every question about your property.', 'Document scanning with no monthly limit.']
    case 'owner': return [`${limit}.`, 'Property comparison: which one performs and which one costs.', 'Noa in Greek and document scanning with no monthly limit.']
    case 'agency': return [`${limit}, with an overall portfolio picture.`, 'Reports with your branding and bulk email to clients.', 'A client list and a team with roles.']
    case 'office': return [`${limit}.`, 'Reports with your branding and bulk email to clients.', 'A team with no user limit.']
  }
}

export function welcomeEmail(c: Ctx & { plan?: Plan }): Out {
  const plan = c.plan || 'free'
  const next: Record<Plan, string[]> = {
    free: ['Add your first property.', 'See income, expenses and tax with your own figures.', 'Ask Noa about your properties.'],
    individual: ['Record properties, tenants and collections.', 'Create statements and rent certificates as PDF.', 'Let the reminders run on their own.'],
    professional: ['See your portfolio as a whole.', 'Send reports with your branding.', 'Keep bookkeeping, taxes and deadlines for every property.'],
  }
  const body = eyebrow('Welcome') + h('Get started with PROPERWISE')
    + hi(c)
    + p('We’re glad you’re here. The first steps:')
    + bullets(next[plan])
    + button('Open the dashboard', dashOf(c))
    + note('For anything you need, reply to this email.')
  return { subject: 'Welcome to PROPERWISE', html: shell({ bodyHtml: body, preheader: 'The first steps to get started.' }) }
}

export function planUpgradedEmail(c: Ctx & { plan: Plan | PackageId }): Out | null {
  const pkg = packageOf(c.plan)
  if (!pkg) return null
  const name = `“${PACKAGE_NAME_EN[pkg]}”`
  const body = eyebrow('Upgrade') + h(`Your plan is now ${name}`)
    + hi(c)
    + p('Thank you for your trust. What it adds:')
    + bullets(packagePerks(pkg))
    + button('Open the dashboard', dashOf(c))
    + note('You’ll find the receipt in your Account, under Subscription.')
  return { subject: `Welcome to the ${name} plan`, html: shell({ bodyHtml: body, preheader: 'Thank you. Here is what your plan adds.' }) }
}

export function planDowngradedEmail(c: Ctx & { plan: Plan | PackageId }): Out {
  const pkg = packageOf(c.plan)
  const title = pkg ? `Your plan is now “${PACKAGE_NAME_EN[pkg]}”` : 'You carry on on the “Owner” plan, without a subscription'
  const body = eyebrow('Plan change') + h(title)
    + hi(c)
    + p('We have recorded the change. Your data stays in your account.')
    + (pkg ? '' : p('You keep one property with all its tax tools: form E2 for the accountant, ENFIA, tenant and collections. Noa is not included without a subscription.'))
    + p('If you want to change plan again, the Subscription section is in your Account.')
    + button('Open your Account', `${app(c)}/dashboard?tab=settings`)
    + note('If something didn’t go as you expected, reply to this email and tell us what would help.')
  return { subject: 'An update about your subscription', html: shell({ bodyHtml: body, preheader: 'Your data stays in your account.' }) }
}

export function newPropertyEmail(c: Ctx & { propertyName: string }): Out {
  const body = eyebrow('New property') + h('The property has been added')
    + hi(c)
    + p(`<b>${esc(c.propertyName)}</b> is now in your portfolio. For it to run “on its own”, complete:`)
    + bullets(['Lease and tenant details.', 'Income and expenses for automatic bookkeeping.', 'Reminders for payments and expiries.'])
    + button('Open the property', `${app(c)}/dashboard?tab=overview`)
  return { subject: `Added: ${c.propertyName}`, html: shell({ bodyHtml: body, preheader: 'Complete the property’s settings.' }) }
}

export function feedbackRequestEmail(c: Ctx): Out {
  const body = eyebrow('Your opinion') + h('How is it going so far?')
    + hi(c)
    + p('About a week has passed with PROPERWISE. What did you like, what was hard, what is missing?')
    + p('Reply to this email. We read every reply.')
  return { subject: 'How do you find PROPERWISE?', html: shell({ bodyHtml: body, preheader: 'Three questions, one reply to this email.' }) }
}

export function mobileLaunchEmail(c: Ctx): Out {
  const body = eyebrow('Coming soon') + h('PROPERWISE on your phone')
    + hi(c)
    + p('We are preparing the mobile app. Your properties, collections and notifications, wherever you are.')
    + bullets(['Real-time notifications.', 'Quick entry of income and expenses.', 'Document scanning with one tap.'])
    + note('We will let you know by email as soon as it is released.')
  return { subject: 'PROPERWISE is coming to your phone', html: shell({ bodyHtml: body, preheader: 'We will let you know as soon as it is released.' }) }
}

export function referralInviteEmail(c: Ctx): Out {
  const body = eyebrow('Referrals') + h('Earn by recommending PROPERWISE')
    + hi(c)
    + p('Know someone with property? Recommend PROPERWISE to them and <b>you earn with every active referral</b>.')
    + bullets(['A unique invitation link, your own.', 'A reward for every active friend you bring.', 'Track invitations and rewards in real time.'])
    + button('See the programme', `${app(c)}/dashboard?tab=settings`)
  return { subject: 'Recommend PROPERWISE and earn', html: shell({ bodyHtml: body, preheader: 'With every active referral you earn.' }) }
}

export function upsellEmail(c: Ctx & { toPlan?: Plan | PackageId; discountPct?: number; discountCode?: string; seasonLabel?: string }): Out {
  const pkg = packageOf(c.toPlan) || 'solo'
  const name = `“${PACKAGE_NAME_EN[pkg]}”`
  const code = (c.discountCode || '').trim()
  const disc = code && c.discountPct && c.discountPct > 0 ? c.discountPct : 0
  const seasonLine = c.seasonLabel ? ` <b>${esc(c.seasonLabel)}</b>` : ''
  const body = eyebrow(disc ? `Offer${seasonLine ? ' ·' : ''}${seasonLine}` : 'Upgrade')
    + h(disc ? `${disc}% off the ${name} plan` : `What the ${name} plan adds`)
    + hi(c)
    + p(`If PROPERWISE is useful to you in the trial, here is what <b>${name}</b> adds:`)
    + bullets(packagePerks(pkg))
    + (disc ? p(`Enter the code <b>${esc(code)}</b> at checkout and the discount is applied to the charge.`) : '')
    + button('See Subscription', `${app(c)}/dashboard?tab=settings`)
    + note('Subscription is in your Account. If it isn’t relevant to you now, you don’t need to do anything.')
  const subj = disc ? `${disc}% off${c.seasonLabel ? ` · ${c.seasonLabel}` : ''} PROPERWISE` : `What the ${name} plan adds`
  return { subject: subj, html: shell({ bodyHtml: body, preheader: disc ? `${disc}% off ${name} with a code.` : `What ${name} adds.` }) }
}

export function legislationUpdateEmail(c: Ctx & { headline: string; summaryHtml: string }): Out {
  const body = eyebrow('Property law') + h(esc(c.headline))
    + hi(c)
    + p(c.summaryHtml)
    + p('See whether it affects your property.')
    + button('Open the dashboard', dashOf(c))
    + note('For information, from official sources. For how it applies in the end, confirm with your accountant or on myAADE/gov.gr.')
  return { subject: `PROPERWISE · ${c.headline}`, html: shell({ bodyHtml: body, preheader: 'What changes and what you need to do.' }) }
}

/** Οι εποχές στα αγγλικά. Το «Black Friday» και το «Cyber Monday» μένουν ως έχουν. */
export const SEASON_LABEL_EN: Record<Season, string> = {
  black_friday: 'Black Friday', cyber_monday: 'Cyber Monday', christmas: 'Christmas', new_year: 'New Year',
}

export function seasonalCampaignEmail(c: Ctx & { season: Season; toPlan?: Plan | PackageId; discountPct?: number; discountCode?: string }): Out {
  return upsellEmail({ ...c, seasonLabel: SEASON_LABEL_EN[c.season], toPlan: c.toPlan })
}
