#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Η ΔΙΕΥΘΥΝΣΗ ΚΑΙ ΤΟ ΚΛΕΙΔΙ ΤΗΣ ΒΑΣΗΣ ΔΙΑΒΑΖΟΝΤΑΙ ΜΟΝΟ ΑΠΟ lib/supabase/env.ts
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ. Το `NEXT_PUBLIC_SUPABASE_URL` και το
// `NEXT_PUBLIC_SUPABASE_ANON_KEY` μπήκαν στο Vercel με αλλαγή γραμμής στο
// τέλος. Δέκα σημεία του κώδικα τα διάβαζαν απευθείας από το `process.env`,
// κανένα δεν έκοβε τα κενά. Το REST δούλευε (το Fetch καθαρίζει τις
// κεφαλίδες), το Realtime όχι: το κλειδί πήγαινε στη διεύθυνση του websocket
// ως `…%0A` και η πύλη απαντούσε 401. Σε 24 ώρες, περίπου 430 απορρίψεις και
// μηδέν συνδέσεις (6.10.2026). Οι ζωντανές ενημερώσεις δεν έφταναν ποτέ.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ. Κάθε αρχείο κώδικα της εφαρμογής (app, lib, components,
// proxy.ts). Αν κάποιο εκτός από το lib/supabase/env.ts γράφει
// `process.env.NEXT_PUBLIC_SUPABASE_URL` ή `…_ANON_KEY`, κοκκινίζει. Οι
// δοκιμές (`*.test.ts`) εξαιρούνται: στήνουν τις τιμές, δεν τις διαβάζουν για
// να μιλήσουν με τη βάση.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const HOME = 'lib/supabase/env.ts'
const READ = /process\.env\.NEXT_PUBLIC_SUPABASE_(URL|ANON_KEY)\b/
const files = projectFiles("'app/**/*.ts' 'app/**/*.tsx' 'lib/**/*.ts' 'lib/**/*.tsx' 'components/**/*.ts' 'components/**/*.tsx' 'proxy.ts'")
  .filter(f => f !== HOME && !/\.test\.tsx?$/.test(f))

const provlimata = []
for (const arxeio of files) {
  let text
  try { text = readFileSync(arxeio, 'utf8') } catch { continue }
  text.split('\n').forEach((line, i) => {
    if (READ.test(line)) provlimata.push({ arxeio, grammi: i + 1, ti: line.trim().slice(0, 90) })
  })
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} απευθείας αναγνώσεις της διεύθυνσης ή του κλειδιού της βάσης:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και άλλες ${provlimata.length - 30}`)
  console.error(`\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: εισήγαγε SUPABASE_URL / SUPABASE_ANON_KEY από το ${HOME}.`)
  console.error(`  Εκεί οι τιμές καθαρίζονται από κενά· ένα κρυφό «\\n» έριχνε όλο το Realtime.\n`)
  process.exit(1)
}
console.log(`✓ η βάση διαβάζεται μόνο από το ${HOME}, σε ${files.length} αρχεία`)
