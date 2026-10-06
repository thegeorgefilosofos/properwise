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
import { BEAT, TONE, A, head, check, make, type Explainer } from './explainerKit';

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
const MONTHS_UP = ['ΙΑΝΟΥΑΡΙΟΣ', 'ΦΕΒΡΟΥΑΡΙΟΣ', 'ΜΑΡΤΙΟΣ', 'ΑΠΡΙΛΙΟΣ', 'ΜΑΪΟΣ', 'ΙΟΥΝΙΟΣ', 'ΙΟΥΛΙΟΣ', 'ΑΥΓΟΥΣΤΟΣ', 'ΣΕΠΤΕΜΒΡΙΟΣ', 'ΟΚΤΩΒΡΙΟΣ', 'ΝΟΕΜΒΡΙΟΣ', 'ΔΕΚΕΜΒΡΙΟΣ'];
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
const SC = [0, 6, 15, 22, 32, 40, 48].map(b => b * BEAT);
const END = 56 * BEAT, DUR = 61 * BEAT;

const note = (cls: string, v: string, rot: number) => `<div class="note ${cls}" style="--r:${rot}deg"><span class="nv">${v}</span><span class="ns">€</span><i></i></div>`;

const HTML = `
  <!-- 1 · Η ερώτηση -->
  <section id="s0">
    <div class="L eb mono" id="e0" style="top:320px"><i></i>ΕΝΟΙΚΙΟ ΜΕΣΩ ΤΡΑΠΕΖΑΣ</div>
    <div class="L hd" style="top:370px;font-size:112px">${['Σου δίνει', 'το ενοίκιο', A('σε μετρητά;')].map((l, k) => `<div class="mk"><div class="mi" id="q${k}">${l}</div></div>`).join('')}</div>
    <div class="L sub" id="c0" style="top:730px">Από ${esc(START_DAY)} σου κοστίζει.</div>
    <div id="env" class="deco">
      <div class="env-back"></div>
      ${note('n1', '50', -9)}${note('n2', '20', 4)}${note('n3', '10', -2)}
      <div class="env-front"><div class="fib"></div></div>
      <div class="env-flap"></div>
    </div>
  </section>

  <!-- 2 · Ο κανόνας -->
  <section id="s1">
    ${head(1, 'Ο ΚΑΝΟΝΑΣ', [`Το ${PCT} που χάνεις`, A('με τα μετρητά.')], 92)}
    <div class="L lbl" style="top:640px">ΑΠΟ ΤΑ ΕΝΟΙΚΙΑ ΤΟΥ ΧΡΟΝΟΥ ΦΟΡΟΛΟΓΕΙΤΑΙ</div>
    ${[['b', 'Με τράπεζα', KEEP, TONE.ok], ['c', 'Με μετρητά', ALL, TONE.rd]].map(([k, l, v, c], i) => `
    <div class="rule-row" id="rr${k}" style="top:${700 + i * 250}px">
      <div class="row"><span class="rl">${l}</span><span class="rv" style="color:${c}">${v}</span></div>
      <div class="bar"><i class="fill" id="bf${k}"></i><i class="slice" id="bs${k}"></i></div>
      <div class="tag2" id="bt${k}">${k === 'b' ? `✓ έκπτωση ${PCT} για επισκευές` : `× χωρίς την έκπτωση ${PCT}`}</div>
    </div>`).join('')}
    <div class="L src" id="src1" style="top:1230px">Πηγή: ${esc(SRC)} · τεκμαρτή έκπτωση: άρθρο 39 παρ. 3 ΚΦΕ</div>
  </section>

  <!-- 3 · Από πότε -->
  <section id="s2">
    ${head(2, 'ΑΠΟ ΠΟΤΕ', [`Από ${esc(START_TEXT.replace(` ${FIRST_YEAR_BANK_RECEIPT}`, ''))}`, A(`${FIRST_YEAR_BANK_RECEIPT}.`)], 100)}
    <div class="cal deco" id="cal">
      <div class="cal-h"><span id="calm">${MONTHS_UP[9]}</span><span id="caly">2026</span></div>
      <div class="cal-d" id="cald">1</div>
      <div class="cal-rings"><i></i><i></i></div>
    </div>
    <div class="card" id="safe" style="left:90px;top:1060px;width:850px;padding:12px 34px">
      ${SAFE_YEARS.map((y, k) => check(`sy${k}`, true, `Εισοδήματα ${y}: η έκπτωση δίνεται`, `Δήλωση ${y + 1}, όπως κι αν εισπράττεις`)).join('')}
    </div>
  </section>

  <!-- 4 · Πόσο κοστίζει -->
  <section id="s3">
    ${head(3, 'ΠΟΣΟ ΚΟΣΤΙΖΕΙ', [`${feWhole(EX)} τον μήνα:`, A(`+${feWhole(E.diff)} φόρος`), 'κάθε χρόνο.'], 96)}
    <div class="card" id="ch" style="left:90px;top:720px;width:850px;padding:28px 34px 22px">
      <div class="row"><div class="lbl">ΕΠΙΠΛΕΟΝ ΦΟΡΟΣ ΤΟΝ ΧΡΟΝΟ ΜΕ ΜΕΤΡΗΤΑ</div><span class="pill p-bl">${esc(bracketsLabelForYear(FULL).replace(/ \(.*$/, ''))}</span></div>
      <div class="chart">${BARS.map((b, k) => `<div class="cb${b.r === EX ? ' hi' : ''}${b.r === BIG ? ' hi2' : ''}">
        <span class="cv" id="cv${k}">+${feWhole(b.d)}</span>
        <div class="cc"><i id="cf${k}" style="height:${Math.round(18 + 82 * b.d / BARS[BARS.length - 1].d)}%"></i></div>
        <span class="cx">${feWhole(b.r)}</span></div>`).join('')}</div>
      <div class="lbl" style="font-size:15px;text-align:center;margin-top:8px">ΕΝΟΙΚΙΟ ΤΟΝ ΜΗΝΑ · ΜΟΝΑΔΙΚΟ ΕΙΣΟΔΗΜΑ ΑΠΟ ΑΚΙΝΗΤΑ</div>
    </div>
    <div class="L sub2" id="c3" style="top:1250px;width:820px">Με ${feWhole(BIG)} τον μήνα: <b>+${feWhole(EB.diff)}</b>, γιατί τα ${feWhole(EB.lost)} της έκπτωσης φορολογούνται με ${fpRate(EB_RATE * 100)}.</div>
  </section>

  <!-- 5 · Τι μετρά ως τράπεζα -->
  <section id="s4">
    ${head(4, 'ΤΙ ΜΕΤΡΑ ΩΣ ΤΡΑΠΕΖΑ', ['Μετράει ό,τι', A('φτάνει σε'), A('λογαριασμό σου.')], 88)}
    <div class="card" id="mn" style="left:90px;top:690px;width:850px;padding:14px 34px">
      ${check('w0', true, 'Κατάθεση στον λογαριασμό σου')}
      ${check('w1', true, 'Έμβασμα ή μεταφορά', 'από τον λογαριασμό του ενοικιαστή')}
      ${check('w2', true, 'IRIS', 'άμεση πληρωμή σε πραγματικό χρόνο')}
      ${check('w3', false, 'Μετρητά στο χέρι')}
    </div>
    <div class="L sub2" id="c4" style="top:1140px;width:820px">Ο λογαριασμός πρέπει να είναι <b>γνωστοποιημένος στην ΑΑΔΕ</b>.</div>
  </section>

  <!-- 6 · Στο PROPERWISE -->
  <section id="s5">
    ${head(5, 'ΣΤΟ PROPERWISE', ['Κάθε ενοίκιο', A('με τον τρόπο'), A('που εισπράχθηκε.')], 80)}
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
    <div class="card" id="st" style="left:90px;top:690px;width:850px;padding:14px 34px">
      ${[['Δώσε το IBAN σου στον ενοικιαστή', 'για κατάθεση, έμβασμα ή IRIS'], ['Βεβαιώσου ότι ο λογαριασμός είναι στην ΑΑΔΕ', 'γνωστοποιημένος, όπως ζητά ο νόμος'], ['Κράτα αποδεικτικό για κάθε μίσθωμα', 'κίνηση λογαριασμού ή απόδειξη κατάθεσης']]
        .map(([t, s], k) => `<div class="ck" id="k${k}"><div class="dt num mono">${k + 1}</div><div class="tx">${esc(t)}<small>${esc(s)}</small></div></div>`).join('')}
    </div>
    <div class="L sub2" id="c6" style="top:1110px;width:820px">Ο οδηγός και ο υπολογιστής του φόρου: <b>properwise.gr</b></div>
  </section>`;

