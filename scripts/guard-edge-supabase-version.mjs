#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ EDGE FUNCTIONS ΚΑΡΦΩΝΟΥΝ ΤΗΝ ΙΔΙΑ ΕΚΔΟΣΗ ΜΕ ΤΟ package-lock
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ, ΜΕΤΡΗΜΕΝΟ. Οι edge functions τρέχουν σε Deno και εισάγουν το
// `npm:@supabase/supabase-js@X` με ΚΑΡΦΩΜΕΝΗ έκδοση σε κάθε αρχείο. Το
// `package.json` όμως δηλώνει εύρος (`^2.x`) και το Dependabot ανεβάζει την
// εγκατεστημένη έκδοση χωρίς να αγγίζει τις edge functions. Οταν αποκλίνουν,
// ο Deno (byonm — διαβάζει το node_modules) δεν βρίσκει την καρφωμένη έκδοση
// και το «Typecheck edge functions» κοκκινίζει με μήνυμα που δεν λέει ΓΙΑΤΙ.
// Ακριβώς αυτό συνέβη στο Dependabot PR που ανέβασε το supabase-js σε 2.116.0.
//
// Ο ΦΥΛΑΚΑΣ. Διαβάζει την έκδοση που ΟΝΤΩΣ εγκαθίσταται από το package-lock,
// και απαιτεί κάθε edge function να καρφώνει ΑΚΡΙΒΩΣ αυτήν. Ετσι η επόμενη
// αναβάθμιση που ξεχνά τις edge functions κοκκινίζει εδώ, με σαφή οδηγία, αντί
// αργότερα και ακατανόητα στον Deno. Χωρίς δίκτυο: μόνο ανάγνωση αρχείων.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, globSync } from 'node:fs'

const PKG = '@supabase/supabase-js'
const RE = /npm:@supabase\/supabase-js@([0-9]+\.[0-9]+\.[0-9]+)/

// Η έκδοση που εγκαθιστά το lock — αυτήν ζητά ο Deno από το node_modules.
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'))
const entry = Object.entries(lock.packages || {}).find(([p]) => p.endsWith(`node_modules/${PKG}`))
const installed = entry?.[1]?.version

const problems = []
if (!installed) problems.push(`Δεν βρέθηκε η έκδοση του ${PKG} στο package-lock.json`)

const files = globSync('supabase/functions/*/index.ts').sort()
let pinned = 0
for (const f of files) {
  const m = readFileSync(f, 'utf8').match(RE)
  if (!m) continue
  pinned++
  if (installed && m[1] !== installed) {
    problems.push(`${f}: καρφωμένο @${m[1]}, ενώ το lock εγκαθιστά @${installed}`)
  }
}

if (problems.length) {
  console.error(`✗ guard-edge-supabase-version: ${problems.length} edge functions απέκλιναν από το package-lock`)
  for (const p of problems) console.error(`  ${p}`)
  console.error(`\n  Ο Deno ζητά ΑΚΡΙΒΩΣ την εγκατεστημένη έκδοση. Συγχρόνισε με:`)
  console.error(`    grep -rl "npm:@supabase/supabase-js@" supabase/functions/ | xargs sed -i 's#npm:@supabase/supabase-js@[0-9.]*#npm:@supabase/supabase-js@${installed ?? 'X.Y.Z'}#g'`)
  process.exit(1)
}

console.log(`✓ ${pinned} edge functions καρφωμένες στο ${PKG}@${installed} (ίδιο με το package-lock)`)
