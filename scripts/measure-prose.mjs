// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΜΕΤΡΟ ΤΗΣ ΓΡΑΜΜΗΣ, ΜΕΤΡΗΜΕΝΟ ΑΝΤΙ ΓΙΑ ΕΙΚΑΣΜΕΝΟ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΞΕΧΩΡΙΣΤΑ ΑΠΟ ΤΟΝ ΣΑΡΩΤΗ ΔΙΑΤΑΞΗΣ. Ο σαρωτής κρίνει ΕΛΑΤΤΩΜΑ:
// πάνω από 95 χαρακτήρες ανά γραμμή ΚΑΙ ύψος γραμμής κάτω από 1,6. Είναι το
// κατώφλι όπου η ανάγνωση σπάει, όχι το σημείο όπου είναι καλή. Μια γραμμή 90
// χαρακτήρων με άνετο ύψος περνά τον σαρωτή και εξακολουθεί να είναι μακριά:
// η τυπογραφία δίνει σαράντα πέντε ώς εβδομήντα πέντε.
//
// Αυτός εδώ δεν κρίνει, ΑΠΑΡΙΘΜΕΙ: πού διαβάζει ο χρήστης γραμμές πάνω από το
// μέτρο, σε ποιο πλάτος και με ποια λέξη αρχίζουν. Είναι εργαλείο δουλειάς για
// να μπει η `.po-prose` εκεί που χρειάζεται, όχι φύλακας του CI.
//
//   node scripts/measure-prose.mjs                 όλες οι σκηνές του πάγκου
//   node scripts/measure-prose.mjs --min 80        άλλο κατώφλι αναφοράς
//   node scripts/measure-prose.mjs --scenes loan   συγκεκριμένες σκηνές
//   node scripts/measure-prose.mjs --pages         και οι δημόσιες σελίδες
// ═══════════════════════════════════════════════════════════════════════════
import { chromePath } from './lib/chrome.mjs';
import { chromium } from 'playwright-core';
import { SCENES } from './lib/scenes.mjs';
import { benchUrl } from './lib/paths.mjs';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const MIN = Number(arg('--min', 80));
const ONLY = arg('--scenes', null)?.split(',');
const WIDTHS = arg('--widths', '1440,1280,1024').split(',').map(Number);
const BASE = process.env.MEASURE_BASE || 'http://localhost:3000';
const PAGES = process.argv.includes('--pages')
  ? ['/', '/signup', '/trust', '/privacy', '/terms', '/ypologismos-enfia', '/kathari-apodosi',
     '/ypologismos-forou-enoikion', '/vraxyxronia-i-makroxronia']
  : [];

// Το ίδιο μέτρημα με του σαρωτή διάταξης: κουτιά του Range, όχι ύψη — σε κείμενο
// με στήλες τα `top` είναι μισά και το αποτέλεσμα βγαίνει διπλάσιο.
const PROBE = (min) => {
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length) continue;
    if (el.closest('[aria-live], .sr-only, [class*="skip"], .po-prose')) continue;
    const t = (el.textContent || '').trim();
    if (t.length < min * 2) continue;
    if (!el.checkVisibility?.()) continue;
    const cs = getComputedStyle(el);
    if (cs.clipPath && cs.clipPath !== 'none') continue;
    const r = document.createRange();
    r.selectNodeContents(el);
    const rects = [...r.getClientRects()].filter(x => x.width > 1 && x.height > 1);
    if (rects.length < 2) continue;
    const per = Math.round(t.length / rects.length);
    if (per <= min) continue;
    const fs = parseFloat(cs.fontSize) || 16;
    const lh = cs.lineHeight === 'normal' ? fs * 1.2 : parseFloat(cs.lineHeight);
    const key = t.slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ per, fs: Math.round(fs), lh: +(lh / fs).toFixed(2), t: key });
  }
  return out.sort((a, b) => b.per - a.per);
};

const browser = await chromium.launch({ executablePath: chromePath() });
let total = 0;
for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
  const targets = [
    ...(ONLY ? SCENES.filter(s => ONLY.includes(s)) : SCENES).map(s => [benchUrl(s, 6), `πάγκος ${s}`, true]),
    ...PAGES.map(p => [BASE + p, p, false]),
  ];
  for (const [url, name, isBench] of targets) {
    const p = await ctx.newPage();
    try {
      await p.goto(url, { waitUntil: isBench ? 'load' : 'networkidle', timeout: 30000 });
      await p.waitForTimeout(isBench ? 1400 : 500);
      await p.evaluate(() => { document.querySelectorAll('.acc-toggle[aria-expanded="false"]').forEach(b => b.click()) });
      await p.waitForTimeout(300);
      const rows = await p.evaluate(PROBE, MIN);
      if (rows.length) {
        total += rows.length;
        console.log(`\n${name} @${w}`);
        for (const r of rows) console.log(`  ${String(r.per).padStart(3)} χαρ · ${r.fs}px · ύψος ${r.lh}  «${r.t}»`);
      }
    } catch (e) { console.log(`  ! ${name} @${w}: ${e.message.slice(0, 60)}`); }
    await p.close();
  }
  await ctx.close();
}
await browser.close();
console.log(`\nΜέτρο γραμμής — ${total ? `${total} κείμενα πάνω από ${MIN} χαρακτήρες` : `κανένα κείμενο πάνω από ${MIN} χαρακτήρες`}`);
