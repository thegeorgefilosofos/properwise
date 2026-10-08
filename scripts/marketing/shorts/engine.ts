// ═══════════════════════════════════════════════════════════════════════════
// SHORTS · Η ΜΗΧΑΝΗ ΤΗΣ ΣΕΛΙΔΑΣ
// ─────────────────────────────────────────────────────────────────────────
// Από την προδιαγραφή στη σελίδα που κινείται: χρόνοι πάνω στον χτύπο, σκηνές,
// περάσματα, κεφαλίδα της σειράς, πρόοδος, υποσημείωση, φόντο. Η σελίδα ορίζει
// μία συνάρτηση, `window.render(t)`, που στήνει την κατάσταση της στιγμής t:
// κανένα κινούμενο σχέδιο δεν παίζει μόνο του, ίδιο αποτέλεσμα σε κάθε τρέξιμο.
//
// Σε κάθε καρέ η μηχανή γράφει και αν φαίνεται ευανάγνωστο κείμενο
// (`window.__leg`): από αυτό μετρά ο έλεγχος των περασμάτων.
// ═══════════════════════════════════════════════════════════════════════════
import { BASE_CSS, MOTION_JS, mask } from '../reelKit';
import { mark } from '../igKit';
import { C, COL, GAP_HEAD, K, SERIES, UP, esc, glyph, html as txt, plain } from './kit';
import { TRANSITIONS, TRANSITIONS_JS, TRANSITION_LAYERS, transitionCss } from './transitions';
import type { Built, SceneOut, ShortSpec } from './spec';
import { SCENE_CSS } from './scenes';

export { mask };

/** Τα σημεία του χρόνου: κάθε σκηνή σε ακέραιους χτύπους, το κόψιμο στον χτύπο. */
/** Οι σκηνές με τη σειρά τους: το αγκίστρι που διαλέχτηκε και ό,τι ακολουθεί. */
export const scenesOf = (spec: ShortSpec, hook = spec.pick) => [spec.hooks[hook].scene, ...spec.scenes];

export function build(spec: ShortSpec, hook = spec.pick): Built {
  const s = SERIES[spec.series];
  const beat = 60 / s.bpm;
  const f = spec.facts(spec.date);
  const at: number[] = [];
  let t = 0;
  const scenes = scenesOf(spec, hook);
  for (const sc of scenes) { at.push(+t.toFixed(4)); t += sc.beats * beat; }
  return { spec, scenes, f, s, beat, at, dur: +t.toFixed(4) };
}

export interface Page {
  html: string;
  outs: SceneOut[];
  /** Πότε έχει κάτσει κάθε σκηνή: εκεί μετρά ο έλεγχος στοίχισης. */
  settle: number[];
  hits: number[];
  /** Τα περάσματα: σε ποια σκηνή μπαίνουν, πότε κόβουν, πόσο κρατούν. */
  trs: { k: number; name: string; B: number; pre: number; post: number; opts: Record<string, string> }[];
  /** Τόνοι που γεμίζουν τις παύσεις: μια λάμψη πάνω στον αριθμό και μια ανάσα της κάρτας. */
  shine: { t: number; k: number }[];
}

/**
 * ΧΩΡΙΣ ΝΕΚΡΟ ΧΡΟΝΟ. Οι πλατφόρμες μετρούν πόσοι φεύγουν· το μάτι φεύγει όταν
 * τίποτα δεν αλλάζει για πάνω από δυόμισι δευτερόλεπτα. Όπου μια σκηνή κρατά
 * χωρίς αλλαγή πάνω από 2,2″, μπαίνει τόνος: λάμψη στο κύριο στοιχείο και μια
 * ανάσα του (κλίμακα ως 1,03), πάνω στον χτύπο.
 */
