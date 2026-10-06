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
import { C, esc } from './igKit';
import { BEAT, TONE, A, head, check, make, type Explainer } from './explainerKit';

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
const MONTHS_UP = ['ΙΑΝΟΥΑΡΙΟΣ', 'ΦΕΒΡΟΥΑΡΙΟΣ', 'ΜΑΡΤΙΟΣ', 'ΑΠΡΙΛΙΟΣ', 'ΜΑΪΟΣ', 'ΙΟΥΝΙΟΣ', 'ΙΟΥΛΙΟΣ', 'ΑΥΓΟΥΣΤΟΣ', 'ΣΕΠΤΕΜΒΡΙΟΣ', 'ΟΚΤΩΒΡΙΟΣ', 'ΝΟΕΜΒΡΙΟΣ', 'ΔΕΚΕΜΒΡΙΟΣ'];
const OLD_YEARS = '2020–2022';

// ── Ο χρόνος ─────────────────────────────────────────────────────────────
const SC = [0, 6, 16, 24, 33, 43].map(b => b * BEAT);
const END = 51 * BEAT, DUR = 56 * BEAT;

const HTML = `
  <!-- 1 · Το λάθος που κυκλοφορεί -->
  <section id="s0">
    <div class="L eb mono" id="e0" style="top:320px"><i></i>ΕΚΠΤΩΣΗ ΦΟΡΟΥ ΑΝΑΚΑΙΝΙΣΗΣ</div>
    <div class="L hd" style="top:370px;font-size:120px">${['Ακούς', 'για έκπτωση', A(`${fpRate(RENO_39B_OLD_RATE * 100)};`)].map((l, k) => `<div class="mk"><div class="mi" id="q${k}">${l}</div></div>`).join('')}</div>
    <div class="stamp mono" id="stp">ΟΧΙ ΠΙΑ.</div>
    <div class="L sub2" id="c0" style="top:1260px;width:820px">Ίσχυε για δαπάνες ${OLD_YEARS}. Σήμερα δικαιούσαι <b>${TIMES} φορές περισσότερα</b>.</div>
  </section>

  <!-- 2 · Τότε και τώρα -->
  <section id="s1">
    ${head(1, 'ΤΙ ΙΣΧΥΕΙ ΣΗΜΕΡΑ', ['Μειώνεται ο φόρος', A('όσο η δαπάνη.')], 88)}
    <div class="vs">
      <div class="card vc old" id="vo"><div class="lbl">ΔΑΠΑΝΕΣ ${OLD_YEARS}</div><div class="big o">${fpRate(RENO_39B_OLD_RATE * 100)}</div><div class="lb">της δαπάνης</div>
        <div class="cap"><span>το πολύ</span><b>${feWhole(OLD_MAX)}</b></div><div class="col"><i id="co"></i></div></div>
      <div class="card vc new" id="vn"><div class="lbl" style="color:#9ec0ff">ΑΠΟ ${esc(RENO_39B_FROM)}</div><div class="big a">${fpRate(100)}</div><div class="lb">της δαπάνης</div>
        <div class="cap"><span>το πολύ</span><b class="ac">${feWhole(RENO_39B_CAP)}</b></div><div class="col"><i id="cn"></i></div></div>
    </div>
    <div class="L src" id="src1" style="top:1300px">Πηγή: ${esc(RENO_39B_LAW)} · ${esc(RENO_39B_KYA)}</div>
  </section>

  <!-- 3 · Πώς μοιράζεται -->
  <section id="s2">
    ${head(2, 'ΠΩΣ ΜΟΙΡΑΖΕΤΑΙ', ['Ισόποσα', A(`σε ${RENO_39B_YEARS} έτη.`)], 108)}
    <div class="card" id="yr" style="left:90px;top:660px;width:850px;padding:28px 34px 26px">
      <div class="row"><div class="lbl">ΜΕΙΩΣΗ ΦΟΡΟΥ ΑΝΑ ΕΤΟΣ</div><span class="pill p-bl">το πολύ ${feWhole(RENO_39B_PER_YEAR)}</span></div>
      <div class="bars5">${Array.from({ length: RENO_39B_YEARS }, (_, k) => `<div class="b"><div class="c"><div class="f" id="yf${k}"><span>${feWhole(RENO_39B_PER_YEAR)}</span></div></div><div class="lbl" style="font-size:16px">ΕΤΟΣ ${k + 1}</div></div>`).join('')}</div>
    </div>
    <div class="L sub2" id="c2" style="top:1140px;width:820px">Κάθε χρόνο, <b>όχι πάνω από τον φόρο της χρονιάς</b>. Ό,τι περισσεύει δεν επιστρέφεται.</div>
  </section>

  <!-- 4 · Οι όροι -->
  <section id="s3">
    ${head(3, 'ΟΙ ΟΡΟΙ', ['Τέσσερις όροι,', A('αλλιώς τίποτα.')], 96)}
    <div class="card" id="cd" style="left:90px;top:640px;width:850px;padding:12px 34px">
      ${check('w0', true, 'Ηλεκτρονική πληρωμή', 'κάρτα, έμβασμα ή άμεση πληρωμή')}
      ${check('w1', true, 'Τιμολόγιο στο ΑΦΜ σου', 'για κάθε εργασία και κάθε αγορά υλικών')}
      ${check('w2', true, 'Πάροχος με έδρα στην Ελλάδα')}
      ${check('w3', true, `Υλικά έως ${SHARE} της εργασίας`)}
      ${check('w4', false, 'Πληρωμή με μετρητά', 'καμία έκπτωση, όσο σωστό κι αν είναι το παραστατικό')}
    </div>
  </section>

  <!-- 5 · Το παράδειγμα -->
  <section id="s4">
    ${head(4, 'ΠΑΡΑΔΕΙΓΜΑ', [`Εργασία ${feWhole(EX.services)},`, `υλικά ${feWhole(EX.materials)}:`, A(`μετράνε ${feWhole(R.eligible)}.`)], 92)}
    <div class="card" id="ex" style="left:90px;top:700px;width:850px;padding:28px 34px 26px">
      <div class="lbl">ΕΠΙΛΕΞΙΜΗ ΔΑΠΑΝΗ</div>
      <div class="stack" id="stk">
        <i class="sv" style="flex:${EX.services}"><span>Εργασία ${feWhole(EX.services)}</span></i>
        <i class="sm" style="flex:${R.materialsCounted}"><span>Υλικά ${feWhole(R.materialsCounted)}</span></i>
        <i class="sx" id="sx" style="flex:${CUT}"><span>${feWhole(CUT)} εκτός</span></i>
      </div>
      <div class="ruleline"><span>όριο υλικών: ${feWhole(EX.services)} / 3 = ${feWhole(R.materialsCounted)}</span></div>
      <div class="res" id="res"><span>Μείωση φόρου</span><b>${feWhole(R.perYear)}</b><span>τον χρόνο, για ${RENO_39B_YEARS} έτη</span></div>
    </div>
    <div class="L sub2" id="c4" style="top:1230px;width:820px">Ζήτα <b>προσφορά που χωρίζει την εργασία από τα υλικά</b>. Η αναλογία φαίνεται ήδη εκεί.</div>
  </section>

  <!-- 6 · Η προθεσμία -->
  <section id="s5">
    ${head(5, 'Η ΠΡΟΘΕΣΜΙΑ', ['Για δαπάνες', A(`ως τις ${esc(RENO_39B_TO)}.`)], 100)}
    <div class="cal deco" id="cal">
      <div class="cal-h"><span>${MONTHS_UP[mm - 1]}</span><span>${yy}</span></div>
      <div class="cal-d">${dd}</div>
      <div class="cal-rings"><i></i><i></i></div>
    </div>
    <div class="L sub2" id="c5" style="top:1080px;width:820px">Κράτα <b>τιμολόγια και αποδεικτικά πληρωμής</b> ανά ακίνητο. Αυτά θα ζητήσει ο λογιστής.</div>
    <div class="L sub2" id="c5b" style="top:1230px;width:820px">Στο PROPERWISE τα φωτογραφίζεις και μπαίνουν στο σωστό ακίνητο.</div>
  </section>`;

