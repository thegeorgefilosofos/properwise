#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΝΤΙΘΕΣΗ ΜΕΤΡΙΕΤΑΙ, ΔΕΝ ΔΗΛΩΝΕΤΑΙ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΡΟΒΛΗΜΑ, ΒΡΕΘΗΚΕ ΤΟΝ ΑΥΓΟΥΣΤΟ 2026. Το `--logo-mark-text` ήταν λευκό και
// στα δύο θέματα, με γραμμένη αιτιολογία δίπλα του: «στο σκοτεινό θέμα το
// πλακίδιο είναι ανοιχτό παστέλ, οπότε το σκούρο γράμμα έβγαινε θαμπό». Η
// αιτιολογία ήταν ανάποδη. Λευκό πάνω στο #8ab4f8 δίνει 2,11:1· σκούρο μελάνι
// δίνει 9,00:1. Θαμπό ήταν το λευκό και το σήμα είναι το πρώτο πράγμα που
// βλέπει κάθε καινούριος επισκέπτης — η εφαρμογή ανοίγει σκοτεινή.
//
// ΓΙΑΤΙ ΔΕΝ ΤΟ ΕΠΙΑΝΕ ΤΙΠΟΤΑ: η αντίθεση ελεγχόταν με το χέρι και το χέρι
// έγραφε το αποτέλεσμα σε σχόλιο. Ενα σχόλιο δεν ξαναϋπολογίζεται όταν αλλάξει
// το χρώμα δίπλα του και δεν αμφισβητείται από κανέναν όταν ακούγεται λογικό.
//
// ΤΟ ΔΕΥΤΕΡΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΟΚΤΩΒΡΙΟΣ 2026: Ο ΦΥΛΑΚΑΣ ΜΕΤΡΟΥΣΕ ΤΑ ΕΥΚΟΛΑ.
// Δεκαπέντε ζεύγη, όλα πάνω σε καθαρή επιφάνεια. Δεν άγγιζε το `color-mix()`,
// οπότε κανένα -soft, κανένα πέπλο αιώρησης, κανένα σήμα. Ακριβώς εκεί έπεφτε
// το φωτεινό θέμα: 3η βαθμίδα 4,08–4,44, γαλάζιο 4,05–4,49 και κόκκινο
// 4,11–4,28:1 κάτω από επιλογή ή αιώρηση, ενώ ο φύλακας τύπωνε ✅. Και το ένα
// από τα δεκαπέντε (--logo-mark-text) δεν υπήρχε πια: μετριόταν ως
// «εκτός μέτρησης» σε κάθε εκτέλεση χωρίς να το προσέχει κανείς.
//
// ΤΙ ΚΑΝΕΙ. Διαβάζει τα ΠΡΑΓΜΑΤΙΚΑ token του app/globals.css ανά θέμα, λύνει
// var() ΚΑΙ color-mix(in srgb) (scripts/lib/palette.mjs) και συνθέτει τα
// ημιδιάφανα πάνω στην επιφάνεια όπου κάθονται. Μετρά:
//   · κείμενο (τρεις βαθμίδες, γαλάζιο, τέσσερις τόνοι) σε τέσσερις επιφάνειες,
//     καθαρές και κάτω από το πέπλο αιώρησης και επιλογής — 4,5:1
//   · κάθε σήμα: μελάνι on-container και ο ίδιος ο τόνος πάνω στο -soft του — 4,5:1
//   · το μελάνι γεμίσματος πάνω σε κάθε κορεσμένο γέμισμα — 4,5:1
//   · όρια πεδίων, σειρές γραφημάτων, δαχτυλίδι εστίασης — 3:1 (WCAG 1.4.11)
//   · τη βιτρίνα (--mkt-*) και την παλέτα αυξημένης αντίθεσης
//   · ότι το χρώμα της μπάρας του περιηγητή (lib/core/themeColor.ts) είναι
//     το --bg-base κάθε θέματος.
// ΚΑΘΕ token που δεν λύνεται είναι ΣΦΑΛΜΑ, όχι παράλειψη: ένα ζεύγος που δεν
// μετριέται είναι ένα ζεύγος που κάποτε θα σπάσει σιωπηλά.
//
// Τρέξε: node scripts/guard-contrast.mjs
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { readPalettes, token, over, contrast, toHex, gr } from './lib/palette.mjs'

// ── ΤΑ ΖΕΥΓΗ ─────────────────────────────────────────────────────────────
// `on` είναι επιφάνεια, ή [πέπλο, επιφάνεια] για ημιδιάφανο πάνω σε αδιαφανές.
const SURFACES = ['--bg-base', '--bg-surface', '--bg-elevated', '--bg-overlay']
const VEILS = [null, '--bg-hover', '--accent-soft']
const TEXT = ['--text-primary', '--text-secondary', '--text-tertiary', '--accent', '--positive', '--negative', '--warning', '--info']
const TONES = ['accent', 'info', 'positive', 'warning', 'negative']
const FILLS = ['--accent', '--accent-hover', '--positive', '--negative', '--warning', '--info', '--ch-airbnb', '--ch-booking', '--ch-vrbo']

