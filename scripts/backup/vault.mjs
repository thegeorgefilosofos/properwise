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
// `anon` ή `authenticated`. Η κρυπτογράφηση με gpg μένει, ως δεύτερη άμυνα.
//
// Η ΜΟΡΦΗ ΜΙΑΣ ΕΚΤΕΛΕΣΗΣ. Φάκελος `YYYY-MM-DDTHHMMSSZ/`, ένας ανά εκτέλεση:
// μια δεύτερη εκτέλεση την ίδια μέρα δεν γράφει ποτέ πάνω σε σφραγισμένο φάκελο. Κάθε αρχείο ανεβαίνει σε κομμάτια
// `<όνομα>.part-000`, `-001` … των 45 MB το πολύ, γιατί το δωρεάν πακέτο
// δέχεται ως 50 MB ανά αρχείο. Τελευταίο ανεβαίνει το `manifest.json`: λέει
// ποια κομμάτια ανήκουν σε ποιο αρχείο, με μέγεθος και sha256. ΧΩΡΙΣ manifest η
// ημέρα δεν μετρά ως αντίγραφο: ούτε για τον φύλακα ούτε για την επαναφορά. Ούτε
// προστατεύεται από τον καθαρισμό.
//
// ΤΙ ΔΕΝ ΓΡΑΦΕΙ ΠΟΤΕ ΣΤΟ LOG. Τα logs ενός δημόσιου αποθετηρίου είναι
// δημόσια. Οι διαδρομές των αρχείων των χρηστών έχουν uid και ονόματα
// εγγράφων, οπότε εδώ τυπώνονται ΜΟΝΟ πλήθη και μεγέθη. Το κλειδί δεν τυπώνεται
// ποτέ· η ροή το κρύβει με `::add-mask::` πριν το δει οτιδήποτε.
//
// ΧΡΗΣΗ (μεταβλητές SUPABASE_URL και SUPABASE_SERVICE_KEY· με VAULT_READONLY=1
// αρνείται κάθε κλήση που γράφει ή σβήνει):
//   ensure                                   φτιάχνει το bucket, ιδιωτικό
//   put-split <αρχείο> <ημέρα> <όνομα> <manifest>   ανεβάζει σε κομμάτια
//   seal <manifest> <ημέρα>                  ανεβάζει το manifest, τελευταίο
//   size-check <data.sql.gpg> [allow-shrink] όχι κάτω από το μισό του προηγούμενου
//   rows-check <data.sql> <πίνακας> …        όχι 0 γραμμές όπου η παραγωγή έχει
//   prune <ημέρες>                           κράτηση· η τελευταία καλή ημέρα μένει
//   check <ώρες> <ημέρες αρχείων>            JSON για τον φύλακα
//   latest                                   η τελευταία ημέρα με manifest
//   get-joined <ημέρα> <όνομα> <αρχείο>      κατεβάζει, ελέγχει sha256, ενώνει
//   verify-files                             το πιο πρόσφατο σετ αρχείων είναι πλήρες
//   snapshot <φάκελος> <bucket> [<bucket> …]
//   tables <schema.sql> <πίνακας> …          λείπει πίνακας-κλειδί από το σχήμα;
//   count <data.sql> <πίνακας> …             → JSON
//   compare <αναμενόμενα.json> <πραγματικά.json>
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdirSync, existsSync, openSync, readSync, closeSync, statSync, appendFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

export const BUCKET = 'db-backups'
export const MANIFEST = 'manifest.json'
/** 45 MB: κάτω από το όριο των 50 MB ανά αρχείο (supabase.com/docs/guides/storage/uploads/file-limits). */
export const PART_BYTES = 45 * 1024 * 1024
/** Τα αρχεία που πρέπει να έχει κάθε ημέρα. */
export const REQUIRED = ['roles.sql.gpg', 'schema.sql.gpg', 'data.sql.gpg']
/** Το σετ των αρχείων χρηστών, που γράφεται την Κυριακή. */
export const FILES_SET = 'files.tar.gpg'
/** Ελάχιστο μέγεθος νέου dump δεδομένων, ως μέρος του προηγούμενου καλού. */
export const MIN_SIZE_RATIO = 0.5

