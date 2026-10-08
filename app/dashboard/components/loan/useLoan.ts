'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΚΑΡΤΕΛΑΣ ΔΑΝΕΙΟΥ: ΑΠΟΘΗΚΕΥΜΕΝΑ ΔΑΝΕΙΑ, ΤΡΑΠΕΖΕΣ, ΑΓΟΡΑ,
// ΠΡΟΓΡΑΜΜΑΤΑ, ΣΥΜΒΟΥΛΟΣ
// ─────────────────────────────────────────────────────────────────────────
// Ό,τι διαβάζει η καρτέλα από τη βάση και τις τροφοδοσίες, ό,τι θυμάται και
// ό,τι υπολογίζεται από αυτά, μαζί με την αποθήκευση και την εξαγωγή. Η
// οθόνη (TabLoan) μόνο το αποδίδει.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as expenses from '@/lib/data/expenses'
import * as loanStore from '@/lib/data/loans'
import * as calendar from '@/lib/data/calendar'
import { must } from '@/lib/supabase/must'
import { saved } from '@/components/dbWrite'
import { toLoanRow } from '@/lib/loans/shape'
import { programStatus, PROGRAM_ORDER } from '@/lib/loans/programStatus'
import { loanEventTitle, UNSET_BANK } from '../calendar/model'
import { notifyOk, notifyError } from '@/components/Toast'
import { confirmDialog } from '@/components/confirmBus'
import { downloadXlsx } from '../sheets'
import {
  useMarketRates, useBankRates, useLoanPrograms, useIsAdmin, useMarketFeedHealth,
} from '../../../hooks/useMarketData'
import {
  BANKS_NORM, PROGRAMS_NORM, mergeBanks, programsWithLive, BANKS_VERIFIED, type ComparisonBank,
  type ComparisonProgram, LOAN_TYPES, calcMonthly, fmtEur, LoanType, RateType, SavedLoan,
  MARKET_FALLBACK, rateTypeLabel,
} from '../TabLoanData'
import type { AppliedLoan } from '../LoanDocScan'
import { athensToday, daysUntil } from '@/lib/core/time'
import { instalmentDates } from '@/lib/core/monthStep'
import { saveLoanFlow, loanSaveSuccessText, SCHEDULE_FAILED_AFTER_SAVE } from './saveFlow'
import { grDate } from '@/lib/core/format'
import { failed } from '@/lib/core/dbError'
import type { CalcState } from './model'

// Ενοποιημένη ροή: ένας υπολογιστής στην κορυφή + έξυπνες πτυσσόμενες ενότητες.
// Μία ανοιχτή τη φορά, ώστε να παραμένει καθαρό — όχι «σούπερ μάρκετ» με καρτέλες.
export type LoanSection = 'advisor'|'banks'|'programs'|'guide'

export type LoanProps = {propertyId:string;userId:string;propertyValue?:number;propertySqm?:number;propertyYearBuilt?:number;profileType?:'individual'|'professional'}

