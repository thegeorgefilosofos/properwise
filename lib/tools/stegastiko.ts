// ═══════════════════════════════════════════════════════════════════════════
// ΥΠΟΛΟΓΙΣΜΟΣ ΔΟΣΗΣ ΣΤΕΓΑΣΤΙΚΟΥ: Η ΛΟΓΙΚΗ ΤΗΣ ΔΗΜΟΣΙΑΣ ΣΕΛΙΔΑΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙΠΟΤΑ ΔΕΝ ΞΑΝΑΓΡΑΦΕΤΑΙ ΕΔΩ. Η δόση είναι η `monthlyPayment` του
// lib/loans/progress.ts, η ίδια με τον πίνακα ελέγχου. Το κυμαινόμενο είναι
// Euribor συν περιθώριο με την `effectiveRate` του lib/loans/shape.ts. Το «πόσο
// δάνειο μπορώ να πάρω» είναι η `affordability` του lib/loans/affordability.ts,
// με το όριο δόσης προς εισόδημα της Τράπεζας της Ελλάδος (ΠΕΕ 227/1/08.03.2024)
// που κρατά ήδη εκείνο το αρχείο. Ο πρώτος χρόνος τόκων και κεφαλαίου έρχεται
// από την `loanCalendarYear`.
//
// ΤΙ ΠΡΟΣΘΕΤΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ. Τρία πράγματα που χρειάζεται μόνο η σελίδα:
//   1. Ανάγνωση επιτοκίου όπως το γράφει ο άνθρωπος. Το `parseAmount` διαβάζει
//      το «2.513» ως δύο χιλιάδες πεντακόσια δεκατρία, γιατί για ποσά η τελεία
//      με τρία ψηφία είναι χιλιάδες. Σε επιτόκιο δεν υπάρχουν χιλιάδες.
//   2. Τον πίνακα απόσβεσης ανά έτος, για τη σύντομη ανάλυση κάτω από τη δόση.
//   3. Την τιμή αγοράς μαζί με την ημερομηνία και την πηγή της, από την
//      ταυτότητα (`provenance`) που γράφει η τροφοδοσία της ΕΚΤ. Τιμή χωρίς
//      ημερομηνία δεν βγαίνει από εδώ: η σελίδα δεν δείχνει ποτέ επιτόκιο ως
//      τρέχον αν δεν ξέρει από πότε είναι.
// ═══════════════════════════════════════════════════════════════════════════
import { monthlyPayment, loanCalendarYear } from '@/lib/loans/progress'
import { effectiveRate } from '@/lib/loans/shape'
import { affordability, type AffordabilityResult } from '@/lib/loans/affordability'
import { ECB_SERIES, isStale, type MarketKey, type Provenance } from '@/lib/market/ecb'
import { monthGen } from '@/lib/core/months'
import { fn } from '@/lib/core/format'

/** Πάνω από αυτό δεν είναι στεγαστικό επιτόκιο, είναι λάθος πληκτρολόγησης. */
export const RATE_CAP = 20
/** Η μεγαλύτερη διάρκεια που δέχεται η φόρμα, σε έτη. */
export const YEARS_CAP = 40

/**
 * Το επιτόκιο όπως το γράφει ο άνθρωπος: «3,25», «3.25», «3,5%», «2,513».
 *
 * Ένα διαχωριστικό το πολύ και είναι πάντα υποδιαστολή. Ό,τι δεν διαβάζεται
 * επιστρέφει `null`, ώστε η οθόνη να ζητήσει επιτόκιο αντί να υπολογίσει με
 * μηδέν: δάνειο με μηδενικό τόκο δεν είναι εκτίμηση, είναι άλλο προϊόν.
 */
