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
import type { StayAmountLike } from '../clients/stayAmounts'
import type { RentSource } from '../billing/consolidate'

export interface TaxpayerPropInput extends TaxpayerProperty, StatusRow { id: string }

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
      annualRent: inc.annualized,
      shortTerm: readStatus(p) === 'rent_short' || inc.source === 'stays',
      rentsPaidViaBank: o.viaBank ?? true,
    }
  })
  return [i.current, ...others]
}
