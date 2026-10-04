// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ REELS ΤΩΝ ΣΕΙΡΩΝ
// ─────────────────────────────────────────────────────────────────────────
// ΧΡΗΣΗ:  npx tsx scripts/marketing/reelSeires.ts [vraxy|foroi|makro]
// Θέλει ffmpeg με libx264 (FFMPEG ή PATH). REEL_PREVIEW=0.5,4,11 βγάζει μόνο
// στιγμιότυπα, για να κριθεί η σύνθεση πριν από τα καρέ.
//
// Ένα reel ανά σειρά, από τα ΙΔΙΑ δεδομένα με τα stories (seiresData.ts):
// κανένα ψηφίο γραμμένο εδώ. Το βίντεο πάει στο docs/marketing/reels/ (έξω
// από το git)· εξώφυλλο, λεζάντα και οδηγίες στο docs/marketing/instagram/
// seires/<επεισόδιο>/reel/.
//
// ΟΙ ΚΑΝΟΝΕΣ ΤΟΥ REEL, ΟΠΩΣ ΤΟΥΣ ΑΝΤΑΜΕΙΒΕΙ ΤΟ INSTAGRAM.
//   · Αγκίστρι στο πρώτο δευτερόλεπτο: η ερώτηση χτυπά στην οθόνη στο 0.
//   · Διαβάζεται χωρίς ήχο: κάθε φράση είναι γραμμένη, τίποτα δεν λέγεται.
//   · 16 ώς 22 δευτερόλεπτα: αρκετά για ένα γράφημα, λίγα για να τελειώσει.
//   · Το τέλος δένει με την αρχή (ίδιο έδαφος), ώστε η επανάληψη να μη σκάει.
//   · Ζώνες: πάνω ο λογαριασμός, κάτω η λεζάντα, κάτω δεξιά τα κουμπιά. Ο
//     έλεγχος του reelKit το επιβάλλει.
//   · Πρωτότυπη μουσική (synth.ts), στο ίδιο πλέγμα με την εικόνα: 120 χτύποι
//     το λεπτό, κάθε κόψιμο σε χτύπο. Κανένα κομμάτι τρίτου.
//
// Η ΣΕΛΙΔΑ ΔΕΝ ΚΙΝΕΙΤΑΙ ΜΟΝΗ ΤΗΣ. Η `render(t)` διαβάζει από κάθε στοιχείο
// πότε μπαίνει και πώς (data-a), πότε ξεκολλά (data-peel), τι μετρά
// (data-seg), τι σχεδιάζει (data-draw) και στήνει τη στιγμή t.
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { esc, mark, ico } from './igKit';
import { BASE_CSS, BG_JS, MOTION_JS, shoot } from './reelKit';
import { Mix, ch, n, mux } from './synth';
import { SERIES, glyph, type SeriesKey } from './seiresKit';
import { PUBLISH, elDate, svlInput, vraxyFacts, makroFacts, foroiFacts, OCC_STEPS } from './seiresData';
import { feWhole, fe, fpRate } from '../../lib/core/format';
import { ASSISTANT_INITIAL, ASSISTANT_NAME } from '../../lib/assistant/identity';

const ROOT = process.cwd();
const BEAT = 0.5;
const S = SERIES.vraxy; // τα χρώματα είναι της μάρκας και ίδια σε κάθε σειρά
const pc = (x: number) => `${Math.round(x * 100) / 100}%`;
const up = (s: string) => s.toLocaleUpperCase('el').normalize('NFD').replace(/[́̈]/g, '').normalize('NFC');
const utm = (path: string, campaign: string) => `https://properwise.gr${path}?utm_source=instagram&utm_medium=reel&utm_campaign=${campaign}`;

/** Μετρητής: βήματα γραμμένα εδώ από τον μορφοποιητή της εφαρμογής, ανά τμήμα χρόνου. */
type Seg = { a: number; b: number; s: string[] };
const seg = (a: number, b: number, from: number, to: number, fmt: (x: number) => string = feWhole): Seg =>
  ({ a, b, s: Array.from({ length: 31 }, (_, k) => (k === 30 ? fmt(to) : fmt(Math.round(from + (to - from) * k / 30)))) });
const counter = (segs: Seg[], cls = '') => {
  const json = JSON.stringify(segs);
  if (json.includes("'")) throw new Error('Ο μετρητής έχει απόστροφο.');
  return `<span class="ct ${cls}" data-seg='${json}'>${esc(segs[0].s[0])}</span>`;
};
const A = (type: string, t: number, dur = 0.6) => `data-a="${type},${t},${dur}"`;

// ═══ Η ΜΗΧΑΝΗ ΤΗΣ ΣΕΛΙΔΑΣ ═══════════════════════════════════════════════
const ENGINE_JS = `
  ${MOTION_JS}
  ${BG_JS}
  const secs = Array.from(document.querySelectorAll('section'));
  const ins = Array.from(document.querySelectorAll('[data-a]')).map(el => { const [type, t0, d] = el.dataset.a.split(','); return { el, type, t0: +t0, d: +d }; });
  const peels = Array.from(document.querySelectorAll('[data-peel]'));
  const cts = Array.from(document.querySelectorAll('[data-seg]')).map(el => ({ el, segs: JSON.parse(el.dataset.seg) }));
  const draws = Array.from(document.querySelectorAll('[data-draw]'));
  const pulses = Array.from(document.querySelectorAll('[data-pulse]'));
  window.render = t => {
    T = t; bgPaint(t);
    for (const sec of secs) {
      const a = +sec.dataset.in, b = +sec.dataset.out, tin = sec.dataset.tin || 'cut', tout = sec.dataset.tout || 'cut';
      if (t < a || t >= b) { op(sec, 0); continue; }
      const qi = tin === 'cut' ? 1 : eo(p(t, a, a + .45)), qo = tout === 'cut' ? 0 : ei(p(t, b - .42, b));
      let y = 0, s = 1, o = 1, bl = 0;
      if (tin === 'whip') { y += (1 - qi) * 520; bl += (1 - qi) * 26; }
      if (tin === 'zoom') { s *= 1.3 - .3 * qi; bl += (1 - qi) * 20; o *= qi; }
      if (tin === 'fade') o *= qi;
      if (tout === 'whip') { y -= qo * 520; bl += qo * 26; }
      if (tout === 'zoom') { s *= 1 + qo * .4; bl += qo * 20; o *= 1 - qo; }
      if (tout === 'fade') o *= 1 - qo;
      tf(sec, 'translateY(' + y + 'px) scale(' + s + ')'); sec.style.filter = bl > .4 ? 'blur(' + bl + 'px)' : 'none'; op(sec, o);
    }
    for (const { el, type, t0, d } of ins) {
      const k = cl((t - t0) / d), e = eo(k);
      if (type === 'up') { tf(el, 'translateY(' + (1 - e) * 80 + 'px)'); op(el, cl(k * 2.2)); }
      else if (type === 'mask') { tf(el, 'translateY(' + (1 - e) * 112 + '%)'); op(el, k > 0 ? 1 : 0); }
      else if (type === 'slam') { tf(el, 'scale(' + (1.55 - .55 * spring(k * 1.15)) + ')'); el.style.filter = k < .5 ? 'blur(' + (1 - k * 2) * 16 + 'px)' : 'none'; op(el, cl(k * 3)); }
      else if (type === 'left') { tf(el, 'translateX(' + (-(1 - e) * 130) + '%)'); op(el, cl(k * 2)); }
      else if (type === 'right') { tf(el, 'translateX(' + (1 - e) * 130 + '%)'); op(el, cl(k * 2)); }
      else if (type === 'pop') { tf(el, 'scale(' + (.35 + .65 * spring(k)) + ')'); op(el, cl(k * 3)); }
      else if (type === 'fade') op(el, e);
      else if (type === 'dim') op(el, 1 - .62 * e);
      else if (type === 'grow') tf(el, 'scaleX(' + e + ')');
      else if (type === 'thump') { tf(el, 'rotate(-4deg) scale(' + (2.1 - 1.1 * spring(k * 1.1)) + ')'); op(el, cl(k * 3)); }
    }
    for (const el of peels) {
      const t0 = +el.dataset.peel, q = eio(p(t, t0, t0 + .7));
      el.style.flexGrow = String(+el.dataset.v * (1 - eo(p(t, t0 + .35, t0 + 1))));
      tf(el, 'translateY(' + q * 340 + 'px) rotate(' + q * 10 + 'deg)'); op(el, 1 - q);
    }
    for (const { el, segs } of cts) {
      let txt = segs[0].s[0];
      for (const g of segs) if (t >= g.a) { const k = eio(p(t, g.a, g.b)); txt = g.s[Math.round(k * (g.s.length - 1))]; }
      if (el.textContent !== txt) el.textContent = txt;
    }
    for (const el of draws) {
      const [a, b] = el.dataset.draw.split(',').map(Number), k = eio(p(t, a, b));
      el.style.strokeDashoffset = String(1 - k);
      const head = el.dataset.head ? $(el.dataset.head) : null;
      if (head) { const L = el.getTotalLength(), pt = el.getPointAtLength(L * k); head.setAttribute('cx', pt.x); head.setAttribute('cy', pt.y); op(head, k > 0 && k < 1 ? 1 : 0); }
    }
    for (const el of pulses) {
      const a = +el.dataset.pulse, k = p(t, a, a + 1.3);
      tf(el, 'scale(' + (1 + k * 2.6) + ')'); op(el, k > 0 && k < 1 ? (1 - k) * .85 : 0);
    }
  };`;

