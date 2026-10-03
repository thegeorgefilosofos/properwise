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
// ημερομηνία τροποποίησης στον χάρτη ιστότοπου, (δ) κάθε υπολογιστής του
// υποσέλιδου έχει σελίδα, κάρτα και ημερομηνία ISO στον χάρτη, όχι μελλοντική, (ε) η σύγκριση ρεύματος έχει
// δική της ημερομηνία, όχι παλαιότερη από τον έλεγχο του καταλόγου.
// ═══════════════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { publicMetadata } from './publicMetadata';
import { SHARE_IMAGE } from '@/lib/core/site';
import { GUIDES, guideSlug } from './odigos/guides';
import { SHARE_CARDS, shareImage } from './og/share';
import { PUBLIC_TOOLS } from '@/lib/core/publicTools';
import sitemap from './sitemap';
import { SITE } from '@/lib/core/site';
import { athensToday } from '@/lib/core/time';
import { TARIFFS_VERIFIED } from '@/lib/energy/catalogue';

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
// ── (δ) ΟΙ ΥΠΟΛΟΓΙΣΤΕΣ ──────────────────────────────────────────────────────
// Κάθε υπολογιστής του υποσέλιδου είναι στον χάρτη, με ημερομηνία ISO που δεν
// ξεπερνά τη σημερινή: μια μελλοντική ημερομηνία η μηχανή αναζήτησης τη
// διαβάζει ως λάθος και αγνοεί τη φρεσκάδα ολόκληρου του χάρτη.
const TODAY = athensToday();
// Τα εργαλεία του υποσέλιδου ζουν πλέον στο lib/core/publicTools, που διαβάζει
// και το υποσέλιδο και το /llms.txt. Ελέγχεται και ότι το υποσέλιδο τα παίρνει
// από εκεί: αλλιώς μια λίστα γραμμένη ξανά με το χέρι θα ξέφευγε από τον έλεγχο.
const toolPaths = PUBLIC_TOOLS.map(t => t.href);
ok('το υποσέλιδο διαβάζει τα εργαλεία από το PUBLIC_TOOLS', readFileSync('app/PublicChrome.tsx', 'utf8').includes('PUBLIC_TOOLS.map('));
ok('ο σαρωτής βλέπει τους υπολογιστές του υποσέλιδου', toolPaths.length >= 6 && toolPaths.includes('/ypologismos-stegastikou-daneiou') && toolPaths.includes('/sygkrisi-timologion-revmatos'));
for (const path of toolPaths) {
  const row = map.find(r => r.url === SITE + path);
  const lm = typeof row?.lastModified === 'string' ? row.lastModified : '';
  ok(`${path}: είναι στον χάρτη`, !!row);
  ok(`${path}: ημερομηνία ISO στον χάρτη`, ISO.test(lm));
  ok(`${path}: η ημερομηνία δεν είναι στο μέλλον (${lm} έναντι ${TODAY})`, lm <= TODAY);
  ok(`${path}: η σελίδα υπάρχει`, existsSync(join('app', path, 'page.tsx')));
  ok(`${path}: έχει δική του εικόνα κοινοποίησης`, !!SHARE_CARDS[path.slice(1)]);
}

const hub = map.find(r => r.url === `${SITE}/odigos`);
ok('ο κόμβος των οδηγών έχει ημερομηνία στον χάρτη, την πιο πρόσφατη των οδηγών',
  hub?.lastModified === GUIDES.map(g => g.updated).sort().at(-1));

// ΚΑΘΕ ΓΡΑΜΜΗ ΤΟΥ ΧΑΡΤΗ ΜΕ ΗΜΕΡΟΜΗΝΙΑ. Η αρχική, τα πακέτα, η εγγραφή, η
// εμπιστοσύνη και τα νομικά ήταν χωρίς. Και καμία στο μέλλον: η μηχανή
// αναζήτησης τη διαβάζει ως ψεύτικη και παύει να εμπιστεύεται τον χάρτη.
const today = new Date().toISOString().slice(0, 10);
for (const r of map) {
  const d = String(r.lastModified ?? '');
  ok(`${r.url}: ημερομηνία ISO στον χάρτη`, ISO.test(d));
  ok(`${r.url}: η ημερομηνία δεν είναι στο μέλλον`, d <= today);
}

// ── (δ) Η ΣΥΓΚΡΙΣΗ ΡΕΥΜΑΤΟΣ ─────────────────────────────────────────────────
// Η μόνη σελίδα του χάρτη με ημερομηνία που ακολουθεί κατάλογο τιμών και όχι
// νόμο. Μελλοντική ημερομηνία θα δήλωνε αλλαγή που δεν έγινε· παλαιότερη από
// τον έλεγχο του καταλόγου θα έκρυβε ότι οι τιμές της σελίδας άλλαξαν.
{
  const row = map.find(r => r.url === `${SITE}/sygkrisi-timologion-revmatos`);
  const d = typeof row?.lastModified === 'string' ? row.lastModified : '';
  ok('η σύγκριση ρεύματος είναι στον χάρτη', !!row);
  ok('με ημερομηνία ISO', ISO.test(d));
  ok('όχι μελλοντική', d <= new Date().toISOString().slice(0, 10));
  ok('και όχι παλαιότερη από τον έλεγχο του καταλόγου', d >= TARIFFS_VERIFIED);
  ok('η σελίδα υπάρχει', existsSync('app/sygkrisi-timologion-revmatos/page.tsx'));
  ok('έχει δική της εικόνα κοινοποίησης', !!SHARE_CARDS['sygkrisi-timologion-revmatos']);
}

// ── (στ) Η ΣΕΛΙΔΑ ΤΩΝ ΛΟΓΙΣΤΩΝ ──────────────────────────────────────────────
// Η ημερομηνία της γράφεται με το χέρι στον χάρτη. Μια μελλοντική ημερομηνία
// λέει στη μηχανή ότι η σελίδα άλλαξε όταν δεν άλλαξε ακόμη.
const acct = map.find(r => r.url === `${SITE}/logistes`);
const acctDate = typeof acct?.lastModified === 'string' ? acct.lastModified : '';
ok('/logistes: είναι στον χάρτη με ημερομηνία ISO', ISO.test(acctDate));
ok('/logistes: η ημερομηνία δεν είναι μελλοντική', acctDate <= new Date().toISOString().slice(0, 10));
ok('/logistes: η σελίδα υπάρχει', existsSync('app/logistes/page.tsx'));
ok('/logistes: έχει δική της εικόνα κοινοποίησης', !!SHARE_CARDS['logistes'] && SHARE_CARDS['logistes'].path === '/logistes');

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
