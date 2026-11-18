import { eyebrow, h, p, bullets, button, note, heroStat } from '../../emailTemplates.ts'
import { eur } from '../../format.ts'
import { dash, esc, has, type CopyFn } from '../kit.ts'
import { EMAIL_LIGHT as C } from '../../emailPalette.ts'
import { shell, hi, plural, NOTE, GREEK_DOCS } from './kit.ts'

// ── Phase 2: Engagement & Retention (twin of ../engagement.ts) ──────────────
export const ENGAGEMENT: Record<string, CopyFn> = {

  monthly_statement: (c) => {
    const line = (has(c.collected) && has(c.expected))
      ? p(`${c.period ? `<b>${esc(c.period)}</b>. ` : ''}<b>${eur(c.collected)}</b> collected of ${eur(c.expected)}.${has(c.outstanding) ? ` <b>${eur(c.outstanding)}</b> remains outstanding.` : ' Everything was collected.'}`)
      : p('The month’s collections are waiting for you, organised per property.')
    return { subject: 'Your monthly statement', html: shell({
      preheader: 'The month’s collections, in brief.', unsubUrl: c.unsubUrl,
      hero: has(c.collected) ? heroStat(eur(c.collected), 'collected this month') : '',
      bodyHtml: eyebrow('Monthly statement') + h('Your month, in brief') + hi(c)
        + line
        + p('See the full breakdown per property and download the official statement whenever you need it.')
        + button('See the monthly statement', dash(c))
        + note(`${NOTE.official} ${GREEK_DOCS}`),
    }) }
  },

  market_digest: (c) => ({
    subject: 'Interest rates this week',
    html: shell({
      preheader: 'Euribor, the ECB and mortgage rates, at a glance.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Market data') + h('Where interest rates are heading') + hi(c)
        + p('Every week you see where <b>Euribor</b>, the <b>ECB rate</b> and <b>mortgage rates</b> stand, so you can weigh borrowing or refinancing whenever you like.')
        + p('The picture changes fast. A look once a week keeps you ahead.')
        + button('See the rates', dash(c))
        + note('Useful for weighing loans and yields in PROPERWISE.'),
    }),
  }),

  product_update: (c) => {
    const detail = c.summaryText
      ? p(esc(c.summaryText))
      : bullets([
          'Faster reports and exports, ready for your accountant or bank.',
          'More accurate answers from Noa, with your own data.',
          'Fewer steps in day-to-day entry, with voice commands.',
        ])
    return { subject: 'What’s new in PROPERWISE', html: shell({
      preheader: 'The latest additions, built on your feedback.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('New features') + h('We built something for you') + hi(c)
        + p('We keep working on PROPERWISE, based on what you ask us for. Here are the latest additions that make your work easier:')
        + detail
        + button('See what’s new', dash(c))
        + note('You’re receiving this update as a PROPERWISE user.'),
    }) }
  },

  quarterly_review: (c) => {
    const bits: string[] = []
    if (has(c.collected)) bits.push(`income of <b>${eur(c.collected)}</b>`)
    if (has(c.net)) bits.push(`a net result of <b>${eur(c.net)}</b>`)
    const line = bits.length
      ? p(`${c.period ? `<b>${esc(c.period)}</b>. ` : ''}The quarter closed with ${bits.join(' and ')}.`)
      : p('The quarter’s picture is waiting for you: income, expenses and net result, per property.')
    return { subject: 'Your quarter at a glance', html: shell({
      preheader: 'Portfolio income, expenses and yield.', unsubUrl: c.unsubUrl,
      hero: has(c.collected) ? heroStat(eur(c.collected), 'quarterly income') : '',
      bodyHtml: eyebrow('Review') + h('What the quarter showed') + hi(c)
        + line
        + p('See the full breakdown and compare your properties with each other.')
        + button('See the review', dash(c))
        + note('Ideal for spotting which property performs and which needs attention.'),
    }) }
  },

  tax_e2: (c) => ({
    subject: 'Your tax return is coming up',
    html: shell({
      preheader: 'Your form E2 is prepared from your own data.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Tax calendar') + h('Time for form E2') + hi(c)
        + p(`The deadline for the income tax return${c.deadlineDate ? ` (by ${esc(c.deadlineDate)})` : ''} is approaching. PROPERWISE gathers your rents per property and prepares your form E2 (the property income schedule) pre-filled, with the amounts in the right column, ready for your accountant or for myAADE.`)
        + p('It also flags anything missing, so you don’t rush at the last minute. The data is already in place.')
        + button('Prepare form E2', dash(c))
        + note(`${NOTE.aade} The form itself is in Greek.`),
    }),
  }),

  tax_enfia: (c) => ({
    subject: 'ENFIA: estimate and deadlines',
    html: shell({
      preheader: 'See what each property owes, with no surprises.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Tax calendar') + h('ENFIA, with no surprises') + hi(c)
        + p('PROPERWISE gives you an indicative estimate of ENFIA (the annual property tax) for each of your properties and reminds you of the installments, so they never come out of the blue.')
        + button('See ENFIA', dash(c))
        + note(NOTE.aade),
    }),
  }),

  tax_installment: (c) => ({
    subject: 'Reminder: a tax installment this month',
    html: shell({
      preheader: 'A look at your tax calendar.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Tax calendar') + h('An installment is waiting') + hi(c)
        + p(`${c.deadlineDate ? `By <b>${esc(c.deadlineDate)}</b>` : 'Within the month'} a tax installment falls due. Check your tax calendar so nothing slips past you.`)
        + button('See the calendar', dash(c))
        + note(NOTE.aade),
    }),
  }),

  year_end: (c) => ({
    subject: 'Close the year with your books in order',
    html: shell({
      preheader: 'A clean close today, a calm March.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Year end') + h('Just before the year turns') + hi(c)
        + p('Before the year closes, finalise your books: income, expenses and result locked, ready for the tax return.')
        + p('A clean close today saves you hours in March.')
        + button('Lock the year', dash(c))
        + note('You can unlock it at any time if a correction is needed.'),
    }),
  }),

  rent_pending: (c) => {
    const ref = c.propertyName ? ` for “${esc(c.propertyName)}”` : ''
    const per = c.period ? ` for ${esc(c.period)}` : ''
    const amt = has(c.amount) ? ` of <b>${eur(c.amount)}</b>` : ''
    return { subject: 'A rent payment is pending', html: shell({
      preheader: 'A payment hasn’t been recorded yet.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Collections') + h('A payment hasn’t been recorded') + hi(c)
        + p(`The rent${amt}${ref}${per} hasn’t been marked as collected. If you received it, record it so your picture stays accurate.`)
        + button('See collections', dash(c))
        + note('If you haven’t received it yet, you can send a polite reminder from the tenant’s tab.'),
    }) }
  },

  dunning_1: (c) => {
    const ref = c.propertyName ? ` for “${esc(c.propertyName)}”` : ''
    const amt = has(c.amount) ? ` of <b>${eur(c.amount)}</b>` : ''
    const od = has(c.daysOverdue) ? ` for ${plural(c.daysOverdue, 'day', 'days')}` : ''
    return { subject: 'Reminder: overdue rent', html: shell({
      preheader: 'A rent payment is late.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Reminder') + h('A rent payment is late') + hi(c)
        + p(`The rent${amt}${ref} has been outstanding${od}. Look at the installment and, if you like, send a polite reminder with one click.`)
        + button('See the installment', dash(c))
        + note('You send the reminder to the tenant yourself; we don’t write to their address.'),
    }) }
  },

  dunning_2: (c) => {
    const ref = c.propertyName ? ` for “${esc(c.propertyName)}”` : ''
    const od = has(c.daysOverdue) ? plural(c.daysOverdue, 'day', 'days') : 'several days'
    return { subject: 'Second reminder: the rent is still outstanding', html: shell({
      preheader: 'Perhaps it’s time for a more direct reminder.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Reminder') + h('The rent is still outstanding') + hi(c)
        + p(`${od[0].toUpperCase()}${od.slice(1)} have passed and the rent${ref} is still uncollected. Perhaps it’s time for a more direct, but always polite, reminder.`)
        + button('See your options', dash(c))
        + note('The reminder text is ready; sending it to the tenant is up to you.'),
    }) }
  },

  dunning_final: (c) => {
    const ref = c.propertyName ? ` for “${esc(c.propertyName)}”` : ''
    const amt = has(c.amount) ? ` (${eur(c.amount)})` : ''
    const od = has(c.daysOverdue) ? ` for ${plural(c.daysOverdue, 'day', 'days')}` : ''
    return { subject: 'Final notice for overdue rent', html: shell({
      preheader: 'See the next steps.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Final notice') + h('Action is needed') + hi(c)
        + p(`The rent${ref}${amt} has remained uncollected${od}. See the installment and the next steps available to you.`)
        + button('See the installment', dash(c))
        + note('We’re here for you. If you need help with the process, reply here.'),
    }) }
  },

  enfia_installment_reminder: (c) => {
    const frac = (has(c.installmentNo) && has(c.installmentsTotal)) ? `${c.installmentNo}/${c.installmentsTotal}` : ''
    const lead = frac ? `ENFIA installment ${frac}` : 'The next ENFIA installment'
    const when = c.deadlineDate ? ` is due on <b>${esc(c.deadlineDate)}</b>` : ' is due soon'
    const perProp = (c.digestItems && c.digestItems.length)
      ? bullets(c.digestItems.map(it => `<b>${esc(it.title)}</b>${it.detail ? ` <span class="mu" style="color:${C.mute};">${esc(it.detail)}</span>` : ''}`))
      : ''
    const total = has(c.amount) ? p(`Total this month: <b>${eur(c.amount)}</b>.`) : ''
    return { subject: frac ? `ENFIA · installment ${frac} is due soon` : 'ENFIA · an installment is due soon', html: shell({
      preheader: 'The amount per property, worked out in good time.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Tax calendar · ENFIA') + h(frac ? `ENFIA installment ${frac}` : 'An ENFIA installment is coming up') + hi(c)
        + p(`${lead}${when}. ENFIA is the annual property tax. We have worked out an indicative amount for each of your properties separately, so you can see at a glance what each one owes and how much you pay in total this month.`)
        + perProp
        + total
        + p('We reminded you early on purpose, so you can settle it calmly and not at the last minute.')
        + button('See your installments', dash(c))
        + note(NOTE.aade),
    }) }
  },

  portfolio_digest_nudge: (c) => {
    const per = c.period ? ` (${esc(c.period)})` : ''
    return { subject: 'Your monthly review is ready', html: shell({
      preheader: 'Your month, in one clear picture.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Monthly portfolio summary') + h('Your month, in one clear picture') + hi(c)
        + p(`We have gathered what happened in your portfolio over the last month${per}: collections, occupancy, upcoming obligations and opportunities to save. We keep the exact amounts safe inside the app; one click shows them all together.`)
        + bullets([
            'Rents collected and those outstanding, per property.',
            'Your portfolio’s occupancy and how it moved during the month.',
            'Upcoming obligations, so no deadline catches you out.',
            'Possible savings we spotted in your expenses.',
          ])
        + button('See your monthly review', dash(c))
        + note('We send this summary once a month and respect your quiet hours. You can change how often in the settings whenever you like.'),
    }) }
  },
}
