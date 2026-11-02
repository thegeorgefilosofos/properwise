#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΘΕ ΑΓΓΛΙΚΗ ΣΕΛΙΔΑ ΕΧΕΙ ΕΛΛΗΝΙΚΟ ΖΕΥΓΟΣ, ΚΑΘΕ ΖΕΥΓΟΣ ΕΧΕΙ ΚΑΙ ΤΙΣ ΔΥΟ ΣΕΛΙΔΕΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ. Η αγγλική βιτρίνα (02.11.2026) ζει σε δύο σημεία που δεν
// βλέπουν το ένα το άλλο: τα αρχεία app/en/** και ο χάρτης lib/i18n/paths.ts.
// Από τον χάρτη διαβάζουν ο επιλογέας γλώσσας, οι ετικέτες hreflang, ο χάρτης
// του ιστότοπου και το proxy.ts. Στο πρώτο πέρασμα το /en/tools υπήρχε ως
// σελίδα πριν μπει στον χάρτη: χωρίς hreflang, ο επιλογέας από εκεί γύριζε
// στην ελληνική αρχική αντί για το /ergaleia και ο χάρτης του ιστότοπου δεν
// την ήξερε. Τίποτα δεν κοκκίνιζε· απλώς η σελίδα ήταν μισή.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ, ΑΚΡΙΒΩΣ.
//   1. Κάθε ζεύγος του PAGE_PAIRS έχει σελίδα και στις δύο πλευρές.
//   2. Κάθε σελίδα κάτω από το app/en/ είναι η αγγλική πλευρά ενός ζεύγους.
//   3. Και οι δύο πλευρές δηλώνουν τα μεταδεδομένα τους με το
//      `publicMetadata(` (στη σελίδα ή στο layout του φακέλου): εκεί μπαίνουν
//      αυτόματα οι ετικέτες hreflang και η γλώσσα του Open Graph. Η αρχική
//      γράφει τα δικά της και πρέπει να καλεί ρητά το `languageAlternates(`.
//      Σελίδα `noindexPage(` δεν θέλει hreflang: δεν ευρετηριάζεται.
//   4. Οι αγγλικές σελίδες είναι `view.tsx` (και `frame.tsx` στη θέση του
//      layout) και τις αποδίδει ΜΙΑ διαδρομή, το app/en/[[...slug]]/page.tsx:
//      κάθε αγγλική σελίδα είναι γραμμένη στον κατάλογό του κι αντίστροφα.
//      `page.tsx` κάτω από το app/en είναι δική του συνάρτηση στον διακομιστή,
//      με ~2,5 MB ίχνος σε κάθε ανάπτυξη (scripts/server-weight.mjs).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const MAP = 'lib/i18n/paths.ts'
const src = readFileSync(MAP, 'utf8')
const block = /export const PAGE_PAIRS = \[([\s\S]*?)\] as const/.exec(src)
if (!block) {
  console.error(`✗ Δεν βρέθηκε το PAGE_PAIRS στο ${MAP}. Αν άλλαξε σχήμα, άλλαξε και ο φύλακας.`)
  process.exit(1)
}
const pairs = [...block[1].matchAll(/\[\s*'([^']+)'\s*,\s*(?:'([^']+)'|EN_PREFIX)\s*\]/g)]
  .map(m => ({ el: m[1], en: m[2] ?? '/en' }))
if (!pairs.length) {
  console.error(`✗ Το PAGE_PAIRS του ${MAP} διαβάστηκε άδειο. Ο φύλακας δεν θα έλεγχε τίποτα.`)
  process.exit(1)
}

const dirOf = (route) => (route === '/' ? 'app' : join('app', route))
const isEn = (route) => route === '/en' || route.startsWith('/en/')
const pageOf = (route) => join(dirOf(route), isEn(route) ? 'view.tsx' : 'page.tsx')
// Σελίδα noindex (π.χ. η επαναφορά κωδικού) δεν δηλώνει hreflang: δεν
// ευρετηριάζεται σε καμία γλώσσα. Αρκεί να είναι noindex και οι ΔΥΟ πλευρές.
const metaOk = (route, call) => [pageOf(route), join(dirOf(route), isEn(route) ? 'frame.tsx' : 'layout.tsx')]
  .some(f => existsSync(f) && (readFileSync(f, 'utf8').includes(call) || readFileSync(f, 'utf8').includes('noindexPage(')))

const problems = []
for (const { el, en } of pairs) {
  if (!existsSync(pageOf(el))) problems.push(`${MAP}: «${el}» → δεν υπάρχει ${pageOf(el)}`)
  if (!existsSync(pageOf(en))) problems.push(`${MAP}: «${en}» → δεν υπάρχει ${pageOf(en)}`)
  const elCall = el === '/' ? 'languageAlternates(' : 'publicMetadata('
  if (existsSync(pageOf(el)) && !metaOk(el, elCall)) problems.push(`${pageOf(el)}: χωρίς ${elCall}…) — η ελληνική πλευρά δεν δηλώνει hreflang`)
  if (existsSync(pageOf(en)) && !metaOk(en, 'publicMetadata(')) problems.push(`${pageOf(en)}: χωρίς publicMetadata(…) — η αγγλική πλευρά δεν δηλώνει hreflang`)
}

const DISPATCH = 'app/en/[[...slug]]/page.tsx'
function enPages(dir = 'app/en', base = '/en') {
  const out = []
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...enPages(full, `${base}/${name}`))
    else if (name === 'view.tsx') out.push(base)
    else if (name === 'page.tsx' && full !== DISPATCH) {
      problems.push(`${full}: αγγλική σελίδα ως δική της διαδρομή — γίνεται view.tsx και μπαίνει στο ${DISPATCH}`)
    }
  }
  return out
}
const known = new Set(pairs.map(p => p.en))
for (const route of enPages()) {
  if (!known.has(route)) problems.push(`${pageOf(route)}: αγγλική σελίδα χωρίς ζεύγος στο ${MAP}`)
}
const dispatched = existsSync(DISPATCH)
  ? new Set([...readFileSync(DISPATCH, 'utf8').matchAll(/\[\s*'(\/en[^']*)'\s*,\s*\{\s*view:/g)].map(m => m[1]))
  : new Set()
for (const en of known) {
  if (!dispatched.has(en)) problems.push(`${DISPATCH}: «${en}» δεν είναι στον κατάλογο σελίδων — η διεύθυνση δίνει 404`)
}
for (const en of dispatched) {
  if (!known.has(en)) problems.push(`${DISPATCH}: «${en}» χωρίς ζεύγος στο ${MAP}`)
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} προβλήματα στα ζεύγη γλωσσών:\n`)
  for (const p of problems.slice(0, 30)) console.error('  ' + p)
  if (problems.length > 30) console.error(`  … και ${problems.length - 30} ακόμη`)
  console.error(`
  ΤΙ ΝΑ ΚΑΝΕΙΣ: κάθε αγγλική σελίδα μπαίνει ως [ελληνική, αγγλική] στο PAGE_PAIRS
  του ${MAP} και δηλώνει τα μεταδεδομένα της με το publicMetadata(…), όπως και
  το ελληνικό της ζεύγος. Από εκεί βγαίνουν hreflang, επιλογέας και χάρτης.
`)
  process.exit(1)
}
console.log(`✓ και τα ${pairs.length} ζεύγη γλωσσών έχουν δύο σελίδες με hreflang· καμία αγγλική σελίδα χωρίς ζεύγος`)
