// npx tsx lib/analytics/vercelMount.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// Η ΜΕΤΡΗΣΗ ΕΠΙΣΚΕΨΙΜΟΤΗΤΑΣ ΦΤΑΝΕΙ ΣΤΗ VERCEL: Ο,ΤΙ ΕΞΑΡΤΑΤΑΙ ΑΠΟ ΤΟΝ ΚΩΔΙΚΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΒΡΕΘΗΚΕ (20/10/2026). Το API της Vercel απαντούσε «404 Web Analytics not
// found» για το έργο, ενώ το /trust γράφει ότι μετράμε με το Vercel Web
// Analytics. Ελέγχθηκαν οι τρεις θέσεις όπου ο κώδικας θα μπορούσε να το
// σπάσει. Καμία δεν το έσπαγε:
//   1. το <Analytics> μπαίνει σε κάθε σελίδα από το app/layout.tsx·
//   2. το σενάριο και ο δίαυλος είναι ίδιας προέλευσης (/_vercel/insights), το
//      σενάριο το εισάγει ο κώδικας της εφαρμογής, οπότε το 'strict-dynamic'
//      το δέχεται και το connect-src 'self' καλύπτει την αποστολή·
//   3. ο proxy.ts ζητά σύνδεση ΜΟΝΟ για το /dashboard, οπότε το /_vercel/*
//      δεν γυρίζει ποτέ 307 προς το /login.
// Το https://properwise.gr/_vercel/insights/script.js απαντούσε 200. Η αιτία
// ήταν ο διακόπτης του έργου στη Vercel (Analytics → Enable), όχι ο κώδικας.
//
// Το τεστ κρατά τις τρεις θέσεις όπως είναι: αν μία αλλάξει, η μέτρηση
// σταματά σιωπηλά, όπως σταμάτησε και τώρα, χωρίς κανένα σφάλμα πουθενά.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } };

const layout = readFileSync('app/layout.tsx', 'utf8');
const mount = readFileSync('app/VercelAnalytics.tsx', 'utf8');
const proxy = readFileSync('proxy.ts', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies?: Record<string, string> };

// ── 1. ΜΠΑΙΝΕΙ ΣΕ ΚΑΘΕ ΣΕΛΙΔΑ ───────────────────────────────────────────────
ok('το πακέτο είναι εξάρτηση παραγωγής', !!pkg.dependencies?.['@vercel/analytics']);
ok('το layout εισάγει το VercelAnalytics', /import VercelAnalytics from "\.\/VercelAnalytics"/.test(layout));
ok('το layout το αποδίδει μέσα στο body', /<body>[\s\S]*<VercelAnalytics \/>[\s\S]*<\/body>/.test(layout));
ok('το VercelAnalytics αποδίδει το <Analytics> του Next', mount.includes("from '@vercel/analytics/next'") && /<Analytics\b/.test(mount));
ok('ούτε mode="development" ούτε debug στην παραγωγή', !/mode=|debug=/.test(mount));

// ── 2. ΤΟ CSP ΔΕΝ ΤΟ ΜΠΛΟΚΑΡΕΙ ───────────────────────────────────────────────
{
  const script = proxy.match(/`script-src ([^`]*)`/)?.[1] ?? '';
  const connect = proxy.match(/"connect-src ([^"]*)"/)?.[1] ?? '';
  ok('script-src με strict-dynamic (το σενάριο το εισάγει ο κώδικας)', script.includes("'strict-dynamic'"));
  ok("connect-src με 'self' (ο δίαυλος /_vercel/insights)", connect.split(/\s+/).includes("'self'"));
  // Το σενάριο του πακέτου στέλνει στην ίδια προέλευση. Αν μια έκδοση άλλαζε
  // σε ξένο τομέα, το connect-src θα το μπλόκαρε σιωπηλά.
  const dist = readFileSync('node_modules/@vercel/analytics/dist/next/index.mjs', 'utf8');
  ok('το πακέτο φορτώνει από το /_vercel/insights', dist.includes('/_vercel/insights/script.js'));
}

// ── 3. ΤΟ /_vercel ΔΕΝ ΖΗΤΑ ΣΥΝΔΕΣΗ ─────────────────────────────────────────
{
  const list = proxy.match(/const PRIVATE_PREFIXES = \[([^\]]*)\]/)?.[1] ?? '';
  const prefixes = [...list.matchAll(/"([^"]+)"/g)].map(m => m[1]);
  ok('βρέθηκαν οι ιδιωτικές διαδρομές', prefixes.length > 0);
  for (const p of ['/_vercel/insights/script.js', '/_vercel/insights/view', '/_vercel/insights/event']) {
    ok(`${p}: δεν ανακατευθύνεται στη σύνδεση`, !prefixes.some(x => p === x || p.startsWith(x + '/')));
  }
}

console.log(fail === 0 ? `✓ vercelMount: ${pass} έλεγχοι πέρασαν` : `✗ vercelMount: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
