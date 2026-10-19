// npx tsx lib/home/forecast12.test.ts
//
// ΟΙ ΕΠΟΜΕΝΟΙ 12 ΜΗΝΕΣ ΔΕΝ ΕΧΟΥΝ ΔΙΚΟ ΤΟΥΣ ΠΟΣΟ.
// Κάθε γραμμή είναι η έξοδος μιας μηχανής που ήδη δείχνεται σε άλλη οθόνη. Αν
// η πρόβλεψη έλεγε 17,83€ για τη δόση ΕΝΦΙΑ και η Λογιστική 17,84€, ο
// ιδιοκτήτης θα έπαυε να εμπιστεύεται και τις δύο. Οι έλεγχοι εδώ ρωτούν τη
// μηχανή και συγκρίνουν, στο πνεύμα του scripts/e2e-same-number.mjs.
import { forecast12, incomeTaxInstalments, FORECAST_MONTHS, type ForecastInput, type ForecastLine } from './forecast12'
import { enfiaYear, ENFIA_DEFAULTS, type EnfiaSettings } from '../facts/enfia'
import { enfiaDueDates } from '../facts/deadlines'
import { INCOME_TAX_INSTALMENTS } from '../tax/greekTaxCalendar'
import { loanInstalment, type LoanRow } from '../loans/shape'
import { hostPayout } from '../clients/stayAmounts'
import type { LedgerEntry } from '../expenses/ledger'
import { instalmentPeriods } from '../rent/frequency'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

const TODAY = '2026-10-19'
const base: ForecastInput = { today: TODAY, lease: null }
const all = (f: ReturnType<typeof forecast12>): ForecastLine[] => f.months.flatMap(m => m.lines)
const ofKind = (f: ReturnType<typeof forecast12>, k: ForecastLine['kind']) => all(f).filter(l => l.kind === k)
const eq = (a: number, b: number) => Math.abs(a - b) < 0.005
const sum = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100

// ── ΤΟ ΠΑΡΑΘΥΡΟ ───────────────────────────────────────────────────────────
{
  const f = forecast12(base)
  ok('δώδεκα μήνες', f.months.length === FORECAST_MONTHS)
  ok('ξεκινά από τον τρέχοντα μήνα', f.months[0].ym === '2026-10')
  ok('τελειώνει έντεκα μήνες μετά', f.months[11].ym === '2027-09')
  ok('χωρίς τίποτα: κενή κατάσταση', f.empty && f.tightest === null && f.gapCount === 0)
  ok('άκυρη σημερινή ημερομηνία: κενό, όχι σφάλμα', forecast12({ ...base, today: 'αύριο' }).months.length === 0)
}

