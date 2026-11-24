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

/** Παλιό ΑΦΜ εκδότη που απορροφήθηκε: τα παλιά παραστατικά το γράφουν ακόμη. */
export interface FormerAfm {
  afm: string;
  /** Η επωνυμία που γράφουν τα παλιά παραστατικά. */
  name: string;
  /** Τελευταία ημέρα που εξέδιδε (ISO) ή null όταν δεν βρέθηκε. */
  until: string | null;
  source: string;
  quote: string;
}

export interface Provider {
  afm: string;
  /** Το όνομα που βλέπει ο χρήστης αντί για «ΑΦΜ 0900…». */
  name: string;
  /**
   * Τα είδη που τιμολογεί το ΑΦΜ (ένα ΑΦΜ μπορεί να είναι ρεύμα ΚΑΙ αέριο, ή ρεύμα
   * ΚΑΙ internet). Τα συμπληρώνει ο ιδιοκτήτης· κενό ως τότε. Η αυτόματη
   * καταχώρηση θέλει ΕΝΑ είδος (`providerKind`): με κανένα ή πολλά δεν μαντεύει.
   */
  kinds: ProviderKind[];
  source: string;
  /** Το κείμενο της πηγής που γράφει το ΑΦΜ. */
  quote: string;
  checkedAt: string | null;
  /** Παλιά ΑΦΜ εκδοτών που απορροφήθηκαν· αναγνωρίζονται ως ο ίδιος πάροχος. */
  formerAfm?: readonly FormerAfm[];
}

// Πάροχοι 24/11/2026 (scratchpad providers-research-v2.md, απόσπασμα §4).
// Αλλαγές από το προηγούμενο μητρώο: ΟΤΕ με πηγή του ίδιου (telekom.gr) αντί για
// τρίτο, διακριτικός τίτλος «Telekom» από 03/09/2026· COSMOTE Κινητές ως παλιό ΑΦΜ
// (λογαριασμοί ως 01/01/2024)· Watt+Volt και Volterra ως παλιά ΑΦΜ της METLEN·
// Ήρων με τους γενικούς όρους του heron.gr· νέοι Enerwave (πρώην Elpedison), ZeniΘ,
// NRG, Φυσικό Αέριο ΕΕΕ, Volton, Nova, Inalan. Όλοι `checkedAt: null`: η πηγή
// διαβάστηκε από ευρετήριο αναζήτησης, όχι από άνθρωπο. Ποτέ το ΑΦΜ των καυσίμων
// της HELLENiQ (scripts/guard-provider-afm.mjs).

