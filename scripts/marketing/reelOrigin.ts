// ═══════════════════════════════════════════════════════════════════════════
// REEL · «ΠΩΣ ΞΕΚΙΝΗΣΕ ΤΟ PROPERWISE»
// ─────────────────────────────────────────────────────────────────────────
// ΧΡΗΣΗ:  npx tsx scripts/marketing/reelOrigin.ts   (μετά: reelOriginSound.ts)
//
// Το δεύτερο ποστ του LinkedIn (linkedin-origin.mjs) σε κίνηση, σκηνή προς
// διαφάνεια, με τα ίδια λόγια. Ό,τι στις διαφάνειες είναι ακίνητο, εδώ
// συμβαίνει: η απόδειξη τυπώνεται γραμμή γραμμή και σφραγίζεται, το ρολό
// περνά πάνω από τη ρωγμή, οι υποχρεώσεις πέφτουν μία μία στο τραπέζι, ο
// μετρητής της έκπτωσης ανεβαίνει, το κινητό διαβάζει τον λογαριασμό.
//
// Η ΙΣΤΟΡΙΑ ΕΙΝΑΙ ΤΟΥ ΙΔΙΟΚΤΗΤΗ, ΟΠΩΣ ΣΤΙΣ ΔΙΑΦΑΝΕΙΕΣ: κανένα στοιχείο δεν
// προστέθηκε. ΚΑΝΕΝΑ ΦΟΡΟΛΟΓΙΚΟ ΝΟΥΜΕΡΟ ΜΕ ΤΟ ΧΕΡΙ: όριο, έτη, ποσό ανά έτος,
// κλάσμα υλικών, προθεσμία και νομική βάση από το lib/accounting/renovation39b.ts.
//
// Ο τοίχος είναι ο ίδιος σοβάς των διαφανειών (θόρυβος fractal με φως από
// αριστερά), ψημένος σε εικόνα μία φορά πριν από τα καρέ: ένα φίλτρο SVG
// 900×720 σε κάθε καρέ θα κόστιζε λεπτά χωρίς να αλλάζει τίποτα στο μάτι.
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import {
  RENO_39B_CAP, RENO_39B_YEARS, RENO_39B_PER_YEAR, RENO_39B_MATERIALS_SHARE,
  RENO_39B_TO, RENO_39B_LAW, RENO_39B_KYA,
} from '../../lib/accounting/renovation39b';
import { C, esc, ico, mark } from './igKit';
import { eur } from './rentFacts';
import { BASE_CSS, BG_JS, MOTION_JS, mask, shoot } from './reelKit';
import { ORIGIN, SCENES } from './reelOriginTimeline';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { chromePath } = require('../lib/chrome.mjs');

const OUT_VIDEO = join(process.cwd(), 'docs/marketing/reels/reel-origin');
const OUT_DOC = join(process.cwd(), 'docs/marketing/instagram/reel-origin');
const TAGLINE = 'Βάλε το ακίνητό σου σε τάξη.';

const SHARE = `1/${Math.round(1 / RENO_39B_MATERIALS_SHARE)}`;

// ── Ψήσιμο: ο σοβάς και οι υφές, σε εικόνα ─────────────────────────────────
async function bake(items: Record<string, [number, number, string]>): Promise<Record<string, string>> {
  const b = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] });
  try {
    const pg = await b.newPage({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: 1 });
    const out: Record<string, string> = {};
    for (const [k, [w, h, body]] of Object.entries(items)) {
      await pg.setViewportSize({ width: w, height: h });
      await pg.setContent(`<body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="display:block">${body}</svg></body>`);
      const png = await pg.screenshot({ clip: { x: 0, y: 0, width: w, height: h }, omitBackground: true });
      out[k] = `data:image/png;base64,${png.toString('base64')}`;
    }
    return out;
  } finally {
    await b.close();
  }
}

const noise = (id: string, freq: string, oct: number, seed: number, matrix: string) =>
  `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${oct}" seed="${seed}" stitchTiles="stitch"/><feColorMatrix values="${matrix}"/></filter><rect width="100%" height="100%" filter="url(#${id})"/>`;

/**
 * Ο σοβάς του linkedin-origin.mjs. `paint` είναι από πού και πέρα έχει
 * βαφτεί (0 όλος, πάνω από 1 καθόλου). Ίδιοι σπόροι σε κάθε κλήση: ο βαμμένος
 * και ο άβαφος τοίχος πέφτουν ακριβώς ο ένας πάνω στον άλλον.
 */
function wall(w: number, h: number, paint: number, crack = true): string {
  const px = Math.round(w * paint);
  let s = 17; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const pts: string[] = []; let x = w * 0.10, y = h * 0.16;
  while (y < h * 0.9) { pts.push(`${x.toFixed(1)},${y.toFixed(1)}`); x += (rnd() - 0.42) * 46; y += 18 + rnd() * 34; }
  const branch: string[] = []; let bx = w * 0.17, by = h * 0.47;
  for (let k = 0; k < 7; k++) { branch.push(`${bx.toFixed(1)},${by.toFixed(1)}`); bx += 16 + rnd() * 22; by += (rnd() - 0.3) * 26; }
  return `<defs>
   <filter id="p" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency=".011 .014" numOctaves="5" seed="11" result="n"/>
    <feDiffuseLighting in="n" surfaceScale="4.2" lighting-color="#e3e5e9" result="l"><feDistantLight azimuth="200" elevation="42"/></feDiffuseLighting>
    <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="g"/>
    <feColorMatrix in="g" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0" result="gm"/>
    <feComposite in="gm" in2="l" operator="over"/>
   </filter>
   <filter id="q" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency=".03 .12" numOctaves="3" seed="23" result="n"/>
    <feDiffuseLighting in="n" surfaceScale=".55" lighting-color="#f3f5f8" result="l"><feDistantLight azimuth="200" elevation="62"/></feDiffuseLighting>
   </filter>
   <filter id="e" x="-20%" y="-5%" width="140%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency=".035 .6" numOctaves="3" seed="8" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="34" xChannelSelector="R" yChannelSelector="G"/>
   </filter>
   <mask id="c" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><rect x="${px}" y="-40" width="${w - px + 80}" height="${h + 80}" fill="#fff" filter="url(#e)"/></mask>
   <linearGradient id="v" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9ec0ff" stop-opacity=".10"/><stop offset=".55" stop-color="#0b1424" stop-opacity="0"/><stop offset="1" stop-color="#050a14" stop-opacity=".42"/></linearGradient>
   <radialGradient id="s" cx=".78" cy=".2" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${w}" height="${h}" filter="url(#p)"/>
  <rect width="${w}" height="${h}" fill="#7f8896" opacity=".12" style="mix-blend-mode:multiply"/>
  ${crack ? `<polyline points="${pts.join(' ')}" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2" transform="translate(1.6 1.4)"/>
  <polyline points="${pts.join(' ')}" fill="none" stroke="#1b1a1a" stroke-width="2.6" stroke-linejoin="round"/>
  <polyline points="${branch.join(' ')}" fill="none" stroke="#1b1a1a" stroke-width="1.4" stroke-linejoin="round" opacity=".8"/>` : ''}
  ${paint < 1 ? `<g mask="url(#c)"><rect width="${w}" height="${h}" filter="url(#q)"/><rect width="${w}" height="${h}" fill="url(#s)"/></g>` : ''}
  <rect width="${w}" height="${h}" fill="url(#v)"/>`;
}

