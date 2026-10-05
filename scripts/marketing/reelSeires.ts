// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ REELS ΤΩΝ ΣΕΙΡΩΝ: ΟΛΟ ΤΟ ΘΕΜΑ ΣΕ ΕΝΑ ΛΕΠΤΟ
// ─────────────────────────────────────────────────────────────────────────
// ΧΡΗΣΗ:  npx tsx scripts/marketing/reelSeires.ts [vraxy|foroi|makro]
// Θέλει ffmpeg με libx264 (FFMPEG ή PATH). REEL_PREVIEW=0.5,4,11 βγάζει μόνο
// στιγμιότυπα, για να κριθεί η σύνθεση πριν από τα καρέ.
//
// Ένα reel ανά σειρά, που δένει ΟΛΑ τα stories του θέματος σε μία ιστορία με
// κεφάλαια: το ερώτημα, τα δύο σκέλη του λογαριασμού, η κρίση, ο υπολογιστής,
// η Νόα. Από τα ΙΔΙΑ δεδομένα με τα stories (seiresData.ts): κανένα ψηφίο
// γραμμένο εδώ. Το βίντεο πάει στο docs/marketing/reels/ (έξω από το git)·
// εξώφυλλο, λεζάντα και οδηγίες στο docs/marketing/instagram/seires/<θέμα>/reel/.
//
// ΓΙΑΤΙ ΕΝΑ ΛΕΠΤΟ. Το Instagram προτείνει σε όσους δεν σε ακολουθούν reels ως
// τριών λεπτών και μετρά πρώτα τον χρόνο θέασης ανά προβολή και τις αποστολές.
// Ένα λεπτό χωρά ολόκληρο τον λογαριασμό, αρκεί να μη χαλαρώνει: κάθε σκηνή
// κρατά 3 ώς 6 δευτερόλεπτα, κάθε κεφάλαιο ανοίγει με χτύπημα στη μουσική και
// η μπάρα πάνω δείχνει πόσο μένει, ώστε ο θεατής να ξέρει ότι αξίζει να μείνει.
//
// ΟΙ ΚΑΝΟΝΕΣ ΤΟΥ REEL, ΟΠΩΣ ΤΟΥΣ ΑΝΤΑΜΕΙΒΕΙ ΤΟ INSTAGRAM.
//   · Αγκίστρι στο πρώτο δευτερόλεπτο: η ερώτηση χτυπά στην οθόνη στο 0.
//   · Διαβάζεται χωρίς ήχο: κάθε φράση είναι γραμμένη, τίποτα δεν λέγεται.
//   · Το τέλος δένει με την αρχή (ίδιο έδαφος), ώστε η επανάληψη να μη σκάει.
//   · Ζώνες: πάνω ο λογαριασμός, κάτω η λεζάντα, κάτω δεξιά τα κουμπιά. Ο
//     έλεγχος του reelKit τις επιβάλλει στο τέλος ΚΑΘΕ σκηνής.
//   · Πρωτότυπη μουσική (synth.ts), στο ίδιο πλέγμα με την εικόνα: 120 χτύποι
//     το λεπτό, κάθε σκηνή σε χτύπο. Κανένα κομμάτι τρίτου.
//
// Η ΣΕΛΙΔΑ ΔΕΝ ΚΙΝΕΙΤΑΙ ΜΟΝΗ ΤΗΣ. Η `render(t)` διαβάζει από κάθε στοιχείο
// πότε μπαίνει και πώς (data-a· πολλές κινήσεις μαζί χωρίζονται με «|»), πότε
// ξεκολλά (data-peel), τι μετρά (data-seg), τι σχεδιάζει (data-draw), τι
// πληκτρολογεί (data-tw), τι σαρώνει (data-scan) και στήνει τη στιγμή t.
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { esc, mark } from './igKit';
import { BASE_CSS, BG_JS, MOTION_JS, shoot } from './reelKit';
import { Mix, ch, n, mux } from './synth';
import { SERIES, glyph, type SeriesKey } from './seiresKit';
import { PUBLISH, elDate, svlInput, vraxyFacts, makroFacts, foroiFacts, enfiaExample } from './seiresData';
import { netByOccupancy, spreadNights } from '../../lib/tools/shortVsLong';
import { rentalIncomeTax, FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT, isHighSeasonMonth, type TaxBracket } from '../../lib/billing/greekTax';
import { RENO_39B_TO } from '../../lib/accounting/renovation39b';
import { SPEC as RENT } from '../../app/ypologismos-forou-enoikion/spec';
import { feWhole, fe, fn, fpRate, feRate } from '../../lib/core/format';
import { ASSISTANT_ACC, ASSISTANT_INITIAL, ASSISTANT_NAME } from '../../lib/assistant/identity';
import { billingWords } from '../../lib/legal/billingWords';
import { DOC_TYPES } from '../../lib/billing/documents';
import { PROVIDERS, CATALOGUE_MONTH_GEN, TARIFFS_LABEL } from '../../lib/energy/catalogue';
import { INSURANCE_COMPANIES } from '../../app/dashboard/components/insurance/catalog';
import { greekPropertyTaxObligations, type TaxObligationKind } from '../../lib/tax/greekTaxCalendar';
import { WHO_LABEL } from '../../lib/accounting/dossier';
import { DEMO_PROPERTY, demoExpenses } from '../../lib/demo/sample';
import { athensToday } from '../../lib/core/time';
import { S as DEMO, eur, RATE, yearAhead } from './rentFacts';

