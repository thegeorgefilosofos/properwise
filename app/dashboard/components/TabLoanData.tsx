// TabLoanData.tsx — κοινές σταθερές, τύποι και βοηθοί του Δανείου
// Sources: δελτία επιτοκίων κάθε τράπεζας (source_url ανά γραμμή), greece20.gov.gr, ypen.gov.gr, ΑΑΔΕ, bankofgreece.gr, ECB

import { rentalIncomeTax, RENTAL_TAX_SUMMARY_2026 } from '@/lib/billing/greekTax'
import { presumptiveDeductionRateForYear } from '@/lib/billing/consolidate'
import { fe, fp } from '@/components/tokens';
import { SPITI_MOU } from '@/lib/loans/recommend'
import { programDateLabel } from '@/lib/loans/programStatus'
import { EXOIKONOMO_2025, ANAVATHMIZO, openEnergyPrograms, joinGreek } from '@/lib/loans/energyPrograms'
import { athensToday, athensParts } from '@/lib/core/time'
import { feWhole } from '@/lib/core/format'
import { RENO_39B_CAP, RENO_39B_YEARS, RENO_39B_TO } from '@/lib/accounting/renovation39b'

export type LoanType = 'purchase'|'first_home'|'renovation'|'energy'|'investment'|'auction'|'construction'|'commercial'|'land'|'refinance'
export type RateType = 'fixed'|'variable'|'mixed'
/** Το όνομα κάθε τύπου επιτοκίου. Ο έλεγχος «variable ή όχι» έγραφε το μεικτό «σταθερό». */
const RATE_TYPE_LABEL: Record<RateType, string> = { fixed:'Σταθερό', variable:'Κυμαινόμενο', mixed:'Μεικτό' }
export const rateTypeLabel = (t: string | null | undefined): string =>
  RATE_TYPE_LABEL[t as RateType] ?? RATE_TYPE_LABEL.fixed
export type BorrowerType = 'individual'|'professional'|'company'|'young'|'family'|'senior'|'military'|'abroad'
/**
 * ΤΟ ΠΟΤΕ ΚΑΙ ΤΟ ΤΙ ΜΕΤΡΑ ΤΑΞΙΔΕΥΟΥΝ ΜΑΖΙ ΜΕ ΤΗΝ ΤΙΜΗ.
 *
 * ΤΟ ΣΦΑΛΜΑ, ΟΠΩΣ ΒΡΕΘΗΚΕ. Ο υπολογιστής δανείου έγραφε κάτω από το Euribor
 * «Αυτόματη ενημέρωση από την ΕΚΤ κάθε πρωί». Η ΕΚΤ ΔΕΝ δημοσιεύει ημερήσιο
 * Euribor — το `lib/market/ecb.ts` το τεκμηριώνει με μέτρηση: ο κατάλογος του
 * Data Portal, ρωτημένος με μπαλαντέρ στη συχνότητα, απαντά «A | M | Q» και οι
 * τέσσερις ημερήσιες υποψήφιες γύρισαν 404 στην πρώτη αληθινή εκτέλεση.
 *
 * ΓΙΑΤΙ ΕΓΙΝΕ ΚΑΙ ΕΙΝΑΙ Η ΡΙΖΑ: το `TabLoan` περνούσε στον υπολογιστή τέσσερα
 * σκέτα νούμερα και πετούσε την προέλευση. Ο υπολογιστής ΔΕΝ ΜΠΟΡΟΥΣΕ να πει
 * την αλήθεια — δεν την είχε. Οποιος γράψει λεζάντα χωρίς τα δεδομένα, θα
 * γράψει υπόσχεση.
 *
 * Τα δύο πεδία είναι προαιρετικά επειδή το `MARKET_FALLBACK` δεν έχει
 * προέλευση: εκεί η οθόνη λέει ρητά ότι δείχνει εφεδρική τιμή.
 */
export interface MarketRates {
  euribor_3m:number; euribor_1m:number; ecb_rate:number; updated_at:string
  /** Πότε παρατηρήθηκε το Euribor, σε ISO. Κενό όταν παίζει η εφεδρική τιμή. */
  euribor_asOf?:string
  /** Τι μετρά η τιμή: «μέσος όρος μήνα» και τα λοιπά. Ιδιο λεξιλόγιο με το ecb.ts. */
  euribor_basis?:string
  /** Ποιος τη δημοσιεύει και πότε τη φέραμε, ISO. Για τη γραμμή «Πηγή». */
  euribor_source?:string
  euribor_fetchedAt?:string
}
export interface SavedLoan { id:string; property_id:string; user_id:string; bank:string; loan_type:LoanType; amount:number; property_value:number; rate:number; rate_type:RateType; years:number; start_date:string; status:string; notes:string }
export interface LoanScenario { id:string; label:string; amount:number; rate:number; years:number; rateType:RateType }
export interface AmortRow { month:number; payment:number; principal:number; interest:number; balance:number; totalInterestPaid:number }

export const EURIBOR_HISTORY = [
  {date:'2020-01',val:-0.37},{date:'2020-04',val:-0.25},{date:'2020-07',val:-0.42},{date:'2020-10',val:-0.49},
  {date:'2021-01',val:-0.54},{date:'2021-04',val:-0.54},{date:'2021-07',val:-0.55},{date:'2021-10',val:-0.55},
  {date:'2022-01',val:-0.55},{date:'2022-04',val:-0.50},{date:'2022-07',val:0.28},{date:'2022-10',val:1.71},
  {date:'2023-01',val:2.59},{date:'2023-04',val:3.27},{date:'2023-07',val:3.71},{date:'2023-10',val:3.97},
  {date:'2024-01',val:3.89},{date:'2024-04',val:3.88},{date:'2024-07',val:3.57},{date:'2024-10',val:3.08},
  {date:'2025-01',val:2.66},{date:'2025-04',val:2.40},{date:'2025-07',val:2.25},{date:'2025-10',val:2.20},
  {date:'2026-01',val:2.30},{date:'2026-04',val:2.29},{date:'2026-06',val:2.339},
  // Επαληθευμένα από τη σειρά FM.M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA την 01/09/2026.
  // Η ανοδική στροφή δεν φαινόταν καθόλου: ο πίνακας σταματούσε στον Ιούνιο.
  {date:'2026-07',val:2.425},{date:'2026-08',val:2.513},
]

// Εφεδρικές τιμές όταν ο πίνακας market_rates είναι κενός. Δείχνονται ΠΑΝΤΑ με
// ημερομηνία παρατήρησης, ποτέ ως «σημερινές».
//
// ΠΗΓΗ: το Data Portal της ΕΚΤ, ρωτημένο απευθείας την 01/09/2026 — οι ίδιες
// σειρές που τροφοδοτούν πλέον τη βάση, όχι δευτερογενής ιστότοπος. Ο μηνιαίος
// μέσος όρος Αυγούστου 2026 για το Euribor.
//
// ΤΟ ΕΠΙΤΟΚΙΟ ΤΗΣ ΕΚΤ ΕΙΝΑΙ ΤΟ ΤΡΕΧΟΝ, ΟΧΙ ΤΟΥ ΑΥΓΟΥΣΤΟΥ. Εγραφε 2,40, την τιμή
// πριν από την απόφαση της 10/09/2026. Το επιτόκιο πράξεων κύριας
// αναχρηματοδότησης είναι 2,65% από 16/09/2026:
// https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.mp260910~314e508016.en.html
// (ops.handoffs a41bd5b2, στοιχείο P2-1). Η βάση το έχει ήδη σωστό.
export const MARKET_FALLBACK: MarketRates = {
  euribor_3m:2.513, euribor_1m:2.221, ecb_rate:2.65,
  updated_at:'2026-08-01T00:00:00Z',
}

