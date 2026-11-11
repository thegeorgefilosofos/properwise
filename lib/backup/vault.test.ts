// Τεστ για τις καθαρές συναρτήσεις του ιδιωτικού χώρου αντιγράφων (scripts/backup/vault.mjs).
import {
  daysToPrune, latestDay, judge, judgeFiles, encPath, countRows, compareCounts,
  partName, splitPlan, missingParts, sizeOk, missingTables, readonlyAllows, PART_BYTES,
  parseManifest, rowsHealthy, runFolder, DAY, restorable, dumpStatements,
} from '../../scripts/backup/vault.mjs'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) { if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) } }

// ── Κράτηση: ακριβώς 30 ημέρες· η τελευταία καλή ημέρα δεν σβήνεται ποτέ ──
{
  const days = ['2026-10-01', '2026-10-10', '2026-10-11', '2026-10-12', '2026-11-09', 'όχι-ημέρα']
  const old = daysToPrune(days, '2026-11-10', 30, ['2026-11-09'])
  ok('σβήνει ό,τι έκλεισε 30 ημέρες', old.join() === '2026-10-01,2026-10-10,2026-10-11')
  ok('κρατά ό,τι δεν έκλεισε 30 ημέρες', !old.includes('2026-10-12'))
  ok('αγνοεί ό,τι δεν είναι ημερομηνία', !old.includes('όχι-ημέρα'))
  ok('κενή λίστα, κενό αποτέλεσμα', daysToPrune([], '2026-11-10', 30).length === 0)
  // Καμία καλή εκτέλεση (π.χ. τα manifests δεν διαβάστηκαν): δεν σβήνεται τίποτα.
  ok('χωρίς καλή εκτέλεση δεν σβήνεται τίποτα', daysToPrune(days, '2026-11-10', 30, []).length === 0)
  // Η τελευταία καλή βάση είναι νέα, τα τελευταία καλά αρχεία είναι παλιά: μένουν και τα δύο.
  const both = daysToPrune(['2026-09-01', '2026-09-06T020000Z', '2026-11-09T020000Z'], '2026-11-10', 30, ['2026-11-09T020000Z', '2026-09-06T020000Z'])
  ok('μένει και η τελευταία καλή εκτέλεση με αρχεία', both.join() === '2026-09-01')
  ok('φάκελοι ανά εκτέλεση σβήνονται με την ημερομηνία τους', daysToPrune(['2026-10-11T020000Z', '2026-10-12T020000Z', '2026-11-09'], '2026-11-10', 30, ['2026-11-09']).join() === '2026-10-11T020000Z')
  // Τα αντίγραφα σταμάτησαν πριν από δύο μήνες: η τελευταία καλή ημέρα μένει.
  const stale = daysToPrune(['2026-09-01', '2026-09-02'], '2026-11-10', 30, ['2026-09-02'])
  ok('η τελευταία καλή ημέρα δεν σβήνεται', stale.join() === '2026-09-01')
}

