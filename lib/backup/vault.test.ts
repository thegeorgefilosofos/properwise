// Τεστ για τις καθαρές συναρτήσεις του ιδιωτικού χώρου αντιγράφων (scripts/backup/vault.mjs).
import {
  daysToPrune, latestDay, judge, judgeFiles, encPath, countRows, compareCounts,
  partName, splitPlan, missingParts, sizeOk, missingTables, readonlyAllows, PART_BYTES,
} from '../../scripts/backup/vault.mjs'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) { if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) } }

// ── Κράτηση: ακριβώς 30 ημέρες· η τελευταία καλή ημέρα δεν σβήνεται ποτέ ──
{
  const days = ['2026-10-01', '2026-10-10', '2026-10-11', '2026-10-12', '2026-11-09', 'όχι-ημέρα']
  const old = daysToPrune(days, '2026-11-10', 30)
  ok('σβήνει ό,τι έκλεισε 30 ημέρες', old.join() === '2026-10-01,2026-10-10,2026-10-11')
  ok('κρατά ό,τι δεν έκλεισε 30 ημέρες', !old.includes('2026-10-12'))
  ok('αγνοεί ό,τι δεν είναι ημερομηνία', !old.includes('όχι-ημέρα'))
  ok('κενή λίστα, κενό αποτέλεσμα', daysToPrune([], '2026-11-10', 30).length === 0)
  // Τα αντίγραφα σταμάτησαν πριν από δύο μήνες: η τελευταία καλή ημέρα μένει.
  const stale = daysToPrune(['2026-09-01', '2026-09-02'], '2026-11-10', 30, ['2026-09-02'])
  ok('η τελευταία καλή ημέρα δεν σβήνεται', stale.join() === '2026-09-01')
}

// ── Η τελευταία ημέρα ─────────────────────────────────────────────────────────
{
  ok('η πιο πρόσφατη', latestDay(['2026-11-01', '2026-11-09', '2026-10-30']) === '2026-11-09')
  ok('χωρίς ημέρες, null', latestDay(['x', 'files']) === null)
}

// ── Κομμάτια ──────────────────────────────────────────────────────────────────
{
  ok('όνομα κομματιού', partName('data.sql.gpg', 2) === 'data.sql.gpg.part-002')
  ok('μικρό αρχείο: ένα κομμάτι', splitPlan(10).length === 1 && splitPlan(10)[0].end === 10)
  ok('κενό αρχείο: ένα κενό κομμάτι', splitPlan(0).length === 1 && splitPlan(0)[0].end === 0)
  const big = splitPlan(PART_BYTES * 2 + 1)
  ok('πάνω από 45 MB: σπάει', big.length === 3 && big[2].end - big[2].start === 1)
  ok('κανένα κομμάτι πάνω από 45 MB', big.every(p => p.end - p.start <= PART_BYTES))
  ok('ακριβώς 45 MB: ένα κομμάτι', splitPlan(PART_BYTES).length === 1)
}

// ── Ο φύλακας: manifest, κομμάτια, ηλικία ─────────────────────────────────────
const entry = (name: string, n = 1) => ({ bytes: n, parts: Array.from({ length: n }, (_, i) => ({ name: partName(name, i), bytes: 1, sha256: 'x' })) })
const full = { verified: true, files: { 'roles.sql.gpg': entry('roles.sql.gpg'), 'schema.sql.gpg': entry('schema.sql.gpg'), 'data.sql.gpg': entry('data.sql.gpg', 2) } }
const objectsOf = (m: typeof full) => [...Object.values(m.files).flatMap(e => e.parts.map(p => p.name)), 'manifest.json']
{
  const now = Date.parse('2026-11-10T05:00:00Z')
  const base = { day: '2026-11-10', manifest: full, objects: objectsOf(full), nowMs: now, maxHours: 48 }
  ok('υγιές: σημερινό, σφραγισμένο, πλήρες', judge(base).ok === true)
  ok('υγιές: χθεσινό', judge({ ...base, day: '2026-11-09' }).ok === true)
  ok('παλιό: πριν από τρεις ημέρες', judge({ ...base, day: '2026-11-07' }).ok === false)
  ok('χωρίς manifest = κανένα αντίγραφο', judge({ ...base, manifest: null }).ok === false)
  ok('manifest χωρίς έλεγχο υγείας = αποτυχία', judge({ ...base, manifest: { ...full, verified: false } }).ok === false)
  ok('.sql σε καθαρό κείμενο = αποτυχία', judge({ ...base, objects: [...base.objects, 'data.sql'] }).ok === false)
  const noData = { verified: true, files: { 'roles.sql.gpg': full.files['roles.sql.gpg'], 'schema.sql.gpg': full.files['schema.sql.gpg'] } }
  const miss = judge({ ...base, manifest: noData })
  ok('λείπει το data', miss.ok === false && /data\.sql\.gpg/.test(miss.reason ?? ''))
  const lost = judge({ ...base, objects: base.objects.filter(o => o !== 'data.sql.gpg.part-001') })
  ok('λείπει κομμάτι του data = αποτυχία', lost.ok === false && /κομμάτια/.test(lost.reason ?? ''))
  ok('κομμάτια που λείπουν', missingParts(full.files['data.sql.gpg'], ['data.sql.gpg.part-000']).join() === 'data.sql.gpg.part-001')
}