// ══ ΚΑΘΕ ΤΡΑΠΕΖΑ ΜΕ ΤΟ ΔΙΚΟ ΤΗΣ ΔΕΛΤΙΟ ═════════════════════════════════════
// Η εφεδρική εκδοχή του πίνακα `bank_rates`. Η οθόνη συμπληρώνει από εδώ ό,τι
// λείπει από τη βάση (`mergeBanks`), οπότε οι αριθμοί είναι ΟΙ ΙΔΙΟΙ με τη
// μετανάστευση 20260928150000_ta_epitokia_apo_to_deltio_tis_trapezas.sql, που
// γράφει δίπλα σε κάθε τιμή την παλιά της και την πηγή της.
//
// Πηγή: ops.handoffs a41bd5b2 (ομάδα Grok, 28/09/2026, P1-2/P1-3), από το
// επίσημο δελτίο κάθε τράπεζας. `sourceDocDate` είναι η ημερομηνία του
// δελτίου· κενή όπου η πηγή δεν γράφει ημερομηνία. Πεδίο που η τράπεζα δεν
// δημοσιεύει μένει κενό (Optima 3ετές, Εθνική ανώτατο περιθώριο), όχι εκτίμηση.
//   Eurobank  PDF επιτοκίων δανειακών προϊόντων, 27/07/2026, Euribor 3M
//   Alpha     Όροι συναλλαγών, 21/09/2026 (νέες αιτήσεις από 01/06/2026), 3M
//   Optima    ANX241.12, 24/11/2025, 3M
//   Πειραιώς  σελίδα δελτίων τιμών, 20/02/2026, Euribor 1M· σταθερό σε ενιαίο
//             εύρος 3–30 ετών, γι' αυτό κάθε διάρκεια δείχνει το ίδιο εύρος
//   Εθνική    σελίδα στεγαστικών χωρίς ημερομηνία τιμολογίου, 3M· σταθερό
//             «από 2,90» σε κάθε διάρκεια, «το Πρώτο μου Σπίτι» από 2,50
//   Credia    ΚΑΜΙΑ επίσημη πηγή: οι τιμές μένουν ως είχαν και η σημείωση το λέει
// ΤΑ ΧΡΩΜΑΤΑ ΣΗΜΑΤΟΣ ΤΩΝ ΤΡΑΠΕΖΩΝ ΕΦΥΓΑΝ. Εξι hex του Material (#1565C0,
// #E53935, #FFB300 …) κουβαλιούνταν σε κάθε εγγραφή και περνούσαν στο
// ComparisonBank, αλλά καμία οθόνη δεν τα διάβαζε: η σύγκριση δείχνει την
// τράπεζα με το όνομά της. Νεκρό χρώμα που μοιάζει με κανόνα είναι το πρώτο
// που θα αντιγράψει ο επόμενος.
export const BANKS = [
  { id:'eurobank', name:'Eurobank', fixed3:'2.90', fixed5:'3.40-3.50', fixed10:'3.80-3.90', fixed15:'4.10-4.20', fixed20:'4.10-4.20', variable_spread_min:0.80, variable_spread_max:2.70, fixed_min:2.90, max_ltv:90, max_years:35, max_amount:500000, max_age:75, min_amount:20000, green_discount:0.20, spiti_mou:true, features:['Χωρίς έξοδα έγκρισης','Νομικός και τεχνικός έλεγχος δωρεάν','Προέγκριση 48 ώρες','Υπογραφή μέσω gov.gr','Εκταμίευση 10 εργάσιμες','Δικαιούχοι πρώτης κατοικίας: επιπλέον έκπτωση 0,40% για 3 έτη'], programs:['Σπίτι μου ΙΙ','Αναβαθμίζω','Εξοικονομώ'], fees:'Χωρίς έξοδα εξέτασης', note:'Ανταγωνιστικοί όροι', url:'https://www.eurobank.gr/el/retail/proionta-upiresies/proionta/daneia/stegastika', verified_at:'2026-10-04', source_url:'https://www.eurobank.gr/-/media/eurobank/rates/epitokia-daneiakon-proionton.pdf', source_doc_date:'2026-07-27', rate_index:'3M' },
  { id:'ethniki', name:'Εθνική Τράπεζα', fixed3:'2.90', fixed5:'2.90', fixed10:'2.90', fixed15:'2.90', fixed20:'2.90', variable_spread_min:1.60, variable_spread_max:null, fixed_min:2.50, max_ltv:90, max_years:35, max_amount:500000, max_age:75, min_amount:30000, green_discount:0.25, spiti_mou:true, features:['Έως 90% δάνειο προς αξία','Σταθερό 3–30 χρόνια','Χωρίς έξοδα αίτησης','ΕΣΤΙΑ Πράσινη: περιθώριο από 1,35% ή σταθερό από 2,80%','Χωριστή γραμμή στη σελίδα της τράπεζας: σταθερό από 2,50%'], programs:['Σπίτι μου ΙΙ','Αναβαθμίζω','Εξοικονομώ 2025'], fees:'Χωρίς έξοδα εξέτασης', note:'Υψηλότερο δάνειο προς αξία 90%', url:'https://www.nbg.gr/el/idiwtes/daneia/stegastika-daneia', verified_at:'2026-10-04', source_url:'https://www.nbg.gr/el/idiwtes/daneia/stegastika-daneia', source_doc_date:'', rate_index:'3M' },
  { id:'alpha', name:'Alpha Bank', fixed3:'2.90', fixed5:'3.50', fixed10:'3.90', fixed15:'4.20', fixed20:'4.30', variable_spread_min:1.80, variable_spread_max:2.20, fixed_min:2.70, max_ltv:90, max_years:35, max_amount:300000, max_age:75, min_amount:25000, green_discount:0.10, spiti_mou:true, features:['90% δάνειο προς αξία','Χάρις 2 χρόνια','Χωρίς έξοδα','Estia Ανακαίνιση'], programs:['Σπίτι μου ΙΙ','Alpha Πρώτη Κατοικία','Estia Ανακαίνιση'], fees:'Χωρίς έξοδα εξέτασης', note:'Alpha Κατοικία: σταθερό 1 έτους 2,70% και 3 ετών 2,90%', url:'https://www.alpha.gr/el/idiotika/daneia/stegastika-daneia', verified_at:'2026-10-04', source_url:'https://www.alpha.gr/-/media/AlphaGr/pdf-files/diafora-sunodeutika-pdf/xrisima-eggrafa/oroi-sunallagon-epitokia-katatheseon-xorigiseon.pdf', source_doc_date:'2026-09-21', rate_index:'3M' },
  { id:'piraeus', name:'Τράπεζα Πειραιώς', fixed3:'2.40-4.70', fixed5:'2.40-4.70', fixed10:'2.40-4.70', fixed15:'2.40-4.70', fixed20:'2.40-4.70', variable_spread_min:1.40, variable_spread_max:2.45, fixed_min:2.40, max_ltv:90, max_years:35, max_amount:500000, max_age:75, min_amount:20000, green_discount:0.15, spiti_mou:true, features:['Πράσινα spread 1.25%','Euribor 1M βάση','Online εκτίμηση','Ψηφιακή διαδικασία'], programs:['Σπίτι μου ΙΙ','Αναβαθμίζω','Εξοικονομώ'], fees:'Έξοδα φακέλου από 300€', note:'Σταθερό 3 έως 30 ετών σε ενιαίο εύρος, όπως το δημοσιεύει η τράπεζα', url:'https://www.piraeusbank.gr/el/idiwtes/proionta-upiresies/stegastika-daneia', verified_at:'2026-09-28', source_url:'https://www.piraeusbank.gr/el/support/epitokia-deltia-timwn/', source_doc_date:'2026-02-20', rate_index:'1M' },
  { id:'optima', name:'Optima Bank', fixed3:'', fixed5:'3.50-4.00', fixed10:'3.90-4.40', fixed15:'4.30-4.80', fixed20:'4.30-4.80', variable_spread_min:2.00, variable_spread_max:3.00, fixed_min:3.50, max_ltv:75, max_years:30, max_amount:300000, max_age:75, min_amount:20000, green_discount:0.10, spiti_mou:false, features:['Γρήγορη έγκριση','Προνομιακή εξυπηρέτηση','Σταθερό+κυμαινόμενο','Αναχρηματοδότηση'], programs:['Ανακαινίζω','Εξοικονομώ'], fees:'Τιμολόγιο κατά περίπτωση', note:'Προνομιακή εξυπηρέτηση', url:'https://www.optimabank.gr/individuals/daneia/stegastiko-daneio/', verified_at:'2026-09-28', source_url:'https://www.optimabank.gr/media/1kgfzcio/anx241_pinakas_epitokion_xorigitikon_proionton.pdf', source_doc_date:'2025-11-24', rate_index:'3M' },
  { id:'credia', name:'CrediaBank', fixed3:'', fixed5:'', fixed10:'', fixed15:'', fixed20:'', variable_spread_min:1.60, variable_spread_max:null, fixed_min:2.15, max_ltv:80, max_years:30, max_amount:250000, max_age:70, min_amount:15000, green_discount:0.10, spiti_mou:true, features:['Μικρά ποσά','Ευέλικτοι όροι','Γρήγορη εξέταση','Εισφορά ν.128/75: 0,12%'], programs:['Σπίτι μου ΙΙ','Εξοικονομώ'], fees:'Κατά περίπτωση', note:'First Home: σταθερό από 2,15%. Τα εύρη ανά διάρκεια δεν δημοσιεύονται στη σελίδα της τράπεζας', url:'https://www.crediabank.gr', verified_at:'2026-10-04', source_url:'https://www.crediabank.com/idiotes/daneia/stegastika/stegastiko-daneio-crediabank-first-home/', source_doc_date:'', rate_index:'3M' },]

// Ημερομηνία τελευταίας επιβεβαίωσης των στατικών επιτοκίων τραπεζών (ενδεικτικά·
// επιβεβαίωσε τους ακριβείς όρους με την τράπεζα).
// ── ΤΙ ΕΠΑΛΗΘΕΥΤΗΚΕ, ΠΟΤΕ ΚΑΙ ΤΙ ΟΧΙ ──────────────────────────────────────
// 17 Σεπτεμβρίου 2026: ο πίνακας γράφτηκε από συγκριτικό ιστότοπο
// (vresdaneio.gr), όχι από τις τράπεζες.
// 28 Σεπτεμβρίου 2026: οι πέντε από τις έξι ξαναδιαβάστηκαν στο επίσημο δελτίο
// τους (βλ. τον πίνακα πηγών πάνω από το BANKS) και φέρουν δική τους
// `verified_at`. Η Credia ΔΕΝ βρέθηκε τότε σε επίσημη πηγή. Γι' αυτό η κοινή
// ημερομηνία μένει η παλαιότερη: δεν δηλώνουμε επαλήθευση που δεν έγινε.
// 4 Οκτωβρίου 2026: Eurobank, Alpha, Credia και Εθνική από την ανάγνωση της
// ομάδας Grok (migration 20261004110000). Για την Credia η σελίδα First Home
// δίνει μόνο «σταθερό από 2,15%» και περιθώριο από 1,60%· τα εύρη ανά
// διάρκεια και το ανώτατο περιθώριο δεν δημοσιεύονται και μένουν κενά.
//
// Η Attica ΑΦΑΙΡΕΘΗΚΕ: εξαγοράστηκε από την Credia και δεν υπάρχει πλέον ως
// ξεχωριστό ίδρυμα. Ο πίνακας μένει στις έξι τράπεζες που όντως δανείζουν σήμερα.
export const BANKS_VERIFIED = '2026-09-17'
export const RATES_DISCLAIMER = 'Ενδεικτικά επιτόκια, επιβεβαίωσε τους ακριβείς όρους με την τράπεζα.'

