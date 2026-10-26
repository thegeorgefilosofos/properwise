#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΣΤΑΝΙΑ ΤΗΣ ΟΠΤΙΚΗΣ ΣΑΡΩΣΗΣ: ΚΑΜΙΑ ΚΑΤΗΓΟΡΙΑ ΔΕΝ ΑΝΕΒΑΙΝΕΙ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΗΤΑΝ ΩΣ ΤΩΡΑ. Ο σαρωτής scripts/e2e-optiki-sarosi.mjs βρήκε 441 ευρήματα
// στο πρώτο του πέρασμα (21/10/2026), 94 από αυτά αληθινά· το PR #431 τα
// διόρθωσε. Δεν τον έτρεχε όμως τίποτα μόνο του: ο επόμενος που θα έγραφε
// ετικέτα μία λέξη ανά γραμμή θα το μάθαινε από τον ιδιοκτήτη, όπως και την
// πρώτη φορά.
//
// ΓΙΑΤΙ ΚΑΣΤΑΝΙΑ ΚΑΙ ΟΧΙ ΜΗΔΕΝΙΚΗ ΑΝΟΧΗ. Μετά τη διόρθωση μένουν ευρήματα που
// είναι σκόπιμα: το «Ν» της Νόας στη μέση της κύλισης, ίδιο κουμπί σε κάθε
// πακέτο, «εκτίμηση» δίπλα σε επίσημο νούμερο όταν το νούμερο ΕΙΝΑΙ εκτίμηση.
// Ενας έλεγχος που απαιτεί μηδέν κοκκινίζει από την πρώτη μέρα και μαθαίνει
// τον αναγνώστη να τον αγνοεί. Εδώ κρατιέται το πλήθος ανά κατηγορία ×
// σοβαρότητα και κοκκινίζει μόνο όταν ΑΝΕΒΕΙ.
//
// ΤΙ ΤΥΠΩΝΕΙ ΟΤΑΝ ΚΟΚΚΙΝΙΖΕΙ. Τα νέα ευρήματα, ένα ένα, με οθόνη, πλάτη και
// αρχείο:γραμμή. Οχι μόνο «επικάλυψη 41 > 40»: αυτό λέει ότι κάτι χάλασε,
// όχι τι.
//
// ΟΤΑΝ ΠΕΦΤΕΙ. Οι καστάνιες περιηγητή εδώ (κλίμακα σχεδιασμού, ύψη καρτελών)
// δεν κοκκινίζουν στην πτώση, γιατί μια μέτρηση σε περιηγητή κουνιέται κατά
// ένα εικονοστοιχείο ανάμεσα σε μηχανές (βλ. scripts/lib/ratchet.mjs). Λένε
// «κατέβασε το όριο». Το ίδιο κι εδώ, με `--write`.
//
//     node scripts/optiki-ratchet.mjs                 κρίση της τελευταίας σάρωσης
//     node scripts/optiki-ratchet.mjs --write         γράφει τη βάση από αυτήν
//     OPT_OUT=dir node scripts/optiki-ratchet.mjs     από άλλον φάκελο σάρωσης
//
// Κωδικός εξόδου: 0 καμία άνοδος · 1 άνοδος · 2 δεν κρίθηκε (λείπει σάρωση ή
// έτρεξε σε άλλα πλάτη/θέματα από τη βάση).
// ═══════════════════════════════════════════════════════════════════════════
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from './lib/paths.mjs'
import { compare, baselineFrom, SEVERITIES } from './lib/optiki-ratchet.mjs'

const OUT = process.env.OPT_OUT || join(repoRoot, '.perf-bench', 'optiki')
const BASE_FILE = join(repoRoot, 'scripts', 'optiki-baseline.json')
const REL = 'scripts/optiki-baseline.json'

const fFile = join(OUT, 'findings.json'), rFile = join(OUT, 'run.json')
if (!existsSync(fFile) || !existsSync(rFile)) {
  console.error(`✗ Δεν βρέθηκε σάρωση στο ${OUT}. Τρέξε πρώτα: npm run e2e:optiki`)
  process.exit(2)
}
const findings = JSON.parse(readFileSync(fFile, 'utf8'))
const run = JSON.parse(readFileSync(rFile, 'utf8'))

