// ═══════════════════════════════════════════════════════════════════════════
// Κόστος ΑΓΟΡΑΣ & ΠΩΛΗΣΗΣ ακινήτου στην Ελλάδα, δομημένη εκτίμηση (όχι επίσημη).
// Καθαρές συναρτήσεις. Τα ποσοστά είναι ΕΝΔΕΙΚΤΙΚΑ (ισχύον πλαίσιο) και τα ακριβή
// ποσά ορίζονται από συμβολαιογράφο/δικηγόρο/ΑΑΔΕ, το UI το δηλώνει ρητά.
//
// ΑΓΟΡΑ: φόρος μεταβίβασης 3,09% (3% + 3% υπέρ δήμου) επί της ΜΕΓΑΛΥΤΕΡΗΣ αξίας
//   (τίμημα ή αντικειμενική)· για ΝΕΟΔΜΗΤΑ από κατασκευαστή με άδεια από 1/1/2006
//   οφείλεται ΦΠΑ 24% αντί ΦΜΑ, σε ΑΝΑΣΤΟΛΗ (οπότε 3,09% ΦΜΑ). Πρώτη κατοικία:
//   απαλλαγή ΦΜΑ έως όριο αξίας. Επιπλέον: συμβολαιογραφικά, δικηγόρος (προαιρετικός),
//   μεσιτική αμοιβή, τέλη Κτηματολογίου, πιστοποιητικά.
// ΠΩΛΗΣΗ: μεσιτική αμοιβή, ΠΕΑ, ταυτότητα κτιρίου (μηχανικός), φόρος υπεραξίας 15%
//   (σε ΑΝΑΣΤΟΛΗ) και καθαρό τίμημα μετά τα κόστη.
// ═══════════════════════════════════════════════════════════════════════════

import { fe, fn, grDate } from '../core/format';
import { centsOr0 } from '@/lib/core/money'
import { regulated } from '@/lib/legal/validity'


const pos = (n: number): number => Math.max(0, centsOr0(n))
const VAT = 0.24 // ΦΠΑ υπηρεσιών (συμβολαιογράφος/μεσίτης/δικηγόρος)

