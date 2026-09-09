#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΛΑΣΗ ΑΙΩΡΗΣΗΣ ΠΟΥ ΤΗΝ ΑΚΥΡΩΝΕΙ ΤΟ ΕΝΣΩΜΑΤΩΜΕΝΟ ΣΤΥΛ ΔΙΠΛΑ ΤΗΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ, ΜΕΤΡΗΜΕΝΟ ΣΤΟΝ ΠΕΡΙΗΓΗΤΗ. Τρία σημεία φορούσαν κλάση αιώρησης και
// ταυτόχρονα έγραφαν ενσωματωμένα την ΙΔΙΑ ιδιότητα που η κλάση αλλάζει. Το
// ενσωματωμένο `style` υπερισχύει κάθε κανόνα κλάσης, οπότε ο κανόνας δεν
// ίσχυε ποτέ. Στον πάγκο «accounting», στο κουμπί μενού ενεργειών:
//
//     ηρεμία       rgb(95, 99, 104) | rgb(189, 193, 198)
//     με αιώρηση   rgb(95, 99, 104) | rgb(189, 193, 198)
//     με εστίαση   rgb(95, 99, 104) | rgb(189, 193, 198)
//
// Καμία αλλαγή, ούτε με ποντίκι ούτε με πληκτρολόγιο — και η κλάση είχε μπει
// ΑΚΡΙΒΩΣ για να δίνει ένδειξη σε όποιον πλοηγείται με Tab.
//
// ΓΙΑΤΙ ΔΕΝ ΤΟ ΠΙΑΝΕΙ ΤΙΠΟΤΑ ΑΛΛΟ. Δεν είναι σφάλμα μεταγλώττισης, δεν είναι
// σφάλμα κανόνα ύφους και δεν φαίνεται στο στιγμιότυπο: η οθόνη σε ηρεμία
// είναι ΣΩΣΤΗ. Λείπει μόνο η αντίδραση — που δεν φωτογραφίζεται.
//
// ΑΠΑΓΟΡΕΥΣΗ, ΟΧΙ ΚΑΣΤΑΝΙΑ. Δεν υπάρχει «λίγο ακυρωμένη» κλάση: ή ισχύει ή δεν
// ισχύει. Και είναι πάντα διορθώσιμο — η ιδιότητα ηρεμίας φεύγει στην κλάση,
// και όπου διαφέρει δηλώνεται ως μεταβλητή (`--hov-fill`, `--hov-edge-rest`,
// `--hov-row-rest`, `--hov-ink-rest`).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

/** Ποια ιδιότητα ελέγχει κάθε κλάση — δηλαδή ποια ΔΕΝ επιτρέπεται ενσωματωμένη. */
const OWNS = {
  'po-hov-accent': ['border', 'borderColor', 'color'],
  'po-hov-row':    ['background', 'backgroundColor'],
  'po-hov-fill':   ['background', 'backgroundColor'],
  'po-choice':     ['background', 'backgroundColor', 'border', 'borderColor'],
  'po-btn':        ['background', 'backgroundColor', 'color'],
}

function openTag(src, at) {
  let depth = 0, quote = null
  for (let i = at; i < src.length; i++) {
    const c = src[i]
    if (quote) { if (c === quote && src[i - 1] !== '\\') quote = null; continue }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue }
    if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === '>' && depth === 0) return src.slice(at, i + 1)
  }
  return null
}

/** Το σώμα ενός χαρακτηριστικού `name={…}`, με ισοζύγιο αγκίστρων. */
function braced(tag, name) {
  const i = tag.indexOf(name + '={')
  if (i < 0) return null
  let d = 0, q = null
  for (let j = i + name.length + 1; j < tag.length; j++) {
    const c = tag[j]
    if (q) { if (c === q && tag[j - 1] !== '\\') q = null; continue }
    if (c === "'" || c === '"' || c === '`') { q = c; continue }
    if (c === '{') d++
    else if (c === '}') { d--; if (d === 0) return tag.slice(i + name.length + 1, j + 1) }
  }
  return null
}

const bad = []
for (const file of projectFiles("'app/**/*.tsx' 'app/*.tsx' 'components/**/*.tsx' 'components/*.tsx'")) {
  if (file.includes('.test.')) continue
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(/<[a-zA-Z][a-zA-Z0-9]*[\s]/g)) {
    const tag = openTag(src, m.index)
    if (!tag) continue
    const classes = Object.keys(OWNS).filter(c => new RegExp('(["\'`\\s{])' + c + '(["\'`\\s}])').test(tag))
    if (!classes.length) continue
    const style = braced(tag, 'style')
    if (!style) continue
    for (const cls of classes) {
      for (const prop of OWNS[cls]) {
        // `background` σε άλλη λέξη (backgroundImage, backgroundSize) δεν μετρά.
        const re = new RegExp('(^|[{,\\s])' + prop + "\\s*:\\s*['\"`]")
        if (re.test(style)) {
          const line = src.slice(0, m.index).split('\n').length
          bad.push({ file, line, cls, prop })
        }
      }
    }
  }
}

if (bad.length) {
  console.error(`✗ ${bad.length} σημεία όπου το ενσωματωμένο στυλ ακυρώνει την κλάση που φοράνε:\n`)
  for (const b of bad.slice(0, 20)) console.error(`   ${b.file}:${b.line}  .${b.cls} ορίζει «${b.prop}» — και το style το ξαναγράφει`)
  console.error(`
  Το ενσωματωμένο \`style\` υπερισχύει κάθε κανόνα κλάσης. Οσο η ιδιότητα
  γράφεται εκεί, η αιώρηση ΚΑΙ η εστίαση πληκτρολογίου δεν ισχύουν ποτέ — και
  η οθόνη σε ηρεμία δείχνει σωστή, οπότε κανένα στιγμιότυπο δεν το πιάνει.

  Βγάλε την ιδιότητα από το \`style\`. Την ηρεμία τη δίνει η κλάση· όπου
  διαφέρει, δήλωσέ την ως μεταβλητή: --hov-fill, --hov-edge-rest,
  --hov-row-rest, --hov-ink-rest.`)
  process.exit(1)
}
console.log('✅ Καμία κλάση αιώρησης δεν ακυρώνεται από ενσωματωμένο στυλ.')
