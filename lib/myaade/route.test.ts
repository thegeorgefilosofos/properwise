// npx tsx lib/myaade/route.test.ts
//
// Από τη Σάρωση στη μαζική (12/11/2026): ποιο αρχείο διαβάζεται στη συσκευή,
// πότε πάει κατευθείαν στη μαζική και τι λέει η κάρτα του βήματος ελέγχου.
// ΜΟΝΟ ΣΥΝΘΕΤΙΚΑ ΣΤΟΙΧΕΙΑ (guard-fixture-identities).
import { shouldSniff, scanRoute, offersBulk, bulkOfferTitle, bulkOfferAction, sniffBeforeScan, SNIFF_MAX_BYTES, type SniffResult } from './route';
import { sniffMyaadeKind, sniffMyaade, SNIFF_TIMEOUT_MS } from './sniff';
import { PDF_TIMEOUT_MS } from './readPdf';
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
const PHOTO = { type: 'image/jpeg', name: 'e9.jpg' };
const PDFF = { type: PDF, name: 'e9.pdf' };
ok('Ε9 της σάρωσης σε φωτογραφία: προτείνει μαζική', offersBulk('e9', PHOTO, null));
ok('ΕΝΦΙΑ της σάρωσης σε φωτογραφία: προτείνει μαζική', offersBulk('enfia', PHOTO, null));
ok('λογαριασμός: όχι', !offersBulk('bill', PHOTO, null) && !offersBulk(undefined, PHOTO, null) && !offersBulk(null, PHOTO, null));
ok('η σάρωση δεν έχει είδος «enfia_act»', !offersBulk('enfia_act', PHOTO, null));

// ΤΟ PDF ΠΟΥ Η ΣΥΣΚΕΥΗ ΔΕΝ ΔΙΑΒΑΣΕ ΔΕΝ ΒΓΑΖΕΙ ΚΑΡΤΑ-ΑΔΙΕΞΟΔΟ (έλεγχος PR 547).
// Η μαζική διαβάζει με τον ίδιο αναγνώστη: ό,τι δεν διάβασε η συσκευή δεν θα το
// διάβαζε ούτε εκείνη. Κάρτα μόνο όταν η συσκευή δεν πρόλαβε ή δεν δοκίμασε.
ok('PDF που δεν πρόλαβε: κάρτα', offersBulk('e9', PDFF, 'timeout'));
ok('PDF από 5 MB και πάνω (δεν δοκιμάστηκε): κάρτα', offersBulk('enfia', PDFF, 'skipped'));
ok('PDF όπου ο αναγνώστης δεν φορτώθηκε: κάρτα', offersBulk('e9', PDFF, 'error'));
ok('PDF κλειδωμένο ή σαρωμένο: χωρίς κάρτα', !offersBulk('e9', PDFF, 'unreadable'));
ok('PDF που διαβάστηκε και δεν είναι Ε9 ή πράξη: χωρίς κάρτα', !offersBulk('enfia', PDFF, 'read'));
ok('PDF χωρίς τύπο, με κατάληξη: ίδιος κανόνας', !offersBulk('e9', { type: '', name: 'E9.PDF' }, 'unreadable') && offersBulk('e9', { type: '', name: 'E9.PDF' }, 'timeout'));
ok('PDF χωρίς καμία ανάγνωση (null): χωρίς κάρτα', !offersBulk('e9', PDFF, null));
ok('η φωτογραφία δεν κοιτά την ανάγνωση', offersBulk('e9', PHOTO, 'unreadable'));
ok('χωρίς γραμμές', bulkOfferTitle(0, SCAN_MAX_LINES) === 'Το έγγραφο έχει τα ακίνητά σου');
ok('ένα ακίνητο', bulkOfferTitle(1, SCAN_MAX_LINES) === 'Βρέθηκε 1 ακίνητο');
ok('τρία ακίνητα', bulkOfferTitle(3, SCAN_MAX_LINES) === 'Βρέθηκαν 3 ακίνητα');
ok('στο όριο της σάρωσης: «τουλάχιστον»', bulkOfferTitle(SCAN_MAX_LINES, SCAN_MAX_LINES) === `Βρέθηκαν τουλάχιστον ${SCAN_MAX_LINES} ακίνητα`);
ok('κουμπί: όλα', bulkOfferAction(3) === 'Καταχώρησε όλα' && bulkOfferAction(0) === 'Καταχώρησε όλα');
ok('κουμπί: ένα', bulkOfferAction(1) === 'Μαζική καταχώρηση');