const PAGE_CSS = `${BASE_CSS}
  section{will-change:transform,filter,opacity}
  .stamp{position:absolute;left:90px;top:290px;display:flex;align-items:center;gap:16px;font-family:'Roboto Mono',monospace;font-size:24px;letter-spacing:.16em;font-weight:600}
  .stamp i{display:flex;align-items:center;justify-content:center;width:50px;height:50px;border-radius:15px;background:${S.accent}1f;border:1.5px solid ${S.accent}55}
  .stamp span{color:${S.faint};margin-left:10px}
  .h1,.h2{font-weight:850;letter-spacing:-.05em;line-height:.94}
  .h1{font-size:150px}.h2{font-size:104px}.h3{font-size:72px;font-weight:800;letter-spacing:-.035em;line-height:1.02}
  .lead{font-size:42px;color:${S.muted};line-height:1.3;letter-spacing:-.012em;font-weight:500}
  .ok{color:${S.ok}}
  .glow{text-shadow:0 20px 100px currentColor}
  .card{background:linear-gradient(180deg,${S.lift}f2,${S.panel}f2);border:1.5px solid ${S.rule};border-radius:40px;box-shadow:0 1px 0 #ffffff10 inset,0 60px 140px -50px #000}
  .big{font-size:200px;font-weight:900;letter-spacing:-.065em;line-height:.9}
  .lbl{font-family:'Roboto Mono',monospace;font-size:24px;letter-spacing:.16em;color:${S.faint}}
  .bar{display:flex;gap:8px;height:120px;width:900px}
  .bar i{display:block;border-radius:14px;min-width:0;flex-basis:0;transform-origin:left center}
  .av{display:inline-flex;align-items:center;justify-content:center;border-radius:26%;background:${S.accent};color:${S.onAccent};font-weight:850;flex:none}
  .ask{position:absolute;right:90px;max-width:800px;padding:28px 36px;border-radius:40px 40px 12px 40px;background:${S.accent};color:${S.onAccent};font-size:42px;font-weight:700;line-height:1.22;letter-spacing:-.02em}
  .ans{position:absolute;left:90px;max-width:850px;padding:30px 36px;border-radius:40px 40px 40px 12px;background:${S.lift};border:1.5px solid ${S.rule};font-size:40px;line-height:1.32;color:${S.ink}}
  .typing{position:absolute;left:90px;display:flex;gap:12px;padding:34px 38px;border-radius:40px 40px 40px 12px;background:${S.lift};border:1.5px solid ${S.rule}}
  .typing b{width:16px;height:16px;border-radius:50%;background:${S.faint};display:block}
  .url{display:inline-flex;align-items:center;gap:14px;padding:22px 30px;border-radius:999px;background:${S.accent}1f;border:1.5px solid ${S.accent}66;font-size:34px;font-weight:700;color:${S.ink}}
  .url em{font-style:normal;color:${S.accent}}
  .pill{font-family:Inter;font-weight:800}`;

/** Η σφραγίδα της σειράς, πάνω αριστερά, σε κάθε σκηνή. */
const stamp = (k: SeriesKey, no: number, t: number) =>
  `<div class="stamp" ${A('fade', t, .5)}><i>${glyph(SERIES[k].glyph, S.accent, 28, 2)}</i>${esc(up(SERIES[k].name))}<span>#${String(no).padStart(2, '0')}</span></div>`;

/** Η κατάληξη, κοινή: η Νόα απαντά, μετά ο υπολογιστής και η μάρκα. */
function outro(k: SeriesKey, no: number, t0: number, t1: number, q: string, a: string, cta: string, path: string): string {
  return `<section data-in="${t0}" data-out="${t1}" data-tin="whip" data-tout="fade">
    ${stamp(k, no, t0)}
    <div class="L" style="top:400px;display:flex;align-items:center;gap:22px" ${A('up', t0 + .1)}><span class="av" style="width:76px;height:76px;font-size:40px">${esc(ASSISTANT_INITIAL)}</span><b style="font-size:40px;font-weight:800">${esc(ASSISTANT_NAME)}</b></div>
    <div class="ask" style="top:530px" ${A('up', t0 + .3)}>${esc(q)}</div>
    <div class="typing" style="top:${q.length > 34 ? 740 : 690}px" data-a="fade,${t0 + .8},.2" id="ty"><b></b><b></b><b></b></div>
    <div class="ans" style="top:${q.length > 34 ? 740 : 690}px" ${A('up', t0 + 1.5)}>${esc(a)}</div>
    <div class="L h3" style="top:1150px;width:840px" ${A('mask', t0 + 2.3, .7)}>${cta}</div>
    <div class="L" style="top:1330px" ${A('up', t0 + 2.8)}><span class="url">${ico.arrow(S.accent, 30)}<span>properwise.gr<em>${esc(path)}</em></span></span></div>
    <div class="L" style="top:1450px;display:flex;align-items:center;gap:16px" ${A('fade', t0 + 3.2, .5)}>${mark(44, S.ink)}<b style="font-size:30px;font-weight:850;letter-spacing:.03em">PROPERWISE</b></div>
  </section>`;
}
/** Οι τελείες της Νόας χορεύουν όσο «γράφει» και σβήνουν όταν φτάνει η απάντηση. */
const typingJS = (t0: number) => `
  const _r = window.render; window.render = t => { _r(t);
    const ty = $('ty'); if (!ty) return;
    const on = t >= ${t0 + .8} && t < ${t0 + 1.5};
    op(ty, on ? 1 : 0);
    Array.from(ty.children).forEach((d, i) => tf(d, 'translateY(' + (-12 * Math.max(0, Math.sin((t * 7) - i * .8))) + 'px)'));
  };`;

