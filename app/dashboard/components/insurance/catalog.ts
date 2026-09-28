// ═══════════════════════════════════════════════════════════════════════════
// Ο ΚΑΤΑΛΟΓΟΣ ΤΗΣ ΑΣΦΑΛΕΙΑΣ ΚΑΤΟΙΚΙΑΣ: ΕΤΑΙΡΕΙΕΣ, ΠΡΟΓΡΑΜΜΑΤΑ, ΤΙΜΕΣ, ΚΑΛΥΨΕΙΣ
// ─────────────────────────────────────────────────────────────────────────
// Οι ασφαλιστικές με τα προγράμματά τους και την ημερομηνία επαλήθευσης, ο
// υπολογισμός ζωντανών προσφορών για το ακίνητο, το εύρημα «αλλαγή ασφάλειας»
// και η ανάγνωση καλύψεων από το κείμενο του συμβολαίου. Τίποτα εδώ δεν
// αποδίδει: τα διαβάζουν η οθόνη της ασφάλειας και η ειδοποίηση εξόδων.
// ═══════════════════════════════════════════════════════════════════════════
import { normalizeEnfiaAgeKey } from '@/lib/billing/enfia'

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
 */
export const INSURANCE_VERIFIED = '2026-07-29';
export const INSURANCE_MAX_AGE_DAYS = 120;

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
 * Η αυθεντική πηγή για το ποιες ασφαλιστικές λειτουργούν σήμερα και με ποιο
 * όνομα είναι το δημόσιο μητρώο ασφαλιστικών επιχειρήσεων της Τράπεζας της
 * Ελλάδος. Ο κατάλογος οφείλει να διασταυρώνεται εκεί σε κάθε ενημέρωση.
 */
const BRAND_PARENT: Record<string, string> = {
  anytime: 'interamerican',
};

/** Πόσες ΕΠΙΧΕΙΡΗΣΕΙΣ, όχι πόσες μάρκες. */
export const distinctInsurers = (companyIds: string[]): number =>
  new Set(companyIds.map(c => BRAND_PARENT[c] ?? c)).size;

// ─── Insurance data ────────────────────────────────────────────────────────────
// ΤΟ ΣΧΗΜΑ ΔΗΛΩΝΕΤΑΙ, ΔΕΝ ΣΥΜΠΕΡΑΙΝΕΤΑΙ. Χωρίς τον τύπο, ο μεταγλωττιστής
// έβγαζε ένωση από τριάντα διαφορετικά σχήματα αντικειμένου (άλλο πρόγραμμα έχει
// `covers`, άλλο όχι) και κάθε ανάγνωση πεδίου χρειαζόταν `(p as any)`. Δηλαδή
// μια ορθογραφία σε όνομα πεδίου περνούσε αθόρυβα και το κελί έμενε κενό.
interface CatalogPlan {
  id: string;
  name: string;
  /** Ενδεικτικό μηνιαίο, ΠΟΤΕ πραγματική προσφορά. */
  monthly: number;
  annual?: number;
  covers?: string[];
  earthquake?: boolean;
  flood?: boolean;
  natural?: boolean;
}
interface InsuranceCompany {
  value: string;
  label: string;
  url: string;
  agent_label: string;
  propertyTypes: string[];
  note: string;
  plans: CatalogPlan[];
}

