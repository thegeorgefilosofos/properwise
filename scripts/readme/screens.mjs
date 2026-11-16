// ═══════════════════════════════════════════════════════════════════════════
// THE README IMAGES · docs/readme/*.png
// ─────────────────────────────────────────────────────────────────────────
// One hero (MacBook and iPhone) and one panel per feature, drawn from the
// perf bench: the same components as the app, in its light theme, with
// invented data. Devices are plain CSS, no third-party marks. Each panel
// carries its own light canvas with rounded corners, so it reads the same on
// GitHub's light and dark themes.
//
// GitHub shows README images at about 880 px. Panels are laid out at 880 and
// rendered at 2x; every screen is captured at the exact pixel size it lands
// on, so nothing is resampled. Output goes through sharp as a palette PNG.
//
// Before capture the bench's placeholder names become ordinary Greek ones
// (invented too), tax numbers and test addresses are removed, focus rings are
// cleared. If a bench placeholder survives, the script stops.
//
// Run:  node scripts/perf-bench/build-mobile.mjs
//       node scripts/readme/screens.mjs [out]
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { chromePath } from '../lib/chrome.mjs';

const ROOT = process.cwd();
const BENCH = join(ROOT, '.perf-bench/mobile.html');
if (!fs.existsSync(BENCH)) throw new Error('Missing bench: node scripts/perf-bench/build-mobile.mjs');
const OUT = resolve(process.argv[2] || join(ROOT, 'docs/readme'));
fs.mkdirSync(OUT, { recursive: true });

// ── Names ────────────────────────────────────────────────────────────────
const NAMES = [
  ['maria.ypodeigmatos@example.com', 'Μαρία Γεωργίου'],
  ['Λογιστικό Γραφείο Παράδειγμα', 'Λογιστικό Γραφείο Κωνσταντίνου'],
  ['Φοροτεχνικό Γραφείο Υπόδειγμα', 'Φοροτεχνικό Γραφείο Σταθοπούλου'],
  ['Γιώργος Παραδείγματος', 'Γιώργος Παπαδόπουλος'],
  ['Ελένη Παραδείγματος', 'Ελένη Κωνσταντίνου'],
  ['Νίκος Δοκιμής', 'Νίκος Αλεξίου'],
  ['Κώστας Δοκιμαστής', 'Κώστας Μαυρίδης'],
  ['Άννα Υποδείγματος', 'Άννα Θεοδώρου'],
  ['Ιδιοκτήτης Δοκιμών', 'Ελένη Μαρκοπούλου'],
  ['Οδός Παραδείγματος', 'Σόλωνος'],
  ['Οδού Παραδείγματος', 'Σόλωνος'],
  ['Δήμος Δοκιμής', 'Δήμος Αθηναίων'],
  ['Δήμου Δοκιμής', 'Δήμου Αθηναίων'],
];
const LEFTOVER = /Παράδειγ|Υπόδειγ|Υποδείγ|Δοκιμ|example\.com|ΑΦΜ\s*\d|Νέοι Όροι|WhatsApp|Viber|SMS/;

const browser = await chromium.launch({ executablePath: chromePath() });
const pngSize = buf => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