// ── Φάκελος ανά εκτέλεση ──────────────────────────────────────────────────────
{
  const f = runFolder(Date.parse('2026-11-11T02:03:04.567Z'))
  ok('όνομα φακέλου εκτέλεσης', f === '2026-11-11T020304Z' && DAY.test(f))
  ok('δύο εκτελέσεις την ίδια μέρα: δύο φάκελοι', runFolder(Date.parse('2026-11-11T14:00:00Z')) !== f)
  ok('η νεότερη εκτέλεση ταξινομείται τελευταία', latestDay(['2026-11-11', f, '2026-11-11T140000Z']) === '2026-11-11T140000Z')
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
const objectsOf = (m: typeof full) => [...Object.values(m.files).flatMap(e => e.parts.map(p => ({ name: p.name, size: p.bytes }))), { name: 'manifest.json', size: 9 }]
{
  const now = Date.parse('2026-11-10T05:00:00Z')
  const base = { day: '2026-11-10', manifest: full, objects: objectsOf(full), nowMs: now, maxHours: 48 }
  ok('υγιές: σημερινό, σφραγισμένο, πλήρες', judge(base).ok === true)
  ok('υγιές: χθεσινό', judge({ ...base, day: '2026-11-09' }).ok === true)
  ok('παλιό: πριν από τρεις ημέρες', judge({ ...base, day: '2026-11-07' }).ok === false)
  ok('χωρίς manifest = κανένα αντίγραφο', judge({ ...base, manifest: null }).ok === false)
  ok('manifest χωρίς έλεγχο υγείας = αποτυχία', judge({ ...base, manifest: { ...full, verified: false } }).ok === false)
  ok('.sql σε καθαρό κείμενο = αποτυχία', judge({ ...base, objects: [...base.objects, { name: 'data.sql', size: 5 }] }).ok === false)
  const noData = { verified: true, files: { 'roles.sql.gpg': full.files['roles.sql.gpg'], 'schema.sql.gpg': full.files['schema.sql.gpg'] } }
  const miss = judge({ ...base, manifest: noData })
  ok('λείπει το data', miss.ok === false && /data\.sql\.gpg/.test(miss.reason ?? ''))
  const lost = judge({ ...base, objects: base.objects.filter(o => o.name !== 'data.sql.gpg.part-001') })
  ok('λείπει κομμάτι του data = αποτυχία', lost.ok === false && /κομμάτια/.test(lost.reason ?? ''))
  ok('κομμάτια που λείπουν', missingParts(full.files['data.sql.gpg'], [{ name: 'data.sql.gpg.part-000', size: 1 }]).join() === 'data.sql.gpg.part-001')
  const shrunk = base.objects.map(o => o.name === 'data.sql.gpg.part-000' ? { ...o, size: 0 } : o)
  ok('κομμάτι με άλλο μέγεθος = αποτυχία', judge({ ...base, objects: shrunk }).ok === false)
  ok('ηλικία από τον φάκελο εκτέλεσης', judge({ ...base, day: '2026-11-10T020000Z' }).ok === true)
}

// ── Τα αρχεία των χρηστών: το πιο πρόσφατο σετ, πλήρες ────────────────────────
{
  const now = Date.parse('2026-11-10T05:00:00Z')
  const m = { ...full, files: { ...full.files, 'files.tar.gpg': entry('files.tar.gpg', 3) } }
  const base = { day: '2026-11-08', manifest: m, objects: objectsOf(m), nowMs: now, maxDays: 8 }
  ok('σετ αρχείων πλήρες', judgeFiles(base).ok === true)
  ok('σετ χωρίς ένα κομμάτι = αποτυχία', judgeFiles({ ...base, objects: base.objects.filter(o => o.name !== 'files.tar.gpg.part-002') }).ok === false)
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
  ok('ρητή παράκαμψη: περνά', sizeOk(10, 100, 0.5, true) === true)
  ok('η παράκαμψη δεν περνά κενό', sizeOk(0, 100, 0.5, true) === false)
  ok('γραμμές: ίδιες', rowsHealthy({ a: 3, b: 0 }, { a: 3, b: 0 }).ok === true)
  ok('γραμμές: η εφαρμογή έγραψε στο μεταξύ', rowsHealthy({ a: 3 }, { a: 4 }).ok === true)
  ok('γραμμές: 0 στο dump ενώ η παραγωγή έχει = αποτυχία', rowsHealthy({ a: 0 }, { a: 5 }).ok === false)
  ok('γραμμές: η παραγωγή δεν μετρήθηκε = αποτυχία', rowsHealthy({ a: 1 }, { a: -1 }).ok === false && rowsHealthy({ a: 1 }, {}).ok === false)
  const schema = 'CREATE TABLE IF NOT EXISTS "public"."tenants" (\n  "id" uuid\n);\nCREATE TABLE "public"."tenants_archive" ("id" int);'
  ok('ο πίνακας υπάρχει', missingTables(schema, ['tenants']).length === 0)
  ok('λείπει πίνακας με ίδιο πρόθεμα', missingTables(schema, ['tenants', 'tenants_arch']).join() === 'tenants_arch')
}

// ── Το manifest: «δεν υπάρχει» δεν είναι το ίδιο με «σφάλμα» ─────────────────
{
  const throws = (f: () => unknown) => { try { f(); return false } catch { return true } }
  ok('200: διαβάζεται', parseManifest(200, '{"verified":true}')?.verified === true)
  ok('404: δεν υπάρχει', parseManifest(404, '') === null)
  ok('400 με statusCode 404: δεν υπάρχει', parseManifest(400, '{"statusCode":"404","error":"not_found"}') === null)
  ok('503: σφάλμα', throws(() => parseManifest(503, 'upstream')))
  ok('429: σφάλμα', throws(() => parseManifest(429, '{}')))
  ok('400 άλλο: σφάλμα', throws(() => parseManifest(400, '{"statusCode":"400"}')))
  ok('κακό JSON: σφάλμα', throws(() => parseManifest(200, '{όχι json')))
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

// ── Η μορφή του `supabase db dump --data-only`: μία εντολή ανά πίνακα ──────
// `--column-inserts --rows-per-insert 100000`. Η παλιά μέτρηση έβγαζε 1 εδώ και
// η δοκιμή επαναφοράς κοκκίνιζε σε κάθε πίνακα με δύο γραμμές και πάνω.
{
  const sql = [
    'SET session_replication_role = replica;',
    '--',
    '-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin',
    '--',
    'INSERT INTO "auth"."users" ("id", "email") VALUES',
    '\t(\'u1\', \'a@example.invalid\'),',
    '\t(\'u2\', \'b@example.invalid\');',
    'INSERT INTO "storage"."objects" ("name") VALUES',
    '\t(\'u1/μισθωτήριο.pdf\');',
    'INSERT INTO "public"."tenants" ("id", "note") VALUES',
    '\t(1, \'τιμή με ; και ) και (\'),',
    '\t(2, \'πρώτη γραμμή',
    'INSERT INTO "auth"."users" VALUES (1);',
    '\t(9, ψεύτικη πλειάδα)\'),',
    '\t(3, E\'απόστροφος \\\' μέσα\'),',
    '\t(4, \'διπλή \'\' απόστροφος\');',
    'SELECT pg_catalog.setval(\'"public"."tenants_id_seq"\', 4, true);',
    'SELECT pg_catalog.setval(\'"auth"."refresh_tokens_id_seq"\', 9, true);',
    'COPY "public"."expenses" ("id") FROM stdin;',
    '1',
    '2',
    '\\.',
    'RESET ALL;',
  ].join('\n')
  const c = countRows(sql, ['tenants', 'expenses'])
  ok('πλειάδες, όχι εντολές: 4 γραμμές σε μία INSERT', c.tenants === 4)
  ok('COPY μετά από πολλαπλή INSERT: 2', c.expenses === 2)
  ok('κάθε εντολή χωριστά: 8', dumpStatements(sql).length === 8)

  const r = restorable(sql)
  ok('μένει έξω το auth', !r.sql.includes('example.invalid') && !r.sql.includes('refresh_tokens'))
  ok('μένει έξω το storage', !r.sql.includes('"storage"') && !r.sql.includes('μισθωτήριο'))
  ok('η τιμή που μοιάζει με εντολή μένει μέσα στη γραμμή της', r.sql.includes('γραμμή\nINSERT INTO "auth"."users" VALUES (1);\n\t(9, ψεύτικη'))
  ok('κρατά public INSERT, setval, COPY', r.kept === 3)
  ok('πλήθη έξω ανά σχήμα', r.left.auth === 2 && r.left.storage === 1)
  ok('κρατά τις ρυθμίσεις της συνεδρίας', r.sql.startsWith('SET session_replication_role = replica;') && r.sql.includes('RESET ALL;'))
  ok('το φιλτραρισμένο μετρά το ίδιο', JSON.stringify(countRows(r.sql, ['tenants', 'expenses'])) === JSON.stringify(c))
  const odd = restorable('CREATE TABLE "public"."x" (id int);\nINSERT INTO "public"."x" VALUES (1);')
  ok('άγνωστη εντολή δεν περνά', odd.kept === 1 && !odd.sql.includes('CREATE') && odd.left['άλλη εντολή'] === 1)
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
