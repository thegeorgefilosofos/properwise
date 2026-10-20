// ─────────────────────────────────────────────────────────────────────────────
// Καθολική αναγνώριση & δρομολόγηση εγγράφων (universal document routing)
//
// Ο χρήστης φωτογραφίζει ΟΤΙΔΗΠΟΤΕ: λογαριασμό, απόδειξη πληρωμής, μισθωτήριο,
// τίτλο ιδιοκτησίας/συμβόλαιο, ασφαλιστήριο, ΕΝΦΙΑ/φορολογικό, κρατικό έγγραφο.
// Το AI εξάγει πεδία· ΕΔΩ (καθαρή, δοκιμασμένη λογική) αποφασίζουμε:
//   1) τι είδος εγγράφου είναι  → classifyDocType() + classifySubtype()
//   2) ποια πεδία ζητά η φόρμα   → DOC_KINDS + docForm()
//   3) αν λείπουν βασικά πεδία   → validateDoc()
//   4) πού γράφεται στη βάση     → planDocSave()  (ποιοι πίνακες/tabs ενημερώνονται)
//
// Η μονάδα ΔΕΝ αγγίζει Supabase: επιστρέφει «σχέδιο» (SavePlan) με payloads χωρίς
// ids· το component το εκτελεί προσθέτοντας property_id/user_id/bill_id. Έτσι όλη
// η επικίνδυνη λογική (κατηγοριοποίηση/δρομολόγηση) είναι 100% δοκιμάσιμη.
// ─────────────────────────────────────────────────────────────────────────────

import { EXPENSE_MAP, categorizeTransaction, derivePeriod, digitsOnly, isValidAfm } from './parse';
import { navLabel } from '../nav/labels';
import { fe, fn } from '../core/format';
import { atakDigits, isAtak } from '../property/atak';
import { cleanAma, isValidAmaFormat } from '../property/ama';
import { cleanDigits, E2_POWER_SUPPLY_DIGITS } from '../property/powerSupply';
import { PEA_CLASSES, peaClassOf } from '../property/pea';
import { OBJ_VALUE_WHOLE } from '../property/fields';
import { athensToday } from '../core/time';
import type { EventDraft } from '../data/calendar';
import {
  billingPeriod, nextRenewal, reminderDate, providerCountry, docSupply, PERIOD_LABEL, REMINDER_DAYS_BEFORE,
  type BillingPeriod,
} from './invoiceIntel';

/** «2026-08-08» → «08/08/2026». Η ημερομηνία σε σημείωση διαβάζεται από άνθρωπο. */
const greekDay = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

// Ο προορισμός γράφεται ΜΙΑ φορά, από το μητρώο ονομάτων. Ήταν έξι φορές η
// σταθερά «Αρχείο» και όταν η καρτέλα μετονομάστηκε σε «Φάκελος ακινήτου» η
// οθόνη επιβεβαίωσης θα έστελνε τον χρήστη σε όνομα που δεν υπάρχει στο μενού.
const FOLDER = navLabel('documents');
// Οι υπόλοιποι προορισμοί, με το ίδιο κριτήριο: όπου υπάρχει καρτέλα, το όνομά
// της. Ο «Λογαριασμοί» είναι ενότητα των Δαπανών και τα «Στοιχεία ακινήτου»
// η καρτέλα του ίδιου του ακινήτου, οπότε δεν έχουν δική τους γραμμή στο μενού.
const EXPENSES = navLabel('finances');
const CALENDAR = navLabel('calendar');
const TENANTS = navLabel('tenant');
const BILLS = 'Λογαριασμοί';
const COMMON = 'Κοινόχρηστα';
/** Η ετικέτα των στοιχείων του ακινήτου (user_properties και property_settings). */
export const PROPERTY_TARGET = 'Στοιχεία ακινήτου';

export type DocType =
  | 'bill'        // λογαριασμός κοινής ωφέλειας/υπηρεσίας → Λογαριασμοί + Δαπάνες + Ημερολόγιο
  | 'payment'     // απόδειξη/βεβαίωση πληρωμής            → Δαπάνες (πληρωμένο) + συμφωνία λογαριασμού
  | 'lease'       // μισθωτήριο                            → Ενοικιαστής (ενοίκιο, διάρκεια, εγγύηση)
  | 'deed'        // τίτλος ιδιοκτησίας / συμβόλαιο αγοράς  → Στοιχεία ακινήτου + Αρχείο
  | 'insurance'   // ασφαλιστήριο ακινήτου                 → Ασφάλεια ακινήτου + Ημερολόγιο (λήξη)
  | 'tax'         // ΕΝΦΙΑ / Ε9 / φορολογικό               → ΕΝΦΙΑ + Δαπάνες + Ημερολόγιο
  | 'government'  // κρατικό/δημόσιο έγγραφο (ΑΜΑ, πολεοδομία, βεβαιώσεις) → Αρχείο
  | 'other';      // οτιδήποτε άλλο                        → Αρχείο

// Ο ΤΥΠΟΣ ΜΕΝΕΙ ΟΚΤΩ ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΑΠΟΦΑΣΗ. Η Νόα, το ScanButton, το
// TabTenantMoney και τα αποθηκευμένα σχέδια μιλούν με αυτούς τους οκτώ. Η
// λεπτομέρεια (ΕΝΦΙΑ ή Ε9, ΠΕΑ ή ΑΜΑ, είσπραξη ενοικίου) ζει στο `subtype`,
// που οι παλιοί αναγνώστες απλώς αγνοούν.
export interface DocTypeMeta {
  id: DocType;
  label: string;       // ελληνική ονομασία
  hint: string;        // σύντομη περιγραφή για τον χρήστη
}

export const DOC_TYPES: DocTypeMeta[] = [
  { id: 'bill',       label: 'Λογαριασμός',          hint: 'Ρεύμα, νερό, αέριο, internet, κοινόχρηστα, υπηρεσίες' },
  { id: 'payment',    label: 'Απόδειξη πληρωμής',     hint: 'Βεβαίωση/απόδειξη ότι πληρώθηκε κάτι' },
  { id: 'lease',      label: 'Μισθωτήριο',            hint: 'Συμφωνητικό ενοικίασης · ενοίκιο, διάρκεια, εγγύηση' },
  { id: 'deed',       label: 'Τίτλος / Συμβόλαιο',    hint: 'Τίτλος ιδιοκτησίας ή συμβόλαιο αγοράς' },
  { id: 'insurance',  label: 'Ασφαλιστήριο',          hint: 'Ασφάλεια ακινήτου · ασφάλιστρο, λήξη' },
  { id: 'tax',        label: 'Φορολογικό / ΕΝΦΙΑ',     hint: 'ΕΝΦΙΑ, Ε9, δηλώσεις, φόροι ακινήτου' },
  { id: 'government', label: 'Κρατικό έγγραφο',        hint: 'ΑΜΑ, πολεοδομία, βεβαιώσεις, δημόσια έγγραφα' },
  { id: 'other',      label: 'Άλλο έγγραφο',          hint: 'Οτιδήποτε άλλο · αρχειοθετείται με ασφάλεια' },
];

export const DOC_TYPE_LABELS: Record<DocType, string> =
  DOC_TYPES.reduce((a, t) => { a[t.id] = t.label; return a; }, {} as Record<DocType, string>);

/** Η λεπτομέρεια μέσα στον τύπο. Κάθε τιμή ανήκει σε ΕΝΑΝ τύπο (DOC_KINDS). */
export type DocSubtype = 'enfia' | 'income_tax' | 'e9' | 'e1' | 'e2' | 'e3' | 'pea' | 'ama' | 'rent_in';

// ── Η ταξινομία του Αρχείου — ΕΝΑ σημείο αλήθειας ────────────────────────────
// Οι κατηγορίες-φάκελοι του property_documents. Ζουν ΕΔΩ (και όχι στην οθόνη)
// επειδή τις γράφουν τρεις διαφορετικές διαδρομές (σάρωση, μαζικό ανέβασμα,
// διόρθωση) και μέχρι σήμερα η κάθε μία είχε δική της εκδοχή.
//
// ΔΥΟ ΝΕΑ ΡΑΦΙΑ, ΧΩΡΙΣ MIGRATION. Η στήλη `category` είναι κείμενο χωρίς
// CHECK· τα παλιά έγγραφα μένουν στο ράφι τους (ο παλιός τίτλος ιδιοκτησίας
// στο «Μισθωτήριο / Συμβόλαιο») και τα νέα μπαίνουν στο σωστό.
export const ARCHIVE_CATEGORIES = [
  'Μισθωτήριο / Συμβόλαιο', 'Ασφαλιστήριο Συμβόλαιο',
  'Τίτλος ιδιοκτησίας',
  'ΕΝΦΙΑ / Φορολογικά', 'Τεχνική Έκθεση',
  'Λογαριασμός Ρεύματος', 'Λογαριασμός Φυσικού Αερίου', 'Λογαριασμός Νερού',
  'Τηλέφωνο / Internet', 'Κοινόχρηστα',
  'Απεντόμωση / Μυοκτονία', 'Τιμολόγιο Καθαρισμού', 'Συντήρηση Πισίνας',
  'Συντήρηση Ανελκυστήρα', 'Εταιρεία Ασφαλείας',
  'Είσπραξη ενοικίου',
  'Άλλο Έγγραφο',
] as const;
export type ArchiveCategory = typeof ARCHIVE_CATEGORIES[number];

// ── Οι φάκελοι του Αρχείου: πού κάθεται κάθε ράφι ─────────────────────────
// Ζούσαν μέσα στο TabDocuments. Τους χρειάζεται πια και η σάρωση, που δείχνει
// τα ράφια ομαδοποιημένα ανά φάκελο· δύο αντίγραφα θα απέκλιναν στο πρώτο
// νέο ράφι, όπως ακριβώς τα δύο που προστέθηκαν τώρα.
export type FolderKey =
  | 'contracts' | 'property' | 'taxes' | 'bills' | 'providers'
  | 'warranties' | 'invoices' | 'bank' | 'photos' | 'other';

export const FOLDERS: { key: FolderKey; label: string }[] = [
  { key: 'contracts',  label: 'Συμβόλαια' },
  { key: 'property',   label: 'Έγγραφα ακινήτου' },
  { key: 'taxes',      label: 'Φόροι και ΕΝΦΙΑ' },
  { key: 'bills',      label: 'Λογαριασμοί' },
  { key: 'providers',  label: 'Πάροχοι' },
  { key: 'warranties', label: 'Εγγυήσεις' },
  { key: 'invoices',   label: 'Τιμολόγια' },
  { key: 'bank',       label: 'Τραπεζικά' },
  { key: 'photos',     label: 'Φωτογραφίες' },
  { key: 'other',      label: 'Λοιπά' },
];

// Ακριβής αντιστοίχιση κατηγορίας property_documents → φάκελος
const DOC_CAT_FOLDER: Record<string, FolderKey> = {
  'Μισθωτήριο / Συμβόλαιο': 'contracts', 'Ασφαλιστήριο Συμβόλαιο': 'contracts',
  'Τίτλος ιδιοκτησίας': 'property',
  'ΕΝΦΙΑ / Φορολογικά': 'taxes', 'Τεχνική Έκθεση': 'property', 'Άλλο Έγγραφο': 'property',
  'Λογαριασμός Ρεύματος': 'bills', 'Λογαριασμός Φυσικού Αερίου': 'bills', 'Λογαριασμός Νερού': 'bills',
  'Τηλέφωνο / Internet': 'bills', 'Κοινόχρηστα': 'bills',
  'Απεντόμωση / Μυοκτονία': 'providers', 'Τιμολόγιο Καθαρισμού': 'providers',
  'Συντήρηση Πισίνας': 'providers', 'Συντήρηση Ανελκυστήρα': 'providers', 'Εταιρεία Ασφαλείας': 'providers',
  'Είσπραξη ενοικίου': 'bank',
};
/** Ο φάκελος ενός ραφιού. Τα ελεύθερα ράφια παλιών εγγραφών βρίσκουν θέση από τη λέξη. */
export const folderForDoc = (cat: string | null): FolderKey => {
  if (!cat) return 'property';
  if (DOC_CAT_FOLDER[cat]) return DOC_CAT_FOLDER[cat];
  const c = cat.toLowerCase();
  if (/ασφαλ|συμβόλαιο|μισθωτ/.test(c)) return 'contracts';
  if (/ενφια|φόρο|φορολ/.test(c)) return 'taxes';
  if (/λογαριασμ|ρεύμα|νερ|αέριο|internet|τηλέφων|κοινόχρηστ/.test(c)) return 'bills';
  if (/καθαρ|πισίν|ανελκυστ|απεντόμ|security|ασφαλεία/.test(c)) return 'providers';
  return 'property';
};

/** Επιλογή λίστας: τιμή, ετικέτα, προαιρετική περιγραφή και επικεφαλίδα ομάδας. */
export interface Choice { value: string; label: string; description?: string; header?: string }

// ── ΤΑ ΡΑΦΙΑ ΟΠΩΣ ΤΑ ΔΙΑΒΑΖΕΙ Ο ΧΡΗΣΤΗΣ ─────────────────────────────────────
// Οι τιμές του ARCHIVE_CATEGORIES ΜΕΝΟΥΝ ΙΔΙΕΣ: είναι αποθηκευμένες στο
// property_documents.category. Η λίστα όμως ανακάτευε δύο γραφές («Τεχνική
// Έκθεση» δίπλα στο «Τίτλος ιδιοκτησίας») και επαναλάμβανε τον φάκελο μέσα στο
// ράφι («Λογαριασμοί» › «Λογαριασμός Ρεύματος»). Εδώ ζει η ετικέτα: πρώτο
// γράμμα κεφαλαίο, σύντομη κάτω από την επικεφαλίδα του φακέλου της.
const SHELF_LABEL: Record<ArchiveCategory, string> = {
  'Μισθωτήριο / Συμβόλαιο': 'Μισθωτήριο ή συμβόλαιο',
  'Ασφαλιστήριο Συμβόλαιο': 'Ασφαλιστήριο',
  'Τίτλος ιδιοκτησίας': 'Τίτλος ιδιοκτησίας',
  'ΕΝΦΙΑ / Φορολογικά': 'Φορολογικά έγγραφα',
  'Τεχνική Έκθεση': 'Τεχνική έκθεση',
  'Λογαριασμός Ρεύματος': 'Ρεύμα',
  'Λογαριασμός Φυσικού Αερίου': 'Φυσικό αέριο',
  'Λογαριασμός Νερού': 'Νερό',
  'Τηλέφωνο / Internet': 'Τηλέφωνο και internet',
  'Κοινόχρηστα': 'Κοινόχρηστα',
  'Απεντόμωση / Μυοκτονία': 'Απεντόμωση και μυοκτονία',
  'Τιμολόγιο Καθαρισμού': 'Καθαρισμός',
  'Συντήρηση Πισίνας': 'Συντήρηση πισίνας',
  'Συντήρηση Ανελκυστήρα': 'Συντήρηση ανελκυστήρα',
  'Εταιρεία Ασφαλείας': 'Εταιρεία ασφαλείας',
  'Είσπραξη ενοικίου': 'Είσπραξη ενοικίου',
  'Άλλο Έγγραφο': 'Άλλο έγγραφο',
};

const FOLDER_NAME = FOLDERS.reduce((a, f) => { a[f.key] = f.label; return a; }, {} as Record<FolderKey, string>);

/** Ο φάκελος ενός ραφιού, με το όνομα που βλέπει ο χρήστης («Λογαριασμοί»). */
export const folderOf = (cat: string): string => FOLDER_NAME[folderForDoc(cat)];

/** Το ράφι με τον φάκελό του, όπως το λέει η οθόνη: «Λογαριασμοί › Ρεύμα». */
export function shelfPath(cat: string): string {
  return `${folderOf(cat)} › ${SHELF_LABEL[cat as ArchiveCategory] ?? cat}`;
}

/**
 * Τα ράφια του Αρχείου ομαδοποιημένα ανά φάκελο, με τη σειρά των φακέλων.
 * Η σάρωση και η διόρθωση του μαζικού ανεβάσματος δείχνουν την ΙΔΙΑ λίστα.
 * Το ράφι κάθεται κάτω από την επικεφαλίδα του φακέλου του, οπότε δεν τον
 * επαναλαμβάνει· όπου η επικεφαλίδα δεν φαίνεται, ο φάκελος λέγεται δίπλα
 * (`folderOf`, `shelfPath`). Ολόκληρη η διαδρομή στο κουμπί δεν χωρά στο
 * τηλέφωνο: «Έγγραφα ακινήτου › Τίτλος ιδιοκτησίας» θέλει 37 χαρακτήρες.
 */
export function archiveOptions(): Choice[] {
  const out: Choice[] = [];
  for (const f of FOLDERS) {
    const shelves = ARCHIVE_CATEGORIES.filter(c => folderForDoc(c) === f.key);
    shelves.forEach((c, i) => out.push({ value: c, label: SHELF_LABEL[c], ...(i === 0 ? { header: f.label } : {}) }));
  }
  return out;
}

