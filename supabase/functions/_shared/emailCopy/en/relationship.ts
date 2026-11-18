import { eyebrow, h, p, button, note } from '../../emailTemplates.ts'
import { eur, pctRate } from '../../format.ts'
import { dash, esc, has, type CopyFn } from '../kit.ts'
import { shell, hi, NOTE } from './kit.ts'

// ── Relationships (twin of ../relationship.ts) ─────────────────────────────
export const RELATIONSHIP: Record<string, CopyFn> = {

  tenant_rent_receipt: (c) => {
    const per = c.period ? ` for ${esc(c.period)}` : ''
    const ref = c.propertyName ? ` at “${esc(c.propertyName)}”` : ''
    const amt = has(c.amount) ? `<b>${eur(c.amount)}</b>` : 'Your payment'
    return { subject: c.period ? `Rent receipt ${esc(c.period)}` : 'Your rent receipt', html: shell({
      preheader: 'Your payment has been recorded.',
      bodyHtml: eyebrow('Receipt') + h('We received your payment') + hi(c)
        + p(`${amt} for the rent${ref}${per} has been recorded. Thank you for paying on time.`)
        + p('Keep this message as confirmation of your payment.')
        + button('See the receipt', dash(c))
        + note(NOTE.official),
    }) }
  },

  coowner_statement: (c) => {
    const per = c.period ? ` ${esc(c.period)}` : ''
    const ref = c.propertyName ? ` “${esc(c.propertyName)}”` : ''
    const share = has(c.sharePct) ? ` (share ${pctRate(c.sharePct)})` : ''
    const amt = has(c.amount) ? p(`Your net share${share} for the period: <b>${eur(c.amount)}</b>.`) : ''
    return { subject: 'Your co-ownership statement', html: shell({
      preheader: 'Your share of income and expenses, clearly.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Co-ownership') + h(`Your picture${per}`) + hi(c)
        + p(`Here is your statement for the property${ref}${per}: income, expenses and the net result that is yours.`)
        + amt
        + button('See the full statement', dash(c))
        + note(NOTE.official),
    }) }
  },
}
