// ═══════════════════════════════════════════════════════════════════════════
// LINKEDIN · ΤΡΙΤΗ 24.11.2026 · «ΕΚΠΤΩΣΗ ΦΟΡΟΥ ΓΙΑ ΑΝΑΚΑΙΝΙΣΗ»
// ─────────────────────────────────────────────────────────────────────────
// Πέντε κάθετες διαφάνειες 4:5 (1080×1350) και ένα PDF για το «Add a document».
// Η σειρά «ένας οδηγός την εβδομάδα» (docs/marketing/linkedin-seira.md), χωρίς
// υπολογιστή, με γωνία: δαπάνες που πρέπει να γίνουν πριν λήξει το παράθυρο.
//
//   1. «Θα την κάνουμε του χρόνου.»     2. Μετρά η ημερομηνία
//   3. Παράδειγμα: ίδια ανακαίνιση, άλλη ημερομηνία
//   4. Τι κλείνεις ως τη λήξη, με πηγές  5. Ο οδηγός
//
// Η ΜΑΡΚΑ ΜΕΝΕΙ ΜΙΑ: το πλαίσιο του linkedin-carousel.mjs (σκούρο μπλε, Inter
// και Roboto Mono από το public/fonts, ίδια κεφαλίδα, πρόοδος και κάρτες).
// Καμία γραμματοσειρά από τρίτο.
//
// ΚΑΝΕΝΑ ΠΟΣΟ Ή ΗΜΕΡΟΜΗΝΙΑ ΜΕ ΤΟ ΧΕΡΙ.
//  · Όριο, έτη, ανά έτος, κλάσμα υλικών, παράθυρο δαπανών, νόμος και ΚΥΑ:
//    lib/accounting/renovation39b.ts, οι ίδιες σταθερές που διαβάζει ο οδηγός.
//  · Το παράδειγμα είναι το δεύτερο του οδηγού (`EX2` στο
//    app/odigos/ekptosi-forou-anakainisis/page.tsx), υπολογισμένο με τη
//    `renovationCredit`, με ετικέτα «Παράδειγμα».
//  · Η λήξη ελέγχεται και στο μητρώο ισχύος (`renovation-39b` του
//    lib/legal/validity.ts), απ' όπου έρχεται και το νομοσχέδιο που εκκρεμεί.
//  · Οι ημέρες που μένουν μετρούν από την Τρίτη της δημοσίευσης (η επόμενη
//    Τρίτη από σήμερα, ώρα Ελλάδας, ή η ημερομηνία του δεύτερου ορίσματος).
//
// ΤΑ ΨΗΦΙΑ ΣΕ INTER ΜΕ ΙΣΟΠΛΑΤΑ ΨΗΦΙΑ, ΠΟΤΕ ΣΕ MONO (scripts/guard-mono-zero.mjs).
// Η μηχανή ελέγχει μετά την απόδοση ότι κανένα στοιχείο σε Mono δεν έχει ψηφίο
// και ότι τίποτα δεν κόβεται, δεν βγαίνει από τη διαφάνεια και δεν πατά πάνω σε
// άλλη κάρτα· αλλιώς σταματά.
//
// Τρέξε: npx tsx scripts/marketing/linkedin-ekptosi-anakainisis.mjs [έξοδος] [ΕΕΕΕ-ΜΜ-ΗΗ]
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { join, resolve } from 'node:path';
import { chromePath } from '../lib/chrome.mjs';
import {
  renovationCredit, RENO_39B_CAP, RENO_39B_YEARS, RENO_39B_PER_YEAR, RENO_39B_FROM, RENO_39B_TO,
  RENO_39B_LAW, RENO_39B_KYA, RENO_39B_MATERIALS_SHARE,
} from '../../lib/accounting/renovation39b.ts';
import { regulated } from '../../lib/legal/validity.ts';
import { guideAt } from '../../app/odigos/guides.ts';
import { athensToday } from '../../lib/core/time.ts';
import { feWhole, fn, grDate } from '../../lib/core/format.ts';

