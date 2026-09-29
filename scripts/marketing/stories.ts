// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΠΡΩΤΑ ΤΡΙΑ STORIES ΣΤΟ INSTAGRAM
// ─────────────────────────────────────────────────────────────────────────
// ΧΡΗΣΗ:  npx tsx scripts/marketing/stories.ts
// Γράφει στο docs/marketing/instagram/ τρεις εικόνες 1080×1920 και ένα README
// με τη σειρά, το πότε, το εναλλακτικό κείμενο και πού μπαίνει ο σύνδεσμος.
//
// ΜΙΑ ΙΣΤΟΡΙΑ ΣΕ ΤΡΙΑ ΚΑΡΕ, ΟΧΙ ΤΡΕΙΣ ΑΦΙΣΕΣ. Όποιος βλέπει stories πατά
// δεξιά σε ένα δευτερόλεπτο. Κάθε καρέ λέει ΕΝΑ πράγμα και δείχνει την ίδια
// την εφαρμογή να το κάνει, όχι λίστα με όσα κάνει:
//   1. arxi     τι είναι: το ακίνητο σε τάξη, σε τρεις κάρτες της εφαρμογής
//   2. sarosi   πώς μπαίνουν τα χαρτιά: φωτογραφία, στοιχεία, καταχώρηση
//   3. noa      τι παίρνεις πίσω: μια ερώτηση, μια απάντηση με λογαριασμό
//
// ΚΑΝΕΝΑ ΝΟΥΜΕΡΟ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ. Τα ποσά είναι του ακινήτου επίδειξης
// (lib/demo/sample.ts), περασμένα από τις ΙΔΙΕΣ συναρτήσεις που υπολογίζουν
// τον φόρο του πληρωμένου χρήστη: αυτή είναι η προεπισκόπηση της εφαρμογής,
// όχι ποσά γραμμένα για να εντυπωσιάσουν. Κάθε καρέ με ποσό το λέει ρητά:
// «Παράδειγμα». Η τιμή και το όριο του δωρεάν πακέτου από το PLANS.
//
// ΟΙ ΖΩΝΕΣ ΤΟΥ INSTAGRAM. Πάνω ~220 pixel ζουν η μπάρα προόδου και το όνομα
// του λογαριασμού, κάτω ~250 το πεδίο απάντησης. Τίποτα σημαντικό εκεί. Στο
// τρίτο καρέ μένει άδεια λωρίδα για το αυτοκόλλητο συνδέσμου, που μπαίνει από
// την εφαρμογή του Instagram τη στιγμή της δημοσίευσης.
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { PLANS } from '../../lib/billing/plans';
import { ASSISTANT_ACC, ASSISTANT_INITIAL } from '../../lib/assistant/identity';
import { BRAND_PATHS, BRAND_VIEWBOX } from '../../components/BrandMark';
import { DEMO_PROPERTY, demoExpenses, demoSummary } from '../../lib/demo/sample';
import { expenseAccount } from '../../lib/accounting/journal';
import { categoryLabel } from '../../lib/expenses/taxonomy';
import { fe } from '../../lib/core/format';
import { athensToday } from '../../lib/core/time';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { chromePath } = require('../lib/chrome.mjs');

const ROOT = process.cwd();
const OUT = join(ROOT, 'docs/marketing/instagram');
const W = 1080, H = 1920;

// ── Η παλέτα του shell.ts, με ένα πράσινο μόνο για το «έγινε» ──────────────
const C = {
  ground: '#070b12', panel: '#0e1522', lift: '#131c2c', ink: '#eef2f7', muted: '#bcc6d3', faint: '#8795a8',
  accent: '#8ab4f8', onAccent: '#08111f', rule: '#223044', ok: '#7fd8a8', paper: '#f3f5f9', paperInk: '#1a2332',
};

const FONT_DIR = join(ROOT, 'public/fonts');
const font = (file: string) =>
  `url("data:font/woff2;base64,${readFileSync(join(FONT_DIR, file)).toString('base64')}") format("woff2")`;