// ── ΕΝΦΙΑ: ΚΑΘΕ ΔΟΣΗ ΙΣΗ ΜΕ ΤΗΝ ΜΗΧΑΝΗ ─────────────────────────────────────
const declared: EnfiaSettings = { ...ENFIA_DEFAULTS, enfiaAnnual: '428.60' }
{
  const f = forecast12({ ...base, enfia: { settings: declared, facts: {} } })
  const lines = ofKind(f, 'enfia')
  const e26 = enfiaYear(declared, 2026, {})
  const e27 = enfiaYear(declared, 2027, {})
  const due26 = e26.instalments.filter(i => i.date >= TODAY)
  const due27 = e27.instalments.filter(i => i.date <= '2027-09-30')
  ok('ΕΝΦΙΑ 2026: οι δόσεις 8 ως 12 μέσα στο παράθυρο', due26.map(i => i.no).join() === '8,9,10,11,12')
  ok('ΕΝΦΙΑ: όσες γραμμές όσες και οι δόσεις των δύο εκκαθαριστικών', lines.length === due26.length + due27.length)
  ok('ΕΝΦΙΑ 2026: κάθε ποσό και ημερομηνία από το enfiaYear',
    due26.every(i => lines.some(l => l.date === i.date && eq(l.amount, i.amount) && l.label === `ΕΝΦΙΑ ${i.no}/12`)))
  ok('ΕΝΦΙΑ 2027: κάθε ποσό και ημερομηνία από το enfiaYear',
    due27.every(i => lines.some(l => l.date === i.date && eq(l.amount, i.amount))))
  ok('το άθροισμα των δώδεκα δόσεων της μηχανής είναι το ετήσιο', eq(sum(e26.instalments.map(i => i.amount)), e26.annual))
  // Το όριο ανάμεσα στα δύο εκκαθαριστικά από τη μηχανή, όχι γραμμένο εδώ.
  const firstOf27 = e27.instalments[0].date
  ok('δηλωμένο σε εκκαθαριστικό που εκδόθηκε: βέβαιο',
    lines.filter(l => l.date! < firstOf27).every(l => l.certainty === 'actual' && l.source === `εκκαθαριστικό ΕΝΦΙΑ ${2026}`))
  ok('το επόμενο εκκαθαριστικό δεν έχει βγει: αναμενόμενο',
    lines.filter(l => l.date! >= firstOf27).every(l => l.certainty === 'expected'))
  ok('η 8η δόση στις 30/10/2026', lines.some(l => l.label === 'ΕΝΦΙΑ 8/12' && l.date === '2026-10-30'))
}
{
  // Η δόση που σημειώθηκε πληρωμένη στο Ημερολόγιο δεν ξαναεμφανίζεται.
  const ref = enfiaDueDates(2026).find(d => d.no === 8)!.ref
  const f = forecast12({ ...base, enfia: { settings: declared, facts: {}, closedRefs: new Set([ref]) } })
  ok('δόση που έκλεισε δεν μπαίνει', !ofKind(f, 'enfia').some(l => l.label === 'ΕΝΦΙΑ 8/12' && l.date!.startsWith('2026')))
}
{
  // Εκτίμηση από τα στοιχεία, με συνιδιοκτησία 50%: η μηχανή βγάζει το μερίδιο.
  const facts = { objValue: 180000, sqm: 80, yearBuilt: 1990, ownershipPct: 50 }
  const f = forecast12({ ...base, enfia: { settings: ENFIA_DEFAULTS, facts } })
  const e = enfiaYear(ENFIA_DEFAULTS, 2026, facts)
  const l8 = ofKind(f, 'enfia').find(l => l.label === 'ΕΝΦΙΑ 8/12')
  ok('εκτίμηση: το ποσό της μηχανής στο μερίδιο', !!l8 && eq(l8.amount, e.instalments[7].amount) && e.annual > 0)
  ok('εκτίμηση: αναμενόμενο, με την πηγή του', !!l8 && l8.certainty === 'expected' && l8.source.startsWith('εκτίμηση'))
}

