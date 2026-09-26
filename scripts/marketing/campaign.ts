// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΜΠΑΝΙΑ ΤΗΣ 25.09.2026: ΔΩΡΕΑΝ «ΙΔΙΟΚΤΗΤΗΣ» ΚΑΙ ΝΟΑ ΞΕΧΩΡΙΣΤΑ
// ─────────────────────────────────────────────────────────────────────────
// ΧΡΗΣΗ:  npx tsx scripts/marketing/campaign.ts
// Γράφει στο docs/marketing/kampania/ τις εικόνες και ένα README με το τι
// είναι η καθεμία και πού ανεβαίνει. Ο φάκελος ΜΠΑΙΝΕΙ στο αποθετήριο, όπως
// το docs/marketing/store/: οι εικόνες δεν γερνούν με την ημέρα, γερνούν μόνο
// όταν αλλάξει τιμή· τότε ξανατρέχει το βήμα και η αλλαγή φαίνεται στο diff.
//
// ΤΡΙΑ ΜΗΝΥΜΑΤΑ, ΟΧΙ ΕΝΑ. Οι κορυφαίοι δεν βάζουν σε μία αφίσα όλο τον
// τιμοκατάλογο: κάθε δημιουργικό λέει ΕΝΑ πράγμα σε μισό δευτερόλεπτο.
//   1. dorean     Ο «Ιδιοκτήτης» είναι δωρεάν. Το τεράστιο 0 € κάνει τη δουλειά.
//   2. noa        Η Νόα, ως προϊόν μόνη της: τι ρωτάς, πόσο κοστίζει.
//   3. sygkrisi   Το ίδιο πακέτο με και χωρίς βοηθό, όπως ο διακόπτης της αρχικής.
//
// ΚΑΘΕ ΜΗΝΥΜΑ ΣΕ ΚΑΘΕ ΜΟΡΦΗ ΠΟΥ ΖΗΤΟΥΝ ΟΙ ΠΛΑΤΦΟΡΜΕΣ:
//   feed  1080×1350  Instagram, Facebook (4:5, το ψηλότερο που δέχεται η ροή)
//   story 1080×1920  Stories, Reels, TikTok (9:16)
//   square 1080×1080 LinkedIn, X, Facebook
//   wide  1200×628   διαφήμιση συνδέσμου LinkedIn/Facebook (1,91:1), σε 2×
//
// ΚΑΝΕΝΑ ΝΟΥΜΕΡΟ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ. Τιμές από το PLANS, ερωτήσεις από το
// aiLimits, σαρώσεις από το SCAN_LIMITS, δοκιμή από το TRIAL_DAYS: οι ίδιες
// πηγές με την αρχική και τη βάση (plan_price). Αν αλλάξει η τιμή, αλλάζει
// εδώ μόνη της την επόμενη φορά που τρέχει το βήμα.
//
// Η ΤΑΥΤΟΤΗΤΑ ΕΙΝΑΙ ΤΟΥ scripts/marketing/shell.ts: ναυτικό έδαφος, ένας τόνος,
// η γραμμή τόνου πάνω αριστερά με ετικέτα σε Inter, το σήμα κάτω.
// Προστίθεται ΜΟΝΟ ό,τι χρειάζεται μια διαφήμιση και όχι μια ανακοίνωση: το
// κουμπί (CTA) και η λάμψη του τόνου πίσω από το κεντρικό στοιχείο.
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { PLANS, TRIAL_DAYS } from '../../lib/billing/plans';
import { aiLimitsFor, SCAN_LIMITS } from '../../lib/billing/aiLimits';
import { ASSISTANT_NAME, ASSISTANT_ACC, ASSISTANT_INITIAL } from '../../lib/assistant/identity';
import { brandMarkSvg, BRAND_PATHS, BRAND_VIEWBOX } from '../../components/BrandMark';
import { caps } from './shell';
import { fe } from '../../lib/core/format';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { chromePath } = require('../lib/chrome.mjs');

const ROOT = process.cwd();
const OUT = join(ROOT, 'docs/marketing/kampania');

// ── Η παλέτα του shell.ts (σκούρο), ίδια με τις αναρτήσεις ─────────────────
const C = {
  ground: '#070b12', panel: '#0e1522', ink: '#eef2f7', muted: '#bcc6d3', faint: '#8795a8',
  accent: '#8ab4f8', onAccent: '#08111f', rule: '#223044',
};