/** Cleans a bench scene and returns the colour at the top edge. */
const clean = map => {
  const st = document.createElement('style');
  st.textContent = '*:focus,*:focus-visible,*:focus-within{outline:none!important}*:focus,*:focus-visible{box-shadow:none!important}';
  document.head.append(st);
  document.activeElement?.blur?.();
  const leaves = () => [...document.querySelectorAll('body *')].filter(e => e.childElementCount === 0);
  const hide = el => { if (el) el.style.display = 'none'; };
  // The one-time "what changed" notice is not part of the product shot.
  for (const leaf of leaves().filter(e => /Νέοι Όροι/.test(e.textContent))) {
    let box = leaf;
    while (box.parentElement && box.parentElement !== document.body && getComputedStyle(box).borderTopStyle === 'none' && getComputedStyle(box).position === 'static') box = box.parentElement;
    hide(box);
  }
  for (const leaf of leaves().filter(e => e.textContent.trim() === 'neo.melos@example.com')) {
    let row = leaf;
    while (row.parentElement && row.parentElement.childElementCount < 3) row = row.parentElement;
    hide(row);
  }
  for (const leaf of leaves().filter(e => /^Στοιχεία γραφείου$/i.test(e.textContent.trim()))) { hide(leaf.nextElementSibling); hide(leaf); }
  // Tax numbers typed into inputs: empty the field.
  for (const inp of document.querySelectorAll('input')) if (/^\d{9}$/.test(inp.value)) inp.value = '';
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    let t = n.textContent;
    for (const [a, b] of map) if (t.includes(a)) t = t.split(a).join(b);
    t = t.replace(/\s*·\s*ΑΦΜ\s*\d{9}/g, '').replace(/^ΑΦΜ\s*\d{9}\s*·\s*/, '').replace(/[\w.]+@example\.com\s*·\s*/g, '').replace(/\s*·\s*ΑΤΑΚ\s*\d+/g, '');
    if (t !== n.textContent) n.textContent = t;
  }
  for (const el of leaves()) {
    const t = el.textContent.replace(/\s*·\s*ΑΦΜ\s*\d{9}/g, '').replace(/\s*ΑΦΜ\s*\d{9}/g, '');
    if (t !== el.textContent) el.textContent = t;
  }
  for (const el of leaves()) if (el.textContent === 'D') el.textContent = 'Ε';
  const rgba = c => { const m = c.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0]; return [m[0], m[1], m[2], m[3] ?? 1]; };
  let col = [255, 255, 255];
  for (const el of document.elementsFromPoint(innerWidth / 2, 2).reverse()) {
    const [r, g, b, a] = rgba(getComputedStyle(el).backgroundColor);
    if (a > 0) col = [col[0] * (1 - a) + r * a, col[1] * (1 - a) + g * a, col[2] * (1 - a) + b * a];
  }
  return { top: `rgb(${col.map(Math.round).join(',')})`, text: document.body.innerText };
};

// A sheet sits on clean content: no blur and no dimming behind it.
const flatSheet = () => {
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.position === 'fixed' && r.width >= innerWidth - 1 && r.height >= innerHeight - 1) {
      el.style.background = 'transparent';
      el.style.backdropFilter = 'none';
      el.style.webkitBackdropFilter = 'none';
    }
    if (/blur/.test(cs.filter)) el.style.filter = 'none';
  }
  const d = document.querySelector('[role="dialog"]');
  if (d) d.style.boxShadow = '0 -10px 40px rgba(15,27,46,.14), 0 -1px 0 rgba(15,27,46,.06)';
};

const PHONE_VW = 330;
const PHONE_SB = Math.round(54 * PHONE_VW / 393);
const PHONE_VH = Math.round(PHONE_VW * 852 / 393) - PHONE_SB;
const LAPTOP_VW = 1040;

/** One bench screen, captured at its final width (CSS px of the panel) at 2x. */
async function screen(scene, { device, width, prep, vw = LAPTOP_VW }) {
  const vp = device === 'phone' ? { width: PHONE_VW, height: PHONE_VH } : { width: vw, height: Math.round(vw * 10 / 16) };
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 * width / vp.width, locale: 'el-GR', colorScheme: 'light' });
  const p = await ctx.newPage();
  await p.goto(`file://${BENCH}?c=${scene}`, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.documentElement.setAttribute('data-mode', 'light'));
  await p.waitForTimeout(1200);
  if (prep) await prep(p);
  const res = await p.evaluate(clean, NAMES);
  const left = res.text.match(LEFTOVER);
  if (left) throw new Error(`Scene ${scene}: «${res.text.slice(Math.max(0, left.index - 60), left.index + 40)}» left on screen.`);
  await p.waitForTimeout(300);
  const buf = await p.screenshot();
  await ctx.close();
  const { w, h } = pngSize(buf);
  return { src: `data:image/png;base64,${buf.toString('base64')}`, w: w / 2, h: h / 2, top: res.top };
}

