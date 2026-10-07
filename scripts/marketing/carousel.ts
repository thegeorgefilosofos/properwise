// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΠΡΩΤΟ CAROUSEL ΣΤΟ INSTAGRAM: «ΠΟΣΑ ΣΟΥ ΜΕΝΟΥΝ ΑΠΟ ΤΟ ΕΝΟΙΚΙΟ;»
// ─────────────────────────────────────────────────────────────────────────
// ΧΡΗΣΗ:  npx tsx scripts/marketing/carousel.ts
// Γράφει στο docs/marketing/instagram/carousel-1/ πέντε κάρτες 1080×1350, τη
// λεζάντα (caption.md) και το εναλλακτικό κείμενο.
//
// ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΘΕΜΑ ΓΙΑ ΠΡΩΤΗ ΑΝΑΡΤΗΣΗ. Ό,τι σπρώχνει η ροή είναι ό,τι
// ο κόσμος αποθηκεύει και στέλνει σε άλλον· αυτό κερδίζεται με κάτι που δεν
// ήξερε, όχι με «γνωρίστε μας». Το σημείο που ξαφνιάζει τους περισσότερους
// ιδιοκτήτες: στη μακροχρόνια μίσθωση ο φόρος υπολογίζεται στο ενοίκιο και τα
// έξοδα δεν τον μειώνουν. Η μάρκα μπαίνει στην τελευταία κάρτα, αφού έχει
// δείξει τι ξέρει.
//
// ΜΙΑ ΜΠΑΡΑ, ΣΤΗΝ ΙΔΙΑ ΘΕΣΗ ΣΕ ΚΑΘΕ ΚΑΡΤΑ. Είναι όλο το ενοίκιο της χρονιάς.
// Σε κάθε σύρσιμο φωτίζεται το κομμάτι που φεύγει: φόρος, ΕΝΦΙΑ και έξοδα,
// στο τέλος αυτό που μένει. Ο θεατής βλέπει το ενοίκιο να λιγοστεύει σαν
// κίνηση, χωρίς βίντεο. Γι' αυτό η κεφαλή κάθε κάρτας έχει σταθερό ύψος
// (HEAD) και η μπάρα πέφτει στο ίδιο ύψος στις κάρτες 1 ως 4· το ελέγχει το
// main() και σταματά αν ξεφύγει έστω ένα pixel.
//
// ΧΩΡΙΣ «ΝΗΜΑ». Η πρώτη έκδοση τραβούσε μια γραμμή από την άκρη της μπάρας ως
// την άκρη της εικόνας, για να δένουν οι κάρτες σε πανόραμα. Οι μπάρες όμως
// έπεφταν σε άλλο ύψος σε κάθε κάρτα, οπότε το νήμα έσπαγε στο σύρσιμο και
// στη μία κάρτα διαβαζόταν ως γραμμή που ξέφυγε. Τη δουλειά της συνέχειας την
// κάνει πια η ίδια η μπάρα, στην ίδια θέση.
//
// ΚΑΝΕΝΑ ΝΟΥΜΕΡΟ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ. Όλα από το ακίνητο επίδειξης, μέσα από την
// incomeStatement και την κλίμακα της χρονιάς του. Η τεκμαρτή έκπτωση από το
// PRESUMPTIVE_DEDUCTION_RATE, ο συντελεστής από το rentalBracketsForYear. Αν
// αλλάξει ο νόμος και ο κώδικας, αλλάζει και η ανάρτηση στο επόμενο τρέξιμο.
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { PLANS } from '../../lib/billing/plans';
import { ASSISTANT_ACC } from '../../lib/assistant/identity';
import { DEMO_PROPERTY } from '../../lib/demo/sample';
import { C, FACES, MONO_FACES, esc, ico, mark, GRAIN } from './igKit';
import {
  S, GROSS, PRESUMPTIVE, TAXABLE, TAX, ENFIA, OTHER, NET, RATE, PRES, TAXED_SHARE, PROP_SPOKEN, PROP_CAP, UP, LOST,
  eur, TOP, REST, REST_SUM, P_TAX, P_ENFIA, P_OTHER, P_NET, SEG, PARTS,
} from './rentFacts';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { chromePath } = require('../lib/chrome.mjs');

