// ═══════════════════════════════════════════════════════════════════════════
// Η ΣΦΡΑΓΙΔΑ ΤΟΥ ΠΕΡΙΕΧΟΜΕΝΟΥ ΚΑΘΕ ΦΟΡΟΛΟΓΙΚΟΥ ΥΠΟΛΟΓΙΣΤΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (18/10/2026). Ο χάρτης έδινε lastmod 2026-08-26 για το
// /ypologismos-enfia και το /ypologismos-forou-enoikion και η σελίδα ΕΝΦΙΑ
// τύπωνε «Τελευταία ενημέρωση 26/08/2026», αν και το #401 (18/10) είχε αλλάξει
// H1, λυμένα παραδείγματα και FAQ ενώ η μηχανή ΕΝΦΙΑ είχε πάρει δύο νέους
// συντελεστές παλαιότητας (13/10). Η ημερομηνία ήταν μόνο ο έλεγχος των ορίων
// (`taxLimitAsOf(...).checkedAt`): σωστή για τα όρια, λάθος για τη σελίδα.
//
// Εδώ βγαίνει ένα αποτύπωμα ανά υπολογιστή από τα σύμβολα (όχι τα bytes) της
// σελίδας και της μηχανής της, με την ανάγνωση των οδηγών
// (scripts/lib/guide-stamps.mjs): σχόλια και εσοχές δεν το αλλάζουν. Η
// ημερομηνία περιεχομένου ζει στο app/toolStamps.json δίπλα στο αποτύπωμα.
// Τη γράφει μόνο το `npm run tools:stamp`, τη φυλάει ο
// scripts/guard-tool-updated.mjs και τη διαβάζει το app/pageUpdated.ts.
//
// ΤΙ ΜΕΤΡΑ: κάθε .ts/.tsx (όχι τεστ) κάτω από το app<διαδρομή>/ και τα αρχεία
// της μηχανής που γράφονται παρακάτω, ένα ένα. Η λίστα της μηχανής είναι
// στενή επίτηδες: μόνο εκεί όπου ζουν οι κανόνες και τα ποσά που τυπώνει η
// σελίδα, όχι κάθε βοηθητικό αρχείο που εισάγει.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { sourceLeaves } from './guide-stamps.mjs'

export const TOOL_LEDGER = 'app/toolStamps.json'

/** Οι υπολογιστές με «Νομική βάση» και η μηχανή που τους δίνει τα ποσά. */
export const TOOL_ENGINES = {
  '/ypologismos-enfia': ['lib/billing/enfia.ts'],
  '/ypologismos-forou-enoikion': ['lib/billing/greekTax.ts'],
  '/vraxyxronia-i-makroxronia': ['lib/billing/greekTax.ts', 'lib/tools/shortVsLong.ts'],
  '/kathari-apodosi': ['lib/billing/greekTax.ts', 'lib/tools/apodosi.ts'],
}

const isSource = (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.endsWith('.d.ts')

function walkDir(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`
    if (e.isDirectory()) out.push(...walkDir(p))
    else if (isSource(p)) out.push(p)
  }
  return out
}

/** Τα αρχεία που μετρούν στο αποτύπωμα ενός υπολογιστή, ταξινομημένα. */
export function toolFiles(path) {
  const dir = 'app' + path
  const page = existsSync(dir) ? walkDir(dir) : []
  return [...new Set([...page, ...(TOOL_ENGINES[path] ?? [])])].sort()
}

/** Το αποτύπωμα ενός υπολογιστή: 16 δεκαεξαδικά ψηφία. */
export function toolHash(path) {
  const h = createHash('sha256')
  for (const f of toolFiles(path)) h.update(`${f}\0${existsSync(f) ? sourceLeaves(f) : '(λείπει)'}\0`)
  return h.digest('hex').slice(0, 16)
}

/** Το αρχείο σφραγίδων: διαδρομή → { hash, updated }· κενό αν δεν υπάρχει. */
export function readToolLedger() {
  if (!existsSync(TOOL_LEDGER)) return {}
  return JSON.parse(readFileSync(TOOL_LEDGER, 'utf8')).tools ?? {}
}

export function writeToolLedger(tools) {
  const sorted = Object.fromEntries(Object.keys(tools).sort().map(p => [p, { hash: tools[p].hash, updated: tools[p].updated ?? null }]))
  const out = {
    'σημείωση': 'Παράγεται από το npm run tools:stamp. Μην το γράφεις με το χέρι. Το φυλάει ο scripts/guard-tool-updated.mjs. updated: null = δεν έχει οριστεί ημερομηνία περιεχομένου· ισχύει ο έλεγχος των ορίων.',
    tools: sorted,
  }
  writeFileSync(TOOL_LEDGER, JSON.stringify(out, null, 2) + '\n')
}

/** Σήμερα, ώρα Αθήνας (ή TOOL_TODAY=ΕΕΕΕ-ΜΜ-ΗΗ για δοκιμή). */
export const athensToday = () => process.env.TOOL_TODAY
  || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

export const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s
