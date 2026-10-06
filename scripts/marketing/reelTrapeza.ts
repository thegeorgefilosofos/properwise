// ═══════════════════════════════════════════════════════════════════════════
// REEL-ΟΔΗΓΟΣ · «ΕΝΟΙΚΙΟ ΣΕ ΜΕΤΡΗΤΑ: ΤΙ ΑΛΛΑΖΕΙ ΑΠΟ 1.7.2027»
// ─────────────────────────────────────────────────────────────────────────
// ΧΡΗΣΗ:  npx tsx scripts/marketing/reelTrapeza.ts   (FFMPEG με libx264)
//         REEL_PREVIEW=1,5,9 → μόνο στιγμιότυπα.
//
// Ο οδηγός app/odigos/enoikio-meso-trapezas σε λιγότερο από ένα λεπτό: η
// ερώτηση, ο κανόνας (95% ή 100%), από πότε, πόσο κοστίζει, τι μετρά ως
// τράπεζα, πώς το δείχνει η εφαρμογή, τι κάνεις από τώρα.
//
// ΚΑΝΕΝΑ ΦΟΡΟΛΟΓΙΚΟ ΝΟΥΜΕΡΟ ΜΕ ΤΟ ΧΕΡΙ. Η έκπτωση από το lib/billing/presumptive,
// η κλίμακα και η έναρξη από το lib/billing/greekTax, ο φόρος από την ίδια
// `rentalIncomeTax` που τρέχει ο υπολογιστής, η πηγή από το
// data/accounting-sources.json, οι τρόποι είσπραξης από την ίδια λίστα με την
// οθόνη των ενοικίων. Τα ενοίκια του γραφήματος είναι παραδείγματα εισόδου· το
// 700€ είναι το παράδειγμα του οδηγού.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rentalIncomeTax, rentalBracketsForYear, bracketsLabelForYear, FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT, bankReceiptPenaltyShare } from '../../lib/billing/greekTax';
import { presumptiveDeductionRateForYear } from '../../lib/billing/presumptive';
import { PAY_METHODS } from '../../app/dashboard/components/TabTenantTypes';
import { feWhole, fpRate } from '../../lib/core/format';
import { C, esc, mark } from './igKit';
import { BEAT, TONE, A, head, icon, ICON, tile, calendar, calPages, make, type Explainer } from './explainerKit';

// ── Τα γεγονότα ──────────────────────────────────────────────────────────
// Η πρώτη ΟΛΟΚΛΗΡΗ χρήση της κύρωσης: εκεί το «με μετρητά» κοστίζει όλο τον χρόνο.
const FULL = FIRST_YEAR_BANK_RECEIPT + 1;
if (bankReceiptPenaltyShare(FULL) !== 1) throw new Error(`Η κύρωση δεν πιάνει ολόκληρη τη χρήση ${FULL}.`);
const B = rentalBracketsForYear(FULL);
const RATE = presumptiveDeductionRateForYear(FULL, true);
if (presumptiveDeductionRateForYear(FULL, false) !== 0) throw new Error('Με μετρητά η έκπτωση δεν μηδενίζεται.');
const PCT = fpRate(RATE * 100), KEEP = fpRate((1 - RATE) * 100), ALL = fpRate(100);
const year = (monthly: number) => {
  const gross = monthly * 12;
  const bank = rentalIncomeTax(gross * (1 - RATE), B), cash = rentalIncomeTax(gross, B);
  return { gross, bank, cash, diff: cash - bank, lost: gross * RATE };
};
const marginal = (taxable: number) => (B.find(b => taxable > b.from && (b.to == null || taxable <= b.to)) ?? B[0]).rate;
const EX = 700, E = year(EX);
const RENTS = [400, 700, 1000, 1400, 1800, 2500];
const BARS = RENTS.map(r => ({ r, d: year(r).diff }));
const BIG = 1800, EB = year(BIG), EB_RATE = marginal(EB.gross);
if (EB_RATE <= marginal(E.gross)) throw new Error('Το δεύτερο παράδειγμα δεν περνά σε ψηλότερο κλιμάκιο.');
const MONTHS_GEN = ['Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'];
const START_DAY = `1.${FIRST_MONTH_BANK_RECEIPT}.${FIRST_YEAR_BANK_RECEIPT}`;
const START_TEXT = `1η ${MONTHS_GEN[FIRST_MONTH_BANK_RECEIPT - 1]} ${FIRST_YEAR_BANK_RECEIPT}`;
const SAFE_YEARS = [FIRST_YEAR_BANK_RECEIPT - 2, FIRST_YEAR_BANK_RECEIPT - 1];
if (SAFE_YEARS.some(y => bankReceiptPenaltyShare(y) !== 0)) throw new Error('Τα δύο προηγούμενα έτη δεν είναι πια χωρίς κύρωση.');
const SRC = JSON.parse(readFileSync(join(process.cwd(), 'data/accounting-sources.json'), 'utf8')).rent_bank_receipt?.pinned as string | undefined;
if (!SRC) throw new Error('Λείπει η πηγή rent_bank_receipt στο data/accounting-sources.json.');
const CASH = PAY_METHODS[0];
if (CASH !== 'Μετρητά') throw new Error('Η πρώτη επιλογή της οθόνης ενοικίων δεν είναι πια τα μετρητά.');
// Η ίδια προειδοποίηση με την οθόνη «Είσπραξη ενοικίου» (RentReceived.tsx).
const APP_WARN = readFileSync(join(process.cwd(), 'app/dashboard/components/RentReceived.tsx'), 'utf8')
  .match(/Από 1\.7\.2027 \(ν\.5222\/2025\)[^<]*?θα χάνεται\./)?.[0].replace(/\s+/g, ' ');