// ── ΚΑΘΑΡΕΣ ΣΥΝΑΡΤΗΣΕΙΣ (ελέγχονται στο lib/backup/vault.test.ts) ────────────

/**
 * Φάκελος πρώτου επιπέδου: μία εκτέλεση, `YYYY-MM-DDTHHMMSSZ`. Οι παλιοί φάκελοι
 * `YYYY-MM-DD` διαβάζονται κι αυτοί. Ταξινομούνται σωστά ως κείμενο.
 */
export const DAY = /^\d{4}-\d{2}-\d{2}(T\d{6}Z)?$/

/** Το όνομα του φακέλου μιας εκτέλεσης που ξεκίνησε τη στιγμή `ms`. */
export const runFolder = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/^(\d{4})(\d{2})(\d{2})T(\d{6}).*$/, '$1-$2-$3T$4Z')

const dateOf = d => Date.parse(d.slice(0, 10) + 'T00:00:00Z')

/**
 * Οι φάκελοι που πρέπει να σβηστούν: όσοι έχουν κλείσει `keepDays` ημέρες. Το
 * αντίγραφο της 11/10 σβήνεται στις 10/11, όχι μία μέρα αργότερα.
 *
 * Το `protect` κρατά την τελευταία καλή εκτέλεση της βάσης ΚΑΙ την τελευταία με
 * σετ αρχείων: δεν σβήνονται ΠΟΤΕ. Κι αν δεν υπάρχει καμία καλή ενώ υπάρχουν
 * φάκελοι, δεν σβήνεται ΤΙΠΟΤΑ: ο καθαρισμός δεν αδειάζει ποτέ τον χώρο.
 */
export function daysToPrune(days, today, keepDays, protect = []) {
  const valid = days.filter(d => DAY.test(d))
  if (valid.length && !protect.length) return []
  const cutoff = Date.parse(today + 'T00:00:00Z') - keepDays * 86400000
  return valid.filter(d => !protect.includes(d) && dateOf(d) <= cutoff).sort()
}

/** Η πιο πρόσφατη ημέρα, ή null. Αγνοεί ό,τι δεν είναι ημερομηνία. */
export function latestDay(days) {
  const ok = days.filter(d => DAY.test(d)).sort()
  return ok.length ? ok[ok.length - 1] : null
}

/** Το όνομα του κομματιού `i` ενός αρχείου. */
export const partName = (name, i) => `${name}.part-${String(i).padStart(3, '0')}`

/** Τα όρια των κομματιών για αρχείο `total` bytes. Ένα κενό αρχείο έχει ένα κενό κομμάτι. */
export function splitPlan(total, partBytes = PART_BYTES) {
  const out = []
  for (let start = 0; start < total || out.length === 0; start += partBytes) out.push({ start, end: Math.min(total, start + partBytes) })
  return out
}

/**
 * Κομμάτια που γράφει το manifest για ένα αρχείο αλλά λείπουν από τον χώρο ή
 * έχουν άλλο μέγεθος. `objects`: [{ name, size }] από τη λίστα του bucket.
 */
export function missingParts(entry, objects) {
  const size = new Map(objects.map(o => [o.name, o.size]))
  return (entry?.parts ?? []).filter(p => size.get(p.name) !== p.bytes).map(p => p.name)
}

/**
 * Η απάντηση του Storage για ένα manifest. 404, ή 400 με `statusCode: "404"`
 * στο σώμα (έτσι απαντά το Storage για αρχείο που λείπει) = δεν υπάρχει. Κάθε
 * άλλο σφάλμα (5xx, 429) ή μη αναγνώσιμο JSON ΡΙΧΝΕΙ: ένα σφάλμα δικτύου δεν
 * επιτρέπεται να διαβαστεί ως «δεν υπάρχει καλό αντίγραφο».
 */
