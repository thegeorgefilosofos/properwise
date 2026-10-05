'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΤΑΣΤΑΣΗ ΤΟΥ ΠΡΟΫΠΟΛΟΓΙΣΜΟΥ: ΦΟΡΤΩΣΗ, ΣΤΟΧΟΙ, ΕΞΑΙΡΕΣΕΙΣ, ΥΠΟΛΟΓΙΣΜΟΙ
// ─────────────────────────────────────────────────────────────────────────
// Ό,τι διαβάζει ο προϋπολογισμός από τη βάση, ό,τι θυμάται για τον χρήστη,
// οι αποθηκεύσεις και ό,τι υπολογίζεται από αυτά. Η οθόνη (BillsBudget) μόνο
// το αποδίδει.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef } from 'react'
import { useCoarsePointer } from '@/components/useCoarsePointer'
import { createClient } from '@/lib/supabase/client'
import * as properties from '@/lib/data/properties'
import * as loanStore from '@/lib/data/loans'
// Οι ρυθμίσεις ανά ενότητα έχουν ένα σπίτι: lib/data/settings.
import * as settings from '@/lib/data/settings'
import * as stayStore from '@/lib/data/stays'
import * as billStore from '@/lib/data/bills'
import * as tenantStore from '@/lib/data/tenants'
import * as expenses from '@/lib/data/expenses'
import * as calendar from '@/lib/data/calendar'
import { feAuto } from '@/components/Theme'
import { waterMonthly } from '@/lib/energy/tariff'
import { monthAcc, monthYearLabel } from '@/lib/core/months'
import { randomSuffix } from '@/lib/core/uploadPath'
import { notify } from '@/components/Toast'
import { saved } from '@/components/dbWrite'
import {
  forecastMonthEnd, categoryStatus, annualSummary, periodTrend, detectRecurring, RecurringCharge,
} from '@/lib/billing/budget'
import { presumptiveDeductionRate } from '@/lib/billing/consolidate'
import {
  rolloverNext, strWaterfall, investmentReturns, type InvestmentReturns,
} from '@/lib/billing/budgetPro'
import { incomeStatement } from '@/lib/accounting/statement'
import { interestForYear } from '@/lib/loans/recommend'
import { isActiveLoan, loansInstalmentTotal } from '@/lib/loans/shape'
import { mergeLedger, type LedgerBill, type LedgerExpense, type LedgerEntry } from '@/lib/expenses/ledger'
import { budgetBucket } from '@/lib/expenses/taxonomy'
import { subscriptionsMonthly } from '@/lib/expenses/subscriptions'
// Ο ΕΝΦΙΑ διαβάζεται από την ίδια απόφαση με την καρτέλα Υπηρεσίες.
import { enfiaInUse, estimateENFIA, atticaMainlandFromPostcode } from '@/lib/billing/enfia'
import { climateLevyRates, isHighSeasonMonth } from '@/lib/billing/greekTax'
import { isHouseType } from '@/lib/tax/shortTermTax'
import { useLoad } from '@/app/hooks/useLoad'
import { useRemembered } from '@/components/useRememberedFlag'
import { toggleIn } from '@/lib/core/toggleSet'
import { propertyStatus, type StatusRow } from '@/lib/facts/status';
import {
  FIXED_CATS, ymOf, CATS, type MonthItem, type ExclRule, type CustomCatRaw, type Props,
  COLLAPSED_BY_DEFAULT, COLLAPSED_SERVER,
} from './model'

