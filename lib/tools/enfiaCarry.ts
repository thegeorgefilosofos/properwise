// ═══════════════════════════════════════════════════════════════════════════
// Ο ΕΝΦΙΑ ΤΟΥ ΔΗΜΟΣΙΟΥ ΥΠΟΛΟΓΙΣΤΗ ΠΕΡΝΑ ΣΤΟ ΠΡΩΤΟ ΑΚΙΝΗΤΟ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΕΣΠΑΓΕ. Ο επισκέπτης έβγαζε τον ΕΝΦΙΑ του στο /ypologismos-enfia, πατούσε
// «Ξεκίνα δωρεάν» και κατέληγε σε άδειο λογαριασμό: ο σύνδεσμος ήταν σκέτο
// «/signup», οπότε τετραγωνικά, ζώνη, όροφος, παλαιότητα και ποσοστό χάνονταν
// και ο οδηγός ρωτούσε από την αρχή όσα μόλις είχε γράψει. Η φόρμα ΕΝΦΙΑ του
// πίνακα έχει τα ίδια ακριβώς πεδία (lib/facts/enfia.ts, ENFIA_DEFAULTS).
//
// Η ΔΙΑΔΡΟΜΗ. Ο σύνδεσμος γίνεται «/signup?next=/dashboard?action=enfia&…» με
// τα πεδία της διεύθυνσης του υπολογιστή (toolQuery: μόνο όσα άλλαξαν). Η
// συνέχεια περνά ήδη από email και Google (lib/auth/continuation.ts) και ο
// πίνακας διαβάζει το `action` στην εκκίνηση (lib/nav/history.ts).
//
// ΤΡΕΙΣ ΚΛΕΙΔΑΡΙΕΣ, ΓΙΑΤΙ ΤΗ ΔΙΕΥΘΥΝΣΗ ΤΗ ΓΡΑΦΕΙ Ο ΚΑΘΕΝΑΣ:
//   1. Ο προορισμός είναι πάντα η σταθερή διαδρομή «/dashboard». Τιμές μπαίνουν
//      μόνο μέσα από το URLSearchParams, άρα ένα «&next=//kako.gr» μέσα σε
//      πεδίο μένει τιμή του πεδίου και δεν γίνεται κλειδί. Και η συνέχεια
//      κρίνει το «next» με τους δικούς της ελέγχους (σχετική διαδρομή, δική μας).
//   2. Διαβάζονται ΜΟΝΟ τα κλειδιά του SPEC (lib/tools/enfiaSpec.ts). Κατάλογος
//      επιτρεπτών, όχι απαγορευμένων: ένα ξένο κλειδί δεν φτάνει ποτέ ως εδώ.
//   3. Κάθε τιμή ελέγχεται απέναντι σε ό,τι δέχεται η μηχανή: αριθμός που
//      διαβάζεται, όροφος και παλαιότητα από τους πίνακες του lib/billing/enfia.ts
//      (μόνο ανάγνωση). Μία άκυρη τιμή ακυρώνει ΟΛΟ το φορτίο: μισή εκτίμηση
//      είναι άλλη εκτίμηση από αυτήν που είδε ο επισκέπτης.
//
// ΚΑΙ Ο ΙΔΙΟΣ ΑΡΙΘΜΟΣ. Ο υπολογιστής και η συνέχεια διαβάζουν τα πεδία με την
// ΙΔΙΑ συνάρτηση (`enfiaInputs`) και η εγγραφή στις ρυθμίσεις γίνεται μόνο αν
// ξαναβγάζει ακριβώς το ποσό του υπολογιστή (`enfiaCarrySettings`). Αλλιώς δεν
// γράφεται τίποτα: καλύτερα κενή φόρμα παρά άλλο ποσό με την υπογραφή μας.
// ═══════════════════════════════════════════════════════════════════════════
import { SPEC } from './enfiaSpec'
import { readTool, toolQuery, type ToolValues } from './permalink'
import { parseAmount } from '@/lib/core/greek'
import {
  estimateENFIA, zoneKeyFromPricePerSqm, enfiaFloorKeyFromValue, ENFIA_FLOOR_COEF, ENFIA_AGE_BANDS,
  type ENFIAResult,
} from '@/lib/billing/enfia'
import { enfiaFromSettings } from '@/lib/facts/enfiaForm'
import type { EnfiaSettings } from '@/lib/facts/enfia'
import { HOME } from '@/lib/auth/redirect'

/** Η τιμή του `action` που ζητά τη συνέχεια από τον υπολογιστή ΕΝΦΙΑ. */
export const ENFIA_ACTION = 'enfia'

/** Τα μόνα κλειδιά που περνούν από τον υπολογιστή στον πίνακα. */
export const ENFIA_KEYS = Object.keys(SPEC) as (keyof typeof SPEC)[]

export type EnfiaValues = ToolValues<typeof SPEC>

