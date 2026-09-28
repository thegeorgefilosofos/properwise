// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΡΩΤΗ ΑΝΑΡΤΗΣΗ ΤΗΣ ΣΕΛΙΔΑΣ ΣΤΟ LINKEDIN: ΠΑΡΟΥΣΙΑΣΗ ΤΟΥ ΠΡΟΪΟΝΤΟΣ (28.09.2026)
// ─────────────────────────────────────────────────────────────────────────
// Κάθετη 4:5 (1080×1350), η μορφή που πιάνει τον περισσότερο χώρο στη ροή,
// ειδικά στο κινητό. Πάνω ο τίτλος, στη μέση τέσσερις κάρτες από το προϊόν
// (σάρωση, Ε2, ΕΝΦΙΑ, Νόα), κάτω η υπόσχεση που αποδεικνύεται. Κανένα ποσό:
// τα νούμερα των αναρτήσεων βγαίνουν μόνο από τη μηχανή τους.
//
// Τρέξε: node scripts/marketing/linkedin-launch.mjs
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { join } from 'node:path';
import { chromePath } from '../lib/chrome.mjs';
const R = join(process.cwd(), 'public');
const f = n => 'data:font/woff2;base64,' + fs.readFileSync(`${R}/fonts/${n}`).toString('base64');
const OUT = process.argv[2] ?? join(process.cwd(), 'docs/marketing/profil/linkedin-launch-post.png');
const tick = `<i style="display:inline-block;width:7px;height:13px;margin:0 6px 4px 2px;border:solid #52c79e;border-width:0 3px 3px 0;transform:rotate(45deg)"></i>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Inter;font-weight:100 900;src:url(${f('inter-latin.woff2')})}
@font-face{font-family:Mono;font-weight:400 600;src:url(${f('robotomono-latin.woff2')})}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;overflow:hidden}
body{font-family:Inter,sans-serif;color:#eef3fb;-webkit-font-smoothing:antialiased;position:relative;
 background:
  radial-gradient(700px 520px at 80% 58%, rgba(21,96,212,.34), transparent 70%),
  radial-gradient(620px 420px at 0% 0%, rgba(138,180,248,.14), transparent 70%),
  linear-gradient(170deg,#0c1526 0%,#080d16 65%,#070b12 100%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:40px 40px;
 mask-image:radial-gradient(640px 520px at 60% 62%,#000 15%,transparent 78%)}
.pad{position:absolute;inset:0;padding:84px 84px 76px;display:flex;flex-direction:column}
.brand{display:flex;justify-content:space-between;align-items:center}
.word{font-size:24px;font-weight:800;letter-spacing:.02em}
.eyebrow{font-family:Mono,monospace;font-size:17px;letter-spacing:.24em;color:#8ab4f8;text-transform:uppercase;display:flex;align-items:center;gap:12px}
.eyebrow i{width:9px;height:9px;border-radius:50%;background:#8ab4f8;box-shadow:0 0 14px #8ab4f8}
h1{margin-top:58px;font-size:84px;line-height:1.02;font-weight:800;letter-spacing:-.045em}
h1 .a{color:#8ab4f8}
.sub{margin-top:26px;font-size:28px;line-height:1.4;color:#a9b7cc;max-width:820px;letter-spacing:-.01em}
.stage{flex:1;margin-top:36px;display:grid;grid-template-columns:1fr 1fr;align-content:center;gap:46px 30px}
.card{position:relative;border-radius:22px;background:linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.13);
 box-shadow:0 30px 70px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.09);padding:32px 30px}
.lbl{font-family:Mono,monospace;font-size:13px;letter-spacing:.16em;color:#6f7f96;text-transform:uppercase}
.row{display:flex;align-items:center;justify-content:space-between;gap:16px}
.pill{font-size:15px;font-weight:650;padding:5px 13px;border-radius:99px}
.ok{color:#52c79e;background:rgba(82,199,158,.14)}
.bl{color:#8ab4f8;background:rgba(138,180,248,.14)}
.t{font-size:24px;font-weight:650;letter-spacing:-.01em}
.li{display:flex;align-items:center;font-size:19px;color:#cfd9e8}
.foot{display:flex;justify-content:space-between;align-items:flex-end;padding-top:26px;border-top:1px solid rgba(255,255,255,.09)}
.promise{font-size:24px;font-weight:650}
.promise span{color:#a9b7cc;font-weight:500}
.url{font-family:Mono,monospace;font-size:20px;letter-spacing:.06em;color:#8ab4f8}
</style></head><body><div class="grid"></div>
<div class="pad">
 <div class="brand"><div class="eyebrow"><i></i>Introducing</div><div class="word">PROPERWISE</div></div>
 <h1>Property in Greece,<br><span class="a">organised.</span></h1>
 <div class="sub">Taxes, expenses and paperwork for your property, kept in one place and ready when your accountant asks.</div>

 <div class="stage">
  <div class="card" style="transform:rotate(-1.6deg) translateY(10px)">
   <div class="lbl">Scanned</div>
   <div class="row" style="margin-top:12px"><span class="t">Electricity bill</span><span class="pill ok">Filed</span></div>
   <div style="margin-top:16px;height:8px;border-radius:6px;background:rgba(255,255,255,.08)"><div style="width:100%;height:100%;border-radius:6px;background:linear-gradient(90deg,#1560d4,#8ab4f8)"></div></div>
   <div class="row" style="margin-top:12px;font-size:16px;color:#a9b7cc"><span>Expenses · Utilities</span><span>Read in seconds</span></div>
  </div>

  <div class="card">
   <div class="row"><span class="lbl">Tax return · E2</span><span class="pill ok">Ready</span></div>
   <div style="margin-top:16px;display:flex;flex-direction:column;gap:12px">
    <div class="li">${tick}Rental income</div>
    <div class="li">${tick}Deductible expenses</div>
    <div class="li">${tick}Lease declaration checked</div>
   </div>
  </div>

  <div class="card" style="transform:rotate(1deg)">
   <div class="row"><span class="lbl">Property tax · ENFIA</span><span class="pill bl">Checked</span></div>
   <div style="margin-top:14px;font-size:18px;line-height:1.45;color:#cfd9e8">Calculated from your own data, with the reductions you are entitled to.</div>
  </div>

  <div class="card" style="display:flex;gap:18px;align-items:flex-start;transform:translateY(14px)">
   <div style="flex:none;width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#8ab4f8,#1560d4);display:grid;place-items:center;font-size:22px;font-weight:800">N</div>
   <div style="font-size:18px;line-height:1.45;color:#dfe7f3"><span style="color:#8ab4f8;font-weight:650">Noa</span> · Only the tenant's tax ID is missing. Everything else for your E2 is in place.</div>
  </div>
 </div>

 <div class="foot">
  <div class="promise">Free for a single property. <span>Built in Greece.</span></div>
  <div class="url">properwise.gr</div>
 </div>
</div></body></html>`;
const b = await chromium.launch({ executablePath: chromePath() });
const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
await p.setContent(html, { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: OUT });
await b.close();
console.log('✓', OUT);
