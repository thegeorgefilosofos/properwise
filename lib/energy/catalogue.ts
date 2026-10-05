// ═══════════════════════════════════════════════════════════════════════════
// Ο ΚΑΤΑΛΟΓΟΣ ΤΙΜΟΛΟΓΙΩΝ ΡΕΥΜΑΤΟΣ — ΔΕΔΟΜΕΝΑ, ΟΧΙ ΟΘΟΝΗ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΕΦΥΓΕ ΑΠΟ ΤΟ COMPONENT. Ήταν 194 γραμμές μέσα σε αρχείο 950 γραμμών —
// το 21% μιας οθόνης ήταν πίνακας δεδομένων. Κάθε φορά που κάποιος διόρθωνε μια
// τιμή, ο διαφορικός έδειχνε αλλαγή σε React component· κάθε φορά που κάποιος
// άλλαζε την απόδοση, έπρεπε να προσπεράσει εκατό τιμολόγια.
//
// ΓΙΑΤΙ ΔΕΝ ΕΓΙΝΕ ΝΩΡΙΤΕΡΑ ΚΑΙ ΤΙ ΕΠΡΕΠΕ ΝΑ ΔΙΟΡΘΩΘΕΙ ΠΡΩΤΑ. Το
// `lib/energy/tariff.test.ts` φύλαγε τον κατάλογο διαβάζοντας το ΑΡΧΕΙΟ ως
// κείμενο, με regex ανά γραμμή: απαιτούσε κάθε τιμολόγιο να είναι σε μία γραμμή
// ΚΑΙ μέσα στο `BillsElectricity.tsx`. Μετακίνηση του καταλόγου θα ακύρωνε τον
// φρουρό ΣΙΩΠΗΛΑ — θα περνούσε με μηδέν ευρήματα, δηλαδή θα έδειχνε πράσινο
// ακριβώς επειδή δεν έβρισκε τίποτα να ελέγξει. Ο έλεγχος ξαναγράφτηκε πρώτα,
// πάνω στα ΑΝΤΙΚΕΙΜΕΝΑ: τώρα δεν τον νοιάζει πού ζουν ούτε πώς είναι γραμμένα.
//
// Ο ΤΥΠΟΣ ΜΕΝΕΙ ΔΗΛΩΜΕΝΟΣ. Ένα τιμολόγιο με λάθος όνομα πεδίου (`kwh_tier_2`
// αντί `kwh_tier2`) ή με ξεχασμένο `vat` θα περνούσε τη μεταγλώττιση και θα
// έβγαζε λάθος σύγκριση κόστους στην οθόνη του ιδιοκτήτη.
// ═══════════════════════════════════════════════════════════════════════════
import type { Tariff } from './tariff';
import { addRaaeyPower, RAAEY_MONTH_GEN, RAAEY_READ_AT } from './raaeyCatalogue';

export type { PriceStatus } from './tariff';

// ═══ ΠΟΤΕ ΕΛΕΓΧΘΗΚΕ Ο ΚΑΤΑΛΟΓΟΣ, ΔΙΠΛΑ ΣΤΟΝ ΚΑΤΑΛΟΓΟ ═══════════════════════
//
// ΖΟΥΣΑΝ ΜΕΣΑ ΣΤΟ `BillsElectricity.tsx` ΚΑΙ ΕΓΙΝΑΝ ΔΥΟ ΟΘΟΝΕΣ. Η ημερομηνία,
// η ετικέτα και το κατώφλι ήταν σταθερές του component του πίνακα ελέγχου.
// Μόλις η σύγκριση βγήκε και σε δημόσια σελίδα (/sygkrisi-timologion-revmatos),
// η δεύτερη οθόνη θα χρειαζόταν δεύτερο αντίγραφο: δηλαδή δύο ημερομηνίες για
// τον ίδιο έλεγχο και μία από αυτές θα έμενε πίσω. Ζουν εδώ, όπως οι αντίστοιχες
// του αερίου ζουν στο `gas.ts` και τις διαβάζουν και οι δύο οθόνες.
//
// Η συνέπεια με το data/price-sources.json φυλάσσεται από το
// `lib/energy/label.test.ts`: αν αποκλίνουν, κοκκινίζει το CI.

// ══ ΟΚΤΩΒΡΙΟΣ 2026: Ο ΠΙΝΑΚΑΣ ΤΗΣ ΡΑΑΕΥ ═══════════════════════════════════
// Πηγή: ο πίνακας τιμολογίων της ΡΑΑΕΥ στο energycost.gr, ανάγνωση 05.10.2026,
// μεταγραμμένος στο data/raaey/energycost-2026-10.json (scripts/energy/
// raaey-import.mjs). Τα τιμολόγια που βρέθηκαν στον πίνακα με τον πάροχο και
// το όνομά τους κουβαλούν `raaey: 'φύλλο:γραμμή'` και τις τιμές του Οκτωβρίου·
// όσα δεν βρέθηκαν κρατούν την τιμή τους με τον ΔΙΚΟ ΤΗΣ μήνα και δεν
// κατατάσσονται. Τα τιμολόγια του πίνακα που έλειπαν προστίθενται από το
// lib/energy/raaeyCatalogue.ts.

/** Ημέρα της τελευταίας ενημέρωσης τιμών. Ζευγάρι με το `checkedAt`. */
export const TARIFFS_VERIFIED = '2026-10-05';
/** Ο μήνας των τιμών του πίνακα. Ζευγάρι με το `label`. */
export const TARIFFS_LABEL = 'Οκτώβριος 2026';
/** Το κατώφλι παλαιότητας του ρεύματος, από το `maxAgeDays`. */
export const TARIFFS_MAX_AGE_DAYS = 40;
/** Η πηγή των τιμών, όπως γράφεται στην οθόνη. */
export const PRICES_SOURCE = 'ΡΑΑΕΥ, energycost.gr';
/** «Τελευταία ενημέρωση: 05.10.2026», μία φορά για κάθε οθόνη που δείχνει τιμές. */
export const PRICES_UPDATED_LINE = `Τελευταία ενημέρωση: ${RAAEY_READ_AT.split('-').reverse().join('.')}`;

/**
 * Ο μήνας του καταλόγου σε γενική: «Οκτωβρίου 2026». Μόνο τιμές αυτού του
 * μήνα κατατάσσονται.
 */
export const CATALOGUE_MONTH_GEN = RAAEY_MONTH_GEN;

/**
 * ΤΙ ΣΗΜΑΙΝΕΙ ΤΟ ΧΡΩΜΑ. Η ΡΑΑΕΥ κατατάσσει τα τιμολόγια σε χρώματα και όλοι οι
 * πάροχοι τα γράφουν έτσι: είναι το λεξιλόγιο της αγοράς και μένει. Αυτό που
 * έλειπε ήταν η μετάφρασή του: ο ιδιοκτήτης έβλεπε «ΚΙΤΡΙΝΟ» σε πλακίδιο και
 * καμία γραμμή της οθόνης δεν του έλεγε ότι σημαίνει τιμή που αλλάζει μέσα στη
 * σύμβαση. Δηλαδή η πιο κρίσιμη πληροφορία για το αν θα πληρώσει το ίδιο τον
 * Ιανουάριο ήταν γραμμένη σε κώδικα που έπρεπε να ξέρει από πριν.
 *
 * ΓΙΑΤΙ ΣΕ title ΚΑΙ ΟΧΙ ΣΕ ΔΕΥΤΕΡΗ ΓΡΑΜΜΗ: ο τύπος του τιμολογίου («σταθερό»,
 * «κυμαινόμενο») ΕΙΝΑΙ το χρώμα· τα δεδομένα δείχνουν ένα προς ένα αντιστοιχία
 * ανάμεσα σε `badge` και `type`. Γραμμένα και τα δύο, θα ήταν το ίδιο πράγμα
 * δύο φορές στην ίδια γραμμή.
 *
 * Ηταν σταθερά του `BillsElectricity.tsx`· ήρθε εδώ όταν τη χρειάστηκε και η
 * δημόσια σύγκριση, ώστε το ίδιο χρώμα να εξηγείται με τα ίδια λόγια παντού.
 */
export const BADGE_MEANING: Record<string, string> = {
  'ΜΠΛΕ':     'Σταθερή τιμή για όλη τη διάρκεια της σύμβασης',
  'ΠΡΑΣΙΝΟ':  'Ειδικό τιμολόγιο. Η τιμή ανακοινώνεται την πρώτη κάθε μήνα',
  'ΚΙΤΡΙΝΟ':  'Κυμαινόμενη τιμή. Αλλάζει κατά τη διάρκεια της σύμβασης',
  'FLAT':     'Σταθερό ποσό κάθε μήνα, με ετήσιο όριο κιλοβατωρών',
  'VNM':      'Εικονική καθαρή μέτρηση, με φωτοβολταϊκό',
  'ΔΥΝΑΜΙΚΟ': 'Ωριαία τιμή χρηματιστηρίου ενέργειας',
};

export interface LocalTariff extends Tariff {
  desc: string;
  contract_months?: number;
  no_fixed?: boolean;
  smart_meter?: boolean;
  /**
   * Τιμολόγιο με ΠΕΡΙΟΡΙΣΜΟ ΔΙΚΑΙΩΜΑΤΟΣ: απαιτεί φοιτητική ιδιότητα.
   *
   * ΗΤΑΝ ΚΑΙ ΔΙΑΓΡΑΦΗΚΕ ΩΣ «ΝΕΚΡΟ» ΚΑΙ ΗΤΑΝ ΛΑΘΟΣ. Το πεδίο υπήρχε, καμία
   * γραμμή δεν το διάβαζε και η διαγραφή του φάνηκε καθαρή. Το ότι δεν το
   * διάβαζε κανείς ΗΤΑΝ το σφάλμα: τέσσερα φοιτητικά τιμολόγια έμπαιναν στη
   * σύγκριση όλων και δύο από αυτά έβγαιναν ΠΡΩΤΑ, με τιμή που ο ιδιοκτήτης δεν
   * δικαιούται. Θα άλλαζε πάροχο και θα απορριπτόταν στην αίτηση.
   */
  studentOnly?: boolean;

