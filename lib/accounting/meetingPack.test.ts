// npx tsx lib/accounting/meetingPack.test.ts
//
// Ο φάκελος της συνάντησης: ένα ΑΦΜ, ένα έτος. Ελέγχεται ότι το «Τι λείπει»
// λέγεται μία φορά με τα απαραίτητα πρώτα, ότι η σύνοψη λέει τα σωστά σύνολα,
// ότι τα αρχεία έχουν τα ονόματα και τη σειρά τους και ότι το βιβλίο ελέγχου
// έχει τα φύλλα του, με αριθμούς ως αριθμούς και ζωντανά σύνολα.
import { unzipSync, strFromU8 } from 'fflate';
import XLSX from 'xlsx-js-style';
import {
  missingItems, packTotals, aadeStatusLine, packEntries, coverModel, folderName, PACK_FILES,
  type MeetingPackInput, type PackProperty,
} from './meetingPack';
import { buildZip } from './zip';
import { reconcilePrefilled, type AppLeaseLine } from '@/lib/billing/e2Reconcile';
import type { AadeE2Row } from '@/lib/tax/aadeE2';
import { buildReviewWorkbook } from '@/app/dashboard/components/meetingPackExport';
import { workbookBytes } from '@/app/dashboard/components/xlsxStyle';
import { buildDocDefinition } from '@/lib/pdf/pdfReport';

let pass = 0, fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++; else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}
function ok(name: string, cond: boolean) { if (cond) pass++; else { fail++; console.error(`✗ ${name}`); } }

const prop = (o: Partial<PackProperty> = {}): PackProperty => ({
  id: 'p1', name: 'Πατησίων', address: 'Πατησίων 10, 10434', atak: '01234567890', category: 'Διαμέρισμα',
  ownershipPct: 100, yearStatus: 'Εκμίσθωση', months: 12, gross: 7200, unpaid: 0, servicesExcluded: 0,
  flags: [], tenantWithoutAfm: false, papers: 2, shortTerm: null, ...o,
});
const app = (o: Partial<AppLeaseLine> = {}): AppLeaseLine => ({
  key: 'p1:0', propertyId: 'p1', propertyName: 'Πατησίων', atak: '01234567890', tenantName: 'Α', tenantAfm: '123456783',
  months: 12, monthly: 600, ownershipPct: 100, gross: 7200, incomeColumn: 13, from: '2025-01-01', to: '2025-12-31',
  monthsFromRecords: true, estimated: false, shortTerm: false, declRef: null, ...o,
});
const aade = (o: Partial<AadeE2Row> = {}): AadeE2Row => ({
  rowNo: 1, atak: '01234567890', address: null, category: null, tenantName: null, tenantAfm: '123456783',
  from: null, to: null, months: 12, monthlyRent: 600, ownershipPct: 100, gross: 7200, incomeColumn: 13, leaseDeclRef: null, ...o,
});

const airbnb = prop({
  id: 'p2', name: 'Χανιά', atak: null, category: 'Διαμέρισμα', yearStatus: 'Βραχυχρόνια μίσθωση', months: 7, gross: 9350,
  shortTerm: { ama: null, stays: 31, nights: 142, gross: 9350, platformFees: 1402.5, levyDue: 568, levyCollected: 520, staysWithoutFee: 3 },
});
const input = (o: Partial<MeetingPackInput> = {}): MeetingPackInput => ({
  year: 2025, ownerAfm: '094014201', ownerName: 'Γεώργιος Παπαδόπουλος',
  properties: [prop({ unpaid: 600 }), airbnb],
  reconciliation: reconcilePrefilled(
    [app(), app({ key: 'p2:0', propertyId: 'p2', propertyName: 'Χανιά', atak: null, tenantAfm: null, tenantName: null, months: 7, gross: 9350, shortTerm: true })],
    [aade({ gross: 6900 }), aade({ atak: '01234567893', tenantAfm: null, months: 7, gross: 9350 })],
  ),
  aade: { uploadedAt: '2026-03-10T10:00:00Z', by: 'accountant', source: 'pdf' },
  requirements: [
    { title: 'Βεβαίωση τόκων δανείου', who: 'Ο ιδιοκτήτης', source: 'Τράπεζα', blocking: false },
    { title: 'Εκκαθαριστικό ΕΝΦΙΑ', who: 'Ο ιδιοκτήτης', source: 'myAADE', blocking: true },
  ],
  paperNotes: ['Χανιά: Το παραστατικό «Τιμολόγιο» δεν χώρεσε στον φάκελο.'],
  ...o,
});

