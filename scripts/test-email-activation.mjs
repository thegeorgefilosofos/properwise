#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  ΟΙ ΕΠΙΣΤΟΛΕΣ ΕΝΕΡΓΟΠΟΙΗΣΗΣ ΚΑΙ ΤΟ ΚΛΕΙΔΩΜΑ ΤΗΣ ΟΥΡΑΣ, ΠΡΙΝ ΚΑΙ ΜΕΤΑ
// ─────────────────────────────────────────────────────────────────────────
//  Δύο μεταναστεύσεις, δύο σφάλματα που η παραγωγή έδειξε στις 18/10/2026:
//
//    20261018164100  το add_first_property δεν έφτασε ποτέ: έμπαινε μέσα στο
//                    τριήμερο του welcome και κοβόταν για πάντα, ενώ η συνθήκη
//                    του ρωτούσε flag που δεν γράφει κανείς.
//    20261018164200  το κλείδωμα του προγραμματισμού ήταν advisory lock
//                    συνεδρίας, που το PostgREST το παίρνει σε μία σύνδεση του
//                    pool και το «αφήνει» σε άλλη, όπου δεν υπάρχει.
//
//  Οπως το scripts/test-ai-units-concurrency.mjs: δικό του Postgres σε
//  προσωρινό φάκελο, όλες οι μεταναστεύσεις όπως τις παίζει το
//  scripts/db-replay.sh σε δύο βάσεις: `before` χωρίς τις δύο νέες, `after`
//  με όλες. Στη `before` ΠΡΕΠΕΙ να φανούν τα σφάλματα, στην `after` όχι.
//
//    1. Το scripts/db/email-activation-probe.sql (το ίδιο που τρέχει το CI στο
//       db-replay) σε κάθε βάση: στη before κοκκινίζει κάθε σενάριο, στην
//       after κανένα.
//    2. Το pool, με τρεις πραγματικές συνδέσεις: η πρώτη παίρνει το κλείδωμα
//       και μένει ανοιχτή, η δεύτερη το αφήνει, η τρίτη ζητά να το πάρει.
//
//  ΧΡΗΣΗ:  node scripts/test-email-activation.mjs [--keep]
//  Απαιτεί: postgresql-16 τοπικά (initdb, pg_ctl, psql). Δεν συνδέεται ποτέ
//  σε άλλη βάση. Εξοδος 1 σε κάθε αποτυχία.
// ═══════════════════════════════════════════════════════════════════════════
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const NEW = [
  '20261018164100_to_proto_akinito_den_skontaftei_sto_kalosorisma.sql',
  '20261018164200_to_kleidoma_tou_programmatismou_einai_misthosi.sql',
]
const PROBE = join(ROOT, 'scripts/db/email-activation-probe.sql')
const KEEP = process.argv.includes('--keep')

const pgRoot = '/usr/lib/postgresql'
const versions = existsSync(pgRoot) ? readdirSync(pgRoot).sort((a, b) => Number(a) - Number(b)) : []
if (!versions.length) { console.error('✗ Δεν βρέθηκε PostgreSQL. Εγκατέστησε postgresql-16.'); process.exit(1) }
const BIN = join(pgRoot, versions[versions.length - 1], 'bin')

// ── Ο ΠΡΟΣΩΡΙΝΟΣ ΔΙΑΚΟΜΙΣΤΗΣ ──────────────────────────────────────────────
const WORK = mkdtempSync(join(process.env.PIN_TEST_TMP || tmpdir(), 'email-activation-'))
const PGDATA = join(WORK, 'pgdata')
const PORT = String(20000 + Math.floor(Math.random() * 20000))
const asRoot = process.getuid && process.getuid() === 0 &&
  spawnSync('id', ['postgres'], { stdio: 'ignore' }).status === 0
const PG_IDS = asRoot
  ? { uid: Number(spawnSync('id', ['-u', 'postgres'], { encoding: 'utf8' }).stdout), gid: Number(spawnSync('id', ['-g', 'postgres'], { encoding: 'utf8' }).stdout) }
  : {}
function runPg(bin, args) {
  const r = spawnSync(join(BIN, bin), args, { encoding: 'utf8', ...PG_IDS })
  if (r.status !== 0) throw new Error(`${bin} ${args.join(' ')}\n${r.stdout}\n${r.stderr}`)
  return r.stdout
}
function stop() {
  if (KEEP) { console.log(`  --keep: ο διακομιστής μένει· σβήνει με pg_ctl -D ${PGDATA} stop`); return }
  try { runPg('pg_ctl', ['-D', PGDATA, 'stop', '-m', 'immediate']) } catch { /* ήδη σταματημένος */ }
  rmSync(WORK, { recursive: true, force: true })
}
process.on('exit', stop)
process.on('SIGINT', () => process.exit(130))
process.on('SIGTERM', () => process.exit(143))

