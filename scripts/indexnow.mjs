#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΕΙΔΟΠΟΙΗΣΗ IndexNow: ΟΙ ΣΕΛΙΔΕΣ ΤΟΥ ΧΑΡΤΗ ΣΕ BING, YANDEX, SEZNAM, NAVER
// ─────────────────────────────────────────────────────────────────────────
//     npm run indexnow                    ίδιο με --dry-run
//     node scripts/indexnow.mjs --dry-run τυπώνει το σώμα, ΚΑΜΙΑ κλήση δικτύου
//     node scripts/indexnow.mjs --live    παίρνει τις διευθύνσεις από το
//                                         ζωντανό /sitemap.xml αντί για το
//                                         app/sitemap.ts (μία ανάγνωση GET)
//     node scripts/indexnow.mjs --send    στέλνει το αίτημα στο IndexNow
//
// Η ΠΡΟΕΠΙΛΟΓΗ ΔΕΝ ΣΤΕΛΝΕΙ ΤΙΠΟΤΑ. Μια ειδοποίηση για σελίδες που δεν έχουν
// ανέβει ακόμη στέλνει τις μηχανές σε 404 και τους μαθαίνει να μας εμπιστεύονται
// λιγότερο. Αποστολή γίνεται μόνο με ρητό `--send`, μετά από ανάπτυξη που
// έχει ήδη σερβίρει το αρχείο του κλειδιού (public/<κλειδί>.txt).
//
// Ο ΧΑΡΤΗΣ ΔΙΑΒΑΖΕΤΑΙ ΑΠΟ ΤΗΝ ΠΗΓΗ ΤΟΥ. Το tsx φορτώνεται μέσα στη διεργασία,
// ώστε το `node scripts/indexnow.mjs` να τρέχει χωρίς βήμα μεταγλώττισης και
// να διαβάζει το ίδιο app/sitemap.ts που σερβίρει η εφαρμογή.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs'
import { register as registerEsm } from 'tsx/esm/api'
import { register as registerCjs } from 'tsx/cjs/api'

const args = new Set(process.argv.slice(2))
const KNOWN = new Set(['--dry-run', '--send', '--live', '--help'])
const unknown = [...args].filter(a => !KNOWN.has(a))

if (args.has('--help') || unknown.length) {
  if (unknown.length) console.error(`✗ Άγνωστη επιλογή: ${unknown.join(' ')}\n`)
  console.log('Χρήση: node scripts/indexnow.mjs [--dry-run | --send] [--live]')
  console.log('  --dry-run  τυπώνει το σώμα του αιτήματος χωρίς δίκτυο (προεπιλογή)')
  console.log('  --send     στέλνει το αίτημα στο IndexNow')
  console.log('  --live     διευθύνσεις από το ζωντανό /sitemap.xml αντί για το app/sitemap.ts')
  process.exit(unknown.length ? 2 : 0)
}
if (args.has('--send') && args.has('--dry-run')) {
  console.error('✗ Το --send και το --dry-run αποκλείονται: διάλεξε ένα.')
  process.exit(2)
}
const SEND = args.has('--send')

registerEsm()
registerCjs()
const src = await import('./lib/indexnow-source.ts')
const { SITE, INDEXNOW_KEY, INDEXNOW_ENDPOINT, indexNowPayload, sitemapUrls } = src.default ?? src

/** Οι διευθύνσεις του ζωντανού χάρτη, από τα <loc> του. */
async function liveUrls() {
  const res = await fetch(`${SITE}/sitemap.xml`, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`Ο χάρτης ${SITE}/sitemap.xml απάντησε ${res.status}`)
  const xml = await res.text()
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&'))
}

let payload
try {
  payload = indexNowPayload(args.has('--live') ? await liveUrls() : sitemapUrls())
} catch (e) {
  console.error(`✗ ${e instanceof Error ? e.message : e}`)
  process.exit(1)
}

// ΤΟ ΚΛΕΙΔΙ ΠΡΕΠΕΙ ΝΑ ΣΕΡΒΙΡΕΤΑΙ, ΑΛΛΙΩΣ Η ΑΠΑΝΤΗΣΗ ΕΙΝΑΙ 403. Ελέγχεται το
// τοπικό αντίγραφο: αν λείπει εδώ, δεν θα υπάρχει ούτε στην ανάπτυξη.
const KEY_FILE = `public/${INDEXNOW_KEY}.txt`
const keyOk = existsSync(KEY_FILE) && readFileSync(KEY_FILE, 'utf8') === INDEXNOW_KEY

if (!SEND) {
  console.log(JSON.stringify(payload, null, 2))
  console.error(`\n(δοκιμαστική εκτέλεση: ${payload.urlList.length} διευθύνσεις, τίποτα δεν στάλθηκε· ${keyOk ? 'το αρχείο του κλειδιού συμφωνεί' : `✗ το ${KEY_FILE} λείπει ή διαφέρει`})`)
  process.exit(keyOk ? 0 : 1)
}

if (!keyOk) {
  console.error(`✗ Το ${KEY_FILE} λείπει ή δεν περιέχει ακριβώς το κλειδί. Δεν στάλθηκε τίποτα.`)
  process.exit(1)
}

// Οι κωδικοί απάντησης, όπως τους ορίζει η τεκμηρίωση του πρωτοκόλλου.
const MEANING = {
  200: 'εντάξει, οι διευθύνσεις παραδόθηκαν',
  202: 'παραλήφθηκε· το κλειδί ελέγχεται ακόμη',
  400: 'άκυρη μορφή αιτήματος',
  403: 'το κλειδί δεν βρέθηκε ή δεν συμφωνεί με το αρχείο του',
  422: 'διευθύνσεις εκτός τομέα ή κλειδί που δεν ταιριάζει',
  429: 'πάρα πολλά αιτήματα· ξαναδοκίμασε αργότερα',
}

const res = await fetch(INDEXNOW_ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(30000),
})
const meaning = MEANING[res.status] ?? 'απρόσμενη απάντηση'
if (res.ok) {
  console.log(`✓ IndexNow ${res.status}: ${meaning} (${payload.urlList.length} διευθύνσεις του ${payload.host})`)
  process.exit(0)
}
console.error(`✗ IndexNow ${res.status}: ${meaning}`)
const body = await res.text().catch(() => '')
if (body) console.error(body.slice(0, 500))
process.exit(1)