export const INSURANCE_COMPANIES: InsuranceCompany[] = [
  { value: 'hellas_direct', label: 'Hellas Direct',            url: 'https://www.hellasdirect.gr/asfaleia-katoikias', agent_label: 'Ψηφιακή, χωρίς ασφαλιστή',
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη','Βραχυχρόνια Μίσθωση'],
    note: 'Modular καλύψεις, τιμή εξαρτάται από τ.μ., ζώνη, αξία. Δωρεάν αποτίμηση online.',
    plans: [
      { id: 'hd_ktirio',    name: 'Κτίριο',                monthly: 5.50,  annual: 55,  covers: ['Πυρκαγιά','Θραύση Σωληνώσεων','Βραχυκύκλωμα','Φυσικά Φαινόμενα','Αστική Ευθύνη'], earthquake: false, flood: true,  natural: true  },
      { id: 'hd_perieh',   name: 'Περιεχόμενο',            monthly: 4.00,  annual: 40,  covers: ['Κλοπή','Βραχυκύκλωμα','Τυχαίες Ζημιές Περιεχομένου'], earthquake: false, flood: false, natural: false },
      { id: 'hd_full',     name: 'Κτίριο και Περιεχόμενο',   monthly: 8.50,  annual: 85,  covers: ['Πυρκαγιά','Κλοπή','Θραύση Σωληνώσεων','Βραχυκύκλωμα','Φυσικά Φαινόμενα','Αστική Ευθύνη','Τυχαίες Ζημιές'], earthquake: false, flood: true,  natural: true  },
      { id: 'hd_full_eq',  name: 'Κτίριο και Περιεχόμενο + Σεισμός', monthly: 12.00, annual: 120, covers: ['Πλήρης Κάλυψη','Σεισμός','Κλοπή','Αστική Ευθύνη'], earthquake: true, flood: true, natural: true },
    ] },
  { value: 'interamerican', label: 'Interamerican',             url: 'https://www.interamerican.gr/idiotes/proionta-ypiresies/katoikia', agent_label: 'Ασφαλιστής Interamerican',
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη','Κατοικία με Δάνειο'],
    note: '4 προγράμματα, BASIC / EXTRA / COMFORT / TOTAL. Τιμή βάσει τετραγωνικών μέτρων και ασφαλιζόμενου κεφαλαίου.',
    plans: [
      { id: 'im_basic',    name: 'HOME BASIC',              monthly: 10.00, annual: 100, covers: ['Πυρκαγιά','Κεραυνός','Καπνός','Φυσικά Φαινόμενα','Αστική Ευθύνη'], earthquake: false, flood: false, natural: false },
      { id: 'im_extra',    name: 'HOME EXTRA',              monthly: 14.50, annual: 145, covers: ['Πυρκαγιά','Κλοπή','Φυσικά Φαινόμενα','Αστική Ευθύνη','Δαπάνες Μεταστέγασης'], earthquake: false, flood: true,  natural: true  },
      { id: 'im_comfort',  name: 'HOME COMFORT',            monthly: 19.00, annual: 190, covers: ['Πυρκαγιά','Κλοπή','Φυσικά Φαινόμενα','Πλημμύρα','Αστική Ευθύνη','Δαπάνες Μεταστέγασης'], earthquake: false, flood: true,  natural: true  },
      { id: 'im_total',    name: 'HOME TOTAL (All Risk)',   monthly: 26.00, annual: 249, covers: ['Κάλυψη Παντός Κινδύνου','Σεισμός','Κλοπή','Ψυχολογική Υποστήριξη','Νομική Προστασία'], earthquake: true,  flood: true,  natural: true  },
    ] },
  { value: 'anytime',       label: 'Anytime (Interamerican)',   url: 'https://www.anytime.gr/home/programs-covers', agent_label: 'Online, anytime.gr',
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη','Βραχυχρόνια Μίσθωση'],
    note: 'Ψηφιακή πλατφόρμα της Interamerican. 100% online. Διαθέσιμη και για Airbnb.',
    plans: [
      { id: 'any_eco',    name: 'Home Economic',             monthly: 8.00,  annual: 79,  covers: ['Πυρκαγιά','Θραύση Σωληνώσεων','Φυσικά Φαινόμενα','Αστική Ευθύνη'], earthquake: false, flood: false, natural: false },
      { id: 'any_val',    name: 'Home Value',                monthly: 12.50, annual: 119, covers: ['Πυρκαγιά','Κλοπή','Πλημμύρα','Αστική Ευθύνη','Δαπάνες Μεταστέγασης'], earthquake: false, flood: true,  natural: true  },
      { id: 'any_prem',   name: 'Home Premium',              monthly: 18.00, annual: 169, covers: ['Πλήρης Κάλυψη','Σεισμός','Κλοπή','Αστική Ευθύνη','Δαπάνες Μεταστέγασης'], earthquake: true,  flood: true,  natural: true  },
    ] },
  { value: 'eurolife',      label: 'Eurolife FFH',              url: 'https://www.eurolife.gr', agent_label: 'Σύμβουλος Eurolife FFH',
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη'],
    note: 'Μέλος Fairfax Financial. Ιδιαίτερα ανταγωνιστικά ασφάλιστρα.',
    plans: [
      { id: 'el_ess',     name: 'HomeSecure Essential',      monthly: 9.50,  annual: 90,  covers: ['Πυρκαγιά','Θραύση Σωληνώσεων','Φυσικά Φαινόμενα','Αστική Ευθύνη'], earthquake: false, flood: false, natural: false },
      { id: 'el_plus',    name: 'HomeSecure Plus',           monthly: 14.90, annual: 142, covers: ['Πυρκαγιά','Κλοπή','Πλημμύρα','Αστική Ευθύνη'], earthquake: false, flood: true,  natural: true  },
      { id: 'el_total',   name: 'HomeSecure Total',          monthly: 21.50, annual: 205, covers: ['Πλήρης Κάλυψη + Σεισμός'], earthquake: true,  flood: true,  natural: true  },
    ] },
  { value: 'generali',      label: 'Generali',                  url: 'https://www.generali.gr', agent_label: 'Σύμβουλος Generali',
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη','Κατοικία με Δάνειο'],
    note: 'Διεθνής ασφαλιστικός γίγαντας. Ισχυρή παρουσία στην Ελλάδα.',
    plans: [
      { id: 'gen_basic',  name: 'MyHome Basic',              monthly: 9.00,  annual: 85,  covers: ['Πυρκαγιά','Θραύση Σωληνώσεων','Φυσικά Φαινόμενα'], earthquake: false, flood: false, natural: false },
      { id: 'gen_plus',   name: 'MyHome Plus',               monthly: 14.00, annual: 132, covers: ['Πυρκαγιά','Κλοπή','Πλημμύρα','Αστική Ευθύνη'], earthquake: false, flood: true,  natural: true  },
      { id: 'gen_prem',   name: 'MyHome Premium',            monthly: 20.00, annual: 189, covers: ['Πλήρης Κάλυψη + Σεισμός + Κατολίσθηση'], earthquake: true,  flood: true,  natural: true  },
    ] },
  { value: 'axa',           label: 'ΑΧΑ Ασφαλιστική',          url: 'https://www.axa.gr', agent_label: 'Σύμβουλος ΑΧΑ',
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη'],
    note: 'Μεγαλύτερη ασφαλιστική ομάδα παγκοσμίως.',
    plans: [
      { id: 'axa_basic',  name: 'Home Protect Basic',        monthly: 10.50, annual: 99,  covers: ['Πυρκαγιά','Κλοπή','Αστική Ευθύνη'], earthquake: false, flood: false, natural: false },
      { id: 'axa_plus',   name: 'Home Protect Plus',         monthly: 15.90, annual: 149, covers: ['Πυρκαγιά','Κλοπή','Πλημμύρα','Αστική Ευθύνη','Φυσικά Φαινόμενα'], earthquake: false, flood: true,  natural: true  },
      { id: 'axa_prem',   name: 'Home Protect Premium',      monthly: 23.00, annual: 219, covers: ['Πλήρης Κάλυψη + Σεισμός'], earthquake: true,  flood: true,  natural: true  },
    ] },
  // ══ ΤΑ «ΟΙΚΙΑ CLASSIC / EXTRA / PREMIUM» ΔΕΝ ΥΠΗΡΧΑΝ ═════════════════════
  // Πηγή: https://www.ethnikiasfalistiki.gr/home-property, ανάγνωση ομάδας Grok
  // 28/09/2026 (ops.handoffs a41bd5b2, P2-2). Η επίσημη σελίδα έχει τα Full Home
  // Basic, Extra, Advance και Max. Η ΜΟΝΗ δημοσιευμένη τιμή: μόνιμη κατοικία
  // 80 τ.μ., Full Home Advance, ενδεικτικά 15€ τον μήνα, με απαλλαγές, εκπτώσεις
  // συστημάτων ασφαλείας και 15% νέου συμβολαίου. Και η διεύθυνση ήταν λάθος
  // (ethniki-asfalistiki.gr, με παύλα).
  //
  // Τα άλλα τρία δεν έχουν τιμή: `monthly: 0`, που η οθόνη γράφει ήδη ως
  // «Χειροκίνητο» και ο `computeLiveQuotes` δεν τα εκτιμά. Οι καλύψεις δεν
  // δημοσιεύονται ανά πρόγραμμα στη σελίδα, οπότε δεν δηλώνεται καμία: ένα
  // πρόγραμμα που «καλύπτει σεισμό» επειδή το γράψαμε εμείς θα πρότεινε στον
  // ιδιοκτήτη ασφάλεια που ίσως δεν τον καλύπτει.
  { value: 'ethniki',       label: 'Εθνική Ασφαλιστική',        url: 'https://www.ethnikiasfalistiki.gr/home-property', agent_label: 'Ασφαλιστής Εθνικής',
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη','Κατοικία με Δάνειο'],
    note: 'Full Home Advance ενδεικτικά από 15€ τον μήνα για μόνιμη κατοικία 80 τ.μ., όχι προσφορά. Για τα υπόλοιπα προγράμματα ζήτησε προσφορά.',
    plans: [
      { id: 'eth_fh_basic',   name: 'Full Home Basic',    monthly: 0,     covers: [], earthquake: false, flood: false, natural: false },
      { id: 'eth_fh_extra',   name: 'Full Home Extra',    monthly: 0,     covers: [], earthquake: false, flood: false, natural: false },
      { id: 'eth_fh_advance', name: 'Full Home Advance',  monthly: 15.00, covers: [], earthquake: false, flood: false, natural: false },
      { id: 'eth_fh_max',     name: 'Full Home Max',      monthly: 0,     covers: [], earthquake: false, flood: false, natural: false },
    ] },
  { value: 'allianz',       label: 'Allianz Hellas',            url: 'https://www.allianz.gr', agent_label: 'Ασφαλιστής Allianz / Online',
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη'],
    note: 'Μεγαλύτερος ασφαλιστικός όμιλος Ευρώπης.',
    plans: [
      { id: 'al_comp',    name: 'MeinHaus Compact',          monthly: 11.00, annual: 104, covers: ['Πυρκαγιά','Κλοπή','Αστική Ευθύνη','Θραύση Σωληνώσεων'], earthquake: false, flood: false, natural: false },
      { id: 'al_comf',    name: 'MeinHaus Comfort',          monthly: 16.90, annual: 159, covers: ['Πυρκαγιά','Κλοπή','Πλημμύρα','Φυσικά Φαινόμενα','Αστική Ευθύνη'], earthquake: false, flood: true,  natural: true  },
      { id: 'al_plus',    name: 'MeinHaus Plus',             monthly: 23.90, annual: 225, covers: ['Πλήρης Κάλυψη + Σεισμός'], earthquake: true,  flood: true,  natural: true  },
    ] },
  { value: 'ergo',          label: 'ERGO Ασφαλιστική',          url: 'https://www.ergohellas.gr', agent_label: 'Μεσίτης / Online',
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη'],
    note: 'Μέλος Munich Re Group.',
    plans: [
      { id: 'ergo_basic', name: 'Home Basic',                monthly: 9.00,  annual: 85,  covers: ['Πυρκαγιά','Θραύση Σωληνώσεων','Αστική Ευθύνη'], earthquake: false, flood: false, natural: false },
      { id: 'ergo_plus',  name: 'Home Plus',                 monthly: 14.00, annual: 132, covers: ['Πυρκαγιά','Κλοπή','Πλημμύρα','Αστική Ευθύνη'], earthquake: false, flood: true,  natural: true  },
      { id: 'ergo_prem',  name: 'Home Premium',              monthly: 20.00, annual: 189, covers: ['Πλήρης Κάλυψη + Σεισμός'], earthquake: true,  flood: true,  natural: true  },
    ] },
  { value: 'groupama',      label: 'Groupama (myZen)',          url: 'https://www.groupama.gr', agent_label: 'Online, myZen.gr',
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη'],
    note: 'Γαλλικός ασφαλιστικός όμιλος. 100% online μέσω myZen.gr.',
    plans: [
      { id: 'grp_basic',  name: 'myZen Basic',               monthly: 8.50,  annual: 80,  covers: ['Πυρκαγιά','Θραύση Σωληνώσεων','Αστική Ευθύνη'], earthquake: false, flood: false, natural: false },
      { id: 'grp_conf',   name: 'myZen Confort',             monthly: 12.90, annual: 120, covers: ['Πυρκαγιά','Κλοπή','Πλημμύρα','Αστική Ευθύνη','Φυσικά Φαινόμενα'], earthquake: false, flood: true,  natural: true  },
      { id: 'grp_allr',   name: 'myZen All Risk',            monthly: 19.00, annual: 179, covers: ['Κάλυψη Παντός Κινδύνου + Σεισμός'], earthquake: true,  flood: true,  natural: true  },
    ] },
  { value: 'cosmote_ins',   label: 'Magenta Insurance',         url: 'https://www.magentainsurance.gr/home', agent_label: 'Online, Magenta',
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία'],
    note: 'Πρώην COSMOTE Insurance. Σύγκριση και online ασφάλιση κατοικίας από 90€/έτος, με δυνατότητα έκπτωσης έως 20% στον ΕΝΦΙΑ υπό προϋποθέσεις.',
    plans: [
      { id: 'ci_basic',   name: 'Magenta Home Βασικό',       monthly: 8.00,  annual: 96,  covers: ['Πυρκαγιά','Θραύση Σωληνώσεων','Φυσικά Φαινόμενα','Βραχυκύκλωμα','Αστική Ευθύνη'], earthquake: false, flood: false, natural: false },
      { id: 'ci_plus',    name: 'Magenta Home Πλήρες',       monthly: 14.50, annual: 139, covers: ['Πυρκαγιά','Κλοπή','Πλημμύρα','Φυσικά Φαινόμενα','Αστική Ευθύνη'], earthquake: false, flood: true,  natural: true  },
      { id: 'ci_total',   name: 'Magenta Home Ολοκληρωμένο', monthly: 21.00, annual: 199, covers: ['Πλήρης Κάλυψη','Σεισμός','Κατολίσθηση','Νομική Προστασία'], earthquake: true,  flood: true,  natural: true  },
    ] },
  { value: 'interlife',     label: 'Interlife',                 url: 'https://www.interlife.gr', agent_label: 'Ασφαλιστής / Online',
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη'],
    note: 'Ελληνική ασφαλιστική εταιρεία. Ανταγωνιστικές τιμές.',
    plans: [
      { id: 'il_basic',   name: 'Κατοικία Basic',            monthly: 7.50,  annual: 72,  covers: ['Πυρκαγιά','Κλοπή','Αστική Ευθύνη'], earthquake: false, flood: false, natural: false },
      { id: 'il_plus',    name: 'Κατοικία Plus',             monthly: 12.00, annual: 114, covers: ['Πυρκαγιά','Κλοπή','Πλημμύρα','Αστική Ευθύνη'], earthquake: false, flood: true,  natural: true  },
      { id: 'il_prem',    name: 'Κατοικία Premium',          monthly: 17.00, annual: 160, covers: ['Πλήρης Κάλυψη + Σεισμός'], earthquake: true,  flood: true,  natural: true  },
    ] },
  { value: 'metlife',       label: 'MetLife',                   url: 'https://www.metlife.gr', agent_label: 'Ασφαλιστής MetLife',
    propertyTypes: ['Κύρια Κατοικία','Ενοικιαζόμενη','Κατοικία με Δάνειο'],
    note: 'Αμερικανική εταιρεία με ισχυρή παρουσία στην Ελλάδα.',
    plans: [
      { id: 'ml_prot',    name: 'Home Protection',           monthly: 10.00, annual: 95,  covers: ['Πυρκαγιά','Κλοπή','Αστική Ευθύνη'], earthquake: false, flood: false, natural: false },
      { id: 'ml_comf',    name: 'Home Comfort',              monthly: 16.00, annual: 152, covers: ['Πλήρης Κάλυψη + Σεισμός'], earthquake: true,  flood: true,  natural: true  },
    ] },
  { value: 'atlantiki',     label: 'Ατλαντική Ένωση',           url: 'https://www.atlantiki.gr', agent_label: 'Ασφαλιστής',
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη'],
    note: 'Ελληνική εταιρεία, ανταγωνιστικά ασφάλιστρα.',
    plans: [
      { id: 'at_class',   name: 'Ακίνητο Classic',           monthly: 8.00,  annual: 76,  covers: ['Πυρκαγιά','Κλοπή','Αστική Ευθύνη'], earthquake: false, flood: false, natural: false },
      { id: 'at_extra',   name: 'Ακίνητο Extra',             monthly: 13.00, annual: 124, covers: ['Πυρκαγιά','Κλοπή','Πλημμύρα','Αστική Ευθύνη'], earthquake: false, flood: true,  natural: true  },
      { id: 'at_prem',    name: 'Ακίνητο Premium',           monthly: 19.00, annual: 179, covers: ['Πλήρης Κάλυψη + Σεισμός'], earthquake: true,  flood: true,  natural: true  },
    ] },
  { value: 'intesaloniki',  label: 'Ιντερσαλόνικα',             url: 'https://www.intersalonica.gr', agent_label: 'Ασφαλιστής',
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία'],
    note: 'Ελληνική εταιρεία με έδρα τη Θεσσαλονίκη.',
    plans: [
      { id: 'is_vasi',    name: 'Κατοικία Βασική',           monthly: 7.00,  annual: 66,  covers: ['Πυρκαγιά','Κλοπή','Αστική Ευθύνη'], earthquake: false, flood: false, natural: false },
      { id: 'is_plir',    name: 'Κατοικία Πλήρης',          monthly: 12.00, annual: 114, covers: ['Πυρκαγιά','Κλοπή','Πλημμύρα','Αστική Ευθύνη','Φυσικά Φαινόμενα'], earthquake: false, flood: true,  natural: true  },
    ] },
  { value: 'aig',           label: 'AIG (American International)', url: 'https://www.aig.com.gr', agent_label: 'Ασφαλιστής',
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Κατοικία με Δάνειο'],
    note: 'Αμερικανική εταιρεία, ισχυρές καλύψεις All Risk.',
    plans: [
      { id: 'aig_allr',   name: 'Home All Risk',             monthly: 13.00, annual: 124, covers: ['Κάλυψη Παντός Κινδύνου','Αστική Ευθύνη'], earthquake: false, flood: true,  natural: true  },
      { id: 'aig_plus',   name: 'Home All Risk Plus',        monthly: 20.00, annual: 189, covers: ['Κάλυψη Παντός Κινδύνου + Σεισμός + Κατολίσθηση'], earthquake: true,  flood: true,  natural: true  },
    ] },
  { value: 'other',         label: 'Άλλη Ασφαλιστική',          url: '', agent_label: 'Ασφαλιστής',
    propertyTypes: ['Κύρια Κατοικία','Εξοχική Κατοικία','Ενοικιαζόμενη'],
    note: '',
    plans: [{ id: 'other_custom', name: 'Προσαρμοσμένο', monthly: 0, annual: 0, covers: [], earthquake: false, flood: false, natural: false }] },
];


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
}