if (!APP_WARN) throw new Error('Η προειδοποίηση της οθόνης ενοικίων άλλαξε· το κινητό του reel θέλει την καινούργια.');

// ── Ο χρόνος ─────────────────────────────────────────────────────────────
const SC = [0, 6, 16, 24, 34, 42, 50].map(b => b * BEAT);
const END = 58 * BEAT, DUR = 63 * BEAT;

// ── 1 · Τα χαρτονομίσματα ────────────────────────────────────────────────
// ΣΧΕΔΙΑΣΜΕΝΑ ΝΑ ΑΝΑΓΝΩΡΙΖΟΝΤΑΙ, ΟΧΙ ΑΝΤΙΓΡΑΦΟ. Τα χρώματα και οι αναλογίες
// των 10, 20 και 50 ευρώ, ο κύκλος με τα δώδεκα αστέρια, «EURO · ΕΥΡΩ»,
// αψίδα, ολογραφική λωρίδα, υδατογράφημα και λεπτό μοτίβο ασφαλείας. Κανένα
// πραγματικό σχέδιο, υπογραφή ή αριθμός σειράς.
const STARS = Array.from({ length: 12 }, (_, k) => {
  const a = (k / 12) * Math.PI * 2 - Math.PI / 2, cx = 50 + 36 * Math.cos(a), cy = 50 + 36 * Math.sin(a);
  const pts = Array.from({ length: 10 }, (_, j) => { const r = j % 2 ? 2.6 : 6.4, b = (j / 10) * Math.PI * 2 - Math.PI / 2; return `${(cx + r * Math.cos(b)).toFixed(2)},${(cy + r * Math.sin(b)).toFixed(2)}`; });
  return `<polygon points="${pts.join(' ')}"/>`;
}).join('');
const eur = (den: number, rot: number, id: string) => `
  <div class="eur e${den}" id="${id}" data-r="${rot}">
    <div class="gl"></div><div class="ros"></div>
    <svg class="arch" viewBox="0 0 220 180"><g fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3">
      <path d="M30 172V78a80 80 0 0 1 160 0v94"/><path d="M58 172V86a52 52 0 0 1 104 0v86"/><path d="M14 172h192M20 160h180"/>
      <path d="M110 6v22M78 14l8 20M142 14l-8 20"/></g></svg>
    <svg class="stars" viewBox="0 0 100 100"><g fill="#f7e27a">${STARS}</g></svg>
    <div class="holo" id="${id}h"></div><div class="wm"></div>
    <span class="dn tl">${den}</span><span class="dn br">${den}</span>
    <span class="cur">EURO · ΕΥΡΩ</span>
  </div>`;

// ── 2 · Τα δύο πλέγματα των εκατό ────────────────────────────────────────
const TILES = 100, OUT_N = Math.round(RATE * TILES);
if (Math.abs(OUT_N - RATE * TILES) > 1e-9) throw new Error('Η έκπτωση δεν είναι ακέραιο πλήθος πλακιδίων.');
const PCTS = Array.from({ length: TILES + 1 }, (_, n) => fpRate(n));
const grid = (k: 'b' | 'c') => `<div class="grid">${Array.from({ length: TILES }, (_, i) => `<i id="g${k}${i}"></i>`).join('')}</div>`;

// ── 3 · Το ημερολόγιο: από τη μέρα δημοσίευσης ως την έναρξη ─────────────
const PUBLISH = '2026-10-10';
const DAYS = [PUBLISH];
for (let y = Number(PUBLISH.slice(0, 4)), mo = Number(PUBLISH.slice(5, 7)) + 1; ; mo++) {
  if (mo > 12) { mo = 1; y++; }
  DAYS.push(`${y}-${String(mo).padStart(2, '0')}-01`);
  if (y === FIRST_YEAR_BANK_RECEIPT && mo === FIRST_MONTH_BANK_RECEIPT) break;
  if (y > FIRST_YEAR_BANK_RECEIPT) throw new Error('Το ημερολόγιο δεν φτάνει ποτέ την έναρξη.');
}

// ── 4 · Το γράφημα: κάθε μπάρα στο χρώμα του κλιμακίου όπου πέφτει η έκπτωση ──
const RATE_TONE: Record<string, string> = { '0.15': '#5f9bff', '0.25': TONE.wa, '0.35': TONE.rd, '0.45': '#c39bff' };
const BR = BARS.map(b => ({ ...b, m: marginal(year(b.r).gross) }));
const STEPS = 24;
const CV = BR.map(b => Array.from({ length: STEPS + 1 }, (_, s) => `+${feWhole(Math.round(b.d * s / STEPS))}`));
const LEGEND = [...new Set(BR.map(b => b.m))].sort();

