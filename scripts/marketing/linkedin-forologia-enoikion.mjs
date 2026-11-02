// ═══════════════════════════════════════════════════════════════════════════
// LINKEDIN · ΤΡΙΤΗ 03.11.2026 · «ΦΟΡΟΛΟΓΙΑ ΕΝΟΙΚΙΩΝ 2026»
// ─────────────────────────────────────────────────────────────────────────
// Πέντε κάθετες διαφάνειες 4:5 (1080×1350) και ένα PDF για το «Add a document».
// Η σειρά «ένας οδηγός την εβδομάδα» (docs/marketing/linkedin-seira.md): τα
// κλιμάκια και η τεκμαρτή έκπτωση, πριν κλείσει η χρονιά.
//
//   1. «Τα μισά τα παίρνει η εφορία.»   2. Πώς δουλεύει: έκπτωση και κλιμάκια
//   3. Παράδειγμα, από τον οδηγό          4. Πριν κλείσει η χρονιά, με πηγές
//   5. Ο οδηγός και ο υπολογιστής
//
// Η ΜΑΡΚΑ ΜΕΝΕΙ ΜΙΑ: το πλαίσιο του linkedin-carousel.mjs (σκούρο μπλε, Inter
// και Roboto Mono από το public/fonts, ίδια κεφαλίδα, πρόοδος και κάρτες).
// Καμία γραμματοσειρά από τρίτο.
//
// ΚΑΝΕΝΑ ΝΟΥΜΕΡΟ ΜΕ ΤΟ ΧΕΡΙ. Κλιμάκια, έκπτωση, έτη και ημερομηνία από το
// lib/billing (greekTax, presumptive)· ο φόρος από την rentalIncomeTax· οι
// γραφές από τους κοινούς μορφοποιητές. Το ενοίκιο του παραδείγματος ΔΕΝ
// γράφεται εδώ: διαβάζεται από το Παράδειγμα 2 του ίδιου του οδηγού
// (EX2_MONTHLY στο app/odigos/forologia-enoikion-2026/page.tsx), ώστε η
// διαφάνεια και η σελίδα να λένε το ίδιο ποσό.
//
// ΤΑ ΨΗΦΙΑ ΣΕ INTER ΜΕ ΙΣΟΠΛΑΤΑ ΨΗΦΙΑ, ΠΟΤΕ ΣΕ MONO: το μηδέν του Roboto Mono
// διαβάζεται «θ» (scripts/guard-mono-zero.mjs). Η μηχανή ελέγχει μετά την
// απόδοση ότι κανένα στοιχείο σε Mono δεν έχει ψηφίο και ότι τίποτα δεν
// βγαίνει από τη διαφάνεια ή την κάρτα του· αλλιώς σταματά.
//
// Τρέξε: npx tsx scripts/marketing/linkedin-forologia-enoikion.mjs [έξοδος]
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { join, resolve } from 'node:path';
import { chromePath } from '../lib/chrome.mjs';
import {
  RENTAL_TAX_BRACKETS_2026, rentalIncomeTax, rentalBracketsForYear,
  FIRST_YEAR_NEW_BRACKETS, FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT,
} from '../../lib/billing/greekTax.ts';
import { PRESUMPTIVE_DEDUCTION_RATE } from '../../lib/billing/presumptive.ts';
import { fe, fp, fpRate, feWhole, fn, grDateOf } from '../../lib/core/format.ts';
import { rateScale, bracketSlices } from '../../app/odigos/taxText.ts';

const ROOT = process.cwd();
const R = join(ROOT, 'public');
const OUT = resolve(process.argv[2] || join(ROOT, 'docs/marketing/profil/linkedin-forologia-enoikion'));
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ── Τα γεγονότα ──────────────────────────────────────────────────────────
const GUIDE_SRC = fs.readFileSync(join(ROOT, 'app/odigos/forologia-enoikion-2026/page.tsx'), 'utf8');
const m = GUIDE_SRC.match(/const EX2_MONTHLY = ([\d_]+);/);
if (!m) throw new Error('Ο οδηγός δεν έχει πια Παράδειγμα 2 (EX2_MONTHLY)· η διαφάνεια του παραδείγματος θέλει νέα πηγή.');
const MONTHLY = Number(m[1].replace(/_/g, ''));