const OUT = join(process.cwd(), 'docs/marketing/instagram/carousel-1');
const W = 1080, H = 1350, N = 5;
// Το ύψος της κεφαλής (τίτλος ή μεγάλος αριθμός) πάνω από τη μπάρα.
const HEAD = 520;

// Ο αριθμός-τίτλος με το € μικρότερο, κολλητό. Στα 160px και πάνω το ολόσωμο
// € πατούσε το τελευταίο ψηφίο και το ποσό διαβαζόταν σαν λογότυπο.
const big = (v: string) => esc(v).replace(/€$/, '<span class="cur">€</span>');


// ── Η μπάρα του ενοικίου ──────────────────────────────────────────────────
// ΓΡΑΦΗΜΑ, ΟΧΙ ΣΧΗΜΑ. Κλίμακα 0-100% από κάτω και το ποσοστό μέσα σε κάθε
// κομμάτι που φωτίζεται: ο θεατής διαβάζει μέγεθος, όχι μόνο χρώμα.
type Lit = 'keep' | 'tax' | 'costs' | 'result';
const DIM = '#162033';
function chart(lit: Lit, capL: string, capR: string, capColor = C.muted): string {
  const on = (k: string) => lit === 'result' || (lit === 'keep' && k === 'net') || (lit === 'tax' && k === 'tax') || (lit === 'costs' && (k === 'enfia' || k === 'other'));
  const body = PARTS.map(x => `<i class="seg" style="flex:${x.v};background:${on(x.k) ? x.c : DIM}">${on(x.k) && x.p >= 6 ? `<em>${x.p}%</em>` : ''}</i>`).join('');
  return `<div class="chart">
    <div class="cap"><span>${esc(capL)}</span><b class="num" style="color:${capColor}">${esc(capR)}</b></div>
    <div class="track"><div class="bar">${body}</div></div>
    <div class="scale">${[0, 25, 50, 75, 100].map(t => `<span style="left:${t}%">${t}%</span>`).join('')}</div>
  </div>`;
}

