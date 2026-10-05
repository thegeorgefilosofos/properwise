#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  ΟΙ ΜΟΝΑΔΕΣ ΤΗΣ ΝΟΑΣ ΚΑΙ ΤΟ CHECK-IN ΚΑΤΩ ΑΠΟ ΤΑΥΤΟΧΡΟΝΕΣ ΚΛΗΣΕΙΣ
// ─────────────────────────────────────────────────────────────────────────
//  Η 20261005150000 κάνει τρία πράγματα που φαίνονται μόνο με αγώνα:
//
//    · η άρνηση ορίου δεν γράφει τίποτα (η `bump_ai_usage` έγραφε +1 στη
//      δεξαμενή σε κάθε άρνηση, οπότε είκοσι κλήσεις πάνω από το όριο
//      έτρωγαν είκοσι μονάδες από όλους τους μη πληρώνοντες)·
//    · η επιστροφή γίνεται μία φορά ανά κλειδί, όσες κλήσεις κι αν έρθουν μαζί·
//    · το check-in κρατά το «τρεις την ώρα» (πριν, είκοσι μαζί περνούσαν).
//
//  Όπως το scripts/test-portal-pin-concurrency.mjs: δικό του Postgres σε
//  προσωρινό φάκελο, όλες οι μεταναστεύσεις όπως τις παίζει το
//  scripts/db-replay.sh σε δύο βάσεις (`before` χωρίς τη νέα, `after` με όλες),
//  συνδέσεις που περιμένουν σε advisory lock και ξεκινούν μαζί, σε READ
//  COMMITTED, REPEATABLE READ και SERIALIZABLE.
//
//  ΧΡΗΣΗ:  node scripts/test-ai-units-concurrency.mjs [--keep] [--quick]
//  Απαιτεί: postgresql-16 τοπικά (initdb, pg_ctl, psql). Δεν συνδέεται ποτέ
//  σε άλλη βάση. Έξοδος 1 σε κάθε αποτυχία.
// ═══════════════════════════════════════════════════════════════════════════
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const NEW = '20261005150000_i_monada_xreonetai_prin_ton_paroxo_kai_to_checkin_kleidonei.sql'
const KEEP = process.argv.includes('--keep')
const QUICK = process.argv.includes('--quick')
const N = 20

const pgRoot = '/usr/lib/postgresql'
const versions = existsSync(pgRoot) ? readdirSync(pgRoot).sort((a, b) => Number(a) - Number(b)) : []
if (!versions.length) { console.error('✗ Δεν βρέθηκε PostgreSQL. Εγκατέστησε postgresql-16.'); process.exit(1) }
const BIN = join(pgRoot, versions[versions.length - 1], 'bin')

// ── Ο ΠΡΟΣΩΡΙΝΟΣ ΔΙΑΚΟΜΙΣΤΗΣ ──────────────────────────────────────────────
const WORK = mkdtempSync(join(process.env.PIN_TEST_TMP || tmpdir(), 'ai-units-'))
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
runPg('pg_ctl', ['-D', PGDATA, '-l', join(PGDATA, 'log'), '-o', `-p ${PORT} -k ${WORK} -c listen_addresses='' -c max_connections=120 -c deadlock_timeout=100ms`, 'start'])

const CONN = ['-h', WORK, '-p', PORT, '-U', 'postgres', '-X']
const env = { ...process.env, PGOPTIONS: '' }
for (let i = 0; i < 30; i++) {
  if (spawnSync(`${BIN}/psql`, [...CONN, '-c', 'select 1'], { stdio: 'ignore' }).status === 0) break
  spawnSync('sleep', ['0.5'])
}
function q(db, sql) {
  const r = spawnSync(`${BIN}/psql`, [...CONN, '-d', db, '-v', 'ON_ERROR_STOP=1', '-q', '-At', '-F', '|', '-c', sql], { encoding: 'utf8', env })
  if (r.status !== 0) throw new Error(`SQL στο ${db}: ${sql}\n${r.stderr}`)
  return r.stdout.trim()
}
function qTry(db, sql) {
  const r = spawnSync(`${BIN}/psql`, [...CONN, '-d', db, '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-q', '-At', '-F', '|', '-c', sql], { encoding: 'utf8', env })
  return { ok: r.status === 0, out: r.stdout.trim(), err: r.stderr.trim() }
}
const num = (db, sql) => Number(q(db, sql) || 0)