// Κατηγορία λογαριασμού (electricity, water…) → ράφι του Αρχείου.
const BILL_ARCHIVE_CATEGORY: Record<string, ArchiveCategory> = {
  electricity: 'Λογαριασμός Ρεύματος',
  water:       'Λογαριασμός Νερού',
  gas:         'Λογαριασμός Φυσικού Αερίου',
  internet:    'Τηλέφωνο / Internet',
  common:      'Κοινόχρηστα',
  insurance:   'Ασφαλιστήριο Συμβόλαιο',
  taxes:       'ΕΝΦΙΑ / Φορολογικά',
  municipal:   'ΕΝΦΙΑ / Φορολογικά',
  security:    'Εταιρεία Ασφαλείας',
  elevator:    'Συντήρηση Ανελκυστήρα',
  pool:        'Συντήρηση Πισίνας',
  cleaner:     'Τιμολόγιο Καθαρισμού',
};

// ── Οι κατηγορίες λογαριασμού, για τον επιλογέα ───────────────────────────
// Τα κλειδιά και η ομάδα έρχονται από το EXPENSE_MAP (το ίδιο λεξιλόγιο με τις
// Δαπάνες)· εδώ μόνο η ετικέτα που διαβάζει ο χρήστης. Ζούσαν ως CATEGORY_LABELS
// μέσα στην οθόνη σάρωσης, χωρίς ομάδες και με δεύτερη ορθογραφία.
const BILL_CATEGORY_LABEL: Record<string, string> = {
  electricity: 'Ρεύμα', water: 'Νερό', gas: 'Φυσικό αέριο', internet: 'Internet και τηλεφωνία',
  streaming: 'Streaming και συνδρομές', insurance: 'Ασφάλεια', taxes: 'ΕΝΦΙΑ και φόροι',
  municipal: 'Δημοτικά τέλη', security: 'Συναγερμός', common: 'Κοινόχρηστα',
  maintenance: 'Γενική συντήρηση', elevator: 'Συντήρηση ανελκυστήρα', pool: 'Καθαρισμός πισίνας',
  gardener: 'Κηπουρός', cleaner: 'Καθαριότητα', plumber: 'Υδραυλικός', electrician: 'Ηλεκτρολόγος',
  other: 'Άλλη δαπάνη',
};
const BILL_GROUP_LABEL: Record<string, string> = { fixed: 'Πάγια', maintenance: 'Συντήρηση', other: 'Άλλο' };

/** Οι κατηγορίες λογαριασμού ομαδοποιημένες κατά ομάδα δαπάνης (Πάγια · Συντήρηση · Άλλο). */
export const BILL_CATEGORIES: Choice[] = Object.keys(BILL_GROUP_LABEL).flatMap(g =>
  Object.keys(EXPENSE_MAP).filter(k => EXPENSE_MAP[k].group === g).map((k, i) => {
    const c: Choice = { value: k, label: BILL_CATEGORY_LABEL[k] || EXPENSE_MAP[k].cat };
    return i === 0 ? { ...c, header: BILL_GROUP_LABEL[g] } : c;
  }));

/** Η ετικέτα μιας κατηγορίας λογαριασμού, όπως τη βλέπει ο χρήστης. */
export const billCategoryLabel = (k: string | undefined): string =>
  (k && (BILL_CATEGORY_LABEL[k] || EXPENSE_MAP[k]?.cat)) || '';

// Οι συνδρομές: μόνο αυτές ανανεώνονται μόνες τους. Ο μηνιαίος λογαριασμός
// ρεύματος έρχεται κάθε μήνα, αλλά δεν «ακυρώνεται πριν τη χρέωση».
const SUBSCRIPTIONS = new Set(['internet', 'streaming', 'security']);

// Ο πάροχος του ακινήτου: η κατηγορία λογαριασμού → στήλη του property_settings.
const PROVIDER_COLUMN: Record<string, string> = {
  electricity: 'electricity_provider', water: 'water_provider', internet: 'internet_provider',
};

/**
 * Η κατηγορία λογαριασμού, οριστικοποιημένη. Αν η OCR δεν έδωσε έγκυρη κατηγορία,
 * την αναγνωρίζουμε από το ΟΝΟΜΑ ΤΟΥ ΠΑΡΟΧΟΥ με τους ΥΠΑΡΧΟΝΤΕΣ MATCHERS του
 * parse.ts (ο ίδιος κατάλογος που κατηγοριοποιεί τραπεζικές κινήσεις) — αντί για
 * δεύτερη, χειρόγραφη λίστα regex μέσα στην οθόνη.
 */
export function resolveBillCategory(doc: Pick<ScannedDoc, 'category' | 'provider' | 'title'>): string {
  const c = doc.category;
  if (c && c !== 'other' && EXPENSE_MAP[c]) return c;
  const guess = categorizeTransaction(`${doc.provider || ''} ${doc.title || ''}`).category;
  return EXPENSE_MAP[guess] ? guess : 'other';
}

// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΕΙΔΗ ΕΓΓΡΑΦΟΥ: ΜΙΑ ΠΗΓΗ ΓΙΑ ΤΟ DROPDOWN, ΤΗ ΦΟΡΜΑ, ΤΟ ΡΑΦΙ ΚΑΙ ΤΗΝ ΕΞΑΓΩΓΗ
// ─────────────────────────────────────────────────────────────────────────
// Κάθε τιμή του επιλογέα είναι ένα ζεύγος (doc_type, subtype). Η σειρά είναι η
// σειρά του dropdown. Το `shelf` είναι η προεπιλογή του «Φάκελος»· `null`
// σημαίνει «από την κατηγορία του λογαριασμού». Το `amountKey` λέει ποιο πεδίο
// είναι το ποσό του εγγράφου (για σύνοψη και Αρχείο)· όπου λείπει, το έγγραφο
// δεν έχει ποσό και το Αρχείο δεν γράφει κανένα.
// ═══════════════════════════════════════════════════════════════════════════
export type DocKindId =
  | 'bill' | 'payment' | 'lease' | 'rent_in' | 'deed' | 'insurance' | 'pea' | 'ama'
  | 'enfia' | 'e9' | 'e1' | 'e2' | 'e3' | 'income_tax' | 'tax' | 'government' | 'other';

export interface DocKind {
  value: DocKindId;
  label: string;
  short: string;
  description?: string;
  header: string;
  doc_type: DocType;
  subtype?: DocSubtype;
  shelf: ArchiveCategory | null;
  amountKey?: 'amount' | 'premium' | 'monthly_rent' | 'property_amount';
}

const H_BILLS = 'Λογαριασμοί και πληρωμές';
const H_LEASE = 'Μίσθωση';
const H_PROPERTY = 'Ακίνητο';
const H_TAX = 'Φορολογικά';
const H_OTHER = 'Άλλα';
const TAX_SHELF: ArchiveCategory = 'ΕΝΦΙΑ / Φορολογικά';

export const DOC_KINDS: DocKind[] = [
  { value: 'bill', label: 'Λογαριασμός ή τιμολόγιο', short: 'Λογαριασμός', description: 'Ρεύμα, νερό, αέριο, internet, κοινόχρηστα, συντήρηση', header: H_BILLS, doc_type: 'bill', shelf: null, amountKey: 'amount' },
  { value: 'payment', label: 'Απόδειξη πληρωμής', short: 'Απόδειξη πληρωμής', description: 'Εξόφληση λογαριασμού ή δαπάνης', header: H_BILLS, doc_type: 'payment', shelf: null, amountKey: 'amount' },
  { value: 'lease', label: 'Μισθωτήριο', short: 'Μισθωτήριο', description: 'Συμφωνητικό μίσθωσης', header: H_LEASE, doc_type: 'lease', shelf: 'Μισθωτήριο / Συμβόλαιο', amountKey: 'monthly_rent' },
  { value: 'rent_in', label: 'Είσπραξη ενοικίου', short: 'Είσπραξη ενοικίου', description: 'Κατάθεση ή απόδειξη από τον ενοικιαστή', header: H_LEASE, doc_type: 'payment', subtype: 'rent_in', shelf: 'Είσπραξη ενοικίου', amountKey: 'amount' },
  { value: 'deed', label: 'Τίτλος ιδιοκτησίας', short: 'Τίτλος ιδιοκτησίας', description: 'Συμβόλαιο αγοράς, γονική παροχή, κληρονομιά', header: H_PROPERTY, doc_type: 'deed', shelf: 'Τίτλος ιδιοκτησίας' },
  { value: 'insurance', label: 'Ασφαλιστήριο', short: 'Ασφαλιστήριο', description: 'Ασφάλεια του ακινήτου', header: H_PROPERTY, doc_type: 'insurance', shelf: 'Ασφαλιστήριο Συμβόλαιο', amountKey: 'premium' },
  { value: 'pea', label: 'ΠΕΑ', short: 'ΠΕΑ', description: 'Πιστοποιητικό ενεργειακής απόδοσης', header: H_PROPERTY, doc_type: 'government', subtype: 'pea', shelf: 'Τεχνική Έκθεση' },
  { value: 'ama', label: 'Βεβαίωση ΑΜΑ', short: 'ΑΜΑ', description: 'Μητρώο βραχυχρόνιας διαμονής', header: H_PROPERTY, doc_type: 'government', subtype: 'ama', shelf: 'Άλλο Έγγραφο' },
  { value: 'enfia', label: 'Εκκαθαριστικό ΕΝΦΙΑ', short: 'ΕΝΦΙΑ', header: H_TAX, doc_type: 'tax', subtype: 'enfia', shelf: TAX_SHELF, amountKey: 'property_amount' },
  { value: 'e9', label: 'Ε9', short: 'Ε9', description: 'Δήλωση στοιχείων ακινήτων', header: H_TAX, doc_type: 'tax', subtype: 'e9', shelf: TAX_SHELF },
  { value: 'e1', label: 'Ε1', short: 'Ε1', description: 'Δήλωση φορολογίας εισοδήματος', header: H_TAX, doc_type: 'tax', subtype: 'e1', shelf: TAX_SHELF },
  { value: 'e2', label: 'Ε2', short: 'Ε2', description: 'Αναλυτική κατάσταση μισθωμάτων', header: H_TAX, doc_type: 'tax', subtype: 'e2', shelf: TAX_SHELF },
  { value: 'e3', label: 'Ε3', short: 'Ε3', description: 'Οικονομικά στοιχεία επιχείρησης', header: H_TAX, doc_type: 'tax', subtype: 'e3', shelf: TAX_SHELF },
  { value: 'income_tax', label: 'Εκκαθαριστικό φόρου εισοδήματος', short: 'Φόρος εισοδήματος', header: H_TAX, doc_type: 'tax', subtype: 'income_tax', shelf: TAX_SHELF, amountKey: 'amount' },
  { value: 'tax', label: 'Άλλο φορολογικό', short: 'Φορολογικό', description: 'Βεβαίωση οφειλής, τέλη', header: H_TAX, doc_type: 'tax', shelf: TAX_SHELF, amountKey: 'amount' },
  { value: 'government', label: 'Κρατικό έγγραφο', short: 'Κρατικό έγγραφο', description: 'Πολεοδομία, άδειες, βεβαιώσεις', header: H_OTHER, doc_type: 'government', shelf: 'Άλλο Έγγραφο' },
  { value: 'other', label: 'Άλλο έγγραφο', short: 'Έγγραφο', header: H_OTHER, doc_type: 'other', shelf: 'Άλλο Έγγραφο' },
];

const KIND_BY_ID = DOC_KINDS.reduce((a, k) => { a[k.value] = k; return a; }, {} as Record<DocKindId, DocKind>);

// ── ΤΟ ΕΚΚΑΘΑΡΙΣΤΙΚΟ ΦΟΡΟΥ ΕΙΣΟΔΗΜΑΤΟΣ ΞΑΝΑΔΙΑΒΑΖΕΤΑΙ ΑΠΟ ΤΟΝ ΤΙΤΛΟ ΤΟΥ ──────
// Το Αρχείο δεν έχει ακόμη στήλη υποτύπου ούτε έτους: η σάρωση τα γράφει στον
// τίτλο («Φόρος εισοδήματος 2025», βλ. `savePlan`). Οι επόμενοι 12 μήνες
// (lib/home/forecast12.ts) θέλουν το ποσό του για τις δόσεις, οπότε ο ίδιος
// κανόνας διαβάζεται και ανάποδα, από το ίδιο `short`, όχι από αντίγραφο.
/** Η αρχή του τίτλου που δίνει η σάρωση στο εκκαθαριστικό φόρου εισοδήματος. */
export const INCOME_TAX_TITLE = KIND_BY_ID.income_tax.short;

/** Το φορολογικό έτος ενός εκκαθαριστικού φόρου εισοδήματος, από τον τίτλο του· αλλιώς `null`. */
export function incomeTaxYearOf(title: string | null | undefined): number | null {
  const t = (title || '').trim();
  if (!t.startsWith(`${INCOME_TAX_TITLE} `)) return null;
  const m = /^(\d{4})$/.exec(t.slice(INCOME_TAX_TITLE.length + 1).trim());
  return m ? Number(m[1]) : null;
}

// ── ΚΑΙ ΤΟ ΕΚΚΑΘΑΡΙΣΤΙΚΟ ΕΝΦΙΑ ─────────────────────────────────────────────
// Ο ίδιος κανόνας («ΕΝΦΙΑ 2026»). Το ποσό του στο Αρχείο είναι το ΣΥΝΟΛΟ του
// εκκαθαριστικού (όλα τα ακίνητα του ΑΦΜ) και από αυτό βγαίνει πόσες δόσεις έχει
// (lib/calendar/enfiaTotals.ts → υπενθυμίσεις).
/** Η αρχή του τίτλου που δίνει η σάρωση στο εκκαθαριστικό ΕΝΦΙΑ. */
export const ENFIA_TITLE = KIND_BY_ID.enfia.short;

/** Το έτος ενός εκκαθαριστικού ΕΝΦΙΑ, από τον τίτλο του· αλλιώς `null`. */
export function enfiaYearOf(title: string | null | undefined): number | null {
  const t = (title || '').trim();
  if (!t.startsWith(`${ENFIA_TITLE} `)) return null;
  const m = /^(\d{4})$/.exec(t.slice(ENFIA_TITLE.length + 1).trim());
  return m ? Number(m[1]) : null;
}

/** Οι επιλογές του «Τύπος εγγράφου»: με την εξήγηση κάθε είδους και επικεφαλίδα ανά ομάδα. */
export const KIND_OPTIONS: Choice[] = DOC_KINDS.map((k, i) => ({
  value: k.value, label: k.label,
  ...(k.description ? { description: k.description } : {}),
  ...(i === 0 || DOC_KINDS[i - 1].header !== k.header ? { header: k.header } : {}),
}));

/**
 * Το είδος ενός εγγράφου, ή `null` όταν η σάρωση δεν βρήκε έγγραφο και ο
 * χρήστης δεν έχει διαλέξει ακόμη. Κοιτάζει ΜΟΝΟ τον ρητό υποτύπο: αν ο
 * χρήστης διάλεξε «Άλλο φορολογικό», ο τίτλος «ΕΝΦΙΑ» δεν τον γυρίζει πίσω.
 */
export function kindOf(doc: Pick<ScannedDoc, 'doc_type' | 'subtype' | 'is_document'>): DocKind | null {
  if (doc.is_document === false) return null;
  const st = doc.subtype ?? undefined;
  return DOC_KINDS.find(k => k.doc_type === doc.doc_type && k.subtype === st)
    ?? DOC_KINDS.find(k => k.doc_type === doc.doc_type && !k.subtype)
    ?? null;
}

/**
 * Αλλαγή είδους από τον επιλογέα. Οι τιμές που έχουν ήδη συμπληρωθεί ΜΕΝΟΥΝ:
 * ο χρήστης που διόρθωσε το ποσό και μετά τον τύπο δεν ξαναγράφει το ποσό.
 * Το `subtype: null` σημαίνει «ρητά χωρίς υποτύπο», ώστε η εξομάλυνση της
 * καταχώρησης να μην τον ξαναβγάλει από τον τίτλο.
 */
export function applyKind(doc: ScannedDoc, value: string): ScannedDoc {
  const k = KIND_BY_ID[value as DocKindId];
  if (!k) return doc;
  // Η μοναδική γραμμή Ε9/ΕΝΦΙΑ ανεβαίνει ΤΩΡΑ, ώστε ο χρήστης να δει ό,τι θα γραφτεί.
  return liftSingleLine({ ...doc, doc_type: k.doc_type, subtype: k.subtype ?? null, is_document: true });
}

