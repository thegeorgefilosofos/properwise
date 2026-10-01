'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΛΟΓΙΣΤΙΚΗΣ: ΦΟΡΤΩΣΗ, ΡΥΘΜΙΣΕΙΣ, ΥΠΟΛΟΓΙΣΜΟΙ, ΕΝΕΡΓΕΙΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Ό,τι διαβάζει η καρτέλα από τη βάση, ό,τι θυμάται για τον χρήστη και ό,τι
// υπολογίζεται από αυτά: καταστάσεις, φόροι, ισοζύγιο, φάκελος λογιστή,
// κλείσιμο χρήσης. Η οθόνη (TabAccounting) μόνο το αποδίδει.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as properties from '@/lib/data/properties'
import * as loanStore from '@/lib/data/loans'
import * as stayStore from '@/lib/data/stays'
import * as rentStore from '@/lib/data/rent'
import * as tenantStore from '@/lib/data/tenants'
import { rentCollectionMode, collectionViaBankOf } from '@/lib/tax/rentCollectionMode'
import * as expenseStore from '@/lib/data/expenses'
import { ownerShareOf, ownerShareOfAmount } from '@/lib/expenses/sharing'
import { buildAdvisory } from '@/lib/accounting/advisory'
import { REGULATORY_UPDATES_2026, type UpdateAudience } from '@/lib/accounting/updates2026'
import { transferCosts } from '@/lib/accounting/transfer'
import type { LegalForm as DossierLegalForm } from '@/lib/accounting/dossier'
import { businessFormOf } from '@/lib/accounting/taxProfile'
import { sameTaxpayer } from '@/lib/accounting/taxpayer'
import type {
  ClientStaysRow, ExpensesRow, InventoryItemsRow, RentPaymentsRow, UserPropertiesRow,
} from '@/lib/supabase/tables'
// Η απογραφή έχει ένα σπίτι: lib/data/inventory.
import * as inventoryStore from '@/lib/data/inventory'
import * as accountantLink from '@/lib/data/accountantLink'
import type { LoanView } from '@/lib/loans/shape'
import type { TaxStay } from '@/lib/tax/shortTermTax'
import { saved } from '@/components/dbWrite'
import {
  buildLedger, cashflowByYear, reconcile, reconSummary, type LedgerInput, type Expected,
  type Actual,
} from '@/lib/accounting/ledger'
import {
  buildJournal, trialBalance, journalTotals, type IncomeRec, type ExpenseRec, type LoanPaymentRec,
} from '@/lib/accounting/journal'
import {
  incomeStatement, taxProvision, consolidateIndividual, type TaxRegime, type StatementInput,
  type IncomeStatement,
} from '@/lib/accounting/statement'
import {
  shortTermYearSummary, derivedPlatformFees, monthsWithOwnPlatformFee, staysMissingPlatformFee,
  isHouseType,
} from '@/lib/tax/shortTermTax'
import { bankReceiptMatters, presumptiveDeductionRateForYear } from '@/lib/billing/consolidate'
import { resolveEnfia } from '@/lib/billing/propertyFacts'
import { enfiaTypeBlock, ENFIA_TYPE_BLOCK_NOTE } from '@/lib/billing/enfia'
import { enfiaForYear, useEnfiaSettings, type EnfiaState } from '../useEnfia'
import * as billStore from '@/lib/data/bills'
import { billsWithoutExpense, type LedgerBill, type LedgerExpense } from '@/lib/expenses/ledger'
import { loanCalendarYear } from '@/lib/loans/progress'
import { isGroupDeductible } from '@/lib/expenses/groups'
import {
  rentalRowsForYear, BUSINESS_INCOME_ROWS_2026, BUILDING_DEPRECIATION_RATE,
  EQUIPMENT_DEPRECIATION_RATE, BUILDING_VALUE_FRACTION, selfEmployedMinNetIncome,
  rentalBracketsForYear,
} from '@/lib/billing/greekTax'
import { useReportBranding } from '@/lib/reportBranding'
import { hasFeature, planAtLeast, FEATURE_MIN_PLAN } from '@/lib/billing/entitlements'
import type { VatDeduction } from '@/lib/tax/myData'
import { PLANS, type PlanId } from '@/lib/billing/plans'
import { toMovement } from '../accountantTypes'
import { exportAccountantBundle } from '../sheets'
import {
  buildRegister, chargeForYear, RENTED_PROPERTY_ACCOUNT, EQUIPMENT_ACCOUNT,
} from '@/lib/accounting/fixedAssets'
import { declarableGrossOrTotal } from '@/lib/clients/stayAmounts'
import { CAPITALISABLE } from '@/lib/tax/elpAccounts'
import { CATEGORIES, isDeductible, resolveCategory } from '@/lib/expenses/taxonomy'
import { useAccountantDossier } from '../AccountantDossier'
import { fetchDossierPapers } from '../dossierPapers'
import { defaultBookkeeping, type LegalForm } from '@/lib/accounting/dossier'
import { readStatus, type PropertyStatus, type StatusRow } from '@/lib/property/status'
import { printRentCertificate, downloadOfficialRentCertificate } from '../rentCertificate'
import { notifyError } from '@/components/Toast'
import { MONTHS_NOM, MONTHS_SHORT } from '@/lib/core/months'
import { failed, MSG } from '@/lib/core/dbError'
import { useRemembered, useRememberedFlag } from '@/components/useRememberedFlag'
import { eur, athensNow, athensYear, todayAthens, readElp, writeElp, readNum, writeNum } from './model'

// Τα μισθώματα της χρήσης ανά μήνα (Ιανουάριος πρώτος). Τα χρειάζεται η κύρωση
// της τραπεζικής είσπραξης, που το 2027 πιάνει μόνο τους μήνες από τον Ιούλιο
// (Α.1187/2026): η τεκμαρτή έκπτωση χάνεται για το μερίδιο αυτών των μηνών.
const rentByMonth = (rows:{ period_year?:number|null; period_month?:number|null; amount?:number|null }[], year:number):number[] => {
  const w = new Array(12).fill(0)
  for(const r of rows){ const m=Number(r.period_month); if(r.period_year===year && m>=1 && m<=12) w[m-1]+=Number(r.amount)||0 }
  return w
}

export type AccountingProps = { propertyId:string; userId:string; profileType?:'individual'|'professional'; legalForm?:DossierLegalForm; plan?:PlanId; status?:PropertyStatus; onNavigate?:(tab:string)=>void }

