// Τεστ για τις καθαρές συναρτήσεις του ιδιωτικού χώρου αντιγράφων (scripts/backup/vault.mjs).
import { daysToPrune, latestDay, judge, encPath, countRows, compareCounts } from '../../scripts/backup/vault.mjs'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) { if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) } }

// ── Κράτηση ─────────────────────────────────────────────────────────────────
{
  const days = ['2026-10-01', '2026-10-10', '2026-10-11', '2026-11-09', 'όχι-ημέρα']
  const old = daysToPrune(days, '2026-11-10', 30)
  ok('σβήνει ό,τι είναι πριν από 30 ημέρες', old.join() === '2026-10-01,2026-10-10')
  ok('κρατά την 30ή ημέρα', !old.includes('2026-10-11'))
  ok('αγνοεί ό,τι δεν είναι ημερομηνία', !old.includes('όχι-ημέρα'))
  ok('κενή λίστα, κενό αποτέλεσμα', daysToPrune([], '2026-11-10', 30).length === 0)
}

// ── Η τελευταία ημέρα ─────────────────────────────────────────────────────────
{
  ok('η πιο πρόσφατη', latestDay(['2026-11-01', '2026-11-09', '2026-10-30']) === '2026-11-09')
  ok('χωρίς ημέρες, null', latestDay(['x', 'files']) === null)
}

// ── Ο φύλακας ─────────────────────────────────────────────────────────────────
{
  const now = Date.parse('2026-11-10T05:00:00Z')
  const full = ['roles.sql.gpg', 'schema.sql.gpg', 'data.sql.gpg']
  ok('υγιές: σημερινό και πλήρες', judge('2026-11-10', full, now, 48).ok === true)
  ok('υγιές: χθεσινό', judge('2026-11-09', full, now, 48).ok === true)
  ok('παλιό: πριν από τρεις ημέρες', judge('2026-11-07', full, now, 48).ok === false)
  ok('κανένα αντίγραφο', judge(null, [], now, 48).ok === false)
  ok('.sql σε καθαρό κείμενο = αποτυχία', judge('2026-11-10', [...full, 'data.sql'], now, 48).ok === false)
  const miss = judge('2026-11-10', ['roles.sql.gpg', 'schema.sql.gpg'], now, 48)
  ok('λείπει το data', miss.ok === false && /data\.sql\.gpg/.test(miss.reason ?? ''))
  ok('τα κομμάτια των αρχείων δεν πειράζουν', judge('2026-11-10', [...full, 'files.tar.gpg.part-aa'], now, 48).ok === true)
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
