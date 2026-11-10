#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΑΓΩΓΟΣ ΤΗΣ SUPABASE ΣΤΟΧΕΥΕΙ ΡΗΤΑ ΤΗΝ ΑΠΟΜΑΚΡΥΣΜΕΝΗ ΒΑΣΗ, ΜΕ ΚΛΕΙΔΩΜΕΝΟ CLI
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ. Από τις 04/11 ως τις 10/11/2026 απέτυχαν όλα τα deploy της
// Supabase: 8 στο main και κάθε staging (issue #478). Ο αγωγός ζητούσε
// `version: latest`, οπότε πήρε μόνος του το CLI 3.x. Εκεί το `migration
// repair` και το `db push` χωρίς σημαία πάνε στην ΤΟΠΙΚΗ βάση 127.0.0.1:54322,
// που δεν υπάρχει στον runner (run 42623896297: ECONNREFUSED). Για έξι μέρες τα
// migrations και οι συναρτήσεις έφταναν στην παραγωγή μόνο με το χέρι και κάθε
// merge διαβαζόταν ως «deployed».
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ, στο .github/workflows/supabase-deploy.yml:
//   · το `supabase/setup-cli` έχει συγκεκριμένη έκδοση (Χ.Υ.Ζ), όχι `latest`·
//   · κάθε εντολή που αγγίζει βάση (`migration list`, `migration repair`,
//     `db push`) έχει `--remote`·
//   · το `functions deploy` έχει `--project-ref`.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'

const FILE = '.github/workflows/supabase-deploy.yml'
const lines = readFileSync(FILE, 'utf8').split('\n')
const provlimata = []

lines.forEach((line, i) => {
  const code = line.replace(/#.*$/, '')
  const m = /^\s*version:\s*(\S+)/.exec(code)
  if (m && !/^\d+\.\d+\.\d+$/.test(m[1])) provlimata.push({ grammi: i + 1, ti: `έκδοση CLI «${m[1]}» αντί για Χ.Υ.Ζ` })
  if (/\bsupabase\s+(migration\s+(list|repair)|db\s+push)\b/.test(code) && !/--remote\b/.test(code))
    provlimata.push({ grammi: i + 1, ti: `εντολή βάσης χωρίς --remote: ${code.trim()}` })
  if (/\bsupabase\s+functions\s+deploy\b/.test(code) && !/--project-ref\b/.test(code))
    provlimata.push({ grammi: i + 1, ti: `functions deploy χωρίς --project-ref: ${code.trim()}` })
})

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} σημεία όπου ο αγωγός της Supabase μπορεί να στοχεύσει λάθος βάση:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${FILE}:${p.grammi}  «${p.ti}»`)
  console.error(`\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: κλείδωσε την έκδοση του CLI (π.χ. 3.1.0) και βάλε --remote σε κάθε`)
  console.error(`  εντολή βάσης και --project-ref στο functions deploy. Χωρίς αυτά, μια νέα έκδοση`)
  console.error(`  του CLI αλλάζει σιωπηλά τον στόχο σε τοπική βάση και κάθε deploy αποτυγχάνει.\n`)
  process.exit(1)
}
console.log(`✓ supabase-deploy-target: κλειδωμένο CLI, ρητός στόχος σε κάθε εντολή βάσης`)