// ═══ ΤΙ ΛΕΙΠΕΙ ═════════════════════════════════════════════════════════════
{
  const m = missingItems(input());
  const blockingFirst = m.findIndex(x => !x.blocking);
  ok('τα απαραίτητα πρώτα', m.slice(0, blockingFirst).every(x => x.blocking) && m.slice(blockingFirst).every(x => !x.blocking));
  ok('οι διαφορές με την ΑΑΔΕ λέγονται με το πλήθος', m.some(x => /διαφορ/.test(x.what) && x.blocking));
  ok('ΑΤΑΚ που λείπει, για το σωστό ακίνητο', m.some(x => x.what === 'ΑΤΑΚ του ακινήτου' && x.scope === 'Χανιά'));
  ok('ΑΜΑ που λείπει στη βραχυχρόνια', m.some(x => /ΑΜΑ/.test(x.what) && x.scope === 'Χανιά'));
  ok('προμήθεια που λείπει, με το πλήθος', m.some(x => /3 κρατήσεις/.test(x.what)));
  ok('ανείσπρακτα με το ποσό', m.some(x => /600,00€/.test(x.what) && x.scope === 'Πατησίων'));
  ok('ο κατάλογος του λογιστή μπαίνει', m.some(x => x.what === 'Εκκαθαριστικό ΕΝΦΙΑ' && x.blocking));
  ok('και τα χαρτιά που δεν χώρεσαν', m.some(x => /δεν χώρεσε/.test(x.what)));
  const none = missingItems(input({ reconciliation: reconcilePrefilled([app()], []), properties: [prop()], requirements: [], paperNotes: [] }));
  eq('χωρίς προσυμπληρωμένο: λείπει μόνο αυτό', none.map(x => x.what), ['Το προσυμπληρωμένο Ε2 του 2025']);
}

// ═══ ΣΥΝΟΛΑ ΚΑΙ ΚΑΤΑΣΤΑΣΗ ══════════════════════════════════════════════════
{
  const t = packTotals(input().properties);
  eq('σύνολα', [t.properties, t.gross, t.unpaid, t.months, t.shortTermGross, t.nights, t.levyDue, t.levyCollected], [2, 16550, 600, 19, 9350, 142, 568, 520]);
  eq('κατάσταση: διαφορές', aadeStatusLine(input().reconciliation), '3 διαφορές');
  eq('κατάσταση: δεν ανέβηκε', aadeStatusLine(reconcilePrefilled([app()], [])), 'Το προσυμπληρωμένο δεν έχει ανέβει');
  eq('κατάσταση: συμφωνεί', aadeStatusLine(reconcilePrefilled([app()], [aade()])), 'Συμφωνεί στη μία γραμμή');
}

