// ═══════════════════════════════════════════════════════════════════════════
// LINKEDIN · «ΠΩΣ ΞΕΚΙΝΗΣΕ ΤΟ PROPERWISE» (δεύτερη έκδοση, 05.10.2026)
// ─────────────────────────────────────────────────────────────────────────
// Επτά κάθετες διαφάνειες 4:5 (1080×1350) και ένα PDF για το «Add a document».
//
// Η ΙΣΤΟΡΙΑ ΕΙΝΑΙ ΤΟΥ ΙΔΙΟΚΤΗΤΗ, ΜΕ ΤΑ ΔΙΚΑ ΤΟΥ ΣΤΟΙΧΕΙΑ (Launch Kit της
// 23.09.2026, «Προσωπικό LinkedIn»): το διαμέρισμα που κληρονόμησε τον Ιούνιο,
// οι τρεις μήνες τα σαββατοκύριακα, τα χρήματα που γλίτωσαν από τον μάστορα,
// το χέρι στον γύψο. Κανένα στοιχείο δεν προστέθηκε, κανένα όνομα, καμία
// διεύθυνση.
//
// Η ΜΑΡΚΑ ΜΕΝΕΙ ΜΙΑ. Η δοκιμή με serif και ανοιχτό φόντο απορρίφθηκε από τον
// ιδιοκτήτη (03.10.2026). Το πλαίσιο είναι αυτό του linkedin-carousel.mjs:
// σκούρο μπλε, Inter και Roboto Mono, ίδια κεφαλίδα και πρόοδος. Η δεύτερη
// έκδοση ανεβάζει όσα μπαίνουν ΜΕΣΑ στο πλαίσιο: αντικείμενα με αληθινό φως
// (σοβάς με ανάγλυφο, ρωγμή, φρέσκια μπογιά, χαρτοταινία), σε SVG με
// φίλτρα φωτισμού, και η εφαρμογή σε κινητό.
//
// ΚΑΝΕΝΑ ΦΟΡΟΛΟΓΙΚΟ ΝΟΥΜΕΡΟ ΜΕ ΤΟ ΧΕΡΙ. Η διαφάνεια της έκπτωσης για
// ανακαίνιση διαβάζει όριο, έτη, ποσό ανά έτος, κλάσμα υλικών, προθεσμία και
// νομική βάση από το lib/accounting/renovation39b.ts.
//
//   1. «Τι τον θες τον μάστορα;»          2. Η απόδειξη του καλοκαιριού
//   3. Ο τοίχος συγχωρεί                  4. Οι υποχρεώσεις δεν ξαναβάφονται
//   5. Η ειρωνεία: άρθρο 39Β              6. Φάκελος, όχι screenshots
//   7. Το όραμα και η σειρά
//
// Τρέξε: npx tsx scripts/marketing/linkedin-origin.mjs [αριθμός διαφάνειας]
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { join } from 'node:path';
import { chromePath } from '../lib/chrome.mjs';
import { PLANS } from '../../lib/billing/plans.ts';
import {
  RENO_39B_CAP, RENO_39B_YEARS, RENO_39B_PER_YEAR, RENO_39B_MATERIALS_SHARE,
  RENO_39B_TO, RENO_39B_LAW, RENO_39B_KYA,
} from '../../lib/accounting/renovation39b.ts';

if (PLANS.free.priceMonthly !== 0) throw new Error('Το «Ξεκινάς δωρεάν» θέλει δωρεάν πακέτο.');
const eur = n => `${new Intl.NumberFormat('el-GR', { maximumFractionDigits: 0 }).format(n)}€`;
const SHARE = `1/${Math.round(1 / RENO_39B_MATERIALS_SHARE)}`;

const ROOT = process.cwd();
const R = join(ROOT, 'public');
const OUT = join(ROOT, 'docs/marketing/profil/linkedin-pos-xekinise');
const only = process.argv[2] ? Number(process.argv[2]) : 0;
if (!only) { fs.rmSync(OUT, { recursive: true, force: true }); }
fs.mkdirSync(OUT, { recursive: true });
const b64 = p => fs.readFileSync(p).toString('base64');
const f = n => `data:font/woff2;base64,${b64(`${R}/fonts/${n}`)}`;
const LOGO = `data:image/png;base64,${b64(`${R}/brand/properwise-logotypo-lefko.png`)}`;
// Τσεκ σε CSS: ο φύλακας brand-mark δεν δέχεται χειροποίητο SVG εκτός BrandMark.
const tick = (c = '#5fd4a8', s = 1) => `<i style="display:inline-block;width:${9*s}px;height:${17*s}px;margin:0 ${4*s}px ${5*s}px ${4*s}px;border:solid ${c};border-width:0 ${4*s}px ${4*s}px 0;transform:rotate(45deg);flex:none"></i>`;
const N = 7;