// ── Οι υποχρεώσεις της τέταρτης διαφάνειας ─────────────────────────────────
const DUES: [string, string, string, string, number][] = [
  ['wa', 'Εκκαθαριστικό ΕΝΦΙΑ', '«Το άνοιξα και το ξανάκλεισα.»', 'Ανοιχτό', -2.2],
  ['rd', 'Δήλωση ακινήτων (Ε9)', '«Θα τη δούμε του χρόνου.»', 'Εκκρεμεί', 1.6],
  ['rd', 'Φορολογική δήλωση', '«Μάλλον σωστή είναι.»', 'Χωρίς έλεγχο', -1.2],
  ['wa', 'Κοινόχρηστα', '«Κάπου πιο πάνω στο Viber.»', 'Χαμένα', 2],
];
const TONE = { wa: '#f0c97d', rd: '#ff8f8f', ok: '#5fd4a8', bl: '#9ec0ff' } as const;
const CONDS: [boolean, string][] = [
  [true, 'Τιμολόγιο στο ΑΦΜ σου'], [true, 'Ηλεκτρονική πληρωμή'],
  [true, `Υλικά έως ${SHARE} της εργασίας`], [false, 'Η δουλειά που κάνεις μόνος'],
];

const ZIG = 'polygon(0 0,100% 0,' + Array.from({ length: 29 }, (_, k) => {
  const x = 100 - (k + 0.5) * (100 / 28.5);
  return `${Math.round(Math.max(x, 0) * 100) / 100}% calc(100% - ${k % 2 ? 0 : 12}px)`;
}).join(',') + ',0 calc(100% - 12px))';

const RECEIPT: [string, string][] = [
  ['Διαμέρισμα, κλειστό για μήνες', '35 τ.μ.'],
  ['Τρίψιμο, σοβάτισμα, βάψιμο', '3 μήνες'],
  ['Συνεργείο', 'οι γονείς'],
  ['Σαββατοκύριακα ελεύθερα', '0'],
  ['Βουτιές, Ιούλιος και Αύγουστος', '0'],
];

/** Κεφαλίδα σκηνής: μάτι και τίτλος, κάθε γραμμή από τη δική της μάσκα. */
const head = (i: number, eyebrow: string, lines: string[], size: number, top = 360) => `
    <div class="L eb mono" id="e${i}" style="top:${top - 40}px"><i></i>${esc(eyebrow)}</div>
    <div class="L hd" style="top:${top}px;font-size:${size}px">${lines.map((l, k) => mask(`h${i}_${k}`, l)).join('')}</div>`;
const A = (s: string) => `<span class="a">${esc(s)}</span>`;

