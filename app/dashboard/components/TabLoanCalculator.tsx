'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { LensBar } from './LoanShared'
import { fp, fpRate } from '@/lib/core/format'
import { KPIGrid, Btn, ChipToggle, TT } from '@/components/Theme'
import { createClient } from '@/lib/supabase/client'
import * as properties from '@/lib/data/properties';
import { useReportBranding } from '@/lib/reportBranding'
import { notify, notifyError } from '@/components/Toast';
import {
  LOAN_TYPES,
  calcMonthly, calcAmortization, calcFmaExemption, loanTransferTax, calcRentalTax, taxableRental,
  fmtEur, fmtPct, fmtPct1, type ComparisonBank,
  LoanType, RateType, BorrowerType, LoanScenario, MarketRates, SavedLoan, rateTypeLabel
} from './TabLoanData'
import { athensToday, localDay } from '@/lib/core/time';
import { instalmentDate } from '@/lib/core/monthStep';
import { spitiMouEstimate, spitiMouClosedLine } from '@/lib/loans/recommend'
import { TRANSFER_TAX_RATE, NEW_BUILD_VAT_RATE } from '@/lib/accounting/transfer'
import { failed, MSG } from '@/lib/core/dbError';
import { ActionMenu } from '@/components/ActionMenu'
import { MARKET_DATA_ASOF } from '@/lib/market/greekMarket'
// ── Ο ΥΠΟΛΟΓΙΣΤΗΣ ΣΕ ΚΟΜΜΑΤΙΑ (loan/calc/) ──────────────────────────────────
// Ηταν ένα αρχείο 1.900 γραμμών. Εδώ μένουν η κατάσταση, οι υπολογισμοί της
// δόσης και της απόσβεσης και η σειρά της οθόνης· οι κάρτες πεδίων, η σύγκριση
// σεναρίων, οι πέντε φακοί, τα γραφήματα, οι εξαγωγές και οι επιλογές ζουν στον
// φάκελο loan/calc/. Η σύγκριση τραπεζών και η Συμβουλευτική δεν ήταν ποτέ εδώ:
// ζουν στο TabLoan και στο loan/LoanAdvisor.
import {
  PROPERTY_TYPES, calcNotaryFees, BORROWER_OPTIONS, presetsFor, AREA_OPTIONS, areaGrossYield,
  NATURAL_BORROWERS, BUSINESS_BORROWERS,
} from './loan/calc/model'
import { Section } from './loan/calc/Bits'
import { amortXlsx, amortPrintPdf, amortOfficialPdf } from './loan/calc/reports'
import { PropertyCard, LoanCard } from './loan/calc/InputCards'
import { Scenarios } from './loan/calc/Scenarios'
import { AmortLens, TableLens } from './loan/calc/AmortLens'
import { RateLens } from './loan/calc/RateLens'
import { CapacityLens } from './loan/calc/CapacityLens'
import { TaxLens } from './loan/calc/TaxLens'

// ── Lens switcher: εναλλάσσει ΕΝΑ δυναμικό πάνελ επί τόπου (όχι στοίβαγμα) ──

// ── Η ΚΑΤΑΣΤΑΣΗ ΠΟΥ ΑΝΕΒΑΙΝΕΙ ΣΤΟΝ ΓΟΝΕΑ ─────────────────────────────────────
// Ήταν `(s:any)=>void` εδώ, ενώ ο γονέας (TabLoan) είχε γράψει το ίδιο σχήμα
// ξεχωριστά ως `CalcState`. Δύο δηλώσεις για ένα συμβόλαιο σημαίνει ότι όποια
// από τις δύο αλλάξει, η άλλη μένει πίσω αθόρυβα — και το `any` της μιας πλευράς
// φρόντιζε να μη φανεί ποτέ. Ο τύπος ανήκει σε αυτόν που παράγει την τιμή.
export interface LoanCalcState {
  loanType:LoanType; borrowerType:BorrowerType; loanAmount:number; years:number
  rateType:RateType; effectiveRate:number; monthly:number; totalInterest:number; propertyValue:number
  /** Τα χρόνια που μένει σταθερό το επιτόκιο (σταθερό ή μικτό). Χωρίς αυτό, η
   *  ανάλυση έλεγε «προστατευμένος από το Euribor» σε δάνειο 25 ετών σταθερό
   *  μόνο για τα πρώτα 5. */
  fixedPeriod?:number
  sqm?:number; propType?:string; area?:string
  incomeMonthly?:number; marital?:'single'|'married'|'single_parent'; children?:number
}