// ── 4. Η ανάγνωση στη συσκευή δεν σταματά ποτέ τη σάρωση ─────────────────
ok('ο χρόνος της ανάγνωσης χωρά το κρύο φόρτωμα και μένει κάτω από του αναγνώστη', SNIFF_TIMEOUT_MS >= 6_000 && SNIFF_TIMEOUT_MS < PDF_TIMEOUT_MS / 2, SNIFF_TIMEOUT_MS);
void (async () => {
  // ΤΟ ΚΟΛΛΗΜΕΝΟ ΠΑΡΑΘΥΡΟ (έλεγχος PR 547). Το chunk δεν κατεβαίνει: η ένδειξη
  // πρέπει να σβήσει και η σάρωση να συνεχίσει. Στον παλιό κώδικα το
  // `setSniffing(false)` δεν έτρεχε ποτέ.
  {
    const busy: boolean[] = [];
    const f = new File(['x'], 'e9.pdf', { type: PDF });
    const r = await sniffBeforeScan(f, () => Promise.reject(new Error('ChunkLoadError: Loading chunk 123 failed')), on => busy.push(on));
    ok('chunk που δεν φορτώνει: η ένδειξη άναψε και έσβησε', JSON.stringify(busy) === '[true,false]', busy);
    ok('chunk που δεν φορτώνει: «error», δηλαδή κανονική σάρωση', r.outcome === 'error', r);
    ok('και η κάρτα της μαζικής μένει διαθέσιμη', offersBulk('e9', PDFF, r.outcome));
  }
  {
    const busy: boolean[] = [];
    const f = new File(['x'], 'e9.pdf', { type: PDF });
    const r = await sniffBeforeScan(f, async () => ({ sniffMyaade: async () => { throw new Error('boom'); } }), on => busy.push(on));
    ok('ο αναγνώστης σκάει: η ένδειξη σβήνει', JSON.stringify(busy) === '[true,false]' && r.outcome === 'error', { busy, r });
  }
  {
    const busy: boolean[] = [];
    const f = new File(['x'], 'e9.pdf', { type: PDF });
    const want: SniffResult = { outcome: 'read', kind: 'e9' };
    const r = await sniffBeforeScan(f, async () => ({ sniffMyaade: async () => want }), on => busy.push(on));
    ok('κανονική ανάγνωση: περνά το αποτέλεσμα και η ένδειξη σβήνει', r === want && JSON.stringify(busy) === '[true,false]', { busy, r });
  }
  // ΣΕΝΑΡΙΟ ΕΡΓΑΤΗ ΠΟΥ ΔΕΝ ΦΟΡΤΩΘΗΚΕ: «error» (δεν ξέρουμε), όχι «unreadable».
  // Ψεύτικος Worker: σκέτο Event χωρίς κανένα μήνυμα πριν, όπως ο περιηγητής.
  {
    const g = globalThis as { Worker?: unknown };
    const real = g.Worker;
    class FailingWorker {
      onmessage: ((ev: { data: unknown }) => void) | null = null;
      onerror: ((ev: Event) => void) | null = null;
      constructor(public crashAfterPage = false) {}
      postMessage() {
        setTimeout(() => {
          if (this.crashAfterPage) this.onmessage?.({ data: { kind: 'page', page: 1, pages: 2 } });
          this.onerror?.(new Event('error'));
        }, 0);
      }
      terminate() {}
    }
    g.Worker = class extends FailingWorker { constructor() { super(false); } };
    const load = await sniffMyaade(new File(['%PDF-1.4'], 'e9.pdf', { type: PDF }));
    ok('σενάριο εργάτη που δεν φορτώθηκε: «error»', load.outcome === 'error', load);
    ok('και η κάρτα της μαζικής μένει', offersBulk('e9', PDFF, load.outcome));
    g.Worker = class extends FailingWorker { constructor() { super(true); } };
    const crash = await sniffMyaade(new File(['%PDF-1.4'], 'e9.pdf', { type: PDF }));
    ok('εργάτης που ξεκίνησε και έσκασε στο αρχείο: «unreadable»', crash.outcome === 'unreadable', crash);
    g.Worker = real;
  }
  {
    const r = await sniffMyaade(new File(['όχι PDF'], 'fake.pdf', { type: PDF }));
    ok('αρχείο που δεν είναι PDF: «unreadable», χωρίς κάρτα', r.outcome === 'unreadable' && !offersBulk('e9', PDFF, r.outcome), r);
  }

  const notPdf = new File(['όχι PDF'], 'fake.pdf', { type: PDF });
  const k = await sniffMyaadeKind(notPdf);
  ok('αρχείο που δεν είναι PDF: «δεν ξέρουμε», όχι σφάλμα', k === null, k);
  ok('και η σάρωση συνεχίζει', scanRoute(k, PDF) === 'scan');
  console.log(`σάρωση → μαζική: ${pass} ✓ · ${fail} ✗`);
  if (fail) process.exit(1);
})();
