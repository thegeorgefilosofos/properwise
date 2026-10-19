// npx tsx lib/facts/rentTax.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΕΝΑ ΑΚΙΝΗΤΟ, ΕΝΑΣ ΦΟΡΟΣ, ΣΕ ΚΑΘΕ ΟΘΟΝΗ (έλεγχος 19/10/2026, #6)
// ─────────────────────────────────────────────────────────────────────────
// Α. Η βάση: οι πέντε κανόνες της `annualIncomeForTax`.
// Β. Οι οθόνες: η Επισκόπηση, η Σύγκριση και το Ενοικιαστής → Φόρος στήνουν
//    τα στοιχεία με τον δικό τους τρόπο. Με τα ίδια δεδομένα βγάζουν πλέον τον
//    ίδιο φόρο. Πριν, η Σύγκριση φορολογούσε τις δόσεις σε ετήσιο ρυθμό.
// Γ. Ο κώδικας των οθονών καλεί τη συνάρτηση και όχι δική του ενοποίηση.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { annualIncomeForTax, taxIncomeOf, targetMonthlyOf, type TaxIncomeRow } from './taxIncome'
import { propertyRentTax } from './rentTax'
import { propertyIncome, type IncomeRent } from '../income/propertyIncome'
import { consolidateRentTax, taxShareOf } from '../billing/consolidate'
import type { TaxpayerPropInput } from '../accounting/taxpayerIncome'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) { if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) } }
const near = (a: number, b: number, tol = 0.005) => Math.abs(a - b) <= tol

const TODAY = '2026-10-19'
const YEAR = 2026
// Μίσθωση 650€: εννέα πληρωμένες δόσεις (Ιαν–Σεπ) και η δόση του Οκτωβρίου, που
// έληξε στις 5/10, απλήρωτη. Το παράδειγμα του lib/facts/income.ts.
const rents: IncomeRent[] = Array.from({ length: 10 }, (_, i) => ({
  amount: 650, paid: i < 9, period_year: YEAR, period_month: i + 1,
  due_date: `${YEAR}-${String(i + 1).padStart(2, '0')}-05`,
  paid_date: i < 9 ? `${YEAR}-${String(i + 1).padStart(2, '0')}-05` : null,
}))

// ═══ Α. Η ΒΑΣΗ ═════════════════════════════════════════════════════════════
{
  const lease = annualIncomeForTax({ status: 'rent_long', rents, stays: [], year: YEAR, today: TODAY, leaseMonthly: 650 })
  ok('Α1. με μίσθωση: το μίσθωμα × 12, όχι οι δόσεις', lease.annual === 7800 && lease.basis === 'lease' && !lease.estimated)
  // Η παλιά βάση της Σύγκρισης, για να φαίνεται τι διορθώθηκε.
  const old = propertyIncome({ rents, stays: [], year: YEAR, today: TODAY })
  ok('Α1. η παλιά βάση της Σύγκρισης έβγαζε 7.020€', near(old.annualized, 7020))

  const pay = annualIncomeForTax({ status: 'rent_long', rents, stays: [], year: YEAR, today: TODAY })
  ok('Α3. δόσεις χωρίς μίσθωμα: ετήσιος ρυθμός, εκτίμηση', near(pay.annual, 7020) && pay.basis === 'payments' && pay.estimated)

  const stays = [{ check_in: `${YEAR}-07-01`, check_out: `${YEAR}-07-11`, nights: 10, total: 1000, gross_guest_paid: 1000 }]
  const st = annualIncomeForTax({ status: 'rent_short', rents: [], stays, year: YEAR, today: TODAY })
  ok('Α2. διαμονές: βάση «stays»', st.basis === 'stays' && st.annual > 0)

  const tgt = annualIncomeForTax({ status: 'rent_long', rents: [], stays: [], year: YEAR, today: TODAY, targetMonthly: 500 })
  ok('Α4. μισθωμένο χωρίς καταγραφή: στόχος × 12, εκτίμηση', tgt.annual === 6000 && tgt.basis === 'target' && tgt.estimated)
  ok('Α4. το μίσθωμα προηγείται του στόχου',
    annualIncomeForTax({ status: 'rent_long', rents: [], stays: [], year: YEAR, today: TODAY, leaseMonthly: 650, targetMonthly: 500 }).annual === 7800)

  const left = annualIncomeForTax({ status: 'vacant', rents: rents.slice(0, 6), stays: [], year: YEAR, today: TODAY, leaseMonthly: 650, targetMonthly: 700 })
  ok('Α5. χωρίς μίσθωση: μόνο τα εισπραγμένα, χωρίς προβολή και χωρίς στόχο', left.annual === 3900 && left.basis === 'received')
  ok('Α5. ιδιοχρησία χωρίς εισπράξεις: μηδέν',
    annualIncomeForTax({ status: 'own_use', rents: [], stays: [], year: YEAR, today: TODAY, targetMonthly: 700 }).annual === 0)

  ok('Α. ο στόχος: rent_config πρώτα, μετά ο στόχος του ακινήτου',
    targetMonthlyOf({ actual_rent: 620, target_rent: 600 }, 550) === 620
    && targetMonthlyOf({ actual_rent: null, target_rent: 600 }, 550) === 600
    && targetMonthlyOf(null, 550) === 550 && targetMonthlyOf(undefined, null) === 0)
}