// ── ΕΝΑ ΣΧΗΜΑ ΤΡΑΠΕΖΑΣ, ΟΧΙ ΔΥΟ ──────────────────────────────────────────
// Τα στατικά δεδομένα χρησιμοποιούν `fixed3`, ο πίνακας `bank_rates` (ζωντανά)
// χρησιμοποιεί `fixed_3yr`. Ο `normBank` γεφυρώνει τα δύο ώστε ο συγκριτικός
// πίνακας να μη δείχνει «—» στην εφεδρική κατάσταση.
//
// Η γέφυρα υπήρχε ήδη· αυτό που έλειπε ήταν το ΟΝΟΜΑ του αποτελέσματος. Χωρίς
// αυτό, ο τύπος ήταν `Record<string, any>` και η οθόνη διάβαζε κάθε στήλη με
// `(bank as any)[k]` — δηλαδή ένα λάθος όνομα πεδίου έβγαινε ως κενό κελί.
export interface ComparisonBank {
  id: string;
  name: string;
  fixed_3yr: string; fixed_5yr: string; fixed_10yr: string; fixed_15yr: string; fixed_20yr: string;
  /** `null`: η τράπεζα δεν δημοσιεύει ανώτατο περιθώριο. Ποτέ μηδέν στη θέση του. */
  variable_spread_min: number; variable_spread_max: number | null; fixed_min: number;
  max_ltv: number; max_years: number; max_amount: number; min_amount: number;
  green_discount: number; spiti_mou: boolean;
  features: string[]; programs: string[];
  fees: string; note: string; url: string; verified_at: string;
  /** Το επίσημο δελτίο της τράπεζας. Κενό: δεν βρέθηκε επίσημη πηγή. */
  source_url: string;
  /** Η ημερομηνία ισχύος του δελτίου, ISO. Κενή όταν η πηγή δεν τη γράφει. */
  source_doc_date: string;
  /** '1M' ή '3M': σε ποιο Euribor πατά το κυμαινόμενο. Κενό: άγνωστο. */
  rate_index: string;
}

/** Ό,τι μπορεί να δώσει είτε ο στατικός πίνακας είτε η βάση. */
export interface RawBank {
  id?: string; bank_id?: string; name?: string; bank_name?: string;
  fixed3?: string; fixed5?: string; fixed10?: string; fixed15?: string; fixed20?: string;
  fixed_3yr?: string; fixed_5yr?: string; fixed_10yr?: string; fixed_15yr?: string; fixed_20yr?: string;
  variable_spread_min?: number; variable_spread_max?: number | null; fixed_min?: number;
  max_ltv?: number; max_years?: number; max_amount?: number; min_amount?: number;
  green_discount?: number; spiti_mou?: boolean;
  features?: string[]; programs?: string[];
  fees?: string; note?: string; url?: string; verified_at?: string;
  source_url?: string | null; source_doc_date?: string | null; rate_index?: string | null;
}

export function normBank(b: RawBank): ComparisonBank {
  return {
    id:   b.id   ?? b.bank_id   ?? '',
    name: b.name ?? b.bank_name ?? '',
    fixed_3yr:  b.fixed_3yr  ?? b.fixed3  ?? '',
    fixed_5yr:  b.fixed_5yr  ?? b.fixed5  ?? '',
    fixed_10yr: b.fixed_10yr ?? b.fixed10 ?? '',
    fixed_15yr: b.fixed_15yr ?? b.fixed15 ?? '',
    fixed_20yr: b.fixed_20yr ?? b.fixed20 ?? '',
    variable_spread_min: b.variable_spread_min ?? 0,
    variable_spread_max: b.variable_spread_max ?? null,
    fixed_min: b.fixed_min ?? 0,
    max_ltv: b.max_ltv ?? 0, max_years: b.max_years ?? 0,
    max_amount: b.max_amount ?? 0, min_amount: b.min_amount ?? 0,
    green_discount: b.green_discount ?? 0, spiti_mou: !!b.spiti_mou,
    features: b.features ?? [], programs: b.programs ?? [],
    fees: b.fees ?? '', note: b.note ?? '', url: b.url ?? '',
    verified_at: b.verified_at ?? BANKS_VERIFIED,
    source_url: b.source_url ?? '',
    source_doc_date: b.source_doc_date ?? '',
    rate_index: b.rate_index ?? '',
  }
}

/**
 * Το κυμαινόμενο περιθώριο σε λέξεις. Χωρίς δημοσιευμένο ανώτατο γράφεται «από»:
 * ένα «έως +0,00%» θα διαβαζόταν ως τιμή, ενώ είναι απουσία.
 */
export const spreadRange = (b: Pick<ComparisonBank, 'variable_spread_min' | 'variable_spread_max'>): string =>
  b.variable_spread_max != null && b.variable_spread_max > 0
    ? `+${fp(b.variable_spread_min)} έως +${fp(b.variable_spread_max)}`
    : `από +${fp(b.variable_spread_min)}`
export const BANKS_NORM: ComparisonBank[] = BANKS.map(normBank)

