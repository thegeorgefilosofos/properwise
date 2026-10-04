#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  ΤΟ ΚΛΕΙΔΩΜΑ ΤΗΣ ΠΥΛΗΣ ΚΑΤΩ ΑΠΟ ΤΑΥΤΟΧΡΟΝΕΣ ΚΛΗΣΕΙΣ, ΣΕ ΠΡΑΓΜΑΤΙΚΟ POSTGRES
// ─────────────────────────────────────────────────────────────────────────
//  Η `portal_pin_gate` μετρούσε αποτυχίες, έλεγχε κωδικό και έγραφε χωρίς
//  σειρά: οκτώ λάθος κωδικοί μαζί, πάνω σε τέσσερις αποτυχίες, άφηναν δώδεκα
//  (όριο πέντε). Η 20261004090000 κλειδώνει τη γραμμή του συνδέσμου. Αυτό το
//  σενάριο το αποδεικνύει ΠΡΙΝ και ΜΕΤΑ, όχι με ομοιώματα:
//
//    · στήνει δικό του Postgres σε προσωρινό φάκελο, με δική του πόρτα και
//      πρίζα (ποτέ κοινό) και το σβήνει στο τέλος·
//    · παίζει ΟΛΕΣ τις μεταναστεύσεις με τον τρόπο του scripts/db-replay.sh
//      (ίδια σκαλωσιά scripts/db/platform-stub.sql, ίδια σχολίαση των
//      επεκτάσεων της πλατφόρμας) σε δύο βάσεις: `before` χωρίς τη νέα
//      μετανάστευση, `after` με όλες·
//    · ανοίγει ξεχωριστές συνδέσεις psql που περιμένουν σε advisory lock και
//      ξεκινούν ΜΑΖΙ, σε READ COMMITTED, REPEATABLE READ και SERIALIZABLE·
//    · ελέγχει τη συμπεριφορά (λάθος, σωστός, κενός κωδικός, σύνδεσμος που
//      έληξε, ανενεργός, ανύπαρκτος, κοινό όριο ανάγνωσης και εγγραφών,
//      ανεξάρτητοι σύνδεσμοι), τα δικαιώματα και το σκούπισμα·
//    · τρέχει pgbench με σκούπισμα, λάθος και σωστό κωδικό μαζί και μετρά
//      αδιέξοδα και καθυστέρηση.
//
//  ΧΡΗΣΗ:  node scripts/test-portal-pin-concurrency.mjs [--keep] [--quick]
//  Απαιτεί: postgresql-16 τοπικά (initdb, pg_ctl, psql, pgbench). Δεν
//  συνδέεται ποτέ σε άλλη βάση. Έξοδος 1 σε κάθε αποτυχία.
// ═══════════════════════════════════════════════════════════════════════════
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// Οι δύο μεταναστεύσεις της διόρθωσης. `before` = καμία, `mid` = μόνο η
// πρώτη (η 401a917, που έτρεξε ήδη στο staging), `after` = όλες.
const FIRST = '20261004090000_to_kleidoma_tis_pylis_metra_ena_ena.sql'
const NEW = '20261004100000_to_kleidoma_akolouthei_to_kouponi_kai_ta_tavania.sql'
const KEEP = process.argv.includes('--keep')
const QUICK = process.argv.includes('--quick')
const TRIALS = QUICK ? 2 : 5

const pgRoot = '/usr/lib/postgresql'
const versions = existsSync(pgRoot) ? readdirSync(pgRoot).sort((a, b) => Number(a) - Number(b)) : []
if (!versions.length) { console.error('✗ Δεν βρέθηκε PostgreSQL. Εγκατέστησε postgresql-16.'); process.exit(1) }
const BIN = join(pgRoot, versions[versions.length - 1], 'bin')

// ── Ο ΠΡΟΣΩΡΙΝΟΣ ΔΙΑΚΟΜΙΣΤΗΣ ──────────────────────────────────────────────
const WORK = mkdtempSync(join(process.env.PIN_TEST_TMP || tmpdir(), 'pin-race-'))
const PGDATA = join(WORK, 'pgdata')
const PORT = String(20000 + Math.floor(Math.random() * 20000))
const asRoot = process.getuid && process.getuid() === 0 &&
  spawnSync('id', ['postgres'], { stdio: 'ignore' }).status === 0

// Χωρίς κέλυφος: το πρόγραμμα και τα ορίσματα περνούν ως λίστα, οπότε μια
// διαδρομή με κενό ή ειδικό χαρακτήρα δεν γίνεται ποτέ εντολή. Ως root το
// postgres τρέχει με το uid/gid του χρήστη postgres αντί για `su -c`.
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
  if (!KEEP) rmSync(WORK, { recursive: true, force: true })
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

/** Μία εντολή, αποτέλεσμα ως κείμενο. Σφάλμα SQL = εξαίρεση. */
function q(db, sql) {
  const r = spawnSync(`${BIN}/psql`, [...CONN, '-d', db, '-v', 'ON_ERROR_STOP=1', '-q', '-At', '-F', '|', '-c', sql], { encoding: 'utf8', env })
  if (r.status !== 0) throw new Error(`SQL στο ${db}: ${sql}\n${r.stderr}`)
  return r.stdout.trim()
}
/** Ίδιο, αλλά επιστρέφει και το σφάλμα αντί να πετάξει. */
function qTry(db, sql) {
  const r = spawnSync(`${BIN}/psql`, [...CONN, '-d', db, '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-q', '-At', '-F', '|', '-c', sql], { encoding: 'utf8', env })
  return { ok: r.status === 0, out: r.stdout.trim(), err: r.stderr.trim() }
}

