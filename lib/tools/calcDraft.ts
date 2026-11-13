// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΠΡΟΧΕΙΡΟ ΤΟΥ ΥΠΟΛΟΓΙΣΤΗ: ΑΠΟ ΤΗ ΔΗΜΟΣΙΑ ΣΕΛΙΔΑ ΣΤΟ ΠΡΩΤΟ ΑΚΙΝΗΤΟ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΑΛΛΑΞΕ (13/11/2026). Τα πεδία του υπολογιστή ταξίδευαν μέσα στη διεύθυνση
// της εγγραφής («/signup?next=/dashboard?action=enfia&tm=…»). Η διεύθυνση
// γράφεται στα αρχεία καταγραφής του διακομιστή, του παρόχου φιλοξενίας και
// μπαίνει αυτούσια στο email επιβεβαίωσης. Τα στοιχεία ενός ακινήτου δεν έχουν
// δουλειά εκεί. Τώρα η διεύθυνση λέει μόνο ΤΙ ζητήθηκε (`action=enfia`) και οι
// τιμές μένουν στη συσκευή, σε αυτό το πρόχειρο.
//
// ΤΡΕΙΣ ΚΑΝΟΝΕΣ:
//   1. Γράφεται ΜΟΝΟ όταν ο επισκέπτης πατήσει «Αποθήκευσε το ακίνητο». Οσο
//      απλώς υπολογίζει, τίποτα δεν μένει πίσω του.
//   2. Ζει λίγο (`CALC_DRAFT_TTL_MS`): όσο χρειάζεται μια εγγραφή με
//      επιβεβαίωση email. Ληγμένο πρόχειρο διαβάζεται ως κανένα και σβήνεται.
//   3. Διαβάζεται ΜΙΑ φορά (`takeCalcDraft`): ο πίνακας το παίρνει και το
//      σβήνει, ώστε ένα δεύτερο άνοιγμα να μην ξαναπροτείνει το ίδιο ακίνητο.
//
// Κάθε τιμή κρίνεται ξανά από τη συνέχεια του εργαλείου της
// (lib/tools/enfiaCarry.ts, lib/tools/rentCarry.ts). Εδώ ελέγχεται μόνο το
// σχήμα: έκδοση, εργαλείο, ηλικία, κλειδιά από τον κατάλογο, κείμενο με όριο.
// ═══════════════════════════════════════════════════════════════════════════
import { SPEC as ENFIA_SPEC } from './enfiaSpec'
import { SPEC as RENT_SPEC } from './rentSpec'
import { toolQuery } from './permalink'

/** Τα εργαλεία που περνούν ακίνητο στον πίνακα. */
export type CalcTool = 'enfia' | 'rent'

/** Τα μόνα κλειδιά που κρατά το πρόχειρο κάθε εργαλείου. */
export const CALC_DRAFT_KEYS: Readonly<Record<CalcTool, readonly string[]>> = {
  enfia: Object.keys(ENFIA_SPEC),
  rent: Object.keys(RENT_SPEC),
}

export const CALC_DRAFT_STORAGE = 'pw.calc-draft'
const VERSION = 1

/** Μία ημέρα: αρκεί για εγγραφή με επιβεβαίωση email, όχι για να ξεχαστεί στη συσκευή. */
export const CALC_DRAFT_TTL_MS = 24 * 60 * 60 * 1000

/** Ρολόι που πάει λίγο μπροστά δεν ακυρώνει πρόχειρο που μόλις γράφτηκε. */
const SKEW_MS = 5 * 60 * 1000

/** Καμία τιμή πεδίου υπολογιστή δεν χρειάζεται περισσότερους χαρακτήρες. */
const MAX_VALUE = 24

export interface CalcDraft {
  tool: CalcTool
  values: Record<string, string>
  /** Πότε γράφτηκε, σε ms. */
  at: number
}

const SPECS = { enfia: ENFIA_SPEC, rent: RENT_SPEC } as const

/**
 * Μόνο όσα άλλαξε ο επισκέπτης, όπως τα γράφει η διεύθυνση του υπολογιστή
 * (`toolQuery`). Ό,τι έμεινε στην προεπιλογή το ξαναδίνει η ανάγνωση.
 */