export function useAccounting({ propertyId, userId, profileType='individual', legalForm='individual', plan='free', onNavigate }: AccountingProps) {
  const supabase = createClient()
  const branding = useReportBranding(userId)
  const [reportBuilderOpen, setReportBuilderOpen] = useState(false)
  const [journalOpen, setJournalOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [genOfficial, setGenOfficial] = useState(false)
  const [genOfficialCert, setGenOfficialCert] = useState(false)
  const [loading,setLoading] = useState(true)
  // ΤΟ ΜΗΔΕΝ ΠΟΥ ΔΕΝ ΕΙΝΑΙ ΜΗΔΕΝ. Οι τρεις αναγνώσεις που χτίζουν τη
  // φορολογική εικόνα γύριζαν άδεια λίστα και όταν δεν υπάρχουν δεδομένα και
  // όταν η ανάγνωση απέτυχε. Στη Λογιστική τα δύο δεν είναι το ίδιο: το πρώτο
  // είναι «δεν έχεις καταχωρήσει», το δεύτερο είναι «δεν ξέρω τι έχεις» — και
  // από εδώ βγαίνουν Ε2, βεβαίωση ενοικίου και φάκελος λογιστή, με αριθμό
  // εγγράφου και κωδικό επαλήθευσης.
  const [readFailed,setReadFailed] = useState(false)
  const [year,setYear] = useState(athensYear())
  // Η καρτέλα ακολουθεί το προφίλ (Ρυθμίσεις): ο ιδιώτης βλέπει απλή εικόνα, ο
  // επαγγελματίας τη διάκριση Φυσικό πρόσωπο / Επιχείρηση (ΕΛΠ). Χωρίς περιττό toggle.
  const mode:'individual'|'professional' = profileType
  // ── ΔΥΟ ΔΙΑΚΟΠΤΕΣ ΠΟΥ ΞΑΝΑΡΩΤΟΥΣΑΝ ΤΗ ΝΟΜΙΚΗ ΜΟΡΦΗ ──────────────────────
  // Δηλώνεται ΜΙΑ φορά, στην υποδοχή και ζει στο `billing_profiles.legal_form`.
  // Εδώ υπήρχαν δύο τοπικά αντίγραφά της, με δικά τους κουμπιά και η καρτέλα
  // Αποδόσεις είχε τρίτο. Ο χρήστης μπορούσε να δηλώσει «Νομικό πρόσωπο» εδώ,
  // «Ατομική» δίπλα και «Φυσικό» στο προφίλ — τρεις οθόνες, τρεις φόροι.
  //
  // Το `legal_form` ξέρει ήδη και τα δύο: αν υπάρχει επιχείρηση και αν είναι
  // ατομική ή νομικό πρόσωπο. Αν κάτι είναι λάθος, διορθώνεται εκεί που δηλώθηκε.
  // ── ΤΟ «ΦΥΣΙΚΟ ΠΡΟΣΩΠΟ Ή ΕΠΙΧΕΙΡΗΣΗ» ΜΕΝΕΙ ΕΡΩΤΗΣΗ, ΚΑΙ ΝΑ ΓΙΑΤΙ ────────
  // Το είχα παραγάγει από τη νομική μορφή: «έχει επιχείρηση, άρα επιχείρηση».
  // Είναι λάθος και το γράφει η ίδια η εφαρμογή σε τρία σημεία: το ενοίκιο
  // φυσικού προσώπου φορολογείται με το ΑΡΘΡΟ 40 (δική του κλίμακα, τεκμαρτή
  // έκπτωση 5%), όχι με το άρθρο 15. Το κριτήριο είναι αν το ΑΚΙΝΗΤΟ ανήκει
  // στην επιχείρηση, όχι αν ο ιδιοκτήτης έχει ΑΦΜ επιχείρησης για άσχετη
  // δραστηριότητα. Σε ενοίκια 18.000€, η παραγωγή έβγαζε φόρο 2.012 αντί
  // 3.075 και πρόβλεψη 167,70 τον μήνα αντί 292,75: ο χρήστης θα έβρισκε το
  // κενό στο εκκαθαριστικό.
  //
  // Άρα μένει επιλογή, με προεπιλογή το σωστό για τη συντριπτική πλειονότητα.
  // Η ΜΟΡΦΗ όμως ΔΕΝ είναι ερώτηση: δηλώθηκε στην υποδοχή και η αντιστοίχισή
  // της σε φορολογικό καθεστώς ζει σε ένα σημείο, με τεστ (lib/accounting/taxProfile).
  const elpForm = businessFormOf(legalForm)
  // ── Ο ΛΟΓΑΡΙΑΣΜΟΣ ΕΤΑΙΡΕΙΑΣ ΞΕΚΙΝΑ ΑΠΟ ΤΗΝ ΕΤΑΙΡΕΙΑ ─────────────────────
  // Η «συντριπτική πλειονότητα» είναι ο ιδιώτης. Όποιος όμως έχει δηλώσει
  // νομικό πρόσωπο (ΑΕ, ΙΚΕ, ΟΕ) άνοιγε κι αυτός στα «Ενοίκια ιδιώτη»: η
  // Λογιστική έγραφε φόρο φυσικού προσώπου και η Απόδοση, για το ίδιο ακίνητο,
  // 22% συν μέρισμα. Για νομικό πρόσωπο η προεπιλογή είναι η επιχείρηση· η
  // ατομική επιχείρηση μένει στην ερώτηση, γιατί εκεί ισχύει ο λόγος από πάνω.
  // Η επιλογή του χρήστη θυμάται ανά ακίνητο: το ένα μπορεί να ανήκει στην
  // εταιρεία και το άλλο στον ίδιο.
  const [elpChoice,setElp] = useRemembered<'personal'|'business'|null>(`acc_elp_${propertyId}`, readElp, writeElp, null)
  const elp:'personal'|'business' = elpChoice ?? (elpForm==='company' ? 'business' : 'personal')
  // Ηλικία, μόνο για τη μειωμένη κλίμακα νέων (ν.5246/2025). Τοπική, προαιρετική.
  // ΤΡΕΙΣ ΤΙΜΕΣ ΠΟΥ ΤΙΣ ΘΥΜΑΤΑΙ Ο ΠΕΡΙΗΓΗΤΗΣ, ΟΧΙ Η REACT. Ηταν κενές αρχικές
  // τιμές με effect που τις γέμιζε μετά: η οθόνη του φόρου έδειχνε για ένα καρέ
  // υπολογισμό ΧΩΡΙΣ τις εισφορές ΕΦΚΑ, δηλαδή λάθος νούμερο πριν το σωστό.
  const [age,setAge] = useRemembered<number|''>('acc_age', readNum, writeNum, '')
  // Επιχειρηματικές παράμετροι (τοπικές, προαιρετικές): ετήσιες εισφορές ΕΦΚΑ,
  // πρώτη τριετία δραστηριότητας, ποσοστό διανομής κερδών νομικού προσώπου.
  const [ekfa,setEkfa] = useRemembered<number|''>('acc_ekfa', readNum, writeNum, '')
  const [firstYears,updateFirstYears] = useRememberedFlag('acc_first3')
  const [distribution,setDistribution] = useState<number|''>('')
  // ══ ΤΟ ΤΣΕΚ ΤΩΝ ΑΝΕΙΣΠΡΑΚΤΩΝ ΑΝΗΚΕΙ ΣΕ ΑΚΙΝΗΤΟ, ΟΧΙ ΣΤΗΝ ΟΘΟΝΗ ═══════════
  // Ηταν σκέτο `useState(false)` κι η καρτέλα δεν ξεφορτώνεται με την αλλαγή
  // ακινήτου: τσεκαρισμένο στην «Αλεξάνδρας 12» έμενε τσεκαρισμένο κι στην
  // «Πατησίων 5», όπου η ετικέτα έγραφε ΑΛΛΟ ποσό ανείσπρακτων. Η απαλλαγή του
  // άρθρου 39 §4 θέλει διαταγή πληρωμής ή αγωγή για ΤΗ ΣΥΓΚΕΚΡΙΜΕΝΗ μίσθωση·
  // δεν ταξιδεύει. Κρατιέται το id, όχι μια σημαία: η κατάσταση δεν χρειάζεται
  // effect για να καθαρίσει — η αλλαγή ακινήτου την ακυρώνει από μόνη της.
  const [claimedFor,setClaimedFor] = useState('')
  const claimedUncollected = !!propertyId && claimedFor === propertyId
  const setClaimedUncollected = useCallback((v:boolean)=>setClaimedFor(v?propertyId:''),[propertyId])
  // ═══════════════════════════════════════════════════════════════════════
  // Η ΤΡΑΠΕΖΙΚΗ ΕΙΣΠΡΑΞΗ ΠΑΡΑΓΕΤΑΙ, ΔΕΝ ΠΡΟΕΠΙΛΕΓΕΤΑΙ.
  // ─────────────────────────────────────────────────────────────────────
  // Ηταν `useState(true)`: η οθόνη που βγάζει τον φόρο προεπέλεγε την εκδοχή
  // που δίνει την έκπτωση 5%, δηλαδή τον ΜΙΚΡΟΤΕΡΟ φόρο, για ερώτημα που η
  // εφαρμογή ήδη ξέρει — απο τον τρόπο κάθε είσπραξης και απο τον διακόπτη
  // της μίσθωσης. Η «Φροντίδα μισθωτή» χρησιμοποιούσε ήδη τον δεύτερο σωστά.
  //
  // Ο κανόνας ζει στο lib/tax/rentCollectionMode.ts. Εδώ μένει μόνο η
  // ΠΑΡΑΚΑΜΨΗ: ο χρήστης μπορεί να διαφωνήσει με ό,τι παρήγαγε η εφαρμογή,
  // και τότε μετράει η δική του απάντηση.
  // ═══════════════════════════════════════════════════════════════════════
  const [leaseViaBank,setLeaseViaBank] = useState<boolean|null>(null)
  const [rentsBankOverride,setRentsBankOverride] = useState<boolean|null>(null)
  // Υπολογιστής κόστους μεταβίβασης (αγορά/πώληση), τοπικός.
  const [xferSide,setXferSide] = useState<'buy'|'sell'>('buy')
  const [xferPrice,setXferPrice] = useState<number|''>('')
  const [xferFirstHome,setXferFirstHome] = useState(false)
  const [xferAgent,setXferAgent] = useState(true)
  const [openAdvisory,setOpenAdvisory] = useState<string|null>(null)
  const [advisoryOpen,setAdvisoryOpen] = useState(false)
  const [changesOpen,setChangesOpen] = useState(false)
  // Οι μεγάλες κάρτες ανοίγουν ΑΝΟΙΧΤΕΣ: ο ιδιοκτήτης έρχεται εδώ για να τις
  // διαβάσει. Το χειριστήριο υπάρχει για να τις κλείσει όταν ψάχνει άλλη.
  const [reconOpen,setReconOpen] = useState(true)
  const [ledgerOpen,setLedgerOpen] = useState(true)
  const [consolOpen,setConsolOpen] = useState(true)
  const [balanceOpen,setBalanceOpen] = useState(true)
  const [openChange,setOpenChange] = useState<string|null>(null)
  // Οι δύο ενημερωτικές ενότητες (Συμβουλευτική, Τι άλλαξε) ανοίγουν/κλείνουν ομοιόμορφα:
  // κλικ στην κεφαλίδα εναλλάσσει, κλικ εκτός τις ελαχιστοποιεί (καθαρή, ήσυχη εικόνα).
  const advisoryRef = useRef<HTMLDivElement>(null)
  const changesRef = useRef<HTMLDivElement>(null)
  useEffect(()=>{
    if(!advisoryOpen && !changesOpen) return
    // pointerdown: καλύπτει ποντίκι + αφή + πένα (σε iOS το mousedown δεν πυροδοτείται
    // σε μη-clickable στοιχεία, οπότε το «κλικ εκτός» θα αστοχούσε στο κινητό).
    const onDown = (e:PointerEvent)=>{
      const t = e.target as Node
      if(advisoryOpen && advisoryRef.current && !advisoryRef.current.contains(t)){ setAdvisoryOpen(false); setOpenAdvisory(null) }
      if(changesOpen && changesRef.current && !changesRef.current.contains(t)){ setChangesOpen(false); setOpenChange(null) }
    }
    const onKey = (e:KeyboardEvent)=>{ if(e.key==='Escape'){ setAdvisoryOpen(false); setOpenAdvisory(null); setChangesOpen(false); setOpenChange(null) } }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return ()=>{ document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  },[advisoryOpen,changesOpen])
  const [showBankImport,setShowBankImport] = useState(false)
  const [refreshKey,setRefreshKey] = useState(0)
  const [hoverBracket,setHoverBracket] = useState<number|null>(null)
  // Ουδετερότητα: οι αριθμοί είναι μελάνι· χρώμα ΜΟΝΟ στο hover, στα νούμερα με νόημα.
  // Ενα πλακίδιο, μία κατάσταση: το `hoverStat` κρατούσε ποιο από τα δύο ήταν
  // από κάτω ο δείκτης. Με ένα, το ερώτημα είναι ναι ή όχι.
  const [taxHot,setTaxHot] = useState(false)
  const [tenant,setTenant] = useState<{ full_name?:string; afm?:string }|null>(null)
  const [xferOpen,setXferOpen] = useState(true)
  const [cashOpen,setCashOpen] = useState(true)
  // ── ΠΟΙΟΣ ΒΛΕΠΕΙ ΤΟ ΔΙΠΛΟΓΡΑΦΙΚΟ ΒΑΘΟΣ ──────────────────────────────────
  // Το ισοζύγιο και το ημερολόγιο άρθρων ήταν κλειδωμένα πίσω από το
  // `profileType`, που ΔΕΝ είναι συνδρομή: είναι διακόπτης εμφάνισης στις
  // Ρυθμίσεις. Δύο λάθη ταυτόχρονα. Ο συνεργάτης και ο χρήστης με δωρεάν μήνες
  // παίρνουν πλάνο «Επαγγελματίας» κρατώντας προφίλ «Ιδιώτη» — δεν έβλεπαν ό,τι
  // δικαιούνταν· και αντίστροφα, ο διακόπτης εμφάνισης δεν επιτρέπεται να
  // ξεκλειδώνει χρεώσιμο εργαλείο. Το μητρώο το λέει ήδη μία φορά, με τεστ:
  // `accounting_journal` από «Επαγγελματίας» και πάνω, όπως το γράφει και η
  // κάρτα του πακέτου. Το `doubleEntry` μένει δίπλα του γιατί απαντά άλλο
  // ερώτημα — όχι «το πληρώνει;» αλλά «το έχει;»: ισοζύγιο χωρίς διπλογραφικά
  // βιβλία δεν υπάρχει, σε κανένα πλάνο.
  const canJournal = hasFeature({ plan }, 'accounting_journal')
  // Το όνομα του πακέτου διαβάζεται από το μητρώο, ποτέ γραμμένο στο χέρι:
  // αλλιώς την ημέρα που το ημερολόγιο άρθρων αλλάξει σκαλί, η οθόνη θα
  // συνέχιζε να στέλνει τον χρήστη σε λάθος πακέτο.
  const journalPlanName = PLANS[FEATURE_MIN_PLAN.accounting_journal].name
  // Τα ίδιο ερώτημα για τα τρία εργαλεία χαρτοφυλακίου του μενού: τα δίνει η
  // ΣΥΝΔΡΟΜΗ (όλα «Επαγγελματίας»), όχι ο διακόπτης εμφάνισης. Ίδιος λόγος με
  // το ημερολόγιο άρθρων — και ίδιος χρήστης που τα έχανε.
  //
  // ΚΑΘΕΝΑ ΡΩΤΑΕΙ ΓΙΑ ΤΟΝ ΕΑΥΤΟ ΤΟΥ. Και τα τρία κρέμονταν από ένα κλειδί, το
  // `bank_import`. Σήμερα δεν φαίνεται γιατί όλα ξεκλειδώνουν στο ίδιο σκαλί —
  // την ημέρα όμως που η εισαγωγή κινήσεων κατέβει ένα πακέτο, θα κατέβαινε
  // μαζί της και η σύνθεση αναφοράς, χωρίς να το ζητήσει κανείς.
  // Η ΠΥΛΗ ΛΟΓΙΣΤΗ ΕΙΝΑΙ Η ΕΞΑΓΩΓΗ Ε2 ΜΕ ΑΛΛΗ ΠΟΡΤΑ, άρα ΙΔΙΟ χαρακτηριστικό.
  // Δεύτερο όνομα εδώ θα σήμαινε δύο κατώφλια για ένα παραδοτέο, που θα
  // απέκλιναν στην πρώτη αλλαγή τιμολόγησης. Η πραγματική κλειδαριά ζει στη
  // βάση (get_accountant_data, 20260819120000)· εδώ είναι η ΕΞΗΓΗΣΗ, ώστε ο
  // ιδιοκτήτης να μη μοιράσει σύνδεσμο που δεν θα ανοίξει.
  const canAccountantPortal = hasFeature({ plan }, 'e2_export')
  const canBankImport = hasFeature({ plan }, 'bank_import')
  // Η σύνθεση αναφοράς κατεβάζει τη σύγκριση ΟΛΟΚΛΗΡΟΥ του χαρτοφυλακίου: είναι
  // η ίδια δυνατότητα με την καρτέλα «Χαρτοφυλάκιο», από άλλη πόρτα.
  const canPortfolioReport = hasFeature({ plan }, 'portfolio')
  // Η κατανομή σε συνιδιοκτήτες δεν πωλείται χωριστά και δεν έχει δική της
  // εγγραφή στο μητρώο δυνατοτήτων. Έρχεται ολόκληρη με το «Επαγγελματίας» και
  // το γράφουμε έτσι αντί να τη δανειστούμε από ξένο κλειδί.
  const canOwnerSplit = planAtLeast(plan, 'agency')
  // Τα προχωρημένα εργαλεία ξεκινούν κλειστά για ΟΛΟΥΣ. Ο επαγγελματίας τα
  // βρίσκει με ένα κλικ· ο ιδιώτης δεν χρειάζεται να τα προσπεράσει κάθε φορά.
  const [advancedOpen,setAdvancedOpen] = useState(false)
  // Live πύλη λογιστή (χωρίς login/email): ένας σύνδεσμος με token ανά χρήστη.
  const [acctCopied,setAcctCopied] = useState(false)
  const [acctBusy,setAcctBusy] = useState(false)
  const [acctLink,setAcctLink] = useState<string|null>(null)
  const [acctRevoked,setAcctRevoked] = useState(false)
  const [acctUntil,setAcctUntil] = useState('')
  const updateAge=setAge
  const updateEkfa=setEkfa
  // ── ΤΙ ΑΚΡΙΒΩΣ ΖΗΤΑΕΙ ΚΑΘΕ ΕΡΩΤΗΜΑ ──────────────────────────────────────
  // Οι τύποι γραμμών γεννιούνται από τα migrations (lib/supabase/tables.ts) και
  // κόβονται με `Pick` στις στήλες που ΟΝΤΩΣ ζητά το `select`. Έτσι μια στήλη
  // που δεν ζητήθηκε δεν μπορεί να διαβαστεί κατά λάθος παρακάτω — σφάλμα που
  // με `any[]` έβγαινε ως `undefined` και κατέληγε σε μηδενικό ποσό στην οθόνη.
  // Το `id`, το `bill_id` και το `paid` ζητούνται για ΕΝΑ λόγο: να ξέρει η
  // συγχώνευση με τους λογαριασμούς ποιος λογαριασμός έχει ήδη γίνει δαπάνη.
  type ExpenseRow  = Pick<ExpensesRow, 'id'|'bill_id'|'paid'|'date'|'amount'|'category'|'expense_group'|'description'|'supplier_country'|'supply'|'supplier_afm'|'paid_by'|'share_percent'>
  type RentRow     = Pick<RentPaymentsRow, 'period_year'|'period_month'|'amount'|'paid'|'paid_date'|'due_date'|'method'>
  type PortfolioRentRow = RentRow & Pick<RentPaymentsRow, 'property_id'>
  type StayRow     = TaxStay & Pick<ClientStaysRow, 'id'|'channel'|'declared_at'>
  type PortfolioStayRow = StayRow & Pick<ClientStaysRow, 'property_id'>
  // Το `year_built` και το `floor` υπάρχουν στην καρτέλα του ακινήτου αλλά δεν
  // ζητούνταν εδώ, οπότε η αυτόματη εκτίμηση ΕΝΦΙΑ έπεφτε στις προεπιλογές της
  // (2ος όροφος, 10-20 ετών) και έβγαινε 16,15% ψηλότερα από την ουδέτερη βάση.
  // Και ο `prop_type`: χωρίς αυτόν η εκτίμηση χρέωνε αποθήκη 20 τ.μ. με τον
  // πίνακα των κατοικιών (39,20€ τον χρόνο) και οικόπεδο 400 τ.μ. με 600,00€.
  type PropRow     = Pick<UserPropertiesRow, 'id'|'name'|'address'|'rental_mode'|'enfia'|'sqm'|'value'|'year_built'|'floor'|'purchase_price'|'purchase_date'|'prop_type'|'ownership'|'postal_code'>
  type PropListRow = Pick<UserPropertiesRow, 'id'|'name'|'rental_mode'|'status_detail'|'enfia'|'sqm'|'ownership'|'prop_type'|'client_id'>
  type InventoryRow = Pick<InventoryItemsRow, 'name'|'purchase_value'|'category'|'purchase_date'>

  const [expenses,setExpenses] = useState<ExpenseRow[]>([])
  const [bills,setBills] = useState<LedgerBill[]>([])
  const [rent,setRent] = useState<RentRow[]>([])
  const [stays,setStays] = useState<StayRow[]>([])
  const [loans,setLoans] = useState<LoanView[]>([])
  const [inventory,setInventory] = useState<InventoryRow[]>([])
  const [prop,setProp] = useState<PropRow|null>(null)
  const [owner,setOwner] = useState<{ owner_name: string|null; owner_afm: string|null }|null>(null)
  const [allProps,setAllProps] = useState<PropListRow[]>([])
  const [allRent,setAllRent] = useState<PortfolioRentRow[]>([])
  const [allStays,setAllStays] = useState<PortfolioStayRow[]>([])
  // Οι καρτέλες «Ιδιοκτήτης» του Πελατολογίου: καθεμία είναι χωριστός
  // φορολογούμενος (lib/accounting/taxpayer.ts). `null` όσο δεν διαβάστηκαν.
  const [ownerClientIds,setOwnerClientIds] = useState<Set<string>|null>(null)

  // ΑΚΥΡΩΣΗ ΑΝΑ ΑΚΙΝΗΤΟ. Εννέα ερωτήματα φορτώνουν έσοδα, δαπάνες, δάνεια και
  // στοιχεία ακινήτου. Με αλλαγή ακινήτου μέσα στο διάστημα φόρτωσης, η
  // προηγούμενη απάντηση προσγειωνόταν πάνω στη νεότερη: ο ιδιοκτήτης έβλεπε
  // φορολογητέο εισόδημα, φόρο και πρόβλεψη ΑΛΛΟΥ ακινήτου, με το όνομα του
  // τρέχοντος από πάνω — και από αυτή την οθόνη βγαίνει βεβαίωση ενοικίου και
  // PDF με αριθμό εγγράφου.
  useEffect(()=>{ let alive = true; (async()=>{
    setLoading(true)
    try{
      // ── ΚΑΘΕ ΜΙΑ ΑΠΟ ΤΙΣ ΔΕΚΑ ΑΝΑΓΝΩΣΕΙΣ ΛΕΕΙ ΑΝ ΠΕΤΥΧΕ ─────────────────
      // ΤΟ ΣΦΑΛΜΑ: ο δείκτης αποτυχίας κοιτούσε ΤΡΕΙΣ από τις δέκα. Οι άλλες
      // επτά επέστρεφαν άδεια λίστα σε κάθε αποτυχία και η οθόνη τη διάβαζε
      // ως δεδομένο. Δεν είναι το ίδιο πράγμα και εδώ βγαίνει ΦΟΡΟΣ:
      //
      //   δάνεια που δεν διαβάστηκαν  → μηδενικοί τόκοι  → ΜΕΓΑΛΥΤΕΡΟΣ φόρος
      //   απογραφή που δεν διαβάστηκε → μηδέν αποσβέσεις → ΜΕΓΑΛΥΤΕΡΟΣ φόρος
      //   ακίνητο που δεν διαβάστηκε  → η εκτίμηση ΕΝΦΙΑ πέφτει σε προεπιλογές
      //   χαρτοφυλάκιο που δεν διαβάστηκε → λάθος μερίδιο φόρου στο Ε1
      //   μισθωτής που δεν διαβάστηκε → η οθόνη διαλέγει μόνη της αν ισχύει
      //                                 η τεκμαρτή έκπτωση 5%
      //
      // Ολα αυτά παρουσιάζονταν ως υπολογισμός, με κουμπί εξαγωγής από κάτω.
      const [exR, rpR, stR, lnR, prR, apsR, arpR, astR, invR, tnR, ownR, blR, ocR] = await Promise.all([
        expenseStore.ledgerWithError<ExpenseRow>(supabase,propertyId,{ columns:'id,bill_id,paid,date,amount,category,expense_group,description,supplier_country,supply,supplier_afm,paid_by,share_percent' }),
        // Ο ΤΡΟΠΟΣ ΠΛΗΡΩΜΗΣ ΕΙΝΑΙ ΦΟΡΟΛΟΓΙΚΟ ΣΤΟΙΧΕΙΟ, ΟΧΙ ΔΙΑΚΟΣΜΗΤΙΚΟ: από
        // αυτόν κρίνεται η τεκμαρτή έκπτωση 5%. Μία στήλη παραπάνω στο ίδιο ερώτημα.
        rentStore.ofPropertyWithError<RentRow>(supabase,propertyId,`${rentStore.LEDGER_COLUMNS},method`,userId),
        stayStore.ofPropertyWithError<StayRow>(supabase,propertyId,`id,${stayStore.ACCOUNTING_COLUMNS}`,userId),
        loanStore.ofPropertyWithError(supabase,propertyId,userId),
        properties.oneWithError<PropRow>(supabase, propertyId, 'id,name,address,rental_mode,enfia,sqm,value,year_built,floor,purchase_price,purchase_date,prop_type,ownership,postal_code', userId),
        properties.listWithError<PropListRow>(supabase, userId, { columns: 'id,name,rental_mode,status_detail,enfia,sqm,ownership,prop_type,client_id' }),
        rentStore.ofUserWithError<PortfolioRentRow>(supabase,userId,`property_id,${rentStore.LEDGER_COLUMNS}`),
        stayStore.ofUserWithError<PortfolioStayRow>(supabase,userId,`property_id,${stayStore.ACCOUNTING_COLUMNS}`),
        inventoryStore.ofPropertyWithError<InventoryRow>(supabase,propertyId,'name,purchase_value,category,purchase_date',userId),
        // Η ΠΡΟΘΕΣΗ ΤΗΣ ΜΙΣΘΩΣΗΣ, όταν δεν υπάρχει απόδειξη απο τις εισπράξεις.
        tenantStore.currentWithError<{ e_payment?: boolean|null }>(supabase, propertyId, 'e_payment', userId),
        // ΠΟΙΟΣ ΕΙΝΑΙ Ο ΦΟΡΟΛΟΓΟΥΜΕΝΟΣ. Ο φάκελος του λογιστή έγραφε στο πεδίο
        // «Φορολογούμενος» το ΟΝΟΜΑ ΤΟΥ ΑΚΙΝΗΤΟΥ, επειδή τίποτα δεν του έλεγε
        // ποιος είναι ο άνθρωπος. Το ΑΦΜ ήταν πεδίο εισόδου που καμία οθόνη
        // δεν συμπλήρωνε ποτέ.
        properties.ownerOf(supabase, propertyId, userId),
        // ΟΙ ΛΟΓΑΡΙΑΣΜΟΙ ΠΟΥ ΔΕΝ ΕΓΙΝΑΝ ΔΑΠΑΝΗ. Χωρίς αυτούς τα έξοδα της χρονιάς
        // έβγαιναν εδώ 1.152€ και στην Τιμολόγηση 1.890€ για το ίδιο ακίνητο.
        billStore.ofPropertyWithError<LedgerBill>(supabase, propertyId, billStore.LEDGER_COLUMNS, userId),
        // ΠΟΙΟΙ ΕΙΝΑΙ ΟΙ ΦΟΡΟΛΟΓΟΥΜΕΝΟΙ ΤΟΥ ΛΟΓΑΡΙΑΣΜΟΥ. Χωρίς αυτό η ενοποίηση
        // έβαζε τα ακίνητα δύο ιδιοκτητών σε μία κλίμακα.
        supabase.from('clients').select('id').eq('user_id', userId).eq('type', 'owner'),
      ])
      if(!alive) return
      setReadFailed([exR,rpR,stR,lnR,prR,apsR,arpR,astR,invR,tnR,blR,ocR].some(r=>!!r.error))
      setExpenses(exR.rows); setBills(blR.rows); setRent(rpR.rows); setLeaseViaBank(tnR.row ? (tnR.row.e_payment !== false) : null)
      setStays(stR.rows); setLoans(lnR.views)
      setProp(prR.row); setAllProps(apsR.rows); setOwner(ownR)
      setAllRent(arpR.rows); setAllStays(astR.rows)
      setInventory(invR.rows)
      setOwnerClientIds(ocR.error ? null : new Set(((ocR.data || []) as { id: string }[]).map(c=>c.id)))
    }catch(_){ if(alive) setReadFailed(true) /* διατηρούμε ό,τι ήδη έχει φορτωθεί· το UI δεν κολλάει */ }
    finally{ if(alive) setLoading(false) }
  })(); return ()=>{ alive = false } },[propertyId,userId,refreshKey,supabase])

  // ΩΜΟ `rental_mode` ΕΧΑΝΕ ΤΑ ΒΡΑΧΥΧΡΟΝΙΑ ΑΚΙΝΗΤΑ. Όσα σημάνθηκαν πριν από τη
  // μετάβαση κρατούν `status_detail: 'seasonal'` χωρίς `rental_mode` — και το
  // ίδιο κάνει το δείγμα επίδειξης της εφαρμογής. Για αυτά, το καθεστώς έβγαινε
  // «μακροχρόνια», τα μεικτά έσοδα διαβάζονταν από τις δόσεις ενοικίου (που δεν
  // υπάρχουν στη βραχυχρόνια) και το αποτέλεσμα ήταν ΜΗΔΕΝ έσοδα, μηδέν φόρος,
  // μηδέν πρόβλεψη — σε PDF με αριθμό εγγράφου και κωδικό QR επαλήθευσης.
  const isShort = readStatus(prop as StatusRow) === 'rent_short'
  const regime:TaxRegime = isShort ? 'individual_shortterm' : 'individual_longterm'
  // ══ ΕΝΑΣ ΛΟΓΑΡΙΑΣΜΟΣ ΔΕΝ ΕΙΝΑΙ ΠΑΝΤΑ ΕΝΑΣ ΦΟΡΟΛΟΓΟΥΜΕΝΟΣ ═════════════════
  // Ο επαγγελματίας διαχειριστής κρατά ακίνητα πολλών ιδιοκτητών. Η κλίμακα
  // και η εξαίρεση των δύο βραχυχρόνιων μετρούν ΑΝΑ ιδιοκτήτη, όχι ανά
  // λογαριασμό. Ο ιδιώτης μένει ένας φορολογούμενος, όπως ήταν.
  const taxpayerProps = useMemo(()=>sameTaxpayer(allProps, propertyId, mode==='professional' ? ownerClientIds : null),
    [allProps, propertyId, mode, ownerClientIds])
  // ══ ΤΟ ΤΕΛΟΣ ΠΑΡΕΠΙΔΗΜΟΥΝΤΩΝ ΜΕΤΡΑΕΙ ΒΡΑΧΥΧΡΟΝΙΑ ΑΚΙΝΗΤΑ, ΟΧΙ ΑΚΙΝΗΤΑ ══════
  // Ο νόμος (ν.5073/2023) εξαιρεί τα φυσικά πρόσωπα που εκμισθώνουν ΒΡΑΧΥΧΡΟΝΙΑ
  // έως δύο ακίνητα. Εδώ μετριούνταν ΟΛΑ όσα έχει ο χρήστης: μακροχρόνιες
  // μισθώσεις, η ίδια του η κατοικία, μια αποθήκη, ένα οικόπεδο. Ενας ιδιοκτήτης
  // με ένα Airbnb κι δύο διαμερίσματα σε μακροχρόνια έβγαινε «τρία ακίνητα»,
  // έχανε την εξαίρεση κι χρεωνόταν 0,5% επί των ακαθαρίστων: σε 30.000,00€
  // βραχυχρόνιας, 150,00€ τον χρόνο που δεν οφείλει. Το ίδιο νούμερο έμπαινε
  // στο «πόσα να βάλεις στην άκρη» κι στον φάκελο του λογιστή.
  //
  // Το `Math.max(1, …)` μένει: όσο ο κατάλογος δεν έχει φορτώσει, το ανοιχτό
  // ακίνητο μετράει ως ένα — κι η εξαίρεση ισχύει, που είναι η σωστή στάση
  // απέναντι σε δεδομένα που λείπουν.
  const propCount = Math.max(1, taxpayerProps.filter(p=>readStatus(p as StatusRow)==='rent_short').length)
  // ══════════════════════════════════════════════════════════════════════════
  // ΤΟ ΜΕΡΙΔΙΟ ΤΟΥ ΣΥΝΙΔΙΟΚΤΗΤΗ, ΠΟΥ Η ΚΑΡΤΕΛΑ ΔΕΝ ΡΩΤΟΥΣΕ ΚΑΝ
  //
  // Το ερώτημα προς τη βάση δεν ζητούσε τη στήλη `ownership`. Ο ιδιοκτήτης με
  // 33,33% σε τρία κληρονομημένα διαμερίσματα έβλεπε τα ακαθάριστα, τις
  // δαπάνες, τον φόρο και το «βάλε στην άκρη» ΟΛΟΚΛΗΡΟΥ του ακινήτου, χωρίς
  // καμία γραμμή να το λέει. Μετρημένο: φόρος 8.803€ αντί για 3.835€ και
  // μηνιαία πρόβλεψη 733,58€ αντί για 319,57€.
  //
  // Το Ε2 της ΙΔΙΑΣ εφαρμογής έκοβε σωστά στο μερίδιο (lib/billing/e2.ts:144),
  // οπότε οι δύο οθόνες έδιναν διαφορετική απάντηση στην ίδια ερώτηση.
  //
  // Η προτεραιότητα ανάμεσα σε αυτό και στη ρητή δήλωση κάθε δαπάνης
  // («το πλήρωσε ο ενοικιαστής», «μοιρασμένο 50/50») ζει στο
  // lib/expenses/sharing.ts, μία φορά, με τους ελέγχους της.
  // ══════════════════════════════════════════════════════════════════════════
  const ownPct = useMemo(()=>{ const v = Number(prop?.ownership); return Number.isFinite(v) && v > 0 ? v : 100 },[prop])
  const isCoOwned = ownPct < 100
  /** Το μερίδιό μου σε ποσό που ανήκει ΟΛΟΚΛΗΡΟ στο ακίνητο. */
  const mine = useCallback((amount:number)=>ownerShareOfAmount(amount, ownPct),[ownPct])
  /** Το ποσοστό ΑΛΛΟΥ ακινήτου του χαρτοφυλακίου, για την ενοποίηση. */
  const pctOf = useCallback((pid:string|null|undefined)=>{
    const v = Number(allProps.find(x=>x.id===pid)?.ownership)
    return Number.isFinite(v) && v > 0 ? v : 100
  },[allProps])
  // ═══ ΕΝΑΣ ΕΝΦΙΑ ΓΙΑ ΤΗΝ ΚΑΤΑΣΤΑΣΗ ΚΑΙ ΤΟΝ ΠΙΝΑΚΑ ΤΟΥ ═══════════════════════
  // Η Κατάσταση έβγαζε δική της εκτίμηση από την αξία του ακινήτου και ο πίνακας
  // «Υπολογισμός ΕΝΦΙΑ» λίγο πιο κάτω κρατούσε το περσινό ποσό που έγραψε ο
  // ιδιοκτήτης: 108,78€ και 428,00€ στην ίδια οθόνη, με την πρόβλεψη φόρου να
  // παίρνει το πρώτο. Οι ρυθμίσεις του πίνακα διαβάζονται πλέον ΕΔΩ, μία φορά,
  // και η απάντηση (φετινό, περσινό, εκτίμηση) πηγαίνει και στους δύο.
  //
  // Το καταχωρημένο ποσό της καρτέλας είναι ΗΔΗ του μεριδίου του: έρχεται από
  // το εκκαθαριστικό. Η εκτίμηση παίρνει το μερίδιο μέσα της, όχι απ' έξω,
  // γιατί ο ΕΝΦΙΑ έχει κατώφλια (400.000€, 500.000€, κλιμακωτή μείωση).
  const [enfiaSettings, updateEnfia, enfiaLoading] = useEnfiaSettings(propertyId, userId)
  const enfiaNow = useMemo(()=>enfiaForYear(enfiaSettings, year, {
    stored: prop?.enfia, value: prop?.value, sqm: prop?.sqm,
    yearBuilt: prop?.year_built, floor: prop?.floor, propType: prop?.prop_type,
    ownershipPct: prop?.ownership == null ? null : Number(prop.ownership),
    postalCode: prop?.postal_code,
  }),[enfiaSettings,year,prop])
  const enfia = enfiaNow.inUse.annual
  const enfiaSource = enfiaNow.inUse.source
  const enfiaEstimated = enfiaSource==='estimate'
  const enfiaState:EnfiaState = useMemo(()=>({ settings:enfiaSettings, update:updateEnfia, loading:enfiaLoading, now:enfiaNow }),[enfiaSettings,updateEnfia,enfiaLoading,enfiaNow])
  // Οικόπεδο ή βοηθητικός χώρος χωρίς κανένα ποσό: ο ΕΝΦΙΑ λείπει από τα
  // βιβλία και η οθόνη το λέει, αντί να δείχνει εκτίμηση κατοικίας.
  const enfiaBlock = useMemo(()=>{
    if(enfiaSource!=='none') return null
    const b = enfiaTypeBlock(prop?.prop_type)
    return b ? ENFIA_TYPE_BLOCK_NOTE[b] : null
  },[prop,enfiaSource])

  // Δόσεις, τόκος και κεφάλαιο ΤΗΣ ΗΜΕΡΟΛΟΓΙΑΚΗΣ ΧΡΗΣΗΣ. Ηταν ο αριθμός έτους
  // του δανείου (`year − έτος έναρξης + 1`): δάνειο με έναρξη τον Σεπτέμβριο
  // έγραφε στη χρήση της έναρξης δώδεκα δόσεις και τον τόκο δώδεκα μηνών αντί
  // για τρεις. Σε 150.000€ με 4% ο τόκος έβγαινε 5.935,10€ αντί για 1.497,08€
  // και σε επιχειρηματικό καθεστώς εξέπιπτε ολόκληρος. Ο κανόνας ζει στο
  // lib/loans/progress.ts (`loanCalendarYear`), με τη σύμβαση του `loanProgress`.
  const loanYear = useCallback((l:LoanView)=>loanCalendarYear({ amount:Number(l.amount)||0, annualRatePct:Number(l.rate)||0, years:Number(l.years)||0, startDate:l.start_date }, year), [year])
  // Ενεργό δάνειο στη χρήση Y; Οταν πέφτει μέσα της έστω μία δόση.
  // ΣΕ useCallback ΓΙΑ ΤΟΝ ΙΔΙΟ ΛΟΓΟ ΜΕ ΤΟ tariffKwh: κλείνει πάνω στο `year`,
  // και τέσσερα useMemo το καλούσαν χωρίς να μπορεί ο έλεγχος να το δει. Το
  // `year` ήταν ήδη στις εξαρτήσεις τους, άρα το αποτέλεσμα έβγαινε σωστό —
  // αλλά από σύμπτωση, όχι από κανόνα. Εδώ γίνεται κανόνας.
  const loanActiveInYear = useCallback((l:LoanView)=>loanYear(l).payments>0, [loanYear])

  // Ετήσια στοιχεία τρέχοντος ακινήτου. Φόρος επί ΔΕΔΟΥΛΕΥΜΕΝΟΥ (accrued) ενοικίου
  //, φορολογείται ό,τι οφείλεται, ανεξάρτητα είσπραξης· τα ανείσπρακτα μειώνουν
  // μόνο το ταμείο. (Μακροχρόνια.)
  const rentAccruedYear = useMemo(()=>mine(rent.filter(p=>p.period_year===year).reduce((s,p)=>s+(p.amount||0),0)),[rent,year,mine])
  const rentCollectedYear = useMemo(()=>mine(rent.filter(p=>p.paid&&p.period_year===year).reduce((s,p)=>s+(p.amount||0),0)),[rent,year,mine])
  // Τι λένε τα δεδομένα και τι ισχύει τελικά (η παράκαμψη του χρήστη νικά).
  const collection = useMemo(() => rentCollectionMode(rent, year, leaseViaBank), [rent, year, leaseViaBank])
  // Ο ΤΡΟΠΟΣ ΕΙΣΠΡΑΞΗΣ ΜΕΤΡΑΕΙ ΜΟΝΟ ΑΠΟ ΤΗ ΧΡΗΣΗ 2026. Ο δημόσιος υπολογιστής
  // το φράζει σωστά με το έτος· εδώ περνούσε ωμό για κάθε χρονιά, οπότε μία
  // είσπραξη σε μετρητά μέσα στο 2025 αφαιρούσε την τεκμαρτή έκπτωση 5% που ο
  // νόμος έδινε: σε ενοίκια 20.000,00€ ο φόρος έβγαινε 4.600,00€ αντί για
  // 4.250,00€· το νούμερο έφευγε στον φάκελο του λογιστή ως δικός μας
  // υπολογισμός. Η σύγκριση ζει πλέον στο lib/billing/consolidate.ts.
  const bankMatters = bankReceiptMatters(year)
  const rentsBank = bankMatters ? (rentsBankOverride ?? collection.viaBank) : true
  // ΑΝΕΒΗΚΕ ΠΑΝΩ ΑΠΟ ΤΗ ΒΡΑΧΥΧΡΟΝΙΑ ΣΥΝΟΨΗ, ΓΙΑΤΙ ΤΗ ΧΡΕΙΑΖΕΤΑΙ ΚΙ ΕΚΕΙΝΗ.
  // Το `useMemo` της σύνοψης τρέχει τη στιγμή της απόδοσης, στη σειρά που είναι
  // γραμμένο: με το `rentsBank` δηλωμένο από κάτω, η αναφορά θα έσκαγε σε
  // ReferenceError. Οι εξαρτήσεις του (`rent`, `year`, `leaseViaBank`,
  // `rentsBankOverride`) δηλώνονται όλες πιο πάνω, οπότε η μετακίνηση είναι
  // ασφαλής και δεν αλλάζει καμία τιμή.
  // ΤΟ ΤΕΛΟΣ ΠΑΡΕΠΙΔΗΜΟΥΝΤΩΝ ΡΩΤΑΕΙ ΑΝ ΕΙΣΑΙ ΦΥΣΙΚΟ ΠΡΟΣΩΠΟ. Εδώ περνούσε
  // καρφωμένο «ναι», για κάθε λογαριασμό: το νομικό πρόσωπο με ένα ακίνητο δεν
  // χρεωνόταν καθόλου το δημοτικό τέλος, δηλαδή 150,00€ σε ακαθάριστα
  // 30.000,00€. Η ίδια κρίση γίνεται σωστά δίπλα, στις Αποδόσεις.
  const individualPerson = !(mode==='professional' && elp==='business' && elpForm==='company')
  const shortSummary = useMemo(()=>shortTermYearSummary(stays, year, { sqm: prop?.sqm, isHouse: isHouseType(prop?.prop_type), propertyCount:propCount, individual:individualPerson, rentsPaidViaBank:rentsBank }),[stays,year,prop,propCount,individualPerson,rentsBank])
  const expensesYear = useMemo(()=>expenses.filter(e=>(e.date||'').slice(0,4)===String(year)&&(e.amount||0)>0),[expenses,year])
  // ── Η ΠΡΟΜΗΘΕΙΑ ΤΗΣ ΠΛΑΤΦΟΡΜΑΣ ΕΙΝΑΙ ΔΑΠΑΝΗ, ΚΑΙ ΜΠΑΙΝΕΙ ΣΤΑ ΒΙΒΛΙΑ ──────
  // Καταγραφόταν ανά κράτηση, φαινόταν σε τέσσερις οθόνες ως «δαπάνη που
  // εκπίπτει» και δεν έφτανε ΠΟΤΕ στο ημερολόγιο, στο ισοζύγιο ή στον φάκελο
  // του λογιστή. Ο κανόνας και η αιτιολογία ζουν στο lib/tax/shortTermTax.ts.
  //
  // ΔΕΝ ΔΙΠΛΟΓΡΑΦΕΤΑΙ, ΑΛΛΑ ΔΕΝ ΣΒΗΝΕΙ ΚΑΙ ΟΛΗ ΤΗ ΧΡΟΝΙΑ. Όταν ο χρήστης έχει
  // καταχωρήσει προμήθεια ως δαπάνη — γιατί η πλατφόρμα του έστειλε τιμολόγιο
  // και το πέρασε — η δική του καταχώρηση υπερισχύει: το παραστατικό είναι πιο
  // βαρύ από τον υπολογισμό μας.
  //
  // ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΕΚΛΕΙΣΕ ΕΔΩ. Ο κανόνας εφαρμοζόταν «όλα ή τίποτα» για ΟΛΗ τη
  // χρήση: ΜΙΑ απόδειξη 24€ μηδένιζε τις υπολογισμένες προμήθειες και των
  // υπόλοιπων έντεκα κρατήσεων. Μετρημένο σε χαρτοφυλάκιο δώδεκα κρατήσεων
  // Airbnb: εκπεστέες δαπάνες 24,00€ αντί για 288,00€, δηλαδή 264,00€ χαμένη
  // έκπτωση και 39,60€ επιπλέον φόρος με τον χαμηλότερο συντελεστή. Και ήταν
  // αόρατο: ο χρήστης έκανε το σωστό, πέρασε το τιμολόγιο και τιμωρήθηκε.
  //
  // Το τιμολόγιο πλατφόρμας καλύπτει ΠΕΡΙΟΔΟ, τυπικά μήνα, όχι μία κράτηση —
  // και μια αντιστοίχιση ανά κράτηση δεν είναι δυνατή με τα δεδομένα που έχουμε.
  // Ο κανόνας εφαρμόζεται λοιπόν ανά ΜΗΝΑ: όποιος μήνας έχει δική του απόδειξη
  // δεν παράγει τίποτα, οι υπόλοιποι μένουν ακέραιοι.
  // Ο κανόνας ήταν γραμμένος εδώ κι ΞΑΝΑ, αλλιώς, στο ημερολόγιο: εκεί ρωτούσε
  // ναι/όχι για όλη τη χρονιά κι μία καταχωρημένη προμήθεια έκοβε τις άλλες
  // πενήντα εννέα. Ζει πλέον στο lib/tax/shortTermTax.ts, μία φορά.
  const ownFeeMonths = useMemo(()=>monthsWithOwnPlatformFee(expensesYear),[expensesYear])
  const platformFeeRows = useMemo(()=>derivedPlatformFees(stays,year,ownFeeMonths),[ownFeeMonths,stays,year])
  const platformFeesYear = useMemo(()=>platformFeeRows.reduce((s,r)=>s+r.amount,0),[platformFeeRows])
  // ── ΟΙ ΛΟΓΑΡΙΑΣΜΟΙ ΠΟΥ ΔΕΝ ΕΓΙΝΑΝ ΔΑΠΑΝΗ ΜΕΤΡΑΝΕ ΚΙ ΑΥΤΟΙ ────────────────
  // Ο ίδιος κανόνας με την Τιμολόγηση, τις Δαπάνες και τον Προϋπολογισμό
  // (lib/expenses/ledger.ts): κάθε ευρώ μία φορά. Οι δαπάνες μένουν με τις
  // δικές τους στήλες (ομάδα, μερίδιο)· από τους λογαριασμούς έρχεται μόνο ό,τι
  // δεν έχει ήδη γίνει δαπάνη. Ο λογαριασμός ανήκει ολόκληρος στο ακίνητο, άρα
  // κόβεται στο μερίδιο όπως το ενοίκιο και ο ΕΝΦΙΑ.
  // Λογαριασμός ΕΝΦΙΑ δεν μπαίνει εδώ: ο ΕΝΦΙΑ έχει δική του γραμμή.
  const billsYear = useMemo(()=>billsWithoutExpense(bills, expenses as LedgerExpense[]).filter(e=>e.date.slice(0,4)===String(year)&&e.amount>0&&resolveCategory(e.category)!=='enfia'),[bills,expenses,year])
  const billsTotal = useMemo(()=>mine(billsYear.reduce((s,e)=>s+e.amount,0)),[billsYear,mine])
  const billsDeductible = useMemo(()=>mine(billsYear.filter(e=>isDeductible(e.category)).reduce((s,e)=>s+e.amount,0)),[billsYear,mine])
  // Εξαιρούμε τον ΕΝΦΙΑ ως δαπάνη, τον μετράμε ξεχωριστά (αποφυγή διπλομέτρησης).
  const expensesTotal = useMemo(()=>expensesYear.filter(e=>e.category!=='ΕΝΦΙΑ').reduce((s,e)=>s+ownerShareOf(e,ownPct),0)+mine(platformFeesYear)+billsTotal,[expensesYear,platformFeesYear,ownPct,mine,billsTotal])
  const deductibleTotal = useMemo(()=>expensesYear.filter(e=>isGroupDeductible(e.expense_group)&&e.category!=='ΕΝΦΙΑ').reduce((s,e)=>s+ownerShareOf(e,ownPct),0)+mine(platformFeesYear)+billsDeductible,[expensesYear,platformFeesYear,ownPct,mine,billsDeductible])
  // Δόσεις δανείων ΜΟΝΟ όσο το δάνειο είναι ενεργό στη χρήση (όχι φαντάσματα).
  const loanAnnual = useMemo(()=>loans.reduce((s,l)=>s+loanYear(l).paid,0),[loans,loanYear])
  const loanInterestYear = useMemo(()=>loans.reduce((s,l)=>s+loanYear(l).interest,0),[loans,loanYear])

  const businessMode = mode==='professional' && elp==='business'

  // ── ΤΟ ΜΗΤΡΩΟ ΠΑΓΙΩΝ, ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ ΑΥΤΟ ΠΟΥ ΔΙΝΕΙ ΤΗΝ ΑΠΟΣΒΕΣΗ ──────────
  // Η απόσβεση κτιρίου υπολογιζόταν εδώ με μια γραμμή: αξία × 60% × 4%, ίδια
  // κάθε χρόνο, από την πρώτη μέρα ως το άπειρο. Δύο λάθη μέσα σε μία γραμμή:
  // η πρώτη χρήση αποσβένεται ΚΑΤΑ ΜΗΝΑ (άρθρο 24 §2) και μετά την πλήρη
  // απόσβεση δεν υπάρχει άλλη απόσβεση — το κτίσμα δεν αποσβένεται για πάντα.
  // Και η βάση ήταν η ΕΚΤΙΜΗΣΗ αξίας, που αλλάζει κάθε χρόνο, αντί για την
  // τιμή κτήσης, που δεν αλλάζει ποτέ. Πλέον υπάρχει ένα μητρώο και η
  // απόσβεση της χρονιάς βγαίνει από εκεί — το ίδιο νούμερο στην οθόνη, στο
  // Excel και στον φάκελο.
  const capitalisableAccounts = useMemo(()=>Object.fromEntries(
    CAPITALISABLE.map(slug=>[
      CATEGORIES.find(c=>c.slug===slug)?.label || slug,
      slug==='renovation' ? RENTED_PROPERTY_ACCOUNT : EQUIPMENT_ACCOUNT,
    ])),[])
  const assets = useMemo(()=>buildRegister({
    property: prop ? {
      name: prop.name,
      purchasePrice: prop.purchase_price,
      purchaseDate: prop.purchase_date,
      rented: prop.rental_mode!=='own_use',
    } : null,
    buildingFraction: BUILDING_VALUE_FRACTION,
    buildingRate: BUILDING_DEPRECIATION_RATE,
    equipmentRate: EQUIPMENT_DEPRECIATION_RATE,
    inventory,
    // ΟΛΟΚΛΗΡΟ ΤΟ ΚΑΘΟΛΙΚΟ, ΟΧΙ Η ΧΡΗΣΗ. Εδώ περνούσε το `expensesYear`, οπότε
    // ανακαίνιση του 2025 δεν υπήρχε στο μητρώο του 2026 και οι υπόλοιπες
    // εικοσιτέσσερις δόσεις απόσβεσής της χάνονταν για πάντα. Το `year` κόβει
    // ό,τι αποκτήθηκε αργότερα, ώστε το μητρώο να μένει φωτογραφία της 31/12.
    expenses,
    capitalisable: capitalisableAccounts,
    year,
  }),[prop,inventory,expenses,capitalisableAccounts,year])
  // Μόνο η ΑΚΙΝΗΤΗ περιουσία αποσβένεται με δηλωμένο συντελεστή· ο εξοπλισμός
  // περιμένει τον συντελεστή του λογιστή και δίνει μηδέν ως τότε.
  const buildingDepr = useMemo(()=>
    Math.round(assets.filter(a=>a.elp!==EQUIPMENT_ACCOUNT).reduce((s,a)=>s+chargeForYear(a,year),0)),[assets,year])
  // ══ Η ΑΠΟΣΒΕΣΗ ΕΞΟΠΛΙΣΜΟΥ ΗΤΑΝ ΕΚΤΙΜΗΣΗ ΠΡΟΪΟΝΤΟΣ, ΚΑΙ ΕΚΠΙΠΤΟΤΑΝ ΩΣ ΦΟΡΟΣ ══
  //
  // Υπολογιζόταν εδώ με το `usefulLifeYears` — «τυπική διάρκεια ζωής» ανά
  // κατηγορία, που το ίδιο του το αρχείο (lib/inventory/depreciation.ts)
  // δηλώνει ρητά ότι ΔΕΝ είναι φορολογική απόσβεση και ότι δεν πρέπει να μπει
  // σε δήλωση. Το νούμερο όμως περνούσε αυτούσιο στην κατάσταση αποτελεσμάτων
  // και μείωνε τη φορολογητέα βάση: ένα πλυντήριο 650€ «αποσβενόταν» σε εννιά
  // χρόνια (11,1%) αντί για τα δέκα του νόμου και ένα έπιπλο σε δώδεκα (8,3%).
  //
  // Ο πίνακας του άρθρου 24 §4 δίνει τον σωστό συντελεστή για όλα: «λοιπά πάγια
  // στοιχεία της επιχείρησης», 10%. Το νούμερο βγαίνει πλέον από το ΜΗΤΡΩΟ, με
  // την έναρξη από τον επόμενο μήνα και με στάση όταν το πάγιο αποσβεστεί —
  // δηλαδή από την ίδια πηγή που βλέπει ο λογιστής στο Excel του.
  //
  // Η ΕΚΤΙΜΗΣΗ ΔΕΝ ΚΑΤΑΡΓΕΙΤΑΙ, ΑΛΛΑΖΕΙ ΘΕΣΗ. Η Απογραφή εξακολουθεί να δείχνει
  // υπολειπόμενη αξία και προτάσεις αντικατάστασης με τη διάρκεια ζωής: εκεί το
  // ερώτημα είναι «πόσο αξίζει σήμερα», που δεν το απαντά ο φορολογικός πίνακας.
  const inventoryDepr = useMemo(()=>
    Math.round(assets.filter(a=>a.elp===EQUIPMENT_ACCOUNT).reduce((s,a)=>s+chargeForYear(a,year),0)),[assets,year])
  const grossIncome = regime==='individual_shortterm' ? mine(shortSummary.grossRevenue) : rentAccruedYear
  // ══ ΤΟ ΜΕΡΙΔΙΟ ΕΠΙΑΝΕ ΤΑ ΕΣΟΔΑ ΚΙ ΑΦΗΝΕ ΤΑ ΤΕΛΗ ΟΛΟΚΛΗΡΑ ═══════════════════
  // Τα ακαθάριστα από πάνω περνούν από τη `mine()`, δηλαδή κόβονται στο ποσοστό
  // ιδιοκτησίας — κι το ίδιο κάνει κι ο ΕΝΦΙΑ. Το ΤΑΚΚ κι το τέλος
  // παρεπιδημούντων περνούσαν ΟΛΟΚΛΗΡΑ. Ο συνιδιοκτήτης στο ένα τρίτο έβλεπε
  // έσοδα του ενός τρίτου κι τέλη ολόκληρου του ακινήτου: το «καθαρό» κι το
  // «πόσα να βάλεις στην άκρη» έβγαιναν λάθος προς τα κάτω.
  //
  // Το δημοτικό τέλος το δείχνει μόνο του: είναι 0,5% ΕΠΙ ΤΩΝ ΑΚΑΘΑΡΙΣΤΩΝ.
  // Υπολογισμένο στο 100% κι τοποθετημένο δίπλα σε έσοδα 33% δεν είναι πια
  // μισό τοις εκατό τίποτα.
  //
  // Ο κανόνας είναι ο ίδιος του `lib/expenses/sharing.ts`: ποσό που ανήκει
  // ΟΛΟΚΛΗΡΟ στο ακίνητο —ενοίκιο, ΕΝΦΙΑ, τέλη— κόβεται στο μερίδιο.
  const shortLevy = regime==='individual_shortterm' ? mine(shortSummary.levyShortfall) : 0
  const shortMunicipal = regime==='individual_shortterm' ? mine(shortSummary.municipalTax) : 0
  const uncollectedRent = regime==='individual_shortterm' ? 0 : Math.max(0, rentAccruedYear - rentCollectedYear)

  // Ενοποίηση χαρτοφυλακίου (φυσικό πρόσωπο): ο φόρος είναι προοδευτικός στο ΣΥΝΟΛΟ
  // των ενοικίων (Ε1), όχι ανά ακίνητο. Υπολογίζεται ΠΑΝΤΑ, ώστε ο φόρος του τρέχοντος
  // ακινήτου να είναι το ΜΕΡΙΔΙΟ του από τον συνολικό, σωστά και για πολλά ακίνητα.
  const consolidation = useMemo(()=>{
    const items = (taxpayerProps.length?taxpayerProps:[{id:propertyId,name:prop?.name,rental_mode:prop?.rental_mode,enfia:prop?.enfia,sqm:prop?.sqm,prop_type:prop?.prop_type}]).map(p=>{
      const rmode:TaxRegime = readStatus(p as StatusRow) === 'rent_short' ? 'individual_shortterm' : 'individual_longterm'
      const pRentAccrued = allRent.filter(r=>r.property_id===p.id&&r.period_year===year).reduce((s,r)=>s+(r.amount||0),0)
      // ══ Ο ΦΟΡΟΣ ΑΓΝΟΟΥΣΕ ΤΗΝ ΑΠΑΛΛΑΓΗ ΠΟΥ Η ΙΔΙΑ ΚΑΡΤΑ ΕΔΕΙΧΝΕ ══════════════
      // Το `incomeStatement` κατεβάζει το ΦΟΡΟΛΟΓΗΤΕΟ κατά τα διεκδικημένα
      // ανείσπρακτα, αλλά ο ΦΟΡΟΣ δεν βγαίνει από εκεί: για φυσικό πρόσωπο
      // υπερισχύει το `overrideIncomeTax`, δηλαδή το μερίδιο του προοδευτικού
      // φόρου του χαρτοφυλακίου — κι η ενοποίηση δεν είχε ακούσει ποτέ για την
      // απαλλαγή. Η κάρτα έγραφε «φόρος 3.550€ σε φορολογητέο 7.600€», δηλαδή
      // 46,7% εκεί που ο ανώτατος συντελεστής της κλίμακας είναι 45%.
      // Το αδύνατο ποσοστό ήταν το μόνο ορατό ίχνος.
      const pUncollected = allRent.filter(r=>r.property_id===p.id&&r.period_year===year&&!r.paid).reduce((s,r)=>s+(r.amount||0),0)
      // Μόνο για ΤΟ ακίνητο του τσεκ: η απαλλαγή είναι ανά μίσθωση.
      const pRelief = claimedUncollected && p.id===propertyId ? pUncollected : 0
      // ══ Ο ΤΡΟΠΟΣ ΕΙΣΠΡΑΞΗΣ ΕΙΝΑΙ ΤΟΥ ΑΚΙΝΗΤΟΥ, ΟΧΙ ΤΗΣ ΑΝΟΙΧΤΗΣ ΚΑΡΤΕΛΑΣ ══
      // Εδώ περνούσε το `rentsBank` του ΤΡΕΧΟΝΤΟΣ ακινήτου σε ΟΛΑ. Ακίνητο που
      // εισπράττεται σε μετρητά έπαιρνε την τεκμαρτή έκπτωση 5% επειδή ήταν
      // ανοιχτή η καρτέλα ενός άλλου — κι ο συνολικός φόρος άλλαζε ανάλογα με
      // το ποια καρτέλα κοιτούσε ο χρήστης. Ο κανόνας ζει στο lib/tax.
      const pViaBank = !bankMatters || p.id === propertyId ? rentsBank
        : collectionViaBankOf(allRent.filter(r=>r.property_id===p.id), year, rentsBank)
      const pStays = allStays.filter(s=>s.property_id===p.id)
      const pShort = shortTermYearSummary(pStays, year, { sqm:p.sqm??null, isHouse: isHouseType(p.prop_type), propertyCount:propCount, individual:individualPerson, rentsPaidViaBank:pViaBank })
      // Κάθε ακίνητο με ΤΟ ΔΙΚΟ ΤΟΥ ποσοστό: ένα χαρτοφυλάκιο μπορεί να έχει
      // δύο κληρονομιές στο ένα τρίτο και ένα διαμέρισμα ολόκληρο.
      const pPct = pctOf(p.id)
      const gross = ownerShareOfAmount(rmode==='individual_shortterm' ? pShort.grossRevenue : Math.max(0, pRentAccrued - pRelief), pPct)
      // Για το ανοιχτό ακίνητο, ο ΕΝΦΙΑ της Κατάστασης: αλλιώς η ενοποίηση θα
      // μετρούσε άλλο ποσό από τη γραμμή που βλέπει ο χρήστης δίπλα της.
      const pEnfia = p.id===propertyId ? enfia : ownerShareOfAmount(resolveEnfia({ propertyEnfia:p.enfia }).annual, pPct)
      const input:StatementInput = { regime:rmode, grossIncome:gross, enfia: pEnfia, presumptiveRate: presumptiveDeductionRateForYear(year, pViaBank, rmode==='individual_shortterm' ? pShort.nightsByMonth : rentByMonth(allRent.filter(r=>r.property_id===p.id), year)),
        // Ο ίδιος κανόνας του μεριδίου με τα ακαθάριστα κι τον ΕΝΦΙΑ από πάνω:
        // τέλος υπολογισμένο στο 100% δίπλα σε έσοδα 33% δεν ισοσκελίζει.
        climateLevy: rmode==='individual_shortterm'?ownerShareOfAmount(pShort.levyShortfall, pPct):0,
        municipalTax: rmode==='individual_shortterm'?ownerShareOfAmount(pShort.municipalTax, pPct):0 }
      return { id:p.id, name:p.name||'Ακίνητο', input }
    }).filter(x=>x.input.grossIncome>0)
    if(items.length===0) return null
    return { con: consolidateIndividual(items.map(i=>({id:i.id,input:i.input})), rentalBracketsForYear(year)), names:Object.fromEntries(items.map(i=>[i.id,i.name])), count:items.length }
  },[taxpayerProps,allRent,allStays,year,propCount,prop,propertyId,rentsBank,bankMatters,pctOf,individualPerson,claimedUncollected,enfia])
  const myTaxShare = useMemo(()=>consolidation?.con.perProperty.find(p=>p.id===propertyId)?.taxShare,[consolidation,propertyId])
  const portfolio = (mode==='professional' && elp==='personal') ? consolidation : null

  // Το τεκμαρτό ελάχιστο του ΕΤΟΥΣ, μαζί με τη χρονιά από την οποία προέρχεται
  // το ποσό: για χρήση που δεν έχει ακόμη ανακοινωθεί κατώτατος μισθός, ισχύει
  // το τελευταίο γνωστό και η οθόνη το λέει αντί να το περνά για βεβαιότητα.
  const minNetIncome = useMemo(()=>selfEmployedMinNetIncome(year), [year]);

  // Η ΚΛΙΜΑΚΑ ΠΟΥ ΔΕΙΧΝΕΙ Η ΟΘΟΝΗ ΕΙΝΑΙ Η ΚΛΙΜΑΚΑ ΠΟΥ ΥΠΟΛΟΓΙΖΕΙ. Το ίδιο
  // `year` που τροφοδοτεί τα κλιμάκια του υπολογισμού τροφοδοτεί και τον πίνακα.
  const taxRows = useMemo(()=>businessMode ? BUSINESS_INCOME_ROWS_2026 : rentalRowsForYear(year), [businessMode, year]);

  const statement:IncomeStatement = useMemo(()=>incomeStatement(
    businessMode
      ? { regime:'business', grossIncome, businessForm:elpForm, taxpayerAge: age||undefined,
          firstThreeYears: firstYears, companyDistribution: elpForm==='company'&&distribution!=='' ? Number(distribution)/100 : 0,
          // Για επιχείρηση ο ΕΝΦΙΑ ΕΚΠΙΠΤΕΙ → τον περνάμε στα εκπιπτόμενα, όχι ως μη-εκπεστέο τέλος.
          itemizedExpenses:deductibleTotal+enfia, depreciation:inventoryDepr, buildingDepreciation:buildingDepr, loanInterest:loanInterestYear,
          ekfaContributions: elpForm==='sole'&&ekfa!=='' ? Number(ekfa) : 0,
          // ΤΟ ΤΕΚΜΑΡΤΟ ΕΛΑΧΙΣΤΟ ΕΙΝΑΙ ΠΟΣΟ ΤΟΥ ΕΤΟΥΣ: ακολουθεί τον κατώτατο
          // μισθό. Περνιόταν καρφωμένο στο ποσό του 2025 ό,τι έτος κι αν είχε
          // διαλέξει ο χρήστης — 700€ φανταστικό εισόδημα στη χρήση 2024.
          presumptiveMinIncome: elpForm==='sole'&&grossIncome>0 ? Math.round(minNetIncome.amount*(firstYears?0.5:1)) : undefined, enfia:0,
          climateLevy: shortLevy, municipalTax: shortMunicipal,
          otherCashExpenses: Math.max(0,expensesTotal-deductibleTotal), loanPrincipal: Math.max(0,loanAnnual-loanInterestYear), uncollectedIncome:uncollectedRent, brackets: rentalBracketsForYear(year) }
      : { regime, grossIncome, enfia, enfiaBasis: enfiaSource==='none' ? undefined : enfiaSource, overrideIncomeTax: myTaxShare, presumptiveRate: presumptiveDeductionRateForYear(year, rentsBank, regime==='individual_shortterm' ? shortSummary.nightsByMonth : rentByMonth(rent, year)),
        // ΤΟ ΤΕΛΟΣ ΑΝΘΕΚΤΙΚΟΤΗΤΑΣ ΕΦΕΥΓΕ ΔΥΟ ΦΟΡΕΣ ΑΠΟ ΤΟ ΤΑΜΕΙΟ.
        // Το `grossIncome` εδώ είναι το `grossRevenue` της shortTermYearSummary,
        // που έχει ΗΔΗ αφαιρέσει το εισπραγμένο τέλος (gross_guest_paid −
        // collectedLevy). Περνώντας και το ΣΥΝΟΛΙΚΟ `levy` ως έξοδο, το
        // incomeStatement το έβγαζε δεύτερη φορά. Σε γεμάτη σεζόν 200 νυχτών
        // υψηλής περιόδου η τρύπα φτάνει 3.000€ — και το ίδιο νούμερο πήγαινε
        // στο «πόσα να βάλεις στην άκρη για φόρο» και στο Excel του λογιστή.
        // Το `levyShortfall` είναι ό,τι ΟΦΕΙΛΕΤΑΙ και δεν εισπράχθηκε: μηδέν
        // όταν ο επισκέπτης το πλήρωσε κανονικά. Ο ίδιος κανόνας που εφαρμόζει
        // ήδη μέσα του το lib/tax/shortTermTax.ts.
          climateLevy: shortLevy, municipalTax: shortMunicipal,
          otherCashExpenses: expensesTotal, loanPrincipal: loanAnnual, uncollectedIncome:uncollectedRent,
          legallyClaimedUncollected: claimedUncollected, brackets: rentalBracketsForYear(year) }
  ),[businessMode,year,elpForm,age,firstYears,distribution,ekfa,buildingDepr,claimedUncollected,rentsBank,rent,shortSummary,regime,grossIncome,enfia,enfiaSource,myTaxShare,expensesTotal,deductibleTotal,inventoryDepr,loanInterestYear,loanAnnual,uncollectedRent,shortLevy,shortMunicipal,minNetIncome.amount])

  // Συμβουλευτική, προτάσεις με αξία από τα πραγματικά δεδομένα (καθαρές, όχι θόρυβος).
  const advisory = useMemo(()=>buildAdvisory({
    regime: businessMode?'business':regime, businessForm: businessMode?elpForm:undefined, age: age||null,
    grossIncome, taxableIncome: statement.taxableIncome,
    rentalMode: prop?.rental_mode, propertyCount: propCount,
    hasLoan: loans.some(l=>loanActiveInYear(l)), loanInterestYear,
  }),[businessMode,regime,elpForm,age,grossIncome,statement,prop,propCount,loans,loanInterestYear,loanActiveInYear])

  // «Τι άλλαξε»: επίκαιροι κανόνες 2026 σχετικοί με το προφίλ (καθεστώς + δάνειο).
  const relevantChanges = useMemo(()=>{
    const aud = new Set<UpdateAudience>(['all'])
    if(businessMode) aud.add('business')
    else if(regime==='individual_shortterm') aud.add('short_term')
    else aud.add('long_term')
    if(loans.some(l=>loanActiveInYear(l))) aud.add('borrower')
    return REGULATORY_UPDATES_2026.filter(u=>u.audiences.some(a=>aud.has(a)))
  },[businessMode,regime,loans,loanActiveInYear])

  // Κόστος μεταβίβασης: προεπιλογή τιμήματος η αξία του ακινήτου (αν υπάρχει).
  const xferEffectivePrice = xferPrice!=='' ? Number(xferPrice) : (Number(prop?.value)||0)
  const xfer = useMemo(()=>transferCosts({ side:xferSide, price:xferEffectivePrice, firstHome:xferFirstHome, useAgent:xferAgent, acquisitionCost:xferSide==='sell'?(Number(prop?.value)||0):0 }),[xferSide,xferEffectivePrice,xferFirstHome,xferAgent,prop])

  // Πρόβλεψη: για τρέχον έτος με βάση τον τρέχοντα μήνα· για κλεισμένο/μελλοντικό, ισόποσα στους 12.
  const provMonth = year===athensYear() ? athensNow().getMonth()+1 : 1
  const provision = useMemo(()=>taxProvision(statement, provMonth),[statement,provMonth])

  // Ενοποιημένο καθολικό & ταμειακές ροές (όπως πριν, αλλά με τη νέα μηχανή για φόρο)
  const entries = useMemo<LedgerInput[]>(()=>{
    const out:LedgerInput[]=[]
    for(const p of rent){ if(p.paid&&(p.amount||0)>0){ out.push({ date:rentStore.bookDate(p), type:'income', category:'Ενοίκιο', description:`Ενοίκιο ${MONTHS_SHORT[(p.period_month||1)-1]} ${p.period_year}`, amount:p.amount, source:'rent' }) } }
    // ═══ Η ΠΡΟΜΗΘΕΙΑ ΑΦΑΙΡΟΥΝΤΑΝ ΔΥΟ ΦΟΡΕΣ ═══════════════════════════════
    // Το `total` μιας διαμονής ΔΕΝ είναι πάντα το ακαθάριστο: όταν το
    // `amount_basis` είναι «payout», είναι ΗΔΗ καθαρό από την προμήθεια της
    // πλατφόρμας. Εδώ γραφόταν αυτούσιο ως έσοδο και τρεις γραμμές πιο κάτω
    // η ΙΔΙΑ προμήθεια ξαναμπαίνει ως δαπάνη. Δηλαδή αφαιρούνταν δύο φορές,
    // ακριβώς στις κρατήσεις που έχουν ανάλυση, δηλαδή στις εισαγόμενες από
    // πλατφόρμα.
    //
    // Το lib/clients/stayAmounts.ts το γράφει ρητά στην κεφαλίδα του: «η
    // προμήθεια αφαιρείται ΜΕΤΑ το ακαθάριστο επίτηδες, εκπίπτει ως δαπάνη,
    // δεν μειώνει το δηλωτέο έσοδο». Και η σωστή γραφή υπήρχε ήδη είκοσι
    // αρχεία δίπλα, στο JournalExport.
    //
    // ΠΟΥ ΕΦΤΑΝΕ ΤΟ ΛΑΘΟΣ: στις «Κινήσεις», στο ταμειακό γράφημα και μέσω του
    // `book` στο ΠΡΩΤΟ ΦΥΛΛΟ του φακέλου του λογιστή («ΣΥΝΟΛΑ ΕΤΟΥΣ»), όπου
    // διαφωνούσε με την «Κατάσταση αποτελεσμάτων» του διπλανού φύλλου κατά
    // ολόκληρη την προμήθεια. Ενα βιβλίο που αντιφάσκει με τον εαυτό του στο
    // εξώφυλλο δεν διορθώνεται από τον λογιστή: απορρίπτεται.
    for(const s of stays){ const g=declarableGrossOrTotal(s); if(g>0&&s.check_in){ out.push({ date:s.check_in, type:'income', category:'Βραχυχρόνια', description:`Κράτηση ${s.channel||''}`.trim(), amount:g, source:'stay' }) } }
    for(const e of expenses){ if((e.amount||0)>0&&e.date){ out.push({ date:e.date, type:'expense', category:e.category||'Δαπάνες', description:e.description||'Δαπάνη', amount:e.amount, source:'expense', supplier_country:e.supplier_country, supply:e.supply, supplier_afm:e.supplier_afm }) } }
    // Η προμήθεια της κάθε κράτησης, δίπλα στο έσοδο της ίδιας κράτησης.
    for(const f of platformFeeRows){ out.push({ date:f.date, type:'expense', category:f.category, description:f.description, amount:f.amount, source:'expense' }) }
    return out
  },[rent,stays,expenses,platformFeeRows])
  const yearEntries = useMemo(()=>entries.filter(e=>e.date.slice(0,4)===String(year)),[entries,year])
  const cash = useMemo(()=>cashflowByYear(entries,year),[entries,year])
  const book = useMemo(()=>buildLedger(yearEntries),[yearEntries])
  const recentLedger = useMemo(()=>[...book].slice(-12).reverse(),[book])

  // Ισοζύγιο διπλογραφικής (trial balance) — για τον λογιστή. Ταμειακή βάση:
  // εισπραγμένα ενοίκια/κρατήσεις → έσοδα, πληρωμένα έξοδα, δόσεις δανείου
  // διαχωρισμένες σε τόκους (65.01) και χρεολύσιο (52). Κάθε άρθρο ισοσκελισμένο.
  const journalLines = useMemo(()=>{
    const incomes:IncomeRec[] = []
    // ΤΑΜΕΙΑΚΗ ΕΠΙΛΟΓΗ, ΟΠΩΣ ΚΑΙ ΟΙ ΚΙΝΗΣΕΙΣ. Ο κανόνας ζει στο lib/data/rent.ts.
    for(const p of rentStore.collectedIn(rent, year)){ incomes.push({ date:rentStore.bookDate(p), amount:p.amount||0, description:`Ενοίκιο ${MONTHS_SHORT[(p.period_month||1)-1]} ${p.period_year}` }) }
    // Δηλωτέο ακαθάριστο, όχι payout: η προμήθεια μπαίνει χωριστά ως δαπάνη
    // τρεις γραμμές πιο κάτω και δεν επιτρέπεται να αφαιρεθεί και από τα δύο.
    for(const s of stays){ const g=declarableGrossOrTotal(s); if(g>0&&s.check_in&&String(s.check_in).slice(0,4)===String(year)){ incomes.push({ date:s.check_in, amount:g, description:`Κράτηση ${s.channel||''}`.trim() }) } }
    const exp:ExpenseRec[] = []
    for(const e of expenses){ if((e.amount||0)>0&&e.date&&String(e.date).slice(0,4)===String(year)){ exp.push({ date:e.date, amount:e.amount, category:e.category, description:e.description }) } }
    for(const f of platformFeeRows){ exp.push({ date:f.date, amount:f.amount, category:f.category, description:f.description }) }
    const loanPayments:LoanPaymentRec[] = []
    for(const l of loans){ const ly=loanYear(l); const annual=Math.round(ly.paid); const interest=Math.round(ly.interest); if(annual>0) loanPayments.push({ date:`${year}-06-30`, amount:annual, interest, description:`Δόσεις δανείου${l.bank?` · ${l.bank}`:''}` }) }
    return buildJournal({ incomes, expenses:exp, loanPayments })
  },[rent,stays,expenses,loans,year,loanYear,platformFeeRows])
  const trial = useMemo(()=>trialBalance(journalLines),[journalLines])
  const jTotals = useMemo(()=>journalTotals(journalLines),[journalLines])

  const recon = useMemo(()=>{
    const yr = rent.filter(p=>p.period_year===year)
    const expected:Expected[] = yr.map(p=>({ id:`${p.period_year}-${p.period_month}`, date:p.due_date||`${p.period_year}-${String(p.period_month).padStart(2,'0')}-01`, amount:p.amount||0, label:`${MONTHS_SHORT[(p.period_month||1)-1]} ${p.period_year}` }))
    const actual:Actual[] = yr.filter(p=>p.paid).map(p=>({ refId:`${p.period_year}-${p.period_month}`, date:p.paid_date||'', amount:p.amount||0, paid:true }))
    return reconcile(expected, actual, todayAthens())
  },[rent,year])
  const rs = useMemo(()=>reconSummary(recon),[recon])

  const maxCash = Math.max(1, ...cash.map(c=>Math.max(c.income,c.expense)))

  // ── Ο ΦΑΚΕΛΟΣ ΓΙΑ ΤΟΝ ΛΟΓΙΣΤΗ ─────────────────────────────────────────────
  // Η κατάσταση κάθε ακινήτου (εκμίσθωση, κενό, ιδιοχρησία…) ορίζει ΤΙ ζητάει ο
  // λογιστής. Ο κανόνας ζει μία φορά, στο lib/accounting/dossier.ts· εδώ απλώς
  // του δίνουμε τα δεδομένα και δείχνουμε την απάντησή του.
  const dossierProps = useMemo(()=>{
    const rows:{ name?:string|null; status_detail?:string|null; rental_mode?:string|null }[] = allProps.length ? allProps : (prop?[prop]:[])
    return rows.map(p=>({ name: p.name || 'Ακίνητο', status: readStatus(p) as PropertyStatus }))
  },[allProps,prop])
  // Αφετηρία, μόνο για χρήστη που δεν έχει δηλώσει ακόμη τίποτα: ό,τι ήδη ξέρουμε.
  // Η μορφή έρχεται από τη δήλωση της υποδοχής, όχι από τη δυαδική περίληψη:
  // μια ΟΕ δεν είναι ΑΕ και τα βιβλία τους διαφέρουν.
  const dossierSeed = useMemo(()=>{
    const form:LegalForm = businessMode ? (legalForm==='individual' ? 'sole_trader' : legalForm) : 'individual'
    return { form, books: defaultBookkeeping(form), hasLoan: loans.length>0 }
  },[businessMode,legalForm,loans])
  const dossier = useAccountantDossier(userId, year, dossierSeed)
  // Τα βιβλία κρίνουν ποιος βλέπει ισοζύγιο/ισολογισμό — ποτέ φυσικό πρόσωπο.
  const doubleEntry = dossier.profile.books==='double_entry'

  // «Τι δεν βρέθηκε»: ό,τι λείπει από τα ΔΕΔΟΜΕΝΑ (όχι από τα χαρτιά) και θα
  // αναγκάσει τον λογιστή να σηκώσει τηλέφωνο. Γράφεται μέσα στο 05_ΤΙ_ΛΕΙΠΕΙ.
  const dossierGaps = useMemo(()=>{
    const g:string[] = []
    const rentRows = rent.filter(p=>p.period_year===year)
    if(regime==='individual_shortterm'){
      if(stays.filter(s=>String(s.check_in||'').slice(0,4)===String(year)).length===0) g.push(`Καμία καταχωρημένη διαμονή για το ${year}.`)
    } else if(rentRows.length===0){ g.push(`Κανένα καταχωρημένο μίσθωμα για το ${year}.`) }
    // Η προμήθεια δεν μαντεύεται. Κράτηση Airbnb ή Booking.com έχει πάντα
    // προμήθεια· όταν λείπει, λείπει δαπάνη από τα βιβλία και το λέμε.
    // ΤΟ «ΕΚΠΙΠΤΕΙ» ΕΙΝΑΙ ΜΟΝΟ ΤΗΣ ΕΠΙΧΕΙΡΗΣΗΣ. Ο ιδιώτης δεν εκπίπτει καμία
    // δαπάνη αναλυτικά (άρθρο 39 ΚΦΕ, μόνο η τεκμαρτή έκπτωση): εκεί η προμήθεια
    // λείπει από το ταμείο, όχι από τη φορολογική βάση.
    const noFee = staysMissingPlatformFee(stays, year)
    if(noFee>0) g.push(`${noFee} κρατήσεις από πλατφόρμα χωρίς καταγεγραμμένη προμήθεια: ${businessMode ? 'λείπει δαπάνη που εκπίπτει' : 'λείπει έξοδο από το ταμείο, που για ιδιώτη δεν μειώνει τον φόρο'}.`)
    // Η σημείωση λέει πλέον ΠΟΣΟΥΣ μήνες αφορά, γιατί ο κανόνας δεν είναι πια
    // ετήσιος: ο λογιστής πρέπει να ξέρει ποια κομμάτια της χρήσης βγαίνουν από
    // παραστατικό και ποια από υπολογισμό.
    if(ownFeeMonths.size>0) g.push(`Οι προμήθειες πλατφορμών ${ownFeeMonths.size===1?'ενός μήνα λαμβάνονται':`${ownFeeMonths.size} μηνών λαμβάνονται`} από τις καταχωρημένες δαπάνες, όχι από τις κρατήσεις.`)
    if(expensesYear.length===0) g.push(`Καμία καταχωρημένη δαπάνη για το ${year}.`)
    if(uncollectedRent>0) g.push(`Ανείσπρακτα μισθώματα ${eur(uncollectedRent)}: χρειάζεται τεκμηρίωση της νομικής διεκδίκησης.`)
    if(regime==='individual_longterm' && !tenant?.afm) g.push('Δεν έχει καταχωρηθεί ΑΦΜ μισθωτή.')
    if(enfiaEstimated) g.push('Ο ΕΝΦΙΑ είναι εκτίμηση, όχι ποσό από εκκαθαριστικό.')
    if(enfiaSource==='lastYear') g.push('Ο ΕΝΦΙΑ είναι το περσινό ποσό, όχι το φετινό εκκαθαριστικό.')
    if(enfiaBlock) g.push(`Δεν έχει καταχωρηθεί ΕΝΦΙΑ. ${enfiaBlock}`)
    const noCat = expensesYear.filter(e=>!e.category).length
    if(noCat>0) g.push(`${noCat} δαπάνες χωρίς κατηγορία.`)
    return g
  },[rent,stays,expensesYear,year,regime,uncollectedRent,tenant,enfiaEstimated,enfiaSource,enfiaBlock,ownFeeMonths,businessMode])

  // ── ΠΟΙΟΣ ΚΑΝΕΙ myDATA, ΚΑΙ ΜΕ ΠΟΙΟ ΔΙΚΑΙΩΜΑ ΕΚΠΤΩΣΗΣ ────────────────────
  // Ο ιδιοκτήτης που εκμισθώνει ως φυσικό πρόσωπο δεν χαρακτηρίζει έξοδα: δεν
  // τηρεί βιβλία, δεν διαβιβάζει. Για εκείνον η στήλη δεν υπάρχει καθόλου.
  //
  // Για την επιχείρηση, το δικαίωμα έκπτωσης δεν μαντεύεται — και μόνο μία
  // περίπτωση είναι βέβαιη από τα δεδομένα που ήδη έχουμε: η εκμίσθωση
  // κατοικίας απαλλάσσεται από ΦΠΑ (άρθρο 22 ν.2859/2000), άρα δεν υπάρχει
  // δικαίωμα έκπτωσης των εισροών και το γενικό έξοδο πάει στο 2.5. Στη
  // βραχυχρόνια, όπου το καθεστώς εξαρτάται από το αν παρέχονται υπηρεσίες,
  // μένει άγνωστο: το κελί βγαίνει κενό και ο λογιστής το συμπληρώνει.
  const myDataExport = useMemo(()=>(
    businessMode ? { vat: (regime==='individual_longterm' ? 'none' : 'unknown') as VatDeduction } : undefined
  ),[businessMode,regime])

  const dossierExport = useMemo(()=>({
    propName: prop?.name || 'Ακίνητο',
    ownerName: owner?.owner_name || undefined,
    ownerAfm: owner?.owner_afm || undefined,
    statementLines: statement.lines.map(l=>({ label:l.label, amount:l.amount, kind:l.kind, negative:l.negative })),
    provisionMonthly: provision.monthly,
    book: book.map(toMovement),
    myData: myDataExport,
    // Το μητρώο παγίων υπάρχει μόνο για όποιον τηρεί βιβλία: ο ιδιοκτήτης που
    // δηλώνει ενοίκια ως φυσικό πρόσωπο δεν εκπίπτει αποσβέσεις.
    assets: businessMode ? assets : undefined,
    buildingFraction: BUILDING_VALUE_FRACTION,
    gaps: dossierGaps,
    // ΤΑ ΧΑΡΤΙΑ ΚΑΤΕΒΑΙΝΟΥΝ ΟΤΑΝ ΠΑΤΗΘΕΙ ΤΟ ΚΟΥΜΠΙ, ΟΧΙ ΟΤΑΝ ΑΝΟΙΞΕΙ Η ΟΘΟΝΗ.
    // Είναι μεγαβάιτ· κανείς δεν τα θέλει επειδή κοίταξε τη Λογιστική.
    attachments: ()=>fetchDossierPapers(supabase, propertyId, userId, year),
  }),[prop,owner,statement,provision,book,dossierGaps,myDataExport,assets,businessMode,supabase,propertyId,userId,year])

  // ── Κλείσιμο χρήσης (period lock) ──────────────────────────────────────────
  // Το στιγμιότυπο της κλεισμένης χρήσης: ό,τι γράφεται στο `snapshot` και
  // τίποτα άλλο. Η υπογραφή `sig` είναι που ξεχωρίζει το «κλειδωμένο» από το
  // «κλειδωμένο αλλά άλλαξαν τα δεδομένα από τότε».
  interface BookSnapshot {
    sig: string
    taxableIncome: number; incomeTax: number; netProfit: number; netCash: number
    provisionMonthly: number; collectedTotal: number; expectedTotal: number
  }
  const [closing,setClosing] = useState<{ snapshot:BookSnapshot; locked_at:string }|null>(null)
  const [lockErr,setLockErr] = useState<string|null>(null)
  // ═══ Η ΣΙΩΠΗΛΗ ΑΝΑΓΝΩΣΗ ΕΚΑΝΕ ΤΗΝ ΚΛΕΙΔΩΜΕΝΗ ΧΡΗΣΗ ΝΑ ΦΑΙΝΕΤΑΙ ΑΝΟΙΧΤΗ ═══
  // ΤΟ ΣΦΑΛΜΑ, ΩΣ ΑΛΥΣΙΔΑ. Η ανάγνωση αγνοούσε το `error`: μια αποτυχία —δίκτυο,
  // policy, χρονικό όριο— γύριζε `undefined`, που εδώ διαβαζόταν ΑΚΡΙΒΩΣ όπως το
  // «δεν υπάρχει κλείσιμο». Η οθόνη έγραφε ΑΝΟΙΧΤΟ και έδειχνε «Κλείδωμα έτους».
  //
  // ΚΑΙ ΤΟ ΚΛΕΙΔΩΜΑ ΚΑΝΕΙ delete-then-insert. Δηλαδή ο λογιστής που πατούσε το
  // κουμπί ΕΣΒΗΝΕ το υπάρχον στιγμιότυπο και την αρχική ημερομηνία κλειδώματος,
  // και τα αντικαθιστούσε με τους σημερινούς αριθμούς. Ο λόγος ύπαρξης του
  // κλειδώματος —«αυτοί ήταν οι αριθμοί την ημέρα της υποβολής»— χανόταν, από
  // μια αποτυχία δικτύου που κανείς δεν είδε.
  //
  // ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΟΧΙ ΔΥΟ: κλειδωμένο, ανοιχτό, ΔΕΝ ΞΕΡΟΥΜΕ. Στην τρίτη
  // δεν εμφανίζεται κανένα κουμπί που γράφει: ό,τι κι αν πατούσε ο χρήστης εκεί,
  // θα το πατούσε χωρίς να ξέρει τι υπάρχει από κάτω.
  const [closingErr,setClosingErr] = useState<string|null>(null)
  // Ίδιο κενό, ίδια λύση: χωρίς ακύρωση, το κλείδωμα χρήσης και το όνομα του
  // μισθωτή του προηγούμενου ακινήτου τυπώνονταν στη βεβαίωση του νέου.
  useEffect(()=>{ let alive = true; (async()=>{
    const { data, error } = await supabase.from('book_closings').select('snapshot,locked_at').eq('property_id',propertyId).eq('user_id',userId).eq('year',year).maybeSingle()
    if(!alive) return
    if(error){ setClosingErr(failed('Η κατάσταση της χρήσης δεν διαβάστηκε', error)); setClosing(null); console.warn('book_closings', error) }
    else { setClosingErr(null); setClosing((data as { snapshot:BookSnapshot; locked_at:string }|null)||null) }
  })(); return ()=>{ alive = false } },[propertyId,userId,year,refreshKey,supabase])
  useEffect(()=>{ let alive = true; (async()=>{
    // Ο ΤΡΕΧΩΝ ΜΙΣΘΩΤΗΣ, ΟΧΙ Ο ΤΕΛΕΥΤΑΙΟΣ ΠΟΥ ΓΡΑΦΤΗΚΕ. Το όνομα που βγαίνει από
    // εδώ τυπώνεται στη βεβαίωση ενοικίου: με «πιο πρόσφατα δημιουργημένος», η
    // βεβαίωση έβγαινε στο όνομα άλλου ανθρώπου από αυτόν που έδειχνε η Επισκόπηση.
    const data = await tenantStore.current<{ full_name?:string; afm?:string }>(supabase, propertyId, 'full_name,afm', userId)
    if(alive) setTenant(data||null)
  })(); return ()=>{ alive = false } },[propertyId,userId,refreshKey,supabase])
  // Ετήσια βεβαίωση ενοικίου: μόνο εισπραγμένα μισθώματα του έτους, ανά μήνα.
  function printCertificate(){
    const paid = rent.filter(p=>p.paid&&p.period_year===year).sort((a,b)=>(a.period_month||0)-(b.period_month||0))
    const months = paid.map(p=>({ label:`${MONTHS_NOM[(p.period_month||1)-1]} ${p.period_year}`, amount:p.amount||0 }))
    const total = months.reduce((s,m)=>s+m.amount,0)
    printRentCertificate({ year, propName:prop?.name||'Ακίνητο', address:prop?.address??undefined, tenantName:tenant?.full_name, tenantAfm:tenant?.afm, months, total, branding })
  }
  // Επίσημο true-PDF της βεβαίωσης ενοικίου (ίδια δεδομένα με την εκτυπώσιμη), με
  // αρ. εγγράφου & QR επαλήθευσης — καταχωρείται στο μητρώο εγγράφων.
  async function officialRentCertificate(){
    if(genOfficialCert) return
    const paid = rent.filter(p=>p.paid&&p.period_year===year).sort((a,b)=>(a.period_month||0)-(b.period_month||0))
    const months = paid.map(p=>({ label:`${MONTHS_NOM[(p.period_month||1)-1]} ${p.period_year}`, amount:p.amount||0 }))
    const total = months.reduce((s,m)=>s+m.amount,0)
    setGenOfficialCert(true)
    try {
      await downloadOfficialRentCertificate({ year, propName:prop?.name||'Ακίνητο', address:prop?.address??undefined, tenantName:tenant?.full_name, tenantAfm:tenant?.afm, months, total, branding }, { supabase, userId })
    } catch { notifyError(failed(MSG.pdf)) }
    finally { setGenOfficialCert(false) }
  }
  // Υπογραφή από ΜΟΝΙΜΑ δεδομένα (όχι από επιλογές εμφάνισης όπως ιδιώτης/επιχείρηση,
  // ηλικία, ΕΦΚΑ), ώστε η «απόκλιση» να σημαίνει πραγματική αλλαγή σε ενοίκια/έξοδα.
  const bookSig = useMemo(()=>[rentAccruedYear,rentCollectedYear,expensesTotal,loanAnnual,Math.round(shortSummary.grossRevenue)].map(n=>Math.round(n)).join('|'),[rentAccruedYear,rentCollectedYear,expensesTotal,loanAnnual,shortSummary])
  const drift = !!closing && closing.snapshot?.sig!=null && closing.snapshot.sig!==bookSig
  async function lockYear(){
    const snapshot = { sig:bookSig, taxableIncome:statement.taxableIncome, incomeTax:statement.incomeTax, netProfit:statement.netProfit, netCash:statement.netCash, provisionMonthly:provision.monthly, collectedTotal:rs.collectedTotal, expectedTotal:rs.expectedTotal }
    const locked_at = new Date().toISOString()
    // Ενημέρωση κατάστασης ΑΜΕΣΩΣ (ΑΝΟΙΧΤΟ → ΚΛΕΙΣΜΕΝΟ) και ΜΟΝΙΜΗ αποθήκευση στη βάση.
    setLockErr(null); setClosing({ snapshot, locked_at })
    // delete-then-insert αντί για upsert(onConflict): δουλεύει ΜΟΝΟ με τα policies
    // insert+delete (που υπάρχουν ήδη), χωρίς να απαιτεί policy UPDATE ή unique constraint
    // για το onConflict — άρα κλειδώνει αξιόπιστα ανεξάρτητα από την κατάσταση του schema.
    await supabase.from('book_closings').delete().eq('property_id',propertyId).eq('user_id',userId).eq('year',year)
    const { error } = await supabase.from('book_closings').insert({ user_id:userId, property_id:propertyId, year, snapshot, locked_at })
    // Αν η αποθήκευση αποτύχει, ΔΕΝ κρύβουμε το πρόβλημα: επαναφέρουμε την κατάσταση και
    // λέμε τον λόγο. «Τον πραγματικό λόγο» σήμαινε ως τώρα το αγγλικό κείμενο της
    // Postgres — που δεν είναι εμπιστοσύνη, είναι θόρυβος. Ο λόγος λέγεται στα
    // ελληνικά όταν αναγνωρίζεται και το πρωτότυπο μένει στην κονσόλα από κάτω,
    // για όποιον το ψάχνει.
    if(error){ setClosing(null); setLockErr(failed('Το κλείδωμα της χρήσης δεν αποθηκεύτηκε', error)); console.warn('Αποτυχία αποθήκευσης κλειδώματος:', error) }
  }
  async function unlockYear(){
    // Η ΧΡΗΣΗ ΕΜΦΑΝΙΖΕΤΑΙ ΞΕΚΛΕΙΔΩΤΗ ΜΟΝΟ ΑΝ ΞΕΚΛΕΙΔΩΣΕ. Το `setClosing(null)`
    // έτρεχε ΠΡΙΝ τη διαγραφή και δεν επανερχόταν σε αποτυχία: η οθόνη έλεγε
    // «ανοιχτή χρήση» ενώ η γραμμή κλειδώματος ζούσε ακόμη στη βάση και η
    // επόμενη φόρτωση την ξαναέφερνε.
    setLockErr(null)
    const ok = await saved('Το κλείδωμα της χρήσης δεν άνοιξε',
      supabase.from('book_closings').delete().eq('property_id',propertyId).eq('user_id',userId).eq('year',year))
    if(ok) setClosing(null)
  }

  // Δημιουργεί/ανακτά τον σύνδεσμο της πύλης λογιστή και τον αντιγράφει. Ο λογιστής
  // βλέπει live εικόνα εσόδων/εξόδων ανά ακίνητο, read-only, χωρίς login ή email.
  async function shareWithAccountant(){
    if(acctBusy) return
    // Χωρίς πακέτο, ο σύνδεσμος θα εκδιδόταν κανονικά και θα έδειχνε «δεν
    // βρέθηκε» στον λογιστή — δηλαδή ο ιδιοκτήτης θα το μάθαινε από εκείνον.
    if(!canAccountantPortal){ onNavigate?.('settings'); return }
    setAcctBusy(true)
    try{
      // Η δημιουργία, η ανανέωση της λήξης και η περιστροφή ζουν σε ένα σημείο:
      // lib/data/accountantLink.ts. Εδώ ήταν γραμμένες δεύτερη φορά και η
      // εκδοχή των Ρυθμίσεων είχε ήδη αποκλίνει.
      const link = await accountantLink.issue(supabase, userId)
      if(!link){ notifyError('Ο σύνδεσμος για τον λογιστή δεν δημιουργήθηκε'); return }
      setAcctLink(link.url)
      setAcctUntil(accountantLink.expiryLabel(link))
      try{ await navigator.clipboard.writeText(link.url); setAcctCopied(true); setTimeout(()=>setAcctCopied(false),2600) }catch{ /* ο σύνδεσμος φαίνεται πλέον στο πλαίσιο, ο χρήστης τον αντιγράφει χειροκίνητα */ }
    } finally { setAcctBusy(false) }
  }

  // Ανάκληση: περιστρέφει το token, ώστε ο παλιός σύνδεσμος να πάψει αμέσως να
  // λειτουργεί (ασφάλεια) και να εμφανιστεί καινούριος για μοίρασμα.
  //
  // ΚΑΙ ΚΛΕΙΝΕΙ ΚΑΙ ΤΟΝ ΧΩΡΟ ΕΡΓΑΣΙΑΣ. Για καιρό δεν το έκανε: ο λογιστής που
  // είχε ήδη αξιώσει τον σύνδεσμο κρατούσε πρόσβαση για πάντα, γιατί η αξίωση
  // ζούσε στον πίνακα accountant_clients και δεν θυμόταν ΜΕ ΠΟΙΟΝ σύνδεσμο
  // δόθηκε. Το κουμπί έλεγε «Ανάκληση» και ανακαλούσε τον μισό δρόμο.
  // Η `accountant_link_live` στη βάση απαιτεί πλέον το token της αξίωσης να
  // είναι ακόμη το ενεργό — άρα η περιστροφή είναι ανάκληση και στους δύο.
  async function revokeAccountantLink(){
    if(acctBusy) return
    setAcctBusy(true)
    try{
      const link = await accountantLink.rotate(supabase, userId)
      if(link === 'insecure'){ notifyError('Ο περιηγητής δεν μπορεί να παραγάγει ασφαλή σύνδεσμο. Δοκίμασε από ασφαλή σύνδεση (https).'); return }
      if(!link){ notifyError('Ο σύνδεσμος δεν ανακλήθηκε'); return }
      setAcctLink(link.url)
      setAcctUntil(accountantLink.expiryLabel(link))
      setAcctCopied(false); setAcctRevoked(true); setTimeout(()=>setAcctRevoked(false),2600)
    } finally { setAcctBusy(false) }
  }

  function exportBundle(){
    // Φάκελος για τον λογιστή: προσεγμένο Excel — Κατάσταση Αποτελεσμάτων + αναλυτικές
    // κινήσεις (Έσοδα/Έξοδα) με σωστές ημερομηνίες/ποσά, σαν να το ετοίμασε λογιστής.
    exportAccountantBundle({
      year, propName: prop?.name || 'Ακίνητο',
      ownerName: owner?.owner_name || undefined,
      ownerAfm: owner?.owner_afm || undefined,
      statementLines: statement.lines.map(l => ({ label: l.label, amount: l.amount, kind: l.kind, negative: l.negative })),
      provisionMonthly: provision.monthly,
      book: book.map(toMovement),
      myData: myDataExport,
      assets: businessMode ? assets : undefined,
      buildingFraction: BUILDING_VALUE_FRACTION,
    })
  }

  return {
    supabase, branding, reportBuilderOpen, setReportBuilderOpen, journalOpen, setJournalOpen,
    splitOpen, setSplitOpen, adjustOpen, setAdjustOpen, genOfficial, setGenOfficial,
    genOfficialCert, loading, readFailed, year, setYear, mode, elpForm, setElp, elp, age, ekfa,
    firstYears, updateFirstYears, distribution, setDistribution, claimedUncollected,
    setClaimedUncollected, rentsBankOverride, setRentsBankOverride, xferSide, setXferSide,
    xferPrice, setXferPrice, xferFirstHome, setXferFirstHome, xferAgent, setXferAgent, openAdvisory,
    setOpenAdvisory, advisoryOpen, setAdvisoryOpen, changesOpen, setChangesOpen, reconOpen,
    setReconOpen, ledgerOpen, setLedgerOpen, consolOpen, setConsolOpen, balanceOpen, setBalanceOpen,
    openChange, setOpenChange, advisoryRef, changesRef, showBankImport, setShowBankImport,
    setRefreshKey, hoverBracket, setHoverBracket, taxHot, setTaxHot, xferOpen, setXferOpen,
    cashOpen, setCashOpen, canJournal, journalPlanName, canAccountantPortal, canBankImport,
    canPortfolioReport, canOwnerSplit, advancedOpen, setAdvancedOpen, acctCopied, setAcctCopied,
    acctBusy, acctLink, acctRevoked, acctUntil, updateAge, updateEkfa, rent, stays, prop, allRent,
    allStays, isShort, regime, ownPct, isCoOwned, enfiaLoading, enfiaNow, enfia, enfiaSource,
    enfiaEstimated, enfiaState, enfiaBlock, rentAccruedYear, collection, bankMatters, rentsBank,
    expensesYear, billsYear, expensesTotal, deductibleTotal, loanInterestYear, businessMode,
    inventoryDepr, grossIncome, uncollectedRent, consolidation, myTaxShare, portfolio, minNetIncome,
    taxRows, statement, advisory, relevantChanges, xferEffectivePrice, xfer, provMonth, provision,
    cash, book, recentLedger, trial, jTotals, recon, rs, maxCash, dossierProps, dossier,
    doubleEntry, dossierExport, closing, lockErr, closingErr, printCertificate,
    officialRentCertificate, drift, lockYear, unlockYear, shareWithAccountant, revokeAccountantLink,
    exportBundle,
  }
}

export type AccountingState = ReturnType<typeof useAccounting>
