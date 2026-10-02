// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΕΣΟΔΑ ΕΝΟΣ ΑΚΙΝΗΤΟΥ ΩΣ ΣΗΜΕΡΑ ΚΑΙ Η ΑΠΟΔΟΣΗ ΤΟΥΣ, ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ. Το ίδιο βραχυχρόνιο ακίνητο έβγαινε 0,00% στην Επισκόπηση, 6,60%
// στο Χαρτοφυλάκιο και 14,70% στις Αποδόσεις. Τρεις οθόνες, τρεις ορισμοί:
//
//   Επισκόπηση     ενοίκιο ενοικιαστή ή στόχος × 12. Οι διαμονές δεν έμπαιναν
//                  καθόλου, οπότε χωρίς στόχο ενοικίου η απόδοση ήταν μηδέν.
//   Χαρτοφυλάκιο   εισπράξεις του έτους σε ετήσιο ρυθμό, μαζί με κρατήσεις που
//                  δεν είχαν ξεκινήσει και δόσεις με ημερομηνία στο μέλλον.
//   Αποδόσεις      πληρότητα × τιμή νύχτας της περιοχής: εκτίμηση αγοράς, που
//                  η οθόνη την έγραφε σαν απόδοση του ακινήτου.
//
// Εδώ ζει ο ΕΝΑΣ ορισμός των δύο πρώτων. Οι Αποδόσεις κρατούν το δικό τους
// μοντέλο, που κοιτά μπροστά, αλλά το λένε «εκτίμηση αγοράς» όπου είναι.
//
// ΤΙ ΜΕΤΡΑ ΩΣ «ΕΙΣΠΡΑΧΘΗΚΕ ΩΣ ΣΗΜΕΡΑ»
//   Διαμονές       άφιξη μέσα στο έτος ως και σήμερα, στο δηλωτέο ακαθάριστο
//                  (ίδια βάση με το Ε2 και τη Λογιστική).
//   Δόσεις         πληρωμένες, με ημερομηνία πληρωμής ως και σήμερα. Χωρίς
//                  ημερομηνία πληρωμής κρίνει η προθεσμία· αν λείπει κι
//                  αυτή, η 1η του μήνα της περιόδου.
//   Εκτίμηση       μόνο όταν δεν υπάρχει ούτε διαμονή ούτε δόση: μηνιαίο
//                  ενοίκιο × μήνες που πέρασαν. Σημαίνεται ως εκτίμηση.
//
// Η ΣΕΙΡΑ ΕΙΝΑΙ ΤΟΥ Ε2 (lib/billing/e2.ts, buildE2Row): διαμονές, μετά
// δόσεις, μετά εκτίμηση. Ακίνητο με διαμονές μετρά από τις διαμονές, όποια κι
// αν είναι η δηλωμένη κατάσταση· χωρίς διαμονές, από τις δόσεις του.
// ═══════════════════════════════════════════════════════════════════════════
import { declarableGross, declarableGrossOrTotal, type StayAmountLike } from '@/lib/clients/stayAmounts'
import { nightsSplit, type TaxStay } from '@/lib/tax/shortTermTax'
import { daysBetweenIso } from '@/lib/core/time'
import { roundHalfUp } from '../core/money';
import { rentIncomeOf } from '@/lib/rent/split'

export interface IncomeRent {
  amount: number | null
  /** Το μίσθωμα χωρίς υπηρεσίες (lib/rent/split.ts). Χωρίς αυτό, όλο το ποσό. */
  base_rent?: number | null
  services_charge?: number | null
  paid: boolean | null
  paid_date?: string | null
  due_date?: string | null
  period_year?: number | null
  period_month?: number | null
}

export interface PropertyIncomeInput {
  /** Οι δόσεις ενοικίου του ακινήτου. Όσες είναι άλλου έτους αγνοούνται. */
  rents: readonly IncomeRent[]
  /** Οι διαμονές του ακινήτου. */
  stays: readonly StayAmountLike[]
  year: number
  /** Σημερινή ημερομηνία Αθήνας, ISO (athensToday). */
  today: string
  /** Αξία ακινήτου, για την απόδοση. */
  value?: number | null
  /** Μηνιαίο ενοίκιο ενοικιαστή: βάση της εκτίμησης όταν δεν υπάρχει καμία καταγραφή. */
  estimateMonthly?: number | null
}

export type IncomeSource = 'stays' | 'rent' | 'estimate' | 'none'

