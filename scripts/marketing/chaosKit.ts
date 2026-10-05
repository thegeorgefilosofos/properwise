// ═══════════════════════════════════════════════════════════════════════════
// ΧΑΟΣ ΚΑΙ ΤΑΞΗ: ΤΑ ΕΠΤΑ ΧΑΡΤΙΑ ΤΟΥ ΙΔΙΟΚΤΗΤΗ ΚΟΥΜΠΩΝΟΥΝ ΣΕ ΜΙΑ ΛΙΣΤΑ
// ─────────────────────────────────────────────────────────────────────────
// Η αρχή του πρώτου reel, όπως τη βγάζει το reelSeires.ts proto. Επτά έγγραφα
// σκόρπια σε τρεις διαστάσεις (τα επτά είδη που διαβάζει η σάρωση) αιωρούνται,
// τέσσερις λέξεις περνούν από πάνω τους και στον χτύπο κουμπώνουν σε μία
// καθαρή λίστα. Γράφτηκε πρώτα στο reelTaxi.ts· εδώ ζει χωριστά, για να μπαίνει
// ως σκηνή στη μηχανή των σειρών με δικό της CSS και δικό της βήμα ανά καρέ.
//
// Κάθε είδος έχει τη δική του μορφή, όπως το ξέρει ο ιδιοκτήτης: ο λογαριασμός
// με τον γραμμωτό κώδικα, η απόδειξη με τη σκισμένη άκρη, το μισθωτήριο με τις
// υπογραφές. Τα ποσά είναι του ακινήτου επίδειξης. Κανένα λογότυπο, καμία
// επωνυμία αρχής ή εταιρείας: γενικά έγγραφα.
// ═══════════════════════════════════════════════════════════════════════════
import { DEMO_PROPERTY, demoExpenses } from '../../lib/demo/sample';
import { DOC_TYPES } from '../../lib/billing/documents';
import { C, esc, ico } from './igKit';
import { mask } from './reelKit';
import { S as DEMO, eur } from './rentFacts';

