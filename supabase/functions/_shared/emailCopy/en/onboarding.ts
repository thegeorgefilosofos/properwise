import { eyebrow, h, p, bullets, button, note, heroStat } from '../../emailTemplates.ts'
import { eur } from '../../format.ts'
import { dash, esc, has, type CopyFn } from '../kit.ts'
import { shell, hi, plural } from './kit.ts'

// ── Phase 1: Onboarding & Activation (twin of ../onboarding.ts) ─────────────
export const ONBOARDING: Record<string, CopyFn> = {

  welcome_free: (c) => ({
    subject: 'Welcome to PROPERWISE',
    html: shell({
      preheader: 'You add the basics, PROPERWISE does the rest.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Welcome') + h('Let’s get started') + hi(c)
        + p('From today, you enter the basics and PROPERWISE does the rest: income, expenses, taxes and reminders.')
        + p('Three steps to see your first picture:')
        + bullets([
            'Add your first property. It takes two minutes.',
            'Enter one income and one expense, to see the bookkeeping work on its own.',
            'Ask Noa whatever is on your mind, the way you would ask a person.',
          ])
        + button('Open your dashboard', dash(c))
        + note('If anything gets in your way, reply to this message. We read it.'),
    }),
  }),

  welcome_individual: (c) => ({
    subject: 'Your properties, in order',
    html: shell({
      preheader: 'You stay in control, we handle the routine.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Welcome') + h('Let’s put things in order') + hi(c)
        + p('From today, your rents, expenses and obligations are recorded per property. No more searching through notes, messages and receipts: you stay in control, PROPERWISE does the routine work.')
        + p('To get value from day one:')
        + bullets([
            'Add your property and your tenant.',
            'Set the rent and let the reminders run on their own.',
            'Create your first statement or rent certificate with one click.',
          ])
        + button('Open your dashboard', dash(c))
        + note('We’re here for you. Reply here and we’ll help.'),
    }),
  }),

  welcome_professional: (c) => ({
    subject: 'Your portfolio on one screen',
    html: shell({
      preheader: 'Many properties, one picture, clear reports.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Welcome') + h('Time to get to work') + hi(c)
        + p('PROPERWISE was built for professionals who manage many properties and have no time for wasted moves. From collections to bookkeeping, you see it all per property and in total.')
        + (has(c.properties)
            ? p(`You already have <b>${plural(c.properties, 'property', 'properties')}</b> in your portfolio. Let’s make them work for you.`)
            : '')
        + p('What PROPERWISE has for professionals:')
        + bullets([
            'A multi-property portfolio, with an overall picture and per-property analysis.',
            'Branded reports and bulk email to your clients.',
            'An accounting journal and allocation to co-owners, ready for the accountant.',
          ])
        + button('Open your dashboard', dash(c))
        + note('Would you like a short tour? Reply and we’ll arrange it.'),
    }),
  }),

  add_first_property: (c) => ({
    subject: 'Add your first property',
    html: shell({
      preheader: 'Two minutes now, a clear picture from tomorrow.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('First step') + h('Let’s add the first property') + hi(c)
        + p('PROPERWISE starts working for you as soon as the first property is in. From then on, income, expenses, taxes and reminders fall into place.')
        + p('All you need is its name, address and type. The rest can be filled in bit by bit, whenever it suits you.')
        + button('Add a property', dash(c))
        + note('It will take less time than you think.'),
    }),
  }),

  first_property_success: (c) => ({
    subject: c.propertyName ? `“${c.propertyName}” is ready` : 'Your property is ready',
    html: shell({
      preheader: 'Here’s what’s worth doing next.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Nice') + h(c.propertyName ? `“${esc(c.propertyName)}” has been added` : 'The first property is in') + hi(c)
        + p('For it to run on its own and give you a clear picture, fill in three things:')
        + bullets([
            'The lease and tenant details.',
            'Income and expenses, for automatic bookkeeping.',
            'The dates you want us to remind you of.',
          ])
        + button('Continue setting up', dash(c))
        + note('The more complete the property, the smarter PROPERWISE gets for you.'),
    }),
  }),

  connect_bank: (c) => ({
    subject: 'Let the bookkeeping do itself',
    html: shell({
      preheader: 'Upload your transactions and we match them automatically.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Automation') + h('Less typing') + hi(c)
        + p('Instead of entering income and expenses one by one, upload your account statement as a file. PROPERWISE reads it and matches it to rents and expenses.')
        + p('You just confirm. Anything uncertain is flagged for you to check.')
        + button('Upload your transactions', dash(c))
        + note('Your data is yours. We don’t connect to your bank without you.'),
    }),
  }),

  connect_calendar: (c) => ({
    subject: 'Sync Airbnb and Booking',
    html: shell({
      preheader: 'Your bookings, automatically in the calendar.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Short-term rentals') + h('Bookings, on their own') + hi(c)
        + p('Connect your Airbnb or Booking calendar and your bookings will appear automatically, with no double entries.')
        + button('Connect a calendar', dash(c))
        + note('We support iCal, so it works with most other channels too.'),
    }),
  }),

  tip_assistant: (c) => ({
    subject: 'Noa knows your properties',
    html: shell({
      preheader: 'From taxes to yields, with your own data.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Noa') + h('Got a question?') + hi(c)
        + p('Noa knows your properties. Ask how much tax you will pay, whether a loan makes sense or what yield a property brings, and get an answer based on your own data.')
        + p('Write or speak freely, in Greek. Say what you want, as you would to a person.')
        + button('Ask Noa', dash(c))
        + note('No generic answers. Noa talks about your own case.'),
    }),
  }),

  voice_entry: (c) => ({
    subject: 'Say it and it’s recorded',
    html: shell({
      preheader: 'Income, expenses and properties, with your voice.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Voice commands') + h('Speak and it’s done') + hi(c)
        + p('You don’t need to type. Say “record rent of 500 euros for July” or “add an 80 euro maintenance expense” and it goes in its place straight away. Voice commands work in Greek.')
        + bullets([
            'Record income and expenses by speaking naturally.',
            'Add a property or tenant with one sentence.',
            'Ask anything and get an answer with your own data.',
          ])
        + button('Try your voice', dash(c))
        + note('Quick, easy, no forms. The way you would say it to a person.'),
    }),
  }),

  tip_reports: (c) => ({
    subject: 'An official report in one click',
    html: shell({
      preheader: 'For your accountant, your bank or your records.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Reports') + h('Paperwork without the effort') + hi(c)
        + p('Need an income and expense statement, a rent certificate or a portfolio report? They come out ready, clean and official, with a document number and the option to verify them.')
        + button('Create a report', dash(c))
        + note('Every document carries a QR code, so its authenticity can be confirmed. Documents for AADE and your accountant are in Greek.'),
    }),
  }),

  feedback_week1: (c) => ({
    subject: 'How is it going so far?',
    html: shell({
      preheader: 'Half a minute of yours, a big difference for us.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Your opinion') + h('Tell us honestly') + hi(c)
        + p('A week has passed with us. Tell us honestly: what helped, what was hard, what is missing.')
        + p('We read every reply and build PROPERWISE on what we hear from you.')
        + button('Tell us what you think', dash(c))
        + note('You can simply reply to this message. It comes straight to us.'),
    }),
  }),

  recap_week2: (c) => {
    const d = has(c.days) ? plural(c.days, 'day', 'days') : 'a few days'
    const bits: string[] = []
    if (has(c.properties)) bits.push(`<b>${plural(c.properties, 'property', 'properties')}</b>`)
    if (has(c.collected)) bits.push(`<b>${eur(c.collected)}</b> of recorded collections`)
    const opening = bits.length
      ? p(`In ${d} you have already organised ${bits.join(' and ')} in PROPERWISE. A good start.`)
      : p('In just a few days you have already put in order things that used to be scattered. A good start.')
    return {
      subject: 'Your first week in numbers',
      html: shell({
        preheader: 'See what you have already organised.',
        unsubUrl: c.unsubUrl,
        hero: has(c.collected) ? heroStat(eur(c.collected), 'collections') : (has(c.properties) ? heroStat(`${c.properties}`, c.properties === 1 ? 'property' : 'properties') : ''),
        bodyHtml: eyebrow('Summary') + h('A good start') + hi(c)
          + opening
          + p('The more regularly you keep your properties up to date, the more accurate your forecasts and reports become.')
          + button('See your summary', dash(c))
          + note('One minute a week is enough to keep everything up to date.'),
      }),
    }
  },
}
