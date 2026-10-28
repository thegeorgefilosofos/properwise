// npx tsx app/pageUpdated.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Η ΟΡΑΤΗ ΗΜΕΡΟΜΗΝΙΑ ΚΑΙ ΤΟ lastModified ΤΟΥ ΧΑΡΤΗ ΕΙΝΑΙ ΜΙΑ ΗΜΕΡΟΜΗΝΙΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (13.10.2026). Οι τέσσερις φορολογικοί υπολογιστές έγραφαν
// «Τελευταία ενημέρωση 26/08/2026» και ο χάρτης έδινε για τους ίδιους
// 2026-09-25· το «Ποιοι είμαστε» έγραφε «Έκδοση 04/10/2026» και ο χάρτης
// 2026-10-03. Το app/publicMetadata.test.ts έλεγχε ότι κάθε γραμμή του χάρτη
// έχει ημερομηνία ISO που δεν είναι μελλοντική· καμία δοκιμή δεν τη σύγκρινε
// με αυτό που διαβάζει ο άνθρωπος στη σελίδα.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ.
//   1. Κάθε γραμμή του χάρτη παίρνει την ημερομηνία της από ΜΙΑ πηγή: το
//      app/pageUpdated.ts ή, για τους οδηγούς, το app/odigos/guides.ts.
//   2. Καμία δεν είναι μελλοντική (ώρα Ελλάδας).
//   3. Κάθε σελίδα του χάρτη αποδίδεται και ΚΑΘΕ ημερομηνία που γράφει δίπλα
//      σε «Τελευταία ενημέρωση» ή «Έκδοση» είναι η ημερομηνία του χάρτη, σε
//      όποια από τις τρεις μορφές του ιστότοπου (05/10/2026 · 5 Οκτωβρίου 2026 ·
//      Οκτώβριος 2026).
//   4. Κάθε γραμμή του app/pageUpdated.ts που έχει πηγή ΕΙΝΑΙ η πηγή της. Ο
//      έλεγχος (3) δεν το πιάνει μόνος του: οι υπολογιστές διαβάζουν την
//      ημερομηνία τους από το ίδιο PAGE_UPDATED με τον χάρτη, οπότε μια
//      ημερομηνία γραμμένη εκεί με το χέρι θα έβγαινε ίδια και στις δύο θέσεις
//      και θα περνούσε. Όσες γραμμές μένουν με το χέρι δεν τυπώνουν ημερομηνία.
// ═══════════════════════════════════════════════════════════════════════════
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, existsSync } from 'node:fs';
import sitemap from './sitemap';
import { PAGE_UPDATED, type DatedPage } from './pageUpdated';
import { GUIDES, LISTED_GUIDES, GUIDES_UPDATED } from './odigos/guides';
import { TOOLS_UPDATED } from './pageUpdated';
import { SITE } from '@/lib/core/site';
import { athensToday } from '@/lib/core/time';
import { monthGen, monthYearLabel } from '@/lib/core/months';
import { taxLimitAsOf } from '@/lib/facts/taxLimits';
import { PRICE_FACTS } from '@/lib/facts/prices';
import { POLICY_VERSION } from '@/lib/legal/identity';
import { CPI_CONFIRMED_AT } from '@/lib/market/cpi';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { ToolSources } from './PublicChrome';

// ── ΟΙ ΥΠΟΛΟΓΙΣΤΕΣ: Η ΝΕΟΤΕΡΗ ΑΠΟ ΕΛΕΓΧΟ ΟΡΙΩΝ ΚΑΙ ΑΛΛΑΓΗ ΠΕΡΙΕΧΟΜΕΝΟΥ ──────
// Το #401 (18/10/2026) άλλαξε H1, παραδείγματα και FAQ στις σελίδες ΕΝΦΙΑ και
// φόρου ενοικίων· ο χάρτης έγραφε 2026-08-26, τον έλεγχο των ορίων. Η σφραγίδα
// διαβάζεται εδώ ξανά από το JSON, ανεξάρτητα από το pageUpdated.ts.
const STAMPS = (JSON.parse(readFileSync('app/toolStamps.json', 'utf8')) as { tools: Record<string, { updated: string | null }> }).tools;
const newest = (path: string, limit: string | null) => {
  const c = STAMPS[path]?.updated ?? null;
  return limit && c ? (c > limit ? c : limit) : (c ?? limit);
};

