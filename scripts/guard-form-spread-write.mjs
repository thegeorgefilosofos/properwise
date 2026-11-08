#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΤΑΣΤΑΣΗ ΦΟΡΜΑΣ ΔΕΝ ΑΠΛΩΝΕΤΑΙ ΑΥΤΟΥΣΙΑ ΣΕ INSERT/UPSERT/UPDATE
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ. 06/11/2026: λογιστής πρόσθεσε ακίνητο, συμπλήρωσε όνομα και
// ΑΦΜ ιδιοκτήτη, άφησε κενή τη λήξη ασφάλισης και είδε «Το ακίνητο
// αποθηκεύτηκε, αλλά οι επαφές και οι σημειώσεις του δεν καταχωρήθηκαν». Ο
// οδηγός έγραφε `upsert({ ...settings, … })`: η φόρμα κρατά το κενό ως '' και η
// στήλη `property_settings.insurance_expiry` είναι date — Postgres 22007,
// ολόκληρη η γραμμή στα σκουπίδια, ΚΑΘΕ φορά (PR #489). Η σάρωση που
// ακολούθησε βρήκε το ίδιο σχήμα δύο φορές ακόμη:
//
//   TabInventory          insert({ ...data, … })   '' στο inventory_repairs.repair_date
//   NotificationSettings  upsert({ ...next, … })   ξανάγραφε τις στήλες επιβεβαίωσης
//                                                  που γράφει μόνο η βάση
//
// Ένα αντικείμενο φόρμας ΔΕΝ ξέρει τι δέχεται η βάση: έχει '' όπου η στήλη
// θέλει null, NaN όπου θέλει αριθμό· και ό,τι ήρθε από `select('*')`.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ. Κάθε `.insert(` / `.upsert(` / `.update(` σε app/, lib/,
// components/. Στο πρώτο όρισμα (και, αν είναι σκέτο όνομα, στο αντικείμενο
// που δηλώνεται με αυτό το όνομα στο ίδιο αρχείο) ψάχνεται `...Χ`, όπου το Χ
// έχει όνομα κατάστασης φόρμας: form, f, settings, state, draft, values,
// fields, input(s), next, prefs, data, edit(ing), ή λήγει σε Form, Draft,
// State, Settings, Values, Prefs.
//
// ΤΙ ΠΕΡΝΑ. Το άπλωμα που περνά πρώτα από κανονικοποίηση: `...rowFromForm(Χ)`
// (lib/core/rowFromForm.ts) ή `...settingsRow(Χ)` (lib/property/settingsRow.ts).
// Άπλωμα κλήσης άλλης συνάρτησης ΠΑΝΩ σε όνομα φόρμας (`...pick(form)`) δεν
// περνά: δεν ξέρουμε τι κάνει με το ''. Τα ονόματα του στρώματος δεδομένων
// (`patch`, `extra`, `clean`, `payload`) δεν είναι φόρμα — εκεί η γραμμή έχει
// ήδη χτιστεί από τον καλούντα· αυτόν ελέγχει ο φύλακας.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const NORMALIZERS = new Set(['rowFromForm', 'settingsRow'])
const FORM_NAME = /^(form|f|settings|state|draft|values|fields|inputs?|next|prefs|data|edit|editing)$|(Form|Draft|State|Settings|Values|Prefs)$/

const files = projectFiles("'app/**/*.ts' 'app/**/*.tsx' 'lib/**/*.ts' 'lib/**/*.tsx' 'components/**/*.ts' 'components/**/*.tsx'")
  .filter(f => !/\.test\.tsx?$|\.testkit\.ts$/.test(f))

/** Από τη θέση `i` (μετά το άνοιγμα), ως το ταίριασμα. Προσπερνά συμβολοσειρές. */
function balanced(src, i, open, close) {
  let depth = 1, q = null
  for (let j = i; j < src.length; j++) {
    const c = src[j]
    if (q) { if (c === '\\') j++; else if (c === q) q = null; continue }
    if (c === '"' || c === "'" || c === '`') { q = c; continue }
    if (c === '/' && src[j + 1] === '/') { j = src.indexOf('\n', j); if (j < 0) return src.length; continue }
    if (c === open) depth++
    else if (c === close && --depth === 0) return j
  }
  return src.length
}

/** Το πρώτο όρισμα της κλήσης: ως το πρώτο κόμμα στο ανώτερο επίπεδο. */
function firstArg(src, start) {
  const end = balanced(src, start, '(', ')')
  const body = src.slice(start, end)
  let depth = 0, q = null
  for (let j = 0; j < body.length; j++) {
    const c = body[j]
    if (q) { if (c === '\\') j++; else if (c === q) q = null; continue }
    if (c === '"' || c === "'" || c === '`') { q = c; continue }
    if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c)) depth--
    else if (c === ',' && depth === 0) return body.slice(0, j)
  }
  return body
}

/** Τα απλώματα φόρμας μέσα σε ένα κομμάτι κώδικα. */
function formSpreads(text) {
  const out = []
  for (const m of text.matchAll(/\.\.\.\s*([A-Za-z_$][\w$]*)(\s*\(\s*([A-Za-z_$][\w$]*)?)?/g)) {
    const [, name, call, inner] = m
    if (call) {
      // `...fn(x)`: περνά αν η fn είναι κανονικοποίηση ή αν το x δεν είναι φόρμα.
      if (NORMALIZERS.has(name) || !inner || !FORM_NAME.test(inner)) continue
      out.push(`...${name}(${inner})`)
    } else if (FORM_NAME.test(name)) {
      out.push(`...${name}`)
    }
  }
  return out
}

const lineOf = (src, i) => src.slice(0, i).split('\n').length
const provlimata = []

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(/\.(insert|upsert|update)\s*\(/g)) {
    const arg = firstArg(src, m.index + m[0].length).trim()
    let hits = formSpreads(arg)
    // ΕΝΑ ΒΗΜΑ ΠΙΣΩ: `upsert(row)` με `const row = { ...next, … }` πιο πάνω.
    const bare = arg.match(/^\[?\s*([A-Za-z_$][\w$]*)\s*\]?$/)
    if (bare) {
      const decl = new RegExp(`\\b(?:const|let)\\s+${bare[1]}\\s*(?::[^=]+)?=\\s*\\{`, 'g')
      for (const d of src.slice(0, m.index).matchAll(decl)) {
        const s = d.index + d[0].length
        hits = hits.concat(formSpreads(src.slice(s, balanced(src, s, '{', '}'))))
      }
    }
    for (const ti of new Set(hits)) provlimata.push({ arxeio: file, grammi: lineOf(src, m.index), ti: `.${m[1]}(… ${ti} …)` })
  }
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} εγγραφές απλώνουν κατάσταση φόρμας αυτούσια στη βάση:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error(`\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: πέρασε τη φόρμα από την rowFromForm (lib/core/rowFromForm.ts),
  που κάνει το '' και το NaN null, ή γράψε ρητά τις στήλες. Το '' σε στήλη date,
  numeric ή uuid ρίχνει ολόκληρη τη γραμμή (Postgres 22007/22P02)· και ό,τι ήρθε
  από select('*') ξαναγράφεται πάνω σε στήλες που γράφει μόνο η βάση.\n`)
  process.exit(1)
}
console.log(`✓ Καμία κατάσταση φόρμας δεν απλώνεται αυτούσια σε εγγραφή, σε ${files.length} αρχεία`)