const PAIRS = []
for (const ink of TEXT) for (const s of SURFACES) for (const v of VEILS)
  PAIRS.push({ ink, on: v ? [v, s] : s, min: 4.5, why: v ? `κείμενο κάτω από ${v === '--bg-hover' ? 'αιώρηση' : 'επιλογή'}` : 'κείμενο σε επιφάνεια' })
for (const t of TONES) for (const s of ['--bg-surface', '--bg-elevated', '--bg-overlay']) {
  PAIRS.push({ ink: `--${t}-on-container`, on: [`--${t}-soft`, s], min: 4.5, why: 'μελάνι σήματος πάνω στο φόντο του' })
  PAIRS.push({ ink: `--${t}`, on: [`--${t}-soft`, s], min: 4.5, why: 'τόνος πάνω στο δικό του -soft' })
}
for (const f of FILLS) PAIRS.push({ ink: '--on-tone', on: f, min: 4.5, why: 'κείμενο σε κορεσμένο γέμισμα (κουμπί, σήμα)' })
PAIRS.push({ ink: '--text-inverse', on: '--text-primary', min: 4.5, why: 'ανεστραμμένη ετικέτα / υπόδειξη' })
// Μη κειμενικά, 3:1. Το όριο του ΠΕΔΙΟΥ είναι χειριστήριο· το όριο της κάρτας
// δεν είναι και επίτηδες δεν μετριέται εδώ.
for (const s of ['--bg-base', '--bg-surface', '--bg-elevated'])
  PAIRS.push({ ink: '--border-control', on: s, min: 3, why: 'όριο πεδίου, κουτιού, διακόπτη' })
for (const s of SURFACES) PAIRS.push({ ink: '--accent', on: s, min: 3, why: 'δαχτυλίδι εστίασης' })
// Τα γραφήματα κάθονται σε κάρτα (--bg-surface).
for (const c of ['--series-in', '--series-out', '--chart-cat-1', '--chart-cat-2', '--chart-cat-3', '--chart-cat-4', '--chart-cat-5'])
  PAIRS.push({ ink: c, on: '--bg-surface', min: 3, why: 'σειρά γραφήματος πάνω στην κάρτα' })

// Η βιτρίνα είναι πάντα σκοτεινή: μετριέται μία φορά, στη βάση.
const MKT = []
for (const ink of ['--mkt-text-primary', '--mkt-text-secondary', '--mkt-text-tertiary', '--mkt-accent', '--mkt-positive', '--mkt-negative'])
  for (const s of ['--mkt-bg-base', '--mkt-bg-surface', '--mkt-bg-elevated']) MKT.push({ ink, on: s, min: 4.5, why: 'κείμενο της βιτρίνας' })
MKT.push({ ink: '--mkt-accent-text', on: '--mkt-accent', min: 4.5, why: 'κουμπί της βιτρίνας' })

const { main, contrast: hc } = readPalettes()
const SPACES = [{ name: 'βασικό', theme: main }]
if (hc) SPACES.push({ name: 'αυξημένη αντίθεση', theme: hc })

const fails = []
const unresolved = []
let checked = 0

const surfaceOf = (map, on) => {
  if (!Array.isArray(on)) return token(map, on)
  const [veil, base] = on
  const v = token(map, veil), b = token(map, base)
  return v && b ? over(v, b) : null
}
const label = on => Array.isArray(on) ? `${on[0]} πάνω σε ${on[1]}` : on

function measure(space, mode, map, p) {
  const ink = token(map, p.ink)
  const bg = surfaceOf(map, p.on)
  if (!ink || !bg) { unresolved.push(`${space} · ${mode} · ${p.ink} πάνω σε ${label(p.on)}`); return }
  checked++
  // Ημιδιάφανο μελάνι (π.χ. όριο) κρίνεται όπως φαίνεται: συντεθειμένο.
  const inkSolid = ink[3] < 1 ? over(ink, bg) : ink
  const r = contrast(inkSolid, bg)
  if (r < p.min) fails.push({ space, mode, ...p, ink2: toHex(inkSolid), on2: toHex(bg), r })
}

for (const space of SPACES) for (const mode of ['light', 'dark']) for (const p of PAIRS) measure(space.name, mode, space.theme[mode], p)
for (const p of MKT) measure('βιτρίνα', 'dark', main.dark, p)

