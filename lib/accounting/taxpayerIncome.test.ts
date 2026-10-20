// npx tsx lib/accounting/taxpayerIncome.test.ts
import { taxpayerRentSources, ownershipPctOf, wholePropertyTax } from './taxpayerIncome'
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
// Μισθωμένα: η βάση του φόρου (lib/facts/taxIncome.ts) προβάλλει τις δόσεις σε
// ετήσιο ρυθμό μόνο με μίσθωση. Χωρίς μίσθωση μετρούν μόνο τα εισπραγμένα.
const props = [
  { id: 'a', client_id: 'owner-1', rental_mode: 'long_term' },
  { id: 'b', client_id: 'owner-2', rental_mode: 'long_term' },
  { id: 'c', client_id: 'owner-1', rental_mode: 'long_term' },
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

// ═══ ΣΥΝΙΔΙΟΚΤΗΣΙΑ: Ο ΦΟΡΟΣ ΣΤΟ ΜΕΡΙΔΙΟ ════════════════════════════════════
// 50% σε ακίνητο 24.000€: δηλώνει 12.000€, 11.400 στο 15% = 1.710€.
const half = taxpayerRentSources({ props: [{ id: 'h', ownership: '50' }], current: { id: 'h', annualRent: 24000, shortTerm: false }, ownerClientIds: null, income: new Map(), year: 2026, today: TODAY })
eq('50%: στον φόρο μπαίνουν τα 12.000€', half[0].annualRent, 12000)
eq('50%: 1.710€ για το μερίδιο', taxShareOf(consolidateRentTax(half, undefined, 2026), 'h'), 1710)
eq('50%: όλο το ακίνητο με τον ίδιο συντελεστή, 3.420€', wholePropertyTax(1710, ownershipPctOf({ ownership: '50' })), 3420)
// Τα άλλα ακίνητα στο δικό τους ποσοστό: 9 × 1.000 × 12 / 9 × 25% = 3.000€.
const mixed = taxpayerRentSources({ props: [{ id: 'm' }, { id: 'q', ownership: 25, rental_mode: 'long_term' }], current: { id: 'm', annualRent: 12000, shortTerm: false }, ownerClientIds: null, income: new Map([['q', { rents: nine(1000) }]]), year: 2026, today: TODAY })
eq('άλλο ακίνητο 25%: 3.000€', mixed[1].annualRent, 3000)
// ΙΔΙΑ ΒΑΣΗ ΜΕ ΤΟ ΤΡΕΧΟΝ (19/10/2026): άλλο ακίνητο με μίσθωμα 1.100€ και εννέα
// δόσεις των 1.000€ μετρά το μίσθωμα × 12, όπως θα μετρούσε ως τρέχον.
const leased = taxpayerRentSources({ props: [{ id: 'm' }, { id: 'q', rental_mode: 'long_term' }], current: { id: 'm', annualRent: 12000, shortTerm: false }, ownerClientIds: null, income: new Map([['q', { rents: nine(1000), leaseMonthly: 1100 }]]), year: 2026, today: TODAY })
eq('άλλο ακίνητο με μίσθωμα: το μίσθωμα × 12', leased[1].annualRent, 13200)
// Κενό ακίνητο με δόσεις του ενοικιαστή που έφυγε: τα εισπραγμένα, χωρίς προβολή.
const left = taxpayerRentSources({ props: [{ id: 'm' }, { id: 'v', status_detail: 'vacant' }], current: { id: 'm', annualRent: 12000, shortTerm: false }, ownerClientIds: null, income: new Map([['v', { rents: nine(500) }]]), year: 2026, today: TODAY })
eq('κενό ακίνητο: τα εισπραγμένα 4.500€', left[1].annualRent, 4500)
eq('χωρίς τιμή ή άκυρο: 100', [ownershipPctOf({}), ownershipPctOf({ ownership: 'x' }), ownershipPctOf({ ownership: 0 }), ownershipPctOf(undefined)], [100, 100, 100, 100])

console.log(fail ? `✗ taxpayerIncome: ${fail} απέτυχαν από ${pass + fail}` : `✓ taxpayerIncome: ${pass} έλεγχοι πέρασαν`)
if (fail) process.exit(1)
