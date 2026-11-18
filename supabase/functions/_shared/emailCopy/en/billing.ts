import { eyebrow, h, p, button, note } from '../../emailTemplates.ts'
import { eur } from '../../format.ts'
import { dash, esc, has, type CopyFn } from '../kit.ts'
import { shell, hi, NOTE } from './kit.ts'

// ── Subscription & billing (twin of ../billing.ts) ─────────────────────────
export const BILLING: Record<string, CopyFn> = {

  card_expiring: (c) => {
    const tail = c.cardLast4 ? `ending in <b>${esc(c.cardLast4)}</b>` : 'you pay with'
    const when = c.deadlineDate ? ` before the renewal on <b>${esc(c.deadlineDate)}</b>` : ''
    return { subject: 'Your payment card expires soon', html: shell({
      preheader: 'A quick update prevents an interruption.',
      bodyHtml: eyebrow('Subscription') + h('Update your card') + hi(c)
        + p(`The card ${tail} expires soon. Update it${when}, so your subscription carries on without interruption.`)
        + button('Update the card', dash(c))
        + note('It takes less than a minute and saves you from an unintended interruption.'),
    }) }
  },

  charge_upcoming: (c) => {
    const first = has(c.trialDaysLeft)
    const when = c.deadlineDate ? `on <b>${esc(c.deadlineDate)}</b>` : 'at the next renewal'
    const sum = has(c.amount) ? `<b>${eur(c.amount)}</b>` : 'your subscription amount'
    return {
      subject: first ? 'Your trial ends and your subscription begins' : 'Your subscription renews soon',
      html: shell({
        preheader: 'How much, when, and how to stop it if you don’t want it.',
        bodyHtml: eyebrow('Subscription')
          + h(first ? 'Your subscription begins' : 'The renewal is coming')
          + hi(c)
          + p(first
            ? `Your trial period ends and the first charge is made ${when}: ${sum}.`
            : `Your subscription renews ${when} and ${sum} will be charged.`)
          + p('You don’t need to do anything to carry on. If you don’t want the renewal, cancel or change plan before that date.')
          + button('See your subscription', dash(c))
          + note(NOTE.cancel),
      }),
    }
  },

  account_lapse_warning: (c) => {
    const left = has(c.daysLeft) ? Number(c.daysLeft) : 0
    const last = left <= 2
    const when = c.deadlineDate ? `on <b>${esc(c.deadlineDate)}</b>` : 'soon'
    const count = left === 1 ? 'in one day' : `in ${left} days`
    return {
      subject: last ? 'Your account will be deleted tomorrow' : 'Your account will be deleted in one week',
      html: shell({
        preheader: `Your account and its data will be deleted ${count}.`,
        bodyHtml: eyebrow('Account')
          + h(last ? 'Final reminder' : 'Your account is expiring')
          + hi(c)
          + p(`Your account has no active subscription. The account and all its data, properties, documents, expenses and contacts, will be permanently deleted ${when}, that is ${count}.`)
          + p('You have two options, inside the app: activate a subscription, so the account carries on as it was, or download your data and leave with it in your hands.')
          + button('Open your account', dash(c))
          + note('Deletion is permanent: after that date there is no way to bring the data back.'),
      }),
    }
  },
}