// ══ ΟΙ ΠΡΟΘΕΣΜΙΕΣ ΤΟΥ «ΣΠΙΤΙ ΜΟΥ ΙΙ» ΕΙΝΑΙ ΤΟΥ `SPITI_MOU` ════════════════
// Γράφονταν δεύτερη φορά εδώ, ως «31/05/2026», δίπλα στις ίδιες ημερομηνίες
// του lib/loans/recommend.ts: δύο πηγές που μπορούσαν να αποκλίνουν. Η εγγραφή
// του καταλόγου περιγράφει πώς λειτουργούσε το πρόγραμμα· τι δείχνεται σήμερα
// το κρίνει η `programStatus` στον φακό, που για κλειστό πρόγραμμα κρύβει τους
// όρους και γράφει μόνο την κατάσταση.
export const STATE_PROGRAMS = [
  { id:'spiti_mou_2', name:'Σπίτι μου ΙΙ',  type:'Κρατικό, άτοκο 50% (+ επιδότηση επιτοκίου για πολύτεκνους)', desc:'Χρηματοδότηση έως 190.000€ για πρώτη και κύρια κατοικία. Το 50% του δανείου είναι άτοκο (πόροι Ταμείου Ανάκαμψης), το υπόλοιπο 50% με επιτόκιο τράπεζας.', max_amount:190000, max_prop_value:250000, max_ltv:90, max_sqm:150, age_min:25, age_max:50, duration:'3–30 χρόνια (χωρίς περίοδο χάριτος)', application_deadline:programDateLabel(SPITI_MOU.applicationDeadline), deadline:programDateLabel(SPITI_MOU.contractDeadline),  verified_at:'2026-07-08', total_budget:'2 δισ. ευρώ (50% Ταμείο Ανάκαμψης + 50% τράπεζες)', criteria:['Ηλικία 25–50 ετών (γεννηθέντες 1976–2001 για αιτήσεις 2026)','Πρώτη και κύρια κατοικία','Εισόδημα: ενδεικτικά έγγαμοι 35.000€ +5.000€/παιδί, μονογονεϊκές 39.000€ (επιβεβαίωσε στην πύλη)','Αξία συμβολαίου ≤ 250.000€','Έως 150 τ.μ.','Έτος κατασκευής ακινήτου έως και 2007 (για ΑμεΑ ≥67% έως και 31/12/2020)'], how_it_works:'50% του δανείου άτοκο (Ταμείο Ανάκαμψης) · 50% έντοκο (τράπεζα), για όλους. Τρίτεκνοι/πολύτεκνοι: επιπλέον επιδότηση 50% του επιτοκίου στο τραπεζικό 50% (το άτοκο κεφάλαιο παραμένει 50%)', extra:'Τρίτεκνοι/Πολύτεκνοι: επιδοτείται κατά 50% το επιτόκιο του τραπεζικού μισού, δεν γίνεται άτοκο το 75% του κεφαλαίου. Προθεσμία αίτησης 31/05/2026, σύναψη σύμβασης έως 31/08/2026', savings_example:'Δάνειο 150.000€ × 25 έτη με 50% άτοκο δίνει εξοικονόμηση δεκάδων χιλιάδων € σε τόκους έναντι κανονικού δανείου', url:'https://stegasi.gov.gr/programs/spiti-mou-ii/', banks:['Εθνική','Alpha','Eurobank','Πειραιώς','Optima','CrediaBank'] },
  // ══ ΤΙ ΓΡΑΦΕΤΑΙ ΕΔΩ ΚΑΙ ΤΙ ΟΧΙ ═════════════════════════════════════════════
  // Το «Σπίτι μου 3» συζητείται δημόσια και θα το ψάξει ο χρήστης. Η σιωπή δεν
  // είναι ουδέτερη: αν η καρτέλα δεν το αναφέρει καθόλου, εκείνος θα το βρει
  // στον Τύπο, όπου κυκλοφορούν νούμερα σαν να είναι κλειδωμένα.
  //
  // ΟΛΑ ΤΑ ΑΡΙΘΜΗΤΙΚΑ ΠΕΔΙΑ ΜΕΝΟΥΝ null, ΕΠΙΤΗΔΕΣ. Δημοσιεύματα αναφέρουν
  // εισόδημα 20.000–22.000€, ηλικία έως 44–45 και αξία ακινήτου 180.000–
  // 200.000€. Γραμμένα στα πεδία `age_max`, `max_prop_value` και τα λοιπά, η
  // μηχανή θα ΥΠΟΛΟΓΙΖΕ επιλεξιμότητα πάνω τους και θα έλεγε σε κάποιον
  // σαράντα τριών ετών «δικαιούσαι» για πρόγραμμα που δεν υπάρχει. Οι
  // εκτιμήσεις ζουν στο κείμενο, με το «αναφέρουν δημοσιεύματα» μπροστά τους.
  { id:'spiti_mou_3', name:'Σπίτι μου 3', status:'upcoming', type:'Δεν έχει ανακοινωθεί επίσημα', desc:'Τρίτος κύκλος του στεγαστικού προγράμματος, σε δημόσια συζήτηση. Μέχρι σήμερα ΔΕΝ υπάρχει επίσημος οδηγός, δεν έχουν οριστεί κριτήρια, δεν συμμετέχουν τράπεζες και δεν έχει ανοίξει πλατφόρμα αιτήσεων. Δεν μπορείς να κάνεις αίτηση.', max_amount:null, max_prop_value:null, max_ltv:null, max_sqm:null, age_min:null, age_max:null, duration:'Δεν έχει οριστεί', deadline:'Χωρίς ημερομηνία έναρξης', verified_at:'2026-09-01', total_budget:'Δεν έχει ανακοινωθεί', criteria:['Δεν έχουν οριστεί δικαιούχοι','Δεν έχουν οριστεί ηλικιακά ή εισοδηματικά όρια','Δεν έχει οριστεί ποια ακίνητα είναι επιλέξιμα','Καμία τράπεζα δεν συμμετέχει ακόμη'], how_it_works:'Θα γίνει γνωστό μόνο με τον επίσημο οδηγό. Ο,τι κυκλοφορεί σήμερα είναι εκτίμηση, όχι όρος του προγράμματος.', extra:'Ο δεύτερος κύκλος έκλεισε νωρίτερα, στις 31/05/2026, καθώς η χρηματοδότηση από το Ταμείο Ανάκαμψης λήγει το φθινόπωρο· είχε απορροφηθεί το 88,7% των 2 δισ. ευρώ. Δημοσιεύματα αναφέρουν προϋπολογισμό περίπου 1 δισ. ευρώ για 10.000 νοικοκυριά, χαλάρωση των ορίων (εισόδημα 20.000–22.000€, ηλικία έως 44–45, αξία ακινήτου 180.000–200.000€) και παρουσίαση στη ΔΕΘ. ΚΑΝΕΝΑ από αυτά δεν είναι επιβεβαιωμένο και δεν πρέπει να το λάβεις υπόψη σε απόφαση αγοράς.', savings_example:'Δεν υπάρχει παράδειγμα: οι όροι δεν έχουν ανακοινωθεί', url:'https://stegasi.gov.gr/', banks:['Δεν έχουν οριστεί'] },
  { id:'anavathmizo', name:'Αναβαθμίζω το Σπίτι μου',  type:'Κρατικό, Δάνειο ενεργειακής αναβάθμισης', desc:'Δάνειο 5.000€ έως 25.000€, άτοκο για τον δανειολήπτη: το 75% από το Ταμείο Ανάκαμψης χωρίς τόκο και το 25% από την τράπεζα με πλήρη επιδότηση των τόκων από το Δημόσιο', max_amount:25000, max_prop_value:null, max_ltv:null, max_sqm:null, age_min:18, age_max:null, duration:'3–7 χρόνια', application_deadline:programDateLabel(ANAVATHMIZO.applicationDeadline), deadline:programDateLabel(ANAVATHMIZO.deadline),  total_budget:'80 εκ. ευρώ', criteria:['ΠΕΑ πριν και μετά','Αναβάθμιση ≥3 ενεργειακές κατηγορίες','Εξοικονόμηση >30%'], how_it_works:'Δάνειο για ενεργειακές παρεμβάσεις, ένα ακίνητο ανά ΑΦΜ, χωρίς εισοδηματικά κριτήρια', extra:'Αυξημένη επιδότηση για ΑμεΑ, τρίτεκνους και πολύτεκνους. Οι αιτήσεις υπαγωγής έκλεισαν στις 31/05/2026· η 31/08/2026 αφορά μόνο την υπογραφή σύμβασης για όσους έχουν ήδη έγκριση', savings_example:'Μηδενικό κόστος δανεισμού και χαμηλότεροι λογαριασμοί ενέργειας', url:'https://greece20.gov.gr/home-loans/', banks:['Εθνική','Alpha','Eurobank','Πειραιώς','CrediaBank'] },
  { id:'exoikonomo_2025', name:'Εξοικονομώ 2025',  type:'Επιδότηση ενεργειακής αναβάθμισης', desc:'Η αρχική προθεσμία (30/06/2026) παρήλθε, εκκρεμεί ανακοίνωση παράτασης, επιβεβαίωσε στο exoikonomo2025.gov.gr', max_amount:null, max_prop_value:null, max_ltv:null, max_sqm:null, age_min:18, age_max:null, duration:'Εφάπαξ', deadline:`Έληξε ${programDateLabel(EXOIKONOMO_2025.deadline)}, εκκρεμεί παράταση`,  verified_at:'2026-07-08', total_budget:'Ταμείο Ανάκαμψης ΕΕ', criteria:['Εξοικονόμηση >30%','Αναβάθμιση ≥3 κατηγορίες','ΠΕΑ πριν και μετά'], how_it_works:'Επιδότηση κουφωμάτων, μόνωσης, θέρμανσης, φωτοβολταϊκών', extra:'Ειδικά κίνητρα για ΑμεΑ, τρίτεκνους, πολύτεκνους, νέους', savings_example:'Μείωση λογαριασμών + επιδότηση κόστους', url:'https://exoikonomo2025.gov.gr/', banks:['Εθνική','Alpha','Eurobank','Πειραιώς'] },
  { id:'exoikonomo_2026', name:'Εξοικονομώ 2026', status:'upcoming', type:'Επερχόμενο, 2ο εξάμηνο 2026', desc:'Νέος κύκλος 1,2 δισ. €, επιδότηση έως 80%, 62.000 κατοικίες', max_amount:null, max_prop_value:null, max_ltv:null, max_sqm:null, age_min:18, age_max:null, duration:'Αναμένεται', deadline:'2ο εξάμηνο 2026',  total_budget:'1,2 δισ. ευρώ', criteria:['Χωρίς εισοδηματικό κριτήριο','Ιδιοκτήτες / Ενοικιαστές ≥7 ετών'], how_it_works:'Επιδότηση έως 80%, λεπτομέρειες αναμένονται', extra:'Μη δεσμευτείς ακόμη, παρακολούθα exoikonomo2025.gov.gr', savings_example:'Επιδότηση έως 80% κόστους αναβάθμισης', url:'https://selectra.gr/energeia/energeia-epidomata/exoikonomo', banks:['Αναμένεται'] },
  { id:'anakainizo_noikazo', name:'Ανακαινίζω και Νοικιάζω',  type:'Επιδότηση ανακαίνισης + εγγυημένο ενοίκιο ΟΠΕΚΑ', desc:'40% επιδότηση + εγγυημένο ενοίκιο 5 χρόνια', max_amount:15000, max_prop_value:null, max_ltv:null, max_sqm:null, age_min:18, age_max:null, duration:'5 χρόνια', deadline:'Τρέχον',  total_budget:'Τρέχον', criteria:['Κενό ακίνητο ≥3 χρόνια','€5.000–€40.000','Μίσθωση ΟΠΕΚΑ','Δέσμευση 5ετίας'], how_it_works:'40% επιδότηση ανακαίνισης + ενοίκιο αγοράς από ΟΠΕΚΑ για 5 χρόνια', extra:'Εγγυημένο εισόδημα, ιδανικό για επενδυτές', savings_example:'Κενό ακίνητο: ανακαίνιση + εγγυημένο εισόδημα', url:'https://www.opeka.gr', banks:['Εθνική','Πειραιώς','Eurobank'] },
  { id:'gefyra_3', name:'Γέφυρα 3',  type:'Πρωτοβουλία τραπεζών, ευάλωτοι δανειολήπτες', desc:'Κάλυψη του 50% της αύξησης της δόσης που προήλθε από την άνοδο των επιτοκίων της ΕΚΤ. Δεν είναι κρατική επιδότηση: είναι εθελοντική πρωτοβουλία των τραπεζών-μελών της Ελληνικής Ένωσης Τραπεζών (ανακοίνωση 15/12/2022)', max_amount:null, max_prop_value:null, max_ltv:null, max_sqm:null, age_min:18, age_max:null, duration:'12 μήνες', deadline:'Χωρίς ανακοινωμένη λήξη',  total_budget:'Χρηματοδοτείται από τις ίδιες τις τράπεζες', criteria:['Βεβαίωση ευάλωτου οφειλέτη','Κυμαινόμενο δάνειο','Εξασφάλιση πρώτης κατοικίας'], how_it_works:'Καλύπτει το 50% της αύξησης της μηνιαίας δόσης έναντι της 30/06/2022, για δώδεκα μήνες, σε δάνεια κυμαινόμενου επιτοκίου με εξασφάλιση σε πρώτη κατοικία', extra:'Για ανέργους, χαμηλά εισοδήματα, συνταξιούχους', savings_example:'Αύξηση 80€/μήνα, επιδότηση 40€ × 12 = 480€/χρόνο', url:'https://dovaluegreece.gr/programma-epidotisis-dosis-logo-ayxisis-epitokion-gefyra-3', banks:['Όλες οι τράπεζες'] },
]

// ── ΕΝΑ ΣΧΗΜΑ ΠΡΟΓΡΑΜΜΑΤΟΣ, ΟΧΙ ΔΥΟ ──────────────────────────────────────
// Ο στατικός πίνακας λέει `desc`, `duration`, `extra`, `banks`. Ο πίνακας
// `loan_programs` της βάσης λέει `description`, `duration_label`, `extra_info`,
// `participating_banks`. Η οθόνη τα διάβαζε και τα δύο με `||` και με
// `as any` — και ό,τι υπήρχε μόνο στη μία πλευρά (τετραγωνικά, ηλικία, «πώς
// λειτουργεί») εμφανιζόταν ή εξαφανιζόταν ανάλογα με το αν είχε φορτώσει η βάση,
// χωρίς κανείς να το βλέπει σαν πρόβλημα.
export interface ComparisonProgram {
  id: string;
  name: string;
  /**
   * ΜΟΝΟ το «upcoming» έχει νόημα γραμμένο: ό,τι δεν άνοιξε ακόμη δεν
   * προκύπτει από ημερομηνία. Κάθε άλλη κατάσταση την κρίνει η `programStatus`
   * συγκρίνοντας με το σήμερα — το `status:'active'` ήταν χειρόγραφη σημαία που
   * έμενε αληθινή μόνο μέχρι να περάσει η προθεσμία δίπλα της.
   */
  status: string;
  type: string;
  desc: string;
  howItWorks: string;
  extra: string;
  savingsExample: string;
  maxAmount: number | null;
  maxLtv: number | null;
  maxSqm: number | null;
  ageMin: number | null;
  ageMax: number | null;
  duration: string;
  /**
   * Καταληκτική ημερομηνία ΑΙΤΗΣΗΣ. Υπήρχε στα δεδομένα και ΔΕΝ περνούσε από τη
   * `normProgram`: η οθόνη έβλεπε μόνο τη `deadline`, που στα κρατικά
   * προγράμματα είναι η προθεσμία ΥΠΟΓΡΑΦΗΣ — μεταγενέστερη. Έτσι το «Σπίτι μου
   * ΙΙ» έδειχνε «Προθεσμία 31/08/2026» δέκα εβδομάδες αφότου οι αιτήσεις είχαν
   * κλείσει στις 31/05 και ο χρήστης νόμιζε ότι προλαβαίνει.
   */
  applicationDeadline: string;
  deadline: string;
  totalBudget: string;
  criteria: string[];
  banks: string[];
  url: string;
}