// ── 1. ΟΙ ΜΕΤΑΝΑΣΤΕΥΣΕΙΣ, ΟΠΩΣ ΤΙΣ ΠΑΙΖΕΙ ΤΟ scripts/db-replay.sh ─────────
const MIG = join(WORK, 'mig')
mkdirSync(MIG)
const migrations = readdirSync(join(ROOT, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort()
if (!migrations.includes(NEW)) { console.error(`✗ Λείπει η ${NEW}`); process.exit(1) }
for (const f of migrations) {
  const src = readFileSync(join(ROOT, 'supabase/migrations', f), 'utf8')
    .replace(/^([ \t]*)(CREATE EXTENSION[^;\n]*"(pg_cron|pg_net|pg_stat_statements|supabase_vault)"[^;\n]*;)/gim, '$1-- [db-replay] $2')
  writeFileSync(join(MIG, f), src)
}
if (asRoot) spawnSync('chown', ['-R', 'postgres:postgres', MIG])
function replay(db, list) {
  q('postgres', `create database ${db}`)
  const stub = spawnSync(`${BIN}/psql`, [...CONN, '-d', db, '-v', 'ON_ERROR_STOP=1', '-q', '-f', join(ROOT, 'scripts/db/platform-stub.sql')], { encoding: 'utf8' })
  if (stub.status !== 0) throw new Error(`platform-stub: ${stub.stderr}`)
  for (const f of list) {
    const r = spawnSync(`${BIN}/psql`, [...CONN, '-d', db, '-v', 'ON_ERROR_STOP=1', '-q', '-f', join(MIG, f)], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`${db}: η ${f} δεν τρέχει\n${r.stderr.split('\n').filter(l => /ERROR|DETAIL/.test(l)).slice(0, 3).join('\n')}`)
  }
  // Ο χρήστης της συνεδρίας, όπως στο scripts/db/rls-probe.sql: η παλιά
  // `bump_*` διαβάζει `auth.uid()`.
  q(db, `create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('probe.uid', true), '')::uuid $$`)
}
const t0 = Date.now()
replay('before', migrations.filter(f => f !== NEW))
replay('after', migrations)
console.log(`✓ ${migrations.length - 1} μεταναστεύσεις στη before, ${migrations.length} στην after (${((Date.now() - t0) / 1000).toFixed(1)} s)`)
if (KEEP) console.log(`  psql -h ${WORK} -p ${PORT} -U postgres -d after`)

let failures = 0
function check(cond, label, detail = '') {
  if (cond) console.log(`  ✓ ${label}`)
  else { failures++; console.log(`  ✗ ${label}${detail ? `  (${detail})` : ''}`) }
}

// ── 2. ΔΕΔΟΜΕΝΑ ΔΟΚΙΜΗΣ ──────────────────────────────────────────────────
let seq = 0
/** Νέος χρήστης. `trial`: σε τοπική δοκιμή, χωρίς πληρωμή· `paid`: πληρώνει «Ιδιοκτήτης+»· `free`: βαθμός 0. */
function user(db, kind) {
  const id = `00000000-0000-4000-9000-${String(++seq).padStart(12, '0')}`
  q(db, `insert into auth.users(id, email) values ('${id}', 'ai-units-${seq}@example.test')`)
  const row = kind === 'paid' ? `'owner', now()` : kind === 'trial' ? `'free', null` : `'free', now()`
  q(db, `insert into billing_profiles(user_id, plan, trial_used_at) values ('${id}', ${row})
         on conflict (user_id) do update set plan = excluded.plan, trial_used_at = excluded.trial_used_at`)
  return id
}
const MON = `date_trunc('month', (now() at time zone 'Europe/Athens'))::date`
const pool = db => num(db, `select coalesce((select free_count from ai_budget where month = ${MON}), 0)`)
const setPool = (db, n) => q(db, `insert into ai_budget(month, free_count) values (${MON}, ${n}) on conflict (month) do update set free_count = ${n}`)
const aiMonth = (db, u) => num(db, `select coalesce((select month_count from ai_usage where user_id = '${u}'), 0)`)
const aiDay = (db, u) => num(db, `select coalesce((select day_count from ai_usage where user_id = '${u}'), 0)`)
const scans = (db, u) => num(db, `select coalesce((select month_count from scan_usage where user_id = '${u}'), 0)`)
const reqs = (db, u) => db === 'after' ? num(db, `select count(*) from ai_usage_requests where user_id = '${u}'`) : 0

// ── 3. ΤΑΥΤΟΧΡΟΝΕΣ ΣΥΝΔΕΣΕΙΣ ────────────────────────────────────────────────
function psqlAsync(db, script) {
  const p = spawn(`${BIN}/psql`, [...CONN, '-d', db, '-q', '-At', '-v', 'VERBOSITY=verbose', '-f', '-'], { env })
  let out = '', err = ''
  p.stdout.on('data', d => { out += d })
  p.stderr.on('data', d => { err += d })
  const done = new Promise(res => p.on('close', code => res({ code, out, err })))
  if (script) p.stdin.end(script)
  return { p, done }
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function waitFor(db, sql, want, label) {
  for (let i = 0; i < 400; i++) {
    if (q(db, sql) === String(want)) return
    await sleep(25)
  }
  throw new Error(`χρονικό όριο: ${label}`)
}
let advKey = 9100
/**
 * Όλες ξεκινούν μαζί, όπως στο test-portal-pin-concurrency.mjs. Κάθε κλήση
 * είναι `{ sql, role, uid }`· επιστρέφει 'R|<json ή boolean>' ή σφάλμα.
 */
async function race(db, iso, calls) {
  const key = ++advKey
  const holder = psqlAsync(db, '')
  holder.p.stdin.write(`select pg_advisory_lock(${key});\n`)
  await waitFor(db, `select count(*) from pg_locks where locktype = 'advisory' and objid = ${key} and granted`, 1, 'ελεγκτής')
  const workers = calls.map(({ sql, role, uid }) => psqlAsync(db, `begin isolation level ${iso};
${role ? `set local role ${role};` : ''}
${uid ? `set local "probe.uid" = '${uid}';` : ''}
select pg_advisory_lock_shared(${key});
select pg_advisory_unlock_shared(${key});
select 'R|' || coalesce((${sql})::text, 'null');
commit;
`))
  await waitFor(db, `select count(*) from pg_locks where locktype = 'advisory' and objid = ${key} and not granted`, calls.length, 'συνδέσεις σε αναμονή')
  holder.p.stdin.end(`select pg_advisory_unlock(${key});\n`)
  await holder.done
  const res = await Promise.all(workers.map(w => w.done))
  const tally = { allowed: 0, denied: 0, serialization: 0, deadlock: 0, other: 0, reasons: {}, values: [] }
  for (const { out, err } of res) {
    const line = out.split('\n').find(l => l.startsWith('R|'))
    if (/40P01/.test(err)) { tally.deadlock++; continue }
    if (/40001/.test(err)) { tally.serialization++; continue }
    if (!line) { tally.other++; tally.values.push(err.split('\n')[0]); continue }
    const v = line.slice(2)
    tally.values.push(v)
    let allowed = v === 'true'
    if (v.startsWith('{')) {
      const j = JSON.parse(v)
      allowed = j.allowed === true || j.refunded === true
      if (!allowed) tally.reasons[j.reason] = (tally.reasons[j.reason] || 0) + 1
    }
    if (allowed) tally.allowed++; else tally.denied++
  }
  return tally
}
const ISO = QUICK ? ['read committed'] : ['read committed', 'repeatable read', 'serializable']
const uuid = () => crypto.randomUUID()
const OLD_AI = `public.bump_ai_usage(200, array[0,10,20,50,150], array[0,30,60,150,500], 2000, 7, 20, 30, 30)`

async function main() {
  // ── 4α. ΔΟΚΙΜΗ: ΕΙΚΟΣΙ ΜΑΖΙ ΜΕ ΟΡΙΟ ΗΜΕΡΑΣ ΕΠΤΑ ───────────────────────────
  const TRIAL_DAY = num('after', `select (ai_plan_limits()->>'trial_day')::int`)
  console.log(`\n▶ Λογαριασμός σε δοκιμή, ${N} ερωτήσεις μαζί, όριο ημέρας ${TRIAL_DAY}`)
  console.log('  βάση    επίπεδο          δεκτές  αρνήσεις  40001  ημέρα  μήνας  δεξαμενή+  αιτήματα')
  for (const db of ['before', 'after']) {
    for (const iso of ISO) {
      const u = user(db, 'trial')
      setPool(db, 0)
      const calls = Array.from({ length: N }, () => db === 'after'
        ? { sql: `public.take_ai_unit('${u}', '${uuid()}')` }
        : { sql: OLD_AI, uid: u })
      const r = await race(db, iso, calls)
      const d = aiDay(db, u), m = aiMonth(db, u), p = pool(db), n = reqs(db, u)
      console.log(`  ${db.padEnd(7)} ${iso.padEnd(16)} ${String(r.allowed).padStart(6)}  ${String(r.denied).padStart(8)}  ${String(r.serialization).padStart(5)}  ${String(d).padStart(5)}  ${String(m).padStart(5)}  ${String(p).padStart(9)}  ${String(n).padStart(8)}`)
      if (db === 'before' && iso === 'read committed') {
        check(d > TRIAL_DAY && p > TRIAL_DAY, 'ΠΡΙΝ: οι αρνήσεις γράφουν μετρητή και δεξαμενή (το σφάλμα αναπαράγεται)', `ημέρα ${d}, δεξαμενή ${p}`)
      }
      if (db === 'after') {
        const exact = iso === 'read committed' ? r.allowed === TRIAL_DAY : r.allowed <= TRIAL_DAY
        check(exact && d === r.allowed && m === r.allowed && p === r.allowed && n === r.allowed && r.other + r.deadlock === 0,
          `ΜΕΤΑ, ${iso}: ${iso === 'read committed' ? `ακριβώς ${TRIAL_DAY}` : `όχι πάνω από ${TRIAL_DAY}`}, δεξαμενή +${r.allowed}, οι αρνήσεις χωρίς εγγραφή`,
          `δεκτές ${r.allowed}, ημέρα ${d}, μήνας ${m}, δεξαμενή ${p}, αιτήματα ${n}, άλλο ${r.values.filter(v => !v.startsWith('{')).slice(0, 1)}`)
      }
    }
  }

  // ── 4β. Η ΔΕΞΑΜΕΝΗ: ΕΙΚΟΣΙ ΧΡΗΣΤΕΣ, ΤΡΕΙΣ ΘΕΣΕΙΣ ──────────────────────────
  const LPOOL = num('after', `select (ai_plan_limits()->>'pool')::int`)
  console.log(`\n▶ Δεξαμενή στο ${LPOOL - 3} από ${LPOOL}: ${N} λογαριασμοί σε δοκιμή ρωτούν μαζί`)
  for (const db of ['before', 'after']) {
    for (const iso of ISO) {
      const us = Array.from({ length: N }, () => user(db, 'trial'))
      setPool(db, LPOOL - 3)
      const r = await race(db, iso, us.map(u => db === 'after'
        ? { sql: `public.take_ai_unit('${u}', '${uuid()}')` }
        : { sql: OLD_AI, uid: u }))
      const p = pool(db)
      const users = num(db, `select count(*) from ai_usage where user_id in (${us.map(u => `'${u}'`).join(',')}) and month_count > 0`)
      console.log(`  ${db.padEnd(7)} ${iso.padEnd(16)} δεκτές ${r.allowed}, αρνήσεις ${JSON.stringify(r.reasons)}, 40001 ${r.serialization}, δεξαμενή ${p}, χρήστες με μετρητή ${users}`)
      if (db === 'before' && iso === 'read committed') check(p > LPOOL, 'ΠΡΙΝ: η δεξαμενή ξεπερνά το ταβάνι με κλήσεις που αρνήθηκαν', String(p))
      if (db === 'after') {
        const exact = iso === 'read committed' ? r.allowed === 3 && p === LPOOL : r.allowed <= 3 && p === LPOOL - 3 + r.allowed
        check(exact && users === r.allowed && r.other + r.deadlock === 0,
          `ΜΕΤΑ, ${iso}: ${iso === 'read committed' ? 'ακριβώς τρεις' : 'όχι πάνω από τρεις'}, η δεξαμενή σταματά στο ${LPOOL}`, `δεκτές ${r.allowed}, δεξαμενή ${p}, χρήστες ${users}`)
      }
    }
  }

  // ── 4γ. ΠΛΗΡΩΜΕΝΟΣ: ΕΡΩΤΗΣΕΙΣ ΔΕΝ ΓΙΝΟΝΤΑΙ ΣΑΡΩΣΕΙΣ ────────────────────────
  // Το ποιος μετρητής κρίνεται στη διαδρομή (lib/billing/aiUnits.ts
  // `meterKind`, χωρίς αρχείο → AI, ό,τι κι αν λέει το `kind`). Εδώ: ό,τι
  // στέλνει η διαδρομή για ερώτηση χρεώνει μόνο τον μετρητή της Νόας.
  console.log(`\n▶ Πληρωμένος λογαριασμός: ${N} ερωτήσεις μαζί, μετά πέντε σαρώσεις με διαφορετικά αρχεία`)
  for (const iso of ISO) {
    const u = user('after', 'paid')
    const ra = await race('after', iso, Array.from({ length: N }, () => ({ sql: `public.take_ai_unit('${u}', '${uuid()}')` })))
    const a1 = aiMonth('after', u), s1 = scans('after', u)
    const rs = await race('after', iso, Array.from({ length: 5 }, (_, i) => ({ sql: `public.take_scan_unit('${u}', '${uuid()}', '${iso.replace(/ /g, '')}-${i}')` })))
    const a2 = aiMonth('after', u), s2 = scans('after', u)
    console.log(`  after   ${iso.padEnd(16)} ερωτήσεις: δεκτές ${ra.allowed}, Νόα ${a1}, σαρώσεις ${s1} · σαρώσεις: δεκτές ${rs.allowed}, Νόα ${a2}, σαρώσεις ${s2}`)
    check(a1 === ra.allowed && s1 === 0 && (iso !== 'read committed' || a1 === N), `ΜΕΤΑ, ${iso}: ${N} ερωτήσεις χρεώνουν μόνο τη Νόα, καμία σάρωση`, `Νόα ${a1}, σαρώσεις ${s1}`)
    check(s2 === rs.allowed && a2 === a1, `ΜΕΤΑ, ${iso}: οι σαρώσεις χρεώνουν μόνο τον μετρητή σαρώσεων`, `σαρώσεις ${s2}, Νόα ${a2}`)
  }

  // ── 4δ. ΔΩΡΕΑΝ: ΠΕΝΤΕ ΣΑΡΩΣΕΙΣ ΑΠΟ ΕΙΚΟΣΙ ────────────────────────────────
  const FREE_SCANS = num('after', `select (ai_plan_limits()->'scan'->>0)::int`)
  console.log(`\n▶ Δωρεάν «Ιδιοκτήτης»: ${N} σαρώσεις μαζί, όριο ${FREE_SCANS}`)
  for (const iso of ISO) {
    const u = user('after', 'free')
    const r = await race('after', iso, Array.from({ length: N }, (_, i) => ({ sql: `public.take_scan_unit('${u}', '${uuid()}', 'f-${i}')` })))
    const s = scans('after', u), n = reqs('after', u)
    console.log(`  after   ${iso.padEnd(16)} δεκτές ${r.allowed}, αρνήσεις ${JSON.stringify(r.reasons)}, 40001 ${r.serialization}, σαρώσεις ${s}, αιτήματα ${n}`)
    const exact = iso === 'read committed' ? r.allowed === FREE_SCANS : r.allowed <= FREE_SCANS
    check(exact && s === r.allowed && n === r.allowed && r.other === 0, `ΜΕΤΑ, ${iso}: ${iso === 'read committed' ? `ακριβώς ${FREE_SCANS}` : `όχι πάνω από ${FREE_SCANS}`}, οι αρνήσεις χωρίς εγγραφή`)
  }

  // ── 4ε. ΤΟ ΙΔΙΟ ΑΡΧΕΙΟ, ΕΙΚΟΣΙ ΦΟΡΕΣ ΜΑΖΙ ─────────────────────────────────
  console.log(`\n▶ Το ίδιο αρχείο: μία σάρωση χρεώθηκε, μετά ${N} μαζί με το ίδιο αποτύπωμα`)
  for (const iso of ISO) {
    const u = user('after', 'paid')
    q('after', `select public.take_scan_unit('${u}', '${uuid()}', 'same')`)
    const r = await race('after', iso, Array.from({ length: N }, () => ({ sql: `public.take_scan_unit('${u}', '${uuid()}', 'same')` })))
    const reused = r.values.filter(v => v.startsWith('{') && JSON.parse(v).reuse === true).length
    // Κάθε σάρωση που χρεώθηκε μέσα στον αγώνα γίνεται κι αυτή βάση για το
    // αρχείο: το μέτρο είναι ανά χρέωση, όχι ανά αρχείο.
    const [maxPer, sumPer, charged] = q('after', `select coalesce(max(reuses), 0), coalesce(sum(reuses), 0), count(*) from ai_usage_requests
      where user_id = '${u}' and file_hash = 'same' and reuse_of is null`).split('|').map(Number)
    const rows = num('after', `select count(*) from ai_usage_requests where user_id = '${u}' and reuse_of is not null`)
    console.log(`  after   ${iso.padEnd(16)} επαναχρήσεις ${reused}, χρεώσεις ${charged}, μέγιστο ανά χρέωση ${maxPer}, σαρώσεις ${scans('after', u)}, 40001 ${r.serialization}`)
    check(maxPer <= 2 && sumPer === reused && rows === reused && charged === scans('after', u) && (iso !== 'read committed' || reused >= 2),
      `ΜΕΤΑ, ${iso}: το πολύ τρεις χρήσεις ανά χρέωση και καμία επανάχρηση χωρίς ίχνος`, `${reused} / ${sumPer} / ${maxPer}`)
  }

  // ── 4στ. Η ΕΠΙΣΤΡΟΦΗ, ΕΙΚΟΣΙ ΦΟΡΕΣ ΜΑΖΙ ΓΙΑ ΤΟ ΙΔΙΟ ΚΛΕΙΔΙ ─────────────────
  console.log(`\n▶ ${N} επιστροφές μαζί για το ίδιο αίτημα`)
  for (const iso of ISO) {
    const u = user('after', 'trial')
    setPool('after', 0)
    const rid = uuid()
    q('after', `select public.take_ai_unit('${u}', '${rid}')`)
    q('after', `select public.take_ai_unit('${u}', '${uuid()}')`)
    const r = await race('after', iso, Array.from({ length: N }, () => ({ sql: `public.refund_ai_unit('${u}', '${rid}', true)` })))
    console.log(`  after   ${iso.padEnd(16)} επιστράφηκαν ${r.allowed}, αρνήσεις ${JSON.stringify(r.reasons)}, 40001 ${r.serialization}, Νόα ${aiMonth('after', u)}, δεξαμενή ${pool('after')}`)
    check(r.allowed === 1 && aiMonth('after', u) === 1 && pool('after') === 1 && r.other === 0, `ΜΕΤΑ, ${iso}: ακριβώς μία επιστροφή, οι άλλες no-op`)
  }

  // ── 4ζ. CHECK-IN: ΕΙΚΟΣΙ ΜΑΖΙ, ΤΑΒΑΝΙ ΤΡΙΑ ────────────────────────────────
  console.log(`\n▶ ${N} υποβολές check-in μαζί (ταβάνι τρεις την ώρα), ως anon`)
  console.log('  βάση    επίπεδο          guest_checkins  checkin:  δεκτές  40001  άλλο')
  for (const db of ['before', 'after']) {
    for (const iso of ISO) {
      const o = user(db, 'free')
      const tok = `ck${++seq}`
      q(db, `insert into checkin_links(token, user_id, active, expires_at) values ('${tok}', '${o}', true, now() + interval '7 days')`)
      const sql = `public.submit_checkin('${tok}', 'Επισκέπτης', 'AB1', 'GR', '1990-01-01', '69', 'g@x.gr', '2026-10-10', 2, true, true)`
      const r = await race(db, iso, Array.from({ length: N }, () => ({ sql, role: 'anon' })))
      const g = num(db, `select count(*) from guest_checkins where token = '${tok}'`)
      const a = num(db, `select count(*) from portal_pin_attempts where token = 'checkin:${tok}'`)
      console.log(`  ${db.padEnd(7)} ${iso.padEnd(16)} ${String(g).padStart(14)}  ${String(a).padStart(8)}  ${String(r.allowed).padStart(6)}  ${String(r.serialization).padStart(5)}  ${r.other + r.deadlock}`)
      if (db === 'before' && iso === 'read committed') check(g > 3, 'ΠΡΙΝ: το ταβάνι του check-in ξεπερνιέται', String(g))
      if (db === 'after') {
        const exact = iso === 'read committed' ? g === 3 && a === 3 && r.allowed === 3 : g <= 3 && a === g && r.allowed === g
        check(exact && r.other + r.deadlock === 0, `ΜΕΤΑ, ${iso}: ${iso === 'read committed' ? 'ακριβώς τρία' : 'όχι πάνω από τρία'} check-in και τρεις γραμμές checkin:`, `${g} / ${a} / ${r.allowed}`)
      }
    }
  }

  // ── 5. ΔΙΚΑΙΩΜΑΤΑ ────────────────────────────────────────────────────────
  console.log('\n▶ Δικαιώματα')
  const u = user('after', 'paid')
  for (const role of ['anon', 'authenticated']) {
    for (const sql of [`public.take_ai_unit('${u}', '${uuid()}')`, `public.take_scan_unit('${u}', '${uuid()}', null)`,
      `public.refund_ai_unit('${u}', '${uuid()}', true)`, `public.allow_public_submit('checkin', 'x', 3, interval '1 hour')`]) {
      const r = qTry('after', `set role ${role}; select ${sql}`)
      check(!r.ok && /42501/.test(r.err), `${role}: ${sql.split('(')[0]} → 42501`)
    }
  }
  const sigs = q('after', `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'bump_ai_usage'`)
  console.log(`  · υπογραφές bump_ai_usage στην τελική βάση: ${sigs} (μεταβατικές· φεύγουν σε επόμενη αλλαγή)`)

  console.log(failures ? `\n🔴 ${failures} αποτυχίες` : '\n🟢 όλα κρατούν')
  process.exit(failures ? 1 : 0)
}

main().catch(err => { console.error(err); process.exit(1) })
