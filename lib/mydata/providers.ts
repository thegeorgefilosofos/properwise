// ═══════════════════════════════════════════════════════════════════════════
// myDATA: ΤΟ ΜΗΤΡΩΟ ΠΑΡΟΧΩΝ ΑΚΙΝΗΤΟΥ (PR-Α2)
// ─────────────────────────────────────────────────────────────────────────
// Ποιος εκδότης φέρνει δαπάνη ακινήτου με γνωστή κατηγορία. Μόνο αυτοί μπορούν
// να καταχωρηθούν χωρίς πάτημα (supabase/functions/_shared/mydataClassify.ts)·
// όλοι οι άλλοι πάνε «Για έλεγχο». Σχέδιο ιδιοκτήτη 23/11/2026, «ΑΥΣΤΗΡΟΠΟΙΗΣΗ»
// και «ΔΙΟΡΘΩΣΗ 12:00»: χωρίς ΚΑΔ (RgWsPublic2 προαιρετικό), το αυτόματο
// στηρίζεται ΜΟΝΟ σε αυτό το μητρώο.
//
// ΚΑΝΟΝΑΣ ΕΓΓΡΑΦΗΣ. Κάθε ΑΦΜ μπαίνει μόνο με δημόσια πηγή του ίδιου του παρόχου
// (όροι, καταστατικό) ή επίσημη δημοσίευση (Χρηματιστήριο ή Γ.Ε.ΜΗ.) και με
// το απόσπασμα που το γράφει. ΑΦΜ που δεν επαληθεύτηκε ΔΕΝ μπαίνει: μένει στη
// λίστα «χωρίς επαλήθευση» πιο κάτω, μόνο με όνομα. Το providers.test.ts
// ελέγχει ψηφίο ελέγχου, μοναδικότητα, πηγή και απόσπασμα για όλες.
//
// ΠΩΣ ΕΠΑΛΗΘΕΥΤΗΚΑΝ (23/11/2026). Τα αποσπάσματα διαβάστηκαν από ευρετήριο
// αναζήτησης πάνω στα έγγραφα των συνδέσμων· το περιβάλλον δεν είχε άμεση
// πρόσβαση στους ιστότοπους. Γι' αυτό `checkedAt: null`: τη βάζει άνθρωπος όταν
// ανοίξει την πηγή. Το ψηφίο ελέγχου του ΑΦΜ περνά για όλα.
//
// ΧΩΡΙΣ ΕΙΣΑΓΩΓΕΣ: το φορτώνει και η συνάρτηση άκρου (Deno).
// ═══════════════════════════════════════════════════════════════════════════

export const KINDS = ['electricity', 'water', 'gas', 'telecom', 'common', 'insurance'] as const;
export type ProviderKind = typeof KINDS[number];

export interface Provider {
  afm: string;
  /** Το όνομα που βλέπει ο χρήστης αντί για «ΑΦΜ 0900…». */
  name: string;
  kind: ProviderKind;
  source: string;
  /** Το κείμενο της πηγής που γράφει το ΑΦΜ. */
  quote: string;
  checkedAt: string | null;
}