/** Ό,τι μπορεί να δώσει είτε ο στατικός πίνακας είτε η βάση. */
export interface RawProgram {
  id?: string; program_id?: string; name?: string; status?: string;
  type?: string; type_label?: string;
  desc?: string; description?: string;
  how_it_works?: string;
  extra?: string; extra_info?: string;
  savings_example?: string;
  max_amount?: number | null; max_ltv?: number | null; max_sqm?: number | null;
  age_min?: number | null; age_max?: number | null;
  duration?: string; duration_label?: string;
  application_deadline?: string | null;
  deadline?: string | null; deadline_label?: string;
  total_budget?: string;
  criteria?: string[];
  banks?: string[]; participating_banks?: string[];
  url?: string;
}

// Το «null» ως ΚΕΙΜΕΝΟ έφτανε από τη βάση σε πεδία που δεν συμπληρώθηκαν και
// τυπωνόταν αυτούσιο στην οθόνη. Καθαρίζεται εδώ, μία φορά, αντί για τρεις
// ελέγχους `!== 'null'` σκορπισμένους στην απόδοση.
const txt = (v?: string | null): string => (!v || v === 'null' || v === '-' ? '' : v)

export function normProgram(p: RawProgram): ComparisonProgram {
  return {
    id: p.id ?? p.program_id ?? '',
    name: p.name ?? '',
    status: p.status ?? 'active',
    type: txt(p.type ?? p.type_label),
    desc: txt(p.desc ?? p.description),
    howItWorks: txt(p.how_it_works),
    extra: txt(p.extra ?? p.extra_info),
    savingsExample: txt(p.savings_example),
    maxAmount: p.max_amount ?? null,
    maxLtv: p.max_ltv ?? null,
    maxSqm: p.max_sqm ?? null,
    ageMin: p.age_min ?? null,
    ageMax: p.age_max ?? null,
    duration: txt(p.duration ?? p.duration_label),
    applicationDeadline: txt(p.application_deadline),
    deadline: txt(p.deadline ?? p.deadline_label),
    totalBudget: txt(p.total_budget),
    criteria: p.criteria ?? [],
    banks: p.participating_banks ?? p.banks ?? [],
    url: p.url ?? '',
  }
}
export const PROGRAMS_NORM: ComparisonProgram[] = STATE_PROGRAMS.map(normProgram)

// ══ ΤΑ ΖΩΝΤΑΝΑ ΔΕΔΟΜΕΝΑ ΣΥΜΠΛΗΡΩΝΟΥΝ ΤΟΝ ΚΑΤΑΛΟΓΟ, ΔΕΝ ΤΟΝ ΣΒΗΝΟΥΝ ═════════
//
// ΤΟ ΣΦΑΛΜΑ, ΠΙΑΣΜΕΝΟ ΤΗΝ ΤΕΛΕΥΤΑΙΑ ΜΕΡΑ ΤΟΥ «ΣΠΙΤΙ ΜΟΥ ΙΙ». Η οθόνη έγραφε
// «Λήγει σύντομα · Οι αιτήσεις κλείνουν, σε λιγότερο από μία μέρα» στις 31/08
// — για πρόγραμμα του οποίου οι αιτήσεις είχαν κλείσει στις 31/05. Η 31/08 ΔΕΝ
// είναι προθεσμία αίτησης: είναι η προθεσμία ΥΠΟΓΡΑΦΗΣ για όσους έχουν ήδη
// έγκριση. Ο χρήστης διάβαζε ότι προλαβαίνει να κάνει αίτηση· δεν προλάβαινε
// τρεις μήνες.
//
// ΓΙΑΤΙ. Η καρτέλα γράφει `livePrograms.length ? livePrograms.map(norm) : στατικά`
// δηλαδή ΟΛΟ ή ΤΙΠΟΤΑ. Η γραμμή της βάσης δεν είχε `application_deadline` (το
// πεδίο προστέθηκε στον στατικό κατάλογο αργότερα), οπότε το ζωντανό αντίγραφο
// έσβηνε μια ημερομηνία που ο κώδικας γνώριζε — και η μηχανή, χωρίς προθεσμία
// αίτησης, πήρε την προθεσμία υπογραφής στη θέση της.
//
// Η ΔΙΟΡΘΩΣΗ ΕΙΝΑΙ ΕΝΩΣΗ, ΟΧΙ ΑΝΤΙΚΑΤΑΣΤΑΣΗ. Ο,τι έχει τιμή στη βάση νικά·
// ό,τι λείπει έρχεται από τον κατάλογο. Το ίδιο ισχύει για κάθε πεδίο, όχι
// μόνο για την προθεσμία: μια γραμμή βάσης με κενό `criteria` δεν σβήνει τα
// κριτήρια που ξέρουμε.
const emptyValue = (v: unknown): boolean =>
  v == null || v === '' || (Array.isArray(v) && v.length === 0);

/** Ενώνει μια κανονικοποιημένη εγγραφή με την εφεδρική της, ανά πεδίο. */
function mergeKnown<T extends object>(live: T, fallback: T | undefined): T {
  if (!fallback) return live;
  const out = { ...live };
  for (const k of Object.keys(fallback) as (keyof T)[]) {
    if (emptyValue(out[k]) && !emptyValue(fallback[k])) out[k] = fallback[k];
  }
  return out;
}

const PROGRAM_FALLBACK = new Map(PROGRAMS_NORM.map(p => [p.id, p]));
const BANK_FALLBACK = new Map(BANKS_NORM.map(b => [b.id, b]));

/** Ζωντανά προγράμματα, με ό,τι λείπει συμπληρωμένο από τον κατάλογο. */
export const mergePrograms = (live: RawProgram[]): ComparisonProgram[] =>
  live.map(normProgram).map(p => mergeKnown(p, PROGRAM_FALLBACK.get(p.id)));

/** Ζωντανές τράπεζες, με ό,τι λείπει συμπληρωμένο από τον κατάλογο. */
export const mergeBanks = (live: RawBank[]): ComparisonBank[] =>
  live.map(normBank).map(b => mergeKnown(b, BANK_FALLBACK.get(b.id)));

// ΑΦΑΙΡΕΘΗΚΑΝ το `rental_tax` και το `rental_expense_deduction`.
// Ήταν ΤΡΙΤΟ αντίγραφο της φορολογικής κλίμακας ενοικίων και ΤΕΤΑΡΤΟ της τεκμαρτής
// έκπτωσης 5% και χρησιμοποιούνταν για ΕΜΦΑΝΙΣΗ στην ίδια κάρτα όπου ο
// ΥΠΟΛΟΓΙΣΜΟΣ έρχεται από το lib/billing/greekTax. Με την πρώτη αλλαγή του νόμου,
// ο πίνακας θα έδειχνε τα παλιά κλιμάκια και το ποσό δίπλα του τα νέα — σιωπηλά,
// χωρίς κανένα σφάλμα. Η κλίμακα για εμφάνιση ζει στο RENTAL_TAX_ROWS_2026 και η
// έκπτωση στο presumptiveDeductionRateForYear (lib/billing/consolidate).
// ΚΑΙ ΤΟ `fma_rate:0.03` ΕΦΥΓΕ, ΓΙΑΤΙ ΗΤΑΝ ΔΕΥΤΕΡΟ ΚΑΙ ΛΑΘΟΣ ΑΝΤΙΓΡΑΦΟ.
// Ο φόρος μεταβίβασης είναι 3,09% (3% συν 3% υπέρ ΟΤΑ επί του φόρου) και ζει
// στο `TRANSFER_TAX_RATE` του lib/accounting/transfer.ts, που τον υπολογίζει
// σωστά. Εδώ καθόταν ένα 0,03 που δεν το διάβαζε κανείς: την ημέρα που θα το
// διάβαζε κάποιος, θα έβγαζε φόρο μικρότερο κατά 3%.
//
// Μαζί έφυγαν ο ΦΠΑ νεόδμητων, η σημείωση αναστολής και τα δύο πεδία για την
// έκπτωση τόκων: γραμμένα, εξαγόμενα, ποτέ διαβασμένα. Μένει η απαλλαγή
// πρώτης κατοικίας, που τη διαβάζει η συνάρτηση από κάτω.
export const TAX_DATA = {
  fma_exemption:{single:200000,married:250000,child1:25000,child2:25000,child3:30000,max_sqm:120},
}

export type LoanDoc = { name: string; where?: string }

