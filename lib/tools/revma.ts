// ═══════════════════════════════════════════════════════════════════════════
// ΣΥΓΚΡΙΣΗ ΤΙΜΟΛΟΓΙΩΝ ΡΕΥΜΑΤΟΣ ΓΙΑ ΤΟΝ ΕΠΙΣΚΕΠΤΗ: Ο ΠΥΡΗΝΑΣ ΤΗΣ ΔΗΜΟΣΙΑΣ ΣΕΛΙΔΑΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙΠΟΤΑ ΔΕΝ ΞΑΝΑΓΡΑΦΕΤΑΙ ΕΔΩ. Ο κατάλογος (lib/energy/catalogue.ts), ο τύπος
// του κόστους (lib/energy/tariff.ts) και ο κανόνας παλαιότητας
// (lib/energy/freshness.ts) είναι οι ίδιοι που τρέχει η καρτέλα «Ρεύμα» του
// πίνακα ελέγχου. Μια δεύτερη τιμή ή ένας δεύτερος τύπος θα ήταν δεύτερη
// απάντηση στο ίδιο ερώτημα και μόνο η μία θα ήταν σωστή.
//
// ΤΙ ΠΡΟΣΘΕΤΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΚΑΙ ΓΙΑΤΙ. Ο πίνακας ελέγχου ξέρει τον χρήστη:
// το τρέχον τιμολόγιό του, το ιστορικό του, αν έχει φωτοβολταϊκό. Ο επισκέπτης
// της δημόσιας σελίδας είναι άγνωστος, οπότε τρία πράγματα κρίνονται εδώ:
//
//   1. ΠΟΙΑ ΤΙΜΟΛΟΓΙΑ ΜΠΑΙΝΟΥΝ ΣΕ ΣΕΙΡΑ. Οσα έχουν ποσό που δεν κλείνει
//      (αναδρομική τιμή, πακέτο χωρίς δημοσιευμένο όριο, πακέτο που ξεπερνιέται
//      χωρίς καταγεγραμμένη υπέρβαση) ή προϋπόθεση που δεν ξέρουμε αν πληροί
//      (φωτοβολταϊκό) φαίνονται με τον λόγο τους, χωρίς θέση.
//   2. ΑΝ ΥΠΑΡΧΕΙ ΣΕΙΡΑ ΚΑΘΟΛΟΥ. Οταν ο κατάλογος έχει παλιώσει, η σελίδα ΔΕΝ
//      κατατάσσει: δείχνει τις τιμές ως ενδεικτικές, σε αλφαβητική σειρά, χωρίς
//      φθηνότερο. Ενας πίνακας ταξινομημένος κατά κόστος ονομάζει νικητή με την
//      πρώτη του γραμμή, όσα προειδοποιητικά κι αν γραφτούν από πάνω.
//   3. ΩΣ ΠΟΤΕ ΙΣΧΥΕΙ Η ΣΕΙΡΑ. Η ημέρα λέγεται στην οθόνη, ώστε ο επισκέπτης να
//      ξέρει ότι η κατάταξη έχει ημερομηνία λήξης.
// ═══════════════════════════════════════════════════════════════════════════
import { compareTariffs, estimateUsage, exceedsFlatAllowance, type Usage } from '@/lib/energy/tariff'
import {
  COMPARABLE_TARIFFS, FLAT_WITHOUT_ALLOWANCE, TARIFFS_VERIFIED, TARIFFS_MAX_AGE_DAYS, CATALOGUE_MONTH_GEN,
  type LocalTariff,
} from '@/lib/energy/catalogue'
import { freshness, canRecommend, type Freshness } from '@/lib/energy/freshness'
import { cents } from '@/lib/core/money'

/** Ενα τιμολόγιο του καταλόγου μαζί με τον πάροχό του. */
export type PowerTariff = LocalTariff & { providerLabel: string; providerUrl: string }

/** Τα χρώματα της ΡΑΑΕΥ όπως τα μοντελοποιεί ο κατάλογος, με κλειδί για τη διεύθυνση. */
export const POWER_COLOURS = [
  { value: 'ola', label: 'Όλα τα τιμολόγια', badge: null },
  { value: 'mple', label: 'Σταθερά (μπλε)', badge: 'ΜΠΛΕ' },
  { value: 'prasino', label: 'Ειδικά (πράσινα)', badge: 'ΠΡΑΣΙΝΟ' },
  { value: 'kitrino', label: 'Κυμαινόμενα (κίτρινα)', badge: 'ΚΙΤΡΙΝΟ' },
  { value: 'paketo', label: 'Σταθερό ποσό τον μήνα', badge: 'FLAT' },
] as const