export const PROVIDERS: readonly Provider[] = [
  {
    afm: '090000045', name: 'ΔΕΗ', kind: 'electricity',
    source: 'https://www.dei.gr/media/hrvfa042/katastatiko-382022-me-psu.pdf',
    quote: 'Καταστατικό «Δημόσια Επιχείρηση Ηλεκτρισμού Ανώνυμη Εταιρεία» (Δ.Ε.Η. Α.Ε.): Αρ. Γ.Ε.ΜΗ.: 786301000, Α.Φ.Μ.: 090000045, Δ.Ο.Υ. Φ.Α.Ε. Αθηνών',
    checkedAt: null,
  },
  {
    afm: '099810593', name: 'Ήρων', kind: 'electricity',
    source: 'https://heron.gr/media/4kkgjzoa/heron_store_reopening_oroi_diagonismoy.pdf',
    quote: 'ΗΡΩΝ ΕΝΕΡΓΕΙΑΚΗ Α.Ε., Λεωφ. Μεσογείων 85, Αθήνα, ΑΦΜ 099810593, Γ.Ε.ΜΗ. 005805601000',
    checkedAt: null,
  },
  {
    afm: '094316669', name: 'Protergia', kind: 'electricity',
    source: 'https://www.protergia.gr/media/c2lmeynu/εο1250-2_226_v1_072026_gos_oikiako_dynamic_one.pdf',
    quote: 'Σύμβαση προμήθειας Protergia (οικιακό, 07/2026): Προμηθευτής METLEN Μονοπρόσωπη A.E. (επωνυμία συντομευμένη), Αμαρούσιο Αττικής, Α.Φ.Μ. 094316669',
    checkedAt: null,
  },
  {
    afm: '094079101', name: 'ΕΥΔΑΠ', kind: 'water',
    source: 'https://athexgroup.gr/el/documents/10180/3883164/%CE%9F%CE%B9%CE%BA%CE%BF%CE%BD%CE%BF%CE%BC%CE%B9%CE%BA%CE%AE%20%CE%9A%CE%B1%CF%84%CE%AC%CF%83%CF%84%CE%B1%CF%83%CE%B7%20%CE%95.%CE%A5%CE%94.%CE%91.%CE%A0.%20%CE%91.%CE%95.%20%282007%2C%CE%95%CF%84%CE%AE%CF%83%CE%B9%CE%BF%CF%82%20%CE%99%CF%83%CE%BF%CE%BB%CE%BF%CE%B3%CE%B9%CF%83%CE%BC%CF%8C%CF%82%2C%CE%9C%CE%B7%CF%84%CF%81%CE%B9%CE%BA%CE%AE%29/35b18c6c-de56-4ecd-a881-ac4418170ea7',
    quote: 'Οικονομικές καταστάσεις Ε.ΥΔ.Α.Π. Α.Ε. στο Χρηματιστήριο Αθηνών: Αρ. Φορολογικού Μητρώου 094079101, Ωρώπου 156 Γαλάτσι',
    checkedAt: null,
  },
  {
    afm: '094019245', name: 'ΟΤΕ (COSMOTE)', kind: 'telecom',
    source: 'https://frogmobile.gr/en/node/295',
    quote: 'General terms of prepaid mobile telephony services by OTE: Λ. Κηφισίας 99, Μαρούσι, Γ.Ε.ΜΗ. 1037501000, ΑΦΜ 094019245, Δ.Ο.Υ. ΦΑΕ Αθηνών',
    checkedAt: null,
  },
  {
    afm: '094349850', name: 'Vodafone', kind: 'telecom',
    source: 'https://www.vodafonecu.gr/files/PDF/oroi_xrhshs.pdf',
    quote: 'Όροι χρήσης Vodafone-Παναφον Α.Ε.Ε.Τ., Χαλάνδρι Αττικής: ΑΦΜ 094349850 (ίδιο ΑΦΜ και στους γενικούς όρους καρτοκινητής 08/2024, Γ.Ε.ΜΗ. 000828201000)',
    checkedAt: null,
  },
];

/**
 * ΧΩΡΙΣ ΕΠΑΛΗΘΕΥΣΗ (23/11/2026): δεν βρέθηκε δημόσια πηγή που να γράφει το ΑΦΜ,
 * ή οι πηγές διαφωνούσαν. Μένουν εκτός μητρώου, άρα «Για έλεγχο», ως να μπει
 * το ΑΦΜ με πηγή:
 *   · ρεύμα: Elpedison
 *   · νερό: ΕΥΑΘ (βρέθηκε μόνο Γ.Ε.ΜΗ. 058240404000, όχι ΑΦΜ)
 *   · φυσικό αέριο: Φυσικό Αέριο Ελληνική Εταιρεία Ενέργειας, ΕΔΑ Αττικής
 *   · τηλεπικοινωνίες: COSMOTE Κινητές (ξεχωριστό νομικό πρόσωπο από τον ΟΤΕ), Nova
 *   · κοινόχρηστα: εταιρείες διαχείρισης πολυκατοικιών είναι πολλές και τοπικές·
 *     καμία δεν μπαίνει χωρίς δική της πηγή
 *   · ασφάλεια κατοικίας: οι ασφαλιστικές εκδίδουν και ασφάλειες αυτοκινήτου και
 *     υγείας με το ίδιο ΑΦΜ, άρα το ΑΦΜ μόνο του δεν λέει «κατοικία». Δεν μπαίνουν
 *     στο αυτόματο ακόμη και με πηγή· πάνε για έλεγχο.
 */

