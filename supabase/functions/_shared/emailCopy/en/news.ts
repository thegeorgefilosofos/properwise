import { eyebrow, h, p, bullets, button, note } from '../../emailTemplates.ts'
import { dash, esc, type CopyFn } from '../kit.ts'
import { shell, hi, NOTE } from './kit.ts'

// ── News (twin of ../news.ts) ──────────────────────────────────────────────
// Ο τίτλος και η περίληψη (`headline`, `summaryText`) τα γράφει άνθρωπος για
// το κάθε μήνυμα· στα αγγλικά φεύγουν όπως γράφτηκαν.
export const NEWS: Record<string, CopyFn> = {

  news_rate_move: (c) => {
    const ctx = c.summaryText ? p(esc(c.summaryText)) : p('Market interest rates have moved. If you have a variable-rate loan or are thinking of borrowing, this change affects your installment.')
    return { subject: c.headline ? esc(c.headline) : 'Interest rates have moved. See what it means for you', html: shell({
      preheader: 'A market move that touches your installment.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('News') + h('Interest rates have moved') + hi(c)
        + ctx
        + p('In PROPERWISE you compare <b>bank rates</b>, work out the new installment with your own data and see whether <b>refinancing</b> pays.')
        + button('See the effect on your installment', dash(c))
        + note('Indicative, based on public market data. Not a binding bank offer.'),
    }) }
  },

  news_insurance_risk: (c) => {
    const ctx = c.summaryText ? p(esc(c.summaryText)) : p('In light of recent events, this is a good moment to make sure your property is protected.')
    return { subject: c.headline ? esc(c.headline) : 'Protect your property, with the right policy', html: shell({
      preheader: 'Protection today, a possible ENFIA benefit too.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('News') + h('Peace of mind starts with protection') + hi(c)
        + ctx
        + p('Keep the policy details and expiry in the property, so the renewal doesn’t slip past you.')
        + bullets([
            'Protection from earthquake, fire and flood, depending on the plan.',
            'For insured properties a reduction in ENFIA (the annual property tax) may also apply, under conditions.',
          ])
        + button('Open the property', dash(c))
        + note(NOTE.aade),
    }) }
  },

  news_tax_change: (c) => {
    const ctx = c.summaryText ? p(esc(c.summaryText)) : p('Something has changed in the rules for property. See what it means in practice for you and what you need to watch.')
    return { subject: c.headline ? esc(c.headline) : 'New rules for property. What changes for you', html: shell({
      preheader: 'What changes and what you need to do.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('News') + h('Something changed. Let’s look at it clearly') + hi(c)
        + ctx
        + p('PROPERWISE keeps your data up to date and ready, so any change finds you in order, not at the last minute.')
        + button('Put your property in order', dash(c))
        + note(NOTE.legal),
    }) }
  },

  news_market: (c) => {
    const ctx = c.summaryText ? p(esc(c.summaryText)) : p('The property market is moving. A look at your own data keeps you a step ahead.')
    return { subject: c.headline ? esc(c.headline) : 'The market is moving. Where do you stand?', html: shell({
      preheader: 'Your own data, in today’s terms.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('News') + h('See where you stand, today') + hi(c)
        + ctx
        + p('Yield, portfolio value and opportunities, with your own figures.')
        + button('Open your dashboard', dash(c))
        + note('For information, based on public data and your own data.'),
    }) }
  },

  news_utility_prices: (c) => {
    const ctx = c.summaryText ? p(esc(c.summaryText)) : p('Electricity, natural gas and internet prices have moved again. When tariffs change, your property’s running cost changes with them, often without you noticing.')
    return { subject: c.headline ? esc(c.headline) : 'Electricity and internet prices changed. Is a better plan worth it?', html: shell({
      preheader: 'A comparison today could lower your property’s running cost.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('News') + h('Prices moved. See if you’re paying more') + hi(c)
        + ctx
        + p('In PROPERWISE you compare <b>electricity</b>, <b>natural gas</b> and <b>internet</b> plans for your property and see which suits your own consumption, with no phone calls and no small print.')
        + button('Compare plans', dash(c))
        + note('Indicative, based on your own consumption data.'),
    }) }
  },
}