export function parseRate(text: string | null | undefined): number | null {
  const t = String(text ?? '').trim().replace(/\s*%$/, '')
  if (!/^\d{1,3}(?:[.,]\d{1,4})?$/.test(t)) return null
  const n = parseFloat(t.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export type RateKind = 'fixed' | 'floating'

/**
 * Το επιτόκιο του υπολογισμού. Στο κυμαινόμενο είναι Euribor συν περιθώριο,
 * όπως το ορίζει η φόρμα του πίνακα ελέγχου (`effectiveRate`). `null` όταν
 * λείπει κάποιο από όσα χρειάζεται.
 */
export function loanRate(i: { kind: RateKind; fixed: number | null; euribor: number | null; spread: number | null }): number | null {
  if (i.kind === 'fixed') return i.fixed
  if (i.euribor === null || i.spread === null) return null
  return effectiveRate({ rate_type: 'variable', euribor: i.euribor, spread: i.spread })
}

/** Ένα έτος του δανείου: τι πληρώνεται σε τόκο, τι σε κεφάλαιο, τι μένει. */
export interface ScheduleYear {
  year: number
  interest: number
  principal: number
  /** Το υπόλοιπο στο τέλος του έτους. */
  balance: number
}

export interface MortgagePlan {
  monthly: number
  months: number
  /** Όλες οι δόσεις μαζί. */
  totalPaid: number
  /** Ό,τι πληρώνεται πάνω από το κεφάλαιο. */
  totalInterest: number
  /** Ο πρώτος χρόνος: πόσο από τις δώδεκα δόσεις είναι τόκος. */
  firstYear: { interest: number; principal: number }
  schedule: ScheduleYear[]
}

/**
 * Η δόση και η απόσβεση ενός τοκοχρεολυτικού δανείου με σταθερή δόση.
 *
 * Στο κυμαινόμενο η δόση είναι αυτή που ισχύει ΟΣΟ το Euribor μένει εκεί που
 * είναι σήμερα. Η σελίδα το γράφει δίπλα στο αποτέλεσμα· εδώ δεν μαντεύεται
 * καμία μελλοντική πορεία του δείκτη.
 */
export function mortgagePlan(amount: number, ratePct: number, years: number): MortgagePlan {
  const a = Number.isFinite(amount) && amount > 0 ? amount : 0
  const y = Number.isFinite(years) && years > 0 ? years : 0
  const months = Math.round(y * 12)
  const monthly = monthlyPayment(a, ratePct, y)
  const r = Number.isFinite(ratePct) ? ratePct / 100 / 12 : 0

  const schedule: ScheduleYear[] = []
  let balance = a
  for (let yr = 1; yr <= Math.ceil(months / 12) && a > 0; yr++) {
    let interest = 0, principal = 0
    for (let m = (yr - 1) * 12 + 1; m <= Math.min(months, yr * 12); m++) {
      const i = balance * r
      // Η τελευταία δόση δεν αποπληρώνει περισσότερα από όσα απομένουν.
      const p = Math.min(balance, monthly - i)
      interest += i
      principal += p
      balance = Math.max(0, balance - p)
    }
    schedule.push({ year: yr, interest, principal, balance })
  }

  // Ο πρώτος χρόνος από την ίδια συνάρτηση που μοιράζει τόκους ανά χρήση στον
  // πίνακα ελέγχου. Χωρίς ημερομηνία έναρξης, οι δόσεις 1 έως 12 πέφτουν στη
  // χρήση που δίνεται, όποια κι αν είναι.
  const first = loanCalendarYear({ amount: a, annualRatePct: ratePct, years: y, startDate: null }, 2000)
  const totalPaid = monthly * months
  return {
    monthly, months, totalPaid,
    totalInterest: Math.max(0, totalPaid - a),
    firstYear: { interest: first.interest, principal: first.principal },
    schedule,
  }
}

/**
 * «Πόσο δάνειο μπορώ να πάρω», με τον κανόνα που ήδη εφαρμόζει η εφαρμογή.
 *
 * Μόνο ο δείκτης δόσης προς εισόδημα: 50% του καθαρού για όποιον δανείζεται
 * για πρώτη φορά, 40% για τους υπόλοιπους, μείον όσες δόσεις τρέχουν ήδη.
 * Η τράπεζα κρίνει και άλλα (ίδια συμμετοχή, σταθερότητα εισοδήματος,
 * Τειρεσίας): το αποτέλεσμα είναι ταβάνι, όχι έγκριση.
 */
export function borrowingCapacity(i: {
  incomeMonthly: number; firstTimeBuyer: boolean; existingMonthlyDebt: number
  desiredAmount: number; ratePct: number; years: number
}): AffordabilityResult {
  return affordability({
    incomeMonthly: Math.max(0, i.incomeMonthly), firstTimeBuyer: i.firstTimeBuyer,
    desiredAmount: Math.max(0, i.desiredAmount), ratePct: i.ratePct, years: i.years,
    existingMonthlyDebt: Math.max(0, i.existingMonthlyDebt),
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// Η ΤΙΜΗ ΑΓΟΡΑΣ, ΠΑΝΤΑ ΜΕ ΤΗΝ ΗΜΕΡΟΜΗΝΙΑ ΤΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Ο πίνακας `market_rates` έχει στήλες με σκέτους αριθμούς και μία στήλη
// `provenance` με την ταυτότητα κάθε τιμής: πότε παρατηρήθηκε, ποιος τη
// δημοσιεύει, πού επαληθεύεται. Η σελίδα διαβάζει ΜΟΝΟ τη δεύτερη. Αριθμός
// χωρίς ταυτότητα είναι ακριβώς αυτό που η σελίδα υπόσχεται να μη δείξει.
// ═══════════════════════════════════════════════════════════════════════════

export interface MarketFact {
  value: number
  /** Ημέρα παρατήρησης, ISO. */
  asOf: string
  /** «Ιουνίου 2026» για μηνιαία σειρά, αλλιώς «31/08/2026». */
  period: string
  /** Τι μετρά: «μέσος όρος μήνα», «νέες χορηγήσεις». */
  basis: string
  source: string
  url: string
  /** Η πηγή δεν έχει δώσει νεότερη τιμή μέσα στο όριο του είδους της. */
  stale: boolean
}

/** Η σειρά της ΕΚΤ είναι μηνιαία; Βγαίνει από τον κατάλογο, όχι από το χέρι. */
const monthlySeries = (key: MarketKey): boolean =>
  !!ECB_SERIES.find(s => s.key === key)?.candidates.every(c => c.series.startsWith('M.'))

/** Η τιμή ενός κλειδιού με την ταυτότητά της, ή `null` όταν λείπει κάτι. */
export function marketFact(p: Provenance | null | undefined, key: MarketKey, today: string): MarketFact | null {
  const v = p?.[key]
  if (!v || typeof v.value !== 'number' || !Number.isFinite(v.value)) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.asOf || '')
  if (!m || !v.source) return null
  const period = monthlySeries(key) ? `${monthGen(Number(m[2]) - 1)} ${m[1]}` : `${m[3]}/${m[2]}/${m[1]}`
  return {
    value: v.value, asOf: v.asOf, period, basis: v.basis || '', source: v.source,
    url: v.url || '', stale: isStale(key, v.asOf, today),
  }
}

/** Οι δύο τιμές που χρειάζεται η σελίδα. Κενές όταν η βάση δεν απάντησε. */
export interface MortgageMarket {
  /** Μέσο επιτόκιο νέων στεγαστικών στην Ελλάδα (ΕΚΤ, στοιχεία ΤτΕ). */
  housing: MarketFact | null
  /** Euribor τριμήνου, μέσος όρος μήνα. */
  euribor: MarketFact | null
}

export const NO_MARKET: MortgageMarket = { housing: null, euribor: null }

export function mortgageMarket(p: Provenance | null | undefined, today: string): MortgageMarket {
  return { housing: marketFact(p, 'bog_housing_new', today), euribor: marketFact(p, 'euribor_3m', today) }
}

/**
 * Η τιμή όπως μπαίνει στο πεδίο: δύο δεκαδικά με κόμμα. Ποτέ τρία: το «2,513»
 * θα το διάβαζε ως χιλιάδες όποιο πεδίο ποσού το συναντούσε.
 */
export const rateField = (n: number): string => fn(n, 2)