const ROOT = process.cwd();
const R = join(ROOT, 'public');
const OUT = resolve(process.argv[2] || join(ROOT, 'docs/marketing/profil/linkedin-ekptosi-anakainisis'));
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ── Τα γεγονότα, από τον κώδικα και τον οδηγό ────────────────────────────
const GUIDE_HREF = '/odigos/ekptosi-forou-anakainisis';
const GUIDE = guideAt(GUIDE_HREF);
const SRC = fs.readFileSync(join(ROOT, `app${GUIDE_HREF}/page.tsx`), 'utf8');
const one = (re, what) => {
  const m = SRC.match(re);
  if (!m) throw new Error(`Δεν βρέθηκε στον οδηγό: ${what}.`);
  return m;
};
// Ο οδηγός πρέπει να λέει ό,τι λέει η διαφάνεια για την προθεσμία.
one(/μετά τις \$\{RENO_39B_TO\} δεν μετρά, εκτός αν δοθεί νέα παράταση/, 'η πρόταση για την τιμολόγηση μετά τη λήξη');
one(/Μετρά η ημερομηνία του τιμολογίου και της πληρωμής/, 'ότι μετρά η ημερομηνία τιμολογίου και πληρωμής');
const [, exS, exM] = one(/const EX2 = \{ services: (\d+), materials: (\d+) \}/, 'το δεύτερο παράδειγμα (EX2)');
const EX = { services: Number(exS), materials: Number(exM) };
const RC = renovationCredit(EX);
if (!(RC.materialsCounted < EX.materials)) throw new Error('Στο παράδειγμα τα υλικά μετρούν ολόκληρα· η γραμμή «μετρούν» θέλει άλλη διατύπωση.');

// «31/12/2026» → «2026-12-31»· η ίδια μέρα πρέπει να είναι και στο μητρώο ισχύος.
const iso = d => d.split('/').reverse().join('-');
const TO_ISO = iso(RENO_39B_TO);
const REG = regulated('renovation-39b');
if (REG.validTo !== TO_ISO || REG.validFrom !== iso(RENO_39B_FROM)) throw new Error('Το μητρώο ισχύος και το renovation39b.ts δίνουν άλλο παράθυρο.');
const dayAfter = d => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const AFTER = grDate(dayAfter(TO_ISO));
const NEXT_YEAR = Number(TO_ISO.slice(0, 4)) + 1;
const PENDING = REG.pending?.kind === 'law'
  ? `Για το ${NEXT_YEAR} εκκρεμεί νομοσχέδιο παράτασης. Ώσπου να ψηφιστεί, μετρά η ${RENO_39B_TO}.`
  : '';

// Η Τρίτη της δημοσίευσης και οι ημέρες ως τη λήξη, μετρημένες από εκείνη.
const TODAY = athensToday();
const PUB = process.argv[3] || (() => {
  const t = Date.parse(`${TODAY}T00:00:00Z`);
  const dow = new Date(t).getUTCDay();
  return new Date(t + ((2 - dow + 7) % 7) * 86_400_000).toISOString().slice(0, 10);
})();
const DAYS = Math.round((Date.parse(TO_ISO) - Date.parse(PUB)) / 86_400_000);
if (!(DAYS > 0 && DAYS <= 45)) throw new Error(`Μένουν ${DAYS} ημέρες ως τη λήξη: ο μετρητής θέλει 1 έως 45 (skill anartisi).`);

const eur = feWhole;
const CAP = eur(RENO_39B_CAP);
const PER_YEAR = eur(RENO_39B_PER_YEAR);
const MAT_DIV = fn(1 / RENO_39B_MATERIALS_SHARE);

// ── Το πλαίσιο, όπως στο linkedin-carousel.mjs ───────────────────────────
const b64 = p => fs.readFileSync(p).toString('base64');
const f = n => `data:font/woff2;base64,${b64(`${R}/fonts/${n}`)}`;
const LOGO = `data:image/png;base64,${b64(`${R}/brand/properwise-logotypo-lefko.png`)}`;
// Τσεκ σε CSS: ο φύλακας brand-mark δεν δέχεται χειροποίητο SVG εκτός BrandMark.
const tick = (c = '#52c79e', s = 1) => `<i style="display:inline-block;width:${9 * s}px;height:${17 * s}px;margin:0 ${14 * s}px ${5 * s}px ${4 * s}px;border:solid ${c};border-width:0 ${4 * s}px ${4 * s}px 0;transform:rotate(45deg);flex:none"></i>`;
const N = 5;

