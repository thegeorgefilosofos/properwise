#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΜΙΑ ΑΠΑΝΤΗΣΗ ΑΠΟ ΤΕΣΣΕΡΙΣ Ή ΠΕΡΙΣΣΟΤΕΡΕΣ ΕΙΝΑΙ ΕΠΙΛΟΓΕΑΣ, ΟΧΙ ΠΙΛΟΥΛΕΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (14/11/2026). Ο ιδιοκτήτης φωτογράφισε το «Τι είδους
// εκκρεμότητα είναι»: έξι πιλούλες μίας επιλογής, η μία κάτω από την άλλη, σε
// έξι διαφορετικά πλάτη. «Δεν θα μπορούσε να είναι dropdown, πιο καθαρό και
// πιο συμπαγές;». Η σάρωση βρήκε τέσσερις ομάδες ίδιου είδους (εκκρεμότητα 6,
// πρότυπα μηνυμάτων 5, κατάσταση γεγονότος 4, νομική μορφή 4)· έγιναν όλες
// επιλογείς (CustomSelect). Μία πέμπτη (οι τιμές ασφάλισης) είναι φίλτρο λίστας
// και δηλώθηκε ως φίλτρο. Ο φύλακας κρατά το μηδέν.
//
// Ο ΚΑΝΟΝΑΣ. Μία επιλογή με 2–3 σύντομες απαντήσεις: τμηματικό χειριστήριο.
// Με 4 και πάνω, ή με μακριά λεκτικά: επιλογέας, με ⓘ για τη βοήθεια. Πολλαπλή
// επιλογή: κουτάκια ή πιλούλες σε πλέγμα ίσων κελιών.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ, ΑΚΡΙΒΩΣ. Στα .tsx του app/** και του components/**, κάθε
// `<ChipToggle … on={Α === Β}>`: η ισότητα στο `on` είναι η υπογραφή της ΜΙΑΣ
// επιλογής (η πολλαπλή γράφει `includes`/`has`). Μετρώ τις επιλογές με δύο
// τρόπους, στατικούς και τους δύο:
//   1. Η πιλούλα μέσα σε `.map(`: η πηγή της είναι πίνακας γραμμένος επιτόπου
//      (`[[…], […]].map`) ή όνομα σταθεράς (`X.map`, `Object.keys(X).map`,
//      `Object.entries(X).map`) που ορίζεται στο ίδιο αρχείο ή σε αρχείο που
//      εισάγεται με `@/` ή σχετική διαδρομή. Μετρώ τα στοιχεία του πρώτου
//      επιπέδου του πίνακα ή του αντικειμένου.
//   2. Πιλούλες γραμμένες μία μία, με το ίδιο αριστερό σκέλος στο `on`
//      (`on={method === 'percent'}`, `on={method === 'cpi'}`, …): μετρώ πόσες.
// ΤΙ ΔΕΝ ΒΛΕΠΕΙ (ΤΟ ΛΕΩ ΡΗΤΑ): πηγή που έρχεται από props ή κατάσταση
// (`items.map`, `groups.map`) δεν μετριέται στατικά. Εκεί ο κανόνας μένει
// κανόνας, όχι φύλακας.
//
// ΕΞΑΙΡΕΣΕΙΣ ΚΑΙ ΓΙΑΤΙ.
//   · app/dashboard/components/AddPropertyWizard.tsx: πλακίδια τύπου και
//     κατάστασης με εικόνα, σκόπιμα (PR #574).
//   · app/dashboard/components/budget/** και BillsBudget.tsx (PR #576),
//     components/dictation/** (PR #577): ανοιχτά PR που τα ξαναγράφουν.
//   · ΠΛΟΗΓΗΣΗ ΚΑΙ ΦΙΛΤΡΑ: μια σειρά καρτελών ή φίλτρων δεν είναι ερώτηση.
//     Δηλώνεται με σχόλιο `chip-group: πλοήγηση` ή `chip-group: φίλτρο` στις
//     οκτώ γραμμές πάνω από την πιλούλα, ώστε η εξαίρεση να διαβάζεται εκεί
//     που ζει.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { projectFiles } from './lib/git-files.mjs'

const MAX = 3
const SKIP = /^app\/dashboard\/components\/(AddPropertyWizard|BillsBudget)\.tsx$|^app\/dashboard\/components\/budget\/|^components\/dictation\/|\.test\.tsx?$/
const files = projectFiles("'app/**/*.tsx' 'components/**/*.tsx'").filter(f => !SKIP.test(f))

/** Μετρά τα στοιχεία πρώτου επιπέδου από το άνοιγμα `[` ή `{` στη θέση `at`. */
function countTop(src, at) {
  let depth = 0, n = 0, seen = false, str = null
  for (let i = at; i < src.length; i++) {
    const c = src[i]
    if (str) { if (c === '\\') { i++; continue } if (c === str) str = null; continue }
    if (c === '"' || c === "'" || c === '`') { str = c; seen = true; continue }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; continue }
    if ('[{('.includes(c)) { depth++; if (depth > 1) seen = true; continue }
    if (']})'.includes(c)) { depth--; if (depth === 0) return n + (seen ? 1 : 0); continue }
    if (depth === 1 && c === ',') { if (seen) n++; seen = false; continue }
    if (depth === 1 && !/\s/.test(c)) seen = true
  }
  return null
}