const HTML = `
  <!-- 1 · Η ερώτηση -->
  <section id="s0">
    <div class="L eb mono" id="e0" style="top:320px"><i></i>ΕΝΟΙΚΙΟ ΜΕΣΩ ΤΡΑΠΕΖΑΣ</div>
    <div class="L hd" style="top:370px;font-size:112px">${['Σου δίνει', 'το ενοίκιο', A('σε μετρητά;')].map((l, k) => `<div class="mk"><div class="mi" id="q${k}">${l}</div></div>`).join('')}</div>
    <div class="L sub" id="c0" style="top:730px">Από ${esc(START_DAY)} σου κοστίζει.</div>
    <div id="env" class="deco">
      <div class="shadow"></div>
      <div class="flap"></div>
      <div class="back"></div>
      ${eur(50, -10, 'n0')}${eur(20, 3, 'n1')}${eur(10, -3, 'n2')}
      <div class="front"><svg viewBox="0 0 600 310" preserveAspectRatio="none"><path d="M0 310L300 150L600 310" fill="none" stroke="rgba(90,62,24,.28)" stroke-width="3"/><path d="M0 0L300 142L600 0" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2"/></svg></div>
    </div>
  </section>

  <!-- 2 · Ο κανόνας: εκατό πλακίδια, ένα για κάθε 1% του ενοικίου -->
  <section id="s1">
    ${head(1, 'Ο ΚΑΝΟΝΑΣ', [`Το ${PCT} που χάνεις`, A('με τα μετρητά.')], 92)}
    <div class="L lbl" style="top:600px">ΚΑΘΕ ΠΛΑΚΙΔΙΟ: ΤΟ 1% ΤΟΥ ΕΝΟΙΚΙΟΥ ΤΟΥ ΧΡΟΝΟΥ</div>
    ${(['b', 'c'] as const).map((k, i) => `
    <div class="card gp ${k}" id="gp${k}" style="left:${90 + i * 440}px">
      <div class="gh"><span>${k === 'b' ? 'Με τράπεζα' : 'Με μετρητά'}</span><b id="gv${k}" style="color:${k === 'b' ? TONE.ok : TONE.rd}">${PCTS[0]}</b></div>
      <div class="lbl" style="font-size:14px;margin-top:4px">ΦΟΡΟΛΟΓΕΙΤΑΙ</div>
      ${grid(k)}
      <div class="gt" id="gt${k}">${k === 'b' ? `✓ ${PCT} έκπτωση` : `× καμία έκπτωση`}</div>
    </div>`).join('')}
    <div class="L src" id="src1" style="top:1300px">Πηγή: ${esc(SRC)} · τεκμαρτή έκπτωση: άρθρο 39 παρ. 3 ΚΦΕ</div>
  </section>

  <!-- 3 · Από πότε -->
  <section id="s2">
    ${head(2, 'ΑΠΟ ΠΟΤΕ', [`Από ${esc(START_TEXT.replace(` ${FIRST_YEAR_BANK_RECEIPT}`, ''))}`, A(`${FIRST_YEAR_BANK_RECEIPT}.`)], 100)}
    ${calendar('cl', 290, 630)}
    <div class="card" id="safe" style="left:90px;top:1120px;width:850px;padding:10px 34px">
      ${SAFE_YEARS.map((y, k) => `<div class="ck" id="sy${k}"><div class="dt" style="background:rgba(82,199,158,.16)"><i style="display:block;width:12px;height:22px;margin-bottom:6px;border:solid ${TONE.ok};border-width:0 4px 4px 0;transform:rotate(45deg)"></i></div>
        <div class="tx">Εισοδήματα ${y}: η έκπτωση δίνεται<small>Δήλωση ${y + 1}, όπως κι αν εισπράττεις</small></div></div>`).join('')}
    </div>
  </section>

  <!-- 4 · Πόσο κοστίζει -->
  <section id="s3">
    ${head(3, 'ΠΟΣΟ ΚΟΣΤΙΖΕΙ', [`${feWhole(EX)} τον μήνα:`, A(`+${feWhole(E.diff)} φόρος`), 'κάθε χρόνο.'], 96)}
    <div class="card" id="ch" style="left:90px;top:710px;width:850px;padding:26px 30px 20px">
      <div class="row"><div class="lbl">ΕΠΙΠΛΕΟΝ ΦΟΡΟΣ ΤΟΝ ΧΡΟΝΟ ΜΕ ΜΕΤΡΗΤΑ</div><span class="pill p-bl">${esc(bracketsLabelForYear(FULL).replace(/ \(.*$/, ''))}</span></div>
      <div class="plot"><div class="gridl"><i></i><i></i><i></i><i></i></div>
        ${BR.map((b, k) => `<div class="cb${b.r === EX ? ' hi' : ''}${b.r === BIG ? ' hi2' : ''}">
          <span class="cv" id="cv${k}">${CV[k][0]}</span>
          <div class="cc"><i id="cf${k}" style="height:${Math.round(14 + 86 * b.d / BR[BR.length - 1].d)}%;--c:${RATE_TONE[String(b.m)]}"></i></div>
          <span class="cx">${feWhole(b.r)}</span></div>`).join('')}</div>
      <div class="leg">${LEGEND.map(m => `<span><i style="background:${RATE_TONE[String(m)]}"></i>κλιμάκιο ${fpRate(m * 100)}</span>`).join('')}<em>ΕΝΟΙΚΙΟ ΤΟΝ ΜΗΝΑ</em></div>
    </div>
    <div class="L sub2" id="c3" style="top:1250px;width:820px">Με ${feWhole(BIG)} τον μήνα: <b>+${feWhole(EB.diff)}</b>, γιατί τα ${feWhole(EB.lost)} της έκπτωσης φορολογούνται με ${fpRate(EB_RATE * 100)}.</div>
  </section>

  <!-- 5 · Τι μετρά ως τράπεζα -->
  <section id="s4">
    ${head(4, 'ΤΙ ΜΕΤΡΑ ΩΣ ΤΡΑΠΕΖΑ', ['Μετράει ό,τι', A('φτάνει σε'), A('λογαριασμό σου.')], 88)}
    <div class="ftg" style="top:680px">
      ${tile('w0', true, ICON.bank, 'Κατάθεση', 'στον λογαριασμό σου')}
      ${tile('w1', true, ICON.transfer, 'Έμβασμα', 'από τον λογαριασμό του ενοικιαστή')}
      ${tile('w2', true, ICON.bolt, 'IRIS', 'άμεση πληρωμή')}
      ${tile('w3', false, ICON.cash, 'Μετρητά', 'στο χέρι, δεν μετράνε')}
    </div>
    <div class="L sub2" id="c4" style="top:1240px;width:820px">Ο λογαριασμός πρέπει να είναι <b>γνωστοποιημένος στην ΑΑΔΕ</b>.</div>
  </section>

  <!-- 6 · Στο PROPERWISE -->
  <section id="s5">
    ${head(5, 'ΣΤΟ PROPERWISE', ['Κάθε ενοίκιο', A('με τον τρόπο'), A('που εισπράχθηκε.')], 80)}
    <div id="spot" class="deco"></div>
    <div id="stage3d" class="deco"><div id="phone"><div class="scr">
      <div class="isl"></div>
      <div class="ap">
        <div class="ah"><span class="m">${mark(22, C.ink)}</span><span>Ενοίκια</span><span class="y mono">ΠΑΡΑΔΕΙΓΜΑ</span></div>
        ${[['ΙΟΥΛ', PAY_METHODS[1]], ['ΑΥΓ', PAY_METHODS[2]], ['ΣΕΠ', PAY_METHODS[1]], ['ΟΚΤ', CASH]].map(([mo, me], k) => `
        <div class="pr" id="pr${k}"><span class="pm mono">${mo}</span><div class="pt"><b>${feWhole(EX)}</b><span class="${me === CASH ? 'warn' : ''}">${esc(me)}</span></div>
          <span class="pd" style="background:${me === CASH ? 'rgba(229,192,123,.18)' : 'rgba(82,199,158,.16)'};color:${me === CASH ? TONE.wa : TONE.ok}">${me === CASH ? '!' : '✓'}</span></div>`).join('')}
        <div class="wb" id="wb"><span class="wi">!</span><span>${esc(APP_WARN)}</span></div>
      </div>
    </div></div></div>
  </section>

  <!-- 7 · Τι κάνεις από τώρα -->
  <section id="s6">
    ${head(6, 'ΤΙ ΚΑΝΕΙΣ ΑΠΟ ΤΩΡΑ', ['Τρία βήματα', A('πριν από την'), A(`${START_TEXT}.`)], 88)}
    ${[[ICON.iban, 'Δώσε το IBAN σου στον ενοικιαστή', 'για κατάθεση, έμβασμα ή IRIS'], [ICON.shield, 'Βεβαιώσου ότι ο λογαριασμός είναι στην ΑΑΔΕ', 'γνωστοποιημένος, όπως ζητά ο νόμος'], [ICON.receipt, 'Κράτα αποδεικτικό για κάθε μίσθωμα', 'κίνηση λογαριασμού ή απόδειξη κατάθεσης']]
      .map(([ic, t, s], k) => `<div class="card stp" id="k${k}" style="top:${690 + k * 168}px"><span class="sn mono">${k + 1}</span><span class="si">${icon(ic, '#cfe0ff', 42, 1.7)}</span><div><b>${esc(t)}</b><small>${esc(s)}</small></div></div>`).join('')}
    <div class="L sub2" id="c6" style="top:1220px;width:820px">Ο οδηγός και ο υπολογιστής του φόρου: <b>properwise.gr</b></div>
  </section>`;

