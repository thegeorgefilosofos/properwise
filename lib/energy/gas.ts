// ═══════════════════════════════════════════════════════════════════════════
// Ο ΚΑΤΑΛΟΓΟΣ ΤΙΜΟΛΟΓΙΩΝ ΦΥΣΙΚΟΥ ΑΕΡΙΟΥ, ΑΠΟ ΤΗ ΡΑΑΕΥ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΑΝΤΙΚΑΤΕΣΤΗΣΕ ΚΑΙ ΓΙΑΤΙ ΗΤΑΝ ΕΠΕΙΓΟΝ. Ο προηγούμενος κατάλογος ζούσε
// μέσα στο `BillsGas.tsx` με 23 τιμολόγια. Μετρήθηκε γραμμή προς γραμμή απέναντι
// στον επίσημο πίνακα της ΡΑΑΕΥ και βρέθηκαν τρία διαφορετικά σφάλματα:
//
//   1. ΤΙΜΕΣ 30 ΕΩΣ 40% ΧΑΜΗΛΟΤΕΡΕΣ. «Αέριο Οικιακό Πλήρες» 0,0420 έναντι
//      0,06879€/kWh, «Κουζίνα» 0,0450 έναντι 0,06879. Σε 1.200 kWh τον μήνα η
//      οθόνη υποσχόταν λογαριασμό μικρότερο κατά 32€ από τον πραγματικό.
//   2. ΟΝΟΜΑΤΑ ΠΡΟΪΟΝΤΩΝ ΠΟΥ ΔΕΝ ΥΠΑΡΧΟΥΝ. «ΗΡΩΝ Gas Σταθερό», «myHome Φυσικό
//      αέριο», «Gas Home Flex»: κανένα δεν βρίσκεται στον κατάλογο της Αρχής.
//      Ο ιδιοκτήτης θα ζητούσε από τον πάροχο τιμολόγιο με ανύπαρκτο όνομα.
//   3. ΨΕΥΔΗΣ ΣΗΜΑΝΣΗ ΕΠΑΛΗΘΕΥΣΗΣ. Το `fae_extra` έφερε `priceStatus: 'verified'`
//      ενώ απείχε 40% από την πραγματική τιμή. Η σήμανση αξιοπιστίας έλεγε ψέματα
//      ακριβώς εκεί που ο χρήστης την κοιτούσε για να εμπιστευτεί τον αριθμό.
//
// Η ΠΗΓΗ. Το εργαλείο σύγκρισης τιμών της ΡΑΑΕΥ (energycost.gr), κατάσταση
// Αυγούστου 2026, οικιακά και επαγγελματικά τιμολόγια αερίου. Η ίδια η Αρχή
// δηλώνει: «Ολες οι αναρτημένες τιμές έχουν ελεγχθεί από τη ΡΑΑΕΥ».
//
// ΤΙ ΑΚΡΙΒΩΣ ΕΙΝΑΙ Ο ΑΡΙΘΜΟΣ ΠΟΥ ΑΠΟΘΗΚΕΥΕΤΑΙ. Μόνο η ΧΡΕΩΣΗ ΠΡΟΜΗΘΕΙΑΣ, το
// ανταγωνιστικό σκέλος. Μετρήθηκε: η στήλη «Τελική Μηνιαία Χρέωση» της ΡΑΑΕΥ
// ισούται ακριβώς με `πάγιο + τιμή × kWh` σε 38 από 38 οικιακά τιμολόγια και σε
// 14 από 14 επαγγελματικά. Αρα δεν περιέχει ούτε ρυθμιζόμενες χρεώσεις δικτύου,
// ούτε ΕΦΚ, ούτε ΦΠΑ 6%: ο πραγματικός λογαριασμός βγαίνει αισθητά υψηλότερος
// και η οθόνη το λέει ρητά.
//
// ΤΟ `raaey100` ΕΙΝΑΙ Η ΑΠΟΔΕΙΞΗ ΤΗΣ ΜΕΤΑΓΡΑΦΗΣ. Κάθε γραμμή κουβαλά το σύνολο
// που δημοσιεύει η ΡΑΑΕΥ για 100 kWh. Το `gas.test.ts` ξαναφτιάχνει τον αριθμό
// από το πάγιο και την τιμή: ένα λάθος ψηφίο σε οποιαδήποτε από τις 57 γραμμές
// ρίχνει τον έλεγχο αμέσως, αντί να ζήσει σιωπηλά στην οθόνη ενός ιδιοκτήτη.
//
// ΓΙΑΤΙ ΕΦΥΓΕ Η ΣΗΜΑΝΣΗ ΑΞΙΟΠΙΣΤΙΑΣ ΑΝΑ ΤΙΜΗ. Και οι 57 γραμμές προέρχονται από
// την ίδια λήψη της ίδιας ημέρας. Τρεις διαφορετικές ετικέτες πάνω σε ταυτόσημης
// προέλευσης δεδομένα δεν πρόσθεταν πληροφορία, πρόσθεταν θόρυβο. Η ημερομηνία
// λέγεται μία φορά, στην κεφαλίδα της οθόνης.
//
// ΓΙΑΤΙ ΕΦΥΓΕ Ο ΤΥΠΟΣ TTF. Τρία τιμολόγια nrg υπολογίζονταν από
// `πολλαπλασιαστής × TTF + περιθώριο`, με προεπιλεγμένο TTF 33€/MWh. Η ΡΑΑΕΥ
// δημοσιεύει την πραγματική τιμή του μήνα για τα ίδια ακριβώς τιμολόγια: το
// 0,06707€/kWh του `nrg on time GAS` αντιστοιχεί σε TTF περίπου 49,5€/MWh.
// Με την προεπιλογή των 33 η οθόνη έβγαζε 0,0489, δηλαδή 27% χαμηλότερα·
// κατέτασσε το τιμολόγιο ψηλότερα από όσο του αναλογεί. Ενας υπολογισμός που
// διαφωνεί με τη δημοσιευμένη τιμή του ίδιου προϊόντος δεν είναι διαφάνεια.
// ═══════════════════════════════════════════════════════════════════════════

