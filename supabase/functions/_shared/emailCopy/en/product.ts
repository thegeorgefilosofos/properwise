import { eyebrow, h, p, bullets, button, note, heroStat } from '../../emailTemplates.ts'
import { eur } from '../../format.ts'
import { app, dash, esc, has, type CopyFn } from '../kit.ts'
import { shell, hi, plural, NOTE, PACKAGE_NAME_EN } from './kit.ts'

// ── Product & evolution (twin of ../product.ts) ────────────────────────────
export const PRODUCT: Record<string, CopyFn> = {

  feature_launch: (c) => {
    const name = c.featureName ? esc(c.featureName) : 'A new feature'
    const benefit = c.featureBenefit ? p(esc(c.featureBenefit)) : ''
    return { subject: c.featureName ? `New: ${esc(c.featureName)}` : 'Something new is waiting for you', html: shell({
      preheader: 'Built to save you time.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('New feature') + h(name) + hi(c)
        + p('We never stop improving PROPERWISE. Here is the latest addition, built on what you ask for.')
        + benefit
        + button('Try it now', dash(c))
        + note('Every improvement comes at no extra cost, as part of PROPERWISE.'),
    }) }
  },

  assistant_upgraded: (c) => {
    if (!c.assistantSkill) return null
    return { subject: 'A new skill for Noa', html: shell({
      preheader: 'What you can ask now.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Noa') + h('Noa learned something new') + hi(c)
        + p(`Noa now also answers this: ${esc(c.assistantSkill)}.`)
        + button('Ask Noa', dash(c))
        + note('The more details you enter, the more specific the answers become.'),
    }) }
  },

  assistant_showcase: (c) => ({
    subject: 'Noa does the work',
    html: shell({
      preheader: 'Ask, record, schedule, all with your voice.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Noa') + h('Say what you want and it’s done') + hi(c)
        + p('Noa answers, records, calculates and schedules for you, with your own data, in Greek, with your voice.')
        + bullets([
            '“How much tax will I pay this year?” and Noa answers with your own data.',
            '“Book the plumber for Tuesday at 6” and it goes into the calendar.',
            '“Record the Kolonaki rent payment” and it’s done instantly.',
          ])
        + button('Talk to Noa', dash(c))
        + note('Noa knows your properties and is there whenever you need it.'),
    }),
  }),

  changelog_monthly: (c) => {
    const body = c.summaryText ? p(esc(c.summaryText)) : p('This month we added new features, fixed details and made PROPERWISE faster. All with one goal: to save you time.')
    return { subject: 'What we built this month', html: shell({
      preheader: 'The month’s improvements, at a glance.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Product update') + h('A month of improvements') + hi(c)
        + p('We work every day to make PROPERWISE better. Here is what changed over the last month:')
        + body
        + button('See what’s new', dash(c))
        + note('Every improvement is already available, at no extra cost.'),
    }) }
  },

  roadmap_preview: (c) => {
    const body = c.summaryText ? p(esc(c.summaryText)) : p('We are preparing new features for management, bookkeeping and Noa. We want your opinion, so we build first what helps you most.')
    return { subject: 'What we are preparing next', html: shell({
      preheader: 'A look at what is coming.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Coming next') + h('A look at the future of PROPERWISE') + hi(c)
        + body
        + p('Which would help you most? Reply to this message and we will take it seriously.')
        + button('Tell us what you think', dash(c))
        + note(NOTE.reply),
    }) }
  },

  anniversary: (c) => {
    const yrs = has(c.anniversaryYears) ? plural(c.anniversaryYears, 'year', 'years') : 'one year'
    const proof = has(c.collected) ? p(`Together we organised <b>${eur(c.collected)}</b> in collections and countless pending items that never had to worry you.`) : ''
    const many = has(c.anniversaryYears) && c.anniversaryYears > 1
    return { subject: many ? `${c.anniversaryYears} years together` : 'One year together', html: shell({
      preheader: 'Thank you for trusting us.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Anniversary') + h(many ? `${c.anniversaryYears} years together` : 'One year together') + hi(c)
        + p(`You have completed ${yrs} with PROPERWISE and we simply want to say a sincere thank you.`)
        + proof
        + p('We are committed to keep improving, so your properties are always under control.')
        + button('See your year', dash(c))
        + note('We are here for many more.'),
    }) }
  },

  milestone_reached: (c) => {
    const what = has(c.collected)
      ? `<b>${eur(c.collected)}</b> in organised collections`
      : (has(c.properties) ? `<b>${plural(c.properties, 'property', 'properties')}</b> under management` : 'an important milestone')
    return { subject: 'A milestone worth recognising', html: shell({
      preheader: 'Small moves, big results.', unsubUrl: c.unsubUrl,
      hero: has(c.collected) ? heroStat(eur(c.collected), 'organised collections') : (has(c.properties) ? heroStat(`${c.properties}`, c.properties === 1 ? 'property under management' : 'properties under management') : ''),
      bodyHtml: eyebrow('Milestone') + h('You’ve reached something that counts') + hi(c)
        + p(`You have just passed ${what} through PROPERWISE. Behind that number are hours you gained and pending items that never worried you.`)
        + button('See your progress', dash(c))
        + note('Every entry counts. Keep it up.'),
    }) }
  },

  nps_survey: (c) => ({
    subject: 'Would you recommend us to a friend?',
    html: shell({
      preheader: 'Half a minute, great value for us.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Your opinion') + h('One question, honestly') + hi(c)
        + p('On a scale from 0 to 10, how likely are you to recommend PROPERWISE to someone with property?')
        + p('Your answer shows us where we do well and where we still have a way to go. We read them one by one.')
        + button('Give your answer', dash(c))
        + note(NOTE.reply),
    }),
  }),

  feedback_lottery: (c) => ({
    subject: 'One minute for your opinion',
    html: shell({
      preheader: 'Three questions, one minute.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Your opinion') + h('Tell us what you think') + hi(c)
        + p('We noticed you haven’t shared your opinion yet. Take just one minute to tell us your thoughts, ideas and view of PROPERWISE.')
        + bullets([
            'What do you think we do well?',
            'Where do we need to improve?',
            'What would you suggest we add?',
          ])
        + p('Every answer is read by a person.')
        + button('Tell us what you think', dash(c))
        + note(NOTE.reply),
    }),
  }),

  feedback_prize_won: (c) => {
    const token = typeof c.token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(c.token) ? c.token : ''
    if (!token) return null
    const pkg = PACKAGE_NAME_EN.agency
    const until = typeof c.expiresOn === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(c.expiresOn) ? c.expiresOn : ''
    const days = typeof c.acceptDays === 'number' && Number.isInteger(c.acceptDays) && c.acceptDays > 0 ? c.acceptDays : 0
    if (!until && !days) return null
    return {
      subject: `You won a year of “${pkg}” on PROPERWISE`,
      html: shell({
        preheader: until ? `Accept the gift by ${until}.` : `Accept the gift within ${days} days.`,
        bodyHtml: eyebrow('Feedback prize draw') + h('You won this month’s draw') + hi(c)
          + p(`Thank you for your feedback. Your entry was drawn and you win <b>one year of the “${pkg}” subscription</b>.`)
          + p('To claim it, tap “I accept the gift” and confirm that you are over 18. The year is credited to your account the moment you accept.')
          + button('I accept the gift', `${app(c)}/doro/${token}`)
          + p(until
              ? `The link is valid until <b>${until}</b>. If you don’t accept by then, the gift is drawn again among the month’s other participants.`
              : `The link is valid for ${days} days. If you don’t accept by then, the gift is drawn again among the month’s other participants.`)
          + note('You can also accept it inside the app, from the “Your opinion” form. The gift cannot be exchanged for cash or transferred.'),
      }),
    }
  },

  best_practice_tip: (c) => {
    const tip = c.summaryText ? p(esc(c.summaryText)) : p('Keep a separate account for each property. That way income and expenses sort themselves out and the tax picture comes out accurately.')
    return { subject: c.headline ? esc(c.headline) : 'Tip of the week', html: shell({
      preheader: 'A small move with a big difference.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Tip') + h(c.headline ? esc(c.headline) : 'A tip that pays off') + hi(c)
        + tip
        + button('Apply it in PROPERWISE', dash(c))
        + note('Every week, one practical idea to make better use of your properties.'),
    }) }
  },

  webinar_invite: (c) => {
    if (!c.appointmentDate) return null
    const title = c.headline ? esc(c.headline) : 'A meeting for property owners'
    const when = [esc(c.appointmentDate), c.appointmentTime && esc(c.appointmentTime)].filter(Boolean).join(', ')
    return { subject: 'Invitation to a meeting for property owners', html: shell({
      preheader: `${when}. Save your seat.`, unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Event') + h(title) + hi(c)
        + p(`We invite you to a practical meeting for property owners and managers, ${when}. Taking part costs nothing.`)
        + button('Save your seat', dash(c))
        + note('You will receive the link when you register.'),
    }) }
  },
}
