#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΠΟΣΟ ΖΥΓΙΖΕΙ Η ΕΦΑΡΜΟΓΗ ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ, ΚΙ ΟΧΙ ΣΤΟ ΚΑΛΩΔΙΟ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ. Το `perf-budget.mjs` δίπλα μετράει τι ΚΑΤΕΒΑΙΝΕΙ στον
// περιηγητή. Κανένα νούμερο δεν φύλαγε τι ΑΝΕΒΑΙΝΕΙ στον διακομιστή — κι εκεί
// το πρόβλημα ήταν εικοσιτρείς φορές μεγαλύτερο, αόρατο επί μήνες.
//
// ΤΙ ΕΓΙΝΕ. Το ταμπλό του Vercel έδειξε Functions Storage 38 GB σε όριο 10, με
// αποθετήριο 50 MB. Η μέτρηση ανά αρχείο βρήκε ότι το ίχνος της `/privacy`
// —σελίδα νομικού κειμένου— ζύγιζε 34,4 MB. Τα 28,8 από αυτά ήταν το
// `sharp`, ο βελτιστοποιητής εικόνας ενός `next/image` που δεν καλείται
// πουθενά. Το ίδιο σε 37 συναρτήσεις: 910 MB ανά ανάπτυξη, με 39 MB μοναδικά.
//
// ΓΙΑΤΙ ΚΑΝΕΝΑΣ ΔΕΝ ΤΟ ΕΙΔΕ. Δεν σπάει τίποτα, δεν αργεί τίποτα ορατά, δεν
// κοκκινίζει κανένας έλεγχος. Φαίνεται μόνο ως λογαριασμός, μήνες μετά — κι
// τότε μοιάζει με πρόβλημα τιμολόγησης αντί για πρόβλημα κώδικα.
//
// ΤΟ ΟΡΙΟ ΕΙΝΑΙ ΚΑΣΤΑΝΙΑ, ΟΧΙ ΣΤΟΧΟΣ — ίδιος κανόνας με το budget.json δίπλα.
// Μια αλλαγή που ρίχνει το βάρος κατεβάζει το όριο· μια που το ανεβάζει πάνω
// από το περιθώριο σταματά. Ετσι το βάρος μόνο πέφτει.
//
// ΔΕΝ ΘΕΛΕΙ ΔΙΑΚΟΜΙΣΤΗ ΚΙ ΔΕΝ ΘΕΛΕΙ ΠΕΡΙΗΓΗΤΗ: διαβάζει τα ίχνη που γράφει το
// ίδιο το χτίσιμο. Κοστίζει χιλιοστά.
//
//     npm run build
//     node scripts/server-weight.mjs            (έλεγχος)
//     node scripts/server-weight.mjs --write     (καταγραφή νέου ορίου)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { globSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const FILE = new URL('../docs/perf/server.json', import.meta.url).pathname
const WRITE = process.argv.includes('--write')

/** Ποσοστό ανοχής πάνω από το καταγεγραμμένο, πριν κοκκινίσει. */
const SLACK = 0.08

const mb = n => (n / 1e6).toFixed(1).replace('.', ',')

// ── ΤΟ ΜΕΤΡΗΜΑ ────────────────────────────────────────────────────────────
// Το `.nft.json` κάθε διαδρομής είναι η ΑΚΡΙΒΗΣ λίστα που ανεβάζει το Vercel
// για εκείνη τη συνάρτηση. Δεν είναι εκτίμηση: είναι το ίδιο αρχείο που
// διαβάζει η πλατφόρμα όταν φτιάχνει το πακέτο.
const traces = globSync('.next/server/app/**/*.nft.json')
if (!traces.length) {
  console.error('✗ Δεν βρέθηκαν ίχνη. Χρειάζεται παραγωγικό χτίσιμο πρώτα: npm run build')
  process.exit(1)
}

const routes = {}
const unique = new Set()
for (const t of traces) {
  const base = dirname(t)
  let d
  try { d = JSON.parse(readFileSync(t, 'utf8')) } catch { continue }
  let bytes = 0
  for (const f of d.files || []) {
    const p = resolve(base, f)
    try { bytes += statSync(p).size; unique.add(p) } catch { /* λείπει: δεν μετράει */ }
  }
  routes[t.replace('.next/server/app', '').replace('.nft.json', '')] = bytes
}

const total = Object.values(routes).reduce((a, b) => a + b, 0)
const uniqueBytes = [...unique].reduce((a, p) => { try { return a + statSync(p).size } catch { return a } }, 0)

