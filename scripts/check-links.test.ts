// npx tsx scripts/check-links.test.ts
//
// Ο εβδομαδιαίος έλεγχος συνδέσμων χωρίς δίκτυο: τι διαβάζεται από τον χάρτη,
// ποιοι σύνδεσμοι μετρούν, ποιοι είναι δικοί μας και πότε μια ανακατεύθυνση
// είναι σκόπιμη. Και ότι η κρίση της σελίδας είναι η ΙΔΙΑ με του ελέγχου υγείας.
import { sitemapLocs, anchorHrefs, classify, internalVerdict, OFFICIAL } from './lib/links.mjs';
import { verdictOf, ERROR_MARKER, MIN_CHARS } from '../supabase/functions/_shared/probe.mjs';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean) { if (cond) { pass++; } else { fail++; console.error(`✗ ${name}`); } }
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}

// ═══ Ο ΧΑΡΤΗΣ ═══════════════════════════════════════════════════════════════
eq('οι διευθύνσεις του χάρτη', sitemapLocs(`<?xml version="1.0"?><urlset>
<url><loc>https://properwise.gr</loc></url>
<url><loc> https://properwise.gr/odigos?a=1&amp;b=2 </loc></url></urlset>`), ['https://properwise.gr', 'https://properwise.gr/odigos?a=1&b=2']);
eq('άδειος χάρτης', sitemapLocs('<urlset></urlset>'), []);

// ═══ ΟΙ ΣΥΝΔΕΣΜΟΙ ΤΗΣ ΣΕΛΙΔΑΣ ══════════════════════════════════════════════
const html = `<html><head><link rel="preload" href="/font.woff2"></head><body>
<a href="/odigos">Οδηγοί</a> <a class="x" href='/paketa#top'>Πακέτα</a> <a href=/trust>x</a>
<a href="https://www.aade.gr/eforologiko-imerologio">ΑΑΔΕ</a>
<a href="mailto:support@properwise.gr">mail</a> <a href="#main">skip</a>
<!-- <a href="/sxolio">όχι</a> -->
<script>self.__next_f.push([1,"<a href=\\"/apo-to-rsc\\">"])</script>
</body></html>`;
eq('μόνο τα <a> που αποδόθηκαν', anchorHrefs(html), ['/odigos', '/paketa#top', '/trust', 'https://www.aade.gr/eforologiko-imerologio', 'mailto:support@properwise.gr', '#main']);

const hosts = ['localhost', 'properwise.gr', 'www.properwise.gr'];
const page = 'http://localhost:3000/odigos';
eq('σχετικός σύνδεσμος είναι δικός μας', classify('/paketa#top', page, hosts), { kind: 'internal', url: 'http://localhost:3000/paketa' });
eq('το δημόσιο domain είναι δικό μας και τοπικά', classify('https://properwise.gr/trust', page, hosts).kind, 'internal');
eq('η ΑΑΔΕ είναι εξωτερική', classify('https://www.aade.gr/x', page, hosts).kind, 'external');
eq('mailto παραλείπεται', classify('mailto:a@b.gr', page, hosts).kind, 'skip');
eq('άγκυρα παραλείπεται', classify('#main', page, hosts).kind, 'skip');
eq('tel παραλείπεται', classify('tel:+302100000000', page, hosts).kind, 'skip');

// ═══ ΟΙ ΕΠΙΣΗΜΕΣ ΠΗΓΕΣ ═════════════════════════════════════════════════════
for (const h of ['www.aade.gr', 'www.gov.gr', 'stegasi.gov.gr', 'www.bankofgreece.gr', 'data.ecb.europa.eu', 'www.statistics.gr', 'api.et.gr']) ok(`επίσημη πηγή: ${h}`, OFFICIAL.test(h));
for (const h of ['www.linkedin.com', 'www.dei.gr', 'fakeaade.gr', 'gov.gr.example.com']) ok(`όχι επίσημη: ${h}`, !OFFICIAL.test(h));

// ═══ ΑΝΑΚΑΤΕΥΘΥΝΣΕΙΣ ═══════════════════════════════════════════════════════
eq('200 κατευθείαν', internalVerdict([{ url: '/a', status: 200 }]), { ok: true, why: '' });
ok('σκόπιμη ανακατεύθυνση σε 200 περνά', internalVerdict([{ url: '/dashboard', status: 307 }, { url: '/login', status: 200 }]).ok);
ok('404 κόβει', !internalVerdict([{ url: '/x', status: 404 }]).ok);
ok('ανακατεύθυνση σε 404 κόβει', !internalVerdict([{ url: '/x', status: 308 }, { url: '/y', status: 404 }]).ok);
ok('ατέρμονη ανακατεύθυνση κόβει', !internalVerdict([{ url: '/a', status: 307 }, { url: '/b', status: 307 }]).ok);
ok('σφάλμα δικτύου κόβει', !internalVerdict([{ url: '/a', error: 'ECONNRESET' }]).ok);

// ═══ Η ΣΕΛΙΔΑ ΚΡΙΝΕΤΑΙ ΟΠΩΣ ΣΤΟΝ ΕΛΕΓΧΟ ΥΓΕΙΑΣ ════════════════════════════
const body = 'PROPERWISE ' + 'x'.repeat(MIN_CHARS);
ok('σελίδα με σήμα περνά', verdictOf(200, body, { must: 'PROPERWISE' }).ok);
ok('σελίδα σφάλματος με 200 κόβεται', !verdictOf(200, body + ERROR_MARKER, { must: 'PROPERWISE' }).ok);
ok('σελίδα χωρίς σήμα κόβεται', verdictOf(200, 'x'.repeat(MIN_CHARS + 1), { must: 'PROPERWISE' }).miss === true);
ok('σχεδόν άδειο σώμα κόβεται', !verdictOf(200, 'PROPERWISE', { must: 'PROPERWISE' }).ok);
eq('κωδικός 500', verdictOf(500, body, { must: 'PROPERWISE' }).why, 'κωδικός 500');

console.log(`\ncheck-links: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