/**
 * ΤΟ μοναδικό σημείο που αποφασίζει σε ποιον φάκελο του Αρχείου μπαίνει ένα
 * σαρωμένο έγγραφο. Πριν, το documents.ts έστελνε κάθε λογαριασμό στο «Άλλο
 * Έγγραφο» και το TabDocuments το ξαναδιόρθωνε — ενώ το DocumentScan δεν το
 * διόρθωνε καθόλου. Ο ίδιος λογαριασμός ΔΕΗ κατέληγε σε διαφορετικό φάκελο
 * ανάλογα με την οθόνη από την οποία μπήκε.
 */
export function archiveCategoryFor(doc: Pick<ScannedDoc, 'doc_type' | 'subtype' | 'is_document' | 'category' | 'provider' | 'title'>): ArchiveCategory {
  const k = kindOf(doc) ?? KIND_BY_ID.other;
  if (k.shelf) return k.shelf;
  return BILL_ARCHIVE_CATEGORY[resolveBillCategory(doc)] || 'Άλλο Έγγραφο';
}

// ── Ενιαίο σχήμα εξαγόμενων πεδίων (superset για όλους τους τύπους) ───────────
/** Μία γραμμή πίνακα ακινήτων (Ε9 ή ανάλυση ΕΝΦΙΑ). */
export interface DocLine {
  atak?: string; address?: string; floor?: string;
  sqm?: number; storage_sqm?: number; year_built?: number; amount?: number;
}

export interface ScannedDoc {
  doc_type:   DocType;
  /** Λεπτομέρεια μέσα στον τύπο. `null` = ρητά κανένας (επιλογή χρήστη). */
  subtype?:   DocSubtype | null;
  /** `false` όταν η εικόνα δεν είναι έγγραφο (φωτογραφία χώρου, γραφικό). */
  is_document?: boolean;
  /** Όταν δεν είναι έγγραφο: η κατηγορία της φωτογραφίας, από την ΙΔΙΑ ανάγνωση. */
  photo_category?: string;
  title?:     string;    // σύντομος τίτλος (π.χ. «Μισθωτήριο — Παπαδόπουλος»)
  provider?:  string;    // πάροχος / αντισυμβαλλόμενος / φορέας / ασφαλιστική
  category?:  string;    // κατηγορία λογαριασμού (electricity…) όταν doc_type='bill'|'payment'
  amount?:    number;    // ποσό (λογαριασμός/πληρωμή/φόρος· στον ΕΝΦΙΑ το σύνολο του εκκαθαριστικού)
  due_date?:  string;    // λήξη πληρωμής (YYYY-MM-DD)· στα φορολογικά η 1η δόση
  issue_date?: string;   // ημερομηνία έκδοσης (YYYY-MM-DD)

  // ── Τα πέντε πεδία ταιριάσματος «ο λογαριασμός πληρώθηκε» ──────────────────
  // πάροχος (provider) · ΑΦΜ παρόχου · ποσό · ημερομηνία έκδοσης · περίοδος από–έως
  // Η περίοδος είναι ΔΟΜΗΜΕΝΗ (δύο ημερομηνίες) και όχι ελεύθερο κείμενο, γιατί
  // μόνο έτσι απαντιέται το «επικαλύπτονται;» — ο έλεγχος που εμποδίζει δύο
  // λογαριασμούς ΔΕΗ ίδιου ποσού διαφορετικού μήνα να εξοφλήσουν ο ένας τον άλλο.
  provider_afm?: string; // ΑΦΜ εκδότη (9 ψηφία· ελέγχεται με το checksum της ΑΑΔΕ)
  // Στοιχεία επικοινωνίας του εκδότη, όπως τυπώνονται στο χαρτί.
  // ΓΙΑΤΙ: η σάρωση δημιουργούσε επαφή με phone:null και email:null — δηλαδή
  // επαφή που δεν μπορείς να καλέσεις. Το τιμολόγιο του υδραυλικού έχει το
  // τηλέφωνό του τυπωμένο· δεν υπάρχει λόγος να το ξαναγράψει ο χρήστης.
  provider_phone?: string;
  provider_email?: string;
  period_from?: string;  // αρχή περιόδου δαπάνης (YYYY-MM-DD)
  period_to?:   string;  // τέλος περιόδου δαπάνης (YYYY-MM-DD)
  period?:    string;    // η περίοδος όπως γράφεται στο χαρτί (για την οθόνη)

  // μισθωτήριο
  tenant_name?: string;
  landlord_name?: string;  // εκμισθωτής (ιδιοκτήτης)
  monthly_rent?: number;
  /** Ημέρα του μήνα που πληρώνεται το ενοίκιο, 1-31. */
  rent_due_day?: number;
  lease_start?: string;
  lease_end?:   string;
  deposit?:     number;
  afm?:         string;

  // τίτλος / συμβόλαιο / ακίνητο
  // Συνιδιοκτήτες με ποσοστά (από τίτλο/συμβόλαιο) — για την «Κατανομή σε ιδιοκτήτες».
  owners?: { name?: string; afm?: string; pct?: number }[];
  purchase_price?: number;
  purchase_date?:  string;
  obj_value?:      number;  // αντικειμενική αξία
  atak?:           string;
  year_built?:     number;
  sqm?:            number;
  storage_sqm?:    number;  // τ.μ. βοηθητικών χώρων (Ε9)
  floor?:          string;  // όροφος, όπως γράφεται (Ε9)
  /** Πίνακας ακινήτων: Ε9 ή ανάλυση ΕΝΦΙΑ ανά ακίνητο. */
  lines?:          DocLine[];
  /** Η γραμμή που διάλεξε ο χρήστης (θέση στο `lines`)· −1 = καμία. */
  line?:           number;
  /** ΕΝΦΙΑ: το ποσό που αναλογεί σε ΑΥΤΟ το ακίνητο (το `amount` είναι το σύνολο). */
  property_amount?: number;

  // ασφαλιστήριο
  policy_number?: string;
  premium?:       number;   // ασφάλιστρο (€)
  coverage?:      number;   // κάλυψη (€)
  expiry_date?:   string;   // λήξη ασφάλισης ή ΠΕΑ (YYYY-MM-DD)

  // ΠΕΑ, ΑΜΑ
  pea_class?: string;
  ama?:       string;

  // φορολογικό
  tax_year?: number;

  // λογαριασμός — extras (συμβατά με ExtractedBill)
  kwh?: number; ert?: number; etmear?: number; dimotika?: number;
  cubic_meters?: number; meter_prev?: number; meter_current?: number;
  energy_charge?: number; network_charge?: number; millesimi?: number;
  vat_rate?: number; account_num?: string;

  // ── ΤΑ ΣΤΟΙΧΕΙΑ ΠΟΥ ΚΡΙΝΟΥΝ ΤΟΝ ΦΠΑ ────────────────────────────────────
  // Ο ιδιοκτήτης δεν θα συμπληρώσει φόρμα: θα φωτογραφίσει το τιμολόγιο. Ό,τι
  // είναι τυπωμένο πάνω του δεν ξαναρωτιέται — και αυτά είναι που κρίνουν αν η
  // δαπάνη είναι εγχώρια, ενδοκοινοτική λήψη ή λήψη από τρίτη χώρα, δηλαδή αν
  // τον φόρο τον αποδίδει ο ίδιος με αντίστροφη χρέωση.
  // Η συναγωγή ζει στο lib/billing/invoiceIntel.ts, όχι εδώ: εδώ είναι μόνο
  // ό,τι ΔΙΑΒΑΣΤΗΚΕ.
  /** Αριθμός ΦΠΑ εκδότη με πρόθεμα κράτους μέλους («IE6388047V»). */
  provider_vat?: string;
  /** Χώρα έδρας του εκδότη, ISO 3166-1 alpha-2. */
  provider_country?: string;
  /** Κάθε πότε επαναλαμβάνεται η χρέωση· από εδώ βγαίνει η λήξη και η υπενθύμιση. */
  billing_period?: string;
  // Τα τέσσερα παρακάτω δεν τα ζητά πια η ανάγνωση: δεν τα διάβαζε καμία οθόνη.
  // Μένουν στον τύπο για τα έγγραφα που σαρώθηκαν πριν.
  customer_afm?: string;
  net_amount?: number;
  vat_amount?: number;
  plan_name?: string;

  notes?: string;
  /** Βεβαιότητα για τον τύπο (doc_type και subtype), 0-100. ΛΕΙΠΕΙ όταν το
   *  μοντέλο δεν την έδωσε — δεν συμπληρώνεται με προεπιλογή, ώστε καμία οθόνη
   *  να μη γράψει νούμερο που δεν είπε κανείς. */
  confidence?: number;
  // Επιπλέον πεδία που πρόσθεσε χειροκίνητα ο χρήστης (ελεύθερα).
  custom?: { label: string; value: string }[];
}

// ΤΑ ΑΡΙΘΜΗΤΙΚΑ ΚΛΕΙΔΙΑ ΔΕΝ ΕΙΝΑΙ ΣΚΕΤΑ ΚΕΙΜΕΝΑ. Ήταν `string[]` και η
// εξομάλυνση έγραφε με `doc as unknown as Record<string, unknown>` — δηλαδή ένα
// κλειδί με τυπογραφικό («amout») δεν θα σκάλωνε πουθενά: ο αριθμός θα έμενε
// κείμενο, το ποσό θα έμπαινε στη βάση ως «1.200,50» και η πρόσθεση θα έδινε
// NaN. Με τον τύπο δεμένο στο ίδιο το ScannedDoc, ένα λάθος όνομα σκάει στη
// μεταγλώττιση.
export type NumKey = Extract<{
  [K in keyof ScannedDoc]-?: NonNullable<ScannedDoc[K]> extends number ? K : never
}[keyof ScannedDoc], string>;

/** Ό,τι η ανάγνωση πρέπει να γυρίσει σε αριθμό. Το τεστ ελέγχει ότι περιέχει κάθε αριθμητικό πεδίο της φόρμας. */
export const SCAN_NUM_KEYS: readonly NumKey[] = [
  'amount', 'monthly_rent', 'rent_due_day', 'deposit', 'premium', 'coverage', 'purchase_price', 'obj_value',
  'year_built', 'sqm', 'storage_sqm', 'tax_year', 'kwh', 'cubic_meters', 'millesimi', 'vat_rate',
  'net_amount', 'vat_amount',
];

/** Πόσες γραμμές πίνακα κρατά η ανάγνωση (Ε9, ΕΝΦΙΑ). */
export const SCAN_MAX_LINES = 8;

// ═══════════════════════════════════════════════════════════════════════════
// Η ΦΟΡΜΑ ΑΝΑ ΕΙΔΟΣ: ΜΟΝΟ ΤΑ ΑΠΑΡΑΙΤΗΤΑ, ΜΕ ΠΡΟΟΡΙΣΜΟ ΤΟ ΚΑΘΕΝΑ
// ─────────────────────────────────────────────────────────────────────────
// Κάθε πεδίο λέει τι χειριστήριο θέλει και ΠΟΥ ΓΡΑΦΕΤΑΙ (`dest`). Ένα πεδίο
// χωρίς προορισμό είναι ερώτηση που η εφαρμογή κάνει και μετά πετά την
// απάντηση· το τεστ ελέγχει ότι κάθε πεδίο αλλάζει το σχέδιο αποθήκευσης.
//
// Οι σειρές είναι ΔΗΛΩΜΕΝΕΣ: ένα πεδίο μόνο του πιάνει όλο το πλάτος, δύο είναι
// ζεύγος. Τα πεδία με `when` εμφανίζονται μόνο όταν έχουν νόημα· αν φύγει το
// ένα του ζεύγους, το άλλο απλώνεται αντί να μείνει δίπλα σε τρύπα.
// ═══════════════════════════════════════════════════════════════════════════
export type FieldInput = 'text' | 'code' | 'money' | 'number' | 'date' | 'select';
export type FieldOptions = 'bill_category' | 'billing_period' | 'pea_class' | 'tax_year' | 'line';

export interface DocField {
  key: keyof ScannedDoc;
  label: string;
  input: FieldInput;
  /** Πού γράφεται: στήλη ή ενέργεια. */
  dest: string;
  /** Χωρίς αυτό δεν γίνεται καταχώρηση. */
  required?: boolean;
  /** Μονάδα δίπλα στον αριθμό. */
  suffix?: string;
  /** Οδηγία που τυπώνεται στο πεδίο. */
  hint?: string;
  /** Κωδικός μόνο με ψηφία (πληκτρολόγιο αριθμών). */
  numeric?: boolean;
  min?: number;
  max?: number;
  options?: FieldOptions;
  /** Έλεγχος εγκυρότητας: ό,τι δεν τον περνά λέγεται «άκυρο» και δεν γράφεται. */
  check?: 'afm' | 'atak' | 'ama';
  when?: (d: ScannedDoc) => boolean;
}

interface KindForm {
  groups: { title?: string; rows: DocField[][] }[];
  /** Λεζάντα κάτω από τα πεδία. */
  note?: string;
  /** Πληροφορία πάνω από τα πεδία, όταν ισχύει. */
  info?: (d: ScannedDoc) => string;
}

const billCat = (d: ScannedDoc) => resolveBillCategory(d);
const isElectricity = (d: ScannedDoc) => billCat(d) === 'electricity';
const isCommonBill = (d: ScannedDoc) => billCat(d) === 'common';
const isSubscription = (d: ScannedDoc) => SUBSCRIPTIONS.has(billCat(d));
const isForeign = (d: ScannedDoc) => { const c = providerCountry(d); return !!c && c !== 'GR'; };
const hasLines = (d: ScannedDoc) => (d.lines?.length ?? 0) > 1;

const FILL_ONLY_NOTE = 'Συμπληρώνει μόνο ό,τι λείπει από το ακίνητο· δεν αλλάζει ό,τι έχεις γράψει.';

const issueDate: DocField = { key: 'issue_date', label: 'Ημερομηνία έκδοσης', input: 'date', dest: 'property_documents.issue_date' };
const taxYear: DocField = { key: 'tax_year', label: 'Έτος', input: 'select', options: 'tax_year', required: true, dest: 'τίτλος στον Φάκελο' };
const money = (key: DocField['key'], label: string, dest: string, required = false): DocField =>
  ({ key, label, input: 'money', suffix: '€', dest, ...(required ? { required } : {}) });
const sqmField = (key: 'sqm' | 'storage_sqm', label: string, dest: string): DocField =>
  ({ key, label, input: 'number', suffix: 'm²', dest });
const yearBuilt: DocField = { key: 'year_built', label: 'Έτος κατασκευής', input: 'number', dest: 'user_properties.year_built (μόνο αν λείπει)' };
const atakField = (dest: string): DocField => ({ key: 'atak', label: 'ΑΤΑΚ', input: 'code', numeric: true, check: 'atak', dest });
const lineField = (label: string): DocField => ({ key: 'line', label, input: 'select', options: 'line', when: hasLines, dest: 'συμπληρώνει τα πεδία από τη γραμμή του ακινήτου' });
const taxForm = (second: DocField): KindForm => ({ groups: [{ rows: [[taxYear, second]] }] });