const CSS = `
  /* 1 · Φάκελος και χαρτονομίσματα */
  #env{position:absolute;left:240px;top:880px;width:600px;height:560px;transform-origin:50% 100%}
  #env .shadow{position:absolute;left:40px;right:40px;bottom:-26px;height:60px;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.55),transparent)}
  #env .flap{position:absolute;left:0;right:0;top:40px;height:200px;clip-path:polygon(0 100%,50% 0,100% 100%);
    background:linear-gradient(180deg,#a98349,#c29d61 80%);filter:drop-shadow(0 -2px 0 rgba(255,255,255,.15))}
  #env .back{position:absolute;left:0;right:0;bottom:0;height:330px;border-radius:12px;background:linear-gradient(180deg,#8a6a38,#a5804a 40%,#b48f57)}
  #env .front{position:absolute;left:0;right:0;bottom:0;height:310px;border-radius:0 0 12px 12px;overflow:hidden;
    clip-path:polygon(0 0,50% 46%,100% 0,100% 100%,0 100%);
    background:repeating-linear-gradient(115deg,rgba(255,255,255,.035) 0 2px,transparent 2px 6px),linear-gradient(180deg,#e2c189,#d1ad70 60%,#c49f63);
    box-shadow:inset 0 -18px 30px rgba(90,60,20,.25)}
  #env .front svg{position:absolute;inset:0;width:100%;height:100%}
  .eur{position:absolute;left:65px;bottom:96px;width:470px;height:252px;border-radius:10px;overflow:hidden;transform-origin:50% 100%;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 0 0 1px rgba(255,255,255,.18),0 18px 34px rgba(0,0,0,.42)}
  .e50{background:linear-gradient(118deg,#f4b874 0%,#e09246 40%,#c8742d 100%)}
  .e20{background:linear-gradient(118deg,#9cc0ee 0%,#5b8ad0 45%,#3a659f 100%)}
  .e10{background:linear-gradient(118deg,#f39a8f 0%,#d6645a 45%,#b2443b 100%)}
  .eur .gl{position:absolute;inset:0;opacity:.9;
    background:repeating-radial-gradient(circle at 28% 62%,rgba(255,255,255,.13) 0 1px,transparent 1.2px 7px),
      repeating-linear-gradient(32deg,rgba(255,255,255,.07) 0 1px,transparent 1px 6px),
      repeating-linear-gradient(-32deg,rgba(0,0,0,.06) 0 1px,transparent 1px 8px)}
  .eur .ros{position:absolute;right:-60px;bottom:-80px;width:300px;height:300px;border-radius:50%;
    background:repeating-conic-gradient(rgba(255,255,255,.12) 0 4deg,transparent 4deg 9deg);-webkit-mask:radial-gradient(closest-side,#000 60%,transparent)}
  .eur .arch{position:absolute;left:168px;top:36px;width:200px;height:164px}
  .eur .stars{position:absolute;right:26px;top:18px;width:86px;height:86px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.25))}
  .eur .holo{position:absolute;left:116px;top:0;bottom:0;width:24px;opacity:.6;mix-blend-mode:screen;background-size:100% 400%;
    background-image:linear-gradient(180deg,#eef1f6,#b8c4d2 12%,#f3e6ff 24%,#c9f2ff 36%,#e9eef4 48%,#ffe9f6 60%,#cfe9ff 72%,#eef1f6 84%,#bcc6d3)}
  .eur .wm{position:absolute;left:26px;top:70px;width:78px;height:112px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,255,.4),rgba(255,255,255,.08) 70%,transparent)}
  .eur .dn{position:absolute;font-weight:850;color:rgba(255,255,255,.94);letter-spacing:-.045em;line-height:1;text-shadow:0 2px 0 rgba(0,0,0,.14)}
  .eur .tl{left:22px;top:16px;font-size:50px} .eur .br{right:20px;bottom:14px;font-size:104px}
  .eur .cur{position:absolute;left:156px;bottom:20px;font-family:'Roboto Mono',monospace;font-size:15px;letter-spacing:.3em;color:rgba(255,255,255,.9)}

  /* 2 · Πλέγματα */
  .gp{top:650px;width:410px;padding:24px 24px 22px}
  .gp .gh{display:flex;justify-content:space-between;align-items:baseline}
  .gp .gh span{font-size:30px;font-weight:750;letter-spacing:-.02em}
  .gp .gh b{font-size:62px;font-weight:850;letter-spacing:-.045em}
  .grid{display:grid;grid-template-columns:repeat(10,1fr);gap:5px;margin-top:16px}
  .grid i{display:block;aspect-ratio:1;border-radius:6px;background:linear-gradient(160deg,#6fa3ff,#2f6fe0);box-shadow:inset 0 1px 0 rgba(255,255,255,.3)}
  .gt{display:inline-block;margin-top:18px;font-size:23px;font-weight:650;padding:8px 16px;border-radius:99px}
  .gp.b .gt{color:${TONE.ok};background:rgba(82,199,158,.14)} .gp.c .gt{color:${TONE.rd};background:rgba(240,110,110,.14)}

  /* 4 · Γράφημα */
  .plot{position:relative;display:flex;gap:14px;align-items:flex-end;height:330px;margin-top:18px}
  .gridl{position:absolute;left:0;right:0;top:40px;bottom:34px;display:flex;flex-direction:column;justify-content:space-between}
  .gridl i{display:block;height:1px;background:rgba(255,255,255,.07)}
  .cb{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;gap:10px;height:100%}
  .cc{flex:1;width:100%;display:flex;align-items:flex-end}
  .cc i{display:block;width:100%;border-radius:12px 12px 4px 4px;transform-origin:bottom center;
    background:linear-gradient(180deg,var(--c),color-mix(in srgb,var(--c) 55%,#0a1220));box-shadow:0 10px 26px color-mix(in srgb,var(--c) 35%,transparent),inset 0 1px 0 rgba(255,255,255,.3)}
  .cb:not(.hi):not(.hi2) .cc i{filter:saturate(.55) brightness(.8)}
  .cv{font-size:22px;font-weight:750;white-space:nowrap}
  .cb.hi .cv,.cb.hi2 .cv{font-size:26px;padding:6px 12px;border-radius:12px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18)}
  .cx{font-family:'Roboto Mono',monospace;font-size:17px;color:#9aa8bd;white-space:nowrap}
  .leg{display:flex;gap:22px;align-items:center;margin-top:12px;font-size:18px;color:#aebbd0}
  .leg span{display:flex;align-items:center;gap:8px} .leg i{display:block;width:14px;height:14px;border-radius:4px}
  .leg em{margin-left:auto;font-style:normal;font-family:'Roboto Mono',monospace;font-size:14px;letter-spacing:.14em;color:#7d8da6}

  /* 6 · Κινητό */
  #spot{position:absolute;left:140px;top:560px;width:800px;height:1000px;background:radial-gradient(closest-side,rgba(138,180,248,.18),transparent)}
  #stage3d{position:absolute;left:0;top:0;width:1080px;height:1920px;perspective:2200px;perspective-origin:50% 50%}
  #phone{position:absolute;left:250px;top:660px;width:580px;height:840px;border-radius:72px;padding:15px;
    background:linear-gradient(145deg,#3a4558,#141b27 40%,#2b3446);box-shadow:0 70px 130px rgba(0,0,0,.7),inset 0 0 0 2px rgba(255,255,255,.08)}
  .scr{position:relative;width:100%;height:100%;border-radius:58px;overflow:hidden;background:linear-gradient(180deg,#0d1422,#070b12 60%)}
  .isl{position:absolute;left:50%;top:16px;width:130px;height:36px;margin-left:-65px;border-radius:20px;background:#000}
  .ap{padding:80px 30px 0}
  .ah{display:flex;align-items:center;gap:14px;font-size:26px;font-weight:750;margin-bottom:14px}
  .ah .m{width:44px;height:44px;border-radius:13px;background:${C.panel};border:1.5px solid ${C.rule};display:flex;align-items:center;justify-content:center}
  .ah .y{margin-left:auto;font-size:14px;color:${C.faint}}
  .pr{display:flex;align-items:center;gap:16px;padding:16px 0;border-top:1.5px solid ${C.rule}}
  .pr .pm{width:64px;font-size:16px;color:${C.faint};letter-spacing:.1em}
  .pr .pt{flex:1;display:flex;flex-direction:column;gap:4px}
  .pr .pt b{font-size:25px;font-weight:750}
  .pr .pt span{font-size:19px;color:#9aa8bd}
  .pr .pt span.warn{color:${TONE.wa};font-weight:650}
  .pr .pd{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-size:21px;font-weight:800}
  .wb{display:flex;gap:12px;margin-top:16px;padding:16px 16px;border-radius:18px;background:rgba(229,192,123,.12);border:1.5px solid rgba(229,192,123,.45);font-size:17px;line-height:1.4;color:#f1e3c4}
  .wb .wi{flex:none;width:26px;height:26px;border-radius:50%;background:${TONE.wa};color:#2a1d05;font-weight:850;display:grid;place-items:center;font-size:16px}

  /* 7 · Βήματα */
  .stp{left:90px;width:850px;height:148px;padding:0 30px;display:flex;align-items:center;gap:24px}
  .stp .sn{flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-size:20px;color:#08111f;background:${C.accent};box-shadow:0 0 20px ${C.accent}88}
  .stp .si{flex:none;width:80px;height:80px;border-radius:22px;display:grid;place-items:center;background:rgba(138,180,248,.14);border:1px solid rgba(138,180,248,.28)}
  .stp b{display:block;font-size:28px;font-weight:700;letter-spacing:-.018em;line-height:1.2}
  .stp small{display:block;font-size:21px;color:#9aa8bd;margin-top:4px}`;

