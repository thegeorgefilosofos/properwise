// Τεστ για το κοινό όνομα και το δέντρο φακέλων του Αρχείου.
import {
  archiveFileName, archiveFolder, cleanProvider, kindOfShelf, kindOfText, amountPart, extOf, firstDate, nameDateOf,
  providerNames, resolveProvider, uniqueNames, defaultProvider, BILL_KIND, KINDS,
} from './naming'
import { folderTree, NO_PROVIDER, NO_YEAR, PHOTOS, type TreeInput } from './tree'
import { ARCHIVE_CATEGORIES } from '../billing/documents'
import { EXPENSE_MAP } from '../billing/parse'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) { if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) } }
const eq = (name: string, got: unknown, want: unknown) => ok(`${name}: «${String(got)}» αντί «${String(want)}»`, got === want)
const KIND_SET = new Set<string>(KINDS)

// ── Το είδος: μόνο από το λεξιλόγιο ─────────────────────────────────────
ok('κάθε ράφι δίνει είδος του λεξιλογίου', ARCHIVE_CATEGORIES.every(c => KIND_SET.has(kindOfShelf(c))))
ok('κάθε κλειδί λογαριασμού δίνει είδος του λεξιλογίου', Object.values(BILL_KIND).every(k => KIND_SET.has(k)))
ok('κάθε κατηγορία δαπάνης δίνει είδος του λεξιλογίου',
  Object.values(EXPENSE_MAP).every(e => KIND_SET.has(kindOfText(e.cat))) && Object.keys(EXPENSE_MAP).every(k => KIND_SET.has(kindOfText(k))))
eq('ελεύθερο κείμενο δεν γίνεται είδος', kindOfText('Κάτι που έγραψε ο χρήστης'), 'Λοιπά')
eq('άγνωστο ράφι: Έγγραφο', kindOfShelf('Κάτι άλλο'), 'Έγγραφο')
eq('ασανσέρ: ράφι, δαπάνη και λογαριασμός λένε το ίδιο', [kindOfShelf('Συντήρηση Ανελκυστήρα'), kindOfText('Συντήρηση Ασανσέρ'), BILL_KIND.elevator].join('|'), 'Συντήρηση ασανσέρ|Συντήρηση ασανσέρ|Συντήρηση ασανσέρ')
eq('ρεύμα: ράφι, δαπάνη και λογαριασμός λένε το ίδιο', [kindOfShelf('Λογαριασμός Ρεύματος'), kindOfText('Ρεύμα'), BILL_KIND.electricity].join('|'), 'Ρεύμα|Ρεύμα|Ρεύμα')
eq('υδραυλικός από τη σάρωση', kindOfText('plumber'), 'Υδραυλικός')
eq('ηλεκτρολόγος από τη δαπάνη', kindOfText('Ηλεκτρολόγος'), 'Ηλεκτρολόγος')
eq('Ε9 από τον τίτλο', kindOfShelf('ΕΝΦΙΑ / Φορολογικά', 'Δήλωση στοιχείων ακινήτων Ε9 2026'), 'Ε9')
eq('Ε1 με λατινικό E', kindOfShelf('ΕΝΦΙΑ / Φορολογικά', 'Δήλωση E1 2025'), 'Ε1')
eq('Ε2', kindOfShelf('ΕΝΦΙΑ / Φορολογικά', 'Αναλυτική κατάσταση μισθωμάτων (Ε2)'), 'Ε2')
eq('ΕΝΦΙΑ', kindOfShelf('ΕΝΦΙΑ / Φορολογικά', 'Πράξη προσδιορισμού ΕΝΦΙΑ 2026'), 'ΕΝΦΙΑ')
eq('εκκαθαριστικό', kindOfShelf('ΕΝΦΙΑ / Φορολογικά', 'Εκκαθαριστικό σημείωμα 2025'), 'Εκκαθαριστικό φόρου')
eq('φορολογικό χωρίς έντυπο', kindOfShelf('ΕΝΦΙΑ / Φορολογικά', 'Βεβαίωση οφειλής'), 'Φορολογικά')
eq('προμήθεια πλατφόρμας', kindOfShelf('Άλλο Έγγραφο', 'Service fee invoice', 'Airbnb Ireland UC'), 'Προμήθεια πλατφόρμας')
eq('η απόδοση της πλατφόρμας μένει είσπραξη', kindOfShelf('Είσπραξη ενοικίου', 'Payout', 'Airbnb'), 'Είσπραξη ενοικίου')
eq('παλιό κλειδί contract', kindOfShelf('contract'), 'Μισθωτήριο')
eq('παλιό κλειδί tax με ΕΝΦΙΑ', kindOfShelf('tax', 'Εκκαθαριστικό ΕΝΦΙΑ'), 'ΕΝΦΙΑ')

