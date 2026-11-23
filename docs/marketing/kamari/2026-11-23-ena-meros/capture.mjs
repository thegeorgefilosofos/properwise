// Οι πραγματικές οθόνες της ταινίας (v8), από τον πάγκο κινητού με δεδομένα επίδειξης.
//
//   node scripts/perf-bench/build-mobile.mjs
//   CHROMIUM_PATH=… node docs/marketing/kamari/2026-11-23-ena-meros/capture.mjs
//
// Κάθε καρέ της εφαρμογής το αποδίδει η ίδια η εφαρμογή. Το ρολόι παγώνει στις 23/11/2026 09:41
// (οι «ημέρες ακόμη» του lib/tax/greekTaxCalendar.ts).
//
// ΤΑ ΔΕΔΟΜΕΝΑ ΕΠΙΔΕΙΞΗΣ ΤΗΣ ΤΑΙΝΙΑΣ. Ο πάγκος απαντά στις ερωτήσεις της εφαρμογής με το
// `window.__respond`. Η λήψη το τυλίγει (πριν φορτώσει η σελίδα) και αλλάζει τρία πράγματα
// στα ίδια ψεύτικα δεδομένα, ώστε η εφαρμογή να αποδίδει μόνη της συνεπείς καταστάσεις:
//   · κανένα δάνειο: χωρίς την προειδοποίηση «Η δόση ξεπερνά…» και το τσιπ «Δάνειο»
//   · το εκκαθαριστικό ΕΝΦΙΑ χωρίς ποσό: κανένα ποσό ΕΝΦΙΑ γραμμένο με το χέρι στην εικόνα
//   · «μετά τη σάρωση»: η γραμμή που γράφει η Καταχώρηση στο property_documents, με τα στοιχεία
//     που διάβασε η σάρωση του πάγκου (SCAN_REVIEW_DOCS.bill του scripts/perf-bench/mobile.tsx)
import { chromium } from 'playwright-core';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const out = join(here, 'work/shots9');
mkdirSync(out, { recursive: true });
// v9: η ταινία δείχνει την εφαρμογή σε 2,6 έως 3,1 px κάδρου ανά px (λήψη ×9 για ως ×9,3)·
// το κοντινό του «Κατέβασε» σε 4,6 (λήψη ×14 μόνο της περιοχής του).
const BASE = 9, MACRO = 14;
// Οι περιοχές της οθόνης που δείχνει κάθε πλάνο (px εφαρμογής, ολόκληρο το πλάτος).
const REG = { overview: { x: 0, y: 250, w: 390, h: 594 }, tiles: { x: 0, y: 80, w: 390, h: 764 }, form: { x: 0, y: 220, w: 390, h: 440 },
  save: { x: 0, y: 520, w: 390, h: 324 }, docs: { x: 0, y: 350, w: 390, h: 494 } };
const NOW = new Date('2026-11-23T09:41:00+02:00');
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--disable-dev-shm-usage'] });
const boxes = {};
let ctx = null;

// Η ανάγνωση της σάρωσης για την ταινία (v9): ο λογαριασμός του χαρτιού της ταινίας, όχι ληξιπρόθεσμος.
// Ίδια μορφή με το SCAN_REVIEW_DOCS.bill του scripts/perf-bench/mobile.tsx, με ημερομηνίες Νοεμβρίου.
const READ = {
  doc_type: 'bill', title: 'Λογαριασμός ρεύματος', provider: 'Πάροχος Ενέργειας Α.Ε.', provider_afm: '090000045',
  category: 'electricity', amount: 84.5, issue_date: '2026-11-05', due_date: '2026-11-30',
  period: 'Οκτώβριος 2026', kwh: 312, account_num: '123456789', notes: null, confidence: 92,
};
// Η γραμμή που γράφει η Καταχώρηση στο property_documents.
const SCANNED = {
  id: 'film-scan', property_id: 'p0', user_id: 'u1', kind: 'bill', category: 'bill', title: 'Λογαριασμός ρεύματος', notes: null,
  doc_date: '2026-11-05', file_path: 'u1/p0/film-scan.png', file_name: 'logariasmos-revmatos.png', mime: 'image/png',
  size_bytes: 18_000, created_at: '2026-11-23T07:41:00Z', supplier: 'Πάροχος Ενέργειας Α.Ε.', amount: 84.5, provider_afm: '090000045',
};

