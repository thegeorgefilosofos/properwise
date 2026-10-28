// ═══════════════════════════════════════════════════════════════════════════
// ΕΞΟΔΑ ΑΓΟΡΑΣ ΑΚΙΝΗΤΟΥ: Ο ΦΟΡΟΣ, ΤΑ ΤΕΛΗ ΚΑΙ ΟΣΑ ΣΥΜΦΩΝΕΙΣ ΕΣΥ
// ─────────────────────────────────────────────────────────────────────────
// Η μηχανή του δημόσιου υπολογιστή /exoda-agoras-akinitou. Καθαρή συνάρτηση,
// χωρίς React: την ελέγχει το exodaAgoras.test.ts χωρίς περιηγητή.
//
// ΔΥΟ ΕΙΔΗ ΓΡΑΜΜΗΣ· Η ΔΙΑΦΟΡΑ ΤΟΥΣ ΦΑΙΝΕΤΑΙ:
//
//   · ΑΠΟ ΤΟΝ ΝΟΜΟ. Φόρος μεταβίβασης, ΦΠΑ νεόδμητου, ΦΠΑ των υπηρεσιών. Οι συντελεστές ΔΕΝ γράφονται εδώ: έρχονται από το
//     lib/accounting/transfer.ts, το ίδιο αρχείο που χρησιμοποιούν το Δάνειο και
//     η Λογιστική. Κάθε γραμμή κουβαλά το κλειδί της πηγής της (`source`).
//
//   · ΑΠΟ ΤΟΝ ΧΡΗΣΤΗ. Τέλη Κτηματολογίου, μεσιτική αμοιβή, συμβολαιογράφος,
//     δικηγόρος, λοιπά. Δεν
//     βρέθηκε επίσημη πηγή που να ορίζει ποσό ή ποσοστό που μπορούμε να
//     επαληθεύσουμε, οπότε ο υπολογιστής ΔΕΝ βάζει δικό του αριθμό: ξεκινούν
//     από μηδέν και όσα μένουν μηδέν λέγονται ρητά («δεν περιλαμβάνεται»), ώστε
//     το σύνολο να μη διαβαστεί ως πλήρες όταν δεν είναι.
//
// ΤΙ ΔΕΝ ΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ ΑΠΟ ΤΟ transfer.ts ΚΑΙ ΓΙΑΤΙ. Η `transferCosts` βάζει
// κλίμακα συμβολαιογράφου (σημειωμένη εκεί «ΔΕΝ ΕΠΑΛΗΘΕΥΤΗΚΕ»), πάγιο
// Κτηματολογίου 20€ και πιστοποιητικά 400€ (και τα δύο «ενδεικτικά») και
// δικηγόρο 0,5%. Σε δημόσια σελίδα που γράφει πηγή δίπλα σε κάθε γραμμή αυτά
// δεν στέκουν, οπότε εδώ καλούνται μόνο τα επαληθευμένα κομμάτια:
// `transferTaxOn`, `firstHomeExemption` και οι σταθερές των συντελεστών.
//
// ΤΟ ΤΕΛΟΣ ΚΤΗΜΑΤΟΛΟΓΙΟΥ ΔΕΝ ΥΠΟΛΟΓΙΖΕΤΑΙ (27/10/2026). Το 5‰ του
// `CADASTRE_RATE` (ΚΥΑ 2/2026, ΦΕΚ Β΄ 64/2026) βρέθηκε μόνο σε αποσπάσματα
// τρίτων και σε σχέδιο διαβούλευσης· το ΦΕΚ δεν άνοιξε από κανέναν δρόμο. Ώσπου
// να επαληθευτεί στο επίσημο κείμενο, το ποσό το γράφει ο χρήστης, όπως τη
// δίνει η υπηρεσία υπολογισμού κτηματολογικών τελών.
//
// ΔΥΟ ΒΑΣΕΙΣ, ΟΧΙ ΜΙΑ. Ο φόρος μεταβίβασης επιβάλλεται στη μεγαλύτερη από
// τίμημα και αντικειμενική (άρθρο 25 παρ. 1 ν.5219/2025). Ο ΦΠΑ του νεόδμητου
// στο τίμημα (Κώδικας ΦΠΑ, ΦΕΚ Α΄ 162/2024, άρθρο 24 περ. ε΄: «ως φορολογητέα αξία λαμβάνεται το
// τίμημα»).
// ═══════════════════════════════════════════════════════════════════════════
import { centsOr0 } from '@/lib/core/money'
import {
  transferTaxOn, firstHomeExemption, NEW_BUILD_VAT_RATE, SERVICES_VAT_RATE,
} from '@/lib/accounting/transfer'

/**
 * Η ημέρα που ελέγχθηκαν οι πηγές της σελίδας στο κείμενο των ΦΕΚ. Είναι η
 * «Τελευταία ενημέρωση» της σελίδας και του χάρτη (app/pageUpdated.ts).
 */
export const PURCHASE_SOURCES_CHECKED = '2026-10-27'

/** Τι αγοράζεται, όπως το ξεχωρίζει ο νόμος για τον φόρο. */
export type BuyKind =
  /** Μεταχειρισμένο ή από ιδιώτη: φόρος μεταβίβασης. */
  | 'resale'
  /** Νεόδμητο από κατασκευαστή σε αναστολή ΦΠΑ: φόρος μεταβίβασης. */
  | 'newSuspended'
  /** Νεόδμητο από κατασκευαστή χωρίς αναστολή: ΦΠΑ αντί για φόρο μεταβίβασης. */
  | 'newVat'

/** Από πού βγαίνει μια γραμμή. Η οθόνη το γράφει με λέξεις και σύνδεσμο. */
export type SourceKey = 'transferTax' | 'newBuildVat' | 'servicesVat' | 'user'

