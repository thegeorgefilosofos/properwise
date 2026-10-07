// ═══════════════════════════════════════════════════════════════════════════
// SHORTS · Η ΒΙΒΛΙΟΘΗΚΗ ΣΚΗΝΩΝ
// ─────────────────────────────────────────────────────────────────────────
// Κάθε σκηνή είναι συνάρτηση με παραμέτρους: κείμενα με `{γεγονότα}`, ποια
// γεγονότα δείχνει, πόσους χτύπους κρατά και με ποιο πέρασμα μπαίνει. Η μορφή
// είναι του reel «Πού πήγαν τα ενοίκια;» (reelKathara.ts), που ο ιδιοκτήτης
// ενέκρινε: μία στήλη σε ροή, μάτι, τίτλος, 48 ως το περιεχόμενο, ρυθμός 8px,
// γωνίες 12 / 20 / 28, ετικέτες 26 (ποτέ μικρότερες).
//
// Οι σημάνσεις του ελέγχου στοίχισης είναι οι ίδιες με το reelKathara:
// data-col (L/R/LR), data-lx / data-rx, data-gap, data-cx, data-ccol, data-hend.
// Τα ψηφία που ΔΕΝ είναι ποσά (μέρες ημερολογίου, αύξων αριθμός δόσης) έχουν
// `data-date` ή `data-of="<γεγονός>"`, ώστε ο έλεγχος ιχνηλασίας να ξέρει από
// πού ήρθαν.
// ═══════════════════════════════════════════════════════════════════════════
import { ASSISTANT_INITIAL, ASSISTANT_NAME } from '../../../lib/assistant/identity';
import { mark } from '../igKit';
import { fn } from '../../../lib/core/format';
import { SEG } from '../rentFacts';
import { n as note } from '../synth';
import {
  A, C, amt, CW, ICON, K, UP, counter, drawn, esc, fill, glyph, html, seg, tw,
  type Facts, type Series, type Txt,
} from './kit';
import type { Arc, SceneCtx, SceneOut, SceneSpec } from './spec';
import type { TransitionName } from './transitions';

// ── Τα κοινά ─────────────────────────────────────────────────────────────
interface Base {
  beats: number; in?: TransitionName; inOpts?: Record<string, string>;
  /** Δείχνει την υποσημείωση «παράδειγμα». */ note?: boolean;
  /** Σκηνή-ανάσα: σκόπιμα αραιή, εξαιρείται από τον έλεγχο ζύγισης. */ breathing?: boolean;
  arc?: Arc; story: Txt; cue: Txt;
}
const def = <P extends Base>(kind: string, build: (p: P, c: SceneCtx) => SceneOut) =>
  (p: P): SceneSpec<P> => ({ kind, beats: p.beats, in: p.in, inOpts: p.inOpts, arc: p.arc, story: p.story, cue: p.cue, params: p, build: c => build(p, c) });

const H = (c: SceneCtx, s: Txt, cls = 'a') => html(s, c.f, cls);
const F = (c: SceneCtx, id: string) => { const x = c.f[id]; if (!x) throw new Error(`Η σκηνή ζητά γεγονός «${id}» που δεν υπάρχει.`); return x; };
const blk = (inner: string, cls = '') => `<div class="blk ${cls}">${inner}</div>`;
const mk = (inner: string, a: string, cls = '') => `<div class="mk ${cls}"><div class="mi" ${a}>${inner}</div></div>`;

/**
 * ΚΙΝΗΤΙΚΗ ΕΜΦΑΣΗ ΣΤΗ ΛΕΞΗ-ΚΛΕΙΔΙ. Η λέξη με τόνο (`**…**`) κάθε γραμμής, μόλις
 * βγει η γραμμή από τη μάσκα, πετάγεται λίγο και κάθεται (το `kick` της μηχανής).
 */
const kick = (h: string, t: number) => h.replace(/<span class="(a|neg|ok|kwd)">/g, `<span class="$1 kw" ${A('kick', +t.toFixed(3), .6)}>`);

/** Μάτι και τίτλος. Ο τίτλος μπαίνει γραμμή γραμμή από μάσκα. */
function head(c: SceneCtx, t: number, eb: Txt, lines: Txt[], size = 88, end = true) {
  return `<div class="eb mono" data-col="L" ${A('left', t, .5)}><i></i>${esc(UP(fill(eb, c.f)))}</div>
    <div class="hd" style="font-size:${size}px;margin-top:16px" data-col="L"${end ? ' data-hend' : ''}>${lines.map((l, k) => mk(kick(H(c, l), t + .55 + k * .1), A('mask', t + .08 + k * .1, .6))).join('')}</div>`;
}
/** Οι χρόνοι της σκηνής: από την αρχή ή, στο αγκίστρι, ήδη στη θέση τους στο καρέ 0. */
const T0 = (c: SceneCtx) => (c.k === 0 ? -1.2 : c.t0 + .05);
/**
 * Η ΣΚΗΝΗ ΕΙΝΑΙ ΗΔΗ ΕΚΕΙ ΣΤΟ ΚΟΨΙΜΟ. Το περιεχόμενο αρχίζει να μπαίνει 0,3″ πριν
 * από το κόψιμο, ώστε το πέρασμα να αποκαλύπτει σκηνή και όχι άδειο φόντο.
 */
const B0 = (c: SceneCtx) => (c.k === 0 ? c.t0 + .05 : c.t0 - .3);

/**
 * Μέγεθος που χωρά στη στήλη. Πλάτη γλύφων του Inter 900 σε em (μετρημένα):
 * ψηφία με σταθερό πλάτος, κόμμα και τελεία στενά, € όσο ένα ψηφίο.
 */
export function fit(text: string, max: number, width = CW, track = -.06): number {
  const em = [...text].reduce((a, ch) => a + (/[0-9€]/.test(ch) ? .68 : /[.,]/.test(ch) ? .3 : /\s/.test(ch) ? .28 : .72) + track, 0);
  return Math.floor(Math.min(max, width / em));
}

// ═══ 1 · Αγκίστρι με αντίστροφη μέτρηση ════════════════════════════════════
// Στο καρέ 0: ο μεγάλος αριθμός και η σύγκρουση. Από το καρέ 0 ανάβουν οι μέρες μία μία.
export interface HookCountP extends Base { eyebrow: Txt; lines: Txt[]; valueFact: string; unit: Txt; dotsFact: string; punch: Txt; tag?: Txt }
export const hookCount = def<HookCountP>('hookCount', (p, c) => {
  const t = T0(c), v = F(c, p.valueFact), N = Number(F(c, p.dotsFact).value);
  const dots = Array.from({ length: N }, (_, i) => `<i ${A('pop', c.t0 + .05 + i * .06, .4)}></i>`).join('');
  return {
    html: blk(`${head(c, t, p.eyebrow, p.lines, 88)}
      <div class="hkc gh" data-col="L" style="height:${Math.round(fit(v.text, 680, CW - 24) * .8)}px"><b class="num big acc-g" data-hero id="hz${c.k}" style="font-size:${fit(v.text, 680, CW - 24)}px" ${A('slam', t + .2, .5)}>${esc(v.text)}</b></div>
      <div class="hkr" data-col="LR"><span class="unit" ${A('left', t + .4, .5)}>${esc(UP(fill(p.unit, c.f)))}</span><div class="hkd">${dots}</div></div>
      <div class="hd punch" style="font-size:${Math.min(72, fit(fillPlain(p.punch, c.f), 72, CW, -.035))}px;margin-top:56px" data-col="L">${mk(kick(H(c, p.punch, 'neg'), c.t0 + .7), A('mask', c.t0 + .3, .55))}</div>
      ${p.tag ? `<div class="tagl" style="margin-top:24px" data-col="L" ${A('up', c.t0 + 1.5, .5)}>${H(c, p.tag)}</div>` : ''}`),
    css: `
      /* Ο αριθμός είναι ο ήρωας: όσο φαρδύς είναι η στήλη. Η μονάδα και οι μέρες σε μία γραμμή από κάτω. */
      .hkc{display:flex;align-items:center}
      .hkc .big{line-height:.8;letter-spacing:-.075em;font-weight:900}
      .hkr{display:flex;align-items:center;gap:28px;margin-top:40px;height:64px}
      .hkr .unit{flex:none;font-family:'Roboto Mono',monospace;font-size:52px;line-height:64px;letter-spacing:.14em;font-weight:600;color:${c.s.accent}}
      .hkd{flex:1;display:flex;gap:8px;height:36px}
      .hkd i{flex:1;border-radius:6px;background:${c.s.accent};box-shadow:0 0 18px ${c.s.accent}88}`,
    hits: [c.t0 + .35],
    sfx: m => { for (let i = 0; i < N; i++) m.click(c.t0 + .05 + i * .06, 2600 + i * 40, .03, (i % 2 ? .3 : -.3)); m.boom(c.t0 + .35, .2); },
  };
});

// ═══ 2 · Αγκίστρι-ερώτηση με σφραγίδα ════════════════════════════════════
export interface HookStampP extends Base { eyebrow: Txt; lines: Txt[]; stamp: Txt; chip?: Txt; sub?: Txt;
  /** Η γραμμή που κουβαλά το ποσό: το `**…**` της γίνεται ήρωας σε όλο το πλάτος, το υπόλοιπο μένει τίτλος. */
  hero?: number }
