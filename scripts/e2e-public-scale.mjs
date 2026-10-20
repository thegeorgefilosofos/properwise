#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Η ΒΙΤΡΙΝΑ ΜΕΤΡΙΕΤΑΙ ΜΕ ΤΟ ΙΔΙΟ ΜΑΤΙ ΜΕ ΤΗΝ ΕΦΑΡΜΟΓΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΚΕΝΟ. Ο `e2e-design-scale` μετρά πόσα διαφορετικά μεγέθη και βάρη βλέπει
// το μάτι, αλλά μόνο μέσα στην εφαρμογή (`.app-content` του πάγκου). Η αρχική,
// τα πακέτα, η σύνδεση και οι υπολογιστές, δηλαδή ό,τι βλέπει πρώτο όποιος δεν
// μας ξέρει, δεν μετριόνταν από κανέναν. Ο έλεγχος της 19/10/2026 βρήκε στην
// αρχική 24 μεγέθη (ανάμεσά τους 12,5 · 13,5 · 14,5 · 15,5 · 17,5) και 9 βάρη
// (450, 650, 680, 720, 800), ενώ ο πίνακας ελέγχου αποδίδεται με 12 και 4.
//
// ΤΙ ΜΕΤΡΑ. Τις ίδιες δύο ποσότητες με τον αδελφό του, με τον ίδιο κανόνα: για
// κάθε ορατό στοιχείο με δικό του κείμενο, το υπολογισμένο μέγεθος και βάρος.
// Ενωση σε όλες τις διαδρομές της βιτρίνας, στα 390 και στα 1280. Οι ρευστές
// τιμές του `clamp()` (17,4109px) ΕΙΝΑΙ το σύστημα και αγνοούνται· κρατιούνται
// οι ακέραιες και οι μισές, δηλαδή οι γραμμένες με το χέρι.
//
// ΚΕΝΑ ΚΑΙ ΑΚΤΙΝΕΣ ΔΕΝ ΜΕΤΡΙΟΥΝΤΑΙ ΕΔΩ, επίτηδες: η βιτρίνα δεν έχει περάσει
// ακόμη από το πέρασμα αποστάσεων της εφαρμογής· μια καστάνια που ξεκινά
// με νούμερο που κανείς δεν έχει κοιτάξει δεν φυλάει απόφαση.
//
// ΚΑΣΤΑΝΙΑ. Μόνο προς τα κάτω: scripts/public-scale-baseline.json.
//
// ΤΡΕΧΕΙ ΜΕ ΖΩΝΤΑΝΟ SERVER (E2E_BASE), μαζί με το `npm run e2e:landing`.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { chromePath } from './lib/chrome.mjs'
import { applyMode } from './lib/bench-mode.mjs'
import { SEED_CONSENT } from './lib/consent.mjs'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core')

const BASE = process.env.E2E_BASE || 'http://localhost:3100'
const ROUTES = [
  '/', '/paketa', '/login', '/signup', '/trust', '/logistes', '/odigos', '/terms', '/privacy',
  '/ypologismos-enfia', '/ypologismos-forou-enoikion', '/ypologismos-stegastikou-daneiou',
  '/kathari-apodosi', '/vraxyxronia-i-makroxronia', '/sygkrisi-timologion-revmatos',
]

const PROBE = () => {
  const out = []
  for (const el of document.querySelectorAll('body *')) {
    if (!el.checkVisibility?.()) continue
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue
    const cs = getComputedStyle(el)
    out.push([cs.fontSize, cs.fontWeight, el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : '')])
  }
  return out
}
const handWritten = (v) => /^\d+(\.5)?px$/.test(v)

const browser = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] })
const seen = { size: new Map(), weight: new Map() }
for (const width of [390, 1280]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 1100, hasTouch: width < 1100, locale: 'el-GR' })
  await ctx.addInitScript(SEED_CONSENT)
  await applyMode(ctx)
  const page = await ctx.newPage()
  for (const route of ROUTES) {
    const res = await page.goto(BASE + route, { waitUntil: 'networkidle' })
    if (!res || !res.ok()) { console.error(`✗ ${route}: ${res?.status() ?? 'χωρίς απάντηση'}`); process.exit(1) }
    await page.evaluate(() => document.fonts.ready)
    for (const [size, weight, where] of await page.evaluate(PROBE)) {
      if (handWritten(size) && !seen.size.has(size)) seen.size.set(size, `${route} ${width} ${where}`)
      if (!seen.weight.has(weight)) seen.weight.set(weight, `${route} ${width} ${where}`)
    }
  }
  await ctx.close()
}
await browser.close()

const BASELINE = JSON.parse(readFileSync(new URL('./public-scale-baseline.json', import.meta.url), 'utf8'))
const now = { size: seen.size.size, weight: seen.weight.size }
const LABEL = { size: 'μεγέθη γραμματοσειράς', weight: 'βάρη' }
const sorted = (m) => [...m.keys()].sort((a, b) => parseFloat(a) - parseFloat(b)).join(' · ')

console.log(`Κλίμακα της βιτρίνας, σε ${ROUTES.length} διαδρομές στα 390 και στα 1280:`)
for (const k of Object.keys(now)) console.log(`  ${String(now[k]).padStart(3)}/${String(BASELINE[k]).padEnd(3)} ${LABEL[k].padEnd(22)} ${sorted(seen[k])}`)

const over = Object.keys(now).filter(k => now[k] > BASELINE[k])
if (over.length) {
  console.error(`\n✗ ${over.map(k => `${LABEL[k]}: ${now[k]} > ${BASELINE[k]}`).join(' · ')}`)
  for (const k of over) for (const [v, where] of seen[k]) console.error(`    ${v.padEnd(8)} πρώτη φορά: ${where}`)
  console.error(`
  Μπήκε νέα τιμή στη βιτρίνα. Ενα 13,5px δίπλα σε 13 και 14 ή ένα 680 δίπλα
  σε 700 είναι ατύχημα: χρησιμοποίησε την υπάρχουσα τιμή (T.weight, TT).`)
  process.exit(1)
}
const under = Object.keys(now).filter(k => now[k] < BASELINE[k])
// Η ΠΤΩΣΗ ΤΥΠΩΝΕΤΑΙ, ΔΕΝ ΚΟΚΚΙΝΙΖΕΙ, όπως στον e2e-design-scale: η αρχική
// έχει περιεχόμενο που εξαρτάται από την ημερομηνία (ανακοίνωση τιμών, εποχή
// δηλώσεων)· ένα μέγεθος που φεύγει για μία εβδομάδα δεν είναι βελτίωση.
if (under.length) console.log(`\n   ↓ ${under.map(k => `${LABEL[k]} ${BASELINE[k]}→${now[k]}`).join(' · ')}. Κατέβασε το όριο στο scripts/public-scale-baseline.json, με σημείωση.`)
console.log('\n✅ Η κλίμακα της βιτρίνας δεν μεγάλωσε.')
