'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΠΙΣΚΟΠΗΣΗ: Η ΠΡΩΤΗ ΚΑΡΤΕΛΑ ΚΑΘΕ ΑΚΙΝΗΤΟΥ
// ═══════════════════════════════════════════════════════════════════════════
import { heatingLabel } from '@/lib/property/heating'
import { propertyTypeLabel } from '@/lib/property/types'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as loanStore from '@/lib/data/loans'
import * as stayStore from '@/lib/data/stays'
import * as billStore from '@/lib/data/bills'
import * as rentStore from '@/lib/data/rent'
import * as checklist from '@/lib/data/checklist'
import * as calendar from '@/lib/data/calendar'
import * as tenantStore from '@/lib/data/tenants'
import * as expenseStore from '@/lib/data/expenses'
// Η απογραφή έχει ένα σπίτι: lib/data/inventory.
import * as inventory from '@/lib/data/inventory'
import { readStatus, statusLabel as statusLabelOf, isShortTerm, isLet } from '@/lib/property/status'
import { taxpayerRentSources, ownershipPctOf, wholePropertyTax } from '@/lib/accounting/taxpayerIncome'
import { taxpayerScope } from '@/lib/facts/taxpayer'
import { type StayAmountLike } from '@/lib/clients/stayAmounts'
import MonthlyFeedbackNudge from './MonthlyFeedbackNudge'
import type { LegalForm } from '@/lib/accounting/dossier'
import type { OpenerContext } from '@/lib/assistant/openers'
import { navLabel } from '@/lib/nav/labels'
import { mergeLedger } from '@/lib/expenses/ledger'
import { contractOverview } from '@/lib/contracts/overview'
import { useAppPreferences } from './useAppPreferences'
import {
  T, Btn, SkeletonKPIs, Skeleton, EmptyState, KPIGrid, SecHdr, InfoBanner, fp, feOr, fd, type KPIItem,
} from '@/components/Theme'
import { FileText } from 'lucide-react'
import {
  resolveRent, resolveValue, computeYields, propertyDetailsComplete,
} from '@/lib/billing/propertyFacts'
import { printPropertyStatement } from './statement'
import { useReportBranding } from '@/lib/reportBranding'
import { computeInsights } from '@/lib/insights/engine'
import { remainingBalance } from '@/lib/market/returns'
import { type LoanView, isActiveLoan, loansInstalmentTotal } from '@/lib/loans/shape'
import {
  consolidateRentTax, taxShareOf, consolidationSummary, CONSOLIDATION_NOTE, bankReceiptMatters,
} from '@/lib/billing/consolidate'
import { PRESUMPTIVE_DEDUCTION_RATE } from '@/lib/billing/presumptive'
import { FIRST_MONTH_BANK_RECEIPT, FIRST_YEAR_BANK_RECEIPT } from '@/lib/billing/greekTax'
import { fpRate, grDateOf } from '@/lib/core/format'
import AthensNow from './AthensNow'
import CashHero from './CashHero'
import RentReceived, { receivableLines } from './RentReceived'
import AgendaPanel from './AgendaPanel'
import AssistantStrip from './AssistantStrip'
import { cashPosition } from '@/lib/home/cash'
import { buildAgenda, type SetupLike as SetupStep } from '@/lib/home/agenda'
import {
  readFailures, moneyIncomplete, failedSentence, trustedStep, trustedInsight, trustedObligation,
  LEASE_DECL_AREA, TAX_DEADLINES_AREA,
} from '@/lib/home/readFailures'
import { captureError } from '@/lib/observability/report'
import { computeObligations, type OblMaint, type OblTenant } from './obligations'
import { taxProfileOf } from '@/lib/tax/greekTaxCalendar'
import PortalShare from './PortalShare'
import OccupancyPanel from './OccupancyPanel'
import PolicyNotice from './PolicyNotice'
import { athensToday, isoYear, isoMonth } from '@/lib/core/time'
import { type IncomeRent } from '@/lib/income/propertyIncome'
import { yearExpensesOf, expenseParts, expensePartsShort, EXPENSE_LABELS, INCOME_LABELS, rentIncome, yieldIncome, propertyStatus, hostingReceipts, hostingParts, hostingPartsShort, HOSTING_LABELS, YIELD_LABELS, YIELD_INLINE_LABELS, yieldCosts, yieldPlatformFees, netPreTaxLabel, PLATFORM_FEE_LABELS, enfiaYear, closedTaxRefs } from '@/lib/facts'
import { useEnfiaSettings } from './useEnfia'
import type { ClientStaysRow } from '@/lib/supabase/tables'
import { useLoad, type LoadTurn } from '@/app/hooks/useLoad'
import { readCoOwners } from '@/lib/property/coOwners'
import type { Property, Expense, Bill, Task, Tenant, TenRow, TenantFull } from './shell/model'

/** Οι στήλες του `stayStore.DECLARABLE_COLUMNS`: ό,τι χρειάζεται το δηλωτέο ακαθάριστο. */
type HostStay = Pick<ClientStaysRow, 'check_in'|'check_out'|'nights'|'nightly_rate'|'total'|'channel'|'gross_guest_paid'|'platform_fee'|'climate_levy'|'amount_basis'>

// ═══ ΔΥΟ ΤΥΠΟΙ ΠΟΣΟΥ ΣΤΗΝ ΙΔΙΑ ΕΦΑΡΜΟΓΗ ΚΑΙ Ο ΕΝΑΣ ΕΒΓΑΖΕ ΠΑΥΛΑ ══════════
// Ο τοπικός `fmtEur` έγραφε ακέραια ευρώ («1.234€») ενώ ο κοινός `fe` γράφει
// πάντα δύο δεκαδικά («1.234,50€»): στην ΙΔΙΑ οθόνη, το πλακίδιο «Δαπάνες»
// στοιχιζόταν αλλού από το «Καθαρό αποτέλεσμα». Και για `null` επέστρεφε «—»,
// δηλαδή σύμβολο σε θέση ποσού, σε δεκαοκτώ σημεία της Επισκόπησης.
// Ο κοινός τύπος τα λύνει και τα δύο: `feOr` γράφει «0,00€» για το άγνωστο.
const fmtEur = feOr;

// Το CopyInventoryModal έφυγε ολόκληρο. Η αντιγραφή απογραφής από άλλο ακίνητο
// ζούσε σε ΔΥΟ σημεία: εδώ, ως modal που άνοιγε από κουμπί της καθολικής μπάρας,
// και μέσα στην ίδια την απογραφή, ως επιλογή που φαινόταν μόνο όταν δεν είχες
// κανένα αντικείμενο. Μία πράξη, δύο υλοποιήσεις, δύο διαφορετικές στιγμές
// εμφάνισης. Έμεινε εκείνη που ζει δίπλα στα δεδομένα που αντιγράφει.

// Ο ΚΑΝΟΝΑΣ ΔΕΝ ΚΡΕΜΕΤΑΙ ΠΛΕΟΝ ΑΠΟ ΤΗ ΔΙΑΤΥΠΩΣΗ ΤΗΣ ΕΤΙΚΕΤΑΣ.
// Ήταν `new Set(['Μηνιαίο Ενοίκιο', …])` και το φίλτρο έψαχνε το κείμενο που
// βλέπει ο χρήστης. Μια αλλαγή κεφαλαίου —«Μηνιαίο ενοίκιο»— και τα πλακίδια
// απόδοσης θα ξαναεμφανίζονταν σιωπηλά σε κενό ακίνητο, με ποσοστά βγαλμένα
// από ενοίκιο-στόχο που δεν εισπράχθηκε ποτέ. Κανένα τεστ δεν θα το έπιανε,
// γιατί τίποτα δεν θα είχε «σπάσει». Τώρα η σήμανση είναι δεδομένο του
// πλακιδίου (`incomeOnly`), όχι σύμπτωση κειμένου.

// ═══ ΕΞΑΓΕΤΑΙ ΓΙΑ ΝΑ ΜΕΤΡΗΘΕΙ ═══════════════════════════════════════════════
// Η ΕΠΙΣΚΟΠΗΣΗ ΕΙΝΑΙ Η ΟΘΟΝΗ ΠΟΥ ΒΛΕΠΕΙ ΠΡΩΤΗ ΚΑΘΕ ΧΡΗΣΤΗΣ, ΚΑΘΕ ΦΟΡΑ — και
// ήταν η ΜΟΝΗ που κανένας σαρωτής δεν είχε δει ποτέ. Ο πάγκος έχει σκηνή για
// τριάντα δύο καρτέλες· η Επισκόπηση έλειπε, επειδή ζει μέσα στο `page.tsx` ως
// τοπική συνάρτηση και δεν υπήρχε τρόπος να αποδοθεί χωρίς ολόκληρη τη σελίδα.
// Μία λέξη το λύνει: εξάγεται, ο πάγκος τη στήνει με τα δικά του δεδομένα και
// από εδώ και πέρα περνά κι αυτή από τους δώδεκα ελέγχους διάταξης και από τον
// έλεγχο προσβασιμότητας, όπως κάθε άλλη οθόνη.
/** Αν ένα βήμα ρύθμισης έχει νόημα για την κατάσταση του ακινήτου. */
function stepFitsProperty(key: string, prop: Property): boolean {
  if (key === 'tenant') return !isShortTerm(prop);
  if (key === 'pricing') return isShortTerm(prop);
  return true;
}

