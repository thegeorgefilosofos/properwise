#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΘΕ ΣΕΛΙΔΑ ΤΟΥ ΧΑΡΤΗ ΑΝΟΙΓΕΙ ΚΑΙ ΚΑΘΕ ΣΥΝΔΕΣΜΟΣ ΤΗΣ ΠΑΕΙ ΚΑΠΟΥ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΔΕΝ ΕΛΕΓΧΕ ΚΑΝΕΙΣ. Ο έλεγχος υγείας (supabase/functions/health-check, κάθε
// τέταρτο) ρωτά επτά διαδρομές. Ο χάρτης του site δηλώνει είκοσι πέντε και οι
// σελίδες του δείχνουν σε δεκάδες άλλες, δικές μας και ξένες: τον οδηγό
// δίπλα, το ΦΕΚ, τη σελίδα της ΑΑΔΕ από όπου βγαίνει ο αριθμός. Ενας οδηγός που
// σβήστηκε αφήνει 404 σε κάθε σελίδα που τον ανέφερε. Μια διεύθυνση του
// gov.gr που άλλαξε αφήνει τον επισκέπτη χωρίς την απόδειξη για το νούμερο που
// μόλις διάβασε. Και τα δύο συμβαίνουν χωρίς να αλλάξει γραμμή κώδικα εδώ.
//
// ΤΡΙΑ ΕΠΙΠΕΔΑ, ΜΕ ΤΡΙΑ ΔΙΑΦΟΡΕΤΙΚΑ ΒΑΡΗ:
//
//   1. ΚΑΘΕ ΣΕΛΙΔΑ ΤΟΥ ΧΑΡΤΗ κρίνεται με τον ΙΔΙΟ ορισμό που κρίνει ο έλεγχος
//      υγείας (verdictOf του supabase/functions/_shared/probe.mjs): 200, όχι
//      «Κάτι πήγε στραβά», σώμα που είναι σελίδα, το σήμα «PROPERWISE». Οχι
//      δεύτερο αντίγραφο του κανόνα. Αποτυχία.
//   2. ΚΑΘΕ ΕΣΩΤΕΡΙΚΟΣ ΣΥΝΔΕΣΜΟΣ σε αυτές τις σελίδες δίνει 200 ή σκόπιμη
//      ανακατεύθυνση που καταλήγει σε 200 (π.χ. ο πίνακας ελέγχου στέλνει τον
//      ανώνυμο στη σύνδεση). Αποτυχία.
//   3. ΚΑΘΕ ΕΞΩΤΕΡΙΚΟΣ ΣΥΝΔΕΣΜΟΣ ρωτιέται με HEAD και, αν το αρνηθεί, με GET,
//      με ευγενικό χρονικό όριο. ΠΡΟΕΙΔΟΠΟΙΗΣΗ, ποτέ αποτυχία: τα κρατικά site
//      πέφτουν τα βράδια, κόβουν ρομπότ και απαντούν 403 σε ό,τι δεν είναι
//      περιηγητής. Ενας έλεγχος που κοκκινίζει για το Σαββατοκύριακο της ΑΑΔΕ
//      μαθαίνει τον αναγνώστη να τον αγνοεί.
//
// ΜΟΝΟ ΑΝΑΓΝΩΣΗ. GET και HEAD, τίποτα άλλο. Σειριακά προς το δικό μας site,
// ένα αίτημα τη φορά ανά ξένο host με παύση ανάμεσα. Κανένα cookie, κανένα
// διαπιστευτήριο: βλέπει ό,τι ο ανώνυμος επισκέπτης.
//
//     node scripts/check-links.mjs https://properwise.gr
//     LINKS_OUT=links.md node scripts/check-links.mjs http://localhost:3000
//
// Κωδικός εξόδου: 0 καθαρό ή μόνο προειδοποιήσεις · 1 σελίδα ή εσωτερικός
// σύνδεσμος χαλασμένος · 2 δεν ελέγχθηκε (λείπει βάση, δεν διαβάστηκε χάρτης).
// ═══════════════════════════════════════════════════════════════════════════
import { writeFileSync } from 'node:fs'
import { verdictOf } from '../supabase/functions/_shared/probe.mjs'
import { sitemapLocs, anchorHrefs, classify, internalVerdict, OFFICIAL } from './lib/links.mjs'

const BASE = (process.argv[2] || process.env.LINKS_BASE || '').trim().replace(/\/+$/, '')
if (!BASE) {
  console.error('✗ Λείπει η βάση: node scripts/check-links.mjs https://properwise.gr')
  process.exit(2)
}
const OUT = process.env.LINKS_OUT || ''
const UA = 'properwise-link-check (+https://properwise.gr/trust)'
const TIMEOUT = Number(process.env.LINKS_TIMEOUT_MS || 15000)
const EXT_PAUSE = 400
const MAX_HOPS = 5

