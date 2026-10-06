// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ REELS-ΟΔΗΓΟΙ: ΤΟ ΚΑΔΡΟ, ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// Ένα reel-οδηγός λέει ένα θέμα ενός οδηγού του site σε λιγότερο από ένα
// λεπτό: ερώτηση, κανόνας, πότε, πόσο, τι κάνεις, μάρκα. Το ύφος είναι αυτό
// του reel «Πώς ξεκίνησε» (reelOrigin.ts), που ο ιδιοκτήτης ενέκρινε: ίδια
// κεφαλίδα και πρόοδος, ίδια περάσματα σκηνών, ίδιες κάρτες και ετικέτες.
// Γραμμένο σε κάθε reel χωριστά, θα απομακρυνόταν στην πρώτη αλλαγή.
//
// Κάθε reel δίνει: τις σκηνές (HTML και την κίνησή τους μέσα στη render), το
// CSS τους και τις στιγμές του ήχου. Το κάδρο κάνει τα υπόλοιπα: κεφαλίδα,
// πρόοδο, σκόνη, περάσματα, μάρκα, μουσική, έλεγχο ζωνών, λήψη, μίξη.
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { C, esc, mark } from './igKit';
import { BASE_CSS, BG_JS, MOTION_JS, mask, shoot } from './reelKit';
import { Mix, ch, mux } from './synth';

export const BEAT = 0.6;
export const TAGLINE = 'Βάλε το ακίνητό σου σε τάξη.';
export const TONE = { wa: '#f0c97d', rd: '#ff8f8f', ok: '#5fd4a8', bl: '#9ec0ff' } as const;

/** Κεφαλίδα σκηνής: μάτι και τίτλος, κάθε γραμμή από τη δική της μάσκα. */
export const head = (i: number, eyebrow: string, lines: string[], size: number, top = 360) => `
    <div class="L eb mono" id="e${i}" style="top:${top - 40}px"><i></i>${esc(eyebrow)}</div>
    <div class="L hd" style="top:${top}px;font-size:${size}px">${lines.map((l, k) => mask(`h${i}_${k}`, l)).join('')}</div>`;
/** Γραμμή με την κλίση της μάρκας. */
export const A = (s: string) => `<span class="a">${esc(s)}</span>`;

