// npx tsx app/siteCatalog.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΧΑΡΤΗΣ ΓΙΑ ΤΟΝ ΑΝΘΡΩΠΟ, ΤΟ /llms.txt ΚΑΙ ΤΟ /sitemap.xml ΛΕΝΕ ΤΙΣ ΙΔΙΕΣ ΣΕΛΙΔΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Τρεις λίστες για το ίδιο πράγμα: το sitemap() για τις μηχανές αναζήτησης, η
// σελίδα /xartis (και η /en/sitemap) για τον άνθρωπο, το /llms.txt για τα
// εργαλεία AI. Αν μία σελίδα μπει στη μία και όχι στις άλλες, κοκκινίζει εδώ.
//
//   1. Οι σύνδεσμοι `data-xm` του /xartis είναι ακριβώς οι ελληνικές γραμμές
//      του χάρτη και του /en/sitemap ακριβώς οι αγγλικές, χωρίς διπλούς.
//   2. Οι σύνδεσμοι του /llms.txt είναι ακριβώς όλες οι γραμμές του χάρτη.
//   3. Η ημερομηνία κάθε σελίδας του καταλόγου είναι το `lastModified` της.
//   4. Η ροή RSS έχει κάθε οδηγό του κόμβου, με την ημερομηνία του.
//   5. Το /humans.txt υπογράφει «Ομάδα Properwise» και το security.txt ισχύει.
//   6. Τα public/humans.txt και public/odigos/feed.xml είναι ό,τι γράφει ο κώδικας.
// ═══════════════════════════════════════════════════════════════════════════
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import sitemap from './sitemap';
import robots from './robots';
import { SITE } from '@/lib/core/site';
import { grDate } from '@/lib/core/format';
import { athensToday } from '@/lib/core/time';
import { isEnPath } from '@/lib/i18n/locale';
import { IDENTITY } from '@/lib/legal/identity';
import { llmsText } from '@/lib/seo/llms';
import { humansText } from '@/lib/seo/humans';
import { guidesFeed, rfc822 } from '@/lib/seo/feed';
import { LISTED_GUIDES, GUIDES } from './odigos/guides';
import { siteCatalog, catalogEntries, catalogCounts, XARTIS_PATH, XARTIS_UPDATED } from './siteCatalog';
import { SiteMapView } from './xartis/SiteMapView';

const H = createElement('h1', null, 'Χάρτης');

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

const path = (url: string) => (url === SITE ? '/' : url.slice(SITE.length));
const abs = (p: string) => (p === '/' ? SITE : SITE + p);
const map = sitemap();
const urls = map.map(r => r.url);
const elUrls = urls.filter(u => !isEnPath(path(u)));
const enUrls = urls.filter(u => isEnPath(path(u)));

/** Η διαφορά δύο λιστών, για μήνυμα που λέει τι λείπει και τι περισσεύει. */
function sameSet(name: string, got: string[], want: string[]) {
  const g = new Set(got), w = new Set(want);
  const missing = want.filter(u => !g.has(u)), extra = got.filter(u => !w.has(u));
  ok(`${name}: χωρίς διπλούς (${got.length} σύνδεσμοι, ${g.size} μοναδικοί)`, g.size === got.length);
  ok(`${name}: ίδιες διευθύνσεις με το sitemap.xml (λείπουν: ${missing.join(', ') || 'καμία'} · περισσεύουν: ${extra.join(', ') || 'καμία'})`, missing.length === 0 && extra.length === 0);
}

// ── 1. Η ΣΕΛΙΔΑ ─────────────────────────────────────────────────────────────
const hrefs = (html: string) => [...html.matchAll(/<a\b[^>]*\bdata-xm=""[^>]*>/g)]
  .map(m => /\bhref="([^"]+)"/.exec(m[0])?.[1] ?? '').map(abs);
const el = renderToStaticMarkup(createElement(SiteMapView, { locale: 'el', heading: H }));
const en = renderToStaticMarkup(createElement(SiteMapView, { locale: 'en', heading: H }));
sameSet('/xartis', hrefs(el), elUrls);
sameSet('/en/sitemap', hrefs(en), enUrls);
ok('ο χάρτης είναι ο ίδιος στον χάρτη των μηχανών', urls.includes(abs(XARTIS_PATH)) && urls.includes(abs('/en/sitemap')));
ok('η σελίδα δείχνει τον εαυτό της ως τρέχουσα', /aria-current="page"[^>]*>Χάρτης ιστότοπου/.test(el) || /href="\/xartis"[^>]*aria-current="page"/.test(el));
ok('δομημένο σχήμα: BreadcrumbList με τον οργανισμό (ORG_ID)', el.includes('"BreadcrumbList"') && el.includes(`"@id":"${SITE}/#organization"`));
ok('σύνδεσμοι στα αρχεία για μηχανές', ['/sitemap.xml', '/robots.txt', '/llms.txt', '/humans.txt', '/odigos/feed.xml', '/.well-known/security.txt'].every(f => el.includes(`href="${f}"`)));
const counts = catalogCounts(siteCatalog());
ok(`τα πλήθη του καταλόγου είναι τα πλήθη του χάρτη (${counts.el}/${elUrls.length} · ${counts.en}/${enUrls.length})`, counts.el === elUrls.length && counts.en === enUrls.length);

