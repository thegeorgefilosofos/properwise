// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΕΝΟΙΚΙΟ ΤΟΥ ΔΗΜΟΣΙΟΥ ΥΠΟΛΟΓΙΣΤΗ ΠΕΡΝΑ ΣΤΟ ΠΡΩΤΟ ΑΚΙΝΗΤΟ
// ─────────────────────────────────────────────────────────────────────────
// Ο αδελφός του lib/tools/enfiaCarry.ts για τον υπολογιστή φόρου ενοικίων. Ο
// επισκέπτης πατά «Αποθήκευσε το ακίνητο», η σελίδα γράφει πρόχειρο στη
// συσκευή (lib/tools/calcDraft.ts) και ο πίνακας ανοίγει τον οδηγό με το
// ακίνητο ήδη «Νοικιασμένο (μακροχρόνια)» και το μηνιαίο μίσθωμα γραμμένο.
//
// ΓΙΑΤΙ ΑΥΤΕΣ ΟΙ ΔΥΟ ΤΙΜΕΣ ΚΑΙ ΟΧΙ ΑΛΛΕΣ. Ο οδηγός έχει πεδίο για το μηνιαίο
// μίσθωμα (`target_rent`) και η κατάσταση `rent_long` είναι αυτή που γράφει
// στο ημερολόγιο τη δήλωση Ε1/Ε2 και τις δόσεις του φόρου εισοδήματος
// (lib/facts/deadlines.ts, `taxProfileOfStatus`). Οι μήνες, η τράπεζα και το
// έτος αφορούν τον ΦΟΡΟ μιας χρονιάς, όχι το ακίνητο: δεν έχουν πεδίο στον
// οδηγό και δεν γράφονται πουθενά.
//
// ΚΑΙ ΟΙ ΙΔΙΕΣ ΚΛΕΙΔΑΡΙΕΣ: μόνο τα κλειδιά του SPEC, κάθε τιμή ελεγμένη και μία
// άκυρη ακυρώνει όλο το φορτίο.
// ═══════════════════════════════════════════════════════════════════════════
import { SPEC } from './rentSpec'
import { readTool, type ToolValues } from './permalink'
import { parseAmount } from '@/lib/core/greek'
import { HOME } from '@/lib/auth/redirect'

/** Η τιμή του `action` που ζητά τη συνέχεια από τον υπολογιστή ενοικίων. */
export const RENT_ACTION = 'rent'

/** Η διαδρομή του πίνακα που ανοίγει τον οδηγό με το πρόχειρο του υπολογιστή. */
export const RENT_APP_PATH = `${HOME}?action=${RENT_ACTION}`

export type RentValues = ToolValues<typeof SPEC>

/** Ο μήνας δεν έχει παραπάνω· ό,τι γράφει ο υπολογιστής στο πεδίο των μηνών. */
const MAX_MONTHS = 12

/**
 * Άλλαξε ο επισκέπτης το ενοίκιο ή τους μήνες; Το έτος ΔΕΝ μετρά: η σελίδα το
 * γράφει μόνη της στη διεύθυνση (`openingYear`), οπότε θα έκανε κάθε άνοιγμα
 * «αλλαγμένο» και το παράδειγμα των 600€ θα γινόταν ακίνητο κανενός.
 */
export function rentChanged(values: Readonly<Partial<Record<string, string>>>): boolean {
  return (values.enoikio ?? SPEC.enoikio).trim() !== SPEC.enoikio || (values.mines ?? SPEC.mines).trim() !== SPEC.mines
}

/** Ο σύνδεσμος εγγραφής που ανοίγει τον οδηγό με το πρόχειρο. */
export function rentSignupHref(values: Readonly<Record<string, string>>): string {
  if (!rentChanged(values)) return '/signup'
  return `/signup?${new URLSearchParams({ next: RENT_APP_PATH }).toString()}`
}

/** Ό,τι φτάνει στον πίνακα: το μηνιαίο μίσθωμα, ελεγμένο. */
export interface RentCarry { monthly: number }

const amountOf = (s: string): number | null => {
  const n = parseAmount(s)
  return n !== null && Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Το φορτίο ενοικίου από τις τιμές του προχείρου, ή `null`.
 *
 * Χωρίς αλλαγμένο ενοίκιο ή μήνες είναι το παράδειγμα της σελίδας. Μηδενικό
 * ενοίκιο δεν είναι μίσθωση. Οι μήνες, η τράπεζα και το έτος ελέγχονται κι
 * αυτοί, αν και δεν γράφονται: μια άκυρη τιμή σημαίνει ότι το πρόχειρο δεν
 * είναι αυτό που έγραψε η σελίδα.
 */
export function readRentCarry(values: Readonly<Record<string, string>>): RentCarry | null {
  if (!rentChanged(values)) return null
  const q = new URLSearchParams()
  for (const k of Object.keys(SPEC)) if (Object.prototype.hasOwnProperty.call(values, k)) q.set(k, values[k])
  const v = readTool(SPEC, q)
  const monthly = amountOf(v.enoikio)
  const months = amountOf(v.mines)
  if (monthly === null || !(monthly > 0)) return null
  if (months === null || months > MAX_MONTHS) return null
  if (v.trapeza !== '0' && v.trapeza !== '1') return null
  if (v.etos !== '' && !/^\d{4}$/.test(v.etos)) return null
  return { monthly }
}

/** Αριθμός ως κείμενο για πεδίο φόρμας, χωρίς ουρές κινητής υποδιαστολής. */
const field = (n: number): string => String(Math.round(n * 100) / 100)

/** Ό,τι προσυμπληρώνει ο οδηγός προσθήκης ακινήτου. */
export interface RentWizardInitial { statusKey: 'rent_long'; rent: string }

export function rentCarryWizard(c: RentCarry): RentWizardInitial {
  return { statusKey: 'rent_long', rent: field(c.monthly) }
}