export const KIT_CSS = `
  .eb{font-size:22px;color:${C.accent};display:flex;align-items:center;gap:16px;letter-spacing:.22em}
  .eb i{display:block;width:40px;height:2px;background:${C.accent}}
  .hd{font-weight:800;letter-spacing:-.045em;line-height:1.0;white-space:nowrap}
  .a{background:linear-gradient(95deg,#a9c8ff 0%,#5f9bff 60%,#3d7ef0 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
  .sub{font-size:40px;font-weight:700;letter-spacing:-.02em;line-height:1.25}
  .sub2{font-size:34px;font-weight:500;letter-spacing:-.015em;line-height:1.35;color:#aebbd0}
  .sub2 b{color:${C.ink};font-weight:700}
  .lbl{font-family:'Roboto Mono',monospace;font-size:17px;letter-spacing:.16em;color:#7d8da6}
  .card{position:absolute;border-radius:28px;background:linear-gradient(180deg,rgba(28,44,72,.96),rgba(14,24,42,.97));border:1px solid rgba(255,255,255,.12);
    box-shadow:0 40px 90px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.12)}
  .pill{font-size:22px;font-weight:650;padding:9px 20px;border-radius:99px;white-space:nowrap;display:inline-flex;align-items:center;gap:10px}
  .pill:before{content:'';width:10px;height:10px;border-radius:50%;background:currentColor}
  .p-wa{color:${TONE.wa};background:rgba(229,192,123,.15)} .p-rd{color:${TONE.rd};background:rgba(240,110,110,.14)}
  .p-ok{color:${TONE.ok};background:rgba(82,199,158,.14)} .p-bl{color:${TONE.bl};background:rgba(138,180,248,.15)}
  .row{display:flex;align-items:center;justify-content:space-between;gap:18px}
  .src{font-family:'Roboto Mono',monospace;font-size:16px;line-height:1.5;color:#7d8da6;width:820px}
  .ck{display:flex;align-items:center;gap:20px;padding:16px 0;border-top:1px solid rgba(255,255,255,.08)}
  .ck:first-child{border-top:0}
  .ck .dt{flex:none;width:46px;height:46px;border-radius:50%;display:grid;place-items:center}
  .ck .tx{font-size:28px;font-weight:650;letter-spacing:-.015em;line-height:1.25}
  .ck .tx small{display:block;font-size:21px;font-weight:500;color:#9aa8bd;margin-top:4px}
  #top{position:absolute;left:90px;right:90px;top:262px;display:flex;align-items:center;justify-content:space-between}
  #top .br{display:flex;align-items:center;gap:14px;font-size:22px;font-weight:800;letter-spacing:.18em}
  #prog{display:flex;gap:8px}
  #prog i{display:block;width:34px;height:5px;border-radius:3px;background:#ffffff22;position:relative;overflow:hidden}
  #prog b{position:absolute;inset:0;background:${C.accent};transform-origin:left center;transform:scaleX(0);box-shadow:0 0 12px ${C.accent}}
  #dust i{position:absolute;border-radius:50%;background:#dbe7ff;filter:blur(1.2px)}
  .ctr{position:absolute;left:150px;right:150px;display:flex;justify-content:center;text-align:center}
  .word{font-size:96px;font-weight:800;letter-spacing:.02em}
  .tag{font-size:54px;font-weight:700;letter-spacing:-.03em}
  .rule{width:64px;height:3px;border-radius:3px;background:${C.accent}}
  .url{font-size:24px;color:${C.faint}}
  .ftg{position:absolute;left:90px;width:850px;display:grid;grid-template-columns:1fr 1fr;gap:20px}
  .ft{position:relative;height:250px;border-radius:28px;padding:26px 26px 22px;display:flex;flex-direction:column;justify-content:flex-end;gap:6px;
    background:radial-gradient(120% 90% at 0% 0%, rgba(138,180,248,.16), transparent 60%),linear-gradient(180deg,rgba(28,44,72,.96),rgba(14,24,42,.97));
    border:1px solid rgba(138,180,248,.22);box-shadow:0 40px 80px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.14)}
  .ft.no{background:radial-gradient(120% 90% at 0% 0%, rgba(240,110,110,.16), transparent 60%),linear-gradient(180deg,rgba(44,24,30,.96),rgba(24,14,20,.97));border-color:rgba(240,110,110,.3)}
  .ft .fi{position:absolute;left:24px;top:24px;width:84px;height:84px;border-radius:24px;display:grid;place-items:center;background:rgba(138,180,248,.14);border:1px solid rgba(138,180,248,.28)}
  .ft.no .fi{background:rgba(240,110,110,.12);border-color:rgba(240,110,110,.3)}
  .ft .fb{position:absolute;right:22px;top:22px;width:50px;height:50px;border-radius:50%;display:grid;place-items:center;font-size:28px;font-weight:850;
    background:${TONE.ok};color:#06251a;box-shadow:0 0 24px ${TONE.ok}88}
  .ft.no .fb{background:${TONE.rd};color:#2a0808;box-shadow:0 0 24px ${TONE.rd}88}
  .ft b{font-size:31px;font-weight:750;letter-spacing:-.02em;line-height:1.15}
  .ft small{font-size:20px;color:#9aa8bd;line-height:1.3}
  .wcal{position:absolute;width:500px;height:430px;perspective:1600px}
  .wcal .stackp{position:absolute;left:8px;right:8px;top:10px;bottom:-14px;border-radius:28px;background:#c3cad5;
    box-shadow:0 6px 0 #aab3c0,0 12px 0 #939dac,0 60px 110px rgba(0,0,0,.65)}
  .wcal .pg{position:absolute;inset:0;border-radius:28px;overflow:hidden;color:#1a2332;transform-origin:50% 0;backface-visibility:hidden;
    background:linear-gradient(180deg,#fdfdfe 0%,#eef1f5 70%,#e2e7ee 100%);box-shadow:inset 0 -2px 0 rgba(0,0,0,.06)}
  .wcal .pg .h{display:flex;justify-content:space-between;padding:26px 34px 22px;background:linear-gradient(180deg,#24406b,#1a2c48);color:#e9eef6;
    font-family:'Roboto Mono',monospace;font-size:26px;letter-spacing:.16em}
  .wcal .pg .d{font-size:220px;font-weight:850;letter-spacing:-.06em;text-align:center;line-height:1.05;margin-top:6px}
  .wcal .pg .w{font-family:'Roboto Mono',monospace;font-size:20px;letter-spacing:.3em;color:#6b7788;text-align:center}
  .wcal .pg .perf{position:absolute;left:0;right:0;top:78px;height:10px;background:radial-gradient(circle,#c8d0db 2.5px,transparent 3px) 0 0/18px 10px}
  .wcal .mark{position:absolute;left:30px;top:84px;width:440px;height:300px;overflow:visible;pointer-events:none}
  .wcal .mark path{fill:none;stroke:${TONE.rd};stroke-width:8;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;filter:drop-shadow(0 2px 0 rgba(0,0,0,.15))}
  .wcal .rings{position:absolute;left:0;right:0;top:-18px;display:flex;justify-content:space-around;z-index:5}
  .wcal .rings i{width:20px;height:48px;border-radius:10px;background:linear-gradient(90deg,#1e2634,#6b7688 45%,#2a3344);box-shadow:0 6px 10px rgba(0,0,0,.5)}
  #bloom{position:absolute;left:50%;top:860px;width:1300px;height:1300px;margin:-650px 0 0 -650px;border-radius:50%;
    background:radial-gradient(closest-side, ${C.accent}44, transparent);opacity:0}`;

