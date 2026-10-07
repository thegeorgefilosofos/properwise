// ═══════════════════════════════════════════════════════════════════════════
// REEL · «ΠΟΥ ΠΗΓΑΝ ΤΑ ΕΝΟΙΚΙΑ;» — ΤΟ CAROUSEL ΤΟΥ ΚΑΘΑΡΟΥ ΣΕ ΚΙΝΗΣΗ
// ─────────────────────────────────────────────────────────────────────────
// ΧΡΗΣΗ:  npx tsx scripts/marketing/reelKathara.ts   (FFMPEG με libx264)
//         REEL_PREVIEW=1,5,9 → μόνο στιγμιότυπα.
//
// Το carousel «Πού πήγαν τα …;» (carousel.ts) ως reel ενός λεπτού: το
// αγκίστρι με τα δύο ποσά, ο φόρος στα έσοδα, τα έξοδα που δεν μετράνε, ο
// καταρράκτης, τα 100€ που κόβονται, η εφαρμογή, η ερώτηση.
//
// ΜΙΑ ΓΡΑΜΜΑΤΙΚΗ ΚΙΝΗΣΗΣ. Κάθε είσοδος γραφικού ή κειμένου: εκθετική έξοδος,
// μισό δευτερόλεπτο. Ελατήριο ΜΟΝΟ σε ό,τι έχει βάρος (απόδειξη, χαρτονόμισμα,
// κινητό). Βαρύτητα μόνο σε ό,τι πέφτει. Τα κεφάλαια αλλάζουν με το πέρασμα
// του κιτ· το κομμάτι που «μένει στην τσέπη» περνά το πέρασμα ακέραιο και
// γίνεται το μπλε κομμάτι της μπάρας στο κινητό.
//
// ΤΑ ΧΡΩΜΑΤΑ ΕΙΝΑΙ ΤΟΥ CAROUSEL: ενοίκιο σχιστόλιθος, φόρος σομόν, ΕΝΦΙΑ
// κεχριμπάρι, έξοδα λιλά, καθαρά το μπλε της μάρκας (rentFacts.SEG).
//
// ΚΑΝΕΝΑ ΝΟΥΜΕΡΟ ΜΕ ΤΟ ΧΕΡΙ. Όλα από το ακίνητο επίδειξης μέσα από την
// incomeStatement (rentFacts.ts), ίδια με το carousel. Ότι τα έξοδα δεν
// αλλάζουν τον φόρο δεν το λέμε απλώς: το ξαναϋπολογίζουμε χωρίς αυτά.
// ═══════════════════════════════════════════════════════════════════════════
import { PLANS } from '../../lib/billing/plans';
import { ASSISTANT_ACC } from '../../lib/assistant/identity';
import { DEMO_PROPERTY } from '../../lib/demo/sample';
import { incomeStatement } from '../../lib/accounting/statement';
import { fe, feWhole, fpRate } from '../../lib/core/format';
import { C, esc, mark, GRAIN } from './igKit';
import { BEAT, A, head, make, type Explainer } from './explainerKit';
import {
  S, GROSS, PRESUMPTIVE, TAXABLE, TAX, ENFIA, OTHER, NET, RATE, PRES, TAXED_SHARE, PROP_SPOKEN, UP, LOST,
  eur, TOP, REST, REST_SUM, P_TAX, P_ENFIA, P_OTHER, P_NET, SEG, PARTS, BR,
} from './rentFacts';

// ── Τα γεγονότα ──────────────────────────────────────────────────────────
const cents = (x: number) => Math.round(x * 100) / 100;
const L1 = cents(GROSS - TAX), L2 = cents(L1 - ENFIA);
if (Math.abs(L2 - OTHER - NET) > .01) throw new Error('Ο καταρράκτης δεν καταλήγει στα καθαρά.');
// Τα έξοδα δεν αγγίζουν τον φόρο: ίδια κατάσταση, μία φορά με τα έξοδα και μία χωρίς.
const taxOf = (enfia: number, other: number) => {
  const l = incomeStatement({ regime: 'individual_longterm', grossIncome: GROSS, enfia, otherCashExpenses: other, brackets: BR })
    .lines.find(x => x.key === 'incomeTax');
  if (!l) throw new Error('Η κατάσταση δεν έχει γραμμή φόρου.');
  return l.amount;
};
const CUT = cents(taxOf(0, 0) - taxOf(ENFIA, OTHER));
if (CUT !== 0) throw new Error('Τα έξοδα αλλάζουν πια τον φόρο· η σκηνή των αποδείξεων λέει το αντίθετο.');
if (Math.abs(taxOf(ENFIA, OTHER) - TAX) > .01) throw new Error('Ο φόρος του reel δεν είναι ο φόρος του carousel.');
const FREE = PLANS.free;
if (FREE.priceMonthly !== 0) throw new Error('Η κάρτα λέει «δωρεάν»· το PLANS.free έχει τιμή.');
const FREE_WORDS = FREE.maxProperties === 1 ? 'για ένα ακίνητο' : `έως ${FREE.maxProperties} ακίνητα`;
const DEMO_NOTE = `Παράδειγμα με δεδομένα επίδειξης · φυσικό πρόσωπο · μακροχρόνια μίσθωση · ${S.year}`;
// Η μονάδα της σκηνής 5: το χαρτονόμισμα. Τα μερίδια είναι ακέραια ευρώ μόνο γιατί αθροίζουν σε 100.
const UNIT = 100;
if (P_TAX + P_ENFIA + P_OTHER + P_NET !== UNIT) throw new Error('Τα μερίδια δεν αθροίζουν σε ένα χαρτονόμισμα.');
const PCT = (n: number) => fpRate(n);
const NEG = (n: number) => `−${eur(n)}`;

// ── Ο χρόνος ─────────────────────────────────────────────────────────────
const SC = [0, 10, 24, 39, 51, 63, 78].map(b => b * BEAT);
const END = 84 * BEAT, DUR = 89 * BEAT;

// ── Μετρητές: κάθε ενδιάμεση τιμή μορφοποιείται εδώ, με τη μορφή της εφαρμογής ──
const STEPS = 24;
const run = (a: number, b: number, fmt: (n: number) => string = eur) =>
  Array.from({ length: STEPS + 1 }, (_, s) => fmt(cents(a + (b - a) * s / STEPS)));
const pctRun = (a: number, b: number) => Array.from({ length: STEPS + 1 }, (_, s) => PCT(Math.round(a + (b - a) * s / STEPS)));

// ── Χρώματα ──────────────────────────────────────────────────────────────
const SLATE = '#3f5679';          // το ενοίκιο, πριν μοιραστεί
const LIGHT = '#6f8db8';          // το φορολογητέο
const RED = '#c83a3a';            // μελάνι σφραγίδας πάνω σε χαρτί

// ═══ 1 · ΤΟ ΑΓΚΙΣΤΡΙ ══════════════════════════════════════════════════════
const HB_W = 850, HB_GAP = 6;
const hbw = (v: number) => (HB_W - HB_GAP * (PARTS.length - 1)) * v / GROSS;
const LOST_W = PARTS.slice(0, 3).reduce((s, x) => s + hbw(x.v), 0) + 2 * HB_GAP;
if (PARTS[3].k !== 'net') throw new Error('Τα καθαρά δεν είναι πια το τελευταίο κομμάτι της μπάρας.');
const LV = [GROSS, L1, L2, NET];
const PV = [UNIT, UNIT - P_TAX, UNIT - P_TAX - P_ENFIA, P_NET];
const HOOK_N = LV.slice(0, 3).map((a, k) => run(a, LV[k + 1], n => `${eur(n)}.`));
const HOOK_P = PV.slice(0, 3).map((a, k) => pctRun(a, PV[k + 1]));
const DROP = [.55, 1.05, 1.5];
const HIT_Q = 2.5;

