// ═══════════════════════════════════════════════════════════════════════════
// ΣΥΝΔΕΣΜΟΙ: ΤΙ ΔΙΑΒΑΖΕΤΑΙ ΑΠΟ ΤΟΝ ΧΑΡΤΗ ΚΑΙ ΑΠΟ ΤΗ ΣΕΛΙΔΑ, ΧΩΡΙΣ ΔΙΚΤΥΟ
// ─────────────────────────────────────────────────────────────────────────
// Ο,τι εδώ είναι καθαρή συνάρτηση πάνω σε κείμενο, ώστε να δοκιμάζεται με
// σταθερά δείγματα (scripts/check-links.test.ts) και όχι με ζωντανό site. Το
// δίκτυο, οι επαναλήψεις και η αναφορά ζουν στο scripts/check-links.mjs.
// ═══════════════════════════════════════════════════════════════════════════

/** Οι διευθύνσεις του `<loc>` ενός sitemap.xml, όπως είναι γραμμένες. */
export function sitemapLocs(xml) {
  return [...String(xml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => decode(m[1]))
}

// Το &amp; τελευταίο: αλλιώς το «&amp;lt;» θα γινόταν «<» αντί για «&lt;».
const decode = (s) => s
  .replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

/**
 * Τα `href` των `<a>` μιας σελίδας HTML. Μόνο σύνδεσμοι που πατά ο
 * επισκέπτης: όχι `<link>` (γραμματοσειρές, preload), όχι `<script>`.
 * Το κείμενο μέσα σε `<script>` και `<template>` αφαιρείται πρώτα: τα
 * δεδομένα του React (RSC payload) γράφουν ολόκληρο το δέντρο ως κείμενο και
 * θα έδιναν κάθε σύνδεσμο δύο φορές ή συνδέσμους που δεν αποδόθηκαν ποτέ.
 */
export function anchorHrefs(html) {
  // Οχι κανονική έκφραση πάνω σε HTML: σάρωση με indexOf, από το άνοιγμα ως το
  // πρώτο «>» μετά το κλείσιμο. Ετικέτα χωρίς κλείσιμο κόβει ως το τέλος.
  const visible = cutBlocks(cutBlocks(cutBlocks(String(html), '<script', '</script'),
    '<template', '</template'), '<!--', '-->')
  const out = []
  for (const m of visible.matchAll(/<a\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    out.push(decode((m[1] ?? m[2] ?? m[3] ?? '').trim()))
  }
  return out
}

/**
 * Κατατάσσει έναν σύνδεσμο σε σχέση με τη σελίδα όπου βρέθηκε.
 *
 * @param {string} href όπως γράφεται στο HTML
 * @param {string} pageUrl η απόλυτη διεύθυνση της σελίδας
 * @param {string[]} siteHosts τα host που μετρούν ως «δικό μας» (π.χ. το
 *        δημόσιο domain μαζί με το www, ή το localhost της τοπικής δοκιμής)
 * @returns {{kind:'internal'|'external'|'skip', url?:string}}
 */
export function classify(href, pageUrl, siteHosts) {
  if (!href || href.startsWith('#')) return { kind: 'skip' }
  if (/^(mailto|tel|sms|javascript|data|blob|viber|whatsapp|fb-messenger):/i.test(href)) return { kind: 'skip' }
  let u
  try { u = new URL(href, pageUrl) } catch { return { kind: 'skip' } }
  if (!/^https?:$/.test(u.protocol)) return { kind: 'skip' }
  u.hash = ''
  if (siteHosts.includes(u.hostname)) return { kind: 'internal', url: u.href }
  return { kind: 'external', url: u.href }
}

/**
 * Οι επίσημες πηγές που αναφέρουν οι σελίδες: εφορία, κυβέρνηση, κεντρικές
 * τράπεζες, στατιστική, ΦΕΚ. Τα κρατικά site πέφτουν, αργούν και κόβουν
 * ρομπότ συχνότερα από κάθε άλλο, οπότε μια αποτυχία τους είναι
 * ΠΡΟΕΙΔΟΠΟΙΗΣΗ και ποτέ αποτυχία. Ξεχωρίζουν στην αναφορά γιατί αυτούς τους
 * συνδέσμους τους διαβάζει ο επισκέπτης ως απόδειξη ότι το νούμερο είναι σωστό.
 */
export const OFFICIAL = /(^|\.)(aade\.gr|gov\.gr|bankofgreece\.gr|europa\.eu|ecb\.int|statistics\.gr|et\.gr|kodiko\.gr|minfin\.gov\.gr|efka\.gov\.gr|raaey\.gr|rae\.gr|hcmc\.gr|ktimatologio\.gr|ypen\.gov\.gr|eurostat\.ec\.europa\.eu)$/i

/** Ετυμηγορία για εσωτερικό σύνδεσμο, από την αλυσίδα απαντήσεων του. */
export function internalVerdict(chain) {
  const last = chain[chain.length - 1]
  if (!last) return { ok: false, why: 'καμία απάντηση' }
  if (last.error) return { ok: false, why: `δίκτυο: ${last.error}` }
  if (last.status === 200) return { ok: true, why: chain.length > 1 ? `ανακατεύθυνση → ${last.url}` : '' }
  if (last.status >= 300 && last.status < 400) return { ok: false, why: `πάνω από ${chain.length - 1} ανακατευθύνσεις` }
  return { ok: false, why: `κωδικός ${last.status}${chain.length > 1 ? ` μετά από ανακατεύθυνση από ${chain[0].url}` : ''}` }
}

/** Αφαιρεί κάθε μπλοκ από `open` ως το κλείσιμό του, χωρίς διάκριση πεζών. */
function cutBlocks(text, open, close) {
  let out = ''
  let pos = 0
  const lower = text.toLowerCase()
  for (;;) {
    const i = lower.indexOf(open, pos)
    if (i < 0) return out + text.slice(pos)
    out += text.slice(pos, i)
    const j = lower.indexOf(close, i + open.length)
    if (j < 0) return out
    const k = close === '-->' ? j + close.length - 1 : lower.indexOf('>', j)
    if (k < 0) return out
    pos = k + 1
  }
}
