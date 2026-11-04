// ═══════════════════════════════════════════════════════════════════════════
// ΑΡΧΕΙΟ: ΕΝΑ ΟΝΟΜΑ ΓΙΑ ΚΑΘΕ ΧΑΡΤΙ, ΙΔΙΟ ΠΑΝΤΟΥ
// ─────────────────────────────────────────────────────────────────────────
// Ο ιδιοκτήτης ζήτησε (04/11/2026) κάθε αρχείο να λέγεται με τον ίδιο τρόπο,
// «για συνέπεια, οργάνωση, καθαρότητα, αλλά και για να βοηθά τον λογιστή στην
// αρχειοθέτηση, οργάνωση και ταξινόμηση της πληροφορίας»:
//
//     Είδος_Πάροχος_ΕΕΕΕ_ΜΜ_Ποσό.ext          Ρεύμα_ΔΕΗ_2026_06_84,30.pdf
//
// και να μπαίνει σε φάκελο Είδος → Πάροχος → Έτος (tree.ts). Το ίδιο όνομα και
// η ίδια δομή φεύγουν στον φάκελο του λογιστή (lib/accounting/dossier.ts).
//
// ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΟ, ΓΙΑΤΙ ΤΟ ΔΙΑΒΑΖΕΙ ΛΟΓΙΣΤΗΣ:
//   · Είδος: ΜΟΝΟ από το λεξιλόγιο `KINDS`. Ελεύθερο κείμενο δεν γίνεται ποτέ
//     είδος· ό,τι δεν αναγνωρίζεται πάει στα «Λοιπά».
//   · Πάροχος: ο ίδιος πάντα με το ίδιο όνομα. Πρώτα το ΑΦΜ: όσα χαρτιά του
//     ίδιου ακινήτου έχουν το ίδιο ΑΦΜ παίρνουν το ίδιο όνομα (`providerNames`).
//     Μετά οι γνωστές επωνυμίες και τέλος το καθάρισμα της νομικής μορφής.
//   · Έτος_μήνας: ο μήνας της ΠΕΡΙΟΔΟΥ που αφορά η δαπάνη ή το έσοδο· αν η
//     περίοδος πιάνει δύο μήνες, ο μήνας του τέλους της. Αλλιώς η έκδοση, αλλιώς
//     η ημερομηνία του εγγράφου. Πάντα δύο ψηφία.
//   · Ποσό: δύο δεκαδικά, κόμμα, χωρίς τελεία χιλιάδων, χωρίς € (1250,00).
//   · Ίδιο όνομα δύο φορές στο ίδιο ακίνητο: _2, _3 κατά σειρά καταχώρησης.
//
// ΥΠΟΛΟΓΙΖΕΤΑΙ, ΔΕΝ ΑΠΟΘΗΚΕΥΕΤΑΙ. Ισχύει αμέσως και για τα παλιά αρχεία,
// αλλάζει μόνο του όταν διορθωθεί η αναγνώριση και το αρχικό όνομα (file_name)
// δεν χάνεται: φαίνεται ως «Αρχικό: …».
//
// Καθαρή λογική, χωρίς React ή Supabase.
// ═══════════════════════════════════════════════════════════════════════════

import { isValidAfm } from '../core/greek';

/** Το λεξιλόγιο των ειδών. Καμία άλλη λέξη δεν γίνεται φάκελος ή αρχή ονόματος. */
export const KINDS = [
  'Ρεύμα', 'Νερό', 'Φυσικό αέριο', 'Internet', 'Κοινόχρηστα', 'Δημοτικά τέλη', 'Συνδρομές',
  'Συντήρηση ασανσέρ', 'Συντήρηση πισίνας', 'Ηλεκτρολόγος', 'Υδραυλικός', 'Κηπουρός', 'Καθαρισμός',
  'Απεντόμωση', 'Κλιματισμός', 'Ασφάλεια και φύλαξη', 'Συντήρηση', 'Ανακαίνιση',
  'ΕΝΦΙΑ', 'Ε1', 'Ε2', 'Ε3', 'Ε9', 'Εκκαθαριστικό φόρου', 'Φορολογικά',
  'Μισθωτήριο', 'Είσπραξη ενοικίου', 'Προμήθεια πλατφόρμας', 'Ασφαλιστήριο',
  'Τίτλος ιδιοκτησίας', 'Τεχνική έκθεση', 'Τιμολόγιο', 'Λογαριασμός', 'Εξοπλισμός',
  'Μισθωτής', 'Έγγραφο', 'Λοιπά',
] as const;
export type ArchiveKind = typeof KINDS[number];

