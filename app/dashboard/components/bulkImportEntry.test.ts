// ═══════════════════════════════════════════════════════════════════════════
// Η ΜΑΖΙΚΗ ΚΑΤΑΧΩΡΗΣΗ ΑΝΟΙΓΕΙ ΟΠΟΙΑΔΗΠΟΤΕ ΣΤΙΓΜΗ (απόφαση ιδιοκτήτη 10/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Ως τις 09/11 η κάρτα «Όλα τα ακίνητά σου μαζί» στο πρώτο βήμα του «Νέο
// ακίνητο» φαινόταν μόνο με μηδέν ακίνητα (`properties.length === 0` στο
// page.tsx). Όποιος είχε ήδη ένα ακίνητο και ήθελε να περάσει τα υπόλοιπα από
// το Ε9 δεν έβρισκε δρόμο από εκεί. Οι δοκιμές κλειδώνουν κάθε σημείο εισόδου,
// ώστε κανένα να μην ξανακλείσει σιωπηλά.
//
// Τρέξε: npx tsx app/dashboard/components/bulkImportEntry.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MYAADE_OPEN_EVENT, openMyaadeImport, type MyaadeOpenDetail } from './myaadeOpen';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const page = src('app/dashboard/page.tsx');
const wizard = src('app/dashboard/components/AddPropertyWizard.tsx');
const card = src('app/dashboard/components/BulkImportCard.tsx');
const scan = src('app/dashboard/components/DocumentScan.tsx');
const importer = src('app/dashboard/components/MyaadeImport.tsx');
const enfia = src('app/dashboard/components/EnfiaPanel.tsx');
const route = src('lib/myaade/route.ts');
const sniff = src('lib/myaade/sniff.ts');