export type PowerColour = typeof POWER_COLOURS[number]['value']

/** Γιατί ένα τιμολόγιο φαίνεται χωρίς θέση στη σειρά. */
export type Unranked = 'retro' | 'unknown' | 'other-month' | 'conditional' | 'no-allowance' | 'over-allowance'

/** Ο λόγος, όπως τον διαβάζει ο επισκέπτης, δίπλα στο τιμολόγιο. */
export const UNRANKED_WHY: Record<Unranked, string> = {
  'retro': 'Η τελική τιμή ανακοινώνεται μετά τον μήνα, οπότε δεν υπολογίζεται εκ των προτέρων',
  'unknown': `Η ΡΑΑΕΥ δεν έχει ακόμη τιμή ${CATALOGUE_MONTH_GEN} ή τη γράφει σε κλίμακες που δεν υπολογίζονται εδώ`,
  // Ο νικητής βγαίνει μόνο από τιμές του ίδιου μήνα: μια τιμή Αυγούστου δίπλα
  // σε τιμές Οκτωβρίου δεν είναι σύγκριση.
  'other-month': `Η τιμή δεν είναι ${CATALOGUE_MONTH_GEN}, οπότε φαίνεται χωρίς θέση στη σειρά`,
  'conditional': 'Προϋποθέτει συμμετοχή σε φωτοβολταϊκό, οπότε δεν μπαίνει στη σειρά',
  'no-allowance': 'Το όριο κιλοβατωρών του πακέτου δεν δημοσιεύεται σε αριθμό',
  'over-allowance': 'Η κατανάλωσή σου ξεπερνά το όριο του πακέτου και η χρέωση υπέρβασης δεν είναι καταγεγραμμένη',
}

export interface PowerInput {
  /** Η κατανάλωση όπως τη γράφει ο επισκέπτης. */
  kwh: number
  /** Για ποια περίοδο είναι ο αριθμός. */
  period: 'month' | 'year'
  /** Ποσοστό στη νυχτερινή ζώνη (0-100). Μετρά μόνο σε τιμολόγια με νυχτερινή τιμή. */
  nightPct: number
  /** Ηλεκτρονικός λογαριασμός και πάγια εντολή, όπου μειώνουν το πάγιο. */
  ebill: boolean
  colour: PowerColour
}

export interface PowerRow {
  t: PowerTariff
  /** Μηνιαίο κόστος με ΦΠΑ. `null` όταν το ποσό δεν κλείνει. */
  monthly: number | null
  /** Ετήσιο, δώδεκα φορές το μηνιαίο. */
  annual: number | null
  /** Θέση στη σειρά. `null` όταν η σελίδα δεν κατατάσσει ή το τιμολόγιο μένει εκτός. */
  rank: number | null
  unranked: Unranked | null
}

export interface PowerResult {
  /** Η μέση μηνιαία κατανάλωση πάνω στην οποία έγινε ο υπολογισμός. */
  kwhMonthly: number
  fresh: Freshness
  /** Κατατάσσει η σελίδα; Φρέσκος κατάλογος ΚΑΙ κατανάλωση που δόθηκε. */
  recommend: boolean
  /** Η τελευταία ημέρα (ISO) που ο σημερινός κατάλογος κατατάσσεται. */
  rankUntil: string
  rows: PowerRow[]
  /** Το φθηνότερο για αυτή την κατανάλωση. ΠΑΝΤΑ `null` όταν δεν κατατάσσει. */
  cheapest: PowerRow | null
}

/**
 * Η τελευταία ημέρα που ο κατάλογος θεωρείται φρέσκος: επαλήθευση συν κατώφλι.
 *
 * Μετρημένη σε ημερολογιακές μέρες UTC, όπως το `freshness`: πάνω από αλλαγή
 * ώρας μια μέρα 23 ωρών δεν επιτρέπεται να μετακινήσει το όριο.
 */
export function rankUntil(verifiedAt = TARIFFS_VERIFIED, maxAgeDays = TARIFFS_MAX_AGE_DAYS): string {
  const [y, m, d] = verifiedAt.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + maxAgeDays)).toISOString().slice(0, 10)
}