function frame(n: number, label: string, stage: string, css: string, opts: { swipe?: boolean } = {}): string {
  const { swipe = true } = opts;
  return `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${FACES}${MONO_FACES}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  body{font-family:Inter,system-ui,sans-serif;color:${C.ink};background:${C.ground};position:relative;
    -webkit-font-smoothing:antialiased;font-feature-settings:"cv11","ss01"}
  .bg{position:absolute;inset:0;background:
    radial-gradient(760px 560px at ${n % 2 ? '92% 4%' : '8% 6%'}, ${C.accent}29, transparent 70%),
    radial-gradient(900px 700px at ${n % 2 ? '0% 100%' : '100% 100%'}, #3d5fa02a, transparent 72%),
    linear-gradient(180deg, #0a1120 0%, ${C.ground} 62%)}
  .grain{position:absolute;inset:0;background-image:${GRAIN};opacity:.05;mix-blend-mode:overlay}
  .wrap{position:absolute;inset:0;padding:88px 92px 0;display:flex;flex-direction:column}
  .top{display:flex;align-items:center;justify-content:space-between;font-family:'Roboto Mono',monospace;font-size:21px;letter-spacing:.12em}
  .eyebrow{display:flex;align-items:center;gap:18px;color:${C.muted};font-weight:500}
  .eyebrow i{display:block;width:44px;height:3px;border-radius:3px;background:${C.accent}}
  .count{color:${C.faint}}
  .head{height:${HEAD}px;flex:none;display:flex;flex-direction:column}
  h1{font-weight:800;letter-spacing:-.036em;line-height:1;text-wrap:balance;margin-top:76px}
  .cur{font-size:.72em;letter-spacing:0;margin-left:.04em}
  .acc{color:${C.accent}}
  .sub{color:${C.muted};font-size:32px;line-height:1.42;letter-spacing:-.008em;text-wrap:pretty;margin-top:30px;max-width:870px}
  .num{font-variant-numeric:tabular-nums;letter-spacing:-.02em}
  .mono{font-family:'Roboto Mono',monospace;letter-spacing:.1em}
  .chart{margin-top:0}
  .cap{display:flex;justify-content:space-between;align-items:baseline;height:40px;margin-bottom:14px;overflow:hidden}
  .cap > *{line-height:40px}
  .cap span{font-family:'Roboto Mono',monospace;font-size:20px;letter-spacing:.1em;color:${C.faint};text-transform:uppercase}
  .cap b{font-size:30px;font-weight:700}
  .track{position:relative}
  .bar{display:flex;gap:5px;height:92px;border-radius:20px;overflow:hidden;position:relative;z-index:1;
    box-shadow:0 30px 80px -40px #000}
  .seg{display:flex;align-items:center;justify-content:center;border-radius:7px;font-style:normal}
  .seg em{font-style:normal;font-family:'Roboto Mono',monospace;font-size:21px;font-weight:700;color:${C.onAccent};letter-spacing:.02em}
  .scale{position:relative;height:30px;margin-top:12px;font-family:'Roboto Mono',monospace;font-size:17px;color:${C.faint}}
  .scale span{position:absolute;top:0;transform:translateX(-50%)}
  .scale span:first-child{transform:none}
  .scale span:last-child{transform:translateX(-100%)}
  .rows{margin-top:30px;display:flex;flex-direction:column}
  .row{display:flex;justify-content:space-between;align-items:baseline;gap:24px;padding:14px 0;border-top:1.5px solid ${C.rule}90;font-size:28px;color:${C.faint}}
  .row b{font-weight:650;color:${C.muted}}
  .row.hi{color:${C.ink};font-weight:650}
  .row .dot{display:inline-block;width:14px;height:14px;border-radius:4px;margin-right:14px;vertical-align:middle}
  .foot{position:absolute;left:92px;right:92px;bottom:74px;display:flex;align-items:center;justify-content:space-between}
  .brand{display:flex;align-items:center;gap:14px;font-size:23px;font-weight:800;letter-spacing:.02em;color:${C.muted}}
  .swipe{display:flex;align-items:center;gap:12px;font-size:23px;font-weight:650;color:${C.accent};padding:13px 22px;border-radius:999px;
    background:${C.accent}14;border:1.5px solid ${C.accent}33}
  ${css}
  </style></head><body>
  <div class="bg"></div><div class="grain"></div>
  <div class="wrap">
    <div class="top"><div class="eyebrow"><i></i>${esc(label)}</div><div class="count">${String(n).padStart(2, '0')} / ${String(N).padStart(2, '0')}</div></div>
    ${stage}
  </div>
  <div class="foot">
    <div class="brand">${mark(32, C.muted)}PROPERWISE</div>
    ${swipe ? `<div class="swipe">Σύρε ${ico.arrow(C.accent, 24)}</div>` : ''}
  </div>
  </body></html>`;
}

