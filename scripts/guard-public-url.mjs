#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΜΟΝΙΜΟ ΔΗΜΟΣΙΟ URL ΜΟΝΟ ΓΙΑ ΤΟ «avatars»
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (10/11/2026). Το bucket «inventory-photos» ήταν δημόσιο και
// δύο σημεία (HandoverTab.tsx, ItemFormModal.tsx) έγραφαν στη βάση το
// `getPublicUrl` κάθε φωτογραφίας παράδοσης και απογραφής. Ενα τέτοιο URL δεν
// λήγει και δεν ανακαλείται: όποιος το έπαιρνε από ένα προωθημένο πρωτόκολλο
// έβλεπε για πάντα το εσωτερικό του σπιτιού. Το bucket έγινε ιδιωτικό
// (20261110140000) και η προβολή υπογράφεται (lib/storage/inventoryPhotos.ts).
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ. Κάθε `getPublicUrl` στον κώδικα της εφαρμογής και των
// συναρτήσεων άκρου. Επιτρέπεται μόνο πάνω στο «avatars», τον μόνο δημόσιο
// κάδο, όπου το bucket γράφεται κυριολεκτικά στην ίδια γραμμή. Οτιδήποτε άλλο
// (ιδιωτικό bucket ή όνομα μέσα από μεταβλητή) κόβεται: ο σύνδεσμος βγαίνει με
// `createSignedUrl(s)` και στη βάση γράφεται η διαδρομή.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const files = projectFiles("'app/**/*.ts' 'app/**/*.tsx' 'lib/**/*.ts' 'lib/**/*.tsx' 'components/**/*.ts' 'components/**/*.tsx' 'supabase/functions/**/*.ts'")
  .filter(f => !/\.test\.tsx?$/.test(f))
const ALLOWED = /\.from\(\s*['"]avatars['"]\s*\)\s*\.getPublicUrl\(/

const provlimata = []
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (!line.includes('getPublicUrl(')) return
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
    if (ALLOWED.test(line)) return
    provlimata.push({ arxeio: f, grammi: i + 1, ti: line.trim().slice(0, 110) })
  })
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} μόνιμα δημόσια URL εκτός «avatars»:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και άλλα ${provlimata.length - 30}`)
  console.error(`
  ΤΙ ΝΑ ΚΑΝΕΙΣ: γράψε στη βάση τη ΔΙΑΔΡΟΜΗ του αρχείου και πάρε σύνδεσμο προβολής
  με createSignedUrl(s), όπως το lib/storage/inventoryPhotos.ts ή το
  lib/maintenance/photos.ts. Ενα δημόσιο URL δεν λήγει και δεν ανακαλείται.
`)
  process.exit(1)
}
console.log(`✓ κανένα μόνιμο δημόσιο URL εκτός «avatars» σε ${files.length} αρχεία`)