// ═══ Η ΣΥΝΟΨΗ ΣΕ PDF ═══════════════════════════════════════════════════════
{
  const m = coverModel(input(), { id: 'PO-TEST', issuedAt: '2026-03-12T10:00:00Z', verifyUrl: '' });
  ok('ο τίτλος λέει έτος και ΑΦΜ', m.title.includes('2025') && m.title.includes('094014201'));
  const kpis = m.sections.find(s => s.type === 'kpis');
  ok('τα τέσσερα μεγέθη', kpis?.type === 'kpis' && kpis.items.length === 4 && kpis.items[1].value === '16.550,00€');
  const props = m.sections.find(s => s.type === 'table' && s.title === 'Ακίνητα');
  ok('τα ακίνητα με σύνολο', props?.type === 'table' && props.rows.length === 2 && props.result?.[4] === '16.550,00€');
  ok('ο ΑΤΑΚ που λείπει γράφεται «Λείπει»', props?.type === 'table' && props.rows[1][1] === 'Λείπει');
  ok('οι διαφορές με πού διορθώνονται', m.sections.some(s => s.type === 'table' && s.title === 'Διαφορές με το προσυμπληρωμένο'));
  ok('η βραχυχρόνια με ΤΑΚΚ', m.sections.some(s => s.type === 'rows' && s.title === 'Βραχυχρόνια'));
  const dd = buildDocDefinition(m);
  ok('το PDF χτίζεται στο ίδιο σύστημα με τα επίσημα έγγραφα (Α4, υποσέλιδο)', dd.pageSize === 'A4' && typeof dd.footer === 'function');
  // «Όλο το ΑΦΜ» σε μία γραμμή: η στήλη «Για» δεν σπάει.
  const missingTable = m.sections.find(s => s.type === 'table' && s.title === 'Τι λείπει');
  ok('Τι λείπει: η στήλη «Για» σε μία γραμμή', missingTable?.type === 'table' && missingTable.head[1] === 'Για' && !!missingTable.noWrap?.includes(1));
  const ddText = JSON.stringify(dd.content);
  ok('Τι λείπει: το PDF κρατά το noWrap στη στήλη «Για»', /"text":"ΓΙΑ"[^}]*"noWrap":true/.test(ddText));
  // Μία σελίδα: κανένας πίνακας δεν ξεπερνά τις 8 γραμμές και μία για «και άλλα».
  const many = coverModel(input({ properties: Array.from({ length: 14 }, (_, i) => prop({ id: `p${i}`, name: `Ακίνητο ${i + 1}` })) }), { id: 'X', issuedAt: '2026-03-12T10:00:00Z', verifyUrl: '' });
  const t = many.sections.find(s => s.type === 'table' && s.title === 'Ακίνητα');
  ok('δεκατέσσερα ακίνητα: 8 και μία γραμμή «και 6 ακόμη»', t?.type === 'table' && t.rows.length === 9 && /Και 6 ακόμη/.test(t.rows[8][0]));
}

// ═══ ΤΑ ΑΡΧΕΙΑ ΤΟΥ ZIP ═══════════════════════════════════════════════════
{
  const b = (s: string) => new TextEncoder().encode(s);
  const files = packEntries({
    year: 2025, cover: b('pdf'), e2: b('e2'), review: b('review'),
    papers: [
      { property: 'Πατησίων', file: '01 ΔΕΗ.pdf', bytes: b('1') },
      { property: 'Χανιά/Νότια', file: '01 Airbnb.pdf', bytes: b('2') },
      { property: 'Πατησίων', file: '02 Νερό.pdf', bytes: b('3') },
    ],
    original: { name: 'Ε2 2025.pdf', bytes: b('aade') },
  });
  eq('η σειρά των αρχείων', files.map(f => f.path), [
    '00 Σύνοψη.pdf', '01 Ε2 2025.xlsx', '02 Έλεγχος φακέλου.xlsx',
    '03 Παραστατικά/Πατησίων/01 ΔΕΗ.pdf', '03 Παραστατικά/Χανιά Νότια/01 Airbnb.pdf', '03 Παραστατικά/Πατησίων/02 Νερό.pdf',
    '04 ΑΑΔΕ/Ε2 2025.pdf',
  ]);
  eq('το όνομα του zip έχει έτος και ΑΦΜ', PACK_FILES.zip(2025, '094014201'), 'Φάκελος λογιστή 2025 ΑΦΜ 094014201.zip');
  eq('κάθετος σε όνομα ακινήτου δεν γίνεται υποφάκελος', folderName('Χανιά/Νότια'), 'Χανιά Νότια');
  const twins = packEntries({ year: 2025, cover: b(''), e2: b(''), review: b(''), papers: [{ property: 'Α', file: 'x.pdf', bytes: b('1') }, { property: 'Α ', file: 'y.pdf', bytes: b('2') }] });
  ok('δύο ακίνητα με το ίδιο όνομα: δύο φάκελοι', twins.some(f => f.path === '03 Παραστατικά/Α (2)/y.pdf'));
  const unz = unzipSync(buildZip(files));
  ok('το zip ανοίγει και έχει τα αρχεία', strFromU8(unz['04 ΑΑΔΕ/Ε2 2025.pdf']) === 'aade' && strFromU8(unz['03 Παραστατικά/Πατησίων/02 Νερό.pdf']) === '3');
}

