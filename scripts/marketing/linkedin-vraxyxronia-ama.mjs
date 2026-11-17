// ═══════════════════════════════════════════════════════════════════════════
// LINKEDIN · ΤΡΙΤΗ 17.11.2026 · «ΒΡΑΧΥΧΡΟΝΙΑ 2026: ΑΜΑ ΚΑΙ ΠΡΟΔΙΑΓΡΑΦΕΣ»
// ─────────────────────────────────────────────────────────────────────────
// Πέντε κάθετες διαφάνειες 4:5 (1080×1350) και ένα PDF για το «Add a document».
// Η σειρά «ένας οδηγός την εβδομάδα» (docs/marketing/linkedin-seira.md): ο ΑΜΑ
// στην αγγελία και τα πρόστιμα, με τον υπολογιστή «Βραχυχρόνια ή μακροχρόνια».
//
//   1. «Έχω ΑΜΑ. Είμαι εντάξει.»       2. Δύο πρόστιμα, δύο έλεγχοι
//   3. Παράδειγμα, από τον υπολογιστή    4. Τι ελέγχεις αυτή την εβδομάδα, με πηγές
//   5. Ο οδηγός και ο υπολογιστής
//
// Η ΜΑΡΚΑ ΜΕΝΕΙ ΜΙΑ: το πλαίσιο του linkedin-carousel.mjs (σκούρο μπλε, Inter
// και Roboto Mono από το public/fonts, ίδια κεφαλίδα, πρόοδος και κάρτες).
// Καμία γραμματοσειρά από τρίτο.
//
// ΚΑΝΕΝΑ ΠΡΟΣΤΙΜΟ, ΠΟΣΟ Ή ΗΜΕΡΟΜΗΝΙΑ ΜΕ ΤΟ ΧΕΡΙ.
//  · Τα πρόστιμα και η νομική τους βάση διαβάζονται από τον ίδιο τον οδηγό
//    (app/odigos/vraxyxronia-ama-prodiagrafes-2026/page.tsx), από τη λίστα
//    «Τα πρόστιμα», τις συχνές ερωτήσεις και την τεκμηρίωση. Αν δύο σημεία του
//    οδηγού διαφωνούν ή η διατύπωση αλλάξει, η μηχανή σταματά. Το ίδιο ποσό
//    ελέγχεται και στο `str-technical-specs` του lib/accounting/updates2026.ts.
//  · Προδιαγραφές, πράξη και έναρξη: lib/accounting/strSpecs.ts.
//  · Ζώνες αναστολής: lib/market/greekMarket.ts· η εκκρεμής απόφαση για την
//    επόμενη χρονιά από το `str-freeze` του lib/legal/validity.ts.
//  · Η προθεσμία της δήλωσης: lib/tax/greekTaxCalendar.ts, το ίδιο ημερολόγιο
//    με την εφαρμογή.
//  · Το παράδειγμα είναι το διαμέρισμα του υπολογιστή με τις προεπιλογές του
//    (app/vraxyxronia-i-makroxronia/spec.ts μέσω scripts/marketing/seiresData.ts),
//    με τη shortTermSide του lib/tools/shortVsLong.ts.
//
// ΤΑ ΨΗΦΙΑ ΣΕ INTER ΜΕ ΙΣΟΠΛΑΤΑ ΨΗΦΙΑ, ΠΟΤΕ ΣΕ MONO (scripts/guard-mono-zero.mjs).
// Η μηχανή ελέγχει μετά την απόδοση ότι κανένα στοιχείο σε Mono δεν έχει ψηφίο
// και ότι τίποτα δεν κόβεται, δεν βγαίνει από τη διαφάνεια και δεν πατά πάνω σε
// άλλη κάρτα· αλλιώς σταματά.
//
// Τρέξε: npx tsx scripts/marketing/linkedin-vraxyxronia-ama.mjs [έξοδος]
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { join, resolve } from 'node:path';
import { chromePath } from '../lib/chrome.mjs';
import { shortTermSide } from '../../lib/tools/shortVsLong.ts';
import { svlInput } from './seiresData.ts';
import { STR_SPECS, STR_SPECS_LAW, STR_SPECS_FEK, STR_SPECS_FROM } from '../../lib/accounting/strSpecs.ts';
import { REGULATORY_UPDATES_2026 } from '../../lib/accounting/updates2026.ts';
import { ATHENS_STR_FREEZE as ATHENS, THESS_STR_FREEZE as THESS } from '../../lib/market/greekMarket.ts';
import { regulated } from '../../lib/legal/validity.ts';
import { greekPropertyTaxObligations } from '../../lib/tax/greekTaxCalendar.ts';
import { guideAt } from '../../app/odigos/guides.ts';
import { athensToday } from '../../lib/core/time.ts';
import { MONTHS_GEN } from '../../lib/core/months.ts';
import { feWhole, fn, grDate } from '../../lib/core/format.ts';