export const hookStamp = def<HookStampP>('hookStamp', (p, c) => {
  const t = T0(c);
  const hm = p.hero != null ? /^\*\*(.+?)\*\*\s*(.*)$/.exec(p.lines[p.hero]) : null;
  if (p.hero != null && !hm) throw new Error('Το αγκίστρι ζητά ήρωα σε γραμμή χωρίς **…** στην αρχή.');
  const big = hm ? fill(hm[1], c.f) : '';
  const top = hm ? `<div class="eb mono" data-col="L" ${A('left', t, .5)}><i></i>${esc(UP(fill(p.eyebrow, c.f)))}</div>
      <div class="hd" style="font-size:96px;margin-top:16px" data-col="L">${p.lines.slice(0, p.hero).map((l, k) => mk(kick(H(c, l), c.t0 + .45 + k * .1), A('mask', t + .08 + k * .1, .6))).join('')}</div>
      <div class="hsb" data-col="L" style="height:${Math.round(fit(big, 460, CW - 24) * .82)}px"><b class="num acc-g" data-hero style="font-size:${fit(big, 460, CW - 24)}px" ${A('slam', t + .2, .5)}>${amt(big)}</b></div>
      <div class="hd" style="font-size:96px" data-col="LR" data-hend>${mk(H(c, hm![2]), A('mask', t + .3, .6))}</div>` : head(c, t, p.eyebrow, p.lines, 96);
  return {
    html: blk(`${top}
      <div class="hks gh" data-col="L"><span class="stamp" id="hz${c.k}"${hm ? '' : ' data-hero'} ${A('thump', c.t0 - .3, .6)}>${esc(UP(fill(p.stamp, c.f)))}</span></div>
      ${p.chip ? `<div class="row" style="margin-top:40px" data-col="LR" ${A('up', c.t0 + .7, .5)}><span class="chipl" data-icon>${glyph(ICON.cal, c.s.accent, 34, 2)}<span>${H(c, p.chip)}</span></span></div>` : ''}
      ${p.sub ? `<div class="sub2" style="margin-top:24px" data-col="L" ${A('up', c.t0 + 1.1, .5)}>${H(c, p.sub)}</div>` : ''}`),
    css: `
      .hks{height:270px;display:flex;align-items:center}
      .hsb{display:flex;align-items:center;margin-top:8px}
      .hsb b{font-weight:900;letter-spacing:-.06em;line-height:.8}
      .stamp{display:inline-block;padding:4px 40px 12px;border:12px solid ${SEG.tax};border-radius:32px;color:${SEG.tax};font-size:200px;line-height:200px;font-weight:900;letter-spacing:-.02em;
        transform-origin:30% 60%;text-shadow:0 0 60px ${SEG.tax}55;box-shadow:0 0 80px ${SEG.tax}33,inset 0 0 40px ${SEG.tax}22}`,
    hits: [c.t0 + .05],
    sfx: m => { m.boom(c.t0 + .02, .35); m.clap(c.t0 + .02, .1); m.click(c.t0 + .02, 500, .14); },
  };
});

// ═══ 3 · Ημερολόγιο προθεσμίας ═══════════════════════════════════════════
// Ο μήνας της προθεσμίας: σήμερα, οι μέρες ως την προθεσμία, η μέρα που
// διαγράφεται (Σαββατοκύριακο) και η προθεσμία σε κύκλο που χαράζεται.
export interface CalendarP extends Base { eyebrow: Txt; title: Txt[]; todayFact: string; targetFact: string; strikeFact?: string; strikeLabel?: Txt; caption: Txt }
const WD = ['Δ', 'Τ', 'Τ', 'Π', 'Π', 'Σ', 'Κ'];
export const calendar = def<CalendarP>('calendar', (p, c) => {
  const t = B0(c);
  const today = String(F(c, p.todayFact).value), target = String(F(c, p.targetFact).value), strike = p.strikeFact ? String(F(c, p.strikeFact).value) : '';
  const [y, m] = target.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(), lead = (first + 6) % 7, days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const rows = Math.ceil((lead + days) / 7), dd = (iso: string) => (iso.slice(0, 7) === target.slice(0, 7) ? Number(iso.slice(8)) : -1);
  const td = dd(today), tg = dd(target), sk = strike ? dd(strike) : -1;
  const cells = Array.from({ length: rows * 7 }, (_, i) => {
    const d = i - lead + 1, r = Math.floor(i / 7), col = i % 7;
    if (d < 1 || d > days) return '<i class="e"></i>';
    const cls = [d < td ? 'past' : '', d === td ? 'today' : '', d > td && d <= tg ? 'run' : '', d === tg ? 'tgt' : '', d === sk ? 'sk' : '', col >= 5 ? 'we' : ''].filter(Boolean).join(' ');
    const fillAt = d > td && d <= tg ? t + 1.3 + (d - td) * .045 : 0;
    return `<i class="${cls}" ${A('pop', t + .5 + (r + col) * .03, .45)}${fillAt ? ` data-fill="${fillAt.toFixed(3)}"` : ''}${d === tg ? ` id="cal${c.k}t"` : ''}><b data-date>${d}</b></i>`;
  }).join('');
  const tSk = t + 2.4, tTg = t + 2.9;
  return {
    html: blk(`${head(c, t, p.eyebrow, p.title, 88)}
      <div class="cal card gh" data-hero data-col="LR" ${A('up', t + .35, .6)}>
        <div class="wd">${WD.map((w, i) => `<span class="${i >= 5 ? 'we' : ''}">${w}</span>`).join('')}</div>
        <div class="cg" style="grid-template-rows:repeat(${rows},125px)">${cells}</div>
        ${sk > 0 ? `<svg class="skx" id="skx${c.k}" viewBox="0 0 100 100" preserveAspectRatio="none"><path pathLength="1" stroke-dasharray="1" style="stroke-dashoffset:1" data-draw="${tSk},${tSk + .3}" d="M14 14 L86 86"/><path pathLength="1" stroke-dasharray="1" style="stroke-dashoffset:1" data-draw="${tSk + .15},${tSk + .45}" d="M86 14 L14 86"/></svg>` : ''}
        <svg class="ring" id="rng${c.k}" viewBox="0 0 120 120"><path pathLength="1" stroke-dasharray="1" style="stroke-dashoffset:1" data-draw="${tTg},${tTg + .6}" d="M60 8 C 96 6, 116 34, 112 64 C 108 98, 76 116, 50 112 C 18 108, 4 80, 8 54 C 12 26, 36 10, 66 9"/></svg>
      </div>
      <div class="capr" style="margin-top:32px" data-col="L" ${A('up', tTg + .4, .5)}>${sk > 0 && p.strikeLabel ? `<span class="pill neg big">${H(c, p.strikeLabel)}</span>` : ''}<span class="capt">${H(c, p.caption)}</span></div>`),
    css: `
      .cal{position:relative}
      .cal .wd{display:grid;grid-template-columns:repeat(7,1fr);gap:12px;font-family:'Roboto Mono',monospace;font-size:30px;line-height:40px;color:${K.muted};text-align:center;margin-bottom:12px}
      .cal .wd .we{color:${SEG.tax}cc}
      .cal .cg{display:grid;grid-template-columns:repeat(7,1fr);gap:12px}
      .cal .cg i{position:relative;display:flex;align-items:center;justify-content:center;border-radius:16px;background:${K.ink}08;border:1.5px solid ${K.ink}12;font-style:normal}
      .cal .cg i.e{background:none;border:0}
      .cal .cg i b{font-size:52px;font-weight:800;color:${C.ink};letter-spacing:-.02em}
      .cal .cg i.past b{color:${K.faint}}
      .cal .cg i.we b{color:${K.tax}}
      .cal .cg i.sk{background:${SEG.tax}1c;border-color:${SEG.tax}66}
      .cal .cg i.today{border-color:${C.accent};box-shadow:inset 0 0 0 2px ${C.accent}}
      .cal .cg i.run.lit{background:${c.s.accent}2e;border-color:${c.s.accent}66}
      .cal .cg i.tgt.lit{background:${c.s.accent};border-color:${c.s.accent};box-shadow:0 0 50px ${c.s.accent}aa}
      .cal .cg i.tgt.lit b{color:${K.onAccent}}
      .cal .skx{position:absolute;pointer-events:none;overflow:visible}
      .cal .skx path{fill:none;stroke:${SEG.tax};stroke-width:7;stroke-linecap:round;vector-effect:non-scaling-stroke}
      .cal .ring{position:absolute;width:150px;height:150px;pointer-events:none;overflow:visible}
      .cal .ring path{fill:none;stroke:${C.ink};stroke-width:5;stroke-linecap:round}
      .capr{display:flex;align-items:center;gap:20px;flex-wrap:nowrap}
      .capt{font-size:44px;line-height:52px;font-weight:650;letter-spacing:-.015em;color:${C.ink};white-space:nowrap}`,
    js: `
      // Τα κελιά είναι position:relative, άρα το offsetLeft τους μετρά από την κάρτα (.cal), όπου ζουν και ο κύκλος και το Χ.
      // Μετριέται σε κάθε καρέ: όσο η σκηνή είναι κρυφή (display:none) τα μεγέθη είναι μηδέν.
      const box = e => e && e.offsetWidth ? { x: e.offsetLeft, y: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight } : null;
      const g = { t: box($('cal${c.k}t')), sk: box(document.querySelector('#s${c.k} .cg i.sk')) };
      if (g.t) { const r = $('rng${c.k}'); r.style.left = (g.t.x + g.t.w / 2 - 75) + 'px'; r.style.top = (g.t.y + g.t.h / 2 - 75) + 'px'; }
      if (g.sk) { const s = $('skx${c.k}'); s.style.left = (g.sk.x + 14) + 'px'; s.style.top = (g.sk.y + 14) + 'px'; s.style.width = (g.sk.w - 28) + 'px'; s.style.height = (g.sk.h - 28) + 'px'; }
      document.querySelectorAll('#s${c.k} [data-fill]').forEach(e => e.classList.toggle('lit', t >= +e.dataset.fill));`,
    hits: [tTg + .1],
    sfx: m => {
      for (let d = td + 1; d <= tg; d++) m.click(t + 1.3 + (d - td) * .045, 2000 + (d - td) * 50, .028, .2);
      if (sk > 0) { m.click(tSk, 900, .1); m.click(tSk + .15, 800, .1); }
      m.sweep(tTg, .6, 600, 1400, .01); m.boom(tTg + .1, .14); m.bell(tTg + .1, note('A5'), .035);
    },
  };
});