function page(sections: string, extraCss = '', extraJs = ''): string {
  return `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${PAGE_CSS}${extraCss}</style></head><body>
  <div id="bg"></div>${sections}<div class="grain"></div><div class="vig"></div>
  <script>${ENGINE_JS}${extraJs}</script></body></html>`;
}

/** Ο ρυθμός κοινός σε όλα: πατάκι, μπάσο, kick στους χτύπους, hats στα μισά. */
function groove(m: Mix, chords: [number, number[]][], from: number, to: number) {
  m.pad(chords, .026);
  m.bass(chords, from, to, .055);
  const kicks: number[] = [];
  for (let t = from; t < to - .01; t += BEAT) { m.kick(t, .9); kicks.push(t); m.hat(t + BEAT / 2, .035, (Math.round(t / BEAT) % 2 ? .35 : -.35)); }
  for (let t = from + BEAT; t < to; t += BEAT * 2) m.clap(t, .06);
  return kicks;
}

interface Reel { key: string; series: SeriesKey; dur: number; html: string; sound: (m: Mix) => number[]; cover: number; checkAt: number[]; caption: string; title: string; campaign: string; link: string }

// ═══ ΒΡΑΧΥΧΡΟΝΙΑ #01 ═══════════════════════════════════════════════════
function vraxyReel(): Reel {
  const { r, bePct, curve } = vraxyFacts();
  const camp = 'vraxy-e01', path = '/vraxyxronia-i-makroxronia';
  const T = { long: 3.0, short: 7.5, curve: 12.0, verdict: 16.5, outro: 18.5, end: 22.0 };
  // ── Η καμπύλη, σε σκηνή ολόκληρης οθόνης ──
  const CW = 840, CH = 600, padL = 110, padR = 10, padT = 40, padB = 60;
  const maxNet = Math.max(...curve.map(c => c.net), r.long.net);
  const step = [1000, 2000, 2500, 5000, 10000].find(x => maxNet / x <= 4) ?? 10000;
  const top = Math.ceil(maxNet / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, k) => k * step);
  const xs = (pp: number) => padL + (pp - OCC_STEPS[0]) / (OCC_STEPS[OCC_STEPS.length - 1] - OCC_STEPS[0]) * (CW - padL - padR);
  const ys = (v: number) => padT + (1 - v / top) * (CH - padT - padB);
  const line = curve.map((c, k) => `${k ? 'L' : 'M'}${xs(c.pct).toFixed(1)},${ys(c.net).toFixed(1)}`).join(' ');
  const by = ys(r.long.net), bx = xs(r.breakEvenPct!);
  const band = `${line} L${xs(OCC_STEPS[OCC_STEPS.length - 1]).toFixed(1)},${by.toFixed(1)} L${xs(OCC_STEPS[0]).toFixed(1)},${by.toFixed(1)} Z`;
  const mine = curve.find(c => c.pct === svlInput.occupancyPct)!;
  const mx = xs(mine.pct), my = ys(mine.net);
  const tc = T.curve;
  const chart = `<svg width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}" style="display:block;overflow:visible">
    <defs><clipPath id="cl"><rect x="0" y="0" width="${bx.toFixed(1)}" height="${CH}"/></clipPath><clipPath id="cr"><rect x="${bx.toFixed(1)}" y="0" width="${CW}" height="${CH}"/></clipPath>
      <filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter></defs>
    <g ${A('fade', tc + .25, .5)}>${ticks.map(v => `<line x1="${padL}" x2="${CW - padR}" y1="${ys(v).toFixed(1)}" y2="${ys(v).toFixed(1)}" stroke="${S.rule}" stroke-width="${v ? 1.5 : 3}"/><text x="${padL - 18}" y="${(ys(v) + 8).toFixed(1)}" text-anchor="end" fill="${S.faint}" font-family="Roboto Mono" font-size="22">${esc(feWhole(v))}</text>`).join('')}
      ${curve.map(c => `<text x="${xs(c.pct).toFixed(1)}" y="${CH - 14}" text-anchor="middle" fill="${c.pct === mine.pct ? S.accent : S.faint}" font-family="Roboto Mono" font-size="22" font-weight="${c.pct === mine.pct ? 700 : 400}">${c.pct}%</text>`).join('')}</g>
    <path d="${band}" fill="${S.ok}" fill-opacity=".24" clip-path="url(#cl)" ${A('fade', tc + 2.6, .6)}/>
    <path d="${band}" fill="${S.accent}" fill-opacity=".24" clip-path="url(#cr)" ${A('fade', tc + 2.6, .6)}/>
    <path pathLength="1" d="M${padL},${by.toFixed(1)} L${CW - padR},${by.toFixed(1)}" stroke="${S.ok}" stroke-width="5" stroke-dasharray="1" style="stroke-dashoffset:1" fill="none" data-draw="${tc + .5},${tc + 1.0}"/>
    <path pathLength="1" d="${line}" stroke="${S.accent}" stroke-width="16" stroke-opacity=".35" filter="url(#gl)" fill="none" stroke-dasharray="1" style="stroke-dashoffset:1" data-draw="${tc + 1.0},${tc + 2.6}"/>
    <path pathLength="1" d="${line}" stroke="${S.accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke-dasharray="1" style="stroke-dashoffset:1" data-draw="${tc + 1.0},${tc + 2.6}" data-head="hd"/>
    <circle id="hd" r="15" fill="${S.ink}" style="opacity:0"/>
    <circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="18" fill="none" stroke="${S.ink}" stroke-width="4" style="transform-box:fill-box;transform-origin:center;opacity:0" data-pulse="${tc + 2.8}"/>
    <circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="15" fill="${S.ink}" style="transform-box:fill-box;transform-origin:center" ${A('pop', tc + 2.8, .5)}/>
    <circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="15" fill="${S.accent}" stroke="${S.panel}" stroke-width="5" style="transform-box:fill-box;transform-origin:center" ${A('pop', tc + 3.2, .5)}/>
    <g style="transform-box:fill-box;transform-origin:center" ${A('pop', tc + 2.95, .5)}><rect x="${(bx - 110).toFixed(1)}" y="${(by + 30).toFixed(1)}" width="220" height="58" rx="29" fill="${S.ink}"/><text x="${bx.toFixed(1)}" y="${(by + 69).toFixed(1)}" text-anchor="middle" fill="${S.ground}" class="pill" font-size="28">όριο ${bePct}%</text></g>
    <g style="transform-box:fill-box;transform-origin:center" ${A('pop', tc + 3.35, .5)}><rect x="${(mx - 110).toFixed(1)}" y="${(my - 110).toFixed(1)}" width="220" height="58" rx="29" fill="${S.accent}"/><text x="${mx.toFixed(1)}" y="${(my - 71).toFixed(1)}" text-anchor="middle" fill="${S.onAccent}" class="pill" font-size="28">${esc(feWhole(mine.net))}</text></g>
  </svg>`;
  const ts = T.short;
  const fees = [
    { label: 'Προμήθεια πλατφόρμας', v: r.short.platformFee, c: S.warm, t: ts + 1.5 },
    { label: 'Καθαριότητα και πάγια', v: r.short.running, c: S.other, t: ts + 2.2 },
    { label: 'Φόρος εισοδήματος', v: r.short.tax, c: S.neg, t: ts + 2.9 },
  ];
  if (Math.abs(fees.reduce((a, f) => a + f.v, 0) + r.short.net - r.short.gross) > .5) throw new Error('Τα κομμάτια της βραχυχρόνιας δεν αθροίζουν στα έσοδα.');
  let left = r.short.gross;
  const shortSegs: Seg[] = [seg(ts + .7, ts + 1.3, 0, r.short.gross)];
  for (const f of fees) { shortSegs.push(seg(f.t + .1, f.t + .7, left, left - f.v)); left -= f.v; }
  const tl = T.long;
  const html = page(`
  <section data-in="0" data-out="${T.long}" data-tin="cut" data-tout="whip">
    ${stamp('vraxy', 1, 0)}
    <div class="L h1" style="top:420px;font-size:122px;white-space:nowrap" ${A('slam', 0, .55)}>Βραχυχρόνια</div>
    <div class="L h1" style="top:556px;font-size:122px;white-space:nowrap;color:${S.accent}" ${A('slam', BEAT, .55)}>ή μακροχρόνια;</div>
    <div class="L card" style="top:860px;width:405px;padding:40px 36px 36px" ${A('left', 2 * BEAT)}><div class="lbl">ΜΑΚΡΟΧΡΟΝΙΑ</div><div style="font-size:120px;font-weight:900;letter-spacing:-.05em;line-height:1;margin-top:14px">${esc(feWhole(svlInput.monthlyRent))}</div><div class="lead" style="font-size:32px;margin-top:8px">τον μήνα</div></div>
    <div class="card" style="position:absolute;left:525px;top:860px;width:405px;padding:40px 36px 36px;border-color:${S.accent}88" ${A('right', 2.5 * BEAT)}><div class="lbl">ΒΡΑΧΥΧΡΟΝΙΑ</div><div style="font-size:120px;font-weight:900;letter-spacing:-.05em;line-height:1;margin-top:14px;color:${S.accent}">${esc(feWhole(svlInput.nightlyPrice))}</div><div class="lead" style="font-size:32px;margin-top:8px">τη διανυκτέρευση</div></div>
    <div class="L lead" style="top:1240px;width:840px" ${A('up', 3.4 * BEAT)}>Το ίδιο διαμέρισμα των ${svlInput.sqm} τ.μ. Ποιο είδος μίσθωσης αποφέρει περισσότερα;</div>
  </section>

  <section data-in="${tl}" data-out="${ts}" data-tin="whip" data-tout="whip">
    ${stamp('vraxy', 1, tl)}
    <div class="L h2" style="top:400px" ${A('mask', tl + .1, .6)}>Μακροχρόνια</div>
    <div class="L lead" style="top:540px" ${A('up', tl + .3)}>Ένας ενοικιαστής, ${esc(feWhole(svlInput.monthlyRent))} τον μήνα.</div>
    <div class="L" style="top:660px;display:grid;grid-template-columns:repeat(6,140px);gap:12px">
      ${Array.from({ length: 12 }, (_, k) => `<div style="padding:18px 0;border-radius:20px;text-align:center;background:${S.ok}18;border:1.5px solid ${S.ok}55" ${A('pop', tl + .5 + k * .125, .45)}><div style="font-size:24px;color:${S.faint}">${esc(elDate(`2026-${String(k + 1).padStart(2, '0')}-15`, { month: 'short' }).replace('.', ''))}</div><div style="font-size:30px;font-weight:800;color:${S.ok}">${esc(feWhole(svlInput.monthlyRent))}</div></div>`).join('')}
    </div>
    <div class="L lbl" style="top:960px" ${A('fade', tl + 2.0, .4)}>ΕΝΟΙΚΙΑ ΤΟΝ ΧΡΟΝΟ</div>
    <div class="L bar" style="top:1010px" ${A('grow', tl + 2.0, .7)}><i style="flex-grow:${r.long.tax};background:${S.neg}" data-peel="${tl + 3.0}" data-v="${r.long.tax}"></i><i style="flex-grow:${r.long.net};background:${S.ok}"></i></div>
    <div class="L" style="top:1160px;font-size:40px;color:${S.neg};font-weight:750" ${A('up', tl + 2.7, .4)}>−${esc(feWhole(r.long.tax))} φόρος</div>
    <div class="L" style="top:1240px;display:flex;align-items:baseline;gap:24px" ${A('up', tl + 2.0, .45)}><span class="big ok glow">${counter([seg(tl + 2.0, tl + 2.7, 0, r.long.gross), seg(tl + 3.1, tl + 3.7, r.long.gross, r.long.net)])}</span></div>
    <div class="L lead" style="top:1440px;color:${S.ok}" ${A('up', tl + 3.6, .4)}>καθαρά τον χρόνο</div>
  </section>

  <section data-in="${ts}" data-out="${T.curve}" data-tin="whip" data-tout="zoom">
    ${stamp('vraxy', 1, ts)}
    <div class="L h2" style="top:400px" ${A('mask', ts + .1, .6)}>Βραχυχρόνια</div>
    <div class="L lead" style="top:540px" ${A('up', ts + .3)}>${r.short.nights} διανυκτερεύσεις, πληρότητα ${svlInput.occupancyPct}%.</div>
    <div class="L lbl" style="top:690px" ${A('fade', ts + .7, .4)}>ΕΣΟΔΑ ΤΟΝ ΧΡΟΝΟ</div>
    <div class="L bar" style="top:740px" ${A('grow', ts + .7, .7)}>${fees.map(f => `<i style="flex-grow:${f.v};background:${f.c}" data-peel="${f.t}" data-v="${f.v}"></i>`).join('')}<i style="flex-grow:${r.short.net};background:${S.accent}"></i></div>
    <div class="L" style="top:900px;width:900px;display:flex;flex-direction:column;gap:18px">
      ${fees.map(f => `<div style="display:flex;justify-content:space-between;align-items:center;font-size:38px;color:${S.muted}" ${A('up', f.t - .15, .4)}><span style="display:flex;align-items:center;gap:16px"><i style="width:22px;height:22px;border-radius:7px;background:${f.c};display:block"></i>${esc(f.label)}</span><b style="color:${f.c};font-weight:800">−${esc(feWhole(f.v))}</b></div>`).join('')}
    </div>
    <div class="L" style="top:1210px" ${A('up', ts + .7, .45)}><span class="big acc glow">${counter(shortSegs)}</span></div>
    <div class="L lead" style="top:1410px;color:${S.accent}" ${A('up', ts + 3.5, .4)}>καθαρά τον χρόνο</div>
  </section>

  <section data-in="${tc}" data-out="${T.verdict}" data-tin="zoom" data-tout="whip">
    ${stamp('vraxy', 1, tc)}
    <div class="L h2" style="top:400px;font-size:92px;white-space:nowrap" ${A('mask', tc + .1, .6)}>Η πληρότητα κρίνει.</div>
    <div class="L" style="top:560px;display:flex;gap:34px;font-size:30px;color:${S.muted}" ${A('fade', tc + .4, .4)}><span style="display:flex;align-items:center;gap:12px"><i style="width:40px;height:7px;border-radius:7px;background:${S.accent};display:block"></i>Βραχυχρόνια</span><span style="display:flex;align-items:center;gap:12px"><i style="width:40px;border-top:5px dashed ${S.ok};display:block"></i>Μακροχρόνια ${esc(feWhole(r.long.net))}</span></div>
    <div class="L" style="top:650px">${chart}</div>
    <div class="L lead" style="top:1300px;width:840px" ${A('up', tc + 3.4, .5)}>Κάτω από ${r.breakEvenNights} διανυκτερεύσεις, η μακροχρόνια αποφέρει περισσότερα.</div>
  </section>

  <section data-in="${T.verdict}" data-out="${T.outro}" data-tin="whip" data-tout="whip">
    ${stamp('vraxy', 1, T.verdict)}
    <div class="L lbl" style="top:520px" ${A('fade', T.verdict + .05, .3)}>ΚΑΤΩ ΑΠΟ ${bePct}%</div>
    <div class="L h1 ok glow" style="top:570px;font-size:128px;white-space:nowrap" ${A('slam', T.verdict + .1, .5)}>Μακροχρόνια.</div>
    <div class="L lbl" style="top:900px" ${A('fade', T.verdict + .55, .3)}>ΠΑΝΩ ΑΠΟ ${bePct}%</div>
    <div class="L h1 acc glow" style="top:950px;font-size:128px;white-space:nowrap" ${A('slam', T.verdict + .6, .5)}>Βραχυχρόνια.</div>
  </section>

  ${outro('vraxy', 1, T.outro, T.end + 1, 'Ποιο είδος μίσθωσης μου αποφέρει περισσότερα;',
    `Στο ${svlInput.occupancyPct}% η βραχυχρόνια αποφέρει ${feWhole(r.difference)} περισσότερα. Κάτω από ${bePct}%, η μακροχρόνια.`,
    'Βάλε τα δικά σου<br><span class="acc">δεδομένα.</span>', path)}
  `, '', typingJS(T.outro));
  return {
    key: 'vraxy-e01', series: 'vraxy', dur: T.end, html, cover: 2.2, campaign: camp, link: utm(path, camp),
    title: 'Βραχυχρόνια ή μακροχρόνια;',
    checkAt: [2.4, 6.9, 11.4, 15.8, 17.9, 21.5],
    sound: m => {
      const ks = groove(m, [[0, ch('A3', 'C4', 'E4')], [4, ch('F3', 'A3', 'C4')], [8, ch('C3', 'G3', 'E4')], [12, ch('G3', 'B3', 'D4')], [16, ch('A3', 'C4', 'E4')], [18.5, ch('F3', 'A3', 'C4', 'E4')]], T.long, T.end - 1);
      m.boom(0, .5); m.boom(BEAT, .35); m.kick(0, 1); m.kick(BEAT, .9);
      for (const t of [T.long, T.short, T.curve, T.verdict, T.outro]) m.whoosh(t - .45, .55, .2);
      for (let k = 0; k < 12; k++) m.click(T.long + .5 + k * .125, 1800 + k * 40, .12);
      m.whoosh(T.long + 3.0, .7, .14, false); m.boom(T.long + 3.0, .25);
      for (const f of fees) { m.whoosh(f.t, .7, .14, false); m.boom(f.t, .2); }
      m.sweep(tc + 1.0, 1.6, 300, 900, .05); m.bell(tc + 2.8, n('E5'), .12); m.bell(tc + 3.2, n('A5'), .08);
      m.boom(T.verdict + .1, .45); m.boom(T.verdict + .6, .4);
      [0, 1, 2, 3].forEach(k => m.pluck(T.outro + 2.3 + k * .25, n(['A4', 'C5', 'E5', 'A5'][k]), .07, k % 2 ? .3 : -.3));
      m.bell(T.outro + 2.8, n('E5'), .1);
      return ks;
    },
    caption: [
      'Βραχυχρόνια ή μακροχρόνια; Ποιο είδος μίσθωσης αποφέρει περισσότερα κρίνεται από την πληρότητα.',
      '',
      `Το ίδιο διαμέρισμα των ${svlInput.sqm} τ.μ.: με ${feWhole(svlInput.monthlyRent)} τον μήνα, η μακροχρόνια αποφέρει ${feWhole(r.long.net)} καθαρά τον χρόνο. Με ${feWhole(svlInput.nightlyPrice)} τη διανυκτέρευση και πληρότητα ${svlInput.occupancyPct}%, η βραχυχρόνια αποφέρει ${feWhole(r.short.net)}. Το όριο είναι το ${bePct}%.`,
      '',
      'Βάλε τα δικά σου δεδομένα στον δωρεάν υπολογιστή: γράψε «ΥΠΟΛΟΓΙΣΤΗΣ» στα σχόλια και σου στέλνουμε τον σύνδεσμο. Είναι και στο βιογραφικό.',
      '',
      `Στείλ' το σε όποιον ενδιαφέρεται να μισθώσει το ακίνητό του.`,
      '',
      '#βραχυχρόνιαμίσθωση #airbnbgreece #ακίνητα #ενοίκιο #ιδιοκτήτες',
    ].join('\n'),
  };
}

