// ═══════════════════════════════════════════════════════════════════════════
// Ο ΚΑΤΑΛΟΓΟΣ ΤΗΣ ΑΣΦΑΛΕΙΑΣ ΚΑΤΟΙΚΙΑΣ: ΕΤΑΙΡΕΙΕΣ, ΠΡΟΓΡΑΜΜΑΤΑ, ΤΙΜΕΣ, ΚΑΛΥΨΕΙΣ
// ─────────────────────────────────────────────────────────────────────────
// Οι ασφαλιστικές με τα προγράμματά τους και την ημερομηνία επαλήθευσης, ο
// υπολογισμός ζωντανών προσφορών για το ακίνητο, το εύρημα «αλλαγή ασφάλειας»
// και η ανάγνωση καλύψεων από το κείμενο του συμβολαίου. Τίποτα εδώ δεν
// αποδίδει: τα διαβάζουν η οθόνη της ασφάλειας και η ειδοποίηση εξόδων.
// ═══════════════════════════════════════════════════════════════════════════
import { normalizeEnfiaAgeKey } from '@/lib/billing/enfia'
import { roundHalfUp } from '@/lib/core/money';
import { fe, feWhole } from '@/lib/core/format';
import { PRICE_FACTS, asOfDate, type AsOf } from '@/lib/facts/prices';

// ═══ Ο ΚΙΝΔΥΝΟΣ ΠΑΛΑΙΟΤΗΤΑΣ ΠΟΥ ΗΤΑΝ ΠΑΝΤΑ 1,00 ═══════════════════════════
// Η παλαιότητα διαβάζεται από τη ρύθμιση `enfiaAge`, της οποίας τα κλειδιά
// έγιναν έξι (y0_4 … y26_plus) όταν διορθώθηκε η κλίμακα του ΕΝΦΙΑ. Εδώ όμως
// η σύγκριση έμεινε στα ΠΑΛΙΑ ονόματα ('under_5', '25_30', 'over_30') και η
// προεπιλογή ήταν επίσης παλιά ('10_20'). Καμία συνθήκη δεν ταίριαζε ποτέ σε
// καμία αποθηκευμένη τιμή: ο συντελεστής έβγαινε 1,00 για όλους. Μια οικοδομή
// του 1975 έπαιρνε ακριβώς την ίδια εκτίμηση ασφαλίστρου με νεόδμητη.
//
// Το κλειδί περνά τώρα από την ίδια μετάφραση με τον ΕΝΦΙΑ, οπότε δουλεύει και
// με τα παλιά ονόματα που κάθονται ήδη στις ρυθμίσεις των χρηστών.
/**
 * ΠΟΤΕ ΕΠΑΛΗΘΕΥΤΗΚΑΝ ΤΑ ΑΣΦΑΛΙΣΤΡΑ ΤΟΥ ΚΑΤΑΛΟΓΟΥ.
 *
 * ΤΟ ΚΕΝΟ: σαράντα οκτώ ασφάλιστρα και είκοσι οκτώ τιμές συνδρομών
 * παρουσιάζονταν χωρίς καμία ημερομηνία ή πηγή ανά εγγραφή — ενώ η οθόνη
 * ανακήρυσσε «ΠΡΟΤΕΙΝΟΜΕΝΟ ΓΙΑ ΕΣΕΝΑ». Το `BillsGas.tsx` έχει σήμανση ανά τιμή
 * (επιβεβαιωμένη / ενδεικτική / τύπος) και το `BillsElectricity.tsx` έχει
 * ημερομηνία και πύλη φρεσκάδας. Τρεις κατάλογοι, τρία πρότυπα ειλικρίνειας.
 *
 * Οι τιμές έρχονται από το `data/price-sources.json`, που φυλάσσεται από test.
 * Το κατώφλι είναι 120 ημέρες και όχι 40 όπως στο ρεύμα, με τη δική του
 * αιτιολογία γραμμένη εκεί: τα προγράμματα κατοικίας δεν αλλάζουν μηνιαία.
 *
 * Η ΗΜΕΡΟΜΗΝΙΑ ΕΛΕΓΕ «ΙΟΥΛΙΟΣ 2026» ΓΙΑ ΣΑΡΑΝΤΑ ΤΙΜΕΣ ΠΟΥ ΔΕΝ ΕΛΕΓΧΘΗΚΑΝ ΠΟΤΕ
 * (12/10/2026). Από την ανάγνωση της ομάδας εκείνης της μέρας ο κατάλογος
 * κρατά ΜΟΝΟ δημοσιευμένες τιμές, η καθεμιά με δική της ημερομηνία· αυτή εδώ
 * είναι η παλαιότερη από αυτές και το `catalog.test.ts` το φυλάει. Παλιώνει
 * λοιπόν μαζί με την πιο παλιά τιμή, όχι μαζί με την πιο φρέσκια.
 */
export const INSURANCE_VERIFIED = PRICE_FACTS.insurance.checkedAt;
export const INSURANCE_MAX_AGE_DAYS = PRICE_FACTS.insurance.maxAgeDays;

const AGE_RISK: Record<string, number> = {
  y0_4: 0.90, y5_9: 0.95, y10_14: 1.00, y15_19: 1.05, y20_25: 1.10, y26_plus: 1.20,
};


/**
 * Μάρκες που ανήκουν στην ίδια ασφαλιστική επιχείρηση.
 *
 * Το Anytime είναι το ψηφιακό κανάλι της Interamerican, όχι δεύτερη εταιρεία.
 * Χωρίς αυτό, μια πρόταση «συγκρίναμε 9 εταιρείες» θα μετρούσε την ίδια
 * επιχείρηση δύο φορές. Τα προγράμματα μένουν και τα δύο, γιατί είναι
 * πραγματικά διαφορετικά προϊόντα με διαφορετική τιμή, αλλά η ΕΠΙΧΕΙΡΗΣΗ
 * μετριέται μία.
 *
 * Η MAGENTA ΜΕΤΡΙΟΤΑΝ ΩΣ ΔΕΥΤΕΡΗ ΕΤΑΙΡΕΙΑ ΔΙΠΛΑ ΣΤΗ HELLAS DIRECT. Η σελίδα της
 * (https://www.magentainsurance.gr/home, ανάγνωση της ομάδας 12/10/2026) γράφει
 * ότι πουλά «σε αποκλειστική συνεργασία με την Hellas Direct» τα ίδια
 * προγράμματα. Το κλειδί `cosmote_ins` μένει, γιατί είναι αποθηκευμένο στις
 * ρυθμίσεις των χρηστών· μετριέται όμως ως Hellas Direct.
 *
 * Η αυθεντική πηγή για το ποιες ασφαλιστικές λειτουργούν σήμερα και με ποιο
 * όνομα είναι το δημόσιο μητρώο ασφαλιστικών επιχειρήσεων της Τράπεζας της
 * Ελλάδος. Ο κατάλογος οφείλει να διασταυρώνεται εκεί σε κάθε ενημέρωση.
 */
const BRAND_PARENT: Record<string, string> = {
  anytime: 'interamerican',
  cosmote_ins: 'hellas_direct',
};

/** Πόσες ΕΠΙΧΕΙΡΗΣΕΙΣ, όχι πόσες μάρκες. */
export const distinctInsurers = (companyIds: string[]): number =>
  new Set(companyIds.map(c => BRAND_PARENT[c] ?? c)).size;

/**
 * ΠΟΣΕΣ ΑΣΦΑΛΙΣΤΙΚΕΣ ΕΧΕΙ Ο ΚΑΤΑΛΟΓΟΣ: όσες έχουν διεύθυνση, με τη μάρκα
 * μετρημένη στη μητρική της.
 *
 * Η ΟΘΟΝΗ, Η ΑΡΧΙΚΗ ΚΑΙ ΤΑ REELS ΜΕΤΡΟΥΣΑΝ ΜΑΡΚΕΣ. Η Ασφάλεια έγραφε
 * «εμφανίζονται N σχετικές ασφαλιστικές εταιρείες» με το πλήθος των επιλογών
 * του μενού, μαζί με το «Άλλη Ασφαλιστική» και με το Anytime δίπλα στην
 * Interamerican· η αρχική και τα reels μετρούσαν κάθε εταιρεία με διεύθυνση και
 * έγραφαν 16. Η Magenta πουλά τα προγράμματα της Hellas Direct
 * (https://www.magentainsurance.gr/home, ανάγνωση 12/10/2026), οπότε οι
 * επιχειρήσεις είναι δύο λιγότερες. Το «Άλλη Ασφαλιστική» δεν έχει διεύθυνση
 * και δεν μετρά. Η αρχική και τα reels μετρούν με τον ίδιο κανόνα μόνο όσες
 * διαβάστηκαν (`READ_INSURERS`, πιο κάτω).
 */