const ROOT = process.cwd();
const BEAT = 0.5;
const S = SERIES.vraxy; // τα χρώματα είναι της μάρκας και ίδια σε κάθε σειρά
const pc = (x: number) => `${Math.round(x * 100) / 100}%`;
const up = (s: string) => s.toLocaleUpperCase('el').normalize('NFD').replace(/[́̈]/g, '').normalize('NFC');
const attr = (s: string) => esc(s).replace(/"/g, '&quot;');
const utm = (path: string, campaign: string) => `https://properwise.gr${path}?utm_source=instagram&utm_medium=reel&utm_campaign=${campaign}`;
/** Η δοκιμή, με τα λόγια του billingWords: η Νόα δεν είναι στο δωρεάν πακέτο. */
const TRIAL = billingWords().trialBadge;
/** «Μάρτιος» από ημερομηνία: η ονομαστική, για το «τον Μάρτιο». */
const monthNom = (iso: string) => elDate(iso, { month: 'long', year: 'numeric' }).split(' ')[0];
const monthAcc = (iso: string) => monthNom(iso).replace(/ς$/, '');

// ── ΚΙΝΗΣΗ ΣΕ ΣΤΟΙΧΕΙΟ ─────────────────────────────────────────────────
/** Μία κίνηση: `A('up', 2.4)`. Πολλές μαζί: `A('up', 2.4, .6, 'out', 5, .3)`. */
const A = (...xs: (string | number)[]) => {
  const out: string[] = [];
  for (let i = 0; i < xs.length;) {
    const type = xs[i++] as string, t = xs[i++] as number;
    const d = typeof xs[i] === 'number' ? (xs[i++] as number) : 0.6;
    out.push(`${type},${+t.toFixed(3)},${d}`);
  }
  return `data-a="${out.join('|')}"`;
};
/** Μετρητής: βήματα γραμμένα εδώ από τον μορφοποιητή της εφαρμογής, ανά τμήμα χρόνου. */
type Seg = { a: number; b: number; s: string[]; l?: 1 };
const seg = (a: number, b: number, from: number, to: number, fmt: (x: number) => string = feWhole, dec = 0, lin = false): Seg => {
  const q = Math.pow(10, dec);
  const s = Array.from({ length: 31 }, (_, k) => (k === 30 ? fmt(to) : fmt(Math.round((from + (to - from) * k / 30) * q) / q)));
  return lin ? { a, b, s, l: 1 } : { a, b, s };
};
const counter = (segs: Seg[], cls = '') => {
  const json = JSON.stringify(segs);
  if (json.includes("'")) throw new Error('Ο μετρητής έχει απόστροφο.');
  return `<span class="ct ${cls}" data-seg='${json}'>${esc(segs[0].s[0])}</span>`;
};
/** Κείμενο που γράφεται γράμμα γράμμα, με δρομέα. */
const tw = (text: string, t0: number, cps = 32, cls = '') => `<span class="tw ${cls}" data-tw="${t0},${cps}" data-full="${attr(text)}"></span>`;
/** Σχεδιασμένο εικονίδιο: κάθε γραμμή του χαράζεται από την αρχή ώς το τέλος. */
const drawn = (g: string, c: string, px: number, sw: number, a: number, b: number) =>
  glyph(g.replace(/<(path|rect|circle|line|polyline)/g, `<$1 pathLength="1" stroke-dasharray="1" style="stroke-dashoffset:1" data-draw="${a},${b}"`), c, px, sw);

const ICON = {
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  save: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.2-4.6A8 8 0 1 1 21 12z"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 20.5 2.5"/><path d="M16.5 6.5l3 3"/><path d="M14 9l2 2"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
  spark: '<path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z"/><path d="M19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7z"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
};

// ═══ Η ΜΗΧΑΝΗ ΤΗΣ ΣΕΛΙΔΑΣ ═══════════════════════════════════════════════
const ENGINE_JS = `
  ${MOTION_JS}
  ${BG_JS}
  const secs = Array.from(document.querySelectorAll('section')).map(el => ({ el, a: +el.dataset.in, b: +el.dataset.out, tin: el.dataset.tin || 'cut', tout: el.dataset.tout || 'cut' }));
  // Ο ΧΡΟΝΟΣ ΠΑΕΙ ΣΤΗ ΣΚΗΝΗ ΠΟΥ ΦΑΙΝΕΤΑΙ. Ένα λεπτό έχει δεκάδες σκηνές και
  // χιλιάδες κινούμενα στοιχεία· η σκηνή εκτός χρόνου βγαίνει από τη διάταξη
  // (display:none) και τα στοιχεία της δεν αγγίζονται σε εκείνο το καρέ.
  const sceneOf = el => { const s = el.closest('section'); return s ? secs.findIndex(x => x.el === s) : -1; };
  const live = secs.map(() => false);
  const on = x => x.si < 0 || live[x.si];
  const anims = Array.from(document.querySelectorAll('[data-a]')).map(el => ({ el, si: sceneOf(el), list: el.dataset.a.split('|').map(x => { const [type, t0, d] = x.split(','); return { type, t0: +t0, d: +d }; }) }));
  const peels = Array.from(document.querySelectorAll('[data-peel]')).map(el => ({ el, si: sceneOf(el), t0: +el.dataset.peel }));
  const cts = Array.from(document.querySelectorAll('[data-seg]')).map(el => ({ el, si: sceneOf(el), segs: JSON.parse(el.dataset.seg) }));
  const draws = Array.from(document.querySelectorAll('[data-draw]')).map(el => ({ el, si: sceneOf(el), v: el.dataset.draw.split(',').map(Number), head: el.dataset.head ? $(el.dataset.head) : null }));
  const pulses = Array.from(document.querySelectorAll('[data-pulse]')).map(el => ({ el, si: sceneOf(el), v: el.dataset.pulse.split(',').map(Number) }));
  const tws = Array.from(document.querySelectorAll('[data-tw]')).map(el => { const [a, cps] = el.dataset.tw.split(',').map(Number); return { el, si: sceneOf(el), a, cps, full: el.dataset.full }; });
  const scans = Array.from(document.querySelectorAll('[data-scan]')).map(el => ({ el, si: sceneOf(el), d: JSON.parse(el.dataset.scan), tx: el.querySelector('text'), pill: el.querySelector('.sp'), wins: Array.from(el.querySelectorAll('[data-win]')) }));
  const clips = Array.from(document.querySelectorAll('[data-clip]')).map(el => ({ el, si: sceneOf(el), v: el.dataset.clip.split(',').map(Number) }));
  const fills = Array.from(document.querySelectorAll('[data-fill]')).map(el => ({ el, v: el.dataset.fill.split(',').map(Number) }));
  const dots = Array.from(document.querySelectorAll('.typing b'));
  const pts = Array.from(document.querySelectorAll('#pts i')).map((el, i) => ({ el, x: (i * 379) % 1000 + 40, y: (i * 617) % 1900, v: 14 + (i * 7) % 23, s: .5 + ((i * 13) % 10) / 10 }));
  const fl = $('fl'), chn = $('chn'), chl = $('chl');
  const apply = (el, list, t) => {
    let o = 1, tr = '', fx = '', clip = '', usesFx = false;
    for (const { type, t0, d } of list) {
      const k = cl((t - t0) / d), e = eo(k);
      if (type === 'up') { tr += 'translateY(' + (1 - e) * 80 + 'px)'; o *= cl(k * 2.2); }
      else if (type === 'down') { tr += 'translateY(' + -(1 - e) * 80 + 'px)'; o *= cl(k * 2.2); }
      else if (type === 'mask') { tr += 'translateY(' + (1 - e) * 112 + '%)'; o *= k > 0 ? 1 : 0; }
      else if (type === 'slam') { usesFx = true; tr += 'scale(' + (1.55 - .55 * spring(k * 1.15)) + ')'; if (k < .5) fx += 'blur(' + (1 - k * 2) * 16 + 'px)'; o *= cl(k * 3); }
      else if (type === 'left') { tr += 'translateX(' + -(1 - e) * 130 + '%)'; o *= cl(k * 2); }
      else if (type === 'right') { tr += 'translateX(' + (1 - e) * 130 + '%)'; o *= cl(k * 2); }
      else if (type === 'pop') { tr += 'scale(' + (.35 + .65 * spring(k)) + ')'; o *= cl(k * 3); }
      else if (type === 'fade') o *= e;
      else if (type === 'out') o *= 1 - eio(k);
      else if (type === 'dim') o *= 1 - .62 * e;
      else if (type === 'grow') tr += 'scaleX(' + e + ')';
      else if (type === 'growy') tr += 'scaleY(' + e + ')';
      else if (type === 'thump') { tr += 'rotate(-4deg) scale(' + (2.1 - 1.1 * spring(k * 1.1)) + ')'; o *= cl(k * 3); }
      else if (type === 'blur') { usesFx = true; tr += 'scale(' + (1.08 - .08 * e) + ')'; if (k < 1) fx += 'blur(' + (1 - e) * 22 + 'px)'; o *= cl(k * 1.6); }
      else if (type === 'tilt') { tr += 'translateY(' + (1 - e) * 140 + 'px) rotate(' + (1 - e) * -10 + 'deg)'; o *= cl(k * 2); }
      else if (type === 'rise') { tr += 'perspective(1600px) translateY(' + (1 - e) * 520 + 'px) rotateX(' + (1 - e) * 28 + 'deg)'; o *= cl(k * 2.5); }
      else if (type === 'fly') { tr += 'translate(' + -(1 - e) * 420 + 'px,' + (1 - e) * 260 + 'px) rotate(' + (1 - e) * -25 + 'deg)'; o *= cl(k * 2.5); }
      else if (type === 'wipe') clip = 'inset(0 ' + (1 - e) * 100 + '% 0 0)';
      else if (type === 'float') tr += 'translateY(' + Math.sin(t * 6.283 / d) * t0 + 'px)';
      // Η δέσμη της σάρωσης: κατεβαίνει ομαλά ως το κάτω άκρο του εγγράφου.
      else if (type === 'scan') tr += 'translateY(' + eio(k) * 100 + '%)';
    }
    el.style.opacity = o; if (tr) el.style.transform = tr; if (usesFx) el.style.filter = fx || 'none'; if (clip) el.style.clipPath = clip;
  };
  window.render = t => {
    T = t; bgPaint(t);
    for (const q of pts) { const y = ((q.y - t * q.v) % 1920 + 1920) % 1920; tf(q.el, 'translate(' + (q.x + Math.sin(t * .4 + q.y) * 18) + 'px,' + y + 'px) scale(' + q.s + ')'); }
    let f = 0; for (const a of FLASH) if (t >= a) f = Math.max(f, .3 * Math.exp(-(t - a) * 5));
    op(fl, f);
    const c = CHAPTERS.find(x => t >= x.a && t < x.b) || CHAPTERS[CHAPTERS.length - 1];
    if (chl.textContent !== c.label) { chn.textContent = String(c.no); chn.style.display = c.no ? 'flex' : 'none'; chl.textContent = c.label; }
    const kc = eo(p(t, c.a, c.a + .5)); op(chl.parentElement, kc); tf(chl.parentElement, 'translateY(' + (1 - kc) * 26 + 'px)');
    for (const { el, v } of fills) el.style.width = (p(t, v[0], v[1]) * 100) + '%';
    secs.forEach((s, i) => { live[i] = t >= s.a && t < s.b; });
    for (const s of secs) {
      const { el, a, b, tin, tout } = s;
      if (t < a || t >= b) { op(el, 0); el.style.display = 'none'; continue; }
      el.style.display = '';
      const qi = tin === 'cut' ? 1 : eo(p(t, a, a + .45)), qo = tout === 'cut' ? 0 : ei(p(t, b - .42, b));
      let y = 0, x = 0, sc = 1, o = 1, bl = 0, clip = 'none';
      if (tin === 'whip') { y += (1 - qi) * 520; bl += (1 - qi) * 26; }
      if (tin === 'zoom') { sc *= 1.3 - .3 * qi; bl += (1 - qi) * 20; o *= qi; }
      if (tin === 'fade') o *= qi;
      if (tin === 'iris') clip = 'circle(' + qi * 130 + '% at 50% 46%)';
      if (tin === 'wipe') { clip = 'inset(0 ' + (1 - qi) * 100 + '% 0 0)'; x += (1 - qi) * 80; }
      if (tout === 'whip') { y -= qo * 520; bl += qo * 26; }
      if (tout === 'zoom') { sc *= 1 + qo * .4; bl += qo * 20; o *= 1 - qo; }
      if (tout === 'fade') o *= 1 - qo;
      if (tout === 'wipe') { clip = 'inset(0 0 0 ' + qo * 100 + '%)'; x -= qo * 80; }
      tf(el, 'translate(' + x + 'px,' + y + 'px) scale(' + sc + ')'); el.style.filter = bl > .4 ? 'blur(' + bl + 'px)' : 'none'; op(el, o); el.style.clipPath = clip;
    }
    for (const x of anims) if (on(x)) apply(x.el, x.list, t);
    for (const x of peels) {
      if (!on(x)) continue;
      const { el, t0 } = x, q = eio(p(t, t0, t0 + .7));
      tf(el, 'translateY(' + q * 300 + 'px) rotate(' + q * 10 + 'deg) scale(' + (1 - q * .4) + ')'); op(el, 1 - Math.min(1, q * 1.4));
    }
    for (const x of cts) {
      if (!on(x)) continue;
      const { el, segs } = x;
      let txt = segs[0].s[0];
      for (const g of segs) if (t >= g.a) { const k = g.l ? p(t, g.a, g.b) : eio(p(t, g.a, g.b)); txt = g.s[Math.round(k * (g.s.length - 1))]; }
      if (el.textContent !== txt) el.textContent = txt;
    }
    for (const x of draws) {
      if (!on(x)) continue;
      const { el, head } = x, k = eio(p(t, x.v[0], x.v[1]));
      el.style.strokeDashoffset = String(1 - k);
      if (head) { const L = el.getTotalLength(), pt = el.getPointAtLength(L * k); head.setAttribute('cx', pt.x); head.setAttribute('cy', pt.y); op(head, k > 0 && k < 1 ? 1 : 0); }
    }
    for (const x of pulses) {
      if (!on(x)) continue;
      const { el } = x, [a, reach] = x.v, k = p(t, a, a + 1.3);
      tf(el, 'scale(' + (1 + k * (reach || 2.6)) + ')'); op(el, k > 0 && k < 1 ? (1 - k) * .85 : 0);
    }
    for (const w of tws) {
      if (!on(w)) continue;
      const m = Math.max(0, Math.min(w.full.length, Math.floor((t - w.a) * w.cps)));
      const s = w.full.slice(0, m);
      if (w.el.textContent !== s) w.el.textContent = s;
      w.el.classList.toggle('on', t >= w.a - .25 && (m < w.full.length || Math.floor(t * 2.6) % 2 === 0) && t < w.a + w.full.length / w.cps + .9);
    }
    for (const sc of scans) {
      if (!on(sc)) continue;
      const { el, d, tx, pill, wins } = sc;
      const k = eio(p(t, d.a, d.b)), f = k * (d.pts.length - 1), i = Math.min(d.pts.length - 2, Math.floor(f)), r = f - i;
      const P = d.pts[i], Q = d.pts[i + 1], x = lerp(P[0], Q[0], r), y = lerp(P[1], Q[1], r), R = d.pts[Math.round(f)];
      el.setAttribute('transform', 'translate(' + x + ',' + y + ')');
      if (tx.textContent !== R[2]) tx.textContent = R[2];
      pill.setAttribute('transform', 'translate(' + (Math.max(d.lo, Math.min(d.hi, x)) - x) + ',0)');
      for (const w of wins) w.setAttribute('fill', R[3] ? d.c1 : d.c0);
      op(el, p(t, d.a - .25, d.a) * (1 - p(t, d.b + d.hold, d.b + d.hold + .3)));
    }
    for (const x of clips) if (on(x)) x.el.setAttribute('width', String(lerp(x.v[2], x.v[3], eio(p(t, x.v[0], x.v[1])))));
    dots.forEach((d, i) => tf(d, 'translateY(' + (-12 * Math.max(0, Math.sin((t * 7) - (i % 3) * .8))) + 'px)'));
  };`;

const PAGE_CSS = `${BASE_CSS}
  section{will-change:transform,filter,opacity}
  #fl{position:absolute;inset:0;background:radial-gradient(900px 700px at 50% 45%, ${S.accent}66, transparent 70%);opacity:0;pointer-events:none}
  #pts i{position:absolute;left:0;top:0;width:6px;height:6px;border-radius:50%;background:${S.accent};opacity:.22;box-shadow:0 0 12px ${S.accent}}
  .hdr{position:absolute;left:90px;right:90px;top:246px}
  .prog{display:flex;gap:8px;height:6px}
  .prog i{display:block;height:6px;border-radius:6px;background:#ffffff1c;overflow:hidden;flex-basis:0;min-width:0}
  .prog b{display:block;height:100%;width:0;background:${S.accent};border-radius:6px;box-shadow:0 0 14px ${S.accent}aa}
  .hrow{display:flex;align-items:center;justify-content:space-between;margin-top:22px;height:52px}
  .ser{display:flex;align-items:center;gap:16px;font-family:'Roboto Mono',monospace;font-size:22px;letter-spacing:.16em;font-weight:600}
  .ser i{width:50px;height:50px;border-radius:15px;display:flex;align-items:center;justify-content:center;background:${S.accent}1f;border:1.5px solid ${S.accent}55}
  .chl{display:flex;align-items:center;gap:12px;font-size:26px;font-weight:650;color:${S.muted}}
  .chl em{font-style:normal;font-family:'Roboto Mono',monospace;font-size:20px;font-weight:700;color:${S.onAccent};background:${S.accent};width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center}
  .h1,.h2{font-weight:850;letter-spacing:-.05em;line-height:.96}
  .h1{font-size:150px}.h2{font-size:104px}.h3{font-size:72px;font-weight:800;letter-spacing:-.035em;line-height:1.04}
  .lead{font-size:42px;color:${S.muted};line-height:1.3;letter-spacing:-.012em;font-weight:500;text-wrap:pretty}
  .lead b{color:${S.ink};font-weight:750}
  .ok{color:${S.ok}}.neg{color:${S.neg}}.warm{color:${S.warm}}
  .glow{text-shadow:0 20px 100px currentColor}
  .card{background:linear-gradient(180deg,${S.lift}f2,${S.panel}f2);border:1.5px solid ${S.rule};border-radius:40px;box-shadow:0 1px 0 #ffffff10 inset,0 60px 140px -50px #000}
  .big{font-size:200px;font-weight:900;letter-spacing:-.065em;line-height:.9}
  .lbl{font-family:'Roboto Mono',monospace;font-size:24px;letter-spacing:.16em;color:${S.faint}}
  .bar{display:flex;gap:8px;height:110px;width:850px}
  .bar i{display:block;position:relative;border-radius:14px;min-width:0;flex-basis:0;transform-origin:left center}
  .bar i b{position:absolute;inset:0;border-radius:14px}
  .row{display:flex;justify-content:space-between;align-items:center;font-size:38px;color:${S.muted}}
  .row > span{display:flex;align-items:center;gap:18px}
  .row b{font-weight:800}
  .chip{width:58px;height:58px;border-radius:17px;display:flex;align-items:center;justify-content:center;flex:none}
  .av{display:inline-flex;align-items:center;justify-content:center;border-radius:26%;background:${S.accent};color:${S.onAccent};font-weight:850;flex:none}
  .url{display:inline-flex;align-items:center;gap:14px;padding:20px 28px;border-radius:999px;background:${S.accent}1f;border:1.5px solid ${S.accent}66;font-size:30px;font-weight:700;color:${S.ink}}
  .url em{font-style:normal;color:${S.accent}}
  .pill{font-family:Inter;font-weight:800}
  .ex{font-family:'Roboto Mono',monospace;font-size:17px;letter-spacing:.14em;color:${S.accent};padding:8px 12px;border-radius:10px;background:${S.accent}1a;border:1px solid ${S.accent}44;white-space:nowrap}
  .tw.on::after{content:'';display:inline-block;width:.09em;height:1em;margin-left:.08em;background:currentColor;vertical-align:-.14em}
  .num{font-variant-numeric:tabular-nums}
  .tile{border-radius:22px;text-align:center;background:#0a111d;border:1.5px solid ${S.rule}}
  /* Το κινητό: ο υπολογιστής και η Νόα όπως τα βλέπει ο θεατής μετά το κλικ. */
  .phone{position:absolute;left:250px;width:580px;border-radius:66px;background:#04070c;border:3px solid #26344a;padding:20px;box-shadow:0 0 0 9px #0c1420,0 90px 160px -40px #000,0 0 140px -30px ${S.accent}55;transform-origin:50% 100%}
  .scr{position:relative;height:100%;border-radius:48px;background:linear-gradient(180deg,${S.lift},${S.panel});overflow:hidden;padding:74px 28px 28px;display:flex;flex-direction:column;gap:14px}
  .notch{position:absolute;top:34px;left:50%;width:150px;height:36px;margin-left:-75px;border-radius:20px;background:#04070c}
  .ubar{display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:16px;background:#0a111d;border:1.5px solid ${S.rule};font-family:'Roboto Mono',monospace;font-size:16px;color:${S.muted};white-space:nowrap}
  .ph-h{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px}
  .ph-h b{font-size:28px;font-weight:800;letter-spacing:-.02em;line-height:1.15}
  .fld{display:flex;justify-content:space-between;align-items:center;padding:15px 20px;border-radius:18px;background:#0a111d;border:1.5px solid ${S.rule}}
  .fld small{font-size:22px;color:${S.faint}}
  .fld b{font-size:30px;font-weight:750;color:${S.ink}}
  .btn{position:relative;margin-top:4px;padding:20px;border-radius:18px;background:${S.accent};color:${S.onAccent};text-align:center;font-size:28px;font-weight:800}
  .tap{position:absolute;left:62%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:4px solid #ffffff;opacity:0}
  .res{padding:20px 22px;border-radius:20px;background:${S.accent}1a;border:1.5px solid ${S.accent}66}
  .res small{display:block;font-size:22px;color:${S.muted}}
  .res b{display:block;font-size:64px;font-weight:900;letter-spacing:-.04em;color:${S.accent};margin-top:4px}
  .ch-top{display:flex;align-items:center;gap:16px;padding-bottom:16px;border-bottom:1.5px solid ${S.rule}}
  .ch-top b{display:block;font-size:28px;font-weight:750}
  .ch-top small{display:block;font-size:21px;color:${S.faint};margin-top:2px}
  .ask{align-self:flex-end;max-width:88%;padding:18px 24px;border-radius:26px 26px 8px 26px;background:${S.accent};color:${S.onAccent};font-size:30px;font-weight:650;line-height:1.3;min-height:76px}
  .ans-w{position:relative;align-self:flex-start;max-width:96%}
  .ans{padding:20px 24px;border-radius:26px 26px 26px 8px;background:#0a111d;border:1.5px solid ${S.rule};font-size:29px;line-height:1.4;color:${S.ink};min-height:80px}
  .typing{position:absolute;left:0;top:0;display:flex;gap:9px;padding:28px 26px;border-radius:26px 26px 26px 8px;background:#0a111d;border:1.5px solid ${S.rule}}
  .typing b{width:13px;height:13px;border-radius:50%;background:${S.faint};display:block}
  .trialp{margin-top:auto;padding:18px 22px;border-radius:18px;background:${S.accent}14;border:1.5px solid ${S.accent}44;font-size:25px;color:${S.muted};line-height:1.35}
  .trialp b{color:${S.accent}}
  .sum .r{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:22px 0;border-top:1.5px solid ${S.rule}99;font-size:30px;color:${S.muted}}
  .sum .r em{display:block;font-style:normal;font-size:22px;color:${S.faint};margin-top:4px}
  .sum .r b{color:${S.ink};font-size:46px;font-weight:850;letter-spacing:-.03em;white-space:nowrap}
  .savebar{display:flex;align-items:center;gap:22px;padding:24px 30px;border-radius:30px;background:${S.accent};color:${S.onAccent};font-size:31px;font-weight:750;line-height:1.25}
  /* Το πρώτο reel: χαρτιά, σάρωση, φάκελος */
  .dchip{display:flex;align-items:center;gap:16px;padding:20px 26px;border-radius:22px;background:linear-gradient(180deg,#ffffff,#e9eef5);color:#1a2332;
    font-size:30px;font-weight:750;letter-spacing:-.01em;white-space:nowrap;box-shadow:0 40px 80px -30px #000c,0 10px 20px -10px #0008}
  .paper{border-radius:22px;background:linear-gradient(165deg,#ffffff,#eef2f7 60%,#e4e9f1);color:#1a2332;overflow:hidden;box-shadow:0 70px 140px -40px #000,0 14px 30px -14px #0009}
  .paper .band{background:#1a2c48;color:#e9eef6;font-family:'Roboto Mono',monospace;font-size:21px;letter-spacing:.16em;padding:22px 34px}
  .paper .kv{display:flex;justify-content:space-between;font-size:26px;color:#566274;padding:0 34px;margin-top:16px}
  .paper .kv b{color:#1a2332}
  .paper i{display:block;height:13px;border-radius:7px;background:#d3dae4;margin:18px 34px 0}
  .paper .due{display:flex;justify-content:space-between;align-items:flex-end;margin:30px 34px 0;padding-top:20px;border-top:3px solid #1a2332}
  .paper .due span{font-family:'Roboto Mono',monospace;font-size:19px;color:#566274;letter-spacing:.1em}
  .paper .due b{font-size:62px;font-weight:900;letter-spacing:-.04em}
  .paper .code{height:62px;margin:26px 34px 34px;background:repeating-linear-gradient(90deg,#1a2332 0 4px,transparent 4px 7px,#1a2332 7px 9px,transparent 9px 14px,#1a2332 14px 19px,transparent 19px 22px)}
  .hl{position:absolute;border:3px solid ${S.accent};border-radius:12px;background:${S.accent}22;box-shadow:0 0 0 6px ${S.accent}1c,0 0 30px ${S.accent}66}
  .hl span{position:absolute;left:-3px;bottom:100%;margin-bottom:6px;padding:4px 10px;border-radius:7px;background:${S.accent};color:${S.onAccent};font-family:'Roboto Mono',monospace;font-size:15px;font-weight:700;letter-spacing:.12em;white-space:nowrap}
  .vf{position:absolute;width:80px;height:80px;border-color:${S.accent};border-style:solid;border-width:0}
  .beamw{position:absolute;height:100%;pointer-events:none}
  .beam{position:absolute;left:-24px;right:-24px;top:0;height:6px;border-radius:3px;background:linear-gradient(90deg,transparent,${S.accent} 12%,#e6f0ff 50%,${S.accent} 88%,transparent);box-shadow:0 0 40px 12px ${S.accent}80}
  .beam::after{content:'';position:absolute;left:24px;right:24px;bottom:100%;height:150px;background:linear-gradient(0deg,${S.accent}30,transparent)}
  .dd{width:128px;height:128px;border-radius:30px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none;background:linear-gradient(180deg,${S.lift},${S.panel});border:1.5px solid ${S.rule};box-shadow:0 24px 50px -24px #000}
  .dd b{font-size:56px;font-weight:900;line-height:1;letter-spacing:-.03em}
  .dd span{font-family:'Roboto Mono',monospace;font-size:18px;color:${S.accent};margin-top:8px;letter-spacing:.12em}
  .toast{display:flex;gap:22px;align-items:flex-start;padding:26px 30px;border-radius:40px;background:#2a3650d8;border:1px solid #ffffff22;box-shadow:0 50px 100px -30px #000}
  .toast .ti{width:66px;height:66px;border-radius:17px;background:linear-gradient(160deg,#1f3150,${S.ground});border:1px solid #ffffff22;display:flex;align-items:center;justify-content:center;flex:none}
  .bars{display:flex;align-items:flex-end;gap:12px;width:850px;height:170px}
  .bars i{display:block;flex:1;border-radius:12px 12px 4px 4px;background:#26344b;transform-origin:bottom center}
  .bars i.lo{background:linear-gradient(180deg,#b9d2fb,${S.accent});box-shadow:0 0 30px ${S.accent}66}
  .shd{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:${S.accent}1c;border:1.5px solid ${S.accent}55}
  .fbk{position:absolute;border-radius:34px;background:linear-gradient(180deg,#24406b,#1a2c48)}
  .ffr{position:absolute;border-radius:34px;background:linear-gradient(180deg,#5d8ee6,#3f6fc9 60%,#3461bb);box-shadow:0 -1px 0 #ffffff55 inset,0 -24px 50px -24px #0009;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}
  .fdoc{position:absolute;border-radius:18px;background:linear-gradient(170deg,#fff,#eef2f7);color:#1a2332;padding:20px 28px;box-shadow:0 -12px 34px -14px #0008}
  .fdoc .hd{display:flex;align-items:center;gap:14px;font-size:26px;font-weight:850;letter-spacing:.05em}
  .fdoc .hd em{margin-left:auto;font-style:normal;font-family:'Roboto Mono',monospace;font-size:16px;color:#566274;letter-spacing:.12em;font-weight:600}`;

// ═══ ΣΚΗΝΕΣ ═══════════════════════════════════════════════════════════════
type Tr = 'cut' | 'whip' | 'zoom' | 'fade' | 'wipe' | 'iris';
interface Scene {
  dur: number;
  /** Ποιο κεφάλαιο: δείκτης στον πίνακα κεφαλαίων του reel. */
  ch: number;
  tin?: Tr;
  tout?: Tr;
  /** Κάρτα κεφαλαίου: εδώ πέφτει το χτύπημα της μουσικής. */
  card?: boolean;
  html: (t: number) => string;
  sfx?: (m: Mix, t: number) => void;
}

/** Τα κεφάλαια ως μπάρα προόδου, πάνω από όλες τις σκηνές, με το όνομα του τρέχοντος. */
function header(k: SeriesKey, chapters: { a: number; b: number; label: string }[], brand?: { name: string; glyph: string }): string {
  const b = brand ?? SERIES[k];
  return `<div class="hdr">
    <div class="prog">${chapters.map(c => `<i style="flex-grow:${(c.b - c.a).toFixed(2)}"><b data-fill="${c.a},${c.b}"></b></i>`).join('')}</div>
    <div class="hrow"><span class="ser"><i>${glyph(b.glyph, S.accent, 28, 2)}</i>${esc(up(b.name))}</span><span class="chl"><em id="chn" style="display:none"></em><span id="chl"></span></span></div>
  </div>`;
}

/** Η κάρτα κεφαλαίου: αριθμός σε περίγραμμα και ο τίτλος, σε ενάμισι δευτερόλεπτο. */
const chapterCard = (no: number, total: number, title: string): Scene => ({
  dur: 1.5, ch: no, tin: 'iris', tout: 'whip', card: true,
  html: t => `
    <div class="L lbl" style="top:600px;color:${S.accent}" ${A('fade', t + .05, .3)}>ΜΕΡΟΣ ${no} ΑΠΟ ${total}</div>
    <div class="L num" style="top:650px;font-size:400px;font-weight:900;line-height:.8;letter-spacing:-.06em;color:transparent;background:linear-gradient(180deg,${S.accent},${S.accent}22);-webkit-background-clip:text;background-clip:text;padding-right:20px" ${A('blur', t, .5)}>${no}</div>
    <div class="L h1" style="top:1020px;font-size:112px;width:850px" ${A('slam', t + .15, .5)}>${title}</div>`,
  sfx: (m, t) => { m.boom(t, .5); m.clap(t, .12); m.bell(t + .02, n('E6'), .05, .3); },
});

/** Η Νόα στο κινητό: η ερώτηση πληκτρολογείται, οι τελείες, η απάντηση. */
function noaScene(ch: number, q: string, a: string, h1 = 'Και το δικό σου;', h2 = `Ρώτα ${ASSISTANT_ACC}.`): Scene {
  return {
    dur: 5, ch, tin: 'whip', tout: 'whip',
    html: t => `
      <div class="L h3" style="top:390px" ${A('mask', t + .05, .6)}>${esc(h1)}</div>
      <div class="L h3 acc" style="top:466px" ${A('mask', t + .2, .6)}>${esc(h2)}</div>
      <div class="phone" style="top:580px;height:910px" ${A('rise', t + .1, .8)}><div class="scr">
        <div class="ch-top"><span class="av" style="width:58px;height:58px;font-size:30px">${esc(ASSISTANT_INITIAL)}</span><div><b>${esc(ASSISTANT_NAME)}</b><small>Για τα ακίνητά σου</small></div><span class="ex" style="margin-left:auto">ΠΑΡΑΔΕΙΓΜΑ</span></div>
        <div class="ask" ${A('pop', t + .7, .45)}>${tw(q, t + .8, 40)}</div>
        <div class="ans-w"><div class="typing" ${A('fade', t + 1.75, .15, 'out', t + 2.35, .15)}><b></b><b></b><b></b></div><div class="ans" ${A('up', t + 2.35, .4)}>${tw(a, t + 2.45, 58)}</div></div>
        <div class="trialp" ${A('up', t + 4.0, .5)}><b>${esc(TRIAL)}</b>, στο properwise.gr.</div>
      </div><div class="notch"></div></div>`,
    sfx: (m, t) => {
      m.whoosh(t, .6, .14);
      for (let k = 0; k < Math.min(q.length, 30); k++) m.click(t + .8 + k / 40, 2600, .05, .2);
      m.pluck(t + .7, n('E5'), .05, .3);
      m.pluck(t + 2.35, n('A5'), .05, -.3);
      for (let k = 0; k < Math.min(a.length, 60); k += 2) m.click(t + 2.45 + k / 58, 2300, .035, -.2);
      m.bell(t + 4.0, n('C6'), .05);
    },
  };
}

/** Ο υπολογιστής στο κινητό: τα πεδία συμπληρώνονται, το κουμπί πατιέται, το αποτέλεσμα μετρά. */
function calcScene(ch: number, title: string, accent: string, path: string, name: string, fields: [string, string][], result: { label: string; to: number; fmt: (x: number) => string; dec?: number }): Scene {
  return {
    dur: 4.5, ch, tin: 'whip', tout: 'whip',
    html: t => `
      <div class="L h3" style="top:390px" ${A('mask', t + .05, .6)}>${title}</div>
      <div class="L h3 acc" style="top:466px" ${A('mask', t + .2, .6)}>${accent}</div>
      <div class="phone" style="top:580px;height:910px" ${A('rise', t + .1, .8)}><div class="scr">
        <div class="ubar">${glyph(ICON.lock, S.ok, 20, 2.2)}<span>properwise.gr${esc(path)}</span></div>
        <div class="ph-h"><b>${esc(name)}</b><span class="ex">ΧΩΡΙΣ ΕΓΓΡΑΦΗ</span></div>
        ${fields.map(([l, v], i) => `<div class="fld" ${A('up', t + .5 + i * .14, .45)}><small>${esc(l)}</small><b>${tw(v, t + .75 + i * .32, 22)}</b></div>`).join('')}
        <div class="btn" ${A('pop', t + 1.9, .4)}>Υπολόγισε<div class="tap" data-pulse="${t + 2.3},1.6"></div></div>
        <div class="res" ${A('up', t + 2.45, .45)}><small>${esc(result.label)}</small><b class="num">${counter([seg(t + 2.5, t + 3.4, 0, result.to, result.fmt, result.dec ?? 0)])}</b></div>
      </div><div class="notch"></div></div>`,
    sfx: (m, t) => {
      m.whoosh(t, .6, .14);
      fields.forEach(([, v], i) => { for (let k = 0; k < v.length; k++) m.click(t + .75 + i * .32 + k / 22, 2400 + i * 120, .05, .15); });
      m.click(t + 2.3, 900, .2); m.boom(t + 2.3, .12);
      for (let k = 0; k < 14; k++) m.click(t + 2.5 + k * .06, 2000 + k * 60, .05);
      m.bell(t + 3.4, n('A5'), .07);
    },
  };
}

/** Σε μία ματιά: τα τέσσερα νούμερα του θέματος και το «Αποθήκευσέ το». */
function sumScene(ch: number, title: string, rows: [string, string, string][], save: string): Scene {
  return {
    dur: 4.5, ch, tin: 'whip', tout: 'whip',
    html: t => `
      <div class="L h2" style="top:400px" ${A('mask', t + .05, .6)}>Σε μία <span class="acc">ματιά.</span></div>
      <div class="L card sum" style="top:560px;width:850px;padding:26px 34px 6px" ${A('up', t + .2, .6)}>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><b style="font-size:32px;font-weight:750">${esc(title)}</b><span class="ex">ΠΑΡΑΔΕΙΓΜΑ</span></div>
        ${rows.map(([l, v, note], i) => `<div class="r" ${A('right', t + .45 + i * .2, .55)}><span>${esc(l)}<em>${esc(note)}</em></span><b class="num">${esc(v)}</b></div>`).join('')}
      </div>
      <div class="L savebar" style="top:1290px;width:850px" ${A('up', t + 1.5, .5)}>${glyph(ICON.save, S.onAccent, 48, 2)}<span>${esc(save)}</span></div>`,
    sfx: (m, t) => { m.whoosh(t, .6, .14); rows.forEach((_, i) => m.pluck(t + .45 + i * .2, n('A4') + [0, 3, 7, 12][i % 4], .05, i % 2 ? .3 : -.3)); m.click(t + 1.5, 1200, .12); },
  };
}

/** Η κατάληξη: στείλ' το, το επόμενο θέμα, ο σύνδεσμος, η μάρκα. Δένει με την αρχή. */
function outroScene(ch: number, send: string, nextDay: string, nextTitle: string, path: string): Scene {
  return {
    dur: 3.5, ch, tin: 'whip', tout: 'fade',
    html: t => `
      <div class="L" style="top:400px" ${A('fly', t + .05, .8)}><div class="chip" style="width:110px;height:110px;border-radius:32px;background:${S.accent}">${glyph(ICON.send, S.onAccent, 60, 2)}</div></div>
      <div class="L h3" style="top:560px;width:850px;font-size:64px" ${A('up', t + .25, .6)}>${esc(send)}</div>
      <div class="L card" style="top:820px;width:850px;padding:28px 34px" ${A('up', t + .6, .6)}><div class="lbl" style="font-size:20px">ΤΗΝ ΕΠΟΜΕΝΗ ${esc(up(nextDay))}</div><div style="font-size:40px;font-weight:750;letter-spacing:-.015em;line-height:1.2;margin-top:10px">${esc(nextTitle)}</div></div>
      <div class="L" style="top:1110px" ${A('up', t + .9, .5)}><span class="url">${glyph('<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>', S.accent, 30, 2.4)}<span>properwise.gr<em>${esc(path)}</em></span></span></div>
      <div class="L" style="top:1240px;display:flex;align-items:center;gap:14px;font-size:30px;color:${S.muted};width:850px" ${A('up', t + 1.1, .5)}>${glyph(ICON.chat, S.muted, 34, 2)}<span>Γράψε <b style="color:${S.ink}">«ΥΠΟΛΟΓΙΣΤΗΣ»</b> και σου στέλνουμε τον σύνδεσμο.</span></div>
      <div class="L" style="top:1370px;display:flex;align-items:center;gap:16px" ${A('fade', t + 1.4, .5)}>${mark(46, S.ink)}<b style="font-size:30px;font-weight:850;letter-spacing:.03em">PROPERWISE</b></div>`,
    sfx: (m, t) => { m.whoosh(t, .8, .2); [0, 1, 2, 3].forEach(k => m.pluck(t + .25 + k * .25, n(['A4', 'C5', 'E5', 'A5'][k]), .06, k % 2 ? .3 : -.3)); m.bell(t + 1.4, n('E5'), .08); },
  };
}

// ═══ Η ΜΟΥΣΙΚΗ ═══════════════════════════════════════════════════════════
/**
 * Ένα πλέγμα για όλα: συγχορδία κάθε δύο δευτερόλεπτα, ο ρυθμός μπαίνει όταν
 * τελειώνει το αγκίστρι, σωπαίνει έναν χτύπο πριν από κάθε κάρτα κεφαλαίου
 * (εκεί ανεβαίνει το σάρωμα) και ξαναπέφτει πάνω της. Από το δεύτερο
 * κεφάλαιο μπαίνουν και νότες σε όγδοα, ώστε το κομμάτι να ανεβαίνει.
 */
function score(m: Mix, o: { chords: number[][]; dur: number; groove: number; cards: number[]; arpFrom: number; outro: number }): number[] {
  const prog: [number, number[]][] = [];
  for (let t = 0, i = 0; t < o.dur; t += 2, i++) prog.push([t, o.chords[i % o.chords.length]]);
  m.pad(prog, .022);
  m.bass(prog, o.groove, o.dur - 1, .05);
  const quiet = (t: number) => o.cards.some(c => t >= c - BEAT - .01 && t < c - .01);
  const kicks: number[] = [];
  for (let t = o.groove; t < o.dur - 1.2; t += BEAT) {
    if (quiet(t)) continue;
    m.kick(t, .85); kicks.push(t);
    m.hat(t + BEAT / 2, .032, Math.round(t / BEAT) % 2 ? .35 : -.35);
    if (t >= o.arpFrom) m.hat(t + BEAT / 4, .014, .5);
    if (Math.round((t - o.groove) / BEAT) % 2 === 1) m.clap(t, .06);
  }
  for (const c of o.cards) { m.sweep(c - 1.5, 1.5, 220, 1400, .035); m.whoosh(c - 1, 1, .17); }
  for (let t = o.arpFrom, i = 0; t < o.outro; t += BEAT / 2, i++) {
    if (quiet(t)) continue;
    const chord = prog[Math.min(prog.length - 1, Math.floor(t / 2))][1];
    m.pluck(t, chord[i % chord.length] + 12 + (i % 8 >= 4 ? 12 : 0), .016, i % 2 ? .4 : -.4, .4);
  }
  return kicks;
}

interface Reel {
  key: string; series: SeriesKey; scenes: Scene[]; chapters: string[];
  chords: number[][]; cover: number; caption: string; title: string; campaign: string; link: string;
  /** Reel εκτός σειράς (το πρώτο του λογαριασμού): δική του κεφαλίδα, φάκελοι, μέρα. */
  own?: { brand: { name: string; glyph: string }; video: string; doc: string; file: string; when: string };
}

/** Στήνει τη σελίδα από τις σκηνές: χρόνοι, κεφάλαια, έλεγχοι ζωνών, ήχος. */
function build(r: Reel) {
  let t = 0;
  const at: number[] = [];
  for (const s of r.scenes) { at.push(t); t += s.dur; }
  const dur = t;
  const chapters = r.chapters.map((label, i) => {
    const idx = r.scenes.map((s, k) => (s.ch === i ? k : -1)).filter(k => k >= 0);
    if (!idx.length) throw new Error(`Το κεφάλαιο «${label}» δεν έχει σκηνές.`);
    // Αριθμό έχουν μόνο τα μέρη, όπως τα λέει η κάρτα τους· η αρχή και το τέλος όχι.
    return { no: i > 0 && i < r.chapters.length - 1 ? i : 0, label, a: at[idx[0]], b: at[idx[idx.length - 1]] + r.scenes[idx[idx.length - 1]].dur };
  });
  const cards = r.scenes.map((s, k) => (s.card ? at[k] : -1)).filter(x => x >= 0);
  const sections = r.scenes.map((s, k) => `<section data-in="${at[k]}" data-out="${at[k] + s.dur}" data-tin="${s.tin ?? 'cut'}" data-tout="${s.tout ?? 'cut'}">${s.html(at[k])}</section>`).join('\n');
  const html = `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${PAGE_CSS}</style></head><body>
    <div id="bg"></div><div id="pts" class="deco">${Array.from({ length: 26 }, () => '<i></i>').join('')}</div><div id="fl"></div>
    ${sections}
    ${header(r.series, chapters, r.own?.brand)}
    <div class="grain"></div><div class="vig"></div>
    <script>const CHAPTERS = ${JSON.stringify(chapters)}; const FLASH = ${JSON.stringify(cards)};${ENGINE_JS}</script></body></html>`;
  const sound = (m: Mix) => {
    const ks = score(m, { chords: r.chords, dur, groove: at[1], cards, arpFrom: chapters[Math.min(2, chapters.length - 1)].a, outro: at[at.length - 1] });
    m.boom(0, .5); m.kick(0, 1); m.kick(BEAT, .9); m.boom(BEAT, .3);
    r.scenes.forEach((s, k) => s.sfx?.(m, at[k]));
    return ks;
  };
  // Κάθε σκηνή ελέγχεται λίγο πριν φύγει, όταν όλα της έχουν κάτσει.
  const checkAt = r.scenes.map((s, k) => +(at[k] + s.dur - .55).toFixed(2));
  return { html, dur, at, chapters, sound, checkAt };
}

// ═══ ΚΟΙΝΑ ΓΡΑΦΙΚΑ ═══════════════════════════════════════════════════════
/** Κομμάτι της μπάρας που φεύγει: το χρώμα ξεκολλά, η θέση του μένει ως ίχνος. */
const ghost = (c: string, v: number, t0: number) =>
  `<i style="flex-grow:${v};box-shadow:inset 0 0 0 2px ${c}77;background:repeating-linear-gradient(135deg,${c}1c 0 10px,transparent 10px 20px)"><b style="background:${c}" data-peel="${t0}"></b></i>`;
/** Γραμμή «κομμάτι που φεύγει»: εικονίδιο, όνομα, ποσό. */
const feeRow = (icon: string, c: string, label: string, v: number, t0: number) =>
  `<div class="row" ${A('up', t0, .4)}><span><i class="chip" style="background:${c}22;border:1.5px solid ${c}66">${glyph(icon, c, 30, 2)}</i>${esc(label)}</span><b style="color:${c}">−${esc(feWhole(v))}</b></div>`;

/** Γράφημα γραμμής με σάρωση: η γραμμή αποκαλύπτεται από αριστερά και ένα σημάδι διαβάζει τις τιμές. */
function scanChart(o: {
  id: string; W: number; H: number; padL: number; padR: number; padT: number; padB: number;
  xs: (x: number) => number; ys: (v: number) => number; line: string; area?: string;
  yTicks: { v: number; label: string }[]; xTicks: { x: number; label: string; hot?: boolean }[];
  scan: { pts: [number, number, string, number][]; c0: string; c1: string; a: number; b: number; hold: number; pw: number };
  t0: number; extra: string; defs?: string;
}): string {
  const { W, H, padL, padR, padB } = o;
  const x0 = o.scan.pts[0][0], x1 = o.scan.pts[o.scan.pts.length - 1][0];
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;overflow:visible">
    <defs><clipPath id="${o.id}c"><rect x="0" y="0" width="${x0}" height="${H}" data-clip="${o.scan.a},${o.scan.b},${x0.toFixed(1)},${(x1 + 30).toFixed(1)}"/></clipPath>
      <filter id="${o.id}g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>${o.defs ?? ''}</defs>
    <g ${A('fade', o.t0 + .25, .5)}>${o.yTicks.map(({ v, label }) => `<line x1="${padL}" x2="${W - padR}" y1="${o.ys(v).toFixed(1)}" y2="${o.ys(v).toFixed(1)}" stroke="${S.rule}" stroke-width="${v ? 1.5 : 3}"/><text x="${padL - 18}" y="${(o.ys(v) + 8).toFixed(1)}" text-anchor="end" fill="${S.faint}" font-family="Roboto Mono" font-size="22">${esc(label)}</text>`).join('')}
      ${o.xTicks.map(x => `<text x="${o.xs(x.x).toFixed(1)}" y="${H - padB + 44}" text-anchor="middle" fill="${x.hot ? S.accent : S.faint}" font-family="Roboto Mono" font-size="22" font-weight="${x.hot ? 700 : 400}">${esc(x.label)}</text>`).join('')}</g>
    ${o.extra}
    <g clip-path="url(#${o.id}c)">
      ${o.area ? `<path d="${o.area}" fill="url(#${o.id}a)"/>` : ''}
      <path d="${o.line}" stroke="${S.accent}" stroke-width="16" stroke-opacity=".35" filter="url(#${o.id}g)" fill="none"/>
      <path d="${o.line}" stroke="${S.accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </g>
    <g data-scan='${JSON.stringify({ ...o.scan, lo: padL + o.scan.pw / 2, hi: W - padR - o.scan.pw / 2 })}' style="opacity:0">
      <circle r="26" fill="${S.accent}" fill-opacity=".22" data-win="1"/><circle r="13" fill="${S.ink}" stroke="${S.panel}" stroke-width="4"/>
      <g class="sp"><rect x="${-o.scan.pw / 2}" y="-96" width="${o.scan.pw}" height="56" rx="28" data-win="1"/><text x="0" y="-58" text-anchor="middle" fill="${S.onAccent}" class="pill" font-size="26">${esc(o.scan.pts[0][2])}</text></g>
    </g>
  </svg>`;
}

// ═══ ΒΡΑΧΥΧΡΟΝΙΑ ═══════════════════════════════════════════════════════
function vraxyReel(): Reel {
  const { r, bePct } = vraxyFacts();
  const camp = 'vraxy-e01', path = '/vraxyxronia-i-makroxronia';
  const ratio = r.short.gross / r.long.gross;
  const grossWord = ratio >= 1.9 && ratio < 2.3 ? 'Διπλάσια' : ratio >= 1.4 && ratio < 1.9 ? 'Μιάμιση φορά' : null;
  if (!grossWord) throw new Error(`Ο λόγος εσόδων ${ratio.toFixed(2)} δεν έχει λέξη· το κείμενο θέλει αλλαγή.`);
  const kept = r.short.net / r.short.gross;
  if (kept < 0.4 || kept > 0.6) throw new Error('Τα καθαρά της βραχυχρόνιας δεν είναι περίπου τα μισά· το «τα μισά φεύγουν» δεν ισχύει.');
  if (isHighSeasonMonth(10) || !isHighSeasonMonth(9)) throw new Error('Η αλλαγή σεζόν του ΤΑΚΚ δεν είναι πια την 1η Νοεμβρίου· το «Επόμενο» θέλει αλλαγή.');
  const NIGHTS = 365;
  const SEND = 'Στείλ\' το σε όποιον ενδιαφέρεται να μισθώσει το ακίνητό του.';
  const fees = [
    { icon: ICON.phone, label: 'Προμήθεια πλατφόρμας', v: r.short.platformFee, c: S.warm },
    { icon: ICON.spark, label: 'Καθαριότητα και πάγια', v: r.short.running, c: S.other },
    { icon: ICON.receipt, label: 'Φόρος εισοδήματος', v: r.short.tax, c: S.neg },
  ];
  if (Math.abs(fees.reduce((a, f) => a + f.v, 0) + r.short.net - r.short.gross) > .5) throw new Error('Τα κομμάτια της βραχυχρόνιας δεν αθροίζουν στα έσοδα.');
  if (Math.abs(r.long.gross - r.long.tax - r.long.net) > .5) throw new Error('Τα κομμάτια της μακροχρόνιας δεν αθροίζουν στα ενοίκια.');
  if (Math.abs(svlInput.monthlyRent * 12 - r.long.gross) > .5) throw new Error('Τα ενοίκια του χρόνου δεν είναι δώδεκα μηνιαία.');
  if (Math.abs(r.short.nights * svlInput.nightlyPrice - r.short.gross) > .5) throw new Error('Τα έσοδα δεν είναι νύχτες επί τιμή.');

  // ── Η κάτοψη του διαμερίσματος, που σχεδιάζεται στο αγκίστρι ──
  const plan = (t: number) => {
    const wall = S.ink, fur = S.faint, d = (a: number, b: number) => `pathLength="1" stroke-dasharray="1" style="stroke-dashoffset:1" data-draw="${(t + a).toFixed(2)},${(t + b).toFixed(2)}"`;
    return `<svg width="850" height="430" viewBox="-10 -10 860 450" style="display:block;overflow:visible">
      <path ${d(.3, 1.3)} d="M0,0 H840 V430 H0 Z" fill="none" stroke="${wall}" stroke-width="12" stroke-linejoin="round"/>
      <path ${d(.9, 1.6)} d="M520,0 V120 M520,200 V320 M520,390 V430 M520,265 H840" fill="none" stroke="${wall}" stroke-width="9" stroke-linecap="round"/>
      <g ${A('fade', t + 1.4, .4)}><rect x="140" y="-6" width="220" height="12" fill="${S.ground}" stroke="${S.accent}" stroke-width="3"/><rect x="620" y="-6" width="150" height="12" fill="${S.ground}" stroke="${S.accent}" stroke-width="3"/><rect x="-6" y="150" width="12" height="150" fill="${S.ground}" stroke="${S.accent}" stroke-width="3"/></g>
      <path ${d(1.5, 2.0)} d="M520,120 L600,120 M600,120 A80,80 0 0 1 520,200 M520,320 L590,320 M590,320 A70,70 0 0 1 520,390" fill="none" stroke="${S.muted}" stroke-width="3" stroke-dasharray="1"/>
      <g fill="none" stroke="${fur}" stroke-width="3" ${A('fade', t + 1.7, .6)}>
        <rect x="610" y="28" width="190" height="200" rx="14"/><rect x="624" y="42" width="76" height="40" rx="9"/><rect x="710" y="42" width="76" height="40" rx="9"/><path d="M610,110 H800"/>
        <rect x="70" y="320" width="260" height="84" rx="18"/><path d="M70,350 H330"/><rect x="140" y="200" width="130" height="70" rx="12"/>
        <rect x="24" y="24" width="64" height="110" rx="8"/><circle cx="56" cy="62" r="16"/>
        <rect x="700" y="285" width="118" height="128" rx="26"/><circle cx="600" cy="300" r="20"/>
      </g>
      <g font-family="Inter" font-size="24" font-weight="600" fill="${S.muted}" ${A('fade', t + 2.0, .5)}>
        <text x="300" y="160" text-anchor="middle">Σαλόνι</text><text x="705" y="252" text-anchor="middle">Υπνοδωμάτιο</text><text x="610" y="412" text-anchor="middle">Μπάνιο</text>
      </g>
      <g style="transform-box:fill-box;transform-origin:center" ${A('pop', t + 2.2, .5)}><rect x="200" y="56" width="200" height="66" rx="33" fill="${S.accent}"/><text x="300" y="100" text-anchor="middle" fill="${S.onAccent}" class="pill" font-size="32">${svlInput.sqm} τ.μ.</text></g>
    </svg>`;
  };

  // ── Οι νύχτες του χρόνου ως ημερολόγιο: μία γραμμή ανά μήνα, μία τελεία ανά
  // μέρα. Ανάβουν όσες νύχτες δίνει σε κάθε μήνα ο υπολογιστής (spreadNights),
  // στρογγυλεμένες σε ακέραιες ώστε το σύνολο να μένει ακριβώς οι νύχτες του.
  const raw = spreadNights(r.short.nights, svlInput.season);
  const perMonth = raw.map(Math.floor);
  raw.map((x, i) => ({ i, f: x - Math.floor(x) })).sort((a, b) => b.f - a.f).slice(0, r.short.nights - perMonth.reduce((a, x) => a + x, 0)).forEach(({ i }) => perMonth[i]++);
  const dim = (mo: number) => new Date(Date.UTC(2026, mo + 1, 0)).getUTCDate();
  if (perMonth.reduce((a, x) => a + x, 0) !== r.short.nights || perMonth.some((x, i) => x > dim(i))) throw new Error('Το ημερολόγιο δεν ανάβει όσες νύχτες λέει η σύγκριση.');
  if (perMonth.reduce((a, _, i) => a + dim(i), 0) !== NIGHTS) throw new Error('Το ημερολόγιο δεν έχει όσες νύχτες ο χρόνος.');
  const dotsHtml = (a: number, b: number) => {
    let rank = 0;
    return perMonth.map((lit, mo) => `<div style="display:flex;align-items:center;height:40px">
      <span style="width:66px;font-size:20px;color:${S.faint}">${esc(elDate(`2026-${String(mo + 1).padStart(2, '0')}-15`, { month: 'short' }).replace('.', ''))}</span>
      ${Array.from({ length: dim(mo) }, (_, d) => {
        const on = d < lit, tt = on ? a + (b - a) * (rank++ + 1) / r.short.nights : 0;
        return `<i style="position:relative;display:block;width:19px;height:19px;margin-right:6px;border-radius:6px;background:#ffffff12">${on ? `<b style="position:absolute;inset:0;border-radius:6px;background:${S.accent};box-shadow:0 0 12px ${S.accent}99" ${A('pop', tt, .3)}></b>` : ''}</i>`;
      }).join('')}</div>`).join('');
  };

  // ── Η καμπύλη ανά πληρότητα, ανά μονάδα, για τη σάρωση ──
  const fine = netByOccupancy(svlInput, Array.from({ length: 71 }, (_, k) => 20 + k));
  const CW = 850, CH = 560, padL = 110, padR = 26, padT = 70, padB = 70;
  const maxNet = Math.max(...fine.map(c => c.net), r.long.net);
  const step = [1000, 2000, 2500, 5000, 10000].find(x => maxNet / x <= 4) ?? 10000;
  const top = Math.ceil(maxNet / step) * step;
  const xs = (pp: number) => padL + (pp - 20) / 70 * (CW - padL - padR);
  const ys = (v: number) => padT + (1 - v / top) * (CH - padT - padB);
  const line = fine.map((c, k) => `${k ? 'L' : 'M'}${xs(c.pct).toFixed(1)},${ys(c.net).toFixed(1)}`).join(' ');
  const by = ys(r.long.net), bx = xs(r.breakEvenPct!);
  const mine = fine.find(c => c.pct === svlInput.occupancyPct)!;
  if (Math.abs(mine.net - r.short.net) > .5) throw new Error('Η καμπύλη δεν περνά από τα καθαρά του παραδείγματος.');
  const curveScene = (t: number) => scanChart({
    id: 'vc', W: CW, H: CH, padL, padR, padT, padB, xs, ys, line, t0: t,
    yTicks: Array.from({ length: top / step + 1 }, (_, k) => ({ v: k * step, label: feWhole(k * step) })),
    xTicks: [20, 30, 40, 50, 60, 70, 80, 90].map(x => ({ x, label: fpRate(x), hot: x === svlInput.occupancyPct })),
    scan: { pts: fine.map(c => [+xs(c.pct).toFixed(1), +ys(c.net).toFixed(1), `${fpRate(c.pct)}: ${feWhole(c.net)}`, c.net > r.long.net ? 1 : 0]), c0: S.ok, c1: S.accent, a: t + 1.0, b: t + 3.2, hold: .1, pw: 250 },
    extra: `<path pathLength="1" d="M${padL},${by.toFixed(1)} L${CW - padR},${by.toFixed(1)}" stroke="${S.ok}" stroke-width="5" stroke-dasharray="1" style="stroke-dashoffset:1" fill="none" data-draw="${t + .5},${t + 1.0}"/>
      <rect x="${bx.toFixed(1)}" y="${padT}" width="${(CW - padR - bx).toFixed(1)}" height="${(CH - padT - padB).toFixed(1)}" fill="${S.accent}" fill-opacity=".07" ${A('fade', t + 3.4, .5)}/>
      <rect x="${padL}" y="${padT}" width="${(bx - padL).toFixed(1)}" height="${(CH - padT - padB).toFixed(1)}" fill="${S.ok}" fill-opacity=".07" ${A('fade', t + 3.4, .5)}/>
      <circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="18" fill="none" stroke="${S.ink}" stroke-width="4" style="transform-box:fill-box;transform-origin:center;opacity:0" data-pulse="${t + 3.4}"/>`,
  }) + `<svg width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}" style="position:absolute;left:0;top:0;overflow:visible">
      <circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="15" fill="${S.ink}" style="transform-box:fill-box;transform-origin:center" ${A('pop', t + 3.4, .5)}/>
      <g style="transform-box:fill-box;transform-origin:center" ${A('pop', t + 3.9, .5)}><circle cx="${xs(mine.pct).toFixed(1)}" cy="${ys(mine.net).toFixed(1)}" r="15" fill="${S.accent}" stroke="${S.panel}" stroke-width="5"/><rect x="${(xs(mine.pct) - 90).toFixed(1)}" y="${(ys(mine.net) - 92).toFixed(1)}" width="180" height="56" rx="28" fill="${S.accent}"/><text x="${xs(mine.pct).toFixed(1)}" y="${(ys(mine.net) - 54).toFixed(1)}" text-anchor="middle" fill="${S.onAccent}" class="pill" font-size="26">${esc(feWhole(mine.net))}</text></g>
      <g style="transform-box:fill-box;transform-origin:center" ${A('pop', t + 3.55, .5)}><rect x="${(bx - 110).toFixed(1)}" y="${(by + 30).toFixed(1)}" width="220" height="58" rx="29" fill="${S.ink}"/><text x="${bx.toFixed(1)}" y="${(by + 69).toFixed(1)}" text-anchor="middle" fill="${S.ground}" class="pill" font-size="28">όριο ${bePct}%</text></g>
    </svg>`;

  const scenes: Scene[] = [
    { // 1 · Το αγκίστρι: η ερώτηση και το σπίτι που σχεδιάζεται
      dur: 4.5, ch: 0, tin: 'cut', tout: 'whip',
      html: t => `
        <div class="L h1" style="top:400px;font-size:122px;white-space:nowrap" ${A('slam', t, .55)}>Βραχυχρόνια</div>
        <div class="L h1 acc" style="top:530px;font-size:122px;white-space:nowrap" ${A('slam', t + BEAT, .55)}>ή μακροχρόνια;</div>
        <div class="L" style="top:740px">${plan(t)}</div>
        <div class="L lead" style="top:1250px;width:850px" ${A('up', t + 2.5, .6)}>Ποιο είδος μίσθωσης <b>αποφέρει περισσότερα;</b> Ο λογαριασμός, σε ένα λεπτό.</div>`,
      sfx: (m, t) => { m.boom(t + BEAT, .35); m.sweep(t + .3, 1.6, 300, 700, .03); m.pluck(t + 2.2, n('E5'), .06); },
    },
    { // 2 · Ίδιο σπίτι, δύο δρόμοι
      dur: 4, ch: 0, tin: 'whip', tout: 'whip',
      html: t => `
        <div class="L h2" style="top:400px" ${A('mask', t + .05, .6)}>Ίδιο σπίτι.</div>
        <div class="L h2 acc" style="top:505px" ${A('mask', t + .25, .6)}>Δύο δρόμοι.</div>
        <div class="L card" style="top:690px;width:410px;padding:36px 34px 34px;height:440px;display:flex;flex-direction:column" ${A('left', t + .55, .6)}>
          ${drawn(ICON.key, S.ok, 96, 1.6, t + .8, t + 1.6)}
          <div class="lbl" style="margin-top:22px">ΜΑΚΡΟΧΡΟΝΙΑ</div>
          <div class="num" style="font-size:104px;font-weight:900;letter-spacing:-.05em;line-height:1;margin-top:10px;color:${S.ok}">${esc(feWhole(svlInput.monthlyRent))}</div>
          <div style="font-size:30px;color:${S.muted};margin-top:8px">τον μήνα, ένας ενοικιαστής</div>
        </div>
        <div class="card" style="position:absolute;left:530px;top:690px;width:410px;padding:36px 34px 34px;height:440px;display:flex;flex-direction:column;border-color:${S.accent}88" ${A('right', t + .75, .6)}>
          ${drawn(SERIES.vraxy.glyph, S.accent, 96, 1.6, t + 1.0, t + 1.8)}
          <div class="lbl" style="margin-top:22px">ΒΡΑΧΥΧΡΟΝΙΑ</div>
          <div class="num" style="font-size:104px;font-weight:900;letter-spacing:-.05em;line-height:1;margin-top:10px;color:${S.accent}">${esc(feWhole(svlInput.nightlyPrice))}</div>
          <div style="font-size:30px;color:${S.muted};margin-top:8px">τη νύχτα, όσες γεμίσουν</div>
        </div>
        <div class="L lead" style="top:1200px;width:850px" ${A('up', t + 1.9, .6)}>Μετράμε τα <b>καθαρά του χρόνου</b>, μετά από φόρο και έξοδα.</div>`,
      sfx: (m, t) => { m.whoosh(t + .55, .6, .12, false); m.whoosh(t + .75, .6, .12, false); m.sweep(t + .8, 1, 500, 900, .025); },
    },
    chapterCard(1, 3, 'Μακροχρόνια'),
    { // 4 · Δώδεκα ενοίκια, ο μετρητής ανεβαίνει με κάθε μήνα
      dur: 4, ch: 1, tin: 'whip', tout: 'cut',
      html: t => {
        const tk = (k: number) => t + .5 + k * .16;
        return `
        <div class="L h2" style="top:400px" ${A('mask', t + .05, .6)}>Δώδεκα ενοίκια.</div>
        <div class="L lead" style="top:530px" ${A('up', t + .25, .5)}>${esc(feWhole(svlInput.monthlyRent))} κάθε μήνα, όλο τον χρόνο.</div>
        <div class="L" style="top:660px;display:grid;grid-template-columns:repeat(4,203px);gap:12px">
          ${Array.from({ length: 12 }, (_, k) => `<div class="tile" style="padding:20px 0;background:${S.ok}18;border-color:${S.ok}55" ${A('pop', tk(k), .4)}><div style="font-size:24px;color:${S.faint}">${esc(elDate(`2026-${String(k + 1).padStart(2, '0')}-15`, { month: 'short' }).replace('.', ''))}</div><div class="num" style="font-size:40px;font-weight:850;color:${S.ok}">${esc(feWhole(svlInput.monthlyRent))}</div></div>`).join('')}
        </div>
        <div class="L lbl" style="top:1110px" ${A('fade', t + .5, .4)}>ΕΝΟΙΚΙΑ ΤΟΝ ΧΡΟΝΟ</div>
        <div class="L" style="top:1160px"><span class="big ok glow num">${counter(Array.from({ length: 12 }, (_, k) => seg(tk(k), tk(k) + .14, k * svlInput.monthlyRent, (k + 1) * svlInput.monthlyRent)))}</span></div>`;
      },
      sfx: (m, t) => { for (let k = 0; k < 12; k++) { m.click(t + .5 + k * .16, 1800 + k * 50, .12); m.pluck(t + .5 + k * .16, n('A4') + [0, 3, 7, 10][k % 4], .02, k % 2 ? .3 : -.3); } m.bell(t + 2.4, n('A5'), .07); },
    },
    { // 5 · Φεύγει μόνο ο φόρος
      dur: 4.5, ch: 1, tin: 'cut', tout: 'whip',
      html: t => `
        <div class="L h2" style="top:400px" ${A('mask', t + .05, .6)}>Φεύγει</div>
        <div class="L h2" style="top:505px" ${A('mask', t + .2, .6)}>μόνο <span class="neg">ο φόρος.</span></div>
        <div class="L lbl" style="top:700px" ${A('fade', t + .3, .4)}>ΕΝΟΙΚΙΑ ${esc(feWhole(r.long.gross))}</div>
        <div class="L bar" style="top:750px" ${A('grow', t + .3, .7)}>${ghost(S.neg, r.long.tax, t + 1.6)}<i style="flex-grow:${r.long.net};background:${S.ok}"></i></div>
        <div class="L" style="top:900px;width:850px">${feeRow(ICON.receipt, S.neg, 'Φόρος εισοδήματος', r.long.tax, t + 1.1)}</div>
        <div class="L" style="top:1060px"><span class="big ok glow num">${counter([seg(t + 1.7, t + 2.4, r.long.gross, r.long.net)])}</span></div>
        <div class="L lead" style="top:1270px;color:${S.ok}" ${A('up', t + 2.4, .5)}>καθαρά τον χρόνο, χωρίς άλλο έξοδο.</div>`,
      sfx: (m, t) => { m.sweep(t + .3, .7, 300, 600, .03); m.whoosh(t + 1.6, .7, .16, false); m.boom(t + 1.6, .25); for (let k = 0; k < 10; k++) m.click(t + 1.7 + k * .07, 2400 - k * 60, .05); },
    },
    chapterCard(2, 3, 'Βραχυχρόνια'),
    { // 7 · Οι 365 νύχτες: ανάβουν όσες γεμίζουν
      dur: 5, ch: 2, tin: 'whip', tout: 'cut',
      html: t => `
        <div class="L h2" style="top:400px;white-space:nowrap" ${A('mask', t + .05, .6)}>Πληρότητα <span class="acc">${fpRate(svlInput.occupancyPct)}.</span></div>
        <div class="L lead" style="top:530px" ${A('up', t + .25, .5)}>Κάθε τελεία, μία νύχτα του χρόνου.</div>
        <div class="L" style="top:640px;width:850px">${dotsHtml(t + .7, t + 3.0)}</div>
        <div class="L" style="top:1180px;display:flex;align-items:baseline;gap:22px"><span class="num acc glow" style="font-size:120px;font-weight:900;letter-spacing:-.05em;line-height:1">${counter([seg(t + .7, t + 3.0, 0, r.short.nights, String, 0, true)])}</span><span class="lead" style="color:${S.ink}">νύχτες από ${NIGHTS}</span></div>
        <div class="L lead" style="top:1330px;width:850px" ${A('up', t + 3.1, .5)}>× ${esc(feWhole(svlInput.nightlyPrice))} = <b>${esc(feWhole(r.short.gross))}</b> έσοδα τον χρόνο.</div>`,
      sfx: (m, t) => { for (let k = 0; k < 46; k++) m.click(t + .7 + k * .05, 2600 + (k % 5) * 90, .04, (k % 2 ? .4 : -.4)); m.sweep(t + .7, 2.3, 400, 1200, .03); m.bell(t + 3.1, n('E5'), .07); },
    },
    { // 8 · Διπλάσια έσοδα, αλλά τα μισά φεύγουν
      dur: 6.5, ch: 2, tin: 'cut', tout: 'whip',
      html: t => {
        const tf = [t + 1.6, t + 2.6, t + 3.6];
        let left = r.short.gross;
        const segs: Seg[] = fees.map((f, i) => { const s = seg(tf[i] + .1, tf[i] + .7, left, left - f.v); left -= f.v; return s; });
        return `
        <div class="L h2" style="top:400px" ${A('mask', t + .05, .6)}>${grossWord} έσοδα.</div>
        <div class="L lead" style="top:530px;width:850px" ${A('up', t + .3, .5)}>Τα μισά όμως φεύγουν, σε τρία σημεία.</div>
        <div class="L lbl" style="top:680px" ${A('fade', t + .6, .4)}>ΕΣΟΔΑ ${esc(feWhole(r.short.gross))}</div>
        <div class="L bar" style="top:730px" ${A('grow', t + .6, .7)}>${fees.map((f, i) => ghost(f.c, f.v, tf[i])).join('')}<i style="flex-grow:${r.short.net};background:${S.accent}"></i></div>
        <div class="L" style="top:880px;width:850px;display:flex;flex-direction:column;gap:22px">${fees.map((f, i) => feeRow(f.icon, f.c, f.label, f.v, tf[i] - .25)).join('')}</div>
        <div class="L" style="top:1160px"><span class="big acc glow num">${counter([seg(t + .6, t + 1.2, 0, r.short.gross), ...segs])}</span></div>
        <div class="L lead" style="top:1370px;color:${S.accent}" ${A('up', t + 4.4, .5)}>καθαρά τον χρόνο.</div>`;
      },
      sfx: (m, t) => { m.sweep(t + .6, .7, 300, 700, .03); [1.6, 2.6, 3.6].forEach((d, i) => { m.whoosh(t + d, .7, .15, false); m.boom(t + d, .2 + i * .04); }); m.bell(t + 4.4, n('C6'), .06); },
    },
    { // 9 · Το τέλος ανθεκτικότητας: το πληρώνει ο επισκέπτης
      dur: 4, ch: 2, tin: 'whip', tout: 'whip',
      html: t => `
        <div class="L h2" style="top:400px;font-size:92px" ${A('mask', t + .05, .6)}>Και το τέλος</div>
        <div class="L h2" style="top:495px;font-size:92px" ${A('mask', t + .2, .6)}>ανθεκτικότητας;</div>
        <div class="L" style="top:680px;width:850px;height:300px;transform-origin:30% 50%" ${A('tilt', t + .4, .8)}>
          <div style="position:absolute;inset:0;border-radius:30px;background:linear-gradient(135deg,${S.warm}26,${S.warm}0d);border:2px solid ${S.warm}88"></div>
          <div style="position:absolute;left:-26px;top:124px;width:52px;height:52px;border-radius:50%;background:${S.ground}"></div>
          <div style="position:absolute;right:-26px;top:124px;width:52px;height:52px;border-radius:50%;background:${S.ground}"></div>
          <div style="position:absolute;left:600px;top:30px;bottom:30px;border-left:3px dashed ${S.warm}66"></div>
          <div style="position:absolute;left:52px;top:44px"><div class="lbl" style="color:${S.warm}">ΤΕΛΟΣ ΑΝΘΕΚΤΙΚΟΤΗΤΑΣ</div><div class="num" style="font-size:120px;font-weight:900;letter-spacing:-.05em;line-height:1;margin-top:16px;color:${S.warm}">${esc(feWhole(r.short.levy))}</div><div style="font-size:28px;color:${S.muted};margin-top:10px">τον χρόνο, για ${r.short.nights} νύχτες</div></div>
          <div style="position:absolute;left:630px;top:82px;width:180px;text-align:center">${glyph(ICON.receipt, S.warm, 64, 1.8)}<div style="font-size:24px;color:${S.muted};margin-top:10px;line-height:1.25">το πληρώνει ο επισκέπτης</div></div>
        </div>
        <div class="L" style="top:1030px;padding:16px 30px;border:6px solid ${S.neg};border-radius:20px;color:${S.neg};font-size:44px;font-weight:900;letter-spacing:.04em;background:${S.neg}14" ${A('thump', t + 1.4, .6)}>ΔΕΝ ΕΙΝΑΙ ΕΣΟΔΟ ΣΟΥ</div>
        <div class="L lead" style="top:1210px;width:850px" ${A('up', t + 1.9, .5)}>Μπαίνει πάνω από την τιμή σου και το αποδίδεις εσύ.</div>`,
      sfx: (m, t) => { m.whoosh(t + .4, .8, .12, false); m.click(t + .9, 1400, .1); m.boom(t + 1.4, .4); m.clap(t + 1.4, .1); },
    },
    chapterCard(3, 3, 'Η πληρότητα κρίνει'),
    { // 11 · Η καμπύλη με σάρωση: πού συναντιούνται
      dur: 5.5, ch: 3, tin: 'iris', tout: 'zoom',
      html: t => `
        <div class="L h2" style="top:400px;font-size:84px;white-space:nowrap" ${A('mask', t + .05, .6)}>Πού συναντιούνται;</div>
        <div class="L" style="top:530px;display:flex;gap:34px;font-size:28px;color:${S.muted}" ${A('fade', t + .3, .4)}><span style="display:flex;align-items:center;gap:12px"><i style="width:40px;height:7px;border-radius:7px;background:${S.accent};display:block"></i>Βραχυχρόνια</span><span style="display:flex;align-items:center;gap:12px"><i style="width:40px;border-top:5px dashed ${S.ok};display:block"></i>Μακροχρόνια ${esc(feWhole(r.long.net))}</span></div>
        <div class="L" style="top:600px;width:${CW}px;height:${CH}px">${curveScene(t)}</div>
        <div class="L lead" style="top:1230px;width:850px" ${A('up', t + 3.7, .5)}>Στο <b>${bePct}%</b> αποφέρουν τα ίδια: <b>${r.breakEvenNights} νύχτες</b> τον χρόνο.</div>`,
      sfx: (m, t) => { m.sweep(t + 1.0, 2.2, 260, 980, .045); m.bell(t + 3.4, n('E5'), .1); m.boom(t + 3.4, .25); },
    },
    { // 12 · Η ετυμηγορία
      dur: 4, ch: 3, tin: 'zoom', tout: 'whip',
      html: t => `
        <div class="L lbl" style="top:470px" ${A('fade', t + .05, .3)}>ΚΑΤΩ ΑΠΟ ${bePct}%</div>
        <div class="L h1 ok glow" style="top:520px;font-size:128px;white-space:nowrap" ${A('slam', t + .1, .5)}>Μακροχρόνια.</div>
        <div class="L lbl" style="top:760px" ${A('fade', t + .6, .3)}>ΠΑΝΩ ΑΠΟ ${bePct}%</div>
        <div class="L h1 acc glow" style="top:810px;font-size:128px;white-space:nowrap" ${A('slam', t + .65, .5)}>Βραχυχρόνια.</div>
        <div class="L lead" style="top:1100px;width:850px" ${A('up', t + 1.4, .6)}>Και ο χρόνος που θέλει η βραχυχρόνια <b>δεν μπαίνει στον λογαριασμό.</b></div>`,
      sfx: (m, t) => { m.boom(t + .1, .45); m.boom(t + .65, .4); m.clap(t + .65, .08); },
    },
    calcScene(4, 'Βάλε τα δικά σου', 'δεδομένα.', path, 'Βραχυχρόνια ή μακροχρόνια', [
      ['Ενοίκιο τον μήνα', feWhole(svlInput.monthlyRent)], ['Τιμή διανυκτέρευσης', feWhole(svlInput.nightlyPrice)],
      ['Πληρότητα', fpRate(svlInput.occupancyPct)], ['Προμήθεια πλατφόρμας', fpRate(svlInput.platformFeePct)],
    ], { label: 'Διαφορά υπέρ βραχυχρόνιας', to: r.difference, fmt: x => `+${feWhole(x)}` }),
    sumScene(4, 'Βραχυχρόνια ή μακροχρόνια', [
      ['Μακροχρόνια, καθαρά', feWhole(r.long.net), `${feWhole(svlInput.monthlyRent)} τον μήνα`],
      ['Βραχυχρόνια, καθαρά', feWhole(r.short.net), `${feWhole(svlInput.nightlyPrice)} τη νύχτα, πληρότητα ${fpRate(svlInput.occupancyPct)}`],
      ['Το όριο', fpRate(bePct), `${r.breakEvenNights} νύχτες τον χρόνο`],
      ['Προμήθεια πλατφόρμας', feWhole(r.short.platformFee), `το ${fpRate(svlInput.platformFeePct)} των εσόδων`],
    ], 'Αποθήκευσέ το για όταν αποφασίσεις.'),
    noaScene(4, 'Ποιο είδος μίσθωσης μου αποφέρει περισσότερα;',
      `Στο ${fpRate(svlInput.occupancyPct)} η βραχυχρόνια αποφέρει ${feWhole(r.difference)} περισσότερα τον χρόνο. Κάτω από ${fpRate(bePct)}, η μακροχρόνια.`),
    outroScene(4, SEND, SERIES.vraxy.day, 'ΤΑΚΚ: τι αλλάζει την 1η Νοεμβρίου', path),
  ];
  return {
    key: 'vraxy-e01', series: 'vraxy', scenes, chords: [ch('A3', 'C4', 'E4'), ch('F3', 'A3', 'C4'), ch('C3', 'G3', 'E4'), ch('G3', 'B3', 'D4')],
    chapters: ['Το ερώτημα', 'Μακροχρόνια', 'Βραχυχρόνια', 'Η πληρότητα κρίνει', 'Τα δικά σου'],
    cover: 3.3, campaign: camp, link: utm(path, camp), title: 'Βραχυχρόνια ή μακροχρόνια;',
    caption: [
      'Βραχυχρόνια ή μακροχρόνια; Ποιο είδος μίσθωσης αποφέρει περισσότερα κρίνεται από ένα νούμερο: την πληρότητα.',
      '',
      `Το ίδιο διαμέρισμα των ${svlInput.sqm} τ.μ. Με ${feWhole(svlInput.monthlyRent)} τον μήνα, η μακροχρόνια αποφέρει ${feWhole(r.long.net)} καθαρά τον χρόνο: φεύγει μόνο ο φόρος.`,
      '',
      `Με ${feWhole(svlInput.nightlyPrice)} τη νύχτα και πληρότητα ${fpRate(svlInput.occupancyPct)}, η βραχυχρόνια φέρνει ${grossWord.toLowerCase()} έσοδα, ${feWhole(r.short.gross)}. Αφαιρείς προμήθεια πλατφόρμας ${feWhole(r.short.platformFee)}, καθαριότητα και πάγια ${feWhole(r.short.running)}, φόρο ${feWhole(r.short.tax)} και μένουν ${feWhole(r.short.net)}. Το τέλος ανθεκτικότητας (${feWhole(r.short.levy)}) το πληρώνει ο επισκέπτης· δεν είναι έσοδό σου.`,
      '',
      `Το όριο είναι το ${fpRate(bePct)}: κάτω από ${r.breakEvenNights} νύχτες τον χρόνο, αποφέρει περισσότερα η μακροχρόνια.`,
      '',
      'Βάλε τα δικά σου δεδομένα στον δωρεάν υπολογιστή: γράψε «ΥΠΟΛΟΓΙΣΤΗΣ» στα σχόλια και σου στέλνουμε τον σύνδεσμο. Είναι και στο βιογραφικό.',
      '',
      SEND,
      '',
      '#βραχυχρόνιαμίσθωση #airbnbgreece #ακίνητα #ενοίκιο #ιδιοκτήτες',
    ].join('\n'),
  };
}

// ═══ ΦΟΡΟΙ ΚΑΙ ΠΡΟΘΕΣΜΙΕΣ ════════════════════════════════════════════════
function foroiReel(): Reel {
  const F = foroiFacts(PUBLISH.foroi);
  const E = enfiaExample();
  const camp = 'foroi-e01', path = '/ypologismos-enfia';
  const weekday = elDate(F.due.date, { weekday: 'long' });
  const left = F.run.length - F.next - 1;
  const zLabel = (k: string) => k.startsWith('over_') ? `πάνω από ${feWhole(Number(k.slice(5)))}` : `${fn(Number(k.split('_')[0]))}–${feWhole(Number(k.split('_')[1]))}`;
  // ── Ο κανόνας του Σαββατοκύριακου, από το ίδιο το ημερολόγιο ──
  const lastDay = (iso: string) => { const [y, mo] = iso.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); };
  const shifted = F.run.filter(o => o.date !== lastDay(o.date));
  const ex = shifted.find(o => o.id === F.due.id) ?? shifted[0];
  if (!ex) throw new Error('Καμία δόση δεν μετατίθεται· η σκηνή του Σαββατοκύριακου θέλει αλλαγή.');
  const exLast = lastDay(ex.date), exLastWd = new Date(`${exLast}T12:00:00Z`).getUTCDay();
  if (exLastWd !== 0 && exLastWd !== 6) throw new Error('Η μετάθεση του παραδείγματος δεν οφείλεται σε Σαββατοκύριακο.');
  const exDays = Array.from({ length: 5 }, (_, k) => { const d = new Date(`${exLast}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 4 + k); return d.toISOString().slice(0, 10); });
  // ── Ο μήνας της δόσης, ως ημερολόγιο με αρχή τη Δευτέρα ──
  const [dy, dm] = F.due.date.split('-').map(Number);
  const first = new Date(Date.UTC(dy, dm - 1, 1)), lead = (first.getUTCDay() + 6) % 7, days = new Date(Date.UTC(dy, dm, 0)).getUTCDate();
  const pubDay = PUBLISH.foroi.startsWith(F.due.date.slice(0, 7)) ? Number(PUBLISH.foroi.slice(8)) : 0;
  const wdNames = Array.from({ length: 7 }, (_, k) => elDate(`2026-10-${String(5 + k).padStart(2, '0')}`, { weekday: 'short' }));
  if (Math.abs(E.sqm * E.zt * E.fc * E.ac - E.r.basic) > .006) throw new Error('Ο τύπος δεν δίνει τον κύριο φόρο.');
  const tok = (v: string, label: string, t0: number, c = S.ink) => `<div class="tile" style="width:186px;height:170px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px" ${A('pop', t0, .45)}><b class="num" style="font-size:52px;font-weight:850;letter-spacing:-.03em;color:${c}">${esc(v)}</b><small style="font-size:21px;color:${S.faint};line-height:1.15;text-align:center;padding:0 8px">${esc(label)}</small></div>`;
  const times = (t0: number) => `<b style="font-size:44px;color:${S.faint};font-weight:600;width:24px;text-align:center" ${A('fade', t0, .3)}>×</b>`;

  const scenes: Scene[] = [
    { // 1 · Η σφραγίδα: λήγει
      dur: 4.5, ch: 0, tin: 'cut', tout: 'whip',
      html: t => `
        <div class="L" style="top:410px;display:flex;flex-direction:column;align-items:center;padding:34px 70px 40px;border:9px solid ${S.warm};border-radius:34px;color:${S.warm};background:${S.warm}12;box-shadow:0 0 160px -20px ${S.warm}66" ${A('thump', t + .05, .7)}>
          <div style="font-family:'Roboto Mono',monospace;font-size:36px;letter-spacing:.42em;font-weight:700;margin-left:.42em">ΛΗΓΕΙ</div>
          <div class="num" style="font-size:250px;font-weight:900;letter-spacing:-.06em;line-height:.9;margin-top:8px">${F.dd}/${F.mm}</div>
          <div style="font-size:44px;font-weight:750;margin-top:6px">${esc(weekday)}</div>
        </div>
        <div class="L h2" style="top:1000px" ${A('mask', t + 1.0, .6)}>Η ${F.next + 1}η δόση</div>
        <div class="L h2 acc" style="top:1105px" ${A('mask', t + 1.2, .6)}>του ΕΝΦΙΑ.</div>
        <div class="L lead" style="top:1270px;width:850px" ${A('up', t + 2.0, .5)}>Σε <b>${F.daysLeft} ημέρες.</b> Μετά μένουν άλλες ${left}.</div>`,
      sfx: (m, t) => { m.boom(t + .05, .6); m.clap(t + .05, .12); m.bell(t + 1.0, n('D5'), .06); },
    },
    { // 2 · Ο μήνας της δόσης: οι μέρες που μένουν ανάβουν
      dur: 4, ch: 0, tin: 'whip', tout: 'whip',
      html: t => {
        const span = F.dd - pubDay;
        return `
        <div class="L h2" style="top:400px;white-space:nowrap" ${A('mask', t + .05, .6)}>${esc(monthNom(F.due.date))} ${dy}</div>
        <div class="L lead" style="top:520px;width:850px" ${A('up', t + .25, .5)}>Πλήρωσέ τη ως την ${esc(weekday)} ${F.dd} ${esc(elDate(F.due.date, { day: 'numeric', month: 'long' }).split(' ')[1])}.</div>
        <div class="L card" style="top:660px;width:850px;padding:28px 30px" ${A('up', t + .3, .6)}>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:10px;margin-bottom:12px">${wdNames.map(w => `<div class="lbl" style="font-size:20px;text-align:center">${esc(up(w))}</div>`).join('')}</div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:10px">
            ${Array.from({ length: lead }, () => '<div></div>').join('')}
            ${Array.from({ length: days }, (_, k) => {
              const d = k + 1, wd = (lead + k) % 7, isDue = d === F.dd, isPub = d === pubDay, inRun = d > pubDay && d <= F.dd;
              const tt = t + .8 + (d - pubDay - 1) / Math.max(1, span) * 1.6;
              return `<div class="num" style="position:relative;height:74px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:700;color:${wd >= 5 ? S.faint : S.muted};${isPub ? `box-shadow:inset 0 0 0 3px ${S.ink}` : ''}">
                ${inRun ? `<i style="position:absolute;inset:0;border-radius:16px;background:${isDue ? S.warm : `${S.warm}2e`}" ${A('pop', tt, .35)}></i>` : ''}
                <span style="position:relative;${isDue ? `color:${S.onAccent};font-weight:900` : inRun ? `color:${S.ink}` : ''}">${d}</span>
                ${isDue ? `<i style="position:absolute;inset:-4px;border-radius:20px;border:4px solid ${S.warm};opacity:0" data-pulse="${(t + 2.5).toFixed(2)},.6"></i>` : ''}
              </div>`;
            }).join('')}
          </div>
        </div>`;
      },
      sfx: (m, t) => { for (let k = 0; k < 21; k++) m.click(t + .8 + k * 1.6 / 21, 1700 + k * 40, .08); m.bell(t + 2.5, n('A5'), .08); },
    },
    chapterCard(1, 3, 'Πότε λήγει'),
    { // 4 · Οι δώδεκα δόσεις
      dur: 5, ch: 1, tin: 'iris', tout: 'whip',
      html: t => `
        <div class="L h2" style="top:400px;font-size:92px;white-space:nowrap" ${A('mask', t + .05, .6)}>Τελευταία εργάσιμη</div>
        <div class="L h2 acc" style="top:495px;font-size:92px" ${A('mask', t + .2, .6)}>κάθε μήνα.</div>
        <div class="L lead" style="top:620px;width:850px" ${A('up', t + .35, .5)}>Δώδεκα δόσεις, από τον ${esc(monthAcc(F.run[0].date))} ως τον ${esc(monthAcc(F.run[F.run.length - 1].date))}.</div>
        <div class="L" style="top:770px;display:grid;grid-template-columns:repeat(4,200px);gap:16px">
          ${F.run.map((o, i) => `<div class="tile" style="position:relative;padding:20px 0;${i === F.next ? `background:${S.warm};border-color:${S.warm};color:${S.onAccent}` : ''}" ${A('pop', t + .7 + i * .12, .45)}>
            <div ${i < F.next ? A('dim', t + 2.4, .5) : ''}><div style="font-size:23px;font-weight:600;color:${i === F.next ? S.onAccent : S.faint}">${i + 1}η</div><div style="font-size:40px;font-weight:850">${esc(elDate(o.date, { month: 'short' }).replace('.', ''))}</div><div class="num" style="font-size:29px;color:${i === F.next ? S.onAccent : S.muted}">${esc(elDate(o.date, { day: 'numeric' }))}</div></div>
            ${i === F.next ? `<div style="position:absolute;inset:-6px;border-radius:26px;border:5px solid ${S.warm};opacity:0" data-pulse="${t + 2.9},.5"></div>` : ''}
          </div>`).join('')}
        </div>
        <div class="L" style="top:1330px;font-family:'Roboto Mono',monospace;font-size:24px;letter-spacing:.06em;color:${S.faint}" ${A('fade', t + 3.0, .5)}>${esc(F.law)}</div>`,
      sfx: (m, t) => { F.run.forEach((_, i) => m.click(t + .7 + i * .12, 1600 + i * 50, .12)); m.bell(t + 2.9, n('D5'), .1); },
    },
    { // 5 · Ο κανόνας του Σαββατοκύριακου
      dur: 4.5, ch: 1, tin: 'whip', tout: 'whip',
      html: t => {
        const exI = exDays.indexOf(ex.date), lastI = 4;
        const cx = (i: number) => 80 + i * 172;
        return `
        <div class="L h2" style="top:400px;font-size:92px" ${A('mask', t + .05, .6)}>Πέφτει σε</div>
        <div class="L h2" style="top:495px;font-size:92px" ${A('mask', t + .2, .6)}>Σαββατοκύριακο;</div>
        <div class="L" style="top:700px;width:850px;height:110px">
          <svg width="850" height="110" viewBox="0 0 850 110" style="overflow:visible"><path pathLength="1" d="M${cx(lastI)},100 C${cx(lastI)},10 ${cx(exI)},10 ${cx(exI)},92" fill="none" stroke="${S.warm}" stroke-width="5" stroke-linecap="round" stroke-dasharray="1" style="stroke-dashoffset:1" data-draw="${t + 1.6},${t + 2.3}"/><path d="M${cx(exI) - 14},76 L${cx(exI)},96 L${cx(exI) + 14},76" fill="none" stroke="${S.warm}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" ${A('fade', t + 2.25, .2)}/></svg>
        </div>
        <div class="L" style="top:820px;display:grid;grid-template-columns:repeat(5,160px);gap:12px">
          ${exDays.map((d, i) => {
            const wd = new Date(`${d}T12:00:00Z`).getUTCDay(), weekend = wd === 0 || wd === 6, isEx = d === ex.date;
            return `<div class="tile" style="position:relative;height:240px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;${weekend ? `background:repeating-linear-gradient(135deg,#ffffff08 0 12px,transparent 12px 24px);` : ''}${isEx ? `border-color:${S.warm}` : ''}" ${A('pop', t + .5 + i * .1, .45)}>
              <div style="font-size:28px;color:${weekend ? S.faint : S.muted}">${esc(elDate(d, { weekday: 'short' }))}</div>
              <div class="num" style="font-size:76px;font-weight:850;color:${weekend ? S.faint : S.ink}">${Number(d.slice(8))}</div>
              ${isEx ? `<i style="position:absolute;inset:-3px;border-radius:24px;background:${S.warm}" ${A('pop', t + 2.3, .4)}></i><div class="num" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:${S.onAccent}" ${A('fade', t + 2.35, .3)}><div style="font-size:28px;font-weight:700">${esc(elDate(d, { weekday: 'short' }))}</div><div style="font-size:76px;font-weight:900">${Number(d.slice(8))}</div></div>` : ''}
              ${i === lastI ? `<svg width="160" height="240" viewBox="0 0 160 240" style="position:absolute;inset:0"><path pathLength="1" d="M30,60 L130,180" stroke="${S.neg}" stroke-width="8" stroke-linecap="round" stroke-dasharray="1" style="stroke-dashoffset:1" data-draw="${t + 1.1},${t + 1.4}"/><path pathLength="1" d="M130,60 L30,180" stroke="${S.neg}" stroke-width="8" stroke-linecap="round" stroke-dasharray="1" style="stroke-dashoffset:1" data-draw="${t + 1.3},${t + 1.6}"/></svg>` : ''}
            </div>`;
          }).join('')}
        </div>
        <div class="L lead" style="top:1130px;width:850px" ${A('up', t + 2.5, .5)}><b>${esc(elDate(exLast, { day: 'numeric', month: 'long' }))}: ${esc(elDate(exLast, { weekday: 'long' }))}.</b> Η δόση λήγει την ${esc(elDate(ex.date, { weekday: 'long' }))} ${Number(ex.date.slice(8))}. Το ίδιο και με αργία.</div>`;
      },
      sfx: (m, t) => { [0, 1, 2, 3, 4].forEach(i => m.click(t + .5 + i * .1, 1500 + i * 80, .1)); m.whoosh(t + 1.1, .4, .1); m.boom(t + 1.3, .2); m.sweep(t + 1.6, .7, 500, 900, .03); m.bell(t + 2.3, n('F5'), .09); },
    },
    chapterCard(2, 3, 'Γιατί τόσος;'),
    { // 7 · Ο φόρος ανά τ.μ. ανά ζώνη
      dur: 5.5, ch: 2, tin: 'iris', tout: 'zoom',
      html: t => `
        <div class="L h2" style="top:400px;font-size:92px" ${A('mask', t + .05, .6)}>Ίδια τετραγωνικά,</div>
        <div class="L h2" style="top:495px;font-size:92px" ${A('mask', t + .2, .6)}><span class="acc">${Math.floor(F.zMax / F.zMin)} φορές</span> ο φόρος.</div>
        <div class="L lbl" style="top:660px" ${A('fade', t + .5, .4)}>ΦΟΡΟΣ ΑΝΑ Τ.Μ. · ΤΙΜΗ ΖΩΝΗΣ €/Τ.Μ.</div>
        <div class="L" style="top:720px;width:850px;display:flex;flex-direction:column;gap:12px">
          ${F.zones.map(([k, v], i) => {
            const mineZ = k === E.zone;
            return `<div style="display:grid;grid-template-columns:240px 1fr 130px;align-items:center;gap:16px;padding:6px 10px;border-radius:14px;${mineZ ? `background:${S.accent}1a;box-shadow:inset 0 0 0 2px ${S.accent}88` : ''}">
              <span style="font-family:'Roboto Mono',monospace;font-size:21px;color:${mineZ ? S.accent : S.faint}" ${A('fade', t + .6 + i * .14, .3)}>${esc(zLabel(k))}</span>
              <div style="height:28px;border-radius:9px;background:#ffffff0a"><i style="display:block;height:100%;width:${pc(v / F.zMax * 100)};border-radius:9px;background:${mineZ ? S.accent : i === F.zones.length - 1 ? S.neg : S.warm};transform-origin:left center" ${A('grow', t + .6 + i * .14, .6)}></i></div>
              <b class="num" style="text-align:right;font-size:30px;font-weight:800" ${A('fade', t + .9 + i * .14, .3)}>${esc(fe(v))}</b></div>`;
          }).join('')}
        </div>
        <div class="L lead" style="top:1300px;width:850px" ${A('up', t + 2.6, .5)}>Με γαλάζιο η ζώνη του παραδείγματος: <b>${esc(feWhole(E.price))} το τ.μ.</b></div>`,
      sfx: (m, t) => { F.zones.forEach((_, i) => m.pluck(t + .6 + i * .14, n('D4') + [0, 2, 3, 5, 7, 8, 10, 12, 14][i % 9], .05, i % 2 ? .3 : -.3)); m.boom(t + .6 + (F.zones.length - 1) * .14, .3); },
    },
    { // 8 · Ο τύπος, παράγοντας προς παράγοντα
      dur: 6.5, ch: 2, tin: 'zoom', tout: 'whip',
      html: t => `
        <div class="L h2" style="top:400px;font-size:92px" ${A('mask', t + .05, .6)}>Πώς βγαίνει</div>
        <div class="L h2 acc" style="top:495px;font-size:92px" ${A('mask', t + .2, .6)}>ο λογαριασμός.</div>
        <div class="L" style="top:650px;width:850px;display:flex;align-items:center;justify-content:space-between">
          ${tok(fn(E.sqm), 'τ.μ.', t + .5)}${times(t + .7)}${tok(fe(E.zt), `ζώνη ${feWhole(E.price)}`, t + .8, S.accent)}${times(t + 1.0)}${tok(fn(E.fc, 2), E.floorLabel, t + 1.1)}${times(t + 1.3)}${tok(fn(E.ac, 2), E.ageLabel, t + 1.4)}
        </div>
        <div class="L" style="top:870px;width:850px;display:flex;align-items:baseline;justify-content:space-between" ${A('up', t + 1.9, .5)}><span class="lead">Κύριος φόρος</span><b class="num" style="font-size:72px;font-weight:900;letter-spacing:-.04em">${counter([seg(t + 1.9, t + 2.6, 0, E.r.basic, fe, 2)])}</b></div>
        <div class="L" style="top:990px;width:850px;display:flex;align-items:center;justify-content:space-between;padding:20px 26px;border-radius:24px;background:${S.ok}14;border:1.5px solid ${S.ok}55" ${A('right', t + 2.9, .55)}><span style="font-size:32px;color:${S.ink};font-weight:700">Μείωση ${fpRate(E.r.reductionPct)}<small style="display:block;font-size:22px;color:${S.faint};font-weight:500;margin-top:4px">${E.limit ? `ακίνητη περιουσία ως ${esc(feWhole(E.limit))}` : 'αυτόματη, από τη συνολική αξία'}</small></span><b class="num" style="font-size:44px;color:${S.ok};font-weight:850">−${esc(fe(E.r.reductionAmount))}</b></div>
        <div class="L lbl" style="top:1170px" ${A('fade', t + 3.4, .4)}>ΕΝΦΙΑ ΤΟΝ ΧΡΟΝΟ</div>
        <div class="L" style="top:1215px"><span class="num warm glow" style="font-size:170px;font-weight:900;letter-spacing:-.06em;line-height:.94">${counter([seg(t + 3.4, t + 4.2, E.r.basic, E.r.annual, fe, 2)])}</span></div>`,
      sfx: (m, t) => { [0, 1, 2, 3].forEach(i => { m.pluck(t + .5 + i * .3, n('D5') + [0, 3, 7, 10][i], .05, i % 2 ? .3 : -.3); }); for (let k = 0; k < 12; k++) m.click(t + 1.9 + k * .06, 2200 + k * 40, .05); m.whoosh(t + 2.9, .6, .12, false); m.boom(t + 3.4, .3); m.bell(t + 4.2, n('A5'), .08); },
    },
    calcScene(3, 'Πόσος είναι', 'ο δικός σου;', path, 'Υπολογισμός ΕΝΦΙΑ', [
      ['Τετραγωνικά', `${fn(E.sqm)} τ.μ.`], ['Τιμή ζώνης', `${feWhole(E.price)}/τ.μ.`],
      ['Όροφος', E.floorLabel], ['Παλαιότητα', E.ageLabel],
    ], { label: 'ΕΝΦΙΑ τον χρόνο', to: E.r.annual, fmt: fe, dec: 2 }),
    sumScene(3, `ΕΝΦΙΑ ${F.year}`, [
      ['Η επόμενη δόση', `${F.dd}/${F.mm}`, `${weekday}, η ${F.next + 1}η από τις ${F.run.length}`],
      ['Κάθε δόση λήγει', 'τέλος μήνα', 'την τελευταία εργάσιμη'],
      ['Φόρος ανά τ.μ.', `${fe(F.zMin)}–${fe(F.zMax)}`, 'ανάλογα με την τιμή ζώνης'],
      [`${fn(E.sqm)} τ.μ., ζώνη ${feWhole(E.price)}`, fe(E.r.annual), 'ΕΝΦΙΑ τον χρόνο, με τη μείωση'],
    ], 'Αποθήκευσέ το για τις επόμενες δόσεις.'),
    noaScene(3, 'Πότε λήγει η επόμενη δόση του ΕΝΦΙΑ;',
      `${weekday} ${elDate(F.due.date, { day: 'numeric', month: 'long' })}. Είναι η ${F.next + 1}η από τις ${F.run.length}· μετά μένουν ${left}.`),
    outroScene(3, 'Στείλ\' το σε όποιον πληρώνει ΕΝΦΙΑ σε δόσεις.', SERIES.foroi.day, `Ανακαίνιση: η έκπτωση φόρου για δαπάνες ως ${RENO_39B_TO}`, path),
  ];
  return {
    key: 'foroi-e01', series: 'foroi', scenes, chords: [ch('D3', 'F3', 'A3'), ch('A#2', 'D3', 'F3'), ch('F3', 'A3', 'C4'), ch('C3', 'G3', 'E4')],
    chapters: ['Η προθεσμία', 'Πότε λήγει', 'Γιατί τόσος;', 'Ο δικός σου'],
    cover: 3.0, campaign: camp, link: utm(path, camp), title: `Η ${F.next + 1}η δόση του ΕΝΦΙΑ`,
    caption: [
      `Η ${F.next + 1}η δόση του ΕΝΦΙΑ λήγει ${weekday} ${elDate(F.due.date, { day: 'numeric', month: 'long' })}. Μετά μένουν άλλες ${left}.`,
      '',
      `Κάθε δόση λήγει την τελευταία εργάσιμη του μήνα της (${F.law}). Γι' αυτό η ${elDate(exLast, { day: 'numeric', month: 'long' })}, ${elDate(exLast, { weekday: 'long' })}, γίνεται ${elDate(ex.date, { weekday: 'long' })} ${Number(ex.date.slice(8))}.`,
      '',
      `Και γιατί δύο σπίτια με τα ίδια τετραγωνικά πληρώνουν άλλο ΕΝΦΙΑ; Ο φόρος ανά τ.μ. πάει από ${fe(F.zMin)} έως ${fe(F.zMax)}, ανάλογα με την τιμή ζώνης. Για ${fn(E.sqm)} τ.μ. στη ζώνη των ${feWhole(E.price)}: ${fn(E.sqm)} × ${fe(E.zt)} × ${fn(E.fc, 2)} × ${fn(E.ac, 2)} = ${fe(E.r.basic)}, με μείωση ${fpRate(E.r.reductionPct)} ${fe(E.r.annual)} τον χρόνο.`,
      '',
      'Υπολόγισε τον δικό σου στον δωρεάν υπολογιστή: γράψε «ΥΠΟΛΟΓΙΣΤΗΣ» στα σχόλια και σου στέλνουμε τον σύνδεσμο. Είναι και στο βιογραφικό.',
      '',
      'Στείλ\' το σε όποιον πληρώνει ΕΝΦΙΑ σε δόσεις.',
      '',
      '#ΕΝΦΙΑ #ακίνητα #φόροι #ιδιοκτήτες #ΑΑΔΕ',
    ].join('\n'),
  };
}