// ── ΦΟΡΟΣ ΕΙΣΟΔΗΜΑΤΟΣ ─────────────────────────────────────────────────────
{
  const inst = incomeTaxInstalments(1600.05, 2025)
  ok(`${INCOME_TAX_INSTALMENTS} δόσεις`, inst.length === INCOME_TAX_INSTALMENTS)
  ok('το άθροισμα είναι το ποσό, στο λεπτό', eq(sum(inst.map(i => i.amount)), 1600.05))
  ok('η πρώτη την τελευταία εργάσιμη του Ιουλίου του επόμενου έτους', inst[0].date === '2026-07-31')
  ok('η τελευταία τον Φεβρουάριο του μεθεπόμενου', inst[7].date.startsWith('2027-02'))
  ok('μηδέν ή αρνητικό: καμία δόση', incomeTaxInstalments(0, 2025).length === 0)
}
{
  const f = forecast12({ ...base, incomeTax: { statements: [{ taxYear: 2025, amount: 1600 }], estimate: { taxYear: 2026, amount: 900 } } })
  const lines = ofKind(f, 'income_tax')
  const st = incomeTaxInstalments(1600, 2025).filter(i => i.date >= TODAY)
  const es = incomeTaxInstalments(900, 2026).filter(i => i.date <= '2027-09-30')
  ok('εκκαθαριστικό 2025: οι δόσεις 4 ως 8', st.map(i => i.no).join() === '4,5,6,7,8')
  ok('εκκαθαριστικό: βέβαιο, ίδιο ποσό',
    st.every(i => lines.some(l => l.date === i.date && eq(l.amount, i.amount) && l.certainty === 'actual')))
  ok('εκτίμηση 2026: Ιούλιος ως Σεπτέμβριος 2027, αναμενόμενη', es.length === 3
    && es.every(i => lines.some(l => l.date === i.date && eq(l.amount, i.amount) && l.certainty === 'expected')))
  ok('κανένα κενό όταν υπάρχει ποσό', f.gapCount === 0)
}
{
  const f = forecast12({ ...base, incomeTax: { statements: [], estimate: null } })
  ok('χωρίς εκκαθαριστικό: καμία γραμμή, «λείπει» στους μήνες των δόσεων',
    ofKind(f, 'income_tax').length === 0 && f.months.filter(m => m.gaps.some(g => g.flow === 'income_tax')).map(m => m.ym).join()
      === '2026-10,2026-11,2026-12,2027-01,2027-02,2027-07,2027-08,2027-09')
  ok('το κενό δεν είναι μηδέν', f.months.every(m => m.lines.every(l => l.amount > 0)))
}

// ── ΔΑΝΕΙΟ ────────────────────────────────────────────────────────────────
const fixedLoan: LoanRow = { bank: 'Τράπεζα', loan_amount: 120000, rate_type: 'fixed', fixed_rate: 3.2, years: 25, start_date: '2022-03-01', status: 'active' }
{
  const f = forecast12({ ...base, loans: [fixedLoan] })
  const lines = ofKind(f, 'loan')
  ok('δόση κάθε μήνα του παραθύρου (η 1η του Οκτωβρίου πέρασε)', lines.length === 11)
  ok('κάθε δόση ίση με το loanInstalment', lines.every(l => eq(l.amount, loanInstalment(fixedLoan))))
  ok('σταθερό: βέβαιο από τη σύμβαση', lines.every(l => l.certainty === 'actual' && l.source === 'σύμβαση δανείου'))
  ok('ημερομηνία από την έναρξη', lines[0].date === '2026-11-01')
}
{
  const variable: LoanRow = { ...fixedLoan, rate_type: 'variable', fixed_rate: null, euribor: 2.1, spread: 1.6 }
  const lines = ofKind(forecast12({ ...base, loans: [variable] }), 'loan')
  ok('κυμαινόμενο: αναμενόμενο, «με το σημερινό επιτόκιο»', lines.length > 0 && lines.every(l => l.certainty === 'expected' && l.source === 'με το σημερινό επιτόκιο'))
}
{
  const ending: LoanRow = { ...fixedLoan, years: 5, start_date: '2022-01-15' } // τελευταία δόση 15/01/2027
  const lines = ofKind(forecast12({ ...base, loans: [ending] }), 'loan')
  ok('το δάνειο που τελειώνει σταματά στην τελευταία δόση', lines.map(l => l.date).join() === '2026-11-15,2026-12-15,2027-01-15')
}
{
  const noStart: LoanRow = { ...fixedLoan, start_date: null }
  const f = forecast12({ ...base, loans: [noStart] })
  ok('χωρίς έναρξη: όχι στον τρέχοντα μήνα, έντεκα αναμενόμενες', f.months[0].lines.length === 0 && ofKind(f, 'loan').length === 11
    && ofKind(f, 'loan').every(l => l.certainty === 'expected'))
}
{
  const paidOff: LoanRow = { ...fixedLoan, status: 'paid_off' }
  ok('ξεπληρωμένο δάνειο: καμία δόση', ofKind(forecast12({ ...base, loans: [paidOff] }), 'loan').length === 0)
  ok('χωρίς δάνειο: καμία δόση', ofKind(forecast12(base), 'loan').length === 0)
}