// ═══ 2 · Ο ΦΟΡΟΣ: εκατό τετράγωνα ═══════════════════════════════════════
const TILES = 100;
const EXEMPT = Math.round(PRESUMPTIVE / GROSS * TILES);
if (Math.abs(EXEMPT - PRESUMPTIVE / GROSS * TILES) > 1e-9) throw new Error('Η σταθερή έκπτωση δεν είναι ακέραιο πλήθος τετραγώνων.');
const TAXABLE_PCT = TILES - EXEMPT;
const LEDGER: [string, string, string][] = [
  ['Έσοδα από ενοίκια', eur(GROSS), ''],
  [`Σταθερή έκπτωση ${PRES}`, NEG(PRESUMPTIVE), ''],
  ['Φορολογητέο εισόδημα', eur(TAXABLE), ''],
  [`Φόρος εισοδήματος ${RATE}`, NEG(TAX), SEG.tax],
];
const TAX_RUN = run(0, TAX, n => (n ? NEG(n) : eur(0)));

// ═══ 3 · ΤΑ ΕΞΟΔΑ: τέσσερις αποδείξεις ═══════════════════════════════════
interface Receipt { head: string; lines: [string, number][]; total: number; left: number; top: number; rot: number }
const RC: Receipt[] = [
  { head: 'ΕΝΦΙΑ', lines: [['Φόρος ακινήτου', ENFIA]], total: ENFIA, left: 96, top: 868, rot: -3 },
  { head: 'ΑΠΟΔΕΙΞΗ', lines: [[TOP[0].label, TOP[0].amount]], total: TOP[0].amount, left: 552, top: 852, rot: 2.4 },
  { head: 'ΑΠΟΔΕΙΞΗ', lines: [[TOP[1].label, TOP[1].amount]], total: TOP[1].amount, left: 110, top: 1112, rot: 2 },
  { head: `ΑΛΛΕΣ ${REST.length} ΔΑΠΑΝΕΣ`, lines: REST.map(r => [r.label, r.amount] as [string, number]), total: REST_SUM, left: 546, top: 1062, rot: -1.6 },
];
if (Math.abs(RC.reduce((s, r) => s + r.total, 0) - ENFIA - OTHER) > .01) throw new Error('Οι αποδείξεις δεν αθροίζουν στα έξοδα της χρονιάς.');
const RC_W = 392, CONTACT = 836;
const RC_T = RC.map((_, k) => .9 + k * .85);
const HIT_ZERO = 5.0;

// ═══ 4 · Ο ΚΑΤΑΡΡΑΚΤΗΣ ═══════════════════════════════════════════════════
const WF = { top: 60, base: 640, colW: 124 };
const PITCH = (850 - WF.colW) / 4;
const wy = (v: number) => WF.base - (WF.base - WF.top) * v / GROSS;
const WB = [
  { k: 'ΕΝΟΙΚΙΑ', lo: 0, hi: GROSS, c: SLATE, val: run(0, GROSS), pc: PCT(UNIT), up: true },
  { k: 'ΦΟΡΟΣ', lo: L1, hi: GROSS, c: SEG.tax, val: run(0, TAX, n => (n ? NEG(n) : eur(0))), pc: `−${PCT(P_TAX)}`, up: false },
  { k: 'ΕΝΦΙΑ', lo: L2, hi: L1, c: SEG.enfia, val: run(0, ENFIA, n => (n ? NEG(n) : eur(0))), pc: `−${PCT(P_ENFIA)}`, up: false },
  { k: 'ΕΞΟΔΑ', lo: NET, hi: L2, c: SEG.other, val: run(0, OTHER, n => (n ? NEG(n) : eur(0))), pc: `−${PCT(P_OTHER)}`, up: false },
  { k: 'ΚΑΘΑΡΑ', lo: 0, hi: NET, c: C.accent, val: run(0, NET), pc: PCT(P_NET), up: true },
];
const WF_T = [.6, 1.45, 2.1, 2.75, 3.5];

// ═══ 5 · ΑΠΟ ΚΑΘΕ 100€: το χαρτονόμισμα κόβεται ══════════════════════════
// ΣΧΕΔΙΑΣΜΕΝΟ ΝΑ ΑΝΑΓΝΩΡΙΖΕΤΑΙ, ΟΧΙ ΑΝΤΙΓΡΑΦΟ (όπως στο reelTrapeza): χρώμα και
// αναλογίες του πράσινου χαρτονομίσματος, κύκλος με δώδεκα αστέρια, αψίδα,
// ολογραφική λωρίδα. Κανένα πραγματικό σχέδιο, υπογραφή ή αριθμός σειράς.
const STARS = Array.from({ length: 12 }, (_, k) => {
  const a = (k / 12) * Math.PI * 2 - Math.PI / 2, cx = 50 + 36 * Math.cos(a), cy = 50 + 36 * Math.sin(a);
  const pts = Array.from({ length: 10 }, (_, j) => { const r = j % 2 ? 2.6 : 6.4, b = (j / 10) * Math.PI * 2 - Math.PI / 2; return `${Math.round((cx + r * Math.cos(b)) * 100) / 100},${Math.round((cy + r * Math.sin(b)) * 100) / 100}`; });
  return `<polygon points="${pts.join(' ')}"/>`;
}).join('');
const NOTE_W = 760, NOTE_SC = NOTE_W / 470, NOTE_H = Math.round(252 * NOTE_SC);
const note = (id: string) => `
  <div class="eur" id="${id}">
    <div class="gl"></div><div class="ros"></div>
    <svg class="arch" viewBox="0 0 220 180"><g fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3">
      <path d="M30 172V78a80 80 0 0 1 160 0v94"/><path d="M58 172V86a52 52 0 0 1 104 0v86"/><path d="M14 172h192M20 160h180"/>
      <path d="M110 6v22M78 14l8 20M142 14l-8 20"/></g></svg>
    <svg class="stars" viewBox="0 0 100 100"><g fill="#f7e27a">${STARS}</g></svg>
    <div class="holo"></div><div class="wm"></div>
    <span class="dn tl">${UNIT}</span><span class="dn br">${UNIT}</span>
    <span class="cur">EURO · ΕΥΡΩ</span>
  </div>`;
const CUM = PARTS.reduce<number[]>((a, x) => [...a, a[a.length - 1] + x.p / UNIT], [0]);
const N_DX = [-40, -24, -8, 24], N_DY = [36, 36, 36, -12], N_ROT = [0, 0, 0, 0];
const HIT_NET = 2.9;
// Η παράδοση: το κομμάτι των καθαρών βγαίνει από τη σκηνή 5 και πετά στο κινητό.
const HAND = SC[5] - .5, LAND = SC[5] + 1.05;

// ═══ 6 · Η ΕΦΑΡΜΟΓΗ ══════════════════════════════════════════════════════
const FEATS = ['Σάρωση λογαριασμών', 'Φόρος και ΕΝΦΙΑ', 'Φάκελος για τον λογιστή', `Ρώτα ${ASSISTANT_ACC}`];
const APP_ROWS: [string, string][] = [
  ['Ενοίκια', eur(GROSS)],
  ['Φόρος και ΕΝΦΙΑ', NEG(TAX + ENFIA)],
  ['Επισκευές και έξοδα', NEG(OTHER)],
];