const NEW = RENTAL_TAX_BRACKETS_2026;
const OLD_YEAR = FIRST_YEAR_NEW_BRACKETS - 1;
const OLD = rentalBracketsForYear(OLD_YEAR);
const DED = fpRate(PRESUMPTIVE_DEDUCTION_RATE * 100);
const TAXED = fpRate((1 - PRESUMPTIVE_DEDUCTION_RATE) * 100);
const BANK_FROM = grDateOf(FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT);
const pct = r => fpRate(r * 100);

const GROSS = MONTHLY * 12;
const DEDUCTION = GROSS * PRESUMPTIVE_DEDUCTION_RATE;
const TAXABLE = GROSS - DEDUCTION;
const TAX = rentalIncomeTax(TAXABLE, NEW);
const TAX_OLD = rentalIncomeTax(TAXABLE, OLD);
const SLICES = bracketSlices(TAXABLE, NEW);
const EFF = fp((TAX / GROSS) * 100);
// Το εξώφυλλο λέει «τα μισά»· στέκει μόνο όσο ο πραγματικός συντελεστής του
// παραδείγματος μένει πολύ κάτω από αυτό.
if (TAX / GROSS >= 0.5) throw new Error('Ο πραγματικός συντελεστής του παραδείγματος φτάνει το μισό· το εξώφυλλο θέλει άλλη γωνία.');
if (Math.abs(SLICES.reduce((s, x) => s + x.tax, 0) - TAX) > 0.005) throw new Error('Τα κομμάτια των κλιμακίων δεν αθροίζουν στον φόρο.');
if (!(TAX_OLD > TAX)) throw new Error('Η νέα κλίμακα δεν δίνει πια μικρότερο φόρο στο παράδειγμα· η σύγκριση θέλει άλλη διατύπωση.');
const NEW_RATES = NEW.filter(b => !OLD.some(o => o.rate === b.rate)).map(b => b.rate);

