// ═══════════════════════════════════════════════════════════════════════════
// «ΙΔΙΟ ΔΙΑΜΕΡΙΣΜΑ, ΔΥΟ ΔΡΟΜΟΙ»: ΕΞΙ STORIES ΚΑΙ ΤΟ ΕΞΩΦΥΛΛΟ
// ─────────────────────────────────────────────────────────────────────────
// Έξι stories 1080×1920 με το κάδρο των σειρών (seiresKit.shell('story')) και
// το εξώφυλλο του reel, χωρίς κανέναν αριθμό, ώστε να μη γερνά μετά τη λήξη
// της κλίμακας. Τα ποσά έρχονται από τα ΙΔΙΑ γεγονότα με το reel
// (dyoDromoiFacts.ts) και κάθε σελίδα περνά από το `assertDigitsFromFacts`
// πριν γραφτεί ως εικόνα: ψηφίο που δεν είναι κείμενο γεγονότος σταματά την
// παραγωγή.
//
// ΟΙ ΖΩΝΕΣ ΤΟΥ INSTAGRAM. Τίποτα σημαντικό πάνω από τα 250px (μπάρα προόδου,
// όνομα λογαριασμού) ούτε κάτω από τα 1580px (πεδίο απάντησης). Οι χώροι των
// αυτοκόλλητων (κουίζ, δημοσκόπηση, ερώτηση, σύνδεσμος) μένουν άδειοι και
// αόρατοι όπως στις σειρές· τι γράφει το καθένα το λέει το φύλλο κειμένων.
//
// ΧΡΗΣΗ: το καλεί το scripts/marketing/reelDyoDromoi.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { shell, SERIES as IG_SERIES } from './seiresKit';
import { mark, FACES, MONO_FACES } from './igKit';
import { occTrack, TRACK_CSS, TRACK_H } from './shorts/scenes';
import { K, UP, esc, fill, fact, type Facts } from './shorts/kit';
import { series as S } from './dyoDromoiFacts';
import { monthShort } from '../../lib/core/months';

type Pg = import('playwright-core').Page;

export interface Sticker { kind: 'Κουίζ' | 'Δημοσκόπηση' | 'Ερώτηση' | 'Σύνδεσμος'; text: string; options?: string[]; answer?: number; url?: string; where: string }
export interface Story { n: number; title: string; html: string; sticker: Sticker; alt: string }

/** Ελληνικό κείμενο με `{γεγονός}` και τόνους, σε HTML: `**…**` λιλά (Airbnb), `__…__` πράσινο (ενοικιαστής), `~~…~~` μπλε (ουδέτερο). */
const T = (f: Facts, s: string, cls = 'acc') => esc(fill(s, f)).replace(/\*\*(.+?)\*\*/g, `<span class="${cls}">$1</span>`).replace(/__(.+?)__/g, '<span class="ok">$1</span>').replace(/~~(.+?)~~/g, '<span class="kb">$1</span>');
const P = (f: Facts, s: string) => fill(s, f).replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/~~(.+?)~~/g, '$1');
/** Το μάτι του story σε κεφαλαία χωρίς τόνους, με γεγονότα. */
const EY = (f: Facts, s: string) => esc(UP(fill(s, f)));
const V = (f: Facts, id: string) => { const x = f[id]; if (!x) throw new Error(`Το story ζητά γεγονός «${id}».`); return x; };
const num = (f: Facts, id: string) => Number(V(f, id).value);
const W = 900;

// ═══ ΚΑΘΕ ΨΗΦΙΟ ΑΠΟ ΓΕΓΟΝΟΣ ═════════════════════════════════════════════════
/**
 * Διαβάζει τη σελίδα ως κείμενο (χωρίς <style>, <script> και ιδιότητες) και
 * σταματά σε κάθε ομάδα ψηφίων που δεν βρίσκεται μέσα σε κείμενο γεγονότος. Ό,τι
 * βρίσκεται μέσα σε `data-of="<γεγονός>"` πρέπει να ανήκει σε ΑΥΤΟ το γεγονός·
 * ό,τι μέσα σε `data-date` είναι μέρα ημερολογίου.
 */
export function assertDigitsFromFacts(where: string, html: string, f: Facts) {
  const body = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
  const texts = Object.values(f).map(x => x.text).filter(Boolean);
  const VOID = /^(br|img|input|meta|link|hr|col|source|path|rect|circle|line|polyline|polygon|ellipse|stop|feGaussianBlur|feTurbulence|feColorMatrix)$/i;
  const stack: { tag: string; of?: string; date?: boolean }[] = [];
  const bad: string[] = [];
  for (const m of body.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>|([^<]+)/g)) {
    if (m[5] != null) {
      const txt = m[5].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
      if (!/\d/.test(txt)) continue;
      const of = [...stack].reverse().find(s => s.of)?.of, date = stack.some(s => s.date);
      for (const g of txt.match(/[\d.,/]*\d[\d.,/]*(?:€|%)?/g) ?? []) {
        const t = g.replace(/[.,]$/, '');
        if (date) continue;
        if (of) { const x = f[of]; if (!x || !x.text.includes(t)) bad.push(`«${t}» μέσα στο data-of="${of}"`); continue; }
        if (!texts.some(x => x.includes(t))) bad.push(`«${t}» στο «${txt.trim().slice(0, 40)}»`);
      }
      continue;
    }
    const [, close, tag, attrs, self] = m;
    if (close) { const i = stack.map(s => s.tag).lastIndexOf(tag.toLowerCase()); if (i >= 0) stack.length = i; continue; }
    if (self || VOID.test(tag)) continue;
    stack.push({ tag: tag.toLowerCase(), of: /\bdata-of="([^"]+)"/.exec(attrs)?.[1], date: /\bdata-date\b/.test(attrs) });
  }
  if (bad.length) throw new Error(`${where}: ψηφία που δεν βγήκαν από γεγονός: ${bad.slice(0, 8).join(', ')}`);
}

