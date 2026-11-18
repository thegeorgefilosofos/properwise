import { eyebrow, h, p, bullets, button, note, senderIdentity } from '../../emailTemplates.ts'
import { eur } from '../../format.ts'
import { app, dash, esc, escAttr, has, type CopyFn } from '../kit.ts'
import { ACCOUNTANT_INVITE_RETENTION_DAYS } from '../../accountantInvite.ts'
import { SUPPORT_EMAIL } from '../../sender.mjs'
import { shell, hi, packageNameEn, NOTE } from './kit.ts'

// ── Lifecycle, legal & transactions (twin of ../lifecycle.ts) ──────────────
export const LIFECYCLE: Record<string, CopyFn> = {

  subscription_receipt: (c) => {
    const amt = has(c.invoiceAmount) ? eur(c.invoiceAmount) : ''
    const num = c.invoiceNumber ? esc(c.invoiceNumber) : ''
    const pkg = packageNameEn(c.plan)
    const planLine = pkg ? `the <b>${pkg}</b> plan` : 'your subscription'
    const detail = (amt || num)
      ? p(`${num ? `Document <b>${num}</b>. ` : ''}${amt ? `Amount <b>${amt}</b>. ` : ''}It covers ${planLine}.`)
      : p(`The payment for ${planLine} was recorded as normal.`)
    return { subject: c.invoiceNumber ? `Subscription receipt ${esc(c.invoiceNumber)}` : 'Your subscription receipt', html: shell({
      preheader: 'Your payment is complete.',
      bodyHtml: eyebrow('Receipt') + h('Thank you for your subscription') + hi(c)
        + p('We received your payment and everything is in order. Here are the details for your records:')
        + detail
        + p('The full receipt is available in your Account, under Subscription. The receipt itself is issued in Greek.')
        + button('See your subscription', dash(c))
        + note('Keep this message for your records.'),
    }) }
  },

  plan_changed: (c) => {
    const pkg = packageNameEn(c.plan)
    const planSentence = pkg ? `Your plan is now <b>${pkg}</b>.` : 'Your plan has just been updated.'
    return { subject: 'Your plan has been updated', html: shell({
      preheader: 'The change has been recorded.',
      bodyHtml: eyebrow('Plan change') + h('The change is complete') + hi(c)
        + p(`${planSentence} The change takes effect immediately and your data remains intact.`)
        + p('If you didn’t make this change, reply to this message and we will look into it right away.')
        + button('See your account', dash(c))
        + note(NOTE.dataOwn),
    }) }
  },

  payment_failed: (c) => ({
    subject: 'Your subscription payment didn’t go through',
    html: shell({
      preheader: 'A quick update of your card fixes it.',
      bodyHtml: eyebrow('Payment') + h('Something went wrong with the payment') + hi(c)
        + p('We tried to renew your subscription, but the payment didn’t go through. Usually it’s an expired card or a temporary limit.')
        + p('Update your payment details and everything carries on as normal, with no interruption.')
        + button('Update your payment', dash(c))
        + note('We will try again automatically over the next few days.'),
    }),
  }),

  security_login: (c) => {
    const dv = c.device ? esc(c.device) : ''
    const loc = c.location ? esc(c.location) : ''
    const detail = (dv || loc)
      ? p(`Sign-in${dv ? ` from <b>${dv}</b>` : ''}${loc ? `${dv ? ', ' : ' from '}${loc}` : ''}.`)
      : p('We recorded a new sign-in to your account.')
    return { subject: 'New sign-in to your account', html: shell({
      preheader: 'If it was you, there’s nothing to do.',
      bodyHtml: eyebrow('Security') + h('A new sign-in') + hi(c)
        + detail
        + p('If it was you, everything is fine. If not, change your password right away and let us know.')
        + button('Check your security', dash(c))
        + note('We never ask for your password by email.'),
    }) }
  },

  accountant_request_answered: (c) => ({
    subject: `${esc(c.clientName || 'Your client')}: what you asked for has arrived`,
    html: shell({
      preheader: 'Your request has been answered.',
      bodyHtml: eyebrow('Accountant portal') + h('Your client replied') + hi(c)
        + p(`<b>${esc(c.clientName || 'Your client')}</b> marked this request as answered:`)
        + p(`<b>${esc(c.requestItem || 'Request')}</b>`)
        + p('Its status is up to date in the portal, with the year’s amounts and anything still missing.')
        + button('See your clients', `${app(c)}/accountant/workspace`)
        + note('The owner marking it does not mean we have checked it.'),
    }),
  }),

  accountant_invite: (c) => {
    const mail = c.accountantEmail ? esc(c.accountantEmail) : ''
    const claimed = c.accountantName && c.accountantName !== c.accountantEmail
      ? ` (who says they are “${esc(c.accountantName)}”)` : ''
    const who = senderIdentity()
    const privacy = `${app(c)}/en/privacy`
    return {
      subject: mail ? `${mail} is asking for access to your file on PROPERWISE` : 'A request for access to your file on PROPERWISE',
      html: shell({
        preheader: 'Accept only if you know the sender.',
        footerNote: `You received this message because the account ${mail || 'of a user'} entered this address in PROPERWISE.${who ? ` ${esc(who)}.` : ''}`
          + ' Legal basis: the sender’s legitimate interest in contacting you about the file of your properties (Article 6(1)(f) GDPR).'
          + ' You can object. If you have an account, answering “No” in Accounting means you won’t get another invitation from this sender; we keep only your address to honour that, until you delete your account.'
          + ` With or without an account, reply to this message or write to <a class="lnk" href="mailto:${escAttr(SUPPORT_EMAIL)}" style="color:inherit;text-decoration:underline;">${esc(SUPPORT_EMAIL)}</a>: you won’t get an invitation from any sender again and we keep only a fingerprint of your address, not the address itself.`
          + ` If you don’t reply, your address is erased from invitations in ${ACCOUNTANT_INVITE_RETENTION_DAYS} days. <a class="lnk" href="${escAttr(privacy)}" style="color:inherit;text-decoration:underline;">Privacy policy</a>`,
        bodyHtml: eyebrow('Access request') + h('Someone is asking to see your file') + hi(c)
          + p(`The account <b>${mail || 'of a user'}</b>${claimed} is asking to see the file of your properties on PROPERWISE, read-only.`)
          + p('If you accept, they will see your tax number (AFM), properties, leases, rents, expenses and your tenants’ details. Until then they see nothing.')
          + p('<b>Accept only if you know the sender.</b> If you don’t know them, ignore this message or tap “No” in Accounting and you won’t get another invitation from them.')
          + button('Open Accounting', `${app(c)}/dashboard?tab=accounting`)
          + note('To reply, sign in with this address. You can revoke access whenever you like from Settings.'),
      }),
    }
  },

  reply_ack: (c) => ({
    subject: 'We received your message',
    html: shell({
      preheader: 'Thank you. We will reply soon.',
      bodyHtml: eyebrow('Contact') + h('Your message arrived') + hi(c)
        + p('Thank you for writing to us. Your message has been recorded and a member of our team will read it and reply as soon as possible.')
        + p('If it’s something urgent about one of your properties, you can ask Noa inside the app in the meantime. Noa knows your data and answers straight away.')
        + button('Ask Noa', dash(c))
        + note('This is an automatic confirmation. The personal reply comes from a person.'),
    }),
  }),

  mobile_launch: (c) => ({
    subject: 'PROPERWISE is coming to your phone',
    html: shell({
      preheader: 'Join the waiting list early.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Coming soon') + h('Your properties, with you everywhere') + hi(c)
        + p('We are preparing the mobile app. Your collections, notifications and properties, in your pocket, wherever you are.')
        + bullets([
            'Real-time notifications for collections and deadlines.',
            'Quick entry of income and expenses with a few taps.',
            'Ask Noa about your properties, wherever you are.',
          ])
        + p('Until it is released, open PROPERWISE in your phone’s browser and add it to your home screen, like an app.')
        + button('Join the waiting list', dash(c))
        + note('You will be among the first we notify as soon as it is ready.'),
    }),
  }),

  legislation_update: (c) => {
    const head = c.headline ? esc(c.headline) : 'A change that concerns you'
    const summary = c.summaryText
      ? p(esc(c.summaryText))
      : p('A recent change in property law may affect your obligations. See what it means for your own properties.')
    return { subject: `Property law: ${head}`, html: shell({
      preheader: 'What changes and what you need to watch.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Property law') + h(head) + hi(c)
        + summary
        + p('PROPERWISE is kept up to date continuously, so your properties stay in order, easily and correctly. It’s a good moment to take a look.')
        + button('Check your properties', dash(c))
        + note(NOTE.aade),
    }) }
  },
}
