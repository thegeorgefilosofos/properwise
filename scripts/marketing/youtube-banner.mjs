// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΕΞΩΦΥΛΛΟ ΤΟΥ ΚΑΝΑΛΙΟΥ ΣΤΟ YOUTUBE
// ─────────────────────────────────────────────────────────────────────────
// Το κανάλι @properwisegr άνοιξε στις 05.10.2026 με το γκρι εξώφυλλο της
// πλατφόρμας. Εδώ βγαίνει το δικό του, στο ίδιο πλαίσιο με τις διαφάνειες του
// LinkedIn (scripts/marketing/linkedin-origin.mjs): ίδιο φόντο, Inter και
// Roboto Mono από το public/fonts, το λευκό λογότυπο.
//
// Η ΖΩΝΗ ΠΟΥ ΦΑΙΝΕΤΑΙ ΠΑΝΤΟΥ. Το YouTube ζητά 2560×1440 και δείχνει ολόκληρο
// μόνο στην τηλεόραση· στο κινητό και στον υπολογιστή κόβει στο κέντρο. Η
// ζώνη 1546×423 στο κέντρο φαίνεται σε κάθε συσκευή: εκεί μπαίνει κάθε λέξη.
// Έξω από αυτή μόνο φόντο. Η γεννήτρια ελέγχει ότι κανένα κείμενο δεν βγαίνει
// από τη ζώνη και βγάζει και μια προεπισκόπηση με τα όριά της.
//
// Τρέξε: npx tsx scripts/marketing/youtube-banner.mjs
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { join } from 'node:path';
import { chromePath } from '../lib/chrome.mjs';
import { YOUTUBE_URL } from '../../lib/core/site.ts';

const ROOT = process.cwd();
const R = join(ROOT, 'public');
const OUT = join(ROOT, 'docs/marketing/profil/youtube');
fs.mkdirSync(OUT, { recursive: true });
const b64 = p => fs.readFileSync(p).toString('base64');
const f = n => `data:font/woff2;base64,${b64(`${R}/fonts/${n}`)}`;
const LOGO = `data:image/png;base64,${b64(`${R}/brand/properwise-logotypo-lefko.png`)}`;

const W = 2560, H = 1440;
/** Η ζώνη που φαίνεται σε κάθε συσκευή (οδηγίες YouTube για το εξώφυλλο). */
const SAFE = { w: 1546, h: 423 };
const SAFE_X = (W - SAFE.w) / 2, SAFE_Y = (H - SAFE.h) / 2;
const HANDLE = `@${YOUTUBE_URL.split('@')[1]}`;

