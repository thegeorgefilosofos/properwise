// npx tsx lib/facts/sameNumber.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΙΔΙΟΣ ΑΡΙΘΜΟΣ ΣΤΗΝ ΕΠΙΣΚΟΠΗΣΗ, ΣΤΙΣ ΑΠΟΔΟΣΕΙΣ, ΣΤΗ ΒΡΑΧΥΧΡΟΝΙΑ ΚΑΙ ΣΤΟΝ
// ΠΡΟΫΠΟΛΟΓΙΣΜΟ (02.11.2026)
// ─────────────────────────────────────────────────────────────────────────
// Ο οπτικός έλεγχος βρήκε στον πάγκο φόρο 2026 1.012,11€ στην Επισκόπηση,
// 1.588,44€ στη Βραχυχρόνια και 1.758,04€ στις Αποδόσεις, ακαθάριστα 7.102,54€
// απέναντι σε 6.480,00€ και «Απόδοση επί αξίας 5,56%» στον Προϋπολογισμό δίπλα
// σε καθαρή 2,82%. Εδώ, με ένα χαρτοφυλάκιο τριών ακινήτων, κάθε οθόνη στήνει
// τον αριθμό όπως τον στήνει ο κώδικάς της και οι αριθμοί βγαίνουν ίσοι.
//
// Α. Το έσοδο του έτους από διαμονές: εισπραγμένα ως σήμερα + κλεισμένες
//    κρατήσεις έως 31/12, ίσο με τα ακαθάριστα του έτους της Βραχυχρόνιας.
// Β. Ο φόρος: Επισκόπηση (`propertyRentTax`), Αποδόσεις (`taxpayerRentSources`
//    με το έσοδο της καρτέλας) και Βραχυχρόνια (`usePropertyRentTax`, που
//    καλεί την `propertyRentTax`).
// Γ. Η καθαρή απόδοση του Προϋπολογισμού (`investmentReturns`) ίση με την
//    καθαρή προ φόρου της Επισκόπησης.
// Δ. Ο κώδικας των οθονών καλεί αυτές τις συναρτήσεις και όχι δικές του.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { rentIncome, yieldIncome, bookedStaysOfYear } from './income'
import { propertyRentTax } from './rentTax'
import { yieldCosts } from './yield'
import { yieldPlatformFees } from './platformFees'
import { consolidateRentTax, taxShareOf } from '../billing/consolidate'
import { taxpayerRentSources, ownershipPctOf, wholePropertyTax, type TaxpayerPropInput, type OtherPropertyIncome } from '../accounting/taxpayerIncome'
import { computeYields } from '../billing/propertyFacts'
import { investmentReturns } from '../billing/budgetPro'
import { shortTermYearSummary, type TaxStay } from '../tax/shortTermTax'
import type { StayAmountLike } from '../clients/stayAmounts'
import type { IncomeRent } from '../income/propertyIncome'

let passed = 0, failed = 0
function ok(name: string, cond: boolean, got?: unknown) {
  if (cond) passed++
  else { failed++; console.log('  ✗ ' + name + (got !== undefined ? ` (got ${JSON.stringify(got)})` : '')) }
}
const cents = (n: number) => Math.round(n * 100) / 100

const YEAR = 2026, TODAY = '2026-11-01', VALUE = 185000
// Βραχυχρόνιο Α: δώδεκα διαμονές με ανάλυση ποσού, δέκα ως σήμερα και δύο
// κλεισμένες για Νοέμβριο και Δεκέμβριο.
const stay = (m: number, gross: number, fee: number): StayAmountLike => {
  const mm = String(m).padStart(2, '0')
  const levy = 4 * (m >= 4 && m <= 10 ? 8 : 2)
  return { check_in: `${YEAR}-${mm}-10`, check_out: `${YEAR}-${mm}-14`, gross_guest_paid: gross, climate_levy: levy, platform_fee: fee, total: gross - levy - fee }
}
const STAYS_A = Array.from({ length: 12 }, (_, i) => stay(i + 1, 300 + i * 40, 45 + i * 6))
// Μακροχρόνιο Β: μίσθωμα 650€, δόσεις ως τον Οκτώβριο.
const RENTS_B: IncomeRent[] = Array.from({ length: 10 }, (_, i) => ({
  amount: 650, paid: true, period_year: YEAR, period_month: i + 1,
  due_date: `${YEAR}-${String(i + 1).padStart(2, '0')}-05`, paid_date: `${YEAR}-${String(i + 1).padStart(2, '0')}-05`,
}))
// Βραχυχρόνιο Γ: τρεις διαμονές.
const STAYS_C = [stay(6, 900, 135), stay(8, 1100, 165), stay(12, 500, 75)]