  /**
   * ΤΟ ΜΗΝΙΑΙΟ ΠΟΣΟ ΕΙΝΑΙ ΕΝΑΝΤΙ, ΟΧΙ ΤΙΜΗ: ΕΚΚΑΘΑΡΙΖΕΤΑΙ ΑΡΓΟΤΕΡΑ.
   *
   * Το «myHome Plan» της ΔΕΗ χρεώνει 60€ κάθε μήνα και εκκαθαρίζει την
   * πραγματική κατανάλωση δύο φορές τον χρόνο, στον έκτο και στον δωδέκατο
   * μήνα της σύμβασης, με τις καταμετρήσεις του ΔΕΔΔΗΕ. Ο κατάλογος το κρατούσε
   * ως `flat_monthly: 60` χωρίς κανένα όριο κιλοβατωρών, δηλαδή η εφαρμογή
   * υποστήριζε ότι 60€ αγοράζουν ΟΣΗ ενέργεια θέλει κανείς. Σε 600 kWh τον
   * μήνα το τιμολόγιο έβγαινε πρώτο στην κατάταξη με ποσό που η εκκαθάριση
   * ακυρώνει· η οθόνη θα το πρότεινε σε δωδεκάμηνη δέσμευση.
   *
   * Η ΑΡΧΗ ΥΠΑΡΧΕΙ ΗΔΗ ΣΤΟ ΕΡΓΟ, ΔΥΟ ΦΟΡΕΣ: τα δυναμικά και όσα κλείνουν
   * αναδρομικά με ΜΔΚΑ δεν υπολογίζονται, γιατί εκτίμηση με ύφος υπολογισμού
   * είναι μαντεψιά. Εδώ ισχύει το ίδιο, με μια διαφορά: το τιμολόγιο μένει
   * επιλέξιμο ως ΤΡΕΧΟΝ, ώστε όποιος το έχει να το δηλώσει, αλλά δεν μπαίνει σε
   * κατάταξη ώσπου να καταγραφούν το πάγιο και η τιμή του με πηγή.
   */
  settled?: boolean;

  /**
   * ΠΡΟΩΘΗΤΙΚΗ ΤΙΜΗ, ΟΠΩΣ ΤΗ ΓΡΑΦΕΙ ΤΟ ΤΙΜΟΛΟΓΙΟ ΤΟΥ ΠΑΡΟΧΟΥ. Μόνο για την οθόνη.
   *
   * Η σύγκριση τρέχει με το `kwh_day`, τη βασική τιμή: η προωθητική έκπτωση
   * έχει όρους και λήξη που δεν τα κρατά ο κατάλογος. Αν έμπαινε στον
   * υπολογισμό, το τιμολόγιο θα κατατασσόταν με τιμή που ο χρήστης μπορεί να
   * μην πάρει. Δείχνεται δίπλα, με το όνομά της.
   */
  promo_kwh_day?: number;

  /**
   * ΓΙΑ ΠΟΙΟΝ ΜΗΝΑ ΙΣΧΥΕΙ Η ΤΙΜΗ, ΣΕ ΓΕΝΙΚΗ: «Οκτωβρίου 2026».
   *
   * Τα «πράσινα» αλλάζουν κάθε 1η του μήνα. Χωρίς μήνα δίπλα της, μια τιμή που
   * ήταν σωστή τον Οκτώβριο διαβάζεται ως σωστή και τον Νοέμβριο. Η οθόνη το
   * γράφει ως «Τιμή Οκτωβρίου 2026». Μπαίνει μόνο όπου ο μήνας ελέγχθηκε στο
   * έγγραφο του παρόχου.
   */
  priceMonth?: string;

  /**
   * Η ΤΙΜΗ ΧΩΡΙΣ ΤΗΝ ΠΡΟΫΠΟΘΕΣΗ ΤΗΣ ΠΕΡΙΓΡΑΦΗΣ (συνέπεια, myΔΕΗ). Μόνο για την οθόνη.
   *
   * Η σύγκριση τρέχει με την τιμή της προϋπόθεσης, όπως σε κάθε τιμολόγιο με
   * έκπτωση συνέπειας. Οποιος όμως πληρώνει αργά πληρώνει αυτήν εδώ. Η
   * διαφορά φτάνει τα 8 λεπτά ανά κιλοβατώρα. Ζει σε πεδίο και όχι μέσα στην
   * περιγραφή, ώστε ο έλεγχος του καταλόγου να ξέρει κάθε ευρώ που τυπώνεται.
   */
  undiscounted?: { day: number | null; tier2?: number; night?: number; fixed?: number };

  /** Η γραμμή του πίνακα της ΡΑΑΕΥ από την οποία βγαίνουν οι τιμές: «power-residential:28». */
  raaey?: string;
  /** Οι προϋποθέσεις της έκπτωσης, όπως τις γράφει η ΡΑΑΕΥ. */
  conditions?: { price?: string; fixed?: string };
  /**
   * Το κείμενο της ΡΑΑΕΥ για την τιμή, όταν δεν γράφεται σε πεδία: «δεν είναι
   * ακόμα γνωστή», ή κλίμακες περισσότερες από όσες κρατά ο υπολογισμός.
   */
  priceText?: string;
  /** Η τιμή είναι γνωστή αλλά σε μορφή που ο υπολογισμός δεν κρατά. */
  priceUnsupported?: boolean;
  /**
   * Η ΡΑΑΕΥ γράφει «Η τιμή δεν είναι ακόμα γνωστή» για τον μήνα του πίνακα. Η
   * τιμή που μένει είναι η προηγούμενη, με τον δικό της μήνα στο `priceMonth`,
   * και δεν κατατάσσεται.
   */
  raaeyUnknown?: boolean;
  /**
   * Η ΡΑΑΕΥ το γράφει «μη εμπορικά διαθέσιμο». Μένει για όποιον το έχει ήδη,
   * αλλά δεν προτείνεται και δεν βγαίνει ποτέ «φθηνότερο».
   */
  notAvailable?: boolean;
}

export interface ProviderGroup { value: string; label: string; url: string; tariffs: LocalTariff[] }

/**
 * ΤΙ ΛΕΕΙ Η ΟΘΟΝΗ ΓΙΑ ΤΟΝ ΜΗΝΑ ΤΗΣ ΤΙΜΗΣ. Κάθε τιμή λέει τον μήνα της· όσες
 * δεν είναι του μήνα του πίνακα το λένε ρητά, γιατί δεν κατατάσσονται.
 */
export function priceMonthNote(t: Pick<LocalTariff, 'priceMonth' | 'raaeyUnknown' | 'priceUnsupported'>): string {
  if (t.raaeyUnknown) return `Τιμή ${t.priceMonth}. Η ΡΑΑΕΥ δεν έχει ακόμη τιμή ${CATALOGUE_MONTH_GEN}`;
  if (t.priceMonth) return `Τιμή ${t.priceMonth}`;
  return t.priceUnsupported
    ? `Τιμή ${CATALOGUE_MONTH_GEN} σε κλίμακες που δεν υπολογίζονται εδώ`
    : `Η τιμή ${CATALOGUE_MONTH_GEN} δεν είναι ακόμη γνωστή`;
}

/** Οι προϋποθέσεις της έκπτωσης, όπως τις γράφει η ΡΑΑΕΥ, σε μία πρόταση. */
export function conditionNote(t: Pick<LocalTariff, 'conditions'>): string | null {
  const c = t.conditions;
  if (!c || (!c.price && !c.fixed)) return null;
  const parts = [c.price ? `τιμή: ${c.price}` : '', c.fixed && c.fixed !== c.price ? `πάγιο: ${c.fixed}` : ''].filter(Boolean);
  return `Προϋπόθεση έκπτωσης (${parts.join('· ')})`;
}

/**
 * Πακέτα σταθερού μηνιαίου που ΔΕΝ δημοσιεύουν όριο κιλοβατωρών σε αριθμό.
 *
 * ΓΙΑΤΙ ΚΑΤΑΓΡΑΦΟΝΤΑΙ ΑΝΤΙ ΝΑ ΣΥΜΠΛΗΡΩΘΟΥΝ. Το «myHome Plan» γράφει στην
 * περιγραφή του «ιδανικό για 2.500-4.500 kWh/έτος» — εύρος, όχι όριο. Το να
 * βάλουμε εμείς έναν αριθμό θα ήταν εφεύρεση δεδομένου που κρίνει αν ο χρήστης
 * θα χρεωθεί υπέρβαση. Καταγράφεται ρητά, η οθόνη το λέει και ο έλεγχος
 * απαγορεύει στη λίστα να μεγαλώσει.
 */
export const FLAT_WITHOUT_ALLOWANCE = new Set([
  // Το «myHome Plan» έφυγε από εδώ: το θέμα του δεν είναι αδημοσίευτο όριο
  // κιλοβατωρών αλλά εκκαθάριση δύο φορές τον χρόνο. Φέρει `settled` και δική
  // του εξήγηση, γιατί μια προειδοποίηση για «υπέρβαση ορίου» θα έστελνε τον
  // ιδιοκτήτη να ρωτήσει τον πάροχο λάθος ερώτηση.
  'zen_zenergy_s',   // η ίδια η περιγραφή λέει «ακριβές όριο: δες zenith.gr»
  'zen_zenergy_m',
  'zen_zenergy_l',
]);

/**
 * Κάθε τιμολόγιο του καταλόγου, ισοπεδωμένο. Για ΕΛΕΓΧΟ του καταλόγου.
 *
 * Μαζί με την ετικέτα του παρόχου έρχεται και η σελίδα του. Ο λόγος είναι η
 * τελευταία γραμμή της σύγκρισης, που ζητά από τον χρήστη να επιβεβαιώσει την
 * τιμή στον πάροχο πριν υπογράψει: μια οδηγία χωρίς σύνδεσμο είναι οδηγία που
 * δεν εκτελείται. Η διεύθυνση υπήρχε ήδη στο `ProviderGroup`, απλώς σταματούσε
 * εδώ και δεν έφτανε ποτέ στη γραμμή του τιμολογίου.
 */
export const ALL_TARIFFS = (): (LocalTariff & { providerLabel: string; providerUrl: string })[] =>
  PROVIDERS.flatMap(p => p.tariffs.map(t => ({ ...t, current: t.priceMonth === CATALOGUE_MONTH_GEN, providerLabel: p.label, providerUrl: p.url })));

/**
 * Όσα μπορεί πράγματι να επιλέξει ο ιδιοκτήτης. ΑΥΤΑ συγκρίνονται.
 *
 * Τα φοιτητικά μένουν στον κατάλογο — υπάρχουν και ένας ιδιοκτήτης που ΕΙΝΑΙ
 * φοιτητής μπορεί να τα δηλώσει ως τρέχον τιμολόγιό του. Δεν προτείνονται όμως
 * ποτέ ως «καλύτερη επιλογή»: μια σύσταση που θα απορριφθεί στην αίτηση δεν
 * είναι σύσταση, είναι χαμένος χρόνος και χαμένη εμπιστοσύνη.
 */
export const COMPARABLE_TARIFFS = (): (LocalTariff & { providerLabel: string; providerUrl: string })[] =>
  ALL_TARIFFS().filter(t => !t.studentOnly && !t.settled && !t.notAvailable);