/**
 * Οι γραμμές του app/pageUpdated.ts που διαβάζουν μητρώο, με την πηγή τους
 * διαβασμένη εδώ ξανά, ανεξάρτητα από το pageUpdated.ts.
 */
const SOURCED: Partial<Record<DatedPage, { from: string; iso: string | null }>> = {
  '/ypologismos-forou-enoikion': { from: "toolDate('/ypologismos-forou-enoikion')", iso: newest('/ypologismos-forou-enoikion', taxLimitAsOf('rent').checkedAt) },
  '/ypologismos-enfia': { from: "toolDate('/ypologismos-enfia')", iso: newest('/ypologismos-enfia', taxLimitAsOf('enfia').checkedAt) },
  '/vraxyxronia-i-makroxronia': { from: "toolDate('/vraxyxronia-i-makroxronia')", iso: newest('/vraxyxronia-i-makroxronia', taxLimitAsOf('short').checkedAt) },
  '/kathari-apodosi': { from: "toolDate('/kathari-apodosi')", iso: newest('/kathari-apodosi', taxLimitAsOf('yield').checkedAt) },
  '/sygkrisi-timologion-revmatos': { from: 'PRICE_FACTS.electricity.checkedAt', iso: PRICE_FACTS.electricity.checkedAt },
  '/anaprosarmogi-enoikiou': { from: 'CPI_CONFIRMED_AT', iso: CPI_CONFIRMED_AT },
  '/trust': { from: 'POLICY_VERSION', iso: POLICY_VERSION },
  '/privacy': { from: 'POLICY_VERSION', iso: POLICY_VERSION },
  '/terms': { from: 'POLICY_VERSION', iso: POLICY_VERSION },
};
/** Οι γραμμές με το χέρι: μόνο σελίδες που δεν τυπώνουν ημερομηνία ενημέρωσης. */
const MANUAL: readonly DatedPage[] = ['/', '/paketa', '/signup', '/logistes', '/ypologismos-stegastikou-daneiou'];

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TODAY = athensToday();

/** Οι τρεις μορφές με τις οποίες ο ιστότοπος γράφει μια ημερομηνία στον αναγνώστη. */
function shown(iso: string): string[] {
  const [y, m, d] = iso.split('-');
  return [`${d}/${m}/${y}`, `${Number(d)} ${monthGen(Number(m) - 1)} ${y}`, monthYearLabel(`${y}-${m}`)];
}

/**
 * Οι ημερομηνίες που διαβάζει ο άνθρωπος. «Τελευταία ενημέρωση» δέχεται και
 * προσδιορισμό («τιμών») και όλες τις μορφές· «Έκδοση» μόνο την αριθμητική,
 * γιατί η λέξη μπορεί να βρεθεί και μέσα σε κείμενο, μπροστά από μήνα.
 */
function visibleDates(html: string): string[] {
  // Το κείμενο ανάμεσα στις ετικέτες. Με split και όχι με replace: το CodeQL
  // διαβάζει το replace ως ελλιπή απολύμανση HTML (#400), ενώ εδώ το κείμενο
  // μόνο ελέγχεται και δεν τυπώνεται πουθενά.
  const text = html.split(/<[^>]+>/).join('').replace(/\u00A0/g, ' ');
  const out: string[] = [];
  const MONTH = '[Α-ΩΆ-Ώα-ωά-ώϊϋΐΰ]+';
  const DATE = `(\\d{2}/\\d{2}/\\d{4}|\\d{1,2} ${MONTH} \\d{4}|${MONTH} \\d{4})`;
  for (const m of text.matchAll(new RegExp(`Τελευταία ενημέρωση(?: [α-ωά-ώ]+)?:? ${DATE}`, 'g'))) out.push(m[1]);
  for (const m of text.matchAll(/Έκδοση (\d{2}\/\d{2}\/\d{4})/g)) out.push(m[1]);
  return out;
}

