import { eyebrow, h, p, bullets, button, note, type Personal } from '../../emailTemplates.ts'
import { dash, esc, type CopyFn } from '../kit.ts'
import { EMAIL_LIGHT as C } from '../../emailPalette.ts'
import { shell, hi, NOTE } from './kit.ts'

// ── Digests (twin of ../digests.ts) ────────────────────────────────────────
const digestList = (items?: Personal['digestItems']) =>
  bullets((items && items.length ? items : [{ title: 'See the details in your dashboard' }])
    .map(it => `<b>${esc(it.title)}</b>${it.detail ? ` <span class="mu" style="color:${C.mute};">${esc(it.detail)}</span>` : ''}`))

export const DIGESTS: Record<string, CopyFn> = {

  digest_obligations: (c) => {
    const n = c.digestItems?.length || 0
    return { subject: n > 1 ? `${n} items need your attention` : 'One item needs your attention', html: shell({
      preheader: 'Everything due today, gathered in one message.',
      bodyHtml: eyebrow('Reminder') + h('What needs your attention') + hi(c)
        + p('So your inbox doesn’t fill up, we gathered it all here:')
        + digestList(c.digestItems)
        + button('Open your dashboard', dash(c))
        + note('One message a day for whatever falls due. Your data is yours.'),
    }) }
  },

  digest_tax: (c) => ({
    subject: 'Your tax deadlines', html: shell({
      preheader: 'Form E2, ENFIA and installments, at a glance.',
      bodyHtml: eyebrow('Tax calendar') + h('Your deadlines, gathered') + hi(c)
        + p('The tax obligations coming up, in one message:')
        + digestList(c.digestItems)
        + button('See the calendar', dash(c))
        + note(NOTE.aade),
    }),
  }),

  digest_str_today: (c) => ({
    subject: 'Today’s schedule', html: shell({
      preheader: 'Arrivals, departures and cleanings for today.',
      bodyHtml: eyebrow('Short-term rentals') + h('Your day today') + hi(c)
        + p('What is happening today at your rentals:')
        + digestList(c.digestItems)
        + button('Open the calendar', dash(c))
        + note('One message in the morning for the whole day, with no interruptions.'),
    }),
  }),
}