const EXP = (cat: string) => {
  const e = demoExpenses(DEMO.year).find(x => x.category === cat);
  if (!e) throw new Error(`Το ακίνητο επίδειξης δεν έχει δαπάνη «${cat}».`);
  return e;
};
const ddmm = (iso: string) => iso.split('-').reverse().join('.');
const PEA_SCALE = ['Α+', 'Α', 'Β+', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η'];
const PEA_COLORS = ['#1f9d55', '#38b26a', '#7cc25a', '#b6cf45', '#e3d23a', '#f0b43a', '#ec8a36', '#e2603a', '#cf3e3a'];
const RED = '#ef8f7f';
const stamp = (t: string, rot: number, pos: string) => `<span class="xstamp" style="${pos};transform:rotate(${rot}deg)">${esc(t)}</span>`;
const lines = (ws: number[]) => ws.map(w => `<i style="width:${w}%"></i>`).join('');
const svg = (d: string, c: string, px: number, sw = 2) =>
  `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${d.split('|').map(x => `<path d="${x}"/>`).join('')}</svg>`;
const DOC_ICON = 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z|M14 3v5h5|M9 13h6|M9 17h4';

const FACES: Record<string, { w: number; h: number; html: () => string }> = {
  bill: { w: 380, h: 540, html: () => `
    <div class="band">ΛΟΓΑΡΙΑΣΜΟΣ ΡΕΥΜΑΤΟΣ</div>
    <div class="pad"><div class="kv"><span>Έκδοση</span><b>${esc(ddmm(EXP('electricity').date))}</b></div><div class="kv"><span>Περίοδος</span><b>2 μήνες</b></div>
    ${lines([92, 70, 84])}<div class="due"><span>ΠΟΣΟ ΠΛΗΡΩΜΗΣ</span><b>${esc(eur(EXP('electricity').amount))}</b></div><div class="bar"></div></div>
    ${stamp('ΛΗΓΕΙ', -12, 'right:30px;top:172px')}` },
  payment: { w: 250, h: 560, html: () => `
    <div class="rc"><div class="c">ΑΠΟΔΕΙΞΗ</div><div class="c s">ΠΑΡΟΧΗΣ ΥΠΗΡΕΣΙΩΝ</div><hr>
    <div class="l"><span>ΥΔΡΑΥΛΙΚΟΣ</span></div><div class="l"><span>ΜΠΑΤΑΡΙΑ ΜΠΑΝΙΟΥ</span></div><div class="l"><span>ΕΡΓΑΣΙΑ</span></div><hr>
    <div class="l t"><span>ΣΥΝΟΛΟ</span><b>${esc(eur(EXP('plumber').amount))}</b></div><div class="c s">${esc(ddmm(EXP('plumber').date))}</div><div class="bar sm"></div></div>` },
  lease: { w: 380, h: 520, html: () => `
    <div class="pad"><div class="ttl2">ΜΙΣΘΩΤΗΡΙΟ</div><div class="c s">ΚΑΤΟΙΚΙΑΣ</div>
    <div class="art">ΑΡΘΡΟ 1</div>${lines([96, 90, 94, 60])}<div class="art">ΑΡΘΡΟ 2</div>${lines([92, 88, 70])}
    <div class="sig"><span>Εκμισθωτής</span><span>Μισθωτής</span></div></div>` },
  deed: { w: 370, h: 520, html: () => `
    <div class="pad"><div class="ttl2" style="font-size:24px">ΣΥΜΒΟΛΑΙΟ</div><div class="c s">ΑΓΟΡΑΠΩΛΗΣΙΑΣ ΑΚΙΝΗΤΟΥ</div>
    ${lines([96, 92, 95, 88, 94, 70, 90, 84])}<span class="seal">ΑΚΡΙΒΕΣ<br>ΑΝΤΙΓΡΑΦΟ</span></div>` },
  insurance: { w: 440, h: 310, html: () => `
    <div class="band" style="background:#233a5e">ΑΣΦΑΛΙΣΤΗΡΙΟ ΚΑΤΟΙΚΙΑΣ</div>
    <div class="pad"><div class="cov"><span>✓ Πυρκαγιά</span><span>✓ Σεισμός</span><span>✓ Θραύση κρυστάλλων</span></div>
    <div class="due"><span>ΕΤΗΣΙΟ ΑΣΦΑΛΙΣΤΡΟ</span><b>${esc(eur(EXP('insurance').amount))}</b></div></div>
    ${stamp('ΑΝΑΝΕΩΣΗ', 9, 'right:22px;top:92px')}` },
  tax: { w: 390, h: 500, html: () => `
    <div class="pad"><div class="ttl2" style="font-size:24px">ΕΚΚΑΘΑΡΙΣΤΙΚΟ ΕΝΦΙΑ</div><div class="c s">ΕΤΟΣ ${DEMO.year}</div>
    <div class="grid">${Array.from({ length: 12 }, () => '<i></i>').join('')}</div>
    <div class="due"><span>ΠΟΣΟ ΦΟΡΟΥ</span><b>${esc(eur(EXP('enfia').amount))}</b></div></div>
    ${stamp('ΕΚΚΡΕΜΕΙ', -8, 'left:24px;bottom:120px')}` },
  government: { w: 360, h: 520, html: () => `
    <div class="pad"><div class="ttl2" style="font-size:22px;line-height:1.15">ΠΙΣΤΟΠΟΙΗΤΙΚΟ ΕΝΕΡΓΕΙΑΚΗΣ ΑΠΟΔΟΣΗΣ</div>
    <div class="pea">${PEA_SCALE.map((c, i) => `<span style="width:${34 + i * 7}%;background:${PEA_COLORS[i]}${c === DEMO_PROPERTY.energyClass ? ';outline:3px solid #1a2332;outline-offset:2px' : ''}">${esc(c)}</span>`).join('')}</div>
    <div class="qr"></div></div>` },
};

/** Οι χρόνοι της σκηνής, από την αρχή της. */
export const CHAOS_T = { words: [0, .5, 1.0, 1.5], scatter: 2.0, snap: 2.6 } as const;
/** Πού κάθεται η λίστα: πρώτη γραμμή και βήμα. */
const LIST = { x: 90, y: 690, step: 96, w: 850, h: 84 };

export function chaosParts(hook: string[], kicker: string) {
  if (!PEA_SCALE.includes(DEMO_PROPERTY.energyClass)) throw new Error('Άγνωστη ενεργειακή κλάση στο ακίνητο επίδειξης.');
  const docs = DOC_TYPES.filter(d => d.id !== 'other');
  if (docs.length !== 7) throw new Error(`Το χάος έχει επτά χαρτιά· η σάρωση ξέρει ${docs.length} είδη.`);
  if (docs.some(d => !FACES[d.id])) throw new Error('Λείπει μορφή εγγράφου για κάποιο είδος της σάρωσης.');
  if (hook.length !== CHAOS_T.words.length + 1) throw new Error('Μία λέξη του αγκιστριού για κάθε χτύπο και μία για το σκόρπισμα.');
  // Θέση (x, y), βάθος z, γωνίες X, Y, Z. Κάθε έγγραφο στη δική του ζώνη· ο
  // λογαριασμός μπροστά αριστερά, με το ποσό του ακάλυπτο.
  const chaos = [
    [70, 600, 90, 8, -16, -8], [660, 540, -240, -10, 22, 12], [620, 940, 30, 6, -14, 7], [150, 1020, -380, -8, 16, -6],
    [380, 1240, 200, 12, 10, -5], [-90, 1370, 280, -6, 24, 13], [730, 1440, -130, 10, -20, -12],
  ].map((c, i) => [...c, FACES[docs[i].id].w, FACES[docs[i].id].h]);

  const css = `
  #hxdesk{position:absolute;inset:0;perspective:1500px;perspective-origin:50% 55%}
  #hxcam{position:absolute;inset:0;transform-style:preserve-3d}
  .xc{position:absolute;left:0;top:0;will-change:transform}
  .xd{position:absolute;inset:0;border-radius:14px;overflow:hidden;color:#1a2332;
    background:linear-gradient(160deg,#ffffff 0%,#f1f4f8 55%,#e6ebf2 100%);box-shadow:0 50px 90px -30px #000000d0,0 12px 24px -12px #00000080}
  .xd .pad{padding:26px 26px}
  .xd .band{background:#1a2c48;color:#e9eef6;font-family:'Roboto Mono',monospace;font-size:15px;padding:16px 26px;letter-spacing:.16em}
  .xd i{display:block;height:9px;border-radius:5px;background:#d3dae4;margin-top:12px}
  .xd .kv{display:flex;justify-content:space-between;font-size:17px;color:#566274;margin-top:8px}
  .xd .kv b{color:#1a2332}
  .xd .due{display:flex;justify-content:space-between;align-items:flex-end;margin-top:26px;padding-top:16px;border-top:2px solid #1a2332}
  .xd .due span{font-family:'Roboto Mono',monospace;font-size:13px;color:#566274}
  .xd .due b{font-size:40px;font-weight:850;letter-spacing:-.04em}
  .xd .bar{height:46px;margin-top:22px;background:repeating-linear-gradient(90deg,#1a2332 0 3px,transparent 3px 5px,#1a2332 5px 6px,transparent 6px 10px,#1a2332 10px 14px,transparent 14px 16px)}
  .xd .bar.sm{height:34px;margin-top:16px}
  .xd .ttl2{font-size:28px;font-weight:850;letter-spacing:.06em;text-align:center}
  .xd .c{text-align:center}
  .xd .s{font-family:'Roboto Mono',monospace;font-size:13px;color:#566274;margin-top:6px;letter-spacing:.12em}
  .xd .art{font-family:'Roboto Mono',monospace;font-size:12px;color:#566274;margin-top:20px}
  .xd .sig{display:flex;justify-content:space-between;margin-top:38px;font-size:14px;color:#566274}
  .xd .sig span{width:44%;border-top:1.5px solid #1a2332;padding-top:8px;text-align:center}
  .xd .seal{position:absolute;right:30px;bottom:30px;width:118px;height:118px;border-radius:50%;border:3px solid #3f6fc9;color:#3f6fc9;font-family:'Roboto Mono',monospace;
    display:flex;align-items:center;justify-content:center;text-align:center;font-size:12px;line-height:1.3;transform:rotate(-14deg);box-shadow:inset 0 0 0 6px #fff,inset 0 0 0 8px #3f6fc9}
  .xd .cov{display:flex;flex-direction:column;gap:8px;font-size:18px;font-weight:600}
  .xd .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:22px}
  .xd .grid i{margin:0;height:26px;border-radius:4px;background:#e1e6ed}
  .xd .pea{display:flex;flex-direction:column;gap:5px;margin-top:22px}
  .xd .pea span{display:block;height:26px;border-radius:0 13px 13px 0;color:#fff;font-size:15px;font-weight:800;padding-left:10px;line-height:26px}
  .xd .qr{position:absolute;right:26px;bottom:26px;width:74px;height:74px;background:conic-gradient(#1a2332 25%,transparent 0 50%,#1a2332 0 75%,transparent 0) 0 0/18px 18px;border:6px solid #1a2332}
  .xd .rc{padding:22px 18px;font-family:'Roboto Mono',monospace;font-size:13px;color:#1a2332;letter-spacing:.06em}
  .xd .rc hr{border:0;border-top:2px dashed #9aa6b6;margin:14px 0}
  .xd .rc .l{display:flex;justify-content:space-between;margin-top:9px}
  .xd .rc .t{font-weight:800;font-size:16px}
  .xd.torn{border-radius:6px 6px 0 0;-webkit-mask:linear-gradient(#000 0 0) top/100% calc(100% - 12px) no-repeat,conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) bottom/20px 12px repeat-x}
  .xstamp{position:absolute;padding:8px 14px;border:3px solid ${RED};color:${RED};border-radius:8px;font-family:'Roboto Mono',monospace;font-size:18px;font-weight:700;letter-spacing:.16em;background:#ffffffb0;mix-blend-mode:multiply}
  .xr{position:absolute;inset:0;display:flex;align-items:center;gap:22px;padding:0 26px;border-radius:20px;background:linear-gradient(180deg,${C.lift},${C.panel});
    border:1.5px solid ${C.rule};font-size:32px;font-weight:700;letter-spacing:-.015em;color:${C.ink}}
  .xr .ic{width:52px;height:52px;border-radius:14px;background:${C.ground};border:1.5px solid ${C.rule};display:flex;align-items:center;justify-content:center;flex:none}
  .xr .xok{margin-left:auto}
  #hxsweep{position:absolute;left:${LIST.x}px;top:${LIST.y}px;width:${LIST.w}px;height:${6 * LIST.step + LIST.h}px;overflow:hidden;pointer-events:none;border-radius:20px}
  #hxsweep i{position:absolute;top:-200px;width:240px;height:1100px;background:linear-gradient(90deg,transparent,#ffffff30,transparent);transform:rotate(18deg)}
  .xkick{font-family:'Roboto Mono',monospace;font-size:24px;letter-spacing:.14em;color:${C.muted};display:flex;align-items:center;gap:16px}
  .xkick i{display:block;width:44px;height:3px;border-radius:3px;background:${C.accent}}
  .xhk{font-size:112px;font-weight:850;letter-spacing:-.05em;line-height:1.03;white-space:nowrap}
  .xw{position:absolute;left:0;top:0;will-change:transform,filter,opacity}`;

  const html = () => `
    <div id="hxdesk"><div id="hxcam">
    ${docs.map((d, i) => `<div class="xc" id="hxcd${i}">
      <div class="xd deco${d.id === 'payment' ? ' torn' : ''}" id="hxpf${i}">${FACES[d.id].html()}</div>
      <div class="xr" id="hxrf${i}" style="opacity:0"><span class="ic">${svg(DOC_ICON, C.accent, 28)}</span><span>${esc(d.label)}</span><span class="xok" id="hxok${i}">${ico.check(C.ok, 34)}</span></div>
    </div>`).join('')}
    </div></div>
    <div id="hxsweep" class="deco"><i id="hxswi"></i></div>
    <div class="L xkick" id="hxk0" style="top:380px"><i></i>${esc(kicker)}</div>
    <div style="position:absolute;left:90px;top:425px;width:900px;height:130px">
      ${[...hook].map((w, i) => `<div class="xhk xw" id="hxw${i}">${esc(w)}</div>`).join('')}
      <div style="position:absolute;left:0;top:0">${mask('hxo1', 'Ένα μέρος', 'xhk')}</div>
    </div>
    <div class="L" style="top:540px">${mask('hxo2', `<span class="acc">για όλα.</span>`, 'xhk')}</div>`;

  /** Το βήμα ανά καρέ. `a` η αρχή της σκηνής, `b` το τέλος της. */
  const js = (a: number, b: number) => `t => {
    if (t < ${a} || t >= ${b}) return;
    const W0 = [${[...CHAOS_T.words, CHAOS_T.scatter].map(w => `${a} + ${w}`).join(', ')}], SN = ${a} + ${CHAOS_T.snap};
    // Οι λέξεις: μπαίνουν από θολό σε καθαρό και φεύγουν πριν μπει η επόμενη.
    W0.forEach((s, i) => {
      const el = $('hxw' + i), a = i === 0 ? 1 : eo(p(t, s, s + .4));
      const nx = i < W0.length - 1 ? W0[i + 1] : SN;
      const z = ei(p(t, nx - .26, nx - .04));
      op(el, a * (1 - z)); el.style.filter = 'blur(' + ((1 - a) * 16 + z * 12) + 'px)';
      tf(el, 'translateY(' + ((1 - a) * 22 - z * 18) + 'px) scale(' + (1.07 - .07 * a) + ')');
    });
    op($('hxk0'), 1 - eo(p(t, SN - .2, SN + .1)));
    rev('hxo1', SN + .15, null, .55); rev('hxo2', SN + .28, null, .55);
    // Η κάμερα πλησιάζει αργά το χάος· στο κούμπωμα γυρίζει ίσια.
    const all = eio(p(t, SN, SN + .7));
    tf($('hxcam'), 'translateZ(' + (140 * p(t, ${a}, SN) * (1 - all)) + 'px) rotateZ(' + (Math.sin(t * .5) * 1.2 * (1 - all)) + 'deg)');
    ${JSON.stringify(chaos)}.forEach(([x, y, z, rx, ry, rz, w, h], i) => {
      const k = spring(p(t, SN + i * .05, SN + .85 + i * .05)), u = 1 - k;
      const fx = Math.sin(t * .8 + i * 1.7) * 16, fy = Math.cos(t * .6 + i * 1.3) * 14;
      const frx = Math.sin(t * .5 + i) * 6, fry = Math.cos(t * .45 + i * 2) * 7, frz = Math.sin(t * .4 + i * 3) * 4;
      const el = $('hxcd' + i);
      el.style.width = lerp(w, ${LIST.w}, k) + 'px'; el.style.height = lerp(h, ${LIST.h}, k) + 'px';
      tf(el, 'translate3d(' + (lerp(x, ${LIST.x}, k) + fx * u) + 'px,' + (lerp(y, ${LIST.y} + i * ${LIST.step}, k) + fy * u) + 'px,' + (z * u) + 'px)' +
        ' rotateX(' + (rx + frx) * u + 'deg) rotateY(' + (ry + fry) * u + 'deg) rotateZ(' + (rz + frz) * u + 'deg)');
      // Βάθος πεδίου: ό,τι είναι πολύ μακριά ή πολύ κοντά θολώνει λίγο.
      const bl = Math.max(0, Math.abs(z - 40) - 120) / 90 * u, f = eo(p(k, .2, .6));
      $('hxpf' + i).style.filter = bl > .05 ? 'blur(' + bl.toFixed(2) + 'px)' : 'none';
      op($('hxpf' + i), 1 - f); op($('hxrf' + i), f);
      const o = spring(p(t, SN + .55 + i * .06, SN + 1.2 + i * .06));
      op($('hxok' + i), cl(o * 1.5)); tf($('hxok' + i), 'scale(' + (.4 + .6 * o) + ')');
    });
    // Μια λάμψη περνά πάνω από τη λίστα μόλις μπει σε τάξη.
    const sw = eio(p(t, SN + 1.05, SN + 1.65));
    op($('hxsweep'), t > SN + 1 && t < SN + 1.7 ? 1 : 0);
    $('hxswi').style.left = (-300 + 1300 * sw) + 'px';
  }`;

  return { css, html, js };
}
