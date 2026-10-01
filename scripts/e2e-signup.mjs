#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΓΓΡΑΦΗ, ΣΕ ΠΡΑΓΜΑΤΙΚΟ ΠΕΡΙΗΓΗΤΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΓΕΝΝΗΣΕ ΤΟΝ ΠΑΓΚΟ (24/08/2026, από πραγματική εγγραφή). Το
// `loading` γινόταν ψευδές ΜΟΝΟ στο σφάλμα. Στην επιτυχία έμενε αναμμένο και
// η οθόνη «Ανοιξε το email σου» το κουβαλούσε από κάτω της. Οποιος πατούσε
// «Γράψε άλλη» γύριζε στη φόρμα και έβρισκε το κουμπί κλειδωμένο στο
// «Δημιουργία…», για πάντα. Καμία διέξοδος εκτός από ανανέωση της σελίδας.
//
// ΓΙΑΤΙ ΔΕΝ ΤΟ ΕΠΙΑΝΕ ΤΙΠΟΤΑ. Καμία δοκιμή μονάδας δεν πατά κουμπιά και η
// κατάσταση είναι σωστή σε κάθε ΜΕΜΟΝΩΜΕΝΟ βήμα: το λάθος υπάρχει μόνο στη
// ΣΕΙΡΑ «υποβολή, πίσω, ξανά». Αυτό φαίνεται μόνο πατώντας.
// ═══════════════════════════════════════════════════════════════════════════
import { chromePath } from './lib/chrome.mjs';
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const CHROME = chromePath();
const PAGE = resolve('.e2e-signup/index.html');
if (!existsSync(PAGE)) {
  console.error('✗ Λείπει ο πάγκος. Τρέξε πρώτα: node scripts/e2e-signup/build.mjs');
  process.exit(1);
}