const KIND_FORMS: Record<DocKindId, KindForm> = {
  bill: {
    groups: [
      { title: 'Εκδότης', rows: [
        [{ key: 'provider', label: 'Πάροχος', input: 'text', dest: 'bills.name, expenses.description, Φάκελος, πάροχος του ακινήτου (μόνο αν λείπει)' }],
        [{ key: 'provider_afm', label: 'ΑΦΜ παρόχου', input: 'code', numeric: true, check: 'afm', dest: 'expenses.supplier_afm, property_documents.provider_afm' },
         { ...issueDate, dest: 'property_documents.issue_date, αφετηρία της ανανέωσης' }],
      ] },
      // ΤΟ ΠΟΣΟ ΠΡΩΤΟ. Είναι το μόνο υποχρεωτικό πεδίο και ο αριθμός που κρίνει
      // τον λογαριασμό· ήταν τέταρτη σειρά, μετά την κατηγορία και την παροχή,
      // και στο τηλέφωνο ήθελε δύο κυλίσεις για να φανεί.
      { title: 'Χρέωση', rows: [
        [money('amount', 'Ποσό', 'bills.amount, expenses.amount, property_documents.amount', true),
         { key: 'due_date', label: 'Λήξη πληρωμής', input: 'date', dest: 'bills.due_date, Ημερολόγιο: πληρωμή' }],
        [{ key: 'period_from', label: 'Περίοδος από', input: 'date', dest: 'bills.period, property_documents.period_from' },
         { key: 'period_to', label: 'Περίοδος έως', input: 'date', dest: 'bills.period, property_documents.period_to' }],
        [{ key: 'category', label: 'Κατηγορία', input: 'select', options: 'bill_category', dest: 'bills.category, expenses.category, ράφι του Φακέλου' },
         { key: 'millesimi', label: 'Χιλιοστά', input: 'number', suffix: '‰', when: isCommonBill, dest: 'Κοινόχρηστα: χιλιοστά (μόνο αν λείπουν)' },
         { key: 'billing_period', label: 'Επανάληψη', input: 'select', options: 'billing_period', when: isSubscription, dest: 'Ημερολόγιο: ανανέωση' }],
        [{ key: 'account_num', label: 'Αριθμός παροχής', input: 'code', numeric: true, when: isElectricity, dest: 'user_properties.power_supply_no (μόνο αν λείπει)' },
         { key: 'kwh', label: 'Κατανάλωση', input: 'number', suffix: 'kWh', when: isElectricity, dest: 'bills.kwh' }],
        // Η χώρα είναι κείμενο δύο γραμμάτων, όχι κωδικός που διαβάζεται
        // χαρακτήρα χαρακτήρα: γι' αυτό σε Inter και όχι σε μονοδιάστημη.
        [{ key: 'provider_country', label: 'Χώρα εκδότη', input: 'text', when: isForeign, dest: 'expenses.supplier_country' },
         { key: 'provider_vat', label: 'ΑΦΜ ΦΠΑ εκδότη', input: 'code', when: isForeign, dest: 'expenses.supply (αντίστροφη χρέωση)' }],
      ] },
    ],
  },
  payment: {
    groups: [{ rows: [
      [{ key: 'provider', label: 'Δικαιούχος', input: 'text', dest: 'expenses.description, ταίριασμα με λογαριασμό' }],
      [money('amount', 'Ποσό', 'expenses.amount (πληρωμένο)', true),
       { key: 'issue_date', label: 'Ημερομηνία πληρωμής', input: 'date', dest: 'expenses.date, property_documents.issue_date' }],
      [{ key: 'category', label: 'Κατηγορία', input: 'select', options: 'bill_category', dest: 'expenses.category' },
       { key: 'provider_afm', label: 'ΑΦΜ δικαιούχου', input: 'code', numeric: true, check: 'afm', dest: 'expenses.supplier_afm' }],
      [{ key: 'period_from', label: 'Αφορά από', input: 'date', dest: 'ταίριασμα με λογαριασμό, property_documents.period_from' },
       { key: 'period_to', label: 'Αφορά έως', input: 'date', dest: 'ταίριασμα με λογαριασμό, property_documents.period_to' }],
    ] }],
  },
  rent_in: {
    groups: [{ rows: [
      [{ key: 'tenant_name', label: 'Ενοικιαστής', input: 'text', dest: 'property_documents.supplier' }],
      [money('amount', 'Ποσό', 'property_documents.amount', true),
       { key: 'issue_date', label: 'Ημερομηνία είσπραξης', input: 'date', dest: 'property_documents.issue_date' }],
      [{ key: 'period_from', label: 'Αφορά από', input: 'date', dest: 'property_documents.period_from' },
       { key: 'period_to', label: 'Αφορά έως', input: 'date', dest: 'property_documents.period_to' }],
    ] }],
    note: `Σημείωσε την είσπραξη στην καρτέλα ${TENANTS}.`,
  },
  lease: {
    groups: [
      { title: 'Ενοικιαστής', rows: [
        [{ key: 'tenant_name', label: 'Ονοματεπώνυμο', input: 'text', required: true, dest: 'tenants.full_name' }],
        [{ key: 'afm', label: 'ΑΦΜ ενοικιαστή', input: 'code', numeric: true, check: 'afm', dest: 'tenants.afm' },
         { key: 'rent_due_day', label: 'Ημέρα πληρωμής', input: 'number', min: 1, max: 31, dest: 'tenants.rent_due_day' }],
      ] },
      { title: 'Όροι μίσθωσης', rows: [
        [money('monthly_rent', 'Μηνιαίο μίσθωμα', 'tenants.monthly_rent, δόσεις ενοικίου', true), money('deposit', 'Εγγύηση', 'tenants.deposit_amount')],
        [{ key: 'lease_start', label: 'Έναρξη', input: 'date', dest: 'tenants.lease_start' },
         { key: 'lease_end', label: 'Λήξη', input: 'date', dest: 'tenants.lease_end' }],
      ] },
    ],
  },
  deed: {
    groups: [
      { title: 'Αγορά', rows: [
        [{ key: 'purchase_date', label: 'Ημερομηνία αγοράς', input: 'date', dest: 'user_properties.purchase_date (μόνο αν λείπει)' },
         money('purchase_price', 'Τίμημα', 'user_properties.purchase_price (μόνο αν λείπει)')],
        [{ key: 'provider', label: 'Συμβολαιογράφος', input: 'text', dest: 'σημείωση στον Φάκελο' }],
      ] },
      { title: 'Ακίνητο', rows: [
        // Η αξία ολόκληρου του ακινήτου: ο ΕΝΦΙΑ κόβει μόνος του το μερίδιο.
        [{ key: 'obj_value', label: 'Αντικειμενική αξία', input: 'money', suffix: '€', hint: OBJ_VALUE_WHOLE, dest: 'user_properties.obj_value (μόνο αν λείπει)' },
         atakField('user_properties.atak (μόνο αν λείπει)')],
        [sqmField('sqm', 'Τετραγωνικά', 'user_properties.sqm (μόνο αν λείπει)'), yearBuilt],
      ] },
    ],
    note: FILL_ONLY_NOTE,
  },
  insurance: {
    groups: [{ rows: [
      [{ key: 'provider', label: 'Ασφαλιστική', input: 'text', required: true, dest: 'property_settings.insurance_company, user_properties.insurance_company' }],
      [{ key: 'policy_number', label: 'Αριθμός συμβολαίου', input: 'code', dest: 'property_settings.insurance_policy' },
       { key: 'expiry_date', label: 'Λήξη ασφάλισης', input: 'date', dest: 'property_settings.insurance_expiry, user_properties.insurance_expiry, Ημερολόγιο: λήξη' }],
      [money('premium', 'Ετήσιο ασφάλιστρο', 'Δαπάνες: Ασφάλεια Κτιρίου'),
       { ...issueDate, dest: 'expenses.date, property_documents.issue_date' }],
    ] }],
  },
  pea: {
    groups: [{ rows: [
      [{ key: 'pea_class', label: 'Ενεργειακή κατηγορία', input: 'select', options: 'pea_class', dest: 'user_properties.pea_class' }],
      [issueDate, { key: 'expiry_date', label: 'Λήξη', input: 'date', dest: 'Ημερολόγιο: λήξη ΠΕΑ' }],
    ] }],
  },
  ama: {
    groups: [{ rows: [
      [{ key: 'ama', label: 'ΑΜΑ', input: 'code', numeric: true, check: 'ama', dest: 'user_properties.ama (μόνο αν λείπει)' }, issueDate],
    ] }],
  },
  enfia: {
    groups: [{ rows: [
      [lineField('Ακίνητο στο εκκαθαριστικό')],
      [taxYear, money('property_amount', 'Ποσό για αυτό το ακίνητο', 'Δαπάνες: ΕΝΦΙΑ')],
      [{ key: 'due_date', label: 'Λήξη 1ης δόσης', input: 'date', dest: 'expenses.date' }, atakField('user_properties.atak (μόνο αν λείπει)')],
    ] }],
    // ΤΟ ΕΚΚΑΘΑΡΙΣΤΙΚΟ ΕΙΝΑΙ ΑΝΑ ΑΦΜ, ΟΧΙ ΑΝΑ ΑΚΙΝΗΤΟ. Το σύνολο ως δαπάνη αυτού
    // του ακινήτου θα φόρτωνε σε ένα διαμέρισμα τον φόρο και των άλλων.
    info: d => ((d.lines?.length ?? 0) !== 1 && !has(d.property_amount)
      ? 'Το εκκαθαριστικό ΕΝΦΙΑ αφορά όλα τα ακίνητα του ΑΦΜ. Γράψε το ποσό που αναλογεί σε αυτό· το σύνολο μένει στο έγγραφο.'
      : ''),
  },
  e9: {
    groups: [{ rows: [
      [lineField('Ακίνητο στο Ε9')],
      [taxYear, atakField('user_properties.atak (μόνο αν λείπει)')],
      [sqmField('sqm', 'Τ.μ. κύριων χώρων', 'user_properties.sqm (μόνο αν λείπει, με ΑΤΑΚ)'),
       sqmField('storage_sqm', 'Τ.μ. βοηθητικών', 'user_properties.storage_sqm (μόνο αν λείπει, με ΑΤΑΚ)')],
      [{ key: 'floor', label: 'Όροφος', input: 'text', dest: 'user_properties.floor (μόνο αν λείπει, με ΑΤΑΚ)' },
       { ...yearBuilt, dest: 'user_properties.year_built (μόνο αν λείπει, με ΑΤΑΚ)' }],
    ] }],
    note: FILL_ONLY_NOTE,
  },
  e1: taxForm({ ...issueDate, label: 'Ημερομηνία υποβολής' }),
  e2: {
    ...taxForm({ ...issueDate, label: 'Ημερομηνία υποβολής' }),
    // Η σύγκριση με τα μισθώματα ζει στη Λογιστική, που διαβάζει τις γραμμές του
    // εντύπου. Η οθόνη επιτυχίας ανοίγει εκεί με ένα πάτημα.
    info: () => `Για σύγκριση με τα μισθώματα της εφαρμογής, το Ε2 ανεβαίνει και στη ${navLabel('accounting')}· μετά την καταχώρηση ανοίγει από εδώ με ένα πάτημα.`,
  },
  e3: taxForm({ ...issueDate, label: 'Ημερομηνία υποβολής' }),
  income_tax: {
    groups: [{ rows: [
      [taxYear, money('amount', 'Ποσό', 'property_documents.amount')],
      [{ key: 'due_date', label: 'Λήξη 1ης δόσης', input: 'date', dest: 'Ημερολόγιο: 1η δόση' }, issueDate],
    ] }],
  },
  tax: {
    groups: [{ rows: [
      [{ key: 'provider', label: 'Φορέας', input: 'text', dest: 'property_documents.supplier' }],
      [taxYear, money('amount', 'Ποσό', 'Ημερολόγιο, property_documents.amount')],
      [{ key: 'due_date', label: 'Λήξη', input: 'date', dest: 'Ημερολόγιο: πληρωμή' }, issueDate],
    ] }],
  },
  government: {
    groups: [{ rows: [
      [{ key: 'title', label: 'Τίτλος', input: 'text', dest: 'property_documents.title' }],
      [{ key: 'provider', label: 'Φορέας', input: 'text', dest: 'property_documents.supplier' },
       { key: 'issue_date', label: 'Ημερομηνία', input: 'date', dest: 'property_documents.doc_date' }],
    ] }],
  },
  other: {
    groups: [{ rows: [
      [{ key: 'title', label: 'Τίτλος', input: 'text', dest: 'property_documents.title' }],
      [{ key: 'provider', label: 'Σχετικό με', input: 'text', dest: 'property_documents.supplier' },
       { key: 'issue_date', label: 'Ημερομηνία', input: 'date', dest: 'property_documents.doc_date' }],
    ] }],
  },
};

/** Μία ομάδα πεδίων της φόρμας: προαιρετικός υπότιτλος και σειρές (1 πεδίο = πλήρες πλάτος, 2 = ζεύγος). */
export interface DocFormGroup { title?: string; rows: DocField[][] }
export interface DocForm { kind: DocKind; groups: DocFormGroup[]; note?: string; info?: string }

/**
 * Η φόρμα όπως φαίνεται ΤΩΡΑ για αυτό το έγγραφο: τα πεδία με `when` που δεν
 * ισχύουν έχουν φύγει, οι κενές σειρές και ομάδες επίσης. `null` όταν δεν έχει
 * διαλεχτεί τύπος· τότε η φόρμα δεν δείχνει πεδία.
 */
export function docForm(doc: ScannedDoc): DocForm | null {
  const kind = kindOf(doc);
  if (!kind) return null;
  const spec = KIND_FORMS[kind.value];
  const groups = spec.groups
    .map(g => ({ ...(g.title ? { title: g.title } : {}), rows: g.rows.map(r => r.filter(f => !f.when || f.when(doc))).filter(r => r.length > 0) }))
    .filter(g => g.rows.length > 0);
  const info = spec.info?.(doc);
  return { kind, groups, ...(spec.note ? { note: spec.note } : {}), ...(info ? { info } : {}) };
}

const visibleFields = (doc: ScannedDoc): DocField[] =>
  (docForm(doc)?.groups || []).flatMap(g => g.rows.flat());

// ── ΖΕΥΓΟΣ ΣΤΟ ΤΗΛΕΦΩΝΟ ΜΟΝΟ ΓΙΑ ΣΥΝΤΟΜΕΣ ΤΙΜΕΣ ───────────────────────────
// Στο τηλέφωνο η στήλη ζεύγους είναι 148 εικονοστοιχεία και δίπλα στο «€»
// μένουν 112: το «150.000,00» φαινόταν «150.000,0», ο αριθμός παροχής
// «1 23456789-0». Το βήμα ελέγχου υπάρχει για να συγκρίνεις την τιμή με το
// χαρτί, οπότε κομμένη τιμή είναι χαμένο βήμα. Δύο στήλες μένουν μόνο όπου
// κάθε τιμή έχει γνωστό και μικρό πλάτος: ημερομηνία, μικρός αριθμός, έτος,
// κατηγορία ΠΕΑ και κωδικός σταθερού μήκους (ΑΦΜ, ΑΤΑΚ, ΑΜΑ).
const isShortField = (f: DocField): boolean =>
  f.input === 'date' || f.input === 'number'
  || (f.input === 'select' && (f.options === 'tax_year' || f.options === 'pea_class'))
  || (f.input === 'code' && !!f.check);

/** Η σειρά κρατά δύο στήλες και στο τηλέφωνο: όλες οι τιμές της είναι σύντομες. */
export const compactRow = (row: DocField[]): boolean => row.length > 1 && row.every(isShortField);

// ── Τιμές, επιλογές και αλλαγές πεδίων ────────────────────────────────────
const TAX_YEARS_BACK = 5;

/** Οι επιλογές ενός πεδίου επιλογής. `today` (ISO) ορίζει τα έτη. */
export function fieldOptions(f: DocField, doc: ScannedDoc, today: string): Choice[] {
  switch (f.options) {
    case 'bill_category': return BILL_CATEGORIES;
    case 'billing_period':
      return (Object.keys(PERIOD_LABEL) as BillingPeriod[]).map(p => ({ value: p, label: PERIOD_LABEL[p] }));
    case 'pea_class': return PEA_CLASSES.map(c => ({ value: c, label: c }));
    case 'tax_year': {
      // Τρέχον έτος και πέντε πίσω, μαζί με ό,τι διάβασε η σάρωση αν είναι εκτός.
      const now = Number(String(today).slice(0, 4));
      const years = now > 0 ? Array.from({ length: TAX_YEARS_BACK + 1 }, (_, i) => now - i) : [];
      if (doc.tax_year && !years.includes(doc.tax_year)) years.push(doc.tax_year);
      return years.sort((a, b) => b - a).map(y => ({ value: String(y), label: String(y) }));
    }
    case 'line':
      // ΤΗ ΔΙΚΗ ΣΟΥ ΓΡΑΜΜΗ ΤΗΝ ΑΝΑΓΝΩΡΙΖΕΙΣ ΑΠΟ ΤΟ ΜΕΓΕΘΟΣ, ΟΧΙ ΑΠΟ ΕΝΤΕΚΑ ΨΗΦΙΑ.
      // Ο σκέτος ΑΤΑΚ ήταν η μόνη ετικέτα: η γραμμή δείχνει τώρα «ΑΤΑΚ … · 80 m²»
      // (ή το ποσό στον ΕΝΦΙΑ) και από κάτω διεύθυνση, όροφο και έτος.
      return (doc.lines || []).map((l, i) => {
        const size = doc.subtype === 'enfia'
          ? (l.amount ? fe(l.amount) : '')
          : (l.sqm ? `${fn(l.sqm, l.sqm % 1 ? 2 : 0)} m²` : '');
        const head = [l.atak ? `ΑΤΑΚ ${l.atak}` : (l.address || ''), size].filter(Boolean).join(' · ') || `Γραμμή ${i + 1}`;
        const sub = [l.atak ? l.address : '', l.floor ? `Όροφος ${l.floor}` : '', l.year_built ? String(l.year_built) : '']
          .filter(Boolean).join(' · ');
        return { value: String(i), label: head, ...(sub ? { description: sub } : {}) };
      });
    default: return [];
  }
}

/**
 * Η ΡΗΤΗ ΑΠΑΝΤΗΣΗ «ΚΑΝΕΝΑ ΑΠΟ ΑΥΤΑ» ΕΙΝΑΙ ΑΛΛΟ ΠΡΑΓΜΑ ΑΠΟ ΤΟ «ΔΕΝ ΔΙΑΛΕΞΑ».
 * Η επιλογή του επιλογέα γραμμής για το ακίνητο που δεν είναι στο έγγραφο.
 * Η κενή τιμή μένει για το «δεν διάλεξες ακόμη».
 */