export interface NotProperty { afm: string; name: string; source: string; quote: string }

/**
 * ΔΕΝ ΑΦΟΡΑ ΑΚΙΝΗΤΑ: σούπερ μάρκετ, ένδυση, υπόδηση, εστίαση. Απορρίπτονται χωρίς
 * αποθήκευση (μένει μόνο ο ΜΑΡΚ για τον δρομέα).
 *
 * ΚΕΝΗ (23/11/2026). Για τις μεγάλες αλυσίδες σούπερ μάρκετ δεν βρέθηκε πηγή με
 * ΑΦΜ (Σκλαβενίτης, ΑΒ Βασιλόπουλος) ή οι πηγές διαφωνούσαν (Lidl Ελλάς: δύο
 * διαφορετικά ΑΦΜ). Ως τότε τα παραστατικά τους πάνε «Για έλεγχο» και ο χρήστης
 * τα κλείνει με «Δεν αφορά ακίνητο» ή «Πάντα αγνόησε», που λειτουργεί ως κανόνας
 * απόρριψης για τον ίδιο.
 */
export const NOT_PROPERTY: readonly NotProperty[] = [];

/**
 * ΚΑΔ ΠΟΥ ΔΕΝ ΑΦΟΡΟΥΝ ΑΚΙΝΗΤΟ (θωράκιση 24/11/2026, Κ2 του νομικού ελέγχου).
 * Πρόθεμα των ψηφίων του ΚΑΔ (86.21.10.00 → «8621»), με την περιγραφή της
 * ταξινόμησης.
 *
 * ΠΗΓΗ: Eurostat, «NACE Rev. 2 – Statistical classification of economic
 * activities in the European Community» (KS-RA-07-015, 2008). Η ελληνική της
 * απόδοση είναι η ΣΤΑΚΟΔ-08 της ΕΛΣΤΑΤ, πάνω στην οποία χτίζονται οι ΚΑΔ της ΑΑΔΕ.
 *
 * ΑΝΕΝΕΡΓΗ ΣΗΜΕΡΑ. Το RequestDocs δεν φέρνει ΚΑΔ εκδότη· θα τον έδινε το
 * RgWsPublic2, που είναι προαιρετικό (σχέδιο 23/11/2026). Ως τότε κανένα
 * παραστατικό δεν απορρίπτεται από εδώ: όσα έρχονται μένουν μόνο στον
 * ιδιοκτήτη όσο είναι εκκρεμή (ο λογιστής δεν τα βλέπει) και σβήνουν σε
 * MYDATA_PENDING_DAYS ημέρες αν δεν κριθούν (lib/mydata/retention.ts).
 */
export interface NotPropertyKad { prefix: string; label: string; group: 'health' | 'personal'; source: string }

const NACE = 'NACE Rev. 2 (Eurostat KS-RA-07-015) / ΣΤΑΚΟΔ-08 (ΕΛΣΤΑΤ)';