// ── Οι υφές χαρτιού και κόκκου, ψημένες σε PNG ─────────────────────────────
// Ο Chromium δεν εφαρμόζει φίλτρα σε SVG που μπαίνει ως εικόνα φόντου, οπότε
// κάθε υφή αποδίδεται πρώτα μέσα στη σελίδα και φωτογραφίζεται με διαφάνεια.
const noise = (id, freq, oct, seed, matrix) => `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${oct}" seed="${seed}" stitchTiles="stitch"/><feColorMatrix values="${matrix}"/></filter><rect width="100%" height="100%" filter="url(#${id})"/>`;
const TEXTURES = {
  FIBRE: [300, 300, noise('p', '.9', 3, 2, '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.1 0 0 0 -.42')],
  INK: [400, 140, noise('i', '.7', 2, 5, '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4.2 0 0 0 -1.05')],
  GRAIN: [260, 260, noise('g', '.85', 2, 3, '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1 0 0 0 -.3')],
};
const b = await chromium.launch({ executablePath: chromePath() });
const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
const T = {};
for (const [k, [w, h, body]] of Object.entries(TEXTURES)) {
  await p.setContent(`<body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="display:block">${body}</svg></body>`);
  const png = await p.screenshot({ clip: { x: 0, y: 0, width: w, height: h }, omitBackground: true });
  T[k] = `url(data:image/png;base64,${png.toString('base64')})`;
}
const { FIBRE, INK, GRAIN } = T;

// ── Το πλαίσιο της μάρκας ──────────────────────────────────────────────────
const css = `
@font-face{font-family:Inter;font-weight:100 900;src:url(${f('inter-greek.woff2')})}
@font-face{font-family:Inter;font-weight:100 900;src:url(${f('inter-latin.woff2')})}
@font-face{font-family:Mono;font-weight:400 600;src:url(${f('robotomono-greek.woff2')})}
@font-face{font-family:Mono;font-weight:400 600;src:url(${f('robotomono-latin.woff2')})}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;overflow:hidden}
body{font-family:Inter,sans-serif;color:#f1f5fc;-webkit-font-smoothing:antialiased;position:relative;background:#060b14}
.bg{position:absolute;inset:0;
 background:radial-gradient(900px 700px at 78% 82%, rgba(21,96,212,.40), transparent 62%),
  radial-gradient(700px 500px at 8% -6%, rgba(138,180,248,.16), transparent 66%),
  linear-gradient(172deg,#0d1a30 0%,#08101d 55%,#060b14 100%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:54px 54px;
 mask-image:radial-gradient(720px 600px at 62% 72%,#000 10%,transparent 76%)}
.edge{position:absolute;left:0;right:0;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(138,180,248,.6),transparent)}
.grain{position:absolute;inset:0;background-image:${GRAIN};background-size:260px;opacity:.05;mix-blend-mode:overlay;pointer-events:none;z-index:50}
.pad{position:absolute;inset:0;padding:76px 80px 66px;display:flex;flex-direction:column}
.head{display:flex;justify-content:space-between;align-items:center;position:relative;z-index:10}
.head img{height:30px;display:block}
.prog{display:flex;gap:7px}.prog b{width:26px;height:5px;border-radius:3px;background:rgba(255,255,255,.14)}.prog b.on{background:#8ab4f8;box-shadow:0 0 12px rgba(138,180,248,.7)}.prog b.done{background:rgba(138,180,248,.42)}
.eyebrow{margin-top:70px;font-family:Mono,monospace;font-size:19px;font-weight:500;letter-spacing:.24em;color:#8ab4f8;text-transform:uppercase;display:flex;align-items:center;gap:16px;position:relative;z-index:10}
.eyebrow:before{content:'';width:34px;height:2px;background:#8ab4f8}
h1{margin-top:24px;font-size:96px;line-height:.98;font-weight:800;letter-spacing:-.045em;text-wrap:balance;position:relative;z-index:10}
h1 .a{background:linear-gradient(95deg,#a9c8ff 0%,#5f9bff 60%,#3d7ef0 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
h1 .m{color:#5d6c84}
.sub{margin-top:28px;font-size:31px;line-height:1.38;color:#aebbd0;max-width:900px;letter-spacing:-.012em;text-wrap:pretty;position:relative;z-index:10}
.sub b{color:#f1f5fc;font-weight:650}
.stage{flex:1;position:relative;margin:40px 0 30px}
.card{position:absolute;border-radius:28px;background:linear-gradient(180deg,rgba(28,44,72,.94),rgba(14,24,42,.96));border:1px solid rgba(255,255,255,.12);
 box-shadow:0 40px 90px rgba(0,0,0,.6),0 0 0 1px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.12);padding:34px 36px}
.lbl{font-family:Mono,monospace;font-size:17px;letter-spacing:.16em;color:#7d8da6;text-transform:uppercase}
.row{display:flex;align-items:center;justify-content:space-between;gap:18px}
.pill{font-size:20px;font-weight:650;padding:8px 18px;border-radius:99px;white-space:nowrap;display:inline-flex;align-items:center;gap:10px}
.pill:before{content:'';width:9px;height:9px;border-radius:50%;background:currentColor}
.ok{color:#5fd4a8;background:rgba(82,199,158,.14)} .bl{color:#9ec0ff;background:rgba(138,180,248,.15)} .wa{color:#f0c97d;background:rgba(229,192,123,.15)} .rd{color:#ff8f8f;background:rgba(240,110,110,.14)}
.t{font-size:29px;font-weight:700;letter-spacing:-.018em}
.foot{display:flex;justify-content:space-between;align-items:center;padding-top:26px;border-top:1px solid rgba(255,255,255,.1);position:relative;z-index:10}
.url{font-family:Mono,monospace;font-size:22px;letter-spacing:.06em;color:#9ec0ff}
.swipe{font-family:Mono,monospace;font-size:19px;letter-spacing:.18em;color:#7d8da6;text-transform:uppercase;display:flex;align-items:center;gap:14px}
.swipe i{display:inline-block;width:46px;height:2px;background:#8ab4f8;position:relative}
.swipe i:after{content:'';position:absolute;right:0;top:-5px;width:10px;height:10px;border:solid #8ab4f8;border-width:2px 2px 0 0;transform:rotate(45deg)}
.line{display:flex;align-items:center;gap:20px;padding:17px 0;border-top:1px solid rgba(255,255,255,.08)}
.line:first-child{border-top:0;padding-top:4px}
.dot{flex:none;width:46px;height:46px;border-radius:50%;display:grid;place-items:center}
.dot.ok{background:rgba(82,199,158,.16)} .dot.wa{background:rgba(229,192,123,.14)} .dot.bl{background:rgba(138,180,248,.16)}
.dot.wa:after{content:'';width:12px;height:12px;border-radius:50%;border:3px solid #f0c97d}
.v{font-size:26px;font-weight:650;letter-spacing:-.015em;color:#eef2f7}
.mono{font-family:Mono,monospace}
`;
const frame = (n, eyebrow, h1, sub, stage, foot, h1Size) => `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${css}</style></head><body><div class="bg"></div><div class="grid"></div><div class="edge"></div><div class="grain"></div>
<div class="pad"><div class="head"><img src="${LOGO}" alt="PROPERWISE"><div class="prog">${Array.from({ length: N }, (_, k) => `<b class="${k + 1 === n ? 'on' : k + 1 < n ? 'done' : ''}"></b>`).join('')}</div></div>
<div class="eyebrow">${eyebrow}</div><h1${h1Size ? ` style="font-size:${h1Size}px"` : ''}>${h1}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}
<div class="stage">${stage}</div>
<div class="foot">${foot ?? `<div class="url">properwise.gr</div><div class="swipe">Σύρε <i></i></div>`}</div></div></body></html>`;
const line = (kind, label, value) => `<div class="line"><div class="dot ${kind}">${kind === 'ok' ? tick('#5fd4a8', .75) : kind === 'bl' ? tick('#9ec0ff', .75) : ''}</div>
  <div>${label ? `<div class="lbl" style="font-size:15px">${label}</div>` : ''}<div class="v" style="${label ? 'margin-top:6px' : ''}">${value}</div></div></div>`;

