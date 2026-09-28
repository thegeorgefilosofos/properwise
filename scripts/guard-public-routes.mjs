#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΟΤΙ ΕΙΝΑΙ ΣΥΝΔΕΔΕΜΕΝΟ ΑΠΟ ΤΟ ΔΗΜΟΣΙΟ ΥΠΟΣΕΛΙΔΟ, ΑΝΟΙΓΕΙ ΧΩΡΙΣ ΣΥΝΔΕΣΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΕΓΙΝΕ, ΜΕ ΟΝΟΜΑ. Ο τρίτος υπολογιστής, το «Βραχυχρόνια ή
// μακροχρόνια;», μπήκε στον ιστότοπο, μπήκε στο υποσέλιδο ΚΑΘΕ σελίδας και
// ξεχάστηκε από τον κατάλογο δημόσιων διαδρομών του `proxy.ts`. Δηλαδή ένα
// δωρεάν εργαλείο, φτιαγμένο για να απαντά ΠΡΙΝ μας ξέρει κανείς, ζητούσε
// σύνδεση σε όποιον πατούσε τον σύνδεσμο.
//
// Κανένα σφάλμα πουθενά: το build πέρασε καθαρό, τα τεστ πέρασαν, ο τύπος ήταν
// σωστός. Η σελίδα απλώς γύριζε 307 προς τη σύνδεση.
//
// ── Ο ΚΑΝΟΝΑΣ ───────────────────────────────────────────────────────────
// Αν ένας σύνδεσμος φαίνεται στο υποσέλιδο ή στην κεφαλίδα που βλέπει ο
// ΑΝΩΝΥΜΟΣ επισκέπτης, τότε ο προορισμός του πρέπει να ανοίγει χωρίς σύνδεση.
// Ένας σύνδεσμος που οδηγεί σε τοίχο δεν είναι σύνδεσμος, είναι παγίδα.
//
// Οι διαδρομές με διακριτικό (/portal/, /accountant/, /checkin/, /verify/,
// /unsubscribe/) εξαιρούνται: η πρόσβασή τους κρίνεται από το ίδιο το
// διακριτικό και δεν εμφανίζονται ποτέ ως σταθεροί σύνδεσμοι.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'

const CHROME = 'app/PublicChrome.tsx'
const PROXY = 'proxy.ts'
// ── ΚΑΙ Ο ΧΑΡΤΗΣ ΤΟΥ ΙΣΤΟΤΟΠΟΥ ────────────────────────────────────────────
// Το ίδιο σφάλμα ξαναέγινε, από άλλη πόρτα. Η σελίδα «Τι περιλαμβάνει κάθε
// πακέτο» δεν είναι συνδεδεμένη από το δημόσιο κέλυφος — ο δρόμος της ξεκινά
// από τις ρυθμίσεις και από τη μηχανή αναζήτησης — οπότε ο έλεγχος από πάνω
// δεν την έβλεπε ΠΟΤΕ. Ημασταν όμως εμείς που είπαμε στη Google να την
// ευρετηριάσει: ο,τι μπαίνει στον χάρτη υπόσχεται ότι ανοίγει.
const SITEMAP = 'app/sitemap.ts'

const chrome = readFileSync(CHROME, 'utf8')
const proxy = readFileSync(PROXY, 'utf8')
const sitemap = readFileSync(SITEMAP, 'utf8')

