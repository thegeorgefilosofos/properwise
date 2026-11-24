// Οι πραγματικές οθόνες της ανακοίνωσης «Το PROPERWISE συνδέεται με την ΑΑΔΕ», από τον πάγκο κινητού.
//
//   node scripts/perf-bench/build-mobile.mjs
//   CHROMIUM_PATH=… node docs/marketing/kamari/2026-11-24-aade-syndesi/capture.mjs
//
// Τρεις σκηνές του πάγκου (scripts/perf-bench/mydata.tsx και mobile.tsx), με τα πλασματικά δεδομένα τους:
//   · mydataConsent: η γραμμή «myDATA από τον λογιστή» στον Λογαριασμό του ιδιοκτήτη (MydataConsent.tsx)
//   · mydataInbox:   τα Εισερχόμενα «Από το myDATA» του ακινήτου (MydataInbox.tsx)
//   · bulkE9:        η «Εισαγωγή από το myAADE» με ένα Ε9 τριών ακινήτων (MyaadeImport.tsx)
// Το κοντινό «Κατέβασε» του φακέλου του λογιστή είναι λήψη της ταινίας 2026-11-23-ena-meros (work/shots9/acc*.png).
// Καμία οθόνη δεν αλλάζει: μόνο κρύβονται γραμμές (visibility) για τη λήψη «πριν εμφανιστούν».
import { chromium } from 'playwright-core';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
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

async function open(scene) {
  if (ctx) await ctx.close();
  ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: BASE });
  await ctx.clock.setFixedTime(NOW);
  const p = await ctx.newPage();
  await p.goto(pathToFileURL(join(root, '.perf-bench/mobile.html')).href + `?c=${scene}&n=6`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.evaluate(() => document.fonts.ready);
  return p;
}
const box = (h) => h.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
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
{
  const p = await open('mydataConsent');
  const card = await box(await find(p, 'myDATA από τον λογιστή', 'r.width >= 350'));
  const line = await box(await find(p, 'Ο λογιστής σου μπορεί', 'true'));
  const reg = { x: 0, y: card.y, w: 390, h: card.h };
  await clipShot(p, 'consent', reg);
  boxes.consent = { card, line, reg };
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
  const issuer = await box(await find(p, 'Ηλεκτρική Ενέργεια', 'r.width >= 290'));
  // Ως το τέλος του πεδίου «Ακίνητο» (το τρίτο παιδί του παραστατικού, ή το πρώτο κάτω από τα 330 px).
  const end = partBoxes.find((r) => r.y + r.h > card.y + 260) ?? partBoxes[partBoxes.length - 1];
  const reg = { x: 0, y: card.y, w: 390, h: end.y + end.h + 12 - card.y };
  const shown = partBoxes.map((r, i) => ({ ...r, i })).filter((r) => r.y + r.h <= reg.y + reg.h);
  await clipShot(p, 'inbox', reg);
  for (const r of shown) await clipShot(p, `inbox-part-${r.i}`, r);
  await setVis(p, parts, false); await p.waitForTimeout(150);
  await clipShot(p, 'inbox-empty', reg);
  await setVis(p, parts, true);
  boxes.inbox = { card, issuer, parts: shown, reg };
}

// ── 3. «Εισαγωγή από το myAADE» με Ε9 τριών ακινήτων ─────────────────────
{
  const p = await open('bulkE9');
  const head = await box(await find(p, 'Εισαγωγή από το myAADE', 'r.width >= 380'));
  const found = await box(await find(p, 'Βρήκαμε', 'true'));
  const lis = await p.evaluateHandle(() => [...document.querySelectorAll('ul > li')]);
  const nl = await lis.evaluate((a) => a.length);
  const items = [];
  for (let i = 0; i < nl; i++) items.push(await lis.evaluateHandle((a, i) => a[i], i));
  const itemBoxes = await Promise.all(items.map(box));
  const btn = await box(await find(p, 'Καταχώρηση', 'r.width >= 100'));
  const bar = await box(await find(p, 'Καταχώρηση', 'r.width >= 380'));
  const texts = await Promise.all(items.map((h) => h.evaluate((el) => el.innerText.split('\n')[0])));
  // Πάνω: κεφαλίδα ως το τέλος του πρώτου ακινήτου. Κάτω: το δεύτερο ακίνητο ως το κουμπί.
  const top = { x: 0, y: head.y, w: 390, h: itemBoxes[0].y + itemBoxes[0].h + 10 - head.y };
  const bottom = { x: 0, y: itemBoxes[1].y - 10, w: 390, h: 844 - (itemBoxes[1].y - 10) };
  await clipShot(p, 'e9-top', top);
  await clipShot(p, 'e9-item-0', itemBoxes[0]);
  await clipShot(p, 'e9-bottom', bottom);
  await setVis(p, [items[0]], false); await p.waitForTimeout(150);
  await clipShot(p, 'e9-top-empty', top);
  await setVis(p, [items[0]], true);
  boxes.e9 = { head, found, items: itemBoxes, texts, btn, bar, top, bottom };
}

// ── 4. Το «Κατέβασε» του φακέλου του λογιστή: οι λήψεις της ταινίας 2026-11-23-ena-meros (τρέξε πρώτα το capture.mjs εκείνης).
for (const f of ['acc.png', 'acc-busy.png']) copyFileSync(join(here, '../2026-11-23-ena-meros/work/shots9', f), join(out, f));

writeFileSync(join(out, 'boxes.json'), JSON.stringify(boxes, null, 1));
console.log(JSON.stringify(boxes, null, 1));
await b.close();
