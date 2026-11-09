// ═══════════════════════════════════════════════════════════════════════════
// LINKEDIN · ΤΡΙΤΗ 10.11.2026 · «Η ΠΥΛΗ ΤΩΝ ΛΟΓΙΣΤΙΚΩΝ ΓΡΑΦΕΙΩΝ»
// ─────────────────────────────────────────────────────────────────────────
// Έξι κάθετες διαφάνειες 4:5 (1080×1350, αποδίδονται ×2) και ένα PDF για το
// «Add a document». Μία ιδέα ανά διαφάνεια: τίτλος δύο γραμμών, μία γραμμή
// εξήγησης, μία συσκευή.
//
//   1. «Στείλε μου τα χαρτιά ως την Παρασκευή.»  MacBook και iPhone
//   2. Όλοι οι πελάτες, μία λίστα                  MacBook και μεγέθυνση
//   3. Ζήτησέ το, χωρίς τηλέφωνο                   δύο iPhone
//   4. Το κλειδί το κρατά ο ιδιοκτήτης             τρία επίπεδα, δύο iPhone
//   5. Η ομάδα, με ρόλους                          MacBook και iPhone
//   6. Η πύλη για λογιστικά γραφεία                σύνδεσμος και χρέωση
//
// ΤΟ ΥΦΟΣ ΕΙΝΑΙ ΤΟΥ ΕΞΩΦΥΛΛΟΥ (Facebook, 09.11): σκούρο μπλε, μαλακό μπλε φως,
// πλέγμα που σβήνει, Inter Tight 800 με μπλε τόνο στις λέξεις-κλειδιά, το
// αληθινό λογότυπο. Οι συσκευές ζωγραφίζονται σε CSS, ΧΩΡΙΣ στροφή σε τρεις
// διαστάσεις (θολώνει το κείμενο) και χωρίς σήμα τρίτου.
//
// ΚΑΘΑΡΕΣ ΟΘΟΝΕΣ. Κάθε οθόνη φωτογραφίζεται με deviceScaleFactor τέτοιο ώστε
// ένα εικονοστοιχείο της φωτογραφίας να πέφτει ακριβώς σε ένα εικονοστοιχείο
// της διαφάνειας ×2. Καμία εικόνα δεν μικραίνει ή μεγαλώνει μέσα στη σελίδα·
// το κείμενο της εφαρμογής το ραστεροποιεί ο Chromium στο τελικό μέγεθος.
//
// ΟΙ ΟΘΟΝΕΣ ΕΙΝΑΙ ΟΙ ΑΛΗΘΙΝΕΣ: ο πάγκος (scripts/perf-bench/firms.tsx) αποδίδει
// τα ίδια components με την εφαρμογή. Πριν τη φωτογραφία αλλάζουν μόνο τα
// επινοημένα ονόματα του πάγκου σε ρεαλιστικά ελληνικά (ΟΝΟΜΑΤΑ), φεύγουν ΑΦΜ,
// διευθύνσεις email και τα στοιχεία του γραφείου, σβήνει κάθε περίγραμμα
// εστίασης. Αν ένα όνομα του πάγκου δεν βρεθεί ή μείνει υπόλειμμά του, η
// μηχανή σταματά: οι οθόνες άλλαξαν.
//
// ΚΑΝΕΝΑ ΚΕΙΜΕΝΟ ΤΗΣ ΕΦΑΡΜΟΓΗΣ ΜΕ ΤΟ ΧΕΡΙ. Ρόλοι και επίπεδα από το
// lib/data/firms.ts· οι μέρες της αναίρεσης από το lib/legal/firms.ts· η
// πρόταση της χρέωσης από το lib/legal/billingWords.ts, αυτούσια (η πρώτη
// πρόταση του `firmAccount`).
//
// Τρέξε: node scripts/perf-bench/build-mobile.mjs
//        npx tsx scripts/marketing/linkedin-pyli-logisti.mjs [έξοδος]
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { join, resolve } from 'node:path';
import { chromePath } from '../lib/chrome.mjs';
import { ROLE_LABEL, ROLES, LEVEL_LABEL, LEVELS } from '../../lib/data/firms.ts';
import { FIRM_UNDO_DAYS } from '../../lib/legal/firms.ts';