// ═══ 1. ΤΟ ΑΓΚΙΣΤΡΙ ════════════════════════════════════════════════════
// Δήλωση, όχι ερώτηση: στο μισό δευτερόλεπτο της ροής διαβάζονται δύο αριθμοί
// και η απόσταση ανάμεσά τους. Η ερώτηση έρχεται στο τέλος, ως λόγος να σύρει.
function k1(): string {
  return frame(1, `ΠΑΡΑΔΕΙΓΜΑ · ${UP(PROP_SPOKEN)}`, `
    <div class="head"><div class="pair">
      <div><div class="mono pk">ΕΣΟΔΑ · ΕΝΟΙΚΙΑ ΤΗΣ ΧΡΟΝΙΑΣ</div><div class="pv num">${big(eur(GROSS))}</div></div>
      <div><div class="mono pk">ΚΑΘΑΡΑ · ΜΕΤΑ ΑΠΟ ΦΟΡΟΥΣ ΚΑΙ ΕΞΟΔΑ</div><div class="pv num acc">${big(eur(NET))}</div></div>
    </div></div>
    ${chart('keep', 'Το ενοίκιο της χρονιάς', `${P_NET}% ΚΑΘΑΡΑ`, C.accent)}
    <p class="sub bridge">Πού πήγαν τα <b class="num">${esc(eur(LOST))}</b>;</p>
    <div class="rows tease">
      ${PARTS.filter(x => x.k !== 'net').map(x => `<div class="row"><span><i class="dot" style="background:${x.c}"></i>${esc(x.label)}</span><em class="mono">ΚΑΡΤΑ ${x.k === 'tax' ? '02' : '03'}</em></div>`).join('')}
    </div>`, `
    .pair{display:flex;flex-direction:column;gap:34px;margin-top:70px}
    .pk{font-size:21px;color:${C.faint}}
    .pv{font-size:150px;font-weight:850;letter-spacing:-.03em;line-height:.94;margin-top:14px}
    .pv.acc{text-shadow:0 30px 140px ${C.accent}59}
    .cap b{font-family:'Roboto Mono',monospace;font-size:20px;letter-spacing:.1em;font-weight:500}
    .bridge{margin-top:18px;font-size:40px;font-weight:650;letter-spacing:-.015em;color:${C.ink}}
    .bridge b{color:${SEG.tax};font-weight:750}
    .tease{margin-top:22px}
    .tease .row em{font-style:normal;font-size:20px;color:${C.faint}}`);
}

// ═══ 2. Ο ΦΟΡΟΣ ═════════════════════════════════════════════════════════
function k2(): string {
  return frame(2, 'Ο ΦΟΡΟΣ', `
    <div class="head"><h1 style="font-size:96px">Φόρος στα έσοδα,<br><span class="acc">όχι στα καθαρά.</span></h1>
    <p class="sub">Για έξοδα η εφορία αφαιρεί ένα σταθερό ${esc(PRES)} του ενοικίου, όσα κι αν ξόδεψες. Στο υπόλοιπο ${esc(TAXED_SHARE)} πληρώνεις φόρο ${esc(RATE)}.</p></div>
    ${chart('tax', 'Φόρος εισοδήματος', `−${eur(TAX)}`, SEG.tax)}
    <div class="rows">
      <div class="row"><span>Έσοδα από ενοίκια</span><b class="num">${esc(eur(GROSS))}</b></div>
      <div class="row"><span>Σταθερή έκπτωση ${esc(PRES)} για επισκευές</span><b class="num">−${esc(eur(PRESUMPTIVE))}</b></div>
      <div class="row"><span>Φορολογητέο εισόδημα</span><b class="num">${esc(eur(TAXABLE))}</b></div>
      <div class="row hi"><span><i class="dot" style="background:${SEG.tax}"></i>Φόρος εισοδήματος ${esc(RATE)}</span><b class="num" style="color:${SEG.tax}">−${esc(eur(TAX))}</b></div>
    </div>
    <div class="mono note">ΜΑΚΡΟΧΡΟΝΙΑ ΜΙΣΘΩΣΗ · ΦΥΣΙΚΟ ΠΡΟΣΩΠΟ</div>`, `
    .rows .row{padding:15px 0}
    .note{margin-top:30px;font-size:18px;color:${C.faint}}`);
}