export const LINE_NONE: Choice = { value: '-1', label: 'Κανένα από αυτά' };

/** Ο πίνακας έχει γραμμές για διάλεγμα και ο χρήστης δεν έχει απαντήσει ακόμη. */
export const lineUnset = (doc: ScannedDoc): boolean =>
  (doc.lines?.length ?? 0) > 1 && (doc.subtype === 'enfia' || doc.subtype === 'e9') && doc.line == null;

/** Η τιμή ενός πεδίου όπως τη δείχνει η φόρμα (πάντα κείμενο). */
export function fieldValue(doc: ScannedDoc, f: DocField): string {
  if (f.key === 'category') return resolveBillCategory(doc);
  if (f.key === 'billing_period') return billingPeriod(doc.billing_period) ?? '';
  if (f.key === 'line') {
    if (doc.line === -1) return LINE_NONE.value;
    return doc.line != null && doc.line >= 0 && doc.lines?.[doc.line] ? String(doc.line) : '';
  }
  const v = doc[f.key];
  return v == null || typeof v === 'object' ? '' : String(v);
}

/**
 * Νέα τιμή σε ένα πεδίο, από ό,τι έγραψε ή διάλεξε ο χρήστης. Οι κωδικοί
 * καθαρίζουν εδώ (το ΑΦΜ σε ψηφία, ο ΑΤΑΚ στα έντεκα), ώστε η φόρμα να δείχνει
 * ό,τι θα αποθηκευτεί. Το κενό ΣΒΗΝΕΙ το κλειδί: δεν μένει ούτε «0» ούτε «».
 */
export function withField(doc: ScannedDoc, f: DocField, raw: string): ScannedDoc {
  if (f.key === 'line') return selectLine(doc, raw === '' ? -1 : Number(raw));
  const next: ScannedDoc = { ...doc };
  const bag = next as unknown as Record<string, unknown>;
  const put = (v: unknown) => { if (v === undefined || v === '') delete bag[f.key]; else bag[f.key] = v; };
  const s = String(raw ?? '');
  if (f.input === 'money' || f.input === 'number') {
    const n = parseFloat(s.replace(',', '.'));
    const clamped = !isFinite(n) || n === 0 ? undefined
      : f.min !== undefined && n < f.min ? f.min : f.max !== undefined && n > f.max ? f.max : n;
    put(clamped);
  } else if (f.options === 'tax_year') {
    put(Number(s) || undefined);
  } else if (f.check === 'afm') {
    put(digitsOnly(s));
  } else if (f.check === 'atak') {
    put(atakDigits(s));
  } else if (f.check === 'ama') {
    put(cleanAma(s));
  } else if (f.key === 'provider_country') {
    put(s.trim().toUpperCase().slice(0, 2));
  } else if (f.key === 'provider_vat') {
    put(s.replace(/\s/g, '').toUpperCase());
  } else {
    // Μόνο κενά είναι κενό: «   » στην Ασφαλιστική περνούσε τον έλεγχο
    // υποχρεωτικών και αποθήκευε ασφάλιση χωρίς εταιρεία. Το κείμενο με τιμή
    // κρατά τα κενά του όσο γράφεται («ΔΕΗ » πριν από το «Α.Ε.»).
    put(s.trim() ? s : '');
  }
  // Όταν ο χρήστης διορθώνει τις ημερομηνίες της περιόδου, το ελεύθερο κείμενο
  // («Ιούνιος 2026») που είχε διαβάσει η OCR παύει να ισχύει.
  if (f.key === 'period_from' || f.key === 'period_to') delete next.period;
  return next;
}

// ── Οι γραμμές του Ε9 και του ΕΝΦΙΑ ───────────────────────────────────────
const E9_LINE_KEYS = ['atak', 'sqm', 'storage_sqm', 'floor', 'year_built'] as const;

/**
 * Διαλέγει γραμμή του πίνακα και περνά τις τιμές της στα πεδία. Στον ΕΝΦΙΑ
 * ΑΤΑΚ και ποσό του ακινήτου· στο Ε9 ΑΤΑΚ, τετραγωνικά, όροφο και έτος.
 * Με −1 (καμία) τα πεδία αδειάζουν: τιμές άλλου ακινήτου δεν μένουν πίσω.
 */
export function selectLine(doc: ScannedDoc, i: number): ScannedDoc {
  const l = doc.lines?.[i];
  const next: ScannedDoc = { ...doc, line: l ? i : -1 };
  const bag = next as unknown as Record<string, unknown>;
  const set = (k: string, v: unknown) => { if (v == null || v === '') delete bag[k]; else bag[k] = v; };
  if (doc.subtype === 'enfia') {
    set('atak', l?.atak);
    set('property_amount', l?.amount);
  } else if (doc.subtype === 'e9') {
    for (const k of E9_LINE_KEYS) set(k, l?.[k]);
  }
  return next;
}

/**
 * Η προεπιλογή του επιλογέα γραμμής: η γραμμή με τον ΑΤΑΚ του ακινήτου. Δεν
 * αγγίζει έγγραφο με μία γραμμή (την έχει ήδη ανεβάσει η εξομάλυνση) ούτε
 * έγγραφο όπου ο χρήστης έχει ήδη διαλέξει.
 *
 * ΧΩΡΙΣ ΤΑΙΡΙΑΣΜΑ Ο ΕΠΙΛΟΓΕΑΣ ΜΕΝΕΙ ΑΝΑΠΑΝΤΗΤΟΣ, ΟΧΙ «ΚΑΝΕΝΑ». Ο νέος χρήστης
 * δεν έχει ακόμη ΑΤΑΚ στο προφίλ, δηλαδή αυτή είναι η συνηθισμένη περίπτωση:
 * ο επιλογέας άνοιγε στο «Κανένα από αυτά», ΑΤΑΚ και τετραγωνικά έμεναν κενά
 * και η φόρμα έδειχνε πλήρης. Τα πεδία αδειάζουν (τιμές άλλου ακινήτου δεν
 * μένουν πίσω) αλλά η ερώτηση μένει ανοιχτή και λέει «λείπει».
 */
export function withPropertyLine(doc: ScannedDoc, propertyAtak: string | null | undefined): ScannedDoc {
  if ((doc.lines?.length ?? 0) < 2 || doc.line != null) return doc;
  if (doc.subtype !== 'enfia' && doc.subtype !== 'e9') return doc;
  const want = isAtak(propertyAtak) ? atakDigits(propertyAtak) : '';
  const i = want ? (doc.lines || []).findIndex(l => atakDigits(l.atak) === want) : -1;
  if (i >= 0) return selectLine(doc, i);
  const cleared = selectLine(doc, -1);
  delete cleared.line;
  return cleared;
}

// ── 1) Κατηγοριοποίηση/επιδιόρθωση τύπου ─────────────────────────────────────
// ΤΟ ΜΟΝΤΕΛΟ ΚΕΡΔΙΖΕΙ ΟΤΑΝ ΕΙΝΑΙ ΣΥΓΚΕΚΡΙΜΕΝΟ. Πριν, τα ισχυρά πεδία και οι
// λέξεις-κλειδιά ελέγχονταν ΠΡΩΤΑ: ο ΑΤΑΚ του Ε9 το έκανε «τίτλο», η λέξη
// «έγγραφο» σε μια σημείωση έκανε τον λογαριασμό «κρατικό», το «κάλυψη 5G»
// έκανε το internet «ασφαλιστήριο» και η άρνηση «δεν περιέχει στοιχεία
// μισθωτηρίου» έκανε μια φωτογραφία «μισθωτήριο».
//
// Η σειρά τώρα: (1) όνομα εγγράφου στον ΤΙΤΛΟ, (2) ο έγκυρος και συγκεκριμένος
// τύπος του μοντέλου, (3) ισχυρά πεδία μόνο όταν το μοντέλο είπε «other»,
// (4) λέξεις μόνο σε τίτλο και πάροχο, μόνο στην αρχή λέξης. Οι σημειώσεις δεν
// ψάχνονται ποτέ: εκεί γράφονται και αρνήσεις.
const norm = (s?: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Η λέξη-κλειδί στην αρχή λέξης (όχι μέσα σε άλλη: το «αμα» της Καλαμαριάς). */
const startsWord = (hay: string, key: string) => new RegExp(`(?:^|[^\\p{L}\\p{N}])${esc(key)}`, 'u').test(hay);
/** Ολόκληρη λέξη (για σύντομους κωδικούς: «ε1», «πεα»). */
const wholeWord = (hay: string, key: string) => new RegExp(`(?:^|[^\\p{L}\\p{N}])${esc(key)}(?![\\p{L}\\p{N}])`, 'u').test(hay);

// Όνομα εγγράφου στον τίτλο: υπερισχύει και του μοντέλου.
const TITLE_NAMES: { type: DocType; keys: string[] }[] = [
  { type: 'lease',      keys: ['μισθωτηρ', 'συμφωνητικο μισθωσ'] },
  { type: 'insurance',  keys: ['ασφαλιστηρ'] },
  { type: 'deed',       keys: ['τιτλος ιδιοκτησ', 'τιτλου ιδιοκτησ', 'συμβολαιο αγοραπωλησ'] },
  { type: 'government', keys: ['πιστοποιητικο ενεργειακ'] },
];

const TYPE_KEYWORDS: { type: DocType; keys: string[] }[] = [
  { type: 'lease',      keys: ['μισθωτηρ', 'μισθωση', 'συμφωνητικο μισθ', 'εκμισθωτ', 'μισθωτ', 'lease', 'tenancy'] },
  { type: 'insurance',  keys: ['ασφαλιστηριο', 'ασφαλιστρ', 'ασφαλιση', 'insurance', 'policy', 'interamerican', 'ethniki asfalis', 'εθνικη ασφαλ', 'generali', 'allianz', 'ergo', 'υδρογειος'] },
  { type: 'payment',    keys: ['αποδειξη πληρωμ', 'βεβαιωση πληρωμ', 'εξοφληθηκε', 'εξοφληση', 'πληρωθηκε', 'receipt', 'paid', 'payment confirmation', 'αποδεικτικο πληρωμ'] },
  { type: 'tax',        keys: ['ενφια', 'φορολογ', 'φορος ακινητ', 'φορου εισοδηματος', 'δηλωση στοιχειων', 'πραξη διοικητικου προσδιορισμου', 'τελος ακινητ'] },
  { type: 'deed',       keys: ['τιτλος ιδιοκτησ', 'συμβολαιο αγορ', 'αγοραπωλησ', 'συμβολαιογραφ', 'μεταγραφη', 'κτηματολογ', 'deed', 'αντικειμενικη αξ'] },
  { type: 'government', keys: ['πολεοδομ', 'βεβαιωση', 'δημος', 'υπηρεσια δομησ', 'αυθαιρετ', 'ταυτοτητα κτιρι', 'μηχανικ', 'πιστοποιητικ', 'ενεργειακης αποδοσης'] },
];

// Ο υποτύπος από το κείμενο. Η σειρά μετράει: η «πράξη προσδιορισμού» είναι
// και του ΕΝΦΙΑ και του φόρου εισοδήματος, οπότε ο ΕΝΦΙΑ ελέγχεται πρώτος.
const SUBTYPE_TEXT: { subtype: DocSubtype; starts?: string[]; words?: string[] }[] = [
  { subtype: 'enfia',      starts: ['ενφια', 'enfia'] },
  { subtype: 'income_tax', starts: ['φορου εισοδηματος', 'εκκαθαριστικο σημειωμα', 'income tax'] },
  { subtype: 'e9',         starts: ['δηλωση στοιχειων ακινητων'], words: ['ε9', 'e9'] },
  { subtype: 'e1',         starts: ['δηλωση φορολογιας εισοδηματος'], words: ['ε1', 'e1'] },
  { subtype: 'e2',         starts: ['αναλυτικη κατασταση μισθωματων', 'κατασταση μισθωματων'], words: ['ε2', 'e2'] },
  { subtype: 'e3',         starts: ['κατασταση οικονομικων στοιχειων'], words: ['ε3', 'e3'] },
  { subtype: 'pea',        starts: ['ενεργειακης αποδοσης'], words: ['πεα'] },
  { subtype: 'ama',        starts: ['βραχυχρονιας διαμονης', 'μητρωο ακινητων βραχυχρονιας'], words: ['αμα'] },
];

const SUBTYPE_TYPE = DOC_KINDS.reduce((a, k) => { if (k.subtype) a[k.subtype] = k.doc_type; return a; }, {} as Record<DocSubtype, DocType>);

function subtypeFromText(hay: string): DocSubtype | undefined {
  return SUBTYPE_TEXT.find(r => (r.starts || []).some(k => startsWord(hay, k)) || (r.words || []).some(k => wholeWord(hay, k)))?.subtype;
}

const VALID_TYPES = new Set<DocType>(DOC_TYPES.map(t => t.id));

export function classifyDocType(doc: Partial<ScannedDoc>): DocType {
  // Δεν είναι έγγραφο: τίποτα από τα παρακάτω δεν το κάνει έγγραφο.
  if (doc.is_document === false) return 'other';
  const title = norm(doc.title);
  const hay = norm([doc.title, doc.provider].filter(Boolean).join(' '));

  // (1) Το όνομα του εγγράφου ΣΤΗΝ ΑΡΧΗ του τίτλου υπερισχύει, εκτός αν το
  // μοντέλο έδωσε ζεύγος τύπου και υποτύπου που υπάρχει στα είδη. Αρκούσε η
  // λέξη οπουδήποτε: η «Απόδειξη είσπραξης ενοικίου βάσει μισθωτηρίου»
  // (payment, rent_in) γινόταν μισθωτήριο, ο υποτύπος έσβηνε και η φόρμα
  // ζητούσε ενοικιαστή για τους Ενοικιαστές.
  const exactPair = !!doc.subtype && DOC_KINDS.some(k => k.doc_type === doc.doc_type && k.subtype === doc.subtype);
  if (!exactPair) {
    const lead = title.replace(/^[^\p{L}\p{N}]+/u, '');
    for (const { type, keys } of TITLE_NAMES) {
      if (keys.some(k => lead.startsWith(k))) return type;
    }
  }
  // (2) Σεβασμός στην πρόταση του AI αν είναι έγκυρη ΚΑΙ συγκεκριμένη.
  if (doc.doc_type && doc.doc_type !== 'other' && VALID_TYPES.has(doc.doc_type)) return doc.doc_type;

  // (3) Ισχυρές ενδείξεις από ειδικά πεδία. ΟΧΙ ΑΤΑΚ και αντικειμενική: τα
  // γράφουν και ο ΕΝΦΙΑ και το Ε9.
  if (doc.monthly_rent || doc.lease_start) return 'lease';
  if (doc.policy_number || doc.premium) return 'insurance';
  if (doc.purchase_price || doc.purchase_date) return 'deed';

  // (4) Λέξεις-κλειδιά σε τίτλο και πάροχο (προτεραιότητα: ειδικά → γενικά).
  for (const { type, keys } of TYPE_KEYWORDS) {
    if (keys.some(k => startsWord(hay, k))) return type;
  }
  const st = subtypeFromText(hay);
  if (st) return SUBTYPE_TYPE[st];

  // Αν μοιάζει με λογαριασμό (έχει κατηγορία παρόχου + ποσό), θεώρησέ το λογαριασμό.
  if (doc.category && doc.category !== 'other' && doc.amount) return 'bill';

  return 'other';
}

/** Ο υποτύπος από τίτλο και πάροχο, μόνο αν ανήκει στον τύπο του εγγράφου. */
export function classifySubtype(doc: Partial<ScannedDoc>): DocSubtype | undefined {
  const st = subtypeFromText(norm([doc.title, doc.provider].filter(Boolean).join(' ')));
  return st && SUBTYPE_TYPE[st] === doc.doc_type ? st : undefined;
}

// ── 2) Επικύρωση: τι λείπει ανά τύπο ─────────────────────────────────────────
export const DOC_FIELD_LABELS: Record<string, string> = {
  kind: 'Τύπος εγγράφου',
  provider: 'Πάροχος / Αντισυμβαλλόμενος', amount: 'Ποσό', due_date: 'Ημ. λήξης',
  provider_afm: 'ΑΦΜ παρόχου', period_from: 'Περίοδος από', period_to: 'Περίοδος έως',
  issue_date: 'Ημ. έκδοσης',
  tenant_name: 'Ονοματεπώνυμο ενοικιαστή', monthly_rent: 'Μηνιαίο ενοίκιο',
  lease_start: 'Έναρξη μίσθωσης', lease_end: 'Λήξη μίσθωσης', deposit: 'Εγγύηση', afm: 'ΑΦΜ ενοικιαστή',
  premium: 'Ασφάλιστρο', expiry_date: 'Λήξη ασφάλισης', policy_number: 'Αριθμός συμβολαίου',
  purchase_price: 'Τίμημα αγοράς', obj_value: 'Αντικειμενική αξία', title: 'Τίτλος',
  tax_year: 'Έτος', category: 'Κατηγορία', atak: 'ΑΤΑΚ', ama: 'ΑΜΑ',
  property_amount: 'Ποσό για αυτό το ακίνητο',
};

// Κείμενο μόνο με κενά δεν είναι τιμή: δεν περνά τον έλεγχο υποχρεωτικών ούτε
// γράφεται ως στοιχείο του ακινήτου.
const has = (v: unknown) => v != null && !(typeof v === 'string' && !v.trim()) && !(typeof v === 'number' && v === 0);
const iso = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '');
/** Ανάποδη περίοδος: το «από» μετά το «έως» δεν είναι ελλιπές, είναι λάθος. */
const reversedPeriod = (d: ScannedDoc) => !!iso(d.period_from) && !!iso(d.period_to) && iso(d.period_from) > iso(d.period_to);