export function parseManifest(status, text) {
  if (status === 200) {
    try { return JSON.parse(text) } catch { throw new Error('μη αναγνώσιμο manifest') }
  }
  if (status === 404) return null
  if (status === 400) {
    let body = null
    try { body = JSON.parse(text) } catch { /* όχι JSON: σφάλμα */ }
    if (String(body?.statusCode) === '404') return null
  }
  throw new Error(`manifest: HTTP ${status}`)
}

/**
 * Κρίνει αν το τελευταίο αντίγραφο είναι υγιές: πρόσφατο, σφραγισμένο με
 * manifest, πλήρες σε κομμάτια και ΜΟΝΟ κρυπτογραφημένο.
 */
export function judge({ day, manifest, objects, nowMs, maxHours }) {
  if (!day || !manifest) return { ok: false, reason: 'Δεν βρέθηκε ΚΑΝΕΝΑ ολοκληρωμένο αντίγραφο (με manifest) στον ιδιωτικό χώρο.' }
  // Το αντίγραφο γράφεται στις 02:00 UTC· η ηλικία μετρά από το τέλος της ημέρας του.
  const ageH = Math.floor((nowMs - (dateOf(day) + 86400000)) / 3600000)
  if (ageH > maxHours) return { ok: false, reason: `Το τελευταίο ολοκληρωμένο αντίγραφο είναι της ${day}, πάνω από ${maxHours} ώρες πριν.` }
  if (objects.some(f => /\.sql$/.test(f.name))) return { ok: false, reason: 'Το αντίγραφο περιέχει ΜΗ κρυπτογραφημένο .sql.' }
  if (manifest.verified !== true) return { ok: false, reason: `Το manifest της ${day} δεν γράφει ότι πέρασε τον έλεγχο υγείας.` }
  const absent = REQUIRED.filter(n => !manifest.files?.[n])
  if (absent.length) return { ok: false, reason: `Λείπουν από το αντίγραφο της ${day}: ${absent.join(', ')}.` }
  const lost = Object.values(manifest.files).flatMap(e => missingParts(e, objects))
  if (lost.length) return { ok: false, reason: `Το αντίγραφο της ${day} έχει ${lost.length} κομμάτια του manifest που λείπουν ή έχουν άλλο μέγεθος.` }
  return { ok: true, day }
}

/** Το πιο πρόσφατο σετ αρχείων χρηστών: υπάρχει, είναι πλήρες και όχι παλιότερο από `maxDays`. */
export function judgeFiles({ day, manifest, objects, nowMs, maxDays }) {
  const entry = manifest?.files?.[FILES_SET]
  if (!day || !entry) return { ok: false, reason: 'Δεν βρέθηκε κανένα αντίγραφο των αρχείων των χρηστών.' }
  const ageD = Math.floor((nowMs - dateOf(day)) / 86400000)
  if (ageD > maxDays) return { ok: false, reason: `Το τελευταίο αντίγραφο των αρχείων χρηστών είναι της ${day}, πάνω από ${maxDays} ημέρες πριν.` }
  const lost = missingParts(entry, objects)
  if (lost.length) return { ok: false, reason: `Το αντίγραφο αρχείων της ${day} είναι ελλιπές: ${lost.length} κομμάτια λείπουν ή έχουν άλλο μέγεθος.` }
  return { ok: true, day }
}

/**
 * Το νέο dump δεδομένων δεν είναι ύποπτα μικρό σε σχέση με το προηγούμενο καλό.
 * `allowShrink`: ρητή χειροκίνητη παράκαμψη μετά από νόμιμη μείωση δεδομένων
 * (input `allow_shrink` του workflow_dispatch). Ένα κενό αρχείο δεν περνά ποτέ.
 */
export function sizeOk(curr, prev, ratio = MIN_SIZE_RATIO, allowShrink = false) {
  if (!(curr > 0)) return false
  return allowShrink || !(prev > 0) || curr >= prev * ratio
}

