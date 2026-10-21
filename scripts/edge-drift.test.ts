// npx tsx scripts/edge-drift.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΑΠΟΘΕΤΗΡΙΟ ΚΑΙ ΠΑΡΑΓΩΓΗ: Η ΣΥΓΚΡΙΣΗ ΤΩΝ ΣΥΝΑΡΤΗΣΕΩΝ ΑΚΡΟΥ (έλεγχος 19/10/2026, #1)
// ─────────────────────────────────────────────────────────────────────────
// Η λίστα της παραγωγής εδώ είναι κατασκευασμένη, με το σχήμα του Management
// API. Περιέχει την απόκλιση της 19/10 όπως έμεινε μετά τις 21/10: δύο
// συναρτήσεις χωρίς πηγή (η calendar-feed απέκτησε πηγή στο αποθετήριο).
// Ο ίδιος ο έλεγχος της παραγωγής θέλει διακριτικό: `npm run edge:drift`.
// ═══════════════════════════════════════════════════════════════════════════
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expectedFunctions, configuredJwt, parseDeployed, edgeDrift } from './lib/edge-functions.mjs'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) { if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) } }

const expected: string[] = expectedFunctions()
const jwt: Map<string, boolean> = configuredJwt()

// ── Η λίστα του αποθετηρίου ─────────────────────────────────────────────────
ok('η λίστα βγαίνει από τους φακέλους', expected.includes('market-data-updater') && expected.includes('health-check'))
ok('ο κοινός κώδικας δεν είναι συνάρτηση', !expected.includes('_shared'))
ok('οι δύο αποσυρμένες δεν είναι στο αποθετήριο',
  !['euribor-updater', 'dispatch-message'].some(s => expected.includes(s)))
ok('η calendar-feed έχει πηγή, χωρίς JWT', expected.includes('calendar-feed') && jwt.get('calendar-feed') === false)
ok('το config.toml έχει verify_jwt για κάθε συνάρτηση του αποθετηρίου', expected.every(s => jwt.has(s)))
ok('και καμία ενότητα για συνάρτηση που δεν υπάρχει', [...jwt.keys()].every(s => expected.includes(s)))

// ── Η απόκλιση της 19/10/2026 ───────────────────────────────────────────────
const prod = {
  functions: [
    ...expected.map(slug => ({ slug, version: 1, status: 'ACTIVE', verify_jwt: jwt.get(slug) ?? false })),
    { slug: 'euribor-updater', version: 17, status: 'ACTIVE', verify_jwt: false },
    { slug: 'dispatch-message', version: 27, status: 'ACTIVE', verify_jwt: false },
  ],
}
const d = edgeDrift(expected, parseDeployed(prod), jwt)
ok('βρίσκει τις δύο χωρίς πηγή', d.extra.map((f: { slug: string }) => f.slug).join() === 'dispatch-message,euribor-updater')
ok('καμία που δεν ανέβηκε', d.missing.length === 0)
ok('δεν είναι καθαρό', d.clean === false)

const same = edgeDrift(expected, parseDeployed(expected.map(slug => ({ slug, verify_jwt: jwt.get(slug) }))), jwt)
ok('ίδια λίστα: καθαρό', same.clean === true)

const lost = edgeDrift(expected, parseDeployed(expected.slice(1).map(slug => ({ slug }))), jwt)
ok('συνάρτηση που δεν ανέβηκε', lost.missing.join() === expected[0])

const flipped = expected.find(s => jwt.get(s) === true)!
const jwtOff = edgeDrift(expected, parseDeployed(expected.map(slug => ({ slug, verify_jwt: slug === flipped ? false : jwt.get(slug) }))), jwt)
ok('verify_jwt άλλο από το config.toml', jwtOff.jwt.length === 1 && jwtOff.jwt[0].slug === flipped)

let threw = false
try { parseDeployed({ nope: true }) } catch { threw = true }
ok('άγνωστο σχήμα: σφάλμα, όχι κενή λίστα', threw)

// ── Το σενάριο ως εντολή: οι κωδικοί εξόδου ─────────────────────────────────
const dir = mkdtempSync(join(tmpdir(), 'edge-drift-'))
const file = join(dir, 'functions.json')
writeFileSync(file, JSON.stringify(prod))
const run = (args: string[], env: Record<string, string | undefined> = {}) =>
  spawnSync('node', ['scripts/edge-drift.mjs', ...args], { encoding: 'utf8', env: { ...process.env, SUPABASE_ACCESS_TOKEN: '', ...env } })
const r1 = run([file])
ok('με απόκλιση: κωδικός 1 και το όνομα στην έξοδο', r1.status === 1 && r1.stderr.includes('euribor-updater'))
writeFileSync(file, JSON.stringify(expected.map(slug => ({ slug, verify_jwt: jwt.get(slug) }))))
ok('χωρίς απόκλιση: κωδικός 0', run([file]).status === 0)
const r3 = run([])
ok('χωρίς αρχείο και χωρίς διακριτικό: κωδικός 2, ΔΕΝ ΕΛΕΓΧΘΗΚΕ', r3.status === 2 && r3.stderr.includes('ΔΕΝ ΕΛΕΓΧΘΗΚΕ'))
ok('η λίστα του αποθετηρίου ως JSON', JSON.stringify(JSON.parse(run(['--expected']).stdout)) === JSON.stringify(expected))

console.log(failed === 0 ? `✓ edge-drift: ${passed} έλεγχοι πέρασαν` : `✗ edge-drift: ${failed} απέτυχαν από ${passed + failed}`)
if (failed > 0) process.exit(1)
