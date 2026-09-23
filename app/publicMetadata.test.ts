// npx tsx app/publicMetadata.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΜΙΑ ΔΗΜΟΣΙΑ ΣΕΛΙΔΑ ΧΩΡΙΣ ΕΙΚΟΝΑ ΚΟΙΝΟΠΟΙΗΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Το σφάλμα δεν φαινόταν πουθενά: η σελίδα αποδιδόταν σωστά, οι τίτλοι και οι
// περιγραφές ήταν στη θέση τους και μόνο όποιος έστελνε τον σύνδεσμο έβλεπε
// ότι έφτανε χωρίς εικόνα. Αιτία ήταν ένα `openGraph` γραμμένο με το χέρι, που
// στον Next αντικαθιστά ολόκληρο το `openGraph` του γονέα μαζί με την εικόνα.
//
// Ο έλεγχος: (α) ο βοηθός βάζει πάντα την εικόνα, (β) καμία σελίδα δεν γράφει
// `openGraph` με το χέρι, (γ) κάθε οδηγός έχει σελίδα, έγκυρες ημερομηνίες και
// ημερομηνία τροποποίησης στον χάρτη ιστότοπου.
// ═══════════════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { publicMetadata } from './publicMetadata';
import { SHARE_IMAGE } from '@/lib/core/site';
import { GUIDES } from './odigos/guides';
import sitemap from './sitemap';
import { SITE } from '@/lib/core/site';

let passed = 0, failed = 0;
const fails: string[] = [];
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; fails.push(name); } };

// ── (α) Ο ΒΟΗΘΟΣ ────────────────────────────────────────────────────────────
const m = publicMetadata({ title: 'Τίτλος', description: 'Περιγραφή', url: `${SITE}/dokimi`, type: 'article' });
const og = m.openGraph as { images?: unknown[]; type?: string } | undefined;
const tw = m.twitter as { images?: unknown[] } | undefined;
ok('το openGraph έχει την εικόνα κοινοποίησης', !!og?.images?.includes(SHARE_IMAGE));
ok('η κάρτα X έχει την ίδια εικόνα', !!tw?.images?.includes(SHARE_IMAGE));
ok('ο τύπος περνά όπως δόθηκε', og?.type === 'article');
ok('ο τίτλος είναι απόλυτος', JSON.stringify(m.title) === JSON.stringify({ absolute: 'Τίτλος' }));
ok('η εικόνα είναι η διαδρομή του app/opengraph-image.tsx', SHARE_IMAGE.url === '/opengraph-image' && existsSync('app/opengraph-image.tsx'));

// ── (β) ΚΑΝΕΝΑ `openGraph` ΜΕ ΤΟ ΧΕΡΙ ───────────────────────────────────────
// Η αρχική εξαιρείται: ζει στο ίδιο τμήμα με το opengraph-image.tsx, οπότε ο
// Next της δίνει την εικόνα από το αρχείο (μετρημένο: η «/» βγάζει og:image).
const ROOT_SEGMENT = new Set(['app/page.tsx', 'app/layout.tsx']);
function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return pages(p);
    return /^(page|layout)\.tsx$/.test(e.name) ? [p] : [];
  });
}
const all = pages('app');
const byHand = all.filter(p => !ROOT_SEGMENT.has(p) && /\bopenGraph\s*:/.test(readFileSync(p, 'utf8')));
ok(`καμία σελίδα δεν γράφει openGraph με το χέρι (βρέθηκαν: ${byHand.join(', ') || 'καμία'})`, byHand.length === 0);
// Αν ο σαρωτής δεν βλέπει σελίδες, το (β) δεν ελέγχει τίποτα.
ok('ο σαρωτής βλέπει τις σελίδες των οδηγών', GUIDES.every(g => all.includes(join('app', g.href, 'page.tsx'))));

// ── (γ) ΟΙ ΟΔΗΓΟΙ ───────────────────────────────────────────────────────────
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const map = sitemap();
for (const g of GUIDES) {
  ok(`${g.href}: η σελίδα υπάρχει`, existsSync(join('app', g.href, 'page.tsx')));
  ok(`${g.href}: ημερομηνίες ISO`, ISO.test(g.published) && ISO.test(g.updated));
  ok(`${g.href}: η ενημέρωση δεν προηγείται της δημοσίευσης`, g.updated >= g.published);
  const row = map.find(r => r.url === SITE + g.href);
  ok(`${g.href}: ο χάρτης δίνει την ημερομηνία του οδηγού`, row?.lastModified === g.updated);
}

console.log(`publicMetadata: ✓ ${passed} · ✗ ${failed}`);
if (failed) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1); }