async function open(q, dsf, { after = false } = {}) {
  if (ctx) await ctx.close();
  ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dsf });
  await ctx.clock.setFixedTime(NOW);
  await ctx.addInitScript(({ after, scanned, read }) => {
    // Η σκηνή scanReview αντικαθιστά το window.fetch για να απαντήσει στην ανάγνωση· εδώ η απάντηση
    // είναι η READ. Ο setter αγνοεί την αντικατάσταση της σκηνής, ώστε να απαντά αυτό το fetch.
    const orig = window.fetch.bind(window);
    const mine = (url, init) => (String(url).includes('/api/anthropic')
      ? Promise.resolve(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(read) }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      : orig(url, init));
    Object.defineProperty(window, 'fetch', { configurable: true, get: () => mine, set: () => {} });
    let real;
    const mod = (call, r) => {
      if (!r || !Array.isArray(r.data)) return r;
      if (call.table === 'loans') return { ...r, data: [] };
      if (call.table === 'property_documents') {
        const rows = r.data.map((d) => (d.kind === 'tax' ? { ...d, amount: null } : d));
        return { ...r, data: after ? [...rows, scanned] : rows };
      }
      return r;
    };
    Object.defineProperty(window, '__respond', { configurable: true, get: () => real, set: (f) => { real = (call) => mod(call, f(call)); } });
  }, { after, scanned: SCANNED, read: READ });
  const p = await ctx.newPage();
  await p.goto(pathToFileURL(join(root, '.perf-bench/mobile.html')).href + q, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.evaluate(() => document.fonts.ready);
  return p;
}
const rect = async (loc) => { const r = await loc.first().boundingBox(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
const pad = (r, d) => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
const clipShot = (p, name, r) => p.screenshot({ path: join(out, name + '.png'), clip: { x: r.x, y: r.y, width: r.w, height: r.h } });
// Τιμή σε πεδίο React: ο εγγενής setter και ένα συμβάν input, όπως η πληκτρολόγηση.
const setVal = (loc, v) => loc.evaluate((el, v) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}, v);
// Με σημάδι και κανόνα !important: ένα νέο απόδοσμα του React δεν το σβήνει όπως το style.
const setVis = async (hs, n) => {
  await hs[0].evaluate(() => { if (!document.getElementById('film-hide')) { const s = document.createElement('style'); s.id = 'film-hide'; s.textContent = '[data-film-hide]{visibility:hidden!important}'; document.head.appendChild(s); } });
  await Promise.all(hs.map((h, i) => h.evaluate((el, hide) => { if (hide) el.setAttribute('data-film-hide', ''); else el.removeAttribute('data-film-hide'); }, i >= n)));
};
const boxOf = (h) => h.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });

// ── 1. Επισκόπηση: οι προθεσμίες εμφανίζονται μόνες τους ──────────────
const ROWS_OV = ['ΕΝΦΙΑ, 9η δόση', 'Φόρος εισοδήματος, 5η δόση', 'Τέλος ανθεκτικότητας κλιματικής κρίσης, απόδοση', 'Δήλωση βραχυχρόνιας διαμονής (Μητρώο ΑΑΔΕ)'];
let p = await open('?c=overview&n=6', BASE);
// Η κάρτα «Τι άλλαξε στους όρους» εμφανίζεται μία φορά· κλείνει με το δικό της κουμπί, όπως από τον χρήστη.
await p.locator('section[aria-label="Τι άλλαξε στους όρους χρήσης"] button').last().click();
await p.waitForTimeout(500);
{
  // Το κουμπί είναι κάλυμμα πάνω στη γραμμή (agenda-cover)· η γραμμή είναι το li.agenda-row.
  const hs = await Promise.all(ROWS_OV.map((n) => p.getByRole('button', { name: `${n}: Ημερολόγιο` }).evaluateHandle((el) => el.closest('li'))));
  boxes.overview = { scan: await rect(p.getByRole('button', { name: 'Σάρωσε έγγραφο' })), rows: await Promise.all(hs.map(boxOf)) };
  for (const [i, r] of boxes.overview.rows.entries()) await clipShot(p, `prow-${i}`, r);
  // Μόνο η περιοχή που δείχνει το πλάνο (λιγότερη μνήμη στην ταινία): από την κάρτα «Εκκρεμότητες» και κάτω.
  await setVis(hs, 0); await p.waitForTimeout(150); await clipShot(p, 'overview-empty', REG.overview);
}

// ── 2. Σάρωση: τα πλακίδια (το «Σάρωσε έγγραφο» ανοίγει αυτό το παράθυρο) ──
p = await open('?c=scan&n=6', BASE);
boxes.scanTiles = { photo: await rect(p.getByRole('button', { name: /Φωτογράφισε/ })) };
await clipShot(p, 'scan-tiles', REG.tiles);