// ── ΟΤΙ Ο ΦΥΛΑΚΑΣ ΔΙΑΒΑΣΕ ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΑ ΘΕΜΑΤΑ ────────────────────────────
// Δεν αρκεί «βρήκα token». Αν το ένα θέμα δεν διαβαστεί, ο φύλακας μετρά δύο
// φορές το άλλο και τυπώνει ✅ χωρίς να έχει ελέγξει τίποτα. Το `--accent`
// είναι ΕΞ ΟΡΙΣΜΟΥ διαφορετικό στα δύο θέματα: αν βγει ίδιο, η ανάγνωση είναι
// χαλασμένη, όχι η παλέτα. (ΤΑ ΣΧΟΛΙΑ ΦΕΥΓΟΥΝ ΠΡΩΤΑ και τα `@media` κόβονται
// με μέτρημα αγκίστρων: δύο φορές στο παρελθόν το μπλοκ του φωτεινού χανόταν
// και ο φύλακας μετρούσε μόνο το σκοτεινό — βλ. scripts/lib/palette.mjs.)
for (const mode of ['light', 'dark']) {
  if (main[mode].size < 20) {
    console.error(`✗ Το ${mode === 'light' ? 'φωτεινό' : 'σκοτεινό'} θέμα διάβασε μόλις ${main[mode].size} token.`)
    console.error('  Ο φύλακας δεν βλέπει το μπλοκ του, άρα δεν ελέγχει τίποτα εκεί.')
    process.exit(1)
  }
}
const accentOf = m => { const c = token(main[m], '--accent'); return c && toHex(c) }
if (accentOf('light') === accentOf('dark')) {
  console.error('✗ Τα δύο θέματα δίνουν το ίδιο --accent. Ο φύλακας διαβάζει το ένα δύο φορές.')
  process.exit(1)
}

// ── Η ΜΠΑΡΑ ΤΟΥ ΠΕΡΙΗΓΗΤΗ = ΤΟ ΦΟΝΤΟ ΚΑΘΕ ΘΕΜΑΤΟΣ ───────────────────────────
// Το meta theme-color θέλει κυριολεκτικό χρώμα, άρα αντίγραφο του --bg-base.
const barSrc = readFileSync(new URL('../lib/core/themeColor.ts', import.meta.url), 'utf8')
for (const mode of ['light', 'dark']) {
  const lit = barSrc.match(new RegExp(`${mode}:\\s*'(#[0-9a-fA-F]{6})'`))?.[1]?.toLowerCase()
  const want = token(main[mode], '--bg-base')
  checked++
  if (!lit || !want || lit !== toHex(want))
    fails.push({ space: 'μπάρα περιηγητή', mode, ink: 'THEME_COLOR', on: '--bg-base', ink2: lit, on2: want && toHex(want), r: 0, min: 0,
      why: 'το lib/core/themeColor.ts πρέπει να είναι ίσο με το --bg-base του θέματος', exact: true })
}

if (unresolved.length) {
  console.error(`✗ ${unresolved.length} ζεύγη δεν μετρήθηκαν: κάποιο token δεν λύνεται σε χρώμα.\n`)
  for (const u of unresolved.slice(0, 30)) console.error('  ' + u)
  if (unresolved.length > 30) console.error(`  … και ${unresolved.length - 30} ακόμη`)
  console.error('\n  Αν το token διαγράφηκε, βγάλ\' το από τα ζεύγη ΕΔΩ· αν μετονομάστηκε, άλλαξέ το.')
  process.exit(1)
}

if (fails.length) {
  console.error(`✗ ${fails.length} ${fails.length === 1 ? 'ζεύγος' : 'ζεύγη'} κάτω από το όριό ${fails.length === 1 ? 'του' : 'τους'}:\n`)
  for (const f of fails.slice(0, 30)) {
    console.error(`  ${f.space} · ${f.mode} · ${f.why}`)
    if (f.exact) { console.error(`    ${f.ink} = ${f.ink2}, ${f.on} = ${f.on2}\n`); continue }
    console.error(`    ${f.ink} (${f.ink2}) πάνω σε ${label(f.on)} (${f.on2})`)
    console.error(`    ${gr(f.r)}:1, όριο ${gr(f.min)}:1\n`)
  }
  if (fails.length > 30) console.error(`  … και ${fails.length - 30} ακόμη\n`)
  console.error('  Το χρώμα αλλάζει στο app/globals.css. Αν το ζεύγος δεν συνυπάρχει')
  console.error('  ποτέ στην οθόνη, βγάλ\' το από τα ζεύγη εδώ, με γραμμένο τον λόγο.')
  process.exit(1)
}

console.log(`✅ Αντίθεση: ${checked} ζεύγη σε ${SPACES.length * 2} θέματα και στη βιτρίνα περνούν τα όριά τους (μαζί με πέπλα, -soft και color-mix).`)