if (process.argv.includes('--write')) {
  const old = existsSync(BASE_FILE) ? JSON.parse(readFileSync(BASE_FILE, 'utf8')) : {}
  const note = old.σημείωση || 'ΓΡΑΨΕ ΕΔΩ τι άλλαξε και γιατί, πριν το commit.'
  writeFileSync(BASE_FILE, JSON.stringify(baselineFrom(findings, run, note), null, 1) + '\n')
  console.log(`✓ Γράφτηκε το ${REL}: ${findings.length} ευρήματα σε ${run.targets.length} οθόνες.`)
  console.log('  Ανοιξε το αρχείο και γράψε στη «σημείωση» τι άλλαξε. Ο διακόπτης γράφει αριθμούς, όχι λόγους.')
  process.exit(0)
}

const base = JSON.parse(readFileSync(BASE_FILE, 'utf8'))
const r = compare(findings, run, base)
if (r.refused) {
  console.error(`✗ Η καστάνια δεν κρίθηκε: ${r.refused}.`)
  console.error('  Με λιγότερα πλάτη ένα εύρημα μπορεί να βγει χαμηλότερης σοβαρότητας και να φανεί ψεύτικη άνοδος δίπλα.')
  console.error('  Τρέξε τη σάρωση με τα πλάτη και τα θέματα της βάσης (E2E_ONLY για λιγότερες οθόνες επιτρέπεται).')
  process.exit(2)
}

const label = (k) => k.replace('|', ' · ')
console.log(`Οπτική σάρωση: ${findings.length} ευρήματα σε ${run.targets.length} οθόνες, ${run.widths.join('/')} · ${run.themes.join('/')}`)
for (const row of r.rows) console.log(`  ${String(row.now).padStart(4)}/${String(row.max).padEnd(4)} ${label(row.key)}`)

if (r.up.length) {
  console.error(`\n✗ ΑΝΕΒΗΚΕ: ${r.up.map((x) => `${label(x.key)} ${x.max}→${x.now}`).join(' · ')}`)
  const upKeys = new Set(r.up.map((x) => x.key))
  const shown = r.fresh.filter((f) => upKeys.has(`${f.cls}|${f.sev}`))
    .sort((a, b) => SEVERITIES.indexOf(a.sev) - SEVERITIES.indexOf(b.sev) || a.target.localeCompare(b.target))
  console.error(`\n  ΤΑ ΝΕΑ ΕΥΡΗΜΑΤΑ (${shown.length}):`)
  for (const f of shown.slice(0, 30)) {
    console.error(`  · [${f.sev}] ${f.cls} · ${f.target} · ${f.widths.join('/')} ${f.themes.join('+')}`)
    console.error(`      ${f.what}${f.text ? ` · «${f.text.slice(0, 70)}»` : ''}`)
    console.error(`      ${f.file || 'αρχείο: δεν βρέθηκε'}${f.sel ? ` · ${f.sel.slice(0, 80)}` : ''}`)
  }
  if (shown.length > 30) console.error(`  … και ${shown.length - 30} ακόμη, όλα στο ${join(OUT, 'findings.md')}`)
  if (!shown.length) console.error('  Ολα τα ευρήματα της κατηγορίας είναι γνωστά ως κείμενο: το ίδιο εύρημα εμφανίζεται σε περισσότερες θέσεις. Δες το findings.md.')
  console.error(`
  ΤΙ ΝΑ ΚΑΝΕΙΣ. Αν είναι σφάλμα, διόρθωσέ το: κάθε γραμμή από πάνω λέει
  οθόνη, πλάτος και αρχείο. Αν είναι σκόπιμο, τρέξε
  «node scripts/optiki-ratchet.mjs --write» και γράψε τον λόγο στη σημείωση
  του ${REL}.`)
  process.exit(1)
}

if (r.down.length) {
  console.log(`\n   ↓ ${r.down.map((x) => `${label(x.key)} ${x.max}→${x.now}`).join(' · ')}. Κατέβασε το όριο: «node scripts/optiki-ratchet.mjs --write» και γράψε στη σημείωση του ${REL} τι διορθώθηκε.`)
}
console.log('\n✅ Καμία κατηγορία της οπτικής σάρωσης δεν ανέβηκε.')