const ROOT = process.cwd();
const R = join(ROOT, 'public');
const OUT = resolve(process.argv[2] || join(ROOT, 'docs/marketing/profil/linkedin-vraxyxronia-ama'));
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ── Τα γεγονότα, από τον οδηγό ───────────────────────────────────────────
const GUIDE_HREF = '/odigos/vraxyxronia-ama-prodiagrafes-2026';
const GUIDE = guideAt(GUIDE_HREF);
const CALC = '/vraxyxronia-i-makroxronia';
if (!GUIDE.tools?.includes(CALC)) throw new Error('Ο οδηγός δεν δείχνει πια τον υπολογιστή «Βραχυχρόνια ή μακροχρόνια».');
const SRC = fs.readFileSync(join(ROOT, `app${GUIDE_HREF}/page.tsx`), 'utf8');
// Οι ερωτήσεις του οδηγού σπάνε τις προτάσεις σε κομμάτια με «+»· ενώνονται εδώ.
const FLAT = SRC.replace(/'\s*\+?\s*\n\s*\+?\s*'/g, '');
const num = s => Number(s.replace(/\./g, ''));
const lineWith = marker => {
  const l = SRC.split('\n').find(x => x.includes(marker));
  if (!l) throw new Error(`Ο οδηγός δεν γράφει πια «${marker}»· η διαφάνεια θέλει νέα πηγή.`);
  return l;
};
const one = (re, text, what) => {
  const m = text.match(re);
  if (!m) throw new Error(`Δεν βρέθηκε στον οδηγό: ${what}.`);
  return m;
};

// Πρόστιμο ΑΜΑ: ποσοστό των ακαθάριστων και κατώτατο, ίδια σε λίστα και ερωτήσεις.
const AMA_RE = /πρόστιμο (\d+)% των ακαθάριστων εσόδων της χρονιάς, τουλάχιστον ([\d.]+)€/g;
const amaAll = [...FLAT.matchAll(AMA_RE)].map(m => `${m[1]}|${m[2]}`);
if (amaAll.length < 2 || new Set(amaAll).size !== 1) throw new Error(`Ο οδηγός δίνει ασυμφωνία στο πρόστιμο ΑΜΑ: ${amaAll.join(', ') || 'κανένα'}.`);
const amaLine = lineWith('μη ανάρτηση του ΑΜΑ στην αγγελία:');
const [, amaPct, amaMinS] = one(/πρόστιμο (\d+)% των ακαθάριστων εσόδων της χρονιάς, τουλάχιστον ([\d.]+)€/, amaLine, 'το πρόστιμο ΑΜΑ στη λίστα');
if (!/νέα παράβαση μέσα σε έναν χρόνο από την πράξη επιβολής διπλασιάζεται/.test(amaLine)) throw new Error('Η υποτροπή του προστίμου ΑΜΑ άλλαξε διατύπωση.');
if (/τετραπλ/.test(amaLine)) throw new Error('Το πρόστιμο ΑΜΑ γράφει πάλι τετραπλάσιο· ο οδηγός το είχε αφαιρέσει.');
const AMA_RATE = Number(amaPct) / 100;
const AMA_MIN = num(amaMinS);