function autoShine(html: string, trs: Page['trs'], hits: number[], at: number[], dur: number, beat: number): Page['shine'] {
  const ts: number[] = [0, dur];
  for (const m of html.matchAll(/data-a="([^"]+)"/g)) for (const x of m[1].split('|')) ts.push(+x.split(',')[1]);
  for (const m of html.matchAll(/data-(?:tw|draw|pulse|fill)="([\d.]+)/g)) ts.push(+m[1]);
  for (const m of html.matchAll(/data-seg='([^']+)'/g)) for (const g of JSON.parse(m[1]) as { a: number }[]) ts.push(g.a);
  for (const tr of trs) ts.push(tr.B - tr.pre, tr.B);
  ts.push(...hits);
  const ev = ts.filter(t => t >= 0 && t <= dur).sort((a, b) => a - b), out: Page['shine'] = [];
  const sceneAt = (t: number) => { let k = 0; while (k + 1 < at.length && t >= at[k + 1]) k++; return k; };
  for (let i = 1; i < ev.length; i++) {
    const a = ev[i - 1], b = ev[i];
    if (b - a <= 2.2) continue;
    const n = Math.ceil((b - a) / 2) - 1;
    for (let j = 1; j <= n; j++) {
      // Πάνω στον πλησιέστερο χτύπο.
      const t = Math.round((a + (b - a) * j / (n + 1)) / beat) * beat;
      if (t > a + .4 && t < b - .4) out.push({ t: +t.toFixed(3), k: sceneAt(t) });
    }
  }
  return out;
}

export function page(b: Built): Page {
  const { spec, f, s, at, dur, beat } = b;
  const SC = b.scenes, n = SC.length;
  const outs = SC.map((sc, k) => sc.build({ t0: at[k], t1: k + 1 < n ? at[k + 1] : dur, beat, f, s, k, n }));
  const trs = SC.map((sc, k) => {
    if (!k) return null;
    if (!sc.in) throw new Error(`Η σκηνή ${k + 1} (${sc.kind}) δεν έχει πέρασμα.`);
    const d = TRANSITIONS[sc.in];
    for (const need of d.needs ?? []) if (!sc.inOpts?.[need]) throw new Error(`Το πέρασμα ${sc.in} στη σκηνή ${k + 1} θέλει «${need}».`);
    const opts: Record<string, string> = {};
    // Η λέξη και ο υπότιτλος του slam μπαίνουν με textContent: σκέτο κείμενο, όχι HTML
    // που ξηλώνεται. Το παλιό ξήλωμα /<[^>]+>/g το σήμανε το CodeQL (PR #390,
    // js/incomplete-multi-character-sanitization) και άφηνε το «<» να φαίνεται «&lt;».
    for (const [key, v] of Object.entries(sc.inOpts ?? {})) opts[key] = /^(word|sub)$/.test(key) ? UP(plain(v, f)) : v;
    // Η λέξη του slam προσγειώνεται μέσα στη στήλη: μέγεθος από το μήκος της (Inter 900, ~0,66em ανά γράμμα).
    if (opts.word) opts.size = String(Math.floor(Math.min(210, (COL.R - COL.L) / ([...opts.word].length * .66))));
    return { k, name: sc.in, B: at[k], pre: d.pre, post: d.post, opts };
  }).filter((x): x is NonNullable<typeof x> => !!x);
  // Ο ΑΚΡΑΙΟΣ ΚΑΝΟΝΑΣ: καμία σκηνή δεν κρατά λιγότερο από τα δύο περάσματά της.
  SC.forEach((_, k) => {
    const a = at[k], z = k + 1 < n ? at[k + 1] : dur, tin = trs.find(x => x.k === k), tout = trs.find(x => x.k === k + 1);
    if ((tin?.post ?? 0) + (tout?.pre ?? 0) > (z - a) * .5) throw new Error(`Η σκηνή ${k + 1} είναι πολύ σύντομη για τα περάσματά της.`);
  });
  const loop = spec.loop === false ? 0 : .5;
  const settle = outs.map((o, k) => +(o.settle ?? ((k + 1 < n ? at[k + 1] - (trs.find(x => x.k === k + 1)?.pre ?? 0) : dur - loop) - .3)).toFixed(3));
  const hits = outs.flatMap(o => o.hits ?? []);
  const shine = autoShine(outs.map(o => o.html).join(''), trs, hits, at, dur, beat);
  const measure = [...new Set(trs.flatMap(x => [x.opts.target, x.opts.from, x.opts.to, x.opts.at].filter(Boolean)))];
  // Το JSON μπαίνει ωμό μέσα σε <script>: κάθε «<» γίνεται \u003c, ώστε κανένα κείμενο
  // να μην κλείσει νωρίς τη σελίδα. Στον περιηγητή διαβάζεται ξανά ως «<».
  const D = {
    S: at, END: dur, beat, trs, hits, measure, shine, loop, accent: s.accent,
    note: outs.map((_, k) => !!(SC[k].params as { note?: boolean })?.note),
    spot: outs.map((_, k) => [[540, 860], [380, 900], [700, 980], [540, 1100]][k % 4]),
  };
  const css = `${BASE_CSS}${transitionCss(s.accent)}${SCENE_CSS(s)}${outs.map(o => o.css ?? '').join('')}${PAGE_CSS(s)}`;
  const note = spec.note ? txt(spec.note, f) : '';
  const html = `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${css}</style></head><body>
  <div id="bg"></div><div id="spot" class="deco"></div>
  <svg width="0" height="0" style="position:absolute"><defs>${SC.map((_, k) => `
    <filter id="mb${k}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur id="mb${k}f" stdDeviation="0 0"/></filter>
    <filter id="mbc${k}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur id="mbc${k}f" stdDeviation="0 0"/></filter>`).join('')}</defs></svg>
  <div id="cam">
    ${TRANSITION_LAYERS.replace(/<div id="streak"[\s\S]*$/, '').trim()}
    ${outs.map((o, k) => `<section id="s${k}" data-k="${k}"><div class="sbg"></div>${o.html}</section>`).join('\n')}
    <div id="clones"></div>
  </div>
  ${TRANSITION_LAYERS}
  <div id="hdr">
    <div class="ser" data-col="L"><i>${glyph(s.glyph, s.accent, 30, 2)}</i><span>${esc(UP(s.name))}</span></div>
    <div class="br">${mark(30, C.ink)}<b>PROPERWISE</b></div>
  </div>
  <div id="prog">${SC.map((sc, k) => `<i style="flex-grow:${sc.beats}"><b id="pb${k}"></b></i>`).join('')}</div>
  ${note ? `<div id="note" class="deco" data-col="L"><i></i><span>${note}</span></div>` : ''}
  <div class="vig"></div><div class="grain"></div>
  <script>
  const D = ${JSON.stringify(D).replace(/</g, '\\u003c')};
  ${MOTION_JS}
  ${TRANSITIONS_JS}
  ${ENGINE_JS}
  const EXTRA = [${outs.map((o, k) => (o.js ? `(t0, tOf) => { const k = ${k}, t = tOf(${k}); if (!live[${k}]) return; ${o.js} }` : '')).filter(Boolean).join(',\n')}];
  </script></body></html>`;
  return { html, outs, settle, hits, trs, shine };
}

/** Η σελίδα: κεφαλίδα, πρόοδος, υποσημείωση, φόντο. Η στήλη και οι ζώνες από το kit. */
const PAGE_CSS = (s: (typeof SERIES)[keyof typeof SERIES]) => `
  #dust,#amb{display:none}
  /* Η βινιέτα του reelKit σκουραίνει προς το μαύρο· εδώ προς το έδαφος της μάρκας (κανένα χρώμα έξω από το K). */
  .vig{background:radial-gradient(130% 90% at 50% 45%, transparent 55%, ${K.ground}b3 100%)!important}
  #cam{position:absolute;inset:0;z-index:1}
  section{will-change:transform,filter,opacity;display:none}
  #clones>div{position:absolute;inset:0}
  /* Το έδαφος της σκηνής: αόρατο, εκτός όταν ένα πέρασμα θέλει τη σκηνή αδιαφανή (μάσκα, σκίσιμο, κάρτα). */
  .sbg{position:absolute;inset:0;opacity:0;background:radial-gradient(900px 760px at 74% 12%, ${C.accent}22, transparent 70%),radial-gradient(700px 600px at 80% 60%, ${s.accent}10, transparent 70%),linear-gradient(180deg,${K.panel} 0%,${K.ground} 58%)}
  .sbg.card{border-radius:64px;box-shadow:0 0 0 2px ${K.ink}14,0 80px 160px ${K.ground}cc}
  #spot{position:absolute;left:0;top:0;width:1200px;height:1200px;border-radius:50%;
    background:radial-gradient(closest-side,${s.accent}26,${s.accent}0a 55%,transparent)}
  #hdr{position:absolute;left:${COL.L}px;right:${1080 - COL.R}px;top:176px;height:48px;display:flex;align-items:center;justify-content:space-between;z-index:40}
  #hdr .ser{display:flex;align-items:center;gap:16px;font-family:'Roboto Mono',monospace;font-size:26px;line-height:32px;letter-spacing:.12em;font-weight:600;color:${C.ink}}
  #hdr .ser i{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:${s.accent}1f;border:1.5px solid ${s.accent}66}
  #hdr .br{display:flex;align-items:center;gap:12px;font-size:26px;line-height:32px;font-weight:800;letter-spacing:.1em;color:${C.ink}}
  #prog{position:absolute;left:${COL.L}px;right:${1080 - COL.R}px;top:240px;height:6px;display:flex;gap:8px;z-index:40}
  #prog i{display:block;height:6px;border-radius:6px;background:${K.ink}1f;overflow:hidden;flex-basis:0;min-width:0}
  #prog b{display:block;height:100%;width:100%;background:${s.accent};border-radius:6px;transform-origin:0 50%;transform:scaleX(0);box-shadow:0 0 12px ${s.accent}aa}
  #note{position:absolute;left:${COL.L}px;top:1500px;display:flex;gap:16px;align-items:stretch;font-size:26px;line-height:32px;color:${K.muted};z-index:39;white-space:nowrap}
  #note i{flex:none;width:3px;border-radius:2px;background:${s.accent}aa}
  .blk{position:absolute;left:${COL.L}px;width:${COL.R - COL.L}px;top:${COL.top}px;height:${COL.bottom - COL.top}px;display:flex;flex-direction:column;justify-content:center;padding-bottom:24px}
  .blk>*{flex:none}
  .gh{margin-top:${GAP_HEAD}px}`;

/** Ο χρόνος μέσα στη σελίδα. Χρησιμοποιεί τους βοηθούς του reelKit (MOTION_JS) χωρίς να τους αλλάζει. */
const ENGINE_JS = `
  const S = D.S, N = S.length, ENDS = [...S.slice(1), D.END];
  const secEls = S.map((_, k) => $('s' + k));
  const trIn = k => D.trs.find(x => x.k === k), trOut = k => D.trs.find(x => x.k === k + 1);
  const win = secEls.map((_, k) => [S[k] - (trIn(k) ? trIn(k).pre : 0), ENDS[k] + (trOut(k) ? trOut(k).post : 0)]);
  // Γεωμετρία των στόχων των περασμάτων: μία φορά, χωρίς μετασχηματισμούς, ΑΦΟΥ φορτωθούν
  // οι γραμματοσειρές (στην πρώτη render, που καλείται μετά το document.fonts.ready).
  const G = {};
  let laidOut = false;
  const layoutOnce = () => { if (laidOut) return; laidOut = true;
    secEls.forEach(e => { e.style.display = 'block'; });
    // ΡΥΘΜΟΣ 8px: κάθε μπλοκ της στήλης παίρνει ύψος πολλαπλάσιο του 8. Τα περιθώρια είναι ήδη
    // πολλαπλάσια του 8, άρα κάθε μπλοκ ξεκινά πάνω στο πλέγμα. Ο έλεγχος στοίχισης το μετρά.
    document.querySelectorAll('.blk > *').forEach(el => { const h = el.getBoundingClientRect().height, r = Math.ceil(h / 8 - 1e-3) * 8; if (Math.abs(r - h) > .01) el.style.height = r + 'px'; });
    const cam = $('cam').getBoundingClientRect();
    for (const id of D.measure) { const el = $(id); if (!el) continue; const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      G[id] = { x: r.left - cam.left, y: r.top - cam.top, w: r.width, h: r.height, r: parseFloat(cs.borderTopLeftRadius) || Math.min(r.width, r.height) / 2 }; }
    secEls.forEach(e => { e.style.display = 'none'; }); };
  const X = { streak: $('streak'), zfill: $('zfill'), ring: $('ring'), morph: $('morph'), seam: $('seam'), stack: $('stack'), leak: $('leak'), flash: $('flash'),
    slamBg: $('slamBg'), slam: $('slam'), slamW: $('slamW'), slamS: $('slamS'), clone: {}, cover: 0, leg: false };
  const sceneOf = el => { const s = el.closest('section'); return s ? +s.dataset.k : -1; };
  const live = S.map(() => false), on = x => x.si < 0 || live[x.si];
  const anims = Array.from(document.querySelectorAll('[data-a]')).map(el => ({ el, si: sceneOf(el), list: el.dataset.a.split('|').map(x => { const [type, t0, d] = x.split(','); return { type, t0: +t0, d: +d }; }) }));
  const cts = Array.from(document.querySelectorAll('[data-seg]')).map(el => ({ el, si: sceneOf(el), segs: JSON.parse(el.dataset.seg) }));
  const draws = Array.from(document.querySelectorAll('[data-draw]')).map(el => ({ el, si: sceneOf(el), v: el.dataset.draw.split(',').map(Number) }));
  const tws = Array.from(document.querySelectorAll('[data-tw]')).map(el => { const [a, cps] = el.dataset.tw.split(',').map(Number); return { el, si: sceneOf(el), a, cps, full: el.dataset.full }; });
  const pulses = Array.from(document.querySelectorAll('[data-pulse]')).map(el => ({ el, si: sceneOf(el), v: el.dataset.pulse.split(',').map(Number) }));
  const dots = Array.from(document.querySelectorAll('.typing b')).map(el => ({ el, si: sceneOf(el) }));
  const apply = (el, list, t) => {
    let o = 1, tr = '', fx = '', clip = '', usesFx = false;
    for (const { type, t0, d } of list) {
      const k = cl((t - t0) / d), e = eo(k);
      if (type === 'up') { tr += 'translateY(' + (1 - e) * 70 + 'px)'; o *= cl(k * 2.2); }
      else if (type === 'down') { tr += 'translateY(' + -(1 - e) * 70 + 'px)'; o *= cl(k * 2.2); }
      else if (type === 'mask') { tr += 'translateY(' + (1 - e) * 112 + '%)'; o *= k > 0 ? 1 : 0; }
      else if (type === 'slam') { usesFx = true; tr += 'scale(' + (1.7 - .7 * spring(k * 1.1)) + ')'; if (k < .4) fx += 'blur(' + ((1 - k / .4) * 14).toFixed(1) + 'px)'; o *= cl(k * 4); }
      else if (type === 'left') { tr += 'translateX(' + -(1 - e) * 120 + 'px)'; o *= cl(k * 2); }
      else if (type === 'right') { tr += 'translateX(' + (1 - e) * 120 + 'px)'; o *= cl(k * 2); }
      else if (type === 'pop') { tr += 'scale(' + (.4 + .6 * spring(k)) + ')'; o *= cl(k * 3); }
      else if (type === 'fade') o *= e;
      else if (type === 'out') o *= 1 - eio(k);
      else if (type === 'dim') o *= 1 - .6 * e;
      else if (type === 'grow') tr += 'scaleX(' + e + ')';
      else if (type === 'growy') tr += 'scaleY(' + e + ')';
      else if (type === 'thump') { tr += 'rotate(-4deg) scale(' + (2.1 - 1.1 * spring(k * 1.1)) + ')'; o *= cl(k * 3); }
      else if (type === 'blur') { usesFx = true; tr += 'scale(' + (1.06 - .06 * e) + ')'; if (k < 1) fx += 'blur(' + ((1 - e) * 16).toFixed(1) + 'px)'; o *= cl(k * 1.8); }
      else if (type === 'rise') { tr += 'perspective(1600px) translateY(' + (1 - e) * 520 + 'px) rotateX(' + (1 - e) * 26 + 'deg)'; o *= cl(k * 2.5); }
      else if (type === 'flip') { tr += 'perspective(1200px) rotateX(' + (1 - e) * -90 + 'deg)'; o *= cl(k * 3); }
      // Αποκοπή σε κλάσμα της πλευράς (calc), όχι μορφοποιημένο ποσοστό.
      else if (type === 'wipe') clip = 'inset(0 calc(' + Math.round((1 - e) * 1e4) / 1e4 + ' * 100%) 0 0)';
      else if (type === 'wipey') clip = 'inset(calc(' + Math.round((1 - e) * 1e4) / 1e4 + ' * 100%) 0 0 0)';
      else if (type === 'strike') { el.style.setProperty('--k', e.toFixed(4)); }
      else if (type === 'scan') tr += 'translateY(' + eio(k) * 100 + '%)';
      // Η λέξη-κλειδί: πετάγεται και κάθεται, χωρίς να αλλάξει πλάτος γραμμής.
      else if (type === 'kick') { const b = Math.sin(Math.PI * k) * (1 - .35 * k); tr += 'translateY(' + (-10 * b).toFixed(2) + 'px) scale(' + (1 + .1 * b).toFixed(4) + ')'; }
    }
    el.style.opacity = o; if (tr) el.style.transform = tr; if (usesFx) el.style.filter = fx || 'none'; if (clip) el.style.clipPath = clip;
  };
  const bgPaint = t => {
    // Περιοδικό στη διάρκεια: το τελευταίο καρέ έχει το φως του πρώτου (βρόχος χωρίς ραφή).
    const w = 2 * Math.PI * t / D.END, gx = 74 + Math.sin(w * 2) * 10, gy = 12 + Math.cos(w * 3) * 6;
    $('bg').style.background =
      'radial-gradient(900px 760px at ' + gx + '% ' + gy + '%, ${C.accent}2a, transparent 70%),' +
      'radial-gradient(1000px 900px at ' + (12 + Math.sin(w) * 8) + '% 78%, ${K.accent}1c, transparent 72%),' +
      'radial-gradient(700px 600px at ' + (80 + Math.cos(w) * 6) + '% 60%, ' + D.accent + '0e, transparent 70%),' +
      'linear-gradient(180deg, ${K.panel} 0%, ${K.ground} 58%)';
  };
  window.__leg = { ok: true };
  // ΒΡΟΧΟΣ: το τελευταίο μισό δευτερόλεπτο η πρώτη σκηνή ξαναμπαίνει στην κατάσταση
  // του καρέ 0, ώστε η επανάληψη της πλατφόρμας να μη φαίνεται ως κόψιμο.
  const LOOP = D.loop;
  window.render = t => {
    layoutOnce();
    T = t; bgPaint(t);
    X.cover = 0; X.leg = false;
    const inLoop = LOOP > 0 && t >= D.END - LOOP, lq = inLoop ? p(t, D.END - LOOP, D.END) : 0;
    const tOf = si => (si === 0 && inLoop ? t - D.END : t);
    // 1 · Οι καταστάσεις των σκηνών: ήπια ώθηση της κάμερας σε όλη τη σκηνή.
    const st = secEls.map((_, k) => ({ x: 0, y: 0, s: 1 + .014 * p(t, S[k], ENDS[k]), rx: 0, ry: 0, o: 1, blur: 0, bx: 0, by: 0, bright: 1, clip: '', z: '', ox: 540, oy: 920, vis: 1, bg: 0, card: false }));
    secEls.forEach((_, k) => { live[k] = t >= win[k][0] && t < win[k][1]; });
    if (inLoop) live[0] = true;
    // Ορατές ΠΡΙΝ από τον κώδικα των σκηνών: ό,τι μετρά γεωμετρία (offsetLeft) θέλει διάταξη.
    secEls.forEach((el, k) => { const d = live[k] ? 'block' : 'none'; if (el.style.display !== d) el.style.display = d; });
    if (inLoop) { const L = st[0], Z = st[N - 1], e = eio(lq);
      L.o = e; L.blur = 10 * Math.pow(1 - e, 2); L.s = 1.05 - .05 * e; Z.o = 1 - e; Z.blur = 10 * e; Z.s = 1 + .04 * e; }
    // 2 · Τα περάσματα.
    for (const tr of D.trs) if (t >= tr.B - tr.pre && t < tr.B + tr.post) TRF[tr.name](t, tr, st[tr.k - 1], st[tr.k], X);
    for (const id of ['streak', 'zfill', 'ring', 'morph', 'seam', 'stack', 'leak', 'flash', 'slamBg', 'slam']) {
      const a = D.trs.some(tr => t >= tr.B - tr.pre && t < tr.B + tr.post && ((id === 'streak' && tr.name === 'whip') || (id === 'zfill' && tr.name === 'zoomThrough') || (id === 'ring' && tr.name === 'maskWipe')
        || (id === 'morph' && tr.name === 'matchCut') || (id === 'seam' && tr.name === 'splitSwap') || (id === 'stack' && tr.name === 'cardFlip') || ((id === 'leak' || id === 'flash') && tr.name === 'lightLeak') || ((id === 'slamBg' || id === 'slam') && tr.name === 'typeSlam')));
      if (!a) op(X[id], 0);
    }
    // 3 · Η κίνηση μέσα στις σκηνές.
    for (const x of anims) if (on(x)) apply(x.el, x.list, tOf(x.si));
    for (const x of cts) {
      if (!on(x)) continue;
      let txt = x.segs[0].s[0];
      const tt = tOf(x.si);
      for (const g of x.segs) if (tt >= g.a) { const k = g.l ? p(tt, g.a, g.b) : eio(p(tt, g.a, g.b)); txt = g.s[Math.round(k * (g.s.length - 1))]; }
      if (x.el.textContent !== txt) x.el.textContent = txt;
    }
    for (const x of draws) if (on(x)) x.el.style.strokeDashoffset = String(1 - eio(p(tOf(x.si), x.v[0], x.v[1])));
    for (const x of pulses) { if (!on(x)) continue; const k = p(tOf(x.si), x.v[0], x.v[0] + 1.2); tf(x.el, 'scale(' + (1 + k * (x.v[1] || 2.4)) + ')'); op(x.el, k > 0 && k < 1 ? (1 - k) * .8 : 0); }
    for (const w of tws) {
      if (!on(w)) continue;
      const t = tOf(w.si);
      const m = Math.max(0, Math.min(w.full.length, Math.floor((t - w.a) * w.cps)));
      const s = w.full.slice(0, m); if (w.el.textContent !== s) w.el.textContent = s;
      w.el.classList.toggle('on', t >= w.a - .25 && (m < w.full.length || Math.floor(t * 2.6) % 2 === 0) && t < w.a + w.full.length / w.cps + .9);
    }
    dots.forEach((d, i) => { if (live[d.si]) tf(d.el, 'translateY(' + (-11 * Math.max(0, Math.sin((t * 7) - (i % 3) * .8))) + 'px)'); });
    for (const f of EXTRA) f(t, tOf);
    // Οι τόνοι: λάμψη στο κείμενο με τον τόνο της σειράς, ανάσα του κύριου στοιχείου.
    for (const sh of D.shine) { const q = p(t, sh.t, sh.t + .9); if (q <= 0 || q >= 1 || !live[sh.k]) continue;
      const root = secEls[sh.k];
      // Μία περίοδος του μοτίβου (220% του πλάτους): στο τέλος η λάμψη αφήνει το κείμενο όπως το βρήκε.
      root.querySelectorAll('.acc-g, .hd .a').forEach(e => { const w = e.offsetWidth; e.style.backgroundPosition = (-.36 * w - 2.2 * w * eio(q)).toFixed(1) + 'px 0'; });
      const main = root.querySelector('.acc-g[data-a]') || root.querySelector('.card[data-a]');
      if (main) { const b = 1 + .03 * Math.sin(Math.PI * q); main.style.transform = (main.style.transform || '') + ' scale(' + b.toFixed(4) + ')'; } }
    // 4 · Εφαρμογή στις σκηνές.
    secEls.forEach((el, k) => {
      if (!live[k]) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
      el.style.display = 'block';
      const q = st[k];
      el.style.transformOrigin = q.ox + 'px ' + q.oy + 'px';
      el.style.transform = 'translate(' + q.x.toFixed(2) + 'px,' + q.y.toFixed(2) + 'px) perspective(1800px) rotateX(' + q.rx + 'deg) rotateY(' + q.ry + 'deg) scale(' + q.s.toFixed(5) + ')';
      let fx = '';
      if (q.bx > .3 || q.by > .3) { fx += 'url(#mb' + k + ') '; $('mb' + k + 'f').setAttribute('stdDeviation', q.bx.toFixed(1) + ' ' + q.by.toFixed(1)); }
      if (q.blur > .2) fx += 'blur(' + q.blur.toFixed(2) + 'px) ';
      if (Math.abs(q.bright - 1) > .01) fx += 'brightness(' + q.bright.toFixed(3) + ')';
      el.style.filter = fx || 'none';
      el.style.clipPath = q.clip || 'none';
      el.style.opacity = q.o; el.style.zIndex = q.z;
      const sb = el.firstElementChild; if (sb && sb.classList.contains('sbg')) { sb.style.opacity = q.bg; sb.classList.toggle('card', q.card); }
    });
    // 5 · Split swap: το δεύτερο μισό είναι αντίγραφο της σκηνής ΤΗ ΣΤΙΓΜΗ αυτή.
    const cl0 = $('clones'); cl0.innerHTML = ''; X.clone = {};
    for (const tr of D.trs) if (tr.name === 'splitSwap' && t >= tr.B - tr.pre && t < tr.B + tr.post) {
      const c = secEls[tr.k - 1].cloneNode(true); c.removeAttribute('id'); c.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
      const d = document.createElement('div'); d.appendChild(c); c.style.clipPath = 'none'; c.style.transform = 'none'; c.style.filter = 'none';
      cl0.appendChild(d); X.clone[tr.k] = d; TRF.splitSwap(t, tr, st[tr.k - 1], st[tr.k], X);
    }
    // 6 · Κάμερα: τίναγμα στις κρούσεις, φως που ακολουθεί τη σκηνή.
    { let sx = 0; for (const h of D.hits) if (t > h && t < h + .7) sx += Math.exp(-(t - h) * 10) * Math.sin((t - h) * 60) * 9;
      tf($('cam'), 'translate(' + sx.toFixed(2) + 'px,' + (sx * .4).toFixed(2) + 'px)'); }
    { let k = 0; while (k < N - 1 && t >= S[k + 1]) k++;
      const A2 = D.spot[k], B2 = D.spot[k + 1 < N ? k + 1 : 0], w = eio(p(t, ENDS[k] - (k + 1 < N ? .4 : LOOP), ENDS[k] + (k + 1 < N ? .2 : 0)));
      tf($('spot'), 'translate(' + (lerp(A2[0], B2[0], w) - 600) + 'px,' + (lerp(A2[1], B2[1], w) - 600) + 'px)');
      if ($('note')) op($('note'), D.note[k] ? (1 - (trOut(k) && t > ENDS[k] - .25 && !D.note[k + 1] ? p(t, ENDS[k] - .25, ENDS[k]) : 0)) * (k && !D.note[k - 1] ? p(t, S[k], S[k] + .4) : 1) : 0); }
    S.forEach((s, k) => tf($('pb' + k), 'scaleX(' + (p(t, s, ENDS[k]) * (1 - eio(lq))).toFixed(4) + ')'));
    // 7 · Ευανάγνωστο; Μία σκηνή καθαρή ή μια λέξη του περάσματος καθαρή. Κάλυψη κάτω από 0,6.
    let ok = X.leg;
    if (!ok && X.cover < .6) for (let k = 0; k < N; k++) {
      if (!live[k]) continue; const q = st[k];
      if (q.o >= .55 && q.blur <= 4 && Math.max(q.bx, q.by) <= 16 && Math.abs(q.x) <= 380 && Math.abs(q.y) <= 420 && q.s >= .7 && q.s <= 1.6
        && Math.abs(q.ry) <= 62 && Math.abs(q.rx) <= 62 && q.vis >= .4) { ok = true; break; }
    }
    window.__leg = { ok, cover: +X.cover.toFixed(2) };
  };`;
