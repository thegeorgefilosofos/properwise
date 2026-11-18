import { eyebrow, h, p, button, note, heroStat } from '../../emailTemplates.ts'
import { dash, offer, type CopyFn } from '../kit.ts'
import { shell, hi, NOTE, codeLine } from './kit.ts'

// ── Seasonal (twin of ../seasonal.ts) ──────────────────────────────────────
export const SEASONAL: Record<string, CopyFn> = {

  black_friday: (c) => {
    const o = offer(c)
    if (!o) return null
    return { subject: `Black Friday: ${o.pct}% off PROPERWISE`, html: shell({
      preheader: 'The Black Friday offer.',
      unsubUrl: c.unsubUrl,
      hero: heroStat(`${o.pct}%`, 'discount'),
      bodyHtml: eyebrow('Black Friday') + h('Once a year') + hi(c)
        + p(`For Black Friday, unlock the full PROPERWISE with <b>${o.pct}%</b> off and start the new year with your properties in order.`)
        + codeLine(o)
        + button(`Claim the ${o.pct}%`, dash(c))
        + note(NOTE.cancel),
    }) }
  },

  cyber_monday: (c) => {
    const o = offer(c)
    if (!o) return null
    return { subject: `Cyber Monday: ${o.pct}% off PROPERWISE`, html: shell({
      preheader: 'The Cyber Monday offer.',
      unsubUrl: c.unsubUrl,
      hero: heroStat(`${o.pct}%`, 'discount'),
      bodyHtml: eyebrow('Cyber Monday') + h('One day, one chance') + hi(c)
        + p(`If you were waiting for the right moment, this is it: the full PROPERWISE with <b>${o.pct}%</b> off.`)
        + codeLine(o)
        + button(`Claim the ${o.pct}%`, dash(c))
        + note(NOTE.cancel),
    }) }
  },

  christmas: (c) => {
    const o = offer(c)
    return { subject: 'Close the year with your properties in order', html: shell({
      preheader: o ? 'A gift for your new year.' : 'Season’s greetings from PROPERWISE.',
      unsubUrl: c.unsubUrl,
      ...(o ? { hero: heroStat(`${o.pct}%`, 'holiday gift') } : {}),
      bodyHtml: eyebrow('Christmas') + h('Season’s greetings from PROPERWISE') + hi(c)
        + p('Thank you for trusting us with your properties this year. We wish you calm holidays and a new year with clean books.')
        + (o ? p(`As a gift, unlock the full PROPERWISE with <b>${o.pct}%</b> off and start the year with nothing pending.`) + codeLine(o) : '')
        + button(o ? `Claim the ${o.pct}%` : 'Open PROPERWISE', dash(c))
        + note(o ? NOTE.cancel : NOTE.dataOwn),
    }) }
  },

  new_year: (c) => {
    const o = offer(c)
    if (!o) return null
    return { subject: 'New year, clean books', html: shell({
      preheader: 'Start the year with clean books.',
      unsubUrl: c.unsubUrl,
      hero: heroStat(`${o.pct}%`, 'discount'),
      bodyHtml: eyebrow('New Year') + h('A clean start for your properties') + hi(c)
        + p('The start of the year is a good starting point for your properties. Income, expenses and taxes, in place from day one.')
        + p(`To start, we are keeping a <b>${o.pct}%</b> discount on the upgrade for you.`)
        + codeLine(o)
        + button(`Start with ${o.pct}%`, dash(c))
        + note(NOTE.cancel),
    }) }
  },

  tax_season: (c) => {
    const o = offer(c)
    return { subject: 'Go into tax season without stress', html: shell({
      preheader: 'Your rents, ready for form E2.',
      unsubUrl: c.unsubUrl,
      ...(o ? { hero: heroStat(`${o.pct}%`, 'discount') } : {}),
      bodyHtml: eyebrow('Tax season') + h('The tax return without the rush') + hi(c)
        + p('Tax return season is approaching. With PROPERWISE, rents per property are gathered on their own and form E2 (the property income schedule) is prepared without last-minute stress.')
        + (o ? p(`For the season, the subscription is <b>${o.pct}%</b> off.`) + codeLine(o) : '')
        + button(o ? `Get ready with ${o.pct}%` : 'See your form E2', dash(c))
        + note(NOTE.aade),
    }) }
  },

  summer_str: (c) => {
    const o = offer(c)
    if (!o) return null
    return { subject: 'Short-term rental season is starting', html: shell({
      preheader: 'Bookings, income and calendar together.',
      unsubUrl: c.unsubUrl,
      hero: heroStat(`${o.pct}%`, 'discount'),
      bodyHtml: eyebrow('Summer season') + h('The season is starting. Let’s go together') + hi(c)
        + p('Summer brings bookings, guest changeovers and running expenses. PROPERWISE syncs Airbnb and Booking, records the income and keeps your calendar clean.')
        + p(`Go into the season organised, with <b>${o.pct}%</b> off the upgrade.`)
        + codeLine(o)
        + button(`Start with ${o.pct}%`, dash(c))
        + note(NOTE.cancel),
    }) }
  },
}
