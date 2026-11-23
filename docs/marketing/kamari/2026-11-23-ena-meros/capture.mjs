// Οι πραγματικές οθόνες της ταινίας (v4), από τον πάγκο κινητού με δεδομένα επίδειξης.
//
//   node scripts/perf-bench/build-mobile.mjs
//   CHROMIUM_PATH=… node docs/marketing/kamari/2026-11-23-ena-meros/capture.mjs
//
// Ολα τα καρέ της εφαρμογής βγαίνουν από την ίδια την εφαρμογή, σε καταστάσεις:
//   · βάσεις ολόκληρης οθόνης ×5 (το χαρτοφυλάκιο σε θύρα 390×1500, για αληθινή κύλιση)
//   · κοντινά ×8 στα κουτιά που γράφει στο shots/boxes.json
//   · ο μετρητής «Καθαρό 2026»: το ίδιο στοιχείο με ενδιάμεσες τιμές, στη μορφή της εφαρμογής
//   · η σάρωση: τα πεδία Πάροχος και ΑΦΜ άδεια, μετά γράμμα-γράμμα (η ίδια φόρμα, με input)
//   · το «Κατέβασε» πριν και μετά το πραγματικό πάτημα
// Το ρολόι παγώνει στις 23/11/2026 09:41 (οι «ημέρες ακόμη» του lib/tax/greekTaxCalendar.ts).
import { chromium } from 'playwright-core';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const out = join(here, 'work/shots6');
mkdirSync(out, { recursive: true });
// v5: η βάση ×6 πέφτει 1:1 στη λήψη ×3 του κάδρου (2 px κάδρου ανά px εφαρμογής)· τα κοντινά ×9 (2,8 × 3 = 8,4).
const BASE = 6, CLOSE = 9;
const NOW = new Date('2026-11-23T09:41:00+02:00');
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const boxes = {};
let ctx = null;