interface Props {
  propertyId:string;userId:string;market:MarketRates
  /** Λέει μόνη της το αποτέλεσμα, με ΕΝΑ μήνυμα. */
  onSaveLoan:(loan:Partial<SavedLoan>)=>Promise<void>
  /** Λέει μόνη της το αποτέλεσμα· όπου μπορεί, επιστρέφει αν γράφτηκαν οι δόσεις. */
  onSaveToCalendar:(monthly:number,years:number,startDate:string,bankName:string)=>Promise<boolean|void>
  /** Λέει μόνη της το αποτέλεσμα, όπως οι δύο παραπάνω. */
  onSaveToExpenses:(monthly:number,bankName:string)=>Promise<boolean|void>
  onStateChange?:(s:LoanCalcState)=>void
  // Προφίλ χρήστη: «ιδιώτης» ή «επιχείρηση». Καθορίζει ποιοι τύποι δανειολήπτη
  // είναι σχετικοί, ώστε να μην κουράζουμε τον χρήστη με άσχετες επιλογές.
  profile?:'individual'|'business'
  // Αρχικές τιμές από το πραγματικό ακίνητο του χρήστη (προαιρετικά).
  initial?:{loanAmount?:string;propValue?:string;sqm?:string}
  // Τιμές που «εφαρμόζονται» εξωτερικά (π.χ. από σάρωση εγγράφου δανειολήπτη).
  // Το πεδίο v είναι σφραγίδα έκδοσης ώστε η εφαρμογή να ενεργοποιείται μόνο σε νέα σάρωση.
  applied?:{v:number;loanAmount?:number;propValue?:number;rate?:number;years?:number;rateType?:RateType;loanType?:string;income?:number;marital?:'single'|'married';children?:number}
  // Ο ΦΑΚΟΣ ΖΕΙ ΣΤΟΝ ΓΟΝΕΑ. Ο «Οδηγός» της Συμβουλευτικής στέλνει τον χρήστη
  // στα «Απαραίτητα έγγραφα», που είναι ένας από τους φακούς εδώ. Αν ο φακός
  // κρατιόταν εσωτερικά, ο γονέας δεν θα είχε τρόπο να τον ανοίξει — και η
  // παραπομπή θα έμενε νεκρό κείμενο («βρίσκονται στον Υπολογιστή…»).
  lens:string; onLens:(v:string)=>void; lensRef?:React.Ref<HTMLDivElement>
  // ΟΙ ΤΡΑΠΕΖΕΣ ΤΗΣ ΣΥΓΚΡΙΣΗΣ, ΟΧΙ ΤΟ ΣΤΑΤΙΚΟ ΑΝΤΙΓΡΑΦΟ. Ο υπολογιστής διάβαζε
  // το `BANKS` του TabLoanData ενώ η σύγκριση έδειχνε τα ζωντανά της βάσης και
  // το κείμενο έγραφε «τα ίδια επιτόκια». Η ημερομηνία έρχεται ήδη γραμμένη.
  banks:ComparisonBank[]; banksVerified:string
}
export default function TabLoanCalculator({propertyId,userId,market,initial,applied,onSaveLoan,onSaveToCalendar,onSaveToExpenses,onStateChange,profile='individual',lens,onLens,lensRef,banks,banksVerified}:Props) {
  const supabase = createClient()
  const BANK_OPTIONS = useMemo(()=>[...banks.map(b=>({value:b.id,label:b.name,description:[b.note,b.fees].filter(Boolean).join(' · ')})),{value:'custom',label:'Άλλη τράπεζα',description:'Καταχώρησε το όνομά της'}],[banks])
  const PRESETS = useMemo(()=>{
    const mins = banks.map(b=>Number(b.fixed_min)).filter(x=>x>0)
    return presetsFor(mins.length ? Math.min(...mins).toFixed(2) : '3.50')
  },[banks])
  const branding = useReportBranding(userId)
  const [genOfficial, setGenOfficial] = useState(false)
  const [loanAmount,  setLoanAmount]  = useState(initial?.loanAmount || '150000')
  const [propValue,   setPropValue]   = useState(initial?.propValue || '185000')
  const [sqm,         setSqm]         = useState(initial?.sqm || '80')
  const [propType,    setPropType]    = useState('residence')
  const [area,        setArea]        = useState('attica_center_std')
  const [rate,        setRate]        = useState('3.50')
  const [years,       setYears]       = useState('25')
  const [rateType,    setRateType]    = useState<RateType>('fixed')
  const [loanType,    setLoanType]    = useState<LoanType>('purchase')
  const [borrowerChoice, setBorrower] = useState<BorrowerType>('individual')
  const [startDate,   setStartDate]   = useState(athensToday())
  const [fixedPeriod, setFixedPeriod] = useState('5')
  const [bankId,      setBankId]      = useState('')
  const [customBank,  setCustomBank]  = useState('')
  const [extraPay,    setExtraPay]    = useState('0')
  const [income,      setIncome]      = useState('2000')
  // ΕΝΟΙΚΙΟ: ΠΡΑΓΜΑΤΙΚΟ, ΑΛΛΙΩΣ ΤΕΚΜΗΡΙΩΜΕΝΟ — ΠΟΤΕ «4% ΤΗΣ ΑΞΙΑΣ».
  // Ήταν δύο φορές επινοημένο στο ίδιο αρχείο: εδώ (PV×0,04/12, για την σύγκριση
  // ενοικίασης-αγοράς) και στο renInc (PV×0,04, που τροφοδοτούσε τον «Εκτιμώμενο
  // φόρο»). Το ενοίκιο του χρήστη υπάρχει στη βάση (rent_config.actual_rent) και
  // όπου λείπει υπάρχουν τεκμηριωμένες αποδόσεις ανά περιοχή στο greekMarket.
  const [actualRent, setActualRent] = useState(0)         // πραγματικό μηνιαίο ενοίκιο, από τη βάση
  const [monthlyRent, setMonthlyRent] = useState('')      // κενό = ακολουθεί το ενοίκιο-αναφορά
  const [rentTouched, setRentTouched] = useState(false)
  // Είσπραξη μέσω τράπεζας: προϋπόθεση της τεκμαρτής έκπτωσης 5% από 1.7.2027 (ν.5222/2025).
  const [rentsBank, setRentsBank] = useState(true)
  const [marital,     setMarital]     = useState<'single'|'married'>('single')
  const [children,    setChildren]    = useState('0')
  const [hasAgent,    setHasAgent]    = useState(false)
  const [agentPct,    setAgentPct]    = useState('2')
  const [scenarios,   setScenarios]   = useState<LoanScenario[]>([])
  const [editingId,   setEditingId]   = useState<string|null>(null)

  // ΕΦΑΡΜΟΓΗ ΤΙΜΩΝ ΑΠΟ ΕΞΩΤΕΡΙΚΗ ΣΑΡΩΣΗ, ΚΑΤΑ ΤΗΝ ΑΠΟΔΟΣΗ ΚΑΙ ΟΧΙ ΣΕ EFFECT.
  // Τρέχει μόνο όταν αλλάζει η σφραγίδα έκδοσης, ώστε να μη «μαχαιρώνει» τις
  // χειροκίνητες αλλαγές. Ηταν effect: ο χρήστης που σάρωνε το χαρτί του
  // έβλεπε ΜΙΑ απόδοση με τα παλιά νούμερα και μετά τα νέα, δηλαδή τα ποσά
  // αναπηδούσαν μπροστά του. Η React το λέει ρητά («adjusting state when a
  // prop changes»): η γραφή κατά την απόδοση ξαναρχίζει την ίδια απόδοση, χωρίς
  // να φτάσει ποτέ στην οθόνη η ενδιάμεση εικόνα.
  const [appliedSeen,setAppliedSeen] = useState<number|null>(null)
  if(applied && applied.v !== appliedSeen) {
    setAppliedSeen(applied.v)
    if(applied.loanAmount!=null && applied.loanAmount>0) setLoanAmount(String(Math.round(applied.loanAmount)))
    if(applied.propValue!=null && applied.propValue>0) setPropValue(String(Math.round(applied.propValue)))
    if(applied.rate!=null && applied.rate>0) setRate(String(applied.rate))
    if(applied.years!=null && applied.years>0) setYears(String(Math.round(applied.years)))
    if(applied.rateType) setRateType(applied.rateType)
    if(applied.loanType && applied.loanType in LOAN_TYPES) setLoanType(applied.loanType as LoanType)
    if(applied.income!=null && applied.income>0) setIncome(String(Math.round(applied.income)))
    if(applied.marital) setMarital(applied.marital)
    if(applied.children!=null) setChildren(String(Math.round(applied.children)))
  }
  const [remBal,      setRemBal]      = useState('100000')
  const [remYears,    setRemYears]    = useState('20')
  const [curRate,     setCurRate]     = useState('4.0')
  const [newRate,     setNewRate]     = useState('3.0')
  const [xferCost,    setXferCost]    = useState('2000')
  const [saving,      setSaving]      = useState(false)
  const [activePreset,setActivePreset]= useState<string|null>(null)
  // Ομοιόμορφοι αριθμοί: όλα λευκά, γαλάζιο μόνο όταν περνά ο κέρσορας/δάχτυλο.
  const [hoverRow,  setHoverRow]  = useState<number|null>(null)
  const [hoverCost, setHoverCost] = useState<number|null>(null)
  // Το τοπικό toast (state + ref-timer + δικό του JSX κάτω δεξιά) αφαιρέθηκε: το
  // αρχείο περνούσε ήδη τα ΣΦΑΛΜΑΤΑ από τον κοινό host και τις ΕΠΙΤΥΧΙΕΣ από δικό
  // του, οπότε ένα σφάλμα και μια επιτυχία μπορούσαν να εμφανιστούν ταυτόχρονα σε
  // δύο διαφορετικά σημεία της οθόνης, με διαφορετικό σχήμα και διάρκεια.

  // Το προφίλ (ιδιώτης/επιχείρηση) περιορίζει τους τύπους δανειολήπτη σε αυτούς
  // που πραγματικά αφορούν τον χρήστη — καθαρή, στοχευμένη εμπειρία.
  const borrowerOptions = useMemo(
    ()=>BORROWER_OPTIONS.filter(o=>(profile==='business'?BUSINESS_BORROWERS:NATURAL_BORROWERS).includes(o.value as BorrowerType)),
    [profile]
  )
  // ΤΟ ΕΠΙΤΡΕΠΤΟ ΔΕΝ ΑΠΟΘΗΚΕΥΕΤΑΙ, ΠΡΟΚΥΠΤΕΙ. Εδώ ένα effect διόρθωνε την
  // αποθηκευμένη επιλογή μετά την απόδοση: για μία απόδοση η οθόνη έδειχνε
  // δανειολήπτη που δεν υπήρχε καν στη λίστα και όλοι οι υπολογισμοί από κάτω
  // (όριο εισοδήματος, δικαιολογητικά, φορολογικά) έτρεχαν πάνω σε αυτόν.
  // Τώρα το ασύμβατο δεν φτάνει ποτέ στην οθόνη.
  const borrower = borrowerOptions.some(o=>o.value===borrowerChoice)
    ? borrowerChoice
    : (profile==='business'?'professional':'individual') as BorrowerType

  // Το ΠΡΑΓΜΑΤΙΚΟ ενοίκιο του ακινήτου (ίδια σειρά προτεραιότητας με όλη την
  // εφαρμογή: μισθωτήριο/ρύθμιση ενοικίου → στόχος ακινήτου). Όσο δεν υπάρχει,
  // πέφτουμε στην τεκμηριωμένη απόδοση της περιοχής — και το γράφουμε στην οθόνη.
  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try{
        const [rc, pr] = await Promise.all([
          supabase.from('rent_config').select('actual_rent,target_rent').eq('property_id',propertyId).maybeSingle(),
          properties.one<{ target_rent: number | null }>(supabase, propertyId, 'target_rent'),
        ])
        if(!alive) return
        const c = rc.data as { actual_rent:number|null; target_rent:number|null } | null
        const p = pr
        setActualRent(Number(c?.actual_rent) || Number(c?.target_rent) || Number(p?.target_rent) || 0)
      }catch{ /* χωρίς δεδομένα, μένει το τεκμηριωμένο ενοίκιο-αναφορά */ }
    })()
    return ()=>{ alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[propertyId])

  const LA   = parseFloat(loanAmount)||0
  const PV   = parseFloat(propValue)||0
  const SQM  = parseFloat(sqm)||0
  const R    = parseFloat(rate)||0
  const Y    = parseInt(years)||0
  const EP   = parseFloat(extraPay)||0
  const INC  = parseFloat(income)||2000
  const CH   = parseInt(children)||0
  const RB   = parseFloat(remBal)||0
  const RY   = parseFloat(remYears)||0
  const CR   = parseFloat(curRate)||0
  const NR   = parseFloat(newRate)||0
  const XC   = parseFloat(xferCost)||0
  const AGNT = hasAgent?(PV*parseFloat(agentPct||'2')/100):0

  const effRate   = rateType==='variable'?market.euribor_3m+R:R
  const monthly   = calcMonthly(LA,effRate,Y)
  const total     = monthly*Y*12
  const totalInt  = total-LA
  const ltv       = PV>0?(LA/PV)*100:0
  const sqmPrice  = PV>0&&SQM>0?PV/SQM:0
  const amort     = useMemo(()=>calcAmortization(LA,effRate,Y),[LA,effRate,Y])

  const notaryCosts = useMemo(()=>calcNotaryFees(PV),[PV])
  const fmaEx    = calcFmaExemption(marital,CH)
  const isNewBuilding = propType==='new_residence'
  const isCommercial  = propType==='store'||propType==='warehouse'
  // ═══ ΤΟ ΝΕΟΔΜΗΤΟ ΧΡΕΩΝΟΤΑΝ ΜΕ ΦΠΑ 24% ΠΟΥ ΚΑΝΕΙΣ ΔΕΝ ΠΛΗΡΩΝΕΙ ═══════════
  // Η ΙΔΙΑ ΕΦΑΡΜΟΓΗ ΕΛΕΓΕ ΔΥΟ ΠΡΑΓΜΑΤΑ. Το lib/accounting/transfer.ts, που
  // τροφοδοτεί το «Κόστος αγοράς και πώλησης» στη Λογιστική, εφαρμόζει ΦΠΑ μόνο
  // όταν του πουν ρητά ότι η αναστολή ΔΕΝ ισχύει — και κανείς δεν του το λέει,
  // άρα εκεί το νεόδμητο πληρώνει ΦΜΑ. Εδώ χρεωνόταν 24% χωρίς όρο. Σε ακίνητο
  // 300.000€ οι δύο οθόνες διέφεραν κατά 72.000€, δηλαδή το «συνολικό μετρητά»
  // του δανείου ήταν άλλος πλανήτης από τη Λογιστική για το ίδιο ακίνητο.
  //
  // ΚΑΙ Ο ΣΥΝΤΕΛΕΣΤΗΣ ΗΤΑΝ 3% ΑΝΤΙ ΓΙΑ 3,09%. Πάνω στον κύριο φόρο 3% μπαίνει
  // τέλος υπέρ δήμων ίσο με 3% ΤΟΥ ΦΟΡΟΥ. Το transfer.ts το είχε σωστά, εδώ
  // λειπε: τώρα και οι δύο οθόνες διαβάζουν την ίδια σταθερά.
  //
  // ΚΑΙ Ο ΚΑΝΟΝΑΣ ΤΗΣ ΑΠΑΛΛΑΓΗΣ ΗΤΑΝ ΑΛΛΟΣ. Εδώ γραφόταν «μέχρι το όριο τίποτα,
  // πάνω από αυτό όλη η τιμή»: άγαμος στα 220.000€ πλήρωνε 6.798€, ενώ ο νόμος
  // (και το transfer.ts) φορολογεί μόνο τις 20.000€ πάνω από το όριο, 618€. Η
  // σταθερά ήταν κοινή· ο κανόνας όχι. Τώρα κοινός είναι και ο κανόνας.
  const firstHomeTax = loanType==='first_home'&&!isCommercial
  const fmaOwed  = useMemo(()=>
    loanTransferTax(PV, firstHomeTax, marital, CH),
  [firstHomeTax,PV,marital,CH])
  const fmaSub = fmaOwed===0 ? 'Πρώτη κατοικία'
    : firstHomeTax ? `${fpRate(TRANSFER_TAX_RATE*100)} πάνω από ${fmtEur(fmaEx)}` : `${fpRate(TRANSFER_TAX_RATE*100)} επί αξίας`
  // Ενημερωτικό, όχι χρέωση: πόσο ΘΑ ηταν ο ΦΠΑ αν έπαυε η αναστολή.
  const vatOwed  = isNewBuilding?PV*NEW_BUILD_VAT_RATE:0
  const totalCosts = useMemo(()=>{
    const tax=fmaOwed
    return{tax,notary:notaryCosts.notary,landReg:notaryCosts.landReg,legal:notaryCosts.legal,agent:AGNT,other:notaryCosts.other,total:tax+notaryCosts.total+AGNT,downpayment:PV-LA,totalCash:(PV-LA)+tax+notaryCosts.total+AGNT}
  },[fmaOwed,notaryCosts,AGNT,PV,LA])

  // ── ΕΝΟΙΚΙΟ-ΑΝΑΦΟΡΑ: ΠΡΑΓΜΑΤΙΚΟ Ή ΤΕΚΜΗΡΙΩΜΕΝΟ ─────────────────────────────
  // Πριν: `renInc = PV*0.04`, «ενοίκιο ~4% της αξίας», που τροφοδοτούσε τον
  // «Εκτιμώμενο φόρο». Δύο προβλήματα: (α) το 4% δεν προέρχεται από πουθενά, ενώ
  // το lib/market/greekMarket έχει τεκμηριωμένες αποδόσεις 2,9%–7,0% ανά περιοχή
  // με πηγή και ημερομηνία· (β) το πραγματικό ενοίκιο του χρήστη ήταν διαθέσιμο
  // στη βάση. Άρα το ίδιο ακίνητο έβγαζε δύο διαφορετικά ενοίκια και δύο
  // διαφορετικούς φόρους σε δύο οθόνες. Τώρα: πραγματικό → αλλιώς περιοχή.
  const areaYield = useMemo(()=>areaGrossYield(area),[area])
  const rentRef = useMemo(()=>{
    if(actualRent>0) return { monthly: actualRent, source:'actual' as const }
    const m = PV>0 ? Math.round(PV*(areaYield.pct/100)/12) : 0
    return { monthly: m, source:'region' as const }
  },[actualRent,PV,areaYield.pct])
  const rentAssumptionText = rentRef.source==='actual'
    ? `Πραγματικό μηνιαίο ενοίκιο του ακινήτου, από τα στοιχεία που έχεις καταχωρήσει: ${fmtEur(rentRef.monthly)}.`
    : `Χωρίς καταχωρημένο ενοίκιο, χρησιμοποιείται η τεκμηριωμένη μεικτή απόδοση της περιοχής (${areaYield.label}, ${fmtPct1(areaYield.pct)} ετησίως, δεδομένα ${MARKET_DATA_ASOF}): ${fmtEur(rentRef.monthly)} τον μήνα. Συμπλήρωσε το ενοίκιο στο ακίνητο για δικό σου υπολογισμό.`
  const renInc   = loanType==='investment'?rentRef.monthly*12:0
  // Ο φόρος από τη ΜΟΝΑΔΙΚΗ πηγή, με τη τεκμαρτή έκπτωση υπό τον όρο του 2026.
  const renTax   = calcRentalTax(taxableRental(renInc, rentsBank))
  // ══ «ΣΠΙΤΙ ΜΟΥ ΙΙ»: Η ΜΗΧΑΝΗ ΚΡΙΝΕΙ, ΟΧΙ ΤΕΣΣΕΡΑ ΚΡΙΤΗΡΙΑ ΧΩΡΙΣ ΗΜΕΡΟΜΗΝΙΑ ══
  // Εδώ καθόταν το `spitiEligible` με σκοπό, αξία, νεόδμητο και επαγγελματικό,
  // χωρίς καμία προθεσμία: στις 28/09/2026 ο υπολογιστής έγραφε δόση με το μισό
  // δάνειο χωρίς τόκο και «εκτιμώμενη εξοικονόμηση» για πρόγραμμα που είχε
  // κλείσει για αιτήσεις στις 31/05. Τώρα ρωτά την `spitiMouEstimate`, που περνά
  // από την ίδια κρίση επιλεξιμότητας με τη σύσταση, μαζί με τις δύο προθεσμίες.
  const spitiToday  = athensToday()
  const spitiClosed = spitiMouClosedLine(spitiToday)
  const spitiEst    = spitiMouEstimate({ amount:LA, propertyValue:PV, years:Y, bankRatePct:effRate,
    firstHome:loanType==='first_home', newBuild:isNewBuilding, commercial:isCommercial }, spitiToday)
  const spitiEligible = spitiEst!==null
  const spitiM   = spitiEst?.monthly ?? monthly
  const spitiR   = spitiEst?.blendedRatePct ?? effRate
  const spitiSv  = (monthly-spitiM)*Y*12

  // Στην αναχρηματοδότηση το «τρέχον» επιτόκιο είναι του υπάρχοντος δανείου
  // (curRate), όχι το νέο μοντελοποιημένο επιτόκιο.
  const currM    = calcMonthly(RB,CR,RY)
  const newM     = calcMonthly(RB,NR,RY)
  const mSav     = currM-newM
  const refSav   = mSav*RY*12-XC
  const brkEven  = mSav>0?Math.ceil(XC/mSav):null

  const stress   =[{label:'Τρέχον',rate:effRate},{label:'+0,5%',rate:effRate+0.5},{label:'+1%',rate:effRate+1},{label:'+2%',rate:effRate+2},{label:'+3%',rate:effRate+3},{label:'6% συνολικό',rate:6}].filter(s=>s.label==='Τρέχον'||s.rate>effRate).map(s=>({...s,monthly:calcMonthly(LA,s.rate,Y)}))
  const amortChart = useMemo(()=>{const out=[];for(let y=1;y<=Math.min(Y,30);y++){const rows=amort.slice((y-1)*12,y*12);out.push({year:`${y}`,Κεφάλαιο:Math.round(rows.reduce((s,r)=>s+r.principal,0)),Τόκοι:Math.round(rows.reduce((s,r)=>s+r.interest,0))})}return out},[amort,Y])
  // Κυμαινόμενο = Euribor + ΠΕΡΙΘΩΡΙΟ (spread). Σε λειτουργία «σταθερού» το R είναι το ΠΛΗΡΕΣ
  // επιτόκιο, όχι spread — γι' αυτό χρειάζεται περιθώριο αναφοράς για τη σύγκριση.
  // ΠΡΙΝ ήταν σταθερά 1,5 με τον χαρακτηρισμό «τυπικό περιθώριο αγοράς», χωρίς πηγή,
  // και καθόριζε ΟΛΗ τη σύγκριση σταθερού/κυμαινόμενου. Τώρα προκύπτει από τα ίδια
  // δεδομένα τραπεζών που δείχνει ο συγκριτικός πίνακας δύο ενότητες παρακάτω
  // (variable_spread_min ανά τράπεζα, ίδια λίστα με τη σύγκριση): ο διάμεσος των
  // ελάχιστων περιθωρίων. Αν αλλάξουν τα επιτόκια, αλλάζει και η σύγκριση.
  const refVarSpread = useMemo(()=>{
    const mins = banks.map(b=>Number(b.variable_spread_min)).filter(x=>x>0).sort((a,b)=>a-b)
    if(!mins.length) return { pct: 0, count: 0 }
    const mid = Math.floor(mins.length/2)
    return { pct: mins.length%2 ? mins[mid] : (mins[mid-1]+mins[mid])/2, count: mins.length }
  },[banks])
  const variableRate = market.euribor_3m + (rateType==='variable'?R:refVarSpread.pct)
  const varMonthly  = calcMonthly(LA,variableRate,Y)
  // Γνήσια σύγκριση σταθερού/κυμαινόμενου: σε λειτουργία «κυμαινόμενου» το effRate
  // ΕΙΝΑΙ ήδη Euribor+περιθώριο, άρα ταυτίζεται με το variableRate και η σύγκριση
  // εκφυλίζεται· χρησιμοποιούμε αντιπροσωπευτικό σταθερό της αγοράς ως αναφορά.
  const bankFixedMins = banks.map(b=>Number(b.fixed_min)).filter(x=>x>0)
  const fixedRefRate = rateType==='variable' && bankFixedMins.length ? Math.min(...bankFixedMins) : effRate
  const fixedRefMonthly = calcMonthly(LA,fixedRefRate,Y)
  const varShownRate = rateType==='variable' ? effRate : variableRate
  const varShownMonthly = rateType==='variable' ? monthly : varMonthly
  // Σωρευτικοί τόκοι με πραγματική τοκοχρεολυτική απόσβεση (όχι γραμμική αναλογία κεφαλαίου).
  const cumInterest = useCallback((ratePct:number,uptoYear:number)=>{const m=calcMonthly(LA,ratePct,Y);const rr=ratePct/100/12;let bal=LA,sum=0;for(let k=1;k<=uptoYear*12&&bal>0;k++){const i=rr===0?0:bal*rr;sum+=i;bal-=(m-i)}return Math.round(sum)},[LA,Y])
  const fvChartData = useMemo(()=>{const pts=[3,5,7,10,15,20,25,30].filter(y=>y<=Y);return pts.map(yr=>({year:`${yr} έτη`,Σταθερό:cumInterest(fixedRefRate,yr),Κυμαινόμενο:cumInterest(varShownRate,yr)}))},[fixedRefRate,varShownRate,Y,cumInterest])
  const scenChart = useMemo(()=>scenarios.map(s=>({name:s.label,Τόκοι:Math.round(calcMonthly(s.amount,s.rate,s.years)*s.years*12-s.amount)})),[scenarios])

  const extraSav = useMemo(()=>{
    if(EP<=0)return null
    let bal=LA,months=0,ti=0; const m=monthly+EP
    while(bal>0&&months<Y*12){const int=bal*(effRate/100/12);ti+=int;bal=bal*(1+effRate/100/12)-m;months++}
    return{savedMonths:Y*12-months,savedInt:Math.max(0,totalInt-ti)}
  },[LA,effRate,Y,EP,monthly,totalInt])

  // ΕΝΗΜΕΡΩΣΗ ΤΟΥ ΓΟΝΕΑ ΜΕΤΑ ΤΗΝ ΑΠΟΔΟΣΗ, ΟΧΙ ΜΕΣΑ ΣΕ ΑΥΤΗΝ.
  // Ήταν `useMemo` που δεν επέστρεφε τίποτα και υπήρχε μόνο για την παρενέργεια:
  // καλούσε `onStateChange` ΚΑΤΑ ΤΗ ΔΙΑΡΚΕΙΑ του render, δηλαδή άλλαζε κατάσταση
  // άλλου component ενώ αυτό αποδιδόταν ακόμη — από εκεί βγαίνει το «Cannot
  // update a component while rendering a different component» και ένα επιπλέον
  // πέρασμα απόδοσης σε κάθε πληκτρολόγηση. Το React δεν εγγυάται καν πότε
  // τρέχει ένα useMemo. Ίδιες εξαρτήσεις, σωστό εργαλείο.
  useEffect(()=>{
    onStateChange?.({loanType,borrowerType:borrower,loanAmount:LA,years:Y,rateType,effectiveRate:effRate,monthly,totalInterest:totalInt,propertyValue:PV,fixedPeriod:Number(fixedPeriod)||undefined,sqm:SQM,propType,area,incomeMonthly:INC,marital,children:Number(children)||0})
    // Το `onStateChange` λείπει σκόπιμα: οι γονείς το περνούν ως ανώνυμη
    // συνάρτηση, οπότε αλλάζει ταυτότητα σε κάθε render και θα έκανε τον βρόχο
    // ατέρμονο. Ό,τι στέλνουμε εξαρτάται μόνο από τα παρακάτω.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[loanType,borrower,LA,Y,rateType,effRate,monthly,totalInt,PV,fixedPeriod,SQM,propType,area,INC,marital,children])

  const bankName = bankId==='custom'?customBank:banks.find(b=>b.id===bankId)?.name||''
  const areaLabel = AREA_OPTIONS.find(a=>a.value===area)?.label||''
  const propTypeLabel = PROPERTY_TYPES.find(p=>p.value===propType)?.label||''

  function applyPreset(p:ReturnType<typeof presetsFor>[number]){setLoanAmount(p.values.loanAmount);setPropValue(p.values.propValue);setSqm(p.values.sqm);setRate(p.values.rate);setYears(p.values.years);setRateType(p.values.rateType);setLoanType(p.values.loanType);setBorrower(p.values.borrower);setFixedPeriod(p.values.fixedPeriod);setPropType(p.values.propType);setArea(p.values.area);setActivePreset(p.id)}
  function addScen(){setScenarios(s=>[...s,{id:Date.now().toString(),label:`Σενάριο ${s.length+1}`,amount:LA,rate:effRate,years:Y,rateType}])}
  function updScen<K extends keyof LoanScenario>(id:string,f:K,v:LoanScenario[K]){setScenarios(s=>s.map(x=>x.id===id?{...x,[f]:v}:x))}
  function delScen(id:string){setScenarios(s=>s.filter(x=>x.id!==id))}
  function applyScen(s:LoanScenario){setLoanAmount(String(s.amount));setRate(String(s.rateType==='variable'?s.rate-market.euribor_3m:s.rate));setYears(String(s.years));setRateType(s.rateType);setActivePreset(null)}
  // Επαναφορά όλων των βασικών πεδίων στις προεπιλογές (χωρίς reload σελίδας).
  function resetAll(){
    setLoanAmount(initial?.loanAmount||'150000');setPropValue(initial?.propValue||'185000');setSqm(initial?.sqm||'80')
    setPropType('residence');setArea('attica_center_std');setRate('3.50');setYears('25')
    setRateType('fixed');setLoanType('purchase');setBorrower('individual')
    setFixedPeriod('5');setBankId('');setCustomBank('');setExtraPay('0')
    setHasAgent(false);setAgentPct('2');setActivePreset(null)
    notify('Επαναφορά στις προεπιλογές')
  }
  // ΤΟ ΟΝΟΜΑ ΤΗΣ ΤΡΑΠΕΖΑΣ ΑΠΟΘΗΚΕΥΕΤΑΙ ΚΕΝΟ ΟΤΑΝ ΕΙΝΑΙ ΚΕΝΟ. Έγραφε τη φράση
  // «Μη καθορισμένη» ΜΕΣΑ στη στήλη: το κείμενο που θα έδειχνε η οθόνη αν έλειπε
  // το όνομα, γινόταν το ίδιο δεδομένο. Από εκεί βγήκε στο ημερολόγιο ως «Δόση
  // δανείου, Μη καθορισμένη» σε εξήντα δόσεις και σε κάθε αναφορά από κάτω.
  // Η απουσία λέγεται στην οθόνη, με τη λέξη της οθόνης.
  //
  // 02.10.2026: έδειχνε «Το δάνειο αποθηκεύτηκε» μετά από ΚΑΘΕ κλήση ακόμη και πάνω
  // στο μήνυμα αποτυχίας. Το μήνυμα το λέει πλέον μόνο το `onSaveLoan`, που
  // ξέρει τι έγινε (loan/saveFlow.ts). Το `finally` ξεκλειδώνει το κουμπί και
  // όταν η κλήση πετάξει.
  async function handleSave(){setSaving(true);try{await onSaveLoan({bank:bankName.trim(),loan_type:loanType,amount:LA,property_value:PV,rate:effRate,rate_type:rateType,years:Y,start_date:startDate,status:'active',notes:`${propTypeLabel} ${SQM} τ.μ., ${areaLabel}`})}finally{setSaving(false)}}

  // ── Ημερομηνία δόσης i (1..n) με βάση την έναρξη ──────────────────────────────
  // 02.10.2026: ήταν `new Date(έτος, μήνας + i, μέρα)`, που για έναρξη 31.8
  // έδινε 1.10 για τη δόση του Σεπτεμβρίου. Πλέον από την έναρξη με κλείδωμα
  // στο τέλος του μήνα, όπως οι δόσεις του Ημερολογίου.
  function installmentDate(i:number){
    const base=startDate||athensToday()
    return localDay(instalmentDate(base,i)??base)
  }
  const amortFileBase = ()=>`Τοκοχρεολύσιο ${bankName?bankName.slice(0,24)+' ':''}${Math.round(LA/1000)} χιλιάδες ${Y} έτη`

  // ── Εξαγωγή πλήρους πίνακα τοκοχρεολυσίου σε CSV (ανοίγει σε Excel) ───────────
  // Οι τρεις εξαγωγές ζουν στο loan/calc/reports.ts· εδώ μένουν τα κουμπιά.
  function exportAmortCsv(){ amortXlsx({amort, installmentDate, amortFileBase, bankName, Y}) }

  // ── Εξαγωγή πίνακα τοκοχρεολυσίου σε εκτυπώσιμο PDF (κοινό ασπρόμαυρο σύστημα αναφορών) ─
  function exportAmortPdf(){ amortPrintPdf({amort, installmentDate, bankName, Y, LA, monthly, totalInt, effRate, rateType, branding}) }

  // ── Επίσημο true-PDF τοκοχρεολυσίου (vector PDF με αρ. εγγράφου & QR επαλήθευσης) ─
  // Καταχωρείται στο μητρώο εγγράφων ώστε να είναι επαληθεύσιμο στο /verify/<id>.
  // Η μηχανή σελιδοποιεί αυτόματα τον πλήρη πίνακα δόσεων σε πολλές σελίδες.
  async function officialAmort(){
    if(genOfficial) return
    if(!amort.length){notify('Δεν υπάρχουν δόσεις προς εξαγωγή',{tone:'warning'});return}
    setGenOfficial(true)
    try {
      await amortOfficialPdf(supabase, {amort, installmentDate, bankName, Y, LA, monthly, totalInt, effRate, rateType, branding})
    } catch { notifyError(failed(MSG.pdf)) }
    finally { setGenOfficial(false) }
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>

      {/* Quick Presets — συμπτυσσόμενα, διακριτικά chips (όχι κουραστικές κάρτες) */}
      <Section title="Γρήγορη συμπλήρωση" sub="Έτοιμα σενάρια, προαιρετικό ξεκίνημα">
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {PRESETS.map(p=>{
            const on = activePreset===p.id
            return (
              <ChipToggle key={p.id} on={on} onClick={()=>applyPreset(p)} title={p.desc}>
                {on&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>}
                {p.label}
              </ChipToggle>
            )
          })}
        </div>
      </Section>

      {/* ═══ Η ΔΟΣΗ ΠΡΙΝ ΑΠΟ ΤΑ ΔΕΚΑΤΕΣΣΕΡΑ ΠΕΔΙΑ ════════════════════════════════
          Στο κινητό η «Μηνιαία δόση» έπεφτε 1.600 εικονοστοιχεία κάτω, μετά από
          όλα τα πεδία: ο χρήστης που άλλαζε το επιτόκιο δεν έβλεπε τι άλλαξε. Τα
          τέσσερα νούμερα κάθονται πλέον πάνω από τα πεδία που τα κουνάνε, σε
          κάθε πλάτος· η απάντηση πρώτα, οι ρυθμίσεις από κάτω. */}
      {/* ═══ ΤΑ ΤΕΣΣΕΡΑ ΝΟΥΜΕΡΑ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΣΤΟΙΧΕΙΟ ΜΕ ΤΑ ΥΠΟΛΟΙΠΑ ΤΗΣ ΕΦΑΡΜΟΓΗΣ
          Ηταν χειροποίητα κουτάκια: δικό τους πλέγμα, δικό τους περιθώριο, δικό
          τους μέγεθος γραμματοσειράς στα 28, δική τους κατάσταση `hoverKpi`.
          Το ίδιο πράγμα με το KPIGrid, γραμμένο δεύτερη φορά — και επειδή ήταν
          δεύτερη γραφή, δεν πήρε τίποτα από όσα διορθώθηκαν στην πρώτη.

          ΤΙ ΚΟΣΤΙΣΕ. ΜΕΤΡΗΜΕΝΟ ΣΕ Galaxy A, 360×800: δύο στήλες των 163, κάρτα
          με 18 περιθώριο δεξιά-αριστερά, δηλαδή 127 για το νούμερο· η
          «Συνολική αποπληρωμή» έγραφε «225.280,61€», που στα 28 θέλει 200. Ο
          κύριος αριθμός του υπολογιστή δανείου ήταν κομμένος στη μέση· μαζί
          του ολόκληρη η γραμμή ξεχείλιζε την κάρτα κατά 37.

          Με το κοινό στοιχείο, το μέγεθος βγαίνει από το πλάτος της κάρτας ΚΑΙ
          από το μήκος του αριθμού, ο τόνος αποκαλύπτεται στο άγγιγμα όπως
          παντού και η κατάσταση `hoverKpi` δεν χρειάζεται καν. */}
      <KPIGrid items={[
        { label:'Μηνιαία δόση', value:fmtEur(monthly), sub:`${rateTypeLabel(rateType).toLowerCase()} ${fmtPct(effRate)} · ${Y} χρόνια` },
        { label:'Σύνολο τόκων', value:fmtEur(totalInt), sub:`${fp(((totalInt/Math.max(LA,1))*100))} επί κεφαλαίου` },
        { label:'Συνολική αποπληρωμή', value:fmtEur(total), sub:`κεφάλαιο ${fmtEur(LA)}` },
        // Ο τόνος μπαίνει ΜΟΝΟ όταν λέει κάτι: πάνω από 90% δάνειο προς αξία
        // είναι το όριο πέρα από το οποίο οι τράπεζες σταματούν να δανείζουν.
        { label:'Δάνειο προς αξία', value:`${fp(ltv)}`, sub:`ίδια κεφάλαια ${fmtEur(PV-LA)}`, title:'Ποσοστό δανείου ως προς την αξία του ακινήτου', tone: ltv>90 ? 'warning' : undefined },
      ]}/>
      {/* Η ΣΤΑΘΕΡΗ ΠΕΡΙΟΔΟΣ ΔΕΝ ΜΠΑΙΝΕΙ ΣΤΟΝ ΥΠΟΛΟΓΙΣΜΟ: δόση και σύνολα τρέχουν με
          το ίδιο επιτόκιο ως το τέλος. Όσο η περίοδος είναι μικρότερη από τη
          διάρκεια, το λέμε δίπλα στα νούμερα αντί να το υπονοούμε. */}
      {(rateType==='fixed'||rateType==='mixed')&&Number(fixedPeriod)<Y&&(
        <p style={{ ...TT.caption, color:'var(--text-tertiary)', marginTop:8 }}>
          Τα σύνολα υποθέτουν {fmtPct(effRate)} σε όλη τη διάρκεια· μετά τα {fixedPeriod} χρόνια το επιτόκιο αλλάζει, οπότε είναι ενδεικτικά.
        </p>
      )}

      {/* Ακίνητο και σκοπός — ενιαία κάρτα, ενιαίο πλέγμα πεδίων (χωρίς άνισα ύψη) */}
      <PropertyCard propType={propType} setPropType={setPropType} setActivePreset={setActivePreset} area={area} setArea={setArea}
        propValue={propValue} setPropValue={setPropValue} sqm={sqm} setSqm={setSqm} loanType={loanType} setLoanType={setLoanType}
        borrower={borrower} setBorrower={setBorrower} borrowerOptions={borrowerOptions} sqmPrice={sqmPrice}
        hasAgent={hasAgent} setHasAgent={setHasAgent} agentPct={agentPct} setAgentPct={setAgentPct} AGNT={AGNT}
        isNewBuilding={isNewBuilding} vatOwed={vatOwed} isCommercial={isCommercial}/>

      {/* Δάνειο, επιτόκιο και παράμετροι — ενιαία κάρτα, ενιαίο πλέγμα πεδίων */}
      <LoanCard loanAmount={loanAmount} setLoanAmount={setLoanAmount} setActivePreset={setActivePreset} years={years} setYears={setYears}
        startDate={startDate} setStartDate={setStartDate} bankId={bankId} setBankId={setBankId} BANK_OPTIONS={BANK_OPTIONS}
        customBank={customBank} setCustomBank={setCustomBank} rateType={rateType} setRateType={setRateType}
        fixedPeriod={fixedPeriod} setFixedPeriod={setFixedPeriod} rate={rate} setRate={setRate} market={market} R={R}
        effRate={effRate} extraPay={extraPay} setExtraPay={setExtraPay} extraSav={extraSav} EP={EP}/>

      {/* ═══ ΜΙΑ ΚΥΡΙΑ ΕΝΕΡΓΕΙΑ, ΟΧΙ ΠΕΝΤΕ ΙΣΟΒΑΡΕΣ ═══════════════════════════
          Πέντε κουμπιά σε μία σειρά, με άνισα πλάτη, διεκδικούσαν την ίδια
          προσοχή. Η αποθήκευση είναι αυτό για το οποίο έρχεται κανείς εδώ· η
          σύγκριση σεναρίων είναι η δεύτερη δουλειά του υπολογιστή. Ημερολόγιο,
          δαπάνες και επαναφορά είναι σπάνιες κινήσεις και ζουν στο «Περισσότερα». */}
      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <Btn variant="primary" onClick={handleSave} disabled={saving}>{saving?'Αποθήκευση…':'Αποθήκευση δανείου'}</Btn>
        <Btn variant="secondary" onClick={addScen}>+ Προσθήκη σεναρίου</Btn>
        <ActionMenu label="Περισσότερα" align="left" items={[
          { key:'calendar', label:'Δόσεις στο ημερολόγιο', description:'Μία υπενθύμιση για κάθε δόση, από την ημερομηνία έναρξης', onClick:async()=>{await onSaveToCalendar(monthly,Y,startDate,bankName)} },
          { key:'expenses', label:'Δόση στις δαπάνες', description:'Η μηνιαία δόση ως επαναλαμβανόμενη δαπάνη του ακινήτου', onClick:async()=>{await onSaveToExpenses(monthly,bankName)} },
          { key:'reset', label:'Επαναφορά', description:'Όλα τα πεδία στις αρχικές τιμές', onClick:resetAll },
        ]}/>
      </div>

      {scenarios.length>0&&(
        <Scenarios scenarios={scenarios} totalInt={totalInt} editingId={editingId} setEditingId={setEditingId}
          updScen={updScen} applyScen={applyScen} delScen={delScen} scenChart={scenChart}/>
      )}

      {/* ── Lens switcher: ένα δυναμικό πάνελ επί τόπου (όχι στοίβαγμα) ── */}
      <LensBar barRef={lensRef} value={lens} onChange={onLens} items={[
        {id:'amort',label:'Απόσβεση'},
        {id:'rate',label:'Επιτόκιο'},
        {id:'capacity',label:'Ικανότητα'},
        {id:'more',label:'Φόρος και αντοχή'},
        {id:'table',label:'Πίνακας και έγγραφα'},
      ]}/>

      {lens==='amort' && <AmortLens LA={LA} totalInt={totalInt} amortChart={amortChart}/>}

      {lens==='rate' && <RateLens fixedRefRate={fixedRefRate} fixedRefMonthly={fixedRefMonthly} varShownRate={varShownRate}
        varShownMonthly={varShownMonthly} Y={Y} LA={LA} rateType={rateType} market={market} R={R} bankFixedMins={bankFixedMins}
        banksVerified={banksVerified} effRate={effRate} refVarSpread={refVarSpread} fvChartData={fvChartData}
        spitiClosed={spitiClosed} spitiEligible={spitiEligible} spitiR={spitiR} spitiM={spitiM} monthly={monthly}
        totalInt={totalInt} spitiSv={spitiSv} loanType={loanType} PV={PV} isNewBuilding={isNewBuilding} isCommercial={isCommercial}/>}

      {lens==='capacity' && <CapacityLens loanType={loanType} INC={INC} LA={LA} effRate={effRate} Y={Y} income={income}
        setIncome={setIncome} rentTouched={rentTouched} monthlyRent={monthlyRent} rentRef={rentRef} PV={PV} totalCosts={totalCosts}
        setMonthlyRent={setMonthlyRent} setRentTouched={setRentTouched} rentAssumptionText={rentAssumptionText}/>}

      {lens==='more' && <TaxLens isCommercial={isCommercial} marital={marital} setMarital={setMarital} childrenCount={children}
        setChildren={setChildren} fmaOwed={fmaOwed} fmaEx={fmaEx} PV={PV} loanType={loanType} renInc={renInc}
        rentAssumptionText={rentAssumptionText} rentsBank={rentsBank} setRentsBank={setRentsBank} renTax={renTax} stress={stress}
        INC={INC} borrower={borrower} rateType={rateType} fixedPeriod={fixedPeriod} Y={Y} remBal={remBal} setRemBal={setRemBal}
        remYears={remYears} setRemYears={setRemYears} curRate={curRate} setCurRate={setCurRate} newRate={newRate}
        setNewRate={setNewRate} xferCost={xferCost} setXferCost={setXferCost} brkEven={brkEven} currM={currM} newM={newM}
        refSav={refSav} mSav={mSav}/>}

      {lens==='table' && <TableLens Y={Y} exportAmortPdf={exportAmortPdf} officialAmort={officialAmort} genOfficial={genOfficial}
        exportAmortCsv={exportAmortCsv} amort={amort} hoverRow={hoverRow} setHoverRow={setHoverRow} loanType={loanType}
        propTypeLabel={propTypeLabel} isNewBuilding={isNewBuilding} propertyId={propertyId} borrower={borrower} SQM={SQM}
        areaLabel={areaLabel} fmaOwed={fmaOwed} fmaSub={fmaSub} totalCosts={totalCosts} hasAgent={hasAgent} AGNT={AGNT} agentPct={agentPct}
        hoverCost={hoverCost} setHoverCost={setHoverCost} notaryCosts={notaryCosts} LA={LA}/>}

    </div>
  )
}