const baseUrl = new URL(BASE)
// Ο χάρτης γράφει το δημόσιο domain. Οταν η βάση είναι άλλη (τοπικός
// διακομιστής, preview), οι διευθύνσεις του χάρτη μεταφέρονται στη βάση και
// το δημόσιο domain μετρά επίσης ως «δικό μας» για τους συνδέσμους.
const SITE_HOSTS = [...new Set([baseUrl.hostname, 'properwise.gr', 'www.properwise.gr'])]
const onBase = (u) => { const x = new URL(u); return new URL(x.pathname + x.search, BASE).href }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const get = async (url, method = 'GET') => {
  try {
    const res = await fetch(url, { method, redirect: 'manual', headers: { 'user-agent': UA, accept: 'text/html,*/*' }, signal: AbortSignal.timeout(TIMEOUT) })
    return res
  } catch (e) {
    return { error: e?.name === 'TimeoutError' ? `καμία απάντηση σε ${TIMEOUT / 1000}s` : (e?.cause?.code || e?.message || String(e)) }
  }
}

/** Ακολουθεί ανακατευθύνσεις με το χέρι, ώστε να φαίνεται η αλυσίδα. */
async function chainOf(url) {
  const chain = []
  let cur = url
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const res = await get(cur)
    if (res.error) { chain.push({ url: cur, error: res.error }); return chain }
    await res.arrayBuffer().catch(() => {})
    chain.push({ url: cur, status: res.status })
    if (res.status < 300 || res.status >= 400) return chain
    const loc = res.headers.get('location')
    if (!loc) return chain
    const next = new URL(loc, cur)
    // Σκόπιμη ανακατεύθυνση ΕΞΩ από το site (π.χ. σε σελίδα πληρωμής): η
    // δουλειά μας τελειώνει στο ότι δεν είναι 404 εδώ.
    if (!SITE_HOSTS.includes(next.hostname)) { chain.push({ url: next.href, status: 200, offsite: true }); return chain }
    cur = SITE_HOSTS.includes(next.hostname) && next.hostname !== baseUrl.hostname ? onBase(next.href) : next.href
  }
  return chain
}

// ── 1. Ο χάρτης ──────────────────────────────────────────────────────────
const t0 = Date.now()
const smRes = await get(BASE + '/sitemap.xml')
if (smRes.error || smRes.status !== 200) {
  console.error(`✗ Ο χάρτης ${BASE}/sitemap.xml δεν διαβάστηκε: ${smRes.error || 'κωδικός ' + smRes.status}`)
  process.exit(2)
}
const locs = sitemapLocs(await smRes.text())
if (!locs.length) {
  console.error(`✗ Ο χάρτης ${BASE}/sitemap.xml δεν έχει καμία <loc>.`)
  process.exit(2)
}
const pages = [...new Set(locs.map(onBase))]

// ── 2. Κάθε σελίδα του χάρτη, με τον ορισμό του ελέγχου υγείας ───────────
const pageFails = []
const internal = new Map() // url → [σελίδες όπου βρέθηκε]
const external = new Map()
for (const url of pages) {
  let body = '', status = '—', last
  // Μία επανάληψη μετά από πέντε δευτερόλεπτα: ένα φευγαλέο 502 του CDN δεν
  // είναι χαλασμένη σελίδα. Ιδια λογική με τις ATTEMPTS του ελέγχου υγείας.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA, accept: 'text/html' }, signal: AbortSignal.timeout(TIMEOUT) }).catch((e) => ({ error: e?.message || String(e) }))
    if (res.error) { last = { ok: false, status: '—', why: `δίκτυο: ${res.error}` } }
    else { status = res.status; body = await res.text().catch(() => ''); last = verdictOf(status, body, { must: 'PROPERWISE' }) }
    if (last.ok) break
    if (attempt === 1) await sleep(5000)
  }
  const path = new URL(url).pathname
  if (!last.ok) { pageFails.push({ path, why: last.why }); continue }
  for (const href of anchorHrefs(body)) {
    const c = classify(href, url, SITE_HOSTS)
    if (c.kind === 'skip') continue
    const key = c.kind === 'internal' ? onBase(c.url) : c.url
    const m = c.kind === 'internal' ? internal : external
    if (!m.has(key)) m.set(key, new Set())
    m.get(key).add(path)
  }
}

