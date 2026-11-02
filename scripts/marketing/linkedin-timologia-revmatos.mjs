// ═══════════════════════════════════════════════════════════════════════════
// LINKEDIN · ΤΡΙΤΗ 03.11.2026 · «ΣΥΓΚΡΙΣΗ ΤΙΜΟΛΟΓΙΩΝ ΡΕΥΜΑΤΟΣ»
// ─────────────────────────────────────────────────────────────────────────
// Τέσσερις εικόνες 4:5 (1080×1350), οι ίδιες σε 9:16 για story (1080×1920),
// και ένα PDF των τεσσάρων για το «Add a document».
//
//   1. Η σύγκριση με το φθηνότερο οικιακό, για ένα παράδειγμα κατανάλωσης
//   2. Σταθερά, ειδικά, κυμαινόμενα: το φθηνότερο κάθε χρώματος
//   3. Τα επαγγελματικά, στην καρτέλα «Ρεύμα» της εφαρμογής
//   4. Ανεβάζεις τον λογαριασμό και διαβάζονται τα πεδία του
//
// Η ΟΘΟΝΗ ΕΙΝΑΙ Η ΠΡΑΓΜΑΤΙΚΗ. Τίποτα από ό,τι φαίνεται μέσα στο μόνιτορ δεν
// σχεδιάζεται εδώ: η δημόσια σελίδα φωτογραφίζεται από τοπικό `next start`,
// η καρτέλα «Ρεύμα» και η σάρωση από τον πάγκο του πίνακα ελέγχου
// (scripts/perf-bench/build-mobile.mjs), που αποδίδει τα ίδια components με
// δεδομένα επίδειξης. Η δημόσια σελίδα δείχνει μόνο οικιακά
// (lib/tools/revma.ts)· τα επαγγελματικά τα έχει η καρτέλα «Ρεύμα» με τον
// διακόπτη «Οικιακό / Επιχειρηματικό».
//
// ΚΑΝΕΝΑ ΝΟΥΜΕΡΟ ΜΕ ΤΟ ΧΕΙΡΟΓΡΑΦΟ. Τα ποσά των τίτλων βγαίνουν από την
// comparePower (ο ίδιος πυρήνας με τη σελίδα) και ελέγχονται απέναντι στο
// κείμενο της οθόνης που φωτογραφίστηκε· ο μήνας και η ημέρα ελέγχου από τον
// κατάλογο. Η κατανάλωση του παραδείγματος είναι η προεπιλογή της σελίδας
// (SPEC.kwh στο PowerCompare.tsx), διαβασμένη από το αρχείο.
//
// ΚΑΝΕΝΑ ΛΟΓΟΤΥΠΟ ΠΑΡΟΧΟΥ: τα ονόματα μόνο ως κείμενο, όπως τα γράφει η
// εφαρμογή. Ψηφία σε Inter με ισοπλατή ψηφία, ποτέ σε Mono.
//
// Τρέξε (με τον διακομιστή και τον πάγκο έτοιμους):
//   npx next build --webpack && npx next start -p 3100   (άλλη θύρα: LI_BASE=http://localhost:<θύρα>)
//   node scripts/perf-bench/build-mobile.mjs
//   npx tsx scripts/marketing/linkedin-timologia-revmatos.mjs [έξοδος]
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { join, resolve } from 'node:path';
import { chromePath } from '../lib/chrome.mjs';
import { SEED_CONSENT } from '../lib/consent.mjs';
import { comparePower, rankUntil } from '../../lib/tools/revma.ts';
import { TARIFFS_VERIFIED, CATALOGUE_MONTH_GEN, PROVIDERS } from '../../lib/energy/catalogue.ts';
import { fe, fn } from '../../lib/core/format.ts';
import { fdLong } from '../../components/tokens.ts';
import { asOfDate } from '../../lib/facts/prices.ts';

const ROOT = process.cwd();
const PUB = join(ROOT, 'public');
const BASE = process.env.LI_BASE || 'http://localhost:3100';
const BENCH = join(ROOT, '.perf-bench/mobile.html');
const OUT = resolve(process.argv[2] || join(ROOT, 'docs/marketing/profil/linkedin-timologia-revmatos'));
const CAP = join(ROOT, '.perf-bench/li-revma');
const NAME = 'properwise-timologia-revmatos';
if (!fs.existsSync(BENCH)) throw new Error('Λείπει ο πάγκος: node scripts/perf-bench/build-mobile.mjs');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(CAP, { recursive: true });

