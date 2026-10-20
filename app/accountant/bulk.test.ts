// npx tsx app/accountant/bulk.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΔΥΟ ΠΕΛΑΤΕΣ ΜΕ ΤΟ ΙΔΙΟ ΟΝΟΜΑ ΕΧΑΝΑΝ ΤΟ ΕΝΑ ΒΙΒΛΙΟ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ. Το όνομα του αρχείου μέσα στο zip βγαίνει από το ΟΝΟΜΑ του
// πελάτη. Δύο «Γεώργιος Παπαδόπουλος» —σε φάκελο ογδόντα πελατών, καθόλου
// σπάνιο— έδιναν την ίδια διαδρομή. Τα εργαλεία αποσυμπίεσης κρατούν το ένα: ο
// λογιστής κατέβαζε «79 βιβλία» κι έβρισκε 78, χωρίς καμία ένδειξη.
//
// ΓΙΑΤΙ ΔΟΚΙΜΗ. Το σφάλμα δεν φαίνεται σε καμία οθόνη κι δεν το πιάνει κανένας
// τύπος: η `downloadAll` επιστρέφει `files.length`, που ΗΤΑΝ σωστό — το zip
// έχανε το αρχείο αργότερα, στον υπολογιστή του λογιστή.
// ═══════════════════════════════════════════════════════════════════════════
import { bookName, bookNames, lastMove, bundleMode, bundlePaths, bundleIndex, downloadPacks, BUNDLE_MAX_BYTES, type PackRef } from './bulk';
import { readZipEntry } from '@/lib/accounting/zip';

let passed = 0, failed = 0;
const fails: string[] = [];
const ok = (n: string, c: boolean) => { if (c) passed++; else { failed++; fails.push(n); } };

const uniq = (xs: string[]) => new Set(xs).size === xs.length;

// ── ΜΟΝΑΔΙΚΑ ΟΝΟΜΑΤΑ: ΤΙΠΟΤΑ ΔΕΝ ΑΛΛΑΖΕΙ ─────────────────────────────────
{
  const names = bookNames(['Μαρία Ιωάννου', 'Νίκος Δήμου'], 2026);
  ok('μοναδικά ονόματα μένουν όπως ήταν',
     names[0] === bookName('Μαρία Ιωάννου', 2026) && names[1] === bookName('Νίκος Δήμου', 2026));
  ok('κανένα «(2)» χωρίς λόγο', !names.some(n => n.includes('(')));
}

// ── ΤΟ ΑΚΡΙΒΕΣ ΣΕΝΑΡΙΟ ────────────────────────────────────────────────────
{
  const names = bookNames(['Γεώργιος Παπαδόπουλος', 'Μαρία Ιωάννου', 'Γεώργιος Παπαδόπουλος'], 2026);
  ok('ΤΡΙΑ ΟΝΟΜΑΤΑ, ΤΡΙΑ ΔΙΑΦΟΡΕΤΙΚΑ ΑΡΧΕΙΑ', uniq(names) && names.length === 3);
  ok('ο πρώτος κρατά το καθαρό όνομα', names[0] === bookName('Γεώργιος Παπαδόπουλος', 2026));
  ok('ο δεύτερος παίρνει «(2)»', names[2].endsWith(' (2).xlsx'));
  ok('κι η κατάληξη μένει .xlsx', names.every(n => n.endsWith('.xlsx')));
  ok('ο ενδιάμεσος δεν πειράζεται', names[1] === bookName('Μαρία Ιωάννου', 2026));
}

// ── ΤΡΕΙΣ ΣΥΝΩΝΥΜΟΙ ΚΙ ΟΧΙ ΜΟΝΟ ΔΥΟ ─────────────────────────────────────
{
  const names = bookNames(Array(3).fill('Γιάννης Γιάννου'), 2026);
  ok('τρεις συνώνυμοι δίνουν τρία αρχεία', uniq(names));
  ok('με σειρά που διαβάζεται', names[1].endsWith(' (2).xlsx') && names[2].endsWith(' (3).xlsx'));
}

// ── Η ΣΥΓΚΡΟΥΣΗ ΚΡΙΝΕΤΑΙ ΣΤΗΝ ΤΕΛΙΚΗ ΔΙΑΔΡΟΜΗ ────────────────────────────
// Το `safeFilename` καθαρίζει χαρακτήρες, άρα δύο ΔΙΑΦΟΡΕΤΙΚΑ ονόματα μπορούν
// να καταλήξουν στο ίδιο αρχείο. Ο έλεγχος γίνεται σε ό,τι θα γραφτεί.
{
  const a = 'Α/Β Παπαδόπουλος', b = 'Α Β Παπαδόπουλος';
  if (bookName(a, 2026) === bookName(b, 2026)) {
    ok('ονόματα που καθαρίζονται στο ίδιο ξεχωρίζουν κι αυτά', uniq(bookNames([a, b], 2026)));
  } else {
    ok('το safeFilename τα κρατά ήδη χωριστά', uniq(bookNames([a, b], 2026)));
  }
}