const css = `
@font-face{font-family:Inter;font-weight:100 900;src:url(${f('inter-greek.woff2')})}
@font-face{font-family:Inter;font-weight:100 900;src:url(${f('inter-latin.woff2')})}
@font-face{font-family:Mono;font-weight:400 600;src:url(${f('robotomono-greek.woff2')})}
@font-face{font-family:Mono;font-weight:400 600;src:url(${f('robotomono-latin.woff2')})}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;overflow:hidden}
body{font-family:Inter,sans-serif;font-variant-numeric:tabular-nums;color:#f1f5fc;-webkit-font-smoothing:antialiased;position:relative;background:#060b14}
.bg{position:absolute;inset:0;
 background:radial-gradient(900px 700px at 78% 78%, rgba(21,96,212,.42), transparent 62%),
  radial-gradient(700px 500px at 8% -6%, rgba(138,180,248,.16), transparent 66%),
  linear-gradient(172deg,#0d1a30 0%,#08101d 55%,#060b14 100%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:54px 54px;
 mask-image:radial-gradient(720px 600px at 62% 72%,#000 10%,transparent 76%)}
.edge{position:absolute;left:0;right:0;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(138,180,248,.6),transparent)}
.pad{position:absolute;inset:0;padding:76px 80px 70px;display:flex;flex-direction:column}
.head{display:flex;justify-content:space-between;align-items:center}
.head img{height:30px;display:block}
.prog{display:flex;gap:8px}.prog b{width:34px;height:5px;border-radius:3px;background:rgba(255,255,255,.14)}.prog b.on{background:#8ab4f8;box-shadow:0 0 12px rgba(138,180,248,.7)}
.eyebrow{margin-top:70px;font-family:Mono,monospace;font-size:19px;font-weight:500;letter-spacing:.24em;color:#8ab4f8;text-transform:uppercase;display:flex;align-items:center;gap:16px}
.eyebrow:before{content:'';width:34px;height:2px;background:#8ab4f8}
h1{margin-top:26px;font-size:88px;line-height:1;font-weight:800;letter-spacing:-.045em;text-wrap:balance}
h1 .a{background:linear-gradient(95deg,#a9c8ff 0%,#5f9bff 60%,#3d7ef0 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{margin-top:28px;font-size:30px;line-height:1.38;color:#aebbd0;max-width:900px;letter-spacing:-.012em;text-wrap:pretty}
.sub b{color:#f1f5fc;font-weight:650}
.stage{flex:1;position:relative;margin:40px 0 30px}
.card{position:absolute;border-radius:28px;background:linear-gradient(180deg,rgba(28,44,72,.92),rgba(14,24,42,.94));border:1px solid rgba(255,255,255,.12);
 box-shadow:0 40px 90px rgba(0,0,0,.6),0 0 0 1px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.12);padding:34px 36px}
.lbl{font-family:Mono,monospace;font-size:17px;letter-spacing:.16em;color:#7d8da6;text-transform:uppercase}
.row{display:flex;align-items:center;justify-content:space-between;gap:18px}
.pill{font-size:20px;font-weight:650;padding:8px 18px;border-radius:99px;white-space:nowrap;display:inline-flex;align-items:center;gap:10px}
.pill:before{content:'';width:9px;height:9px;border-radius:50%;background:currentColor}
.ok{color:#5fd4a8;background:rgba(82,199,158,.14)} .bl{color:#9ec0ff;background:rgba(138,180,248,.15)} .wa{color:#f0c97d;background:rgba(229,192,123,.15)}
.t{font-size:29px;font-weight:700;letter-spacing:-.018em}
.li{display:flex;align-items:flex-start;font-size:23px;line-height:1.38;color:#d6dfec;letter-spacing:-.01em}
.foot{display:flex;justify-content:space-between;align-items:center;padding-top:28px;border-top:1px solid rgba(255,255,255,.1)}
.url{font-family:Mono,monospace;font-size:22px;letter-spacing:.06em;color:#9ec0ff}
.next{font-size:22px;font-weight:600;color:#9ec0ff;display:flex;align-items:center;gap:12px}
.led{display:flex;justify-content:space-between;align-items:baseline;gap:20px;padding:15px 0;border-top:1px solid rgba(255,255,255,.08);font-size:25px;color:#d6dfec}
.led:first-of-type{border-top:0}
.led b{font-weight:700;color:#f1f5fc;white-space:nowrap}
.src{font-size:19px;line-height:1.42;color:#aebbd0}
.src b{color:#e3eaf5;font-weight:650}
`;
const frame = (n, eyebrow, h1, sub, stage, foot) => `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${css}</style></head><body><div class="bg"></div><div class="grid"></div><div class="edge"></div>
<div class="pad"><div class="head"><img src="${LOGO}" alt="PROPERWISE"><div class="prog">${Array.from({ length: N }, (_, i) => `<b class="${i + 1 === n ? 'on' : ''}"></b>`).join('')}</div></div>
<div class="eyebrow">${eyebrow}</div><h1>${h1}</h1><div class="sub">${sub}</div>
<div class="stage">${stage}</div>
<div class="foot">${foot ?? '<div class="url">properwise.gr</div><div class="next">Σύρε <span>→</span></div>'}</div></div></body></html>`;

