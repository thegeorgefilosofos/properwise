'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΑΠΟΔΟΣΕΙΣ — το εργαλείο απόδοσης ακινήτου. Καθαρό, minimal, πτυσσόμενο.
// Οδηγείται από το προφίλ: ιδιώτης → απλή εικόνα· επαγγελματίας → αναλυτικά
// εργαλεία, με διάκριση φυσικού/νομικού προσώπου όπου έχει σημασία.
// Πραγματικά δεδομένα αγοράς (lib/market/greekMarket) + μηχανή (lib/market/returns).
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo, useId, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import * as properties from '@/lib/data/properties';
import * as loanStore from '@/lib/data/loans';
import * as expenses from '@/lib/data/expenses';
import * as billStore from '@/lib/data/bills';
import * as stayStore from '@/lib/data/stays';
import * as rentStore from '@/lib/data/rent';
import * as tenantStore from '@/lib/data/tenants';
import { type IncomeRent } from '@/lib/income/propertyIncome';
import { taxpayerRentSources, ownershipPctOf, wholePropertyTax, type TaxpayerPropInput, type OtherPropertyIncome } from '@/lib/accounting/taxpayerIncome';
import { taxpayerScope } from '@/lib/facts/taxpayer';
import { propertyStatus, propertyStatusLabel, isLease, NOT_LET_NOTE, YIELD_SHORT_LABELS, YIELD_PRE_TAX_SUB, yearExpenses, yieldCosts, yieldCostParts, netPreTaxLabel, MODELLED_COST_LABELS, rentIncome, yieldIncome, yieldPlatformFees, INCOME_LABELS, PLATFORM_FEE_LABELS, type PropertyStatus, type RentIncome } from '@/lib/facts';
import type { CategorisedExpense } from '@/lib/tax/shortTermTax';
import type { StayAmountLike } from '@/lib/clients/stayAmounts';
import { type LedgerBill, type LedgerExpense } from '@/lib/expenses/ledger';
import { trailingStays, type ReportStay, type TrailingStays } from '@/lib/clients/reports';
import { athensToday } from '@/lib/core/time';
import { isActiveLoan } from '@/lib/loans/shape'
import { readStatus, type StatusRow } from '@/lib/property/status'
import { businessFormOf } from '@/lib/accounting/taxProfile'
import type { LegalForm as DossierLegalForm } from '@/lib/accounting/dossier'
import { Skeleton, SkeletonKPIs, PageTitle, EmptyState, fe, fp, fixedCols, Tile, Btn } from '@/components/Theme';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { yields, compound, leverage, compareInvestments, propertyTotalReturn, projectLine, yieldGrade, dealAnalysis, type LeverageResult, type YieldGrade } from '@/lib/market/returns';
import { shortTermEstimate, breakEvenOccupancy, adrReference, assumesMarket, MARKET_ESTIMATE_LABEL } from '@/lib/market/shortTerm';
import { isHouseType } from '@/lib/tax/shortTermTax';
import {
  BENCHMARKS, SHORT_TERM, GREECE_AVG_GROSS_YIELD,
  yieldVerdict, regionByKey, estimatePropertyValue, historyPriceCagr,
} from '@/lib/market/greekMarket';
import { incomeStatement } from '@/lib/accounting/statement';
import { consolidateRentTax, taxShareOf, CONSOLIDATION_NOTE } from '@/lib/billing/consolidate';
import { hasFeature } from '@/lib/billing/entitlements';
import type { PlanId } from '@/lib/billing/plans';
import { GLOSSARY as G } from '@/lib/market/glossary';
import { navLabel } from '@/lib/nav/labels';
import { useReportBranding } from '@/lib/reportBranding';
import { notifyError } from '@/components/Toast';
import { failed, MSG } from '@/lib/core/dbError';
import { fpSigned } from '@/lib/core/format';
// ── Η ΚΑΡΤΕΛΑ ΣΕ ΚΟΜΜΑΤΙΑ (roi/) ───────────────────────────────────────────
// Ηταν ένα αρχείο 2.400 γραμμών: μοντέλο, γραφήματα, αναφορές και οθόνη μαζί.
// Εδώ μένουν η κατάσταση, τα ερωτήματα και οι υπολογισμοί που διαβάζουν και
// τα πλακίδια και οι αναφορές· οι ενότητες, τα γραφήματα, οι δύο αναφορές PDF
// και οι καθαρές συναρτήσεις ζουν στον φάκελο roi/ δίπλα της.
import { stRefFor, clampReturn, benchShort, DEFAULT_LOAN_YEARS, DEFAULT_SELL_COSTS_PCT, MIN_BOOKED_NIGHTS, NEAR_REFERENCE, historyPath, sensitivityScenarios } from './roi/model';
import { SANS, TermInfo, GradeCard, g4box } from './roi/Bits';
import { printRoiReport, officialRoiReport, type RoiReport } from './roi/report';
import { InputsCard } from './roi/InputsCard';
import { AreaSection, HistorySection, CompareSection } from './roi/MarketSections';
import { ToolsSection, DealSection, SensitivitySection } from './roi/InvestSections';
import { TaxSection, LeversSection, SourcesCard } from './roi/ClosingSections';

interface Props { propertyId: string; userId: string; propertyValue?: number; profileType?: 'individual' | 'professional'; legalForm?: DossierLegalForm; plan?: PlanId; }

