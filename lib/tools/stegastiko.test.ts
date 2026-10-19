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
  housingNote, housingText, marketDescription, startRates, spreadHint, NO_MARKET,
} from './stegastiko'
import { totalInterest, interestForYear } from '@/lib/loans/recommend'
import { ECB_SERIES, seriesPage, type MarketKey, type Provenance, type RateProvenance } from '@/lib/market/ecb'

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
/** Η σελίδα της σειράς που ο κατάλογος δίνει σε αυτό το κλειδί. */
const pageOf = (key: MarketKey): string => seriesPage(ECB_SERIES.find(s => s.key === key)!.candidates[0])
{
  const prov: Provenance = {
    bog_housing_new: { value: 3.56, asOf: '2026-06-01', source: 'ΕΚΤ, στοιχεία Τράπεζας της Ελλάδος',
      basis: 'νέες χορηγήσεις', url: pageOf('bog_housing_new'), fetchedAt: '2026-09-02T05:00:00Z' },
    euribor_3m: { value: 2.513, asOf: '2026-08-01', source: 'Ευρωπαϊκή Κεντρική Τράπεζα',
      basis: 'μέσος όρος μήνα', url: pageOf('euribor_3m'), fetchedAt: '2026-09-02T05:00:00Z' },
  }
  const m = mortgageMarket(prov, '2026-09-15')
  ok('ΣΤ. μέσο επιτόκιο με την τιμή του', m.housing?.value === 3.56)
  ok('ΣΤ. μηνιαία σειρά: γράφεται ο μήνας, όχι η πρώτη του μήνα', m.housing?.period === 'Ιουνίου 2026')
  ok('ΣΤ. Euribor: μήνας', m.euribor?.period === 'Αυγούστου 2026')
  ok('ΣΤ. με πηγή', m.housing?.source === 'ΕΚΤ, στοιχεία Τράπεζας της Ελλάδος')
  ok('ΣΤ. φρέσκια τιμή δεν σημαδεύεται παλιά', m.housing?.stale === false && m.euribor?.stale === false)
  // Euribor: όριο 45 ημερών από το τέλος του μήνα· ο Αύγουστος κλείνει 01/09 και ως 15/11 είναι 75.
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

// ═══ Η. ΤΡΕΙΣ ΣΕΙΡΕΣ, ΤΡΕΙΣ ΕΤΙΚΕΤΕΣ, ΜΙΑ ΑΦΕΤΗΡΙΑ ΓΙΑ ΤΟ «ΣΤΑΘΕΡΟ» ═════════
// Το P0 της 13/10/2026: το πεδίο «Σταθερό επιτόκιο» ξεκινούσε από τη σειρά F
// (κυμαινόμενο ή σταθερό έως 1 έτος) και η σελίδα την έγραφε ως μέσο όρο. Οι
// τιμές εδώ είναι ΣΥΝΘΕΤΙΚΕΣ και διαφορετικές μεταξύ τους, ώστε μια λάθος
// αντιστοίχιση να φαίνεται στο νούμερο· δεν είναι οι τιμές της ΕΚΤ.
{
  const BOG = 'ΕΚΤ, στοιχεία Τράπεζας της Ελλάδος'
  const at = (key: MarketKey, value: number, asOf = '2026-08-01'): RateProvenance => ({
    value, asOf, source: BOG, basis: 'νέες χορηγήσεις', url: pageOf(key), fetchedAt: '2026-10-13T08:00:00Z',
  })
  const three: Provenance = {
    bog_housing_new: at('bog_housing_new', 3.21),
    bog_housing_floating: at('bog_housing_floating', 3.42),
    bog_housing_fixed: at('bog_housing_fixed', 3.05),
  }
  const m = mortgageMarket(three, '2026-10-13')
  ok('Η. μέσος όρος: η τιμή της σειράς A', m.housing?.value === 3.21 && m.housing.url.endsWith('MIR.M.GR.B.A2C.A.R.A.2250.EUR.N'))
  ok('Η. κυμαινόμενο ή έως 1 έτος: η τιμή της σειράς F', m.floating?.value === 3.42 && m.floating.url.endsWith('MIR.M.GR.B.A2C.F.R.A.2250.EUR.N'))
  ok('Η. σταθερό πάνω από 1 έτος: η τιμή της σειράς K', m.fixed?.value === 3.05 && m.fixed.url.endsWith('MIR.M.GR.B.A2C.K.R.A.2250.EUR.N'))
  ok('Η. οι ετικέτες έρχονται από τον κατάλογο',
    m.housing?.label === 'Μέσο επιτόκιο νέων στεγαστικών'
    && m.floating?.label === 'Κυμαινόμενο ή σταθερό έως 1 έτος'
    && m.fixed?.label === 'Σταθερό πάνω από 1 έτος')
  ok('Η. ο μήνας στην ονομαστική: «Αύγουστος 2026»', m.housing?.month === 'Αύγουστος 2026')

  // ── ΤΟ ΚΕΙΜΕΝΟ ΤΟΥ ΙΔΙΟΚΤΗΤΗ, ΜΕ ΤΑ ΝΟΥΜΕΡΑ ΚΑΙ ΤΟΝ ΜΗΝΑ ΑΠΟ ΤΙΣ ΣΕΙΡΕΣ ───
  ok('Η. το κείμενο της σελίδας', housingText(m) ===
    'Μέσο επιτόκιο νέων στεγαστικών στην Ελλάδα: 3,21% (Αύγουστος 2026, ΕΚΤ). '
    + 'Κυμαινόμενο ή σταθερό έως 1 έτος 3,42% · σταθερό πάνω από 1 έτος 3,05%.')
  // Κάθε νούμερο επαληθεύεται στη ΔΙΚΗ του σειρά: η ΕΚΤ του μέσου όρου στην A,
  // οι τιμές των άλλων δύο στις F και K.
  const segs = housingNote(m)
  ok('Η. η «ΕΚΤ» δείχνει στη σειρά του μέσου όρου', segs.filter(x => x.text === 'ΕΚΤ').map(x => x.href).join() === pageOf('bog_housing_new'))
  ok('Η. οι άλλες δύο τιμές δείχνουν στη δική τους σειρά',
    segs.filter(x => x.strong && x.href).map(x => x.href).join() === [pageOf('bog_housing_floating'), pageOf('bog_housing_fixed')].join())
  ok('Η. η σελίδα και η περιγραφή έχουν το ίδιο κείμενο', segs.map(x => x.text).join('') === housingText(m))
  ok('Η. η περιγραφή για τη μηχανή αναζήτησης ξεκινά με το ίδιο κείμενο',
    marketDescription(m, 'Βάση.') === `${housingText(m)} Βάση.`)
  ok('Η. χωρίς τιμές, η περιγραφή μένει η στατική', marketDescription(NO_MARKET, 'Βάση.') === 'Βάση.')
  ok('Η. χωρίς τιμές, κανένα κείμενο', housingText(NO_MARKET) === '')

  // Άλλος μήνας σε μία σειρά: γράφεται δίπλα της, ώστε να μη δανείζεται τον μήνα του μέσου όρου.
  const july = mortgageMarket({ ...three, bog_housing_fixed: at('bog_housing_fixed', 3.05, '2026-07-01') }, '2026-10-13')
  ok('Η. άλλος μήνας γράφεται δίπλα στην τιμή', housingText(july) ===
    'Μέσο επιτόκιο νέων στεγαστικών στην Ελλάδα: 3,21% (Αύγουστος 2026, ΕΚΤ). '
    + 'Κυμαινόμενο ή σταθερό έως 1 έτος 3,42% · σταθερό πάνω από 1 έτος 3,05% (Ιούλιος 2026).')
  // Χωρίς μέσο όρο: τα άλλα δύο με τον δικό τους μήνα και πηγή, όχι ως μέσος όρος.
  const noAvg = mortgageMarket({ bog_housing_floating: three.bog_housing_floating, bog_housing_fixed: three.bog_housing_fixed }, '2026-10-13')
  ok('Η. χωρίς μέσο όρο δεν γράφεται «μέσο»', housingText(noAvg) ===
    'Νέα στεγαστικά στην Ελλάδα: κυμαινόμενο ή σταθερό έως 1 έτος 3,42% (Αύγουστος 2026, ΕΚΤ) · σταθερό πάνω από 1 έτος 3,05%.')
  // Παλιές τιμές: γράφονται για αναφορά και το λένε.
  ok('Η. παλιά τιμή το λέει', housingText(mortgageMarket(three, '2027-01-15')) ===
    'Μέσο επιτόκιο νέων στεγαστικών στην Ελλάδα: 3,21% (Αύγουστος 2026, ΕΚΤ), η πηγή δεν έχει δώσει νεότερη τιμή. '
    + 'Κυμαινόμενο ή σταθερό έως 1 έτος 3,42% · σταθερό πάνω από 1 έτος 3,05%.')

  // ── Η ΑΦΕΤΗΡΙΑ ΤΟΥ «ΣΤΑΘΕΡΟ ΕΠΙΤΟΚΙΟ» ─────────────────────────────────────
  ok('Η. το «Σταθερό επιτόκιο» ξεκινά από το σταθερό πάνω από 1 έτος', startRates(m).fixed === '3,05')
  const noFixed = mortgageMarket({ bog_housing_new: three.bog_housing_new, bog_housing_floating: three.bog_housing_floating }, '2026-10-13')
  ok('Η. χωρίς σταθερό, το πεδίο μένει κενό: ποτέ ο μέσος όρος ή το κυμαινόμενο', startRates(noFixed).fixed === '')
  ok('Η. παλιό σταθερό δεν προτείνεται', startRates(mortgageMarket(three, '2027-01-15')).fixed === '')

  // ── ΧΩΡΙΣ ΣΤΑΘΕΡΟ: ΚΥΜΑΙΝΟΜΕΝΟ ΜΕ ΔΟΣΗ (19/10/2026) ─────────────────────────
  // Η γραμμή της παραγωγής: F 3,39%, Euribor 2,64%, καμία K. Η φόρμα άνοιγε στο
  // «Σταθερό» με κενό πεδίο, δηλαδή χωρίς δόση.
  const eur = { value: 2.6350455, asOf: '2026-09-01', source: 'Ευρωπαϊκή Κεντρική Τράπεζα',
    basis: 'μέσος όρος μήνα', url: pageOf('euribor_3m'), fetchedAt: '2026-10-19T08:00:00Z' }
  const prod = mortgageMarket({ bog_housing_new: at('bog_housing_new', 3.3), bog_housing_floating: at('bog_housing_floating', 3.39), euribor_3m: eur }, '2026-10-19')
  const s0 = startRates(prod)
  ok('Η. χωρίς σταθερό, ανοίγει στο κυμαινόμενο', s0.kind === 'floating' && s0.fixed === '')
  ok('Η. το περιθώριο είναι F μείον Euribor, όπως φαίνονται', s0.euribor === '2,64' && s0.spread === '0,75')
  const r0 = loanRate({ kind: s0.kind, fixed: parseRate(s0.fixed), euribor: parseRate(s0.euribor), spread: parseRate(s0.spread) })
  ok('Η. Euribor συν περιθώριο δίνουν ακριβώς το κυμαινόμενο της ΕΚΤ', near(r0, 3.39, 1e-9))
  ok('Η. …άρα η φόρμα ανοίγει με δόση', r0 !== null && mortgagePlan(150000, r0, 25).monthly > 0)
  ok('Η. η βοήθεια λέει από πού βγήκε το περιθώριο',
    spreadHint(prod) === `Νέα στεγαστικά, κυμαινόμενο ή σταθερό έως 1 έτος 3,39% (Αύγουστος 2026, ${BOG}), μείον το Euribor. Γράψε της προσφοράς σου.`)
  // Με σταθερό, η φόρμα μένει στο «Σταθερό».
  ok('Η. με σταθερό, ανοίγει στο σταθερό', startRates(mortgageMarket({ ...three, euribor_3m: eur }, '2026-10-19')).kind === 'fixed')
  // Χωρίς Euribor ή χωρίς F δεν υπάρχει περιθώριο: η φόρμα μένει στο «Σταθερό» και ζητά επιτόκιο.
  ok('Η. χωρίς Euribor, κανένα περιθώριο', startRates(noFixed).spread === '' && startRates(noFixed).kind === 'fixed')
  ok('Η. χωρίς F, κανένα περιθώριο',
    startRates(mortgageMarket({ euribor_3m: eur }, '2026-10-19')).spread === '' && spreadHint(mortgageMarket({ euribor_3m: eur }, '2026-10-19')) === null)
  // Αρνητική ή μηδενική διαφορά δεν είναι περιθώριο.
  const inverted = mortgageMarket({ bog_housing_floating: at('bog_housing_floating', 2.5), euribor_3m: eur }, '2026-10-19')
  ok('Η. αρνητική διαφορά δεν γίνεται περιθώριο', startRates(inverted).spread === '' && startRates(inverted).kind === 'fixed')
  ok('Η. χωρίς τιμές, σταθερό και κενά', JSON.stringify(startRates(NO_MARKET)) === JSON.stringify({ fixed: '', euribor: '', spread: '', kind: 'fixed' }))

  // ── ΤΙΜΗ ΑΛΛΗΣ ΣΕΙΡΑΣ ΔΕΝ ΠΕΡΝΑ ΜΕ ΑΥΤΟ ΤΟ ΟΝΟΜΑ ───────────────────────────
  // Η βάση την 13/10/2026 έχει κάτω από το `bog_housing_new` την τιμή της F με
  // σύνδεσμο A2C.F. Ως την πρώτη πρωινή εκτέλεση μετά την αλλαγή (ή όσο η ΕΚΤ
  // δεν δίνει την A) αυτή η γραμμή μένει· δεν επιτρέπεται να γραφτεί ως μέσος όρος.
  const legacy: Provenance = { bog_housing_new: { ...at('bog_housing_new', 3.42), url: pageOf('bog_housing_floating') } }
  ok('Η. η τιμή της F κάτω από το όνομα του μέσου όρου απορρίπτεται', marketFact(legacy, 'bog_housing_new', '2026-10-13') === null)
  ok('Η. …και δεν γράφεται στη σελίδα', housingText(mortgageMarket(legacy, '2026-10-13')) === '')
  ok('Η. σύνδεσμος σε άγνωστη σειρά απορρίπτεται',
    marketFact({ euribor_3m: { ...at('euribor_3m', 2.5), url: 'https://data.ecb.europa.eu/x' } }, 'euribor_3m', '2026-10-13') === null)
}

// ═══ Θ. ΤΟ EURIBOR ΤΗΣ ΠΑΡΑΓΩΓΗΣ ΣΤΙΣ 18/10/2026 ═════════════════════════════
// Ο μέσος όρος Σεπτεμβρίου (asOf 2026-09-01, 2,6350455) λεγόταν παλιός από τις
// 16/10, γιατί η ηλικία μετρούσε από την αρχή του μήνα. Το πεδίο «Euribor» του
// δημόσιου υπολογιστή ξεκινούσε κενό και η σελίδα έγραφε «η πηγή δεν έχει δώσει
// νεότερη τιμή», ενώ η τροφοδοσία δούλευε.
{
  const prodEur: Provenance = { euribor_3m: { value: 2.6350455, asOf: '2026-09-01', source: 'Ευρωπαϊκή Κεντρική Τράπεζα',
    basis: 'μέσος όρος μήνα', url: pageOf('euribor_3m'), fetchedAt: '2026-10-18T08:00:01.894Z' } }
  const m18 = mortgageMarket(prodEur, '2026-10-18')
  ok('Θ. ο Σεπτέμβριος στις 18/10 δεν είναι παλιός', m18.euribor?.stale === false)
  ok('Θ. το πεδίο Euribor ξεκινά από αυτόν', startRates(m18).euribor === '2,64')
  ok('Θ. και την τελευταία μέρα του Οκτωβρίου', startRates(mortgageMarket(prodEur, '2026-10-31')).euribor === '2,64')
  ok('Θ. αν ο Οκτώβριος δεν έρθει ως τις 16/11, παλιό', startRates(mortgageMarket(prodEur, '2026-11-16')).euribor === '')
}

console.log(failed === 0 ? `✓ stegastiko: ${passed} έλεγχοι πέρασαν` : `✗ stegastiko: ${failed} απέτυχαν από ${passed + failed}`)
if (failed > 0) process.exit(1)