const FACES = `
  @font-face{font-family:Inter;src:${font('inter-greek.woff2')};font-weight:100 900;font-display:block}
  @font-face{font-family:Inter;src:${font('inter-latin.woff2')};font-weight:100 900;font-display:block}`;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── Τα γεγονότα, από τις πηγές τους ──────────────────────────────────────
const today = athensToday();
const S = demoSummary(today);
const PROP = DEMO_PROPERTY.name;
// Στην ετικέτα κάρτας το όνομα μένει όπως το γράφει η εφαρμογή («Διαμέρισμα,
// Παγκράτι»). Μέσα σε πρόταση διαβάζεται σαν πεδίο φόρμας· εκεί γίνεται λόγος:
// «το διαμέρισμα στο Παγκράτι».
const [propKind, propArea] = PROP.split(/,\s*/);
const PROP_SPOKEN = propArea ? `${propKind.toLocaleLowerCase('el')} στο ${propArea}` : PROP;
const WATER = demoExpenses(S.year).find(e => e.category === 'water')!;
const WATER_ACC = expenseAccount('water');
const line = (key: string) => S.statement.lines.find(l => l.key === key);
const TAX = S.statement.incomeTax;
const NET = S.statement.netCash;
const FREE = PLANS.free;
const FREE_WORDS = FREE.maxProperties === 1 ? 'για ένα ακίνητο' : `έως ${FREE.maxProperties} ακίνητα`;
if (FREE.priceMonthly !== 0) throw new Error('Το «Ξεκίνα δωρεάν» θέλει δωρεάν πακέτο· το PLANS.free έχει τιμή.');
if (!line('gross')) throw new Error('Η κατάσταση αποτελεσμάτων δεν έχει γραμμή μεικτών εσόδων.');

