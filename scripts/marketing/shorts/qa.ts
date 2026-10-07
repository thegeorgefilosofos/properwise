// ═══════════════════════════════════════════════════════════════════════════
// SHORTS · ΟΙ ΕΛΕΓΧΟΙ ΠΟΥ ΣΤΑΜΑΤΟΥΝ ΤΗΝ ΠΑΡΑΓΩΓΗ
// ─────────────────────────────────────────────────────────────────────────
// Κάθε έλεγχος επιστρέφει γραμμές σφαλμάτων. Ένα σφάλμα σε οποιονδήποτε και το
// βίντεο δεν βγαίνει. Δύο είδη:
//
//   ΧΩΡΙΣ ΠΕΡΙΗΓΗΤΗ (πριν από οτιδήποτε άλλο, σε χιλιοστά του δευτερολέπτου)
//     gateDigits      κανένα ψηφίο στην προδιαγραφή έξω από `{γεγονός}`, εκτός ημερομηνιών
//     gateCopy        ελληνικά: εσύ, όχι κόμμα πριν από «και», € κολλητό, κεφαλαία
//                     χωρίς τόνους, η Νόα με άρθρο και ποτέ «βοηθός» ή «δωρεάν»
//     gateLengths     λεζάντες, τίτλοι, ετικέτες ανά πλατφόρμα
//     gateStory       διάρκεια ≥ 45″, 6–9 σκηνές, ≥ 5 διαφορετικά περάσματα, τόξο
//                     ιστορίας με τη σειρά του, ο αριθμός πριν από το 70%
//     gateDeadAir     οπτική αλλαγή κάθε 1,5–2,5″ (καμία παύση πάνω από 2,5″)
//
//   ΜΕ ΠΕΡΙΗΓΗΤΗ (στη σελίδα που θα φωτογραφηθεί)
//     gateLayout      ο έλεγχος στοίχισης του reelKathara, γενικευμένος: ακμές,
//                     κοινές ακμές, ίσα κενά, κέντρα, ξεχείλισμα, κενό τίτλου
//     gateSafe        ζώνες YouTube / Instagram / TikTok σε κάθε δευτερόλεπτο
//     gateType        κανένα γράμμα κάτω από 26px, αντίθεση ≥ 4,5 (≥ 3 από 32px)
//     gateClip        κανένα κείμενο κομμένο από γονέα με overflow
//     gateTrace       κάθε ψηφίο στην οθόνη βγήκε από γεγονός
//     gateLegibility  κανένα πέρασμα με πάνω από 2 καρέ χωρίς ευανάγνωστο κείμενο
//     gatePop         κανένα στοιχείο που «σκάει» (άλμα αδιαφάνειας > 0,7 σε ένα καρέ)
//
//   ΣΤΟ ΑΡΧΕΙΟ
//     gateLoop        το τελευταίο καρέ μοιάζει με το πρώτο (SSIM)
//     gateAudio       κορυφή ≤ −1 dBTP στο mp4
// ═══════════════════════════════════════════════════════════════════════════
import { spawnSync } from 'node:child_process';
import { fpRate } from '../../../lib/core/format';
import { COL, FPS, K, MIN_TEXT, SAFE, fill, plain, type Facts, type Fact } from './kit';
import { CARD_PAD } from './scenes';
import { ARC_ORDER, type Built, type ShortSpec } from './spec';
import type { Page } from './engine';
import { TRANSITIONS } from './transitions';

type Pg = import('playwright-core').Page;
export interface Gate { name: string; fails: string[]; info?: string }

// ═══ ΧΩΡΙΣ ΠΕΡΙΗΓΗΤΗ ═════════════════════════════════════════════════════
/** Κλειδιά που κρατούν ταυτότητα γεγονότος, διαδρομή ή ρύθμιση, όχι κείμενο. */
const NOT_TEXT = new Set(['id', 'date', 'slot', 'path', 'campaign', 'kind', 'in', 'target', 'from', 'to', 'at', 'shape', 'axis', 'dir',
  'before', 'after', 'total', 'sum', 'wrong', 'dayFact', 'rateFact', 'series', 'color', 'n', 'value', 'unit']);
const DATE_RE = /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g;
export function gateDigits(spec: ShortSpec): Gate {
  const fails: string[] = [];
  const walk = (v: unknown, path: string) => {
    if (typeof v === 'string') {
      const key = path.split('.').pop() ?? '';
      if (NOT_TEXT.has(key) || /Fact$/.test(key)) return;
      const bare = v.replace(/\{[a-zA-Z0-9_.]+\}/g, '').replace(DATE_RE, '');
      if (/\d/.test(bare)) fails.push(`${path}: ψηφίο με το χέρι στο «${v.slice(0, 60)}»`);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (typeof x !== 'function') walk(x, path ? `${path}.${k}` : k); }
  };
  const { facts: _f, hooks, scenes, ...rest } = spec;
  void _f;
  walk(rest, '');
  hooks.forEach((h, i) => { walk({ name: h.name, why: h.why, story: h.scene.story, cue: h.scene.cue }, `hooks[${i}]`); walk(h.scene.params, `hooks[${i}].params`); });
  scenes.forEach((s, i) => { walk({ story: s.story, cue: s.cue, inOpts: s.inOpts }, `scenes[${i}]`); walk(s.params, `scenes[${i}].params`); });
  return { name: 'Ψηφία μόνο από γεγονότα', fails };
}

/**
 * Οι κανόνες του ελληνικού κειμένου. Δουλεύουν σε κείμενο ΜΕ τα γεγονότα στη
 * θέση τους: ό,τι θα δει ο θεατής.
 */
