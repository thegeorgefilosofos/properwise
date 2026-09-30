// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΠΡΩΤΟ REEL: «ΡΩΤΑ ΤΗ ΝΟΑ»
// ─────────────────────────────────────────────────────────────────────────
// ΧΡΗΣΗ:  npx tsx scripts/marketing/reelEnoikio.ts   (μετά: reelSound.ts)
// Χρειάζεται ffmpeg με libx264 (στο PATH ή στη μεταβλητή FFMPEG).
//
// Η ΙΔΕΑ. Ξεκινά από την ερώτηση που κάνει κάθε ιδιοκτήτης και την κάνει
// εκεί που θα την έκανε μέσα στην εφαρμογή: «Πόσα μου μένουν καθαρά από το
// ενοίκιο;». Νόα απαντά και η απάντηση γίνεται εικόνα. Ο θεατής βλέπει το
// προϊόν να δουλεύει πριν μάθει πώς λέγεται.
//
// ΠΕΝΤΕ ΠΡΑΞΕΙΣ, πάνω στο πλέγμα του reelTimeline.ts:
//   1. Η ερώτηση γράφεται γράμμα γράμμα και φεύγει στη συνομιλία.
//   2. Η απάντηση: ένα γέμισμα από άκρη σε άκρη είναι όλο το ενοίκιο. Κάθε
//      αφαίρεση χρωματίζει τη λωρίδα της, η λωρίδα ξεκολλά και φεύγει, ο
//      μετρητής κυλά σαν κοντέρ. Μένουν 64€ στα 100€.
//   3. Το γεγονός, σε ολόκληρη οθόνη: «Φορολογείσαι στα έσοδα. Όχι σε ό,τι
//      σου μένει.»
//   4. «Όλα αυτά, αυτόματα.»: η εφαρμογή σε κινητό που γέρνει στον χώρο.
//   5. Η μάρκα και η υπογραφή της.
//
// ΚΑΘΕ ΚΑΡΕ ΕΙΝΑΙ ΣΥΝΑΡΤΗΣΗ ΤΟΥ ΧΡΟΝΟΥ. Η render(t) στήνει τη στιγμή t και ο
// περιηγητής τη φωτογραφίζει. Λήψη στα 60 καρέ και ένωση ανά δύο σε 30: κάθε
// καρέ κρατά το ίχνος της κίνησής του, όπως με κλείστρο κάμερας.
//
// ΟΙ ΖΩΝΕΣ ΤΟΥ INSTAGRAM. Πάνω ο λογαριασμός, κάτω η λεζάντα, κάτω δεξιά η
// στήλη με καρδιά, σχόλιο και αποστολή. Ό,τι διαβάζεται μένει έξω από αυτές·
// ο έλεγχος στο τέλος το επιβάλλει.
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { ASSISTANT_ACC, ASSISTANT_NAME, ASSISTANT_INITIAL } from '../../lib/assistant/identity';
import { DEMO_PROPERTY } from '../../lib/demo/sample';
import { C, FACES, MONO_FACES, esc, ico, mark, GRAIN } from './igKit';
import {
  S, RATE, PRES, UP, PROP_SPOKEN, eur, SEG, yearAhead,
} from './rentFacts';
import { REEL, DETACH, ROLL, QUESTION } from './reelTimeline';

// Η ερώτηση ζητά πρόβλεψη: μια ολόκληρη χρονιά μπροστά, δώδεκα ενοίκια.
const Y = yearAhead();
const { gross: GROSS, tax: TAX, enfia: ENFIA, other: OTHER, net: NET, lost: LOST, pTax: P_TAX, pEnfia: P_ENFIA, pOther: P_OTHER, pNet: P_NET } = Y;

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
type Page = import('playwright-core').Page;
const { chromePath } = require('../lib/chrome.mjs');

// Το βίντεο είναι βαρύ και παράγεται: μένει έξω από το git (.gitignore:
// docs/marketing/reels/*). Λεζάντα, εξώφυλλο και οδηγίες μπαίνουν στο αποθετήριο.
const OUT_VIDEO = join(process.cwd(), 'docs/marketing/reels/reel-1');
const OUT_DOC = join(process.cwd(), 'docs/marketing/instagram/reel-1');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const W = 1080, H = 1920, CAPTURE_FPS = 60, FPS = 30, DUR = REEL.dur;

// Η υπογραφή της μάρκας. Κλείνει το reel μόνη της: χωρίς προσφορά, χωρίς τιμή.
const TAGLINE = 'Βάλε το ακίνητό σου σε τάξη.';
// Νόα μιλά χωρίς γένος (lib/assistant/identity.ts): καμία έμφυλη λέξη εδώ.
const ANSWER = `Με ${eur(Y.monthly)} τον μήνα, η χρονιά φέρνει:`;