const FONT_DIR = join(ROOT, 'public/fonts');
const font = (file: string) =>
  `url("data:font/woff2;base64,${readFileSync(join(FONT_DIR, file)).toString('base64')}") format("woff2")`;
const FACES = `
  @font-face{font-family:Inter;src:${font('inter-greek.woff2')};font-weight:100 900;font-display:block}
  @font-face{font-family:Inter;src:${font('inter-latin.woff2')};font-weight:100 900;font-display:block}
`;

// ── Τα γεγονότα, από τις πηγές τους ──────────────────────────────────────
// Στη διαφήμιση το μηδέν γράφεται «0€» και όχι «0,00€»: δεκαδικά σε μηδέν
// διαβάζονται ως λογιστικό φύλλο. Χωρίς κενό, όπως το «4,99€» δίπλα του και
// όπως κάθε ποσό της εφαρμογής (fe).
const eur = (n: number) => (n === 0 ? '0€' : fe(n));
const FREE = PLANS.free, NOA = PLANS.solo, AI = aiLimitsFor('solo');
const FREE_SCANS = SCAN_LIMITS.free ?? 0;
const TAX = FREE.features.filter(f => !f.startsWith('Σάρωση'));
const SITE_HOST = 'properwise.gr';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── Τα κοινά στοιχεία ────────────────────────────────────────────────────
const check = (px: number) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${C.accent}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>`;
const plus = (px: number) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${C.accent}" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
const mic = (px: number) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${C.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/></svg>`;
const bigMark = (px: number) => `<svg width="${px}" height="${px}" viewBox="${BRAND_VIEWBOX}" fill="${C.ink}" aria-hidden="true">${BRAND_PATHS.shape.map((d: string) => `<path d="${d}"/>`).join('')}</svg>`;

const QUESTIONS = [
  'Πόσα έδωσα σε κοινόχρηστα φέτος;',
  'Ποιος ενοικιαστής μου χρωστά ακόμη;',
  'Τι λήγει αυτόν τον μήνα;',
];

type Size = { key: 'feed' | 'story' | 'square' | 'wide'; w: number; h: number; scale: number };
const SIZES: Size[] = [
  { key: 'feed', w: 1080, h: 1350, scale: 1 },
  { key: 'story', w: 1080, h: 1920, scale: 1 },
  { key: 'square', w: 1080, h: 1080, scale: 1 },
  { key: 'wide', w: 1200, h: 628, scale: 2 },
];

/**
 * Η ΣΕΛΙΔΑ. Το πλαίσιο είναι κοινό σε κάθε δημιουργικό: γραμμή τόνου με
 * ετικέτα πάνω, σκηνή στη μέση, κουμπί και σήμα κάτω. Η λάμψη και το αχνό
 * κτίριο του σήματος πίσω δεξιά είναι η ίδια υπογραφή με τις κάρτες
 * κοινοποίησης (app/og/frame.tsx) και τα εξώφυλλα των προφίλ.
 */