// ── 3. Ο έλεγχος της σάρωσης: τα πεδία γεμίζουν από την ανάγνωση ────────
const PROV_V = 'Πάροχος Ενέργειας Α.Ε.', AFM_V = '090000045', DATE_V = '05/11/2026';
// Οι ημερομηνίες του χαρτιού (έκδοση, λήξη, περίοδος): κείμενο μέσα στα κουμπιά ημερολογίου.
const DATES = [DATE_V, '30/11/2026', '01/10/2026', '31/10/2026'];
p = await open('?c=scanReview&n=6', BASE);
await p.waitForTimeout(1500);
{
  const prov = p.getByLabel('Πάροχος', { exact: true }).first(), afm = p.getByLabel('ΑΦΜ παρόχου', { exact: true }).first();
  if ((await prov.inputValue()) !== PROV_V || (await afm.inputValue()) !== AFM_V) throw new Error('άλλες τιμές στη σάρωση');
  // Η ημερομηνία δεν είναι πεδίο input: η τιμή της είναι κείμενο «20/09/2026» μέσα στο κουμπί του ημερολογίου.
  const dates = DATES.map((d) => p.getByText(d, { exact: true }).first());
  const amount = p.getByLabel('Ποσό', { exact: true }).first();
  // Το σώμα του παραθύρου κυλά ώστε από τον «Πάροχο» ως το «Ποσό» να φαίνονται πάνω από την «Καταχώρηση».
  await prov.evaluate((el) => {
    let s = el.parentElement; while (s && !(s.scrollHeight > s.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(s).overflowY))) s = s.parentElement;
    if (s) s.scrollTop += el.getBoundingClientRect().top - s.getBoundingClientRect().top - 150;
  });
  await p.waitForTimeout(300);
  const amountV = await amount.inputValue();
  boxes.scan = { prov: await rect(prov), afm: await rect(afm), dates: await Promise.all(dates.map(rect)), amount: await rect(amount), amountV,
    save: await rect(p.getByRole('button', { name: 'Καταχώρηση' })) };
  await clipShot(p, 'scan-full', REG.save);
  for (const l of [prov, afm, amount]) await setVal(l, '');
  for (const d of dates) await d.evaluate((el) => { el.style.visibility = 'hidden'; });
  await p.waitForTimeout(200);
  await clipShot(p, 'scan-blank', REG.form);
  // Τα κοντινά των πεδίων, γεμάτα: η ταινία τα δείχνει ολόκληρα, το ένα μετά το άλλο (όχι πληκτρολόγηση).
  await setVal(prov, PROV_V); await clipShot(p, 'prov-1', pad(boxes.scan.prov, 2));
  await setVal(afm, AFM_V); await clipShot(p, 'afm-1', pad(boxes.scan.afm, 2));
  for (const [i, d] of dates.entries()) { await d.evaluate((el) => { el.style.visibility = 'visible'; }); await clipShot(p, `date-${i}`, pad(boxes.scan.dates[i], 2)); }
  await setVal(amount, amountV); await clipShot(p, 'amount-1', pad(boxes.scan.amount, 2));
}

// ── 4. Φάκελος ακινήτου, προβολή «Φάκελοι»: πριν και μετά την Καταχώρηση ──
for (const after of [false, true]) {
  p = await open('?c=documents&n=6', BASE, { after });
  await p.getByRole('button', { name: 'Φάκελοι', exact: true }).click();
  await p.waitForTimeout(800);
  // Η γραμμή του φακέλου: ο ψηλότερος πρόγονος κάτω από 75 px ύψος και πάνω από 300 px πλάτος.
  const h = await p.locator('.app-content').getByText('Ρεύμα', { exact: true }).last().evaluateHandle((el) => {
    let best = el; for (let e = el; e && e.getBoundingClientRect().height < 75; e = e.parentElement) if (e.getBoundingClientRect().width >= 300) best = e; return best; });
  const r = await boxOf(h);
  boxes[after ? 'docsAfter' : 'docs'] = { power: r, text: await h.evaluate((el) => el.innerText),
    card: await boxOf(await p.getByText('Φάκελοι', { exact: true }).last().evaluateHandle((el) => { while (el.getBoundingClientRect().width < 340) el = el.parentElement; return el; })) };
  await clipShot(p, after ? 'docs-after' : 'docs', REG.docs);
}

// ── 5. Λογιστική: «Κατέβασε», μετά το πραγματικό πάτημα «Ετοιμάζεται» (κοντινό ×14) ──
p = await open('?c=accounting&n=6', MACRO);
{
  const dl = await rect(p.getByRole('button', { name: 'Κατέβασε' }));
  // Μόνο ΑΦΜ και κουμπιά: η κεφαλίδα της κάρτας και ό,τι είναι κάτω μένουν έξω από τη λήψη.
  const crop = { x: 20, y: dl.y - 70, w: 260, h: 120 };
  boxes.accounting = { download: dl, crop };
  await clipShot(p, 'acc', crop);
  await p.getByRole('button', { name: 'Κατέβασε' }).click();
  await p.waitForTimeout(500);
  await clipShot(p, 'acc-busy', crop);
}

writeFileSync(join(out, 'boxes.json'), JSON.stringify(boxes, null, 1));
await ctx.close();
await b.close();
boxes.REG = REG;
console.log('✓ λήψεις v9');
console.log(JSON.stringify(boxes, null, 1));
process.exit(0);
