// ═══════════════════════════════════════════════════════════════════════════
// ΑΠΟ ΤΟΝ ΥΠΟΛΟΓΙΣΤΗ ΣΤΟ ΑΚΙΝΗΤΟ: Η ΣΥΝΕΧΕΙΑ ΜΕΣΑ ΣΤΟΝ ΠΙΝΑΚΑ
// ─────────────────────────────────────────────────────────────────────────
// Τρία βήματα, καθαρές συναρτήσεις ώστε να δοκιμάζονται χωρίς περιηγητή:
//
//   1. `resolveCarry`: τι ζήτησε η διεύθυνση εκκίνησης (`action`) και με ποιες
//      τιμές. Πρώτα η ίδια η διεύθυνση (παλιοί σύνδεσμοι με πεδία), μετά το
//      πρόχειρο της συσκευής (lib/tools/calcDraft.ts). Πρόχειρο άλλου
//      εργαλείου από αυτό που ζητήθηκε δεν διαβάζεται.
//   2. `carryWizard`: τι προσυμπληρώνει ο οδηγός προσθήκης ακινήτου.
//   3. `carrySavedNote`: τι λέει η οθόνη μόλις αποθηκευτεί. Από τη ΓΡΑΜΜΗ ΠΟΥ
//      ΑΠΟΘΗΚΕΥΤΗΚΕ, όχι από το πρόχειρο: αν ο ιδιοκτήτης άλλαξε τα τετραγωνικά
//      στον οδηγό, η επιβεβαίωση λέει τα δικά του. Και η προθεσμία βγαίνει από
//      την ίδια μηχανή που γράφει το ημερολόγιο (`taxEventsToWrite`).
// ═══════════════════════════════════════════════════════════════════════════
import { readEnfiaCarry, readEnfiaCarryValues, enfiaCarryWizard, ENFIA_ACTION, type EnfiaCarry, type EnfiaWizardInitial } from './enfiaCarry'
import { readRentCarry, rentCarryWizard, RENT_ACTION, type RentCarry } from './rentCarry'
import type { CalcDraft } from './calcDraft'
import { taxEventsToWrite, taxProfileOfStatus } from '@/lib/facts/deadlines'
import { readStatus, type PropertyStatus, type StatusRow } from '@/lib/property/status'
import { fe, fn, grDate } from '@/lib/core/format'

export type CalcCarry =
  | { kind: 'enfia'; enfia: EnfiaCarry }
  | { kind: 'rent'; rent: RentCarry }

/**
 * Η συνέχεια της εκκίνησης, ή `null`.
 *
 * @param action το `action` της διεύθυνσης.
 * @param url οι παράμετροι της διεύθυνσης (για τους παλιούς συνδέσμους ΕΝΦΙΑ με πεδία).
 * @param draft το πρόχειρο που ΠΗΡΕ ήδη ο καλών για αυτό το εργαλείο, αν υπήρχε.
 */
export function resolveCarry(action: string | null, url: URLSearchParams, draft: CalcDraft | null): CalcCarry | null {
  if (action === ENFIA_ACTION) {
    const fromUrl = readEnfiaCarry(url)
    if (fromUrl) return { kind: 'enfia', enfia: fromUrl }
    const fromDraft = draft?.tool === 'enfia' ? readEnfiaCarryValues(draft.values) : null
    return fromDraft ? { kind: 'enfia', enfia: fromDraft } : null
  }
  if (action === RENT_ACTION) {
    const rent = draft?.tool === 'rent' ? readRentCarry(draft.values) : null
    return rent ? { kind: 'rent', rent } : null
  }
  return null
}

/** Το εργαλείο του προχείρου που αντιστοιχεί σε ένα `action`, ή `null`. */
export function draftToolOf(action: string | null): CalcDraft['tool'] | null {
  return action === ENFIA_ACTION ? 'enfia' : action === RENT_ACTION ? 'rent' : null
}

/** Ό,τι προσυμπληρώνει ο οδηγός: τα πεδία του ΕΝΦΙΑ, ή κατάσταση και μίσθωμα. */
export interface CarryWizardInitial extends Partial<EnfiaWizardInitial> {
  statusKey?: PropertyStatus
  rent?: string
}

export function carryWizard(c: CalcCarry | null): CarryWizardInitial | undefined {
  if (!c) return undefined
  return c.kind === 'enfia' ? enfiaCarryWizard(c.enfia.inputs) : rentCarryWizard(c.rent)
}

// ── Η ΕΠΙΒΕΒΑΙΩΣΗ ─────────────────────────────────────────────────────────

/** Η γραμμή του ακινήτου όπως αποθηκεύτηκε. */
export interface SavedProperty extends StatusRow {
  name?: string | null
  sqm?: number | string | null
  target_rent?: number | string | null
}

const PAYMENT: Record<CalcCarry['kind'], RegExp> = {
  // Οι δόσεις, όχι η «έκδοση εκκαθαριστικού»: αυτή δεν πληρώνεται.
  enfia: /^tax:enfia-(first|instalment|last)-/,
  // Η δήλωση και οι δόσεις του φόρου εισοδήματος, όπου πληρώνεται ο φόρος των ενοικίων.
  rent: /^tax:income-(decl|instalment)-/,
}

/** Η επόμενη προθεσμία του ημερολογίου που αφορά αυτό που υπολόγισε, ή `null`. */
export function carryNextDeadline(kind: CalcCarry['kind'], saved: StatusRow, today: string): { title: string; date: string } | null {
  const profile = taxProfileOfStatus(readStatus(saved))
  const e = taxEventsToWrite(today, profile).find(x => PAYMENT[kind].test(String(x.source ?? '')) && String(x.event_date) >= today)
  return e ? { title: String(e.title), date: String(e.event_date) } : null
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Η πρόταση της επιβεβαίωσης.
 *
 * @param enfiaAnnual ο ΕΝΦΙΑ που ΓΡΑΦΤΗΚΕ στις ρυθμίσεις του ακινήτου, ή `null`
 *        όταν δεν γράφτηκε (άλλαξαν τα στοιχεία στον οδηγό, βοηθητικοί χώροι).
 */
export function carrySavedNote(kind: CalcCarry['kind'], saved: SavedProperty, enfiaAnnual: number | null, today: string): string {
  const parts: string[] = []
  const sqm = num(saved.sqm)
  if (sqm > 0) parts.push(`${fn(sqm, Number.isInteger(sqm) ? 0 : 2)} τ.μ.`)
  if (enfiaAnnual !== null && enfiaAnnual > 0) parts.push(`ΕΝΦΙΑ ${fe(enfiaAnnual)} τον χρόνο`)
  const rent = num(saved.target_rent)
  if (kind === 'rent' && rent > 0) parts.push(`μίσθωμα ${fe(rent)} τον μήνα`)
  const name = String(saved.name ?? '').trim()
  const head = `Αποθηκεύτηκε${name ? ` το «${name}»` : ' το ακίνητο'}${parts.length ? `: ${parts.join(', ')}` : ''}.`
  const next = carryNextDeadline(kind, saved, today)
  return next ? `${head} Στο ημερολόγιό σου: ${next.title}, ${grDate(next.date)}.` : head
}