// ═══ 4 · Νύχτες μιας κράτησης: ένα πλακίδιο ανά νύχτα, μία σειρά ανά μήνα ══
// Ζύγιση (07/10/2026): οκτώ πλακίδια σε μία γραμμή έβγαιναν 94px. Μία σειρά ανά
// μήνα δίνει πλακίδια διπλάσια και η αλλαγή του μήνα γίνεται η γραμμή ανάμεσα.
export interface NightsP extends Base { eyebrow: Txt; title: Txt[]; nights: { dayFact: string; rateFact: string; high: boolean }[]; months: [Txt, Txt]; splitLabel: Txt; caption: Txt }
export const nights = def<NightsP>('nights', (p, c) => {
  const t = B0(c), N = p.nights.length;
  const rows = [p.nights.filter(x => x.high), p.nights.filter(x => !x.high)];
  const per = Math.max(rows[0].length, rows[1].length), G = 20, tw2 = (CW - G * (per - 1)) / per;
  let k = 0;
  const row = (r: typeof p.nights) => `<div class="ntr">${r.map(x => { const i = k++;
    return `<div class="nt ${x.high ? 'hi' : 'lo'}" style="width:${tw2}px" ${A('flip', t + .6 + i * .09, .5)}><b data-date>${esc(F(c, x.dayFact).text)}</b><span>${esc(F(c, x.rateFact).text)}</span></div>`; }).join('')}</div>`;
  return {
    html: blk(`${head(c, t, p.eyebrow, p.title, 88)}
      <div class="lb nml gh" data-col="L" ${A('fade', t + .5, .4)}>${esc(UP(fill(p.months[0], c.f)))}</div>
      <div class="nts" data-hero data-col="LR" style="margin-top:16px">${row(rows[0])}</div>
      <div class="nsp" data-col="LR" ${A('up', t + 1.6, .5)}><i class="nsplit" ${A('grow', t + 1.6, .5)}></i><span class="pill acc big">${H(c, p.splitLabel)}</span><i class="nsplit" ${A('grow', t + 1.6, .5)}></i></div>
      <div class="lb nml" data-col="L" ${A('fade', t + 1.2, .4)}>${esc(UP(fill(p.months[1], c.f)))}</div>
      <div class="nts" data-col="LR" style="margin-top:16px">${row(rows[1])}</div>
      <div class="sub2" style="margin-top:40px" data-col="L" ${A('up', t + 2.6, .5)}>${H(c, p.caption)}</div>`),
    css: `
      .nml{font-size:30px;line-height:36px}
      .nts .ntr{display:flex;gap:${G}px;height:220px}
      .nt{border-radius:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;transform-origin:50% 0}
      .nt b{font-size:84px;line-height:88px;font-weight:850;letter-spacing:-.04em}
      .nt span{font-size:44px;line-height:48px;font-weight:800}
      .nt.hi{background:linear-gradient(180deg,${c.s.accent},${c.s.accent}cc);color:${K.onAccent};box-shadow:0 24px 60px -24px ${c.s.accent}aa}
      .nt.lo{background:${K.ink}0d;border:2.5px solid ${c.s.accent}88;color:${C.ink}}
      .nsp{display:flex;align-items:center;gap:20px;height:64px;margin:32px 0}
      .nsplit{flex:1;height:4px;border-radius:2px;background:${C.ink};box-shadow:0 0 24px ${K.ink};transform-origin:50% 50%}`,
    hits: [t + 1.6],
    sfx: m => { p.nights.forEach((x, i) => m.click(t + .6 + i * .09, x.high ? 1800 : 1100, .05, (i - N / 2) * .08)); m.boom(t + 1.6, .14); m.pluck(t + 1.9, note('E5'), .04); },
  };
});

// ═══ 5 · Μύθος και γεγονός, χωρισμένα ═══════════════════════════════════
export interface MythP extends Base { eyebrow: Txt; myth: Txt; fact: Txt; source?: Txt }
export const mythFact = def<MythP>('mythFact', (p, c) => {
  const t = B0(c), ts = t + 1.3, tf2 = t + 2.0;
  return {
    html: blk(`<div class="eb mono" data-col="L" ${A('left', t, .5)}><i></i>${esc(UP(fill(p.eyebrow, c.f)))}</div>
      <div class="mf my card" style="margin-top:24px" data-col="LR" ${A('right', t + .15, .55)} id="my${c.k}">
        <div class="tagr"><span class="pill neg big">${glyph(ICON.cross, SEG.tax, 30, 2.6)}ΜΥΘΟΣ</span></div>
        <div class="mt"><span class="strike" data-nobg ${A('strike', ts, .5)}>${H(c, p.myth)}</span></div>
      </div>
      <div class="mf ft card" data-hero style="margin-top:32px" data-col="LR" ${A('left', tf2, .6)} id="ft${c.k}">
        <div class="tagr"><span class="pill ok big">${glyph(ICON.check, C.ok, 30, 2.8)}ΓΕΓΟΝΟΣ</span></div>
        <div class="mt">${kick(H(c, p.fact, 'ok'), tf2 + .6)}</div>
      </div>
      ${p.source ? `<div class="srcl" style="margin-top:24px" data-col="L" ${A('fade', tf2 + .6, .5)}>${H(c, p.source)}</div>` : ''}`),
    css: `
            .mf .tagr{display:flex;height:64px;align-items:center}
      .mf .mt{position:relative;margin-top:24px;font-size:66px;line-height:78px;font-weight:800;letter-spacing:-.03em;text-wrap:balance}
      .my .mt{color:${K.muted}}
      /* Η διαγραφή περνά από ΚΑΘΕ γραμμή: φόντο της ίδιας της γραμμής, που μεγαλώνει από αριστερά. */
      .strike{background-image:linear-gradient(${SEG.tax},${SEG.tax});background-repeat:no-repeat;background-position:0 58%;background-size:calc(var(--k,0) * 100%) 8px;
        -webkit-box-decoration-break:clone;box-decoration-break:clone}
      .ft{border-color:${K.ok}55!important;background:linear-gradient(180deg,${K.ok}1f,${K.ok}0a),${K.panel}!important}`,
    hits: [ts + .1, tf2 + .2],
    sfx: m => { m.sweep(ts, .4, 1800, 700, .016); m.click(ts + .35, 600, .1); m.boom(tf2 + .2, .16); m.bell(tf2 + .25, note('E6'), .035); },
  };
});

// ═══ 6 · Οι δόσεις: πληρωμένες, η επόμενη, όσες μένουν ═══════════════════
// Δύο σειρές των έξι, ο μήνας μέσα σε κάθε κύκλο: κύκλοι 112px αντί για 58.
export interface TrackP extends Base { eyebrow: Txt; title: Txt[]; datesFact: string; nextFact: string; labels: [Txt, Txt]; paidFact: string; leftFact: string }
export const track = def<TrackP>('track', (p, c) => {
  const t = B0(c);
  const dates = String(F(c, p.datesFact).value).split(','), next = Number(F(c, p.nextFact).value);
  // Οι τριγράμματες συντομογραφίες του ελληνικού ημερολογίου: ΙΟΝ / ΙΟΛ, ώστε Ιούνιος και Ιούλιος να μη γράφονται ίδια.
  const MON = ['ΙΑΝ', 'ΦΕΒ', 'ΜΑΡ', 'ΑΠΡ', 'ΜΑΪ', 'ΙΟΝ', 'ΙΟΛ', 'ΑΥΓ', 'ΣΕΠ', 'ΟΚΤ', 'ΝΟΕ', 'ΔΕΚ'];
  const per = Math.ceil(dates.length / 2);
  const dot = (d: string, i: number) => {
    const st = i < next - 1 ? 'paid' : i === next - 1 ? 'nx' : 'left';
    return `<div class="tk ${st}"${st === 'nx' ? ` id="tk${c.k}n"` : ''} ${A('pop', t + .5 + i * .07, .45)}>${st === 'paid' ? `<em>${glyph(ICON.check, K.onAccent, 28, 3.4)}</em>` : ''}<span class="mono" data-date>${MON[Number(d.slice(5, 7)) - 1]}</span></div>`;
  };
  return {
    html: blk(`${head(c, t, p.eyebrow, p.title, 88)}
      <div class="trk card gh" data-col="LR" ${A('up', t + .3, .55)}>
        <div class="tks">${dates.slice(0, per).map((d, i) => dot(d, i)).join('')}</div>
        <div class="tks" style="margin-top:28px">${dates.slice(per).map((d, i) => dot(d, i + per)).join('')}</div>
      </div>
      <div class="tsum" data-hero style="margin-top:40px" data-col="LR">
        <div ${A('up', t + 1.6, .5)}><b class="ok num">${esc(F(c, p.paidFact).text)}</b><span>${H(c, p.labels[0])}</span></div>
        <div ${A('up', t + 1.9, .5)} data-col="R"><b class="acc num">${esc(F(c, p.leftFact).text)}</b><span>${H(c, p.labels[1])}</span></div>
      </div>`),
    css: `
      .tks{display:flex;justify-content:space-between}
      .tk{position:relative;width:112px;height:112px;border-radius:50%;display:grid;place-items:center}
      .tk span{font-size:30px;line-height:36px;font-weight:750;letter-spacing:.02em;white-space:nowrap}
      .tk em{position:absolute;right:-6px;top:-6px;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:${C.ok};border:3px solid ${K.panel};font-style:normal}
      .tk.paid{background:${C.ok}2e;border:3px solid ${C.ok}}
      .tk.paid span{color:${K.ink}}
      .tk.nx{background:${c.s.accent};box-shadow:0 0 0 10px ${c.s.accent}33,0 0 60px ${c.s.accent}}
      .tk.nx span{color:${K.onAccent};font-weight:850}
      .tk.left{background:${K.panel};border:3px solid ${c.s.accent}aa}
      .tk.left span{color:${c.s.accent}}
      .tsum{display:flex;justify-content:space-between}
      .tsum>div{display:flex;flex-direction:column;gap:8px}
      .tsum>div[data-col=R]{align-items:flex-end}
      .tsum b{font-size:400px;line-height:350px;font-weight:900;letter-spacing:-.06em}
      .tsum span{font-size:44px;line-height:52px;font-weight:700;color:${C.muted}}`,
    hits: [t + 1.9],
    sfx: m => { dates.forEach((_, i) => m.click(t + .5 + i * .07, i < next - 1 ? 2400 : 1300, .04, (i - 6) * .05)); m.pluck(t + 1.6, note('C5'), .05, -.3); m.pluck(t + 1.9, note('G5'), .05, .3); m.boom(t + 1.95, .12); },
  };
});

