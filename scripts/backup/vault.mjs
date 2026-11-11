#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΙΔΙΩΤΙΚΟΣ ΧΩΡΟΣ ΤΩΝ ΑΝΤΙΓΡΑΦΩΝ ΑΣΦΑΛΕΙΑΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (10/11/2026). Το αποθετήριο είναι ΔΗΜΟΣΙΟ. Το ημερήσιο dump
// της βάσης ανέβαινε ως artifact του GitHub Actions: 34 αρχεία, κρυπτογραφημένα
// με μία συμμετρική φράση, που τα κατέβαζε όποιος είχε λογαριασμό GitHub. Η
// κρυπτογράφηση ήταν η ΜΟΝΗ άμυνα. Και τα αρχεία του Storage (μισθωτήρια,
// φωτογραφίες) δεν υπήρχαν σε κανένα αντίγραφο.
//
// ΤΙ ΚΑΝΕΙ. Μιλά με το Storage της Supabase ως service role και κρατά τα
// αντίγραφα σε ιδιωτικό bucket (`db-backups`), χωρίς καμία πολιτική για
// `anon` ή `authenticated`: το βλέπει μόνο ο service role. Η κρυπτογράφηση με
// gpg μένει, ως δεύτερη άμυνα.
//
// ΤΙ ΔΕΝ ΓΡΑΦΕΙ ΠΟΤΕ ΣΤΟ LOG. Τα logs ενός δημόσιου αποθετηρίου είναι
// δημόσια. Οι διαδρομές των αρχείων των χρηστών έχουν uid και ονόματα
// εγγράφων, οπότε εδώ τυπώνονται ΜΟΝΟ πλήθη και μεγέθη. Το κλειδί δεν τυπώνεται
// ποτέ· η ροή το κρύβει με `::add-mask::` πριν το δει οτιδήποτε.
//
// ΧΡΗΣΗ (μεταβλητές SUPABASE_URL και SUPABASE_SERVICE_KEY):
//   node scripts/backup/vault.mjs ensure
//   node scripts/backup/vault.mjs put <τοπικό αρχείο> <διαδρομή στο bucket>
//   node scripts/backup/vault.mjs get <διαδρομή στο bucket> <τοπικό αρχείο>
//   node scripts/backup/vault.mjs prune <ημέρες>
//   node scripts/backup/vault.mjs latest            → η πιο πρόσφατη ημέρα
//   node scripts/backup/vault.mjs check <ώρες>      → JSON για τον φύλακα
//   node scripts/backup/vault.mjs snapshot <φάκελος> <bucket> [<bucket> …]
//   node scripts/backup/vault.mjs count <data.sql> <πίνακας> [<πίνακας> …]  → JSON
//   node scripts/backup/vault.mjs compare <αναμενόμενα.json> <πραγματικά.json>
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const BUCKET = 'db-backups'

// ── ΚΑΘΑΡΕΣ ΣΥΝΑΡΤΗΣΕΙΣ (ελέγχονται στο lib/backup/vault.test.ts) ────────────

/** Ημέρα του αντιγράφου: ο φάκελος πρώτου επιπέδου, YYYY-MM-DD. */
export const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Οι ημέρες που πρέπει να σβηστούν: παλαιότερες από `keepDays` πριν από `today`. */
export function daysToPrune(days, today, keepDays) {
  const cutoff = Date.parse(today + 'T00:00:00Z') - keepDays * 86400000
  return days.filter(d => DAY.test(d) && Date.parse(d + 'T00:00:00Z') < cutoff).sort()
}

/** Η πιο πρόσφατη ημέρα, ή null. Αγνοεί ό,τι δεν είναι ημερομηνία. */
export function latestDay(days) {
  const ok = days.filter(d => DAY.test(d)).sort()
  return ok.length ? ok[ok.length - 1] : null
}

/**
 * Κρίνει αν το τελευταίο αντίγραφο είναι υγιές: πρόσφατο, πλήρες και ΜΟΝΟ
 * κρυπτογραφημένο. Ένα .sql σε καθαρό κείμενο είναι αποτυχία, όχι προειδοποίηση.
 */
export function judge(day, files, nowMs, maxHours) {
  if (!day) return { ok: false, reason: 'Δεν βρέθηκε ΚΑΝΕΝΑ αντίγραφο στον ιδιωτικό χώρο.' }
  // Το αντίγραφο γράφεται στις 02:00 UTC· η ηλικία μετρά από το τέλος της ημέρας του.
  const ageH = Math.floor((nowMs - (Date.parse(day + 'T00:00:00Z') + 86400000)) / 3600000)
  if (ageH > maxHours) return { ok: false, reason: `Το τελευταίο αντίγραφο είναι της ${day}, πάνω από ${maxHours} ώρες πριν.` }
  if (files.some(f => /\.sql$/.test(f))) return { ok: false, reason: 'Το αντίγραφο περιέχει ΜΗ κρυπτογραφημένο .sql.' }
  const need = ['roles.sql.gpg', 'schema.sql.gpg', 'data.sql.gpg']
  const missing = need.filter(n => !files.includes(n))
  if (missing.length) return { ok: false, reason: `Λείπουν από το αντίγραφο της ${day}: ${missing.join(', ')}.` }
  return { ok: true, day, files: files.length }
}