// ═══ 3. ΤΑ ΕΞΟΔΑ ════════════════════════════════════════════════════════
function k3(): string {
  const row = (label: string, v: number, color: string) =>
    `<div class="row"><span><i class="dot" style="background:${color}"></i>${esc(label)}</span><b class="num">−${esc(eur(v))}</b></div>`;
  return frame(3, 'ΤΑ ΕΞΟΔΑ', `
    <div class="head"><h1 style="font-size:90px">Τα έξοδα δεν<br><span class="acc">μειώνουν τον φόρο.</span></h1>
    <p class="sub">Επισκευές, ασφάλιση, ΕΝΦΙΑ: όσα κι αν πληρώσεις στην πράξη, ο φόρος μένει ίδιος.</p></div>
    ${chart('costs', 'ΕΝΦΙΑ και έξοδα', `−${eur(ENFIA + OTHER)}`, SEG.other)}
    <div class="rows">
      ${row('ΕΝΦΙΑ', ENFIA, SEG.enfia)}
      ${TOP.map(r => row(r.label, r.amount, SEG.other)).join('')}
      ${REST.length ? row(`Άλλες ${REST.length} δαπάνες`, REST_SUM, SEG.other) : ''}
    </div>
    <div class="mono note">ΚΑΝΕΝΑ ΔΕΝ ΜΕΙΩΝΕΙ ΤΟ ΦΟΡΟΛΟΓΗΤΕΟ ΕΙΣΟΔΗΜΑ</div>`, `
    .rows .row{padding:15px 0}
    .note{margin-top:30px;font-size:18px;color:${C.faint}}`);
}

// ═══ 4. ΤΟ ΑΠΟΤΕΛΕΣΜΑ ═══════════════════════════════════════════════════
function k4(): string {
  return frame(4, 'ΤΟ ΑΠΟΤΕΛΕΣΜΑ', `
    <div class="head"><div class="mono res-k">ΑΠΟ ΚΑΘΕ 100€ ΕΝΟΙΚΙΟΥ</div>
    <div class="res-line"><span class="res num">${big(`${P_NET}€`)}</span><span class="res-t">μένουν<br>στην τσέπη.</span></div>
    <p class="sub">Τα άλλα ${100 - P_NET}€ πάνε σε φόρο, ΕΝΦΙΑ και έξοδα.</p></div>
    ${chart('result', 'Όλο το ενοίκιο', eur(GROSS))}
    <div class="rows ledger">
      ${PARTS.map(x => `<div class="row${x.k === 'net' ? ' hi' : ''}"><span><i class="dot" style="background:${x.c}"></i>${esc(x.label)}</span><em class="mono">${x.p}%</em><b class="num"${x.k === 'net' ? ` style="color:${C.accent}"` : ''}>${x.k === 'net' ? '' : '−'}${esc(eur(x.v))}</b></div>`).join('')}
    </div>
    <div class="mono note">ΠΑΡΑΔΕΙΓΜΑ · ΦΥΣΙΚΟ ΠΡΟΣΩΠΟ · ΧΡΟΝΙΑ ${S.year}</div>`, `
    .res-k{margin-top:76px;font-size:22px;color:${C.muted}}
    .res-line{display:flex;align-items:flex-end;gap:34px;margin-top:14px}
    .res{font-size:250px;font-weight:850;letter-spacing:-.035em;line-height:.9;color:${C.accent};text-shadow:0 30px 140px ${C.accent}59}
    .res .cur{margin-left:.07em}
    .res-t{font-size:46px;font-weight:700;letter-spacing:-.02em;line-height:1.1;padding-bottom:26px}
    .ledger{margin-top:30px}
    .ledger .row{display:grid;grid-template-columns:1fr 110px 250px;padding:15px 0}
    .ledger .row em{font-style:normal;font-size:21px;color:${C.faint};text-align:right}
    .ledger .row b{text-align:right}
    .note{margin-top:32px;font-size:18px;color:${C.faint}}`);
}