const html = guides => `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>
@font-face{font-family:Inter;font-weight:100 900;src:url(${f('inter-greek.woff2')})}
@font-face{font-family:Inter;font-weight:100 900;src:url(${f('inter-latin.woff2')})}
@font-face{font-family:Mono;font-weight:400 600;src:url(${f('robotomono-greek.woff2')})}
@font-face{font-family:Mono;font-weight:400 600;src:url(${f('robotomono-latin.woff2')})}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{font-family:Inter,sans-serif;color:#f1f5fc;-webkit-font-smoothing:antialiased;position:relative;background:#060b14}
.bg{position:absolute;inset:0;
 background:radial-gradient(1500px 900px at 80% 78%, rgba(21,96,212,.42), transparent 62%),
  radial-gradient(1200px 700px at 12% 8%, rgba(138,180,248,.14), transparent 66%),
  linear-gradient(172deg,#0d1a30 0%,#08101d 55%,#060b14 100%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:64px 64px;
 mask-image:radial-gradient(1500px 820px at 50% 50%,#000 18%,transparent 78%)}
.edge{position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,transparent,rgba(138,180,248,.6),transparent)}
.safe{position:absolute;left:${SAFE_X}px;top:${SAFE_Y}px;width:${SAFE.w}px;height:${SAFE.h}px;
 display:flex;align-items:center;justify-content:space-between;gap:80px;padding:0 24px}
.l{display:flex;flex-direction:column;gap:24px;min-width:0}
.logo{height:46px;width:auto;display:block;align-self:flex-start}
.eyebrow{font-family:Mono,monospace;font-size:24px;font-weight:500;letter-spacing:.24em;color:#8ab4f8;text-transform:uppercase;display:flex;align-items:center;gap:18px}
.eyebrow:before{content:'';width:42px;height:2px;background:#8ab4f8}
h1{font-size:64px;line-height:1.06;font-weight:800;letter-spacing:-.035em;white-space:nowrap}
h1 .a{background:linear-gradient(95deg,#a9c8ff 0%,#5f9bff 60%,#3d7ef0 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.r{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:18px}
.cta{padding:22px 36px;border-radius:99px;background:linear-gradient(180deg,#3d7ef0,#1560d4);box-shadow:0 18px 44px rgba(21,96,212,.55),inset 0 1px 0 rgba(255,255,255,.3);font-size:32px;font-weight:700;display:flex;align-items:center;gap:16px;white-space:nowrap}
.handle{font-family:Mono,monospace;font-size:24px;letter-spacing:.08em;color:#9ec0ff}
.guide{position:absolute;left:${SAFE_X}px;top:${SAFE_Y}px;width:${SAFE.w}px;height:${SAFE.h}px;outline:3px dashed #ff6b6b;pointer-events:none}
</style></head><body>
<div class="bg"></div><div class="grid"></div><div class="edge"></div>
<div class="safe">
 <div class="l">
  <img class="logo" src="${LOGO}" alt="">
  <div class="eyebrow">ΣΥΝΤΟΜΑ ΒΙΝΤΕΟ ΓΙΑ ΙΔΙΟΚΤΗΤΕΣ ΑΚΙΝΗΤΩΝ</div>
  <h1>Φόρος ενοικίων, ΕΝΦΙΑ, Airbnb.<br><span class="a">Με αριθμούς από τον νόμο.</span></h1>
 </div>
 <div class="r">
  <div class="cta">properwise.gr <span>→</span></div>
  <div class="handle">${HANDLE}</div>
 </div>
</div>
${guides ? '<div class="guide"></div>' : ''}
</body></html>`;

const b = await chromium.launch({ executablePath: chromePath() });
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

await p.setContent(html(false), { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
// Τα κεφαλαία γράφονται χωρίς τόνο: το text-transform του Chrome τον
// κρατούσε («ΣΎΝΤΟΜΑ»), γι' αυτό η γραμμή γράφεται ήδη σε κεφαλαία.
// Κανένα κείμενο έξω από τη ζώνη: αυτό που κόβεται στο κινητό δεν διαβάζεται.
const spill = await p.evaluate(({ x, y, w, h }) => [...document.querySelectorAll('.safe *')]
  .map(e => ({ t: (e.textContent || e.tagName).trim().slice(0, 30), r: e.getBoundingClientRect() }))
  .filter(({ r }) => r.width && (r.left < x - 0.5 || r.top < y - 0.5 || r.right > x + w + 0.5 || r.bottom > y + h + 0.5))
  .map(({ t }) => t), { x: SAFE_X, y: SAFE_Y, w: SAFE.w, h: SAFE.h });
if (spill.length) throw new Error(`έξω από τη ζώνη που φαίνεται: ${spill.join(' · ')}`);

const file = join(OUT, 'properwise-youtube-banner.png');
await p.screenshot({ path: file });
await p.setContent(html(true), { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: join(OUT, 'properwise-youtube-banner-zoni.png') });
await b.close();

const kb = Math.round(fs.statSync(file).size / 1024);
if (kb > 6 * 1024) throw new Error(`${kb} KB: το YouTube δέχεται έως 6 MB`);
console.log(`✓ εξώφυλλο ${W}×${H}, ${kb} KB, όλο το κείμενο στη ζώνη ${SAFE.w}×${SAFE.h} · ${OUT}`);
