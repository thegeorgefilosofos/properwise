// npx tsx lib/tools/stegastiko.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΔΟΣΗ ΣΤΕΓΑΣΤΙΚΟΥ: ΣΕΝΑΡΙΑ ΥΠΟΛΟΓΙΣΜΕΝΑ ΣΤΟ ΧΕΡΙ
// ─────────────────────────────────────────────────────────────────────────
// Η δημόσια σελίδα απαντά σε ερώτηση απόφασης: κάποιος θα ζητήσει δάνειο με
// βάση αυτά τα νούμερα. Τα αναμενόμενα γράφονται από τον τύπο της σταθερής
// δόσης, όχι από τη συνάρτηση που ελέγχεται.
// ═══════════════════════════════════════════════════════════════════════════
import {
  parseRate, loanRate, mortgagePlan, borrowingCapacity, marketFact, mortgageMarket, rateField,
} from './stegastiko'
import { totalInterest, interestForYear } from '@/lib/loans/recommend'
import type { Provenance } from '@/lib/market/ecb'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) { if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) } }
const near = (a: number | null, b: number, tol = 0.01) => a !== null && Math.abs(a - b) <= tol

// ═══ Α. ΤΟ ΕΠΙΤΟΚΙΟ ΟΠΩΣ ΤΟ ΓΡΑΦΕΙ Ο ΑΝΘΡΩΠΟΣ ═══════════════════════════════
ok('Α. «3,5» : 3,5', parseRate('3,5') === 3.5)
ok('Α. «3.25» : 3,25', parseRate('3.25') === 3.25)
// Το parseAmount θα το έκανε 2.513: σε επιτόκιο η τελεία είναι υποδιαστολή.
ok('Α. «2,513» : 2,513 και όχι χιλιάδες', parseRate('2,513') === 2.513)
ok('Α. «2.513» : 2,513 και όχι χιλιάδες', parseRate('2.513') === 2.513)
ok('Α. «3,5%» δεκτό', parseRate('3,5%') === 3.5)
ok('Α. «4» δεκτό', parseRate('4') === 4)
ok('Α. κενό : null, όχι μηδέν', parseRate('') === null)
ok('Α. σκουπίδια : null', parseRate('δεν ξέρω') === null)
ok('Α. δύο διαχωριστικά : null', parseRate('1.234,5') === null)
ok('Α. αρνητικό : null', parseRate('-1') === null)

// ═══ Β. ΣΤΑΘΕΡΟ Ή ΚΥΜΑΙΝΟΜΕΝΟ ═══════════════════════════════════════════════
ok('Β. σταθερό: το επιτόκιο που γράφτηκε', loanRate({ kind: 'fixed', fixed: 3.2, euribor: 2.5, spread: 1 }) === 3.2)
ok('Β. κυμαινόμενο: Euribor συν περιθώριο', near(loanRate({ kind: 'floating', fixed: 9, euribor: 2.51, spread: 1.2 }), 3.71, 1e-9))
ok('Β. κυμαινόμενο χωρίς περιθώριο : null', loanRate({ kind: 'floating', fixed: 3, euribor: 2.5, spread: null }) === null)
ok('Β. σταθερό χωρίς επιτόκιο : null', loanRate({ kind: 'fixed', fixed: null, euribor: 2.5, spread: 1 }) === null)

