// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΜΟΝΤΕΛΟ ΤΟΥ ΥΠΟΛΟΓΙΣΤΗ ΔΑΝΕΙΟΥ: ΕΠΙΛΟΓΕΣ, ΕΤΟΙΜΑ ΣΕΝΑΡΙΑ, ΠΕΡΙΟΧΕΣ,
// ΣΥΜΒΟΛΑΙΟΓΡΑΦΙΚΑ
// ─────────────────────────────────────────────────────────────────────────
// Ζούσαν στην κορυφή του TabLoanCalculator.tsx, ανάμεσα στα γραφήματα και στην
// οθόνη. Καθαρά δεδομένα και καθαρές συναρτήσεις, χωρίς React: τα ελέγχει το
// loan/calc/model.test.ts χωρίς περιηγητή.
// ═══════════════════════════════════════════════════════════════════════════
import { fp, feWhole } from '@/lib/core/format'
import { firstHomeExemption } from '@/lib/accounting/transfer'
import { LOAN_TYPES, BORROWER_PROFILES, rateRange, type LoanType, type RateType, type BorrowerType } from '../../TabLoanData'
import { greekWhen, MONTH_MEAN } from '@/lib/market/ecb'
import { monthGen } from '@/lib/core/months'
import { regionByKey, GREECE_AVG_GROSS_YIELD } from '@/lib/market/greekMarket'

export const PROPERTY_TYPES = [
  {value:'residence',    label:'Κατοικία',              desc:'Διαμέρισμα, μονοκατοικία, μεζονέτα'},
  {value:'new_residence',label:'Νεόδμητη κατοικία',     desc:'Άδεια μετά το 2006, ΦΠΑ σε αναστολή'},
  {value:'store',        label:'Κατάστημα / Γραφείο',   desc:'Επαγγελματική χρήση'},
  {value:'warehouse',    label:'Αποθήκη / Βιομηχανικό', desc:'Βιομηχανική / αποθήκευση'},
  {value:'land',         label:'Οικόπεδο / Γη',         desc:'Εντός ή εκτός σχεδίου'},
  {value:'parking',      label:'Θέση στάθμευσης',       desc:'Αυτοτελής ή παράρτημα'},
]

export function calcNotaryFees(propValue:number):{notary:number;landReg:number;agent:number;legal:number;other:number;total:number;breakdown:{l:string;v:number}[]} {
  let notaryFee=0
  const bands=[{up:120000,rate:0.008},{up:380000,rate:0.007},{up:2000000,rate:0.0065},{up:Infinity,rate:0.006}]
  let remaining=propValue,prev=0
  for(const band of bands){
    const chunk=Math.min(remaining,band.up-prev);if(chunk<=0)break
    notaryFee+=chunk*band.rate;remaining-=chunk;prev=band.up
  }
  notaryFee=Math.max(notaryFee,200)
  const mortgageDeed=notaryFee*0.4
  const landReg=propValue*0.00475
  const legal=Math.min(Math.max(propValue*0.003,300),1500)
  const mortgageTax=propValue*0.001
  const total=notaryFee+mortgageDeed+landReg+legal+mortgageTax
  // Η ΑΝΑΛΥΣΗ ΛΕΕΙ ΜΟΝΟ Ο,ΤΙ ΔΕΝ ΛΕΝΕ ΗΔΗ ΤΑ ΠΛΑΚΙΔΙΑ. Από τις πέντε γραμμές, οι
  // τρεις (κτηματολόγιο, δικηγόρος, φόρος ενεγγύησης) ήταν αντιγραφή τριών
  // πλακιδίων που κάθονται δέκα εικονοστοιχεία πιο πάνω, με το ίδιο νούμερο.
  //
  // ΚΑΙ Η ΠΕΜΠΤΗ ΗΤΑΝ ΛΑΘΟΣ. Σε επαγγελματικό ακίνητο έγραφε «Τέλη χαρτοσήμου
  // μίσθωσης (3,6%)» μέσα στα έξοδα ΑΓΟΡΑΣ: τέλος που αφορά μίσθωση, όχι
  // απόκτηση, με νούμερο που δεν έμπαινε ποτέ στο σύνολο. Σε κατάστημα 200.000€
  // εμφάνιζε 7.200€ κόστος που κανείς δεν πληρώνει στη μεταβίβαση.
  //
  // Μένει αυτό που ΜΟΝΟ εδώ φαίνεται: πώς σπάει η αμοιβή του συμβολαιογράφου.
  const breakdown=[
    {l:'Συμβολαιογραφικά αγοράς', v:notaryFee},
    {l:'Συμβολαιογραφικά υποθήκης', v:mortgageDeed},
  ]
  return{notary:notaryFee+mortgageDeed,landReg,agent:0,legal,other:mortgageTax,total,breakdown}
}