function html(T: Record<string, string>): string {
  const D = {
    S: SCENES, O: ORIGIN, years: RENO_39B_YEARS, nDues: DUES.length,
    // Ο μετρητής ανεβαίνει ανά 100€: κάθε ενδιάμεσο ποσό μορφοποιείται εδώ, με το eur της εφαρμογής.
    cnt: Array.from({ length: RENO_39B_CAP / 100 + 1 }, (_, k) => eur(k * 100)),
    heads: [3, 3, 2, 4, 3],
  };
  const tape = `<div class="tape"><div class="fib"></div><div class="mono tt">ΙΟΥΝΙΟΣ · 35 τ.μ. · ΚΛΕΙΣΤΟ ΜΗΝΕΣ</div></div>`;
  return `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${BASE_CSS}
  .eb{font-size:22px;color:${C.accent};display:flex;align-items:center;gap:16px;letter-spacing:.22em}
  .eb i{display:block;width:40px;height:2px;background:${C.accent}}
  .hd{font-weight:800;letter-spacing:-.045em;line-height:1.0;white-space:nowrap}
  .a{background:linear-gradient(95deg,#a9c8ff 0%,#5f9bff 60%,#3d7ef0 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
  .sub{font-size:40px;font-weight:700;letter-spacing:-.02em;line-height:1.25}
  .sub2{font-size:35px;font-weight:500;letter-spacing:-.015em;line-height:1.35;color:#aebbd0}
  .sub2 b{color:${C.ink};font-weight:700}
  .lbl{font-family:'Roboto Mono',monospace;font-size:17px;letter-spacing:.16em;color:#7d8da6}
  .card{position:absolute;border-radius:28px;background:linear-gradient(180deg,rgba(28,44,72,.96),rgba(14,24,42,.97));border:1px solid rgba(255,255,255,.12);
    box-shadow:0 40px 90px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.12)}
  .pill{font-size:22px;font-weight:650;padding:9px 20px;border-radius:99px;white-space:nowrap;display:inline-flex;align-items:center;gap:10px}
  .pill:before{content:'';width:10px;height:10px;border-radius:50%;background:currentColor}
  .p-wa{color:${TONE.wa};background:rgba(229,192,123,.15)} .p-rd{color:${TONE.rd};background:rgba(240,110,110,.14)}
  .p-ok{color:${TONE.ok};background:rgba(82,199,158,.14)} .p-bl{color:${TONE.bl};background:rgba(138,180,248,.15)}
  .row{display:flex;align-items:center;justify-content:space-between;gap:18px}

  /* Κεφαλίδα και πρόοδος */
  #top{position:absolute;left:90px;right:90px;top:262px;display:flex;align-items:center;justify-content:space-between}
  #top .br{display:flex;align-items:center;gap:14px;font-size:22px;font-weight:800;letter-spacing:.18em}
  #prog{display:flex;gap:8px}
  #prog i{display:block;width:34px;height:5px;border-radius:3px;background:#ffffff22;position:relative;overflow:hidden}
  #prog b{position:absolute;inset:0;background:${C.accent};transform-origin:left center;transform:scaleX(0);box-shadow:0 0 12px ${C.accent}}
  #dust i{position:absolute;border-radius:50%;background:#dbe7ff;filter:blur(1.2px)}

  /* 1 · Το άγκιστρο */
  #wh{position:absolute;left:0;top:800px;width:1080px;height:1120px;overflow:hidden;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 24%)}
  #wh img{position:absolute;left:0;top:0;width:1080px;height:1120px;transform-origin:30% 55%;filter:brightness(.8) contrast(1.06)}
  #wh .shade{position:absolute;inset:0;background:radial-gradient(640px 460px at 18% 100%,rgba(5,10,20,.8),transparent),linear-gradient(0deg,rgba(7,11,18,.55),transparent 40%)}
  .sheen{position:absolute;top:-200px;width:420px;height:1600px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.16),transparent);transform:rotate(16deg);mix-blend-mode:screen}
  .tape{position:relative;display:inline-block;width:700px;white-space:nowrap;padding:20px 32px 18px;
    background:linear-gradient(180deg,rgba(236,226,196,.97),rgba(220,208,174,.97));box-shadow:0 14px 30px rgba(0,0,0,.5);
    clip-path:polygon(1% 4%,8% 0,22% 5%,40% 1%,61% 4%,80% 0,99% 5%,100% 92%,93% 100%,70% 95%,48% 100%,27% 96%,6% 100%,0 95%)}
  .tape .fib{position:absolute;inset:0;background-image:url(${T.FIBRE});background-size:300px;opacity:.35;mix-blend-mode:multiply}
  .tape .tt{position:relative;font-size:23px;font-weight:600;letter-spacing:.14em;color:#2a2b2f}

  /* 2 · Η απόδειξη */
  #slot{position:absolute;left:120px;top:690px;width:840px;height:24px;border-radius:12px;background:#02050a;
    box-shadow:inset 0 3px 8px #000, 0 1px 0 #ffffff1c, 0 0 40px ${C.accent}22}
  #rcClip{position:absolute;left:150px;top:702px;width:780px;overflow:hidden}
  #rc{position:relative;width:780px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.4)) drop-shadow(0 30px 40px rgba(0,0,0,.5))}
  .paper{position:relative;background:#f6f6f2;clip-path:${ZIG};padding:42px 50px 128px;font-family:'Roboto Mono',monospace;color:#23272e;font-size:23px;font-weight:500}
  .paper .fib{position:absolute;inset:0;background-image:url(${T.FIBRE});background-size:300px;opacity:.22}
  .paper .lit{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.07),transparent 9%,transparent 88%,rgba(0,0,0,.06)),linear-gradient(180deg,rgba(255,255,255,.5),transparent 20%)}
  .paper .in{position:relative;opacity:.94}
  .paper .rr{display:flex;justify-content:space-between;align-items:baseline;gap:20px;padding:7px 0;position:relative}
  .paper .rr span:last-child{text-align:right;white-space:nowrap}
  .paper .dots{margin:12px 0;border-top:2px dashed rgba(30,34,40,.5)}
  .hil{position:absolute;left:-10px;right:-10px;top:4px;bottom:2px;border-radius:4px;background:linear-gradient(90deg,rgba(255,214,90,.55),rgba(255,214,90,.42));transform-origin:left center;mix-blend-mode:multiply}
  #stamp{position:absolute;left:48px;bottom:40px;border:4px solid #b0242d;border-radius:8px;padding:8px 16px;color:#b0242d;font-weight:600;font-size:29px;letter-spacing:.2em;
    mix-blend-mode:multiply;-webkit-mask-image:url(${T.INK});-webkit-mask-size:400px 140px}
  #head{position:absolute;left:150px;width:780px;height:3px;background:linear-gradient(90deg,transparent,${C.accent},transparent);box-shadow:0 0 26px 6px ${C.accent}66}

  /* 3 · Ο τοίχος */
  #wl{position:absolute;left:90px;top:720px;width:900px;height:720px;border-radius:30px;overflow:hidden;
    box-shadow:0 50px 100px rgba(0,0,0,.6),inset 0 0 0 1px rgba(255,255,255,.1)}
  #wl img{position:absolute;left:0;top:0;width:900px;height:720px}
  #wet{position:absolute;top:0;bottom:0;width:220px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.22));mix-blend-mode:screen}
  .wtag{position:absolute;top:752px;font-family:'Roboto Mono',monospace;font-size:18px;letter-spacing:.16em;color:#20242b;background:rgba(240,242,245,.9);padding:9px 15px;border-radius:9px}
  #roller{position:absolute;left:0;top:0;width:240px;height:330px}
  #roller .cyl{position:absolute;left:0;top:0;width:240px;height:80px;border-radius:40px;overflow:hidden;
    background:linear-gradient(180deg,#ffffff 0%,#eef1f5 30%,#cfd5dd 70%,#a9b1bc 100%);box-shadow:0 16px 30px rgba(0,0,0,.45)}
  #roller .cyl .fib{position:absolute;inset:0;background-image:url(${T.FIBRE});background-size:200px;opacity:.5;mix-blend-mode:multiply}
  #roller .cyl .nap{position:absolute;inset:0;background:repeating-linear-gradient(180deg,rgba(0,0,0,.05) 0 3px,transparent 3px 7px)}
  #roller .cap{position:absolute;top:28px;width:14px;height:24px;border-radius:5px;background:#5b6573}
  #roller .rod{position:absolute;left:247px;top:36px;width:44px;height:150px;border:7px solid #8b95a3;border-left:0;border-radius:0 26px 26px 0}
  #roller .hdl{position:absolute;left:236px;top:176px;width:42px;height:150px;border-radius:21px;background:linear-gradient(90deg,#1c2533,#3a4659 50%,#1c2533);box-shadow:0 20px 30px rgba(0,0,0,.5)}

  /* 4 · Οι υποχρεώσεις */
  .due{width:790px;height:132px;padding:0 30px}
  .due .ic{flex:none;width:60px;height:60px;border-radius:16px;display:grid;place-items:center}
  .due .doc{width:25px;height:31px;border-radius:4px;border:3px solid currentColor;position:relative}
  .due .doc:after{content:'';position:absolute;left:4px;right:4px;top:6px;height:3px;background:currentColor;box-shadow:0 7px 0 currentColor}
  .due .t{font-size:30px;font-weight:700;letter-spacing:-.018em}
  .due .q{margin-top:6px;font-size:25px;color:#9aa8bd;font-style:italic;letter-spacing:-.01em}

  /* 5 · Η ειρωνεία */
  .big{font-size:110px;font-weight:800;letter-spacing:-.05em;line-height:.9;white-space:nowrap}
  .bars{display:flex;gap:16px;margin-top:26px}
  .bars .b{flex:1;display:flex;flex-direction:column;align-items:center;gap:12px}
  .bars .col{width:100%;height:150px;display:flex;align-items:flex-end}
  .bars .fill{width:100%;height:100%;border-radius:12px 12px 4px 4px;background:linear-gradient(180deg,#5f9bff,#1560d4);transform-origin:bottom center;
    box-shadow:0 10px 30px rgba(21,96,212,.45),inset 0 1px 0 rgba(255,255,255,.35);display:flex;justify-content:center;padding-top:16px}
  .bars .fill span{font-size:23px;font-weight:750;color:#fff}
  .cond{display:flex;align-items:center;gap:16px;padding:12px 0}
  .cond .dt{flex:none;width:42px;height:42px;border-radius:50%;display:grid;place-items:center}
  .cond .tx{font-size:23px;font-weight:600;letter-spacing:-.012em}
  .src{font-family:'Roboto Mono',monospace;font-size:16px;line-height:1.5;color:#7d8da6;width:820px}

  /* 6 · Το προϊόν */
  #stage3d{position:absolute;left:0;top:0;width:1080px;height:1920px;perspective:2200px;perspective-origin:25% 50%}
  #phone{position:absolute;left:90px;top:680px;width:400px;height:800px;border-radius:64px;padding:14px;
    background:linear-gradient(145deg,#3a4558,#141b27 40%,#2b3446);box-shadow:0 70px 130px rgba(0,0,0,.7),inset 0 0 0 2px rgba(255,255,255,.08)}
  .scr{position:relative;width:100%;height:100%;border-radius:52px;overflow:hidden;background:#0a111d}
  .isl{position:absolute;left:50%;top:14px;width:118px;height:34px;margin-left:-59px;border-radius:20px;background:#000;z-index:3}
  .cam{position:absolute;left:0;right:0;top:0;height:470px;background:radial-gradient(320px 280px at 50% 55%,#3b4a62,#141c2a)}
  .bill{position:absolute;left:62px;top:110px;width:250px;height:290px;background:#eef0f3;border-radius:6px;padding:20px;box-shadow:0 14px 30px rgba(0,0,0,.45)}
  .bill .fib{position:absolute;inset:0;background-image:url(${T.FIBRE});background-size:300px;opacity:.2;border-radius:6px}
  .bill .bt{position:relative;font-size:13px;font-weight:800;color:#1a2332;letter-spacing:.06em}
  .bill i{display:block;position:relative;margin-top:14px;height:7px;border-radius:4px;background:#bcc4cf}
  .vfc{position:absolute;width:46px;height:46px;border-color:${C.accent};border-style:solid;border-width:0}
  #beam{position:absolute;left:30px;right:30px;height:3px;background:linear-gradient(90deg,transparent,${C.accent},transparent);box-shadow:0 0 24px 6px rgba(138,180,248,.55)}
  #sheet{position:absolute;left:0;right:0;bottom:0;height:330px;border-radius:30px 30px 0 0;background:linear-gradient(180deg,#16233a,#0e1729);border-top:1px solid rgba(255,255,255,.1);padding:22px 26px}
  #sheet .grab{width:48px;height:5px;border-radius:3px;background:rgba(255,255,255,.2);margin:0 auto 18px}
  #sheet .kv{display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid rgba(255,255,255,.08);font-size:18px}
  #sheet .kv span:first-child{color:#8a98ad}
  #btn{margin-top:12px;height:52px;border-radius:16px;background:linear-gradient(180deg,#3d7ef0,#1560d4);display:grid;place-items:center;font-size:20px;font-weight:700;box-shadow:0 10px 24px rgba(21,96,212,.5)}
  .step{position:absolute;left:530px;display:flex;align-items:center;gap:18px}
  .step .n{flex:none;width:50px;height:50px;border-radius:50%;display:grid;place-items:center;border:2px solid rgba(138,180,248,.5);font-family:'Roboto Mono',monospace;font-size:20px;color:#9ec0ff}
  .step .s{font-size:28px;font-weight:650;letter-spacing:-.015em}
  #fold{left:530px;top:1000px;width:410px;padding:28px 28px 18px}
  .ln{display:flex;align-items:center;gap:12px;padding:13px 0;border-top:1px solid rgba(255,255,255,.08)}
  .ln:first-child{border-top:0}
  .ln .dt{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:rgba(82,199,158,.16)}
  .ln .v{font-size:21px;font-weight:650;letter-spacing:-.02em;line-height:1.25}

  /* 7 · Το όραμα και η μάρκα */
  .vw{display:inline-block;margin-right:.24em;will-change:transform,filter,opacity}
  #vis .a{background-size:200% 100%}
  .ctr{position:absolute;left:150px;right:150px;display:flex;justify-content:center;text-align:center}
  .word{font-size:96px;font-weight:800;letter-spacing:.02em}
  .tag{font-size:54px;font-weight:700;letter-spacing:-.03em}
  .rule{width:64px;height:3px;border-radius:3px;background:${C.accent}}
  .url{font-size:24px;color:${C.faint}}
  #bloom{position:absolute;left:50%;top:860px;width:1300px;height:1300px;margin:-650px 0 0 -650px;border-radius:50%;
    background:radial-gradient(closest-side, ${C.accent}44, transparent);opacity:0}
  </style></head><body>
  <div id="bg"></div>
  <div id="dust" class="deco">${Array.from({ length: 22 }, (_, k) => `<i id="d${k}"></i>`).join('')}</div>

  <div id="top"><div class="br">${mark(34, C.ink)}<span>PROPERWISE</span></div><div id="prog">${SCENES.map((_, k) => `<i><b id="pb${k}"></b></i>`).join('')}</div></div>

  <!-- 1 · «Τι τον θες τον μάστορα;» -->
  <section id="s0">
    <div id="wh" class="deco"><img id="whi" src="${T.WALL_HOOK}"><div class="sheen" id="sh0"></div><div class="shade"></div></div>
    <div class="L eb mono" id="e0" style="top:320px"><i></i>ΠΩΣ ΞΕΚΙΝΗΣΕ ΤΟ PROPERWISE</div>
    <div class="L hd" style="top:370px;font-size:116px">
      <div style="display:flex;gap:.24em">${mask('q0', '«Τι')}${mask('q1', 'τον')}${mask('q2', 'θες')}</div>
      ${mask('q3', A('τον μάστορα;»'))}
    </div>
    <div class="L sub" id="c0" style="top:636px">Μόνοι μας θα το κάνουμε.</div>
    <div class="L sub2" id="c1" style="top:700px;width:860px">Αν μεγάλωσες στην Ελλάδα, σίγουρα έχεις ακούσει αυτή τη φράση.</div>
    <div class="L" id="tp" style="top:1320px">${tape}</div>
  </section>

  <!-- 2 · Η απόδειξη του καλοκαιριού -->
  <section id="s1">
    ${head(1, 'Ο ΛΟΓΑΡΙΑΣΜΟΣ ΕΝΟΣ ΚΑΛΟΚΑΙΡΙΟΥ', ['Γλιτώσαμε', 'τον μάστορα.', A('Πληρώσαμε αλλιώς.')], 84)}
    <div id="rcClip"><div id="rc"><div class="paper">
      <div class="fib"></div><div class="lit"></div>
      <div class="in">
        <div style="text-align:center;font-size:29px;font-weight:600;letter-spacing:.32em">ΑΠΟΔΕΙΞΗ</div>
        <div style="text-align:center;font-size:17px;letter-spacing:.16em;margin-top:8px;opacity:.7">ΤΟ ΚΑΛΟΚΑΙΡΙ ΤΟΥ ΔΙΑΜΕΡΙΣΜΑΤΟΣ</div>
        <div class="dots"></div>
        ${RECEIPT.map(([k, v]) => `<div class="rr"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}
        <div class="dots"></div>
        <div class="rr"><b>ΓΛΙΤΩΣΑΜΕ</b><b>300 με 400€</b></div>
        <div class="rr"><i class="hil deco" id="hil"></i><b style="position:relative">ΚΟΣΤΙΣΕ</b><b style="position:relative">ένα καλοκαίρι</b></div>
        <div style="text-align:right;font-weight:600;color:#a3242c;padding-top:4px"><span id="gyps" style="display:inline-block">+ ένα χέρι στον γύψο</span></div>
      </div>
      <div id="stamp">ΕΞΟΦΛΗΘΗΚΕ</div>
    </div></div></div>
    <div id="slot" class="deco"></div>
    <div id="head" class="deco"></div>
  </section>

  <!-- 3 · Ο τοίχος συγχωρεί -->
  <section id="s2">
    ${head(2, 'Ο ΤΟΙΧΟΣ', ['Ο τοίχος συγχωρεί', 'ένα λάθος.', A('Τον ξαναβάφεις.')], 84)}
    <div id="wl" class="deco"><img src="${T.WALL_BARE}"><img id="wp" src="${T.WALL_PAINT}"><div id="wet"></div></div>
    <div class="wtag" id="tb" style="left:120px">ΠΡΙΝ · Η ΡΩΓΜΗ</div>
    <div class="wtag" id="ta" style="right:120px">ΜΕΤΑ · ΕΝΑ ΧΕΡΙ ΜΠΟΓΙΑ</div>
    <div id="roller" class="deco"><div class="cyl"><div class="fib"></div><div class="nap"></div></div><span class="cap" style="left:-8px"></span><span class="cap" style="left:234px"></span><div class="rod"></div><div class="hdl"></div></div>
  </section>

  <!-- 4 · Οι υποχρεώσεις δεν ξαναβάφονται -->
  <section id="s3">
    ${head(3, 'ΟΙ ΥΠΟΧΡΕΩΣΕΙΣ', ['Οι υποχρεώσεις', A('δεν ξαναβάφονται.')], 86)}
    ${DUES.map(([k, t, q, st], i) => `<div class="card due row" id="du${i}" style="left:${90 + (i % 2 ? 50 : 0)}px;top:${640 + i * 158}px;z-index:${i + 1}">
      <div style="display:flex;align-items:center;gap:22px">
        <div class="ic" style="color:${TONE[k as 'wa' | 'rd']};background:${k === 'rd' ? 'rgba(240,110,110,.14)' : 'rgba(229,192,123,.14)'}"><div class="doc"></div></div>
        <div><div class="t">${esc(t)}</div><div class="q">${esc(q)}</div></div>
      </div>
      <span class="pill p-${k}" id="pl${i}">${esc(st)}</span>
    </div>`).join('')}
    <div class="L sub2" id="c3" style="top:1300px;width:820px">Εκεί το «θα το κάνω μόνος» δεν γλιτώνει τίποτα. <b>Το πληρώνεις αργότερα.</b></div>
  </section>

  <!-- 5 · Η ειρωνεία -->
  <section id="s4">
    ${head(4, 'Η ΕΙΡΩΝΕΙΑ', ['Ο μάστορας', 'που γλιτώσαμε', A('θα γύριζε ως'), A('μείωση φόρου.')], 72)}
    <div class="card" id="ka" style="left:90px;top:700px;width:850px;padding:28px 36px 26px">
      <div class="row"><div class="lbl">ΑΝΑΚΑΙΝΙΣΗ · ΜΕΙΩΣΗ ΦΟΡΟΥ</div><span class="pill p-bl">έως ${esc(RENO_39B_TO)}</span></div>
      <div style="display:flex;align-items:flex-end;gap:26px;margin-top:16px">
        <div class="big a" id="cnt">${eur(RENO_39B_CAP)}</div>
        <div style="font-size:24px;line-height:1.3;color:#aebbd0;padding-bottom:6px" id="cntx">μείωση ίση με τη δαπάνη,<br>για όλα τα έτη μαζί</div>
      </div>
      <div class="bars">${Array.from({ length: RENO_39B_YEARS }, (_, k) => `<div class="b"><div class="col"><div class="fill" id="bf${k}"><span id="bv${k}">${eur(RENO_39B_PER_YEAR)}</span></div></div><div class="lbl" style="font-size:16px" id="by${k}">ΕΤΟΣ ${k + 1}</div></div>`).join('')}</div>
      <div style="margin-top:14px;font-size:23px;color:#aebbd0" id="kl">Ισόποσα σε ${RENO_39B_YEARS} έτη, <b style="color:${C.ink}">ποτέ πάνω από τον φόρο της χρονιάς.</b></div>
    </div>
    <div class="card" id="kb" style="left:90px;top:1160px;width:850px;padding:14px 34px;display:grid;grid-template-columns:1fr 1fr;column-gap:24px">
      ${CONDS.map(([ok, t], k) => `<div class="cond" id="cd${k}"><div class="dt" style="background:${ok ? 'rgba(82,199,158,.16)' : 'rgba(240,110,110,.16)'}">${ok ? ico.check(TONE.ok, 24) : `<span style="color:${TONE.rd};font-size:28px;font-weight:800;line-height:1">×</span>`}</div><div class="tx" style="color:${ok ? '#e6ecf5' : '#ffb3b3'}">${esc(t)}</div></div>`).join('')}
    </div>
    <div class="L src" id="src" style="top:1330px">Πηγή: ${esc(RENO_39B_LAW)} · ${esc(RENO_39B_KYA)}</div>
  </section>

  <!-- 6 · Φάκελος, όχι screenshots -->
  <section id="s5">
    ${head(5, 'ΕΤΣΙ ΞΕΚΙΝΗΣΕ ΤΟ PROPERWISE', ['Στον λογιστή', 'με φάκελο,', A('όχι με screenshots.')], 80)}
    <div id="stage3d" class="deco"><div id="phone"><div class="scr">
      <div class="isl"></div>
      <div class="cam">
        <div class="bill" id="bill"><div class="fib"></div><div class="bt">ΛΟΓΑΡΙΑΣΜΟΣ ΡΕΥΜΑΤΟΣ</div>${[86, 62, 74, 48, 80, 56].map(w => `<i style="width:${w}%"></i>`).join('')}
          <div style="position:absolute;right:20px;bottom:26px;width:96px;height:30px;border-radius:6px;background:#d3d9e1"></div></div>
        ${[[0, 0], [1, 0], [0, 1], [1, 1]].map(([cx, cy], k) => `<div class="vfc" id="vf${k}" style="${cx ? 'right' : 'left'}:34px;top:${cy ? 404 : 80}px;border-${cy ? 'bottom' : 'top'}-width:4px;border-${cx ? 'right' : 'left'}-width:4px;border-${cy ? 'bottom' : 'top'}-${cx ? 'right' : 'left'}-radius:14px"></div>`).join('')}
        <div id="beam"></div>
      </div>
      <div id="sheet">
        <div class="grab"></div>
        <div class="row"><div class="lbl" style="font-size:13px">ΔΙΑΒΑΣΤΗΚΕ</div><span class="pill p-ok" style="font-size:15px;padding:5px 12px">Έλεγξε</span></div>
        <div style="margin-top:12px;font-size:24px;font-weight:700;letter-spacing:-.015em">Λογαριασμός ρεύματος</div>
        ${[['Κατηγορία', 'Ενέργεια'], ['Ακίνητο', 'Το διαμέρισμα'], ['Πληρωμή', 'Ηλεκτρονική']].map(([k, v], i) => `<div class="kv" id="kv${i}"><span>${k}</span><span style="font-weight:600">${v}</span></div>`).join('')}
        <div id="btn">Στο σωστό ακίνητο</div>
      </div>
    </div></div></div>
    ${['Φωτογραφίζεις', 'Ελέγχεις με μια ματιά', 'Μπαίνει στη θέση του'].map((t, i) => `<div class="step" id="st${i}" style="top:${700 + i * 92}px"><div class="n" id="sn${i}">${i + 1}</div><div class="s">${esc(t)}</div></div>`).join('')}
    <div class="card" id="fold">
      <div class="row"><div class="lbl">ΦΑΚΕΛΟΣ ΛΟΓΙΣΤΗ</div><span class="pill p-ok" id="rdy" style="font-size:19px;padding:7px 15px">Έτοιμος</span></div>
      <div style="margin-top:12px;font-size:29px;font-weight:700;letter-spacing:-.018em">Φορολογική χρονιά</div>
      <div style="margin-top:12px">
        ${['Ενοίκια και έξοδα', 'Παραστατικά ανά κατηγορία', 'Τι λείπει, πριν σου το ζητήσει'].map((t, i) => `<div class="ln" id="fl${i}"><div class="dt">${ico.check(TONE.ok, 22)}</div><div class="v">${esc(t)}</div></div>`).join('')}
      </div>
    </div>
  </section>

  <!-- 7 · Το όραμα -->
  <section id="s6">
    <div id="bloom" class="deco"></div>
    <div class="L eb mono" id="e6" style="top:560px"><i></i>ΤΟ ΟΡΑΜΑ</div>
    <div class="L hd" id="vis" style="top:620px;font-size:84px;line-height:1.06">
      ${[['Κάθε', 'ιδιοκτήτης'], ['να', 'έχει'], ['τον', 'πλήρη', 'έλεγχο'], ['της', 'περιουσίας', 'του.']]
        .map((ws, li) => `<div>${ws.map((w, k) => `<span class="vw${li >= 2 ? ' a' : ''}" id="v${li}_${k}">${esc(w)}</span>`).join('')}</div>`).join('')}
    </div>
  </section>

  <!-- Η μάρκα -->
  <section id="EN">
    <div class="ctr" id="m0" style="top:600px">${mark(150, C.ink)}</div>
    <div class="ctr" style="top:802px">${mask('m1', 'PROPERWISE', 'word')}</div>
    <div class="ctr" id="m2" style="top:945px"><span class="rule"></span></div>
    <div class="ctr" style="top:988px">${mask('m3', esc(TAGLINE), 'tag')}</div>
    <div class="ctr mono url" id="m4" style="top:1082px;color:${C.muted}">ΓΙΑ ΚΑΘΕ ΙΔΙΟΚΤΗΤΗ ΑΚΙΝΗΤΟΥ ΣΤΗΝ ΕΛΛΑΔΑ</div>
    <div class="ctr mono url" id="m5" style="top:1170px">PROPERWISE.GR</div>
  </section>

  <div class="vig"></div><div class="grain"></div>
  <script>
  const D = ${JSON.stringify(D)};
  const S = D.S, O = D.O;
  ${MOTION_JS}
  ${BG_JS}
  const ends = [...S.slice(1), O.end];

  // Πέρασμα σκηνής: η παλιά απομακρύνεται και θολώνει, η νέα έρχεται από
  // λίγο πιο κοντά και καθαρίζει. Επικάλυψη ενός δεκάτου: κανένα μαύρο καρέ.
  const scene = (id, a, b) => {
    const el = $(id);
    const i = eo(p(T, a - .12, a + .42)), o = ei(p(T, b - .32, b + .02));
    const on = T >= a - .12 && T < b + .02;
    op(el, on ? i * (1 - o) : 0);
    if (!on) return T - a;
    const push = p(T, a, b);
    el.style.transformOrigin = '540px 900px';
    tf(el, 'scale(' + ((1.05 - .05 * i) * (1 - .04 * o) * (1 + .012 * push)) + ')');
    const bl = (1 - i) * 10 + o * 8;
    el.style.filter = bl > .05 ? 'blur(' + bl.toFixed(2) + 'px)' : 'none';
    return T - a;
  };
  const heads = (k, a) => {
    const e = $('e' + k), v = eo(p(T, a + .02, a + .45));
    op(e, v); tf(e, 'translateX(' + (-24 * (1 - v)) + 'px)');
    for (let j = 0; j < D.heads[k - 1]; j++) rev('h' + k + '_' + j, a + .1 + j * .11, null, .6);
  };
  const pop = (id, s, d) => { const v = spring(p(T, s, s + (d || .7))); op($(id), cl(v * 1.6)); return v; };

  window.render = t => {
    T = t;
    bgPaint(t);

    // Σκόνη στο φως: αργή, με βάθος· κάθε κόκκος στη δική του τροχιά.
    for (let k = 0; k < 22; k++) {
      const d = $('d' + k), z = .4 + (k * 37 % 10) / 10, sz = 2 + z * 4;
      const x = (k * 173 % 1000) + 40 + Math.sin(t * .3 * z + k) * 40;
      const y = ((k * 251 % 1500) + 300 - t * 14 * z + 3000) % 1500 + 260;
      d.style.width = d.style.height = sz + 'px';
      tf(d, 'translate(' + x + 'px,' + y + 'px)');
      op(d, (.10 + .22 * z) * (.6 + .4 * Math.sin(t * 1.3 + k * 2)));
    }

    // Κεφαλίδα και πρόοδος, ως το όραμα.
    const tv = eo(p(t, .1, .6)) * (1 - eo(p(t, O.vision - .3, O.vision + .2)));
    op($('top'), tv);
    S.forEach((s, k) => tf($('pb' + k), 'scaleX(' + p(t, s, ends[k]) + ')'));

    // ── 1 · Το άγκιστρο ─────────────────────────────────────────────────
    let u = scene('s0', -1, S[1]);
    { const e = $('e0'), v = eo(p(t, .05, .5)); op(e, v); tf(e, 'translateX(' + (-24 * (1 - v)) + 'px)'); }
    [.15, .27, .39].forEach((s, k) => rev('q' + k, s, null, .5));
    rev('q3', .62, null, .6);
    [[1.3, 'c0'], [1.85, 'c1']].forEach(([s, id]) => { const v = eo(p(t, s, s + .55)); op($(id), v); tf($(id), 'translateY(' + (26 * (1 - v)) + 'px)'); $(id).style.filter = v < .99 ? 'blur(' + ((1 - v) * 8).toFixed(2) + 'px)' : 'none'; });
    const wi = eo(p(t, 0, 1.4));
    op($('wh'), wi);
    tf($('whi'), 'translateY(' + (60 * (1 - wi)) + 'px) scale(' + (1.02 + .06 * p(t, 0, S[1])) + ')');
    $('sh0').style.left = (-500 + 1700 * eio(p(t, .9, 2.6))) + 'px';
    { const v = spring(p(t, 2.45, 3.2)); op($('tp'), cl(v * 2)); tf($('tp'), 'rotate(' + (-3 - 6 * (1 - v)) + 'deg) scale(' + (1.35 - .35 * v) + ')'); }

    // ── 2 · Η απόδειξη ──────────────────────────────────────────────────
    u = scene('s1', S[1], S[2]);
    heads(1, S[1]);
    // Τυπώνεται με τα βηματάκια του θερμικού εκτυπωτή: πάει, σταματά, πάει.
    const PH = $('rc').offsetHeight;
    const raw = eio(p(u, .45, 2.55)), st = raw * 26, q = (Math.floor(st) + eo(cl((st - Math.floor(st)) * 2.6))) / 26;
    $('rcClip').style.height = Math.max(0, q * PH) + 'px';
    op($('slot'), eo(p(u, .1, .4)));
    op($('head'), u > .45 && u < 2.6 ? 1 : 0);
    $('head').style.top = (702 + q * PH - 2) + 'px';
    tf($('rc'), 'rotate(' + (Math.sin(u * 2.2) * .5 * (1 - eo(p(u, 2.5, 3.2)))) + 'deg)');
    tf($('hil'), 'scaleX(' + eio(p(u, 2.75, 3.15)) + ')');
    // Η σφραγίδα: πέφτει από ψηλά, χτυπά, το χαρτί τινάζεται.
    const sp = p(u, 3.35, 3.55), sv = ei(sp);
    op($('stamp'), sp > 0 ? .86 : 0);
    tf($('stamp'), 'rotate(-6deg) scale(' + (2.3 - 1.3 * sv) + ')');
    const shake = u > 3.55 ? Math.exp(-(u - 3.55) * 14) * Math.sin((u - 3.55) * 70) * 7 : 0;
    $('rcClip').style.transform = 'translate(' + shake + 'px,' + (shake * .5) + 'px)';
    { const v = eio(p(u, 3.85, 4.45)); $('gyps').style.clipPath = 'inset(0 ' + (100 - 100 * v) + '% 0 0)'; }

    // ── 3 · Ο τοίχος ────────────────────────────────────────────────────
    u = scene('s2', S[2], S[3]);
    heads(2, S[2]);
    const wv = eo(p(u, 0, .5)); op($('wl'), wv); tf($('wl'), 'translateY(' + (60 * (1 - wv)) + 'px)');
    // Το ρολό: προχωρά δεξιά, ανεβοκατεβαίνει, αφήνει υγρή γυαλάδα πίσω του.
    const P = eio(p(u, .55, 2.75)), X = -60 + 1030 * P;
    $('wp').style.webkitMaskImage = 'linear-gradient(90deg,#000 ' + (X - 22) + 'px,transparent ' + (X + 22) + 'px)';
    $('wet').style.left = (X - 210) + 'px';
    op($('wet'), (u > .55 ? 1 : 0) * (1 - eo(p(u, 2.75, 3.4))));
    const rin = eo(p(u, .35, .7)), rout = ei(p(u, 2.75, 3.15));
    op($('roller'), rin * (1 - rout));
    const ry = 720 + 250 + Math.sin((u - .55) * 7.5) * 170 * p(u, .4, .9) - 40;
    tf($('roller'), 'translate(' + (90 + X - 120 + 260 * rout) + 'px,' + (ry - 120 * rout) + 'px) rotate(' + (Math.cos((u - .55) * 7.5) * 3) + 'deg)');
    // Η ετικέτα «πριν» φεύγει όταν τη φτάσει η μπογιά, όχι νωρίτερα.
    op($('tb'), eo(p(u, .3, .6)) * (1 - cl((X - 150) / 90)));
    { const v = spring(p(u, 2.55, 3.2)); op($('ta'), cl(v * 1.6)); tf($('ta'), 'translateY(' + (16 * (1 - v)) + 'px)'); }

    // ── 4 · Οι υποχρεώσεις ──────────────────────────────────────────────
    u = scene('s3', S[3], S[4]);
    heads(3, S[3]);
    for (let k = 0; k < D.nDues; k++) {
      const s = .5 + k * .42, v = spring(p(u, s, s + .8)), rot = [-2.2, 1.6, -1.2, 2][k];
      op($('du' + k), cl(v * 2.2));
      tf($('du' + k), 'translateY(' + (-110 * (1 - v)) + 'px) rotate(' + (rot + (k % 2 ? 9 : -9) * (1 - v)) + 'deg) scale(' + (1.08 - .08 * v) + ')');
      const pv = spring(p(u, s + .38, s + .96));
      const pulse = 1 + .06 * Math.max(0, Math.sin((u - 3.3) * 10.5)) * (u > 3.3 && u < 3.6 ? 1 : 0);
      tf($('pl' + k), 'scale(' + ((.3 + .7 * pv) * pulse) + ')'); op($('pl' + k), cl(pv * 2));
    }
    { const v = eo(p(u, 2.55, 3.1)); op($('c3'), v); tf($('c3'), 'translateY(' + (24 * (1 - v)) + 'px)'); }

    // ── 5 · Η ειρωνεία ──────────────────────────────────────────────────
    u = scene('s4', S[4], S[5]);
    heads(4, S[4]);
    { const v = eo(p(u, .3, .8)); op($('ka'), v); tf($('ka'), 'translateY(' + (60 * (1 - v)) + 'px)'); }
    const cv = eio(p(u, .55, 1.7));
    $('cnt').textContent = D.cnt[Math.round((D.cnt.length - 1) * cv)];
    op($('cntx'), eo(p(u, .9, 1.3)));
    for (let k = 0; k < D.years; k++) {
      const s = .96 + k * .13, v = spring(p(u, s, s + .75));
      tf($('bf' + k), 'scaleY(' + v + ')');
      op($('bv' + k), eo(p(u, s + .35, s + .6))); op($('by' + k), eo(p(u, s + .1, s + .4)));
    }
    op($('kl'), eo(p(u, 1.85, 2.25)));
    { const v = eo(p(u, 2.2, 2.65)); op($('kb'), v); tf($('kb'), 'translateY(' + (50 * (1 - v)) + 'px)'); }
    for (let k = 0; k < 4; k++) {
      const s = k < 3 ? 2.45 + k * .22 : 3.35, v = spring(p(u, s, s + .6));
      op($('cd' + k), cl(v * 2));
      const sh = k === 3 && u > 3.55 ? Math.exp(-(u - 3.55) * 9) * Math.sin((u - 3.55) * 60) * 9 : 0;
      tf($('cd' + k), 'translateX(' + (30 * (1 - v) + sh) + 'px)');
    }
    op($('src'), eo(p(u, 2.7, 3.1)));

    // ── 6 · Το προϊόν ───────────────────────────────────────────────────
    u = scene('s5', S[5], S[6]);
    heads(5, S[5]);
    const ph = eo(p(u, .05, 1.0));
    tf($('phone'), 'translateY(' + (760 * (1 - ph) + Math.sin(u * 1.4) * 6) + 'px) rotateX(' + (26 - 22 * ph) + 'deg) rotateY(' + (18 - 12 * ph) + 'deg) rotateZ(' + (-4 + 4 * ph) + 'deg)');
    const bs = eio(p(u, .75, 1.6));
    op($('beam'), u > .7 && u < 1.65 ? 1 : 0); $('beam').style.top = (90 + 330 * bs) + 'px';
    for (let k = 0; k < 4; k++) { const v = eo(p(u, .6, 1.0)); op($('vf' + k), v); tf($('vf' + k), 'scale(' + (1.25 - .25 * v) + ')'); }
    tf($('bill'), 'rotate(' + (-4 + 2 * eo(p(u, .6, 1.4))) + 'deg)');
    const sh2 = spring(p(u, 1.65, 2.45));
    tf($('sheet'), 'translateY(' + (340 * (1 - sh2)) + 'px)');
    for (let k = 0; k < 3; k++) op($('kv' + k), eo(p(u, 1.95 + k * .12, 2.3 + k * .12)));
    const press = p(u, 2.55, 2.75);
    tf($('btn'), 'scale(' + (1 - .05 * Math.sin(Math.PI * press)) + ')');
    $('btn').style.filter = press > 0 && press < 1 ? 'brightness(1.25)' : 'none';
    [.5, 1.65, 2.6].forEach((s, k) => {
      const v = eo(p(u, s, s + .3)), e = eo(p(u, .1 + k * .12, .5 + k * .12));
      op($('st' + k), e * (.42 + .58 * v)); tf($('st' + k), 'translateX(' + (30 * (1 - e)) + 'px)');
      const n = $('sn' + k);
      n.style.background = 'rgba(138,180,248,' + (.9 * v) + ')'; n.style.color = v > .5 ? '${C.onAccent}' : '#9ec0ff';
    });
    { const v = spring(p(u, 2.85, 3.6)); op($('fold'), cl(v * 1.8)); tf($('fold'), 'translateY(' + (70 * (1 - v)) + 'px) scale(' + (.94 + .06 * v) + ')'); }
    for (let k = 0; k < 3; k++) { const v = eo(p(u, 3.1 + k * .17, 3.45 + k * .17)); op($('fl' + k), v); tf($('fl' + k), 'translateX(' + (24 * (1 - v)) + 'px)'); }
    { const v = spring(p(u, 3.7, 4.3)); tf($('rdy'), 'scale(' + (.4 + .6 * v) + ')'); op($('rdy'), cl(v * 2)); }

    // ── 7 · Το όραμα: λέξη λέξη, από θολό σε καθαρό ─────────────────────
    u = scene('s6', S[6], O.end);
    { const e = $('e6'), v = eo(p(u, .05, .5)); op(e, v); tf(e, 'translateX(' + (-24 * (1 - v)) + 'px)'); }
    const W8 = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1], [2, 2], [3, 0], [3, 1], [3, 2]];
    W8.forEach(([l, k], j) => {
      const el = $('v' + l + '_' + k), s = .2 + j * .16, v = eo(p(u, s, s + .55));
      op(el, v); el.style.filter = v < .99 ? 'blur(' + ((1 - v) * 14).toFixed(2) + 'px)' : 'none';
      tf(el, 'translateY(' + (30 * (1 - v)) + 'px)');
      if (l >= 2) el.style.backgroundPosition = (100 - 100 * eio(p(u, 1.6, 3.2))) + '% 0';
    });
    op($('bloom'), .9 * eo(p(t, O.vision, O.vision + 1.6)) * (1 - .4 * eo(p(t, O.end, O.end + 1))));
    tf($('bloom'), 'scale(' + (.8 + .3 * eo(p(t, O.vision, O.end + 1))) + ')');

    // ── Η μάρκα ─────────────────────────────────────────────────────────
    op($('EN'), eo(p(t, O.end - .1, O.end + .25)));
    const m0 = spring(p(t, O.end, O.end + 1.1));
    op($('m0'), cl(m0 * 1.5)); tf($('m0'), 'scale(' + (.5 + .5 * m0) + ')');
    rev('m1', O.end + .3, null, .7); rev('m3', O.end + .8, null, .8);
    const q2 = eo(p(t, O.end + .55, O.end + 1.2)); op($('m2'), q2); tf($('m2'), 'scaleX(' + q2 + ')');
    op($('m4'), eo(p(t, O.end + .9, O.end + 1.3)));
    op($('m5'), eo(p(t, O.end + 1.1, O.end + 1.5)));
  };
  </script>
  </body></html>`;
}

// ── Η λεζάντα: η ανάρτηση του LinkedIn, κομμένη για βίντεο ─────────────────
const CAPTION = [
  '«Τι τον θες τον μάστορα; Μόνοι μας θα το κάνουμε.»',
  '',
  'Τον Ιούνιο ήρθε μια κληρονομιά: ένα διαμέρισμα τριάντα πέντε τετραγωνικών, κλειστό για μήνες. Τρεις μήνες, κάθε Σάββατο και Κυριακή, με τους γονείς για συνεργείο.',
  '',
  'Γλιτώσαμε τριακόσια με τετρακόσια ευρώ. Μας κόστισε ένα καλοκαίρι. Και ένα χέρι στον γύψο.',
  '',
  'Ο τοίχος συγχωρεί ένα λάθος. Τον ξαναβάφεις. Οι υποχρεώσεις όχι.',
  '',
  `Και η ειρωνεία: για ανακαίνιση ως τις ${RENO_39B_TO}, ο νόμος δίνει μείωση φόρου ίση με τη δαπάνη, ως ${eur(RENO_39B_CAP)} σε ${RENO_39B_YEARS} χρόνια. Αρκεί τιμολόγιο στο ΑΦΜ σου και ηλεκτρονική πληρωμή. Η δουλειά που κάνεις μόνος σου δεν μετρά.`,
  '',
  'Έτσι ξεκίνησε το PROPERWISE. Το όραμα: κάθε ιδιοκτήτης να έχει τον πλήρη έλεγχο της περιουσίας του.',
  '',
  'Εσύ τι έφτιαξες μόνος σου για να γλιτώσεις τον μάστορα; Και πόσο σου κόστισε τελικά;',
  '',
  `Πηγή: ${RENO_39B_LAW}, ${RENO_39B_KYA}.`,
  '',
  '#ακίνητα #ιδιοκτήτες #ανακαίνιση #PROPERWISE',
].join('\n');

async function main() {
  mkdirSync(OUT_DOC, { recursive: true });
  const T = await bake({
    FIBRE: [300, 300, noise('p', '.9', 3, 2, '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.1 0 0 0 -.42')],
    INK: [400, 140, noise('i', '.7', 2, 5, '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4.2 0 0 0 -1.05')],
    WALL_HOOK: [1080, 1120, wall(1080, 1120, .5)],
    WALL_BARE: [900, 720, wall(900, 720, 2)],
    WALL_PAINT: [900, 720, wall(900, 720, -.12)],
  });
  const O = ORIGIN;
  await shoot({
    html: html(T), dur: O.dur, outDir: OUT_VIDEO, file: 'reel.mp4', shutter: 2,
    checkAt: [3.9, O.receipt + 4.9, O.wall + 3.2, O.dues + 4.4, O.irony + 5.0, O.product + 4.5, O.vision + 3.2, O.dur - .2],
    // Το εξώφυλλο: η φράση, η απάντηση και η ταινία, όλα στη θέση τους.
    cover: { t: O.receipt - .45, path: join(OUT_DOC, 'cover.jpg') },
  });
  if (process.env.REEL_PREVIEW) return;
  writeFileSync(join(OUT_DOC, 'caption.md'), CAPTION + '\n');
  writeFileSync(join(OUT_DOC, 'README.md'), [
    '# Reel: «Πώς ξεκίνησε το PROPERWISE»',
    '',
    'Το δεύτερο ποστ του LinkedIn (`scripts/marketing/linkedin-origin.mjs`) σε βίντεο 9:16,',
    'σκηνή προς διαφάνεια. Για LinkedIn, Instagram, Facebook και YouTube Shorts.',
    'Παράγεται σε δύο βήματα (θέλει ffmpeg με libx264):',
    '',
    '    npx tsx scripts/marketing/reelOrigin.ts        # η εικόνα',
    '    npx tsx scripts/marketing/reelOriginSound.ts   # η μουσική και το τελικό αρχείο',
    '',
    'Το βίντεο γράφεται στο `docs/marketing/reels/reel-origin/PROPERWISE-pos-xekinise.mp4`, έξω από το git.',
    'Εδώ μένουν η λεζάντα (`caption.md`) και το εξώφυλλο (`cover.jpg`).',
    '',
    'Τα νούμερα της έκπτωσης ανακαίνισης έρχονται από το `lib/accounting/renovation39b.ts`.',
    '',
  ].join('\n'));
  console.log('✓ docs/marketing/instagram/reel-origin/');
}

main().catch(e => { console.error(e); process.exit(1); });
