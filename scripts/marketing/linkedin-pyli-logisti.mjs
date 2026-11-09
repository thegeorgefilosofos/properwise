// ═══════════════════════════════════════════════════════════════════════════
// LINKEDIN · ΤΡΙΤΗ 10.11.2026 · «Η ΠΥΛΗ ΤΩΝ ΛΟΓΙΣΤΙΚΩΝ ΓΡΑΦΕΙΩΝ»
// ─────────────────────────────────────────────────────────────────────────
// Έξι κάθετες διαφάνειες 4:5 (1080×1350, αποδίδονται ×2) και ένα PDF για το
// «Add a document». Αφήγηση πρόβλημα → λύση → απόδειξη → κλείσιμο· κάθε
// τίτλος στέκει μόνος του και οι έξι μαζί λένε όλη την ιστορία:
//
//   1. «Στείλε μου τα χαρτιά ως την Παρασκευή.»   το πρόβλημα · MacBook και iPhone
//   2. Τι λείπει, το βλέπεις αμέσως.               η λίστα · MacBook
//   3. Ζητάς ό,τι λείπει. Χωρίς τηλέφωνο.          το αίτημα · iPhone
//   4. Ο ιδιοκτήτης κρατά το κλειδί.               επίπεδα, ανάκληση · iPhone
//   5. Όλη η ομάδα, ο καθένας στον ρόλο του.       ρόλοι · MacBook
//   6. Η πύλη για λογιστικά γραφεία.               σύνδεσμος και χρέωση
//
// ΤΟ ΣΥΣΤΗΜΑ. Φωτεινό, με τα tokens του φωτεινού θέματος της εφαρμογής
// (app/globals.css): καμβάς #f5f7fa (--bg-base), επιφάνεια #ffffff, μελάνι
// #0f1b2e (--text-primary), δεύτερο μελάνι #536075 (--text-tertiary), τόνος
// #1356c2 (--accent). Οι οθόνες είναι κι αυτές στο φωτεινό θέμα: μαύρο σε
// λευκό διαβάζεται σε μικρογραφία, οι μαύρες συσκευές ξεχωρίζουν στον ανοιχτό
// καμβά και η διαφάνεια δεν μοιάζει με τις σκοτεινές που γεμίζουν τη ροή.
// Τυπογραφία Inter Tight σε τέσσερα μεγέθη: 76 τίτλος, 30 εξήγηση, 22 κείμενο,
// 16 υποσέλιδο. Περιθώρια 96· ετικέτα κοινού στο 88, τίτλος στο 128, εξήγηση
// στο 312, σκηνή 440–1182, υποσέλιδο (λογότυπο, «Παράδειγμα…», «n / 6») στο
// 1232. Ίδιες θέσεις σε κάθε διαφάνεια.
//
// ΕΥΑΝΑΓΝΩΣΤΕΣ ΟΘΟΝΕΣ. Το κινητό φωτογραφίζεται σε πλάτος 330 (όπως το
// «Display Zoom» του iPhone) και μπαίνει στη διαφάνεια σχεδόν 1:1· το laptop
// σε 900×562 (16:10, σαν «μεγαλύτερο κείμενο» του macOS). Το κείμενο της
// εφαρμογής διαβάζεται σε μικρογραφία της ροής.
//
// ΚΑΘΑΡΑ ΕΙΚΟΝΟΣΤΟΙΧΕΙΑ. Κάθε οθόνη φωτογραφίζεται με deviceScaleFactor τέτοιο
// ώστε ένα εικονοστοιχείο της φωτογραφίας να πέφτει σε ένα της διαφάνειας ×2·
// καμία εικόνα δεν αλλάζει μέγεθος μέσα στη σελίδα. Οι συσκευές είναι CSS,
// χωρίς στροφή και χωρίς σήμα τρίτου. Τα φύλλα («Ζήτησέ το») κάθονται πάνω σε
// καθαρό περιεχόμενο: χωρίς θόλωμα και χωρίς σκίαση από πίσω.
//
// ΟΙ ΟΘΟΝΕΣ ΕΙΝΑΙ ΟΙ ΑΛΗΘΙΝΕΣ: ο πάγκος (scripts/perf-bench/firms.tsx) αποδίδει
// τα ίδια components με την εφαρμογή. Πριν τη φωτογραφία αλλάζουν μόνο τα
// επινοημένα ονόματα σε ρεαλιστικά ελληνικά (ΟΝΟΜΑΤΑ), φεύγουν ΑΦΜ, email και
// τα στοιχεία του γραφείου, σβήνει κάθε περίγραμμα εστίασης. Το «Ζήτησέ το»
// στέλνει μόνο στην εφαρμογή, όπως στην παραγωγή: το γραφείο δεν παίρνει
// τηλέφωνα πελατών. Αν μείνει υπόλειμμα του πάγκου ή φανεί κανάλι τρίτου
// (WhatsApp, Viber, SMS), η μηχανή σταματά.
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
// Υπόλειμμα του πάγκου ή κανάλι τρίτου που δεν πρέπει να φανεί σε φωτογραφία.
const LEFTOVER = /Παράδειγ|Υπόδειγ|Υποδείγ|Δοκιμ|example\.com|ΑΦΜ\s*\d|Νέοι Όροι|WhatsApp|Viber|SMS/;

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

