// ═══════════════════════════════════════════════════════════════════════════
// REEL · «ΠΟΥ ΠΗΓΑΝ ΤΑ ΕΝΟΙΚΙΑ;» — ΤΟ CAROUSEL ΤΟΥ ΚΑΘΑΡΟΥ ΣΕ ΚΙΝΗΣΗ
// ─────────────────────────────────────────────────────────────────────────
// ΧΡΗΣΗ:  npx tsx scripts/marketing/reelKathara.ts   (FFMPEG με libx264)
//         REEL_PREVIEW=1,5,9  → μόνο στιγμιότυπα του reel.
//         STORIES_ONLY=1      → μόνο τα επτά stories.
//         AUDIT_ONLY=1        → μόνο ο έλεγχος στοίχισης.
//
// Το carousel «Πού πήγαν τα …;» (carousel.ts) ως reel ενός λεπτού: το
// αγκίστρι με τα δύο ποσά, ο φόρος στα έσοδα, τα έξοδα που δεν εκπίπτουν, ο
// καταρράκτης, τα 100€ που κόβονται στα τέσσερα, η εφαρμογή και ο δημόσιος
// υπολογιστής με τα δικά σου νούμερα. Και επτά stories σχεδιασμένα ως αφίσες.
//
// ΕΝΑ ΣΥΣΤΗΜΑ ΚΑΙ ΕΝΑΣ ΕΛΕΓΧΟΣ ΠΟΥ ΤΟ ΦΥΛΑΕΙ.
//   · Μία αριστερή ακμή (90) και μία δεξιά: 934 στο reel, γιατί κάτω από το
//     y 1100 το Instagram βάζει τα κουμπιά του δεξιά (ο έλεγχος του κιτ, που
//     μετρά και μέσα στο ζουμ του περάσματος), 990 στα stories.
//   · Κάθε σκηνή είναι μία στήλη σε ροή, κεντραρισμένη οπτικά ανάμεσα στην
//     κεφαλίδα και την υποσημείωση: μάτι, τίτλος, 48 ως το περιεχόμενο. Ρυθμός
//     8px, γωνίες 12 / 20 / 28, ίδια εσωτερική απόσταση σε κάθε κάρτα.
//   · Τίτλοι 88 με διάστιχο −0,03em, τιμές 34–48, ετικέτες 26 (ποτέ
//     μικρότερες, ποτέ αραιότερες από .12em).
//   · Ο έλεγχος στοίχισης (audit) μετρά κάθε τελική σκηνή και κάθε story και
//     σταματά αν μια ακμή ξεφύγει πάνω από 1px ή ένα επαναλαμβανόμενο κενό
//     πάνω από 2px.
//
// ΤΑ ΧΡΩΜΑΤΑ ΕΙΝΑΙ ΤΟΥ CAROUSEL: ενοίκιο σχιστόλιθος, φόρος σομόν, ΕΝΦΙΑ
// κεχριμπάρι, έξοδα λιλά, καθαρά το μπλε της μάρκας (rentFacts.SEG).
//
// ΚΑΝΕΝΑ ΝΟΥΜΕΡΟ ΜΕ ΤΟ ΧΕΡΙ. Όλα από το ακίνητο επίδειξης μέσα από την
// incomeStatement (rentFacts.ts). Ότι τα έξοδα δεν αλλάζουν τον φόρο το
// ξαναϋπολογίζουμε· ότι ο υπολογιστής του site βγάζει το ίδιο αποτέλεσμα το
// ρωτάμε την ίδια `propertyYield` που τρέχει η σελίδα.
// ═══════════════════════════════════════════════════════════════════════════
import { join } from 'node:path';
import { statSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { PLANS } from '../../lib/billing/plans';
import { ASSISTANT_ACC } from '../../lib/assistant/identity';
import { DEMO_PROPERTY } from '../../lib/demo/sample';
import { incomeStatement } from '../../lib/accounting/statement';
import { propertyYield } from '../../lib/tools/apodosi';
import { athensParts } from '../../lib/core/time';
import { fe, feWhole, fpRate, fn } from '../../lib/core/format';
import { C, esc, mark, GRAIN } from './igKit';
import { BASE_CSS, mask } from './reelKit';
import { BEAT, A, make, page, icon, KIT_CSS, type Explainer } from './explainerKit';
import {
  S, GROSS, PRESUMPTIVE, TAXABLE, TAX, ENFIA, OTHER, NET, RATE, PRES, TAXED_SHARE, PROP_SPOKEN, UP, LOST,
  eur, TOP, REST, REST_SUM, P_TAX, P_ENFIA, P_OTHER, P_NET, SEG, PARTS, BR,
} from './rentFacts';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { chromePath } = require('../lib/chrome.mjs');
const ROOT = process.cwd();

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
const UNIT = 100;
if (P_TAX + P_ENFIA + P_OTHER + P_NET !== UNIT) throw new Error('Τα μερίδια δεν αθροίζουν στα 100€.');
if (PARTS.map(x => x.k).join() !== 'tax,enfia,other,net') throw new Error('Η σειρά των κομματιών άλλαξε.');
const PCT = (n: number) => fpRate(n);
const NEG = (n: number) => `−${eur(n)}`;
const PROP_CAP = PROP_SPOKEN.charAt(0).toLocaleUpperCase('el') + PROP_SPOKEN.slice(1);

// ── Ο υπολογιστής του site: ίδιες ετικέτες, ίδιος υπολογισμός ───────────
// Τα πεδία διαβάζονται από το ίδιο το component· αν αλλάξει ετικέτα, το reel
// σταματά αντί να δείχνει πεδίο που δεν υπάρχει.
const CALC_PATH = '/kathari-apodosi';
const CALC_URL = `properwise.gr${CALC_PATH}`;
const CALC_SRC = readFileSync(join(ROOT, 'app/kathari-apodosi/ApodosiCalculator.tsx'), 'utf8');
const CALC_FIELDS = ['Μηνιαίο ενοίκιο', 'Μήνες ενοικίασης', 'ΕΝΦΙΑ τον χρόνο', 'Δαπάνες τον χρόνο'];
for (const f of CALC_FIELDS) if (!CALC_SRC.includes(`label="${f}"`)) throw new Error(`Ο υπολογιστής δεν έχει πια πεδίο «${f}».`);
if (!CALC_SRC.includes('propertyYield(')) throw new Error('Ο υπολογιστής δεν υπολογίζει πια με την propertyYield.');
// «Χωρίς εγγραφή» μόνο αν η διαδρομή είναι δημόσια και η σελίδα το λέει η ίδια.
const PROXY = readFileSync(join(ROOT, 'proxy.ts'), 'utf8');
const CALC_PAGE = readFileSync(join(ROOT, 'app/kathari-apodosi/page.tsx'), 'utf8');
const NO_SIGNUP = /const PUBLIC = new Set\(\[[\s\S]*?"\/kathari-apodosi"[\s\S]*?\]\)/.test(PROXY) && CALC_PAGE.includes('Χωρίς εγγραφή');
const MONTHS = 12;
const MONTHLY = GROSS / MONTHS;
if (Math.abs(MONTHLY - Math.round(MONTHLY * 100) / 100) > 1e-9) throw new Error('Το μηνιαίο ενοίκιο δεν είναι ακριβές ποσό.');
const CALC = propertyYield({ value: 0, monthlyRent: MONTHLY, monthsRented: MONTHS, enfia: ENFIA, expenses: OTHER, otherRentalIncome: 0, year: athensParts().year, viaBank: true });
// Το αποτέλεσμα μπαίνει δίπλα στα πεδία ΜΟΝΟ αν ο υπολογιστής βγάζει το ίδιο.
// Αν κάποτε διαφέρει, το reel σταματά: κανένα νούμερο δίπλα σε πεδία που δεν το δίνουν.
const CALC_MATCH = Math.abs(CALC.net - NET) < .005 && Math.round(CALC.net / CALC.gross * 100) === P_NET;
if (!CALC_MATCH) throw new Error(`Ο υπολογιστής δίνει ${CALC.net} για τα ίδια πεδία, όχι ${NET}.`);
const num = (n: number) => (Number.isInteger(n) ? fn(n) : fn(n, 2));
const CALC_VALUES = [num(MONTHLY), fn(MONTHS), num(ENFIA), num(OTHER)];
const CALC_UNITS = ['€', '', '€', '€'];

// ── Ο χρόνος ─────────────────────────────────────────────────────────────
const SC = [0, 11, 25, 39, 51, 63, 75].map(b => b * BEAT);
const END = 88 * BEAT, DUR = 93 * BEAT;

// ── Μετρητές ─────────────────────────────────────────────────────────────
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
const SHORT = { tax: 'Φόρος', enfia: 'ΕΝΦΙΑ', other: 'Έξοδα', net: 'Σου μένουν' } as Record<string, string>;
const GAP_HEAD = 48;              // από τον τίτλο ως το περιεχόμενο, σε κάθε σκηνή
const OPTICAL = 24;               // η στήλη κάθεται λίγο πάνω από το γεωμετρικό κέντρο

/** Η επιφάνεια κάθε μορφής: στήλη, ζώνη περιεχομένου, υποσημείωση, θέση αυτοκόλλητου. */
interface Frame { L: number; R: number; top: number; bottom: number }
// 934, όχι 940: το πέρασμα του κιτ ζουμάρει τη σκηνή 1,2% και ο έλεγχος ζωνών του
// μετρά και τότε. Η δεξιά ακμή μένει μέσα στο 940 ακόμη και στο ζουμ.
const REEL: Frame = { L: 90, R: 934, top: 312, bottom: 1400 };
const REEL_FOOT = 1432;
const STORY_FOOT = 1604, ST_SLOT = { y: 1352, h: 220 };
const STORY: Frame = { L: 90, R: 990, top: 312, bottom: STORY_FOOT - 32 };
const STORY_S: Frame = { L: 90, R: 990, top: 312, bottom: ST_SLOT.y - 32 };
const W = (f: Frame) => f.R - f.L;

// ═══ Συστατικά, κοινά για reel και stories ═══════════════════════════════
// Με `fin` το συστατικό γράφεται στην τελική του κατάσταση (story). Χωρίς
// αυτό γράφεται στην αρχική του κατάσταση και η κίνηση του reel το στήνει.
const block = (f: Frame, inner: string) =>
  `<div class="blk" style="left:${f.L}px;width:${W(f)}px;top:${f.top}px;height:${f.bottom - f.top}px;padding-bottom:${OPTICAL}px">${inner}</div>`;
/** Μάτι και τίτλος σε ροή· με `i` παίρνουν τα id που κινεί το κιτ (e<i>, h<i>_<k>). */
const fhead = (i: number | null, eb: string, lines: string[], size: number, end = true) => `
  <div class="eb mono"${i == null ? '' : ` id="e${i}"`} data-col="L"><i></i>${esc(eb)}</div>
  <div class="hd" style="font-size:${size}px;margin-top:16px" data-col="L"${end ? ' data-hend' : ''}>${lines.map((l, k) => i == null ? `<div>${l}</div>` : mask(`h${i}_${k}`, l)).join('')}</div>`;
const sub = (id: string, html: string, f: Frame) =>
  `<div class="sub2" id="${id}" style="margin-top:16px;width:${W(f)}px" data-col="L" data-hend>${html}</div>`;
const foot = (y: number) => `<div class="foot" id="demo" style="top:${y}px" data-col="L"><i></i><span>${esc(DEMO_1)}<br>${esc(DEMO_2)}</span></div>`;

// ── Τα εκατό τετράγωνα και το καθολικό ───────────────────────────────────
const TILES = 100;
const EXEMPT = Math.round(PRESUMPTIVE / GROSS * TILES);
if (Math.abs(EXEMPT - PRESUMPTIVE / GROSS * TILES) > 1e-9) throw new Error('Η σταθερή έκπτωση δεν είναι ακέραιο πλήθος τετραγώνων.');
const tileKind = (i: number) => (i >= TILES - EXEMPT ? 'ex' : i < P_TAX ? 'tax' : 'base');
const gridSide = (t: number, g: number) => 10 * t + 9 * g;
const grid = (t: number, g: number, fin: boolean) => {
  const side = gridSide(t, g), lx = side + 32;
  return `<div class="lb" id="tl" style="margin-top:${GAP_HEAD}px" data-col="L">Κάθε τετράγωνο: ${PCT(UNIT / TILES)} του ενοικίου</div>
  <div class="tgw" style="height:${side}px;margin-top:16px">
    <div class="tg" id="tg" data-col="L" style="grid-template-columns:repeat(10,${t}px);gap:${g}px">${Array.from({ length: TILES }, (_, i) => {
      const k = tileKind(i);
      const st = !fin ? '' : k === 'ex' ? `background:${EXEMPT_FILL};box-shadow:inset 0 0 0 2px ${C.accent}` : `background:${k === 'tax' ? SEG.tax : LIGHT}`;
      return `<i id="t${i}" style="width:${t}px;height:${t}px;${st}"></i>`;
    }).join('')}</div>
    ${[
      { id: 'lg0', rows: [0, 1], sw: `background:${SEG.tax}`, n: PCT(P_TAX), t: 'Φόρος' },
      { id: 'lg1', rows: [2, 8], sw: `background:${LIGHT}`, n: TAXED_SHARE, t: 'Φορολογητέο' },
      { id: 'lg2', rows: [9, 9], sw: `background:${EXEMPT_FILL};box-shadow:inset 0 0 0 2px ${C.accent}`, n: PRES, t: 'Χωρίς φόρο' },
    ].map(l => {
      const cy = ((l.rows[0] + l.rows[1]) / 2) * (t + g) + t / 2;
      return `<div class="lg" id="${l.id}" style="left:${lx}px;top:${cy - 28}px" data-lx="lg"><i class="sw" style="${l.sw}"></i><b>${esc(l.n)}</b><span class="lb">${esc(l.t)}</span></div>`;
    }).join('')}
  </div>`;
};
const LEDGER: [string, string, string][] = [
  ['Έσοδα από ενοίκια', eur(GROSS), ''],
  [`Σταθερή έκπτωση ${PRES} για επισκευές`, NEG(PRESUMPTIVE), ''],
  ['Φορολογητέο εισόδημα', eur(TAXABLE), ''],
  [`Φόρος εισοδήματος ${RATE}`, NEG(TAX), SEG.tax],
];
const ledger = () => `
  <div class="card ledger" id="ld" style="margin-top:24px" data-col="LR">
    ${LEDGER.map(([k, v, c], i) => `<div class="lr" id="lr${i}"${c ? ` style="color:${C.ink}"` : ''}><span data-lx="ld">${c ? `<i class="dot" style="background:${c}"></i>` : ''}${esc(k)}</span><b data-rx="ld"${i === 3 ? ' id="ltx"' : ''}${c ? ` style="color:${c}"` : ''}>${esc(v)}</b></div>`).join('')}
  </div>`;

// ── Η κάρτα του φόρου και οι τέσσερις αποδείξεις ─────────────────────────
const taxCard = (fin: boolean) => `
  <div class="card taxc" id="tc" style="margin-top:${GAP_HEAD}px" data-col="LR">
    <div class="tr"><span data-lx="tc">Φόρος εισοδήματος<small>με τη σταθερή έκπτωση ${esc(PRES)}</small></span><b data-rx="tc" style="color:${SEG.tax}">${esc(eur(TAX))}</b></div>
    <div class="tr" id="tz"${fin ? '' : ' style="opacity:0"'}><span data-lx="tc">Μείωση φόρου από τις αποδείξεις:</span><b data-rx="tc">${esc(feWhole(CUT))}</b></div>
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
const RC_ROT = [-3, 2.5, -2, 2.2];   // μόνο στην πτήση· κάθε απόδειξη προσγειώνεται ίσια
const RC_H = 176, RC_GUT = 20, RC_COL = 3 * RC_H + 2 * RC_GUT;
const receipts = (f: Frame, fin: boolean) => {
  const cw = (W(f) - RC_GUT) / 2;
  const slots = [0, 1, 2].map(k => ({ x: 0, y: k * (RC_H + RC_GUT), h: RC_H })).concat([{ x: cw + RC_GUT, y: 0, h: RC_COL }]);
  return `<div class="rcw" style="height:${RC_COL}px;margin-top:24px">${RC.map((r, k) => `
    <div class="rc${r.lines.length ? ' long' : ''}" id="r${k}" style="left:${slots[k].x}px;top:${slots[k].y}px;width:${cw}px;height:${slots[k].h}px;z-index:${k + 2}"
      data-col="${k < 3 ? 'L' : 'R'}"${k < 3 ? ' data-gap="rc"' : ''}>
      <div class="rh">${esc(r.head)}</div>
      ${r.lines.length ? `<div class="rl">${r.lines.map(([l, a]) => `<div><span>${esc(UP(l))}</span><span>${esc(fe(a))}</span></div>`).join('')}</div>` : ''}
      <div class="rs"><span class="st" id="st${k}"${fin ? ' style="opacity:1;transform:rotate(-3deg)"' : ''}>ΔΕΝ ΕΚΠΙΠΤΕΙ</span></div>
      <div class="rt"><span>ΣΥΝΟΛΟ</span><b>${esc(fe(r.total))}</b></div>
    </div>`).join('')}</div>`;
};

// ── Ο καταρράκτης ────────────────────────────────────────────────────────
const WB = [
  { k: 'Ενοίκια', lo: 0, hi: GROSS, c: SLATE, val: run(0, GROSS), fin: eur(GROSS) },
  { k: 'Φόρος', lo: L1, hi: GROSS, c: SEG.tax, val: negRun(TAX), fin: NEG(TAX) },
  { k: 'ΕΝΦΙΑ', lo: L2, hi: L1, c: SEG.enfia, val: negRun(ENFIA), fin: NEG(ENFIA) },
  { k: 'Έξοδα', lo: NET, hi: L2, c: SEG.other, val: negRun(OTHER), fin: NEG(OTHER) },
  { k: 'Καθαρά', lo: 0, hi: NET, c: C.accent, val: run(0, NET), fin: eur(NET) },
];
// Οι στήλες μπαίνουν 24px μέσα από τις άκρες: οι τιμές κεντράρονται στη στήλη
// τους και μένουν μέσα στο γράφημα· η βάση πιάνει όλο το πλάτος.
const WF_IN = 32, WF_LAB = 56, WF_CAT = 48;
const waterfall = (f: Frame, colW: number, bars: number, fin: boolean) => {
  const w = W(f), pitch = (w - 2 * WF_IN - colW) / 4, base = WF_LAB + bars, wy = (v: number) => base - bars * v / GROSS;
  return `<div class="wf" id="wf" style="height:${base + WF_CAT}px;margin-top:${GAP_HEAD}px">
    <i class="base" id="wbase" style="top:${base}px" data-col="LR"></i>
    ${[GROSS, L1, L2, NET].map((lvl, i) => `<i class="cn" id="cn${i}" style="left:${WF_IN + i * pitch + colW}px;top:${wy(lvl) - 1}px;width:${pitch - colW}px"></i>`).join('')}
    ${WB.map((b, i) => {
      const x = WF_IN + i * pitch, top = wy(b.hi), h = wy(b.lo) - top, net = i === 4;
      return `<i class="wb${net ? ' net' : ''}" id="wb${i}" style="left:${x}px;top:${top}px;width:${colW}px;height:${h}px;--c:${b.c}"></i>
        <span class="wv" id="wv${i}" data-cx="wb${i}" style="left:${x + colW / 2}px;top:${top - 48}px;color:${net ? C.accent : i === 0 ? C.ink : b.c}">${esc(fin ? b.fin : b.val[0])}</span>
        <span class="wk${net ? ' net' : ''}" id="wk${i}" data-cx="wb${i}" style="left:${x + colW / 2}px;top:${base + 16}px">${esc(b.k)}</span>`;
    }).join('')}
  </div>`;
};

// ── Τα 100€: μία πλάκα που κόβεται σε τέσσερις ζώνες ─────────────────────
// ΚΑΝΕΝΑ ΣΧΕΔΙΟ ΧΑΡΤΟΝΟΜΙΣΜΑΤΟΣ. Ένα αντικείμενο από γυαλί και μέταλλο με
// χαραγμένο «100€», που κόβεται σε ζώνες ανάλογες με τα μερίδια.
const bands = (h: number) => {
  let off = 0;
  return PARTS.map((x, k) => { const b = { k, top: off, h: Math.round(h * x.p / UNIT * 10) / 10 }; off += b.h; return b; });
};
/** `whole`: ακέραιη (κουίζ) · `cut`: κομμένη, όλες οι ζώνες στη θέση τους (story) · `reel`: για την κίνηση. */
const slab = (f: Frame, w: number, h: number, gap: number, mode: 'whole' | 'cut' | 'reel', center = false) => {
  const B = bands(h), cut = mode === 'cut', H = h + 3 * gap, lx = w + 40;
  const radius = (k: number) => cut ? `${R.s}px` : `${k === 0 ? R.l : 0}px ${k === 0 ? R.l : 0}px ${k === 3 ? R.l : 0}px ${k === 3 ? R.l : 0}px`;
  return `<div class="slw" style="height:${H}px;margin-top:${GAP_HEAD}px">
  <div class="slab" id="sl" style="${center ? `left:${(W(f) - w) / 2}px` : 'left:0'};width:${w}px;height:${H}px" ${center ? 'data-ccol' : 'data-col="L"'}>
    ${B.map(b => `<div class="band" id="nb${b.k}" style="top:${b.top}px;height:${b.h}px;border-radius:${radius(b.k)};${cut ? `transform:translateY(${b.k * gap}px)` : ''}">
      <i class="bm" style="background-size:${w}px ${h}px,${w}px ${h}px;background-position:0 ${-b.top}px,0 ${-b.top}px"></i>
      <i class="bt" id="bt${b.k}" style="background:${b.k === 3 ? NET_GRAD : `linear-gradient(180deg,${PARTS[b.k].c},color-mix(in srgb,${PARTS[b.k].c} 72%,#0a1220))`};opacity:${cut ? 1 : 0}"></i>
      <i class="gh" id="bg${b.k}"></i></div>`).join('')}
    ${mode === 'cut' ? '' : `<div class="eng" id="eng" style="top:${Math.round(h / 2 - 64)}px"><b>${UNIT}€</b></div>`}
    ${mode === 'reel' ? B.slice(1).map(b => `<i class="cut" id="cut${b.k}" style="top:${b.top - 1.5}px"></i>`).join('') : ''}
    <i class="sglow" id="sgl" style="top:${B[3].top + 3 * gap}px;height:${B[3].h}px;opacity:${cut ? .5 : 0}"></i>
  </div>
  ${mode === 'whole' ? '' : B.map(b => {
    const x = PARTS[b.k], net = x.k === 'net', cy = b.top + b.k * gap + b.h / 2;
    return `<div class="sll${net ? ' net' : ''}" id="sll${b.k}" style="left:${lx}px;right:0;top:${cy - 28}px"><i class="ld" id="sld${b.k}"></i><span data-lx="sl">${esc(LABELS[x.k])}</span><b data-col="R" style="color:${net ? C.accent : x.c}">${esc(feWhole(x.p))}</b></div>`;
  }).join('')}
  </div>`;
};

// ── Το κινητό ────────────────────────────────────────────────────────────
const FEATS = ['Σάρωση λογαριασμών', 'Φόρος και ΕΝΦΙΑ', 'Φάκελος για τον λογιστή', `Ρώτα ${ASSISTANT_ACC}`];
const APP_ROWS: [string, string][] = [
  ['Ενοίκια', eur(GROSS)],
  ['Φόρος και ΕΝΦΙΑ', NEG(TAX + ENFIA)],
  ['Επισκευές και έξοδα', NEG(OTHER)],
];
const PH_W = 756;
/** Γεμίζει ό,τι μένει στη στήλη· σβήνει προς τα κάτω πριν από την υποσημείωση. */
const phone = (f: Frame, h = 0) => `
  <div class="phw${h ? ' fixed' : ''}" style="margin-top:${GAP_HEAD}px${h ? `;height:${h}px` : ''}">
  <div id="ph" class="deco" data-ccol style="left:${(W(f) - PH_W) / 2}px;width:${PH_W}px"><div class="scr"><div class="isl"></div><div class="ap">
    <div class="ah" id="ah"><span class="m">${mark(30, C.ink)}</span><b>${esc(DEMO_PROPERTY.name)}</b><span class="y">${S.year}</span></div>
    ${APP_ROWS.map(([k, v], i) => `<div class="ar" id="ar${i}"><span>${esc(k)}</span><b data-rx="ph">${esc(v)}</b></div>`).join('')}
    <div class="abig" id="abg"><span>Σου μένουν</span><div><b id="anet">${esc(eur(NET))}</b><em>${PCT(P_NET)}</em></div></div>
    <div class="abar">${PARTS.map((x, k) => `<i id="ab${k}" style="flex:${x.v};background:${k === 3 ? C.accent : x.c}"></i>`).join('')}</div>
    <div class="chips">${FEATS.map((f2, k) => `<span id="ac${k}">${esc(f2)}</span>`).join('')}</div>
  </div></div></div></div>`;

// ── Ο υπολογιστής καθαρής απόδοσης ──────────────────────────────────────
const CALC_ICON = 'M6 2h12a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z|M8 5h8v4H8z|M8.5 13h.01|M12 13h.01|M15.5 13h.01|M8.5 17h.01|M12 17h.01|M15.5 17h.01';
const LINK_ICON = 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1|M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1';
const calc = (filled: boolean) => `
  <div class="card calc" id="calc" style="margin-top:${GAP_HEAD}px" data-col="LR">
    <div class="ch" data-lx="calc"><span class="ci">${icon(CALC_ICON, '#cfe0ff', 28, 1.8)}</span><b>Υπολογιστής καθαρής απόδοσης</b></div>
    <div class="cf">${CALC_FIELDS.map((l, k) => `
      <div class="fld"><span class="lb">${esc(l)}</span>
        <div class="in" id="cin${k}" ${k % 2 ? 'data-rx="calc"' : 'data-lx="calc"'}><span class="v" id="cv${k}">${filled ? esc(CALC_VALUES[k]) : ''}</span><i class="caret" id="cc${k}"${!filled && k === 0 ? ' style="opacity:1"' : ''}></i>${CALC_UNITS[k] ? `<span class="u">${CALC_UNITS[k]}</span>` : ''}</div></div>`).join('')}
    </div>
    ${CALC_MATCH ? `<div class="cr" id="cres"><span data-lx="calc">Σου μένουν</span>
      <div class="crv"><b id="crv" data-rx="calc"${filled ? '' : ' style="opacity:0"'}>${esc(eur(NET))}<em> · ${PCT(P_NET)}</em></b><i class="sk" id="csk"${filled ? '' : ' style="opacity:1"'}></i></div></div>` : ''}
  </div>
  <div class="urlr" id="urlr"><span class="chip" data-col="L"><span class="li">${icon(LINK_ICON, C.accent, 26, 2)}</span>${esc(CALC_URL)}</span>${NO_SIGNUP ? '<span class="lb" data-col="L">Δωρεάν, χωρίς εγγραφή</span>' : ''}</div>`;

// ═══ Το reel ═════════════════════════════════════════════════════════════
const HB = { w: W(REEL), h: 176, gap: 8, rowA: 56, rowB: 16 };
const hbw = (v: number) => (HB.w - HB.gap * 3) * v / GROSS;
const SEGX = PARTS.reduce<number[]>((a, x, k) => [...a, k ? a[k - 1] + hbw(PARTS[k - 1].v) + HB.gap : 0], []);
const LOST_W = SEGX[3] - HB.gap;
// Ετικέτα πιο φαρδιά από το κομμάτι της (ΕΝΦΙΑ): δεύτερη σειρά, με λεπτή γραμμή ως το κομμάτι.
const TIER2 = PARTS.map(x => hbw(x.v) < 90);
const HK_TIER = 40, HK_H = HB.rowA + HB.h + HB.rowB + 32 + (TIER2.some(Boolean) ? HK_TIER : 0);
const LV = [GROSS, L1, L2, NET];
const PV = [UNIT, UNIT - P_TAX, UNIT - P_TAX - P_ENFIA, P_NET];
const HOOK_N = LV.slice(0, 3).map((a, k) => run(a, LV[k + 1], n => `${eur(n)}.`));
const HOOK_P = PV.slice(0, 3).map((a, k) => pctRun(a, PV[k + 1]));
const DROP = [.6, 1.1, 1.55];
const HIT_Q = 2.7;
const HIT_ZERO = 5.2;
const WF_T = [.6, 1.45, 2.1, 2.75, 3.5];
const SL = { w: 300, h: 620, gap: 10 };
const HIT_NET = 3.3;
const HAND = SC[5] - .5, LAND = SC[5] + 1.05;
const CLR = 2.4, CLR_STEP = .55;   // ο υπολογιστής αδειάζει πεδίο πεδίο

const HTML = `
  <!-- 1 · Το αγκίστρι: ορατό από το πρώτο καρέ -->
  <section id="s0">${block(REEL, `
    <div class="eb mono" id="e0" data-col="L"><i></i>ΠΑΡΑΔΕΙΓΜΑ · ${esc(UP(PROP_SPOKEN))}</div>
    <div class="hd" style="font-size:88px;margin-top:16px" data-col="L">${mask('q0', `${esc(eur(GROSS))} ενοίκια.`)}${mask('q1', 'Σου μένουν')}</div>
    <div class="hd" style="font-size:152px;letter-spacing:-.035em;margin-top:8px" data-col="L" data-hend>${mask('q2', `<span class="a" id="hn">${esc(HOOK_N[0][0])}</span>`)}</div>
    <div class="hk" id="hk" style="height:${HK_H}px;margin-top:${GAP_HEAD}px" data-col="LR">
      <span class="lb" id="hl0" style="left:0;top:8px">Το ενοίκιο της χρονιάς</span>
      <span class="lb strong" id="hp" style="right:0;top:8px" data-col="R">${PCT(UNIT)}</span>
      <div class="spn" id="hsp" style="left:0;width:${LOST_W}px"><b id="hsl">${esc(eur(LOST))}</b><i class="sl" id="hsx"></i></div>
      <div class="hb" style="top:${HB.rowA}px;height:${HB.h}px;gap:${HB.gap}px">${PARTS.map((x, k) => `<div class="hs" id="hs${k}" style="width:${hbw(x.v)}px"><i class="fl" id="hf${k}"></i></div>`).join('')}</div>
      ${PARTS.map((x, k) => `<span class="sgl" id="sg${k}" data-cx="hs${k}" style="left:${SEGX[k] + hbw(x.v) / 2}px;top:${HB.rowA + HB.h + HB.rowB + (TIER2[k] ? HK_TIER : 0)}px;color:${k === 3 ? C.accent : x.c}">${esc(SHORT[x.k])}</span>${TIER2[k]
        ? `<i class="sgt" id="sgt${k}" style="left:${SEGX[k] + hbw(x.v) / 2 - 1}px;top:${HB.rowA + HB.h + 8}px;height:${HB.rowB + HK_TIER - 12}px;background:${x.c}"></i>` : ''}`).join('')}
    </div>
    <div class="hd qq" style="font-size:88px;margin-top:${GAP_HEAD}px" data-col="L">${mask('q3', 'Πού πήγαν')}${mask('q4', `τα <b>${esc(eur(LOST))}</b>;`)}</div>`)}
  </section>

  <!-- 2 · Φόρος στα έσοδα -->
  <section id="s1">${block(REEL, `${fhead(1, 'Ο ΦΟΡΟΣ', ['Φόρος στα έσοδα,', A('όχι στα καθαρά.')], 88)}${grid(38, 6, false)}${ledger()}`)}</section>

  <!-- 3 · Τα έξοδα δεν μειώνουν τον φόρο -->
  <section id="s2">${block(REEL, `${fhead(2, 'ΤΑ ΕΞΟΔΑ', ['Τα έξοδα δεν', A('μειώνουν τον φόρο.')], 88)}${taxCard(false)}${receipts(REEL, false)}`)}</section>

  <!-- 4 · Ο καταρράκτης -->
  <section id="s3">${block(REEL, `${fhead(3, 'Ο ΛΟΓΑΡΙΑΣΜΟΣ', ['Από τα ενοίκια', A('στην τσέπη.')], 88)}${waterfall(REEL, 112, 632, false)}`)}</section>

  <!-- 5 · Από κάθε 100€ ενοικίου -->
  <section id="s4">${block(REEL, `${fhead(4, 'ΤΟ ΑΠΟΤΕΛΕΣΜΑ', [`Από κάθε ${UNIT}€`, 'ενοικίου,', A(`σου μένουν ${P_NET}€.`)], 88)}${slab(REEL, SL.w, SL.h, SL.gap, 'reel')}`)}</section>

  <!-- 6 · Η εφαρμογή -->
  <section id="s5">${block(REEL, `${fhead(5, 'Η ΕΦΑΡΜΟΓΗ', [`Όλο αυτό, ${A('αυτόματα.')}`], 80, false)}
    ${sub('c5', 'Το PROPERWISE κάνει αυτόν τον λογαριασμό για <b>το δικό σου ακίνητο</b>, κάθε μήνα.', REEL)}${phone(REEL)}`)}</section>

  <!-- 7 · Με τα δικά σου νούμερα -->
  <section id="s6">${block(REEL, `${fhead(6, 'ΤΟ ΔΙΚΟ ΣΟΥ ΑΚΙΝΗΤΟ', ['Τώρα με τα δικά', A('σου νούμερα.')], 88)}${calc(true)}`)}</section>

  ${foot(REEL_FOOT)}
  <i id="carry" class="deco"></i>`;

// ── Το CSS: κοινό για reel και stories ───────────────────────────────────
const CSS = `
  /* Το φόντο: ένα φως (ο προβολέας) και κόκκος. Χωρίς σκόνη, χωρίς λάμψεις. */
  #dust,#amb{display:none}
  #bg{background:linear-gradient(180deg,#0b1424 0%,#080d17 55%,#070b12 100%)!important}
  #spot{background:radial-gradient(closest-side,rgba(138,180,248,.15),rgba(138,180,248,.05) 55%,transparent)}
  /* Τυπογραφία: ετικέτες 26, αραίωση ως .12em, τίτλοι στο −0,03em, ρυθμός 8. */
  .eb{font-size:26px;line-height:32px;letter-spacing:.12em;gap:18px}
  .eb i{width:44px}
  #top .br{font-size:26px;letter-spacing:.12em}
  .hd{letter-spacing:-.03em;line-height:1;white-space:nowrap}
  .sub2{font-size:34px;line-height:48px}
  .lb{font-size:26px;font-weight:500;line-height:32px;color:#9eabc0;white-space:nowrap}
  .lb.strong{font-weight:700;color:${C.ink}}
  .foot{position:absolute;left:90px;display:flex;gap:16px;align-items:stretch;font-size:22px;line-height:32px;color:#8a98ad}
  .foot i{flex:none;width:3px;border-radius:2px;background:${C.accent}88}
  .blk{position:absolute;display:flex;flex-direction:column;justify-content:center}
  .blk>*{flex:none}
  .card{position:relative;border-radius:${R.m}px;padding:24px 32px}

  /* 1 · Αγκίστρι */
  .hk{position:relative}
  .hk>*{position:absolute}
  .hb{left:0;right:0;display:flex}
  .hs{position:relative;height:100%}
  .hs .fl{position:absolute;inset:0;border-radius:${R.m}px;background:${SLATE};box-shadow:inset 0 1px 0 rgba(255,255,255,.22)}
  .spn{top:0;height:44px}
  .spn b{position:absolute;left:0;right:0;top:0;text-align:center;font-size:28px;line-height:32px;font-weight:800;color:${SEG.tax}}
  .spn .sl{position:absolute;left:0;right:0;top:38px;height:12px;border:2px solid rgba(239,143,127,.7);border-bottom:0;border-radius:6px 6px 0 0;transform-origin:50% 50%}
  .sgl{transform:translateX(-50%);font-size:26px;line-height:32px;font-weight:650;white-space:nowrap}
  .sgt{width:2px;border-radius:1px;opacity:.6;transform-origin:50% 0}
  .qq b{color:${SEG.tax};font-weight:800}

  /* 2 · Τετράγωνα και καθολικό */
  .tgw{position:relative}
  .tg{position:absolute;left:0;top:0;display:grid}
  .tg i{display:block;border-radius:10px;background:${SLATE};box-shadow:inset 0 1px 0 rgba(255,255,255,.16)}
  .lg{position:absolute;display:flex;align-items:center;gap:14px;height:56px}
  .lg .sw{flex:none;width:28px;height:28px;border-radius:8px}
  .lg b{font-size:40px;line-height:48px;font-weight:800;letter-spacing:-.02em}
  .lr{display:flex;justify-content:space-between;align-items:center;height:48px;font-size:28px;line-height:36px;color:#aebbd0}
  .lr + .lr{border-top:1px solid rgba(255,255,255,.08)}
  .lr b{font-weight:750;color:${C.ink}}
  .dot{display:inline-block;width:16px;height:16px;border-radius:4px;margin-right:14px;vertical-align:-1px}

  /* 3 · Κάρτα φόρου και αποδείξεις */
  .taxc .tr{display:flex;justify-content:space-between;align-items:center;gap:24px}
  .taxc .tr:first-child{height:64px}
  .taxc .tr + .tr{height:56px;margin-top:16px}
  .taxc .tr span{font-size:30px;font-weight:650;line-height:32px}
  .taxc .tr small{display:block;font-size:26px;font-weight:500;line-height:32px;color:#9eabc0}
  .taxc .tr b{font-size:48px;line-height:56px;font-weight:850;letter-spacing:-.02em}
  .tline{position:absolute;left:32px;right:32px;bottom:0;height:3px;border-radius:2px;background:${SEG.tax};opacity:.5}
  .rcw{position:relative}
  .rc{position:absolute;padding:20px 24px 16px;color:#272c35;font-family:'Roboto Mono',monospace;display:flex;flex-direction:column;
    background:linear-gradient(180deg,#f8f6f0,#f0ede5 70%,#e9e5dc);
    filter:drop-shadow(0 30px 40px rgba(0,0,0,.45)) drop-shadow(0 2px 2px rgba(0,0,0,.3));
    -webkit-mask:linear-gradient(#000,#000) 0 8px/100% calc(100% - 16px) no-repeat,
      conic-gradient(from 135deg at 50% 0,#000 90deg,#0000 0) top/16px 8px repeat-x,
      conic-gradient(from -45deg at 50% 100%,#000 90deg,#0000 0) bottom/16px 8px repeat-x}
  .rc:before{content:'';position:absolute;inset:0;background-image:${GRAIN};opacity:.16;mix-blend-mode:multiply}
  .rh{font-size:23px;line-height:32px;font-weight:700;letter-spacing:.02em;white-space:nowrap;padding-bottom:8px;border-bottom:2px dashed rgba(39,44,53,.4)}
  .rl{flex:1;display:flex;flex-direction:column;justify-content:space-around;font-size:23px;line-height:32px;letter-spacing:.01em}
  .rl div{display:flex;justify-content:space-between;gap:14px}
  /* Η σφραγίδα έχει δική της θέση, ίδια σε κάθε απόδειξη: 52px, 8 πάνω και 8 κάτω. */
  .rs{flex:none;height:52px;display:flex;align-items:center;justify-content:flex-end;border-bottom:3px double rgba(39,44,53,.55)}
  .rc:not(.long) .rs{margin-top:auto}
  .st{display:inline-block;height:36px;padding:0 12px;border:3px solid ${RED};border-radius:8px;color:${RED};font-size:20px;line-height:30px;font-weight:700;letter-spacing:.06em;
    opacity:0;mix-blend-mode:multiply;-webkit-mask-image:${GRAIN},linear-gradient(#000,#000);-webkit-mask-size:200px,100%;-webkit-mask-composite:source-over}
  .rt{flex:none;display:flex;justify-content:space-between;align-items:baseline;height:48px;padding-top:8px;font-size:23px;font-weight:700;letter-spacing:.06em}
  .rt b{font-size:34px;line-height:40px;letter-spacing:-.01em}

  /* 4 · Καταρράκτης */
  .wf{position:relative}
  .wf>*{position:absolute}
  .wf .base{left:0;right:0;height:2px;background:rgba(188,198,211,.35);transform-origin:0 50%}
  .wb{display:block;border-radius:${R.s}px;transform-origin:50% 100%;
    background:linear-gradient(180deg,var(--c),color-mix(in srgb,var(--c) 70%,#0a1220));box-shadow:inset 0 1px 0 rgba(255,255,255,.3)}
  .wb.net{background:${NET_GRAD}}
  .wv{transform:translateX(-50%);font-size:32px;line-height:40px;font-weight:800;letter-spacing:-.02em;white-space:nowrap}
  .wk{transform:translateX(-50%);white-space:nowrap;font-size:28px;line-height:32px;font-weight:600;color:#aebbd0}
  .wk.net{color:${C.accent}}
  .cn{height:2px;background:rgba(220,228,240,.32);transform-origin:0 50%}

  /* 5 · Η πλάκα των 100€ */
  .slw{position:relative}
  .slab{position:absolute;top:0;isolation:isolate}
  .band{position:absolute;left:0;right:0;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 30px 60px -20px rgba(0,0,0,.6)}
  .band i{position:absolute;inset:0;border-radius:inherit}
  .bm{background-image:linear-gradient(118deg,rgba(255,255,255,0) 28%,rgba(255,255,255,.13) 44%,rgba(255,255,255,0) 58%),linear-gradient(165deg,#5a76a3 0%,#33496f 48%,#1d2b47 100%)}
  .bm:after{content:'';position:absolute;inset:0;background-image:${GRAIN};opacity:.12;mix-blend-mode:overlay}
  .bt{opacity:0}
  .gh{border:2px dashed rgba(188,198,211,.42);opacity:0}
  .eng{position:absolute;left:0;right:0;text-align:center;line-height:128px}
  .eng b{font-size:112px;font-weight:850;letter-spacing:-.04em;color:rgba(240,245,255,.92);text-shadow:0 2px 0 rgba(0,0,0,.25),0 -1px 0 rgba(255,255,255,.25)}
  .cut{position:absolute;left:0;right:0;height:3px;border-radius:2px;background:#fff;box-shadow:0 0 16px rgba(255,255,255,.8);transform:scaleX(0);transform-origin:0 50%}
  .sglow{position:absolute;left:0;right:0;border-radius:${R.s}px;background:${C.accent};filter:blur(46px);z-index:-1}
  .sll{position:absolute;display:flex;align-items:center;gap:16px;height:56px}
  .sll .ld{flex:none;width:40px;height:2px;margin-left:-40px;background:rgba(220,228,240,.4);transform-origin:0 50%}
  .sll span{flex:1;font-size:30px;line-height:40px;font-weight:600;color:#c3cddb;white-space:nowrap}
  .sll b{font-size:44px;line-height:56px;font-weight:850;letter-spacing:-.02em}
  .sll.net span{color:${C.accent};font-weight:750}

  /* 6 · Κινητό, σε μεγέθη πραγματικής εφαρμογής */
  .phw{position:relative;flex:1 1 0!important;min-height:0}
  .phw.fixed{flex:none!important}
  #ph{position:absolute;top:0;bottom:-260px;border-radius:96px 96px 0 0;padding:16px 16px 0;
    background:linear-gradient(145deg,#4a5568,#161d2a 38%,#2d3648);box-shadow:0 80px 140px rgba(0,0,0,.7),inset 0 0 0 2px rgba(255,255,255,.09);
    -webkit-mask-image:linear-gradient(180deg,#000 calc(100% - 330px),transparent calc(100% - 260px))}
  #ph .scr{position:relative;width:100%;height:100%;border-radius:80px 80px 0 0;overflow:hidden;background:linear-gradient(180deg,#0e1626,#070b12 70%)}
  #ph .isl{position:absolute;left:50%;top:22px;width:168px;height:48px;margin-left:-84px;border-radius:26px;background:#000}
  #ph .ap{padding:88px 40px 0}
  #ph .ah{display:flex;align-items:center;gap:16px;height:56px;font-size:30px;margin-bottom:8px}
  #ph .ah .m{width:56px;height:56px;border-radius:16px;background:${C.panel};border:1.5px solid ${C.rule};display:flex;align-items:center;justify-content:center}
  #ph .ah b{font-weight:700}
  #ph .ah .y{margin-left:auto;font-size:26px;color:${C.faint};font-family:'Roboto Mono',monospace}
  #ph .ar{display:flex;justify-content:space-between;align-items:center;height:64px;border-top:1.5px solid ${C.rule};font-size:30px;color:${C.muted}}
  #ph .ar b{font-weight:700;color:${C.ink}}
  #ph .abig{margin-top:8px;padding:16px 24px;border-radius:${R.m}px;background:${C.accent}14;border:1.5px solid ${C.accent}55}
  #ph .abig span{font-size:26px;line-height:32px;color:#a9bad3}
  #ph .abig div{display:flex;justify-content:space-between;align-items:baseline}
  #ph .abig b{font-size:64px;line-height:72px;font-weight:850;letter-spacing:-.03em;color:${C.accent}}
  #ph .abig em{font-style:normal;font-size:28px;font-weight:700;color:${C.accent}}
  #ph .abar{display:flex;gap:6px;height:24px;margin-top:24px}
  #ph .abar i{display:block;border-radius:6px;transform-origin:0 50%}
  #ph .chips{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
  #ph .chips span{font-size:26px;line-height:32px;color:${C.muted};padding:8px 18px;border-radius:999px;border:1.5px solid ${C.rule}}
  #carry{position:absolute;left:0;top:0;width:10px;height:10px;opacity:0;background:${NET_GRAD};
    box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 0 50px ${C.accent}66;transform-origin:0 0}

  /* 7 · Ο υπολογιστής */
  .calc .ch{display:flex;align-items:center;gap:16px;height:48px}
  .calc .ci{flex:none;width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:rgba(138,180,248,.14);border:1px solid rgba(138,180,248,.3)}
  .calc .ch b{font-size:34px;line-height:48px;font-weight:750;letter-spacing:-.01em}
  .calc .cf{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:32px}
  .calc .fld .lb{display:block}
  .calc .in{display:flex;align-items:center;height:88px;margin-top:8px;padding:0 20px;border-radius:${R.s}px;background:rgba(7,11,18,.55);border:1.5px solid ${C.rule}}
  .calc .in .v{font-size:40px;line-height:48px;font-weight:650;letter-spacing:-.01em;color:${C.ink}}
  .calc .in .u{margin-left:auto;font-size:30px;color:#7d8da6}
  .calc .caret{display:inline-block;width:3px;height:48px;margin-left:3px;border-radius:2px;background:${C.accent};opacity:0}
  .calc .cr{display:flex;justify-content:space-between;align-items:center;height:64px;margin-top:32px;padding-top:24px;border-top:1px solid rgba(255,255,255,.1);box-sizing:content-box}
  .calc .cr>span{font-size:34px;line-height:48px;font-weight:650}
  .calc .crv{position:relative;display:flex;align-items:center;justify-content:flex-end;height:64px}
  .calc .crv b{font-size:56px;line-height:64px;font-weight:850;letter-spacing:-.02em;color:${C.accent};white-space:nowrap}
  .calc .crv em{font-style:normal;font-size:30px;font-weight:700;color:#a9c4ef}
  .calc .sk{position:absolute;right:0;top:20px;width:280px;height:24px;border-radius:12px;opacity:0;
    background:linear-gradient(90deg,rgba(255,255,255,.06),rgba(255,255,255,.12),rgba(255,255,255,.06));background-size:200% 100%}
  .urlr{display:flex;flex-direction:column;align-items:flex-start;gap:12px;margin-top:24px}
  .chip{display:inline-flex;align-items:center;gap:10px;height:56px;white-space:nowrap;flex:none;padding:0 20px 0 16px;border-radius:999px;background:rgba(138,180,248,.1);border:1.5px solid rgba(138,180,248,.4);
    font-family:'Roboto Mono',monospace;font-size:26px;letter-spacing:0;color:${C.ink}}
  .chip .li{display:grid;place-items:center;width:26px;height:26px}`;

const JS = `
    const fin = (id, u, s, d, dy) => { const v = eo(p(u, s, s + (d || .55))); op($(id), v); tf($(id), 'translateY(' + ((dy == null ? 28 : dy) * (1 - v)) + 'px)'); return v; };
    const cnt = (id, arr, u, s, e) => { $(id).textContent = arr[Math.round(eo(p(u, s, e)) * (arr.length - 1))]; };
    const rgb = h => hex(h), mx = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k), css = a => 'rgb(' + a.map(Math.round).join(',') + ')';
    const oq = x => 1 - (1 - x) * (1 - x);
    // Γεωμετρία: μετριέται μία φορά, πριν από οποιονδήποτε μετασχηματισμό.
    if (!window.G) {
      const cam = $('cam').getBoundingClientRect(), r = id => { const b = $(id).getBoundingClientRect(); return { x: b.left - cam.left, y: b.top - cam.top, w: b.width, h: b.height }; };
      window.G = { n: r('nb3'), b: r('ab3'), tc: r('tc'), rc: [0, 1, 2, 3].map(k => r('r' + k)) };
    }
    const G = window.G;
    $('m4').textContent = D.free; $('m4').style.color = '${C.accent}';
    op($('demo'), 1 - eo(p(t, D.END - .3, D.END + .2)));

    // ── 1 · Το αγκίστρι: το ενοίκιο λιγοστεύει μπροστά σου ─────────────
    u = scene(0);
    { const e = $('e0'), v = eo(p(t, -.3, .2)); op(e, v); tf(e, 'translateX(' + (-24 * (1 - v)) + 'px)'); }
    [-.8, -.7, -.6].forEach((s, k) => rev('q' + k, s, null, .55));
    { let ph = 0; for (let k = 0; k < 3; k++) if (t >= D.drop[k]) ph = k;
      const s = D.drop[ph], i = Math.round(eo(p(t, s, s + .45)) * ${STEPS});
      $('hn').textContent = D.hookN[ph][i]; $('hp').textContent = D.hookP[ph][i]; }
    // Πρώτο καρέ: μία συμπαγής μπάρα. Ραγίζει στα τέσσερα, τα τρία μένουν ως σκιές στο χρώμα τους.
    const crack = eo(p(t, .1, .45));
    for (let k = 0; k < 4; k++) {
      const f = $('hf' + k), rl = k ? 20 * crack : 20, rr = k < 3 ? 20 * crack : 20;
      f.style.borderRadius = rl + 'px ' + rr + 'px ' + rr + 'px ' + rl + 'px';
      f.style.right = (k < 3 ? -${HB.gap} * (1 - crack) : 0) + 'px';
      if (k < 3) {
        const s = D.drop[k], tint = eo(p(t, s - .25, s)), fade = eo(p(t, s, s + .5));
        f.style.background = css(mx(rgb('${SLATE}'), rgb(D.seg[k]), tint));
        op(f, 1 - .78 * fade); tf(f, 'translateY(' + (10 * Math.sin(Math.PI * fade)) + 'px)');
        const lv = eo(p(t, s + .1, s + .5)); op($('sg' + k), lv); tf($('sg' + k), 'translate(-50%,' + (12 * (1 - lv)) + 'px)');
        if ($('sgt' + k)) { op($('sgt' + k), .6 * lv); tf($('sgt' + k), 'scaleY(' + lv + ')'); }
      } else {
        // Ό,τι μένει γίνεται μπλε: το χρώμα των καθαρών σε όλο το reel.
        const v = eo(p(t, 2.0, 2.4));
        f.style.background = v >= 1 ? '${NET_GRAD}' : css(mx(rgb('${SLATE}'), rgb('${C.accent}'), v));
        f.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.3),0 0 ' + (60 * v) + 'px rgba(138,180,248,' + (.35 * v) + ')';
        const lv = eo(p(t, 2.1, 2.5)); op($('sg3'), lv); tf($('sg3'), 'translate(-50%,' + (12 * (1 - lv)) + 'px)');
      }
    }
    op($('hl0'), 1 - eo(p(t, 1.8, 2.1)));
    { const v = eo(p(t, 2.0, 2.4)); tf($('hsx'), 'scaleX(' + v + ')'); op($('hsx'), v > 0 ? 1 : 0);
      const w = eo(p(t, 2.2, 2.6)); op($('hsl'), w); tf($('hsl'), 'translateY(' + (10 * (1 - w)) + 'px)'); }
    $('hp').style.color = t > 2.0 ? '${C.accent}' : '';
    rev('q3', 2.4, null, .55); rev('q4', 2.52, null, .55); shine($('q2'), 2.8);

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
        const s = D.rcT[k], tc = s + .4, el = $('r' + k), Q = G.rc[k], rot0 = D.rot[k];
        if (u < s) { op(el, 0); continue; }
        op(el, 1);
        const cx = (540 - (Q.x + Q.w / 2)) * .3, cy = G.tc.y + G.tc.h + 8 - Q.y;
        let x, y, rot;
        if (u < tc) { const q = oq(p(u, s, tc)); x = cx * q; y = lerp(1960 - Q.y, cy, q); rot = rot0 * (2 - q); }
        else { const q = spring(p(u, tc, tc + .9)); x = cx * (1 - q); y = cy * (1 - q); rot = rot0 * (1 - q); }
        tf(el, 'translate(' + x + 'px,' + y + 'px) rotate(' + rot + 'deg)');
        if (u > tc) { const d = u - tc; bump += Math.exp(-d * 14) * Math.sin(d * 42) * 7; glow = Math.max(glow, Math.exp(-d * 5)); }
        const sv = ei(p(u, tc - .1, tc)); op($('st' + k), sv > 0 ? 1 : 0);
        tf($('st' + k), 'rotate(-3deg) scale(' + (1.9 - .9 * sv) + ')');
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
        // Ό,τι φεύγει μένει ως σκιά στο χρώμα του, όπως στο αγκίστρι: χωρίς υλικό, στο 22%.
        op(b.children[0], lost ? 1 - away : 1);
        op($('bt' + k), tint * (lost ? 1 - .78 * away : 1));
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

    // ── 7 · Ο υπολογιστής: τα νούμερα του παραδείγματος σβήνουν, σειρά σου ─
    u = scene(6); heads(6);
    fin('calc', u, .45, .6, 40);
    fin('urlr', u, 1.1, .5, 16);
    { const C0 = D.clr, ST = D.clrStep, end = C0 + 3 * ST + .45;
      let focus = -1;
      for (let k = 0; k < 4; k++) {
        const s = C0 + k * ST, q = p(u, s, s + .4), str = D.cv[k];
        $('cv' + k).textContent = str.slice(0, Math.round(str.length * (1 - q)));
        if (u >= s - .12 && u < s + .45) focus = k;
      }
      const blink = u >= end ? (Math.floor((u - end) * 2) % 2 === 0 ? 1 : 0) : 1;
      for (let k = 0; k < 4; k++) op($('cc' + k), u >= end ? (k === 0 ? blink : 0) : (k === focus ? 1 : 0));
      for (let k = 0; k < 4; k++) $('cin' + k).style.borderColor = (u >= end ? k === 0 : k === focus) ? 'rgba(138,180,248,.7)' : '';
      if ($('crv')) { op($('crv'), 1 - eo(p(u, C0 + .05, C0 + .35))); op($('csk'), eo(p(u, C0 + .2, C0 + .6))); $('csk').style.backgroundPosition = (100 - (u * 40) % 200) + '% 0'; } }`;

// ═══ Τα stories: επτά αφίσες, όχι καρέ του βίντεο ═══════════════════════
interface Story { light: [number, number]; slot: boolean; foot: boolean; body: string }
const STORIES: Story[] = [
  { // 1 · Κουίζ
    light: [540, 1000], slot: true, foot: true,
    body: block(STORY_S, `
      <div class="eb mono" data-col="L"><i></i>ΠΑΡΑΔΕΙΓΜΑ · ${esc(UP(PROP_SPOKEN))}</div>
      <div class="sub2" style="margin-top:16px;color:#aebbd0" data-col="L">${esc(eur(GROSS))} ενοίκια τον χρόνο.</div>
      <div class="hd" style="font-size:96px;margin-top:16px" data-col="L" data-hend><div>Πόσα από τα ${UNIT}€</div><div>${A('σου μένουν;')}</div></div>
      ${slab(STORY_S, 400, 520, 0, 'whole', true)}`),
  },
  { // 2 · Ο φόρος
    light: [330, 1000], slot: false, foot: true,
    body: block(STORY, `${fhead(null, 'Ο ΦΟΡΟΣ', ['Φόρος στα έσοδα,', A('όχι στα καθαρά.')], 88, false)}
      ${sub('s2s', `Για έξοδα η εφορία αφαιρεί σταθερό ${esc(PRES)}, όσα κι αν ξόδεψες. Στο υπόλοιπο ${esc(TAXED_SHARE)} πληρώνεις φόρο ${esc(RATE)}.`, STORY)}
      ${grid(40, 6, true)}${ledger()}`),
  },
  { // 3 · Τα έξοδα
    light: [540, 1150], slot: false, foot: true,
    body: block(STORY, `${fhead(null, 'ΤΑ ΕΞΟΔΑ', ['Τα έξοδα δεν', A('μειώνουν τον φόρο.')], 88, false)}
      ${sub('s3s', 'Επισκευές, ασφάλιση, ΕΝΦΙΑ: όσα κι αν πληρώσεις στην πράξη, ο φόρος μένει ίδιος.', STORY)}
      ${taxCard(true)}${receipts(STORY, true)}`),
  },
  { // 4 · Ο λογαριασμός, με δημοσκόπηση
    light: [540, 900], slot: true, foot: true,
    body: block(STORY_S, `${fhead(null, 'Ο ΛΟΓΑΡΙΑΣΜΟΣ', ['Από τα ενοίκια', A('στην τσέπη.')], 88)}${waterfall(STORY_S, 120, 560, true)}`),
  },
  { // 5 · Το αποτέλεσμα
    light: [280, 1100], slot: false, foot: true,
    body: block(STORY, `${fhead(null, 'ΤΟ ΑΠΟΤΕΛΕΣΜΑ', [`Από κάθε ${UNIT}€`, 'ενοικίου,', A(`σου μένουν ${P_NET}€.`)], 88)}${slab(STORY, 340, 780, 12, 'cut')}`),
  },
  { // 6 · Η εφαρμογή
    light: [540, 1100], slot: false, foot: true,
    body: block(STORY, `${fhead(null, 'Η ΕΦΑΡΜΟΓΗ', ['Όλο αυτό,', A('αυτόματα.')], 88, false)}
      ${sub('s6s', 'Το PROPERWISE κάνει αυτόν τον λογαριασμό για <b>το δικό σου ακίνητο</b>, κάθε μήνα.', STORY)}${phone(STORY, 800)}`),
  },
  { // 7 · Με τα δικά σου νούμερα, με σύνδεσμο
    light: [540, 850], slot: true, foot: false,
    body: block(STORY_S, `${fhead(null, 'ΤΟ ΔΙΚΟ ΣΟΥ ΑΚΙΝΗΤΟ', ['Τώρα με τα δικά', A('σου νούμερα.')], 88)}${calc(false)}`),
  },
];
const STORY_CSS = `
  .story{position:absolute;inset:0}
  .light{position:absolute;width:1200px;height:1200px;border-radius:50%;background:radial-gradient(closest-side,rgba(138,180,248,.15),rgba(138,180,248,.05) 55%,transparent)}
  .shd{position:absolute;left:90px;right:90px;top:262px;height:34px;display:flex;align-items:center;justify-content:space-between}
  .shd .br{display:flex;align-items:center;gap:14px;font-size:26px;line-height:34px;font-weight:800;letter-spacing:.12em}
  .shd .n{font-family:'Roboto Mono',monospace;font-size:26px;letter-spacing:.12em;color:${C.faint}}`;
const storyPage = (s: Story, n: number) => `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${BASE_CSS}${KIT_CSS}${CSS}${STORY_CSS}</style></head><body>
  <div id="bg"></div>
  <div class="light" style="left:${s.light[0] - 600}px;top:${s.light[1] - 600}px"></div>
  <div class="story">
    <div class="shd"><div class="br" data-col="L">${mark(34, C.ink)}<span>PROPERWISE</span></div><span class="n" data-col="R">${n} / ${STORIES.length}</span></div>
    ${s.body}
    ${s.foot ? foot(STORY_FOOT) : ''}
  </div>
  <div class="vig"></div><div class="grain"></div>
  </body></html>`;

// ═══ Ο έλεγχος στοίχισης ═════════════════════════════════════════════════
// data-col L/R/LR: η ακμή πάνω στη στήλη · data-lx / data-rx: κοινή αριστερή /
// δεξιά ακμή ανά ομάδα · data-gap: ίσα κενά ανά ομάδα · data-cx: κεντραρισμένο
// στο στοιχείο με αυτό το id · data-ccol: κεντραρισμένο στη στήλη · data-hend:
// το τέλος της κεφαλής (το κενό ως το περιεχόμενο μετριέται από εκεί).
// Ως κείμενο: το tsx ντύνει τις ονομασμένες συναρτήσεις με βοηθό που ο περιηγητής δεν έχει.
const AUDIT = (f: Frame, slot: { y: number; h: number } | null) => `(() => {
  const F = ${JSON.stringify(f)}, SLOT = ${JSON.stringify(slot)};
  const vis = el => { for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (Number(s.opacity) < .5 || s.display === 'none') return false; } return true; };
  const all = sel => Array.from(document.querySelectorAll(sel)).filter(vis);
  const rc = el => el.getBoundingClientRect();
  const name = el => (el.id || el.className || el.tagName) + ' «' + (el.textContent || '').trim().slice(0, 18) + '»';
  const out = { n: 0, edge: 0, share: 0, gap: 0, cx: 0, fails: [] };
  const bad = (m) => out.fails.push(m);
  for (const el of all('[data-col]')) {
    const r = rc(el), c = el.dataset.col; out.n++;
    if (el.scrollWidth > el.clientWidth + 1) bad('το κείμενο ξεχειλίζει από ' + name(el) + ' κατά ' + (el.scrollWidth - el.clientWidth) + 'px');
    if (c.includes('L')) { const d = Math.abs(r.left - F.L); out.edge = Math.max(out.edge, d); if (d > 1) bad('αριστερή ακμή ' + name(el) + ' στο ' + r.left.toFixed(1)); }
    if (c.includes('R')) { const d = Math.abs(r.right - F.R); out.edge = Math.max(out.edge, d); if (d > 1) bad('δεξιά ακμή ' + name(el) + ' στο ' + r.right.toFixed(1)); }
  }
  for (const [attr, side] of [['lx', 'left'], ['rx', 'right']]) {
    const groups = {};
    for (const el of all('[data-' + attr + ']')) (groups[el.dataset[attr]] ||= []).push(rc(el)[side]);
    for (const [g, xs] of Object.entries(groups)) { out.n += xs.length; const d = Math.max(...xs) - Math.min(...xs); out.share = Math.max(out.share, d); if (d > 1) bad('ομάδα ' + attr + ' «' + g + '» απόκλιση ' + d.toFixed(1)); }
  }
  { const groups = {};
    for (const el of all('[data-gap]')) (groups[el.dataset.gap] ||= []).push(rc(el));
    for (const [g, rs] of Object.entries(groups)) { if (rs.length < 3) continue; const gs = rs.slice(1).map((r, i) => r.top - rs[i].bottom); out.n += gs.length;
      const d = Math.max(...gs) - Math.min(...gs); out.gap = Math.max(out.gap, d); if (d > 2) bad('κενά «' + g + '» ' + gs.map(x => x.toFixed(1)).join('/')); } }
  for (const el of all('[data-cx]')) { const a = rc(el), b = rc(document.getElementById(el.dataset.cx)); out.n++;
    const d = Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2); out.cx = Math.max(out.cx, d); if (d > 1) bad('κέντρο ' + name(el) + ' απόκλιση ' + d.toFixed(1)); }
  for (const el of all('[data-ccol]')) { const a = rc(el); out.n++;
    const d = Math.abs((a.left + a.right) / 2 - (F.L + F.R) / 2); out.cx = Math.max(out.cx, d); if (d > 1) bad('κέντρο στήλης ' + name(el) + ' απόκλιση ' + d.toFixed(1)); }
  const blk = all('.blk')[0];
  if (blk) {
    const kids = Array.from(blk.children).filter(vis), first = rc(kids[0]), last = rc(kids[kids.length - 1]);
    out.top = Math.round(first.top - F.top); out.bottom = Math.round(F.bottom - last.bottom);
    const he = blk.querySelector('[data-hend]'); if (he && he.nextElementSibling) out.hgap = Math.round(rc(he.nextElementSibling).top - rc(he).bottom);
    if (out.bottom < 0 || out.top < 0) bad('η στήλη ξεχειλίζει: πάνω ' + out.top + ', κάτω ' + out.bottom);
  }
  if (SLOT) for (const el of all('.story *')) { const r = rc(el); if (!r.width || !r.height) continue;
    if (r.top < SLOT.y + SLOT.h && r.bottom > SLOT.y && !(r.top <= SLOT.y && r.bottom >= SLOT.y + SLOT.h && el.children.length)) bad('στη θέση του αυτοκόλλητου: ' + name(el)); }
  for (const el of all('.story *')) { const r = rc(el); const own = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
    if (own && r.width && (r.left < 80 || r.right > 1000 || r.top < 250 || r.bottom > 1670)) bad('έξω από το story: ' + name(el)); }
  return out;
})()`;
interface AuditRow { where: string; n: number; edge: number; share: number; gap: number; cx: number; top?: number; bottom?: number; hgap?: number; fails: string[] }
const auditRows: AuditRow[] = [];

async function audit() {
  const browser = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] });
  try {
    const pg = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    await pg.setContent(page(X), { waitUntil: 'load' });
    await pg.evaluate(() => document.fonts.ready);
    for (const [k, t] of X.stills.slice(0, 7).entries()) {
      await pg.evaluate((x: number) => (window as unknown as { render: (t: number) => void }).render(x), t);
      // Το κάδρο χωρίς το ζουμ του περάσματος και το τίναγμα της κάμερας: μετριέται η σελίδα, όχι η κίνηση.
      await pg.evaluate(`document.querySelectorAll('section').forEach(s => { s.style.transform = 'none'; s.style.filter = 'none'; }); document.getElementById('cam').style.transform = 'none';`);
      auditRows.push({ where: `reel ${k + 1}`, ...((await pg.evaluate(AUDIT(REEL, null))) as Omit<AuditRow, 'where'>) });
    }
    for (const [i, s] of STORIES.entries()) {
      await pg.setContent(storyPage(s, i + 1), { waitUntil: 'load' });
      await pg.evaluate(() => document.fonts.ready);
      auditRows.push({ where: `story ${i + 1}`, ...((await pg.evaluate(AUDIT(s.slot ? STORY_S : STORY, s.slot ? ST_SLOT : null))) as Omit<AuditRow, 'where'>) });
    }
  } finally {
    await browser.close();
  }
  const pad = (s: string | number, n: number) => String(s).padStart(n);
  console.log('\n  σκηνή      στοιχεία  ακμή  κοινή  κενά  κέντρο   πάνω  κάτω  τίτλος→  ');
  for (const r of auditRows) console.log(`  ${r.where.padEnd(9)} ${pad(r.n, 9)} ${pad(r.edge.toFixed(1), 5)} ${pad(r.share.toFixed(1), 6)} ${pad(r.gap.toFixed(1), 5)} ${pad(r.cx.toFixed(1), 7)} ${pad(r.top ?? '', 6)} ${pad(r.bottom ?? '', 5)} ${pad(r.hgap ?? '', 7)}  ${r.fails.length ? '✗' : '✓'}`);
  const hg = auditRows.map(r => r.hgap).filter((x): x is number => typeof x === 'number');
  const fails = auditRows.flatMap(r => r.fails.map(f => `${r.where}: ${f}`));
  if (Math.max(...hg) - Math.min(...hg) > 2) fails.push(`το κενό τίτλου–περιεχομένου διαφέρει: ${hg.join('/')}`);
  if (fails.length) throw new Error(`Ο έλεγχος στοίχισης απέτυχε:\n  ${fails.slice(0, 30).join('\n  ')}`);
  console.log('✓ στοίχιση: κάθε ακμή στη στήλη της (≤1px), κάθε επαναλαμβανόμενο κενό ίσο (≤2px)\n');
}

async function stories(dir: string) {
  const browser = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] });
  try {
    for (const [i, s] of STORIES.entries()) {
      const pg = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
      await pg.setContent(storyPage(s, i + 1), { waitUntil: 'load' });
      await pg.evaluate(() => document.fonts.ready);
      await pg.screenshot({ path: join(dir, `${i + 1}.png`) });
      await pg.close();
      console.log(`  ✓ story ${i + 1}`);
    }
  } finally {
    await browser.close();
  }
}