const CSS = `
  #env{position:absolute;left:250px;top:880px;width:580px;height:560px;transform-origin:50% 100%}
  .env-back{position:absolute;left:0;right:0;bottom:0;height:340px;border-radius:14px;background:linear-gradient(180deg,#b9935a,#a07c46)}
  .env-front{position:absolute;left:0;right:0;bottom:0;height:300px;border-radius:0 0 14px 14px;overflow:hidden;
    background:linear-gradient(180deg,#d9b67c,#c9a466);clip-path:polygon(0 0,50% 42%,100% 0,100% 100%,0 100%);box-shadow:0 30px 60px rgba(0,0,0,.5)}
  .env-front .fib{position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.05) 0 2px,transparent 2px 7px)}
  .env-flap{position:absolute;left:0;right:0;top:220px;height:200px;background:linear-gradient(0deg,#c49f63,#b38e55);clip-path:polygon(0 0,100% 0,50% 100%);transform-origin:50% 0;opacity:.0}
  .note{position:absolute;left:60px;bottom:120px;width:460px;height:230px;border-radius:12px;transform-origin:50% 100%;
    box-shadow:0 14px 30px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;gap:4px;overflow:hidden}
  .note i{position:absolute;inset:14px;border:2px solid rgba(255,255,255,.35);border-radius:8px}
  .note .nv{font-size:120px;font-weight:850;letter-spacing:-.04em;color:rgba(255,255,255,.85)}
  .note .ns{font-size:70px;font-weight:800;color:rgba(255,255,255,.7)}
  .n1{background:linear-gradient(135deg,#d9894b,#b5642d)} .n2{background:linear-gradient(135deg,#5b8fd0,#3a679f)} .n3{background:linear-gradient(135deg,#d0625b,#a8433d)}
  .rule-row{position:absolute;left:90px;width:850px}
  .rule-row .rl{font-size:34px;font-weight:750;letter-spacing:-.02em}
  .rule-row .rv{font-size:58px;font-weight:850;letter-spacing:-.04em}
  .bar{position:relative;height:56px;border-radius:14px;background:#ffffff10;margin-top:14px;overflow:visible}
  .bar .fill{position:absolute;left:0;top:0;bottom:0;width:95%;border-radius:14px 0 0 14px;background:linear-gradient(90deg,#3d7ef0,#8ab4f8);transform-origin:left center}
  .bar .slice{position:absolute;right:0;top:0;bottom:0;width:5%;border-radius:0 14px 14px 0}
  #bsb{background:${TONE.ok}}
  #bsc{background:${TONE.rd}}
  #bfc{border-radius:14px 0 0 14px}
  .tag2{display:inline-block;font-size:24px;font-weight:650;margin-top:14px;color:#aebbd0}
  .cal{position:absolute;left:290px;top:640px;width:500px;height:380px;border-radius:30px;overflow:hidden;
    background:linear-gradient(180deg,#f6f7fa,#e3e8ef);box-shadow:0 50px 100px rgba(0,0,0,.6);color:#1a2332}
  .cal-h{display:flex;justify-content:space-between;padding:22px 30px;background:#1a2c48;color:#e9eef6;font-family:'Roboto Mono',monospace;font-size:26px;letter-spacing:.14em}
  .cal-d{font-size:220px;font-weight:850;letter-spacing:-.06em;text-align:center;line-height:1.1}
  .cal-rings{position:absolute;left:0;right:0;top:-14px;display:flex;justify-content:space-around}
  .cal-rings i{width:18px;height:40px;border-radius:9px;background:#3a465c}
  .chart{display:flex;gap:14px;align-items:flex-end;height:330px;margin-top:20px}
  .cb{flex:1;display:flex;flex-direction:column;align-items:center;gap:10px;height:100%}
  .cc{flex:1;width:100%;display:flex;align-items:flex-end}
  .cc i{display:block;width:100%;border-radius:12px 12px 4px 4px;background:#2b3d5c;transform-origin:bottom center}
  .cb.hi .cc i{background:linear-gradient(180deg,#8ab4f8,#3d7ef0)} .cb.hi2 .cc i{background:linear-gradient(180deg,${TONE.wa},#c9913a)}
  .cv{font-size:22px;font-weight:750;white-space:nowrap}
  .cb.hi .cv{color:${C.accent}} .cb.hi2 .cv{color:${TONE.wa}}
  .cx{font-family:'Roboto Mono',monospace;font-size:17px;color:#9aa8bd;white-space:nowrap}
  .ck .dt.num{background:rgba(138,180,248,.16);color:#9ec0ff;font-size:22px}
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
  .wb .wi{flex:none;width:26px;height:26px;border-radius:50%;background:${TONE.wa};color:#2a1d05;font-weight:850;display:grid;place-items:center;font-size:16px}`;