// ══ ΟΚΤΩΒΡΙΟΣ 2026 ═══════════════════════════════════════════════════════
// Ο κατάλογος ενημερώθηκε από τον πίνακα της ΡΑΑΕΥ της 05.10.2026
// (data/raaey/energycost-2026-10.json). Όσα τιμολόγια βρέθηκαν κουβαλούν
// `raaey` και τις τιμές του Οκτωβρίου, όσα έλειπαν προστίθενται από το
// lib/energy/raaeyCatalogue.ts. Το `raaey100` μένει μόνο σε όσα κρατούν
// τιμή Αυγούστου: ο πίνακας του Οκτωβρίου δεν δίνει σύνολο στις 100 kWh, η
// μεταγραφή του ελέγχεται κελί προς κελί από το raaey.test.ts.

import { addRaaeyGas, RAAEY_MONTH_GEN, RAAEY_READ_AT } from './raaeyCatalogue';
import { PRICE_FACTS, asOfDate } from '@/lib/facts/prices';
import { joinGreek } from '@/lib/loans/energyPrograms';

/** Ο μήνας του πίνακα της ΡΑΑΕΥ σε γενική. Μόνο τιμές αυτού του μήνα κατατάσσονται. */
export const GAS_MONTH_GEN = RAAEY_MONTH_GEN;

/** Ημέρα της τελευταίας ενημέρωσης τιμών, από τον κατάλογο τιμών (lib/facts/prices.ts). */
export const GAS_VERIFIED = PRICE_FACTS.gas.checkedAt;
/** Ο μήνας των τιμών του πίνακα. */
export const GAS_LABEL = PRICE_FACTS.gas.period;
/** Κατώφλι παλαιότητας: τα τιμολόγια αερίου ανακοινώνονται μηνιαία. */
export const GAS_MAX_AGE_DAYS = PRICE_FACTS.gas.maxAgeDays;

export interface GasTariff {
  id: string;
  name: string;
  /** ΜΠΛΕ: σταθερή τιμή για τη διάρκεια. ΚΙΤΡΙΝΟ: κυμαινόμενη, αναθεωρείται μηνιαία. */
  badge: 'ΜΠΛΕ' | 'ΚΙΤΡΙΝΟ';
  type: 'fixed' | 'variable';
  segment: 'residential' | 'business';
  /**
   * Χρέωση προμήθειας €/kWh, όπως τη δημοσιεύει η ΡΑΑΕΥ, με την έκπτωση της
   * προϋπόθεσης όπου υπάρχει. `null`: «Η τιμή δεν είναι ακόμα γνωστή». Όπου
   * υπάρχει `providerPrice`, η τιμή είναι του εγγράφου του παρόχου.
   */
  kwh: number | null;
  /** Μηνιαίο πάγιο €, με την έκπτωση της προϋπόθεσης όπου υπάρχει. */
  fixed: number;
  /** Διάρκεια δέσμευσης σε μήνες, όπου ορίζεται. */
  contract_months?: number;
  /** Το σύνολο της ΡΑΑΕΥ στις 100 kWh, μόνο στις τιμές Αυγούστου που ελέγχει. */
  raaey100?: number;
  /** Ο μήνας της τιμής σε γενική: «Οκτωβρίου 2026». */
  priceMonth?: string;
  /** Οι τιμές χωρίς τις προϋποθέσεις, για την οθόνη. */
  undiscounted?: { kwh: number | null; fixed: number };
  /** Οι προϋποθέσεις της έκπτωσης, όπως τις γράφει η ΡΑΑΕΥ. */
  conditions?: { price?: string; fixed?: string };
  /** Η γραμμή του πίνακα της ΡΑΑΕΥ: «gas-residential:30». */
  raaey?: string;
  /** Η ΡΑΑΕΥ το γράφει «μη εμπορικά διαθέσιμο»: δεν προτείνεται. */
  notAvailable?: boolean;
  /**
   * Η ΡΑΑΕΥ δεν έχει ακόμη τιμή για τον μήνα του πίνακα. Μένει η προηγούμενη,
   * με τον μήνα της, εκτός αν υπάρχει `providerPrice`: τότε η τιμή είναι του
   * μήνα του πίνακα, από τον τιμοκατάλογο του παρόχου.
   */
  raaeyUnknown?: boolean;
  /**
   * Η ΤΙΜΗ ΕΙΝΑΙ ΤΟΥ ΠΑΡΟΧΟΥ, ΟΧΙ ΤΗΣ ΡΑΑΕΥ: το έγγραφο, η ημέρα ανάγνωσης
   * και το κελί από το οποίο αντιγράφηκε.
   *
   * Μόνο σε γραμμή με `raaeyUnknown`: η ΡΑΑΕΥ δεν έχει ακόμη τιμή για τον
   * μήνα του πίνακα και ο πάροχος τη γράφει σε δικό του τιμοκατάλογο. Ως τις
   * 12/10/2026 κάθε τιμή του καταλόγου ήταν της ΡΑΑΕΥ και η οθόνη το έλεγε για
   * όλα μαζί («Και τα N τιμολόγια είναι όπως τα δημοσιεύει η ΡΑΑΕΥ», με την
   * ημέρα του πίνακα). Μια τιμή παρόχου χωρίς σήμανση θα έκανε την πρόταση
   * ψευδή. Με το πεδίο η οθόνη μετρά πόσα είναι και γράφει την πηγή τους
   * στην κεφαλίδα, στη γραμμή ενημέρωσης και στη γραμμή του καθενός.
   *
   * `cell` και `category` είναι το κελί και η κατηγορία όπως τα γράφει το
   * έγγραφο. Δεν υπάρχει γραμμή της ΡΑΑΕΥ να ξαναβγάλει την τιμή, οπότε το
   * gas.test.ts ελέγχει ότι το `kwh` είναι ο αριθμός του κελιού και ότι η
   * σημείωση λέει την ίδια κατηγορία.
   */
  providerPrice?: { url: string; readAt: string; category: string; cell: string };
  /**
   * Η σημείωση της ΡΑΑΕΥ για το τιμολόγιο, αυτούσια.
   *
   * ΠΡΟΑΙΡΕΤΙΚΗ ΕΠΙΤΗΔΕΣ. Εξι από τα 57 τιμολόγια δεν φέρουν σημείωση στον
   * πίνακα της Αρχής. Η πρώτη εκδοχή απαιτούσε πεδίο πάντα, οπότε θα έπρεπε να
   * γραφτεί κείμενο που δεν υπάρχει σε καμία πηγή. Η οθόνη δείχνει τη γραμμή
   * μόνο όταν υπάρχει κάτι να ειπωθεί.
   */
  desc?: string;
}

