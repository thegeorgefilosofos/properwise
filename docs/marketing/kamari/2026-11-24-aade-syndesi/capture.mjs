// Οι πραγματικές οθόνες της ανακοίνωσης «Το PROPERWISE συνδέεται με την ΑΑΔΕ», από τον πάγκο κινητού.
//
//   node scripts/perf-bench/build-mobile.mjs
//   CHROMIUM_PATH=… node docs/marketing/kamari/2026-11-24-aade-syndesi/capture.mjs
//
// Τρεις σκηνές του πάγκου (scripts/perf-bench/mydata.tsx και mobile.tsx), με τα πλασματικά δεδομένα τους:
//   · mydataConsent: η γραμμή «myDATA από τον λογιστή» στον Λογαριασμό του ιδιοκτήτη (MydataConsent.tsx)
//   · mydataInbox:   τα Εισερχόμενα «Από το myDATA» του ακινήτου (MydataInbox.tsx)
//   · bulkE9:        η «Εισαγωγή από το myAADE» με ένα Ε9 τριών ακινήτων (MyaadeImport.tsx)
// Καμία οθόνη δεν αλλάζει: μόνο κρύβονται γραμμές (visibility) για τη λήψη «πριν εμφανιστούν»· στη συναίνεση (v3) δύο γραμμές με display: none.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const out = join(here, 'work/shots9');
mkdirSync(out, { recursive: true });
const BASE = 9;
const NOW = new Date('2026-11-23T09:41:00+02:00');
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--disable-dev-shm-usage'] });
const boxes = {};
let ctx = null;

async function open(scene, { width = 390, height = 844, dsf = BASE } = {}) {
  if (ctx) await ctx.close();
  ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: dsf });
  await ctx.clock.setFixedTime(NOW);
  const p = await ctx.newPage();
  await p.goto(pathToFileURL(join(root, '.perf-bench/mobile.html')).href + `?c=${scene}&n=6`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.evaluate(() => document.fonts.ready);
  return p;
}
const box = (h) => h.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
const fontOf = (h) => h.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
const clipShot = (p, name, r) => p.screenshot({ path: join(out, name + '.png'), clip: { x: r.x, y: r.y, width: r.w, height: r.h } });
// Το στοιχείο του κειμένου και ο πρώτος πρόγονός του που ικανοποιεί το κριτήριο.
const find = (p, text, test) => p.evaluateHandle(([text, test]) => {
  const own = [...document.querySelectorAll('body *')].find((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.includes(text)));
  if (!own) throw new Error('δεν βρέθηκε: ' + text);
  const ok = new Function('r', 'el', `return ${test};`);
  for (let el = own; el; el = el.parentElement) if (ok(el.getBoundingClientRect(), el)) return el;
  return own;
}, [text, test]);
const setVis = async (p, hs, show) => {
  await p.evaluate(() => { if (!document.getElementById('film-hide')) { const s = document.createElement('style'); s.id = 'film-hide'; s.textContent = '[data-film-hide]{visibility:hidden!important}'; document.head.appendChild(s); } });
  await Promise.all(hs.map((h) => h.evaluate((el, show) => { if (show) el.removeAttribute('data-film-hide'); else el.setAttribute('data-film-hide', ''); }, show)));
};

// ── 1. «myDATA από τον λογιστή» (Λογαριασμός) ─────────────────────────────
// v3: η περιγραφή («…μπορεί να φέρνει αυτόματα…») και η γραμμή του τελευταίου συγχρονισμού (ημερομηνία, «12 νέα»)
// δεν μπαίνουν στη λήψη (display: none, η κάρτα κλείνει από κάτω): η ταινία δεν υπόσχεται αυτόματο συγχρονισμό
// και δεν δείχνει ημερομηνία συγχρονισμού. Μένουν ο τίτλος, ο λογιστής με την ημερομηνία συναίνεσης, η «Ανάκληση».
const goneConsent = async (p) => {
  for (const t of ['Ο λογιστής σου μπορεί', 'Ο λογιστής σου συγχρόνισε']) await (await find(p, t, 'true')).evaluate((el) => { el.style.display = 'none'; });
  await p.waitForTimeout(150);
};
{
  const p = await open('mydataConsent');
  await goneConsent(p);
  const cardH = await find(p, 'myDATA από τον λογιστή', 'r.width >= 350');
  const card = await box(cardH);
  const titleH = await find(p, 'myDATA από τον λογιστή', 'true');
  const accH = await find(p, 'Λογιστικό Γραφείο Υπόδειγμα', 'true');
  const btnH = await find(p, 'Ανάκληση', 'r.width >= 60');
  const fonts = { title: await fontOf(titleH), acc: await fontOf(accH), btn: await fontOf(btnH) };
  const reg = { x: 0, y: card.y, w: 390, h: card.h };
  await clipShot(p, 'consent', reg);
  boxes.consent = { card, title: await box(titleH), acc: await box(accH), btn: await box(btnH), reg, fonts };
}

