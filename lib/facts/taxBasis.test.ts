// npx tsx lib/facts/taxBasis.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΔΥΟ ΦΟΡΟΙ ΓΙΑ ΤΟ ΙΔΙΟ ΑΚΙΝΗΤΟ, ΚΑΘΕΝΑΣ ΜΕ ΤΗ ΒΑΣΗ ΤΟΥ (έλεγχος 18/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Για ακίνητο με μίσθωση και καμία δόση ακόμη η Επισκόπηση έδειχνε φόρο
// ενοικίων (μίσθωμα × 12) και η Λογιστική 0,00€ (καμία καταχωρημένη δόση),
// χωρίς να λέει καμία ότι μετρά άλλο πράγμα. Οι δύο βάσεις είναι νόμιμες·
// το λάθος ήταν ότι δεν είχαν όνομα και ότι ο αριθμός της Επισκόπησης δεν
// φαινόταν στη Λογιστική.
//
// Α. Το ίδιο ακίνητο: η `propertyRentTax` δίνει φόρο όλης της χρονιάς, το
//    βιβλίο της Λογιστικής δεν έχει ακόμη έσοδο. Οι αριθμοί διαφέρουν.
// Β. Άρα λέγονται με διαφορετική ετικέτα, από το lib/facts/labels.
// Γ. Οι οθόνες γράφουν την ετικέτα δίπλα στον αριθμό και η Λογιστική δείχνει
//    και τον φόρο της Επισκόπησης από την ΙΔΙΑ `propertyRentTax`.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { propertyRentTax } from './rentTax'
import * as labels from './labels'
import type { TaxpayerPropInput, OtherPropertyIncome } from '../accounting/taxpayerIncome'

let passed = 0, failed = 0
function ok(name: string, cond: boolean, got?: unknown) {
  if (cond) passed++
  else { failed++; console.log('  ✗ ' + name + (got !== undefined ? ` (got ${JSON.stringify(got)})` : '')) }
}
// Μέσα από το namespace: στον παλιό κώδικα οι ετικέτες λείπουν και η δοκιμή
// πρέπει να αποτύχει στους ελέγχους της, όχι στο import.
const L = labels as Partial<typeof labels>
const TAX_BASIS_LABELS = L.TAX_BASIS_LABELS ?? { fullYear: () => '', received: '', recorded: () => '' }
const rentTaxBasisLabel = L.rentTaxBasisLabel ?? (() => '')
const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')

const YEAR = 2026, TODAY = '2026-02-10'
const PROPS: TaxpayerPropInput[] = [{ id: 'P', rental_mode: 'long_term', status_detail: 'rented' }]
const INCOME = new Map<string, OtherPropertyIncome>([
  ['P', { rents: [], stays: [], leaseMonthly: 750, targetMonthly: 750, viaBank: true }],
])

// ═══ Α. ΤΟ ΙΔΙΟ ΑΚΙΝΗΤΟ, ΔΥΟ ΒΑΣΕΙΣ ═══════════════════════════════════════
const overview = propertyRentTax({ props: PROPS, propertyId: 'P', ownerClientIds: null, income: INCOME, year: YEAR, today: TODAY })
// Η Λογιστική φορολογεί τις δόσεις του βιβλίου της χρονιάς (useAccounting,
// `rentAccruedYear`): εδώ καμία, άρα φόρος 0.
const recordedGross = (INCOME.get('P')!.rents ?? []).filter(r => r.period_year === YEAR).reduce((s, r) => s + (r.amount ?? 0), 0)
ok('Α1. Επισκόπηση: φόρος όλης της χρονιάς από τη μίσθωση', overview.tax > 0 && overview.income.basis === 'lease', overview)
ok('Α2. Λογιστική: κανένα καταχωρημένο έσοδο ακόμη', recordedGross === 0, recordedGross)

// ═══ Β. ΔΙΑΦΟΡΕΤΙΚΟΣ ΑΡΙΘΜΟΣ, ΔΙΑΦΟΡΕΤΙΚΗ ΕΤΙΚΕΤΑ ══════════════════════════
{
  const ovLabel = rentTaxBasisLabel(overview.income.basis, YEAR)
  ok('Β1. η Επισκόπηση λέει «Εκτίμηση για όλο το 2026»', ovLabel === `Εκτίμηση για όλο το ${YEAR}`, ovLabel)
  ok('Β2. η Λογιστική λέει άλλη βάση', TAX_BASIS_LABELS.recorded(YEAR) !== ovLabel, TAX_BASIS_LABELS.recorded(YEAR))
  ok('Β3. χωρίς μίσθωση: «Από όσα εισπράχθηκαν ως σήμερα»', rentTaxBasisLabel('received', YEAR) === 'Από όσα εισπράχθηκαν ως σήμερα')
  for (const l of [ovLabel, TAX_BASIS_LABELS.received, TAX_BASIS_LABELS.recorded(YEAR)]) {
    ok(`Β4. κανόνες κειμένου: «${l}»`, !/,\s*και(?![\p{L}\p{N}])/u.test(l) && !l.includes('—'), l)
  }
}

// ═══ Γ. ΟΙ ΟΘΟΝΕΣ ════════════════════════════════════════════════════════
{
  const ov = src('app/dashboard/components/OverviewTab.tsx')
  ok('Γ1. Επισκόπηση: το πλακίδιο του φόρου γράφει τη βάση του', /fact: 'tax-year',[\s\S]{0,400}sub: rentTaxBasisLabel\(rentTax\.income\.basis, year\)/.test(ov))
  const acc = src('app/dashboard/components/TabAccounting.tsx')
  ok('Γ2. Λογιστική: ο φόρος της Επισκόπησης από τον `usePropertyRentTax`', /usePropertyRentTax\(propertyId, userId, profileType\)/.test(acc))
  ok('Γ3. Λογιστική: γράφεται με την ετικέτα της βάσης του', /rentTaxBasisLabel\(rentTaxYear\.income\.basis, year\)\}: \{eur\(rentTaxYear\.tax\)\}/.test(acc))
  ok('Γ4. Λογιστική: ο δικός της φόρος λέει τη δική του βάση', acc.includes('TAX_BASIS_LABELS.recorded(year)'))
  ok('Γ5. Λογιστική: δεν ξαναϋπολογίζει τον φόρο της Επισκόπησης', !/propertyRentTax\(/.test(acc))
  ok('Γ6. ο `usePropertyRentTax` καλεί την ίδια `propertyRentTax`', /propertyRentTax\(\{/.test(src('app/dashboard/components/usePropertyRentTax.ts')))
}

console.log(`\ntaxBasis: ${passed} πέρασαν, ${failed} απέτυχαν`)
if (failed) process.exit(1)