// ═══ ΤΟ ΒΙΒΛΙΟ ΕΛΕΓΧΟΥ ═════════════════════════════════════════════════════
{
  const wb = buildReviewWorkbook(input(), new Date('2026-03-12T10:00:00Z'));
  eq('τα φύλλα, με τη σειρά τους', wb.SheetNames, ['Σύνοψη', 'Σύγκριση με ΑΑΔΕ', 'Ανά ακίνητο', 'Βραχυχρόνια', 'Τι λείπει']);
  const noShort = buildReviewWorkbook(input({ properties: [prop()] }));
  ok('χωρίς βραχυχρόνια, χωρίς φύλλο βραχυχρόνιας', !noShort.SheetNames.includes('Βραχυχρόνια'));

  // Ξαναδιαβάζεται από τα bytes, όπως θα το άνοιγε ο λογιστής.
  const back = XLSX.read(workbookBytes(wb), { type: 'array', cellFormula: true, cellNF: true });
  const cells = (name: string) => Object.entries(back.Sheets[name]).filter(([k]) => !k.startsWith('!')) as [string, XLSX.CellObject][];
  const per = cells('Ανά ακίνητο');
  const grossNums = per.filter(([, c]) => c.t === 'n' && c.v === 7200);
  ok('ακαθάριστο ως αριθμός, όχι κείμενο', grossNums.length >= 1);
  ok('με μορφή ευρώ', grossNums.some(([, c]) => /€/.test(String(c.z ?? ''))));
  ok('το σύνολο είναι ζωντανό SUM', per.some(([, c]) => /^SUM\(/.test(String(c.f ?? ''))));
  const totalCell = per.find(([, c]) => /^SUM\(/.test(String(c.f ?? '')) && c.v === 16550);
  ok('και η τιμή του συνόλου είναι σωστή (16.550,00)', !!totalCell);
  const cmp = cells('Σύγκριση με ΑΑΔΕ');
  ok('η σύγκριση λέει πού διορθώνεται', cmp.some(([, c]) => /Διόρθωσε στο myAADE|Διόρθωσε στην εφαρμογή|Έλεγξε με τον λογιστή/.test(String(c.v))));
  ok('η σύγκριση έχει τη διαφορά ως αριθμό', cmp.some(([, c]) => c.t === 'n' && c.v === 300));
  const st = cells('Βραχυχρόνια');
  ok('βραχυχρόνια: νύχτες και ΤΑΚΚ', st.some(([, c]) => c.v === 142) && st.some(([, c]) => c.v === 48));
  const miss = cells('Τι λείπει');
  ok('τι λείπει: το ΕΝΦΙΑ στα απαραίτητα', miss.some(([, c]) => c.v === 'Εκκαθαριστικό ΕΝΦΙΑ'));
  ok('ο τίτλος κάθε φύλλου έχει ΑΦΜ στον υπότιτλο', back.SheetNames.every(n => /094014201/.test(String(back.Sheets[n].A2?.v ?? ''))));
}

console.log(fail === 0 ? `✓ meetingPack: ${pass} έλεγχοι πέρασαν` : `✗ meetingPack: ${fail} απέτυχαν από ${pass + fail}`);
process.exit(fail ? 1 : 0);
