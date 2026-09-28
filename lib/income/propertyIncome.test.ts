// npx tsx lib/income/propertyIncome.test.ts
//
// ΓΙΑΤΙ ΓΡΑΦΤΗΚΕ. Το ίδιο ακίνητο έβγαινε 0,00% στην Επισκόπηση, 6,60% στο
// Χαρτοφυλάκιο και 14,70% στις Αποδόσεις. Το «Έσοδα ως σήμερα» μετρούσε και
// ό,τι δεν είχε έρθει ακόμη. Εδώ ελέγχεται ο ΕΝΑΣ υπολογισμός.
import { propertyIncome, rentReceivedByToday, type IncomeRent } from './propertyIncome'
import { assumesMarket, MARKET_ESTIMATE_LABEL } from '../market/shortTerm'
import type { ClientStaysRow, RentPaymentsRow } from '../supabase/tables'

let pass = 0, fail = 0
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) pass++; else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`) }
}
function ok(name: string, cond: boolean) { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }

const TODAY = '2026-09-28'

// ═══ ΤΟ ΙΔΙΟ ΑΚΙΝΗΤΟ, ΤΑ ΣΧΗΜΑΤΑ ΠΟΥ ΦΟΡΤΩΝΕΙ Η ΚΑΘΕ ΟΘΟΝΗ ═══════════════════
// Επισκόπηση: stayStore.DECLARABLE_COLUMNS, δόσεις με amount,paid,paid_date,…
// Χαρτοφυλάκιο: τα ίδια ΣΥΝ property_id, για όλο τον λογαριασμό.
type OverviewStay = Pick<ClientStaysRow, 'check_in'|'check_out'|'nights'|'nightly_rate'|'total'|'channel'|'gross_guest_paid'|'platform_fee'|'climate_levy'|'amount_basis'>
type PortfolioStay = OverviewStay & Pick<ClientStaysRow, 'property_id'>
type PortfolioRent = Pick<RentPaymentsRow, 'property_id'|'amount'|'paid'|'paid_date'|'due_date'|'period_year'|'period_month'>

const baseStay: OverviewStay = { check_in: '', check_out: '', nights: null, nightly_rate: null, total: null, channel: 'airbnb',
  gross_guest_paid: null, platform_fee: null, climate_levy: null, amount_basis: null }
const overviewStays: OverviewStay[] = [
  { ...baseStay, check_in: '2026-06-01', check_out: '2026-06-08', nights: 7, total: 800, gross_guest_paid: 1000, platform_fee: 150, climate_levy: 50 },
  { ...baseStay, check_in: '2026-08-10', check_out: '2026-08-15', nights: 5, total: 600, gross_guest_paid: 700, platform_fee: 80, climate_levy: 20 },
  // Η κράτηση του Δεκεμβρίου δεν έχει ξεκινήσει: δεν είναι έσοδο ως σήμερα.
  { ...baseStay, check_in: '2026-12-20', check_out: '2026-12-27', nights: 7, total: 1500, gross_guest_paid: 1800, platform_fee: 250, climate_levy: 50 },
]
const portfolioStays: PortfolioStay[] = [
  ...overviewStays.map(s => ({ ...s, property_id: 'p1' })),
  { ...baseStay, property_id: 'p2', check_in: '2026-07-01', check_out: '2026-07-05', total: 400, amount_basis: 'gross' },
]
const ofP1 = portfolioStays.filter(s => s.property_id === 'p1')

const fromOverview = propertyIncome({ rents: [], stays: overviewStays, year: 2026, today: TODAY, value: 120000 })
const fromPortfolio = propertyIncome({ rents: [], stays: ofP1, year: 2026, today: TODAY, value: 120000 })
eq('βραχυχρόνια: τα έσοδα βγαίνουν από τις διαμονές', fromOverview.source, 'stays')
eq('ως σήμερα: 950 + 680, χωρίς τα 1.750 του Δεκεμβρίου', fromOverview.receivedToDate, 1630)
eq('Επισκόπηση και Χαρτοφυλάκιο: ίδια έσοδα ως σήμερα', fromPortfolio.receivedToDate, fromOverview.receivedToDate)
eq('Επισκόπηση και Χαρτοφυλάκιο: ίδια απόδοση', fromPortfolio.grossYield, fromOverview.grossYield)
ok('απόδοση βραχυχρόνιας χωρίς ενοίκιο: ΟΧΙ μηδέν (το 0,00% της Επισκόπησης)', (fromOverview.grossYield ?? 0) > 0)
// 271 ημέρες ως τις 28.9.2026: 1.630 × 365 / 271.
eq('ετήσιος ρυθμός', fromOverview.annualized, Math.round(1630 * 365 / 271 * 100) / 100)

// Διαμονές ΝΙΚΑΝΕ δόσεις, όπως στο Ε2: βραχυχρόνιο με μια ξεχασμένη δόση.
const mixed = propertyIncome({ rents: [{ amount: 500, paid: true, period_year: 2026, period_month: 3, paid_date: '2026-03-02' }], stays: overviewStays, year: 2026, today: TODAY })
eq('με διαμονές, οι διαμονές μετρούν', mixed.receivedToDate, 1630)

// ═══ ΔΟΣΗ ΜΕ ΗΜΕΡΟΜΗΝΙΑ ΣΤΟ ΜΕΛΛΟΝ ΔΕΝ ΕΙΝΑΙ ΕΙΣΠΡΑΞΗ ΩΣ ΣΗΜΕΡΑ ═══════════════
const rents: PortfolioRent[] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(m => ({
  property_id: 'p3', amount: 600, paid: true, paid_date: `2026-${String(m).padStart(2, '0')}-03`, due_date: null, period_year: 2026, period_month: m,
}))
rents.push({ property_id: 'p3', amount: 600, paid: true, paid_date: '2026-10-03', due_date: null, period_year: 2026, period_month: 10 })
rents.push({ property_id: 'p3', amount: 600, paid: false, paid_date: null, due_date: '2026-11-05', period_year: 2026, period_month: 11 })
const r = propertyIncome({ rents, stays: [], year: 2026, today: TODAY, value: 150000, estimateMonthly: 600 })
eq('μακροχρόνια: από τις δόσεις', r.source, 'rent')
eq('η πληρωμένη δόση του Οκτωβρίου (3.10) μένει έξω', r.receivedToDate, 5400)
eq('η απλήρωτη μένει έξω', rentReceivedByToday(rents[10], 2026, TODAY), false)
eq('ρυθμός: 5.400 × 12 / 9', r.annualized, 7200)
eq('απόδοση 7.200 / 150.000', r.grossYield, 4.8)
ok('δεν είναι εκτίμηση', !r.estimated)
// Χωρίς ημερομηνία πληρωμής κρίνει η προθεσμία και μετά ο μήνας της περιόδου.
const noDate = (o: Partial<IncomeRent>): IncomeRent => ({ amount: 100, paid: true, period_year: 2026, ...o })
ok('χωρίς paid_date, προθεσμία στο μέλλον: έξω', !rentReceivedByToday(noDate({ due_date: '2026-10-05', period_month: 10 }), 2026, TODAY))
ok('χωρίς ημερομηνίες, μήνας περιόδου στο μέλλον: έξω', !rentReceivedByToday(noDate({ period_month: 12 }), 2026, TODAY))
ok('χωρίς ημερομηνίες, μήνας που πέρασε: μέσα', rentReceivedByToday(noDate({ period_month: 9 }), 2026, TODAY))

// ═══ ΕΚΤΙΜΗΣΗ ΜΟΝΟ ΧΩΡΙΣ ΚΑΜΙΑ ΚΑΤΑΓΡΑΦΗ, ΚΑΙ ΣΗΜΑΙΝΕΤΑΙ ═══════════════════
const est = propertyIncome({ rents: [], stays: [], year: 2026, today: TODAY, estimateMonthly: 500 })
eq('εκτίμηση: ενοίκιο × 9 μήνες', [est.source, est.receivedToDate, est.annualized, est.estimated], ['estimate', 4500, 6000, true])
eq('τίποτα: μηδέν, χωρίς απόδοση', [propertyIncome({ rents: [], stays: [], year: 2026, today: TODAY }).source, propertyIncome({ rents: [], stays: [], year: 2026, today: TODAY }).grossYield], ['none', null])
eq('έτος που έκλεισε: ο ρυθμός είναι το σύνολο', propertyIncome({ rents: rents.map(x => ({ ...x, period_year: 2025, paid_date: x.paid_date?.replace('2026', '2025') ?? null })), stays: [], year: 2025, today: TODAY }).annualized, 6000)

// ═══ ΑΠΟΔΟΣΕΙΣ: Η ΕΚΤΙΜΗΣΗ ΑΓΟΡΑΣ ΛΕΓΕΤΑΙ ═════════════════════════════════
const area = { occupancy: '62', adr: '85' }
ok('πληρότητα και τιμή της περιοχής: εκτίμηση αγοράς', assumesMarket({ occupancy: '62', adr: '85', area, booked: null }))
ok('μόνο η πληρότητα της περιοχής: πάλι εκτίμηση αγοράς', assumesMarket({ occupancy: '62', adr: '120', area, booked: null }))
ok('από τις κρατήσεις: όχι', !assumesMarket({ occupancy: '48.5', adr: '97', area, booked: { occupancy: '48.5', adr: '97' } }))
ok('κρατήσεις που συμπίπτουν με την περιοχή: όχι', !assumesMarket({ occupancy: '62', adr: '85', area, booked: { occupancy: '62', adr: '85' } }))
ok('δικά του νούμερα: όχι', !assumesMarket({ occupancy: '40', adr: '110', area, booked: null }))
eq('η ετικέτα', MARKET_ESTIMATE_LABEL, 'εκτίμηση αγοράς')

console.log(fail === 0 ? `✓ propertyIncome: ${pass} έλεγχοι πέρασαν` : `✗ propertyIncome: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