// ── 1. Ο οδηγός: η κάρτα δεν εξαρτάται από το πλήθος των ακινήτων ─────────
const wizardMount = page.slice(page.indexOf('{showAddModal&&user&&<AddPropertyWizard'), page.indexOf('{editProperty&&user&&<AddPropertyWizard'));
ok('ο οδηγός νέου ακινήτου βρέθηκε στη σελίδα', wizardMount.length > 0);
ok('το onBulkImport δίνεται χωρίς όρο', /onBulkImport=\{\(\)=>/.test(wizardMount));
ok('το onBulkImport δεν εξαρτάται από properties.length', !/onBulkImport=\{properties\.length/.test(wizardMount));
ok('ο οδηγός ξέρει αν υπάρχουν ήδη ακίνητα', /hasProperties=\{properties\.length > 0\}/.test(wizardMount));
const editMount = page.slice(page.indexOf('{editProperty&&user&&<AddPropertyWizard'));
ok('η επεξεργασία ακινήτου δεν παίρνει μαζική καταχώρηση', !/onBulkImport/.test(editMount.slice(0, editMount.indexOf('/>}'))));
ok('στον οδηγό η κάρτα κρύβεται στην επεξεργασία', wizard.includes('{!isEdit && onBulkImport && <BulkImportCard'));

// ── 2. Η κάρτα λέει μόνο ό,τι κάνει η εισαγωγή ─────────────────────────────
ok('με ακίνητα, η κάρτα λέει πώς τα βρίσκει', card.includes('Όσα έχεις ήδη τα ψάχνουμε με τον ΑΤΑΚ ή τη διεύθυνση'));
ok('η κάρτα δεν υπόσχεται «ποτέ διπλό»', !/δεν διπλασιάζ|ποτέ δύο φορές|μη γραφτούν δύο φορές/.test(card));

// ── 3. Ctrl+K: ενέργεια χωρίς έλεγχο ορίου ──────────────────────────────────
const bulkCmd = page.match(/\{ id: 'act-bulk'[^\n]*\n/)?.[0] ?? '';
ok('η παλέτα έχει «Μαζική καταχώρηση από Ε9 ή ΕΝΦΙΑ»', bulkCmd.includes("label: 'Μαζική καταχώρηση από Ε9 ή ΕΝΦΙΑ'"));
ok('η ενέργεια ανοίγει την εισαγωγή, όχι τον οδηγό με όριο', bulkCmd.includes('openMyaade()') && !bulkCmd.includes('tryAddProperty'));

// ── 4. Η σάρωση: Ε9 και ΕΝΦΙΑ συνεχίζουν στη μαζική, με το ίδιο αρχείο ────
ok('η σάρωση αναγνωρίζει Ε9 και ΕΝΦΙΑ ως πηγή μαζικής', route.includes("scanKind === 'e9' || scanKind === 'enfia'") && scan.includes('offersBulk(kindOf(edited)?.value) && onBulkImport'));
ok('η οθόνη επιτυχίας δίνει «Καταχώρησε όλα τα ακίνητα»', scan.includes('onClick={() => onBulkImport(file)}>Καταχώρησε όλα τα ακίνητα'));
ok('η σελίδα περνά το αρχείο της σάρωσης στην εισαγωγή', /onBulkImport=\{\(file\)=>\{ closeQuickAdd\(\); openMyaade\(file\); \}\}/.test(page));
ok('η εισαγωγή δέχεται έτοιμο αρχείο', /initialFile=\{myaadeFile \?\? undefined\}/.test(page) && importer.includes('initialFile?: File;'));
ok('το έτοιμο αρχείο διαβάζεται αφού φορτωθούν τα ακίνητα', importer.includes('known === null || loadFailed || left === 0) return;'));
ok('το έτοιμο αρχείο διαβάζεται μία φορά', importer.includes('fileTaken.current = true;'));

// ── 5. Το γεγονός: μόνο πραγματικό αρχείο, ποτέ το γεγονός του κλικ ────────
ok('η καρτέλα ΕΝΦΙΑ δεν περνά το κλικ ως αρχείο', enfia.includes('onClick={() => openMyaadeImport()}') && !enfia.includes('onClick={openMyaadeImport}'));
{
  const seen: MyaadeOpenDetail[] = [];
  const target = new EventTarget();
  (globalThis as unknown as { window: EventTarget }).window = target;
  target.addEventListener(MYAADE_OPEN_EVENT, e => { seen.push((e as CustomEvent<MyaadeOpenDetail>).detail); });
  openMyaadeImport();
  // Ό,τι δεν είναι File (π.χ. MouseEvent από onClick={openMyaadeImport}) πέφτει.
  openMyaadeImport({ type: 'click' } as unknown as File);
  const f = new File(['x'], 'e9.pdf', { type: 'application/pdf' });
  openMyaadeImport(f);
  ok('χωρίς αρχείο: κενό detail', seen[0] !== undefined && seen[0].file === undefined);
  ok('μη αρχείο: πέφτει', seen[1] !== undefined && seen[1].file === undefined);
  ok('με αρχείο: το ίδιο αρχείο', seen[2]?.file === f);
}

// ── 6. Η σελίδα ακούει το αρχείο από το γεγονός ────────────────────────────
ok('ο ακροατής κρατά το αρχείο του γεγονότος', page.includes('(e as CustomEvent<MyaadeOpenDetail>).detail?.file ?? null'));
ok('το κλείσιμο καθαρίζει το αρχείο', /const closeMyaade = \(\) => \{ setMyaadeOpen\(false\); setMyaadeFile\(null\); \};/.test(page));

// ── 7. Χωρίς τη λίστα των υπαρχόντων δεν διαβάζεται αρχείο (έλεγχος 10/11/2026) ──
{
  const imp = readFileSync('app/dashboard/components/MyaadeImport.tsx', 'utf8');
  ok('η αποτυχία φόρτωσης σημειώνεται', imp.includes('setLoadFailed(true); setKnown([]);'));
  ok('το αρχείο της σάρωσης περιμένει τη λίστα', /fileTaken\.current \|\| known === null \|\| loadFailed \|\| left === 0\) return;/.test(imp));
  ok('ούτε αρχείο του χρήστη μετά την αποτυχία', imp.includes('disabled={known === null || loadFailed}'));
}

// ── 8. Η Σάρωση κρίνει Ε9/ΕΝΦΙΑ ΠΡΙΝ από το AI (12/11/2026) ──────────────────
{
  const load = scan.slice(scan.indexOf('const loadFile = useCallback('), scan.indexOf('// Στρίψιμο null/undefined'));
  ok('η loadFile βρέθηκε', load.length > 0);
  const sniffAt = load.indexOf("await import('@/lib/myaade/sniff')");
  const aiAt = load.indexOf('await scanDocument(f)');
  ok('το PDF διαβάζεται στη συσκευή ΠΡΙΝ από το scanDocument', sniffAt > 0 && aiAt > sniffAt);
  ok('μόνο PDF κάτω από το όριο', load.includes('shouldSniff(f)'));
  ok('Ε9/πράξη: κατευθείαν στη μαζική και επιστροφή χωρίς AI', /if \(scanRoute\(found, f\.type, f\.name\) === 'bulk'\) \{ onBulkImport\(f\); return; \}/.test(load));
  ok('ο αναγνώστης PDF φορτώνεται δυναμικά', !/^import .*lib\/myaade\/(sniff|readPdf|detect)/m.test(scan));
  ok('ο αναγνώστης κρίνει με την κεφαλίδα της μαζικής', sniff.includes('detectDocKind(res.lines)') && sniff.includes('readPdfText('));

  // Η μαζική από τη Σάρωση δεν αρχειοθετεί (απόφαση ιδιοκτήτη 12/11/2026).
  const sniffBranch = load.slice(sniffAt, aiAt);
  ok('ο δρόμος του PDF δεν αρχειοθετεί', !sniffBranch.includes('archiveScannedFile') && !sniffBranch.includes('commitScannedDoc'));
  const calls = scan.split('archiveScannedFile(').length - 1;
  ok('το archiveScannedFile καλείται σε ΕΝΑ σημείο', calls === 1);
  const copy = scan.slice(scan.indexOf('const archiveCopy = async'), scan.indexOf('const handToBulk = async'));
  ok('και αυτό είναι το αντίγραφο κατ\' επιλογή', copy.includes('archiveScannedFile('));
  const hand = scan.slice(scan.indexOf('const handToBulk = async'), scan.indexOf('const reset = () =>'));
  ok('το αντίγραφο μόνο με τον διακόπτη', /if \(keepCopy\) \{[\s\S]*archiveCopy\(\)/.test(hand) && !hand.includes('archiveScannedFile'));
  ok('ο διακόπτης κλειστός εξ ορισμού', scan.includes('const [keepCopy, setKeepCopy] = useState(false);'));
  ok('ο διακόπτης κλείνει σε κάθε νέο αρχείο', load.includes('setKeepCopy(false)'));
  ok('το αντίγραφο δεν γράφει δεύτερο σύνολο ΕΝΦΙΑ', !copy.includes('statement_total') && !copy.includes('...plan'));

  // Η κάρτα στο βήμα ελέγχου, πριν από την καταχώρηση.
  const card = scan.indexOf('{offersBulk(kind?.value) && onBulkImport && (');
  const formStart = scan.indexOf('{/* ── Α. Τι είναι και πού μπαίνει ── */}');
  ok('η κάρτα της μαζικής εμφανίζεται στο βήμα ελέγχου, πάνω από τη φόρμα', card > 0 && formStart > card);
  ok('η κάρτα λέει πόσα βρέθηκαν', scan.includes('bulkOfferTitle(edited.lines?.length ?? 0, SCAN_MAX_LINES)'));
  ok('η κάρτα έχει «Κράτα αντίγραφο στον Φάκελο»', scan.includes('label="Κράτα αντίγραφο στον Φάκελο"'));

  // Το τέταρτο πλακίδιο και η σάρωση χωρίς ακίνητο.
  ok('πλακίδιο «Πολλά ακίνητα από Ε9 ή ΕΝΦΙΑ»', scan.includes('>Πολλά ακίνητα από Ε9 ή ΕΝΦΙΑ</div>'));
  ok('το πλακίδιο ανοίγει τη μαζική χωρίς αρχείο', scan.includes('const openBulk = useCallback(() => onBulkImport?.(null), [onBulkImport]);'));
  ok('χωρίς ακίνητο, μόνο η μαζική', scan.includes('const bulkOnly = !propertyId && !!onBulkImport;') && scan.includes('{!bulkOnly && <>'));
  ok('η σελίδα ανοίγει τη σάρωση και χωρίς ακίνητο', page.includes('<Modal open={!!(quickAddOpen&&user&&(selected||scanNoProperty))}'));
  ok('μόνο με μετρημένα άδεια λίστα', page.includes('const scanNoProperty = !selected && !loading && !loadError && properties.length === 0;'));
  ok('η σάρωση παίρνει null αντί για ακίνητο', page.includes('propertyId={selected?.id ?? null}'));
}

console.log(`μαζική καταχώρηση, σημεία εισόδου: ${pass} ✓ · ${fail} ✗`);
if (fail) process.exit(1);