// Στρογγυλά ποσά χωρίς «,00», όπως στο rentFacts.ts: στη μεγάλη γραφή τα
// μηδενικά δεκαδικά διαβάζονται ως λογιστικό φύλλο.
const eur = n => (Math.abs(n - Math.round(n)) < 0.005 ? fe(Math.round(n)).replace(/,00(?=€)/, '') : fe(n));
const range = b => (b.to === Infinity ? `πάνω από ${feWhole(b.from)}` : `${fn(b.from)} – ${feWhole(b.to)}`);

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
h1{margin-top:26px;font-size:92px;line-height:1;font-weight:800;letter-spacing:-.045em;text-wrap:balance}
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
.li{display:flex;align-items:flex-start;font-size:25px;line-height:1.38;color:#d6dfec;letter-spacing:-.01em}
.foot{display:flex;justify-content:space-between;align-items:center;padding-top:28px;border-top:1px solid rgba(255,255,255,.1)}
.url{font-family:Mono,monospace;font-size:22px;letter-spacing:.06em;color:#9ec0ff}
.next{font-size:22px;font-weight:600;color:#9ec0ff;display:flex;align-items:center;gap:12px}
.led{display:flex;justify-content:space-between;align-items:baseline;gap:20px;padding:15px 0;border-top:1px solid rgba(255,255,255,.08);font-size:25px;color:#d6dfec}
.led:first-of-type{border-top:0}
.led b{font-weight:700;color:#f1f5fc;white-space:nowrap}
.src{font-size:20px;line-height:1.45;color:#aebbd0}
.src b{color:#e3eaf5;font-weight:650}
`;
const frame = (n, eyebrow, h1, sub, stage, foot) => `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${css}</style></head><body><div class="bg"></div><div class="grid"></div><div class="edge"></div>
<div class="pad"><div class="head"><img src="${LOGO}" alt="PROPERWISE"><div class="prog">${Array.from({ length: N }, (_, i) => `<b class="${i + 1 === n ? 'on' : ''}"></b>`).join('')}</div></div>
<div class="eyebrow">${eyebrow}</div><h1>${h1}</h1><div class="sub">${sub}</div>
<div class="stage">${stage}</div>
<div class="foot">${foot ?? '<div class="url">properwise.gr</div><div class="next">Σύρε <span>→</span></div>'}</div></div></body></html>`;

const TOP_RATE = NEW[NEW.length - 1].rate;
const stair = NEW.map(b => {
  const isNew = NEW_RATES.includes(b.rate);
  const w = Math.round(30 + 70 * (b.rate / TOP_RATE));
  return `<div style="display:grid;grid-template-columns:300px 1fr;align-items:center;gap:22px;padding:8px 0">
   <div style="font-size:24px;color:#d6dfec">${range(b)}</div>
   <div style="display:flex;align-items:center;gap:16px">
    <div style="height:46px;width:${w}%;border-radius:12px;background:${isNew ? 'linear-gradient(90deg,#3d7ef0,#8ab4f8)' : 'rgba(138,180,248,.22)'};display:flex;align-items:center;justify-content:flex-end;padding:0 16px;font-size:26px;font-weight:800">${pct(b.rate)}</div>
    ${isNew ? '<span class="pill bl" style="font-size:18px;padding:6px 14px">νέο</span>' : ''}
   </div></div>`;
}).join('');

const slides = [
// 1 · Το εξώφυλλο: η φράση που έχει ακούσει
frame(1, 'Το ακουμε συχνα',
 '«Τα μισά τα παίρνει<br><span class="a">η εφορία.</span>»',
 `Για τα ενοίκια, λένε. <b>Η κλίμακα του ${FIRST_YEAR_NEW_BRACKETS} λέει άλλα.</b>`, `
 <div class="card" style="left:0;top:10px;width:450px;transform:rotate(-2.5deg);padding:32px 34px">
  <div class="lbl">Η φήμη</div>
  <div style="margin-top:16px;font-size:40px;font-weight:800;letter-spacing:-.03em;color:#aebbd0;text-decoration:line-through;text-decoration-color:#ef8f7f;text-decoration-thickness:5px">Τα μισά</div>
  <div style="margin-top:14px;font-size:22px;line-height:1.4;color:#7d8da6">Όλο το ενοίκιο με τον μεγάλο συντελεστή.</div>
 </div>
 <div class="card" style="right:0;top:270px;width:560px;padding:34px 38px 36px">
  <div class="row"><div class="lbl">Ο λογαριασμός</div><span class="pill wa">Παράδειγμα</span></div>
  <div style="margin-top:14px;font-size:24px;color:#aebbd0">Ενοίκιο ${eur(MONTHLY)} τον μήνα</div>
  <div style="margin-top:22px;font-size:96px;line-height:1;font-weight:800;letter-spacing:-.04em">${EFF}</div>
  <div style="margin-top:12px;font-size:22px;line-height:1.4;color:#aebbd0">ο φόρος ως ποσοστό των ακαθάριστων, με την κλίμακα του ${FIRST_YEAR_NEW_BRACKETS}</div>
 </div>`),

// 2 · Ο μηχανισμός: έκπτωση, μετά κλιμάκια
frame(2, 'Πως δουλευει',
 'Κάθε κομμάτι<br>με <span class="a">τον δικό του</span> συντελεστή.',
 `Πρώτα φεύγει η τεκμαρτή έκπτωση ${DED}, χωρίς αποδείξεις. <b>Το υπόλοιπο ανεβαίνει τα κλιμάκια.</b>`, `
 <div class="card" style="left:0;right:0;top:0;padding:26px 36px;display:flex;align-items:center;gap:24px">
  <div style="flex:none;width:52px;height:52px;border-radius:50%;background:rgba(82,199,158,.16);display:grid;place-items:center">${tick('#5fd4a8', 0.75).replace(/margin:[^;]+;/, 'margin:0 0 5px 0;')}</div>
  <div><div class="lbl">Τεκμαρτή έκπτωση</div><div style="margin-top:8px;font-size:27px;font-weight:700;letter-spacing:-.015em">Φορολογείται το ${TAXED} του ενοικίου</div></div>
 </div>
 <div class="card" style="left:0;right:0;top:136px;padding:20px 36px 22px">
  <div class="row" style="padding-bottom:6px"><div class="lbl">Κλιμακα ενοικιων</div><span class="pill bl">${FIRST_YEAR_NEW_BRACKETS}</span></div>
  ${stair}
  <div style="margin-top:8px;padding-top:16px;border-top:1px solid rgba(255,255,255,.08);font-size:22px;color:#7d8da6">Έως το ${OLD_YEAR}: ${rateScale(OLD)}, χωρίς το ενδιάμεσο κλιμάκιο.</div>
 </div>`),

// 3 · Το παράδειγμα, από τον οδηγό
frame(3, 'Παραδειγμα',
 `Ενοίκιο <span class="a">${eur(MONTHLY)}</span><br>τον μήνα.`,
 `Το δεύτερο παράδειγμα του οδηγού, βήμα βήμα. <b>Ίδιο ενοίκιο, δύο κλίμακες.</b>`, `
 <div class="card" style="left:0;top:0;width:540px;padding:22px 34px 18px">
  <div class="row" style="padding:6px 0 10px"><div class="lbl">Ο υπολογισμός</div><span class="pill wa">Παράδειγμα</span></div>
  <div class="led"><span>Ακαθάριστα έτους</span><b>${eur(GROSS)}</b></div>
  <div class="led"><span>Έκπτωση ${DED}</span><b>−${eur(DEDUCTION)}</b></div>
  <div class="led"><span>Φορολογητέο</span><b>${eur(TAXABLE)}</b></div>
  ${SLICES.map(s => `<div class="led" style="font-size:23px;color:#aebbd0"><span>${eur(s.width)} × ${pct(s.rate)}</span><b style="color:#d6dfec">${eur(s.tax)}</b></div>`).join('')}
  <div class="led" style="font-size:28px"><span style="font-weight:700;color:#f1f5fc">Φόρος</span><b style="font-size:34px">${eur(TAX)}</b></div>
 </div>
 <div class="card" style="right:0;top:40px;width:360px;padding:30px 32px">
  <div class="lbl">Πραγματικός συντελεστής</div>
  <div style="margin-top:14px;font-size:68px;line-height:1;font-weight:800;letter-spacing:-.04em">${EFF}</div>
  <div style="margin-top:10px;font-size:20px;line-height:1.4;color:#aebbd0">των ακαθάριστων</div>
 </div>
 <div class="card" style="right:0;top:330px;width:360px;padding:30px 32px">
  <div class="lbl">Με την παλια κλιμακα</div>
  <div style="margin-top:10px;font-size:20px;color:#aebbd0">έως το ${OLD_YEAR}</div>
  <div style="margin-top:10px;font-size:44px;line-height:1;font-weight:800;letter-spacing:-.03em;color:#aebbd0">${eur(TAX_OLD)}</div>
  <div style="margin-top:18px"><span class="pill ok">${eur(TAX_OLD - TAX)} λιγότερα</span></div>
 </div>`),

// 4 · Πριν κλείσει η χρονιά: τι κάνεις και η πηγή
frame(4, 'Πριν κλεισει η χρονια',
 `Η πρώτη χρονιά<br>της <span class="a">νέας κλίμακας.</span>`,
 `Τα ενοίκια του ${FIRST_YEAR_NEW_BRACKETS} δηλώνονται το ${FIRST_YEAR_NEW_BRACKETS + 1}. <b>Ο λογαριασμός βγαίνει από τώρα.</b>`, `
 <div class="card" style="left:0;right:0;top:0;padding:30px 36px;display:flex;flex-direction:column;gap:20px">
  <div class="li">${tick('#5fd4a8')}<span>Μέτρησε τον φόρο της χρονιάς με την κλίμακα που θα ισχύσει στη δήλωση.</span></div>
  <div class="li">${tick('#5fd4a8')}<span>Την έκπτωση ${DED} την παίρνεις για τα ενοίκια του ${FIRST_YEAR_NEW_BRACKETS}, όπως κι αν τα εισπράττεις. Από ${BANK_FROM}, χωρίς τράπεζα χάνεται.</span></div>
  <div class="li">${tick('#9ec0ff')}<span>Πήγαινε στον λογιστή με τα ενοίκια της χρονιάς σε τάξη. Το τελικό ποσό είναι δική του δουλειά.</span></div>
 </div>
 <div class="card" style="left:0;right:0;bottom:0;padding:26px 36px">
  <div class="lbl" style="margin-bottom:12px">Πηγες</div>
  <div class="src"><b>Κλίμακα:</b> άρθρο 8 ν.5246/2025 (ΦΕΚ Α΄ 198/11.11.2025), για εισοδήματα από το ${FIRST_YEAR_NEW_BRACKETS}.</div>
  <div class="src" style="margin-top:6px"><b>Έκπτωση ${DED}:</b> άρθρο 39 παρ. 3 περ. α΄ ν.4172/2013 (ΚΦΕ).</div>
  <div class="src" style="margin-top:6px"><b>Τράπεζα:</b> άρθρο 210 ν.5222/2025 · έναρξη ${BANK_FROM}, απόφαση ΑΑΔΕ Α.1187/2026.</div>
 </div>`),

// 5 · Το κλείσιμο: ο οδηγός και ο υπολογιστής
frame(5, 'Ο οδηγος της εβδομαδας',
 `Φορολογία ενοικίων<br><span class="a">${FIRST_YEAR_NEW_BRACKETS}.</span>`,
 `Η κλίμακα, η τεκμαρτή έκπτωση και η τράπεζα, με τρία παραδείγματα σε ευρώ. <b>Και ο υπολογιστής για το δικό σου ενοίκιο.</b>`, `
 <div class="card" style="left:0;top:10px;width:450px;padding:32px 34px">
  <div class="lbl">Ο οδηγος</div>
  <div class="t" style="margin-top:12px">Φορολογία ενοικίων ${FIRST_YEAR_NEW_BRACKETS}</div>
  <div style="margin-top:10px;font-size:22px;line-height:1.4;color:#aebbd0">Κλίμακα ${rateScale(NEW)}, έκπτωση ${DED}, τραπεζική είσπραξη.</div>
  <div style="margin-top:20px;font-size:20px;color:#9ec0ff">properwise.gr/odigos</div>
 </div>
 <div class="card" style="right:0;bottom:12px;width:440px;padding:30px 34px;transform:rotate(1.5deg)">
  <div class="lbl">Ο υπολογιστης</div>
  <div class="t" style="margin-top:12px">Φορολογία ενοικίων</div>
  <div style="margin-top:16px;display:flex;flex-direction:column;gap:12px">
   ${['Βάζεις ενοίκιο και μήνες', 'Ο υπολογισμός γίνεται στη συσκευή σου', 'Χωρίς λογαριασμό'].map(x => `<div class="li" style="font-size:22px">${tick('#5fd4a8', 0.8)}${x}</div>`).join('')}
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
    // Κάρτα πάνω σε κάρτα ή κάρτα που περνά το κάτω όριο της σκηνής.
    const stage = document.querySelector('.stage').getBoundingClientRect();
    const cards = [...document.querySelectorAll('.stage > .card')].map(c => c.getBoundingClientRect());
    cards.forEach((a, k) => {
      if (a.bottom > stage.bottom + 1) out.push(`κάρτα ${k + 1} περνά τη σκηνή κατά ${Math.round(a.bottom - stage.bottom)}px`);
      cards.slice(k + 1).forEach((b, j) => {
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 0 && oy > 0) out.push(`κάρτες ${k + 1} και ${k + j + 2} επικαλύπτονται`);
      });
    });
    return out;
  });
  bad.forEach(x => problems.push(`διαφάνεια ${i + 1}: ${x}`));
  const file = join(OUT, `properwise-forologia-enoikion-${i + 1}.png`);
  await p.screenshot({ path: file });
  files.push(file);
}
// Το PDF: μία σελίδα ανά διαφάνεια, ίδιο μέγεθος, για το «Add a document» του LinkedIn.
const pdf = await browser.newPage();
await pdf.setContent(`<!doctype html><html><head><style>@page{size:1080px 1350px;margin:0}body{margin:0}img{display:block;width:1080px;height:1350px;page-break-after:always}</style></head><body>${
  files.map(x => `<img src="data:image/png;base64,${b64(x)}">`).join('')}</body></html>`, { waitUntil: 'load' });
await pdf.pdf({ path: join(OUT, 'properwise-forologia-enoikion.pdf'), width: '1080px', height: '1350px', printBackground: true });
await browser.close();
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('✓', files.length, 'διαφάνειες και PDF στο', OUT);