export const PROVIDERS: readonly Provider[] = [
  {
    afm: '090000045', name: 'ΔΕΗ', kinds: [],
    source: 'https://www.dei.gr/media/hrvfa042/katastatiko-382022-me-psu.pdf',
    quote: 'Καταστατικό «Δημόσια Επιχείρηση Ηλεκτρισμού Ανώνυμη Εταιρεία» (Δ.Ε.Η. Α.Ε.): Αρ. Γ.Ε.ΜΗ.: 786301000, Α.Φ.Μ.: 090000045, Δ.Ο.Υ. Φ.Α.Ε. Αθηνών',
    checkedAt: null,
  },
  {
    afm: '094019245', name: 'Telekom (ΟΤΕ)', kinds: [],
    source: 'https://www.telekom.gr/pdf/TermsConditions/simvasi_tilefonikis_gramis_v5.pdf',
    quote: 'Γενικοί όροι τηλεφωνικής γραμμής: ΟΡΓΑΝΙΣΜΟΣ ΤΗΛΕΠΙΚΟΙΝΩΝΙΩΝ ΤΗΣ ΕΛΛΑΔΟΣ Α.Ε., Λ. Κηφισίας 99, Μαρούσι, ΑΦΜ 094019245. Επωνυμία αμετάβλητη· «Telekom» είναι διακριτικός τίτλος από 03/09/2026',
    checkedAt: null,
    formerAfm: [
      {
        afm: '094493766', name: 'COSMOTE – Κινητές Τηλεπικοινωνίες Μ.Α.Ε.', until: '2024-01-01',
        source: 'https://www.telekom.gr/pdf/TermsConditions/oroi-paroxis-simvolaiou-cosmote.pdf',
        quote: 'Γενικοί όροι COSMOTE: ΑΦΜ 094493766, ΔΟΥ ΦΑΕ Αθηνών, (Αρ. ΓΕΜΗ 2410501000), που εδρεύει στο Μαρούσι Αττικής. Απορροφήθηκε από τον ΟΤΕ (01/2024)',
      },
    ],
  },
  {
    afm: '094349850', name: 'Vodafone', kinds: [],
    source: 'https://assets.ctfassets.net/b79acpktwvj7/2gMEvs4fA6SQRKJ4vO20BK/e24786bbac3b330ec39ebe851a8c45e7/genikoi-oroi-paroxis-vodafone-home-october-2022__1_.pdf',
    quote: 'Γενικοί όροι Vodafone Home F-921: VODAFONE – ΠΑΝΑΦΟΝ ΑΕΕΤ, Τζαβέλλα 1-3, Χαλάνδρι, ΑΦΜ 094349850',
    checkedAt: null,
  },
  {
    afm: '099936189', name: 'Nova', kinds: [],
    source: 'https://nova.gr/politikes-oroi/oroi-xrisis',
    quote: 'Όροι χρήσης nova.gr: Εμπορική Επωνυμία NOVA TELECOMMUNICATIONS AND MEDIA ΜΟΝΟΠΡΟΣΩΠΗ Α.Ε., ΑΦΜ 099936189 (πρώην WIND ΕΛΛΑΣ, Γ.Ε.ΜΗ. 004127301000)',
    checkedAt: null,
    // formerAfm: NOVA ΤΗΛΕΠΙΚΟΙΝΩΝΙΕΣ Μ.Α.Ε. (πρώην Forthnet), απορροφήθηκε 02/01/2023.
    // ΑΦΜ ΔΕΝ ΕΠΙΒΕΒΑΙΩΘΗΚΕ. Θέλει παλιό λογαριασμό χρήστη.
  },
  {
    afm: '800599796', name: 'Inalan', kinds: [],
    source: 'https://inalan.gr/oroi-chrisis',
    quote: 'Όροι χρήσης inalan.gr: INALAN, Πευκών 56, Μεταμόρφωση, ΑΦΜ 800599796, ΦΑΕ Αθηνών',
    checkedAt: null,
  },
  {
    afm: '099810593', name: 'Ήρων', kinds: [],
    source: 'https://heron.gr/media/0ioco1y1/γενικοι-οροι.pdf',
    quote: 'Γενικοί όροι Ήρων: ΑΦΜ 099810593, ΔΟΥ ΦΑΕ Αθηνών, Γ.Ε.ΜΗ. 005805601000. ΣΗΜ.: εκκρεμεί απορρόφηση σε UtilityCo μαζί με NRG',
    checkedAt: null,
  },
  {
    afm: '094316669', name: 'Protergia (METLEN)', kinds: [],
    source: 'https://www.protergia.gr/media/c2lmeynu/εο1250-2_226_v1_072026_gos_oikiako_dynamic_one.pdf',
    quote: 'Σύμβαση Protergia (07/2026): METLEN Μονοπρόσωπη A.E., Α.Φ.Μ. 094316669. Ίδιο ΑΦΜ με «ΜΥΤΙΛΗΝΑΙΟΣ Α.Ε.» (αίτηση Protergia 2019) πριν από τη μετονομασία της 20/06/2024',
    checkedAt: null,
    formerAfm: [
      {
        afm: '998283692', name: 'WATT AND VOLT Α.Ε.', until: '2023-12-18',
        source: 'https://www.protergia.gr/media/ahkaq3gy/45-symvasi-fixed-2022-05.pdf',
        quote: 'Σύμβαση WATT AND VOLT Α.Ε. (2022): Λεωφ. Κηφισίας 217Α, Μαρούσι, Α.Φ.Μ. 998283692, Δ.Ο.Υ. ΦΑΕ Αθηνών. Απορρόφηση εγκρίθηκε 18/12/2023',
      },
      {
        afm: '998808439', name: 'VOLTERRA Α.Ε.', until: null,
        source: 'https://www.protergia.gr/media/3kjpgb0a/new-yellow-aitisi-epixeirisi.pdf',
        quote: 'Αίτηση προμήθειας: Volterra ΑΕ, Αρτέμιδος 8, Παράδεισος Αμαρουσίου, […] Α.Φ.Μ.: 998808439, ΔΟΥ: ΦΑΕ ΑΘΗΝΩΝ',
      },
    ],
  },
  {
    afm: '999717970', name: 'Enerwave (πρώην Elpedison)', kinds: [],
    source: 'https://www.enerwave.gr/Uploads/Documents/134555/Enerwave%20Promo_Go%20For%20More%20Terms%20%CE%A1%CE%B5%CF%8D%CE%BC%CE%B1%20%CE%91%CE%AD%CF%81%CE%B9%CE%BF%2050%E2%82%AC_Jan%202026.pdf',
    quote: 'Όροι προωθητικής ενέργειας Enerwave (01/2026): Enerwave Α.Ε., Φραγκοκκλησιάς 6, Μαρούσι, ΑΦΜ 999717970, Γ.Ε.ΜΗ. 009246101000 (ίδιο Γ.Ε.ΜΗ. με την ELPEDISON Α.Ε.· νέο όνομα 12/11/2025)',
    checkedAt: null,
  },
  {
    afm: '997998048', name: 'ZeniΘ', kinds: [],
    source: 'https://myzenithapi.zenith.gr/media/45kaqueg/entypo_ypiresiwn_hlektrikhs_energeias_zenith_1-1-1.pdf',
    quote: 'Έντυπο Υπηρεσιών Ηλεκτρικής Ενέργειας ZeniΘ: Εταιρεία Προμήθειας Αερίου Θεσσαλονίκης – Θεσσαλίας Μονοπρόσωπη Α.Ε., ΑΡΙΘΜ. ΓΕΜΗ: 141002104000 - ΑΦΜ: 997998048',
    checkedAt: null,
  },
  {
    afm: '998102480', name: 'NRG', kinds: [],
    source: 'https://www.nrg.gr/sites/default/files/2024-09/%CE%A4%CE%B9%CE%BC%CE%BF%CE%BA%CE%B1%CF%84%CE%B1%CC%81%CE%BB%CE%BF%CE%B3%CE%BF%CF%82%20%CE%A0%CF%81%CE%BF%CE%B3%CF%81%CE%B1%CE%BC%CE%BC%CE%B1%CC%81%CF%84%CF%89%CE%BD%20%CE%9A%CF%85%CE%BC%CE%B1%CE%B9%CE%BD%CE%BF%CE%BC%CE%B5%CC%81%CE%BD%CE%B7%CF%82%20%CE%A4%CE%B9%CE%BC%CE%B7%CC%81%CF%82%20nrg%20simple_%CE%9A%CE%B9%CC%81%CF%84%CF%81%CE%B9%CE%BD%CE%BF%20%CE%A4%CE%B9%CE%BC%CE%BF%CE%BB%CE%BF%CC%81%CE%B3%CE%B9%CE%BF.pdf',
    quote: 'Τιμοκατάλογος nrg simple (09/2024): NRG Supply and Trading Μονοπρόσωπη Ενεργειακή Α.Ε., ΑΦΜ: 998102480, Δ.Ο.Υ.: ΚΕΦΟΔΕ ΑΤΤΙΚΗΣ, Γ.Ε.ΜΗ.: 008361601000. ΣΗΜ.: εκκρεμεί απορρόφηση σε UtilityCo μαζί με Ήρων',
    checkedAt: null,
  },
  {
    afm: '997104531', name: 'Φυσικό Αέριο ΕΕΕ', kinds: [],
    source: 'https://fysikoaerioellados.gr/sites/default/files/2026-02/%CE%9F%CE%A1%CE%9F%CE%99-%CE%94%CE%99%CE%91%CE%93%CE%A9%CE%9D%CE%99%CE%A3%CE%9C%CE%9F%CE%A5-%CE%A6%CE%A5%CE%A3%CE%99%CE%9A%CE%9F-%CE%91%CE%95%CE%A1%CE%99%CE%9F_10_11_2025_F.pdf',
    quote: 'Όροι διαγωνισμού Φυσικό Αέριο (11/2025): Εταιρεία Παροχής Αερίου Αττικής – Ελληνική Μονοπρόσωπη Α.Ε. Ενέργειας, Αριθμός Γ.Ε.Μ.Η.: 141013101000 και Α.Φ.Μ.: 997104531',
    checkedAt: null,
  },
  {
    afm: '800750372', name: 'Volton', kinds: [],
    source: 'https://volton.gr/schetika-me-ti-volton/',
    quote: 'Σχετικά με τη Volton: VOLTON ΕΛΛΗΝΙΚΗ ΕΝΕΡΓΕΙΑΚΗ Α.Ε., Σκουζέ 14, Πειραιάς, ΑΦΜ: 800750372, ΚΕΦΟΔΕ ΑΤΤΙΚΗΣ',
    checkedAt: null,
  },
  {
    afm: '094079101', name: 'ΕΥΔΑΠ', kinds: [],
    source: 'https://athexgroup.gr/el/documents/10180/3883164/%CE%9F%CE%B9%CE%BA%CE%BF%CE%BD%CE%BF%CE%BC%CE%B9%CE%BA%CE%AE%20%CE%9A%CE%B1%CF%84%CE%AC%CF%83%CF%84%CE%B1%CF%83%CE%B7%20%CE%95.%CE%A5%CE%94.%CE%91.%CE%A0.%20%CE%91.%CE%95.%20%282007%2C%CE%95%CF%84%CE%AE%CF%83%CE%B9%CE%BF%CF%82%20%CE%99%CF%83%CE%BF%CE%BB%CE%BF%CE%B3%CE%B9%CF%83%CE%BC%CF%8C%CF%82%2C%CE%9C%CE%B7%CF%84%CF%81%CE%B9%CE%BA%CE%AE%29/35b18c6c-de56-4ecd-a881-ac4418170ea7',
    quote: 'Οικονομικές καταστάσεις Ε.ΥΔ.Α.Π. Α.Ε. στο Χρηματιστήριο Αθηνών: Αρ. Φορολογικού Μητρώου 094079101, Ωρώπου 156 Γαλάτσι',
    checkedAt: null,
  },
  // ΣΕ ΑΝΑΜΟΝΗ (απόφαση ιδιοκτήτη ή άνοιγμα πηγής):
  //   · Elinoil: το ίδιο ΑΦΜ τιμολογεί και καύσιμα.
  //   · Eunice: η φράση με το ΑΦΜ δεν βρέθηκε κατά λέξη.
  //   · ΕΥΑΘ: το ΑΦΜ βρέθηκε σε μία μόνο πηγή, χωρίς σαφές URL.
  //   · ΔΕΗ Fiber: άγνωστο αν τιμολογεί η ΔΕΗ Α.Ε. (090000045) ή θυγατρική.
  //   · UtilityCo (Ήρων + NRG): νέο ΑΦΜ όταν ολοκληρωθεί· τότε τα 099810593 και
  //     998102480 περνούν σε formerAfm.
];