// ═══ 7 · Ο μεγάλος αριθμός ═════════════════════════════════════════════
export interface BigP extends Base { eyebrow: Txt; title: Txt[]; valueFact: string; caption: Txt; chips?: Txt[]; size?: number;
  /** Η ανάλυση του ποσού, γραμμή γραμμή (ετικέτα, ποσό): το ποσό και από τι γίνεται. */
  rows?: { label: Txt; value: Txt }[] }
export const bigNumber = def<BigP>('bigNumber', (p, c) => {
  const t = B0(c), v = F(c, p.valueFact), tv = t + .4, size = fit(v.text, p.size ?? 320);
  const fmt = (x: number) => fmtLike(v.text, x);
  return {
    html: blk(`${head(c, t, p.eyebrow, p.title, 80)}
      <div class="bn gh" data-col="L"><b class="num acc-g" data-hero id="bn${c.k}" style="font-size:${size}px" ${A('slam', tv, .55)}>${typeof v.value === 'number' ? counter([{ ...seg(tv, tv + 1.1, 0, v.value, fmt, 2, v.text), l: 1 }]) : amt(v.text)}</b></div>
      <div class="sub2" style="margin-top:24px" data-col="L" ${A('up', tv + 1.1, .5)}>${H(c, p.caption)}</div>
      ${p.rows?.length ? `<div class="bnl card" style="margin-top:40px" data-col="LR" ${A('up', tv + 1.3, .5)}>${p.rows.map((r, i) => `<div class="bnr" data-gap="bnr${c.k}" ${A('right', tv + 1.45 + i * .14, .4)}><span>${H(c, r.label)}</span><b class="num" data-rx="amt${c.k}">${H(c, r.value)}</b></div>`).join('')}</div>` : ''}
      ${p.chips?.length ? `<div class="chips" style="margin-top:32px" data-col="L">${p.chips.map((x, i) => `<span class="pill acc big" ${A('pop', tv + 1.6 + (p.rows?.length ?? 0) * .14 + i * .2, .45)}>${H(c, x)}</span>`).join('')}</div>` : ''}`),
    css: `
      .bn{height:${Math.round(size * 1.04)}px;display:flex;align-items:center}
      .bnr{display:flex;justify-content:space-between;align-items:center;height:72px;font-size:36px;color:${C.muted}}
      .bnr + .bnr{border-top:1.5px solid ${K.ink}12}
      .bnr b{font-size:40px;font-weight:800;color:${C.ink}}
      .bnr:first-child span,.bnr:first-child b{color:${c.s.accent}}
      .bn b{font-weight:900;letter-spacing:-.06em;line-height:1;white-space:nowrap}
      .chips{display:flex;gap:16px;flex-wrap:wrap}`,
    hits: [tv + 1],
    sfx: m => { for (let k = 0; k < 16; k++) m.click(tv + k * .06, 1600 + k * 70, .03); m.boom(tv + 1, .3); m.kick(tv + 1, .8); m.bell(tv + 1.02, note('A5'), .045); },
  };
});
/** Μορφή ενδιάμεσου βήματος μετρητή, ίδια με το τελικό κείμενο: «75,14€» → «37,05€». */
function fmtLike(final: string, x: number): string {
  const dec = /,(\d+)/.exec(final)?.[1].length ?? 0, unit = /€$/.test(final) ? '€' : '';
  return fn(x, dec) + unit;
}

// ═══ 8 · Λίστα που τσεκάρεται ════════════════════════════════════════════
export interface CheckP extends Base { eyebrow: Txt; title: Txt[]; items: { text: Txt; small?: Txt }[] }
export const checklist = def<CheckP>('checklist', (p, c) => {
  const t = B0(c), st = (i: number) => t + .65 + i * .5;
  return {
    html: blk(`${head(c, t, p.eyebrow, p.title, 88)}
      <div class="ckl card gh" data-hero data-col="LR" ${A('up', t + .3, .55)}>${p.items.map((x, i) => `
        <div class="ck" data-gap="ck${c.k}" ${A('right', st(i) - .2, .45)}><span class="cb">${drawn(ICON.check, C.ok, 52, 3, st(i), st(i) + .3)}</span>
          <div class="tx">${H(c, x.text)}${x.small ? `<small>${H(c, x.small)}</small>` : ''}</div></div>`).join('')}
      </div>`),
    css: `
            .ck{display:flex;align-items:center;gap:32px;padding:40px 0;border-top:1.5px solid ${K.ink}12}
      .ck:first-child{border-top:0;padding-top:8px}
      .ck:last-child{padding-bottom:8px}
      .cb{position:relative;flex:none;width:88px;height:88px;border-radius:50%;display:grid;place-items:center;background:${C.ok}1f;border:2px solid ${C.ok}66}
      .cb em{position:absolute;right:-8px;top:-8px;width:32px;height:32px;border-radius:50%;background:${c.s.accent};color:${K.onAccent};font-style:normal;font-size:26px;line-height:32px;font-weight:800;text-align:center}
      .ck .tx{font-size:52px;line-height:60px;font-weight:750;letter-spacing:-.02em}
      .ck .tx small{display:block;font-size:34px;line-height:44px;font-weight:500;color:${K.muted};margin-top:4px}`,
    sfx: m => p.items.forEach((_, i) => { m.click(st(i), 1200, .08); m.pluck(st(i) + .02, note('C5') + [0, 4, 7, 12, 16][i % 5], .045, (i % 2 ? .3 : -.3)); }),
  };
});

// ═══ 9 · Κινητό: οθόνη κλειδώματος με την ειδοποίηση της εφαρμογής ════════
export interface PhoneP extends Base { eyebrow: Txt; title: Txt[]; dateLine: Txt; push: { title: Txt; body: Txt }; rows: { label: Txt; value: Txt; on?: boolean }[]; rowsTitle: Txt }
export const phoneNotify = def<PhoneP>('phoneNotify', (p, c) => {
  const t = B0(c), tn = t + 1.2;
  return {
    html: blk(`${head(c, t, p.eyebrow, p.title, 80)}
      <div class="phw gh"><div class="ph" data-hero data-ccol ${A('rise', t + .15, .8)}><div class="scr">
        <div class="isl"></div>
        <div class="lk">${glyph(ICON.lock, K.ink, 34, 2)}<span>${H(c, p.dateLine)}</span></div>
        <div class="ntf" id="ntf${c.k}" ${A('down', tn, .5)}><span class="ai">${mark(40, C.ink)}</span><div class="nb"><div class="nh"><b>PROPERWISE</b><em>ΤΩΡΑ</em></div><b class="nt1">${H(c, p.push.title)}</b><span class="nt2">${H(c, p.push.body)}</span></div></div>
        <div class="wl" ${A('up', tn + .8, .5)}><div class="wh">${glyph(ICON.cal, c.s.accent, 30, 2)}<b>${H(c, p.rowsTitle)}</b></div>
          ${p.rows.map((r, i) => `<div class="wr${r.on ? ' on' : ''}" ${A('right', tn + 1.1 + i * .16, .4)}><span>${H(c, r.label)}</span><b class="num" data-rx="wr${c.k}">${H(c, r.value)}</b></div>`).join('')}</div>
      </div></div></div>`),
    css: `
      .phw{position:relative;height:900px}
      .ph{position:absolute;left:${(CW - 760) / 2}px;width:760px;top:0;height:1010px;border-radius:84px;padding:16px;background:linear-gradient(145deg,${K.rule},${K.panel} 38%,${K.rule});
        box-shadow:0 80px 140px ${K.ground}b2,inset 0 0 0 2px ${K.ink}17;-webkit-mask-image:linear-gradient(180deg,${K.ground} 88%,transparent 99%)}
      .ph .scr{position:relative;height:100%;border-radius:70px;overflow:hidden;padding:96px 28px 0;background:radial-gradient(500px 400px at 30% 10%,${c.s.accent}40,transparent 70%),linear-gradient(180deg,${K.lift},${K.ground})}
      .ph .isl{position:absolute;left:50%;top:22px;width:160px;height:44px;margin-left:-80px;border-radius:24px;background:${K.ground}}
      .lk{display:flex;align-items:center;justify-content:center;gap:12px;font-size:34px;font-weight:600;color:${K.ink}}
      .ntf{display:flex;align-items:center;gap:18px;margin-top:40px;padding:22px 24px;border-radius:32px;background:${K.rule}e6;border:1px solid ${K.ink}26;box-shadow:0 30px 60px -20px ${K.ground}}
      .ntf .ai{flex:none;width:64px;height:64px;border-radius:16px;display:grid;place-items:center;background:${C.panel};border:1.5px solid ${C.rule}}
      .ntf .nb{min-width:0;flex:1}
      .ntf .nh{display:flex;justify-content:space-between;align-items:center;font-size:28px;line-height:34px;color:${K.ink}}
      .ntf .nh b{font-weight:700;letter-spacing:.06em}
      .ntf .nh em{font-style:normal;font-family:'Roboto Mono',monospace;color:${K.muted}}
      .ntf .nt1{display:block;font-size:44px;line-height:52px;font-weight:800;margin-top:6px;color:${K.ink}}
      .ntf .nt2{display:block;font-size:40px;line-height:48px;color:${K.ink}}
      .wl{margin-top:24px;padding:20px 24px;border-radius:32px;background:${K.panel}e6;border:1px solid ${K.ink}1a}
      .wl .wh{display:flex;align-items:center;gap:12px;font-size:34px;line-height:44px;padding-bottom:12px}
      .wl .wr{display:flex;justify-content:space-between;align-items:center;height:80px;border-top:1px solid ${K.ink}12;font-size:38px;color:${K.ink}}
      .wl .wr b{font-weight:700;color:${C.ink}}
      .wl .wr.on b,.wl .wr.on span{color:${c.s.accent};font-weight:800}`,
    hits: [tn + .2],
    sfx: m => { m.whoosh(t + .15, .7, .06, true); m.click(tn, 2800, .08); m.click(tn + .08, 2200, .06); m.bell(tn + .05, note('E6'), .04); m.bell(tn + .15, note('B5'), .03); p.rows.forEach((_, i) => m.click(tn + 1.1 + i * .16, 1500, .03)); },
  };
});

