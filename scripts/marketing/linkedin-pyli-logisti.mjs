// ═══════════════════════════════════════════════════════════════════════════
// LINKEDIN · ΤΡΙΤΗ 10.11.2026 · «Η ΠΥΛΗ ΤΩΝ ΛΟΓΙΣΤΙΚΩΝ ΓΡΑΦΕΙΩΝ»
// ─────────────────────────────────────────────────────────────────────────
// Πέντε κάθετες διαφάνειες 4:5 (1080×1350) και ένα PDF για το «Add a document».
// Απόφαση ιδιοκτήτη 09.11.2026: η Τρίτη 10.11 μιλά για τη νέα δυνατότητα που
// είναι ήδη στην παραγωγή (#490, #496, #499, #500, #503), όχι για οδηγό.
//
//   1. «Στείλε μου τα χαρτιά ως την Παρασκευή.»  2. Ο ιδιοκτήτης δίνει την
//   πρόσβαση, σε τρία επίπεδα                      3. Η ομάδα του γραφείου
//   4. Τι λείπει και «Ζήτησέ το»                   5. Τι βλέπει ο ιδιοκτήτης
//
// Η ΜΑΡΚΑ ΜΕΝΕΙ ΜΙΑ: το πλαίσιο του linkedin-carousel.mjs, όπως το πήρε και το
// linkedin-forologia-enoikion.mjs (σκούρο μπλε, Inter και Roboto Mono από το
// public/fonts, ίδια κεφαλίδα, πρόοδος και κάρτες). Καμία γραμματοσειρά ή
// λογότυπο τρίτου.
//
// ΟΙ ΟΘΟΝΕΣ ΕΙΝΑΙ ΟΙ ΑΛΗΘΙΝΕΣ: ο πάγκος κινητού (scripts/perf-bench/firms.tsx)
// αποδίδει τα ίδια components με την εφαρμογή. Πριν τη φωτογραφία αλλάζουν
// μόνο τα επινοημένα ονόματα του πάγκου σε ρεαλιστικά ελληνικά (ΟΝΟΜΑΤΑ πιο
// κάτω), φεύγει το ΑΦΜ του δοκιμαστικού και σβήνει κάθε περίγραμμα εστίασης.
// Αν ένα όνομα του πάγκου δεν βρεθεί, η μηχανή σταματά: οι οθόνες άλλαξαν.
//
// ΚΑΝΕΝΑ ΚΕΙΜΕΝΟ ΤΗΣ ΕΦΑΡΜΟΓΗΣ ΜΕ ΤΟ ΧΕΡΙ. Ρόλοι, επίπεδα και οι εξηγήσεις
// τους από το lib/data/firms.ts· οι μέρες της αναίρεσης από το
// lib/legal/firms.ts· η πρόταση της χρέωσης από το lib/legal/billingWords.ts,
// αυτούσια (η πρώτη πρόταση του `firmAccount`, κοινή στις δύο καταστάσεις
// του ταμείου· η μηχανή ελέγχει ότι είναι κοινή).
//
// Τρέξε: node scripts/perf-bench/build-mobile.mjs
//        npx tsx scripts/marketing/linkedin-pyli-logisti.mjs [έξοδος]
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { join, resolve } from 'node:path';
import { chromePath } from '../lib/chrome.mjs';
import { ROLE_LABEL, ROLE_HINT, ROLES, LEVEL_LABEL, LEVEL_HINT, LEVELS } from '../../lib/data/firms.ts';
import { FIRM_UNDO_DAYS } from '../../lib/legal/firms.ts';