export function useLoan({ propertyId, userId, propertyValue, profileType='individual' }: LoanProps) {
  const supabase = createClient()
  // Πραγματικά στοιχεία του ακινήτου του χρήστη (αντί για γενικές προεπιλογές).
  const initValue  = propertyValue && propertyValue > 0 ? Math.round(propertyValue) : 200000
  const initAmount = propertyValue && propertyValue > 0 ? Math.round(propertyValue * 0.8) : 150000
  // Τα κλειδιά δηλώνονται ΜΙΑ φορά και ως κλειδιά του τύπου: ένα λάθος όνομα
  // στήλης σταματά στη μεταγλώττιση αντί να βγει ως κενό κελί.
  const FIXED_TERM_COLUMNS = ['fixed_3yr','fixed_5yr','fixed_10yr','fixed_15yr','fixed_20yr'] as const satisfies readonly (keyof ComparisonBank)[]
  const [openSec,setOpenSec] = useState<LoanSection>('advisor')
  // Το προφίλ ακολουθεί την καθολική ρύθμιση της εφαρμογής (Ρυθμίσεις → τύπος
  // προφίλ). ΜΙΑ πηγή αλήθειας — χωρίς διπλό διακόπτη μέσα στην καρτέλα.
  const profile: 'individual'|'business' = profileType==='professional' ? 'business' : 'individual'
  // Οι ενότητες του οδηγού εμφανίζονται με τη σειρά που γράφονται (DOM = οπτική
  // σειρά). Δεν χρησιμοποιούμε flex «order» — προκαλούσε ασυμφωνία DOM/διάταξης
  // και το scroll «πηδούσε» προς τα πάνω κατά το άνοιγμα μιας ενότητας.
  const calcRef = useRef<HTMLDivElement>(null)
  const scrollToCalc = ()=>calcRef.current?.scrollIntoView({behavior:'smooth',block:'start'})
  // Ο φακός του Υπολογιστή. Ζει εδώ και όχι μέσα του, γιατί ο «Οδηγός» της
  // Συμβουλευτικής παραπέμπει στα «Απαραίτητα έγγραφα» — και μια παραπομπή που
  // δεν μπορεί να ανοίξει τον προορισμό της είναι κείμενο, όχι διαδρομή.
  const [calcLens,setCalcLens] = useState('amort')
  const lensRef = useRef<HTMLDivElement>(null)
  // Ανοιχτός εξ ορισμού· κλείνει μόνο όταν φορτωθεί αποθηκευμένο δάνειο (πιο κάτω).
  const [calcOpen,setCalcOpen] = useState(true)
  const openCalcDocs = ()=>{
    // Ο Οδηγός μπορεί να στείλει εδώ ενώ ο Υπολογιστής είναι διπλωμένος: πρώτα
    // ανοίγει η ενότητα, αλλιώς ο φακός δεν έχει πού να εμφανιστεί.
    setCalcOpen(true)
    setCalcLens('table')
    requestAnimationFrame(()=>lensRef.current?.scrollIntoView({behavior:'smooth',block:'start'}))
  }
  // Εφαρμογή επιτοκίου τράπεζας στον Υπολογιστή (μέσω του καναλιού «applied»· η
  // σφραγίδα έκδοσης εξασφαλίζει ότι εφαρμόζεται ακόμη κι αν ξαναπατηθεί η ίδια τιμή).
  // Προσοχή: για ΚΥΜΑΙΝΟΜΕΝΟ, ο Υπολογιστής περιμένει το ΠΕΡΙΘΩΡΙΟ (spread), όχι το
  // πλήρες επιτόκιο (effRate = Euribor + spread). Η σύσταση δίνει το πλήρες επιτόκιο,
  // οπότε αφαιρούμε το Euribor ώστε να μη μετρηθεί δύο φορές (όπως κάνει και το applyScen).
  const applyBank = (rate:number, rt:RateType, bankName?:string)=>{
    const eur = market.euribor_3m || MARKET_FALLBACK.euribor_3m
    const applyRate = rt==='variable' ? Math.max(0, Number((rate - eur).toFixed(2))) : rate
    setAppliedLoan({ v: Date.now(), rate:applyRate, rateType:rt })
    if(bankName) notifyOk(`Εφαρμόστηκε το επιτόκιο: ${bankName}`)
    scrollToCalc()
  }
  // Ονομάζεται `savedLoans`: το `saved` ανήκει πια στον βοηθό που ελέγχει αν ένα
  // γράψιμο πέτυχε και δύο πράγματα δεν μοιράζονται ένα όνομα.
  const [savedLoans,setSaved] = useState<SavedLoan[]>([])
  const [filterSpiti,setFS] = useState(false)
  const [selBank,setSelBank] = useState<string|null>(null)
  const [appliedLoan,setAppliedLoan] = useState<AppliedLoan|undefined>(undefined)
  const [recHover,setRecHover] = useState(false)
  const [scoreHover,setScoreHover] = useState(false)
  const [otherHover,setOtherHover] = useState<string|null>(null)
  const [hoverBank,setHoverBank] = useState<string|null>(null)
  const [hoverBankRow,setHoverBankRow] = useState<number|null>(null)
  // Ξεκινά «true»: πριν, η καρτέλα έδειχνε ΤΙΠΟΤΑ όσο έτρεχε η loadSaved και μετά
  // αναβόσβηνε για μια στιγμή η κενή κατάσταση «δεν υπάρχουν δάνεια», σαν να μην
  // είχε αποθηκεύσει ποτέ τίποτα ο χρήστης.
  const [loadingSaved,setLoadingSaved] = useState(true)

  const market      = useMarketRates()
  const {banks:liveBanks,loading:banksLoading,health:feed,reload:reloadBanks} = useBankRates()
  const {programs:livePrograms }   = useLoanPrograms()
  const {isAdmin} = useIsAdmin()
  // Ρωτιέται ΜΟΝΟ όταν ο χρήστης είναι διαχειριστής: κανένα περιττό αίτημα
  // στη βάση για τους υπόλοιπους, που ούτως ή άλλως δεν θα έβλεπαν τίποτα.
  const feedHealth = useMarketFeedHealth(isAdmin)

  // Ζωντανά ή εφεδρικά, περνούν από την ΙΔΙΑ κανονικοποίηση. Πριν, τα ζωντανά
  // πήγαιναν κατευθείαν στην οθόνη με άλλα ονόματα πεδίων από τα εφεδρικά και
  // η απόδοση τα γεφύρωνε με `||` και `as any` σε δώδεκα σημεία.
  // Και ό,τι λείπει από τη ζωντανή γραμμή έρχεται από τον κατάλογο: «όλο ή
  // τίποτα» έσβηνε την προθεσμία αίτησης του «Σπίτι μου ΙΙ» και η οθόνη πήρε
  // την προθεσμία υπογραφής στη θέση της. Ο λόγος γράφεται στο TabLoanData.
  // Σταθερή ταυτότητα: ο Υπολογιστής παράγει από αυτή τη λίστα προεπιλογές και
  // περιθώρια αναφοράς και δεν χρειάζεται να τα ξαναφτιάχνει σε κάθε απόδοση.
  const BANKS: ComparisonBank[]       = useMemo(()=>liveBanks.length ? mergeBanks(liveBanks) : BANKS_NORM,[liveBanks])
  const PROGRAMS: ComparisonProgram[] = useMemo(()=>livePrograms.length ? programsWithLive(livePrograms) : PROGRAMS_NORM,[livePrograms])

  const [calcState,setCalcState] = useState<CalcState>({
    loanType:'purchase',borrowerType:'individual',loanAmount:initAmount,
    years:25,rateType:'fixed',effectiveRate:3.5,
    monthly:calcMonthly(initAmount,3.5,25),totalInterest:0,propertyValue:initValue,
  })

  // ── ΤΟ `userId` ΕΛΕΙΠΕ ΑΠΟ ΤΙΣ ΕΞΑΡΤΗΣΕΙΣ ΚΑΙ Η ΑΝΑΓΝΩΣΗ ΤΟ ΧΡΗΣΙΜΟΠΟΙΕΙ ──
  // Η `loadSaved` διαβάζει με `(supabase, propertyId, userId)` και το εφέ άκουγε
  // ΜΟΝΟ το `propertyId`. Ο έλεγχος ταυτότητας απαντά μετά την πρώτη απόδοση:
  // όταν το `userId` έφτανε αργότερα, η λίστα δανείων δεν ξαναδιαβαζόταν και η
  // καρτέλα έμενε με το αποτέλεσμα της κλήσης χωρίς χρήστη. Ως `useCallback`,
  // οι τρεις είσοδοι της ανάγνωσης είναι ΜΙΑ εξάρτηση και δεν ξεχνιούνται.
  const loadSaved = useCallback(async function loadSaved(){
    try{
      const rows = await loanStore.ofProperty(supabase,propertyId,userId) as SavedLoan[]
      setSaved(rows)
      // ΟΠΟΙΟΣ ΕΧΕΙ ΔΑΝΕΙΟ ΔΕΝ ΨΑΧΝΕΙ ΔΑΝΕΙΟ. Ο υπολογιστής αγοράς κλείνει —
      // δεν φεύγει. Γίνεται εδώ και όχι με αρχική τιμή του `useState`, γιατί το
      // αν υπάρχει δάνειο το μαθαίνουμε ΜΕΤΑ τη φόρτωση· ένα `useState(!rows)`
      // θα ήταν πάντα ανοιχτό στο πρώτο render και θα «πηδούσε» κλείνοντας.
      if(rows.length > 0) setCalcOpen(false)
    } finally { setLoadingSaved(false) }
  },[supabase,propertyId,userId])

  useEffect(()=>{loadSaved()},[loadSaved])

  async function handleSaveLoan(loan:Partial<SavedLoan>):Promise<void>{
    // ΤΟ ΜΗΝΥΜΑ ΕΠΙΤΥΧΙΑΣ ΗΤΑΝ ΨΕΜΑ. Το insert έγραφε `amount`, `rate`,
    // `loan_type`, `status`, `property_value` — πέντε στήλες που δεν υπήρχαν —
    // και το αποτέλεσμα δεν ελεγχόταν ποτέ. Ο χρήστης καταχωρούσε δάνειο,
    // έβλεπε «Το δάνειο αποθηκεύτηκε» και δεν αποθηκευόταν τίποτα.
    // Τώρα: μετάφραση στις πραγματικές στήλες (toLoanRow) και `must`, ώστε η
    // αποτυχία να φτάνει στο catch που ήδη περιβάλλει την κλήση.
    //
    // 02.10.2026: και το «…και οι δόσεις προστέθηκαν στο Ημερολόγιο» έβγαινε
    // ενώ οι δόσεις είχαν αποτύχει. Η ροή (./saveFlow) λέει τι έγινε και βγαίνει
    // ΕΝΑ μήνυμα, εδώ. Οι καλούντες (Υπολογιστής, σάρωση εγγράφων) δεν
    // προσθέτουν δικό τους. Η επιστροφή μένει `void` γιατί η σάρωση
    // (LoanDocScan) τη δηλώνει έτσι.
    // Αυτόματη προσυμπλήρωση των δόσεων στο Ημερολόγιο, ανά ημέρα πληρωμής,
    // εφόσον το δάνειο είναι ενεργό — ώστε να συμψηφίζεται με το υπόλοιπο app.
    const active = (loan.status ?? 'active') === 'active'
    const { amount, rate, years } = loan
    const r = await saveLoanFlow({
      add: () => must(loanStore.add(supabase,propertyId,userId,toLoanRow(loan))),
      reload: loadSaved,
      schedule: active && amount && rate && years
        ? () => handleSaveCal(calcMonthly(amount, rate, years), years, loan.start_date || athensToday(), loan.bank || '', amount, true)
        : null,
    })
    if (r.outcome === 'loan_failed') { notifyError(failed('Το δάνειο δεν αποθηκεύτηκε', r.error)); return }
    const text = loanSaveSuccessText(r.outcome)
    if (text) notifyOk(text)
  }
  async function handleSaveCal(monthly:number,years:number,startDate:string,bankName:string,loanAmount?:number,silent=false):Promise<boolean>{
    const events:calendar.EventDraft[]=[]
    const n=Math.min(years*12,60)
    // Ξεχωριστή, ιδιότυπη πηγή ανά τράπεζα → idempotent (δεν διπλογράφεται στο
    // ξαναπάτημα, ούτε μπερδεύεται με χειροκίνητα γεγονότα). Ρητές δόσεις, όχι
    // recurring, ώστε να μη διπλασιάζονται από την ανάπτυξη επαναλαμβανόμενων.
    // Ίδιο κλειδί πηγής και ίδιος τίτλος με τη γεννήτρια του Ημερολογίου: αν
    // αποκλίνουν, οι δύο δρόμοι φτιάχνουν ΔΥΟ σειρές για το ίδιο δάνειο.
    const src='loan_schedule:'+((bankName.trim()===UNSET_BANK?'':bankName.trim())||'γενικό').toLowerCase().replace(/\s+/g,'_').slice(0,40)
    const title=loanEventTitle(bankName)
    // Οι σημειώσεις κρατούν ποιο δάνειο και τι ποσό, για συμψηφισμό/αναγνώριση.
    const note=`Δόση ${fmtEur(monthly)} τον μήνα${loanAmount?` · Δάνειο ${fmtEur(loanAmount)}`:''}${bankName?` · ${bankName}`:''}`
    // Ίδιο σφάλμα με τις προτάσεις: τοπικά μεσάνυχτα σε UTC = χθες. Οι δόσεις
    // έμπαιναν στο ημερολόγιο μία μέρα ΝΩΡΙΤΕΡΑ από την πραγματική τους.
    // 02.10.2026: και έναρξη στις 29 ως 31 υπερχείλιζε στον επόμενο μήνα (31.9
    // γινόταν 1.10). Οι ημερομηνίες βγαίνουν από την έναρξη με κλείδωμα.
    for(const ev of instalmentDates(startDate,n)){
      events.push({title,category:'financial',event_date:ev,amount:Math.round(monthly),priority:'high',notes:note})
    }
    // Οι δόσεις γράφονται πρώτα και οι παλιές σβήνονται μετά: αν σπάσει κάτι στη
    // μέση, το ημερολόγιο δείχνει διπλά, όχι μισό δάνειο.
    // 02.10.2026: επιστρέφει αν γράφτηκαν, ώστε ο καλών να μη δείξει επιτυχία
    // πάνω σε αποτυχία. Σιωπηλή είναι μόνο η επιτυχία· το σφάλμα λέγεται πάντα.
    // Όταν η κλήση έρχεται από την αποθήκευση δανείου, λέει ότι το δάνειο
    // γράφτηκε.
    if(!await saved(silent?SCHEDULE_FAILED_AFTER_SAVE:'Οι δόσεις δεν αποθηκεύτηκαν στο ημερολόγιο',calendar.replaceSource(supabase,{propertyId,userId},{source:src},events))) return false
    if(!silent) notifyOk(`${n} δόσεις αποθηκεύτηκαν στο «Ημερολόγιο»`)
    return true
  }
  // 02.10.2026: επιστρέφει αν γράφτηκε. Ο υπολογιστής έβγαζε δεύτερο «Η δόση
  // προστέθηκε» μετά από αυτό εδώ ακόμη και πάνω στο μήνυμα αποτυχίας.
  async function handleSaveExp(monthly:number,bankName:string):Promise<boolean>{
    if(!await saved('Η δόση δεν καταχωρήθηκε στις δαπάνες',expenses.insert(supabase,[expenses.row({propertyId,userId},{description:`Δόση δανείου${bankName?`, ${bankName}`:''}`,amount:Math.round(monthly),category:'Δόση Δανείου',date:athensToday()})]))) return false
    notifyOk('Η δόση καταχωρήθηκε στις «Δαπάνες»')
    return true
  }
  async function deleteLoan(id:string){
    if(!(await confirmDialog('Διαγραφή δανείου;',{tone:'negative'})))return
    if(!await saved('Το δάνειο δεν διαγράφηκε',loanStore.remove(supabase,id))) return
    await loadSaved()
  }

  // ── Η ΗΜΕΡΟΜΗΝΙΑ ΕΙΝΑΙ ΤΗΣ ΠΑΛΑΙΟΤΕΡΗΣ ΤΡΑΠΕΖΑΣ ΠΟΥ ΔΕΙΧΝΟΥΜΕ ─────────────
  // Ερχόταν από το `verified_at` της πρώτης γραμμής της βάσης (της φθηνότερης,
  // όχι της παλαιότερης) ή από το κοινό `BANKS_VERIFIED`, που δεν ακολουθεί
  // τις ανά τράπεζα επαληθεύσεις. «Επιβεβαιωμένα» για όλη τη λίστα σημαίνει ότι
  // ισχύει και για την πιο παλιά της. Γράφεται με το `grDate` όπως κάθε άλλη
  // ημερομηνία της εφαρμογής, όχι ως σκέτο ISO.
  const banksVerifiedIso = BANKS.map(b=>b.verified_at).filter(Boolean).sort()[0] || BANKS_VERIFIED
  const banksUpdStr = grDate(banksVerifiedIso)
  // Έντιμη φρεσκάδα: τα ανά-τράπεζα επιτόκια είναι επαληθευμένα δεδομένα με
  // ημερομηνία (όχι αυτόματη ροή). Αν παλιώσουν, το λέμε καθαρά και παραπέμπουμε
  // στην πηγή, αντί να δίνουμε ψευδή εντύπωση «ζωντανών» τιμών.
  const banksAgeDays = Math.max(0, -(daysUntil(banksVerifiedIso) ?? 0))
  // ═══ «ΕΛΕΓΧΘΗΚΑΝ ΣΗΜΕΡΑ» ΔΕΝ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΜΕ «ΑΛΛΑΞΑΝ ΣΗΜΕΡΑ» ═════════
  // Η οθόνη έγραφε «επιβεβαιώθηκαν πριν από 56 ημέρες» επειδή το verified_at
  // ήταν η μόνη πληροφορία που είχε. Τώρα η τροφοδοσία τρέχει κάθε Δευτέρα και
  // αφήνει ίχνος (bank_feed_health): αν έτρεξε τις τελευταίες 200 ώρες (μία
  // εβδομάδα με περιθώριο) και πέτυχε, τα επιτόκια ΕΛΕΓΧΘΗΚΑΝ — και η
  // ημερομηνία που δείχνουμε είναι πότε επιβεβαιώθηκαν, όχι πότε τα κοίταξε
  // τελευταία κάποιος.
  const feedFresh = feed.checked && feed.ok && feed.hoursSilent != null && feed.hoursSilent <= 200
  const feedCheckedStr = feed.lastOk ? new Date(feed.lastOk).toLocaleDateString('el-GR',{day:'2-digit',month:'short'}) : ''
  const banksStale = !feedFresh && banksAgeDays > 45
  // Μία πηγή αλήθειας: η ανάλυση αντλεί απευθείας τα στοιχεία του Υπολογιστή
  // (χωρίς διπλά πεδία ποσού/διάρκειας/σκοπού).
  /**
   * Το δημοσιευμένο επιτόκιο της τράπεζας, ή null αν ΔΕΝ έχει δημοσιεύσει.
   *
   * ΓΙΑΤΙ null ΚΑΙ ΟΧΙ 3,5%: ο κώδικας είχε `|| 3.5` ως έσχατο δίχτυ. Αυτό
   * σήμαινε ότι τράπεζα χωρίς δημοσιευμένο επιτόκιο εμφάνιζε «Εκτιμώμενη δόση»
   * υπολογισμένη σε ΕΠΙΝΟΗΜΕΝΟ επιτόκιο — με το όνομα της τράπεζας από πάνω.
   * Δεν είναι πρόχειρη εκτίμηση· είναι αριθμός που αποδίδεται σε πραγματικό
   * ίδρυμα και μπορεί να κρίνει πού θα πάει ο χρήστης να δανειστεί.
   */
  type RateSource = { fixed_min?: unknown; fixed_5yr?: unknown; fixed_3yr?: unknown };
  const publishedRate = (bank: RateSource): number | null => {
    for (const r of [bank.fixed_min, bank.fixed_5yr, bank.fixed_3yr]) {
      const n = typeof r === 'number' ? r : parseFloat(String(r ?? ''));
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  };

  const advType = calcState.loanType
  const advBorr = calcState.borrowerType
  const LA = calcState.loanAmount || 150000
  const Y  = calcState.years || 25
  // Ταξινόμηση προγραμμάτων: πρώτα όσα λήγουν σύντομα, μετά κατά ημερομηνία
  // λήξης (πλησιέστερη πρώτη) και τέλος κατά σημαντικότητα (Σπίτι μου ΙΙ ψηλά).
  // Μόνο το «Σπίτι μου ΙΙ» θεωρείται κορυφαίας σημασίας — όχι το «Αναβαθμίζω το
  // Σπίτι μου», που περιέχει επίσης τη φράση. Γι' αυτό αγκυρώνουμε στην αρχή.
  const isSpitiMou2 = (name?:string) => /^\s*σπίτι μου/i.test(name||'')

  // ── Η ΣΕΙΡΑ ΚΑΙ Η ΚΑΤΑΣΤΑΣΗ ΒΓΑΙΝΟΥΝ ΑΠΟ ΤΟ ΗΜΕΡΟΛΟΓΙΟ ──────────────────
  // Πριν, η ταξινόμηση ξεκινούσε από το χειρόγραφο `deadline_urgent`: ένα
  // πρόγραμμα με ξεχασμένη σημαία καθόταν πρώτο στη λίστα αφότου είχε κλείσει.
  // Τώρα ό,τι δέχεται αίτηση ΣΗΜΕΡΑ ανεβαίνει και ό,τι έκλεισε πέφτει.
  const today = useMemo(()=>new Date(),[])
  const progStatus = useMemo(()=>{
    const m = new Map<string, ReturnType<typeof programStatus>>()
    for(const p of PROGRAMS) {
      const s = programStatus({ applicationDeadline: p.applicationDeadline, deadline: p.deadline, status: p.status }, today)
      // Το δικό του σημείωμα κλεισίματος, όπου το γενικό θα παραπλανούσε: το
      // διαβάζουν ΚΑΙ η κάρτα των προγραμμάτων ΚΑΙ ο σύμβουλος, από ένα σημείο.
      m.set(p.id, !s.acceptsApplications && s.state !== 'upcoming' && p.closedNote ? { ...s, note: p.closedNote } : s)
    }
    return m
  },[PROGRAMS, today])
  const stateOf = (p:ComparisonProgram) => progStatus.get(p.id) ?? programStatus({ status: p.status }, today)
  // ΤΟ «4 ΕΝΕΡΓΑ» ΗΤΑΝ ΤΟ ΠΛΗΘΟΣ ΟΛΩΝ ΤΩΝ ΓΡΑΜΜΩΝ. Ο υπότιτλος μετρούσε το
  // μήκος του πίνακα και το ονόμαζε «ενεργά», ενώ ο ίδιος πίνακας περιέχει και
  // όσα έχουν κλείσει — και οι κάρτες από κάτω το έγραφαν σωστά, μία μία. Η
  // κεφαλίδα διαφωνούσε με το περιεχόμενό της.
  const openPrograms = useMemo(() => PROGRAMS.filter(p => stateOf(p).acceptsApplications).length,
    // Η `stateOf` διαβάζει μόνο από τα `progStatus`/`today`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [PROGRAMS, progStatus])
  const activePrograms = useMemo<ComparisonProgram[]>(()=>[...PROGRAMS].sort((a,b)=>{
    const sa = stateOf(a), sb = stateOf(b)
    const oa = PROGRAM_ORDER[sa.state], ob = PROGRAM_ORDER[sb.state]
    if(oa!==ob) return oa-ob
    const da = sa.daysLeft ?? Number.POSITIVE_INFINITY, db = sb.daysLeft ?? Number.POSITIVE_INFINITY
    if(da!==db) return da-db
    return isSpitiMou2(a.name) ? -1 : isSpitiMou2(b.name) ? 1 : 0
  // Η `stateOf` διαβάζει μόνο από τα `progStatus`/`today`, που είναι στις εξαρτήσεις.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }),[PROGRAMS, progStatus])

  // Περιεχόμενο «Αποθηκευμένα δάνεια» — εμφανίζεται στο τέλος του «Μάθε
  // περισσότερα» (κάτω από τις επίσημες πηγές), όχι ως ξεχωριστός φακός.
  // Εξαγωγή αποθηκευμένων δανείων — «λογιστικού επιπέδου» .xlsx: τίτλος/υπότιτλος,
  // ωμοί αριθμοί (σωστή στοίχιση/μορφή), σωστά πλάτη στηλών, ζωντανά σύνολα SUM.
  const exportSavedLoans = () => {
    downloadXlsx(`Αποθηκευμένα δάνεια ${athensToday()}`, [{
      name: 'Δάνεια',
      title: 'Αποθηκευμένα δάνεια',
      subtitle: `${savedLoans.length} ${savedLoans.length===1?'δάνειο':'δάνεια'} · Έκδοση ${new Date().toLocaleDateString('el-GR')} · PROPERWISE`,
      columns: [
        { header:'Τράπεζα', kind:'text', width:20 },
        { header:'Τύπος δανείου', kind:'text', width:22 },
        { header:'Ποσό (€)', kind:'eur', width:15 },
        { header:'Επιτόκιο (%)', kind:'pct', width:12 },
        { header:'Τύπος επιτοκίου', kind:'text', width:15 },
        { header:'Διάρκεια (έτη)', kind:'int', width:13 },
        { header:'Δόση τον μήνα (€)', kind:'eur', width:16 },
        { header:'Συνολικοί τόκοι (€)', kind:'eur', width:17 },
        { header:'Δάνειο προς αξία (%)', kind:'pct', width:18 },
        { header:'Έναρξη', kind:'date', width:13 },
        { header:'Κατάσταση', kind:'text', width:12 },
        { header:'Σημειώσεις', kind:'text', width:30 },
      ],
      rows: savedLoans.map(loan=>{
        const m=calcMonthly(loan.amount,loan.rate,loan.years)
        const ti=m*loan.years*12-loan.amount
        const ltv=loan.property_value>0?(loan.amount/loan.property_value)*100:0
        return [
          loan.bank, LOAN_TYPES[loan.loan_type as LoanType]?.label||loan.loan_type,
          loan.amount, loan.rate, rateTypeLabel(loan.rate_type),
          loan.years, m, ti, ltv,
          loan.start_date ? new Date(loan.start_date) : '', loan.status==='active'?'Ενεργό':'Ανενεργό',
          (loan.notes||'').replace(/\n/g,' '),
        ]
      }),
      totalCols: [2, 6, 7],
    }])
  }

  return {
    initValue, initAmount, FIXED_TERM_COLUMNS, openSec, setOpenSec, profile, calcRef,
    scrollToCalc, calcLens, setCalcLens, lensRef, calcOpen, setCalcOpen, openCalcDocs, applyBank,
    savedLoans, filterSpiti, setFS, selBank, setSelBank, appliedLoan, setAppliedLoan, recHover,
    setRecHover, scoreHover, setScoreHover, otherHover, setOtherHover, hoverBank, setHoverBank,
    hoverBankRow, setHoverBankRow, loadingSaved, market, liveBanks, banksLoading, feed, reloadBanks,
    isAdmin, feedHealth, BANKS, calcState, setCalcState, handleSaveLoan, handleSaveCal,
    handleSaveExp, deleteLoan, banksUpdStr, banksAgeDays, feedFresh, feedCheckedStr, banksStale,
    publishedRate, advType, advBorr, LA, Y, isSpitiMou2, stateOf, openPrograms, activePrograms,
    exportSavedLoans,
  }
}

export type LoanState = ReturnType<typeof useLoan>
