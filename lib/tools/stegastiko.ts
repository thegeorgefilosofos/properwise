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
import { ECB_SERIES, isStale, catalogEntry, type MarketKey, type Provenance } from '@/lib/market/ecb'
import { monthGen, monthNom } from '@/lib/core/months'
import { fn, fp } from '@/lib/core/format'

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
  /** Το ίδιο στην ονομαστική: «Ιούνιος 2026», όπως γράφεται σε παρένθεση. */
  month: string
  /** Πώς λέγεται η σειρά, από τον κατάλογο `ECB_SERIES`: ποτέ γραμμένο στην οθόνη. */
  label: string
  /** Τι μετρά: «μέσος όρος μήνα», «νέες χορηγήσεις». */
  basis: string
  source: string
  url: string
  /** Η πηγή δεν έχει δώσει νεότερη τιμή μέσα στο όριο του είδους της. */
  stale: boolean
}

/**
 * Η τιμή ενός κλειδιού με την ταυτότητά της, ή `null` όταν λείπει κάτι.
 *
 * ΤΙΜΗ ΑΛΛΗΣ ΣΕΙΡΑΣ ΔΕΝ ΠΕΡΝΑ ΜΕ ΑΥΤΟ ΤΟ ΟΝΟΜΑ. Η ταυτότητα στη βάση γράφεται
 * από την τροφοδοσία και ό,τι δεν ξανάρθε μένει όπως ήταν. Οταν ένα κλειδί
 * αλλάζει σειρά, η παλιά τιμή μένει κάτω από το ίδιο όνομα ως την πρώτη
 * επιτυχημένη κλήση της νέας. Ετσι η βάση της 13/10/2026 έχει κάτω από το
 * `bog_housing_new` την τιμή της σειράς F, που η σελίδα θα έγραφε ως μέσο όρο.
 * Ο σύνδεσμος της ταυτότητας λέει από ποια σειρά ήρθε η τιμή: αν δεν είναι
 * σειρά του τρέχοντος καταλόγου για αυτό το κλειδί, η τιμή δεν δίνεται.
 */
export function marketFact(p: Provenance | null | undefined, key: MarketKey, today: string): MarketFact | null {
  const spec = ECB_SERIES.find(s => s.key === key)
  // Ο κανόνας της σειράς ζει στο lib/market/ecb.ts: τον ρωτούν και η Νόα, η
  // καρτέλα Δάνειο και ο εβδομαδιαίος απολογισμός.
  const v = catalogEntry(p, key)
  if (!spec || !v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.asOf || '')
  if (!m || !v.source) return null
  // Η σειρά είναι μηνιαία; Βγαίνει από τον κατάλογο, όχι από το χέρι.
  const monthly = spec.candidates.every(c => c.series.startsWith('M.'))
  const day = `${m[3]}/${m[2]}/${m[1]}`
  return {
    value: v.value, asOf: v.asOf,
    period: monthly ? `${monthGen(Number(m[2]) - 1)} ${m[1]}` : day,
    month: monthly ? `${monthNom(Number(m[2]) - 1)} ${m[1]}` : day,
    label: spec.label, basis: v.basis || '', source: v.source,
    url: v.url, stale: isStale(key, v.asOf, today),
  }
}

/** Οι τιμές που χρειάζεται η σελίδα. Κενές όταν η βάση δεν απάντησε. */
export interface MortgageMarket {
  /** Μέσο επιτόκιο νέων στεγαστικών στην Ελλάδα: σειρά MIR A2C.A. */
  housing: MarketFact | null
  /** Κυμαινόμενο ή σταθερό έως 1 έτος: σειρά MIR A2C.F. */
  floating: MarketFact | null
  /** Σταθερό πάνω από 1 έτος: σειρά MIR A2C.K. Η αφετηρία του «Σταθερό επιτόκιο». */
  fixed: MarketFact | null
  /** Euribor τριμήνου, μέσος όρος μήνα. */
  euribor: MarketFact | null
}

export const NO_MARKET: MortgageMarket = { housing: null, floating: null, fixed: null, euribor: null }

export function mortgageMarket(p: Provenance | null | undefined, today: string): MortgageMarket {
  return {
    housing: marketFact(p, 'bog_housing_new', today),
    floating: marketFact(p, 'bog_housing_floating', today),
    fixed: marketFact(p, 'bog_housing_fixed', today),
    euribor: marketFact(p, 'euribor_3m', today),
  }
}

/** Η τιμή μόνο όσο είναι φρέσκια: παλιά τιμή γράφεται για αναφορά, δεν προτείνεται. */
export const freshFact = (f: MarketFact | null): MarketFact | null => (f && !f.stale ? f : null)

/**
 * Από πού ξεκινούν τα πεδία επιτοκίου του υπολογιστή.
 *
 * Το «Σταθερό επιτόκιο» ξεκινά ΜΟΝΟ από τη σειρά του σταθερού πάνω από 1 έτος.
 * Χωρίς αυτήν (ή με παλιά τιμή) μένει κενό και η σελίδα ζητά το επιτόκιο της
 * προσφοράς. Ποτέ από τον μέσο όρο ή από το κυμαινόμενο: αυτό ήταν το P0.
 */