// ═══ 5. Η ΕΦΑΡΜΟΓΗ ═══════════════════════════════════════════════════════
// Κλείνει ο κύκλος: η ίδια χρονιά, τα ίδια νούμερα, όπως τα δείχνει η εφαρμογή.
const FREE = PLANS.free;
if (FREE.priceMonthly !== 0) throw new Error('Η κάρτα λέει «δωρεάν»· το PLANS.free έχει τιμή.');
const FREE_WORDS = FREE.maxProperties === 1 ? 'για ένα ακίνητο' : `έως ${FREE.maxProperties} ακίνητα`;
function k5(): string {
  const tile = (k: string, v: string, color: string, big = false) =>
    `<div class="tile${big ? ' big' : ''}"><span class="mono">${esc(k)}</span><b class="num" style="color:${color}">${esc(v)}</b></div>`;
  const feats = ['Σάρωση λογαριασμών', 'Φόρος και ΕΝΦΙΑ', 'Φάκελος για τον λογιστή', `Ρώτα ${ASSISTANT_ACC}`];
  return frame(5, 'Η ΕΦΑΡΜΟΓΗ', `
    <h1 style="font-size:112px">Όλο αυτό,<br><span class="acc">αυτόματα.</span></h1>
    <p class="sub">Το PROPERWISE κάνει αυτόν τον λογαριασμό για το δικό σου ακίνητο, κάθε μήνα.</p>
    <div class="app">
      <div class="app-head"><span class="app-mark">${mark(26, C.ink)}</span><b>${esc(DEMO_PROPERTY.name)}</b><span class="mono app-y">${S.year}</span></div>
      <div class="tiles">
        ${tile('ΕΝΟΙΚΙΑ', eur(GROSS), C.ink)}
        ${tile('ΦΟΡΟΣ ΚΑΙ ΕΝΦΙΑ', `−${eur(TAX + ENFIA)}`, C.muted)}
        ${tile('ΣΟΥ ΜΕΝΟΥΝ', eur(NET), C.accent, true)}
      </div>
      <div class="app-bar">${PARTS.map(x => `<i style="flex:${x.v};background:${x.c}"></i>`).join('')}</div>
      <div class="feats">${feats.map(f => `<span>${ico.check(C.accent, 20)}${esc(f)}</span>`).join('')}</div>
    </div>
    <div class="cta">
      <div class="pill">Δωρεάν ${esc(FREE_WORDS)}</div>
      <div class="cta-r"><b>properwise.gr</b><span class="mono">ΣΥΝΔΕΣΜΟΣ ΣΤΟ BIO</span></div>
    </div>`, `
    .app{margin-top:48px;border-radius:36px;padding:30px 32px 28px;background:linear-gradient(180deg, ${C.lift}f5, ${C.panel}f5);
      border:1.5px solid ${C.rule};box-shadow:0 1px 0 #ffffff0d inset, 0 60px 140px -50px #000}
    .app-head{display:flex;align-items:center;gap:14px;font-size:26px}
    .app-mark{width:48px;height:48px;border-radius:14px;background:${C.ground};border:1.5px solid ${C.rule};display:flex;align-items:center;justify-content:center}
    .app-head b{font-weight:700}
    .app-y{margin-left:auto;font-size:20px;color:${C.faint}}
    .tiles{display:grid;grid-template-columns:1fr 1fr 1.15fr;gap:12px;margin-top:24px}
    .tile{display:flex;flex-direction:column;gap:10px;padding:20px 20px;border-radius:20px;background:${C.ground}99;border:1.5px solid ${C.rule}}
    .tile span{font-size:15px;color:${C.faint};letter-spacing:.08em}
    .tile b{font-size:31px;font-weight:750}
    .tile.big{border-color:${C.accent}55;background:${C.accent}12}
    .app-bar{display:flex;gap:4px;height:18px;border-radius:9px;overflow:hidden;margin-top:22px}
    .app-bar i{display:block;border-radius:4px}
    .feats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px}
    .feats span{display:flex;align-items:center;gap:10px;font-size:21px;color:${C.muted};padding:11px 16px;border-radius:14px;border:1.5px solid ${C.rule}}
    .cta{margin-top:40px;display:flex;align-items:center;gap:26px}
    .pill{padding:22px 34px;border-radius:999px;background:${C.accent};color:${C.onAccent};font-size:30px;font-weight:800;letter-spacing:-.01em;
      box-shadow:0 30px 80px -26px ${C.accent}}
    .cta-r{display:flex;flex-direction:column;gap:6px}
    .cta-r b{font-size:26px;font-weight:700;color:${C.ink};letter-spacing:-.01em}
    .cta-r span{font-size:17px;color:${C.faint}}`, { swipe: false });
}