// ── Ο ΤΟΙΧΟΣ: σοβάς με ανάγλυφο, ρωγμή, φρέσκια μπογιά ─────────────────────
// Ο σοβάς είναι θόρυβος fractal που φωτίζεται από αριστερά (feDiffuseLighting):
// το φως δίνει όγκο εκεί που ένα επίπεδο χρώμα θα έμοιαζε με χαρτόνι. Η
// μπογιά έχει δικό της, λεπτότερο ανάγλυφο ρολού και άκρη που «τρώει» τον
// σοβά με μάσκα θορύβου, όπως αφήνει το ρολό στο τελευταίο πέρασμα.
let wallId = 0;
function wall({ w, h, paintFrom = 0.52, crack = true, radius = 26, tilt = 0 }) {
  const id = `w${++wallId}`;
  const px = Math.round(w * paintFrom);
  // Η ρωγμή: τεθλασμένη με σταθερό σπόρο, ώστε κάθε τρέξιμο να βγάζει την ίδια.
  let s = 17; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const pts = []; let x = w * 0.10, y = h * 0.16;
  while (y < h * 0.9) { pts.push(`${x.toFixed(1)},${y.toFixed(1)}`); x += (rnd() - 0.42) * 46; y += 18 + rnd() * 34; }
  const branch = []; let bx = w * 0.17, by = h * 0.47;
  for (let k = 0; k < 7; k++) { branch.push(`${bx.toFixed(1)},${by.toFixed(1)}`); bx += 16 + rnd() * 22; by += (rnd() - 0.3) * 26; }
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;border-radius:${radius}px;transform:rotate(${tilt}deg)">
  <defs>
   <filter id="${id}p" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency=".011 .014" numOctaves="5" seed="11" result="n"/>
    <feDiffuseLighting in="n" surfaceScale="4.2" lighting-color="#e3e5e9" result="l"><feDistantLight azimuth="200" elevation="42"/></feDiffuseLighting>
    <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="g"/>
    <feColorMatrix in="g" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0" result="gm"/>
    <feComposite in="gm" in2="l" operator="over"/>
   </filter>
   <filter id="${id}q" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency=".03 .12" numOctaves="3" seed="23" result="n"/>
    <feDiffuseLighting in="n" surfaceScale=".55" lighting-color="#f3f5f8" result="l"><feDistantLight azimuth="200" elevation="62"/></feDiffuseLighting>
   </filter>
   <filter id="${id}e" x="-20%" y="-5%" width="140%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency=".035 .6" numOctaves="3" seed="8" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="34" xChannelSelector="R" yChannelSelector="G"/>
   </filter>
   <mask id="${id}c" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><rect x="${px}" y="-40" width="${w}" height="${h + 80}" fill="#fff" filter="url(#${id}e)"/></mask>
   <linearGradient id="${id}v" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9ec0ff" stop-opacity=".10"/><stop offset=".55" stop-color="#0b1424" stop-opacity="0"/><stop offset="1" stop-color="#050a14" stop-opacity=".42"/></linearGradient>
   <radialGradient id="${id}s" cx=".78" cy=".2" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${w}" height="${h}" filter="url(#${id}p)"/>
  <rect width="${w}" height="${h}" fill="#7f8896" opacity=".12" style="mix-blend-mode:multiply"/>
  ${crack ? `<polyline points="${pts.join(' ')}" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2" transform="translate(1.6 1.4)"/>
  <polyline points="${pts.join(' ')}" fill="none" stroke="#1b1a1a" stroke-width="2.6" stroke-linejoin="round"/>
  <polyline points="${branch.join(' ')}" fill="none" stroke="#1b1a1a" stroke-width="1.4" stroke-linejoin="round" opacity=".8"/>` : ''}
  <g mask="url(#${id}c)">
   <rect width="${w}" height="${h}" filter="url(#${id}q)"/>
   <rect width="${w}" height="${h}" fill="url(#${id}s)"/>
  </g>
  <rect width="${w}" height="${h}" fill="url(#${id}v)"/>
 </svg>`;
}

// ── Η ΧΑΡΤΟΤΑΙΝΙΑ: ετικέτα γραμμένη με μαρκαδόρο ───────────────────────────
const tape = (text, rot = -4, w = 470) => `<div style="position:relative;display:inline-block;width:${w}px;padding:18px 30px 16px;transform:rotate(${rot}deg);
  background:linear-gradient(180deg,rgba(236,226,196,.96),rgba(220,208,174,.96));box-shadow:0 10px 24px rgba(0,0,0,.45);
  clip-path:polygon(1% 4%,8% 0,22% 5%,40% 1%,61% 4%,80% 0,99% 5%,100% 92%,93% 100%,70% 95%,48% 100%,27% 96%,6% 100%,0 95%)">
  <div style="position:absolute;inset:0;background-image:${FIBRE};background-size:300px;opacity:.35;mix-blend-mode:multiply"></div>
  <div class="mono" style="position:relative;font-size:21px;font-weight:600;letter-spacing:.14em;color:#2a2b2f">${text}</div></div>`;

// ═══ 1 · «ΤΙ ΤΟΝ ΘΕΣ ΤΟΝ ΜΑΣΤΟΡΑ;» ═══════════════════════════════════════════
const s1 = `
 <div style="position:absolute;left:-80px;right:-80px;bottom:-30px;top:20px;overflow:hidden">
  <div style="position:absolute;left:0;right:0;top:0;bottom:0;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 18%,#000 100%)">${wall({ w: 1080, h: 700, paintFrom: 0.5, radius: 0 })}</div>
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,#08101d 0,rgba(8,16,29,0) 30%),radial-gradient(600px 420px at 20% 100%,rgba(5,10,20,.75),transparent)"></div>
 </div>
 <div style="position:absolute;left:30px;bottom:56px">${tape('ΙΟΥΝΙΟΣ · 35 τ.μ. · ΚΛΕΙΣΤΟ ΜΗΝΕΣ', -3, 600)}</div>`;

// ═══ 2 · Η ΑΠΟΔΕΙΞΗ ΤΟΥ ΚΑΛΟΚΑΙΡΙΟΥ ════════════════════════════════════════
const rrow = (k, v) => `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:20px;padding:6px 0">
  <span>${k}</span><span style="text-align:right;white-space:nowrap">${v}</span></div>`;
const dots = `<div style="margin:10px 0;border-top:2px dashed rgba(30,34,40,.5)"></div>`;
const ZIG = 'polygon(0 0,100% 0,' + Array.from({ length: 29 }, (_, k) => {
  const x = 100 - (k + 0.5) * (100 / 28.5);
  return `${Math.max(x, 0).toFixed(2)}% calc(100% - ${k % 2 ? 0 : 12}px)`;
}).join(',') + ',0 calc(100% - 12px))';
const s2 = `
 <div style="position:absolute;left:-20px;top:40px;width:420px;height:560px;opacity:.9;transform:rotate(4deg);filter:drop-shadow(0 30px 50px rgba(0,0,0,.6))">${wall({ w: 420, h: 560, paintFrom: 0.62, radius: 18 })}</div>
 <div style="position:absolute;left:180px;width:700px;top:-4px;transform:rotate(-2.5deg);
  filter:drop-shadow(0 2px 2px rgba(0,0,0,.4)) drop-shadow(0 28px 36px rgba(0,0,0,.45)) drop-shadow(0 60px 90px rgba(0,0,0,.45))">
  <div style="position:relative;background:#f6f6f2;clip-path:${ZIG};padding:36px 48px 118px;font-family:Mono,monospace;color:#23272e;font-size:19px;font-weight:500">
   <div style="position:absolute;inset:0;background-image:${FIBRE};background-size:300px;opacity:.22"></div>
   <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.07),transparent 9%,transparent 88%,rgba(0,0,0,.06)),linear-gradient(180deg,rgba(255,255,255,.5),transparent 20%)"></div>
   <div style="position:relative;opacity:.92">
    <div style="text-align:center;font-size:25px;font-weight:600;letter-spacing:.32em">ΑΠΟΔΕΙΞΗ</div>
    <div style="text-align:center;font-size:15px;letter-spacing:.16em;margin-top:6px;opacity:.7">ΤΟ ΚΑΛΟΚΑΙΡΙ ΤΟΥ ΔΙΑΜΕΡΙΣΜΑΤΟΣ</div>
    ${dots}
    ${rrow('Διαμέρισμα, κλειστό για μήνες', '35 τ.μ.')}
    ${rrow('Τρίψιμο, σοβάτισμα, βάψιμο', '3 μήνες')}
    ${rrow('Συνεργείο', 'οι γονείς')}
    ${rrow('Σαββατοκύριακα ελεύθερα', '0')}
    ${rrow('Βουτιές, Ιούλιος και Αύγουστος', '0')}
    ${dots}
    ${rrow('<b>ΓΛΙΤΩΣΑΜΕ</b>', '<b>300 με 400€</b>')}
    ${rrow('<b>ΚΟΣΤΙΣΕ</b>', '<b>ένα καλοκαίρι</b>')}
    <div style="text-align:right;font-weight:600;color:#a3242c;padding-top:2px">+ ένα χέρι στον γύψο</div>
   </div>
   <div style="position:absolute;left:46px;bottom:38px;transform:rotate(-6deg);border:4px solid #b0242d;border-radius:8px;padding:7px 15px;color:#b0242d;font-weight:600;font-size:25px;letter-spacing:.2em;opacity:.82;mix-blend-mode:multiply;-webkit-mask-image:${INK};-webkit-mask-size:400px 140px">ΕΞΟΦΛΗΘΗΚΕ</div>
  </div>
 </div>`;

// ═══ 3 · Ο ΤΟΙΧΟΣ ΣΥΓΧΩΡΕΙ ═════════════════════════════════════════════════
const s3 = `
 <div style="position:absolute;left:0;right:0;top:0;bottom:0;border-radius:30px;overflow:hidden;box-shadow:0 50px 100px rgba(0,0,0,.6),inset 0 0 0 1px rgba(255,255,255,.1)">
  ${wall({ w: 920, h: 760, paintFrom: 0.5, radius: 30 })}
 </div>
 <div style="position:absolute;left:34px;top:30px" class="lbl"><span style="color:#20242b;background:rgba(240,242,245,.85);padding:8px 14px;border-radius:8px">Πριν · η ρωγμή</span></div>
 <div style="position:absolute;right:34px;top:30px" class="lbl"><span style="color:#20242b;background:rgba(240,242,245,.85);padding:8px 14px;border-radius:8px">Μετά · ένα χέρι μπογιά</span></div>