/** Ο ορισμός της σταθεράς `name` στο `src`: πόσα στοιχεία έχει. */
function sizeOfConst(src, name) {
  const m = new RegExp(`(?:const|let)\\s+${name}\\b[^=]*=\\s*`).exec(src)
  if (!m) return null
  let at = m.index + m[0].length
  while (src[at] === '(') at++
  return src[at] === '[' || src[at] === '{' ? countTop(src, at) : null
}

/** Το αρχείο από όπου εισάγεται το `name`, αν είναι δικό μας. */
function importedFrom(file, src, name) {
  const re = new RegExp(`import\\s*(?:type\\s*)?\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]([^'"]+)['"]`)
  const m = re.exec(src)
  if (!m) return null
  const spec = m[1]
  const base = spec.startsWith('@/') ? spec.slice(2) : spec.startsWith('.') ? join(dirname(file), spec) : null
  if (!base) return null
  for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx', '']) if (existsSync(base + ext)) return base + ext
  return null
}

function sizeOf(file, src, name) {
  const own = sizeOfConst(src, name)
  if (own != null) return own
  const from = importedFrom(file, src, name)
  return from ? sizeOfConst(readFileSync(from, 'utf8'), name) : null
}

const provlimata = []
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  if (!src.includes('<ChipToggle')) continue
  const lines = src.split('\n')
  const exempt = (i) => lines.slice(Math.max(0, i - 8), i + 1).some(l => /chip-group:\s*(πλοήγηση|φίλτρο)/.test(l))
  const sides = new Map()
  lines.forEach((line, i) => {
    if (!line.includes('<ChipToggle')) return
    const on = /\bon=\{\s*([^}]*?)\s*\}/.exec(line)
    if (!on) return
    const eq = /^(.+?)\s*===\s*(.+)$/.exec(on[1])
    if (!eq) return
    if (exempt(i)) return
    // 1. Μέσα σε `.map(`: η πηγή στις οκτώ γραμμές από πάνω.
    let size = null, how = ''
    for (let j = i; j >= Math.max(0, i - 8) && size == null; j--) {
      const pos = lines.slice(0, j).join('\n').length + (j ? 1 : 0)
      const l = lines[j]
      const mapAt = l.lastIndexOf('.map(')
      if (mapAt < 0) continue
      const before = l.slice(0, mapAt).replace(/\s+as\s+[\w.<>|[\], ]+\)\s*$/, ')')
      const fromObj = /Object\.(?:keys|entries|values)\(\s*([A-Za-z_]\w*)\s*\)\)?\s*$/.exec(before)
      const ident = /(?<![\w.)\]])([A-Za-z_]\w*)\s*$/.exec(before)
      if (fromObj || ident) {
        const name = (fromObj || ident)[1]
        size = sizeOf(f, src, name); how = name
      } else if (/\]\s*(?:as\s+const\s*)?\)?\s*$/.test(before)) {
        // πίνακας επιτόπου: βρες το άνοιγμά του
        const end = pos + before.lastIndexOf(']')
        let depth = 0, k = end
        for (; k >= 0; k--) { const c = src[k]; if (c === ']') depth++; else if (c === '[') { depth--; if (depth === 0) break } }
        if (k >= 0) { size = countTop(src, k); how = 'πίνακας επιτόπου' }
      }
      break
    }
    if (size != null) {
      if (size > MAX) provlimata.push({ arxeio: f, grammi: i + 1, ti: `${size} επιλογές (${how}), on={${on[1]}}` })
      return
    }
    // 2. Πιλούλες μία μία με το ίδιο αριστερό σκέλος.
    const left = eq[1].trim().replace(/^!/, '')
    if (!sides.has(left)) sides.set(left, [])
    sides.get(left).push(i + 1)
  })
  for (const [left, at] of sides) {
    if (at.length > MAX) provlimata.push({ arxeio: f, grammi: at[0], ti: `${at.length} πιλούλες με on={${left} === …}` })
  }
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} ομάδες πιλουλών μίας επιλογής με περισσότερες από ${MAX} επιλογές:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και άλλες ${provlimata.length - 30}`)
  console.error(`\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: κάν' το επιλογέα (CustomSelect, app/dashboard/components/UIComponents.tsx),`)
  console.error(`  με τις ίδιες τιμές και την ίδια προεπιλογή· την εξήγηση πίσω από ένα ⓘ.`)
  console.error(`  Αν είναι σειρά καρτελών ή φίλτρων και όχι ερώτηση, γράψε από πάνω σχόλιο`)
  console.error(`  \`chip-group: πλοήγηση\` ή \`chip-group: φίλτρο\`.\n`)
  process.exit(1)
}
console.log(`✓ καμία ομάδα πιλουλών μίας επιλογής με περισσότερες από ${MAX} επιλογές σε ${files.length} αρχεία`)