// ═══ ΦΟΡΟΙ ΚΑΙ ΠΡΟΘΕΣΜΙΕΣ #01 ════════════════════════════════════════════
function foroiReel(): Reel {
  const F = foroiFacts(PUBLISH.foroi);
  const camp = 'foroi-e01', path = '/ypologismos-enfia';
  const T = { cal: 3.5, zones: 8.0, outro: 12.5, end: 16.5 };
  const weekday = elDate(F.due.date, { weekday: 'long' });
  const zLabel = (k: string) => k.startsWith('over_') ? `πάνω από ${feWhole(Number(k.slice(5)))}` : `${Number(k.split('_')[0]).toLocaleString('el-GR')}–${feWhole(Number(k.split('_')[1]))}`;
  const tcal = T.cal, tz = T.zones;
  const html = page(`
  <section data-in="0" data-out="${T.cal}" data-tin="cut" data-tout="whip">
    ${stamp('foroi', 1, 0)}
    <div class="L" style="top:420px;display:flex;flex-direction:column;align-items:center;padding:34px 70px 40px;border:9px solid ${S.warm};border-radius:34px;color:${S.warm};background:${S.warm}12;box-shadow:0 0 160px -20px ${S.warm}66" ${A('thump', .1, .7)}>
      <div style="font-family:'Roboto Mono',monospace;font-size:36px;letter-spacing:.42em;font-weight:700;margin-left:.42em">ΛΗΓΕΙ</div>
      <div style="font-size:290px;font-weight:900;letter-spacing:-.06em;line-height:.9;margin-top:8px">${F.dd}/${F.mm}</div>
      <div style="font-size:44px;font-weight:750;margin-top:6px">${esc(weekday)}</div>
    </div>
    <div class="L h2" style="top:1010px" ${A('mask', 1.2, .6)}>Η ${F.next + 1}η δόση</div>
    <div class="L h2 acc" style="top:1120px" ${A('mask', 1.45, .6)}>του ΕΝΦΙΑ.</div>
    <div class="L lead" style="top:1290px" ${A('up', 2.1)}>Σε ${F.daysLeft} ημέρες.</div>
  </section>

  <section data-in="${tcal}" data-out="${tz}" data-tin="whip" data-tout="zoom">
    ${stamp('foroi', 1, tcal)}
    <div class="L h2" style="top:400px;font-size:92px;white-space:nowrap" ${A('mask', tcal + .1, .6)}>Τελευταία εργάσιμη</div>
    <div class="L h2 acc" style="top:500px;font-size:92px" ${A('mask', tcal + .3, .6)}>κάθε μήνα.</div>
    <div class="L" style="top:700px;display:grid;grid-template-columns:repeat(4,198px);gap:14px">
      ${F.run.map((o, i) => `<div style="position:relative;padding:22px 0;border-radius:26px;text-align:center;${i === F.next ? `background:${S.warm};color:${S.onAccent}` : `background:#0a111d;border:1.5px solid ${S.rule}`}" ${A('pop', tcal + .7 + i * .12, .45)}>
        <div ${i < F.next ? A('dim', tcal + 2.4, .5) : ''}><div style="font-size:24px;font-weight:600;color:${i === F.next ? S.onAccent : S.faint}">${i + 1}η</div><div style="font-size:42px;font-weight:850;letter-spacing:-.01em">${esc(elDate(o.date, { month: 'short' }).replace('.', ''))}</div><div style="font-size:30px;color:${i === F.next ? S.onAccent : S.muted}">${esc(elDate(o.date, { day: 'numeric' }))}</div></div>
        ${i === F.next ? `<div style="position:absolute;inset:-6px;border-radius:30px;border:5px solid ${S.warm};opacity:0" data-pulse="${tcal + 2.9}"></div>` : ''}
      </div>`).join('')}
    </div>
    <div class="L" style="top:1330px;font-family:'Roboto Mono',monospace;font-size:26px;letter-spacing:.06em;color:${S.faint}" ${A('fade', tcal + 3.0, .5)}>${esc(F.law)}</div>
  </section>

  <section data-in="${tz}" data-out="${T.outro}" data-tin="zoom" data-tout="whip">
    ${stamp('foroi', 1, tz)}
    <div class="L h2" style="top:400px" ${A('mask', tz + .1, .6)}>Ίδια τετραγωνικά,</div>
    <div class="L h2" style="top:510px" ${A('mask', tz + .3, .6)}><span class="acc">${Math.floor(F.zMax / F.zMin)} φορές</span> ο φόρος.</div>
    <div class="L lbl" style="top:700px" ${A('fade', tz + .6, .4)}>ΦΟΡΟΣ ΑΝΑ Τ.Μ. · ΤΙΜΗ ΖΩΝΗΣ €/Τ.Μ.</div>
    <div class="L" style="top:760px;width:850px;display:flex;flex-direction:column;gap:14px">
      ${F.zones.map(([k, v], i) => `<div style="display:grid;grid-template-columns:250px 1fr 140px;align-items:center;gap:18px">
        <span style="font-family:'Roboto Mono',monospace;font-size:22px;color:${S.faint}" ${A('fade', tz + .7 + i * .14, .3)}>${esc(zLabel(k))}</span>
        <div style="height:30px;border-radius:9px;background:#ffffff0a"><i style="display:block;height:100%;width:${pc(v / F.zMax * 100)};border-radius:9px;background:${i === F.zones.length - 1 ? S.neg : S.warm};transform-origin:left center" ${A('grow', tz + .7 + i * .14, .6)}></i></div>
        <b style="text-align:right;font-size:32px;font-weight:800" ${A('fade', tz + 1.0 + i * .14, .3)}>${esc(fe(v))}</b></div>`).join('')}
    </div>
  </section>

  ${outro('foroi', 1, T.outro, T.end + 1, 'Πότε λήγει η επόμενη δόση;',
    `${weekday} ${elDate(F.due.date, { day: 'numeric', month: 'long' })}. Η ${F.next + 1}η από τις ${F.run.length}.`,
    'Πόσος είναι<br><span class="acc">ο δικός σου ΕΝΦΙΑ;</span>', path)}
  `, '', typingJS(T.outro));
  return {
    key: 'foroi-e01', series: 'foroi', dur: T.end, html, cover: 2.6, campaign: camp, link: utm(path, camp),
    title: `Η ${F.next + 1}η δόση του ΕΝΦΙΑ`,
    checkAt: [2.9, 7.4, 11.9, 16.0],
    sound: m => {
      const ks = groove(m, [[0, ch('D3', 'F3', 'A3')], [4, ch('A#2', 'D3', 'F3')], [8, ch('F3', 'A3', 'C4')], [12, ch('C3', 'G3', 'E4')]], 1.0, T.end - 1);
      m.boom(.1, .6); m.clap(.1, .1);
      for (const t of [T.cal, T.zones, T.outro]) m.whoosh(t - .45, .55, .2);
      F.run.forEach((_, i) => m.click(T.cal + .7 + i * .12, 1600 + i * 50, .12));
      m.bell(T.cal + 2.9, n('D5'), .12);
      F.zones.forEach((_, i) => m.pluck(T.zones + .7 + i * .14, n('D4') + [0, 2, 3, 5, 7, 8, 10, 12, 14][i % 9], .05, i % 2 ? .3 : -.3));
      m.boom(T.zones + .7 + (F.zones.length - 1) * .14, .3);
      m.bell(T.outro + 2.8, n('A4'), .1);
      return ks;
    },
    caption: [
      `Η ${F.next + 1}η δόση του ΕΝΦΙΑ λήγει ${weekday} ${elDate(F.due.date, { day: 'numeric', month: 'long' })}.`,
      '',
      `Κάθε δόση λήγει την τελευταία εργάσιμη του μήνα της (${F.law}). Και γιατί δύο σπίτια με τα ίδια τετραγωνικά πληρώνουν άλλο ΕΝΦΙΑ; Ο φόρος ανά τ.μ. πάει από ${fe(F.zMin)} έως ${fe(F.zMax)}, ανάλογα με την τιμή ζώνης.`,
      '',
      'Υπολόγισε τον δικό σου στον δωρεάν υπολογιστή: γράψε «ΥΠΟΛΟΓΙΣΤΗΣ» στα σχόλια και σου στέλνουμε τον σύνδεσμο. Είναι και στο βιογραφικό.',
      '',
      `Στείλ' το σε όποιον πληρώνει ΕΝΦΙΑ σε δόσεις.`,
      '',
      '#ΕΝΦΙΑ #ακίνητα #φόροι #ιδιοκτήτες #ΑΑΔΕ',
    ].join('\n'),
  };
}