// ── Ο πάροχος: ο ίδιος πάντα με το ίδιο όνομα ──────────────────────────
for (const v of ['ΔΕΗ', 'ΔΕΗ Α.Ε.', 'Δεη ΑΕ', 'ΔΗΜΟΣΙΑ ΕΠΙΧΕΙΡΗΣΗ ΗΛΕΚΤΡΙΣΜΟΥ Α.Ε.', 'Δημόσια Επιχείρηση Ηλεκτρισμού'])
  eq(`«${v}» → ΔΕΗ`, cleanProvider(v), 'ΔΕΗ')
for (const v of ['Airbnb', 'Airbnb Ireland UC', 'AIRBNB IRELAND UNLIMITED COMPANY'])
  eq(`«${v}» → Airbnb`, cleanProvider(v), 'Airbnb')
for (const v of ['Booking.com B.V.', 'Booking.com', 'BOOKING.COM BV'])
  eq(`«${v}» → Booking.com`, cleanProvider(v), 'Booking.com')
eq('ΕΥΔΑΠ με ολόκληρη την επωνυμία', cleanProvider('ΕΤΑΙΡΕΙΑ ΥΔΡΕΥΣΗΣ ΚΑΙ ΑΠΟΧΕΤΕΥΣΗΣ ΠΡΩΤΕΥΟΥΣΑΣ Α.Ε.'), 'ΕΥΔΑΠ')
eq('νομική μορφή στο τέλος', cleanProvider('Κωνσταντίνου Ανελκυστήρες Ι.Κ.Ε.'), 'Κωνσταντίνου Ανελκυστήρες')
eq('εσωτερική ετικέτα μισθωτή', cleanProvider('tenant:4f1c9a'), null)
eq('κενός πάροχος', cleanProvider(''), null)
{
  // Το ίδιο ΑΦΜ με τρεις γραφές: ένα όνομα, το πιο συχνό.
  const names = providerNames([
    { provider: 'Υδραυλικές Εργασίες Παπαδόπουλος', afm: '123456783', createdAt: '2026-01-01' },
    { provider: 'ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ', afm: '123456783', createdAt: '2026-02-01' },
    { provider: 'Υδραυλικές Εργασίες Παπαδόπουλος', afm: '123 456 783', createdAt: '2026-03-01' },
  ])
  eq('ίδιο ΑΦΜ, ίδιο όνομα', resolveProvider(names, 'ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ', '123456783'), 'Υδραυλικές Εργασίες Παπαδόπουλος')
  eq('χωρίς ΑΦΜ: καθάρισμα', resolveProvider(names, 'ΔΕΗ Α.Ε.', null), 'ΔΕΗ')
  eq('ισοπαλία: το πρώτο που καταχωρήθηκε', resolveProvider(providerNames([
    { provider: 'Β Όνομα', afm: '111111114', createdAt: '2026-05-01' },
    { provider: 'Α Όνομα', afm: '111111114', createdAt: '2026-01-01' },
  ]), 'Β Όνομα', '111111114'), 'Α Όνομα')
}