/** Αντίγραφο για το Instagram, κάτω από 28 MB: H.264 δύο περασμάτων, AAC 192k. */
function igCopy(dir: string) {
  const FF = process.env.FFMPEG || 'ffmpeg', log = join(dir, 'x264pass'), out = join(dir, 'PROPERWISE-pou-pigan-ta-enoikia-instagram.mp4');
  // Ο ρυθμός βγαίνει από τη διάρκεια: 27,5 MB συνολικά, μείον ήχο και περιέκτη.
  const kbps = Math.floor((27.5e6 * 8 / DUR - 192e3 - 30e3) / 1000);
  const v = ['-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-level:v', '4.1', '-pix_fmt', 'yuv420p', '-b:v', `${kbps}k`, '-maxrate', '5M', '-bufsize', '8M',
    '-g', '60', '-keyint_min', '60', '-sc_threshold', '0', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-passlogfile', log];
  const a = spawnSync(FF, ['-y', '-loglevel', 'error', '-i', join(dir, 'reel.mp4'), ...v, '-pass', '1', '-an', '-f', 'mp4', '/dev/null'], { stdio: 'inherit' });
  const b = spawnSync(FF, ['-y', '-loglevel', 'error', '-i', join(dir, 'reel.mp4'), '-i', join(dir, 'sound.wav'), '-map', '0:v', '-map', '1:a', ...v, '-pass', '2',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
  for (const f of readdirSync(dir)) if (f.startsWith('x264pass')) rmSync(join(dir, f));
  if (a.status !== 0 || b.status !== 0) throw new Error('Το ffmpeg απέτυχε στο αντίγραφο του Instagram.');
  const mb = statSync(out).size / 1e6;
  if (mb >= 28) throw new Error(`Το αντίγραφο του Instagram είναι ${mb} MB.`);
  console.log(`✓ ${out} (${Math.round(mb * 10) / 10} MB, ${kbps} kbps)`);
}

// ═══ Τα κείμενα ═════════════════════════════════════════════════════════
const LINK = 'https://properwise.gr';
const CALC_LINK = `https://${CALC_URL}`;
const CAPTION = [
  `${PROP_CAP}: ${eur(GROSS)} ενοίκια τον χρόνο. Καθαρά μένουν ${eur(NET)}.`,
  '',
  `Πού πήγαν τα ${eur(LOST)}; Ο λογαριασμός γραμμή γραμμή: τι παίρνει ο φόρος, τι ο ΕΝΦΙΑ, τι τα έξοδα.`,
  '',
  `Φόρος στα έσοδα, όχι στα καθαρά. Στη μακροχρόνια μίσθωση ο φόρος υπολογίζεται στα έσοδα από το ενοίκιο, όχι σε ό,τι σου μένει μετά τα έξοδα. Για έξοδα η εφορία αφαιρεί ένα σταθερό ${PRES} του ενοικίου, όσα κι αν ξόδεψες στην πράξη. Στο υπόλοιπο ${TAXED_SHARE} πληρώνεις φόρο. Επισκευές, ασφάλιση και ΕΝΦΙΑ τα πληρώνεις κανονικά, αλλά δεν εκπίπτουν.`,
  '',
  `Από κάθε ${UNIT}€ ενοικίου, σου μένουν ${P_NET}€.`,
  '',
  `Τώρα με τα δικά σου νούμερα: ο υπολογιστής καθαρής απόδοσης στο ${CALC_URL}${NO_SIGNUP ? ', δωρεάν και χωρίς εγγραφή' : ''}. Βάζεις ενοίκιο, μήνες, ΕΝΦΙΑ και δαπάνες και βλέπεις πόσα σου μένουν.`,
  '',
  `Και στο PROPERWISE ο ίδιος λογαριασμός για κάθε ακίνητο, κάθε μήνα. Ενοίκια, δαπάνες, φόροι και προθεσμίες σε μία εφαρμογή. Φωτογραφίζεις τον λογαριασμό και καταχωρείται. Ρωτάς ${ASSISTANT_ACC} και απαντά με τα δικά σου νούμερα.`,
  '',
  'Αποθήκευσέ το για τη φορολογική δήλωση. Στείλ\' το σε κάποιον που νοικιάζει το σπίτι του.',
  '',
  `Δωρεάν ${FREE_WORDS}. Σύνδεσμος στο bio.`,
  '',
  `Παράδειγμα με δεδομένα επίδειξης: φυσικό πρόσωπο, μακροχρόνια μίσθωση, χρονιά ${S.year}. Κάθε ακίνητο έχει τα δικά του νούμερα· για τη δική σου περίπτωση, ο λογιστής σου.`,
  '',
  '#ακίνητα #ενοίκια #ΕΝΦΙΑ #φορολογία #ιδιοκτήτες #PROPERWISE',
].join('\n');

const ALT = `Βίντεο ${Math.round(DUR)} δευτερολέπτων. ${PROP_CAP}: ${eur(GROSS)} ενοίκια τον χρόνο, σου μένουν ${eur(NET)}. Πού πήγαν τα ${eur(LOST)}; Η μπάρα του ενοικίου χωρίζεται σε φόρο, ΕΝΦΙΑ, έξοδα και ό,τι σου μένει. `
  + `Φόρος στα έσοδα, όχι στα καθαρά: σταθερή έκπτωση ${PRES} για επισκευές (${eur(PRESUMPTIVE)}), φορολογητέο εισόδημα ${eur(TAXABLE)}, φόρος εισοδήματος ${RATE} ${eur(TAX)}. `
  + `Τα έξοδα δεν μειώνουν τον φόρο: τέσσερις αποδείξεις (ΕΝΦΙΑ ${eur(ENFIA)}, ${TOP[0].label.toLocaleLowerCase('el')} ${eur(TOP[0].amount)}, ${TOP[1].label.toLocaleLowerCase('el')} ${eur(TOP[1].amount)} και άλλες ${REST.length} δαπάνες ${eur(REST_SUM)}) σφραγίζονται «Δεν εκπίπτει». Μείωση φόρου από τις αποδείξεις: ${feWhole(CUT)}. `
  + `Ο λογαριασμός: ${eur(GROSS)} μείον φόρος ${eur(TAX)}, μείον ΕΝΦΙΑ ${eur(ENFIA)}, μείον έξοδα ${eur(OTHER)}: μένουν ${eur(NET)}. `
  + `Από κάθε ${UNIT}€ ενοικίου: ${P_TAX}€ φόρος, ${P_ENFIA}€ ΕΝΦΙΑ, ${P_OTHER}€ επισκευές και έξοδα, σου μένουν ${P_NET}€. `
  + `Η εφαρμογή PROPERWISE δείχνει τον ίδιο λογαριασμό για το ακίνητο. Τέλος ο υπολογιστής καθαρής απόδοσης στο ${CALC_URL}: τα πεδία ${CALC_FIELDS.map(f => `«${f}»`).join(', ').replace(/, (?=[^,]*$)/, ' και ')} αδειάζουν για τα δικά σου νούμερα.`;

const STORY_ALT = [
  `Κουίζ: ${eur(GROSS)} ενοίκια τον χρόνο. Πόσα από τα ${UNIT}€ σου μένουν;`,
  `Φόρος στα έσοδα, όχι στα καθαρά. Εκατό τετράγωνα: ${PRES} χωρίς φόρο (σταθερή έκπτωση), ${TAXED_SHARE} φορολογητέο, ${PCT(P_TAX)} φόρος. Έσοδα ${eur(GROSS)}, φόρος ${RATE} ${eur(TAX)}.`,
  `Τα έξοδα δεν μειώνουν τον φόρο. Φόρος εισοδήματος ${eur(TAX)}, μείωση φόρου από τις αποδείξεις ${feWhole(CUT)}. Τέσσερις αποδείξεις με τη σφραγίδα «Δεν εκπίπτει».`,
  `Από τα ενοίκια στην τσέπη: ${eur(GROSS)}, μείον φόρος ${eur(TAX)}, ΕΝΦΙΑ ${eur(ENFIA)}, έξοδα ${eur(OTHER)}, μένουν ${eur(NET)}.`,
  `Από κάθε ${UNIT}€ ενοικίου, σου μένουν ${P_NET}€. Φόρος ${P_TAX}€, ΕΝΦΙΑ ${P_ENFIA}€, επισκευές και έξοδα ${P_OTHER}€.`,
  'Όλο αυτό, αυτόματα. Η εφαρμογή PROPERWISE δείχνει τον λογαριασμό του ακινήτου.',
  `Τώρα με τα δικά σου νούμερα: ο υπολογιστής καθαρής απόδοσης με άδεια πεδία, ${CALC_URL}${NO_SIGNUP ? ', δωρεάν, χωρίς εγγραφή' : ''}.`,
];

const README = [
  '# Reel: «Πού πήγαν τα ενοίκια;»',
  '',
  'Το carousel `carousel-1` σε κίνηση, για Instagram Reels και YouTube Shorts: 1080×1920, 30 fps,',
  `περίπου ${Math.round(DUR)}″, πρωτότυπη μουσική. Και επτά stories σχεδιασμένα ως αφίσες. Όλα τα ποσά από`,
  'το ακίνητο επίδειξης (`lib/demo/sample.ts`) μέσα από την `incomeStatement`, όπως στο carousel. Η τελευταία',
  `σκηνή δείχνει τον υπολογιστή ${CALC_URL} με τις ετικέτες του component και αποτέλεσμα από την ίδια`,
  '`propertyYield` που τρέχει η σελίδα.',
  '',
  '    npx tsx scripts/marketing/reelKathara.ts',
  '    STORIES_ONLY=1 npx tsx scripts/marketing/reelKathara.ts   # μόνο τα stories',
  '    AUDIT_ONLY=1 npx tsx scripts/marketing/reelKathara.ts     # μόνο ο έλεγχος στοίχισης',
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
  'Με τη σειρά, την ίδια μέρα με το reel. Τα 1, 4 και 7 έχουν άδεια θέση 220px κάτω από το γράφημα για το αυτοκόλλητο.',
  '',
  `1. Κουίζ «Πόσα από τα ${UNIT}€ σου μένουν;». Επιλογές: ${UNIT - EXEMPT}€, ${UNIT - P_TAX}€, ${P_NET}€ (σωστό).`,
  '2. Ο φόρος (χωρίς αυτοκόλλητο).',
  '3. Τα έξοδα (χωρίς αυτοκόλλητο).',
  '4. Δημοσκόπηση «Το ήξερες ότι τα έξοδα δεν μειώνουν τον φόρο;». Επιλογές: «Το ήξερα», «Πρώτη φορά».',
  '5. Το αποτέλεσμα (χωρίς αυτοκόλλητο).',
  '6. Η εφαρμογή (χωρίς αυτοκόλλητο).',
  `7. Αυτοκόλλητο συνδέσμου στο ${CALC_LINK} με κείμενο «Υπολόγισε τα δικά σου».`,
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
  `Τώρα με τα δικά σου νούμερα: ${CALC_LINK}${NO_SIGNUP ? ' (δωρεάν, χωρίς εγγραφή)' : ''}. Το PROPERWISE κάνει αυτόν τον λογαριασμό για το δικό σου ακίνητο, κάθε μήνα. Δωρεάν ${FREE_WORDS}: ${LINK}`,
  '',
  `Παράδειγμα με δεδομένα επίδειξης: φυσικό πρόσωπο, μακροχρόνια μίσθωση, χρονιά ${S.year}. Για τη δική σου περίπτωση, ο λογιστής σου.`,
  '',
  '**Ετικέτες:** ενοίκια, φόρος ενοικίων, ΕΝΦΙΑ, φορολογική δήλωση, ιδιοκτήτες ακινήτων, μακροχρόνια μίσθωση, καθαρή απόδοση, ακίνητα, PROPERWISE',
  '',
  '## Καρφιτσωμένο σχόλιο',
  '',
  `Βάλε τα δικά σου νούμερα στο ${CALC_URL}${NO_SIGNUP ? ', δωρεάν και χωρίς εγγραφή' : ''}. Πόσα σου μένουν καθαρά;`,
].join('\n');

const X: Explainer = {
  slug: 'reel-kathara', file: 'PROPERWISE-pou-pigan-ta-enoikia.mp4',
  scenes: SC, end: END, dur: DUR, html: HTML, css: CSS, heads: [0, 2, 2, 2, 3, 1, 2], js: JS,
  data: {
    free: UP(`Δωρεάν ${FREE_WORDS}`), drop: DROP, hookN: HOOK_N, hookP: HOOK_P, seg: PARTS.map(x => x.c),
    tiles: TILES, exempt: EXEMPT, ptax: P_TAX, taxRun: negRun(TAX),
    rcT: RC.map((_, k) => .9 + k * .85), rot: RC_ROT, hitZero: HIT_ZERO,
    wfT: WF_T, wfV: WB.map(b => b.val),
    gap: SL.gap, hitNet: HIT_NET, hand: HAND, land: LAND,
    netRun: run(0, NET), cv: CALC_VALUES, clr: CLR, clrStep: CLR_STEP,
  },
  sound: m => {
    // 1 · Τρία κομμάτια σκουραίνουν, ο μετρητής κατεβαίνει, η ερώτηση προσγειώνεται.
    m.whoosh(0, .5, .04, true);
    DROP.forEach((s, k) => {
      m.click(s, 1500 - k * 200, .07, (k - 1) * .3); m.boom(s + .1, .04);
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
    RC.forEach((_, k) => {
      const tc = SC[2] + .9 + k * .85 + .4;
      m.whoosh(tc - .4, .42, .045, true);
      m.click(tc, 520, .14, (k % 2 ? .25 : -.25)); m.boom(tc, .045); m.clap(tc, .035);
      m.click(tc + .5, 1100, .04, (k % 2 ? .25 : -.25));
    });
    m.pluck(SC[2] + HIT_ZERO + .05, 64, .05, 0, .4); m.bell(SC[2] + HIT_ZERO + .1, 76, .03);
    // 4 · Ο καταρράκτης: κάθε σκαλί μια νότα πιο κάτω, τα καθαρά μια καμπάνα.
    m.sweep(SC[3] + WF_T[0], .6, 500, 1100, .012);
    [79, 76, 72].forEach((n2, k) => { m.pluck(SC[3] + WF_T[k + 1] + .1, n2, .05, (k - 1) * .3, .45); m.click(SC[3] + WF_T[k + 1] + .45, 900, .05, (k - 1) * .3); });
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
    // 7 · Ο υπολογιστής: η κάρτα, ο σύνδεσμος, τα πεδία σβήνουν χαρακτήρα χαρακτήρα.
    m.whoosh(SC[6] + .45, .6, .04, true); m.pluck(SC[6] + 1.15, 81, .035, 0, .5);
    CALC_VALUES.forEach((s, k) => { for (let j = 0; j < s.length; j++) m.click(SC[6] + CLR + k * CLR_STEP + .4 * j / s.length, 2200, .03, .15); });
    m.sweep(SC[6] + CLR + 3 * CLR_STEP + .1, .5, 1400, 900, .01);
  },
  checkAt: [SC[1] - .3, SC[2] - .3, SC[3] - .3, SC[4] - .3, SC[5] - .9, SC[6] - .3, END - .3, DUR - .2],
  cover: SC[1] - .45,
  spots: [[515, 860], [330, 900], [515, 1000], [515, 900], [260, 960], [515, 1050], [515, 880]],
  hits: [HIT_Q, SC[2] + HIT_ZERO, SC[4] + HIT_NET],
  stills: [SC[1] - .35, SC[2] - .35, SC[3] - .35, SC[4] - .35, SC[5] - .9, SC[6] - .35, END - .35],
  caption: CAPTION,
  readme: README,
};

async function main() {
  const dir = join(ROOT, 'docs/marketing/reels', X.slug);
  if (!NO_SIGNUP) console.warn('! Η διαδρομή του υπολογιστή δεν είναι δημόσια· η φράση «χωρίς εγγραφή» φεύγει.');
  if (process.env.STORIES_ONLY) { await stories(join(dir, 'stories')); return; }
  if (!process.env.REEL_PREVIEW) await audit();
  if (process.env.AUDIT_ONLY) return;
  await make(X);
  if (process.env.REEL_PREVIEW) return;
  // Τα stories του κιτ είναι καρέ του βίντεο· εδώ τα αντικαθιστούν οι αφίσες.
  await stories(join(dir, 'stories'));
  igCopy(dir);
}

main().catch(e => { console.error(e); process.exit(1); });
