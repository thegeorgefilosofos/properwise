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
import { GUIDES, guideSlug } from './odigos/guides';
import { SHARE_CARDS, shareImage } from './og/share';
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
ok('η εικόνα είναι η κάρτα «home» της κοινής διαδρομής', SHARE_IMAGE.url === '/og/home' && !!SHARE_CARDS['home'] && existsSync('app/og/[slug]/route.tsx'));

// ── (β) ΚΑΝΕΝΑ `openGraph` ΜΕ ΤΟ ΧΕΡΙ ───────────────────────────────────────
// Η αρχική εξαιρείται: παίρνει την εικόνα από το openGraph της ρίζας
// (app/layout.tsx, SHARE_IMAGE).
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
  // Η δική του κάρτα κοινοποίησης: αλλιώς ο σύνδεσμος φτάνει με τη γενική εικόνα.
  ok(`${g.href}: έχει δική του εικόνα κοινοποίησης`, !!SHARE_CARDS[guideSlug(g)]);
}
const hub = map.find(r => r.url === `${SITE}/odigos`);
ok('ο κόμβος των οδηγών έχει ημερομηνία στον χάρτη, την πιο πρόσφατη των οδηγών',
  hub?.lastModified === GUIDES.map(g => g.updated).sort().at(-1));

// Με δική της εικόνα η σελίδα δεν γράφει τη γενική, ούτε στην κάρτα X.
const own = publicMetadata({ title: 'Τ', description: 'Π', url: `${SITE}/dokimi`, image: shareImage('odigos') });
ok('με δική της εικόνα δεν μπαίνει η γενική στο openGraph',
  JSON.stringify((own.openGraph as { images?: unknown }).images) === JSON.stringify([shareImage('odigos')]));
ok('με δική της εικόνα η κάρτα X έχει την ίδια',
  JSON.stringify((own.twitter as { images?: unknown }).images) === JSON.stringify([shareImage('odigos')]));
// ΜΙΑ ΔΙΑΔΡΟΜΗ ΓΙΑ ΟΛΕΣ ΤΙΣ ΚΑΡΤΕΣ: κάθε opengraph-image.tsx εκτός ρίζας είναι
// μια ακόμη συνάρτηση διακομιστή σε κάθε ανάπτυξη (app/og/share.ts).
function ogFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return ogFiles(p);
    return /^(opengraph|twitter)-image\.tsx$/.test(e.name) ? [p] : [];
  });
}
const extraOg = ogFiles('app');
ok(`καμία κάρτα κοινοποίησης ως opengraph-image.tsx, ούτε στη ρίζα (βρέθηκαν: ${extraOg.join(', ') || 'καμία'})`, extraOg.length === 0);

console.log(`publicMetadata: ✓ ${passed} · ✗ ${failed}`);
if (failed) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1); }