// ── Τα γεγονότα ──────────────────────────────────────────────────────────
// Η κατανάλωση του παραδείγματος: η προεπιλογή της ίδιας της σελίδας.
const SPEC_SRC = fs.readFileSync(join(ROOT, 'app/sygkrisi-timologion-revmatos/PowerCompare.tsx'), 'utf8');
const km = SPEC_SRC.match(/const SPEC = \{ kwh: '(\d+)'/);
if (!km) throw new Error('Η σελίδα δεν έχει πια προεπιλεγμένη κατανάλωση (SPEC.kwh)· το παράδειγμα θέλει νέα πηγή.');
const KWH = Number(km[1]);
const TODAY = new Date();
const run = colour => comparePower({ kwh: KWH, period: 'month', nightPct: 0, ebill: true, colour }, TODAY);
const ALL = run('ola');
if (!ALL.recommend || !ALL.cheapest) throw new Error('Ο κατάλογος δεν κατατάσσει σήμερα (παλαιότητα)· η ανάρτηση δεν μπορεί να δείξει φθηνότερο.');
const RANKED = ALL.rows.filter(r => r.rank !== null && r.monthly !== null);
const LOW = RANKED[0].monthly;
const HIGH = Math.max(...RANKED.map(r => r.monthly));
const COLOURS = [
  { key: 'mple', badge: 'ΜΠΛΕ', label: 'Σταθερό', what: 'σταθερή τιμή σε όλη τη σύμβαση', c: '#8ab4f8' },
  { key: 'prasino', badge: 'ΠΡΑΣΙΝΟ', label: 'Ειδικό', what: 'τιμή που ανακοινώνεται κάθε μήνα', c: '#5fd4a8' },
  { key: 'kitrino', badge: 'ΚΙΤΡΙΝΟ', label: 'Κυμαινόμενο', what: 'τιμή που αλλάζει μέσα στη σύμβαση', c: '#f0c97d' },
].map(x => ({ ...x, r: run(x.key) }));
for (const x of COLOURS) if (!x.r.cheapest) throw new Error(`Κανένα ${x.label.toLowerCase()} δεν μπαίνει σε σειρά σήμερα.`);
const MONTH = CATALOGUE_MONTH_GEN; // «Οκτωβρίου 2026»
const CHECKED = asOfDate(TARIFFS_VERIFIED);
const UNTIL = fdLong(rankUntil());

// ── Λήψη από την εφαρμογή ────────────────────────────────────────────────
// Οθόνη 1280×740 σε 3x: μαζί με τη γραμμή του περιηγητή κάνει 16:10.
const VW = 1280, VH = 740, DPR = 3;
const browser = await chromium.launch({ executablePath: chromePath() });
const shot = async (page, file, clip) => { await page.screenshot({ path: join(CAP, file), clip }); return join(CAP, file); };
const pub = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR, locale: 'el-GR' });
await pub.addInitScript(SEED_CONSENT);
const narrow = await browser.newContext({ viewport: { width: 700, height: 1400 }, deviceScaleFactor: DPR, locale: 'el-GR' });
await narrow.addInitScript(SEED_CONSENT);
const errs = [];
const open = async (ctx, url) => {
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(`${url}: ${e.message}`));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  return p;
};
const scrollTo = (p, sel, gap) => p.evaluate(([s, g]) => {
  const el = document.querySelector(s);
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - g);
}, [sel, gap]);
// Χωρίς τα μαλακά ενωτικά του συλλαβισμού, ώστε να συγκρίνεται κείμενο με κείμενο.
const plain = s => s.replace(/\u00ad/g, '');
const text = async (p, sel) => plain(await p.locator(sel).first().innerText());

