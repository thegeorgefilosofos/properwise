// npx tsx lib/accounting/taxpayerIncome.test.ts
import { taxpayerRentSources } from './taxpayerIncome'
import { consolidateRentTax, taxShareOf } from '../billing/consolidate'

let pass = 0, fail = 0
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) pass++; else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`) }
}

const TODAY = '2026-10-02'
const paid = (m: number, amount: number) => ({ amount, paid: true, paid_date: `2026-${String(m).padStart(2, '0')}-05`, due_date: `2026-${String(m).padStart(2, '0')}-05`, period_year: 2026, period_month: m })
const nine = (amount: number) => [1, 2, 3, 4, 5, 6, 7, 8, 9].map(m => paid(m, amount))

// ═══ ΔΥΟ ΙΔΙΟΚΤΗΤΕΣ ΣΤΟΝ ΙΔΙΟ ΛΟΓΑΡΙΑΣΜΟ, 12.000€ Ο ΚΑΘΕΝΑΣ ═════════════════
const props = [
  { id: 'a', client_id: 'owner-1' },
  { id: 'b', client_id: 'owner-2' },
  { id: 'c', client_id: 'owner-1' },
]
const owners = new Set(['owner-1', 'owner-2'])
const income = new Map([
  ['b', { rents: nine(1000) }],
  ['c', { rents: nine(500) }],
])
const current = { id: 'a', annualRent: 12000, shortTerm: false }

const perOwner = taxpayerRentSources({ props, current, ownerClientIds: owners, income, year: 2026, today: TODAY })
eq('επαγγελματίας: μόνο τα ακίνητα του ίδιου ιδιοκτήτη', perOwner.map(s => s.id), ['a', 'c'])
eq('το άλλο ακίνητο από τις δόσεις του: 4.500 × 12 / 9', perOwner[1].annualRent, 6000)

const asOne = taxpayerRentSources({ props, current, ownerClientIds: null, income, year: 2026, today: TODAY })
eq('ιδιώτης: όλα τα ακίνητα', asOne.map(s => s.id), ['a', 'b', 'c'])

// Ο ιδιοκτήτης 2 με 12.000€ μόνος του: 12.000 × 0,95 = 11.400 στο 15% = 1.710€.
const b = taxpayerRentSources({ props, current: { id: 'b', annualRent: 12000, shortTerm: false }, ownerClientIds: owners, income, year: 2026, today: TODAY })
eq('ιδιοκτήτης 2: 1.710€, όχι μερίδιο από 24.000€', taxShareOf(consolidateRentTax(b, undefined, 2026), 'b'), 1710)

// ═══ ΔΙΑΜΟΝΕΣ ΧΩΡΙΣ ΣΤΟΧΟ: ΔΕΝ ΜΕΤΡΑΝΕ ΜΗΔΕΝ ════════════════════════════════
const st = taxpayerRentSources({
  props: [{ id: 'x' }, { id: 'y', rental_mode: 'short_term' }], current: { id: 'x', annualRent: 6000, shortTerm: false },
  ownerClientIds: null, income: new Map([['y', { stays: [{ check_in: '2026-03-01', check_out: '2026-03-05', gross_guest_paid: 400 }] }]]), year: 2026, today: TODAY,
})
eq('βραχυχρόνιο με διαμονές: μπαίνει στον φόρο ως βραχυχρόνιο', [st[1].shortTerm, st[1].annualRent > 0], [true, true])

console.log(fail ? `✗ taxpayerIncome: ${fail} απέτυχαν από ${pass + fail}` : `✓ taxpayerIncome: ${pass} έλεγχοι πέρασαν`)
if (fail) process.exit(1)