const CARDS = [
  { build: k1, alt: `Κάρτα 1 από ${N}: ${PROP_CAP}. Έσοδα από ενοίκια ${eur(GROSS)}, καθαρά μετά από φόρους και έξοδα ${eur(NET)}, δηλαδή ${P_NET}%. Πού πήγαν τα ${eur(LOST)};` },
  { build: k2, alt: `Κάρτα 2 από ${N}: φόρος στα έσοδα, όχι στα καθαρά. Έσοδα από ενοίκια ${eur(GROSS)}, σταθερή έκπτωση ${PRES} για επισκευές, φορολογητέο εισόδημα ${eur(TAXABLE)}, φόρος ${RATE}: ${eur(TAX)}.` },
  { build: k3, alt: `Κάρτα 3 από ${N}: τα έξοδα δεν μειώνουν τον φόρο. ΕΝΦΙΑ ${eur(ENFIA)}, επισκευές και άλλα έξοδα ${eur(OTHER)}· κανένα δεν μειώνει το φορολογητέο εισόδημα.` },
  { build: k4, alt: `Κάρτα 4 από ${N}: από κάθε 100€ ενοικίου μένουν ${P_NET}€ στην τσέπη. Αναλυτικά: φόρος εισοδήματος ${P_TAX}%, ΕΝΦΙΑ ${P_ENFIA}%, επισκευές και άλλα έξοδα ${P_OTHER}%, καθαρά ${P_NET}%.` },
  { build: k5, alt: `Κάρτα 5 από ${N}: «Όλο αυτό, αυτόματα.» Το PROPERWISE κάνει αυτόν τον λογαριασμό για το δικό σου ακίνητο. Δωρεάν ${FREE_WORDS}, properwise.gr.` },
];

