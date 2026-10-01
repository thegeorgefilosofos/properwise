#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ EMAIL ΜΙΛΑ ΜΕ ΤΑ ΧΡΩΜΑΤΑ ΤΗΣ ΕΦΑΡΜΟΓΗΣ ΚΑΙ ΜΟΝΟ ΜΕΣΑ ΑΠΟ ΜΙΑ ΠΑΛΕΤΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ (Οκτώβριος 2026). Οκτώ συναρτήσεις αποστολής και
// το lib/email έγραφαν δικά τους χρώματα, σχεδόν όλα του Google Material:
// γαλάζιο #1a73e8, κόκκινο #d93025, πράσινο #188038, χρυσό #b8860b, γκρι
// #80868b / #8a9099 / #5f6368 και ουράνιο τόξο έξι αποχρώσεων στις
// κατηγορίες του ημερολογίου. Πέντε ζεύγη έκοβαν το 4,5:1: «Μερική» 3,25,
// «Χωρίς μίσθωμα» 3,68, δευτερεύον κείμενο 11px 3,2, κόκκινο και πράσινο στο
// σκούρο θέμα 3,72 / 3,54, λευκό στο σκούρο κουμπί 3,87.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ, ΑΚΡΙΒΩΣ.
//   1. Κανένα κυριολεκτικό χρώμα (hex, rgb, rgba) σε supabase/functions/**
//      ή lib/email/** έξω από το supabase/functions/_shared/emailPalette.ts.
//      Οι σουίτες εξαιρούνται: ένας έλεγχος χρώματος πρέπει να το γράφει.
//   2. Οι τιμές της παλέτας είναι ΙΔΙΕΣ με τα token του app/globals.css
//      (κείμενο, γαλάζιο, όρια, μελάνι γεμίσματος, -on-container), λυμένα ανά
//      θέμα, μαζί με τα color-mix(). Αν αλλάξει η εφαρμογή, το email ακολουθεί
//      ή ο φύλακας κοκκινίζει.
//   3. Κάθε μελάνι της παλέτας περνά 4,5:1 πάνω στο χαρτί του θέματός του και
//      το μελάνι του κουμπιού πάνω στο κουμπί.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'
import { readPalettes, token, parseColor, contrast, toHex, gr, over } from './lib/palette.mjs'

const PALETTE = 'supabase/functions/_shared/emailPalette.ts'
const provlimata = []

// ── 1. Κανένα χρώμα έξω από την παλέτα ────────────────────────────────────
const COLOR = /(?<![&\w])#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d/g
const files = projectFiles("'supabase/functions/**/*.ts' 'supabase/functions/**/*.mjs' 'lib/email/**/*.ts'")
  .filter(f => f !== PALETTE && !/\.test\.(ts|mjs)$/.test(f))
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const t = line.trim()
    if (/^(\/\/|\*|\/\*)/.test(t)) return
    const code = line.replace(/\/\/.*$/, '')
    for (const m of code.matchAll(COLOR)) provlimata.push(`${f}:${i + 1}  «${m[0]}» — χρώμα γραμμένο έξω από το ${PALETTE}`)
  })
}

// ── 2 & 3. Η παλέτα: ίδια με την εφαρμογή και αναγνώσιμη ─────────────────
const src = readFileSync(PALETTE, 'utf8')
const object = name => {
  const m = src.match(new RegExp(`export const ${name}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*as const`))
  if (!m) { provlimata.push(`${PALETTE}: δεν βρέθηκε το ${name}`); return {} }
  return Object.fromEntries([...m[1].matchAll(/(\w+):\s*'([^']+)'/g)].map(x => [x[1], x[2]]))
}
const L = object('EMAIL_LIGHT'), D = object('EMAIL_DARK')
const brandInk = src.match(/export const EMAIL_BRAND_INK\s*=\s*'([^']+)'/)?.[1]

