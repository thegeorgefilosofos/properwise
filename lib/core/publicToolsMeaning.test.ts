// ═══════════════════════════════════════════════════════════════════════════
// «ΤΙ ΣΗΜΑΙΝΕΙ ΑΥΤΟ»: ΚΑΘΕ ΣΥΝΔΕΣΜΟΣ ΔΕΙΧΝΕΙ ΟΔΗΓΟ ΠΟΥ ΥΠΑΡΧΕΙ ΚΑΙ ΤΟΝ ΚΑΛΥΠΤΕΙ
// ─────────────────────────────────────────────────────────────────────────
// Τρέξε: npx tsx lib/core/publicToolsMeaning.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { PUBLIC_TOOLS, toolMeaning } from './publicTools'
import { LISTED_GUIDES } from '../../app/odigos/guides'

let passed = 0, failed = 0
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; console.log('  ✗ ' + name) } }

for (const t of PUBLIC_TOOLS) {
  if (!t.meaning) continue
  const g = LISTED_GUIDES.find(x => x.href === t.meaning)
  ok(`${t.href}: ο οδηγός ${t.meaning} είναι στον κατάλογο`, !!g)
  ok(`${t.href}: ο οδηγός δηλώνει τον υπολογιστή`, !!g && g.tools.includes(t.href))
  ok(`${t.href}: η αναζήτηση δίνει τον ίδιο`, toolMeaning(t.href) === t.meaning)
}
ok('οι δύο υπολογιστές με αποθήκευση έχουν οδηγό', !!toolMeaning('/ypologismos-enfia') && !!toolMeaning('/ypologismos-forou-enoikion'))
ok('άγνωστη διαδρομή: τίποτα', toolMeaning('/den-yparxei') === undefined)

console.log(`lib/core/publicToolsMeaning.test.ts: ${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