// ── Η λεζάντα ────────────────────────────────────────────────────────────
// Η πρώτη γραμμή είναι ό,τι φαίνεται πριν από το «περισσότερα»: το εύρημα,
// όχι χαιρετισμός. Μετά η αξία, μετά η μάρκα, μετά δύο προτροπές που ο
// αλγόριθμος μετράει (αποθήκευση, αποστολή) και μία ερώτηση που αξίζει
// απάντηση. Λίγα, σχετικά hashtags, όχι τοίχος.
const CAPTION = [
  `Ένα ${PROP_SPOKEN} φέρνει ${eur(GROSS)} ενοίκια τον χρόνο. Καθαρά μένουν ${eur(NET)}.`,
  '',
  `Πού πήγαν τα ${eur(LOST)}; Σύρε και δες τον λογαριασμό γραμμή γραμμή: τι παίρνει ο φόρος, τι ο ΕΝΦΙΑ, τι τα έξοδα.`,
  '',
  `Αυτό που ξαφνιάζει τους περισσότερους ιδιοκτήτες: στη μακροχρόνια μίσθωση ο φόρος υπολογίζεται στα έσοδα από το ενοίκιο, όχι σε ό,τι σου μένει μετά τα έξοδα. Για έξοδα η εφορία αφαιρεί ένα σταθερό ${PRES} του ενοικίου, όσα κι αν ξόδεψες στην πράξη. Στο υπόλοιπο ${TAXED_SHARE} πληρώνεις φόρο. Επισκευές, ασφάλιση και ΕΝΦΙΑ τα πληρώνεις κανονικά, αλλά δεν μειώνουν τον φόρο.`,
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
  '#ακίνητα #ενοίκια #ΕΝΦΙΑ #φορολογία #ιδιοκτήτες',
].join('\n');

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] });
  try {
    const barTops = new Set<number>();
    for (const [i, c] of CARDS.entries()) {
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      await page.setContent(c.build(), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      // Η ΜΠΑΡΑ ΣΤΟ ΙΔΙΟ ΥΨΟΣ. Μετριέται μετά τις γραμματοσειρές· η κεφαλή
      // δεν επιτρέπεται να κρύβει κείμενο πίσω από το σταθερό της ύψος.
      const geo = await page.evaluate(() => {
        const head = document.querySelector('.head') as HTMLElement | null;
        const track = document.querySelector('.track');
        return {
          headOver: head ? head.scrollHeight - head.clientHeight : 0,
          barTop: track ? Math.round(track.getBoundingClientRect().top) : null,
        };
      });
      if (geo.headOver > 0) throw new Error(`κάρτα ${i + 1}: η κεφαλή ξεπερνά τα ${HEAD}px κατά ${geo.headOver}px`);
      if (geo.barTop != null) {
        barTops.add(geo.barTop);
        if (barTops.size > 1) throw new Error(`κάρτα ${i + 1}: η μπάρα πέφτει σε άλλο ύψος (${[...barTops].join(', ')})`);
      }
      // Το πλέγμα του προφίλ κόβει τα πλάγια (3:4). Τίποτα κοντά στις άκρες,
      // τίποτα έξω από το κάδρο, καμία επικάλυψη κειμένου με τη μπάρα.
      const bad = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of Array.from(document.querySelectorAll('.wrap *, .foot *'))) {
          const r = (el as HTMLElement).getBoundingClientRect();
          if (!r.width || !r.height) continue;
          if (r.left < 60 || r.right > innerWidth - 60 || r.top < 60 || r.bottom > innerHeight - 50) out.push(`${(el.textContent || el.tagName).trim().slice(0, 30)} [${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)}]`);
        }
        const foot = document.querySelector('.foot')!.getBoundingClientRect();
        for (const el of Array.from(document.querySelectorAll('.wrap > *'))) {
          const r = (el as HTMLElement).getBoundingClientRect();
          if (r.bottom > foot.top - 40) out.push(`${(el.textContent || el.className).trim().slice(0, 30)} ακουμπά το υποσέλιδο`);
        }
        const bar = document.querySelector('.chart')?.getBoundingClientRect();
        if (bar) for (const el of Array.from(document.querySelectorAll('h1, .sub'))) {
          const r = (el as HTMLElement).getBoundingClientRect();
          if (r.top < bar.bottom && r.bottom > bar.top - 16) out.push(`${(el.textContent || '').trim().slice(0, 30)} πέφτει στη μπάρα`);
        }
        return out;
      });
      if (bad.length) throw new Error(`κάρτα ${i + 1}: ${bad.slice(0, 4).join(' | ')}`);
      await page.screenshot({ path: join(OUT, `${i + 1}.png`) });
      await page.close();
      console.log(`  ✓ ${i + 1}.png`);
    }
  } finally {
    await browser.close();
  }
  writeFileSync(join(OUT, 'caption.md'), CAPTION + '\n');
  writeFileSync(join(OUT, 'README.md'), [
    '# Instagram: το πρώτο carousel',
    '',
    'Παράγεται από το `npx tsx scripts/marketing/carousel.ts`. Όλα τα ποσά από το ακίνητο',
    'επίδειξης (`lib/demo/sample.ts`) μέσα από την `incomeStatement`· η λεζάντα στο `caption.md`,',
    'από τα ίδια ποσά.',
    '',
    '## Δημοσίευση',
    '',
    `Οι ${N} κάρτες με τη σειρά, ως ένα carousel (4:5). Ώρα: μεσημέρι (13:00-14:00) ή`,
    'βράδυ (20:00-21:00). Στις «Ρυθμίσεις για προχωρημένους» κάθε κάρτα παίρνει το',
    'εναλλακτικό της κείμενο από κάτω.',
    '',
    '## Εναλλακτικό κείμενο',
    '',
    ...CARDS.map((c, i) => `- \`${i + 1}.png\`: ${c.alt}`),
    '',
  ].join('\n'));
  console.log('✓ docs/marketing/instagram/carousel-1/');
}

main().catch(e => { console.error(e); process.exit(1); });
