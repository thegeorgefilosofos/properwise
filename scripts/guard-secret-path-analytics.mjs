#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΘΕ ΣΕΛΙΔΑ ΜΕ [token] Ή [id] ΣΤΗ ΔΙΑΔΡΟΜΗ ΔΕΝ ΜΕΤΡΙΕΤΑΙ ΚΑΘΟΛΟΥ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ. Το app/plirosa/[token] (#455) μπήκε χωρίς να
// μπει το `plirosa` στο SECRET_PATH του lib/analytics/pageUrl.ts. Μία από τις
// οκτώ σελίδες με κλειδί στη διαδρομή έμεινε έξω: με ενεργό το Vercel Web
// Analytics, η διεύθυνση /plirosa/<token> θα έφευγε ολόκληρη στη Vercel, ενώ
// το app/privacy/page.tsx υπόσχεται ότι οι σελίδες με μυστικό στη διεύθυνση
// «εξαιρούνται εντελώς». Η λίστα ζούσε μόνο στη μνήμη του επόμενου.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ, ΑΚΡΙΒΩΣ. Κάθε αρχείο κάτω από το app/ (καταχωρημένο ή νέο,
// μέσω projectFiles) που βρίσκεται κάτω από τμήμα `[token]` ή `[id]`. Ο ΠΡΩΤΟΣ
// πραγματικός φάκελος της διαδρομής του πρέπει να ταιριάζει στο SECRET_PATH,
// όπως είναι γραμμένο στο pageUrl.ts (διαβάζεται από εκεί, όχι αντιγραμμένο).
//
// ΕΞΑΙΡΕΣΕΙΣ ΚΑΙ ΓΙΑΤΙ.
//   · app/api/**: δεν είναι σελίδες· το beforeSend μετρά μόνο προβολές σελίδων.
//   · ομάδες διαδρομών `(x)` και ιδιωτικοί φάκελοι `_x`: δεν γράφονται στη
//     διεύθυνση, οπότε παραλείπονται για να βρεθεί ο πρώτος πραγματικός φάκελος.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const SRC = 'lib/analytics/pageUrl.ts'
const src = readFileSync(SRC, 'utf8')
const lit = src.match(/export const SECRET_PATH\s*=\s*\/(.+)\/([a-z]*);/)
if (!lit) {
  console.error(`\n✗ Δεν βρέθηκε το «export const SECRET_PATH = /…/;» στο ${SRC}.\n`)
  console.error(`  ΤΙ ΝΑ ΚΑΝΕΙΣ: κράτα το SECRET_PATH ως ρητή κανονική έκφραση σε μία γραμμή, ή ενημέρωσε αυτόν τον φύλακα.\n`)
  process.exit(1)
}
const SECRET_PATH = new RegExp(lit[1], lit[2])

const DYNAMIC = /^\[(token|id)\]$/
const files = projectFiles("'app/**'").filter(f => !f.startsWith('app/api/'))
const routes = new Map() // πρώτος φάκελος → πρώτο αρχείο που το δείχνει

for (const f of files) {
  const segs = f.split('/').slice(1, -1) // χωρίς «app» και χωρίς όνομα αρχείου
  if (!segs.some(s => DYNAMIC.test(s))) continue
  const first = segs.find(s => !/^\(.*\)$/.test(s) && !s.startsWith('_'))
  if (!first) continue
  if (!routes.has(first)) routes.set(first, f)
}

const provlimata = []
for (const [first, arxeio] of routes) {
  if (DYNAMIC.test(first) || !SECRET_PATH.test(`/${first}/x`)) provlimata.push({ arxeio, ti: `/${first}/…` })
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} σελίδες με κλειδί στη διαδρομή θα έφευγαν στη μέτρηση επισκεψιμότητας:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:1  «${p.ti}» δεν ταιριάζει στο SECRET_PATH`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error(`\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: πρόσθεσε τον φάκελο στο SECRET_PATH του ${SRC} και μια γραμμή στο lib/analytics/pageUrl.test.ts.`)
  console.error(`  Το app/privacy/page.tsx υπόσχεται ότι αυτές οι σελίδες εξαιρούνται εντελώς.\n`)
  process.exit(1)
}
console.log(`✓ ${routes.size} διαδρομές με [token]/[id] εξαιρούνται από τη μέτρηση (${files.length} αρχεία του app/)`)
