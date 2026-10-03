// ═══════════════════════════════════════════════════════════════════════════
// LINKEDIN · «ΠΩΣ ΞΕΚΙΝΗΣΕ ΤΟ PROPERWISE» (03.10.2026)
// ─────────────────────────────────────────────────────────────────────────
// Τέσσερις κάθετες διαφάνειες 4:5 και ένα PDF για το «Add a document».
//
// Η ΙΣΤΟΡΙΑ ΕΙΝΑΙ ΤΟΥ ΙΔΙΟΚΤΗΤΗ, ΜΕ ΤΑ ΔΙΚΑ ΤΟΥ ΣΤΟΙΧΕΙΑ. Γράφτηκε από τον ίδιο
// για το προσωπικό του LinkedIn και φυλάγεται στο Launch Kit της 23.09.2026
// (ενότητα «Προσωπικό LinkedIn»): το διαμέρισμα που κληρονόμησε τον Ιούνιο, οι
// τρεις μήνες δουλειάς τα σαββατοκύριακα, τα χρήματα που γλίτωσαν από τον
// μάστορα και το χέρι στον γύψο. Κανένα στοιχείο εδώ δεν προστέθηκε. Κανένα
// όνομα και καμία διεύθυνση: μόνο PROPERWISE.
//
// Η ΑΙΣΘΗΤΙΚΗ ΕΙΝΑΙ ΤΟΥ CAROUSEL ΤΗΣ ΜΑΡΚΑΣ (linkedin-carousel.mjs): ίδιο φόντο,
// ίδια κεφαλίδα και πρόοδος, ίδια ετικέτα, ίδιος τίτλος, ίδιες κάρτες, Inter
// και Roboto Mono. Μια δοκιμή με serif, τοίχο και ανοιχτό φόντο απορρίφθηκε
// από τον ιδιοκτήτη (03.10.2026): η σειρά πρέπει να μοιάζει με μία μάρκα.
// Μένει από εκείνη τη δοκιμή μόνο το χαρτί της απόδειξης.
//
//   1. Η απόδειξη του καλοκαιριού.   2. «Τι τον θες τον μάστορα;»
//   3. Φάκελος, όχι screenshots.      4. Το όραμα και η σειρά.
//
// Τρέξε: npx tsx scripts/marketing/linkedin-origin.mjs
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { join } from 'node:path';
import { chromePath } from '../lib/chrome.mjs';
import { PLANS } from '../../lib/billing/plans.ts';

if (PLANS.free.priceMonthly !== 0) throw new Error('Το «Ξεκινάς δωρεάν» θέλει δωρεάν πακέτο.');

const ROOT = process.cwd();
const R = join(ROOT, 'public');
const OUT = join(ROOT, 'docs/marketing/profil/linkedin-pos-xekinise');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const b64 = p => fs.readFileSync(p).toString('base64');
const f = n => `data:font/woff2;base64,${b64(`${R}/fonts/${n}`)}`;
const LOGO = `data:image/png;base64,${b64(`${R}/brand/properwise-logotypo-lefko.png`)}`;
// Τσεκ σε CSS: ο φύλακας brand-mark δεν δέχεται χειροποίητο SVG εκτός BrandMark.
const tick = (c = '#5fd4a8', s = 1) => `<i style="display:inline-block;width:${9*s}px;height:${17*s}px;margin:0 ${4*s}px ${5*s}px ${4*s}px;border:solid ${c};border-width:0 ${4*s}px ${4*s}px 0;transform:rotate(45deg);flex:none"></i>`;
const N = 4;