const PROPS: TaxpayerPropInput[] = [
  { id: 'A', rental_mode: 'short_term', status_detail: 'seasonal' },
  { id: 'B', rental_mode: 'long_term', status_detail: 'rented' },
  { id: 'C', rental_mode: 'short_term', status_detail: 'seasonal', ownership: '50' },
]
const INCOME = new Map<string, OtherPropertyIncome>([
  ['A', { rents: [], stays: STAYS_A, leaseMonthly: null, targetMonthly: 400, viaBank: true }],
  ['B', { rents: RENTS_B, stays: [], leaseMonthly: 650, targetMonthly: 650, viaBank: true }],
  ['C', { rents: [], stays: STAYS_C, leaseMonthly: null, targetMonthly: null, viaBank: true }],
])

// ═══ Α. ΤΟ ΕΣΟΔΟ ΤΟΥ ΕΤΟΥΣ ═════════════════════════════════════════════════
const fi = rentIncome({ status: 'rent_short', rents: [], stays: STAYS_A, year: YEAR, today: TODAY, estimateMonthly: null })
const yi = yieldIncome(fi)
{
  const booked = bookedStaysOfYear(STAYS_A, YEAR, TODAY)
  ok('Α1. κλεισμένες: οι δύο κρατήσεις μετά από σήμερα', booked === (300 + 10 * 40 - 8) + (300 + 11 * 40 - 8), booked)
  ok('Α2. έτος = εισπραγμένα + κλεισμένα, όχι γραμμικός ρυθμός', yi.basis === 'stays' && yi.annual === cents(fi.received + booked), { annual: yi.annual, received: fi.received, booked })
  const st = shortTermYearSummary(STAYS_A as unknown as TaxStay[], YEAR, { sqm: 42, isHouse: false, propertyCount: 2, individual: true })
  ok('Α3. ίσο με τα ακαθάριστα του έτους της Βραχυχρόνιας', cents(st.grossRevenue) === yi.annual, { pricing: st.grossRevenue, overview: yi.annual })
  const past = rentIncome({ status: 'rent_short', rents: [], stays: STAYS_A, year: YEAR, today: '2027-02-01', estimateMonthly: null })
  ok('Α4. κλεισμένο έτος: ίσο με τα εισπραγμένα', past.annualized === past.received && past.booked === 0 && !past.projected, past)
}