/** Κωδικοποίηση διαδρομής στο URL του Storage, ανά τμήμα. */
export const encPath = p => p.split('/').map(encodeURIComponent).join('/')

/**
 * Γραμμές ανά πίνακα του `public`, όπως τις γράφει το dump δεδομένων: μία
 * `INSERT INTO "public"."x"` ανά γραμμή (η προεπιλογή του `supabase db dump`)
 * ή μπλοκ `COPY "public"."x" … FROM stdin;` ως το `\.`. Η μέτρηση γίνεται στην
 * αρχή κάθε γραμμής του αρχείου, οπότε ένα κείμενο με αλλαγή γραμμής μέσα σε
 * τιμή δεν μετριέται δύο φορές στο INSERT.
 */
export function countRows(sql, tables) {
  const out = Object.fromEntries(tables.map(t => [t, 0]))
  const name = t => new RegExp(`^(?:"public"|public)\\.(?:"${t}"|${t})[\\s(]`)
  let copying = null
  for (const line of sql.split('\n')) {
    if (copying) {
      if (line === '\\.') copying = null
      else out[copying]++
      continue
    }
    const ins = /^INSERT INTO (.*)$/.exec(line)
    const cp = /^COPY (.*) FROM stdin;$/.exec(line)
    const rest = ins?.[1] ?? cp?.[1]
    if (!rest) continue
    const t = tables.find(t => name(t).test(rest + ' '))
    if (!t) continue
    if (ins) out[t]++
    else copying = t
  }
  return out
}

/**
 * Σύγκριση του αναμενόμενου (από το dump) με το πραγματικό (μετά την επαναφορά).
 * Επιστρέφει μόνο OK/FAIL ανά πίνακα: τα πλήθη δεν πάνε στο δημόσιο log.
 * Ένα αντίγραφο χωρίς ΚΑΜΙΑ γραμμή σε κανέναν πίνακα-κλειδί είναι αποτυχία.
 */
export function compareCounts(expected, actual) {
  const rows = Object.keys(expected).map(t => ({ table: t, ok: Number(actual[t]) === expected[t] }))
  const empty = Object.values(expected).every(n => n === 0)
  return { ok: !empty && rows.every(r => r.ok), empty, rows }
}

// ── ΤΟ STORAGE ───────────────────────────────────────────────────────────

function env() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    console.error('::error::Λείπουν τα SUPABASE_URL / SUPABASE_SERVICE_KEY. Η ροή τα παίρνει από το Management API με το SUPABASE_ACCESS_TOKEN.')
    process.exit(1)
  }
  return { url: url.replace(/\/$/, ''), key }
}

async function call(method, path, { body, json, raw } = {}) {
  const { url, key } = env()
  const headers = { Authorization: `Bearer ${key}`, apikey: key }
  let payload
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(json) }
  if (body !== undefined) { headers['Content-Type'] = 'application/octet-stream'; headers['x-upsert'] = 'true'; payload = body }
  const res = await fetch(`${url}/storage/v1/${path}`, { method, headers, body: payload })
  if (raw) return res
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { status: res.status, data }
}

/** Όλα τα αρχεία κάτω από ένα πρόθεμα, με σελιδοποίηση και αναδρομή στους φακέλους. */
async function listAll(bucket, prefix = '') {
  const out = []
  for (let offset = 0; ; offset += 1000) {
    const r = await call('POST', `object/list/${bucket}`, { json: { prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } } })
    if (r.status !== 200 || !Array.isArray(r.data)) throw new Error(`list ${bucket}: HTTP ${r.status}`)
    for (const e of r.data) {
      const path = prefix ? `${prefix}/${e.name}` : e.name
      if (e.id === null) out.push(...await listAll(bucket, path)) // φάκελος
      else out.push({ path, size: e.metadata?.size ?? 0 })
    }
    if (r.data.length < 1000) break
  }
  return out
}

/** Οι φάκελοι πρώτου επιπέδου του bucket των αντιγράφων. */
async function topFolders() {
  const r = await call('POST', `object/list/${BUCKET}`, { json: { prefix: '', limit: 1000, offset: 0 } })
  if (r.status !== 200 || !Array.isArray(r.data)) throw new Error(`list ${BUCKET}: HTTP ${r.status}`)
  return r.data.filter(e => e.id === null).map(e => e.name)
}