// Το ελληνικό κείμενο της σελίδας: ο κανόνας του ιδιοκτήτη.
const text = el.split(/<[^>]+>/).join(' ');
ok('χωρίς κόμμα πριν από «και»', !/,\s*(και|κι)(?!\p{L})/u.test(text));
ok('χωρίς μακριά παύλα', !text.includes('\u2014'));
ok('χωρίς «δωρεάν»', !/δωρεάν/i.test(text));
ok('ημερομηνίες ηη/μμ/εεεε, καμία ISO στο ορατό κείμενο', /\d{2}\/\d{2}\/\d{4}/.test(text) && !/\b\d{4}-\d{2}-\d{2}\b/.test(text));

// ── 2. ΤΟ /llms.txt ─────────────────────────────────────────────────────────
const llms = llmsText();
sameSet('/llms.txt', [...llms.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(m => m[1]), urls);
ok('/llms.txt: ενότητα για το πώς να μας αναφέρετε', llms.includes('## Πώς να μας αναφέρετε'));
ok('/llms.txt: χωρίς «δωρεάν» σε αρχείο με τιμοκατάλογο', !/δωρεάν/i.test(llms));

// ── 3. ΟΙ ΗΜΕΡΟΜΗΝΙΕΣ ───────────────────────────────────────────────────────
const lastMod = new Map(map.map(r => [r.url, String(r.lastModified ?? '')]));
for (const e of catalogEntries(siteCatalog())) {
  ok(`${e.path}: η ημερομηνία του καταλόγου (${e.updated}) είναι του χάρτη (${lastMod.get(abs(e.path))})`, lastMod.get(abs(e.path)) === e.updated);
  if (!e.deadlines) ok(`${e.path}: η σελίδα γράφει ${grDate(e.updated)}`, el.includes(`dateTime="${e.updated}"`) && el.includes(grDate(e.updated)));
}
ok(`η ημερομηνία του χάρτη (${XARTIS_UPDATED}) δεν είναι μελλοντική`, XARTIS_UPDATED <= athensToday());

// ── 4. Η ΡΟΗ ────────────────────────────────────────────────────────────────
const feed = guidesFeed();
const items = [...feed.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);
ok(`η ροή έχει κάθε οδηγό του κόμβου (${items.length}/${LISTED_GUIDES.length})`, items.length === LISTED_GUIDES.length);
for (const g of LISTED_GUIDES) {
  const it = items.find(i => i.includes(`<link>${SITE}${g.href}</link>`)) ?? '';
  ok(`${g.href}: στη ροή με την ημερομηνία ενημέρωσης`, it.includes(`<pubDate>${rfc822(g.updated)}</pubDate>`));
}
for (const g of GUIDES.filter(x => x.unlisted)) ok(`${g.href}: εκτός καταλόγου, εκτός ροής`, !feed.includes(SITE + g.href));
ok('η ροή είναι RSS 2.0 με σύνδεσμο προς τον εαυτό της', feed.startsWith('<?xml') && feed.includes('<rss version="2.0"') && feed.includes('rel="self"'));

// ── 5. humans.txt ΚΑΙ security.txt ──────────────────────────────────────────
const humans = humansText();
ok('/humans.txt: «Ομάδα Properwise»', humans.includes('Ομάδα Properwise'));
ok('/humans.txt: μόνο διευθύνσεις του τομέα', [...humans.matchAll(/[\w.+-]+@[\w.-]+/g)].every(m => m[0].endsWith('@properwise.gr')));
ok('/humans.txt: η ημερομηνία του χάρτη', humans.includes(grDate(XARTIS_UPDATED)));
const sec = readFileSync('public/.well-known/security.txt', 'utf8');
const expires = /^Expires:\s*(\S+)/m.exec(sec)?.[1] ?? '';
ok('security.txt: επαφή η διεύθυνση ασφαλείας του μητρώου', sec.includes(`Contact: mailto:${IDENTITY.securityEmail}`));
ok(`security.txt: το Expires (${expires}) δεν έχει περάσει`, expires.slice(0, 10) > athensToday());
ok('security.txt: Canonical', /^Canonical: https:\/\/\S+\/\.well-known\/security\.txt$/m.test(sec));

// ── 6. ΤΑ ΣΤΑΤΙΚΑ ΑΡΧΕΙΑ ΔΕΝ ΜΕΝΟΥΝ ΠΙΣΩ ΑΠΟ ΤΟΝ ΚΩΔΙΚΑ ─────────────────────────
// Στατικά στο public/ για να μην ανεβαίνει δική τους συνάρτηση (docs/perf/server.json).
for (const [file, made] of [['public/humans.txt', humans], ['public/odigos/feed.xml', feed]] as const) {
  const onDisk = (() => { try { return readFileSync(file, 'utf8'); } catch { return ''; } })();
  ok(`${file}: ίδιο με τον κώδικα (αν όχι: npm run machine-files)`, onDisk === made);
}

// Κανένα από τα νέα αρχεία δεν κλείνεται από το robots.
const disallow = ([] as string[]).concat((robots().rules as { disallow?: string | string[] }).disallow ?? []);
for (const p of [XARTIS_PATH, '/humans.txt', '/odigos/feed.xml']) ok(`${p}: δεν το κλείνει το robots.txt`, !disallow.some(d => p.startsWith(d)));

console.log(fail ? `✗ siteCatalog: ${fail} απέτυχαν από ${pass + fail}` : `✓ siteCatalog: ${pass} έλεγχοι πέρασαν`);
if (fail) process.exit(1);