// ══ Η ΠΡΩΤΗ ΚΑΤΟΙΚΙΑ ΤΙΜΟΛΟΓΕΙΤΑΙ ΟΠΩΣ ΚΑΘΕ ΑΓΟΡΑ ════════════════════════════
// Η «Πρώτη κατοικία» έγραφε «Σπίτι μου ΙΙ, πολύ χαμηλό επιτόκιο» με εύρος 1,00
// έως 2,00%: το μεικτό επιτόκιο με το μισό δάνειο χωρίς τόκο, για πρόγραμμα
// που έκλεισε για αιτήσεις. Χωρίς το πρόγραμμα, οι τράπεζες τη δανείζουν με τα
// τιμολόγια της αγοράς κατοικίας· το εύρος είναι το ίδιο, από το ίδιο σημείο.
const PURCHASE_RATES = { rate_from:2.40, rate_to:4.90 }
export const LOAN_TYPES: Record<LoanType,{label:string;desc:string;rate_from:number;rate_to:number;typical_ltv:number;notes:string;docs:LoanDoc[];tax_note:string}> = {
  purchase:     {label:'Αγορά κατοικίας',       desc:'Αγορά παλαιάς ή νέας κατοικίας',        ...PURCHASE_RATES, typical_ltv:80, notes:'Πιο διαδεδομένος τύπος', docs:[
    {name:'Δελτίο ταυτότητας ή διαβατήριο'},
    {name:'Εκκαθαριστικά σημειώματα δύο τελευταίων ετών', where:'ΑΑΔΕ, myAADE'},
    {name:'Αποδείξεις μισθοδοσίας τριών τελευταίων μηνών', where:'Εργοδότης'},
    {name:'Δήλωση στοιχείων ακινήτων (Ε9)', where:'ΑΑΔΕ'},
    {name:'Συμβόλαιο ή προσύμφωνο αγοραπωλησίας', where:'Συμβολαιογράφος'},
    {name:'Αριθμός Ταυτότητας Ακινήτου (ΑΤΑΚ)', where:'ΑΑΔΕ, Ε9'},
  ], tax_note:'Φόρος μεταβίβασης 3% συν 3% υπέρ ΟΤΑ επί του φόρου, δηλαδή 3,09% συνολικά, επί της μεγαλύτερης μεταξύ τιμήματος και αντικειμενικής αξίας. Απαλλαγή πρώτης κατοικίας εφόσον πληρούνται οι όροι'},
  first_home:   {label:'Πρώτη κατοικία',        desc:'Αγορά πρώτης και κύριας κατοικίας',     ...PURCHASE_RATES, typical_ltv:90, notes:`Το «Σπίτι μου ΙΙ» έκλεισε για νέες αιτήσεις στις ${programDateLabel(SPITI_MOU.applicationDeadline)}`, docs:[
    {name:'Δελτίο ταυτότητας ή διαβατήριο'},
    {name:'Εκκαθαριστικά σημειώματα δύο τελευταίων ετών', where:'ΑΑΔΕ'},
    {name:'Αποδεικτικά εισοδήματος ή μισθοδοσίας', where:'Εργοδότης, ΑΑΔΕ'},
    {name:'Υπεύθυνη δήλωση πρώτης κατοικίας', where:'gov.gr'},
    {name:'Μηδενική δήλωση ακινήτων (Ε9): αποδεικνύει μη κατοχή κατοικίας', where:'ΑΑΔΕ'},
  ], tax_note:'Απαλλαγή φόρου μεταβίβασης: άγαμος έως 200.000€ και έγγαμος έως 250.000€ (ΑΑΔΕ 2026)'},
  renovation:   {label:'Ανακαίνιση',            desc:'Χρηματοδότηση ανακαίνισης',             rate_from:3.00, rate_to:4.50, typical_ltv:70, notes:'Χωρίς εγγύηση σε μικρά ποσά', docs:[
    {name:'Δελτίο ταυτότητας ή διαβατήριο'},
    {name:'Εκκαθαριστικό σημείωμα', where:'ΑΑΔΕ'},
    {name:'Τίτλος ιδιοκτησίας', where:'Συμβολαιογράφος, Κτηματολόγιο'},
    {name:'Προσφορές αναδόχων ή εργολάβων'},
    {name:'Οικοδομική άδεια, εφόσον απαιτείται', where:'Πολεοδομία'},
  ], tax_note:`Δαπάνες ανακαίνισης με ηλεκτρονική πληρωμή μειώνουν τον φόρο κατά ίσο ποσό, έως ${feWhole(RENO_39B_CAP)} σε ${RENO_39B_YEARS} έτη (άρθρο 39Β ΚΦΕ, δαπάνες έως ${RENO_39B_TO})`},
  energy:       {label:'Ενεργειακή αναβάθμιση', desc:'Πράσινα δάνεια, περιθώριο από 1,25%',   rate_from:2.40, rate_to:3.50, typical_ltv:80, notes:'Έκπτωση περιθωρίου 0,15% έως 0,80% για κλάση Α+, Α ή Β+, ανάλογα με την τράπεζα', docs:[
    {name:'Πιστοποιητικό Ενεργειακής Απόδοσης (πριν την αναβάθμιση)', where:'Ενεργειακός επιθεωρητής'},
    {name:'Δελτίο ταυτότητας ή διαβατήριο'},
    {name:'Φορολογικά στοιχεία εισοδήματος', where:'ΑΑΔΕ'},
    {name:'Τίτλος ιδιοκτησίας', where:'Κτηματολόγιο'},
    {name:'Προσφορά αναδόχου έργου'},
  // Κενό σκόπιμα: τα προγράμματα ανοίγουν και κλείνουν, η σημείωση βγαίνει από
  // τον κατάλογο τη στιγμή που δείχνεται (`loanTaxNote`).
  ], tax_note:''},
  investment:   {label:'Επενδυτικό ακίνητο',    desc:'Αγορά για εκμετάλλευση ή ενοικίαση',   rate_from:3.00, rate_to:4.50, typical_ltv:70, notes:'Το εισόδημα ενοικίου προσμετράται', docs:[
    {name:'Δελτίο ταυτότητας ή διαβατήριο'},
    {name:'Φορολογικές δηλώσεις τριών τελευταίων ετών', where:'ΑΑΔΕ'},
    {name:'Αναλυτική κατάσταση μισθωμάτων (Ε2)', where:'ΑΑΔΕ'},
    {name:'Τίτλοι ιδιοκτησίας', where:'Κτηματολόγιο'},
    // Η κλίμακα δεν γράφεται ξανά εδώ: έρχεται από τη μοναδική πηγή (greekTax).
    // Και η έκπτωση 5% ΔΕΝ είναι «αυτόματη» — από 1.7.2027 (ν.5222/2025) θέλει τραπεζική είσπραξη.
  ], tax_note:`${RENTAL_TAX_SUMMARY_2026} Τεκμαρτή έκπτωση 5%· από 1.7.2027 (ν.5222/2025) θα προϋποθέτει είσπραξη μέσω τράπεζας. Οι τόκοι δανείου δεν εκπίπτουν για φυσικό πρόσωπο.`},
  auction:      {label:'Πλειστηριασμός',         desc:'Αγορά σε ηλεκτρονικό πλειστηριασμό',   rate_from:2.80, rate_to:4.00, typical_ltv:70, notes:'Έλεγξε βάρη, γρήγορη εκταμίευση', docs:[
    {name:'Δελτίο ταυτότητας ή διαβατήριο'},
    {name:'Φορολογικά στοιχεία εισοδήματος', where:'ΑΑΔΕ'},
    {name:'Απόσπασμα κατασχετήριας έκθεσης πλειστηριασμού', where:'eauction.gr'},
    {name:'Νομικός έλεγχος τίτλων και βαρών', where:'Δικηγόρος'},
  ], tax_note:'Φόρος μεταβίβασης 3,09% (3% συν 3% υπέρ ΟΤΑ επί του φόρου). Έλεγξε βάρη και δεσμεύσεις στο Κτηματολόγιο'},
  construction: {label:'Ανέγερση κατοικίας',    desc:'Χρηματοδότηση κατασκευής',             rate_from:3.00, rate_to:4.50, typical_ltv:75, notes:'Εκταμίευση σε φάσεις', docs:[
    {name:'Οικοδομική άδεια (άδεια δόμησης)', where:'Πολεοδομία'},
    {name:'Εγκεκριμένα αρχιτεκτονικά σχέδια', where:'Μηχανικός'},
    {name:'Σύμβαση με εργολάβο ή ανάδοχο'},
    {name:'Δελτίο ταυτότητας ή διαβατήριο'},
    {name:'Τίτλος ιδιοκτησίας οικοπέδου', where:'Κτηματολόγιο'},
  ], tax_note:'ΦΠΑ 24% για νεόδμητα (άδεια μετά το 2006), σε αναστολή έως 31/12/2026: ισχύει ο φόρος μεταβίβασης'},
  commercial:   {label:'Επαγγελματικό ακίνητο', desc:'Γραφεία, καταστήματα, αποθήκες',       rate_from:3.50, rate_to:5.00, typical_ltv:65, notes:'Οι τόκοι εκπίπτουν φορολογικά', docs:[
    {name:'Καταστατικό εταιρείας ή δελτίο ταυτότητας'},
    {name:'Ισολογισμοί τριών τελευταίων ετών', where:'Λογιστήριο'},
    {name:'Φορολογική και ασφαλιστική ενημερότητα', where:'ΑΑΔΕ, ΕΦΚΑ'},
    {name:'Τίτλος ιδιοκτησίας', where:'Κτηματολόγιο'},
  ], tax_note:'Ψηφιακό Τέλος Συναλλαγής 3,6% στις επαγγελματικές μισθώσεις'},
  land:         {label:'Αγορά οικοπέδου',        desc:'Αγορά οικοπέδου ή αγροτεμαχίου',      rate_from:3.50, rate_to:5.00, typical_ltv:60, notes:'Χαμηλότερο δάνειο προς αξία', docs:[
    {name:'Δελτίο ταυτότητας ή διαβατήριο'},
    {name:'Φορολογικά στοιχεία εισοδήματος', where:'ΑΑΔΕ'},
    {name:'Τοπογραφικό διάγραμμα', where:'Μηχανικός'},
    {name:'Βεβαίωση αρτιότητας και οικοδομησιμότητας', where:'Πολεοδομία'},
  ], tax_note:'Φόρος μεταβίβασης 3,09% (3% συν 3% υπέρ ΟΤΑ επί του φόρου). Έλεγξε τη χρήση γης και τις εκτός σχεδίου διατάξεις'},
  refinance:    {label:'Αναχρηματοδότηση',       desc:'Μεταφορά δανείου σε άλλη τράπεζα',     rate_from:2.40, rate_to:4.90, typical_ltv:80, notes:'Εξοικονόμηση από χαμηλότερο επιτόκιο', docs:[
    {name:'Δελτίο ταυτότητας ή διαβατήριο'},
    {name:'Φορολογικά στοιχεία εισοδήματος', where:'ΑΑΔΕ'},
    {name:'Πίνακας αποπληρωμής τρέχοντος δανείου', where:'Τράπεζα'},
    {name:'Τίτλος ιδιοκτησίας', where:'Κτηματολόγιο'},
  ], tax_note:'Υπολόγισε το κόστος μεταφοράς και την ποινή πρόωρης αποπληρωμής στα σταθερά'},
}

