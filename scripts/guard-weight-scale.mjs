#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΣΤΑΝΙΑ ΒΑΡΩΝ — ΤΕΣΣΕΡΑ ΣΚΑΛΙΑ· Ο,ΤΙ ΕΙΝΑΙ ΑΝΑΜΕΣΑ ΜΟΝΟ ΛΙΓΟΣΤΕΥΕΙ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ (19/10/2026). Ο κώδικας είχε ΕΝΤΕΚΑ διαφορετικά
// `fontWeight` ενώ το `TT` όριζε τρία: 600 × 460 δίπλα σε 700 × 467 και ανάμεσά
// τους 680 (40 φορές), 450 (9), 560, 640, 650, 660, 720 και 800. Στο φύλλο
// στυλ άλλα έξι. Η αρχική σελίδα έβγαζε στην οθόνη ΕΝΝΙΑ βάρη. Κανένα δεν
// έσπαγε κάτι· απλώς ο τίτλος μιας ενότητας ήταν 680 και της επόμενης 700·
// το μάτι διάβαζε δύο οθόνες φτιαγμένες από δύο χέρια.
//
// Ο `guard-type-scale` μετρούσε μόνο ΜΕΓΕΘΗ. Ο σαρωτής `e2e-design-scale`
// μετρά βάρη, αλλά μόνο μέσα στην εφαρμογή (.app-content), οπότε η βιτρίνα,
// δηλαδή η πρώτη εντύπωση, δεν είχε κανέναν φύλακα.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ. Κάθε `fontWeight:` στα .tsx/.ts του app/ και του components/
// και κάθε `font-weight:` στα .css και στο CSS που ζει μέσα σε .tsx (π.χ. το
// LandingStyles). Η κλίμακα είναι το `T.weight` του components/tokens.ts:
// 400 · 500 · 600 · 700. Ο,τι άλλο μετρά ως απόκλιση.
//
// ΤΙ ΑΓΝΟΕΙΤΑΙ ΚΑΙ ΓΙΑΤΙ.
//   · Οι εικόνες κοινοποίησης (`opengraph-image`, app/og/): PNG 1200×630 που
//     αποδίδονται στον διακομιστή, όπως και στον guard-type-scale.
//   · Το εύρος του @font-face («font-weight: 100 900»): δηλώνει ποια βάρη ΕΧΕΙ
//     το αρχείο της γραμματοσειράς, δεν ζητά κανένα.
//   · Τα σχόλια.
//
// ΓΙΑΤΙ ΚΑΣΤΑΝΙΑ ΚΑΙ ΟΧΙ ΑΠΑΓΟΡΕΥΣΗ. Οσα έμειναν ζουν στις σελίδες των οδηγών
// και των υπολογιστών, που στις 20/10/2026 τις διόρθωνε παράλληλα άλλο πέρασμα
// (ελληνικά κείμενα). Θα τα μαζέψει το επόμενο πέρασμα· ως τότε δεν μπαίνει
// κανένα νέο. ΟΤΑΝ ΚΑΘΑΡΙΖΕΙΣ: κατέβασε το `maxOffScale` στο
// scripts/weight-scale-baseline.json.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const SCALE = new Set([400, 500, 600, 700])
const NOT_A_SCREEN = /(^|\/)(opengraph|twitter)-image\.tsx$|^app\/og\//
const BASELINE = 'scripts/weight-scale-baseline.json'

const files = projectFiles("'app/**/*.tsx' 'app/**/*.ts' 'app/**/*.css' 'components/**/*.tsx' 'components/**/*.ts'")
  .filter(f => !NOT_A_SCREEN.test(f) && !/\.test\.tsx?$/.test(f))

/** Η τιμή μετά το `fontWeight:` ή το `font-weight:`, ως το τέλος της δήλωσης. */
const DECL = /(?:fontWeight|font-weight)\s*:\s*([^,;}\n]+)/g

const offScale = []
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n')
  lines.forEach((l, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(l)) return
    for (const m of l.matchAll(DECL)) {
      const value = m[1].trim()
      if (/^\d{3}\s+\d{3}\b/.test(value)) continue        // εύρος @font-face
      for (const n of value.match(/\b\d{3}\b/g) ?? []) {
        const w = Number(n)
        if (!SCALE.has(w)) offScale.push({ file: f, line: i + 1, weight: w })
      }
    }
  })
}

const cap = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')).maxOffScale : offScale.length

if (offScale.length > cap) {
  console.error(`\n✗ Καστάνια βαρών: ${offScale.length} βάρη εκτός κλίμακας > όριο ${cap}.\n`)
  console.error('  Η κλίμακα είναι το T.weight (components/tokens.ts): 400 · 500 · 600 · 700.')
  console.error('  Ενα 680 δίπλα σε 700 δεν είναι απόφαση· είναι το ίδιο σκαλί γραμμένο αλλιώς.\n')
  for (const o of offScale.slice(0, 30)) console.error(`  ${o.file}:${o.line}  βάρος ${o.weight}`)
  if (offScale.length > 30) console.error(`  … και άλλα ${offScale.length - 30}`)
  console.error('\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: 640–660 → T.weight.emphasis (600) · 680–800 → T.weight.bold (700) · 450 → 400 · 560 → 500.\n')
  process.exit(1)
}

console.log(`✓ Καστάνια βαρών: ${offScale.length} εκτός κλίμακας ≤ όριο ${cap}, σε ${files.length} αρχεία.`)
if (offScale.length < cap) {
  console.log(`  ↓ Βελτίωση κατά ${cap - offScale.length}. Κατέβασε το "maxOffScale" στο ${BASELINE} στο ${offScale.length}.`)
  process.exit(1)
}