// ═══ ΤΟ ΚΑΔΡΟ ═════════════════════════════════════════════════════════════
const CSS = `
  ${TRACK_CSS}
  /* Το έδαφος των σειρών, μόνο με χρώματα του K. */
  .bg{background:radial-gradient(900px 700px at 85% 8%, ${K.other}24, transparent 70%),radial-gradient(1000px 800px at 0% 92%, ${K.accent}1a, transparent 72%),linear-gradient(180deg, ${K.panel} 0%, ${K.ground} 55%)!important}
  .wrap{top:264px!important;height:1236px!important;padding:0 90px!important}
  .stamp{font-size:26px!important;height:48px}
  .stamp>span{color:${K.muted}!important;font-family:'Roboto Mono',monospace;white-space:nowrap}
  .stamp em{font-style:normal}
  .foot{top:1512px!important;left:90px!important;right:90px!important}
  .brand b{font-size:28px!important}.brand small{font-size:26px!important;color:${K.muted}!important}
  .card{background:linear-gradient(180deg, ${K.lift}f2, ${K.panel}f2)!important;border:1.5px solid ${K.rule}!important;border-radius:28px!important;box-shadow:inset 0 1px 0 ${K.ink}0d,0 50px 120px -40px ${K.ground}!important;padding:24px 28px}
  h2{font-size:84px;line-height:.98;letter-spacing:-.045em;margin-top:24px}
  h2 .acc{color:${K.other};text-shadow:0 18px 90px ${K.other}55}
  h2 .ok{color:${K.ok}}
  h2 .kb{color:${K.accent};text-shadow:0 18px 90px ${K.accent}55}
  .lead .kb{color:${K.accent};font-weight:700}
  .lead{font-size:36px;line-height:1.3;color:${K.muted};margin-top:16px}
  .lead .acc{color:${K.other};font-weight:700}.lead .ok{color:${K.ok};font-weight:700}.lead .neg{color:${K.tax};font-weight:700}
  .slot{flex:none;position:relative}
  .fn{margin-top:auto;font-family:'Roboto Mono',monospace;font-size:26px;line-height:34px;color:${K.muted};letter-spacing:.02em}
  .num{font-variant-numeric:tabular-nums}
  .ey{font-family:'Roboto Mono',monospace;font-size:26px;line-height:32px;letter-spacing:.12em;color:${K.accent};margin-top:24px}
  .cta2{display:flex;align-items:center;gap:14px;font-size:34px;font-weight:750;color:${K.ink}}
  .cta2 i{display:block;width:48px;height:4px;border-radius:2px;background:${K.accent}}`;