`;

// ═══ 4 · ΟΙ ΥΠΟΧΡΕΩΣΕΙΣ ΔΕΝ ΞΑΝΑΒΑΦΟΝΤΑΙ ═══════════════════════════════════
const DUES = [
  ['wa', 'Εκκαθαριστικό ΕΝΦΙΑ', '«Το άνοιξα και το ξανάκλεισα.»', 'Ανοιχτό', -2.2, 0],
  ['rd', 'Δήλωση ακινήτων (Ε9)', '«Θα τη δούμε του χρόνου.»', 'Εκκρεμεί', 1.6, 1],
  ['rd', 'Φορολογική δήλωση', '«Μάλλον σωστή είναι.»', 'Χωρίς έλεγχο', -1.2, 2],
  ['wa', 'Κοινόχρηστα', '«Κάπου πιο πάνω στο Viber.»', 'Χαμένα', 2, 3],
];
const s4 = DUES.map(([k, t, q, st, rot, i]) => `
 <div class="card" style="left:${i % 2 ? 70 : 0}px;right:${i % 2 ? 0 : 70}px;top:${i * 150}px;padding:26px 32px;transform:rotate(${rot}deg);z-index:${i + 1}">
  <div class="row">
   <div style="display:flex;align-items:center;gap:22px">
    <div style="flex:none;width:58px;height:58px;border-radius:16px;display:grid;place-items:center;background:${k === 'rd' ? 'rgba(240,110,110,.14)' : 'rgba(229,192,123,.14)'}">
     <div style="width:24px;height:30px;border-radius:4px;border:3px solid ${k === 'rd' ? '#ff8f8f' : '#f0c97d'};position:relative"><div style="position:absolute;left:4px;right:4px;top:6px;height:3px;background:${k === 'rd' ? '#ff8f8f' : '#f0c97d'};box-shadow:0 7px 0 ${k === 'rd' ? '#ff8f8f' : '#f0c97d'}"></div></div>
    </div>
    <div><div class="t" style="font-size:28px">${t}</div><div style="margin-top:6px;font-size:24px;color:#9aa8bd;font-style:italic;letter-spacing:-.01em">${q}</div></div>
   </div>
   <span class="pill ${k}">${st}</span>
  </div>
 </div>`).join('');

// ═══ 5 · Η ΕΙΡΩΝΕΙΑ: ΑΡΘΡΟ 39Β ═════════════════════════════════════════════
const bars = Array.from({ length: RENO_39B_YEARS }, (_, k) => `
  <div style="display:flex;flex-direction:column;align-items:center;gap:12px;flex:1">
   <div style="width:100%;height:150px;display:flex;align-items:flex-end"><div style="width:100%;height:100%;border-radius:12px 12px 4px 4px;background:linear-gradient(180deg,#5f9bff,#1560d4);box-shadow:0 10px 30px rgba(21,96,212,.45),inset 0 1px 0 rgba(255,255,255,.35);display:flex;justify-content:center;padding-top:16px"><span style="font-size:22px;font-weight:750;letter-spacing:-.01em;color:#fff">${eur(RENO_39B_PER_YEAR)}</span></div></div>
   <div class="mono" style="font-size:16px;letter-spacing:.12em;color:#7d8da6">ΕΤΟΣ ${k + 1}</div>
  </div>`).join('');
const cond = (ok, t) => `<div style="display:flex;align-items:center;gap:16px;padding:12px 0">
  <div class="dot ${ok ? 'ok' : ''}" style="width:40px;height:40px;${ok ? '' : 'background:rgba(240,110,110,.14)'}">${ok ? tick('#5fd4a8', .62) : '<span style="color:#ff8f8f;font-size:24px;font-weight:800;line-height:1">×</span>'}</div>
  <div style="font-size:24px;font-weight:600;letter-spacing:-.012em;color:${ok ? '#e6ecf5' : '#ffb3b3'}">${t}</div></div>`;
const s5 = `
 <div class="card" style="left:0;right:0;top:0;padding:30px 36px 28px">
  <div class="row"><div class="lbl">Ανακαίνιση · μείωση φόρου</div><span class="pill bl">έως ${RENO_39B_TO}</span></div>
  <div style="display:flex;align-items:flex-end;gap:26px;margin-top:16px">
   <div style="font-size:92px;font-weight:800;letter-spacing:-.045em;line-height:.9;background:linear-gradient(95deg,#a9c8ff,#5f9bff 60%,#3d7ef0);-webkit-background-clip:text;color:transparent">${eur(RENO_39B_CAP)}</div>
   <div style="font-size:24px;line-height:1.3;color:#aebbd0;padding-bottom:6px">μείωση ίση με τη δαπάνη,<br>για όλα τα έτη μαζί</div>
  </div>
  <div style="display:flex;gap:16px;margin-top:28px">${bars}</div>
  <div style="margin-top:14px;font-size:22px;color:#aebbd0">Ισόποσα σε ${RENO_39B_YEARS} έτη, <b style="color:#f1f5fc">ποτέ πάνω από τον φόρο της χρονιάς.</b></div>
 </div>
 <div class="card" style="left:0;right:0;bottom:0;padding:18px 36px 16px;display:grid;grid-template-columns:1fr 1fr;column-gap:30px">
  ${cond(true, 'Τιμολόγιο στο ΑΦΜ σου')}${cond(true, 'Ηλεκτρονική πληρωμή')}
  ${cond(true, `Υλικά έως ${SHARE} της εργασίας`)}${cond(false, 'Η δουλειά που κάνεις μόνος')}
 </div>`;
const s5foot = `<div class="mono" style="font-size:15px;line-height:1.5;letter-spacing:.02em;color:#7d8da6;max-width:760px">Πηγή: ${RENO_39B_LAW} · ${RENO_39B_KYA}</div><div class="swipe">Σύρε <i></i></div>`;

// ═══ 6 · ΦΑΚΕΛΟΣ, ΟΧΙ SCREENSHOTS ═══════════════════════════════════════════
const bill = `<div style="position:absolute;left:52px;top:92px;width:250px;height:280px;background:#eef0f3;border-radius:6px;transform:rotate(-4deg);padding:20px 20px;box-shadow:0 14px 30px rgba(0,0,0,.45)">
  <div style="position:absolute;inset:0;background-image:${FIBRE};background-size:300px;opacity:.2;border-radius:6px"></div>
  <div style="position:relative;font-size:13px;font-weight:800;color:#1a2332;letter-spacing:.06em">ΛΟΓΑΡΙΑΣΜΟΣ ΡΕΥΜΑΤΟΣ</div>
  ${[86, 62, 74, 48, 80, 56].map(w => `<div style="position:relative;margin-top:14px;height:7px;width:${w}%;border-radius:4px;background:#bcc4cf"></div>`).join('')}
  <div style="position:absolute;right:20px;bottom:26px;width:96px;height:30px;border-radius:6px;background:#d3d9e1"></div>
 </div>`;
const phone = `
 <div style="position:absolute;left:0;top:-10px;width:380px;height:700px;border-radius:60px;padding:14px;background:linear-gradient(145deg,#3a4558,#141b27 40%,#2b3446);box-shadow:0 60px 120px rgba(0,0,0,.65),inset 0 0 0 2px rgba(255,255,255,.08)">
  <div style="position:relative;width:100%;height:100%;border-radius:52px;overflow:hidden;background:#0a111d">
   <div style="position:absolute;left:50%;top:14px;width:118px;height:34px;margin-left:-59px;border-radius:20px;background:#000;z-index:3"></div>
   <div class="mono" style="position:absolute;left:34px;top:22px;font-size:15px;color:#c8d2e0;z-index:2">9:41</div>
   <div style="position:absolute;left:0;right:0;top:0;height:400px;background:radial-gradient(300px 260px at 50% 55%,#3b4a62,#141c2a)">
    ${bill}
    ${[['left:30px;top:76px', '0 0'], ['right:30px;top:76px', '0 0'], ['left:30px;top:380px', '0 0'], ['right:30px;top:380px', '0 0']].map(([pos], i) => `<div style="position:absolute;${pos};width:46px;height:46px;border:solid #8ab4f8;border-width:${i < 2 ? '4px' : '0'} ${i % 2 ? '4px' : '0'} ${i >= 2 ? '4px' : '0'} ${i % 2 ? '0' : '4px'};border-radius:${['14px 0 0 0', '0 14px 0 0', '0 0 0 14px', '0 0 14px 0'][i]};${i >= 2 ? 'margin-top:-46px' : ''}"></div>`).join('')}
    <div style="position:absolute;left:30px;right:30px;top:232px;height:3px;background:linear-gradient(90deg,transparent,#8ab4f8,transparent);box-shadow:0 0 24px 6px rgba(138,180,248,.55)"></div>
   </div>
   <div style="position:absolute;left:0;right:0;bottom:0;height:300px;border-radius:30px 30px 0 0;background:linear-gradient(180deg,#16233a,#0e1729);border-top:1px solid rgba(255,255,255,.1);padding:22px 26px">
    <div style="width:48px;height:5px;border-radius:3px;background:rgba(255,255,255,.2);margin:0 auto 18px"></div>
    <div class="row"><div class="lbl" style="font-size:13px">Διαβάστηκε</div><span class="pill ok" style="font-size:15px;padding:5px 12px">Έλεγξε</span></div>
    <div style="margin-top:12px;font-size:23px;font-weight:700;letter-spacing:-.015em">Λογαριασμός ρεύματος</div>
    ${[['Κατηγορία', 'Ενέργεια'], ['Ακίνητο', 'Το διαμέρισμα'], ['Πληρωμή', 'Ηλεκτρονική']].map(([k, v]) => `<div style="display:flex;justify-content:space-between;padding:9px 0;border-top:1px solid rgba(255,255,255,.08);font-size:18px"><span style="color:#8a98ad">${k}</span><span style="font-weight:600">${v}</span></div>`).join('')}
    <div style="margin-top:10px;height:48px;border-radius:16px;background:linear-gradient(180deg,#3d7ef0,#1560d4);display:grid;place-items:center;font-size:19px;font-weight:700;box-shadow:0 10px 24px rgba(21,96,212,.5)">Στο σωστό ακίνητο</div>
   </div>
  </div>
 </div>`;
const s6 = `${phone}
 <div class="card" style="right:0;top:0;width:480px;padding:30px 32px 24px">
  <div class="row"><div class="lbl">Φάκελος λογιστή</div><span class="pill ok">Έτοιμος</span></div>
  <div class="t" style="margin-top:12px;font-size:31px">Φορολογική χρονιά</div>
  <div style="margin-top:20px">
   ${line('ok', 'Ακίνητο', 'Ενοίκια και έξοδα')}
   ${line('ok', 'Παραστατικά', 'Ανά κατηγορία')}
   ${line('bl', 'Πριν σου το ζητήσει', 'Τι λείπει')}
  </div>
 </div>
 <div style="position:absolute;right:0;bottom:0;width:480px">
  ${['Φωτογραφίζεις', 'Ελέγχεις με μια ματιά', 'Μπαίνει στη θέση του'].map((t, i) => `<div style="display:flex;align-items:center;gap:18px;padding:12px 0">
   <div class="mono" style="flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;border:2px solid rgba(138,180,248,.5);color:#9ec0ff;font-size:18px">${i + 1}</div>
   <div style="font-size:25px;font-weight:650;letter-spacing:-.015em">${t}</div></div>`).join('')}
 </div>`;

// ═══ 7 · ΤΟ ΟΡΑΜΑ ΚΑΙ Η ΣΕΙΡΑ ═══════════════════════════════════════════════
// Οι επόμενες Τρίτες, από το docs/marketing/linkedin-seira.md.
const SERIES = [
  ['13.10', 'ΕΝΦΙΑ 2026: πληρωμή, δόσεις, πιστοποιητικό'],
  ['20.10', 'Φορολογία Airbnb 2026'],
  ['27.10', 'Καθαρή απόδοση ακινήτου'],
  ['03.11', 'Φορολογία ενοικίων 2026'],
  ['10.11', 'Ενοίκιο μέσω τράπεζας'],
  ['17.11', 'Βραχυχρόνια 2026: ΑΜΑ και προδιαγραφές'],
];
const s7 = `
 <div class="card" style="left:0;right:0;top:0;padding:26px 34px 12px">
  <div class="lbl">Κάθε Τρίτη · ένας οδηγός με τον υπολογιστή του</div>
  <div style="margin-top:10px">
   ${SERIES.map(([d, t], i) => `<div style="display:flex;align-items:center;gap:22px;padding:15px 0;border-top:${i ? '1px solid rgba(255,255,255,.08)' : '0'}">
    <div class="mono" style="flex:none;width:92px;font-size:20px;letter-spacing:.06em;color:${i ? '#7d8da6' : '#8ab4f8'}">${d}</div>
    <div style="flex:1;font-size:25px;font-weight:${i ? 550 : 700};letter-spacing:-.015em;color:${i ? '#d6dfec' : '#fff'}">${t}</div>
    ${i ? '' : '<span class="pill bl">Επόμενη</span>'}</div>`).join('')}
  </div>
 </div>`;
const cta = `<div style="display:flex;flex-direction:column;gap:6px"><div style="font-size:30px;font-weight:800;letter-spacing:-.02em">Βάλε το ακίνητό σου σε τάξη.</div><div style="font-size:22px;color:#aebbd0">Ξεκινάς δωρεάν, χωρίς κρυφές χρεώσεις.</div></div>
  <div style="padding:20px 30px;border-radius:99px;background:linear-gradient(180deg,#3d7ef0,#1560d4);box-shadow:0 14px 34px rgba(21,96,212,.55),inset 0 1px 0 rgba(255,255,255,.3);font-size:24px;font-weight:700;display:flex;align-items:center;gap:14px">properwise.gr <span>→</span></div>`;

const slides = [
  frame(1, 'Πως ξεκινησε το PROPERWISE',
    '«Τι τον θες<br><span class="a">τον μάστορα;»</span>',
    'Μόνοι μας θα το κάνουμε. <b>Αν μεγάλωσες στην Ελλάδα, την έχεις ακούσει.</b>', s1, undefined, 112),
  frame(2, 'Ο λογαριασμος ενος καλοκαιριου',
    'Γλιτώσαμε τον μάστορα.<br><span class="a">Πληρώσαμε αλλιώς.</span>',
    'Τον Ιούνιο, μια κληρονομιά. Τρεις μήνες, κάθε Σάββατο και Κυριακή.', s2, undefined, 84),
  frame(3, 'Ο τοιχος',
    'Ο τοίχος συγχωρεί ένα λάθος.<br><span class="a">Τον ξαναβάφεις.</span>',
    '', s3, undefined, 84),
  frame(4, 'Οι υποχρεωσεις',
    'Οι υποχρεώσεις<br><span class="a">δεν ξαναβάφονται.</span>',
    'Εκεί το «θα το κάνω μόνος» δεν γλιτώνει τίποτα. <b>Το πληρώνεις αργότερα.</b>', s4, undefined, 92),
  frame(5, 'Η ειρωνεια',
    'Ο μάστορας που γλιτώσαμε<br><span class="a">θα γύριζε ως μείωση φόρου.</span>',
    '', s5, s5foot, 70),
  frame(6, 'Ετσι ξεκινησε το PROPERWISE',
    'Στον λογιστή με φάκελο,<br><span class="a">όχι με screenshots.</span>',
    '', s6, undefined, 80),
  frame(7, 'Το οραμα',
    '<span class="m">«</span>Κανένας ιδιοκτήτης να μην υπογράφει δήλωση<br><span class="a">που δεν μπορεί να ελέγξει.</span><span class="m">»</span>',
    '', s7, cta, 62),
];

const files = [];
for (const [i, html] of slides.entries()) {
  if (only && only !== i + 1) continue;
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  const spill = await p.evaluate(() => {
    const foot = document.querySelector('.foot').getBoundingClientRect().top;
    return [...document.querySelectorAll('.stage .card, .stage .t, .stage .v')].some(e => e.getBoundingClientRect().bottom > foot + 1);
  });
  if (spill) console.warn(`⚠ διαφάνεια ${i + 1}: η σκηνή περνά στο υποσέλιδο`);
  const file = join(OUT, `properwise-pos-xekinise-${i + 1}.png`);
  await p.screenshot({ path: file });
  files.push(file);
}
if (!only) {
  // Το PDF σε JPEG υψηλής ποιότητας: το LinkedIn δέχεται έως 100 MB, αλλά ένα
  // ελαφρύ αρχείο ανεβαίνει και ανοίγει γρηγορότερα στο κινητό.
  const jp = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
  const jpgs = [];
  for (const file of files) {
    await jp.setContent(`<body style="margin:0"><img src="data:image/png;base64,${b64(file)}" style="display:block;width:1080px;height:1350px"></body>`, { waitUntil: 'load' });
    jpgs.push((await jp.screenshot({ type: 'jpeg', quality: 90 })).toString('base64'));
  }
  const pdf = await b.newPage();
  await pdf.setContent(`<!doctype html><html><head><style>@page{size:1080px 1350px;margin:0}body{margin:0}img{display:block;width:1080px;height:1350px;page-break-after:always}</style></head><body>${
    jpgs.map(j => `<img src="data:image/jpeg;base64,${j}">`).join('')}</body></html>`, { waitUntil: 'load' });
  await pdf.pdf({ path: join(OUT, 'properwise-pos-xekinise.pdf'), width: '1080px', height: '1350px', printBackground: true });
}
await b.close();
console.log('✓', files.length, 'διαφάνειες', only ? '' : 'και PDF', 'στο', OUT);