/** Η σελίδα μιας διαδρομής, αποδομένη όπως στον διακομιστή (ή `null` αν θέλει το Next). */
async function render(path: string): Promise<string | null> {
  const file = path === '/' ? './page' : `.${path}/page`;
  const src = readFileSync(`app${path === '/' ? '' : path}/page.tsx`, 'utf8');
  const mod = await import(file) as { default: (p?: object) => ReactElement | Promise<ReactElement> };
  try {
    // Η σελίδα του περιηγητή ('use client') αποδίδεται ως στοιχείο· η σελίδα του
    // διακομιστή καλείται, γιατί μπορεί να είναι ασύγχρονη.
    if (/^\s*['"]use client['"]/.test(src)) return renderToStaticMarkup(createElement(mod.default));
    return renderToStaticMarkup(await mod.default({}));
  } catch {
    return null;
  }
}

async function main() {
  const map = sitemap();
  const guideBy = new Map(GUIDES.map(g => [SITE + g.href, g.updated]));
  const seen = new Set<string>();
  const datesBy = new Map<string, string[]>();
  let withDate = 0;

  for (const row of map) {
    const path = row.url === SITE ? '/' : row.url.slice(SITE.length);
    const lm = typeof row.lastModified === 'string' ? row.lastModified : '';
    seen.add(path);

    // ── 1. ΜΙΑ ΠΗΓΗ ───────────────────────────────────────────────────────
    const fromRegistry = (PAGE_UPDATED as Record<string, string>)[path];
    const expected = fromRegistry ?? guideBy.get(row.url) ?? (path === '/odigos' ? GUIDES_UPDATED : path === '/ergaleia' ? TOOLS_UPDATED : undefined);
    ok(`${path}: ο χάρτης παίρνει την ημερομηνία από το pageUpdated.ts ή το guides.ts`, expected !== undefined && lm === expected);

    // ── 2. ΚΑΜΙΑ ΜΕΛΛΟΝΤΙΚΗ ─────────────────────────────────────────────────
    ok(`${path}: ημερομηνία ISO`, ISO.test(lm));
    ok(`${path}: όχι μελλοντική (${lm} έναντι ${TODAY})`, lm <= TODAY);

    // ── 3. Η ΟΡΑΤΗ ΗΜΕΡΟΜΗΝΙΑ ΕΙΝΑΙ ΑΥΤΗ ΤΟΥ ΧΑΡΤΗ ──────────────────────────
    ok(`${path}: η σελίδα υπάρχει`, existsSync(`app${path === '/' ? '' : path}/page.tsx`));
    const html = await render(path);
    if (html === null) {
      // Δεν αποδίδεται έξω από το Next (π.χ. η εγγραφή, με τον δρομολογητή του).
      // Τότε δεν πρέπει να τυπώνει ημερομηνία ενημέρωσης ούτε στην πηγή της.
      const src = readFileSync(`app${path === '/' ? '' : path}/page.tsx`, 'utf8');
      ok(`${path}: δεν αποδίδεται εδώ, άρα δεν πρέπει να γράφει «Τελευταία ενημέρωση»`, !/Τελευταία ενημέρωση|Έκδοση \$\{/.test(src));
      continue;
    }
    const dates = visibleDates(html);
    datesBy.set(path, dates);
    if (dates.length) withDate++;
    const accepted = shown(lm);
    for (const d of dates) ok(`${path}: η σελίδα γράφει «${d}», ο χάρτης ${lm}`, accepted.includes(d));
  }

  for (const p of Object.keys(PAGE_UPDATED) as DatedPage[]) ok(`${p}: η ημερομηνία του pageUpdated.ts είναι στον χάρτη`, seen.has(p));

  // ── 4. ΚΑΘΕ ΓΡΑΜΜΗ ΜΕ ΠΗΓΗ ΕΙΝΑΙ Η ΠΗΓΗ ΤΗΣ ─────────────────────────────────
  const registrySrc = readFileSync('app/pageUpdated.ts', 'utf8');
  for (const p of Object.keys(PAGE_UPDATED) as DatedPage[]) {
    const src = SOURCED[p];
    ok(`${p}: η γραμμή είναι είτε με πηγή είτε με το χέρι, όχι και τα δύο ούτε κανένα`, (src !== undefined) !== MANUAL.includes(p));
    if (src) {
      ok(`${p}: η πηγή (${src.from}) έχει ημερομηνία ελέγχου`, typeof src.iso === 'string' && ISO.test(src.iso));
      ok(`${p}: PAGE_UPDATED ${PAGE_UPDATED[p]} = ${src.from} ${src.iso}`, PAGE_UPDATED[p] === src.iso);
      // Η ίδια τιμή γραμμένη με το χέρι περνά σήμερα και ξεμένει στον επόμενο
      // έλεγχο της πηγής· γι' αυτό η γραμμή δεν δέχεται κυριολεκτική ημερομηνία.
      const line = new RegExp(`^\\s*'${p}':\\s*(.+)$`, 'm').exec(registrySrc)?.[1] ?? '';
      ok(`${p}: η γραμμή του pageUpdated.ts διαβάζει ${src.from}, δεν γράφει ημερομηνία`, line.includes(src.from) && !/^['"`]/.test(line));
    } else {
      const dates = datesBy.get(p) ?? [];
      ok(`${p}: γραμμή με το χέρι, άρα η σελίδα δεν γράφει ημερομηνία ενημέρωσης (βρέθηκε: ${dates.join(', ') || 'καμία'})`, dates.length === 0);
    }
  }
  for (const p of [...Object.keys(SOURCED), ...MANUAL]) ok(`${p}: υπάρχει στο pageUpdated.ts`, p in PAGE_UPDATED);
  // ΔΕΝ ΕΙΝΑΙ ΚΕΝΟΣ Ο ΕΛΕΓΧΟΣ. Κάθε οδηγός του χάρτη, οι πέντε υπολογιστές με
  // πλαίσιο πηγών και οι τρεις νομικές σελίδες γράφουν ημερομηνία· αν η εξαγωγή
  // σταματήσει να τις βρίσκει, το (3) περνά χωρίς να έχει κοιτάξει τίποτα. Ο
  // οδηγός εκτός καταλόγου δεν είναι στον χάρτη (27.10.2026), άρα ούτε εδώ.
  ok(`βρέθηκε ορατή ημερομηνία σε ${withDate} σελίδες (τουλάχιστον ${LISTED_GUIDES.length + 8})`, withDate >= LISTED_GUIDES.length + 8);

  // ── 5. ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ ΤΟΥ 18/10 ──────────────────────────────────────────
  // Χάρτης και σελίδα ΕΝΦΙΑ και φόρου ενοικίων δεν γράφουν πια τον έλεγχο των
  // ορίων (26/08) όταν το περιεχόμενο άλλαξε μετά.
  for (const p of ['/ypologismos-enfia', '/ypologismos-forou-enoikion'] as const) {
    const lm = map.find(r => r.url === SITE + p)?.lastModified;
    ok(`${p}: lastmod ${lm} όχι παλαιότερο από την αλλαγή περιεχομένου ${STAMPS[p]?.updated}`, typeof lm === 'string' && !!STAMPS[p]?.updated && lm >= (STAMPS[p].updated as string));
    ok(`${p}: lastmod ${lm} όχι παλαιότερο από τον έλεγχο ορίων`, typeof lm === 'string' && lm >= (SOURCED[p]?.iso ?? '') );
  }

  // ── 6. ΤΟ ΠΛΑΙΣΙΟ ΓΡΑΦΕΙ ΚΑΙ ΤΙΣ ΔΥΟ ΟΤΑΝ ΔΙΑΦΕΡΟΥΝ ──────────────────────────
  {
    const both = html(createElement(ToolSources, { kind: 'enfia', checked: '2026-08-26', updated: '2026-10-18' }));
    ok('έλεγχος ορίων και τελευταία ενημέρωση, με τη σειρά', /Έλεγχος ορίων 26\/08\/2026 · Τελευταία ενημέρωση 18\/10\/2026/.test(both));
    const same = html(createElement(ToolSources, { kind: 'enfia', checked: '2026-08-26', updated: '2026-08-26' }));
    ok('ίδια ημερομηνία: μία φορά', !same.includes('Έλεγχος ορίων') && same.includes('Τελευταία ενημέρωση 26/08/2026'));
    const old = html(createElement(ToolSources, { kind: 'power', checked: '2026-10-12' }));
    ok('χωρίς updated: όπως πριν', !old.includes('Έλεγχος ορίων') && old.includes('Τελευταία ενημέρωση 12/10/2026'));
    const none = html(createElement(ToolSources, { kind: 'loan', checked: null }));
    ok('δάνειο χωρίς ημερομηνία: καμία', !none.includes('Τελευταία ενημέρωση'));
  }

  console.log(fail ? `✗ pageUpdated: ${fail} απέτυχαν, ${pass} πέρασαν` : `✓ pageUpdated: ${pass} έλεγχοι πέρασαν`);
  if (fail) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