const facts = { screen: {} };
// 1 · Όλα τα τιμολόγια: η κάρτα αποτελέσματος στην οθόνη και το κοντινό.
{
  const p = await open(pub, `${BASE}/sygkrisi-timologion-revmatos?kwh=${KWH}`);
  await scrollTo(p, '.po-tool-result', 62);
  await p.waitForTimeout(300);
  await shot(p, 's1.png');
  // Το κοντινό: από το «Φθηνότερο τον μήνα» ως το τέλος της πρώτης γραμμής.
  const n = await open(narrow, `${BASE}/sygkrisi-timologion-revmatos?kwh=${KWH}`);
  await scrollTo(n, '.po-tool-result', 20);
  const clip = await n.evaluate(() => {
    const res = document.querySelector('.po-tool-result');
    const r = res.getBoundingClientRect();
    const hero = [...res.querySelectorAll('*')].find(e => e.childElementCount === 0 && /^Φθηνότερο τον μήνα$/i.test(e.textContent.trim()));
    const li = res.querySelector('li.tariff-row').getBoundingClientRect();
    // Πάνω όριο: λίγο κάτω από την παράγραφο της ενημέρωσης, ώστε να μη μένει κομμένη γραμμή.
    const top = Math.max(res.querySelector('p').getBoundingClientRect().bottom + 4, hero.getBoundingClientRect().top - 18);
    return { x: r.left, y: top, width: r.width, height: li.bottom - top + 16 };
  });
  await shot(n, 'c1.png', clip);
  facts.screen.all = await text(n, '.po-tool-result');
}
// 2 · Ένα φίλτρο χρώματος στην οθόνη· τα φθηνότερα κάθε χρώματος από τη σελίδα.
{
  const p = await open(pub, `${BASE}/sygkrisi-timologion-revmatos?kwh=${KWH}&xroma=kitrino`);
  await p.evaluate(() => {
    const lab = [...document.querySelectorAll('label, span, div')].find(e => e.childElementCount === 0 && /^Είδος τιμολογίου$/i.test(e.textContent.trim()));
    window.scrollTo(0, lab.getBoundingClientRect().top + window.scrollY - 70);
  });
  await p.waitForTimeout(300);
  await shot(p, 's2.png');
  for (const x of COLOURS) {
    const n = await open(narrow, `${BASE}/sygkrisi-timologion-revmatos?kwh=${KWH}&xroma=${x.key}`);
    facts.screen[x.key] = await text(n, '.po-tool-result');
  }
}
// 3 · Η καρτέλα «Ρεύμα» του πίνακα ελέγχου, στα επαγγελματικά.
const bench = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR, locale: 'el-GR' });
const benchNarrow = await browser.newContext({ viewport: { width: 740, height: 1600 }, deviceScaleFactor: DPR, locale: 'el-GR' });
const BIZ_TARIFF = 'Ειδικό Γ21';
const business = async ctx => {
  const p = await open(ctx, `file://${BENCH}?c=bills&n=6`);
  await p.getByRole('button', { name: /^Ρεύμα/i }).first().click();
  await p.waitForTimeout(800);
  await p.getByRole('combobox', { name: 'Τιμολόγιο', exact: true }).first().click();
  await p.getByRole('option', { name: BIZ_TARIFF, exact: true }).first().click();
  await p.getByLabel('Μέση μηνιαία κατανάλωση').fill(String(KWH));
  await p.getByText('Επιχειρηματικό', { exact: true }).first().click();
  await p.waitForTimeout(600);
  return p;
};
{
  const p = await business(bench);
  await p.evaluate(() => {
    const h = [...document.querySelectorAll('*')].find(e => e.childElementCount === 0 && /^Κατάταξη Τιμολογίων$/i.test(e.textContent.trim()));
    const sc = document.querySelector('.app-content');
    sc.scrollTop += h.getBoundingClientRect().top - 108;
  });
  await p.waitForTimeout(300);
  await shot(p, 's3.png');
  const n = await business(benchNarrow);
  // Το κοντινό: ο διακόπτης, η εξοικονόμηση και οι δύο πρώτες γραμμές.
  const seg = n.getByText('Οικιακό', { exact: true }).first();
  await n.evaluate(() => {
    const t = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Οικιακό');
    document.querySelector('.app-content').scrollTop += t.getBoundingClientRect().top - 260;
  });
  await n.waitForTimeout(300);
  const sb = await seg.boundingBox();
  const clip = await n.evaluate(top => {
    const h = [...document.querySelectorAll('*')].find(e => e.childElementCount === 0 && /^Κατάταξη Τιμολογίων$/i.test(e.textContent.trim()));
    let card = h; while (card && !/radius/.test(card.getAttribute('style') || '')) card = card.parentElement;
    const r = card.getBoundingClientRect();
    const second = [...card.querySelectorAll('*')].filter(e => e.childElementCount === 0 && /λιγότερα τον μήνα/.test(e.textContent))[1];
    let row = second; while (row && row.parentElement && row.getBoundingClientRect().width < r.width * 0.85) row = row.parentElement;
    return { x: r.left + 1, y: top, width: r.width - 2, height: row.getBoundingClientRect().bottom - top + 12 };
  }, sb.y - 18);
  await shot(n, 'c3.png', clip);
  facts.screen.business = plain(await n.evaluate(() => {
    const h = [...document.querySelectorAll('*')].find(e => e.childElementCount === 0 && /^Κατάταξη Τιμολογίων$/i.test(e.textContent.trim()));
    let card = h; while (card && !/radius/.test(card.getAttribute('style') || '')) card = card.parentElement;
    return card.innerText;
  }));
}
// 4 · Η σάρωση ενός λογαριασμού επίδειξης: τα πεδία που διάβασε.
{
  const scan = async ctx => {
    const p = await open(ctx, `file://${BENCH}?c=scanReview&doc=bill&n=6`);
    await p.waitForTimeout(700);
    return p;
  };
  const p = await scan(bench);
  await p.evaluate(() => {
    const h = [...document.querySelectorAll('*')].find(e => e.childElementCount === 0 && /^Χρέωση$/i.test(e.textContent.trim()));
    let s = h.parentElement; while (s && !(s.scrollHeight > s.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(s).overflowY))) s = s.parentElement;
    s.scrollTop += h.getBoundingClientRect().top - s.getBoundingClientRect().top - 28;
  });
  await p.waitForTimeout(300);
  await shot(p, 's4.png');
  const am = await p.getByLabel('Ποσό', { exact: true }).boundingBox();
  const kw = await p.getByLabel('Κατανάλωση', { exact: true }).boundingBox();
  const clip = { x: am.x - 22, y: am.y - 38, width: kw.x + kw.width - am.x + 92, height: kw.y + kw.height - am.y + 60 };
  await shot(p, 'c4.png', clip);
  facts.screen.scan = plain(await p.evaluate(() => document.body.innerText));
  facts.scanKwh = await p.getByLabel('Κατανάλωση', { exact: true }).inputValue();
  facts.scanAmount = await p.getByLabel('Ποσό', { exact: true }).inputValue();
}
await browser.close();
// Η ασυμφωνία ενυδάτωσης (#418) διορθώνεται από τη React στον περιηγητή και η
// οθόνη ελέγχεται πιο κάτω κείμενο προς κείμενο· λέγεται, δεν σταματά τη λήψη.
const hydration = errs.filter(e => /error #418/.test(e));
if (hydration.length) console.warn('προσοχή, ασυμφωνία ενυδάτωσης:\n' + hydration.join('\n'));
const fatal = errs.filter(e => !/error #418/.test(e));
if (fatal.length) throw new Error('Σφάλματα σελίδας:\n' + fatal.join('\n'));

// Η οθόνη και η comparePower λένε το ίδιο, αλλιώς σταματάμε.
const must = (where, s) => { if (!facts.screen[where].includes(s)) throw new Error(`Η οθόνη «${where}» δεν γράφει «${s}».`); };
must('all', fe(LOW));
must('all', `${ALL.cheapest.t.providerLabel} ${ALL.cheapest.t.name}`);
must('all', MONTH);
for (const x of COLOURS) { must(x.key, fe(x.r.cheapest.monthly)); must(x.key, x.r.cheapest.t.name); }
must('business', 'Επιχειρηματικό');
must('scan', 'kWh');
const BIZ_PROVIDER = PROVIDERS.find(pr => pr.tariffs.some(t => t.name === BIZ_TARIFF && t.segment === 'business'));
if (!BIZ_PROVIDER) throw new Error(`Το «${BIZ_TARIFF}» δεν είναι πια επαγγελματικό τιμολόγιο του καταλόγου.`);
fs.writeFileSync(join(CAP, 'facts.json'), JSON.stringify(facts, null, 1));

// Ο πρώτος της επαγγελματικής κατάταξης, όπως τον γράφει η οθόνη.
const bizLines = facts.screen.business.split('\n').map(s => s.trim()).filter(Boolean);
const bizCount = (bizLines.find(l => /τιμολόγια για/.test(l)) || '').match(/^(\d+) τιμολόγια/);
if (!bizCount) throw new Error('Η κάρτα κατάταξης δεν γράφει πόσα τιμολόγια.');
const scanKwh = facts.scanKwh;
if (!/^\d+$/.test(scanKwh || '')) throw new Error('Η σάρωση δεν έδειξε κιλοβατώρες.');

// ── Η σκηνή ──────────────────────────────────────────────────────────────
const b64 = p => fs.readFileSync(p).toString('base64');
const png = p => `data:image/png;base64,${b64(p)}`;
const font = n => `data:font/woff2;base64,${b64(`${PUB}/fonts/${n}`)}`;
const LOGO = png(`${PUB}/brand/properwise-logotypo-lefko.png`);
const FAV = png(`${PUB}/brand/properwise-eikonidio-skouro-fonto.png`);
const IMG = Object.fromEntries(['s1', 's2', 's3', 's4', 'c1', 'c3', 'c4'].map(k => [k, png(join(CAP, `${k}.png`))]));
const N = 4;

const css = (W, H) => `
@font-face{font-family:Inter;font-weight:100 900;src:url(${font('inter-greek.woff2')})}
@font-face{font-family:Inter;font-weight:100 900;src:url(${font('inter-latin.woff2')})}
@font-face{font-family:Mono;font-weight:400 600;src:url(${font('robotomono-greek.woff2')})}
@font-face{font-family:Mono;font-weight:400 600;src:url(${font('robotomono-latin.woff2')})}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{font-family:Inter,sans-serif;font-variant-numeric:tabular-nums;font-feature-settings:"tnum";color:#f1f5fc;-webkit-font-smoothing:antialiased;position:relative;background:#060b14}
.abs{position:absolute}
.bg{position:absolute;inset:0;
 background:radial-gradient(900px 700px at 78% 30%, rgba(21,96,212,.30), transparent 62%),
  radial-gradient(700px 500px at 8% -6%, rgba(138,180,248,.16), transparent 66%),
  linear-gradient(176deg,#0d1a30 0%,#08101d 45%,#060b14 100%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:54px 54px;
 mask-image:radial-gradient(700px 420px at 50% 12%,#000 10%,transparent 76%)}
.edge{position:absolute;left:0;right:0;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(138,180,248,.6),transparent)}
.head{position:absolute;left:72px;right:72px;display:flex;justify-content:space-between;align-items:center}
.head img{height:30px;display:block}
.prog{display:flex;gap:8px}.prog b{width:34px;height:5px;border-radius:3px;background:rgba(255,255,255,.14)}.prog b.on{background:#8ab4f8;box-shadow:0 0 12px rgba(138,180,248,.7)}
.copy{position:absolute;left:72px;right:72px}
.eyebrow{font-family:Mono,monospace;font-size:19px;font-weight:500;letter-spacing:.22em;color:#8ab4f8;text-transform:uppercase;display:flex;align-items:center;gap:16px}
.eyebrow:before{content:'';width:34px;height:2px;background:#8ab4f8}
h1{margin-top:22px;font-weight:800;letter-spacing:-.04em;line-height:1.04;white-space:nowrap}
h1 .a{background:linear-gradient(95deg,#a9c8ff 0%,#5f9bff 60%,#3d7ef0 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{margin-top:20px;font-size:28px;line-height:1.3;color:#aebbd0;letter-spacing:-.01em;white-space:nowrap}
.sub b{color:#f1f5fc;font-weight:650}
/* Το γραφείο, με τη γλώσσα της κάμερας του reel */
.room{position:absolute;left:0;right:0;bottom:0;overflow:hidden}
.lampglow{left:-420px;width:1000px;height:1100px;background:radial-gradient(closest-side,rgba(255,196,128,.13),rgba(255,180,110,.04) 55%,transparent 75%)}
.desk{left:-200px;right:-200px;bottom:0;background:linear-gradient(180deg,#2a2622 0%,#1d1a17 7%,#151310 40%,#0c0b0a 100%)}
.deskgrain{left:-200px;right:-200px;bottom:0;opacity:.35;mix-blend-mode:overlay;background:repeating-linear-gradient(92deg,rgba(255,255,255,.05) 0 2px,transparent 2px 11px,rgba(0,0,0,.08) 11px 13px,transparent 13px 29px)}
.deskedge{left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,rgba(255,236,210,.22) 30%,rgba(210,225,255,.26) 60%,transparent)}
.spill{left:40px;right:40px;height:300px;background:radial-gradient(closest-side,rgba(138,180,248,.22),rgba(19,86,194,.08) 55%,transparent 80%)}
.shadow{height:50px;background:radial-gradient(closest-side,rgba(0,0,0,.85),transparent);filter:blur(4px)}
.mon{border-radius:22px;background:linear-gradient(180deg,#6f757e 0%,#4d535b 45%,#3a3f46 100%);
 box-shadow:0 34px 70px rgba(0,0,0,.6),0 4px 10px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.45),inset 0 -2px 4px rgba(0,0,0,.35)}
.bezel{border-radius:16px 16px 0 0;background:#050608}
.chin{border-radius:0 0 22px 22px;background:linear-gradient(180deg,#5b6169,#474c54 40%,#363a40);box-shadow:inset 0 1px 0 rgba(0,0,0,.5),inset 0 -1px 0 rgba(255,255,255,.12)}
.neck{background:linear-gradient(90deg,#2c3036,#5a6068 30%,#7b818a 50%,#555b63 72%,#2a2e33);clip-path:polygon(6% 0,94% 0,100% 100%,0 100%)}
.neckshade{background:linear-gradient(180deg,rgba(0,0,0,.5),transparent)}
.base{border-radius:5px 5px 9px 9px;background:linear-gradient(180deg,#848a93,#4f545b 60%,#33373c);box-shadow:0 6px 10px rgba(0,0,0,.6)}
.screen{overflow:hidden;background:#0b0f16;border-radius:3px}
.glass{pointer-events:none;background:linear-gradient(118deg,rgba(255,255,255,.09) 0%,rgba(255,255,255,.03) 26%,transparent 27%,transparent 62%,rgba(255,255,255,.02) 63%,transparent 80%)}
.chrome{position:absolute;left:0;right:0;top:0;background:#161b23;border-bottom:1px solid #2c3441;display:flex;align-items:center}
.dots{display:flex;gap:6px}.dots i{border-radius:50%;background:#3a414d;display:block}
.omni{flex:1;border-radius:99px;background:#0e1219;display:flex;align-items:center;color:#cfd6e1;font-weight:500;letter-spacing:.01em}
.omni img{border-radius:3px}
.lock{border:1.6px solid #8a94a3;border-radius:2px;position:relative}
.lock:before{content:'';position:absolute;left:50%;transform:translateX(-50%);border:1.6px solid #8a94a3;border-bottom:0;border-radius:4px 4px 0 0}
.page{position:absolute;left:0;right:0;bottom:0;background-size:100% 100%}
/* Το κοντινό: κομμάτι της ίδιας οθόνης, μεγεθυσμένο */
.zoom{position:absolute;border-radius:22px;overflow:hidden;background:#0b0f16;
 box-shadow:0 50px 100px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.16),0 0 0 7px rgba(10,16,28,.55),inset 0 1px 0 rgba(255,255,255,.12)}
.zoom img{display:block;width:100%}
.tag{display:inline-flex;align-items:center;gap:10px;font-size:20px;font-weight:650;padding:9px 18px;border-radius:99px;color:#f0c97d;background:rgba(14,20,32,.86);border:1px solid rgba(229,192,123,.35);white-space:nowrap;backdrop-filter:blur(6px)}
.tag:before{content:'';width:9px;height:9px;border-radius:50%;background:currentColor}
.card{position:absolute;border-radius:24px;background:linear-gradient(180deg,rgba(24,38,64,.97),rgba(12,20,36,.98));border:1px solid rgba(255,255,255,.14);
 box-shadow:0 50px 100px rgba(0,0,0,.7),0 0 0 7px rgba(10,16,28,.5),inset 0 1px 0 rgba(255,255,255,.12)}
.lbl{font-family:Mono,monospace;font-size:16px;letter-spacing:.16em;color:#7d8da6;text-transform:uppercase}
.crow{display:grid;grid-template-columns:1fr auto;align-items:center;gap:18px;padding:18px 0;border-top:1px solid rgba(255,255,255,.08)}
.crow:first-of-type{border-top:0}
.chip{display:inline-flex;align-items:center;gap:9px;font-size:16px;font-weight:750;letter-spacing:.08em}
.chip:before{content:'';width:12px;height:12px;border-radius:4px;background:currentColor}
.foot{position:absolute;left:72px;right:72px;display:flex;justify-content:space-between;align-items:center;gap:20px}
.url{font-size:22px;font-weight:650;letter-spacing:.01em;color:#cfe0ff}
.src{font-size:18px;color:#8d9bb2;text-align:right;line-height:1.35}
.cta{padding:16px 28px;border-radius:99px;background:linear-gradient(180deg,#3d7ef0,#1560d4);box-shadow:0 14px 34px rgba(21,96,212,.55),inset 0 1px 0 rgba(255,255,255,.3);font-size:23px;font-weight:700;white-space:nowrap}
`;

// Το μόνιτορ: θέση (x, y) και πλάτος οθόνης sw· όλα τα υπόλοιπα αναλογικά.
const CHROME_H = 60; // σε px της λήψης (1280)
function monitor(x, y, sw, img, url) {
  const k = sw / VW;
  const ch = Math.round(CHROME_H * k);
  const sh = Math.round((VH + CHROME_H) * k);
  const bz = Math.round(13 * k / 0.78), rim = 6;
  const monW = sw + 2 * (bz + rim), monH = sh + 2 * bz + rim + Math.round(48 * k / 0.78);
  const mx = x - bz - rim, my = y - bz - rim;
  const chinH = Math.round(48 * k / 0.78);
  const neckW = Math.round(sw * 0.19), neckH = Math.round(sw * 0.14);
  const cx = x + sw / 2;
  const baseY = my + monH + neckH - 4;
  return {
    bottom: baseY + 20, deskY: baseY + 18,
    html: `
  <div class="abs shadow" style="left:${cx - sw * 0.33}px;top:${baseY + 4}px;width:${sw * 0.66}px"></div>
  <div class="abs neck" style="left:${cx - neckW / 2}px;top:${my + monH - 10}px;width:${neckW}px;height:${neckH + 10}px"></div>
  <div class="abs neckshade" style="left:${cx - neckW / 2}px;top:${my + monH - 10}px;width:${neckW}px;height:${neckH * 0.3}px"></div>
  <div class="abs base" style="left:${cx - sw * 0.17}px;top:${baseY}px;width:${sw * 0.34}px;height:18px"></div>
  <div class="abs mon" style="left:${mx}px;top:${my}px;width:${monW}px;height:${monH}px"></div>
  <div class="abs bezel" style="left:${mx + rim}px;top:${my + rim}px;width:${monW - 2 * rim}px;height:${sh + 2 * bz}px"></div>
  <div class="abs chin" style="left:${mx}px;top:${my + rim + sh + 2 * bz}px;width:${monW}px;height:${chinH}px"></div>
  <div class="abs screen" style="left:${x}px;top:${y}px;width:${sw}px;height:${sh}px">
    <div class="chrome" style="height:${ch}px;padding:0 ${Math.round(16 * k)}px;gap:${Math.round(16 * k)}px">
      <div class="dots">${'<i></i>'.repeat(3).replace(/<i>/g, `<i style="width:${Math.round(12 * k)}px;height:${Math.round(12 * k)}px">`)}</div>
      <div class="omni" style="height:${Math.round(36 * k)}px;padding:0 ${Math.round(14 * k)}px;gap:${Math.round(9 * k)}px;font-size:${Math.round(15 * k)}px;max-width:${Math.round(640 * k)}px;margin:0 auto">
        <img src="${FAV}" style="width:${Math.round(15 * k)}px;height:${Math.round(15 * k)}px">${url}</div>
      <div style="width:${Math.round(52 * k)}px"></div>
    </div>
    <div class="page" style="top:${ch}px;background-image:url(${img})"></div>
  </div>
  <div class="abs glass" style="left:${x}px;top:${y}px;width:${sw}px;height:${sh}px"></div>`,
  };
}

function room(H, deskY, mon) {
  return `<div class="room" style="top:0;height:${H}px">
  <div class="abs lampglow" style="top:${deskY - 900}px"></div>
  <div class="abs spill" style="top:${deskY - 140}px"></div>
  <div class="abs desk" style="top:${deskY}px"></div><div class="abs deskgrain" style="top:${deskY}px"></div>
  <div class="abs deskedge" style="top:${deskY - 2}px"></div>
  ${mon}
  </div>`;
}

const prog = n => `<div class="prog">${Array.from({ length: N }, (_, i) => `<b class="${i + 1 === n ? 'on' : ''}"></b>`).join('')}</div>`;

// Οι τέσσερις εικόνες, ως περιεχόμενο· η διάταξη έρχεται από το σχήμα.
const S = [
  {
    eyebrow: 'Σύγκριση τιμολογίων ρεύματος',
    h1: 'Ίδιες κιλοβατώρες.<br><span class="a">Άλλος λογαριασμός.</span>',
    sub: `Για ${fn(KWH)} kWh τον μήνα: από <b>${fe(LOW)}</b> έως <b>${fe(HIGH)}</b>.`,
    img: IMG.s1, url: 'properwise.gr/sygkrisi-timologion-revmatos',
    tag: `Παράδειγμα · ${fn(KWH)} kWh τον μήνα`,
    zoom: { img: IMG.c1, ratio: 0 },
    src: `Τιμές ${MONTH} · ΡΑΑΕΥ, energycost.gr<br>Έλεγχος ${CHECKED} · σειρά έως ${UNTIL}`,
  },
  {
    eyebrow: 'Οικιακά τιμολόγια',
    h1: 'Σταθερό, ειδικό<br>ή <span class="a">κυμαινόμενο;</span>',
    sub: `Το φθηνότερο κάθε χρώματος, για τις ίδιες ${fn(KWH)} kWh.`,
    img: IMG.s2, url: 'properwise.gr/sygkrisi-timologion-revmatos',
    tag: `Παράδειγμα · ${fn(KWH)} kWh τον μήνα`,
    card: `<div class="row" style="display:flex;justify-content:space-between;align-items:center;padding-bottom:6px"><div class="lbl">Φθηνοτερο ανα χρωμα</div><div class="lbl" style="letter-spacing:.08em">τον μηνα</div></div>
      ${COLOURS.map(x => `<div class="crow"><div style="min-width:0">
        <div class="chip" style="color:${x.c}">${x.badge} <span style="color:#aebbd0;font-weight:500;letter-spacing:0;font-size:18px">· ${x.label}</span></div>
        <div style="margin-top:8px;font-size:23px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${x.r.cheapest.t.providerLabel} <span style="font-weight:400;color:#c3cede">${x.r.cheapest.t.name}</span></div>
        <div style="margin-top:4px;font-size:17px;color:#8d9bb2">${x.what}</div></div>
        <div style="font-size:38px;font-weight:800;letter-spacing:-.03em">${fe(x.r.cheapest.monthly)}</div></div>`).join('')}
      <div style="margin-top:4px;padding-top:14px;border-top:1px solid rgba(255,255,255,.08);font-size:17px;line-height:1.4;color:#8d9bb2">Τα δυναμικά, με ωριαία τιμή, δεν μπαίνουν στη σύγκριση.</div>`,
    src: `Τιμές ${MONTH} · ΡΑΑΕΥ, energycost.gr<br>Με ΕΤΜΕΑΡ και ΦΠΑ, χωρίς χρεώσεις δικτύου`,
  },
  {
    eyebrow: 'Επαγγελματικά τιμολόγια',
    h1: 'Και για το μαγαζί,<br><span class="a">το γραφείο, το ιατρείο.</span>',
    sub: `<b>Οικιακό ή Επιχειρηματικό:</b> ${bizCount[1]} επαγγελματικά τιμολόγια.`,
    img: IMG.s3, url: 'properwise.gr/dashboard',
    tag: `Παράδειγμα · ${fn(KWH)} kWh, τώρα σε ${BIZ_PROVIDER.label} ${BIZ_TARIFF}`,
    zoom: { img: IMG.c3 },
    src: `Τιμές ${MONTH} · ΡΑΑΕΥ, energycost.gr<br>Καρτέλα «Ρεύμα» του ακινήτου`,
  },
  {
    eyebrow: 'Με τον δικό σου λογαριασμό',
    h1: 'Ανεβάζεις τον λογαριασμό.<br><span class="a">Διαβάζονται τα πεδία.</span>',
    sub: 'Ποσό, περίοδος, κιλοβατώρες. <b>Εσύ επιβεβαιώνεις.</b>',
    img: IMG.s4, url: 'properwise.gr/dashboard',
    tag: `Παράδειγμα · λογαριασμός επίδειξης, ${scanKwh} kWh`,
    zoom: { img: IMG.c4, w: 0.84 },
    end: true,
  },
];

// ── Οι δύο διατάξεις ─────────────────────────────────────────────────────
// feed 1080×1350· story 1080×1920 με καθαρά τα πάνω 250 και τα κάτω 300.
const LAYOUT = {
  feed: { W: 1080, H: 1350, headY: 58, copyY: 126, h1: 66, mon: [110, 430, 860], focus: { right: 40, top: 790, w: 600 }, card: { top: 760, w: 640 }, footY: 1262, endY: 1238 },
  story: { W: 1080, H: 1920, headY: 262, copyY: 330, h1: 70, mon: [70, 650, 940], focus: { right: 30, top: 1050, w: 740 }, card: { top: 1020, w: 720 }, footY: 1548, endY: 1546 },
};

function page(i, kind) {
  const s = S[i], L = LAYOUT[kind];
  const [mx, my, mw] = L.mon;
  const m = monitor(mx, my, mw, s.img, s.url);
  const top = s.card ? L.card.top : L.focus.top;
  const w = s.card ? L.card.w : Math.round(L.focus.w * (s.zoom.w || 1));
  const focus = s.card
    ? `<div class="card" id="focus" style="right:${L.focus.right}px;top:${top}px;width:${w}px;padding:24px 32px 22px">${s.card}</div>`
    : `<div class="zoom" id="focus" style="right:${L.focus.right}px;top:${top}px;width:${w}px"><img src="${s.zoom.img}"></div>`;
  // Η ετικέτα του παραδείγματος κάθεται πάνω από το κοντινό, στη δεξιά του άκρη.
  const tag = `<div class="tag" id="tag" style="position:absolute;right:${L.focus.right}px;top:${top - 58}px">${s.tag}</div>`;
  const foot = s.end
    ? `<div class="foot" id="foot" style="top:${L.endY}px"><div><div style="font-size:30px;font-weight:800;letter-spacing:-.02em">Σύγκρινε το δικό σου ρεύμα.</div><div style="margin-top:8px;font-size:21px;color:#aebbd0">Ο σύνδεσμος είναι στο πρώτο σχόλιο.</div></div><div class="cta">properwise.gr</div></div>`
    : `<div class="foot" id="foot" style="top:${L.footY}px"><div class="url">properwise.gr</div><div class="src">${s.src}</div></div>`;
  return `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${css(L.W, L.H)}</style></head><body>
<div class="bg"></div><div class="grid"></div><div class="edge"></div>
${room(L.H, m.deskY, m.html)}
<div class="head" style="top:${L.headY}px"><img src="${LOGO}" alt="PROPERWISE">${prog(i + 1)}</div>
<div class="copy" id="copy" style="top:${L.copyY}px"><div class="eyebrow">${s.eyebrow}</div><h1 style="font-size:${L.h1}px">${s.h1}</h1><div class="sub">${s.sub}</div></div>
${focus}${tag}${foot}
</body></html>`;
}

// ── Απόδοση, με έλεγχο ───────────────────────────────────────────────────
const b2 = await chromium.launch({ executablePath: chromePath() });
const problems = [];
const files = { feed: [], story: [] };
for (const kind of ['feed', 'story']) {
  const L = LAYOUT[kind];
  const p = await b2.newPage({ viewport: { width: L.W, height: L.H }, deviceScaleFactor: 1 });
  for (let i = 0; i < S.length; i++) {
    await p.setContent(page(i, kind), { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    const bad = await p.evaluate(([W, H, story]) => {
      const out = [];
      for (const el of document.querySelectorAll('#copy *, #focus *, #foot *, #tag')) {
        const cs = getComputedStyle(el);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
        if (/Mono/.test(cs.fontFamily) && /\d/.test(own)) out.push(`ψηφίο σε Mono: «${own.trim()}»`);
        const r = el.getBoundingClientRect();
        if (r.width && (r.left < 24 || r.right > W - 24)) out.push(`βγαίνει πλάγια: «${el.textContent.trim().slice(0, 40)}»`);
        if (story && r.height && /^(H1|DIV)$/.test(el.tagName) && el.closest('#copy, #foot, #focus') && (r.top < 250 || r.bottom > H - 300)) out.push(`έξω από τη ζώνη ασφαλείας: «${el.textContent.trim().slice(0, 40)}»`);
        if (el.scrollWidth > el.clientWidth + 1 && cs.overflow === 'hidden' && cs.textOverflow !== 'ellipsis') out.push(`κόβεται: «${el.textContent.trim().slice(0, 40)}»`);
        if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) out.push(`κόβεται με αποσιωπητικά: «${el.textContent.trim().slice(0, 40)}»`);
      }
      const h1 = document.querySelector('h1');
      const lines = Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight));
      if (lines > 2) out.push(`τίτλος σε ${lines} γραμμές`);
      if (document.querySelector('h1').scrollWidth > document.querySelector('#copy').clientWidth + 1) out.push('ο τίτλος ξεπερνά το πλάτος');
      if (document.querySelector('.sub').scrollWidth > document.querySelector('#copy').clientWidth + 1) out.push('ο υπότιτλος ξεπερνά το πλάτος');
      const box = s => document.querySelector(s)?.getBoundingClientRect();
      const ov = (a, b) => a && b && Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
      if (ov(box('#copy'), box('.screen'))) out.push('ο τίτλος πέφτει πάνω στην οθόνη');
      if (ov(box('#focus'), box('#foot'))) out.push('το κοντινό πέφτει πάνω στο υποσέλιδο');
      if (ov(box('#tag'), box('#focus'))) out.push('η ετικέτα πέφτει πάνω στο κοντινό');
      if (box('#focus').bottom > H - (story ? 300 : 24)) out.push('το κοντινό βγαίνει κάτω');
      if (ov(box('#tag'), box('#copy'))) out.push('η ετικέτα πέφτει πάνω στον τίτλο');
      return out;
    }, [L.W, L.H, kind === 'story']);
    bad.forEach(x => problems.push(`${kind} ${i + 1}: ${x}`));
    const file = join(OUT, `${NAME}-${kind === 'feed' ? '' : 'story-'}${i + 1}.png`);
    await p.screenshot({ path: file });
    files[kind].push(file);
  }
}
const pdf = await b2.newPage();
await pdf.setContent(`<!doctype html><html><head><style>@page{size:1080px 1350px;margin:0}body{margin:0}img{display:block;width:1080px;height:1350px;page-break-after:always}</style></head><body>${
  files.feed.map(x => `<img src="data:image/png;base64,${b64(x)}">`).join('')}</body></html>`, { waitUntil: 'load' });
await pdf.pdf({ path: join(OUT, `${NAME}.pdf`), width: '1080px', height: '1350px', printBackground: true });
await b2.close();
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`✓ ${files.feed.length} εικόνες, ${files.story.length} story και PDF στο ${OUT}`);
console.log(`  τιμές ${MONTH}, έλεγχος ${CHECKED}· παράδειγμα ${fn(KWH)} kWh· φθηνότερο ${fe(LOW)} (${ALL.cheapest.t.providerLabel} ${ALL.cheapest.t.name})`);