// ═══ ΜΑΚΡΟΧΡΟΝΙΑ ═══════════════════════════════════════════════════════
function makroReel(): Reel {
  const M = makroFacts();
  const camp = 'makro-e01', path = '/ypologismos-forou-enoikion';
  const pctR = (r: number) => fpRate(Math.round(r * 100));
  const tone = (rate: number) => ({ 0.15: S.ok, 0.25: S.accent, 0.35: S.warm, 0.45: S.neg }[rate as 0.15] ?? S.muted);
  const rateAt = (br: TaxBracket[], x: number) => br.find(b => x >= b.from && (b.to == null || x < b.to))!.rate;
  const end = M.lastEdge * 4 / 3;
  // ── Τα κομμάτια του φορολογητέου ως το τελευταίο όριο, με τον φόρο τους σε κάθε κλίμακα ──
  const edges = [...new Set([...M.b25, ...M.b26].flatMap(b => [b.from, b.to ?? Infinity]).filter(x => x <= M.lastEdge))].sort((a, b) => a - b);
  const slices = edges.slice(0, -1).map((lo, i) => {
    const hi = edges[i + 1], mid = (lo + hi) / 2, r25 = rateAt(M.b25, mid), r26 = rateAt(M.b26, mid);
    return { lo, hi, r25, r26, t25: (hi - lo) * r25, t26: (hi - lo) * r26 };
  });
  const sum = (k: 't25' | 't26') => slices.reduce((a, s) => a + s[k], 0);
  if (Math.abs(sum('t25') - rentalIncomeTax(M.lastEdge, M.b25)) > .01 || Math.abs(sum('t26') - rentalIncomeTax(M.lastEdge, M.b26)) > .01) throw new Error('Τα κομμάτια δεν δίνουν τον φόρο της κλίμακας.');
  if (Math.abs(sum('t25') - sum('t26') - M.maxSave) > .01) throw new Error('Η διαφορά των κομματιών δεν είναι το μέγιστο όφελος.');
  const band = M.b26[1];
  const bandOld = rateAt(M.b25, (band.from + band.to!) / 2);
  // ── Ο λογαριασμός του παραδείγματος ──
  const dedAmt = M.gross - M.taxable;
  if (M.taxable > M.firstEdge) throw new Error('Το παράδειγμα δεν μένει στο πρώτο κλιμάκιο.');
  const peak = Math.ceil(M.monthlyOf(M.lastEdge));
  // ── Το γράφημα του οφέλους ανά μηνιαίο ενοίκιο, με σάρωση ──
  const CW = 850, CH = 560, padL = 110, padR = 26, padT = 80, padB = 70;
  const xMax = Math.ceil(M.monthlyOf(M.lastEdge) / 1000) * 1000 + 500;
  const yStep = [250, 500, 1000].find(x => M.maxSave / x <= 3) ?? 1000;
  const yTop = Math.ceil(M.maxSave / yStep) * yStep;
  const xs = (mo: number) => padL + mo / xMax * (CW - padL - padR);
  const ys = (v: number) => padT + (1 - v / yTop) * (CH - padT - padB);
  const grid: { mo: number; v: number }[] = [];
  for (let mo = 0; mo <= xMax; mo += 50) grid.push({ mo, v: M.save(mo * 12 * (1 - M.ded)) });
  const line = `M${grid.map(g => `${xs(g.mo).toFixed(1)},${ys(g.v).toFixed(1)}`).join(' L')}`;
  const area = `${line} L${xs(xMax).toFixed(1)},${ys(0).toFixed(1)} L${xs(0).toFixed(1)},${ys(0).toFixed(1)} Z`;
  const ex = xs(M.m), th = xs(M.fromMonthly), pk = xs(M.monthlyOf(M.lastEdge));
  const curve = (t: number) => scanChart({
    id: 'mc', W: CW, H: CH, padL, padR, padT, padB, xs, ys, line, area, t0: t,
    defs: `<linearGradient id="mca" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${S.accent}" stop-opacity=".42"/><stop offset="1" stop-color="${S.accent}" stop-opacity="0"/></linearGradient>`,
    yTicks: Array.from({ length: yTop / yStep + 1 }, (_, k) => ({ v: k * yStep, label: feWhole(k * yStep) })),
    xTicks: Array.from({ length: Math.floor(xMax / 1000) + 1 }, (_, k) => ({ x: k * 1000, label: feWhole(k * 1000) })),
    scan: { pts: grid.filter(g => g.mo % 100 === 0).map(g => [+xs(g.mo).toFixed(1), +ys(g.v).toFixed(1), `${feWhole(g.mo)}/μήνα · ${feWhole(g.v)}`, g.v > 0 ? 1 : 0]), c0: S.muted, c1: S.accent, a: t + .9, b: t + 3.3, hold: .1, pw: 320 },
    extra: `<line x1="${th.toFixed(1)}" x2="${th.toFixed(1)}" y1="${padT - 10}" y2="${ys(0).toFixed(1)}" stroke="${S.ink}" stroke-opacity=".55" stroke-width="2.5" stroke-dasharray="5 7" ${A('fade', t + 3.5, .4)}/>
      <text x="${(th + 14).toFixed(1)}" y="${(padT - 30).toFixed(1)}" fill="${S.ink}" class="pill" font-size="26" ${A('fade', t + 3.5, .4)}>από ${esc(feWhole(M.fromMonthly))}</text>`,
  }) + `<svg width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}" style="position:absolute;left:0;top:0;overflow:visible">
      <g style="transform-box:fill-box;transform-origin:center" ${A('pop', t + 3.6, .5)}><circle cx="${ex.toFixed(1)}" cy="${ys(0).toFixed(1)}" r="15" fill="${S.ok}" stroke="${S.panel}" stroke-width="5"/><rect x="${(ex - 84).toFixed(1)}" y="${(ys(0) - 86).toFixed(1)}" width="168" height="54" rx="27" fill="${S.ok}"/><text x="${ex.toFixed(1)}" y="${(ys(0) - 50).toFixed(1)}" text-anchor="middle" fill="${S.onAccent}" class="pill" font-size="26">${esc(feWhole(M.m))}: 0€</text></g>
      <g style="transform-box:fill-box;transform-origin:center" ${A('pop', t + 3.8, .5)}><circle cx="${pk.toFixed(1)}" cy="${ys(M.maxSave).toFixed(1)}" r="15" fill="${S.accent}" stroke="${S.panel}" stroke-width="5"/><rect x="${(pk - 110).toFixed(1)}" y="${(ys(M.maxSave) - 90).toFixed(1)}" width="220" height="54" rx="27" fill="${S.accent}"/><text x="${pk.toFixed(1)}" y="${(ys(M.maxSave) - 54).toFixed(1)}" text-anchor="middle" fill="${S.onAccent}" class="pill" font-size="26">έως ${esc(feWhole(M.maxSave))}</text></g>
    </svg>`;
  const scaleRow = (label: string, br: TaxBracket[], t0: number) => `<div style="margin-bottom:26px"><div class="lbl" style="margin-bottom:12px" ${A('fade', t0, .3)}>${label}</div>
    <div style="position:relative;height:92px;width:850px;border-radius:18px;overflow:hidden;background:#ffffff08">${br.map((b, i) => {
      const a = b.from / end * 100, w = (Math.min(b.to ?? end, end) - b.from) / end * 100;
      return `<i style="position:absolute;top:0;bottom:0;left:${pc(a)};width:${pc(w)};background:${tone(b.rate)};border-right:4px solid ${S.ground};display:flex;align-items:center;justify-content:center;transform-origin:left center" ${A('grow', t0 + i * .25, .45)}><em style="font-style:normal;font-weight:850;font-size:32px;color:${S.onAccent}">${pctR(b.rate)}</em></i>`;
    }).join('')}</div></div>`;
  const SEND = 'Στείλ\' το σε όποιον ενδιαφέρεται να μισθώσει το ακίνητό του.';

  const scenes: Scene[] = [
    { // 1 · Το αγκίστρι: έως 1.300€
      dur: 4.5, ch: 0, tin: 'cut', tout: 'whip',
      html: t => `
        <div class="L deco" style="top:600px;left:600px;opacity:.1">${drawn(SERIES.makro.glyph, S.accent, 420, 1.1, t + .2, t + 1.8)}</div>
        <div class="L h1" style="top:400px;font-size:128px;white-space:nowrap" ${A('slam', t, .55)}>Νέα κλίμακα</div>
        <div class="L h1 acc" style="top:530px;font-size:128px;white-space:nowrap" ${A('slam', t + BEAT, .55)}>στα ενοίκια.</div>
        <div class="L lbl" style="top:850px" ${A('fade', t + 1.0, .3)}>ΕΩΣ</div>
        <div class="L" style="top:900px" ${A('up', t + 1.0, .45)}><span class="big acc glow num" style="font-size:250px">${counter([seg(t + 1.0, t + 2.1, 0, M.maxSave)])}</span></div>
        <div class="L lead" style="top:1180px;width:850px" ${A('up', t + 2.0, .5)}>λιγότερος φόρος τον χρόνο, για ενοίκια από <b>1/1/${M.Y}</b>.</div>`,
      sfx: (m, t) => { m.boom(t + BEAT, .35); for (let k = 0; k < 22; k++) m.click(t + 1.0 + k * .05, 2200 + k * 30, .06); m.bell(t + 2.1, n('G5'), .07); },
    },
    { // 2 · Αλλά όχι για όλους
      dur: 3, ch: 0, tin: 'whip', tout: 'whip',
      html: t => `
        <div class="L" style="top:420px;font-size:90px;font-weight:900;letter-spacing:-.05em;color:${S.faint};position:absolute" ${A('fade', t + .05, .3)}><span class="num">${esc(feWhole(M.maxSave))}</span><i style="position:absolute;left:-10px;right:-10px;top:52%;height:9px;border-radius:9px;background:${S.neg};transform-origin:left center" ${A('grow', t + .3, .35)}></i></div>
        <div class="L h1" style="top:600px;font-size:140px" ${A('slam', t + .45, .5)}>Αλλά όχι</div>
        <div class="L h1 neg" style="top:740px;font-size:140px" ${A('slam', t + .7, .5)}>για όλους.</div>
        <div class="L lead" style="top:960px;width:850px" ${A('up', t + 1.3, .5)}>Το ενοίκιο κρίνει <b>ποιος κερδίζει</b> και πόσο.</div>`,
      sfx: (m, t) => { m.whoosh(t + .3, .35, .1); m.boom(t + .45, .45); m.boom(t + .7, .35); },
    },
    chapterCard(1, 3, 'Τι αλλάζει'),
    { // 4 · Δύο κλίμακες στην ίδια ευθεία
      dur: 6, ch: 1, tin: 'iris', tout: 'whip',
      html: t => {
        const L = band.from / end * 850, Wd = (band.to! - band.from) / end * 850;
        return `
        <div class="L h2" style="top:400px" ${A('mask', t + .05, .6)}>Νέο κλιμάκιο:</div>
        <div class="L h2" style="top:505px" ${A('mask', t + .2, .6)}><span class="acc">${pctR(band.rate)}</span> στη μέση.</div>
        <div class="L" style="top:680px;width:850px">
          ${scaleRow(`ΕΩΣ ${M.Y - 1}`, M.b25, t + .6)}
          ${scaleRow(`ΑΠΟ ${M.Y}`, M.b26, t + 1.6)}
          <div style="position:relative;height:40px;width:850px">${M.b26.map(b => b.from).filter(x => x > 0).map(x => `<span class="num" style="position:absolute;left:${pc(x / end * 100)};width:160px;margin-left:-80px;text-align:center;font-family:'Roboto Mono',monospace;font-size:21px;color:${S.faint}" ${A('fade', t + 2.6, .4)}>${esc(feWhole(x))}</span>`).join('')}</div>
          <div style="position:absolute;left:${L.toFixed(1)}px;top:30px;width:${Wd.toFixed(1)}px;height:270px;border-radius:20px;border:4px solid ${S.ink};box-shadow:0 0 50px ${S.accent}66" ${A('pop', t + 3.0, .5)}></div>
        </div>
        <div class="L" style="top:1060px;padding:16px 26px;border-radius:20px;background:${S.ink};color:${S.ground};font-size:40px;font-weight:850" ${A('pop', t + 3.3, .5)}>από ${pctR(bandOld)} σε ${pctR(band.rate)}</div>
        <div class="L lead" style="top:1190px;width:850px" ${A('up', t + 3.8, .5)}>Κάθε συντελεστής φορολογεί μόνο το κομμάτι που πέφτει στο κλιμάκιό του.</div>`;
      },
      sfx: (m, t) => { [...M.b25.map((_, i) => t + .6 + i * .25), ...M.b26.map((_, i) => t + 1.6 + i * .25)].forEach((x, i) => m.pluck(x, n('C4') + [0, 4, 7, 12][i % 4], .06, i % 2 ? .3 : -.3)); m.boom(t + 3.0, .3); m.bell(t + 3.3, n('E5'), .08); },
    },
    { // 5 · Από πού βγαίνει το όφελος, κομμάτι κομμάτι
      dur: 6.5, ch: 1, tin: 'whip', tout: 'whip',
      html: t => {
        const rowT = (i: number) => t + .9 + i * .45;
        const chipR = (r: number, on: boolean) => `<span style="display:inline-block;padding:8px 16px;border-radius:14px;font-weight:850;font-size:30px;background:${on ? tone(r) : '#ffffff10'};color:${on ? S.onAccent : S.muted}">${pctR(r)}</span>`;
        return `
        <div class="L h2" style="top:400px;font-size:92px" ${A('mask', t + .05, .6)}>Από πού βγαίνει</div>
        <div class="L h2" style="top:495px;font-size:92px" ${A('mask', t + .2, .6)}>το <span class="acc">${esc(feWhole(M.maxSave))};</span></div>
        <div class="L lead" style="top:620px;width:850px" ${A('up', t + .35, .5)}>Φορολογητέο <b>${esc(feWhole(M.lastEdge))}</b>, κομμάτι κομμάτι.</div>
        <div class="L" style="top:740px;width:850px;display:grid;grid-template-columns:1fr 150px 150px 170px;gap:0 14px;align-items:center">
          <span class="lbl" style="font-size:19px" ${A('fade', t + .7, .3)}>ΚΟΜΜΑΤΙ</span><span class="lbl" style="font-size:19px;text-align:center" ${A('fade', t + .7, .3)}>ΩΣ ${M.Y - 1}</span><span class="lbl" style="font-size:19px;text-align:center" ${A('fade', t + .7, .3)}>ΑΠΟ ${M.Y}</span><span class="lbl" style="font-size:19px;text-align:right" ${A('fade', t + .7, .3)}>ΟΦΕΛΟΣ</span>
          ${slices.map((s, i) => {
            const diff = s.t25 - s.t26, on = diff > .005;
            return `<span class="num" style="font-size:28px;color:${on ? S.ink : S.muted};padding:22px 0;border-top:1.5px solid ${S.rule}" ${A('up', rowT(i), .4)}>${esc(s.lo === 0 ? `ως ${feWhole(s.hi)}` : `${fn(s.lo)}–${feWhole(s.hi)}`)}</span>
              <span style="text-align:center;padding:22px 0;border-top:1.5px solid ${S.rule}" ${A('up', rowT(i), .4)}>${chipR(s.r25, !on)}</span>
              <span style="text-align:center;padding:22px 0;border-top:1.5px solid ${S.rule}" ${A('up', rowT(i) + .1, .4)}>${chipR(s.r26, true)}</span>
              <b class="num" style="text-align:right;font-size:34px;font-weight:850;color:${on ? S.ok : S.faint};padding:22px 0;border-top:1.5px solid ${S.rule}" ${A('up', rowT(i) + .2, .4)}>${on ? esc(feWhole(diff)) : 'ίδιος'}</b>`;
          }).join('')}
        </div>
        <div class="L" style="top:1260px;width:850px;display:flex;justify-content:space-between;align-items:baseline;padding-top:20px;border-top:3px solid ${S.ink}" ${A('up', t + 3.0, .5)}><span class="lead" style="color:${S.ink}">${esc(feWhole(sum('t25')))} γίνονται ${esc(feWhole(sum('t26')))}</span><b class="num acc" style="font-size:72px;font-weight:900;letter-spacing:-.04em">${counter([seg(t + 3.1, t + 3.9, 0, M.maxSave)])}</b></div>`;
      },
      sfx: (m, t) => { slices.forEach((s, i) => { m.click(t + .9 + i * .45, 1500 + i * 120, .1); if (s.t25 - s.t26 > .005) m.pluck(t + 1.1 + i * .45, n('G5'), .06); }); for (let k = 0; k < 14; k++) m.click(t + 3.1 + k * .06, 2000 + k * 60, .05); m.bell(t + 3.9, n('C6'), .08); },
    },
    chapterCard(2, 3, 'Ποιος κερδίζει'),
    { // 7 · Το όφελος ανά ενοίκιο, με σάρωση
      dur: 6, ch: 2, tin: 'iris', tout: 'zoom',
      html: t => `
        <div class="L h2" style="top:400px;font-size:92px" ${A('mask', t + .05, .6)}>Το όφελος</div>
        <div class="L h2 acc" style="top:495px;font-size:92px" ${A('mask', t + .2, .6)}>ανά ενοίκιο.</div>
        <div class="L lbl" style="top:630px" ${A('fade', t + .4, .4)}>ΛΙΓΟΤΕΡΟΣ ΦΟΡΟΣ ΤΟΝ ΧΡΟΝΟ · ΑΝΑ ΜΗΝΙΑΙΟ ΕΝΟΙΚΙΟ</div>
        <div class="L" style="top:680px;width:${CW}px;height:${CH}px">${curve(t)}</div>
        <div class="L lead" style="top:1290px;width:850px" ${A('up', t + 4.0, .5)}>Αρχίζει πάνω από <b>${esc(feWhole(M.fromMonthly))}</b> τον μήνα και γίνεται ${esc(feWhole(M.maxSave))} από ${esc(feWhole(peak))}.</div>`,
      sfx: (m, t) => { m.sweep(t + .9, 2.4, 250, 900, .045); m.bell(t + 3.6, n('G4'), .1); m.bell(t + 3.8, n('C5'), .1); },
    },
    { // 8 · Το παράδειγμα: ίδιος φόρος
      dur: 5.5, ch: 2, tin: 'zoom', tout: 'whip',
      html: t => `
        <div class="L h2" style="top:400px;font-size:92px;white-space:nowrap" ${A('mask', t + .05, .6)}>Με ${esc(feWhole(M.m))} τον μήνα,</div>
        <div class="L h2 acc" style="top:495px;font-size:92px;white-space:nowrap" ${A('mask', t + .2, .6)}>δεν αλλάζει τίποτα.</div>
        <div class="L card" style="top:650px;width:850px;padding:14px 34px" ${A('up', t + .4, .6)}>
          <div class="row" style="padding:20px 0" ${A('up', t + .6, .4)}><span>Ενοίκια, ${M.n} × ${esc(feWhole(M.m))}</span><b class="num" style="color:${S.ink}">${esc(feWhole(M.gross))}</b></div>
          <div class="row" style="padding:20px 0;border-top:1.5px solid ${S.rule}" ${A('up', t + 1.0, .4)}><span>Τεκμαρτή έκπτωση ${pctR(M.ded)}</span><b class="num" style="color:${S.muted}">−${esc(feWhole(dedAmt))}</b></div>
          <div class="row" style="padding:20px 0;border-top:1.5px solid ${S.rule}" ${A('up', t + 1.4, .4)}><span>Φορολογητέο</span><b class="num" style="color:${S.ink}">${esc(feWhole(M.taxable))}</b></div>
        </div>
        <div class="L" style="top:1010px;width:850px;display:grid;grid-template-columns:1fr 70px 1fr;align-items:center">
          <div class="tile" style="padding:24px 0" ${A('left', t + 2.0, .5)}><div class="lbl" style="font-size:20px">ΩΣ ${M.Y - 1}</div><div class="num" style="font-size:72px;font-weight:900;letter-spacing:-.04em;margin-top:6px">${esc(feWhole(rentalIncomeTax(M.taxable, M.b25)))}</div></div>
          <b style="text-align:center;font-size:72px;font-weight:900;color:${S.ok}" ${A('pop', t + 2.6, .45)}>=</b>
          <div class="tile" style="padding:24px 0;border-color:${S.accent}88" ${A('right', t + 2.2, .5)}><div class="lbl" style="font-size:20px">ΑΠΟ ${M.Y}</div><div class="num" style="font-size:72px;font-weight:900;letter-spacing:-.04em;margin-top:6px;color:${S.accent}">${esc(feWhole(M.tax))}</div></div>
        </div>
        <div class="L lead" style="top:1250px;width:850px" ${A('up', t + 2.9, .5)}>Όλο το φορολογητέο μένει στο ${pctR(M.rate0)}, κάτω από τα ${esc(feWhole(M.firstEdge))}.</div>`,
      sfx: (m, t) => { [.6, 1.0, 1.4].forEach((d, i) => m.click(t + d, 1500 + i * 150, .1)); m.whoosh(t + 2.0, .5, .1, false); m.whoosh(t + 2.2, .5, .1, false); m.boom(t + 2.6, .35); m.bell(t + 2.6, n('C5'), .08); },
    },
    calcScene(3, 'Βάλε το δικό σου', 'ενοίκιο.', path, 'Φόρος ενοικίων', [
      ['Ενοίκιο τον μήνα', feWhole(M.m)], ['Μήνες', String(M.n)],
      ['Χρονιά εισοδήματος', String(M.Y)], ['Μέσω τράπεζας', RENT.trapeza === '1' ? 'Ναι' : 'Όχι'],
    ], { label: 'Φόρος τον χρόνο', to: M.tax, fmt: feWhole }),
    sumScene(3, `Φόρος ενοικίων από ${M.Y}`, [
      ['Νέο κλιμάκιο', pctR(band.rate), `${feWhole(band.from)}–${feWhole(band.to!)} φορολογητέου`],
      ['Λιγότερος φόρος', `έως ${feWhole(M.maxSave)}`, 'τον χρόνο'],
      ['Το όφελος αρχίζει', feWhole(M.fromMonthly), 'για ενοίκιο πάνω από αυτό τον μήνα'],
      [`Με ${feWhole(M.m)} τον μήνα`, feWhole(M.tax), 'φόρος τον χρόνο, ίδιος και με τις δύο'],
    ], 'Αποθήκευσέ το για τη δήλωση.'),
    noaScene(3, 'Πόσο φόρο θα πληρώσω για το ενοίκιο;',
      `Για ${feWhole(M.m)} τον μήνα, ${feWhole(M.tax)} τον χρόνο. Η νέα κλίμακα δεν τον αλλάζει· όλο το ποσό μένει στο ${pctR(M.rate0)}.`),
    outroScene(3, SEND, SERIES.makro.day, `Ενοίκιο μέσω τράπεζας: τι αλλάζει από 1/${FIRST_MONTH_BANK_RECEIPT}/${FIRST_YEAR_BANK_RECEIPT}`, path),
  ];
  return {
    key: 'makro-e01', series: 'makro', scenes, chords: [ch('C3', 'E3', 'G3', 'B3'), ch('A2', 'C3', 'E3', 'G3'), ch('F2', 'A2', 'C3', 'E3'), ch('G2', 'B2', 'D3')],
    chapters: ['Η αλλαγή', 'Τι αλλάζει', 'Ποιος κερδίζει', 'Το δικό σου'],
    cover: 3.0, campaign: camp, link: utm(path, camp), title: 'Η νέα κλίμακα στα ενοίκια',
    caption: [
      `Νέα κλίμακα στα ενοίκια από το ${M.Y}: έως ${feWhole(M.maxSave)} λιγότερος φόρος τον χρόνο. Αλλά όχι για όλους.`,
      '',
      `Μπαίνει ενδιάμεσο κλιμάκιο ${pctR(band.rate)}: το κομμάτι ${feWhole(band.from)} ως ${feWhole(band.to!)} πέφτει από ${pctR(bandOld)} σε ${pctR(band.rate)}. Τα πρώτα ${feWhole(M.firstEdge)} φορολογητέου μένουν στο ${pctR(M.rate0)}, όπως πριν.`,
      '',
      `Με ${feWhole(M.m)} τον μήνα ο φόρος είναι ${feWhole(M.tax)} τον χρόνο και με τις δύο κλίμακες. Το όφελος αρχίζει πάνω από ${feWhole(M.fromMonthly)} τον μήνα και γίνεται ${feWhole(M.maxSave)} από ${feWhole(peak)}. Φαίνεται στη δήλωση του ${M.Y + 1}.`,
      '',
      'Βάλε το δικό σου ενοίκιο στον δωρεάν υπολογιστή: γράψε «ΥΠΟΛΟΓΙΣΤΗΣ» στα σχόλια και σου στέλνουμε τον σύνδεσμο. Είναι και στο βιογραφικό.',
      '',
      SEND,
      '',
      '#ενοίκιο #φορολογίαενοικίων #ακίνητα #ιδιοκτήτες #φόροι',
    ].join('\n'),
  };
}