/** Ράφι εγγράφου (ARCHIVE_CATEGORIES και παλιά κλειδιά) → είδος. */
const KIND_BY_SHELF: Record<string, ArchiveKind> = {
  'Λογαριασμός Ρεύματος': 'Ρεύμα',
  'Λογαριασμός Φυσικού Αερίου': 'Φυσικό αέριο',
  'Λογαριασμός Νερού': 'Νερό',
  'Τηλέφωνο / Internet': 'Internet',
  'Κοινόχρηστα': 'Κοινόχρηστα',
  'Απεντόμωση / Μυοκτονία': 'Απεντόμωση',
  'Τιμολόγιο Καθαρισμού': 'Καθαρισμός',
  'Συντήρηση Πισίνας': 'Συντήρηση πισίνας',
  'Συντήρηση Ανελκυστήρα': 'Συντήρηση ασανσέρ',
  'Εταιρεία Ασφαλείας': 'Ασφάλεια και φύλαξη',
  'Είσπραξη ενοικίου': 'Είσπραξη ενοικίου',
  'Μισθωτήριο / Συμβόλαιο': 'Μισθωτήριο',
  'Ασφαλιστήριο Συμβόλαιο': 'Ασφαλιστήριο',
  'Τίτλος ιδιοκτησίας': 'Τίτλος ιδιοκτησίας',
  'ΕΝΦΙΑ / Φορολογικά': 'Φορολογικά',
  'Τεχνική Έκθεση': 'Τεχνική έκθεση',
  'Άλλο Έγγραφο': 'Έγγραφο',
  tenant: 'Μισθωτής',
  // Παλιά αγγλικά κλειδιά, πριν από το ARCHIVE_CATEGORIES.
  contract: 'Μισθωτήριο', lease: 'Μισθωτήριο', insurance: 'Ασφαλιστήριο',
  tax: 'Φορολογικά', other: 'Έγγραφο', invoice: 'Τιμολόγιο', bill: 'Λογαριασμός',
};

/** Κλειδί λογαριασμού (bills.category) → είδος. */
export const BILL_KIND: Record<string, ArchiveKind> = {
  electricity: 'Ρεύμα', water: 'Νερό', gas: 'Φυσικό αέριο', internet: 'Internet',
  common: 'Κοινόχρηστα', streaming: 'Συνδρομές', enfia: 'ΕΝΦΙΑ', dimotika: 'Δημοτικά τέλη',
  insurance: 'Ασφαλιστήριο', security: 'Ασφάλεια και φύλαξη', cleaning: 'Καθαρισμός',
  garden: 'Κηπουρός', pool: 'Συντήρηση πισίνας', elevator: 'Συντήρηση ασανσέρ', ac_service: 'Κλιματισμός',
  pest: 'Απεντόμωση', renovation: 'Ανακαίνιση', other: 'Λοιπά',
  // Τα κλειδιά της σάρωσης (EXPENSE_MAP) που δεν έχουν όμοιο παραπάνω.
  taxes: 'ΕΝΦΙΑ', municipal: 'Δημοτικά τέλη', maintenance: 'Συντήρηση', gardener: 'Κηπουρός',
  cleaner: 'Καθαρισμός', plumber: 'Υδραυλικός', electrician: 'Ηλεκτρολόγος',
};

