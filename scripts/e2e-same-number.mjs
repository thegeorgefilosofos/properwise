#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΙΔΙΟ ΠΟΣΟ, ΙΔΙΟ ΣΕ ΚΑΘΕ ΟΘΟΝΗ ΠΟΥ ΤΟ ΔΕΙΧΝΕΙ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΖΗΤΗΘΗΚΕ (13.10.2026). Ο φόρος ενοικίων, ο ΕΝΦΙΑ και το μέσο επιτόκιο
// στεγαστικών εμφανίζονται πλέον σε περισσότερες από μία θέσεις: λυμένο
// παράδειγμα στη σελίδα του υπολογιστή, ο ίδιος ο υπολογιστής, οδηγός, αρχική,
// περιγραφή για τη μηχανή αναζήτησης. Οι μονάδες ελέγχουν ότι κάθε θέση
// βγαίνει από τη μηχανή (app/toolSeo.test.ts, lib/tools/stegastiko.test.ts).
// Εδώ ελέγχεται ό,τι ΒΛΕΠΕΙ ο επισκέπτης σε πραγματικό Chromium: ότι το ποσό
// μιας θέσης είναι το ποσό της άλλης, σε υπολογιστή (1280) και σε κινητό (390).
//
// ΚΑΝΕΝΑ ΑΝΑΜΕΝΟΜΕΝΟ ΠΟΣΟ ΓΡΑΜΜΕΝΟ ΕΔΩ. Το σενάριο διαβάζει το ποσό από τη μία
// οθόνη και το ζητά ίδιο από την άλλη. Αν αλλάξει ο νόμος, η κλίμακα ή η τιμή
// της ΕΚΤ, ο έλεγχος δεν ξαναγράφεται. Τα ποσά του ιδιοκτήτη (12.000€ → 1.710€,
// κτίριο του 1925 → 67,20€) τα φυλάει με την πηγή τους το app/toolSeo.test.ts.
//
// Η ΑΓΟΡΑ ΧΩΡΙΣ ΤΙΜΕΣ ΕΙΝΑΙ ΚΙ ΑΥΤΗ ΣΥΝΕΠΕΙΑ. Χωρίς βάση (τοπικό build, CI) η
// σελίδα στεγαστικού δεν έχει τιμή: τότε ελέγχεται ότι καμία θέση δεν γράφει
// επιτόκιο αγοράς και ότι το «Σταθερό επιτόκιο» ξεκινά κενό. Με τιμές
// ελέγχεται ότι η σημείωση, η περιγραφή (meta, og, twitter, JSON-LD) και το
// πεδίο λένε τα ίδια νούμερα και ότι κάθε τιμή δείχνει στη δική της σειρά.
//
// ΤΡΕΞΕ: με διακομιστή σηκωμένο (npm run build && npm run start)
//     node scripts/e2e-same-number.mjs
// Προαιρετικά E2E_SHOTS=<φάκελος> για στιγμιότυπα των τριών σελίδων στα 390
// (πρώτη οθόνη και πλήρης σελίδα).
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { chromePath } from './lib/chrome.mjs';
import { plain } from './lib/plain-text.mjs';
import { SEED_CONSENT } from './lib/consent.mjs';

const require = createRequire(import.meta.url);
let pkg;
try { pkg = require('playwright-core'); }
catch { console.error('Λείπει το playwright-core. Τρέξε: npm i -D playwright-core'); process.exit(2); }
const { chromium } = pkg;

const B = process.env.E2E_BASE || 'http://localhost:3000';
const SHOTS = process.env.E2E_SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const RENT = '/ypologismos-forou-enoikion';
const RENT_GUIDE = '/odigos/forologia-enoikion-2026';
const ENFIA = '/ypologismos-enfia';
const ENFIA_GUIDE = '/odigos/pos-ypologizetai-o-enfia';
const MORTGAGE = '/ypologismos-stegastikou-daneiou';

const VIEWS = [
  { name: '1280', ctx: { viewport: { width: 1280, height: 900 } } },
  { name: '390', ctx: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
];

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; return; }
  fail++;
  console.log('  ✗ ' + name + (extra ? `\n      ${extra}` : ''));
};