export interface PropertyIncome {
  source: IncomeSource
  /** Ό,τι εισπράχθηκε μέσα στο έτος ως και σήμερα. */
  receivedToDate: number
  /** Ο ίδιος ρυθμός σε ολόκληρο έτος. Για έτος που έκλεισε, ίσο με το παραπάνω. */
  annualized: number
  /** Το ποσό δεν είναι βέβαιο: εκτίμηση ή διαμονές χωρίς ρητή βάση ποσού. */
  estimated: boolean
  /** Διαμονές ως σήμερα με απροσδιόριστη βάση ποσού. */
  unresolvedStays: number
  /** Μεικτή απόδοση του ετήσιου ρυθμού επί της αξίας, σε ποσοστό. `null` χωρίς αξία. */
  grossYield: number | null
}

const iso = (d: string | null | undefined) => (d || '').slice(0, 10)
const pad2 = (m: number) => String(m).padStart(2, '0')

/** Η ημερομηνία που κρίνει αν μια πληρωμένη δόση έχει εισπραχθεί ως σήμερα. */
function rentDate(r: IncomeRent, year: number): string {
  if (iso(r.paid_date)) return iso(r.paid_date)
  if (iso(r.due_date)) return iso(r.due_date)
  const m = Number(r.period_month) || 0
  return m >= 1 && m <= 12 ? `${r.period_year ?? year}-${pad2(m)}-01` : ''
}

/** Πότε λήγει η δόση: η προθεσμία της, αλλιώς η 1η του μήνα της περιόδου. */
function rentDueDate(r: IncomeRent, year: number): string {
  if (iso(r.due_date)) return iso(r.due_date)
  const m = Number(r.period_month) || 0
  return m >= 1 && m <= 12 ? `${r.period_year ?? year}-${pad2(m)}-01` : ''
}

/** Πληρωμένη δόση του έτους, εισπραγμένη ως και σήμερα. */
export function rentReceivedByToday(r: IncomeRent, year: number, today: string): boolean {
  if (!r.paid) return false
  const d = rentDate(r, year)
  // Δόση χωρίς καμία ημερομηνία: δεν έχουμε τίποτα για να την κόψουμε και η
  // σήμανση «πληρώθηκε» είναι δήλωση του ιδιοκτήτη.
  return !d || d <= iso(today)
}

/**
 * Πόσους μήνες καλύπτει κάθε δόση: το σταθερό βήμα ανάμεσα στους μήνες
 * περιόδου (2, 3, 6 ή 12). Ανομοιόμορφο βήμα ή μία μόνο δόση: ένας μήνας.
 */
export function instalmentStep(months: readonly number[]): number {
  const ms = [...new Set(months.filter(m => m >= 1 && m <= 12))].sort((a, b) => a - b)
  if (ms.length < 2) return 1
  const gaps = ms.slice(1).map((m, i) => m - ms[i])
  const g = gaps[0]
  return [2, 3, 6].includes(g) && gaps.every(x => x === g) ? g : 1
}