/** Πεζά, χωρίς τόνους και διπλά κενά: το κλειδί σύγκρισης. */
export const foldKey = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Κατηγορία δαπάνης (το ελληνικό κείμενο του EXPENSE_MAP και παλιές γραφές) → είδος. */
const KIND_BY_TEXT: Record<string, ArchiveKind> = {
  'ρευμα': 'Ρεύμα', 'νερο': 'Νερό', 'φυσικο αεριο': 'Φυσικό αέριο', 'internet': 'Internet',
  'κοινοχρηστα': 'Κοινόχρηστα', 'δημοτικα τελη': 'Δημοτικά τέλη', 'αλλη παγια': 'Συνδρομές',
  'συντηρηση ασανσερ': 'Συντήρηση ασανσέρ', 'ασανσερ': 'Συντήρηση ασανσέρ', 'ανελκυστηρας': 'Συντήρηση ασανσέρ',
  'καθαρισμος πισινας': 'Συντήρηση πισίνας', 'πισινα': 'Συντήρηση πισίνας',
  'ηλεκτρολογος': 'Ηλεκτρολόγος', 'υδραυλικος': 'Υδραυλικός', 'κηπουρος': 'Κηπουρός',
  'καθαριοτητα': 'Καθαρισμός', 'καθαρισμος': 'Καθαρισμός',
  'ασφαλεια κτιριου': 'Ασφαλιστήριο', 'συστημα συναγερμου': 'Ασφάλεια και φύλαξη',
  'γενικη συντηρηση': 'Συντήρηση', 'ενφια': 'ΕΝΦΙΑ', 'αλλο': 'Λοιπά',
};

/** Τα φορολογικά χωρίζονται από τον τίτλο: το ράφι είναι ένα, τα έντυπα πολλά. */
function taxKind(title: string | null | undefined): ArchiveKind {
  // Το λατινικό E μοιάζει με το ελληνικό Ε και η σάρωση γράφει όποιο δει.
  const t = ` ${foldKey(title || '').toUpperCase().replace(/E/g, 'Ε')} `;
  for (const k of ['Ε9', 'Ε1', 'Ε2', 'Ε3'] as const) if (new RegExp(`[\\s(]${k}[\\s).,:]`).test(t)) return k;
  if (t.includes('ΕΝΦΙΑ')) return 'ΕΝΦΙΑ';
  if (t.includes('ΕΚΚΑΘΑΡΙΣΤΙΚ')) return 'Εκκαθαριστικό φόρου';
  return 'Φορολογικά';
}

// ── ΤΑ ΓΕΝΙΚΑ ΕΙΔΗ ΣΤΕΝΕΥΟΥΝ ΟΠΟΥ ΥΠΑΡΧΕΙ ΣΤΟΙΧΕΙΟ ──────────────────────────
// «Λογαριασμός», «Τιμολόγιο», «Έγγραφο», «Λοιπά» δεν λένε στον λογιστή τι
// είναι το χαρτί. Οταν ο πάροχος είναι γνωστός (ΔΕΗ → Ρεύμα) ή η επωνυμία ή
// ο τίτλος γράφει ρητά την εργασία («Υδραυλικές Εργασίες», «Τιμολόγιο
// υδραυλικού»), το είδος γίνεται το συγκεκριμένο του λεξιλογίου. Πίνακας
// λέξεων-κλειδιών, όχι συμπερασμός: ίδιο κείμενο, ίδιο είδος, πάντα.
const GENERIC = new Set<ArchiveKind>(['Λογαριασμός', 'Τιμολόγιο', 'Έγγραφο', 'Λοιπά']);
const PROVIDER_KIND: Record<string, ArchiveKind> = { 'ΔΕΗ': 'Ρεύμα', 'ΕΥΔΑΠ': 'Νερό', 'ΕΥΑΘ': 'Νερό', 'ΑΑΔΕ': 'Φορολογικά' };
const KEYWORD_KIND: [RegExp, ArchiveKind][] = [
  [/υδραυλικ/u, 'Υδραυλικός'],
  [/ηλεκτρολογ/u, 'Ηλεκτρολόγος'],
  [/ανελκυστηρ|ασανσερ/u, 'Συντήρηση ασανσέρ'],
  [/πισιν/u, 'Συντήρηση πισίνας'],
  [/κηπουρ/u, 'Κηπουρός'],
  [/απεντομωσ|μυοκτονι/u, 'Απεντόμωση'],
  [/κλιματιστικ|ψυκτικ/u, 'Κλιματισμός'],
  [/κοινοχρηστ/u, 'Κοινόχρηστα'],
  [/φυσικο αεριο|φυσικου αεριου/u, 'Φυσικό αέριο'],
  [/(λογαριασμος|καταναλωση) ρευματος|ηλεκτρικη ενεργεια/u, 'Ρεύμα'],
  [/(λογαριασμος|καταναλωση) νερου|υδρευσ/u, 'Νερό'],
];
/** Το συγκεκριμένο είδος για ένα γενικό, από τον πάροχο και τον τίτλο· αλλιώς το ίδιο. */
export function refineKind(kind: ArchiveKind, provider?: string | null, title?: string | null): ArchiveKind {
  if (!GENERIC.has(kind)) return kind;
  const p = cleanProvider(provider);
  if (p && PROVIDER_KIND[p]) {
    const k = PROVIDER_KIND[p];
    return k === 'Φορολογικά' ? taxKind(title) : k;
  }
  const text = foldKey(`${provider || ''} ${title || ''}`);
  for (const [re, k] of KEYWORD_KIND) if (re.test(text)) return k;
  return kind;
}

