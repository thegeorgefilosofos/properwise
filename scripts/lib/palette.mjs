// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΑΛΕΤΑ ΤΟΥ app/globals.css, ΛΥΜΕΝΗ ΑΝΑ ΘΕΜΑ — ΜΑΖΙ ΜΕ ΤΟ color-mix()
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Ο φύλακας αντίθεσης ΔΗΛΩΝΕ ότι δεν αγγίζει το `color-mix()`,
// οπότε όλα τα παράγωγα —τα -soft, τα -dim, τα -on-container, το πέπλο
// αιώρησης πάνω σε επιφάνεια— έμεναν αμέτρητα. Ακριβώς εκεί έπεφτε το φωτεινό
// θέμα: κείμενο πάνω σε επιλογή ή αιώρηση μετρούσε 4,05–4,49:1 και κανείς δεν
// το έβλεπε. Το `color-mix(in srgb, …)` λύνεται ντετερμινιστικά (γραμμική
// παρεμβολή με προπολλαπλασιασμένο άλφα, όπως ορίζει το CSS Color 5)· δεν
// χρειάζεται μηχανή περιηγητή.
//
// Μία ανάγνωση για όποιον τη χρειάζεται: guard-contrast, guard-email-palette.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'

export const CSS_PATH = new URL('../../app/globals.css', import.meta.url).pathname

/** Κόβει τα `@media …{}` με μέτρημα αγκίστρων· επιστρέφει βάση και περιτυλίγματα. */
export function splitAtRules(text) {
  let base = '', i = 0
  const wrapped = []
  while (i < text.length) {
    const at = text.indexOf('@media', i)
    if (at < 0) { base += text.slice(i); break }
    base += text.slice(i, at)
    const open = text.indexOf('{', at)
    if (open < 0) { base += text.slice(at); break }
    let depth = 1, j = open + 1
    for (; j < text.length && depth > 0; j++) {
      if (text[j] === '{') depth++
      else if (text[j] === '}') depth--
    }
    wrapped.push({ condition: text.slice(at + 6, open).trim(), body: text.slice(open + 1, j - 1) })
    i = j
  }
  return { base, wrapped }
}

function blocks(text) {
  const out = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(text))) { const selector = m[1].trim(); if (selector) out.push({ selector, body: m[2] }) }
  return out
}

function declarations(body) {
  const out = new Map()
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g
  let m
  while ((m = re.exec(body))) out.set(m[1], m[2].trim())
  return out
}

/**
 * Τα token ανά θέμα. Η βάση (`:root`) είναι το σκοτεινό· το φωτεινό είναι η
 * εξαίρεση που γράφεται πάνω της. `seed` στρώνει ένα θέμα πάνω σε άλλο (η
 * παλέτα αυξημένης αντίθεσης πάνω στη βασική).
 */
export function palette(text, seed) {
  const base = new Map(seed?.base ?? [])
  const overrides = { light: new Map(seed?.light ?? []), dark: new Map(seed?.dark ?? []) }
  for (const b of blocks(text)) {
    const hitsRoot = /(^|,)\s*:root\s*(,|$)/.test(b.selector)
    const dark = b.selector.includes('[data-mode="dark"]')
    const light = b.selector.includes('[data-mode="light"]')
    if (!hitsRoot && !dark && !light) continue
    for (const [k, v] of declarations(b.body)) {
      if (hitsRoot) base.set(k, v)
      if (dark) overrides.dark.set(k, v)
      if (light) overrides.light.set(k, v)
    }
  }
  return {
    parts: { base, light: overrides.light, dark: overrides.dark },
    light: new Map([...base, ...overrides.light]),
    dark: new Map([...base, ...overrides.dark]),
  }
}

/** Διαβάζει το globals.css: βασικό θέμα και παλέτα αυξημένης αντίθεσης. */
export function readPalettes(path = CSS_PATH) {
  const raw = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const { base, wrapped } = splitAtRules(raw)
  const main = palette(base)
  const contrastCss = wrapped.filter(w => /prefers-contrast/.test(w.condition)).map(w => w.body).join('\n')
  return { main, contrast: contrastCss.trim() ? palette(contrastCss, main.parts) : null }
}

/** Χρώμα → [r,g,b,a] (0..255, άλφα 0..1). null για ό,τι δεν είναι χρώμα. */
export function parseColor(s) {
  s = String(s).trim().toLowerCase()
  if (s === 'transparent') return [0, 0, 0, 0]
  let m
  if ((m = s.match(/^#([0-9a-f]{3})$/))) return [...m[1]].map(c => parseInt(c + c, 16)).concat(1)
  if ((m = s.match(/^#([0-9a-f]{6})$/))) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)).concat(1)
  if ((m = s.match(/^#([0-9a-f]{8})$/))) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)).concat(parseInt(m[1].slice(6), 16) / 255)
  if ((m = s.match(/^rgba?\(([^)]+)\)$/))) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    if (p.slice(0, 3).some(Number.isNaN)) return null
    return [p[0], p[1], p[2], p[3] ?? 1]
  }
  return null
}

function splitTop(s) {
  const out = []; let d = 0, cur = ''
  for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur); cur = '' } else cur += ch }
  out.push(cur)
  return out.map(x => x.trim())
}

/** Λύνει μια τιμή (var(), color-mix(in srgb), hex, rgb[a]) σε [r,g,b,a] ή null. */
export function resolveColor(map, expr, depth = 0) {
  if (depth > 24 || expr == null) return null
  expr = String(expr).trim()
  let m
  if ((m = expr.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/))) {
    const v = map.get(m[1])
    if (v) return resolveColor(map, v, depth + 1)
    return m[2] ? resolveColor(map, m[2], depth + 1) : null
  }
  if (expr.startsWith('color-mix(') && expr.endsWith(')')) {
    const parts = splitTop(expr.slice('color-mix('.length, -1))
    if (!/^in\s+srgb$/.test(parts[0]) || parts.length !== 3) return null
    const one = p => { const mm = p.match(/^(.*?)(?:\s+([\d.]+)%)?$/); return { c: resolveColor(map, mm[1], depth + 1), p: mm[2] != null ? Number(mm[2]) : null } }
    const a = one(parts[1]), b = one(parts[2])
    if (!a.c || !b.c) return null
    let pa = a.p, pb = b.p
    if (pa == null && pb == null) { pa = 50; pb = 50 } else if (pa == null) pa = 100 - pb; else if (pb == null) pb = 100 - pa
    const sum = pa + pb; pa /= sum; pb /= sum
    const alpha = a.c[3] * pa + b.c[3] * pb
    if (alpha === 0) return [0, 0, 0, 0]
    const ch = i => (a.c[i] * a.c[3] * pa + b.c[i] * b.c[3] * pb) / alpha
    return [ch(0), ch(1), ch(2), alpha]
  }
  return parseColor(expr)
}

/** Λύνει ένα token (`--x`) του θέματος. */
export const token = (map, name) => resolveColor(map, `var(${name})`)

/** Σύνθεση ημιδιάφανου πάνω σε αδιαφανές. */
export const over = (fg, bg) => { const a = fg[3]; return [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a)).concat(1) }

const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
export const luminance = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
/** Λόγος αντίθεσης WCAG 2.1 ανάμεσα σε δύο αδιαφανή χρώματα. */
export const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
export const toHex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
export const gr = n => n.toFixed(2).replace('.', ',')
