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
  #bloom{position:absolute;left:50%;top:860px;width:1300px;height:1300px;margin:-650px 0 0 -650px;border-radius:50%;
    background:radial-gradient(closest-side, ${C.accent}44, transparent);opacity:0}`;

/** Γραμμή ελέγχου: ✓ ή ×, κείμενο και προαιρετική δεύτερη γραμμή. */
export const check = (id: string, ok: boolean, text: string, small = '') =>
  `<div class="ck" id="${id}"><div class="dt" style="background:${ok ? 'rgba(82,199,158,.16)' : 'rgba(240,110,110,.16)'}">${ok
    ? `<i style="display:block;width:12px;height:22px;margin-bottom:6px;border:solid ${TONE.ok};border-width:0 4px 4px 0;transform:rotate(45deg)"></i>`
    : `<span style="color:${TONE.rd};font-size:30px;font-weight:800;line-height:1">×</span>`}</div>
    <div class="tx" style="color:${ok ? C.ink : '#ffb3b3'}">${esc(text)}${small ? `<small>${esc(small)}</small>` : ''}</div></div>`;

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