const ROOT = process.cwd();
const R = join(ROOT, 'public');
const SLUG = 'properwise-pyli-logisti';
const BENCH = join(ROOT, '.perf-bench/mobile.html');
if (!fs.existsSync(BENCH)) throw new Error('Λείπει ο πάγκος: node scripts/perf-bench/build-mobile.mjs');
const OUT = resolve(process.argv[2] || join(ROOT, 'docs/marketing/profil/linkedin-pyli-logisti'));
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ── Τα γεγονότα ──────────────────────────────────────────────────────────
// Η διαφάνεια 4 λέει «σήμερα ή χθες»· στέκει όσο η αναίρεση κρατά δύο μέρες.
if (FIRM_UNDO_DAYS !== 2) throw new Error(`Η αναίρεση κρατά πια ${FIRM_UNDO_DAYS} μέρες· η διαφάνεια 4 θέλει νέα διατύπωση.`);
if (LEVELS.length !== 3 || ROLES.length !== 3) throw new Error('Τα επίπεδα ή οι ρόλοι δεν είναι πια τρία· οι διαφάνειες 4 και 5 θέλουν νέα διάταξη.');
// Η πρόταση της χρέωσης: η πρώτη πρόταση του `firmAccount`. Οι δύο ελληνικές
// εκδοχές (με και χωρίς ενεργό ταμείο) πρέπει να ξεκινούν με την ίδια δήλωση.
const BW = fs.readFileSync(join(ROOT, 'lib/legal/billingWords.ts'), 'utf8');
const firmLines = [...BW.matchAll(/^ {2}firmAccount:\s*\n\s*'([^']+)'/gm)].map(x => x[1]).filter(x => x.startsWith('Ο λογαριασμός'));
if (firmLines.length !== 2) throw new Error('Δεν βρέθηκαν οι δύο ελληνικές εκδοχές του firmAccount στο lib/legal/billingWords.ts.');
const firstSentence = s => s.slice(0, s.indexOf('.') + 1);
const CLAIM = 'Ο λογαριασμός γραφείου δεν χρεώνεται: το γραφείο και τα μέλη του δεν πληρώνουν';
if (!firmLines.every(x => x.startsWith(CLAIM))) throw new Error('Οι δύο εκδοχές του firmAccount δεν ξεκινούν πια με την ίδια δήλωση.');
const BILLING = firstSentence(firmLines[0]);
const lc = s => s.charAt(0).toLocaleLowerCase('el') + s.slice(1);

// ── Οι οθόνες, από τον πάγκο ─────────────────────────────────────────────
// Τα επινοημένα ονόματα του πάγκου → ρεαλιστικά ελληνικά. Επινοημένα κι αυτά.
const ONOMATA = [
  ['maria.ypodeigmatos@example.com', 'Μαρία Γεωργίου'],
  ['Λογιστικό Γραφείο Παράδειγμα', 'Λογιστικό Γραφείο Κωνσταντίνου'],
  ['Φοροτεχνικό Γραφείο Υπόδειγμα', 'Φοροτεχνικό Γραφείο Σταθοπούλου'],
  ['Γιώργος Παραδείγματος', 'Γιώργος Παπαδόπουλος'],
  ['Ελένη Παραδείγματος', 'Ελένη Κωνσταντίνου'],
  ['Νίκος Δοκιμής', 'Νίκος Αλεξίου'],
  ['Κώστας Δοκιμαστής', 'Κώστας Μαυρίδης'],
  ['Άννα Υποδείγματος', 'Άννα Θεοδώρου'],
  ['Οδός Παραδείγματος', 'Σόλωνος'],
  ['ΔΕΗ Οκτωβρίου', 'Ρεύμα Οκτωβρίου'],
];
// Όσα πρέπει να βρεθούν σε κάποια σκηνή· τα υπόλοιπα είναι δίχτυ.
const MUST = ['Λογιστικό Γραφείο Παράδειγμα', 'Γιώργος Παραδείγματος', 'Ελένη Παραδείγματος', 'Νίκος Δοκιμής', 'maria.ypodeigmatos@example.com', 'Οδός Παραδείγματος'];
// Υπόλειμμα του πάγκου που δεν πρέπει να φανεί σε καμία φωτογραφία.
const LEFTOVER = /Παράδειγ|Υπόδειγ|Υποδείγ|Δοκιμ|example\.com|ΑΦΜ\s*\d|Νέοι Όροι/;

const browser = await chromium.launch({ executablePath: chromePath() });
const seen = new Set();
const pngSize = buf => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

/** Καθαρίζει μια σκηνή του πάγκου: ονόματα, ΑΦΜ, email, εστίαση, στοιχεία γραφείου. */
const clean = map => {
  const st = document.createElement('style');
  st.textContent = '*:focus,*:focus-visible,*:focus-within{outline:none!important}*:focus,*:focus-visible{box-shadow:none!important}';
  document.head.append(st);
  document.activeElement?.blur?.();
  const leaves = () => [...document.querySelectorAll('body *')].filter(e => e.childElementCount === 0);
  const hide = el => { if (el) el.style.display = 'none'; };
  // Η πρόσκληση σε αναμονή φαίνεται μόνο με email: φεύγει όλη η γραμμή.
  for (const leaf of leaves().filter(e => e.textContent.trim() === 'neo.melos@example.com')) {
    let row = leaf;
    while (row.parentElement && row.parentElement.childElementCount < 3) row = row.parentElement;
    hide(row);
  }
  // Τα στοιχεία του γραφείου (ΑΦΜ, τηλέφωνο, διεύθυνση): φεύγει η ενότητα.
  for (const leaf of leaves().filter(e => /^Στοιχεία γραφείου$/i.test(e.textContent.trim()))) {
    hide(leaf.nextElementSibling);
    hide(leaf);
  }
  // Η ειδοποίηση για νέους όρους δεν ανήκει στη σκηνή.
  for (const leaf of leaves().filter(e => /Νέοι Όροι/.test(e.textContent))) {
    let box = leaf;
    while (box.parentElement && box.parentElement !== document.body && getComputedStyle(box).borderTopStyle === 'none' && getComputedStyle(box).position === 'static') box = box.parentElement;
    hide(box);
  }
  const found = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    let t = n.textContent;
    for (const [a, b] of map) if (t.includes(a)) { t = t.split(a).join(b); found.push(a); }
    t = t.replace(/\s*·\s*ΑΦΜ \d{9}/g, '').replace(/^ΑΦΜ \d{9}\s*·\s*/, '').replace(/[\w.]+@example\.com\s*·\s*/g, '');
    if (t !== n.textContent) n.textContent = t;
  }
  // Το ΑΦΜ έρχεται συχνά σε δύο κομμάτια κειμένου («· ΑΦΜ » και ο αριθμός).
  for (const el of leaves()) {
    const t = el.textContent.replace(/\s*·\s*ΑΦΜ\s*\d{9}/g, '').replace(/^ΑΦΜ\s*\d{9}\s*·\s*/, '').replace(/\s*ΑΦΜ\s*\d{9}/g, '');
    if (t !== el.textContent) el.textContent = t;
  }
  // Το αρχικό του δοκιμαστικού email στη στρογγυλή εικόνα του λογαριασμού.
  for (const el of leaves()) if (el.textContent === 'D') el.textContent = 'Ε';
  // Το χρώμα στην κορυφή της οθόνης (με ό,τι επικάλυμμα έχει από πάνω): εκεί
  // κάθεται η γραμμή κατάστασης του iPhone ή η λωρίδα της εγκοπής του MacBook.
  const rgba = c => { const m = c.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0]; return [m[0], m[1], m[2], m[3] ?? 1]; };
  let col = [0, 0, 0];
  for (const el of document.elementsFromPoint(innerWidth / 2, 2).reverse()) {
    const [r, g, b, a] = rgba(getComputedStyle(el).backgroundColor);
    if (a > 0) col = [col[0] * (1 - a) + r * a, col[1] * (1 - a) + g * a, col[2] * (1 - a) + b * a];
  }
  return { found, top: `rgb(${col.map(Math.round).join(',')})`, text: document.body.innerText };
};