// Εδώ ζούσε τοπικός «fp» με ΕΝΑ δεκαδικό, που ΣΚΙΑΖΕ τον κανονικό: όλη η οθόνη
// απόδοσης έγραφε «4,2%» ενώ η διπλανή έγραφε «4,20%». Ένας μορφοποιητής.
export default function TabRentROI({ propertyId, userId, propertyValue, profileType = 'individual', legalForm = 'individual', plan = 'free' }: Props) {
  const supabase = createClient();
  const branding = useReportBranding(userId);
  const [loading, setLoading] = useState(true);
  const [genOfficial, setGenOfficial] = useState(false);
  // ═══ ΧΩΡΙΣ ΕΦΕ, ΧΩΡΙΣ ΣΥΓΧΡΟΝΙΣΜΟ ════════════════════════════════════════
  // Η πρώτη γραφή κρατούσε `inputsOpen` σε state και το γύριζε με `useEffect`
  // μόλις συμπληρώνονταν τα στοιχεία. Δύο προβλήματα: το `empty` υπολογίζεται
  // ΜΕΤΑ από πρόωρη επιστροφή, άρα τα hooks έμπαιναν υπό συνθήκη — σφάλμα που
  // σπάει τη σειρά των hooks μεταξύ renders· και ένα state που απλώς αντιγράφει
  // ένα άλλο δεν είναι κατάσταση, είναι αντίγραφο που μπορεί να αποκλίνει.
  //
  // Τώρα η προεπιλογή ΠΑΡΑΓΕΤΑΙ: ανοιχτό όσο λείπουν στοιχεία, κλειστό μόλις
  // υπάρχει αποτέλεσμα. Το `null` σημαίνει «δεν έχει αποφασίσει ο χρήστης»· μόλις
  // πατήσει, η επιλογή του καρφώνεται και δεν την ξαναγυρίζει κανείς.
  const [inputsPinned, setInputsPinned] = useState<boolean | null>(null);
  const apprId = useId();
  const pro = profileType === 'professional';
  // ── Η ΚΛΕΙΔΑΡΙΑ ΤΗΣ ΕΠΕΝΔΥΤΙΚΗΣ ΑΝΑΛΥΣΗΣ ΗΤΑΝ Ο ΤΥΠΟΣ ΠΡΟΦΙΛ ────────────
  // Το IRR, το NPV, ο DSCR και η ανάλυση ευαισθησίας πωλούνται: ο πίνακας
  // σύγκρισης τα δείχνει με λουκέτο στο «Επαγγελματίας». Φυλάγονταν όμως από το
  // `profileType`, που ο χρήστης το διαλέγει μόνος του σε ένα κουμπί των
  // ρυθμίσεων, χωρίς κανέναν έλεγχο. Δηλαδή η κλειδαριά είχε το κλειδί επάνω.
  //
  // Οι δύο όροι ρωτούν διαφορετικά πράγματα και χρειάζονται ΚΑΙ ΟΙ ΔΥΟ: το
  // πακέτο απαντά «το πληρώνει;», το προφίλ «βγάζει νόημα;» — η μόχλευση
  // υπολογίζεται πάνω στο επιχειρηματικό καθεστώς και σε φυσικό πρόσωπο δεν
  // εμφανίζονται καν τα πεδία του δανείου που τη γεννούν.
  const canInvest = pro && hasFeature({ plan }, 'investment_analysis');

  // ── ΔΥΟ ΔΙΑΚΟΠΤΕΣ ΠΟΥ ΞΑΝΑΡΩΤΟΥΣΑΝ Ο,ΤΙ Η ΕΦΑΡΜΟΓΗ ΗΔΗ ΞΕΡΕΙ ─────────────
  // Η νομική μορφή δηλώνεται ΜΙΑ φορά, στην εγγραφή και ζει στο
  // `billing_profiles.legal_form`. Η μίσθωση είναι η κατάσταση του ακινήτου και
  // αλλάζει από το μενού της μπάρας. Εδώ υπήρχαν τοπικά αντίγραφα και των δύο,
  // με δικά τους κουμπιά — και η Λογιστική είχε ΤΡΙΤΟ ζευγάρι. Ο χρήστης
  // μπορούσε να δηλώσει «Νομικό πρόσωπο» εδώ, «Ατομική» δίπλα και «Φυσικό» στο
  // προφίλ και οι τρεις οθόνες να του δώσουν τρεις διαφορετικούς φόρους.
  //
  // Αν κάτι είναι λάθος, διορθώνεται εκεί που δηλώθηκε.
  // Η αντιστοίχιση ζει σε ένα σημείο, με τεστ. Εδώ γραφόταν ως έκφραση ΚΑΙ
  // έπαιρνε τη δυαδική περίληψη της νομικής μορφής, όπου η ατομική επιχείρηση
  // είχε ήδη γίνει «νομικό πρόσωπο»: σε κέρδος 100.000€ ο φόρος έβγαινε 25.900
  // αντί 34.300 και στα μικρά εισοδήματα υπερδιπλάσιος.
  const entity = businessFormOf(legalForm);
  const [term, setTerm] = useState<'long' | 'short'>('long');
  /** Η κατάσταση του ακινήτου (lib/facts). Χωρίς μίσθωση η καρτέλα εξηγεί, δεν υπολογίζει. */
  const [statusNow, setStatusNow] = useState<PropertyStatus | null>(null);

  // Στοιχεία (prefill από τα δεδομένα του ακινήτου, με δυνατότητα διόρθωσης).
  const [value, setValue] = useState('');
  const [rent, setRent] = useState('');
  const [opex, setOpex] = useState('');
  // ΠΟΙΑ ΧΡΟΝΙΑ ΕΙΝΑΙ ΤΟ ΠΡΟΣΥΜΠΛΗΡΩΜΕΝΟ ΠΟΣΟ ΚΑΙ ΑΝ ΕΧΕΙ ΚΛΕΙΣΕΙ.
  // Το πεδίο λέει «Ετήσια έξοδα» και γεμίζει με το άθροισμα των εξόδων της
  // ΤΡΕΧΟΥΣΑΣ χρονιάς — δηλαδή, τον Αύγουστο, με οκτώ μήνες. Ο αριθμός μπαίνει
  // αυτούσιος σε καθαρή απόδοση, βαθμό A ως F και IRR, χωρίς πουθενά να λέγεται
  // ότι είναι μερικός. `null` σημαίνει «το έγραψε ο χρήστης», οπότε δεν είναι
  // δική μας δουλειά να σχολιάσουμε τι περιλαμβάνει.
  const [opexYear, setOpexYear] = useState<number | null>(null);
  // Οι κατηγορίες των δαπανών που έστησαν το προσυμπληρωμένο ποσό. Κρίνουν ποια
  // κόστη βραχυχρόνιας έχουν ήδη καταγραφεί και δεν ξαναμπαίνουν ως εκτίμηση.
  const [opexCats, setOpexCats] = useState<string[]>([]);
  const [region, setRegion] = useState('ath_center');
  // ── ΑΝΑΤΙΜΗΣΗ: ΜΕΤΡΗΜΕΝΗ, ΟΧΙ ΕΠΙΛΕΓΜΕΝΗ ────────────────────────────────
  // Ήταν σταθερά «3» χωρίς πηγή — και αυτή η σταθερά έκρινε μόνη της το
  // συμπέρασμα: με 3% το ακίνητο βγαίνει κοντά στον S&P 500 στην 20ετία, με 1%
  // όχι. Η προεπιλογή προκύπτει πλέον από τον δείκτη τιμών κατοικιών της Τράπεζας
  // της Ελλάδος (HISTORY_INDEX), στον ΙΔΙΟ ορίζοντα με τις εναλλακτικές. Μόλις ο
  // χρήστης τη πειράξει, χαρακτηρίζεται ρητά «δική σου υπόθεση».
  // Όσο δεν έχει πειραχθεί, η τιμή ΠΑΡΑΓΕΤΑΙ από τον δείκτη στον επιλεγμένο
  // ορίζοντα (δες apprRef) — δεν αντιγράφεται σε state με effect.
  const [appreciation, setAppreciation] = useState('');
  const [apprTouched, setApprTouched] = useState(false);
  // Είσπραξη μέσω τράπεζας: προϋπόθεση της τεκμαρτής έκπτωσης 5% από 1.7.2027
  // (ν.5222/2025) — απόφαση του χρήστη που καταγράφεται για τον φάκελο του
  // λογιστή· δεν αλλάζει τον φόρο των χρήσεων 2025-2026, όπου η έκπτωση δίνεται
  // ανεξάρτητα από τον τρόπο.
  const [rentsBank, setRentsBank] = useState(true);
  // ΤΟ ΤΑΚΚ ΤΟ ΠΛΗΡΩΝΕΙ Ο ΕΠΙΣΚΕΠΤΗΣ, ΤΟ ΑΠΟΔΙΔΕΙ Ο ΙΔΙΟΚΤΗΤΗΣ. Οι πλατφόρμες
  // όμως δεν έχουν πεδίο γι' αυτό στην Ελλάδα: όποιος δεν το ζητά ρητά, το
  // πληρώνει από την τσέπη του. Παραδοχή του χρήστη, όπως η τραπεζική είσπραξη.
  // Προεπιλογή η ΣΥΝΤΗΡΗΤΙΚΗ, ώστε το νούμερο να μην ανεβαίνει από μόνο του.
  const [levyToGuest, setLevyToGuest] = useState(false);
  // Ξεχωριστός ορίζοντας ανά ενότητα (η αλλαγή στη μία ΔΕΝ επηρεάζει τις άλλες).
  const [histYears, setHistYears] = useState<'10' | '20'>('10');
  const [cmpYears, setCmpYears] = useState<'10' | '20'>('10');
  const [compYears, setCompYears] = useState<'10' | '20'>('10');

  // Βραχυχρόνια (ενεργά όταν term==='short'· prefill από την αναφορά της περιοχής)
  const [stOcc, setStOcc] = useState('');
  const [stAdr, setStAdr] = useState('');
  const [stClean, setStClean] = useState('45');
  const [stFee, setStFee] = useState('15');
  // Χαρακτηριστικά ακινήτου (για ρεαλιστική τιμή/νύχτα ανά μέγεθος & τύπο).
  const [pSqm, setPSqm] = useState<number | null>(null);
  const [pType, setPType] = useState<string | null>(null);
  const [pName, setPName] = useState('');
  // Οι κρατήσεις των τελευταίων δώδεκα μηνών (νύχτες, έσοδα, πληρότητα, τιμή).
  const [booked, setBooked] = useState<TrailingStays | null>(null);
  // Δεδομένα κοινότητας (ανώνυμα aggregates ανά ΤΚ· εμφανίζονται μόνο με ≥5 ακίνητα).
  const [commStat, setCommStat] = useState<{ postal: string; count: number; median: number; p25: number; p75: number } | null>(null);

  // Εργαλεία (pro)
  const [compRate, setCompRate] = useState('5');
  const [ltv, setLtv] = useState('70');
  const [loanRate, setLoanRate] = useState('3.5');
  const [ifree, setIfree] = useState('0');
  const [savedLoan, setSavedLoan] = useState<{ amount:number; rate:number; property_value:number; loan_type:string } | null>(null);
  const [loanYears, setLoanYears] = useState(DEFAULT_LOAN_YEARS);
  // Επενδυτική ανάλυση (IRR/NPV/DSCR)
  const [holdYears, setHoldYears] = useState<'5' | '10' | '20'>('10');
  const [rentGrowth, setRentGrowth] = useState('2');
  const [discountRate, setDiscountRate] = useState('8');
  const [sellCosts, setSellCosts] = useState(DEFAULT_SELL_COSTS_PCT);
  // Ενοίκια των ΑΛΛΩΝ ακινήτων του χρήστη — για τον προοδευτικό φόρο στο σύνολο.
  // ΤΑ ΑΛΛΑ ΑΚΙΝΗΤΑ ΤΟΥ ΙΔΙΟΥ ΦΟΡΟΛΟΓΟΥΜΕΝΟΥ, με τις δόσεις και τις διαμονές
  // του έτους (lib/accounting/taxpayerIncome.ts): ίδιος υπολογισμός με την
  // Επισκόπηση, ώστε ο φόρος του ίδιου ακινήτου να βγαίνει ίδιος και στις δύο.
  const [taxBase, setTaxBase] = useState<{ props: TaxpayerPropInput[]; income: Map<string, OtherPropertyIncome>; owners: Set<string> | null }>({ props: [], income: new Map(), owners: null });
  // ΤΑ ΕΣΟΔΑ ΠΟΥ ΚΑΤΑΓΡΑΦΗΚΑΝ, ΜΕ ΤΟΝ ΟΡΙΣΜΟ ΤΗΣ ΕΠΙΣΚΟΠΗΣΗΣ. Οι Αποδόσεις
  // έγραφαν 22.048€ τον χρόνο για το Παγκράτι (πληρότητα × τιμή νύχτας της
  // περιοχής) ενώ η Επισκόπηση 7.020€ από τις δόσεις του. Τώρα, όπου υπάρχουν
  // δόσεις ή διαμονές, μετρούν αυτές· το μοντέλο αγοράς μένει για σενάριο, όταν
  // ο χρήστης αλλάξει ενοίκιο ή παραμέτρους· τότε λέγεται εκτίμηση.
  // Τα έσοδα του έτους από το lib/facts (`rentIncome`), όπως στην Επισκόπηση.
  const [recorded, setRecorded] = useState<RentIncome | null>(null);
  // Οι διαμονές και οι γραμμές δαπανών του έτους: από αυτές βγαίνει η προμήθεια
  // της πλατφόρμας, μία φορά (lib/facts/platformFees).
  const [feeBase, setFeeBase] = useState<{ stays: StayAmountLike[]; entries: CategorisedExpense[] }>({ stays: [], entries: [] });
  const [scenario, setScenario] = useState(false);

  const K = useCallback((s: string) => `roi_${propertyId}_${s}`, [propertyId]);
  // ΑΚΥΡΩΣΗ ΑΝΑ ΑΚΙΝΗΤΟ. Έξι παράλληλα ερωτήματα γεμίζουν δώδεκα πεδία. Με αλλαγή
  // ακινήτου στη διάρκειά τους, η παλιά απάντηση έγραφε αξία, ενοίκιο, ετήσια
  // έξοδα, τετραγωνικά και τύπο του ΠΡΟΗΓΟΥΜΕΝΟΥ ακινήτου. Και επειδή αυτά τα
  // πεδία αποθηκεύονται τοπικά με κλειδί ανά ακίνητο, τα λάθος νούμερα έμεναν και
  // μετά την ανανέωση σελίδας — και από αυτά βγαίνουν απόδοση, βαθμός A–F και IRR.
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const yearNow = Number(athensToday().slice(0, 4));
        const [pr, rc, exp, ln, allPr, allRc, bil, sts, yrRents, allYrRents, allSts, ownerRes, ten] = await Promise.all([
          properties.one(supabase, propertyId, 'value,target_rent,rental_mode,status_detail,sqm,prop_type,name,postal_code', userId),
          supabase.from('rent_config').select('actual_rent,target_rent').eq('property_id', propertyId).maybeSingle(),
          // ΓΙΑΤΙ ΜΕ ΗΜΕΡΟΜΗΝΙΑ. Το ερώτημα ήταν χωρίς φίλτρο έτους και το άθροισμα
          // έμπαινε στο πεδίο με ετικέτα «Ετήσια έξοδα». Δηλαδή στον δεύτερο χρόνο
          // χρήσης έδειχνε δύο χρονιές, στον τρίτο τρεις. Το φίλτρο της χρονιάς
          // γίνεται πλέον στον κοινό πυρήνα (ledgerYearTotal), μαζί με τους
          // λογαριασμούς: αυτοί έλειπαν· η Τιμολόγηση έγραφε 1.890€ έξοδα
          // εκεί που εδώ έγραφε 1.152€ για το ίδιο ακίνητο και το ίδιο έτος.
          expenses.ledger(supabase, propertyId, { userId }),
          loanStore.ofProperty(supabase, propertyId, userId),
          // ΤΑ ΑΛΛΑ ΑΚΙΝΗΤΑ. Αυτή η καρτέλα εμφανίζεται (disclosure.ts) ΜΟΝΟ σε
          // χρήστες με 2+ ακίνητα — δηλαδή ακριβώς εκεί όπου ο ανά-ακίνητο φόρος
          // είναι λάθος. Χωρίς τα υπόλοιπα ενοίκια δεν υπάρχει τρόπος να βγει ο
          // σωστός φόρος: η κλίμακα είναι προοδευτική στο σύνολο του Ε1.
          properties.list<{ id: string; target_rent: number | null; rental_mode: string | null; status_detail: string | null; client_id: string | null; ownership: string | null }>(supabase, userId, { columns: 'id,target_rent,rental_mode,status_detail,client_id,ownership' }),
          supabase.from('rent_config').select('property_id,actual_rent,target_rent').eq('user_id', userId),
          billStore.ofProperty<LedgerBill>(supabase, propertyId, billStore.LEDGER_COLUMNS, userId),
          // Οι κρατήσεις, για να βγει η πληρότητα και η τιμή νύχτας από τα
          // πραγματικά του ακινήτου και όχι από τον μέσο όρο της περιοχής.
          stayStore.ofProperty<ReportStay>(supabase, propertyId, stayStore.DECLARABLE_COLUMNS, userId),
          rentStore.ofProperty<IncomeRent>(supabase, propertyId, rentStore.INCOME_COLUMNS, userId, { year: yearNow }),
          rentStore.ofUser<IncomeRent & { property_id: string }>(supabase, userId, `property_id,${rentStore.INCOME_COLUMNS}`, { year: yearNow }),
          stayStore.ofUser<StayAmountLike & { property_id: string }>(supabase, userId, stayStore.PORTFOLIO_COLUMNS),
          pro ? supabase.from('clients').select('id').eq('user_id', userId).eq('type', 'owner') : Promise.resolve({ data: null }),
          // Ο τρέχων ενοικιαστής, όπως στην Επισκόπηση: το μίσθωμά του είναι τα
          // «αναμενόμενα με βάση τη μίσθωση». Το `rent_config` δεν το γράφει κανείς.
          tenantStore.current<{ monthly_rent: number | null }>(supabase, propertyId, 'monthly_rent', userId),
        ]);
        // ΤΑ ΔΥΟ ΣΧΗΜΑΤΑ, ΟΠΩΣ ΤΑ ΖΗΤΑ ΤΟ ΕΡΩΤΗΜΑ. Ήταν `any`, δηλαδή κάθε πεδίο
        // παρακάτω («p.sqm», «p.postal_code») ήταν αδιαφανές: ένα λάθος όνομα θα
        // έδινε undefined και η οθόνη θα υποχωρούσε αθόρυβα στις προεπιλογές.
        type PropRow = {
          value: number | null; target_rent: number | null; sqm: number | null;
          prop_type: string | null; name: string | null; postal_code: string | null;
          status_detail: string | null; rental_mode: string | null;
        };
        type RentCfgRow = { actual_rent: number | null; target_rent: number | null };
        if (!alive) return;
        const p = (pr || {}) as Partial<PropRow>; const c = (rc.data || {}) as Partial<RentCfgRow>;
        const rcRows = (allRc.data || []) as { property_id: string; actual_rent: number | null; target_rent: number | null }[];
        const prRows = allPr;
        const rcMap = new Map(rcRows.map(r => [r.property_id, r]));
        setTaxBase({
          props: prRows,
          owners: ownerRes.data ? new Set((ownerRes.data as { id: string }[]).map(r => r.id)) : null,
          income: new Map(prRows.map(x => {
            const cfg = rcMap.get(x.id);
            return [x.id, {
              rents: allYrRents.filter(r => r.property_id === x.id),
              stays: allSts.filter(st => st.property_id === x.id),
              estimateMonthly: Number(cfg?.actual_rent) || Number(cfg?.target_rent) || Number(x.target_rent) || 0,
            }];
          })),
        });
        // ΙΔΙΟ ΕΣΟΔΟ ΜΕ ΤΗΝ ΕΠΙΣΚΟΠΗΣΗ (07.10.2026). Ήταν `propertyIncome` με το
        // `rent_config.actual_rent`· η απόδοση έβγαινε από τις δόσεις σε ετήσιο
        // ρυθμό, ενώ η Επισκόπηση από το μίσθωμα × 12. Τώρα και οι δύο
        // διαβάζουν το `yieldIncome` πάνω στο ίδιο `rentIncome`.
        const tenantRent = Number(ten?.monthly_rent) || 0;
        setRecorded(rentIncome({ status: propertyStatus(p as StatusRow), rents: yrRents, stays: sts as StayAmountLike[], year: yearNow, today: athensToday(), estimateMonthly: tenantRent }));
        setScenario(false);
        // Το `amount`/`rate` δεν είναι στήλες: υπολογίζονται από το loan_amount
        // και το rate_type/fixed_rate/euribor/spread (lib/loans/shape.ts).
        const activeLoan = ln.find(l => isActiveLoan(l));
        if (activeLoan) setSavedLoan({ amount: activeLoan.amount, rate: activeLoan.rate, property_value: Number(activeLoan.property_value) || 0, loan_type: activeLoan.loan_type ?? '' });
        setValue(String(propertyValue || p.value || localStorage.getItem(K('value')) || ''));
        setRent(String(tenantRent || c.actual_rent || c.target_rent || p.target_rent || localStorage.getItem(K('rent')) || ''));
        const thisYear = Number(athensToday().slice(0, 4));
        // ΣΤΑ ΛΕΠΤΑ, ΟΧΙ ΣΤΟ ΕΥΡΩ. Το `Math.round` έγραφε «Έξοδα 10.160,00€» δύο
        // γραμμές πάνω από «Δαπάνες έτους 10.159,70€», στην ίδια οθόνη.
        // Οι δαπάνες έτους του lib/facts: πληρωμένες ως σήμερα + προγραμματισμένες
        // έως 31/12, το ίδιο ποσό με την Επισκόπηση και το Χαρτοφυλάκιο.
        const yExpNow = yearExpenses(bil, exp as LedgerExpense[], thisYear, athensToday());
        const expSum = yExpNow.total;
        setOpex(String(expSum || localStorage.getItem(K('opex')) || ''));
        setOpexYear(expSum > 0 ? thisYear : null);
        setOpexCats(expSum > 0 ? yExpNow.entries.map(e => e.category) : []);
        setFeeBase({ stays: sts as StayAmountLike[], entries: yExpNow.entries.map(e => ({ category: e.category, date: e.date })) });
        setBooked(trailingStays(sts, athensToday()));
        setPSqm(p.sqm && p.sqm > 0 ? p.sqm : null);
        setPType(p.prop_type || null);
        setPName(p.name || '');
        // ΩΜΟ `rental_mode` ΕΧΑΝΕ ΤΑ ΠΑΛΙΑ ΑΚΙΝΗΤΑ. Όσα σημάνθηκαν πριν από τη
        // μετάβαση κρατούν `status_detail: 'seasonal'`, που σημαίνει ακριβώς το
        // ίδιο. Το readStatus είναι η μία ανάγνωση που ξέρει και τα δύο.
        setTerm(readStatus(p as StatusRow) === 'rent_short' ? 'short' : 'long');
        setStatusNow(propertyStatus(p as StatusRow));
        const savedR = localStorage.getItem(K('region'));
        if (savedR) setRegion(savedR === 'mykonos_santorini' ? 'mykonos' : savedR); // συμβατότητα με παλαιό κλειδί
        // Δεδομένα κοινότητας για τον ΤΚ του ακινήτου (ανώνυμα· μόνο με ≥5 ακίνητα).
        const postal = String(p.postal_code || '').trim();
        if (postal) {
          try {
            const { data: cs } = await supabase.rpc('community_market_stats');
            // Το αποτέλεσμα της συνάρτησης της βάσης: τα πέντε πεδία που διαβάζονται.
            type CommRow = { postal_code: string | null; sample_count: number | null; median_gross_yield: number | null; p25_yield: number | null; p75_yield: number | null };
            const row = ((cs || []) as CommRow[]).find(r => String(r.postal_code || '').trim() === postal);
            if (alive && row && Number(row.sample_count) >= 5) {
              setCommStat({ postal, count: Number(row.sample_count), median: Number(row.median_gross_yield), p25: Number(row.p25_yield), p75: Number(row.p75_yield) });
            }
          } catch { /* λειτουργεί όταν υπάρχει αρκετό δείγμα */ }
        }
      } catch { /* keep defaults */ }
      // Και ο δείκτης φόρτωσης κάτω από τον ίδιο έλεγχο: αλλιώς η παλιά εκτέλεση
      // τον σβήνει ενώ η νέα φορτώνει ακόμη.
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false };
  }, [propertyId, propertyValue, supabase, userId, K, pro]);

  // Persist ελαφριά (τοπικά) — δεν χρειάζεται νέος πίνακας.
  useEffect(() => { try { localStorage.setItem(K('value'), value); localStorage.setItem(K('rent'), rent); localStorage.setItem(K('opex'), opex); localStorage.setItem(K('region'), region); } catch { } }, [value, rent, opex, region, K]);

  // Prefill πληρότητας/τιμής βραχυχρόνιας από την αναφορά της περιοχής (επαναφορά όταν
  // αλλάζει η περιοχή· ο χρήστης μπορεί πάντα να διορθώσει).
  const stRef = stRefFor(region);
  // Prefill ADR κουμπωμένο στο μέγεθος & τύπο του ακινήτου (ρεαλιστικό ανά κατηγορία).
  // ΚΑΤΑ ΤΗΝ ΑΠΟΔΟΣΗ, ΟΧΙ ΣΕ EFFECT. Ηταν effect: με αλλαγή περιοχής, τα δύο
  // πεδία της βραχυχρόνιας ζωγραφίζονταν πρώτα με τα νούμερα της ΠΡΟΗΓΟΥΜΕΝΗΣ
  // περιοχής και μετά με τα σωστά. Σε οθόνη που συγκρίνει αποδόσεις, εκείνο το
  // καρέ είναι λάθος απάντηση. Η React το ονομάζει «adjusting state when a prop
  // changes» και το συνιστά ρητά για ακριβώς αυτή την περίπτωση.
  //
  // ΟΙ ΚΡΑΤΗΣΕΙΣ ΠΡΙΝ ΑΠΟ ΤΗΝ ΠΕΡΙΟΧΗ. Με αρκετές νύχτες στους τελευταίους
  // δώδεκα μήνες, η πληρότητα και η τιμή νύχτας βγαίνουν από τα πραγματικά του
  // ακινήτου: αλλιώς η «απόδοση του ακινήτου σου» ήταν η απόδοση της περιοχής,
  // διπλάσια από αυτή που έγραφαν η Τιμολόγηση και η Λογιστική δίπλα.
  const fromBookings = !!booked && booked.nights >= MIN_BOOKED_NIGHTS;
  const bookedOcc = fromBookings ? String(booked.occupancyPct) : '';
  const bookedAdr = fromBookings ? String(Math.round(booked.adr)) : '';
  const areaAdr = String(adrReference(stRef.adr, pSqm, pType));
  const stKey = `${region}|${pSqm}|${pType}|${bookedOcc}|${bookedAdr}`;
  const [stSeen, setStSeen] = useState<string | null>(null);
  if (!loading && stKey !== stSeen) {
    setStSeen(stKey);
    setStOcc(fromBookings ? bookedOcc : String(stRef.occupancy));
    setStAdr(fromBookings ? bookedAdr : areaAdr);
  }
  // Από πού είναι τα νούμερα που φαίνονται: το λέει η λωρίδα και η μπάρα.
  const stBasis: 'bookings' | 'area' | 'own' =
    fromBookings && stOcc === bookedOcc && stAdr === bookedAdr ? 'bookings'
    : stOcc === String(stRef.occupancy) && stAdr === areaAdr ? 'area'
    : 'own';
  // Τα μεγάλα πλακίδια λένε «εκτίμηση αγοράς» όταν έστω ένα από τα δύο
  // (πληρότητα, τιμή νύχτας) είναι της περιοχής — όχι μόνο όταν είναι και τα δύο.
  const marketEstimate = term === 'short' && (scenario || !recorded || !(recorded.source === 'rent' || recorded.source === 'stays')) && assumesMarket({
    occupancy: stOcc, adr: stAdr,
    area: { occupancy: String(stRef.occupancy), adr: areaAdr },
    booked: fromBookings ? { occupancy: bookedOcc, adr: bookedAdr } : null,
  });
  const mkt = (sub: string) => (marketEstimate ? `${MARKET_ESTIMATE_LABEL} · ${sub}` : sub);

  const nVal = parseFloat(value) || 0;
  const nRent = parseFloat(rent) || 0;
  const nOpex = parseFloat(opex) || 0;
  // ΤΕΚΜΗΡΙΩΜΕΝΗ ΠΡΟΕΠΙΛΟΓΗ ΑΝΑΤΙΜΗΣΗΣ. Μετρημένη πάνω στον δείκτη τιμών
  // κατοικιών της Τράπεζας της Ελλάδος, στον ΙΔΙΟ ορίζοντα με τις εναλλακτικές
  // (BENCHMARKS.ret10/ret20) — αλλιώς η σύγκριση δεν είναι σύγκριση. Η μακρά
  // περίοδος εμφανίζεται δίπλα, ώστε ο χρήστης να βλέπει και τις δύο αναγνώσεις.
  const apprRef = useMemo(() => historyPriceCagr(parseInt(cmpYears)), [cmpYears]);
  const apprLong = useMemo(() => historyPriceCagr(20), []);
  // Στα «20 έτη» οι δύο μετρήσεις ταυτίζονται (ο δείκτης δεν πάει πιο πίσω από
  // το 2007), οπότε δεν υπάρχει δεύτερη περίοδος για να αντιπαρατεθεί.
  const longIsOther = apprLong.fromYear !== apprRef.fromYear;
  const apprShown = apprTouched ? appreciation : String(apprRef.pct);
  const nAppr = apprTouched ? (parseFloat(appreciation) || 0) : apprRef.pct;
  const reg = regionByKey(region);
  // Ενδεικτική αυτόματη εκτίμηση αξίας (AVM) από τη ζώνη × τετραγωνικά × τύπο.
  const estValue = useMemo(() => estimatePropertyValue(region, pSqm, pType), [region, pSqm, pType]);
  // Πρότεινε μόνο όταν υπάρχει εκτίμηση και είτε λείπει αξία είτε αποκλίνει >7% από την τρέχουσα.
  const showEstValue = estValue > 0 && (nVal <= 0 || Math.abs(nVal - estValue) / estValue > 0.07);

  // Το τέλος παρεπιδημούντων επιβαρύνει το νομικό πρόσωπο· ο ιδιώτης (≤2 ακίνητα) εξαιρείται.
  const individualPerson = !(pro && entity === 'company');
  // Κενό πεδίο → προεπιλογή περιοχής· το 0 (π.χ. μοντελοποίηση σχεδόν κενού ακινήτου) γίνεται σεβαστό.
  const occEff = Number.isFinite(parseFloat(stOcc)) ? parseFloat(stOcc) : stRef.occupancy;
  const adrEff = Number.isFinite(parseFloat(stAdr)) ? parseFloat(stAdr) : adrReference(stRef.adr, pSqm, pType);

  // Εκτίμηση βραχυχρόνιας (πληρότητα × τιμή/νύχτα − κόστη − ΤΑΚΚ − παρεπιδημούντων).
  // Το μεγάλο κλιμάκιο ΤΑΚΚ (μονοκατοικίες >80 τ.μ.) αφορά ΜΟΝΟ μονοκατοικίες/βίλες — όχι μεζονέτες.
  const isHouse = isHouseType(pType);
  // Μερίδιο νυχτών σε υψηλή περίοδο: νησιά/τουριστικά συγκεντρώνουν τη ζήτηση στο καλοκαίρι.
  const highSeasonShare = (reg?.tags || []).some(t => t === 'island' || t === 'tourist') ? 0.85 : 0.6;
  const st = useMemo(() => shortTermEstimate({
    occupancyPct: occEff, adr: adrEff, cleaningPerStay: parseFloat(stClean) || 0,
    platformFeePct: parseFloat(stFee) || 0, sqm: pSqm, isHouse, highSeasonShare, propertyCount: 1, individual: individualPerson,
    levyChargedToGuest: levyToGuest,
  }), [occEff, adrEff, stClean, stFee, pSqm, isHouse, highSeasonShare, individualPerson, levyToGuest]);

  // Ενοποιημένα μεγέθη: το toggle μακροχρόνια/βραχυχρόνια αλλάζει πραγματικά τα έσοδα & κόστη.
  const useRecorded = !scenario && !!recorded && (recorded.source === 'rent' || recorded.source === 'stays');
  // Το έσοδο της απόδοσης (lib/facts/income: `yieldIncome`): με μίσθωση το
  // μίσθωμα × 12, με διαμονές ο ετήσιος ρυθμός τους. Το ίδιο ποσό με την Επισκόπηση.
  const yi = useMemo(() => (recorded ? yieldIncome(recorded) : null), [recorded]);
  // Η ΠΡΟΜΗΘΕΙΑ ΤΩΝ ΔΙΑΜΟΝΩΝ ΠΡΙΝ ΑΠΟ ΤΟ ΠΟΣΟΣΤΟ ΤΟΥ ΠΕΔΙΟΥ (07.10.2026). Με
  // καταγεγραμμένα έσοδα από διαμονές, η προμήθεια είναι αυτή που κρατήθηκε σε
  // κάθε διαμονή, με τον ίδιο κανόνα μήνα και τον ίδιο ετήσιο ρυθμό με την
  // Επισκόπηση (lib/facts/platformFees). Το ποσοστό του πεδίου μένει για το
  // σενάριο. Υπολογίζεται ΠΡΙΝ από τα ποσά που απομνημονεύονται πιο κάτω.
  const stayFees = useRecorded && recorded
    ? yieldPlatformFees(recorded, feeBase.stays, { year: Number(athensToday().slice(0, 4)), today: athensToday(), expenses: opexYear !== null ? feeBase.entries : [] })
    : null;
  const grossAnnual = useRecorded && yi ? yi.annual : term === 'short' ? st.grossRevenue : nRent * 12;
  // ΤΟ `levyBorne` ΚΑΙ ΟΧΙ ΤΟ `climateLevy`: κόστος του ιδιοκτήτη είναι μόνο
  // όσο από το τέλος δεν το εισέπραξε από τον επισκέπτη. Ιδιο ιδίωμα με το
  // `levyShortfall` της Λογιστικής, ώστε οι δύο οθόνες να λένε το ίδιο.
  // Με καταγεγραμμένα έσοδα από ΔΟΣΕΙΣ το ακίνητο νοικιάζεται με μισθωτήριο: δεν
  // υπάρχουν προμήθειες πλατφόρμας ούτε καθαρισμοί. Από ΔΙΑΜΟΝΕΣ, τα κόστη της
  // βραχυχρόνιας ακολουθούν τα έσοδα που καταγράφηκαν, όχι τα έσοδα του μοντέλου.
  const stScale = term !== 'short' ? 0
    : !useRecorded ? 1
    : recorded!.source === 'rent' ? 0
    : st.grossRevenue > 0 ? grossAnnual / st.grossRevenue : 0;
  // ΚΑΜΙΑ ΔΑΠΑΝΗ ΔΥΟ ΦΟΡΕΣ (lib/facts/yield: `yieldCosts`). Τα κόστη του μοντέλου
  // μπαίνουν ΜΟΝΟ για είδος που δεν έχει καταγραφεί φέτος: όποιος πέρασε τις
  // προμήθειες της πλατφόρμας ή τον καθαρισμό ως δαπάνη δεν τα πληρώνει ξανά
  // εδώ. Όταν μπαίνει εκτίμηση, η καθαρή λέγεται «Εκτιμώμενη» και δεν μοιάζει
  // πια με την καθαρή της Επισκόπησης, που βγαίνει μόνο από καταγραφές.
  const costs = yieldCosts({
    recorded: nOpex,
    recordedCategories: opexYear !== null ? opexCats : [],
    stayFees: stayFees?.annual ?? 0,
    modelled: {
      platform_fee: st.platformFees * stScale,
      cleaning: st.cleaning * stScale,
      climate_levy: st.levyBorne * stScale,
      accommodation_tax: st.municipalTax * stScale,
    },
  });
  const stCosts = costs.modelled;                  // εκτιμώμενα κόστη βραχυχρόνιας που δεν καταγράφηκαν
  const effOpex = costs.total;                     // καταγεγραμμένα έξοδα + όσα από αυτά λείπουν
  const stCostsLabel = `Εκτίμηση κόστους βραχυχρόνιας (${costs.modelledKinds.map(k => MODELLED_COST_LABELS[k]).join(', ')})`;
  const netLabel = netPreTaxLabel(costs);
  const monthlyEquiv = grossAnnual / 12;           // ισοδύναμο «μηνιαίο ενοίκιο» για τη μηχανή

  // ── ΦΟΡΟΣ: ΕΝΑΣ ΦΟΡΟΛΟΓΟΥΜΕΝΟΣ, ΟΧΙ ΕΝΑ ΑΚΙΝΗΤΟ ─────────────────────────────
  // Πριν, ο φόρος υπολογιζόταν πάνω ΜΟΝΟ στα έσοδα αυτού του ακινήτου, με
  // `rentsPaidViaBank: true` καρφωμένο. Δύο λάθη σε δύο γραμμές: (α) η κλίμακα
  // είναι προοδευτική στο σύνολο των ενοικίων του Ε1, οπότε ένα ακίνητο 8.000€
  // ανάμεσα σε τρία δεν φορολογείται με 15% αλλά συμμετέχει στο 25%· (β) η
  // τεκμαρτή έκπτωση 5% θα προϋποθέτει τραπεζική είσπραξη από 1.7.2027
  // (ν.5222/2025). Τώρα ενοποιούμε το χαρτοφυλάκιο (με το ΕΠΕΞΕΡΓΑΣΜΕΝΟ εδώ ενοίκιο
  // για το τρέχον ακίνητο, ώστε τα «τι θα γινόταν αν» να παραμένουν αληθινά) και
  // δείχνουμε το μερίδιο. Νομικό πρόσωπο: δεν ισχύει ενοποίηση φυσικού προσώπου.
  const taxYear = Number(athensToday().slice(0, 4));
  const portfolioTax = useMemo(() => consolidateRentTax(taxpayerRentSources({
    props: taxBase.props.some(p => p.id === propertyId) ? taxBase.props : [{ id: propertyId }, ...taxBase.props],
    current: { id: propertyId, annualRent: grossAnnual, shortTerm: term === 'short', rentsPaidViaBank: rentsBank },
    ownerClientIds: taxpayerScope(profileType, taxBase.owners),
    income: taxBase.income,
    year: taxYear, today: athensToday(),
  }), undefined, taxYear), [propertyId, grossAnnual, term, rentsBank, taxBase, profileType, taxYear]);

  const annualTax = useMemo(() => {
    if (grossAnnual <= 0) return 0;
    if (pro && entity === 'company') {
      // Νομικό πρόσωπο: 22% + φόρος μερίσματος 5% στη διανομή (προεπιλογή: πλήρης διανομή,
      // ώστε ο φόρος να δείχνει τι φτάνει πραγματικά στον ιδιοκτήτη). Τα κόστη βραχυχρόνιας
      // εκπίπτουν ως δαπάνες της επιχείρησης.
      const stB = incomeStatement({ regime: 'business', businessForm: 'company', grossIncome: grossAnnual, itemizedExpenses: effOpex, companyDistribution: 1 });
      return stB.incomeTax + (stB.dividendTax || 0);
    }
    if (pro) {
      // Ατομική επιχείρηση: κλίμακα άρθρου 15 στο καθαρό κέρδος (όχι άρθρο 40).
      return incomeStatement({ regime: 'business', businessForm: 'sole', grossIncome: grossAnnual, itemizedExpenses: effOpex }).incomeTax;
    }
    // Φυσικό πρόσωπο: το μερίδιό του από τον ΕΝΑ προοδευτικό φόρο του χαρτοφυλακίου,
    // στο ποσοστό του· η οθόνη δείχνει όλο το ακίνητο, οπότε και τον φόρο όλου.
    return wholePropertyTax(taxShareOf(portfolioTax, propertyId), ownershipPctOf(taxBase.props.find(p => p.id === propertyId)));
  }, [grossAnnual, effOpex, pro, entity, portfolioTax, propertyId, taxBase]);
  // Εμφανίζουμε την ενοποίηση μόνο όταν υπάρχει τι να ενοποιηθεί (2+ ακίνητα με έσοδα).
  const consolidated = !pro && portfolioTax.count > 1;

  const y = useMemo(() => yields(monthlyEquiv, nVal, effOpex, annualTax), [monthlyEquiv, nVal, effOpex, annualTax]);
  // Μη στρογγυλοποιημένη μεικτή απόδοση για τα εργαλεία μόχλευσης/IRR (ώστε NOI/DSCR/IRR να
  // συμφωνούν ακριβώς με το ενοίκιο που έδωσε ο χρήστης, χωρίς σφάλμα στρογγυλοποίησης).
  const grossYieldExact = nVal > 0 ? (grossAnnual / nVal) * 100 : 0;
  // Κρίση αγοράς: μακροχρόνια → μεικτή του ακινήτου vs μέσος αγοράς· βραχυχρόνια → μεικτή
  // βραχυχρόνιας vs τυπική βραχυχρόνια της περιοχής.
  //
  // ΤΡΕΙΣ ΖΩΝΕΣ, ΟΧΙ ΔΥΟ. Ό,τι έπεφτε κάτω από τον μέσο όρο λεγόταν «Κοντά»:
  // 6,88% απέναντι σε 8,00% (14% κάτω) και ένα 2% εξίσου, δίπλα σε βαθμό D.
  // «Κοντά» σημαίνει ως 10% κάτω· πιο κάτω λέγεται με το όνομά του.
  const verdictLabel = term === 'short'
    ? (y.grossYield >= stRef.grossYield ? 'Πάνω από την τυπική βραχυχρόνια της περιοχής'
      : y.grossYield >= stRef.grossYield * NEAR_REFERENCE ? 'Κοντά στην τυπική βραχυχρόνια της περιοχής'
      : 'Κάτω από την τυπική βραχυχρόνια της περιοχής')
    : yieldVerdict(y.grossYield).label;
  // Ακριβής αντιστοίχιση προφίλ βραχυχρόνιας· τα σπασμένα νησιά (Μύκονος/Σαντορίνη) δείχνουν
  // τα κοινά τους δεδομένα αναφοράς (mykonos_santorini) αντί για γενική διατύπωση.
  const stExact = SHORT_TERM.find(s => s.key === region)
    || ((region === 'mykonos' || region === 'santorini') ? SHORT_TERM.find(s => s.key === 'mykonos_santorini') : undefined);

  // Βαθμός απόδοσης A–F. Σε μακροχρόνια η αναφορά είναι ο μέσος της περιοχής (μεικτός → −1,5
  // για καθαρό). Σε βραχυχρόνια, η αναφορά είναι καθαρή απόδοση ST στην ίδια αναλογία κόστους
  // (μεικτή ST × καθαρή/μεικτή), προσαρμοσμένη ώστε η μηχανή να τη διαβάσει σωστά.
  const grade = useMemo<YieldGrade>(() => {
    const cashPositive = (grossAnnual - effOpex - annualTax) > 0;
    if (term === 'short') {
      const ratio = st.grossRevenue > 0 ? st.netRevenue / st.grossRevenue : 0.5;
      const benchNet = stRef.grossYield * ratio;      // αναφορά καθαρής απόδοσης βραχυχρόνιας
      return yieldGrade(y.netYield, benchNet + 1.5, cashPositive);
    }
    return yieldGrade(y.netYield, reg?.grossYield ?? GREECE_AVG_GROSS_YIELD, cashPositive);
  }, [term, y.netYield, grossAnnual, effOpex, annualTax, st.grossRevenue, st.netRevenue, stRef.grossYield, reg]);

  // Ιστορική διαδρομή: πώς θα κινούνταν η αξία σου τα τελευταία 10/20 έτη.
  const hist = useMemo(() => historyPath(nVal, histYears), [nVal, histYears]);
  const histStart = hist[0]?.value || 0;
  const histEnd = hist[hist.length - 1]?.value || 0;

  // Σύγκριση με εναλλακτικές — οι εναλλακτικές με τις ΠΡΑΓΜΑΤΙΚΕΣ ιστορικές τους αποδόσεις
  // (μέση ετήσια 10ετίας ή 20ετίας, ανάλογα με τον ορίζοντα)· το ακίνητο με τη δική σου
  // εκτίμηση (καθαρή απόδοση + ανατίμηση). Ειλικρινή δεδομένα, όχι εξομαλυμένες υποθέσεις.
  const compare = useMemo(() => {
    const totalReturn = clampReturn(propertyTotalReturn(y.netYield, nAppr));
    const retFor = (b: typeof BENCHMARKS[number]) => cmpYears === '20' ? b.ret20 : b.ret10;
    const opts = [
      { key: 'property', label: 'Το ακίνητό σου (εκτίμηση)', annualReturnPct: totalReturn },
      ...BENCHMARKS.filter(b => b.key !== 'inflation').map(b => ({ key: b.key, label: b.label, annualReturnPct: retFor(b) })),
    ];
    // ΚΑΜΙΑ ΣΥΓΚΡΙΣΗ ΧΩΡΙΣ ΑΞΙΑ ΑΚΙΝΗΤΟΥ.
    //
    // Ήταν `nVal || 100000`: χωρίς καταχωρημένη αξία, ολόκληρη η σύγκριση
    // επενδύσεων έτρεχε πάνω σε 100.000€ που δεν έδωσε ποτέ ο χρήστης — και
    // το νούμερο διέρρεε ΚΑΙ στην εκτύπωση ΚΑΙ στην εξαγωγή, όπου φαίνεται σαν
    // δικό του στοιχείο. Χωρίς αξία δεν υπάρχει τι να συγκριθεί· ζητάμε την αξία.
    if (!(nVal > 0)) return [];
    return compareInvestments(nVal, parseInt(cmpYears), opts);
  }, [y.netYield, nAppr, nVal, cmpYears]);
  const compMax = Math.max(...compare.map(c => c.futureValue), 1);

  // Προβολή-γραμμή (forward): πώς μεγαλώνει το ίδιο ποσό στο ακίνητο vs στην κορυφαία
  // εναλλακτική, στον επιλεγμένο ορίζοντα — για το «έξυπνο» γράφημα σύγκρισης.
  const projSeries = useMemo(() => {
    const yearsN = parseInt(cmpYears);
    if (!(nVal > 0)) return [];
    const base = nVal;
    const propRate = clampReturn(propertyTotalReturn(y.netYield, nAppr));
    const topAlt = compare.find(c => c.key !== 'property');
    const series = [{ label: 'Ακίνητο', color: 'var(--accent)', points: projectLine(base, propRate, yearsN) }];
    if (topAlt) series.push({ label: benchShort(topAlt.key, topAlt.label), color: 'var(--text-tertiary)', points: projectLine(base, topAlt.annualReturnPct, yearsN) });
    return series;
  }, [cmpYears, nVal, y.netYield, nAppr, compare]);

  // Εργαλεία (pro)
  const comp = useMemo(() => compound(nVal, parseFloat(compRate) || 0, parseInt(compYears), Math.max(0, Math.round(grossAnnual - effOpex - annualTax))), [nVal, compRate, compYears, grossAnnual, effOpex, annualTax]);
  // ΟΙ ΠΑΡΑΔΟΧΕΣ ΕΙΝΑΙ ΠΛΕΟΝ ΠΕΔΙΑ. Διάρκεια δανείου και κόστη πώλησης έρχονται από
  // την οθόνη, όχι από σταθερές μέσα στην κλήση. Το ποσοστό λειτουργικών εξόδων
  // προκύπτει από τα ΠΡΑΓΜΑΤΙΚΑ έξοδα του χρήστη προς τα έσοδα — και εμφανίζεται.
  const nLoanYears = Math.max(1, parseInt(loanYears) || 25);
  const nSellCosts = Math.max(0, parseFloat(sellCosts) || 0);
  const opexPctOfRent = grossAnnual > 0 ? (effOpex / grossAnnual) * 100 : 0;
  const lev: LeverageResult = useMemo(() => leverage({ price: nVal, ltvPct: parseFloat(ltv) || 0, loanRatePct: parseFloat(loanRate) || 0, loanYears: nLoanYears, grossYieldPct: grossYieldExact, opexPctOfRent, interestFreePct: parseFloat(ifree) || 0 }), [nVal, ltv, loanRate, nLoanYears, grossYieldExact, opexPctOfRent, ifree]);

  // Χρηματοοικονομική ανάλυση αγοράς-κατοχής-πώλησης (IRR/NPV/DSCR), με τα ίδια στοιχεία.
  const deal = useMemo(() => dealAnalysis({
    price: nVal, ltvPct: parseFloat(ltv) || 0, loanRatePct: parseFloat(loanRate) || 0, loanYears: nLoanYears,
    grossYieldPct: grossYieldExact, opexPctOfRent,
    interestFreePct: parseFloat(ifree) || 0, holdYears: parseInt(holdYears), rentGrowthPct: parseFloat(rentGrowth) || 0,
    appreciationPct: nAppr, sellCostsPct: nSellCosts, discountRatePct: parseFloat(discountRate) || 0,
  }), [nVal, ltv, loanRate, nLoanYears, grossYieldExact, opexPctOfRent, ifree, holdYears, rentGrowth, nAppr, nSellCosts, discountRate]);

  // Ανάλυση ευαισθησίας (pro): απόδοση ιδίων & συνολική απόδοση σε δυσμενές/βασικό/ευνοϊκό
  // σενάριο (μεταβολή επιτοκίου & ετήσιας ανατίμησης). Δείχνει την αντοχή της επένδυσης.
  const scenarios = useMemo(() => sensitivityScenarios({ nVal, ltv, loanRate, nLoanYears, grossYieldExact, opexPctOfRent, ifree, netYield: y.netYield, nAppr }), [nVal, ltv, loanRate, nLoanYears, grossYieldExact, y.netYield, nAppr, opexPctOfRent, ifree]);

  // Πληρότητα ισοσκελισμού: το ελάχιστο ποσοστό πληρότητας ώστε η ΒΡΑΧΥΧΡΟΝΙΑ να αποδώσει
  // ό,τι και η μακροχρόνια. Το σταθερό opex (ΕΝΦΙΑ, συντήρηση) βαρύνει ΚΑΙ τους δύο τρόπους
  // εξίσου, οπότε απαλείφεται στη σύγκριση: στόχος = μεικτό ετήσιο ενοίκιο μακροχρόνιας.
  //
  // ΙΔΙΟ ΑΚΙΝΗΤΟ, ΙΔΙΕΣ ΠΑΡΑΔΟΧΕΣ. Εδώ έλειπαν τα `sqm`, `isHouse` και
  // `highSeasonShare` — άρα η μηχανή έπεφτε στις προεπιλογές της (βασικό κλιμάκιο
  // ΤΑΚΚ 8/2€ και 60% νύχτες σε υψηλή περίοδο), ενώ η εκτίμηση από πάνω έτρεχε με
  // τα ΠΡΑΓΜΑΤΙΚΑ στοιχεία του ακινήτου. Για μια βίλα 120 τ.μ. σε νησί αυτό σήμαινε
  // 5,60€ ΤΑΚΚ ανά νύχτα εδώ και 13,35€ δύο κάρτες πιο πάνω: ο χρήστης έβλεπε
  // «Τέλος Ανθεκτικότητας Χ € τον χρόνο» και δίπλα μια πληρότητα ισοσκελισμού που
  // είχε υπολογιστεί σαν να μην πλήρωνε αυτό το τέλος — δηλαδή η βραχυχρόνια
  // έδειχνε ότι «βγαίνει» με χαμηλότερη πληρότητα απ' ό,τι πραγματικά χρειάζεται.
  const breakEvenOcc = useMemo(() => {
    const ltGross = nRent * 12;
    if (ltGross <= 0) return null;
    return breakEvenOccupancy(ltGross, { adr: adrEff, cleaningPerStay: parseFloat(stClean) || 0, platformFeePct: parseFloat(stFee) || 0, sqm: pSqm, isHouse, highSeasonShare, propertyCount: 1, individual: individualPerson });
  }, [nRent, adrEff, stClean, stFee, pSqm, isHouse, highSeasonShare, individualPerson]);

  // Εξαγωγή επαγγελματικής αναφοράς PDF (μέσω παραθύρου εκτύπωσης· escape όλων των τιμών).
  // Το σώμα και των δύο αναφορών ζει στο roi/report.ts· εδώ μαζεύονται τα
  // στοιχεία της καρτέλας τη στιγμή του πατήματος, όπως τα έκλεινε το κλείσιμο.
  const reportInput = (): RoiReport => ({ branding, pName, regimeLabel, term, reg, pSqm, grossAnnual, effOpex, annualTax, y, nAppr, nOpex, stCosts, stCostsLabel, consolidated, netLabel, grade, stRef, canInvest, deal, lev, holdYears, scenarios, breakEvenOcc, occEff, adrEff, nVal, nRent, apprTouched, apprRef, rentsBank, levyToGuest, portfolioTax, opexPctOfRent, ltv, loanRate, nLoanYears, nSellCosts, cmpYears, compare });
  const printReport = () => printRoiReport(reportInput());

  // Επίσημο, τραπεζικού επιπέδου true-PDF (pdfmake): αριθμός εγγράφου, QR επαλήθευσης,
  // per-page footer· καταχωρείται στο μητρώο εγγράφων ώστε να επαληθεύεται στο /verify/<id>.
  // Καθρεφτίζει το περιεχόμενο της printReport σε PdfSection[].
  const officialReport = async () => {
    if (genOfficial) return;
    setGenOfficial(true);
    try {
      await officialRoiReport(supabase, reportInput());
    } catch { notifyError(failed(MSG.pdf)); }
    finally { setGenOfficial(false); }
  };

  // Σκελετός αντί για δείκτη: το σχήμα της καρτέλας είναι γνωστό εκ των προτέρων
  // (σειρά μετρικών + κάρτες ανάλυσης), οπότε το περιεχόμενο δεν «πετάγεται» όταν φορτώσει.
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Ο ΣΚΕΛΕΤΟΣ ΚΡΑΤΑ ΤΟ ΟΝΟΜΑ ΤΗΣ ΟΘΟΝΗΣ. Οσο φορτώνει, ο αναγνώστης οθόνης
          πρέπει να μπορεί να πει πού βρίσκεται· η φορτωμένη οθόνη το γράφει
          ορατά, με το κοινό `PageTitle`, που είναι κι αυτό `h1`. Κρυφό ΟΠΤΙΚΑ
          μόνο εδώ, ώστε ο σκελετός να μην αλλάξει ούτε ένα εικονοστοιχείο. */}
      <h1 className="sr-only">{navLabel('roi')}</h1>
      <SkeletonKPIs n={4} />
      <div {...fixedCols(2, 12, 'stretch')}>{[0, 1].map(i => <Skeleton key={i} h={140} r={14} />)}</div>
    </div>
  );

  // ── ΧΩΡΙΣ ΜΙΣΘΩΣΗ: ΕΞΗΓΗΣΗ, ΟΧΙ ΝΟΥΜΕΡΑ (05.10.2026) ────────────────────
  // Σε κενό, αμφισβητούμενο ή προς πώληση ακίνητο η καρτέλα υπάρχει
  // (lib/property/visibility.ts) αλλά δεν δείχνει ποσοστό: θα ήταν υπόθεση
  // ντυμένη σαν μέτρηση. Λέει γιατί και πού απαντιέται το «τι να το κάνω».
  if (statusNow && !isLease(statusNow)) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageTitle title={navLabel('roi')} sub={`${propertyStatusLabel({ status_detail: statusNow })} · ${NOT_LET_NOTE}`} />
      <EmptyState page title="Γιατί δεν υπάρχει απόδοση"
        hint={`Η απόδοση μετρά ό,τι αποδίδει το ακίνητο από μίσθωση. Όσο η κατάσταση είναι «${propertyStatusLabel({ status_detail: statusNow })}», ένα ποσοστό εδώ θα ήταν υπόθεση. Όταν δηλώσεις μίσθωση, η καρτέλα υπολογίζει με τα πραγματικά έσοδα και τις δαπάνες του έτους. Τις επιλογές για το ακίνητο τις συγκρίνει η καρτέλα «${navLabel('plan')}».`} />
    </div>
  );

  const regimeLabel = pro ? (entity === 'company' ? 'Επιχείρηση · Νομικό πρόσωπο' : 'Επιχείρηση · Φυσικό πρόσωπο') : 'Ιδιώτης';
  const empty = term === 'short' ? (nVal <= 0 || grossAnnual <= 0) : (nVal <= 0 || nRent <= 0);
  const inputsOpen = inputsPinned ?? empty;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ═══ Η ΚΕΦΑΛΙΔΑ ΗΤΑΝ ΧΕΙΡΟΠΟΙΗΤΗ ΚΑΙ ΗΤΑΝ Η ΠΕΜΠΤΗ ══════════════════════
          Τίτλος h2 στα 20, υπότιτλος στα 13, δικό της flex με τις ενέργειες
          δεξιά: δηλαδή το PageTitle, γραμμένο ξανά με άλλα νούμερα. Δεκαέξι
          καρτέλες χρησιμοποιούν το κοινό· αυτή έγραφε δικό της, οπότε δεν πήρε
          τίποτα από όσα διορθώθηκαν εκεί.

          ΤΙ ΚΟΣΤΙΖΕ, ΜΕΤΡΗΜΕΝΟ ΣΕ Galaxy A, 360×800. Τα δύο κουμπιά είχαν 110
          και 212 εικονοστοιχεία, δηλαδή το ένα σχεδόν διπλάσιο από το άλλο, ενώ
          το σχόλιο από πάνω τους έλεγε «ίδιο σχήμα, ίδιο μέγεθος». Το κοινό
          στοιχείο τα βάζει σε πλέγμα δύο στηλών στο τηλέφωνο, οπότε γίνονται
          πράγματι ίσα. Και ο τίτλος πέφτει στα 22 σε στενή οθόνη αντί να μένει
          καρφωμένος, όπως σε κάθε άλλη καρτέλα.

          ΔΥΟ ΚΟΥΜΠΙΑ, Η ΔΙΑΦΟΡΑ ΜΟΝΟ ΣΕ TOOLTIP. Έλεγαν «Αναφορά PDF» και
          «Επίσημο PDF», δηλαδή ο χρήστης έπρεπε να μαντέψει ποιο θέλει και σε
          κινητό δεν υπήρχε καν tooltip να τον βοηθήσει. Είναι όντως δύο
          διαφορετικά παραδοτέα: το ένα το τυπώνεις για σένα, το άλλο φέρει
          αριθμό εγγράφου που μπορεί να επαληθεύσει τρίτος.

          ΤΟ ΟΝΟΜΑ ΕΡΧΕΤΑΙ ΑΠΟ ΤΟ ΜΕΝΟΥ. Το `lib/nav/labels.ts` γράφτηκε ακριβώς
          για αυτό το σφάλμα και ονομάζει ΑΥΤΗ την περίπτωση στην κεφαλίδα του:
          ο κωδικός `roi` λεγόταν «Απόδοση» στο μενού και «Αποδόσεις» εδώ. */}
      <PageTitle
        title={navLabel('roi')}
        sub={`${regimeLabel} · η απόδοση του ακινήτου σου και σύγκριση με την αγορά.`}
        right={empty ? undefined : (<>
          {/* ΤΑ ΔΥΟ ΟΝΟΜΑΤΑ ΧΩΡΑΝΕ ΣΤΟ ΜΙΣΟ ΠΛΑΤΟΣ ΤΟΥ ΚΙΝΗΤΟΥ. Το «Για τράπεζα ή
              λογιστή» έσπαγε σε δύο γραμμές στα 390. Το όνομα λέει τι είναι το
              αρχείο· για ποιον είναι το λέει το title. «Επίσημο» δεν γράφεται:
              το έγγραφο δεν το εκδίδει αρχή. */}
          <Btn variant="secondary" onClick={printReport}>
            <ArrowUpRight size={14} /> PDF για μένα
          </Btn>
          <Btn variant="secondary" onClick={officialReport} disabled={genOfficial} title="PDF με αριθμό εγγράφου και QR, για να ελέγξει η τράπεζα ή ο λογιστής ότι δεν άλλαξε">
            <ShieldCheck size={14} /> {genOfficial ? 'Δημιουργία…' : 'PDF με QR'}
          </Btn>
        </>)}
      />

      <InputsCard inputsOpen={inputsOpen} setInputsPinned={setInputsPinned} empty={empty} term={term} nVal={nVal}
        stOcc={stOcc} stBasis={stBasis} rent={rent} stAdr={stAdr} opex={opex} stCosts={stCosts} reg={reg}
        value={value} setValue={setValue} setRent={setRent} setScenario={setScenario} setOpex={setOpex}
        setOpexYear={setOpexYear} setOpexCats={setOpexCats} region={region} setRegion={setRegion} opexYear={opexYear}
        showEstValue={showEstValue} pSqm={pSqm} estValue={estValue} fromBookings={fromBookings} booked={booked}
        setStOcc={setStOcc} setStAdr={setStAdr} stClean={stClean} setStClean={setStClean} stFee={stFee} setStFee={setStFee} y={y} />

      {!empty && (<>
        {/* KPIs */}
        <div {...g4box}>
          <Tile label="Μεικτή απόδοση" value={fp(y.grossYield)} sub={useRecorded && yi ? (yi.basis === 'lease' ? `${fe(y.annualRent)} τον χρόνο ${yi.shortLabel}` : `${fe(y.annualRent)} τον χρόνο, από ${fe(yi.received ?? 0)} ως σήμερα`) : mkt(`${fe(y.annualRent)} έσοδα τον χρόνο`)} info={<TermInfo term="Μεικτή απόδοση" text={G.gross_yield} />} />
          {/* Η ΚΑΘΑΡΗ ΛΕΕΙ ΑΝ ΜΕΣΑ ΤΗΣ ΥΠΑΡΧΕΙ ΕΚΤΙΜΗΣΗ. Μόνο με καταγραφές είναι ο
              ίδιος αριθμός με την Επισκόπηση· με κόστη του μοντέλου που δεν έχουν
              καταγραφεί είναι «Εκτιμώμενη» και το λέει ποια. */}
          <Tile label={netPreTaxLabel(costs, true)} value={fp(y.netYield)}
            sub={mkt(`${yieldCostParts(costs, fe)}, ${YIELD_PRE_TAX_SUB}`)}
            info={<TermInfo term={netLabel} text={[
              G.net_yield,
              costs.stayFees > 0 ? `Αφαιρούνται ${fe(costs.stayFees)} ${PLATFORM_FEE_LABELS.fromStays}. ${PLATFORM_FEE_LABELS.note}${stayFees && stayFees.ownMonths > 0 ? ` ${PLATFORM_FEE_LABELS.ownMonths}` : ''}` : null,
              costs.basis === 'estimated' ? `Εδώ αφαιρούνται και εκτιμήσεις για ό,τι δεν έχεις καταγράψει φέτος ως δαπάνη: ${costs.modelledKinds.map(k => MODELLED_COST_LABELS[k]).join(', ')}.` : null,
            ].filter(Boolean).join(' ')} />} />
          {/* «Μετά τον φόρο» και όχι «Απόδοση μετά τον φόρο»: δίπλα στη μεικτή και
              την καθαρή η λέξη «απόδοση» εννοείται· στα 390 η ετικέτα
              έσπαγε σε δύο γραμμές. Η εταιρεία πληρώνει φόρο μερίσματος μόνο
              στη διανομή· ο υπολογισμός υποθέτει πλήρη διανομή και το λέει. */}
          <Tile label={YIELD_SHORT_LABELS.net_after_tax} value={fp(y.netYieldAfterTax)}
            sub={mkt(consolidated ? `μερίδιο φόρου ${fe(annualTax)} τον χρόνο` : pro && entity === 'company' ? `φόρος ${fe(annualTax)} τον χρόνο, με πλήρη διανομή κερδών` : `φόρος ${fe(annualTax)} τον χρόνο`)}
            tone="accent" info={<TermInfo term="Απόδοση μετά τον φόρο" text={consolidated ? `${G.after_tax_yield} ${CONSOLIDATION_NOTE}` : G.after_tax_yield} />} />
          {canInvest
            ? <Tile label="Απόδοση ιδίων κεφαλαίων" value={fpSigned(lev.cashOnCash)} sub={mkt(lev.cashOnCash >= 0 ? 'θετική μόχλευση' : (lev.positiveCarry ? 'θετική μόχλευση, αρνητική ροή' : 'αρνητική μόχλευση'))} info={<TermInfo term="Απόδοση ιδίων κεφαλαίων" text={G.cash_on_cash} />} />
            : term === 'short'
              ? <Tile label="Τυπική περιοχής" value={fp(stRef.grossYield)} sub={`βραχυχρόνια, ${reg?.region || 'Ελλάδα'}`} info={<TermInfo term="Τυπική βραχυχρόνια της περιοχής" text={G.region_short_ref} />} />
              : <Tile label="Μέσος όρος περιοχής" value={fp(reg?.grossYield || GREECE_AVG_GROSS_YIELD)} sub={reg?.label || 'Ελλάδα'} info={<TermInfo term="Μέσος όρος περιοχής" text={G.region_ref} />} />}
        </div>
        {/* ΑΠΟ ΠΟΥ ΕΙΝΑΙ ΤΑ ΕΣΟΔΑ. Με καταγραφές, ο ίδιος αριθμός με την Επισκόπηση·
            με αλλαγμένο ενοίκιο ή παραμέτρους, σενάριο, με δρόμο επιστροφής. */}
        {recorded && (recorded.source === 'rent' || recorded.source === 'stays') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '10px 0 0', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: SANS, lineHeight: 1.55 }}>
            {useRecorded
              ? <span>{yi?.basis === 'lease'
                  ? `Έσοδα: ${yi.label}. ${fe(yi.received ?? 0)} ${INCOME_LABELS.received}. Ο ίδιος αριθμός με την Επισκόπηση. Άλλαξε ενοίκιο για σενάριο.`
                  : `Έσοδα από ${recorded.source === 'stays' ? 'τις διαμονές' : 'τις δόσεις'} που καταγράφηκαν φέτος, σε ετήσιο ρυθμό: ο ίδιος αριθμός με την Επισκόπηση. Άλλαξε ενοίκιο ή πληρότητα για σενάριο.`}</span>
              : <>
                  <span>Σενάριο με τα νούμερα που έγραψες, όχι τα έσοδα που καταγράφηκαν.</span>
                  <Btn variant="secondary" onClick={() => setScenario(false)}>Πίσω στα καταγεγραμμένα</Btn>
                </>}
          </div>
        )}

        {/* Βαθμός απόδοσης A–F */}
        <GradeCard grade={grade} note={term === 'short'
          ? `Σε σχέση με την τυπική βραχυχρόνια απόδοση της περιοχής, μετά τα λειτουργικά έξοδα και τον φόρο.`
          : `Σε σχέση με τον μέσο όρο της περιοχής (${reg?.label || 'Ελλάδα'}, μεικτή ${fp(reg?.grossYield || GREECE_AVG_GROSS_YIELD)}), με βάση την καθαρή απόδοση και την ταμειακή ροή.`} />

        {/* 1) Η περιοχή σου */}
        <AreaSection term={term} y={y} stRef={stRef} reg={reg} stBasis={stBasis} verdictLabel={verdictLabel} stExact={stExact} commStat={commStat} />

        {/* 2) Ιστορική διαδρομή */}
        <HistorySection histYears={histYears} setHistYears={setHistYears} hist={hist} histStart={histStart} histEnd={histEnd} />

        {/* 3) Σύγκριση με εναλλακτικές */}
        <CompareSection nVal={nVal} apprId={apprId} apprShown={apprShown} setAppreciation={setAppreciation}
          setApprTouched={setApprTouched} apprTouched={apprTouched} apprRef={apprRef} cmpYears={cmpYears} setCmpYears={setCmpYears}
          longIsOther={longIsOther} apprLong={apprLong} projSeries={projSeries} compare={compare} compMax={compMax} />

        {/* 4) Εργαλεία & μοχλοί — πακέτο «Επαγγελματίας», σε επιχειρηματικό καθεστώς */}
        {canInvest && (
          <ToolsSection compRate={compRate} setCompRate={setCompRate} compYears={compYears} setCompYears={setCompYears}
            comp={comp} nVal={nVal} grossAnnual={grossAnnual} effOpex={effOpex} annualTax={annualTax} savedLoan={savedLoan}
            value={value} setLtv={setLtv} setLoanRate={setLoanRate} setIfree={setIfree} ltv={ltv} loanRate={loanRate}
            loanYears={loanYears} setLoanYears={setLoanYears} ifree={ifree} lev={lev} opexPctOfRent={opexPctOfRent} nLoanYears={nLoanYears} />
        )}

        {/* Επενδυτική ανάλυση IRR/NPV/DSCR — πακέτο «Επαγγελματίας» */}
        {canInvest && (
          <DealSection holdYears={holdYears} setHoldYears={setHoldYears} rentGrowth={rentGrowth} setRentGrowth={setRentGrowth}
            discountRate={discountRate} setDiscountRate={setDiscountRate} sellCosts={sellCosts} setSellCosts={setSellCosts}
            deal={deal} nAppr={nAppr} apprTouched={apprTouched} apprRef={apprRef} opexPctOfRent={opexPctOfRent}
            ltv={ltv} loanRate={loanRate} nLoanYears={nLoanYears} nSellCosts={nSellCosts} />
        )}

        {/* Ανάλυση ευαισθησίας & αντοχή — πακέτο «Επαγγελματίας» */}
        {canInvest && (
          <SensitivitySection scenarios={scenarios} term={term} breakEvenOcc={breakEvenOcc} />
        )}

        <TaxSection term={term} empty={empty} st={st} levyToGuest={levyToGuest} setLevyToGuest={setLevyToGuest}
          individualPerson={individualPerson} rentsBank={rentsBank} setRentsBank={setRentsBank} consolidated={consolidated}
          portfolioTax={portfolioTax} annualTax={annualTax} propertyId={propertyId} taxYear={taxYear} />
        {/* Μοχλοί μεγιστοποίησης — επαγγελματίας (πλήρες) / ιδιώτης (μόνο βασικά) */}
        <LeversSection pro={pro} />

        {/* Πηγές & disclaimer */}
        <SourcesCard />
      </>)}
    </div>
  );
}