export interface PurchaseInput {
  /** Το τίμημα του συμβολαίου. */
  price: number
  /** Η αντικειμενική αξία· 0 ή κενό σημαίνει «ίδια με το τίμημα». */
  objective?: number
  kind: BuyKind
  /** Αγορά πρώτης κατοικίας με απαλλαγή (άρθρα 40 έως 44 ν.5219/2025). */
  firstHome?: boolean
  married?: boolean
  children?: number
  /** Μεσιτική αμοιβή, ποσοστό του τιμήματος χωρίς ΦΠΑ (π.χ. 2 για 2%). */
  agentPct?: number
  /** Αμοιβή συμβολαιογράφου χωρίς ΦΠΑ, όπως στην προσφορά του. */
  notaryNet?: number
  /** Αμοιβή δικηγόρου χωρίς ΦΠΑ, όπως συμφωνήθηκε. */
  lawyerNet?: number
  /** Τέλη Κτηματολογίου όπως τα δίνει ο υπολογισμός του Κτηματολογίου. */
  cadastre?: number
  /** Λοιπά έξοδα όπως τα πληρώνεις (πιστοποιητικά, μηχανικός, εκτίμηση). */
  other?: number
  /** Το ποσό του δανείου, για τα μετρητά που μένουν εκτός δανείου. */
  loan?: number
}

export interface PurchaseLine {
  key: 'transferTax' | 'vat' | 'cadastre' | 'agent' | 'notary' | 'lawyer' | 'other'
  amount: number
  source: SourceKey
  /** Το ποσό πριν από τον ΦΠΑ, για τις υπηρεσίες. */
  net?: number
}

export interface PurchaseResult {
  price: number
  /** Η βάση του φόρου μεταβίβασης. */
  taxBase: number
  /** Ο φόρος μεταβίβασης εφαρμόζεται (όχι ο ΦΠΑ). */
  transferTaxApplies: boolean
  /** Το ποσό της αξίας που απαλλάσσεται· 0 χωρίς απαλλαγή ή με ΦΠΑ. */
  exemption: number
  lines: PurchaseLine[]
  /** Οι γραμμές του χρήστη που έμειναν μηδέν: δεν περιλαμβάνονται στο σύνολο. */
  missing: Array<'cadastre' | 'agent' | 'notary' | 'lawyer'>
  total: number
  /** Τα έξοδα ως ποσοστό του τιμήματος (0 έως 1). */
  costShare: number
  /** Το δάνειο που μετρά, έως το τίμημα. */
  loan: number
  /** Ίδια συμμετοχή στο τίμημα: τίμημα μείον δάνειο. */
  downPayment: number
  /** Ό,τι πρέπει να υπάρχει σε μετρητά: ίδια συμμετοχή και όλα τα έξοδα. */
  cashNeeded: number
}

/** Μη αρνητικό, πεπερασμένο ποσό. Ό,τι δεν διαβάζεται είναι μηδέν. */
const pos = (n: number | undefined): number => Math.max(0, centsOr0(n ?? 0))

/** Με ΦΠΑ υπηρεσιών (Κώδικας ΦΠΑ, άρθρο 26 παρ. 1). */
const withVat = (net: number): number => centsOr0(net * (1 + SERVICES_VAT_RATE))

/** Τα έξοδα της αγοράς γραμμή γραμμή και τα μετρητά εκτός δανείου. */
export function purchaseCosts(input: PurchaseInput): PurchaseResult {
  const price = pos(input.price)
  const objective = pos(input.objective)
  const taxBase = Math.max(price, objective)
  const transferTaxApplies = input.kind !== 'newVat'
  const lines: PurchaseLine[] = []

  let exemption = 0
  if (transferTaxApplies) {
    exemption = input.firstHome
      ? firstHomeExemption({ married: !!input.married, children: Math.max(0, Math.floor(input.children ?? 0)) })
      : 0
    lines.push({ key: 'transferTax', amount: transferTaxOn(taxBase, exemption), source: 'transferTax' })
  } else {
    lines.push({ key: 'vat', amount: centsOr0(price * NEW_BUILD_VAT_RATE), source: 'newBuildVat' })
  }
  const missing: PurchaseResult['missing'] = []
  const cadastre = pos(input.cadastre)
  if (cadastre > 0) lines.push({ key: 'cadastre', amount: cadastre, source: 'user' })
  else missing.push('cadastre')

  const agentNet = centsOr0(price * (pos(input.agentPct) / 100))
  const notaryNet = pos(input.notaryNet)
  const lawyerNet = pos(input.lawyerNet)
  if (agentNet > 0) lines.push({ key: 'agent', amount: withVat(agentNet), net: agentNet, source: 'servicesVat' })
  else missing.push('agent')
  if (notaryNet > 0) lines.push({ key: 'notary', amount: withVat(notaryNet), net: notaryNet, source: 'servicesVat' })
  else missing.push('notary')
  if (lawyerNet > 0) lines.push({ key: 'lawyer', amount: withVat(lawyerNet), net: lawyerNet, source: 'servicesVat' })
  else missing.push('lawyer')
  const other = pos(input.other)
  if (other > 0) lines.push({ key: 'other', amount: other, source: 'user' })

  const total = centsOr0(lines.reduce((s, l) => s + l.amount, 0))
  const loan = Math.min(pos(input.loan), price)
  const downPayment = centsOr0(price - loan)
  return {
    price, taxBase, transferTaxApplies, exemption, lines, missing, total,
    costShare: price > 0 ? total / price : 0,
    loan, downPayment, cashNeeded: centsOr0(downPayment + total),
  }
}
