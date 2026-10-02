// Τεστ για τον υπολογισμό αναπροσαρμογής μισθώματος (rentAdjustment.ts).
import { computeRentAdjustment, adjustmentNoticeText, rentCapPct } from './rentAdjustment'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) { if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) } }

// Ποσοστό: 500 + 3% = 515.
const a = computeRentAdjustment({ currentRent: 500, method: 'percent', percent: 3 })
ok('percent newRent 515', a.newRent === 515)
ok('percent increase 15', a.increase === 15)
ok('percent pct 3', a.pctApplied === 3)

// ΔΤΚ: 800 + 2.5% = 820.
const c = computeRentAdjustment({ currentRent: 800, method: 'cpi', cpiPct: 2.5 })
ok('cpi newRent 820', c.newRent === 820)

// Χειροκίνητο: 500 → 560, pct = 12.
const m = computeRentAdjustment({ currentRent: 500, method: 'manual', newRentManual: 560 })
ok('manual newRent 560', m.newRent === 560)
ok('manual pct 12', m.pctApplied === 12)

// Στρογγυλοποίηση: 333.33 + 3% = 343.33.
const r = computeRentAdjustment({ currentRent: 333.33, method: 'percent', percent: 3 })
ok('rounding to 2dp', r.newRent === 343.33)

// Μηδενικό τρέχον → pct 0 (χωρίς διαίρεση με μηδέν).
const z = computeRentAdjustment({ currentRent: 0, method: 'manual', newRentManual: 400 })
ok('zero current → pct 0', z.pctApplied === 0 && z.newRent === 400)

// ── Πλαφόν 3% στις υφιστάμενες επαγγελματικές μισθώσεις του 2026 ──────────
// (άρθρο 59 ν.5255/2025 · άρθρο 96 ν.5007/2022). Ο όρος 5% έδινε 1.575€.
{
  const cap = rentCapPct({ leaseCategory: 'commercial', leaseStart: '2022-03-01', effectiveDate: '2026-04-01' })
  ok('επαγγελματική, ισχύς 2026: όριο 3%', cap === 3)
  const x = computeRentAdjustment({ currentRent: 1500, method: 'percent', percent: 5, capPct: cap })
  ok('1.500 με όρο 5% → 1.545, όχι 1.575', x.newRent === 1545)
  ok('το ποσοστό που εφαρμόστηκε είναι 3', x.pctApplied === 3 && x.increase === 45)
  ok('σημειώνεται ότι κόπηκε, με το αρχικό ποσό', x.capped === true && x.uncappedRent === 1575)
  const cpi = computeRentAdjustment({ currentRent: 1000, method: 'cpi', cpiPct: 4.4, capPct: cap })
  ok('ΔΤΚ 4,40% κόβεται κι αυτός στο 3%', cpi.newRent === 1030 && cpi.capped)
  const man = computeRentAdjustment({ currentRent: 1000, method: 'manual', newRentManual: 1100, capPct: cap })
  ok('χειροκίνητο 10% κόβεται στο 3%', man.newRent === 1030 && man.capped)
  const under = computeRentAdjustment({ currentRent: 1500, method: 'percent', percent: 2, capPct: cap })
  ok('κάτω από το όριο: τίποτα δεν αλλάζει', under.newRent === 1530 && !under.capped)
  ok('κατοικία: κανένα όριο', rentCapPct({ leaseCategory: 'residential', leaseStart: '2022-03-01', effectiveDate: '2026-04-01' }) === null)
  ok('νέα μίσθωση του 2026: κανένα όριο', rentCapPct({ leaseCategory: 'commercial', leaseStart: '2026-02-01', effectiveDate: '2026-11-01' }) === null)
  ok('ισχύς 2027: η πηγή δεν ορίζει όριο', rentCapPct({ leaseCategory: 'commercial', leaseStart: '2022-03-01', effectiveDate: '2027-01-01' }) === null)
  ok('ισχύς 2025: κανένα όριο', rentCapPct({ leaseCategory: 'commercial', leaseStart: '2022-03-01', effectiveDate: '2025-12-31' }) === null)
  const txt = adjustmentNoticeText({ effectiveDate: '01/04/2026', method: 'percent', res: x })
  ok('η ειδοποίηση εξηγεί το όριο', txt.includes('άρθρου 59 ν.5255/2025') && txt.includes('1.545,00€'))
  ok('χωρίς όριο ο υπολογισμός μένει ίδιος', computeRentAdjustment({ currentRent: 1500, method: 'percent', percent: 5 }).newRent === 1575)
}