// Το φύλλο κάθεται πάνω σε καθαρό περιεχόμενο: χωρίς θόλωμα και σκίαση από
// πίσω, με μια μαλακή σκιά για να ξεχωρίζει.
const flatSheet = () => {
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.position === 'fixed' && r.width >= innerWidth - 1 && r.height >= innerHeight - 1) {
      el.style.background = 'transparent';
      el.style.backdropFilter = 'none';
      el.style.webkitBackdropFilter = 'none';
    }
    if (/blur/.test(cs.filter)) el.style.filter = 'none';
    if (/blur/.test(cs.backdropFilter)) el.style.backdropFilter = 'none';
  }
  const d = document.querySelector('[role="dialog"]');
  if (d) d.style.boxShadow = '0 -10px 40px rgba(15,27,46,.14), 0 -1px 0 rgba(15,27,46,.06)';
};

// Οι διαστάσεις λήψης. Κινητό: πλάτος 330, όπως το «Display Zoom» του iPhone,
// με ύψος οθόνης στην αναλογία του iPhone (852/393) μείον τη γραμμή κατάστασης.
const PHONE_VW = 330;
const PHONE_SB = Math.round(54 * PHONE_VW / 393);
const PHONE_VH = Math.round(PHONE_VW * 852 / 393) - PHONE_SB;
const LAPTOP_VW = 900;
const LAPTOP_VH = 562;

/**
 * Μία οθόνη του πάγκου, φωτογραφημένη στο τελικό της πλάτος (`width`, σε px
 * της διαφάνειας). Η διαφάνεια αποδίδεται ×2, άρα η φωτογραφία βγαίνει
 * 2·width εικονοστοιχεία και μπαίνει χωρίς καμία αλλαγή μεγέθους.
 */
async function screen(scene, { device, width, prep, vw }) {
  const vp = device === 'phone' ? { width: PHONE_VW, height: PHONE_VH } : vw ? { width: vw, height: Math.round(vw * 10 / 16) } : { width: LAPTOP_VW, height: LAPTOP_VH };
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 * width / vp.width, locale: 'el-GR', colorScheme: 'light' });
  const p = await ctx.newPage();
  await p.goto(`file://${BENCH}?c=${scene}`, { waitUntil: 'networkidle' });
  // Το φωτεινό θέμα της εφαρμογής (ο πάγκος χτίζεται σκούρος για τους σαρωτές).
  await p.evaluate(() => document.documentElement.setAttribute('data-mode', 'light'));
  await p.waitForTimeout(1200);
  if (prep) await prep(p);
  const res = await p.evaluate(clean, ONOMATA);
  res.found.forEach(h => seen.add(h));
  const left = res.text.match(LEFTOVER);
  if (left) throw new Error(`Σκηνή ${scene}: έμεινε «${left[0]}» στην οθόνη.`);
  await p.evaluate(() => document.activeElement?.blur?.());
  await p.waitForTimeout(300);
  const buf = await p.screenshot();
  await ctx.close();
  const { w, h } = pngSize(buf);
  return { src: `data:image/png;base64,${buf.toString('base64')}`, w: w / 2, h: h / 2, top: res.top };
}