/** Γραμμή ελέγχου: ✓ ή ×, κείμενο και προαιρετική δεύτερη γραμμή. */
export const check = (id: string, ok: boolean, text: string, small = '') =>
  `<div class="ck" id="${id}"><div class="dt" style="background:${ok ? 'rgba(82,199,158,.16)' : 'rgba(240,110,110,.16)'}">${ok
    ? `<i style="display:block;width:12px;height:22px;margin-bottom:6px;border:solid ${TONE.ok};border-width:0 4px 4px 0;transform:rotate(45deg)"></i>`
    : `<span style="color:${TONE.rd};font-size:30px;font-weight:800;line-height:1">×</span>`}</div>
    <div class="tx" style="color:${ok ? C.ink : '#ffb3b3'}">${esc(text)}${small ? `<small>${esc(small)}</small>` : ''}</div></div>`;

// ── Εικονίδια γραμμής, ίδιο πάχος παντού (κουτί 24×24) ─────────────────────
export const ICON = {
  bank: 'M3 21h18|M5 21V10|M19 21V10|M9 21v-7|M15 21v-7|M12 3l9 5H3z',
  transfer: 'M4 8h13|M13 4l4 4-4 4|M20 16H7|M11 12l-4 4 4 4',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  cash: 'M2 7h20v10H2z|M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6|M6 10v4|M18 10v4',
  card: 'M2 6h20v12H2z|M2 10h20|M6 15h4',
  invoice: 'M6 2h9l5 5v15H6z|M15 2v5h5|M9 12h7|M9 16h7|M9 8h3',
  pin: 'M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12|M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
  pie: 'M12 3a9 9 0 1 0 9 9h-9z|M15 2.5A9 9 0 0 1 21.5 9H15z',
  iban: 'M3 5h18v14H3z|M7 10h4|M7 14h10|M15 9.5h2',
  shield: 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z|M8.5 12l2.5 2.5 4.5-5',
  receipt: 'M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2z|M9 7h6|M9 11h6|M9 15h4',
};
export const icon = (d: string, c: string, px: number, sw = 1.8) =>
  `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${d.split('|').map(x => `<path d="${x}"/>`).join('')}</svg>`;

/** Πλακίδιο δυνατότητας: εικονίδιο, σήμα ✓ ή ×, τίτλος και μικρή γραμμή. */
export const tile = (id: string, ok: boolean, ic: string, title: string, small = '') => `
  <div class="ft${ok ? '' : ' no'}" id="${id}">
    <span class="fi">${icon(ic, ok ? '#cfe0ff' : '#ffb3b3', 46, 1.7)}</span>
    <span class="fb" id="${id}b">${ok ? '✓' : '×'}</span>
    <b>${esc(title)}</b>${small ? `<small>${esc(small)}</small>` : ''}
  </div>`;

/** Ημερολόγιο τοίχου που ξεσκίζεται σελίδα σελίδα· οι σελίδες στο D.cal[id]. */
export const calendar = (id: string, left: number, top: number) => `
  <div class="wcal deco" id="${id}" style="left:${left}px;top:${top}px">
    <div class="stackp"></div>
    <div class="pg" id="${id}b"></div><div class="pg" id="${id}a"></div>
    <svg class="mark" viewBox="0 0 440 300"><path id="${id}m" pathLength="1" d="M96 52 C 190 -6, 420 18, 424 146 C 428 268, 150 296, 44 214 C -14 168, 18 76, 150 34"/></svg>
    <div class="rings"><i></i><i></i></div>
  </div>`;
