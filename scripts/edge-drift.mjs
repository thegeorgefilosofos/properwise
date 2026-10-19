#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΑΠΟΘΕΤΗΡΙΟ ΚΑΙ ΠΑΡΑΓΩΓΗ ΕΧΟΥΝ ΤΙΣ ΙΔΙΕΣ ΣΥΝΑΡΤΗΣΕΙΣ ΑΚΡΟΥ
// ─────────────────────────────────────────────────────────────────────────
// Το γιατί και οι κανόνες: scripts/lib/edge-functions.mjs.
//
//   node scripts/edge-drift.mjs --expected        η λίστα του αποθετηρίου, JSON
//   node scripts/edge-drift.mjs <αρχείο.json>     σύγκριση με αποθηκευμένη λίστα
//   node scripts/edge-drift.mjs                   σύγκριση με το Management API:
//       SUPABASE_ACCESS_TOKEN (sbp_…) και SUPABASE_PROJECT_REF (προεπιλογή η παραγωγή)
//
// ΚΩΔΙΚΟΙ: 0 καμία απόκλιση · 1 απόκλιση · 2 ΔΕΝ ΕΛΕΓΧΘΗΚΕ (χωρίς αρχείο και
// χωρίς διακριτικό, ή αποτυχία του API). Το 2 δεν είναι ποτέ πράσινο.
// Δεν αλλάζει τίποτα στην παραγωγή: μόνο διαβάζει.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { expectedFunctions, configuredJwt, parseDeployed, edgeDrift } from './lib/edge-functions.mjs'

/** Η παραγωγή (supabase-deploy.yml, κλάδος main). */
const PROD_REF = 'aromvduuxtcrzmwwvnej'

const arg = process.argv[2]
const expected = expectedFunctions()

if (arg === '--expected') {
  console.log(JSON.stringify(expected, null, 2))
  process.exit(0)
}

const notChecked = (why) => {
  console.error(`\n✗ ΔΕΝ ΕΛΕΓΧΘΗΚΕ: ${why}\n`)
  console.error('  ΤΙ ΝΑ ΚΑΝΕΙΣ: δώσε SUPABASE_ACCESS_TOKEN (και SUPABASE_PROJECT_REF για άλλο έργο),')
  console.error('  ή ένα αρχείο με τη λίστα: node scripts/edge-drift.mjs functions.json')
  console.error('  (GET https://api.supabase.com/v1/projects/<ref>/functions).\n')
  process.exit(2)
}

let raw
if (arg) {
  try { raw = JSON.parse(readFileSync(arg, 'utf8')) } catch (e) { notChecked(`το αρχείο ${arg} δεν διαβάστηκε: ${e.message}`) }
} else {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  const ref = process.env.SUPABASE_PROJECT_REF || PROD_REF
  if (!token) notChecked('λείπει το SUPABASE_ACCESS_TOKEN και δεν δόθηκε αρχείο')
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/functions`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) notChecked(`το Management API απάντησε HTTP ${res.status} για το ${ref}`)
    raw = await res.json()
  } catch (e) {
    notChecked(`το Management API δεν απάντησε: ${e.message}`)
  }
}

let deployed
try { deployed = parseDeployed(raw) } catch (e) { notChecked(e.message) }

const d = edgeDrift(expected, deployed, configuredJwt())
if (d.clean) {
  console.log(`✓ οι ${expected.length} συναρτήσεις του αποθετηρίου είναι οι ${deployed.length} της παραγωγής, με το verify_jwt του config.toml`)
  process.exit(0)
}

console.error(`\n✗ απόκλιση αποθετηρίου και παραγωγής:\n`)
for (const f of d.extra) {
  console.error(`  ΧΩΡΙΣ ΠΗΓΗ  ${f.slug}${f.version != null ? ` v${f.version}` : ''}${f.verify_jwt === false ? ' · verify_jwt=false' : ''}`)
}
for (const s of d.missing) console.error(`  ΔΕΝ ΑΝΕΒΗΚΕ ${s}  (υπάρχει στο supabase/functions/${s})`)
for (const j of d.jwt) console.error(`  verify_jwt  ${j.slug}: παραγωγή ${j.deployed}, config.toml ${j.config}`)
console.error(`
  ΤΙ ΝΑ ΚΑΝΕΙΣ:
  · ΧΩΡΙΣ ΠΗΓΗ: με έγκριση του ιδιοκτήτη, «supabase functions delete <όνομα> --project-ref <ref>»,
    ή επαναφορά της πηγής στο supabase/functions/ αν η συνάρτηση χρειάζεται.
  · ΔΕΝ ΑΝΕΒΗΚΕ: δες το τελευταίο «Supabase deploy» του CI.
  · verify_jwt: το config.toml είναι η πηγή· ξανατρέξε το deploy.
`)
process.exit(1)