function frame(f: Facts, n: number, total: number, body: string, css: string, foot: string): string {
  const fx: Facts = { ...f, 'story.no': fact('story.no', n, String(n), 'η θέση του story στη σειρά'), 'story.count': fact('story.count', total, String(total), 'πόσα stories έχει η σειρά') };
  const html = shell('story', IG_SERIES.vraxy, { no: n }, n - 1, total, `${body}<div class="fn">${foot}</div>`, CSS + css)
    .replace(/<span>#\d+<\/span>/, `<span class="cnt6"><em data-of="story.no">${n}</em> από <em data-of="story.count">${total}</em></span>`);
  assertDigitsFromFacts(`story ${n}`, html, fx);
  return html;
}
const footer = (f: Facts, src: string) => `${T(f, src)}<br>${T(f, 'Λήγει {validRental} · Τα πρόσωπα είναι παραδείγματα')}`;

// ═══ ΤΑ ΕΞΙ STORIES ═══════════════════════════════════════════════════════
const NIGHT = [
  { id: 'nightFee', label: 'Προμήθεια', c: `${K.ink}66` }, { id: 'nightClean', label: 'Καθαριότητα', c: `${K.ink}4d` },
  { id: 'nightFixed', label: 'Πάγια', c: `${K.ink}33` }, { id: 'nightTax', label: 'Φόρος', c: K.tax }, { id: 'nightNet', label: 'Σε σένα', c: K.other },
];
/** Οι πηγές με ονόματα που διαβάζει ο κόσμος· οι διαδρομές του κώδικα μένουν στο texts.md. */
const SRC = {
  svl: 'Πηγή: υπολογιστής «Βραχυχρόνια ή μακροχρόνια», κλίμακα {year}',
  apo: 'Πηγή: υπολογιστής καθαρής απόδοσης (/kathari-apodosi), κλίμακα {year}',
  all: 'Πηγή: οι υπολογιστές του PROPERWISE, κλίμακα {year}',
};

export function stories(f: Facts): Story[] {
  const N = 6, out: Story[] = [];
  const price = num(f, 'nightPrice');

  // ── 1 · Η ερώτηση: μία νύχτα, πέντε κομμάτια παγωμένα ───────────────────
  // ΙΣΑ κομμάτια: με τις αληθινές αναλογίες η λιλά λωρίδα έδινε την απάντηση του κουίζ.
  {
    const H = 620, h = H / NIGHT.length;
    const segs = NIGHT.map((x, i) => `<i style="top:${(i * h).toFixed(1)}px;height:${(h - 4).toFixed(1)}px;background:${x.c}"></i>`).join('');
    const body = `<div class="ey">${EY(f, 'Μία νύχτα Airbnb · παράδειγμα')}</div>
      <h2>${T(f, 'Μία νύχτα **{nightPrice}**.')}<br>${T(f, 'Πόσα μένουν σε σένα;')}</h2>
      <div class="s1" style="margin-top:56px"><div class="s1b"><div class="fz">${segs}</div><b>?</b></div>
        <div class="s1r"><div class="slot" style="height:440px"></div><div class="cta2"><i></i>${T(f, 'Η απάντηση στο ~~επόμενο~~')}</div></div></div>`;
    out.push({ n: 1, title: P(f, 'Μία νύχτα {nightPrice}. Πόσα μένουν σε σένα;'),
      html: frame(f, 1, N, body, `
        .s1{display:flex;gap:48px;height:${H}px}
        .s1b{position:relative;flex:none;width:220px;height:${H}px;border-radius:24px;overflow:hidden;box-shadow:inset 0 0 0 2px ${K.ink}26}
        .fz{position:absolute;inset:0;filter:blur(16px);transform:scale(1.08)}
        .fz i{position:absolute;left:0;right:0;display:block}
        .s1b b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:200px;font-weight:900;color:${K.ink};text-shadow:0 10px 60px ${K.ground}}
        .s1r{flex:1;display:flex;flex-direction:column;justify-content:space-between}
        .cta2 .kb{color:${K.accent}}`, footer(f, 'Πηγή: υπολογιστής «Βραχυχρόνια ή μακροχρόνια»')),
      sticker: { kind: 'Κουίζ', text: 'Πόσα μένουν σε σένα από μία νύχτα;', options: ['quiz1.0', 'quiz1.1', 'quiz1.2'].map(id => V(f, id).text), answer: 2, where: 'δεξιά της μπάρας, πάνω από το «Η απάντηση στο επόμενο»' },
      alt: P(f, 'Μία ψηλή μπάρα της νύχτας των {nightPrice}, θολή, χωρισμένη σε πέντε ίσα κομμάτια. Ερώτηση: πόσα μένουν σε σένα;') });
  }

  // ── 2 · Η απάντηση: κάθετη ροή της νύχτας και η μέρα στην ίδια κλίμακα ──
  {
    const k = 720 / price, G = 24, x0 = (W - (720 + G * 4)) / 2, sx0 = (W - 720) / 2, Hs = 190;
    let xs = sx0, xt = x0;
    const parts = NIGHT.map(x => {
      const w = num(f, x.id) * k, a = xs + w / 2, b = xt + w / 2, r = { ...x, w, a, b, xt };
      xs += w; xt += w + G; return r;
    });
    const svg = `<svg width="${W}" height="${Hs}" viewBox="0 0 ${W} ${Hs}" style="position:absolute;left:0;top:0">
      <rect x="${sx0}" y="0" width="720" height="16" rx="4" fill="${K.ink}"/>
      ${parts.map(p => `<path d="M${p.a.toFixed(1)} 16 C${p.a.toFixed(1)} ${Hs / 2} ${p.b.toFixed(1)} ${Hs / 2} ${p.b.toFixed(1)} ${Hs - 16}" stroke="${p.c}" stroke-width="${p.w.toFixed(1)}" fill="none"${p.id === 'nightNet' ? ` style="filter:drop-shadow(0 0 16px ${K.other}99)"` : ''}/>
        <rect x="${p.xt.toFixed(1)}" y="${Hs - 16}" width="${p.w.toFixed(1)}" height="16" rx="4" fill="${p.c}"/>`).join('')}
    </svg>`;
    const labels = parts.map((p, i) => `<div class="s2l" style="left:${(p.b - 110).toFixed(1)}px;top:${Hs + 12 + (i & 1) * 76}px"><span>${esc(p.label)}</span><b class="num" style="color:${p.id === 'nightNet' ? K.other : p.id === 'nightTax' ? K.tax : K.ink}">${esc(V(f, p.id).text)}</b></div>`).join('');
    // Η μέρα: ΙΔΙΑ λογική με τη νύχτα. Κόμβος-πηγή το ενοίκιο της μέρας, δύο ρεύματα (φόρος, σε σένα) με κενό G.
    const g = num(f, 'tenantGrossDay') * k, nt = num(f, 'tenantPerDay') * k, sl = num(f, 'tenantTaxDay') * k, gx = sx0, Ht = 150;
    const tx = gx - G / 2, nx = tx + sl + G;
    const svg2 = `<svg width="${W}" height="${Ht}" viewBox="0 0 ${W} ${Ht}" style="position:absolute;left:0;top:0">
      <rect x="${gx}" y="0" width="${g.toFixed(1)}" height="16" rx="4" fill="${K.ink}"/>
      <path d="M${(gx + sl / 2).toFixed(1)} 16 C${(gx + sl / 2).toFixed(1)} ${Ht / 2} ${(tx + sl / 2).toFixed(1)} ${Ht / 2} ${(tx + sl / 2).toFixed(1)} ${Ht - 16}" stroke="${K.tax}" stroke-width="${sl.toFixed(1)}" fill="none"/>
      <rect x="${tx.toFixed(1)}" y="${Ht - 16}" width="${sl.toFixed(1)}" height="16" rx="4" fill="${K.tax}"/>
      <path d="M${(gx + sl + nt / 2).toFixed(1)} 16 C${(gx + sl + nt / 2).toFixed(1)} ${Ht / 2} ${(nx + nt / 2).toFixed(1)} ${Ht / 2} ${(nx + nt / 2).toFixed(1)} ${Ht - 16}" stroke="${K.ok}" stroke-width="${nt.toFixed(1)}" fill="none"/>
      <rect x="${nx.toFixed(1)}" y="${Ht - 16}" width="${nt.toFixed(1)}" height="16" rx="4" fill="${K.ok}"/>
    </svg>`;
    const body = `<div class="ey">${EY(f, 'Η απάντηση · παράδειγμα')}</div>
      <h2>${T(f, 'Μένουν **{nightNet}**')}<br>${T(f, 'από τα {nightPrice}')}</h2>
      <div class="s2" style="height:${Hs + 12 + 76 + 72}px;margin-top:40px">${svg}${labels}</div>
      <div class="s2t" style="margin-top:16px"><div class="s2g" style="height:${Ht + 40}px">${svg2}<span class="s2f" style="left:${(tx - 4).toFixed(1)}px;top:${Ht + 4}px">${T(f, 'φόρος')}</span></div>
        <div class="s2tl">${T(f, 'Η μέρα του ενοικιαστή,')}<span>${T(f, '__ίδια κλίμακα__')}</span><b class="num">${T(f, '{tenantPerDay}, κάθε μέρα', 'ok')}</b></div></div>
      <div class="slot" style="height:180px;margin-top:16px"></div>`;
    out.push({ n: 2, title: P(f, 'Μένουν {nightNet} από τα {nightPrice}'),
      html: frame(f, 2, N, body, `
        .s2,.s2g{position:relative;flex:none}
        .s2l{position:absolute;width:220px;display:flex;flex-direction:column;align-items:center;text-align:center}
        .s2l span{font-size:26px;line-height:32px;font-weight:600;color:${K.muted}}
        .s2l b{font-size:34px;line-height:40px;font-weight:800}
        .s2t{display:flex;align-items:flex-start;gap:40px;flex:none}
        .s2g{flex:none;width:${(nx + nt + 24).toFixed(0)}px}
        .s2f{position:absolute;font-size:26px;line-height:32px;font-weight:650;color:${K.tax};white-space:nowrap}
        .s2tl{display:flex;flex-direction:column;gap:4px;font-size:32px;line-height:40px;font-weight:650;color:${K.ink}}
        .s2tl .ok{color:${K.ok}}
        .s2tl b{margin-top:8px;font-size:44px;line-height:52px;font-weight:850}`, footer(f, SRC.svl)),
      sticker: { kind: 'Δημοσκόπηση', text: 'Το δικό σου γεμίζει:', options: ['Όλο τον χρόνο', 'Κυρίως καλοκαίρι'], where: 'κάτω από τη ροή του ενοικιαστή' },
      alt: P(f, 'Κάθετη ροή της νύχτας των {nightPrice}, μέσοι όροι στο παράδειγμα: προμήθεια {nightFee}, καθαριότητα {nightClean}, πάγια {nightFixed}, φόρος {nightTax}, σε σένα {nightNet}. Στην ίδια κλίμακα η μέρα του ενοικιαστή: ένα λεπτό ρεύμα φόρου και {tenantPerDay} σε σένα.') });
  }

  // ── 3 · Ίδιες νύχτες, ίδιο σύνολο, άλλη χρονιά ─────────────────────────
  // Ημερολόγιο και κούρσα στις ΙΔΙΕΣ δώδεκα στήλες, με μία σειρά μηνών ανάμεσα.
  {
    const summer = S<number[]>(f, 'series.summer'), even = S<number[]>(f, 'series.even'), ten = S<number[]>(f, 'series.tenant'), mx = Math.max(...summer);
    const row = (label: string, xs: number[], col: string) => `<div class="s3r"><span>${label}</span><div class="s3c">${xs.map(v => `<i>${v > 0 ? `<b style="height:${(v / mx * 48).toFixed(1)}px;background:${col}"></b>` : `<b class="neg"></b>`}</i>`).join('')}</div></div>`;
    const cS = S<number[]>(f, 'series.cumSummer'), cE = S<number[]>(f, 'series.cumEven'), cT = S<number[]>(f, 'series.cumTenant'), cm = Math.max(...cS, ...cE, ...cT);
    const Hc = 230, pitch = W / 12, px = (i: number) => (i + .5) * pitch, py = (v: number) => Hc - 16 - v / cm * (Hc - 64);
    const line = (xs: number[], col: string, dash = false) => `<path d="M0 ${py(0)} ${xs.map((v, i) => `L${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' ')}" stroke="${col}" stroke-width="${dash ? 4 : 6}"${dash ? ' stroke-dasharray="12 9"' : ''} stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    const cross = num(f, 'cumCross.month'), hf = num(f, 'highFrom');
    // Η κάρτα «;» κρύβει τους μήνες γύρω από τη διασταύρωση (και όλες τις επιλογές του κουίζ).
    const q0 = Math.min(hf, cross - 2), q1 = Math.max(cross + 2, num(f, 'quiz3.3'));
    const body = `<div class="ey">${EY(f, 'Ταμείο ανά μήνα · παράδειγμα')}</div>
      <h2 style="font-size:76px">Ίδιες νύχτες,<br>ίδιο σύνολο, <span class="acc">άλλη χρονιά</span></h2>
      <div class="s3" style="margin-top:32px">
        ${row('κυρίως καλοκαίρι', summer, K.other)}${row('όλο τον χρόνο', even, K.other)}${row('ενοικιαστής', ten, K.ok)}
        <div class="s3m">${summer.map((_, i) => `<em>${esc(monthShort(i))}</em>`).join('')}</div>
      </div>
      <div class="s3k">${T(f, 'Κούρσα: ταμείο πριν τον φόρο, αθροιστικά')}</div>
      <div class="s3g" style="height:${Hc}px"><svg width="${W}" height="${Hc}" viewBox="0 0 ${W} ${Hc}">${line(cT, K.ok)}${line(cE, K.other, true)}${line(cS, K.other)}</svg>
        <span class="s3e" style="right:0;top:${(py(cS[11]) - 48).toFixed(1)}px;color:${K.other}">${T(f, 'κυρίως καλοκαίρι')}</span>
        <span class="s3e sm" style="left:0;top:${(py(cE[q0 - 1]) - 60).toFixed(1)}px;color:${K.other}"><i></i>${T(f, 'όλο τον χρόνο')}</span>
        <span class="s3e" style="right:0;top:${(py(cT[11]) + 12).toFixed(1)}px;color:${K.ok}">${T(f, 'ενοικιαστής')}</span>
        <div class="s3q" style="left:${(q0 * pitch + 12).toFixed(1)}px;width:${((q1 - q0 + 1) * pitch - 12).toFixed(1)}px"><b>${T(f, 'Ποιον μήνα;')}</b></div></div>
      <div class="slot" style="height:140px;margin-top:16px"></div>
      <div class="lead" style="margin-top:8px;font-size:30px">${T(f, 'Μόνο καλοκαίρι; Για να φτάσεις τον ενοικιαστή γεμίζεις το **{beShareHigh}** των {highNights} καλοκαιρινών νυχτών.')}</div>`;
    out.push({ n: 3, title: 'Ίδιες νύχτες, ίδιο σύνολο, άλλη χρονιά',
      html: frame(f, 3, N, body, `
        .s3{flex:none}
        .s3r{display:flex;flex-direction:column;gap:4px;margin-bottom:12px}
        .s3r>span{font-family:'Roboto Mono',monospace;font-size:26px;line-height:32px;color:${K.muted};letter-spacing:.02em}
        .s3c,.s3m{display:grid;grid-template-columns:repeat(12,1fr);gap:6px}
        .s3c{height:48px}
        .s3c i{position:relative;border-radius:8px;background:${K.ink}0d;box-shadow:inset 0 0 0 1.5px ${K.ink}1a;overflow:hidden}
        .s3c b{position:absolute;left:0;right:0;bottom:0;display:block}
        .s3c b.neg{height:6px;background:${K.tax}}
        .s3m{height:32px}
        .s3m em{font-style:normal;text-align:center;font-size:26px;line-height:32px;font-weight:500;letter-spacing:-.02em;color:${K.faint}}
        .s3k{flex:none;margin-top:24px;font-family:'Roboto Mono',monospace;font-size:26px;line-height:32px;color:${K.muted};letter-spacing:.02em}
        .s3g{position:relative;flex:none}
        .s3g svg{position:absolute;left:0;top:0}
        .s3e{position:absolute;display:flex;align-items:center;gap:10px;height:36px;padding:0 10px;border-radius:10px;background:${K.ground}cc;font-size:28px;line-height:36px;font-weight:700;white-space:nowrap}
        .s3e i{display:block;width:24px;height:0;border-top:4px dashed ${K.other}}
        .s3e.sm{gap:8px;padding:0 6px 0 0;font-size:26px}
        .s3q{position:absolute;top:0;bottom:0;display:flex;align-items:center;justify-content:center;border-radius:20px;background:${K.lift};border:1.5px solid ${K.accent}66;box-shadow:0 30px 80px -20px ${K.ground}}
        .s3q b{font-size:44px;line-height:52px;font-weight:850;color:${K.accent}}`, footer(f, 'Πηγή: υπολογιστής «Βραχυχρόνια ή μακροχρόνια»')),
      sticker: { kind: 'Κουίζ', text: 'Ποιον μήνα περνά μπροστά το Airbnb;', options: ['quiz3.0', 'quiz3.1', 'quiz3.2', 'quiz3.3'].map(id => V(f, id).text), answer: 2, where: 'πάνω από τη γραμμή «Μόνο καλοκαίρι;», κάτω από την κούρσα' },
      alt: P(f, 'Ημερολόγιο τριών σειρών: κυρίως καλοκαίρι, όλο τον χρόνο, ενοικιαστής. Από κάτω η κούρσα του ταμείου πριν τον φόρο, αθροιστικά, με τους μήνες γύρω από τη διασταύρωση κρυμμένους πίσω από ένα ερωτηματικό. Μόνο καλοκαίρι: για να φτάσεις τον ενοικιαστή γεμίζεις το {beShareHigh} των {highNights} καλοκαιρινών νυχτών.') });
  }

  // ── 4 · Τι μετακινεί το όριο: τέσσερις μικροί δείκτες ──────────────────
  // Τρεις στην ΙΔΙΑ κλίμακα (ο χρόνος, με αχνή γραμμή το βασικό όριο). Το «μόνο καλοκαίρι»
  // μετρά άλλο πράγμα (τις νύχτες του καλοκαιριού): κελιά αντί για μπάρα, χωρίς αχνή γραμμή.
  {
    const pw = (W - 16) / 2 - 56;
    const panel = (key: string, title: string, o: Omit<Parameters<typeof occTrack>[0], 'f' | 'id' | 'width'>, icon = '') => `<div class="card s4p" data-box><div class="s4t">${icon}${T(f, title)}</div>${occTrack({ ...o, f, id: `s4${key}`, width: pw })}</div>`;
    const ends: [string, string] = ['άδειο', 'γεμάτο'];
    const highMonths = num(f, 'highTo') - num(f, 'highFrom') + 1;
    const body = `<div class="ey">${EY(f, 'Το όριο πληρότητας · παράδειγμα')}</div>
      <h2>Τι μετακινεί<br><span class="kb">το όριο</span></h2>
      <div class="s4" style="margin-top:40px">
        ${panel('a', 'Ένας μήνας άδειος', { ends, ghost: 'be.base', marks: [{ at: 'be11.exact', labelFact: 'be11.ceil', side: 'l' }], note: '{vacancy1} λιγότερα', noteNeg: true }, '<i class="s4i"></i>')}
        ${panel('b', 'Με άλλα ενοίκια', { ends, ghost: 'be.base', marks: [{ at: 'withEleni.beExact', labelFact: 'withEleni.be', side: 'l' }], note: '{withEleni.otherGross} τον χρόνο' })}
        ${panel('c', 'Μόνο καλοκαίρι', { ends: ['{highFrom}–{highTo}', ''], cells: highMonths, marks: [{ at: 'beShareHigh.exact', labelFact: 'beShareHigh', side: 'l' }], note: 'των {highNights} νυχτών' })}
        ${panel('d', 'Μηνιαίο ενοίκιο {rentNever}', { ends, ghost: 'be.base', marks: [{ at: 'be.base', off: true }], note: 'και πάνω: ούτε γεμάτο', noteNeg: true })}
      </div>
      <div class="lead" style="margin-top:20px;font-size:30px">${T(f, 'Γκρίζα γραμμή: το διαμέρισμα χωρίς αλλαγή, {nightPrice} τη νύχτα. Το «μόνο καλοκαίρι» μετρά μόνο τις νύχτες {highFrom}–{highTo}.')}</div>
      <div class="slot" style="height:130px;margin-top:12px"></div>`;
    out.push({ n: 4, title: 'Τι μετακινεί το όριο',
      html: frame(f, 4, N, body, `
        .s4{display:grid;grid-template-columns:1fr 1fr;gap:16px;flex:none}
        .s4p{padding:24px 28px!important}
        .s4t{display:flex;align-items:center;gap:12px;height:40px;margin-bottom:16px;font-size:30px;line-height:40px;font-weight:750;color:${K.ink};white-space:nowrap}
        .s4i{display:block;width:24px;height:36px;border-radius:5px;border:3px dashed ${K.tax}}
        .s4p .otk{height:${TRACK_H}px}
        .s4p .ote,.s4p .otl{font-size:26px}`, footer(f, SRC.svl)),
      sticker: { kind: 'Ερώτηση', text: 'Πόσο έμεινε άδειο το δικό σου ανάμεσα σε δύο ενοικιαστές;', where: 'κάτω από τους τέσσερις δείκτες' },
      alt: P(f, 'Τέσσερις δείκτες πληρότητας. Ένας μήνας άδειος ({vacancy1} λιγότερα): {be11.ceil}. Με άλλα ενοίκια {withEleni.otherGross} τον χρόνο: {withEleni.be}. Μόνο καλοκαίρι: το {beShareHigh} των {highNights} καλοκαιρινών νυχτών. Μηνιαίο ενοίκιο {rentNever} και πάνω με {nightPrice} τη νύχτα: το Airbnb δεν κερδίζει ούτε γεμάτο.') });
  }

  // ── 5 · Αν έχεις ήδη άλλα ενοίκια ────────────────────────────────────────
  {
    const vs = ['ghost.long', 'ghost.short', 'withEleni.long', 'withEleni.short'].map(id => num(f, id));
    const lo0 = Math.min(...vs), hi0 = Math.max(...vs), pad = (hi0 - lo0) * .35, lo = lo0 - pad, hi = hi0 + pad * .3, x = (v: number) => (v - lo) / (hi - lo) * W;
    const [ga, gb, ra, rb] = vs.map(x);
    const ex = [num(f, 'withEleni.extra.long'), num(f, 'withEleni.extra.short')], em = Math.max(...ex);
    // Οι ετικέτες κάτω από τις τελείες μένουν μέσα στο περιθώριο των 90px (κουτί 280px, κομμένο στο 0).
    const VW = 280, vl = Math.max(0, ra + 20 - VW);
    const body = `<div class="ey">${EY(f, 'Όπως η Ελένη, το παράδειγμα της εφαρμογής')}</div>
      <h2>Αν έχεις ήδη<br>άλλα <span class="kb">ενοίκια</span></h2>
      <div class="s5d" style="margin-top:40px">
        <span class="s5g">μόνο αυτό το διαμέρισμα</span>
        <i class="s5bar g" style="left:${ga}px;width:${gb - ga}px;top:66px"></i><i class="s5o g" style="left:${ga - 14}px;top:55px"></i><i class="s5o g" style="left:${gb - 14}px;top:55px"></i>
        <span class="s5h">${T(f, 'Με άλλα ενοίκια {withEleni.otherGross} τον χρόνο')}</span>
        <i class="s5bar" style="left:${ra}px;width:${rb - ra}px;top:186px"></i><i class="s5o ok" style="left:${ra - 18}px;top:172px"></i><i class="s5o oth" style="left:${rb - 18}px;top:172px"></i>
        <div class="s5v ok" style="left:${vl.toFixed(1)}px;width:${VW}px"><b class="num">${esc(V(f, 'withEleni.long').text)}</b><span>ενοικιαστής</span></div>
        <div class="s5v oth l" style="left:${(rb - 20).toFixed(1)}px"><b class="num">${esc(V(f, 'withEleni.short').text)}</b><span>Airbnb</span></div>
        <div class="s5x"><span>διαφορά τον χρόνο</span><b class="num">${esc(V(f, 'withEleni.diff').text)}</b></div>
      </div>
      <div class="s5e card" data-box style="margin-top:24px"><div class="s5et">Ο φόρος που φέρνει το νέο ενοίκιο πάνω στα άλλα</div>
        ${[['ενοικιαστής', 'withEleni.extra.long'], ['Airbnb', 'withEleni.extra.short']].map(([l, id], i) => `<div class="s5r"><span>${esc(l)}</span><i><b style="transform:scaleX(${(ex[i] / em).toFixed(4)})"></b></i><em class="num">${esc(V(f, id).text)}</em></div>`).join('')}
      </div>
      <div class="lead" style="margin-top:24px;font-size:30px">${T(f, 'Η Ελένη, ιδιοκτήτρια του ακινήτου επίδειξης της εφαρμογής, το νοικιάζει ήδη όλο τον χρόνο. Παράδειγμα, όχι υπαρκτό πρόσωπο. Με μικρότερα άλλα ενοίκια τα νούμερα αλλάζουν.')}</div>
      <div class="slot" style="height:100px;margin-top:8px"></div>`;
    out.push({ n: 5, title: 'Αν έχεις ήδη άλλα ενοίκια',
      html: frame(f, 5, N, body, `
        .s5d{position:relative;flex:none;height:300px}
        .s5d>*{position:absolute}
        .s5g{left:0;top:0;font-family:'Roboto Mono',monospace;font-size:26px;line-height:36px;color:${K.faint};letter-spacing:.04em}
        .s5h{left:0;top:110px;font-size:32px;line-height:40px;font-weight:750;color:${K.ink};white-space:nowrap}
        .s5bar{height:8px;border-radius:4px;background:linear-gradient(90deg,${K.ok},${K.other})}
        .s5bar.g{height:6px;background:${K.ink}1f}
        .s5o{width:36px;height:36px;border-radius:50%;border:5px solid ${K.ground}}
        .s5o.g{width:28px;height:28px;border:3px solid ${K.ink}4d;background:${K.ground}}
        .s5o.ok{background:${K.ok};box-shadow:0 0 0 2px ${K.ok}}.s5o.oth{background:${K.other};box-shadow:0 0 0 2px ${K.other}}
        .s5v{top:224px;display:flex;flex-direction:column;align-items:flex-end;white-space:nowrap}
        .s5v.l{align-items:flex-start}
        .s5v b{font-size:38px;line-height:46px;font-weight:800}.s5v.ok b{color:${K.ok}}.s5v.oth b{color:${K.other}}
        .s5v span{font-family:'Roboto Mono',monospace;font-size:26px;line-height:34px;color:${K.muted}}
        .s5x{right:0;top:150px;display:flex;flex-direction:column;align-items:flex-end}
        .s5x span{font-family:'Roboto Mono',monospace;font-size:26px;line-height:32px;color:${K.muted}}
        .s5x b{font-size:64px;line-height:84px;font-weight:900;color:${K.ink}}
        .s5e{flex:none}
        .s5et{font-size:28px;line-height:36px;font-weight:650;color:${K.muted};margin-bottom:8px}
        .s5r{display:flex;align-items:center;gap:20px;height:56px}
        .s5r span{flex:none;width:190px;font-size:30px;font-weight:700;color:${K.ink}}
        .s5r i{flex:1;height:20px;border-radius:10px;background:${K.ink}0d}
        .s5r i b{display:block;height:100%;border-radius:10px;background:${K.tax};transform-origin:0 50%}
        .s5r em{flex:none;width:190px;text-align:right;font-style:normal;font-size:34px;font-weight:800;color:${K.tax}}`, footer(f, SRC.apo)),
      sticker: { kind: 'Σύνδεσμος', text: 'Βάλε και τα άλλα ενοίκια', url: 'https://properwise.gr/kathari-apodosi?utm_source=instagram&utm_medium=story&utm_campaign=ig-dyo-dromoi', where: 'στο κάτω μέρος, πάνω από την πηγή' },
      alt: P(f, 'Dumbbell: μόνο αυτό το διαμέρισμα (αχνό) και με άλλα ενοίκια {withEleni.otherGross} τον χρόνο: ενοικιαστής {withEleni.long}, Airbnb {withEleni.short}, διαφορά {withEleni.diff}. Ο φόρος που φέρνει το νέο ενοίκιο πάνω στα άλλα: {withEleni.extra.long} με ενοικιαστή, {withEleni.extra.short} με Airbnb.') });
  }

  // ── 6 · Η κάρτα για αποθήκευση: τα όρια ΤΟΥ ΠΑΡΑΔΕΙΓΜΑΤΟΣ ──────────────────
  // Κάθε γραμμή λέει τη συνθήκη της (πόσο τη νύχτα, με τι άλλα ενοίκια, σε ποιον τζίρο).
  // Χρώματα με κανόνα: σομόν φόρος και κόστος, μπλε όριο πληρότητας, πράσινο ενοίκιο.
  {
    const rungs: [string, string, string][] = [
      ['margShort', 'σε κάθε νέο ευρώ από τη νύχτα {occ25.nights}, χωρίς άλλα ενοίκια', K.tax],
      ['occ35.marg', 'σε κάθε νέο ευρώ από τη νύχτα {occ35.nights}', K.tax],
      ['be11.ceil', 'όριο πληρότητας αν λείψει ένας μήνας ενοικίου', K.accent],
      ['withEleni.be', 'όριο πληρότητας με άλλα ενοίκια {withEleni.otherGross} τον χρόνο', K.accent],
      ['mun3.amount', 'τέλος παρεπιδημούντων από το {mun3.from} ακίνητο, στον τζίρο του παραδείγματος', K.tax],
      ['rentNever', 'μηνιαίο ενοίκιο που το Airbnb των {nightPrice} δεν φτάνει ούτε γεμάτο', K.ok],
    ];
    // Μία λήξη για όλη την κάρτα, από το lib/legal/validity.ts· δύο μόνο αν διαφέρουν.
    const sameEnd = V(f, 'validRental').text === V(f, 'validMun').text;
    const ends = sameEnd ? 'Όλα λήγουν {validRental}' : 'Λήγουν {validRental} (κλίμακα) και {validMun} (τέλος παρεπιδημούντων)';
    const body = `<div class="ey" style="letter-spacing:.05em;white-space:nowrap">${EY(f, 'Κράτα το · παράδειγμα {nightPrice} τη νύχτα, {rent} τον μήνα')}</div>
      <h2 style="font-size:76px">Τα όρια που περνάς<br><span class="kb">χωρίς να το δεις</span></h2>
      <div class="s6" style="margin-top:28px">${rungs.map(([v, t, c]) => `<div class="s6r" data-box><b class="num" style="color:${c}">${esc(V(f, v).text)}</b><span>${T(f, t)}</span></div>`).join('')}</div>
      <div class="s6d">${T(f, ends)}</div>
      <div class="lead" style="margin-top:16px;font-size:30px">${T(f, 'Δεν μετράμε τον χρόνο σου, ζημιές ή εγγυήσεις.')}</div>
      <div class="slot" style="height:96px;margin-top:8px"></div>`;
    out.push({ n: 6, title: 'Τα όρια που περνάς χωρίς να το δεις',
      html: frame(f, 6, N, body, `
        .s6{flex:none;display:flex;flex-direction:column;gap:8px}
        .s6r{display:grid;grid-template-columns:180px 1fr;column-gap:24px;align-items:center;padding:16px 28px;border-radius:20px;background:${K.lift}e6;border:1.5px solid ${K.rule}}
        .s6r b{font-size:44px;line-height:52px;font-weight:850;letter-spacing:-.02em;white-space:nowrap}
        .s6r span{font-size:28px;line-height:34px;font-weight:600;color:${K.ink}}
        .s6d{flex:none;margin-top:16px;font-family:'Roboto Mono',monospace;font-size:26px;line-height:32px;color:${K.muted};letter-spacing:.02em}`, footer(f, SRC.all)),
      sticker: { kind: 'Σύνδεσμος', text: 'Βάλε τους μήνες σου', url: 'https://properwise.gr/vraxyxronia-i-makroxronia?utm_source=instagram&utm_medium=story&utm_campaign=ig-dyo-dromoi', where: 'κάτω από τη γραμμή ειλικρίνειας' },
      alt: P(f, `Κάρτα για αποθήκευση, παράδειγμα με {nightPrice} τη νύχτα και {rent} τον μήνα. Κάθε νέο ευρώ με {margShort} από τη νύχτα {occ25.nights} χωρίς άλλα ενοίκια και με {occ35.marg} από τη νύχτα {occ35.nights}. Όριο πληρότητας {be11.ceil} αν λείψει ένας μήνας, {withEleni.be} με άλλα ενοίκια {withEleni.otherGross}. Τέλος παρεπιδημούντων {mun3.rate} από το {mun3.from} ακίνητο, {mun3.amount} στον τζίρο του παραδείγματος. Μηνιαίο ενοίκιο {rentNever} που το Airbnb δεν φτάνει ούτε γεμάτο. ${ends}.`) });
  }
  return out;
}