export function propertyIncome(input: PropertyIncomeInput): PropertyIncome {
  const { year } = input
  const today = iso(input.today)
  const todayYear = Number(today.slice(0, 4))
  // Πόσο από το έτος έχει περάσει: ολόκληρο αν έκλεισε, τίποτα αν δεν ξεκίνησε.
  const yearDays = daysBetweenIso(`${year}-01-01`, `${year + 1}-01-01`)
  const daysElapsed = year < todayYear ? yearDays : year > todayYear ? 0 : daysBetweenIso(`${year}-01-01`, today) + 1
  const monthsElapsed = year < todayYear ? 12 : year > todayYear ? 0 : Number(today.slice(5, 7))

  // ΔΙΑΜΟΝΕΣ ΠΟΥ ΠΕΡΝΟΥΝ ΤΗΝ ΠΡΩΤΟΧΡΟΝΙΑ ΜΟΙΡΑΖΟΝΤΑΙ ΑΝΑ ΝΥΧΤΕΣ (02.10.2026), όπως
  // στο Ε2 και στη Λογιστική (shortTermYearSummary, yearShare). Πριν, μια διαμονή
  // 28/12 με 5/1 έδινε όλο το ποσό στο πρώτο έτος και μηδέν στο δεύτερο, ενώ το
  // έντυπο τη μοιράζει μισή μισή. Χωρίς στοιχεία νυχτών, το έτος της άφιξης.
  const shareOf = (s: StayAmountLike): number => {
    const { inYear, total } = nightsSplit(s as unknown as TaxStay, year)
    if (total > 0) return inYear / total
    return iso(s.check_in || s.check_out).slice(0, 4) === String(year) ? 1 : 0
  }
  const staysOfYear = input.stays.filter(s => shareOf(s) > 0)
  const rentsOfYear = input.rents.filter(r => (r.period_year ?? year) === year)

  let source: IncomeSource, receivedToDate = 0, annualized = 0, unresolvedStays = 0
  if (staysOfYear.length > 0) {
    source = 'stays'
    // Ως σήμερα: όσες έχουν αφιχθεί, με το μερίδιο του έτους.
    const toDate = staysOfYear.filter(x => iso(x.check_in || x.check_out) <= today)
    receivedToDate = toDate.reduce((s, x) => s + declarableGrossOrTotal(x) * shareOf(x), 0)
    unresolvedStays = toDate.filter(x => declarableGross(x) == null && declarableGrossOrTotal(x) > 0).length
    annualized = daysElapsed > 0 ? receivedToDate * (yearDays / daysElapsed) : 0
  } else if (rentsOfYear.length > 0) {
    source = 'rent'
    const received = rentsOfYear.filter(r => rentReceivedByToday(r, year, today))
    // ΜΟΝΟ ΤΟ ΜΙΣΘΩΜΑ, ΟΧΙ ΟΙ ΥΠΗΡΕΣΙΕΣ (02.10.2026). Το `amount` περιλαμβάνει
    // ό,τι χρεώνεται στον ενοικιαστή μαζί με το ενοίκιο (ίντερνετ, καθαριότητα).
    // Λογιστική και Ε2 μετρούσαν μόνο το μίσθωμα (`rentIncomeOf`), η Επισκόπηση
    // και οι Αποδόσεις όλο το ποσό: ίδιο ακίνητο, άλλο έσοδο, άλλος φόρος.
    receivedToDate = received.reduce((s, r) => s + rentIncomeOf(r), 0)
    // ΜΗΝΕΣ ΠΟΥ ΕΧΟΥΝ ΔΟΣΗ ΩΣ ΣΗΜΕΡΑ, ΟΧΙ ΜΗΝΕΣ ΤΟΥ ΗΜΕΡΟΛΟΓΙΟΥ. Στις 2/10 ο
    // Οκτώβριος μετρούσε ως μήνας που πέρασε ενώ η δόση του λήγει στις 5/10:
    // εννέα δόσεις των 650€ διαιρούνταν με δέκα μήνες και το έτος έβγαινε
    // 7.020€ αντί για 7.800€. Μετρούν οι μήνες περιόδου που είτε έχουν λήξει
    // είτε έχουν ήδη εισπραχθεί. Χωρίς μήνα περιόδου, το ημερολόγιο.
    const monthOfRent = (r: IncomeRent) => Number(r.period_month) || 0
    // ΚΑΘΕ ΔΟΣΗ ΚΑΛΥΠΤΕΙ ΤΟΥΣ ΜΗΝΕΣ ΤΗΣ (02.10.2026). Μια τριμηνιαία δόση είναι
    // τρία μισθώματα κάτω από έναν μήνα περιόδου (rentInstalments.ts). Μετρώντας
    // έναν μήνα ανά δόση, τρεις πληρωμένες δόσεις των 1.950€ έβγαιναν 23.400€ τον
    // χρόνο αντί για 7.800€. Η γραμμή δεν γράφει τη συχνότητα· τη δείχνει το
    // σταθερό βήμα ανάμεσα στους μήνες των δόσεων (1, 4, 7, 10 = ανά τρίμηνο).
    const step = instalmentStep(rentsOfYear.map(monthOfRent))
    const covered = new Set<number>()
    rentsOfYear
      .filter(r => monthOfRent(r) >= 1 && (rentReceivedByToday(r, year, today) || (rentDueDate(r, year) || '9999') <= today))
      .forEach(r => { for (let m = monthOfRent(r); m < monthOfRent(r) + step && m <= 12; m++) covered.add(m) })
    const months = rentsOfYear.every(r => monthOfRent(r) >= 1) ? covered.size : monthsElapsed
    annualized = year < todayYear ? receivedToDate : months > 0 ? receivedToDate * (12 / months) : 0
  } else if ((Number(input.estimateMonthly) || 0) > 0) {
    source = 'estimate'
    const m = Number(input.estimateMonthly)
    receivedToDate = m * monthsElapsed
    annualized = m * 12
  } else {
    source = 'none'
  }

  const cents = (x: number) => roundHalfUp(x, 2)
  const value = Number(input.value) || 0
  const annual = cents(annualized)
  return {
    source,
    receivedToDate: cents(receivedToDate),
    annualized: annual,
    estimated: source === 'estimate' || unresolvedStays > 0,
    unresolvedStays,
    grossYield: value > 0 ? (annual / value) * 100 : null,
  }
}