// ── ΕΝΟΙΚΙΑ ───────────────────────────────────────────────────────────────
{
  const f = forecast12({ ...base, lease: { monthlyRent: 650, start: '2024-04-01', end: '2027-03-31' } })
  const rent = ofKind(f, 'rent')
  ok('ενοίκιο από τον Νοέμβριο ως τον μήνα της λήξης', rent.length === 5 && f.months.slice(1, 6).every(m => m.lines.some(l => l.kind === 'rent')))
  ok('στον τρέχοντα μήνα χωρίς καταγραφή δεν μαντεύουμε', !f.months[0].lines.some(l => l.kind === 'rent'))
  ok('ποσό του μισθωτηρίου, βέβαιο', rent.every(l => l.amount === 650 && l.certainty === 'actual' && l.source === 'μισθωτήριο'))
  const vac = f.months.filter(m => m.gaps.some(g => g.kind === 'vacancy'))
  ok('μετά τη λήξη «κενό;» σε κάθε μήνα, ποτέ μηδέν', vac.length === 6 && vac.every(m => m.lines.every(l => l.kind !== 'rent'))
    && vac[0].ym === '2027-04' && vac[0].gaps[0].label === 'Ενοίκιο' && vac[0].gaps[0].kind === 'vacancy')
  ok('η λήξη γράφεται με ημερομηνία', vac[0].gaps[0].hint.includes('31/03/2027'))
}
{
  const f = forecast12({ ...base, lease: { monthlyRent: 700, start: '2027-01-01', end: null } })
  ok('μίσθωση που ξεκινά αργότερα: τίποτα πριν, κανένα «κενό;»',
    f.months.findIndex(m => m.lines.some(l => l.kind === 'rent')) === 3 && f.gapCount === 0)
}
{
  const f = forecast12({ ...base, lease: { monthlyRent: 650, start: '2024-04-01', end: null }, rentPeriods: [
    { amount: 650, due_date: '2026-10-05', paid: false, period_year: 2026, period_month: 10 }, // ληξιπρόθεσμη: το λέει το Ταμείο
    { amount: 650, due_date: '2026-11-05', paid: true, period_year: 2026, period_month: 11 },  // προπληρωμένη
    { amount: 680, due_date: '2026-12-05', paid: false, period_year: 2026, period_month: 12 },
  ] })
  ok('ληξιπρόθεσμη δόση: όχι εδώ, είναι του Ταμείου', !f.months[0].lines.some(l => l.kind === 'rent'))
  ok('πληρωμένη περίοδος: δεν ξαναμπαίνει', !f.months[1].lines.some(l => l.kind === 'rent'))
  ok('απλήρωτη περίοδος: με το ποσό και την προθεσμία της',
    f.months[2].lines.some(l => l.kind === 'rent' && l.amount === 680 && l.date === '2026-12-05'))
  ok('μήνες χωρίς καταγραφή: το μισθωτήριο', f.months[3].lines.some(l => l.kind === 'rent' && l.amount === 650))
}
{
  ok('χωρίς μίσθωση: καμία εισροή, κανένα «κενό;»', (() => {
    const f = forecast12({ ...base, lease: null, loans: [fixedLoan] })
    return f.months.every(m => m.inActual + m.inExpected === 0) && f.gapCount === 0
  })())
}

// ── ΒΡΑΧΥΧΡΟΝΙΑ ───────────────────────────────────────────────────────────
{
  const stays = [
    { check_in: '2026-10-25', check_out: '2026-10-29', gross_guest_paid: 520, platform_fee: 78, climate_levy: 32 },
    { check_in: '2026-12-20', check_out: '2026-12-27', total: 840, amount_basis: 'payout' },
    { check_in: '2026-10-02', check_out: '2026-10-05', total: 300, amount_basis: 'payout' }, // πέρασε
    { check_in: '2027-11-02', check_out: '2027-11-05', total: 300, amount_basis: 'payout' }, // έξω από το παράθυρο
  ]
  const lines = ofKind(forecast12({ ...base, stays }), 'stay')
  ok('μόνο κρατήσεις με άφιξη μέσα στο παράθυρο', lines.length === 2)
  ok('ποσό από το hostPayout', eq(lines[0].amount, hostPayout(stays[0])!) && eq(lines[1].amount, 840))
}

