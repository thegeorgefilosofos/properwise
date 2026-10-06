// ═══════════════════════════════════════════════════════════════════════════
// REEL-ΟΔΗΓΟΣ · «ΕΚΠΤΩΣΗ ΑΝΑΚΑΙΝΙΣΗΣ: ΔΕΝ ΕΙΝΑΙ 40%»
// ─────────────────────────────────────────────────────────────────────────
// ΧΡΗΣΗ:  npx tsx scripts/marketing/reel39b.ts   (FFMPEG με libx264)
//         REEL_PREVIEW=1,5,9 → μόνο στιγμιότυπα.
//
// Ο οδηγός app/odigos/ekptosi-forou-anakainisis σε λιγότερο από ένα λεπτό. Η
// γωνία είναι το λάθος που κυκλοφορεί: «40%». Μετά τι ισχύει σήμερα, πώς
// μοιράζεται στα έτη, οι όροι, το παράδειγμα με τα υλικά πάνω από το όριο και
// η προθεσμία. Συνέχεια του reel «Πώς ξεκίνησε», που τελειώνει στην ειρωνεία
// του μάστορα που θα γύριζε ως μείωση φόρου.
//
// ΚΑΝΕΝΑ ΦΟΡΟΛΟΓΙΚΟ ΝΟΥΜΕΡΟ ΜΕ ΤΟ ΧΕΡΙ. Όριο, έτη, ποσό ανά έτος, κλάσμα
// υλικών, παράθυρο, νομική βάση και ο παλιός κανόνας από το
// lib/accounting/renovation39b.ts· το παράδειγμα από την ίδια `renovationCredit`
// που τρέχει ο οδηγός, με τα ίδια ποσά εισόδου.
// ═══════════════════════════════════════════════════════════════════════════
import {
  renovationCredit, RENO_39B_CAP, RENO_39B_YEARS, RENO_39B_PER_YEAR, RENO_39B_MATERIALS_SHARE,
  RENO_39B_FROM, RENO_39B_TO, RENO_39B_LAW, RENO_39B_KYA, RENO_39B_OLD_RATE,
} from '../../lib/accounting/renovation39b';
import { feWhole, fn, fpRate } from '../../lib/core/format';
import { C, esc, GRAIN } from './igKit';
import { BEAT, TONE, A, head, tile, ICON, calendar, calPages, make, type Explainer } from './explainerKit';

// ── Τα γεγονότα ──────────────────────────────────────────────────────────
const OLD_MAX = RENO_39B_CAP * RENO_39B_OLD_RATE;
const TIMES = fn(RENO_39B_CAP / OLD_MAX, 1);
const SHARE = `1/${Math.round(1 / RENO_39B_MATERIALS_SHARE)}`;
// Το δεύτερο παράδειγμα του οδηγού: υλικά πάνω από το όριο.
const EX = { services: 9000, materials: 5000 };
const R = renovationCredit(EX);
const CUT = EX.materials - R.materialsCounted;
if (!(CUT > 0)) throw new Error('Στο παράδειγμα τα υλικά δεν ξεπερνούν το όριο· η γωνία θέλει αλλαγή.');
if (R.total !== R.eligible) throw new Error('Το παράδειγμα πιάνει το ανώτατο όριο· η γωνία θέλει άλλο ποσό.');
const [dd, mm, yy] = RENO_39B_TO.split('.').map(Number);
const OLD_YEARS = '2020–2022';
// Η στιγμή που η σφραγίδα ακουμπά: εικόνα, κάμερα και ήχος χτυπούν μαζί.
const STAMP = 0.96;


// ── Ο χρόνος ─────────────────────────────────────────────────────────────
const SC = [0, 6, 16, 24, 32, 42].map(b => b * BEAT);
const END = 50 * BEAT, DUR = 55 * BEAT;

