import { eyebrow, h, p, button, note, heroStat } from '../../emailTemplates.ts'
import { eur } from '../../format.ts'
import { dash, esc, has, offer, type CopyFn } from '../kit.ts'
import { shell, hi, NOTE, codeLine } from './kit.ts'

// ── Win-back (twin of ../winback.ts) ───────────────────────────────────────
export const WINBACK: Record<string, CopyFn> = {

  inactive_30: (c) => {
    const proof = has(c.collected)
      ? p(`You have already organised <b>${eur(c.collected)}</b> in collections here. It would be a shame to leave it half done.`)
      : p('You started something good here. It would be a shame to leave it half done.')
    return { subject: 'It’s been a while. Everything is waiting for you', html: shell({
      preheader: 'Your account is exactly as you left it.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('We thought of you') + h('It’s been a little while') + hi(c)
        + p('We haven’t seen you here for a few weeks. Your properties, collections and history are all there, exactly as you left them.')
        + proof
        + button('Pick up where you left off', dash(c))
        + note('If something got in your way, reply and tell us. We want to help.'),
    }) }
  },

  inactive_60: (c) => ({
    subject: 'Shall we keep your data safe?',
    html: shell({
      preheader: 'Nothing is lost. We’re here.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Still here for you') + h('We haven’t forgotten you') + hi(c)
        + p('A few months have passed since your last visit. Your data remains safe and yours, whenever you decide to come back.')
        + p('If something didn’t work for you, tell us. It helps us get better.')
        + button('Take another look', dash(c))
        + note(NOTE.dataOwn),
    }),
  }),

  winback_offer: (c) => {
    const o = offer(c)
    if (!o) return null
    return { subject: `A reason to come back: ${o.pct}% off`, html: shell({
      preheader: 'Start again with the full PROPERWISE.',
      unsubUrl: c.unsubUrl,
      hero: heroStat(`${o.pct}%`, 'discount'),
      bodyHtml: eyebrow('Welcome back') + h('A gift for your return') + hi(c)
        + p(`We know daily life moves fast. If you want to put your properties back in order, we are keeping a <b>${o.pct}%</b> discount on the upgrade for you.`)
        + codeLine(o)
        + p('Your account is ready, with everything you left in its place.')
        + button(`Claim the ${o.pct}%`, dash(c))
        + note(NOTE.cancel),
    }) }
  },

  churn_survey: (c) => ({
    subject: 'One minute, to help us get better',
    html: shell({
      preheader: 'Your honest opinion counts.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Your opinion') + h('What would have kept you?') + hi(c)
        + p('We haven’t seen you for a while and we respect that. Before you leave altogether, we would like to learn one thing: what was missing for you to carry on with PROPERWISE?')
        + p('One honest answer from you is worth as much as ten meetings to us. Reply directly to this message.')
        + button('Tell us what you think', dash(c))
        + note(NOTE.reply),
    }),
  }),

  data_retention_notice: (c) => {
    const when = c.deadlineDate ? ` by <b>${esc(c.deadlineDate)}</b>` : ' soon'
    return { subject: 'Keep your account active', html: shell({
      preheader: 'One move is enough to keep everything alive.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Your account') + h('Let’s keep your data alive') + hi(c)
        + p(`You haven’t signed in for a while. To keep your account and history active, sign in${when}. One click is enough.`)
        + p('Your data remains yours. We simply want it to be there whenever you need it.')
        + button('Keep it active', dash(c))
        + note(NOTE.dataOwn),
    }) }
  },
}
