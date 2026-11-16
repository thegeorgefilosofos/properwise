#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΑΡΑΓΡΑΦΟΣ ΖΥΓΙΖΕΤΑΙ ΜΕ `pretty`, ΠΟΤΕ ΜΕ `balance`
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (14/11/2026). Ο ιδιοκτήτης φωτογράφισε άνισες αλλαγές
// γραμμής σε κείμενο σώματος: «ζύγιση, στοίχιση, αλλαγή γραμμής· και αυτό
// ισχύει γενικά σε όλη την εφαρμογή». Το `balance` κόβει ΚΑΘΕ γραμμή στο ίδιο
// μήκος: σε τίτλο δύο γραμμών είναι σωστό, σε παράγραφο αφήνει κενό δεξιά σε
// όλες και η στήλη μοιάζει στενότερη απ' ό,τι είναι. Η σάρωση βρήκε επτά
// σημεία που το έδιναν σε κείμενο σώματος: το `.lp-lede` στο app/globals.css
// και έξι `<p>` με `textWrap: 'balance'` γραμμένο στο χέρι (app/en/view.tsx
// τρεις φορές, η πρόταση κλεισίματος του app/page.tsx, PropertyAssistant, η
// κενή κατάσταση του πίνακα). Τα δύο τελευταία που βρέθηκαν ήταν γραμμένα σε
// δύο γραμμές και η πρώτη γραφή του φύλακα, γραμμή γραμμή, δεν τα έβλεπε.
// Διορθώθηκαν όλα· ο φύλακας κρατά το μηδέν.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ, ΑΚΡΙΒΩΣ.
//   · app/**/*.css: κάθε κανόνας με `text-wrap: balance` ή `text-wrap-style:
//     balance`. Κοιτάζω το ΥΠΟΚΕΙΜΕΝΟ κάθε επιλογέα (το τελευταίο σύνθετο
//     κομμάτι, ακόμη και μέσα σε `:where()`/`:is()`): απαγορεύεται αν είναι στοιχείο
//     σώματος (p, li, dd, blockquote, body, main, article) ή κλάση που ονομάζει
//     σώμα (`-p`, `-prose`, `-body`, `-text`, `-lede`, `-desc`, `-para`,
//     `-copy`). Ο,τι άλλο (τίτλοι, ετικέτες, σύνδεσμοι, κουμπιά, κεφαλίδες
//     πίνακα) κρατά το `balance`: εκεί ανήκει.
//   · app/** και components/** .tsx: ένα `<p>`, `<li>`, `<dd>` ή `<blockquote>`
//     με `textWrap: 'balance'` οπουδήποτε στην ετικέτα ανοίγματός του, όσες
//     γραμμές κι αν πιάνει. Οι γραμμές σχολίων εξαιρούνται.
//     Το `TT.label`/`TT.h*` πάνω σε `<p>` ΔΕΝ μετρά: είναι ετικέτα που έτυχε να
//     γραφτεί με `<p>`· η κλίμακα (components/tokens.ts) το ξέρει.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'
import { openTags } from './lib/jsx-tag.mjs'

const BODY_EL = /^(p|li|dd|blockquote|body|main|article)$/
const BODY_CLASS = /\.(?:[\w-]*-)?(?:p|prose|body|text|lede|desc|para|copy)(?![\w-])/

/** Χωρίζει στα κόμματα του πρώτου επιπέδου (όχι μέσα σε παρενθέσεις). */
function splitTop(s, sep = ',') {
  const out = []; let depth = 0, cur = ''
  for (const c of s) {
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    if (c === sep && depth === 0) { out.push(cur); cur = ''; continue }
    cur += c
  }
  out.push(cur)
  return out.map(x => x.trim()).filter(Boolean)
}

/** Το τελευταίο σύνθετο κομμάτι ενός επιλογέα (μετά από κενό, >, +, ~). */
function subject(sel) {
  let depth = 0, start = 0
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i]
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (depth === 0 && /[\s>+~]/.test(c)) start = i + 1
  }
  return sel.slice(start).trim()
}

/** Ονομάζει σώμα το υποκείμενο; Κοιτά και μέσα σε `:where()` / `:is()`. */
function isBody(compound) {
  const noNot = compound.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, '')
  const inner = [...noNot.matchAll(/:(?:where|is)\(((?:[^()]|\([^()]*\))*)\)/g)].map(m => m[1])
  const own = noNot.replace(/:(?:where|is)\((?:[^()]|\([^()]*\))*\)/g, '')
  const el = (own.match(/^[a-z][a-z0-9]*/) || [])[0]
  if (el && BODY_EL.test(el)) return true
  if (BODY_CLASS.test(own)) return true
  return inner.some(list => splitTop(list).some(s => isBody(subject(s))))
}

const provlimata = []

const cssFiles = projectFiles("'app/**/*.css'")
for (const f of cssFiles) {
  const raw = readFileSync(f, 'utf8')
  // Τα σχόλια γίνονται κενά ίδιου μήκους, ώστε οι γραμμές να μένουν σωστές.
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selText, body] = m
    if (!/text-wrap(?:-style)?\s*:\s*balance\b/.test(body)) continue
    const line = css.slice(0, m.index + m[0].indexOf('{')).split('\n').length
    for (const sel of splitTop(selText.trim())) {
      if (sel.startsWith('@')) continue
      if (isBody(subject(sel))) provlimata.push({ arxeio: f, grammi: line, ti: `${sel} { text-wrap: balance }` })
    }
  }
}

const tsxFiles = projectFiles("'app/**/*.tsx' 'components/**/*.tsx'").filter(f => !/\.test\.tsx?$/.test(f))
// Η ΕΤΙΚΕΤΑ ΟΛΟΚΛΗΡΗ, ΟΧΙ Η ΓΡΑΜΜΗ: `<p` στη μία γραμμή και το `style={{`
// με το `textWrap: 'balance'` σε επόμενη (scripts/lib/jsx-tag.mjs).
const BALANCE_RE = /textWrap\s*:\s*['"]balance['"]/
for (const f of tsxFiles) {
  const src = readFileSync(f, 'utf8')
  for (const { tag, line } of openTags(src, 'p|li|dd|blockquote')) {
    if (BALANCE_RE.test(tag)) provlimata.push({ arxeio: f, grammi: line + 1, ti: tag.replace(/\s+/g, ' ').slice(0, 60) })
  }
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} κείμενα σώματος ζυγίζονται με \`balance\`:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και άλλα ${provlimata.length - 30}`)
  console.error(`\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: γράψε \`text-wrap-style: pretty\` (CSS) ή \`textWrap: 'pretty'\` (στυλ).`)
  console.error(`  Το \`balance\` μένει για τίτλους και σύντομες ετικέτες· αν το στοιχείο ΕΙΝΑΙ τίτλος,`)
  console.error(`  δώσ' του όνομα τίτλου (\`-title\`, \`-label\`) ή στοιχείο επικεφαλίδας αντί για <p>.\n`)
  process.exit(1)
}
console.log(`✓ κανένα κείμενο σώματος με \`balance\` σε ${cssFiles.length} φύλλα και ${tsxFiles.length} αρχεία`)