// ═══ Β. ΟΙ ΟΘΟΝΕΣ ΣΥΜΦΩΝΟΥΝ ════════════════════════════════════════════════
// Τρία ακίνητα του ίδιου ιδιώτη: Α (το παράδειγμα), Β μισθωμένο 900€ χωρίς
// δόσεις, Γ κενό με στόχο 400€.
{
  const props: TaxpayerPropInput[] = [
    { id: 'A', rental_mode: 'long_term', status_detail: null, client_id: null, ownership: 100 } as TaxpayerPropInput,
    { id: 'B', rental_mode: 'long_term', status_detail: null, client_id: null, ownership: 50 } as TaxpayerPropInput,
    { id: 'C', rental_mode: null, status_detail: 'vacant', client_id: null, ownership: 100 } as TaxpayerPropInput,
  ]
  const rows: Record<string, TaxIncomeRow> = {
    A: { rents, stays: [], leaseMonthly: 650, targetMonthly: 600, viaBank: true },
    B: { rents: [], stays: [], leaseMonthly: 900, targetMonthly: 0, viaBank: true },
    C: { rents: [], stays: [], leaseMonthly: null, targetMonthly: 400, viaBank: true },
  }
  const map = () => new Map(Object.entries(rows).map(([k, v]) => [k, { ...v }]))
  const at = (income: Map<string, TaxIncomeRow>, id = 'A') =>
    propertyRentTax({ props, propertyId: id, ownerClientIds: null, income, year: YEAR, today: TODAY })

  // Η Επισκόπηση: το τρέχον με τα δικά της φορτωμένα (ίδιες γραμμές), τα άλλα από το χαρτοφυλάκιο.
  const overview = at(map())
  // Η Σύγκριση και το Ενοικιαστής → Φόρος: όλα από τις γραμμές του χαρτοφυλακίου.
  const comparison = at(map())
  const tenantView = at(map())
  ok('Β. ο φόρος του Α είναι ίδιος σε Επισκόπηση, Σύγκριση και Ενοικιαστής',
    overview.tax > 0 && overview.tax === comparison.tax && comparison.tax === tenantView.tax)
  ok('Β. η βάση του Α είναι το μίσθωμα × 12', overview.income.annual === 7800 && overview.income.basis === 'lease')

  // Ο ΦΟΡΟΣ ΤΗΣ ΠΑΛΙΑΣ ΣΥΓΚΡΙΣΗΣ: οι δόσεις σε ετήσιο ρυθμό για το Α. Δείχνει
  // ότι η διαφορά του ελέγχου ήταν πραγματική και ότι τώρα δεν υπάρχει.
  const oldComparison = consolidateRentTax([
    { id: 'A', annualRent: propertyIncome({ rents, stays: [], year: YEAR, today: TODAY }).annualized, shortTerm: false, rentsPaidViaBank: true },
    { id: 'B', annualRent: 900 * 12 * 0.5, shortTerm: false, rentsPaidViaBank: true },
  ], undefined, YEAR)
  ok('Β. η παλιά Σύγκριση έβγαζε άλλον φόρο', Math.abs(taxShareOf(oldComparison, 'A') - overview.tax) > 1)

  // Η ενοποίηση: το Β μπαίνει στο μερίδιο 50%, το Γ (κενό, χωρίς εισπράξεις) με μηδέν.
  const share = (id: string) => overview.consolidated.perProperty.find(x => x.id === id)?.annualRent
  ok('Β. το Β μετρά με το μερίδιο 50%', share('B') === 5400)
  ok('Β. το κενό Γ δεν φορολογείται από τον στόχο', (share('C') ?? 0) === 0)

  // Ο φόρος του Β, από όποια οθόνη κι αν ζητηθεί, είναι ο ίδιος και αφορά όλο το ακίνητο.
  const b = at(map(), 'B')
  ok('Β. ο φόρος του Β είναι όλου του ακινήτου (μερίδιο × 100 / 50)',
    near(b.tax, taxShareOf(b.consolidated, 'B') * 2))
  ok('Β. το σύνολο του φορολογούμενου είναι ένα, όποιο ακίνητο κι αν κοιτάς',
    near(b.consolidated.totalTax, overview.consolidated.totalTax))

  // Η βάση του τρέχοντος και των άλλων είναι η ίδια συνάρτηση: το Α ως «άλλο»
  // ακίνητο (από το Β) μετρά όσο μετρά ως τρέχον.
  ok('Β. το Α μετρά το ίδιο ως τρέχον και ως άλλο',
    b.consolidated.perProperty.find(x => x.id === 'A')?.annualRent === overview.consolidated.perProperty.find(x => x.id === 'A')?.annualRent)
  ok('Β. η taxIncomeOf δίνει την ίδια βάση με την propertyRentTax',
    taxIncomeOf('rent_long', rows.A, YEAR, TODAY).annual === overview.income.annual)
}

