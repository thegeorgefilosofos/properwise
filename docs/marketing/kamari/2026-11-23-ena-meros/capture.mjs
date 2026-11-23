// Οι πραγματικές οθόνες της ταινίας, από τον πάγκο κινητού με δεδομένα επίδειξης.
//
//   node scripts/perf-bench/build-mobile.mjs
//   CHROMIUM_PATH=… node docs/marketing/kamari/2026-11-23-ena-meros/capture.mjs
//
// Γράφει στο work/shots/: ένα PNG ανά κατάσταση (390×844 CSS px, ×6), τα κουτιά
// των στοιχείων που πατά ο δρομέας (boxes.json) και κάθε ορατή γραμμή με ψηφίο
// (digits.json), για τον πίνακα αριθμών του plan.md. Το ρολόι παγώνει στις
// 23/11/2026 09:41: οι «ημέρες ακόμη» βγαίνουν από το lib/tax/greekTaxCalendar.ts
// για εκείνη τη μέρα και όχι για τη μέρα της λήψης.
import { chromium } from 'playwright-core';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const out = join(here, 'work/shots');
mkdirSync(out, { recursive: true });
const DSF = 6;
const NOW = new Date('2026-11-23T09:41:00+02:00');

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const boxes = {}, digits = {};

async function open(q) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: DSF });
  await ctx.clock.setFixedTime(NOW);
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('σφάλμα σελίδας', q, e.message.slice(0, 160)));
  await p.goto(pathToFileURL(join(root, '.perf-bench/mobile.html')).href + q, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  return p;
}
const box = async (p, loc) => { const r = await loc.first().boundingBox(); return r && { x: r.x, y: r.y, w: r.width, h: r.height }; };
async function shot(p, name, targets) {
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.screenshot({ path: join(out, `${name}.png`) });
  boxes[name] = {};
  for (const [k, loc] of Object.entries(targets)) boxes[name][k] = await box(p, loc);
  // Κάθε ορατή γραμμή κειμένου με ψηφίο, μέσα στη θύρα προβολής.
  digits[name] = await p.evaluate(() => {
    const rows = new Set();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.textContent.trim();
      if (!/\d/.test(t)) continue;
      const el = n.parentElement; const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.bottom < 0 || r.top > innerHeight || r.width === 0 || cs.visibility === 'hidden' || cs.opacity === '0') continue;
      rows.add(t);
    }
    return [...rows];
  });
  console.log('✓', name);
}

// 1. Επισκόπηση, χωρίς την ενημέρωση όρων (ο χρήστης την έχει κλείσει).
let p = await open('?c=overview&n=6&noa=1');
await p.click('button[aria-label="Το κατάλαβα"]');
await shot(p, 'overview', {
  scan: p.getByRole('button', { name: 'Σάρωσε έγγραφο' }),
  pending: p.getByText('Εκκρεμότητες', { exact: true }),
  enfia: p.getByRole('button', { name: 'ΕΝΦΙΑ, 9η δόση: Ημερολόγιο' }),
  net: p.getByText('Καθαρό 2026', { exact: false }),
});
// 2. Η ίδια Επισκόπηση πιο κάτω: η Νόα και οι οφειλές.
await p.evaluate(() => { document.querySelectorAll('*').forEach(el => { if (el.scrollHeight > el.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(el).overflowY)) el.scrollTop = 700; }); window.scrollTo(0, 700); });
await shot(p, 'noa', {
  hello: p.getByText('Γεια σου. Βλέπω', { exact: false }),
  ask: p.getByRole('button', { name: /Τι πρέπει να κάνω για/ }),
  owed: p.getByRole('button', { name: /Οφείλεις/ }),
});
// 3. Η σάρωση, με το παραστατικό ήδη διαβασμένο.
p = await open('?c=scanReview&n=6');
await p.waitForTimeout(2000);
await shot(p, 'scan', {
  provider: p.locator('input[value="Πάροχος Ενέργειας Α.Ε."]'),
  updates: p.getByText('Θα ενημερωθούν', { exact: false }),
  save: p.getByRole('button', { name: 'Καταχώρηση' }),
  title: p.getByText('Σάρωση εγγράφου', { exact: true }),
});
// 4. Η Λογιστική: ο φάκελος για τον λογιστή, πριν και μετά το «Κατέβασε».
p = await open('?c=accounting&n=6');
const targets = () => ({
  card: p.getByText('Για τον λογιστή', { exact: false }),
  download: p.getByRole('button', { name: /Κατέβασε|Ετοιμάζεται/ }),
  link: p.getByRole('button', { name: 'Σύνδεσμος για τον λογιστή' }),
});
await shot(p, 'accountant', targets());
await p.getByRole('button', { name: 'Κατέβασε' }).click();
await p.waitForTimeout(500);
await shot(p, 'accountantBusy', targets());

writeFileSync(join(out, 'boxes.json'), JSON.stringify(boxes, null, 1));
writeFileSync(join(out, 'digits.json'), JSON.stringify(digits, null, 1));
await b.close();
process.exit(0);
