// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΜΟΝΤΕΛΟ ΤΟΥ ΥΠΟΛΟΓΙΣΤΗ ΔΑΝΕΙΟΥ: ΕΠΙΛΟΓΕΣ, ΕΤΟΙΜΑ ΣΕΝΑΡΙΑ, ΠΕΡΙΟΧΕΣ,
// ΕΞΟΔΑ ΑΓΟΡΑΣ
// ─────────────────────────────────────────────────────────────────────────
// Ζούσαν στην κορυφή του TabLoanCalculator.tsx, ανάμεσα στα γραφήματα και στην
// οθόνη. Καθαρά δεδομένα και καθαρές συναρτήσεις, χωρίς React: τα ελέγχει το
// loan/calc/model.test.ts χωρίς περιηγητή.
// ═══════════════════════════════════════════════════════════════════════════
import { fp, feWhole } from '@/lib/core/format'
import { firstHomeExemption, transferCosts, notaryFee, type TransferResult } from '@/lib/accounting/transfer'
import { mortgageCosts, type MortgageCosts } from '@/lib/loans/mortgageCosts'
import { LOAN_TYPES, BORROWER_PROFILES, rateRange, type LoanType, type RateType, type BorrowerType } from '../../TabLoanData'
import { greekWhen, MONTH_MEAN } from '@/lib/market/ecb'
import { monthGen } from '@/lib/core/months'
import { regionByKey, GREECE_AVG_GROSS_YIELD } from '@/lib/market/greekMarket'

export const PROPERTY_TYPES = [
  {value:'residence',    label:'Κατοικία',              desc:'Διαμέρισμα, μονοκατοικία, μεζονέτα'},
  // Η ΑΝΑΣΤΟΛΗ ΕΙΝΑΙ ΕΠΙΛΟΓΗ ΤΟΥ ΚΑΤΑΣΚΕΥΑΣΤΗ (27/10/2026): δίνεται «με αίτηση του
  // υποκειμένου» (άρθρο 70 Κώδικα ΦΠΑ). Το νεόδμητο είχε μία επιλογή, πάντα σε
  // αναστολή· όποιος αγόραζε από κατασκευαστή χωρίς αναστολή έβλεπε ΦΜΑ αντί
  // για ΦΠΑ 24%. Τώρα οι δύο περιπτώσεις είναι δύο επιλογές.
  {value:'new_residence',label:'Νεόδμητη κατοικία',     desc:'Ο κατασκευαστής σε αναστολή ΦΠΑ: φόρος μεταβίβασης'},
  {value:'new_residence_vat',label:'Νεόδμητη κατοικία με ΦΠΑ', desc:'Ο κατασκευαστής χωρίς αναστολή: ΦΠΑ στο τίμημα'},
  {value:'store',        label:'Κατάστημα / Γραφείο',   desc:'Επαγγελματική χρήση'},
  {value:'warehouse',    label:'Αποθήκη / Βιομηχανικό', desc:'Βιομηχανική / αποθήκευση'},
  {value:'land',         label:'Οικόπεδο / Γη',         desc:'Εντός ή εκτός σχεδίου'},
  {value:'parking',      label:'Θέση στάθμευσης',       desc:'Αυτοτελής ή παράρτημα'},
]

// ═══ ΤΑ ΕΞΟΔΑ ΑΓΟΡΑΣ ΤΟΥ ΔΑΝΕΙΟΥ ΕΙΝΑΙ ΤΑ ΕΞΟΔΑ ΑΓΟΡΑΣ ΤΗΣ ΛΟΓΙΣΤΙΚΗΣ ══════════
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (έλεγχος 19/10/2026, #7). Εδώ ζούσε η `calcNotaryFees`, δεύτερο
// μοντέλο εξόδων αγοράς με τιμές γραμμένες με το χέρι: συμβολαιογράφος χωρίς ΦΠΑ,
// Κτηματολόγιο 4,75‰ αντί για το 5‰ του ΦΕΚ, δικηγόρος με δικό του κατώτατο και
// ταβάνι, «φόρος ενεγγύησης» επί της αξίας του ακινήτου. Για 200.000€ το Δάνειο
// έγραφε 1.520€ / 950€ και η Λογιστική 1.984€ / 1.020€.
//
// Τώρα: τα έξοδα της αγοράς είναι το `transferCosts` (lib/accounting/transfer.ts),
// το ίδιο με τη Λογιστική. Τα έξοδα της υποθήκης, που υπάρχουν μόνο με δάνειο,
// είναι το `mortgageCosts` (lib/loans/mortgageCosts.ts), επί του κεφαλαίου του
// δανείου και με τη σήμανση «εκτίμηση». Αυτό το αρχείο μόνο τα συνθέτει.
export interface LoanPurchaseInput {
  value: number; loanAmount: number
  firstHome: boolean; married: boolean; children: number; newBuild: boolean
  /** Νεόδμητο από κατασκευαστή ΧΩΡΙΣ αναστολή ΦΠΑ: ΦΠΑ αντί για ΦΜΑ. */
  newBuildVat?: boolean
  /** Ποσοστό μεσίτη· `null` χωρίς μεσίτη. */
  agentPct: number | null
}
export interface LoanPurchaseCosts {
  tax: number; notary: number; landReg: number; legal: number; agent: number; other: number
  total: number; downpayment: number; totalCash: number
  breakdown: { l: string; v: number }[]
  /** Οι γραμμές της αγοράς, όπως τις δίνει το `transferCosts`. */
  purchase: TransferResult
  mortgage: MortgageCosts
}
export function loanPurchaseCosts(i: LoanPurchaseInput): LoanPurchaseCosts {
  const value = Math.max(0, i.value || 0)
  const loan = Math.max(0, i.loanAmount || 0)
  const purchase = transferCosts({
    side: 'buy', price: value, firstHome: i.firstHome, married: i.married, children: i.children, newBuild: i.newBuild,
    vatSuspended: !(i.newBuild && i.newBuildVat),
    useAgent: i.agentPct != null, agentRatePct: i.agentPct ?? undefined, useLawyer: true,
  })
  const line = (k: string) => purchase.lines.find(l => l.key === k)?.amount ?? 0
  const mortgage = mortgageCosts(loan, notaryFee(value))
  const total = purchase.totalCosts + mortgage.total
  return {
    tax: line('transferTax') + line('vat'), notary: line('notary') + mortgage.deed, landReg: line('cadastre'),
    legal: line('lawyer'), agent: line('agent'), other: line('certs') + mortgage.registration,
    total, downpayment: value - loan, totalCash: value - loan + total,
    // Μένει αυτό που ΜΟΝΟ εδώ φαίνεται: πώς σπάει η αμοιβή του συμβολαιογράφου.
    breakdown: [
      { l: 'Συμβολαιογραφικά αγοράς', v: line('notary') },
      { l: 'Συμβολαιογραφικά υποθήκης (εκτίμηση)', v: mortgage.deed },
    ],
    purchase, mortgage,
  }
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
/** Οι δύο επιλογές του νεόδμητου, με και χωρίς αναστολή ΦΠΑ. */
export const isNewBuildType = (t: string): boolean => t === 'new_residence' || t === 'new_residence_vat'
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