/**
 * Μία οθόνη του πάγκου, φωτογραφημένη στο τελικό της πλάτος.
 * `width` είναι το πλάτος της οθόνης ΜΕΣΑ στη διαφάνεια (px διαφάνειας).
 * Η διαφάνεια αποδίδεται ×2, άρα η φωτογραφία βγαίνει 2·width εικονοστοιχεία.
 */
async function screen(scene, { device, width, prep, clip }) {
  const vp = device === 'phone' ? { width: 393, height: 798 } : { width: 1440, height: 900 };
  const scale = clip?.scale ?? width / vp.width;
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 * scale, locale: 'el-GR', colorScheme: 'dark' });
  const p = await ctx.newPage();
  await p.goto(`file://${BENCH}?c=${scene}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  if (prep) await prep(p);
  const res = await p.evaluate(clean, ONOMATA);
  res.found.forEach(h => seen.add(h));
  const left = res.text.match(LEFTOVER);
  if (left) throw new Error(`Σκηνή ${scene}: έμεινε «${left[0]}» του πάγκου στην οθόνη.`);
  await p.evaluate(() => document.activeElement?.blur?.());
  await p.waitForTimeout(300);
  let box;
  if (clip) {
    box = await p.evaluate(clip.find);
    if (!box) throw new Error(`Σκηνή ${scene}: δεν βρέθηκε η περιοχή της μεγέθυνσης.`);
  }
  const buf = await p.screenshot(box ? { clip: box } : {});
  await ctx.close();
  const { w, h } = pngSize(buf);
  return { src: `data:image/png;base64,${buf.toString('base64')}`, w: w / 2, h: h / 2, top: res.top };
}

// Η σημείωση του λογιστή στο «Ζήτησέ το», όπως θα τη γράφαμε.
const typeNote = async p => {
  await p.fill('textarea', 'Και τις αποδείξεις του Οκτωβρίου, όποτε μπορείς.');
  await p.evaluate(() => document.activeElement?.blur?.());
};
// Η μεγέθυνση της διαφάνειας 2: η κάρτα του πρώτου πελάτη, με το «Τι λείπει».
const firstClientCard = () => {
  const leaf = [...document.querySelectorAll('*')].find(e => e.childElementCount === 0 && e.textContent.trim() === 'Τι λείπει');
  let c = leaf;
  while (c && !(parseFloat(getComputedStyle(c).borderTopLeftRadius) >= 12 && getComputedStyle(c).borderTopStyle !== 'none')) c = c.parentElement;
  if (!c) return null;
  const r = c.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
};

const LAP_A = 800; // MacBook με iPhone μπροστά (1, 5)
const LAP_B = 832; // MacBook μόνο του, σε όλο το πλάτος (2)
const PH_A = 286; // iPhone μπροστά από MacBook
const PH_B = 318; // δύο iPhone δίπλα δίπλα (3)
const PH_C = 286; // δύο iPhone κάτω από τα επίπεδα (4)

const S = {
  ws: await screen('firmWorkspace', { device: 'laptop', width: LAP_A }),
  wsBig: await screen('firmWorkspace', { device: 'laptop', width: LAP_B }),
  wsZoom: await screen('firmWorkspace', { device: 'laptop', clip: { scale: 0.7, find: firstClientCard } }),
  owner: await screen('firmOwner', { device: 'phone', width: PH_A }),
  ask: await screen('firmAsk', { device: 'phone', width: PH_B, prep: typeNote }),
  sent: await screen('firmAskSent', { device: 'phone', width: PH_B }),
  revoke: await screen('firmOwnerRevoke', { device: 'phone', width: PH_C }),
  day: await screen('firmOwnerDay', { device: 'phone', width: PH_C }),
  firm: await screen('firm', { device: 'laptop', width: LAP_A }),
  mfa: await screen('firmSecondStep', { device: 'phone', width: PH_A }),
};
for (const a of MUST) if (!seen.has(a)) throw new Error(`Το όνομα «${a}» δεν βρέθηκε στον πάγκο· οι σκηνές άλλαξαν.`);

// ── Οι συσκευές ──────────────────────────────────────────────────────────
const b64 = p => fs.readFileSync(p).toString('base64');
const f = n => `data:font/woff2;base64,${b64(`${R}/fonts/${n}`)}`;
const LOGO = `data:image/svg+xml;base64,${b64(`${R}/brand/properwise-logotypo-lefko.svg`)}`;
const MARK = `data:image/svg+xml;base64,${b64(`${R}/brand/properwise-simvolo-lefko.svg`)}`;
const N = 6;

const tag = '<span class="tag">Παράδειγμα</span>';

// Η γραμμή κατάστασης του iPhone: ώρα, σήμα, Wi-Fi, μπαταρία. Μόνο σχήματα CSS
// (ο φύλακας brand-mark δεν θέλει χειρόγραφες διαδρομές SVG σε σενάρια).
const statusBar = (k, bg) => {
  const u = v => `${Math.round(v * k * 100) / 100}px`;
  return `<div class="sb" style="height:${Math.round(54 * k)}px;background:${bg};padding:0 ${u(30)} 0 ${u(50)};font-size:${u(17)}">
  <span>9:41</span>
  <span class="ic" style="gap:${u(6)}">
   <i class="sig" style="gap:${u(2)};height:${u(12)}">${[4, 6.5, 9, 12].map(h => `<b style="width:${u(3)};height:${u(h)};border-radius:${u(1)}"></b>`).join('')}</i>
   <i class="wifi" style="width:${u(17)};height:${u(12)}">${[17, 11, 5].map(d => `<b style="width:${u(d)};height:${u(d)};border-width:${u(2.2)};left:${u((17 - d) / 2)};top:${u((17 - d) / 2 + 1.2)}"></b>`).join('')}</i>
   <i class="bat" style="width:${u(25)};height:${u(12)};border-radius:${u(4)};padding:${u(2)}"><b style="border-radius:${u(2)}"></b><s style="width:${u(1.6)};height:${u(4)};right:${u(-3.2)}"></s></i>
  </span></div>`;
};

/** iPhone: τιτάνιο, μαύρο πλαίσιο, Dynamic Island, γραμμή κατάστασης, οθόνη. */
const iphone = (shot, { x, y, label = true, z = 2 }) => {
  const k = shot.w / 393;
  const sb = Math.round(54 * k);
  const bez = Math.round(11 * k);
  const ri = Math.round(55 * k);
  const W = shot.w + 2 * (bez + 3);
  const H = sb + shot.h + 2 * (bez + 3);
  return `<div class="phone" style="left:${x}px;top:${y}px;width:${W}px;height:${H}px;border-radius:${ri + bez + 3}px;z-index:${z}">
  <i class="btn" style="left:-3px;top:${Math.round(H * 0.17)}px;height:${Math.round(H * 0.045)}px"></i>
  <i class="btn" style="left:-3px;top:${Math.round(H * 0.25)}px;height:${Math.round(H * 0.08)}px"></i>
  <i class="btn" style="left:-3px;top:${Math.round(H * 0.35)}px;height:${Math.round(H * 0.08)}px"></i>
  <i class="btn" style="right:-3px;top:${Math.round(H * 0.28)}px;height:${Math.round(H * 0.12)}px"></i>
  <div class="bez" style="padding:${bez}px;border-radius:${ri + bez}px">
   <div class="scr" style="border-radius:${ri}px">
    <i class="island" style="width:${Math.round(124 * k)}px;height:${Math.round(36 * k)}px;top:${Math.round(11 * k)}px;margin-left:${-Math.round(62 * k)}px"></i>
    ${statusBar(k, shot.top)}
    <img src="${shot.src}" style="width:${shot.w}px;height:${shot.h}px" alt="">
    <i class="glare"></i>
   </div>
  </div>
  ${label ? tag : ''}
 </div>`;
};

/** MacBook: λεπτό μαύρο πλαίσιο, εγκοπή, άρθρωση, αλουμινένια βάση με την εσοχή. */
const macbook = (shot, { x, y, label = true }) => {
  const sw = shot.w;
  const band = Math.round(sw * 0.026);
  const side = Math.round(sw * 0.016);
  const top = Math.round(sw * 0.018);
  const bottom = Math.round(sw * 0.02);
  const lidW = sw + 2 * side + 4;
  const lidH = band + shot.h + top + bottom + 4;
  const baseW = Math.round(lidW * 1.05 / 2) * 2;
  const baseH = Math.round(sw * 0.022);
  const notchW = Math.round(sw * 0.075);
  return `<div class="mac" style="left:${x}px;top:${y}px;width:${baseW}px">
  <div class="lid" style="width:${lidW}px;height:${lidH}px;margin:0 auto;border-radius:${Math.round(sw * 0.026)}px ${Math.round(sw * 0.026)}px ${Math.round(sw * 0.008)}px ${Math.round(sw * 0.008)}px">
   <div class="lbez" style="padding:${top}px ${side}px ${bottom}px;border-radius:${Math.round(sw * 0.024)}px ${Math.round(sw * 0.024)}px ${Math.round(sw * 0.006)}px ${Math.round(sw * 0.006)}px">
    <div class="lscr" style="border-radius:${Math.round(sw * 0.011)}px ${Math.round(sw * 0.011)}px 0 0">
     <div style="height:${band}px;background:${shot.top}"></div>
     <i class="notch" style="width:${notchW}px;height:${band}px;margin-left:${-notchW / 2}px;border-radius:0 0 ${Math.round(band * 0.4)}px ${Math.round(band * 0.4)}px"></i>
     <img src="${shot.src}" style="width:${shot.w}px;height:${shot.h}px" alt="">
     <i class="glare"></i>
    </div>
   </div>
  </div>
  <div class="hinge" style="width:${Math.round(lidW * 0.94)}px;height:${Math.max(4, Math.round(sw * 0.006))}px"></div>
  <div class="base" style="height:${baseH}px;border-radius:0 0 ${Math.round(baseW * 0.06)}px ${Math.round(baseW * 0.06)}px / 0 0 ${baseH}px ${baseH}px">
   <i class="lip" style="width:${Math.round(baseW * 0.15)}px;height:${Math.round(baseH * 0.42)}px;margin-left:${-Math.round(baseW * 0.075)}px"></i>
  </div>
  ${label ? tag : ''}
 </div>`;
};
/** Ύψος MacBook για ένα πλάτος οθόνης, για να στοιχίζονται οι συνθέσεις. */
const macH = shot => {
  const sw = shot.w;
  return Math.round(sw * 0.026) + shot.h + Math.round(sw * 0.018) + Math.round(sw * 0.02) + 4 + Math.max(4, Math.round(sw * 0.006)) + Math.round(sw * 0.022);
};
const phoneW = shot => shot.w + 2 * (Math.round(11 * shot.w / 393) + 3);
const phoneH = shot => Math.round(54 * shot.w / 393) + shot.h + 2 * (Math.round(11 * shot.w / 393) + 3);

// ── Η σελίδα ─────────────────────────────────────────────────────────────
// Πλέγμα 8px. Περιθώρια 88. Λογότυπο και πρόοδος στο 72, ετικέτα κοινού στο
// 168, τίτλος στο 208, εξήγηση από κάτω· η σκηνή από το 544 ως το 1262.
const M = 88;
const STAGE = { top: 544, bottom: 1350 - M };
const css = `
@font-face{font-family:Inter;font-weight:100 900;src:url(${f('inter-greek.woff2')})}
@font-face{font-family:Inter;font-weight:100 900;src:url(${f('inter-latin.woff2')})}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;overflow:hidden}
body{font-family:'Inter Tight',Inter,sans-serif;color:#f4f7fb;-webkit-font-smoothing:antialiased;position:relative;background:#06090f}
.bg{position:absolute;inset:0}
.grid{position:absolute;inset:0;opacity:.4;background-image:linear-gradient(rgba(138,180,248,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(138,180,248,.06) 1px,transparent 1px);background-size:48px 48px;background-position:${M % 48}px 0}
.noise{position:absolute;inset:0;opacity:.06;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.head{position:absolute;left:${M}px;right:${M}px;top:72px;height:32px;display:flex;justify-content:space-between;align-items:center}
.head img{height:26px;display:block}
.dots{display:flex;gap:8px;align-items:center}.dots b{width:8px;height:8px;border-radius:4px;background:rgba(255,255,255,.18)}.dots b.on{width:28px;background:#8ab4f8;box-shadow:0 0 12px rgba(138,180,248,.6)}
.who{position:absolute;left:${M}px;top:168px;height:24px;display:flex;align-items:center;gap:12px;font-size:20px;font-weight:600;letter-spacing:.01em;color:#8ab4f8}
.who:before{content:'';width:8px;height:8px;border-radius:50%;background:#8ab4f8;box-shadow:0 0 10px rgba(138,180,248,.8)}
h1{position:absolute;left:${M}px;top:208px;width:${1080 - 2 * M}px;font-size:80px;line-height:84px;font-weight:800;letter-spacing:-.035em;white-space:nowrap}
h1 span{display:block}
h1 em{display:block;font-style:normal;background:linear-gradient(90deg,#a9c8ff,#6f9cf0);-webkit-background-clip:text;background-clip:text;color:transparent;padding-bottom:4px;margin-bottom:-4px}
.sub{position:absolute;left:${M}px;top:400px;width:${1080 - 2 * M}px;font-size:28px;line-height:40px;font-weight:500;color:#9fabbf;letter-spacing:-.005em;text-wrap:pretty}
.sub b{color:#e8eefb;font-weight:600}
.stage{position:absolute;left:0;top:0;width:1080px;height:1350px}
.floor{position:absolute;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.7),rgba(0,0,0,0));filter:blur(12px)}
.tag{position:absolute;top:-12px;right:-10px;z-index:5;font:600 13px/1 'Inter Tight',Inter,sans-serif;letter-spacing:.02em;color:#f0d08f;padding:6px 11px;border-radius:99px;background:rgba(32,26,12,.92);box-shadow:inset 0 0 0 1px rgba(240,208,143,.35),0 6px 16px rgba(0,0,0,.5)}
/* iPhone */
.phone{position:absolute;padding:3px;background:linear-gradient(150deg,#3a4252,#1a202b 40%,#10151d 70%,#2a3140);
 box-shadow:inset 0 0 0 1px rgba(255,255,255,.14),0 50px 90px rgba(0,0,0,.65),0 14px 30px rgba(0,0,0,.45)}
.phone .btn{position:absolute;width:3px;border-radius:2px;background:linear-gradient(90deg,#2a3242,#3e4758)}
.phone .bez{background:#000;height:100%}
.phone .scr{position:relative;overflow:hidden;height:100%;background:#000}
.phone img,.mac img{display:block}
.phone .island{position:absolute;left:50%;border-radius:99px;background:#000;z-index:3}
.sb{display:flex;align-items:center;justify-content:space-between;font-weight:600;letter-spacing:-.01em;color:#f4f7fb}
.sb .ic{display:flex;align-items:center}
.sb i{display:block;position:relative}
.sig{display:flex!important;align-items:flex-end}.sig b{display:block;background:#f4f7fb}
.wifi{overflow:hidden}.wifi b{position:absolute;border-radius:50%;border-style:solid;border-color:#f4f7fb transparent transparent transparent;transform:rotate(0deg)}
.wifi b:last-child{border-color:#f4f7fb;background:#f4f7fb}
.bat{box-shadow:inset 0 0 0 1px rgba(244,247,251,.5)}.bat b{display:block;width:80%;height:100%;background:#f4f7fb}.bat s{position:absolute;top:50%;transform:translateY(-50%);border-radius:0 2px 2px 0;background:rgba(244,247,251,.5)}
.glare{position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.06),rgba(255,255,255,0) 32%);pointer-events:none;z-index:4}
/* MacBook */
.mac{position:absolute}
.lid{padding:2px;background:linear-gradient(180deg,#4b505a,#2a2d33 30%,#1d1f24)}
.lbez{background:#030304;box-shadow:inset 0 0 0 1px rgba(255,255,255,.04);height:100%}
.lscr{position:relative;overflow:hidden;background:#000}
.notch{position:absolute;left:50%;top:0;background:#030304;z-index:3}
.hinge{margin:0 auto;background:linear-gradient(180deg,#0c0d10,#3a3d44 60%,#5a5e66);border-radius:0 0 3px 3px}
.base{position:relative;background:linear-gradient(180deg,#eef0f3 0%,#c9ccd2 18%,#a9adb4 60%,#7d8189 100%);box-shadow:0 30px 60px rgba(0,0,0,.6),0 10px 20px rgba(0,0,0,.4)}
.base .lip{position:absolute;left:50%;top:0;border-radius:0 0 10px 10px;background:linear-gradient(180deg,#80848c,#b6b9bf)}
/* Κάρτα μεγέθυνσης */
.zoom{position:absolute;z-index:4;padding:10px;border-radius:26px;background:rgba(14,20,32,.72);backdrop-filter:blur(18px);
 box-shadow:inset 0 0 0 1px rgba(255,255,255,.14),0 40px 80px rgba(0,0,0,.6),0 12px 28px rgba(0,0,0,.45)}
.zoom img{display:block;border-radius:16px}
/* Επίπεδα */
.levels{position:absolute;left:${M}px;right:${M}px;display:flex;justify-content:space-between;gap:12px}
.lvl{flex:auto;padding:0 20px;height:56px;border-radius:16px;display:flex;align-items:center;justify-content:center;gap:10px;font-size:19px;font-weight:600;letter-spacing:-.01em;color:#c9d4e6;background:rgba(255,255,255,.04);box-shadow:inset 0 0 0 1px rgba(255,255,255,.10)}
.lvl.on{color:#f4f7fb;background:rgba(111,156,240,.16);box-shadow:inset 0 0 0 1.5px rgba(138,180,248,.7),0 0 24px rgba(111,156,240,.25)}
.lvl i{width:8px;height:8px;border-radius:50%;background:currentColor;opacity:.7}
/* Τέλος */
.cta{position:absolute;left:${M}px;right:${M}px;height:${STAGE.bottom - STAGE.top}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.markt{width:136px;height:136px;border-radius:36px;display:grid;place-items:center;background:linear-gradient(150deg,#1d3566,#0f1c36);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14),0 30px 70px rgba(46,98,204,.45)}
.markt img{width:76px;height:76px}
.url{margin-top:48px;display:inline-flex;align-items:center;gap:14px;padding:20px 34px;border-radius:999px;background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14);font-size:36px;font-weight:700;letter-spacing:-.01em;color:#f4f7fb}
.url b{width:12px;height:12px;border-radius:50%;background:#5fd38d;box-shadow:0 0 12px #5fd38d}
.bill{margin-top:48px;max-width:760px;font-size:24px;line-height:36px;color:#9fabbf;font-weight:500}
.bill:before{content:'';display:block;width:56px;height:2px;margin:0 auto 28px;background:rgba(138,180,248,.6)}
`;
const light = (x, y, w = 620, h = 520) => `background:
 radial-gradient(ellipse ${w}px ${h}px at ${x}px ${y}px,rgba(46,98,204,.32),rgba(46,98,204,0) 70%),
 radial-gradient(ellipse 900px 420px at 160px 0px,rgba(30,60,120,.20),rgba(0,0,0,0) 70%),
 linear-gradient(180deg,#0a0f19 0%,#06090f 100%)`;
const gridMask = (x, y) => `-webkit-mask-image:radial-gradient(ellipse 560px 480px at ${x}px ${y}px,#000 20%,transparent 75%)`;

const page = (n, { who, h1, sub, stage, lx = 540, ly = 900 }) => `<!doctype html><html lang="el"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&display=block" rel="stylesheet">
<style>${css}</style></head><body>
<div class="bg" style="${light(lx, ly)}"></div><div class="grid" style="${gridMask(lx, ly)}"></div>
<div class="stage">${stage}</div>
<div class="noise"></div>
<div class="head"><img src="${LOGO}" alt="PROPERWISE"><div class="dots">${Array.from({ length: N }, (_, i) => `<b class="${i + 1 === n ? 'on' : ''}"></b>`).join('')}</div></div>
<div class="who">${who}</div>
<h1>${h1}</h1>
<div class="sub">${sub}</div>
</body></html>`;

// ── Οι συνθέσεις ─────────────────────────────────────────────────────────
// Α: MacBook αριστερά στο περιθώριο, iPhone μπροστά δεξιά στο περιθώριο.
const comboA = (lap, ph) => {
  const mh = macH(lap), pw = phoneW(ph), phH = phoneH(ph);
  const phBottom = STAGE.bottom;
  const macTop = STAGE.top;
  return `<div class="floor" style="left:${M}px;top:${macTop + mh - 30}px;width:${lap.w + 60}px;height:70px"></div>
 ${macbook(lap, { x: M, y: macTop, label: false })}
 <div class="floor" style="left:${1080 - M - pw}px;top:${phBottom - 30}px;width:${pw}px;height:60px"></div>
 ${iphone(ph, { x: 1080 - M - pw, y: phBottom - phH })}`;
};
// Δύο iPhone, κεντραρισμένα, με κοινό κάτω όριο.
const pair = (a, b, bottom, gap = 56) => {
  const wa = phoneW(a), wb = phoneW(b);
  const x0 = Math.round((1080 - wa - wb - gap) / 2);
  return `<div class="floor" style="left:${x0 - 20}px;top:${bottom - 30}px;width:${wa + wb + gap + 40}px;height:60px"></div>
 ${iphone(a, { x: x0, y: bottom - phoneH(a), label: false })}
 ${iphone(b, { x: x0 + wa + gap, y: bottom - phoneH(b) })}`;
};

const slides = [
// 1 · Η φράση που έχει ακούσει κάθε ιδιοκτήτης από τον λογιστή του
page(1, {
  who: 'Για λογιστικά γραφεία και ιδιοκτήτες',
  h1: '<span>«Στείλε μου τα χαρτιά</span><em>ως την Παρασκευή.»</em>',
  sub: 'Τώρα το γραφείο βλέπει μόνο του <b>τι λείπει από κάθε πελάτη.</b>',
  stage: comboA(S.ws, S.owner), lx: 560, ly: 900,
}),

// 2 · Η λίστα των πελατών και το «Τι λείπει»
page(2, {
  who: 'Για το γραφείο',
  h1: '<span>Όλοι οι πελάτες.</span><em>Μία λίστα.</em>',
  sub: 'Τι λείπει από τον καθένα, <b>δίπλα στο όνομά του.</b>',
  stage: (() => {
    const mh = macH(S.wsBig);
    const z = { w: S.wsZoom.w + 20, h: S.wsZoom.h + 20 };
    return `<div class="floor" style="left:${M}px;top:${STAGE.top + mh - 30}px;width:${1080 - 2 * M}px;height:70px"></div>
 ${macbook(S.wsBig, { x: M - Math.round((Math.round((S.wsBig.w + 2 * Math.round(S.wsBig.w * 0.016) + 4) * 1.05 / 2) * 2 - (1080 - 2 * M)) / 2), y: STAGE.top, label: false })}
 <div class="zoom" style="left:${1080 - M - z.w}px;top:${STAGE.bottom - z.h}px"><img src="${S.wsZoom.src}" style="width:${S.wsZoom.w}px;height:${S.wsZoom.h}px" alt="">${tag}</div>`;
  })(), lx: 540, ly: 860,
}),

// 3 · Ζήτησέ το: το φύλλο του αιτήματος και η επιβεβαίωση
page(3, {
  who: 'Για το γραφείο',
  h1: '<span>Ζήτησέ το.</span><em>Χωρίς τηλέφωνο.</em>',
  sub: 'Το αίτημα φτάνει στη Λογιστική του πελάτη, <b>μαζί με τη σημείωσή σου.</b>',
  stage: pair(S.ask, S.sent, STAGE.bottom), lx: 540, ly: 920,
}),

// 4 · Ο ιδιοκτήτης: τρία επίπεδα, η μέρα του γραφείου, η ανάκληση
page(4, {
  who: 'Για τον ιδιοκτήτη',
  h1: '<span>Το κλειδί το κρατά</span><em>ο ιδιοκτήτης.</em>',
  sub: 'Βλέπει κάθε μέρα τι γράφτηκε. <b>Αναιρεί ό,τι μπήκε σήμερα ή χθες</b> και ανακαλεί την πρόσβαση όποτε θέλει.',
  stage: `<div class="levels" style="top:${STAGE.top}px">${LEVELS.map(l => `<div class="lvl${l === 'keep' ? ' on' : ''}"><i></i>${LEVEL_LABEL[l]}</div>`).join('')}</div>
 ${pair(S.revoke, S.day, STAGE.bottom)}`, lx: 540, ly: 960,
}),

// 5 · Η ομάδα του γραφείου: ρόλοι και δεύτερο βήμα
page(5, {
  who: 'Για το γραφείο',
  h1: '<span>Η ομάδα,</span><em>με ρόλους.</em>',
  sub: `${ROLE_LABEL[ROLES[0]]}, ${lc(ROLE_LABEL[ROLES[1]])}, ${lc(ROLE_LABEL[ROLES[2]])}. <b>Κάθε μέλος μπαίνει με επαλήθευση δύο βημάτων.</b>`,
  stage: comboA(S.firm, S.mfa), lx: 560, ly: 900,
}),

// 6 · Ο σύνδεσμος και η χρέωση του γραφείου
page(6, {
  who: 'Για λογιστικά γραφεία',
  h1: '<span>Η πύλη για</span><em>λογιστικά γραφεία.</em>',
  sub: 'Ο σύνδεσμος είναι <b>στο πρώτο σχόλιο.</b>',
  stage: `<div class="cta" style="top:${STAGE.top}px">
  <div class="markt"><img src="${MARK}" alt=""></div>
  <div class="url"><b></b>properwise.gr/logistes</div>
  <div class="bill">${BILLING}</div>
 </div>`, lx: 540, ly: 860,
}),
];

// ── Απόδοση, με έλεγχο ───────────────────────────────────────────────────
const p = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
const files = [];
const problems = [];
for (const [i, html] of slides.entries()) {
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const bad = await p.evaluate(({ M, STAGE }) => {
    const out = [];
    if (!document.fonts.check('800 80px "Inter Tight"', 'Στείλε')) out.push('δεν φορτώθηκε η Inter Tight');
    const h1 = document.querySelector('h1').getBoundingClientRect();
    const sub = document.querySelector('.sub').getBoundingClientRect();
    if (h1.height > 2 * 84 + 1) out.push('ο τίτλος πιάνει πάνω από δύο γραμμές');
    if (sub.height > 2 * 40 + 1) out.push('η εξήγηση πιάνει πάνω από δύο γραμμές');
    if (sub.bottom > STAGE.top - 24) out.push('η εξήγηση πέφτει πάνω στη σκηνή');
    for (const el of document.querySelectorAll('h1 span, h1 em, .who, .sub, .head')) {
      const r = el.getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(el);
      const t = range.getBoundingClientRect();
      if (Math.max(r.right, t.right) > 1080 - M + 1) out.push(`βγαίνει από το περιθώριο: «${el.textContent.trim().slice(0, 40)}»`);
    }
    for (const el of document.querySelectorAll('.phone, .mac, .zoom, .levels, .cta')) {
      const r = el.getBoundingClientRect();
      if (r.left < M - 24 || r.right > 1080 - M + 24 || r.top < STAGE.top - 1 || r.bottom > STAGE.bottom + 1) out.push(`η συσκευή βγαίνει από τη σκηνή (${Math.round(r.left)},${Math.round(r.top)} – ${Math.round(r.right)},${Math.round(r.bottom)})`);
    }
    // Κάθε οθόνη σε ακέραιο εικονοστοιχείο: αλλιώς ο Chromium την ξαναδειγματίζει.
    for (const img of document.querySelectorAll('.stage img')) {
      const r = img.getBoundingClientRect();
      if (img.closest('.cta')) continue;
      const on = v => Math.abs(v * 2 - Math.round(v * 2)) < 0.01;
      if (!on(r.left) || !on(r.top) || r.width * 2 !== img.naturalWidth || r.height * 2 !== img.naturalHeight) out.push(`οθόνη εκτός πλέγματος: ${r.left},${r.top} ${r.width}×${r.height} (${img.naturalWidth}×${img.naturalHeight})`);
    }
    return out;
  }, { M, STAGE });
  bad.forEach(x => problems.push(`διαφάνεια ${i + 1}: ${x}`));
  const file = join(OUT, `${SLUG}-${i + 1}.png`);
  await p.screenshot({ path: file });
  files.push(file);
}
// Το PDF: μία σελίδα ανά διαφάνεια, ίδιο μέγεθος, για το «Add a document» του LinkedIn.
const pdf = await browser.newPage();
await pdf.setContent(`<!doctype html><html><head><style>@page{size:1080px 1350px;margin:0}body{margin:0}img{display:block;width:1080px;height:1350px;page-break-after:always}</style></head><body>${
  files.map(x => `<img src="data:image/png;base64,${b64(x)}">`).join('')}</body></html>`, { waitUntil: 'load' });
await pdf.pdf({ path: join(OUT, `${SLUG}.pdf`), width: '1080px', height: '1350px', printBackground: true });
await browser.close();
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('✓', files.length, 'διαφάνειες και PDF στο', OUT);