// ── ΑΣΦΑΛΙΣΗ ──────────────────────────────────────────────────────────────
{
  const f = forecast12({ ...base, insurance: { expiry: '2027-03-31', amount: 180 } })
  const l = ofKind(f, 'insurance')
  ok('ανανέωση στη λήξη, αναμενόμενη', l.length === 1 && l[0].date === '2027-03-31' && l[0].amount === 180 && l[0].certainty === 'expected')
  const g = forecast12({ ...base, insurance: { expiry: '2027-03-31', amount: null } })
  ok('χωρίς ασφάλιστρο: «λείπει», όχι μηδέν', ofKind(g, 'insurance').length === 0 && g.months[5].gaps.some(x => x.flow === 'insurance'))
  ok('ασφάλιση που έληξε: τίποτα (το λέει η ατζέντα)', forecast12({ ...base, insurance: { expiry: '2026-09-30', amount: 180 } }).empty)
}

// ── ΛΟΓΑΡΙΑΣΜΟΙ ΚΑΙ ΣΥΝΗΘΕΙΕΣ ─────────────────────────────────────────────
const entry = (o: Partial<LedgerEntry>): LedgerEntry => ({
  key: Math.random().toString(36), billId: null, expenseId: null, date: '2026-09-10', due: null,
  title: 'Κοινόχρηστα', amount: 60, paid: true, category: 'common', group: null, recurring: true, vendor: null, ...o,
})
{
  const ledger = [
    entry({ date: '2026-06-10' }), entry({ date: '2026-07-10' }), entry({ date: '2026-08-10' }), entry({ date: '2026-09-10' }),
    entry({ date: '2026-10-10', paid: false, due: '2026-10-30', amount: 64 }),
    entry({ title: 'ΕΝΦΙΑ', category: 'enfia', date: '2026-10-30', paid: false, due: '2026-10-30', amount: 35.71 }),
  ]
  const f = forecast12({ ...base, ledger, enfia: { settings: declared, facts: {} } })
  const bills = ofKind(f, 'bill')
  ok('απλήρωτος λογαριασμός με λήξη: βέβαιος', bills.length === 1 && bills[0].amount === 64 && bills[0].certainty === 'actual')
  ok('ο ΕΝΦΙΑ γραμμένος και ως δαπάνη δεν μετρά δύο φορές', !bills.some(b => b.label === 'ΕΝΦΙΑ'))
  const rec = ofKind(f, 'recurring')
  ok('η μηνιαία σειρά προβάλλεται στους επόμενους μήνες, αναμενόμενη',
    rec.length === 11 && rec.every(l => l.certainty === 'expected' && l.amount === 60 && l.source === 'συνήθως κάθε μήνα'))
  ok('ο μήνας που έχει ήδη γραμμή της σειράς δεν παίρνει δεύτερη', !f.months[0].lines.some(l => l.kind === 'recurring'))
}