export const countInsurers =(companies: { value: string; url: string }[]): number =>
  distinctInsurers(companies.filter(c => /^https:\/\//.test(c.url)).map(c => c.value));

// ─── Insurance data ────────────────────────────────────────────────────────────
// ΤΟ ΣΧΗΜΑ ΔΗΛΩΝΕΤΑΙ, ΔΕΝ ΣΥΜΠΕΡΑΙΝΕΤΑΙ. Χωρίς τον τύπο, ο μεταγλωττιστής
// έβγαζε ένωση από τριάντα διαφορετικά σχήματα αντικειμένου (άλλο πρόγραμμα έχει
// `covers`, άλλο όχι) και κάθε ανάγνωση πεδίου χρειαζόταν `(p as any)`. Δηλαδή
// μια ορθογραφία σε όνομα πεδίου περνούσε αθόρυβα και το κελί έμενε κενό.
//
// Η ΤΙΜΗ ΧΩΡΙΣ ΠΗΓΗ ΚΑΙ Η ΔΗΜΟΣΙΕΥΜΕΝΗ ΗΤΑΝ ΤΟ ΙΔΙΟ ΠΕΔΙΟ (12/10/2026). Το
// `monthly: 10` που γράψαμε εμείς και το `monthly: 15` της Εθνικής έμοιαζαν
// ίδια για κάθε κώδικα που τα διάβαζε· το «δεν δημοσιεύεται τιμή» γραφόταν
// `monthly: 0`, δηλαδή με το ίδιο ψηφίο που σημαίνει «δεν πληρώνω τίποτα». Η
// τιμή ζει πλέον στο `price` και υπάρχει ΜΟΝΟ με ποσό, μονάδα της εταιρείας,
// σενάριο, ημερομηνία ανάγνωσης και διεύθυνση. Χωρίς `price` το πρόγραμμα
// έχει τιμή μόνο με προσφορά.

/** Η μονάδα της τιμής, όπως τη δίνει η εταιρεία. Δεν μετατρέπεται ποτέ. */
type PriceUnit = 'month' | 'year';

/** Μια δημοσιευμένη τιμή, με όσα την κάνουν ελέγξιμη. */
interface PublishedPrice {
  amount: number;
  unit: PriceUnit;
  /** «από»: η εταιρεία δίνει κατώτατο, όχι ποσό για το σενάριο. */
  from?: boolean;
  /** Το σενάριο της εταιρείας, με τα λόγια της. Μπαίνει μετά το «για». */
  scenario: string;
  /** Πότε διαβάστηκε η σελίδα (ISO). */
  checkedAt: string;
  /** Ο μήνας τιμολόγησης που δηλώνει η εταιρεία, όταν τον δηλώνει. */
  period?: string;
  source: string;
  url: string;
}

/**
 * `legacy`: το όνομα δεν υπάρχει στη σελίδα της εταιρείας. Μένει γιατί το
 * αναγνωριστικό του μπορεί να είναι αποθηκευμένο στις ρυθμίσεις χρήστη.
 * `unverified`: η σελίδα της εταιρείας δεν διαβάστηκε.
 */
type PlanStatus = 'legacy' | 'unverified';

/** Κατοικία (κτίριο ή κτίριο και περιεχόμενο) ή μόνο περιεχόμενο. */
type PlanKind = 'home' | 'contents';

interface SourcePlan {
  id: string;
  name: string;
  status?: PlanStatus;
  /** Χωρίς τιμή: κατοικία. Το «μόνο περιεχόμενο» δεν μπαίνει ποτέ σε σύγκριση κτιρίου. */
  kind?: PlanKind;
  /** Χωρίς αυτό: τιμή μόνο με προσφορά. Ποτέ μηδέν. */
  price?: PublishedPrice;
  /** Τα τ.μ. στα οποία αναφέρεται η μηνιαία τιμή, όταν τα δηλώνει η πηγή. Χωρίς αυτό, 100. */
  baseSqm?: number;
  /**
   * Χωρίς αυτό: οι καλύψεις ΔΕΝ ΚΑΤΑΓΡΑΦΗΚΑΝ και το όνομα το λέει (βλ.
   * `COVERS_NOTE`). Το `[]` σημαίνει «καμία κάλυψη» και το έχει μόνο το
   * «Προσαρμοσμένο», που το γεμίζει ο ίδιος ο χρήστης.
   */
  covers?: string[];
  /**
   * ΚΑΛΥΨΕΙΣ ΠΟΥ ΠΡΟΣΤΙΘΕΝΤΑΙ ΜΕ ΕΠΙΠΛΕΟΝ ΑΣΦΑΛΙΣΤΡΟ, κατά το IPID. Δεν
   * γράφονται στο `covers` και δεν ανάβουν σημαία: η οθόνη δεν έχει τρόπο να
   * πει «μόνο αν την προσθέσεις», οπότε θα τη δήλωνε ως δεδομένη.
   */
  optional?: string[];
  earthquake?: boolean;
  flood?: boolean;
  natural?: boolean;
}

interface CatalogPlan extends Omit<SourcePlan, 'name' | 'kind' | 'covers'> {
  /** Το όνομα όπως το δείχνει η οθόνη, με τη σήμανση `status` όπου υπάρχει. */
  name: string;
  /** Το όνομα του προϊόντος, χωρίς σήμανση. */
  productName: string;
  kind: PlanKind;
  covers: string[];
  /**
   * `false`: η πηγή δεν έγραψε καλύψεις. Τα «Όχι» των πλακιδίων τότε δεν είναι
   * γεγονός και η οθόνη δεν πρέπει να γράφει «δεν καλύπτει» για το πρόγραμμα.
   */
  coversRecorded: boolean;
  /**
   * ΣΥΜΒΑΤΟΤΗΤΑ ΜΕ ΤΗΝ ΟΘΟΝΗ, ΟΧΙ ΤΙΜΗ. Η δημοσιευμένη τιμή όταν η εταιρεία τη
   * δίνει ανά μήνα· αλλιώς 0. Τη διαβάζει μόνο το `insuranceMonthly`, για το
   * «τι πληρώνεις τον μήνα» όταν ο χρήστης δεν έγραψε ποσό· ο επιλογέας γράφει
   * την τιμή από το `price`, στη μονάδα της εταιρείας (`planOptionLabel`) και ο
   * `computeLiveQuotes` δεν το κοιτάζει καν. Ετήσια τιμή δεν διαιρείται ποτέ με
   * το δώδεκα για να γεμίσει αυτό το πεδίο.
   */
  monthly: number;
  /** Η γραμμή «σενάριο · ημερομηνία · πηγή» της τιμής, όπου υπάρχει τιμή. */
  priceFact?: AsOf;
  /**
   * ΣΕΙΣΜΟΣ, ΠΥΡΚΑΓΙΑ ΚΑΙ ΠΛΗΜΜΥΡΑ ΜΑΖΙ: οι κίνδυνοι της μείωσης ΕΝΦΙΑ
   * ασφαλισμένης κατοικίας (ΑΑΔΕ, απόφαση Α.1005/2026). Προαιρετική κάλυψη δεν
   * μετρά. Τα υπόλοιπα κριτήρια της μείωσης (διάρκεια, κεφάλαιο ανά τ.μ.,
   * μητρώο της ΤτΕ) δεν τα ξέρει ο κατάλογος.
   *
   * Η ΓΡΑΜΜΗ ΕΝΦΙΑ ΤΗΣ ΑΣΦΑΛΕΙΑΣ ΑΝΑΒΕ ΚΑΙ ΣΕ ΕΝΤΕΚΑ ΠΡΟΓΡΑΜΜΑΤΑ ΧΩΡΙΣ ΠΗΓΗ
   * (12/10/2026). Άναβε μόνο με τις σημαίες σεισμού και πλημμύρας, που τις
   * είχαν και ονόματα που δεν βρέθηκαν στη σελίδα της εταιρείας ή εταιρείες
   * που δεν διαβάστηκαν: π.χ. το ανύπαρκτο «MeinHaus Plus», με «Πλήρης Κάλυψη +
   * Σεισμός» που δεν το γράφει κανένα IPID. Πρόγραμμα με `status`, μόνο
   * περιεχομένου ή χωρίς καταγεγραμμένες καλύψεις (`coversRecorded: false`) δεν
   * το παίρνει ποτέ, όπως και στο `insuranceCoversEnfiaPerils` του EnfiaPanel.tsx.
   */
  enfiaRisks: boolean;
}

interface SourceCompany {
  value: string;
  label: string;
  url: string;
  agent_label: string;
  /**
   * Πότε διαβάστηκε η σελίδα ή το IPID της εταιρείας για ονόματα και καλύψεις.
   * `null`: δεν διαβάστηκε και τα προγράμματά της είναι `unverified`.
   */
  checkedAt: string | null;
  propertyTypes: string[];
  note: string;
  /** Τιμή «από» που η εταιρεία δεν δένει με συγκεκριμένο πρόγραμμα. Δεν μπαίνει σε σύγκριση. */
  fromPrice?: PublishedPrice;
  plans: SourcePlan[];
}

interface InsuranceCompany extends Omit<SourceCompany, 'plans'> {
  plans: CatalogPlan[];
  /** Η γραμμή «σενάριο · ημερομηνία · πηγή» του `fromPrice`, όπου υπάρχει. */
  fromFact?: AsOf;
}

// ═══ ΚΑΝΕΝΑ ΑΣΦΑΛΙΣΤΡΟ ΔΕΝ ΕΛΕΓΕ ΑΝ ΕΠΑΛΗΘΕΥΕΤΑΙ ΠΟΥΘΕΝΑ ══════════════════
// Η οθόνη έγραφε «Ενδεικτικές τιμές, όχι προσφορές» και την ημερομηνία του
// καταλόγου, όχι όμως ότι τα ποσά βάσης δεν υπάρχουν δημοσιευμένα.
//
// ΤΑ ΠΟΣΑ ΧΩΡΙΣ ΠΗΓΗ ΕΦΥΓΑΝ (12/10/2026). Η ανάγνωση της ομάδας εκείνης της
// μέρας (σελίδες και IPID των εταιρειών, μαζί με τα στοιχεία της 05/10/2026)
// βρήκε δημοσιευμένο ποσό με σενάριο μόνο σε τέσσερις: Εθνική
// (https://www.ethnikiasfalistiki.gr/home-property), ERGO
// (https://www.ergohellas.gr/residence), Magenta για τα προγράμματα της Hellas
// Direct (https://www.magentainsurance.gr/home) και Anytime για το περιεχόμενο
// με την Κωτσόβολος (https://www.anytime.gr/home/kotsovolos-program). Κάθε
// άλλο ποσό, περίπου σαράντα, ήταν δικό μας και δεν το δημοσιεύει κανείς.
export const INSURANCE_PRICE_CAVEAT =
  'Οι ασφαλιστικές δεν δημοσιεύουν τιμοκατάλογο κατοικίας. Τιμή γράφεται μόνο όπου η εταιρεία δημοσιεύει παράδειγμα, με το σενάριό της, την πηγή και την ημερομηνία ανάγνωσης· για τα υπόλοιπα προγράμματα τιμή δίνει μόνο η προσφορά της εταιρείας. Σύγκριση και πρόταση γίνονται μόνο όταν δημοσιεύουν τιμή περισσότερες από μία ασφαλιστικές.';

/**
 * «47€ τον χρόνο», «από 12€ τον μήνα»: το ποσό στη μονάδα που το δίνει η
 * εταιρεία. Ακέραιο ποσό χωρίς δεκαδικά, γιατί έτσι το γράφει και η πηγή.
 */
const priceAmount = (p: PublishedPrice): string =>
  `${p.from ? 'από ' : ''}${Number.isInteger(p.amount) ? feWhole(p.amount) : fe(p.amount)} ${p.unit === 'month' ? 'τον μήνα' : 'τον χρόνο'}`;

/** «Δημοσιευμένη ενδεικτική τιμή 15€ τον μήνα για μόνιμη κατοικία 80 τ.μ., με απαλλαγές.» */
const priceLabel = (p: PublishedPrice): string =>
  `Δημοσιευμένη ενδεικτική τιμή ${priceAmount(p)} για ${p.scenario}.`;

const priceFactOf = (p: PublishedPrice, after = ''): AsOf => ({
  label: `${priceLabel(p)}${after}`, checkedAt: p.checkedAt, period: p.period, source: p.source, url: p.url,
});

// ─── Coverage taxonomy, δυναμική ανάλυση καλύψεων (pricefox / insurancemarket style) ──
// Οι φράσεις «Πλήρης Κάλυψη / Παντός Κινδύνου / All Risk» υπονοούν τους βασικούς κινδύνους.
// Ζουν πριν από τον κατάλογο γιατί ο κατάλογος τις χρειάζεται για το `enfiaRisks`.
const ALL_RISK_HINTS = ['πλήρης', 'παντός κινδύνου', 'all risk', 'παντός'];
function hasCov(covers: string[], keys: string[], allRiskImplies = false): boolean {
  const joined = (covers || []).join(' ').toLowerCase();
  if (keys.some(k => joined.includes(k.toLowerCase()))) return true;
  if (allRiskImplies && ALL_RISK_HINTS.some(h => joined.includes(h))) return true;
  return false;
}
/** Η πυρκαγιά με τον ίδιο κανόνα που ανάβει το πλακίδιο «Πυρκαγιά» της οθόνης. */
const coversFire = (covers: string[]) => hasCov(covers, ['πυρκαγιά', 'φωτιά'], true);

// ── ΤΑ ΠΟΣΑ ΠΟΥ ΔΗΜΟΣΙΕΥΟΥΝ ΟΙ ΕΤΑΙΡΕΙΕΣ, ΑΝΑΓΝΩΣΗ 12/10/2026 ───────────────
// ΤΟ 15€ ΤΗΣ ΕΘΝΙΚΗΣ ΔΕΝ ΕΔΕΙΧΝΕ ΣΤΗΝ ΟΘΟΝΗ ΑΠΟ ΠΟΥ ΕΡΧΕΤΑΙ. Η πηγή ζούσε στο
// σχόλιο από κάτω και στο data/price-sources.json. Ξαναδιαβάστηκε 12/10/2026
// στη https://www.ethnikiasfalistiki.gr/home-property (χάρτης αγοράς της
// ομάδας): «80 τ.μ. μόνιμη κατοικία, Full Home Advance, 15€/μήνα*», ίδιο με
// την ανάγνωση της 28/09/2026. Η σελίδα το δίνει ενδεικτικά και με όρους
// (αστερίσκος), οπότε έτσι το λέει και η ετικέτα.
const ETHNIKI_ADVANCE_PRICE: PublishedPrice = {
  amount: 15, unit: 'month', scenario: 'μόνιμη κατοικία 80 τ.μ., με απαλλαγές',
  checkedAt: '2026-10-12', source: 'ethnikiasfalistiki.gr', url: 'https://www.ethnikiasfalistiki.gr/home-property',
};

// Ο ΠΙΝΑΚΑΣ ΤΗΣ MAGENTA, ΑΝΑ ΕΤΟΣ ΟΠΩΣ ΤΟΝ ΔΙΝΕΙ. https://www.magentainsurance.gr/home,
// ανάγνωση 12/10/2026, για κατοικία 80 τ.μ., κατασκευή 2020, στο Μαρούσι, με
// τιμολόγηση 09/2026. Η στήλη «−10%» της σελίδας είναι έκπτωση με όρους και
// δεν μπαίνει. Το «+ Κλοπή» (52 / 82€) και το «+ Σεισμός + Κλοπή» (120 / 163€)
// δεν μπαίνουν σε αυτή την αλλαγή: η πρόταση της ομάδας κράτησε τρία πακέτα.
// Μένουν γραμμένα στο data/price-sources.json.
const magentaYear = (amount: number, insures: string): PublishedPrice => ({
  amount, unit: 'year',
  scenario: `${insures}, 80 τ.μ., κατασκευή 2020, Μαρούσι, τιμολόγηση Σεπτεμβρίου 2026`,
  checkedAt: '2026-10-12', period: 'Σεπτέμβριος 2026',
  source: 'magentainsurance.gr', url: 'https://www.magentainsurance.gr/home',
});

// ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ ΜΕ ΤΗΝ ΚΩΤΣΟΒΟΛΟΣ, https://www.anytime.gr/home/kotsovolos-program,
// ανάγνωση 12/10/2026: 19€ τον χρόνο με όριο 3.000€ και 39€ με όριο 10.000€.
// Μόνο περιεχόμενο, οπότε `kind: 'contents'` και καμία σύγκριση με κτίριο.
const kotsovolosYear = (amount: number, limit: number): PublishedPrice => ({
  amount, unit: 'year', scenario: `περιεχόμενο με όριο αποζημίωσης ${feWhole(limit)}`,
  checkedAt: '2026-10-12', source: 'anytime.gr', url: 'https://www.anytime.gr/home/kotsovolos-program',
});

/** Η μέρα που διαβάστηκαν σελίδες και IPID των εταιρειών για ονόματα και καλύψεις. */
const REVIEWED_AT = '2026-10-12';

/** Η σήμανση που κολλά στο όνομα, ώστε να τη βλέπει ο επιλογέας της οθόνης. */
const STATUS_NOTE: Record<PlanStatus, string> = {
  legacy: `δεν βρέθηκε στη σελίδα της εταιρείας, ${asOfDate(REVIEWED_AT)}`,
  unverified: `μη επαληθευμένο, ${asOfDate(REVIEWED_AT)}`,
};

// ΤΑ ΠΡΑΓΜΑΤΙΚΑ ΠΡΟΓΡΑΜΜΑΤΑ ΧΩΡΙΣ ΚΑΛΥΨΕΙΣ ΕΒΓΑΙΝΑΝ «ΔΕΝ ΚΑΛΥΠΤΕΙ ΣΕΙΣΜΟ ΟΥΤΕ
// ΠΛΗΜΜΥΡΑ» (12/10/2026). Η ανάγνωση της ημέρας βρήκε τα ονόματα των Eurolife,
// Generali, Allianz και Groupama και το περιεχόμενο με την Κωτσόβολος της
// Anytime (οι σελίδες είναι στο `url` και στο σχόλιο κάθε εταιρείας), όχι όμως
// τις καλύψεις τους. Τα πλακίδια έδειχναν «Όχι» σε όλα, μαζί και στην πυρκαγιά:
// το ίδιο σφάλμα που διορθώθηκε στην Εθνική πιο κάτω. Το «Όχι» μένει, γιατί
// ένα «Ναι» χωρίς IPID θα άφηνε τον χρήστη ακάλυπτο· το όνομα όμως λέει ότι
// δεν είναι γεγονός. Στην οθόνη το ίδιο το λέει το `coversRecorded`.
const COVERS_NOTE = `καλύψεις δεν καταγράφηκαν, ${asOfDate(REVIEWED_AT)}`;

// Οι καλύψεις που γράφονται με τις ίδιες λέξεις στα πλακίδια της οθόνης
// (`deriveCoverages`), ώστε το κείμενο να ανάβει το σωστό.
const FIRE = 'Πυρκαγιά', FLOOD = 'Πλημμύρα', WEATHER = 'Φυσικά Φαινόμενα', THEFT = 'Κλοπή';
const LIABILITY = 'Αστική Ευθύνη', WATER = 'Θραύση Σωληνώσεων', GLASS = 'Θραύση Κρυστάλλων';
const RENT_LOSS = 'Απώλεια Ενοικίων', QUAKE = 'Σεισμός';

// ═══ ΤΑ ΟΝΟΜΑΤΑ ΠΟΥ ΔΕΝ ΥΠΗΡΧΑΝ ΚΑΙ ΤΑ ΑΝΑΓΝΩΡΙΣΤΙΚΑ ΠΟΥ ΜΕΝΟΥΝ ═════════════
// Η ανάγνωση της ομάδας (12/10/2026) βρήκε σε επτά εταιρείες ονόματα που δεν
// υπάρχουν στη σελίδα τους: «MeinHaus» στην Allianz, «myZen» στη Groupama,
// «HomeSecure» στη Eurolife, «MyHome» στη Generali, «Home Basic/Plus/Premium»
// στην ERGO, «COMFORT» στην Interamerican, «Magenta Home» στη Magenta.
//
// Τα αναγνωριστικά τους (`im_comfort`, `al_comp` …) ΔΕΝ σβήνονται και ΔΕΝ
// δίνονται σε άλλο προϊόν: είναι αποθηκευμένα στο `insPlanId` των ρυθμίσεων
// (bills_settings, section insurance) όσων τα διάλεξαν. Μένουν στο τέλος της
// λίστας κάθε εταιρείας, χωρίς τιμή και με τη σήμανση στο όνομα· το πρώτο
// πρόγραμμα, που επιλέγεται μόλις αλλάξει η εταιρεία, είναι πάντα πραγματικό.
// Τα πραγματικά προϊόντα μπαίνουν με ΝΕΑ αναγνωριστικά. Όπου το παλιό όνομα
// ήταν το ίδιο προϊόν με άλλη γραφή («HOME EXTRA» → Extra, «HOME TOTAL» →
// Total), το αναγνωριστικό κρατιέται και διορθώνονται όνομα και καλύψεις.
//
// ΟΙ ΚΑΛΥΨΕΙΣ ΑΠΟ ΤΑ IPID, ΟΧΙ ΑΠΟ ΤΟ ΜΑΡΚΕΤΙΝΓΚ. Ό,τι το IPID γράφει
// προαιρετικό πάει στο `optional`. Ό,τι η ανάγνωση δεν έγραψε δεν δηλώνεται:
// καλύτερα ένα «Όχι» που ο χρήστης διορθώνει με ένα πάτημα, παρά ένα «Ναι» που
// τον αφήνει ακάλυπτο.
const CATALOG: SourceCompany[] = [
  // Hellas Direct: σελίδα και IPID 12/10/2026. Η σελίδα ΔΕΝ δημοσιεύει τιμή·
  // τα 55, 40, 85 και 120€ τον χρόνο που έγραφε ο κατάλογος δεν είχαν πηγή.
  // Τις τιμές των ίδιων προγραμμάτων τις δημοσιεύει η Magenta, πιο κάτω.
  //
  // ΟΙ ΚΑΛΥΨΕΙΣ ΤΩΝ ΤΕΣΣΑΡΩΝ ΓΡΑΜΜΩΝ ΔΕΝ ΕΙΧΑΝ ΠΗΓΗ (12/10/2026). Ο κατάλογος
  // έδινε στο `hd_ktirio` πλημμύρα χωρίς σεισμό, στο `hd_full` κλοπή και στο
  // `hd_full_eq` «Πλήρης Κάλυψη» με σεισμό και πλημμύρα: η φράση άναβε την
  // πυρκαγιά, τις σωληνώσεις και το βραχυκύκλωμα και οι δύο σημαίες τη γραμμή
  // της μείωσης ΕΝΦΙΑ. Κανένα IPID δεν τα έγραφε. Η ανάγνωση
  // της ημέρας γράφει σεισμό στο κτίριο της Hellas Direct
  // (https://www.hellasdirect.gr/asfaleia-katoikias και IPID), ενώ ο πίνακας
  // της Magenta για τα ίδια προγράμματα (https://www.magentainsurance.gr/home)
  // δίνει τον σεισμό ως «+ Σεισμός» και την κλοπή ως «+ Κλοπή». Οι δύο πηγές
  // διαφωνούν, οπότε οι καλύψεις δεν δηλώνονται μέχρι να διαβαστεί το IPID ανά
  // πακέτο: το όνομα λέει ότι δεν καταγράφηκαν, όπως στα άλλα τέτοια προγράμματα.
  // Αναγνωριστικά και ονόματα μένουν, γιατί είναι αποθηκευμένα στις ρυθμίσεις.
  { value: 'hellas_direct', label: 'Hellas Direct',            url: 'https://www.hellasdirect.gr/asfaleia-katoikias', agent_label: 'Ψηφιακή, χωρίς ασφαλιστή',
    checkedAt: REVIEWED_AT,
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη','Βραχυχρόνια Μίσθωση'],
    note: 'Τα ίδια προγράμματα πουλά και η Magenta Insurance. Η σελίδα της Hellas Direct δεν δημοσιεύει τιμή. Κατά το IPID: απαλλαγή σεισμού 2% του κεφαλαίου και κλοπή περιεχομένου 500€.',
    plans: [
      { id: 'hd_ktirio',  name: 'Κτίριο' },
      { id: 'hd_perieh',  name: 'Περιεχόμενο', kind: 'contents' },
      { id: 'hd_full',    name: 'Κτίριο και Περιεχόμενο' },
      { id: 'hd_full_eq', name: 'Κτίριο και Περιεχόμενο + Σεισμός' },
    ] },
  // Interamerican: IPID «ΙΑ HOME-020525», 12/10/2026. Classic, Extra, Total· το
  // COMFORT δεν υπάρχει. Ο σεισμός είναι προαιρετικός σε όλα. Η αστική ευθύνη
  // του Classic είναι μόνο από πυρκαγιά και γι' αυτό δεν δηλώνεται ως γενική.
  { value: 'interamerican', label: 'Interamerican',             url: 'https://www.interamerican.gr/idiotes/proionta-ypiresies/katoikia', agent_label: 'Ασφαλιστής Interamerican',
    checkedAt: REVIEWED_AT,
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη','Κατοικία με Δάνειο'],
    note: 'Τρία προγράμματα, Classic, Extra και Total (IPID «ΙΑ HOME-020525»). Ο σεισμός είναι προαιρετικός σε όλα, με απαλλαγή 2% ή 4%. Κεφάλαιο κτιρίου από 1.250 έως 2.500€ ανά τ.μ. Τιμές δεν δημοσιεύονται.',
    plans: [
      { id: 'im_classic',  name: 'Classic', covers: [FIRE, FLOOD, WEATHER, 'Δόσεις στεγαστικού δανείου'], optional: [QUAKE], earthquake: false, flood: true, natural: true },
      { id: 'im_extra',    name: 'Extra',   covers: [FIRE, FLOOD, WEATHER, THEFT, WATER, GLASS, 'Δόσεις στεγαστικού δανείου'], optional: [QUAKE], earthquake: false, flood: true, natural: true },
      { id: 'im_total',    name: 'Total',   covers: [FIRE, FLOOD, WEATHER, THEFT, WATER, GLASS, LIABILITY, 'Τυχαίες ζημιές', RENT_LOSS, 'Δόσεις στεγαστικού δανείου'], optional: [QUAKE], earthquake: false, flood: true, natural: true },
      { id: 'im_basic',    name: 'HOME BASIC',   status: 'legacy', covers: ['Πυρκαγιά','Κεραυνός','Καπνός','Φυσικά Φαινόμενα','Αστική Ευθύνη'], earthquake: false, flood: false, natural: false },
      { id: 'im_comfort',  name: 'HOME COMFORT', status: 'legacy', covers: ['Πυρκαγιά','Κλοπή','Φυσικά Φαινόμενα','Πλημμύρα','Αστική Ευθύνη','Δαπάνες Μεταστέγασης'], earthquake: false, flood: true,  natural: true  },
    ] },
  // Anytime: IPID 12/10/2026. Economic, Value, Premium (τα ονόματα ήταν
  // σωστά). Στο Economic ο σεισμός, η πλημμύρα και τα νερά είναι προαιρετικά·
  // το Value προσθέτει κλοπή, το Premium κάθε τυχαίο και απώλεια ενοικίων.
  { value: 'anytime',       label: 'Anytime (Interamerican)',   url: 'https://www.anytime.gr/home/programs-covers', agent_label: 'Online, anytime.gr',
    checkedAt: REVIEWED_AT,
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη','Βραχυχρόνια Μίσθωση'],
    note: 'Ψηφιακό κανάλι της Interamerican, η ίδια εταιρεία. Ο σεισμός είναι προαιρετικός σε όλα τα προγράμματα. Τιμές των κύριων προγραμμάτων δεν δημοσιεύονται· το πρόγραμμα με την Κωτσόβολος ασφαλίζει μόνο περιεχόμενο.',
    plans: [
      { id: 'any_eco',    name: 'Home Economic', covers: [FIRE], optional: [QUAKE, FLOOD, WATER], earthquake: false, flood: false, natural: false },
      { id: 'any_val',    name: 'Home Value',    covers: [FIRE, THEFT], optional: [QUAKE, FLOOD, WATER], earthquake: false, flood: false, natural: false },
      { id: 'any_prem',   name: 'Home Premium',  covers: [FIRE, THEFT, 'Τυχαίες ζημιές', RENT_LOSS], optional: [QUAKE, FLOOD, WATER], earthquake: false, flood: false, natural: false },
      { id: 'any_kots_3k',  name: `Κωτσόβολος, μόνο περιεχόμενο έως ${feWhole(3_000)}`,  kind: 'contents', price: kotsovolosYear(19, 3_000) },
      { id: 'any_kots_10k', name: `Κωτσόβολος, μόνο περιεχόμενο έως ${feWhole(10_000)}`, kind: 'contents', price: kotsovolosYear(39, 10_000) },
    ] },
  // Eurolife FFH: https://www.eurolife.gr/el-GR/proionta/idiotes/katoikia/my-home-first,
  // 12/10/2026. My Home First Standard και Plus· καλύψεις και τιμές ανά πρόγραμμα
  // δεν γράφτηκαν. Το «Ιδιαίτερα ανταγωνιστικά ασφάλιστρα» δεν είχε πηγή.
  { value: 'eurolife',      label: 'Eurolife FFH',              url: 'https://www.eurolife.gr/el-GR/proionta/idiotes/katoikia/my-home-first', agent_label: 'Σύμβουλος Eurolife FFH',
    checkedAt: REVIEWED_AT,
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη'],
    note: 'Μέλος Fairfax Financial. My Home First Standard και Plus. Τιμές ανά πρόγραμμα δεν δημοσιεύονται.',
    plans: [
      { id: 'el_mhf_standard', name: 'My Home First Standard' },
      { id: 'el_mhf_plus',     name: 'My Home First Plus' },
      { id: 'el_ess',     name: 'HomeSecure Essential', status: 'legacy', covers: ['Πυρκαγιά','Θραύση Σωληνώσεων','Φυσικά Φαινόμενα','Αστική Ευθύνη'], earthquake: false, flood: false, natural: false },
      { id: 'el_plus',    name: 'HomeSecure Plus',      status: 'legacy', covers: ['Πυρκαγιά','Κλοπή','Πλημμύρα','Αστική Ευθύνη'], earthquake: false, flood: true,  natural: true  },
      { id: 'el_total',   name: 'HomeSecure Total',     status: 'legacy', covers: ['Πλήρης Κάλυψη + Σεισμός'], earthquake: true,  flood: true,  natural: true  },
    ] },
  // Generali: https://www.generali.gr/el/asfaleia-spitiou/, 12/10/2026. Home On
  // και Home Style· τιμές δεν δημοσιεύονται και η ανάγνωση δεν έγραψε καλύψεις.
  { value: 'generali',      label: 'Generali',                  url: 'https://www.generali.gr/el/asfaleia-spitiou/', agent_label: 'Σύμβουλος Generali',
    checkedAt: REVIEWED_AT,
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη','Κατοικία με Δάνειο'],
    note: 'Home On και Home Style. Έκπτωση 30% στη σεισμική κάλυψη για νέα ασφαλιστήρια διαμερισμάτων με Home On, έως 31/12/2026. Τιμές δεν δημοσιεύονται.',
    plans: [
      { id: 'gen_home_on',    name: 'Home On' },
      { id: 'gen_home_style', name: 'Home Style' },
      { id: 'gen_basic',  name: 'MyHome Basic',   status: 'legacy', covers: ['Πυρκαγιά','Θραύση Σωληνώσεων','Φυσικά Φαινόμενα'], earthquake: false, flood: false, natural: false },
      { id: 'gen_plus',   name: 'MyHome Plus',    status: 'legacy', covers: ['Πυρκαγιά','Κλοπή','Πλημμύρα','Αστική Ευθύνη'], earthquake: false, flood: true,  natural: true  },
      { id: 'gen_prem',   name: 'MyHome Premium', status: 'legacy', covers: ['Πλήρης Κάλυψη + Σεισμός + Κατολίσθηση'], earthquake: true,  flood: true,  natural: true  },
    ] },
  // ΑΧΑ: η σελίδα δεν απάντησε στην ανάγνωση της 12/10/2026 (χρονικό όριο).
  { value: 'axa',           label: 'ΑΧΑ Ασφαλιστική',          url: 'https://www.axa.gr', agent_label: 'Σύμβουλος ΑΧΑ',
    checkedAt: null,
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη'],
    note: 'Η σελίδα της εταιρείας δεν διαβάστηκε στον έλεγχο της 12/10/2026: προγράμματα και καλύψεις μη επαληθευμένα.',
    plans: [
      { id: 'axa_basic',  name: 'Home Protect Basic',   status: 'unverified', covers: ['Πυρκαγιά','Κλοπή','Αστική Ευθύνη'], earthquake: false, flood: false, natural: false },
      { id: 'axa_plus',   name: 'Home Protect Plus',    status: 'unverified', covers: ['Πυρκαγιά','Κλοπή','Πλημμύρα','Αστική Ευθύνη','Φυσικά Φαινόμενα'], earthquake: false, flood: true,  natural: true  },
      { id: 'axa_prem',   name: 'Home Protect Premium', status: 'unverified', covers: ['Πλήρης Κάλυψη + Σεισμός'], earthquake: true,  flood: true,  natural: true  },
    ] },
  // ══ ΤΑ «ΟΙΚΙΑ CLASSIC / EXTRA / PREMIUM» ΔΕΝ ΥΠΗΡΧΑΝ ═════════════════════
  // Πηγή: https://www.ethnikiasfalistiki.gr/home-property, ανάγνωση ομάδας Grok
  // 28/09/2026 (ops.handoffs a41bd5b2, P2-2). Η επίσημη σελίδα έχει τα Full Home
  // Basic, Extra, Advance και Max. Η ΜΟΝΗ δημοσιευμένη τιμή: μόνιμη κατοικία
  // 80 τ.μ., Full Home Advance, ενδεικτικά 15€ τον μήνα, με απαλλαγές, εκπτώσεις
  // συστημάτων ασφαλείας και 15% νέου συμβολαίου. Και η διεύθυνση ήταν λάθος
  // (ethniki-asfalistiki.gr, με παύλα).
  //
  // ΟΙ ΚΑΛΥΨΕΙΣ ΗΤΑΝ ΚΕΝΕΣ ΚΑΙ Η ΟΘΟΝΗ ΕΛΕΓΕ «ΔΕΝ ΚΑΛΥΠΤΕΙ ΠΛΗΜΜΥΡΑ» ΚΑΙ ΓΙΑ ΤΟ
  // ADVANCE, ΠΟΥ ΤΗΝ ΚΑΛΥΠΤΕΙ. Τα IPID διαβάστηκαν 12/10/2026 και οι καλύψεις
  // μπαίνουν από εκεί. Ο σεισμός είναι προαιρετικός σε όλα τα Full Home, με
  // υποχρεωτική απαλλαγή που η σελίδα δεν ποσοτικοποιεί· οι «ζημιές κλέπτη στο
  // κτίριο» του Basic, του Extra και του Advance δεν είναι κλοπή περιεχομένου
  // και η αστική ευθύνη του Basic είναι μόνο από καλυπτόμενο κίνδυνο, οπότε
  // καμία από τις δύο δεν δηλώνεται εκεί. Μπαίνει και το Κατά Παντός Κινδύνου,
  // χωρίς σεισμό και χωρίς αστική ευθύνη κατά το IPID του.
  { value: 'ethniki',       label: 'Εθνική Ασφαλιστική',        url: 'https://www.ethnikiasfalistiki.gr/home-property', agent_label: 'Ασφαλιστής Εθνικής',
    checkedAt: REVIEWED_AT,
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη','Κατοικία με Δάνειο'],
    note: 'Full Home Basic, Extra, Advance και Max, κατά τα IPID. Ο σεισμός είναι προαιρετικός σε όλα, πάντα με απαλλαγή. Όλα καλύπτουν δόσεις δανείου. Δημοσιευμένη τιμή υπάρχει μόνο για το Full Home Advance· για τα υπόλοιπα ζήτησε προσφορά.',
    plans: [
      { id: 'eth_fh_basic',   name: 'Full Home Basic',   covers: [FIRE, 'Κοινόχρηστα', 'Δόσεις δανείου'], optional: [QUAKE], earthquake: false, flood: false, natural: false },
      { id: 'eth_fh_extra',   name: 'Full Home Extra',   covers: [FIRE, LIABILITY, WATER, 'Πρόσκρουση οχήματος', 'Δόσεις δανείου'], optional: [QUAKE], earthquake: false, flood: false, natural: false },
      { id: 'eth_fh_advance', name: 'Full Home Advance', covers: [FIRE, FLOOD, WEATHER, LIABILITY, WATER, GLASS, 'Πτώση δέντρων', 'Τεχνική βοήθεια', 'Δόσεις δανείου'], optional: [QUAKE], earthquake: false, flood: true, natural: true, price: ETHNIKI_ADVANCE_PRICE, baseSqm: 80 },
      { id: 'eth_fh_max',     name: 'Full Home Max',     covers: [FIRE, FLOOD, WEATHER, THEFT, LIABILITY, WATER, GLASS, RENT_LOSS, 'Δόσεις δανείου'], optional: [QUAKE], earthquake: false, flood: true, natural: true },
      { id: 'eth_kpk',        name: 'Κατά Παντός Κινδύνου', covers: [FIRE, FLOOD, WEATHER, THEFT, WATER, GLASS], earthquake: false, flood: true, natural: true },
    ] },
  // Allianz: https://www.allianz.com.gr/el/asfaleia-spitiou, 12/10/2026. Sweet
  // House, Safe Home Πλήρες, Safe Home Exclusive· το «MeinHaus» δεν υπάρχει και
  // η διεύθυνση allianz.gr δεν είναι της ελληνικής εταιρείας.
  { value: 'allianz',       label: 'Allianz Hellas',            url: 'https://www.allianz.com.gr/el/asfaleia-spitiou', agent_label: 'Ασφαλιστής Allianz / Online',
    checkedAt: REVIEWED_AT,
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη'],
    note: 'Sweet House, Safe Home Πλήρες και Safe Home Exclusive. Τιμές δεν δημοσιεύονται.',
    plans: [
      { id: 'al_sweet_house',         name: 'Sweet House' },
      { id: 'al_safe_home_full',      name: 'Safe Home Πλήρες' },
      { id: 'al_safe_home_exclusive', name: 'Safe Home Exclusive' },
      { id: 'al_comp',    name: 'MeinHaus Compact', status: 'legacy', covers: ['Πυρκαγιά','Κλοπή','Αστική Ευθύνη','Θραύση Σωληνώσεων'], earthquake: false, flood: false, natural: false },
      { id: 'al_comf',    name: 'MeinHaus Comfort', status: 'legacy', covers: ['Πυρκαγιά','Κλοπή','Πλημμύρα','Φυσικά Φαινόμενα','Αστική Ευθύνη'], earthquake: false, flood: true,  natural: true  },
      { id: 'al_plus',    name: 'MeinHaus Plus',    status: 'legacy', covers: ['Πλήρης Κάλυψη + Σεισμός'], earthquake: true,  flood: true,  natural: true  },
    ] },
  // ERGO: https://www.ergohellas.gr/residence, 12/10/2026. Έξι προγράμματα. Ο
  // σεισμός είναι προαιρετικός στα τέσσερα πρώτα και περιλαμβάνεται στα Domus.
  // Το «από 12€ τον μήνα» της σελίδας δεν ονομάζει πρόγραμμα, οπότε μένει στην
  // εταιρεία (`fromPrice`) και δεν δίνεται σε κανένα.
  { value: 'ergo',          label: 'ERGO Ασφαλιστική',          url: 'https://www.ergohellas.gr/residence', agent_label: 'Μεσίτης / Online',
    checkedAt: REVIEWED_AT,
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη'],
    note: 'Μέλος Munich Re Group. Ο σεισμός είναι προαιρετικός στα Simple Plus, Advanced Plus, Total Plus και Superior Plus και περιλαμβάνεται στα Domus. Η σελίδα δίνει τιμή «από» χωρίς να ονομάζει πρόγραμμα.',
    fromPrice: {
      amount: 12, unit: 'month', from: true,
      scenario: 'διαμέρισμα 88 τ.μ. στην Αθήνα, κατασκευή 1990, κτίριο 132.000€, με απαλλαγή',
      checkedAt: '2026-10-12', source: 'ergohellas.gr', url: 'https://www.ergohellas.gr/residence',
    },
    plans: [
      { id: 'ergo_simple_plus',   name: 'Simple Plus',   covers: [FIRE], optional: [QUAKE], earthquake: false, flood: false, natural: false },
      { id: 'ergo_advanced_plus', name: 'Advanced Plus', covers: [FIRE, FLOOD, WEATHER], optional: [QUAKE], earthquake: false, flood: true, natural: true },
      { id: 'ergo_total_plus',    name: 'Total Plus',    covers: [FIRE, FLOOD, WEATHER, LIABILITY], optional: [QUAKE], earthquake: false, flood: true, natural: true },
      { id: 'ergo_superior_plus', name: 'Superior Plus', covers: [FIRE, FLOOD, WEATHER, LIABILITY], optional: [QUAKE], earthquake: false, flood: true, natural: true },
      { id: 'ergo_domus',         name: 'Domus',         covers: [FIRE], earthquake: true, flood: false, natural: false },
      { id: 'ergo_domus_plus',    name: 'Domus Plus',    covers: [FIRE, FLOOD, WEATHER, LIABILITY, GLASS], earthquake: true, flood: true, natural: true },
      { id: 'ergo_basic', name: 'Home Basic',   status: 'legacy', covers: ['Πυρκαγιά','Θραύση Σωληνώσεων','Αστική Ευθύνη'], earthquake: false, flood: false, natural: false },
      { id: 'ergo_plus',  name: 'Home Plus',    status: 'legacy', covers: ['Πυρκαγιά','Κλοπή','Πλημμύρα','Αστική Ευθύνη'], earthquake: false, flood: true,  natural: true  },
      { id: 'ergo_prem',  name: 'Home Premium', status: 'legacy', covers: ['Πλήρης Κάλυψη + Σεισμός'], earthquake: true,  flood: true,  natural: true  },
    ] },
  // Groupama: https://www.groupama.gr/el-GR/programmata-asfalishs/idiwtes/katoikia/programmata-maison,
  // 12/10/2026. Maison Eco, Value, Plus· το «myZen» δεν υπάρχει, ούτε ως
  // πρόγραμμα ούτε ως κανάλι, οπότε έφυγε και από την ετικέτα της εταιρείας.
  // Η αντιστοίχιση σαρωμένου συμβολαίου γίνεται με πρόθεμα (lib/insurance/seed.ts),
  // άρα όσα ακίνητα γράφουν ακόμη «Groupama (myZen)» βρίσκουν την εταιρεία.
  { value: 'groupama',      label: 'Groupama',                  url: 'https://www.groupama.gr/el-GR/programmata-asfalishs/idiwtes/katoikia/programmata-maison', agent_label: 'Ασφαλιστής Groupama',
    checkedAt: REVIEWED_AT,
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη'],
    note: 'Γαλλικός ασφαλιστικός όμιλος. Maison Eco, Value και Plus. Τιμές δεν δημοσιεύονται.',
    plans: [
      { id: 'grp_maison_eco',   name: 'Maison Eco' },
      { id: 'grp_maison_value', name: 'Maison Value' },
      { id: 'grp_maison_plus',  name: 'Maison Plus' },
      { id: 'grp_basic',  name: 'myZen Basic',    status: 'legacy', covers: ['Πυρκαγιά','Θραύση Σωληνώσεων','Αστική Ευθύνη'], earthquake: false, flood: false, natural: false },
      { id: 'grp_conf',   name: 'myZen Confort',  status: 'legacy', covers: ['Πυρκαγιά','Κλοπή','Πλημμύρα','Αστική Ευθύνη','Φυσικά Φαινόμενα'], earthquake: false, flood: true,  natural: true  },
      { id: 'grp_allr',   name: 'myZen All Risk', status: 'legacy', covers: ['Κάλυψη Παντός Κινδύνου + Σεισμός'], earthquake: true,  flood: true,  natural: true  },
    ] },
  // Magenta Insurance: https://www.magentainsurance.gr/home, 12/10/2026. Πουλά τα
  // προγράμματα της Hellas Direct και ΔΗΜΟΣΙΕΥΕΙ τις τιμές τους ανά έτος (βλ.
  // `magentaYear`). Το «Βασικό» καλύπτει πυρκαγιά, νερά, φυσικά φαινόμενα,
  // βραχυκύκλωμα, τζάμια και αστική ευθύνη ιδιοκτήτη· η σελίδα σημειώνει το
  // «+ Σεισμός» ως πρόγραμμα που πληροί τον ΕΝΦΙΑ, που απαιτεί και πλημμύρα, άρα
  // η πλημμύρα είναι ήδη μέσα στο Βασικό. Οι καλύψεις του «Πλήρες» δεν
  // γράφτηκαν στην ανάγνωση, οπότε δεν δηλώνονται: το όνομα λέει ότι δεν
  // καταγράφηκαν και τα πλακίδια δεν δανείζονται τις καλύψεις του Βασικού. Το
  // «από 90€/έτος» της σημείωσης έγινε το «από 81€» της σελίδας (60 τ.μ.,
  // κατασκευή 2020, ΤΚ 15124, ενημέρωση 10/2026).
  { value: 'cosmote_ins',   label: 'Magenta Insurance',         url: 'https://www.magentainsurance.gr/home', agent_label: 'Online, Magenta',
    checkedAt: REVIEWED_AT,
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία'],
    note: 'Πρώην COSMOTE Insurance. Πουλά τα προγράμματα της Hellas Direct σε αποκλειστική συνεργασία, οπότε μετρά ως μία εταιρεία μαζί της. Οι τιμές είναι ανά έτος, από τον πίνακα της σελίδας.',
    fromPrice: {
      amount: 81, unit: 'year', from: true,
      scenario: 'κτίριο 60 τ.μ., κατασκευή 2020, ΤΚ 15124',
      checkedAt: '2026-10-12', period: 'Οκτώβριος 2026',
      source: 'magentainsurance.gr', url: 'https://www.magentainsurance.gr/home',
    },
    plans: [
      { id: 'mg_basic_b',  name: 'Βασικό, κτίριο',                         covers: [FIRE, WATER, WEATHER, 'Βραχυκύκλωμα', GLASS, 'Αστική Ευθύνη ιδιοκτήτη'], earthquake: false, flood: true, natural: true, price: magentaYear(47, 'κτίριο') },
      { id: 'mg_basic_bc', name: 'Βασικό, κτίριο και περιεχόμενο',         covers: [FIRE, WATER, WEATHER, 'Βραχυκύκλωμα', GLASS, 'Αστική Ευθύνη ιδιοκτήτη'], earthquake: false, flood: true, natural: true, price: magentaYear(60, 'κτίριο και περιεχόμενο') },
      { id: 'mg_eq_b',     name: 'Βασικό + Σεισμός, κτίριο',               covers: [FIRE, WATER, WEATHER, 'Βραχυκύκλωμα', GLASS, 'Αστική Ευθύνη ιδιοκτήτη'], earthquake: true,  flood: true, natural: true, price: magentaYear(115, 'κτίριο') },
      { id: 'mg_eq_bc',    name: 'Βασικό + Σεισμός, κτίριο και περιεχόμενο', covers: [FIRE, WATER, WEATHER, 'Βραχυκύκλωμα', GLASS, 'Αστική Ευθύνη ιδιοκτήτη'], earthquake: true,  flood: true, natural: true, price: magentaYear(141, 'κτίριο και περιεχόμενο') },
      { id: 'mg_full_b',   name: 'Πλήρες, κτίριο',                         price: magentaYear(146, 'κτίριο') },
      { id: 'mg_full_bc',  name: 'Πλήρες, κτίριο και περιεχόμενο',         price: magentaYear(185, 'κτίριο και περιεχόμενο') },
      { id: 'ci_basic',   name: 'Magenta Home Βασικό',       status: 'legacy', covers: ['Πυρκαγιά','Θραύση Σωληνώσεων','Φυσικά Φαινόμενα','Βραχυκύκλωμα','Αστική Ευθύνη'], earthquake: false, flood: false, natural: false },
      { id: 'ci_plus',    name: 'Magenta Home Πλήρες',       status: 'legacy', covers: ['Πυρκαγιά','Κλοπή','Πλημμύρα','Φυσικά Φαινόμενα','Αστική Ευθύνη'], earthquake: false, flood: true,  natural: true  },
      { id: 'ci_total',   name: 'Magenta Home Ολοκληρωμένο', status: 'legacy', covers: ['Πλήρης Κάλυψη','Σεισμός','Κατολίσθηση','Νομική Προστασία'], earthquake: true,  flood: true,  natural: true  },
    ] },
  // ΟΙ ΕΞΙ ΠΟΥ ΔΕΝ ΕΠΑΛΗΘΕΥΤΗΚΑΝ (12/10/2026): Interlife, MetLife, Ατλαντική
  // Ένωση, Ιντερσαλόνικα, AIG και η ΑΧΑ πιο πάνω. Οι σελίδες τους δεν
  // διαβάστηκαν, οπότε τα ποσά τους φεύγουν και τα ονόματα μένουν με τη
  // σήμανση. Για τη MetLife και την AIG εκκρεμεί έλεγχος στο μητρώο της ΤτΕ για
  // το αν διαθέτουν καν ασφάλιση κατοικίας στην Ελλάδα.
  { value: 'interlife',     label: 'Interlife',                 url: 'https://www.interlife.gr', agent_label: 'Ασφαλιστής / Online',
    checkedAt: null,
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη'],
    note: 'Η σελίδα της εταιρείας δεν διαβάστηκε στον έλεγχο της 12/10/2026: προγράμματα και καλύψεις μη επαληθευμένα.',
    plans: [
      { id: 'il_basic',   name: 'Κατοικία Basic',   status: 'unverified', covers: ['Πυρκαγιά','Κλοπή','Αστική Ευθύνη'], earthquake: false, flood: false, natural: false },
      { id: 'il_plus',    name: 'Κατοικία Plus',    status: 'unverified', covers: ['Πυρκαγιά','Κλοπή','Πλημμύρα','Αστική Ευθύνη'], earthquake: false, flood: true,  natural: true  },
      { id: 'il_prem',    name: 'Κατοικία Premium', status: 'unverified', covers: ['Πλήρης Κάλυψη + Σεισμός'], earthquake: true,  flood: true,  natural: true  },
    ] },
  { value: 'metlife',       label: 'MetLife',                   url: 'https://www.metlife.gr', agent_label: 'Ασφαλιστής MetLife',
    checkedAt: null,
    propertyTypes: ['Κύρια Κατοικία','Ενοικιαζόμενη','Κατοικία με Δάνειο'],
    note: 'Η σελίδα της εταιρείας δεν διαβάστηκε στον έλεγχο της 12/10/2026: προγράμματα και καλύψεις μη επαληθευμένα.',
    plans: [
      { id: 'ml_prot',    name: 'Home Protection', status: 'unverified', covers: ['Πυρκαγιά','Κλοπή','Αστική Ευθύνη'], earthquake: false, flood: false, natural: false },
      { id: 'ml_comf',    name: 'Home Comfort',    status: 'unverified', covers: ['Πλήρης Κάλυψη + Σεισμός'], earthquake: true,  flood: true,  natural: true  },
    ] },
  { value: 'atlantiki',     label: 'Ατλαντική Ένωση',           url: 'https://www.atlantiki.gr', agent_label: 'Ασφαλιστής',
    checkedAt: null,
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη'],
    note: 'Η σελίδα της εταιρείας δεν διαβάστηκε στον έλεγχο της 12/10/2026: προγράμματα και καλύψεις μη επαληθευμένα.',
    plans: [
      { id: 'at_class',   name: 'Ακίνητο Classic', status: 'unverified', covers: ['Πυρκαγιά','Κλοπή','Αστική Ευθύνη'], earthquake: false, flood: false, natural: false },
      { id: 'at_extra',   name: 'Ακίνητο Extra',   status: 'unverified', covers: ['Πυρκαγιά','Κλοπή','Πλημμύρα','Αστική Ευθύνη'], earthquake: false, flood: true,  natural: true  },
      { id: 'at_prem',    name: 'Ακίνητο Premium', status: 'unverified', covers: ['Πλήρης Κάλυψη + Σεισμός'], earthquake: true,  flood: true,  natural: true  },
    ] },
  { value: 'intesaloniki',  label: 'Ιντερσαλόνικα',             url: 'https://www.intersalonica.gr', agent_label: 'Ασφαλιστής',
    checkedAt: null,
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία'],
    note: 'Η σελίδα της εταιρείας δεν διαβάστηκε στον έλεγχο της 12/10/2026: προγράμματα και καλύψεις μη επαληθευμένα.',
    plans: [
      { id: 'is_vasi',    name: 'Κατοικία Βασική', status: 'unverified', covers: ['Πυρκαγιά','Κλοπή','Αστική Ευθύνη'], earthquake: false, flood: false, natural: false },
      { id: 'is_plir',    name: 'Κατοικία Πλήρης', status: 'unverified', covers: ['Πυρκαγιά','Κλοπή','Πλημμύρα','Αστική Ευθύνη','Φυσικά Φαινόμενα'], earthquake: false, flood: true,  natural: true  },
    ] },
  { value: 'aig',           label: 'AIG (American International)', url: 'https://www.aig.com.gr', agent_label: 'Ασφαλιστής',
    checkedAt: null,
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Κατοικία με Δάνειο'],
    note: 'Η σελίδα της εταιρείας δεν διαβάστηκε στον έλεγχο της 12/10/2026: προγράμματα και καλύψεις μη επαληθευμένα.',
    plans: [
      { id: 'aig_allr',   name: 'Home All Risk',      status: 'unverified', covers: ['Κάλυψη Παντός Κινδύνου','Αστική Ευθύνη'], earthquake: false, flood: true,  natural: true  },
      { id: 'aig_plus',   name: 'Home All Risk Plus', status: 'unverified', covers: ['Κάλυψη Παντός Κινδύνου + Σεισμός + Κατολίσθηση'], earthquake: true,  flood: true,  natural: true  },
    ] },
  { value: 'other',         label: 'Άλλη Ασφαλιστική',          url: '', agent_label: 'Ασφαλιστής',
    checkedAt: null,
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη'],
    note: '',
    plans: [{ id: 'other_custom', name: 'Προσαρμοσμένο', covers: [], earthquake: false, flood: false, natural: false }] },
];

/** Το πρόγραμμα όπως το διαβάζουν η οθόνη και η σύγκριση. */
function toPlan(p: SourcePlan): CatalogPlan {
  const covers = p.covers ?? [];
  const coversRecorded = p.covers !== undefined;
  const kind = p.kind ?? 'home';
  const note = p.status ? STATUS_NOTE[p.status] : coversRecorded ? '' : COVERS_NOTE;
  return {
    ...p,
    name: note ? `${p.name} (${note})` : p.name,
    productName: p.name,
    kind,
    covers,
    coversRecorded,
    monthly: p.price?.unit === 'month' ? p.price.amount : 0,
    priceFact: p.price ? priceFactOf(p.price) : undefined,
    enfiaRisks: !p.status && kind === 'home' && coversRecorded && !!p.earthquake && !!p.flood && coversFire(covers),
  };
}

export const INSURANCE_COMPANIES: InsuranceCompany[] = CATALOG.map(c => ({
  ...c,
  plans: c.plans.map(toPlan),
  fromFact: c.fromPrice ? priceFactOf(c.fromPrice, ' Η σελίδα δεν ονομάζει πρόγραμμα.') : undefined,
}));

/**
 * ΠΟΣΕΣ ΑΣΦΑΛΙΣΤΙΚΕΣ ΓΡΑΦΟΥΝ Η ΑΡΧΙΚΗ ΚΑΙ ΤΑ REELS: όσες η σελίδα τους
 * διαβάστηκε (`checkedAt`), με τη μάρκα στη μητρική της (`countInsurers`).
 *
 * Η αρχική έγραφε «16 ασφαλιστικές · … σύγκριση ανά κάλυψη» και τα reels το
 * ίδιο, μετρώντας κάθε εταιρεία του καταλόγου με διεύθυνση. Έξι από αυτές (ΑΧΑ,
 * Interlife, MetLife, Ατλαντική Ένωση, Ιντερσαλόνικα, AIG) δεν διαβάστηκαν στην
 * ανάγνωση της 12/10/2026: κανένα πρόγραμμά τους δεν προσφέρεται στον επιλογέα
 * (`pickablePlans`), οι καλύψεις τους δεν έχουν πηγή και για τη MetLife και την
 * AIG δεν είναι καν γνωστό αν πουλούν ασφάλιση κατοικίας στην Ελλάδα. Μένουν
 * στο μενού για όποιον είναι ήδη πελάτης τους, όχι στο πλήθος. Ο
 * scripts/guard-landing-stats.mjs μετρά με τον ίδιο κανόνα και το
 * catalog.test.ts ελέγχει ότι κάθε μετρημένη έχει πρόγραμμα να διαλέξεις.
 */
export const READ_INSURERS = countInsurers(INSURANCE_COMPANIES.filter(c => c.checkedAt !== null));

// ═══ ΤΙ ΔΕΙΧΝΕΙ Η ΟΘΟΝΗ ΓΙΑ ΤΟ ΠΡΟΓΡΑΜΜΑ ΣΟΥ ═══════════════════════════════
// Καθαροί κανόνες για το BillsInsurance.tsx, εδώ για να ελέγχονται χωρίς οθόνη
// (catalog.test.ts). Ο λόγος του καθενός είναι γραμμένος δίπλα του στην οθόνη.

/** Το «Προσαρμοσμένο» της «Άλλη Ασφαλιστική»: τιμή και καλύψεις τα γράφει ο χρήστης. */
const CUSTOM_PLAN = 'other_custom';

/** Πρόγραμμα μόνο περιεχομένου, με λέξεις: το λέει η γραμμή κάτω από τον επιλογέα. */
export const CONTENTS_ONLY_NOTE = 'Μόνο περιεχόμενο: το κτίριο δεν ασφαλίζεται με αυτό το πρόγραμμα.';

/**
 * Η επιλογή του μενού «Πρόγραμμα ασφάλισης»: το όνομα, «μόνο περιεχόμενο» όπου
 * το όνομα δεν το λέει ήδη και η τιμή στη μονάδα της εταιρείας. Χωρίς
 * δημοσιευμένη τιμή, «τιμή μόνο με προσφορά». Πρόγραμμα με `status` δεν παίρνει
 * τίποτα από τα δύο: η σήμανση στο όνομα λέει ήδη ότι δεν είναι προϊόν προς
 * πώληση.
 */
export function planOptionLabel(p: CatalogPlan): string {
  if (p.id === CUSTOM_PLAN) return p.name;
  const parts = [p.name];
  if (p.kind === 'contents' && !/μόνο περιεχόμενο/i.test(p.productName)) parts.push('μόνο περιεχόμενο');
  if (!p.status) parts.push(p.price ? priceAmount(p.price) : 'τιμή μόνο με προσφορά');
  return parts.join(' · ');
}

/**
 * Τα προγράμματα του επιλογέα: όσα υπάρχουν και διαβάστηκαν. Πρόγραμμα με
 * `status` (`legacy`, `unverified`) εμφανίζεται ΜΟΝΟ όταν είναι αυτό που έχει
 * ήδη αποθηκευμένο ο χρήστης, ώστε να μη χαθεί η επιλογή του· δεν προσφέρεται
 * σε κανέναν ως νέα.
 */
export function pickablePlans(company: InsuranceCompany | undefined, storedPlanId: string): CatalogPlan[] {
  return (company?.plans ?? []).filter(p => !p.status || p.id === storedPlanId);
}

/**
 * Τι αλλάζει όταν διαλέγεις εταιρεία: η εταιρεία, το πρώτο πρόγραμμα του
 * επιλογέα (ποτέ πρόγραμμα με σήμανση· εταιρεία χωρίς κανένα μένει χωρίς) και
 * οι δικές σου καλύψεις σβήνουν. Η ίδια εταιρεία ξανά δεν αλλάζει τίποτα (`null`).
 *
 * Η ΙΔΙΑ ΕΤΑΙΡΕΙΑ ΞΑΝΑ ΕΣΒΗΝΕ ΠΡΟΓΡΑΜΜΑ ΚΑΙ ΚΑΛΥΨΕΙΣ. Ο επιλογέας καλεί το
 * `onChange` και για την επιλογή που ήδη ισχύει (το Enter στη λίστα διαλέγει
 * την τρέχουσα) και η οθόνη γύριζε τότε το πρόγραμμα στο πρώτο της εταιρείας
 * και έσβηνε τις καλύψεις που είχες πατήσει. Με τον επιλογέα που κρατά το
 * αποθηκευμένο πρόγραμμα με σήμανση μόνο για όποιον το έχει (`pickablePlans`),
 * το ίδιο πάτημα θα το έσβηνε για πάντα.
 */
export function companyChange(current: string, next: string): { insProvider: string; insEditCovers: false; insPlanId: string } | null {
  if (next === current) return null;
  return {
    insProvider: next, insEditCovers: false,
    insPlanId: pickablePlans(INSURANCE_COMPANIES.find(c => c.value === next), '')[0]?.id ?? '',
  };
}

/**
 * Από πού έρχονται τα πλακίδια των καλύψεων. Μόνο με `own` (τα πάτησε ο
 * χρήστης) ή `catalog` (καταγεγραμμένες καλύψεις προγράμματος χωρίς `status`)
 * το «Όχι» είναι γεγονός και η οθόνη γράφει «δεν καλύπτει».
 */
export type CoverBasis = 'own' | 'catalog' | 'unrecorded' | 'unsourced' | 'none';

export function coverBasis(plan: CatalogPlan | undefined, edited: boolean): CoverBasis {
  if (edited) return 'own';
  if (!plan) return 'none';
  if (plan.status) return 'unsourced';
  if (!plan.coversRecorded || plan.id === CUSTOM_PLAN) return 'unrecorded';
  return 'catalog';
}

/** Η γραμμή κάτω από τα πλακίδια, όταν δεν είναι γεγονός. */
export const COVER_BASIS_NOTE: Partial<Record<CoverBasis, string>> = {
  none: 'Χωρίς πρόγραμμα του καταλόγου οι καλύψεις δεν είναι γνωστές. Πάτησε όσες γράφει το συμβόλαιό σου.',
  unrecorded: 'Οι καλύψεις αυτού του προγράμματος δεν καταγράφηκαν, οπότε το «Όχι» δεν σημαίνει ότι λείπουν. Πάτησε όσες γράφει το συμβόλαιό σου.',
  unsourced: 'Οι καλύψεις αυτού του προγράμματος δεν έχουν πηγή από την εταιρεία. Πάτησε όσες γράφει το συμβόλαιό σου.',
};

/**
 * Η ειδοποίηση για σεισμό και πλημμύρα πάνω από την Ασφάλεια, ή `null`.
 * Βγαίνει μόνο όταν το «Όχι» είναι γεγονός (`coverBasis` `own` ή `catalog`).
 *
 * Ο ΠΡΟΑΙΡΕΤΙΚΟΣ ΣΕΙΣΜΟΣ ΔΙΑΒΑΖΟΤΑΝ «ΔΕΝ ΚΑΛΥΠΤΕΙ». Η ειδοποίηση έγραφε «Το
 * πρόγραμμά σου δεν καλύπτει σεισμό» για κάθε πρόγραμμα χωρίς τη σημαία, μαζί
 * και για τα Full Home της Εθνικής και τα Home Economic και Home Value της
 * Anytime, όπου κατά τα IPID της 12/10/2026 ο σεισμός μπαίνει με επιπλέον
 * ασφάλιστρο (`optional`, στο Anytime και η πλημμύρα). Το διάβαζε και όποιος
 * τον είχε πληρώσει. Ο κατάλογος δεν ξέρει αν τον πρόσθεσες· η ειδοποίηση το
 * λέει όπως το γράφει το IPID και δείχνει το πλακίδιο που το διορθώνει.
 */
export function coverWarning(plan: CatalogPlan | undefined, basis: CoverBasis, earthquake: boolean, flood: boolean): string | null {
  if (basis !== 'own' && basis !== 'catalog') return null;
  const optional = basis === 'catalog' && plan ? plan.optional ?? [] : [];
  const missing = [
    { has: earthquake, tile: QUAKE, notCovered: 'σεισμό',   added: 'ο σεισμός',  it: 'τον' },
    { has: flood,      tile: FLOOD, notCovered: 'πλημμύρα', added: 'η πλημμύρα', it: 'την' },
  ].filter(x => !x.has);
  const absent = missing.filter(x => !optional.includes(x.tile));
  const extra  = missing.filter(x => optional.includes(x.tile));
  const out: string[] = [];
  if (absent.length) {
    out.push(`Το πρόγραμμά σου δεν καλύπτει ${absent.map(x => x.notCovered).join(' ούτε ')}. Σκέψου αναβάθμιση της κάλυψης.`);
  }
  if (plan && extra.length === 1) {
    const [x] = extra;
    out.push(`Στο ${plan.productName} ${x.added} μπαίνει μόνο με επιπλέον ασφάλιστρο. Αν ${x.it} πρόσθεσες, πάτησε «${x.tile}» στις καλύψεις.`);
  } else if (plan && extra.length > 1) {
    out.push(`Στο ${plan.productName} ${extra.map(x => x.added).join(' και ')} μπαίνουν μόνο με επιπλέον ασφάλιστρο. Αν πρόσθεσες κάποιον από τους δύο, πάτησε «${QUAKE}» ή «${FLOOD}» στις καλύψεις.`);
  }
  return out.length ? out.join(' ') : null;
}

/** Οι τρεις κίνδυνοι της μείωσης ΕΝΦΙΑ, με τα ονόματα των πλακιδίων (ίδιοι με το ENFIA_INSURANCE_PERILS του EnfiaPanel.tsx). */
const ENFIA_PERILS = ['Σεισμός', 'Πυρκαγιά', 'Πλημμύρα'];

/** Οι καλύψεις που πέρασε ο ίδιος ο χρήστης (`insEditCovers`). */
interface OwnCovers { covers: string[]; earthquake: boolean; flood: boolean; natural: boolean }

/**
 * Ανάβει η γραμμή της μείωσης ΕΝΦΙΑ στην Ασφάλεια; Πρόγραμμα του καταλόγου:
 * μόνο με `enfiaRisks`. Καλύψεις του χρήστη: σεισμός, πυρκαγιά και πλημμύρα
 * μαζί στα πλακίδια. Πρόγραμμα μόνο περιεχομένου ποτέ. Ο ίδιος κανόνας
 * με το `insuranceCoversEnfiaPerils` του EnfiaPanel.tsx και το catalog.test.ts
 * ελέγχει ότι συμφωνούν.
 */
export function showsEnfiaPerils(plan: CatalogPlan | undefined, own: OwnCovers | null): boolean {
  if (plan?.kind === 'contents') return false;
  if (!own) return !!plan?.enfiaRisks;
  const shown = deriveCoverages(own.covers, own.earthquake, own.flood, own.natural);
  return ENFIA_PERILS.every(label => shown.find(c => c.label === label)?.ok === true);
}

/**
 * Τι πληρώνεις τον μήνα για την ασφάλεια: ό,τι έγραψες, αλλιώς η δημοσιευμένη
 * ΜΗΝΙΑΙΑ τιμή του προγράμματος. Ετήσια τιμή δεν διαιρείται με το δώδεκα: χωρίς
 * δικό σου ποσό το αποτέλεσμα είναι 0, δηλαδή «άγνωστο», όχι «δωρεάν».
 */
export const insuranceMonthly = (customPrice: string, plan: CatalogPlan | undefined): number =>
  parseFloat(customPrice) || plan?.monthly || 0;

/** Η γραμμή του «Σύνολο ανά μήνα» όταν η ασφάλεια υπάρχει αλλά δεν έχει ποσό. */
export const insuranceTotalNote = (chosen: boolean, monthly: number): string | null =>
  chosen && !(monthly > 0) ? 'Η ασφάλεια δεν μετρά: δεν έχει γραμμένο κόστος τον μήνα.' : null;


export interface OtherSub       { name: string; price: string; renewalDate: string; }

// ─── Ασφαλιστικό Comparison Engine ─────────────────────────────────────────────
// Προσομοιώνει προσφορές ασφάλισης από τα στοιχεία του ακινήτου
// Όταν ανοίξει το API του insurancemarket.gr, το computeQuotes() αντικαθίσταται με πραγματική κλήση
/** Τα τέσσερα φίλτρα προσφορών, δηλωμένα μία φορά και ως τύπος. */
export const QUOTE_FILTERS = [
  { key: 'all',        label: 'Όλα'                 },
  { key: 'earthquake', label: 'Σεισμός'             },
  { key: 'flood',      label: 'Πλημμύρα'            },
  { key: 'natural',    label: 'Φυσικές καταστροφές' },
] as const;
export type QuoteFilter = typeof QUOTE_FILTERS[number]['key'];

export interface LiveQuote {
  company: string;
  companyLabel: string;
  plan: string;
  planLabel: string;
  monthlyEstimate: number;
  annualEstimate: number;
  earthquake: boolean;
  flood: boolean;
  natural: boolean;
  covers: string[];
  url: string;
  confidence: 'live' | 'estimated';
  savings?: number; // vs current plan
  /** Η δημόσια πηγή της τιμής βάσης (βλ. `CatalogPlan.priceFact`). Κάθε εκτίμηση την έχει. */
  priceFact?: AsOf;
}

/**
 * Το ΕΝΔΕΙΚΤΙΚΟ κόστος κάθε προγράμματος για το ακίνητο, ΧΩΡΙΣ την πύλη της
 * σύγκρισης (βλ. `computeLiveQuotes`).
 *
 * ΤΙ ΕΙΝΑΙ ΚΑΙ ΤΙ ΔΕΝ ΕΙΝΑΙ: είναι μοντέλο τιμής πάνω στις δημοσιευμένες τιμές
 * εκκίνησης των εταιρειών. ΔΕΝ είναι προσφορά. Πραγματική τιμή ασφάλισης
 * κατοικίας δεν υπάρχει δημοσιευμένη: παράγεται από τα στοιχεία του
 * συγκεκριμένου ακινήτου και προσώπου και τη δίνει μόνο η ασφαλιστική. Γι'
 * αυτό κάθε ποσό εδώ φέρει `confidence: 'estimated'` και η οθόνη στέλνει τον
 * χρήστη στην πηγή για την πραγματική προσφορά.
 *
 * ΜΟΝΟ ΜΕ ΔΗΜΟΣΙΕΥΜΕΝΗ ΜΗΝΙΑΙΑ ΤΙΜΗ ΚΑΙ ΜΟΝΟ ΚΑΤΟΙΚΙΑ (12/10/2026). Πρόγραμμα
 * χωρίς `price` δεν μπαίνει ποτέ: δεν έχει τιμή μηδέν, έχει τιμή μόνο με
 * προσφορά και ως μηδέν θα έβγαινε το φθηνότερο. Ετήσια τιμή δεν μπαίνει
 * επίσης, γιατί η οθόνη δείχνει «εκτίμηση / μήνα» και η διαίρεση με το δώδεκα
 * θα ήταν δικό μας ποσό. Το «μόνο περιεχόμενο» δεν συγκρίνεται με κτίριο.
 *
 * ΠΡΟΣΟΧΗ ΣΤΟ ΤΙ ΚΑΝΕΙ Ο ΣΥΝΤΕΛΕΣΤΗΣ: ανεβοκατεβάζει ΟΛΑ τα προγράμματα μαζί,
 * άρα ΔΕΝ αλλάζει σειρά (εκτός από πρόγραμμα με δική του βάση τ.μ., `baseSqm`,
 * που κλιμακώνεται από εκείνη). Η σειρά βγαίνει από τη μηχανή αναγκών
 * (lib/insurance/match.ts) και όχι από εδώ. Παλιά δεν υπήρχε τέτοια μηχανή και
 * η «εξατομικευμένη σύγκριση» έβγαζε ακριβώς την ίδια κατάταξη για κάθε ακίνητο.
 */
export function pricedQuotes(sqm: number, propValue: number, contentValue: number, floor: string, age: string): LiveQuote[] {
  if (!sqm || !propValue) return [];

  // Συντελεστές τιμολόγησης από τα χαρακτηριστικά του ακινήτου
  //
  // ΤΟ 15€ ΤΗΣ ΕΘΝΙΚΗΣ ΒΓΑΙΝΕ 12€ ΓΙΑ ΤΑ ΙΔΙΑ ΤΑ 80 Τ.Μ. ΤΗΣ ΠΗΓΗΣ. Η κλίμακα
  // διαιρούσε κάθε ακίνητο με 100 τ.μ., σαν να ήταν όλες οι τιμές βάσης για
  // 100 τ.μ.· η μόνη δημοσιευμένη (https://www.ethnikiasfalistiki.gr/home-property,
  // 12/10/2026) είναι για 80. Με την πηγή γραμμένη πλέον δίπλα στη γραμμή, η
  // οθόνη θα έδειχνε άλλο ποσό από αυτό που διαβάζει ο χρήστης στη σελίδα. Όποιο
  // πρόγραμμα δηλώνει `baseSqm` κλιμακώνεται από εκεί, τα υπόλοιπα από τα 100.
  const SQM_REFERENCE = 100;
  const sqmFactor    = (ref: number) => Math.max(0.7, Math.min(1.5, sqm / ref));
  const valueFactor  = Math.max(0.8, Math.min(2.0, propValue / 150000));
  // ΣΗΜΕΙΟ ΑΝΑΦΟΡΑΣ, ΟΧΙ ΔΗΛΩΜΕΝΗ ΑΞΙΑ. Το 20.000€ είναι ο παρονομαστής της
  // κλίμακας, όχι οικοσκευή που ισχυριζόμαστε ότι έχει ο χρήστης. Ήταν γραμμένο
  // `(contentValue || 20000) / 20000`, που δίνει ακριβώς 1 όταν λείπει η τιμή —
  // σωστό αριθμητικά, αλλά διαβαζόταν σαν να υποθέτουμε οικοσκευή 20.000€.
  // Χωρίς δηλωμένη αξία δεν προσαρμόζουμε καθόλου: συντελεστής 1.
  const CONTENT_REFERENCE = 20000;
  const contentF     = contentValue > 0 ? Math.max(0.9, Math.min(1.4, contentValue / CONTENT_REFERENCE)) : 1;
  const floorRisk    = floor === 'ground' ? 1.15 : floor === 'basement' ? 1.25 : 1.0;
  const ageRisk      = AGE_RISK[normalizeEnfiaAgeKey(age)] ?? 1.0;
  // Η σεισμική ζώνη ΔΕΝ βγαίνει από το όνομα της πόλης. Ο παλιός κώδικας έψαχνε
  // αν το κείμενο περιείχε «Αθήν» και πρόσθετε 5%. Η ζώνη ορίζεται από χάρτη
  // κανονισμού, όχι από αλφαριθμητικά και η Αθήνα δεν είναι καν η πιο
  // επιβαρυμένη περιοχή. Αφαιρέθηκε αντί να αντικατασταθεί με άλλη μαντεψιά.
  const restFactor   = valueFactor * contentF * floorRisk * ageRisk;

  return INSURANCE_COMPANIES
    .filter(c => c.value !== 'other')
    .flatMap(c => c.plans
      .filter(p => p.kind === 'home' && !p.status && p.price?.unit === 'month')
      .map(p => {
      const estimate = p.price!.amount * sqmFactor(p.baseSqm ?? SQM_REFERENCE) * restFactor;
      // ΤΟ ΕΤΗΣΙΟ ΕΙΝΑΙ ΤΟ ΜΗΝΙΑΙΟ ΕΠΙ ΔΩΔΕΚΑ ΜΟΝΟ ΕΠΕΙΔΗ Η ΣΤΗΛΗ ΤΟΥ ΠΙΝΑΚΑ ΤΟ
      // ΖΗΤΑ. Παλιά κάθε πρόγραμμα έφερνε και «εκπτωτικό» ετήσιο (η Hellas Direct
      // 8,50 τον μήνα αλλά 85 τον χρόνο), που δεν το δημοσίευε καμία εταιρεία
      // και έφυγε μαζί με τα υπόλοιπα ποσά χωρίς πηγή (12/10/2026).
      return {
        company:       c.value,
        companyLabel:  c.label,
        plan:          p.id,
        planLabel:     p.name,
        monthlyEstimate: roundHalfUp(estimate, 2),
        annualEstimate:  roundHalfUp(estimate * 12, 2),
        earthquake:    !!p.earthquake,
        flood:         !!p.flood,
        natural:       !!p.natural,
        covers:        p.covers,
        url:           c.url,
        confidence:    'estimated' as const,
        priceFact:     p.priceFact,
      };
    }));
  // Καμία ταξινόμηση εδώ. Τη σειρά την ορίζει η καταλληλότητα, όχι η τιμή.
}

/**
 * ΣΥΓΚΡΙΣΗ ΜΕ ΜΙΑ ΕΤΑΙΡΕΙΑ ΔΕΝ ΕΙΝΑΙ ΣΥΓΚΡΙΣΗ (12/10/2026). Όταν έφυγαν τα ποσά
 * χωρίς πηγή, δημοσιευμένη μηνιαία τιμή κατοικίας έμεινε μόνο στην Εθνική. Η
 * οθόνη θα τη σήκωνε «ΠΡΟΤΕΙΝΟΜΕΝΟ ΓΙΑ ΕΣΕΝΑ» με την αιτιολογία «Είναι και το
 * φθηνότερο από όσα τα καλύπτουν» και η ειδοποίηση εξόδων θα έστελνε κάθε
 * ιδιοκτήτη σε μία εταιρεία, μόνο επειδή είναι η μόνη που δημοσιεύει ποσό.
 * Κάτω από δύο επιχειρήσεις (`distinctInsurers`, η Magenta μετρά ως Hellas
 * Direct) δεν επιστρέφεται τίποτα.
 */
const MIN_INSURERS_TO_COMPARE = 2;

export function computeLiveQuotes(sqm: number, propValue: number, contentValue: number, floor: string, age: string): LiveQuote[] {
  const quotes = pricedQuotes(sqm, propValue, contentValue, floor, age);
  return distinctInsurers(quotes.map(q => q.company)) >= MIN_INSURERS_TO_COMPARE ? quotes : [];
}

// ═══════════════════════════════════════════════════════════════════════════
// Η ΣΥΓΚΡΙΣΗ ΑΣΦΑΛΕΙΩΝ ΩΣ ΕΙΔΟΠΟΙΗΣΗ, ΟΧΙ ΩΣ ΚΑΡΤΕΛΑ.
//
// Επιστρέφει κάτι ΜΟΝΟ όταν και τα τρία ισχύουν:
//   1. ξέρουμε τι πληρώνει σήμερα (το έχει γράψει ο ίδιος),
//   2. ξέρουμε τετραγωνικά και αξία, ώστε το μοντέλο τιμής να έχει πάνω σε τι
//      να πατήσει (χωρίς αυτά το computeLiveQuotes επιστρέφει κενό),
//   3. υπάρχει πρόγραμμα με ΤΟΥΛΑΧΙΣΤΟΝ τις ίδιες καλύψεις και χαμηλότερη τιμή.
//
// Το (3) είναι το κρίσιμο: μια φθηνότερη ασφάλεια χωρίς σεισμό, σε κάποιον που
// έχει σεισμό, δεν είναι εξοικονόμηση — είναι λιγότερη ασφάλεια στην ίδια τιμή
// ανά κάλυψη. Η παλιά καρτέλα κατέτασσε κατά τιμή και άφηνε τον χρήστη να το
// προσέξει μόνος του.
// ═══════════════════════════════════════════════════════════════════════════

const INS_SWITCH_NOISE = 3;   // €/μήνα — κάτω από αυτό δεν διακόπτουμε κανέναν

export interface InsuranceSwitchFinding {
  current: number;
  best: number;
  savingsMonthly: number;
  bestLabel: string;
  basedOn: string;
}

export function insuranceSwitchFinding(
  s: Record<string, unknown> | null | undefined,
): InsuranceSwitchFinding | null {
  if (!s) return null;
  const company = INSURANCE_COMPANIES.find(c => c.value === s.insProvider);
  const plan = (company?.plans ?? []).find(p => p.id === s.insPlanId);

  // ΤΟ «ΤΙ ΠΛΗΡΩΝΕΙΣ» ΔΕΝ ΒΓΑΙΝΕΙ ΑΠΟ ΤΟΝ ΚΑΤΑΛΟΓΟ ΧΩΡΙΣ ΠΗΓΗ. Ό,τι έγραψε ο
  // ίδιος, αλλιώς η δημοσιευμένη μηνιαία τιμή του προγράμματος. Πρόγραμμα χωρίς
  // τιμή δεν «κοστίζει 0»: χωρίς ποσό από τον χρήστη δεν υπάρχει εύρημα.
  const listed = plan?.price?.unit === 'month' ? plan.price.amount : 0;
  const current = parseFloat(String(s.insCustomPrice ?? '')) || listed;
  if (!(current > 0)) return null;

  const sqm = parseFloat(String(s.insSqm ?? '')) || 0;
  const propValue = parseFloat(String(s.insPropValue ?? '')) || 0;
  const contentValue = parseFloat(String(s.insContentValue ?? '')) || 0;
  if (!sqm || !propValue) return null;

  // Οι καλύψεις που ΕΧΕΙ σήμερα: ό,τι δηλώθηκε χειροκίνητα ή ό,τι φέρνει το πρόγραμμα.
  const needEq = Boolean(s.insCustomEarthquake) || Boolean(plan?.earthquake);
  const needFl = Boolean(s.insCustomFlood) || Boolean(plan?.flood);
  const needNa = Boolean(s.insCustomNatural) || Boolean(plan?.natural);

  const cheaper = computeLiveQuotes(
    sqm, propValue, contentValue,
    String(s.insFloor ?? 'second'), String(s.insAge ?? 'y10_14'),
  )
    .filter(q => q.plan !== s.insPlanId)
    .filter(q => (!needEq || q.earthquake) && (!needFl || q.flood) && (!needNa || q.natural))
    .sort((a, b) => a.monthlyEstimate - b.monthlyEstimate)[0];

  if (!cheaper) return null;
  const savings = current - cheaper.monthlyEstimate;
  if (!(savings >= INS_SWITCH_NOISE)) return null;

  // Η ΕΙΔΟΠΟΙΗΣΗ ΔΕΝ ΕΛΕΓΕ ΟΤΙ Η ΦΘΗΝΟΤΕΡΗ ΤΙΜΗ ΔΕΝ ΕΠΑΛΗΘΕΥΕΤΑΙ. Είναι η πιο
  // πιεστική οθόνη της ασφάλειας («πληρώνεις … με … διαφορά») και στεκόταν σε
  // ποσό που, κατά τον χάρτη αγοράς της 12/10/2026, καμία ασφαλιστική εκτός
  // της Εθνικής (https://www.ethnikiasfalistiki.gr/home-property) δεν
  // δημοσιεύει. Το «Βάσει:» το γράφει τώρα.
  const priceBasis = cheaper.priceFact
    ? `τιμή βάσης από ${cheaper.priceFact.source}, ${asOfDate(cheaper.priceFact.checkedAt)}`
    : 'ενδεικτική τιμή καταλόγου που δεν επαληθεύεται δημόσια';
  return {
    current, best: cheaper.monthlyEstimate, savingsMonthly: savings,
    bestLabel: `${cheaper.companyLabel} ${cheaper.planLabel}`,
    basedOn: `${sqm} τ.μ., ίδιες ή καλύτερες καλύψεις· ${priceBasis}· εκτίμηση, όχι προσφορά`,
  };
}

// ΑΦΑΙΡΕΘΗΚΕ: «Σύνδεση με TAXISnet».
//
// Υπήρχε εδώ ένα πλαίσιο που υποσχόταν «αυτόματη λήψη ΕΝΦΙΑ εκκαθαριστικού» και
// ένα κουμπί «Σύνδεση με TAXISnet →». Τίποτα από τα δύο δεν ίσχυε:
//
//   • Το `aadeConnected` ξεκινούσε false και η ΜΟΝΗ γραμμή που το άγγιζε ήταν
//     `setAadeConnected(false)`. Δεν μπορούσε ποτέ να γίνει true.
//   • Το `aadeData` δεν γράφτηκε ποτέ· η `fetchENFIAFromAADE` δεν κλήθηκε ποτέ
//     και επέστρεφε `null` ούτως ή άλλως.
//   • Το κουμπί ήταν `<a href target="_blank">` ΚΑΙ έκανε `window.open` στην ίδια
//     διεύθυνση: κάθε κλικ άνοιγε δύο καρτέλες στην ίδια δημόσια σελίδα της ΑΑΔΕ.
//   • Δεν ζητούσε ποτέ κωδικούς, άρα ούτε καν παραπλανητικά δεν «συνδεόταν».
//
// Δηλαδή: ο χρήστης διάβαζε ότι δεν θα χρειαστεί χειροκίνητη καταχώρηση, πατούσε,
// έπαιρνε δύο καρτέλες με ενημερωτικό κείμενο και μετά καταχωρούσε χειροκίνητα.
//
// Δεν χάνεται λειτουργία: ο ΕΝΦΙΑ καταχωρείται στην καρτέλα Υπηρεσίες, που έχει
// ήδη υπολογιστή, πεδίο «ΕΝΦΙΑ/έτος» και σύνδεσμο προς Ε9/myAADE. Το πλαίσιο ήταν
// αντίγραφο εκείνου — σε λάθος καρτέλα (Ασφάλεια) — με μια υπόσχεση από πάνω.
//
// Όταν η ΑΑΔΕ ανοίξει πραγματικό API, μπαίνει τότε, με πραγματική ροή εξουσιοδότησης.

// Επιστρέφει τον πλήρη πίνακα καλύψεων με ✓/✗ βάσει του προγράμματος.
/**
 * ΟΙ ΚΑΛΥΨΕΙΣ ΠΟΥ ΔΕΙΧΝΕΙ Η ΟΘΟΝΗ. Εξάγεται για να ελέγχεται: το πλήθος τους
 * πρέπει να μοιράζεται στις στήλες του πλέγματος και κανένα όνομα δεν
 * επιτρέπεται να εμφανίζεται δύο φορές.
 */
export function deriveCoverages(covers: string[], earthquake: boolean, flood: boolean, natural: boolean) {
  return [
    { label: 'Πυρκαγιά',            ok: coversFire(covers) },
    { label: 'Σεισμός',             ok: !!earthquake },
    { label: 'Πλημμύρα',            ok: !!flood || hasCov(covers, ['πλημμύρα']) },
    { label: 'Φυσικά Φαινόμενα',    ok: !!natural || hasCov(covers, ['φυσικά φαινόμενα', 'καιρικά']) },
    { label: 'Κλοπή / Διάρρηξη',    ok: hasCov(covers, ['κλοπή', 'διάρρηξη', 'ληστεία'], true) },
    { label: 'Αστική Ευθύνη',       ok: hasCov(covers, ['αστική ευθύνη'], true) },
    { label: 'Θραύση Σωληνώσεων',   ok: hasCov(covers, ['θραύση σωλην', 'σωληνώσ'], true) },
    { label: 'Βραχυκύκλωμα',        ok: hasCov(covers, ['βραχυκύκλωμα'], true) },
    { label: 'Θραύση Κρυστάλλων',   ok: hasCov(covers, ['κρυστάλλ']) },
    { label: 'Νομική Προστασία',    ok: hasCov(covers, ['νομική']) },
    // ══ ΟΙ ΔΥΟ ΠΟΥ ΕΛΕΙΠΑΝ ΚΑΙ ΕΙΝΑΙ ΟΙ ΠΙΟ ΔΙΚΕΣ ΜΑΣ ══════════════════════
    //
    // Δέκα καλύψεις άφηναν την τελευταία σειρά με ένα πλακίδιο μόνο του και
    // το δώδεκα μοιράζεται σε δύο, τρεις, τέσσερις ή έξι στήλες χωρίς να
    // περισσεύει ποτέ τίποτα. Δεν προστέθηκαν όμως για να γεμίσει η σειρά:
    // είναι τυπικές καλύψεις προγράμματος κατοικίας στην ελληνική αγορά και
    // οι δύο που αφορούν ΕΙΔΙΚΑ τον εκμισθωτή.
    //
    // Η ΑΠΩΛΕΙΑ ΕΝΟΙΚΙΩΝ αποζημιώνει τα μισθώματα που χάνονται όσο το ακίνητο
    // είναι ακατοίκητο μετά από ζημιά. Για κάθε άλλον είναι μια γραμμή στο
    // συμβόλαιο· για ιδιοκτήτη που ζει από τα ενοίκια, είναι το εισόδημά του.
    //
    // ΟΙ ΚΑΚΟΒΟΥΛΕΣ ΕΝΕΡΓΕΙΕΣ καλύπτουν φθορές από τρίτους — και ο ενοικιαστής
    // που φεύγει θυμωμένος είναι η συνηθέστερη ζημιά που βλέπει ένας
    // εκμισθωτής, πολύ πιο συχνή από σεισμό ή πλημμύρα.
    { label: 'Απώλεια Ενοικίων',    ok: hasCov(covers, ['απώλεια ενοικ', 'ενοικίων']) },
    { label: 'Κακόβουλες Ενέργειες', ok: hasCov(covers, ['κακόβουλ', 'βανδαλισμ']) },
  ];
}