/** Γιατί το τιμολόγιο δεν μπαίνει σε σειρά, ή `null` όταν μπαίνει. */
function whyUnranked(t: PowerTariff, kwhMonthly: number, priced: boolean): Unranked | null {
  if (!priced) return t.priceStatus === 'retro' ? 'retro' : 'unknown'
  if (t.type === 'vnm') return 'conditional'
  if (t.type === 'fixed_monthly') {
    if (FLAT_WITHOUT_ALLOWANCE.has(t.id)) return 'no-allowance'
    if (!t.flat_overage_rate && exceedsFlatAllowance(t, kwhMonthly)) return 'over-allowance'
  }
  // Τελευταίο: το τιμολόγιο μετριέται, αλλά η τιμή του είναι άλλου μήνα.
  if (t.current === false) return 'other-month'
  return null
}

/** Μόνο τα οικιακά: η σελίδα μιλά σε νοικοκυριά και ιδιοκτήτες κατοικιών. */
const residential = (): PowerTariff[] => COMPARABLE_TARIFFS().filter(t => t.segment === 'residential')

/**
 * Το κόστος κάθε τιμολογίου για την κατανάλωση του επισκέπτη.
 *
 * Τα δυναμικά δεν εμφανίζονται: το `compareTariffs` τα αφήνει έξω, γιατί η τιμή
 * τους είναι ωριαία και δεν προκύπτει από τύπο. Τα φοιτητικά και όσα κλείνουν
 * με εκκαθάριση τα αφήνει έξω ήδη ο κατάλογος (`COMPARABLE_TARIFFS`).
 */
export function comparePower(input: PowerInput, today: Date): PowerResult {
  const raw = Number.isFinite(input.kwh) ? Math.max(0, input.kwh) : 0
  const kwhMonthly = input.period === 'year' ? raw / 12 : raw
  const nightPct = Math.min(100, Math.max(0, Number.isFinite(input.nightPct) ? input.nightPct : 0))
  const usage: Usage = { kwhMonthly, nightPct, ebill: input.ebill }

  // Η ΙΔΙΑ ΠΥΛΗ ΜΕ ΤΟΝ ΠΙΝΑΚΑ ΕΛΕΓΧΟΥ. Η κατανάλωση που γράφει ο επισκέπτης
  // είναι «χειροκίνητη» για το `estimateUsage`: αξιόπιστη όταν είναι θετική.
  const fresh = freshness(TARIFFS_VERIFIED, today, TARIFFS_MAX_AGE_DAYS)
  const recommend = canRecommend(fresh, estimateUsage(undefined, undefined, kwhMonthly).reliable)

  const badge = POWER_COLOURS.find(c => c.value === input.colour)?.badge ?? null
  const pool = residential().filter(t => badge === null ? true : t.badge === badge)

  const all = compareTariffs(pool, usage, null, 0).map(r => {
    const unranked = whyUnranked(r.tariff, kwhMonthly, r.priced)
    const known = unranked !== 'retro' && unranked !== 'unknown' && unranked !== 'no-allowance' && unranked !== 'over-allowance'
    return {
      t: r.tariff,
      monthly: known ? r.cost.total : null,
      annual: known ? cents(r.cost.total * 12) : null,
      rank: null as number | null,
      unranked,
    }
  })

  const byName = (a: PowerRow, b: PowerRow) =>
    a.t.providerLabel.localeCompare(b.t.providerLabel, 'el') || a.t.name.localeCompare(b.t.name, 'el')

  if (!recommend) {
    // ΠΑΛΙΟΣ ΚΑΤΑΛΟΓΟΣ Ή ΚΑΜΙΑ ΚΑΤΑΝΑΛΩΣΗ: ΚΑΜΙΑ ΣΕΙΡΑ. Αλφαβητικά, χωρίς θέση
    // και χωρίς φθηνότερο. Τα ποσά μένουν, ως ενδεικτικά.
    return { kwhMonthly, fresh, recommend, rankUntil: rankUntil(), rows: [...all].sort(byName), cheapest: null }
  }

  const inLine = all.filter(r => r.unranked === null)
  inLine.forEach((r, i) => { r.rank = i + 1 })
  const aside = all.filter(r => r.unranked !== null).sort(byName)
  return {
    kwhMonthly, fresh, recommend, rankUntil: rankUntil(),
    rows: [...inLine, ...aside],
    cheapest: inLine[0] ?? null,
  }
}