export const LOAN_TYPE_OPTIONS = Object.entries(LOAN_TYPES).map(([k,v])=>({value:k,label:v.label,description:`${rateRange(v)} · Δάνειο προς αξία έως ${fp(v.typical_ltv)}`}))
export const BORROWER_OPTIONS  = Object.entries(BORROWER_PROFILES).map(([k,v])=>({value:k,label:v.label,description:v.notes}))
/** «μέσος όρος Σεπτεμβρίου 2026» για μέσο όρο μήνα, αλλιώς η ημερομηνία της τιμής. */
export const euriborPeriod = (asOf: string, basis: string): string => {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(asOf || '')
  return m && basis === MONTH_MEAN ? `μέσος όρος ${monthGen(Number(m[2]) - 1)} ${m[1]}` : `${basis}, ${greekWhen(asOf, basis)}`
}
export const RATE_TYPE_OPTIONS = [{value:'fixed',label:'Σταθερό',description:'Σταθερό για την επιλεγμένη περίοδο'},{value:'variable',label:'Κυμαινόμενο',description:'Euribor συν περιθώριο τράπεζας'},{value:'mixed',label:'Μεικτό',description:'Σταθερό αρχικά, μετά κυμαινόμενο'}]
export const FIXED_PERIOD_OPTIONS = ['3','5','10','15','20'].map(v=>({value:v,label:`${v} χρόνια`,description:v==='5'?'Πιο συνηθισμένο':v==='10'?'Καλή ισορροπία':''}))
// ΤΑ ΟΡΙΑ ΤΗΣ ΑΠΑΛΛΑΓΗΣ ΑΠΟ ΤΟ transfer.ts, ΟΧΙ ΓΡΑΜΜΕΝΑ ΕΔΩ. Η καρτέλα είχε
// δεύτερο αντίγραφο του πίνακα και δίπλα του άλλον κανόνα· οι περιγραφές των
// επιλογών ήταν το τρίτο αντίγραφο.
const kidsExtra = (n: number) => firstHomeExemption({ children: n }) - firstHomeExemption({ children: 0 })
export const MARITAL_OPTIONS   = [{value:'single',label:'Άγαμος / Άγαμη',description:`Όριο ΦΜΑ: ${feWhole(firstHomeExemption({ married: false }))}`},{value:'married',label:'Έγγαμος / Έγγαμη',description:`Όριο ΦΜΑ: ${feWhole(firstHomeExemption({ married: true }))}`}]
export const CHILDREN_OPTIONS  = [0,1,2,3,4,5].map(n=>({value:String(n),label:n===0?'Χωρίς τέκνα':`${n} εξαρτώμεν${n===1?'ο':'α'} τέκν${n===1?'ο':'α'}`,description:n===0?'':`+${feWhole(kidsExtra(n))}`}))
export const PROP_TYPE_OPTIONS = PROPERTY_TYPES.map(p=>({value:p.value,label:p.label,description:p.desc}))