// ══ ΤΑ ΕΝΕΡΓΕΙΑΚΑ ΠΡΟΓΡΑΜΜΑΤΑ ΤΗΣ ΣΗΜΕΙΩΣΗΣ ΕΙΝΑΙ ΟΣΑ ΔΕΧΟΝΤΑΙ ΑΙΤΗΣΗ ΣΗΜΕΡΑ ══
// Η ενεργειακή αναβάθμιση έγραφε «Επιλέξιμο για Εξοικονομώ 2025 (προθεσμία
// 30/06/2026) και Αναβαθμίζω (31/08/2026)» μήνες αφότου είχαν κλείσει και τα
// δύο, ενώ ο κατάλογος πιο πάνω τα έδειχνε ήδη κλειστά. Η λίστα περνά τώρα από
// την ίδια `programStatus` με τον φακό «Κρατικά προγράμματα» (lib/loans/energyPrograms).
export function energyProgramsNote(today: string = athensToday()): string {
  const open = openEnergyPrograms(today)
  return open.length
    ? `Επιλέξιμο για ${joinGreek(open)}`
    : 'Κανένα κρατικό πρόγραμμα ενεργειακής αναβάθμισης δεν δέχεται αιτήσεις σήμερα. Τι έρχεται θα το βρεις στα «Κρατικά προγράμματα»'
}

/** Η φορολογική σημείωση του τύπου δανείου, όπως ισχύει σήμερα. */
export const loanTaxNote = (t: LoanType, today?: string): string =>
  t === 'energy' ? energyProgramsNote(today) : LOAN_TYPES[t].tax_note

// Το τυπικό εύρος επιτοκίου ενός τύπου δανείου, ως κείμενο.
//
// Ήταν χειρόγραφη συμβολοσειρά μέσα στα δεδομένα («2,60–3,80%»): δεύτερη πηγή
// μορφοποίησης, με δικό της κόμμα και δική της παύλα, δίπλα στον ΕΝΑ
// μορφοποιητή ποσοστού της εφαρμογής. Τώρα οι δύο άκρες είναι αριθμοί και το
// κείμενο βγαίνει από το fp(). Και γράφεται «από … έως …», όχι με παύλα: η
// παύλα σε θέση τιμής σημαίνει «δεν υπάρχει τιμή», όχι «εύρος».
export const rateRange = (t:{rate_from:number;rate_to:number}) => `${fp(t.rate_from)} έως ${fp(t.rate_to)}`

export const BORROWER_PROFILES: Record<BorrowerType,{label:string;income_ratio:number;notes:string;special:string;tax_benefits:string}> = {
  individual:  {label:'Μισθωτός',              income_ratio:0.35, notes:'Δόση ≤35% εισοδήματος', special:'', tax_benefits:'Απαλλαγή ΦΜΑ εάν πρώτη κατοικία'},
  professional:{label:'Ελεύθερος επαγγελματίας', income_ratio:0.40, notes:'2 χρόνια φορολογικά', special:'Μέση 2ετίας', tax_benefits:'Εκπιπτόμενες επαγγελματικές δαπάνες'},
  company:     {label:'Εταιρεία',              income_ratio:0.40, notes:'Ισολογισμοί και απόφαση διοικητικού συμβουλίου', special:'Εγγύηση φυσικού προσώπου', tax_benefits:'Πλήρης έκπτωση δαπανών δανείου'},
  // Οι σημειώσεις του νέου και της οικογένειας περιέγραφαν το «Σπίτι μου ΙΙ»
  // («πολύ χαμηλό», ηλικία 25–50, επιδότηση επιτοκίου για τρίτεκνους) ως
  // διαθέσιμο. Μένει ό,τι ισχύει χωρίς το πρόγραμμα.
  young:       {label:'Νέος 25–40 ετών',       income_ratio:0.35, notes:'Δόση ≤35% εισοδήματος', special:'', tax_benefits:'Απαλλαγή ΦΜΑ εάν πρώτη κατοικία'},
  family:      {label:'Οικογένεια/Πολύτεκνη', income_ratio:0.40, notes:'Συν-δανειολήπτες', special:'', tax_benefits:'Υψηλότερα όρια απαλλαγής ΦΜΑ'},
  senior:      {label:'50+ ετών',              income_ratio:0.30, notes:'Μέγιστη ηλικία 75', special:'Ηλικία+χρόνια ≤75', tax_benefits:'Κανονικοί συντελεστές'},
  military:    {label:'Ένοπλες Δυνάμεις',      income_ratio:0.40, notes:'Σταθερό εισόδημα, ευνοϊκή αξιολόγηση', special:'ΑΟΟΑ και Ταμείο Παρακαταθηκών και Δανείων', tax_benefits:'Έλεγξε τα προγράμματα του ΑΟΟΑ πριν την τράπεζα'},
  abroad:      {label:'Κάτοικος Εξωτερικού',   income_ratio:0.35, notes:'Επιπλέον έγγραφα', special:'Δάνειο προς αξία ≤70%', tax_benefits:'Εξαρτάται από χώρα'},
}

// Γλωσσάρι σε σωστά ελληνικά — ο ελληνικός όρος πρώτα, η διεθνής ονομασία μόνο
// σε παρένθεση όπου είναι ο επίσημος όρος. Το πεδίο level διαχωρίζει τους
// βασικούς όρους (για κάθε ιδιώτη) από τους προχωρημένους (για επαγγελματίες).
export const GLOSSARY: {term:string;def:string;level:'basic'|'advanced'}[] = [
  {term:'Δάνειο προς αξία',                       def:'Το ποσοστό του δανείου ως προς την αξία του ακινήτου. Παράδειγμα: 80% σημαίνει δάνειο 80% και ίδια κεφάλαια 20%. Χαμηλότερο ποσοστό οδηγεί σε χαμηλότερο επιτόκιο.', level:'basic'},
  {term:'Δείκτης δόσης προς εισόδημα',            def:'Το ποσοστό του μηνιαίου εισοδήματος που καλύπτει τη δόση. Όρια της Τράπεζας της Ελλάδος από 1/1/2025: έως 50% για όσους δανείζονται για πρώτη φορά, έως 40% για τους υπόλοιπους. Οι τράπεζες συχνά ζητούν χαμηλότερο.', level:'basic'},
  {term:'Τοκοχρεολύσιο',                          def:'Η μηνιαία δόση, που περιλαμβάνει κεφάλαιο και τόκο. Στην αρχή υπερισχύει ο τόκος· σταδιακά μεγαλώνει το μέρος του κεφαλαίου.', level:'basic'},
  {term:'Περιθώριο τράπεζας',                     def:'Το σταθερό ποσοστό που προσθέτει η τράπεζα πάνω από το Euribor στα κυμαινόμενα δάνεια, για όλη τη διάρκεια.', level:'basic'},
  {term:'Euribor',                                def:'Το βασικό διατραπεζικό επιτόκιο αναφοράς της ευρωζώνης. Στα κυμαινόμενα δάνεια το επιτόκιο διαμορφώνεται ως Euribor συν το περιθώριο της τράπεζας.', level:'basic'},
  {term:'Πιστοποιητικό Ενεργειακής Απόδοσης',     def:'Κατατάσσει ενεργειακά το ακίνητο, από Α+ (η υψηλότερη κατηγορία) έως Η. Απαιτείται για τη μεταβίβαση και για τα ενεργειακά προγράμματα.', level:'basic'},
  {term:'Φόρος Μεταβίβασης Ακινήτων',             def:'Φόρος 3% συν 3% υπέρ ΟΤΑ επί του φόρου, δηλαδή 3,09% συνολικά, επί της μεγαλύτερης μεταξύ τιμήματος και αντικειμενικής αξίας. Βαρύνει τον αγοραστή. Προβλέπεται απαλλαγή πρώτης κατοικίας εντός ορίων.', level:'basic'},
  {term:'Τειρεσίας',                              def:'Το σύστημα καταγραφής αθετήσεων πληρωμών. Οι τράπεζες τον ελέγχουν πριν εγκρίνουν το δάνειο.', level:'basic'},
  {term:'Αριθμός Ταυτότητας Ακινήτου',            def:'Ο μοναδικός κωδικός κάθε ακινήτου στο Κτηματολόγιο και την ΑΑΔΕ.', level:'advanced'},
  {term:'Σημείο απόσβεσης',                       def:'Οι μήνες που χρειάζονται ώστε η μηνιαία εξοικονόμηση από μια αναχρηματοδότηση να καλύψει τα έξοδα μεταφοράς του δανείου.', level:'advanced'},
  {term:'Περίοδος χάριτος',                       def:'Διάστημα, συνήθως 1 έως 2 έτη, όπου πληρώνεις μόνο τόκους χωρίς αποπληρωμή κεφαλαίου.', level:'advanced'},
  {term:'Σύμβαση Αποφυγής Διπλής Φορολογίας',     def:'Διακρατική σύμβαση ώστε το ίδιο εισόδημα να μη φορολογείται σε δύο χώρες. Αφορά κυρίως κατοίκους εξωτερικού.', level:'advanced'},
]