const JS = `
    // ── 1 · Η ερώτηση: ο φάκελος με τα μετρητά ───────────────────────────
    u = scene(0);
    { const e = $('e0'), v = eo(p(t, .05, .5)); op(e, v); tf(e, 'translateX(' + (-24 * (1 - v)) + 'px)'); }
    [.12, .26, .42].forEach((s, k) => rev('q' + k, s, null, .55));
    { const v = eo(p(t, 1.15, 1.7)); op($('c0'), v); tf($('c0'), 'translateY(' + (26 * (1 - v)) + 'px)'); }
    { const v = spring(p(t, .2, 1.1)); op($('env'), cl(v * 1.6)); tf($('env'), 'translateY(' + (240 * (1 - v)) + 'px) rotate(' + (-3 + 3 * v + Math.sin(t * 1.4) * .6) + 'deg)'); }
    ['n1', 'n2', 'n3'].forEach((id, k) => {
      const v = spring(p(t, .9 + k * .22, 1.8 + k * .22)), el = document.querySelector('.' + id);
      el.style.transform = 'translate(' + ((k - 1) * 70 * v) + 'px,' + (-(180 + k * 40) * v) + 'px) rotate(' + ((k - 1) * 9 * v + [-9, 4, -2][k] * (1 - v)) + 'deg)';
    });

    // ── 2 · Ο κανόνας: το 5% που φεύγει ──────────────────────────────────
    u = scene(1); heads(1);
    ['b', 'c'].forEach((k, i) => {
      const v = eo(p(u, .45 + i * .2, .96 + i * .2)); op($('rr' + k), v); tf($('rr' + k), 'translateX(' + (40 * (1 - v)) + 'px)');
      tf($('bf' + k), 'scaleX(' + eio(p(u, .6 + i * .2, 1.4 + i * .2)) + ')');
      op($('bs' + k), eo(p(u, 1.3 + i * .2, 1.6 + i * .2)));
    });
    // Με τράπεζα το 5% σηκώνεται και φεύγει από τη φορολογία· με μετρητά μένει μέσα και κοκκινίζει.
    { const v = spring(p(u, 1.9, 2.7)); tf($('bsb'), 'translateY(' + (-12 * v) + 'px)'); $('bsb').style.boxShadow = '0 0 ' + (24 * v) + 'px ' + '${TONE.ok}'; }
    { const s = u > 2.6 ? Math.exp(-(u - 2.6) * 9) * Math.sin((u - 2.6) * 60) * 6 : 0; tf($('bsc'), 'translateX(' + s + 'px)'); }
    op($('btb'), eo(p(u, 2.3, 2.7))); op($('btc'), eo(p(u, 2.6, 3.0)));
    op($('src1'), eo(p(u, 3.0, 3.4)));

    // ── 3 · Από πότε: το ημερολόγιο ξεφυλλίζει ως τον μήνα της έναρξης ───
    u = scene(2); heads(2);
    { const v = spring(p(u, .2, 1.0)); op($('cal'), cl(v * 1.6)); tf($('cal'), 'translateY(' + (80 * (1 - v)) + 'px) rotate(' + (-2 * (1 - v)) + 'deg)'); }
    { const steps = D.flip.length - 1, f = Math.min(steps, Math.floor(eio(p(u, .8, 2.2)) * (steps + .999)));
      $('calm').textContent = D.flip[f][0]; $('caly').textContent = D.flip[f][1];
      const done = f === steps; $('cal').style.boxShadow = done ? '0 0 0 6px rgba(138,180,248,.55), 0 50px 100px rgba(0,0,0,.6)' : '0 50px 100px rgba(0,0,0,.6)'; }
    rise('safe', u, 2.3, .7, 50);
    [0, 1].forEach(k => slide('sy' + k, u, 2.5 + k * .2));

    // ── 4 · Πόσο κοστίζει ────────────────────────────────────────────────
    u = scene(3); heads(3);
    rise('ch', u, .4, .7, 60);
    for (let k = 0; k < D.nb; k++) { const v = spring(p(u, .8 + k * .14, 1.6 + k * .14)); tf($('cf' + k), 'scaleY(' + v + ')'); op($('cv' + k), eo(p(u, 1.2 + k * .14, 1.5 + k * .14))); }
    { const v = eo(p(u, 2.6, 3.1)); op($('c3'), v); tf($('c3'), 'translateY(' + (24 * (1 - v)) + 'px)'); }

    // ── 5 · Τι μετρά ως τράπεζα ──────────────────────────────────────────
    u = scene(4); heads(4);
    rise('mn', u, .35, .7, 50);
    for (let k = 0; k < 4; k++) {
      const s = k < 3 ? .7 + k * .3 : 1.85; slide('w' + k, u, s);
      if (k === 3) { const sh = u > 2.2 ? Math.exp(-(u - 2.2) * 9) * Math.sin((u - 2.2) * 60) * 9 : 0; tf($('w3'), 'translateX(' + sh + 'px)'); }
    }
    { const v = eo(p(u, 2.6, 3.0)); op($('c4'), v); }

    // ── 6 · Στο PROPERWISE: τα ενοίκια με τον τρόπο είσπραξης ────────────
    u = scene(5); heads(5);
    { const ph = eo(p(u, .1, 1.0)); tf($('phone'), 'translateY(' + (760 * (1 - ph) + Math.sin(u * 1.4) * 6) + 'px) rotateX(' + (24 - 20 * ph) + 'deg) rotateZ(' + (-3 + 3 * ph) + 'deg)'); }
    for (let k = 0; k < 4; k++) slide('pr' + k, u, .9 + k * .22);
    rise('wb', u, 2.1, .7, 30);

    // ── 7 · Τι κάνεις από τώρα ───────────────────────────────────────────
    u = scene(6); heads(6);
    rise('st', u, .35, .7, 50);
    for (let k = 0; k < 3; k++) slide('k' + k, u, .75 + k * .4);
    { const v = eo(p(u, 2.3, 2.7)); op($('c6'), v); }`;