// ═══ 10 · Πριν και μετά ══════════════════════════════════════════════════
export interface BeforeAfterP extends Base { eyebrow: Txt; title: Txt[]; heads: [Txt, Txt]; rows: { label: Txt; before: string; after: string }[] }
export const beforeAfter = def<BeforeAfterP>('beforeAfter', (p, c) => {
  const t = B0(c);
  return {
    html: blk(`${head(c, t, p.eyebrow, p.title, 88)}
      <div class="bah gh" data-col="LR"><span class="pill dim big" ${A('fade', t + .4, .4)}>${H(c, p.heads[0])}</span><span class="pill acc big" data-col="R" ${A('fade', t + .9, .4)}>${H(c, p.heads[1])}</span></div>
      ${p.rows.map((r, i) => `<div class="bar card"${i ? '' : ' data-hero'} style="margin-top:32px" data-col="LR" data-gap="ba${c.k}" ${A('up', t + .5 + i * .3, .5)}>
        <div class="lb">${H(c, r.label)}</div>
        <div class="bav"><b class="bf num" ${A('strike', t + 1.5 + i * .3, .4)}>${esc(F(c, r.before).text)}</b>${glyph(ICON.arrow, K.faint, 72, 2.4)}<b class="af num acc-g" data-rx="ba${c.k}" ${A('slam', t + 1.8 + i * .3, .55)}>${esc(F(c, r.after).text)}</b></div>
      </div>`).join('')}`),
    css: `
      .bah{display:flex;justify-content:space-between}
            .bar .lb{font-size:32px;line-height:40px}
      .bav{display:flex;align-items:center;justify-content:space-between;margin-top:16px;height:210px}
      .bav b{font-size:200px;line-height:210px;font-weight:900;letter-spacing:-.05em}
      .bav .bf{position:relative;color:${K.faint}}
      .bav .bf::after{content:'';position:absolute;left:-8px;right:-8px;top:52%;height:9px;border-radius:5px;background:${SEG.tax};transform-origin:0 50%;transform:scaleX(var(--k,0))}`,
    hits: p.rows.map((_, i) => t + 1.85 + i * .3),
    sfx: m => p.rows.forEach((_, i) => { m.sweep(t + 1.5 + i * .3, .3, 1600, 600, .012); m.boom(t + 1.85 + i * .3, .2); m.pluck(t + 1.85 + i * .3, note('A4') - i * 5, .05); }),
  };
});

// ═══ 11 · Κάρτα ερώτησης («Ερώτηση θεατή», «Συχνή ερώτηση») ═══════════════
export interface QuoteP extends Base { label: Txt; question: Txt; source?: Txt; answer: Txt }
export const quote = def<QuoteP>('quote', (p, c) => {
  const t = B0(c), q = fillPlain(p.question, c.f), ta = t + .5 + q.length / 34 + .3;
  return {
    html: blk(`<div class="qc card" data-hero data-col="LR" ${A('rise', t, .7)}>
        <div class="qq">${glyph(ICON.quote, c.s.accent, 150, 2.2)}<span class="pill acc big">${esc(UP(fill(p.label, c.f)))}</span></div>
        <div class="qt">${tw(q, t + .5, 34)}</div>
        ${p.source ? `<div class="srcl" style="margin-top:24px" ${A('fade', ta - .2, .4)}>${H(c, p.source)}</div>` : ''}
      </div>
      <div class="qa" style="margin-top:40px" data-col="LR"><div class="ans" id="qa${c.k}" ${A('pop', ta, .5)}>${kick(H(c, p.answer, 'kwd'), ta + .45)}</div></div>`),
    css: `
      .qc{position:relative}
      .qq{display:flex;align-items:center;justify-content:space-between;height:150px}
      .qq svg{order:2;opacity:.6;margin-right:-12px}
      .qt{margin-top:28px;font-size:82px;line-height:94px;font-weight:800;letter-spacing:-.03em;min-height:376px;text-wrap:balance}
      .tw.on::after{content:'';display:inline-block;width:.08em;height:.9em;margin-left:.06em;background:${c.s.accent};vertical-align:-.1em}
      .ans{display:block;padding:32px 40px;border-radius:36px;background:${c.s.accent};color:${K.onAccent};font-size:66px;line-height:76px;font-weight:850;letter-spacing:-.02em;box-shadow:0 30px 70px -20px ${c.s.accent}aa}`,
    hits: [ta + .1],
    sfx: m => { for (let k = 0; k < Math.min(q.length, 60); k += 2) m.click(t + .5 + k / 34, 2500, .03, .2); m.boom(ta + .1, .2); m.bell(ta + .1, note('E6'), .04); },
  };
});
const fillPlain = (s: Txt, f: Facts) => fill(s, f).replace(/\*\*(.+?)\*\*/g, '$1');

// ═══ 12 · Αποδείξεις (ειδικά στοιχεία) και το σύνολό τους ═════════════════
export interface ReceiptsP extends Base { eyebrow: Txt; title: Txt[]; slips: { head: Txt; lines: [Txt, Txt][]; total: string }[]; sumLabel: Txt; sum: string; wrong?: string; wrongLabel?: Txt }
export const receipts = def<ReceiptsP>('receipts', (p, c) => {
  const t = B0(c), cw = (CW - 24) / 2, rt = (i: number) => t + .45 + i * .45, ts = t + 1.9;
  return {
    html: blk(`${head(c, t, p.eyebrow, p.title, 88)}
      <div class="rcs gh" data-col="LR">${p.slips.map((r, i) => `
        <div class="rc" style="width:${cw}px" data-col="${i ? 'R' : 'L'}" ${A('rise', rt(i), .7)}>
          <div class="rh">${esc(UP(fill(r.head, c.f)))}</div>
          ${r.lines.map(([a, b]) => `<div class="rl"><span>${H(c, a)}</span><span class="num" data-rx="rc${c.k}${i}">${H(c, b)}</span></div>`).join('')}
          <div class="rt"><span>ΣΥΝΟΛΟ</span><b class="num" data-rx="rc${c.k}${i}">${esc(F(c, r.total).text)}</b></div>
        </div>`).join('')}</div>
      <div class="rsum card" data-hero style="margin-top:32px" data-col="LR" ${A('up', ts, .5)} id="rsum${c.k}">
        <span>${H(c, p.sumLabel)}</span>
        <div class="rsv">${p.wrong ? `<b class="wr num" ${A('strike', ts + .9, .4)}>${esc(F(c, p.wrong).text)}</b>` : ''}<b class="num acc-g" id="rsv${c.k}" ${A('slam', ts + .35, .55)}>${esc(F(c, p.sum).text)}</b></div>
      </div>
      ${p.wrongLabel ? `<div class="srcl" style="margin-top:24px;font-size:30px;line-height:40px" data-col="L" ${A('fade', ts + 1.1, .5)}>${H(c, p.wrongLabel)}</div>` : ''}`),
    css: `
      .rcs{display:flex;justify-content:space-between}
      .rc{position:relative;padding:36px 32px 28px;color:${K.paperInk};font-family:'Roboto Mono',monospace;
        background:linear-gradient(180deg,${K.paper},${K.paper} 70%,${K.paper});filter:drop-shadow(0 30px 40px ${K.ground}73);
        -webkit-mask:linear-gradient(${K.ground},${K.ground}) 0 8px/100% calc(100% - 16px) no-repeat,conic-gradient(from 135deg at 50% 0,${K.ground} 90deg,#0000 0) top/16px 8px repeat-x,conic-gradient(from -45deg at 50% 100%,${K.ground} 90deg,#0000 0) bottom/16px 8px repeat-x}
      .rh{font-size:32px;line-height:40px;font-weight:700;letter-spacing:.04em;padding-bottom:16px;border-bottom:2px dashed ${K.paperInk}66;white-space:nowrap}
      .rl{display:flex;justify-content:space-between;font-size:34px;line-height:44px;margin-top:20px;white-space:nowrap}
      .rt{display:flex;justify-content:space-between;align-items:baseline;margin-top:24px;padding-top:16px;border-top:3px double ${K.paperInk}8c;font-size:28px;font-weight:700;letter-spacing:.06em}
      .rt b{font-size:80px;line-height:88px;letter-spacing:-.02em;font-family:Inter}
      .rsum{display:flex;justify-content:space-between;align-items:center}
      .rsum>span{font-size:38px;line-height:46px;font-weight:700;max-width:240px}
      .rsv{display:flex;align-items:center;gap:24px}
      .rsv b{font-size:160px;line-height:150px;font-weight:900;letter-spacing:-.05em}
      .rsv .wr{position:relative;font-size:68px;line-height:76px;color:${K.faint}}
      .rsv .wr::after{content:'';position:absolute;left:-6px;right:-6px;top:50%;height:7px;border-radius:4px;background:${SEG.tax};transform-origin:0 50%;transform:scaleX(var(--k,0))}`,
    hits: [ts + .45, ...p.slips.map((_, i) => rt(i) + .45)],
    sfx: m => { p.slips.forEach((_, i) => { m.whoosh(rt(i), .45, .05, true); m.click(rt(i) + .45, 600, .1); }); m.boom(ts + .45, .3); m.bell(ts + .5, note('A5'), .04); if (p.wrong) m.sweep(ts + .9, .35, 1600, 600, .012); },
  };
});

