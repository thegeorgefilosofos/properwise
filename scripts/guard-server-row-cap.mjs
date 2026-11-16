#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΝΕΝΑ `.limit()` ΠΑΝΩ ΑΠΟ ΤΟ ΟΡΙΟ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ: ΘΑ ΚΟΒΟΤΑΝ ΣΙΩΠΗΛΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (έλεγχος κλίμακας 10/11/2026). Το PostgREST του Supabase
// επιστρέφει το πολύ 1.000 γραμμές ανά αίτημα και ΔΕΝ λέει ότι έκοψε. Ο
// προγραμματιστής της ουράς email ζητούσε `.limit(2000)` και έπαιρνε 1.000,
// νομίζοντας ότι έπαιρνε 2.000. Το ίδιο όριο έκοβε τις αναγνώσεις «όλων των
// χρηστών» σε πέντε εργασίες· στο newsletter αυτό σήμαινε αποστολή και σε όσους
// είχαν κάνει απεγγραφή. Εκείνες διορθώθηκαν με σελίδες (`_shared/pages.ts`,
// `lib/data/read.ts` → `readAll`).
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ. Σε app/, lib/, components/ και supabase/functions/, κάθε
// `.limit(N)` με N πάνω από 1.000. Ενα τέτοιο όριο είναι πάντα ψέμα: ή θέλεις
// λιγότερες γραμμές (γράψε ≤ 1.000), ή θέλεις όλες (διάβασε σε σελίδες).
// Χωρίς εξαιρέσεις.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const SERVER_MAX_ROWS = 1000
const files = projectFiles("'app/**/*.ts' 'app/**/*.tsx' 'lib/**/*.ts' 'components/**/*.tsx' 'supabase/functions/**/*.ts'")
  .filter(f => !/\.test\.tsx?$/.test(f))

const provlimata = []
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (/^\s*\/\//.test(line)) return
    for (const m of line.matchAll(/\.limit\(\s*([0-9][0-9_]*)\s*\)/g)) {
      const n = Number(m[1].replace(/_/g, ''))
      if (n > SERVER_MAX_ROWS) provlimata.push({ arxeio: f, grammi: i + 1, ti: m[0] })
    }
  })
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} όρια πάνω από τις ${SERVER_MAX_ROWS} γραμμές, που ο διακομιστής κόβει σιωπηλά:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και άλλα ${provlimata.length - 30}`)
  console.error(`\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: αν θέλεις λίγες γραμμές, όριο ≤ ${SERVER_MAX_ROWS}. Αν θέλεις όλες,\n  διάβασε σε σελίδες: \`readAll\` (lib/data/read.ts) ή \`allPages\` (supabase/functions/_shared/pages.ts).\n`)
  process.exit(1)
}
console.log(`✓ κανένα όριο πάνω από τις ${SERVER_MAX_ROWS} γραμμές σε ${files.length} αρχεία`)