// ── Το γέμισμα ───────────────────────────────────────────────────────────
// Όλο το ενοίκιο πιάνει από το LEVEL0 ως το κάτω άκρο. Κάθε ευρώ έχει το ίδιο
// ύψος, οπότε η λωρίδα του ΕΝΦΙΑ είναι λεπτή και του φόρου φαρδιά: αληθινή
// αναλογία, όχι διακόσμηση.
const LEVEL0 = 1080, SPAN = H - LEVEL0;
const PARTS = [
  { v: TAX, c: SEG.tax, amount: `−${eur(TAX)}`, label: `ΦΟΡΟΣ ΕΙΣΟΔΗΜΑΤΟΣ ${RATE}`, row: `Φόρος εισοδήματος ${RATE}` },
  { v: ENFIA, c: SEG.enfia, amount: `−${eur(ENFIA)}`, label: 'ΕΝΦΙΑ', row: 'ΕΝΦΙΑ' },
  { v: OTHER, c: SEG.other, amount: `−${eur(OTHER)}`, label: 'ΕΠΙΣΚΕΥΕΣ ΚΑΙ ΑΛΛΑ ΕΞΟΔΑ', row: 'Επισκευές και άλλα έξοδα' },
];
const LEFT = [GROSS, GROSS - TAX, GROSS - TAX - ENFIA, NET];
const LEVELS = LEFT.map(v => LEVEL0 + SPAN * (1 - v / GROSS));
const PCTS = [100, 100 - P_TAX, 100 - P_TAX - P_ENFIA, P_NET];
if (PCTS[3] !== 100 - P_TAX - P_ENFIA - P_OTHER) throw new Error('Τα ποσοστά δεν αθροίζουν στο 100.');
// Ο μετρητής: ακέραιο μέρος στα ψηφία, τα λεπτά μικρά δίπλα, όπως σε τιμή.
const STOPS = LEFT.map(v => {
  const cents = Math.round(v * 100) / 100, s = eur(cents);
  const [int, rest] = s.includes(',') ? s.split(',') : [s.replace('€', ''), ''];
  return { n: Math.floor(cents), int, tail: rest ? `,${rest}` : '€' };
});
if (STOPS.some(s => s.n < 1000 || s.n > 9999)) throw new Error('Ο μετρητής έχει τέσσερα ψηφία· τα ποσά βγήκαν εκτός.');
if (STOPS.some(s => s.int !== `${String(s.n).slice(0, 1)}.${String(s.n).slice(1)}`)) throw new Error('Το ακέραιο μέρος δεν ταιριάζει με το fe.');

const DATA = {
  W, H, LEVELS, PCTS, STOPS, beats: REEL.beats, R: REEL, DETACH, ROLL, QUESTION,
  colors: PARTS.map(p => p.c), accent: C.accent, ink: C.ink, ground: C.ground,
  appNet: NET,
  // Οι ενδιάμεσοι αριθμοί της εφαρμογής, γραμμένοι από το fe: η σελίδα δεν μορφοποιεί ποσά μόνη της.
  ints: Array.from({ length: Math.ceil(GROSS) + 1 }, (_, n) => eur(n)),
  netRest: eur(NET),
};

// Κείμενο που βγαίνει από μάσκα: το εξωτερικό κόβει, το εσωτερικό ανεβαίνει.
const mask = (id: string, inner: string, cls = '') => `<div class="mk ${cls}"><div class="mi" id="${id}">${inner}</div></div>`;
const words = (t: string, pre: string) => t.split(' ').map((w, i) => `<span class="sw" id="${pre}${i}">${esc(w)}</span>`).join(' ');
const FEATS = ['Σάρωση λογαριασμών', 'Φόρος και ΕΝΦΙΑ', 'Φάκελος για τον λογιστή', `Ρώτα ${ASSISTANT_ACC}`];
const digit = (i: number) => `<span class="dg"><span class="strip" id="g${i}">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => `<i>${d}</i>`).join('')}</span></span>`;
const avatar = (px: number, bg: string, fg: string, id = '') =>
  `<span class="av"${id ? ` id="${id}"` : ''} style="width:${px}px;height:${px}px;font-size:${Math.round(px * .5)}px;background:${bg};color:${fg}">${esc(ASSISTANT_INITIAL)}</span>`;