// ═══ 13 · Η Νόα απαντά ═════════════════════════════════════════════════
// Η Νόα παίρνει άρθρο («Ρώτα τη Νόα»), δεν λέγεται ποτέ «βοηθός» ούτε «δωρεάν»
// (lib/assistant/identity.ts). Η κάρτα της δοκιμής είναι λέξη προς λέξη του
// billingWords: καμία άλλη δήλωση για τιμή εδώ.
export interface NoaP extends Base { eyebrow: Txt; title: Txt[]; question: Txt; answer: Txt; trial: string }
export const noaChat = def<NoaP>('noaChat', (p, c) => {
  const t = B0(c), q = fillPlain(p.question, c.f), a = fillPlain(p.answer, c.f);
  const tq = t + .8, ty = tq + q.length / 40 + .2, ta = ty + .7;
  return {
    html: blk(`${head(c, t, p.eyebrow, p.title, 80)}
      <div class="phw gh" style="height:900px"><div class="ph nc" data-hero data-ccol ${A('rise', t + .1, .8)}><div class="scr">
        <div class="isl"></div>
        <div class="chh"><span class="av">${esc(ASSISTANT_INITIAL)}</span><b>${esc(ASSISTANT_NAME)}</b><span class="pill dim" style="margin-left:auto">ΠΑΡΑΔΕΙΓΜΑ</span></div>
        <div class="ask" ${A('pop', tq - .1, .45)}>${tw(q, tq, 40)}</div>
        <div class="answ"><div class="typing" ${A('fade', ty, .35, 'out', ta - .05, .2)}><b></b><b></b><b></b></div><div class="ansb" ${A('up', ta, .4)}>${tw(a, ta + .1, 52)}</div></div>
        <div class="trialp" ${A('up', ta + a.length / 52 + .4, .5)}>${H(c, p.trial)}</div>
      </div></div></div>`),
    css: `
      .phw{position:relative}
      .ph.nc{position:absolute;left:${(CW - 760) / 2}px;width:760px;top:0;height:1010px;border-radius:84px;padding:16px;background:linear-gradient(145deg,${K.rule},${K.panel} 38%,${K.rule});
        box-shadow:0 80px 140px ${K.ground}b2,inset 0 0 0 2px ${K.ink}17;-webkit-mask-image:linear-gradient(180deg,${K.ground} 88%,transparent 99%)}
      .ph.nc .scr{position:relative;height:100%;border-radius:70px;overflow:hidden;padding:96px 32px 0;background:linear-gradient(180deg,${C.lift},${C.panel});display:flex;flex-direction:column;gap:28px}
      .ph.nc .isl{position:absolute;left:50%;top:22px;width:160px;height:44px;margin-left:-80px;border-radius:24px;background:${K.ground}}
      .chh{display:flex;align-items:center;gap:16px;padding-bottom:16px;border-bottom:1.5px solid ${C.rule}}
      .chh .av{width:68px;height:68px;border-radius:26%;display:grid;place-items:center;background:${C.accent};color:${C.onAccent};font-weight:850;font-size:36px}
      .chh b{font-size:36px;font-weight:800}
      .ask{align-self:flex-end;max-width:88%;padding:22px 30px;border-radius:32px 32px 8px 32px;background:${C.accent};color:${C.onAccent};font-size:40px;line-height:50px;font-weight:650}
      .answ{position:relative;align-self:flex-start;max-width:96%;min-height:88px}
      .ansb{padding:24px 30px;border-radius:32px 32px 32px 8px;background:${K.panel};border:1.5px solid ${C.rule};font-size:40px;line-height:54px;color:${C.ink}}
      .typing{position:absolute;left:0;top:0;display:flex;gap:10px;padding:30px 28px;border-radius:30px 30px 30px 8px;background:${K.panel};border:1.5px solid ${C.rule}}
      .typing b{width:14px;height:14px;border-radius:50%;background:${C.faint};display:block}
      .trialp{padding:20px 26px;border-radius:24px;background:${C.accent}14;border:1.5px solid ${C.accent}44;font-size:30px;line-height:40px;color:${C.muted}}`,
    hits: [ta],
    sfx: m => { for (let k = 0; k < Math.min(q.length, 40); k++) m.click(tq + k / 40, 2600, .04, .2); m.pluck(ta, note('A5'), .05, -.3); for (let k = 0; k < Math.min(a.length, 90); k += 3) m.click(ta + .1 + k / 52, 2300, .028, -.2); },
  };
});

// ═══ 14 · Κάρτα τέλους, που δένει με την αρχή ════════════════════════════
export interface EndP extends Base { title: Txt[]; path: string; action: Txt }
export const endCard = def<EndP>('endCard', (p, c) => {
  const t = B0(c);
  const hs = Math.min(104, ...p.title.map(l => fit(fillPlain(l, c.f), 104, CW, -.035))), us = Math.min(42, Math.floor((CW - 120) / ((`properwise.gr${p.path}`).length * .56)));
  return {
    html: blk(`<div class="ec" data-ccol ${A('pop', t + .05, .6)}>${mark(240, C.ink)}</div>
      <div class="hd" style="font-size:${hs}px;margin-top:56px" data-col="LR" data-hend>${p.title.map((l, k) => mk(kick(H(c, l), t + .8 + k * .1), A('mask', t + .3 + k * .1, .6))).join('')}</div>
      <div class="row gh" data-hero data-col="LR" ${A('up', t + .8, .5)}><span class="url" data-icon style="font-size:${us}px"><span class="li">${glyph(ICON.link, c.s.accent, 38, 2.2)}</span><span>properwise.gr<em>${esc(p.path)}</em></span></span></div>
      <div class="sub2" style="margin-top:32px;font-size:44px;line-height:56px" data-col="L" ${A('up', t + 1.1, .5)}>${H(c, p.action)}</div>
      <div class="ctas" style="margin-top:48px" data-col="L" ${A('up', t + 1.4, .5)}><span class="cta">${glyph(ICON.save, K.ink, 38, 2)}Αποθήκευσέ το</span><span class="cta">${glyph(ICON.send, K.ink, 38, 2)}Στείλ' το</span></div>`, 'ecb'),
    css: `
      .ec{display:flex;justify-content:center;width:${CW}px}
      .url{display:inline-flex;align-items:center;gap:14px;height:96px;padding:0 36px 0 28px;border-radius:999px;background:${c.s.accent}1f;border:2px solid ${c.s.accent}88;font-weight:700;color:${C.ink};white-space:nowrap}
      .url em{font-style:normal;color:${c.s.accent}}
      .url .li{display:flex;align-items:center}
      .ctas{display:flex;gap:16px}
      .cta{display:inline-flex;align-items:center;gap:14px;height:88px;padding:0 34px 0 28px;border-radius:999px;font-size:36px;font-weight:700;background:${K.accent}24;border:1.5px solid ${K.accent}73}`,
    sfx: m => { m.boom(t + .05, .25); ['A4', 'C5', 'E5', 'A5'].forEach((x, k) => m.pluck(t + .3 + k * .22, note(x), .05, k % 2 ? .3 : -.3)); m.bell(t + 1.4, note('E5'), .05); },
  };
});