export function copyFails(text: string, where: string): string[] {
  const out: string[] = [];
  const bad = (why: string, m: string) => out.push(`${where}: ${why}: «${m}»`);
  // Το \b της JavaScript ξέρει μόνο λατινικά: τα όρια λέξης γράφονται με κλάσεις Unicode.
  const word = (alts: string, flags = 'gu') => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts})(?![\\p{L}\\p{N}])`, flags);
  // Εσύ, όχι εσείς.
  for (const m of text.match(word('σας|εσείς|μπορείτε|έχετε|πληρώνετε|δείτε|κάντε|μάθετε|ελέγξτε|υπολογίστε|γράψτε|στείλτε|αποθηκεύστε|δοκιμάστε|ξέρετε|θέλετε|ρωτήστε|πατήστε|μπείτε|δηλώστε|κατεβάστε|ακολουθήστε', 'giu')) ?? []) bad('πληθυντικός ευγενείας', m);
  // Κανένα κόμμα πριν από «και» / «κι».
  for (const m of text.match(/,\s+(?:και|κι)(?![\p{L}])/gu) ?? []) bad('κόμμα πριν από «και»', m);
  // Το € κολλητά στον αριθμό, μετά από αυτόν.
  for (const m of text.match(/\d\s+€|€\s*\d/gu) ?? []) bad('€ χωριστά από τον αριθμό', m);
  // Κεφαλαία χωρίς τόνους: λέξη με δύο ή περισσότερα κεφαλαία και τόνο.
  for (const m of text.match(/(?<![\p{L}])[\p{Lu}]{2,}(?![\p{L}])/gu) ?? []) if (/[ΆΈΉΊΌΎΏ]/u.test(m)) bad('κεφαλαία με τόνο', m);
  // Η Νόα: με άρθρο, ποτέ βοηθός, ποτέ δωρεάν δίπλα της.
  for (const m of text.matchAll(/(?<![\p{L}])(\p{L}+[\s«»"]+)?(Νόα|ΝΟΑ)(?![\p{L}])/gu)) {
    const prev = (m[1] ?? '').replace(/[\s«»"]/gu, '');
    if (!/^(η|τη|την|της|στη|στην|Η|Τη|Την|Της|Στη|Στην|ΤΗ|ΤΗΝ|ΤΗΣ)$/u.test(prev)) bad('η Νόα χωρίς άρθρο', `${m[1] ?? ''}${m[2]}`);
  }
  for (const m of text.match(word('βοηθός|βοηθό|βοηθού|βοηθοί|βοηθούς|ΒΟΗΘΟΣ', 'giu')) ?? []) bad('η Νόα δεν λέγεται βοηθός', m);
  for (const s of text.split(/(?<=[.;!])\s+/u)) if (/Νόα/u.test(s) && /δωρεάν/iu.test(s)) bad('η Νόα δίπλα στο «δωρεάν»', s.slice(0, 60));
  return out;
}

/** Όλα τα κείμενα που θα δει ο θεατής, με τα γεγονότα στη θέση τους. */
export function visibleStrings(b: Built): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  const walk = (v: unknown, path: string) => {
    if (typeof v === 'string') {
      const key = path.split('.').pop() ?? '';
      if (NOT_TEXT.has(key) || /Fact$/.test(key) || key === 'trial') return;
      out.push({ where: path, text: plain(v, b.f) });
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (typeof x !== 'function') walk(x, `${path}.${k}`);
  };
  b.scenes.forEach((s, i) => { walk(s.params, `σκηνή ${i + 1}`); if (s.inOpts?.word) walk({ word: s.inOpts.word, sub: s.inOpts.sub }, `σκηνή ${i + 1}.πέρασμα`); });
  walk({ title: b.spec.title, hook: b.spec.hook, protagonist: b.spec.protagonist, note: b.spec.note, cta: b.spec.cta.label }, 'short');
  return out;
}

export function gateCopy(b: Built, texts: Record<string, string>): Gate {
  const fails = [
    ...visibleStrings(b).flatMap(x => copyFails(x.text, x.where)),
    ...Object.entries(texts).flatMap(([k, v]) => copyFails(v, k)),
  ];
  return { name: 'Ελληνικά (εσύ, κόμμα, €, κεφαλαία, Νόα)', fails };
}

/**
 * ΤΑ ΟΡΙΑ ΤΩΝ ΠΛΑΤΦΟΡΜΩΝ. Τα σκληρά όρια είναι των πλατφορμών· τα «ορατά» είναι
 * όσα φαίνονται πριν από το «περισσότερα» και τα κρατάμε για το πρώτο μήνυμα.
 *   YouTube: τίτλος ≤ 100 (ορατό ~70), περιγραφή ≤ 5000, ετικέτες ≤ 500 συνολικά.
 *   Instagram: λεζάντα ≤ 2200, ≤ 5 hashtags (όριο του 2025), εναλλακτικό ≤ 1000 (Facebook).
 *   TikTok: λεζάντα με hashtags ≤ 2200 (το παλιό, αυστηρότερο όριο).
 *   Καρφιτσωμένο σχόλιο: ≤ 500 για να χωρά σε κάθε πλατφόρμα.
 */
export const LIMITS = { ytTitle: 100, ytTitleVisible: 70, ytDesc: 5000, ytTags: 500, igCaption: 2200, igHashtags: 5, alt: 1000, ttCaption: 2200, pinned: 500, firstLine: 125 } as const;
export function gateLengths(t: { ytTitle: string; ytDesc: string; ytTags: string[]; igCaption: string; igTags: string[]; alt: string; ttCaption: string; pinned: string }): Gate {
  const fails: string[] = [];
  const chk = (name: string, s: string, max: number) => { if ([...s].length > max) fails.push(`${name}: ${[...s].length} χαρακτήρες (όριο ${max})`); };
  chk('YouTube τίτλος', t.ytTitle, LIMITS.ytTitle);
  chk('YouTube τίτλος, ορατό μέρος', t.ytTitle.replace(/\s*#Shorts$/, ''), LIMITS.ytTitleVisible);
  chk('YouTube περιγραφή', t.ytDesc, LIMITS.ytDesc);
  chk('YouTube ετικέτες', t.ytTags.join(','), LIMITS.ytTags);
  chk('Instagram λεζάντα', t.igCaption, LIMITS.igCaption);
  chk('Instagram πρώτη γραμμή', t.igCaption.split('\n')[0], LIMITS.firstLine);
  if (t.igTags.length > LIMITS.igHashtags) fails.push(`Instagram: ${t.igTags.length} hashtags (όριο ${LIMITS.igHashtags})`);
  chk('Εναλλακτικό κείμενο', t.alt, LIMITS.alt);
  chk('TikTok λεζάντα', t.ttCaption, LIMITS.ttCaption);
  chk('Καρφιτσωμένο σχόλιο', t.pinned, LIMITS.pinned);
  return { name: 'Μήκη ανά πλατφόρμα', fails };
}

export function gateStory(b: Built, pg: Page): Gate {
  const fails: string[] = [];
  const n = b.scenes.length;
  if (b.dur < 45) fails.push(`διάρκεια ${b.dur.toFixed(1)}″ (ελάχιστο 45″)`);
  if (b.dur > 90) fails.push(`διάρκεια ${b.dur.toFixed(1)}″ (πάνω από 90″)`);
  if (n < 6 || n > 9) fails.push(`${n} σκηνές (6–9)`);
  const kinds = new Set(pg.trs.map(x => x.name));
  if (kinds.size < 5) fails.push(`${kinds.size} διαφορετικά περάσματα (ελάχιστο 5)`);
  const arcs = b.scenes.map(s => s.arc);
  if (arcs[0] !== 'hook') fails.push('η πρώτη σκηνή δεν είναι αγκίστρι');
  if (arcs[n - 1] !== 'loop') fails.push('η τελευταία σκηνή δεν δένει με την αρχή');
  for (const a of ARC_ORDER) if (!arcs.includes(a)) fails.push(`λείπει το «${a}» από την ιστορία`);
  const idx = arcs.map(a => (a ? ARC_ORDER.indexOf(a) : -1));
  for (let i = 1; i < n; i++) if (idx[i] >= 0 && idx[i - 1] >= 0 && idx[i] < idx[i - 1] && !(arcs[i] === 'stakes' && arcs[i - 1] === 'turn')) fails.push(`το τόξο γυρίζει πίσω στη σκηνή ${i + 1} (από ${arcs[i - 1]} σε ${arcs[i]})`);
  const pk = arcs.indexOf('payoff');
  const pt = pk >= 0 ? Math.min(...(pg.outs[pk].hits ?? [b.at[pk] + 1])) : Infinity;
  if (pt > .7 * b.dur) fails.push(`ο αριθμός έρχεται στο ${fpRate(Math.round(100 * pt / b.dur))} (πριν από το ${fpRate(70)})`);
  if (b.spec.loop === false) fails.push('ο βρόχος είναι κλειστός');
  return { name: 'Ιστορία, διάρκεια, περάσματα', fails, info: `${b.dur.toFixed(1)}″ · ${n} σκηνές · ${kinds.size} περάσματα · ο αριθμός στο ${fpRate(Math.round(100 * pt / b.dur))}` };
}

/** Η ρουμπρίκα: τουλάχιστον αγκίστρι, αποκάλυψη, πρακτική αξία και ένα από σύγκρουση, κορύφωση ιστορίας, άποψη. */
export function gateRubric(b: Built): Gate {
  const fails: string[] = [], R = b.spec.rubric, have = new Set(R.signals.map(x => x.signal));
  for (const need of ['hook', 'revelation', 'practical'] as const) if (!have.has(need)) fails.push(`λείπει το σήμα «${need}»`);
  if (!['conflict', 'story', 'opinion'].some(x => have.has(x as never))) fails.push('λείπει σύγκρουση, κορύφωση ιστορίας ή άποψη');
  for (const x of R.signals) if (x.scene < 0 || x.scene >= b.scenes.length) fails.push(`σήμα «${x.signal}» σε σκηνή ${x.scene + 1} που δεν υπάρχει`);
  if (!R.signals.some(x => x.signal === 'hook' && x.scene === 0)) fails.push('το σήμα αγκιστριού δεν είναι στην πρώτη σκηνή');
  if (!(R.score >= 0 && R.score <= 100)) fails.push('ο βαθμός δεν είναι από 0 ως 100');
  return { name: 'Ρουμπρίκα viral (αυτοαξιολόγηση)', fails, info: `${[...have].join(', ')} · ${R.score}/100` };
}

/** Οι στιγμές που κάτι αλλάζει στην οθόνη, από τη σελίδα: κινήσεις, μετρητές, γραφή, χάραξη, περάσματα. */
export function events(html: string, pg: Page): number[] {
  const ts: number[] = [0];
  for (const m of html.matchAll(/data-a="([^"]+)"/g)) for (const x of m[1].split('|')) { const [, t0] = x.split(','); ts.push(+t0); }
  for (const m of html.matchAll(/data-(?:tw|draw|pulse|fill)="([\d.]+)/g)) ts.push(+m[1]);
  for (const m of html.matchAll(/data-seg='([^']+)'/g)) for (const s of JSON.parse(m[1]) as { a: number }[]) ts.push(s.a);
  for (const tr of pg.trs) ts.push(tr.B - tr.pre, tr.B);
  ts.push(...pg.hits);
  return ts.filter(t => Number.isFinite(t)).sort((a, b) => a - b);
}
export function gateDeadAir(b: Built, pg: Page): Gate {
  const ts = [...events(pg.html, pg), ...pg.shine.map(x => x.t)].filter(t => t >= 0 && t <= b.dur).sort((a, b2) => a - b2);
  ts.push(b.dur);
  const fails: string[] = [];
  let worst = 0;
  for (let i = 1; i < ts.length; i++) { const g = ts[i] - ts[i - 1]; worst = Math.max(worst, g); if (g > 2.5) fails.push(`καμία αλλαγή από ${ts[i - 1].toFixed(2)}″ ως ${ts[i].toFixed(2)}″ (${g.toFixed(2)}″)`); }
  return { name: 'Χωρίς νεκρό χρόνο (≤ 2,5″)', fails, info: `μεγαλύτερη παύση ${worst.toFixed(2)}″` };
}

// ═══ ΜΕ ΠΕΡΙΗΓΗΤΗ ════════════════════════════════════════════════════════
// Ως κείμενο: το tsx ντύνει τις ονομασμένες συναρτήσεις με βοηθό που ο περιηγητής δεν έχει.
const LAYOUT = (k: number) => `(() => {
  const F = ${JSON.stringify(COL)}, SB = ${SAFE.bottom}, LIFT = 24, root = document.getElementById('s${k}');
  const vis = el => { for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (Number(s.opacity) < .5 || s.display === 'none') return false; } return true; };
  const all = sel => Array.from(root.querySelectorAll(sel)).filter(vis);
  const rc = el => el.getBoundingClientRect();
  const name = el => (el.id || String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || el.tagName) + ' «' + (el.textContent || '').trim().slice(0, 18) + '»';
  const out = { n: 0, edge: 0, share: 0, gap: 0, cx: 0, rhythm: 0, icon: 0, fails: [], pads: [] };
  const bad = m => out.fails.push(m);
  const off8 = v => { const r = ((v % 8) + 8) % 8; return Math.min(r, 8 - r); };
  // 1 · Μία αριστερή και μία δεξιά ακμή για ΚΑΘΕ μπλοκ της στήλης (εκτός από όσα κεντράρονται).
  const blk = root.querySelector('.blk');
  const kids = blk ? Array.from(blk.children).filter(vis) : [];
  for (const el of kids) { const r = rc(el); out.n++;
    if (el.hasAttribute('data-ccol')) continue;
    const dl = Math.abs(r.left - F.L), dr = Math.abs(r.right - F.R); out.edge = Math.max(out.edge, dl, dr);
    if (dl > 1) bad('μπλοκ ' + name(el) + ': αριστερή ακμή ' + r.left.toFixed(1)); if (dr > 1) bad('μπλοκ ' + name(el) + ': δεξιά ακμή ' + r.right.toFixed(1)); }
  // 2 · Ρυθμός 8px: ύψος κάθε μπλοκ και απόσταση από το προηγούμενο, πολλαπλάσια του 8.
  kids.forEach((el, i) => { const r = rc(el), h = off8(r.height); out.rhythm = Math.max(out.rhythm, h); if (h > 1) bad('ρυθμός: ύψος ' + name(el) + ' ' + r.height.toFixed(1));
    if (i) { const g = r.top - rc(kids[i - 1]).bottom, e = off8(g); out.gap = Math.max(out.gap, e); if (e > 2) bad('ρυθμός: κενό πριν από ' + name(el) + ' ' + g.toFixed(1)); } });
  // 3 · Ό,τι έχει δηλωμένη ακμή μέσα στις κάρτες.
  for (const el of all('[data-col]')) {
    if (el.parentElement === blk) continue;
    const r = rc(el), c = el.dataset.col; out.n++;
    if (c.includes('L')) { const d = Math.abs(r.left - F.L); out.edge = Math.max(out.edge, d); if (d > 1) bad('αριστερή ακμή ' + name(el) + ' στο ' + r.left.toFixed(1)); }
    if (c.includes('R')) { const d = Math.abs(r.right - F.R); out.edge = Math.max(out.edge, d); if (d > 1) bad('δεξιά ακμή ' + name(el) + ' στο ' + r.right.toFixed(1)); }
  }
  // 4 · Ποσά σε κοινή δεξιά ακμή (data-rx) και κοινή αριστερή (data-lx), με ψηφία σταθερού πλάτους.
  for (const [attr, side] of [['lx', 'left'], ['rx', 'right']]) {
    const groups = {};
    for (const el of all('[data-' + attr + ']')) (groups[el.dataset[attr]] ||= []).push(rc(el)[side]);
    for (const [g, xs] of Object.entries(groups)) { out.n += xs.length; const d = Math.max(...xs) - Math.min(...xs); out.share = Math.max(out.share, d); if (d > 1) bad('ομάδα ' + attr + ' «' + g + '» απόκλιση ' + d.toFixed(1)); }
  }
  for (const el of all('*')) { const own = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join('');
    if (/\\d[\\d.,]*€/.test(own) && !/tabular-nums/.test(getComputedStyle(el).fontVariantNumeric)) bad('ποσό χωρίς ψηφία σταθερού πλάτους: ' + name(el)); }
  { const groups = {};
    for (const el of all('[data-gap]')) (groups[el.dataset.gap] ||= []).push(rc(el));
    for (const [g, rs] of Object.entries(groups)) { if (rs.length < 3) continue; const gs = rs.slice(1).map((r, i) => r.top - rs[i].bottom); out.n += gs.length;
      const d = Math.max(...gs) - Math.min(...gs); out.gap = Math.max(out.gap, d); if (d > 2) bad('κενά «' + g + '» ' + gs.map(x => x.toFixed(1)).join('/')); } }
  for (const el of all('[data-cx]')) { const a = rc(el), t = document.getElementById(el.dataset.cx); if (!t) continue; const b = rc(t); out.n++;
    const d = Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2); out.cx = Math.max(out.cx, d); if (d > 1) bad('κέντρο ' + name(el) + ' απόκλιση ' + d.toFixed(1)); }
  for (const el of all('[data-ccol]')) { const a = rc(el); out.n++;
    const d = Math.abs((a.left + a.right) / 2 - (F.L + F.R) / 2); out.cx = Math.max(out.cx, d); if (d > 1) bad('κέντρο στήλης ' + name(el) + ' απόκλιση ' + d.toFixed(1)); }
  // 5 · Ίδιο εσωτερικό περιθώριο σε κάθε κάρτα.
  for (const el of all('.card')) { const s = getComputedStyle(el); out.pads.push([s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].join(' ')); }
  // 6 · Εικονίδιο και κείμενο: ίδιο κέντρο στον κάθετο άξονα, σε κάθε σειρά flex με εικονίδιο και κείμενο.
  for (const el of all('*')) { const s = getComputedStyle(el); if (!/flex/.test(s.display) || s.flexDirection !== 'row') continue;
    const ch = Array.from(el.children).filter(vis);
    const ic = ch.find(c => c.tagName.toLowerCase() === 'svg' || (c.querySelector && c.querySelector('svg') && !c.textContent.trim()));
    const tx = ch.find(c => c !== ic && c.textContent.trim() && !c.querySelector('svg'));
    const own = Array.from(el.childNodes).find(n => n.nodeType === 3 && n.textContent.trim());
    if (!ic || (!tx && !own)) continue;
    const rg = document.createRange(); rg.selectNodeContents(own || tx); const rs = rg.getBoundingClientRect(); if (!rs.height) continue;
    const ir = rc(ic.tagName.toLowerCase() === 'svg' ? ic : ic.querySelector('svg'));
    const d = Math.abs((ir.top + ir.bottom) / 2 - (rs.top + rs.bottom) / 2); out.icon = Math.max(out.icon, d); out.n++;
    if (d > 1) bad('εικονίδιο εκτός κέντρου κατά ' + d.toFixed(1) + 'px στο ' + name(el)); }
  // 7 · Ζύγιση και οπτικό κέντρο.
  if (kids.length) {
    const first = rc(kids[0]), last = rc(kids[kids.length - 1]);
    out.top = Math.round(first.top - F.top); out.bottom = Math.round(F.bottom - last.bottom);
    out.used = Math.round(last.bottom - first.top); out.ratio = +(out.used / (SB - F.top)).toFixed(3);
    out.above = Math.round(first.top - F.top); out.below = Math.round(SB - last.bottom);
    out.center = +((F.bottom - last.bottom) - (first.top - F.top) - LIFT).toFixed(1);
    if (out.bottom < 0 || out.top < 0) bad('η στήλη ξεχειλίζει: πάνω ' + out.top + ', κάτω ' + out.bottom);
    else if (Math.abs(out.center) > 2) bad('το μπλοκ δεν κάθεται στο οπτικό κέντρο (απόκλιση ' + out.center + 'px)');
    const he = blk.querySelector('[data-hend]'); if (he && he.nextElementSibling) out.hgap = Math.round(rc(he.nextElementSibling).top - rc(he).bottom);
  }
  out.heroes = all('[data-hero]').length;
  out.kicks = all('[data-a*="kick"]').length;
  return out;
})()`;

/** Τα χρώματα κάθε στοιχείου της σελίδας: όλα μέσα στο σύνολο K, με ανοχή για διαβαθμίσεις και διαφάνεια. */
const COLORS = (tokens: [string, number[]][], tol: number) => `(() => {
  const T = ${JSON.stringify(tokens)}, TOL = ${tol}, found = {}, bad = {};
  const near = (r, g, b) => { let best = null, dist = 1e9; for (const [n, c] of T) { const d = Math.hypot(r - c[0], g - c[1], b - c[2]); if (d < dist) { dist = d; best = n; } } return [best, dist]; };
  const scan = (str, where) => { for (const m of String(str).matchAll(/rgba?\\(([^)]+)\\)|color\\(srgb ([^)]+)\\)/g)) {
      let v; if (m[1]) v = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); else v = m[2].split(/[ \\/]+/).filter(Boolean).map((x, i) => i < 3 ? Number(x) * 255 : Number(x));
      const a = v.length > 3 ? v[3] : 1; if (!(a > .02)) continue;
      const [n, d] = near(v[0], v[1], v[2]);
      if (d > TOL) { const k = v.slice(0, 3).map(Math.round).join(','); (bad[k] ||= []).push(where); } else found[n] = (found[n] || 0) + 1; } };
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    if (el.closest('script,style,defs')) continue;
    const s = getComputedStyle(el), w = (el.id || el.tagName.toLowerCase()) + '.';
    scan(s.color, w + 'color'); scan(s.backgroundColor, w + 'bg'); scan(s.backgroundImage, w + 'bgimg'); scan(s.boxShadow, w + 'shadow'); scan(s.textShadow, w + 'tshadow');
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) if (s['border' + side + 'Style'] !== 'none' && parseFloat(s['border' + side + 'Width']) > 0) scan(s['border' + side + 'Color'], w + 'border');
    if (el instanceof SVGElement && /^(path|circle|rect|ellipse|polygon|polyline|line|text|tspan)$/.test(el.tagName.toLowerCase())) { if (s.fill !== 'none') scan(s.fill, w + 'fill'); if (s.stroke !== 'none') scan(s.stroke, w + 'stroke'); }
    if (s.filter && s.filter !== 'none') scan(s.filter, w + 'filter');
  }
  return { found, bad: Object.fromEntries(Object.entries(bad).map(([k, v]) => [k, v.slice(0, 4)])) };
})()`;

/** Ζώνες, μέγεθος, αντίθεση, κόψιμο, ιχνηλασία: ό,τι κείμενο φαίνεται σε αυτό το καρέ. */
const TEXT_SCAN = (opts: { safe: typeof SAFE; min: number; tokens: string[]; strict: boolean }) => `(() => {
  const O = ${JSON.stringify(opts)}, out = { safe: [], type: [], contrast: [], clip: [], trace: [], n: 0 }, boxes = [];
  const tokens = new Set(O.tokens);
  const visible = el => { let o = 1; for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return 0; o *= Number(s.opacity); } return o; };
  const rgb = s => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const v = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const lum = c => { const f = x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  // Το φόντο: το πρώτο μη διάφανο χρώμα προς τα πάνω, πάνω στο έδαφος της σελίδας.
  const bgOf = el => { const stack = []; for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); const c = rgb(s.backgroundColor);
      if (c && c.a > 0) stack.push(c);
      // Η διαγραφή (data-nobg) είναι γραμμή πάνω από το κείμενο, όχι φόντο του.
      const gi = s.backgroundImage; if (gi && gi !== 'none' && !e.hasAttribute('data-nobg') && !/text/.test(s.webkitBackgroundClip || s.backgroundClip || '')) { const cs = (gi.match(/rgba?\\([^)]+\\)/g) || []).map(rgb).filter(Boolean); if (cs.length) { const avg = cs.reduce((a, c2) => ({ r: a.r + c2.r / cs.length, g: a.g + c2.g / cs.length, b: a.b + c2.b / cs.length, a: Math.max(a.a, c2.a) }), { r: 0, g: 0, b: 0, a: 0 }); stack.push(avg); } }
      if (stack.length && stack[stack.length - 1].a >= .99) break; }
    let c = { r: 11, g: 18, b: 32, a: 1 }; for (let i = stack.length - 1; i >= 0; i--) c = over(stack[i], c); return c; };
  const name = el => (el.id || String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || el.tagName) + ' «' + (el.textContent || '').trim().slice(0, 24) + '»';
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    if (el.closest('script,style,svg defs')) continue;
    const own = Array.from(el.childNodes).filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent).join(' ').trim();
    if (!own) continue;
    const o = visible(el); if (o < .5) continue;
    // Το κουτί των ΓΛΥΦΩΝ, όχι του στοιχείου: ένα div πλάτους στήλης με κείμενο που ξεχειλίζει έχει κουτί μέσα στη στήλη.
    const rg = document.createRange(); let r = null;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { rg.selectNodeContents(n); const b = rg.getBoundingClientRect();
      r = r ? { left: Math.min(r.left, b.left), top: Math.min(r.top, b.top), right: Math.max(r.right, b.right), bottom: Math.max(r.bottom, b.bottom) } : { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; }
    if (!r) continue; r.width = r.right - r.left; r.height = r.bottom - r.top; if (!r.width || !r.height) continue;
    if (/\{[a-zA-Z][a-zA-Z0-9_.]*\}/.test(own)) out.trace.push(name(el) + ': γεγονός που δεν γέμισε');
    if (r.bottom < 0 || r.top > 1920 || r.right < 0 || r.left > 1080) continue;
    out.n++;
    // Για τις επικαλύψεις: το κουτί των γλυφών κομμένο στο κουτί του στοιχείου. Ένας αριθμός 240px με διάστιχο 0,9
    // έχει κουτί γλυφών ψηλότερο από τη γραμμή του, χωρίς να ακουμπά μελάνι στο από κάτω.
    { const e = el.getBoundingClientRect(); const q = { left: Math.max(r.left, e.left), top: Math.max(r.top, e.top), right: Math.min(r.right, e.right), bottom: Math.min(r.bottom, e.bottom) };
      q.width = q.right - q.left; q.height = q.bottom - q.top; if (q.width > 0 && q.height > 0) boxes.push({ el, r: q }); }
    const s = getComputedStyle(el), fs = parseFloat(s.fontSize);
    // Ζώνες.
    if (r.left < O.safe.left - .5 || r.right > O.safe.right + .5 || r.top < O.safe.top - .5 || r.bottom > O.safe.bottom + .5)
      out.safe.push(name(el) + ' [' + Math.round(r.left) + ',' + Math.round(r.top) + '–' + Math.round(r.right) + ',' + Math.round(r.bottom) + ']');
    // Μέγεθος: το μέγεθος της γραμματοσειράς επί την κλίμακα που φαίνεται.
    const scale = el.getBoundingClientRect().height / Math.max(1, el.offsetHeight || 1);
    if (fs * scale < O.min - .01 && fs < O.min) out.type.push(name(el) + ' ' + fs.toFixed(1) + 'px');
    // Αντίθεση: όχι στο κείμενο με διαβάθμιση (το μετρά η μέση του χρώματος).
    let col = rgb(s.color);
    const clipText = /text/.test(s.webkitBackgroundClip || s.backgroundClip || '') || (el.closest('.a,.acc-g') && (!col || col.a === 0));
    if (clipText) { const cs = (getComputedStyle(el.closest('.a,.acc-g') || el).backgroundImage.match(/rgba?\\([^)]+\\)/g) || []).map(rgb).filter(Boolean); if (cs.length) col = cs.reduce((a, c2) => ({ r: Math.min(a.r, c2.r), g: Math.min(a.g, c2.g), b: Math.min(a.b, c2.b), a: 1 }), { r: 255, g: 255, b: 255, a: 1 }); }
    if (col && col.a > 0) { const bg = bgOf(el), fg = over({ ...col, a: col.a * Math.min(1, o) }, bg), L1 = lum(fg), L2 = lum(bg), cr = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
      const need = fs >= 32 || (fs >= 24 && Number(s.fontWeight) >= 700) ? 3 : 4.5;
      if (cr < need) out.contrast.push(name(el) + ' ' + cr.toFixed(2) + ':1 (θέλει ' + need + ')'); }
    // Κόψιμο από γονέα με overflow.
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const ps = getComputedStyle(e);
      if (ps.overflow !== 'visible' || ps.overflowX !== 'visible' || ps.overflowY !== 'visible' || ps.clipPath !== 'none') { if (e.tagName === 'SECTION') break; const pr = e.getBoundingClientRect();
        if (r.left < pr.left - 1 || r.right > pr.right + 1 || r.top < pr.top - 2 || r.bottom > pr.bottom + 2) { out.clip.push(name(el) + ' μέσα στο ' + name(e)); break; } } }
    if (el.scrollWidth > el.clientWidth + 1 && s.overflow !== 'visible') out.clip.push(name(el) + ' ξεχειλίζει');
    // Ιχνηλασία: κάθε ομάδα ψηφίων ανήκει σε κείμενο γεγονότος ή σε ημερομηνία/αρίθμηση που δηλώνεται.
    if (/\\d/.test(own) && !el.closest('[data-date],[data-of]')) {
      const groups = own.match(/[\\d.,\\/]*\\d[\\d.,\\/]*(?:€|%)?/g) || [];
      for (const g of groups) { const t = g.replace(/[.,]$/, ''); if (![...tokens].some(x => x.includes(t))) out.trace.push(name(el) + ': «' + t + '»'); }
    }
  }
  // Επικαλύψεις: δύο κείμενα που δεν είναι το ένα μέσα στο άλλο και μοιράζονται πάνω από το 12% του μικρότερου.
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j]; if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w <= 2 || h <= 2) continue;
    const small = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
    if (w * h > .12 * small) out.clip.push('επικάλυψη ' + name(a.el) + ' με ' + name(b.el));
  }
  return out;
})()`;

/** Το ελάχιστο ποσοστό του ωφέλιμου ύψους που πιάνει κάθε σκηνή (ζύγιση). */
export const MIN_USED = .7;

export interface BrowserReport { layout: { k: number; row: Record<string, unknown> }[]; gates: Gate[] }

export async function browserGates(pg: Pg, b: Built, page: Page, f: Facts, o: { pop?: boolean } = {}): Promise<BrowserReport> {
  const at = (t: number) => pg.evaluate((x: number) => (window as unknown as { render: (t: number) => void }).render(x), t);
  const tokens = Object.values(f).map((x: Fact) => x.text).concat(['PROPERWISE']);
  const L: Gate = { name: 'Στοίχιση: ακμές 90/934, ρυθμός 8px, κοινές ακμές ποσών, εικονίδια, οπτικό κέντρο', fails: [] };
  const Cc: Gate = { name: 'Χρώματα μόνο από το σύνολο K', fails: [] };
  const Pd: Gate = { name: `Ίδιο περιθώριο σε κάθε κάρτα (${CARD_PAD.y}px ${CARD_PAD.x}px)`, fails: [] };
  const Hr: Gate = { name: 'Μία ιδέα ανά σκηνή (ένα data-hero)', fails: [] };
  const Kw: Gate = { name: 'Κινητική έμφαση στη λέξη-κλειδί κάθε σκηνής', fails: [] };
  const colFound: Record<string, number> = {};
  const TOK = Object.entries(K).map(([n, h]) => [n, [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))] as [string, number[]]);
  const Sg: Gate = { name: 'Ζώνες YouTube / Instagram / TikTok', fails: [] };
  const Ty: Gate = { name: `Μέγεθος ≥ ${MIN_TEXT}px και αντίθεση`, fails: [] };
  const Cl: Gate = { name: 'Κανένα κομμένο ή επικαλυπτόμενο κείμενο', fails: [] };
  const Tr: Gate = { name: 'Κάθε ψηφίο από γεγονός', fails: [] };
  const layout: { k: number; row: Record<string, unknown> }[] = [];
  const hg: number[] = [];
  // 1 · Σε κάθε σκηνή όταν έχουν κάτσει όλα: χωρίς το ζουμ της σκηνής και το τίναγμα.
  for (const [k, t] of page.settle.entries()) {
    await at(t);
    await pg.evaluate(`document.querySelectorAll('section').forEach(s => { s.style.transform = 'none'; s.style.filter = 'none'; }); document.getElementById('cam').style.transform = 'none';`);
    const row = (await pg.evaluate(LAYOUT(k))) as { fails: string[]; hgap?: number; pads: string[]; heroes: number; kicks: number };
    layout.push({ k, row }); L.fails.push(...row.fails.map(x => `σκηνή ${k + 1}: ${x}`));
    if (typeof row.hgap === 'number') hg.push(row.hgap);
    const want = `${CARD_PAD.y}px ${CARD_PAD.x}px ${CARD_PAD.y}px ${CARD_PAD.x}px`;
    for (const pd of row.pads) if (pd !== want) Pd.fails.push(`σκηνή ${k + 1}: κάρτα με περιθώριο ${pd}`);
    if (row.heroes !== 1) Hr.fails.push(`σκηνή ${k + 1}: ${row.heroes} ήρωες`);
    if (row.kicks < 1) Kw.fails.push(`σκηνή ${k + 1}: καμία λέξη-κλειδί με κινητική έμφαση`);
    const cs = (await pg.evaluate(COLORS(TOK, 6))) as { found: Record<string, number>; bad: Record<string, string[]> };
    for (const [n, c] of Object.entries(cs.found)) colFound[n] = (colFound[n] || 0) + c;
    for (const [rgb, where] of Object.entries(cs.bad)) Cc.fails.push(`σκηνή ${k + 1}: rgb(${rgb}) στο ${where.join(', ')}`);
    const sc = (await pg.evaluate(TEXT_SCAN({ safe: SAFE, min: MIN_TEXT, tokens, strict: true }))) as Record<string, string[]>;
    Sg.fails.push(...sc.safe.map(x => `σκηνή ${k + 1}: ${x}`)); Ty.fails.push(...sc.type.map(x => `σκηνή ${k + 1}: ${x}`), ...sc.contrast.map(x => `σκηνή ${k + 1}: αντίθεση ${x}`));
    Cl.fails.push(...sc.clip.map(x => `σκηνή ${k + 1}: ${x}`)); Tr.fails.push(...sc.trace.map(x => `σκηνή ${k + 1}: ${x}`));
  }
  if (hg.length && Math.max(...hg) - Math.min(...hg) > 2) L.fails.push(`το κενό τίτλου–περιεχομένου διαφέρει: ${hg.join('/')}`);
  Cc.info = Object.entries(colFound).sort((a, b2) => b2[1] - a[1]).map(([n]) => n).join(', ');
  // ΜΙΚΡΟΓΡΑΦΙΑ: το καρέ 0 και το εξώφυλλο διαβάζονται ως εικόνα 200px. Ο ήρωας του αγκιστριού
  // είναι ορατός, ψηλότερος από 280px και μέσα στις ζώνες.
  const Th: Gate = { name: 'Το αγκίστρι δουλεύει και ως μικρογραφία', fails: [] };
  for (const [what, t] of [['καρέ 0', 0], ['εξώφυλλο', page.settle[b.spec.cover]]] as [string, number][]) {
    await at(t);
    const h = (await pg.evaluate(`(() => { const e = document.querySelector('#s0 [data-hero]'); if (!e) return null; let o = 1; for (let x = e; x && x !== document.body; x = x.parentElement) o *= Number(getComputedStyle(x).opacity);
      const r = e.getBoundingClientRect(); return { o, h: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right }; })()`)) as { o: number; h: number; top: number; bottom: number; left: number; right: number } | null;
    if (!h) { Th.fails.push(`${what}: ο ήρωας του αγκιστριού λείπει`); continue; }
    if (h.o < .9) Th.fails.push(`${what}: ο ήρωας φαίνεται στο ${h.o.toFixed(2)}`);
    if (h.h < 280) Th.fails.push(`${what}: ο ήρωας έχει ύψος ${Math.round(h.h)}px`);
    if (h.top < SAFE.top || h.bottom > SAFE.bottom || h.left < SAFE.left - 30 || h.right > SAFE.right) Th.fails.push(`${what}: ο ήρωας βγαίνει από τις ζώνες`);
    Th.info = `ήρωας ${Math.round(h.h)}px, ορατός ${h.o.toFixed(2)}`;
  }
  // ΖΥΓΙΣΗ (07/10/2026: ο ιδιοκτήτης απέρριψε reel «βαρύ πάνω, άδειο κάτω»). Κάθε σκηνή πιάνει
  // τουλάχιστον το 70% του ωφέλιμου ύψους, εκτός από την κάρτα τέλους και όσες δηλώνονται «ανάσα».
  const Bal: Gate = { name: `Ζύγιση: κάθε σκηνή ≥ ${fpRate(MIN_USED * 100)} του ωφέλιμου ύψους`, fails: [] };
  const balRows: string[] = [];
  for (const { k, row } of layout) {
    const r = row as { ratio?: number; used?: number; above?: number; below?: number };
    if (typeof r.ratio !== 'number') continue;
    const sc = b.scenes[k], free = sc.kind === 'endCard' || (sc.params as { breathing?: boolean }).breathing;
    balRows.push(`${k + 1}:${fpRate(Math.round(r.ratio * 100))}${free ? '*' : ''}`);
    if (!free && r.ratio < MIN_USED) Bal.fails.push(`σκηνή ${k + 1} (${sc.kind}): ${fpRate(Math.round(r.ratio * 100))} του ύψους, ${r.below}px άδεια κάτω`);
  }
  Bal.info = balRows.join(' · ');
  // 2 · Κάθε δευτερόλεπτο εκτός περασμάτων: ζώνες (το κείμενο σε κίνηση μένει μέσα).
  const inTr = (t: number) => page.trs.some(x => t > x.B - x.pre - .05 && t < x.B + x.post + .05) || t > b.dur - .6;
  for (let t = .5; t < b.dur; t += 1) {
    if (inTr(t)) continue;
    await at(t);
    const sc = (await pg.evaluate(TEXT_SCAN({ safe: SAFE, min: MIN_TEXT, tokens, strict: false }))) as Record<string, string[]>;
    Sg.fails.push(...sc.safe.map(x => `${t.toFixed(1)}″: ${x}`));
  }
  // 3 · Αναγνωσιμότητα στα περάσματα, καρέ καρέ.
  const Lg: Gate = { name: 'Περάσματα: ≤ 2 καρέ χωρίς ευανάγνωστο κείμενο', fails: [] };
  const legRuns: string[] = [];
  for (const tr of [...page.trs, { k: 0, name: 'loop', B: b.dur, pre: .5, post: 0, opts: {} }]) {
    let run = 0, worst = 0;
    for (let fr = Math.floor((tr.B - tr.pre) * FPS); fr <= Math.ceil((tr.B + tr.post) * FPS); fr++) {
      const t = fr / FPS; if (t < 0 || t >= b.dur) continue;
      await at(t);
      const ok = (await pg.evaluate('window.__leg.ok')) as boolean;
      run = ok ? 0 : run + 1; worst = Math.max(worst, run);
    }
    legRuns.push(`${tr.name}@${tr.B.toFixed(2)}: ${worst}`);
    if (worst > 2) Lg.fails.push(`${tr.name} στο ${tr.B.toFixed(2)}″: ${worst} καρέ στη σειρά χωρίς ευανάγνωστο κείμενο`);
  }
  Lg.info = legRuns.join(' · ');
  // 4 · Κανένα «σκάσιμο»: αδιαφάνεια στοιχείου που πηδά πάνω από 0,7 σε ένα καρέ.
  const Pp: Gate = { name: 'Κανένα στοιχείο που σκάει', fails: [], info: o.pop === false ? 'παραλείφθηκε (--fast)' : undefined };
  if (o.pop !== false) await pg.evaluate(`window.__pop = Array.from(document.querySelectorAll('[data-a]')).filter(e => !/(^|\\|)(mask|strike|grow|growy|wipe|wipey),/.test(e.dataset.a) && !e.closest('#clones'))`);
  let prev: number[] | null = null;
  const frames = o.pop === false ? 0 : Math.round(b.dur * FPS);
  for (let fr = 0; fr < frames; fr++) {
    await at(fr / FPS);
    const ops = (await pg.evaluate(`window.__pop.map(e => e.closest('section') && e.closest('section').style.display === 'none' ? -1 : Number(e.style.opacity || 1))`)) as number[];
    if (prev) ops.forEach((o, i) => { if (o >= 0 && prev![i] >= 0 && Math.abs(o - prev![i]) > .7) Pp.fails.push(`καρέ ${fr}: στοιχείο ${i} από ${prev![i].toFixed(2)} σε ${o.toFixed(2)}`); });
    prev = ops;
  }
  return { layout, gates: [L, Pd, Bal, Cc, Hr, Kw, Th, Sg, Ty, Cl, Tr, Lg, Pp] };
}

// ═══ ΣΤΟ ΑΡΧΕΙΟ ══════════════════════════════════════════════════════════
const FF = () => process.env.FFMPEG || 'ffmpeg';
export function gateLoop(first: string, last: string): Gate {
  const r = spawnSync(FF(), ['-hide_banner', '-i', first, '-i', last, '-lavfi', 'ssim', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /All:([\d.]+)/.exec(r.stderr || '');
  const v = m ? Number(m[1]) : 0;
  return { name: 'Βρόχος χωρίς ραφή (SSIM πρώτου–τελευταίου καρέ)', fails: v >= .85 ? [] : [`SSIM ${v.toFixed(3)} (ελάχιστο 0,85)`], info: `SSIM ${v.toFixed(3)}` };
}
export function gateAudio(mp4: string): Gate {
  const r = spawnSync(FF(), ['-hide_banner', '-nostats', '-i', mp4, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const s = r.stderr || '';
  const tp = Number(/Peak:\s+(-?[\d.]+|-inf) dBFS\s*$/m.exec(s.split('True peak:').pop() ?? '')?.[1] ?? NaN);
  const I = Number(/I:\s+(-?[\d.]+) LUFS/.exec(s.split('Summary:').pop() ?? '')?.[1] ?? NaN);
  const fails = !(tp <= -1) ? [`κορυφή ${tp} dBTP (ταβάνι −1)`] : [];
  return { name: 'Ήχος: κορυφή ≤ −1 dBTP', fails, info: `true peak ${tp} dBTP · ένταση ${I} LUFS` };
}

export function report(gs: Gate[]): string[] {
  return gs.map(g => `  ${g.fails.length ? '✗' : '✓'} ${g.name}${g.info ? ` (${g.info})` : ''}${g.fails.length ? `\n      ${g.fails.slice(0, 12).join('\n      ')}${g.fails.length > 12 ? `\n      … και ${g.fails.length - 12} ακόμη` : ''}` : ''}`);
}
export const failed = (gs: Gate[]) => gs.some(g => g.fails.length);
export { fill, TRANSITIONS };