{
  // ΛΑΘΟΣ ΑΦΜ ΑΠΟ ΤΗ ΣΑΡΩΣΗ ΔΕΝ ΕΝΩΝΕΙ. Με άκυρο ψηφίο ελέγχου κάθε χαρτί κρατά
  // το δικό του όνομα· η ΔΕΗ δεν πάει στον φάκελο της ασφαλιστικής.
  const bad = providerNames([
    { provider: 'ΔΕΗ', afm: '099123456', createdAt: '2026-01-01' },
    { provider: 'Ασφάλειες Ελλάς', afm: '099123456', createdAt: '2026-01-02' },
    { provider: 'Ασφάλειες Ελλάς', afm: '099123456', createdAt: '2026-01-03' },
  ])
  eq('άκυρο ΑΦΜ: η ΔΕΗ μένει ΔΕΗ', resolveProvider(bad, 'ΔΕΗ', '099123456'), 'ΔΕΗ')
  // ΕΓΚΥΡΟ ΑΦΜ ΑΛΛΑ ΣΥΓΚΡΟΥΣΗ: γνωστή επωνυμία δίπλα σε άλλο όνομα σημαίνει
  // ότι κάτι διαβάστηκε λάθος. Το ΑΦΜ τότε δεν ενώνει.
  const clash = providerNames([
    { provider: 'ΔΕΗ Α.Ε.', afm: '222222228', createdAt: '2026-01-01' },
    { provider: 'Ασφάλειες Ελλάς', afm: '222222228', createdAt: '2026-01-02' },
    { provider: 'Ασφάλειες Ελλάς', afm: '222222228', createdAt: '2026-01-03' },
  ])
  eq('σύγκρουση: η ΔΕΗ μένει ΔΕΗ', resolveProvider(clash, 'ΔΕΗ Α.Ε.', '222222228'), 'ΔΕΗ')
  eq('σύγκρουση: η ασφαλιστική μένει ασφαλιστική', resolveProvider(clash, 'Ασφάλειες Ελλάς', '222222228'), 'Ασφάλειες Ελλάς')
  // Δύο γραφές της ίδιας επωνυμίας δεν είναι σύγκρουση.
  const same = providerNames([
    { provider: 'ΔΗΜΟΣΙΑ ΕΠΙΧΕΙΡΗΣΗ ΗΛΕΚΤΡΙΣΜΟΥ Α.Ε.', afm: '222222228' },
    { provider: 'Δεη', afm: '222222228' },
  ])
  eq('ίδια επωνυμία, δύο γραφές: ένωση', same.get('222222228'), 'ΔΕΗ')
}

// ── Η ΑΑΔΕ ως πάροχος των εντύπων της ──────────────────────────────────
for (const k of ['ΕΝΦΙΑ', 'Ε1', 'Ε2', 'Ε3', 'Ε9', 'Εκκαθαριστικό φόρου']) eq(`${k} χωρίς πάροχο → ΑΑΔΕ`, resolveProvider(new Map(), null, null, k), 'ΑΑΔΕ')
eq('ρεύμα χωρίς πάροχο μένει χωρίς', defaultProvider('Ρεύμα'), null)
eq('ο πάροχος του χαρτιού προηγείται', resolveProvider(new Map(), 'Δήμος Αθηναίων', null, 'ΕΝΦΙΑ'), 'Δήμος Αθηναίων')
// Η ημερομηνία σε δική της γραμμή: το obligations.test ψάχνει όνομα φόρου
// και ημερομηνία στην ίδια γραμμή, για νέα χειρόγραφα ημερολόγια υποχρεώσεων.
const issued = '2026-06-23'
const aadeKind = 'ΕΝΦΙΑ'
eq('ΕΝΦΙΑ με την ΑΑΔΕ στο όνομα', archiveFileName({ kind: aadeKind, provider: resolveProvider(new Map(), null, null, aadeKind), date: issued, amount: 428, ext: 'pdf' }), 'ΕΝΦΙΑ_ΑΑΔΕ_2026_06_428,00.pdf')

// ── Ο μήνας: της περιόδου, του τέλους της ──────────────────────────────
eq('περίοδος σε δύο μήνες: ο μήνας του τέλους', nameDateOf({ period_from: '2026-04-10', period_to: '2026-06-09', issue_date: '2026-06-20' }), '2026-06-09')
eq('χωρίς τέλος: η αρχή', nameDateOf({ period_from: '2026-04-10', issue_date: '2026-06-20' }), '2026-04-10')
eq('χωρίς περίοδο: η έκδοση', nameDateOf({ issue_date: '2026-06-20', doc_date: '2026-07-01' }), '2026-06-20')
eq('μόνο ημερομηνία εγγράφου', nameDateOf({ doc_date: '2026-07-01' }), '2026-07-01')
eq('πρώτη έγκυρη ημερομηνία', firstDate(null, '', '2026-06-30'), '2026-06-30')

// ── Το ποσό ────────────────────────────────────────────────────────────
eq('δύο δεκαδικά, κόμμα', amountPart(84.3), '84,30')
eq('χιλιάδες χωρίς τελεία', amountPart(1250), '1250,00')
eq('από κείμενο της βάσης', amountPart('1234.5'), '1234,50')
eq('αρνητικό', amountPart(-12.5), '12,50')
eq('χωρίς ποσό', amountPart(null), '')
eq('μηδέν: χωρίς ποσό στο όνομα', amountPart(0), '')