// ═══ ΤΟ ΠΡΩΤΟ REEL ΤΟΥ ΛΟΓΑΡΙΑΣΜΟΥ: ΤΙ ΚΑΝΕΙ ΤΟ PROPERWISE ═════════════════
// Η σύσταση, στη γλώσσα των σειρών: κεφαλίδα, κάρτες κεφαλαίων, μετρητές, το
// κινητό. Τα σκόρπια χαρτιά του ιδιοκτήτη μπαίνουν σε μία λίστα και μετά πέντε
// κεφάλαια, ένα για κάθε δουλειά. Κανένα ψηφίο γραμμένο εδώ: τα έγγραφα από τη
// σάρωση, οι προθεσμίες από το φορολογικό ημερολόγιο, οι πάροχοι από τον
// κατάλογο (μόνο τιμές του μήνα της ΡΑΑΕΥ), το καθαρό από την incomeStatement.
// Το παλιό reelTaxi.ts έβγαζε το ίδιο θέμα με ανάμειξη καρέ που τρεμόπαιζε στη
// σάρωση· εδώ κάθε καρέ είναι καθαρό (blend: false).
const BUILDING = '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/><path d="M11 21v-3h2v3"/>';
const CHECK = '<path d="M5 12.5l4.5 4.5L19 7.5"/>';
const SHIELD = '<path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/>';
const BANK = '<path d="M3 21h18"/><path d="M5 21V10M19 21V10M9 21v-7M15 21v-7"/><path d="M12 3l9 5H3z"/>';
const DOCI = '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>';