function html(): string {
  return `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${FACES}${MONO_FACES}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${W}px;height:${H}px;overflow:hidden;background:${C.ground}}
  body{font-family:Inter,system-ui,sans-serif;color:${C.ink};position:relative;-webkit-font-smoothing:antialiased;
    font-feature-settings:"cv11","ss01";font-variant-numeric:tabular-nums}
  #bg,#field{position:absolute;inset:0}
  #field{background:linear-gradient(180deg,#a3c4fa,${C.accent} 55%,#7aa6f1);opacity:0}
  .grain{position:absolute;inset:0;background-image:${GRAIN};opacity:.07;mix-blend-mode:overlay;pointer-events:none}
  .vig{position:absolute;inset:0;background:radial-gradient(130% 90% at 50% 45%, transparent 55%, #000000a0 100%);pointer-events:none}
  section{position:absolute;inset:0;opacity:0;transform-origin:50% 45%}
  .mono{font-family:'Roboto Mono',monospace;letter-spacing:.14em;font-weight:500}
  .L{position:absolute;left:90px}
  .mk{overflow:hidden;padding-bottom:.1em;margin-bottom:-.1em}
  .mi{will-change:transform}
  .acc{color:${C.accent}}
  .av{display:inline-flex;align-items:center;justify-content:center;border-radius:28%;font-weight:800;letter-spacing:-.02em;flex:none}

  /* 1 · Η ΕΡΩΤΗΣΗ */
  .hdr{display:flex;align-items:center;gap:28px}
  .nm{font-size:62px;font-weight:800;letter-spacing:-.03em;line-height:1}
  .sub1{font-size:22px;color:${C.faint};margin-top:14px}
  .cmp{position:relative;width:900px;min-height:230px;padding:40px 150px 40px 46px;border-radius:46px;background:linear-gradient(180deg,${C.lift},${C.panel});
    border:1.5px solid ${C.rule};font-size:50px;font-weight:600;letter-spacing:-.02em;line-height:1.3;box-shadow:0 50px 120px -50px #000}
  #caret{display:inline-block;width:4px;height:1.05em;margin-left:4px;vertical-align:-.16em;background:${C.accent};border-radius:2px}
  .send{position:absolute;right:26px;bottom:26px;width:96px;height:96px;border-radius:50%;background:${C.accent};display:flex;align-items:center;justify-content:center;
    box-shadow:0 20px 50px -18px ${C.accent}}
  .ph{color:${C.faint}}

  /* 2 · Η ΑΠΑΝΤΗΣΗ */
  #ub{position:absolute;right:90px;top:280px;max-width:760px;padding:26px 36px;border-radius:40px 40px 12px 40px;background:${C.accent};color:${C.onAccent};
    font-size:40px;font-weight:650;letter-spacing:-.02em;line-height:1.25;box-shadow:0 30px 70px -30px ${C.accent}90}
  .nr{display:flex;align-items:center;gap:18px;font-size:30px;font-weight:750}
  .dots{display:flex;gap:9px;margin-left:6px}
  .dots i{width:12px;height:12px;border-radius:50%;background:${C.muted};display:block}
  #ans{font-size:38px;font-weight:600;letter-spacing:-.02em;color:${C.muted};white-space:nowrap}
  .sw{display:inline-block}
  .lab span{position:absolute;left:0;top:0;white-space:nowrap;font-size:23px}
  .odo{display:flex;align-items:flex-start;font-size:200px;font-weight:850;letter-spacing:-.045em;line-height:1;white-space:nowrap}
  .dg{display:inline-block;height:1em;overflow:hidden;width:.63em;text-align:center}
  .strip{display:flex;flex-direction:column;will-change:transform}
  .strip i{display:block;height:1em;font-style:normal}
  .sep{width:.25em;text-align:center}
  .tail{font-size:.3em;font-weight:800;letter-spacing:-.01em;margin:.2em 0 0 .12em}
  .ev{font-size:80px;font-weight:850;letter-spacing:-.04em;line-height:1.02;white-space:nowrap}
  .evl{font-size:23px;color:${C.muted};margin-top:12px}
  #pct{position:absolute;left:90px;font-size:26px;color:${C.onAccent};font-weight:700}
  #ghostl{position:absolute;right:90px;font-size:22px;color:${C.faint}}
  .gap{font-size:62px;font-weight:850;letter-spacing:-.035em;color:${SEG.tax};white-space:nowrap}

  /* 3 · ΤΟ ΓΕΓΟΝΟΣ */
  .huge{font-size:128px;font-weight:850;letter-spacing:-.05em;line-height:1.02;white-space:nowrap}
  /* Οι σκηνές-δηλώσεις κάθονται στον άξονα της οθόνης: μια φράση, ένα κέντρο βάρους. */
  .cc{position:absolute;left:90px;right:90px;display:flex;flex-direction:column;align-items:center;text-align:center}
  .cc .mk{display:flex;justify-content:center}
  .sub{font-size:40px;line-height:1.42;color:${C.muted};letter-spacing:-.012em;max-width:800px;text-wrap:balance}
  .sub b{color:${C.ink};font-weight:700}

  /* 4 · Η ΕΦΑΡΜΟΓΗ */
  .head{font-size:120px;font-weight:850;letter-spacing:-.05em;line-height:1.02;white-space:nowrap}
  #stage3d{position:absolute;left:0;right:0;top:580px;height:1320px;perspective:2200px;perspective-origin:50% 30%}
  #phone{position:absolute;left:258px;top:0;width:564px;height:1160px;border-radius:86px;padding:15px;
    background:linear-gradient(145deg,#2b3446,#0c1019 40%,#1b2230);
    box-shadow:0 0 0 2px #3a465c inset, 0 90px 160px -40px #000, 0 30px 60px -30px #000}
  .scr{position:relative;width:100%;height:100%;border-radius:72px;overflow:hidden;background:linear-gradient(180deg,#0d1422,#070b12 60%)}
  .isl{position:absolute;left:50%;top:18px;width:150px;height:42px;margin-left:-75px;border-radius:21px;background:#000}
  .sb{display:flex;justify-content:space-between;padding:26px 44px 0;font-size:21px;font-weight:700}
  .app{padding:40px 34px 0}
  .ah{display:flex;align-items:center;gap:14px;font-size:22px;font-weight:700}
  .ah .m{width:46px;height:46px;border-radius:14px;background:${C.panel};border:1.5px solid ${C.rule};display:flex;align-items:center;justify-content:center}
  .ah .y{margin-left:auto;font-size:17px;color:${C.faint}}
  .hk{font-size:16px;color:${C.faint};margin-top:34px}
  #appNet{font-size:74px;font-weight:850;letter-spacing:-.045em;color:${C.accent};margin-top:8px;white-space:nowrap}
  #appBar{display:flex;gap:4px;height:16px;border-radius:8px;overflow:hidden;margin-top:20px;transform-origin:left center}
  #appBar i{display:block;border-radius:3px}
  .rows{margin-top:26px}
  .rw{display:flex;justify-content:space-between;align-items:center;padding:17px 0;border-top:1.5px solid ${C.rule};font-size:21px;color:${C.muted}}
  .rw b{color:${C.ink};font-weight:700}
  .rw .d{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:12px}
  .nq{margin-top:26px;display:flex;gap:12px;align-items:flex-start}
  .nq p{font-size:19px;line-height:1.4;color:${C.muted};padding:14px 18px;border-radius:6px 20px 20px 20px;background:${C.panel};border:1.5px solid ${C.rule}}
  .chip{position:absolute;display:flex;align-items:center;gap:14px;padding:18px 28px 18px 20px;border-radius:999px;font-size:30px;font-weight:650;
    background:linear-gradient(180deg,${C.lift}f2,${C.panel}f2);border:1.5px solid ${C.rule};white-space:nowrap;
    box-shadow:0 30px 60px -24px #000, 0 1px 0 #ffffff12 inset}
  .chip .ok{width:40px;height:40px;border-radius:50%;background:${C.ok}22;display:flex;align-items:center;justify-content:center}

  /* 5 · Η ΜΑΡΚΑ: το λογότυπο γράφεται όπως στο public/brand, Inter 800, διάστιχο 0,02em. */
  .ctr{position:absolute;left:150px;right:150px;display:flex;justify-content:center;text-align:center}
  .word{font-size:96px;font-weight:800;letter-spacing:.02em}
  .tag{font-size:54px;font-weight:700;letter-spacing:-.03em;color:${C.ink}}
  .rule{width:64px;height:3px;border-radius:3px;background:${C.accent}}
  .url{font-size:24px;color:${C.faint}}
  #bloom{position:absolute;left:50%;top:760px;width:1200px;height:1200px;margin:-600px 0 0 -600px;border-radius:50%;
    background:radial-gradient(closest-side, ${C.accent}40, transparent);opacity:0}
  </style></head><body>
  <div id="bg"></div>

  <svg id="fx" class="deco" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;inset:0">
    <defs>
      <linearGradient id="gf" gradientUnits="userSpaceOnUse" x1="0" y1="${LEVEL0 - 200}" x2="0" y2="${H}">
        <stop offset="0" stop-color="#c3d8fd"/><stop offset=".14" stop-color="${C.accent}"/><stop offset="1" stop-color="#3f6fc9"/>
      </linearGradient>
    </defs>
    <line id="ghost" x1="0" x2="${W}" y1="${LEVEL0}" y2="${LEVEL0}" stroke="${C.faint}" stroke-width="2" stroke-dasharray="3 11" opacity="0"/>
    <path id="base" fill="url(#gf)"/>
    ${PARTS.map((_, i) => `<path id="sl${i}"/>`).join('')}
    <path id="surf" fill="none" stroke="#ffffff" stroke-width="3" stroke-opacity=".6"/>
  </svg>
  <div id="field"></div>

  <section id="Q">
    <div class="L hdr" id="hdr" style="top:600px">${avatar(124, C.accent, C.onAccent)}<div><div class="nm">${esc(ASSISTANT_NAME)}</div><div class="sub1 mono">ΠΑΡΑΔΕΙΓΜΑ · ${esc(UP(PROP_SPOKEN))}</div></div></div>
    <div class="L" id="cmpw" style="top:820px"><div class="cmp"><span id="typed"></span><i id="caret"></i><span class="send" id="send">${ico.arrow(C.onAccent, 46).replace('M5 12h14M13 6l6 6-6 6', 'M12 19V5M6 11l6-6 6 6')}</span></div></div>
  </section>

  <section id="A">
    <div id="ub">${esc(QUESTION).replace(' στην', '<br>στην')}</div>
    <div class="L nr" id="nr" style="top:480px">${avatar(58, C.accent, C.onAccent)}<span>${esc(ASSISTANT_NAME)}</span><span class="dots" id="dots"><i></i><i></i><i></i></span></div>
    <div class="L" id="ans" style="top:566px">${words(ANSWER, 'w')}</div>
    <div class="L lab mono" style="top:640px;width:900px;height:30px">
      <span id="k0" style="color:${C.muted}">ΕΝΟΙΚΙΑ 12 ΜΗΝΩΝ</span><span id="k1" style="color:${C.muted}">ΑΠΟΜΕΝΟΥΝ</span><span id="k2" style="color:${C.accent}">ΚΑΘΑΡΑ ΣΤΗΝ ΤΣΕΠΗ</span>
    </div>
    <div class="L odo" id="odo" style="top:676px">${digit(3)}<span class="sep">.</span>${digit(2)}${digit(1)}${digit(0)}<span class="tail" id="tail">€</span></div>
    ${PARTS.map((p, i) => `<div class="L" style="top:900px">${mask(`e${i + 1}`, `<span style="color:${p.c}">${esc(p.amount)}</span>`, 'ev')}${mask(`l${i + 1}`, esc(p.label), 'evl mono')}</div>`).join('')}
    <div class="L" style="top:900px">${mask('e4', `<span class="acc">${P_NET}€</span> στα 100€.`, 'ev')}${mask('l4', 'ΜΕΝΟΥΝ ΣΤΗΝ ΤΣΕΠΗ ΣΟΥ', 'evl mono')}</div>
    <div class="L" style="top:${Math.round((LEVEL0 + LEVELS[3]) / 2) - 54}px">${mask('gap', esc(`−${eur(LOST)}`), 'gap')}${mask('gapl', 'ΦΕΥΓΟΥΝ ΜΕΣΑ ΣΤΗ ΧΡΟΝΙΑ', 'evl mono')}</div>
    <div id="pct" class="mono">100%</div>
    <div id="ghostl" class="mono" style="top:${LEVEL0 - 40}px">${esc(STOPS[0].int)}€ · 100%</div>
  </section>

  <section id="B">
    <div class="cc" style="top:640px;color:${C.onAccent}">
      <div class="nr" id="bk">${avatar(58, C.onAccent, C.accent)}<span>${esc(ASSISTANT_NAME)}</span></div>
      <div style="margin-top:44px">${mask('t1a', 'Φορολογείσαι', 'huge')}${mask('t1b', 'στα έσοδα.', 'huge')}</div>
    </div>
  </section>

  <section id="B2">
    <div class="cc" style="top:600px">
      <div>${mask('t2a', 'Όχι σε ό,τι', 'huge')}${mask('t2b', '<span class="acc">σου μένει.</span>', 'huge')}</div>
      <p class="sub" id="t2s" style="margin-top:48px">Για έξοδα η εφορία αφαιρεί μόνο ένα σταθερό ${esc(PRES)} του ενοικίου. <b>Επισκευές, ασφάλιση και ΕΝΦΙΑ δεν μειώνουν τον φόρο.</b></p>
    </div>
  </section>

  <section id="C">
    <div class="cc" style="top:290px">${mask('h1', 'Όλα αυτά,', 'head')}${mask('h2', '<span class="acc">αυτόματα.</span>', 'head')}</div>
    <div id="stage3d" class="deco"><div id="phone"><div class="scr">
      <div class="isl"></div>
      <div class="sb"><span>9:41</span><span class="mono" style="font-size:17px;letter-spacing:.06em">PROPERWISE</span></div>
      <div class="app">
        <div class="ah"><span class="m">${mark(24, C.ink)}</span><span>${esc(DEMO_PROPERTY.name)}</span><span class="y mono">12 ΜΗΝΕΣ</span></div>
        <div class="hk mono">ΚΑΘΑΡΑ ΣΤΗΝ ΤΣΕΠΗ</div>
        <div id="appNet">0€</div>
        <div id="appBar">${[...PARTS.map(p => ({ v: p.v, c: p.c })), { v: NET, c: C.accent }].map(x => `<i style="flex:${x.v};background:${x.c}"></i>`).join('')}</div>
        <div class="rows">
          ${[['Ενοίκια', eur(GROSS), C.ink], ...PARTS.map(p => [p.row, p.amount, p.c])]
            .map(([l, v, c], i) => `<div class="rw" id="rw${i}"><span><i class="d" style="background:${c}"></i>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}
        </div>
      </div>
    </div></div></div>
    ${FEATS.map((f, i) => `<div class="chip" id="c${i}" style="${i % 2 ? 'left:90px' : 'right:150px'};top:${[1110, 1205, 1300, 1395][i]}px"><span class="ok">${ico.check(C.ok, 26)}</span>${esc(f)}</div>`).join('')}
  </section>

  <section id="D">
    <div id="bloom" class="deco"></div>
    <div class="ctr" id="d0" style="top:590px">${mark(150, C.ink)}</div>
    <div class="ctr" style="top:792px">${mask('d1', 'PROPERWISE', 'word')}</div>
    <div class="ctr" id="d3" style="top:935px"><span class="rule"></span></div>
    <div class="ctr" style="top:978px">${mask('d2', esc(TAGLINE), 'tag')}</div>
    <div class="ctr mono url" id="d4" style="top:1150px">PROPERWISE.GR</div>
  </section>

  <div class="vig"></div><div class="grain"></div>
  <script>
  const D = ${JSON.stringify(DATA)};
  const R = D.R;
  const $ = id => document.getElementById(id);
  const cl = x => Math.max(0, Math.min(1, x));
  const p = (t, a, b) => cl((t - a) / (b - a));
  const eo = x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));          // εκθετική έξοδος: γρήγορη αρχή, βελούδινο τέλος
  const ei = x => x * x * x;
  const eio = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const spring = x => (x <= 0 ? 0 : 1 - Math.exp(-6 * x) * Math.cos(8.5 * x));   // με μικρή υπερακόντιση
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, k) => { const x = hex(a), y = hex(b); return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',') + ')'; };
  const tf = (el, s) => { el.style.transform = s; };
  const op = (el, o) => { el.style.opacity = o; };
  let T = 0;

  // Μάσκα: μπαίνει από κάτω, βγαίνει προς τα πάνω.
  const rev = (id, tin, tout, dur) => {
    const el = $(id), d = dur || .6;
    const a = eo(p(T, tin, tin + d));
    const b = tout == null ? 0 : ei(p(T, tout, tout + .3));
    tf(el, 'translateY(' + (110 * (1 - a) - 110 * b) + '%)');
    op(el, a > 0 && b < 1 ? 1 : 0);
  };

  // Η επιφάνεια του υγρού: δύο κύματα που κινούνται αντίθετα, με πλάτος που
  // φουσκώνει σε κάθε αλλαγή στάθμης και σβήνει σε ενάμισι δευτερόλεπτο.
  const amp = t => {
    let a = 2.2;
    [R.fill, ...R.beats.map(b => b + D.DETACH), R.surge].forEach((k, i) => { const s = t - k; if (s > 0) a += (i ? 17 : 22) * Math.exp(-s * 2.3); });
    return a;
  };
  const wave = (x, t, A) => A * (Math.sin(x / 88 + t * 4.4) + .55 * Math.sin(x / 47 - t * 3.3));
  const edge = (y, t, A) => { let d = ''; for (let x = 0; x <= D.W; x += 18) d += (x ? 'L' : 'M') + x + ',' + (y + wave(x, t, A)).toFixed(1); return d; };
  const band = (y0, y1, t, A) => edge(y0, t, A) + 'L' + D.W + ',' + (y1 + 1) + 'L0,' + (y1 + 1) + 'Z';

  // Κοντέρ: κάθε ψηφίο κυλά μόνο του· το ανώτερο γυρίζει τη στιγμή που περνά το κατώτερο.
  function odo(v) {
    for (let k = 0; k < 4; k++) {
      const m = Math.pow(10, k), base = Math.floor(v / m) % 10, low = v % m;
      const off = k === 0 ? v % 10 : base + Math.max(0, low - (m - 1));
      tf($('g' + k), 'translateY(' + (-off) + 'em)');
    }
  }

  window.render = t => {
    T = t;
    const gx = 76 + Math.sin(t * .3) * 10, gy = 10 + Math.cos(t * .27) * 5;
    $('bg').style.background =
      'radial-gradient(900px 760px at ' + gx + '% ' + gy + '%, ' + D.accent + '30, transparent 70%),' +
      'radial-gradient(1100px 900px at ' + (10 + Math.sin(t * .22) * 8) + '% 70%, #3d5fa026, transparent 72%),' +
      'linear-gradient(180deg, #0b1322 0%, ' + D.ground + ' 58%)';

    // ── 1 · Η ερώτηση ──────────────────────────────────────────────────
    // Από το πρώτο καρέ έχει ήδη γραφτεί η πρώτη λέξη: η μικρογραφία λέει κάτι.
    const q = D.QUESTION, first = q.indexOf(' ');
    const typed = Math.round(first + (q.length - first) * p(t, R.type[0], R.type[1]));
    $('typed').textContent = q.slice(0, typed);
    op($('caret'), t < R.type[1] ? 1 : (Math.floor(t / .5) % 2 ? 0 : 1));
    const press = t >= R.send - .15 && t < R.send + .25 ? 1 - .1 * Math.sin(Math.PI * p(t, R.send - .15, R.send + .25)) : 1;
    tf($('send'), 'scale(' + press + ')');
    const outQ = eo(p(t, R.send, R.send + .45));
    op($('Q'), 1 - outQ);
    tf($('hdr'), 'translateY(' + (-60 * outQ) + 'px)');
    tf($('cmpw'), 'translateY(' + (160 * outQ) + 'px) scale(' + (1 - .06 * outQ) + ')');

    // ── 2 · Η απάντηση ─────────────────────────────────────────────────
    const outA = eo(p(t, R.surge, R.surge + .4));
    op($('A'), t >= R.send ? 1 - outA : 0);
    tf($('A'), 'translateY(' + (-90 * outA) + 'px)');
    const ub = eo(p(t, R.send, R.send + .55));
    op($('ub'), ub); tf($('ub'), 'translateY(' + (380 * (1 - ub)) + 'px) scale(' + (.9 + .1 * ub) + ')');
    const nr = eo(p(t, R.answer, R.answer + .4));
    op($('nr'), nr); tf($('nr'), 'translateY(' + (20 * (1 - nr)) + 'px)');
    const dotsOn = t >= R.answer && t < R.stream + .1;
    op($('dots'), dotsOn ? 1 : 0);
    Array.from($('dots').children).forEach((d, i) => tf(d, 'translateY(' + (-7 * Math.max(0, Math.sin((t - R.answer) * 9 - i * .9))) + 'px)'));
    const ws = $('ans').children;
    for (let i = 0; i < ws.length; i++) { const w = eo(p(t, R.stream + i * .11, R.stream + i * .11 + .3)); op(ws[i], w); tf(ws[i], 'translateY(' + (14 * (1 - w)) + 'px)'); }

    // Το γέμισμα: ανεβαίνει με ελατήριο, μετά οι λωρίδες του φεύγουν μία μία.
    const rise = spring(p(t, R.fill, R.fill + 1.1));
    const A = amp(t);
    let detached = 0;
    D.beats.forEach((b, i) => { if (t >= b + D.DETACH) detached = i + 1; });
    const lift = (1 - rise) * (D.H - D.LEVELS[0] + 60);
    D.beats.forEach((b, i) => {
      const tint = eio(p(t, b, b + .3));
      const go = ei(p(t, b + D.DETACH, b + D.DETACH + .5));
      const el = $('sl' + i);
      if (go >= 1 || t < R.fill) { el.setAttribute('d', ''); return; }
      const y0 = D.LEVELS[i] + lift, y1 = D.LEVELS[i + 1] + lift;
      // Η λωρίδα που είναι από πάνω κυματίζει· όσες είναι από κάτω της έχουν ίσιο άκρο.
      el.setAttribute('d', band(y0, y1, go > 0 ? b + D.DETACH : t, i === detached || go > 0 ? A : 0));
      el.setAttribute('fill', tint > 0 ? mix(D.accent, D.colors[i], tint) : 'url(#gf)');
      el.setAttribute('transform', 'translate(' + (-1250 * go) + ',' + (40 * go) + ') rotate(' + (-3 * go) + ' 540 ' + y0 + ')');
    });
    const surge = eo(p(t, R.surge, R.surge + .6));
    const restTop = D.LEVELS[3] + lift + (-80 - D.LEVELS[3]) * surge;
    const gone = t >= R.cut || t < R.fill;
    $('base').setAttribute('d', gone ? '' : band(restTop, D.H, t, detached === 3 || surge > 0 ? A : 0));
    const topY = detached === 3 || surge > 0 ? restTop : D.LEVELS[detached] + lift;
    $('surf').setAttribute('d', gone || surge > .98 ? '' : edge(topY, t, A));
    $('surf').setAttribute('stroke-opacity', String(.6 * (1 - surge)));
    op($('ghost'), eo(p(t, R.beats[0] + D.DETACH, R.beats[0] + D.DETACH + .5)) * (1 - outA));
    op($('ghostl'), eo(p(t, R.beats[0] + D.DETACH + .2, R.beats[0] + D.DETACH + .7)));
    const pct = $('pct');
    pct.textContent = D.PCTS[detached] + '%';
    pct.style.top = (topY + 24 + wave(90, t, A)) + 'px';
    op(pct, eo(p(t, R.fill + .5, R.fill + .9)) * (1 - eo(p(t, R.surge - .1, R.surge + .2))));

    // Ο μετρητής: εμφανίζεται με το γέμισμα και κυλά από στάση σε στάση.
    const odoIn = eo(p(t, R.fill - .2, R.fill + .4));
    op($('odo'), odoIn); tf($('odo'), 'translateY(' + (40 * (1 - odoIn)) + 'px)');
    let v = D.STOPS[0].n, moving = false, stop = 0;
    D.beats.forEach((b, i) => {
      const r = eio(p(t, b + D.ROLL.from, b + D.ROLL.to));
      if (r > 0) v = D.STOPS[i].n + (D.STOPS[i + 1].n - D.STOPS[i].n) * r;
      if (r > 0 && r < 1) moving = true;
      if (r >= 1) stop = i + 1;
    });
    odo(moving ? v : D.STOPS[stop].n);
    $('tail').textContent = moving ? '€' : D.STOPS[stop].tail;
    const res = eo(p(t, R.result, R.result + .6));
    $('odo').style.color = mix(D.ink, D.accent, res);
    // Η λάμψη μπαίνει σε όλο τον αριθμό μαζί· σκιά κειμένου θα την έκοβε το παράθυρο κάθε ψηφίου.
    $('odo').style.filter = res > 0 ? 'drop-shadow(0 24px 70px rgba(138,180,248,' + (.55 * res) + '))' : 'none';
    const mid = eo(p(t, R.beats[0] + D.DETACH, R.beats[0] + D.DETACH + .4));
    op($('k0'), odoIn * (1 - mid)); op($('k1'), mid * (1 - res)); op($('k2'), res);

    // Η γραμμή κάτω από τον μετρητή λέει τι φεύγει τώρα.
    D.beats.forEach((b, i) => {
      const next = i < 2 ? D.beats[i + 1] : R.result;
      rev('e' + (i + 1), b, next - .25, .5); rev('l' + (i + 1), b + .1, next - .25, .5);
    });
    rev('e4', R.result + .05, null); rev('l4', R.result + .17, null);
    rev('gap', R.result + .6, null, .7); rev('gapl', R.result + .75, null, .7);

    // ── 3 · Το γεγονός ─────────────────────────────────────────────────
    // Κάτω από το «Φορολογείσαι» ένα ομοιόμορφο πεδίο: η διαβάθμιση του γεμίσματος θα έκοβε τα γράμματα στη μέση.
    op($('field'), t >= R.cut ? (t < R.cut + .07 ? .9 : 0) : eo(p(t, R.surge + .3, R.surge + .6)));
    op($('B'), t >= R.surge + .2 && t < R.cut ? 1 : 0);
    const bk = eo(p(t, R.surge + .35, R.surge + .75));
    op($('bk'), bk); tf($('bk'), 'translateY(' + (20 * (1 - bk)) + 'px)');
    rev('t1a', R.surge + .45, null); rev('t1b', R.surge + .6, null);
    const punch = 1 + .06 * (1 - eo(p(t, R.cut, R.cut + .7)));
    const outB2 = eo(p(t, R.product - .35, R.product));
    op($('B2'), t >= R.cut && t < R.product ? 1 - outB2 : 0);
    tf($('B2'), 'scale(' + punch + ') translateY(' + (-80 * outB2) + 'px)');
    rev('t2a', R.cut + .02, null); rev('t2b', R.cut + .14, null);
    const s2 = eo(p(t, R.cut + .7, R.cut + 1.2));
    op($('t2s'), s2); tf($('t2s'), 'translateY(' + (30 * (1 - s2)) + 'px)');

    // ── 4 · Η εφαρμογή ─────────────────────────────────────────────────
    const outC = eo(p(t, R.end, R.end + .45));
    op($('C'), t >= R.product - .05 && t < R.end + .5 ? 1 - outC : 0);
    rev('h1', R.product, null); rev('h2', R.product + .12, null);
    const ph = eo(p(t, R.product + .15, R.product + 1.35));
    const float = Math.sin((t - R.product) * 1.5) * 7;
    tf($('phone'), 'translateY(' + (900 * (1 - ph) + float + 60 * outC) + 'px) rotateX(' + (32 - 24 * ph) + 'deg) rotateY(' + (-22 + 13 * ph + Math.sin(t * .8) * 1.2) + 'deg) rotateZ(' + (5 - 5 * ph) + 'deg) scale(' + (1 - .08 * outC) + ')');
    const k = eio(p(t, R.product + .9, R.product + 2));
    $('appNet').textContent = k >= 1 ? D.netRest : D.ints[Math.round(D.appNet * k)];
    tf($('appBar'), 'scaleX(' + eo(p(t, R.product + 1.1, R.product + 2.1)) + ')');
    for (let i = 0; i < 4; i++) { const q2 = eo(p(t, R.product + 1.3 + i * .12, R.product + 1.8 + i * .12)); op($('rw' + i), q2); tf($('rw' + i), 'translateY(' + (18 * (1 - q2)) + 'px)'); }
    for (let i = 0; i < 4; i++) {
      const s = R.product + 1.2 + i * .6, q2 = spring(p(t, s, s + 1.1));
      op($('c' + i), cl(q2 * 1.6)); tf($('c' + i), 'translateY(' + (40 * (1 - q2)) + 'px) scale(' + (.86 + .14 * q2) + ')');
    }

    // ── 5 · Η μάρκα ────────────────────────────────────────────────────
    op($('D'), eo(p(t, R.end + .1, R.end + .4)));
    const m0 = spring(p(t, R.end + .15, R.end + 1.2));
    op($('d0'), cl(m0 * 1.5)); tf($('d0'), 'scale(' + (.7 + .3 * m0) + ')');
    op($('bloom'), .9 * eo(p(t, R.end + .1, R.end + 1.4))); tf($('bloom'), 'scale(' + (.8 + .2 * eo(p(t, R.end, R.end + 2))) + ')');
    rev('d1', R.end + .4, null, .7); rev('d2', R.end + .85, null, .8);
    const q3 = eo(p(t, R.end + .6, R.end + 1.3));
    op($('d3'), q3); tf($('d3'), 'scaleX(' + q3 + ')');
    op($('d4'), eo(p(t, R.end + 1.3, R.end + 1.9)));
  };
  </script>
  </body></html>`;
}

// ── Η λεζάντα ────────────────────────────────────────────────────────────
const CAPTION = [
  `«${QUESTION}» Ρωτήσαμε ${ASSISTANT_ACC}. Με ${eur(Y.monthly)} τον μήνα, από ${eur(GROSS)} ενοίκια τον χρόνο μένουν καθαρά ${eur(NET)}.`,
  '',
  `Στη μακροχρόνια μίσθωση φορολογείσαι στα έσοδα από το ενοίκιο, όχι σε ό,τι σου μένει. Για έξοδα η εφορία αφαιρεί μόνο ένα σταθερό ${PRES}, όσα κι αν ξόδεψες. Επισκευές, ασφάλιση και ΕΝΦΙΑ δεν μειώνουν τον φόρο.`,
  '',
  `Το PROPERWISE κάνει αυτόν τον λογαριασμό για το δικό σου ακίνητο, κάθε μήνα. Φωτογραφίζεις τον λογαριασμό και καταχωρείται. Ρωτάς ${ASSISTANT_ACC} και απαντά με τα δικά σου νούμερα.`,
  '',
  'Αποθήκευσέ το για τη φορολογική δήλωση. Στείλ\' το σε κάποιον που νοικιάζει το σπίτι του.',
  '',
  'Σύνδεσμος στο bio.',
  '',
  `Παράδειγμα με δεδομένα επίδειξης: ${PROP_SPOKEN}, ενοίκιο ${eur(Y.monthly)} τον μήνα για δώδεκα μήνες, φυσικό πρόσωπο, μακροχρόνια μίσθωση, κλίμακα ${S.year}. Για τη δική σου περίπτωση, ο λογιστής σου.`,
  '',
  TAGLINE,
  '',
  '#ακίνητα #ενοίκια #ΕΝΦΙΑ #φορολογία #ιδιοκτήτες',
].join('\n');

/** Ό,τι διαβάζεται τη στιγμή t πρέπει να κάθεται έξω από τις ζώνες του Instagram. */
async function checkSafe(page: Page, t: number): Promise<string[]> {
  await page.evaluate((x: number) => (window as unknown as { render: (t: number) => void }).render(x), t);
  // Ως κείμενο: το tsx ντύνει τις ονομασμένες συναρτήσεις με έναν βοηθό (__name)
  // που μέσα στον περιηγητή δεν υπάρχει.
  return page.evaluate(`(() => {
    const out = [];
    const visible = el => { for (let e = el; e; e = e.parentElement) if (Number(getComputedStyle(e).opacity) < .5) return false; return true; };
    for (const el of Array.from(document.querySelectorAll('section *'))) {
      // Τα ψηφία του κοντέρ που δεν φαίνονται κρύβονται από το παράθυρο του ψηφίου, όχι από διαφάνεια.
      if (el.closest('.deco') || el.closest('.strip')) continue;
      const own = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
      if (!own || !visible(el)) continue;
      const r = el.getBoundingClientRect();
      const right = r.bottom > 1100 ? 940 : 1000;
      if (r.left < 80 || r.right > right || r.top < 250 || r.bottom > 1500)
        out.push(el.textContent.trim().slice(0, 28) + ' [' + Math.round(r.left) + ',' + Math.round(r.top) + '–' + Math.round(r.right) + ',' + Math.round(r.bottom) + ']');
    }
    return out;
  })()`);
}

async function main() {
  mkdirSync(OUT_VIDEO, { recursive: true });
  mkdirSync(OUT_DOC, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] });
  try {
    const open = async () => {
      const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      await pg.setContent(html(), { waitUntil: 'load' });
      await pg.evaluate(() => document.fonts.ready);
      return pg;
    };
    const page = await open();

    // REEL_PREVIEW=0.5,4,11 → μόνο στιγμιότυπα, για να κριθεί η σύνθεση πριν από τα καρέ.
    if (process.env.REEL_PREVIEW) {
      for (const t of process.env.REEL_PREVIEW.split(',').map(Number)) {
        await page.evaluate((x: number) => (window as unknown as { render: (t: number) => void }).render(x), t);
        await page.screenshot({ path: join(OUT_VIDEO, `preview-${t}.png`) });
      }
      return;
    }

    const bad: string[] = [];
    for (const t of [1.2, 3.3, 5.4, 6.6, 7.8, 9.9, 12.6, 15.6, 20.2, 23.5]) bad.push(...(await checkSafe(page, t)).map(m => `${t}s: ${m}`));
    if (bad.length) throw new Error(`Έξω από τις ζώνες:\n  ${bad.slice(0, 30).join('\n  ')}`);

    // Εξώφυλλο: η ερώτηση και η απάντηση μαζί, η στιγμή που λέει όλη την ιστορία.
    await page.evaluate((x: number) => (window as unknown as { render: (t: number) => void }).render(x), REEL.result + 1.8);
    await page.screenshot({ path: join(OUT_DOC, 'cover.jpg'), type: 'jpeg', quality: 94 });

    // Τα καρέ γράφονται από τέσσερα παράθυρα παράλληλα και το ffmpeg τα ενώνει
    // ανά δύο: 60 λήψεις το δευτερόλεπτο γίνονται 30 καρέ με θόλωμα κίνησης.
    const frames = Math.round(DUR * CAPTURE_FPS);
    const dir = join(OUT_VIDEO, 'frames');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const WORKERS = 4;
    let done = 0;
    await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
      const pg = w === 0 ? page : await open();
      for (let f = w; f < frames; f += WORKERS) {
        await pg.evaluate((x: number) => (window as unknown as { render: (t: number) => void }).render(x), f / CAPTURE_FPS);
        await pg.screenshot({ path: join(dir, `${String(f).padStart(5, '0')}.png`) });
        if (++done % 200 === 0) console.log(`  καρέ ${done}/${frames}`);
      }
    }));
    const file = join(OUT_VIDEO, 'reel.mp4');
    const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(CAPTURE_FPS), '-i', join(dir, '%05d.png'),
      '-vf', `tmix=frames=2:weights='1 1',fps=${FPS}`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-movflags', '+faststart', file], { stdio: 'inherit' });
    if ((await new Promise<number>(r => ff.on('close', r))) !== 0) throw new Error('Το ffmpeg απέτυχε.');
    rmSync(dir, { recursive: true, force: true });
    console.log(`✓ ${file}`);
  } finally {
    await browser.close();
  }
  writeFileSync(join(OUT_DOC, 'caption.md'), CAPTION + '\n');
  writeFileSync(join(OUT_DOC, 'README.md'), [
    '# Instagram: το πρώτο reel, «Ρώτα τη Νόα»',
    '',
    'Παράγεται σε δύο βήματα (θέλει ffmpeg με libx264):',
    '',
    '    npx tsx scripts/marketing/reelEnoikio.ts   # η εικόνα',
    '    npx tsx scripts/marketing/reelSound.ts     # η μουσική και το τελικό αρχείο',
    '',
    'Το τελικό βίντεο γράφεται στο `docs/marketing/reels/reel-1/PROPERWISE-reel-1.mp4`, που',
    'μένει έξω από το git. Εδώ μένουν η λεζάντα (`caption.md`) και το εξώφυλλο (`cover.jpg`).',
    '',
    '## Δημοσίευση',
    '',
    `- ${DUR} δευτερόλεπτα, 1080×1920, με πρωτότυπη μουσική συγχρονισμένη με την εικόνα.`,
    '- Εξώφυλλο: το `cover.jpg`.',
    '- Να μοιραστεί και στο πλέγμα του προφίλ, όχι μόνο στα Reels.',
    '',
  ].join('\n'));
  console.log('✓ docs/marketing/instagram/reel-1/');
}

main().catch(e => { console.error(e); process.exit(1); });
