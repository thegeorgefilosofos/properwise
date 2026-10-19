// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΕΞΟΔΑ ΤΗΣ ΥΠΟΘΗΚΗΣ ΚΑΙ ΟΙ ΑΣΦΑΛΕΙΕΣ ΤΟΥ ΔΑΝΕΙΟΥ: ΕΚΤΙΜΗΣΕΙΣ ΧΩΡΙΣ ΠΗΓΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (έλεγχος 19/10/2026, #7). Η καρτέλα Δάνειο είχε δικό της
// μοντέλο εξόδων αγοράς (loan/calc/model.ts, `calcNotaryFees`), με τιμές
// γραμμένες με το χέρι δίπλα στη σελίδα. Τα έξοδα της ΑΓΟΡΑΣ βγαίνουν πλέον από
// το `transferCosts` (lib/accounting/transfer.ts), όπως στη Λογιστική. Εδώ
// μένουν ΜΟΝΟ όσα αφορούν το ΔΑΝΕΙΟ και δεν υπάρχουν στην αγορά με μετρητά.
//
// ΚΑΜΙΑ ΑΠΟ ΑΥΤΕΣ ΤΙΣ ΤΙΜΕΣ ΔΕΝ ΕΧΕΙ ΕΠΙΣΗΜΗ ΠΗΓΗ. Μεταφέρθηκαν όπως ήταν,
// χωρίς νέο αριθμό. Η οθόνη τις γράφει «εκτίμηση».
// TODO(δεν βρέθηκε, 19/10/2026):
//   · αμοιβή συμβολαιογράφου για την πράξη της υποθήκης ή της προσημείωσης·
//   · αναλογικό τέλος εγγραφής της στο Κτηματολόγιο: η απόφαση των τελών
//     (βλ. `CADASTRE_RATE` στο lib/accounting/transfer.ts) καλύπτει και τις
//     εξασφαλίσεις, αλλά το ποσοστό τους δεν βρέθηκε στα αποσπάσματα που άνοιξαν·
//   · ασφάλιστρα κατοικίας και ζωής: τα ορίζει η κάθε ασφαλιστική.
//
// Η ΥΠΟΘΗΚΗ ΜΕΤΡΑ ΣΤΟ ΚΕΦΑΛΑΙΟ ΤΟΥ ΔΑΝΕΙΟΥ, ΟΧΙ ΣΤΗΝ ΑΞΙΑ ΤΟΥ ΑΚΙΝΗΤΟΥ. Ο
// «φόρος ενεγγύησης» 0,1% υπολογιζόταν επί της αξίας του ακινήτου: για αγορά
// 200.000€ με δάνειο 50.000€ χρέωνε 200€ για εξασφάλιση των 50.000€. Η
// εξασφάλιση γράφεται για την απαίτηση της τράπεζας, άρα η βάση είναι το δάνειο.
// ═══════════════════════════════════════════════════════════════════════════
import { centsOr0 } from '@/lib/core/money'
import { SERVICES_VAT_RATE } from '@/lib/accounting/transfer'

/** Η αμοιβή της πράξης υποθήκης ως μερίδιο της αμοιβής αγοράς (εκτίμηση, χωρίς πηγή). */
export const MORTGAGE_DEED_SHARE = 0.4
/** Εγγραφή της υποθήκης, επί του κεφαλαίου του δανείου (εκτίμηση, χωρίς πηγή). */
export const MORTGAGE_REGISTRATION_RATE = 0.001
/** Ετήσια ασφάλεια κατοικίας που ζητά η τράπεζα: εύρος (εκτίμηση, χωρίς πηγή). */
export const HOME_INSURANCE_RANGE = { min: 100, max: 300 } as const
/** Ετήσια ασφάλεια ζωής επί του κεφαλαίου του δανείου (εκτίμηση, χωρίς πηγή). */
export const LIFE_INSURANCE_RATE = 0.001

export interface MortgageCosts {
  /** Συμβολαιογραφικά της υποθήκης, με ΦΠΑ. */
  deed: number
  /** Εγγραφή της υποθήκης. */
  registration: number
  total: number
  /** Πάντα αληθές: καμία από τις τιμές δεν έχει επίσημη πηγή. */
  estimated: true
}

/**
 * Τα εφάπαξ έξοδα της υποθήκης.
 * @param loanAmount το κεφάλαιο του δανείου
 * @param purchaseNotaryNet η αμοιβή του συμβολαιογράφου για την αγορά, χωρίς ΦΠΑ (`notaryFee`)
 */
export function mortgageCosts(loanAmount: number, purchaseNotaryNet: number): MortgageCosts {
  const loan = Math.max(0, Number(loanAmount) || 0)
  if (loan <= 0) return { deed: 0, registration: 0, total: 0, estimated: true }
  const deed = centsOr0(Math.max(0, purchaseNotaryNet) * MORTGAGE_DEED_SHARE * (1 + SERVICES_VAT_RATE))
  const registration = centsOr0(loan * MORTGAGE_REGISTRATION_RATE)
  return { deed, registration, total: centsOr0(deed + registration), estimated: true }
}

/** Το ετήσιο κόστος των ασφαλειών του δανείου. Δεν είναι έξοδο αγοράς. */
export function loanInsuranceYearly(loanAmount: number): { homeMin: number; homeMax: number; life: number } {
  const loan = Math.max(0, Number(loanAmount) || 0)
  return { homeMin: HOME_INSURANCE_RANGE.min, homeMax: HOME_INSURANCE_RANGE.max, life: centsOr0(loan * LIFE_INSURANCE_RATE) }
}