// ═══ Γ. Η ΔΟΣΗ: 150.000€, 3,5%, 25 ΕΤΗ ══════════════════════════════════════
// r = 0,035/12 = 0,0029167 · n = 300 · (1+r)^n ≈ 2,39588
// δόση = 150.000 × r × 2,39588 / 1,39588 ≈ 750,94€
// σύνολο 750,9354 × 300 = 225.280,61 · τόκοι 75.280,61
// πρώτος χρόνος: τόκοι 5.189,07 · κεφάλαιο 3.822,15
{
  const p = mortgagePlan(150_000, 3.5, 25)
  ok('Γ. δόση 750,94€', near(p.monthly, 750.94))
  ok('Γ. 300 δόσεις', p.months === 300)
  ok('Γ. τόκοι 75.280,61€', near(p.totalInterest, 75_280.61))
  ok('Γ. οι τόκοι συμφωνούν με την totalInterest του πίνακα ελέγχου', near(p.totalInterest, totalInterest(150_000, 3.5, 25)))
  ok('Γ. πρώτος χρόνος τόκοι 5.189,07€', near(p.firstYear.interest, 5_189.07))
  ok('Γ. πρώτος χρόνος κεφάλαιο 3.822,15€', near(p.firstYear.principal, 3_822.15))
  ok('Γ. ο πρώτος χρόνος συμφωνεί με την interestForYear', near(p.firstYear.interest, interestForYear(150_000, 3.5, 25, 1)))
  ok('Γ. 25 γραμμές στον πίνακα', p.schedule.length === 25)
  ok('Γ. η πρώτη γραμμή είναι ο πρώτος χρόνος', near(p.schedule[0].interest, p.firstYear.interest, 1e-6))
  const sumP = p.schedule.reduce((s, y) => s + y.principal, 0)
  const sumI = p.schedule.reduce((s, y) => s + y.interest, 0)
  ok('Γ. τα κεφάλαια του πίνακα κλείνουν στο ποσό', near(sumP, 150_000))
  ok('Γ. οι τόκοι του πίνακα κλείνουν στο σύνολο', near(sumI, p.totalInterest))
  ok('Γ. το υπόλοιπο τελειώνει στο μηδέν', near(p.schedule[24].balance, 0))
  ok('Γ. 13ος χρόνος: τόκος του 13ου κατά interestForYear', near(p.schedule[12].interest, interestForYear(150_000, 3.5, 25, 13)))
}

// ═══ Δ. ΑΚΡΑΙΑ ══════════════════════════════════════════════════════════════
{
  const z = mortgagePlan(120_000, 0, 10)
  ok('Δ. μηδενικό επιτόκιο: ποσό διά μήνες', near(z.monthly, 1_000))
  ok('Δ. μηδενικό επιτόκιο: μηδέν τόκοι', near(z.totalInterest, 0))
  const e = mortgagePlan(0, 3.5, 25)
  ok('Δ. χωρίς ποσό: μηδέν δόση και κενός πίνακας', e.monthly === 0 && e.schedule.length === 0)
  const f = mortgagePlan(100_000, 3, 12.5)
  ok('Δ. μισό έτος: 150 δόσεις σε 13 γραμμές', f.months === 150 && f.schedule.length === 13)
  ok('Δ. μισό έτος: η τελευταία γραμμή κλείνει το δάνειο', near(f.schedule[12].balance, 0))
  ok('Δ. τίποτα NaN', [z, e, f].every(x => Number.isFinite(x.monthly) && Number.isFinite(x.totalInterest)))
}

// ═══ Ε. ΠΟΣΟ ΔΑΝΕΙΟ ΜΠΟΡΩ ΝΑ ΠΑΡΩ ══════════════════════════════════════════
// Καθαρό 2.000€: πρώτη φορά 50% : δόση έως 1.000€, αλλιώς 40% : 800€.
// Κεφάλαιο για 1.000€ στο 3,5% και 25 έτη: 1.000 × (1 − (1+r)^−300) / r ≈ 199.751€
// Για 800€ ≈ 159.801€ · με άλλη δόση 200€ μένουν 600€ ≈ 119.851€
{
  const base = { incomeMonthly: 2_000, existingMonthlyDebt: 0, desiredAmount: 150_000, ratePct: 3.5, years: 25 }
  const first = borrowingCapacity({ ...base, firstTimeBuyer: true })
  ok('Ε. πρώτη φορά: δόση έως 1.000€', near(first.maxMonthly, 1_000))
  ok('Ε. πρώτη φορά: δάνειο έως 199.751€', near(first.maxLoan, 199_751, 1))
  ok('Ε. πρώτη φορά: όριο 50%', first.limitPct === 0.5)
  ok('Ε. 150.000€ χωρούν', first.affordable)
  const other = borrowingCapacity({ ...base, firstTimeBuyer: false })
  ok('Ε. όχι πρώτη φορά: δόση έως 800€', near(other.maxMonthly, 800))
  ok('Ε. όχι πρώτη φορά: δάνειο έως 159.801€', near(other.maxLoan, 159_801, 1))
  const debt = borrowingCapacity({ ...base, firstTimeBuyer: false, existingMonthlyDebt: 200 })
  ok('Ε. άλλη δόση 200€: μένουν 600€', near(debt.maxMonthly, 600))
  ok('Ε. άλλη δόση 200€: δάνειο έως 119.851€', near(debt.maxLoan, 119_851, 1))
  ok('Ε. 150.000€ δεν χωρούν πια', !debt.affordable && debt.gapMonthly > 0)
  const neg = borrowingCapacity({ ...base, firstTimeBuyer: true, incomeMonthly: -5, existingMonthlyDebt: -100 })
  ok('Ε. αρνητικά στοιχεία: μηδέν, όχι αρνητικό δάνειο', neg.maxMonthly === 0 && neg.maxLoan === 0)
}