async function ensure() {
  const created = await call('POST', 'bucket', { json: { id: BUCKET, name: BUCKET, public: false } })
  if (created.status !== 200 && !/exist/i.test(JSON.stringify(created.data))) throw new Error(`create bucket: HTTP ${created.status}`)
  const b = await call('GET', `bucket/${BUCKET}`)
  if (b.status !== 200) throw new Error(`get bucket: HTTP ${b.status}`)
  // ΑΝ ΚΑΠΟΙΟΣ ΤΟ ΕΚΑΝΕ ΔΗΜΟΣΙΟ, ΣΤΑΜΑΤΑΜΕ. Δεν το διορθώνουμε σιωπηλά: είναι
  // συμβάν ασφαλείας και πρέπει να το δει άνθρωπος.
  if (b.data?.public !== false) {
    console.error(`::error::Το bucket ${BUCKET} είναι ΔΗΜΟΣΙΟ. Κάν' το ιδιωτικό στη Supabase → Storage πριν ανέβει οτιδήποτε.`)
    process.exit(1)
  }
  console.log(`✓ ιδιωτικός χώρος ${BUCKET} έτοιμος`)
}

async function put(local, remote) {
  const buf = readFileSync(local)
  const r = await call('POST', `object/${BUCKET}/${encPath(remote)}`, { body: buf })
  if (r.status !== 200) throw new Error(`upload: HTTP ${r.status}`)
  console.log(`✓ ανέβηκε ένα αρχείο (${(buf.length / 1024).toFixed(0)} KB)`)
}

async function get(remote, local) {
  const res = await call('GET', `object/authenticated/${BUCKET}/${encPath(remote)}`, { raw: true })
  if (res.status !== 200) throw new Error(`download: HTTP ${res.status}`)
  mkdirSync(dirname(local), { recursive: true })
  writeFileSync(local, Buffer.from(await res.arrayBuffer()))
}

async function prune(keepDays) {
  const days = await topFolders()
  const old = daysToPrune(days, new Date().toISOString().slice(0, 10), keepDays)
  for (const d of old) {
    const files = await listAll(BUCKET, d)
    if (!files.length) continue
    const r = await call('DELETE', `object/${BUCKET}`, { json: { prefixes: files.map(f => f.path) } })
    if (r.status !== 200) throw new Error(`delete: HTTP ${r.status}`)
  }
  console.log(`✓ καθαρισμός: ${old.length} ημέρες παλαιότερες από ${keepDays}`)
}

async function check(maxHours) {
  const day = latestDay(await topFolders())
  const files = day ? (await listAll(BUCKET, day)).map(f => f.path.split('/').pop()) : []
  process.stdout.write(JSON.stringify(judge(day, files, Date.now(), maxHours)))
}

/**
 * Κατεβάζει όλα τα αρχεία των buckets σε φάκελο, για να κρυπτογραφηθούν ως ένα
 * αρχείο. Τυπώνει μόνο πλήθη: οι διαδρομές έχουν uid και ονόματα εγγράφων.
 */
async function snapshot(outDir, buckets) {
  let n = 0, bytes = 0
  for (const bucket of buckets) {
    const files = await listAll(bucket)
    for (const f of files) {
      const res = await call('GET', `object/authenticated/${bucket}/${encPath(f.path)}`, { raw: true })
      if (res.status !== 200) throw new Error(`download (${bucket}): HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      const dest = join(outDir, bucket, f.path)
      mkdirSync(dirname(dest), { recursive: true })
      writeFileSync(dest, buf)
      n++; bytes += buf.length
    }
  }
  console.log(`✓ αρχεία χρηστών: ${n} αρχεία, ${(bytes / 1048576).toFixed(1)} MB, από ${buckets.length} buckets`)
}

// ── ΓΡΑΜΜΗ ΕΝΤΟΛΩΝ ───────────────────────────────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [cmd, a, b, ...rest] = process.argv.slice(2)
  const run = {
    ensure: () => ensure(),
    put: () => put(a, b),
    get: () => get(a, b),
    prune: () => prune(Number(a)),
    latest: async () => { process.stdout.write(latestDay(await topFolders()) ?? '') },
    check: () => check(Number(a)),
    snapshot: () => snapshot(a, [b, ...rest].filter(Boolean)),
    // Για τη δοκιμή επαναφοράς. Δεν μιλούν με το Storage.
    count: async () => { process.stdout.write(JSON.stringify(countRows(readFileSync(a, 'utf8'), [b, ...rest].filter(Boolean)))) },
    compare: async () => {
      const r = compareCounts(JSON.parse(readFileSync(a, 'utf8')), JSON.parse(readFileSync(b, 'utf8')))
      for (const x of r.rows) console.log(`${x.ok ? '✓' : '✗'} ${x.table}`)
      if (r.empty) console.log('✗ το αντίγραφο δεν έχει καμία γραμμή στους πίνακες-κλειδιά')
      if (!r.ok) process.exit(1)
    },
  }[cmd]
  if (!run) { console.error(`Άγνωστη εντολή: ${cmd}`); process.exit(2) }
  run().catch(e => { console.error(`::error::${e.message}`); process.exit(1) })
}