export interface GasProvider {
  value: string;
  label: string;
  url: string;
  tariffs: GasTariff[];
}

// ── Διαχειριστές δικτύου ανά περιοχή ─────────────────────────────────────────
// Το δίκτυο δεν αλλάζει με τον πάροχο: μπαίνει εδώ γιατί είναι σταθερό δεδομένο
// της χώρας, όχι επιλογή της οθόνης.
export const NETWORK_OPERATORS = [
  { value: 'eda_attikis', label: 'ΕΔΑ Αττικής', region: 'Αττική', url: 'https://www.edaattikis.gr' },
  { value: 'eda_thess',   label: 'ΕΔΑ ΘΕΣΣ',    region: 'Θεσσαλονίκη / Θεσσαλία', url: 'https://www.edathess.gr' },
  { value: 'deda',        label: 'ΔΕΔΑ',        region: 'Λοιπή Ελλάδα', url: 'https://deda.gr' },
];

/**
 * Ο τιμοκατάλογος ιδιωτών της ΦΑΕ για τον Οκτώβριο 2026 («Τιμές Ιδιώτες
 * Οκτώβριος 2026», PDF του παρόχου), όπως τον διάβασε η ομάδα αγοράς στις
 * 12/10/2026 (χάρτης αγοράς 12/10/2026, ενότητα «Φυσικό αέριο»). Το `month`
 * είναι ο μήνας του εγγράφου σε γενική: το gas.test.ts θέλει να είναι ο μήνας
 * του πίνακα της ΡΑΑΕΥ, ώστε ο επόμενος πίνακας να ζητήσει νέα ανάγνωση.
 */
export const FAE_PRICES_2026_10 = {
  url: 'https://fysikoaerioellados.gr/sites/default/files/2026-10/%CE%A4%CE%B9%CE%BC%CE%B5%CC%81%CF%82_%CE%99%CE%B4%CE%B9%CF%89%CC%81%CF%84%CE%B5%CF%82_%CE%9F%CE%BA%CF%84%CF%8E%CE%B2%CF%81%CE%B9%CE%BF%CF%82_2026_Updated%20%281%29.pdf',
  readAt: '2026-10-12',
  month: 'Οκτωβρίου 2026',
} as const;
/** Μια τιμή του ίδιου εγγράφου: η κατηγορία και το κελί της στήλης «Προμήθεια», αυτούσια. */
const faePrice = (category: string, cell: string) =>
  ({ url: FAE_PRICES_2026_10.url, readAt: FAE_PRICES_2026_10.readAt, category, cell });