// ── Ο ΠΙΟ ΣΦΙΧΤΟΣ ΜΗΝΑΣ ΚΑΙ ΓΙΑΤΙ ─────────────────────────────────────────
{
  const f = forecast12({
    ...base,
    lease: { monthlyRent: 650, start: '2024-04-01', end: null },
    enfia: { settings: declared, facts: {} },
    incomeTax: { statements: [{ taxYear: 2025, amount: 1600 }], estimate: null },
    loans: [fixedLoan],
    insurance: { expiry: '2027-02-15', amount: 180 },
  })
  const t = f.tightest!
  const minNet = Math.min(...f.months.filter(m => m.outActual + m.outExpected > 0).map(m => m.net))
  ok('ο πιο σφιχτός έχει το χαμηλότερο καθαρό', !!t && t.net === minNet)
  ok('είναι ο Φεβρουάριος: ΕΝΦΙΑ 12/12, φόρος 8/8, ασφάλιστρο και δόση μαζί', f.months[t.index].ym === '2027-02')
  ok('το «γιατί»: οι τρεις μεγαλύτερες εκροές, με σειρά', t.drivers.length === 3
    && t.drivers.every((d, i, a) => d.dir === 'out' && (i === 0 || a[i - 1].amount >= d.amount)))
  ok('καθαρό = εισροές − εκροές', f.months.every(m => eq(m.net, m.inActual + m.inExpected - m.outActual - m.outExpected)))
  ok('σωρευτικό από το μηδέν', f.months.every((m, i) => eq(m.cumulative, sum(f.months.slice(0, i + 1).map(x => x.net)))))
  ok('μήνες με γραμμές: όλοι', f.monthsWithLines === 12)
}
{
  const f = forecast12({ ...base, lease: { monthlyRent: 650, start: '2024-04-01', end: null } })
  ok('χωρίς καμία εκροή δεν υπάρχει «σφιχτός μήνας»', f.tightest === null && !f.empty)
}
{
  // Ισοπαλία: ο νωρίτερος.
  const f = forecast12({ ...base, loans: [fixedLoan] })
  ok('στην ισοπαλία ο νωρίτερος', f.tightest!.index === 1)
}