// ── Οι υφές του χαρτιού, ψημένες σε PNG ────────────────────────────────────
// Ο Chromium δεν εφαρμόζει φίλτρα σε SVG που μπαίνει ως εικόνα φόντου: το
// background-image βγαίνει επίπεδο, χωρίς σφάλμα. Γι' αυτό κάθε υφή αποδίδεται
// πρώτα ως SVG μέσα στη σελίδα, φωτογραφίζεται με διαφάνεια και μπαίνει ως PNG.
const noise = (id, freq, oct, seed, matrix) => `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${oct}" seed="${seed}" stitchTiles="stitch"/><feColorMatrix values="${matrix}"/></filter><rect width="100%" height="100%" filter="url(#${id})"/>`;
const TEXTURES = {
  // Ίνες χαρτιού.
  FIBRE: [300, 300, noise('p', '.9', 3, 2, '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.1 0 0 0 -.42')],
  // Μελάνι σφραγίδας που δεν πιάνει παντού: μάσκα.
  INK: [400, 140, noise('i', '.7', 2, 5, '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4.2 0 0 0 -1.05')],
  // Ο κόκκος της μάρκας, για να μη σκαλώνουν οι λάμψεις όταν το LinkedIn συμπιέζει.
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

// ── Το πλαίσιο της μάρκας: αυτούσιο από το linkedin-carousel.mjs ───────────
const css = `
@font-face{font-family:Inter;font-weight:100 900;src:url(${f('inter-greek.woff2')})}
@font-face{font-family:Inter;font-weight:100 900;src:url(${f('inter-latin.woff2')})}
@font-face{font-family:Mono;font-weight:400 600;src:url(${f('robotomono-greek.woff2')})}
@font-face{font-family:Mono;font-weight:400 600;src:url(${f('robotomono-latin.woff2')})}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;overflow:hidden}
body{font-family:Inter,sans-serif;color:#f1f5fc;-webkit-font-smoothing:antialiased;position:relative;background:#060b14}
.bg{position:absolute;inset:0;
 background:radial-gradient(900px 700px at 78% 78%, rgba(21,96,212,.42), transparent 62%),
  radial-gradient(700px 500px at 8% -6%, rgba(138,180,248,.16), transparent 66%),
  linear-gradient(172deg,#0d1a30 0%,#08101d 55%,#060b14 100%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:54px 54px;
 mask-image:radial-gradient(720px 600px at 62% 72%,#000 10%,transparent 76%)}
.edge{position:absolute;left:0;right:0;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(138,180,248,.6),transparent)}
.grain{position:absolute;inset:0;background-image:${GRAIN};background-size:260px;opacity:.05;mix-blend-mode:overlay;pointer-events:none;z-index:5}
.pad{position:absolute;inset:0;padding:76px 80px 70px;display:flex;flex-direction:column}
.head{display:flex;justify-content:space-between;align-items:center}
.head img{height:30px;display:block}
.prog{display:flex;gap:8px}.prog b{width:34px;height:5px;border-radius:3px;background:rgba(255,255,255,.14)}.prog b.on{background:#8ab4f8;box-shadow:0 0 12px rgba(138,180,248,.7)}
.eyebrow{margin-top:78px;font-family:Mono,monospace;font-size:19px;font-weight:500;letter-spacing:.24em;color:#8ab4f8;text-transform:uppercase;display:flex;align-items:center;gap:16px}
.eyebrow:before{content:'';width:34px;height:2px;background:#8ab4f8}
h1{margin-top:26px;font-size:100px;line-height:.98;font-weight:800;letter-spacing:-.045em;text-wrap:balance}
h1 .a{background:linear-gradient(95deg,#a9c8ff 0%,#5f9bff 60%,#3d7ef0 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{margin-top:30px;font-size:31px;line-height:1.38;color:#aebbd0;max-width:880px;letter-spacing:-.012em;text-wrap:pretty}
.sub b{color:#f1f5fc;font-weight:650}
.stage{flex:1;position:relative;margin:44px 0 34px}
.card{position:absolute;border-radius:28px;background:linear-gradient(180deg,rgba(28,44,72,.92),rgba(14,24,42,.94));border:1px solid rgba(255,255,255,.12);
 box-shadow:0 40px 90px rgba(0,0,0,.6),0 0 0 1px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.12);padding:34px 36px}
.lbl{font-family:Mono,monospace;font-size:17px;letter-spacing:.16em;color:#7d8da6;text-transform:uppercase}
.row{display:flex;align-items:center;justify-content:space-between;gap:18px}
.pill{font-size:20px;font-weight:650;padding:8px 18px;border-radius:99px;white-space:nowrap;display:inline-flex;align-items:center;gap:10px}
.pill:before{content:'';width:9px;height:9px;border-radius:50%;background:currentColor}
.ok{color:#5fd4a8;background:rgba(82,199,158,.14)} .bl{color:#9ec0ff;background:rgba(138,180,248,.15)} .wa{color:#f0c97d;background:rgba(229,192,123,.15)}
.t{font-size:29px;font-weight:700;letter-spacing:-.018em}
.foot{display:flex;justify-content:space-between;align-items:center;padding-top:28px;border-top:1px solid rgba(255,255,255,.1)}
.url{font-family:Mono,monospace;font-size:22px;letter-spacing:.06em;color:#9ec0ff}
/* Οι γραμμές λίστας της μάρκας: κύκλος κατάστασης, ετικέτα, τιμή. */
.line{display:flex;align-items:center;gap:20px;padding:18px 0;border-top:1px solid rgba(255,255,255,.08)}
.line:first-child{border-top:0;padding-top:4px}
.dot{flex:none;width:46px;height:46px;border-radius:50%;display:grid;place-items:center}
.dot.ok{background:rgba(82,199,158,.16)} .dot.wa{background:rgba(229,192,123,.14)} .dot.bl{background:rgba(138,180,248,.16)}
.dot.wa:after{content:'';width:12px;height:12px;border-radius:50%;border:3px solid #f0c97d}
.v{font-size:26px;font-weight:650;letter-spacing:-.015em;color:#eef2f7}
`;
const frame = (n, eyebrow, h1, sub, stage, foot, h1Size) => `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${css}</style></head><body><div class="bg"></div><div class="grid"></div><div class="edge"></div><div class="grain"></div>
<div class="pad"><div class="head"><img src="${LOGO}" alt="PROPERWISE"><div class="prog">${Array.from({ length: N }, (_, k) => `<b class="${k + 1 === n ? 'on' : ''}"></b>`).join('')}</div></div>
<div class="eyebrow">${eyebrow}</div><h1${h1Size ? ` style="font-size:${h1Size}px"` : ''}>${h1}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}
<div class="stage">${stage}</div>
<div class="foot">${foot ?? `<div class="url">properwise.gr</div>`}</div></div></body></html>`;
const line = (kind, label, value) => `<div class="line"><div class="dot ${kind}">${kind === 'ok' ? tick('#5fd4a8', .75) : kind === 'bl' ? tick('#9ec0ff', .75) : ''}</div>
  <div>${label ? `<div class="lbl" style="font-size:15px">${label}</div>` : ''}<div class="v" style="${label ? 'margin-top:6px' : ''}">${value}</div></div></div>`;

// ── 1 · Η ΑΠΟΔΕΙΞΗ ΤΟΥ ΚΑΛΟΚΑΙΡΙΟΥ ─────────────────────────────────────────
// Η εφαρμογή ζει από αποδείξεις· η ιστορία της ξεκινά με μία.
const rrow = (k, v) => `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:20px;padding:6px 0">
  <span>${k}</span><span style="text-align:right;white-space:nowrap">${v}</span></div>`;
const dots = `<div style="margin:10px 0;border-top:2px dashed rgba(30,34,40,.5)"></div>`;
// Το κάτω άκρο κόβεται δοντωτά, όπως το σκίζει ο εκτυπωτής.
const ZIG = 'polygon(0 0,100% 0,' + Array.from({ length: 29 }, (_, k) => {
  const x = 100 - (k + 0.5) * (100 / 28.5);
  return `${Math.max(x, 0).toFixed(2)}% calc(100% - ${k % 2 ? 0 : 12}px)`;
}).join(',') + ',0 calc(100% - 12px))';
const receipt = `
 <div style="position:absolute;left:130px;width:660px;top:-6px;transform:rotate(-2deg);
  filter:drop-shadow(0 2px 2px rgba(0,0,0,.4)) drop-shadow(0 28px 36px rgba(0,0,0,.45)) drop-shadow(0 60px 90px rgba(0,0,0,.4))">
  <div style="position:relative;background:#f6f6f2;clip-path:${ZIG};padding:34px 46px 112px;font-family:Mono,monospace;color:#23272e;font-size:18px;font-weight:500">
   <div style="position:absolute;inset:0;background-image:${FIBRE};background-size:300px;opacity:.22"></div>
   <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.07),transparent 9%,transparent 88%,rgba(0,0,0,.06)),linear-gradient(180deg,rgba(255,255,255,.5),transparent 20%)"></div>
   <div style="position:relative;opacity:.9">
    <div style="text-align:center;font-size:23px;font-weight:600;letter-spacing:.32em">ΑΠΟΔΕΙΞΗ</div>
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
   <div style="position:absolute;left:44px;bottom:36px;transform:rotate(-6deg);border:4px solid #b0242d;border-radius:8px;padding:7px 15px;color:#b0242d;font-weight:600;font-size:24px;letter-spacing:.2em;opacity:.82;mix-blend-mode:multiply;-webkit-mask-image:${INK};-webkit-mask-size:400px 140px">ΕΞΟΦΛΗΘΗΚΕ</div>
  </div>
 </div>`;

// ── 2 · «ΤΙ ΤΟΝ ΘΕΣ ΤΟΝ ΜΑΣΤΟΡΑ;» ──────────────────────────────────────────
// Δύο κάρτες της εφαρμογής, ίδιου ύψους: ό,τι έγινε μόνο του και ό,τι θέλει
// επαγγελματία. Η διαφορά διαβάζεται από το χρώμα της κατάστασης.
const wall = `
 <div style="position:absolute;left:0;right:0;top:0;display:grid;grid-template-columns:1fr 1fr;gap:20px">
  <div class="card" style="position:relative;padding:30px 32px 30px">
   <div class="lbl">Ο τοίχος</div>
   <div class="t" style="margin-top:10px">Τον κάναμε μόνοι μας</div>
   <div style="margin-top:22px">${line('ok', '', 'Τρίψιμο')}${line('ok', '', 'Σοβάτισμα')}${line('ok', '', 'Βάψιμο')}</div>
   <div style="margin-top:20px"><span class="pill ok">Έγινε</span></div>
  </div>
  <div class="card" style="position:relative;padding:30px 32px 30px">
   <div class="lbl">Οι υποχρεώσεις</div>
   <div class="t" style="margin-top:10px">Θέλουν τάξη και λογιστή</div>
   <div style="margin-top:22px">${line('wa', '', 'Εκκαθαριστικό ΕΝΦΙΑ')}${line('wa', '', 'Ε9 και φορολογική')}${line('wa', '', 'Κοινόχρηστα')}</div>
   <div style="margin-top:20px"><span class="pill wa">Όχι μόνος</span></div>
  </div>
 </div>
 <div style="position:absolute;left:0;right:0;bottom:0">
  <div class="lbl" style="color:#8ab4f8">Εκεί που σταματά ο τοίχος</div>
  <div style="margin-top:14px;font-size:30px;line-height:1.38;color:#aebbd0;letter-spacing:-.012em">Το «θα το κάνω μόνος να γλιτώσω» δεν γλιτώνει τίποτα. <b style="color:#f1f5fc;font-weight:650">Το πληρώνεις αργότερα.</b></div>
 </div>`;

// ── 3 · ΦΑΚΕΛΟΣ, ΟΧΙ SCREENSHOTS ───────────────────────────────────────────
// Αριστερά ό,τι έχει ο περισσότερος κόσμος: φωτογραφίες, συνομιλίες,
// συνημμένα. Δεξιά η κάρτα του φακέλου, με τις γραμμές της εφαρμογής.
const shot = (rot, x, y, z, label, inner) => `<div style="position:absolute;left:${x}px;top:${y}px;width:214px;height:270px;z-index:${z};transform:rotate(${rot}deg);border-radius:24px;background:#0c1422;border:1px solid rgba(255,255,255,.14);box-shadow:0 30px 60px rgba(0,0,0,.55);padding:12px;overflow:hidden">
  <div style="display:flex;justify-content:space-between;font-family:Mono,monospace;font-size:11px;color:#6f7d92;margin:2px 6px 10px"><span>9:41</span><span>● ● ●</span></div>
  ${inner}
  <div style="position:absolute;left:16px;right:16px;bottom:14px;font-family:Mono,monospace;font-size:13px;letter-spacing:.04em;color:#8a98ad;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</div></div>`;
const photo = `<div style="height:178px;border-radius:12px;background:linear-gradient(160deg,#4a5568,#2a3446);padding:14px;position:relative;overflow:hidden">
  <div style="position:absolute;left:22px;top:18px;width:140px;height:150px;background:#e9ecf1;transform:rotate(-7deg);border-radius:3px;padding:12px 12px;box-shadow:0 6px 14px rgba(0,0,0,.35)">
   <div style="font-size:10px;font-weight:800;color:#1a2332;letter-spacing:.04em">ΛΟΓΑΡΙΑΣΜΟΣ</div>
   ${[80, 60, 72, 50, 66].map(w => `<div style="margin-top:9px;height:5px;width:${w}%;border-radius:3px;background:#b8c0cc"></div>`).join('')}
  </div></div>`;
const chat = `<div style="height:178px;border-radius:12px;background:#121c2b;padding:12px;display:flex;flex-direction:column;gap:8px">
  <div style="align-self:flex-start;max-width:88%;background:#26344b;border-radius:12px 12px 12px 4px;padding:7px 10px;font-size:12.5px;color:#d6dfec">Τα κοινόχρηστα του μήνα</div>
  <div style="align-self:flex-start;width:72%;height:52px;border-radius:10px;background:linear-gradient(160deg,#3a4a64,#26344b)"></div>
  <div style="align-self:flex-end;background:#1560d4;border-radius:12px 12px 4px 12px;padding:7px 10px;font-size:12.5px;color:#fff">ευχαριστώ!</div></div>`;
const mail = `<div style="height:178px;border-radius:12px;background:#121c2b;padding:14px 12px">
  <div style="font-size:12.5px;font-weight:700;color:#d6dfec">Εκκαθαριστικό</div>
  <div style="margin-top:4px;font-size:11px;color:#6f7d92">Πού το είχα βάλει;</div>
  <div style="margin-top:14px;display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;background:#1b273a">
   <div style="width:28px;height:34px;border-radius:4px;background:#c94a4a;display:grid;place-items:center;font-size:8px;font-weight:800;color:#fff">PDF</div>
   <div style="flex:1"><div style="height:6px;width:80%;border-radius:3px;background:#3a4a64"></div><div style="margin-top:6px;height:6px;width:50%;border-radius:3px;background:#3a4a64"></div></div></div>
  ${[70, 55].map(w => `<div style="margin-top:12px;height:6px;width:${w}%;border-radius:3px;background:#26344b"></div>`).join('')}</div>`;
const folder = `
 <div style="position:absolute;left:0;top:0;width:440px">
  <div class="lbl">Σκόρπια</div>
  ${shot(-9, 4, 50, 1, '', photo)}
  ${shot(6, 204, 58, 2, '', chat)}
  ${shot(-3, 100, 214, 3, 'Συνημμένο.pdf', mail)}
 </div>
 <div class="card" style="right:0;top:0;width:470px;padding:30px 32px 26px">
  <div class="row"><div class="lbl">Φάκελος λογιστή</div><span class="pill ok">Έτοιμος</span></div>
  <div class="t" style="margin-top:12px;font-size:31px">Φορολογική χρονιά</div>
  <div style="margin-top:22px">
   ${line('ok', 'Ακίνητο', 'Ενοίκια και έξοδα')}
   ${line('ok', 'Παραστατικά', 'Ανά κατηγορία')}
   ${line('bl', 'Πριν το ζητήσει', 'Τι λείπει')}
  </div>
 </div>`;

// ── 4 · ΤΟ ΟΡΑΜΑ ΚΑΙ Η ΣΕΙΡΑ ───────────────────────────────────────────────
// Οι επτά πρώτες Τρίτες από το docs/marketing/linkedin-seira.md.
const SERIES = [
  ['13.10', 'ΕΝΦΙΑ 2026: πληρωμή, δόσεις, πιστοποιητικό'],
  ['20.10', 'Φορολογία Airbnb 2026'],
  ['27.10', 'Καθαρή απόδοση ακινήτου'],
  ['03.11', 'Φορολογία ενοικίων 2026'],
  ['10.11', 'Ενοίκιο μέσω τράπεζας'],
  ['17.11', 'Βραχυχρόνια 2026: ΑΜΑ και προδιαγραφές'],
  ['24.11', 'Έκπτωση φόρου για ανακαίνιση'],
];
const series = `
 <div class="card" style="left:0;right:0;top:0;padding:28px 34px 14px">
  <div class="row"><div class="lbl">Κάθε Τρίτη · ένας οδηγός με τον υπολογιστή του</div></div>
  <div style="margin-top:12px">
   ${SERIES.map(([d, t], i) => `<div style="display:flex;align-items:center;gap:22px;padding:15px 0;border-top:${i ? '1px solid rgba(255,255,255,.08)' : '0'}">
    <div style="flex:none;width:92px;font-family:Mono,monospace;font-size:20px;letter-spacing:.06em;color:${i ? '#7d8da6' : '#8ab4f8'}">${d}</div>
    <div style="flex:1;font-size:25px;font-weight:${i ? 550 : 700};letter-spacing:-.015em;color:${i ? '#d6dfec' : '#fff'}">${t}</div>
    ${i ? '' : '<span class="pill bl">Επόμενη</span>'}</div>`).join('')}
  </div>
 </div>`;
const cta = `<div style="display:flex;flex-direction:column;gap:6px"><div style="font-size:30px;font-weight:800;letter-spacing:-.02em">Βάλε το ακίνητό σου σε τάξη.</div><div style="font-size:22px;color:#aebbd0">Ξεκινάς δωρεάν, χωρίς κρυφές χρεώσεις.</div></div>
  <div style="padding:20px 30px;border-radius:99px;background:linear-gradient(180deg,#3d7ef0,#1560d4);box-shadow:0 14px 34px rgba(21,96,212,.55),inset 0 1px 0 rgba(255,255,255,.3);font-size:24px;font-weight:700;display:flex;align-items:center;gap:14px">properwise.gr <span>→</span></div>`;

const slides = [
  frame(1, 'Πως ξεκινησε το PROPERWISE',
    'Ένα σπίτι. Ένα καλοκαίρι.<br><span class="a">Ένα χέρι στον γύψο.</span>',
    'Τον Ιούνιο, μια κληρονομιά: ένα διαμέρισμα 35 τ.μ.<br><b>Αυτός ήταν ο λογαριασμός.</b>', receipt, undefined, 82),
  frame(2, 'Η φραση που ολοι ξερουμε',
    '«Τι τον θες<br><span class="a">τον μάστορα;»</span>',
    'Ο τοίχος συγχωρεί ένα λάθος. <b>Οι υποχρεώσεις, όχι.</b>', wall),
  frame(3, 'Η ιδεα',
    'Στον λογιστή με φάκελο,<br><span class="a">όχι με screenshots.</span>',
    'Φωτογραφίζεις τον λογαριασμό, τον ελέγχεις με μια ματιά και μπαίνει στη θέση του. <b>Όταν η δήλωση έρθει προσυμπληρωμένη, έχεις δικό σου αρχείο για να την ελέγξεις.</b>', folder, undefined, 82),
  frame(4, 'Το οραμα',
    'Τα χέρια μας πιάνουν στους τοίχους.<br><span class="a">Οι υποχρεώσεις θέλουν τάξη.</span>',
    '<b>Κανένας ιδιοκτήτης να μην υπογράφει δήλωση που δεν μπορεί να ελέγξει.</b>', series, cta, 66),
];
const only = process.argv[2] ? Number(process.argv[2]) : 0;

const files = [];
for (const [i, html] of slides.entries()) {
  if (only && only !== i + 1) continue;
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  // Τίποτα από τη σκηνή δεν περνά κάτω από τη γραμμή του υποσέλιδου.
  const spill = await p.evaluate(() => {
    const foot = document.querySelector('.foot').getBoundingClientRect().top;
    return [...document.querySelectorAll('.stage *')].some(e => e.getBoundingClientRect().bottom > foot + 1);
  });
  if (spill) console.warn(`⚠ διαφάνεια ${i + 1}: η σκηνή περνά στο υποσέλιδο`);
  const file = join(OUT, `properwise-pos-xekinise-${i + 1}.png`);
  await p.screenshot({ path: file });
  files.push(file);
}
if (!only) {
  const pdf = await b.newPage();
  await pdf.setContent(`<!doctype html><html><head><style>@page{size:1080px 1350px;margin:0}body{margin:0}img{display:block;width:1080px;height:1350px;page-break-after:always}</style></head><body>${
    files.map(f => `<img src="data:image/png;base64,${b64(f)}">`).join('')}</body></html>`, { waitUntil: 'load' });
  await pdf.pdf({ path: join(OUT, 'properwise-pos-xekinise.pdf'), width: '1080px', height: '1350px', printBackground: true });
}
await b.close();
console.log('✓', files.length, 'διαφάνειες', only ? '' : 'και PDF', 'στο', OUT);