const ROOT = process.cwd();
const R = join(ROOT, 'public');
const SLUG = 'properwise-pyli-logisti';
const BENCH = join(ROOT, '.perf-bench/mobile.html');
if (!fs.existsSync(BENCH)) throw new Error('Λείπει ο πάγκος: node scripts/perf-bench/build-mobile.mjs');
const OUT = resolve(process.argv[2] || join(ROOT, 'docs/marketing/profil/linkedin-pyli-logisti'));
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ── Τα γεγονότα ──────────────────────────────────────────────────────────
// Η διαφάνεια 5 λέει «σήμερα και χθες»· στέκει όσο η αναίρεση κρατά δύο μέρες.
if (FIRM_UNDO_DAYS !== 2) throw new Error(`Η αναίρεση κρατά πια ${FIRM_UNDO_DAYS} μέρες· η διαφάνεια 5 θέλει νέα διατύπωση.`);
if (LEVELS.length !== 3 || ROLES.length !== 3) throw new Error('Τα επίπεδα ή οι ρόλοι δεν είναι πια τρία· οι διαφάνειες 2 και 3 θέλουν νέα διάταξη.');
// Η πρόταση της χρέωσης: η πρώτη πρόταση του `firmAccount`, που πρέπει να
// είναι ίδια όπως κι αν είναι το ταμείο. Τα δύο κείμενα διαβάζονται από την
// πηγή, όπως κάνει και ο scripts/guard-billing-claims.mjs.
const BW = fs.readFileSync(join(ROOT, 'lib/legal/billingWords.ts'), 'utf8');
const firmLines = [...BW.matchAll(/^ {2}firmAccount:\s*\n\s*'([^']+)'/gm)].map(x => x[1]).filter(x => x.startsWith('Ο λογαριασμός'));
if (firmLines.length !== 2) throw new Error('Δεν βρέθηκαν οι δύο ελληνικές εκδοχές του firmAccount στο lib/legal/billingWords.ts.');
const firstSentence = s => s.slice(0, s.indexOf('.') + 1);
const CLAIM = 'Ο λογαριασμός γραφείου δεν χρεώνεται: το γραφείο και τα μέλη του δεν πληρώνουν';
if (!firmLines.every(x => x.startsWith(CLAIM))) throw new Error('Οι δύο εκδοχές του firmAccount δεν ξεκινούν πια με την ίδια δήλωση.');
const BILLING = firstSentence(firmLines[0]);