// ── 1. ΟΙ ΜΕΤΑΝΑΣΤΕΥΣΕΙΣ, ΟΠΩΣ ΤΙΣ ΠΑΙΖΕΙ ΤΟ scripts/db-replay.sh ─────────
const MIG = join(WORK, 'mig')
mkdirSync(MIG)
const migrations = readdirSync(join(ROOT, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort()
for (const f of [FIRST, NEW]) if (!migrations.includes(f)) { console.error(`✗ Λείπει η ${f}`); process.exit(1) }
for (const f of migrations) {
  // Ίδια αντικατάσταση με το sed του db-replay.sh: οι τέσσερις επεκτάσεις της
  // πλατφόρμας δεν υπάρχουν εδώ ως .so· τα σχήματά τους τα στήνει η σκαλωσιά.
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
}

const t0 = Date.now()
replay('before', migrations.filter(f => f !== FIRST && f !== NEW))
replay('mid', migrations.filter(f => f !== NEW))
replay('after', migrations)
console.log(`✓ ${migrations.length - 2} μεταναστεύσεις στη before, ${migrations.length - 1} στη mid, ${migrations.length} στην after (${((Date.now() - t0) / 1000).toFixed(1)} s)`)
if (KEEP) console.log(`  psql -h ${WORK} -p ${PORT} -U postgres -d after`)

// ── ΑΠΟΤΕΛΕΣΜΑΤΑ ───────────────────────────────────────────────────────────
let failures = 0
function check(cond, label, detail = '') {
  if (cond) console.log(`  ✓ ${label}`)
  else { failures++; console.log(`  ✗ ${label}${detail ? `  (${detail})` : ''}`) }
}

// ── 2. ΔΕΔΟΜΕΝΑ ΔΟΚΙΜΗΣ ──────────────────────────────────────────────────
// Ένας ιδιοκτήτης ανά σύνδεσμο: το δωρεάν πακέτο κόβει στα τρία ακίνητα
// (enforce_property_limit) και ο σύνδεσμος είναι μοναδικός ανά ακίνητο.
const PIN = '1234'
let linkSeq = 0
/** Νέος σύνδεσμος πύλης· επιστρέφει το token. */
function link(db, { pin = PIN, active = true, expired = false, token } = {}) {
  ++linkSeq
  token = token || `race${String(linkSeq).padStart(4, '0')}`
  const id = `00000000-0000-4000-8000-${String(linkSeq).padStart(12, '0')}`
  q(db, `
    insert into auth.users(id, email) values ('${id}', 'pin-race-${linkSeq}@example.test');
    insert into user_properties(id, user_id, name) values ('${id}', '${id}', 'Δοκιμή ${linkSeq}');
    insert into portal_links(token, property_id, user_id, active, expires_at, pin_hash)
    values ('${token}', '${id}', '${id}', ${active},
            ${expired ? "now() - interval '1 minute'" : "now() + interval '30 days'"},
            ${pin === null ? 'null' : `crypt('${pin}', gen_salt('bf'))`})`)
  return token
}
const fails = (db, token) => Number(q(db, `select count(*) from portal_pin_attempts where token = '${token}' and success = false and attempted_at > now() - interval '15 minutes'`))
const seed = (db, token, n) => q(db, `delete from portal_pin_attempts where token in ('${token}', 'declare:${token}', 'maint:${token}', 'photo:${token}');
  insert into portal_pin_attempts(token, success) select '${token}', false from generate_series(1, ${n})`)

const ISO = ['read committed', 'repeatable read', 'serializable']
const PAY = '00000000-0000-4000-8000-00000000ffff'
const CALL = {
  read: (t, pin) => `public.get_portal_data('${t}', ${pin === null ? 'null' : `'${pin}'`})`,
  declare: (t, pin) => `public.declare_rent_payment('${t}', '${PAY}', 'x', ${pin === null ? 'null' : `'${pin}'`})`,
  maint: (t, pin) => `public.submit_maintenance_request('${t}', 'Βλάβη', 'd', 'c', '[]'::jsonb, ${pin === null ? 'null' : `'${pin}'`})`,
}

// ── 3. ΤΑΥΤΟΧΡΟΝΕΣ ΣΥΝΔΕΣΕΙΣ ────────────────────────────────────────────────
/** psql σε δική του σύνδεση· το σενάριο δίνεται από stdin. */
function psqlAsync(db, script, extraEnv = {}) {
  const p = spawn(`${BIN}/psql`, [...CONN, '-d', db, '-q', '-At', '-v', 'VERBOSITY=verbose', '-f', '-'], { env: { ...env, ...extraEnv } })
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
let advKey = 7000

/** Τι απάντησε μία σύνδεση. 'checked' = ο κωδικός ελέγχθηκε και ήταν λάθος. */
function classify(kind, { out, err }) {
  const line = out.split('\n').find(l => l.startsWith('R|'))
  if (/40P01/.test(err)) return 'deadlock'
  if (/40001/.test(err)) return 'serialization'
  if (/portal_locked/.test(err)) return 'locked'
  if (/portal_rate_limited/.test(err)) return 'capped'
  if (!line) return 'other'
  const v = line.slice(2)
  if (kind === 'read') {
    if (v === 'null') return 'notfound'
    if (v.includes('"rate_limited"')) return 'locked'
    if (v === '{"locked" : true}') return 'checked'
    return 'ok'
  }
  if (v === 'null') return 'checked'
  return v === 'true' || v === 'false' ? 'ok' : 'other'
}

/**
 * Όλες οι κλήσεις ξεκινούν μαζί: κάθε σύνδεση ανοίγει συναλλαγή στο επίπεδο
 * που ζητήθηκε, παίρνει τη φωτογραφία της (REPEATABLE READ, SERIALIZABLE) και
 * περιμένει σε advisory lock που κρατά ο ελεγκτής. Όταν περιμένουν ΟΛΕΣ, ο
 * ελεγκτής αφήνει το lock.
 */
async function race(db, iso, calls) {
  const key = ++advKey
  const holder = psqlAsync(db, '')
  holder.p.stdin.write(`select pg_advisory_lock(${key});\n`)
  await waitFor(db, `select count(*) from pg_locks where locktype = 'advisory' and objid = ${key} and granted`, 1, 'ελεγκτής')
  const workers = calls.map(({ kind, token, pin }) => ({
    kind,
    run: psqlAsync(db, `begin isolation level ${iso};
set local role anon;
select pg_advisory_lock_shared(${key});
select pg_advisory_unlock_shared(${key});
select 'R|' || coalesce((${CALL[kind](token, pin)})::text, 'null');
commit;
`),
  }))
  await waitFor(db, `select count(*) from pg_locks where locktype = 'advisory' and objid = ${key} and not granted`, calls.length, 'σύνδεσεις σε αναμονή')
  const started = Date.now()
  holder.p.stdin.end(`select pg_advisory_unlock(${key});\n`)
  await holder.done
  const res = await Promise.all(workers.map(async w => classify(w.kind, await w.run.done)))
  const ms = Date.now() - started
  const tally = { checked: 0, locked: 0, capped: 0, serialization: 0, deadlock: 0, ok: 0, notfound: 0, other: 0 }
  for (const r of res) tally[r]++
  return { tally, res, ms }
}

const fmt = a => (Math.min(...a) === Math.max(...a) ? `${a[0]}` : `${Math.min(...a)}–${Math.max(...a)}`)

async function main() {
  // ── 3α. Ο ΠΙΝΑΚΑΣ ΠΡΙΝ / ΜΕΤΑ ─────────────────────────────────────────────
  console.log(`\n▶ Τέσσερις αποτυχίες και οκτώ λάθος κωδικοί μαζί (get_portal_data ως anon), ${TRIALS} επαναλήψεις`)
  console.log('  βάση    επίπεδο          αποθηκευμένες  ελέγχθηκαν  κλειδωμένες  40001  ms')
  const matrix = {}
  for (const db of ['before', 'after']) {
    for (const iso of ISO) {
      const stored = [], checked = [], locked = [], ser = [], ms = [], other = []
      for (let i = 0; i < TRIALS; i++) {
        const t = link(db)
        seed(db, t, 4)
        const r = await race(db, iso, Array.from({ length: 8 }, () => ({ kind: 'read', token: t, pin: '0000' })))
        stored.push(fails(db, t)); checked.push(r.tally.checked); locked.push(r.tally.locked)
        ser.push(r.tally.serialization); ms.push(r.ms); other.push(r.tally.other + r.tally.deadlock + r.tally.ok + r.tally.notfound)
      }
      matrix[`${db}/${iso}`] = { stored, checked, other }
      console.log(`  ${db.padEnd(7)} ${iso.padEnd(16)} ${fmt(stored).padStart(13)}  ${fmt(checked).padStart(10)}  ${fmt(locked).padStart(11)}  ${fmt(ser).padStart(5)}  ${fmt(ms)}`)
    }
  }
  check(Math.max(...matrix['before/read committed'].stored) > 5, 'ΠΡΙΝ, READ COMMITTED: το σφάλμα αναπαράγεται (πάνω από πέντε)',
    `αποθηκευμένες ${fmt(matrix['before/read committed'].stored)}`)
  for (const iso of ISO) {
    const m = matrix[`after/${iso}`]
    check(m.stored.every(n => n === 5), `ΜΕΤΑ, ${iso}: ακριβώς πέντε σε κάθε επανάληψη`, `αποθηκευμένες ${fmt(m.stored)}`)
    check(m.checked.every(n => n === 1), `ΜΕΤΑ, ${iso}: ελέγχθηκε ένας κωδικός, όχι οκτώ`, `ελέγχθηκαν ${fmt(m.checked)}`)
    check(m.other.every(n => n === 0), `ΜΕΤΑ, ${iso}: καμία απρόσμενη απάντηση`, `${fmt(m.other)}`)
  }

  // ── 3β. Πίεση: τριάντα δύο μαζί από το μηδέν ─────────────────────────────
  console.log('\n▶ Τριάντα δύο λάθος κωδικοί μαζί, από μηδέν αποτυχίες')
  for (const db of ['before', 'after']) {
    for (const iso of ISO) {
      const t = link(db)
      seed(db, t, 0)
      const r = await race(db, iso, Array.from({ length: 32 }, () => ({ kind: 'read', token: t, pin: '0000' })))
      const n = fails(db, t)
      console.log(`  ${db.padEnd(7)} ${iso.padEnd(16)} αποθηκευμένες ${n}, ελέγχθηκαν ${r.tally.checked}, κλειδωμένες ${r.tally.locked}, 40001 ${r.tally.serialization}, ${r.ms} ms`)
      if (db === 'after') check(n <= 5 && r.tally.checked <= 5, `ΜΕΤΑ, ${iso}: δεν ξεπερνά τις πέντε`, `${n} / ${r.tally.checked}`)
    }
  }

  // ── 3γ. Κοινό όριο: ανάγνωση και δήλωση πληρωμής μαζί ─────────────────────
  console.log('\n▶ Κοινό όριο: δύο αποτυχίες, μετά τέσσερις αναγνώσεις και τέσσερις δηλώσεις μαζί')
  for (const db of ['before', 'after']) {
    for (const iso of ISO) {
      const t = link(db)
      seed(db, t, 2)
      const calls = [...Array.from({ length: 4 }, () => ({ kind: 'read', token: t, pin: '0000' })),
        ...Array.from({ length: 4 }, () => ({ kind: 'declare', token: t, pin: '0000' }))]
      const r = await race(db, iso, calls)
      const n = fails(db, t)
      console.log(`  ${db.padEnd(7)} ${iso.padEnd(16)} αποθηκευμένες ${n}, ελέγχθηκαν ${r.tally.checked}, κλειδωμένες ${r.tally.locked}, 40001 ${r.tally.serialization}, άλλο ${r.tally.other}`)
      // READ COMMITTED: ακριβώς τρεις ακόμη έλεγχοι ως το πέντε. REPEATABLE READ
      // και SERIALIZABLE: όσες περίμεναν με παλιά φωτογραφία παίρνουν 40001.
      const exact = iso === 'read committed' ? n === 5 && r.tally.checked === 3 : r.tally.checked >= 1
      if (db === 'after') check(n <= 5 && exact && r.tally.other === 0 && r.tally.checked + r.tally.locked + r.tally.serialization === 8,
        `ΜΕΤΑ, ${iso}: ανάγνωση και εγγραφή μοιράζονται τις πέντε`, `${n} / ${r.tally.checked}`)
    }
  }

  // ── 3δ. Ο σωστός κωδικός περνά μετά από ταυτόχρονους λάθος ────────────────
  console.log('\n▶ Τέσσερις λάθος και ένας σωστός μαζί, από μηδέν αποτυχίες')
  for (const iso of ISO) {
    const t = link('after')
    seed('after', t, 0)
    const calls = [...Array.from({ length: 4 }, () => ({ kind: 'read', token: t, pin: '0000' })), { kind: 'read', token: t, pin: PIN }]
    const r = await race('after', iso, calls)
    const correct = r.res[4]
    const n = fails('after', t)
    const again = qTry('after', `select (${CALL.read(t, PIN)})::text`).out
    const nAfter = fails('after', t)
    console.log(`  after   ${iso.padEnd(16)} ο σωστός: ${correct}, αποθηκευμένες ${n}, 40001 ${r.tally.serialization}`)
    check(n <= 4 && !correct.startsWith('locked') && !again.includes('"locked"') && nAfter === 0,
      `ΜΕΤΑ, ${iso}: κανένα κλείδωμα κάτω από το όριο· ο σωστός κωδικός μπαίνει και καθαρίζει`, `σωστός ${correct}, μετά ${again.slice(0, 30)}, ${nAfter}`)
    if (iso === 'read committed') check(correct === 'ok', 'ΜΕΤΑ, read committed: ο σωστός μπαίνει ΚΑΙ μέσα στον αγώνα')
  }

  // ── 3ε. Ανεξάρτητοι σύνδεσμοι ─────────────────────────────────────────────
  console.log('\n▶ Ανεξάρτητοι σύνδεσμοι')
  {
    const a = link('after'), b = link('after'), c = link('after')
    seed('after', a, 4); seed('after', b, 0); seed('after', c, 0)
    const calls = [...Array.from({ length: 8 }, () => ({ kind: 'read', token: a, pin: '0000' })),
      ...Array.from({ length: 8 }, () => ({ kind: 'read', token: b, pin: '0000' }))]
    await race('after', 'read committed', calls)
    const okC = q('after', `select (${CALL.read(c, PIN)})::text`)
    check(fails('after', a) === 5 && fails('after', b) === 5, 'δεκαέξι μαζί σε δύο συνδέσμους: πέντε στον καθένα', `${fails('after', a)} / ${fails('after', b)}`)
    check(!okC.includes('"locked"') && fails('after', c) === 0, 'τρίτος σύνδεσμος ανέγγιχτος: ο σωστός κωδικός μπαίνει')

    // Μια συναλλαγή που κρατά τον Α δεν καθυστερεί τον Β.
    const d = link('after'), e = link('after')
    const holder = psqlAsync('after', '')
    holder.p.stdin.write(`begin; select public.get_portal_data('${d}', '0000');\n`)
    await waitFor('after', `select count(*) from pg_stat_activity where state = 'idle in transaction'`, 1, 'κράτηση συνδέσμου')
    const tB = Date.now()
    const onE = qTry('after', `set statement_timeout = '2s'; select (${CALL.read(e, '0000')})::text`)
    const msB = Date.now() - tB
    const onD = qTry('after', `set statement_timeout = '1s'; select (${CALL.read(d, '0000')})::text`)
    holder.p.stdin.end('commit;\n')
    await holder.done
    check(onE.ok && msB < 1500, `άλλος σύνδεσμος δεν περιμένει την κράτηση (${msB} ms)`)
    check(!onD.ok && /57014/.test(onD.err), 'ο ΙΔΙΟΣ σύνδεσμος περιμένει όσο κρατιέται (λήξη χρόνου 57014)')
  }

  // ── 3στ. Νέο κουπόνι ενώ περιμένουν ───────────────────────────────────────
  // Ο ιδιοκτήτης αλλάζει μισθωτή: η εφαρμογή γράφει νέο κουπόνι στην ΙΔΙΑ
  // γραμμή (lib/data/portal.ts, reissue). Η συναλλαγή του κρατά τη γραμμή·
  // τέσσερις λάθος και ένας σωστός με το ΠΑΛΙΟ κουπόνι περιμένουν από πίσω.
  console.log('\n▶ Νέο κουπόνι στη μέση του αγώνα: τέσσερις λάθος και ένας σωστός με το παλιό')
  for (const db of ['mid', 'after']) {
    for (const iso of ISO) {
      const t = link(db), fresh = `${t}new`
      const holder = psqlAsync(db, '')
      holder.p.stdin.write(`begin; update portal_links set token = '${fresh}' where token = '${t}';\n`)
      await waitFor(db, `select count(*) from pg_stat_activity where state = 'idle in transaction' and datname = '${db}'`, 1, 'αλλαγή κουπονιού')
      const calls = [...Array.from({ length: 4 }, () => ({ kind: 'read', token: t, pin: '0000' })), { kind: 'read', token: t, pin: PIN }]
      const workers = calls.map(({ kind, token, pin }) => ({
        kind,
        run: psqlAsync(db, `begin isolation level ${iso};
set local role anon;
select 'R|' || coalesce((${CALL[kind](token, pin)})::text, 'null');
commit;
`),
      }))
      await waitFor(db, `select count(*) from pg_stat_activity where datname = '${db}' and wait_event_type = 'Lock'`, calls.length, 'αναμονή στη γραμμή')
      holder.p.stdin.end('commit;\n')
      await holder.done
      const res = await Promise.all(workers.map(async w => classify(w.kind, await w.run.done)))
      const rows = Number(q(db, `select count(*) from portal_pin_attempts where token in ('${t}', '${fresh}')`))
      const leaked = res.filter(r => r === 'checked' || r === 'ok').length
      console.log(`  ${db.padEnd(7)} ${iso.padEnd(16)} ${res.join(' ')} · γραμμές ${rows}`)
      if (db === 'after') check(leaked === 0 && rows === 0, `ΜΕΤΑ, ${iso}: το παλιό κουπόνι δεν μαθαίνει τίποτα για τον κωδικό και δεν γράφει`, `${res.join(' ')} · ${rows}`)
      if (db === 'mid' && iso === 'read committed') check(leaked > 0, 'MID, read committed: το κενό αναπαράγεται (ο κωδικός ελέγχεται με το παλιό κουπόνι)', res.join(' '))
    }
  }

  // ── 3ζ. Ταβάνι υποβολών ───────────────────────────────────────────────────
  console.log('\n▶ Είκοσι δηλώσεις μαζί (ταβάνι δέκα την ώρα)')
  console.log('  βάση    σύνδεσμος     επίπεδο          γραμμένες  δεκτές  ταβάνι  40001  άλλο')
  for (const [label, pin] of [['χωρίς κωδικό', null], ['με κωδικό', PIN]]) {
    for (const db of ['before', 'mid', 'after']) {
      for (const iso of ISO) {
        const t = link(db, { pin })
        seed(db, t, 0)
        const r = await race(db, iso, Array.from({ length: 20 }, () => ({ kind: 'declare', token: t, pin: pin === null ? null : PIN })))
        const n = Number(q(db, `select count(*) from portal_pin_attempts where token = 'declare:${t}'`))
        console.log(`  ${db.padEnd(7)} ${label.padEnd(13)} ${iso.padEnd(16)} ${String(n).padStart(9)}  ${String(r.tally.ok).padStart(6)}  ${String(r.tally.capped).padStart(6)}  ${String(r.tally.serialization).padStart(5)}  ${r.tally.other + r.tally.deadlock + r.tally.checked + r.tally.locked}`)
        if (db === 'before' && pin === null && iso === 'read committed') check(n > 10, 'ΠΡΙΝ, χωρίς κωδικό: το ταβάνι ξεπερνιέται', String(n))
        if (db === 'after') {
          const exact = iso === 'read committed' ? n === 10 && r.tally.ok === 10 && r.tally.capped === 10 : n <= 10 && r.tally.ok === n
          check(exact && r.tally.other + r.tally.deadlock === 0, `ΜΕΤΑ, ${label}, ${iso}: ${iso === 'read committed' ? 'ακριβώς δέκα' : 'όχι πάνω από δέκα'}`, `${n} / ${r.tally.ok}`)
        }
      }
    }
  }

  // ── 4. ΣΥΜΠΕΡΙΦΟΡΑ ΧΩΡΙΣ ΑΓΩΝΑ: ΙΔΙΑ ΠΡΙΝ ΚΑΙ ΜΕΤΑ ─────────────────────────
  console.log('\n▶ Συμπεριφορά ένας ένας (ίδια πριν και μετά)')
  const transcript = {}
  for (const db of ['before', 'after']) {
    const log = []
    const gate = (t, pin) => q(db, `select public.portal_pin_gate('${t}', ${pin === null ? 'null' : `'${pin}'`})`)
    const anon = sql => {
      const r = qTry(db, `set role anon; select (${sql})::text`)
      return r.ok ? r.out : `ERR ${(/ERROR:\s+\w+: (.*)/.exec(r.err) || [, r.err])[1]}`
    }
    const t = link(db)
    log.push(`λάθος ${gate(t, '0000')} ${fails(db, t)}`)
    log.push(`κενό null ${gate(t, null)} ${fails(db, t)}`)
    log.push(`κενό '' ${gate(t, '')} ${fails(db, t)}`)
    log.push(`σωστός ${gate(t, PIN)} ${fails(db, t)}`)
    for (let i = 0; i < 5; i++) gate(t, '0000')
    log.push(`έκτος λάθος ${gate(t, '0000')} σωστός ${gate(t, PIN)} ${fails(db, t)}`)
    const ex = link(db, { expired: true }), off = link(db, { active: false }), open = link(db, { pin: null })
    log.push(`έληξε ${gate(ex, '0000')} ${gate(ex, PIN)} ${fails(db, ex)}`)
    log.push(`ανενεργός ${gate(off, '0000')} ${fails(db, off)}`)
    log.push(`ανύπαρκτος ${gate('nope-nope', '0000')} ${fails(db, 'nope-nope')}`)
    log.push(`χωρίς κωδικό ${gate(open, '0000')} ${gate(open, null)} ${fails(db, open)}`)
    const s = link(db)
    for (let i = 0; i < 3; i++) anon(CALL.read(s, '0000'))
    for (let i = 0; i < 2; i++) anon(CALL.declare(s, '0000'))
    log.push(`κοινό όριο ${fails(db, s)} · ανάγνωση ${anon(CALL.read(s, PIN))} · δήλωση ${anon(CALL.declare(s, PIN))} · βλάβη ${anon(CALL.maint(s, PIN))} · φωτογραφία ${q(db, `set role service_role; select public.portal_upload_slot('${s}', '${PIN}')`)}`)
    const w = link(db)
    for (let i = 0; i < 4; i++) anon(CALL.maint(w, '0000'))
    log.push(`εγγραφή μετά ανάγνωση ${fails(db, w)} · ${anon(CALL.read(w, '0000'))} · ${anon(CALL.declare(w, PIN))}`)
    log.push(`ανώνυμος καλεί την πύλη απευθείας: ${anon(`public.portal_pin_gate('${w}', '0000')`)}`)
    transcript[db] = log
  }
  for (const line of transcript.after) console.log(`    ${line}`)
  const same = JSON.stringify(transcript.before.map(l => l.replace(/race\d+/g, ''))) === JSON.stringify(transcript.after.map(l => l.replace(/race\d+/g, '')))
  check(same, 'ίδιες απαντήσεις και ίδιες καταγραφές πριν και μετά',
    same ? '' : transcript.before.filter((l, i) => l !== transcript.after[i]).join(' | '))
  const A = transcript.after
  check(A[0] === 'λάθος pin 1' && A[1] === 'κενό null pin 1' && A[2] === "κενό '' pin 2" && A[3] === 'σωστός ok 0', 'λάθος μετρά, null δεν μετρά, κενό κείμενο μετρά, σωστός καθαρίζει')
  check(A[4] === 'έκτος λάθος locked σωστός locked 5', 'μετά από πέντε κλειδώνει και τον σωστό, χωρίς έκτη καταγραφή')
  check(A[5] === 'έληξε notfound notfound 0' && A[6] === 'ανενεργός notfound 0' && A[7] === 'ανύπαρκτος notfound 0', 'έληξε, ανενεργός, ανύπαρκτος: notfound χωρίς καταγραφή')
  check(A[8] === 'χωρίς κωδικό ok ok 0', 'σύνδεσμος χωρίς κωδικό: ok, τίποτα δεν γράφεται')
  check(/^κοινό όριο 5 · ανάγνωση \{"locked" : true, "rate_limited" : true\} · δήλωση ERR portal_locked · βλάβη ERR portal_locked · φωτογραφία \{"ok" : false, "reason" : "locked"\}$/.test(A[9]), 'τρεις αποτυχίες ανάγνωσης και δύο δήλωσης κλειδώνουν και τις τέσσερις διαδρομές')
  check(/^εγγραφή μετά ανάγνωση 4 · \{"locked" : true\} · ERR portal_locked$/.test(A[10]), 'τέσσερις αποτυχίες βλάβης και μία ανάγνωσης: η δήλωση κλειδώνει')
  check(/ERR permission denied for function portal_pin_gate/.test(A[11]), 'ο anon δεν εκτελεί την portal_pin_gate')

  // ── 5. ΔΙΚΑΙΩΜΑΤΑ ─────────────────────────────────────────────────────────
  console.log('\n▶ Δικαιώματα')
  const FN = ['public.portal_pin_gate(text,text)', 'public.get_portal_data(text,text)', 'public.declare_rent_payment(text,uuid,text,text)',
    'public.submit_maintenance_request(text,text,text,text,jsonb,text)', 'public.portal_upload_slot(text,text)', 'public.allow_public_submit(text,text,integer,interval)']
  const acl = (db, f) => q(db, `select p.prosecdef, p.proconfig, p.proacl, p.proowner::regrole,
      has_function_privilege('anon', p.oid, 'execute'), has_function_privilege('authenticated', p.oid, 'execute'),
      has_function_privilege('service_role', p.oid, 'execute')
    from pg_proc p where p.oid = '${f}'::regprocedure`)
  for (const f of FN) check(acl('before', f) === acl('after', f), `${f.replace(/\(.*/, '')}: ίδια δικαιώματα, ίδιο search_path, ίδιος κάτοχος`, `${acl('before', f)} ≠ ${acl('after', f)}`)
  const g = acl('after', 'public.portal_pin_gate(text,text)').split('|')
  check(g[0] === 't' && g[1] === '{"search_path=public, extensions"}' && g[4] === 'f' && g[5] === 'f' && g[6] === 't', 'portal_pin_gate: SECURITY DEFINER, σταθερό search_path, κλειστή σε anon και authenticated', g.join('|'))
  const pr = acl('after', 'public.prune_portal_pin_attempts(integer)').split('|')
  check(pr[0] === 't' && pr[1] === '{search_path=public}' && pr[4] === 'f' && pr[5] === 'f' && pr[6] === 't' && !/(^|[{,])=X/.test(pr[2]),
    'prune_portal_pin_attempts: SECURITY DEFINER, σταθερό search_path, κλειστή σε PUBLIC, anon και authenticated', pr.join('|'))
  // Οι δύο έλεγχοι του db-replay.sh, με τη σειρά του (το rls-probe δίνει
  // πρώτα τα GRANT της πλατφόρμας), σε αντίγραφο που πετιέται.
  q('postgres', 'create database probe template after')
  for (const f of ['scripts/db/rls-probe.sql', 'scripts/db/anon-surface.sql']) {
    const probe = spawnSync(`${BIN}/psql`, [...CONN, '-d', 'probe', '-v', 'ON_ERROR_STOP=1', '-q', '-f', join(ROOT, f)], { encoding: 'utf8' })
    check(probe.status === 0, `${f} περνά στην after`, probe.stderr.split('\n').find(l => /ERROR/.test(l)))
  }
  q('postgres', 'drop database probe')

  // ── 6. ΣΚΟΥΠΙΣΜΑ ──────────────────────────────────────────────────────────
  console.log('\n▶ Σκούπισμα')
  for (const db of ['before', 'after']) {
    const x = link(db), y = link(db)
    for (const t of [x, y]) q(db, `insert into portal_pin_attempts(token, attempted_at, success) select '${t}', now() - interval '2 days', false from generate_series(1, 3)`)
    q(db, `select public.portal_pin_gate('${x}', '0000')`)
    const oldX = q(db, `select count(*) from portal_pin_attempts where token = '${x}' and attempted_at < now() - interval '1 day'`)
    const oldY = q(db, `select count(*) from portal_pin_attempts where token = '${y}' and attempted_at < now() - interval '1 day'`)
    console.log(`  ${db.padEnd(7)} μετά από μία κλήση στον Χ: παλιές του Χ ${oldX}, παλιές του άσχετου Υ ${oldY}`)
    if (db === 'after') check(oldX === '0' && oldY === '3', 'ΜΕΤΑ: η πύλη σβήνει μόνο τις παλιές γραμμές του δικού της κουπονιού')
  }
  {
    const y = link('after')
    q('after', `
      insert into portal_pin_attempts(token, attempted_at, success) values
        ('${y}', now() - interval '2 days', false), ('${y}', now() - interval '25 hours', false),
        ('declare:${y}', now() - interval '3 days', true), ('checkin:gone-link', now() - interval '2 days', true),
        ('gone-link', now() - interval '9 days', false), ('gone-link', now() - interval '30 days', false),
        ('${y}', now() - interval '10 minutes', false), ('declare:${y}', now() - interval '5 minutes', true),
        ('maint:${y}', now() - interval '23 hours', true)`)
    const oldBefore = Number(q('after', `select count(*) from portal_pin_attempts where attempted_at < now() - interval '1 day'`))
    const recentBefore = Number(q('after', `select count(*) from portal_pin_attempts where attempted_at >= now() - interval '1 day'`))
    // Μία δόση ανά κλήση: δύο γραμμές τη φορά, ώσπου να μη μείνει τίποτα.
    const per = []
    for (let i = 0; i < 20; i++) {
      const k = Number(q('after', 'select public.prune_portal_pin_attempts(2)'))
      per.push(k)
      if (k === 0) break
    }
    const n = per.reduce((a, b) => a + b, 0)
    const oldAfter = Number(q('after', `select count(*) from portal_pin_attempts where attempted_at < now() - interval '1 day'`))
    const recentAfter = Number(q('after', `select count(*) from portal_pin_attempts where attempted_at >= now() - interval '1 day'`))
    check(per.every(k => k <= 2) && per[0] === 2 && n === oldBefore && oldAfter === 0 && recentAfter === recentBefore,
      `prune μία δόση των δύο ανά κλήση (${per.join(', ')}): σβήνει ${n} παλιές (σύνδεσμοι που έληξαν, σβήστηκαν, μετρητές), κρατά ${recentAfter} πρόσφατες`, `${n}/${oldBefore}, ${oldAfter}, ${recentAfter}/${recentBefore}`)

    q('after', `insert into portal_pin_attempts(token, attempted_at, success) values ('${y}', now() - interval '2 days', false), ('gone-link', now() - interval '2 days', false)`)
    const holder = psqlAsync('after', '')
    holder.p.stdin.write(`begin; select id from portal_pin_attempts where token = 'gone-link' and attempted_at < now() - interval '1 day' for update;\n`)
    await waitFor('after', `select count(*) from pg_stat_activity where state = 'idle in transaction'`, 1, 'κράτηση γραμμής')
    const tP = Date.now()
    const r = qTry('after', `set statement_timeout = '2s'; select public.prune_portal_pin_attempts()`)
    const msP = Date.now() - tP
    holder.p.stdin.end('commit;\n')
    await holder.done
    const left = q('after', `select count(*) from portal_pin_attempts where attempted_at < now() - interval '1 day'`)
    check(r.ok && r.out.endsWith('1') && left === '1' && msP < 1500, `prune δεν περιμένει κλειδωμένη γραμμή: σβήνει τη μία, αφήνει την άλλη (${msP} ms)`, `${r.out} ${r.err} ${left}`)
  }

  // ── 7. ΤΟ ΧΡΟΝΟΜΕΤΡΟ ──────────────────────────────────────────────────────
  console.log('\n▶ Χρονόμετρο')
  {
    const again = spawnSync(join(BIN, 'psql'), ['-h', WORK, '-p', PORT, '-U', 'postgres', '-X', '-d', 'after', '-v', 'ON_ERROR_STOP=1', '-q'],
      { encoding: 'utf8', input: readFileSync(join(MIG, FIRST), 'utf8') + readFileSync(join(MIG, NEW), 'utf8') })
    check(again.status === 0 && (again.stderr.match(/pg_cron δεν είναι ενεργό/g) || []).length === 2, 'χωρίς pg_cron: η μετανάστευση ξανατρέχει, λέει ότι δεν προγραμματίζει και δεν γράφει εργασία')
    check(q('after', `select count(*) from cron.job where jobname = 'portal-pin-attempts-prune'`) === '0', 'χωρίς pg_cron: καμία εργασία')
    // Με pg_cron «παρόν»: μια ψεύτικη γραμμή στο pg_extension, σε αντίγραφο
    // που πετιέται. Ελέγχει το ΙΔΙΟ το μπλοκ της μετανάστευσης πάνω στη
    // σκαλωσιά του cron, όχι το πραγματικό pg_cron.
    q('postgres', 'create database cronprobe template after')
    q('cronprobe', `set allow_system_table_mods = on;
      insert into pg_extension(oid, extname, extowner, extnamespace, extrelocatable, extversion)
      values (999999, 'pg_cron', 10, 'cron'::regnamespace, false, '1.6')`)
    for (const f of [FIRST, NEW, FIRST, NEW]) {
      const r = spawnSync(`${BIN}/psql`, [...CONN, '-d', 'cronprobe', '-v', 'ON_ERROR_STOP=1', '-q', '-f', join(MIG, f)], { encoding: 'utf8' })
      if (r.status !== 0) { check(false, 'cronprobe: η μετανάστευση τρέχει', r.stderr); break }
    }
    const job = q('cronprobe', `select count(*), min(schedule), min(command) from cron.job where jobname = 'portal-pin-attempts-prune'`)
    check(job === '1|7,17,27,37,47,57 * * * *|select public.prune_portal_pin_attempts()', 'με pg_cron (σκαλωσιά): μία εργασία κάθε δέκα λεπτά, ακόμη και μετά από δεύτερη εκτέλεση των δύο', job)
    const cmd = qTry('cronprobe', 'select public.prune_portal_pin_attempts()')
    check(cmd.ok, 'η εντολή της εργασίας τρέχει ως postgres', cmd.err)
    q('postgres', 'drop database cronprobe')
  }

  // ── 8. pgbench: ΑΔΙΕΞΟΔΑ ΚΑΙ ΚΑΘΥΣΤΕΡΗΣΗ ─────────────────────────────────
  const BENCH = join(WORK, 'bench')
  mkdirSync(BENCH)
  const file = (name, body) => { writeFileSync(join(BENCH, name), body); return join(BENCH, name) }
  const T = QUICK ? 3 : 8
  for (const db of ['before', 'after']) {
    for (let i = 1; i <= 4; i++) link(db, { token: `dl${i}` })
    for (let i = 1; i <= 64; i++) link(db, { token: `lat${i}` })
    for (let i = 1; i <= 64; i++) link(db, { token: `np${i}`, pin: null })
  }
  const fPrune = file('prune.sql', `begin;
insert into portal_pin_attempts(token, attempted_at, success) select 'dl' || (1 + g % 4), now() - interval '2 days', false from generate_series(1, 20) g;
select public.prune_portal_pin_attempts(7);
commit;
`)
  const fOldOnly = file('old-only.sql', `insert into portal_pin_attempts(token, attempted_at, success) select 'dl' || (1 + g % 4), now() - interval '2 days', false from generate_series(1, 20) g;
`)
  const fWrong = file('wrong.sql', `\\set t random(1, 4)
begin;
insert into portal_pin_attempts(token, attempted_at, success) values ('dl' || :t, now() - interval '2 days', false);
select public.get_portal_data('dl' || :t, '0000');
commit;
`)
  const fRight = file('right.sql', `\\set t random(1, 4)
select public.get_portal_data('dl' || :t, '${PIN}');
`)
  function bench(db, files, { clients, iso = 'read committed', secs = T }) {
    const r = spawnSync(`${BIN}/pgbench`, ['-h', WORK, '-p', PORT, '-U', 'postgres', '-n', '-c', String(clients), '-j', String(Math.min(clients, 4)),
      '-T', String(secs), '--max-tries=1', '--failures-detailed', ...files.flatMap(f => ['-f', f]), db],
    { encoding: 'utf8', env: { ...env, PGOPTIONS: `-c default_transaction_isolation=${iso.replace(' ', '\\ ')}` } })
    const num = re => Number((re.exec(r.stdout) || [, 'NaN'])[1])
    return {
      status: r.status,
      aborted: /aborted/.test(r.stderr) || /aborted/.test(r.stdout),
      tx: num(/number of transactions actually processed: (\d+)/),
      deadlocks: num(/number of deadlock failures: (\d+)/),
      serialization: num(/number of serialization failures: (\d+)/),
      lat: num(/latency average = ([\d.]+) ms/),
      tps: num(/tps = ([\d.]+)/),
      err: r.stderr.split('\n').filter(l => /ERROR|aborted/.test(l)).slice(0, 2).join(' | '),
      // Καθυστέρηση ανά σενάριο, όταν τρέχουν πολλά μαζί.
      perScript: r.stdout.split(/^SQL script \d+: /m).slice(1).map(b => Number((/latency average = ([\d.]+) ms/.exec(b) || [, 'NaN'])[1])),
    }
  }

  console.log(`\n▶ pgbench ${T} s, 16 πελάτες: σκούπισμα, λάθος και σωστός κωδικός μαζί σε τέσσερις συνδέσμους`)
  console.log('  βάση    επίπεδο          συναλλαγές  40P01  40001  διακοπές  μέγιστες αποτυχίες')
  for (const db of ['before', 'after']) {
    for (const iso of ISO) {
      const files = db === 'after' ? [`${fPrune}@1`, `${fWrong}@5`, `${fRight}@2`] : [`${fOldOnly}@1`, `${fWrong}@5`, `${fRight}@2`]
      const r = bench(db, files, { clients: 16, iso })
      const worst = Number(q(db, `select coalesce(max(n), 0) from (select count(*) n from portal_pin_attempts where token like 'dl_' and success = false and attempted_at > now() - interval '15 minutes' group by token) t`))
      console.log(`  ${db.padEnd(7)} ${iso.padEnd(16)} ${String(r.tx).padStart(10)}  ${String(r.deadlocks).padStart(5)}  ${String(r.serialization).padStart(5)}  ${(r.aborted ? 'ναι' : 'όχι').padStart(8)}  ${worst}${r.err ? `  ${r.err}` : ''}`)
      if (db === 'after') {
        check(r.deadlocks === 0 && !r.aborted && r.tx > 0, `ΜΕΤΑ, ${iso}: κανένα αδιέξοδο, καμία διακοπή`, `${r.deadlocks} ${r.err}`)
        check(worst <= 5, `ΜΕΤΑ, ${iso}: κανένας σύνδεσμος πάνω από πέντε αποτυχίες`, String(worst))
      }
      q(db, `delete from portal_pin_attempts where token like 'dl_'`)
    }
  }

  console.log(`\n▶ Καθυστέρηση της portal_pin_gate (pgbench ${T} s, read committed)`)
  const fLatWrong = file('lat-wrong.sql', `\\set t random(1, 64)
begin;
delete from portal_pin_attempts where token = 'lat' || :t;
select public.portal_pin_gate('lat' || :t, '0000');
commit;
`)
  const fLatRight = file('lat-right.sql', `\\set t random(1, 64)
select public.portal_pin_gate('lat' || :t, '${PIN}');
`)
  const fLatOne = file('lat-one.sql', `begin;
delete from portal_pin_attempts where token = 'lat1';
select public.portal_pin_gate('lat1', '0000');
commit;
`)
  console.log('  σενάριο                               πελάτες  before ms (tps)    after ms (tps)')
  for (const [label, f, c] of [['λάθος κωδικός, 64 σύνδεσμοι', fLatWrong, 1], ['λάθος κωδικός, 64 σύνδεσμοι', fLatWrong, 8],
    ['σωστός κωδικός, 64 σύνδεσμοι', fLatRight, 1], ['σωστός κωδικός, 64 σύνδεσμοι', fLatRight, 8], ['λάθος κωδικός, ΕΝΑΣ σύνδεσμος', fLatOne, 8]]) {
    const b = bench('before', [f], { clients: c }), a = bench('after', [f], { clients: c })
    console.log(`  ${label.padEnd(36)} ${String(c).padStart(7)}  ${`${b.lat} (${Math.round(b.tps)})`.padEnd(17)}  ${a.lat} (${Math.round(a.tps)})${a.err || b.err ? `  ${a.err || b.err}` : ''}`)
  }

  console.log(`\n▶ Υποβολές σε συνδέσμους χωρίς κωδικό (pgbench ${T} s, read committed)`)
  const fNpDeclare = file('np-declare.sql', `\\set t random(1, 64)
begin;
delete from portal_pin_attempts where token = 'declare:np' || :t;
select public.declare_rent_payment('np' || :t, '${PAY}', 'x', null);
commit;
`)
  const fNpRead = file('np-read.sql', `select public.get_portal_data('np1', null);
`)
  const fNpDeclareOne = file('np-declare-one.sql', `begin;
delete from portal_pin_attempts where token = 'declare:np1';
select public.declare_rent_payment('np1', '${PAY}', 'x', null);
commit;
`)
  console.log('  σενάριο                               πελάτες  before ms (tps)    after ms (tps)')
  for (const [label, f, c] of [['δήλωση, 64 σύνδεσμοι', fNpDeclare, 1], ['δήλωση, 64 σύνδεσμοι', fNpDeclare, 8],
    ['δήλωση, ΕΝΑΣ σύνδεσμος', fNpDeclareOne, 8], ['ανάγνωση, ΕΝΑΣ σύνδεσμος', fNpRead, 8]]) {
    const b = bench('before', [f], { clients: c }), a = bench('after', [f], { clients: c })
    console.log(`  ${label.padEnd(36)} ${String(c).padStart(7)}  ${`${b.lat} (${Math.round(b.tps)})`.padEnd(17)}  ${a.lat} (${Math.round(a.tps)})${a.err || b.err ? `  ${a.err || b.err}` : ''}`)
  }
  {
    // Αναγνώσεις και δηλώσεις στον ΙΔΙΟ σύνδεσμο: η ανάγνωση δεν περιμένει.
    const b = bench('before', [`${fNpRead}@5`, `${fNpDeclareOne}@1`], { clients: 8 })
    const a = bench('after', [`${fNpRead}@5`, `${fNpDeclareOne}@1`], { clients: 8 })
    console.log(`  ίδιος σύνδεσμος, 5 αναγνώσεις : 1 δήλωση, 8 πελάτες: ανάγνωση ${b.perScript[0]} → ${a.perScript[0]} ms, δήλωση ${b.perScript[1]} → ${a.perScript[1]} ms, 40P01 ${a.deadlocks}`)
    check(a.deadlocks === 0 && !a.aborted && a.tx > 0, 'ΜΕΤΑ: αναγνώσεις και δηλώσεις στον ίδιο σύνδεσμο χωρίς αδιέξοδο ή διακοπή', a.err)
  }
  await sleep(1200)
  const st = q('after', `select n_tup_upd, n_tup_hot_upd, n_dead_tup from pg_stat_user_tables where relname = 'portal_links'`)
  console.log(`  portal_links στην after: ενημερώσεις|HOT|νεκρές πλειάδες = ${st}`)

  console.log('')
  if (failures) { console.log(`🔴 ${failures} έλεγχοι απέτυχαν.`); process.exitCode = 1 }
  else console.log('✅ Όλοι οι έλεγχοι πέρασαν.')
}

main().catch(e => { console.error(e.stack || String(e)); process.exitCode = 1 })