// ── ΑΡΙΘΜΟΙ ΟΠΩΣ ΤΟΥΣ ΓΡΑΦΕΙ Η ΟΘΟΝΗ ──────────────────────────────────────
// «1.710,00€», «−570,00€», «3,27%», «1,15». Η σύγκριση γίνεται σε λεπτά (ή σε
// εκατοστά της μονάδας για ποσοστό και συντελεστή), ώστε το «1.710€» της μιας
// μορφής και το «1.710,00€» της άλλης να είναι το ίδιο ποσό.
const num = t => {
  const s = plain(String(t ?? '')).replace(/−/g, '-').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return s && s !== '-' ? Number(s) : NaN;
};
const hund = t => Math.round(Math.abs(num(t)) * 100);
const clean = s => plain(String(s ?? '')).replace(/\s+/g, ' ').trim();
// Οι ετικέτες της κορυφής είναι κεφαλαία με CSS και το `innerText` τα δίνει
// χωρίς τόνους («ΣΟΥ ΜΕΝΟΥΝ»): η σύγκριση ετικέτας γίνεται χωρίς τόνους.
const bare = s => clean(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// ── Ο ΠΙΝΑΚΑΣ ΣΥΝΕΠΕΙΑΣ ─────────────────────────────────────────────────────
// Κάθε σύγκριση γράφει ποιο ποσό, σε ποια οθόνη, με ποια τιμή. Τυπώνεται στο
// τέλος: διαβάζεται χωρίς να ανοίξει κανείς τον κώδικα.
const table = [];
/** Όλες οι θέσεις του ίδιου ποσού: ίσες σε λεπτά, αλλιώς αποτυχία. */
function same(view, topic, what, places) {
  const present = places.filter(p => p.value != null && p.value !== '');
  for (const p of places) table.push({ topic, what, screen: p.screen, view, value: p.value == null || p.value === '' ? '(δεν εμφανίζεται)' : clean(p.value) });
  const want = present.length ? hund(present[0].value) : NaN;
  ok(`${view}: ${topic}: «${what}» ίδιο σε ${places.length} θέσεις`,
    places.length > 1 && present.length === places.length && present.every(p => hund(p.value) === want && Number.isFinite(want)),
    places.map(p => `${p.screen}: ${p.value ?? '(κενό)'}`).join(' · '));
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromePath(), args: ['--no-sandbox'] });

async function open(ctx, path) {
  const p = await ctx.newPage();
  const res = await p.goto(B + path, { waitUntil: 'networkidle' });
  ok(`${path}: HTTP 200`, res?.status() === 200, `HTTP ${res?.status()}`);
  await p.evaluate(() => document.fonts.ready);
  return p;
}

async function shots(p, view, slug) {
  if (!SHOTS || view !== '390') return;
  await p.screenshot({ path: join(SHOTS, `${slug}-390-proti-othoni.png`) });
  await p.screenshot({ path: join(SHOTS, `${slug}-390-pliris.png`), fullPage: true });
}

/** Οι γραμμές μιας ανάλυσης (`ToolLedger`): ετικέτα, ποσό, υποσημείωση. */
const ledger = dl => dl.evaluate(el => [...el.querySelectorAll(':scope > div')].map(d => {
  const dd = d.querySelectorAll('dd');
  const t = x => (x?.innerText ?? '').replace(/\u00AD/g, '').replace(/\s+/g, ' ').trim();
  return { k: t(d.querySelector('dt')), v: t(dd[0]), sub: t(dd[1]) };
}));
const row = (rows, start) => rows.find(r => r.k.startsWith(start));

/** Η κορυφή της κάρτας του υπολογιστή: το κύριο νούμερο και τα δευτερεύοντα. */
async function hero(p) {
  const h = p.locator('.po-tool-hero').first();
  await h.waitFor({ timeout: 10_000 }).catch(() => {});
  if (!(await h.count())) return { primary: null, secondary: [] };
  return h.evaluate(el => {
    const t = x => (x?.innerText ?? '').replace(/\u00AD/g, '').replace(/\s+/g, ' ').trim();
    const figs = [...el.children].map(c => ({ label: t(c.firstElementChild), value: t(c.querySelector('.po-fig')) }));
    return { primary: figs[0], secondary: figs.slice(1) };
  });
}
/** Η ανάλυση του υπολογιστή: η πρώτη λίστα μετά την κορυφή της κάρτας. */
const calcLedger = p => ledger(p.locator('.po-tool-hero').first().locator('xpath=following::dl[1]'));

/** Διαλέγει επιλογή σε `CustomSelect`, όπως ο χρήστης: άνοιγμα και κλικ. */
async function pick(p, label, match) {
  const box = p.getByRole('combobox', { name: label });
  await box.click();
  const opts = p.getByRole('option');
  const texts = (await opts.allInnerTexts()).map(clean);
  const i = texts.findIndex(match);
  if (i < 0) { await p.keyboard.press('Escape'); return null; }
  await opts.nth(i).click();
  await p.waitForTimeout(200);
  return texts[i];
}

async function fill(p, label, value) {
  await p.getByLabel(label, { exact: true }).fill(String(value));
  await p.waitForTimeout(200);
}