// ── 2. Εισερχόμενα «Από το myDATA» ───────────────────────────────────────
// Η κάρτα ως τον «Ακίνητο»: τίτλος, το πρώτο παραστατικό (εκδότης, ποσό, στοιχεία) και το ακίνητο που προτείνεται.
{
  const p = await open('mydataInbox');
  const card = await box(await find(p, 'Από το myDATA', 'r.width >= 350'));
  const item = await find(p, 'Ηλεκτρική Ενέργεια', 'r.height > 200');
  const kids = await item.evaluateHandle((el) => [...el.children]);
  const n = await kids.evaluate((a) => a.length);
  const parts = [];
  for (let i = 0; i < n; i++) parts.push(await kids.evaluateHandle((a, i) => a[i], i));
  const partBoxes = await Promise.all(parts.map(box));
  const issuerH = await find(p, 'Ηλεκτρική Ενέργεια', 'r.width >= 290');
  const issuer = await box(issuerH);
  // v2: το προτεινόμενο ακίνητο (το πεδίο «Ακίνητο») και τα μεγέθη γραμμάτων.
  const propSel = await box(await find(p, 'Διαμέρισμα Παραδείγματος', 'r.width >= 280'));
  const fonts = { issuer: await fontOf(await find(p, 'Ηλεκτρική Ενέργεια', 'true')), mark: await fontOf(await find(p, 'ΜΑΡΚ', 'true')) };
  // Ως το τέλος του πεδίου «Ακίνητο» (το τρίτο παιδί του παραστατικού, ή το πρώτο κάτω από τα 330 px).
  const end = partBoxes.find((r) => r.y + r.h > card.y + 260) ?? partBoxes[partBoxes.length - 1];
  const reg = { x: 0, y: card.y, w: 390, h: end.y + end.h + 12 - card.y };
  const shown = partBoxes.map((r, i) => ({ ...r, i })).filter((r) => r.y + r.h <= reg.y + reg.h);
  await clipShot(p, 'inbox', reg);
  for (const r of shown) await clipShot(p, `inbox-part-${r.i}`, r);
  await setVis(p, parts, false); await p.waitForTimeout(150);
  await clipShot(p, 'inbox-empty', reg);
  await setVis(p, parts, true);
  boxes.inbox = { card, issuer, propSel, parts: shown, reg, fonts };
}

// ── 3. «Εισαγωγή από το myAADE» με Ε9 τριών ακινήτων ─────────────────────
// v3: σε πλάτος 320 px (η ίδια οθόνη, πιο στενό κινητό): η κάρτα του ακινήτου στενεύει στα ~268 px, οπότε στο
// κοντινό (936 px) μεγεθύνεται × 3,49 και τα στοιχεία του ακινήτου (11 px) βγαίνουν ≥ 38 px.
{
  const p = await open('bulkE9', { width: 320 });
  const lis = await p.evaluateHandle(() => [...document.querySelectorAll('ul > li')]);
  const nl = await lis.evaluate((a) => a.length);
  const items = [];
  for (let i = 0; i < nl; i++) items.push(await lis.evaluateHandle((a, i) => a[i], i));
  const itemBoxes = await Promise.all(items.map(box));
  const bar = await box(await find(p, 'Καταχώρηση', 'r.width >= 300'));
  const titleH = await items[0].evaluateHandle((el) => [...el.querySelectorAll('*')].find((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.includes('ΠΑΡΑΔΕΙΓΜΑΤΟΣ'))));
  const title0 = await box(titleH);
  const metaH = await items[0].evaluateHandle((el) => [...el.querySelectorAll('*')].find((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.includes('ΑΤΑΚ'))));
  const fonts = { title: await fontOf(titleH), meta: await fontOf(metaH), btn: await fontOf(await find(p, 'Καταχώρηση', 'r.width >= 100')) };
  // Η λίστα: από το πρώτο ακίνητο ως πάνω από τη μπάρα του κουμπιού.
  const list = { x: 0, y: itemBoxes[0].y - 10, w: 320, h: bar.y - (itemBoxes[0].y - 10) };
  const clipIn = (r) => ({ ...r, h: Math.min(r.h, bar.y - r.y) });
  await clipShot(p, 'e9n-list', list);
  await clipShot(p, 'e9n-item-0', clipIn(itemBoxes[0]));
  await clipShot(p, 'e9n-item-1', clipIn(itemBoxes[1]));
  await setVis(p, [items[0], items[1]], false); await p.waitForTimeout(150);
  await clipShot(p, 'e9n-list-empty', list);
  await setVis(p, [items[0], items[1]], true);
  // Κάτω: κύλιση της λίστας ως το τέλος (το τρίτο ακίνητο) και το κουμπί «Καταχώρηση · 3 νέα».
  await items[nl - 1].evaluate((el) => el.scrollIntoView({ block: 'end' })); await p.waitForTimeout(300);
  const last = await box(items[nl - 1]);
  const btn = await box(await find(p, 'Καταχώρηση', 'r.width >= 100'));
  const bottom = { x: 0, y: last.y - 10, w: 320, h: 844 - (last.y - 10) };
  await clipShot(p, 'e9n-bottom', bottom);
  boxes.e9 = { items: itemBoxes, title0, bar, list, last, btn, bottom, fonts };
}