// ═══ ΣΤ. Η ΤΙΜΗ ΑΓΟΡΑΣ ΜΕ ΤΗΝ ΤΑΥΤΟΤΗΤΑ ΤΗΣ ═════════════════════════════════
{
  const prov: Provenance = {
    bog_housing_new: { value: 3.56, asOf: '2026-06-01', source: 'ΕΚΤ, στοιχεία Τράπεζας της Ελλάδος',
      basis: 'νέες χορηγήσεις', url: 'https://data.ecb.europa.eu/x', fetchedAt: '2026-09-02T05:00:00Z' },
    euribor_3m: { value: 2.513, asOf: '2026-08-01', source: 'Ευρωπαϊκή Κεντρική Τράπεζα',
      basis: 'μέσος όρος μήνα', url: 'https://data.ecb.europa.eu/y', fetchedAt: '2026-09-02T05:00:00Z' },
  }
  const m = mortgageMarket(prov, '2026-09-15')
  ok('ΣΤ. μέσο επιτόκιο με την τιμή του', m.housing?.value === 3.56)
  ok('ΣΤ. μηνιαία σειρά: γράφεται ο μήνας, όχι η πρώτη του μήνα', m.housing?.period === 'Ιουνίου 2026')
  ok('ΣΤ. Euribor: μήνας', m.euribor?.period === 'Αυγούστου 2026')
  ok('ΣΤ. με πηγή', m.housing?.source === 'ΕΚΤ, στοιχεία Τράπεζας της Ελλάδος')
  ok('ΣΤ. φρέσκια τιμή δεν σημαδεύεται παλιά', m.housing?.stale === false && m.euribor?.stale === false)
  // Euribor: όριο 45 ημερών· 01/08 ως 15/11 είναι 106.
  ok('ΣΤ. παλιά τιμή σημαδεύεται', marketFact(prov, 'euribor_3m', '2026-11-15')?.stale === true)
  ok('ΣΤ. χωρίς ταυτότητα, καμία τιμή', mortgageMarket(null, '2026-09-15').housing === null)
  ok('ΣΤ. χωρίς ημερομηνία, καμία τιμή',
    marketFact({ bog_housing_new: { ...prov.bog_housing_new!, asOf: '' } }, 'bog_housing_new', '2026-09-15') === null)
  ok('ΣΤ. χωρίς πηγή, καμία τιμή',
    marketFact({ bog_housing_new: { ...prov.bog_housing_new!, source: '' } }, 'bog_housing_new', '2026-09-15') === null)
  ok('ΣΤ. μη αριθμός, καμία τιμή',
    marketFact({ bog_housing_new: { ...prov.bog_housing_new!, value: NaN } }, 'bog_housing_new', '2026-09-15') === null)
}

// ═══ Ζ. Η ΤΙΜΗ ΣΤΟ ΠΕΔΙΟ ════════════════════════════════════════════════════
ok('Ζ. δύο δεκαδικά με κόμμα', rateField(3.56) === '3,56')
ok('Ζ. το Euribor στρογγυλεύει στα δύο', rateField(2.513) === '2,51')
ok('Ζ. η τιμή του πεδίου ξαναδιαβάζεται ίδια', parseRate(rateField(3.56)) === 3.56)

console.log(failed === 0 ? `✓ stegastiko: ${passed} έλεγχοι πέρασαν` : `✗ stegastiko: ${failed} απέτυχαν από ${passed + failed}`)
if (failed > 0) process.exit(1)