// Οι μήνες που ξεφυλλίζει το ημερολόγιο: από τον μήνα δημοσίευσης ως τον μήνα της έναρξης.
const PUBLISH = '2026-10-10';
const FLIP: [string, string][] = [];
for (let y = Number(PUBLISH.slice(0, 4)), mo = Number(PUBLISH.slice(5, 7)); y < FIRST_YEAR_BANK_RECEIPT || (y === FIRST_YEAR_BANK_RECEIPT && mo <= FIRST_MONTH_BANK_RECEIPT); mo++) {
  if (mo > 12) { mo = 1; y++; }
  FLIP.push([MONTHS_UP[mo - 1], String(y)]);
  if (y === FIRST_YEAR_BANK_RECEIPT && mo === FIRST_MONTH_BANK_RECEIPT) break;
}

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
  data: { flip: FLIP, nb: BARS.length },
  sound: m => {
    // 1 · Τα χαρτονομίσματα βγαίνουν από τον φάκελο.
    m.whoosh(.2, .8, .06, true);
    [.9, 1.12, 1.34].forEach((s, k) => { m.click(s + .3, 1800 + k * 300, .06, (k - 1) * .3); m.pluck(s + .32, [74, 77, 81][k], .035, (k - 1) * .3, .4); });
    [.12, .26, .42].forEach((s, k) => m.click(s, 2400 + k * 200, .07, (k - 1) * .2));
    m.whoosh(SC[1] - 1.1, 1.1, .1, true);
    // 2 · Οι μπάρες γεμίζουν, το 5% φεύγει, το κόκκινο τρέμει.
    m.sweep(SC[1] + .6, .8, 500, 1500, .02);
    m.pluck(SC[1] + 2.0, 88, .06, .3, .5); m.bell(SC[1] + 2.05, 93, .025, .3);
    m.pluck(SC[1] + 2.6, 61, .06, -.2, .3); m.pluck(SC[1] + 2.61, 62, .05, -.2, .3);
    // 3 · Το ημερολόγιο ξεφυλλίζει.
    for (let k = 0; k < FLIP.length; k++) m.click(SC[2] + .8 + 1.4 * k / FLIP.length, 1500 + k * 60, .05, .1);
    m.bell(SC[2] + 2.25, 89, .04);
    // 4 · Οι μπάρες του φόρου.
    BARS.forEach((_, k) => m.pluck(SC[3] + .8 + k * .14 + .2, [69, 72, 76, 79, 81, 84][k], .04, (k - 2.5) * .15, .4));
    // 5 · Τρία ναι, ένα όχι.
    [.7, 1.0, 1.3].forEach((s, k) => m.pluck(SC[4] + s + .1, [84, 88, 91][k], .04, .2, .4));
    m.pluck(SC[4] + 1.95, 61, .06, 0, .3); m.pluck(SC[4] + 1.96, 62, .05, 0, .3);
    // 6 · Το κινητό, οι εγγραφές, η προειδοποίηση.
    m.whoosh(SC[5] + .1, .9, .06, true);
    for (let k = 0; k < 4; k++) m.click(SC[5] + .96 + k * .22, 1200, .05, .2);
    m.bell(SC[5] + 2.15, 77, .035, -.2);
    // 7 · Τα τρία βήματα.
    for (let k = 0; k < 3; k++) m.pluck(SC[6] + .8 + k * .4, [84, 88, 91][k], .045, (k - 1) * .2, .5);
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