export function startRates(m: MortgageMarket): { fixed: string; euribor: string } {
  const field = (f: MarketFact | null): string => { const x = freshFact(f); return x ? rateField(x.value) : '' }
  return { fixed: field(m.fixed), euribor: field(m.euribor) }
}

// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΚΕΙΜΕΝΟ ΤΗΣ ΑΓΟΡΑΣ: ΜΙΑ ΠΗΓΗ ΓΙΑ ΤΗ ΣΕΛΙΔΑ ΚΑΙ ΓΙΑ ΤΗ ΜΗΧΑΝΗ ΑΝΑΖΗΤΗΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Η μορφή είναι του ιδιοκτήτη (αίτημα P0, 13/10/2026):
//   «Μέσο επιτόκιο νέων στεγαστικών στην Ελλάδα: Α% (Μήνας Έτος, ΕΚΤ).
//    Κυμαινόμενο ή σταθερό έως 1 έτος Β% · σταθερό πάνω από 1 έτος Γ%.»
// Οι ετικέτες είναι του καταλόγου `ECB_SERIES` και τα νούμερα και ο μήνας είναι
// της κάθε σειράς. Η σελίδα (με συνδέσμους) και η περιγραφή της (απλό κείμενο)
// χτίζονται από τα ίδια κομμάτια, ώστε να μη μπορούν να διαφωνήσουν.
//
// Κοινός μήνας γράφεται μία φορά μόνο όταν οι τιμές έχουν την ίδια ημερομηνία.
// Τιμή άλλου μήνα γράφει τον δικό της δίπλα της. Τιμή που λείπει δεν γράφεται.
// ═══════════════════════════════════════════════════════════════════════════

/** Ένα κομμάτι του κειμένου: απλό, έντονο (η τιμή) ή σύνδεσμος στη σειρά της. */
export interface NoteSeg { text: string; strong?: boolean; href?: string }

const STALE_NOTE = 'η πηγή δεν έχει δώσει νεότερη τιμή'
const lowerFirst = (s: string): string => s.charAt(0).toLocaleLowerCase('el') + s.slice(1)

export function housingNote(m: MortgageMarket): NoteSeg[] {
  const avg = m.housing
  const rest = [m.floating, m.fixed].filter((f): f is MarketFact => !!f)
  if (!avg && !rest.length) return []
  // Η πρώτη τιμή της παραγράφου κουβαλά τον μήνα και την πηγή· οι άλλες μόνο
  // αν είναι άλλου μήνα. Η ΕΚΤ της πρώτης είναι σύνδεσμος στη σειρά της και οι
  // τιμές των άλλων είναι σύνδεσμοι στη δική τους.
  const anchor = avg ?? rest[0]
  const out: NoteSeg[] = []
  const value = (f: MarketFact) => out.push(f === anchor
    ? { text: fp(f.value), strong: true }
    : { text: fp(f.value), strong: true, href: f.url })
  const after = (f: MarketFact) => {
    if (f === anchor) {
      out.push({ text: ` (${f.month}, ` }, { text: 'ΕΚΤ', href: f.url }, { text: `)${f.stale ? `, ${STALE_NOTE}` : ''}` })
    } else if (f.asOf !== anchor.asOf) {
      out.push({ text: ` (${f.month}${f.stale ? `, ${STALE_NOTE}` : ''})` })
    }
  }

  if (avg) {
    out.push({ text: `${avg.label} στην Ελλάδα: ` })
    value(avg); after(avg)
    out.push({ text: '.' })
  }
  if (rest.length) {
    out.push({ text: avg ? ' ' : 'Νέα στεγαστικά στην Ελλάδα: ' })
    rest.forEach((f, i) => {
      out.push({ text: `${i ? ' · ' : ''}${i === 0 && avg ? f.label : lowerFirst(f.label)} ` })
      value(f); after(f)
    })
    out.push({ text: '.' })
  }
  return out
}

/** Το ίδιο κείμενο χωρίς συνδέσμους. Κενό όταν δεν υπάρχει καμία τιμή. */
export const housingText = (m: MortgageMarket): string => housingNote(m).map(x => x.text).join('')

/**
 * Η περιγραφή της σελίδας για τη μηχανή αναζήτησης: πρώτα οι τιμές της αγοράς
 * από τις σειρές, μετά η στατική περιγραφή. Χωρίς τιμές, μόνο η στατική.
 */
export function marketDescription(m: MortgageMarket, base: string): string {
  const t = housingText(m)
  return t ? `${t} ${base}` : base
}

/**
 * Η τιμή όπως μπαίνει στο πεδίο: δύο δεκαδικά με κόμμα. Ποτέ τρία: το «2,513»
 * θα το διάβαζε ως χιλιάδες όποιο πεδίο ποσού το συναντούσε.
 */
export const rateField = (n: number): string => fn(n, 2)