// ═══ 15 · Χάρτης: πόλεις με καρφίτσες, χωρίς πλακίδια χάρτη ═══════════════
// Οι πόλεις μπαίνουν από γεωγραφικό πλάτος και μήκος σε ισορθογώνια προβολή,
// πάνω σε πλέγμα κουκκίδων: κανένα πλακίδιο από το διαδίκτυο, καμία ακτογραμμή
// που θα έπρεπε να σχεδιαστεί με το χέρι.
export const CITY: Record<string, [number, number]> = {
  'Αθήνα': [37.98, 23.73], 'Θεσσαλονίκη': [40.64, 22.94], 'Πάτρα': [38.25, 21.73], 'Ηράκλειο': [35.34, 25.13], 'Χανιά': [35.51, 24.02],
  'Ρόδος': [36.43, 28.22], 'Μύκονος': [37.45, 25.33], 'Σαντορίνη': [36.39, 25.46], 'Πάρος': [37.08, 25.15], 'Νάξος': [37.1, 25.38],
  'Ιωάννινα': [39.66, 20.85], 'Λάρισα': [39.64, 22.42], 'Βόλος': [39.36, 22.94], 'Καλαμάτα': [37.04, 22.11], 'Κέρκυρα': [39.62, 19.92],
  'Καβάλα': [40.94, 24.41], 'Αλεξανδρούπολη': [40.85, 25.87], 'Χαλκίδα': [38.46, 23.6],
};
export interface MapP extends Base { eyebrow: Txt; title: Txt[]; pins: { city: string; tag?: Txt; hot?: boolean }[]; caption: Txt }
export const mapPins = def<MapP>('mapPins', (p, c) => {
  const t = B0(c), Wm = CW - 2 * CARD_PAD.x - 4, Hm = 640, lat0 = 34.6, lat1 = 41.9, lon0 = 19.4, lon1 = 28.6;
  const k = Math.cos(38.5 * Math.PI / 180), sx = Wm / ((lon1 - lon0) * k), sy = Hm / (lat1 - lat0), sc = Math.min(sx, sy);
  const xy = ([la, lo]: [number, number]) => [(lo - lon0) * k * sc + (Wm - (lon1 - lon0) * k * sc) / 2, (lat1 - la) * sc];
  // Ετικέτες χωρίς επικαλύψεις: δεξιά, αριστερά, πάνω ή κάτω από την καρφίτσα, η πρώτη θέση που χωρά.
  const P = p.pins.map(x => { const g = CITY[x.city]; if (!g) throw new Error(`Άγνωστη πόλη στον χάρτη: ${x.city}`); const [px, py] = xy(g); return { ...x, px, py }; });
  type Box = { l: number; t: number; r: number; b: number };
  const taken: Box[] = P.map(q => ({ l: q.px - 18, t: q.py - 18, r: q.px + 18, b: q.py + 18 }));
  const hit = (a: Box) => a.l < 4 || a.t < 4 || a.r > Wm - 4 || a.b > Hm - 4 || taken.some(b => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t);
  const pins = P.map((x, i) => {
    const tag = x.tag ? fillPlain(x.tag, c.f) : '';
    const w = Math.max([...x.city].length * 17, [...tag].length * 14) + 8, h = tag ? 70 : 38, ti = t + .9 + i * .22;
    const cand: [string, Box][] = [
      ['r', { l: x.px + 26, t: x.py - 20, r: x.px + 26 + w, b: x.py - 20 + h }],
      ['l', { l: x.px - 26 - w, t: x.py - 20, r: x.px - 26, b: x.py - 20 + h }],
      ['a', { l: x.px - w / 2, t: x.py - 26 - h, r: x.px + w / 2, b: x.py - 26 }],
      ['b', { l: x.px - w / 2, t: x.py + 26, r: x.px + w / 2, b: x.py + 26 + h }],
    ];
    const [side, box] = cand.find(([, b]) => !hit(b)) ?? cand[0];
    taken.push(box);
    return `<div class="pn${x.hot ? ' hot' : ''}" style="left:${x.px}px;top:${x.py}px"><i class="pd" ${A('pop', ti, .5)}></i><i class="pp" data-pulse="${ti + .2},3"></i></div>
      <span class="pl ${side}" style="left:${box.l}px;top:${box.t}px;width:${box.r - box.l}px" ${A('fade', ti + .1, .4)}><b>${esc(x.city)}</b>${tag ? `<em>${esc(tag)}</em>` : ''}</span>`;
  }).join('');
  // Οι υπόλοιπες πόλεις ως αχνές κουκκίδες: δίνουν το σχήμα της χώρας χωρίς χάρτη.
  const ghost = Object.entries(CITY).filter(([k]) => !p.pins.some(x => x.city === k)).map(([, g]) => { const [gx, gy] = xy(g); return `<i class="gc" style="left:${gx}px;top:${gy}px"></i>`; }).join('');
  const grid = Array.from({ length: 15 * 20 }, (_, i) => `<i style="left:${12 + (i % 20) * ((Wm - 24) / 19)}px;top:${12 + Math.floor(i / 20) * ((Hm - 24) / 14)}px"></i>`).join('');
  return {
    html: blk(`${head(c, t, p.eyebrow, p.title, 88)}
      <div class="map card gh" data-hero data-col="LR" ${A('up', t + .3, .6)} style="height:${Hm + 2 * CARD_PAD.y}px"><div class="mg" ${A('fade', t + .5, .8)}>${grid}${ghost}</div><div class="mpins">${pins}</div></div>
      <div class="sub2" style="margin-top:24px" data-col="L" ${A('up', t + 2.4, .5)}>${H(c, p.caption)}</div>`),
    css: `
      .map{position:relative;overflow:hidden}
      .mg,.mpins{position:absolute;left:${CARD_PAD.x}px;top:${CARD_PAD.y}px;width:${Wm}px;height:${Hm}px}
      .mg i{position:absolute;width:4px;height:4px;margin:-2px;border-radius:50%;background:${K.ink}26}
      .pn{position:absolute}
      .pd{position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;background:${c.s.accent};box-shadow:0 0 0 6px ${c.s.accent}33,0 0 30px ${c.s.accent}}
      .pn.hot .pd{background:${SEG.tax};box-shadow:0 0 0 6px ${SEG.tax}33,0 0 30px ${SEG.tax}}
      .pp{position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;border:3px solid ${c.s.accent};opacity:0}
      .mg .gc{width:10px;height:10px;margin:-5px;background:${K.ink}40}
      .pl{position:absolute;display:flex;flex-direction:column;white-space:nowrap}
      .pl.l{align-items:flex-end}.pl.a,.pl.b{align-items:center}
      .pl b{font-size:30px;line-height:36px;font-weight:750}
      .pl em{font-style:normal;font-size:26px;line-height:32px;color:${K.muted}}`,
    sfx: m => p.pins.forEach((_, i) => m.pluck(t + .9 + i * .22, note('A5') + [0, 3, 7, 10, 12, 15][i % 6], .035, (i % 2 ? .3 : -.3))),
  };
});

// ═══ ΟΙ ΣΚΗΝΕΣ ΤΟΥ reelKathara, ΓΕΝΙΚΕΥΜΕΝΕΣ ════════════════════════════
// Μπάρα που σπάει σε κομμάτια (το αγκίστρι του Kathara), εκατό τετράγωνα,
// καταρράκτης, πλάκα που κόβεται σε ζώνες και κάρτα υπολογιστή: ίδια γεωμετρία,
// τιμές και ετικέτες από παραμέτρους.
export interface Part { label: Txt; value: string; color: string }
export interface HookBarP extends Base { eyebrow: Txt; title: Txt[]; parts: Part[]; question: Txt }
export const hookBar = def<HookBarP>('hookBar', (p, c) => {
  const t = B0(c), vals = p.parts.map(x => Number(F(c, x.value).value)), sum = vals.reduce((a, b) => a + b, 0), G = 8, Wb = CW - G * (p.parts.length - 1);
  return {
    html: blk(`${head(c, t, p.eyebrow, p.title, 88)}
      <div class="hbar gh" data-hero data-col="LR">${p.parts.map((x, i) => `<div class="hs" style="width:${Wb * vals[i] / sum}px"><i ${A('growy', t + .5 + i * .25, .5)} style="background:${x.color}"></i></div>`).join('')}</div>
      <div class="hlg" style="margin-top:32px" data-col="LR">${p.parts.map((x, i) => `<div ${A('up', t + .8 + i * .25, .45)}><i style="background:${x.color}"></i><span class="lb">${H(c, x.label)}</span><b class="num" style="color:${x.color}">${esc(F(c, x.value).text)}</b></div>`).join('')}</div>
      <div class="hd" style="font-size:72px;margin-top:48px" data-col="L">${mk(kick(H(c, p.question), t + 2.5), A('mask', t + 2, .6))}</div>`),
    css: `
      .hbar{display:flex;gap:${G}px;height:360px;align-items:stretch}
      .hs{position:relative}
      .hs i{position:absolute;inset:0;border-radius:20px;transform-origin:50% 100%;box-shadow:inset 0 1px 0 ${K.ink}40}
      /* Το υπόμνημα σε δύο στήλες: τα στενά κομμάτια δεν χωρούν ετικέτα από κάτω τους. */
      .hlg{display:grid;grid-template-columns:1fr 1fr;gap:20px 40px}
      .hlg div{display:flex;align-items:center;gap:14px}
      .hlg i{flex:none;width:28px;height:28px;border-radius:8px}
      .hlg b{margin-left:auto;font-size:40px;font-weight:850;letter-spacing:-.02em;white-space:nowrap}`,
    sfx: m => p.parts.forEach((_, i) => m.click(t + .5 + i * .25, 1500 - i * 200, .07)),
  };
});

export interface GridP extends Base { eyebrow: Txt; title: Txt[]; counts: { n: string; color: string; label: Txt }[] }
export const tileGrid = def<GridP>('tileGrid', (p, c) => {
  const t = B0(c), ns = p.counts.map(x => Number(F(c, x.n).value));
  if (ns.reduce((a, b) => a + b, 0) !== 100) throw new Error('Τα εκατό τετράγωνα δεν αθροίζουν σε εκατό.');
  const kind = (i: number) => { let a = 0; for (let k = 0; k < ns.length; k++) { a += ns[k]; if (i < a) return k; } return ns.length - 1; };
  return {
    html: blk(`${head(c, t, p.eyebrow, p.title, 88)}
      <div class="tgw gh" data-hero data-col="L"><div class="tg">${Array.from({ length: 100 }, (_, i) => `<i style="background:${p.counts[kind(i)].color}" ${A('pop', t + .5 + (Math.floor(i / 10) + i % 10) * .03, .4)}></i>`).join('')}</div>
        <div class="tlg">${p.counts.map((x, i) => `<div ${A('right', t + 1.4 + i * .3, .4)}><i style="background:${x.color}"></i><span class="tv"><b class="num">${esc(F(c, x.n).text)}</b><span class="lb">${H(c, x.label)}</span></span></div>`).join('')}</div></div>`),
    css: `
      .tgw{display:flex;gap:32px;align-items:center}
      .tg{display:grid;grid-template-columns:repeat(10,58px);gap:6px}
      .tg i{width:58px;height:58px;border-radius:14px}
      .tlg{display:flex;flex-direction:column;gap:32px}
      .tlg .tv{display:flex;flex-direction:column}
      .tlg .lb{font-size:28px;line-height:32px}
      .tlg div{display:flex;align-items:center;gap:14px}
      .tlg i{width:28px;height:28px;border-radius:8px}
      .tlg b{font-size:48px;line-height:56px;font-weight:850}`,
  };
});