/** Οι πλατφόρμες βραχυχρόνιας: η χρέωσή τους είναι προμήθεια, όχι λογαριασμός. */
const PLATFORMS = new Set(['Airbnb', 'Booking.com', 'Expedia', 'Vrbo']);

/** Το είδος ενός εγγράφου, από το ράφι του, τον τίτλο (φορολογικά) και τον πάροχο (πλατφόρμες). */
export function kindOfShelf(shelf: string | null | undefined, title?: string | null, provider?: string | null): ArchiveKind {
  // Χωρίς ράφι, ο τίτλος μετράει μόνο αν είναι ΑΚΡΙΒΩΣ λέξη του λεξιλογίου
  // («Μισθωτήριο»)· ποτέ συμπερασμός από ελεύθερο κείμενο.
  const byTitle = !shelf ? KINDS.find(k => foldKey(k) === foldKey(title || '')) : undefined;
  const k = (shelf && KIND_BY_SHELF[shelf]) || byTitle || kindOfText(shelf, 'Έγγραφο');
  if (k === 'Φορολογικά') return taxKind(title);
  const p = cleanProvider(provider);
  if (p && PLATFORMS.has(p) && k !== 'Είσπραξη ενοικίου') return 'Προμήθεια πλατφόρμας';
  return refineKind(k, provider, title);
}

/** Το είδος από κατηγορία δαπάνης ή κλειδί λογαριασμού· ό,τι δεν αναγνωρίζεται → `fallback`. */
export function kindOfText(cat: string | null | undefined, fallback: ArchiveKind = 'Λοιπά'): ArchiveKind {
  const c = (cat || '').trim();
  if (!c) return fallback;
  return KIND_BY_SHELF[c] ?? BILL_KIND[c] ?? KIND_BY_TEXT[foldKey(c)] ?? fallback;
}