export interface DocValidation {
  /** Χωρίς αυτά δεν αποθηκεύουμε — θα γραφτεί σκουπίδι στη βάση. */
  blocking: string[];
  /** Καλό να υπάρχουν· ο χρήστης μπορεί να προχωρήσει. Το δείχνει το μαζικό ανέβασμα. */
  recommended: string[];
  /** Υπάρχουν ΑΛΛΑ είναι προφανώς λάθος (π.χ. ΑΦΜ που δεν περνά το checksum). Δεν γράφονται. */
  invalid: string[];
}

/**
 * Τι λείπει και τι είναι λάθος. Τα υποχρεωτικά τα ορίζει η φόρμα του είδους
 * (`required`), ώστε η φόρμα και ο έλεγχος να μην μπορούν να διαφωνήσουν.
 * ΔΕΝ μπλοκάρουμε τον χρήστη επειδή το χαρτί ήταν θολό: ΑΦΜ και περίοδος είναι
 * *recommended* για λογαριασμό — τα ζητάμε, δεν τα απαιτούμε.
 */
export function validateDoc(doc: ScannedDoc): DocValidation {
  const blocking: string[] = [];
  const recommended: string[] = [];
  const invalid: string[] = [];

  // Ό,τι είναι γραμμένο και δεν περνά τον έλεγχό του, το λέμε — δεν το σώζουμε
  // σιωπηλά ως σωστό.
  if (has(doc.provider_afm) && !isValidAfm(doc.provider_afm)) invalid.push('provider_afm');
  if (has(doc.afm) && !isValidAfm(doc.afm)) invalid.push('afm');
  if (has(doc.atak) && !isAtak(doc.atak)) invalid.push('atak');
  if (has(doc.ama) && !isValidAmaFormat(doc.ama)) invalid.push('ama');
  if (reversedPeriod(doc)) invalid.push('period_from');

  const kind = kindOf(doc);
  if (!kind) return { blocking: ['kind'], recommended, invalid };
  for (const f of visibleFields(doc)) {
    if (f.required && !has(doc[f.key]) && !blocking.includes(f.key)) blocking.push(f.key);
  }

  switch (kind.value) {
    case 'bill':
    case 'payment':
      if (!has(doc.provider)) recommended.push('provider');
      if (kind.value === 'bill' && !has(doc.due_date)) recommended.push('due_date');
      // Τα δύο πεδία που έλειπαν τελείως από τη ροή. Χωρίς ΑΦΜ ο πάροχος είναι
      // ένα όνομα με δέκα ορθογραφίες· χωρίς περίοδο, δύο ίδιοι λογαριασμοί
      // διαφορετικού μήνα είναι ξεχώριστοι μόνο κατά τύχη.
      if (!has(doc.provider_afm)) recommended.push('provider_afm');
      if (!has(doc.period_from) || !has(doc.period_to)) recommended.push('period_from');
      break;
    case 'lease':
      if (!has(doc.lease_start)) recommended.push('lease_start');
      if (!has(doc.lease_end)) recommended.push('lease_end');
      if (!has(doc.deposit)) recommended.push('deposit');
      break;
    case 'insurance':
      if (!has(doc.premium)) recommended.push('premium');
      if (!has(doc.expiry_date)) recommended.push('expiry_date');
      break;
    case 'deed':
      if (!has(doc.purchase_price) && !has(doc.obj_value)) recommended.push('purchase_price');
      break;
    case 'government':
    case 'other':
      if (!has(doc.title) && !has(doc.provider)) recommended.push('title');
      break;
    // Τα φορολογικά έντυπα δεν ζητούν ποσό: το Ε1 δεν «κοστίζει» τίποτα.
  }
  return { blocking, recommended, invalid };
}

/**
 * Έγγραφο ή φωτογραφία χώρου; Ντετερμινιστικός κανόνας: αν η ανάγνωση δεν
 * βρήκε ΚΑΝΕΝΑ στοιχείο εγγράφου (ούτε πάροχο, ούτε ποσό, ούτε τίτλο, ούτε
 * ημερομηνία…), δεν είναι έγγραφο. Το `is_document: false` του μοντέλου το
 * λέει ρητά. Ζούσε μέσα στο scanFile και η οθόνη σάρωσης δεν το ρωτούσε.
 */
export function isDocumentary(d: Partial<ScannedDoc>): boolean {
  if (d.is_document === false) return false;
  return !!(d.provider || d.amount || d.title || d.due_date || d.issue_date
    || d.tenant_name || d.monthly_rent || d.premium || d.policy_number || d.atak || d.purchase_price
    || d.tax_year || d.ama || d.pea_class || d.lines?.length);
}

// ── 2β) Κανονικοποίηση μετά την OCR ─────────────────────────────────────────
/**
 * Ε9 ή ΕΝΦΙΑ με ΜΙΑ γραμμή: οι τιμές της ανεβαίνουν στα πεδία, ΜΙΑ φορά. Το
 * `line` σημειώνει ότι έγινε, ώστε ένα δεύτερο πέρασμα (η εξομάλυνση της
 * καταχώρησης) να μην ξαναγεμίσει ό,τι άδειασε ο χρήστης και να μη γραφτεί
 * τιμή που δεν είδε. Με πολλές γραμμές διαλέγει ο χρήστης (withPropertyLine).
 */
function liftSingleLine(doc: ScannedDoc): ScannedDoc {
  if (doc.doc_type !== 'tax' || doc.line != null || doc.lines?.length !== 1
    || (doc.subtype !== 'enfia' && doc.subtype !== 'e9')) return doc;
  const out: ScannedDoc = { ...doc, line: 0 };
  const l = doc.lines[0];
  if (!out.atak && l.atak) out.atak = l.atak;
  if (out.subtype === 'enfia') {
    // Ένα ακίνητο στο εκκαθαριστικό: το σύνολο ΕΙΝΑΙ το ποσό του ακινήτου.
    const a = l.amount ?? out.amount;
    if (out.property_amount == null && a) out.property_amount = a;
  } else {
    if (out.sqm == null && l.sqm) out.sqm = l.sqm;
    if (out.storage_sqm == null && l.storage_sqm) out.storage_sqm = l.storage_sqm;
    if (out.floor == null && l.floor) out.floor = l.floor;
    if (out.year_built == null && l.year_built) out.year_built = l.year_built;
  }
  return out;
}

/**
 * Ντετερμινιστική εξομάλυνση ενός σαρωμένου εγγράφου, ΠΡΙΝ φανεί στον χρήστη.
 * Δεν μαντεύει τιμές: καθαρίζει κωδικούς, κρατά μόνο έγκυρους υποτύπους και
 * κατηγορίες ΠΕΑ, μεταφράζει την περίοδο από κείμενο σε δύο ημερομηνίες όταν
 * το κείμενο το λέει ρητά και ανεβάζει τη μοναδική γραμμή Ε9/ΕΝΦΙΑ στα πεδία.
 * Καλείται από ΟΛΕΣ τις διαδρομές σάρωσης ώστε να μην αποκλίνουν και ξανά στην
 * καταχώρηση: είναι ταυτοδύναμη και δεν πατά επιλογές του χρήστη.
 */
export function normalizeScannedDoc(doc: ScannedDoc): ScannedDoc {
  const out: ScannedDoc = { ...doc };
  const afm = digitsOnly(out.provider_afm);
  out.provider_afm = afm || undefined;
  if (out.afm) out.afm = digitsOnly(out.afm) || undefined;
  if (out.customer_afm) out.customer_afm = digitsOnly(out.customer_afm) || undefined;
  // Ο ΑΡΙΘΜΟΣ ΦΠΑ ΔΕΝ ΕΙΝΑΙ ΨΗΦΙΑ. Κρατά το πρόθεμα κράτους μέλους και συχνά
  // γράμματα στο σώμα του («NL857927374B01»): ένα `digitsOnly` εδώ θα έσβηνε
  // ακριβώς την πληροφορία για την οποία τον ζητάμε.
  if (out.provider_vat) out.provider_vat = String(out.provider_vat).replace(/[\s.-]/g, '').toUpperCase() || undefined;
  // Δύο κεφαλαία γράμματα ή τίποτα: το «Ιρλανδία» και το «Ireland» δεν είναι
  // κωδικοί και μια μισή τιμή σε πεδίο χώρας ταξιδεύει ως τη δήλωση ΦΠΑ.
  if (out.provider_country) {
    const c = String(out.provider_country).trim().toUpperCase();
    out.provider_country = /^[A-Z]{2}$/.test(c) ? c : undefined;
  }
  if (!out.period_from || !out.period_to) {
    const p = derivePeriod(out.period);
    if (p) { out.period_from = out.period_from || p.from; out.period_to = out.period_to || p.to; }
  }

  // Ο υποτύπος μένει μόνο αν το ζεύγος υπάρχει στα είδη. Αλλιώς φεύγει και,
  // για φορολογικά και κρατικά, ξαναβγαίνει από τον τίτλο. Το `null` είναι
  // επιλογή του χρήστη («Άλλο φορολογικό») και δεν ξαναβγαίνει.
  if (out.subtype !== null) {
    const valid = !!out.subtype && DOC_KINDS.some(k => k.doc_type === out.doc_type && k.subtype === out.subtype);
    if (!valid) {
      const derived = out.doc_type === 'tax' || out.doc_type === 'government' ? classifySubtype(out) : undefined;
      if (derived) out.subtype = derived; else delete out.subtype;
    }
  }
  if (out.pea_class != null) { const c = peaClassOf(out.pea_class); if (c) out.pea_class = c; else delete out.pea_class; }
  if (out.ama != null) { const a = cleanAma(String(out.ama)); if (a) out.ama = a; else delete out.ama; }
  if (out.rent_due_day != null) {
    const n = Math.round(Number(out.rent_due_day));
    if (n >= 1 && n <= 31) out.rent_due_day = n; else delete out.rent_due_day;
  }
  if (out.floor != null) { const f = String(out.floor).trim(); if (f) out.floor = f; else delete out.floor; }
  if (out.lines != null) {
    if (Array.isArray(out.lines)) out.lines = out.lines.filter(l => l && typeof l === 'object').slice(0, SCAN_MAX_LINES);
    else delete out.lines;
  }

  // Ε9 ή ΕΝΦΙΑ με ΜΙΑ γραμμή: οι τιμές της ανεβαίνουν στα πεδία.
  return liftSingleLine(out);
}

// ── 3) Σχέδιο αποθήκευσης: πού γράφεται ──────────────────────────────────────
/**
 * Το παραστατικό όπως γράφεται στο Αρχείο (property_documents).
 * ΓΙΑΤΙ ΚΡΑΤΑ ΝΟΥΜΕΡΑ: μέχρι σήμερα κρατούσε μόνο κατηγορία/ημερομηνία/πάροχο,
 * και το ποσό ζούσε αποκλειστικά στα κάτοπτρα (bills/expenses). Δηλαδή η οθόνη
 * που η στρατηγική ονομάζει «η ανεξάρτητη απόδειξη» δεν μπορούσε να απαντήσει
 * «πόσα πλήρωσα σύμφωνα με τα δικά μου χαρτιά».
 */
export interface ArchivePlan {
  category: string;
  /** Ο τίτλος στο Αρχείο: του είδους με το έτος («ΕΝΦΙΑ 2025», «Ε9 2025») ή του εγγράφου. */
  title?: string;
  note?: string;
  date?: string;          // → doc_date (ημερομηνία ταξινόμησης)
  supplier?: string;
  amount?: number;        // → amount        (undefined = δεν διαβάστηκε, ΠΟΤΕ 0)
  provider_afm?: string;  // → provider_afm  (μόνο αν περνά το checksum)
  period_from?: string;   // → period_from
  period_to?: string;     // → period_to
  issue_date?: string;    // → issue_date    (έκδοση, διακριτή από το doc_date)
}

export interface SavePlan {
  targets: string[];                        // ετικέτες για την οθόνη «Θα ενημερωθούν»
  bill?:     Record<string, unknown>;        // → bills (το component βάζει property_id/user_id)
  expense?:  Record<string, unknown>;        // → expenses (link bill_id αν υπάρχει)
  calendar?: EventDraft[];                   // → calendar_events (link bill_id αν υπάρχει)
  tenant?:   Record<string, unknown>;        // → tenants (upsert ανά property)
  /** Στο user_properties, ΜΟΝΟ τα κενά (fillOnlyEmpty): ό,τι ξέρει ο ιδιοκτήτης δεν αλλάζει. */
  property?: Record<string, unknown>;
  /** Στο user_properties με αντικατάσταση (stripEmpty): ό,τι ανανεώνεται (ασφάλιση, ΠΕΑ). */
  propertyReplace?: Record<string, unknown>;
  /**
   * ΤΟ ΠΑΛΙΟ ΧΑΡΤΙ ΔΕΝ ΣΒΗΝΕΙ ΤΟ ΝΕΟ. Η αντικατάσταση (`propertyReplace` και
   * `settings`) γράφεται μόνο όταν η στήλη-φρουρός της βάσης είναι κενή ή
   * παλαιότερη από αυτή την ημερομηνία. Χωρίς αυτό, η αρχειοθέτηση του
   * περσινού ασφαλιστηρίου γύριζε πίσω τη λήξη και η υπενθύμιση της
   * πραγματικής λήξης χανόταν.
   */
  replaceIfNewer?: { column: string; value: string };
  /**
   * Ο ΙΔΙΟΣ ΦΡΟΥΡΟΣ, ΟΤΑΝ Η ΗΜΕΡΟΜΗΝΙΑ ΔΕΝ ΕΧΕΙ ΣΤΗΛΗ. Το ακίνητο κρατά μόνο
   * την κατηγορία του ΠΕΑ, χωρίς έκδοση ή λήξη: το νεότερο σαρωμένο ΠΕΑ (Β, λήξη
   * 2036) γύριζε σε Δ μόλις αρχειοθετούνταν ένα παλαιότερο που ισχύει ακόμη (λήξη
   * 2030). Η λήξη που ξέρει ήδη η εφαρμογή είναι το γεγονός του ημερολογίου με
   * αυτόν τον τίτλο: αντικατάσταση μόνο όταν η νέα λήξη είναι ίση ή μεταγενέστερη.
   * Παλαιότερο χαρτί: ούτε κατηγορία ούτε δεύτερη υπενθύμιση λήξης.
   */
  replaceIfNewerEvent?: { title: string; value: string };
  /** Στο property_settings με αντικατάσταση (ασφάλιση). */
  settings?: Record<string, unknown>;
  /** Στο property_settings, ΜΟΝΟ τα κενά (πάροχοι). */
  settingsFill?: Record<string, unknown>;
  /** Η ετικέτα της εγγραφής στο property_settings για την οθόνη «Καταχωρήθηκε». */
  settingsLabel?: string;
  archive?:  ArchivePlan;                    // → property_documents (το αρχείο πρωτότυπο)
  reconcile?: boolean;                       // payment: προσπάθησε συμφωνία με εκκρεμή λογαριασμό
  commonMonthAmount?: number;                // κοινόχρηστα: ποσό μήνα για ιστορικό
  /** Η θέση του ποσού στο Ιστορικό (0 = Ιανουάριος): ο μήνας του ΧΑΡΤΙΟΥ, όχι της σάρωσης. */
  commonMonthIndex?: number;
  commonMillesimi?:   number;                // κοινόχρηστα: χιλιοστά
}