const WEEK = ['ΚΥΡΙΑΚΗ', 'ΔΕΥΤΕΡΑ', 'ΤΡΙΤΗ', 'ΤΕΤΑΡΤΗ', 'ΠΕΜΠΤΗ', 'ΠΑΡΑΣΚΕΥΗ', 'ΣΑΒΒΑΤΟ'];
const MONTH = ['ΙΑΝΟΥΑΡΙΟΣ', 'ΦΕΒΡΟΥΑΡΙΟΣ', 'ΜΑΡΤΙΟΣ', 'ΑΠΡΙΛΙΟΣ', 'ΜΑΪΟΣ', 'ΙΟΥΝΙΟΣ', 'ΙΟΥΛΙΟΣ', 'ΑΥΓΟΥΣΤΟΣ', 'ΣΕΠΤΕΜΒΡΙΟΣ', 'ΟΚΤΩΒΡΙΟΣ', 'ΝΟΕΜΒΡΙΟΣ', 'ΔΕΚΕΜΒΡΙΟΣ'];
/** Οι σελίδες για τις ημερομηνίες ISO που δίνονται: μήνας, έτος, μέρα, ημέρα εβδομάδας. */
export const calPages = (isos: string[]) => isos.map(iso => {
  const d = new Date(`${iso}T12:00:00Z`);
  return { m: MONTH[d.getUTCMonth()], y: String(d.getUTCFullYear()), d: String(d.getUTCDate()), w: WEEK[d.getUTCDay()] };
});

export interface Explainer {
  /** Φάκελος και όνομα: docs/marketing/reels/<slug>/ και docs/marketing/instagram/<slug>/. */
  slug: string;
  file: string;
  /** Οι αρχές των σκηνών (η πρώτη 0) και η αρχή της μάρκας. */
  scenes: number[];
  end: number;
  dur: number;
  /** Οι σκηνές, με id s0, s1, … και κεφαλίδες h<i>_<k>. */
  html: string;
  css: string;
  /** Πόσες γραμμές έχει ο τίτλος κάθε σκηνής (για τις μάσκες). */
  heads: number[];
  /** Η κίνηση των σκηνών: σώμα μέσα στη render(t), με τα u = scene(...) έτοιμα. */
  js: string;
  /** Δεδομένα που θέλει η κίνηση, ως D.x. */
  data?: Record<string, unknown>;
  /** Οι στιγμές του ήχου πάνω στο κοινό χαλί. */
  sound: (m: Mix) => void;
  checkAt: number[];
  cover: number;
  /** Στιγμές για τα stories: το τέλος κάθε σκηνής, όταν όλα έχουν μπει. */
  stills: number[];
  caption: string;
  readme: string;
}