const CSS = `
  .stamp{position:absolute;left:190px;top:860px;width:700px;padding:28px 0;text-align:center;border:10px solid ${TONE.rd};border-radius:26px;
    color:${TONE.rd};font-size:108px;font-weight:700;letter-spacing:.04em;white-space:nowrap;transform:rotate(-7deg);background:rgba(240,110,110,.08);
    box-shadow:0 0 0 4px rgba(240,110,110,.12) inset}
  .vs{position:absolute;left:90px;top:620px;width:850px;height:640px}
  .vc{top:0;bottom:0;width:410px;padding:30px 30px 0;display:flex;flex-direction:column}
  .vc.old{left:0} .vc.new{left:440px;border-color:rgba(138,180,248,.45)}
  .vc .big{font-size:120px;font-weight:850;letter-spacing:-.05em;line-height:1;margin-top:16px}
  .vc .big.o{color:#7d8da6;text-decoration:line-through;text-decoration-thickness:6px;text-decoration-color:${TONE.rd}}
  .vc .lb{font-size:24px;color:#aebbd0;margin-top:6px}
  .vc .cap{display:flex;flex-direction:column;margin-top:20px}
  .vc .cap span{font-size:20px;color:#7d8da6}
  .vc .cap b{font-size:52px;font-weight:850;letter-spacing:-.04em;color:#aebbd0}
  .vc .cap b.ac{color:${C.accent}}
  .vc .col{flex:1;display:flex;align-items:flex-end;margin-top:16px;padding-bottom:26px}
  .vc .col i{display:block;width:100%;border-radius:14px 14px 6px 6px;transform-origin:bottom center}
  #co{height:${Math.round(100 * OLD_MAX / RENO_39B_CAP)}%;background:#2b3d5c}
  #cn{height:100%;background:linear-gradient(180deg,#8ab4f8,#3d7ef0);box-shadow:0 10px 30px rgba(21,96,212,.45)}
  .bars5{display:flex;gap:16px;margin-top:26px}
  .bars5 .b{flex:1;display:flex;flex-direction:column;align-items:center;gap:12px}
  .bars5 .c{width:100%;height:260px;display:flex;align-items:flex-end}
  .bars5 .f{width:100%;height:100%;border-radius:12px 12px 4px 4px;background:linear-gradient(180deg,#5f9bff,#1560d4);transform-origin:bottom center;
    box-shadow:0 10px 30px rgba(21,96,212,.45),inset 0 1px 0 rgba(255,255,255,.35);display:flex;justify-content:center;padding-top:18px}
  .bars5 .f span{font-size:24px;font-weight:750;color:#fff}
  .stack{display:flex;gap:6px;height:120px;margin-top:22px}
  .stack i{display:flex;align-items:flex-end;padding:14px;border-radius:12px;font-style:normal;transform-origin:left center}
  .stack i span{font-size:21px;font-weight:700;white-space:nowrap}
  .stack .sv{background:linear-gradient(180deg,#5f9bff,#1560d4)}
  .stack .sm{background:linear-gradient(180deg,#a9c8ff,#6fa3ff);color:#08111f}
  .stack .sx{background:repeating-linear-gradient(135deg,rgba(240,110,110,.35) 0 10px,rgba(240,110,110,.12) 10px 20px);border:2px dashed ${TONE.rd};color:${TONE.rd}}
  .ruleline{margin-top:14px;font-family:'Roboto Mono',monospace;font-size:18px;color:#9aa8bd}
  .res{display:flex;align-items:baseline;gap:16px;flex-wrap:wrap;margin-top:22px;padding-top:20px;border-top:1px solid rgba(255,255,255,.1)}
  .res span{font-size:24px;color:#aebbd0}
  .res b{font-size:72px;font-weight:850;letter-spacing:-.045em;color:${C.accent}}
  .cal{position:absolute;left:290px;top:620px;width:500px;height:400px;border-radius:30px;overflow:hidden;
    background:linear-gradient(180deg,#f6f7fa,#e3e8ef);box-shadow:0 50px 100px rgba(0,0,0,.6);color:#1a2332}
  .cal-h{display:flex;justify-content:space-between;padding:22px 30px;background:#1a2c48;color:#e9eef6;font-family:'Roboto Mono',monospace;font-size:26px;letter-spacing:.14em}
  .cal-d{font-size:230px;font-weight:850;letter-spacing:-.06em;text-align:center;line-height:1.1}
  .cal-rings{position:absolute;left:0;right:0;top:-14px;display:flex;justify-content:space-around}
  .cal-rings i{width:18px;height:40px;border-radius:9px;background:#3a465c}`;