// ── ΑΚΡΑ ──────────────────────────────────────────────────────────────────
{
  ok('κενή λίστα δίνει κενή λίστα', bookNames([], 2026).length === 0);
  ok('η χρονιά μπαίνει στο όνομα', bookName('Μαρία Ιωάννου', 2026).includes('2026'));
}

// ── ΚΑΙ Η ΦΡΑΣΗ ΤΗΣ ΤΕΛΕΥΤΑΙΑΣ ΚΙΝΗΣΗΣ, ΠΟΥ ΔΕΝ ΕΙΧΕ ΕΛΕΓΧΟ ──────────────
{
  const now = Date.parse('2026-09-10T12:00:00Z');
  const ago = (d: number) => new Date(now - d * 86400000).toISOString();
  ok('καμία καταχώρηση δεν είναι «πριν από πολύ καιρό»', lastMove(null, now) === 'Καμία καταχώρηση ακόμη');
  ok('ούτε σκουπίδι σε ημερομηνία', lastMove('χθες', now) === 'Καμία καταχώρηση ακόμη');
  ok('σήμερα', lastMove(ago(0), now) === 'Τελευταία καταχώρηση σήμερα');
  ok('χθες', lastMove(ago(1), now) === 'Τελευταία καταχώρηση χθες');
  ok('μέσα στον μήνα μετριέται σε ημέρες', lastMove(ago(5), now).includes('5 ημέρες'));
}

// ── ΟΛΟΙ ΟΙ ΦΑΚΕΛΟΙ ΣΕ ΕΝΑ ZIP ──────────────────────────────────────────────
const ref = (o: Partial<PackRef> = {}): PackRef => ({
  ownerId: 'o1', name: 'Γεώργιος Παπαδόπουλος', afm: '094014201', path: 'o1/2025/pack.zip', sizeBytes: 1000,
  readiness: 'Έτοιμος', aade: 'Συμφωνεί με το προσυμπληρωμένο Ε2', missingCount: 0, sharedAt: '2026-11-04T10:00:00Z', ...o,
});
{
  ok('λίγοι φάκελοι: ένα zip', bundleMode([ref(), ref()]) === 'one');
  ok('πάνω από το όριο: ένας ένας', bundleMode([ref({ sizeBytes: BUNDLE_MAX_BYTES }), ref()]) === 'sequential');
  ok('άγνωστο μέγεθος μετρά συντηρητικά', bundleMode(Array.from({ length: 20 }, () => ref({ sizeBytes: null }))) === 'sequential');
  const paths = bundlePaths([ref(), ref({ ownerId: 'o2' }), ref({ ownerId: 'o3', afm: '123456783' })], 2025);
  ok('ίδιος πελάτης, ίδιο ΑΦΜ: δύο διαφορετικά αρχεία', uniq(paths) && paths[1].endsWith('(2).zip'));
  ok('το ΑΦΜ στο όνομα', paths[2].includes('ΑΦΜ 123456783'));
  const csv = bundleIndex([ref({ name: '=HYPERLINK("x")' })], ['a.zip']);
  ok('ο κατάλογος δεν εκτελεί τύπους', !csv.split('\r\n')[1].startsWith('=') && csv.includes("'=HYPERLINK"));
  ok('η ημερομηνία ως 04/11/2026', csv.includes('04/11/2026'));
}
void (async () => {
  // Ο ΦΑΚΕΛΟΣ ΠΟΥ ΔΕΝ ΚΑΤΕΒΗΚΕ ΛΕΓΕΤΑΙ, ΔΕΝ ΧΑΝΕΤΑΙ ΣΙΩΠΗΛΑ.
  let blob: Blob | null = null;
  const bytes = new TextEncoder().encode('zip-του-πελάτη');
  const r = await downloadPacks([ref(), ref({ ownerId: 'o2', name: 'Μαρία', path: 'gone' })], 2025, async p => (p === 'gone' ? null : bytes), undefined, b => { blob = b; });
  ok('ένα κατέβηκε, ένα όχι', r.done === 1 && r.failed.length === 1 && r.failed[0] === 'Μαρία');
  const zip = new Uint8Array(await (blob as unknown as Blob).arrayBuffer());
  const inner = readZipEntry(zip, bundlePaths([ref()], 2025)[0]);
  ok('ο φάκελος του πελάτη μπαίνει αυτούσιος', !!inner && new TextDecoder().decode(inner) === 'zip-του-πελάτη');
  const idx = readZipEntry(zip, '00 Κατάλογος φακέλων 2025.csv');
  ok('ο κατάλογος λέει ποιος δεν κατέβηκε', !!idx && new TextDecoder().decode(idx).includes('Δεν κατέβηκε'));

  finish();
})();

function finish() {
  console.log(`\nbulk.ts — ${passed} passed, ${failed} failed`);
  if (failed) { console.log('FAILED:\n' + fails.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
  console.log('✓ όλα πέρασαν');
}