// ═══ ΤΟ ΕΞΩΦΥΛΛΟ: ΔΥΟ ΚΟΡΔΕΛΕΣ, ΚΑΝΕΝΑΣ ΑΡΙΘΜΟΣ ═══════════════════════════
/**
 * Λιλά πηγή που ανοίγει σε πέντε ρεύματα και πράσινη που τρέχει ως ένα, στην
 * ίδια κλίμακα (από τα γεγονότα, χωρίς να τυπώνονται). Όλα μέσα στο κεντρικό
 * 1080×1350 (4:5 του πλέγματος) και κατά συνέπεια και στο 1080×1440.
 */
export function coverHtml(f: Facts): string {
  // ΜΙΑ ΠΗΓΗ ΠΟΥ ΑΝΟΙΓΕΙ: ένας λευκός κόμβος στο x=90 (το ύψος της νύχτας) και από εκεί τα πέντε
  // ρεύματα ανοίγουν προς τα δεξιά. Η πράσινη κορδέλα έχει δικό της κόμβο στο ίδιο x.
  const price = num(f, 'nightPrice'), k = 360 / price, G = 34, NX = 90, NW = 20, X0 = NX + NW, X1 = 1080, mid = 600;
  let ys = 0, yt = 0;
  const hs = NIGHT.map(x => num(f, x.id) * k), Hr = 360 + G * 4, top = 790, lt = top + (Hr - 360) / 2;
  const links = NIGHT.map((x, i) => { const a = lt + ys + hs[i] / 2, b = top + yt + hs[i] / 2; ys += hs[i]; yt += hs[i] + G;
    return `<path d="M${X0} ${a.toFixed(1)} C${mid} ${a.toFixed(1)} ${mid + 80} ${b.toFixed(1)} ${X1} ${b.toFixed(1)}" stroke="${x.c}" stroke-width="${hs[i].toFixed(1)}" fill="none"${x.id === 'nightNet' ? ` style="filter:drop-shadow(0 0 22px ${K.other}aa)"` : ''}/>`; }).join('')
    + `<rect x="${NX}" y="${lt.toFixed(1)}" width="${NW}" height="360" rx="4" fill="${K.ink}"/>`;
  const g = num(f, 'tenantPerDay') * k, gy = top + Hr + 96;
  const html = `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${FACES}${MONO_FACES}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:1080px;height:1920px;overflow:hidden}
    body{position:relative;background:${K.ground};font-family:Inter,sans-serif;color:${K.ink};-webkit-font-smoothing:antialiased}
    .bg{position:absolute;inset:0;background:radial-gradient(900px 800px at 80% 30%, ${K.other}2b, transparent 70%),radial-gradient(900px 700px at 10% 85%, ${K.ok}14, transparent 70%),linear-gradient(180deg, ${K.panel} 0%, ${K.ground} 60%)}
    .k{position:absolute;left:90px;top:350px;font-family:'Roboto Mono',monospace;font-size:30px;letter-spacing:.12em;color:${K.muted}}
    h1{position:absolute;left:84px;top:410px;font-size:104px;line-height:1;font-weight:800;letter-spacing:-.05em;white-space:nowrap}
    h1 span{color:${K.other};text-shadow:0 20px 100px ${K.other}66}
    .cv{position:absolute;left:0;top:0}
    .lb{position:absolute;left:90px;font-family:'Roboto Mono',monospace;font-size:28px;letter-spacing:.1em}
    .br{position:absolute;left:90px;top:1500px;display:flex;align-items:center;gap:16px;font-size:34px;font-weight:800;letter-spacing:.08em}
  </style></head><body><div class="bg"></div>
    <div class="k">${esc(`${UP('ενοικιαστής')} Ή AIRBNB · ${UP('νύχτα, μέρα, μήνας')}`)}</div>
    <h1>Ίδιο διαμέρισμα,<br><span>δύο δρόμοι</span></h1>
    <svg class="cv" width="1080" height="1920" viewBox="0 0 1080 1920">${links}
      <path d="M${X0} ${(gy + g / 2).toFixed(1)} L${X1} ${(gy + g / 2).toFixed(1)}" stroke="${K.ok}" stroke-width="${g.toFixed(1)}" fill="none"/>
      <rect x="${NX}" y="${gy.toFixed(1)}" width="${NW}" height="${g.toFixed(1)}" rx="4" fill="${K.ink}"/></svg>
    <div class="lb" style="top:${top - 56}px;color:${K.other}">AIRBNB · ΜΙΑ ΝΥΧΤΑ</div>
    <div class="lb" style="top:${(gy - 50).toFixed(0)}px;color:${K.ok}">ΕΝΟΙΚΙΑΣΤΗΣ · ΜΙΑ ΜΕΡΑ</div>
    <div class="br">${mark(52, K.ink)}PROPERWISE</div>
  </body></html>`;
  // Το εξώφυλλο δεν γράφει κανέναν αριθμό: δεν γερνά μετά τη λήξη της κλίμακας.
  assertDigitsFromFacts('εξώφυλλο', html, {});
  return html;
}