/** Ο κατάλογος δημόσιων διαδρομών, όπως τον γράφει ο διαμεσολαβητής. */
const block = /const PUBLIC = new Set\(\[([\s\S]*?)\]\)/.exec(proxy)
if (!block) {
  console.error(`✗ Ο κατάλογος PUBLIC δεν βρέθηκε στο ${PROXY}.`)
  process.exit(1)
}
const publicRoutes = new Set([...block[1].matchAll(/"([^"]+)"/g)].map(m => m[1]))
// ── ΚΑΙ ΤΑ ΔΗΜΟΣΙΑ ΠΡΟΘΕΜΑΤΑ ─────────────────────────────────────────────
// Το `isPublic` δέχεται και προθέματα (`pathname.startsWith("/odigos/")`).
// Διαβάζονται από την ίδια έκφραση, ώστε ο φύλακας να κρίνει ό,τι κρίνει και ο
// διαμεσολαβητής, όχι ένα αντίγραφό του.
const isPublicExpr = /const isPublic = ([\s\S]*?);\n/.exec(proxy)?.[1] ?? ''
const publicPrefixes = [...isPublicExpr.matchAll(/pathname\.startsWith\("([^"]+)"\)/g)].map(m => m[1])

/** Κάθε εσωτερική διαδρομή που εμφανίζεται ως σύνδεσμος στο δημόσιο κέλυφος. */
const linked = new Set()
/** Η διαδρομή χωρίς άγκυρα και χωρίς ερώτημα: «/#faq» είναι η αρχική σελίδα. */
const route = (href) => href.split(/[#?]/)[0] || '/'
for (const m of chrome.matchAll(/href=["'](\/[^"']*)["']/g)) linked.add(route(m[1]))
for (const m of chrome.matchAll(/\['(\/[^']*)',\s*'/g)) linked.add(route(m[1]))
// Ο χάρτης γράφει «${base}/διαδρομή»: κρατάμε ό,τι ακολουθεί τη βάση.
for (const m of sitemap.matchAll(/\$\{base\}(\/[^`]*)`/g)) linked.add(route(m[1]))
// ── ΚΑΙ ΟΙ ΟΔΗΓΟΙ ΤΟΥ ΚΑΤΑΛΟΓΟΥ ────────────────────────────────────────────
// Ο χάρτης τους γράφει με `GUIDES.map(g => base + g.href)`, όχι ως κείμενο,
// οπότε ο έλεγχος από πάνω δεν τους έβλεπε. Ετσι πέρασαν πέντε οδηγοί στον
// χάρτη που γύριζαν 307 προς το /login (27.09.2026). Διαβάζεται ο κατάλογος.
const GUIDES_FILE = 'app/odigos/guides.ts'
for (const m of readFileSync(GUIDES_FILE, 'utf8').matchAll(/href:\s*'(\/[^']+)'/g)) linked.add(route(m[1]))

const TOKEN_PREFIXES = ['/portal/', '/accountant/', '/checkin/', '/verify/', '/unsubscribe/']
const missing = [...linked]
  .filter(r => !TOKEN_PREFIXES.some(p => r.startsWith(p)))
  .filter(r => !publicRoutes.has(r))
  .filter(r => !publicPrefixes.some(p => r.startsWith(p)))
  .sort()

if (missing.length) {
  console.error(`\n✗ ${missing.length} δημόσιες διαδρομές οδηγούν σε σελίδα που ζητά σύνδεση:\n`)
  for (const r of missing) console.error(`  ${r}`)
  console.error(`\nΠρόσθεσέ τες στον κατάλογο PUBLIC του ${PROXY}, ή βγάλε τη διαδρομή από το κέλυφος και τον χάρτη.`)
  process.exit(1)
}

// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΙ ΑΝΑΠΟΔΑ: ΚΑΘΕ ΣΕΛΙΔΑ ΕΧΕΙ ΔΗΛΩΜΕΝΗ ΠΟΡΤΑ
// ─────────────────────────────────────────────────────────────────────────
// Από 28.09.2026 ο διαμεσολαβητής στέλνει στη σύνδεση ΜΟΝΟ τις διαδρομές του
// `PRIVATE_PREFIXES`· ό,τι άλλο δεν είναι δημόσιο περνά, ώστε μια άγνωστη
// διεύθυνση να δίνει «δεν βρέθηκε» και όχι φόρμα εισόδου. Το τίμημα: μια νέα
// ιδιωτική σελίδα που κανείς δεν γράφει στον κατάλογο θα άνοιγε χωρίς σύνδεση.
// Εδώ κόβεται: κάθε σελίδα του app/ πρέπει να είναι δημόσια, με διακριτικό,
// εξαιρεμένη από τον διαμεσολαβητή ή ιδιωτική — ρητά, με το όνομά της.
// ═══════════════════════════════════════════════════════════════════════════
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const privBlock = /const PRIVATE_PREFIXES = \[([^\]]*)\]/.exec(proxy)
if (!privBlock) {
  console.error(`✗ Ο κατάλογος PRIVATE_PREFIXES δεν βρέθηκε στο ${PROXY}.`)
  process.exit(1)
}
const privatePrefixes = [...privBlock[1].matchAll(/"([^"]+)"/g)].map(m => m[1])
const isPrivateRoute = (r) => privatePrefixes.some(p => r === p || r.startsWith(p + '/'))
// Ό,τι εξαιρεί το `matcher` δεν περνά καν από τον διαμεσολαβητή (/health, /og/).
const MATCHER_EXCLUDED = ['/health', '/og/']

/** Οι διαδρομές σελίδων του app/, με τα δυναμικά τμήματα ως πρόθεμα: app/portal/[token] → «/portal/». */
function pageRoutes(dir = 'app', base = '') {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (!statSync(full).isDirectory()) {
      if (/^(page|route)\.tsx?$/.test(name)) out.push(base || '/')
      continue
    }
    if (name === 'api' && !base) continue
    if (name.startsWith('_')) continue
    // Ομάδα διαδρομών «(όνομα)»: δεν γράφεται στη διεύθυνση.
    if (/^\(.*\)$/.test(name)) { out.push(...pageRoutes(full, base)); continue }
    // Δυναμικό τμήμα: η διαδρομή κρίνεται από το πρόθεμα ως εκεί.
    if (/^\[.*\]$/.test(name)) { if (pageRoutes(full, `${base}/_`).length) out.push(`${base}/`); continue }
    out.push(...pageRoutes(full, `${base}/${name}`))
  }
  return [...new Set(out)]
}

const pages = pageRoutes()
const unclassified = pages
  .filter(r => !publicRoutes.has(r))
  .filter(r => !publicPrefixes.some(p => r.startsWith(p) || r + '/' === p))
  .filter(r => !TOKEN_PREFIXES.some(p => r.startsWith(p)))
  .filter(r => !MATCHER_EXCLUDED.some(p => r === p || r.startsWith(p)))
  .filter(r => !isPrivateRoute(r))
  .sort()

if (unclassified.length) {
  console.error(`\n✗ ${unclassified.length} σελίδες του app/ δεν έχουν δηλωμένη πόρτα στο ${PROXY}:\n`)
  for (const r of unclassified) console.error(`  ${r}`)
  console.error(`\nΑν ζητά σύνδεση, πρόσθεσέ τη στο PRIVATE_PREFIXES· αν είναι δημόσια, στο PUBLIC.`)
  console.error(`Χωρίς αυτό ο ανώνυμος επισκέπτης την ανοίγει χωρίς σύνδεση.`)
  process.exit(1)
}

console.log(`✓ και οι ${linked.size} δημόσιες διαδρομές, κελύφους και χάρτη, ανοίγουν χωρίς σύνδεση`)
console.log(`✓ και οι ${pages.length} σελίδες του app/ έχουν δηλωμένη πόρτα (${privatePrefixes.length} ιδιωτική)`)