// ── Devices ──────────────────────────────────────────────────────────────
const statusBar = (k, bg, h) => {
  const u = v => `${Math.round(v * k * 100) / 100}px`;
  return `<div class="sb" style="height:${h}px;background:${bg};padding:0 ${u(26)} 0 ${u(42)};font-size:${u(15)}">
  <span>9:41</span>
  <span class="ic" style="gap:${u(5)}">
   <i class="sig" style="gap:${u(1.7)};height:${u(10.5)}">${[3.5, 5.5, 8, 10.5].map(v => `<b style="width:${u(2.7)};height:${u(v)};border-radius:${u(0.8)}"></b>`).join('')}</i>
   <i class="wifi" style="width:${u(15)};height:${u(10.5)}">${[15, 9.6, 4.4].map(d => `<b style="width:${u(d)};height:${u(d)};border-width:${u(2)};left:${u((15 - d) / 2)};top:${u((15 - d) / 2 + 1)}"></b>`).join('')}</i>
   <i class="bat" style="width:${u(23)};height:${u(11)};border-radius:${u(3.4)};padding:${u(1.8)}"><b style="border-radius:${u(1.8)}"></b><s style="width:${u(1.4)};height:${u(3.8)};right:${u(-2.8)}"></s></i>
  </span></div>`;
};
const phoneBox = shot => {
  const k = shot.w / PHONE_VW;
  const sb = Math.round(PHONE_SB * k);
  const bez = Math.round(10 * k);
  const ri = Math.round(46 * k);
  return { k, sb, bez, ri, W: shot.w + 2 * (bez + 3), H: sb + shot.h + 2 * (bez + 3) };
};
const iphone = (shot, { x, y, z = 2 }) => {
  const { k, sb, bez, ri, W, H } = phoneBox(shot);
  return `<div class="floor" style="left:${x + W * 0.08}px;top:${y + H - 20}px;width:${W * 0.84}px;height:36px"></div>
 <div class="phone" style="left:${x}px;top:${y}px;width:${W}px;height:${H}px;border-radius:${ri + bez + 3}px;z-index:${z}">
  <i class="btn" style="left:-2px;top:${Math.round(H * 0.17)}px;height:${Math.round(H * 0.04)}px"></i>
  <i class="btn" style="left:-2px;top:${Math.round(H * 0.24)}px;height:${Math.round(H * 0.075)}px"></i>
  <i class="btn" style="left:-2px;top:${Math.round(H * 0.33)}px;height:${Math.round(H * 0.075)}px"></i>
  <i class="btn" style="right:-2px;top:${Math.round(H * 0.27)}px;height:${Math.round(H * 0.11)}px"></i>
  <div class="bez" style="padding:${bez}px;border-radius:${ri + bez}px">
   <div class="scr" style="border-radius:${ri}px">
    <i class="island" style="width:${Math.round(104 * k)}px;height:${Math.round(31 * k)}px;top:${Math.round(9 * k)}px;margin-left:${-Math.round(52 * k)}px"></i>
    ${statusBar(k, shot.top, sb)}
    <img src="${shot.src}" style="width:${shot.w}px;height:${shot.h}px" alt="">
   </div>
  </div>
 </div>`;
};
const macBox = shot => {
  const sw = shot.w;
  const band = Math.round(sw * 0.026);
  const side = Math.round(sw * 0.016);
  const top = Math.round(sw * 0.018);
  const bottom = Math.round(sw * 0.02);
  const lidW = sw + 2 * side + 4;
  const lidH = band + shot.h + top + bottom + 4;
  const baseW = Math.round(lidW * 1.05 / 2) * 2;
  const baseH = Math.round(sw * 0.022);
  const hinge = Math.max(4, Math.round(sw * 0.006));
  return { sw, band, side, top, bottom, lidW, lidH, baseW, baseH, hinge, H: lidH + hinge + baseH };
};
const macbook = (shot, { x, y }) => {
  const { sw, band, side, top, bottom, lidW, lidH, baseW, baseH, hinge, H } = macBox(shot);
  const notchW = Math.round(sw * 0.075);
  const r1 = Math.round(sw * 0.024);
  return `<div class="floor" style="left:${x + baseW * 0.04}px;top:${y + H - 18}px;width:${baseW * 0.92}px;height:36px"></div>
 <div class="mac" style="left:${x}px;top:${y}px;width:${baseW}px">
  <div class="lid" style="width:${lidW}px;height:${lidH}px;margin:0 auto;border-radius:${r1 + 2}px ${r1 + 2}px ${Math.round(sw * 0.008)}px ${Math.round(sw * 0.008)}px">
   <div class="lbez" style="padding:${top}px ${side}px ${bottom}px;border-radius:${r1}px ${r1}px ${Math.round(sw * 0.006)}px ${Math.round(sw * 0.006)}px">
    <div class="lscr" style="border-radius:${Math.round(sw * 0.011)}px ${Math.round(sw * 0.011)}px 0 0">
     <div style="height:${band}px;background:${shot.top}"></div>
     <i class="notch" style="width:${notchW}px;height:${band}px;margin-left:${-notchW / 2}px;border-radius:0 0 ${Math.round(band * 0.4)}px ${Math.round(band * 0.4)}px"></i>
     <img src="${shot.src}" style="width:${shot.w}px;height:${shot.h}px" alt="">
    </div>
   </div>
  </div>
  <div class="hinge" style="width:${Math.round(lidW * 0.94)}px;height:${hinge}px"></div>
  <div class="base" style="height:${baseH}px;border-radius:0 0 ${Math.round(baseW * 0.06)}px ${Math.round(baseW * 0.06)}px / 0 0 ${baseH}px ${baseH}px">
   <i class="lip" style="width:${Math.round(baseW * 0.15)}px;height:${Math.round(baseH * 0.42)}px;margin-left:${-Math.round(baseW * 0.075)}px"></i>
  </div>
 </div>`;
};

