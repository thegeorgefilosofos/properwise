#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ MONO ΔΕΝ ΓΡΑΦΕΙ ΠΟΣΑ, ΗΜΕΡΟΜΗΝΙΕΣ, ΠΛΗΘΗ Η ΑΦΜ: ΤΟ ΜΗΔΕΝ ΤΟΥ ΔΙΑΒΑΖΕΤΑΙ «θ»
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ. Το μηδέν του Roboto Mono έχει κάθετη γραμμή μέσα του·
// δίπλα σε ελληνικά γράμματα διαβάζεται θήτα: «28/1θ/2θ26», «1θ αρχεία»,
// «1.2θθ,θθ€». Ο κανόνας γράφτηκε στο `components/tokens.ts` (02.11.2026:
// «ΤΟ MONO ΔΕΝ ΕΙΝΑΙ ΓΙΑ ΑΡΙΘΜΟΥΣ») και την ίδια μέρα μετρήθηκαν ακόμη
// πέντε παραβάσεις σε τέσσερα αρχεία που τον αγνοούσαν: το ποσό οφειλής και
// κάθε γραμμή του στην πύλη του ενοικιαστή (το πρώτο πράγμα που βλέπει όποιος
// ανοίγει τον σύνδεσμο), τα έσοδα και οι δαπάνες κάθε πελάτη στον χώρο του
// λογιστή, ο μετρητής στα φίλτρα των Επαφών και ο αριθμός βήματος του οδηγού
// εκκίνησης. Ο υπάρχων `guard-number-font` δεν τα έπιανε: ρωτά «είναι
// πρόταση;», όχι «είναι αριθμός;» και επιτρέπει ρητά το mono σε κελί πίνακα.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ, ΑΚΡΙΒΩΣ. Σε κάθε .tsx των app/, components/, lib/:
//   1. Κάθε σημάδι mono: `T.font.mono`, `TT.mono`, ή όνομα σταθεράς στυλ που
//      ορίστηκε στο ίδιο αρχείο με ένα από τα δύο μέσα της.
//   2. Αν το σημάδι κάθεται μέσα σε ετικέτα ανοίγματος JSX, εξετάζεται το
//      στοιχείο ολόκληρο: το περιεχόμενο ως το ταιριαστό κλείσιμο, ή τα
//      χαρακτηριστικά του αν κλείνει μόνο του (`<input value={fe(x)} />`).
//   3. Παράβαση είναι κλήση μορφοποιητή αριθμού εκεί μέσα: fe, feSigned,
//      feWhole, feAuto, feRate, fn, fp, fpRate, fd, grDate, toLocaleString,
//      toFixed — ΚΑΙ κάθε τοπικό ψευδώνυμο ενός από αυτούς (η πύλη έγραφε
//      `const eur = (n) => … feAuto(n)` και το mono περνούσε από εκεί).
//   Ενα εσωτερικό στοιχείο που ξαναγυρίζει ρητά σε `T.font.sans`/`T.font.num`
//   βγαίνει από τον έλεγχο: δεν φοριέται mono εκεί.
//
// ΕΞΑΙΡΕΣΕΙΣ: μόνο γνήσιοι κωδικοί που διαβάζονται χαρακτήρα χαρακτήρα (IBAN,
// μυστικό TOTP, σειριακός αριθμός, URL, κωδικός σύστασης), με λόγο ο καθένας.
// Σήμερα καμία δεν χρειάζεται: κανένας κωδικός δεν περνά από μορφοποιητή.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

/** αρχείο → { περιεχόμενο που ταιριάζει: λόγος }. Μόνο κωδικοί, ποτέ ποσά. */
const ALLOW = {}