const JS = `
    // ── 1 · Ο φάκελος: τα χαρτονομίσματα βγαίνουν ένα ένα ─────────────────
    u = scene(0);
    { const e = $('e0'), v = eo(p(t, .05, .5)); op(e, v); tf(e, 'translateX(' + (-24 * (1 - v)) + 'px)'); }
    [.12, .26, .42].forEach((s, k) => rev('q' + k, s, null, .55));
    { const v = eo(p(t, 1.15, 1.7)); op($('c0'), v); tf($('c0'), 'translateY(' + (26 * (1 - v)) + 'px)'); }
    { const v = spring(p(t, .15, 1.05)); op($('env'), cl(v * 1.6)); tf($('env'), 'translateY(' + (260 * (1 - v)) + 'px) rotate(' + (-2 * (1 - v) + Math.sin(t * 1.3) * .5) + 'deg)'); }
    for (let k = 0; k < 3; k++) {
      const el = $('n' + k), r = Number(el.dataset.r), v = spring(p(t, .75 + k * .2, 1.7 + k * .2));
      tf(el, 'translate(' + ((k - 1) * 120 * v) + 'px,' + (-(150 + k * 50) * v) + 'px) rotate(' + ((r * 1.6) * (.3 + .7 * v) + Math.sin(t * 1.1 + k) * .8 * v) + 'deg)');
      $('n' + k + 'h').style.backgroundPosition = '0 ' + ((t * 22 + k * 30) % 100) + '%';
    }

    // ── 2 · Ο κανόνας: τα πλέγματα γεμίζουν, το 5% φεύγει ─────────────────
    u = scene(1); heads(1);
    rise('gpb', u, .3, .7, 50); rise('gpc', u, .42, .7, 50);
    ['b', 'c'].forEach((k, side) => {
      let filled = 0;
      for (let i = 0; i < D.tiles; i++) {
        const r = Math.floor(i / 10), c = i % 10, s = .55 + side * .1 + (r + c) * .045, v = eo(p(u, s, s + .3));
        const el = $('g' + k + i); filled += v >= .99 ? 1 : 0;
        const out = i >= D.tiles - D.outN;
        let c0 = '', y = 0, sc = .6 + .4 * v;
        if (out && k === 'b') { const g = spring(p(u, 2.0 + (i - (D.tiles - D.outN)) * .06, 2.7 + (i - (D.tiles - D.outN)) * .06)); y = -26 * g; sc *= 1 + .12 * g;
          if (g > .02) c0 = 'linear-gradient(160deg,#9af0c8,${TONE.ok})'; el.style.boxShadow = g > .02 ? '0 0 ' + (18 * g) + 'px ${TONE.ok}' : ''; }
        if (out && k === 'c') { const g = eo(p(u, 2.5, 2.8)); if (g > .02) c0 = 'linear-gradient(160deg,#ffb1a8,${TONE.rd})';
          const sh = u > 2.8 ? Math.exp(-(u - 2.8) * 8) * Math.sin((u - 2.8) * 50) * 4 : 0; y = sh; }
        el.style.background = c0; op(el, v); tf(el, 'translateY(' + y + 'px) scale(' + sc + ')');
      }
      const gone = k === 'b' ? Math.round(D.outN * eo(p(u, 2.0, 2.9))) : 0;
      $('gv' + k).textContent = D.pcts[Math.max(0, filled - gone)];
    });
    op($('gtb'), eo(p(u, 2.6, 3.0))); op($('gtc'), eo(p(u, 2.9, 3.3)));
    op($('src1'), eo(p(u, 3.3, 3.7)));

    // ── 3 · Από πότε: σελίδα σελίδα ως την 1η Ιουλίου, με κύκλο ────────────
    u = scene(2); heads(2);
    { const v = spring(p(u, .2, 1.0)); op($('cl'), cl(v * 1.6)); tf($('cl'), 'translateY(' + (90 * (1 - v)) + 'px) rotate(' + (-2.5 * (1 - v)) + 'deg)'); }
    cal('cl', u, .7, 3.0, 3.05);
    rise('safe', u, 3.3, .6, 40);
    [0, 1].forEach(k => slide('sy' + k, u, 3.35 + k * .12, .4));

    // ── 4 · Πόσο κοστίζει ────────────────────────────────────────────────
    u = scene(3); heads(3);
    rise('ch', u, .35, .6, 50);
    for (let k = 0; k < D.nb; k++) {
      const s = .5 + k * .14, v = spring(p(u, s, s + .8)); tf($('cf' + k), 'scaleY(' + v + ')');
      $('cv' + k).textContent = D.cv[k][Math.round(cl(eio(p(u, s, s + .7))) * D.steps)]; op($('cv' + k), eo(p(u, s, s + .3)));
    }
    { const v = eo(p(u, 2.8, 3.3)); op($('c3'), v); tf($('c3'), 'translateY(' + (24 * (1 - v)) + 'px)'); }

    // ── 5 · Τι μετρά ως τράπεζα: τέσσερα πλακίδια ────────────────────────
    u = scene(4); heads(4);
    for (let k = 0; k < 4; k++) {
      const s = .35 + k * .18, v = spring(p(u, s, s + .75));
      op($('w' + k), cl(v * 1.8));
      const sh = k === 3 && u > 1.6 ? Math.exp(-(u - 1.6) * 9) * Math.sin((u - 1.6) * 60) * 9 : 0;
      tf($('w' + k), 'translate(' + sh + 'px,' + (50 * (1 - v)) + 'px) scale(' + (.94 + .06 * v) + ')');
      pop('w' + k + 'b', u, s + .45, .5);
    }
    { const v = eo(p(u, 2.0, 2.4)); op($('c4'), v); }

    // ── 6 · Στο PROPERWISE: τα ενοίκια με τον τρόπο είσπραξης ────────────
    u = scene(5); heads(5);
    op($('spot'), eo(p(u, .2, 1.2)));
    { const ph = eo(p(u, .1, 1.0)); tf($('phone'), 'translateY(' + (760 * (1 - ph) + Math.sin(u * 1.4) * 6) + 'px) rotateX(' + (24 - 20 * ph) + 'deg) rotateZ(' + (-3 + 3 * ph) + 'deg)'); }
    for (let k = 0; k < 4; k++) slide('pr' + k, u, .9 + k * .22);
    rise('wb', u, 2.1, .7, 30);

    // ── 7 · Τι κάνεις από τώρα ───────────────────────────────────────────
    u = scene(6); heads(6);
    for (let k = 0; k < 3; k++) { const s = .4 + k * .3, v = spring(p(u, s, s + .7)); op($('k' + k), cl(v * 1.8)); tf($('k' + k), 'translateX(' + (60 * (1 - v)) + 'px)'); }
    { const v = eo(p(u, 1.8, 2.2)); op($('c6'), v); }`;