export function useBudget({ propertyId, userId = '', profileType = 'individual' }: Props) {
  const isPro = profileType === 'professional';
  const supabase  = createClient();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── State ──────────────────────────────────────────────────────────────────
  const initBudgets = (): Record<string, string> => {
    const b: Record<string, string> = { total: '390' };
    CATS.forEach(c => { b[c.key] = String(c.default); });
    return b;
  };

  const [budgets,      setBudgets]      = useState<Record<string, string>>(initBudgets);
  const [actuals,      setActuals]      = useState<Record<string, number>>({});
  // Ιστορικό ανά μήνα (YYYY-MM → σύνολο) και ανά μήνα/κατηγορία, από ΚΑΤΑΓΕΓΡΑΜΜΕΝΕΣ
  // εγγραφές (λογαριασμοί + λοιπές δαπάνες) — για πρόβλεψη, ετήσια εικόνα και τάσεις.
  const [monthTotals,  setMonthTotals]  = useState<Record<string, number>>({});
  const [catMonth,     setCatMonth]     = useState<Record<string, Record<string, number>>>({});
  // Έσοδα και δεσμευμένες εκροές (λογαριασμοί, δόση δανείου).
  const [income,       setIncome]       = useState(0);
  const [incomeYtd,    setIncomeYtd]    = useState(0);
  const [loanMonthly,  setLoanMonthly]  = useState(0);
  const [rentalMode,   setRentalMode]   = useState<'long_term' | 'short_term' | ''>('');
  // Χρειάζονται για τον ΣΩΣΤΟ συντελεστή ΤΑΚΚ: το υψηλό κλιμάκιο ισχύει μόνο
  // για μονοκατοικία άνω των 80 τ.μ.
  const [propSqm,      setPropSqm]      = useState<number | null>(null);
  const [propIsHouse,  setPropIsHouse]  = useState(false);
  const [strNights,    setStrNights]    = useState(0);
  // Έξυπνες προτάσεις αποθεματικών/φόρου (ΕΝΦΙΑ, φόρος, CapEx, κενές περίοδοι),
  // υπολογισμένες με τους κανονικούς μηχανισμούς του προϋπολογισμού.
  const [recurring,    setRecurring]    = useState<RecurringCharge[]>([]);
  const [weekActuals,  setWeekActuals]  = useState<Record<string, number>>({});
  const [monthItems,   setMonthItems]   = useState<MonthItem[]>([]);
  const [catBreakdown, setCatBreakdown] = useState<Record<string, { label: string; amount: number; date: string; paid: boolean; kind: 'bill' | 'expense' }[]>>({});
  const [openCats,     setOpenCats]     = useState<Set<string>>(new Set());
  // Απόδοση επένδυσης (μόνο επαγγελματίας) και πλήθος βραχυχρόνιων ακινήτων (μόνο ιδιώτης, όριο 3+).
  const [invReturns,   setInvReturns]   = useState<(InvestmentReturns & { onPurchase: boolean }) | null>(null);
  const [strPropCount, setStrPropCount] = useState(0);
  // ── Ο ΣΥΝΤΕΛΕΣΤΗΣ ΤΗΣ ΚΡΑΤΗΣΗΣ ΦΟΡΟΥ ΒΓΑΙΝΕΙ ΑΠΟ ΤΑ ΚΛΙΜΑΚΙΑ, ΟΧΙ ΑΠΟ ΤΟ 15 ──
  // Το «15%» ήταν το ΠΡΩΤΟ κλιμάκιο γραμμένο ως προεπιλογή για κάθε εισόδημα.
  // Σε ακαθάριστα 30.000€ η κλίμακα δίνει 15% ως 12.000, 25% ως 24.000 και 35%
  // παραπάνω: πραγματικός φόρος 6.375€, δηλαδή 22,4% του φορολογητέου. Η οθόνη
  // πρότεινε να κρατήσει 4.275€ — δύο χιλιάδες λιγότερα από την οφειλή, με τη
  // βεβαιότητα αριθμού που δείχνει το ίδιο πλακίδιο δίπλα στο «καθαρό».
  //
  // Ο σωστός συντελεστής υπολογιζόταν ΗΔΗ, δέκα γραμμές πιο κάτω, από το
  // `incomeStatement` — και δεν τον διάβαζε κανείς. Ο μεταγλωττιστής το έλεγε
  // («assigned a value but never used») και η προειδοποίηση διαβαζόταν ως σκουπίδι.
  const [taxPctAuto,   setTaxPctAuto]   = useState<number | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [hoverCat,     setHoverCat]     = useState<string | null>(null);
  const [delCatHover,  setDelCatHover]  = useState<string | null>(null);
  const [newCatName,   setNewCatName]   = useState('');
  const [hoverRec,     setHoverRec]     = useState<string | null>(null);
  const [hoverWeek,    setHoverWeek]    = useState<string | null>(null);
  // Το κουμπί ήταν αόρατο αλλά πατήσιμο σε οθόνη αφής: ο χρήστης διέγραφε
  // κατηγορία προϋπολογισμού χωρίς να δει τι πάτησε.
  const coarse = useCoarsePointer()
  const [exclAmtDraft, setExclAmtDraft] = useState<Record<string, string>>({});  // ό,τι πληκτρολογεί ο χρήστης στο μερικό ποσό εξαίρεσης
  const [addingCat,    setAddingCat]    = useState(false);   // εμφάνιση πεδίου «νέα κατηγορία» (inline)
  // Η μία σημείωση για την αλλαγή στα σύνολα. Διαβάζεται τεμπέλικα κατά την
  // αρχικοποίηση και όχι σε effect: η πρώτη απόδοση είναι πάντα ο σκελετός
  // (loading = true), οπότε δεν υπάρχει διαφορά server και client να συμφιλιωθεί.
  const [ledgerNoteSeen, setLedgerNoteSeen] = useState(() => {
    try { return localStorage.getItem('budget_ledger_note') === '1'; } catch { return true; }
  });
  const dismissLedgerNote = () => {
    setLedgerNoteSeen(true);
    try { localStorage.setItem('budget_ledger_note', '1'); } catch { /* ignore */ }
  };
  const [showSettings, setShowSettings] = useState(false);   // εμφάνιση ρυθμίσεων προϋπολογισμού (inline)
  const [demoBusy,     setDemoBusy]     = useState(false);   // δημιουργία/αφαίρεση δείγματος δεδομένων
  // Πλοήγηση μήνα: 0 = τρέχων, −1 = προηγούμενος … έως −12 (από το φορτωμένο ιστορικό).
  const [monthOffset,  setMonthOffset]  = useState(0);
  // Ελαχιστοποίηση ενοτήτων (μνήμη ανά ακίνητο). Ο localStorage είναι ΕΞΩΤΕΡΙΚΗ
  // πηγή, όχι κατάσταση της React: ήταν «ξεκινάω με άδειο σύνολο και το διορθώνω
  // σε effect», δηλαδή δύο αποδόσεις σε κάθε φόρτωση και μια στιγμή όπου όλες οι
  // ενότητες φαίνονταν ανοιχτές. Προεπιλογή: όλες κλειστές.
  const [collapsed, setCollapsedStore] = useRemembered<Set<string>>(
    `budget_collapsed_${propertyId}`,
    raw => new Set<string>(raw ? (JSON.parse(raw) as string[]) : COLLAPSED_BY_DEFAULT),
    v => JSON.stringify([...v]),
    COLLAPSED_SERVER,
  );
  const toggleCollapse = (key: string) => setCollapsedStore((() => {
    const n = toggleIn(collapsed, key);
    return n;
  })());

  // Η αντιστοίχιση κατηγορίας σε κουβά ζει πλέον στο κοινό λεξιλόγιο
  // (lib/expenses/taxonomy). Εδώ υπήρχε δικό της λεξικό με ΜΟΝΟ αγγλικά κλειδιά,
  // ενώ ο χρήστης καταχωρούσε «Υδραυλικός» και «Ρεύμα» στα ελληνικά: κάθε
  // χειροκίνητη δαπάνη προσγειωνόταν στις «Λοιπές», η Συντήρηση έδειχνε μηδέν.

  /** Ό,τι χρειάζεται το έσοδο βραχυχρόνιας: ποσό, νύχτες, τιμή, άφιξη. */
  type StayRow = { total: number | null; nights: number | null; nightly_rate: number | null; check_in: string | null };

  const loadData = useCallback(async () => {
    if (!propertyId) return;
    try {
      const now   = new Date();
      const y     = now.getFullYear();
      const m     = String(now.getMonth() + 1).padStart(2, '0');
      const start   = `${y}-${m}-01`;
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      const dateEnd = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;      // τέλος τρέχοντος μήνα
      // Ιστορικό 13 μηνών (τρέχων + 12 πίσω) για πρόβλεψη/ετήσια εικόνα/τάσεις.
      const histStart = `${ymOf(new Date(y, now.getMonth() - 12, 1))}-01`;
      // Παράθυρο ανάγνωσης λογαριασμών: έναν χρόνο πιο πίσω από το ιστορικό.
      const wideStart = `${ymOf(new Date(y, now.getMonth() - 24, 1))}-01`;
      // Αρχή τρέχουσας εβδομάδας (Δευτέρα) — για το εβδομαδιαίο εργαλείο (σωστό και στα όρια μήνα).
      const dow       = (now.getDay() + 6) % 7;   // Δευτέρα = 0
      const weekStartD = new Date(y, now.getMonth(), now.getDate() - dow);
      const weekStart  = `${weekStartD.getFullYear()}-${String(weekStartD.getMonth() + 1).padStart(2, '0')}-${String(weekStartD.getDate()).padStart(2, '0')}`;

      // ── ΜΙΑ ΑΝΑΓΝΩΣΗ, ΜΙΑ ΑΛΗΘΕΙΑ ────────────────────────────────────────
      // ΠΡΙΝ: έξι ερωτήματα (λογαριασμοί και δαπάνες, επί μήνα/ιστορικό/εβδομάδα),
      // με τις συνδεδεμένες δαπάνες κρυμμένες μέσω .is('bill_id', null) για να μη
      // διπλομετρηθούν. Δύο συνέπειες και οι δύο λάθος:
      //   • ο λογαριασμός μετρούσε με το ποσό του, όχι με ό,τι ΟΝΤΩΣ πληρώθηκε.
      //     Διόρθωνες τη δαπάνη σε 92 ευρώ και ο προϋπολογισμός έμενε στα 80.
      //   • οι λογαριασμοί φιλτράρονταν με created_at, δηλαδή με το πότε τους
      //     ΚΑΤΑΧΩΡΗΣΕΣ. Λογαριασμός Ιανουαρίου καταχωρημένος τον Φεβρουάριο
      //     χάλαγε δύο μήνες με μία κίνηση.
      // ΤΩΡΑ: μία ανάγνωση, συγχώνευση από τον ίδιο πυρήνα που τροφοδοτεί την
      // οθόνη Δαπάνες και τα τρία παράθυρα κόβονται από την ίδια λίστα. Ό,τι
      // δείχνουν οι Δαπάνες, αθροίζει ο Προϋπολογισμός.
      const [budgetRes, settRes, allBillsRes, allExpRes] = await Promise.all([
        settings.section(supabase, propertyId, 'budgets', userId),
        settings.sections(supabase, propertyId, ['providers','insurance','services','common'], userId),
        // Ευρύτερο παράθυρο κατά έναν χρόνο: η ημερομηνία που ΜΕΤΡΑ για έναν
        // λογαριασμό (πληρωμή ή λήξη) δεν είναι το created_at, οπότε ένας
        // λογαριασμός καταχωρημένος νωρίτερα μπορεί να ανήκει μέσα στο παράθυρο.
        // Το τελικό κόψιμο γίνεται μετά τη συγχώνευση, όπου η ημερομηνία είναι μία.
        billStore.ofProperty(supabase, propertyId, billStore.LEDGER_COLUMNS, userId, { since: wideStart }),
        expenses.ledger(supabase, propertyId, { from: histStart }),
      ]);

      // ── Έσοδα + δεσμευμένες εκροές (για το «Ασφαλές διαθέσιμο») ──
      const [propRes, loansRes, tenantsRes, staysRes] = await Promise.all([
        properties.one(supabase, propertyId, 'rental_mode,status_detail,target_rent,value,year_built,enfia,purchase_price,sqm,prop_type,postal_code'),
        loanStore.ofProperty(supabase, propertyId, userId),
        tenantStore.currentAll<{ monthly_rent: number | null }>(supabase, propertyId, 'monthly_rent'),
        // Καταλύματα από την αρχή του έτους: το τρέχον μήνα για έσοδα μήνα, το σύνολο YTD
        // για ετησιοποίηση (πρόβλεψη φόρου βραχυχρόνιας χωρίς εποχική στρέβλωση).
        stayStore.ofProperty<StayRow>(supabase, propertyId, 'total,nights,nightly_rate,check_in', userId, { from: `${y}-01-01`, to: dateEnd }),
      ]);
      // ΑΠΟ ΤΗΝ ΚΑΤΑΣΤΑΣΗ, ΟΧΙ ΑΠΟ ΤΟ ΩΜΟ `rental_mode` (lib/facts/status.ts). Το
      // παλιό βραχυχρόνιο («seasonal» χωρίς mode) έβγαινε εδώ μακροχρόνιο.
      const st = propertyStatus(propRes as StatusRow | null);
      const rMode: 'long_term' | 'short_term' | '' = st === 'rent_short' ? 'short_term' : st === 'rent_long' ? 'long_term' : '';
      setRentalMode(rMode);
      setPropSqm(Number(propRes?.sqm) || null);
      // ΤΟ ΕΡΩΤΗΜΑ ΤΟ ΑΠΑΝΤΑ Η `isHouseType`, ΟΧΙ ΕΚΦΡΑΣΗ ΕΔΩ. Η έκφραση που
      // ήταν γραμμένη σε αυτή τη γραμμή δεχόταν και τη μεζονέτα, δηλαδή έδινε
      // στο ίδιο ακίνητο άλλο τέλος από την Τιμολόγηση και από την καρτέλα του
      // λογιστή. Ο νόμος έχει δύο τιμές και όχι τρεις· ζουν στο lib/tax.
      setPropIsHouse(isHouseType(propRes?.prop_type as string | null));
      // Οι δύο σχήματα γραμμών, όπως ακριβώς τα ζητά το ερώτημα από πάνω. Ήταν
      // `any`, οπότε ένα λάθος όνομα στήλης (`nightlyRate` αντί για
      // `nightly_rate`) θα έδινε αθόρυβα μηδέν έσοδα αντί για σφάλμα.
      const stayGross = (st: StayRow) => Number(st.total) || (Number(st.nights) || 0) * (Number(st.nightly_rate) || 0);
      const staysAll  = staysRes;
      const staysMonth = staysAll.filter(st => String(st.check_in ?? '') >= start);
      // Έσοδα μήνα: βραχυχρόνια → άθροισμα καταλυμάτων του μήνα· μακροχρόνια → ενεργό
      // ενοίκιο (ή στόχος). Ιδιοκατοίκηση/χωρίς mode → 0 (κανένα «φανταστικό» έσοδο).
      let inc = 0;
      if (rMode === 'short_term') {
        inc = staysMonth.reduce((s, st) => s + stayGross(st), 0);
        setStrNights(staysMonth.reduce((s, st) => s + (Number(st.nights) || 0), 0));
      } else if (rMode === 'long_term') {
        // ΜΟΝΟ ενεργοί ενοικιαστές (όχι παλιοί/αποχωρήσαντες) — αλλιώς διπλασιάζεται το έσοδο.
        // Ο κανόνας «ποιος μένει τώρα» δεν ξαναγράφεται εδώ: το στρώμα επιστρέφει
        // ήδη μόνο όσους δεν έχουν φύγει, με τον ίδιο ορισμό σε κάθε οθόνη.
        const rentSum = tenantsRes.reduce((s, t) => s + (Number(t.monthly_rent) || 0), 0);
        inc = rentSum > 0 ? rentSum : (Number(propRes?.target_rent) || 0);
      }
      setIncome(Math.round(inc));
      // Έσοδα από την αρχή του έτους: βραχυχρόνια → πραγματικά καταλύματα YTD· μακροχρόνια
      // → αναμενόμενο ενοίκιο × μήνες που πέρασαν (δεν καταγράφουμε εισπράξεις εδώ).
      if (rMode === 'short_term') setIncomeYtd(Math.round(staysAll.reduce((s, st) => s + stayGross(st), 0)));
      else if (rMode === 'long_term') setIncomeYtd(Math.round(inc * (now.getMonth() + 1)));
      else setIncomeYtd(0);
      // Δόση δανείου: ζωντανός υπολογισμός από ενεργά δάνεια (όχι διπλομέτρηση).
      // Τα `amount`/`rate` ΔΕΝ είναι στήλες της βάσης — υπολογίζονται από το
      // loan_amount και το rate_type/fixed_rate/euribor/spread. Η μετάφραση
      // γίνεται ΜΙΑ φορά εδώ και τη μοιράζονται και οι τρεις καταναλωτές
      // παρακάτω (δόση, τόκοι έτους, υπόλοιπο κεφαλαίου).
      const activeLoans = loansRes.filter(isActiveLoan);
      // Η δόση βγαίνει από το lib/loans/shape.ts, όπως το ποσό και το επιτόκιο.
      // Ηταν γραμμένη εδώ και η Σύγκριση δεν την είχε καθόλου· τώρα υπάρχει μία
      // γραφή που δεν μπορεί να αποκλίνει από οθόνη σε οθόνη.
      // ΧΩΡΙΣ ΣΤΡΟΓΓΥΛΟΠΟΙΗΣΗ: το `Math.round` εδώ έγραφε «922,00€» ενώ η
      // Επισκόπηση, από την ίδια συνάρτηση, «922,30€». Η στρογγυλοποίηση ανήκει
      // στην εμφάνιση, που ήδη γράφει δύο δεκαδικά.
      const loanM = loansInstalmentTotal(activeLoans);
      setLoanMonthly(loanM);

      // Κλειδιά προσαρμοσμένων κατηγοριών (c_*): αν μια δαπάνη έχει αποθηκευτεί σε custom
      // κατηγορία, την προσμετράμε εκεί (αλλιώς θα «έπεφτε» στις Λοιπές δαπάνες).
      const customKeys = new Set<string>();
      const catLabels: Record<string, string> = {};
      CATS.forEach(c => { catLabels[c.key] = c.label; });
      try { const arr = JSON.parse(String((budgetRes as { __custom?: string } | null)?.__custom ?? '[]')); if (Array.isArray(arr)) (arr as CustomCatRaw[]).forEach(c => { if (c?.key) { customKeys.add(String(c.key)); if (c?.label) catLabels[String(c.key)] = String(c.label); } }); } catch { /* ignore */ }
      // Μετονομασίες (override) βασικών/custom κατηγοριών — για σωστές ετικέτες στην ανάλυση.
      try { const o = JSON.parse(String((budgetRes as { __labels?: string } | null)?.__labels ?? '{}')); if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => { if (v) catLabels[k] = String(v); }); } catch { /* ignore */ }
      // Προσαρμοσμένη κατηγορία του χρήστη μένει ως έχει· οτιδήποτε άλλο περνά
      // από το κοινό λεξιλόγιο, ελληνικά και αγγλικά μαζί.
      const catOf = (raw: string): string => { const r = String(raw ?? ''); return customKeys.has(r) ? r : budgetBucket(r); };
      const catLabelOf = (k: string): string => catLabels[k] ?? 'Λοιπές δαπάνες';
      // Εξαιρέσεις: δαπάνες/λογαριασμοί που ΔΕΝ μετράνε (ή μετράνε μερικώς) στον προϋπολογισμό.
      // Χωρίς 'amount' → εξαιρείται ΟΛΟ το ποσό· με 'amount' → εξαιρείται μόνο αυτό το μέρος
      // (π.χ. πλήρωσε 50€ ο ενοικιαστής και 50€ εγώ → εξαιρώ 50€, μετρούν 50€).
      let excluded: Record<string, ExclRule> = {};
      try { const o = JSON.parse(String((budgetRes as { __excluded?: string } | null)?.__excluded ?? '{}')); if (o && typeof o === 'object') excluded = o; } catch { /* ignore */ }
      const exclAmt = (id: string | null | undefined, full: number): number => {
        const e = id != null ? excluded[String(id)] : undefined;
        if (!e) return 0;
        const a = e.amount;
        return typeof a === 'number' && isFinite(a) && a >= 0 ? Math.min(a, Math.max(0, full)) : Math.max(0, full);
      };
      // Το ποσό που ΟΝΤΩΣ μετρά στον προϋπολογισμό (ολικό μείον το εξαιρούμενο μέρος).
      const counted = (id: string | null | undefined, full: number): number => Math.max(0, (full || 0) - exclAmt(id, full || 0));

      // ── Η ΕΝΙΑΙΑ ΛΙΣΤΑ ────────────────────────────────────────────────────
      const { entries: ledger } = mergeLedger(
        allBillsRes as LedgerBill[],
        allExpRes as unknown as LedgerExpense[],
      );
      // Ταυτότητα γραμμής για τις εξαιρέσεις. Προτεραιότητα στον λογαριασμό,
      // γιατί πριν τη συγχώνευση η γραμμή του μήνα ΗΤΑΝ ο λογαριασμός: όποιος
      // είχε εξαιρέσει κάτι, το κρατά εξαιρεμένο και μετά την αλλαγή.
      const idOf = (e: LedgerEntry): string => String(e.billId ?? e.expenseId ?? '');
      // Η εξαίρεση ισχύει με όποιο από τα δύο κλειδιά κι αν γράφτηκε.
      const countedEntry = (e: LedgerEntry): number => {
        const byBill = e.billId ? counted(e.billId, e.amount) : e.amount;
        const byExp = e.expenseId ? counted(e.expenseId, e.amount) : e.amount;
        return Math.min(byBill, byExp);
      };
      // Η ομάδα «συντήρηση» της παλιάς φόρμας υπερισχύει, γιατί ο χρήστης την
      // επέλεξε ρητά· αλλιώς αποφασίζει η κατηγορία.
      const bucketOf = (e: LedgerEntry): string =>
        e.group === 'maintenance' ? 'maintenance' : catOf(e.category);

      const inWindow = ledger.filter(e => e.date >= histStart && e.date <= dateEnd);
      const monthRows = inWindow.filter(e => e.date >= start);
      const weekRows = inWindow.filter(e => e.date >= weekStart);

      // Ιστορικά σύνολα ανά μήνα και ανά μήνα/κατηγορία — καθαρά από καταγεγραμμένες
      // εγγραφές (όχι εκτιμήσεις από ρυθμίσεις), ώστε τάση/ετήσιο να είναι έντιμα.
      const mTotals: Record<string, number> = {};
      const cMonth: Record<string, Record<string, number>> = {};
      inWindow.forEach(e => {
        const amt = countedEntry(e);
        if (amt <= 0) return;
        const ym = e.date.slice(0, 7);
        if (!ym) return;
        const key = bucketOf(e);
        mTotals[ym] = (mTotals[ym] ?? 0) + amt;
        (cMonth[ym] ??= {})[key] = (cMonth[ym][key] ?? 0) + amt;
      });
      setMonthTotals(mTotals);
      setCatMonth(cMonth);

      // ── Επαναλαμβανόμενες χρεώσεις / συνδρομές: ανάλυση 12μηνου ιστορικού ──
      // (καθαρός πυρήνας detectRecurring) — αναδεικνύει «κρυφές» συνδρομές και το
      // ετήσιο βάρος τους. Πλέον βλέπει και τους λογαριασμούς, όχι μόνο τις
      // χειροκίνητες δαπάνες: εκεί κρύβονται οι πραγματικές πάγιες χρεώσεις.
      setRecurring(detectRecurring(
        inWindow
          .filter(e => e.title.trim().length >= 3)
          .map(e => ({ date: e.date, amount: e.amount, description: e.title, category: bucketOf(e) })),
      ));

      // ── Εβδομαδιαίο εργαλείο: δαπάνες τρέχουσας εβδομάδας ανά κατηγορία ──
      const wk: Record<string, number> = {};
      weekRows.forEach(e => {
        const amt = countedEntry(e);
        if (amt <= 0) return;
        const k = bucketOf(e);
        wk[k] = (wk[k] ?? 0) + amt;
      });
      setWeekActuals(wk);

      if (budgetRes) {
        const saved = budgetRes;
        setBudgets(prev => { const n = { ...prev }; Object.entries(saved).forEach(([k, v]) => { if (k !== 'participants') n[k] = String(v); }); return n; });
      }

      const billActuals: Record<string, number> = {};
      // Στοιχεία ΟΛΟΥ του δωδεκαμήνου (λογαριασμοί + λοιπές δαπάνες) με
      // id/ποσό/κατηγορία, για τη διαχείριση εξαιρέσεων σε όποιον μήνα βλέπεις.
      const items: MonthItem[] = inWindow
        .map(e => ({ e, id: idOf(e) }))
        .filter(x => !!x.id)
        .map(({ e, id }) => ({
          id, kind: (e.billId ? 'bill' : 'expense') as 'bill' | 'expense',
          label: e.title || catLabelOf(bucketOf(e)), amount: e.amount,
          catKey: bucketOf(e), ym: e.date.slice(0, 7),
        }));
      // Ανάλυση ανά κατηγορία: οι επιμέρους πληρωμές (πάροχος/περιγραφή, ποσό, ημερομηνία).
      const bd: Record<string, { label: string; amount: number; date: string; paid: boolean; kind: 'bill' | 'expense' }[]> = {};
      // Οι γραμμές του μήνα, λογαριασμοί και δαπάνες μαζί. Άγνωστες κατηγορίες →
      // «Λοιπές δαπάνες»· δεν χάνεται τίποτα από το σύνολο. Εξαιρέσεις δεν μετρώνται.
      monthRows.forEach(e => {
        const key = bucketOf(e);
        const label = catLabelOf(key);
        const amt = countedEntry(e);
        if (amt <= 0) return;
        billActuals[key] = (billActuals[key] ?? 0) + amt;
        (bd[key] ??= []).push({ label: e.title || label, amount: amt, date: e.date, paid: e.paid, kind: e.billId ? 'bill' : 'expense' });
      });

      // Κατηγορίες με ΚΑΤΑΓΕΓΡΑΜΜΕΝΗ εγγραφή τον μήνα (ανεξάρτητα από εξαίρεση/ποσό):
      // αν ο χρήστης κατέγραψε π.χ. τον λογαριασμό Internet και μετά τον εξαίρεσε, ΔΕΝ
      // θέλει την εκτίμηση του παρόχου να τον ξαναβάζει — γι' αυτό ελέγχουμε «καταγράφηκε;»
      // και όχι το (μηδενισμένο από την εξαίρεση) billActuals.
      const recorded = new Set<string>(monthRows.map(bucketOf));

      const getSett = (sec: settings.Section) => settRes[sec];
      const prov = getSett('providers');
      if (prov) {
        if (!recorded.has('internet')) billActuals.internet = (parseFloat(String(prov.internetPrice)) || 0) + (prov.hasTV ? parseFloat(String(prov.tvPrice)) || 0 : 0);
        if (!recorded.has('water'))    billActuals.water    = waterMonthly(prov);
        if (!recorded.has('heating'))  billActuals.heating  = parseFloat(String(prov.heatingMonthly)) || 0;
      }
      const svc = getSett('services');
      if (svc && !recorded.has('services')) {
        // ΙΔΙΟ ΝΟΥΜΕΡΟ ΜΕ ΤΗΝ ΚΑΡΤΕΛΑ ΥΠΗΡΕΣΙΕΣ.
        //
        // Εδώ διαβαζόταν ΜΟΝΟ το χειροκίνητο ποσό. Όποιος χρησιμοποίησε τον
        // υπολογιστή ΕΝΦΙΑ (ζώνη, όροφος, παλαιότητα) και δεν πληκτρολόγησε
        // ξεχωριστά το ετήσιο, έβλεπε δεκάδες ευρώ τον μήνα στις Υπηρεσίες και
        // 0€ εδώ — για το ίδιο ακίνητο, την ίδια στιγμή. Ο κανόνας «το δηλωμένο
        // νικά την εκτίμηση» ζει τώρα σε ένα σημείο, στο lib/billing/enfia.ts.
        const enfia = enfiaInUse(
          svc.enfiaAnnual, svc.enfiaMonthly,
          estimateENFIA({
            sqm: parseFloat(String(svc.enfiaSqm)) || 0,
            zone: String(svc.enfiaZone || ''),
            floor: String(svc.enfiaFloor || 'second'),
            age: String(svc.enfiaAge || ''),
            ownership: parseFloat(String(svc.enfiaOwnership)) || 100,
            totalValue: parseFloat(String(svc.enfiaTotalVal)) || 0,
            propertyValue: parseFloat(String(svc.enfiaPropVal)) || 0,
            reductions: Array.isArray(svc.enfiaReductions) ? svc.enfiaReductions as string[] : [],
            // Έτος και θέση, όπως στη Λογιστική: χωρίς έτος η μείωση του μικρού
            // οικισμού δεν δινόταν ποτέ· ο ΤΚ κρίνει την εξαίρεση της Αττικής.
            year: y,
            atticaMainland: atticaMainlandFromPostcode(propRes?.postal_code as string | null | undefined),
          })?.annual,
        ).monthly;
        const hist  = Array.isArray(svc.dimotikaHistory) ? svc.dimotikaHistory as string[] : [];
        const valid = hist.filter(v => parseFloat(v) > 0);
        billActuals.services = enfia + (valid.length ? valid.reduce((s, v) => s + parseFloat(v), 0) / valid.length : 0);
      }
      const ins = getSett('insurance');
      if (ins && !recorded.has('insurance')) billActuals.insurance = parseFloat(String(ins.insCustomPrice)) || 0;
      // ΟΙ ΣΥΝΔΡΟΜΕΣ ΔΕΝ ΜΕΤΡΙΟΝΤΑΝ ΠΟΥΘΕΝΑ. Ο χρήστης δήλωνε δεκαπέντε συνδρομές
      // στην ίδια ενότητα ρυθμίσεων, η καρτέλα έγραφε σωστά το σύνολό τους και ο
      // Προϋπολογισμός έδειχνε μηδέν: διαβαζόταν ΜΟΝΟ το `insCustomPrice`, δηλαδή
      // το ασφάλιστρο. Κόστος που καταγράφεται και δεν αθροίζεται είναι χειρότερο
      // από κόστος που δεν καταγράφηκε, γιατί ο χρήστης νομίζει ότι το βλέπει.
      if (ins && !recorded.has('subscriptions')) billActuals.subscriptions = subscriptionsMonthly(ins);

      Object.values(bd).forEach(list => list.sort((a, b) => (a.date < b.date ? 1 : -1)));
      setActuals(billActuals);
      setMonthItems(items.sort((a, b) => b.amount - a.amount));
      setCatBreakdown(bd);

      // ── Έξυπνες προτάσεις αποθεματικών/φόρου (κανονικοί μηχανισμοί, χωρίς απόκλιση) ──
      // Πρόβλεψη φόρου: ετησιοποιημένα μεικτά έσοδα → statement.ts → taxProvision.
      const monthsElapsed = now.getMonth() + 1;
      const annualGross = rMode === 'short_term'
        ? (monthsElapsed > 0 ? Math.round(staysAll.reduce((s, st) => s + stayGross(st), 0) / monthsElapsed * 12) : 0)
        : rMode === 'long_term' ? Math.round(inc * 12) : 0;
      // Λειτουργικά έξοδα ετησιοποιημένα από ΚΑΤΑΓΕΓΡΑΜΜΕΝΟ YTD (ίδια βάση με τα έσοδα)
      // — όχι ένας «μονός» μήνας × 12 που θα στρέβλωνε τον φόρο επιχείρησης από μια αιχμή.
      const yStr2 = String(y) + '-';
      const ytdOpexRec = Object.entries(mTotals).filter(([ym]) => ym.startsWith(yStr2)).reduce((s, [, v]) => s + v, 0);
      const annualOpex = monthsElapsed > 0 && ytdOpexRec > 0
        ? Math.round(ytdOpexRec / monthsElapsed * 12)
        : Math.round(Object.values(billActuals).reduce((s, v) => s + v, 0) * 12);
      // Τόκοι δανείου έτους 1 (εκπίπτουν για επιχείρηση) — από τα ενεργά δάνεια.
      const loanInterestAnnual = activeLoans
        .reduce((s: number, l) => s + interestForYear(l.amount, l.rate, Number(l.years) || 0, 1), 0);
      const regime: 'individual_longterm' | 'individual_shortterm' | 'business' =
        isPro ? 'business' : rMode === 'short_term' ? 'individual_shortterm' : 'individual_longterm';
      let taxTargetAnnual = 0;
      if (annualGross > 0) {
        const stmt = incomeStatement({
          regime, grossIncome: annualGross,
          otherCashExpenses: annualOpex,
          ...(isPro ? { itemizedExpenses: annualOpex, loanInterest: Math.round(loanInterestAnnual) } : {}),
          loanPrincipal: Math.round(loanM * 12),
        });
        // Ιδιώτης: φόρος εισοδήματος. Επιχείρηση: φόρος + προκαταβολή (πραγματική ταμειακή
        // ανάγκη 1ου έτους) — ώστε το αποθεματικό να μην υπολείπεται.
        taxTargetAnnual = Math.round(stmt.incomeTax) + (isPro ? Math.round(stmt.advanceTax) : 0);
      }
      // Ο συντελεστής εφαρμόζεται στη ΦΟΡΟΛΟΓΗΤΕΑ βάση του waterfall (ακαθάριστο
      // μείον την τεκμαρτή έκπτωση), οπότε διαιρείται με την ίδια βάση — αλλιώς
      // η αναγωγή θα έδινε συντελεστή μικρότερο από τον πραγματικό.
      const taxableAnnual = annualGross * (1 - presumptiveDeductionRate());
      setTaxPctAuto(taxableAnnual > 0 && taxTargetAnnual > 0
        ? Math.min(100, Math.round(taxTargetAnnual / taxableAnnual * 1000) / 10)
        : null);
      const propValue = Number(propRes?.value) || 0;

      // ── Απόδοση επένδυσης (μόνο επαγγελματίας) — NOI/cap rate/cash-on-cash από τον πυρήνα ──
      // ── ΤΑ ΙΔΙΑ ΚΕΦΑΛΑΙΑ ΘΕΛΟΥΝ ΤΙΜΗ ΑΓΟΡΑΣ, ΟΧΙ ΑΞΙΑ ──────────────────────
      // Ίδια κεφάλαια = τιμή αγοράς μείον το ΑΡΧΙΚΟ ποσό των δανείων (όχι το
      // σημερινό υπόλοιπο): αυτό έβαλε ο ιδιοκτήτης από την τσέπη του στην
      // αγορά. Χωρίς τιμή αγοράς η απόδοση υπολογίζεται στην αξία και τα ίδια
      // κεφάλαια μένουν άγνωστα· το πλακίδιο τότε λέει τι λείπει.
      const purchasePrice = Number(propRes?.purchase_price) || 0;
      if (isPro && annualGross > 0 && (propValue > 0 || purchasePrice > 0)) {
        const basis = purchasePrice || propValue;
        const loanPrincipalOriginal = activeLoans.reduce((s: number, l) => s + l.amount, 0);
        const equity = purchasePrice > 0 ? Math.max(0, purchasePrice - loanPrincipalOriginal) : 0;
        setInvReturns({
          ...investmentReturns({ annualIncome: annualGross, annualOpEx: annualOpex, annualLoanPayment: loanM * 12, purchasePrice: basis, equityInvested: equity }),
          onPurchase: purchasePrice > 0,
        });
      } else {
        setInvReturns(null);
      }
      // ── Όριο 3+ βραχυχρόνιων (μόνο ιδιώτης) — προειδοποίηση επιχειρηματικής δραστηριότητας ──
      if (!isPro && userId) {
        setStrPropCount(await properties.countShortTerm(supabase, userId));
      } else {
        setStrPropCount(0);
      }
    } catch (_) {}
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, isPro, userId]);

  useEffect(() => {
    if (!propertyId) return;
    let mounted = true;
    const ch = supabase
      .channel(`budget_${propertyId}`)
      .on('postgres_changes' as const, { event: '*', schema: 'public', table: 'bills', filter: `property_id=eq.${propertyId}` }, () => { if (mounted) loadData(); })
      .on('postgres_changes' as const, { event: '*', schema: 'public', table: 'bills_settings', filter: `property_id=eq.${propertyId}` }, () => { if (mounted) loadData(); })
      .on('postgres_changes' as const, { event: '*', schema: 'public', table: 'expenses', filter: `property_id=eq.${propertyId}` }, () => { if (mounted) loadData(); })
      // Η κατάσταση `rtOk` κατέγραφε αν το κανάλι πραγματικού χρόνου συνδέθηκε,
      // αλλά καμία γραμμή σε ολόκληρο το repo δεν τη διάβαζε (0 αναγνώσεις σε
      // 1.755 γραμμές). Πλήρωνε ένα setState — άρα μία περιττή απόδοση όλου του
      // δέντρου του Προϋπολογισμού — σε κάθε αλλαγή κατάστασης του καναλιού και
      // το κανάλι αλλάζει κατάσταση σε κάθε επανασύνδεση δικτύου. Καμία ένδειξη
      // στην οθόνη δεν άλλαζε. Διαγράφηκε αντί να κρυφτεί.
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [propertyId, loadData, supabase]);

  // Η ΠΡΩΤΗ ΦΟΡΤΩΣΗ ΧΩΡΙΣΤΑ ΑΠΟ ΤΗ ΣΥΝΔΡΟΜΗ. Ηταν και τα δύο στο ίδιο effect:
  // «φέρε τα δεδομένα» και «άκου τις αλλαγές» είναι δύο δουλειές με ένα σώμα.
  useLoad(loadData);

  const saveBudgets = useCallback((data: Record<string, string>) => {
    if (!propertyId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await saved('Οι στόχοι προϋπολογισμού δεν αποθηκεύτηκαν',
        settings.put(supabase, propertyId, userId, 'budgets', data));
      setSaving(false);
    }, 800);
  }, [propertyId, userId, supabase]);

  // ΔΥΟ ΑΛΛΑΓΕΣ ΣΤΟΝ ΙΔΙΟ ΚΥΚΛΟ ΕΧΑΝΑΝ Η ΜΙΑ ΤΗΝ ΑΛΛΗ. Και οι δύο συναρτήσεις
  // έγραφαν `{ ...budgets, … }` διαβάζοντας το `budgets` από το κλείσιμο της
  // απόδοσης. Δύο στόχοι που ευθυγραμμίζονται μαζί —ακριβώς ό,τι κάνει η
  // πρόταση «να τους ευθυγραμμίσω;»— κρατούσαν μόνο τον δεύτερο: ο πρώτος
  // γραφόταν πάνω σε παλιό στιγμιότυπο και εξαφανιζόταν χωρίς μήνυμα.
  //
  // Με τον ενημερωτή, κάθε αλλαγή ξεκινά από την ΤΕΛΕΥΤΑΙΑ κατάσταση. Η
  // αποθήκευση είναι ήδη με καθυστέρηση 800ms και ακυρώνει την προηγούμενη,
  // οπότε δύο κλήσεις στον ίδιο κύκλο καταλήγουν σε μία εγγραφή.
  const updateBudget = useCallback((key: string, val: string) => {
    setBudgets(prev => { const next = { ...prev, [key]: val }; saveBudgets(next); return next });
  }, [saveBudgets]);

  // ── Derived numbers ────────────────────────────────────────────────────────
  // Τιμή στόχου με σεβασμό στο ρητό 0 (μηδενικός στόχος ≠ «χωρίς στόχο») — μόνο
  // κενό/άκυρο πέφτει στην προεπιλογή.
  const budgetVal = (raw: string | undefined, def: number) => {
    const p = parseFloat(raw ?? '');
    return raw != null && raw.trim() !== '' && !isNaN(p) ? p : def;
  };
  // ── Προσαρμόσιμες κατηγορίες: ο χρήστης κρύβει όσες δεν χρειάζεται και προσθέτει δικές του.
  const parseArr = (s?: string): unknown[] => { try { const a: unknown = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
  const hiddenKeys: string[] = parseArr(budgets.__hidden).map(String);
  // Μετονομασίες βασικών κατηγοριών (οι custom κρατούν το όνομά τους στο __custom).
  const labelOverrides: Record<string, string> = (() => { try { const o = JSON.parse(budgets.__labels || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } })();
  const customCats: { key: string; label: string; default: number }[] = (parseArr(budgets.__custom) as CustomCatRaw[])
    .filter(c => !!c && !!c.key && !!c.label).map(c => ({ key: String(c.key), label: labelOverrides[String(c.key)] ?? String(c.label), default: 0 }));
  const activeCats: { key: string; label: string; default: number }[] = [
    ...CATS.filter(c => !hiddenKeys.includes(c.key)).map(c => ({ key: c.key as string, label: labelOverrides[c.key] ?? (c.label as string), default: c.default as number })),
    ...customCats,
  ];
  const hiddenBaseCats = CATS.filter(c => hiddenKeys.includes(c.key));
  const catDefault    = (key: string) => activeCats.find(c => c.key === key)?.default ?? 0;
  const catBudget     = (key: string) => budgetVal(budgets[key], catDefault(key));
  const masterBudget  = budgetVal(budgets.total, activeCats.reduce((s, c) => s + c.default, 0));
  // Υπερβάσεις ΤΡΕΧΟΝΤΟΣ μήνα (για τις ειδοποιήσεις email) — η προβολή/αλλαγή μήνα
  // χρησιμοποιεί ξεχωριστό displayOver, ώστε οι ειδοποιήσεις να μένουν στον τρέχοντα μήνα.
  const overBudget    = activeCats.filter(c => (actuals[c.key] || 0) > catBudget(c.key));

  // Προσθήκη/απόκρυψη/επαναφορά κατηγορίας (αποθηκεύεται στις ρυθμίσεις budgets).
  const persistCats = (patch: Record<string, string>) => {
    setBudgets(prev => { const next = { ...prev, ...patch }; saveBudgets(next); return next });
  };
  // Το toast «Αναίρεση» πέρασε στον κοινό host: το τοπικό ζούσε σε z-index 60, δηλαδή
  // ΚΑΤΩ από κάθε παράθυρο και sticky header, οπότε η αναίρεση συχνά δεν πατιόταν.
  // Η διάρκεια δηλώνεται ρητά 6000ms — η προεπιλογή (3200ms) είναι πολύ σύντομη για
  // να προλάβει ο χρήστης να αναιρέσει μια διαγραφή κατηγορίας ή μια εξαίρεση.
  const UNDO_MS = 6000;
  const addCategory = (label: string) => {
    const name = label.trim().slice(0, 40); if (!name) return;
    // Κανένα διπλότυπο: αν υπάρχει ήδη ενεργή κατηγορία με το ίδιο όνομα, επανάφερε/άφησέ την.
    const norm = (s: string) => s.trim().toLowerCase();
    if (activeCats.some(c => norm(c.label) === norm(name))) return;
    // Αν ταιριάζει με κρυμμένη βασική κατηγορία, απλώς επανάφερέ την (αντί για διπλότυπη custom).
    const hiddenMatch = hiddenBaseCats.find(c => norm(c.label) === norm(name));
    if (hiddenMatch) { restoreCategory(hiddenMatch.key); return; }
    // Ήταν `Date.now().toString(36)`: δύο κατηγορίες που προστίθενται μέσα στο
    // ίδιο χιλιοστό του δευτερολέπτου έπαιρναν το ΙΔΙΟ κλειδί και η δεύτερη
    // αντικαθιστούσε την πρώτη. Και ήταν ακάθαρτη κλήση σε σώμα συστατικού.
    const key = `c_${randomSuffix(8)}`;
    persistCats({ __custom: JSON.stringify([...customCats.map(c => ({ key: c.key, label: c.label })), { key, label: name }]), [key]: '0' });
  };
  const removeCategory = (key: string) => {
    const label = activeCats.find(c => c.key === key)?.label ?? 'Κατηγορία';
    const snapHidden = budgets.__hidden, snapCustom = budgets.__custom;   // στιγμιότυπο για αναίρεση
    if (customCats.some(c => c.key === key)) persistCats({ __custom: JSON.stringify(customCats.filter(c => c.key !== key).map(c => ({ key: c.key, label: c.label }))) });
    else persistCats({ __hidden: JSON.stringify([...hiddenKeys, key]) });
    notify(`Η κατηγορία «${label}» αφαιρέθηκε`, { duration: UNDO_MS, action: { label: 'Αναίρεση', onClick: () => persistCats({ __hidden: snapHidden ?? '[]', __custom: snapCustom ?? '[]' }) } });
  };
  const restoreCategory = (key: string) => persistCats({ __hidden: JSON.stringify(hiddenKeys.filter(k => k !== key)) });

  // ── «Δείξε μου»: δείγμα μήνα ώστε ένας άδειος προϋπολογισμός να ζωντανέψει σε δευτερόλεπτα ──
  // Καταχωρεί ρεαλιστικές δείγμα-δαπάνες του τρέχοντος μήνα (με σωστές κατηγορίες) και κρατά
  // τα id τους στο __demo, ώστε να αφαιρούνται με ένα άγγιγμα. Σαφώς επισημασμένο ως δείγμα.
  const demoIds: string[] = (() => { try { const a = JSON.parse(budgets.__demo || '[]'); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } })();
  const seedDemo = async () => {
    if (!propertyId || demoBusy) return;
    setDemoBusy(true);
    try {
      const now = new Date(), y = now.getFullYear(), mo = now.getMonth();
      const p2 = (n: number) => String(n).padStart(2, '0');
      const dim = new Date(y, mo + 1, 0).getDate();
      const day = (d: number) => `${y}-${p2(mo + 1)}-${p2(Math.min(d, now.getDate(), dim))}`;
      const samples = [
        { d: 8,  desc: 'ΔΕΗ',                 amount: 78.40, category: 'electricity', grp: 'other' },
        { d: 12, desc: 'ΕΥΔΑΠ',               amount: 21.30, category: 'water',       grp: 'other' },
        { d: 5,  desc: 'Vodafone',            amount: 34.90, category: 'internet',    grp: 'other' },
        { d: 15, desc: 'Φυσικό αέριο',        amount: 46.00, category: 'heating',     grp: 'other' },
        { d: 10, desc: 'Κοινόχρηστα',         amount: 40.00, category: 'common',      grp: 'other' },
        { d: 3,  desc: 'Ασφάλεια κατοικίας',  amount: 18.50, category: 'insurance',   grp: 'other' },
        { d: 18, desc: 'Υδραυλικός',          amount: 60.00, category: 'maintenance', grp: 'maintenance' },
        { d: 20, desc: 'Είδη καθαριότητας',   amount: 25.00, category: 'other',       grp: 'other' },
      ];
      const payload = samples.map(s => ({ property_id: propertyId, user_id: userId || null, amount: s.amount, date: day(s.d), description: s.desc, category: s.category, expense_group: s.grp, bill_id: null }));
      const { data, error } = await expenses.insertReturning(supabase, payload);
      if (!error && data) persistCats({ __demo: JSON.stringify((data as { id: string }[]).map(r => String(r.id))) });
      await loadData();
    } finally { setDemoBusy(false); }
  };
  const removeDemo = async () => {
    if (!propertyId || demoBusy || demoIds.length === 0) return;
    setDemoBusy(true);
    const gone = await saved('Τα δείγματα δεν διαγράφηκαν', expenses.remove(supabase, demoIds));
    if (gone) { persistCats({ __demo: '[]' }); await loadData(); }
    setDemoBusy(false);
  };

  // Μετονομασία κατηγορίας: custom → ενημέρωση __custom· βασική → override στο __labels.
  const renameCategory = (key: string, label: string) => {
    const name = label.trim().slice(0, 40); if (!name) return;
    if (customCats.some(c => c.key === key)) persistCats({ __custom: JSON.stringify(customCats.map(c => c.key === key ? { key: c.key, label: name } : { key: c.key, label: c.label })) });
    else persistCats({ __labels: JSON.stringify({ ...labelOverrides, [key]: name }) });
  };

  // ── Εξαιρέσεις: όσα δεν θέλεις να μετρούν (ολικά ή μερικά) στα στατιστικά/προϋπολογισμό ──
  const excludedMap: Record<string, ExclRule> = (() => { try { const o = JSON.parse(budgets.__excluded || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } })();
  const excludedCount = Object.keys(excludedMap).length;
  const excludeItem = (id: string) => persistCats({ __excluded: JSON.stringify({ ...excludedMap, [id]: excludedMap[id] || {} }) });
  const unexcludeItem = (id: string) => { const n = { ...excludedMap }; delete n[id]; persistCats({ __excluded: JSON.stringify(n) }); };
  // Ενημέρωση ενός πεδίου του κανόνα (λόγος/σημείωση/μερικό ποσό)· κενά πεδία καθαρίζονται
  // ώστε το αποθηκευμένο JSON να μένει λιτό.
  const patchExcl = (id: string, patch: ExclRule) => {
    const next: ExclRule = { ...(excludedMap[id] || {}), ...patch };
    if (!next.payer) delete next.payer;
    if (!next.note || !next.note.trim()) delete next.note;
    if (next.amount == null || !(next.amount > 0)) delete next.amount;
    persistCats({ __excluded: JSON.stringify({ ...excludedMap, [id]: next }) });
  };
  // Εξαιρούμενο/μετρούμενο μέρος μιας εγγραφής (για ζωντανή εμφάνιση στη λίστα εξαιρέσεων).
  const exclAmountOf = (id: string, full: number): number => {
    const e = excludedMap[id]; if (!e) return 0;
    const a = e.amount;
    return typeof a === 'number' && isFinite(a) && a >= 0 ? Math.min(a, Math.max(0, full)) : Math.max(0, full);
  };

  // ── Πρόβλεψη τέλους μήνα, ετήσια εικόνα, τάση (καθαρά, από τον πυρήνα) ─────────
  const _now         = new Date();
  const _day         = _now.getDate();
  const _daysInMonth = new Date(_now.getFullYear(), _now.getMonth() + 1, 0).getDate();
  const _curYm       = ymOf(_now);
  const _priorYms    = [1, 2, 3].map(k => ymOf(new Date(_now.getFullYear(), _now.getMonth() - k, 1)));
  // Πρόβλεψη ανά κατηγορία: σταθερές ως έχουν, μεταβλητές με γραμμική προβολή.
  const catForecast  = (key: string) =>
    FIXED_CATS.includes(key) ? (actuals[key] || 0) : forecastMonthEnd(0, actuals[key] || 0, _day, _daysInMonth);
  const fixedToDate    = FIXED_CATS.reduce((s, k) => s + (actuals[k] || 0), 0);
  // ΟΛΕΣ ΟΙ ΜΗ ΠΑΓΙΕΣ ΚΑΤΗΓΟΡΙΕΣ ΠΟΥ ΜΕΤΡΑ ΚΑΙ ΤΟ ΠΛΑΚΙΔΙΟ ΤΟΥ ΜΗΝΑ. Με μόνο
  // συντήρηση και «λοιπά», οι δικές σου κατηγορίες έμπαιναν στο σύνολο αλλά όχι
  // στην πρόβλεψη, που έβγαινε μικρότερη από όσα έχουν ήδη ξοδευτεί.
  const variableToDate = activeCats.filter(c => !FIXED_CATS.includes(c.key)).reduce((s, c) => s + (actuals[c.key] || 0), 0);
  const forecastTotal  = forecastMonthEnd(fixedToDate, variableToDate, _day, _daysInMonth);
  // Κατηγορίες που, με τον τρέχοντα ρυθμό, θα ξεπεράσουν τον στόχο (χωρίς να είναι ήδη).
  const projectedOver  = activeCats.filter(c => categoryStatus(catBudget(c.key), actuals[c.key] || 0, catForecast(c.key)) === 'projected_over');

  // Ετήσια: πραγματικά YTD από καταγεγραμμένες εγγραφές (bills + λοιπές δαπάνες).
  const _yStr        = String(_now.getFullYear()) + '-';
  const ytdActual    = Object.entries(monthTotals).filter(([ym]) => ym.startsWith(_yStr)).reduce((s, [, v]) => s + v, 0);
  const annual       = annualSummary(masterBudget, ytdActual, _now.getMonth() + 1);
  // Τάση μήνα: η ΠΡΟΒΛΕΨΗ του μήνα έναντι μέσου όρου 3 προηγούμενων. Το σύνολο
  // ως τώρα είναι μισός μήνας απέναντι σε ολόκληρους: την πρώτη του μήνα έβγαζε
  // «σχεδόν 100% κάτω» κάθε φορά.
  const monthTrend   = periodTrend(forecastTotal, _priorYms.map(ym => monthTotals[ym] || 0));
  // Τάση ανά κατηγορία: ΚΑΤΑΓΕΓΡΑΜΜΕΝΟ τρέχον (όχι εκτιμήσεις παρόχων) έναντι
  // καταγεγραμμένου ιστορικού — ίδια βάση με τη μηνιαία τάση, ώστε να μη βγαίνει
  // ψεύτικο βελάκι από εκτίμηση σε πάγια κατηγορία που δεν έχει χρεωθεί ακόμη.
  const catTrend     = (key: string) => periodTrend(catMonth[_curYm]?.[key] || 0, _priorYms.map(ym => catMonth[ym]?.[key] || 0));
  // Σειρά 12 μηνών (παλαιότερος → τρέχων) ανά κατηγορία, για το μικρογράφημα τάσης.
  const _sparkYms    = Array.from({ length: 12 }, (_, i) => ymOf(new Date(_now.getFullYear(), _now.getMonth() - (11 - i), 1)));
  const catSpark     = (key: string) => _sparkYms.map(ym => catMonth[ym]?.[key] || 0);

  // ── Ετήσιο εργαλείο: ράβδοι ανά μήνα (ημερολογιακό έτος) + κατανομή ανά κατηγορία (YTD) ──
  const _curYear   = _now.getFullYear();
  const _yPrefix   = `${_curYear}-`;
  const yearBars   = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(_curYear, i, 1);
    return { ym: ymOf(d), label: d.toLocaleDateString('el-GR', { month: 'short' }).replace('.', ''), value: monthTotals[ymOf(d)] || 0 };
  });
  const catYtd     = activeCats
    .map(c => ({ label: c.label, value: Object.entries(catMonth).filter(([ym]) => ym.startsWith(_yPrefix)).reduce((s, [, m]) => s + (m[c.key] || 0), 0) }))
    .filter(x => x.value > 0);

  // ── Εβδομαδιαίο εργαλείο: δαπάνες αυτής της εβδομάδας ανά κατηγορία ──
  const weekCats   = activeCats.map(c => ({ label: c.label, value: weekActuals[c.key] || 0 })).filter(x => x.value > 0).sort((a, b) => b.value - a.value);
  const weekTotalV = weekCats.reduce((s, x) => s + x.value, 0);
  const weekMax    = Math.max(1, ...weekCats.map(c => c.value));

  // ── Rollover: αδιάθετο/υπέρβαση προηγούμενου μήνα μεταφέρεται στον τρέχοντα ──
  // Μόνο όταν υπάρχει καταγεγραμμένη δραστηριότητα τον προηγ. μήνα (αλλιώς «κενός»
  // μήνας θα έδειχνε ολόκληρο τον στόχο ως μεταφορά — παραπλανητικό).
  // Το rollover είναι ΕΠΙΛΟΓΗ του χρήστη (όχι δεδομένο) — κάποιοι θέλουν κάθε μήνα
  // «καθαρό» μηδενισμό, άλλοι σωρευτική μεταφορά. Ενεργοποιείται στους Στόχους.
  const rolloverOn    = budgets.rollover === 'true';
  const _prevYm       = _priorYms[0];
  const hasPrevMonth  = _prevYm in monthTotals;
  const carryIn       = hasPrevMonth ? rolloverNext(masterBudget, monthTotals[_prevYm] || 0).carryOut : 0;
  // «Πραγματικά διαθέσιμα» σε ΚΑΤΑΓΕΓΡΑΜΜΕΝΗ βάση και για τους δύο μήνες (η μεταφορά
  // υπολογίζεται από καταγεγραμμένα σύνολα) — αποφεύγει ανάμειξη με εκτιμήσεις παρόχων.
  const adjAvailable  = masterBudget + carryIn - (monthTotals[_curYm] || 0);
  // Η ΓΕΝΙΚΗ ΤΟΥ ΜΗΝΑ ΕΡΧΕΤΑΙ ΑΠΡΟΣΚΛΗΤΗ ΑΠΟ ΤΟΝ ΜΟΡΦΟΠΟΙΗΤΗ. Το
  // `toLocaleDateString('el-GR', { month: 'long' })` επιστρέφει «Ιουλίου», που
  // είναι σωστό σε ημερομηνία («1 Ιουλίου») και λάθος μόνο του: «Μεταφορά από
  // Ιουλίου». Το lib/core/months.ts κρατά και τις τρεις πτώσεις γι' αυτόν
  // ακριβώς τον λόγο.
  const _prevLabel    = monthAcc(new Date(_now.getFullYear(), _now.getMonth() - 1, 1).getMonth());

  // ── Επιλεγμένος μήνας προβολής (πλοήγηση) ────────────────────────────────────
  // Τρέχων μήνας: ζωντανά actuals (με εκτιμήσεις + πρόβλεψη). Παλαιότερος: ΚΑΤΑΓΕΓΡΑΜΜΕΝΑ
  // σύνολα ανά κατηγορία από το ήδη φορτωμένο 13μηνο ιστορικό — μηδέν νέα ερωτήματα.
  const isCurMonth      = monthOffset === 0;
  const viewDate        = new Date(_now.getFullYear(), _now.getMonth() + monthOffset, 1);
  const viewYm          = ymOf(viewDate);
  const viewActuals     = isCurMonth ? actuals : (catMonth[viewYm] || {});
  const viewActualTotal = activeCats.reduce((s, c) => s + (viewActuals[c.key] || 0), 0);
  // Μόνο τα καταχωρημένα των ίδιων κατηγοριών, χωρίς τις εκτιμήσεις παρόχων.
  const viewRecordedTotal = activeCats.reduce((s, c) => s + (catMonth[viewYm]?.[c.key] || 0), 0);
  // ΤΟ ΙΔΙΟ ΟΝΟΜΑ ΜΗΝΑ, ΑΠΟ ΤΗΝ ΙΔΙΑ ΠΗΓΗ. Ο μορφοποιητής του περιηγητή δίνει
  // άλλη πτώση ανάλογα με το τι του ζητάς: «Ιούλιος 2026» με τον χρόνο, σκέτο
  // «Ιουλίου» χωρίς αυτόν. Δύο κλήσεις στο ίδιο αρχείο έβγαζαν διαφορετική
  // λέξη για τον ίδιο μήνα. Το `monthYearLabel` τη λέει μία φορά.
  const viewMonthLabel  = monthYearLabel(viewYm);
  // Οι γραμμές του μήνα ΠΟΥ ΒΛΕΠΕΙΣ, για τις εξαιρέσεις. Ο κατάλογος κρατά όλο
  // το δωδεκάμηνο, δηλαδή ακριβώς όσο πάει πίσω και ο επιλογέας μήνα.
  const viewItems       = monthItems.filter(it => it.ym === viewYm);
  const displayOver     = activeCats.filter(c => (viewActuals[c.key] || 0) > catBudget(c.key));
  const canGoNewer      = monthOffset < 0;
  const canGoOlder      = monthOffset > -12;

  // ── «Ασφαλές διαθέσιμο» (Monzo Left to Spend / owner draw) ────────────────────
  // Δεσμευμένοι λογαριασμοί = ΠΡΑΓΜΑΤΙΚΟΙ πάγιοι λογαριασμοί του μήνα (καταγεγραμμένοι
  // + εκτιμήσεις παρόχων), όχι απλώς οι προεπιλεγμένοι στόχοι — αλλιώς εμφανίζεται
  // «φανταστικό» κόστος σε άδειο ακίνητο. Εκροές = λογαριασμοί + δόση δανείου.
  const committedBills = fixedToDate;
  const monthlyCost    = committedBills + loanMonthly;
  const hasIncome      = income > 0;

  // ── Έξυπνες παρατηρήσεις: 2–3 προτάσεις που «μιλούν» πάνω από τα γραφήματα ──
  // Καθαρά από τα δεδομένα, με προτεραιότητα: υπέρβαση → τάση → πρόβλεψη → μεγαλύτερη
  // δαπάνη → διαθέσιμο. Ουδέτερο ύφος, σωστά ελληνικά, χωρίς διακοσμητικό χρώμα.
  const insights: string[] = (() => {
    if (!isCurMonth) return [];
    // ═══ ΔΥΟ ΑΠΟ ΤΙΣ ΤΡΕΙΣ ΠΑΡΑΤΗΡΗΣΕΙΣ ΔΙΑΒΑΖΑΝ ΦΩΝΑΧΤΑ ΤΑ ΠΛΑΚΙΔΙΑ ΑΠΟ ΠΑΝΩ
    // ─────────────────────────────────────────────────────────────────────
    // ΜΕΤΡΗΜΕΝΟ ΣΤΗΝ ΟΘΟΝΗ ΤΟΥ ΧΡΗΣΤΗ, ΜΕ ΤΑ ΔΙΚΑ ΤΟΥ ΔΕΔΟΜΕΝΑ:
    //
    //   «Η κατηγορία «Νερό» έχει ξεπεράσει τον στόχο κατά 6,20€.»
    //   ...ενώ ΑΚΡΙΒΩΣ από πάνω η λωρίδα υπέρβασης έγραφε ήδη
    //   «Νερό υπέρβαση +6,20€ (31,20€ έναντι 25,00€)», δηλαδή το ίδιο
    //   γεγονός ΜΕ ΠΕΡΙΣΣΟΤΕΡΑ στοιχεία.
    //
    //   «Πρόβλεψη τέλους μήνα 31,00€: εντός στόχου κατά 359,00€.»
    //   ...ενώ δύο πλακίδια από πάνω γράφουν «ΠΡΟΒΛΕΨΗ ΜΗΝΑ 31,00€» και
    //   «ΔΙΑΘΕΣΙΜΟ 358,80€». Και τα δύο «διαθέσιμα» διέφεραν κατά είκοσι
    //   λεπτά, γιατί το ένα βγαίνει από την πρόβλεψη και το άλλο από τα
    //   πραγματικά: δύο αριθμοί που παριστάνουν τον ίδιο, με διαφορά.
    //
    // Μένουν ΜΟΝΟ όσες λένε κάτι που δεν γράφεται πουθενά αλλού στην οθόνη:
    // η πρόβλεψη υπέρβασης κατηγορίας (που δεν έχει συμβεί ακόμη, άρα δεν έχει
    // λωρίδα), η τάση έναντι του τριμήνου, η μεγαλύτερη δαπάνη και το τι
    // περισσεύει μετά τα πάγια.
    const out: string[] = [];
    if (overBudget.length === 0 && projectedOver.length > 0) {
      out.push(`Με τον τρέχοντα ρυθμό, η κατηγορία «${projectedOver[0].label}» θα ξεπεράσει τον στόχο πριν το τέλος του μήνα.`);
    }
    if (monthTrend.avgPrior > 0 && Math.abs(monthTrend.deltaPct) >= 8) {
      // Ακέραιο ποσοστό: είναι πρόβλεψη με ρυθμό, όχι μέτρηση στο εκατοστό.
      out.push(`Με τον ρυθμό ως τώρα, ο μήνας θα κλείσει ${Math.round(Math.abs(monthTrend.deltaPct))}% ${monthTrend.direction === 'up' ? 'πάνω από' : 'κάτω από'} τον μέσο όρο του τριμήνου.`);
    }
    const biggest = activeCats.map(c => ({ label: c.label, v: actuals[c.key] || 0 })).filter(x => x.v > 0).sort((a, b) => b.v - a.v)[0];
    if (biggest && out.length < 3) out.push(`Η μεγαλύτερη δαπάνη του μήνα είναι στην κατηγορία «${biggest.label}», με ${feAuto(biggest.v)}.`);
    // Το «τι μένει μετά τα πάγια» έφυγε κι αυτό: είναι ο αριθμός της πρώτης κάρτας.
    return out.slice(0, 3);
  })();

  // ── Προδραστικές προτάσεις: actionable, με ένα άγγιγμα εφαρμογή ──────────────
  // Ευθυγράμμιση στόχων με το πραγματικό μοτίβο των τελευταίων μηνών (ανέβασμα/μείωση)
  // και ευθυγράμμιση συνολικού στόχου με το άθροισμα κατηγοριών. Οι απορρίψεις θυμούνται
  // (__dismissed) ώστε να μην ενοχλούν ξανά. Η εφαρμογή δείχνει toast «Αναίρεση».
  const dismissedSug: string[] = (() => { try { const a = JSON.parse(budgets.__dismissed || '[]'); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } })();
  const dismissSuggestion = (key: string) => persistCats({ __dismissed: JSON.stringify([...dismissedSug, key].slice(-60)) });
  const applyTarget = (k: string, val: number, msg: string) => { const prev = budgets[k]; updateBudget(k, String(val)); notify(msg, { duration: UNDO_MS, action: { label: 'Αναίρεση', onClick: () => updateBudget(k, prev ?? '') } }); };
  // ── Η ΠΡΟΤΑΣΗ ΛΕΕΙ ΤΟ ΓΕΓΟΝΟΣ, ΤΟ ΚΟΥΜΠΙ ΛΕΕΙ ΤΗΝ ΕΝΕΡΓΕΙΑ ─────────────────
  // Έγραφε «Να ανεβάσω τον στόχο;» (πρώτο πρόσωπο χωρίς ταυτότητα) και
  // «ξεπερνά συστηματικά» με βάση δύο μήνες. Τώρα η πρόταση λέει τον μέσο όρο
  // και πόσους μήνες καλύπτει και το κουμπί γράφει το νέο ποσό.
  const targetSuggestions: { key: string; text: string; cta: string; apply: () => void }[] = (() => {
    if (!isCurMonth) return [];
    const out: { key: string; text: string; cta: string; apply: () => void }[] = [];
    const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
    activeCats.forEach(c => {
      const target = catBudget(c.key);
      const hist = _priorYms.map(ym => catMonth[ym]?.[c.key]).filter((v): v is number => typeof v === 'number' && v > 0);
      if (hist.length < 2 || target <= 0) return;
      // Ο μέσος όρος γράφεται με τα λεπτά του και λέει πόσους μήνες καλύπτει:
      // μετρούν μόνο όσοι από τους τρεις είχαν δαπάνη στην κατηγορία.
      const avg = hist.reduce((s, v) => s + v, 0) / hist.length;
      const span = hist.length === _priorYms.length
        ? `τους τελευταίους ${hist.length} μήνες`
        : `σε ${hist.length} από τους τελευταίους ${_priorYms.length} μήνες`;
      if (avg > target * 1.2) {
        const sv = round5(avg);
        const key = `raise:${c.key}:${sv}`;
        if (sv !== target && !dismissedSug.includes(key)) out.push({ key, text: `Η κατηγορία «${c.label}» είχε μέσο όρο ${feAuto(avg)} ${span}, πάνω από τον στόχο των ${feAuto(target)}.`, cta: `Ορισμός στόχου ${feAuto(sv)}`, apply: () => applyTarget(c.key, sv, `Ο στόχος της κατηγορίας «${c.label}» ενημερώθηκε`) });
      } else if (avg < target * 0.6) {
        const sv = round5(avg);
        const key = `lower:${c.key}:${sv}`;
        if (sv !== target && !dismissedSug.includes(key)) out.push({ key, text: `Η κατηγορία «${c.label}» είχε μέσο όρο ${feAuto(avg)} ${span}, κάτω από τον στόχο των ${feAuto(target)}.`, cta: `Ορισμός στόχου ${feAuto(sv)}`, apply: () => applyTarget(c.key, sv, `Ο στόχος της κατηγορίας «${c.label}» ενημερώθηκε`) });
      }
    });
    const sumCats = activeCats.reduce((s, c) => s + catBudget(c.key), 0);
    if (sumCats > 0 && Math.abs(sumCats - masterBudget) > Math.max(20, masterBudget * 0.1)) {
      const key = `total:${Math.round(sumCats)}`;
      if (!dismissedSug.includes(key)) out.push({ key, text: `Ο συνολικός μηνιαίος στόχος (${feAuto(masterBudget)}) διαφέρει από το άθροισμα των κατηγοριών (${feAuto(sumCats)}).`, cta: `Ορισμός στόχου ${feAuto(Math.round(sumCats))}`, apply: () => applyTarget('total', Math.round(sumCats), 'Ο συνολικός στόχος ευθυγραμμίστηκε') });
    }
    return out.slice(0, 3);
  })();

  // ── Ειδοποιήσεις υπέρβασης (σύνδεση με το σύστημα υπενθυμίσεων) ──────────────
  // Όταν ενεργό και υπάρχει υπέρβαση, δημιουργείται ΕΝΑ εκκρεμές γεγονός ημερολογίου
  // (source 'budget') τον μήνα — το ημερήσιο cron το στέλνει email μέσω των προτιμήσεων
  // ειδοποιήσεων του χρήστη. Όταν λυθεί η υπέρβαση ή απενεργοποιηθεί, καθαρίζεται.
  const notifyOn  = budgets.notifyOverspend === 'true';
  const overKey   = overBudget.map(c => c.key).sort().join(',');
  // Το μέγεθος της υπέρβασης μπαίνει στις εξαρτήσεις ώστε ένα ποσό που μεγαλώνει
  // (ίδια κατηγορία) να ενημερώνει το αποθηκευμένο γεγονός, όχι μόνο η αλλαγή κατηγοριών.
  const overAmt   = Math.round(overBudget.reduce((s, c) => s + ((actuals[c.key] || 0) - catBudget(c.key)), 0));

  // ── Waterfall εσόδου βραχυχρόνιας: μεικτό → καθαρό (persona: short_term) ──────
  // Παραδοχές (προμήθεια/διαχείριση/φόρος) επεξεργάσιμες· εκτίμηση, όχι λογιστική.
  const isSTR          = rentalMode === 'short_term';
  const strPlatformPct = budgetVal(budgets.strPlatformPct, 15);
  const strMgmtPct     = budgetVal(budgets.strMgmtPct, 0);
  const strTaxPct      = budgetVal(budgets.strTaxPct, taxPctAuto ?? 15);
  // ── ΤΕΛΟΣ ΑΝΘΕΚΤΙΚΟΤΗΤΑΣ: ΜΙΑ πηγή ──────────────────────────────────────────
  // Εδώ καλούνταν τοπικό climateFeePerNight() του budgetPro.ts, που επέστρεφε
  // 1,50€/νύχτα υψηλή περίοδο. Η πηγή αλήθειας (lib/billing/greekTax.ts) λέει
  // 8€ για διαμέρισμα και 15€ για μονοκατοικία >80 τ.μ. — πενταπλάσια ως
  // δεκαπλάσια διαφορά, στο ΙΔΙΟ ακίνητο, με το ίδιο νομικό όνομα στην οθόνη.
  //
  // Ο Προϋπολογισμός έδειχνε 30€ εκεί που η Λογιστική έδειχνε 160€ και ο
  // οικοδεσπότης προγραμμάτιζε με 130€ λιγότερη οφειλή προς την ΑΑΔΕ τον μήνα.
  const climateFeeNight = isHighSeasonMonth(_now.getMonth())
    ? climateLevyRates(propSqm, propIsHouse).high
    : climateLevyRates(propSqm, propIsHouse).low;

  const waterfall      = isSTR && income > 0
    ? strWaterfall({ gross: income, platformFeePct: strPlatformPct, nights: strNights, climateFeePerNight: climateFeeNight, cleaningFee: 0, managementPct: strMgmtPct, incomeTaxPct: strTaxPct })
    : null;

  // ── ΤΟ ΔΙΑΘΕΣΙΜΟ ΞΕΚΙΝΑ ΑΠΟ ΤΟ ΚΑΘΑΡΟ ΤΟΥ WATERFALL, ΟΧΙ ΑΠΟ ΤΙΣ ΕΙΣΠΡΑΞΕΙΣ ──
  // Στη βραχυχρόνια το `income` είναι το μεικτό των διαμονών. Το «Ασφαλές
  // διαθέσιμο» αφαιρούσε μόνο λογαριασμούς και δόση και έγραφε +272,92€, ενώ η
  // κάρτα από κάτω αφαιρούσε ΚΑΙ προμήθεια πλατφόρμας ΚΑΙ κράτηση φόρου: το
  // σωστό ήταν περίπου −97€. Οι κρατήσεις του εσόδου (προμήθεια, τέλος,
  // διαχείριση, φόρος) είναι το `income − waterfall.net` και μπαίνουν πρώτες.
  const incomeDeductions = waterfall ? income - waterfall.net : 0;
  const safeRaw          = income - incomeDeductions - monthlyCost;
  const isShortfall      = hasIncome && safeRaw < 0;
  useEffect(() => {
    if (!propertyId || !userId || loading) return;
    let cancelled = false;
    (async () => {
      const y = _now.getFullYear(), mo = _now.getMonth();
      const p2 = (n: number) => String(n).padStart(2, '0');
      const mStart = `${y}-${p2(mo + 1)}-01`;
      const mEnd   = `${y}-${p2(mo + 1)}-${new Date(y, mo + 1, 0).getDate()}`;
      // Διαβάζουμε ΟΛΑ τα φετινομηνιάτικα 'budget' γεγονότα (όχι limit 1) ώστε τυχόν
      // διπλότυπα από ταυτόχρονες εγγραφές να καθαρίζονται αντί να μένουν να στέλνουν email.
      const ids = await calendar.ids(supabase, propertyId, { source: 'budget' }, { from: mStart, to: mEnd });
      if (cancelled) return;
      if (notifyOn && overBudget.length > 0) {
        const total = overBudget.reduce((s, c) => s + ((actuals[c.key] || 0) - catBudget(c.key)), 0);
        const title = `Υπέρβαση προϋπολογισμού: ${overBudget.map(c => c.label).join(', ')}`;
        if (ids.length > 0) {
          await saved('Η ειδοποίηση υπέρβασης δεν ενημερώθηκε',
            calendar.update(supabase, ids[0], { title, amount: Math.round(total) }));
          if (ids.length > 1 && !cancelled) await saved('Οι διπλές ειδοποιήσεις δεν καθαρίστηκαν',
            calendar.remove(supabase, ids.slice(1)));
        } else if (!cancelled) {
          await saved('Η ειδοποίηση υπέρβασης δεν δημιουργήθηκε', calendar.insert(supabase, [calendar.row({ propertyId, userId }, 'budget', {
            title, category: 'financial',
            event_date: `${y}-${p2(mo + 1)}-${p2(_now.getDate())}`, priority: 'high',
            amount: Math.round(total),
          })]));
        }
      } else if (ids.length > 0) {
        await saved('Η ειδοποίηση υπέρβασης δεν αφαιρέθηκε',
          calendar.remove(supabase, ids));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, userId, loading, notifyOn, overKey, overAmt]);

  return {
    isPro, budgets, actuals, monthTotals, catMonth, income, incomeYtd, loanMonthly, rentalMode,
    propSqm, strNights, recurring, monthItems, catBreakdown, openCats, setOpenCats, invReturns,
    strPropCount, taxPctAuto, loading, saving, hoverCat, setHoverCat, delCatHover, setDelCatHover,
    newCatName, setNewCatName, hoverRec, setHoverRec, hoverWeek, setHoverWeek, coarse, exclAmtDraft,
    setExclAmtDraft, addingCat, setAddingCat, ledgerNoteSeen, dismissLedgerNote, showSettings,
    setShowSettings, demoBusy, setMonthOffset, collapsed, toggleCollapse, loadData, updateBudget,
    labelOverrides, activeCats, hiddenBaseCats, catBudget, masterBudget, persistCats, UNDO_MS,
    addCategory, removeCategory, restoreCategory, demoIds, seedDemo, removeDemo, renameCategory,
    excludedMap, excludedCount, excludeItem, unexcludeItem, patchExcl, exclAmountOf, _curYm,
    catForecast, forecastTotal, projectedOver, annual, catTrend, _sparkYms, catSpark, yearBars,
    catYtd, weekCats, weekTotalV, weekMax, rolloverOn, _prevYm, hasPrevMonth, carryIn, adjAvailable,
    _prevLabel, isCurMonth, viewYm, viewActuals, viewActualTotal, viewRecordedTotal, viewMonthLabel,
    viewItems, displayOver, canGoNewer, canGoOlder, committedBills, monthlyCost, hasIncome,
    insights, dismissSuggestion, targetSuggestions, notifyOn, isSTR, strPlatformPct, strMgmtPct,
    strTaxPct, waterfall, incomeDeductions, safeRaw, isShortfall,
  }
}

export type BudgetState = ReturnType<typeof useBudget>