/** Ό,τι μετρά ο υπολογιστής, αφού διαβαστούν τα πεδία. */
export interface EnfiaInputs {
  sqm: number
  /** Τιμή ζώνης €/τ.μ. και το κλιμάκιό της. */
  price: number
  zone: string
  floor: string
  age: string
  /** Ποσοστό ιδιοκτησίας, από 1 έως 100. */
  own: number
  /** Βοηθητικοί χώροι, τ.μ. */
  aux: number
  /** Αξία ολόκληρου του ακινήτου (τ.μ. × τιμή ζώνης) και το μερίδιο του ιδιοκτήτη. */
  value: number
  share: number
}

const amount = (s: string): number => Math.max(0, parseAmount(s) ?? 0)

/**
 * Τα πεδία του υπολογιστή σε στοιχεία της μηχανής· `null` όταν δεν βγαίνει
 * εκτίμηση (χωρίς τετραγωνικά ή χωρίς ζώνη).
 *
 * Η ΙΔΙΑ ανάγνωση για τη σελίδα και για τη συνέχεια. Αν ζούσαν χωριστά, μια
 * αλλαγή στη μία (π.χ. στο όριο του ποσοστού) θα έδινε στο πρώτο ακίνητο άλλο
 * ποσό από αυτό που είδε ο επισκέπτης πριν από ένα λεπτό.
 */
export function enfiaInputs(v: EnfiaValues): EnfiaInputs | null {
  const sqm = amount(v.tm)
  const price = amount(v.zoni)
  const zone = zoneKeyFromPricePerSqm(price)
  if (!sqm || !zone) return null
  // Κενό ή μηδέν σημαίνει ολόκληρο: το άδειο πεδίο γράφεται «0» στη διεύθυνση
  // (lib/tools/permalink.ts) και δεν επιτρέπεται να μηδενίσει τον φόρο.
  const own = Math.min(100, Math.max(1, amount(v.pososto) || 100))
  // Αντικειμενική αξία κατά προσέγγιση: τ.μ. × τιμή ζώνης. Η ΟΛΟΚΛΗΡΗ αξία
  // κρίνει τον πρόσθετο φόρο και το ΜΕΡΙΔΙΟ τη μείωση και την προσαύξηση (η
  // εξήγηση και η μέτρηση στο app/ypologismos-enfia/EnfiaCalculator.tsx).
  const value = sqm * price
  return { sqm, price, zone, floor: v.orofos, age: v.palaiotita, own, aux: amount(v.voith), value, share: value * (own / 100) }
}

/** Ο ΕΝΦΙΑ του υπολογιστή για αυτά τα στοιχεία. */
export function enfiaPublicEstimate(i: EnfiaInputs): ENFIAResult | null {
  return estimateENFIA({
    sqm: i.sqm, auxSqm: i.aux, zone: i.zone, floor: i.floor, age: i.age, ownership: i.own,
    totalValue: i.share, propertyValue: i.value,
  })
}

// ── Η ΔΙΕΥΘΥΝΣΗ ΠΡΟΣ ΤΑ ΕΞΩ ───────────────────────────────────────────────

/** Η διαδρομή του πίνακα που ανοίγει τον οδηγό με αυτά τα πεδία. */
export function enfiaCarryPath(values: Readonly<Record<string, string>>): string {
  const q = new URLSearchParams(toolQuery(SPEC, values))
  const out = new URLSearchParams({ action: ENFIA_ACTION })
  for (const [k, v] of q) out.set(k, v)
  return `${HOME}?${out.toString()}`
}

/** Ο σύνδεσμος του «Ξεκίνα δωρεάν» κάτω από τον υπολογιστή. */
export function enfiaSignupHref(values: Readonly<Record<string, string>>): string {
  return `/signup?${new URLSearchParams({ next: enfiaCarryPath(values) }).toString()}`
}

// ── Η ΔΙΕΥΘΥΝΣΗ ΠΡΟΣ ΤΑ ΜΕΣΑ ────────────────────────────────────────────────

/** Το φορτίο που φτάνει στον πίνακα: τα πεδία και ό,τι μετρά η μηχανή από αυτά. */
export interface EnfiaCarry {
  values: EnfiaValues
  inputs: EnfiaInputs
}

const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

/** Αριθμός που διαβάζεται, μη αρνητικός, πεπερασμένος. */
const isAmount = (s: string): boolean => {
  const n = parseAmount(s)
  return n !== null && Number.isFinite(n) && n >= 0
}

/**
 * Κάθε κλειδί με τον έλεγχό του. Ο όροφος και η παλαιότητα κρίνονται απέναντι
 * στους ΠΙΝΑΚΕΣ της μηχανής, με `hasOwnProperty`: ένα «constructor» θα έβρισκε
 * συνάρτηση σε απλό αντικείμενο.
 */
const VALID: Record<keyof typeof SPEC, (s: string) => boolean> = {
  tm: isAmount,
  zoni: isAmount,
  orofos: s => hasOwn(ENFIA_FLOOR_COEF, s),
  palaiotita: s => ENFIA_AGE_BANDS.some(b => b.key === s),
  // Ποσοστό: έως 100. Το 0 είναι το άδειο πεδίο της διεύθυνσης (= ολόκληρο).
  pososto: s => isAmount(s) && (parseAmount(s) ?? 0) <= 100,
  voith: isAmount,
}