// ── Συντελεστές (ενδεικτικοί, ισχύον πλαίσιο) ──────────────────────────────
export const TRANSFER_TAX_RATE = 0.0309       // ΦΜΑ 3% + 3% υπέρ δήμου
// ═══ Η ΑΝΑΣΤΟΛΗ ΤΟΥ ΦΠΑ ΣΤΑ ΝΕΟΔΜΗΤΑ, ΓΡΑΜΜΕΝΗ ΜΙΑ ΦΟΡΑ ══════════════════════
// Ο συντελεστής υπάρχει για να ΛΕΓΕΤΑΙ, όχι για να χρεώνεται: η αναστολή έχει
// παραταθεί κάθε χρόνο από το 2019 και ισχύει έως 31/12/2026, οπότε η αγορά
// νεόδμητου φορολογείται με ΦΜΑ όπως κάθε άλλη. Η ημερομηνία γράφεται εδώ και
// μόνο εδώ, ώστε καμία οθόνη να μη λέει δική της.
//
// ΔΕΝ ΓΥΡΙΖΕΙ ΜΟΝΟ ΤΟΥ ΣΤΟ 24% ΟΤΑΝ ΠΕΡΑΣΕΙ Η ΗΜΕΡΟΜΗΝΙΑ. Μια αυτόματη επαναφορά
// θα ξαναζωντάνευε το σφάλμα των 72.000€ σε ακίνητο 300.000€ την 1η Ιανουαρίου,
// για μια παράταση που δίνεται κάθε χρόνο. Η αναστολή είναι η παραδοχή· η οθόνη
// γράφει την ημερομηνία και ο χρήστης βλέπει τι υποθέτουμε.
export const NEW_BUILD_VAT_RATE = 0.24        // ΦΠΑ νεόδμητων (σε αναστολή)
// Η ΗΜΕΡΟΜΗΝΙΑ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ. Ηταν γραμμένη με το χέρι («31/12/2026») δίπλα
// σε ένα μητρώο ισχύος που φυλάει ακριβώς αυτού του είδους τις ημερομηνίες και
// κοκκινίζει όταν περάσουν — αλλά δεν ήξερε γι' αυτήν. Δύο αντίγραφα, το ένα
// φυλασσόμενο και το άλλο όχι: την επομένη της παράτασης θα άλλαζε το ένα.
export const NEW_BUILD_VAT_SUSPENDED_UNTIL = grDate(regulated('new-build-vat-suspension').validTo)
export const CADASTRE_RATE = 0.005            // αναλογικό τέλος Κτηματολογίου 5‰ (ΚΥΑ ΦΕΚ Β'64/13-1-2026)· +1‰ σε περιοχές με ενεργό κτηματολογικό βιβλίο
export const CADASTRE_FIXED = 20              // πάγιο τέλος εγγραφής (ενδεικτικό)
export const AGENT_RATE_DEFAULT = 0.02        // μεσιτική αμοιβή (ανά πλευρά)
export const CAPITAL_GAINS_RATE = 0.15        // φόρος υπεραξίας (σε αναστολή)
// Απαλλαγή πρώτης κατοικίας (όρια αντικειμενικής αξίας, αγορά κατοικίας, ν.1078/1980).
export const FIRST_HOME_EXEMPTION_SINGLE = 200000
export const FIRST_HOME_EXEMPTION_MARRIED = 250000
export const FIRST_HOME_EXEMPTION_CHILD_FIRST_TWO = 25000  // +25.000€ για καθένα από τα 2 πρώτα τέκνα
export const FIRST_HOME_EXEMPTION_CHILD_THIRD_PLUS = 30000 // +30.000€ για το 3ο και κάθε επόμενο
// ═══ Η ΑΜΟΙΒΗ ΤΟΥ ΣΥΜΒΟΛΑΙΟΓΡΑΦΟΥ: ΜΙΑ ΚΛΙΜΑΚΑ ΓΙΑ ΔΑΝΕΙΟ ΚΑΙ ΛΟΓΙΣΤΙΚΗ ═════════
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (έλεγχος 19/10/2026, #7). Για 200.000€ η καρτέλα Δάνειο έγραφε
// 1.520€ (κλίμακα, χωρίς ΦΠΑ) και η Λογιστική 1.984€ (σκέτο 0,8% συν ΦΠΑ). Δύο
// μοντέλα για το ίδιο έξοδο. Η κλίμακα του Δανείου ζει πλέον εδώ και την
// καλούν και οι δύο, με ΦΠΑ 24% όπως κάθε υπηρεσία της αγοράς σε αυτό το αρχείο.
//
// ΠΗΓΗ: ΔΕΝ ΕΠΑΛΗΘΕΥΤΗΚΕ (19/10/2026). Η κλίμακα αντιστοιχεί στην ΥΑ 111376/2011
// (ΦΕΚ Β΄ 13/11.01.2012) για τις αμοιβές των συμβολαιογράφων, με το πρώτο
// κλιμάκιο 0,80% όπως το έφερε η τροποποίηση (ΥΑ 72386/2015, ΦΕΚ Β΄ 2170/2015).
// Το επίσημο κείμενο (et.gr) δεν άνοιξε από το περιβάλλον ανάπτυξης: τα κλιμάκια
// 0,80% και 0,70% βρέθηκαν μόνο σε αποσπάσματα αναζήτησης, τα 0,65% και 0,60%
// και η κατώτατη αμοιβή όχι. TODO(δεν βρέθηκε): έλεγχος στο ΦΕΚ. Ως τότε η
// οθόνη τη λέει «εκτίμηση».
export const NOTARY_FEE_BANDS: readonly { upTo: number; rate: number }[] = [
  { upTo: 120000, rate: 0.008 }, { upTo: 380000, rate: 0.007 },
  { upTo: 2000000, rate: 0.0065 }, { upTo: Infinity, rate: 0.006 },
]
export const NOTARY_FEE_MIN = 200

/** Η αναλογική αμοιβή του συμβολαιογράφου επί της αξίας, ΧΩΡΙΣ ΦΠΑ. Εκτίμηση. */
export function notaryFee(value: number): number {
  let fee = 0, prev = 0
  const v = pos(value)
  for (const b of NOTARY_FEE_BANDS) {
    const chunk = Math.min(v, b.upTo) - prev
    if (chunk <= 0) break
    fee += chunk * b.rate
    prev = b.upTo
  }
  return v > 0 ? centsOr0(Math.max(fee, NOTARY_FEE_MIN)) : 0
}

const pct = (r: number): string => `${fn(r * 100, Number.isInteger(r * 1000) ? 1 : 2)}%`
/** Η σημείωση της γραμμής, από τις ίδιες σταθερές: κανένα ποσοστό γραμμένο με το χέρι. */
export const NOTARY_NOTE = `Εκτίμηση: κλιμακωτή αμοιβή ${pct(NOTARY_FEE_BANDS[0].rate)} έως ${pct(NOTARY_FEE_BANDS[NOTARY_FEE_BANDS.length - 1].rate)} συν ΦΠΑ ${fn(VAT * 100)}%. Το τελικό ποσό το δίνει ο συμβολαιογράφος.`

/** Ο ΦΠΑ των υπηρεσιών της αγοράς (συμβολαιογράφος, μεσίτης, δικηγόρος). */
export const SERVICES_VAT_RATE = VAT

// Πάγια κόστη πιστοποιητικών/τεχνικών (ενδεικτικά).
export const PEA_COST = 150                    // Πιστοποιητικό Ενεργειακής Απόδοσης
export const BUILDING_ID_COST = 400            // ταυτότητα κτιρίου / βεβαιώσεις μηχανικού
export const CERTS_COST = 400                  // λοιπά πιστοποιητικά/παράβολα

export interface TransferInput {
  side: 'buy' | 'sell'
  /** Τίμημα συναλλαγής. */
  price: number
  /** Αντικειμενική αξία (βάση φόρου), default = τίμημα. Ο φόρος στη μεγαλύτερη. */
  objectiveValue?: number
  /** Νεόδμητο από κατασκευαστή (ΦΠΑ αντί ΦΜΑ). */
  newBuild?: boolean
  /** Ισχύει η αναστολή ΦΠΑ νεόδμητων; default true (τότε επιβάλλεται ΦΜΑ). */
  vatSuspended?: boolean
  /** Πρώτη κατοικία (απαλλαγή ΦΜΑ έως όριο). */
  firstHome?: boolean
  /** Έγγαμος (μεγαλύτερο όριο απαλλαγής). */
  married?: boolean
  /** Προστατευόμενα τέκνα (προσαύξηση ορίου απαλλαγής). */
  children?: number
  /** Χρήση μεσίτη (αμοιβή + ΦΠΑ). */
  useAgent?: boolean
  agentRatePct?: number
  /** Χρήση δικηγόρου (προαιρετικός πλέον). */
  useLawyer?: boolean
  lawyerRatePct?: number
  // ── Μόνο για ΠΩΛΗΣΗ (υπεραξία) ──
  /** Κόστος κτήσης (για υπεραξία). */
  acquisitionCost?: number
  /** Ενεργός φόρος υπεραξίας; default false (σε αναστολή). */
  capitalGainsActive?: boolean
}

export interface CostLine {
  key: string
  label: string
  amount: number
  note?: string
}

export interface TransferResult {
  side: 'buy' | 'sell'
  price: number
  lines: CostLine[]
  /** Σύνολο εξόδων/φόρων (εκτός τιμήματος). */
  totalCosts: number
  /** Ποσοστό εξόδων επί τιμήματος. */
  costPct: number
  /** Αγορά: συνολική εκταμίευση (τίμημα + κόστη)· Πώληση: καθαρό έσοδο (τίμημα − κόστη). */
  cashOut?: number
  netProceeds?: number
}

/** Απαλλαγή πρώτης κατοικίας για την οικογενειακή κατάσταση: το ποσό της αξίας που δεν φορολογείται. */
export function firstHomeExemption(input: Pick<TransferInput, 'married' | 'children'>): number {
  const base = input.married ? FIRST_HOME_EXEMPTION_MARRIED : FIRST_HOME_EXEMPTION_SINGLE
  const kids = Math.max(0, Math.floor(input.children ?? 0))
  // +25.000€ για καθένα από τα δύο πρώτα τέκνα, +30.000€ για το τρίτο και κάθε επόμενο.
  const firstTwo = Math.min(kids, 2) * FIRST_HOME_EXEMPTION_CHILD_FIRST_TWO
  const rest = Math.max(0, kids - 2) * FIRST_HOME_EXEMPTION_CHILD_THIRD_PLUS
  return base + firstTwo + rest
}

/**
 * Φόρος μεταβίβασης ΜΟΝΟ επί του υπερβάλλοντος της απαλλαγής. Η απαλλαγή
 * πρώτης κατοικίας αφαιρεί ποσό από τη βάση, δεν είναι κατώφλι «όλα ή τίποτα»:
 * ο άγαμος που αγοράζει 220.000€ φορολογείται για τις 20.000€ πάνω από το όριο.
 * Η καρτέλα Δάνειο το είχε γραμμένο αλλιώς, με δικό της αντίγραφο του πίνακα,
 * και χρέωνε όλη την τιμή μόλις περνούσε το όριο (6.798€ αντί για 618€).
 */
export function transferTaxOn(value: number, exemption = 0): number {
  return centsOr0(Math.max(0, pos(value) - pos(exemption)) * TRANSFER_TAX_RATE)
}

/** Δομημένη εκτίμηση κόστους αγοράς ή πώλησης. */
export function transferCosts(input: TransferInput): TransferResult {
  const price = pos(input.price)
  const taxBase = Math.max(price, pos(input.objectiveValue ?? price))
  const lines: CostLine[] = []

  if (input.side === 'buy') {
    // Φόρος μεταβίβασης ή ΦΠΑ νεόδμητου.
    const vatApplies = !!input.newBuild && input.vatSuspended === false
    if (vatApplies) {
      lines.push({ key: 'vat', label: 'ΦΠΑ νεόδμητου (24%)', amount: centsOr0(taxBase * NEW_BUILD_VAT_RATE), note: 'Αντί φόρου μεταβίβασης, για νεόδμητα από κατασκευαστή.' })
    } else {
      const exemption = input.firstHome ? firstHomeExemption(input) : 0
      lines.push({ key: 'transferTax', label: 'Φόρος μεταβίβασης (3,09%)', amount: transferTaxOn(taxBase, exemption),
        note: input.firstHome ? `Μετά απαλλαγή πρώτης κατοικίας έως ${fe(Math.round(exemption))}.` : 'Επί της μεγαλύτερης μεταξύ τιμήματος και αντικειμενικής.' })
    }
    // Συμβολαιογραφικά (κλιμακωτά ~0,8% + ΦΠΑ), δικηγόρος, μεσίτης, Κτηματολόγιο, πιστοποιητικά.
    lines.push({ key: 'notary', label: 'Συμβολαιογραφικά', amount: centsOr0(notaryFee(taxBase) * (1 + VAT)), note: NOTARY_NOTE })
    if (input.useLawyer) lines.push({ key: 'lawyer', label: 'Δικηγόρος', amount: centsOr0(taxBase * ((input.lawyerRatePct ?? 0.5) / 100) * (1 + VAT)), note: 'Προαιρετικός, έλεγχος τίτλων/βαρών.' })
    if (input.useAgent) lines.push({ key: 'agent', label: 'Μεσιτική αμοιβή', amount: centsOr0(price * ((input.agentRatePct ?? AGENT_RATE_DEFAULT * 100) / 100) * (1 + VAT)), note: 'Ενδεικτικά 2% + ΦΠΑ.' })
    lines.push({ key: 'cadastre', label: 'Τέλη Κτηματολογίου', amount: centsOr0(taxBase * CADASTRE_RATE + CADASTRE_FIXED), note: 'Αναλογικό 5‰ + πάγιο (ΦΕΚ Β\'64/2026). Σε περιοχές με ενεργό κτηματολόγιο ~6‰.' })
    lines.push({ key: 'certs', label: 'Πιστοποιητικά και παράβολα', amount: CERTS_COST, note: 'Ενδεικτικό πάγιο.' })

    const totalCosts = centsOr0(lines.reduce((s, l) => s + l.amount, 0))
    return { side: 'buy', price, lines, totalCosts, costPct: price > 0 ? totalCosts / price : 0, cashOut: centsOr0(price + totalCosts) }
  }

  // ── Πώληση ──
  // Οι σημειώσεις φαίνονται κάτω από κάθε κόστος (Αξιοποίηση, πώληση): λένε τη
  // βάση του ποσού, με το ποσοστό που πράγματι μπήκε στον υπολογισμό.
  const agentPct = input.agentRatePct ?? AGENT_RATE_DEFAULT * 100
  if (input.useAgent) lines.push({ key: 'agent', label: 'Μεσιτική αμοιβή', amount: centsOr0(price * (agentPct / 100) * (1 + VAT)),
    note: `Ενδεικτικά ${fn(agentPct, Number.isInteger(agentPct) ? 0 : 1)}% της τιμής, συν ΦΠΑ ${fn(VAT * 100)}%.` })
  lines.push({ key: 'pea', label: 'Πιστοποιητικό ενεργειακής απόδοσης (ΠΕΑ)', amount: PEA_COST, note: 'Υποχρεωτικό στην πώληση. Ενδεικτική τιμή.' })
  lines.push({ key: 'buildingId', label: 'Ταυτότητα κτιρίου / βεβαιώσεις μηχανικού', amount: BUILDING_ID_COST, note: 'Ενδεικτική αμοιβή μηχανικού.' })
  if (input.useLawyer) lines.push({ key: 'lawyer', label: 'Δικηγόρος', amount: centsOr0(price * ((input.lawyerRatePct ?? 0.5) / 100) * (1 + VAT)), note: 'Προαιρετικός.' })
  // Φόρος υπεραξίας 15%, σε αναστολή (default 0, με σημείωση).
  const gain = Math.max(0, price - pos(input.acquisitionCost ?? 0))
  const cgtActive = !!input.capitalGainsActive
  lines.push({ key: 'capitalGains', label: 'Φόρος υπεραξίας (15%)', amount: cgtActive ? centsOr0(gain * CAPITAL_GAINS_RATE) : 0,
    note: cgtActive ? `Επί υπεραξίας ${fe(Math.round(gain))}.` : 'Σε αναστολή, δεν επιβαρύνει επί του παρόντος.' })

  const totalCosts = centsOr0(lines.reduce((s, l) => s + l.amount, 0))
  return { side: 'sell', price, lines, totalCosts, costPct: price > 0 ? totalCosts / price : 0, netProceeds: centsOr0(price - totalCosts) }
}
