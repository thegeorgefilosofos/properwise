#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΙΔΙΟ ΜΕΓΕΘΟΣ, ΙΔΙΟ ΣΕ ΚΑΘΕ ΟΘΟΝΗ ΤΟΥ ΠΙΝΑΚΑ ΕΛΕΓΧΟΥ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΒΡΕΘΗΚΕ (02.11.2026). Στον πάγκο, για το ίδιο ακίνητο και το ίδιο έτος:
// φόρος 2026 1.012,11€ στην Επισκόπηση, 1.588,44€ στη Βραχυχρόνια, 1.758,04€
// στις Αποδόσεις· ακαθάριστα 7.102,54€ και 6.480,00€· «Απόδοση επί αξίας
// 5,56%» στον Προϋπολογισμό δίπλα σε καθαρή 2,82%. Ο αδελφός έλεγχος
// (e2e-same-number.mjs) κοιτά μόνο τις δημόσιες σελίδες χωρίς σύνδεση και δεν
// έφτανε ποτέ εδώ.
//
// ΠΩΣ. Οι οθόνες σημαδεύουν τα μεγέθη με `data-fact` και γράφουν την τιμή που
// δείχνουν στο `data-fact-value` (components/Theme.tsx: `Tile`, `fact`/`facts`).
// Το σενάριο ανοίγει τις σκηνές του πάγκου, μαζεύει τα σημάδια και ζητά κάθε
// μέγεθος ίσο σε λεπτά (ή εκατοστά της μονάδας) σε όλες τις οθόνες που το
// δείχνουν. ΚΑΝΕΝΑ ΑΝΑΜΕΝΟΜΕΝΟ ΠΟΣΟ ΓΡΑΜΜΕΝΟ ΕΔΩ: η πρώτη οθόνη είναι το μέτρο.
//
// ΚΑΙ Η ΔΙΑΦΟΡΑ ΘΕΛΕΙ ΟΝΟΜΑ. Η καθαρή των Αποδόσεων μπορεί να είναι
// μικρότερη, γιατί αφαιρεί εκτιμήσεις· τότε η ετικέτα της πρέπει να λέει
// «Εκτιμώμενη». Διαφορετικός αριθμός με ίδια ετικέτα είναι αποτυχία.
//
// ΤΡΕΞΕ: npm run e2e:samenum:dash   (χτίζει τον πάγκο και τρέχει)
// ═══════════════════════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import { chromePath } from './lib/chrome.mjs';
import { benchUrl } from './lib/paths.mjs';
import { applyMode } from './lib/bench-mode.mjs';
import { SEED_CONSENT } from './lib/consent.mjs';

const require = createRequire(import.meta.url);
let pkg;
try { pkg = require('playwright-core'); }
catch { console.error('Λείπει το playwright-core. Τρέξε: npm i -D playwright-core'); process.exit(2); }
const { chromium } = pkg;

const VIEWS = [
  { name: '1280', ctx: { viewport: { width: 1280, height: 900 } } },
  { name: '390', ctx: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
];
// Οι οθόνες και το ακίνητο: όλες δείχνουν το p0 του πάγκου.
const SCREENS = { overview: 'Επισκόπηση', roi: 'Αποδόσεις', pricing: 'Βραχυχρόνια', portfolio: 'Χαρτοφυλάκιο', budgetPro: 'Προϋπολογισμός' };
const PROPERTY = 'p0';
// Τα ζεύγη που ΠΡΕΠΕΙ να είναι ίσα, με τις οθόνες που τα δείχνουν.
const PAIRS = [
  { fact: 'tax-year', what: 'φόρος ενοικίων του έτους', screens: ['overview', 'roi', 'pricing'] },
  { fact: 'income-year', what: 'έσοδα του έτους (εισπραγμένα + κλεισμένα έως 31/12)', screens: ['overview', 'roi', 'pricing'] },
  { fact: 'yield-gross', what: 'μεικτή απόδοση', screens: ['overview', 'roi'] },
  { fact: 'yield-net-recorded', what: 'καθαρή απόδοση προ φόρου, μόνο με καταγραφές', screens: ['overview', 'roi', 'budgetPro'] },
  { fact: 'occ-year', what: 'πληρότητα του έτους', screens: ['overview', 'portfolio'] },
];

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; return; }
  fail++;
  console.log('  ✗ ' + name + (extra ? `\n      ${extra}` : ''));
};
// «1.758,04€», «2,82%», «+2,82%»: σε εκατοστά, χωρίς πρόσημο και μονάδα.
const hund = t => {
  const s = String(t ?? '').replace(/[  ]/g, '').replace(/−/g, '-').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return s && s !== '-' ? Math.round(Math.abs(Number(s)) * 100) : NaN;
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromePath(), args: ['--no-sandbox'] });
const table = [];

