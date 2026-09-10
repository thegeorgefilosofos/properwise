import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core')
import { chromePath } from './scripts/lib/chrome.mjs'
import { benchUrl } from './scripts/lib/paths.mjs'
import { SCENES } from './scripts/lib/scenes.mjs'
const b = await chromium.launch({ executablePath: chromePath() })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const all = new Map()
for (const sc of SCENES) {
  const p = await ctx.newPage()
  await p.goto(benchUrl(sc), { waitUntil: 'networkidle' })
  await p.waitForTimeout(400)
  const r = await p.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('button, [role="button"], a[href]')) {
      const b = el.getBoundingClientRect()
      if (b.width <= 0 || b.height <= 0) continue
      if (el.closest('[aria-hidden="true"]')) continue
      if (b.height >= 44) continue
      const cs = getComputedStyle(el)
      const t = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g,' ').trim().slice(0, 28)
      out.push(`${Math.round(b.height)}px  h=${cs.height} minH=${cs.minHeight}  «${t || el.className || el.tagName}»`)
    }
    return out
  })
  for (const x of r) all.set(x, (all.get(x) || 0) + 1)
  await p.close()
}
const rows = [...all].sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
console.log('ΚΟΥΜΠΙΑ ΚΑΤΩ ΑΠΟ 44px ΣΕ ΑΦΗ (390×844):', rows.length, 'διακριτά')
console.log(rows.slice(0, 30).map(([k, n]) => `  ×${n}  ${k}`).join('\n'))
await b.close()