// ── REAL TARIFFS, SOURCE: bestenergydeals.gr / pricefox.gr / Selectra (June–July 2026) ──
// Τα πεδία που χρειάζεται ο ΥΠΟΛΟΓΙΣΜΟΣ ζουν στο lib/energy/tariff.ts. Εδώ
// προστίθενται μόνο όσα χρειάζεται η ΟΘΟΝΗ. Έτσι, όποιος αλλάξει τον τρόπο
// χρέωσης το κάνει σε ένα αρχείο που έχει tests, όχι μέσα σε ένα component.
// ΤΟ `as unknown as LocalTariff[]` ΗΤΑΝ ΓΡΑΜΜΕΝΟ ΕΝΤΕΚΑ ΦΟΡΕΣ, μία ανά πάροχο.
// Ο κανόνας του έργου το απαγορεύει και εδώ δεν έκρυβε καν λάθος δεδομένα:
// έκρυβε ότι ο κατάλογος ΔΕΝ ελεγχόταν καθόλου. Ένα τιμολόγιο με λάθος όνομα
// πεδίου (`kwh_tier_2` αντί `kwh_tier2`) ή με ξεχασμένο `vat` θα περνούσε τη
// μεταγλώττιση και θα έβγαζε λάθος σύγκριση κόστους στην οθόνη του ιδιοκτήτη.
// Με δηλωμένο τύπο στο ίδιο το PROVIDERS, κάθε ένα από τα εκατόν είκοσι
// τιμολόγια ελέγχεται πεδίο προς πεδίο.
export const PROVIDERS: ProviderGroup[] = [
  {
    value: 'dei', label: 'ΔΕΗ', url: 'https://www.dei.gr',
    tariffs: [
      // ══ Η ΠΕΡΙΓΡΑΦΗ ΕΛΕΓΕ ΑΛΛΟ ΠΑΓΙΟ ΑΠΟ ΑΥΤΟ ΠΟΥ ΥΠΟΛΟΓΙΖΟΤΑΝ ════════════
      // Το κείμενο έγραφε «Πάγιο 7,50€», το πεδίο κρατούσε 7,35 και η οθόνη
      // τυπώνει το πεδίο. Ο ιδιοκτήτης διάβαζε δύο νούμερα για το ίδιο πράγμα,
      // δύο γραμμές το ένα από το άλλο. Το 7,35 είναι η τιμή του Αυγούστου από
      // τη ΡΑΑΕΥ, όπως και όλος ο υπόλοιπος κατάλογος· το 7,50 ήταν υπόλειμμα
      // παλιότερης διόρθωσης που έμεινε μόνο μέσα στην πρόταση.
      //
      // ΚΑΙ Ο ΚΑΝΟΝΑΣ ΕΓΙΝΕ ΕΛΕΓΧΟΣ. Η περιγραφή δεν επαναλαμβάνει αριθμό που
      // η οθόνη δείχνει ήδη από το πεδίο: το πάγιο τυπώνεται μόνο του, οι δύο
      // κλίμακες επίσης. Το `tariff.test.ts` απαγορεύει πλέον σε περιγραφή να
      // αναφέρει τιμή ή πάγιο που δεν υπάρχει ως πεδίο.
      { id: 'dei_enter', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:137', name: 'myHome Enter', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.1421, kwh_night: null, fixed: 4.9, fixed_ebill: null, undiscounted: { day: 0.145, fixed: 5 }, conditions: { price: '2% έκπτωση για πληρωμή μέσω πάγιας εντολής', fixed: 'Πάγια Εντολή' }, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Σταθερή τιμή. Σύμβαση 12 μηνών.' },
      // FIX: πάγιο myHome EnterTwo αναπροσαρμόστηκε → 9,00€ (επιβεβαιωμένο, Ιούλιος 2026)
      { id: 'dei_entertwo', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:139', name: 'myHome EnterTwo', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.145, kwh_night: 0.095, fixed: 8, fixed_ebill: null, undiscounted: { day: 0.145, night: 0.095, fixed: 8 }, contract_months: 24, no_fixed: false, vat: 6, segment: 'residential', desc: 'Σταθερή τιμή. Σύμβαση 24 μηνών.' },
      // ══ ΣΕΠΤΕΜΒΡΙΟΣ 2026, ΑΠΟ ΤΑ ΤΙΜΟΛΟΓΙΑ ΤΗΣ ΔΕΗ ══════════════════════════
      // Πηγή: ops.handoffs a41bd5b2 (ομάδα Grok, P1-6, λήψη 28/09/2026), από τα
      // PDF της ΔΕΗ. Ο υπόλοιπος κατάλογος μένει στον έλεγχο του Αυγούστου· γι'
      // αυτό το data/price-sources.json γράφει τα τρία ξεχωριστά.
      //   myHome Online  https://www.dei.gr/media/fbqfayfk/myhome-online-0826.pdf (08.26)
      //     0,14200€ ανά kWh, αμετάβλητη· 0,11500 μετά την προωθητική έκπτωση
      //     0,02700. Η λήξη της προσφοράς δεν επιβεβαιώθηκε στο PDF και δεν
      //     γράφεται.
      { id: 'dei_online', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:147', name: 'myHome Online', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.142, kwh_night: 0.132, fixed: 3.5, fixed_ebill: null, promo_kwh_day: 0.115, undiscounted: { day: 0.142, night: 0.132, fixed: 3.5 }, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Σταθερή τιμή. Σύμβαση 12 μηνών.' },
      // FIX: κλιμάκια myHome Maxima αναπροσαρμόστηκαν 0.132/0.122 → 0.141/0.129 (επιβεβαιωμένο, Ιούλιος 2026)
      { id: 'dei_maxima', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:142', name: 'myHome Maxima', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.132, kwh_night: null, kwh_tier2: 0.122, tier2_threshold: 600, fixed: 12.9, fixed_ebill: null, undiscounted: { day: 0.132, tier2: 0.122, fixed: 12.9 }, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Σταθερή τιμή. Σύμβαση 12 μηνών.' },
      { id: 'dei_plan', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:140', settled: true, name: 'myHome Plan', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.145, kwh_night: null, flat_monthly: null, fixed: 5, fixed_ebill: null, undiscounted: { day: 0.145, fixed: 5 }, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Πληρώνεις 60€ τον μήνα έναντι και η ΔΕΗ εκκαθαρίζει την πραγματική κατανάλωση δύο φορές τον χρόνο, στον έκτο και στον δωδέκατο μήνα. Το μηνιαίο ποσό δεν είναι το κόστος σου και το τιμολόγιο δεν μπαίνει στη σύγκριση.' },
      { id: 'dei_4all', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:149', name: 'myHome 4All', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.243, kwh_night: 0.21752, kwh_tier2: 0.29788, tier2_threshold: 500, fixed: 4.9, fixed_ebill: null, undiscounted: { day: 0.2461, tier2: 0.3021, night: 0.2201, fixed: 5 }, conditions: { price: 'Πάγια Εντολή', fixed: 'Πάγια Εντολή' }, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Κυμαινόμενη τιμή. Σύμβαση 12 μηνών.' },
      { id: 'dei_4students', priceMonth: 'Αυγούστου 2026', raaey: 'power-residential:150', raaeyUnknown: true, studentOnly: true, name: 'myHome 4Students', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.11155, kwh_night: null, kwh_tier2: 0.185, tier2_threshold: 150, fixed: 2.91, fixed_ebill: 0, priceText: '0KWh - 150KWh / 0.11155 151KWh + / Η τιμή δεν είναι ακόμη γνωστή', contract_months: 12, vat: 6, segment: 'residential', desc: 'Φοιτητικό κλιμακωτό, με όριο τις 150 kWh τον μήνα. Bonus καλοκαίρι. Απαιτείται φοιτητική ιδιότητα.' },
      // ══ Γ1 ΚΑΙ Γ1Ν: ΚΛΙΜΑΚΩΤΑ, ΟΧΙ ΜΙΑ ΤΙΜΗ ═════════════════════════════════
      // Ο κατάλογος έγραφε μία τιμή για όλη την κατανάλωση: πάνω από τις 200
      // κιλοβατώρες η ΔΕΗ χρεώνει κάθε επιπλέον κιλοβατώρα ακριβότερα απ' όσο
      // υπολόγιζε ο κατάλογος.
      //
      // Πηγή: https://www.dei.gr/media/xjictous/g1_g1n_oct26.pdf (Οκτώβριος
      // 2026). Στήλη «με εμπρόθεσμη εξόφληση και ενεργό myΔΕΗ», μαζί με τον
      // μηχανισμό διακύμανσης. Πάγιο 5,00€ τον μήνα, αμετάβλητο.
      // ΧΩΡΙΣ `fixed_ebill`: η στήλη της προϋπόθεσης γράφει πάγιο 5,00€. Το 3,50€
      // είναι το πάγιο των myHome με e-bill και πάγια εντολή· εδώ η οθόνη
      // έδειχνε 3,50€ σε τιμολόγιο που δεν το δίνει.
      //   Γ1   0,14913 → 0,15913 έως 200 kWh, 0,18544 → 0,21997 πάνω
      //   Γ1Ν  ίδια ημερήσια κλιμάκια· νυχτερινή 0,14605 → 0,15590
      // Χωρίς τις δύο προϋποθέσεις: 0,17363 / 0,23717 / 0,16880, στο
      // `undiscounted`. ΔΕΝ μπαίνουν στον υπολογισμό: η σύγκριση τρέχει με την
      // τιμή που πληρώνει όποιος εξοφλεί εμπρόθεσμα, όπως σε κάθε άλλο τιμολόγιο
      // του καταλόγου με «έκπτωση συνέπειας».
      { id: 'dei_prasino', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:136', name: 'Γ1 Πράσινο', badge: 'ΠΡΑΣΙΝΟ', type: 'variable', kwh_day: 0.15913, kwh_night: null, kwh_tier2: 0.21997, tier2_threshold: 200, tier2_scope: 'all', fixed: 5, fixed_ebill: null, undiscounted: { day: 0.17363, tier2: 0.23717, fixed: 5 }, conditions: { price: 'Εμπρόθεσμη Εξόφληση και myΔΕΗ' }, contract_months: 0, no_fixed: false, vat: 6, segment: 'residential', desc: 'Ειδικό τιμολόγιο, η τιμή ανακοινώνεται κάθε 1η του μήνα. Αορίστου διάρκειας.' },
      { id: 'dei_prasino_n', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:136', name: 'Γ1Ν Πράσινο Νυχτερινό', badge: 'ΠΡΑΣΙΝΟ', type: 'variable', kwh_day: 0.15913, kwh_night: 0.1559, kwh_tier2: 0.21997, tier2_threshold: 200, tier2_scope: 'all', fixed: 5, fixed_ebill: null, undiscounted: { day: 0.17363, tier2: 0.23717, night: 0.1688, fixed: 5 }, conditions: { price: 'Εμπρόθεσμη Εξόφληση και myΔΕΗ' }, contract_months: 0, no_fixed: false, vat: 6, segment: 'residential', desc: 'Ειδικό τιμολόγιο, η τιμή ανακοινώνεται κάθε 1η του μήνα. Αορίστου διάρκειας.' },
      { id: 'dei_dynamic', priceMonth: 'Αυγούστου 2026',      name: 'myHome Dynamic',         badge: 'ΔΥΝΑΜΙΚΟ',type: 'dynamic',       kwh_day: 0, kwh_night: null, fixed: 5.00, smart_meter: true, contract_months: 0, vat: 6, segment: 'residential', desc: 'Ωριαία τιμολόγηση βάσει χονδρεμπορικής (HEnEx). Απαιτεί έξυπνο μετρητή ΔΕΔΔΗΕ.' },
      // ── Επαγγελματικά (Γ21/Γ22) ────────────────────────────────────────
      { id: 'dei_biz_4all', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-business:122', name: 'MyBussiness4ALL', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.25476, kwh_night: null, flat_monthly: null, fixed: 4.9, fixed_ebill: null, undiscounted: { day: 0.2581, fixed: 5 }, conditions: { price: 'Πάγια Εντολή', fixed: 'Πάγια Εντολή' }, contract_months: 12, no_fixed: false, vat: 6, segment: 'business', desc: 'Κυμαινόμενη τιμή. Σύμβαση 12 μηνών.' },
      { id: 'dei_biz_g21', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-business:118', name: 'Ειδικό Γ21', badge: 'ΠΡΑΣΙΝΟ', type: 'variable', kwh_day: 0.25437, kwh_night: null, flat_monthly: null, fixed: 5, fixed_ebill: null, undiscounted: { day: 0.25437, fixed: 5 }, contract_months: 0, no_fixed: false, vat: 6, segment: 'business', desc: 'Ειδικό τιμολόγιο, η τιμή ανακοινώνεται κάθε 1η του μήνα. Αορίστου διάρκειας.' },
    ],
  },
    {
    value: 'heron', label: 'Ήρων', url: 'https://www.heron.gr',
    tariffs: [
      // ── Σταθερά (Μπλε) ────────────────────────────────────────────────────
      { id: 'heron_blue_smart', priceMonth: 'Αυγούστου 2026', priceStatus: 'verified',   name: 'Blue Smart Home',              badge: 'ΜΠΛΕ',    type: 'fixed',    kwh_day: 0.1380, kwh_night: null, flat_monthly: null, fixed: 7.95,  fixed_ebill: 7.95, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Πάγιο 7,95€ έως τις 150 kWh / 15,90€ πάνω από τις 150 kWh. Έκπτωση Συνέπειας.' },
      { id: 'heron_blue_gen_max', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:210', name: 'Blue Generous Max Home', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.0945, kwh_night: null, flat_monthly: null, fixed: 9.9, fixed_ebill: null, undiscounted: { day: 0.189, fixed: 9.9 }, conditions: { price: 'Πληρωμή με συνέπεια' }, contract_months: 18, no_fixed: false, vat: 6, segment: 'residential', desc: 'Σταθερή τιμή. Σύμβαση 18 μηνών.' },
      { id: 'heron_blue_gen', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:208', name: 'Blue Generous Home', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.0936, kwh_night: null, flat_monthly: null, fixed: 9.5, fixed_ebill: null, undiscounted: { day: 0.117, fixed: 9.5 }, conditions: { price: 'Συνέπεια' }, contract_months: 6, no_fixed: false, vat: 6, segment: 'residential', desc: 'Σταθερή τιμή. Σύμβαση 6 μηνών.' },
      { id: 'heron_blue_simple', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:220', name: 'Blue Simple Home', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.158, kwh_night: null, flat_monthly: null, fixed: 15.9, fixed_ebill: null, undiscounted: { day: 0.158, fixed: 15.9 }, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Σταθερή τιμή. Σύμβαση 12 μηνών.' },
      // ── Κυμαινόμενα (Κίτρινα) ─────────────────────────────────────────────
      { id: 'heron_yellow_one', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:227', name: 'Yellow One Home', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.24382, kwh_night: null, flat_monthly: null, fixed: 5, fixed_ebill: null, undiscounted: { day: 0.26722, fixed: 5 }, conditions: { price: 'Συνέπεια' }, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Κυμαινόμενη τιμή. Σύμβαση 12 μηνών.' },
      { id: 'heron_yellow_free', priceStatus: 'retro', priceMonth: 'Αυγούστου 2026', raaey: 'power-residential:226', raaeyUnknown: true, name: 'Yellow Free Home', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.084, kwh_night: null, flat_monthly: null, fixed: 0, fixed_ebill: null, priceText: 'Η τιμή δεν είναι ακόμη γνωστή', contract_months: 12, no_fixed: true, vat: 6, segment: 'residential', desc: 'Χωρίς πάγιο. Τιμή συν ΜΔΚΑ. Απαιτείται πάγια εντολή.' },
      { id: 'heron_yellow_student', priceStatus: 'retro', priceMonth: 'Αυγούστου 2026', raaey: 'power-residential:228', raaeyUnknown: true, studentOnly: true, name: 'Yellow Free Student', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.084, kwh_night: null, flat_monthly: null, fixed: 0, fixed_ebill: null, priceText: 'Η τιμή δεν είναι ακόμη γνωστή', contract_months: 12, no_fixed: true, vat: 6, segment: 'residential', desc: 'Φοιτητικό. Χωρίς πάγιο. Δώρο 20€. Απαιτείται φοιτητική ταυτότητα ή ΑΜΚΑ.' },
      { id: 'heron_protect', priceMonth: 'Αυγούστου 2026', priceStatus: 'retro',        name: 'Protect Home',               badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.0825,  kwh_night: null, flat_monthly: null, fixed: 5.50,  fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Νέο τιμολόγιο. Τιμή 0,0825€ συν ΜΔΚΑ. Πάγιο 5,50€.' },
      { id: 'heron_happy_hour', priceMonth: 'Αυγούστου 2026', priceStatus: 'retro',     name: 'Happy Hour Home',            badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.0825,  kwh_night: null, flat_monthly: null, fixed: 5.50,  fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Νέο. 3 ώρες δωρεάν ρεύμα ημερησίως. Πάγιο 7€.' },
      // ── Πράσινο (Γ1 Ειδικό) ───────────────────────────────────────────────
      // Πηγή: https://heron.gr/energy/electricity/gia-to-spiti/basic-home/ (Οκτώβριος
      // 2026). Η τελική προμήθεια 0,14760 δεν άλλαξε· αλλάζει μόνο ο μήνας.
      // Ανάγνωση της ομάδας Grok στις 04/10/2026, οδηγία ιδιοκτήτη 04/10/2026.
      { id: 'heron_basic', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:207', name: 'Basic Home (Γ1 Πράσινο)', badge: 'ΠΡΑΣΙΝΟ', type: 'variable', kwh_day: 0.1476, kwh_night: null, flat_monthly: null, fixed: 5, fixed_ebill: null, undiscounted: { day: 0.27782, fixed: 5 }, conditions: { price: 'Συνέπεια' }, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Ειδικό τιμολόγιο, η τιμή ανακοινώνεται κάθε 1η του μήνα. Σύμβαση 12 μηνών.' },
      { id: 'heron_ena', priceMonth: 'Αυγούστου 2026',            name: 'Ε.ΝΑ (Virtual Net Metering)', badge: 'VNM',   type: 'vnm',      kwh_day: 0.1290,  kwh_night: null, flat_monthly: null, fixed: 7.00,  fixed_ebill: null, contract_months: 0, no_fixed: false, vat: 6, segment: 'residential', desc: 'Εικονική Καθαρή Μέτρηση. Συμμετοχή σε κοινό φωτοβολταϊκό. Χωρίς δέσμευση.' },
      // ── Επαγγελματικά ──────────────────────────────────────────────────
      { id: 'heron_blue_smart_biz', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-business:167', name: 'Blue Smart BUSINESS 2', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.158, kwh_night: null, kwh_tier2: 0.158, tier2_threshold: 150, flat_monthly: null, fixed: 7.95, fixed_ebill: null, fixed_tier2: 15.9, fixed_tier2_threshold: 150, undiscounted: { day: 0.268, tier2: 0.268, fixed: 7.95 }, conditions: { price: 'Συνέπεια Συνέπεια' }, contract_months: 12, no_fixed: false, vat: 6, segment: 'business', desc: 'Σταθερή τιμή. Σύμβαση 12 μηνών.' },
      { id: 'heron_blue_gen_max_biz', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-business:166', name: 'Blue Generous Max BUSINESS 4', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.165, kwh_night: null, flat_monthly: null, fixed: 13.9, fixed_ebill: null, undiscounted: { day: 0.278, fixed: 13.9 }, conditions: { price: 'Συνέπεια' }, contract_months: 18, no_fixed: false, vat: 6, segment: 'business', desc: 'Σταθερή τιμή. Σύμβαση 18 μηνών.' },
      { id: 'heron_protect_biz_s', priceStatus: 'retro', priceMonth: 'Αυγούστου 2026', raaey: 'power-business:177', raaeyUnknown: true, name: 'PROTECT 4 BUSINESS S', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0, kwh_night: null, flat_monthly: null, fixed: 5.5, fixed_ebill: null, priceText: 'Η τιμή δεν είναι ακόμη γνωστή', contract_months: 12, no_fixed: false, vat: 6, segment: 'business', desc: 'Η ΡΑΑΕΥ δεν έχει ακόμη την τιμή του Οκτωβρίου 2026. Γράψε τον λογαριασμό σου για να μπει στη σύγκριση.' },
      { id: 'heron_yellow_one_biz', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-business:182', name: 'Yellow One Business S 2', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.26142, kwh_night: null, flat_monthly: null, fixed: 5, fixed_ebill: null, undiscounted: { day: 0.28922, fixed: 5 }, conditions: { price: 'Συνέπεια' }, contract_months: 12, no_fixed: false, vat: 6, segment: 'business', desc: 'Κυμαινόμενη τιμή. Σύμβαση 12 μηνών.' },
      { id: 'heron_basic_biz_s', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-business:154', name: 'BASIC BUSINESS S', badge: 'ΠΡΑΣΙΝΟ', type: 'variable', kwh_day: 0.1778, kwh_night: null, flat_monthly: null, fixed: 5, fixed_ebill: null, undiscounted: { day: 0.28682, fixed: 5 }, conditions: { price: 'Συνέπεια' }, contract_months: 12, no_fixed: false, vat: 6, segment: 'business', desc: 'Ειδικό τιμολόγιο, η τιμή ανακοινώνεται κάθε 1η του μήνα. Σύμβαση 12 μηνών.' },
    ],
  },

  {
    value: 'protergia', label: 'Protergia', url: 'https://www.protergia.gr',
    tariffs: [
      { id: 'prot_flow', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:90', notAvailable: true, name: 'Value Flow', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.21914, kwh_night: null, fixed: 5, fixed_ebill: null, undiscounted: { day: 0.22914, fixed: 5 }, conditions: { price: 'Συνέπεια' }, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Κυμαινόμενη τιμή. Σύμβαση 12 μηνών.' },
      { id: 'prot_sure_18', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:75', name: 'Value Sure 18M 2.0', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.145, kwh_night: null, fixed: 11.9, fixed_ebill: null, undiscounted: { day: 0.259, fixed: 11.9 }, conditions: { price: 'Εμπρόθεσμη Πληρωμή με Συνέπεια.' }, contract_months: 18, no_fixed: false, vat: 6, segment: 'residential', desc: 'Σταθερή τιμή. Σύμβαση 18 μηνών.' },
      { id: 'prot_sure_12', priceMonth: 'Αυγούστου 2026',     name: 'Value Sure 12M',         badge: 'ΜΠΛΕ',    type: 'fixed',    kwh_day: 0.1520, kwh_night: null,  fixed: 5.00, contract_months: 12, vat: 6, segment: 'residential', desc: 'Σταθερό 12 μήνες.' },
      { id: 'prot_standard', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:83', name: 'Value Standard', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.1985, kwh_night: null, fixed: 5, fixed_ebill: null, undiscounted: { day: 0.2405, fixed: 5 }, conditions: { price: 'Συνέπεια' }, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Κυμαινόμενη τιμή. Σύμβαση 12 μηνών.' },
      // Πηγή: https://www.protergia.gr/spiti/oikiako-reuma-proionta/protergia-oikiako-value-special/
      // γραμμή 2026/ΟΚΤΩΒΡΙΟΣ, χωρίς ΦΠΑ, όπως όλος ο κατάλογος (ο ΦΠΑ 6% μπαίνει
      // από το `vat`). 0,184 μετά την έκπτωση συνέπειας, 0,267 πριν.
      { id: 'prot_value_special', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:69', name: 'Value Special', badge: 'ΠΡΑΣΙΝΟ', type: 'variable', kwh_day: 0.184, kwh_night: null, fixed: 5, fixed_ebill: null, undiscounted: { day: 0.267, fixed: 5 }, conditions: { price: 'Συνέπεια' }, contract_months: 0, no_fixed: false, vat: 6, segment: 'residential', desc: 'Ειδικό τιμολόγιο, η τιμή ανακοινώνεται κάθε 1η του μήνα. Αορίστου διάρκειας.' },
      { id: 'prot_lite2', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:92', name: 'Value Lite 2.0', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.24414, kwh_night: null, fixed: 0, fixed_ebill: null, undiscounted: { day: 0.24414, fixed: 0 }, contract_months: 12, no_fixed: true, vat: 6, segment: 'residential', desc: 'Κυμαινόμενη τιμή. Σύμβαση 12 μηνών.' },
      { id: 'prot_dynamic', priceMonth: 'Αυγούστου 2026',     name: 'Dynamic One Home',       badge: 'ΔΥΝΑΜΙΚΟ',type: 'dynamic',  kwh_day: 0,      kwh_night: null, fixed: 0,    smart_meter: true, contract_months: 0, vat: 6, segment: 'residential', desc: 'Ωριαία δυναμική τιμολόγηση. Ενεργοποιήθηκε Ιούνιο 2026.' },
      // ── Picasso 2.0, ΟΛΑ τα 9 πακέτα + Φοιτητικό ────────────────────────
      // FIX: πριν υπήρχαν μόνο 3/9 πακέτα, με λάθος segment:'business' (το Picasso
      // είναι οικιακό προϊόν) και type:'flat' που δεν υπολογιζόταν καθόλου σωστά.
      // Επιβεβαιωμένο: Protergia Picasso, Προϊόν Χρονιάς 2026, μπλε/σταθερό,
      // 12μηνη σύμβαση, 5% δωρεάν ανοχή υπέρβασης, υπέρβαση 0,169€/kWh,
      // ετήσια εκκαθάριση μέσω ΔΕΔΔΗΕ. (Πηγή: Selectra, protergia.gr, επιβεβαιωμένο screenshot)
      { id: 'prot_picasso_s1', priceMonth: 'Αυγούστου 2026', name: 'Picasso Small, 1.325 kWh/έτος',  badge: 'FLAT', type: 'fixed_monthly', kwh_day: 0, kwh_night: null, flat_monthly: 39.90,  flat_annual_kwh: 1325,  flat_overage_rate: 0.169, fixed: 0, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'All-in σταθερό μηνιαίο. Για ένα ή δύο άτομα, χαμηλές ανάγκες. Δώρο 5% επιπλέον kWh.' },
      { id: 'prot_picasso_s2', priceMonth: 'Αυγούστου 2026', name: 'Picasso Small, 1.875 kWh/έτος',  badge: 'FLAT', type: 'fixed_monthly', kwh_day: 0, kwh_night: null, flat_monthly: 49.90,  flat_annual_kwh: 1875,  flat_overage_rate: 0.169, fixed: 0, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'All-in σταθερό μηνιαίο. Για ένα ή δύο άτομα, χαμηλές ανάγκες. Δώρο 5% επιπλέον kWh.' },
      { id: 'prot_picasso_s3', priceMonth: 'Αυγούστου 2026', name: 'Picasso Small, 2.700 kWh/έτος',  badge: 'FLAT', type: 'fixed_monthly', kwh_day: 0, kwh_night: null, flat_monthly: 64.90,  flat_annual_kwh: 2700,  flat_overage_rate: 0.169, fixed: 0, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'All-in σταθερό μηνιαίο. Για ένα ή δύο άτομα, χαμηλές ανάγκες. Δώρο 5% επιπλέον kWh.' },
      { id: 'prot_picasso_m1', priceMonth: 'Αυγούστου 2026', name: 'Picasso Medium, 3.550 kWh/έτος', badge: 'FLAT', type: 'fixed_monthly', kwh_day: 0, kwh_night: null, flat_monthly: 82.90,  flat_annual_kwh: 3550,  flat_overage_rate: 0.169, fixed: 0, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'All-in σταθερό μηνιαίο. Για οικογένειες μέσου όρου κατανάλωσης. Δώρο 5% επιπλέον kWh.' },
      { id: 'prot_picasso_m2', priceMonth: 'Αυγούστου 2026', name: 'Picasso Medium, 4.600 kWh/έτος', badge: 'FLAT', type: 'fixed_monthly', kwh_day: 0, kwh_night: null, flat_monthly: 102.90, flat_annual_kwh: 4600,  flat_overage_rate: 0.169, fixed: 0, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'All-in σταθερό μηνιαίο. Για οικογένειες μέσου όρου κατανάλωσης. Δώρο 5% επιπλέον kWh.' },
      { id: 'prot_picasso_m3', priceMonth: 'Αυγούστου 2026', name: 'Picasso Medium, 6.000 kWh/έτος', badge: 'FLAT', type: 'fixed_monthly', kwh_day: 0, kwh_night: null, flat_monthly: 134.90, flat_annual_kwh: 6000,  flat_overage_rate: 0.169, fixed: 0, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'All-in σταθερό μηνιαίο. Για οικογένειες μέσου όρου κατανάλωσης. Δώρο 5% επιπλέον kWh.' },
      { id: 'prot_picasso_l1', priceMonth: 'Αυγούστου 2026', name: 'Picasso Large, 11.000 kWh/έτος', badge: 'FLAT', type: 'fixed_monthly', kwh_day: 0, kwh_night: null, flat_monthly: 259.90, flat_annual_kwh: 11000, flat_overage_rate: 0.169, fixed: 0, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'All-in σταθερό μηνιαίο. Για μεγάλες οικογένειες με αυξημένες ανάγκες. Δώρο 5% επιπλέον kWh.' },
      { id: 'prot_picasso_l2', priceMonth: 'Αυγούστου 2026', name: 'Picasso Large, 15.300 kWh/έτος', badge: 'FLAT', type: 'fixed_monthly', kwh_day: 0, kwh_night: null, flat_monthly: 359.90, flat_annual_kwh: 15300, flat_overage_rate: 0.169, fixed: 0, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'All-in σταθερό μηνιαίο. Για μεγάλες οικογένειες με αυξημένες ανάγκες. Δώρο 5% επιπλέον kWh.' },
      { id: 'prot_picasso_l3', priceMonth: 'Αυγούστου 2026', name: 'Picasso Large, 20.200 kWh/έτος', badge: 'FLAT', type: 'fixed_monthly', kwh_day: 0, kwh_night: null, flat_monthly: 479.90, flat_annual_kwh: 20200, flat_overage_rate: 0.169, fixed: 0, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'All-in σταθερό μηνιαίο. Για μεγάλες οικογένειες με αυξημένες ανάγκες. Δώρο 5% επιπλέον kWh.' },
      { id: 'prot_picasso_student', priceMonth: 'Αυγούστου 2026', studentOnly: true, name: 'Picasso Student', badge: 'FLAT', type: 'fixed_monthly', kwh_day: 0, kwh_night: null, flat_monthly: 39.90, flat_annual_kwh: 1325, flat_overage_rate: 0.169, fixed: 0, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Ίδιο πακέτο με Picasso Small, αποκλειστικά για φοιτητές. Απαιτείται φοιτητική ταυτότητα.' },
      // ── Επαγγελματικά ──────────────────────────────────────────────────
      { id: 'prot_simple_biz1', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-business:79', name: 'Επαγγελματικό 1 Value Simple 2.0', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.2191, kwh_night: null, flat_monthly: null, fixed: 5, fixed_ebill: null, undiscounted: { day: 0.2191, fixed: 5 }, contract_months: 12, no_fixed: false, vat: 6, segment: 'business', desc: 'Κυμαινόμενη τιμή. Σύμβαση 12 μηνών.' },
      { id: 'prot_sure_biz1', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-business:72', name: 'Επαγγελματικό 1 Value Sure 12Μ 3.0', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.169, kwh_night: null, flat_monthly: null, fixed: 13.9, fixed_ebill: null, undiscounted: { day: 0.269, fixed: 13.9 }, conditions: { price: 'Εμπρόθεσμη Πληρωμή.' }, contract_months: 12, no_fixed: false, vat: 6, segment: 'business', desc: 'Σταθερή τιμή. Σύμβαση 12 μηνών.' },
      { id: 'prot_sure_biz2', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-business:70', name: 'Επαγγελματικό 2 και 3 Value Sure 12Μ 2.0', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.1999, kwh_night: null, flat_monthly: null, fixed: 0, fixed_ebill: null, undiscounted: { day: 0.269, fixed: 0 }, conditions: { price: 'Εμπρόθεσμη Πληρωμή με Συνέπεια.' }, contract_months: 12, no_fixed: true, vat: 6, segment: 'business', desc: 'Σταθερή τιμή. Σύμβαση 12 μηνών.' },
    ],
  },
  {
    value: 'nrg', label: 'NRG', url: 'https://www.nrg.gr',
    tariffs: [
      { id: 'nrg_now', priceMonth: 'Αυγούστου 2026',          name: 'NRG Now Οικιακό',        badge: 'ΠΡΑΣΙΝΟ', type: 'variable', kwh_day: 0.1595, kwh_night: null, fixed: 6.90, contract_months: 0,  vat: 6, segment: 'residential', desc: 'Κυμαινόμενο. Χωρίς δέσμευση.' },
      // Πηγή: https://www.nrg.gr/el/idiotes/revma/eidiko-timologio-nrg
      // (Οκτώβριος 2026). 0,259 με την έκπτωση συνέπειας, 0,299 χωρίς.
      { id: 'nrg_special', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:41', name: 'Ειδικό Τιμολόγιο nrg', badge: 'ΠΡΑΣΙΝΟ', type: 'variable', kwh_day: 0.259, kwh_night: null, fixed: 5, fixed_ebill: null, undiscounted: { day: 0.299, fixed: 5 }, conditions: { price: 'συνέπεια' }, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Ειδικό τιμολόγιο, η τιμή ανακοινώνεται κάθε 1η του μήνα. Σύμβαση 12 μηνών.' },
      { id: 'nrg_adjust', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:51', name: 'NRG adjust 1.0', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.138, kwh_night: null, kwh_tier2: 0.138, tier2_threshold: 150, fixed: 7.95, fixed_ebill: null, fixed_tier2: 15.9, fixed_tier2_threshold: 150, undiscounted: { day: 0.268, tier2: 0.268, fixed: 7.95 }, conditions: { price: 'Εμπρόθεσμη Πληρωμή με Συνέπεια Εμπρόθεσμη Πληρωμή με Συνέπεια', fixed: '50% Έκπτωση Παγίου για καταναλώσεις έως 150kWh/μήνα' }, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Σταθερή τιμή. Σύμβαση 12 μηνών.' },
      // ── Επαγγελματικά ──────────────────────────────────────────────────
      { id: 'nrg_adjust_biz', priceMonth: 'Αυγούστου 2026', priceStatus: 'verified', name: 'nrg adjust 1.0 BUSINESS promo', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.149, kwh_night: null, flat_monthly: null, fixed: 7.95, fixed_ebill: null, fixed_tier2: 15.9, fixed_tier2_threshold: 150, contract_months: 12, no_fixed: false, vat: 6, segment: 'business', desc: 'Πάγιο 7,95€ έως τις 150 kWh τον μήνα, 15,90€ πάνω από αυτές. Η τιμή ισχύει με εμπρόθεσμη πληρωμή.' },
      { id: 'nrg_simple_biz', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-business:56', name: 'nrg simple 1.0 BUSINESS1', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.256, kwh_night: null, flat_monthly: null, fixed: 9.9, fixed_ebill: null, undiscounted: { day: 0.256, fixed: 9.9 }, contract_months: 0, no_fixed: false, vat: 6, segment: 'business', desc: 'Κυμαινόμενη τιμή. Αορίστου διάρκειας.' },
    ],
  },
  {
    value: 'zenith', label: 'Zenith', url: 'https://www.zenith.gr',
    tariffs: [
      // ── Οικιακά ────────────────────────────────────────────────────────
      { id: 'zen_fixed_1y', priceMonth: 'Αυγούστου 2026',  name: 'Power Home Fixed 1Y',     badge: 'ΜΠΛΕ',    type: 'fixed',    kwh_day: 0.1290, kwh_night: null, flat_monthly: null, fixed: 11.90, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Σταθερό 12 μηνών. Έκπτωση Συνέπειας από τον 1ο λογαριασμό. Δώρο κάρτα υγείας Ευ Ζην 150€.' },
      { id: 'zen_fixed_24', priceMonth: 'Αυγούστου 2026',  name: 'Power Home Fixed 24',     badge: 'ΜΠΛΕ',    type: 'fixed',    kwh_day: 0.1350, kwh_night: null, flat_monthly: null, fixed: 11.90, fixed_ebill: null, contract_months: 24, no_fixed: false, vat: 6, segment: 'residential', desc: 'Σταθερό 24 μηνών, κλειδωμένη τιμή 2 χρόνια. Δώρο κάρτα υγείας Ευ Ζην 150€.' },
      { id: 'zen_pair', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:187', name: 'Power Home Pair', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.138, kwh_night: null, flat_monthly: null, fixed: 14.9, fixed_ebill: null, undiscounted: { day: 0.238, fixed: 14.9 }, conditions: { price: 'Έκπτωση Συνέπειας' }, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Σταθερή τιμή. Σύμβαση 12 μηνών.' },
      { id: 'zen_sure_plus', priceMonth: 'Αυγούστου 2026', name: 'Power Home Sure Plus',    badge: 'ΜΠΛΕ',    type: 'fixed',    kwh_day: 0.1450, kwh_night: null, flat_monthly: null, fixed: 9.90,  fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Σταθερό πρόγραμμα ασφαλείας.' },
      { id: 'zen_select', priceMonth: 'Αυγούστου 2026', raaey: 'power-residential:197', raaeyUnknown: true, name: 'Power Home Select', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.149, kwh_night: null, flat_monthly: null, fixed: 5, fixed_ebill: null, priceText: 'Η τιμή δεν είναι ακόμη γνωστή', contract_months: 0, no_fixed: false, vat: 6, segment: 'residential', desc: 'Κίτρινο κυμαινόμενο. Χωρίς δέσμευση.' },
      { id: 'zen_save30', priceMonth: 'Αυγούστου 2026', raaey: 'power-residential:204', raaeyUnknown: true, name: 'Power Home Save 3.0', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.153, kwh_night: null, flat_monthly: null, fixed: 4, fixed_ebill: null, priceText: 'Η τιμή δεν είναι ακόμη γνωστή', contract_months: 0, no_fixed: false, vat: 6, segment: 'residential', desc: 'Κίτρινο κυμαινόμενο χαμηλό πάγιο.' },
      { id: 'zen_light', priceMonth: 'Αυγούστου 2026', raaey: 'power-residential:205', raaeyUnknown: true, name: 'Power Home Light', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.156, kwh_night: null, flat_monthly: null, fixed: 0, fixed_ebill: null, priceText: 'Η τιμή δεν είναι ακόμη γνωστή', contract_months: 0, no_fixed: true, vat: 6, segment: 'residential', desc: 'Χαμηλό πάγιο. Ιδανικό χαμηλή κατανάλωση.' },
      // FIX: τιμή αναπροσαρμόστηκε 0.1450 → 0.095 (επιβεβαιωμένο, Ιούνιος 2026), ισχύει για τις πρώτες 200 kWh/μήνα
      { id: 'zen_student', priceMonth: 'Αυγούστου 2026', raaey: 'power-residential:196', raaeyUnknown: true, studentOnly: true, name: 'Power Home Student', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.095, kwh_night: null, flat_monthly: null, fixed: 0, fixed_ebill: null, priceText: '0KWh - 200KWh / 0.095 201KWh + / Η τιμή δεν είναι ακόμη γνωστή', contract_months: 0, no_fixed: true, vat: 6, segment: 'residential', desc: 'Φοιτητικό. Τιμή 0,095€ ανά kWh για τις πρώτες 200 kWh τον μήνα, πάνω από αυτό ισχύει διαφορετική τιμή, επιβεβαίωσε στο zenith.gr πριν την ένταξη. Απαιτείται φοιτητική ταυτότητα.' },
      // Πηγή: https://zenith.gr/el/for-the-home/electricity/power-home-start/
      // (Οκτώβριος 2026). Πρώτες 100 kWh 0,225 (το 0,347 διαγραμμένο), από την
      // 101η 0,347, πάγιο 5€. Πριν: 0,1988 ενιαία, πάγιο 6,80€ (Αύγουστος). Η
      // σελίδα δεν γράφει αν η τιμή έχει ΦΠΑ· ο κατάλογος κρατά τον κοινό κανόνα.
      // Ανάγνωση της ομάδας Grok στις 04/10/2026, οδηγία ιδιοκτήτη 04/10/2026.
      { id: 'zen_start', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:171', name: 'Power Home Start (Ειδικό)', badge: 'ΠΡΑΣΙΝΟ', type: 'variable', kwh_day: 0.22501, kwh_night: null, kwh_tier2: 0.34701, tier2_threshold: 100, flat_monthly: null, fixed: 5, fixed_ebill: null, undiscounted: { day: 0.34701, tier2: 0.34701, fixed: 5 }, conditions: { price: 'Συνέπεια' }, contract_months: 0, no_fixed: false, vat: 6, segment: 'residential', desc: 'Ειδικό τιμολόγιο, η τιμή ανακοινώνεται κάθε 1η του μήνα. Αορίστου διάρκειας.' },
      // ── ZeΝergy, all-in πακέτα, ΟΛΑ τα 5 μεγέθη ─────────────────────────
      // FIX: πριν υπήρχε μόνο 1 πακέτο (49€). Επιβεβαιωμένο 5μελές σύστημα.
      // Ακριβή όρια kWh επιβεβαιωμένα μόνο για XS και XL, για S/M/L δες zenith.gr.
      { id: 'zen_zenergy_xs', priceMonth: 'Αυγούστου 2026', name: 'ZeΝergy XS, έως 2.000 kWh/έτος', badge: 'FLAT', type: 'fixed_monthly', kwh_day: 0, kwh_night: null, flat_monthly: 49.00,  flat_annual_kwh: 2000, fixed: 0, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'All-in σταθερό μηνιαίο. Μικρό μέγεθος κατανάλωσης.' },
      { id: 'zen_zenergy_s', priceMonth: 'Αυγούστου 2026',  name: 'ZeΝergy S',                       badge: 'FLAT', type: 'fixed_monthly', kwh_day: 0, kwh_night: null, flat_monthly: 69.00,  fixed: 0, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'All-in σταθερό μηνιαίο. Ακριβές όριο κατανάλωσης: δες zenith.gr.' },
      { id: 'zen_zenergy_m', priceMonth: 'Αυγούστου 2026',  name: 'ZeΝergy M',                       badge: 'FLAT', type: 'fixed_monthly', kwh_day: 0, kwh_night: null, flat_monthly: 90.00,  fixed: 0, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'All-in σταθερό μηνιαίο. Ακριβές όριο κατανάλωσης: δες zenith.gr.' },
      { id: 'zen_zenergy_l', priceMonth: 'Αυγούστου 2026',  name: 'ZeΝergy L',                       badge: 'FLAT', type: 'fixed_monthly', kwh_day: 0, kwh_night: null, flat_monthly: 137.00, fixed: 0, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'All-in σταθερό μηνιαίο. Ακριβές όριο κατανάλωσης: δες zenith.gr.' },
      { id: 'zen_zenergy_xl', priceMonth: 'Αυγούστου 2026', name: 'ZeΝergy XL, έως 12.000 kWh/έτος',badge: 'FLAT', type: 'fixed_monthly', kwh_day: 0, kwh_night: null, flat_monthly: 262.00, flat_annual_kwh: 12000, fixed: 0, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'All-in σταθερό μηνιαίο. Μεγάλο μέγεθος κατανάλωσης.' },
      // ── Επαγγελματικά ──────────────────────────────────────────────────
      { id: 'zen_biz_start', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-business:146', name: 'Power Business Direct', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.208, kwh_night: null, flat_monthly: null, fixed: 1, fixed_ebill: null, undiscounted: { day: 0.208, fixed: 1 }, contract_months: 12, no_fixed: false, vat: 6, segment: 'business', desc: 'Σταθερή τιμή. Σύμβαση 12 μηνών.' },
    ],
  },
  {
    value: 'elin', label: 'Elin', url: 'https://energy.elin.gr',
    tariffs: [
      // ── Οικιακά ────────────────────────────────────────────────────────
      // Πηγή: https://energy.elin.gr/media/oo5iuudf/anartisi_timon_power_on-home_green.pdf
      // Η γραμμή του Οκτωβρίου είναι κενή· τελευταίος γεμάτος μήνας ο Σεπτέμβριος
      // 2026, τελική 0,22536 ημέρα και νύχτα, πάγιο 5€. Πριν: 0,1640, πάγιο 7,10€.
      // Ανάγνωση της ομάδας Grok στις 04/10/2026, οδηγία ιδιοκτήτη 04/10/2026.
      { id: 'elin_power_green', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:152', name: 'Power On! Home Green', badge: 'ΠΡΑΣΙΝΟ', type: 'variable', kwh_day: 0.25265, kwh_night: null, flat_monthly: null, fixed: 5, fixed_ebill: null, undiscounted: { day: 0.25265, fixed: 5 }, contract_months: 0, no_fixed: false, vat: 6, segment: 'residential', desc: 'Ειδικό τιμολόγιο, η τιμή ανακοινώνεται κάθε 1η του μήνα. Αορίστου διάρκειας.' },
      { id: 'elin_blue', priceMonth: 'Αυγούστου 2026',        name: 'Home Blue Fixed',       badge: 'ΜΠΛΕ',    type: 'fixed',    kwh_day: 0.1480, kwh_night: null, flat_monthly: null, fixed: 9.90, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Σταθερό 12μηνο.' },
      // ── Επαγγελματικά ──────────────────────────────────────────────────
    ],
  },
  {
    value: 'volton', label: 'Volton', url: 'https://volton.gr',
    tariffs: [
      // ── Οικιακά ────────────────────────────────────────────────────────
      // Πηγή: https://volton.gr/gia-to-spiti/revma/volton-green-eidiko/ (Οκτώβριος
      // 2026). Χρέωση προμήθειας: βάση 0,1550, με 33% 0,1039, με 33% και 24%
      // συνέπεια 0,0789, πάγιο 4,90€. Οι «τελικές» 0,2986 και 0,2737 της σελίδας
      // περιέχουν και ρυθμιζόμενες χρεώσεις: δεν μπαίνουν στο πεδίο προμήθειας.
      // Η βάση 0,1550 δεν έχει πεδίο στον κατάλογο (δύο τιμές ανά τιμολόγιο).
      // Πριν: 0,1861 χωρίς πάγιο (Αύγουστος).
      // Ανάγνωση της ομάδας Grok στις 04/10/2026, οδηγία ιδιοκτήτη 04/10/2026.
      { id: 'volton_green', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:99', name: 'Volton Green Ειδικό', badge: 'ΠΡΑΣΙΝΟ', type: 'variable', kwh_day: 0.27369, kwh_night: null, flat_monthly: null, fixed: 4.9, fixed_ebill: null, undiscounted: { day: 0.29862, fixed: 4.9 }, contract_months: 0, no_fixed: false, vat: 6, segment: 'residential', desc: 'Ειδικό τιμολόγιο, η τιμή ανακοινώνεται κάθε 1η του μήνα. Αορίστου διάρκειας.' },
      { id: 'volton_blue', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:112', notAvailable: true, name: 'Volton Blue Flat 18M', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.14501, kwh_night: null, flat_monthly: null, fixed: 9.9, fixed_ebill: null, undiscounted: { day: 0.23, fixed: 18 }, conditions: { price: 'Έκπτωση συνέπειας 36.95%', fixed: 'Έκπτωση συνέπειας 45%' }, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Σταθερή τιμή. Σύμβαση 12 μηνών.' },
      // ── Επαγγελματικά ──────────────────────────────────────────────────
      { id: 'volton_yellow_biz', priceStatus: 'retro', priceMonth: 'Αυγούστου 2026', raaey: 'power-business:96', raaeyUnknown: true, name: 'Volton Yellow Simple Business 21 v3', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0, kwh_night: null, flat_monthly: null, fixed: 6.9, fixed_ebill: null, priceText: 'Η τιμή δεν είναι ακόμη γνωστή', contract_months: 12, no_fixed: false, vat: 6, segment: 'business', desc: 'Η ΡΑΑΕΥ δεν έχει ακόμη την τιμή του Οκτωβρίου 2026. Γράψε τον λογαριασμό σου για να μπει στη σύγκριση.' },
      { id: 'volton_blue_biz', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-business:94', name: 'Volton Blue Flat 18M Business 21 v2', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.15902, kwh_night: null, flat_monthly: null, fixed: 9.9, fixed_ebill: null, undiscounted: { day: 0.26, fixed: 18 }, conditions: { price: 'Έκπτωση συνέπειας 38.84%', fixed: 'Έκπτωση συνέπειας 45%' }, contract_months: 18, no_fixed: false, vat: 6, segment: 'business', desc: 'Σταθερή τιμή. Σύμβαση 18 μηνών.' },
      { id: 'volton_green_biz', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-business:87', name: 'Ειδικό Business', badge: 'ΠΡΑΣΙΝΟ', type: 'variable', kwh_day: 0.27369, kwh_night: null, flat_monthly: null, fixed: 4.9, fixed_ebill: null, undiscounted: { day: 0.29862, fixed: 4.9 }, contract_months: 0, no_fixed: false, vat: 6, segment: 'business', desc: 'Ειδικό τιμολόγιο, η τιμή ανακοινώνεται κάθε 1η του μήνα. Αορίστου διάρκειας.' },
    ],
  },
  {
    value: 'enerwave', label: 'Enerwave', url: 'https://www.enerwave.gr',
    tariffs: [
      // ── Οικιακά ────────────────────────────────────────────────────────
      { id: 'enrw_saver', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:28', name: 'Reward Saver', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.219, kwh_night: null, flat_monthly: null, fixed: 7.9, fixed_ebill: null, undiscounted: { day: 0.289, fixed: 7.9 }, conditions: { price: 'Έκπτωση Συνέπειας 0.070€/kWh' }, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Κυμαινόμενη τιμή. Σύμβαση 12 μηνών.' },
      { id: 'enrw_stable_max', priceMonth: 'Αυγούστου 2026',  name: 'Reward Stable Max',      badge: 'ΜΠΛΕ',    type: 'fixed',    kwh_day: 0.1390, kwh_night: null, flat_monthly: null, fixed: 12.90, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Φθηνότερο σταθερό 12 μηνών.' },
      { id: 'enrw_stable', priceMonth: 'Αυγούστου 2026',      name: 'Reward Stable',          badge: 'ΜΠΛΕ',    type: 'fixed',    kwh_day: 0.1690, kwh_night: null, flat_monthly: null, fixed: 12.90, fixed_ebill: null, contract_months: 18, no_fixed: false, vat: 6, segment: 'residential', desc: 'Σταθερό 18 μηνών.' },
      { id: 'enrw_stable_zero', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:17', name: 'Reward Stable Zero 12M', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.189, kwh_night: null, flat_monthly: null, fixed: 0, fixed_ebill: null, undiscounted: { day: 0.26, fixed: 0 }, conditions: { price: 'Έκπτωση συνέπειας 0.071€/kWh' }, contract_months: 12, no_fixed: true, vat: 6, segment: 'residential', desc: 'Σταθερή τιμή. Σύμβαση 12 μηνών.' },
      { id: 'enrw_smart', priceMonth: 'Αυγούστου 2026', raaey: 'power-residential:20', raaeyUnknown: true, name: 'Smart', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.14504, kwh_night: null, flat_monthly: null, fixed: 5, fixed_ebill: null, priceText: 'Η τιμή δεν είναι ακόμη γνωστή', contract_months: 0, no_fixed: false, vat: 6, segment: 'residential', desc: 'Κυμαινόμενο smart πρόγραμμα.' },
      { id: 'enrw_smart_zero', priceMonth: 'Αυγούστου 2026', raaey: 'power-residential:22', raaeyUnknown: true, name: 'Smart Zero', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.15914, kwh_night: null, flat_monthly: null, fixed: 0, fixed_ebill: null, priceText: 'Η τιμή δεν είναι ακόμη γνωστή', contract_months: 0, no_fixed: true, vat: 6, segment: 'residential', desc: 'Κυμαινόμενο χωρίς πάγιο.' },
      { id: 'enrw_night', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:29', name: 'Reward Night Saver', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.249, kwh_night: 0.139, flat_monthly: null, fixed: 7.9, fixed_ebill: null, undiscounted: { day: 0.319, night: 0.209, fixed: 7.9 }, conditions: { price: 'Έκπτωση Συνέπειας 0.070€/kWh', fixed: '0' }, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Κυμαινόμενη τιμή. Σύμβαση 12 μηνών.' },
      // Πηγή: https://www.enerwave.gr/el/gia-to-spiti/revma/eidiko-timologio-oikiako_133075/
      // (Οκτώβριος 2026, χωρίς ΦΠΑ). 0,179 οι πρώτες 100 kWh, 0,339 από την 101η,
      // πάγιο 5€. Υποσημείωση της σελίδας: έκπτωση βάσης 0,16697 στις πρώτες 100
      // και 0,00697 στις υπόλοιπες, ήδη μέσα στις δύο τιμές. Πριν: 0,159 / 0,2155.
      // Ανάγνωση της ομάδας Grok στις 04/10/2026, οδηγία ιδιοκτήτη 04/10/2026.
      { id: 'enrw_special', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:2', name: 'Ειδικό Οικιακό', badge: 'ΠΡΑΣΙΝΟ', type: 'variable', kwh_day: 0.179, kwh_night: null, kwh_tier2: 0.339, tier2_threshold: 100, flat_monthly: null, fixed: 5, fixed_ebill: null, undiscounted: { day: 0.179, tier2: 0.339, fixed: 5 }, contract_months: 0, no_fixed: false, vat: 6, segment: 'residential', desc: 'Ειδικό τιμολόγιο, η τιμή ανακοινώνεται κάθε 1η του μήνα. Αορίστου διάρκειας.' },
      // ── Επαγγελματικά ──────────────────────────────────────────────────
      { id: 'enrw_saver_biz', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-business:30', name: 'Reward Saver for Business', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.259, kwh_night: null, flat_monthly: null, fixed: 0, fixed_ebill: null, undiscounted: { day: 0.329, fixed: 0 }, conditions: { price: 'Έκπτωση Συνέπειας 0.070€/kWh', fixed: '0' }, contract_months: 12, no_fixed: true, vat: 6, segment: 'business', desc: 'Κυμαινόμενη τιμή. Σύμβαση 12 μηνών.' },
      { id: 'enrw_stable_biz', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-business:20', name: 'Reward Stable 2.0 for Business Γ21', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.149, kwh_night: null, flat_monthly: null, fixed: 14.9, fixed_ebill: null, undiscounted: { day: 0.26, fixed: 14.9 }, conditions: { price: 'Έκπτωση συνέπειας 0.111€/kWh' }, contract_months: 12, no_fixed: false, vat: 6, segment: 'business', desc: 'Σταθερή τιμή. Σύμβαση 12 μηνών.' },
      { id: 'enrw_special_biz', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-business:2', name: 'Ειδικό Γ21', badge: 'ΠΡΑΣΙΝΟ', type: 'variable', kwh_day: 0.179, kwh_night: null, kwh_tier2: 0.339, tier2_threshold: 100, flat_monthly: null, fixed: 5, fixed_ebill: null, undiscounted: { day: 0.179, tier2: 0.339, fixed: 5 }, contract_months: 0, no_fixed: false, vat: 6, segment: 'business', desc: 'Ειδικό τιμολόγιο, η τιμή ανακοινώνεται κάθε 1η του μήνα. Αορίστου διάρκειας.' },
      // ── My Wave Daily Business, ΟΛΑ τα 5 μεγέθη ─────────────────────────
      // FIX: πριν υπήρχε μόνο 1 μη-ρεαλιστικό πακέτο (65€, καμία αντιστοιχία).
      // Επιβεβαιωμένο πλήρες σύστημα 5 μεγεθών με ημερήσια χρέωση, ετήσιο όριο kWh
      // και ακριβή τιμή υπέρβασης ανά μέγεθος. Μηνιαίο = ημερήσια τιμή × 30.
      { id: 'enrw_wave_1', priceMonth: 'Αυγούστου 2026',   name: 'My Wave Daily 1€/ημέρα, έως 1.920 kWh/έτος', badge: 'FLAT', type: 'fixed_monthly', kwh_day: 0, kwh_night: null, flat_monthly: 30.00, flat_annual_kwh: 1920,  flat_overage_rate: 0.239, fixed: 0, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'business', desc: 'Συνδρομητικό 1€ την ημέρα, περίπου 30€ τον μήνα. Υπέρβαση 0,239€ ανά kWh.' },
      { id: 'enrw_wave_15', priceMonth: 'Αυγούστου 2026',  name: 'My Wave Daily 1,5€/ημέρα, έως 3.000 kWh/έτος', badge: 'FLAT', type: 'fixed_monthly', kwh_day: 0, kwh_night: null, flat_monthly: 45.00, flat_annual_kwh: 3000,  flat_overage_rate: 0.229, fixed: 0, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'business', desc: 'Συνδρομητικό 1,5€ την ημέρα, περίπου 45€ τον μήνα. Υπέρβαση 0,229€ ανά kWh.' },
      { id: 'enrw_wave_2', priceMonth: 'Αυγούστου 2026',   name: 'My Wave Daily 2€/ημέρα, έως 4.200 kWh/έτος', badge: 'FLAT', type: 'fixed_monthly', kwh_day: 0, kwh_night: null, flat_monthly: 60.00, flat_annual_kwh: 4200,  flat_overage_rate: 0.219, fixed: 0, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'business', desc: 'Συνδρομητικό 2€ την ημέρα, περίπου 60€ τον μήνα. Υπέρβαση 0,219€ ανά kWh.' },
      { id: 'enrw_wave_25', priceMonth: 'Αυγούστου 2026',  name: 'My Wave Daily 2,5€/ημέρα, έως 5.400 kWh/έτος', badge: 'FLAT', type: 'fixed_monthly', kwh_day: 0, kwh_night: null, flat_monthly: 75.00, flat_annual_kwh: 5400,  flat_overage_rate: 0.209, fixed: 0, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'business', desc: 'Συνδρομητικό 2,5€ την ημέρα, περίπου 75€ τον μήνα. Υπέρβαση 0,209€ ανά kWh.' },
      { id: 'enrw_wave_3', priceMonth: 'Αυγούστου 2026',   name: 'My Wave Daily 3€/ημέρα, έως 6.600 kWh/έτος', badge: 'FLAT', type: 'fixed_monthly', kwh_day: 0, kwh_night: null, flat_monthly: 90.00, flat_annual_kwh: 6600,  flat_overage_rate: 0.199, fixed: 0, fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'business', desc: 'Συνδρομητικό 3€ την ημέρα, περίπου 90€ τον μήνα. Υπέρβαση 0,199€ ανά kWh.' },
    ],
  },
  {
    value: 'wattvolt', label: 'Watt+Volt (πλέον Protergia)', url: 'https://www.protergia.gr',
    tariffs: [
      // ── Οικιακά ────────────────────────────────────────────────────────
      { id: 'wv_home_standard', priceMonth: 'Αυγούστου 2026', priceStatus: 'retro', name: 'Home Standard',          badge: 'ΚΙΤΡΙΝΟ', type: 'variable', kwh_day: 0.1480, kwh_night: null, flat_monthly: null, fixed: 5.00,  fixed_ebill: null, contract_months: 0,  no_fixed: false, vat: 6, segment: 'residential', desc: 'Κυμαινόμενο βασικό, συν ΜΔΚΑ. Χωρίς δέσμευση. Επιβεβαίωσε τρέχουσα τιμή στο watt-volt.gr.' },
      { id: 'wv_home_blue', priceMonth: 'Αυγούστου 2026',     name: 'Home Blue Σταθερό 12M',  badge: 'ΜΠΛΕ',    type: 'fixed',    kwh_day: 0.1450, kwh_night: null, flat_monthly: null, fixed: 9.90,  fixed_ebill: null, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Σταθερό 12μηνο. Τελευταία γνωστή ένδειξη, επιβεβαίωσε τρέχουσα τιμή/όρους.' },
      { id: 'wv_home_special', priceMonth: 'Αυγούστου 2026',  name: 'Home Ειδικό (Γ1)',       badge: 'ΠΡΑΣΙΝΟ', type: 'variable', kwh_day: 0.1650, kwh_night: null, flat_monthly: null, fixed: 5.00,  fixed_ebill: null, contract_months: 0,  no_fixed: false, vat: 6, segment: 'residential', desc: 'Ειδικό Γ1. Ανακοινώνεται κάθε 1η του μήνα.' },
      // ── Επαγγελματικά ──────────────────────────────────────────────────
    ],
  },
  {
    value: 'eunice', label: 'Eunice Power', url: 'https://eunice-power.gr',
    tariffs: [
      // ── Οικιακά (100% καθαρή ενέργεια από ΑΠΕ) ─────────────────────────
      { id: 'eun_home_core', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:33', name: 'Home Core', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.098, kwh_night: null, flat_monthly: null, fixed: 7, fixed_ebill: null, undiscounted: { day: 0.199, fixed: 7 }, conditions: { price: 'Έκπτωση Συνέπειας' }, contract_months: 12, no_fixed: false, vat: 6, segment: 'residential', desc: 'Σταθερή τιμή. Σύμβαση 12 μηνών.' },
      { id: 'eun_home_special', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-residential:30', name: 'Ειδικό Τιμολόγιο Home', badge: 'ΠΡΑΣΙΝΟ', type: 'variable', kwh_day: 0.25652, kwh_night: null, flat_monthly: null, fixed: 5, fixed_ebill: null, undiscounted: { day: 0.25652, fixed: 5 }, conditions: { price: '256.53' }, contract_months: 0, no_fixed: false, vat: 6, segment: 'residential', desc: 'Ειδικό τιμολόγιο, η τιμή ανακοινώνεται κάθε 1η του μήνα. Αορίστου διάρκειας.' },
      // ── Επαγγελματικά ──────────────────────────────────────────────────
      { id: 'eun_biz_secure', priceStatus: 'verified', priceMonth: 'Οκτωβρίου 2026', raaey: 'power-business:39', name: 'Small Business Secure', badge: 'ΜΠΛΕ', type: 'fixed', kwh_day: 0.165, kwh_night: null, flat_monthly: null, fixed: 4, fixed_ebill: null, undiscounted: { day: 0.19, fixed: 4 }, conditions: { price: 'Έκπτωση Συνέπειας' }, contract_months: 12, no_fixed: false, vat: 6, segment: 'business', desc: 'Σταθερή τιμή. Σύμβαση 12 μηνών.' },
    ],
  },
  {
    value: 'fysiko_aerio', label: 'Φυσικό αέριο Ελλάδος', url: 'https://www.fysikoaerioellados.gr',
    tariffs: [
      { id: 'fa_oikia', priceMonth: 'Αυγούστου 2026',         name: 'Oikia Green',            badge: 'ΠΡΑΣΙΝΟ', type: 'variable', kwh_day: 0.14265, kwh_night: null, fixed: 5.00, contract_months: 0, vat: 6, segment: 'residential', desc: 'Κυμαινόμενο. Ανακοινώνεται κάθε 1η μήνα.' },
    ],
  },
  // Δύο πάροχοι που υπάρχουν μόνο στον πίνακα της ΡΑΑΕΥ (Οκτώβριος 2026). Τα
  // τιμολόγιά τους μπαίνουν από το addRaaeyPower· η ΡΑΑΕΥ δεν δίνει τη σελίδα
  // τους και δεν τη μαντεύουμε, οπότε ο σύνδεσμος οδηγεί στον ίδιο τον πίνακα.
  {
    value: 'ote_estate', label: 'OTE ESTATE', url: 'https://energycost.gr/',
    tariffs: [],
  },
  {
    value: 'solar_energy', label: 'SOLAR ENERGY', url: 'https://energycost.gr/',
    tariffs: [],
  },
];
// Τα τιμολόγια του πίνακα της ΡΑΑΕΥ που δεν υπήρχαν, στους παρόχους τους.
addRaaeyPower(PROVIDERS);
