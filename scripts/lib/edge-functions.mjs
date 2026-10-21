// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΣΥΝΑΡΤΗΣΕΙΣ ΑΚΡΟΥ ΠΟΥ ΠΕΡΙΜΕΝΟΥΜΕ ΣΤΗΝ ΠΑΡΑΓΩΓΗ, ΑΠΟ ΤΟ ΑΠΟΘΕΤΗΡΙΟ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (έλεγχος 19/10/2026, #1 και #12). Στην παραγωγή τρέχουν τρεις
// συναρτήσεις που δεν υπάρχουν στο `supabase/functions/`:
//   · `euribor-updater` v17: verify_jwt=false, γράφει στο `market_rates` με
//     service role χωρίς κανέναν έλεγχο. Περίπου 400 κλήσεις σβήνουν όλο το
//     πραγματικό ιστορικό επιτοκίων (P0).
//   · `calendar-feed` v30: σερβίρει ακόμη το παλιό όνομα στις παλιές συνδρομές.
//   · `dispatch-message` v27.
// ΜΕΤΑ (20–21/10/2026): οι `euribor-updater` και `dispatch-message` γύρισαν
// 410 Gone στην παραγωγή και μένει να σβηστούν από τον πίνακα του Supabase.
// Η `calendar-feed` έγινε ανακατεύθυνση 301 στο /imerologio/<κουπόνι>.ics και
// η πηγή της ζει πια στο `supabase/functions/calendar-feed/`.
// Το deploy του CI ανεβάζει όσα ΥΠΑΡΧΟΥΝ· δεν σβήνει όσα έφυγαν από το
// αποθετήριο. Κανένας έλεγχος δεν το έβλεπε, γιατί η απόκλιση ζει στην
// παραγωγή, όχι στον κώδικα.
//
// ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ scripts/guard-*.mjs. Ο φύλακας τρέχει σε κάθε PR χωρίς
// μυστικά· η λίστα της παραγωγής θέλει SUPABASE_ACCESS_TOKEN. Ένας φύλακας που
// χωρίς διακριτικό τυπώνει ✓ θα διαβαζόταν «ελέγχθηκε» ενώ δεν ελέγχθηκε τίποτα
// (.claude/skills/fylakas/SKILL.md). Γι' αυτό:
//   · `npm run edge:expected` τυπώνει τη λίστα του αποθετηρίου (χωρίς δίκτυο)·
//   · `npm run edge:drift` συγκρίνει με την παραγωγή και ΑΠΟΤΥΓΧΑΝΕΙ ΔΥΝΑΤΑ
//     (κωδικός 2) όταν δεν έχει ούτε αρχείο ούτε διακριτικό.
// Εδώ ζουν οι καθαρές συναρτήσεις· τις ελέγχει το scripts/edge-drift.test.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const FUNCTIONS_DIR = 'supabase/functions'
export const CONFIG_FILE = 'supabase/config.toml'

/**
 * Οι συναρτήσεις του αποθετηρίου: κάθε φάκελος του `supabase/functions/` με
 * `index.ts`. Οι φάκελοι με «_» (κοινός κώδικας, `_shared`) δεν ανεβαίνουν.
 * @returns {string[]} ταξινομημένα ονόματα (slug)
 */
export function expectedFunctions(root = '.') {
  const dir = join(root, FUNCTIONS_DIR)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(name => !name.startsWith('_') && !name.startsWith('.'))
    .filter(name => { try { return statSync(join(dir, name)).isDirectory() && existsSync(join(dir, name, 'index.ts')) } catch { return false } })
    .sort()
}

/**
 * Το `verify_jwt` κάθε συνάρτησης όπως το γράφει το `supabase/config.toml`.
 * @returns {Map<string, boolean>}
 */
export function configuredJwt(root = '.') {
  const out = new Map()
  const file = join(root, CONFIG_FILE)
  if (!existsSync(file)) return out
  let current = null
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const head = /^\s*\[functions\.([A-Za-z0-9_-]+)\]\s*$/.exec(line)
    if (head) { current = head[1]; continue }
    if (/^\s*\[/.test(line)) { current = null; continue }
    const jwt = /^\s*verify_jwt\s*=\s*(true|false)\s*$/.exec(line)
    if (current && jwt) out.set(current, jwt[1] === 'true')
  }
  return out
}

/**
 * Η λίστα της παραγωγής από ό,τι επιστρέφει το Management API
 * (`GET /v1/projects/{ref}/functions`) ή το εργαλείο `list_edge_functions`:
 * πίνακας, ή αντικείμενο με `functions`. Κρατά μόνο όσα χρειάζεται η σύγκριση.
 * @returns {{ slug: string, version: number|null, status: string|null, verify_jwt: boolean|null }[]}
 */
export function parseDeployed(json) {
  const list = Array.isArray(json) ? json : Array.isArray(json?.functions) ? json.functions : null
  if (!list) throw new Error('η λίστα της παραγωγής δεν είναι πίνακας ούτε { functions: [...] }')
  return list.map(f => ({
    slug: String(f?.slug ?? f?.name ?? ''),
    version: Number.isFinite(f?.version) ? f.version : null,
    status: f?.status ?? null,
    verify_jwt: typeof f?.verify_jwt === 'boolean' ? f.verify_jwt : null,
  })).filter(f => f.slug)
}

/**
 * Η απόκλιση ανάμεσα σε αποθετήριο και παραγωγή.
 *   · `extra`: τρέχουν στην παραγωγή χωρίς πηγή στο αποθετήριο (το #1).
 *   · `missing`: υπάρχουν στο αποθετήριο και δεν ανέβηκαν.
 *   · `jwt`: ανέβηκαν με άλλο `verify_jwt` από αυτό που γράφει το config.toml.
 */
export function edgeDrift(expected, deployed, jwtConfig = new Map()) {
  const want = new Set(expected)
  const have = new Map(deployed.map(f => [f.slug, f]))
  const extra = deployed.filter(f => !want.has(f.slug)).sort((a, b) => a.slug.localeCompare(b.slug))
  const missing = expected.filter(s => !have.has(s))
  const jwt = expected
    .filter(s => have.has(s) && jwtConfig.has(s) && have.get(s).verify_jwt !== null && have.get(s).verify_jwt !== jwtConfig.get(s))
    .map(s => ({ slug: s, deployed: have.get(s).verify_jwt, config: jwtConfig.get(s) }))
  return { extra, missing, jwt, clean: !extra.length && !missing.length && !jwt.length }
}