// Η σημείωση του λογιστή στο «Ζήτησέ το», όπως θα τη γράφαμε.
const askPrep = async p => {
  await p.fill('textarea', 'Και τις αποδείξεις του Οκτωβρίου, όποτε μπορείς.');
  await p.evaluate(() => document.activeElement?.blur?.());
  await p.evaluate(flatSheet);
};
// Η κάρτα του πρώτου πελάτη, από το όνομα ως το τέλος του «Τι λείπει».
// Τραβιέται σε στενότερο laptop (LIST_VW), ώστε το UI να διαβάζεται στη ροή.
const LIST_VW = 680;
const listPrep = async p => {
  const ok = await p.evaluate(() => {
    const leaf = [...document.querySelectorAll('*')].find(e => e.childElementCount === 0 && /^Τι λείπει$/i.test(e.textContent.trim()));
    let c = leaf;
    while (c && !(parseFloat(getComputedStyle(c).borderTopLeftRadius) >= 12 && getComputedStyle(c).borderTopStyle !== 'none')) c = c.parentElement;
    if (!c) return false;
    const dy = c.getBoundingClientRect().top - 16;
    // Η σελίδα κυλά είτε στο παράθυρο είτε σε δικό της στοιχείο.
    let sc = c.parentElement;
    while (sc && !(sc.scrollHeight > sc.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    (sc ?? document.scrollingElement).scrollBy(0, dy);
    const r = c.getBoundingClientRect();
    return Math.abs(r.top - 16) < 2 && r.bottom <= innerHeight;
  });
  if (!ok) throw new Error('Η κάρτα του πρώτου πελάτη δεν χωρά ολόκληρη στην οθόνη του laptop· οι οθόνες άλλαξαν.');
  await p.waitForTimeout(300);
};

// Τα μέλη του γραφείου, από την ετικέτα «Μέλη» ως την τελευταία γραμμή, στο
// ίδιο στενότερο laptop.
const teamPrep = async p => {
  const ok = await p.evaluate(() => {
    const leaf = [...document.querySelectorAll('*')].find(e => e.childElementCount === 0 && /^Μέλη$/i.test(e.textContent.trim()));
    if (!leaf) return false;
    const dy = leaf.getBoundingClientRect().top - 24;
    let sc = leaf.parentElement;
    while (sc && !(sc.scrollHeight > sc.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    (sc ?? document.scrollingElement).scrollBy(0, dy);
    return Math.abs(leaf.getBoundingClientRect().top - 24) < 2;
  });
  if (!ok) throw new Error('Δεν βρέθηκε η ενότητα «Μέλη»· οι οθόνες άλλαξαν.');
  await p.waitForTimeout(300);
};

// ── Οι συσκευές ──────────────────────────────────────────────────────────
const b64 = p => fs.readFileSync(p).toString('base64');
const LOGO = `data:image/svg+xml;base64,${b64(`${R}/brand/properwise-logotypo-skouro.svg`)}`;
const MARK = `data:image/svg+xml;base64,${b64(`${R}/brand/properwise-simvolo-skouro.svg`)}`;
const N = 6;

// Η γραμμή κατάστασης του iPhone: ώρα, σήμα, Wi-Fi, μπαταρία. Μόνο σχήματα CSS
// (ο φύλακας brand-mark δεν θέλει χειρόγραφες διαδρομές SVG σε σενάρια).
const statusBar = (k, bg, h) => {
  const u = v => `${Math.round(v * k * 100) / 100}px`;
  return `<div class="sb" style="height:${h}px;background:${bg};padding:0 ${u(26)} 0 ${u(42)};font-size:${u(15)}">
  <span>9:41</span>
  <span class="ic" style="gap:${u(5)}">
   <i class="sig" style="gap:${u(1.7)};height:${u(10.5)}">${[3.5, 5.5, 8, 10.5].map(v => `<b style="width:${u(2.7)};height:${u(v)};border-radius:${u(0.8)}"></b>`).join('')}</i>
   <i class="wifi" style="width:${u(15)};height:${u(10.5)}">${[15, 9.6, 4.4].map(d => `<b style="width:${u(d)};height:${u(d)};border-width:${u(2)};left:${u((15 - d) / 2)};top:${u((15 - d) / 2 + 1)}"></b>`).join('')}</i>
   <i class="bat" style="width:${u(23)};height:${u(11)};border-radius:${u(3.4)};padding:${u(1.8)}"><b style="border-radius:${u(1.8)}"></b><s style="width:${u(1.4)};height:${u(3.8)};right:${u(-2.8)}"></s></i>
  </span></div>`;
};

/** Οι διαστάσεις ενός iPhone για μια οθόνη. */
const phoneBox = shot => {
  const k = shot.w / PHONE_VW;
  const sb = Math.round(PHONE_SB * k);
  const bez = Math.round(10 * k);
  const ri = Math.round(46 * k);
  return { k, sb, bez, ri, W: shot.w + 2 * (bez + 3), H: sb + shot.h + 2 * (bez + 3) };
};
/** iPhone: μαύρο τιτάνιο, μαύρο πλαίσιο, Dynamic Island, γραμμή κατάστασης. */
const iphone = (shot, { x, y, z = 2 }) => {
  const { k, sb, bez, ri, W, H } = phoneBox(shot);
  return `<div class="floor" style="left:${x + W * 0.08}px;top:${y + H - 26}px;width:${W * 0.84}px;height:46px"></div>
 <div class="phone" style="left:${x}px;top:${y}px;width:${W}px;height:${H}px;border-radius:${ri + bez + 3}px;z-index:${z}">
  <i class="btn" style="left:-2px;top:${Math.round(H * 0.17)}px;height:${Math.round(H * 0.04)}px"></i>
  <i class="btn" style="left:-2px;top:${Math.round(H * 0.24)}px;height:${Math.round(H * 0.075)}px"></i>
  <i class="btn" style="left:-2px;top:${Math.round(H * 0.33)}px;height:${Math.round(H * 0.075)}px"></i>
  <i class="btn" style="right:-2px;top:${Math.round(H * 0.27)}px;height:${Math.round(H * 0.11)}px"></i>
  <div class="bez" style="padding:${bez}px;border-radius:${ri + bez}px">
   <div class="scr" style="border-radius:${ri}px">
    <i class="island" style="width:${Math.round(104 * k)}px;height:${Math.round(31 * k)}px;top:${Math.round(9 * k)}px;margin-left:${-Math.round(52 * k)}px"></i>
    ${statusBar(k, shot.top, sb)}
    <img src="${shot.src}" style="width:${shot.w}px;height:${shot.h}px" alt="">
   </div>
  </div>
 </div>`;
};

/** Οι διαστάσεις ενός MacBook για μια οθόνη. */
const macBox = shot => {
  const sw = shot.w;
  const band = Math.round(sw * 0.026);
  const side = Math.round(sw * 0.016);
  const top = Math.round(sw * 0.018);
  const bottom = Math.round(sw * 0.02);
  const lidW = sw + 2 * side + 4;
  const lidH = band + shot.h + top + bottom + 4;
  const baseW = Math.round(lidW * 1.05 / 2) * 2;
  const baseH = Math.round(sw * 0.022);
  const hinge = Math.max(4, Math.round(sw * 0.006));
  return { sw, band, side, top, bottom, lidW, lidH, baseW, baseH, hinge, H: lidH + hinge + baseH };
};
/** MacBook: λεπτό μαύρο πλαίσιο, εγκοπή, άρθρωση, αλουμινένια βάση με την εσοχή. */
const macbook = (shot, { x, y }) => {
  const { sw, band, side, top, bottom, lidW, lidH, baseW, baseH, hinge, H } = macBox(shot);
  const notchW = Math.round(sw * 0.075);
  const r1 = Math.round(sw * 0.024);
  return `<div class="floor" style="left:${x + baseW * 0.04}px;top:${y + H - 22}px;width:${baseW * 0.92}px;height:44px"></div>
 <div class="mac" style="left:${x}px;top:${y}px;width:${baseW}px">
  <div class="lid" style="width:${lidW}px;height:${lidH}px;margin:0 auto;border-radius:${r1 + 2}px ${r1 + 2}px ${Math.round(sw * 0.008)}px ${Math.round(sw * 0.008)}px">
   <div class="lbez" style="padding:${top}px ${side}px ${bottom}px;border-radius:${r1}px ${r1}px ${Math.round(sw * 0.006)}px ${Math.round(sw * 0.006)}px">
    <div class="lscr" style="border-radius:${Math.round(sw * 0.011)}px ${Math.round(sw * 0.011)}px 0 0">
     <div style="height:${band}px;background:${shot.top}"></div>
     <i class="notch" style="width:${notchW}px;height:${band}px;margin-left:${-notchW / 2}px;border-radius:0 0 ${Math.round(band * 0.4)}px ${Math.round(band * 0.4)}px"></i>
     <img src="${shot.src}" style="width:${shot.w}px;height:${shot.h}px" alt="">
    </div>
   </div>
  </div>
  <div class="hinge" style="width:${Math.round(lidW * 0.94)}px;height:${hinge}px"></div>
  <div class="base" style="height:${baseH}px;border-radius:0 0 ${Math.round(baseW * 0.06)}px ${Math.round(baseW * 0.06)}px / 0 0 ${baseH}px ${baseH}px">
   <i class="lip" style="width:${Math.round(baseW * 0.15)}px;height:${Math.round(baseH * 0.42)}px;margin-left:${-Math.round(baseW * 0.075)}px"></i>
  </div>
 </div>`;
};

// ── Το σύστημα ───────────────────────────────────────────────────────────
const C = { canvas: '#f5f7fa', surface: '#ffffff', ink: '#0f1b2e', ink2: '#536075', accent: '#1356c2' };
const M = 96;
const STAGE = { top: 440, bottom: 1182 };
const W_IN = 1080 - 2 * M;
const css = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;overflow:hidden}
body{font-family:'Inter Tight',sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;position:relative;background:${C.canvas}}
.bg{position:absolute;inset:0}
.who{position:absolute;left:${M}px;top:88px;font-size:22px;line-height:24px;font-weight:600;letter-spacing:-.005em;color:${C.accent}}
h1{position:absolute;left:${M}px;top:128px;width:${W_IN}px;font-size:76px;line-height:80px;font-weight:800;letter-spacing:-.04em;white-space:nowrap}
h1 span,h1 em{display:block}
h1 em{font-style:normal;color:${C.accent}}
.sub{position:absolute;left:${M}px;top:312px;width:${W_IN}px;font-size:30px;line-height:40px;font-weight:500;letter-spacing:-.012em;color:${C.ink2};text-wrap:pretty}
.sub b{color:${C.ink};font-weight:600}
.stage{position:absolute;inset:0}
.foot{position:absolute;left:${M}px;right:${M}px;top:1232px;height:24px;display:flex;align-items:center;justify-content:space-between;font-size:16px;line-height:24px;font-weight:600;color:${C.ink2}}
.foot img{height:22px;display:block}
.foot .ex{position:absolute;left:0;right:0;text-align:center;font-weight:500;pointer-events:none}
.foot .n{color:${C.ink};font-variant-numeric:tabular-nums;letter-spacing:.02em}
.floor{position:absolute;border-radius:50%;background:radial-gradient(closest-side,rgba(15,27,46,.22),rgba(15,27,46,.08) 55%,rgba(15,27,46,0))}
/* iPhone */
.phone{position:absolute;padding:3px;background:linear-gradient(145deg,#4a4d54,#1d1e22 22%,#0d0e10 60%,#2c2e33);
 box-shadow:inset 0 0 0 1px rgba(255,255,255,.18),0 2px 4px rgba(15,27,46,.10),0 16px 32px -6px rgba(15,27,46,.22),0 36px 56px -18px rgba(15,27,46,.30)}
.phone .btn{position:absolute;width:3px;border-radius:2px;background:linear-gradient(90deg,#1d1e22,#4a4d54)}
.phone .bez{background:#000;height:100%}
.phone .scr{position:relative;overflow:hidden;height:100%;background:#fff}
.phone img,.mac img{display:block}
.phone .island{position:absolute;left:50%;border-radius:99px;background:#000;z-index:3}
.sb{display:flex;align-items:center;justify-content:space-between;font-weight:600;letter-spacing:-.01em;color:${C.ink}}
.sb .ic{display:flex;align-items:center}
.sb i{display:block;position:relative}
.sig{display:flex!important;align-items:flex-end}.sig b{display:block;background:${C.ink}}
.wifi{overflow:hidden}.wifi b{position:absolute;border-radius:50%;border-style:solid;border-color:${C.ink} transparent transparent transparent}
.wifi b:last-child{border-color:${C.ink};background:${C.ink}}
.bat{box-shadow:inset 0 0 0 1px rgba(15,27,46,.45)}.bat b{display:block;width:80%;height:100%;background:${C.ink}}.bat s{position:absolute;top:50%;transform:translateY(-50%);border-radius:0 2px 2px 0;background:rgba(15,27,46,.45)}
/* MacBook */
.mac{position:absolute;z-index:1}
.lid{padding:2px;background:linear-gradient(180deg,#d4d7dc,#a9adb4 40%,#8f939a);box-shadow:0 2px 4px rgba(15,27,46,.08),0 24px 48px -16px rgba(15,27,46,.24)}
.lbez{background:#0a0a0b;height:100%}
.lscr{position:relative;overflow:hidden;background:#fff}
.notch{position:absolute;left:50%;top:0;background:#0a0a0b;z-index:3}
.hinge{margin:0 auto;background:linear-gradient(180deg,#5d6168,#9a9ea5 70%,#c4c7cc);border-radius:0 0 3px 3px}
.base{position:relative;background:linear-gradient(180deg,#f3f4f6 0%,#dcdfe3 22%,#c3c7cd 62%,#9599a1 100%);box-shadow:0 24px 40px -12px rgba(15,27,46,.35)}
.base .lip{position:absolute;left:50%;top:0;border-radius:0 0 10px 10px;background:linear-gradient(180deg,#a6aab1,#d2d5da)}
/* Τα τρία επίπεδα (4) */
.levels{position:absolute;left:${M}px;width:440px}
.levels .k{font-size:22px;line-height:32px;font-weight:600;color:${C.ink2}}
.levels .lv{margin-top:20px;font-size:30px;line-height:40px;font-weight:600;letter-spacing:-.015em;color:#9aa4b4;display:flex;align-items:center;gap:16px}
.levels .lv i{width:10px;height:10px;border-radius:50%;background:#c9d0da;flex:none}
.levels .lv.on{color:${C.ink}}
.levels .lv.on i{background:${C.accent}}
.levels .h{margin-top:28px;font-size:22px;line-height:32px;font-weight:500;color:${C.ink2}}
/* Τέλος (6) */
.cta{position:absolute;left:${M}px;right:${M}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.cta .mk{width:112px;height:112px;border-radius:30px;background:${C.surface};display:grid;place-items:center;box-shadow:0 2px 4px rgba(15,27,46,.06),0 24px 48px -12px rgba(15,27,46,.20)}
.cta .mk img{width:60px;height:60px}
.cta .url{margin-top:48px;display:inline-flex;align-items:center;padding:24px 44px;border-radius:999px;background:${C.ink};color:#fff;font-size:30px;line-height:40px;font-weight:700;letter-spacing:-.01em;box-shadow:0 24px 48px -16px rgba(15,27,46,.45)}
.cta .bill{margin-top:40px;max-width:720px;font-size:22px;line-height:34px;font-weight:500;color:${C.ink2}}
`;
// Καμβάς χωρίς διαβαθμίσεις: οι σκιές των συσκευών κάνουν όλο το βάθος.
const glow = () => `background:${C.canvas}`;

const page = (n, { who, h1, sub, stage, example = true }) => `<!doctype html><html lang="el"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&display=block" rel="stylesheet">
<style>${css}</style></head><body>
<div class="bg" style="${glow()}"></div>
<div class="who">${who}</div>
<h1>${h1}</h1>
<div class="sub">${sub}</div>
<div class="stage">${stage}</div>
<div class="foot"><img src="${LOGO}" alt="PROPERWISE">${example ? '<span class="ex">Παράδειγμα με φανταστικά στοιχεία</span>' : ''}<span class="n">${n} / ${N}</span></div>
</body></html>`;

// ── Οι οθόνες ────────────────────────────────────────────────────────────
const S = {
  ws: await screen('firmWorkspace', { device: 'laptop', width: 780, vw: LIST_VW }),
  owner: await screen('firmOwner', { device: 'phone', width: 286 }),
  list: await screen('firmWorkspace', { device: 'laptop', width: 816, vw: LIST_VW, prep: listPrep }),
  ask: await screen('firmAsk', { device: 'phone', width: 330, prep: askPrep }),
  access: await screen('firmOwner', { device: 'phone', width: 330 }),
  team: await screen('firm', { device: 'laptop', width: 816, vw: LIST_VW, prep: teamPrep }),
};
for (const a of MUST) if (!seen.has(a)) throw new Error(`Το όνομα «${a}» δεν βρέθηκε στον πάγκο· οι σκηνές άλλαξαν.`);

// ── Οι συνθέσεις ─────────────────────────────────────────────────────────
const midY = h => Math.round(STAGE.top + (STAGE.bottom - STAGE.top - h) / 2);
const heroMac = shot => {
  const b = macBox(shot);
  return macbook(shot, { x: Math.round((1080 - b.baseW) / 2), y: midY(b.H) - 16 });
};
const cover = (lap, ph) => {
  const p = phoneBox(ph);
  return `${macbook(lap, { x: M, y: STAGE.top + 8 })}
 ${iphone(ph, { x: 1080 - M - p.W, y: STAGE.bottom - p.H })}`;
};

const slides = [
// 1 · Η φράση που έχει ακούσει κάθε ιδιοκτήτης από τον λογιστή του
page(1, {
  who: 'Για λογιστικά γραφεία και ιδιοκτήτες',
  h1: '<span>«Στείλε μου τα χαρτιά</span><em>ως την Παρασκευή.»</em>',
  sub: 'Φωτογραφίες από το κινητό, ένα αρχείο που λείπει πάντα <b>και ένα τηλέφωνο για κάθε απόδειξη.</b>',
  stage: cover(S.ws, S.owner),
}),
// 2 · Η λίστα των πελατών και το «Τι λείπει»
page(2, {
  who: 'Για το γραφείο',
  h1: '<span>Τι λείπει,</span><em>το βλέπεις αμέσως.</em>',
  sub: 'Μία λίστα για όλους τους πελάτες, <b>με τις ελλείψεις δίπλα στο όνομα.</b>',
  stage: heroMac(S.list),
}),
// 3 · Ζήτησέ το: το φύλλο του αιτήματος, μόνο στην εφαρμογή
page(3, {
  who: 'Για το γραφείο',
  h1: '<span>Ζητάς ό,τι λείπει.</span><em>Χωρίς τηλέφωνο.</em>',
  sub: 'Το αίτημα φτάνει στη Λογιστική του πελάτη, <b>μαζί με τη σημείωσή σου.</b>',
  stage: (() => { const p = phoneBox(S.ask); return iphone(S.ask, { x: Math.round((1080 - p.W) / 2), y: midY(p.H) }); })(),
}),
// 4 · Ο ιδιοκτήτης: τρία επίπεδα, αναίρεση, ανάκληση
page(4, {
  who: 'Για τον ιδιοκτήτη',
  h1: '<span>Ο ιδιοκτήτης</span><em>κρατά το κλειδί.</em>',
  sub: `Αναιρεί ό,τι γράφτηκε σήμερα ή χθες <b>και ανακαλεί την πρόσβαση όποτε θέλει.</b>`,
  stage: (() => {
    const p = phoneBox(S.access);
    const y = midY(p.H);
    return `${iphone(S.access, { x: 1080 - M - p.W, y })}
 <div class="levels" style="top:${y + 150}px">
  <div class="k">Διαλέγει τι κάνει το γραφείο</div>
  ${LEVELS.map(l => `<div class="lv${l === 'keep' ? ' on' : ''}"><i></i>${LEVEL_LABEL[l]}</div>`).join('')}
 </div>`;
  })(),
}),
// 5 · Η ομάδα του γραφείου: ρόλοι και δεύτερο βήμα
page(5, {
  who: 'Για το γραφείο',
  h1: '<span>Όλη η ομάδα,</span><em>ο καθένας στον ρόλο του.</em>',
  sub: `${ROLE_LABEL[ROLES[0]]}, ${lc(ROLE_LABEL[ROLES[1]])}, ${lc(ROLE_LABEL[ROLES[2]])}. <b>Όλοι με επαλήθευση δύο βημάτων.</b>`,
  stage: heroMac(S.team),
}),
// 6 · Ο σύνδεσμος και η χρέωση του γραφείου
page(6, {
  who: 'Για λογιστικά γραφεία',
  h1: '<span>Η πύλη για</span><em>λογιστικά γραφεία.</em>',
  sub: 'Ο σύνδεσμος είναι <b>στο πρώτο σχόλιο.</b>',
  stage: `<div class="cta" style="top:${STAGE.top}px;height:${STAGE.bottom - STAGE.top}px">
  <div class="mk"><img src="${MARK}" alt=""></div>
  <div class="url">properwise.gr/logistes</div>
  <div class="bill">${BILLING}</div>
 </div>`,
  example: false,
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
    if (!document.fonts.check('800 76px "Inter Tight"', 'Στείλε')) out.push('δεν φορτώθηκε η Inter Tight');
    const h1 = document.querySelector('h1').getBoundingClientRect();
    const sub = document.querySelector('.sub').getBoundingClientRect();
    if (h1.height > 2 * 80 + 1) out.push('ο τίτλος πιάνει πάνω από δύο γραμμές');
    if (sub.height > 2 * 40 + 1) out.push('η εξήγηση πιάνει πάνω από δύο γραμμές');
    if (sub.bottom > STAGE.top - 32) out.push('η εξήγηση πέφτει πάνω στη σκηνή');
    for (const el of document.querySelectorAll('h1 span, h1 em, .who, .sub, .levels > *')) {
      const range = document.createRange(); range.selectNodeContents(el);
      const t = range.getBoundingClientRect();
      if (t.right > 1080 - M + 1) out.push(`βγαίνει από το περιθώριο: «${el.textContent.trim().slice(0, 40)}»`);
    }
    for (const el of document.querySelectorAll('.phone, .mac, .cta, .levels')) {
      const r = el.getBoundingClientRect();
      if (r.left < M - 24 || r.right > 1080 - M + 24 || r.top < STAGE.top - 1 || r.bottom > STAGE.bottom + 1) out.push(`βγαίνει από τη σκηνή (${Math.round(r.left)},${Math.round(r.top)} – ${Math.round(r.right)},${Math.round(r.bottom)})`);
    }
    // Επίπεδα δίπλα στο κινητό: δεν το αγγίζουν.
    const lv = document.querySelector('.levels'), ph = document.querySelector('.phone');
    if (lv && ph && lv.getBoundingClientRect().right > ph.getBoundingClientRect().left - 32) out.push('τα επίπεδα ακουμπούν το κινητό');
    // Κάθε οθόνη σε ακέραιο εικονοστοιχείο: αλλιώς ο Chromium την ξαναδειγματίζει.
    for (const img of document.querySelectorAll('.phone img, .mac img')) {
      const r = img.getBoundingClientRect();
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