// ── Τα αρχεία των χρηστών: το πιο πρόσφατο σετ, πλήρες ────────────────────────
{
  const now = Date.parse('2026-11-10T05:00:00Z')
  const m = { ...full, files: { ...full.files, 'files.tar.gpg': entry('files.tar.gpg', 3) } }
  const base = { day: '2026-11-08', manifest: m, objects: objectsOf(m), nowMs: now, maxDays: 8 }
  ok('σετ αρχείων πλήρες', judgeFiles(base).ok === true)
  ok('σετ χωρίς ένα κομμάτι = αποτυχία', judgeFiles({ ...base, objects: base.objects.filter(o => o !== 'files.tar.gpg.part-002') }).ok === false)
  ok('κανένα σετ = αποτυχία', judgeFiles({ ...base, day: null, manifest: null }).ok === false)
  ok('σετ πάνω από 8 ημέρες = αποτυχία', judgeFiles({ ...base, day: '2026-10-30' }).ok === false)
}

// ── Υγεία πριν από το ανέβασμα ────────────────────────────────────────────────
{
  ok('πρώτο αντίγραφο: χωρίς σύγκριση', sizeOk(100, 0) === true)
  ok('ίδιο μέγεθος: εντάξει', sizeOk(100, 100) === true)
  ok('μισό: εντάξει', sizeOk(50, 100) === true)
  ok('κάτω από το μισό: αποτυχία', sizeOk(49, 100) === false)
  ok('κενό: αποτυχία', sizeOk(0, 0) === false)
  const schema = 'CREATE TABLE IF NOT EXISTS "public"."tenants" (\n  "id" uuid\n);\nCREATE TABLE "public"."tenants_archive" ("id" int);'
  ok('ο πίνακας υπάρχει', missingTables(schema, ['tenants']).length === 0)
  ok('λείπει πίνακας με ίδιο πρόθεμα', missingTables(schema, ['tenants', 'tenants_arch']).join() === 'tenants_arch')
}

// ── Μόνο ανάγνωση ─────────────────────────────────────────────────────────────
{
  ok('λήψη: ναι', readonlyAllows('GET', 'object/authenticated/db-backups/x') === true)
  ok('λίστα: ναι', readonlyAllows('POST', 'object/list/db-backups') === true)
  ok('ανέβασμα: όχι', readonlyAllows('POST', 'object/db-backups/x') === false)
  ok('διαγραφή: όχι', readonlyAllows('DELETE', 'object/db-backups') === false)
  ok('νέο bucket: όχι', readonlyAllows('POST', 'bucket') === false)
}

// ── Διαδρομές ─────────────────────────────────────────────────────────────────
ok('κωδικοποίηση ανά τμήμα', encPath('2026-11-10/α β.gpg') === '2026-11-10/%CE%B1%20%CE%B2.gpg')

// ── Μέτρηση γραμμών του dump ─────────────────────────────────────────────────
{
  const sql = [
    'SET session_replication_role = replica;',
    'INSERT INTO "public"."tenants" ("id", "note") VALUES (1, \'α\');',
    'INSERT INTO "public"."tenants" ("id", "note") VALUES (2, \'πρώτη γραμμή',
    'δεύτερη γραμμή της ίδιας τιμής\');',
    'INSERT INTO "public"."tenants_archive" ("id") VALUES (3);',
    'INSERT INTO "auth"."users" ("id") VALUES (4);',
    'COPY "public"."expenses" ("id", "amount") FROM stdin;',
    '1\t10',
    '2\t20',
    '3\t30',
    '\\.',
    'INSERT INTO "public"."rent_payments" ("id") VALUES (5);',
  ].join('\n')
  const c = countRows(sql, ['tenants', 'expenses', 'rent_payments', 'calendar_events'])
  ok('INSERT ανά γραμμή, τιμή σε δύο γραμμές μετρά μία', c.tenants === 2)
  ok('COPY: τρεις γραμμές', c.expenses === 3)
  ok('μετά το COPY συνεχίζει', c.rent_payments === 1)
  ok('πίνακας χωρίς γραμμές = 0', c.calendar_events === 0)
  ok('αγνοεί το auth', !('users' in c))
}

// ── Σύγκριση μετά την επαναφορά ─────────────────────────────────────────────
{
  ok('ίδια πλήθη = εντάξει', compareCounts({ a: 2, b: 0 }, { a: '2', b: '0' }).ok === true)
  const bad = compareCounts({ a: 2, b: 1 }, { a: 2, b: 0 })
  ok('διαφορά = αποτυχία', bad.ok === false && bad.rows.find((r: { table: string }) => r.table === 'b')?.ok === false)
  ok('άδειο αντίγραφο = αποτυχία', compareCounts({ a: 0, b: 0 }, { a: 0, b: 0 }).ok === false)
  ok('λείπει πίνακας = αποτυχία', compareCounts({ a: 1 }, {}).ok === false)
}

console.log(`vault.mjs — ${passed} passed, ${failed} failed (σύνολο ${passed + failed})`)
if (failed > 0) { process.exit(1) }
console.log('όλα πέρασαν')