// ═══ ΦΟΡΟΣ ΕΝΟΙΚΙΩΝ ═════════════════════════════════════════════════════════
async function rent(ctx, view) {
  const T = 'φόρος ενοικίων';
  const p = await open(ctx, RENT);
  await shots(p, view, 'foros-enoikion');

  // ── Το λυμένο παράδειγμα της σελίδας ──────────────────────────────────
  const link = p.getByRole('link', { name: 'Άνοιξε το παράδειγμα στον υπολογιστή' });
  ok(`${view}: ${T}: ένα λυμένο παράδειγμα με σύνδεσμο`, (await link.count()) === 1);
  if (!(await link.count())) return;
  const sec = link.locator('xpath=ancestor::section[1]');
  const title = clean(await sec.locator('h2').first().innerText());
  const tm = title.match(/([\d.,]+)\s*€\s*ενοίκιο τον χρόνο,\s*([\d.,]+)\s*€\s*φόρος/);
  ok(`${view}: ${T}: ο τίτλος του παραδείγματος λέει ενοίκιο και φόρο`, !!tm, title);
  const ex = await ledger(sec.locator('dl').first());
  const prose = clean(await sec.innerText());
  const net = prose.match(/Σου μένουν ([\d.,]+)\s*€ τον χρόνο/)?.[1];
  // Τα στοιχεία του παραδείγματος όπως τα ΔΙΑΒΑΖΕΙ ο επισκέπτης: «Μηνιαίο
  // ενοίκιο 1.000,00€ για 12 μήνες, εισόδημα του 2026». Ο σύνδεσμος παραλείπει
  // όσα είναι ίδια με την προεπιλογή της φόρμας, οπότε δεν είναι η πηγή τους.
  const given = prose.match(/Μηνιαίο ενοίκιο ([\d.,]+)\s*€ για (\d+) μήνες, εισόδημα του (\d{4})/);
  ok(`${view}: ${T}: το παράδειγμα λέει μηνιαίο ενοίκιο, μήνες και χρονιά`, !!given, prose.slice(0, 200));
  if (!given) return;
  const [, monthly, months, year] = given;
  const href = await link.getAttribute('href');
  const gross = row(ex, 'Ετήσιο ενοίκιο')?.v;
  const label = `${clean(gross)} ενοίκιο, εισόδημα ${year}`;

  // ── Η φόρμα της ΙΔΙΑΣ σελίδας, γραμμένη με το χέρι ─────────────────────
  await fill(p, 'Μηνιαίο ενοίκιο', monthly);
  await fill(p, 'Μήνες ενοικίασης', months);
  await p.getByRole('button', { name: new RegExp(`^${year}`) }).click();
  await p.waitForTimeout(300);
  const typed = await hero(p);
  const typedL = await calcLedger(p);
  const typedSub = row(typedL, 'Φόρος εισοδήματος')?.sub ?? '';

  // ── Ο σύνδεσμος του παραδείγματος, σε καθαρή σελίδα ─────────────────────
  const lp = await open(ctx, href);
  const linked = await hero(lp);
  const linkedL = await calcLedger(lp);
  const linkedSub = row(linkedL, 'Φόρος εισοδήματος')?.sub ?? '';
  ok(`${view}: ${T}: ο σύνδεσμος γεμίζει τη φόρμα με το παράδειγμα`,
    hund(await lp.getByLabel('Μηνιαίο ενοίκιο', { exact: true }).inputValue()) === hund(monthly)
    && hund(await lp.getByLabel('Μήνες ενοικίασης', { exact: true }).inputValue()) === hund(months)
    && (await lp.getByRole('button', { name: new RegExp(`^${year}`) }).getAttribute('aria-pressed')) === 'true');
  await lp.close();

  const taxPlaces = [
    { screen: 'παράδειγμα σελίδας, τίτλος', value: tm?.[2] },
    { screen: 'παράδειγμα σελίδας, ανάλυση', value: row(ex, 'Φόρος εισοδήματος')?.v },
    { screen: 'υπολογιστής, γραμμένο με το χέρι', value: typed.primary?.value },
    { screen: 'υπολογιστής, ανάλυση', value: row(typedL, 'Φόρος εισοδήματος')?.v },
    { screen: 'υπολογιστής από τον σύνδεσμο', value: linked.primary?.value },
  ];

  // ── Η αρχική: ο ίδιος φόρος για το ίδιο μηνιαίο ενοίκιο ──────────────────
  // Η αρχική υπολογίζει πάντα δώδεκα μήνες με την κλίμακα που γράφει δίπλα
  // («Κλίμακα ενοικίων 2026»). Συγκρίνεται μόνο όταν αυτά είναι και του παραδείγματος.
  const home = await open(ctx, '/');
  const box = home.getByLabel('Μηνιαίο ενοίκιο, ποσό');
  // Η ενότητα έχει `content-visibility: auto` (`lp-reveal`): εκτός οθόνης δεν
  // αποδίδεται και το `innerText` της είναι κενό. Πρώτα κύλιση ως τη φόρμα και
  // αναμονή ώσπου να φανεί το αποτέλεσμα.
  await box.scrollIntoViewIfNeeded();
  await home.getByText('Φόρος τον χρόνο', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  const homeYear = (await home.evaluate(() => document.body.textContent ?? '')).match(/Κλίμακα ενοικίων\s*(\d{4})/)?.[1];
  if (homeYear === year && months === '12') {
    await box.click(); await box.fill(String(num(monthly))); await box.press('Enter');
    await home.waitForTimeout(300);
    const stat = await home.evaluate(() => {
      const t = x => (x?.textContent ?? '').replace(/\u00AD/g, '').trim();
      const lab = [...document.querySelectorAll('span')].find(s => t(s) === 'Φόρος τον χρόνο');
      const taxable = [...document.querySelectorAll('span')].map(t).find(s => /^φορολογητέο /.test(s));
      return { tax: t(lab?.nextElementSibling), taxable: taxable?.replace(/^φορολογητέο /, '') };
    });
    taxPlaces.push({ screen: 'αρχική, «Φόρος τον χρόνο»', value: stat.tax });
    same(view, T, `φορολογητέο, ${label}`, [
      { screen: 'παράδειγμα σελίδας', value: row(ex, 'Φορολογητέο')?.v },
      { screen: 'υπολογιστής', value: typedSub.match(/φορολογητέο ([\d.,]+)/)?.[1] },
      { screen: 'αρχική', value: stat.taxable },
    ]);
  } else {
    ok(`${view}: ${T}: η αρχική λέει την κλίμακά της (${homeYear ?? 'καμία'})`, !!homeYear);
    same(view, T, `φορολογητέο, ${label}`, [
      { screen: 'παράδειγμα σελίδας', value: row(ex, 'Φορολογητέο')?.v },
      { screen: 'υπολογιστής', value: typedSub.match(/φορολογητέο ([\d.,]+)/)?.[1] },
    ]);
  }
  await home.close();

  same(view, T, `φόρος, ${label}`, taxPlaces);
  same(view, T, `ετήσιο ενοίκιο, ${label}`, [
    { screen: 'παράδειγμα σελίδας, τίτλος', value: tm?.[1] },
    { screen: 'παράδειγμα σελίδας, ανάλυση', value: gross },
    { screen: 'υπολογιστής', value: row(typedL, 'Ετήσιο ενοίκιο')?.v },
    { screen: 'υπολογιστής από τον σύνδεσμο', value: row(linkedL, 'Ετήσιο ενοίκιο')?.v },
  ]);
  same(view, T, `τεκμαρτή έκπτωση, ${label}`, [
    { screen: 'παράδειγμα σελίδας', value: row(ex, 'Τεκμαρτή έκπτωση')?.v },
    { screen: 'υπολογιστής', value: typedSub.match(/έκπτωση ([\d.,]+)/)?.[1] },
    { screen: 'υπολογιστής από τον σύνδεσμο', value: linkedSub.match(/έκπτωση ([\d.,]+)/)?.[1] },
  ]);
  same(view, T, `σου μένουν, ${label}`, [
    { screen: 'παράδειγμα σελίδας', value: net },
    { screen: 'υπολογιστής', value: typed.secondary.find(s => bare(s.label).startsWith('σου μενουν'))?.value },
    { screen: 'υπολογιστής από τον σύνδεσμο', value: linked.secondary.find(s => bare(s.label).startsWith('σου μενουν'))?.value },
  ]);
  await p.close();

  // ── Ο οδηγός: κάθε παράδειγμά του, ανοιγμένο στον υπολογιστή ─────────────
  const g = await open(ctx, RENT_GUIDE);
  const gText = clean(await g.locator('main').innerText());
  const gYear = gText.match(/κλίμακα (\d{4})/)?.[1];
  ok(`${view}: ${T}: ο οδηγός λέει την κλίμακα των παραδειγμάτων του`, !!gYear);
  // `textContent` και όχι `innerText`: η λεζάντα και οι κεφαλίδες είναι κεφαλαία με CSS.
  const tables = await g.evaluate(() => [...document.querySelectorAll('table')].map(tb => {
    const t = x => (x?.textContent ?? '').replace(/\u00AD/g, '').replace(/\s+/g, ' ').trim();
    return {
      caption: t(tb.querySelector('caption')),
      head: [...tb.querySelectorAll('thead th')].map(t),
      rows: [...tb.querySelectorAll('tbody tr')].map(tr => [t(tr.querySelector('th')), ...[...tr.querySelectorAll('td')].map(t)]),
    };
  }).filter(x => /^Παράδειγμα \d/.test(x.caption)));
  ok(`${view}: ${T}: ο οδηγός έχει παραδείγματα σε πίνακα`, tables.length > 0);
  const toolHasBank = async () => (await calcPage(ctx, `${RENT}?enoikio=1000&mines=12&etos=${gYear}`, async x => (await x.getByText('Εισπράττω μέσω τράπεζας').count()) > 0));
  const bankShown = gYear ? await toolHasBank() : false;
  for (const tb of tables) {
    // Μία στήλη αποτελέσματος ανά σενάριο: «Αποτέλεσμα» ή «Με / Χωρίς έκπτωση».
    for (let c = 1; c < tb.head.length; c++) {
      const val = k => tb.rows.find(r => r[0].startsWith(k))?.[c];
      const gr = val('Ακαθάριστα'), ded = val('Έκπτωση'), tax = val('Φόρος');
      const withDed = hund(ded) > 0;
      if (!withDed && !bankShown) {
        // Η στήλη «χωρίς έκπτωση» δεν φτάνεται από τη φόρμα αυτής της χρονιάς:
        // η έκπτωση δίνεται όπως κι αν εισπράττεται το ενοίκιο (δεν υπάρχει διακόπτης).
        table.push({ topic: T, what: `${tb.caption}, ${tb.head[c]}`, screen: 'υπολογιστής', view, value: '(η φόρμα δεν έχει διακόπτη τράπεζας για το ' + gYear + ')' });
        continue;
      }
      // Δώδεκα μήνες όταν το ακαθάριστο διαιρείται ακριβώς, αλλιώς ένας μήνας με όλο το ποσό.
      const cents = hund(gr);
      const [m, months] = cents % 12 === 0 ? [cents / 1200, 12] : [cents / 100, 1];
      const url = `${RENT}?enoikio=${String(m).replace('.', ',')}&mines=${months}&etos=${gYear}&trapeza=${withDed ? 1 : 0}`;
      const calc = await calcPage(ctx, url, async x => ({ h: await hero(x), l: await calcLedger(x) }));
      const sub = row(calc.l, 'Φόρος εισοδήματος')?.sub ?? '';
      const what = `${tb.caption}${tb.head.length > 2 ? `, ${tb.head[c]}` : ''}: ${clean(gr)} ακαθάριστα, κλίμακα ${gYear}`;
      same(view, T, `φόρος, ${what}`, [
        { screen: 'οδηγός', value: tax },
        { screen: 'υπολογιστής', value: calc.h.primary?.value },
      ]);
      same(view, T, `φορολογητέο, ${what}`, [
        { screen: 'οδηγός', value: val('Φορολογητέο') },
        { screen: 'υπολογιστής', value: sub.match(/φορολογητέο ([\d.,]+)/)?.[1] },
      ]);
    }
  }
  await g.close();
}

/** Ανοίγει σελίδα, τρέχει μια ανάγνωση και την κλείνει. */
async function calcPage(ctx, path, read) {
  const x = await open(ctx, path);
  try { return await read(x); } finally { await x.close(); }
}

// ═══ ΕΝΦΙΑ ═════════════════════════════════════════════════════════════════
const ENFIA_ROWS = ['Αντικειμενική αξία ακινήτου', 'Βασικός φόρος ζώνης', 'Συντελεστής ορόφου',
  'Συντελεστής παλαιότητας', 'Κύριος φόρος κτίσματος', 'Αυτόματη μείωση', 'ΕΝΦΙΑ ετησίως'];

async function enfia(ctx, view) {
  const T = 'ΕΝΦΙΑ';
  const p = await open(ctx, ENFIA);
  await shots(p, view, 'enfia');
  const links = p.getByRole('link', { name: /^Άνοιξε το παράδειγμα \d+ στον υπολογιστή$/ });
  const n = await links.count();
  ok(`${view}: ${T}: παραδείγματα με σύνδεσμο στη φόρμα`, n > 0);
  const examples = [];
  for (let i = 0; i < n; i++) {
    const box = links.nth(i).locator('xpath=ancestor::p[1]/..');
    examples.push({
      title: clean(await box.locator('h3').first().innerText()),
      rows: await ledger(box.locator('dl').first()),
      href: await links.nth(i).getAttribute('href'),
    });
  }
  for (const ex of examples) {
    const v = k => row(ex.rows, k)?.v;
    // Η φόρμα της ΙΔΙΑΣ σελίδας, όπως θα τη γέμιζε ο ιδιοκτήτης.
    await fill(p, 'Τετραγωνικά', num(v('Τετραγωνικά')));
    await fill(p, 'Τιμή ζώνης', num(v('Τιμή ζώνης')));
    const floor = await pick(p, 'Όροφος', t => t === v('Όροφος') || t.startsWith(`${v('Όροφος')} `));
    const age = await pick(p, 'Παλαιότητα', t => t === v('Παλαιότητα'));
    ok(`${view}: ${T}: ${ex.title}: ο όροφος και η παλαιότητα υπάρχουν στη φόρμα`, !!floor && !!age, `${v('Όροφος')} · ${v('Παλαιότητα')}`);
    await p.waitForTimeout(300);
    const typed = await hero(p);
    const typedL = await calcLedger(p);
    const linked = await calcPage(ctx, ex.href, async x => ({ h: await hero(x), l: await calcLedger(x) }));
    for (const k of ENFIA_ROWS) {
      const places = [
        { screen: 'παράδειγμα σελίδας', value: v(k) },
        { screen: 'υπολογιστής, γραμμένο με το χέρι', value: row(typedL, k)?.v },
        { screen: 'υπολογιστής από τον σύνδεσμο', value: row(linked.l, k)?.v },
      ];
      if (k === 'ΕΝΦΙΑ ετησίως') places.push(
        { screen: 'υπολογιστής, κορυφή', value: typed.primary?.value },
        { screen: 'υπολογιστής από τον σύνδεσμο, κορυφή', value: linked.h.primary?.value });
      // Η μείωση λείπει από όλες τις θέσεις μαζί ή υπάρχει σε όλες.
      if (k === 'Αυτόματη μείωση' && places.every(x => x.value == null)) continue;
      same(view, T, `${k}, ${ex.title}`, places);
    }
  }

  // ── Ο οδηγός: το διαμέρισμα του παραδείγματος, γραμμένο στη φόρμα ────────
  const g = await open(ctx, ENFIA_GUIDE);
  const gt = clean(await g.locator('main').innerText());
  const gm = gt.match(/Διαμέρισμα (\d+) τ\.μ\., σε περιοχή με τιμή ζώνης ([\d.,]+)\s*€\/τ\.μ\.[^]*?(\d+) ετών \(συντελεστής ([\d,]+)\), στον (\d+)ο όροφο \(([\d,]+)\)/);
  ok(`${view}: ${T}: ο οδηγός έχει το παράδειγμα του διαμερίσματος`, !!gm);
  if (gm) {
    const [, sqm, zone, years, ageCoef, floorNo, floorCoef] = gm;
    const basic = gt.match(/Κύριος φόρος: [^=]+= ([\d.,]+)\s*€/)?.[1];
    const reduction = gt.match(/αυτόματη μείωση [\d,]+% \(κλιμάκιο έως [\d.,]+\s*€\), δηλαδή ([\d.,]+)\s*€/)?.[1];
    const annual = clean(await g.locator('.gd-result-v').first().innerText());
    await fill(p, 'Τετραγωνικά', sqm);
    await fill(p, 'Τιμή ζώνης', num(zone));
    const floor = await pick(p, 'Όροφος', t => t === `${floorNo}ος όροφος`);
    const y = Number(years);
    const age = await pick(p, 'Παλαιότητα', t => {
      const r = t.match(/^(\d+) – (\d+) έτη$/); if (r) return +r[1] <= y && y <= +r[2];
      const u = t.match(/^Έως (\d+) έτη$/); if (u) return y <= +u[1];
      const o = t.match(/^(\d+) έτη και άνω$/); return !!o && y >= +o[1];
    });
    ok(`${view}: ${T}: ο οδηγός: όροφος ${floorNo} και ${years} έτη υπάρχουν στη φόρμα`, !!floor && !!age);
    await p.waitForTimeout(300);
    const h = await hero(p);
    const l = await calcLedger(p);
    const what = `οδηγός, διαμέρισμα ${sqm} τ.μ., ζώνη ${zone}, ${years} ετών, ${floorNo}ος`;
    same(view, T, `ΕΝΦΙΑ ετησίως, ${what}`, [
      { screen: 'οδηγός', value: annual },
      { screen: 'υπολογιστής, κορυφή', value: h.primary?.value },
      { screen: 'υπολογιστής, ανάλυση', value: row(l, 'ΕΝΦΙΑ ετησίως')?.v },
    ]);
    same(view, T, `κύριος φόρος κτίσματος, ${what}`, [
      { screen: 'οδηγός', value: basic },
      { screen: 'υπολογιστής', value: row(l, 'Κύριος φόρος κτίσματος')?.v },
    ]);
    same(view, T, `αυτόματη μείωση, ${what}`, [
      { screen: 'οδηγός', value: reduction },
      { screen: 'υπολογιστής', value: row(l, 'Αυτόματη μείωση')?.v },
    ]);
    same(view, T, `συντελεστής παλαιότητας, ${what}`, [
      { screen: 'οδηγός', value: ageCoef },
      { screen: 'υπολογιστής', value: row(l, 'Συντελεστής παλαιότητας')?.v },
    ]);
    same(view, T, `συντελεστής ορόφου, ${what}`, [
      { screen: 'οδηγός', value: floorCoef },
      { screen: 'υπολογιστής', value: row(l, 'Συντελεστής ορόφου')?.v },
    ]);
  }
  await g.close();
  await p.close();
}

// ═══ ΣΤΕΓΑΣΤΙΚΟ ═════════════════════════════════════════════════════════════
// Οι ετικέτες είναι του καταλόγου lib/market/ecb.ts και ο κωδικός της σειράς
// είναι το γράμμα της περιόδου στη διεύθυνση της ΕΚΤ (MIR.M.GR.B.A2C.<γράμμα>…).
const SERIES = [
  { re: /Μέσο επιτόκιο νέων στεγαστικών στην Ελλάδα:\s*([\d,]+)%/, code: 'A', name: 'μέσο επιτόκιο νέων στεγαστικών' },
  { re: /[Κκ]υμαινόμενο ή σταθερό έως 1 έτος\s*([\d,]+)%/, code: 'F', name: 'κυμαινόμενο ή σταθερό έως 1 έτος' },
  { re: /[Σσ]ταθερό πάνω από 1 έτος\s*([\d,]+)%/, code: 'K', name: 'σταθερό πάνω από 1 έτος' },
];
const STALE = 'η πηγή δεν έχει δώσει νεότερη τιμή';

async function mortgage(ctx, view) {
  const T = 'στεγαστικό';
  const p = await open(ctx, MORTGAGE);
  await shots(p, view, 'stegastiko');
  const seen = await p.evaluate(() => {
    const t = x => (x ?? '').replace(/\u00AD/g, '').replace(/\s+/g, ' ').trim();
    const meta = sel => t(document.querySelector(sel)?.getAttribute('content'));
    const graph = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .flatMap(s => { try { const j = JSON.parse(s.textContent); return j['@graph'] ?? [j]; } catch { return []; } });
    const app = graph.find(n => n['@type'] === 'WebApplication');
    const note = document.querySelector('aside[aria-label="Μέσο επιτόκιο αγοράς"] .po-src-txt');
    // Κάθε σύνδεσμος της σημείωσης με το κείμενο που τον προηγείται.
    const links = [];
    if (note) {
      let before = '';
      const walk = n => {
        for (const c of n.childNodes) {
          if (c.nodeType === 3) before += c.textContent;
          else if (c.nodeName === 'A') { links.push({ before: t(before).slice(-80), text: t(c.textContent), href: c.getAttribute('href') }); before += c.textContent; }
          else walk(c);
        }
      };
      walk(note);
    }
    return {
      note: t(note?.innerText), links,
      desc: meta('meta[name="description"]'), og: meta('meta[property="og:description"]'),
      tw: meta('meta[name="twitter:description"]'), ld: t(app?.description),
    };
  });
  ok(`${view}: ${T}: η σημείωση της αγοράς υπάρχει`, !!seen.note);
  // Η περιγραφή είναι ΜΙΑ, σε τέσσερα σημεία.
  ok(`${view}: ${T}: meta, og, twitter και JSON-LD λένε την ίδια περιγραφή`,
    !!seen.desc && [seen.og, seen.tw, seen.ld].every(d => d === seen.desc),
    `meta: ${seen.desc}\n      og: ${seen.og}\n      twitter: ${seen.tw}\n      JSON-LD: ${seen.ld}`);
  // Το κομμάτι των στεγαστικών: ό,τι προηγείται του Euribor ή της επιφύλαξης.
  const housing = seen.note.split(/\s*(?:Euribor τριμήνου:|Η προσφορά της τράπεζάς σου)/)[0].trim();
  const hasHousing = /%/.test(housing);
  const values = {};
  for (const s of SERIES) {
    const m = housing.match(s.re);
    values[s.code] = m?.[1] ?? null;
    const places = [
      { screen: 'σημείωση σελίδας (απόσπασμα)', value: values[s.code] },
      { screen: 'meta description', value: seen.desc.match(s.re)?.[1] ?? null },
      { screen: 'og:description', value: seen.og.match(s.re)?.[1] ?? null },
      { screen: 'twitter:description', value: seen.tw.match(s.re)?.[1] ?? null },
      { screen: 'JSON-LD', value: seen.ld.match(s.re)?.[1] ?? null },
    ];
    // Η τιμή υπάρχει σε όλες τις θέσεις ή σε καμία: μισή εμφάνιση είναι αποτυχία.
    if (places.some(x => x.value != null)) same(view, T, s.name, places);
    else table.push({ topic: T, what: s.name, screen: 'σημείωση, meta, og, twitter, JSON-LD', view, value: '(δεν εμφανίζεται πουθενά)' });
    // Η τιμή δείχνει στη δική της σειρά (το P0: η F γραφόταν ως μέσος όρος).
    if (values[s.code] != null) {
      const a = s.code === 'A'
        ? seen.links.find(l => l.text === 'ΕΚΤ' && /Μέσο επιτόκιο νέων στεγαστικών/.test(l.before))
        : seen.links.find(l => s.re.test(`${l.before} ${l.text}`) && /%$/.test(l.text));
      ok(`${view}: ${T}: «${s.name}» δείχνει στη σειρά A2C.${s.code}`, !!a && new RegExp(`\\.A2C\\.${s.code}\\.`).test(a.href ?? ''), a?.href ?? '(χωρίς σύνδεσμο)');
    }
  }
  if (hasHousing) {
    ok(`${view}: ${T}: η περιγραφή ξεκινά με το κείμενο της σημείωσης`, seen.desc.startsWith(housing), `σημείωση: ${housing}\n      meta: ${seen.desc}`);
  } else {
    ok(`${view}: ${T}: χωρίς τιμές στεγαστικών, καμία θέση δεν γράφει επιτόκιο στεγαστικών`,
      !/%/.test(seen.desc) && !/στεγαστικών στην Ελλάδα/.test(seen.desc), seen.desc);
  }

  // ── Το «Σταθερό επιτόκιο» ξεκινά ΜΟΝΟ από το σταθερό πάνω από 1 έτος ─────
  const field = p.getByLabel('Σταθερό επιτόκιο', { exact: true });
  const start = await field.inputValue();
  const hintId = (await field.getAttribute('aria-describedby') ?? '').split(' ').find(x => x.endsWith('-hint'));
  const hint = hintId ? clean(await p.locator(`[id="${hintId}"]`).innerText()) : '';
  const kStale = values.K != null && new RegExp(`σταθερό πάνω από 1 έτος\\s*${values.K}%[^·.]*${STALE}`, 'i').test(housing);
  if (values.K != null && !kStale) {
    same(view, T, 'αφετηρία «Σταθερό επιτόκιο»', [
      { screen: 'σημείωση σελίδας', value: values.K },
      { screen: 'πεδίο «Σταθερό επιτόκιο»', value: start },
    ]);
    ok(`${view}: ${T}: η βοήθεια του πεδίου λέει ποια τιμή είναι`, /Σταθερό πάνω από 1 έτος/.test(hint), hint);
  } else {
    table.push({ topic: T, what: 'αφετηρία «Σταθερό επιτόκιο»', screen: 'πεδίο «Σταθερό επιτόκιο»', view, value: start || '(κενό)' });
    ok(`${view}: ${T}: χωρίς φρέσκια τιμή σταθερού πάνω από 1 έτος το πεδίο ξεκινά κενό`, start === '', `πεδίο: ${start}`);
  }
  for (const c of ['A', 'F']) {
    if (values[c] != null && values[c] !== values.K) ok(`${view}: ${T}: το πεδίο δεν ξεκινά από την τιμή A2C.${c}`, hund(start) !== hund(values[c]), `πεδίο ${start}, A2C.${c} ${values[c]}`);
  }

  // ── Euribor: σημείωση και πεδίο του κυμαινόμενου ─────────────────────────
  const eur = seen.note.match(/Euribor τριμήνου:\s*([\d,]+)%([^.]*)/);
  await p.getByRole('button', { name: /^Κυμαινόμενο$/ }).click();
  await p.waitForTimeout(250);
  const eurField = await p.getByLabel('Euribor', { exact: true }).inputValue();
  if (eur && !eur[2].includes(STALE)) {
    same(view, T, 'Euribor τριμήνου', [
      { screen: 'σημείωση σελίδας', value: eur[1] },
      { screen: 'πεδίο «Euribor»', value: eurField },
    ]);
  } else {
    table.push({ topic: T, what: 'Euribor τριμήνου', screen: 'πεδίο «Euribor»', view, value: eurField || '(κενό)' });
    ok(`${view}: ${T}: χωρίς φρέσκο Euribor το πεδίο ξεκινά κενό`, eurField === '', `πεδίο: ${eurField}`);
  }
  await p.close();
}

for (const v of VIEWS) {
  const ctx = await browser.newContext({ ...v.ctx, locale: 'el-GR', timezoneId: 'Europe/Athens' });
  // ΑΠΕΝΑΝΤΙ ΣΤΗΝ ΠΑΡΑΓΩΓΗ, ΜΟΝΟ ΑΝΑΓΝΩΣΗ. Η εβδομαδιαία σάρωση τρέχει αυτό το
  // σενάριο στο properwise.gr (το ίδιο νούμερο με τις τιμές της αγοράς που δεν
  // έχει το CI). Ο,τι δεν είναι GET/HEAD/OPTIONS κόβεται πριν φύγει, μαζί με τα
  // μετρητικά επισκεψιμότητας. Τοπικά δεν αλλάζει τίποτα.
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(B)) {
    await ctx.route('**/*', r => (!/^(GET|HEAD|OPTIONS)$/.test(r.request().method()) || /\/_vercel\/(insights|speed-insights)\//.test(r.request().url())) ? r.abort() : r.continue());
  }
  await ctx.addInitScript(SEED_CONSENT);
  console.log(`\n── ${v.name} ──`);
  await rent(ctx, v.name);
  await enfia(ctx, v.name);
  await mortgage(ctx, v.name);
  await ctx.close();
}
await browser.close();

// ── Ο ΠΙΝΑΚΑΣ: ΠΟΣΟ → ΟΘΟΝΗ → ΤΙΜΗ, ΣΕ 1280 ΚΑΙ 390 ─────────────────────────
const key = r => `${r.topic} | ${r.what} | ${r.screen}`;
const merged = new Map();
for (const r of table) {
  const m = merged.get(key(r)) ?? { topic: r.topic, what: r.what, screen: r.screen };
  m[r.view] = r.value; merged.set(key(r), m);
}
console.log('\nποσό | οθόνη | 1280 | 390');
let last = '';
for (const m of merged.values()) {
  const head = `${m.topic}: ${m.what}`;
  if (head !== last) { console.log(`\n${head}`); last = head; }
  console.log(`  ${m.screen} | ${m['1280'] ?? '-'} | ${m['390'] ?? '-'}`);
}

console.log(`\nΙΔΙΟ ΠΟΣΟ: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