/**
 * ΧΩΡΙΣ ΕΠΑΛΗΘΕΥΣΗ (23/11/2026): δεν βρέθηκε δημόσια πηγή που να γράφει το ΑΦΜ,
 * ή οι πηγές διαφωνούσαν. Μένουν εκτός μητρώου, άρα «Για έλεγχο», ως να μπει
 * το ΑΦΜ με πηγή:
 *   · νερό: ΕΥΑΘ (το ΑΦΜ βρέθηκε σε μία μόνο πηγή· το Γ.Ε.ΜΗ. διαφωνεί ανάμεσα
 *     στις πηγές, οπότε δεν γράφεται εδώ)
 *   · ρεύμα: Elinoil (το ίδιο ΑΦΜ τιμολογεί και καύσιμα), Eunice (η φράση δεν
 *     βρέθηκε κατά λέξη)
 *   · φυσικό αέριο: ΕΔΑ Αττικής (διαχειριστής δικτύου, δεν τιμολογεί τον καταναλωτή)
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

/** Κάθε ΑΦΜ, τρέχον ή παλιό, δείχνει στον πάροχο· το παλιό κρατά και την επωνυμία του. */
type Hit = { p: Provider; former: FormerAfm | null };
const BY_AFM: ReadonlyMap<string, Hit> = new Map<string, Hit>([
  ...PROVIDERS.map((p): [string, Hit] => [p.afm, { p, former: null }]),
  ...PROVIDERS.flatMap(p => (p.formerAfm ?? []).map((f): [string, Hit] => [f.afm, { p, former: f }])),
]);

/** Το είδος του παρόχου, μόνο όταν είναι ΕΝΑ. Με κανένα ή πολλά: κανένα (δεν μαντεύουμε). */
export function providerKind(p: Provider | null | undefined): ProviderKind | null {
  return p && p.kinds.length === 1 ? p.kinds[0] : null;
}

/** Το ΑΦΜ χωρίς κενά και χωρίς το πρόθεμα χώρας «EL». */
export const cleanAfm = (afm: string): string => afm.trim().replace(/^EL/i, '');

export function providerByAfm(afm: string): Provider | null {
  return BY_AFM.get(cleanAfm(afm))?.p ?? null;
}

/** Το όνομα που δείχνει η οθόνη: πρώτα το μητρώο, μετά η επωνυμία του εκδότη. */
export function providerName(afm: string, issuerName: string | null): string | null {
  const hit = BY_AFM.get(cleanAfm(afm));
  return hit?.former?.name ?? hit?.p.name ?? (issuerName?.trim() || null);
}