// ── ΑΝΤΙΠΑΛΟΣ ΕΛΕΓΧΟΣ 19/10/2026 ─────────────────────────────────────────
// Κάθε μπλοκ εδώ ήταν λάθος ποσό ή λάθος «πιο σφιχτός μήνας» πριν διορθωθεί.
{
  // Τριμηνιαία: η δόση είναι τρία μισθώματα στον πρώτο μήνα της, οι άλλοι δύο
  // δεν παίρνουν δεύτερο ενοίκιο. Οι περίοδοι από τη γεννήτρια του rent_payments.
  const f = forecast12({ ...base,
    lease: { monthlyRent: 500, start: '2025-01-15', end: '2027-05-31', freq: 'quarterly', dueDay: 5 },
    rentPeriods: [{ amount: 1500, due_date: '2026-10-25', paid: false, period_year: 2026, period_month: 10 }] })
  const periods = instalmentPeriods({ startISO: '2025-01-15', lastYear: 2027, lastMonth: 5, freq: 'quarterly', dueDay: 5 })
  const inWindow = periods.filter(p => p.due_date >= TODAY && p.due_date <= '2027-05-31' && !(p.year === 2026 && p.month === 10))
  const rent = ofKind(f, 'rent')
  ok('τριμηνιαία: Νοέμβριος και Δεκέμβριος χωρίς δεύτερο ενοίκιο', !f.months[1].lines.length && !f.months[2].lines.length)
  ok('τριμηνιαία: οι δόσεις στις ημερομηνίες της γεννήτριας',
    inWindow.every(p => rent.some(l => l.date === p.due_date)))
  ok('τριμηνιαία: τρία μισθώματα ανά δόση', rent.some(l => l.date === '2027-01-05' && l.amount === 1500))
  ok('η δόση που περνά τη λήξη μετρά μόνο τους μήνες της μίσθωσης', rent.some(l => l.date === '2027-04-05' && l.amount === 1000))
  ok('σύνολο ενοικίου = μισθώματα ως τη λήξη', eq(sum(rent.map(l => l.amount)), 500 * 8))
  ok('«κενό;» με το ύψος ενός μισθώματος, όχι της δόσης',
    f.months.filter(m => m.gaps.some(g => g.kind === 'vacancy')).every(m => m.gaps[0].level === 500))
}
{
  // Η δόση του τρέχοντος μήνα έληξε χωρίς γραμμή: δεν ξέρουμε, άρα ούτε ποσό
  // ούτε «πιο σφιχτός μήνας» από έλλειψη καταγραφής.
  const late: LoanRow = { ...fixedLoan, start_date: '2022-03-28' } // δόση στις 28/10, μετά από σήμερα
  const f = forecast12({ ...base, lease: { monthlyRent: 650, start: '2024-04-01', end: null, dueDay: 5 }, loans: [late] })
  ok('ο Οκτώβριος έχει εκροή, άρα θα μπορούσε να κριθεί', f.months[0].outActual > 0)
  ok('άγνωστη είσπραξη του μήνα: γράφεται ως τέτοια', f.months[0].gaps.some(g => g.kind === 'unrecorded' && g.flow === 'rent'))
  ok('ο μήνας χωρίς καταγραφή δεν κρίνεται σφιχτός', f.tightest !== null && f.tightest.index !== 0)
  const g = forecast12({ ...base, lease: { monthlyRent: 650, start: '2024-04-01', end: null, dueDay: 25 } })
  ok('δόση του μήνα που λήγει αργότερα: μπαίνει με την ημερομηνία της', g.months[0].lines.some(l => l.kind === 'rent' && l.date === '2026-10-25'))
  const h = forecast12({ ...base, lease: { monthlyRent: 650, start: '1950-01-01', end: null } })
  ok('πολύ παλιά έναρξη: οι δόσεις φτάνουν ως το τέλος του παραθύρου', h.months[11].lines.some(l => l.kind === 'rent'))
  const o = forecast12({ ...base, lease: { monthlyRent: 650, start: '2024-04-01', end: null }, loans: [late],
    rentPeriods: [{ amount: 650, due_date: '2026-10-05', paid: false, period_year: 2026, period_month: 10 }] })
  ok('ληξιπρόθεσμη του μήνα: «οφείλεται», όχι σφιχτός μήνας', o.months[0].gaps.some(g => g.kind === 'owed') && o.tightest!.index !== 0)
}
{
  // Εκκαθαριστικό με μηδέν ή επιστροφή: σαρωμένο, χωρίς δόσεις, ΟΧΙ «λείπει».
  const f = forecast12({ ...base, incomeTax: { statements: [{ taxYear: 2025, amount: 0 }], estimate: null } })
  ok('μηδενικό εκκαθαριστικό: ούτε δόσεις ούτε «λείπει» για το έτος του',
    !f.months.some(m => m.gaps.some(g => g.label.startsWith('Φόρος εισοδήματος') && g.hint.includes('2025'))) && ofKind(f, 'income_tax').length === 0)
  ok('το εκκαθαριστικό του τρέχοντος έτους δεν ζητείται πριν εκδοθεί',
    f.months.flatMap(m => m.gaps).filter(g => g.hint.includes('2026')).every(g => !g.hint.includes('Σάρωσέ')))
}
{
  // Λογαριασμός Οκτωβρίου που λήγει τον Νοέμβριο: ο Νοέμβριος δεν παίρνει και προβολή.
  const L = (date: string, paid: boolean, due: string | null = null): LedgerEntry => ({ key: date, billId: null, expenseId: date, date, due, title: 'ΔΕΗ', amount: 80, paid, category: 'Ρεύμα', group: null, recurring: true, vendor: 'ΔΕΗ' })
  const f = forecast12({ ...base, ledger: [L('2026-07-05', true), L('2026-08-05', true), L('2026-09-05', true), L('2026-10-05', false, '2026-11-03')] })
  ok('μία ΔΕΗ τον Νοέμβριο, όχι δύο', f.months[1].lines.length === 1 && f.months[1].lines[0].date === '2026-11-03')
  ok('η σειρά συνεχίζει από τον Δεκέμβριο', f.months[2].lines.length === 1 && f.months[2].lines[0].kind === 'recurring')
}

console.log(fail === 0 ? `✓ forecast12: ${pass} έλεγχοι πέρασαν` : `✗ forecast12: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