const [GUIDE_T1, GUIDE_T2] = [GUIDE.title, 'πριν κλείσει το παράθυρο'];
const ok = '#5fd4a8';

const slides = [
// 1 · Το εξώφυλλο: η φράση που έχει ακούσει
frame(1, 'Το ακουμε συχνα',
 '«Την ανακαίνιση;<br><span class="a">Του χρόνου.»</span>',
 `Για την έκπτωση φόρου ανακαίνισης μετρούν δαπάνες <b>έως ${RENO_39B_TO}</b>. Ό,τι τιμολογηθεί μετά, μένει εκτός.`, `
 <div class="card" style="left:0;top:14px;width:500px;padding:32px 36px;transform:rotate(-1.5deg)">
  <div class="row"><div class="lbl">Η εκπτωση</div><span class="pill bl">Άρθρο 39Β</span></div>
  <div class="t" style="margin-top:16px;font-size:32px;line-height:1.25">Μείωση φόρου ίση με τη δαπάνη</div>
  <div style="margin-top:22px;font-size:64px;line-height:1;font-weight:800;letter-spacing:-.04em">${CAP}</div>
  <div style="margin-top:12px;font-size:23px;line-height:1.4;color:#aebbd0">το πολύ, μοιρασμένα σε ${RENO_39B_YEARS} έτη</div>
 </div>
 <div class="card" style="right:0;bottom:0;width:400px;padding:32px 34px">
  <div class="lbl">Μενουν</div>
  <div style="margin-top:14px;font-size:110px;line-height:1;font-weight:800;letter-spacing:-.04em;color:#f0c97d">${DAYS}</div>
  <div style="margin-top:6px;font-size:30px;font-weight:700">ημέρες</div>
  <div style="margin-top:12px;font-size:21px;line-height:1.4;color:#aebbd0">από την Τρίτη ${grDate(PUB)}<br>ως τις ${RENO_39B_TO}</div>
 </div>`),

// 2 · Ο μηχανισμός: μετρά η ημερομηνία, η μείωση σε πέντε έτη
frame(2, 'Πως δουλευει',
 'Μετρά η ημερομηνία.<br><span class="a">Όχι η πρόθεση.</span>',
 `Η μείωση ισούται με την επιλέξιμη δαπάνη και μοιράζεται σε ${RENO_39B_YEARS} έτη. <b>Μετρά η ημερομηνία του τιμολογίου και της πληρωμής.</b>`, `
 <div class="card" style="left:0;right:0;top:0;padding:28px 36px 30px">
  <div class="lbl">Το παραθυρο δαπανων</div>
  <div style="margin-top:22px;display:flex;height:64px;border-radius:14px;overflow:hidden;font-size:22px;font-weight:700">
   <div style="flex:3;display:flex;align-items:center;padding:0 20px;background:linear-gradient(90deg,rgba(82,199,158,.22),rgba(82,199,158,.38));color:#5fd4a8">Δαπάνες που μετρούν</div>
   <div style="flex:1.25;display:flex;align-items:center;justify-content:center;background:rgba(229,192,123,.16);color:#f0c97d">Εκτός</div>
  </div>
  <div style="margin-top:12px;display:flex;font-size:21px;color:#aebbd0">
   <div style="flex:3;display:flex;justify-content:space-between"><span>${RENO_39B_FROM}</span><span>${RENO_39B_TO}</span></div><div style="flex:1.25"></div>
  </div>
  <div style="margin-top:14px;font-size:21px;line-height:1.4;color:#7d8da6">Από ${AFTER} δεν μετρά, εκτός αν δοθεί νέα παράταση.</div>
 </div>
 <div class="card" style="left:0;right:0;bottom:0;padding:28px 36px 30px">
  <div class="row"><div class="lbl">Η μειωση, ισοποσα</div><span class="pill bl">Έως ${PER_YEAR} τον χρόνο</span></div>
  <div style="margin-top:22px;display:grid;grid-template-columns:repeat(${RENO_39B_YEARS},1fr);gap:14px;align-items:end">
   ${Array.from({ length: RENO_39B_YEARS }, (_, i) => `
   <div style="display:flex;flex-direction:column;gap:10px">
    <div style="height:110px;border-radius:12px;background:${i === 0 ? 'linear-gradient(180deg,#8ab4f8,#3d7ef0)' : 'rgba(138,180,248,.24)'}"></div>
    <div style="font-size:21px;color:#d6dfec;text-align:center">Έτος ${i + 1}</div>
   </div>`).join('')}
  </div>
  <div style="margin-top:16px;font-size:21px;line-height:1.4;color:#7d8da6">Ποτέ πάνω από τον φόρο του έτους. Ό,τι περισσεύει δεν επιστρέφεται.</div>
 </div>`),

// 3 · Το παράδειγμα του οδηγού: ίδια ανακαίνιση, άλλη ημερομηνία
frame(3, 'Παραδειγμα',
 'Ίδια ανακαίνιση.<br><span class="a">Άλλη ημερομηνία.</span>',
 'Το δεύτερο παράδειγμα του οδηγού, με αναλυτική προσφορά. <b>Αλλάζει μόνο πότε τιμολογείται.</b>', `
 <div class="card" style="left:0;top:0;width:520px;padding:22px 34px 18px">
  <div class="row" style="padding:6px 0 10px"><div class="lbl">Η ανακαινιση</div><span class="pill wa">Παράδειγμα</span></div>
  <div class="led"><span>Εργασία</span><b>${eur(EX.services)}</b></div>
  <div class="led"><span>Υλικά</span><b>${eur(EX.materials)}</b></div>
  <div class="led" style="font-size:23px;color:#aebbd0"><span>Υλικά που μετρούν, έως 1/${MAT_DIV}</span><b style="color:#d6dfec">${eur(RC.materialsCounted)}</b></div>
  <div class="led"><span>Επιλέξιμη δαπάνη</span><b>${eur(RC.eligible)}</b></div>
  <div class="led" style="font-size:28px"><span style="font-weight:700;color:#f1f5fc">Μείωση φόρου</span><b style="font-size:36px;color:#5fd4a8">${eur(RC.total)}</b></div>
  <div style="padding:6px 0 4px;font-size:19px;color:#7d8da6">${eur(RC.perYear)} τον χρόνο για ${RENO_39B_YEARS} έτη, αν ο φόρος φτάνει.</div>
 </div>
 <div class="card" style="right:0;top:0;width:380px;padding:28px 32px">
  <div class="lbl">Τιμολογιο εως</div>
  <div style="margin-top:4px;font-size:24px;font-weight:700">${RENO_39B_TO}</div>
  <div style="margin-top:16px;font-size:56px;line-height:1;font-weight:800;letter-spacing:-.04em;color:#5fd4a8">${eur(RC.total)}</div>
  <div style="margin-top:12px;font-size:20px;line-height:1.4;color:#aebbd0">μείωση φόρου</div>
 </div>
 <div class="card" style="right:0;top:330px;width:380px;padding:28px 32px">
  <div class="lbl">Τιμολογιο απο</div>
  <div style="margin-top:4px;font-size:24px;font-weight:700">${AFTER}</div>
  <div style="margin-top:16px;font-size:56px;line-height:1;font-weight:800;letter-spacing:-.04em;color:#f0c97d">${eur(0)}</div>
  <div style="margin-top:12px;font-size:20px;line-height:1.4;color:#aebbd0">εκτός αν δοθεί νέα παράταση</div>
 </div>`),

// 4 · Τι κάνεις: τα βήματα και οι πηγές
frame(4, 'Τι κανεις',
 `Τι κλείνεις<br><span class="a">ως τις ${RENO_39B_TO}.</span>`,
 'Ό,τι ζητά η ΚΥΑ, με την πηγή από κάτω. <b>Πριν πληρώσεις το πρώτο τιμολόγιο.</b>', `
 <div class="card" style="left:0;right:0;top:0;padding:24px 36px;display:flex;flex-direction:column;gap:12px;font-size:23px">
  <div class="li">${tick(ok)}<span>Αναλυτική προσφορά που χωρίζει την εργασία από τα υλικά. Τα υλικά μετρούν έως το 1/${MAT_DIV} των υπηρεσιών.</span></div>
  <div class="li">${tick(ok)}<span>Πληρωμή με κάρτα, έμβασμα ή άμεση πληρωμή. Με μετρητά δεν μετρά τίποτα.</span></div>
  <div class="li">${tick(ok)}<span>Τιμολόγιο στο ΑΦΜ σου, από πάροχο εγκατεστημένο στην Ελλάδα, με ημερομηνία έως ${RENO_39B_TO}.</span></div>
  <div class="li">${tick(ok)}<span>Ρώτα τον λογιστή αν ο φόρος σου απορροφά έως ${PER_YEAR} τον χρόνο.</span></div>
  ${PENDING ? `<div class="li"><i style="flex:none;width:12px;height:12px;border-radius:50%;background:#9ec0ff;margin:11px 21px 0 3px"></i><span style="color:#9ec0ff">${PENDING}</span></div>` : ''}
 </div>
 <div class="card" style="left:0;right:0;bottom:0;padding:24px 36px">
  <div class="lbl" style="margin-bottom:10px">Πηγες</div>
  <div class="src"><b>Η έκπτωση:</b> ${RENO_39B_LAW}.</div>
  <div class="src" style="margin-top:6px"><b>Το παράθυρο και οι όροι:</b> ${RENO_39B_KYA}, δαπάνες ${RENO_39B_FROM} έως ${RENO_39B_TO}.</div>
 </div>`),

// 5 · Το κλείσιμο: ο οδηγός
frame(5, 'Ο οδηγος της εβδομαδας',
 `${GUIDE_T1}:<br><span class="a">${GUIDE_T2}.</span>`,
 'Ο κανόνας, οι προϋποθέσεις και δύο παραδείγματα βήμα βήμα. <b>Με πηγή σε κάθε κανόνα.</b>', `
 <div class="card" style="left:0;top:10px;width:460px;padding:32px 34px">
  <div class="lbl">Ο οδηγος</div>
  <div class="t" style="margin-top:12px">${GUIDE.title}</div>
  <div style="margin-top:10px;font-size:22px;line-height:1.4;color:#aebbd0">${GUIDE.desc}</div>
 </div>
 <div class="card" style="right:0;bottom:12px;width:430px;padding:30px 34px;transform:rotate(1.5deg)">
  <div class="lbl">Θα βρεις</div>
  <div style="margin-top:16px;display:flex;flex-direction:column;gap:12px">
   ${['Πώς υπολογίζεται η μείωση', 'Τι τηρείς πριν από το πρώτο τιμολόγιο', 'Τι επιβεβαιώνεις με τον λογιστή', 'Τη διαφορά από το «Ανακαινίζω»'].map(x => `<div class="li" style="font-size:22px">${tick(ok, 0.8)}${x}</div>`).join('')}
  </div>
 </div>`,
 `<div style="display:flex;flex-direction:column;gap:6px"><div style="font-size:30px;font-weight:800;letter-spacing:-.02em">Βάλε το ακίνητό σου σε τάξη.</div><div style="font-size:22px;line-height:1.35;color:#aebbd0">Ο σύνδεσμος είναι στο πρώτο σχόλιο.</div></div>
  <div style="padding:20px 30px;border-radius:99px;background:linear-gradient(180deg,#3d7ef0,#1560d4);box-shadow:0 14px 34px rgba(21,96,212,.55),inset 0 1px 0 rgba(255,255,255,.3);font-size:24px;font-weight:700;display:flex;align-items:center;gap:14px">properwise.gr <span>→</span></div>`),
];