// ── Η ΒΑΡΥΤΕΡΗ ΜΟΝΗ ΣΥΝΑΡΤΗΣΗ ────────────────────────────────────────────
// Το άθροισμα λέει τι πληρώνεις· η βαρύτερη λέει πόσο αργεί μια κρύα εκκίνηση.
// Τα δύο κινούνται μαζί συνήθως, αλλά όχι πάντα: μία σελίδα που τραβά μόνη της
// μια βαριά βιβλιοθήκη ανεβάζει τη δεύτερη χωρίς να φανεί στην πρώτη.
const [heaviestRoute, heaviestBytes] = Object.entries(routes).sort((a, b) => b[1] - a[1])[0]

if (WRITE) {
  writeFileSync(FILE, JSON.stringify({
    note: 'Bytes ΙΧΝΟΥΣ ανά ανάπτυξη, από τα .nft.json παραγωγικού build. Το όριο μόνο κατεβαίνει.',
    slack: SLACK,
    total,
    heaviest: heaviestBytes,
    heaviestRoute,
    functions: Object.keys(routes).length,
    unique: uniqueBytes,
  }, null, 2) + '\n')
  console.log(`✓ Καταγράφηκε: ${mb(total)} MB ανά ανάπτυξη σε ${Object.keys(routes).length} συναρτήσεις`)
  console.log(`  βαρύτερη: ${mb(heaviestBytes)} MB · ${heaviestRoute}`)
  console.log(`  μοναδικά: ${mb(uniqueBytes)} MB (επανάληψη ${(total / uniqueBytes).toFixed(1)}×)`)
  process.exit(0)
}

let prev
try { prev = JSON.parse(readFileSync(FILE, 'utf8')) } catch {
  console.error(`✗ Λείπει το ${FILE}. Τρέξε πρώτα: node scripts/server-weight.mjs --write`)
  process.exit(1)
}

const slack = prev.slack ?? SLACK
const fails = []
const check = (name, now, before) => {
  const cap = Math.round(before * (1 + slack))
  if (now > cap) fails.push(`${name}: ${mb(now)} MB, όριο ${mb(cap)} MB (καταγεγραμμένο ${mb(before)})`)
}
check('σύνολο ανά ανάπτυξη', total, prev.total)
check('βαρύτερη συνάρτηση', heaviestBytes, prev.heaviest)

if (fails.length) {
  console.error(`✗ Το βάρος του διακομιστή μεγάλωσε:\n`)
  for (const f of fails) console.error('  ' + f)
  // Η ΥΠΟΔΕΙΞΗ ΔΕΙΧΝΕΙ ΤΟΝ ΕΝΟΧΟ, ΔΕΝ ΛΕΕΙ «ΨΑΞΕ». Οποιος φτάνει εδώ δεν ξέρει
  // τι μπήκε· το ίδιο το ίχνος της βαρύτερης συνάρτησης το λέει σε μια γραμμή.
  const base = dirname(`.next/server/app${heaviestRoute}.nft.json`)
  const worst = JSON.parse(readFileSync(`.next/server/app${heaviestRoute}.nft.json`, 'utf8'))
  const byPkg = {}
  for (const f of worst.files || []) {
    const p = resolve(base, f)
    let size = 0
    try { size = statSync(p).size } catch { continue }
    const at = p.indexOf('node_modules/')
    let key = 'ο κώδικας του προϊόντος'
    if (at >= 0) {
      const rest = p.slice(at + 13).split('/')
      key = rest[0].startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0]
    }
    byPkg[key] = (byPkg[key] || 0) + size
  }
  console.error(`
  Κάθε συνάρτηση ανεβαίνει ΞΕΧΩΡΙΣΤΑ σε κάθε ανάπτυξη: ό,τι μπει σε κοινό
  μονοπάτι πολλαπλασιάζεται επί ${Object.keys(routes).length}.

  Τι κουβαλά η βαρύτερη (${heaviestRoute}):`)
  for (const [pkg, size] of Object.entries(byPkg).sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    console.error(`      ${mb(size).padStart(7)} MB  ${pkg}`)
  }
  console.error(`
  Αν κάτι από αυτά ΔΕΝ καλείται στον διακομιστή, κράτα το έξω με
  \`outputFileTracingExcludes\` στο next.config.ts. Αν η αύξηση είναι σκόπιμη:
      node scripts/server-weight.mjs --write`)
  process.exit(1)
}

const drop = prev.total - total
console.log(`✓ Διακομιστής: ${mb(total)} MB ανά ανάπτυξη · βαρύτερη ${mb(heaviestBytes)} MB (${heaviestRoute})`)
if (drop > prev.total * 0.02) {
  console.log(`\n  Το βάρος έπεσε κατά ${mb(drop)} MB. Κατέβασε το όριο στο ίδιο commit:`)
  console.log('      node scripts/server-weight.mjs --write')
  process.exit(1)
}