// ═══ ΕΛΕΓΧΟΙ ΣΤΗ ΣΕΛΙΔΑ ═════════════════════════════════════════════════════
/**
 * Ζώνες, μέγεθος, αντίθεση, επικαλύψεις, κείμενο μέσα στην κάρτα του ([data-box]) και
 * χρώματα μόνο από το K, σε ό,τι κείμενο φαίνεται. `zone` = [πάνω, κάτω] όριο σε px.
 */
export async function pageQa(pg: Pg, where: string, zone: [number, number], side = 40): Promise<string[]> {
  const tokens = Object.entries(K).map(([n, h]) => [n, [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))]);
  const r = (await pg.evaluate(`(() => {
    const T = ${JSON.stringify(tokens)}, Z = ${JSON.stringify(zone)}, SIDE = ${side}, out = [];
    const rgb = s => { const m = String(s).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const v = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
    const near = c => Math.min(...T.map(([, t]) => Math.hypot(c.r - t[0], c.g - t[1], c.b - t[2])));
    const lum = c => { const f = x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
    const boxes = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('style,script,defs')) continue;
      const s = getComputedStyle(el);
      const svgShape = el instanceof SVGElement && /^(path|rect|circle|line|polyline|polygon|ellipse)$/i.test(el.tagName);
      const cols = [s.color, s.backgroundColor, ...(String(s.backgroundImage).match(/rgba?\\([^)]+\\)/g) || [])];
      if (s.borderTopStyle !== 'none' && parseFloat(s.borderTopWidth) > 0) cols.push(s.borderTopColor);
      if (svgShape) { if (s.fill !== 'none') cols.push(s.fill); if (s.stroke !== 'none') cols.push(s.stroke); }
      for (const v of cols) { const c = rgb(v); if (c && c.a > .02 && near(c) > 6) out.push('χρώμα ' + v + ' στο ' + (el.className && el.className.baseVal !== undefined ? el.tagName : el.className || el.tagName)); }
      const own = Array.from(el.childNodes).filter(n => n.nodeType === 3 && n.textContent.trim());
      if (!own.length) continue;
      let o = 1; for (let e = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); if (o < .5) continue;
      const rg = document.createRange(); let b = null;
      for (const n of own) { rg.selectNodeContents(n); const q = rg.getBoundingClientRect(); if (!q.width) continue; b = b ? { l: Math.min(b.l, q.left), t: Math.min(b.t, q.top), r: Math.max(b.r, q.right), b: Math.max(b.b, q.bottom) } : { l: q.left, t: q.top, r: q.right, b: q.bottom }; }
      if (!b) continue;
      const name = (el.textContent || '').trim().slice(0, 28);
      if (b.t < Z[0] - .5 || b.b > Z[1] + .5 || b.l < SIDE - .5 || b.r > 1080 - SIDE + .5) out.push('έξω από τη ζώνη: «' + name + '» [' + Math.round(b.l) + ',' + Math.round(b.t) + '–' + Math.round(b.r) + ',' + Math.round(b.b) + ']');
      const fs = parseFloat(s.fontSize); if (fs < 26) out.push('γράμματα ' + fs + 'px: «' + name + '»');
      let bg = null; for (let e = el; e && !bg; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c && c.a > .9) bg = c; }
      bg = bg || T.find(([n]) => n === 'ground')[1].reduce((a, v, i) => ({ ...a, [['r', 'g', 'b'][i]]: v }), {});
      const fg = rgb(s.color); if (fg && fg.a > 0) { const L1 = lum(fg), L2 = lum(bg), cr = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); if (cr < (fs >= 32 ? 3 : 4.5)) out.push('αντίθεση ' + cr.toFixed(2) + ': «' + name + '»'); }
      boxes.push({ el, b });
      // Κείμενο μέσα σε κάρτα ([data-box]) μένει μέσα της, με 2px αέρα (08/10: η σειρά 6 της κάρτας αποθήκευσης ξεχείλιζε).
      const box = el.closest('[data-box]');
      if (box) { const r = box.getBoundingClientRect(); if (b.l < r.left + 2 || b.r > r.right - 2 || b.t < r.top + 2 || b.b > r.bottom - 2) out.push('έξω από την κάρτα: «' + name + '» [' + Math.round(b.t) + '–' + Math.round(b.b) + ' σε ' + Math.round(r.top) + '–' + Math.round(r.bottom) + ']'); }
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], c = boxes[j]; if (a.el.contains(c.el) || c.el.contains(a.el)) continue;
      const w = Math.min(a.b.r, c.b.r) - Math.max(a.b.l, c.b.l), h = Math.min(a.b.b, c.b.b) - Math.max(a.b.t, c.b.t);
      if (w > 2 && h > 2) out.push('επικάλυψη «' + (a.el.textContent || '').trim().slice(0, 20) + '» με «' + (c.el.textContent || '').trim().slice(0, 20) + '»'); }
    return [...new Set(out)];
  })()`)) as string[];
  return r.map(x => `${where}: ${x}`);
}