function page(x: Explainer): string {
  const D = { S: x.scenes, END: x.end, heads: x.heads, ...(x.data ?? {}) };
  return `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${BASE_CSS}${KIT_CSS}${x.css}</style></head><body>
  <div id="bg"></div>
  <div id="dust" class="deco">${Array.from({ length: 22 }, (_, k) => `<i id="d${k}"></i>`).join('')}</div>
  <div id="top"><div class="br">${mark(34, C.ink)}<span>PROPERWISE</span></div><div id="prog">${x.scenes.map((_, k) => `<i><b id="pb${k}"></b></i>`).join('')}</div></div>
  ${x.html}
  <section id="EN">
    <div id="bloom" class="deco"></div>
    <div class="ctr" id="m0" style="top:600px">${mark(150, C.ink)}</div>
    <div class="ctr" style="top:802px">${mask('m1', 'PROPERWISE', 'word')}</div>
    <div class="ctr" id="m2" style="top:945px"><span class="rule"></span></div>
    <div class="ctr" style="top:988px">${mask('m3', esc(TAGLINE), 'tag')}</div>
    <div class="ctr mono url" id="m4" style="top:1082px;color:${C.muted}">ΓΙΑ ΚΑΘΕ ΙΔΙΟΚΤΗΤΗ ΑΚΙΝΗΤΟΥ ΣΤΗΝ ΕΛΛΑΔΑ</div>
    <div class="ctr mono url" id="m5" style="top:1170px">PROPERWISE.GR</div>
  </section>
  <div class="vig"></div><div class="grain"></div>
  <script>
  const D = ${JSON.stringify(D)};
  const S = D.S;
  ${MOTION_JS}
  ${BG_JS}
  const ends = [...S.slice(1), D.END];
  // Πέρασμα σκηνής: η παλιά απομακρύνεται και θολώνει, η νέα έρχεται από
  // λίγο πιο κοντά και καθαρίζει. Επικάλυψη ενός δεκάτου: κανένα μαύρο καρέ.
  const scene = (k) => {
    const el = $('s' + k), a = k ? S[k] : -1, b = ends[k];
    const i = eo(p(T, a - .12, a + .42)), o = ei(p(T, b - .32, b + .02));
    const on = T >= a - .12 && T < b + .02;
    op(el, on ? i * (1 - o) : 0);
    if (!on) return T - S[k];
    const push = p(T, a, b);
    el.style.transformOrigin = '540px 900px';
    tf(el, 'scale(' + ((1.05 - .05 * i) * (1 - .04 * o) * (1 + .012 * push)) + ')');
    const bl = (1 - i) * 10 + o * 8;
    el.style.filter = bl > .05 ? 'blur(' + bl.toFixed(2) + 'px)' : 'none';
    return T - S[k];
  };
  const heads = (k) => {
    const a = S[k], e = $('e' + k), v = eo(p(T, a + .02, a + .45));
    if (e) { op(e, v); tf(e, 'translateX(' + (-24 * (1 - v)) + 'px)'); }
    for (let j = 0; j < D.heads[k]; j++) rev('h' + k + '_' + j, a + .1 + j * .11, null, .6);
  };
  /** Μπαίνει από κάτω με ελατήριο. */
  const rise = (id, u, s, d, dy) => { const v = spring(p(u, s, s + (d || .7))); op($(id), cl(v * 1.8)); tf($(id), 'translateY(' + ((dy == null ? 60 : dy) * (1 - v)) + 'px)'); return v; };
  /** Μπαίνει από αριστερά, ήπια. */
  const slide = (id, u, s, d) => { const v = eo(p(u, s, s + (d || .45))); op($(id), v); tf($(id), 'translateX(' + (30 * (1 - v)) + 'px)'); return v; };
  /** Σκάει με ελατήριο (σφραγίδα, ετικέτα). */
  const pop = (id, u, s, d) => { const v = spring(p(u, s, s + (d || .6))); op($(id), cl(v * 2)); tf($(id), 'scale(' + (.4 + .6 * v) + ')'); return v; };

  /** Το ημερολόγιο: ξεσκίζει σελίδες από s ως e, σημαδεύει την τελευταία από το mk. */
  const calSet = (el, pg) => { const k = pg.m + pg.y + pg.d; if (el.dataset.k === k) return; el.dataset.k = k;
    el.innerHTML = '<div class="h"><span>' + pg.m + '</span><span>' + pg.y + '</span></div><div class="perf"></div><div class="d">' + pg.d + '</div><div class="w">' + pg.w + '</div>'; };
  const cal = (id, u, s, e, mk) => {
    const P = D.cal[id], N = P.length, g = N > 1 ? eio(p(u, s, e)) * (N - 1) : 0;
    const k = Math.min(N - 1, Math.floor(g + 1e-6)), f = k >= N - 1 ? 0 : eio(cl((g - k) * 1.3));
    calSet($(id + 'a'), P[k]); calSet($(id + 'b'), P[Math.min(N - 1, k + 1)]);
    tf($(id + 'a'), 'rotateX(' + (f * 118) + 'deg) translateY(' + (-f * 30) + 'px)');
    op($(id + 'a'), 1 - cl((f - .55) / .45));
    const m = eio(p(u, mk, mk + .7)); const path = $(id + 'm'); path.style.strokeDashoffset = 1 - m; op(path, m > 0 ? 1 : 0);
    return k;
  };

  window.render = t => {
    T = t;
    bgPaint(t);
    for (let k = 0; k < 22; k++) {
      const d = $('d' + k), z = .4 + (k * 37 % 10) / 10, sz = 2 + z * 4;
      const x = (k * 173 % 1000) + 40 + Math.sin(t * .3 * z + k) * 40;
      const y = ((k * 251 % 1500) + 300 - t * 14 * z + 3000) % 1500 + 260;
      d.style.width = d.style.height = sz + 'px';
      tf(d, 'translate(' + x + 'px,' + y + 'px)');
      op(d, (.10 + .22 * z) * (.6 + .4 * Math.sin(t * 1.3 + k * 2)));
    }
    op($('top'), eo(p(t, .1, .6)) * (1 - eo(p(t, D.END - .3, D.END + .2))));
    S.forEach((s, k) => tf($('pb' + k), 'scaleX(' + p(t, s, ends[k]) + ')'));
    let u = 0;
    ${x.js}
    op($('EN'), eo(p(t, D.END - .1, D.END + .25)));
    const m0 = spring(p(t, D.END, D.END + 1.1));
    op($('m0'), cl(m0 * 1.5)); tf($('m0'), 'scale(' + (.5 + .5 * m0) + ')');
    op($('bloom'), .8 * eo(p(t, D.END, D.END + 1.4)));
    rev('m1', D.END + .3, null, .7); rev('m3', D.END + .8, null, .8);
    const q2 = eo(p(t, D.END + .55, D.END + 1.2)); op($('m2'), q2); tf($('m2'), 'scaleX(' + q2 + ')');
    op($('m4'), eo(p(t, D.END + .9, D.END + 1.3)));
    op($('m5'), eo(p(t, D.END + 1.1, D.END + 1.5)));
  };
  </script></body></html>`;
}