// Το κείμενο περιέχει τα βασικά στοιχεία.
const txt = adjustmentNoticeText({ tenantName: 'Παπαδόπουλος', address: 'Ερμού 1', effectiveDate: '01/09/2026', method: 'percent', res: a })
ok('notice mentions tenant', txt.includes('Παπαδόπουλος'))
ok('notice mentions new rent', txt.includes('515'))
ok('notice mentions effective date', txt.includes('01/09/2026'))

// ── Η ΒΑΣΗ ΓΡΑΦΕΤΑΙ ΟΛΟΚΛΗΡΗ: ΜΕΤΡΟ, ΠΕΡΙΟΔΟΣ ΚΑΙ ΑΝ ΕΙΝΑΙ ΤΟ 75% ─────────
// Ο μισθωτής παίρνει υπογεγραμμένο έγγραφο με ένα ποσοστό. Χωρίς αυτά τα τρία
// δεν έχει κανέναν τρόπο να το επαληθεύσει στην ΕΛΣΤΑΤ — και δύο διαφορετικές
// βάσεις δίνουν δύο διαφορετικά νούμερα από τον ΙΔΙΟ δείκτη.
const PERIOD = 'από τον Ιούλιο 2025 ως τον Ιούνιο 2026'
{
  const full = adjustmentNoticeText({ effectiveDate: '01/09/2026', method: 'cpi', res: c, cpiPeriod: PERIOD })
  ok('η ειδοποίηση ΔΤΚ γράφει το δωδεκάμηνο', full.includes(PERIOD))
  ok('…ονομάζει την ΕΛΣΤΑΤ', full.includes('ΕΛΣΤΑΤ'))
  ok('…και λέει ότι είναι η ΔΩΔΕΚΑΜΗΝΗ μεταβολή', full.includes('δωδεκάμηνης μεταβολής'))
  ok('…και δεν αναφέρει 75% όταν δεν εφαρμόστηκε', !full.includes('75%'))

  const share = adjustmentNoticeText({ effectiveDate: '01/09/2026', method: 'cpi', res: c, cpiPeriod: PERIOD, cpiShare75: true })
  ok('με τη βάση του 75%, το έγγραφο το γράφει', share.includes('75%'))
  ok('…και κρατά και το δωδεκάμηνο', share.includes(PERIOD))

  // Χωρίς περίοδο δεν επινοείται περίοδος: η φράση απλώς δεν την αναφέρει.
  const noPeriod = adjustmentNoticeText({ effectiveDate: '01/09/2026', method: 'cpi', res: c })
  ok('χωρίς γνωστή περίοδο δεν γράφεται περίοδος', !noPeriod.includes(' ως τον '))
  ok('…αλλά το μέτρο παραμένει γραμμένο', noPeriod.includes('δωδεκάμηνης μεταβολής'))

  // Οι άλλες δύο μέθοδοι δεν επικαλούνται ΠΟΤΕ την ΕΛΣΤΑΤ: το ποσοστό είναι
  // συμβατικό ή συμφωνημένο και η επίκληση κρατικής αρχής θα ήταν ψευδής.
  const pct = adjustmentNoticeText({ effectiveDate: '01/09/2026', method: 'percent', res: a, cpiPeriod: PERIOD, cpiShare75: true })
  ok('η μέθοδος ποσοστού δεν επικαλείται την ΕΛΣΤΑΤ', !pct.includes('ΕΛΣΤΑΤ'))
  const man = adjustmentNoticeText({ effectiveDate: '01/09/2026', method: 'manual', res: m, cpiPeriod: PERIOD, cpiShare75: true })
  ok('η χειροκίνητη μέθοδος δεν επικαλείται την ΕΛΣΤΑΤ', !man.includes('ΕΛΣΤΑΤ'))
}

console.log(`rentAdjustment.test.ts: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