// ══ ΤΟ ΕΠΙΤΟΚΙΟ ΤΟΥ ΝΕΟΥ ΑΓΟΡΑΣΤΗ ΗΤΑΝ ΤΟΥ «ΣΠΙΤΙ ΜΟΥ ΙΙ» ══════════════════
// Η προεπιλογή έγραφε 1,80% με περιγραφή «Σπίτι μου ΙΙ»: το μεικτό επιτόκιο με
// το μισό δάνειο χωρίς τόκο, για πρόγραμμα που δεν δέχεται πια αιτήσεις. Κανένα
// τιμολόγιο τράπεζας δεν δίνει 1,80% σε σταθερό. Τώρα είναι το χαμηλότερο
// σταθερό των τραπεζών που δείχνει η σύγκριση (`fixed_min`, σταθερό 3 έως 5
// ετών), που ταιριάζει με την πενταετή σταθερή περίοδο της προεπιλογής. Δεν
// γράφεται αριθμός με το χέρι: όταν αλλάξει ο πίνακας, αλλάζει και η προεπιλογή.
export const presetsFor = (firstBuyerRate:string) => [
  {id:'first_buyer',label:'Νέος αγοραστής',desc:'Πρώτη κατοικία',color:'var(--accent-dim)',border:'var(--border-accent)',textColor:'var(--accent)',values:{loanAmount:'150000',propValue:'185000',sqm:'80',rate:firstBuyerRate,years:'25',rateType:'fixed' as RateType,loanType:'first_home' as LoanType,borrower:'young' as BorrowerType,fixedPeriod:'5',propType:'residence',area:'center_athens'}},
  {id:'investor',label:'Επενδυτής',desc:'Ακίνητο προς ενοικίαση',color:'var(--accent-dim)',border:'var(--border-accent)',textColor:'var(--accent)',values:{loanAmount:'200000',propValue:'280000',sqm:'90',rate:'3.20',years:'20',rateType:'fixed' as RateType,loanType:'investment' as LoanType,borrower:'individual' as BorrowerType,fixedPeriod:'5',propType:'residence',area:'south_suburbs'}},
  {id:'commercial',label:'Επαγγελματικό',desc:'Κατάστημα / Γραφείο',color:'var(--accent-dim)',border:'var(--border-accent)',textColor:'var(--accent)',values:{loanAmount:'150000',propValue:'220000',sqm:'50',rate:'3.80',years:'15',rateType:'fixed' as RateType,loanType:'commercial' as LoanType,borrower:'professional' as BorrowerType,fixedPeriod:'5',propType:'store',area:'center_athens'}},
  {id:'renovation',label:'Ανακαίνιση',desc:'Ενεργειακή αναβάθμιση',color:'var(--accent-dim)',border:'var(--border-accent)',textColor:'var(--accent)',values:{loanAmount:'25000',propValue:'200000',sqm:'85',rate:'2.90',years:'15',rateType:'fixed' as RateType,loanType:'energy' as LoanType,borrower:'individual' as BorrowerType,fixedPeriod:'5',propType:'residence',area:'center_athens'}},
]

// ΤΟ ΟΝΟΜΑ ΕΙΝΑΙ ΟΙ ΓΕΙΤΟΝΙΕΣ, ΟΧΙ ΤΟ ΓΡΑΜΜΑ. «Αθήνα Κέντρο Β» δεν έλεγε τίποτα
// σε κανέναν· το «Β» ήταν εσωτερική διαβάθμιση τιμών. Η βαθμίδα κατεβαίνει στην
// περιγραφή, όπου χρησιμεύει για να διαλέξεις ανάμεσα σε δύο γειτονικές ζώνες.
export const AREA_OPTIONS = [
  {value:'attica_center_prime',label:'Αθήνα: Κολωνάκι, Σύνταγμα, Πλάκα',description:'Κέντρο, ακριβότερη ζώνη'},
  {value:'attica_center_std',label:'Αθήνα: Κυψέλη, Ζωγράφου, Παγκράτι',description:'Κέντρο, μεσαία ζώνη'},
  {value:'attica_south_prime',label:'Νότια: Γλυφάδα, Βούλα, Βουλιαγμένη',description:'Νότια προάστια, ακριβότερη ζώνη'},
  {value:'attica_south_std',label:'Νότια: Άλιμος, Ελληνικό, Αργυρούπολη',description:'Νότια προάστια, μεσαία ζώνη'},
  {value:'attica_north_prime',label:'Βόρεια: Κηφισιά, Εκάλη, Διόνυσος',description:'Βόρεια προάστια, ακριβότερη ζώνη'},
  {value:'attica_north_std',label:'Βόρεια: Μαρούσι, Χαλάνδρι, Αγία Παρασκευή',description:'Βόρεια προάστια, μεσαία ζώνη'},
  {value:'attica_east',label:'Αττική Ανατολική',description:'Παλλήνη, Κορωπί, Σπάτα'},
  {value:'attica_west',label:'Αττική Δυτική',description:'Περιστέρι, Αιγάλεω, Ίλιον'},
  {value:'attica_piraeus_prime',label:'Πειραιάς: Καστέλα, Φρεαττύδα',description:'Ακριβότερη ζώνη'},
  {value:'attica_piraeus_std',label:'Πειραιάς: Κερατσίνι, Νίκαια',description:'Μεσαία ζώνη'},
  {value:'thess_center',label:'Θεσσαλονίκη Κέντρο',description:'Κέντρο, ΑΠΘ, Λαδάδικα'},
  {value:'thess_east',label:'Θεσσαλονίκη Ανατολικά',description:'Καλαμαριά, Τριανδρία'},
  {value:'thess_suburbs_n',label:'Θεσσαλονίκη Βόρεια',description:'Πυλαία, Θέρμη'},
  {value:'crete_heraklion',label:'Ηράκλειο Κρήτης',description:'Ηράκλειο, Γάζι'},
  {value:'crete_chania',label:'Χανιά',description:'Χανιά, Ακρωτήρι'},
  {value:'mykonos',label:'Μύκονος',description:'Μύκονος, Άνω Μέρα'},
  {value:'santorini',label:'Σαντορίνη',description:'Φηρά, Οία'},
  {value:'rhodes',label:'Ρόδος',description:'Ρόδος πόλη, Λίνδος'},
  {value:'corfu',label:'Κέρκυρα',description:'Κέρκυρα πόλη'},
  {value:'patras',label:'Αχαΐα',description:'Πάτρα, Ρίο'},
  {value:'larissa',label:'Λάρισα',description:'Λάρισα, Τύρναβος'},
  {value:'volos',label:'Μαγνησία',description:'Βόλος, Πήλιο'},
  {value:'ioannina',label:'Ιωάννινα',description:'Ιωάννινα, Ζαγόρι'},
  {value:'other',label:'Άλλη περιοχή',description:''},
]