const BASE_HELPERS = ['fe', 'feSigned', 'feWhole', 'feAuto', 'feRate', 'fn', 'fp', 'fpRate', 'fd', 'grDate']
const NUMERIC_METHODS = /\.(toLocaleString|toFixed)\(/
const MARK = /T\.font\.mono\b|\bTT\.mono\b/
const RESET = /fontFamily\s*:\s*T\.font\.(sans|num)\b/

/**
 * Σβήνει σχόλια διατηρώντας τις θέσεις (και τις αλλαγές γραμμής). Το «/*»
 * μετρά ως σχόλιο μόνο μετά από κενό ή αρχή έκφρασης: μέσα σε συμβολοσειρά
 * όπως `accept="image/*"` άνοιγε ψεύτικο σχόλιο και έσβηνε μισό αρχείο.
 */
function stripComments(src) {
  const blank = (m) => m.replace(/[^\n]/g, ' ')
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
    .replace(/(^|[\s{(,;])\/\*[\s\S]*?\*\//g, (m, p) => p + blank(m.slice(p.length)))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length))
}

/** Από το `<` μιας ετικέτας ανοίγματος, η θέση του `>` που την κλείνει. */
function tagEnd(src, lt) {
  let depth = 0, q = null
  for (let i = lt + 1; i < src.length; i++) {
    const c = src[i]
    if (q) { if (c === '\\') { i++; continue } if (c === q) q = null; continue }
    if (c === '"' || c === "'" || c === '`') { q = c; continue }
    if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === '>' && depth === 0) return { end: i, self: src[i - 1] === '/' }
  }
  return null
}

/** Η ετικέτα ανοίγματος JSX που περιέχει τη θέση `pos`, αν υπάρχει. */
function enclosingTag(src, pos) {
  for (let lt = src.lastIndexOf('<', pos); lt >= 0 && pos - lt < 4000; lt = src.lastIndexOf('<', lt - 1)) {
    const m = /^<([A-Za-z][\w.]*)/.exec(src.slice(lt, lt + 64))
    if (!m) continue
    const t = tagEnd(src, lt)
    if (t && t.end > pos) return { lt, name: m[1], ...t }
    if (t && t.end < pos) return null
  }
  return null
}

/** Το περιεχόμενο ως το ταιριαστό `</name>`, με μέτρημα φωλιάσματος. */
function body(src, name, from) {
  const re = new RegExp(`<${name.replace('.', '\\.')}\\b|</${name.replace('.', '\\.')}\\s*>`, 'g')
  re.lastIndex = from
  let depth = 1, m
  while ((m = re.exec(src))) {
    if (m[0].startsWith('</')) { if (--depth === 0) return src.slice(from, m.index) }
    else { const t = tagEnd(src, m.index); if (!t?.self) depth++ }
  }
  return src.slice(from, from + 400)
}

/** Βγάζει από το περιεχόμενο κάθε υποστοιχείο που ξαναγυρίζει σε sans/num. */
function dropResets(text) {
  let out = text
  for (let guard = 0; guard < 50; guard++) {
    const r = RESET.exec(out)
    if (!r) break
    const tag = enclosingTag(out, r.index)
    if (!tag) { out = out.slice(0, r.index) + ' '.repeat(r[0].length) + out.slice(r.index + r[0].length); continue }
    const inner = tag.self ? '' : body(out, tag.name, tag.end + 1)
    const stop = tag.self ? tag.end + 1 : tag.end + 1 + inner.length
    out = out.slice(0, tag.lt) + ' '.repeat(stop - tag.lt) + out.slice(stop)
  }
  return out
}

const files = projectFiles("'app/**/*.tsx' 'components/**/*.tsx' 'lib/**/*.tsx'").filter(f => !f.includes('.test.'))
const provlimata = []

for (const arxeio of files) {
  const raw = readFileSync(arxeio, 'utf8')
  if (!/T\.font\.mono|TT\.mono/.test(raw)) continue
  const src = stripComments(raw)

  // Τοπικά ψευδώνυμα μορφοποιητών: `const eur = (n) => … feAuto(n)`.
  const helpers = new Set(BASE_HELPERS)
  for (const m of src.matchAll(/(?:const|let|function)\s+(\w+)\s*(?::[^=\n]+)?=?\s*(?:\([^)]*\)|\w+)\s*(?::[^=\n]+)?=>([^\n;]*)/g)) {
    if (new RegExp(`\\b(${[...helpers].join('|')})\\(`).test(m[2])) helpers.add(m[1])
  }
  const CALL = new RegExp(`(?<![\\w.])(${[...helpers].join('|')})\\(`)

  // Σταθερές στυλ που κουβαλούν mono: `const code = { … fontFamily: T.font.mono … }`.
  const marks = []
  for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*(?::[^=\n]+)?=\s*\{/g)) {
    const open = m.index + m[0].length - 1
    let d = 0, i = open
    for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) break }
    if (MARK.test(src.slice(open, i))) marks.push(new RegExp(`\\b${m[1]}\\b`, 'g'))
  }
  marks.push(new RegExp(MARK.source, 'g'))

  const seen = new Set()
  for (const re of marks) {
    for (const m of src.matchAll(re)) {
      const tag = enclosingTag(src, m.index)
      if (!tag || seen.has(tag.lt)) continue
      seen.add(tag.lt)
      const attrs = src.slice(tag.lt, tag.end + 1)
      const inside = tag.self ? attrs.replace(/style=\{\{[\s\S]*?\}\}/, '') : dropResets(body(src, tag.name, tag.end + 1))
      const hit = CALL.exec(inside) || NUMERIC_METHODS.exec(inside)
      if (!hit) continue
      const grammi = src.slice(0, tag.lt).split('\n').length
      const ti = raw.split('\n')[grammi - 1].trim().slice(0, 90)
      const allowed = Object.entries(ALLOW[arxeio] || {}).some(([key]) => ti.includes(key))
      if (!allowed) provlimata.push({ arxeio, grammi, ti, call: hit[0] })
    }
  }
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} αριθμοί σε Roboto Mono, όπου το «0» διαβάζεται «θ»:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  ${p.call}…  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error(`
  ΤΙ ΝΑ ΚΑΝΕΙΣ: γράψε το στοιχείο με \`T.font.num\` και
  \`fontVariantNumeric: 'tabular-nums'\` (ή \`TT.figure\`). Η στοίχιση μένει: το
  tabular δίνει ίσο πλάτος στα ψηφία. Το mono μένει ΜΟΝΟ για κωδικούς που
  διαβάζονται χαρακτήρα χαρακτήρα· αν αυτό είναι τέτοιος, πρόσθεσέ τον στο
  ALLOW του scripts/guard-mono-zero.mjs με τον λόγο.\n`)
  process.exit(1)
}
console.log(`✓ κανένας αριθμός σε Roboto Mono, σε ${files.length} αρχεία`)