/**
 * Το φορτίο ΕΝΦΙΑ μιας διεύθυνσης εκκίνησης, ή `null`.
 *
 * Διαβάζει ΜΟΝΟ τα κλειδιά του SPEC· όσα λείπουν παίρνουν την προεπιλογή, όπως
 * στη σελίδα. Μία τιμή που δεν περνά τον έλεγχό της ακυρώνει όλο το φορτίο.
 */
export function readEnfiaCarry(params: URLSearchParams): EnfiaCarry | null {
  const values = readTool(SPEC, params)
  for (const k of ENFIA_KEYS) {
    const v = values[k]
    // Κενό μένει μόνο όπου η προεπιλογή είναι κενή (βοηθητικοί χώροι).
    if (v === '' && SPEC[k] === '') continue
    if (!VALID[k](v)) return null
  }
  const inputs = enfiaInputs(values)
  return inputs ? { values, inputs } : null
}

// ── ΤΙ ΓΡΑΦΕΤΑΙ ΣΤΟ ΝΕΟ ΑΚΙΝΗΤΟ ─────────────────────────────────────────────

/**
 * Ο όροφος του υπολογιστή στην ετικέτα του οδηγού, μόνο όπου η αντιστοίχιση
 * είναι ένα προς ένα. Το «4ος και 5ος» και το «6ος και άνω» είναι δύο ορόφοι ο
 * καθένας στον οδηγό: δεν μαντεύουμε ποιος, το πεδίο μένει κενό.
 * Η επιστροφή ελέγχεται (enfiaCarry.test.ts): η ετικέτα ξαναδιαβάζεται από τη
 * μηχανή στο ΙΔΙΟ κλειδί.
 */
const WIZARD_FLOOR: Partial<Record<string, string>> = {
  basement: 'Υπόγειο', ground: 'Ισόγειο', first: '1ος', second: '2ος', third: '3ος',
}

/** Ό,τι προσυμπληρώνει ο οδηγός προσθήκης ακινήτου. */
export interface EnfiaWizardInitial { sqm: string; ownership: string; floor?: string; storageSqm?: string }

export function enfiaCarryWizard(i: EnfiaInputs): EnfiaWizardInitial {
  const floor = WIZARD_FLOOR[i.floor]
  return {
    sqm: String(i.sqm), ownership: String(i.own),
    ...(floor && enfiaFloorKeyFromValue(floor) === i.floor ? { floor } : {}),
    ...(i.aux > 0 ? { storageSqm: String(i.aux) } : {}),
  }
}

/** Αριθμός ως κείμενο για πεδίο φόρμας, χωρίς ουρές κινητής υποδιαστολής. */
const field = (n: number): string => {
  const r = Math.round(n * 100) / 100
  return Math.abs(r - n) < 1e-9 ? String(r) : String(n)
}

/** Τα στοιχεία του ακινήτου όπως αποθηκεύτηκαν από τον οδηγό. */
export interface SavedFacts { sqm?: number | string | null; ownership?: number | string | null }

/**
 * Οι ρυθμίσεις ΕΝΦΙΑ («services») του νέου ακινήτου, ή `null` όταν δεν πρέπει
 * να γραφτεί τίποτα.
 *
 * ΔΕΝ ΓΡΑΦΕΤΑΙ ΤΙΠΟΤΑ ΟΤΑΝ:
 *   · ο ιδιοκτήτης άλλαξε στον οδηγό τα τετραγωνικά ή το ποσοστό: η εκτίμηση
 *     περιγράφει πια άλλο ακίνητο από αυτό που αποθήκευσε·
 *   · υπάρχουν βοηθητικοί χώροι: η φόρμα του πίνακα δεν έχει τέτοιο πεδίο και
 *     χωρίς αυτούς το ποσό θα έβγαινε μικρότερο από του υπολογιστή·
 *   · για οποιονδήποτε άλλο λόγο οι ρυθμίσεις δεν ξαναβγάζουν ΑΚΡΙΒΩΣ το ποσό
 *     του υπολογιστή. Ο έλεγχος γίνεται εδώ, με τη μηχανή του πίνακα, ώστε η
 *     υπόσχεση «ο ίδιος αριθμός» να μην εξαρτάται από το ότι κάποιος θυμήθηκε
 *     να τη δοκιμάσει.
 */
export function enfiaCarrySettings(i: EnfiaInputs, saved: SavedFacts, year: number): Partial<EnfiaSettings> | null {
  if (i.aux > 0) return null
  const sqm = Number(saved.sqm), pct = Number(saved.ownership ?? 100)
  if (!(Math.abs(sqm - i.sqm) < 1e-9) || !(Math.abs((pct || 100) - i.own) < 1e-9)) return null
  const s = {
    enfiaSqm: field(i.sqm), enfiaZone: i.zone, enfiaFloor: i.floor, enfiaAge: i.age,
    enfiaOwnership: field(i.own), enfiaTotalVal: field(i.share), enfiaPropVal: field(i.value),
  }
  const pub = enfiaPublicEstimate(i)?.annual
  const dash = enfiaFromSettings(s, year, null)?.annual
  return pub != null && pub === dash ? s : null
}