// ═══ Β. Ο ΦΟΡΟΣ 2026, ΤΡΕΙΣ ΟΘΟΝΕΣ ═════════════════════════════════════════
{
  // Επισκόπηση και Βραχυχρόνια (usePropertyRentTax): η ίδια κλήση.
  const overview = propertyRentTax({ props: PROPS, propertyId: 'A', ownerClientIds: null, income: INCOME, year: YEAR, today: TODAY }).tax
  // Αποδόσεις: η ενοποίηση με το έσοδο της καρτέλας για το τρέχον ακίνητο.
  const roi = wholePropertyTax(taxShareOf(consolidateRentTax(taxpayerRentSources({
    props: PROPS, current: { id: 'A', annualRent: yi.annual, shortTerm: true, rentsPaidViaBank: true },
    ownerClientIds: null, income: INCOME, year: YEAR, today: TODAY,
  }), undefined, YEAR), 'A'), ownershipPctOf(PROPS[0]))
  ok('Β1. φόρος > 0', overview > 0, overview)
  ok('Β2. Επισκόπηση = Αποδόσεις', cents(overview) === cents(roi), { overview, roi })
  // Η ΠΑΛΙΑ ΒΡΑΧΥΧΡΟΝΙΑ: τα άλλα ακίνητα με `rent_config` × 12. Δείχνει τι διορθώθηκε.
  const old = taxShareOf(consolidateRentTax([
    { id: 'A', annualRent: yi.annual, shortTerm: true },
    { id: 'B', annualRent: 650 * 12, shortTerm: false },
    { id: 'C', annualRent: 300 * 12, shortTerm: true },
  ], undefined, YEAR), 'A')
  ok('Β3. η παλιά βάση της Βραχυχρόνιας έβγαζε άλλο φόρο', cents(old) !== cents(overview), { old, overview })
}

// ═══ Γ. Η ΚΑΘΑΡΗ ΑΠΟΔΟΣΗ ΤΟΥ ΠΡΟΫΠΟΛΟΓΙΣΜΟΥ ═══════════════════════════════
{
  const RECORDED = 1890
  const fees = yieldPlatformFees(fi, STAYS_A, { year: YEAR, today: TODAY, expenses: [] })
  ok('Γ1. οι προμήθειες του έτους: και των κλεισμένων', fees.annual === cents(STAYS_A.reduce((s, x) => s + (x.platform_fee as number), 0)), fees)
  const costs = yieldCosts({ recorded: RECORDED, recordedCategories: [], stayFees: fees.annual })
  const overview = computeYields(yi.annual / 12, VALUE, costs.total).netYield
  const budget = investmentReturns({ annualIncome: yi.annual, annualOpEx: costs.total, annualLoanPayment: 0, purchasePrice: VALUE, equityInvested: 0 }).capRatePct
  ok('Γ2. Προϋπολογισμός = Επισκόπηση (στα δύο δεκαδικά της οθόνης)', cents(overview) === budget, { overview, budget })
}

// ═══ Δ. Ο ΚΩΔΙΚΑΣ ΤΩΝ ΟΘΟΝΩΝ ═══════════════════════════════════════════════
{
  const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')
  const pricing = src('app/dashboard/components/TabPricing.tsx')
  ok('Δ1. η Βραχυχρόνια παίρνει τον φόρο από την propertyRentTax', /usePropertyRentTax\(propertyId, userId, profileType\)/.test(pricing) && !/consolidateRentTax\(/.test(pricing))
  ok('Δ2. η Βραχυχρόνια δεν φορολογεί τα άλλα ακίνητα με rent_config × 12', !/annualRent: monthly \* 12/.test(pricing))
  const hook = src('app/dashboard/components/usePropertyRentTax.ts')
  ok('Δ3. το usePropertyRentTax καλεί την propertyRentTax', /propertyRentTax\(\{/.test(hook))
  const overview = src('app/dashboard/components/OverviewTab.tsx')
  ok('Δ4. η Επισκόπηση καλεί την propertyRentTax', /propertyRentTax\(\{/.test(overview))
  const budget = src('app/dashboard/components/budget/useBudget.ts')
  ok('Δ5. ο Προϋπολογισμός βγάζει το καθαρό προ δόσης από το lib/facts',
    /investmentReturns\(\{ annualIncome: yiYear\.annual, annualOpEx: yieldCost\.total/.test(budget) && /yieldIncome\(fiYear\)/.test(budget))
  const roi = src('app/dashboard/components/TabRentROI.tsx')
  ok('Δ6. οι Αποδόσεις φορολογούν με τα άλλα ακίνητα από την taxpayerRentSources', /consolidateRentTax\(taxpayerRentSources\(/.test(roi))
}

console.log(`\nsameNumber: ${passed} πέρασαν, ${failed} απέτυχαν`)
if (failed) process.exit(1)
