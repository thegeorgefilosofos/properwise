import { eyebrow, h, p, bullets, button, note } from '../../emailTemplates.ts'
import { eur, pctRate } from '../../format.ts'
import { dash, esc, has, type CopyFn } from '../kit.ts'
import { shell, hi, NOTE } from './kit.ts'

// ── Value & savings (twin of ../value.ts) ──────────────────────────────────
export const VALUE: Record<string, CopyFn> = {

  energy_savings: (c) => {
    const ref = c.propertyName ? ` for “${esc(c.propertyName)}”` : ''
    const save = has(c.amount) ? p(`Based on your consumption, the difference could reach <b>${eur(c.amount)}</b> a year.`) : ''
    return { subject: 'Pay less for electricity', html: shell({
      preheader: 'Compare providers and keep the difference.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Savings') + h('Your electricity, for less') + hi(c)
        + p(`PROPERWISE compares electricity, natural gas and internet plans${ref} and shows you which one suits your own consumption. No phone calls, no small print.`)
        + save
        + button('See the comparison', dash(c))
        + note('Indicative, based on your own consumption data.'),
    }) }
  },

  insurance_enfia: (c) => {
    const ref = c.propertyName ? ` for “${esc(c.propertyName)}”` : ' for your property'
    return { subject: 'Insure the property and see if you gain on ENFIA too', html: shell({
      preheader: 'Protection and a possible tax reduction, together.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Value') + h('Two benefits with one move') + hi(c)
        + p(`An insured property doesn’t only protect you from damage. For insured properties a reduction in ENFIA (the annual property tax) may also apply, under conditions. PROPERWISE helps you see what fits${ref} and what it could mean for you.`)
        + button('See what fits you', dash(c))
        + note(NOTE.aade),
    }) }
  },

  loan_costs: (c) => ({
    subject: 'A loan for a property? See the full cost',
    html: shell({
      preheader: 'Installment, interest rate, file and notary costs.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Loans') + h('Before you sign, look at the figures') + hi(c)
        + p('A mortgage isn’t just the installment. PROPERWISE shows you the full cost: interest rate, file fees, notary fees and registration, so you see a realistic, indicative cost.')
        + bullets([
            'Comparison of loans and installments, with your own data.',
            'An eligibility check for state housing schemes, when they are open.',
            'A calculation of purchase costs, with no surprises.',
          ])
        + button('Work out your loan', dash(c))
        + note(NOTE.legal),
    }),
  }),

  rate_alert: (c) => {
    const line = c.summaryText
      ? p(esc(c.summaryText))
      : p('PROPERWISE keeps bank rates up to date and works out the installment with your own data. So whenever you consider a loan or refinancing, the comparison is already ready.')
    return { subject: 'Interest rates and installment: see where you stand', html: shell({
      preheader: 'Bank rates, up to date and comparable.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Interest rates') + h('See where interest rates stand') + hi(c)
        + line
        + p('Compare banks, work out your installment and see whether refinancing pays, based on your own figures.')
        + button('See the comparison', dash(c))
        + note('Indicative, based on public market data. Not a binding bank offer.'),
    }) }
  },

  document_pack: (c) => {
    const ref = c.propertyName ? ` of “${esc(c.propertyName)}”` : ' of your property'
    return { subject: 'Your property’s file, in one click', html: shell({
      preheader: 'Ready for an accountant, a bank or an investor.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Documents') + h('The whole picture, in one file') + hi(c)
        + p(`Need to show the picture${ref} to someone? PROPERWISE produces a clean, official file with income, expenses, yield and tax details, ready to hand over. The file is in Greek, as the Greek authorities and banks expect.`)
        + bullets([
            'For your accountant or lawyer.',
            'For the bank, with a loan application.',
            'For an interested buyer or investor.',
          ])
        + p('And something they will appreciate: every document carries a number and a QR code. Whoever receives it scans it and sees when it was recorded in PROPERWISE and that the record hasn’t changed since, without any amounts being exposed.')
        + button('Create the file', dash(c))
        + note(NOTE.official),
    }) }
  },

  yield_boost: (c) => {
    const ref = c.propertyName ? ` of “${esc(c.propertyName)}”` : ' of your property'
    const lead = has(c.occupancy)
      ? p(`The occupancy${ref} is around <b>${pctRate(c.occupancy)}</b>. With a few targeted moves, the yield rises without a big investment:`)
      : p('Every property hides a little more yield, if you know where to look. Here are three practical ideas that pay off:')
    return { subject: 'Three moves for a higher yield', html: shell({
      preheader: 'Small changes that raise your property’s yield.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Yield') + h('Get more from your property') + hi(c)
        + lead
        + bullets([
            'Compare your rent with the market and adjust it, within the legal limits, if it has fallen behind.',
            'An energy upgrade (insulation, heating, windows) lowers running costs and raises the energy class (energy performance certificate) and demand.',
            'For short-term rentals, close the gaps with pricing that follows demand and the season.',
          ])
        + p('PROPERWISE shows you the current yield per property and where there is room, with your own data.')
        + button('See your yield', dash(c))
        + note('Practical ideas, no promises. The result depends on the property and the market.'),
    }) }
  },

  loan_first_scenario: (c) => ({
    subject: 'You built your first loan scenario. Here’s what to watch',
    html: shell({
      preheader: 'How to choose a loan and a bank, with clear criteria.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Loans') + h('Your first loan scenario') + hi(c)
        + p('You have just worked out a loan scenario in PROPERWISE, a good move. Before you go ahead with a bank, here are the points that make the biggest difference to the final cost:')
        + bullets([
            'Fixed or variable rate: the variable rate follows <b>Euribor</b> plus the bank’s margin (spread). See how the installment changes if rates rise.',
            'Look at the <b>APR</b> (in Greek, SEPPE), which shows the real cost of the loan and not just the interest rate: it includes file fees, valuation and compulsory insurance.',
            'Ask about early repayment terms and which insurance each bank requires.',
            'If you meet the conditions, check the state housing schemes, when they are open.',
          ])
        + p('In PROPERWISE you compare banks and installments with your own data and see the full, indicative cost before you commit.')
        + button('Compare your scenarios', dash(c))
        + note(NOTE.legal),
    }),
  }),

  energy_pulse: (c) => {
    const ref = c.propertyName ? ` for “${esc(c.propertyName)}”` : ' for your properties'
    const save = has(c.amount) ? p(`The estimated difference${ref} reaches <b>${eur(c.amount)}</b> a month, based on your consumption.`) : ''
    return { subject: 'New green electricity prices · this month’s pulse', html: shell({
      preheader: 'The window to switch provider has opened again, with no exit fee.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Monthly energy pulse') + h('The window to switch provider has opened again') + hi(c)
        + p('Every month the green electricity tariff is repriced and providers announce the new price per kilowatt hour. Because the contract has no exit clause, a small window opens each month: you can switch provider without penalty, if another suits you better.')
        + p(`We prepared this month’s energy pulse separately${ref}. We compared your provider’s new green price with the market alternatives, so you can see at a glance whether the move is worth it this month.`)
        + save
        + bullets([
            'Your provider’s new green price, per property.',
            'This month’s best-value alternatives.',
            'The estimated difference on your monthly bill.',
            'No exit clause; switching happens without penalty and without interruption.',
          ])
        + button('See your energy pulse', dash(c))
        + note('Prices and comparisons are for information, based on providers’ public announcements. Confirm the final price and terms with the provider before you switch.'),
    }) }
  },
}