// ── Το όνομα ───────────────────────────────────────────────────────────
eq('ΔΕΗ', archiveFileName({ kind: 'Ρεύμα', provider: 'ΔΕΗ Α.Ε.', date: '2026-06-10', amount: 84.3, ext: 'pdf' }), 'Ρεύμα_ΔΕΗ_2026_06_84,30.pdf')
eq('ασανσέρ', archiveFileName({ kind: kindOfShelf('Συντήρηση Ανελκυστήρα'), provider: 'Κωνσταντίνου Ανελκυστήρες Ι.Κ.Ε.', date: '2026-03-02', amount: 62, ext: 'jpg' }),
  'Συντήρηση ασανσέρ_Κωνσταντίνου Ανελκυστήρες_2026_03_62,00.jpg')
eq('Airbnb payout', archiveFileName({ kind: kindOfShelf('Είσπραξη ενοικίου'), provider: 'Airbnb Ireland UC', date: '2026-08-31', amount: 1234.5, ext: 'pdf' }),
  'Είσπραξη ενοικίου_Airbnb_2026_08_1234,50.pdf')
eq('Ε9', archiveFileName({ kind: 'Ε9', provider: 'ΑΑΔΕ', date: '2026-02-15', ext: 'pdf' }), 'Ε9_ΑΑΔΕ_2026_02.pdf')
eq('φωτογραφία', archiveFileName({ kind: 'Κατάσταση Ακινήτου', date: '2026-04-09', ext: 'jpg' }), 'Κατάσταση Ακινήτου_2026_04.jpg')
eq('ελλιπή: μόνο είδος', archiveFileName({ kind: 'Μισθωτήριο', ext: 'pdf' }), 'Μισθωτήριο.pdf')
eq('ελλιπή: χωρίς πάροχο', archiveFileName({ kind: 'Νερό', date: '2026-01-20', amount: 31.4 }), 'Νερό_2026_01_31,40')
eq('κενό είδος', archiveFileName({ kind: '', ext: 'pdf' }), 'Έγγραφο.pdf')
ok('ποτέ διπλή κάτω παύλα', !/__/.test(archiveFileName({ kind: 'Ρεύμα', provider: '  ', amount: 5 })))
ok('κανένας απαγορευμένος χαρακτήρας', !/[\\/:*?"<>|]/.test(archiveFileName({ kind: 'Ρεύμα', provider: 'A/B: "C" <D>|E*?', date: '2026-06-01' })))
eq('η κάτω παύλα του παρόχου δεν σπάει το σχήμα', archiveFileName({ kind: 'Ρεύμα', provider: 'Volt_Energy', date: '2026-06-01' }), 'Ρεύμα_Volt Energy_2026_06')
eq('δύο εκδοχές του ίδιου παρόχου, ένα όνομα',
  archiveFileName({ kind: 'Ρεύμα', provider: 'ΔΗΜΟΣΙΑ ΕΠΙΧΕΙΡΗΣΗ ΗΛΕΚΤΡΙΣΜΟΥ Α.Ε.', date: '2026-06-10', amount: 84.3 }),
  archiveFileName({ kind: 'Ρεύμα', provider: 'ΔΕΗ', date: '2026-06-30', amount: '84.30' }))
eq('κατάληξη από τύπο', extOf('image/jpeg', 'x.png'), 'jpg')
eq('κατάληξη από όνομα', extOf(null, 'Scan 001.JPEG'), 'jpg')
eq('κατάληξη από διεύθυνση', extOf(null, 'https://x/y/z.pdf?token=1'), 'pdf')
eq('φάκελος', archiveFolder('Ρεύμα', 'ΔΕΗ', '2026-06-10').join('/'), 'Ρεύμα/ΔΕΗ/2026')
eq('φάκελος χωρίς στοιχεία', archiveFolder('Μισθωτήριο', null, null).join('/'), `Μισθωτήριο/${NO_PROVIDER}/${NO_YEAR}`)

// ── Διπλότυπα ──────────────────────────────────────────────────────────
{
  const u = uniqueNames([
    { id: 'c', name: 'Ρεύμα_ΔΕΗ_2026_06_84,30.pdf', createdAt: '2026-07-03' },
    { id: 'a', name: 'Ρεύμα_ΔΕΗ_2026_06_84,30.pdf', createdAt: '2026-07-01' },
    { id: 'b', name: 'Ρεύμα_ΔΕΗ_2026_06_84,30.pdf', createdAt: '2026-07-02' },
    { id: 'x', name: 'Νερό_ΕΥΔΑΠ_2026_06.pdf', createdAt: '2026-07-01' },
  ])
  eq('το πρώτο κρατά το όνομα', u.get('a'), 'Ρεύμα_ΔΕΗ_2026_06_84,30.pdf')
  eq('το δεύτερο _2', u.get('b'), 'Ρεύμα_ΔΕΗ_2026_06_84,30_2.pdf')
  eq('το τρίτο _3', u.get('c'), 'Ρεύμα_ΔΕΗ_2026_06_84,30_3.pdf')
  eq('μοναδικό μένει ίδιο', u.get('x'), 'Νερό_ΕΥΔΑΠ_2026_06.pdf')
  const again = uniqueNames([
    { id: 'b', name: 'Ρεύμα_ΔΕΗ_2026_06_84,30.pdf', createdAt: '2026-07-02' },
    { id: 'a', name: 'Ρεύμα_ΔΕΗ_2026_06_84,30.pdf', createdAt: '2026-07-01' },
  ])
  eq('σταθερό ανεξάρτητα από τη σειρά', again.get('b'), 'Ρεύμα_ΔΕΗ_2026_06_84,30_2.pdf')
}

// ── Το δέντρο ──────────────────────────────────────────────────────────
const mk = (p: Partial<TreeInput> & { id: string }): TreeInput => ({ kind: 'Ρεύμα', provider: null, nameDate: null, value: null, ...p })
const items: TreeInput[] = [
  mk({ id: 'd1', provider: 'ΔΕΗ', nameDate: '2026-06-10', value: 84.3 }),
  mk({ id: 'd2', provider: 'ΔΕΗ', nameDate: '2026-04-10', value: 90 }),
  mk({ id: 'd3', provider: 'Δεη', nameDate: '2025-12-10', value: 70 }),
  mk({ id: 'p1', provider: 'Protergia', nameDate: '2026-02-01', value: 50 }),
  mk({ id: 'n1', provider: null, nameDate: null, value: null }),
  mk({ id: 'w1', kind: 'Νερό', provider: 'ΕΥΔΑΠ', nameDate: '2026-03-01', value: 31.4 }),
  mk({ id: 'f1', kind: 'Κατάσταση Ακινήτου', isPhoto: true, nameDate: '2026-04-09' }),
  mk({ id: 'l1', kind: 'Μισθωτήριο', nameDate: '2024-09-01' }),
]
const tree = folderTree(items)
eq('πρώτο επίπεδο, φωτογραφίες τελευταίες', tree.map(n => n.label).join(','), 'Μισθωτήριο,Νερό,Ρεύμα,Φωτογραφίες')
const power = tree.find(n => n.label === 'Ρεύμα')!
eq('πλήθος φακέλου', power.count, 5)
eq('σύνολο φακέλου', power.total, 294.3)
eq('«Χωρίς πάροχο» τελευταίος', power.children[power.children.length - 1].label, NO_PROVIDER)
const dei = power.children.find(n => n.label === 'ΔΕΗ')!
eq('ΔΕΗ και Δεη στον ίδιο υποφάκελο', dei.count, 3)
eq('έτη, πιο πρόσφατο πρώτο', dei.children.map(n => n.label).join(','), '2026,2025')
eq('αρχεία κατά μήνα, πιο πρόσφατο πρώτο', dei.children[0].items.map(i => i.id).join(','), 'd1,d2')
eq('σύνολο έτους', dei.children[0].total, 174.3)
const none = power.children.find(n => n.label === NO_PROVIDER)!
eq('χωρίς ημερομηνία', none.children[0].label, NO_YEAR)
eq('χωρίς ποσό: σύνολο null', none.total, null)
eq('φωτογραφίες: κατηγορία ως υποφάκελος', tree.find(n => n.label === PHOTOS)!.children[0].label, 'Κατάσταση Ακινήτου')
ok('κλειδιά μοναδικά', (() => { const ks: string[] = []; const walk = (ns: typeof tree) => ns.forEach(n => { ks.push(n.key); walk(n.children) }); walk(tree); return new Set(ks).size === ks.length })())
eq('άδειο σύνολο, άδειο δέντρο', folderTree([]).length, 0)

console.log(`archive/naming+tree: ${passed} ✓ · ${failed} ✗`)
if (failed) process.exit(1)
