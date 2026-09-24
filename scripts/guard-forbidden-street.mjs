#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΜΙΑ ΠΡΑΓΜΑΤΙΚΗ ΔΙΕΥΘΥΝΣΗ ΔΕΝ ΓΡΑΦΕΤΑΙ ΠΟΥΘΕΝΑ ΣΤΟ ΑΠΟΘΕΤΗΡΙΟ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ. Ο δρόμος του σπιτιού του ιδιοκτήτη βρέθηκε ως «παράδειγμα»
// μέσα σε δοκιμή (lib/clients/crmFeatures.test.ts), δηλαδή σε αρχείο που
// ανεβαίνει δημόσια με κάθε κλώνο και κάθε αντίγραφο εργασίας. Ο κανόνας
// «τα παραδείγματα είναι προφανώς πλασματικά» ζούσε μόνο σε συζήτηση· ο
// συγκεκριμένος δρόμος ήταν ρητά απαγορευμένος και γράφτηκε παρ' όλα αυτά.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ. Κάθε αρχείο κειμένου του έργου (καταχωρημένο ή νέο, όχι
// αγνοημένο), χωρίς τόνους και πεζά, για το όνομα του δρόμου σε ελληνική ή
// λατινική γραφή.
//
// ΓΙΑΤΙ ΤΟ ΟΝΟΜΑ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ. Ο φύλακας θα ήταν ο ίδιος το αρχείο που
// το διαρρέει. Κρατιέται κωδικοποιημένο· ο φύλακας το αποκωδικοποιεί μόνο στη
// μνήμη. Τα παραδείγματα γράφονται ως «Οδός Παραδείγματος 12, Αθήνα», ΤΚ 10000.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, statSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const decode = (b64) => Buffer.from(b64, 'base64').toString('utf8')
/** Η ελληνική γραφή και δύο λατινικές μεταγραφές, χωρίς τόνους και πεζά. */
const FORBIDDEN = ['zrHPgc+FzrLOss6/z4U=', 'YXJ5dnZvdQ==', 'YXJpdnZvdQ=='].map(decode)

const plain = (v) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Δυαδικά αρχεία: δεν έχουν κείμενο να διαβαστεί. */
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|pdf|woff2?|ttf|otf|eot|mp4|webm|mp3|wav|zip|gz|br|xlsx|docx|pptx|sqlite|db)$/i
/** Πάνω από 5 MB δεν είναι πηγαίο κείμενο. */
const MAX_BYTES = 5 * 1024 * 1024

const files = projectFiles('')
const problems = []
let scanned = 0

for (const file of files) {
  if (BINARY.test(file)) continue
  let size = 0
  try { size = statSync(file).size } catch { continue }
  if (!size || size > MAX_BYTES) continue
  const src = readFileSync(file, 'utf8')
  scanned++
  if (!FORBIDDEN.some(w => plain(src).includes(w))) continue
  src.split('\n').forEach((line, i) => {
    if (FORBIDDEN.some(w => plain(line).includes(w))) problems.push(`${file}:${i + 1}`)
  })
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} γραμμές γράφουν πραγματική διεύθυνση που απαγορεύεται ρητά:\n`)
  for (const p of problems.slice(0, 30)) console.error(`  ${p}`)
  if (problems.length > 30) console.error(`  … και ${problems.length - 30} ακόμη`)
  console.error('\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: γράψε προφανώς πλασματικό παράδειγμα, π.χ. «Οδός Παραδείγματος 12, Αθήνα», ΤΚ 10000.\n')
  process.exit(1)
}
console.log(`✓ καμία απαγορευμένη διεύθυνση σε ${scanned} αρχεία κειμένου`)
