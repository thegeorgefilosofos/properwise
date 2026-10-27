#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΘΕ ΣΕΛΙΔΑ ΤΟΥ ΧΑΡΤΗ ΕΧΕΙ ΠΕΡΙΓΡΑΦΗ ΑΠΟ 70 ΕΩΣ 160 ΧΑΡΑΚΤΗΡΕΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ (έλεγχος 27/10/2026). Η περιγραφή του
// /ypologismos-stegastikou-daneiou έβγαινε 301 χαρακτήρες στην παραγωγή: το
// κείμενο της αγοράς μπροστά από τη στατική περιγραφή. Η σελίδα αποτελεσμάτων
// κόβει γύρω στους 155–160, οπότε το «Δωρεάν, χωρίς εγγραφή» και η δόση δεν
// φαίνονταν ποτέ. Το /signup έβγαινε 220: η πρόταση για την κάρτα κοβόταν
// στη μέση. Και τα δύο είχαν σχόλιο που έλεγε «κάτω από 160»· κανένα δεν
// μετρούσε.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ. Κάθε διεύθυνση του χάρτη ιστότοπου (app/sitemap.ts), δηλαδή
// ό,τι ζητάμε από τη μηχανή να ευρετηριάσει. Για την καθεμία ο φύλακας φορτώνει
// το app<διαδρομή>/page.tsx (ή το layout.tsx, όπου ζουν τα μεταδεδομένα μιας
// σελίδας 'use client') και διαβάζει το `metadata` ή καλεί το
// `generateMetadata`, όπως ο Next. Μετρά το κείμενο ΟΠΩΣ ΒΓΑΙΝΕΙ: με τις τιμές
// που συνθέτει ο κώδικας, όχι το πρότυπο στην πηγή.
//   · Κάτω από 70: η μηχανή συμπληρώνει μόνη της από το σώμα της σελίδας.
//   · Πάνω από 160: κόβεται στη σελίδα αποτελεσμάτων.
//   · Χωρίς περιγραφή: κληρονομεί της ρίζας, ίδια με την αρχική.
//
// ΓΙΑΤΙ ΜΕΣΩ tsx ΚΑΙ ΟΧΙ ΜΕ REGEX. Οι περιγραφές χτίζονται από σταθερές (η
// κλίμακα του φόρου, το πλήθος των οδηγών, τα ονόματα των πακέτων). Μια regex
// θα μετρούσε το `${…}` αντί για την τιμή του. Όπως στο guard-validity.
//
// ΤΙ ΔΕΝ ΠΙΑΝΕΙ. Περιγραφή που εξαρτάται από τη βάση ή από το περιβάλλον
// μετριέται στην εκδοχή που βγαίνει εδώ, χωρίς βάση και χωρίς ταμείο. Η
// εκδοχή του στεγαστικού με τιμή αγοράς μετριέται στη χειρότερη περίπτωσή της
// στο lib/tools/stegastiko.test.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { writeFileSync, unlinkSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const MIN = 70
const MAX = 160

const probe = `
import { existsSync } from 'node:fs'
import * as sm from '../app/sitemap'
import { SITE } from '../lib/core/site'
const sitemap = ((sm as any).default?.default ?? (sm as any).default) as () => { url: string }[]
const out: { path: string; file: string | null; desc: string | null }[] = []
for (const row of sitemap()) {
  const path = row.url.slice(SITE.length) || '/'
  const dir = path === '/' ? 'app' : 'app' + path
  let file: string | null = null
  let desc: string | null = null
  for (const f of [dir + '/page.tsx', dir + '/layout.tsx']) {
    if (!existsSync(f)) continue
    const m = await import('../' + f)
    const md = m.metadata ?? (typeof m.generateMetadata === 'function'
      ? await m.generateMetadata({ params: Promise.resolve({}), searchParams: Promise.resolve({}) })
      : null)
    if (md && typeof md.description === 'string') { file = f; desc = md.description; break }
  }
  out.push({ path, file, desc })
}
process.stdout.write(JSON.stringify(out))
`
const tmp = 'scripts/__meta-description-probe.mts'
let rows
try {
  writeFileSync(tmp, probe)
  rows = JSON.parse(execFileSync('npx', ['--yes', 'tsx', tmp], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  }))
} catch (e) {
  console.error('✗ οι περιγραφές των σελίδων δεν διαβάζονται:\n' + (e.stderr || e.message))
  process.exit(1)
} finally {
  try { unlinkSync(tmp) } catch {}
}

// Αν ο χάρτης βγει άδειος, ο φύλακας δεν έλεγξε τίποτα: δεν είναι πράσινο.
if (!Array.isArray(rows) || rows.length < 10) {
  console.error(`✗ ο χάρτης έδωσε ${rows?.length ?? 0} σελίδες· ο φύλακας δεν έχει τι να μετρήσει`)
  process.exit(1)
}

/** Η γραμμή της περιγραφής στην πηγή, για να πάει κανείς κατευθείαν εκεί. */
function lineOf(file) {
  if (!file) return 1
  const lines = readFileSync(file, 'utf8').split('\n')
  const i = lines.findIndex(l => /\bdescription\s*:/.test(l) || /\bconst DESC\b/.test(l))
  return i < 0 ? 1 : i + 1
}

const provlimata = []
for (const r of rows) {
  const len = r.desc === null ? 0 : [...r.desc].length
  if (r.desc === null) provlimata.push({ ...r, len, ti: 'χωρίς δική της περιγραφή' })
  else if (len < MIN) provlimata.push({ ...r, len, ti: `${len} χαρακτήρες, κάτω από ${MIN}` })
  else if (len > MAX) provlimata.push({ ...r, len, ti: `${len} χαρακτήρες, πάνω από ${MAX}` })
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} σελίδες του χάρτη με περιγραφή εκτός ${MIN}–${MAX} χαρακτήρων:\n`)
  for (const p of provlimata.slice(0, 30)) {
    console.error(`  ${p.file ?? `app${p.path}/page.tsx`}:${lineOf(p.file)}  ${p.path}  ${p.ti}`)
    if (p.desc) console.error(`     «${p.desc}»`)
  }
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error(`\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: γράψε την περιγραφή ξανά ώστε να χωρά στους ${MAX} χαρακτήρες`)
  console.error('  με την ουσία μπροστά (τι απαντά η σελίδα), όχι κόβοντάς την στη μέση.')
  console.error(`  Κάτω από ${MIN}, πρόσθεσε τι κάνει ο αναγνώστης εκεί.\n`)
  process.exit(1)
}
const lens = rows.map(r => [...r.desc].length)
console.log(`✓ ${rows.length} σελίδες του χάρτη με περιγραφή ${Math.min(...lens)}–${Math.max(...lens)} χαρακτήρων (όριο ${MIN}–${MAX})`)
