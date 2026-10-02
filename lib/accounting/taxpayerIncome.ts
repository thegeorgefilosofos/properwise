// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΕΣΟΔΑ ΠΟΥ ΜΠΑΙΝΟΥΝ ΣΤΟΝ ΦΟΡΟ ΕΝΟΣ ΦΟΡΟΛΟΓΟΥΜΕΝΟΥ, ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ. Η Επισκόπηση και οι Αποδόσεις έβγαζαν τον φόρο του ακινήτου ως
// μερίδιο του φόρου ΟΛΟΥ του λογαριασμού, με τα άλλα ακίνητα στο «μηνιαίο ×
// 12» του μισθωτηρίου ή του στόχου και χωρίς `client_id`. Δύο λάθη:
//
//   · Ο επαγγελματίας με δύο ιδιοκτήτες των 12.000€ έβλεπε έναν με 24.000€:
//     το δεύτερο δωδεκάρι ανέβαινε κλιμάκιο. Η Λογιστική το ήξερε ήδη
//     (lib/accounting/taxpayer.ts)· οι δύο οθόνες όχι.
//   · Ακίνητο με διαμονές και χωρίς στόχο μετρούσε μηδέν· ακίνητο με
//     καταγεγραμμένες δόσεις μετρούσε τον στόχο, όχι αυτό που εισπράχθηκε.
//
// Εδώ: τα ακίνητα του ΙΔΙΟΥ φορολογούμενου (sameTaxpayer), καθένα με τα έσοδα
// του κοινού υπολογισμού (propertyIncome). Το τρέχον ακίνητο δίνεται απ' έξω,
// ώστε η οθόνη να φορολογεί τον αριθμό που δείχνει.
// ═══════════════════════════════════════════════════════════════════════════
import { sameTaxpayer, type TaxpayerProperty } from './taxpayer'
import { propertyIncome, type IncomeRent } from '../income/propertyIncome'
import { readStatus, type StatusRow } from '../property/status'
import { ownerShareOfAmount } from '../expenses/sharing'
import type { StayAmountLike } from '../clients/stayAmounts'
import type { RentSource } from '../billing/consolidate'

export interface TaxpayerPropInput extends TaxpayerProperty, StatusRow {
  id: string
  /** Ποσοστό συνιδιοκτησίας (στήλη `ownership`)· χωρίς τιμή, 100. */
  ownership?: string | number | null
}

// ΣΥΝΙΔΙΟΚΤΗΣΙΑ. Ο φόρος βγαίνει στο μερίδιο του φορολογούμενου: ο
// ιδιοκτήτης του 50% ενός ακινήτου 24.000€ δηλώνει 12.000€. Η
// Λογιστική και το Ε2 το εφάρμοζαν ήδη· εδώ μετρούσε όλο το ποσό, για το
// τρέχον ακίνητο και για τα άλλα, οπότε η κλίμακα ανέβαινε κλιμάκια που ο
// χρήστης δεν θα δει ποτέ στο εκκαθαριστικό του.
/** Το ποσοστό του φορολογούμενου στο ακίνητο, 0–100. Ίδια ανάγνωση με τη Λογιστική. */
export function ownershipPctOf(p: Pick<TaxpayerPropInput, 'ownership'> | undefined): number {
  const v = Number(p?.ownership)
  return Number.isFinite(v) && v > 0 ? Math.min(100, v) : 100
}

/**
 * Από τον φόρο του μεριδίου στον φόρο όλου του ακινήτου, για οθόνες που δείχνουν
 * όλο το ακίνητο (ενοίκιο, απόδοση). Υπόθεση: οι συνιδιοκτήτες φορολογούνται με
 * τον ίδιο μέσο συντελεστή. Με 100% επιστρέφει τον ίδιο αριθμό.
 */
export function wholePropertyTax(shareTax: number, ownershipPct: number): number {
  return ownershipPct > 0 && ownershipPct < 100 ? shareTax * 100 / ownershipPct : shareTax
}

export interface OtherPropertyIncome {
  rents?: readonly IncomeRent[]
  stays?: readonly StayAmountLike[]
  /** Μηνιαίο ενοίκιο μισθωτηρίου ή στόχου, όταν δεν υπάρχει καμία καταγραφή. */
  estimateMonthly?: number | null
  /** Εισπράττεται μέσω τράπεζας; Χωρίς δήλωση, ναι. */
  viaBank?: boolean
}

export interface TaxpayerSourcesInput {
  props: readonly TaxpayerPropInput[]
  /** Το ακίνητο της οθόνης, με τον αριθμό που δείχνει η ίδια. */
  current: RentSource
  /** Οι καρτέλες «Ιδιοκτήτης» του Πελατολογίου· `null` για ιδιώτη. */
  ownerClientIds: ReadonlySet<string> | null
  income: ReadonlyMap<string, OtherPropertyIncome>
  year: number
  today: string
}

/** Οι πηγές ενοικίου του φορολογούμενου του τρέχοντος ακινήτου, για τον `consolidateRentTax`. */
export function taxpayerRentSources(i: TaxpayerSourcesInput): RentSource[] {
  const mine = sameTaxpayer(i.props, i.current.id, i.ownerClientIds)
  const others = mine.filter(p => p.id !== i.current.id).map(p => {
    const o = i.income.get(p.id) ?? {}
    const inc = propertyIncome({ rents: o.rents ?? [], stays: o.stays ?? [], year: i.year, today: i.today, estimateMonthly: o.estimateMonthly })
    return {
      id: p.id,
      annualRent: ownerShareOfAmount(inc.annualized, ownershipPctOf(p)),
      shortTerm: readStatus(p) === 'rent_short' || inc.source === 'stays',
      rentsPaidViaBank: o.viaBank ?? true,
    }
  })
  const cur = i.props.find(p => p.id === i.current.id)
  return [{ ...i.current, annualRent: ownerShareOfAmount(i.current.annualRent, ownershipPctOf(cur)) }, ...others]
}