const LINK = 'https://properwise.gr/odigos/enoikio-meso-trapezas';

const CAPTION = [
  `Σου δίνει το ενοίκιο σε μετρητά; Από ${START_DAY} σου κοστίζει.`,
  '',
  `Από τα ενοίκια αφαιρείται ${PCT} για επισκευές χωρίς αποδείξεις και φορολογείται το ${KEEP}. Από ${START_DAY} η έκπτωση δίνεται μόνο αν το ενοίκιο εξοφλείται με τραπεζικό ή ηλεκτρονικό μέσο. Με μετρητά φορολογείται το ${ALL}.`,
  '',
  `Με ${feWhole(EX)} τον μήνα ο φόρος ανεβαίνει κατά ${feWhole(E.diff)} τον χρόνο. Με ${feWhole(BIG)} τον μήνα κατά ${feWhole(EB.diff)}.`,
  '',
  `Για τα εισοδήματα ${SAFE_YEARS[0]} και ${SAFE_YEARS[1]} η έκπτωση δίνεται όπως κι αν εισπράττεις.`,
  '',
  'Μετράει: κατάθεση στον λογαριασμό σου, έμβασμα, IRIS. Δεν μετράνε τα μετρητά στο χέρι. Ο λογαριασμός πρέπει να είναι γνωστοποιημένος στην ΑΑΔΕ.',
  '',
  'Αποθήκευσέ το και στείλ\' το σε όποιον νοικιάζει σπίτι.',
  '',
  'Ο οδηγός και ο υπολογιστής του φόρου: σύνδεσμος στο bio.',
  '',
  `Πηγή: ${SRC}.`,
  '',
  '#ενοίκιο #φόροςενοικίων #ιδιοκτήτες #ακίνητα #PROPERWISE',
].join('\n');

