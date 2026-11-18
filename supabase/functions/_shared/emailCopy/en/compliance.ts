import { eyebrow, h, p, button, note } from '../../emailTemplates.ts'
import { eur } from '../../format.ts'
import { dash, esc, has, type CopyFn } from '../kit.ts'
import { shell, hi, NOTE } from './kit.ts'

// ── Compliance (twin of ../compliance.ts) ──────────────────────────────────
export const COMPLIANCE: Record<string, CopyFn> = {

  lease_declaration_reminder: (c) => {
    const ref = c.propertyName ? ` for “${esc(c.propertyName)}”` : ''
    const when = c.deadlineDate ? ` by <b>${esc(c.deadlineDate)}</b>` : ' within the deadline'
    return { subject: 'Declare the lease on myAADE', html: shell({
      preheader: 'An obligation best not missed.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Compliance') + h('A lease declaration is pending') + hi(c)
        + p(`For every new or amended lease${ref}, the lease declaration (Dilosi Pliroforiakon Stoixeion Misthosis) is filed on myAADE, the tax authority’s portal,${when}. PROPERWISE keeps the details ready, so the filing is quick and error-free. The filing itself is in Greek.`)
        + button('See the lease details', dash(c))
        + note(NOTE.aade),
    }) }
  },

  str_registration_reminder: (c) => {
    const ref = c.propertyName ? ` for “${esc(c.propertyName)}”` : ''
    return { subject: 'Display your property registry number', html: shell({
      preheader: 'The AMA must appear in every listing.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Compliance') + h('The AMA needs displaying') + hi(c)
        + p(`For the short-term rental${ref}, the property is entered in the Short-Term Rental Property Registry and its registry number (AMA) is shown in every listing on Airbnb and Booking. Check that everything is in order, so you avoid fines.`)
        + button('See the property', dash(c))
        + note(NOTE.aade),
    }) }
  },

  str_stay_tax: (c) => {
    const per = c.period ? ` for ${esc(c.period)}` : ''
    const amt = has(c.amount) ? ` The amount to remit: <b>${eur(c.amount)}</b>.` : ''
    return { subject: 'Remitting the resilience fee', html: shell({
      preheader: 'Collected from the guest, remitted to the state.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Compliance') + h('Time for the resilience fee') + hi(c)
        + p(`The <b>climate crisis resilience fee</b> for short-term rentals${per} is collected from the guest and remitted to the tax office.${amt} PROPERWISE gives an indicative calculation of what applies per booking, so you have a clear picture.`)
        + button('See the amounts', dash(c))
        + note(NOTE.aade),
    }) }
  },

  takk_seasonal_rate_switch: (c) => ({
    subject: 'The resilience fee is changing',
    html: shell({
      preheader: 'Update the charges on your bookings.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Compliance · Short-term rentals') + h('A new seasonal charge from today') + hi(c)
        + p('The climate crisis resilience fee for short-term rentals changes with the season. The new charge applies from today, so update the charges on your bookings to collect exactly the right amount at every departure.')
        + p('The fee is collected from the guest and remitted to the tax office. PROPERWISE gives an indicative calculation of what applies per booking at the new rate.')
        + button('See the new charges', dash(c))
        + note(NOTE.aade),
    }),
  }),
}