const HTML = `
  <!-- 1 · Το αγκίστρι: ορατό από το πρώτο καρέ -->
  <section id="s0">
    <div class="L eb mono" id="e0" style="top:320px"><i></i>ΠΑΡΑΔΕΙΓΜΑ · ${esc(UP(PROP_SPOKEN))}</div>
    <div class="L hd" style="top:380px;font-size:96px">
      <div class="mk"><div class="mi" id="q0">${esc(eur(GROSS))} ενοίκια.</div></div>
      <div class="mk"><div class="mi" id="q1">Σου μένουν</div></div>
      <div class="mk"><div class="mi" id="q2"><span class="a" id="hn">${esc(HOOK_N[0][0])}</span></div></div>
    </div>
    <div class="L row" id="hlr" style="top:822px;width:${HB_W}px"><span class="lbl">ΤΟ ΕΝΟΙΚΙΟ ΤΗΣ ΧΡΟΝΙΑΣ</span><span class="lbl" id="hp">${PCT(UNIT)}</span></div>
    <div class="hb" id="hb" style="top:858px">${PARTS.map((x, k) => `<div class="hs" style="width:${hbw(x.v)}px"><i class="gh" id="hg${k}"></i><i class="fl" id="hf${k}"></i></div>`).join('')}</div>
    <div class="bk deco" id="hbk" style="top:972px;width:${LOST_W}px"></div>
    <div class="L qq" style="top:1062px">
      <div class="mk"><div class="mi" id="q3">Πού πήγαν</div></div>
      <div class="mk"><div class="mi" id="q4">τα <b>${esc(eur(LOST))}</b>;</div></div>
    </div>
  </section>

  <!-- 2 · Ο φόρος βλέπει τα έσοδα -->
  <section id="s1">
    ${head(1, 'Ο ΦΟΡΟΣ', ['Ο φόρος βλέπει', 'τα έσοδα,', A('όχι τα καθαρά.')], 88)}
    <div class="L lbl" id="tl" style="top:654px">ΚΑΘΕ ΤΕΤΡΑΓΩΝΟ: ${PCT(UNIT / TILES)} ΤΟΥ ΕΝΟΙΚΙΟΥ</div>
    <div class="tg" id="tg">${Array.from({ length: TILES }, (_, i) => `<i id="t${i}"></i>`).join('')}</div>
    ${[
      { id: 'lg0', top: 692, sw: `background:${SEG.tax}`, n: PCT(P_TAX), t: `ΦΟΡΟΣ · ${RATE} ΤΟΥ ΦΟΡΟΛΟΓΗΤΕΟΥ` },
      { id: 'lg1', top: 898, sw: `background:${LIGHT}`, n: TAXED_SHARE, t: 'ΦΟΡΟΛΟΓΗΤΕΟ' },
      { id: 'lg2', top: 1096, sw: `outline:2px dashed ${C.muted};outline-offset:-2px`, n: PRES, t: 'ΣΤΑΘΕΡΗ ΕΚΠΤΩΣΗ' },
    ].map(l => `<div class="lg" id="${l.id}" style="top:${l.top}px"><i class="tk"></i><i class="sw" style="${l.sw}"></i><div><b>${esc(l.n)}</b><span class="lbl">${esc(l.t)}</span></div></div>`).join('')}
    <div class="card ledger" id="ld" style="top:1180px">
      ${LEDGER.map(([k, v, c], i) => `<div class="lr" id="lr${i}"${c ? ` style="color:${C.ink}"` : ''}><span>${c ? `<i class="dot" style="background:${c}"></i>` : ''}${esc(k)}</span><b${i === 3 ? ' id="ltx"' : ''}${c ? ` style="color:${c}"` : ''}>${esc(v)}</b></div>`).join('')}
    </div>
  </section>

  <!-- 3 · Τα έξοδα δεν μειώνουν τον φόρο -->
  <section id="s2">
    ${head(2, 'ΤΑ ΕΞΟΔΑ', ['Τα έξοδα', 'δεν μειώνουν', A('τον φόρο.')], 96)}
    <div class="card taxc" id="tc" style="top:690px">
      <div class="row"><span class="lbl">ΦΟΡΟΣ ΕΙΣΟΔΗΜΑΤΟΣ · ΜΕ ΣΤΑΘΕΡΗ ΕΚΠΤΩΣΗ ${esc(PRES)}</span><b style="color:${SEG.tax}">${esc(eur(TAX))}</b></div>
      <div class="row" id="tz"><span class="lbl">ΜΕΙΩΣΗ ΑΠΟ ΤΙΣ ΑΠΟΔΕΙΞΕΙΣ</span><b>${esc(feWhole(CUT))}</b></div>
      <i class="tline" id="tln"></i>
    </div>
    ${RC.map((r, k) => `
    <div class="rc" id="r${k}" style="left:${r.left}px;top:${r.top}px;width:${RC_W}px;z-index:${k + 2}">
      <div class="rh"><span>${esc(r.head)}</span></div>
      <div class="rl">${r.lines.map(([l, a]) => `<div><span>${esc(UP(l))}</span><span>${esc(fe(a))}</span></div>`).join('')}</div>
      <div class="rt"><span>ΣΥΝΟΛΟ</span><b>${esc(fe(r.total))}</b></div>
      <div class="st" id="st${k}">ΔΕΝ ΑΦΑΙΡΕΙΤΑΙ</div>
    </div>`).join('')}
  </section>

  <!-- 4 · Ο καταρράκτης -->
  <section id="s3">
    ${head(3, 'Ο ΛΟΓΑΡΙΑΣΜΟΣ', ['Από τα ενοίκια', A('στην τσέπη.')], 96)}
    <div class="wf" id="wf">
      ${[.25, .5, .75, 1].map(f => `<i class="gl" style="top:${wy(GROSS * f)}px"></i>`).join('')}
      <i class="base" id="wbase" style="top:${WF.base}px"></i>
      ${WB.map((b, i) => {
        const x = i * PITCH, top = wy(b.hi), h = wy(b.lo) - top;
        const vy = b.up ? top - 46 : top + h + 12;
        return `<i class="wb" id="wb${i}" style="left:${x}px;top:${top}px;width:${WF.colW}px;height:${h}px;--c:${b.c}"></i>
        <span class="wv" id="wv${i}" style="left:${x + WF.colW / 2}px;top:${vy}px;color:${i === 4 ? C.accent : i === 0 ? C.ink : b.c}">${esc(b.val[0])}</span>
        <span class="wk lbl" style="left:${x + WF.colW / 2}px;top:${WF.base + 18}px">${b.k}</span>
        <span class="wk lbl" id="wp${i}" style="left:${x + WF.colW / 2}px;top:${WF.base + 46}px;color:${i === 4 ? C.accent : '#7d8da6'}">${esc(b.pc)}</span>`;
      }).join('')}
      ${[0, 1, 2, 3].map(i => {
        const lvl = [GROSS, L1, L2, NET][i];
        return `<i class="cn" id="cn${i}" style="left:${i * PITCH + WF.colW}px;top:${wy(lvl)}px;width:${PITCH - WF.colW}px"></i>`;
      }).join('')}
    </div>
  </section>

  <!-- 5 · Από κάθε 100€ -->
  <section id="s4">
    ${head(4, 'ΤΟ ΑΠΟΤΕΛΕΣΜΑ', [`Από κάθε ${UNIT}€,`, A(`${P_NET}€ μένουν`), A('στην τσέπη.')], 96)}
    <div class="nt deco" id="nt" style="top:700px;width:${NOTE_W}px;height:${NOTE_H}px">
      <i class="ngl" id="ngl" style="left:${CUM[3] * NOTE_W}px;width:${(1 - CUM[3]) * NOTE_W}px"></i>
      ${PARTS.map((x, k) => `<div class="ns" id="ns${k}" style="clip-path:inset(0 ${(1 - CUM[k + 1]) * 100}% 0 ${CUM[k] * 100}% round 12px)">${note(`nn${k}`)}<i class="tn" id="tn${k}" style="background:${x.c}"></i></div>`).join('')}
      ${[1, 2, 3].map(k => `<i class="pf" id="pf${k}" style="left:${CUM[k] * NOTE_W - 1}px"></i>`).join('')}
    </div>
    <div class="L lg4" id="lg4" style="top:1158px">
      ${PARTS.map((x, k) => `<div class="lr4" id="l4_${k}"><span><i class="dot" style="background:${x.c}"></i>${esc(x.label)}</span><b${x.k === 'net' ? ` style="color:${C.accent}"` : ''}>${esc(feWhole(x.p))}</b></div>`).join('')}
    </div>
  </section>

  <!-- 6 · Η εφαρμογή -->
  <section id="s5">
    ${head(5, 'ΣΤΟ PROPERWISE', ['Όλο αυτό,', A('αυτόματα.')], 108)}
    <div class="L sub2" id="c5" style="top:608px;width:840px">Το PROPERWISE κάνει αυτόν τον λογαριασμό για <b>το δικό σου ακίνητο</b>, κάθε μήνα.</div>
    <div id="ph" class="deco"><div class="scr"><div class="isl"></div><div class="ap">
      <div class="ah" id="ah"><span class="m">${mark(22, C.ink)}</span><b>${esc(DEMO_PROPERTY.name)}</b><span class="y mono">${S.year}</span></div>
      ${APP_ROWS.map(([k, v], i) => `<div class="ar" id="ar${i}"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}
      <div class="abig" id="abg"><span class="mono">ΣΟΥ ΜΕΝΟΥΝ</span><div><b id="anet">${esc(eur(NET))}</b><em class="mono">${PCT(P_NET)}</em></div></div>
      <div class="abar">${PARTS.map((x, k) => `<i id="ab${k}" style="flex:${x.v};background:${x.c}"></i>`).join('')}</div>
      <div class="chips">${FEATS.map((f, k) => `<span id="ac${k}">${esc(f)}</span>`).join('')}</div>
    </div></div></div>
  </section>

  <!-- 7 · Η ερώτηση -->
  <section id="s6">
    ${head(6, 'ΤΟ ΔΙΚΟ ΣΟΥ ΑΚΙΝΗΤΟ', ['Εσύ ξέρεις', 'πόσα σου μένουν', A('καθαρά;')], 100, 620)}
    <div class="L row" id="ql" style="top:1006px;width:${HB_W}px"><span class="lbl">ΤΟ ΔΙΚΟ ΣΟΥ ΕΝΟΙΚΙΟ</span></div>
    <div class="qb deco" id="qb" style="top:1040px"><i id="qs"></i></div>
  </section>

  <div class="L" id="demo">${esc(DEMO_NOTE)}</div>
  <i id="carry" class="deco"></i>`;

const CSS = `
  .lbl{font-size:17px}
  /* 1 · Αγκίστρι */
  .hb{position:absolute;left:90px;width:${HB_W}px;height:96px;display:flex;gap:${HB_GAP}px}
  .hs{position:relative;height:100%}
  .hs i{position:absolute;inset:0;border-radius:12px}
  .hs .gh{border:2px dashed rgba(188,198,211,.38);opacity:0}
  .hs .fl{background:${SLATE};box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 24px 50px -24px rgba(0,0,0,.8)}
  .bk{position:absolute;left:90px;height:26px;border:2px solid rgba(188,198,211,.55);border-top:0;border-radius:0 0 10px 10px;transform-origin:50% 0}
  .qq{font-size:84px;font-weight:800;letter-spacing:-.04em;line-height:1.02;white-space:nowrap}
  .qq b{color:${SEG.tax};font-weight:800}
  #demo{top:1468px;font-size:18px;color:#7d8da6;letter-spacing:.01em;white-space:nowrap}

  /* 2 · Τετράγωνα και καθολικό */
  .tg{position:absolute;left:90px;top:692px;display:grid;grid-template-columns:repeat(10,40px);gap:6px}
  .tg i{display:block;width:40px;height:40px;border-radius:8px;background:${SLATE};box-shadow:inset 0 1px 0 rgba(255,255,255,.14)}
  .lg{position:absolute;left:560px;width:380px;display:flex;align-items:flex-start;gap:16px}
  .lg .tk{flex:none;width:0;height:2px;margin-top:19px}
  .lg .sw{flex:none;width:30px;height:30px;border-radius:7px;margin-top:4px}
  .lg b{display:block;font-size:28px;font-weight:800;letter-spacing:-.02em;line-height:1.3}
  .lg .lbl{display:block;margin-top:2px}
  .ledger{left:90px;width:850px;padding:6px 30px}
  .lr{display:flex;justify-content:space-between;align-items:baseline;padding:13px 0;font-size:28px;color:#aebbd0;border-top:1px solid rgba(255,255,255,.08)}
  .lr:first-child{border-top:0}
  .lr b{font-weight:750;color:${C.ink};letter-spacing:-.01em}
  .dot{display:inline-block;width:14px;height:14px;border-radius:4px;margin-right:14px;vertical-align:middle}

  /* 3 · Αποδείξεις */
  .taxc{left:90px;width:850px;padding:20px 30px 16px}
  .taxc .row{min-height:52px}
  .taxc b{font-size:34px;font-weight:800;letter-spacing:-.02em}
  .tline{position:absolute;left:30px;right:30px;bottom:0;height:3px;border-radius:2px;background:${SEG.tax};opacity:.5}
  .rc{position:absolute;padding:30px 28px 30px;color:#2a2f38;font-family:'Roboto Mono',monospace;
    background:linear-gradient(180deg,#f7f5ef,#efece4 70%,#e9e5db);
    filter:drop-shadow(0 30px 40px rgba(0,0,0,.45)) drop-shadow(0 2px 2px rgba(0,0,0,.3));
    -webkit-mask:linear-gradient(#000,#000) 0 8px/100% calc(100% - 16px) no-repeat,
      conic-gradient(from 135deg at 50% 0,#000 90deg,#0000 0) top/14px 8px repeat-x,
      conic-gradient(from -45deg at 50% 100%,#000 90deg,#0000 0) bottom/14px 8px repeat-x}
  .rc:before{content:'';position:absolute;inset:0;background-image:${GRAIN};opacity:.16;mix-blend-mode:multiply}
  .rh{display:flex;justify-content:space-between;font-size:17px;font-weight:700;letter-spacing:.1em;min-height:36px;padding-bottom:10px;border-bottom:2px dashed rgba(42,47,56,.4)}
  .rl{padding:10px 0 12px;font-size:16px;letter-spacing:.04em;line-height:1.65;border-bottom:3px double rgba(42,47,56,.55)}
  .rl div{display:flex;justify-content:space-between;gap:14px}
  .rl div span:first-child{overflow:hidden;white-space:nowrap}
  .rt{display:flex;justify-content:space-between;align-items:baseline;padding-top:12px;font-size:17px;font-weight:700;letter-spacing:.14em}
  .rt b{font-size:30px;letter-spacing:-.01em}
  .st{position:absolute;right:16px;top:24px;padding:5px 10px;border:3px solid ${RED};border-radius:8px;color:${RED};font-size:14px;font-weight:700;letter-spacing:.08em;
    opacity:0;mix-blend-mode:multiply;-webkit-mask-image:${GRAIN},linear-gradient(#000,#000);-webkit-mask-size:200px,100%;-webkit-mask-composite:source-over}

  /* 4 · Καταρράκτης */
  .wf{position:absolute;left:90px;top:640px;width:850px;height:760px}
  .wf .gl{position:absolute;left:0;right:0;height:1px;background:rgba(255,255,255,.06)}
  .wf .base{position:absolute;left:0;right:0;height:2px;background:rgba(188,198,211,.4);transform-origin:0 50%}
  .wb{position:absolute;display:block;border-radius:10px;transform-origin:50% 100%;
    background:linear-gradient(180deg,var(--c),color-mix(in srgb,var(--c) 68%,#0a1220));
    box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 18px 40px -18px color-mix(in srgb,var(--c) 60%,transparent)}
  .wv{position:absolute;transform:translateX(-50%);font-size:28px;font-weight:800;letter-spacing:-.02em;white-space:nowrap;line-height:34px}
  .wk{position:absolute;transform:translateX(-50%);white-space:nowrap}
  .cn{position:absolute;height:0;border-top:2px dashed rgba(188,198,211,.45);transform-origin:0 50%}

  /* 5 · Χαρτονόμισμα */
  .nt{position:absolute;left:160px}
  .ns{position:absolute;inset:0}
  .ns .tn{position:absolute;inset:0;opacity:0;mix-blend-mode:normal}
  .ngl{position:absolute;top:0;bottom:0;border-radius:12px;background:${C.accent};filter:blur(40px);opacity:0}
  .pf{position:absolute;top:-14px;bottom:-14px;width:0;border-left:3px dashed rgba(255,255,255,.85);transform-origin:50% 0;opacity:0}
  .eur{position:absolute;left:0;top:0;width:470px;height:252px;border-radius:10px;overflow:hidden;transform-origin:0 0;transform:scale(${NOTE_SC});
    box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 0 0 1px rgba(255,255,255,.18)}
  .eur{background:linear-gradient(118deg,#a9dcb0 0%,#5fae78 45%,#2f7a52 100%)}
  .eur .gl{position:absolute;inset:0;opacity:.9;
    background:repeating-radial-gradient(circle at 28% 62%,rgba(255,255,255,.13) 0 1px,transparent 1.2px 7px),
      repeating-linear-gradient(32deg,rgba(255,255,255,.07) 0 1px,transparent 1px 6px),
      repeating-linear-gradient(-32deg,rgba(0,0,0,.06) 0 1px,transparent 1px 8px)}
  .eur .ros{position:absolute;right:-60px;bottom:-80px;width:300px;height:300px;border-radius:50%;
    background:repeating-conic-gradient(rgba(255,255,255,.12) 0 4deg,transparent 4deg 9deg);-webkit-mask:radial-gradient(closest-side,#000 60%,transparent)}
  .eur .arch{position:absolute;left:168px;top:36px;width:200px;height:164px}
  .eur .stars{position:absolute;right:26px;top:18px;width:86px;height:86px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.25))}
  .eur .holo{position:absolute;left:116px;top:0;bottom:0;width:24px;opacity:.6;mix-blend-mode:screen;background-size:100% 400%;
    background-image:linear-gradient(180deg,#eef1f6,#b8c4d2 12%,#f3e6ff 24%,#c9f2ff 36%,#e9eef4 48%,#ffe9f6 60%,#cfe9ff 72%,#eef1f6 84%,#bcc6d3)}
  .eur .wm{position:absolute;left:26px;top:70px;width:78px;height:112px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,255,.4),rgba(255,255,255,.08) 70%,transparent)}
  .eur .dn{position:absolute;font-weight:850;color:rgba(255,255,255,.94);letter-spacing:-.045em;line-height:1;text-shadow:0 2px 0 rgba(0,0,0,.14)}
  .eur .tl{left:22px;top:16px;font-size:50px} .eur .br{right:20px;bottom:14px;font-size:104px}
  .eur .cur{position:absolute;left:156px;bottom:20px;font-family:'Roboto Mono',monospace;font-size:15px;letter-spacing:.3em;color:rgba(255,255,255,.9)}
  .lg4{width:830px}
  .lr4{display:flex;justify-content:space-between;align-items:baseline;padding:12px 0;font-size:28px;color:#aebbd0;border-top:1px solid rgba(255,255,255,.08)}
  .lr4:first-child{border-top:0}
  .lr4 b{font-weight:800;color:${C.ink}}

  /* 6 · Κινητό */
  #ph{position:absolute;left:260px;top:752px;width:560px;height:680px;border-radius:70px;padding:14px;
    background:linear-gradient(145deg,#3a4558,#141b27 40%,#2b3446);box-shadow:0 70px 130px rgba(0,0,0,.7),inset 0 0 0 2px rgba(255,255,255,.08)}
  #ph .scr{position:relative;width:100%;height:100%;border-radius:56px;overflow:hidden;background:linear-gradient(180deg,#0d1422,#070b12 60%)}
  #ph .isl{position:absolute;left:50%;top:16px;width:124px;height:34px;margin-left:-62px;border-radius:20px;background:#000}
  #ph .ap{padding:72px 28px 0}
  #ph .ah{display:flex;align-items:center;gap:12px;font-size:24px;margin-bottom:10px}
  #ph .ah .m{width:42px;height:42px;border-radius:12px;background:${C.panel};border:1.5px solid ${C.rule};display:flex;align-items:center;justify-content:center}
  #ph .ah b{font-weight:700}
  #ph .ah .y{margin-left:auto;font-size:15px;color:${C.faint}}
  #ph .ar{display:flex;justify-content:space-between;align-items:baseline;padding:15px 2px;border-top:1.5px solid ${C.rule};font-size:25px;color:${C.muted}}
  #ph .ar b{font-weight:700;color:${C.ink}}
  #ph .abig{margin-top:8px;padding:16px 18px;border-radius:20px;background:${C.accent}14;border:1.5px solid ${C.accent}55}
  #ph .abig span{font-size:16px;color:${C.faint}}
  #ph .abig div{display:flex;justify-content:space-between;align-items:baseline;margin-top:4px}
  #ph .abig b{font-size:56px;font-weight:850;letter-spacing:-.04em;color:${C.accent};line-height:1.1}
  #ph .abig em{font-style:normal;font-size:16px;color:${C.accent}}
  #ph .abar{display:flex;gap:4px;height:18px;margin-top:18px}
  #ph .abar i{display:block;border-radius:4px;transform-origin:0 50%}
  #ph .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
  #ph .chips span{font-size:19px;color:${C.muted};padding:8px 14px;border-radius:999px;border:1.5px solid ${C.rule}}
  #carry{position:absolute;left:0;top:0;width:10px;height:10px;opacity:0;background:${C.accent};
    box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 0 50px ${C.accent}66;transform-origin:0 0}

  /* 7 · Η ερώτηση */
  .qb{position:absolute;left:90px;width:${HB_W}px;height:96px;border-radius:14px;border:2px dashed rgba(138,180,248,.55);overflow:hidden}
  .qb i{position:absolute;top:0;bottom:0;width:260px;background:linear-gradient(90deg,transparent,rgba(138,180,248,.22),transparent)}`;

const JS = `
    const fin = (id, u, s, d, dy) => { const v = eo(p(u, s, s + (d || .55))); op($(id), v); tf($(id), 'translateY(' + ((dy == null ? 28 : dy) * (1 - v)) + 'px)'); return v; };
    const cnt = (id, arr, u, s, e) => { $(id).textContent = arr[Math.round(eo(p(u, s, e)) * (arr.length - 1))]; };
    const rgb = h => hex(h), mx = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k), css = a => 'rgb(' + a.map(Math.round).join(',') + ')';
    const oq = x => 1 - (1 - x) * (1 - x);
    // Γεωμετρία της παράδοσης: μετριέται μία φορά, πριν από οποιονδήποτε μετασχηματισμό.
    if (!window.G) {
      const cam = $('cam').getBoundingClientRect(), r = id => { const b = $(id).getBoundingClientRect(); return { x: b.left - cam.left, y: b.top - cam.top, w: b.width, h: b.height }; };
      window.G = { n: r('nt'), b: r('ab3') };
    }
    const G = window.G;
    op($('demo'), 1 - eo(p(t, S[6] - .3, S[6] + .2)));
    $('m4').textContent = D.free; $('m4').style.color = '${C.accent}';

    // ── 1 · Το αγκίστρι: το ενοίκιο λιγοστεύει μπροστά σου ─────────────
    u = scene(0);
    { const e = $('e0'), v = eo(p(t, -.3, .2)); op(e, v); tf(e, 'translateX(' + (-24 * (1 - v)) + 'px)'); }
    [-.8, -.7, -.6].forEach((s, k) => rev('q' + k, s, null, .55));
    { let ph = 0; for (let k = 0; k < 3; k++) if (t >= D.drop[k]) ph = k;
      const s = D.drop[ph]; $('hn').textContent = D.hookN[ph][Math.round(eo(p(t, s, s + .45)) * ${STEPS})];
      $('hp').textContent = D.hookP[ph][Math.round(eo(p(t, s, s + .45)) * ${STEPS})]; }
    // Πρώτο καρέ: μία συμπαγής μπάρα. Μετά ραγίζει στα τέσσερα της κομμάτια.
    const crack = eo(p(t, .1, .45));
    for (let k = 0; k < 4; k++) {
      const f = $('hf' + k), rl = k ? 12 * crack : 12, rr = k < 3 ? 12 * crack : 12;
      f.style.borderRadius = rl + 'px ' + rr + 'px ' + rr + 'px ' + rl + 'px';
      f.style.right = (k < 3 ? -${HB_GAP} * (1 - crack) : 0) + 'px';
      if (k < 3) {
        const s = D.drop[k], tint = eo(p(t, s - .25, s)), fall = ei(p(t, s, s + .5));
        f.style.background = css(mx(rgb('${SLATE}'), rgb(D.seg[k]), tint));
        op(f, 1 - fall); tf(f, 'translateY(' + (150 * fall) + 'px) rotate(' + ((k - 1) * 7 * fall) + 'deg)');
        op($('hg' + k), eo(p(t, s + .15, s + .55)));
      } else f.style.background = css(mx(rgb('${SLATE}'), rgb('${C.accent}'), eo(p(t, 1.95, 2.4))));
    }
    { const v = eo(p(t, 2.05, 2.5)); op($('hbk'), v); tf($('hbk'), 'scaleY(' + v + ')'); }
    $('hp').style.color = t > 1.95 ? '${C.accent}' : '';
    rev('q3', 2.2, null, .55); rev('q4', 2.32, null, .55); shine($('q2'), 2.6);

    // ── 2 · Ο φόρος: εκατό τετράγωνα, ένα για κάθε 1% του ενοικίου ─────
    u = scene(1); heads(1);
    op($('tl'), eo(p(u, .5, .9)));
    { const A0 = rgb('${SLATE}'), A1 = rgb('${LIGHT}'), A2 = rgb('${SEG.tax}'), G0 = rgb('${C.ground}');
      for (let i = 0; i < D.tiles; i++) {
        const r = Math.floor(i / 10), c = i % 10, el = $('t' + i);
        const v = eo(p(u, .6 + (r + c) * .035, .6 + .35 + (r + c) * .035));
        let col = A0, ol = 0;
        if (i >= D.tiles - D.exempt) { const g = eo(p(u, 1.9 + (i - D.tiles + D.exempt) * .08, 2.2 + (i - D.tiles + D.exempt) * .08)); col = mx(A0, G0, g); ol = g; }
        else {
          col = mx(A0, A1, eo(p(u, 2.8 + (r + c) * .02, 3.1 + (r + c) * .02)));
          if (i < D.ptax) col = mx(col, A2, eo(p(u, 3.6 + i * .05, 3.9 + i * .05)));
        }
        el.style.background = css(col);
        el.style.outline = ol > .02 ? '2px dashed rgba(188,198,211,' + (.7 * ol) + ')' : 'none'; el.style.outlineOffset = '-2px';
        op(el, v); tf(el, 'scale(' + (.7 + .3 * v) + ')');
      } }
    [[ 'lg2', 2.0 ], [ 'lg1', 2.9 ], [ 'lg0', 3.7 ]].forEach(([id, s]) => { fin(id, u, s, .5, 0); const v = eo(p(u, s, s + .5)); const tk = $(id).firstChild; tk.style.width = (20 * v) + 'px'; tk.style.background = 'rgba(188,198,211,.5)'; tf($(id), 'translateX(' + (24 * (1 - v)) + 'px)'); });
    fin('ld', u, 1.4, .6, 40);
    [1.5, 2.0, 2.9, 3.7].forEach((s, i) => fin('lr' + i, u, s, .5, 14));
    cnt('ltx', D.taxRun, u, 3.7, 4.5);

    // ── 3 · Τα έξοδα: οι αποδείξεις χτυπούν στη γραμμή του φόρου ────────
    u = scene(2); heads(2);
    fin('tc', u, .45, .6, 30);
    op($('tz'), eo(p(u, D.hitZero, D.hitZero + .4)));
    { let bump = 0, glow = 0;
      for (let k = 0; k < 4; k++) {
        const s = D.rcT[k], tc = s + .4, el = $('r' + k), R = D.rc[k];
        if (u < s) { op(el, 0); continue; }
        op(el, 1);
        const cx = (540 - (R.left + ${RC_W / 2})) * .35, cy = ${CONTACT} - R.top;
        let x, y, rot;
        if (u < tc) { const q = oq(p(u, s, tc)); x = cx * q; y = lerp(1960 - R.top, cy, q); rot = R.rot * 4 * (1 - q) - R.rot; }
        else { const q = spring(p(u, tc, tc + .9)); x = cx * (1 - q); y = cy * (1 - q); rot = lerp(-R.rot, R.rot, q); }
        tf(el, 'translate(' + x + 'px,' + y + 'px) rotate(' + rot + 'deg)');
        if (u > tc) { const d = u - tc; bump += Math.exp(-d * 14) * Math.sin(d * 42) * 7; glow = Math.max(glow, Math.exp(-d * 5)); }
        const sv = ei(p(u, tc - .1, tc)); op($('st' + k), sv > 0 ? 1 : 0);
        tf($('st' + k), 'rotate(-6deg) scale(' + (1.9 - .9 * sv) + ')');
      }
      if (u > .45) tf($('tc'), 'translateY(' + (-bump) + 'px)');
      op($('tln'), .5 + .5 * glow); $('tln').style.boxShadow = '0 0 ' + (24 * glow) + 'px ${SEG.tax}'; }

    // ── 4 · Ο καταρράκτης ───────────────────────────────────────────────
    u = scene(3); heads(3);
    { const v = eo(p(u, .35, .9)); tf($('wbase'), 'scaleX(' + v + ')'); }
    for (let i = 0; i < 5; i++) {
      const s = D.wfT[i], el = $('wb' + i);
      if (i === 0 || i === 4) { const v = eo(p(u, s, s + .7)); tf(el, 'scaleY(' + v + ')'); op(el, v > 0 ? 1 : 0); }
      else { const v = eo(p(u, s, s + .55)); op(el, v); tf(el, 'translateY(' + (-110 * (1 - v)) + 'px)'); }
      cnt('wv' + i, D.wfV[i], u, s, s + .6); op($('wv' + i), eo(p(u, s, s + .3)));
      op($('wp' + i), eo(p(u, s + .2, s + .6)));
      if (i < 4) { const v = eo(p(u, s + .45, s + .75)); tf($('cn' + i), 'scaleX(' + v + ')'); op($('cn' + i), v > 0 ? 1 : 0); }
    }
    for (const el of document.querySelectorAll('#wf .wk:not([id])')) op(el, eo(p(u, .5, .9)));

    // ── 5 · Από κάθε 100€: το χαρτονόμισμα κόβεται στα τέσσερα ──────────
    u = scene(4); heads(4);
    { const v = spring(p(u, .3, 1.3)); op($('nt'), cl(v * 1.6)); tf($('nt'), 'translateY(' + (320 * (1 - v)) + 'px) rotate(' + (-4 * (1 - v)) + 'deg)'); }
    for (let k = 0; k < 4; k++) $('nn' + k).querySelector('.holo').style.backgroundPosition = '0 ' + ((t * 22) % 100) + '%';
    for (let k = 1; k < 4; k++) { const v = eo(p(u, 1.45 + k * .1, 1.85 + k * .1)); op($('pf' + k), v * (1 - eo(p(u, 2.0, 2.3)))); tf($('pf' + k), 'scaleY(' + v + ')'); }
    { const solid = eo(p(t, D.hand - .35, D.hand));
      for (let k = 0; k < 4; k++) {
        const v = spring(p(u, 2.0 + k * .06, 2.9 + k * .06));
        tf($('ns' + k), 'translate(' + (D.ndx[k] * v) + 'px,' + (D.ndy[k] * v) + 'px) rotate(' + (D.nrot[k] * v) + 'deg)');
        const tint = eo(p(u, 2.0, 2.45));
        if (k < 3) { op($('tn' + k), .82 * tint); op($('ns' + k), 1 - .25 * eo(p(u, 2.6, 3.0))); }
        else { op($('tn' + k), lerp(.38 * eo(p(u, D.hitNet - .1, D.hitNet + .3)), .85, solid)); op($('ns' + k), 1 - p(t, D.hand + .04, D.hand + .14)); }
      }
      const g = eo(p(u, D.hitNet - .1, D.hitNet + .5)); op($('ngl'), .55 * g * (1 - p(t, D.hand, D.hand + .14)));
      tf($('ngl'), 'translate(' + D.ndx[3] + 'px,' + D.ndy[3] + 'px)'); }
    for (let k = 0; k < 4; k++) fin('l4_' + k, u, 2.35 + k * .14, .5, 16);

    // ── Η παράδοση: τα καθαρά περνούν το πέρασμα και γίνονται η μπάρα ──
    { const c = $('carry'), H = D.hand, LND = D.land;
      if (t < H || t > LND + .3) op(c, 0);
      else {
        const k = 1 + .012 * p(H, S[4], S[5]), n = G.n, cum = D.cum3;
        const ax = 540 + (n.x + n.w * cum + D.ndx[3] - 540) * k, ay = 900 + (n.y + D.ndy[3] - 900) * k, aw = n.w * (1 - cum) * k, ah = n.h * k;
        // Πρώτα συμπιέζεται σε μπάρα γύρω από το κέντρο του, μετά πετά στη θέση της.
        const q = eio(p(t, H + .1, LND)), qh = eo(p(t, H, H + .5)), b = G.b;
        const x = lerp(ax, b.x, q), w = lerp(aw, b.w, q), h = lerp(ah, b.h, qh);
        const y = lerp(ay + ah / 2, b.y + b.h / 2, q) - 160 * Math.sin(Math.PI * q) - h / 2;
        c.style.width = w + 'px'; c.style.height = h + 'px'; c.style.borderRadius = lerp(12, 4, qh) + 'px';
        tf(c, 'translate(' + x + 'px,' + y + 'px)'); op(c, p(t, H, H + .1) * (1 - p(t, LND, LND + .15)));
      } }

    // ── 6 · Η εφαρμογή: η κάρτα του ακινήτου στήνεται γύρω από τη μπάρα ─
    u = scene(5); heads(5);
    fin('c5', u, .55, .6, 20);
    { const v = spring(p(u, .0, 1.0)); op($('ph'), cl(v * 1.6)); tf($('ph'), 'translateY(' + (820 * (1 - v)) + 'px) rotateX(' + (22 * (1 - v)) + 'deg)'); }
    op($('ab3'), p(t, D.land - .02, D.land + .05));
    for (let k = 0; k < 3; k++) { const v = eo(p(u, 1.3 + k * .1, 1.75 + k * .1)); tf($('ab' + k), 'scaleX(' + v + ')'); op($('ab' + k), v > 0 ? 1 : 0); }
    fin('ah', u, .5, .5, 12);
    for (let k = 0; k < 3; k++) fin('ar' + k, u, .65 + k * .15, .5, 14);
    fin('abg', u, 1.45, .55, 18); cnt('anet', D.netRun, u, 1.45, 2.15);
    for (let k = 0; k < 4; k++) fin('ac' + k, u, 2.1 + k * .14, .45, 12);

    // ── 7 · Η ερώτηση ───────────────────────────────────────────────────
    u = scene(6); heads(6);
    fin('ql', u, .7, .5, 0);
    { const v = eo(p(u, .8, 1.4)); op($('qb'), v); tf($('qb'), 'scaleX(' + (.96 + .04 * v) + ')'); tf($('qs'), 'translateX(' + (-300 + 1300 * ((u * .45) % 1)) + 'px)'); }`;

const LINK = 'https://properwise.gr';

const CAPTION = [
  `Ένα ${PROP_SPOKEN} φέρνει ${eur(GROSS)} ενοίκια τον χρόνο. Καθαρά μένουν ${eur(NET)}.`,
  '',
  `Πού πήγαν τα ${eur(LOST)}; Ο λογαριασμός γραμμή γραμμή: τι παίρνει ο φόρος, τι ο ΕΝΦΙΑ, τι τα έξοδα.`,
  '',
  `Αυτό που ξαφνιάζει τους περισσότερους ιδιοκτήτες: στη μακροχρόνια μίσθωση ο φόρος υπολογίζεται στα έσοδα από το ενοίκιο, όχι σε ό,τι σου μένει μετά τα έξοδα. Για έξοδα η εφορία αφαιρεί ένα σταθερό ${PRES} του ενοικίου, όσα κι αν ξόδεψες στην πράξη. Στο υπόλοιπο ${TAXED_SHARE} πληρώνεις φόρο. Επισκευές, ασφάλιση και ΕΝΦΙΑ τα πληρώνεις κανονικά, αλλά δεν μειώνουν τον φόρο.`,
  '',
  `Από κάθε ${UNIT}€ ενοικίου μένουν ${P_NET}€ στην τσέπη.`,
  '',
  `Αυτό είναι το PROPERWISE. Ενοίκια, δαπάνες, φόροι και προθεσμίες για κάθε ακίνητο, σε μία εφαρμογή. Φωτογραφίζεις τον λογαριασμό και καταχωρείται. Ρωτάς ${ASSISTANT_ACC} και απαντά με τα δικά σου νούμερα.`,
  '',
  'Αποθήκευσέ το για τη φορολογική δήλωση. Στείλ\' το σε κάποιον που νοικιάζει το σπίτι του.',
  '',
  'Εσύ ξέρεις πόσα σου μένουν καθαρά από το δικό σου;',
  '',
  `Δωρεάν ${FREE_WORDS}. Σύνδεσμος στο bio.`,
  '',
  `Παράδειγμα με δεδομένα επίδειξης: φυσικό πρόσωπο, μακροχρόνια μίσθωση, χρονιά ${S.year}. Κάθε ακίνητο έχει τα δικά του νούμερα· για τη δική σου περίπτωση, ο λογιστής σου.`,
  '',
  '#ακίνητα #ενοίκια #ΕΝΦΙΑ #φορολογία #ιδιοκτήτες #PROPERWISE',
].join('\n');

const ALT = `Βίντεο ${Math.round(DUR)} δευτερολέπτων. ${PROP_SPOKEN.charAt(0).toLocaleUpperCase('el') + PROP_SPOKEN.slice(1)}: ${eur(GROSS)} ενοίκια τον χρόνο, μένουν ${eur(NET)}. Πού πήγαν τα ${eur(LOST)}; `
  + `Ο φόρος βλέπει τα έσοδα, όχι τα καθαρά: σταθερή έκπτωση ${PRES} (${eur(PRESUMPTIVE)}), φορολογητέο ${eur(TAXABLE)}, φόρος ${RATE} ${eur(TAX)}. `
  + `Τέσσερις αποδείξεις (ΕΝΦΙΑ ${eur(ENFIA)}, ${TOP[0].label.toLocaleLowerCase('el')} ${eur(TOP[0].amount)}, ${TOP[1].label.toLocaleLowerCase('el')} ${eur(TOP[1].amount)} και άλλες ${REST.length} δαπάνες ${eur(REST_SUM)}) δεν μειώνουν τον φόρο. `
  + `Καταρράκτης: ${eur(GROSS)} μείον φόρος ${eur(TAX)}, μείον ΕΝΦΙΑ ${eur(ENFIA)}, μείον έξοδα ${eur(OTHER)}: μένουν ${eur(NET)}. `
  + `Ένα χαρτονόμισμα των ${UNIT}€ κόβεται σε ${P_TAX}€ φόρο, ${P_ENFIA}€ ΕΝΦΙΑ, ${P_OTHER}€ έξοδα και ${P_NET}€ που μένουν. `
  + `Η εφαρμογή PROPERWISE δείχνει τον ίδιο λογαριασμό για το ακίνητο. Εσύ ξέρεις πόσα σου μένουν καθαρά; Δωρεάν ${FREE_WORDS}, properwise.gr.`;

const README = [
  '# Reel: «Πού πήγαν τα ενοίκια;»',
  '',
  'Το carousel `carousel-1` («Πού πήγαν τα …;») σε κίνηση, για Instagram Reels και YouTube Shorts:',
  `1080×1920, 30 fps, περίπου ${Math.round(DUR)}″, πρωτότυπη μουσική. Όλα τα ποσά από το ακίνητο επίδειξης`,
  '(`lib/demo/sample.ts`) μέσα από την `incomeStatement`, όπως στο carousel.',
  '',
  '    npx tsx scripts/marketing/reelKathara.ts',
  '',
  'Βίντεο (`PROPERWISE-pou-pigan-ta-enoikia.mp4`) και stories (ένα καρέ ανά σκηνή, `stories/1.png` …)',
  'στο `docs/marketing/reels/reel-kathara/`, έξω από το git. Εδώ μένουν η λεζάντα (`caption.md`)',
  'και το εξώφυλλο (`cover.jpg`).',
  '',
  '## Δημοσίευση στο Instagram',
  '',
  '- Ανέβασμα ως Reel, εξώφυλλο το `cover.jpg` (το αγκίστρι με την ερώτηση). «Κοινοποίηση και στη ροή»: ναι.',
  '- Ώρα: μεσημέρι (13:00-14:00) ή βράδυ (20:00-21:00), όχι την ίδια μέρα με το carousel.',
  '- Ήχος: ο πρωτότυπος του βίντεο. Μην προστεθεί μουσική από τη βιβλιοθήκη· κρύβει τα χτυπήματα στα ποσά.',
  '- Λεζάντα: το `caption.md` όπως είναι. Στις «Ρυθμίσεις για προχωρημένους» το εναλλακτικό κείμενο από κάτω.',
  '- Stories: τα επτά καρέ του `stories/`, με τη σειρά, με αυτοκόλλητο συνδέσμου στο τελευταίο.',
  '',
  '## Εναλλακτικό κείμενο',
  '',
  ALT,
  '',
  '## YouTube Shorts',
  '',
  `**Τίτλος:** Πού πήγαν τα ${eur(LOST)} από τα ενοίκια; #Shorts`,
  '',
  '**Περιγραφή:**',
  '',
  `${eur(GROSS)} ενοίκια τον χρόνο, ${eur(NET)} καθαρά. Στη μακροχρόνια μίσθωση ο φόρος υπολογίζεται στα έσοδα, με σταθερή έκπτωση ${PRES}· επισκευές, ασφάλιση και ΕΝΦΙΑ δεν τον μειώνουν. Από κάθε ${UNIT}€ ενοικίου μένουν ${P_NET}€.`,
  '',
  `Το PROPERWISE κάνει αυτόν τον λογαριασμό για το δικό σου ακίνητο, κάθε μήνα. Δωρεάν ${FREE_WORDS}: ${LINK}`,
  '',
  `Παράδειγμα με δεδομένα επίδειξης: φυσικό πρόσωπο, μακροχρόνια μίσθωση, χρονιά ${S.year}. Για τη δική σου περίπτωση, ο λογιστής σου.`,
  '',
  '**Ετικέτες:** ενοίκια, φόρος ενοικίων, ΕΝΦΙΑ, φορολογική δήλωση, ιδιοκτήτες ακινήτων, μακροχρόνια μίσθωση, ακίνητα, PROPERWISE',
  '',
  '## Καρφιτσωμένο σχόλιο',
  '',
  `Εσύ ξέρεις πόσα σου μένουν καθαρά από το δικό σου; Δοκίμασέ το δωρεάν ${FREE_WORDS} στο properwise.gr.`,
].join('\n');

const X: Explainer = {
  slug: 'reel-kathara', file: 'PROPERWISE-pou-pigan-ta-enoikia.mp4',
  scenes: SC, end: END, dur: DUR, html: HTML, css: CSS, heads: [0, 3, 3, 2, 3, 2, 3], js: JS,
  data: {
    free: UP(`Δωρεάν ${FREE_WORDS}`), drop: DROP, hookN: HOOK_N, hookP: HOOK_P, seg: PARTS.map(x => x.c),
    tiles: TILES, exempt: EXEMPT, ptax: P_TAX, taxRun: TAX_RUN,
    rcT: RC_T, rc: RC.map(r => ({ left: r.left, top: r.top, rot: r.rot })), hitZero: HIT_ZERO,
    wfT: WF_T, wfV: WB.map(b => b.val),
    ndx: N_DX, ndy: N_DY, nrot: N_ROT, hitNet: HIT_NET, cum3: CUM[3], hand: HAND, land: LAND,
    netRun: run(0, NET),
  },
  sound: m => {
    // 1 · Τρία κομμάτια πέφτουν, ο μετρητής κατεβαίνει, η ερώτηση προσγειώνεται.
    m.whoosh(0, .5, .04, true);
    DROP.forEach((s, k) => {
      m.click(s, 1500 - k * 200, .07, (k - 1) * .3); m.boom(s + .45, .05);
      for (let j = 0; j < 7; j++) m.click(s + j * .06, 3600, .016, .25);
      m.pluck(s + .02, [76, 72, 69][k], .04, (k - 1) * .3, .4);
    });
    m.pluck(1.95, 81, .045, 0, .5); m.sweep(2.05, .4, 900, 1600, .012);
    m.bell(HIT_Q + .02, 88, .03);
    m.whoosh(SC[1] - 1, 1, .08, true);
    // 2 · Τα τετράγωνα γεμίζουν κύμα κύμα, το 5% αδειάζει, ο φόρος κοκκινίζει.
    for (let d = 0; d < 19; d++) m.click(SC[1] + .6 + d * .035 + .12, 3000 + d * 40, .016, (d % 2 ? .3 : -.3));
    for (let k = 0; k < EXEMPT; k++) m.pluck(SC[1] + 1.9 + k * .08 + .1, [84, 86, 88, 91, 93][k % 5], .035, .3, .5);
    m.sweep(SC[1] + 2.8, .6, 700, 1300, .012);
    for (let k = 0; k < P_TAX; k++) m.click(SC[1] + 3.6 + k * .05 + .1, 1800 + k * 30, .03, -.2);
    m.pluck(SC[1] + 4.5, 69, .05, 0, .4);
    // 3 · Τέσσερις αποδείξεις: σφύριγμα χαρτιού, χτύπημα, σφραγίδα, προσγείωση.
    RC_T.forEach((s, k) => {
      const tc = SC[2] + s + .4;
      m.whoosh(tc - .4, .42, .045, true);
      m.click(tc, 520, .14, (k % 2 ? .25 : -.25)); m.boom(tc, .045); m.clap(tc, .035);
      m.click(tc + .5, 1100, .04, (k % 2 ? .25 : -.25));
    });
    m.pluck(SC[2] + HIT_ZERO + .05, 64, .05, 0, .4); m.bell(SC[2] + HIT_ZERO + .1, 76, .03);
    // 4 · Ο καταρράκτης: κάθε σκαλί μια νότα πιο κάτω, τα καθαρά μια καμπάνα.
    m.sweep(SC[3] + WF_T[0], .6, 500, 1100, .012);
    [79, 76, 72].forEach((n, k) => { m.pluck(SC[3] + WF_T[k + 1] + .1, n, .05, (k - 1) * .3, .45); m.click(SC[3] + WF_T[k + 1] + .45, 900, .05, (k - 1) * .3); });
    m.bell(SC[3] + WF_T[4] + .2, 84, .035); m.pluck(SC[3] + WF_T[4] + .2, 72, .04, 0, .5);
    // 5 · Το χαρτονόμισμα: πέφτει, διάτρηση, σκίσιμο, τα καθαρά λάμπουν.
    m.whoosh(SC[4] + .3, .7, .05, true); m.click(SC[4] + .3 + .65, 800, .05);
    for (let k = 1; k < 4; k++) for (let j = 0; j < 5; j++) m.click(SC[4] + 1.45 + k * .1 + j * .05, 4200, .014, (k - 2) * .3);
    m.whoosh(SC[4] + 1.95, .45, .06, false);
    m.bell(SC[4] + HIT_NET + .05, 88, .035);
    // Η παράδοση: το κομμάτι πετά, το κινητό ανεβαίνει, η μπάρα κουμπώνει.
    m.whoosh(HAND, LAND - HAND, .05, true); m.click(LAND, 2600, .06); m.bell(LAND + .02, 91, .03, .2);
    // 6 · Η κάρτα στήνεται.
    for (let k = 0; k < 3; k++) m.click(SC[5] + .65 + k * .15 + .05, 1400, .035, .2);
    m.pluck(SC[5] + 1.5, 81, .045, 0, .5);
    for (let k = 0; k < 4; k++) m.pluck(SC[5] + 2.1 + k * .14 + .05, [84, 86, 88, 91][k], .03, (k - 1.5) * .2, .5);
    // 7 · Η ερώτηση.
    m.pluck(SC[6] + .3, 77, .04, 0, .6); m.pluck(SC[6] + .45, 81, .035, 0, .6);
  },
  checkAt: [SC[1] - .3, SC[2] - .3, SC[3] - .3, SC[4] - .9, SC[5] - .9, SC[6] - .3, END - .3, DUR - .2],
  cover: SC[1] - .45,
  spots: [[540, 900], [330, 920], [540, 1120], [540, 1000], [540, 900], [540, 1080], [540, 900]],
  hits: [HIT_Q, SC[2] + HIT_ZERO, SC[4] + HIT_NET],
  stills: [SC[1] - .35, SC[2] - .35, SC[3] - .35, SC[4] - .35, SC[5] - .9, SC[6] - .35, END - .35],
  caption: CAPTION,
  readme: README,
};

make(X).catch(e => { console.error(e); process.exit(1); });
