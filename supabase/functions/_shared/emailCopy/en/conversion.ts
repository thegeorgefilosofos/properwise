import { eyebrow, h, p, bullets, button, note, heroStat, PACKAGE_MAX_PROPERTIES } from '../../emailTemplates.ts'
import { eur } from '../../format.ts'
import { dash, esc, has, type CopyFn } from '../kit.ts'
import { shell, hi, plural, NOTE, PACKAGE_NAME_EN, FREE_PLAN_EN } from './kit.ts'

// ── Conversion (twin of ../conversion.ts) ──────────────────────────────────
export const CONVERSION: Record<string, CopyFn> = {

  roi_proof: (c) => {
    const money = has(c.collected) ? p(`Along the way, it organised <b>${eur(c.collected)}</b> in collections without anything getting lost.`) : ''
    const fallback = !has(c.collected) ? p('Every automatic reminder, every ready-made report and every entry you didn’t have to make by hand is time you gained.') : ''
    return { subject: 'What PROPERWISE has given you', html: shell({
      preheader: 'The time you gained, in numbers.', unsubUrl: c.unsubUrl,
      hero: has(c.collected) ? heroStat(eur(c.collected), 'organised collections') : '',
      bodyHtml: eyebrow('Your value') + h('Let’s see what you gained') + hi(c)
        + money + fallback
        + p('With an upgrade, that time grows: more automation, deeper analysis, less effort.')
        + button('See what more you gain', dash(c))
        + note(NOTE.cancel),
    }) }
  },

  plan_comparison: (c) => {
    const use = has(c.properties) ? `You have <b>${plural(c.properties, 'property', 'properties')}</b> in your portfolio. ` : ''
    return { subject: 'Which plan suits the way you use it', html: shell({
      preheader: 'A clear comparison, no small print.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Plan comparison') + h('Let’s find the right plan for you') + hi(c)
        + p(`${use}It’s worth seeing what each plan offers compared with how you use PROPERWISE today.`)
        + bullets([
            `${FREE_PLAN_EN}: no subscription, 1 property with the tax tools, reminders and PDF reports with QR verification.`,
            `${PACKAGE_NAME_EN.solo}: the same, with Noa and unlimited scanning.`,
            `${PACKAGE_NAME_EN.owner}: up to ${PACKAGE_MAX_PROPERTIES.owner} properties and property comparison.`,
            `${PACKAGE_NAME_EN.agency}: up to ${PACKAGE_MAX_PROPERTIES.agency} properties, reports with your branding, allocation to co-owners.`,
            `${PACKAGE_NAME_EN.office}: unlimited properties and a team with no user limit.`,
          ])
        + button('Compare the plans', dash(c))
        + note(NOTE.cancel),
    }) }
  },

  social_proof: (c) => ({
    subject: 'What PROPERWISE does for your properties',
    html: shell({
      preheader: 'The routine work, on autopilot.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Why PROPERWISE') + h('Built for how things work in Greece') + hi(c)
        + p('Rents, expenses, taxes and reminders, with your own figures.')
        + bullets([
            'Greek taxes, ENFIA and form E2, with an indicative calculation under the rules in force.',
            'Automatic reminders that keep your obligations in front of you.',
            'Noa, who answers with your own data.',
          ])
        + button('See why', dash(c))
        + note(`${NOTE.aade} ${NOTE.cancel}`),
    }),
  }),

  rent_benchmark_alert: (c) => {
    const ref = c.propertyName ? ` for “${esc(c.propertyName)}”` : ''
    const cmp = (has(c.amount) && has(c.marketRent))
      ? p(`The rent${ref} is <b>${eur(c.amount)}</b>, while the area average is around <b>${eur(c.marketRent)}</b>. You may be leaving income on the table.`)
      : p(`Rents in the area of the property${ref} have moved. It’s worth checking whether yours keeps up with the market.`)
    return { subject: 'Your rent compared with the market', html: shell({
      preheader: 'A look that may pay off.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Market data') + h('How your rent compares') + hi(c)
        + cmp
        + p('PROPERWISE compares your rent with the market and shows you when an adjustment is worth it, always within the legal limits.')
        + button('See the comparison', dash(c))
        + note(NOTE.legal),
    }) }
  },
}