/**
 * Το ΕΝΔΕΙΚΤΙΚΟ κόστος κάθε προγράμματος για το ακίνητο.
 *
 * ΤΙ ΕΙΝΑΙ ΚΑΙ ΤΙ ΔΕΝ ΕΙΝΑΙ: είναι μοντέλο τιμής πάνω στις δημοσιευμένες τιμές
 * εκκίνησης των εταιρειών. ΔΕΝ είναι προσφορά. Πραγματική τιμή ασφάλισης
 * κατοικίας δεν υπάρχει δημοσιευμένη: παράγεται από τα στοιχεία του
 * συγκεκριμένου ακινήτου και προσώπου και τη δίνει μόνο η ασφαλιστική. Γι'
 * αυτό κάθε ποσό εδώ φέρει `confidence: 'estimated'` και η οθόνη στέλνει τον
 * χρήστη στην πηγή για την πραγματική προσφορά.
 *
 * ΠΡΟΣΟΧΗ ΣΤΟ ΤΙ ΚΑΝΕΙ Ο ΣΥΝΤΕΛΕΣΤΗΣ: ανεβοκατεβάζει ΟΛΑ τα προγράμματα μαζί,
 * άρα ΔΕΝ αλλάζει σειρά. Η σειρά βγαίνει από τη μηχανή αναγκών
 * (lib/insurance/match.ts) και όχι από εδώ. Παλιά δεν υπήρχε τέτοια μηχανή και
 * η «εξατομικευμένη σύγκριση» έβγαζε ακριβώς την ίδια κατάταξη για κάθε ακίνητο.
 */