// ── Οι οθόνες, από τον πάγκο ─────────────────────────────────────────────
// Τα επινοημένα ονόματα του πάγκου → ρεαλιστικά ελληνικά. Επινοημένα κι αυτά.
const ONOMATA = [
  ['Λογιστικό Γραφείο Παράδειγμα', 'Λογιστικό Γραφείο Κωνσταντίνου'],
  ['Φοροτεχνικό Γραφείο Υπόδειγμα', 'Φοροτεχνικό Γραφείο Σταθοπούλου'],
  ['Γιώργος Παραδείγματος', 'Γιώργος Παπαδάκης'],
  ['Ελένη Παραδείγματος', 'Ελένη Κωνσταντίνου'],
  ['Νίκος Δοκιμής', 'Νίκος Αλεξίου'],
  ['Κώστας Δοκιμαστής', 'Κώστας Μαυρίδης'],
  ['Άννα Υποδείγματος', 'Άννα Θεοδώρου'],
  ['Οδός Παραδείγματος', 'Σόλωνος'],
  ['ΔΕΗ Οκτωβρίου', 'Ρεύμα Οκτωβρίου'],
];
const browser = await chromium.launch({ executablePath: chromePath() });
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'el-GR' });
const seen = new Set();
async function scene(c) {
  const p = await phone.newPage();
  await p.goto(`file://${BENCH}?c=${c}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  const hits = await p.evaluate(map => {
    const st = document.createElement('style');
    st.textContent = '*,*:focus,*:focus-visible{outline:none!important;box-shadow:none}';
    document.head.append(st);
    document.activeElement?.blur?.();
    const found = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      let t = n.textContent;
      for (const [a, b] of map) if (t.includes(a)) { t = t.split(a).join(b); found.push(a); }
      t = t.replace(/\s*·\s*ΑΦΜ \d{9}/g, '');
      if (t !== n.textContent) n.textContent = t;
    }
    // Το αρχικό του δοκιμαστικού email στη στρογγυλή εικόνα του λογαριασμού.
    for (const el of document.querySelectorAll('button, div, span')) if (el.childElementCount === 0 && el.textContent === 'D') el.textContent = 'Ε';
    return found;
  }, ONOMATA);
  hits.forEach(h => seen.add(h));
  await p.waitForTimeout(200);
  return p;
}
// Η κάρτα που περιέχει ένα κείμενο: ο πρώτος πρόγονος με στρογγυλεμένες γωνίες και περίγραμμα.
const cardOf = (p, text, extra = 0) => p.evaluate(([text, extra]) => {
  const leaf = [...document.querySelectorAll('*')].find(e => e.childElementCount === 0 && e.textContent.trim().startsWith(text));
  if (!leaf) return null;
  let c = leaf;
  while (c && !(parseFloat(getComputedStyle(c).borderTopLeftRadius) >= 12 && getComputedStyle(c).borderTopStyle !== 'none' && c.getBoundingClientRect().width > 300)) c = c.parentElement;
  if (!c) return null;
  c.scrollIntoView({ block: 'start' });
  window.scrollBy(0, -16);
  const r = c.getBoundingClientRect();
  return { x: Math.max(0, r.left - 6), y: Math.max(0, r.top - 6), width: Math.min(r.width + 12, 390), height: r.height + 12 + extra };
}, [text, extra]);
const png = async (p, clip, maxH) => {
  if (!clip) throw new Error('Δεν βρέθηκε η κάρτα στον πάγκο· οι οθόνες άλλαξαν.');
  const c = { ...clip, height: Math.min(clip.height, maxH ?? clip.height, 844 - clip.y) };
  return `data:image/png;base64,${(await p.screenshot({ clip: c })).toString('base64')}`;
};

const ws = await scene('firmWorkspace');
const SHOT_CLIENT = await png(ws, await cardOf(ws, 'Γιώργος Παπαδάκης'), 452);
const ask = await scene('firmAsk');
// Το φύλλο από κάτω: από τον τίτλο του ως τα κουμπιά του.
const SHOT_ASK = await png(ask, await ask.evaluate(() => {
  const leaf = re => [...document.querySelectorAll('*')].filter(e => e.childElementCount === 0 && re.test(e.textContent.trim()));
  const sub = leaf(/^Γιώργος Παπαδάκης ·/)[0], btn = leaf(/^Ακύρωση$/).pop();
  if (!sub || !btn) return null;
  const top = sub.getBoundingClientRect().top - 44;
  return { x: 0, y: top, width: 390, height: btn.getBoundingClientRect().bottom + 22 - top };
}));
const own = await scene('firmOwner');
const SHOT_ACCESS = await png(own, await cardOf(own, 'Λογιστικό Γραφείο Κωνσταντίνου'));
const SHOT_DAY = await png(own, await cardOf(own, '«Λογιστικό Γραφείο Κωνσταντίνου»'), 350);
for (const [a] of ONOMATA) if (!seen.has(a) && !['Φοροτεχνικό Γραφείο Υπόδειγμα', 'ΔΕΗ Οκτωβρίου', 'Κώστας Δοκιμαστής', 'Άννα Υποδείγματος'].includes(a)) {
  throw new Error(`Το όνομα «${a}» δεν βρέθηκε στον πάγκο· οι σκηνές άλλαξαν.`);
}
await phone.close();

// ── Το πλαίσιο, όπως στο linkedin-carousel.mjs ───────────────────────────
const b64 = p => fs.readFileSync(p).toString('base64');
const f = n => `data:font/woff2;base64,${b64(`${R}/fonts/${n}`)}`;
const LOGO = `data:image/png;base64,${b64(`${R}/brand/properwise-logotypo-lefko.png`)}`;
// Τσεκ σε CSS: ο φύλακας brand-mark δεν δέχεται χειροποίητο SVG εκτός BrandMark.
const tick = (c = '#52c79e', s = 1) => `<i style="display:inline-block;width:${9 * s}px;height:${17 * s}px;margin:0 ${14 * s}px ${5 * s}px ${4 * s}px;border:solid ${c};border-width:0 ${4 * s}px ${4 * s}px 0;transform:rotate(45deg);flex:none"></i>`;
const N = 5;

const css = `
@font-face{font-family:Inter;font-weight:100 900;src:url(${f('inter-greek.woff2')})}
@font-face{font-family:Inter;font-weight:100 900;src:url(${f('inter-latin.woff2')})}
@font-face{font-family:Mono;font-weight:400 600;src:url(${f('robotomono-greek.woff2')})}
@font-face{font-family:Mono;font-weight:400 600;src:url(${f('robotomono-latin.woff2')})}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;overflow:hidden}
body{font-family:Inter,sans-serif;font-variant-numeric:tabular-nums;color:#f1f5fc;-webkit-font-smoothing:antialiased;position:relative;background:#060b14}
.bg{position:absolute;inset:0;
 background:radial-gradient(900px 700px at 78% 78%, rgba(21,96,212,.42), transparent 62%),
  radial-gradient(700px 500px at 8% -6%, rgba(138,180,248,.16), transparent 66%),
  linear-gradient(172deg,#0d1a30 0%,#08101d 55%,#060b14 100%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:54px 54px;
 mask-image:radial-gradient(720px 600px at 62% 72%,#000 10%,transparent 76%)}
.edge{position:absolute;left:0;right:0;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(138,180,248,.6),transparent)}
.pad{position:absolute;inset:0;padding:76px 80px 70px;display:flex;flex-direction:column}
.head{display:flex;justify-content:space-between;align-items:center}
.head img{height:30px;display:block}
.prog{display:flex;gap:8px}.prog b{width:34px;height:5px;border-radius:3px;background:rgba(255,255,255,.14)}.prog b.on{background:#8ab4f8;box-shadow:0 0 12px rgba(138,180,248,.7)}
.eyebrow{margin-top:70px;font-family:Mono,monospace;font-size:19px;font-weight:500;letter-spacing:.24em;color:#8ab4f8;text-transform:uppercase;display:flex;align-items:center;gap:16px}
.eyebrow:before{content:'';width:34px;height:2px;background:#8ab4f8}
h1{margin-top:26px;font-size:92px;line-height:1;font-weight:800;letter-spacing:-.045em;text-wrap:balance}
h1 .a{background:linear-gradient(95deg,#a9c8ff 0%,#5f9bff 60%,#3d7ef0 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{margin-top:28px;font-size:30px;line-height:1.38;color:#aebbd0;max-width:900px;letter-spacing:-.012em;text-wrap:pretty}
.sub b{color:#f1f5fc;font-weight:650}
.stage{flex:1;position:relative;margin:40px 0 30px}
.card{position:absolute;border-radius:28px;background:linear-gradient(180deg,rgba(28,44,72,.92),rgba(14,24,42,.94));border:1px solid rgba(255,255,255,.12);
 box-shadow:0 40px 90px rgba(0,0,0,.6),0 0 0 1px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.12);padding:34px 36px}
.lbl{font-family:Mono,monospace;font-size:17px;letter-spacing:.16em;color:#7d8da6;text-transform:uppercase}
.row{display:flex;align-items:center;justify-content:space-between;gap:18px}
.pill{font-size:20px;font-weight:650;padding:8px 18px;border-radius:99px;white-space:nowrap;display:inline-flex;align-items:center;gap:10px}
.pill:before{content:'';width:9px;height:9px;border-radius:50%;background:currentColor}
.ok{color:#5fd4a8;background:rgba(82,199,158,.14)} .bl{color:#9ec0ff;background:rgba(138,180,248,.15)} .wa{color:#f0c97d;background:rgba(229,192,123,.15)}
.t{font-size:29px;font-weight:700;letter-spacing:-.018em}
.li{display:flex;align-items:flex-start;font-size:25px;line-height:1.38;color:#d6dfec;letter-spacing:-.01em}
.foot{display:flex;justify-content:space-between;align-items:center;padding-top:28px;border-top:1px solid rgba(255,255,255,.1)}
.url{font-family:Mono,monospace;font-size:22px;letter-spacing:.06em;color:#9ec0ff}
.next{font-size:22px;font-weight:600;color:#9ec0ff;display:flex;align-items:center;gap:12px}
.led{display:flex;justify-content:space-between;align-items:baseline;gap:20px;padding:15px 0;border-top:1px solid rgba(255,255,255,.08);font-size:25px;color:#d6dfec}
.led:first-of-type{border-top:0}
.led b{font-weight:700;color:#f1f5fc;white-space:nowrap}
.src{font-size:20px;line-height:1.45;color:#aebbd0}
.src b{color:#e3eaf5;font-weight:650}
`;
const frame = (n, eyebrow, h1, sub, stage, foot) => `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${css}${extra}</style></head><body><div class="bg"></div><div class="grid"></div><div class="edge"></div>
<div class="pad"><div class="head"><img src="${LOGO}" alt="PROPERWISE"><div class="prog">${Array.from({ length: N }, (_, i) => `<b class="${i + 1 === n ? 'on' : ''}"></b>`).join('')}</div></div>
<div class="eyebrow">${eyebrow}</div><h1>${h1}</h1><div class="sub">${sub}</div>
<div class="stage">${stage}</div>
<div class="foot">${foot ?? '<div class="url">properwise.gr</div><div class="next">Σύρε <span>→</span></div>'}</div></div></body></html>`;

// Η οθόνη μέσα σε κάρτα της μάρκας: η φωτογραφία του πάγκου, χωρίς δικό της πλαίσιο.
// Η ετικέτα «Παράδειγμα» σε δική της γραμμή, πάνω από την οθόνη: πάνω στην
// εικόνα σκέπαζε κουμπιά.
const shot = (src, style, label) => `
 <div class="card shot" style="${style}">
  <div class="row" style="padding:2px 6px 14px"><div class="lbl">${label}</div><span class="pill wa" style="font-size:17px;padding:6px 14px">Παράδειγμα</span></div>
  <img src="${src}" alt="">
 </div>`;
const extra = `
.card.shot{padding:18px 16px 16px}
.card.shot img{display:block;width:100%;border-radius:16px}
.lv{padding:14px 0;border-top:1px solid rgba(255,255,255,.08)}
.lv:first-of-type{border-top:0;padding-top:4px}
.lv .k{font-size:24px;font-weight:700;letter-spacing:-.012em;display:flex;align-items:center}
.lv .h{margin-top:6px;font-size:19px;line-height:1.42;color:#aebbd0}
`;

const slides = [
// 1 · Το εξώφυλλο: η φράση που έχει ακούσει κάθε ιδιοκτήτης από τον λογιστή του
frame(1, 'Το ακουμε καθε χρονια',
 '«Στείλε μου τα χαρτιά<br><span class="a">ως την Παρασκευή.</span>»',
 'Τώρα το γραφείο βλέπει μόνο του <b>τι λείπει από κάθε πελάτη.</b>', `
 <div class="card" style="left:0;top:20px;width:440px;transform:rotate(-2deg);padding:32px 34px">
  <div class="lbl">Νεο στο PROPERWISE</div>
  <div class="t" style="margin-top:14px;font-size:34px;line-height:1.15">Η πύλη των λογιστικών γραφείων</div>
  <div style="margin-top:14px;font-size:22px;line-height:1.42;color:#aebbd0">Ο ιδιοκτήτης δίνει πρόσβαση στο γραφείο που τον εκπροσωπεί. Το γραφείο δουλεύει όλους τους πελάτες του από μία λίστα.</div>
 </div>
 ${shot(SHOT_CLIENT, 'right:0;top:0;width:420px', 'Η λιστα')}`),

// 2 · Ο ιδιοκτήτης δίνει την πρόσβαση, σε τρία επίπεδα
frame(2, 'Η προσβαση',
 'Το κλειδί το κρατά<br><span class="a">ο ιδιοκτήτης.</span>',
 'Διαλέγει πόσα κάνει το γραφείο του. <b>Ανακαλεί την πρόσβαση όποτε θέλει.</b>', `
 <div class="card" style="left:0;top:0;width:520px;padding:26px 30px">
  <div class="lbl" style="margin-bottom:10px">Τρια επιπεδα</div>
  ${LEVELS.map(l => `<div class="lv"><div class="k">${tick('#5fd4a8', 0.7)}${LEVEL_LABEL[l]}</div><div class="h">${LEVEL_HINT[l]}</div></div>`).join('')}
 </div>
 ${shot(SHOT_ACCESS, 'right:0;top:40px;width:380px', 'Στις ρυθμισεις του')}`),

// 3 · Η ομάδα του γραφείου: ρόλοι, δεύτερο βήμα, αναθέσεις
frame(3, 'Η ομαδα του γραφειου',
 'Κάθε μέλος<br><span class="a">με τον ρόλο του.</span>',
 'Ο λογιστής και ο συνεργάτης βλέπουν <b>μόνο τους πελάτες που τους ανατίθενται.</b>', `
 <div class="card" style="left:0;right:0;top:0;padding:24px 36px">
  ${ROLES.map((r, i) => `<div class="row" style="padding:16px 0;${i ? 'border-top:1px solid rgba(255,255,255,.08)' : ''}">
   <div style="font-size:27px;font-weight:700;letter-spacing:-.015em">${ROLE_LABEL[r]}</div>
   <div style="font-size:22px;color:#aebbd0;text-align:right">${ROLE_HINT[r]}</div></div>`).join('')}
 </div>
 <div class="card" style="left:0;width:445px;top:290px;height:230px;padding:26px 30px;display:flex;align-items:flex-start;gap:20px">
  <div style="flex:none;width:56px;height:56px;border-radius:50%;background:rgba(82,199,158,.16);display:grid;place-items:center">${tick('#5fd4a8', 0.75).replace(/margin:[^;]+;/, 'margin:0 0 5px 0;')}</div>
  <div><div class="lbl">Επαληθευση δυο βηματων</div><div style="margin-top:10px;font-size:24px;line-height:1.38;font-weight:600;letter-spacing:-.012em">Κάθε μέλος του γραφείου μπαίνει με δεύτερο βήμα.</div></div>
 </div>
 <div class="card" style="right:0;width:445px;top:290px;height:230px;padding:26px 30px;display:flex;align-items:flex-start;gap:20px">
  <div style="flex:none;width:56px;height:56px;border-radius:50%;background:rgba(138,180,248,.16);display:grid;place-items:center">${tick('#9ec0ff', 0.75).replace(/margin:[^;]+;/, 'margin:0 0 5px 0;')}</div>
  <div><div class="lbl">Αναθεσεις</div><div style="margin-top:10px;font-size:24px;line-height:1.38;font-weight:600;letter-spacing:-.012em">Ο υπεύθυνος μοιράζει τους πελάτες στα μέλη, έναν έναν ή πολλούς μαζί.</div></div>
 </div>`),

// 4 · Τι λείπει και «Ζήτησέ το»
frame(4, 'Τι λειπει',
 'Ένα αίτημα<br><span class="a">αντί για τηλέφωνο.</span>',
 'Δίπλα σε κάθε έλλειψη υπάρχει το <b>«Ζήτησέ το».</b>', `
 <div class="card" style="left:0;top:0;width:460px;padding:30px 30px;display:flex;flex-direction:column;gap:20px">
  <div class="li">${tick('#5fd4a8')}<span>Η λίστα δείχνει τι λείπει από κάθε πελάτη, πριν από κάθε ποσό.</span></div>
  <div class="li">${tick('#5fd4a8')}<span>Πατάς «Ζήτησέ το» και γράφεις, αν θέλεις, μια σημείωση.</span></div>
  <div class="li">${tick('#9ec0ff')}<span>Το αίτημα φτάνει στην εφαρμογή του πελάτη, στη Λογιστική του.</span></div>
 </div>
 ${shot(SHOT_ASK, 'right:0;top:0;width:440px', 'Το αιτημα')}`),

// 5 · Τι βλέπει ο ιδιοκτήτης, η χρέωση και ο σύνδεσμος
frame(5, 'Και ο ιδιοκτητης',
 'Βλέπει τι γράφτηκε,<br><span class="a">κάθε μέρα.</span>',
 'Τις καταχωρήσεις του γραφείου σήμερα και χθες <b>μπορεί να τις αναιρέσει.</b>', `
 ${shot(SHOT_DAY, 'left:0;top:0;width:430px', 'Σημερα και χθες')}
 <div class="card" style="right:0;top:30px;width:460px;padding:30px 32px">
  <div class="lbl">Για το γραφειο</div>
  <div style="margin-top:14px;font-size:23px;line-height:1.45;color:#d6dfec">${BILLING}</div>
  <div style="margin-top:18px;font-size:20px;color:#9ec0ff">properwise.gr/logistes</div>
 </div>`,
 `<div style="display:flex;flex-direction:column;gap:6px"><div style="font-size:30px;font-weight:800;letter-spacing:-.02em">Βάλε το ακίνητό σου σε τάξη.</div><div style="font-size:22px;line-height:1.35;color:#aebbd0">Ο σύνδεσμος είναι στο πρώτο σχόλιο.</div></div>
  <div style="padding:20px 30px;border-radius:99px;background:linear-gradient(180deg,#3d7ef0,#1560d4);box-shadow:0 14px 34px rgba(21,96,212,.55),inset 0 1px 0 rgba(255,255,255,.3);font-size:24px;font-weight:700;display:flex;align-items:center;gap:14px">properwise.gr <span>→</span></div>`),
];

// ── Απόδοση, με έλεγχο ───────────────────────────────────────────────────
const p = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
const files = [];
const problems = [];
for (const [i, html] of slides.entries()) {
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  const bad = await p.evaluate(() => {
    const out = [];
    const W = 1080, H = 1350, M = 40;
    for (const el of document.querySelectorAll('.pad *')) {
      const cs = getComputedStyle(el);
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
      if (/Mono/.test(cs.fontFamily) && /\d/.test(own)) out.push(`ψηφίο σε Mono: «${own.trim()}»`);
      if (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible') out.push(`κόβεται: «${el.textContent.trim().slice(0, 40)}»`);
      const r = el.getBoundingClientRect();
      if (r.width && (r.left < M - 30 || r.right > W - M + 30 || r.bottom > H - 30)) out.push(`βγαίνει από τη διαφάνεια: «${el.textContent.trim().slice(0, 40)}»`);
    }
    // Κάρτα πάνω σε κάρτα ή κάρτα που περνά το κάτω όριο της σκηνής.
    const stage = document.querySelector('.stage').getBoundingClientRect();
    const cards = [...document.querySelectorAll('.stage > .card')].map(c => c.getBoundingClientRect());
    cards.forEach((a, k) => {
      if (a.bottom > stage.bottom + 1) out.push(`κάρτα ${k + 1} περνά τη σκηνή κατά ${Math.round(a.bottom - stage.bottom)}px`);
      cards.slice(k + 1).forEach((b, j) => {
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 0 && oy > 0) out.push(`κάρτες ${k + 1} και ${k + j + 2} επικαλύπτονται`);
      });
    });
    return out;
  });
  bad.forEach(x => problems.push(`διαφάνεια ${i + 1}: ${x}`));
  const file = join(OUT, `${SLUG}-${i + 1}.png`);
  await p.screenshot({ path: file });
  files.push(file);
}
// Το PDF: μία σελίδα ανά διαφάνεια, ίδιο μέγεθος, για το «Add a document» του LinkedIn.
const pdf = await browser.newPage();
await pdf.setContent(`<!doctype html><html><head><style>@page{size:1080px 1350px;margin:0}body{margin:0}img{display:block;width:1080px;height:1350px;page-break-after:always}</style></head><body>${
  files.map(x => `<img src="data:image/png;base64,${b64(x)}">`).join('')}</body></html>`, { waitUntil: 'load' });
await pdf.pdf({ path: join(OUT, `${SLUG}.pdf`), width: '1080px', height: '1350px', printBackground: true });
await browser.close();
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('✓', files.length, 'διαφάνειες και PDF στο', OUT);