export const NOT_PROPERTY_KAD: readonly NotPropertyKad[] = [
  { prefix: '86', label: 'Δραστηριότητες ανθρώπινης υγείας', group: 'health', source: NACE },
  { prefix: '87', label: 'Δραστηριότητες βοήθειας με παροχή καταλύματος', group: 'health', source: NACE },
  { prefix: '4773', label: 'Λιανικό εμπόριο φαρμακευτικών προϊόντων σε εξειδικευμένα καταστήματα', group: 'health', source: NACE },
  { prefix: '4774', label: 'Λιανικό εμπόριο ιατρικών και ορθοπεδικών ειδών σε εξειδικευμένα καταστήματα', group: 'health', source: NACE },
  { prefix: '4711', label: 'Λιανικό εμπόριο σε μη εξειδικευμένα καταστήματα, κυρίως με τρόφιμα, ποτά ή καπνό', group: 'personal', source: NACE },
  { prefix: '4771', label: 'Λιανικό εμπόριο ενδυμάτων σε εξειδικευμένα καταστήματα', group: 'personal', source: NACE },
  { prefix: '4772', label: 'Λιανικό εμπόριο υποδημάτων και δερμάτινων ειδών σε εξειδικευμένα καταστήματα', group: 'personal', source: NACE },
  { prefix: '56', label: 'Δραστηριότητες υπηρεσιών εστίασης', group: 'personal', source: NACE },
];

/** Ο ΚΑΔ ανήκει σε κατηγορία που δεν αφορά ακίνητο; Μόνο ψηφία μετρούν. */
export function kadNotProperty(kad: string): NotPropertyKad | null {
  const digits = String(kad ?? '').replace(/\D/g, '');
  if (digits.length < 2) return null;
  return NOT_PROPERTY_KAD.find(k => digits.startsWith(k.prefix)) ?? null;
}

/** Η κατηγορία της εφαρμογής ανά είδος, ίδια με την ταξινομία (providers.test.ts). */
export interface KindCategory {
  slug: string;
  label: string;
  group: string;
  /**
   * Προτεινόμενος κωδικός χαρακτηρισμού εξόδων Ε3 του myDATA. Η τιμή υπάρχει
   * στον κατάλογο του SimpleTypes-v2.0.2.xsd· η ΣΗΜΑΣΙΑ της (ποιος κωδικός
   * είναι «Ενέργεια», «Ύδρευση», «Τηλεπικοινωνίες») είναι στον πίνακα
   * κατηγοριοποίησης της τεκμηρίωσης, που δεν επαληθεύτηκε από αρχείο εδώ.
   * ΘΕΛΕΙ ΕΠΙΒΕΒΑΙΩΣΗ ΛΟΓΙΣΤΗ πριν εμφανιστεί ή σταλεί (Α4). Δεν εμφανίζεται.
   */
  e3: string | null;
}

export const KIND_CATEGORY: Record<ProviderKind, KindCategory> = {
  electricity: { slug: 'electricity', label: 'Ρεύμα', group: 'fixed', e3: 'E3_585_011' },
  water: { slug: 'water', label: 'Νερό', group: 'fixed', e3: 'E3_585_012' },
  gas: { slug: 'gas', label: 'Φυσικό αέριο', group: 'fixed', e3: 'E3_585_011' },
  telecom: { slug: 'internet', label: 'Internet και τηλέφωνο', group: 'fixed', e3: 'E3_585_013' },
  common: { slug: 'common', label: 'Κοινόχρηστα', group: 'fixed', e3: null },
  insurance: { slug: 'insurance', label: 'Ασφάλεια', group: 'fixed', e3: null },
};

const BY_AFM: ReadonlyMap<string, Provider> = new Map(PROVIDERS.map(p => [p.afm, p]));

/** Το ΑΦΜ χωρίς κενά και χωρίς το πρόθεμα χώρας «EL». */
export const cleanAfm = (afm: string): string => afm.trim().replace(/^EL/i, '');

export function providerByAfm(afm: string): Provider | null {
  return BY_AFM.get(cleanAfm(afm)) ?? null;
}

/** Το όνομα που δείχνει η οθόνη: πρώτα το μητρώο, μετά η επωνυμία του εκδότη. */
export function providerName(afm: string, issuerName: string | null): string | null {
  return providerByAfm(afm)?.name ?? (issuerName?.trim() || null);
}