// ── Ο ΠΑΡΟΧΟΣ ────────────────────────────────────────────────────────────
// Οι γνωστές επωνυμίες γράφονται εδώ ΜΟΝΟ με το όνομά τους, όπως τυπώνεται
// στα έγγραφα: κανένα ΑΦΜ χωρίς πηγή. Η ταύτιση με ΑΦΜ γίνεται από τα ίδια τα
// χαρτιά του χρήστη (`providerNames`), όχι από κατάλογο γραμμένο με το χέρι.
const KNOWN: [RegExp, string][] = [
  [/δημοσια επιχειρηση ηλεκτρισμου/u, 'ΔΕΗ'],
  [/^δεη(?![\p{L}\p{N}])/u, 'ΔΕΗ'],
  [/εταιρεια υδρευσης και αποχετευσης πρωτευουσας/u, 'ΕΥΔΑΠ'],
  [/^ευδαπ(?![\p{L}\p{N}])/u, 'ΕΥΔΑΠ'],
  [/εταιρεια υδρευσης και αποχετευσης θεσσαλονικης/u, 'ΕΥΑΘ'],
  [/^ευαθ(?![\p{L}\p{N}])/u, 'ΕΥΑΘ'],
  [/^ανεξαρτητη αρχη δημοσιων εσοδων|^ααδε(?![\p{L}\p{N}])/u, 'ΑΑΔΕ'],
  [/^airbnb(?![\p{L}\p{N}])/u, 'Airbnb'],
  [/^booking(\.com)?(?![\p{L}\p{N}])/u, 'Booking.com'],
  [/^expedia(?![\p{L}\p{N}])/u, 'Expedia'],
  [/^vrbo(?![\p{L}\p{N}])/u, 'Vrbo'],
];
// Νομική μορφή και χώρα έδρας στο τέλος της επωνυμίας: δεν είναι το όνομα.
const LEGAL = [
  'ανωνυμη εταιρεια', 'εταιρεια περιορισμενης ευθυνης', 'ιδιωτικη κεφαλαιουχικη εταιρεια',
  'unlimited company', 'limited', 'ltd', 'llc', 'inc', 'gmbh', 'b\\.?v\\.?', 's\\.?a\\.?', 'uc', 'plc',
  'α\\.?ε\\.?', 'ε\\.?π\\.?ε\\.?', 'ι\\.?κ\\.?ε\\.?', 'ο\\.?ε\\.?', 'ε\\.?ε\\.?', 'μ\\.?ι\\.?κ\\.?ε\\.?',
  'ireland', 'europe', 'emea', 'hellas', 'ελλας',
];
const LEGAL_RE = new RegExp(`(?:[\\s,.-]+(?:${LEGAL.join('|')}))+\\s*$`, 'iu');

/** Η γνωστή επωνυμία που αναγνωρίζεται στο όνομα, ή null. */
export function knownBrand(raw: string | null | undefined): string | null {
  const folded = foldKey(raw || '');
  if (!folded) return null;
  for (const [re, name] of KNOWN) if (re.test(folded)) return name;
  return null;
}

/** Το καθαρό όνομα ενός παρόχου· `null` αν δεν υπάρχει ή είναι εσωτερική ετικέτα. */
export function cleanProvider(raw: string | null | undefined): string | null {
  let s = (raw || '').replace(/\s+/g, ' ').trim();
  // 'tenant:<id>' της καρτέλας του μισθωτή: δεσμός, όχι πάροχος.
  if (!s || /^[a-z_]+:[\w-]+$/i.test(s)) return null;
  const folded = foldKey(s);
  for (const [re, name] of KNOWN) if (re.test(folded)) return name;
  for (let i = 0; i < 3; i++) { const t = s.replace(LEGAL_RE, '').trim(); if (t === s) break; s = t; }
  s = s.replace(/[\s,.-]+$/, '').trim();
  return s || null;
}

/** Ένα χαρτί όπως το βλέπει η ανάλυση παρόχου. */
export interface ProviderSource { provider: string | null | undefined; afm?: string | null; createdAt?: string | null }

/**
 * ΤΟ ΙΔΙΟ ΑΦΜ, ΤΟ ΙΔΙΟ ΟΝΟΜΑ. Από τα χαρτιά ενός ακινήτου: για κάθε ΑΦΜ, το
 * όνομα με τις περισσότερες εμφανίσεις (ισοπαλία: το πρώτο που καταχωρήθηκε).
 * Ετσι «ΔΕΗ» και «Δημόσια Επιχείρηση Ηλεκτρισμού» και «Δ.Ε.Η.» με το ίδιο ΑΦΜ
 * καταλήγουν στον ίδιο υποφάκελο.
 */