export const GAS_PROVIDERS: GasProvider[] = addRaaeyGas([
  {
    value: 'nrg', label: 'nrg (Motor Oil)', url: 'https://www.nrg.gr',
    tariffs: [
      { id: 'nrg_ontime', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:30', name: 'nrg on time GAS', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.09117, fixed: 1.8, undiscounted: { kwh: 0.10377, fixed: 4.8 }, conditions: { price: 'Έκπτωση Συνέπειας και Έκπτωση Συνδυαστικής Προσφοράς με Ηλεκτρική Ενέργεια', fixed: 'ebill και πάγια εντολή' } },
      { id: 'nrg_adapt', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:32', name: 'nrg adapt GAS', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.09247, fixed: 1.8, undiscounted: { kwh: 0.10217, fixed: 4.8 }, conditions: { price: 'Οριζόντια Έκπτωση και Έκπτωση Συνδυαστικής Προσφοράς με Ηλεκτρική Ενέργεια', fixed: 'ebill και πάγια εντολή' } },
      { id: 'nrg_prime', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:31', name: 'nrg prime GAS', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.09177, fixed: 2.5, undiscounted: { kwh: 0.09177, fixed: 5.5 }, conditions: { fixed: 'ebill και πάγια εντολή' } },
      { id: 'nrg_ontime_biz', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-business:14', name: 'nrg on time GAS 4BUSINESS', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'business', kwh: 0.08937, fixed: 0, undiscounted: { kwh: 0.09927, fixed: 5 }, conditions: { price: 'Έκπτωση Συνέπειας και Έκπτωση Συνδυαστικής Προσφοράς με Ηλεκτρική Ενέργεια', fixed: 'ebill και πάγια εντολή' } },
      { id: 'nrg_adapt_biz', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-business:16', name: 'nrg adapt GAS 4BUSINESS', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'business', kwh: 0.09027, fixed: 0, undiscounted: { kwh: 0.09777, fixed: 5 }, conditions: { price: 'Οριζόντια Έκπτωση και Έκπτωση Συνδυαστικής Προσφοράς με Ηλεκτρική Ενέργεια', fixed: 'ebill και πάγια εντολή' } },
      { id: 'nrg_prime_biz', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-business:15', name: 'nrg prime GAS 4BUSINESS', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'business', kwh: 0.09177, fixed: 4, undiscounted: { kwh: 0.09177, fixed: 9 }, conditions: { fixed: 'ebill και πάγια εντολή' } },
    ],
  },
  {
    value: 'zenith', label: 'ZeniΘ', url: 'https://zenith.gr/el/for-the-home/gas/',
    tariffs: [
      // ══ ΟΚΤΩ ΓΡΑΜΜΕΣ ΗΤΑΝ ΜΠΛΕ ΕΝΩ Η ΡΑΑΕΥ ΤΙΣ ΓΡΑΦΕΙ ΚΙΤΡΙΝΕΣ ══════════════
      // Έλεγχος 12/10/2026. Στον πίνακα του Οκτωβρίου (lib/energy/raaeyData.json,
      // ανάγνωση 05/10/2026 από https://energycost.gr/) οι γραμμές
      // gas-residential 86, 87, 91, 92, 100 και gas-business 42, 43, 45 έχουν
      // `colour` «yellow», δηλαδή κυμαινόμενη τιμή (RAAEY_BADGE στο raaey.ts),
      // και καμία τιμή ακόμη. Ο κατάλογος τις κρατούσε ΜΠΛΕ από τον Αύγουστο,
      // που σημαίνει «Σταθερή τιμή για όλη τη διάρκεια της σύμβασης»
      // (BADGE_MEANING στο catalogue.ts, σχόλιο του `badge` πιο πάνω): ο
      // ιδιοκτήτης θα δεσμευόταν 12 ή 24 μήνες νομίζοντας ότι κλείδωσε τιμή.
      // Ίδιο χρώμα έχει και η gas-business:44 «Gas Business Save»: δεν
      // συνδέεται για την τιμή της (RAAEY_REJECTED στο raaeyCatalogue.ts), το
      // χρώμα της όμως είναι της ΡΑΑΕΥ, οπότε ΚΙΤΡΙΝΟ γίνεται και το
      // `zen_biz_save`. Τιμή και μήνας μένουν του Αυγούστου, εκτός σειράς.
      // Ποιος διαβάζει το σήμα και τον τύπο: η στήλη «Τύπος» και ο επιλογέας
      // του BillsGas.tsx, η συμβουλή για σταθερό τιμολόγιο πάνω από 800 kWh
      // (τώρα δείχνεται σωστά και σε αυτά) και το gas.test.ts. Η σειρά και τα
      // φίλτρα δεν τα κοιτούν: μετρούν μήνα τιμής, ποσό και τμήμα. Το χρώμα
      // κάθε συνδεδεμένης γραμμής το ελέγχει πλέον το raaey.test.ts.
      { id: 'zen_central_easy', priceMonth: 'Αυγούστου 2026', raaey: 'gas-residential:91', raaeyUnknown: true, name: 'Gas Central Easy', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.06928, fixed: 0, contract_months: 24, raaey100: 6.93, desc: 'Κεντρική θέρμανση πολυκατοικίας. Χωρίς πάγιο.' },
      { id: 'zen_central_save', priceMonth: 'Αυγούστου 2026', raaey: 'gas-residential:92', raaeyUnknown: true, name: 'Gas Central Save', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.0798, fixed: 0, contract_months: 12, raaey100: 7.98, desc: 'Κεντρική θέρμανση πολυκατοικίας. Χωρίς πάγιο.' },
      { id: 'zen_home_now', priceMonth: 'Αυγούστου 2026', raaey: 'gas-residential:87', raaeyUnknown: true, name: 'Gas Home Now', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.06872, fixed: 4, contract_months: 12, raaey100: 10.87, desc: 'Πάγιο 4,00€ με Dual Energy.' },
      { id: 'zen_home_pulse', priceMonth: 'Αυγούστου 2026', raaey: 'gas-residential:100', raaeyUnknown: true, name: 'Gas Home Pulse', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.07315, fixed: 4.5, contract_months: 12, raaey100: 11.82, desc: 'Αυτόνομη θέρμανση.' },
      { id: 'zen_home_save', priceMonth: 'Αυγούστου 2026', raaey: 'gas-residential:86', raaeyUnknown: true, name: 'Gas Home Save', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.0798, fixed: 4.5, contract_months: 12, raaey100: 12.48, desc: 'Αυτόνομη θέρμανση.' },
      { id: 'zen_home_pair', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:85', name: 'Gas Home Pair', badge: 'ΜΠΛΕ', type: 'fixed', segment: 'residential', kwh: 0.049, fixed: 9.9, undiscounted: { kwh: 0.055, fixed: 9.9 }, conditions: { price: 'Έκπτωση Dual Energy (Παράλληλη σύνδεση Ηλεκτρικής Ενέργειας)' }, contract_months: 12, desc: '+ Δώρο 3 Πάγια (9,9 *3 = 29,7 σε ένα έτος)' },
      { id: 'zen_biz_easy2', priceMonth: 'Αυγούστου 2026', raaey: 'gas-business:43', raaeyUnknown: true, name: 'Gas Business Easy 2', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'business', kwh: 0.06928, fixed: 0, contract_months: 24, raaey100: 6.93, desc: 'Χωρίς πάγιο.' },
      { id: 'zen_biz_save_p', priceMonth: 'Αυγούστου 2026', raaey: 'gas-business:45', raaeyUnknown: true, name: 'Gas Business Save +', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'business', kwh: 0.0798, fixed: 0, contract_months: 12, raaey100: 7.98, desc: 'Χωρίς πάγιο.' },
      { id: 'zen_biz_easy1', priceMonth: 'Αυγούστου 2026', raaey: 'gas-business:42', raaeyUnknown: true, name: 'Gas Business Easy 1', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'business', kwh: 0.06676, fixed: 5, contract_months: 24, raaey100: 11.68 },
      { id: 'zen_biz_save', priceMonth: 'Αυγούστου 2026', name: 'Gas Business Save', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'business',
        kwh: 0.0798, fixed: 4.5, contract_months: 12, raaey100: 12.48 },
    ],
  },
  {
    value: 'elin', label: 'ελίν (ΕΛΙΝΟΙΛ)', url: 'https://energy.elin.gr',
    tariffs: [
      { id: 'elin_home_easy', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:80', name: 'Gas On! Home Easy', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.07825, fixed: 4.5, undiscounted: { kwh: 0.07825, fixed: 4.5 }, contract_months: 12 },
      { id: 'elin_koin_easy', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:82', name: 'Gas On! Κοινόχρηστο Easy', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.07825, fixed: 5, undiscounted: { kwh: 0.07825, fixed: 5 }, contract_months: 12 },
      { id: 'elin_f12_dual', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:79', name: 'Gas On! Fixed 12M Αυτόνομη Θέρμανση Dual', badge: 'ΜΠΛΕ', type: 'fixed', segment: 'residential', kwh: 0.0589, fixed: 4.9, undiscounted: { kwh: 0.0589, fixed: 4.9 }, contract_months: 12, desc: 'Συνδυαστικό Πρόγραμμά' },
      { id: 'elin_relax', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:81', name: 'Gas On! Relax', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.07925, fixed: 6, undiscounted: { kwh: 0.07925, fixed: 6 }, contract_months: 12 },
      { id: 'elin_f12', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:78', name: 'Gas On! Fixed 12M Αυτόνομη Θέρμανση', badge: 'ΜΠΛΕ', type: 'fixed', segment: 'residential', kwh: 0.0589, fixed: 9.9, undiscounted: { kwh: 0.0589, fixed: 9.9 }, contract_months: 12 },
      { id: 'elin_biz_easy', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-business:41', name: 'Gas On! Business Easy', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'business', kwh: 0.07825, fixed: 5, undiscounted: { kwh: 0.07825, fixed: 5 }, contract_months: 12 },
    ],
  },
  {
    value: 'fysiko_aerio', label: 'Φυσικό αέριο ΕΕΕ (ΔΕΠΑ)', url: 'https://fysikoaerioellados.gr',
    tariffs: [
      // ══ Η ΤΙΜΗ ΗΤΑΝ ΤΟΥ ΑΥΓΟΥΣΤΟΥ ΕΝΩ Ο ΠΑΡΟΧΟΣ ΓΡΑΦΕΙ ΗΔΗ ΤΗΝ ΤΙΜΗ ΤΟΥ ΟΚΤΩΒΡΙΟΥ ══
      // Η ΡΑΑΕΥ γράφει «Η τιμή δεν είναι ακόμα γνωστή» στις τέσσερις γραμμές
      // της ΦΑΕ (gas-residential 113 έως 115 και gas-business 48, πίνακας της
      // 05/10/2026) και ο κατάλογος κρατούσε 0,06879 του Αυγούστου. Ο
      // τιμοκατάλογος του ίδιου του παρόχου για τον Οκτώβριο 2026 γράφει στη
      // στήλη «Προμήθεια» 0,087280 για το «Οικιακό με χρήση θέρμανσης»
      // (Πλήρες) και για το «Οικιακό άλλων χρήσεων» (Κουζίνα), όπως τα
      // αντιστοιχίζει ο χάρτης αγοράς 12/10/2026 (σημεία 4 και 5). Πηγή,
      // ανάγνωση 12/10/2026: `FAE_PRICES_2026_10` πιο πάνω.
      //
      // ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΜΕΓΕΘΟΣ ΜΕ ΤΗΣ ΡΑΑΕΥ. Το ίδιο έγγραφο δίνει για τον
      // Αύγουστο προμήθεια 0,068790, ακριβώς το 0,06879 της ΡΑΑΕΥ που κρατούσε
      // ο κατάλογος: η στήλη είναι η χρέωση προμήθειας χωρίς μεταφορά, διανομή,
      // φόρους και ΦΠΑ, όπως μετρά όλη η σύγκριση.
      //
      // ΜΠΑΙΝΕΙ ΣΤΗ ΣΕΙΡΑ ΜΕ ΤΗΝ ΠΗΓΗ ΓΡΑΜΜΕΝΗ. Η οθόνη έλεγε ότι και τα N
      // τιμολόγια είναι «όπως τα δημοσιεύει η ΡΑΑΕΥ», με την ημέρα του
      // πίνακα· με τιμή παρόχου χωρίς σήμανση η πρόταση θα ήταν ψευδής. Γι'
      // αυτό το `providerPrice` κρατά το έγγραφο, την ημέρα, την κατηγορία και
      // το κελί· το BillsGas.tsx μετρά πόσα είναι και τα γράφει στην κεφαλίδα,
      // στη γραμμή ενημέρωσης και στο κελί του μήνα τους. Το `raaeyUnknown`
      // μένει, γιατί η ΡΑΑΕΥ εξακολουθεί να μην έχει τιμή. Το `raaey100` φεύγει
      // από τις δύο: ήταν σύνολο Αυγούστου της ΡΑΑΕΥ.
      //
      // ΗΤΑΝ ΜΠΛΕ («ΣΤΑΘΕΡΗ ΤΙΜΗ ΓΙΑ ΟΛΗ ΤΗ ΔΙΑΡΚΕΙΑ») ΕΝΩ Η ΤΙΜΗ ΑΛΛΑΖΕΙ ΚΑΘΕ
      // ΜΗΝΑ. Η ΡΑΑΕΥ χρωματίζει κίτρινες και τις τέσσερις γραμμές στον πίνακα
      // του Οκτωβρίου (lib/energy/raaeyData.json, `colour` «yellow») και το
      // έγγραφο του παρόχου δίνει άλλη προμήθεια κάθε μήνα: 0,068790 τον
      // Αύγουστο, 0,075110 τον Σεπτέμβριο, 0,087280 τον Οκτώβριο. Οι αναγνώστες
      // του σήματος είναι οι ίδιοι με της ZeniΘ πιο πάνω.
      //
      // ΤΟ «ΠΛΗΡΕΣ EXTRA» ΚΑΙ ΤΟ ΕΠΑΓΓΕΛΜΑΤΙΚΟ ΜΕΝΟΥΝ ΣΤΟΝ ΑΥΓΟΥΣΤΟ, ΕΚΤΟΣ ΣΕΙΡΑΣ.
      // Για το Extra ο χάρτης δεν βρήκε τιμή Οκτωβρίου στο ίδιο έγγραφο (μη
      // επαληθευμένο). Το έγγραφο είναι τιμοκατάλογος ιδιωτών και δεν δίνει
      // το επαγγελματικό. Ο μήνας και η ημέρα της σημείωσης του Extra
      // βγαίνουν από το `FAE_PRICES_2026_10` και το gas.test.ts θέλει τον μήνα
      // του εγγράφου ίσο με τον μήνα του πίνακα: με πίνακα άλλου μήνα ο
      // έλεγχος ζητά νέα ανάγνωση, αντί η σημείωση να μιλά για παλιό μήνα.
      { id: 'fae_pliris', priceMonth: FAE_PRICES_2026_10.month, raaey: 'gas-residential:114', raaeyUnknown: true, providerPrice: faePrice('Οικιακό με χρήση θέρμανσης', '0,087280'), name: 'Αέριο Οικιακό Πλήρες', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.08728, fixed: 0, contract_months: 12, desc: 'Χωρίς πάγιο. Η τιμή είναι από τον τιμοκατάλογο του παρόχου («Οικιακό με χρήση θέρμανσης»), ανάγνωση 12/10/2026.' },
      { id: 'fae_kouzina', priceMonth: FAE_PRICES_2026_10.month, raaey: 'gas-residential:115', raaeyUnknown: true, providerPrice: faePrice('Οικιακό άλλων χρήσεων', '0,087280'), name: 'Αέριο Οικιακό Κουζίνα', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.08728, fixed: 0, contract_months: 12, desc: 'Χωρίς πάγιο. Για χρήση κουζίνας και ζεστού νερού. Η τιμή είναι από τον τιμοκατάλογο του παρόχου («Οικιακό άλλων χρήσεων»), ανάγνωση 12/10/2026.' },
      { id: 'fae_extra', priceMonth: 'Αυγούστου 2026', raaey: 'gas-residential:113', raaeyUnknown: true, name: 'Αέριο Οικιακό Πλήρες Extra', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.06279, fixed: 4.5, contract_months: 24, raaey100: 10.78, desc: `Πολιτική ορθής χρήσης: έως 13 MWh ανά δωδεκάμηνο. Στον τιμοκατάλογο ${FAE_PRICES_2026_10.month} του παρόχου (ανάγνωση ${asOfDate(FAE_PRICES_2026_10.readAt)}) δεν βρέθηκε τιμή γι’ αυτό: τιμή μη επαληθευμένη.` },
      { id: 'fae_biz', priceMonth: 'Αυγούστου 2026', raaey: 'gas-business:48', raaeyUnknown: true, name: 'Αέριο Επαγγελματικό', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'business', kwh: 0.06579, fixed: 0, contract_months: 12, raaey100: 6.58, desc: 'Χωρίς πάγιο.' },
    ],
  },
  {
    value: 'dei', label: 'ΔΕΗ', url: 'https://www.dei.gr',
    tariffs: [
      { id: 'dei_gas_bld_benefit', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:72', name: 'myBuildingGasBenefit', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.08551, fixed: 0, undiscounted: { kwh: 0.08551, fixed: 0 }, contract_months: 24 },
      { id: 'dei_gas_bld_control', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:70', name: 'myΒuildingGasControl', badge: 'ΜΠΛΕ', type: 'fixed', segment: 'residential', kwh: 0.049, fixed: 5, undiscounted: { kwh: 0.049, fixed: 5 }, contract_months: 12, desc: 'Τιμολόγιο Κοινοχρήστων. 60€ έκπτωση στον λογαριασμό για αιτήσεις έως 11/10/2026' },
      { id: 'dei_gas_benefit', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:71', name: 'myHomeGasBenefit', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.08151, fixed: 5, undiscounted: { kwh: 0.08151, fixed: 5 }, contract_months: 24, desc: 'Μηδενική εγγύηση για νέους πελάτες έως 30/11/2026' },
      { id: 'dei_gas_control', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:69', name: 'myHomeGasControl', badge: 'ΜΠΛΕ', type: 'fixed', segment: 'residential', kwh: 0.052, fixed: 14.9, undiscounted: { kwh: 0.052, fixed: 14.9 }, contract_months: 18, desc: 'Μηδενική εγγύηση για νέους πελάτες έως 30/11/2026' },
      { id: 'dei_gas_biz', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-business:39', name: 'myBusinessGasBenefit', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'business', kwh: 0.086, fixed: 5, undiscounted: { kwh: 0.086, fixed: 5 }, contract_months: 24, desc: '120€ έκπτωση στον λογαριασμό για αιτήσεις έως 01/11/2026' },
    ],
  },
  {
    value: 'protergia', label: 'Protergia (Metlen)', url: 'https://www.protergia.gr',
    tariffs: [
      { id: 'prot_auton_plus', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:39', notAvailable: true, name: 'Οικιακό Αυτόνομο Plus', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.08525, fixed: 1, undiscounted: { kwh: 0.08525, fixed: 1 }, contract_months: 24, desc: 'Μη εμπορικά διαθέσιμο.' },
      { id: 'prot_koin_plus', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:46', notAvailable: true, name: 'Οικιακό Κοινόχρηστο Plus', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.08525, fixed: 1, undiscounted: { kwh: 0.08525, fixed: 1 }, contract_months: 24, desc: 'Μη εμπορικά διαθέσιμο' },
      { id: 'prot_auton_double', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:41', notAvailable: true, name: 'Οικιακό Αυτόνομο Double Value', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.07825, fixed: 5, undiscounted: { kwh: 0.08525, fixed: 5 }, conditions: { price: 'Έκπτωση Value 0.007€/kWh' }, contract_months: 24, desc: 'Μη εμπορικά διαθέσιμο' },
      { id: 'prot_auton_single', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:43', notAvailable: true, name: 'Οικιακό Αυτόνομο Single Value', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.08025, fixed: 5, undiscounted: { kwh: 0.08525, fixed: 5 }, conditions: { price: 'Έκπτωση Value 0.005€/kWh' }, contract_months: 24, desc: 'Μη εμπορικά διαθέσιμο' },
      { id: 'prot_gas_sure', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:38', name: 'Οικιακό Αυτόνομο Value Gas Sure', badge: 'ΜΠΛΕ', type: 'fixed', segment: 'residential', kwh: 0.0399, fixed: 9.9, undiscounted: { kwh: 0.0419, fixed: 9.9 }, conditions: { price: 'Έκπτωση Power + Gas' }, contract_months: 12, desc: 'Δωρεάν το πάγιο για τους μήνες Ιούνιο, Ιούλιο και Αύγουστο' },
      { id: 'prot_biz_plus', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-business:20', notAvailable: true, name: 'Εμπορικό Plus', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'business', kwh: 0.08525, fixed: 1, undiscounted: { kwh: 0.08525, fixed: 1 }, contract_months: 24, desc: 'Δώρο τα 3 πρώτα πάγια. Μη εμπορικά διαθέσιμο.' },
      { id: 'prot_biz_double', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-business:21', notAvailable: true, name: 'Εμπορικό Double Reward', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'business', kwh: 0.07825, fixed: 5, undiscounted: { kwh: 0.08525, fixed: 5 }, conditions: { price: 'Έκπτωση Value 0.007€/kWh' }, contract_months: 24, desc: 'Δώρο τα 3 πρώτα πάγια. Μη εμπορικά διαθέσιμο.' },
    ],
  },
  {
    value: 'heron', label: 'ΗΡΩΝ', url: 'https://www.heron.gr',
    tariffs: [
      { id: 'heron_gas_share', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:106', name: 'GAS MAX SHARE', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.08299, fixed: 0, undiscounted: { kwh: 0.09128, fixed: 0 }, conditions: { price: 'ΕΠΙΠΛΕΟΝ 5% ΔΩΡΟ ΠΑΡΑΜΟΝΗΣ' } },
      { id: 'heron_gas_pass', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:104', name: 'GAS PASS', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.10625, fixed: 3.4, undiscounted: { kwh: 0.11333, fixed: 3.4 }, conditions: { price: 'ΕΠΙΠΛΕΟΝ 5% ΔΩΡΟ ΠΑΡΑΜΟΝΗΣ' } },
      { id: 'heron_gas_max_home', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:107', name: 'GAS MAX HOME 2', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.07137, fixed: 4.3, undiscounted: { kwh: 0.07931, fixed: 4.3 }, conditions: { price: 'ΕΠΙΠΛΕΟΝ 5% ΔΩΡΟ ΠΑΡΑΜΟΝΗΣ' } },
      { id: 'heron_gas_blue_max', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:102', name: 'GAS BLUE MAX HOME', badge: 'ΜΠΛΕ', type: 'fixed', segment: 'residential', kwh: 0.0398, fixed: 7.4, undiscounted: { kwh: 0.0398, fixed: 7.4 }, contract_months: 12, desc: '18ΜΗΝΗ ΙΣΧΥΣ ΣΥΜΒΑΣΗΣ' },
      { id: 'heron_gas_biz', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-business:46', name: 'GAS MAX BUSINESS', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'business', kwh: 0.08099, fixed: 0, undiscounted: { kwh: 0.08908, fixed: 0 }, conditions: { price: 'ΕΠΙΠΛΕΟΝ 5% ΔΩΡΟ ΠΑΡΑΜΟΝΗΣ' } },
    ],
  },
  {
    value: 'enerwave', label: 'enerwave (πρώην Elpedison)', url: 'https://www.enerwave.gr',
    tariffs: [
      { id: 'enw_bld_win', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:22', name: 'GasBuilding Win', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.08487, fixed: 0, undiscounted: { kwh: 0.0943, fixed: 0 }, conditions: { price: 'Έκπτωση Double Energy 10%' }, contract_months: 24 },
      { id: 'enw_home_win', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:21', name: 'GasHome Win', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.08127, fixed: 4.9, undiscounted: { kwh: 0.0903, fixed: 4.9 }, conditions: { price: 'Έκπτωση Double Energy 10%' }, contract_months: 24 },
      { id: 'enw_bright_up', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:20', notAvailable: true, name: 'GasHome Bright Up', badge: 'ΜΠΛΕ', type: 'fixed', segment: 'residential', kwh: 0.0449, fixed: 9.9, undiscounted: { kwh: 0.04989, fixed: 9.9 }, conditions: { price: 'Έκπτωση Double Energy 10%' }, contract_months: 12, desc: 'Από 01/09/2026 το προϊόν είναι μη εμπορικά διαθέσιμο.' },
      { id: 'enw_biz_win', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-business:8', name: 'GasBusiness Win', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'business', kwh: 0.08487, fixed: 0, undiscounted: { kwh: 0.0943, fixed: 0 }, conditions: { price: 'Έκπτωση Double Energy 10%' }, contract_months: 24 },
    ],
  },
  {
    value: 'efa', label: 'EFA ENERGY', url: 'https://www.efaenergy.gr',
    tariffs: [
      { id: 'efa_go_central', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:6', name: 'GO GAS EXTRA CENTRAL', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.0825, fixed: 0, undiscounted: { kwh: 0.0839, fixed: 0 }, conditions: { price: '10% έκπτωση σε νέες συνδέσεις για ένα χρόνο ή με την ετήσια συντήρηση ή με πάγια εντολή.' }, contract_months: 24, desc: 'Αφορά Οικιακές Κοινόχρηστες Συνδέσεις. Εγγύηση 0€ με πάγια εντολή.' },
      { id: 'efa_plus_central', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:4', name: 'PLUS GAS EXTRA CENTRAL', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.09665, fixed: 0, undiscounted: { kwh: 0.11905, fixed: 0 }, conditions: { price: '40% έκπτωση συνέπειας' }, contract_months: 24, desc: 'Αφορά Οικιακές Κοινόχρηστες Συνδέσεις. Περιλαμβάνει αναπροσαρμογή TTF. Εγγύηση 0€ με πάγια εντολή.' },
      { id: 'efa_go_home', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:5', name: 'GO GAS EXTRA HOME', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.0815, fixed: 4.8, undiscounted: { kwh: 0.0827, fixed: 4.8 }, conditions: { price: '10% έκπτωση σε νέες συνδέσεις για ένα χρόνο ή με την ετήσια συντήρηση ή με πάγια εντολή' }, contract_months: 24, desc: 'Αφορά Οικιακές Αυτόνομες Συνδέσεις. Εγγύηση 0€ με πάγια εντολή.' },
      { id: 'efa_plus_home', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:3', name: 'PLUS GAS EXTRA HOME', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.09185, fixed: 5, undiscounted: { kwh: 0.11105, fixed: 5 }, conditions: { price: '40% έκπτωση συνέπειας' }, contract_months: 24, desc: 'Αφορά Οικιακές Αυτόνομες Συνδέσεις. Περιλαμβάνει αναπροσαρμογή TTF. Εγγύηση 0€ με πάγια εντολή.' },
      { id: 'efa_my_gas', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:2', name: 'MY GAS HOME', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.0755, fixed: 8.33, undiscounted: { kwh: 0.0755, fixed: 8.33 }, contract_months: 12, desc: 'Αφορά Οικιακές Αυτόνομες Συνδέσεις. Η πάγια χρέωση αφορά στο μηνιαίο επιμερισμό ετήσιας συνδρομής 100€.' },
      { id: 'efa_go_biz', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-business:3', name: 'GO GAS EXTRA BUSINESS', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'business', kwh: 0.0815, fixed: 0, undiscounted: { kwh: 0.0827, fixed: 0 }, conditions: { price: '10% έκπτωση σε νέες συνδέσεις για ένα χρόνο ή με την ετήσια συντήρηση ή με πάγια εντολή.' }, contract_months: 24, desc: 'Αφορά επαγγελματικές παροχές. Εγγύηση 0€ με πάγια εντολή.' },
      { id: 'efa_plus_biz', priceMonth: 'Αυγούστου 2026', name: 'PLUS GAS EXTRA BUSINESS', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'business',
        kwh: 0.07289, fixed: 0, contract_months: 24, raaey100: 7.29,
        desc: 'Περιλαμβάνει αναπροσαρμογή TTF. Έκπτωση συνέπειας 40%.' },
    ],
  },
  {
    value: 'volton', label: 'Volton', url: 'https://volton.gr',
    tariffs: [
      { id: 'vol_stay_home', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:66', name: 'Volton Stay & Win v2 | Αυτόνομες', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.11464, fixed: 6.9, undiscounted: { kwh: 0.12464, fixed: 6.9 }, conditions: { price: 'Συνέπεια' }, contract_months: 24, desc: 'Στο πλαίσιο προωθητικής ενέργειας πραγματοποιείται τμηματική πίστωση συνολικής αξίας 100€ τον πρώτο χρόνο και 50€ κάθε επόμενο χρόνο. Eπιπλέον δώρο 50€ τον 1ο χρόνο και κάθε επόμενο επόμενο.στο λογαριασμό του φυσικού αερίου σε συνδυασμό με πρόγραμμα ηλεκτρικής ενέργειας.' },
      { id: 'vol_stay_koin', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-residential:67', name: 'Volton Stay & Win v2 | Κοινόχρηστες', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'residential', kwh: 0.11464, fixed: 8.9, undiscounted: { kwh: 0.12464, fixed: 8.9 }, conditions: { price: 'Συνέπεια' }, contract_months: 24, desc: 'Στο πλαίσιο προωθητικής ενέργειας πραγματοποιείται τμηματική πίστωση συνολικής αξίας 150€ τον πρώτο χρόνο και 100€ κάθε επόμενο χρόνο. Eπιπλέον δώρο 100€ τον 1ο χρόνο και κάθε επόμενο επόμενο.στο λογαριασμό του φυσικού αερίου σε συνδυασμό με πρόγραμμα ηλεκτρικής ενέργειας.' },
      { id: 'vol_stay_biz', priceMonth: 'Οκτωβρίου 2026', raaey: 'gas-business:38', name: 'Volton Stay & Win v2 | Επαγγελματικές', badge: 'ΚΙΤΡΙΝΟ', type: 'variable', segment: 'business', kwh: 0.11464, fixed: 6.9, undiscounted: { kwh: 0.12464, fixed: 6.9 }, conditions: { price: 'Συνέπεια' }, contract_months: 24, desc: 'Στο πλαίσιο προωθητικής ενέργειας πραγματοποιείται τμηματική πίστωση συνολικής αξίας 150€ τον πρώτο χρόνο και 100€ κάθε επόμενο χρόνο. Eπιπλέον δώρο 100€ τον 1ο χρόνο και κάθε επόμενο επόμενο.στο λογαριασμό του φυσικού αερίου σε συνδυασμό με πρόγραμμα ηλεκτρικής ενέργειας.' },
    ],
  },
]);

// ══ ΠΟΙΕΣ ΤΙΜΕΣ ΔΕΝ ΕΙΝΑΙ ΤΗΣ ΡΑΑΕΥ, ΜΕΤΡΗΜΕΝΕΣ ═════════════════════════
// Η οθόνη έγραφε «Και τα N τιμολόγια είναι όπως τα δημοσιεύει η ΡΑΑΕΥ» και
// «Τελευταία ενημέρωση» με την ημέρα του πίνακα (05/10/2026). Με τιμή
// παρόχου στον κατάλογο και οι δύο προτάσεις γίνονται ψευδείς (έλεγχος
// 12/10/2026). Το πλήθος, το έγγραφο και η ημέρα βγαίνουν από εδώ, από τα
// ίδια τα πεδία `providerPrice`: δεν γράφονται με το χέρι σε κείμενο.

/** Τα τιμολόγια με τιμή του παρόχου, ανά έγγραφο του παρόχου. */
export interface GasProviderSource {
  /** Το όνομα του παρόχου, όπως στον επιλογέα. */
  provider: string;
  url: string;
  readAt: string;
  ids: string[];
  names: string[];
}

export const GAS_PROVIDER_SOURCES: GasProviderSource[] = (() => {
  const out: GasProviderSource[] = [];
  for (const p of GAS_PROVIDERS) {
    for (const t of p.tariffs) {
      if (!t.providerPrice) continue;
      const { url, readAt } = t.providerPrice;
      let g = out.find(x => x.url === url && x.readAt === readAt && x.provider === p.label);
      if (!g) { g = { provider: p.label, url, readAt, ids: [], names: [] }; out.push(g); }
      g.ids.push(t.id);
      g.names.push(t.name);
    }
  }
  return out;
})();

/**
 * «Τελευταία ενημέρωση: … Πηγή: …» για τα τιμολόγια που δείχνει ένα σημείο
 * της οθόνης. Χωρίς τιμή παρόχου είναι η γραμμή του πίνακα της ΡΑΑΕΥ, ίδια
 * με του ρεύματος. Μόνο με τιμές παρόχου γράφει την ημέρα του τιμοκαταλόγου.
 *
 * ΣΤΟ ΜΕΙΓΜΑ ΠΡΩΤΗ ΜΠΑΙΝΕΙ Η ΗΜΕΡΑ ΤΗΣ ΡΑΑΕΥ, ΜΕ ΤΟ ΟΝΟΜΑ ΤΗΣ (12/10/2026).
 * Μόνο δύο τιμολόγια της ΦΑΕ έχουν τιμή παρόχου, διαβασμένη 12/10/2026· όλα
 * τα άλλα είναι του πίνακα της 05/10/2026, από την οποία μετρά και η πύλη
 * παλαιότητας (`GAS_VERIFIED`). Μια γραμμή που θα άρχιζε με «Τελευταία
 * ενημέρωση: 12/10/2026» θα έλεγε για όλο τον κατάλογο κάτι που ισχύει για
 * δύο γραμμές. Η ημέρα του παρόχου λέγεται μετά, μαζί με το πλήθος.
 */
export function gasSourceLine(rows: readonly Pick<GasTariff, 'providerPrice'>[]): string {
  const own = rows.flatMap(t => (t.providerPrice ? [t.providerPrice] : []));
  if (own.length === 0) return `Τελευταία ενημέρωση: ${asOfDate(RAAEY_READ_AT)}. Πηγή: ${PRICE_FACTS.gas.source}`;
  const days = [...new Set(own.map(p => p.readAt))].sort();
  if (own.length === rows.length) return `Τελευταία ενημέρωση: ${asOfDate(days[days.length - 1])}. Πηγή: τιμοκατάλογος του παρόχου`;
  return `Τελευταία ενημέρωση ΡΑΑΕΥ: ${asOfDate(RAAEY_READ_AT)}. Πηγή: ${PRICE_FACTS.gas.source}· `
    + `για ${own.length} από τα ${rows.length} τιμολόγια τιμοκατάλογος του παρόχου, ανάγνωση ${joinGreek(days.map(asOfDate))}`;
}