// Πρόστιμο προδιαγραφών: ποσό, διπλάσιο, τετραπλάσιο.
const specLine = lineWith('Παράβαση των προδιαγραφών καταλληλότητας ή άρνηση εισόδου στον έλεγχο:');
const SPEC_FINE = num(one(/πρόστιμο ([\d.]+)€/, specLine, 'το πρόστιμο των προδιαγραφών')[1]);
if (!/διπλασιάζεται/.test(specLine) || !/τετραπλασιάζεται/.test(specLine)) throw new Error('Η κλιμάκωση του προστίμου των προδιαγραφών άλλαξε διατύπωση.');
const specFaq = num(one(/παράβαση των προδιαγραφών καταλληλότητας είναι ([\d.]+)€/, FLAT, 'το πρόστιμο των προδιαγραφών στις ερωτήσεις')[1]);
if (specFaq !== SPEC_FINE) throw new Error('Λίστα και ερωτήσεις του οδηγού δίνουν άλλο πρόστιμο προδιαγραφών.');
const SPEC_LADDER = [
  [SPEC_FINE, 'Πρώτη παράβαση'],
  [SPEC_FINE * 2, 'Νέα, μέσα σε έναν χρόνο'],
  [SPEC_FINE * 4, 'Κάθε επόμενη ίδια'],
];

// Η νομική βάση, αυτούσια από την τεκμηρίωση του οδηγού.
const AMA_BASIS = one(/'Πρόστιμο μη εγγραφής ή μη ανάρτησης του ΑΜΑ: ([^·']+?) ·/, SRC, 'η βάση του προστίμου ΑΜΑ')[1].trim();
const LIST_BASIS = one(/'Εγγραφή ανά ακίνητο και αναγραφή του ΑΜΑ σε κάθε πλατφόρμα και μέσο προβολής: ([^']+?)\.'/, SRC, 'η βάση της αναγραφής ΑΜΑ')[1].trim();

// Το ίδιο ποσό στον πίνακα κανόνων της εφαρμογής.
const SPEC_RULE = REGULATORY_UPDATES_2026.find(u => u.id === 'str-technical-specs');
if (!SPEC_RULE) throw new Error('Λείπει ο κανόνας str-technical-specs.');
for (const x of [`${amaPct}%`, feWhole(AMA_MIN), feWhole(SPEC_FINE)]) {
  if (!SPEC_RULE.summary.includes(x)) throw new Error(`Ο κανόνας str-technical-specs δεν γράφει «${x}» όπως ο οδηγός.`);
}

// Ζώνες, εκκρεμής απόφαση, προθεσμία.
const FREEZE = regulated('str-freeze');
if (FREEZE.validTo !== ATHENS.to || THESS.to !== ATHENS.to) throw new Error('Οι ζώνες λήγουν σε άλλες μέρες· η διαφάνεια γράφει μία.');
const NEXT_YEAR = Number(ATHENS.to.slice(0, 4)) + 1;
const FREEZE_NOTE = FREEZE.pending?.kind === 'decision'
  ? `Για το ${NEXT_YEAR} εκκρεμεί απόφαση.`
  : '';
const TODAY = athensToday();
const DECL = greekPropertyTaxObligations(Number(TODAY.slice(0, 4)), 'short_term')
  .find(o => o.kind === 'str-registry' && o.date >= TODAY);
if (!DECL) throw new Error('Δεν βρέθηκε επόμενη προθεσμία δήλωσης βραχυχρόνιας διαμονής φέτος.');
const DECL_MONTH = MONTHS_GEN[(Number(DECL.date.slice(5, 7)) + 10) % 12];

// Το παράδειγμα: το διαμέρισμα του υπολογιστή, χωρίς ΑΜΑ στην αγγελία.
const S = shortTermSide(svlInput);
const FINE = Math.max(S.gross * AMA_RATE, AMA_MIN);
// Ο τίτλος του παραδείγματος λέει ότι το πρόστιμο περνά τα καθαρά της χρονιάς.
if (!(FINE > S.net)) throw new Error('Στο παράδειγμα το πρόστιμο δεν ξεπερνά τα καθαρά· ο τίτλος θέλει άλλη γωνία.');
if (!(S.gross * AMA_RATE > AMA_MIN)) throw new Error('Στο παράδειγμα ισχύει το κατώτατο· το βήμα «το μεγαλύτερο» θέλει άλλη διατύπωση.');
const eur = feWhole;

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