export interface WaterfallP extends Base { eyebrow: Txt; title: Txt[]; start: { label: Txt; value: string }; steps: { label: Txt; value: string; color: string }[]; end: { label: Txt; value: string } }
export const waterfall = def<WaterfallP>('waterfall', (p, c) => {
  const t = B0(c), top = Number(F(c, p.start.value).value), Hb = 560, nB = p.steps.length + 2, cw = 112, IN = 48, pitch = (CW - 2 * IN - cw) / (nB - 1);
  let lvl = top;
  const bars = [{ lo: 0, hi: top, c: K.faint, l: p.start.label, v: p.start.value }];
  for (const s of p.steps) { const v = Number(F(c, s.value).value); bars.push({ lo: lvl - v, hi: lvl, c: s.color, l: s.label, v: s.value }); lvl -= v; }
  if (Math.abs(lvl - Number(F(c, p.end.value).value)) > .01) throw new Error('Ο καταρράκτης δεν καταλήγει στο τέλος του.');
  bars.push({ lo: 0, hi: lvl, c: C.accent, l: p.end.label, v: p.end.value });
  const y = (v: number) => 56 + Hb * (1 - v / top);
  return {
    html: blk(`${head(c, t, p.eyebrow, p.title, 88)}
      <div class="wf gh" data-hero style="height:${56 + Hb + 56}px">${bars.map((b, i) => `
        <i class="wb" style="left:${IN + i * pitch}px;top:${y(b.hi)}px;width:${cw}px;height:${y(b.lo) - y(b.hi)}px;background:${b.c}" ${A(i === 0 || i === nB - 1 ? 'growy' : 'down', t + .5 + i * .45, .55)}></i>
        <span class="wv num" data-cx="wbx${c.k}${i}" style="left:${IN + i * pitch + cw / 2}px;top:${y(b.hi) - 48}px" ${A('fade', t + .7 + i * .45, .4)}>${esc(F(c, b.v).text)}</span>
        <span class="wk" style="left:${IN + i * pitch + cw / 2}px;top:${56 + Hb + 16}px">${H(c, b.l)}</span><i id="wbx${c.k}${i}" style="position:absolute;left:${IN + i * pitch}px;width:${cw}px;top:0;height:1px"></i>`).join('')}
        <i class="wbase" style="top:${56 + Hb}px" data-col="LR"></i></div>`),
    css: `
      .wf{position:relative}
      .wf>*{position:absolute}
      .wb{display:block;border-radius:12px;transform-origin:50% 100%;box-shadow:inset 0 1px 0 ${K.ink}4c}
      .wv{transform:translateX(-50%);font-size:30px;line-height:40px;font-weight:800;white-space:nowrap}
      .wk{transform:translateX(-50%);font-size:26px;line-height:32px;font-weight:600;color:${K.muted};white-space:nowrap}
      .wbase{left:0;right:0;height:2px;background:${K.muted}59}`,
  };
});

export interface SlabP extends Base { eyebrow: Txt; title: Txt[]; unit: string; parts: Part[] }
export const slab = def<SlabP>('slab', (p, c) => {
  const t = B0(c), vals = p.parts.map(x => Number(F(c, x.value).value)), sum = vals.reduce((a, b) => a + b, 0), Hs = 600, G = 10;
  let off = 0;
  return {
    html: blk(`${head(c, t, p.eyebrow, p.title, 88)}
      <div class="slw gh" data-hero style="height:${Hs + G * (p.parts.length - 1)}px">${p.parts.map((x, i) => {
        const h = Hs * vals[i] / sum, y = off + i * G; off += h;
        return `<i class="band" style="top:${y}px;height:${h}px;background:${x.color}" ${A('right', t + .6 + i * .2, .5)}></i>
          <div class="sll" style="top:${y + h / 2 - 28}px" ${A('right', t + .9 + i * .2, .4)}><span>${H(c, x.label)}</span><b class="num" style="color:${x.color}">${esc(F(c, x.value).text)}</b></div>`;
      }).join('')}<div class="eng" ${A('fade', t + .3, .4, 'out', t + .6, .3)}>${esc(F(c, p.unit).text)}</div></div>`),
    css: `
      .slw{position:relative}
      .slw .band{position:absolute;left:0;width:300px;border-radius:12px;box-shadow:inset 0 1px 0 ${K.ink}47}
      .sll{position:absolute;left:340px;right:0;display:flex;justify-content:space-between;align-items:center;height:56px}
      .sll span{font-size:30px;font-weight:600;color:${K.muted}}
      .sll b{font-size:44px;font-weight:850}
      .eng{position:absolute;left:0;width:300px;top:${Hs / 2 - 64}px;text-align:center;font-size:112px;font-weight:850}`,
  };
});

export interface CalcP extends Base { eyebrow: Txt; title: Txt[]; name: Txt; fields: { label: Txt; value: string }[]; result: { label: Txt; value: string }; path: string }
export const calcCard = def<CalcP>('calcCard', (p, c) => {
  const t = B0(c);
  return {
    html: blk(`${head(c, t, p.eyebrow, p.title, 88)}
      <div class="card calc gh" data-hero data-col="LR" ${A('up', t + .35, .6)}>
        <div class="ch"><span class="ci">${glyph(ICON.calc, K.ink, 28, 1.8)}</span><b>${H(c, p.name)}</b></div>
        <div class="cf">${p.fields.map((x, i) => `<div class="fld"><span class="lb">${H(c, x.label)}</span><div class="in">${tw(F(c, x.value).text, t + .9 + i * .4, 18)}</div></div>`).join('')}</div>
        <div class="cr"><span>${H(c, p.result.label)}</span><b class="num acc-g" ${A('slam', t + .9 + p.fields.length * .4 + .3, .5)}>${esc(F(c, p.result.value).text)}</b></div>
      </div>
      <div class="row" style="margin-top:24px" data-col="LR" ${A('up', t + 2.6, .5)}><span class="url" data-icon><span class="li">${glyph(ICON.link, c.s.accent, 30, 2.2)}</span><span>properwise.gr<em>${esc(p.path)}</em></span></span></div>`),
    css: `
            .calc .ch{display:flex;align-items:center;gap:16px;height:48px}
      .calc .ci{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:${K.accent}24;border:1px solid ${K.accent}4c}
      .calc .ch b{font-size:34px;font-weight:750}
      .calc .cf{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px}
      .calc .in{display:flex;align-items:center;height:80px;margin-top:8px;padding:0 20px;border-radius:12px;background:${K.ground}8c;border:1.5px solid ${C.rule};font-size:38px;font-weight:650}
      .calc .cr{display:flex;justify-content:space-between;align-items:center;margin-top:28px;padding-top:20px;border-top:1px solid ${K.ink}1a}
      .calc .cr span{font-size:34px;font-weight:650}
      .calc .cr b{font-size:64px;font-weight:850}
      .url{display:inline-flex;align-items:center;gap:12px;height:64px;padding:0 24px 0 18px;border-radius:999px;background:${c.s.accent}1f;border:2px solid ${c.s.accent}88;font-size:30px;font-weight:700;white-space:nowrap}
      .url em{font-style:normal;color:${c.s.accent}}
      .url .li{display:flex;align-items:center}`,
  };
});

/** Ένα εσωτερικό περιθώριο για ΚΑΘΕ κάρτα (ο έλεγχος στοίχισης το μετρά). */
export const CARD_PAD = { y: 32, x: 40 } as const;

// ═══ Το κοινό CSS των σκηνών ═════════════════════════════════════════════
export const SCENE_CSS = (s: Series) => `
  .eb{display:flex;align-items:center;gap:18px;font-size:26px;line-height:32px;letter-spacing:.12em;color:${s.accent};font-weight:600}
  .eb i{display:block;width:44px;height:3px;border-radius:2px;background:${s.accent}}
  .hd{font-weight:800;letter-spacing:-.035em;line-height:1.02;white-space:nowrap}
  .hd .a,.acc-g{background-image:linear-gradient(100deg,${s.accent} 0%,${K.ink} 45%,${s.accent} 60%,${K.ink} 100%);background-size:220% 100%;background-position:30% 0;-webkit-background-clip:text;background-clip:text;color:transparent}
  .acc-g{text-shadow:none;filter:drop-shadow(0 18px 60px ${s.accent}55)}
  .neg{color:${SEG.tax}}.ok{color:${C.ok}}.acc{color:${s.accent}}
  .num{font-variant-numeric:tabular-nums}
  .eu{margin-left:.13em;letter-spacing:0;font-size:.74em}
  .mk{overflow:hidden;padding:.12em 0 .24em;margin:-.12em 0 -.24em}
  .kw{display:inline-block;transform-origin:50% 85%}
  .kwd{font-weight:900}
  .mi{will-change:transform}
  .sub2{font-size:40px;line-height:52px;font-weight:500;letter-spacing:-.015em;color:${K.muted};text-wrap:pretty;width:${CW}px}
  .sub2 b,.sub2 .a{color:${C.ink};font-weight:750}
  .sub2 .a{color:${s.accent}}
  .lb{font-size:26px;line-height:32px;font-weight:600;color:${K.muted};white-space:nowrap;letter-spacing:.02em}
  .srcl{font-family:'Roboto Mono',monospace;font-size:26px;line-height:34px;color:${K.muted};letter-spacing:.02em}
  .tagl{font-size:40px;line-height:48px;font-weight:700;color:${C.ink}}
  .card{position:relative;padding:${CARD_PAD.y}px ${CARD_PAD.x}px;border-radius:28px;background:linear-gradient(180deg,${K.lift}f5,${K.panel}f7);border:1.5px solid ${K.ink}1f;box-shadow:0 50px 110px -30px ${K.ground}bf,inset 0 1px 0 ${K.ink}1a}
  .pill{display:inline-flex;align-items:center;gap:10px;height:52px;padding:0 22px;border-radius:999px;font-size:26px;line-height:32px;font-weight:750;letter-spacing:.06em;white-space:nowrap}
  .pill.big{height:64px;font-size:32px;padding:0 26px}
  .pill.neg{color:${SEG.tax};background:${SEG.tax}22;border:1.5px solid ${SEG.tax}55}
  .pill.ok{color:${C.ok};background:${C.ok}1f;border:1.5px solid ${C.ok}55}
  .pill.acc{color:${s.accent};background:${s.accent}1f;border:1.5px solid ${s.accent}66}
  .pill.dim{color:${K.muted};background:${K.ink}10;border:1.5px solid ${K.ink}26}
  .chipl{display:inline-flex;align-items:center;gap:14px;height:72px;padding:0 28px 0 22px;border-radius:999px;background:${s.accent}1a;border:2px solid ${s.accent}66;font-size:36px;font-weight:700}
  .tw.on::after{content:'';display:inline-block;width:.08em;height:1em;margin-left:.06em;background:currentColor;vertical-align:-.14em}`;