function frame(s: Size, label: string, stage: string, cta: string, css = ''): string {
  const pad = s.key === 'wide' ? 56 : s.key === 'story' ? 96 : 80;
  const story = s.key === 'story';
  return `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${FACES}
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:${s.w}px;height:${s.h}px;overflow:hidden;position:relative;color:${C.ink};background:${C.ground};
    font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;display:flex;flex-direction:column;
    padding:${story ? pad + 60 : pad}px ${pad}px ${story ? pad + 40 : pad}px}
  .glow{position:absolute;inset:0;pointer-events:none;background:
    radial-gradient(${Math.round(s.w * 0.9)}px ${Math.round(s.h * 0.55)}px at 12% -8%, ${C.accent}33, transparent 70%),
    radial-gradient(${Math.round(s.w * 0.8)}px ${Math.round(s.h * 0.5)}px at 110% 108%, ${C.accent}22, transparent 70%)}
  .ghost{position:absolute;right:${-Math.round(s.h * 0.08)}px;bottom:${-Math.round(s.h * 0.1)}px;opacity:${s.key === 'story' ? .03 : .04};pointer-events:none}
  .top{position:relative;display:flex;align-items:center;gap:22px;flex:none}
  .top i{display:block;width:88px;height:6px;background:${C.accent};border-radius:3px}
  .label{font-size:${s.key === 'wide' ? 16 : 21}px;font-weight:700;letter-spacing:.14em;color:${C.muted};white-space:nowrap}
  .stage{position:relative;flex:1;display:flex;flex-direction:column;min-height:0}
  .foot{position:relative;flex:none;display:flex;align-items:center;justify-content:space-between;gap:28px}
  .brand{display:inline-flex;align-items:center;gap:14px;font-size:${s.key === 'wide' ? 21 : 27}px;font-weight:700;letter-spacing:.02em;white-space:nowrap}
  .cta{display:inline-flex;align-items:center;gap:14px;padding:${s.key === 'wide' ? '14px 26px' : '20px 34px'};border-radius:999px;background:${C.accent};color:${C.onAccent};
    font-size:${s.key === 'wide' ? 20 : 28}px;font-weight:750;letter-spacing:-.01em;white-space:nowrap}
  .cta svg{flex:none}
  .brand-wrap{display:flex;flex-direction:column;gap:${s.key === 'wide' ? 4 : 6}px}
  .host{font-size:${s.key === 'wide' ? 15 : 20}px;font-weight:500;color:${C.faint};letter-spacing:.01em;padding-left:${s.key === 'wide' ? 42 : 52}px}
  h1{font-weight:800;letter-spacing:-.035em;line-height:1.02;text-wrap:balance}
  .sub{color:${C.muted};line-height:1.4;text-wrap:pretty}
  .list{display:flex;flex-direction:column}
  .row{display:flex;align-items:center}
  .num{font-variant-numeric:tabular-nums}
  ${css}
  </style></head><body>
  <div class="glow"></div>
  <div class="ghost">${bigMark(Math.round(s.h * 0.62))}</div>
  <div class="top"><i></i><div class="label">${esc(caps(label))}</div></div>
  <div class="stage">${stage}</div>
  <div class="foot">
    <div class="brand-wrap"><div class="brand">${brandMarkSvg(s.key === 'wide' ? 28 : 38, 'currentColor')}PROPERWISE</div><div class="host">${SITE_HOST}</div></div>
    ${cta}
  </div>
</body></html>`;
}

