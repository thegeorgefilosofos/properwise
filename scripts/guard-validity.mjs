#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΜΙΑ ΤΙΜΗ ΤΟΥ ΚΡΑΤΟΥΣ ΔΕΝ ΓΕΡΝΑΕΙ ΣΙΩΠΗΛΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΕΝΑΡΙΟ ΠΟΥ ΚΛΕΙΝΕΙ. Είναι 1η Ιανουαρίου 2027. Η κλίμακα φόρου ενοικίων
// στην οθόνη είναι του 2026. Ο τύπος είναι σωστός, τα 226 τεστ περνούν, ο
// έλεγχος διάταξης είναι πράσινος, το build βγαίνει καθαρό. Και ο χρήστης
// βλέπει έναν αριθμό που δεν ισχύει πια, χωρίς κανένα σημάδι.
//
// Κανένας από τους υπόλοιπους 101 φύλακες δεν μπορεί να το δει: όλοι ρωτούν
// «είναι σωστός ο κώδικας;». Εδώ ο κώδικας ΕΙΝΑΙ σωστός. Λάθος είναι η
// ΗΜΕΡΟΜΗΝΙΑ.
//
// ΤΙ ΜΕΤΡΑΕΙ. Διαβάζει το μητρώο `lib/legal/validity.ts` και κόβει όταν:
//
//   · κάτι ΕΛΗΞΕ                     (`validTo` πριν από σήμερα)
//   · κάτι λήγει μέσα σε 45 ημέρες   (χρόνος να το κοιτάξει άνθρωπος)
//   · κάτι δεν ελέγχθηκε πάνω από 12 μήνες
//   · κάποιο `where` δείχνει σε αρχείο που δεν υπάρχει πια
//
// ΤΟ ΤΕΛΕΥΤΑΙΟ ΕΙΝΑΙ ΤΟ ΠΙΟ ΥΠΟΥΛΟ. Μια μετακίνηση αρχείου αφήνει το μητρώο να
// δείχνει στο κενό: εξακολουθεί να λέει «ελεγμένο», ενώ κανείς δεν ξέρει πού
// ζει πια η τιμή.
//
// ΤΟ ΣΗΜΕΡΑ ΔΙΝΕΤΑΙ ΑΠΟ ΕΞΩ ΟΤΑΝ ΧΡΕΙΑΖΕΤΑΙ (`VALIDITY_TODAY`), ώστε ο πάγκος
// μεταλλάξεων να μπορεί να ρωτήσει «τι θα γινόταν του χρόνου» χωρίς να αλλάξει
// το ρολόι του μηχανήματος.
// ═══════════════════════════════════════════════════════════════════════════
import { existsSync, readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'
import { execFileSync } from 'node:child_process'

const SRC = 'lib/legal/validity.ts'
if (!existsSync(SRC)) {
  console.error(`✗ λείπει το μητρώο ισχύος: ${SRC}`)
  process.exit(1)
}

// ΓΙΑΤΙ ΜΕΣΩ tsx ΚΑΙ ΟΧΙ ΜΕ REGEX. Το μητρώο είναι TypeScript με συναρτήσεις
// κατάστασης· μια regex θα διάβαζε τα πεδία αλλά όχι τους κανόνες, οπότε ο
// φύλακας θα έκρινε με ΔΙΚΗ ΤΟΥ λογική. Μία υλοποίηση, ένας κριτής.
const today = process.env.VALIDITY_TODAY || new Date().toISOString().slice(0, 10)
const probe = `
import { REGULATED, needsAttention, daysLeft, statusOf } from '@/lib/legal/validity'
const today = ${JSON.stringify(today)}
const rows = REGULATED.map(r => ({ id: r.id, label: r.label, where: r.where, source: r.source,
  recheck: r.recheck, status: statusOf(r, today), days: daysLeft(r, today) }))
process.stdout.write(JSON.stringify({ rows, attention: needsAttention(today).map(x => x.r.id) }))
`
const tmp = 'scripts/__validity-probe.ts'
let out
try {
  const { writeFileSync, unlinkSync } = await import('node:fs')
  writeFileSync(tmp, probe)
  out = JSON.parse(execFileSync('npx', ['--yes', 'tsx', tmp], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
  unlinkSync(tmp)
} catch (e) {
  try { (await import('node:fs')).unlinkSync(tmp) } catch {}
  console.error('✗ το μητρώο ισχύος δεν διαβάζεται:\n' + (e.stderr || e.message))
  process.exit(1)
}

const findings = []
for (const r of out.rows) {
  if (!existsSync(r.where)) findings.push({ kind: 'ΧΑΜΕΝΟ ΑΡΧΕΙΟ', r, why: `το «${r.where}» δεν υπάρχει` })
  else if (r.status === 'expired') findings.push({ kind: 'ΕΛΗΞΕ', r, why: `πριν από ${-r.days} ημέρες` })
  else if (r.status === 'expiring') findings.push({ kind: 'ΛΗΓΕΙ', r, why: `σε ${r.days} ημέρες` })
  else if (r.status === 'stale') findings.push({ kind: 'ΑΝΕΛΕΓΚΤΟ', r, why: 'πάνω από 12 μήνες χωρίς ανθρώπινο έλεγχο' })
}

// Και το αντίστροφο: μια πηγή που δεν είναι σύνδεσμος δεν ανοίγει με κλικ, άρα
// ο έλεγχος των δέκα λεπτών γίνεται έρευνα μισής ώρας.
for (const r of out.rows) {
  if (!/^https:\/\//.test(r.source)) findings.push({ kind: 'ΧΩΡΙΣ ΠΗΓΗ', r, why: 'η πηγή δεν είναι σύνδεσμος https' })
}

// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΙ ΤΟ ΑΝΤΙΣΤΡΟΦΟ ΕΡΩΤΗΜΑ: ΠΟΙΟΣ ΚΑΝΟΝΑΣ ΔΕΝ ΕΙΝΑΙ ΣΤΟ ΜΗΤΡΩΟ ΚΑΘΟΛΟΥ;
// ─────────────────────────────────────────────────────────────────────────
// ΟΛΟΙ ΟΙ ΠΑΡΑΠΑΝΩ ΕΛΕΓΧΟΙ ΡΩΤΟΥΝ «ΕΙΝΑΙ ΦΡΕΣΚΕΣ ΟΙ ΕΓΓΡΑΦΕΣ;». Καμία δεν
// ρωτά «λείπει εγγραφή;» — και αυτό είναι το πιο ύπουλο, γιατί ένα μητρώο με
// είκοσι φρέσκες εγγραφές διαβάζεται ως πλήρες.
//
// ΤΙ ΒΡΕΘΗΚΕ ΜΕ ΤΟ ΧΕΡΙ, ΠΡΙΝ ΓΡΑΦΤΕΙ ΑΥΤΟΣ Ο ΚΑΝΟΝΑΣ. Η αναστολή ΦΠΑ στα
// νεόδμητα (9.270 € έναντι 72.000 € σε ακίνητο 300.000 €), ο φόρος υπεραξίας,
// η τεκμαρτή έκπτωση 5% —το ποσοστό που μπαίνει σε ΚΑΘΕ δήλωση ενοικίων— και
// τα εισοδηματικά όρια των στεγαστικών προγραμμάτων. Τέσσερις κανόνες που
// κανένα μητρώο δεν επρόκειτο ποτέ να ζητήσει να ξανακοιταχτούν.
//
// Ο ΚΑΝΟΝΑΣ: κάθε αρχείο του lib/ που επικαλείται νόμο, ΦΕΚ, ΚΥΑ ή ΠΟΛ πρέπει
// να φυλάσσεται από ένα από τα δύο μητρώα — το μητρώο ισχύος για τιμές που
// λήγουν, το μητρώο λογιστικών πηγών για πρότυπα και εγκυκλίους. Οτι δεν
// φυλάσσεται από κανένα, δηλώνεται εδώ ΜΕ ΤΟΝ ΛΟΓΟ.
const LAW = /ν\.\d{4}\/\d{4}|ΦΕΚ |ΚΥΑ |ΠΟΛ\.\d/
const SOURCES = 'data/accounting-sources.json'

/** Αρχεία που ΕΞΗΓΟΥΝ νόμο χωρίς να κρατούν τιμή του. Με τον λόγο, πάντα. */
const EXPLAINS_ONLY = {
  'lib/tax/rentCollectionMode.ts': 'διαβάζει τον τρόπο είσπραξης· το ποσοστό και η προϋπόθεση ζουν στο lib/accounting/statement.ts, που είναι στο μητρώο ως presumptive-deduction',
  'lib/rent/collect.ts': 'καταγράφει εισπράξεις· την τεκμαρτή έκπτωση την εξηγεί, δεν την ορίζει',
  'lib/billing/consolidate.ts': 'ενοποιεί εισοδήματα· δανείζεται το ποσοστό από το statement.ts και το γράφει σε κείμενο',
}

const unguarded = []
{
  const guardedByValidity = new Set(out.rows.map(r => r.where))
  const acct = existsSync(SOURCES) ? readFileSync(SOURCES, 'utf8') : ''
  for (const f of projectFiles("'lib/**/*.ts'")) {
    if (f.includes('.test.') || f === 'lib/legal/validity.ts') continue
    if (!LAW.test(readFileSync(f, 'utf8'))) continue
    if (guardedByValidity.has(f) || acct.includes(f) || f in EXPLAINS_ONLY) continue
    unguarded.push(f)
  }
}

if (unguarded.length) {
  console.error(`✗ ${unguarded.length} αρχεία επικαλούνται νόμο και δεν τα φυλάει κανένα μητρώο:\n`)
  for (const f of unguarded) console.error(`  ${f}`)
  console.error(`\n  Ενας κανόνας χωρίς μητρώο δεν θα ζητηθεί ΠΟΤΕ να ξανακοιταχτεί: θα`)
  console.error('  μείνει σωστός ώσπου να αλλάξει ο νόμος και μετά λάθος για πάντα.\n')
  console.error(`  ΔΙΟΡΘΩΣΗ: εγγραφή στο ${SRC} (τιμή που λήγει ή θέλει ετήσιο έλεγχο) ή`)
  console.error(`  στο ${SOURCES} (πρότυπο/εγκύκλιος). Αν το αρχείο απλώς ΕΞΗΓΕΙ τον νόμο`)
  console.error('  χωρίς να κρατά τιμή του, δήλωσέ το στο EXPLAINS_ONLY εδώ, με τον λόγο.')
  process.exit(1)
}

if (findings.length) {
  console.error(`✗ ${findings.length} ρυθμιζόμενα μεγέθη θέλουν ανθρώπινο μάτι (σήμερα ${today}):\n`)
  for (const f of findings) {
    console.error(`  ${f.kind}  ${f.r.label}`)
    console.error(`     ${f.why} · ${f.r.where}`)
    console.error(`     ${f.r.source}`)
    console.error(`     ${f.r.recheck}\n`)
  }
  console.error('  ΔΙΟΡΘΩΣΗ: άνοιξε την πηγή, δες αν άλλαξε η τιμή, ενημέρωσε τον κώδικα ΚΑΙ')
  console.error('  το lib/legal/validity.ts (νέο validTo και νέο checkedAt). Αν δεν άλλαξε,')
  console.error('  αρκεί το checkedAt: αυτό είναι η υπογραφή ότι κάποιος κοίταξε.')
  process.exit(1)
}
console.log(`✓ και τα ${out.rows.length} ρυθμιζόμενα μεγέθη είναι εν ισχύι και ελεγμένα (σήμερα ${today}), κανένας κανόνας εκτός μητρώου`)
