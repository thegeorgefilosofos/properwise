import { eyebrow, h, p, button, note, heroStat } from '../../emailTemplates.ts'
import { eur, pctRate } from '../../format.ts'
import { dash, esc, has, type CopyFn } from '../kit.ts'
import { shell, hi, plural, NOTE } from './kit.ts'

// ── Short-term rentals (twin of ../shortterm.ts) ───────────────────────────
export const SHORTTERM: Record<string, CopyFn> = {

  checkin_today: (c) => {
    const g = c.guestName ? esc(c.guestName) : ''
    const ref = c.propertyName ? ` at “${esc(c.propertyName)}”` : ''
    const when = c.checkinDate ? ` (${esc(c.checkinDate)})` : ''
    return { subject: 'Guest arriving today', html: shell({
      preheader: 'Everything ready for the welcome.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Short-term rentals') + h('You have an arrival today') + hi(c)
        + p(`${g ? `Arrival: <b>${g}</b>` : 'You have an arrival'}${ref}${when}. Make sure the property is ready, the keys or code are available and the instructions have been sent.`)
        + button('See the booking', dash(c))
        + note('Happy hosting. A good welcome brings good reviews.'),
    }) }
  },

  checkout_today: (c) => {
    const g = c.guestName ? esc(c.guestName) : ''
    const ref = c.propertyName ? ` at “${esc(c.propertyName)}”` : ''
    return { subject: 'Guest leaving today', html: shell({
      preheader: 'Time for cleaning and the next booking.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Short-term rentals') + h('You have a departure today') + hi(c)
        + p(`${g ? `Departure: <b>${g}</b>` : 'You have a departure'}${ref}. A good moment to schedule the cleaning, check the property and ask for a review.`)
        + button('See the booking', dash(c))
        + note('A quick check now keeps the property ready for the next arrival.'),
    }) }
  },

  cleaning_scheduled: (c) => {
    const ref = c.propertyName ? ` at “${esc(c.propertyName)}”` : ''
    const when = c.cleaningDate ? ` on <b>${esc(c.cleaningDate)}</b>` : ''
    return { subject: 'Scheduled cleaning', html: shell({
      preheader: 'The property ready for the next booking.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Short-term rentals') + h('The cleaning is scheduled') + hi(c)
        + p(`The cleaning${ref}${when} is on the schedule. We will remind you shortly before, so the property is always ready for the next arrival.`)
        + button('See the calendar', dash(c))
        + note(NOTE.ahead),
    }) }
  },

  occupancy_gap: (c) => {
    const ref = c.propertyName ? ` at “${esc(c.propertyName)}”` : ''
    const gap = has(c.gapNights) ? plural(c.gapNights, 'empty night', 'empty nights') : 'empty nights'
    const span = [c.gapFrom && esc(c.gapFrom), c.gapTo && esc(c.gapTo)].filter(Boolean).join(' to ')
    return { subject: 'Empty nights, a chance to fill them', html: shell({
      preheader: 'A small price adjustment may fill them.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Occupancy') + h('There’s room to fill') + hi(c)
        + p(`We spotted <b>${gap}</b>${ref}${span ? ` (${span})` : ''}. A targeted price adjustment or a small offer is often enough to fill them.`)
        + p('PROPERWISE suggests a price based on demand and the season.')
        + button('See the price suggestions', dash(c))
        + note(NOTE.ahead),
    }) }
  },

  review_request: (c) => {
    const g = c.guestName ? ` (${esc(c.guestName)})` : ''
    const ref = c.propertyName ? ` at “${esc(c.propertyName)}”` : ''
    return { subject: 'Ask for a review while it’s fresh', html: shell({
      preheader: 'Good reviews bring the next bookings.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Reviews') + h('A good review is worth it') + hi(c)
        + p(`A stay${ref} has just ended${g}. While the experience is fresh, a polite reminder to leave a review brings the best results.`)
        + button('Send the request', dash(c))
        + note('Reviews build your ranking and your next bookings.'),
    }) }
  },

  payout_received: (c) => {
    const ref = c.propertyName ? ` for “${esc(c.propertyName)}”` : ''
    const amt = has(c.amount) ? `<b>${eur(c.amount)}</b>` : 'A payment'
    return { subject: 'A booking payout has come in', html: shell({
      preheader: 'Recorded in your income.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Collections') + h('A payment has come in') + hi(c)
        + p(`${amt}${ref} was recorded as short-term rental income. Your income picture was updated automatically.`)
        + button('See your income', dash(c))
        + note(NOTE.autolog),
    }) }
  },

  str_season_recap: (c) => {
    const bits: string[] = []
    if (has(c.collected)) bits.push(`income of <b>${eur(c.collected)}</b>`)
    if (has(c.occupancy)) bits.push(`occupancy of <b>${pctRate(c.occupancy)}</b>`)
    if (has(c.reviewsCount)) bits.push(`<b>${plural(c.reviewsCount, 'review', 'reviews')}</b>`)
    const line = bits.length
      ? p(`The season closed with ${bits.join(', ')}${has(c.rating) ? ` and an average rating of <b>${c.rating!.toLocaleString('el-GR')}</b>` : ''}.`)
      : p('Your short-term rental season has closed. See the overall picture, per property and per month.')
    return { subject: 'Your season in review', html: shell({
      preheader: 'Income, occupancy and reviews at a glance.', unsubUrl: c.unsubUrl,
      hero: has(c.occupancy) ? heroStat(`${pctRate(c.occupancy)}`, 'season occupancy') : (has(c.collected) ? heroStat(eur(c.collected), 'season income') : ''),
      bodyHtml: eyebrow('Review') + h('How the season went') + hi(c)
        + line
        + p('Compare with last year, spot your strong months and plan next season from now.')
        + button('See the review', dash(c))
        + note('The season’s data helps you price the next one correctly.'),
    }) }
  },
}