const check = c => `<div style="flex:none;width:44px;height:44px;border-radius:50%;background:${c === 'wa' ? 'rgba(229,192,123,.16)' : 'rgba(82,199,158,.16)'};display:grid;place-items:center">${
  c === 'wa' ? '<span style="font-size:26px;font-weight:800;color:#f0c97d;line-height:1">!</span>' : tick('#5fd4a8', 0.7).replace(/margin:[^;]+;/, 'margin:0 0 5px 0;')}</div>`;
const [GUIDE_T1, GUIDE_T2] = GUIDE.title.split(': ');

const slides = [
// 1 · Το εξώφυλλο: η φράση που έχει ακούσει
frame(1, 'Το ακουμε συχνα',
 '«Έχω ΑΜΑ.<br><span class="a">Είμαι εντάξει.</span>»',
 'Η εγγραφή στο Μητρώο είναι η μισή υποχρέωση. <b>Ο ΑΜΑ πρέπει να φαίνεται σε κάθε αγγελία.</b>', `
 <div class="card" style="left:0;top:14px;width:500px;padding:30px 34px 22px;transform:rotate(-1.5deg)">
  <div class="row"><div class="lbl">Η αγγελια</div><span class="pill bl">Δημοσιευμένη</span></div>
  <div class="t" style="margin-top:12px">Διαμέρισμα στο κέντρο</div>
  <div style="margin-top:14px">
   ${[['Φωτογραφίες', 'ok'], ['Τιμή ανά βράδυ', 'ok'], ['Ημερολόγιο', 'ok'], ['ΑΜΑ', 'wa']].map(([l, c], i) => `
   <div style="display:flex;align-items:center;gap:18px;padding:14px 0;${i ? 'border-top:1px solid rgba(255,255,255,.08)' : ''}">
    ${check(c)}<div style="flex:1;font-size:25px;font-weight:600;color:${c === 'wa' ? '#f0c97d' : '#e3eaf5'}">${l}</div>
    ${c === 'wa' ? '<span class="pill wa" style="font-size:18px;padding:6px 14px">Λείπει</span>' : ''}</div>`).join('')}
  </div>
 </div>
 <div class="card" style="right:0;bottom:0;width:400px;padding:30px 34px 32px">
  <div class="lbl">Το προστιμο</div>
  <div style="margin-top:14px;font-size:96px;line-height:1;font-weight:800;letter-spacing:-.04em">${amaPct}%</div>
  <div style="margin-top:12px;font-size:23px;line-height:1.4;color:#aebbd0">των ακαθάριστων εσόδων της χρονιάς, <b style="color:#f1f5fc">τουλάχιστον ${eur(AMA_MIN)}</b></div>
 </div>`),

// 2 · Ο μηχανισμός: δύο πρόστιμα, δύο έλεγχοι
frame(2, 'Πως δουλευει',
 'Δύο πρόστιμα.<br><span class="a">Δύο έλεγχοι.</span>',
 'Το ένα αφορά τον ΑΜΑ, το άλλο το ίδιο το ακίνητο. <b>Μετρούν χωριστά.</b>', `
 <div class="card" style="left:0;right:0;top:0;padding:28px 36px 30px">
  <div class="row"><div class="lbl">ΑΜΑ στο Μητρωο και στην αγγελια</div><span class="pill wa">ΑΑΔΕ</span></div>
  <div style="margin-top:16px;display:flex;align-items:baseline;gap:22px">
   <div style="font-size:72px;line-height:1;font-weight:800;letter-spacing:-.04em">${amaPct}%</div>
   <div style="font-size:24px;line-height:1.35;color:#aebbd0">των ακαθάριστων εσόδων της χρονιάς</div>
  </div>
  <div style="margin-top:18px;display:flex;gap:14px;flex-wrap:wrap">
   <span class="pill bl">Τουλάχιστον ${eur(AMA_MIN)}</span><span class="pill bl">Διπλάσιο σε νέα παράβαση μέσα σε έναν χρόνο</span>
  </div>
 </div>
 <div class="card" style="left:0;right:0;bottom:0;padding:28px 36px 30px">
  <div class="row"><div class="lbl">Προδιαγραφες καταλληλοτητας</div><span class="pill wa">Υπουργείο Τουρισμού</span></div>
  <div style="margin-top:20px;display:flex;flex-direction:column;gap:12px">
   ${SPEC_LADDER.map(([amt, l], i) => `
   <div style="display:grid;grid-template-columns:330px 1fr;align-items:center;gap:22px">
    <div style="font-size:23px;color:#d6dfec">${l}</div>
    <div style="height:50px;width:${Math.round(34 + 66 * (amt / SPEC_LADDER[2][0]))}%;border-radius:12px;background:${i === 2 ? 'linear-gradient(90deg,#3d7ef0,#8ab4f8)' : 'rgba(138,180,248,.24)'};display:flex;align-items:center;justify-content:flex-end;padding:0 18px;font-size:26px;font-weight:800;white-space:nowrap">${eur(amt)}</div>
   </div>`).join('')}
  </div>
  <div style="margin-top:16px;font-size:21px;line-height:1.4;color:#7d8da6">Μετά από επιτόπιο έλεγχο. Το ίδιο σε άρνηση εισόδου στον έλεγχο.</div>
 </div>`),

// 3 · Το παράδειγμα, από τον υπολογιστή
frame(3, 'Παραδειγμα',
 'Ένα πεδίο λείπει.<br><span class="a">Μια χρονιά χάνεται.</span>',
 'Το διαμέρισμα του υπολογιστή «Βραχυχρόνια ή μακροχρόνια», με τις προεπιλογές του. <b>Χωρίς ΑΜΑ στην αγγελία.</b>', `
 <div class="card" style="left:0;top:0;width:540px;padding:22px 34px 18px">
  <div class="row" style="padding:6px 0 10px"><div class="lbl">Ο λογαριασμος</div><span class="pill wa">Παράδειγμα</span></div>
  <div class="led"><span>Τιμή ανά βράδυ</span><b>${eur(svlInput.nightlyPrice)}</b></div>
  <div class="led"><span>Πληρότητα</span><b>${svlInput.occupancyPct}% · ${fn(S.nights)} βράδια</b></div>
  <div class="led"><span>Ακαθάριστα χρονιάς</span><b>${eur(S.gross)}</b></div>
  <div class="led" style="font-size:23px;color:#aebbd0"><span>${amaPct}% των ακαθάριστων</span><b style="color:#d6dfec">${eur(S.gross * AMA_RATE)}</b></div>
  <div class="led" style="font-size:23px;color:#aebbd0"><span>Κατώτατο</span><b style="color:#d6dfec">${eur(AMA_MIN)}</b></div>
  <div class="led" style="font-size:28px"><span style="font-weight:700;color:#f1f5fc">Πρόστιμο</span><b style="font-size:36px;color:#f0c97d">${eur(FINE)}</b></div>
  <div style="padding:6px 0 4px;font-size:19px;color:#7d8da6">Ισχύει το μεγαλύτερο από τα δύο.</div>
 </div>
 <div class="card" style="right:0;top:30px;width:360px;padding:30px 32px">
  <div class="lbl">Τα καθαρα της χρονιας</div>
  <div style="margin-top:14px;font-size:60px;line-height:1;font-weight:800;letter-spacing:-.04em">${eur(S.net)}</div>
  <div style="margin-top:12px;font-size:20px;line-height:1.4;color:#aebbd0">μετά από φόρο, προμήθεια και λειτουργικά, όπως τα βγάζει ο υπολογιστής</div>
 </div>
 <div class="card" style="right:0;top:350px;width:360px;padding:30px 32px">
  <div class="lbl">Το προστιμο</div>
  <div style="margin-top:14px;font-size:60px;line-height:1;font-weight:800;letter-spacing:-.04em;color:#f0c97d">${eur(FINE)}</div>
  <div style="margin-top:18px"><span class="pill wa">${eur(FINE - S.net)} πάνω από τα καθαρά</span></div>
 </div>`),

// 4 · Τι ελέγχεις: τα βήματα και οι πηγές
frame(4, 'Τι κανεις',
 'Τι ελέγχεις<br><span class="a">αυτή την εβδομάδα.</span>',
 'Ό,τι ζητά ο νόμος, με την πηγή δίπλα. <b>Πριν τον επόμενο επισκέπτη.</b>', `
 <div class="card" style="left:0;right:0;top:0;padding:24px 36px;display:flex;flex-direction:column;gap:12px;font-size:23px">
  <div class="li">${tick('#5fd4a8')}<span>Ο ΑΜΑ σε εμφανές σημείο σε κάθε αγγελία: Airbnb, Booking και κάθε άλλο μέσο προβολής.</span></div>
  <div class="li">${tick('#5fd4a8')}<span>Οι ${STR_SPECS.length} προδιαγραφές του νόμου, από ${STR_SPECS_FROM}, ανάμεσά τους ασφαλιστήριο, ρελέ διαρροής, πυρασφάλεια και φαρμακείο.</span></div>
  <div class="li">${tick('#5fd4a8')}<span>Οι αναχωρήσεις του ${DECL_MONTH} δηλώνονται στο myAADE έως ${grDate(DECL.date)}.</span></div>
  <div class="li">${tick('#9ec0ff')}<span>Στις ζώνες της αναστολής ο ΑΜΑ δεν περνά στον αγοραστή. Εκεί νέα εγγραφή δεν γίνεται έως ${grDate(ATHENS.to)}. ${FREEZE_NOTE}</span></div>
 </div>
 <div class="card" style="left:0;right:0;bottom:0;padding:24px 36px">
  <div class="lbl" style="margin-bottom:10px">Πηγες</div>
  <div class="src"><b>Αναγραφή ΑΜΑ:</b> ${LIST_BASIS}.</div>
  <div class="src" style="margin-top:6px"><b>Πρόστιμο ΑΜΑ:</b> ${AMA_BASIS}.</div>
  <div class="src" style="margin-top:6px"><b>Προδιαγραφές και πρόστιμο:</b> ${STR_SPECS_LAW} (${STR_SPECS_FEK}), παρ. 5 και 6.</div>
 </div>`),

// 5 · Το κλείσιμο: ο οδηγός και ο υπολογιστής
frame(5, 'Ο οδηγος της εβδομαδας',
 `${GUIDE_T1}:<br><span class="a">${GUIDE_T2}.</span>`,
 'Το μητρώο, οι ζώνες, οι προδιαγραφές, τα πρόστιμα και οι μηνιαίες υποχρεώσεις. <b>Με πηγή σε κάθε κανόνα.</b>', `
 <div class="card" style="left:0;top:10px;width:440px;padding:32px 34px">
  <div class="lbl">Ο οδηγος</div>
  <div class="t" style="margin-top:12px">${GUIDE.title}</div>
  <div style="margin-top:10px;font-size:22px;line-height:1.4;color:#aebbd0">${GUIDE.desc}</div>
 </div>
 <div class="card" style="right:0;bottom:12px;width:430px;padding:30px 34px;transform:rotate(1.5deg)">
  <div class="lbl">Ο υπολογιστης</div>
  <div class="t" style="margin-top:12px">Βραχυχρόνια ή μακροχρόνια</div>
  <div style="margin-top:16px;display:flex;flex-direction:column;gap:12px">
   ${['Με το τέλος ανθεκτικότητας και την προμήθεια', 'Δείχνει από ποια πληρότητα συμφέρει', 'Χωρίς λογαριασμό'].map(x => `<div class="li" style="font-size:22px">${tick('#5fd4a8', 0.8)}${x}</div>`).join('')}
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
  const file = join(OUT, `properwise-vraxyxronia-ama-${i + 1}.png`);
  await p.screenshot({ path: file });
  files.push(file);
}
// Το PDF: μία σελίδα ανά διαφάνεια, ίδιο μέγεθος, για το «Add a document» του LinkedIn.
const pdf = await browser.newPage();
await pdf.setContent(`<!doctype html><html><head><style>@page{size:1080px 1350px;margin:0}body{margin:0}img{display:block;width:1080px;height:1350px;page-break-after:always}</style></head><body>${
  files.map(x => `<img src="data:image/png;base64,${b64(x)}">`).join('')}</body></html>`, { waitUntil: 'load' });
await pdf.pdf({ path: join(OUT, 'properwise-vraxyxronia-ama.pdf'), width: '1080px', height: '1350px', printBackground: true });
await browser.close();
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('✓', files.length, 'διαφάνειες και PDF στο', OUT);