/**
 * ΣΕ ΠΟΙΟΝ ΜΗΝΑ ΤΟΥ ΙΣΤΟΡΙΚΟΥ ΜΠΑΙΝΕΙ ΕΝΑ ΦΥΛΛΟ ΚΟΙΝΟΧΡΗΣΤΩΝ.
 *
 * Γραφόταν στον μήνα της ΣΑΡΩΣΗΣ, από το ρολόι της συσκευής: τα κοινόχρηστα
 * Σεπτεμβρίου που σαρώνονταν στις 18/10 έμπαιναν στο «Οκτ» και πατούσαν ό,τι
 * υπήρχε εκεί. Ο Δεκέμβριος που σαρωνόταν τον Ιανουάριο έμπαινε στον Ιανουάριο.
 * Χαλούσαν ο μέσος όρος και ο «ακριβότερος μήνας».
 *
 * Τώρα: ο μήνας της περιόδου του χαρτιού, αλλιώς της έκδοσης. Το Ιστορικό είναι
 * δώδεκα θέσεις ΧΩΡΙΣ έτος και δείχνει το τρέχον έτος, άρα χαρτί άλλης χρονιάς
 * δεν γράφεται εκεί (μένει στον Φάκελο). Χωρίς καμία ημερομηνία δεν μαντεύουμε.
 */
export function commonMonthOf(dates: (string | undefined)[], today: string): number | null {
  const d = dates.map(x => iso(x)).find(Boolean);
  if (!d || d.slice(0, 4) !== today.slice(0, 4)) return null;
  return Number(d.slice(5, 7)) - 1;
}

/** Ο τίτλος του γεγονότος λήξης ΠΕΑ: από αυτόν το βρίσκει και ο φρουρός. */
export const PEA_EXPIRY_TITLE = 'Λήξη ΠΕΑ';

// Ο κανόνας «συμπληρώνουμε κενά, δεν διορθώνουμε γεμάτα» ζει στο lib/core/prefill.ts,
// γιατί τον χρειάζεται και ο οδηγός προσθήκης ακινήτου — όχι μόνο η σάρωση.

// Δομημένη σημείωση κατανάλωσης (ίδια λογική με BillsAIScan) για λογαριασμούς.
function consumptionNote(d: ScannedDoc): string {
  return [
    d.kwh ? `${d.kwh} kWh` : '',
    d.cubic_meters ? `${d.cubic_meters} m³` : '',
    (d.meter_prev != null && d.meter_current != null) ? `Ένδειξη από ${d.meter_prev} σε ${d.meter_current}` : '',
    d.millesimi ? `${d.millesimi}‰` : '',
  ].filter(Boolean).join(' · ');
}

/** Ο αριθμός παροχής που γράφεται στο ακίνητο: μόνο ψηφία και τουλάχιστον όσα ζητά το Ε2. */
function powerSupplyOf(raw: string | undefined): string {
  const { value } = cleanDigits(raw);
  return value && value.length >= E2_POWER_SUPPLY_DIGITS ? value : '';
}

/** Μόνο τα κλειδιά με τιμή· `undefined` όταν δεν μένει κανένα. */
const filled = (o: Record<string, unknown>): Record<string, unknown> | undefined => {
  const r = Object.fromEntries(Object.entries(o).filter(([, v]) => has(v)));
  return Object.keys(r).length ? r : undefined;
};

/**
 * Καθαρή δρομολόγηση: από ScannedDoc → SavePlan. Δεν αγγίζει βάση.
 * @param doc   τα (επεξεργασμένα από τον χρήστη) πεδία
 * @param today ISO ημερομηνία σήμερα (περνιέται για ντετερμινιστικά τεστ)
 */