// ── 3. Οι εσωτερικοί σύνδεσμοι ───────────────────────────────────────────
// Οσοι είναι ήδη σελίδες του χάρτη κρίθηκαν από πάνω, με πιο αυστηρό κανόνα.
const pageSet = new Set(pages)
const intFails = [], redirects = []
for (const [url, from] of internal) {
  if (pageSet.has(url)) continue
  const v = internalVerdict(await chainOf(url))
  const path = new URL(url).pathname + new URL(url).search
  if (!v.ok) intFails.push({ path, why: v.why, from: [...from] })
  else if (v.why) redirects.push({ path, why: v.why })
}

// ── 4. Οι εξωτερικοί, ευγενικά ───────────────────────────────────────────
const byHost = new Map()
for (const [url, from] of external) {
  const h = new URL(url).hostname
  if (!byHost.has(h)) byHost.set(h, [])
  byHost.get(h).push([url, from])
}
const extWarn = []
let extOk = 0
await Promise.all([...byHost.values()].map(async (list) => {
  for (const [url, from] of list) {
    let res = await get(url, 'HEAD')
    // Πολλά κρατικά site αρνούνται το HEAD (405, 403, 501) ενώ το GET
    // δουλεύει. Δεύτερη ευκαιρία με GET πριν γραφτεί προειδοποίηση.
    if (res.error || res.status >= 400) { await sleep(EXT_PAUSE); res = await get(url, 'GET') }
    if (!res.error) await res.arrayBuffer?.().catch(() => {})
    if (res.error || res.status >= 400) extWarn.push({ url, why: res.error ? `δίκτυο: ${res.error}` : `κωδικός ${res.status}`, official: OFFICIAL.test(new URL(url).hostname), from: [...from] })
    else extOk++
    await sleep(EXT_PAUSE)
  }
}))

// ── Η αναφορά ────────────────────────────────────────────────────────────
const secs = Math.round((Date.now() - t0) / 1000)
const lines = []
lines.push(`Ελεγχος συνδέσμων · ${BASE} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ${secs}s`)
lines.push(`${pages.length} σελίδες χάρτη · ${internal.size} εσωτερικοί σύνδεσμοι · ${external.size} εξωτερικοί σε ${byHost.size} host`)
lines.push('')
if (pageFails.length) {
  lines.push(`ΣΕΛΙΔΕΣ ΤΟΥ ΧΑΡΤΗ ΠΟΥ ΔΕΝ ΑΝΟΙΓΟΥΝ ΣΩΣΤΑ (${pageFails.length}):`)
  for (const p of pageFails) lines.push(`  ✗ ${p.path}  ${p.why}`)
  lines.push('')
}
if (intFails.length) {
  lines.push(`ΕΣΩΤΕΡΙΚΟΙ ΣΥΝΔΕΣΜΟΙ ΧΑΛΑΣΜΕΝΟΙ (${intFails.length}):`)
  for (const p of intFails.slice(0, 40)) lines.push(`  ✗ ${p.path}  ${p.why} · από ${p.from.slice(0, 4).join(', ')}${p.from.length > 4 ? ` και ${p.from.length - 4} ακόμη` : ''}`)
  if (intFails.length > 40) lines.push(`  … και ${intFails.length - 40} ακόμη`)
  lines.push('')
}
if (extWarn.length) {
  const off = extWarn.filter((w) => w.official), rest = extWarn.filter((w) => !w.official)
  lines.push(`ΠΡΟΕΙΔΟΠΟΙΗΣΕΙΣ, ΕΞΩΤΕΡΙΚΟΙ ΣΥΝΔΕΣΜΟΙ (${extWarn.length}, από αυτούς ${off.length} επίσημες πηγές):`)
  for (const w of [...off, ...rest].slice(0, 40)) lines.push(`  ⚠ ${w.official ? '[επίσημη] ' : ''}${w.url}  ${w.why} · από ${w.from.slice(0, 3).join(', ')}`)
  lines.push('  Τα κρατικά site πέφτουν και κόβουν ρομπότ: άνοιξέ τα με περιηγητή πριν αλλάξεις σύνδεσμο.')
  lines.push('')
}
if (redirects.length) lines.push(`Σκόπιμες ανακατευθύνσεις (${redirects.length}): ${redirects.slice(0, 12).map((r) => r.path).join(', ')}${redirects.length > 12 ? ' …' : ''}`)
lines.push(`Εξωτερικοί που απάντησαν: ${extOk}/${external.size}.`)
const failed = pageFails.length + intFails.length
lines.push(failed ? `✗ ${failed} πρόβλημα${failed === 1 ? '' : 'τα'} στο δικό μας site.` : '✓ Καμία σελίδα και κανένας εσωτερικός σύνδεσμος χαλασμένος.')

const text = lines.join('\n')
console.log(text)
if (OUT) writeFileSync(OUT, text + '\n')
process.exit(failed ? 1 : 0)