const JS = `
    // ── 1 · Το λάθος: η σφραγίδα «ΟΧΙ ΠΙΑ.» ──────────────────────────────
    u = scene(0);
    { const e = $('e0'), v = eo(p(t, .05, .5)); op(e, v); tf(e, 'translateX(' + (-24 * (1 - v)) + 'px)'); }
    [.12, .26, .42].forEach((s, k) => rev('q' + k, s, null, .55));
    { const sp = p(t, 1.15, 1.35), sv = ei(sp); op($('stp'), sp > 0 ? 1 : 0);
      const sh = t > 1.35 ? Math.exp(-(t - 1.35) * 12) * Math.sin((t - 1.35) * 70) * 8 : 0;
      tf($('stp'), 'translate(' + sh + 'px,' + (sh * .4) + 'px) rotate(-7deg) scale(' + (2.2 - 1.2 * sv) + ')'); }
    { const v = eo(p(t, 1.9, 2.4)); op($('c0'), v); tf($('c0'), 'translateY(' + (24 * (1 - v)) + 'px)'); }

    // ── 2 · Τότε και τώρα ────────────────────────────────────────────────
    u = scene(1); heads(1);
    rise('vo', u, .4, .7, 60); rise('vn', u, .6, .7, 60);
    tf($('co'), 'scaleY(' + spring(p(u, 1.1, 1.9)) + ')');
    tf($('cn'), 'scaleY(' + spring(p(u, 1.5, 2.4)) + ')');
    op($('src1'), eo(p(u, 2.6, 3.0)));

    // ── 3 · Ισόποσα στα έτη ──────────────────────────────────────────────
    u = scene(2); heads(2);
    rise('yr', u, .35, .7, 50);
    for (let k = 0; k < D.years; k++) tf($('yf' + k), 'scaleY(' + spring(p(u, .8 + k * .14, 1.6 + k * .14)) + ')');
    { const v = eo(p(u, 2.2, 2.7)); op($('c2'), v); tf($('c2'), 'translateY(' + (24 * (1 - v)) + 'px)'); }

    // ── 4 · Οι όροι ──────────────────────────────────────────────────────
    u = scene(3); heads(3);
    rise('cd', u, .35, .7, 50);
    for (let k = 0; k < 5; k++) {
      slide('w' + k, u, k < 4 ? .7 + k * .3 : 2.1);
      if (k === 4) { const sh = u > 2.45 ? Math.exp(-(u - 2.45) * 9) * Math.sin((u - 2.45) * 60) * 9 : 0; tf($('w4'), 'translateX(' + sh + 'px)'); }
    }

    // ── 5 · Το παράδειγμα: τα υλικά πάνω από το όριο κόβονται ────────────
    u = scene(4); heads(4);
    rise('ex', u, .4, .7, 50);
    tf($('stk'), 'scaleX(' + eio(p(u, .8, 1.6)) + ')'); $('stk').style.transformOrigin = 'left center';
    { const v = p(u, 2.0, 2.5); const sh = u > 2.0 && u < 2.6 ? Math.sin((u - 2.0) * 50) * 4 * (1 - v) : 0;
      tf($('sx'), 'translateX(' + sh + 'px)'); op($('sx'), 1 - .45 * eo(p(u, 2.3, 2.7))); }
    rise('res', u, 2.6, .7, 30);
    { const v = eo(p(u, 3.3, 3.8)); op($('c4'), v); }

    // ── 6 · Η προθεσμία ──────────────────────────────────────────────────
    u = scene(5); heads(5);
    { const v = spring(p(u, .3, 1.1)); op($('cal'), cl(v * 1.6)); tf($('cal'), 'translateY(' + (80 * (1 - v)) + 'px) rotate(' + (-2 * (1 - v)) + 'deg)'); }
    { const v = eo(p(u, 1.4, 1.9)); op($('c5'), v); tf($('c5'), 'translateY(' + (24 * (1 - v)) + 'px)'); }
    { const v = eo(p(u, 2.2, 2.7)); op($('c5b'), v); tf($('c5b'), 'translateY(' + (24 * (1 - v)) + 'px)'); }`;

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
  data: { years: RENO_39B_YEARS },
  sound: m => {
    [.12, .26, .42].forEach((s, k) => m.click(s, 2400 + k * 200, .07, (k - 1) * .2));
    m.boom(1.35, .26); m.clap(1.35, .12); m.click(1.35, 500, .2);
    m.whoosh(SC[1] - 1.1, 1.1, .1, true);
    m.pluck(SC[1] + 1.2, 69, .04, -.3, .4); m.pluck(SC[1] + 1.6, 81, .06, .3, .5); m.bell(SC[1] + 1.7, 88, .03, .3);
    for (let k = 0; k < RENO_39B_YEARS; k++) m.pluck(SC[2] + .96 + k * .14, [77, 81, 84, 88, 89][k], .045, (k - 2) * .2, .5);
    for (let k = 0; k < 4; k++) m.pluck(SC[3] + .8 + k * .3, [84, 86, 88, 91][k], .04, .2, .4);
    m.pluck(SC[3] + 2.2, 61, .06, 0, .3); m.pluck(SC[3] + 2.21, 62, .05, 0, .3);
    m.sweep(SC[4] + .8, .8, 600, 1800, .02);
    m.pluck(SC[4] + 2.0, 61, .05, .2, .3); m.click(SC[4] + 2.0, 700, .1);
    m.pluck(SC[4] + 2.7, 88, .06, 0, .5); m.bell(SC[4] + 2.75, 93, .03);
    m.whoosh(SC[5] + .3, .8, .05, true); m.bell(SC[5] + 1.1, 89, .04);
  },
  checkAt: [SC[1] - .3, SC[2] - .3, SC[3] - .3, SC[4] - .3, SC[5] - .3, END - .3, DUR - .2],
  cover: SC[1] - .45,
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