async function open(q, dsf, h = 844) {
  if (ctx) await ctx.close();
  ctx = await b.newContext({ viewport: { width: 390, height: h }, deviceScaleFactor: dsf });
  await ctx.clock.setFixedTime(NOW);
  const p = await ctx.newPage();
  await p.goto(pathToFileURL(join(root, '.perf-bench/mobile.html')).href + q, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.evaluate(() => document.fonts.ready);
  return p;
}
const rect = async (loc) => { const r = await loc.first().boundingBox(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
const pad = (r, d) => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
const clipShot = (p, name, r) => p.screenshot({ path: join(out, name + '.png'), clip: { x: r.x, y: r.y, width: r.w, height: r.h } });
const full = (p, name) => p.screenshot({ path: join(out, name + '.png') });
// Τιμή σε πεδίο React: ο εγγενής setter και ένα συμβάν input, όπως η πληκτρολόγηση.
// Τα πεδία με τη σειρά τους στη φόρμα: 0 ο Πάροχος, 1 ο ΑΦΜ παρόχου (ελέγχεται πιο κάτω).
const typeInto = (p, i, v) => p.evaluate(([i, v]) => {
  const el = document.querySelectorAll('input[type=text]')[i];
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, [i, v]);
// Γραμμές λίστας που εμφανίζονται μία μία: η ίδια οθόνη με τις υπόλοιπες γραμμές κρυμμένες
// (visibility, ώστε η διάταξη να μη μετακινείται). Η γραμμή είναι ο πρώτος πρόγονος πλάτους ≥ 340 px.
const rowsOf = (p, locs) => Promise.all(locs.map((l) => l.evaluateHandle((el) => { while (el.getBoundingClientRect().width < 340) el = el.parentElement; return el; })));
// Στους Φακέλους η γραμμή είναι ο ψηλότερος πρόγονος κάτω από 75 px ύψος και πάνω από 300 px πλάτος.
const docRowsOf = (p, locs) => Promise.all(locs.map((l) => l.evaluateHandle((el) => {
  let best = el; for (let e = el; e && e.getBoundingClientRect().height < 75; e = e.parentElement) if (e.getBoundingClientRect().width >= 300) best = e; return best; })));
const showRows = (handles, n) => Promise.all(handles.map((h, i) => h.evaluate((el, v) => { el.style.visibility = v; }, i < n ? 'visible' : 'hidden')));
const ROWS_OV = ['ΕΝΦΙΑ, 9η δόση', 'Φόρος εισοδήματος, 5η δόση', 'Τέλος ανθεκτικότητας κλιματικής κρίσης, απόδοση', 'Δήλωση βραχυχρόνιας διαμονής (Μητρώο ΑΑΔΕ)'];
const ROWS_DOC = ['Ασφαλιστήριο', 'ΕΝΦΙΑ', 'Μισθωτήριο', 'Ρεύμα', 'Υδραυλικός', 'Έγγραφο'];
const fmtEUR = (v) => v.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€';

// ── 2. Επισκόπηση του ακινήτου ──────────────────────────────────────────
let p = await open('?c=overview&n=6&noa=1', BASE);
await p.click('button[aria-label="Το κατάλαβα"]');
await p.waitForTimeout(400);
await full(p, 'overview');
{ const hs = await rowsOf(p, ROWS_OV.map((n) => p.getByRole('button', { name: `${n}: Ημερολόγιο` }))); await showRows(hs, 0); await p.waitForTimeout(200); await full(p, 'overview-empty'); await showRows(hs, 4); }
boxes.overview = {
  pending: { x: 16, y: 264, w: 358, h: 398 },
  enfia: await rect(p.getByRole('button', { name: 'ΕΝΦΙΑ, 9η δόση: Ημερολόγιο' })),
  rows: await Promise.all(['ΕΝΦΙΑ, 9η δόση', 'Φόρος εισοδήματος, 5η δόση', 'Τέλος ανθεκτικότητας κλιματικής κρίσης, απόδοση', 'Δήλωση βραχυχρόνιας διαμονής (Μητρώο ΑΑΔΕ)']
    .map((n) => rect(p.getByRole('button', { name: `${n}: Ημερολόγιο` })))),
  scan: await rect(p.getByRole('button', { name: 'Σάρωσε έγγραφο' })),
  tabAccounting: await rect(p.getByRole('button', { name: 'Λογιστική' })),
};
p = await open('?c=overview&n=6&noa=1', CLOSE);
await p.click('button[aria-label="Το κατάλαβα"]');
await p.waitForTimeout(400);
await clipShot(p, 'crop-pending', boxes.overview.pending);
{ const hs = await rowsOf(p, ROWS_OV.map((n) => p.getByRole('button', { name: `${n}: Ημερολόγιο` })));
  // Η άδεια κάρτα και κάθε γραμμή χωριστά (λιγότερη μνήμη στην ταινία από πέντε ολόκληρες καταστάσεις).
  await showRows(hs, 0); await p.waitForTimeout(120); await clipShot(p, 'pend-0', boxes.overview.pending);
  await showRows(hs, 4); await p.waitForTimeout(120);
  const ROW_Y = [[307, 67], [374, 108], [482, 89], [571, 86]];
  for (const [i, [y, h]] of ROW_Y.entries()) await clipShot(p, `prow-${i}`, { x: 16, y, w: 358, h }); }

// ── 3. Σάρωση: τα πεδία γράφονται γράμμα-γράμμα ─────────────────────────
const PROV = 'input[value="Πάροχος Ενέργειας Α.Ε."]', AFM = 'input[value="090000045"]';
for (const [dsf, tag] of [[BASE, 'base'], [CLOSE, 'close']]) {
  p = await open('?c=scanReview&n=6', dsf);
  await p.waitForTimeout(1500);
  const prov = await rect(p.locator(PROV)), afm = await rect(p.locator(AFM));
  const order = await p.evaluate(() => [...document.querySelectorAll('input[type=text]')].slice(0, 2).map((e) => e.value));
  if (order[0] !== 'Πάροχος Ενέργειας Α.Ε.' || order[1] !== '090000045') throw new Error('άλλη σειρά πεδίων: ' + order);
  if (tag === 'base') {
    boxes.scan = { prov, afm, updates: await rect(p.getByText('Θα ενημερωθούν', { exact: false })), fields: { x: 16, y: 528, w: 358, h: 184 }, sheetTop: 84,
      save: await rect(p.getByRole('button', { name: 'Καταχώρηση' })) };
  }
  const provV = 'Πάροχος Ενέργειας Α.Ε.', afmV = '090000045';
  await typeInto(p, 0, ''); await typeInto(p, 1, '');
  await p.waitForTimeout(200);
  if (tag === 'base') { await full(p, 'scan'); continue; }
  await clipShot(p, 'crop-fields', boxes.scan.fields);
  for (let i = 0; i <= provV.length; i++) { await typeInto(p, 0, provV.slice(0, i)); await clipShot(p, `prov-${String(i).padStart(2, '0')}`, pad(boxes.scan.prov, 2)); }
  for (let i = 0; i <= afmV.length; i++) { await typeInto(p, 1, afmV.slice(0, i)); await clipShot(p, `afm-${String(i).padStart(2, '0')}`, pad(boxes.scan.afm, 2)); }
  boxes.scan.provN = provV.length; boxes.scan.afmN = afmV.length;
}

// ── 3β. Φάκελος ακινήτου, στην προβολή «Φάκελοι»: τα αρχεία ανά κατηγορία ──
for (const [dsf, tag] of [[BASE, ''], [CLOSE, 'crop-']]) {
  p = await open('?c=documents&n=6', dsf);
  await p.getByRole('button', { name: 'Φάκελοι', exact: true }).click();
  await p.waitForTimeout(800);
  const card = { x: 16, y: 366, w: 358, h: 383 };
  if (!tag) {
    boxes.documents = { card, rows: await Promise.all(['Ασφαλιστήριο', 'ΕΝΦΙΑ', 'Μισθωτήριο', 'Ρεύμα', 'Υδραυλικός', 'Έγγραφο']
      .map(async (n) => { const r = await rect(p.locator('.app-content').getByText(n, { exact: true }).last()); return { x: 24, y: r.y - 10, w: 342, h: 50 }; })) };
    await full(p, 'documents');
    const hs = await docRowsOf(p, ROWS_DOC.map((n) => p.locator('.app-content').getByText(n, { exact: true }).last()));
    await showRows(hs, 0); await p.waitForTimeout(150); await full(p, 'documents-empty');
  } else {
    await clipShot(p, 'crop-documents', card);
    const hs = await docRowsOf(p, ROWS_DOC.map((n) => p.locator('.app-content').getByText(n, { exact: true }).last()));
    await showRows(hs, 0); await p.waitForTimeout(120); await clipShot(p, 'docs-0', card);
    await showRows(hs, 6); await p.waitForTimeout(120);
    for (let i = 0; i < 6; i++) await clipShot(p, `drow-${i}`, { x: 16, y: 419 + 53 * i, w: 358, h: 53 });
  }
}

// ── 4. Λογιστική: «Κατέβασε», μετά το πραγματικό πάτημα «Ετοιμάζεται» ───
for (const [dsf, tag] of [[BASE, ''], [CLOSE, 'crop-']]) {
  p = await open('?c=accounting&n=6', dsf);
  const card = { x: 26, y: 284, w: 338, h: 284 };
  if (!tag) boxes.accounting = { card, download: await rect(p.getByRole('button', { name: 'Κατέβασε' })) };
  if (tag) await clipShot(p, 'crop-dossier', card); else await full(p, 'accountant');
  await p.getByRole('button', { name: 'Κατέβασε' }).click();
  await p.waitForTimeout(500);
  if (tag) await clipShot(p, 'crop-dossierBusy', card); else await full(p, 'accountantBusy');
}

writeFileSync(join(out, 'boxes.json'), JSON.stringify(boxes, null, 1));
await ctx.close();
await b.close();
console.log('✓ λήψεις v4');
process.exit(0);