// ── The panel ────────────────────────────────────────────────────────────
// The app's light tokens (app/globals.css): canvas --bg-base, ink --text-primary.
const C = { canvas: '#eef1f5', ink: '#0f1b2e' };
const PW = 880;
const css = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent}
.panel{position:relative;width:${PW}px;overflow:hidden;border-radius:20px;background:${C.canvas}}
.floor{position:absolute;border-radius:50%;background:radial-gradient(closest-side,rgba(15,27,46,.20),rgba(15,27,46,.07) 55%,rgba(15,27,46,0))}
.phone{position:absolute;padding:3px;background:linear-gradient(145deg,#4a4d54,#1d1e22 22%,#0d0e10 60%,#2c2e33);
 box-shadow:inset 0 0 0 1px rgba(255,255,255,.18),0 2px 4px rgba(15,27,46,.10),0 14px 28px -6px rgba(15,27,46,.20),0 30px 48px -18px rgba(15,27,46,.28)}
.phone .btn{position:absolute;width:3px;border-radius:2px;background:linear-gradient(90deg,#1d1e22,#4a4d54)}
.phone .bez{background:#000;height:100%}
.phone .scr{position:relative;overflow:hidden;height:100%;background:#fff}
.phone img,.mac img{display:block}
.phone .island{position:absolute;left:50%;border-radius:99px;background:#000;z-index:3}
.sb{display:flex;align-items:center;justify-content:space-between;font-family:-apple-system,'Inter',sans-serif;font-weight:600;letter-spacing:-.01em;color:${C.ink}}
.sb .ic{display:flex;align-items:center}
.sb i{display:block;position:relative}
.sig{display:flex!important;align-items:flex-end}.sig b{display:block;background:${C.ink}}
.wifi{overflow:hidden}.wifi b{position:absolute;border-radius:50%;border-style:solid;border-color:${C.ink} transparent transparent transparent}
.wifi b:last-child{border-color:${C.ink};background:${C.ink}}
.bat{box-shadow:inset 0 0 0 1px rgba(15,27,46,.45)}.bat b{display:block;width:80%;height:100%;background:${C.ink}}.bat s{position:absolute;top:50%;transform:translateY(-50%);border-radius:0 2px 2px 0;background:rgba(15,27,46,.45)}
.mac{position:absolute;z-index:1}
.lid{padding:2px;background:linear-gradient(180deg,#d4d7dc,#a9adb4 40%,#8f939a);box-shadow:0 2px 4px rgba(15,27,46,.08),0 22px 44px -16px rgba(15,27,46,.24)}
.lbez{background:#0a0a0b;height:100%}
.lscr{position:relative;overflow:hidden;background:#fff}
.notch{position:absolute;left:50%;top:0;background:#0a0a0b;z-index:3}
.hinge{margin:0 auto;background:linear-gradient(180deg,#5d6168,#9a9ea5 70%,#c4c7cc);border-radius:0 0 3px 3px}
.base{position:relative;background:linear-gradient(180deg,#f3f4f6 0%,#dcdfe3 22%,#c3c7cd 62%,#9599a1 100%);box-shadow:0 22px 36px -12px rgba(15,27,46,.32)}
.base .lip{position:absolute;left:50%;top:0;border-radius:0 0 10px 10px;background:linear-gradient(180deg,#a6aab1,#d2d5da)}
`;
const panel = (h, inner) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body><div class="panel" style="height:${h}px">${inner}</div></body></html>`;

// Layouts: everything centred in the panel with even margins.
const PAD = 40;
const twoPhones = (a, b, gap = 56) => {
  const pa = phoneBox(a), pb = phoneBox(b);
  const h = Math.ceil(Math.max(pa.H, pb.H) + 2 * PAD);
  const x0 = Math.round((PW - pa.W - pb.W - gap) / 2);
  return { h, html: `${iphone(a, { x: x0, y: PAD })}${iphone(b, { x: x0 + pa.W + gap, y: PAD })}` };
};
const macAndPhone = (lap, ph) => {
  const m = macBox(lap), p = phoneBox(ph);
  const h = Math.ceil(Math.max(m.H, p.H) + 2 * PAD);
  const overlap = Math.round(p.W * 0.42);
  const x0 = Math.round((PW - (m.baseW + p.W - overlap)) / 2);
  return { h, html: `${macbook(lap, { x: x0, y: PAD + Math.round((h - 2 * PAD - m.H) / 2) })}${iphone(ph, { x: x0 + m.baseW - overlap, y: h - PAD - p.H })}` };
};
const macOnly = lap => {
  const m = macBox(lap);
  return { h: Math.ceil(m.H + 2 * PAD), html: macbook(lap, { x: Math.round((PW - m.baseW) / 2), y: PAD }) };
};

// ── Shots ────────────────────────────────────────────────────────────────
const PHONE_W = 244;
const MAC_W = 640;
const MAC_W_HERO = 610;
const sheet = async p => { await p.evaluate(flatSheet); };
const shots = {
  heroLap: await screen('overview', { device: 'laptop', width: MAC_W_HERO }),
  heroPh: await screen('scanReview', { device: 'phone', width: 210, prep: sheet }),
  scan: await screen('scanReview', { device: 'phone', width: PHONE_W, prep: sheet }),
  ledger: await screen('finances', { device: 'phone', width: PHONE_W }),
  today: await screen('overview', { device: 'phone', width: PHONE_W }),
  books: await screen('accounting', { device: 'phone', width: PHONE_W }),
  tenant: await screen('tenant', { device: 'phone', width: PHONE_W }),
  rent: await screen('rent', { device: 'phone', width: PHONE_W, prep: sheet }),
  aade: await screen('myaadeReview', { device: 'laptop', width: MAC_W, prep: sheet }),
  firmLap: await screen('firmWorkspace', { device: 'laptop', width: 600 }),
  firmPh: await screen('firmOwner', { device: 'phone', width: 210 }),
};

const panels = {
  hero: macAndPhone(shots.heroLap, shots.heroPh),
  scan: twoPhones(shots.scan, shots.ledger),
  tax: twoPhones(shots.today, shots.books),
  rent: twoPhones(shots.tenant, shots.rent),
  myaade: macOnly(shots.aade),
  accountants: macAndPhone(shots.firmLap, shots.firmPh),
};

// ── Render ───────────────────────────────────────────────────────────────
const tmp = join(OUT, '.tmp.html');
const page = await browser.newPage({ viewport: { width: PW, height: 600 }, deviceScaleFactor: 2 });
const problems = [];
for (const [name, { h, html }] of Object.entries(panels)) {
  fs.writeFileSync(tmp, panel(h, html));
  await page.setViewportSize({ width: PW, height: h });
  await page.goto(`file://${tmp}`, { waitUntil: 'load' });
  const bad = await page.evaluate(PW => {
    const out = [];
    for (const el of document.querySelectorAll('.phone, .mac')) {
      const r = el.getBoundingClientRect();
      if (r.left < 8 || r.right > PW - 8 || r.top < 8 || r.bottom > innerHeight - 8) out.push(`device outside the panel (${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)})`);
    }
    for (const img of document.querySelectorAll('.phone img, .mac img')) {
      const r = img.getBoundingClientRect();
      const on = v => Math.abs(v * 2 - Math.round(v * 2)) < 0.01;
      if (!on(r.left) || !on(r.top) || r.width * 2 !== img.naturalWidth || r.height * 2 !== img.naturalHeight) out.push(`screen off the pixel grid: ${r.left},${r.top} ${r.width}x${r.height}`);
    }
    return out;
  }, PW);
  bad.forEach(x => problems.push(`${name}: ${x}`));
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: PW, height: h } });
  const file = join(OUT, `${name}.png`);
  await sharp(buf).png({ palette: true, quality: 92, effort: 10, compressionLevel: 9 }).toFile(file);
  console.log(`${name}.png  ${PW * 2}x${h * 2}  ${Math.round(fs.statSync(file).size / 1024)} KB`);
}
fs.rmSync(tmp, { force: true });
await browser.close();
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
