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
ok('η σάρωση αναγνωρίζει Ε9 και ΕΝΦΙΑ ως πηγή μαζικής', scan.includes("kind === 'e9' || kind === 'enfia'"));
ok('η οθόνη επιτυχίας δίνει «Καταχώρησε όλα τα ακίνητα»', scan.includes('onClick={() => onBulkImport(file)}>Καταχώρησε όλα τα ακίνητα'));
ok('η σελίδα περνά το αρχείο της σάρωσης στην εισαγωγή', /onBulkImport=\{\(file\)=>\{ closeQuickAdd\(\); openMyaade\(file\); \}\}/.test(page));
ok('η εισαγωγή δέχεται έτοιμο αρχείο', /initialFile=\{myaadeFile \?\? undefined\}/.test(page) && importer.includes('initialFile?: File;'));
ok('το έτοιμο αρχείο διαβάζεται αφού φορτωθούν τα ακίνητα', importer.includes('known === null || left === 0) return;'));
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

console.log(`μαζική καταχώρηση, σημεία εισόδου: ${pass} ✓ · ${fail} ✗`);
if (fail) process.exit(1);