export function providerNames(rows: readonly ProviderSource[]): Map<string, string> {
  const byAfm = new Map<string, Map<string, { n: number; first: string }>>();
  for (const r of rows) {
    const afm = (r.afm || '').replace(/\D/g, '');
    const name = cleanProvider(r.provider);
    // ΜΟΝΟ ΕΓΚΥΡΟ ΑΦΜ. Ενα ΑΦΜ που διαβάστηκε λάθος από τη σάρωση δεν περνά το
    // ψηφίο ελέγχου· χωρίς αυτόν τον έλεγχο, ένα λάθος ψηφίο θα έβαζε τη ΔΕΗ
    // στον υποφάκελο της ασφαλιστικής που έτυχε να έχει το ίδιο λάθος ΑΦΜ.
    if (!isValidAfm(afm) || !name) continue;
    const m = byAfm.get(afm) ?? new Map();
    const e = m.get(name) ?? { n: 0, first: r.createdAt || '9999' };
    e.n++; if ((r.createdAt || '9999') < e.first) e.first = r.createdAt || '9999';
    m.set(name, e); byAfm.set(afm, m);
  }
  const out = new Map<string, string>();
  for (const [afm, m] of byAfm) {
    // ΣΥΓΚΡΟΥΣΗ: αν μία από τις γραφές είναι γνωστή επωνυμία και κάποια άλλη
    // δεν είναι η ίδια επωνυμία, τα χαρτιά δεν είναι του ίδιου παρόχου — κάτι
    // διαβάστηκε λάθος. Τότε το ΑΦΜ δεν ενώνει τίποτα και κάθε χαρτί κρατά το
    // δικό του καθαρό όνομα.
    const brands = new Set([...m.keys()].map(n => knownBrand(n)));
    if ([...brands].some(Boolean) && brands.size > 1) continue;
    out.set(afm, [...m.entries()].sort((a, b) => b[1].n - a[1].n || a[1].first.localeCompare(b[1].first) || a[0].localeCompare(b[0], 'el'))[0][0]);
  }
  return out;
}

/** Τα έντυπα της ΑΑΔΕ: χωρίς πάροχο στο χαρτί, ο εκδότης είναι η ΑΑΔΕ. */
const AADE_KINDS = new Set<string>(['ΕΝΦΙΑ', 'Ε1', 'Ε2', 'Ε3', 'Ε9', 'Εκκαθαριστικό φόρου']);
/** Ο πάροχος που εννοείται από το είδος, όταν το χαρτί δεν γράφει. */
export const defaultProvider = (kind: string | null | undefined): string | null =>
  kind && AADE_KINDS.has(kind) ? 'ΑΑΔΕ' : null;

/** Ο πάροχος ενός χαρτιού: πρώτα με το ΑΦΜ, μετά με το καθάρισμα, τέλος από το είδος (ΑΑΔΕ). */
export const resolveProvider = (names: Map<string, string>, provider: string | null | undefined, afm?: string | null, kind?: string | null): string | null =>
  names.get((afm || '').replace(/\D/g, '')) ?? cleanProvider(provider) ?? defaultProvider(kind);

// ── Ο ΜΗΝΑΣ ──────────────────────────────────────────────────────────────
/** Η πρώτη έγκυρη ημερομηνία ISO από τη σειρά προτίμησης. */
export const firstDate = (...ds: (string | null | undefined)[]): string | null =>
  ds.find(d => typeof d === 'string' && /^\d{4}-\d{2}/.test(d)) ?? null;

/** Η ημερομηνία του ονόματος: τέλος περιόδου → αρχή περιόδου → έκδοση → έγγραφο. */
export const nameDateOf = (d: { period_to?: string | null; period_from?: string | null; issue_date?: string | null; doc_date?: string | null }): string | null =>
  firstDate(d.period_to, d.period_from, d.issue_date, d.doc_date);

// ── ΤΟ ΠΟΣΟ ──────────────────────────────────────────────────────────────
/** «1250,00»: δύο δεκαδικά, κόμμα, χωρίς τελεία χιλιάδων (μοιάζει με κατάληξη), χωρίς €. */
export function amountPart(v: number | string | null | undefined): string {
  const n = typeof v === 'string' ? Number(v) : v;
  // Το μηδέν δεν είναι ποσό: ένα «0,00» στο όνομα λέει ψέματα για το χαρτί.
  if (n == null || !Number.isFinite(n) || Math.abs(n) < 0.005) return '';
  return Math.abs(n).toFixed(2).replace('.', ',');
}