async function factsOf(ctx, scene) {
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  await p.goto(benchUrl(scene, 6), { waitUntil: 'networkidle' });
  await p.waitForFunction(() => (document.querySelector('.app-content')?.innerText || '').trim().length > 120, { timeout: 8000 }).catch(() => {});
  // Τα μεγέθη που φορτώνουν δεύτερα (ο φόρος με τα άλλα ακίνητα) θέλουν μια ανάσα.
  await p.waitForTimeout(1200);
  const facts = await p.evaluate(() => [...document.querySelectorAll('[data-fact]')].map(el => ({
    name: el.getAttribute('data-fact'), property: el.getAttribute('data-fact-property'),
    value: el.getAttribute('data-fact-value'),
  })));
  ok(`${scene}: χωρίς σφάλμα σελίδας`, errors.length === 0, errors.join(' | '));
  await p.close();
  return facts.filter(f => !f.property || f.property === PROPERTY);
}

for (const v of VIEWS) {
  const ctx = await browser.newContext({ ...v.ctx, locale: 'el-GR' });
  await ctx.addInitScript(SEED_CONSENT);
  await applyMode(ctx);
  const by = {};
  for (const s of Object.keys(SCREENS)) by[s] = await factsOf(ctx, s);
  for (const pair of PAIRS) {
    const places = pair.screens.map(s => ({ screen: SCREENS[s], value: by[s].find(f => f.name === pair.fact)?.value ?? null }));
    for (const p of places) table.push({ view: v.name, what: pair.what, screen: p.screen, value: p.value ?? '(δεν εμφανίζεται)' });
    const want = hund(places[0].value);
    ok(`${v.name}: «${pair.what}» ίδιο σε ${places.length} οθόνες`,
      places.every(p => p.value != null && hund(p.value) === want && Number.isFinite(want)),
      places.map(p => `${p.screen}: ${p.value ?? '(κενό)'}`).join(' · '));
  }
  // ── Η ΔΙΑΦΟΡΑ ΘΕΛΕΙ ΟΝΟΜΑ ──────────────────────────────────────────────
  // Η καθαρή που δείχνουν οι Αποδόσεις (με εκτιμήσεις) απέναντι στην καθαρή της Επισκόπησης.
  const roiNet = await (async () => {
    const p = await ctx.newPage();
    await p.goto(benchUrl('roi', 6), { waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => {
      const card = document.querySelector('[data-fact="yield-net-recorded"]')?.closest('.kpi-card');
      // Η ετικέτα χωρίς το ⓘ και το κείμενο της εξήγησής του.
      // Το `Tile` γράφει την ετικέτα ως κείμενο και την τελευταία λέξη μέσα σε
      // span μαζί με το ⓘ: κρατάμε μόνο τους κόμβους κειμένου ως εκείνη τη λέξη.
      const el = card?.querySelector('.kpi-label');
      const words = [...(el?.childNodes || [])].map(n => n.nodeType === 3 ? n.textContent : (n.firstChild?.nodeType === 3 ? n.firstChild.textContent : '')).join('');
      return card ? { label: words.replace(/\s+/g, ' ').trim(), value: (card.querySelector('.kpi-value')?.textContent || '').trim() } : null;
    });
    await p.close();
    return r;
  })();
  const ovNet = by.overview.find(f => f.name === 'yield-net-recorded')?.value;
  if (roiNet && ovNet) {
    const differs = hund(roiNet.value) !== hund(ovNet);
    table.push({ view: v.name, what: 'καθαρή απόδοση όπως γράφεται', screen: `Αποδόσεις «${roiNet.label}»`, value: roiNet.value });
    ok(`${v.name}: η καθαρή των Αποδόσεων που διαφέρει από της Επισκόπησης λέγεται «Εκτιμώμενη»`,
      !differs || /^Εκτιμώμενη/.test(roiNet.label), `Αποδόσεις «${roiNet.label}» ${roiNet.value} · Επισκόπηση ${ovNet}`);
  } else ok(`${v.name}: η καθαρή εμφανίζεται στις Αποδόσεις και στην Επισκόπηση`, false, JSON.stringify({ roiNet, ovNet }));
  await ctx.close();
}
await browser.close();

console.log('\nΠΙΝΑΚΑΣ ΣΥΝΕΠΕΙΑΣ (πίνακας ελέγχου, p0 του πάγκου)');
for (const r of table) console.log(`  ${r.view.padEnd(5)} ${r.what.padEnd(52)} ${r.screen.padEnd(40)} ${r.value}`);
console.log(`\nΊδιος αριθμός, πίνακας ελέγχου: ${pass} πέρασαν, ${fail} απέτυχαν`);
process.exit(fail ? 1 : 0);
