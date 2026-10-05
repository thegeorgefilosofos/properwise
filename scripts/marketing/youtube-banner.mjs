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
let GRAIN = 'none';

// ΛΙΤΟ (05.10.2026, ζήτημα του ιδιοκτήτη: «top tier, minimal»). Μόνο το
// λογότυπο και μία γραμμή με τα θέματα του καναλιού. Ό,τι άλλο (κουμπί,
// ψευδώνυμο, τίτλος) το δείχνει ήδη η σελίδα του καναλιού από κάτω.
const TOPICS = ['Φόρος ενοικίων', 'ΕΝΦΙΑ', 'Airbnb', 'Προθεσμίες'];

const html = guides => `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>
@font-face{font-family:Inter;font-weight:100 900;src:url(${f('inter-greek.woff2')})}
@font-face{font-family:Inter;font-weight:100 900;src:url(${f('inter-latin.woff2')})}
@font-face{font-family:Mono;font-weight:400 600;src:url(${f('robotomono-greek.woff2')})}
@font-face{font-family:Mono;font-weight:400 600;src:url(${f('robotomono-latin.woff2')})}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{font-family:Inter,sans-serif;color:#f1f5fc;-webkit-font-smoothing:antialiased;position:relative;background:#050912}
.bg{position:absolute;inset:0;
 background:radial-gradient(1100px 520px at 50% 62%, rgba(31,98,214,.30), transparent 70%),
  radial-gradient(1800px 900px at 50% 120%, rgba(13,40,92,.55), transparent 70%),
  linear-gradient(180deg,#0a1324 0%,#060b16 60%,#050912 100%)}
.grain{position:absolute;inset:0;background-image:${GRAIN};background-size:260px;opacity:.06;mix-blend-mode:overlay}
.safe{position:absolute;left:${SAFE_X}px;top:${SAFE_Y}px;width:${SAFE.w}px;height:${SAFE.h}px;
 display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px}
.logo{height:92px;width:auto;display:block}
.rule{width:64px;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,#8ab4f8,transparent)}
.topics{font-family:Mono,monospace;font-size:25px;font-weight:500;letter-spacing:.28em;color:#93a6c4;display:flex;gap:30px;align-items:center}
.topics i{width:5px;height:5px;border-radius:50%;background:#4f7fd6;display:inline-block}
.guide{position:absolute;left:${SAFE_X}px;top:${SAFE_Y}px;width:${SAFE.w}px;height:${SAFE.h}px;outline:3px dashed #ff6b6b;pointer-events:none}
</style></head><body>
<div class="bg"></div><div class="grain"></div>
<div class="safe">
 <img class="logo" src="${LOGO}" alt="">
 <div class="rule"></div>
 <div class="topics">${TOPICS.map(t => `<span>${t.toLocaleUpperCase('el').normalize('NFD').replace(/[\u0301\u0308]/g, '').normalize('NFC')}</span>`).join('<i></i>')}</div>
</div>
${guides ? '<div class="guide"></div>' : ''}
</body></html>`;

const b = await chromium.launch({ executablePath: chromePath() });
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
// Ο ΚΟΚΚΟΣ ΤΩΝ ΔΙΑΦΑΝΕΙΩΝ (linkedin-origin.mjs), για βάθος χωρίς σχήμα.
await p.setContent(`<body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" style="display:block"><filter id="g" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1 0 0 0 -.3"/></filter><rect width="100%" height="100%" filter="url(#g)"/></svg></body>`);
GRAIN = `url(data:image/png;base64,${(await p.screenshot({ clip: { x: 0, y: 0, width: 260, height: 260 }, omitBackground: true })).toString('base64')})`;

await p.setContent(html(false), { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
// Τα κεφαλαία γράφονται χωρίς τόνο: το text-transform του Chrome τον
// κρατούσε («ΣΎΝΤΟΜΑ»), γι' αυτό οι τόνοι αφαιρούνται στο κείμενο.
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