// ── 5. Laptop (v2 studio): οι ίδιες σκηνές σε οθόνη 1280 × 800, ολόκληρη η οθόνη ανά κατάσταση ──
// Εισερχόμενα: άδεια λίστα, το πρώτο παραστατικό, όλα. Εισαγωγή από το myAADE: χωρίς ακίνητα, ένα, δύο, τρία.
{
  const L = { width: 1280, height: 800, dsf: 2 };
  const full = { x: 0, y: 0, w: 1280, h: 800 };
  let p = await open('mydataInbox', L);
  const item = await find(p, 'Ηλεκτρική Ενέργεια', 'r.height > 150');
  const list = await item.evaluateHandle((el) => [...el.parentElement.children]);
  const nl = await list.evaluate((a) => a.length);
  const rows = []; for (let i = 0; i < nl; i++) rows.push(await list.evaluateHandle((a, i) => a[i], i));
  const rowBoxes = await Promise.all(rows.map(box));
  const select = await box(await find(p, 'Διαμέρισμα Παραδείγματος', 'r.width >= 300'));
  const issuer = await box(await find(p, 'Ηλεκτρική Ενέργεια', 'r.width >= 600'));
  await clipShot(p, 'lap-inbox-3', full);
  await setVis(p, rows.slice(1), false); await p.waitForTimeout(150);
  await clipShot(p, 'lap-inbox-1', full);
  await setVis(p, rows, false); await p.waitForTimeout(150);
  await clipShot(p, 'lap-inbox-0', full);
  await setVis(p, rows, true);
  boxes.lapInbox = { rows: rowBoxes, select, issuer };
  p = await open('bulkE9', L);
  const lis = await p.evaluateHandle(() => [...document.querySelectorAll('ul > li')]);
  const n2 = await lis.evaluate((a) => a.length);
  const items = []; for (let i = 0; i < n2; i++) items.push(await lis.evaluateHandle((a, i) => a[i], i));
  const itemBoxes = await Promise.all(items.map(box));
  const found = await box(await find(p, 'Βρήκαμε', 'true'));
  const btn = await box(await find(p, 'Καταχώρηση', 'r.width >= 100'));
  for (let k = items.length; k >= 0; k--) {
    await setVis(p, items, true); await setVis(p, items.slice(k), false); await p.waitForTimeout(150);
    await clipShot(p, `lap-e9-${k}`, full);
  }
  await setVis(p, items, true);
  boxes.lapE9 = { items: itemBoxes, found, btn };
}

// ── 6. Κινητό, ολόκληρη η οθόνη (v2 studio): για τις σκηνές με laptop και κινητό μαζί ──
{
  const P = { width: 390, height: 844, dsf: 3 };
  const full = { x: 0, y: 0, w: 390, h: 844 };
  let p = await open('mydataConsent', P);
  await goneConsent(p);
  await clipShot(p, 'ph-consent', full);
  p = await open('mydataInbox', P);
  const item = await find(p, 'Ηλεκτρική Ενέργεια', 'r.height > 200');
  const kids = await item.evaluateHandle((el) => [...el.children]);
  const n = await kids.evaluate((a) => a.length);
  const parts = []; for (let i = 0; i < n; i++) parts.push(await kids.evaluateHandle((a, i) => a[i], i));
  const list = await item.evaluateHandle((el) => [...el.parentElement.children].slice(1));
  const nl = await list.evaluate((a) => a.length);
  const rows = []; for (let i = 0; i < nl; i++) rows.push(await list.evaluateHandle((a, i) => a[i], i));
  await clipShot(p, 'ph-inbox-3', full);
  await setVis(p, [...parts.slice(1), ...rows], false); await p.waitForTimeout(150);
  await clipShot(p, 'ph-inbox-0', full);
  await setVis(p, [...parts, ...rows], true);
  const sel = await box(await find(p, 'Διαμέρισμα Παραδείγματος', 'r.width >= 280'));
  boxes.phInbox = { select: sel };
  p = await open('bulkE9', P);
  const lis = await p.evaluateHandle(() => [...document.querySelectorAll('ul > li')]);
  const n2 = await lis.evaluate((a) => a.length);
  const items = []; for (let i = 0; i < n2; i++) items.push(await lis.evaluateHandle((a, i) => a[i], i));
  await clipShot(p, 'ph-e9-3', full);
  await setVis(p, items, false); await p.waitForTimeout(150);
  await clipShot(p, 'ph-e9-0', full);
  await setVis(p, items, true);
}

writeFileSync(join(out, 'boxes.json'), JSON.stringify(boxes, null, 1));
console.log(JSON.stringify(boxes, null, 1));
await b.close();
