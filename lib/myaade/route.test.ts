// npx tsx lib/myaade/route.test.ts
//
// Από τη Σάρωση στη μαζική (12/11/2026): ποιο αρχείο διαβάζεται στη συσκευή,
// πότε πάει κατευθείαν στη μαζική και τι λέει η κάρτα του βήματος ελέγχου.
// ΜΟΝΟ ΣΥΝΘΕΤΙΚΑ ΣΤΟΙΧΕΙΑ (guard-fixture-identities).
import { shouldSniff, scanRoute, offersBulk, bulkOfferTitle, bulkOfferAction, SNIFF_MAX_BYTES } from './route';
import { sniffMyaadeKind } from './sniff';
import { detectDocKind } from './detect';
import { fakeE9Lines } from '@/scripts/perf-bench/e9Fixture';
import { SCAN_MAX_LINES } from '@/lib/billing/documents';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail?: unknown) {
  if (cond) pass++; else { fail++; console.error(`✗ ${name}${detail === undefined ? '' : `\n   ${JSON.stringify(detail)}`}`); }
}

const PDF = 'application/pdf';

// ── 1. Ποιο αρχείο διαβάζεται στη συσκευή ────────────────────────────────
ok('PDF μικρό: διαβάζεται', shouldSniff({ type: PDF, name: 'e9.pdf', size: 120_000 }));
ok('PDF χωρίς τύπο, με κατάληξη: διαβάζεται', shouldSniff({ type: '', name: 'E9.PDF', size: 120_000 }));
ok('PDF στο όριο: όχι', !shouldSniff({ type: PDF, name: 'e9.pdf', size: SNIFF_MAX_BYTES }));
ok('PDF πάνω από το όριο: όχι', !shouldSniff({ type: PDF, name: 'scan.pdf', size: 9 * 1024 * 1024 }));
ok('κενό αρχείο: όχι', !shouldSniff({ type: PDF, name: 'e9.pdf', size: 0 }));
ok('φωτογραφία: όχι', !shouldSniff({ type: 'image/jpeg', name: 'e9.jpg', size: 120_000 }));
ok('το όριο είναι περίπου 5 MB', SNIFF_MAX_BYTES === 5 * 1024 * 1024);

// ── 2. Πού πάει μετά την ανάγνωση ─────────────────────────────────────────
ok('Ε9 σε PDF: μαζική', scanRoute('e9', PDF) === 'bulk');
ok('πράξη ΕΝΦΙΑ σε PDF: μαζική', scanRoute('enfia_act', PDF) === 'bulk');
ok('PDF χωρίς τύπο, με κατάληξη: μαζική', scanRoute('e9', '', 'e9.pdf') === 'bulk');
ok('άγνωστο PDF: σάρωση', scanRoute('unknown', PDF) === 'scan');
ok('PDF που δεν διαβάστηκε: σάρωση', scanRoute(null, PDF) === 'scan');
ok('φωτογραφία, ακόμη κι αν κάτι είπε Ε9: σάρωση', scanRoute('e9', 'image/png', 'e9.png') === 'scan');

// Από τις γραμμές ως τη δρομολόγηση: η ίδια κεφαλίδα με τον αναλυτή της μαζικής.
{
  const e9 = fakeE9Lines([{ n: 1, floor: '1', sqm: '50,00', built: '2000' }, { n: 2, floor: '2', sqm: '60,00', built: '2001' }]);
  ok('συνθετικό Ε9 → μαζική', scanRoute(detectDocKind(e9), PDF) === 'bulk');
  const act = ['ΑΝΕΞΑΡΤΗΤΗ ΑΡΧΗ ΔΗΜΟΣΙΩΝ ΕΣΟΔΩΝ', 'ΠΡΑΞΗ ΔΙΟΙΚΗΤΙΚΟΥ ΠΡΟΣΔΙΟΡΙΣΜΟΥ ΦΟΡΟΥ', 'ΕΝΙΑΙΟΣ ΦΟΡΟΣ ΙΔΙΟΚΤΗΣΙΑΣ ΑΚΙΝΗΤΩΝ (ΕΝΦΙΑ)'];
  ok('συνθετική κεφαλίδα πράξης → μαζική', scanRoute(detectDocKind(act), PDF) === 'bulk');
  ok('λογαριασμός ρεύματος → σάρωση', scanRoute(detectDocKind(['Λογαριασμός ρεύματος', 'Αριθμός παροχής']), PDF) === 'scan');
}

// ── 3. Η κάρτα του βήματος ελέγχου (φωτογραφία ή PDF που πέρασε από τη σάρωση) ──
ok('Ε9 της σάρωσης: προτείνει μαζική', offersBulk('e9'));
ok('ΕΝΦΙΑ της σάρωσης: προτείνει μαζική', offersBulk('enfia'));
ok('λογαριασμός: όχι', !offersBulk('bill') && !offersBulk(undefined) && !offersBulk(null));
ok('η σάρωση δεν έχει είδος «enfia_act»', !offersBulk('enfia_act'));
ok('χωρίς γραμμές', bulkOfferTitle(0, SCAN_MAX_LINES) === 'Το έγγραφο έχει τα ακίνητά σου');
ok('ένα ακίνητο', bulkOfferTitle(1, SCAN_MAX_LINES) === 'Βρέθηκε 1 ακίνητο');
ok('τρία ακίνητα', bulkOfferTitle(3, SCAN_MAX_LINES) === 'Βρέθηκαν 3 ακίνητα');
ok('στο όριο της σάρωσης: «τουλάχιστον»', bulkOfferTitle(SCAN_MAX_LINES, SCAN_MAX_LINES) === `Βρέθηκαν τουλάχιστον ${SCAN_MAX_LINES} ακίνητα`);
ok('κουμπί: όλα', bulkOfferAction(3) === 'Καταχώρησε όλα' && bulkOfferAction(0) === 'Καταχώρησε όλα');
ok('κουμπί: ένα', bulkOfferAction(1) === 'Μαζική καταχώρηση');

// ── 4. Η ανάγνωση στη συσκευή δεν σταματά ποτέ τη σάρωση ─────────────────
void (async () => {
  const notPdf = new File(['όχι PDF'], 'fake.pdf', { type: PDF });
  const k = await sniffMyaadeKind(notPdf);
  ok('αρχείο που δεν είναι PDF: «δεν ξέρουμε», όχι σφάλμα', k === null, k);
  ok('και η σάρωση συνεχίζει', scanRoute(k, PDF) === 'scan');
  console.log(`σάρωση → μαζική: ${pass} ✓ · ${fail} ✗`);
  if (fail) process.exit(1);
})();
