// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΕΞΩΦΥΛΛΟ ΤΗΣ ΣΕΛΙΔΑΣ ΣΤΟ LINKEDIN, ΜΕ ΜΙΑ ΣΚΗΝΗ ΑΠΟ ΤΟ ΠΡΟΪΟΝ (28.09.2026)
// ─────────────────────────────────────────────────────────────────────────
// Ο τίτλος της αρχικής στα αγγλικά και δίπλα του τρεις κάρτες: σάρωση που
// αρχειοθετήθηκε, Ε2 έτοιμο, απάντηση της Νόας. Ο επισκέπτης καταλαβαίνει τι
// κάνει το προϊόν πριν διαβάσει κείμενο.
//
// ΖΩΝΕΣ ΑΣΦΑΛΕΙΑΣ: στον υπολογιστή το σήμα της σελίδας κάθεται κάτω αριστερά,
// και απλώνεται ώς τα ~260 από τα 1128 (μετρημένο στη ζωντανή σελίδα,
// 28.09.2026), άρα το κείμενο αρχίζει στα 300. Στο κινητό το LinkedIn κόβει τις
// άκρες, άρα ο τίτλος μένει στο κέντρο και οι κάρτες είναι το περιθώριο.
//
// Τρέξε: node scripts/marketing/linkedin-banner.mjs
// Γράφει το docs/marketing/profil/linkedin-banner-en.png (1128×191, σε διπλή ανάλυση).
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { join } from 'node:path';
import { chromePath } from '../lib/chrome.mjs';
const R=join(process.cwd(),'public');
const f=n=>'data:font/woff2;base64,'+fs.readFileSync(`${R}/fonts/${n}`).toString('base64');
const OUT=process.argv[2] ?? join(process.cwd(),'docs/marketing/profil/linkedin-banner-en.png');
const tick=`<i style="display:inline-block;width:4px;height:7px;margin:0 2px 2px 1px;border:solid #52c79e;border-width:0 1.8px 1.8px 0;transform:rotate(45deg)"></i>`;
const html=`<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Inter;font-weight:100 900;src:url(${f('inter-latin.woff2')})}
@font-face{font-family:Mono;font-weight:400 600;src:url(${f('robotomono-latin.woff2')})}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1128px;height:191px;overflow:hidden}
body{font-family:Inter,sans-serif;color:#eef3fb;-webkit-font-smoothing:antialiased;position:relative;
 background:
  radial-gradient(520px 260px at 78% 30%, rgba(21,96,212,.38), transparent 70%),
  radial-gradient(420px 220px at 18% -30%, rgba(138,180,248,.16), transparent 70%),
  linear-gradient(160deg,#0c1526 0%,#080d16 70%,#070b12 100%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:24px 24px;
 mask-image:radial-gradient(420px 200px at 76% 50%,#000 10%,transparent 75%)}
.hair{position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,transparent,rgba(138,180,248,.45),transparent)}
.copy{position:absolute;left:300px;top:34px;width:410px}
.eyebrow{font-family:Mono,monospace;font-size:8.5px;letter-spacing:.22em;color:#8ab4f8;text-transform:uppercase;display:flex;align-items:center;gap:7px}
.eyebrow i{width:5px;height:5px;border-radius:50%;background:#8ab4f8;box-shadow:0 0 8px #8ab4f8}
h1{margin-top:10px;font-size:29px;line-height:1.08;font-weight:780;letter-spacing:-.035em}
h1 .a{color:#8ab4f8}
.sub{margin-top:11px;font-size:11.5px;color:#a9b7cc;letter-spacing:-.005em}
.sub b{color:#eef3fb;font-weight:600}
.card{position:absolute;border-radius:11px;background:linear-gradient(180deg,rgba(255,255,255,.085),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.12);
 box-shadow:0 18px 40px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(6px)}
.lbl{font-family:Mono,monospace;font-size:6.5px;letter-spacing:.16em;color:#6f7f96;text-transform:uppercase}
.row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.pill{font-size:7.5px;font-weight:650;padding:2.5px 7px;border-radius:99px}
.ok{color:#52c79e;background:rgba(82,199,158,.13)}
.bl{color:#8ab4f8;background:rgba(138,180,248,.13)}
</style></head><body>
<div class="grid"></div><div class="hair"></div>
<div class="copy">
 <div class="eyebrow"><i></i>Property in Greece, organised</div>
 <h1>Snap <span class="a">the bill.</span><br>PROPERWISE does the rest.</h1>
 <div class="sub"><b>Taxes, expenses and paperwork</b> in one place · properwise.gr</div>
</div>

<!-- 1. receipt scanned -->
<div class="card" style="left:738px;top:30px;width:162px;padding:11px 12px;transform:rotate(-2.2deg)">
 <div class="lbl">Scanned</div>
 <div class="row" style="margin-top:6px"><span style="font-size:10.5px;font-weight:650">Electricity bill</span><span class="pill ok">Filed</span></div>
 <div style="margin-top:7px;height:4px;border-radius:3px;background:rgba(255,255,255,.08)"><div style="width:100%;height:100%;border-radius:3px;background:linear-gradient(90deg,#1560d4,#8ab4f8)"></div></div>
 <div class="row" style="margin-top:6px;font-size:8px;color:#a9b7cc"><span>Expenses · Utilities</span><span>2 sec</span></div>
</div>

<!-- 2. E2 ready -->
<div class="card" style="left:916px;top:22px;width:188px;padding:11px 12px">
 <div class="row"><span class="lbl">Tax return · E2</span><span class="pill ok">Ready</span></div>
 <div style="margin-top:8px;display:flex;flex-direction:column;gap:5px;font-size:8.5px;color:#cfd9e8">
  <div style="display:flex;gap:6px;align-items:center">${tick}Rental income</div>
  <div style="display:flex;gap:6px;align-items:center">${tick}Deductible expenses</div>
  <div style="display:flex;gap:6px;align-items:center">${tick}Lease declaration checked</div>
 </div>
</div>

<!-- 3. Noa -->
<div class="card" style="left:790px;top:112px;width:256px;padding:9px 11px;display:flex;gap:9px;align-items:center;transform:rotate(1deg)">
 <div style="flex:none;width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#8ab4f8,#1560d4);display:grid;place-items:center;font-size:10px;font-weight:800">N</div>
 <div style="font-size:8.6px;line-height:1.4;color:#dfe7f3"><span style="color:#8ab4f8;font-weight:650">Noa</span> · Only the tenant's tax ID is missing. Everything else is in place.</div>
</div>
</body></html>`;
const b=await chromium.launch({executablePath:chromePath()});
const p=await b.newPage({viewport:{width:1128,height:191},deviceScaleFactor:2});
await p.setContent(html,{waitUntil:'load'});await p.evaluate(()=>document.fonts.ready);
await p.screenshot({path:OUT});await b.close();