// ── Εικονίδια, γραμμένα εδώ ώστε να μη χρειάζεται βιβλιοθήκη ─────────────
const ico = {
  check: (c: string, px: number) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>`,
  doc: (c: string, px: number) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>`,
  folder: (c: string, px: number) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M8 13l2.5 2.5L16 10"/></svg>`,
  down: (c: string, px: number) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>`,
  arrow: (c: string, px: number) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
};
const mark = (px: number, fill: string) =>
  `<svg width="${px}" height="${px}" viewBox="${BRAND_VIEWBOX}" fill="${fill}" aria-hidden="true">${BRAND_PATHS.shape.map((d: string) => `<path d="${d}"/>`).join('')}</svg>`;

// Κόκκος: ένα φύλλο θορύβου στο 5%. Χωρίς αυτόν οι λάμψεις του φόντου
// σκαλώνουν σε λωρίδες όταν το Instagram ξανασυμπιέζει την εικόνα.
const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>')}")`;

/** Το κοινό κάδρο: ετικέτα πάνω, σκηνή, σήμα κάτω. Ίδιες θέσεις στα τρία καρέ. */
function frame(label: string, stage: string, css: string, glow: [string, string]): string {
  return `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${FACES}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  body{font-family:Inter,system-ui,sans-serif;color:${C.ink};background:${C.ground};position:relative;
    -webkit-font-smoothing:antialiased;font-feature-settings:"cv11","ss01"}
  .bg{position:absolute;inset:0;background:
    radial-gradient(900px 700px at ${glow[0]}, ${C.accent}2e, transparent 70%),
    radial-gradient(1000px 800px at ${glow[1]}, #3d5fa033, transparent 72%),
    linear-gradient(180deg, #0a1120 0%, ${C.ground} 55%)}
  .grain{position:absolute;inset:0;background-image:${GRAIN};opacity:.05;mix-blend-mode:overlay}
  .ghost{position:absolute;right:-170px;bottom:120px;opacity:.035}
  .wrap{position:absolute;inset:0;padding:232px 88px 0;display:flex;flex-direction:column}
  .label{display:flex;align-items:center;gap:22px;font-size:25px;font-weight:700;letter-spacing:.16em;color:${C.muted}}
  .label i{display:block;width:64px;height:4px;border-radius:4px;background:${C.accent}}
  h1{font-weight:800;letter-spacing:-.042em;line-height:.98;text-wrap:balance}
  .sub{color:${C.muted};font-size:38px;line-height:1.38;letter-spacing:-.01em;text-wrap:pretty}
  .num{font-variant-numeric:tabular-nums;letter-spacing:-.02em}
  .tag{display:inline-flex;align-items:center;gap:10px;font-size:21px;font-weight:600;letter-spacing:.12em;color:${C.faint}}
  .tag::before{content:"";width:8px;height:8px;border-radius:50%;background:${C.faint}}
  .foot{position:absolute;left:88px;right:88px;top:1598px;display:flex;align-items:center;justify-content:space-between}
  .brand{display:flex;align-items:center;gap:16px}
  .brand b{font-size:30px;font-weight:800;letter-spacing:.02em}
  .brand small{display:block;font-size:22px;color:${C.faint};margin-top:3px;letter-spacing:.01em}
  .glass{background:linear-gradient(180deg, ${C.lift}f2, ${C.panel}f2);border:1.5px solid ${C.rule};
    box-shadow:0 1px 0 #ffffff0d inset, 0 50px 120px -40px #000000cc}
  ${css}
  </style></head><body>
  <div class="bg"></div><div class="grain"></div>
  <div class="ghost">${mark(760, C.ink)}</div>
  <div class="wrap">
    <div class="label"><i></i>${esc(label)}</div>
    ${stage}
  </div>
  <div class="foot">
    <div class="brand">${mark(46, C.ink)}<div><b>PROPERWISE</b><small>properwise.gr</small></div></div>
  </div>
  </body></html>`;
}

// ═══ 1. ΑΡΧΗ ═══════════════════════════════════════════════════════════
// Τρεις κάρτες που θα έβλεπε ο ιδιοκτήτης στην οθόνη του μέσα σε μια
// εβδομάδα: μπήκε το ενοίκιο, μπήκε ένας λογαριασμός, είναι έτοιμος ο
// φάκελος. Κλιμακωτές σε βάθος, ώστε να διαβάζονται ως ροή και όχι ως λίστα.
function arxi(): string {
  const card = (icon: string, tint: string, title: string, meta: string, right: string, depth: number) => `
    <div class="card glass" style="transform:translateX(${depth * 26}px) scale(${1 - depth * 0.035});opacity:${1 - depth * 0.1}">
      <div class="ic" style="background:${tint}1f;border-color:${tint}40">${icon}</div>
      <div class="txt"><b>${esc(title)}</b><small>${esc(meta)}</small></div>
      <div class="rt">${right}</div>
    </div>`;
  return frame('ΓΕΙΑ ΣΟΥ, INSTAGRAM', `
    <h1 style="font-size:112px;margin-top:92px"><span style="white-space:nowrap">Το ακίνητό σου,</span><br><span style="color:${C.accent}">σε τάξη.</span></h1>
    <p class="sub" style="margin-top:44px;max-width:880px">Ενοίκια, δαπάνες, φόροι και προθεσμίες.<br>Όλα σε μία εφαρμογή.</p>
    <div class="stack">
      <div class="tag" style="margin-bottom:26px">ΠΑΡΑΔΕΙΓΜΑ</div>
      ${card(ico.check(C.ok, 34), C.ok, 'Ενοίκιο εισπράχθηκε', PROP, `<span class="num">${esc(fe(DEMO_PROPERTY.monthlyRent))}</span>`, 0)}
      ${card(ico.doc(C.accent, 34), C.accent, 'Λογαριασμός καταχωρήθηκε', `${categoryLabel('water')} · ${PROP}`, `<span class="num">${esc(fe(WATER.amount))}</span>`, 1)}
      ${card(ico.folder(C.accent, 34), C.accent, 'Φάκελος για τον λογιστή', 'Με ό,τι λείπει σημειωμένο', `<span class="chip">Έτοιμος</span>`, 2)}
    </div>`, `
    .stack{margin-top:auto;margin-bottom:400px;display:flex;flex-direction:column;gap:22px}
    .card{display:flex;align-items:center;gap:26px;padding:30px 34px;border-radius:34px;transform-origin:left center}
    .ic{flex:none;width:76px;height:76px;border-radius:24px;border:1.5px solid;display:flex;align-items:center;justify-content:center}
    .txt{flex:1;min-width:0}
    .txt b{display:block;font-size:33px;font-weight:700;letter-spacing:-.015em}
    .txt small{display:block;font-size:25px;color:${C.faint};margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .rt{flex:none;font-size:33px;font-weight:750}
    .chip{font-size:23px;font-weight:700;color:${C.ok};background:${C.ok}1a;border:1.5px solid ${C.ok}40;padding:10px 20px;border-radius:999px}`,
  ['85% 12%', '0% 92%']);
}

// ═══ 2. ΣΑΡΩΣΗ ═════════════════════════════════════════════════════════
// Το χαρτί μέσα στο σκόπευτρο της κάμερας και δίπλα του ό,τι διάβασε η
// εφαρμογή. Η γραμμή σάρωσης στέκεται πάνω στο ποσό: εκεί κοιτά το μάτι.
function sarosi(): string {
  const row = (k: string, v: string) => `<div class="row"><span>${esc(k)}</span><b>${v}</b></div>`;
  return frame('ΣΑΡΩΣΗ ΕΓΓΡΑΦΟΥ', `
    <h1 style="font-size:108px;margin-top:92px">Φωτογραφίζεις.<br><span style="color:${C.accent}">Καταχωρείται.</span></h1>
    <p class="sub" style="margin-top:40px;max-width:880px">Λογαριασμοί, αποδείξεις, μισθωτήρια. Ελέγχεις τα στοιχεία και μπαίνουν στη σωστή θέση.</p>
    <div class="scene">
      <div class="finder">
        <i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>
        <div class="paper">
          <div class="p-head"><span class="p-logo"></span><div><b>Λογαριασμός ύδρευσης</b><small>Εκκαθάριση διμήνου</small></div></div>
          <div class="p-lines"><i style="width:88%"></i><i style="width:72%"></i><i style="width:80%"></i><i style="width:56%"></i></div>
          <div class="p-sum"><span>Πληρωτέο ποσό</span><b class="num">${esc(fe(WATER.amount))}</b></div>
          <div class="p-lines" style="margin-top:22px"><i style="width:64%"></i><i style="width:46%"></i></div>
        </div>
        <div class="beam"></div>
      </div>
      <div class="result glass">
        <div class="r-head">${ico.check(C.ok, 30)}<span>Διαβάστηκε</span><span class="tag" style="margin-left:auto">ΠΑΡΑΔΕΙΓΜΑ</span></div>
        ${row('Κατηγορία', esc(categoryLabel('water')))}
        ${row('Ποσό', `<span class="num">${esc(fe(WATER.amount))}</span>`)}
        ${row('Ακίνητο', esc(PROP))}
        ${row('Λογαριασμός', `<span class="num">${esc(WATER_ACC.code)}</span> ${esc(WATER_ACC.name)}`)}
        <div class="r-ok">${ico.check(C.onAccent, 26)}Καταχωρήθηκε</div>
      </div>
    </div>`, `
    .scene{position:relative;margin-top:auto;margin-bottom:380px;height:720px}
    .finder{position:absolute;left:0;top:0;width:500px;height:700px;padding:30px}
    .c{position:absolute;width:64px;height:64px;border:5px solid ${C.accent};border-radius:6px}
    .c.tl{left:0;top:0;border-right:0;border-bottom:0;border-top-left-radius:26px}
    .c.tr{right:0;top:0;border-left:0;border-bottom:0;border-top-right-radius:26px}
    .c.bl{left:0;bottom:0;border-right:0;border-top:0;border-bottom-left-radius:26px}
    .c.br{right:0;bottom:0;border-left:0;border-top:0;border-bottom-right-radius:26px}
    .paper{height:100%;background:${C.paper};color:${C.paperInk};border-radius:18px;padding:40px 38px;transform:rotate(-3deg);
      box-shadow:0 60px 120px -40px #000000e6}
    .p-head{display:flex;align-items:center;gap:18px}
    .p-logo{width:58px;height:58px;border-radius:50%;background:linear-gradient(135deg,#9fb8d6,#5f7fa6)}
    .p-head b{display:block;font-size:24px;white-space:nowrap;font-weight:750;letter-spacing:-.01em}
    .p-head small{display:block;font-size:20px;color:#6a7686;margin-top:4px}
    .p-lines{display:flex;flex-direction:column;gap:16px;margin-top:40px}
    .p-lines i{display:block;height:14px;border-radius:8px;background:#dfe4ec}
    .p-sum{margin-top:40px;padding:22px 24px;border-radius:14px;background:#e7ecf4;display:flex;justify-content:space-between;align-items:baseline}
    .p-sum span{font-size:19px;color:#4b5767;font-weight:600}
    .p-sum b{font-size:36px;font-weight:800}
    .beam{position:absolute;left:14px;right:14px;top:334px;height:4px;border-radius:4px;background:${C.accent};
      box-shadow:0 0 24px 6px ${C.accent}99, 0 0 90px 30px ${C.accent}33}
    .result{position:absolute;right:0;top:200px;width:490px;border-radius:36px;padding:34px 34px 30px;display:flex;flex-direction:column;gap:4px}
    .r-head{display:flex;align-items:center;gap:12px;font-size:25px;font-weight:700;color:${C.ok};padding-bottom:18px;margin-bottom:6px;border-bottom:1.5px solid ${C.rule}}
    .r-head .tag{font-size:17px}
    .row{display:flex;flex-direction:column;gap:4px;padding:14px 0;border-bottom:1.5px solid ${C.rule}80}
    .row > span{font-size:20px;color:${C.faint};letter-spacing:.02em}
    .row b, .row b span{font-size:28px;font-weight:650;letter-spacing:-.01em;line-height:1.25}
    .r-ok{margin-top:22px;display:flex;align-items:center;justify-content:center;gap:12px;padding:20px;border-radius:999px;
      background:${C.accent};color:${C.onAccent};font-size:27px;font-weight:750}`,
  ['15% 40%', '100% 85%']);
}

// ═══ 3. ΝΟΑ ════════════════════════════════════════════════════════════
// Η ερώτηση που κάνει κάθε ιδιοκτήτης και σχεδόν κανείς δεν ξέρει την
// απάντηση: «πόσα μου έμειναν;». Η απάντηση φέρνει και τον λογαριασμό της,
// γραμμή προς γραμμή, από την κατάσταση αποτελεσμάτων του ακινήτου.
function noa(): string {
  const minus = (n: number) => `−${fe(n)}`;
  const led = (k: string, v: string, strong = false) =>
    `<div class="led${strong ? ' strong' : ''}"><span>${esc(k)}</span><b class="num">${esc(v)}</b></div>`;
  return frame('ΨΗΦΙΑΚΟΣ ΒΟΗΘΟΣ', `
    <h1 style="font-size:120px;margin-top:84px">Ρώτα<br><span style="color:${C.accent}">${esc(ASSISTANT_ACC)}.</span></h1>
    <p class="sub" style="margin-top:34px;max-width:880px">Στα ελληνικά. Απαντά με τα νούμερα<br>του δικού σου ακινήτου.</p>
    <div class="chat">
      <div class="tag" style="align-self:flex-end;margin-bottom:18px">ΠΑΡΑΔΕΙΓΜΑ</div>
      <div class="ask">Πόσα μου έμειναν καθαρά πέρσι;</div>
      <div class="reply">
        <div class="av">${ASSISTANT_INITIAL}</div>
        <div class="bubble glass">
          <p>Από το ${esc(PROP_SPOKEN)} σού έμειναν <b class="num" style="color:${C.ink}">${esc(fe(NET))}</b>, μετά από φόρο, ΕΝΦΙΑ και δαπάνες.</p>
          <div class="ledger">
            ${led('Ενοίκια που εισπράχθηκαν', fe(S.collected))}
            ${led('Φόρος εισοδήματος', minus(TAX))}
            ${led('ΕΝΦΙΑ', minus(S.enfia))}
            ${led('Λοιπές δαπάνες', minus(S.otherCash))}
            ${led('Καθαρά στην τσέπη', fe(NET), true)}
          </div>
        </div>
      </div>
    </div>
    <div class="cta"><span><b>Ξεκίνα δωρεάν</b>, ${esc(FREE_WORDS)}.</span>${ico.down(C.accent, 34)}</div>
    <div class="sticker" aria-hidden="true"></div>`, `
    .chat{margin-top:44px;display:flex;flex-direction:column}
    .ask{align-self:flex-end;max-width:84%;padding:24px 32px;border-radius:36px 36px 10px 36px;background:${C.accent};color:${C.onAccent};
      font-size:32px;font-weight:650;letter-spacing:-.01em}
    .reply{margin-top:26px;display:flex;align-items:flex-end;gap:18px}
    .av{flex:none;width:66px;height:66px;border-radius:30%;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;
      background:${C.accent};color:${C.onAccent};box-shadow:0 18px 50px -12px ${C.accent}aa}
    .bubble{flex:1;border-radius:36px 36px 36px 10px;padding:30px 32px}
    .bubble p{font-size:29px;line-height:1.42;color:${C.muted}}
    .ledger{margin-top:22px;padding-top:12px;border-top:1.5px solid ${C.rule}}
    .led{display:flex;justify-content:space-between;align-items:baseline;gap:20px;padding:9px 0;font-size:24px;color:${C.faint}}
    .led b{font-weight:650;color:${C.muted}}
    .led.strong{margin-top:8px;padding-top:16px;border-top:1.5px dashed ${C.rule};color:${C.ink};font-weight:700}
    .led.strong b{color:${C.accent};font-size:30px;font-weight:800}
    .cta{margin-top:40px;display:flex;align-items:center;gap:12px;font-size:32px;color:${C.muted};letter-spacing:-.01em}
    .cta b{color:${C.accent};font-weight:800}
    /* Η ΛΩΡΙΔΑ ΤΟΥ ΑΥΤΟΚΟΛΛΗΤΟΥ. Άδεια επίτηδες: εκεί μπαίνει το Link από την
       εφαρμογή του Instagram, το μόνο που πατιέται μέσα σε story. Ένα
       ζωγραφισμένο κουμπί στη θέση του θα έμοιαζε πατήσιμο και δεν θα ήταν. */
    .sticker{height:118px;margin-top:18px}`,
  ['80% 30%', '5% 70%']);
}

const STORIES = [
  { key: '1-arxi', build: arxi, what: 'Γνωριμία: το ακίνητο σε τάξη',
    alt: `Τρεις κάρτες της εφαρμογής PROPERWISE για το ακίνητο επίδειξης «${PROP}»: ενοίκιο που εισπράχθηκε, λογαριασμός νερού που καταχωρήθηκε, φάκελος για τον λογιστή έτοιμος.` },
  { key: '2-sarosi', build: sarosi, what: 'Σάρωση εγγράφου',
    alt: 'Λογαριασμός ύδρευσης μέσα σε σκόπευτρο κάμερας και δίπλα τα στοιχεία που διάβασε η εφαρμογή: κατηγορία, ποσό, ακίνητο, λογαριασμός, με την ένδειξη «Καταχωρήθηκε».' },
  { key: '3-noa', build: noa, what: 'Ο ψηφιακός βοηθός και το «Ξεκίνα δωρεάν»',
    alt: 'Ερώτηση «Πόσα μου έμειναν καθαρά πέρσι;» και απάντηση του ψηφιακού βοηθού με ανάλυση: ενοίκια, φόρος εισοδήματος, ΕΝΦΙΑ, δαπάνες, καθαρά. Κάτω, «Ξεκίνα δωρεάν» με βέλος προς τον σύνδεσμο.' },
] as const;

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] });
  try {
    for (const st of STORIES) {
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      await page.setContent(st.build(), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      // ΤΙΠΟΤΑ ΣΤΙΣ ΖΩΝΕΣ ΤΟΥ INSTAGRAM ΚΑΙ ΤΙΠΟΤΑ ΕΞΩ ΑΠΟ ΤΟ ΚΑΔΡΟ. Ό,τι πέσει
      // κάτω από τη μπάρα προόδου ή πάνω στο πεδίο απάντησης δεν διαβάζεται.
      const bad = await page.evaluate(([top, bottom]: [number, number]) => {
        const out: string[] = [];
        for (const el of Array.from(document.querySelectorAll('.wrap *, .foot *'))) {
          const r = (el as HTMLElement).getBoundingClientRect();
          if (!r.width || !r.height) continue;
          if (r.left < 40 || r.right > innerWidth - 40 || r.top < top || r.bottom > bottom) out.push(`${(el.textContent || el.tagName).trim().slice(0, 30)} [${Math.round(r.top)}–${Math.round(r.bottom)}]`);
        }
        return out;
      }, [220, H - 250] as [number, number]);
      if (bad.length) throw new Error(`${st.key}: εκτός ασφαλούς ζώνης: ${bad.slice(0, 4).join(' | ')}`);
      await page.screenshot({ path: join(OUT, `${st.key}.png`) });
      await page.close();
      console.log(`  ✓ ${st.key}.png`);
    }
  } finally {
    await browser.close();
  }
  writeFileSync(join(OUT, 'README.md'), [
    '# Instagram: τα πρώτα τρία stories',
    '',
    'Παράγονται από το `npx tsx scripts/marketing/stories.ts`. Μην τα φτιάξεις με το',
    'χέρι: τα ποσά είναι του ακινήτου επίδειξης (`lib/demo/sample.ts`), περασμένα από',
    'τις ίδιες συναρτήσεις με την εφαρμογή· το δωρεάν πακέτο από το `lib/billing/plans.ts`.',
    '',
    '## Σειρά και δημοσίευση',
    '',
    'Και τα τρία την ίδια μέρα, με ένα ώς δύο λεπτά ανάμεσα, με αυτή τη σειρά. Ώρα:',
    'μεσημέρι (13:00-14:00) ή βράδυ (20:00-21:00)· τίποτα δημόσιο μετά τις 21:00.',
    '',
    '',
    ...STORIES.map(st => `- \`${st.key}.png\`: ${st.what}`),
    '',
    'Στο τρίτο, το αυτοκόλλητο συνδέσμου (Link) προς `https://properwise.gr/signup`',
    'μπαίνει στην άδεια λωρίδα κάτω από το «Ξεκίνα δωρεάν» και το βέλος, πάνω από το',
    'σήμα. Κείμενο αυτοκόλλητου: «Ξεκίνα δωρεάν».',
    '',
    '## Εναλλακτικό κείμενο',
    '',
    ...STORIES.map(st => `- \`${st.key}.png\`: ${st.alt}`),
    '',
  ].join('\n'));
  console.log('✓ docs/marketing/instagram/');
}

main().catch(e => { console.error(e); process.exit(1); });