if (asRoot) spawnSync('chown', ['-R', 'postgres:postgres', WORK])
runPg('initdb', ['-D', PGDATA, '-U', 'postgres', '--auth=trust'])
runPg('pg_ctl', ['-D', PGDATA, '-l', join(PGDATA, 'log'), '-o', `-p ${PORT} -k ${WORK} -c listen_addresses=''`, 'start'])

const CONN = ['-h', WORK, '-p', PORT, '-U', 'postgres', '-X']
const env = { ...process.env, PGOPTIONS: '' }
for (let i = 0; i < 30; i++) {
  if (spawnSync(`${BIN}/psql`, [...CONN, '-c', 'select 1'], { stdio: 'ignore' }).status === 0) break
  spawnSync('sleep', ['0.5'])
}
function psql(db, args, extraEnv = {}) {
  return spawnSync(`${BIN}/psql`, [...CONN, '-d', db, '-q', '-At', ...args], { encoding: 'utf8', env: { ...env, ...extraEnv } })
}
function q(db, sql) {
  const r = psql(db, ['-v', 'ON_ERROR_STOP=1', '-c', sql])
  if (r.status !== 0) throw new Error(`SQL στο ${db}: ${sql}\n${r.stderr}`)
  return { out: r.stdout.trim(), err: r.stderr.trim() }
}