export function planDocSave(doc: ScannedDoc, today: string): SavePlan {
  // Χωρίς είδος (δεν είναι έγγραφο) μένει μόνο η αρχειοθέτηση.
  const kind = kindOf(doc) ?? KIND_BY_ID.other;
  const k = kind.value;
  const provider = (doc.provider || '').trim();
  const tenant = (doc.tenant_name || '').trim();
  const customNote = (doc.custom || []).filter(c => c.label && c.value)
    .map(c => `${c.label}: ${c.value}`).join(' · ');
  const baseNote = [doc.notes || '', customNote].filter(Boolean).join(' · ');
  // Ανάποδη περίοδος δεν γράφεται: είναι λάθος ανάγνωσης, όχι δεδομένο.
  const reversed = reversedPeriod(doc);
  const pFrom = reversed ? '' : iso(doc.period_from);
  const pTo = reversed ? '' : iso(doc.period_to);
  // Ημερομηνία εγγράφου για το Αρχείο — η πιο σχετική ανά τύπο.
  const archiveDate = iso(doc.issue_date) || iso(doc.due_date) || iso(doc.purchase_date)
    || iso(doc.lease_start) || iso(doc.expiry_date) || '';
  // ΤΟ ΠΟΣΟ ΤΟΥ ΕΓΓΡΑΦΟΥ ΤΟ ΟΡΙΖΕΙ ΤΟ ΕΙΔΟΣ. Το Ε1, το Ε9 και ο τίτλος δεν
  // έχουν «ποσό που πλήρωσα»· στον ΕΝΦΙΑ το Αρχείο κρατά το σύνολο του
  // εκκαθαριστικού, όχι το μερίδιο του ακινήτου.
  //
  // ΤΟ ΜΕΡΙΔΙΟ ΔΕΝ ΓΡΑΦΕΤΑΙ ΣΑΝ ΣΥΝΟΛΟ (20.10.2026). Χωρίς σύνολο, το Αρχείο
  // έπαιρνε το «Ποσό για αυτό το ακίνητο», δηλαδή ΜΕΡΙΔΙΟ, κάτω από τίτλο
  // «ΕΝΦΙΑ 2026». Από αυτό το ποσό βγαίνει πλέον πόσες δόσεις έχει το
  // εκκαθαριστικό: ένα μερίδιο 27€ από σύνολο 120€ θα έβγαζε δύο υπενθυμίσεις
  // αντί για δώδεκα. Το μερίδιο είναι σύνολο ΜΟΝΟ όταν το εκκαθαριστικό έχει
  // ένα ακίνητο (μία γραμμή)· αλλιώς το ποσό μένει «δεν διαβάστηκε».
  const docAmount = k === 'enfia' ? (doc.amount ?? (doc.lines?.length === 1 ? doc.property_amount : undefined))
    : kind.amountKey && kind.amountKey !== 'monthly_rent' ? doc[kind.amountKey] : undefined;
  const afm = digitsOnly(doc.provider_afm);
  const year = doc.tax_year ? String(doc.tax_year) : '';
  // Οι σημειώσεις και τα δικά σου πεδία («Όνομα: Τιμή») πάνε ΠΑΝΤΑ στον Φάκελο.
  const archive: ArchivePlan = {
    category: archiveCategoryFor(doc),
    note: baseNote || undefined,
    date: archiveDate || undefined,
    // Στην είσπραξη ενοικίου ο προμηθευτής ΕΙΝΑΙ ο ενοικιαστής: είναι το μόνο
    // πεδίο προσώπου της φόρμας. Ο «πάροχος» μιας κατάθεσης είναι συνήθως η
    // τράπεζα και, με τη σειρά «πάροχος πρώτα», ό,τι έγραφε ο χρήστης στον
    // Ενοικιαστή δεν αποθηκευόταν πουθενά.
    supplier: (k === 'rent_in' ? tenant || provider : provider || (k === 'lease' ? tenant : '')) || undefined,
    amount: typeof docAmount === 'number' && docAmount > 0 ? docAmount : undefined,
    provider_afm: afm && isValidAfm(afm) ? afm : undefined,
    period_from: pFrom || undefined,
    period_to: pTo || undefined,
    issue_date: iso(doc.issue_date) || undefined,
  };
  // Ο υποτύπος και το έτος ζουν στον τίτλο μέχρι να αποκτήσει στήλες το Αρχείο
  // («Ε9 2025»)· αλλιώς ο τίτλος του εγγράφου, όπως τον είδε ο χρήστης.
  const own = (doc.title || '').trim();
  const title = kind.doc_type === 'tax' && year
    ? (kind.subtype ? `${kind.short} ${year}` : own.includes(year) ? own : `${own || kind.short} ${year}`)
    : own;
  if (title) archive.title = title;

  if (k === 'bill' || k === 'payment') {
    const cat = resolveBillCategory(doc);
    const map = EXPENSE_MAP[cat];
    const paid = k === 'payment';
    const cons = consumptionNote(doc);
    const notes = [`AI σάρωση`, cons, baseNote, doc.account_num ? `Παροχή: ${doc.account_num}` : '']
      .filter(Boolean).join(' · ');
    const expDate = iso(doc.due_date) || iso(doc.issue_date) || today;
    // Η περίοδος γράφεται και στον λογαριασμό (`bills.period`, στήλη που υπήρχε και
    // έμενε κενή). Χωρίς αυτό, η επόμενη απόδειξη δεν έχει με τι να συγκρίνει την
    // περίοδό της και δύο μήνες ίδιου ποσού ξαναγίνονται διφορούμενοι.
    const periodText = (doc.period || '').trim() || (pFrom && pTo ? `${pFrom} έως ${pTo}` : '');

    const plan: SavePlan = {
      targets: paid ? [EXPENSES, BILLS] : [BILLS, EXPENSES],
      bill: {
        category: cat,
        name: `${provider || map.cat}${periodText ? ` — ${periodText}` : ''}`,
        period: periodText || null,
        amount: doc.amount || 0, paid, due_date: iso(doc.due_date) || null,
        kwh: doc.kwh || null, ert: doc.ert || null, etmear: doc.etmear || null,
        // Ο ΣΥΝΤΕΛΕΣΤΗΣ ΕΙΝΑΙ ΟΣΟΣ ΓΡΑΦΕΙ ΤΟ ΧΑΡΤΙ, ΑΛΛΙΩΣ ΚΑΝΕΝΑΣ. Εδώ γραφόταν
        // ψηφίο ΦΠΑ με το χέρι όποτε η ανάγνωση δεν έβρισκε συντελεστή.
        dimotika: doc.dimotika || null, vat_rate: typeof doc.vat_rate === 'number' ? doc.vat_rate : null,
        notes, recurring: false,
      },
      expense: {
        description: `${map.cat} — ${provider}${doc.period ? ` (${doc.period})` : ''}`,
        amount: doc.amount || 0, category: map.cat, expense_group: map.group,
        date: expDate, paid_by: 'owner', paid,
        // Ο ΤΟΠΟΣ ΠΑΡΟΧΗΣ ΤΑΞΙΔΕΥΕΙ ΩΣ ΔΕΔΟΜΕΝΟ, ΟΧΙ ΩΣ ΠΡΟΤΑΣΗ. Η χώρα βγαίνει
        // από το ίδιο το παραστατικό (ρητή δήλωση, πρόθεμα αριθμού ΦΠΑ, ή
        // έγκυρο ελληνικό ΑΦΜ) και το συμπέρασμα από τη χώρα. Ό,τι δεν λέει το
        // χαρτί μένει κενό: το NULL σημαίνει «δεν το ξέρουμε», ποτέ «εγχώρια».
        supplier_country: providerCountry(doc) || null,
        supply: docSupply(doc),
        // ΤΟ ΑΦΜ ΤΑΞΙΔΕΥΕΙ ΜΑΖΙ ΜΕ ΤΗ ΔΑΠΑΝΗ ΚΑΙ ΜΟΝΟ ΑΝ ΕΙΝΑΙ ΑΦΜ. Διαβάστηκε
        // ήδη από το παραστατικό και ελέγχθηκε με το checksum της ΑΑΔΕ· εδώ
        // ελέγχεται δεύτερη φορά, γιατί το `normalizeDoc` μπορεί να το άφησε
        // κενό. Χωρίς αυτό, ο λογιστής βλέπει «Υδραυλικός» και δεν έχει
        // αντισυμβαλλόμενο να καταχωρήσει.
        supplier_afm: isValidAfm(doc.provider_afm) ? String(doc.provider_afm) : null,
        notes: `Από σάρωση${cons ? ` · ${cons}` : ''}${baseNote ? ` · ${baseNote}` : ''}`,
      },
      archive,
      reconcile: paid,
    };
    // Υπενθύμιση πληρωμής μόνο για απλήρωτους λογαριασμούς με ημ. λήξης.
    if (!paid && iso(doc.due_date)) {
      plan.calendar = [{
        title: `Πληρωμή: ${provider || map.cat}`, category: 'bills',
        event_date: iso(doc.due_date), amount: doc.amount || 0,
        notes: `Από σάρωση${cons ? ` · ${cons}` : ''}`,
      }];
      plan.targets.push(CALENDAR);
    }

    // ── Η ΕΠΟΜΕΝΗ ΧΡΕΩΣΗ, ΟΤΑΝ ΤΟ ΧΑΡΤΙ ΛΕΕΙ ΚΑΘΕ ΠΟΤΕ ────────────────────
    // Ο χρήστης σαρώνει μια απόδειξη συνδρομής και δεν κάνει τίποτε άλλο. Αν το
    // παραστατικό γράφει «ετήσια», ξέρουμε πότε ξαναχρεώνεται: το app βάζει
    // μόνο του την ημερομηνία στο ημερολόγιο, ώστε να προλάβει να ακυρώσει ή να
    // αλλάξει πακέτο ΠΡΙΝ φύγουν τα χρήματα, όχι αφού.
    //
    // ΜΟΝΟ ΓΙΑ ΣΥΝΔΡΟΜΕΣ. Ο μηνιαίος λογαριασμός ΔΕΗ έβγαζε «Πρόλαβε να
    // ακυρώσεις…»: το ρεύμα δεν ακυρώνεται πριν τη χρέωση.
    //
    // Η ΑΦΕΤΗΡΙΑ ΕΙΝΑΙ Η ΕΚΔΟΣΗ, ΟΧΙ Η ΛΗΞΗ ΠΛΗΡΩΜΗΣ. Η ημερομηνία λήξης
    // πληρωμής είναι πότε πρέπει να πληρώσεις ΑΥΤΟ το παραστατικό· η επόμενη
    // περίοδος μετρά από τότε που εκδόθηκε.
    const period = SUBSCRIPTIONS.has(cat) ? billingPeriod(doc.billing_period) : null;
    const renewal = nextRenewal(iso(doc.issue_date) || expDate, period);
    if (renewal) {
      (plan.calendar ||= []).push({
        title: `Ανανέωση: ${provider || map.cat}`,
        category: 'contract',
        event_date: renewal,
        amount: doc.amount || null,
        priority: 'high',
        notes: [
          `${PERIOD_LABEL[period!]} χρέωση`,
          `Ειδοποίηση ${REMINDER_DAYS_BEFORE} ημέρες πριν, στις ${greekDay(reminderDate(renewal))}`,
          'Πρόλαβε να ακυρώσεις ή να αλλάξεις πακέτο πριν τη χρέωση',
        ].join(' · '),
      });
      if (!plan.targets.includes(CALENDAR)) plan.targets.push(CALENDAR);
    }
    if (cat === 'common') {
      const month = commonMonthOf([pFrom, pTo, doc.issue_date], today);
      if (doc.amount && month != null) { plan.commonMonthAmount = doc.amount; plan.commonMonthIndex = month; }
      if (doc.millesimi) plan.commonMillesimi = doc.millesimi;
      if (plan.commonMonthAmount != null || plan.commonMillesimi != null) plan.targets.push(COMMON);
    }
    // ΜΟΝΟ Ο ΛΟΓΑΡΙΑΣΜΟΣ ΓΡΑΦΕΙ ΣΤΟ ΑΚΙΝΗΤΟ. Στην απόδειξη πληρωμής ο
    // «πάροχος» είναι ο δικαιούχος ή η τράπεζα («Eurobank») και ο αριθμός είναι
    // συχνά ο ψηφιακός κωδικός πληρωμής, που η φόρμα της απόδειξης ούτε καν
    // δείχνει: θα γραφόταν στη στήλη 18 του Ε2 τιμή που ο χρήστης δεν είδε.
    if (!paid) {
      // ΟΙ ΠΑΡΟΧΟΙ ΓΡΑΦΟΝΤΑΙ ΜΟΝΟΙ ΤΟΥΣ ΜΕ ΤΟΝ ΠΡΩΤΟ ΛΟΓΑΡΙΑΣΜΟ (η υπόσχεση του
      // lib/property/fields.ts), μόνο αν λείπουν: παλιός λογαριασμός δεν
      // ξαναγράφει πάροχο που ο ιδιοκτήτης άλλαξε.
      const col = PROVIDER_COLUMN[cat];
      if (col && provider) {
        plan.settingsFill = { [col]: provider };
        plan.settingsLabel = PROPERTY_TARGET;
      }
      // Ο αριθμός παροχής ρεύματος είναι η στήλη 18 του Ε2: γράφεται στο ακίνητο
      // μόνο αν λείπει και μόνο με όσα ψηφία ζητά το έντυπο.
      const supply = cat === 'electricity' ? powerSupplyOf(doc.account_num) : '';
      if (supply) plan.property = { power_supply_no: supply };
      if (plan.settingsFill || plan.property) plan.targets.push(PROPERTY_TARGET);
    }
    return plan;
  }

  if (k === 'rent_in') {
    // ΕΙΣΠΡΑΞΗ, ΟΧΙ ΔΑΠΑΝΗ. Γινόταν δαπάνη «Άλλο» πληρωμένη, δηλαδή ο
    // ιδιοκτήτης έβλεπε το ενοίκιο που ΠΗΡΕ γραμμένο ως έξοδο. Μένει μόνο στον
    // Φάκελο· η δόση σημειώνεται στην καρτέλα των ενοικιαστών.
    return { targets: [FOLDER], archive };
  }

  if (k === 'lease') {
    return {
      targets: [TENANTS, FOLDER],
      tenant: {
        full_name: tenant,
        monthly_rent: doc.monthly_rent || null,
        rent_due_day: doc.rent_due_day && doc.rent_due_day >= 1 && doc.rent_due_day <= 31 ? Math.round(doc.rent_due_day) : null,
        lease_start: iso(doc.lease_start) || null,
        lease_end: iso(doc.lease_end) || null,
        deposit_amount: doc.deposit || null,
        // Άκυρο ΑΦΜ δεν γράφεται: θα ταξίδευε ως το Ε2 ως αντισυμβαλλόμενος.
        afm: isValidAfm(doc.afm) ? digitsOnly(doc.afm) : null,
        notes: baseNote || null,
      },
      archive,
    };
  }

  if (k === 'insurance') {
    // Η ασφάλεια αποθηκεύεται στο property_settings (καρτέλα Ρυθμίσεις — εκεί που
    // ο χρήστης βλέπει τα στοιχεία ασφάλισης) ΚΑΙ στο ίδιο το ακίνητο, που
    // διαβάζουν οι προθεσμίες και η Νόα. Με αντικατάσταση: η ασφάλιση ανανεώνεται
    // κάθε χρόνο. ΟΧΙ το insurance_amount, που είναι μηνιαίο ποσό άλλης οθόνης.
    // Το ασφάλιστρο καταγράφεται ως έξοδο (Ασφάλεια Κτιρίου).
    const coverageNote = doc.coverage ? `Κάλυψη: ${fe(doc.coverage)}` : '';
    const insNote = [coverageNote, baseNote].filter(Boolean).join(' · ');
    const policy = (doc.policy_number || '').trim();
    const expiry = iso(doc.expiry_date);
    const plan: SavePlan = { targets: [], archive: { ...archive, note: insNote || undefined } };
    // ΤΟ ΠΑΛΙΟ ΑΣΦΑΛΙΣΤΗΡΙΟ ΔΕΝ ΓΥΡΙΖΕΙ ΠΙΣΩ ΤΗ ΛΗΞΗ. Με λήξη, η αντικατάσταση
    // ισχύει μόνο αν η λήξη είναι νεότερη από ό,τι ξέρει ήδη η εφαρμογή (το
    // ελέγχει η καταχώρηση, που διαβάζει τη βάση). Χωρίς λήξη δεν ξέρουμε αν
    // είναι το τρέχον συμβόλαιο, οπότε συμπληρώνει μόνο ό,τι λείπει.
    if (expiry) {
      plan.settings = { insurance_company: provider || null, insurance_policy: policy || null, insurance_expiry: expiry };
      plan.propertyReplace = filled({ insurance_company: provider, insurance_expiry: expiry });
      plan.replaceIfNewer = { column: 'insurance_expiry', value: expiry };
    } else {
      plan.settingsFill = filled({ insurance_company: provider, insurance_policy: policy });
      plan.property = filled({ insurance_company: provider });
    }
    if (plan.settings || plan.settingsFill) plan.settingsLabel = PROPERTY_TARGET;
    if (plan.settings || plan.settingsFill || plan.property) plan.targets.push(PROPERTY_TARGET);
    if (doc.premium) {
      const map = EXPENSE_MAP.insurance;
      plan.expense = {
        description: `${map.cat}${provider ? ` — ${provider}` : ''}${doc.policy_number ? ` (Αρ. ${doc.policy_number})` : ''}`,
        amount: doc.premium, category: map.cat, expense_group: map.group,
        date: iso(doc.issue_date) || today, paid_by: 'owner', paid: false,
        notes: [`Από σάρωση ασφαλιστηρίου`, insNote].filter(Boolean).join(' · '),
      };
      plan.targets.push(EXPENSES);
    }
    // Υπενθύμιση ανανέωσης πριν τη λήξη.
    if (iso(doc.expiry_date)) {
      // Η ΚΑΤΗΓΟΡΙΑ ΗΤΑΝ 'insurance', ΠΟΥ ΔΕΝ ΥΠΑΡΧΕΙ. Δεν είναι μία από τις
      // επτά του ημερολογίου ούτε στον πίνακα ψευδωνύμων, οπότε η υπενθύμιση
      // λήξης ασφαλιστηρίου κατέληγε «Υπενθύμιση» αντί για «Συμβόλαιο» — και
      // κανένα φίλτρο συμβολαίων δεν την έβρισκε. Ο τύπος το πιάνει πλέον.
      plan.calendar = [{
        title: `Λήξη ασφάλισης: ${provider || 'ακίνητο'}`, category: 'contract',
        event_date: iso(doc.expiry_date), amount: doc.premium || null,
        priority: 'high',
        notes: [`Ανανέωση ασφαλιστηρίου`, doc.policy_number ? `Αρ. ${doc.policy_number}` : '', baseNote].filter(Boolean).join(' · '),
      }];
      plan.targets.push(CALENDAR);
    }
    plan.targets.push(FOLDER);
    return plan;
  }

  if (k === 'deed') {
    // Ο ΑΤΑΚ ΠΑΕΙ ΣΤΗ ΣΤΗΛΗ ΤΟΥ, ΟΧΙ ΣΕ ΣΗΜΕΙΩΣΗ.
    //
    // Εδώ υπήρχε ένας φόβος γραμμένος σε σχόλιο: ότι οι στήλες ΑΤΑΚ, αντικειμενική
    // και ημερομηνία αγοράς ίσως δεν υπάρχουν, άρα ας κρατηθούν σε ελεύθερο κείμενο
    // «για να μη χαθούν». Ρώτησα τη βάση: `user_properties.atak` (text),
    // `obj_value` (numeric), `purchase_date` (date) — υπάρχουν και οι τρεις και ο
    // οδηγός προσθήκης ακινήτου ήδη γράφει στην πρώτη.
    //
    // Το κόστος του φόβου ήταν ορατό στον χρήστη: σαρώνει το συμβόλαιο, η εφαρμογή
    // ΔΙΑΒΑΖΕΙ τον ΑΤΑΚ, τον θάβει σε σημείωση — και μετά η καρτέλα συμφωνίας Ε2
    // του λέει «Λείπει ο ΑΤΑΚ. Συμπλήρωσέ τον για να γίνει η σύγκριση». Η ίδια
    // εφαρμογή, στην ίδια οθόνη, ζητά αυτό που μόλις πέταξε.
    //
    // Στη σημείωση μένει μόνο ό,τι ΔΕΝ έχει στήλη (ο συμβολαιογράφος). Ό,τι έχει
    // στήλη γράφεται μία φορά, στη στήλη του — όχι και στα δύο.
    const property: Record<string, unknown> = {};
    if (doc.purchase_price) property.purchase_price = doc.purchase_price;
    if (doc.year_built) property.year_built = doc.year_built;
    if (doc.sqm) property.sqm = doc.sqm;
    if (isAtak(doc.atak)) property.atak = atakDigits(doc.atak);
    if (doc.obj_value) property.obj_value = doc.obj_value;
    if (iso(doc.purchase_date)) property.purchase_date = iso(doc.purchase_date);
    const extras = [
      provider ? `Συμβολαιογράφος/Πηγή: ${provider}` : '',
      baseNote,
    ].filter(Boolean).join(' · ');
    const plan: SavePlan = { targets: [FOLDER], archive: { ...archive, note: extras || undefined } };
    if (Object.keys(property).length) { plan.property = property; plan.targets.unshift(PROPERTY_TARGET); }
    return plan;
  }

  if (k === 'pea') {
    // Η ΚΑΤΗΓΟΡΙΑ ΤΟΥ ΠΕΑ ΑΝΤΙΚΑΘΙΣΤΑ ΜΟΝΟ ΑΠΟ ΙΣΧΥΟΝ ΠΙΣΤΟΠΟΙΗΤΙΚΟ. Το νεότερο
    // ακυρώνει το παλιό, αλλά το ακίνητο δεν κρατά ημερομηνία έκδοσης για να
    // κριθεί ποιο είναι νεότερο. Με λήξη που δεν έχει περάσει, το χαρτί είναι
    // το τρέχον και αντικαθιστά· ληγμένο ή χωρίς λήξη (π.χ. παλιό ΠΕΑ που
    // αρχειοθετείται) συμπληρώνει μόνο αν λείπει. Ο αριθμός του μένει στη
    // σημείωση μέχρι να αποκτήσει στήλη· η λήξη γίνεται υπενθύμιση μόνο αν
    // τυπώνεται.
    const plan: SavePlan = { targets: [FOLDER], archive };
    const cls = peaClassOf(doc.pea_class);
    if (cls) {
      const current = !!iso(doc.expiry_date) && iso(doc.expiry_date) >= today;
      if (current) {
        plan.propertyReplace = { pea_class: cls };
        // Ισχύον ΠΕΑ δεν σημαίνει νεότερο: κρίνεται από τη λήξη που ήδη ξέρουμε.
        plan.replaceIfNewerEvent = { title: PEA_EXPIRY_TITLE, value: iso(doc.expiry_date) };
      } else plan.property = { pea_class: cls };
      plan.targets.unshift(PROPERTY_TARGET);
    }
    if (iso(doc.expiry_date)) {
      plan.calendar = [{
        title: PEA_EXPIRY_TITLE, category: 'contract', event_date: iso(doc.expiry_date), amount: null,
        notes: ['Από σάρωση πιστοποιητικού ενεργειακής απόδοσης', baseNote].filter(Boolean).join(' · '),
      }];
      plan.targets.splice(plan.targets.length - 1, 0, CALENDAR);
    }
    return plan;
  }

  if (k === 'ama') {
    const plan: SavePlan = { targets: [FOLDER], archive };
    const ama = cleanAma(String(doc.ama ?? ''));
    if (ama && isValidAmaFormat(ama)) { plan.property = { ama }; plan.targets.unshift(PROPERTY_TARGET); }
    return plan;
  }

  if (k === 'enfia') {
    // ΚΑΝΕΝΑ ΓΕΓΟΝΟΣ ΗΜΕΡΟΛΟΓΙΟΥ. Τις δόσεις του ΕΝΦΙΑ τις δίνει ήδη το
    // ημερολόγιο από τις προθεσμίες (lib/facts/deadlines)· η σάρωση έγραφε
    // δεύτερο γεγονός με όλο το ποσό. Δαπάνη μόνο με το ποσό ΑΥΤΟΥ του
    // ακινήτου: το εκκαθαριστικό είναι ανά ΑΦΜ.
    const plan: SavePlan = { targets: [FOLDER], archive };
    if (isAtak(doc.atak)) { plan.property = { atak: atakDigits(doc.atak) }; plan.targets.unshift(PROPERTY_TARGET); }
    if (doc.property_amount) {
      const map = EXPENSE_MAP.taxes;
      plan.expense = {
        description: `${map.cat}${year ? ` ${year}` : ''}`,
        amount: doc.property_amount, category: map.cat, expense_group: map.group,
        date: iso(doc.due_date) || iso(doc.issue_date) || today, paid_by: 'owner', paid: false,
        notes: [`Από σάρωση εκκαθαριστικού ΕΝΦΙΑ`, baseNote].filter(Boolean).join(' · '),
      };
      plan.targets.unshift(EXPENSES);
    }
    return plan;
  }

  if (k === 'e9') {
    // ΤΟ Ε9 ΕΙΝΑΙ ΤΟ ΕΓΓΡΑΦΟ ΤΟΥ ΑΤΑΚ. Ο ΑΤΑΚ γραφόταν μόνο από τίτλο
    // ιδιοκτησίας, ενώ το έγγραφο όπου ο ιδιοκτήτης τον βλέπει κάθε χρόνο είναι
    // το Ε9. Τα στοιχεία της γραμμής γράφονται ΜΟΝΟ μαζί με ΑΤΑΚ: χωρίς αυτόν
    // δεν ξέρουμε ότι η γραμμή είναι αυτό το ακίνητο. Και μόνο στα κενά.
    const plan: SavePlan = { targets: [FOLDER], archive };
    if (isAtak(doc.atak)) {
      plan.property = filled({
        atak: atakDigits(doc.atak), sqm: doc.sqm, storage_sqm: doc.storage_sqm,
        floor: (doc.floor || '').trim(), year_built: doc.year_built,
      });
      plan.targets.unshift(PROPERTY_TARGET);
    }
    return plan;
  }

  if (k === 'income_tax') {
    // ΟΧΙ ΔΑΠΑΝΗ ΑΚΙΝΗΤΟΥ: ο φόρος εισοδήματος είναι του φορολογούμενου. Η 1η
    // δόση μπαίνει στο ημερολόγιο χωρίς ποσό· το ποσό μένει στο έγγραφο.
    const plan: SavePlan = { targets: [FOLDER], archive };
    if (iso(doc.due_date)) {
      plan.calendar = [{
        title: `Φόρος εισοδήματος${year ? ` ${year}` : ''}: 1η δόση`, category: 'tax',
        event_date: iso(doc.due_date), amount: null, priority: 'high',
        notes: 'Από σάρωση εκκαθαριστικού φόρου εισοδήματος',
      }];
      plan.targets.unshift(CALENDAR);
    }
    return plan;
  }

  if (k === 'tax') {
    // Άλλο φορολογικό (βεβαίωση οφειλής, τέλη): υπενθύμιση πληρωμής με το ποσό
    // όταν υπάρχει λήξη. ΟΧΙ δαπάνη «ΕΝΦΙΑ»: δεν είναι ΕΝΦΙΑ.
    const plan: SavePlan = { targets: [FOLDER], archive };
    if (iso(doc.due_date)) {
      plan.calendar = [{
        title: `Πληρωμή: ${provider || 'φορολογική οφειλή'}${year ? ` ${year}` : ''}`, category: 'tax',
        event_date: iso(doc.due_date), amount: doc.amount || null, priority: 'high',
        notes: [`Από σάρωση φορολογικού εγγράφου`, baseNote].filter(Boolean).join(' · '),
      }];
      plan.targets.unshift(CALENDAR);
    }
    return plan;
  }

  // Ε1, Ε2, Ε3, κρατικό, άλλο → μόνο αρχειοθέτηση (με ό,τι σημείωσε το AI/ο χρήστης).
  return { targets: [FOLDER], archive };
}

/**
 * «Θα ενημερωθούν: …». Υπολογίζεται ζωντανά από το ίδιο σχέδιο που θα
 * εκτελεστεί, όχι από στατική λίστα ανά τύπο: ο ΕΝΦΙΑ χωρίς ποσό και ΑΤΑΚ
 * έλεγε «Στοιχεία ακινήτου · Δαπάνες · Ημερολόγιο» και αρχειοθετούνταν μόνο.
 * Ο Φάκελος μπαίνει μόνο όταν υπάρχει αρχείο να αρχειοθετηθεί.
 */
export function docTargets(doc: ScannedDoc, hasFile: boolean, today: string = athensToday()): string[] {
  if (!kindOf(doc)) return [];
  // ΜΕ ΤΟ ΣΗΜΕΡΑ, ΟΠΩΣ Η ΚΑΤΑΧΩΡΗΣΗ. Με κενή ημερομηνία, μια συνδρομή χωρίς
  // έκδοση και λήξη δεν έβγαζε ανανέωση και η λίστα παρέλειπε το Ημερολόγιο
  // που η καταχώρηση θα έγραφε.
  const plan = planDocSave(doc, today);
  const fillOnly = !!(plan.property || plan.settingsFill) && !plan.propertyReplace;
  const out = plan.targets
    .filter(t => t !== FOLDER)
    .map(t => (t === PROPERTY_TARGET && fillOnly ? `${t} (μόνο κενά)` : t));
  if (hasFile && plan.archive) out.push(FOLDER);
  return out.filter((t, i) => out.indexOf(t) === i);
}

// Σύντομη περίληψη για την οθόνη επιβεβαίωσης.
export function docSummaryLine(doc: ScannedDoc): string {
  const parts: string[] = [];
  if (doc.provider) parts.push(doc.provider);
  else if (doc.tenant_name) parts.push(doc.tenant_name);
  else if (doc.title) parts.push(doc.title);
  if (doc.amount) parts.push(fe(doc.amount));
  else if (doc.monthly_rent) parts.push(`${fe(doc.monthly_rent)}/μήνα`);
  else if (doc.premium) parts.push(fe(doc.premium));
  else if (doc.property_amount) parts.push(fe(doc.property_amount));
  return parts.join(' — ') || (kindOf(doc)?.short ?? DOC_TYPE_LABELS[doc.doc_type]);
}