const X: Explainer = {
  slug: 'reel-trapeza', file: 'PROPERWISE-enoikio-meso-trapezas.mp4',
  scenes: SC, end: END, dur: DUR, html: HTML, css: CSS, heads: [0, 2, 2, 3, 3, 3, 3], js: JS,
  data: { nb: BR.length, cv: CV, steps: STEPS, tiles: TILES, outN: OUT_N, pcts: PCTS, cal: { cl: calPages(DAYS) } },
  sound: m => {
    // 1 · Ο φάκελος και τα τρία χαρτονομίσματα.
    [.12, .26, .42].forEach((s, k) => m.click(s, 2400 + k * 200, .07, (k - 1) * .2));
    m.whoosh(.15, .8, .06, true);
    for (let k = 0; k < 3; k++) { const s = .75 + k * .2 + .25; m.whoosh(s - .1, .35, .04, true); m.click(s, 2200 + k * 250, .05, (k - 1) * .3); m.pluck(s + .02, [74, 77, 81][k], .035, (k - 1) * .3, .4); }
    m.whoosh(SC[1] - 1.1, 1.1, .1, true);
    // 2 · Τα πλέγματα γεμίζουν κύμα κύμα, το 5% πρασινίζει, το κόκκινο τρέμει.
    for (let d = 0; d < 19; d++) m.click(SC[1] + .55 + d * .045 + .15, 3000 + d * 40, .018, (d % 2 ? .3 : -.3));
    for (let k = 0; k < OUT_N; k++) m.pluck(SC[1] + 2.0 + k * .06 + .1, [84, 86, 88, 91, 93][k % 5], .04, .3, .5);
    m.pluck(SC[1] + 2.8, 61, .06, -.2, .3); m.pluck(SC[1] + 2.81, 62, .05, -.2, .3);
    // 3 · Το ημερολόγιο ξεσκίζεται σελίδα σελίδα, ο μαρκαδόρος κυκλώνει.
    for (let k = 1; k < DAYS.length; k++) { const s = SC[2] + .7 + 2.3 * (k - .6) / (DAYS.length - 1); m.whoosh(s, .18, .025, false); m.click(s + .05, 900 + k * 40, .04, .15); }
    m.sweep(SC[2] + 3.05, .7, 1200, 2000, .015); m.bell(SC[2] + 3.7, 89, .04);
    // 4 · Οι μπάρες του φόρου.
    BR.forEach((_, k) => m.pluck(SC[3] + .5 + k * .14 + .2, [69, 72, 76, 79, 81, 84][k], .045, (k - 2.5) * .15, .4));
    // 5 · Τρία ναι, ένα όχι.
    for (let k = 0; k < 3; k++) m.pluck(SC[4] + .35 + k * .18 + .5, [84, 88, 91][k], .045, (k - 1) * .3, .45);
    m.pluck(SC[4] + 1.6, 61, .06, 0, .3); m.pluck(SC[4] + 1.61, 62, .05, 0, .3);
    // 6 · Το κινητό, οι εγγραφές, η προειδοποίηση.
    m.whoosh(SC[5] + .1, .9, .06, true);
    for (let k = 0; k < 4; k++) m.click(SC[5] + .96 + k * .22, 1200, .05, .2);
    m.bell(SC[5] + 2.15, 77, .035, -.2);
    // 7 · Τα τρία βήματα.
    for (let k = 0; k < 3; k++) m.pluck(SC[6] + .4 + k * .3 + .2, [84, 88, 91][k], .045, (k - 1) * .2, .5);
  },
  checkAt: [SC[1] - .3, SC[2] - .3, SC[3] - .3, SC[4] - .3, SC[5] - .3, SC[6] - .3, END - .3, DUR - .2],
  cover: SC[1] - .45,
  stills: [SC[1] - .35, SC[2] - .35, SC[3] - .35, SC[4] - .35, SC[5] - .35, SC[6] - .35, END - .35],
  caption: CAPTION,
  readme: [
    '# Reel-οδηγός: «Ενοίκιο σε μετρητά: τι αλλάζει από 1.7.2027»',
    '',
    'Ο οδηγός `app/odigos/enoikio-meso-trapezas` σε λιγότερο από ένα λεπτό, για Instagram και YouTube Shorts.',
    '',
    '    npx tsx scripts/marketing/reelTrapeza.ts',
    '',
    'Βίντεο και stories (ένα καρέ ανά σκηνή) στο `docs/marketing/reels/reel-trapeza/`, έξω από το git.',
    'Εδώ μένουν η λεζάντα (`caption.md`) και το εξώφυλλο (`cover.jpg`).',
    '',
    `Σύνδεσμος: ${LINK}`,
  ].join('\n'),
};

make(X).catch(e => { console.error(e); process.exit(1); });
