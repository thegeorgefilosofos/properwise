// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΡΙΣΗ ΤΗΣ ΚΑΣΤΑΝΙΑΣ ΤΗΣ ΟΠΤΙΚΗΣ ΣΑΡΩΣΗΣ, ΧΩΡΙΣ ΠΕΡΙΗΓΗΤΗ
// ─────────────────────────────────────────────────────────────────────────
// Καθαρές συναρτήσεις πάνω στο findings.json του scripts/e2e-optiki-sarosi.mjs
// και στη βάση scripts/optiki-baseline.json. Δοκιμάζονται με σταθερά δείγματα
// στο scripts/optiki-ratchet.test.ts· ο περιηγητής δεν χρειάζεται για να
// αποδειχθεί ότι μια άνοδος κοκκινίζει.
// ═══════════════════════════════════════════════════════════════════════════

export const SEVERITIES = ['Υψηλό', 'Μεσαίο', 'Χαμηλό']

/**
 * Η ΤΑΥΤΟΤΗΤΑ ΕΝΟΣ ΕΥΡΗΜΑΤΟΣ ΑΝΑΜΕΣΑ ΣΕ ΔΥΟ ΣΑΡΩΣΕΙΣ.
 *
 * Οθόνη, κατηγορία, σοβαρότητα, τι και το κείμενό του — με τους αριθμούς
 * σβησμένους. Ενα «κείμενο πάνω σε κείμενο (43×13px)» που έγινε 44×13 δεν
 * είναι νέο εύρημα· ένα ποσό που άλλαξε επειδή άλλαξε η μέρα, ούτε.
 */
export const signature = (f) => [
  f.target, f.cls, f.sev,
  String(f.what || '').replace(/ — και στο τέλος.*$/, '').replace(/\d[\d.,]*/g, '#'),
  String(f.text || '').replace(/\d[\d.,]*/g, '#').replace(/\s+/g, ' ').trim().slice(0, 60),
].join(' ¦ ')

/**
 * Πλήθη ανά οθόνη × «κατηγορία|σοβαρότητα».
 * @param {{target:string, cls:string, sev:string}[]} findings
 * @returns {Record<string, Record<string, number>>}
 */
export function countsOf(findings) {
  /** @type {Record<string, Record<string, number>>} */
  const out = {}
  for (const f of findings) {
    const k = `${f.cls}|${f.sev}`
    out[f.target] ??= {}
    out[f.target][k] = (out[f.target][k] || 0) + 1
  }
  return out
}

/** Η βάση που γράφει το `--write`: πλήθη και ταυτότητες, ταξινομημένα. */
export function baselineFrom(findings, run, note) {
  const counts = countsOf(findings)
  const sorted = Object.fromEntries(Object.keys(counts).sort().map((t) => [t, Object.fromEntries(Object.entries(counts[t]).sort())]))
  return {
    σημείωση: note,
    widths: run.widths,
    themes: run.themes,
    counts: sorted,
    known: [...new Set(findings.map(signature))].sort(),
  }
}

/** @typedef {{key:string, now:number, max:number}} Row */

/**
 * Η ΣΥΓΚΡΙΣΗ. Μετρούν μόνο οι οθόνες που ΣΑΡΩΘΗΚΑΝ: μια σάρωση με
 * `E2E_ONLY=overview` δεν «έριξε» τα ευρήματα των άλλων σαράντα. Οθόνη που
 * σαρώθηκε και δεν υπάρχει στη βάση (νέα σελίδα στον χάρτη) ξεκινά από μηδέν:
 * ό,τι βρέθηκε πάνω της είναι νέο, γιατί είναι.
 *
 * @template {{target:string, cls:string, sev:string, what:string, text:string}} F
 * @param {F[]} findings
 * @param {{widths:number[], themes:string[], targets:string[]}} run
 * @param {{widths:number[], themes:string[], counts:Record<string, Record<string, number>>, known:string[]}} base
 * @returns {{ refused?: string, rows: Row[], up: Row[], down: Row[], fresh: F[] }}
 */
export function compare(findings, run, base) {
  const same = (a, b) => JSON.stringify([...a].map(String).sort()) === JSON.stringify([...b].map(String).sort())
  if (!same(run.widths, base.widths) || !same(run.themes, base.themes)) {
    return { refused: `η σάρωση έτρεξε σε πλάτη ${run.widths.join('/')} και θέματα ${run.themes.join('/')}, η βάση είναι μετρημένη σε ${base.widths.join('/')} και ${base.themes.join('/')}`, rows: [], up: [], down: [], fresh: [] }
  }
  const ran = new Set(run.targets)
  const now = countsOf(findings)
  const keys = new Set()
  for (const t of ran) for (const k of Object.keys({ ...(now[t] || {}), ...(base.counts[t] || {}) })) keys.add(k)
  const rows = [...keys].sort().map((key) => {
    let n = 0, m = 0
    for (const t of ran) { n += now[t]?.[key] || 0; m += base.counts[t]?.[key] || 0 }
    return { key, now: n, max: m }
  })
  const known = new Set(base.known)
  const fresh = findings.filter((f) => ran.has(f.target) && !known.has(signature(f)))
  return { rows, up: rows.filter((r) => r.now > r.max), down: rows.filter((r) => r.now < r.max), fresh }
}