// ═══ ΜΑΚΡΟΧΡΟΝΙΑ #01 ═══════════════════════════════════════════════════
function makroReel(): Reel {
  const M = makroFacts();
  const camp = 'makro-e01', path = '/ypologismos-forou-enoikion';
  const T = { scale: 3.5, save: 8.0, outro: 13.0, end: 17.0 };
  const pctR = (r: number) => fpRate(Math.round(r * 100));
  const tone = (rate: number) => ({ 0.15: S.ok, 0.25: S.accent, 0.35: S.warm, 0.45: S.neg }[rate as 0.15] ?? S.muted);
  const end = M.lastEdge * 4 / 3;
  const ts = T.scale, tv = T.save;
  const row = (label: string, br: typeof M.b26, t0: number) => `<div style="margin-bottom:30px"><div class="lbl" style="margin-bottom:14px" ${A('fade', t0, .3)}>${label}</div>
    <div style="position:relative;height:96px;width:900px;border-radius:18px;overflow:hidden;background:#ffffff08">${br.map((b, i) => {
      const a = b.from / end * 100, w = (Math.min(b.to, end) - b.from) / end * 100;
      return `<i style="position:absolute;top:0;bottom:0;left:${pc(a)};width:${pc(w)};background:${tone(b.rate)};border-right:4px solid ${S.ground};display:flex;align-items:center;justify-content:center;transform-origin:left center" ${A('grow', t0 + i * .3, .45)}><em style="font-style:normal;font-weight:850;font-size:34px;color:${S.onAccent}">${pctR(b.rate)}</em></i>`;
    }).join('')}</div></div>`;
  // Το γράφημα του οφέλους ανά μηνιαίο ενοίκιο.
  const CW = 840, CH = 560, padL = 110, padR = 10, padT = 80, padB = 60;
  const xMax = Math.ceil(M.monthlyOf(M.lastEdge) / 1000) * 1000 + 500;
  const yStep = [250, 500, 1000].find(x => M.maxSave / x <= 3) ?? 1000;
  const yTop = Math.ceil(M.maxSave / yStep) * yStep;
  const xs = (mo: number) => padL + mo / xMax * (CW - padL - padR);
  const ys = (v: number) => padT + (1 - v / yTop) * (CH - padT - padB);
  const pts: string[] = [];
  for (let mo = 0; mo <= xMax; mo += 10) pts.push(`${xs(mo).toFixed(1)},${ys(M.save(mo * 12 * (1 - M.ded))).toFixed(1)}`);
  const line = `M${pts.join(' L')}`;
  const ex = xs(M.m), th = xs(M.fromMonthly), pk = xs(M.monthlyOf(M.lastEdge));
  const chart = `<svg width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}" style="display:block;overflow:visible">
    <defs><linearGradient id="sv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${S.accent}" stop-opacity=".42"/><stop offset="1" stop-color="${S.accent}" stop-opacity="0"/></linearGradient>
      <filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter></defs>
    <g ${A('fade', tv + .3, .5)}>${Array.from({ length: yTop / yStep + 1 }, (_, k) => k * yStep).map(v => `<line x1="${padL}" x2="${CW - padR}" y1="${ys(v).toFixed(1)}" y2="${ys(v).toFixed(1)}" stroke="${S.rule}" stroke-width="${v ? 1.5 : 3}"/><text x="${padL - 18}" y="${(ys(v) + 8).toFixed(1)}" text-anchor="end" fill="${S.faint}" font-family="Roboto Mono" font-size="22">${esc(feWhole(v))}</text>`).join('')}
      ${Array.from({ length: Math.floor(xMax / 1000) + 1 }, (_, k) => k * 1000).map(v => `<text x="${xs(v).toFixed(1)}" y="${CH - 14}" text-anchor="middle" fill="${S.faint}" font-family="Roboto Mono" font-size="22">${esc(feWhole(v))}</text>`).join('')}</g>
    <path d="${line} L${xs(xMax).toFixed(1)},${ys(0).toFixed(1)} L${xs(0).toFixed(1)},${ys(0).toFixed(1)} Z" fill="url(#sv)" ${A('fade', tv + 2.4, .6)}/>
    <path pathLength="1" d="${line}" stroke="${S.accent}" stroke-width="16" stroke-opacity=".35" filter="url(#gl)" fill="none" stroke-dasharray="1" style="stroke-dashoffset:1" data-draw="${tv + .7},${tv + 2.4}"/>
    <path pathLength="1" d="${line}" stroke="${S.accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke-dasharray="1" style="stroke-dashoffset:1" data-draw="${tv + .7},${tv + 2.4}" data-head="hd"/>
    <circle id="hd" r="15" fill="${S.ink}" style="opacity:0"/>
    <line x1="${th.toFixed(1)}" x2="${th.toFixed(1)}" y1="${padT - 10}" y2="${ys(0).toFixed(1)}" stroke="${S.ink}" stroke-opacity=".55" stroke-width="2.5" stroke-dasharray="5 7" ${A('fade', tv + 2.9, .4)}/>
    <text x="${(th + 14).toFixed(1)}" y="${(padT - 30).toFixed(1)}" fill="${S.ink}" class="pill" font-size="28" ${A('fade', tv + 2.9, .4)}>από ${esc(feWhole(M.fromMonthly))}</text>
    <g style="transform-box:fill-box;transform-origin:center" ${A('pop', tv + 2.6, .5)}><circle cx="${ex.toFixed(1)}" cy="${ys(0).toFixed(1)}" r="15" fill="${S.ok}" stroke="${S.panel}" stroke-width="5"/><rect x="${(ex - 84).toFixed(1)}" y="${(ys(0) - 86).toFixed(1)}" width="168" height="54" rx="27" fill="${S.ok}"/><text x="${ex.toFixed(1)}" y="${(ys(0) - 50).toFixed(1)}" text-anchor="middle" fill="${S.onAccent}" class="pill" font-size="26">${esc(feWhole(M.m))}: 0€</text></g>
    <g style="transform-box:fill-box;transform-origin:center" ${A('pop', tv + 3.2, .5)}><circle cx="${pk.toFixed(1)}" cy="${ys(M.maxSave).toFixed(1)}" r="15" fill="${S.accent}" stroke="${S.panel}" stroke-width="5"/><rect x="${(pk - 110).toFixed(1)}" y="${(ys(M.maxSave) - 90).toFixed(1)}" width="220" height="54" rx="27" fill="${S.accent}"/><text x="${pk.toFixed(1)}" y="${(ys(M.maxSave) - 54).toFixed(1)}" text-anchor="middle" fill="${S.onAccent}" class="pill" font-size="26">έως ${esc(feWhole(M.maxSave))}</text></g>
  </svg>`;
  const html = page(`
  <section data-in="0" data-out="${T.scale}" data-tin="cut" data-tout="whip">
    ${stamp('makro', 1, 0)}
    <div class="L h1" style="top:420px;font-size:128px;white-space:nowrap" ${A('slam', 0, .55)}>Νέα κλίμακα</div>
    <div class="L h1 acc" style="top:560px;font-size:128px;white-space:nowrap" ${A('slam', BEAT, .55)}>στα ενοίκια.</div>
    <div class="L lbl" style="top:900px" ${A('fade', 2 * BEAT, .3)}>ΕΩΣ</div>
    <div class="L" style="top:950px" ${A('up', 2 * BEAT, .45)}><span class="big acc glow" style="font-size:260px">${counter([seg(2 * BEAT, 2 * BEAT + 1.1, 0, M.maxSave)])}</span></div>
    <div class="L lead" style="top:1200px;width:840px" ${A('up', 2 * BEAT + .9)}>λιγότερος φόρος τον χρόνο, για ενοίκια από 1/1/${M.Y}.</div>
  </section>

  <section data-in="${ts}" data-out="${tv}" data-tin="whip" data-tout="zoom">
    ${stamp('makro', 1, ts)}
    <div class="L h2" style="top:400px" ${A('mask', ts + .1, .6)}>Νέο κλιμάκιο:</div>
    <div class="L h2" style="top:510px" ${A('mask', ts + .3, .6)}><span class="acc">${pctR(M.b26[1].rate)}</span> στη μέση.</div>
    <div class="L" style="top:720px">
      ${row(`ΕΩΣ ${M.Y - 1}`, M.b25, ts + .8)}
      ${row(`ΑΠΟ ${M.Y}`, M.b26, ts + 2.0)}
      <div style="position:relative;height:40px;width:900px">${M.b26.map(b => b.from).filter(x => x > 0).map(t => `<span style="position:absolute;left:${pc(t / end * 100)};transform:translateX(-50%);font-family:'Roboto Mono',monospace;font-size:22px;color:${S.faint}" ${A('fade', ts + 3.2, .4)}>${esc(feWhole(t))}</span>`).join('')}</div>
    </div>
    <div class="L lead" style="top:1240px;width:840px" ${A('up', ts + 3.4, .5)}>Κάθε συντελεστής φορολογεί μόνο το κομμάτι του εισοδήματος που πέφτει στο κλιμάκιό του.</div>
  </section>

  <section data-in="${tv}" data-out="${T.outro}" data-tin="zoom" data-tout="whip">
    ${stamp('makro', 1, tv)}
    <div class="L h2" style="top:400px;font-size:92px;white-space:nowrap" ${A('mask', tv + .1, .6)}>Με ${esc(feWhole(M.m))} τον μήνα,</div>
    <div class="L h2 acc" style="top:500px;font-size:92px;white-space:nowrap" ${A('mask', tv + .3, .6)}>δεν αλλάζει τίποτα.</div>
    <div class="L lbl" style="top:690px" ${A('fade', tv + .5, .4)}>ΛΙΓΟΤΕΡΟΣ ΦΟΡΟΣ ΤΟΝ ΧΡΟΝΟ · ΑΝΑ ΜΗΝΙΑΙΟ ΕΝΟΙΚΙΟ</div>
    <div class="L" style="top:740px">${chart}</div>
    <div class="L lead" style="top:1330px;width:840px" ${A('up', tv + 3.5, .5)}>Το όφελος αρχίζει πάνω από ${esc(feWhole(M.fromMonthly))} τον μήνα.</div>
  </section>

  ${outro('makro', 1, T.outro, T.end + 1, 'Πόσο φόρο θα πληρώσω για το ενοίκιο;',
    `Για ${feWhole(M.m)} τον μήνα, ${feWhole(M.tax)} τον χρόνο. Η νέα κλίμακα δεν τον αλλάζει.`,
    'Βάλε το δικό σου<br><span class="acc">ενοίκιο.</span>', path)}
  `, '', typingJS(T.outro));
  return {
    key: 'makro-e01', series: 'makro', dur: T.end, html, cover: 2.6, campaign: camp, link: utm(path, camp),
    title: 'Η νέα κλίμακα στα ενοίκια',
    checkAt: [2.9, 7.4, 12.4, 16.5],
    sound: m => {
      const ks = groove(m, [[0, ch('C3', 'E3', 'G3')], [4, ch('A2', 'C3', 'E3')], [8, ch('F2', 'A2', 'C3', 'E3')], [12, ch('G2', 'B2', 'D3')], [14, ch('C3', 'E3', 'G3', 'B3')]], 1.0, T.end - 1);
      m.boom(0, .5); m.boom(BEAT, .35); m.kick(0, 1); m.kick(BEAT, .9);
      for (let k = 0; k < 22; k++) m.click(2 * BEAT + k * .05, 2200 + k * 30, .06);
      for (const t of [T.scale, T.save, T.outro]) m.whoosh(t - .45, .55, .2);
      [...M.b25.map((_, i) => ts + .8 + i * .3), ...M.b26.map((_, i) => ts + 2.0 + i * .3)].forEach((t, i) => m.pluck(t, n('C4') + [0, 4, 7, 12, 0, 4, 7, 12][i % 8], .06, i % 2 ? .3 : -.3));
      m.sweep(tv + .7, 1.7, 250, 800, .05); m.bell(tv + 2.6, n('G4'), .1); m.bell(tv + 3.2, n('C5'), .1);
      m.bell(T.outro + 2.8, n('E5'), .1);
      return ks;
    },
    caption: [
      `Νέα κλίμακα στα ενοίκια από το ${M.Y}: έως ${feWhole(M.maxSave)} λιγότερος φόρος τον χρόνο. Αλλά όχι για όλους.`,
      '',
      `Μπαίνει ενδιάμεσο κλιμάκιο ${pctR(M.b26[1].rate)}. Με ${feWhole(M.m)} τον μήνα ο φόρος μένει ${feWhole(M.tax)} τον χρόνο· το όφελος αρχίζει πάνω από ${feWhole(M.fromMonthly)} τον μήνα. Φαίνεται στη δήλωση του ${M.Y + 1}.`,
      '',
      'Βάλε το δικό σου ενοίκιο στον δωρεάν υπολογιστή: γράψε «ΥΠΟΛΟΓΙΣΤΗΣ» στα σχόλια και σου στέλνουμε τον σύνδεσμο. Είναι και στο βιογραφικό.',
      '',
      `Στείλ' το σε όποιον ενδιαφέρεται να μισθώσει το ακίνητό του.`,
      '',
      '#ενοίκιο #φορολογίαενοικίων #ακίνητα #ιδιοκτήτες #φόροι',
    ].join('\n'),
  };
}