// ── Απόδοση, με έλεγχο ───────────────────────────────────────────────────
const browser = await chromium.launch({ executablePath: chromePath() });
const p = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
const files = [];
const problems = [];
for (const [i, html] of slides.entries()) {
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  const bad = await p.evaluate(() => {
    const out = [];
    const W = 1080, H = 1350, M = 40;
    for (const el of document.querySelectorAll('.pad *')) {
      const cs = getComputedStyle(el);
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
      if (/Mono/.test(cs.fontFamily) && /\d/.test(own)) out.push(`ψηφίο σε Mono: «${own.trim()}»`);
      if (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible') out.push(`κόβεται: «${el.textContent.trim().slice(0, 40)}»`);
      const r = el.getBoundingClientRect();
      if (r.width && (r.left < M - 30 || r.right > W - M + 30 || r.bottom > H - 30)) out.push(`βγαίνει από τη διαφάνεια: «${el.textContent.trim().slice(0, 40)}»`);
    }
    // Κείμενο που ξεχειλίζει από την κάρτα του.
    for (const c of document.querySelectorAll('.stage > .card')) {
      const cr = c.getBoundingClientRect();
      for (const el of c.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width && (r.right > cr.right + 1 || r.bottom > cr.bottom + 1)) out.push(`ξεχειλίζει από την κάρτα: «${el.textContent.trim().slice(0, 40)}»`);
      }
    }
    // Κάρτα πάνω σε κάρτα ή κάρτα που περνά το κάτω όριο της σκηνής.
    const stage = document.querySelector('.stage').getBoundingClientRect();
    const cards = [...document.querySelectorAll('.stage > .card')].map(c => c.getBoundingClientRect());
    cards.forEach((a, k) => {
      if (a.bottom > stage.bottom + 1) out.push(`κάρτα ${k + 1} περνά τη σκηνή κατά ${Math.round(a.bottom - stage.bottom)}px`);
      if (a.top < stage.top - 1) out.push(`κάρτα ${k + 1} ανεβαίνει πάνω από τη σκηνή κατά ${Math.round(stage.top - a.top)}px`);
      cards.slice(k + 1).forEach((b, j) => {
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 0 && oy > 0) out.push(`κάρτες ${k + 1} και ${k + j + 2} επικαλύπτονται`);
      });
    });
    return out;
  });
  bad.forEach(x => problems.push(`διαφάνεια ${i + 1}: ${x}`));
  const file = join(OUT, `properwise-ekptosi-anakainisis-${i + 1}.png`);
  await p.screenshot({ path: file });
  files.push(file);
}
// Το PDF: μία σελίδα ανά διαφάνεια, ίδιο μέγεθος, για το «Add a document» του LinkedIn.
const pdf = await browser.newPage();
await pdf.setContent(`<!doctype html><html><head><style>@page{size:1080px 1350px;margin:0}body{margin:0}img{display:block;width:1080px;height:1350px;page-break-after:always}</style></head><body>${
  files.map(x => `<img src="data:image/png;base64,${b64(x)}">`).join('')}</body></html>`, { waitUntil: 'load' });
await pdf.pdf({ path: join(OUT, 'properwise-ekptosi-anakainisis.pdf'), width: '1080px', height: '1350px', printBackground: true });
await browser.close();
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('✓', files.length, 'διαφάνειες και PDF στο', OUT);