const { main } = readPalettes()
// Ποιο token αντιγράφει κάθε θέση της παλέτας, ανά θέμα.
const MIRROR = {
  light: { page: '--bg-surface', canvas: '--bg-base', ink: '--text-primary', text: '--text-secondary', mute: '--text-tertiary',
    rule: '--border-subtle', accent: '--accent', onAccent: '--on-tone',
    positive: '--positive-on-container', warning: '--warning-on-container', negative: '--negative-on-container' },
  dark: { page: '--bg-base', ink: '--text-primary', text: '--text-secondary', mute: '--text-tertiary',
    rule: '--border-subtle', accent: '--accent', onAccent: '--on-tone',
    positive: '--positive-on-container', warning: '--warning-on-container', negative: '--negative-on-container' },
}
for (const [mode, pal] of [['light', L], ['dark', D]]) {
  for (const [key, tok] of Object.entries(MIRROR[mode])) {
    const want = token(main[mode], tok)
    if (!want) { provlimata.push(`app/globals.css: το ${tok} (${mode}) δεν λύνεται`); continue }
    if (!pal[key]) { provlimata.push(`${PALETTE}: λείπει το ${mode}.${key} (αντίγραφο του ${tok})`); continue }
    if (pal[key].toLowerCase() !== toHex(want)) provlimata.push(`${PALETTE}: ${mode}.${key} = ${pal[key]}, η εφαρμογή λέει ${tok} = ${toHex(want)}`)
  }
}
const ink = token(main.dark, '--brand-ink')
if (!brandInk || !ink || brandInk.toLowerCase() !== toHex(ink)) provlimata.push(`${PALETTE}: EMAIL_BRAND_INK = ${brandInk}, η εφαρμογή λέει --brand-ink = ${ink && toHex(ink)}`)

let metrimena = 0
const need = (mode, fgKey, bgKey, pal, min = 4.5) => {
  const fg = parseColor(pal[fgKey]), bg = parseColor(pal[bgKey])
  if (!fg || !bg) return
  metrimena++
  const r = contrast(fg, bg)
  if (r < min) provlimata.push(`${PALETTE}: ${mode}.${fgKey} πάνω σε ${mode}.${bgKey}: ${gr(r)}:1, όριο ${gr(min)}:1`)
}
for (const [mode, pal] of [['light', L], ['dark', D]]) {
  for (const k of ['ink', 'text', 'mute', 'accent', 'positive', 'warning', 'negative']) need(mode, k, 'page', pal)
  if (mode === 'light') for (const k of ['ink', 'text', 'mute', 'accent']) need(mode, k, 'canvas', pal)
  need(mode, 'onAccent', 'accent', pal)
  // Το κείμενο μέσα στα κουτιά: τόνος πάνω στο γέμισμα του κουτιού.
  for (const [fill, inks] of [['accentFill', ['ink', 'text', 'accent']], ['negativeFill', ['ink', 'text', 'negative']]]) {
    const f = parseColor(pal[fill]), page = parseColor(pal.page)
    if (!f || !page) continue
    const box = over(f, page)
    for (const k of inks) {
      metrimena++
      const r = contrast(parseColor(pal[k]), box)
      if (r < 4.5) provlimata.push(`${PALETTE}: ${mode}.${k} μέσα σε ${mode}.${fill}: ${gr(r)}:1, όριο 4,5:1`)
    }
  }
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} ${provlimata.length === 1 ? 'πρόβλημα' : 'προβλήματα'} στην παλέτα του email:\n`)
  for (const p of provlimata.slice(0, 30)) console.error('  ' + p)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error(`
  ΤΙ ΝΑ ΚΑΝΕΙΣ: γράψε το χρώμα ως όνομα της παλέτας (EMAIL_LIGHT.ink,
  EMAIL_TONE.negative, κλάση .neg για το σκοτεινό θέμα). Αν άλλαξε ένα token
  της εφαρμογής, ενημέρωσε την αντίστοιχη τιμή στο ${PALETTE}.
`)
  process.exit(1)
}
console.log(`✓ Παλέτα email: ${files.length} αρχεία χωρίς δικό τους χρώμα, αντίγραφο των token της εφαρμογής, ${metrimena} ζεύγη ≥ 4,5:1`)