function protoReel(): Reel {
  const DOCS = DOC_TYPES.filter(d => d.id !== 'other').map(d => d.label);
  if (DOCS.length !== 7) throw new Error(`Η σάρωση ξέρει ${DOCS.length} είδη εγγράφων, όχι 7.`);
  const Y = yearAhead();
  const today = athensToday();
  const SHORT: Partial<Record<TaxObligationKind, string>> = { e9: 'Ε9, μεταβολές ακινήτων', 'enfia-first': 'ΕΝΦΙΑ, πρώτη δόση', 'income-decl': 'Δήλωση εισοδήματος, Ε1 και Ε2' };
  const ahead = [0, 1].flatMap(d => greekPropertyTaxObligations(Number(today.slice(0, 4)) + d, 'long_term')).filter(o => o.date >= today);
  const DL = (Object.keys(SHORT) as TaxObligationKind[]).map(k => ahead.filter(o => o.kind === k).sort((a, b) => a.date.localeCompare(b.date))[0])
    .filter(o => o !== undefined).sort((a, b) => a.date.localeCompare(b.date));
  if (DL.length < 3) throw new Error('Το ημερολόγιο δεν έχει τις τρεις προθεσμίες του επόμενου δωδεκαμήνου.');
  const enfiaFirst = DL.find(o => o.kind === 'enfia-first');
  if (!enfiaFirst) throw new Error('Λείπει η πρώτη δόση του ΕΝΦΙΑ.');
  // Η πρώτη υπενθύμιση φεύγει επτά μέρες πριν (reminder_7days στο supabase/functions/send-reminders).
  const REMIND = 7;
  const MON = ['ΙΑΝ', 'ΦΕΒ', 'ΜΑΡ', 'ΑΠΡ', 'ΜΑΪ', 'ΙΟΥΝ', 'ΙΟΥΛ', 'ΑΥΓ', 'ΣΕΠ', 'ΟΚΤ', 'ΝΟΕ', 'ΔΕΚ'];
  const bill = demoExpenses(DEMO.year).find(e => e.category === 'electricity');
  if (!bill) throw new Error('Το ακίνητο επίδειξης δεν έχει λογαριασμό ρεύματος.');
  const billDate = bill.date.split('-').reverse().join('.');
  // Η χαμηλότερη τιμή kWh κάθε παρόχου για κατοικία, ΜΟΝΟ με τιμή του μήνα του
  // πίνακα της ΡΑΑΕΥ, με τον κανόνα που βγάζει τον νικητή στην εφαρμογή.
  const TARIFFS = PROVIDERS.map(g => Math.min(...g.tariffs
    .filter(x => x.segment === 'residential' && !x.studentOnly && !x.notAvailable && x.priceMonth === CATALOGUE_MONTH_GEN
      && x.type !== 'dynamic' && x.type !== 'fixed_monthly' && (x.kwh_day ?? 0) > 0)
    .map(x => x.kwh_day as number))).filter(Number.isFinite).sort((a, b) => a - b);
  const NPROV = TARIFFS.length;
  if (NPROV < 5) throw new Error(`Μόνο ${NPROV} πάροχοι με τιμή ${CATALOGUE_MONTH_GEN}.`);
  const NINS = INSURANCE_COMPANIES.filter(i => /^https:\/\//.test(i.url || '')).length;
  const TAG = 'Βάλε το ακίνητό σου σε τάξη.';
  // Τα χαρτιά του αγκιστριού: θέση, γωνία. Σκόρπια, αλλά κανένα δεν κρύβει άλλο.
  const SCAT: [number, number, number][] = [[90, 800, -7], [500, 850, 6], [130, 960, 4], [460, 1040, -5], [90, 1140, 8], [420, 1220, -3], [170, 1320, -8]];

  const scenes: Scene[] = [
    { // Το αγκίστρι: πού είναι τα χαρτιά
      dur: 4.5, ch: 0, tin: 'cut', tout: 'zoom',
      html: t => `
        <div class="L lbl" style="top:400px;color:${S.accent};font-size:26px" ${A('fade', t, .25)}>ΙΔΙΟΚΤΗΤΗΣ ΑΚΙΝΗΤΟΥ;</div>
        <div class="L h1" style="top:450px;font-size:128px;white-space:nowrap" ${A('slam', t, .5)}>Πού είναι</div>
        <div class="L h1 acc" style="top:575px;font-size:128px;white-space:nowrap" ${A('slam', t + BEAT, .5)}>τα χαρτιά;</div>
        ${DOCS.map((d, i) => `<div style="position:absolute;left:${SCAT[i][0]}px;top:${SCAT[i][1]}px" ${A('pop', t + 1.1 + i * .2, .45, 'float', 6 + (i % 3) * 3, 2.6 + (i % 2))}><div class="dchip" style="transform:rotate(${SCAT[i][2]}deg)">${glyph(DOCI, '#3f6fc9', 34, 2)}${esc(d)}</div></div>`).join('')}`,
      sfx: (m, t) => { m.boom(t + BEAT, .35); DOCS.forEach((_, i) => { m.click(t + 1.1 + i * .2, 2400 + i * 140, .08, i % 2 ? .3 : -.3); }); m.whoosh(t + 3.8, .7, .12); },
    },
    { // Τάξη: όλα σε ένα μέρος
      dur: 4, ch: 0, tin: 'zoom', tout: 'whip',
      html: t => `
        <div class="L h1" style="top:390px;font-size:128px;white-space:nowrap" ${A('slam', t + .05, .5)}>Ένα μέρος</div>
        <div class="L h1 acc" style="top:515px;font-size:128px;white-space:nowrap" ${A('slam', t + .35, .5)}>για όλα.</div>
        <div class="L card" style="top:720px;width:850px;padding:14px 30px" ${A('up', t + .5, .55)}>
          ${DOCS.map((d, i) => `<div class="row" style="padding:16px 0;font-size:32px;${i ? `border-top:1.5px solid ${S.rule}99` : ''}" ${A('right', t + .6 + i * .1, .5)}><span><span class="chip" style="width:48px;height:48px;border-radius:14px;background:${S.accent}1c">${glyph(DOCI, S.accent, 26, 2)}</span><b style="color:${S.ink};font-weight:700">${esc(d)}</b></span><span ${A('pop', t + 1.2 + i * .1, .4)}>${glyph(CHECK, S.ok, 36, 3)}</span></div>`).join('')}
        </div>`,
      sfx: (m, t) => { m.boom(t + .05, .4); DOCS.forEach((_, i) => m.pluck(t + 1.2 + i * .1, n('C5') + [0, 2, 4, 7, 9, 12, 14][i], .05, (i - 3) * .12)); },
    },
    chapterCard(1, 5, 'Σάρωση'),
    { // Η σάρωση: ο λογαριασμός, η δέσμη, τα πεδία, η καταχώρηση
      dur: 5, ch: 1, tin: 'iris', tout: 'whip',
      html: t => `
        <div class="L h3" style="top:390px" ${A('mask', t + .05, .6)}>Φωτογράφισε.</div>
        <div class="L h3 acc" style="top:466px" ${A('mask', t + .2, .6)}>Καταχωρείται.</div>
        <div style="position:absolute;left:220px;top:610px;width:640px" ${A('tilt', t + .1, .8, 'dim', t + 2.3, .6)}>
          <div class="paper" style="position:relative">
            <div class="band"><span style="position:relative">ΛΟΓΑΡΙΑΣΜΟΣ ΡΕΥΜΑΤΟΣ<span class="hl" style="inset:-10px -14px" ${A('pop', t + 1.15, .35)}><span>ΕΙΔΟΣ</span></span></span></div>
            <div class="kv" style="margin-top:26px"><span>Έκδοση</span><b style="position:relative">${esc(billDate)}<span class="hl" style="inset:-8px -12px" ${A('pop', t + 1.4, .35)}><span>ΗΜΕΡΟΜΗΝΙΑ</span></span></b></div>
            <div class="kv"><span>Περίοδος</span><b>2 μήνες</b></div>
            <i style="width:80%"></i><i style="width:62%"></i>
            <div class="due"><span>ΠΟΣΟ ΠΛΗΡΩΜΗΣ</span><b style="position:relative">${esc(eur(bill.amount))}<span class="hl" style="inset:-6px -12px" ${A('pop', t + 1.7, .35)}><span>ΠΟΣΟ</span></span></b></div>
            <div class="code"></div>
          </div>
          <div class="beamw" style="left:0;right:0;top:0;height:100%" ${A('fade', t + .65, .2, 'scan', t + .65, 1.2, 'out', t + 1.8, .3)}><div class="beam"></div></div>
          ${[['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']].map(([v, h]) => `<div class="vf" style="${v}:-30px;${h}:-30px;border-${v}-width:7px;border-${h}-width:7px;border-${v}-${h}-radius:26px" ${A('pop', t + .4, .4, 'out', t + 2.2, .4)}></div>`).join('')}
        </div>
        <div class="L card" style="top:1120px;width:850px;padding:24px 34px 10px" ${A('up', t + 2.2, .55)}>
          <div style="display:flex;align-items:center;gap:16px;font-size:34px;font-weight:800"><span class="chip" style="width:52px;height:52px;border-radius:50%;background:${S.ok}26">${glyph(CHECK, S.ok, 30, 3)}</span>Καταχωρήθηκε<span class="ex" style="margin-left:auto">ΠΑΡΑΔΕΙΓΜΑ</span></div>
          ${[['ΕΙΔΟΣ', bill.description], ['ΗΜΕΡΟΜΗΝΙΑ', billDate], ['ΠΟΣΟ', eur(bill.amount)]].map(([l, v], i) => `<div class="row" style="padding:14px 0;border-top:1.5px solid ${S.rule}99;margin-top:${i ? 0 : 14}px;font-size:30px"><span class="lbl" style="font-size:19px">${l}</span><b style="color:${i === 2 ? S.accent : S.ink}">${tw(v, t + 2.6 + i * .3, 40)}</b></div>`).join('')}
        </div>`,
      sfx: (m, t) => { m.whoosh(t, .6, .12); m.sweep(t + .65, 1.2, 600, 2600, .03); [1.15, 1.4, 1.7].forEach((s0, i) => m.pluck(t + s0, n('E5') + [0, 4, 7][i], .05, (i - 1) * .3)); m.bell(t + 2.25, n('A5'), .07); m.bell(t + 2.32, n('E6'), .05); },
    },
    chapterCard(2, 5, ASSISTANT_NAME),
    noaScene(2, 'Πόσα θα μου μείνουν καθαρά;',
      `Από ${eur(Y.gross)} ενοίκια μένουν ${eur(Y.net)} καθαρά. Φόρος ${eur(Y.tax)}, ΕΝΦΙΑ ${eur(Y.enfia)}, έξοδα ${eur(Y.other)}.`,
      `Ρώτα ${ASSISTANT_ACC}.`, 'Στα ελληνικά.'),
    chapterCard(3, 5, 'Προθεσμίες'),
    { // Οι προθεσμίες του επόμενου δωδεκαμήνου και η ειδοποίηση
      dur: 4.5, ch: 3, tin: 'iris', tout: 'whip',
      html: t => `
        <div class="L h3" style="top:390px" ${A('mask', t + .05, .6)}>Κάθε προθεσμία,</div>
        <div class="L h3 acc" style="top:466px" ${A('mask', t + .2, .6)}>πριν λήξει.</div>
        ${DL.map((o, i) => { const [, mo, d] = o.date.split('-'); return `<div class="L" style="top:${620 + i * 160}px;width:850px;display:flex;align-items:center;gap:30px" ${A('right', t + .4 + i * .18, .5)}>
          <div class="dd"><b>${Number(d)}</b><span>${MON[Number(mo) - 1]}</span></div>
          <div><div style="font-size:36px;font-weight:750;letter-spacing:-.015em">${esc(SHORT[o.kind] ?? o.title)}</div><div class="lbl" style="font-size:20px;color:${S.accent};margin-top:10px">${esc(up(WHO_LABEL[o.who]))}</div></div></div>`; }).join('')}
        <div class="L toast" style="top:1130px;width:850px" ${A('down', t + 1.6, .5)}><span class="ti">${mark(36, S.ink)}</span><div style="flex:1">
          <div style="display:flex;justify-content:space-between;font-size:21px;color:#c3cedd"><b style="font-family:'Roboto Mono',monospace;letter-spacing:.14em;color:${S.ink}">PROPERWISE</b><span>τώρα</span></div>
          <div style="font-size:32px;font-weight:800;margin-top:8px">Υπενθύμιση προθεσμίας</div>
          <div style="font-size:27px;color:#c3cedd;margin-top:6px">${esc(SHORT[enfiaFirst.kind] ?? enfiaFirst.title)}: λήγει σε ${REMIND} ημέρες.</div></div></div>`,
      sfx: (m, t) => { m.whoosh(t, .6, .12); DL.forEach((_, i) => m.pluck(t + .4 + i * .18, n('A4') + [0, 4, 7][i], .05, (i - 1) * .3)); m.bell(t + 1.6, n('E6'), .07, -.2); m.bell(t + 1.76, n('C6'), .06, .2); },
    },
    chapterCard(4, 5, 'Σύγκριση'),
    { // Οι πάροχοι, οι ασφαλιστικές, το δάνειο
      dur: 5, ch: 4, tin: 'iris', tout: 'whip',
      html: t => `
        <div class="L h3" style="top:390px" ${A('mask', t + .05, .6)}>Σύγκρινε.</div>
        <div class="L h3 acc" style="top:466px" ${A('mask', t + .2, .6)}>Κράτα το καλύτερο.</div>
        <div class="L" style="top:610px;display:flex;align-items:flex-end;gap:26px" ${A('up', t + .3, .5)}><span class="big acc glow num" style="font-size:170px">${counter([seg(t + .4, t + 1.3, 0, NPROV, x => String(x))])}</span><div style="padding-bottom:18px"><div style="font-size:44px;font-weight:800;letter-spacing:-.02em">πάροχοι ρεύματος</div><div class="lbl" style="font-size:18px;margin-top:10px">ΧΑΜΗΛΟΤΕΡΗ kWh ΑΝΑ ΠΑΡΟΧΟ · ΡΑΑΕΥ, ${esc(up(TARIFFS_LABEL))}</div></div></div>
        <div class="L bars" style="top:800px">${TARIFFS.map((v, k) => `<i class="${k ? '' : 'lo'}" style="height:${Math.round(35 + 65 * (v - TARIFFS[0]) / (TARIFFS[TARIFFS.length - 1] - TARIFFS[0] || 1))}%" ${A('growy', t + .5 + k * .06, .45)}></i>`).join('')}</div>
        <div class="L" style="top:985px;width:850px;display:flex;justify-content:space-between;font-family:'Roboto Mono',monospace;font-size:20px;color:${S.faint}" ${A('fade', t + 1.3, .4)}><span style="color:${S.accent}">${esc(feRate(TARIFFS[0]))}/kWh</span><span>${esc(feRate(TARIFFS[TARIFFS.length - 1]))}/kWh</span></div>
        <div class="L" style="top:1060px;display:flex;align-items:flex-end;gap:26px" ${A('up', t + 1.5, .5)}><span class="big num" style="font-size:130px">${counter([seg(t + 1.6, t + 2.4, 0, NINS, x => String(x))])}</span><div style="padding-bottom:12px;font-size:40px;font-weight:800;letter-spacing:-.02em">ασφαλιστικές</div></div>
        <div class="L" style="top:1210px;width:850px;display:flex;justify-content:space-between">${Array.from({ length: NINS }, (_, k) => `<span class="shd" ${A('pop', t + 1.7 + k * .04, .35)}>${glyph(SHIELD, S.accent, 22, 2)}</span>`).join('')}</div>
        <div class="L" style="top:1300px;width:850px;display:flex;align-items:center;gap:24px;padding-top:24px;border-top:1.5px solid ${S.rule}" ${A('up', t + 2.6, .5)}><span class="chip" style="width:78px;height:78px;border-radius:22px;background:${S.accent}1c">${glyph(BANK, S.accent, 42, 1.8)}</span><div><div style="font-size:36px;font-weight:800">Στεγαστικά δάνεια</div><div class="lbl" style="font-size:18px;margin-top:8px">ΔΟΣΗ, ΕΠΙΤΟΚΙΟ, ΤΡΑΠΕΖΕΣ</div></div></div>`,
      sfx: (m, t) => { m.whoosh(t, .6, .12); for (let k = 0; k < 16; k++) m.click(t + .4 + k * .055, 2200 + k * 50, .05); for (let k = 0; k < 14; k++) m.click(t + 1.6 + k * .055, 2600 + k * 40, .045, .25); m.bell(t + 2.6, n('A5'), .06); },
    },
    chapterCard(5, 5, 'Λογιστής'),
    { // Ο φάκελος του λογιστή
      dur: 4, ch: 5, tin: 'iris', tout: 'whip',
      html: t => `
        <div class="L h3" style="top:390px" ${A('mask', t + .05, .6)}>Έτοιμο για</div>
        <div class="L h3 acc" style="top:466px" ${A('mask', t + .2, .6)}>τον λογιστή.</div>
        <div class="fbk" style="left:170px;top:700px;width:740px;height:560px" ${A('up', t + .15, .5)}></div>
        <div style="position:absolute;left:170px;top:650px;padding:16px 28px;border-radius:24px 24px 0 0;background:#24406b;color:#cfe0ff;font-family:'Roboto Mono',monospace;font-size:19px;letter-spacing:.14em" ${A('up', t + .15, .5)}>ΦΑΚΕΛΟΣ ΛΟΓΙΣΤΗ · ${DEMO.year}</div>
        ${[['ΕΝΤΥΠΟ Ε2', 'ΜΙΣΘΩΜΑΤΑ'], ['ΔΗΛΩΣΗ ΜΙΣΘΩΣΗΣ', 'myAADE'], ['ΕΞΑΓΩΓΗ', 'EXCEL']].map(([a, b], k) => `<div class="fdoc" style="left:230px;top:${760 + k * 64}px;width:620px;height:300px" ${A('fly', t + .5 + k * .3, .6)}><div class="hd">${glyph(DOCI, '#3f6fc9', 30, 2)}${esc(a)}<em>${esc(b)}</em></div></div>`).join('')}
        <div class="ffr" style="left:170px;top:980px;width:740px;height:280px" ${A('up', t + .15, .5)}>${mark(60, '#ffffffd8')}<span style="font-size:26px;letter-spacing:.2em;color:#ffffffd0;font-weight:800">PROPERWISE</span></div>
        <div class="L" style="top:1310px;width:850px;display:flex;justify-content:center" ${A('pop', t + 1.7, .45)}><span style="display:flex;align-items:center;gap:14px;padding:18px 28px;border-radius:999px;background:${S.ok}1f;border:1.5px solid ${S.ok}55;font-size:29px;font-weight:750">${glyph(CHECK, S.ok, 30, 3)}Ό,τι ζητά ο λογιστής, σε έναν φάκελο.</span></div>`,
      sfx: (m, t) => { m.whoosh(t, .6, .12); [0, 1, 2].forEach(k => { m.click(t + 1.0 + k * .3, 900, .1); m.boom(t + 1.0 + k * .3, .1); }); m.bell(t + 1.7, n('C6'), .06); },
    },
    sumScene(5, `${DEMO_PROPERTY.name} · 12 μήνες`, [
      ['Καθαρά στην τσέπη', eur(Y.net), `από ${eur(Y.gross)} ενοίκια`],
      [`Φόρος εισοδήματος ${RATE}`, `−${eur(Y.tax)}`, 'πρώτο κλιμάκιο'],
      ['ΕΝΦΙΑ', `−${eur(Y.enfia)}`, 'του ακινήτου'],
      ['Επόμενη προθεσμία', `${Number(DL[0].date.slice(8))} ${MON[Number(DL[0].date.slice(5, 7)) - 1]}`, SHORT[DL[0].kind] ?? DL[0].title],
    ], 'Αποθήκευσέ το για την επόμενη προθεσμία.'),
    { // Η μάρκα: δένει με την αρχή
      dur: 4, ch: 6, tin: 'whip', tout: 'fade',
      html: t => `
        <div class="L" style="top:520px;width:850px;display:flex;justify-content:center" ${A('pop', t + .05, .6)}>${mark(170, S.ink)}</div>
        <div class="L h1" style="top:760px;width:850px;text-align:center;font-size:110px;letter-spacing:.01em;font-weight:850" ${A('slam', t + .3, .5)}>PROPERWISE</div>
        <div class="L" style="top:905px;width:850px;display:flex;justify-content:center" ${A('grow', t + .6, .4)}><i style="display:block;width:80px;height:5px;border-radius:5px;background:${S.accent}"></i></div>
        <div class="L h3" style="top:950px;width:850px;text-align:center;font-size:58px" ${A('up', t + .7, .5)}>${esc(TAG)}</div>
        <div class="L lbl" style="top:1060px;width:850px;text-align:center;font-size:20px" ${A('fade', t + 1.0, .4)}>ΓΙΑ ΚΑΘΕ ΙΔΙΟΚΤΗΤΗ ΑΚΙΝΗΤΟΥ ΣΤΗΝ ΕΛΛΑΔΑ</div>
        <div class="L" style="top:1150px;width:850px;display:flex;justify-content:center" ${A('up', t + 1.2, .5)}><span class="url">${glyph('<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>', S.accent, 30, 2.4)}<span>properwise.gr<em> · σύνδεσμος στο bio</em></span></span></div>`,
      sfx: (m, t) => { m.whoosh(t, .8, .18); m.boom(t + .3, .4); ['C5', 'E5', 'G5', 'B5', 'E6'].forEach((x, i) => m.bell(t + .32 + i * .07, n(x), .05, (i - 2) * .22)); },
    },
  ];
  const caption = [
    'Λογαριασμοί, μισθωτήρια, ΕΝΦΙΑ, προθεσμίες. Όλα σε ένα μέρος.',
    '',
    'Τι κάνει το PROPERWISE:',
    '',
    `Σάρωση. Φωτογραφίζεις λογαριασμό, απόδειξη ή μισθωτήριο και καταχωρείται μόνο του. ${DOCS.length} είδη εγγράφων.`,
    `${ASSISTANT_NAME}. Ρωτάς στα ελληνικά «πόσα θα μου μείνουν καθαρά;» και παίρνεις απάντηση με τα δικά σου νούμερα.`,
    `Προθεσμίες. ΕΝΦΙΑ, Ε9, δήλωση εισοδήματος. Υπενθύμιση ${REMIND} ημέρες πριν λήξουν.`,
    `Σύγκριση. ${NPROV} πάροχοι ρεύματος με τιμές ${CATALOGUE_MONTH_GEN} από τη ΡΑΑΕΥ, ${NINS} ασφαλιστικές, στεγαστικά δάνεια τραπεζών.`,
    'Λογιστής. Ε2, δήλωση μίσθωσης και Excel σε έναν φάκελο.',
    '',
    `Στο παράδειγμα του βίντεο, από ${eur(Y.gross)} ενοίκια τον χρόνο μένουν ${eur(Y.net)} καθαρά στην τσέπη.`,
    '',
    'Αποθήκευσέ το για την επόμενη προθεσμία. Στείλ\' το σε κάποιον που νοικιάζει σπίτι.',
    '',
    'Εσύ πού κρατάς σήμερα τα χαρτιά του ακινήτου σου; Πες μας στα σχόλια.',
    '',
    `${TAG} Σύνδεσμος στο bio.`,
    '',
    '#ακίνητα #ιδιοκτήτες #ενοίκια #ΕΝΦΙΑ #PROPERWISE',
  ].join('\n');
  return {
    key: 'proto', series: 'makro', scenes,
    chapters: ['Η αρχή', 'Σάρωση', ASSISTANT_NAME, 'Προθεσμίες', 'Σύγκριση', 'Λογιστής', 'PROPERWISE'],
    chords: [ch('A2', 'E3', 'G3', 'C4'), ch('F2', 'C3', 'E3', 'A3'), ch('C3', 'G3', 'B3', 'E4'), ch('G2', 'D3', 'E3', 'B3')],
    cover: 4.5 + 2.6, caption, title: 'Βάλε το ακίνητό σου σε τάξη', campaign: 'proto', link: utm('/', 'proto'),
    own: { brand: { name: 'PROPERWISE', glyph: BUILDING }, video: 'docs/marketing/reels/reel-2', doc: 'docs/marketing/instagram/reel-2', file: 'PROPERWISE-reel-2.mp4', when: 'Το πρώτο reel του λογαριασμού: ανεβαίνει πρώτο, πριν από τις σειρές.' },
  };
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

async function main() {
  const only = process.argv[2];
  // Χωρίς όρισμα: οι τρεις σειρές. «proto»: το πρώτο reel του λογαριασμού.
  const reels = only === 'proto' ? [protoReel()] : [vraxyReel(), foroiReel(), makroReel()].filter(r => !only || r.series === only);
  for (const r of reels) {
    const b = build(r);
    const outDir = join(ROOT, r.own ? r.own.video : join('docs/marketing/reels', `seires-${r.key}`));
    const docDir = join(ROOT, r.own ? r.own.doc : join('docs/marketing/instagram/seires', r.key, 'reel'));
    mkdirSync(docDir, { recursive: true });
    await shoot({ html: b.html, dur: b.dur, outDir, file: 'silent.mp4', checkAt: b.checkAt, cover: { t: r.cover, path: join(docDir, 'cover.jpg') }, blend: r.own ? false : undefined });
    if (process.env.REEL_PREVIEW) continue;
    const m = new Mix(b.dur);
    const ks = b.sound(m);
    m.duck(ks);
    m.reverb(.5);
    const wav = join(outDir, 'sound.wav');
    m.write(wav, 1.2);
    const final = r.own ? r.own.file : `${r.key}.mp4`;
    mux(join(outDir, 'silent.mp4'), wav, join(outDir, final));
    if (r.own) writeFileSync(join(docDir, 'caption.md'), r.caption + '\n');
    writeFileSync(join(docDir, 'README.md'), [
      `# Reel: ${r.own ? r.own.brand.name : SERIES[r.series].name} · ${r.title}`,
      '',
      `Παράγεται από το \`npx tsx scripts/marketing/reelSeires.ts${r.own ? ' proto' : ''}\`. Το βίντεο είναι στο`,
      `\`${r.own ? r.own.video : `docs/marketing/reels/seires-${r.key}`}/${final}\` (έξω από το git) και το εξώφυλλο εδώ, \`cover.jpg\`.`,
      '',
      r.own ? `**Πότε:** ${r.own.when}` : `**Πότε:** ${elDate(PUBLISH[r.series], { weekday: 'long', day: 'numeric', month: 'long' })}, το βράδυ (19:00-21:00), μαζί με το carousel της ίδιας μέρας.`,
      `**Διάρκεια:** ${mmss(b.dur)}, με πρωτότυπη μουσική. Ανεβαίνει με τον ήχο του.`,
      `**Σύνδεσμος (βιογραφικό ή μήνυμα):** ${r.link}`,
      '',
      '## Τα κεφάλαια',
      '',
      'Ό,τι λένε τα stories του θέματος, σε μία ιστορία. Η μπάρα πάνω δείχνει τα κεφάλαια.',
      '',
      ...b.chapters.map(c => `- ${mmss(c.a)} ${c.label}`),
      '',
      '## Πριν τη δημοσίευση',
      '',
      '- Εξώφυλλο: το `cover.jpg`. Το προφίλ το κόβει σε 3:4· ο τίτλος είναι μέσα στο κόψιμο.',
      '- Πρώτα ως «δοκιμαστικό reel» (trial reel), σε όσους δεν ακολουθούν. Αν κρατήσει, κοινοποίηση και στους ακολούθους.',
      '- Αυτόματοι υπότιτλοι: όχι. Κάθε φράση είναι ήδη γραμμένη στην εικόνα.',
      '- Απαντήσεις στα σχόλια μέσα στην πρώτη ώρα· όποιος γράψει «ΥΠΟΛΟΓΙΣΤΗΣ» παίρνει τον σύνδεσμο σε μήνυμα.',
      '- Μετά από 48 ώρες: μέσος χρόνος θέασης και αποστολές ανά προβολή. Αν οι περισσότεροι φεύγουν πριν από το πρώτο κεφάλαιο, το αγκίστρι θέλει αλλαγή.',
      '',
      '## Λεζάντα',
      '',
      '```',
      r.caption,
      '```',
      '',
    ].join('\n'));
    console.log(`✓ ${r.key}: ${join(outDir, final)} (${mmss(b.dur)})`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