// ΤΟ ΚΟΥΜΠΙ ΛΕΕΙ ΜΙΑ ΠΡΑΞΗ. Η διεύθυνση ζούσε μέσα του σε μονόχωρη γραμματοσειρά
// και το έκανε να διαβάζεται σαν δύο πράγματα· πήγε κάτω από το σήμα.
const arrow = `<svg width="0.9em" height="0.9em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
const ctaPill = (text: string) => `<div class="cta">${esc(text)}${arrow}</div>`;

// ═══ 1. ΔΩΡΕΑΝ ══════════════════════════════════════════════════════════
// Ενα σημείο έντασης: το 0 €. Ο τίτλος το εξηγεί, η λίστα το αποδεικνύει.
function dorean(s: Size): string {
  const label = `Νέο · Πακέτο ${FREE.name}`;
  const title = `Ο «${FREE.name}» είναι πλέον δωρεάν.`;
  const sub = 'Για ένα ακίνητο, με όλα τα φορολογικά του.';
  const items = [...TAX, `Σάρωση εγγράφων: ${FREE_SCANS} τον μήνα`];
  const cta = ctaPill('Ξεκίνα δωρεάν');
  if (s.key === 'wide') {
    return frame(s, label, `
      <div style="flex:1;display:flex;align-items:center;gap:56px">
        <div class="zero num" style="font-size:250px">0<span>€</span></div>
        <div style="display:flex;flex-direction:column;gap:18px;min-width:0">
          <h1 style="font-size:50px">${esc(title)}</h1>
          <div class="list" style="gap:10px">${items.slice(0, 4).map(t => `<div class="row" style="gap:12px;font-size:22px">${check(24)}${esc(t)}</div>`).join('')}</div>
        </div>
      </div>`, cta, ZERO_CSS);
  }
  const big = s.key === 'story' ? 520 : s.key === 'square' ? 330 : 440;
  const h1 = s.key === 'square' ? 70 : 84;
  const showList = s.key !== 'square';
  return frame(s, label, `
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:${s.key === 'story' ? 56 : 34}px">
      <div class="zero num" style="font-size:${big}px">0<span>€</span></div>
      <div style="display:flex;flex-direction:column;gap:18px">
        <h1 style="font-size:${h1}px">${esc(title)}</h1>
        <div class="sub" style="font-size:${s.key === 'square' ? 32 : 38}px">${esc(sub)}</div>
      </div>
      ${showList ? `<div class="list" style="gap:${s.key === 'story' ? 22 : 16}px;padding-top:${s.key === 'story' ? 20 : 6}px">${items.map(t => `<div class="row" style="gap:18px;font-size:${s.key === 'story' ? 36 : 32}px">${check(s.key === 'story' ? 38 : 34)}${esc(t)}</div>`).join('')}</div>` : ''}
    </div>`, cta, ZERO_CSS);
}
const ZERO_CSS = `
  .zero{font-weight:900;line-height:.8;letter-spacing:-.06em;color:${C.accent};display:flex;align-items:flex-start;gap:.04em;
    text-shadow:0 30px 120px ${C.accent}55}
  .zero span{font-size:.42em;font-weight:800;letter-spacing:-.02em;margin-top:.12em}`;

// ═══ 2. ΝΟΑ ═════════════════════════════════════════════════════════════
// Ενα σημείο έντασης: οι ερωτήσεις. Είναι αυτό που ο αναγνώστης αναγνωρίζει
// ως δικό του. Απαντήσεις δεν μπαίνουν: θα έπρεπε να γράφουν ποσά.
function noa(s: Size): string {
  const label = 'Ψηφιακός βοηθός';
  const title = `Γνώρισε ${ASSISTANT_ACC}.`;
  const sub = 'Ρωτάς για το ακίνητό σου στα ελληνικά. Απαντά με τα δικά σου νούμερα.';
  // Τρία στοιχεία που δεν σπάνε στη μέση· το «τον μήνα» το λέει ήδη η τιμή από πάνω.
  const terms = [`${AI.perMonth} ερωτήσεις`, 'σάρωση χωρίς όριο', `δοκιμή ${TRIAL_DAYS} ημερών`]
    .map(t => `<span style="white-space:nowrap">${esc(t)}</span>`).join(' · ');
  const cta = ctaPill(`Δοκίμασε ${ASSISTANT_ACC}`);
  const wide = s.key === 'wide', story = s.key === 'story', square = s.key === 'square';
  const qs = square ? QUESTIONS.slice(0, 2) : QUESTIONS;
  const bubble = wide ? 20 : story ? 36 : 32;
  const chat = `
    <div class="chat">
      <div class="chat-head"><span class="av">${ASSISTANT_INITIAL}</span><span><b>${ASSISTANT_NAME}</b><small>Για τα ακίνητά σου</small></span></div>
      <div class="asks" style="gap:${wide ? 10 : 16}px">${qs.map((q, i) => `<div class="ask" style="font-size:${bubble}px;margin-right:${i * (wide ? 10 : 22)}px;opacity:${1 - i * 0.1}">${esc(q)}</div>`).join('')}</div>
      <div class="in" style="font-size:${wide ? 16 : 26}px"><span>Ρώτα κάτι για το ακίνητό σου…</span>${mic(wide ? 20 : 30)}</div>
    </div>`;
  const price = `
    <div class="offer">
      <div class="row" style="gap:14px;align-items:baseline">
        <span class="amount num" style="font-size:${wide ? 56 : story ? 120 : square ? 84 : 104}px">${esc(eur(NOA.priceMonthly))}</span>
        <span class="sub" style="font-size:${wide ? 20 : 32}px">τον μήνα</span>
      </div>
      <div class="sub" style="font-size:${wide ? 17 : story ? 30 : 26}px">${terms}</div>
    </div>`;
  const head = `
    <div class="row" style="gap:${wide ? 20 : 28}px">
      <div class="mono" style="width:${wide ? 76 : story ? 150 : 124}px;height:${wide ? 76 : story ? 150 : 124}px;font-size:${wide ? 44 : story ? 88 : 72}px">${ASSISTANT_INITIAL}</div>
      <h1 style="font-size:${wide ? 52 : story ? 104 : square ? 76 : 92}px">${esc(title)}</h1>
    </div>`;
  if (wide) {
    return frame(s, label, `
      <div style="flex:1;display:grid;grid-template-columns:1.05fr 1fr;gap:44px;align-items:center">
        <div style="display:flex;flex-direction:column;gap:18px">${head}<div class="sub" style="font-size:22px">${esc(sub)}</div>${price}</div>
        ${chat}
      </div>`, cta, NOA_CSS(true));
  }
  return frame(s, label, `
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:${story ? 60 : square ? 30 : 42}px">
      ${head}
      ${square ? '' : `<div class="sub" style="font-size:${story ? 42 : 36}px">${esc(sub)}</div>`}
      ${chat}
      ${price}
    </div>`, cta, NOA_CSS(false));
}
const NOA_CSS = (wide: boolean) => `
  .mono{flex:none;border-radius:30%;display:flex;align-items:center;justify-content:center;font-weight:800;letter-spacing:-.02em;
    background:${C.accent};color:${C.onAccent};box-shadow:0 24px 80px -20px ${C.accent}aa}
  .chat{background:${C.panel};border:1.5px solid ${C.rule};border-radius:${wide ? 20 : 34}px;padding:${wide ? 18 : 30}px;
    box-shadow:0 40px 120px -50px #000}
  .chat-head{display:flex;align-items:center;gap:${wide ? 12 : 18}px;padding-bottom:${wide ? 12 : 22}px;border-bottom:1.5px solid ${C.rule}}
  .chat-head b{display:block;font-size:${wide ? 17 : 28}px;font-weight:700}
  .chat-head small{display:block;font-size:${wide ? 13 : 21}px;color:${C.muted}}
  .av{flex:none;width:${wide ? 36 : 58}px;height:${wide ? 36 : 58}px;border-radius:30%;display:flex;align-items:center;justify-content:center;
    font-weight:800;font-size:${wide ? 17 : 27}px;background:${C.accent};color:${C.onAccent}}
  .asks{display:flex;flex-direction:column;padding:${wide ? 16 : 26}px 0 ${wide ? 6 : 8}px}
  .ask{margin-left:auto;max-width:92%;padding:${wide ? '10px 16px' : '17px 26px'};border-radius:${wide ? '16px 16px 5px 16px' : '28px 28px 8px 28px'};
    background:${C.accent};color:${C.onAccent};font-weight:550;line-height:1.3}
  .in{margin-top:${wide ? 12 : 20}px;display:flex;align-items:center;justify-content:space-between;gap:16px;
    padding:${wide ? '10px 16px' : '18px 26px'};border-radius:999px;border:1.5px solid ${C.rule};color:${C.faint};background:${C.ground}}
  .offer{display:flex;flex-direction:column;gap:${wide ? 6 : 12}px}
  .amount{font-weight:850;letter-spacing:-.045em;line-height:.9;color:${C.ink}}`;

// ═══ 3. ΣΥΓΚΡΙΣΗ ════════════════════════════════════════════════════════
// Ο διακόπτης της αρχικής, ως αφίσα: ίδιο πακέτο, δύο στήλες, μία διαφορά.
function sygkrisi(s: Size): string {
  const label = `Πακέτο ${FREE.name}`;
  // Δύο προτάσεις, δύο σειρές: η ζύγιση έστελνε το «Με» στην πρώτη.
  const title = ['Ένα πακέτο.', 'Με ή χωρίς βοηθό.'];
  const cta = ctaPill('Ξεκίνα δωρεάν');
  const story = s.key === 'story', square = s.key === 'square', wide = s.key === 'wide';
  const fs = wide ? 17 : square ? 22 : story ? 30 : 24;
  const ic = wide ? 20 : square ? 24 : story ? 32 : 26;
  const col = (name: string, amount: string, per: string, rows: string[], on: boolean) => `
    <div class="col${on ? ' on' : ''}">
      <div class="col-name" style="font-size:${fs}px">${on ? `<span class="dot">${ASSISTANT_INITIAL}</span>` : ''}${esc(name)}</div>
      <div style="display:flex;flex-direction:column;gap:${wide ? 4 : 8}px">
        <span class="amt num" style="font-size:${wide ? 54 : square ? 70 : 92}px">${esc(amount)}</span>
        <span class="sub" style="font-size:${fs}px;white-space:nowrap">${esc(per)}</span>
      </div>
      <div class="list" style="gap:${wide ? 8 : 14}px">${rows.map(r => `<div class="row" style="gap:12px;font-size:${fs}px;line-height:1.25">${r.startsWith('+') ? plus(ic) : check(ic)}<span>${esc(r.replace(/^\+ /, ''))}</span></div>`).join('')}</div>
    </div>`;
  const offRows = [...(square || wide ? TAX.slice(0, 3) : TAX), `Σάρωση: ${FREE_SCANS} τον μήνα`];
  const onRows = [`+ ${ASSISTANT_NAME}: ${AI.perMonth} ερωτήσεις τον μήνα`, '+ Σάρωση χωρίς όριο', 'Όλα όσα έχει το δωρεάν'];
  return frame(s, label, `
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:${story ? 64 : wide ? 22 : 40}px">
      <h1 style="font-size:${wide ? 44 : square ? 66 : story ? 92 : 80}px">${title.map(esc).join('<br>')}</h1>
      <div class="cols" style="gap:${wide ? 16 : 22}px;${story ? 'grid-template-columns:1fr' : ''}">
        ${col('Χωρίς βοηθό', eur(0), 'χωρίς συνδρομή', offRows, false)}
        ${col(`Με ${ASSISTANT_ACC}`, eur(NOA.priceMonthly), 'τον μήνα', onRows, true)}
      </div>
    </div>`, cta, `
    .cols{display:grid;grid-template-columns:1fr 1fr}
    .col{display:flex;flex-direction:column;gap:${wide ? 12 : 22}px;padding:${wide ? 20 : 34}px;border-radius:${wide ? 18 : 30}px;
      background:${C.panel};border:1.5px solid ${C.rule}}
    .col.on{border:2px solid ${C.accent};box-shadow:0 40px 120px -60px ${C.accent}}
    .col-name{display:flex;align-items:center;gap:12px;font-weight:700;color:${C.muted}}
    .col.on .col-name{color:${C.accent}}
    .dot{width:1.5em;height:1.5em;border-radius:30%;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:.85em;
      background:${C.accent};color:${C.onAccent}}
    .amt{font-weight:850;letter-spacing:-.045em;line-height:.9}`);
}

const CONCEPTS = [
  { key: 'dorean', what: `Ο «${FREE.name}» δωρεάν`, build: dorean, sizes: SIZES },
  { key: 'noa', what: `${ASSISTANT_NAME}, ο ψηφιακός βοηθός`, build: noa, sizes: SIZES },
  { key: 'sygkrisi', what: 'Με ή χωρίς βοηθό', build: sygkrisi, sizes: SIZES.filter(s => s.key !== 'wide') },
] as const;

const WHERE: Record<Size['key'], string> = {
  feed: 'Instagram και Facebook, ανάρτηση στη ροή (4:5)',
  story: 'Stories, Reels, TikTok (9:16)',
  square: 'LinkedIn, X, Facebook (1:1)',
  wide: 'Διαφήμιση συνδέσμου LinkedIn και Facebook (1,91:1)',
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] });
  const index: string[] = [];
  try {
    for (const c of CONCEPTS) {
      index.push(`## ${c.what}`, '');
      for (const s of c.sizes) {
        const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.scale });
        await page.setContent(c.build(s), { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        // ΤΙΠΟΤΑ ΔΕΝ ΞΕΧΕΙΛΙΖΕΙ. Κείμενο που βγαίνει από το κάδρο κόβεται
        // σιωπηλά στο PNG· εδώ σταματά το βήμα με το όνομα της εικόνας.
        const spill = await page.evaluate(() => {
          const out: string[] = [];
          for (const el of Array.from(document.querySelectorAll('.stage *, .foot *'))) {
            const r = (el as HTMLElement).getBoundingClientRect();
            if (r.width && (r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5 || r.left < -0.5)) out.push((el.textContent || el.tagName).slice(0, 40));
          }
          const stage = document.querySelector('.stage') as HTMLElement;
          if (stage.scrollHeight > stage.clientHeight + 1) out.push(`σκηνή ${stage.scrollHeight} > ${stage.clientHeight}`);
          return out;
        });
        if (spill.length) throw new Error(`${c.key}-${s.key}: ξεχειλίζει: ${spill.slice(0, 3).join(' | ')}`);
        const file = `${c.key}-${s.key}.png`;
        await page.screenshot({ path: join(OUT, file) });
        await page.close();
        index.push(`- \`${file}\`: ${WHERE[s.key]}, ${s.w * s.scale}×${s.h * s.scale}`);
        console.log(`  ✓ ${file}`);
      }
      index.push('');
    }
  } finally {
    await browser.close();
  }
  writeFileSync(join(OUT, 'README.md'), [
    '# Καμπάνια: δωρεάν «Ιδιοκτήτης» και Νόα',
    '',
    'Παράγεται από το `npx tsx scripts/marketing/campaign.ts`. Μην τις φτιάξεις',
    'με το χέρι: τιμές, ερωτήσεις και σαρώσεις έρχονται από το `lib/billing/plans.ts`',
    'και το `lib/billing/aiLimits.ts`, τις ίδιες πηγές με την αρχική. Οι λεζάντες',
    'ζουν στο `docs/marketing/keimena/kampania-*.md`.',
    '',
    ...index,
  ].join('\n'));
  console.log(`✓ ${index.filter(l => l.startsWith('- ')).length} εικόνες στο docs/marketing/kampania/`);
}

main().catch(e => { console.error(e); process.exit(1); });