const MIME_EXT: Record<string, string> = {
  'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/heic': 'heic', 'image/heif': 'heif', 'image/gif': 'gif',
};
/** Η κατάληξη: από τον τύπο, αλλιώς από το αρχικό όνομα ή τη διεύθυνση. */
export function extOf(mime?: string | null, original?: string | null): string {
  const m = mime ? MIME_EXT[mime.toLowerCase()] : undefined;
  if (m) return m;
  const e = (original || '').split(/[?#]/)[0].match(/\.([a-z0-9]{2,5})$/i)?.[1];
  return e ? e.toLowerCase().replace('jpeg', 'jpg') : '';
}

/** Ένα κομμάτι του ονόματος, χωρίς ό,τι απαγορεύουν Windows, macOS ή iOS και χωρίς κάτω παύλα. */
const safePart = (s: string): string =>
  [...s].map(ch => (ch < ' ' || '\\/:*?"<>|'.includes(ch) ? '-' : ch)).join('')
    .replace(/_/g, ' ').replace(/\s+/g, ' ').replace(/^[\s.-]+|[\s.]+$/g, '');

export interface NameInput {
  kind: string;
  /** Ο ήδη αναλυμένος πάροχος (resolveProvider). */
  provider?: string | null;
  /** Η ημερομηνία του ονόματος (nameDateOf). */
  date?: string | null;
  amount?: number | string | null;
  ext?: string;
}

/** Είδος_Πάροχος_ΕΕΕΕ_ΜΜ_Ποσό.ext· ό,τι λείπει παραλείπεται, ποτέ διπλή κάτω παύλα. */
export function archiveFileName(n: NameInput): string {
  const d = firstDate(n.date);
  const parts = [
    safePart(n.kind || 'Έγγραφο'),
    safePart(cleanProvider(n.provider) || ''),
    d ? d.slice(0, 4) : '',
    d ? d.slice(5, 7) : '',
    amountPart(n.amount),
  ].filter(Boolean);
  const base = parts.join('_').slice(0, 140).replace(/[_\s.]+$/, '');
  return n.ext ? `${base}.${n.ext}` : base;
}

/**
 * ΙΔΙΟ ΟΝΟΜΑ ΔΥΟ ΦΟΡΕΣ: _2, _3. Μέσα σε ΕΝΑ ακίνητο, κατά σειρά καταχώρησης
 * (και μετά κατά id), ώστε κάθε άνοιγμα και κάθε εξαγωγή να δίνει το ίδιο
 * όνομα στο ίδιο χαρτί. Το πρώτο κρατά το όνομά του χωρίς αριθμό.
 */
export function uniqueNames(rows: readonly { id: string; name: string; createdAt?: string | null }[]): Map<string, string> {
  const groups = new Map<string, typeof rows[number][]>();
  for (const r of rows) {
    const k = foldKey(r.name);
    const g = groups.get(k); if (g) g.push(r); else groups.set(k, [r]);
  }
  const out = new Map<string, string>();
  for (const g of groups.values()) {
    [...g].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id))
      .forEach((r, i) => {
        if (i === 0) { out.set(r.id, r.name); return; }
        const m = /^(.*?)(\.[a-z0-9]{2,5})?$/i.exec(r.name)!;
        out.set(r.id, `${m[1]}_${i + 1}${m[2] || ''}`);
      });
  }
  return out;
}

/** Ο φάκελος ενός χαρτιού: Είδος/Πάροχος/Έτος, με τις ίδιες λέξεις με το δέντρο. */
export const archiveFolder = (kind: string, provider: string | null, date: string | null): string[] =>
  [safePart(kind || 'Έγγραφο'), safePart(provider || 'Χωρίς πάροχο'), date ? date.slice(0, 4) : 'Χωρίς έτος'];