let pass = 0;
const fails = [];
const check = (name, ok, detail = '') => {
  if (ok) { pass++; return; }
  fails.push(`${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(pathToFileURL(PAGE).href);
await page.waitForSelector('#su-consent');

// ΤΟ ΚΟΥΜΠΙ ΔΕΝ ΕΙΝΑΙ ΠΟΤΕ `disabled` ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΣΚΟΠΙΜΟ: μένει
// πατήσιμο ώστε ο handler να πει τον λόγο αντί να σωπάσει. Αρα το σφάλμα
// φαίνεται στο ΛΕΚΤΙΚΟ και στη ΣΥΜΠΕΡΙΦΟΡΑ, όχι σε μια ιδιότητα.
const submit = () => page.locator('form button[type="submit"]');

// ── Η ΦΟΡΜΑ ΣΥΜΠΛΗΡΩΝΕΤΑΙ ─────────────────────────────────────────────────
await page.locator('#su-email').fill('dokimastis@properwise.gr');
await page.locator('input[type="password"]').first().fill('Dokimastis2026!');
await page.locator('#su-consent').check();

check('το κουμπί καλεί σε ενέργεια πριν την υποβολή',
  (await submit().textContent())?.includes('Ξεκίνα') === true);

// ── ΥΠΟΒΟΛΗ ───────────────────────────────────────────────────────────────
await submit().click();
await page.waitForSelector('text=Άνοιξε το email σου');
check('μετά την υποβολή εμφανίζεται η οθόνη επιβεβαίωσης', true);

// ── ΚΑΙ ΠΙΣΩ, ΜΕ ΤΟ «ΓΡΑΨΕ ΑΛΛΗ» ──────────────────────────────────────────
await page.getByRole('button', { name: 'Γράψε άλλη' }).click();
await page.waitForSelector('#su-consent');

// ΕΔΩ ΕΙΝΑΙ ΟΛΟ ΤΟ ΝΟΗΜΑ ΤΟΥ ΑΡΧΕΙΟΥ.
const label = (await submit().textContent())?.trim() ?? '';
const dimmed = await submit().evaluate(el => getComputedStyle(el).opacity);
check('το κουμπί δεν μένει στο «Δημιουργία…» μετά το «Γράψε άλλη»',
  !label.includes('…'), `γράφει «${label}»`);
check('και δεν μένει σβησμένο', Number(dimmed) > 0.9, `opacity=${dimmed}`);

// Και είναι πράγματι ξαναχρησιμοποιήσιμο: δεύτερη υποβολή περνά.
await page.locator('#su-email').fill('allos@properwise.gr');
await submit().click();
const back = await page.waitForSelector('text=Άνοιξε το email σου', { timeout: 4000 }).then(() => true).catch(() => false);
check('η δεύτερη υποβολή προχωρά κανονικά', back);

// ── ΤΟ ΧΩΝΙ ΜΕΤΡΙΕΤΑΙ ─────────────────────────────────────────────────────
// Η μέτρηση είναι ανώνυμη και σιωπηλή: αν σπάσει, κανείς δεν το βλέπει στην
// οθόνη. Γι' αυτό ο πάγκος διαβάζει τι στάλθηκε.
const funnel = async (p) => p.evaluate(() => window.__funnel ?? []);
const steps = (await funnel(page)).map(c => c.p_step);
check('χωνί: μετρήθηκε η προβολή', steps.includes('view'), steps.join(','));
check('χωνί: μετρήθηκαν υποβολή και αποστολή', steps.includes('submit') && steps.includes('sent'), steps.join(','));
check('χωνί: κάθε βήμα μία φορά ανά φόρτωση ακόμη και με δύο υποβολές',
  ['view', 'submit', 'sent'].every(s => steps.filter(x => x === s).length === 1), steps.join(','));
check('χωνί: μόνο η συνάρτηση του χωνιού και μόνο τα τέσσερα πεδία',
  (await funnel(page)).every(c => c.fn === 'count_signup_step'
    && Object.keys(c).sort().join() === 'fn,p_in_app,p_mobile,p_source,p_step'));
check('χωνί: σε κανονικό περιηγητή δεν μετρά οδηγία εφαρμογής', !steps.includes('app_note'));

// Υποβολή χωρίς αποδοχή των Όρων: μετριέται κάθε φορά, γιατί εκεί κολλάει ο κόσμος.
await page.getByRole('button', { name: 'Γράψε άλλη' }).click();
await page.waitForSelector('#su-consent');
await page.locator('#su-consent').uncheck();
await submit().click();
await submit().click();
await page.waitForTimeout(200);
const invalid = (await funnel(page)).filter(c => c.p_step === 'invalid').length;
check('χωνί: κάθε απορριφθείσα υποβολή μετριέται', invalid === 2, `invalid=${invalid}`);

// ── ΜΕΣΑ ΣΤΟ INSTAGRAM ────────────────────────────────────────────────────
// Εκεί η Google απαντά «403: disallowed_useragent». Το κουμπί της δεν πρέπει
// να φαίνεται· στη θέση του οδηγία και η φόρμα email ανέπαφη από κάτω.
const IG = 'Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 Instagram 350.0.0.43.109 Android';
for (const [name, ua, android] of [['Android', IG, true], ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.30.94', false]]) {
  const ctx = await browser.newContext({ userAgent: ua, viewport: { width: 390, height: 844 } });
  const ig = await ctx.newPage();
  await ig.goto(pathToFileURL(PAGE).href);
  await ig.waitForSelector('#su-consent');
  await ig.waitForSelector('[role="note"]', { timeout: 4000 }).catch(() => null);
  check(`Instagram (${name}): χωρίς «Συνέχισε με Google»`, await ig.getByText('Συνέχισε με Google').count() === 0);
  check(`Instagram (${name}): η οδηγία ονομάζει την εφαρμογή`, await ig.getByText('μέσα από το Instagram').count() === 1);
  const chrome = await ig.locator('a[href^="intent://"]').count();
  check(`Instagram (${name}): σύνδεσμος για Chrome ${android ? 'υπάρχει' : 'δεν υπάρχει'}`, android ? chrome === 1 : chrome === 0);
  check(`Instagram (${name}): η φόρμα email μένει`, await ig.locator('#su-email').isVisible());
  const notes = (await ig.evaluate(() => window.__funnel ?? [])).filter(c => c.p_step === 'app_note');
  check(`Instagram (${name}): το χωνί μετρά την οδηγία μία φορά, ως Instagram μέσα σε εφαρμογή από κινητό`,
    notes.length === 1 && notes[0].p_source === 'instagram' && notes[0].p_in_app === true && notes[0].p_mobile === true,
    JSON.stringify(notes));
  await ctx.close();
}

await browser.close();

if (fails.length) {
  console.error(`✗ ${fails.length} από ${pass + fails.length} έλεγχοι εγγραφής απέτυχαν:\n`);
  for (const f of fails) console.error('  ' + f);
  process.exit(1);
}
console.log(`✅ ${pass} έλεγχοι εγγραφής σε πραγματικό Chromium`);