// ═══ Γ. ΟΙ ΟΘΟΝΕΣ ΚΑΛΟΥΝ ΤΗ ΣΥΝΑΡΤΗΣΗ ═══════════════════════════════════════
{
  const src = (f: string) => readFileSync(f, 'utf8')
  const overview = src('app/dashboard/components/OverviewTab.tsx')
  const comparison = src('app/dashboard/components/TabComparison.tsx')
  const tenant = src('app/dashboard/components/TabTenantCare.tsx')
  const hook = src('app/dashboard/components/usePropertyRentTax.ts')
  ok('Γ. η Επισκόπηση καλεί την propertyRentTax', /propertyRentTax\(\{/.test(overview) && !/taxpayerRentSources\(/.test(overview))
  ok('Γ. η Σύγκριση καλεί την propertyRentTax και δεν φορολογεί τις δόσεις σε ετήσιο ρυθμό',
    /propertyRentTax\(\{/.test(comparison) && !/propertyIncome\(/.test(comparison) && !/taxpayerRentSources\(/.test(comparison))
  ok('Γ. το Ενοικιαστής → Φόρος παίρνει τον φόρο απ\' έξω και δεν υπολογίζει δικό του',
    /rentTax\?\.tax/.test(tenant) && !/rentalIncomeTax\(/.test(tenant))
  ok('Γ. ο φορτωτής του Ενοικιαστή καλεί την propertyRentTax', /propertyRentTax\(\{/.test(hook))
  const tp = src('lib/accounting/taxpayerIncome.ts')
  ok('Γ. τα άλλα ακίνητα της ενοποίησης περνούν από την ίδια βάση', /taxIncomeOf\(/.test(tp) && !/propertyIncome\(/.test(tp))
}

console.log(failed === 0 ? `✓ rentTax: ${passed} έλεγχοι πέρασαν` : `✗ rentTax: ${failed} απέτυχαν από ${passed + failed}`)
if (failed > 0) process.exit(1)