// ═══════════════════════════════════════════════════════════════════════════
// Διαχειριστές δανείων (servicers) & κόκκινα δάνεια — έντιμη, τεκμηριωμένη
// πληροφόρηση (όχι νομική/χρηματοοικονομική συμβουλή). Στοιχεία: Ιούλιος 2026.
// Πηγές: Υπ. Εθνικής Οικονομίας, ΕΓΔΙΧ (keyd.gov.gr), Τράπεζα Ελλάδος, ΕΕΔΑΔΠ.
// ═══════════════════════════════════════════════════════════════════════════
export const SERVICERS_GUIDE = {
  // ΔΥΟ ΠΡΟΤΑΣΕΙΣ ΜΕ ΔΙΑΦΟΡΕΤΙΚΟ ΒΑΡΟΣ, ΟΧΙ ΕΝΑ ΤΕΤΡΑΓΡΑΜΜΟ. Η πρώτη είναι το
  // μόνο που χρειάζεται να κρατήσει ο ιδιοκτήτης που μόλις έμαθε ότι το δάνειό
  // του άλλαξε χέρια. Η δεύτερη είναι το πλαίσιο που το στηρίζει και διαβάζεται
  // αν το θέλει. Πριν, ήταν μία παράγραφος τεσσάρων γραμμών όπου η απάντηση
  // στο «τι μου συμβαίνει;» καθόταν στη μέση.
  lead: 'Αν το δάνειό σου μεταβιβάστηκε σε εταιρεία απόκτησης απαιτήσεων (fund) και το διαχειρίζεται εταιρεία διαχείρισης (servicer), η νομική σου θέση δεν επιτρέπεται να χειροτερέψει από τη μεταβίβαση.',
  intro: 'Ο servicer πρέπει να είναι αδειοδοτημένος από την Τράπεζα Ελλάδος και δεσμεύεται από τον Κώδικα Δεοντολογίας: υποχρεώσεις διαφάνειας, ενημέρωσης και πρόταση βιώσιμης ρύθμισης πριν από κάθε αναγκαστική εκτέλεση.',
  // ΟΙ ΤΙΤΛΟΙ ΕΙΝΑΙ ΕΤΙΚΕΤΕΣ, ΟΧΙ ΠΕΡΙΛΗΨΕΙΣ. Ηταν 27 ως 37 χαρακτήρες, οπότε
  // στην ίδια σειρά τεσσάρων στηλών δύο έσπαγαν σε δύο γραμμές και δύο σε
  // τρεις: τέσσερα πλακίδια με το κείμενο σε άλλο ύψος το καθένα. Κοντύτεροι
  // και κοντά στο ίδιο μήκος, πέφτουν στις ίδιες γραμμές. Η πλήρης διατύπωση
  // δεν χάθηκε — ζει στο κείμενο του ⓘ, που είναι και ο λόγος που υπάρχει.
  rights: [
    { t: 'Η θέση σου δεν χειροτερεύει', d: 'Με τη μεταβίβαση της απαίτησης δεν επιτρέπεται μονομερής μεταβολή του επιτοκίου ή των όρων της σύμβασης εις βάρος σου. Ισχύουν τα ίδια δικαιώματα και ενστάσεις που είχες έναντι της τράπεζας.' },
    { t: 'Βιώσιμη πρόταση ρύθμισης', d: 'Δικαιούσαι πρόταση ρύθμισης πριν από κάθε πλειστηριασμό. Ο Κώδικας Δεοντολογίας της Τράπεζας Ελλάδος υποχρεώνει τον servicer να σου προτείνει κατάλληλη ρύθμιση βάσει της πραγματικής σου ικανότητας αποπληρωμής, πριν προχωρήσει σε πλειστηριασμό.' },
    { t: 'Ανάλυση της οφειλής', d: 'Δικαιούσαι πλήρη ενημέρωση: αναλυτική κατάσταση κεφαλαίου, τόκων, εξόδων και του τρόπου υπολογισμού. Ζήτησέ την εγγράφως και έλεγξε παραγραφές και καταχρηστικές χρεώσεις.' },
    { t: 'Καταγγελία και προσφυγή', d: 'Αν ο servicer δεν τηρεί τις υποχρεώσεις του, υποβάλλεις καταγγελία πρώτα σε αυτόν και στη συνέχεια στην Τράπεζα Ελλάδος ή στον Συνήγορο του Καταναλωτή.' },
  ],
  tools: [
    { name: 'Εξωδικαστικός Μηχανισμός Ρύθμισης Οφειλών', d: 'Ηλεκτρονική πλατφόρμα (ΕΓΔΙΧ) που ρυθμίζει συνολικά οφειλές σε Δημόσιο, ΕΦΚΑ, τράπεζες και servicers. Δυνατότητα διαγραφής (κουρέματος) μέρους της οφειλής και αναστολή πλειστηριασμών/κατασχέσεων όσο τηρείται η ρύθμιση.', facts: ['Έως 240 δόσεις σε Δημόσιο/ΕΦΚΑ', 'Έως 420 δόσεις σε τράπεζες/servicers για φυσικά πρόσωπα με εμπράγματες εξασφαλίσεις', '240 δόσεις χωρίς ειδικά προνόμια · 180 για νομικά πρόσωπα'], url: 'https://www.keyd.gov.gr/ryumish_ofeilvn_ejvdik/' },
    { name: 'Ευάλωτοι οφειλέτες: υποχρεωτική αποδοχή', d: 'Για πιστοποιημένους ευάλωτους οφειλέτες (και ευάλωτους ΑμεΑ), η πρόταση αναδιάρθρωσης που παράγει η πλατφόρμα γίνεται υποχρεωτικά αποδεκτή από τράπεζες και Δημόσιο. Το πρόγραμμα «Κρατάμε το σπίτι μας» προβλέπει επιπλέον κούρεμα χρέους.', facts: ['Αυτόματη/υποχρεωτική αποδοχή για ευάλωτους', 'Πρόσθετο κούρεμα έως ~28% στο «Κρατάμε το σπίτι μας»'], url: 'https://minfin.gov.gr/diacheirisi-idiotikou-xreous/rythmisi-ofeilon/exodikastikos-michanismos-rythmisis-ofeilon/' },
    { name: 'Φορέας Απόκτησης και Επαναμίσθωσης Ακινήτων', d: 'Για ευάλωτους οφειλέτες που κινδυνεύουν να χάσουν την πρώτη κατοικία: ο Φορέας αποκτά το ακίνητο και το επαναμισθώνει υποχρεωτικά στον οφειλέτη για 12 έτη, με δικαίωμα επαναγοράς στην τρέχουσα εμπορική αξία.', facts: ['Έναρξη λειτουργίας: φθινόπωρο 2026', 'Επαναμίσθωση 12 ετών · δικαίωμα επαναγοράς', 'Στοχεύει ~15.000 νοικοκυριά'], url: 'https://minfin.gov.gr/diacheirisi-idiotikou-xreous/' },
  ],
  redFlags: [
    'Πληρωμή «έναντι» χωρίς έγγραφη ρύθμιση: ζήτησε πάντα την πλήρη σύμβαση ρύθμισης πριν πληρώσεις.',
    'Παραίτηση από ενστάσεις ή αναγνώριση οφειλής: μην υπογράφεις δήλωση που παραιτείται από παραγραφές ή δικαιώματα χωρίς νομικό έλεγχο.',
    'Ρύθμιση με χαμηλή αρχική δόση αλλά «μπαλόνι» στο τέλος (balloon): έλεγξε το συνολικό κόστος, όχι μόνο την πρώτη δόση.',
    'Πίεση για γρήγορη υπογραφή: έχεις δικαίωμα χρόνου μελέτης και εξωτερικής συμβουλής.',
  ],
  sources: [
    { label: 'ΕΓΔΙΧ: Εξωδικαστικός μηχανισμός', sub: 'Ειδική Γραμματεία Διαχείρισης Ιδιωτικού Χρέους', url: 'https://www.keyd.gov.gr/ryumish_ofeilvn_ejvdik/' },
    { label: 'Υπ. Εθνικής Οικονομίας: Ρύθμιση οφειλών', sub: 'Επίσημο πλαίσιο, δόσεις, κριτήρια', url: 'https://minfin.gov.gr/diacheirisi-idiotikou-xreous/rythmisi-ofeilon/exodikastikos-michanismos-rythmisis-ofeilon/' },
    { label: 'Μητρώο διαχειριστών: Τράπεζα Ελλάδος', sub: 'Κατάλογος αδειοδοτημένων εταιρειών διαχείρισης και Κώδικας Δεοντολογίας', url: 'https://www.bankofgreece.gr/kyria-themata/epopteia/epopteuomena-idrymata/etaireies-diaxeirisis-apaitiseon' },
    { label: 'Ένωση Εταιρειών Διαχείρισης (ΕΕΔΑΔΠ)', sub: 'Πληροφορίες κλάδου servicers', url: 'https://eedadp.com/' },
    { label: 'Συνήγορος του Καταναλωτή', sub: 'Ανεξάρτητη αρχή, εξωδικαστική επίλυση διαφορών', url: 'https://www.synigoroskatanaloti.gr' },
  ],
}

// Η δόση υπολογίζεται ΜΙΑ φορά, στο lib/loans/progress. Εδώ έμενε τρίτο
// αντίγραφο της ίδιας πράξης, χωρίς φύλαξη για NaN.
export { monthlyPayment as calcMonthly } from '@/lib/loans/progress'
import { monthlyPayment as calcMonthly } from '@/lib/loans/progress'

export function calcAmortization(amount:number,annualRate:number,years:number):AmortRow[] {
  const rows:AmortRow[]=[],r=annualRate/100/12,monthly=calcMonthly(amount,annualRate,years)
  let balance=amount,totalInterest=0
  for(let i=1;i<=years*12;i++){
    const interest=balance*r,principal=monthly-interest
    totalInterest+=interest;balance=Math.max(0,balance-principal)
    rows.push({month:i,payment:monthly,principal,interest,balance,totalInterestPaid:totalInterest})
  }
  return rows
}

export function calcFmaExemption(maritalStatus:'single'|'married',children:number):number {
  let limit=maritalStatus==='single'?TAX_DATA.fma_exemption.single:TAX_DATA.fma_exemption.married
  if(children>=1)limit+=TAX_DATA.fma_exemption.child1
  if(children>=2)limit+=TAX_DATA.fma_exemption.child2
  if(children>=3)limit+=TAX_DATA.fma_exemption.child3*(children-2)
  return limit
}

// Κοινή πηγή αλήθειας (lib/billing/greekTax), ώστε ο φόρος να μη διαφέρει ανά καρτέλα.
export function calcRentalTax(annualRental:number):number {
  return rentalIncomeTax(annualRental)
}

/** Φορολογητέο ενοίκιο μετά την τεκμαρτή έκπτωση — ΜΙΑ πηγή για το 5% και τον όρο του.
 *
 *  02.10.2026: ο συντελεστής ήταν τυφλός στη χρονιά (`presumptiveDeductionRate`)
 *  και έκοβε την έκπτωση για μετρητά ήδη από το 2026. Η προϋπόθεση της
 *  τραπεζικής είσπραξης ισχύει για μισθώματα από 1.7.2027, οπότε μετράει η
 *  χρήση: προεπιλογή η τρέχουσα. */
export function taxableRental(annualRental:number, rentsPaidViaBank=true, taxYear:number=athensParts().year):number {
  return Math.max(0, annualRental) * (1 - presumptiveDeductionRateForYear(taxYear, rentsPaidViaBank))
}

export const fmtEur=(n:number)=>fe(n)
export const fmtPct=(n:number)=>`${fp(n)}`
export const fmtPct1=(n:number)=>`${fp(n)}`