async function main() {
  const only = process.argv[2];
  const reels = [vraxyReel(), foroiReel(), makroReel()].filter(r => !only || r.series === only);
  for (const r of reels) {
    const outDir = join(ROOT, 'docs/marketing/reels', `seires-${r.key}`);
    const docDir = join(ROOT, 'docs/marketing/instagram/seires', r.key, 'reel');
    mkdirSync(docDir, { recursive: true });
    await shoot({ html: r.html, dur: r.dur, outDir, file: 'silent.mp4', checkAt: r.checkAt, cover: { t: r.cover, path: join(docDir, 'cover.jpg') } });
    if (process.env.REEL_PREVIEW) continue;
    const m = new Mix(r.dur);
    const ks = r.sound(m);
    m.duck(ks);
    m.reverb(.5);
    const wav = join(outDir, 'sound.wav');
    m.write(wav, 1.2);
    mux(join(outDir, 'silent.mp4'), wav, join(outDir, `${r.key}.mp4`));
    writeFileSync(join(docDir, 'README.md'), [
      `# Reel: ${SERIES[r.series].name} #01 · ${r.title}`,
      '',
      'Παράγεται από το `npx tsx scripts/marketing/reelSeires.ts`. Το βίντεο είναι στο',
      `\`docs/marketing/reels/seires-${r.key}/${r.key}.mp4\` (έξω από το git) και το εξώφυλλο εδώ, \`cover.jpg\`.`,
      '',
      `**Πότε:** ${elDate(PUBLISH[r.series], { weekday: 'long', day: 'numeric', month: 'long' })}, το βράδυ (19:00-21:00), μαζί με το carousel της ίδιας μέρας.`,
      `**Διάρκεια:** ${r.dur} δευτερόλεπτα, με πρωτότυπη μουσική. Ανεβαίνει με τον ήχο του.`,
      `**Σύνδεσμος (βιογραφικό ή μήνυμα):** ${r.link}`,
      '',
      '## Πριν τη δημοσίευση',
      '',
      '- Εξώφυλλο: το `cover.jpg`. Το προφίλ το κόβει σε 3:4· ο τίτλος είναι μέσα στο κόψιμο.',
      '- Πρώτα ως «δοκιμαστικό reel» (trial reel), σε όσους δεν ακολουθούν. Αν κρατήσει, κοινοποίηση και στους ακολούθους.',
      '- Αυτόματοι υπότιτλοι: όχι. Κάθε φράση είναι ήδη γραμμένη στην εικόνα.',
      '- Απαντήσεις στα σχόλια μέσα στην πρώτη ώρα· όποιος γράψει «ΥΠΟΛΟΓΙΣΤΗΣ» παίρνει τον σύνδεσμο σε μήνυμα.',
      '',
      '## Λεζάντα',
      '',
      '```',
      r.caption,
      '```',
      '',
    ].join('\n'));
    console.log(`✓ ${r.key}: docs/marketing/reels/seires-${r.key}/${r.key}.mp4`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