// Αντιστοίχιση περιοχής δανείου → ζώνη του lib/market/greekMarket, ώστε το
// ενοίκιο-αναφορά να προκύπτει από ΤΕΚΜΗΡΙΩΜΕΝΗ μεικτή απόδοση της περιοχής (με
// πηγή και ημερομηνία) και όχι από το επινοημένο «4% της αξίας», που έδινε το ίδιο
// νούμερο στην Κοζάνη και στο Κολωνάκι. Το «Άλλη περιοχή» πέφτει στον εθνικό μέσο.
const AREA_TO_REGION: Record<string,string> = {
  attica_center_prime:'ath_kolonaki', attica_center_std:'ath_center',
  attica_south_prime:'ath_south', attica_south_std:'ath_south',
  attica_north_prime:'ath_north', attica_north_std:'ath_north',
  attica_east:'east_attica', attica_west:'ath_west',
  attica_piraeus_prime:'piraeus', attica_piraeus_std:'piraeus',
  thess_center:'thess_center', thess_east:'thess_kalamaria', thess_suburbs_n:'thess_kalamaria',
  crete_heraklion:'heraklion', crete_chania:'chania',
  mykonos:'mykonos', santorini:'santorini', rhodes:'rhodes', corfu:'corfu',
  patras:'patras', larissa:'larissa', volos:'volos', ioannina:'ioannina',
}
/** Τεκμηριωμένη μεικτή απόδοση (%) μακροχρόνιας μίσθωσης για την περιοχή δανείου. */
export function areaGrossYield(area:string): { pct:number; label:string; note:string } {
  const reg = regionByKey(AREA_TO_REGION[area] || '')
  if (reg) return { pct: reg.grossYield, label: reg.label, note: reg.note }
  return { pct: GREECE_AVG_GROSS_YIELD, label: 'Εθνικός μέσος όρος', note: 'Μέση μεικτή απόδοση μακροχρόνιας μίσθωσης στην Ελλάδα.' }
}

// Τα τέσσερα κελιά του σεναρίου γράφονται από ΜΙΑ συνάρτηση, οπότε το όνομα
// βγαίνει από το πεδίο που ήδη λέει ποιο είναι. Χωρίς αυτό, ο αναγνώστης οθόνης
// άκουγε τέσσερα «πλαίσιο κειμένου» ανά σενάριο και έξι σενάρια είναι εικοσιτέσσερα.
export const SCEN_NAME: Record<'label' | 'amount' | 'rate' | 'years', string> = {
  label: 'Όνομα σεναρίου', amount: 'Ποσό δανείου', rate: 'Επιτόκιο', years: 'Διάρκεια σε έτη',
}

export const NATURAL_BORROWERS:BorrowerType[] = ['individual','young','family','senior','military','abroad']
export const BUSINESS_BORROWERS:BorrowerType[] = ['professional','company']
