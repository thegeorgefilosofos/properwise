import { eyebrow, h, p, bullets, button, note } from '../../emailTemplates.ts'
import { eur } from '../../format.ts'
import { dash, esc, has, type CopyFn } from '../kit.ts'
import { shell, hi, NOTE } from './kit.ts'

// ── Property operations (twin of ../operations.ts) ─────────────────────────
export const OPERATIONS: Record<string, CopyFn> = {

  lease_ending: (c) => {
    const ref = c.propertyName ? ` for “${esc(c.propertyName)}”` : ''
    const when = c.leaseEndDate ? ` on <b>${esc(c.leaseEndDate)}</b>` : ' soon'
    return { subject: c.propertyName ? `The lease for “${esc(c.propertyName)}” is ending` : 'A lease is ending soon', html: shell({
      preheader: 'Time to decide on renewal or change.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Lease') + h('A lease is nearing its end') + hi(c)
        + p(`The lease${ref} ends${when}. This is the right moment to decide: renewal on the same terms, a rent adjustment or looking for a new tenant.`)
        + p('PROPERWISE keeps the terms, dates and history ready, so you can act without running around.')
        + button('See the lease', dash(c))
        + note(NOTE.ahead),
    }) }
  },

  lease_renewal_prompt: (c) => {
    const ref = c.propertyName ? ` for “${esc(c.propertyName)}”` : ''
    return { subject: 'Time to renew the lease?', html: shell({
      preheader: 'Adjust the rent as the lease agreement sets out.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Renewal') + h('Renew with confidence') + hi(c)
        + p(`If you are thinking of renewing the lease${ref}, PROPERWISE helps you work out the rent adjustment based on the adjustment clause in your lease (for example the consumer price index) and prepares a draft notice to the tenant, ready for you to adapt and send.`)
        + button('Prepare the renewal', dash(c))
        + note(NOTE.legal),
    }) }
  },

  deposit_reminder: (c) => {
    const ref = c.propertyName ? ` for “${esc(c.propertyName)}”` : ''
    const amt = has(c.amount) ? ` (<b>${eur(c.amount)}</b>)` : ''
    return { subject: 'The deposit needs settling', html: shell({
      preheader: 'A pending item that needs a clean close.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Deposit') + h('Let’s close the deposit cleanly') + hi(c)
        + p(`With the lease${ref} ending, the deposit${amt} reaches its final stage: it is returned in full or offset against any debts and damage that have been recorded.`)
        + p('Record the movement in PROPERWISE, so your books stay clean and the end of the lease is clear for every side. The receipt stays in the property’s history, ready whenever it is needed.')
        + bullets([
            'Note the deposit amount and the date it was returned or offset.',
            'Withhold, with evidence, only what the lease provides for: unpaid rent, outstanding bills or damage beyond normal wear and tear.',
            'Keep photos and receipts in the history, so every deduction stands up.',
          ])
        + button('Settle the deposit', dash(c))
        + note(NOTE.legal),
    }) }
  },

  insurance_expiring: (c) => {
    const ref = c.propertyName ? ` for “${esc(c.propertyName)}”` : ''
    const who = c.insurerName ? ` with ${esc(c.insurerName)}` : ''
    const when = c.policyEndDate ? ` on <b>${esc(c.policyEndDate)}</b>` : ' soon'
    return { subject: 'The property insurance is expiring', html: shell({
      preheader: 'Don’t leave a gap in your cover.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Insurance') + h('Your cover is nearing its end') + hi(c)
        + p(`The insurance policy${ref}${who} expires${when}. Renewing in good time keeps your property protected, with no gap in cover.`)
        + button('See the expiry', dash(c))
        + note(NOTE.ahead),
    }) }
  },

  certificate_expiring: (c) => {
    const named = c.certificateName ? `: ${esc(c.certificateName)}` : ''
    const ref = c.propertyName ? ` for “${esc(c.propertyName)}”` : ''
    const when = c.certificateEndDate ? ` on <b>${esc(c.certificateEndDate)}</b>` : ' soon'
    return { subject: `A certificate is expiring${named}`, html: shell({
      preheader: 'A document best renewed in good time.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Certificates') + h('A certificate needs renewing') + hi(c)
        + p(`A certificate${c.certificateName ? ` (${esc(c.certificateName)})` : ''}${ref} expires${when}. If you are planning a lease, a sale or an energy upgrade, it is best to renew it in good time, so it doesn’t hold you up.`)
        + button('See the property', dash(c))
        + note(NOTE.ahead),
    }) }
  },

  appointment_reminder: (c) => {
    const title = c.appointmentTitle ? esc(c.appointmentTitle) : 'appointment'
    const when = [c.appointmentDate && esc(c.appointmentDate), c.appointmentTime && esc(c.appointmentTime)].filter(Boolean).join(', ')
    return { subject: `Reminder: ${title}`, html: shell({
      preheader: when ? `${when}.` : 'An appointment is waiting for you.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Calendar') + h('An appointment is coming up') + hi(c)
        + p(`<b>${title}</b>${when ? `, ${when}` : ''}. We keep it in your calendar, so it doesn’t slip past you.`)
        + button('See the calendar', dash(c))
        + note('Need a change? You can move it with one click.'),
    }) }
  },

  maintenance_scheduled: (c) => {
    const title = c.maintenanceTitle ? esc(c.maintenanceTitle) : 'Maintenance work'
    const ref = c.propertyName ? ` at “${esc(c.propertyName)}”` : ''
    const when = c.maintenanceDate ? ` on <b>${esc(c.maintenanceDate)}</b>` : ''
    const who = c.contractorName ? ` Contractor: ${esc(c.contractorName)}.` : ''
    return { subject: 'Scheduled maintenance', html: shell({
      preheader: 'A job has been added to your calendar.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Maintenance') + h('A job is scheduled') + hi(c)
        + p(`<b>${title}</b>${ref}${when}.${who}`)
        + p('We will remind you shortly before, so everything is ready.')
        + button('See the maintenance', dash(c))
        + note(NOTE.ahead),
    }) }
  },

  maintenance_completed: (c) => {
    const title = c.maintenanceTitle ? esc(c.maintenanceTitle) : 'The maintenance work'
    const ref = c.propertyName ? ` at “${esc(c.propertyName)}”` : ''
    const amt = has(c.amount) ? ` The cost, <b>${eur(c.amount)}</b>, was recorded as an expense.` : ''
    return { subject: 'Maintenance completed', html: shell({
      preheader: 'Recorded in the property’s history.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Maintenance') + h('The job is complete') + hi(c)
        + p(`${title}${ref} is complete.${amt}`)
        + p('It stays recorded in the property’s history, so you have the full picture whenever you need it.')
        + button('See the history', dash(c))
        + note(NOTE.autolog),
    }) }
  },

  inspection_due: (c) => {
    const ref = c.propertyName ? ` of “${esc(c.propertyName)}”` : ' of your properties'
    return { subject: 'Time for the property’s annual check', html: shell({
      preheader: 'A look today, fewer surprises tomorrow.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Inspection') + h('A check is worth the effort') + hi(c)
        + p(`A year has passed. A short check${ref}, for wear, safety and small repairs, prevents bigger costs and keeps the value high.`)
        + button('Schedule a check', dash(c))
        + note(NOTE.ahead),
    }) }
  },

  utility_bill_due: (c) => {
    const type = c.billType ? esc(c.billType) : ''
    const ref = c.propertyName ? ` for “${esc(c.propertyName)}”` : ''
    const amt = has(c.amount) ? ` of <b>${eur(c.amount)}</b>` : ''
    const when = c.billDueDate ? ` by <b>${esc(c.billDueDate)}</b>` : ''
    const lead = type ? `The “${type}” bill` : 'The bill'
    return { subject: type ? `Payment: ${type}` : 'Bill payment reminder', html: shell({
      preheader: 'A payment best not left behind.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Bills') + h('A bill needs paying') + hi(c)
        + p(`${lead}${amt}${ref} is due${when}. Pay it in good time and record the expense, so the property’s picture stays accurate.`)
        + button('See the bill', dash(c))
        + note(NOTE.dataOwn),
    }) }
  },

  appointment_missed: (c) => {
    const title = c.appointmentTitle ? esc(c.appointmentTitle) : 'appointment'
    return { subject: 'Missed appointment. Let’s rebook it', html: shell({
      preheader: 'One click for a new date.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Calendar') + h('An appointment was left hanging') + hi(c)
        + p(`The appointment “${title}” didn’t take place. That’s fine. Book a new date with one click, so the chance isn’t lost.`)
        + button('Book a new appointment', dash(c))
        + note('We keep it in your calendar until you find time.'),
    }) }
  },

  maintenance_requested: (c) => {
    const ref = c.propertyName ? ` at “${esc(c.propertyName)}”` : ''
    const what = c.maintenanceTitle ? ` “${esc(c.maintenanceTitle)}”` : ''
    return { subject: 'A new repair request from your property', html: shell({
      preheader: 'A request is waiting for your reply.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Maintenance') + h('A new repair request has come in') + hi(c)
        + p(`A new repair request${what}${ref} has been recorded and is waiting for your reply. The sooner you look at it, the easier it is to solve; small issues rarely stay small when they wait.`)
        + p('See what is needed, assign a contractor if you like and keep the history clean, all from one place.')
        + button('See and reply', dash(c))
        + note(NOTE.ahead),
    }) }
  },
}
