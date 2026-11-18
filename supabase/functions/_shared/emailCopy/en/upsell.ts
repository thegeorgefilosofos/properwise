import { eyebrow, h, p, bullets, button, note, heroStat, PACKAGE_MAX_PROPERTIES } from '../../emailTemplates.ts'
import { eur } from '../../format.ts'
import { dash, has, offer, type CopyFn } from '../kit.ts'
import { shell, hi, plural, NOTE, codeLine, PACKAGE_NAME_EN, FREE_PLAN_EN } from './kit.ts'

// ── Phase 3: Upsell & Conversion (twin of ../upsell.ts) ─────────────────────
export const UPSELL: Record<string, CopyFn> = {

  free_month_upgrade: (c) => ({
    subject: 'Another month. Is it time?',
    html: shell({
      preheader: 'More data, better decisions.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Upgrade') + h('Give your property more') + hi(c)
        + p(`Another month on the “${FREE_PLAN_EN}” plan. Is it time to ask Noa about your property or add more properties, so you make better decisions with less effort?`)
        + p(`With a subscription plan, from “${PACKAGE_NAME_EN.solo}” to “${PACKAGE_NAME_EN.office}”, you save time on management, with just a few taps from your phone.`)
        + button('See the plans', dash(c))
        + note(NOTE.cancel),
    }),
  }),

  upsell_to_individual: (c) => {
    const pack = `“${PACKAGE_NAME_EN.owner}”`
    const proof = has(c.properties)
      ? p(`You already have <b>${plural(c.properties, 'property', 'properties')}</b> in PROPERWISE. With ${pack}, each one works to the full for you.`)
      : p(`You already use the basics. With ${pack} you get what makes management truly effortless.`)
    return { subject: 'Give your properties the full PROPERWISE', html: shell({
      preheader: 'More properties, comparison between them, and Noa.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow(`${PACKAGE_NAME_EN.owner} plan`) + h('Time for the next step') + hi(c)
        + proof
        + p('What it adds to what you already have:')
        + bullets([
            `More than one property in the same account: up to ${PACKAGE_MAX_PROPERTIES.owner} on this plan, more on the professional plans.`,
            'Comparison of your properties with each other.',
            'Noa, for questions about your own figures.',
          ])
        + p('Reminders, statements and PDF reports with a verification code stay as you have them, without a subscription.')
        + button(`See ${pack}`, dash(c))
        + note(NOTE.cancel),
    }) }
  },

  upsell_to_professional: (c) => {
    const proof = (has(c.properties) && c.properties >= 2)
      ? p(`You manage <b>${plural(c.properties, 'property', 'properties')}</b>. The bigger your portfolio grows, the more you gain from the ${PACKAGE_NAME_EN.agency} plan.`)
      : p(`As your portfolio grows, the ${PACKAGE_NAME_EN.agency} plan keeps you ahead with no extra effort.`)
    return { subject: 'Your portfolio is growing', html: shell({
      preheader: 'Many properties, branded reports, bulk communication.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow(`${PACKAGE_NAME_EN.agency} plan`) + h('Built for a portfolio') + hi(c)
        + proof
        + p('What it adds:')
        + bullets([
            `Up to ${PACKAGE_MAX_PROPERTIES.agency} properties, with an overall picture and per-property analysis.`,
            'Branded reports and bulk email to your clients.',
            'An accounting journal and allocation to co-owners, ready for the accountant.',
          ])
        + button(`Upgrade to ${PACKAGE_NAME_EN.agency}`, dash(c))
        + note(NOTE.cancel),
    }) }
  },

  limit_reached: (c) => ({
    subject: 'You’ve reached your property limit',
    html: shell({
      preheader: 'One step to carry on without limits.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Room to grow') + h('You need a little more room') + hi(c)
        + p(`The “${FREE_PLAN_EN}” plan holds one property. For a second and a third there is “${PACKAGE_NAME_EN.owner}”, with up to ${PACKAGE_MAX_PROPERTIES.owner} properties and Noa included.`)
        + p('You keep everything you have entered. Only the limit goes.')
        + button('See the plans', dash(c))
        + note(NOTE.cancel),
    }),
  }),

  value_left: (c) => {
    const proof = has(c.collected)
      ? p(`Through PROPERWISE you have already organised <b>${eur(c.collected)}</b> in collections. Imagine the same clear picture in your bookkeeping, taxes and reports.`)
      : p('You use part of what PROPERWISE offers. The rest is waiting, ready to save you time.')
    return { subject: 'You’re leaving value unused', html: shell({
      preheader: 'See what is left untapped in your plan.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Value waiting') + h('There’s more, ready for you') + hi(c)
        + proof
        + p('Upgrading brings Noa, room for more properties and comparison between them, without changing anything in your routine.')
        + button('See what you gain', dash(c))
        + note(NOTE.cancel),
    }) }
  },

  annual_discount: (c) => {
    const o = offer(c)
    const promo = !!o
    const lead = o
      ? `If PROPERWISE has become part of your routine, annual billing gives you a <b>${o.pct}%</b> discount compared with monthly, with the code <b>${o.code}</b> at checkout. Same features, lower cost.`
      : 'If PROPERWISE has become part of your routine, annual billing costs less than twelve monthly payments: up to two months’ fewer charges a year. Same features, lower cost.'
    return { subject: promo ? `Pay annually and save ${c.discountPct}%` : 'Pay annually and gain up to two months', html: shell({
      preheader: 'Same plan, lower cost.',
      unsubUrl: c.unsubUrl,
      hero: heroStat(promo ? `${c.discountPct}%` : 'up to 2 months', promo ? 'saving' : 'fewer charges a year'),
      bodyHtml: eyebrow('Annual billing') + h('Lower cost with the annual subscription') + hi(c)
        + p(lead)
        + p('You can switch in your Account, under Subscription.')
        + button('Switch to annual billing', dash(c))
        + note(NOTE.cancel),
    }) }
  },

  trial_ending: (c) => {
    const left = has(c.trialDaysLeft)
      ? (c.trialDaysLeft === 1 ? 'Tomorrow' : `In ${plural(c.trialDaysLeft, 'day', 'days')}`)
      : 'In a few days'
    const sells = c.billingLive === true
    return { subject: 'Your trial ends soon', html: shell({
      preheader: 'Keep what you set up, without interruption.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Trial') + h('Let’s keep your flow going') + hi(c)
        + p(`${left} your trial period ends. After that you carry on without a subscription on the “${FREE_PLAN_EN}” plan, with one property and the tax tools.`
          + (sells ? ' For Noa, more properties or the tools of the larger plans, choose a plan whenever it suits you.' : ''))
        + p('Everything you have entered stays exactly where you left it.')
        + (sells ? button('Choose a plan', dash(c)) : button('Open PROPERWISE', dash(c)))
        + note(sells ? NOTE.cancel : NOTE.dataOwn),
    }) }
  },

  winback_downgrade: (c) => ({
    subject: 'We’re here, whenever you like',
    html: shell({
      preheader: 'Your data is waiting for you, intact.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Welcome back') + h('The door stays open') + hi(c)
        + p('You moved to a more basic plan and we fully respect that. Your properties, collections and history remain intact and yours.')
        + p('Reminders and PDF reports carry on as normal on every plan. If at some point you need what your previous plan had again, you will find everything where you left it.')
        + button('See the plans', dash(c))
        + note(NOTE.dataOwn),
    }),
  }),

  reactivation_offer: (c) => {
    const o = offer(c)
    if (!o) return null
    return { subject: `Come back with ${o.pct}% off`, html: shell({
      preheader: 'A reason to start again.',
      unsubUrl: c.unsubUrl,
      hero: heroStat(`${o.pct}%`, 'discount'),
      bodyHtml: eyebrow('An invitation back') + h('A discount for your return') + hi(c)
        + p(`We missed you. If you want to give PROPERWISE a place in your routine again, we are keeping a <b>${o.pct}%</b> discount on the upgrade for you.`)
        + codeLine(o)
        + p('Your account is exactly as you left it, ready for you to carry on.')
        + button(`Claim the ${o.pct}%`, dash(c))
        + note(NOTE.cancel),
    }) }
  },

  trial_started: (c) => {
    const days = has(c.trialDaysLeft) ? plural(c.trialDaysLeft, 'day', 'days') : 'a few days'
    const planLine = ` on <b>“${PACKAGE_NAME_EN.owner}”</b>`
    return { subject: 'Your trial has started. Let’s make the most of it', html: shell({
      preheader: 'What your trial includes.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Trial') + h('A good start. Let’s show you the value') + hi(c)
        + p(`You started the trial${planLine} for ${days}: you have its features, with a trial limit on questions to Noa and on scans. Try it with your own figures.`)
        + bullets([
            `Add more properties, up to ${PACKAGE_MAX_PROPERTIES.owner}.`,
            'Compare your properties with each other.',
            'Ask Noa something about your properties.',
          ])
        + button('Start here', dash(c))
        + note('No commitment. At the end of the trial, you decide.'),
    }) }
  },
}