// ── 1. ΟΙ ΜΕΤΑΝΑΣΤΕΥΣΕΙΣ, ΟΠΩΣ ΤΙΣ ΠΑΙΖΕΙ ΤΟ scripts/db-replay.sh ─────────
const MIG = join(WORK, 'mig')
mkdirSync(MIG)
const migrations = readdirSync(join(ROOT, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort()
for (const n of NEW) if (!migrations.includes(n)) { console.error(`✗ Λείπει η ${n}`); process.exit(1) }
for (const f of migrations) {
  const src = readFileSync(join(ROOT, 'supabase/migrations', f), 'utf8')
    .replace(/^([ \t]*)(CREATE EXTENSION[^;\n]*"(pg_cron|pg_net|pg_stat_statements|supabase_vault)"[^;\n]*;)/gim, '$1-- [db-replay] $2')
  writeFileSync(join(MIG, f), src)
}
if (asRoot) spawnSync('chown', ['-R', 'postgres:postgres', MIG])
function replay(db, list) {
  q('postgres', `create database ${db}`)
  const stub = psql(db, ['-v', 'ON_ERROR_STOP=1', '-f', join(ROOT, 'scripts/db/platform-stub.sql')])
  if (stub.status !== 0) throw new Error(`platform-stub: ${stub.stderr}`)
  for (const f of list) {
    const r = psql(db, ['-v', 'ON_ERROR_STOP=1', '-f', join(MIG, f)])
    if (r.status !== 0) throw new Error(`${db}: η ${f} δεν τρέχει\n${r.stderr.split('\n').filter(l => /ERROR|DETAIL/.test(l)).slice(0, 3).join('\n')}`)
  }
}
const t0 = Date.now()
replay('before', migrations.filter(f => !NEW.includes(f)))
replay('after', migrations)
console.log(`✓ ${migrations.length - NEW.length} μεταναστεύσεις στη before, ${migrations.length} στην after (${((Date.now() - t0) / 1000).toFixed(1)} s)`)
if (KEEP) console.log(`  psql -h ${WORK} -p ${PORT} -U postgres -d after`)

let failures = 0
function check(cond, label, detail = '') {
  if (cond) console.log(`  ✓ ${label}`)
  else { failures++; console.log(`  ✗ ${label}${detail ? `  (${detail})` : ''}`) }
}

// ── 2. ΤΟ ΣΕΝΑΡΙΟ ΤΟΥ CI, ΣΕ ΚΑΘΕ ΒΑΣΗ ──────────────────────────────────────
// Χωρίς ON_ERROR_STOP: κάθε μπλοκ τρέχει, ώστε να μετρηθεί ΠΟΙΑ κοκκινίζουν.
const SCENARIOS = ['Α', 'Β', 'Γ', 'Μ']
function probe(db) {
  const r = psql(db, ['-v', 'ON_ERROR_STOP=0', '-f', PROBE])
  const text = r.stdout + r.stderr
  const passed = SCENARIOS.filter(s => text.includes(`probe: [${s}]`))
  const failed = SCENARIOS.filter(s => new RegExp(`ERROR:.*\\[${s}\\]`).test(text))
  const stray = text.split('\n').filter(l => /ERROR/.test(l) && !SCENARIOS.some(s => l.includes(`[${s}]`)))
  return { passed, failed, stray, lines: text.split('\n').filter(l => /ERROR|probe:/.test(l)) }
}
console.log('\n▶ scripts/db/email-activation-probe.sql')
for (const db of ['before', 'after']) {
  const r = probe(db)
  for (const l of r.lines) console.log(`  ${db.padEnd(7)} ${l.replace(/^psql:[^ ]+ /, '')}`)
  check(r.stray.length === 0, `${db}: η σκαλωσιά του σεναρίου τρέχει`, r.stray[0])
  if (db === 'before') {
    check(r.failed.length === SCENARIOS.length && r.passed.length === 0,
      'ΠΡΙΝ: και τα τέσσερα σενάρια κοκκινίζουν (τα σφάλματα αναπαράγονται)', `κόκκινα: ${r.failed.join(',') || '—'}`)
  } else {
    check(r.passed.length === SCENARIOS.length && r.failed.length === 0,
      'ΜΕΤΑ: και τα τέσσερα σενάρια περνούν', `κόκκινα: ${r.failed.join(',') || '—'}`)
  }
}

// ── 3. ΤΟ POOL: ΤΡΕΙΣ ΣΥΝΔΕΣΕΙΣ ─────────────────────────────────────────────
// Οπως το PostgREST: το «πήρα» σε μία σύνδεση που μένει ζωντανή και αδρανής,
// το «άφησα» σε δεύτερη, το επόμενο τικ σε τρίτη.
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function poolRace(db) {
  const holder = spawn(`${BIN}/psql`, [...CONN, '-d', db, '-q', '-At', '-c', 'select public.try_email_schedule_lock()', '-c', 'select pg_sleep(4)'],
    { env: { ...env, PGAPPNAME: 'lease-holder' } })
  let held = ''
  holder.stdout.on('data', d => { held += d })
  const done = new Promise(res => holder.on('close', res))
  for (let i = 0; i < 200; i++) {
    if (q(db, `select count(*) from pg_stat_activity where application_name = 'lease-holder' and query like '%pg_sleep%'`).out === '1') break
    await sleep(25)
  }
  const whileHeld = q(db, 'select public.try_email_schedule_lock()').out
  const release = q(db, 'select public.release_email_schedule_lock()')
  const afterRelease = q(db, 'select public.try_email_schedule_lock()').out
  await done
  q(db, 'select public.release_email_schedule_lock()')
  return { held: held.trim().split('\n')[0], whileHeld, afterRelease, warning: /don't own a lock/.test(release.err) }
}
console.log('\n▶ Pool: πήρα στη σύνδεση 1 (μένει ανοιχτή), άφησα στη 2, ξαναπαίρνω στην 3')
for (const db of ['before', 'after']) {
  const r = await poolRace(db)
  console.log(`  ${db.padEnd(7)} πήρα=${r.held}  ενώ κρατιέται=${r.whileHeld}  μετά το άφησα=${r.afterRelease}${r.warning ? '  (WARNING: you don\'t own a lock)' : ''}`)
  if (db === 'before') {
    check(r.held === 't' && r.afterRelease === 'f' && r.warning,
      'ΠΡΙΝ: το «άφησα» από άλλη σύνδεση δεν λύνει τίποτα και το επόμενο τικ βρίσκει κλειδωμένο (το σφάλμα αναπαράγεται)')
  } else {
    check(r.held === 't' && r.whileHeld === 'f', 'ΜΕΤΑ: όσο κρατιέται, δεύτερο τρέξιμο δεν περνά')
    check(r.afterRelease === 't' && !r.warning, 'ΜΕΤΑ: το «άφησα» από άλλη σύνδεση λύνει τη μίσθωση')
  }
}

console.log(failures ? `\n🔴 ${failures} έλεγχοι απέτυχαν` : '\n✅ Τα σφάλματα φαίνονται στη before και λείπουν από την after')
process.exit(failures ? 1 : 0)