export function OverviewTab({ prop, properties, userId, onNavigate, tabVisible, profileType = 'individual', legalForm = 'individual' }: { prop: Property;
  /** ΟΛΑ τα ακίνητα του χρήστη — χρειάζονται για τον φόρο: η κλίμακα των ενοικίων
   *  είναι προοδευτική στο σύνολο του φορολογούμενου, όχι ανά ακίνητο. */
  properties: Property[];
  /** ΠΕΡΝΑΝΕ ΜΟΝΟ ΓΙΑ ΤΟ ΠΑΝΕΛ ΠΛΗΡΟΤΗΤΑΣ, ΠΟΥ ΥΠΟΛΟΓΙΖΕΙ ΤΕΛΟΣ ΠΑΡΕΠΙΔΗΜΟΥΝΤΩΝ.
   *  Εκείνο περνούσε καρφωμένο «φυσικό πρόσωπο», οπότε η εταιρεία έβλεπε μηδέν
   *  τέλος στην Επισκόπηση και το σωστό ποσό στη Λογιστική. */
  profileType?: 'individual' | 'professional';
  legalForm?: LegalForm;
  // ΤΟ ΟΝΟΜΑ ΙΔΙΟΚΤΗΤΗ ΕΦΥΓΕ ΑΠΟ ΕΔΩ. Περνούσε ως prop μαζί με χειριστή
  // αποθήκευσης και ΚΑΝΕΝΑ από τα δύο δεν χρησιμοποιήθηκε ποτέ μέσα στο σώμα:
  // η οθόνη δεν το έδειχνε και δεν το άλλαζε. Το όνομα ζει στο
  // `property_settings.owner_name`, όπου το γράφει ο οδηγός προσθήκης ακινήτου
  // και το διαβάζουν τα επίσημα έγγραφα και η δήλωση μίσθωσης.
  userId: string; onNavigate: (tab: string) => void;
  /** Οδηγεί κάπου αυτό το βήμα; Βήμα που δείχνει σε καρτέλα η οποία δεν αφορά τον
   *  χρήστη είναι νεκρός σύνδεσμος: το πάτημα θα τον γύριζε στην Επισκόπηση. */
  tabVisible: (id: string) => boolean }) {
  const supabase = createClient();
  const branding = useReportBranding(userId);
  const { prefs } = useAppPreferences(prop.id);
  // ΤΟ ΕΤΟΣ ΕΒΓΑΙΝΕ ΑΠΟ ΤΟ ΡΟΛΟΙ ΤΟΥ ΠΕΡΙΗΓΗΤΗ, ΟΧΙ ΑΠΟ ΤΗΝ ΑΘΗΝΑ. Στις 31
  // Δεκεμβρίου, 19:00 Νέα Υόρκη, στην Αθήνα είναι ήδη 1η Ιανουαρίου: η ίδια
  // οθόνη έγραφε «Η χρονιά 2026» και φόρτωνε δαπάνες 2026, ενώ το ημερολόγιο
  // δίπλα της — που χρησιμοποιεί σωστά την `athensToday` — ήταν ήδη στο 2027.
  // Δύο πάνελ, μία οθόνη, δύο φορολογικά έτη. Ο Έλληνας ιδιοκτήτης στο εξωτερικό
  // δεν είναι ακραία περίπτωση· είναι μεγάλο κομμάτι του κοινού.
  const todayAthens = athensToday();
  const year = Number(todayAthens.slice(0, 4)); const month = Number(todayAthens.slice(5, 7));
  // Το στιγμιότυπο χρόνου μένει για όσα το θέλουν ως Date (insights, υποχρεώσεις):
  // εκείνα συγκρίνουν αποστάσεις, όχι ημερολογιακό έτος, οπότε η ζώνη δεν κρίνει.
  const now = new Date();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [allExpenses, setAllExpenses] = useState<{ amount:number; date:string; category:string; is_recurring?:boolean; recurring_frequency?:string|null }[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [chk, setChk] = useState<{ due_date:string|null; status:string; priority:string }[]>([]);
  const [inv, setInv] = useState<{ name?:string|null; warranty_expiry:string|null; condition:string|null }[]>([]);
  // Οι στήλες `amount`/`rate` ΔΕΝ υπάρχουν στη βάση — υπολογίζονται από το
  // lib/loans/shape.ts. Ο τύπος εδώ περιγράφει ό,τι βλέπει η οθόνη, όχι ό,τι
  // επιστρέφει το ερώτημα.
  const [loans, setLoans] = useState<LoanView[]>([]);
  const [hostStays, setHostStays] = useState<HostStay[]>([]);
  // Οι δόσεις του έτους, ΠΛΗΡΩΜΕΝΕΣ ΚΑΙ ΜΗ: από αυτές βγαίνουν τα έσοδα ως σήμερα
  // (lib/income/propertyIncome.ts). Οι `rentPeriods` πιο κάτω είναι μόνο οι απλήρωτες.
  const [yearRents, setYearRents] = useState<IncomeRent[]>([]);
  // Το ΤΑΜΕΙΟ: περίοδοι ενοικίου και συντηρήσεις εξοπλισμού. Διαβάζονται ΕΔΩ και
  // όχι σε δικό τους panel, γιατί τροφοδοτούν την ΕΝΙΑΙΑ λίστα «τι χρειάζεται
  // τώρα» — αν κάθε κάρτα διάβαζε τα δικά της, θα ξαναγεννιόνταν τα διπλότυπα.
  const [rentPeriods, setRentPeriods] = useState<{ id:string|null; amount:number|null; due_date:string|null; paid:boolean|null; period_year:number|null; period_month:number|null }[]>([]);
  const [maint, setMaint] = useState<OblMaint[]>([]);
  /** Πότε καταγράφηκε η υποβολή της δήλωσης μίσθωσης· κλείνει την υποχρέωση. */
  const [leaseDeclaredAt, setLeaseDeclaredAt] = useState<string|null>(null);
  const [closedTax, setClosedTax] = useState<ReadonlySet<string>>(() => new Set());
  const [tenantFull, setTenantFull] = useState<TenantFull | null>(null);
  /** Οι μισθωτές αυτού του ακινήτου που έφυγαν: η πρόωρη λύση δηλώνεται στην ΑΑΔΕ. */
  const [leavers, setLeavers] = useState<OblTenant[]>([]);
  // Ενοίκια ΟΛΩΝ των ακινήτων (μισθωτήρια + ρυθμίσεις ενοικίου), για τον
  // προοδευτικό φόρο σε επίπεδο φορολογούμενου.
  // Ο ΤΡΟΠΟΣ ΕΙΣΠΡΑΞΗΣ ΤΑΞΙΔΕΥΕΙ ΜΑΖΙ ΜΕ ΤΟ ΕΝΟΙΚΙΟ.
  // Από 1.7.2027 (ν.5222/2025, άρθρο 210) η τεκμαρτή έκπτωση 5% θα προϋποθέτει
  // είσπραξη μέσω τράπεζας· με μετρητά ο φόρος στο 100% του ενοικίου. Ο χρήστης
  // το δηλώνει ήδη στην καρτέλα Ενοικιαστή (`tenants.e_payment`)· η κύρωση
  // περνά στον φόρο μόνο για χρήσεις από το 2027 (bankReceiptMatters(year)).
  const [portfolioRents, setPortfolioRents] = useState<{ property_id:string; monthly:number; viaBank:boolean }[]>([]);
  // Οι δόσεις και οι διαμονές ΟΛΩΝ των ακινήτων του έτους και οι καρτέλες
  // «Ιδιοκτήτης»: ο φόρος βγαίνει ανά φορολογούμενο, με τα έσοδα του κοινού
  // υπολογισμού (lib/accounting/taxpayerIncome.ts), όχι με το μηνιαίο × 12.
  const [portfolioIncome, setPortfolioIncome] = useState<{ rents: (IncomeRent & { property_id: string })[]; stays: (StayAmountLike & { property_id: string })[]; owners: Set<string> | null }>({ rents: [], stays: [], owners: null });
  // Ο ΔΕΙΚΤΗΣ ΦΟΡΤΩΣΗΣ ΔΕΝ ΕΙΝΑΙ ΞΕΧΩΡΙΣΤΗ ΚΑΤΑΣΤΑΣΗ, ΕΙΝΑΙ ΕΡΩΤΗΣΗ. Ηταν
  // `setLoading(true)` στην πρώτη γραμμή της φόρτωσης: σύγχρονη γραφή μέσα σε
  // effect, δηλαδή δεύτερη απόδοση πριν καν φύγει το αίτημα. Η ερώτηση που ΟΝΤΩΣ
  // απαντά είναι «τα δεδομένα που κρατώ είναι αυτού του ακινήτου και αυτής της
  // χρονιάς;» και απαντιέται κατά την απόδοση. Με την αλλαγή ακινήτου γίνεται
  // αληθής ΑΜΕΣΩΣ, οπότε δεν φαίνεται ποτέ καρέ με τα νούμερα του προηγούμενου.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loading = loadedFor !== `${prop.id}|${year}`;
  /** Ανοιχτό παράθυρο είσπραξης ενοικίου από την κάρτα του Ταμείου. */
  const [receivingRent, setReceivingRent] = useState(false);
  /** Οι περιοχές που δεν διαβάστηκαν στην τελευταία φόρτωση. Κενό σημαίνει όλα. */
  const [failedReads, setFailedReads] = useState<string[]>([]);
  /** Το «Δοκίμασε ξανά» τρέχει: το κουμπί σβήνει ώσπου να γυρίσει η απάντηση. */
  const [retrying, setRetrying] = useState(false);
  // ΤΟ ΑΠΟΤΕΛΕΣΜΑ ΤΗΣ ΝΕΑΣ ΔΟΚΙΜΗΣ ΛΕΓΕΤΑΙ. Με επιτυχία η ειδοποίηση φεύγει μαζί
  // με το κουμπί που είχε την εστίαση: χωρίς αυτά, ο χρήστης πληκτρολογίου
  // βρισκόταν στην αρχή της σελίδας και ο αναγνώστης οθόνης δεν έλεγε τίποτα.
  const retryAsked = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [retryNote, setRetryNote] = useState('');

  const propIds = useMemo(() => properties.map(p => p.id), [properties]);

  const load = useCallback(async (turn: LoadTurn) => {
    // ═══ ΚΑΘΕ ΑΝΑΓΝΩΣΗ ΕΡΧΕΤΑΙ ΜΕ ΤΟ ΣΦΑΛΜΑ ΤΗΣ ═══════════════════════════════
    // Ηταν είκοσι αναγνώσεις που γύριζαν ΜΟΝΟ τα δεδομένα: μια αποτυχία έφτανε
    // στην οθόνη ως άδεια λίστα, δηλαδή «0€» στο Ταμείο και «Δεν εκκρεμεί
    // τίποτα» στην ατζέντα, στην πρώτη οθόνη που βλέπει ο ιδιοκτήτης. Βρέθηκε
    // στην αξιολόγηση της 08/10/2026. Τώρα κάθε αποτυχία έχει όνομα και η οθόνη
    // λέει τι δεν διάβασε, αντί να το παρουσιάζει ως μηδέν.
    const [exp,bil,tsk,ten,ci,iv,ln,hs,allExp,allTen,allRc,rp,mnt,decl,yr,allYearRents,allStays,ownerRows,taxEvents,doneTasks] = await Promise.all([
      expenseStore.ledgerWithError(supabase,prop.id,{ userId, from:`${year}-01-01`, columns:'*' }),
      billStore.ofPropertyWithError<Bill>(supabase,prop.id,'*',userId),
      // Δεν είναι πια πέντε για μια χωριστή κάρτα: τροφοδοτούν την ΕΝΙΑΙΑ
      // ατζέντα, που τις ταξινομεί μαζί με όλα τα υπόλοιπα κατά προθεσμία.
      supabase.from('maintenance_tasks').select('*').eq('property_id',prop.id).eq('user_id',userId).eq('completed',false).order('due_date').limit(60),
      tenantStore.currentAllWithError<Tenant & TenantFull>(supabase,prop.id,'id,monthly_rent,lease_start,lease_end,e_payment',userId),
      checklist.openWithError<{ due_date:string|null; status:string; priority:string }>(supabase,prop.id,checklist.AGENDA_COLUMNS,userId),
      inventory.ofPropertyWithError<{ name?:string|null; warranty_expiry:string|null; condition:string|null }>(supabase,prop.id,'name,warranty_expiry,condition',userId),
      loanStore.ofPropertyWithError(supabase,prop.id,userId),
      stayStore.ofPropertyWithError<HostStay>(supabase,prop.id,stayStore.DECLARABLE_COLUMNS,userId),
      // Χωριστά: ΟΛΕΣ οι δαπάνες (κάθε έτους) για το γράφημα με επιλογή έτους.
      // Οι επαναλαμβανόμενες (πάγιες) προβάλλονται στους επόμενους μήνες/έτη.
      expenseStore.ledgerWithError(supabase,prop.id,{ userId, columns:'amount,date,category,is_recurring,recurring_frequency' }),
      // Μόνο πλήθη (head) για τα πλακίδια-σύνοψη Επαφές / Αρχείο.
      // ΟΛΟ το χαρτοφυλάκιο: ο φόρος ενοικίων είναι προοδευτικός στο ΣΥΝΟΛΟ (Ε1),
      // οπότε δεν αρκούν τα δεδομένα του επιλεγμένου ακινήτου. Ίδια σειρά
      // προτεραιότητας με το resolveRent: μισθωτήριο → actual → target → ακίνητο.
      tenantStore.ofUserWithError<TenRow & tenantStore.TenantStatus & OblTenant>(supabase,userId,'id,monthly_rent,property_id,e_payment,status,move_out_date,lease_start,lease_end'),
      supabase.from('rent_config').select('property_id,actual_rent,target_rent').in('property_id',propIds).eq('user_id',userId),
      // ΤΟ ΤΑΜΕΙΟ. Μόνο οι ΑΠΛΗΡΩΤΕΣ περίοδοι — οι πληρωμένες είναι ιστορικό και
      // ζουν στον Ενοικιαστή. Ό,τι δεν εμφανίζεται, δεν κατεβαίνει.
      // ΚΑΙ ΤΟ `id`: με αυτό η κάρτα του Ταμείου εισπράττει επιτόπου, αντί να
      // στέλνει τον ιδιοκτήτη να ξαναβρεί τη δόση που μόλις του έδειξε.
      rentStore.ofPropertyWithError<{ id:string|null; amount:number|null; due_date:string|null; paid:boolean|null; period_year:number|null; period_month:number|null }>(supabase,prop.id,'id,amount,due_date,paid,period_year,period_month',userId,{ paid:false }),
      supabase.from('inventory_maintenance').select('task,item_name,next_due,est_cost').eq('property_id',prop.id),
      // ΠΟΤΕ ΚΑΤΑΓΡΑΦΗΚΕ Η ΔΗΛΩΣΗ ΜΙΣΘΩΣΗΣ. Η υποχρέωση εμφανιζόταν για ενενήντα
      // μέρες γύρω από την προθεσμία ασχέτως υποβολής, ενώ υποβάλλεται μία φορά.
      // Το LeaseDeclaration γράφει ήδη εδώ· έλειπε μόνο η ανάγνωση.
      supabase.from('activity_log').select('created_at')
        .eq('user_id',userId).eq('action','lease_declaration_submitted').eq('entity_id',prop.id)
        .order('created_at',{ascending:false}).limit(1),
      rentStore.ofPropertyWithError<IncomeRent>(supabase,prop.id,rentStore.INCOME_COLUMNS,userId,{ year }),
      rentStore.ofUserWithError<IncomeRent & { property_id: string }>(supabase,userId,`property_id,${rentStore.INCOME_COLUMNS}`,{ year }),
      stayStore.ofUserWithError<StayAmountLike & { property_id: string }>(supabase,userId,stayStore.PORTFOLIO_COLUMNS),
      profileType === 'professional'
        ? supabase.from('clients').select('id').eq('user_id',userId).eq('type','owner')
        : Promise.resolve({ data: null, error: null }),
      // ΤΙ ΕΚΛΕΙΣΕ ΑΛΛΟΥ. Η δόση ΕΝΦΙΑ που σημειώθηκε πληρωμένη στο Ημερολόγιο ή
      // στις Εκκρεμότητες δεν ξαναεμφανίζεται εδώ (lib/facts/deadlines).
      calendar.sourceStatesWithError(supabase,prop.id,{ prefix:'tax:' }),
      checklist.closedWithError<{ note:string|null; status:string|null }>(supabase,prop.id,'note,status',userId),
    ]);
    // Νεότερη φόρτωση ξεκίνησε στο μεταξύ (ριπή ζωντανών συμβάντων, αλλαγή
    // ακινήτου ή έτους): η παλιά απάντηση δεν γράφει πάνω στη νέα.
    if (!turn.isLatest()) return;
    // Ποια περιοχή δεν διαβάστηκε. Η ετικέτα είναι αυτή που διαβάζει ο χρήστης.
    const failures = readFailures([
      ['Δαπάνες', exp.error], ['Δαπάνες', allExp.error], ['Λογαριασμοί', bil.error],
      ['Ενοίκια', rp.error], ['Ενοίκια', yr.error], ['Ενοίκια', allYearRents.error], ['Ενοίκια', allRc.error],
      ['Ενοικιαστές', ten.error], ['Ενοικιαστές', allTen.error], ['Δάνεια', ln.error],
      ['Διαμονές', hs.error], ['Διαμονές', allStays.error], ['Ιδιοκτήτες', ownerRows.error],
      ['Εκκρεμότητες', tsk.error], ['Εκκρεμότητες', ci.error], [LEASE_DECL_AREA, decl.error],
      [TAX_DEADLINES_AREA, taxEvents.error], [TAX_DEADLINES_AREA, doneTasks.error],
      ['Εξοπλισμός', iv.error], ['Εξοπλισμός', mnt.error],
    ]);
    if (failures.length) captureError(new Error('overview: αποτυχημένες αναγνώσεις'), { failed: failures.join(',') });
    setFailedReads(failures);
    if (retryAsked.current) {
      retryAsked.current = false;
      setRetryNote(failures.length ? 'Η νέα δοκιμή δεν τα φόρτωσε όλα.' : 'Φορτώθηκαν όλα.');
      if (!failures.length) headingRef.current?.focus();
    }
    setClosedTax(closedTaxRefs(taxEvents.rows, doneTasks.rows));
    setExpenses((exp.rows||[]) as Expense[]); setBills(bil.rows); setTasks(tsk.data||[]); setTenant(ten.rows?.[0]||null);
    setRentPeriods(rp.rows); setMaint((mnt.data||[]) as OblMaint[]); setTenantFull(ten.rows?.[0]||null);
    setLeaseDeclaredAt((decl.data?.[0]?.created_at as string|undefined) ?? null);
    setChk(ci.rows); setInv(iv.rows); setLoans(ln.views); setHostStays(hs.rows); setYearRents(yr.rows); setAllExpenses((allExp.rows||[]) as { amount:number; date:string; category:string; is_recurring?:boolean; recurring_frequency?:string|null }[]);
    // ΑΚΡΙΒΩΣ οι στήλες του select('property_id,actual_rent,target_rent') — όχι
    // ολόκληρη η γραμμή του rent_config. Με `any` το `r.property_id` δεν
    // ελεγχόταν καν ως όνομα στήλης.
    // Το `property_id` είναι nullable στο σχήμα (rent_config.property_id uuid,
    // χωρίς NOT NULL — baseline.sql:2722 / RentConfigRow, tables.ts:1018), άρα ο
    // χάρτης συμπεραινόταν ως `Map<string|null, …>`. Η ορφανή ρύθμιση με κλειδί
    // `null` ΔΕΝ επιστρεφόταν ποτέ από το `get(p.id)` παρακάτω (το p.id είναι
    // πάντα string) — ο κίνδυνος είναι ότι ο τύπος του κλειδιού ΕΠΕΤΡΕΠΕ να
    // ρωτήσει κάποιος αργότερα με μια nullable τιμή και να πάρει τη ρύθμιση
    // λάθος ακινήτου. Το κλειδί δηλώνεται `string` και οι ορφανές πετιούνται.
    type RcRow = { property_id: string | null; actual_rent: number | null; target_rent: number | null };
    const rcById = new Map<string, RcRow>();
    ((allRc.data||[]) as RcRow[]).forEach(r => { if (r.property_id) rcById.set(r.property_id, r); });
    // Κρατάμε τον ΜΕΓΑΛΥΤΕΡΟ ενοικιαστή ανά ακίνητο, μαζί με τον τρόπο είσπραξής
    // ΤΟΥ: αλλιώς θα ζευγαρώναμε το ενοίκιο του ενός με τη δήλωση του άλλου.
    // `e_payment !== false` και όχι `=== true`: κενή στήλη σημαίνει «δεν το έχει
    // δηλώσει» και η προεπιλογή της ίδιας της φόρμας είναι τραπεζική είσπραξη.
    // ΚΑΙ ΜΟΝΟ ΟΣΟΙ ΜΕΝΟΥΝ ΑΚΟΜΗ. Εδώ δεν υπήρχε κανένα φίλτρο κατάστασης: το
    // ενοίκιο μισθωτή που έφυγε πέρσι έμπαινε στη φορολογική ενοποίηση όλου του
    // χαρτοφυλακίου και μαζί του ο τρόπος είσπραξής του.
    setLeavers(allTen.rows.filter(t=>t.property_id===prop.id && !!t.move_out_date));
    const tenById = new Map<string,{ monthly:number; viaBank:boolean }>();
    allTen.rows.filter(t=>!tenantStore.hasLeft(t)).forEach(t=>{
      const v = Number(t.monthly_rent)||0;
      if (v > (tenById.get(t.property_id)?.monthly ?? 0)) tenById.set(t.property_id, { monthly: v, viaBank: t.e_payment !== false });
    });
    setPortfolioRents(properties.map(p => {
      const rc = rcById.get(p.id);
      const fromTenant = tenById.get(p.id);
      const monthly = fromTenant?.monthly || Number(rc?.actual_rent) || Number(rc?.target_rent) || Number(p.target_rent) || 0;
      // Χωρίς ενοικιαστή δεν υπάρχει δηλωμένος τρόπος είσπραξης: το ενοίκιο
      // είναι στόχος, όχι πραγματική είσπραξη και η προεπιλογή είναι τράπεζα.
      return { property_id: p.id, monthly, viaBank: fromTenant?.viaBank ?? true };
    }));
    setPortfolioIncome({
      rents: allYearRents.rows, stays: allStays.rows,
      owners: ownerRows.data ? new Set((ownerRows.data as { id: string }[]).map(r => r.id)) : null,
    });
    setLoadedFor(`${prop.id}|${year}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prop.id, userId, year, propIds, profileType]);

  // Η ΣΗΜΑΙΑ ΦΟΡΤΩΣΗΣ ΜΠΑΙΝΕΙ ΜΕΣΑ ΣΤΗΝ ΑΛΥΣΙΔΑ, ΟΧΙ ΠΡΙΝ ΑΠΟ ΑΥΤΗΝ. Γραμμένη
  // στο σώμα του effect, προκαλεί δεύτερη απόδοση ΠΡΙΝ καν ξεκινήσει το αίτημα.
  // Μέσα στην ασύγχρονη συνάρτηση κάνει την ίδια δουλειά, χωρίς την επιπλέον
  // απόδοση και σταματά να ενοχλεί τον κανόνα set-state-in-effect.
  // Η πρώτη φόρτωση δεν ανήκει στο effect του καναλιού: δύο δουλειές, δύο σώματα.
  // Η `reload` συγχωνεύει τις ριπές των ζωντανών συνδρομών σε μία φόρτωση.
  const reload = useLoad(load);

  useEffect(() => {
    // Real-time: κάθε αλλαγή σε άλλα tabs ενημερώνει ζωντανά την Επισκόπηση
    const ch = supabase.channel(`overview_${prop.id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'bills',             filter:`property_id=eq.${prop.id}` }, () => { void reload(); })
      .on('postgres_changes', { event:'*', schema:'public', table:'expenses',          filter:`property_id=eq.${prop.id}` }, () => { void reload(); })
      .on('postgres_changes', { event:'*', schema:'public', table:'tenants',           filter:`property_id=eq.${prop.id}` }, () => { void reload(); })
      .on('postgres_changes', { event:'*', schema:'public', table:'maintenance_tasks', filter:`property_id=eq.${prop.id}` }, () => { void reload(); })
      .on('postgres_changes', { event:'*', schema:'public', table:'checklist_items',   filter:`property_id=eq.${prop.id}` }, () => { void reload(); })
      .on('postgres_changes', { event:'*', schema:'public', table:'loans',             filter:`property_id=eq.${prop.id}` }, () => { void reload(); })
      .on('postgres_changes', { event:'*', schema:'public', table:'client_stays',       filter:`property_id=eq.${prop.id}` }, () => { void reload(); })
      .on('postgres_changes', { event:'*', schema:'public', table:'inventory_items',     filter:`property_id=eq.${prop.id}` }, () => { void reload(); })
      .on('postgres_changes', { event:'*', schema:'public', table:'contacts',            filter:`property_id=eq.${prop.id}` }, () => { void reload(); })
      .on('postgres_changes', { event:'*', schema:'public', table:'property_documents',  filter:`property_id=eq.${prop.id}` }, () => { void reload(); })
      .on('postgres_changes', { event:'*', schema:'public', table:'rent_payments',        filter:`property_id=eq.${prop.id}` }, () => { void reload(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prop.id, reload]);

  // ── ΜΙΑ ΔΑΠΑΝΗ, ΕΝΑ ΣΥΝΟΛΟ, ΣΕ ΟΛΕΣ ΤΙΣ ΟΘΟΝΕΣ ──────────────────────────
  // Εδώ αθροίζονταν ΜΟΝΟ οι γραμμές του πίνακα `expenses`. Ο απλήρωτος
  // λογαριασμός όμως δεν έχει δαπάνη πίσω του — η δαπάνη γεννιέται στην πληρωμή.
  // Άρα το ίδιο ευρώ μετρούσε στις «Δαπάνες» και στη «Σύγκριση», δεν μετρούσε
  // εδώ, αλλά μετρούσε στο «Χρωστάω» της ΙΔΙΑΣ οθόνης, τετρακόσια εικονοστοιχεία
  // πιο πάνω. Το lib/expenses/ledger.ts γράφτηκε ακριβώς γι’ αυτό, με το σχόλιο
  // «τρεις οθόνες, τρία διαφορετικά σύνολα» — και η Επισκόπηση δεν το κάλεσε ποτέ.
  const ledger = useMemo(() => mergeLedger(bills, expenses), [bills, expenses]);
  // ΤΟ ΕΤΟΣ ΚΟΒΕΤΑΙ ΕΔΩ, ΓΙΑΤΙ ΤΟ ΕΡΩΤΗΜΑ ΤΩΝ ΛΟΓΑΡΙΑΣΜΩΝ ΔΕΝ ΤΟ ΚΟΒΕΙ.
  // Οι δαπάνες ζητούνται με `gte('date', 1η Ιανουαρίου)`· οι λογαριασμοί χωρίς
  // κανένα φίλτρο. Άρα το «ως σήμερα» του 2026 περιείχε και απλήρωτο λογαριασμό
  // του 2024. Το φίλτρο μπαίνει πάνω στο ημερολόγιο και όχι στο ερώτημα, ώστε να
  // χρησιμοποιεί ΤΗΝ ΙΔΙΑ ημερομηνία που μετρά το ίδιο το ημερολόγιο — ο
  // λογαριασμός χωρίς προθεσμία παίρνει την ημερομηνία δημιουργίας, κάτι που
  // ένα `gte('due_date')` στον διακομιστή θα το πετούσε σιωπηλά έξω.
  // ΚΑΙ ΧΩΡΙΣ ΤΟΝ ΔΙΑΚΟΠΤΗ «ΜΕΤΡΑ ΣΤΑ ΣΤΑΤΙΣΤΙΚΑ». Τα σύνολα του έτους είναι
  // χρήματα που πληρώθηκαν ή οφείλονται: Επισκόπηση, Δαπάνες, Αποδόσεις και
  // Λογιστική τα λένε ίδια (10.159,70€ στο demo, όχι 10.128,50€ στη μία από
  // τις τέσσερις). Ο διακόπτης κρίνει τις συγκρίσεις μηνών στις Δαπάνες.
  const entriesOfYear = useMemo(
    () => ledger.entries.filter(e => e.date.startsWith(`${year}-`)),
    [ledger.entries, year]);
  // ── ΟΙ ΔΑΠΑΝΕΣ ΤΟΥ ΕΤΟΥΣ ΑΠΟ ΤΟ lib/facts (05.10.2026) ────────────────────
  // Πληρωμένες ως σήμερα + προγραμματισμένες έως 31/12 (+ ληξιπρόθεσμες): ο ίδιος
  // ορισμός με το Χαρτοφυλάκιο, τις Αποδόσεις, τη Λογιστική και τη Νόα.
  const yExp = yearExpensesOf(ledger.entries, year, todayAthens);
  // Ο ΕΝΦΙΑ ΤΟΥ ΕΤΟΥΣ ΑΠΟ ΤΗΝ ΙΔΙΑ ΠΗΓΗ ΜΕ ΤΗ ΛΟΓΙΣΤΙΚΗ. Τα στοιχεία του ακινήτου
  // έγραφαν «Εκτιμώμενος ΕΝΦΙΑ» με το ωμό `enfia` της καρτέλας: άλλο ποσό από
  // την Κατάσταση όταν ο πίνακας ΕΝΦΙΑ είχε φετινό ή περσινό και λάθος όνομα όταν
  // το ποσό ήταν του εκκαθαριστικού. Η ετικέτα λέει πλέον από πού βγήκε.
  const [enfiaSettings] = useEnfiaSettings(prop.id, userId);
  const enfiaNow = enfiaYear(enfiaSettings, year, {
    stored: prop.enfia, value: prop.value, objValue: prop.obj_value == null ? null : Number(prop.obj_value),
    sqm: prop.sqm, yearBuilt: prop.year_built, floor: prop.floor,
    propType: prop.prop_type, ownershipPct: prop.ownership == null ? null : Number(prop.ownership), postalCode: prop.postal_code,
  });
  const totalExpYear = yExp.total;
  // ── «ΩΣ ΣΗΜΕΡΑ» ΣΗΜΑΙΝΕΙ ΩΣ ΣΗΜΕΡΑ ──────────────────────────────────────
  // Το φίλτρο κρατούσε μόνο το έτος, οπότε ο λογαριασμός ρεύματος που λήγει σε
  // έναν μήνα μετρούσε στο «1.890,00€ ως σήμερα» ενώ ως σήμερα ήταν 1.821,00€.
  // Δύο σύνολα με δύο ονόματα: το έτος (για προβολή και αναφορά) και το ως
  // σήμερα (για τον υπότιτλο, τη Νόα και τα ευρήματα που διαιρούν με μήνες).
  const totalExpToDate = yExp.paid + yExp.overdue;
  // Οι πέντε μεγαλύτερες κατηγορίες του έτους για την αναφορά PDF και οι
  // υπόλοιπες μαζί ως «Λοιπές» (02.10.2026): με σκέτες τις πέντε, το «Σύνολο
  // δαπανών» του πίνακα δεν έβγαινε ίσο με τις «Συνολικές δαπάνες» από πάνω. Παράγονται
  // από το ΙΔΙΟ ημερολόγιο με το ποσό που τυπώνεται δίπλα τους — πριν έβγαιναν
  // από τον σκέτο πίνακα δαπανών, οπότε το άθροισμα των γραμμών δεν έβγαζε το
  // σύνολο που έγραφε η ίδια η αναφορά από πάνω.
  const catEntries = useMemo(() => {
    const m: Record<string, number> = {};
    entriesOfYear.forEach(e => { m[e.category] = (m[e.category] || 0) + e.amount; });
    const all = Object.entries(m).sort((a, b) => b[1] - a[1]);
    if (all.length <= 6) return all;
    const rest = all.slice(5).reduce((s, [, v]) => s + v, 0);
    return [...all.slice(0, 5), ['Λοιπές', rest] as [string, number]];
  }, [entriesOfYear]);
  // ΤΑΣΗ ΔΑΠΑΝΩΝ: ΙΔΙΟ ΔΙΑΣΤΗΜΑ, ΟΧΙ ΟΛΟΚΛΗΡΟ ΤΟ ΠΡΟΗΓΟΥΜΕΝΟ ΕΤΟΣ.
  // Πριν, το YTD (π.χ. δύο μήνες) συγκρινόταν με τους δώδεκα μήνες της περσινής
  // χρονιάς, οπότε κάθε Φεβρουάριο ο χρήστης διάβαζε «−78% σε σχέση με πέρσι» —
  // αριθμός που δεν έλεγε τίποτα για τη συμπεριφορά του, μόνο ότι ο χρόνος μόλις
  // ξεκίνησε. Τώρα συγκρίνονται Ιαν–τρέχων μήνας με Ιαν–ίδιο μήνα πέρσι.
  // Η ΧΡΟΝΙΑ ΚΑΙ Ο ΜΗΝΑΣ ΔΙΑΒΑΖΟΝΤΑΙ ΩΣ ΚΕΙΜΕΝΟ. Εδώ γραφόταν
  // `new Date(e.date).getFullYear()`: ανάγνωση σε UTC, ερώτηση σε τοπική ώρα.
  // Η δαπάνη της 1ης Ιανουαρίου έφευγε από τη χρονιά της για κάθε χρήστη σε
  // ζώνη με αρνητική απόκλιση — και ο κώδικας τρέχει στον περιηγητή ΤΟΥ.
  const expThisY = allExpenses.filter(e => isoYear(e.date) === year).reduce((s,e)=>s+e.amount,0);
  const expPrevSame = allExpenses.filter(e => isoYear(e.date) === year-1 && (isoMonth(e.date) ?? 13) <= month).reduce((s,e)=>s+e.amount,0);
  const expDeltaPct = expPrevSame > 0 ? Math.round((expThisY - expPrevSame)/expPrevSame*100) : null;
  // Διαχωρισμός πληρωμένων/εκκρεμών: το σύνολο (accrual) οδηγεί την απόδοση, αλλά
  // δείχνουμε ξεχωριστά τι έχει πληρωθεί και τι εκκρεμεί (π.χ. σαρωμένοι λογαριασμοί).
  // Single source of truth: ίδιος υπολογισμός ενοικίου/αξίας/απόδοσης παντού.
  const rentRes = resolveRent({ tenantRent: tenant?.monthly_rent, targetRent: prop.target_rent });
  const rent = rentRes.value;
  // ΤΟ ΕΝΟΙΚΙΟ ΑΠΟ ΤΟΝ ΣΤΟΧΟ ΕΙΝΑΙ ΕΚΤΙΜΗΣΗ ΚΑΙ ΤΟ ΛΕΕΙ. Χωρίς ενοικιαστή το
  // `resolveRent` πέφτει στον στόχο και τα πλακίδια έγραφαν «Έσοδα από
  // ενοίκια 7.440,00€» και φόρο πάνω σε αυτό, ενώ η ατζέντα της ίδιας οθόνης
  // ζητούσε «Πρόσθεσε ενοικιαστή». Το Χαρτοφυλάκιο το σημειώνει ήδη «εκτίμηση».
  const rentIsTarget = rentRes.source === 'target';
  const propValue = resolveValue(prop.value, prop.obj_value).value;
  // ══ ΤΑ ΕΣΟΔΑ ΤΟΥ ΑΚΙΝΗΤΟΥ ΕΙΝΑΙ ΟΣΑ ΕΙΣΠΡΑΧΘΗΚΑΝ, ΟΧΙ ΤΟ ΕΝΟΙΚΙΟ × 12 ══════
  // Η απόδοση εδώ ήταν ενοίκιο ενοικιαστή ή στόχος × 12. Βραχυχρόνιο χωρίς
  // στόχο έβγαινε 0,00% ενώ το Χαρτοφυλάκιο έδειχνε 6,60% για το ίδιο ακίνητο.
  // Τώρα, όπου υπάρχουν διαμονές ή δόσεις, μετρά ο ΚΟΙΝΟΣ υπολογισμός με το
  // Χαρτοφυλάκιο (lib/income/propertyIncome.ts) σε ετήσιο ρυθμό. Χωρίς καμία
  // καταγραφή μένει το ενοίκιο × 12, με την ίδια σήμανση εκτίμησης όπως πριν.
  // ΤΑ ΕΣΟΔΑ ΑΠΟ ΤΟ lib/facts. Χωρίς μίσθωση δεν υπάρχει εκτίμηση από ξεχασμένο
  // μίσθωμα· με μίσθωση η βάση είναι το συμφωνημένο μίσθωμα × 12 και ο ετήσιος
  // ρυθμός των διαμονών λέγεται «εκτίμηση», γιατί είναι προβολή.
  // ΤΟ ΕΣΟΔΟ ΤΗΣ ΑΠΟΔΟΣΗΣ ΕΙΝΑΙ ΕΝΑ ΚΑΙ ΤΟ ΙΔΙΟ ΜΕ ΤΙΣ ΑΠΟΔΟΣΕΙΣ (07.10.2026,
  // lib/facts/income: `yieldIncome`). Με μίσθωση, το μίσθωμα × 12 («αναμενόμενα
  // με βάση τη μίσθωση»)· οι δόσεις ως σήμερα είναι το ταμείο, δίπλα. Πριν, οι
  // Αποδόσεις έβγαζαν την απόδοση από τις δόσεις σε ετήσιο ρυθμό.
  const fi = rentIncome({ status: propertyStatus(prop), rents: yearRents, stays: hostStays, year, today: todayAthens,
    value: propValue, estimateMonthly: tenant?.monthly_rent });
  const yi = yieldIncome(fi);
  const inc = { source: fi.source, receivedToDate: fi.received, estimated: fi.estimated };
  const incomeRecorded = yi.basis !== 'none';
  const fromLease = yi.basis === 'lease';
  const incomeMonthly = incomeRecorded ? yi.annual / 12 : rent;
  const incomeIsEstimate = incomeRecorded ? yi.estimated : rentIsTarget;
  // Δάνεια: εκτιμώμενη μηνιαία δόση και δείκτης δανείου προς αξία (η Επισκόπηση «ξέρει» πλέον τα δάνεια).
  // ΜΙΑ ΓΡΑΦΗ ΓΙΑ ΤΗ ΔΟΣΗ: η ίδια συνάρτηση με τον Προϋπολογισμό, με το ίδιο
  // φίλτρο ενεργών. Εδώ αθροιζόταν `annuityMonthly` σε ΟΛΑ τα δάνεια· το
  // ξεπληρωμένο χρέωνε δόση που δεν υπάρχει.
  const monthlyDebt = loansInstalmentTotal(loans);
  const hasActiveLoan = loans.some(isActiveLoan);
  // ΤΟ ΥΠΟΛΟΙΠΟ, ΟΧΙ ΤΟ ΑΡΧΙΚΟ ΚΕΦΑΛΑΙΟ. Ο δείκτης διαιρούσε το ποσό που
  // δόθηκε πριν από χρόνια με τη σημερινή αξία, σαν να μην είχε πληρωθεί καμία
  // δόση. Με ημερομηνία έναρξης μετρά το ανεξόφλητο υπόλοιπο· χωρίς αυτήν, η
  // ετικέτα λέει ρητά ότι πρόκειται για το αρχικό ποσό.
  const debtKnownAge = loans.every(l => !!l.start_date && !isNaN(Date.parse(l.start_date)) && (l.years||0) > 0);
  const totalDebt = loans.reduce((s,l)=>{
    const started = l.start_date ? Date.parse(l.start_date) : NaN;
    if (isNaN(started) || !(l.years||0)) return s + (l.amount||0);
    const elapsed = Math.max(0, (Date.parse(todayAthens) - started) / (365.25 * 864e5));
    return s + remainingBalance(l.amount||0, l.rate||0, l.years||0, elapsed);
  },0);
  const debtLtv = propValue>0 && totalDebt>0 ? (totalDebt/propValue)*100 : 0;
  // Έσοδα φιλοξενίας από το Πελατολόγιο (διαμονές συνδεδεμένες σε αυτό το ακίνητο): η
  // Επισκόπηση «ξέρει» πλέον τα πραγματικά έσοδα βραχυχρόνιας, όχι μόνο τον στόχο ενοικίου.
  const todayIso = athensToday();
  // ΕΙΣΠΡΑΞΕΙΣ ΦΙΛΟΞΕΝΙΑΣ ΑΠΟ ΤΟ lib/facts (05.10.2026). Το payout (ό,τι μπήκε
  // στον λογαριασμό) και το δηλωτέο βγαίνουν από τις ΙΔΙΕΣ διαμονές με το ΙΔΙΟ
  // κλάσμα νυχτών του έτους. Πριν, το πλακίδιο μετρούσε τις διαμονές με άφιξη
  // μέσα στο έτος και τα έσοδα τις νύχτες του έτους: η κράτηση της Πρωτοχρονιάς
  // έπεφτε αλλού σε κάθε αριθμό.
  const hosting = hostingReceipts(hostStays, year, todayAthens);
  const hostingYTD = hosting.payout;
  const hostingNights = hosting.nights;
  const nextArrival = hostStays.map(s=>s.check_in).filter((d): d is string => !!d && d>=todayIso).sort()[0] || null;
  // ── ΟΙ ΔΑΠΑΝΕΣ ΤΗΣ ΧΡΟΝΙΑΣ, ΧΩΡΙΣ ΠΡΟΒΟΛΗ (05.10.2026) ────────────────────
  // Εδώ ζούσε μια «ετήσια προβολή»: πάγιες × επαναλήψεις + απλήρωτοι. Ήταν
  // άλλο νούμερο από το πλακίδιο και από κάθε άλλη οθόνη και η καθαρή απόδοση
  // στηριζόταν σε αυτό. Τώρα η χρονιά είναι ό,τι έχει καταχωρηθεί γι' αυτήν:
  // πληρωμένες ως σήμερα + προγραμματισμένες έως 31/12 (lib/facts/expenses.ts).
  const projectedExpYear = yExp.total;
  // ── Η ΠΡΟΜΗΘΕΙΑ ΤΗΣ ΠΛΑΤΦΟΡΜΑΣ, ΜΙΑ ΦΟΡΑ (07.10.2026) ─────────────────────
  // Το `platform_fee` κάθε διαμονής δεν έμπαινε πουθενά εδώ: η καθαρή απόδοση και
  // το «Καθαρό αποτέλεσμα» έβγαιναν σαν η πλατφόρμα να μην κράτησε τίποτα, ενώ οι
  // Αποδόσεις αφαιρούσαν προμήθεια. Ο κανόνας ζει στο lib/facts/platformFees: οι
  // μήνες με δική σου δαπάνη προμήθειας μετρούν από τη δαπάνη (είναι ήδη στις
  // «Δαπάνες έτους»), οι υπόλοιποι από τις διαμονές, στον ρυθμό του εσόδου. Το
  // πλακίδιο των δαπανών μένει ίδιο με τις άλλες οθόνες· η προμήθεια φαίνεται
  // χωριστά. Το δηλωτέο και ο φόρος μένουν στο ακαθάριστο.
  const stayFees = yieldPlatformFees(fi, hostStays, { year, today: todayAthens, expenses: yExp.entries });
  const costs = yieldCosts({ recorded: yExp.total, recordedCategories: yExp.entries.map(e => e.category), stayFees: stayFees.annual });
  // ── ΤΑ ΔΥΟ «ΚΑΘΑΡΑ» ΜΕ ΤΗΝ ΙΔΙΑ ΒΑΣΗ ΔΑΠΑΝΩΝ ───────────────────────────
  // Η καθαρή απόδοση αφαιρούσε από το ετήσιο ενοίκιο τις δαπάνες ΩΣ ΣΗΜΕΡΑ,
  // ενώ το «Καθαρό αποτέλεσμα» ακριβώς από πάνω τις δαπάνες ΟΛΟΥ του έτους:
  // «καθαρή 3,00%» αντιστοιχούσε σε 5.550€, όχι στα 4.490€ του πλακιδίου.
  // Τώρα και τα δύο πατούν στην ίδια προβολή έτους· η απόδοση μένει προ φόρου.
  const { annualRent, grossYield, netYield } = computeYields(incomeMonthly, propValue, costs.total);

  // ΜΕΣΟΣ ΟΡΟΣ ΑΝΑ ΤΥΠΟ ΛΟΓΑΡΙΑΣΜΟΥ, ΥΠΟΛΟΓΙΣΜΕΝΟΣ. Η κάρτα λεγόταν «Μέσοι
  // λογαριασμοί» και έδειχνε το ποσό του τελευταίου. Ο μέσος όρος βγαίνει από
  // τις γραμμές που ήδη έχουμε φορτώσει: καμία επιπλέον κλήση, καμία δεύτερη
  // πηγή και το πλήθος γράφεται δίπλα ώστε να φαίνεται σε τι στηρίζεται.
  //
  // ΚΑΙ Ο ΙΔΙΟΣ ΜΕ ΤΟΥΣ ΛΟΓΑΡΙΑΣΜΟΥΣ. Εδώ υπολογιζόταν αριθμητικός μέσος ΑΝΑ
  // ΛΟΓΑΡΙΑΣΜΟ σε όλα τα έτη, μαζί με τους μελλοντικούς απλήρωτους: «Ρεύμα (5)
  // 71,40€». Η οθόνη των Λογαριασμών έγραφε για τα ίδια δεδομένα «34,50€ τον
  // μήνα, από 4 λογαριασμούς». Τώρα διαβάζεται η ίδια μηχανή (`contractOverview`,
  // διάμεσος ανά μήνα, ο διμηνιαίος μοιρασμένος στους μήνες του).
  // Χωρίς `useMemo`: ο μεταγλωττιστής της React το απομνημονεύει μόνος του.
  const billAverages = contractOverview(ledger.entries, new Date(`${todayAthens}T12:00:00`))
    .filter(c => c.known && c.monthly != null)
    .map(c => ({ type: c.label, monthly: c.monthly as number, count: c.occurrences }))
    .sort((a, b) => b.monthly - a.monthly);

  // ── Σύνοψη εκκρεμοτήτων για τα πλακίδια ────────────────────────────────────
  // ΑΦΑΙΡΕΘΗΚΕ ο πίνακας `alerts`: 25 γραμμές που κατασκεύαζαν επτά ειδοποιήσεις
  // από τη βάση (λογαριασμοί, εργασίες, checklist, εγγυήσεις, κατάσταση
  // εξοπλισμού) και ΔΕΝ αποδίδονταν πουθενά. Τη δουλειά της «τι χρειάζεται τώρα»
  // την κάνει το InsightsBoard (computeInsights) και το ObligationsPanel· αυτός
  // ο πίνακας ήταν τρίτη, αόρατη μηχανή που πλήρωνε ερωτήματα χωρίς αποδέκτη.
  // Μένουν μόνο τα μεγέθη που εμφανίζονται πραγματικά στα πλακίδια.
  // Ιδια πολιτική με τις άλλες οθόνες, γραμμένη μία φορά (lib/core/time).
  const openChk = chk.length;

  // ── ΦΟΡΟΣ: ΕΝΑΣ ΦΟΡΟΛΟΓΟΥΜΕΝΟΣ, ΟΧΙ ΤΡΕΙΣ ────────────────────────────────
  // Πριν: rentalIncomeTax(annualRent) ανά ακίνητο. Ο ιδιοκτήτης τριών
  // διαμερισμάτων με 8.000€ έκαστο έβλεπε 3 × 1.140€ = 3.420€ αντί για τον
  // πραγματικό φόρο των 24.000€ (4.500€) — υποεκτίμηση 1.080€, με τίτλο
  // «Εκτιμώμενος Φόρος». Τώρα ο φόρος υπολογίζεται μία φορά στο σύνολο του
  // χαρτοφυλακίου και εμφανίζεται το μερίδιο αυτού του ακινήτου, με την εξήγηση
  // από κάτω. Το ενοίκιο του τρέχοντος ακινήτου έρχεται από το resolveRent, ώστε
  // ο φόρος να πατά πάνω στον ίδιο αριθμό που δείχνει το πλακίδιο.
  // ΧΩΡΙΣ ΧΕΙΡΟΚΙΝΗΤΗ ΑΠΟΜΝΗΜΟΝΕΥΣΗ. Το `useMemo` εδώ ΔΕΝ διατηρούνταν από τον
  // μεταγλωττιστή της React: το ανέφερε ρητά («existing memoization could not be
  // preserved») και, επειδή δεν μπορούσε να το κρατήσει, παρέλειπε τη
  // βελτιστοποίηση ΟΛΟΚΛΗΡΟΥ του component. Δηλαδή μια χειροκίνητη απομνημόνευση
  // που υποτίθεται ότι κερδίζει χρόνο κόστιζε τη βελτιστοποίηση των πάντων γύρω
  // της. Ο υπολογισμός είναι καθαρός και ο μεταγλωττιστής τον απομνημονεύει μόνος.
  // ΑΝΑ ΦΟΡΟΛΟΓΟΥΜΕΝΟ ΚΑΙ ΜΕ ΤΑ ΕΣΟΔΑ ΤΟΥ ΚΟΙΝΟΥ ΥΠΟΛΟΓΙΣΜΟΥ. Τα άλλα ακίνητα
  // μετρούσαν το μηνιαίο του μισθωτηρίου ή του στόχου × 12 και σε λογαριασμό
  // επαγγελματία ανακατεύονταν ιδιοκτήτες. Τώρα: ίδιος φορολογούμενος
  // (client_id), έσοδα από δόσεις και διαμονές, όπως και οι Αποδόσεις.
  const portfolioTax = consolidateRentTax(
    taxpayerRentSources({
      props: properties,
      current: { id: prop.id, annualRent: incomeMonthly * 12, shortTerm: isShortTerm(prop), rentsPaidViaBank: tenantFull?.e_payment !== false },
      ownerClientIds: taxpayerScope(profileType, portfolioIncome.owners),
      income: new Map(properties.map(p => {
        const row = portfolioRents.find(r => r.property_id === p.id);
        return [p.id, {
          rents: portfolioIncome.rents.filter(r => r.property_id === p.id),
          stays: portfolioIncome.stays.filter(st => st.property_id === p.id),
          estimateMonthly: row?.monthly ?? 0,
          viaBank: row?.viaBank ?? true,
        }];
      })),
      year, today: todayAthens,
    }),
    undefined, year,
  );
  // Χωρίς `Math.round`: 1.060,20€ γραφόταν «1.060,00€», λεπτά που δεν υπάρχουν.
  // Η στρογγυλοποίηση ανήκει στην εμφάνιση, που ήδη γράφει δύο δεκαδικά.
  // Ο φόρος βγαίνει στο ποσοστό συνιδιοκτησίας· τα πλακίδια δείχνουν όλο το
  // ακίνητο, οπότε ο αριθμός ανάγεται στο ακίνητο με τον ίδιο συντελεστή.
  const estTax = wholePropertyTax(taxShareOf(portfolioTax, prop.id), ownershipPctOf(prop));
  // ΕΝΑ ΝΟΥΜΕΡΟ ΠΡΩΤΟ (02.10.2026). Η Επισκόπηση άνοιγε με ημερομηνία και
  // κουμπί PDF· ο πρώτος αριθμός ήταν κάτω από τη Νόα. Ο ίδιος υπολογισμός με
  // το πλακίδιο «Καθαρό αποτέλεσμα»: σε ακίνητο με έσοδα το καθαρό, αλλιώς οι
  // δαπάνες της χρονιάς.
  const heroIsNet = isLet(prop);
  const heroValue = heroIsNet ? annualRent - costs.total - estTax : projectedExpYear;
  // ΜΙΣΟ ΣΥΝΟΛΟ ΔΙΑΒΑΖΕΤΑΙ ΣΑΝ ΟΛΟΚΛΗΡΟ. Αν δεν διαβάστηκε έστω μία περιοχή με
  // ποσά, κανένα σύνολο της οθόνης δεν είναι αληθινό: το κεντρικό ποσό γίνεται
  // «—», το Ταμείο και η ζώνη της χρονιάς κρύβονται και το PDF περιμένει.
  const moneyGap = moneyIncomplete(failedReads);
  // Οι μέσοι όροι λογαριασμών βγαίνουν από το ημερολόγιο (λογαριασμοί και
  // δαπάνες μαζί). Περιμένουν μόνο αυτές τις δύο αναγνώσεις, όχι τα ενοίκια.
  const ledgerGap = failedReads.includes('Λογαριασμοί') || failedReads.includes('Δαπάνες');
  const taxNote = consolidationSummary(portfolioTax, fmtEur);
  // Εισπράττεται το ενοίκιο ΑΥΤΟΥ του ακινήτου μέσω τράπεζας; Κρίνει το κείμενο
  // δίπλα στον φόρο, όπως ο ίδιος έλεγχος κρίνει και το ποσό.
  const rentViaBank = tenantFull?.e_payment !== false;

  // ── ΤΟ ΤΑΜΕΙΟ ─────────────────────────────────────────────────────────────
  // Τι μου χρωστάνε (ληξιπρόθεσμες περίοδοι ενοικίου) και τι χρωστάω (απλήρωτοι
  // λογαριασμοί και δαπάνες). Η ΜΟΝΗ πηγή για τα «Εκκρεμείς δαπάνες», που πριν
  // ήταν χωριστό πλακίδιο πιο κάτω στην ίδια οθόνη.
  // ΑΠΟ ΤΟ ΙΔΙΟ ΗΜΕΡΟΛΟΓΙΟ ΜΕ ΤΟ ΠΛΑΚΙΔΙΟ ΤΩΝ ΔΑΠΑΝΩΝ, τετρακόσια εικονοστοιχεία
  // πιο κάτω. Εδώ περνούσαν οι ωμοί πίνακες `bills` και `expenses` και
  // προστίθεντο: η σάρωση παραστατικού γράφει ΚΑΙ λογαριασμό ΚΑΙ δαπάνη με
  // `bill_id` και οι δύο απλήρωτες, οπότε ένας λογαριασμός ΔΕΗ 84,50€ έβγαινε
  // 169,00€ — στο πρώτο νούμερο που βλέπει ο ιδιοκτήτης όταν ανοίγει το ακίνητο,
  // ενώ η ίδια οθόνη πιο κάτω έδειχνε το σωστό.
  //
  // ΧΩΡΙΣ ΦΙΛΤΡΟ ΕΤΟΥΣ, επίτηδες: ο απλήρωτος λογαριασμός του περασμένου
  // Δεκεμβρίου εξακολουθεί να είναι οφειλή τον Ιανουάριο.
  //
  // Το `due` πέφτει πίσω στην ημερομηνία της γραμμής, γιατί η σκέτη δαπάνη δεν
  // έχει προθεσμία: χωρίς αυτό, καμία απλήρωτη δαπάνη δεν θα μετρούσε ποτέ ως
  // ληξιπρόθεσμη.
  const cash = useMemo(() => cashPosition({
    rent: rentPeriods,
    payables: ledger.entries.map(e => ({
      amount: e.amount, due: e.due ?? e.date, paid: e.paid, label: e.title,
    })),
    today: todayIso,
  }), [rentPeriods, ledger, todayIso]);

  // Ποιες ληξιπρόθεσμες γραμμές ξέρουν τη δόση τους — δηλαδή ποιες εισπράττονται
  // από την ίδια την κάρτα. Χωρίς καμία τέτοια, το κουμπί δεν εμφανίζεται:
  // ενέργεια που δεν έχει τι να γράψει είναι ψεύτικη υπόσχεση.
  const receivableRent = useMemo(() => receivableLines(cash.owedToMe.lines), [cash]);

  // ── ΤΑ ΝΟΥΜΕΡΑ ΠΟΥ ΔΙΝΟΥΜΕ ΣΤΗ ΝΟΑ ───────────────────────────────────────
  // Ίδια δομή με αυτήν που φτιάχνει ο ίδιος ο βοηθός (PropertyAssistant), γιατί
  // την παράγει η ίδια μηχανή (lib/assistant/openers.ts) και ο κανόνας της είναι
  // ένας: κανένα νούμερο που δεν υπάρχει. Γι' αυτό `null` όσο φορτώνει — ο
  // χαιρετισμός τότε λέει «κοιτάζω τα στοιχεία σου», όχι «δεν έχεις τίποτα».
  //
  // Χωρίς useMemo: είναι εννέα αναθέσεις πεδίων σε ένα αντικείμενο — ο
  // μεταγλωττιστής του React το απομνημονεύει μόνος του και μια χειροκίνητη
  // απομνημόνευση εδώ τον εμποδίζει να βελτιστοποιήσει ΟΛΟ το component.
  const assistantCtx: OpenerContext | null = loading ? null : {
    propertyName: prop.name,
    monthlyRent: rent || undefined,
    propertyValue: propValue || undefined,
    expensesYtd: totalExpToDate || undefined,
    openTasks: openChk,
    overdueRent: cash.owedToMe.overdue || undefined,
    hasLoan: loans.length > 0,
    isShortTerm: isShortTerm(prop),
    propertyCount: properties.length || undefined,
  };

  // ── Έξυπνα insights: ο «σύμβουλος» διαβάζει τα δεδομένα και προτεραιοποιεί ──
  const insights = computeInsights({
    now: now.getTime(),
    property: prop, tenant, rent, propValue, grossYield, netYield,
    expensesYTD: totalExpToDate,
    expenses,
    bills: bills.map(b => ({ category:b.category, type:b.type, amount:b.amount, paid:b.paid, due_date:b.due_date })),
    tasks: tasks.map(t => ({ due_date: t.due_date })),
    checklist: chk,
    inventory: inv,
    // ΗΤΑΝ ΣΤΑΘΕΡΑ ΜΗΔΕΝ. Το `monthlyDebt` υπολογίζεται τρεις δεκάδες γραμμές
    // πιο πάνω και το δείχνει ήδη η ίδια οθόνη· ο σύμβουλος όμως έπαιρνε μηδέν
    // και μιλούσε για αποδόσεις σε ιδιοκτήτη που πληρώνει δόση.
    loanPayment: monthlyDebt,
  });

  // ── ΤΑ ΒΗΜΑΤΑ ΡΥΘΜΙΣΗΣ ────────────────────────────────────────────────────
  // Η ΒΑΡΥΤΗΤΑ ΔΕΝ ΕΙΝΑΙ ΓΝΩΜΗ: είναι πόσα ΑΛΛΑ ξεκλειδώνει το βήμα. Χωρίς αξία
  // και ενοίκιο δεν υπάρχει καμία απόδοση, κανένας φόρος και καμία σύγκριση —
  // γι’ αυτό 10. Η απογραφή βελτιώνει τις αποσβέσεις και τίποτα άλλο — γι’ αυτό 2.
  const setupSteps: SetupStep[] = ([
    // ΤΟ ΒΗΜΑ ΜΕ ΤΗ ΜΕΓΑΛΥΤΕΡΗ ΒΑΡΥΤΗΤΑ ΟΔΗΓΟΥΣΕ ΣΕ ΛΑΘΟΣ ΟΘΟΝΗ.
    // Έδειχνε στον «Λογαριασμό» (συνδρομή, ειδοποιήσεις, ασφάλεια), όπου δεν
    // υπάρχει ούτε πεδίο αξίας ούτε πεδίο ενοικίου. Ο νέος χρήστης πατούσε το
    // πρώτο πράγμα που του ζητά η εφαρμογή και προσγειωνόταν στη σελίδα
    // συνδρομής, χωρίς κανέναν τρόπο να ολοκληρώσει το βήμα από εκεί.
    // Τα πεδία ζουν στην «Επεξεργασία στοιχείων ακινήτου», που ως τώρα άνοιγε
    // μόνο από ένα μενού της πάνω μπάρας.
    { key:'details', weight:10, label:'Συμπλήρωσε αξία και ενοίκιο', hint:'Εμπορική ή αντικειμενική αξία και μηνιαίο ενοίκιο, για σωστές αποδόσεις', done: propertyDetailsComplete(prop, !!tenant), nav:'edit' },
    { key:'tenant',  weight:8, label:'Πρόσθεσε ενοικιαστή και ενοίκιο', hint:'Για αποδόσεις και υπενθύμιση πριν λήξει η μίσθωση', done: !!tenant, nav:'tenant' },
    { key:'expense', weight:6, label:'Κατέγραψε την πρώτη δαπάνη', hint:'Παρακολούθησε κόστη και έκπτωση φόρου', done: expenses.length>0, nav:'finances' },
    { key:'bills',   weight:5, label:'Ρύθμισε ρεύμα και αέριο', hint:'Σύγκρινε παρόχους και βρες φθηνότερο τιμολόγιο', done: bills.length>0, nav:'finances' },
    { key:'pricing', weight:3, label:'Δες την προτεινόμενη τιμή σου', hint:'Δυναμική τιμή ανά νύχτα και φορολογική εικόνα βραχυχρόνιας μίσθωσης', done: hostStays.length>0, nav:'pricing' },
    { key:'inv',     weight:2, label:'Ξεκίνα την απογραφή', hint:'Εξοπλισμός, εγγυήσεις και αποσβέσεις', done: inv.length>0, nav:'inventory' },
    // Βήμα που δείχνει σε καρτέλα η οποία δεν αφορά τον χρήστη είναι νεκρός
    // σύνδεσμος: το πάτημα θα τον γύριζε στην Επισκόπηση.
    //
    // ΚΑΙ ΒΗΜΑ ΠΟΥ ΔΕΝ ΑΦΟΡΑ ΑΥΤΟ ΤΟ ΑΚΙΝΗΤΟ. Το `tabVisible` κρίνει όλο το
    // χαρτοφυλάκιο: με ένα μακροχρόνιο κι ένα Airbnb φαίνονται και οι δύο
    // καρτέλες. Ετσι το Airbnb έβλεπε δεύτερο σε βαρύτητα «Πρόσθεσε
    // ενοικιαστή», για ακίνητο που δεν έχει ενοικιαστή και δεν θα αποκτήσει,
    // και το μακροχρόνιο «τιμή ανά νύχτα». Τα βήματα ρύθμισης είναι του
    // ΕΠΙΛΕΓΜΕΝΟΥ ακινήτου, οπότε ρωτούν και την κατάστασή του.
    //
    // ΚΑΙ ΒΗΜΑ ΠΟΥ ΔΕΝ ΞΕΡΟΥΜΕ ΑΝ ΕΓΙΝΕ. Το «δεν έγινε» βγαίνει από άδεια λίστα·
    // αν η λίστα είναι άδεια επειδή η ανάγνωση έπεσε, το βήμα είναι ψέμα
    // (lib/home/readFailures.ts).
  ] as SetupStep[]).filter(s => tabVisible(s.nav) && stepFitsProperty(s.key, prop) && trustedStep(s.key, failedReads));

  // ── ΜΙΑ ΛΙΣΤΑ, ΟΧΙ ΤΕΣΣΕΡΙΣ ──────────────────────────────────────────────
  // Πριν, αυτή η οθόνη σέρβιρε τέσσερις ανεξάρτητες μηχανές συμβουλής τη μία
  // κάτω από την άλλη: InsightsBoard, ObligationsPanel, «Ρύθμιση ακινήτου» και,
  // ως πλακίδιο KPI, τη λήξη μίσθωσης. Η λήξη μίσθωσης εμφανιζόταν ΤΕΣΣΕΡΙΣ
  // φορές, η ασφάλεια δύο, τα ελλιπή στοιχεία δύο. Τώρα οι πηγές συγχωνεύονται
  // ανά ΘΕΜΑ (lib/home/agenda.ts) και βγαίνει μία σειρά προτεραιότητας.
  const obligations = useMemo(
    () => computeObligations(prop, tenantFull, maint, now, taxProfileOf(prop), { leaseDeclaredAt, closedTaxRefs: closedTax }, leavers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prop, tenantFull, maint, todayIso, leaseDeclaredAt, closedTax, leavers],
  );
  // ═══ ΔΥΟ ΛΙΣΤΕΣ «ΤΙ ΕΡΧΕΤΑΙ», Η ΜΙΑ ΚΑΤΩ ΑΠΟ ΤΗΝ ΑΛΛΗ ═══════════════════
  // Η ατζέντα στην κορυφή έλεγε «τι χρειάζεται τώρα». Τρεις ζώνες πιο κάτω, μια
  // κάρτα «Επόμενες Εργασίες» έδειχνε ΑΛΛΕΣ πέντε επερχόμενες δουλειές — από
  // άλλον πίνακα, με δική της ταξινόμηση, χωρίς να ξέρει η μία για την άλλη.
  // Ο χρήστης έπρεπε να διαβάσει δύο λίστες και να τις συγχωνεύσει στο μυαλό
  // του για να καταλάβει τι είναι πρώτο. Τώρα τις συγχωνεύει η μηχανή.
  const taskObligations = useMemo(
    () => tasks.filter(t => t.title).map(t => ({
      id: `task:${t.id}`,
      title: t.title,
      note: '',
      date: t.due_date || '',
      // NaN: η ατζέντα υπολογίζει μόνη της τις ημέρες από την ημερομηνία, με
      // ημερολόγιο Αθήνας. Δεν της δίνουμε δεύτερη, δική μας μέτρηση.
      daysUntil: Number.NaN,
      priority: t.priority === 'critical' ? 'critical' : t.priority === 'high' ? 'high' : 'medium',
    })),
    [tasks],
  );
  // ΧΩΡΙΣ useMemo ΚΑΙ ΟΧΙ ΑΠΟ ΑΜΕΛΕΙΑ. Το `insights` παράγεται με απευθείας κλήση
  // σε κάθε απόδοση, άρα είναι ΠΑΝΤΑ νέος πίνακας: η χειροκίνητη απομνημόνευση
  // εδώ δεν γλίτωνε ποτέ ούτε μία εκτέλεση, κρατούσε μια σιωπηλή παράκαμψη του
  // κανόνα εξαρτήσεων και εμπόδιζε τον μεταγλωττιστή του React να απομνημονεύσει
  // ΟΛΟΚΛΗΡΟ το σημείο. Ιδιο σκεπτικό με το RentAdjustmentModal.
  const agendaAll =
    // Ό,τι στηρίζεται σε περιοχή που δεν διαβάστηκε δεν μπαίνει: η πληρωμένη
    // δόση ΕΝΦΙΑ δεν ξαναγίνεται οφειλή επειδή έπεσε μια ανάγνωση.
    buildAgenda({ insights: insights.filter(i => trustedInsight(i.id, failedReads)),
                  obligations: [...obligations.filter(o => trustedObligation(o, failedReads)), ...taskObligations],
                  setup: setupSteps, today: todayIso,
                  horizonDays: prefs.agendaHorizonDays })
      // ── ΔΥΟ ΚΑΝΟΝΕΣ ΓΙΑ ΤΗΝ ΙΔΙΑ ΛΙΣΤΑ ────────────────────────────────
      // Τα βήματα ρύθμισης φιλτράρονται ήδη με `tabVisible` πριν μπουν εδώ
      // (βλ. setupSteps). Τα insights ΔΕΝ φιλτράρονταν καθόλου — και το
      // `navSafe` της σελίδας ρίχνει σιωπηλά στην Επισκόπηση όποιον πατήσει
      // κουμπί προς κρυφή καρτέλα. Δηλαδή ο χρήστης πατούσε «Απογραφή» και
      // κατέληγε στην αρχική, χωρίς κανένα μήνυμα, χωρίς να καταλάβει γιατί.
      //
      // Το πιο χαρακτηριστικό: το «Το ακίνητο είναι κενό» έδινε κουμπί προς
      // τις Αποδόσεις, που φαίνονται ΜΟΝΟ σε εκμισθωμένο ακίνητο. Οι δύο
      // συνθήκες αποκλείονται, άρα το κουμπί ήταν νεκρό κάθε φορά που
      // εμφανιζόταν. Ένας κανόνας, μία λίστα.
      .map(it => (it.action && !tabVisible(it.action.tab) ? { ...it, action: null } : it))
      // ── ΤΑ ΧΡΗΜΑΤΑ ΤΑ ΛΕΕΙ ΤΟ ΤΑΜΕΙΟ, ΟΧΙ Η ΑΤΖΕΝΤΑ ───────────────────
      // Το «Οφείλεις» του CashHero και το «Ν ληξιπρόθεσμοι λογαριασμοί» της
      // ατζέντας έδειχναν ΤΑ ΙΔΙΑ χρήματα, με τον ίδιο προορισμό (Δαπάνες),
      // η μία κάρτα κάτω απο την άλλη. Και η ατζέντα το έλεγε χειρότερα: η
      // στήλη προθεσμίας της έγραφε «χωρίς προθεσμία» — για λογαριασμούς,
      // δηλαδή για το είδος με την πιο συγκεκριμένη ημερομηνία που υπάρχει.
      //
      // Το επείγον δεν χάνεται: πέρασε εκεί που είναι το ποσό. Το
      // `cashSideNote` γράφει πλέον «2 απλήρωτοι · 120,00€ ληξιπρόθεσμα,
      // ο παλαιότερος 18 ημέρες πίσω», χρησιμοποιώντας το `overdue` που
      // υπολογιζόταν και δεν το τύπωνε καμία οθόνη.
      //
      // Η ατζέντα μένει για ό,τι ΔΕΝ είναι χρήματα μέσα-έξω: λήξεις μίσθωσης
      // και ασφάλισης, δηλώσεις, συντήρηση, βήματα ρύθμισης.
      .filter(it => it.key !== 'bills');
  // Πέντε στην αρχική. Η πλήρης λίστα ζει στις «Εκκρεμότητες» — και η οθόνη το λέει.
  const agenda = agendaAll.slice(0, 5);

  if (loading) return (
    <div>
      <SkeletonKPIs n={5} />
      <div className="grid-main">
        <div className="card"><Skeleton w={140} h={11} style={{marginBottom:16}}/><Skeleton h={120} r={10}/></div>
        <div className="card"><Skeleton w={120} h={11} style={{marginBottom:16}}/><Skeleton h={120} r={10}/></div>
      </div>
      <div className="grid-3" style={{marginBottom:16}}>
        {[0,1,2].map(i=><div key={i} className="card"><Skeleton w={110} h={11} style={{marginBottom:16}}/><Skeleton h={90} r={10}/></div>)}
      </div>
    </div>
  );

  return (
    <div>
      {/* ── Η ΟΘΟΝΗ ΧΡΕΙΑΖΕΤΑΙ ΟΝΟΜΑ ΚΑΙ ΑΣ ΜΗΝ ΤΟ ΔΕΙΧΝΕΙ ──────────────────
          Δώδεκα καρτέλες έχουν ορατό τίτλο μέσω `PageTitle`, δηλαδή `h1`. Η
          Επισκόπηση —η ΠΡΩΤΗ οθόνη που βλέπει ο χρήστης— δεν είχε κανένα: ο
          αναγνώστης οθόνης την ανακοίνωνε χωρίς όνομα και η πλοήγηση ανά
          επικεφαλίδα ξεκινούσε από `h2`. Το όνομα έρχεται από το
          `lib/nav/labels.ts`, την ίδια πηγή με το μενού και τη Νόα.
          Κρυφό ΟΠΤΙΚΑ, όχι από τον αναγνώστη: η μπάρα από πάνω δείχνει ήδη το
          ακίνητο και η οθόνη δεν αλλάζει ούτε ένα εικονοστοιχείο. */}
      <h1 className="sr-only" ref={headingRef} tabIndex={-1}>{navLabel('overview')}</h1>
      <p role="status" className="sr-only">{retryNote}</p>
      {/* Τι άλλαξε στους Όρους, μία φορά ανά έκδοση (lib/legal/policyNotice.ts). */}
      <PolicyNotice />

      {/* ═══ Η ΚΕΦΑΛΙΔΑ ΠΟΥ ΕΛΕΙΠΕ ══════════════════════════════════════════
          Η οθόνη άνοιγε με ένα μοναχικό κουμπί «Αναφορά (PDF)» στοιχισμένο
          δεξιά, σε δική του γραμμή: μια ολόκληρη ζώνη ύψους για μια
          δευτερεύουσα ενέργεια, πάνω από το περιεχόμενο. Δεν υπήρχε πουθενά
          τίτλος — ο χρήστης δεν διάβαζε ΠΟΥΘΕΝΑ ποιο ακίνητο βλέπει ούτε τι
          μέρα είναι, ενώ κάθε ποσό από κάτω λέει «ως σήμερα». Τώρα: όνομα,
          κατάσταση, η ώρα Ελλάδας και η ενέργεια στη σειρά της. */}
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:16,flexWrap:'wrap',marginBottom:20}}>
        <div style={{minWidth:0}}>
          <AthensNow style={{fontFamily:T.font.sans,fontSize: 'var(--fs-xs)',fontWeight:600,color:'var(--text-tertiary)',letterSpacing:'0.02em',marginBottom:4,minHeight:15}}/>
          <div style={{fontFamily:T.font.sans,fontSize:'var(--fs-sm)',color:'var(--text-secondary)'}}>{heroIsNet ? `Καθαρό ${year}, με ό,τι ξέρουμε σήμερα` : `Δαπάνες ${year}`}</div>
          <div style={{fontFamily:T.font.num,fontSize:'clamp(28px,7vw,40px)',fontWeight:700,letterSpacing:'-0.02em',color:'var(--text-primary)',fontVariantNumeric:'tabular-nums',lineHeight:1.15}}>{moneyGap
            ? <span style={{fontFamily:T.font.sans,fontSize:'var(--fs-md)',fontWeight:600,color:'var(--text-secondary)',letterSpacing:0}}>Δεν φορτώθηκε</span>
            : fmtEur(heroValue)}</div>
          {/* Η ΤΑΥΤΟΤΗΤΑ ΤΟΥ ΑΚΙΝΗΤΟΥ ΛΕΓΕΤΑΙ ΜΙΑ ΦΟΡΑ ΚΑΙ ΤΗ ΛΕΕΙ Η ΜΠΑΡΑ.
              Εδώ γραφόταν ξανά, εξήντα εικονοστοιχεία κάτω από την ίδια
              πρόταση: όνομα, τύπος, κατάσταση, διεύθυνση — τα ίδια τέσσερα
              πεδία, με δεύτερη μορφοποίηση και τρίτη φορά στην κάρτα
              «Στοιχεία ακινήτου» πιο κάτω. Η πρώτη οθόνη ξόδευε τον πιο ακριβό
              της χώρο για να επαναλάβει ό,τι μόλις είχε διαβαστεί και το
              Ταμείο — ο λόγος που ανοίγει κανείς την εφαρμογή — έπεφτε κάτω
              από τη γραμμή του ματιού.
              Μένει η ώρα Ελλάδας, που δεν τη λέει κανείς άλλος και που δίνει
              νόημα στο «ως σήμερα» κάθε ποσού από κάτω. */}
        </div>
        {/* «ΣΑΡΩΣΕ ΕΓΓΡΑΦΟ» ΣΤΗΝ ΠΡΩΤΗ ΟΘΟΝΗ ΚΑΙ ΣΤΟ ΚΙΝΗΤΟ. Στα 390 εικονοστοιχεία
            η σάρωση ήθελε κύλιση· είναι η πιο συχνή πράξη του ιδιοκτήτη. */}
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <Btn variant="primary" onClick={()=>onNavigate('scan')}>
          <svg aria-hidden="true" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>
          Σάρωσε έγγραφο
        </Btn>
        <Btn disabled={moneyGap} title={moneyGap ? 'Η αναφορά περιμένει να φορτωθούν όλα τα ποσά' : undefined} onClick={()=>printPropertyStatement({
          propName: prop.name, address: prop.address||undefined, postalCode: prop.postal_code||undefined,
          propType: propertyTypeLabel(prop.prop_type)||'Ακίνητο',
          status: statusLabelOf(prop), year, propValue: propValue||undefined,
          objValue: prop.obj_value!=null?Number(prop.obj_value):undefined, enfia: prop.enfia!=null?Number(prop.enfia):undefined,
          sqm: prop.sqm||undefined, bedrooms: prop.bedrooms!=null?prop.bedrooms:undefined,
          floor: prop.floor!=null?prop.floor:undefined, yearBuilt: prop.year_built!=null?prop.year_built:undefined,
          energyClass: prop.pea_class||undefined, atak: prop.atak||undefined,
          ownership: prop.ownership!=null?Number(prop.ownership):undefined,
          coOwners: readCoOwners(prop.co_owners).map(c=>c.name),
          shortTerm: isShortTerm(prop),
          // Στη βραχυχρόνια το «μηνιαίο έσοδο» είναι το έσοδο της χρονιάς ανά μήνα,
          // όχι ο στόχος ενοικίου.
          monthlyRent: isShortTerm(prop) && annualRent > 0 ? annualRent / 12 : rent, rentIsEstimate: incomeIsEstimate, annualRent, grossYield, netYield,
          expensesYTD: totalExpYear, categories: catEntries, branding,
          taxShare: { tax: estTax, ofPortfolio: portfolioTax.count > 1 },
        })}>
          <svg aria-hidden="true" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
          Αναφορά σε PDF
        </Btn>
        </div>
      </div>


      {/* ═══ ΤΟ ΤΑΜΕΙΟ ══════════════════════════════════════════════════════
          Η οθόνη άνοιγε με «Μηνιαίο ενοίκιο · Μεικτή απόδοση · Καθαρή απόδοση»:
          τρεις αριθμοί που ο ιδιοκτήτης ξέρει απ' έξω και που δεν αλλάζουν από
          μήνα σε μήνα. Αυτό που ΔΕΝ ήξερε και είναι ο λόγος που ανοίγει την
          εφαρμογή, ήταν αν μπήκε το ενοίκιο και τι πρέπει να πληρώσει. */}
      {/* Η Νόα πριν από το Ταμείο, όχι πίσω από πλωτό κουμπί στη γωνία. Είναι
          μία γραμμή, όχι κάρτα: παρούσα, χωρίς να διεκδικεί τη θέση των ποσών. */}
      {/* ΤΙ ΔΕΝ ΔΙΑΒΑΣΤΗΚΕ, ΜΕ ΤΟ ΟΝΟΜΑ ΤΟΥ. Ως τις 08/10/2026 μια ανάγνωση που
          έπεφτε γινόταν «0€» ή «Δεν εκκρεμεί τίποτα» (lib/home/readFailures.ts). */}
      {failedReads.length > 0 && (
        <div role="alert">
          <InfoBanner tone="negative">
            <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              <span style={{flex:1,minWidth:220}}>
                {failedSentence(failedReads)}{' '}
                {moneyGap ? 'Ώσπου να διαβαστούν, δεν δείχνουμε σύνολα: θα ήταν μισά.' : 'Ό,τι βλέπεις από κάτω μπορεί να μην είναι πλήρες.'}
              </span>
              {/* Σβηστό, όχι `disabled`: το `disabled` βγάζει την εστίαση από το
                  κουμπί τη στιγμή που πατήθηκε (κανόνας του `dimmed`, Theme.tsx). */}
              <Btn dimmed={retrying} onClick={() => {
                if (retrying) return;
                setRetrying(true);
                setRetryNote('');
                retryAsked.current = true;
                void reload({ immediate: true }).finally(() => setRetrying(false));
              }}>{retrying ? 'Φορτώνω…' : 'Δοκίμασε ξανά'}</Btn>
            </div>
          </InfoBanner>
        </div>
      )}
      {/* Με μισά ποσά η Νόα θα έλεγε «βλέπω» για όσα δεν διάβασε. */}
      {!moneyGap && <AssistantStrip ctx={assistantCtx} />}

      {/* ΤΟ «ΣΟΥ ΟΦΕΙΛΟΥΝ» ΜΟΝΟ ΣΕ ΜΑΚΡΟΧΡΟΝΙΑ.
          Το `isLet` περιλαμβάνει και τη βραχυχρόνια, όπου όμως: το ποσό
          τροφοδοτείται από τις δόσεις ενοικίου (`rent_payments`) ενώ τα έσοδα
          βραχυχρόνιας ζουν στα καταλύματα, άρα έδειχνε ΠΑΝΤΑ μηδέν· και το
          κουμπί οδηγεί στον Ενοικιαστή, καρτέλα που φαίνεται μόνο σε
          μακροχρόνια, άρα δεν πήγαινε πουθενά. Μισή κορυφή της πρώτης οθόνης,
          για ένα μόνιμο μηδέν με νεκρό κουμπί. Στη βραχυχρόνια το «Οφείλεις»
          παίρνει όλο το πλάτος, που είναι και η αλήθεια: η είσπραξη γίνεται
          από την πλατφόρμα. */}
      {!moneyGap && (
        <CashHero cash={cash} showIncome={readStatus(prop) === 'rent_long'} onNavigate={onNavigate}
                  onRecordRent={receivableRent.length ? () => setReceivingRent(true) : null} />
      )}

      {/* ΤΟ ΠΑΡΑΘΥΡΟ ΠΡΟΣΑΡΤΑΤΑΙ ΟΤΑΝ ΑΝΟΙΓΕΙ. Έτσι η ημερομηνία είσπραξης και ο
          τρόπος ξαναπαίρνουν τις προεπιλογές τους κάθε φορά, αντί να κουβαλούν
          την προηγούμενη επιλογή σε δόση άλλου μήνα. */}
      {receivingRent && (
        <RentReceived
          onClose={() => setReceivingRent(false)}
          lines={receivableRent}
          supabase={supabase}
          propertyId={prop.id}
          tenantId={tenantFull?.id ?? null}
          leaseViaBank={rentViaBank}
          today={todayIso}
          onSaved={() => { void reload({ immediate: true }); }}
        />
      )}

      {/* Μία λίστα «τι χρειάζεται τώρα», στη θέση των τεσσάρων που έλεγαν εν
          μέρει τα ίδια πράγματα. Η συγχώνευση γίνεται στο lib/home/agenda.ts. */}
      <AgendaPanel items={agenda} total={agendaAll.length} onNavigate={onNavigate} incomplete={failedReads.length > 0} />

      {/* ═══ ΤΟ ΖΕΥΓΟΣ ΓΡΑΦΗΜΑΤΩΝ ΕΦΥΓΕ ΑΠΟ ΕΔΩ ══════════════════════════
          Οι ίδιες δύο εικόνες — δαπάνες ανά μήνα και κατανομή ανά κατηγορία —
          υπάρχουν στις Δαπάνες, στον Προϋπολογισμό, όπου ζουν και οι ΣΤΟΧΟΙ.
          Εκεί η μπάρα του μήνα έχει κάτι να συγκριθεί μαζί του· εδώ ήταν μια
          ωραία εικόνα χωρίς ερώτηση από πίσω της.

          ΓΙΑΤΙ ΕΦΥΓΕ ΑΥΤΟ ΚΑΙ ΟΧΙ ΤΟ ΑΛΛΟ. Η δουλειά αυτής της οθόνης είναι
          «τι χρειάζεται τώρα»: το Ταμείο και η ατζέντα. Ένα γράφημα δώδεκα
          μηνών απαντά σε άλλη ερώτηση — «πώς πήγε η χρονιά» — που είναι
          ερώτηση των Δαπανών. Και η περίληψή της μένει εδώ, στο πλακίδιο
          «Δαπάνες»: σύνολο έτους και ποσό ως σήμερα, μία γραμμή αντί για δύο
          κάρτες. Το βάθος είναι ένα κλικ μακριά, στη σωστή καρτέλα. */}

      <SecHdr label="Το ακίνητο" sub="Στοιχεία και πάγια κόστη" />
      <div className="grid-main">
        {/* ═══ ΔΕΚΑΤΡΕΙΣ ΣΕΙΡΕΣ ΔΙΠΛΑ ΣΕ ΠΕΝΤΕ ══════════════════════════════
            Ο πίνακας στοιχείων ήταν μία στήλη ζευγαριών σε πλέγμα τριών ίσων
            καρτών: γέμιζε δεκατρείς σειρές ενώ οι διπλανές κάρτες γέμιζαν πέντε
            και η σειρά τελείωνε με μισή κάρτα κείμενο και δυόμισι κάρτες κενό.
            Τα ίδια ζεύγη σε ΔΥΟ στήλες πέφτουν στις επτά σειρές και ζυγίζουν με
            το διπλανό — η ίδια πληροφορία, χωρίς το κενό. */}
        <div className="card">
          <h3 className="section-label"><span className="section-dot"/> Στοιχεία ακινήτου</h3>
          {/* ═══ ΤΟ ΤΕΛΕΥΤΑΙΟ ΣΤΟΙΧΕΙΟ ΕΜΕΝΕ ΜΟΝΟ ΤΟΥ, ΜΕ ΤΡΥΠΑ ΔΙΠΛΑ ΤΟΥ ══════
              ΤΟ ΠΡΩΤΟ ΕΥΡΗΜΑ ΤΗΣ ΠΡΩΤΗΣ ΣΑΡΩΣΗΣ ΑΥΤΗΣ ΤΗΣ ΟΘΟΝΗΣ. Μετρημένο σε
              768 και 820: έντεκα στοιχεία σε δύο στήλες δίνουν 2+2+2+2+2+1 και
              το «Εκτιμώμενος ΕΝΦΙΑ» έμενε μισό, με κενό ίσου μεγέθους δεξιά του.
              Το πλήθος το ορίζουν ΤΑ ΔΕΔΟΜΕΝΑ (πόσα πεδία έχει συμπληρώσει ο
              ιδιοκτήτης), οπότε η μονή περίπτωση δεν είναι σπάνια: είναι η μισή.

              ΚΑΙ ΤΟ `auto-fit` ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΤΟ ΛΥΣΕΙ, γιατί δεν ξέρει πόσες
              στήλες έβγαλε: ο κανόνας του ορφανού χρειάζεται να ισχύει ΜΟΝΟ στις
              δύο στήλες (στις τρεις, δύο στοιχεία στην τελευταία σειρά είναι
              σειρά που τελείωσε, όχι ορφανό). Οι στήλες γράφονται ρητά, στα ίδια
              ακριβώς πλάτη που έβγαζε το `auto-fit`: μία ως τα 700, δύο ως τα
              900, τρεις από εκεί και πάνω. */}
          <div className="prop-facts">
            {([['Τύπος',propertyTypeLabel(prop.prop_type)],['Εμβαδόν',prop.sqm?`${prop.sqm} τ.μ.`:null],['Υπνοδωμάτια',prop.bedrooms?String(prop.bedrooms):null],['Διεύθυνση',prop.address],['ΑΤΑΚ',prop.atak],['Έτος κατασκευής',prop.year_built?String(prop.year_built):null],['Όροφος',prop.floor!=null?String(prop.floor):null],['Θέρμανση',heatingLabel(prop.heating)||null],['Ενεργειακή κλάση',prop.pea_class],['Θέσεις στάθμευσης',prop.parking_spaces?String(prop.parking_spaces):null],['Αποθήκη',prop.storage_sqm?`${prop.storage_sqm} τ.μ.`:null],['Αντικειμενική αξία',prop.obj_value?fmtEur(prop.obj_value):null],[enfiaNow.label,enfiaNow.annual>0?fmtEur(enfiaNow.annual):null]] as [string,string|null][]).filter(([,v])=>v).map(([k,v]) => (
              <div key={k} title={k==='ΑΤΑΚ'?'Αριθμός Ταυτότητας Ακινήτου, από το έντυπο Ε9':k==='Εκτιμώμενος ΕΝΦΙΑ'?'Ενιαίος Φόρος Ιδιοκτησίας Ακινήτων: ο ετήσιος φόρος περιουσίας':undefined}
                style={{padding:'9px 0',borderBottom:'1px solid var(--border-subtle)',minWidth:0}}>
                {/* ══ Η ΤΙΜΗ ΚΟΒΟΤΑΝ ΚΑΙ ΜΑΖΙ ΤΗΣ ΚΟΒΟΤΑΝ ΚΑΙ ΤΟ ΠΟΣΟ ══════════
                    Ετικέτα και τιμή κάθονταν στην ΙΔΙΑ γραμμή, η μία απέναντι
                    στην άλλη, με τρεις τελείες όταν δεν χωρούσαν. Σε τρεις
                    στήλες η τιμή παίρνει ό,τι περισσεύει από την ετικέτα, που
                    δεν είναι πολύ: η διεύθυνση γινόταν «Υμηττού 100,…» και ο
                    ΕΝΦΙΑ «340…». Μια κομμένη διεύθυνση είναι μισή διεύθυνση·
                    ένα κομμένο ποσό είναι ΛΑΘΟΣ ποσό, γιατί το «340…» διαβάζεται
                    ως τριακόσια σαράντα και μπορεί να είναι 3.400.

                    Η ετικέτα ανεβαίνει από πάνω, μικρή και ήσυχη· και η τιμή
                    παίρνει ΟΛΟ το πλάτος της στήλης και τυλίγεται όσο χρειάζεται.
                    Ιδιο ιδίωμα με τη γραμμή στοιχείων της κάρτας δανείου: όνομα
                    πάνω, μέγεθος κάτω, τίποτα κρυμμένο πίσω από τελείες. */}
                <span style={{display:'block',fontFamily:T.font.sans,color:'var(--text-tertiary)',fontSize: 'var(--fs-xs)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginBottom: 4}}>{k}</span>
                <span style={{display:'block',fontFamily:T.font.sans,color:'var(--text-primary)',fontSize: 'var(--fs-base)',letterSpacing:'0.25px',minWidth:0,overflowWrap:'anywhere'}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 className="section-label"><span className="section-dot"/> Λογαριασμοί ανά μήνα</h3>
          {ledgerGap
            ? <EmptyState icon={<FileText size={20}/>} title="Δεν φορτώθηκαν οι λογαριασμοί" hint="Πάτησε «Δοκίμασε ξανά» στην ειδοποίηση πιο πάνω."/>
            : billAverages.length===0
            ? <EmptyState icon={<FileText size={20}/>} title="Κανένας λογαριασμός ακόμη" hint="Πρόσθεσε ρεύμα, νερό και πάγια για να δεις μέσους όρους."/>
            : <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {billAverages.slice(0,5).map(b => (
                  <div key={b.type} style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:12}}>
                    <div style={{minWidth:0,display:'flex',alignItems:'baseline',gap:4,fontFamily: T.font.sans,fontSize: 'var(--fs-base)',color:'var(--text-secondary)',letterSpacing:'0.25px'}}>
                      <span style={{minWidth:0}}>{b.type}</span>
                      {/* ΤΟ ΠΛΗΘΟΣ ΛΕΓΕΤΑΙ. Ένας «μέσος όρος» από έναν λογαριασμό δεν
                          είναι μέσος όρος και ο χρήστης πρέπει να ξέρει σε πόσα
                          στηρίζεται το νούμερο πριν χτίσει πάνω του προϋπολογισμό.
                          Δικό του κουτί που δεν κονταίνει: στα 320 κοβόταν μαζί
                          με το όνομα και έμενε μισό έξω από τη γραμμή. */}
                      <span style={{flexShrink:0,color:'var(--text-tertiary)',fontSize: 'var(--fs-xs)'}} title={`Από ${b.count} ${b.count===1?'λογαριασμό':'λογαριασμούς'}`}>({b.count})</span>
                    </div>
                    <div style={{fontFamily: T.font.num,fontSize: 'var(--fs-base)',color:'var(--text-primary)',fontVariantNumeric:'tabular-nums',flexShrink:0}}>{fmtEur(b.monthly)} <span style={{fontFamily:T.font.sans,color:'var(--text-tertiary)',fontSize:'var(--fs-xs)'}}>τον μήνα</span></div>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      {/* ═══ ΤΟ ΕΤΟΣ, ΣΤΗΝ ΙΔΙΑ ΓΛΩΣΣΑ ΜΕ ΤΟ ΣΗΜΕΡΑ ══════════════════════════
          Εδώ ζούσε ΤΡΙΤΟ σύστημα πλακιδίων (.po-fig-card, κεντραρισμένο, 20px
          τιμή) και από κάτω ΤΡΕΙΣ ζώνες με κεντραρισμένα ζευγάρια
          «ετικέτα — τιμή» χωρισμένες με γραμμούλες: δάνειο, φιλοξενία,
          πληρωμένα/εκκρεμή. Επτά νούμερα κρυμμένα σε μορφή που δεν
          χρησιμοποιείται πουθενά αλλού στην εφαρμογή και δεν διαβάζεται με μια
          ματιά. Είναι όλα το ίδιο πράγμα — αριθμός με ετικέτα — και πλέον
          δείχνουν έτσι. */}
      <SecHdr label={`Η χρονιά ${year}`} sub="Πού καταλήγει με ό,τι ξέρουμε σήμερα" />
      {moneyGap ? (
        <EmptyState icon={<FileText size={20}/>} title="Τα ποσά της χρονιάς περιμένουν" hint="Δεν φορτώθηκαν όλες οι καταχωρήσεις. Με μισές, τα σύνολα δεν θα ήταν αληθινά."/>
      ) : (() => {
        const net = annualRent - costs.total - estTax;   // μόνο για το σκέλος με έσοδα
        // ΜΙΑ ΖΩΝΗ ΑΡΙΘΜΩΝ, ΟΧΙ ΔΥΟ. Πιο πάνω υπήρχε δεύτερο πλέγμα «Η εικόνα
        // σήμερα» με «Μηνιαίο ενοίκιο», «Δαπάνες ως σήμερα» και τις δύο
        // αποδόσεις. Το «Μηνιαίο ενοίκιο × 12» ΕΙΝΑΙ τα ακαθάριστα έσοδα και οι
        // «Δαπάνες ως σήμερα» δίπλα στις «Δαπάνες όλο το έτος» διάβαζαν σαν το
        // ίδιο μέγεθος με δύο τιμές. Τώρα κάθε ποσό λέγεται μία φορά· ό,τι ήταν
        // χρήσιμο συμφραζόμενο (μηνιαίο, ως σήμερα) μπήκε ως υπότιτλος.
        // ΣΕ ΚΕΝΟ Ή ΙΔΙΟΧΡΗΣΙΑ ΔΕΝ ΥΠΑΡΧΟΥΝ ΕΣΟΔΑ, ΦΟΡΟΣ, ΟΥΤΕ «ΚΑΘΑΡΟ».
        // Έδειχνε τρία πλακίδια στο μηδέν και ένα «Καθαρό αποτέλεσμα» που ήταν
        // απλώς οι δαπάνες με μείον — δηλαδή το ίδιο νούμερο δύο φορές, με τα
        // άλλα δύο να λένε «δεν ξέρω» ντυμένα σαν μέτρηση. Μένει ό,τι ισχύει.
        const income = isLet(prop);
        const items: KPIItem[] = income ? [
          // ΑΠΟΔΟΣΗ ΑΠΟ ΤΗ ΜΙΣΘΩΣΗ, ΤΑΜΕΙΟ ΑΠΟ ΤΙΣ ΔΟΣΕΙΣ. Το ποσό του πλακιδίου
          // είναι το έσοδο της απόδοσης (`yieldIncome`), το ίδιο με την καρτέλα
          // των αποδόσεων· τα εισπραγμένα γράφονται από κάτω μόνο όταν
          // καταγράφηκαν, όχι η εκτίμηση «μίσθωμα × μήνες».
          incomeRecorded ? {
            label: `${yi.basis === 'stays' ? 'Έσοδα φιλοξενίας' : 'Έσοδα από ενοίκια'}${incomeIsEstimate ? `, ${INCOME_LABELS.estimate}` : ''}`, value:fmtEur(annualRent),
            sub: yi.received != null ? `${fmtEur(yi.received)} ${INCOME_LABELS.received}` : `${fmtEur(rent)} τον μήνα`,
            title: fromLease
              ? `Το μηνιαίο μίσθωμα × 12 (${INCOME_LABELS.expected}). ${yi.received != null ? `${fmtEur(yi.received)} ${INCOME_LABELS.received}.` : 'Δεν έχει καταγραφεί δόση ακόμη.'} Ίδια βάση με το ${navLabel('portfolio')} και τις ${navLabel('roi')}.`
              : `Όσα εισπράχθηκαν το ${year} ως σήμερα (${fmtEur(inc.receivedToDate)}), σε ετήσιο ρυθμό: ${INCOME_LABELS.estimate}, όχι είσπραξη. ${yi.basis === 'stays' ? 'Δηλωτέο ακαθάριστο των διαμονών με άφιξη ως σήμερα.' : 'Πληρωμένες δόσεις με ημερομηνία ως σήμερα.'} Ίδια βάση με το ${navLabel('portfolio')} και τις ${navLabel('roi')}.` }
          : { label: rentIsTarget ? 'Έσοδα από ενοίκια, εκτίμηση' : 'Έσοδα από ενοίκια', value:fmtEur(annualRent),
            sub: rentIsTarget ? `στόχος ${fmtEur(rent)} τον μήνα, χωρίς ενοικιαστή` : `${fmtEur(rent)} τον μήνα`,
            title: rentIsTarget
              ? `Στόχος ενοικίου ${fmtEur(rent)} × 12. Δεν υπάρχει ενοικιαστής με ενοίκιο, οπότε το ποσό είναι εκτίμηση.`
              : `Μηνιαίο ενοίκιο ${fmtEur(rent)} × 12.` },
          { label:EXPENSE_LABELS.total, value:fmtEur(yExp.total),
            sub: expensePartsShort(yExp, fmtEur),
            title:`Οι δαπάνες του ${year} όπως είναι καταχωρημένες: ${expenseParts(yExp, fmtEur)}. Λογαριασμοί και δαπάνες μαζί, κάθε ευρώ μία φορά, χωρίς προβολή. Ίδιο ποσό με τις ${navLabel('finances')}, το ${navLabel('portfolio')}, την ${navLabel('roi')} και τη ${navLabel('accounting')}.${expDeltaPct!=null?` Το ίδιο διάστημα του ${year-1}: ${expDeltaPct>0?'+':expDeltaPct<0?'−':''}${Math.abs(expDeltaPct)}%.`:''}` },
          // ══ Η ΕΤΙΚΕΤΑ ΣΕ ΜΙΑ ΓΡΑΜΜΗ ΚΑΙ ΧΩΡΙΣ ΝΑ ΧΑΣΕΙ ΝΟΗΜΑ ══════════════
          // «Μερίδιο φόρου ενοικίου» είναι 22 χαρακτήρες δίπλα σε τρεις
          // ετικέτες των 7 ως 17: έσπαγε σε δεύτερη γραμμή και ΜΟΝΟ αυτή,
          // οπότε η τιμή της ξεκινούσε χαμηλότερα από τις άλλες τρεις. Τέσσερα
          // ποσά στη σειρά που δεν διαβάζονται σε ευθεία.
          //
          // Δεν κόβεται η λέξη που μετράει: το «μερίδιο» έχει νόημα ΜΟΝΟ όταν
          // υπάρχουν πολλά ακίνητα, γιατί τότε ο προοδευτικός φόρος υπολογίζεται
          // στο σύνολο και αυτό εδώ είναι το κομμάτι που αναλογεί. Με ένα
          // ακίνητο δεν μοιράζεται τίποτα: είναι όλος ο φόρος του. Η ετικέτα
          // λέει το καθένα στη θέση του και η πλήρης εξήγηση μένει στο ⓘ.
          { label: `${portfolioTax.count>1 ? 'Μερίδιο φόρου' : 'Φόρος ενοικίου'}${incomeIsEstimate ? ', εκτίμηση' : ''}`, value:fmtEur(estTax),
            title:portfolioTax.count>1
              ? `${CONSOLIDATION_NOTE} Συνολικός φόρος χαρτοφυλακίου ${fmtEur(Math.round(portfolioTax.totalTax))} σε ενοίκια ${fmtEur(Math.round(portfolioTax.totalAnnualRent))}.`
              // ΤΟ ΚΕΙΜΕΝΟ ΣΥΜΦΩΝΕΙ ΜΕ ΤΟ ΝΟΥΜΕΡΟ. Η κύρωση της τραπεζικής
              // είσπραξης (ν.5222/2025) ξεκινά την 1.7.2027· ως τότε η έκπτωση
              // δίνεται ανεξάρτητα από τον τρόπο, οπότε ο φόρος κρατά το 95% και
              // το κείμενο δεν μιλά για απώλεια που δεν συμβαίνει ακόμη.
              : (!bankReceiptMatters(year) || rentViaBank)
                ? `Προοδευτική κλίμακα ενοικίων ${year} με την τεκμαρτή έκπτωση ${fpRate(PRESUMPTIVE_DEDUCTION_RATE * 100)}. Έχεις ένα ακίνητο με εισόδημα, οπότε ο φόρος του είναι όλος ο φόρος σου.`
                : `Προοδευτική κλίμακα ενοικίων ${year} χωρίς την τεκμαρτή έκπτωση ${fpRate(PRESUMPTIVE_DEDUCTION_RATE * 100)}: το ενοίκιο εισπράττεται με μετρητά και από ${grDateOf(FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT)} η έκπτωση προϋποθέτει τραπεζική είσπραξη (ν.5222/2025). Ο φόρος υπολογίζεται στο 100% του ενοικίου.` },
          // ΧΩΡΙΣ ΧΡΩΜΑΤΙΚΗ ΕΤΥΜΗΓΟΡΙΑ. Το πρόσημο το λέει ήδη το ίδιο το ποσό·
          // το πράσινο/κόκκινο απλώς το ξαναέλεγε και σε μια χρονιά με ΕΝΦΙΑ
          // έβαφε κόκκινο ένα ακίνητο που δουλεύει κανονικά.
          // Η ΠΡΟΜΗΘΕΙΑ ΤΩΝ ΔΙΑΜΟΝΩΝ ΛΕΓΕΤΑΙ ΜΕ ΤΟ ΟΝΟΜΑ ΤΗΣ. Δεν είναι στις «Δαπάνες
          // έτους» (εκείνες είναι ίδιες σε κάθε οθόνη), οπότε το αποτέλεσμα τη
          // γράφει από κάτω ώστε η αφαίρεση να φαίνεται.
          { label:'Καθαρό αποτέλεσμα', value:fmtEur(net),
            sub: costs.stayFees > 0 ? `μετά από ${fmtEur(costs.stayFees)} ${PLATFORM_FEE_LABELS.short}` : undefined,
            title: costs.stayFees > 0
              ? `Ακαθάριστα έσοδα μείον δαπάνες μείον ${fmtEur(costs.stayFees)} ${PLATFORM_FEE_LABELS.fromStays} μείον το μερίδιο φόρου. ${PLATFORM_FEE_LABELS.note}${stayFees.ownMonths > 0 ? ` ${PLATFORM_FEE_LABELS.ownMonths}` : ''} Δεν περιλαμβάνει δόσεις δανείου.`
              : 'Ακαθάριστα έσοδα μείον δαπάνες μείον το μερίδιο φόρου. Δεν περιλαμβάνει δόσεις δανείου.' },
        ] : [
          { label:EXPENSE_LABELS.total, value:fmtEur(yExp.total),
            sub: expensePartsShort(yExp, fmtEur),
            title:`Οι δαπάνες του ${year} όπως είναι καταχωρημένες: ${expenseParts(yExp, fmtEur)}.` },
          // Χωρίς εμπορική ΚΑΙ χωρίς αντικειμενική αξία, το πλακίδιο έγραφε
          // «0,00€»: όχι μέτρηση, αλλά απουσία μέτρησης ντυμένη σαν μέτρηση.
          ...(propValue>0 ? [{ label:'Αξία ακινήτου', value: fmtEur(propValue),
            title: prop.value ? 'Εμπορική αξία, όπως την έχεις καταχωρήσει.' : 'Αντικειμενική αξία από το έντυπο Ε9, επειδή δεν έχει καταχωρηθεί εμπορική.' }] : []),
        ];
        // ΙΔΙΟ ΠΛΑΚΙΔΙΟ, ΟΧΙ ΙΔΙΑ ΒΑΡΥΤΗΤΑ. Τα τέσσερα παραπάνω είναι η αλυσίδα
        // που καταλήγει στο «Καθαρό αποτέλεσμα» — το συμπέρασμα της χρονιάς. Τα
        // από κάτω είναι συμφραζόμενα: υπάρχουν μόνο όταν υπάρχουν και δεν
        // μπαίνουν δίπλα στο συμπέρασμα σαν ισότιμα. Μπήκαν σε δεύτερο πλέγμα
        // αντί να χωθούν στο πρώτο, που τα ξεχείλωνε σε μια δεύτερη μισοάδεια
        // σειρά και ισοπέδωνε την ιεραρχία.
        const extra: KPIItem[] = [];
        if (hasActiveLoan) extra.push({
          // ΧΩΡΙΣ ΣΤΡΟΓΓΥΛΕΥΣΗ ΣΤΟ ΕΥΡΩ. Η ατζέντα της ίδιας οθόνης γράφει τη δόση
          // με τα λεπτά της· εδώ έβγαινε «922,00€» δίπλα σε «922,30€».
          label:'Δόση δανείου / μήνα', value:fmtEur(monthlyDebt),
          sub: debtLtv>0 ? `${debtKnownAge ? 'υπόλοιπο' : 'αρχικό δάνειο'} προς αξία ${fp(debtLtv)}` : undefined,
          title:'Εκτιμώμενη τοκοχρεολυτική δόση. Δεν αφαιρείται από το καθαρό αποτέλεσμα παραπάνω· το κεφάλαιο δεν είναι δαπάνη.' });
        // ── ΕΙΣΠΡΑΞΕΙΣ, ΟΧΙ ΕΣΟΔΑ. ΔΥΟ ΣΩΣΤΑ ΝΟΥΜΕΡΑ ΓΙΑ ΤΗΝ ΙΔΙΑ ΔΙΑΜΟΝΗ ──────
        // Ο επισκέπτης πληρώνει 1.000,00€, η πλατφόρμα κρατά 150,00€ προμήθεια
        // και εισπράττει 50,00€ τέλος ανθεκτικότητας. Στον λογαριασμό μπαίνουν
        // 800,00€· δηλωτέο ακαθάριστο είναι 950,00€. Και τα δύο είναι σωστά,
        // απαντούν σε ΑΛΛΗ ερώτηση — και έλεγαν και τα δύο «έσοδα», σε δύο
        // καρτέλες της ίδιας εφαρμογής, χωρίς να το εξηγεί κανείς.
        //
        // Η ελληνική γλώσσα έχει ήδη τη διάκριση: «εισπράξεις» είναι ό,τι μπήκε
        // στο ταμείο, «έσοδα» είναι η φορολογική έννοια. Η Λογιστική λέει «Μεικτά
        // έσοδα» και εννοεί το δηλωτέο· εδώ είναι το ταμείο, άρα εισπράξεις. Μία
        // λέξη, καμία επιπλέον γραμμή και η αμφισημία φεύγει.
        if (hostStays.length > 0) extra.push({
          // ΣΤΟ ΜΙΣΟ ΠΛΑΤΟΣ, ΤΟ ΣΥΝΤΟΜΟ. «δηλωτέο … · … διανυκτερεύσεις · επόμενη
          // άφιξη …» έσπαγε σε τέσσερις γραμμές στα 390. Το πλακίδιο κρατά ποσό και
          // νύχτες (`hostingPartsShort`)· οι πλήρεις λέξεις και η επόμενη άφιξη
          // μένουν στην εξήγηση, όπως στις «Δαπάνες έτους».
          label:`Εισπράξεις φιλοξενίας ${year}`, value:fmtEur(hostingYTD),
          sub: hostingPartsShort(hosting, fmtEur),
          title:`${HOSTING_LABELS.payout}: ${fmtEur(hosting.payout)}, από την καρτέλα «${navLabel('clients')}». ${hostingParts({ declarable: hosting.declarable, nights: hostingNights }, nextArrival, fmtEur, fd)}. Το δηλωτέο είναι μεγαλύτερο γιατί περιλαμβάνει την προμήθεια της πλατφόρμας· το βλέπεις στη Λογιστική ως «Μεικτά έσοδα».` });
        // ΟΙ «ΕΚΚΡΕΜΕΙΣ ΔΑΠΑΝΕΣ» ΕΦΥΓΑΝ ΑΠΟ ΕΔΩ. Είναι ακριβώς το «Χρωστάω» του
        // Ταμείου, στην κορυφή της ίδιας οθόνης — το ίδιο ποσό δύο φορές, με
        // διαφορετικό όνομα και σε απόσταση ενός scroll.
        return (
          <>
            {/* Το πλήθος στηλών ακολουθεί το πλήθος των πλακιδίων. Με σταθερό
                τέσσερα, το ακίνητο χωρίς έσοδα άπλωνε ένα ή δύο πλακίδια σε
                τέσσερις θέσεις και άφηνε τη μισή σειρά κενή. */}
            <KPIGrid columns={Math.min(4, Math.max(2, items.length))} items={items} />
            {/* Η απόδοση σε μία γραμμή αντί για δύο πλακίδια: είναι
                συμφραζόμενο του αποτελέσματος, όχι ισότιμο μέγεθος μαζί του. Η
                πλήρης ανάλυση ζει στις «Αποδόσεις», που είναι η καρτέλα της. */}
            <div style={{marginTop:-4,marginBottom:16,fontFamily: T.font.sans,fontSize:12,color:'var(--text-secondary)',lineHeight:1.7}}>
              {isLet(prop) && propValue>0 && (
                <div>
                  {/* «Απόδοση: μεικτή 4,03% · καθαρή προ φόρου 3,01%». Ηταν «Απόδοση.
                      μεικτή απόδοση …», η λέξη τρεις φορές και τελεία πριν από
                      πεζό. Οι λέξεις από το lib/facts (YIELD_INLINE_LABELS). */}
                  <strong style={{color:'var(--text-primary)',fontWeight:600}}>{YIELD_INLINE_LABELS.title}:</strong>{' '}
                  {/* Κάθε σκέλος δεν σπάει μέσα του: στο τηλέφωνο το «185.000,00€»
                      έπεφτε μόνο του στη δεύτερη γραμμή, χωρισμένο από το «αξία». */}
                  <span style={{whiteSpace:'nowrap'}} title={`${YIELD_LABELS.gross}: ετήσιο ενοίκιο ως ποσοστό της αξίας του ακινήτου, πριν από τις δαπάνες`}>{YIELD_INLINE_LABELS.gross} {fp(grossYield)}</span>
                  {' · '}
                  <span style={{whiteSpace:'nowrap'}} title={costs.stayFees > 0
                    ? `${netPreTaxLabel(costs)}: ετήσιο έσοδο μείον τις δαπάνες του έτους που έχεις καταγράψει και ${fmtEur(costs.stayFees)} ${PLATFORM_FEE_LABELS.fromStays}, ως ποσοστό της αξίας. ${PLATFORM_FEE_LABELS.note}`
                    : `${netPreTaxLabel(costs)}: ετήσιο έσοδο μείον τις δαπάνες του έτους που έχεις καταγράψει, ως ποσοστό της αξίας`}>{YIELD_INLINE_LABELS.net_pre_tax} {fp(netYield)}</span>
                  {' · '}
                  <span style={{whiteSpace:'nowrap'}}>αξία {fmtEur(propValue)}</span>
                </div>
              )}
              {income && taxNote && (
                <div><strong style={{color:'var(--text-primary)',fontWeight:600}}>Πώς βγαίνει ο φόρος.</strong> {taxNote}</div>
              )}
            </div>
            {/* Ο ΙΔΙΟΣ ΚΑΝΟΝΑΣ ΜΕ ΤΟ ΠΡΩΤΟ ΠΛΕΓΜΑ. Με `Math.max(3, …)` δύο
                πλακίδια (δάνειο, φιλοξενία) άφηναν την τρίτη στήλη άδεια. */}
            {extra.length > 0 && <KPIGrid columns={Math.min(4, Math.max(2, extra.length))} items={extra} />}
          </>
        );
      })()}

      {/* ── ΤΙ ΕΦΥΓΕ ΑΠΟ ΑΥΤΗ ΤΗ ΖΩΝΗ ────────────────────────────────────────
          «Είσπραξη και πληρωμές» (PaymentLinks): στατικός κατάλογος τριών
          παρόχων και επτά τραπεζών με εξωτερικούς συνδέσμους. Δεν έπαιρνε
          ΚΑΝΕΝΑ prop — δεν ήξερε καν ποιο ακίνητο βλέπεις — δεν έκανε τίποτα
          που δεν κάνει ο σελιδοδείκτης του περιηγητή και καταλάμβανε μόνιμη
          θέση στην πιο ακριβή οθόνη της εφαρμογής. Ό,τι αξίζει από αυτό ζει
          ήδη μέσα στην πύλη, ως «Σύνδεσμος πληρωμής» του ενοικιαστή.

          Η ΠΥΛΗ ΕΝΟΙΚΙΑΣΤΗ αποδιδόταν χωρίς καμία συνθήκη. Ο ιδιοκτήτης που
          μένει στο σπίτι του, ή το έχει κενό ή προς πώληση, έβλεπε μόνιμα
          κάρτα «Κοινοποίησε σύνδεσμο και δες αιτήματα βλάβης» — την ίδια
          στιγμή που η εφαρμογή του έκρυβε την καρτέλα «Ενοικιαστής» ως μη
          σχετική. Η μηχανή ορατότητας έλεγε ένα και η Επισκόπηση έκανε άλλο.
          Τώρα ακολουθεί τον ίδιο κανόνα με το διπλανό της πάνελ πληρότητας.

          Και η κεφαλίδα ενότητας έφυγε μαζί: με ένα στοιχείο κάθε φορά, ένας
          τίτλος «Διαχείριση και εργαλεία» ονομάτιζε ομάδα που δεν υπάρχει. */}
      {readStatus(prop) === 'rent_long' && <PortalShare propertyId={prop.id} userId={userId} />}
      <OccupancyPanel propertyId={prop.id} userId={userId} profileType={profileType} legalForm={legalForm} />
      {/* Η μηνιαία γνώμη, στη ροή και στο τέλος: δεν σκεπάζει τίποτα (02.10.2026). */}
      <MonthlyFeedbackNudge />

    </div>
  );
}