export function changedValues(tool: CalcTool, values: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(toolQuery(SPECS[tool], values)))
}

const isTool = (t: unknown): t is CalcTool => t === 'enfia' || t === 'rent'

/** Μόνο τα κλειδιά του εργαλείου, μόνο κείμενο με όριο. */
function pick(tool: CalcTool, values: Readonly<Record<string, unknown>>): Record<string, string> | null {
  const out: Record<string, string> = {}
  for (const k of CALC_DRAFT_KEYS[tool]) {
    if (!Object.prototype.hasOwnProperty.call(values, k)) continue
    const v = values[k]
    if (typeof v !== 'string' || v.length > MAX_VALUE) return null
    out[k] = v
  }
  return out
}

/** Το πρόχειρο ως κείμενο αποθήκευσης· `null` όταν οι τιμές δεν είναι του εργαλείου. */
export function encodeCalcDraft(tool: CalcTool, values: Readonly<Record<string, string>>, now: number): string | null {
  const v = pick(tool, values)
  if (!v) return null
  return JSON.stringify({ v: VERSION, tool, values: v, at: now })
}

/**
 * Το πρόχειρο από το κείμενο αποθήκευσης, ή `null`: άλλη έκδοση, άλλο
 * εργαλείο από αυτό που ζητήθηκε, ληγμένο, από το μέλλον, ή χαλασμένο.
 */
export function decodeCalcDraft(raw: string | null | undefined, now: number, want?: CalcTool): CalcDraft | null {
  if (!raw) return null
  let d: unknown
  try { d = JSON.parse(raw) } catch { return null }
  if (!d || typeof d !== 'object') return null
  const o = d as { v?: unknown; tool?: unknown; values?: unknown; at?: unknown }
  if (o.v !== VERSION || !isTool(o.tool) || (want && o.tool !== want)) return null
  if (typeof o.at !== 'number' || !Number.isFinite(o.at)) return null
  if (o.at > now + SKEW_MS || now - o.at > CALC_DRAFT_TTL_MS) return null
  if (!o.values || typeof o.values !== 'object' || Array.isArray(o.values)) return null
  const values = pick(o.tool, o.values as Record<string, unknown>)
  return values ? { tool: o.tool, values, at: o.at } : null
}

// ── Η ΣΥΣΚΕΥΗ ─────────────────────────────────────────────────────────────
// localStorage και όχι sessionStorage: το email επιβεβαίωσης ανοίγει συνήθως
// ΝΕΑ καρτέλα, όπου το sessionStorage της προηγούμενης δεν υπάρχει. Κάθε
// πρόσβαση μέσα σε try: σε ιδιωτικό παράθυρο ή με μπλοκαρισμένη αποθήκευση το
// πρόχειρο απλώς δεν υπάρχει και η εγγραφή γίνεται όπως πριν, με κενό οδηγό.

function store(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null }
}

/** Γράφει το πρόχειρο. `false` όταν η συσκευή δεν το κράτησε. */
export function saveCalcDraft(tool: CalcTool, values: Readonly<Record<string, string>>, now = Date.now()): boolean {
  const raw = encodeCalcDraft(tool, changedValues(tool, values), now)
  const s = store()
  if (!raw || !s) return false
  try { s.setItem(CALC_DRAFT_STORAGE, raw); return true } catch { return false }
}

/** Σβήνει το πρόχειρο, ό,τι κι αν περιέχει. */
export function clearCalcDraft(): void {
  try { store()?.removeItem(CALC_DRAFT_STORAGE) } catch { /* τίποτα να σβηστεί */ }
}

/**
 * Παίρνει το πρόχειρο του εργαλείου και το σβήνει. Ληγμένο ή χαλασμένο σβήνεται
 * επίσης· πρόχειρο ΑΛΛΟΥ εργαλείου μένει όπως είναι.
 */
export function takeCalcDraft(tool: CalcTool, now = Date.now()): CalcDraft | null {
  const s = store()
  if (!s) return null
  let raw: string | null = null
  try { raw = s.getItem(CALC_DRAFT_STORAGE) } catch { return null }
  if (!raw) return null
  const d = decodeCalcDraft(raw, now)
  if (d && d.tool !== tool) return null
  clearCalcDraft()
  return d
}