/**
 * Γραμμές του dump απέναντι στην παραγωγή τη στιγμή του dump. Ένας πίνακας
 * περνά αν η παραγωγή μετρήθηκε (≥ 0) και το dump δεν έχει 0 εκεί που εκείνη
 * έχει. Όχι ισότητα: η εφαρμογή γράφει όσο τρέχει το dump.
 */
export function rowsHealthy(dump, prod) {
  const rows = Object.keys(dump).map(t => {
    const p = Number(prod[t])
    return { table: t, ok: Number.isInteger(p) && p >= 0 && !(p > 0 && dump[t] === 0) }
  })
  return { ok: rows.every(r => r.ok), rows }
}

/** Οι πίνακες-κλειδιά που δεν δημιουργεί το σχήμα. */
export function missingTables(schemaSql, tables) {
  return tables.filter(t => !new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?(?:"public"|public)\\.(?:"${reLit(t)}"|${reLit(t)})[\\s(]`, 'i').test(schemaSql))
}

/** Σε λειτουργία μόνο ανάγνωσης επιτρέπονται λήψη και λίστα, τίποτε άλλο. */
export function readonlyAllows(method, path) {
  return method === 'GET' || (method === 'POST' && path.startsWith('object/list/'))
}

/** Όνομα πίνακα ως κυριολεκτικό κείμενο μέσα σε regex. */
const reLit = t => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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
  const name = t => new RegExp(`^(?:"public"|public)\\.(?:"${reLit(t)}"|${reLit(t)})[\\s(]`)
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
  if (process.env.VAULT_READONLY === '1' && !readonlyAllows(method, path)) {
    throw new Error(`άρνηση σε λειτουργία μόνο ανάγνωσης: ${method}`)
  }
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

async function upload(remote, buf) {
  const r = await call('POST', `object/${BUCKET}/${encPath(remote)}`, { body: buf })
  if (r.status !== 200) throw new Error(`upload: HTTP ${r.status}`)
}

async function download(bucket, remote) {
  const res = await call('GET', `object/authenticated/${bucket}/${encPath(remote)}`, { raw: true })
  if (res.status !== 200) throw new Error(`download: HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

const sha256 = buf => createHash('sha256').update(buf).digest('hex')

/** Το manifest ενός φακέλου, ή null αν δεν σφραγίστηκε. Σε σφάλμα ρίχνει. */
async function manifestOf(day) {
  const res = await call('GET', `object/authenticated/${BUCKET}/${day}/${MANIFEST}`, { raw: true })
  return parseManifest(res.status, await res.text())
}

/** Η πιο πρόσφατη ημέρα με manifest που πέρασε τον έλεγχο, με το manifest της. */
async function latestGood(filter = () => true) {
  const days = (await topFolders()).filter(d => DAY.test(d)).sort().reverse()
  for (const day of days) {
    const manifest = await manifestOf(day)
    if (manifest?.verified === true && filter(manifest)) return { day, manifest }
  }
  return { day: null, manifest: null }
}

/** Ανεβάζει ένα αρχείο σε κομμάτια και το γράφει στο τοπικό manifest. */
async function putSplit(local, day, name, manifestPath) {
  const total = statSync(local).size
  const fd = openSync(local, 'r')
  const parts = []
  try {
    for (const [i, { start, end }] of splitPlan(total).entries()) {
      const buf = Buffer.alloc(end - start)
      readSync(fd, buf, 0, buf.length, start)
      const pn = partName(name, i)
      await upload(`${day}/${pn}`, buf)
      parts.push({ name: pn, bytes: buf.length, sha256: sha256(buf) })
    }
  } finally { closeSync(fd) }
  const m = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { files: {} }
  m.files[name] = { bytes: total, parts }
  writeFileSync(manifestPath, JSON.stringify(m))
  console.log(`✓ ανέβηκε ένα αρχείο: ${parts.length} κομμάτια, ${(total / 1048576).toFixed(1)} MB`)
}

/** Σφραγίζει τον φάκελο. ΤΕΛΕΥΤΑΙΟ βήμα: πριν από αυτό η εκτέλεση δεν μετρά. */
async function seal(manifestPath, day) {
  if (await manifestOf(day)) throw new Error(`ο φάκελος ${day} είναι ήδη σφραγισμένος· δεν γράφεται ξανά`)
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const absent = REQUIRED.filter(n => !m.files?.[n])
  if (absent.length) throw new Error(`δεν σφραγίζεται: λείπουν ${absent.join(', ')}`)
  m.day = day
  m.verified = true
  await upload(`${day}/${MANIFEST}`, Buffer.from(JSON.stringify(m)))
  console.log(`✓ η ημέρα ${day} σφραγίστηκε (${Object.keys(m.files).length} αρχεία)`)
}

async function sizeCheck(local, allow) {
  const { day, manifest } = await latestGood()
  const prev = manifest?.files?.['data.sql.gpg']?.bytes ?? 0
  const allowShrink = allow === 'allow-shrink'
  if (!sizeOk(statSync(local).size, prev, MIN_SIZE_RATIO, allowShrink)) {
    throw new Error(`το νέο dump δεδομένων είναι κάτω από το ${MIN_SIZE_RATIO * 100}% του τελευταίου καλού (${day}). Δεν ανεβαίνει. Μετά από νόμιμη μείωση δεδομένων: Run workflow με allow_shrink.`)
  }
  if (allowShrink && prev) console.log('⚠ χειροκίνητη παράκαμψη του ελέγχου μεγέθους (allow_shrink)')
  console.log(prev ? `✓ μέγεθος εντάξει σε σχέση με το αντίγραφο της ${day}` : '✓ πρώτο αντίγραφο: δεν υπάρχει προηγούμενο για σύγκριση')
}

/** Γραμμές ανά πίνακα στην παραγωγή, από το PostgREST με τον service role. -1 αν δεν μετρήθηκε. */
async function prodCount(t) {
  const { url, key } = env()
  const res = await fetch(`${url}/rest/v1/${encodeURIComponent(t)}?select=*`, {
    method: 'HEAD', headers: { Authorization: `Bearer ${key}`, apikey: key, Prefer: 'count=exact' },
  })
  const n = Number(/\/(\d+)$/.exec(res.headers.get('content-range') ?? '')?.[1])
  return res.ok && Number.isInteger(n) ? n : -1
}

async function rowsCheck(local, tables) {
  const dump = countRows(readFileSync(local, 'utf8'), tables)
  const prod = Object.fromEntries(await Promise.all(tables.map(async t => [t, await prodCount(t)])))
  const r = rowsHealthy(dump, prod)
  for (const x of r.rows) {
    const why = x.ok ? '' : prod[x.table] < 0
      ? ' (η παραγωγή δεν μετρήθηκε: PostgREST, service role, schema public)'
      : ' (0 γραμμές στο dump, ενώ η παραγωγή έχει)'
    console.log(`${x.ok ? '✓' : '✗'} ${x.table}${why}`)
  }
  const bad = r.rows.filter(x => !x.ok).map(x => x.table)
  if (bad.length) throw new Error(`έλεγχος γραμμών: αποτυχία στους πίνακες ${bad.join(', ')}`)
}

async function prune(keepDays) {
  const days = await topFolders()
  const { day: good } = await latestGood()
  const { day: goodFiles } = await latestGood(m => !!m.files?.[FILES_SET])
  const protect = [good, goodFiles].filter(Boolean)
  const old = daysToPrune(days, new Date().toISOString().slice(0, 10), keepDays, protect)
  for (const d of old) {
    const files = await listAll(BUCKET, d)
    if (!files.length) continue
    const r = await call('DELETE', `object/${BUCKET}`, { json: { prefixes: files.map(f => f.path) } })
    if (r.status !== 200) throw new Error(`delete: HTTP ${r.status}`)
  }
  console.log(protect.length
    ? `✓ καθαρισμός: σβήστηκαν ${old.length} φάκελοι· μένουν η τελευταία καλή βάση (${good}) και τα τελευταία καλά αρχεία (${goodFiles ?? 'κανένα'})`
    : '✓ καθαρισμός: καμία καλή εκτέλεση ακόμη, δεν σβήνεται τίποτα')
}

async function check(maxHours, filesDays) {
  const now = Date.now()
  const named = async day => day ? (await listAll(BUCKET, day)).map(o => ({ name: o.path.split('/').pop(), size: o.size })) : []
  const g = await latestGood()
  const db = judge({ ...g, objects: await named(g.day), nowMs: now, maxHours })
  if (!db.ok) return process.stdout.write(JSON.stringify(db))
  // Πέρα από πλήθος και μέγεθος: το sha256 κάθε κομματιού της βάσης.
  try {
    for (const n of REQUIRED) await getJoined(g.day, n, null, true)
  } catch (e) {
    return process.stdout.write(JSON.stringify({ ok: false, reason: `Το αντίγραφο της ${g.day} δεν περνά τον έλεγχο sha256: ${e.message}` }))
  }
  const f = await latestGood(m => !!m.files?.[FILES_SET])
  const fobjects = await named(f.day)
  const files = judgeFiles({ ...f, objects: fobjects, nowMs: now, maxDays: filesDays })
  process.stdout.write(JSON.stringify(files.ok ? { ok: true, day: db.day, filesDay: files.day } : files))
}

/** Κατεβάζει όλα τα κομμάτια ενός αρχείου, ελέγχει μέγεθος και sha256, τα ενώνει. */
async function getJoined(day, name, local, quiet = false) {
  const m = await manifestOf(day)
  const entry = m?.files?.[name]
  if (!entry) throw new Error(`το ${name} δεν υπάρχει στο manifest της ${day}`)
  if (local) { mkdirSync(dirname(local), { recursive: true }); rmSync(local, { force: true }) }
  let bytes = 0
  for (const p of entry.parts) {
    const buf = await download(BUCKET, `${day}/${p.name}`)
    if (buf.length !== p.bytes || sha256(buf) !== p.sha256) throw new Error(`κομμάτι του ${name} της ${day} αλλοιωμένο`)
    if (local) appendFileSync(local, buf)
    bytes += buf.length
  }
  if (bytes !== entry.bytes) throw new Error(`το ${name} της ${day} δεν έχει το μέγεθος του manifest`)
  if (!quiet) console.log(`✓ ${name}: ${entry.parts.length} κομμάτια, sha256 εντάξει`)
}

async function verifyFiles() {
  const f = await latestGood(m => !!m.files?.[FILES_SET])
  if (!f.day) throw new Error('δεν υπάρχει κανένα αντίγραφο των αρχείων των χρηστών')
  await getJoined(f.day, FILES_SET, null)
  console.log(`✓ το πιο πρόσφατο σετ αρχείων (${f.day}) είναι πλήρες`)
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
  const [cmd, a, b, c, d, ...rest] = process.argv.slice(2)
  const list = [b, c, d, ...rest].filter(Boolean)
  const run = {
    ensure: () => ensure(),
    'put-split': () => putSplit(a, b, c, d),
    seal: () => seal(a, b),
    'size-check': () => sizeCheck(a, b),
    'rows-check': () => rowsCheck(a, list),
    prune: () => prune(Number(a)),
    check: () => check(Number(a), Number(b)),
    latest: async () => { process.stdout.write((await latestGood()).day ?? '') },
    folder: async () => { process.stdout.write(runFolder(Date.now())) },
    'get-joined': () => getJoined(a, b, c),
    'verify-files': () => verifyFiles(),
    snapshot: () => snapshot(a, list),
    // Δεν μιλούν με το Storage.
    tables: async () => {
      const missing = missingTables(readFileSync(a, 'utf8'), list)
      if (missing.length) { console.error(`::error::Το σχήμα δεν έχει τους πίνακες: ${missing.join(', ')}`); process.exit(1) }
      console.log(`✓ το σχήμα έχει και τους ${list.length} πίνακες-κλειδιά`)
    },
    count: async () => { process.stdout.write(JSON.stringify(countRows(readFileSync(a, 'utf8'), list))) },
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