export function computeLiveQuotes(sqm: number, propValue: number, contentValue: number, floor: string, age: string): LiveQuote[] {
  if (!sqm || !propValue) return [];

  // Συντελεστές τιμολόγησης από τα χαρακτηριστικά του ακινήτου
  const sqmFactor    = Math.max(0.7, Math.min(1.5, sqm / 100));
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
  const totalFactor  = sqmFactor * valueFactor * contentF * floorRisk * ageRisk;

  // Πρόγραμμα χωρίς δημοσιευμένη τιμή δεν εκτιμάται: μηδέν επί συντελεστή
  // είναι μηδέν και θα έβγαινε «το φθηνότερο» της σύγκρισης.
  return INSURANCE_COMPANIES
    .filter(c => c.value !== 'other')
    .flatMap(c => (c.plans ?? []).filter(p => p.monthly > 0).map(p => {
      const base = p.monthly;
      const estimate = base * totalFactor;
      // ΤΟ ΕΤΗΣΙΟ ΔΕΝ ΕΙΝΑΙ ΜΗΝΙΑΙΟ ΕΠΙ ΔΩΔΕΚΑ. Κάθε πρόγραμμα φέρει και δικό του
      // annual, που είναι εκπτωτικό: η Hellas Direct «Κτίριο & Περιεχόμενο» κάνει
      // 8,50 τον μήνα αλλά 85 τον χρόνο, όχι 102. Ο παλιός τύπος έδειχνε την
      // ετήσια πληρωμή περίπου 20% ακριβότερη απ όσο πραγματικά είναι, δηλαδή
      // έκρυβε ακριβώς την έκπτωση που κάνει την ετήσια πληρωμή συμφέρουσα.
      const declaredAnnual = (p as { annual?: number }).annual;
      const annualRatio = (declaredAnnual && base) ? declaredAnnual / (base * 12) : 1;
      return {
        company:       c.value,
        companyLabel:  c.label,
        plan:          p.id,
        planLabel:     p.name,
        monthlyEstimate: Math.round(estimate * 100) / 100,
        annualEstimate:  Math.round(estimate * 12 * annualRatio * 100) / 100,
        earthquake:    !!p.earthquake,
        flood:         !!p.flood,
        natural:       !!p.natural,
        covers:        p.covers || [],
        url:           c.url,
        confidence:    'estimated' as const,
      };
    }));
  // Καμία ταξινόμηση εδώ. Τη σειρά την ορίζει η καταλληλότητα, όχι η τιμή.
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
  const plan = (company?.plans ?? []).find(p => p.id === s.insPlanId) as
    | { monthly?: number; name?: string; earthquake?: boolean; flood?: boolean; natural?: boolean }
    | undefined;

  const current = parseFloat(String(s.insCustomPrice ?? '')) || plan?.monthly || 0;
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

  return {
    current, best: cheaper.monthlyEstimate, savingsMonthly: savings,
    bestLabel: `${cheaper.companyLabel} ${cheaper.planLabel}`,
    basedOn: `${sqm} τ.μ., ίδιες ή καλύτερες καλύψεις· εκτίμηση, όχι προσφορά`,
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

// ─── Coverage taxonomy, δυναμική ανάλυση καλύψεων (pricefox / insurancemarket style) ──
// Οι φράσεις «Πλήρης Κάλυψη / Παντός Κινδύνου / All Risk» υπονοούν τους βασικούς κινδύνους.
const ALL_RISK_HINTS = ['πλήρης', 'παντός κινδύνου', 'all risk', 'παντός'];
function hasCov(covers: string[], keys: string[], allRiskImplies = false): boolean {
  const joined = (covers || []).join(' ').toLowerCase();
  if (keys.some(k => joined.includes(k.toLowerCase()))) return true;
  if (allRiskImplies && ALL_RISK_HINTS.some(h => joined.includes(h))) return true;
  return false;
}
// Επιστρέφει τον πλήρη πίνακα καλύψεων με ✓/✗ βάσει του προγράμματος.
/**
 * ΟΙ ΚΑΛΥΨΕΙΣ ΠΟΥ ΔΕΙΧΝΕΙ Η ΟΘΟΝΗ. Εξάγεται για να ελέγχεται: το πλήθος τους
 * πρέπει να μοιράζεται στις στήλες του πλέγματος και κανένα όνομα δεν
 * επιτρέπεται να εμφανίζεται δύο φορές.
 */
export function deriveCoverages(covers: string[], earthquake: boolean, flood: boolean, natural: boolean) {
  return [
    { label: 'Πυρκαγιά',            ok: hasCov(covers, ['πυρκαγιά', 'φωτιά'], true) },
    { label: 'Σεισμός',             ok: !!earthquake },
    { label: 'Πλημμύρα',            ok: !!flood || hasCov(covers, ['πλημμύρα']) },
    { label: 'Φυσικά Φαινόμενα',    ok: !!natural || hasCov(covers, ['φυσικά φαινόμενα', 'καιρικά']) },
    { label: 'Κλοπή / Διάρρηξη',    ok: hasCov(covers, ['κλοπή', 'διάρρηξη', 'ληστεία'], true) },
    { label: 'Αστική Ευθύνη',       ok: hasCov(covers, ['αστική ευθύνη'], true) },
    { label: 'Θραύση Σωληνώσεων',   ok: hasCov(covers, ['θραύση σωλην', 'σωληνώσ'], true) },
    { label: 'Βραχυκύκλωμα',        ok: hasCov(covers, ['βραχυκύκλωμα'], true) },
    { label: 'Θραύση Κρυστάλλων',   ok: hasCov(covers, ['κρυστάλλ']) },
    { label: 'Νομική Προστασία',    ok: hasCov(covers, ['νομική']) },
    // ══ ΟΙ ΔΥΟ ΠΟΥ ΕΛΕΙΠΑΝ, ΚΑΙ ΕΙΝΑΙ ΟΙ ΠΙΟ ΔΙΚΕΣ ΜΑΣ ══════════════════════
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