// Μετρητές: κάθε ενδιάμεσο ποσό μορφοποιείται εδώ, με το feWhole της εφαρμογής.
const STEPS = 30;
const count = (to: number) => Array.from({ length: STEPS + 1 }, (_, s) => feWhole(Math.round(to * s / STEPS / 100) * 100));
// Οι σελίδες του ημερολογίου: από τη μέρα δημοσίευσης ως το τέλος του παραθύρου.
const PUBLISH = '2026-10-11';
const TO_ISO = `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
const DAYS = [PUBLISH];
for (let y = Number(PUBLISH.slice(0, 4)), mo = Number(PUBLISH.slice(5, 7)) + 1; `${y}-${String(mo).padStart(2, '0')}-01` < TO_ISO; mo++) {
  if (mo > 12) { mo = 1; y++; }
  if (`${y}-${String(mo).padStart(2, '0')}-01` >= TO_ISO) break;
  DAYS.push(`${y}-${String(mo).padStart(2, '0')}-01`);
}
DAYS.push(TO_ISO);
const COINS = 12;

const HTML = `
  <!-- 1 · Το λάθος που κυκλοφορεί -->
  <section id="s0">
    <div class="L eb mono" id="e0" style="top:320px"><i></i>ΕΚΠΤΩΣΗ ΦΟΡΟΥ ΑΝΑΚΑΙΝΙΣΗΣ</div>
    <div class="L hd" style="top:370px;font-size:120px">${['Ακούς', 'για έκπτωση'].map((l, k) => `<div class="mk"><div class="mi" id="q${k}">${l}</div></div>`).join('')}
      <div class="mk"><div class="mi" id="q2" style="position:relative;display:inline-block">${A(`${fpRate(RENO_39B_OLD_RATE * 100)};`)}
        <svg class="strike" viewBox="0 0 400 120" preserveAspectRatio="none"><path id="sk" pathLength="1" d="M8 78 C 90 40, 220 30, 392 52"/></svg></div></div></div>
    <div class="stamp mono" id="stp"><span>ΟΧΙ ΠΙΑ.</span></div>
    <div class="L sub2" id="c0" style="top:1260px;width:820px">Ίσχυε για δαπάνες ${OLD_YEARS}. Σήμερα δικαιούσαι <b>${TIMES} φορές περισσότερα</b>.</div>
  </section>

  <!-- 2 · Τότε και τώρα -->
  <section id="s1">
    ${head(1, 'ΤΙ ΙΣΧΥΕΙ ΣΗΜΕΡΑ', ['Μειώνεται ο φόρος', A('όσο η δαπάνη.')], 88)}
    <div class="vs">
      <div class="card vc old" id="vo"><div class="lbl">ΔΑΠΑΝΕΣ ${OLD_YEARS}</div><div class="big o">${fpRate(RENO_39B_OLD_RATE * 100)}</div><div class="lb">της δαπάνης</div>
        <div class="cap"><span>το πολύ</span><b id="ko">${feWhole(0)}</b></div><div class="col"><i id="co"></i></div></div>
      <div class="card vc new" id="vn"><div class="lbl" style="color:#9ec0ff">ΑΠΟ ${esc(RENO_39B_FROM)}</div><div class="big a">${fpRate(100)}</div><div class="lb">της δαπάνης</div>
        <div class="cap"><span>το πολύ</span><b class="ac" id="kn">${feWhole(0)}</b></div><div class="col"><i id="cn"></i></div></div>
      <div class="times mono" id="tm">×${TIMES}</div>
    </div>
    <div class="L src" id="src1" style="top:1300px">Πηγή: ${esc(RENO_39B_LAW)} · ${esc(RENO_39B_KYA)}</div>
  </section>

  <!-- 3 · Πώς μοιράζεται: πέντε στοίβες νομισμάτων -->
  <section id="s2">
    ${head(2, 'ΠΩΣ ΜΟΙΡΑΖΕΤΑΙ', ['Ισόποσα', A(`σε ${RENO_39B_YEARS} έτη.`)], 108)}
    <div class="stk5" id="stk">
      ${Array.from({ length: RENO_39B_YEARS }, (_, k) => `<div class="yc"><span class="yv" id="yv${k}">${feWhole(RENO_39B_PER_YEAR)}</span>
        <div class="coins">${Array.from({ length: COINS }, (_, c) => `<i class="coin" id="cn${k}_${c}" style="bottom:${c * 24}px">${c === COINS - 1 ? '<b>€</b>' : ''}</i>`).join('')}</div>
        <span class="lbl" style="font-size:17px;margin-top:18px">ΕΤΟΣ ${k + 1}</span></div>`).join('')}
    </div>
    <div class="L sub2" id="c2" style="top:1180px;width:820px">Το πολύ <b>${feWhole(RENO_39B_PER_YEAR)} τον χρόνο</b> και όχι πάνω από τον φόρο της χρονιάς. Ό,τι περισσεύει δεν επιστρέφεται.</div>
  </section>

  <!-- 4 · Οι όροι -->
  <section id="s3">
    ${head(3, 'ΟΙ ΟΡΟΙ', ['Τέσσερις όροι,', A('αλλιώς τίποτα.')], 96)}
    <div class="ftg" style="top:610px">
      ${tile('w0', true, ICON.card, 'Ηλεκτρονική πληρωμή', 'κάρτα, έμβασμα ή άμεση πληρωμή')}
      ${tile('w1', true, ICON.invoice, 'Τιμολόγιο στο ΑΦΜ σου', 'για εργασία και υλικά')}
      ${tile('w2', true, ICON.pin, 'Πάροχος στην Ελλάδα', 'με έδρα ή μόνιμη εγκατάσταση')}
      ${tile('w3', true, ICON.pie, `Υλικά έως ${SHARE}`, 'της αξίας της εργασίας')}
      <div class="wide">${tile('w4', false, ICON.cash, 'Πληρωμή με μετρητά', 'καμία έκπτωση, όσο σωστό κι αν είναι το παραστατικό')}</div>
    </div>
  </section>

  <!-- 5 · Το παράδειγμα: η προσφορά του συνεργείου -->
  <section id="s4">
    ${head(4, 'ΠΑΡΑΔΕΙΓΜΑ', [`Εργασία ${feWhole(EX.services)},`, `υλικά ${feWhole(EX.materials)}:`, A(`μετράνε ${feWhole(R.eligible)}.`)], 92)}
    <div class="quote deco" id="qt">
      <div class="qh mono"><span>ΠΡΟΣΦΟΡΑ ΣΥΝΕΡΓΕΙΟΥ</span><span>ΑΝΑΛΥΤΙΚΗ</span></div>
      <div class="ql"><span>Εργασία</span><b>${feWhole(EX.services)}</b></div>
      <div class="ql"><span>Υλικά</span><b><s id="qs">${feWhole(EX.materials)}</s><em id="qm">${feWhole(R.materialsCounted)}</em></b></div>
      <div class="qn" id="qn">όριο υλικών: ${feWhole(EX.services)} / 3 = ${feWhole(R.materialsCounted)} · τα ${feWhole(CUT)} δεν μετράνε</div>
      <div class="ql qt"><span>Επιλέξιμα</span><b id="qe">${feWhole(R.eligible)}</b></div>
    </div>
    <div class="card" id="res" style="left:90px;top:1110px;width:850px;padding:24px 34px">
      <div class="lbl">ΜΕΙΩΣΗ ΦΟΡΟΥ</div>
      <div class="rr"><b>${feWhole(R.perYear)}</b><span>τον χρόνο, για ${RENO_39B_YEARS} έτη</span></div>
    </div>
  </section>

  <!-- 6 · Η προθεσμία -->
  <section id="s5">
    ${head(5, 'Η ΠΡΟΘΕΣΜΙΑ', ['Για δαπάνες', A(`ως τις ${esc(RENO_39B_TO)}.`)], 100)}
    ${calendar('cl', 290, 620)}
    <div class="L sub2" id="c5" style="top:1110px;width:820px">Κράτα <b>τιμολόγια και αποδεικτικά πληρωμής</b> ανά ακίνητο. Αυτά θα ζητήσει ο λογιστής.</div>
    <div class="L sub2" id="c5b" style="top:1250px;width:820px">Στο PROPERWISE τα φωτογραφίζεις και μπαίνουν στο σωστό ακίνητο.</div>
  </section>`;

const CSS = `
  .strike{position:absolute;left:-10px;right:-10px;top:10%;height:80%;overflow:visible;pointer-events:none}
  .strike path{fill:none;stroke:${TONE.rd};stroke-width:12;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1}
  .stamp{position:absolute;left:190px;top:860px;width:700px;padding:28px 0;text-align:center;border:10px solid ${TONE.rd};border-radius:26px;
    color:${TONE.rd};font-size:108px;font-weight:700;letter-spacing:.04em;white-space:nowrap;transform:rotate(-7deg);background:rgba(240,110,110,.08);
    box-shadow:0 0 0 4px rgba(240,110,110,.12) inset;-webkit-mask-image:${GRAIN},linear-gradient(#000,#000);-webkit-mask-size:260px,100%;-webkit-mask-composite:source-over}
  .vs{position:absolute;left:90px;top:620px;width:850px;height:640px}
  .vc{top:0;bottom:0;width:390px;padding:30px 30px 0;display:flex;flex-direction:column}
  .vc.old{left:0} .vc.new{left:460px;border-color:rgba(138,180,248,.45);box-shadow:0 40px 90px rgba(0,0,0,.6),0 0 60px rgba(61,126,240,.25),inset 0 1px 0 rgba(255,255,255,.12)}
  .vc .big{font-size:116px;font-weight:850;letter-spacing:-.05em;line-height:1;margin-top:16px}
  .vc .big.o{color:#7d8da6;text-decoration:line-through;text-decoration-thickness:6px;text-decoration-color:${TONE.rd}}
  .vc .lb{font-size:24px;color:#aebbd0;margin-top:6px}
  .vc .cap{display:flex;flex-direction:column;margin-top:20px}
  .vc .cap span{font-size:20px;color:#7d8da6}
  .vc .cap b{font-size:52px;font-weight:850;letter-spacing:-.04em;color:#aebbd0}
  .vc .cap b.ac{color:${C.accent}}
  .vc .col{flex:1;display:flex;align-items:flex-end;margin-top:16px;padding-bottom:26px}
  .vc .col i{display:block;width:100%;border-radius:14px 14px 6px 6px;transform-origin:bottom center}
  #co{height:${Math.round(100 * OLD_MAX / RENO_39B_CAP)}%;background:repeating-linear-gradient(135deg,#2b3d5c 0 12px,#243450 12px 24px)}
  #cn{height:100%;background:linear-gradient(180deg,#8ab4f8,#3d7ef0);box-shadow:0 10px 30px rgba(21,96,212,.45)}
  .times{position:absolute;left:350px;top:330px;width:150px;height:150px;border-radius:50%;display:grid;place-items:center;font-size:40px;font-weight:700;
    color:#08111f;background:radial-gradient(circle at 35% 30%,#d6e6ff,${C.accent} 60%,#3d7ef0);box-shadow:0 0 0 8px rgba(138,180,248,.18),0 20px 50px rgba(0,0,0,.5),0 0 60px ${C.accent}66}
  .stk5{position:absolute;left:90px;top:640px;width:850px;height:480px;display:flex;justify-content:space-between;align-items:flex-end}
  .yc{width:150px;display:flex;flex-direction:column;align-items:center}
  .yc .yv{font-size:28px;font-weight:800;letter-spacing:-.02em;margin-bottom:16px;padding:6px 14px;border-radius:12px;background:rgba(240,201,125,.12);border:1px solid rgba(240,201,125,.35);color:#ffe3a6}
  .yc .coins{position:relative;width:150px;height:${(COINS - 1) * 24 + 46}px}
  .coin{position:absolute;left:10px;width:130px;height:38px;border-radius:50%;display:grid;place-items:center;
    background:radial-gradient(ellipse at 50% 30%,#fff1b8 0%,#f0c457 45%,#c99130 100%);
    box-shadow:0 8px 0 #a3741f,0 8px 0 1px #7d5814,0 14px 14px rgba(0,0,0,.35),inset 0 0 0 3px rgba(255,255,255,.28),inset 0 0 0 7px rgba(163,116,31,.35)}
  .coin b{font-size:22px;color:#8a6118;text-shadow:0 1px 0 rgba(255,255,255,.5)}
  .ftg .wide{grid-column:1/-1} .ftg .wide .ft{height:170px;padding-left:134px;justify-content:center}
  .quote{position:absolute;left:150px;top:690px;width:780px;padding:26px 36px 24px;border-radius:12px;color:#1f2632;
    background:linear-gradient(180deg,#fbfbf8,#eeeee8);box-shadow:0 2px 2px rgba(0,0,0,.25),0 40px 70px rgba(0,0,0,.5);transform:rotate(-1.5deg)}
  .quote .qh{display:flex;justify-content:space-between;font-size:18px;letter-spacing:.2em;color:#57606c;padding-bottom:14px;border-bottom:2px dashed rgba(30,34,40,.35)}
  .quote .ql{display:flex;justify-content:space-between;align-items:baseline;font-size:34px;font-weight:650;padding:16px 0 6px}
  .quote .ql b{font-weight:800;letter-spacing:-.02em;display:flex;gap:18px;align-items:baseline}
  .quote s{text-decoration:none;position:relative;color:#1f2632}
  .quote s:after{content:'';position:absolute;left:-6px;right:-6px;top:52%;height:5px;border-radius:3px;background:#c83a3a;transform-origin:left center;transform:scaleX(var(--k,0))}
  .quote em{font-style:normal;color:#1a8a5a;font-size:38px;font-weight:850;opacity:0}
  .quote .qn{font-family:'Roboto Mono',monospace;font-size:18px;color:#c83a3a;margin-top:4px}
  .quote .qt{border-top:3px solid #1f2632;margin-top:12px;padding-top:16px}
  #res .rr{display:flex;align-items:baseline;gap:18px;margin-top:6px}
  #res .rr b{font-size:88px;font-weight:850;letter-spacing:-.05em;color:${C.accent}}
  #res .rr span{font-size:26px;color:#aebbd0}`;

const JS = `
    // ── 1 · Το λάθος: διαγραφή με μαρκαδόρο και η σφραγίδα ──────────────
    u = scene(0);
    { const e = $('e0'), v = eo(p(t, -.3, .2)); op(e, v); tf(e, 'translateX(' + (-24 * (1 - v)) + 'px)'); }
    [-.8, -.7, -.6].forEach((s, k) => rev('q' + k, s, null, .55));
    $('sk').style.strokeDashoffset = 1 - eio(p(t, .4, .7));
    { const sp = p(t, D.stamp - .2, D.stamp), sv = ei(sp); op($('stp'), sp > 0 ? 1 : 0);
      const sh = t > D.stamp ? Math.exp(-(t - D.stamp) * 12) * Math.sin((t - D.stamp) * 70) * 8 : 0;
      tf($('stp'), 'translate(' + sh + 'px,' + (sh * .4) + 'px) rotate(-7deg) scale(' + (2.2 - 1.2 * sv) + ')'); }
    { const v = eo(p(t, 1.4, 1.9)); op($('c0'), v); tf($('c0'), 'translateY(' + (24 * (1 - v)) + 'px)'); }

    // ── 2 · Τότε και τώρα ────────────────────────────────────────────────
    u = scene(1); heads(1);
    rise('vo', u, .35, .7, 60); rise('vn', u, .5, .7, 60);
    { const v = spring(p(u, .8, 1.6)); tf($('co'), 'scaleY(' + v + ')'); $('ko').textContent = D.ko[Math.round(cl(eio(p(u, .8, 1.5))) * D.steps)]; }
    { const v = spring(p(u, 1.1, 2.0)); tf($('cn'), 'scaleY(' + v + ')'); $('kn').textContent = D.kn[Math.round(cl(eio(p(u, 1.1, 1.9))) * D.steps)]; }
    pop('tm', u, 2.1, .7);
    op($('src1'), eo(p(u, 2.6, 3.0)));

    // ── 3 · Πέντε στοίβες νομισμάτων ─────────────────────────────────────
    u = scene(2); heads(2);
    for (let k = 0; k < D.years; k++) {
      for (let c = 0; c < D.coins; c++) {
        const s = .45 + k * .16 + c * .05, v = eo(p(u, s, s + .22)), el = $('cn' + k + '_' + c);
        op(el, v); tf(el, 'translateY(' + (-120 * (1 - v)) + 'px)');
      }
      pop('yv' + k, u, .45 + k * .16 + D.coins * .05 + .1, .5);
    }
    { const v = eo(p(u, 2.6, 3.1)); op($('c2'), v); tf($('c2'), 'translateY(' + (24 * (1 - v)) + 'px)'); }

    // ── 4 · Οι όροι ──────────────────────────────────────────────────────
    u = scene(3); heads(3);
    for (let k = 0; k < 5; k++) {
      const s = k < 4 ? .3 + k * .16 : 1.4, v = spring(p(u, s, s + .75));
      op($('w' + k), cl(v * 1.8));
      const sh = k === 4 && u > 1.9 ? Math.exp(-(u - 1.9) * 9) * Math.sin((u - 1.9) * 60) * 9 : 0;
      tf($('w' + k), 'translate(' + sh + 'px,' + (50 * (1 - v)) + 'px) scale(' + (.94 + .06 * v) + ')');
      pop('w' + k + 'b', u, s + .45, .5);
    }

    // ── 5 · Η προσφορά: τα υλικά πάνω από το όριο διαγράφονται ──────────
    u = scene(4); heads(4);
    { const v = spring(p(u, .3, 1.1)); op($('qt'), cl(v * 1.6)); tf($('qt'), 'translateY(' + (90 * (1 - v)) + 'px) rotate(' + (-1.5 - 3 * (1 - v)) + 'deg)'); }
    $('qs').style.setProperty('--k', eio(p(u, 1.5, 1.9)));
    { const v = spring(p(u, 1.85, 2.5)); op($('qm'), cl(v * 1.6)); tf($('qm'), 'scale(' + (.6 + .4 * v) + ')'); }
    op($('qn'), eo(p(u, 2.0, 2.4)));
    rise('res', u, 2.7, .7, 40);

    // ── 6 · Η προθεσμία: ως τις 31 Δεκεμβρίου, με κύκλο ─────────────────
    u = scene(5); heads(5);
    { const v = spring(p(u, .2, 1.0)); op($('cl'), cl(v * 1.6)); tf($('cl'), 'translateY(' + (90 * (1 - v)) + 'px) rotate(' + (-2.5 * (1 - v)) + 'deg)'); }
    cal('cl', u, .7, 2.0, 2.05);
    { const v = eo(p(u, 2.6, 3.1)); op($('c5'), v); tf($('c5'), 'translateY(' + (24 * (1 - v)) + 'px)'); }
    { const v = eo(p(u, 3.2, 3.7)); op($('c5b'), v); tf($('c5b'), 'translateY(' + (24 * (1 - v)) + 'px)'); }`;

const LINK = 'https://properwise.gr/odigos/ekptosi-forou-anakainisis';
const CAPTION = [
  `Η έκπτωση φόρου για ανακαίνιση δεν είναι ${fpRate(RENO_39B_OLD_RATE * 100)}. Αυτό ίσχυε για δαπάνες ${OLD_YEARS}.`,
  '',
  `Για δαπάνες από ${RENO_39B_FROM} ως ${RENO_39B_TO}, ο φόρος μειώνεται όσο η επιλέξιμη δαπάνη, ως ${feWhole(RENO_39B_CAP)} συνολικά. Ισόποσα σε ${RENO_39B_YEARS} έτη, το πολύ ${feWhole(RENO_39B_PER_YEAR)} τον χρόνο και όχι πάνω από τον φόρο της χρονιάς.`,
  '',
  `Οι όροι: ηλεκτρονική πληρωμή, τιμολόγιο στο ΑΦΜ σου, πάροχος με έδρα στην Ελλάδα, υλικά έως ${SHARE} της εργασίας. Με μετρητά, καμία έκπτωση.`,
  '',
  `Παράδειγμα: εργασία ${feWhole(EX.services)} και υλικά ${feWhole(EX.materials)}. Μετράνε υλικά ${feWhole(R.materialsCounted)}, άρα επιλέξιμα ${feWhole(R.eligible)} και μείωση φόρου ${feWhole(R.perYear)} τον χρόνο για ${RENO_39B_YEARS} έτη.`,
  '',
  'Αποθήκευσέ το για την επόμενη προσφορά συνεργείου. Στείλ\' το σε όποιον ετοιμάζει ανακαίνιση.',
  '',
  'Ο οδηγός με όλες τις προϋποθέσεις: σύνδεσμος στο bio.',
  '',
  `Πηγή: ${RENO_39B_LAW}, ${RENO_39B_KYA}.`,
  '',
  '#ανακαίνιση #έκπτωσηφόρου #ιδιοκτήτες #ακίνητα #PROPERWISE',
].join('\n');

const X: Explainer = {
  slug: 'reel-39b', file: 'PROPERWISE-ekptosi-anakainisis.mp4',
  scenes: SC, end: END, dur: DUR, html: HTML, css: CSS, heads: [0, 2, 2, 2, 3, 2], js: JS,
  data: { stamp: STAMP, years: RENO_39B_YEARS, coins: COINS, steps: STEPS, ko: count(OLD_MAX), kn: count(RENO_39B_CAP), cal: { cl: calPages(DAYS) } },
  sound: m => {
    m.whoosh(0, .6, .05, true);
    m.sweep(.4, .3, 1400, 2400, .02);
    m.boom(STAMP, .26); m.clap(STAMP, .12); m.click(STAMP, 500, .2);
    m.whoosh(SC[1] - 1.1, 1.1, .1, true);
    for (let s = .8; s < 1.9; s += 1 / 18) m.click(SC[1] + s, 3400, .022, s < 1.5 ? -.25 : .25);
    m.pluck(SC[1] + 2.1, 81, .06, 0, .5); m.bell(SC[1] + 2.15, 88, .035);
    for (let k = 0; k < RENO_39B_YEARS; k++) for (let c = 0; c < COINS; c++) m.click(SC[2] + .45 + k * .16 + c * .05 + .2, 4200 + c * 120, .022, (k - 2) * .2);
    for (let k = 0; k < RENO_39B_YEARS; k++) m.pluck(SC[2] + .45 + k * .16 + COINS * .05 + .15, [77, 81, 84, 88, 89][k], .04, (k - 2) * .2, .5);
    for (let k = 0; k < 4; k++) m.pluck(SC[3] + .3 + k * .16 + .5, [84, 86, 88, 91][k], .04, .2, .4);
    m.pluck(SC[3] + 1.9, 61, .06, 0, .3); m.pluck(SC[3] + 1.91, 62, .05, 0, .3);
    m.whoosh(SC[4] + .3, .6, .05, true); m.click(SC[4] + 1.0, 700, .08);
    m.sweep(SC[4] + 1.5, .4, 900, 1500, .015); m.pluck(SC[4] + 1.9, 88, .05, .2, .4);
    m.pluck(SC[4] + 2.8, 88, .06, 0, .5); m.bell(SC[4] + 2.85, 93, .03);
    for (let k = 1; k < DAYS.length; k++) { const s = SC[5] + .7 + 1.3 * (k - .6) / (DAYS.length - 1); m.whoosh(s, .2, .03, false); m.click(s + .05, 900 + k * 60, .045, .15); }
    m.sweep(SC[5] + 2.05, .7, 1200, 2000, .015); m.bell(SC[5] + 2.7, 89, .04);
  },
  checkAt: [SC[1] - .3, SC[2] - .3, SC[3] - .3, SC[4] - .3, SC[5] - .3, END - .3, DUR - .2],
  cover: SC[1] - .45,
  spots: [[540, 980], [515, 940], [515, 900], [515, 950], [540, 880], [540, 850]],
  hits: [STAMP],
  stills: [SC[1] - .35, SC[2] - .35, SC[3] - .35, SC[4] - .35, SC[5] - .35, END - .35],
  caption: CAPTION,
  readme: [
    '# Reel-οδηγός: «Έκπτωση ανακαίνισης: δεν είναι 40%»',
    '',
    'Ο οδηγός `app/odigos/ekptosi-forou-anakainisis` σε λιγότερο από ένα λεπτό, για Instagram και YouTube Shorts.',
    '',
    '    npx tsx scripts/marketing/reel39b.ts',
    '',
    'Βίντεο και stories (ένα καρέ ανά σκηνή) στο `docs/marketing/reels/reel-39b/`, έξω από το git.',
    'Εδώ μένουν η λεζάντα (`caption.md`) και το εξώφυλλο (`cover.jpg`).',
    '',
    `Σύνδεσμος: ${LINK}`,
  ].join('\n'),
};

make(X).catch(e => { console.error(e); process.exit(1); });