/** Το κοινό χαλί: πατάκι, μπάσο, ρυθμός από τη δεύτερη σκηνή ως τη μάρκα. */
function score(x: Explainer): Mix {
  const m = new Mix(x.dur), BAR = 4 * BEAT, S = x.scenes;
  const PROG = [ch('D3', 'A3', 'C4', 'F4'), ch('A#2', 'F3', 'A3', 'D4'), ch('F2', 'C3', 'A3', 'E4'), ch('C3', 'G3', 'A#3', 'E4')];
  const chords: [number, number[]][] = [[0, PROG[0]]];
  for (let t = S[1], i = 0; t < x.end - .01; t += BAR, i++) chords.push([t, PROG[i % 4]]);
  chords.push([x.end, ch('F2', 'C3', 'A3', 'E4', 'G4')]);
  m.pad(chords, .022);
  m.bass(chords, S[1], x.end);
  const kicks: number[] = [];
  for (let t = S[1], i = 0; t < x.end - .01; t += BEAT, i++) { kicks.push(t); if (i % 2 === 1) m.clap(t, .07); }
  for (let t = S[1] + BEAT / 2; t < x.end - .01; t += BEAT / 2) m.hat(t, (Math.round(t / (BEAT / 2)) % 2 ? .026 : .036));
  kicks.forEach(k => m.kick(k, .85));
  m.duck(kicks, .3);
  S.slice(1).forEach((s, i) => { m.whoosh(s - .35, .5, .06, true); m.pluck(s + .05, [81, 77, 84, 79, 81, 86, 84][i % 7], .045, 0, .5); });
  x.sound(m);
  m.whoosh(x.end - .7, .7, .1, true);
  m.boom(x.end, .24);
  ch('F5', 'A5', 'C6', 'E6', 'A6').forEach((n, i) => m.bell(x.end + .05 + i * .07, n, .05, (i - 2) * .22));
  m.bell(x.end + .8, 77, .035);
  m.reverb();
  return m;
}

export async function make(x: Explainer): Promise<void> {
  const ROOT = process.cwd();
  const outVideo = join(ROOT, 'docs/marketing/reels', x.slug);
  const outDoc = join(ROOT, 'docs/marketing/instagram', x.slug);
  mkdirSync(outDoc, { recursive: true });
  const html = page(x);
  await shoot({
    html, dur: x.dur, outDir: outVideo, file: 'reel.mp4', shutter: 2, checkAt: x.checkAt,
    cover: { t: x.cover, path: join(outDoc, 'cover.jpg') },
  });
  if (process.env.REEL_PREVIEW) return;
  // Τα stories: ένα ακίνητο καρέ στο τέλος κάθε σκηνής, από την ίδια σελίδα.
  await shoot({ html, dur: x.dur, outDir: join(outVideo, 'stories'), file: 'unused.mp4', checkAt: [], stills: x.stills });
  const wav = join(outVideo, 'sound.wav');
  score(x).write(wav, 1.8);
  mux(join(outVideo, 'reel.mp4'), wav, join(outVideo, x.file));
  writeFileSync(join(outDoc, 'caption.md'), x.caption + '\n');
  writeFileSync(join(outDoc, 'README.md'), x.readme + '\n');
  console.log(`✓ ${join(outVideo, x.file)}`);
}
