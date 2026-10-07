// ═══════════════════════════════════════════════════════════════════════════
// REEL · «ΠΟΥ ΠΗΓΑΝ ΤΑ ΕΝΟΙΚΙΑ;» — ΤΟ CAROUSEL ΤΟΥ ΚΑΘΑΡΟΥ ΣΕ ΚΙΝΗΣΗ
// ─────────────────────────────────────────────────────────────────────────
// ΧΡΗΣΗ:  npx tsx scripts/marketing/reelKathara.ts   (FFMPEG με libx264)
//         REEL_PREVIEW=1,5,9  → μόνο στιγμιότυπα του reel.
//         STORIES_ONLY=1      → μόνο τα επτά stories.
//
// Το carousel «Πού πήγαν τα …;» (carousel.ts) ως reel ενός λεπτού: το
// αγκίστρι με τα δύο ποσά, ο φόρος στα έσοδα, τα έξοδα που δεν εκπίπτουν, ο
// καταρράκτης, τα 100€ που κόβονται στα τέσσερα, η εφαρμογή, η ερώτηση. Και
// επτά stories σχεδιασμένα ως αφίσες, όχι καρέ του βίντεο.
//
// ΕΝΑ ΣΥΣΤΗΜΑ. Τίτλοι 84–104 με διάστιχο −0,03em, ήρωας-αριθμός 156, τιμές
// 34–48, ετικέτες 26 (ποτέ μικρότερες, ποτέ αραιότερες από .12em). Κάνναβος
// 8px, γωνίες 12 / 20 / 28. Είσοδοι με εκθετική έξοδο στο μισό δευτερόλεπτο·
// ελατήριο μόνο σε ό,τι έχει βάρος, βαρύτητα μόνο σε ό,τι πέφτει. Ένα φως
// (ο προβολέας του κιτ) και κόκκος· η σκόνη και οι λάμψεις του κιτ σβήνουν
// εδώ με CSS, χωρίς να αλλάξει το κιτ για τα άλλα reels.
//
// ΤΑ ΧΡΩΜΑΤΑ ΕΙΝΑΙ ΤΟΥ CAROUSEL: ενοίκιο σχιστόλιθος, φόρος σομόν, ΕΝΦΙΑ
// κεχριμπάρι, έξοδα λιλά, καθαρά το μπλε της μάρκας (rentFacts.SEG).
//
// ΚΑΝΕΝΑ ΝΟΥΜΕΡΟ ΜΕ ΤΟ ΧΕΡΙ. Όλα από το ακίνητο επίδειξης μέσα από την
// incomeStatement (rentFacts.ts), ίδια με το carousel. Ότι τα έξοδα δεν
// αλλάζουν τον φόρο δεν το λέμε απλώς: το ξαναϋπολογίζουμε χωρίς αυτά.
// ═══════════════════════════════════════════════════════════════════════════
import { join } from 'node:path';
import { statSync, rmSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { PLANS } from '../../lib/billing/plans';
import { ASSISTANT_ACC } from '../../lib/assistant/identity';
import { DEMO_PROPERTY } from '../../lib/demo/sample';
import { incomeStatement } from '../../lib/accounting/statement';
import { fe, feWhole, fpRate } from '../../lib/core/format';
import { C, esc, mark, GRAIN } from './igKit';
import { BASE_CSS } from './reelKit';
import { BEAT, A, head, make, KIT_CSS, TAGLINE, type Explainer } from './explainerKit';
import {
  S, GROSS, PRESUMPTIVE, TAXABLE, TAX, ENFIA, OTHER, NET, RATE, PRES, TAXED_SHARE, PROP_SPOKEN, UP, LOST,
  eur, TOP, REST, REST_SUM, P_TAX, P_ENFIA, P_OTHER, P_NET, SEG, PARTS, BR,
} from './rentFacts';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { chromePath } = require('../lib/chrome.mjs');

// ── Τα γεγονότα ──────────────────────────────────────────────────────────
const cents = (x: number) => Math.round(x * 100) / 100;
const L1 = cents(GROSS - TAX), L2 = cents(L1 - ENFIA);
if (Math.abs(L2 - OTHER - NET) > .01) throw new Error('Ο καταρράκτης δεν καταλήγει στα καθαρά.');
// Τα έξοδα δεν αγγίζουν τον φόρο: ίδια κατάσταση, μία φορά με τα έξοδα και μία χωρίς.
const taxOf = (enfia: number, other: number) => {
  const l = incomeStatement({ regime: 'individual_longterm', grossIncome: GROSS, enfia, otherCashExpenses: other, brackets: BR })
    .lines.find(x => x.key === 'incomeTax');
  if (!l) throw new Error('Η κατάσταση δεν έχει γραμμή φόρου.');
  return l.amount;
};
const CUT = cents(taxOf(0, 0) - taxOf(ENFIA, OTHER));
if (CUT !== 0) throw new Error('Τα έξοδα αλλάζουν πια τον φόρο· η σκηνή των αποδείξεων λέει το αντίθετο.');
if (Math.abs(taxOf(ENFIA, OTHER) - TAX) > .01) throw new Error('Ο φόρος του reel δεν είναι ο φόρος του carousel.');
const FREE = PLANS.free;
if (FREE.priceMonthly !== 0) throw new Error('Η κάρτα λέει «δωρεάν»· το PLANS.free έχει τιμή.');
const FREE_WORDS = FREE.maxProperties === 1 ? 'για ένα ακίνητο' : `έως ${FREE.maxProperties} ακίνητα`;
const DEMO_1 = 'Παράδειγμα με δεδομένα επίδειξης';
const DEMO_2 = `Φυσικό πρόσωπο · μακροχρόνια μίσθωση · ${S.year}`;
// Η μονάδα της σκηνής 5. Τα μερίδια είναι ακέραια ευρώ μόνο γιατί αθροίζουν σε 100.
const UNIT = 100;
if (P_TAX + P_ENFIA + P_OTHER + P_NET !== UNIT) throw new Error('Τα μερίδια δεν αθροίζουν στα 100€.');
if (PARTS.map(x => x.k).join() !== 'tax,enfia,other,net') throw new Error('Η σειρά των κομματιών άλλαξε.');
const PCT = (n: number) => fpRate(n);
const NEG = (n: number) => `−${eur(n)}`;
const PROP_CAP = PROP_SPOKEN.charAt(0).toLocaleUpperCase('el') + PROP_SPOKEN.slice(1);

// ── Ο χρόνος ─────────────────────────────────────────────────────────────
const SC = [0, 11, 26, 41, 53, 66, 79].map(b => b * BEAT);
const END = 85 * BEAT, DUR = 90 * BEAT;

// ── Μετρητές: κάθε ενδιάμεση τιμή μορφοποιείται εδώ, με τη μορφή της εφαρμογής ──
const STEPS = 24;
const run = (a: number, b: number, fmt: (n: number) => string = eur) =>
  Array.from({ length: STEPS + 1 }, (_, s) => fmt(cents(a + (b - a) * s / STEPS)));
const pctRun = (a: number, b: number) => Array.from({ length: STEPS + 1 }, (_, s) => PCT(Math.round(a + (b - a) * s / STEPS)));
const negRun = (to: number) => run(0, to, n => (n ? NEG(n) : eur(0)));

// ── Σύστημα ──────────────────────────────────────────────────────────────
const SLATE = '#56719c';          // το ενοίκιο, πριν μοιραστεί
const LIGHT = '#8199c0';          // το φορολογητέο
const EXEMPT_FILL = '#1a2840';    // η σταθερή έκπτωση: αχνό μπλε με περίγραμμα
const RED = '#c23b3b';            // μελάνι σφραγίδας πάνω σε χαρτί
const R = { s: 12, m: 20, l: 28 };
const NET_GRAD = `linear-gradient(180deg,#a9c8ff,${C.accent} 45%,#5f8fe0)`;
const LABELS = { tax: 'Φόρος εισοδήματος', enfia: 'ΕΝΦΙΑ', other: 'Επισκευές και έξοδα', net: 'Σου μένουν' } as Record<string, string>;

// ═══ Συστατικά: το ίδιο σχέδιο για το reel και για τα stories ═══════════
// Με `fin` το συστατικό γράφεται στην τελική του κατάσταση (story). Χωρίς
// αυτό γράφεται στην αρχική του κατάσταση και η κίνηση του reel το στήνει καρέ καρέ.

// ── Τα εκατό τετράγωνα ───────────────────────────────────────────────────
const TILES = 100;
const EXEMPT = Math.round(PRESUMPTIVE / GROSS * TILES);
if (Math.abs(EXEMPT - PRESUMPTIVE / GROSS * TILES) > 1e-9) throw new Error('Η σταθερή έκπτωση δεν είναι ακέραιο πλήθος τετραγώνων.');
interface GridG { x: number; y: number; t: number; g: number; lx: number; lw: number }
const tileKind = (i: number) => (i >= TILES - EXEMPT ? 'ex' : i < P_TAX ? 'tax' : 'base');
const gridSide = (g: GridG) => 10 * g.t + 9 * g.g;
const grid = (g: GridG, fin: boolean) => `
  <div class="tg" id="tg" style="left:${g.x}px;top:${g.y}px;grid-template-columns:repeat(10,${g.t}px);gap:${g.g}px">${Array.from({ length: TILES }, (_, i) => {
    const k = tileKind(i);
    const st = !fin ? '' : k === 'ex' ? `background:${EXEMPT_FILL};box-shadow:inset 0 0 0 2px ${C.accent}` : `background:${k === 'tax' ? SEG.tax : LIGHT}`;
    return `<i id="t${i}" style="width:${g.t}px;height:${g.t}px;${st}"></i>`;
  }).join('')}</div>
  ${[
    { id: 'lg0', rows: [0, 1], sw: `background:${SEG.tax}`, n: PCT(P_TAX), t: 'Φόρος' },
    { id: 'lg1', rows: [2, 8], sw: `background:${LIGHT}`, n: TAXED_SHARE, t: 'Φορολογητέο' },
    { id: 'lg2', rows: [9, 9], sw: `background:${EXEMPT_FILL};box-shadow:inset 0 0 0 2px ${C.accent}`, n: PRES, t: 'Χωρίς φόρο' },
  ].map(l => {
    const cy = g.y + ((l.rows[0] + l.rows[1]) / 2) * (g.t + g.g) + g.t / 2;
    return `<div class="lg" id="${l.id}" style="left:${g.lx}px;top:${cy - 28}px;width:${g.lw}px"><i class="sw" style="${l.sw}"></i><b>${esc(l.n)}</b><span class="lb">${esc(l.t)}</span></div>`;
  }).join('')}`;

const LEDGER: [string, string, string][] = [
  ['Έσοδα από ενοίκια', eur(GROSS), ''],
  [`Σταθερή έκπτωση ${PRES} για επισκευές`, NEG(PRESUMPTIVE), ''],
  ['Φορολογητέο εισόδημα', eur(TAXABLE), ''],
  [`Φόρος εισοδήματος ${RATE}`, NEG(TAX), SEG.tax],
];
const ledger = (x: number, y: number, w: number) => `
  <div class="card ledger" id="ld" style="left:${x}px;top:${y}px;width:${w}px">
    ${LEDGER.map(([k, v, c], i) => `<div class="lr" id="lr${i}"${c ? ` style="color:${C.ink}"` : ''}><span>${c ? `<i class="dot" style="background:${c}"></i>` : ''}${esc(k)}</span><b${i === 3 ? ' id="ltx"' : ''}${c ? ` style="color:${c}"` : ''}>${esc(v)}</b></div>`).join('')}
  </div>`;

// ── Η κάρτα του φόρου και οι τέσσερις αποδείξεις ─────────────────────────
const taxCard = (x: number, y: number, w: number, fin: boolean) => `
  <div class="card taxc" id="tc" style="left:${x}px;top:${y}px;width:${w}px">
    <div class="tr"><span>Φόρος εισοδήματος<small>με τη σταθερή έκπτωση ${esc(PRES)}</small></span><b style="color:${SEG.tax}">${esc(eur(TAX))}</b></div>
    <div class="tr" id="tz"${fin ? '' : ' style="opacity:0"'}><span>Μείωση φόρου από τις αποδείξεις:</span><b>${esc(feWhole(CUT))}</b></div>
    <i class="tline" id="tln"></i>
  </div>`;
interface Receipt { head: string; lines: [string, number][]; total: number }
const RC: Receipt[] = [
  { head: 'ΕΝΦΙΑ', lines: [], total: ENFIA },
  { head: UP(TOP[0].label), lines: [], total: TOP[0].amount },
  { head: UP(TOP[1].label), lines: [], total: TOP[1].amount },
  { head: `ΑΛΛΕΣ ${REST.length} ΔΑΠΑΝΕΣ`, lines: REST.map(r => [r.label, r.amount] as [string, number]), total: REST_SUM },
];
if (Math.abs(RC.reduce((s, r) => s + r.total, 0) - ENFIA - OTHER) > .01) throw new Error('Οι αποδείξεις δεν αθροίζουν στα έξοδα της χρονιάς.');
const RC_ROT = [-1.2, 1, -.8, 1.1];
interface Slot { x: number; y: number; w: number; h?: number }
const receipt = (r: Receipt, k: number, s: Slot, fin: boolean) => `
  <div class="rc" id="r${k}" style="left:${s.x}px;top:${s.y}px;width:${s.w}px;${s.h ? `height:${s.h}px;` : ''}z-index:${k + 2};${fin ? `transform:rotate(${RC_ROT[k]}deg)` : ''}">
    <div class="rh">${esc(r.head)}</div>
    ${r.lines.length ? `<div class="rl">${r.lines.map(([l, a]) => `<div><span>${esc(UP(l))}</span><span>${esc(fe(a))}</span></div>`).join('')}</div>` : ''}
    <div class="rs"><span class="st" id="st${k}"${fin ? ' style="opacity:1;transform:rotate(-4deg)"' : ''}>ΔΕΝ ΕΚΠΙΠΤΕΙ</span></div>
    <div class="rt"><span>ΣΥΝΟΛΟ</span><b>${esc(fe(r.total))}</b></div>
  </div>`;
/** Αριστερά οι τρεις μικρές, δεξιά η μακριά, κεντραρισμένη στο ύψος τους. */
const receiptSlots = (x: number, y: number, w: number, gap: number, shortH: number, longH: number): Slot[] => {
  const cw = (w - gap) / 2, colH = 3 * shortH + 2 * 16;
  return [0, 1, 2].map((k): Slot => ({ x, y: y + k * (shortH + 16), w: cw, h: shortH }))
    .concat([{ x: x + cw + gap, y: y + Math.round((colH - longH) / 2), w: cw }]);
};
const SHORT_H = 185, LONG_H = 470;

// ── Ο καταρράκτης ────────────────────────────────────────────────────────
interface WfG { x: number; y: number; w: number; top: number; base: number; colW: number }
const WB = [
  { k: 'Ενοίκια', lo: 0, hi: GROSS, c: SLATE, val: run(0, GROSS), fin: eur(GROSS) },
  { k: 'Φόρος', lo: L1, hi: GROSS, c: SEG.tax, val: negRun(TAX), fin: NEG(TAX) },
  { k: 'ΕΝΦΙΑ', lo: L2, hi: L1, c: SEG.enfia, val: negRun(ENFIA), fin: NEG(ENFIA) },
  { k: 'Έξοδα', lo: NET, hi: L2, c: SEG.other, val: negRun(OTHER), fin: NEG(OTHER) },
  { k: 'Καθαρά', lo: 0, hi: NET, c: C.accent, val: run(0, NET), fin: eur(NET) },
];
const waterfall = (g: WfG, fin: boolean) => {
  const pitch = (g.w - g.colW) / 4, wy = (v: number) => g.base - (g.base - g.top) * v / GROSS;
  return `<div class="wf" id="wf" style="left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.base + 70}px">
    <i class="base" id="wbase" style="top:${g.base}px"></i>
    ${[GROSS, L1, L2, NET].map((lvl, i) => `<i class="cn" id="cn${i}" style="left:${i * pitch + g.colW}px;top:${wy(lvl) - 1}px;width:${pitch - g.colW}px"></i>`).join('')}
    ${WB.map((b, i) => {
      const x = i * pitch, top = wy(b.hi), h = wy(b.lo) - top, net = i === 4;
      return `<i class="wb${net ? ' net' : ''}" id="wb${i}" style="left:${x}px;top:${top}px;width:${g.colW}px;height:${h}px;--c:${b.c}"></i>
        <span class="wv${net ? ' net r' : i === 0 ? ' l' : ''}" id="wv${i}" style="left:${i === 0 ? x : net ? x + g.colW : x + g.colW / 2}px;top:${top - 54}px;color:${net ? C.accent : i === 0 ? C.ink : b.c}">${esc(fin ? b.fin : b.val[0])}</span>
        <span class="wk${net ? ' net' : ''}" id="wk${i}" style="left:${x + g.colW / 2}px;top:${g.base + 18}px">${esc(b.k)}</span>`;
    }).join('')}
  </div>`;
};

// ── Τα 100€: μία πλάκα που κόβεται σε τέσσερις ζώνες ─────────────────────
// ΚΑΝΕΝΑ ΣΧΕΔΙΟ ΧΑΡΤΟΝΟΜΙΣΜΑΤΟΣ. Ένα αντικείμενο από γυαλί και μέταλλο με
// χαραγμένο «100€», που κόβεται σε ζώνες ανάλογες με τα μερίδια.
interface SlabG { x: number; y: number; w: number; h: number; gap: number; lx: number; lw: number }
const bands = (g: SlabG) => {
  let off = 0;
  return PARTS.map((x, k) => {
    const h = Math.round(g.h * x.p / UNIT * 10) / 10, b = { k, top: off, h, cy: g.y + off + k * g.gap + h / 2 };
    off += h;
    return b;
  });
};
const slab = (g: SlabG, mode: 'whole' | 'cut' | 'reel') => {
  const B = bands(g), cut = mode === 'cut';
  const radius = (k: number) => cut ? `${R.s}px` : `${k === 0 ? R.l : 0}px ${k === 0 ? R.l : 0}px ${k === 3 ? R.l : 0}px ${k === 3 ? R.l : 0}px`;
  return `<div class="slab" id="sl" style="left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h + 3 * g.gap}px">
    ${B.map(b => `<div class="band" id="nb${b.k}" style="top:${b.top}px;height:${b.h}px;border-radius:${radius(b.k)};${cut ? `transform:translateY(${b.k * g.gap}px)` : ''}">
      <i class="bm" style="background-size:${g.w}px ${g.h}px,${g.w}px ${g.h}px;background-position:0 ${-b.top}px,0 ${-b.top}px"></i>
      <i class="bt" id="bt${b.k}" style="background:${b.k === 3 ? NET_GRAD : `linear-gradient(180deg,${PARTS[b.k].c},color-mix(in srgb,${PARTS[b.k].c} 72%,#0a1220))`};opacity:${cut ? 1 : 0}"></i>
      <i class="gh" id="bg${b.k}"></i></div>`).join('')}
    ${mode === 'cut' ? '' : `<div class="eng" id="eng" style="top:${Math.round(g.h * .38)}px"><b>${UNIT}€</b></div>`}
    ${mode === 'reel' ? B.slice(1).map(b => `<i class="cut" id="cut${b.k}" style="top:${b.top - 1.5}px"></i>`).join('') : ''}
    <i class="sglow" id="sgl" style="top:${B[3].top + 3 * g.gap}px;height:${B[3].h}px;opacity:${cut ? .5 : 0}"></i>
  </div>
  ${mode === 'whole' ? '' : B.map(b => {
    const x = PARTS[b.k], net = x.k === 'net';
    return `<div class="sll${net ? ' net' : ''}" id="sll${b.k}" style="left:${g.lx}px;top:${b.cy - 28}px;width:${g.lw}px"><i class="ld" id="sld${b.k}"></i><span>${esc(LABELS[x.k])}</span><b style="color:${net ? C.accent : x.c}">${esc(feWhole(x.p))}</b></div>`;
  }).join('')}`;
};

// ── Το κινητό ────────────────────────────────────────────────────────────
const FEATS = ['Σάρωση λογαριασμών', 'Φόρος και ΕΝΦΙΑ', 'Φάκελος για τον λογιστή', `Ρώτα ${ASSISTANT_ACC}`];
const APP_ROWS: [string, string][] = [
  ['Ενοίκια', eur(GROSS)],
  ['Φόρος και ΕΝΦΙΑ', NEG(TAX + ENFIA)],
  ['Επισκευές και έξοδα', NEG(OTHER)],
];
interface PhoneG { x: number; y: number; w: number; visible: number }
const phone = (g: PhoneG) => `
  <div id="ph" class="deco" style="left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.visible + 260}px;
    -webkit-mask-image:linear-gradient(180deg,#000 ${g.visible - 70}px,transparent ${g.visible}px)"><div class="scr"><div class="isl"></div><div class="ap">
    <div class="ah" id="ah"><span class="m">${mark(30, C.ink)}</span><b>${esc(DEMO_PROPERTY.name)}</b><span class="y">${S.year}</span></div>
    ${APP_ROWS.map(([k, v], i) => `<div class="ar" id="ar${i}"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}
    <div class="abig" id="abg"><span>Σου μένουν</span><div><b id="anet">${esc(eur(NET))}</b><em>${PCT(P_NET)}</em></div></div>
    <div class="abar">${PARTS.map((x, k) => `<i id="ab${k}" style="flex:${x.v};background:${k === 3 ? C.accent : x.c}"></i>`).join('')}</div>
    <div class="chips">${FEATS.map((f, k) => `<span id="ac${k}">${esc(f)}</span>`).join('')}</div>
  </div></div></div>`;

// ═══ Οι θέσεις του reel ══════════════════════════════════════════════════
const HB = { y: 840, h: 180, gap: 8 };
const hbw = (v: number) => (850 - HB.gap * 3) * v / GROSS;
const LOST_W = PARTS.slice(0, 3).reduce((s, x) => s + hbw(x.v), 0) + 2 * HB.gap;
const LV = [GROSS, L1, L2, NET];
const PV = [UNIT, UNIT - P_TAX, UNIT - P_TAX - P_ENFIA, P_NET];
const HOOK_N = LV.slice(0, 3).map((a, k) => run(a, LV[k + 1], n => `${eur(n)}.`));
const HOOK_P = PV.slice(0, 3).map((a, k) => pctRun(a, PV[k + 1]));
const DROP = [.6, 1.1, 1.55];
const HIT_Q = 2.6;

const G1: GridG = { x: 90, y: 656, t: 44, g: 6, lx: 0, lw: 0 };
G1.lx = G1.x + gridSide(G1) + 32; G1.lw = 940 - G1.lx;
const RS = receiptSlots(90, 812, 850, 24, SHORT_H, LONG_H);
const RC_T = RC.map((_, k) => .9 + k * .85);
const CONTACT = 803;
const HIT_ZERO = 5.2;
const WFG: WfG = { x: 90, y: 600, w: 850, top: 84, base: 736, colW: 128 };
const WF_T = [.6, 1.45, 2.1, 2.75, 3.5];
const SLG: SlabG = { x: 90, y: 688, w: 300, h: 672, gap: 10, lx: 410, lw: 520 };
const HIT_NET = 3.3;
const HAND = SC[5] - .5, LAND = SC[5] + 1.05;
const PHG: PhoneG = { x: 162, y: 612, w: 756, visible: 804 };

const HTML = `
  <!-- 1 · Το αγκίστρι: ορατό από το πρώτο καρέ -->
  <section id="s0">
    <div class="L eb mono" id="e0" style="top:340px"><i></i>ΠΑΡΑΔΕΙΓΜΑ · ${esc(UP(PROP_SPOKEN))}</div>
    <div class="L hd" style="top:384px;font-size:84px">
      <div class="mk"><div class="mi" id="q0">${esc(eur(GROSS))} ενοίκια.</div></div>
      <div class="mk"><div class="mi" id="q1">Σου μένουν</div></div>
    </div>
    <div class="L hd" style="top:562px;font-size:156px;letter-spacing:-.035em">
      <div class="mk"><div class="mi" id="q2"><span class="a" id="hn">${esc(HOOK_N[0][0])}</span></div></div>
    </div>
    <div class="L row" id="hlr" style="top:${HB.y - 46}px;width:850px"><span class="lb">Το ενοίκιο της χρονιάς</span><span class="lb strong" id="hp">${PCT(UNIT)}</span></div>
    <div class="hb" id="hb" style="top:${HB.y}px;height:${HB.h}px;gap:${HB.gap}px">${PARTS.map((x, k) => `<div class="hs" style="width:${hbw(x.v)}px"><i class="gh" id="hg${k}"></i><i class="fl" id="hf${k}"></i></div>`).join('')}</div>
    <div class="bk deco" id="hbk" style="top:${HB.y + HB.h + 20}px;width:${LOST_W}px"></div>
    <div class="L qq" style="top:1110px">
      <div class="mk"><div class="mi" id="q3">Πού πήγαν</div></div>
      <div class="mk"><div class="mi" id="q4">τα <b>${esc(eur(LOST))}</b>;</div></div>
    </div>
  </section>

  <!-- 2 · Φόρος στα έσοδα -->
  <section id="s1">
    ${head(1, 'Ο ΦΟΡΟΣ', ['Φόρος στα έσοδα,', A('όχι στα καθαρά.')], 92, 384)}
    <div class="L lb" id="tl" style="top:604px">Κάθε τετράγωνο: ${PCT(UNIT / TILES)} του ενοικίου</div>
    ${grid(G1, false)}
    ${ledger(90, 1172, 850)}
  </section>

  <!-- 3 · Τα έξοδα δεν μειώνουν τον φόρο -->
  <section id="s2">
    ${head(2, 'ΤΑ ΕΞΟΔΑ', ['Τα έξοδα δεν', A('μειώνουν τον φόρο.')], 88, 384)}
    ${taxCard(90, 592, 850, false)}
    ${RC.map((r, k) => receipt(r, k, RS[k], false)).join('')}
  </section>

  <!-- 4 · Ο καταρράκτης -->
  <section id="s3">
    ${head(3, 'Ο ΛΟΓΑΡΙΑΣΜΟΣ', ['Από τα ενοίκια', A('στην τσέπη.')], 96, 384)}
    ${waterfall(WFG, false)}
  </section>

  <!-- 5 · Από κάθε 100€ ενοικίου -->
  <section id="s4">
    ${head(4, 'ΤΟ ΑΠΟΤΕΛΕΣΜΑ', [`Από κάθε ${UNIT}€`, 'ενοικίου,', A(`σου μένουν ${P_NET}€.`)], 88, 384)}
    ${slab(SLG, 'reel')}
  </section>

  <!-- 6 · Η εφαρμογή -->
  <section id="s5">
    ${head(5, 'ΣΤΟ PROPERWISE', [`Όλο αυτό, ${A('αυτόματα.')}`], 84, 384)}
    <div class="L sub2" id="c5" style="top:496px;width:850px">Το PROPERWISE κάνει αυτόν τον λογαριασμό για <b>το δικό σου ακίνητο</b>, κάθε μήνα.</div>
    ${phone(PHG)}
  </section>

  <!-- 7 · Η ερώτηση -->
  <section id="s6">
    ${head(6, 'ΤΟ ΔΙΚΟ ΣΟΥ ΑΚΙΝΗΤΟ', ['Εσύ ξέρεις', 'πόσα σου μένουν', A('καθαρά;')], 104, 560)}
    <div class="L lb" id="ql" style="top:936px">Το δικό σου ενοίκιο</div>
    <div class="qb deco" id="qb" style="left:90px;top:980px;height:${HB.h}px"><i id="qs"></i></div>
  </section>

  <div class="foot" id="demo" style="top:1428px"><i></i><span>${esc(DEMO_1)}<br>${esc(DEMO_2)}</span></div>
  <i id="carry" class="deco"></i>`;

// ── Το CSS: κοινό για reel και stories ───────────────────────────────────
const CSS = `
  /* Το φόντο: ένα φως (ο προβολέας) και κόκκος. Χωρίς σκόνη, χωρίς λάμψεις. */
  #dust,#amb{display:none}
  #bg{background:linear-gradient(180deg,#0b1424 0%,#080d17 55%,#070b12 100%)!important}
  #spot{background:radial-gradient(closest-side,rgba(138,180,248,.2),rgba(138,180,248,.06) 55%,transparent)}
  /* Τυπογραφία: ετικέτες 26, αραίωση ως .12em, τίτλοι στο −0,03em. */
  .eb{font-size:26px;letter-spacing:.12em;gap:18px}
  .eb i{width:44px}
  #top .br{font-size:26px;letter-spacing:.12em}
  .hd{letter-spacing:-.03em}
  .lb{font-size:26px;font-weight:500;line-height:1.3;color:#9eabc0;white-space:nowrap}
  .lb.strong{font-weight:700;color:${C.ink}}
  .foot{position:absolute;left:90px;display:flex;gap:16px;align-items:stretch;font-size:22px;line-height:1.4;color:#8a98ad}
  .foot i{flex:none;width:3px;border-radius:2px;background:${C.accent}88}
  .card{border-radius:${R.m}px}

  /* 1 · Αγκίστρι */
  .hb{position:absolute;left:90px;width:850px;display:flex}
  .hs{position:relative;height:100%}
  .hs i{position:absolute;inset:0;border-radius:${R.m}px}
  .hs .gh{border:2px dashed rgba(188,198,211,.4);opacity:0}
  .hs .fl{background:${SLATE};box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 40px 80px -30px rgba(0,0,0,.85)}
  .bk{position:absolute;left:90px;height:28px;border:2px solid rgba(188,198,211,.55);border-top:0;border-radius:0 0 ${R.s}px ${R.s}px;transform-origin:50% 0}
  .qq{font-size:84px;font-weight:800;letter-spacing:-.03em;line-height:1.02;white-space:nowrap}
  .qq b{color:${SEG.tax};font-weight:800}

  /* 2 · Τετράγωνα και καθολικό */
  .tg{position:absolute;display:grid}
  .tg i{display:block;border-radius:${R.s}px;background:${SLATE};box-shadow:inset 0 1px 0 rgba(255,255,255,.16)}
  .lg{position:absolute;display:flex;align-items:center;gap:14px;height:56px}
  .lg .sw{flex:none;width:28px;height:28px;border-radius:8px}
  .lg b{font-size:40px;font-weight:800;letter-spacing:-.02em;line-height:1}
  .ledger{position:absolute;padding:8px 32px}
  .lr{display:flex;justify-content:space-between;align-items:baseline;padding:9px 0;font-size:28px;line-height:1.25;color:#aebbd0;border-top:1px solid rgba(255,255,255,.08)}
  .lr:first-child{border-top:0}
  .lr b{font-weight:750;color:${C.ink}}
  .dot{display:inline-block;width:16px;height:16px;border-radius:4px;margin-right:14px;vertical-align:middle}

  /* 3 · Κάρτα φόρου και αποδείξεις */
  .taxc{position:absolute;padding:16px 32px 18px}
  .taxc .tr{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:8px 0}
  .taxc .tr + .tr{border-top:1px solid rgba(255,255,255,.08)}
  .taxc .tr span{font-size:30px;font-weight:650;line-height:1.2}
  .taxc .tr small{display:block;font-size:26px;font-weight:500;color:#9eabc0;margin-top:4px}
  .taxc .tr b{font-size:48px;font-weight:850;letter-spacing:-.02em}
  .tline{position:absolute;left:32px;right:32px;bottom:0;height:3px;border-radius:2px;background:${SEG.tax};opacity:.5}
  .rc{position:absolute;padding:22px 24px 20px;color:#272c35;font-family:'Roboto Mono',monospace;display:flex;flex-direction:column;
    background:linear-gradient(180deg,#f8f6f0,#f0ede5 70%,#e9e5dc);
    filter:drop-shadow(0 30px 40px rgba(0,0,0,.45)) drop-shadow(0 2px 2px rgba(0,0,0,.3));
    -webkit-mask:linear-gradient(#000,#000) 0 8px/100% calc(100% - 16px) no-repeat,
      conic-gradient(from 135deg at 50% 0,#000 90deg,#0000 0) top/16px 8px repeat-x,
      conic-gradient(from -45deg at 50% 100%,#000 90deg,#0000 0) bottom/16px 8px repeat-x}
  .rc:before{content:'';position:absolute;inset:0;background-image:${GRAIN};opacity:.16;mix-blend-mode:multiply}
  .rh{font-size:23px;font-weight:700;letter-spacing:.02em;white-space:nowrap;padding-bottom:12px;border-bottom:2px dashed rgba(39,44,53,.4)}
  .rl{padding:10px 0 8px;font-size:23px;letter-spacing:.01em;line-height:1.45}
  .rl div{display:flex;justify-content:space-between;gap:14px}
  .rs{flex:1;display:flex;align-items:center;justify-content:flex-end;min-height:48px;border-bottom:3px double rgba(39,44,53,.55)}
  .st{display:inline-block;padding:5px 12px;border:3px solid ${RED};border-radius:8px;color:${RED};font-size:23px;font-weight:700;letter-spacing:.06em;
    opacity:0;mix-blend-mode:multiply;-webkit-mask-image:${GRAIN},linear-gradient(#000,#000);-webkit-mask-size:200px,100%;-webkit-mask-composite:source-over}
  .rt{display:flex;justify-content:space-between;align-items:baseline;padding-top:10px;font-size:23px;font-weight:700;letter-spacing:.06em}
  .rt b{font-size:36px;letter-spacing:-.01em}

  /* 4 · Καταρράκτης */
  .wf{position:absolute}
  .wf .base{position:absolute;left:0;right:0;height:2px;background:rgba(188,198,211,.35);transform-origin:0 50%}
  .wb{position:absolute;display:block;border-radius:${R.s}px;transform-origin:50% 100%;
    background:linear-gradient(180deg,var(--c),color-mix(in srgb,var(--c) 70%,#0a1220));box-shadow:inset 0 1px 0 rgba(255,255,255,.3)}
  .wb.net{background:${NET_GRAD}}
  .wv{position:absolute;transform:translateX(-50%);font-size:34px;font-weight:800;letter-spacing:-.02em;white-space:nowrap;line-height:42px}
  .wv.l{transform:none} .wv.r{transform:translateX(-100%)}
  .wk{position:absolute;transform:translateX(-50%);white-space:nowrap;font-size:28px;font-weight:600;color:#aebbd0}
  .wk.net{color:${C.accent}}
  .cn{position:absolute;height:2px;background:rgba(220,228,240,.32);transform-origin:0 50%}

  /* 5 · Η πλάκα των 100€ */
  .slab{position:absolute;isolation:isolate}
  .band{position:absolute;left:0;right:0;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 30px 60px -20px rgba(0,0,0,.6)}
  .band i{position:absolute;inset:0;border-radius:inherit}
  .bm{background-image:linear-gradient(118deg,rgba(255,255,255,0) 28%,rgba(255,255,255,.13) 44%,rgba(255,255,255,0) 58%),linear-gradient(165deg,#5a76a3 0%,#33496f 48%,#1d2b47 100%)}
  .bm:after{content:'';position:absolute;inset:0;background-image:${GRAIN};opacity:.12;mix-blend-mode:overlay}
  .bt{opacity:0}
  .gh{border:2px dashed rgba(188,198,211,.42);opacity:0}
  .eng{position:absolute;left:0;right:0;text-align:center}
  .eng b{font-size:112px;font-weight:850;letter-spacing:-.04em;color:rgba(240,245,255,.92);text-shadow:0 2px 0 rgba(0,0,0,.25),0 -1px 0 rgba(255,255,255,.25)}
  .cut{position:absolute;left:-14px;right:-14px;height:3px;border-radius:2px;background:#fff;box-shadow:0 0 16px rgba(255,255,255,.8);transform:scaleX(0);transform-origin:0 50%}
  .sglow{position:absolute;left:0;right:0;border-radius:${R.s}px;background:${C.accent};filter:blur(46px);z-index:-1}
  .sll{position:absolute;display:flex;align-items:center;gap:16px;height:56px}
  .sll .ld{flex:none;width:44px;height:2px;background:rgba(220,228,240,.4);transform-origin:0 50%}
  .sll span{flex:1;font-size:30px;font-weight:600;color:#c3cddb;white-space:nowrap}
  .sll b{font-size:44px;font-weight:850;letter-spacing:-.02em}
  .sll.net span{color:${C.accent};font-weight:750}

  /* 6 · Κινητό, σε μεγέθη πραγματικής εφαρμογής */
  #ph{position:absolute;border-radius:96px 96px 0 0;padding:16px 16px 0;
    background:linear-gradient(145deg,#4a5568,#161d2a 38%,#2d3648);box-shadow:0 80px 140px rgba(0,0,0,.7),inset 0 0 0 2px rgba(255,255,255,.09)}
  #ph .scr{position:relative;width:100%;height:100%;border-radius:80px 80px 0 0;overflow:hidden;background:linear-gradient(180deg,#0e1626,#070b12 70%)}
  #ph .isl{position:absolute;left:50%;top:22px;width:168px;height:48px;margin-left:-84px;border-radius:26px;background:#000}
  #ph .ap{padding:96px 40px 0}
  #ph .ah{display:flex;align-items:center;gap:16px;font-size:30px;margin-bottom:12px}
  #ph .ah .m{width:56px;height:56px;border-radius:16px;background:${C.panel};border:1.5px solid ${C.rule};display:flex;align-items:center;justify-content:center}
  #ph .ah b{font-weight:700}
  #ph .ah .y{margin-left:auto;font-size:26px;color:${C.faint};font-family:'Roboto Mono',monospace}
  #ph .ar{display:flex;justify-content:space-between;align-items:baseline;padding:13px 2px;border-top:1.5px solid ${C.rule};font-size:30px;color:${C.muted}}
  #ph .ar b{font-weight:700;color:${C.ink}}
  #ph .abig{margin-top:12px;padding:18px 24px;border-radius:${R.m}px;background:${C.accent}14;border:1.5px solid ${C.accent}55}
  #ph .abig span{font-size:26px;color:#a9bad3}
  #ph .abig div{display:flex;justify-content:space-between;align-items:baseline}
  #ph .abig b{font-size:66px;font-weight:850;letter-spacing:-.03em;color:${C.accent};line-height:1.1}
  #ph .abig em{font-style:normal;font-size:28px;font-weight:700;color:${C.accent}}
  #ph .abar{display:flex;gap:6px;height:22px;margin-top:20px}
  #ph .abar i{display:block;border-radius:6px;transform-origin:0 50%}
  #ph .chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}
  #ph .chips span{font-size:26px;color:${C.muted};padding:9px 18px;border-radius:999px;border:1.5px solid ${C.rule}}
  #carry{position:absolute;left:0;top:0;width:10px;height:10px;opacity:0;background:${NET_GRAD};
    box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 0 50px ${C.accent}66;transform-origin:0 0}

  /* 7 · Η ερώτηση */
  .qb{position:absolute;width:850px;border-radius:${R.m}px;border:2px dashed rgba(138,180,248,.55);overflow:hidden}
  .qb i{position:absolute;top:0;bottom:0;width:260px;background:linear-gradient(90deg,transparent,rgba(138,180,248,.2),transparent)}`;

const JS = `
    const fin = (id, u, s, d, dy) => { const v = eo(p(u, s, s + (d || .55))); op($(id), v); tf($(id), 'translateY(' + ((dy == null ? 28 : dy) * (1 - v)) + 'px)'); return v; };
    const cnt = (id, arr, u, s, e) => { $(id).textContent = arr[Math.round(eo(p(u, s, e)) * (arr.length - 1))]; };
    const rgb = h => hex(h), mx = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k), css = a => 'rgb(' + a.map(Math.round).join(',') + ')';
    const oq = x => 1 - (1 - x) * (1 - x);
    // Γεωμετρία της παράδοσης: μετριέται μία φορά, πριν από οποιονδήποτε μετασχηματισμό.
    if (!window.G) {
      const cam = $('cam').getBoundingClientRect(), r = id => { const b = $(id).getBoundingClientRect(); return { x: b.left - cam.left, y: b.top - cam.top, w: b.width, h: b.height }; };
      window.G = { n: r('nb3'), b: r('ab3') };
    }
    const G = window.G;
    op($('demo'), 1 - eo(p(t, S[6] - .3, S[6] + .2)));
    $('m4').textContent = D.free; $('m4').style.color = '${C.accent}';

    // ── 1 · Το αγκίστρι: το ενοίκιο λιγοστεύει μπροστά σου ─────────────
    u = scene(0);
    { const e = $('e0'), v = eo(p(t, -.3, .2)); op(e, v); tf(e, 'translateX(' + (-24 * (1 - v)) + 'px)'); }
    [-.8, -.7, -.6].forEach((s, k) => rev('q' + k, s, null, .55));
    { let ph = 0; for (let k = 0; k < 3; k++) if (t >= D.drop[k]) ph = k;
      const s = D.drop[ph], i = Math.round(eo(p(t, s, s + .45)) * ${STEPS});
      $('hn').textContent = D.hookN[ph][i]; $('hp').textContent = D.hookP[ph][i]; }
    // Πρώτο καρέ: μία συμπαγής μπάρα. Μετά ραγίζει στα τέσσερα κομμάτια της.
    const crack = eo(p(t, .1, .45));
    for (let k = 0; k < 4; k++) {
      const f = $('hf' + k), rl = k ? 20 * crack : 20, rr = k < 3 ? 20 * crack : 20;
      f.style.borderRadius = rl + 'px ' + rr + 'px ' + rr + 'px ' + rl + 'px';
      f.style.right = (k < 3 ? -${HB.gap} * (1 - crack) : 0) + 'px';
      if (k < 3) {
        const s = D.drop[k], tint = eo(p(t, s - .25, s)), fall = ei(p(t, s, s + .5));
        f.style.background = css(mx(rgb('${SLATE}'), rgb(D.seg[k]), tint));
        op(f, 1 - fall); tf(f, 'translateY(' + (180 * fall) + 'px) rotate(' + ((k - 1) * 6 * fall) + 'deg)');
        op($('hg' + k), eo(p(t, s + .15, s + .55)));
      } else {
        // Ό,τι μένει γίνεται μπλε: το χρώμα των καθαρών σε όλο το reel.
        const v = eo(p(t, 2.0, 2.4));
        f.style.background = v >= 1 ? '${NET_GRAD}' : css(mx(rgb('${SLATE}'), rgb('${C.accent}'), v));
        f.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.3),0 0 ' + (60 * v) + 'px rgba(138,180,248,' + (.35 * v) + ')';
      }
    }
    { const v = eo(p(t, 2.1, 2.5)); op($('hbk'), v); tf($('hbk'), 'scaleY(' + v + ')'); }
    $('hp').style.color = t > 2.0 ? '${C.accent}' : '';
    rev('q3', 2.3, null, .55); rev('q4', 2.42, null, .55); shine($('q2'), 2.7);

    // ── 2 · Ο φόρος: εκατό τετράγωνα, ένα για κάθε 1% του ενοικίου ─────
    u = scene(1); heads(1);
    op($('tl'), eo(p(u, .5, .9)));
    { const A0 = rgb('${SLATE}'), A1 = rgb('${LIGHT}'), A2 = rgb('${SEG.tax}'), AX = rgb('${EXEMPT_FILL}');
      for (let i = 0; i < D.tiles; i++) {
        const r = Math.floor(i / 10), c = i % 10, el = $('t' + i);
        const v = eo(p(u, .6 + (r + c) * .035, .6 + .35 + (r + c) * .035));
        let col = A0, ring = 0;
        if (i >= D.tiles - D.exempt) { const j = i - D.tiles + D.exempt, g = eo(p(u, 1.9 + j * .08, 2.2 + j * .08)); col = mx(A0, AX, g); ring = g; }
        else {
          col = mx(A0, A1, eo(p(u, 2.8 + (r + c) * .02, 3.1 + (r + c) * .02)));
          if (i < D.ptax) col = mx(col, A2, eo(p(u, 3.6 + i * .05, 3.9 + i * .05)));
        }
        el.style.background = css(col);
        el.style.boxShadow = ring > .01 ? 'inset 0 0 0 2px rgba(138,180,248,' + ring + ')' : '';
        op(el, v); tf(el, 'scale(' + (.7 + .3 * v) + ')');
      } }
    [['lg2', 2.0], ['lg1', 2.9], ['lg0', 3.7]].forEach(([id, s]) => { const v = eo(p(u, s, s + .5)); op($(id), v); tf($(id), 'translateX(' + (24 * (1 - v)) + 'px)'); });
    fin('ld', u, 1.3, .6, 40);
    [1.4, 2.0, 2.9, 3.7].forEach((s, i) => fin('lr' + i, u, s, .5, 14));
    cnt('ltx', D.taxRun, u, 3.7, 4.5);

    // ── 3 · Τα έξοδα: οι αποδείξεις χτυπούν στη γραμμή του φόρου ────────
    u = scene(2); heads(2);
    fin('tc', u, .45, .6, 30);
    op($('tz'), eo(p(u, D.hitZero, D.hitZero + .45)));
    { let bump = 0, glow = 0;
      for (let k = 0; k < 4; k++) {
        const s = D.rcT[k], tc = s + .4, el = $('r' + k), Q = D.rs[k], rot0 = D.rot[k];
        if (u < s) { op(el, 0); continue; }
        op(el, 1);
        const cx = (540 - (Q.x + Q.w / 2)) * .3, cy = ${CONTACT} - Q.y;
        let x, y, rot;
        if (u < tc) { const q = oq(p(u, s, tc)); x = cx * q; y = lerp(1960 - Q.y, cy, q); rot = rot0 * 5 * (1 - q) - rot0; }
        else { const q = spring(p(u, tc, tc + .9)); x = cx * (1 - q); y = cy * (1 - q); rot = lerp(-rot0, rot0, q); }
        tf(el, 'translate(' + x + 'px,' + y + 'px) rotate(' + rot + 'deg)');
        if (u > tc) { const d = u - tc; bump += Math.exp(-d * 14) * Math.sin(d * 42) * 7; glow = Math.max(glow, Math.exp(-d * 5)); }
        const sv = ei(p(u, tc - .1, tc)); op($('st' + k), sv > 0 ? 1 : 0);
        tf($('st' + k), 'rotate(-4deg) scale(' + (1.9 - .9 * sv) + ')');
      }
      if (u > .45) tf($('tc'), 'translateY(' + (-bump) + 'px)');
      op($('tln'), .5 + .5 * glow); $('tln').style.boxShadow = '0 0 ' + (24 * glow) + 'px ${SEG.tax}'; }

    // ── 4 · Ο καταρράκτης ───────────────────────────────────────────────
    u = scene(3); heads(3);
    { const v = eo(p(u, .35, .9)); tf($('wbase'), 'scaleX(' + v + ')'); }
    { const em = eo(p(u, 4.4, 5.0));
      for (let i = 0; i < 5; i++) {
        const s = D.wfT[i], el = $('wb' + i);
        if (i === 0 || i === 4) { const v = eo(p(u, s, s + .7)); tf(el, 'scaleY(' + v + ')'); op(el, v > 0 ? (i === 4 ? 1 : 1 - .3 * em) : 0); }
        else { const v = eo(p(u, s, s + .55)); op(el, v * (1 - .3 * em)); tf(el, 'translateY(' + (-110 * (1 - v)) + 'px)'); }
        cnt('wv' + i, D.wfV[i], u, s, s + .6);
        op($('wv' + i), eo(p(u, s, s + .3)) * (i === 4 ? 1 : 1 - .25 * em));
        op($('wk' + i), eo(p(u, .5 + i * .06, .9 + i * .06)) * (i === 4 ? 1 : 1 - .2 * em));
        if (i < 4) { const v = eo(p(u, s + .45, s + .75)); tf($('cn' + i), 'scaleX(' + v + ')'); op($('cn' + i), v > 0 ? 1 - .5 * em : 0); }
      }
      $('wb4').style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.35),0 0 ' + (70 * em) + 'px rgba(138,180,248,' + (.45 * em) + ')';
      $('wv4').style.textShadow = '0 0 ' + (30 * em) + 'px rgba(138,180,248,' + (.6 * em) + ')'; }

    // ── 5 · Τα 100€: η πλάκα κόβεται σε τέσσερις ζώνες ─────────────────
    u = scene(4); heads(4);
    { const v = spring(p(u, .3, 1.3)); op($('sl'), cl(v * 1.6)); tf($('sl'), 'translateY(' + (360 * (1 - v)) + 'px) rotate(' + (-3 * (1 - v)) + 'deg)'); }
    for (let k = 1; k < 4; k++) { const v = eo(p(u, 1.4 + k * .1, 1.8 + k * .1)); tf($('cut' + k), 'scaleX(' + v + ')'); op($('cut' + k), v * (1 - eo(p(u, 2.0, 2.3)))); }
    op($('eng'), 1 - eo(p(u, 1.7, 2.1)));
    { const sep = spring(p(u, 2.0, 2.9)), tint = eo(p(u, 2.0, 2.45)), away = eo(p(u, 3.0, 3.6)), rad = 12 * eo(p(u, 1.95, 2.3));
      for (let k = 0; k < 4; k++) {
        const b = $('nb' + k), lost = k < 3;
        const tr = k === 0 ? 28 - 16 * eo(p(u, 1.95, 2.3)) : rad, br = k === 3 ? 28 - 16 * eo(p(u, 1.95, 2.3)) : rad;
        b.style.borderRadius = tr + 'px ' + tr + 'px ' + br + 'px ' + br + 'px';
        tf(b, 'translateY(' + (D.gap * k * sep) + 'px)');
        // Ό,τι φεύγει σβήνει από τη θέση του: το γέμισμα σύρεται έξω, μένει το περίγραμμα.
        const wipe = lost ? 'translateX(' + (-104 * away) + '%)' : 'none';
        tf(b.children[0], wipe); tf(b.children[1], wipe);
        op($('bt' + k), tint);
        op($('bg' + k), lost ? away : 0);
        b.style.boxShadow = lost && away > .5 ? 'none' : '';
        const lv = eo(p(u, 2.2 + k * .15, 2.7 + k * .15));
        op($('sll' + k), lv * (lost ? 1 - .35 * away : 1)); tf($('sll' + k), 'translateX(' + (24 * (1 - lv)) + 'px)');
        tf($('sld' + k), 'scaleX(' + lv + ')');
      }
      const g = eo(p(u, D.hitNet - .1, D.hitNet + .5));
      op($('sgl'), .55 * g * (1 - p(t, D.hand, D.hand + .14)));
      op($('nb3'), 1 - p(t, D.hand + .04, D.hand + .14)); }

    // ── Η παράδοση: τα καθαρά περνούν το πέρασμα και γίνονται η μπάρα ──
    { const c = $('carry'), H = D.hand, LND = D.land;
      if (t < H || t > LND + .3) op(c, 0);
      else {
        const k = 1 + .012 * p(H, S[4], S[5]), n = G.n;
        const ax = 540 + (n.x - 540) * k, ay = 900 + (n.y + 3 * D.gap - 900) * k, aw = n.w * k, ah = n.h * k;
        // Πρώτα συμπιέζεται σε μπάρα γύρω από το κέντρο της, μετά πετά στη θέση της.
        const q = eio(p(t, H + .1, LND)), qh = eo(p(t, H, H + .5)), b = G.b;
        const x = lerp(ax, b.x, q), w = lerp(aw, b.w, q), h = lerp(ah, b.h, qh);
        const y = lerp(ay + ah / 2, b.y + b.h / 2, q) - 160 * Math.sin(Math.PI * q) - h / 2;
        c.style.width = w + 'px'; c.style.height = h + 'px'; c.style.borderRadius = lerp(12, 6, qh) + 'px';
        tf(c, 'translate(' + x + 'px,' + y + 'px)'); op(c, p(t, H, H + .1) * (1 - p(t, LND, LND + .15)));
      } }

    // ── 6 · Η εφαρμογή: η κάρτα του ακινήτου στήνεται γύρω από τη μπάρα ─
    u = scene(5); heads(5);
    fin('c5', u, .55, .6, 20);
    { const v = spring(p(u, .0, 1.0)); op($('ph'), cl(v * 1.6)); tf($('ph'), 'translateY(' + (820 * (1 - v)) + 'px) rotateX(' + (18 * (1 - v)) + 'deg)'); }
    op($('ab3'), p(t, D.land - .02, D.land + .05));
    for (let k = 0; k < 3; k++) { const v = eo(p(u, 1.3 + k * .1, 1.75 + k * .1)); tf($('ab' + k), 'scaleX(' + v + ')'); op($('ab' + k), v > 0 ? 1 : 0); }
    fin('ah', u, .5, .5, 12);
    for (let k = 0; k < 3; k++) fin('ar' + k, u, .65 + k * .15, .5, 14);
    fin('abg', u, 1.45, .55, 18); cnt('anet', D.netRun, u, 1.45, 2.15);
    for (let k = 0; k < 4; k++) fin('ac' + k, u, 2.1 + k * .14, .45, 12);

    // ── 7 · Η ερώτηση ───────────────────────────────────────────────────
    u = scene(6); heads(6);
    fin('ql', u, .7, .5, 0);
    { const v = eo(p(u, .8, 1.4)); op($('qb'), v); tf($('qb'), 'scaleX(' + (.96 + .04 * v) + ')'); tf($('qs'), 'translateX(' + (-300 + 1300 * ((u * .45) % 1)) + 'px)'); }`;

// ═══ Τα stories: επτά αφίσες, όχι καρέ του βίντεο ═══════════════════════
// Περιεχόμενο μόνο ανάμεσα σε y 250 και 1670. Στα 1, 4 και 7 μένει άδεια
// θέση ~220px για το αυτοκόλλητο (κουίζ, δημοσκόπηση, σύνδεσμος).
const ST_SLOT = { y: 1330, h: 220 };
interface Story { light: [number, number]; slot: boolean; foot: boolean; body: string; note: string }
const sHead = (eb: string, lines: string[], size: number, top: number) =>
  `<div class="L eb mono" style="top:${top - 44}px"><i></i>${esc(eb)}</div>
   <div class="L hd" style="top:${top}px;font-size:${size}px">${lines.map(l => `<div>${l}</div>`).join('')}</div>`;
const STORIES: Story[] = [
  { // 1 · Κουίζ
    light: [540, 1000], slot: true, foot: true, note: 'κουίζ',
    body: `<div class="L eb mono" style="top:376px"><i></i>ΠΑΡΑΔΕΙΓΜΑ · ${esc(UP(PROP_SPOKEN))}</div>
      <div class="L sub" style="top:420px;font-size:48px;color:#aebbd0">${esc(eur(GROSS))} ενοίκια τον χρόνο.</div>
      <div class="L hd" style="top:500px;font-size:98px">Πόσα από τα ${UNIT}€<br>${A('σου μένουν;')}</div>
      ${slab({ x: 340, y: 780, w: 400, h: 500, gap: 0, lx: 0, lw: 0 }, 'whole')}`,
  },
  { // 2 · Ο φόρος
    light: [360, 1050], slot: false, foot: true, note: '',
    body: `${sHead('Ο ΦΟΡΟΣ', ['Φόρος στα έσοδα,', A('όχι στα καθαρά.')], 100, 420)}
      <div class="L sub2" style="top:650px;width:900px">Για έξοδα η εφορία αφαιρεί ένα σταθερό ${esc(PRES)} του ενοικίου, όσα κι αν ξόδεψες. Στο υπόλοιπο ${esc(TAXED_SHARE)} πληρώνεις φόρο ${esc(RATE)}.</div>
      ${(() => { const g: GridG = { x: 90, y: 812, t: 46, g: 6, lx: 0, lw: 0 }; g.lx = g.x + gridSide(g) + 36; g.lw = 990 - g.lx; return grid(g, true); })()}
      ${ledger(90, 1346, 900)}`,
  },
  { // 3 · Τα έξοδα
    light: [540, 1180], slot: false, foot: true, note: '',
    body: `${sHead('ΤΑ ΕΞΟΔΑ', ['Τα έξοδα δεν', A('μειώνουν τον φόρο.')], 92, 420)}
      <div class="L sub2" style="top:640px;width:900px">Επισκευές, ασφάλιση, ΕΝΦΙΑ: όσα κι αν πληρώσεις στην πράξη, ο φόρος μένει ίδιος.</div>
      ${taxCard(90, 756, 900, true)}
      ${(() => { const s = receiptSlots(90, 988, 900, 28, SHORT_H, LONG_H); return RC.map((r, k) => receipt(r, k, s[k], true)).join(''); })()}`,
  },
  { // 4 · Ο λογαριασμός, με δημοσκόπηση
    light: [540, 980], slot: true, foot: true, note: 'δημοσκόπηση',
    body: `${sHead('Ο ΛΟΓΑΡΙΑΣΜΟΣ', ['Από τα ενοίκια', A('στην τσέπη.')], 100, 420)}
      ${waterfall({ x: 90, y: 640, w: 900, top: 84, base: 580, colW: 144 }, true)}`,
  },
  { // 5 · Το αποτέλεσμα
    light: [300, 1150], slot: false, foot: true, note: '',
    body: `${sHead('ΤΟ ΑΠΟΤΕΛΕΣΜΑ', [`Από κάθε ${UNIT}€`, 'ενοικίου,', A(`σου μένουν ${P_NET}€.`)], 96, 420)}
      ${slab({ x: 90, y: 780, w: 320, h: 760, gap: 12, lx: 440, lw: 550 }, 'cut')}`,
  },
  { // 6 · Η εφαρμογή
    light: [540, 1150], slot: false, foot: true, note: '',
    body: `${sHead('ΣΤΟ PROPERWISE', ['Όλο αυτό,', A('αυτόματα.')], 100, 420)}
      <div class="L sub2" style="top:650px;width:900px">Το PROPERWISE κάνει αυτόν τον λογαριασμό για <b>το δικό σου ακίνητο</b>, κάθε μήνα.</div>
      ${phone({ x: 162, y: 800, w: 756, visible: 780 })}`,
  },
  { // 7 · Η ερώτηση, με σύνδεσμο
    light: [540, 900], slot: true, foot: false, note: 'σύνδεσμος',
    body: `${sHead('ΤΟ ΔΙΚΟ ΣΟΥ ΑΚΙΝΗΤΟ', ['Εσύ ξέρεις', 'πόσα σου μένουν', A('καθαρά;')], 104, 420)}
      <div class="L lb" style="top:790px">Το δικό σου ενοίκιο</div>
      <div class="qb" style="left:90px;top:834px;height:150px;width:900px"><i style="left:320px"></i></div>
      <div class="L sbrand" style="top:1060px">${mark(56, C.ink)}<b>PROPERWISE</b></div>
      <div class="L sub2" style="top:1146px;color:${C.ink}">${esc(TAGLINE)}</div>
      <div class="L spill" style="top:1222px">Δωρεάν ${esc(FREE_WORDS)}</div>
      <div class="L mono surl" style="top:1590px">PROPERWISE.GR</div>`,
  },
];
const STORY_CSS = `
  .story{position:absolute;inset:0}
  .light{position:absolute;width:1200px;height:1200px;border-radius:50%;background:radial-gradient(closest-side,rgba(138,180,248,.2),rgba(138,180,248,.06) 55%,transparent)}
  .shd{position:absolute;left:90px;right:90px;top:262px;display:flex;align-items:center;justify-content:space-between}
  .shd .br{display:flex;align-items:center;gap:14px;font-size:26px;font-weight:800;letter-spacing:.12em}
  .shd .n{font-family:'Roboto Mono',monospace;font-size:26px;letter-spacing:.12em;color:${C.faint}}
  .sbrand{display:flex;align-items:center;gap:20px}
  .sbrand b{font-size:44px;font-weight:850;letter-spacing:.06em}
  .spill{padding:18px 32px;border-radius:999px;background:${C.accent};color:${C.onAccent};font-size:32px;font-weight:800;letter-spacing:-.01em}
  .surl{font-size:26px;letter-spacing:.12em;color:${C.faint}}
  .story .card{position:absolute}`;
const storyPage = (s: Story, n: number) => `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${BASE_CSS}${KIT_CSS}${CSS}${STORY_CSS}</style></head><body>
  <div id="bg"></div>
  <div class="light" style="left:${s.light[0] - 600}px;top:${s.light[1] - 600}px"></div>
  <div class="story">
    <div class="shd"><div class="br">${mark(34, C.ink)}<span>PROPERWISE</span></div><span class="n">${n} / ${STORIES.length}</span></div>
    ${s.body}
    ${s.foot ? `<div class="foot" style="top:1606px"><i></i><span>${esc(DEMO_1)}<br>${esc(DEMO_2)}</span></div>` : ''}
  </div>
  <div class="vig"></div><div class="grain"></div>
  </body></html>`;
// Ως κείμενο: το tsx ντύνει τις ονομασμένες συναρτήσεις με βοηθό που ο περιηγητής δεν έχει.
const STORY_CHECK = (slot: boolean) => `(() => {
  const out = [], S = { y0: ${ST_SLOT.y}, y1: ${ST_SLOT.y + ST_SLOT.h} };
  for (const el of Array.from(document.querySelectorAll('.story *'))) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const own = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
    if (own && (r.left < 80 || r.right > 1000 || r.top < 250 || r.bottom > 1670))
      out.push('έξω: ' + el.textContent.trim().slice(0, 30) + ' [' + Math.round(r.left) + ',' + Math.round(r.top) + '–' + Math.round(r.right) + ',' + Math.round(r.bottom) + ']');
    if (${slot} && r.top < S.y1 && r.bottom > S.y0 && !(r.top <= S.y0 && r.bottom >= S.y1 && el.children.length))
      out.push('στη θέση του αυτοκόλλητου: ' + (el.textContent.trim().slice(0, 30) || el.className));
  }
  return out;
})()`;

async function stories(dir: string) {
  const browser = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] });
  try {
    for (const [i, s] of STORIES.entries()) {
      const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
      await page.setContent(storyPage(s, i + 1), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const bad = (await page.evaluate(STORY_CHECK(s.slot))) as string[];
      if (bad.length) throw new Error(`story ${i + 1}: ${bad.slice(0, 6).join(' | ')}`);
      await page.screenshot({ path: join(dir, `${i + 1}.png`) });
      await page.close();
      console.log(`  ✓ story ${i + 1}`);
    }
  } finally {
    await browser.close();
  }
}

/** Αντίγραφο για το Instagram, κάτω από 28 MB: H.264 δύο περασμάτων, ~3,85 Mbps, AAC 192k. */
function igCopy(dir: string) {
  const FF = process.env.FFMPEG || 'ffmpeg', log = join(dir, 'x264pass'), out = join(dir, 'PROPERWISE-pou-pigan-ta-enoikia-instagram.mp4');
  const v = ['-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-level:v', '4.1', '-pix_fmt', 'yuv420p', '-b:v', '3850k', '-maxrate', '5M', '-bufsize', '8M',
    '-g', '60', '-keyint_min', '60', '-sc_threshold', '0', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-passlogfile', log];
  const a = spawnSync(FF, ['-y', '-loglevel', 'error', '-i', join(dir, 'reel.mp4'), ...v, '-pass', '1', '-an', '-f', 'mp4', '/dev/null'], { stdio: 'inherit' });
  const b = spawnSync(FF, ['-y', '-loglevel', 'error', '-i', join(dir, 'reel.mp4'), '-i', join(dir, 'sound.wav'), '-map', '0:v', '-map', '1:a', ...v, '-pass', '2',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
  for (const f of readdirSync(dir)) if (f.startsWith('x264pass')) rmSync(join(dir, f));
  if (a.status !== 0 || b.status !== 0) throw new Error('Το ffmpeg απέτυχε στο αντίγραφο του Instagram.');
  const mb = statSync(out).size / 1e6;
  if (mb >= 28) throw new Error(`Το αντίγραφο του Instagram είναι ${mb} MB.`);
  console.log(`✓ ${out} (${Math.round(mb * 10) / 10} MB)`);
}

// ═══ Τα κείμενα ═════════════════════════════════════════════════════════
const LINK = 'https://properwise.gr';
const CAPTION = [
  `${PROP_CAP}: ${eur(GROSS)} ενοίκια τον χρόνο. Καθαρά μένουν ${eur(NET)}.`,
  '',
  `Πού πήγαν τα ${eur(LOST)}; Ο λογαριασμός γραμμή γραμμή: τι παίρνει ο φόρος, τι ο ΕΝΦΙΑ, τι τα έξοδα.`,
  '',
  `Φόρος στα έσοδα, όχι στα καθαρά. Στη μακροχρόνια μίσθωση ο φόρος υπολογίζεται στα έσοδα από το ενοίκιο, όχι σε ό,τι σου μένει μετά τα έξοδα. Για έξοδα η εφορία αφαιρεί ένα σταθερό ${PRES} του ενοικίου, όσα κι αν ξόδεψες στην πράξη. Στο υπόλοιπο ${TAXED_SHARE} πληρώνεις φόρο. Επισκευές, ασφάλιση και ΕΝΦΙΑ τα πληρώνεις κανονικά, αλλά δεν εκπίπτουν.`,
  '',
  `Από κάθε ${UNIT}€ ενοικίου, σου μένουν ${P_NET}€.`,
  '',
  `Αυτό είναι το PROPERWISE. Ενοίκια, δαπάνες, φόροι και προθεσμίες για κάθε ακίνητο, σε μία εφαρμογή. Φωτογραφίζεις τον λογαριασμό και καταχωρείται. Ρωτάς ${ASSISTANT_ACC} και απαντά με τα δικά σου νούμερα.`,
  '',
  'Αποθήκευσέ το για τη φορολογική δήλωση. Στείλ\' το σε κάποιον που νοικιάζει το σπίτι του.',
  '',
  'Εσύ ξέρεις πόσα σου μένουν καθαρά από το δικό σου;',
  '',
  `Δωρεάν ${FREE_WORDS}. Σύνδεσμος στο bio.`,
  '',
  `Παράδειγμα με δεδομένα επίδειξης: φυσικό πρόσωπο, μακροχρόνια μίσθωση, χρονιά ${S.year}. Κάθε ακίνητο έχει τα δικά του νούμερα· για τη δική σου περίπτωση, ο λογιστής σου.`,
  '',
  '#ακίνητα #ενοίκια #ΕΝΦΙΑ #φορολογία #ιδιοκτήτες #PROPERWISE',
].join('\n');

const ALT = `Βίντεο ${Math.round(DUR)} δευτερολέπτων. ${PROP_CAP}: ${eur(GROSS)} ενοίκια τον χρόνο, σου μένουν ${eur(NET)}. Πού πήγαν τα ${eur(LOST)}; `
  + `Φόρος στα έσοδα, όχι στα καθαρά: σταθερή έκπτωση ${PRES} για επισκευές (${eur(PRESUMPTIVE)}), φορολογητέο εισόδημα ${eur(TAXABLE)}, φόρος εισοδήματος ${RATE} ${eur(TAX)}. `
  + `Τα έξοδα δεν μειώνουν τον φόρο: τέσσερις αποδείξεις (ΕΝΦΙΑ ${eur(ENFIA)}, ${TOP[0].label.toLocaleLowerCase('el')} ${eur(TOP[0].amount)}, ${TOP[1].label.toLocaleLowerCase('el')} ${eur(TOP[1].amount)} και άλλες ${REST.length} δαπάνες ${eur(REST_SUM)}) σφραγίζονται «Δεν εκπίπτει». Μείωση φόρου από τις αποδείξεις: ${feWhole(CUT)}. `
  + `Ο λογαριασμός: ${eur(GROSS)} μείον φόρος ${eur(TAX)}, μείον ΕΝΦΙΑ ${eur(ENFIA)}, μείον έξοδα ${eur(OTHER)}: μένουν ${eur(NET)}. `
  + `Από κάθε ${UNIT}€ ενοικίου: ${P_TAX}€ φόρος, ${P_ENFIA}€ ΕΝΦΙΑ, ${P_OTHER}€ επισκευές και έξοδα, σου μένουν ${P_NET}€. `
  + `Η εφαρμογή PROPERWISE δείχνει τον ίδιο λογαριασμό για το ακίνητο. Εσύ ξέρεις πόσα σου μένουν καθαρά; Δωρεάν ${FREE_WORDS}, properwise.gr.`;

const STORY_ALT = [
  `Κουίζ: ${eur(GROSS)} ενοίκια τον χρόνο. Πόσα από τα ${UNIT}€ σου μένουν;`,
  `Φόρος στα έσοδα, όχι στα καθαρά. Εκατό τετράγωνα: ${PRES} χωρίς φόρο (σταθερή έκπτωση), ${TAXED_SHARE} φορολογητέο, ${PCT(P_TAX)} φόρος. Έσοδα ${eur(GROSS)}, φόρος ${RATE} ${eur(TAX)}.`,
  `Τα έξοδα δεν μειώνουν τον φόρο. Φόρος εισοδήματος ${eur(TAX)}, μείωση φόρου από τις αποδείξεις ${feWhole(CUT)}. Τέσσερις αποδείξεις με τη σφραγίδα «Δεν εκπίπτει».`,
  `Από τα ενοίκια στην τσέπη: ${eur(GROSS)}, μείον φόρος ${eur(TAX)}, ΕΝΦΙΑ ${eur(ENFIA)}, έξοδα ${eur(OTHER)}, μένουν ${eur(NET)}.`,
  `Από κάθε ${UNIT}€ ενοικίου, σου μένουν ${P_NET}€. Φόρος ${P_TAX}€, ΕΝΦΙΑ ${P_ENFIA}€, επισκευές και έξοδα ${P_OTHER}€.`,
  'Όλο αυτό, αυτόματα. Η εφαρμογή PROPERWISE δείχνει τον λογαριασμό του ακινήτου.',
  `Εσύ ξέρεις πόσα σου μένουν καθαρά; PROPERWISE, δωρεάν ${FREE_WORDS}.`,
];

const README = [
  '# Reel: «Πού πήγαν τα ενοίκια;»',
  '',
  'Το carousel `carousel-1` σε κίνηση, για Instagram Reels και YouTube Shorts: 1080×1920, 30 fps,',
  `περίπου ${Math.round(DUR)}″, πρωτότυπη μουσική. Και επτά stories σχεδιασμένα ως αφίσες. Όλα τα ποσά από`,
  'το ακίνητο επίδειξης (`lib/demo/sample.ts`) μέσα από την `incomeStatement`, όπως στο carousel.',
  '',
  '    npx tsx scripts/marketing/reelKathara.ts',
  '    STORIES_ONLY=1 npx tsx scripts/marketing/reelKathara.ts   # μόνο τα stories',
  '',
  'Στο `docs/marketing/reels/reel-kathara/`, έξω από το git:',
  '',
  '- `PROPERWISE-pou-pigan-ta-enoikia.mp4`: το πρωτότυπο (5 Mbps).',
  '- `PROPERWISE-pou-pigan-ta-enoikia-instagram.mp4`: για ανέβασμα, κάτω από 28 MB (H.264 δύο περασμάτων, AAC 192k).',
  '- `stories/1.png` … `stories/7.png`: τα stories.',
  '',
  'Εδώ μένουν η λεζάντα (`caption.md`) και το εξώφυλλο (`cover.jpg`).',
  '',
  '## Δημοσίευση στο Instagram',
  '',
  '- Ανέβασμα του αντιγράφου `-instagram.mp4` ως Reel, εξώφυλλο το `cover.jpg`. «Κοινοποίηση και στη ροή»: ναι.',
  '- Ώρα: μεσημέρι (13:00-14:00) ή βράδυ (20:00-21:00), όχι την ίδια μέρα με το carousel.',
  '- Ήχος: ο πρωτότυπος του βίντεο. Μην προστεθεί μουσική από τη βιβλιοθήκη· κρύβει τα χτυπήματα στα ποσά.',
  '- Λεζάντα: το `caption.md` όπως είναι. Στις «Ρυθμίσεις για προχωρημένους» το εναλλακτικό κείμενο από κάτω.',
  '',
  '## Stories',
  '',
  'Με τη σειρά, την ίδια μέρα με το reel. Τα 1, 4 και 7 έχουν άδεια θέση κάτω από το γράφημα για το αυτοκόλλητο.',
  '',
  `1. Κουίζ «Πόσα από τα ${UNIT}€ σου μένουν;». Επιλογές: ${UNIT - EXEMPT}€, ${UNIT - P_TAX}€, ${P_NET}€ (σωστό).`,
  '2. Ο φόρος (χωρίς αυτοκόλλητο).',
  '3. Τα έξοδα (χωρίς αυτοκόλλητο).',
  '4. Δημοσκόπηση «Το ήξερες ότι τα έξοδα δεν μειώνουν τον φόρο;». Επιλογές: «Το ήξερα», «Πρώτη φορά».',
  '5. Το αποτέλεσμα (χωρίς αυτοκόλλητο).',
  '6. Η εφαρμογή (χωρίς αυτοκόλλητο).',
  '7. Σύνδεσμος στο properwise.gr με κείμενο «Δες τα δικά σου».',
  '',
  'Εναλλακτικό κείμενο ανά story:',
  '',
  ...STORY_ALT.map((a, i) => `- \`${i + 1}.png\`: ${a}`),
  '',
  '## Εναλλακτικό κείμενο του reel',
  '',
  ALT,
  '',
  '## YouTube Shorts',
  '',
  `**Τίτλος:** Πού πήγαν τα ${eur(LOST)} από τα ενοίκια; #Shorts`,
  '',
  '**Περιγραφή:**',
  '',
  `${eur(GROSS)} ενοίκια τον χρόνο, ${eur(NET)} καθαρά. Φόρος στα έσοδα, όχι στα καθαρά: στη μακροχρόνια μίσθωση η εφορία αφαιρεί μόνο μια σταθερή έκπτωση ${PRES} για επισκευές. Οι πραγματικές επισκευές, η ασφάλιση και ο ΕΝΦΙΑ δεν εκπίπτουν. Από κάθε ${UNIT}€ ενοικίου, σου μένουν ${P_NET}€.`,
  '',
  `Το PROPERWISE κάνει αυτόν τον λογαριασμό για το δικό σου ακίνητο, κάθε μήνα. Δωρεάν ${FREE_WORDS}: ${LINK}`,
  '',
  `Παράδειγμα με δεδομένα επίδειξης: φυσικό πρόσωπο, μακροχρόνια μίσθωση, χρονιά ${S.year}. Για τη δική σου περίπτωση, ο λογιστής σου.`,
  '',
  '**Ετικέτες:** ενοίκια, φόρος ενοικίων, ΕΝΦΙΑ, φορολογική δήλωση, ιδιοκτήτες ακινήτων, μακροχρόνια μίσθωση, ακίνητα, PROPERWISE',
  '',
  '## Καρφιτσωμένο σχόλιο',
  '',
  `Εσύ ξέρεις πόσα σου μένουν καθαρά από το δικό σου; Δοκίμασέ το δωρεάν ${FREE_WORDS} στο properwise.gr.`,
].join('\n');

const X: Explainer = {
  slug: 'reel-kathara', file: 'PROPERWISE-pou-pigan-ta-enoikia.mp4',
  scenes: SC, end: END, dur: DUR, html: HTML, css: CSS, heads: [0, 2, 2, 2, 3, 1, 3], js: JS,
  data: {
    free: UP(`Δωρεάν ${FREE_WORDS}`), drop: DROP, hookN: HOOK_N, hookP: HOOK_P, seg: PARTS.map(x => x.c),
    tiles: TILES, exempt: EXEMPT, ptax: P_TAX, taxRun: negRun(TAX),
    rcT: RC_T, rs: RS, rot: RC_ROT, hitZero: HIT_ZERO,
    wfT: WF_T, wfV: WB.map(b => b.val),
    gap: SLG.gap, hitNet: HIT_NET, hand: HAND, land: LAND,
    netRun: run(0, NET),
  },
  sound: m => {
    // 1 · Τρία κομμάτια πέφτουν, ο μετρητής κατεβαίνει, η ερώτηση προσγειώνεται.
    m.whoosh(0, .5, .04, true);
    DROP.forEach((s, k) => {
      m.click(s, 1500 - k * 200, .07, (k - 1) * .3); m.boom(s + .45, .05);
      for (let j = 0; j < 7; j++) m.click(s + j * .06, 3600, .016, .25);
      m.pluck(s + .02, [76, 72, 69][k], .04, (k - 1) * .3, .4);
    });
    m.pluck(2.0, 81, .045, 0, .5); m.sweep(2.1, .4, 900, 1600, .012);
    m.bell(HIT_Q + .02, 88, .03);
    m.whoosh(SC[1] - 1, 1, .08, true);
    // 2 · Τα τετράγωνα γεμίζουν κύμα κύμα, το 5% γίνεται έκπτωση, ο φόρος κοκκινίζει.
    for (let d = 0; d < 19; d++) m.click(SC[1] + .6 + d * .035 + .12, 3000 + d * 40, .016, (d % 2 ? .3 : -.3));
    for (let k = 0; k < EXEMPT; k++) m.pluck(SC[1] + 1.9 + k * .08 + .1, [84, 86, 88, 91, 93][k % 5], .035, .3, .5);
    m.sweep(SC[1] + 2.8, .6, 700, 1300, .012);
    for (let k = 0; k < P_TAX; k++) m.click(SC[1] + 3.6 + k * .05 + .1, 1800 + k * 30, .03, -.2);
    m.pluck(SC[1] + 4.5, 69, .05, 0, .4);
    // 3 · Τέσσερις αποδείξεις: σφύριγμα χαρτιού, χτύπημα, σφραγίδα, προσγείωση.
    RC_T.forEach((s, k) => {
      const tc = SC[2] + s + .4;
      m.whoosh(tc - .4, .42, .045, true);
      m.click(tc, 520, .14, (k % 2 ? .25 : -.25)); m.boom(tc, .045); m.clap(tc, .035);
      m.click(tc + .5, 1100, .04, (k % 2 ? .25 : -.25));
    });
    m.pluck(SC[2] + HIT_ZERO + .05, 64, .05, 0, .4); m.bell(SC[2] + HIT_ZERO + .1, 76, .03);
    // 4 · Ο καταρράκτης: κάθε σκαλί μια νότα πιο κάτω, τα καθαρά μια καμπάνα.
    m.sweep(SC[3] + WF_T[0], .6, 500, 1100, .012);
    [79, 76, 72].forEach((n, k) => { m.pluck(SC[3] + WF_T[k + 1] + .1, n, .05, (k - 1) * .3, .45); m.click(SC[3] + WF_T[k + 1] + .45, 900, .05, (k - 1) * .3); });
    m.bell(SC[3] + WF_T[4] + .2, 84, .035); m.pluck(SC[3] + WF_T[4] + .2, 72, .04, 0, .5);
    m.pluck(SC[3] + 4.45, 88, .03, 0, .6);
    // 5 · Η πλάκα: προσγειώνεται, κόβεται, οι ζώνες φεύγουν, τα καθαρά λάμπουν.
    m.whoosh(SC[4] + .3, .7, .05, true); m.click(SC[4] + .3 + .65, 700, .06); m.boom(SC[4] + .3 + .65, .04);
    for (let k = 1; k < 4; k++) m.sweep(SC[4] + 1.4 + k * .1, .35, 2400 + k * 300, 3600 + k * 300, .008);
    m.click(SC[4] + 2.05, 1600, .05);
    for (let k = 0; k < 4; k++) m.pluck(SC[4] + 2.2 + k * .15 + .1, [74, 77, 81, 86][k], .035, .25, .45);
    m.whoosh(SC[4] + 3.0, .5, .04, false);
    m.bell(SC[4] + HIT_NET + .05, 88, .035);
    // Η παράδοση: το κομμάτι πετά, το κινητό ανεβαίνει, η μπάρα κουμπώνει.
    m.whoosh(HAND, LAND - HAND, .05, true); m.click(LAND, 2600, .06); m.bell(LAND + .02, 91, .03, .2);
    // 6 · Η κάρτα στήνεται.
    for (let k = 0; k < 3; k++) m.click(SC[5] + .65 + k * .15 + .05, 1400, .035, .2);
    m.pluck(SC[5] + 1.5, 81, .045, 0, .5);
    for (let k = 0; k < 4; k++) m.pluck(SC[5] + 2.1 + k * .14 + .05, [84, 86, 88, 91][k], .03, (k - 1.5) * .2, .5);
    // 7 · Η ερώτηση.
    m.pluck(SC[6] + .3, 77, .04, 0, .6); m.pluck(SC[6] + .45, 81, .035, 0, .6);
  },
  checkAt: [SC[1] - .3, SC[2] - .3, SC[3] - .3, SC[4] - .3, SC[5] - .9, SC[6] - .3, END - .3, DUR - .2],
  cover: SC[1] - .45,
  spots: [[540, 930], [340, 900], [515, 1080], [515, 1000], [300, 1040], [540, 1060], [540, 900]],
  hits: [HIT_Q, SC[2] + HIT_ZERO, SC[4] + HIT_NET],
  stills: [SC[1] - .35, SC[2] - .35, SC[3] - .35, SC[4] - .35, SC[5] - .9, SC[6] - .35, END - .35],
  caption: CAPTION,
  readme: README,
};

async function main() {
  const dir = join(process.cwd(), 'docs/marketing/reels', X.slug);
  if (process.env.STORIES_ONLY) { await stories(join(dir, 'stories')); return; }
  await make(X);
  if (process.env.REEL_PREVIEW) return;
  // Τα stories του κιτ είναι καρέ του βίντεο· εδώ τα αντικαθιστούν οι αφίσες.
  await stories(join(dir, 'stories'));
  igCopy(dir);
}

main().catch(e => { console.error(e); process.exit(1); });
