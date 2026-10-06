'use client';

import { useState, useEffect, useRef } from 'react';
import { daysUntil } from '@/lib/core/time';
import { createClient } from '@/lib/supabase/client';
import * as properties from '@/lib/data/properties';
import * as loanStore from '@/lib/data/loans';
// Οι ρυθμίσεις ανά ενότητα έχουν ένα σπίτι: lib/data/settings.
import * as settings from '@/lib/data/settings';
import * as checklist from '@/lib/data/checklist';
import * as tenantStore from '@/lib/data/tenants';
import * as calendar from '@/lib/data/calendar'
import * as expenseStore from '@/lib/data/expenses'
import { athensToday, monthEndIso } from '@/lib/core/time'
import { monthNom } from '@/lib/core/months'
import { notify } from '@/components/Toast'
import { saved } from '@/components/dbWrite'
import { NumberInput, CustomSelect, TextInput, DatePicker } from './UIComponents';
import { useBillsSettings } from './BillsSettings';
import { ReminderLinks } from './ReminderLinks';
import { findDuplicates, type ExpenseLike } from '@/lib/expenses/duplicates';
import { T, TT, fe, feWhole, fieldRow, fixedCols, SecHdr, InfoBanner, Skeleton, SkeletonKPIs, localDay, pressable, Btn, IconBtn, ChipToggle } from '@/components/Theme';
// Ο κατάλογος συνδρομών ζει στο lib: τον διαβάζει και ο Προϋπολογισμός.
import { SUB_GROUPS, entryPlanId,
         subShare, type SubKey} from '@/lib/expenses/subscriptions';
import { SUBSCRIPTION_CATEGORY, subscriptionCharges, bookableTotal,
         reverseChargeTotal, missingCountry, toExpenses, type BookableEntry} from '@/lib/expenses/subscriptionBooking';
import { HAS_BUSINESS, type LegalForm } from '@/lib/accounting/dossier';
import { freshness } from '@/lib/energy/freshness';
import { seedInsurance, type PropertyInsurance } from '@/lib/insurance/seed';
import { assessNeeds, matchPlans, explain, NEED_LABEL, type PropertyRisk } from '@/lib/insurance/match';
import {
  INSURANCE_VERIFIED, INSURANCE_MAX_AGE_DAYS, distinctInsurers, INSURANCE_COMPANIES,
  type OtherSub, QUOTE_FILTERS, type QuoteFilter, type LiveQuote, computeLiveQuotes,
  deriveCoverages,
} from './insurance/catalog'
import { SubscriptionSection } from './insurance/SubscriptionSection'
import { navLabel } from '@/lib/nav/labels'
import { propertyStatus, isLease, type StatusRow } from '@/lib/facts/status';
import { AsOfNote } from '@/components/AsOfNote';
import { PRICE_FACTS } from '@/lib/facts/prices';
import { ENFIA_REDUCTIONS } from '@/lib/billing/enfia';
import { fpRate } from '@/lib/core/format';

/**
 * Η ασφάλεια κατοικίας και οι συνδρομές streaming δεν είναι ίδιο πράγμα και
 * δεν τα ανοίγει κανείς μαζί. Το `only` δηλώνει ποια κάρτα πατήθηκε.
 */
export type InsuranceScope = 'insurance' | 'subscriptions';

// Σταθερή αναφορά για «καμία προσφορά».
const NO_QUOTES: LiveQuote[] = [];

// Η μείωση ΕΝΦΙΑ της ασφαλισμένης κατοικίας: ποσοστά και κατώφλι από τον πίνακα
// του ΕΝΦΙΑ, όχι γραμμένα εδώ. «Μπορεί να», γιατί κρίνεται και από την αξία
// της κατοικίας και από τη διάρκεια της ασφάλισης, που εδώ δεν ξέρουμε.
const INS_REDUCTION = ENFIA_REDUCTIONS.find(r => r.key === 'insurance')!;
const INS_REDUCTION_OVER = INS_REDUCTION.pctOver!;

export default function BillsInsurance({ propertyId, userId = '', only, legalForm = 'individual' }: {
  propertyId: string; userId?: string; only?: InsuranceScope; legalForm?: LegalForm;
}) {
  const show = (k: InsuranceScope) => !only || only === k;
  // ΤΟ ΚΡΙΤΗΡΙΟ ΕΙΝΑΙ Η ΝΟΜΙΚΗ ΜΟΡΦΗ ΚΑΙ ΔΗΛΩΘΗΚΕ ΜΙΑ ΦΟΡΑ ΣΤΗΝ ΥΠΟΔΟΧΗ.
  // Δεν ξαναρωτιέται εδώ με τοπικό διακόπτη: η εφαρμογή έχει ήδη πληρώσει αυτό
  // το λάθος αλλού, με τρεις οθόνες να κρατούν τρεις διαφορετικές απαντήσεις.
  const isBusiness = HAS_BUSINESS.has(legalForm);
  const supabase = createClient();
  const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: 20, marginBottom: 16 };
  // ΤΡΙΑ ΠΕΔΙΑ ΣΕ ΔΥΟ ΣΤΗΛΕΣ ΑΦΗΝΟΥΝ ΤΟ ΤΡΙΤΟ ΜΟΝΟ ΤΟΥ. Μετρημένο στα 430:
  // «2+1», με το «Πραγματικό κόστος τον μήνα» σε μισό πλάτος και τρύπα δίπλα.
  // Ιδια κλάση και ίδιοι κανόνες με τους δείκτες του KPIGrid: στα στενά πλάτη
  // μία στήλη, που είναι ζυγισμένη.
  const g3: React.CSSProperties  = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 14, marginBottom: 14, '--kpi-lg': 3, '--kpi-md': 3, '--kpi-sm': 1 } as React.CSSProperties;
  // ΤΑ 120 ΕΚΟΒΑΝ ΤΟ «ΟΝΟΜΑΤΕΠΩΝΥΜΟ». Το πεδίο άφηνε 99 ως 127 εικονοστοιχεία
  // για ένα παράδειγμα που ζητά 132, σε τρία από τα οκτώ πλάτη. Το ελάχιστο
  // ενός πεδίου δεν είναι αισθητική επιλογή, είναι το πλατύτερο κείμενο που
  // πρέπει να χωρέσει μέσα του.
  const g4: React.CSSProperties  = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 14, marginBottom: 14 };

  // ── Cross-tab: checklist renewal ─────────────────────────────────────────
  const [checklistRenewal, setChecklistRenewal] = useState<{ daysLeft: number | null } | null>(null);
  // ── Cross-tab: property data from other tabs ─────────────────────────────
  const [scanned, setScanned] = useState<PropertyInsurance | null>(null);
  const [crossProperty, setCrossProperty] = useState<{
    sqm?: string; zone?: string; floor?: string; age?: string;
    propValue?: string; contentValue?: string; city?: string;
    propertyType?: string; isRented?: boolean;
    // Από πού ήρθαν τα τετραγωνικά, ώστε η ένδειξη προσυμπλήρωσης να λέει την
    // πραγματική πηγή. Έλεγε πάντα «από ΕΝΦΙΑ» — που ήταν και η μόνη πηγή που
    // δούλευε, αφού το ακίνητο διαβαζόταν από ανύπαρκτο πίνακα.
    sqmFrom?: 'enfia' | 'property';
    // Τα τέσσερα που κρίνουν την πρόταση και που δεν φορτώνονταν ποτέ.
    yearBuilt?: number | null;
    rentalMode?: 'long_term' | 'short_term' | '';
    furnished?: boolean;
    hasLoan?: boolean;
    monthlyRent?: number | null;
  }>({});
  const [calendarSynced, setCalendarSynced] = useState(false);
  // ── Live quotes state ─────────────────────────────────────────────────────
  // ΟΙ ΠΡΟΣΦΟΡΕΣ ΚΟΥΒΑΛΟΥΝ ΤΑ ΣΤΟΙΧΕΙΑ ΑΠΟ ΤΑ ΟΠΟΙΑ ΒΓΗΚΑΝ. Αλλιώς, μεταξύ
  // πληκτρολόγησης και υπολογισμού, ο πίνακας δείχνει ασφάλιστρα που
  // υπολογίστηκαν για ΑΛΛΑ τετραγωνικά, σε οθόνη που ζητά απόφαση αλλαγής
  // παρόχου. Με το κλειδί, ό,τι δεν ταιριάζει δεν υπάρχει.
  const [quoted, setQuoted] = useState<{ key: string; rows: LiveQuote[] } | null>(null);
  const [quotesFilter,    setQuotesFilter]    = useState<QuoteFilter>('all');
  const [showQuotes,      setShowQuotes]      = useState(false);
  const quotesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!propertyId) return;
    (async () => {
      try {
        const chk = await checklist.matchingDescription<{ status: string | null; due_date: string | null }>(
          supabase, propertyId, 'status,due_date', '%ασφαλιστήριο%', userId);
        if (chk[0]) setChecklistRenewal({ daysLeft: chk[0].due_date ? daysUntil(chk[0].due_date) ?? 0 : null });

        // Property data from services (ΕΝΦΙΑ has sqm, zone, floor, age)
        const svcData = await settings.section(supabase, propertyId, 'services', userId);
        // ΤΟ ΑΚΙΝΗΤΟ ΔΕΝ ΔΙΑΒΑΖΟΤΑΝ ΠΟΤΕ. Η ερώτηση πήγαινε στον πίνακα
        // `properties`, που δεν υπάρχει στη βάση — τα ακίνητα ζουν στο
        // `user_properties`. Γύριζε πάντα σφάλμα, οπότε τα τετραγωνικά και η
        // περιοχή έμεναν άδεια και η οθόνη ζητούσε από τον ιδιοκτήτη να
        // ξαναγράψει στοιχεία που το ακίνητό του ήδη είχε καταχωρημένα.
        //
        // Δεύτερη αιτία της ίδιας ζημιάς: ζητούνταν οι στήλες `city` και
        // `furnished`, που ούτε αυτές υπάρχουν στο σχήμα. Μία ανύπαρκτη στήλη
        // ρίχνει ΟΛΟΚΛΗΡΟ το select, άρα μαζί τους χανόταν και το έτος
        // κατασκευής και ο τρόπος εκμετάλλευσης — ακριβώς τα δεδομένα πάνω στα
        // οποία στηρίζεται η πρόταση ασφάλισης. Η περιοχή έρχεται τώρα από τη
        // διεύθυνση και το «επιπλωμένο» από τη μίσθωση, όπου όντως ζει.
        const [prop, activeLoan, activeTenants] = await Promise.all([
          properties.one(supabase, propertyId, 'address,sqm,prop_type,status_detail,year_built,rental_mode,target_rent,insurance_company,insurance_expiry,insurance_amount', userId),
          loanStore.hasActive(supabase, propertyId, userId),
          tenantStore.currentAll<{ monthly_rent?: number | null; furnishing?: string | null }>(supabase, propertyId, 'monthly_rent,furnishing', userId),
        ]);
        // Ο κανόνας του «ενεργό» ζει στο lib/loans/shape.ts, όχι σε δύο συγκρίσεις εδώ.
        // Το φιλτράρισμα «όχι past και χωρίς ημερομηνία αποχώρησης» ζούσε εδώ και
        // σε άλλα τέσσερα αρχεία, γραμμένο κάθε φορά από την αρχή. Το στρώμα το κάνει.
        const activeRent = activeTenants
          .reduce((s, t) => s + (Number(t.monthly_rent) || 0), 0);
        const isFurnished = activeTenants.some(t => {
          const f = t.furnishing ?? undefined;
          return f === 'furnished' || f === 'turnkey';
        });
        const p = (prop ?? {}) as {
          address?: string; sqm?: number; prop_type?: string; status_detail?: string;
          year_built?: number; rental_mode?: string; target_rent?: number;
          insurance_company?: string | null; insurance_expiry?: string | null; insurance_amount?: number | null;
        };
        // ΤΟ ΣΑΡΩΜΕΝΟ ΑΣΦΑΛΙΣΤΗΡΙΟ ΦΤΑΝΕΙ ΕΠΙΤΕΛΟΥΣ ΕΔΩ. Η σάρωση διάβαζε
        // ασφαλιστική, ασφάλιστρο και λήξη από τη φωτογραφία και τα έγραφε στο
        // ακίνητο· η οθόνη διάβαζε άλλο αποθετήριο και ζητούσε τα ίδια στοιχεία
        // ξανά, με το χέρι. Οι κανόνες ζουν στο `lib/insurance/seed.ts` με tests:
        // ό,τι έχει πειράξει ο ιδιοκτήτης μένει ανέπαφο, ό,τι είναι ακόμη στην
        // προεπιλογή συμπληρώνεται από το συμβόλαιό του.
        setScanned({
          insurance_company: p.insurance_company ?? null,
          insurance_expiry: p.insurance_expiry ?? null,
          insurance_amount: p.insurance_amount ?? null,
        });
        if (svcData || prop) {
          // Τα διασταυρούμενα στοιχεία έρχονται από τις ρυθμίσεις ΕΝΦΙΑ, όπου το `data`
        // είναι ελεύθερο jsonb. Δηλώνονται όσα πεδία διαβάζονται και μόνο αυτά.
        const d = (svcData ?? {}) as { enfiaSqm?: string; enfiaZone?: string; enfiaFloor?: string; enfiaAge?: string };
          const propSqm = p.sqm ? String(p.sqm) : '';
          setCrossProperty({
            sqm:          d.enfiaSqm       || propSqm         || '',
            sqmFrom:      d.enfiaSqm ? 'enfia' : propSqm ? 'property' : undefined,
            zone:         d.enfiaZone      || '',
            floor:        d.enfiaFloor     || 'second',
            age:          d.enfiaAge       || 'y10_14',
            city:         p.address        || '',
            propertyType: p.prop_type      || '',
            // Η κατάσταση από το lib/facts: το «seasonal» και το rental_mode μετρούν κι αυτά.
            isRented:     isLease(propertyStatus(p as StatusRow)),
            yearBuilt:    Number(p.year_built) || null,
            rentalMode:   propertyStatus(p as StatusRow) === 'rent_short' ? 'short_term' : propertyStatus(p as StatusRow) === 'rent_long' ? 'long_term' : '',
            furnished:    isFurnished,
            hasLoan:      activeLoan,
            monthlyRent:  activeRent || Number(p.target_rent) || null,
          });
        }
      } catch (_) {}
    })();
  }, [propertyId, supabase, userId]);

  const [ps, updPs, loading] = useBillsSettings(propertyId, userId, 'insurance', {
    // ΚΑΜΙΑ ΠΡΟΕΠΙΛΕΓΜΕΝΗ ΑΣΦΑΛΙΣΤΙΚΗ. Ήταν 'hellas_direct'/'hd_full': ένας
    // ιδιοκτήτης που δεν είχε ασφαλίσει ποτέ το ακίνητό του έβλεπε συγκεκριμένη
    // εταιρεία ήδη επιλεγμένη ως «τρέχον πρόγραμμα», με το ασφάλιστρο ΕΚΕΙΝΗΣ
    // να μετράει στα σύνολα της οθόνης. Το άγνωστο εμφανιζόταν ως γεγονός και
    // μάλιστα ως εμπορική επιλογή που κανείς δεν έκανε.
    insProvider: '', insPlanId: '',
    insCustomPrice: '', insCustomPlanName: '',
    insAgentName: '', insAgentPhone: '', insRenewalDate: '',
    insPropValue: '', insContentValue: '',
    insCustomCovers: '', insEditCovers: false,
    insCustomEarthquake: false, insCustomFlood: false, insCustomNatural: false,
    // NEW: property details for live quotes
    insSqm: '', insFloor: 'second', insAge: 'y10_14', insCity: '',
    activeStreaming: [] as BookableEntry[],
    activeSports:    [] as BookableEntry[],
    activeCloud:     [] as BookableEntry[],
    otherSubs:       [] as OtherSub[],
  });

  const {
    insProvider, insPlanId, insCustomPrice, insAgentName, insAgentPhone,
    insRenewalDate, insPropValue, insContentValue, insCustomCovers, insEditCovers,
    insCustomEarthquake, insCustomFlood, insCustomNatural,
    insSqm, insFloor, insAge, insCity, otherSubs,
  } = ps;

  // Οι ρυθμίσεις ασφάλισης έχουν σχήμα και το `u` το σέβεται: μια ορθογραφία σε
// όνομα πεδίου γίνεται σφάλμα μεταγλώττισης αντί για ρύθμιση που δεν ισχύει ποτέ.
type InsuranceSettings = typeof ps;
const u = (patch: Partial<InsuranceSettings>) => updPs(patch);

  // ── Η ΣΥΜΠΛΗΡΩΣΗ ΑΠΟ ΤΟ ΣΑΡΩΜΕΝΟ ΣΥΜΒΟΛΑΙΟ ────────────────────────────────
  // Τρέχει ΜΙΑ φορά, όταν φτάσουν και τα δύο (ρυθμίσεις και ακίνητο) και μόνο
  // αν έχει κάτι να γράψει. Η `seedInsurance` επιστρέφει κενό αντικείμενο όταν
  // δεν αλλάζει τίποτα — μια περιττή εγγραφή σε κάθε φόρτωση δεν είναι αθώα:
  // γεννά συμβάν realtime που ξαναφορτώνει την ίδια οθόνη, σε βρόχο.
  const seededRef = useRef(false);
  useEffect(() => {
    if (loading || !scanned || seededRef.current) return;
    const patch = seedInsurance(ps, scanned, { insProvider: 'hellas_direct' },
      INSURANCE_COMPANIES.map(c => ({ value: c.value, label: c.label })));
    seededRef.current = true;
    if (Object.keys(patch).length) updPs(patch);
  }, [loading, scanned, ps, updPs]);

  // Αυτόματη συμπλήρωση από άλλες καρτέλες, όταν δεν το έχει ορίσει ο χρήστης
  // Καθαρή αναζήτηση σε σταθερό πίνακα. Δηλωνόταν ΜΕΤΑ το effect που τη
  // διαβάζει και δούλευε μόνο επειδή η ανάγνωση γινόταν μέσα σε setTimeout.
  const insCompany = INSURANCE_COMPANIES.find(c => c.value === insProvider);
  const effectiveSqm    = insSqm    || crossProperty.sqm    || '';
  const effectiveFloor  = insFloor  || crossProperty.floor  || 'second';
  const effectiveAge    = insAge    || crossProperty.age    || 'y10_14';
  const effectiveCity   = insCity   || crossProperty.city   || '';

  // ── Live quotes computation (debounced) ──────────────────────────────────
  const quotesKey = [effectiveSqm, insPropValue, insContentValue, effectiveFloor, effectiveAge, insCustomPrice, insPlanId].join('|');
  const liveQuotes = quoted?.key === quotesKey ? quoted.rows : NO_QUOTES;
  const quotesLoading = quoted?.key !== quotesKey && !!(parseFloat(effectiveSqm) && parseFloat(insPropValue));

  useEffect(() => {
    const sqm    = parseFloat(effectiveSqm)   || 0;
    const pVal   = parseFloat(insPropValue)   || 0;
    const cVal   = parseFloat(insContentValue)|| 0;

    // ΧΩΡΙΣ ΤΕΤΡΑΓΩΝΙΚΑ ΚΑΙ ΑΞΙΑ ΔΕΝ ΥΠΑΡΧΕΙ ΠΡΟΣΦΟΡΑ, ΔΕΝ ΣΒΗΝΕΤΑΙ ΠΡΟΣΦΟΡΑ.
    // Ηταν `setLiveQuotes([])` σύγχρονα μέσα στο effect. Πλέον οι προσφορές
    // κρατούν το κλειδί των στοιχείων από τα οποία βγήκαν και διαβάζονται μόνο
    // όταν ταιριάζει: κανείς δεν βλέπει ποτέ τιμή ασφάλισης που υπολογίστηκε
    // για άλλα τετραγωνικά.
    if (!sqm || !pVal) return;

    if (quotesTimer.current) clearTimeout(quotesTimer.current);
    // Μικρή καθυστέρηση επειδή ο χρήστης πληκτρολογεί, ΟΧΙ για να μιμηθεί
    // κλήση σε διακομιστή. Ο παλιός κώδικας περίμενε 800ms με τη σημείωση
    // «Simulate API latency»: έδειχνε στον χρήστη ότι κάτι ρωτιέται κάπου, ενώ
    // ο υπολογισμός γινόταν τοπικά. Το ψεύτικο περίμενε είναι ψέμα στην οθόνη.
    quotesTimer.current = setTimeout(() => {
      const quotes = computeLiveQuotes(sqm, pVal, cVal, effectiveFloor, effectiveAge);
      const currentMonthly = parseFloat(insCustomPrice) || (insCompany?.plans ?? []).find(p => p.id === insPlanId)?.monthly || 0;
      const withSavings = quotes.map(q => ({ ...q, savings: currentMonthly > 0 ? currentMonthly - q.monthlyEstimate : undefined }));
      setQuoted({ key: quotesKey, rows: withSavings });
    }, 250);

    return () => { if (quotesTimer.current) clearTimeout(quotesTimer.current); };
  // ΤΟ `insProvider` ΕΛΕΙΠΕ ΚΑΙ ΗΤΑΝ ΠΡΑΓΜΑΤΙΚΟ ΣΦΑΛΜΑ. Το `currentMonthly`
  // διαβάζεται από `insCompany?.plans`, δηλαδή από την ΕΤΑΙΡΕΙΑ. Με αλλαγή
  // εταιρείας και ίδιο αναγνωριστικό προγράμματος, ο υπολογισμός έμενε στην
  // παλιά — και η στήλη «εξοικονόμηση» έβγαινε από λάθος ασφάλιστρο, δηλαδή
  // λάθος νούμερο σε οθόνη που ζητά απόφαση αλλαγής παρόχου.
  }, [effectiveSqm, insPropValue, insContentValue, effectiveFloor, effectiveAge, insCustomPrice, insPlanId, insCompany?.plans, quotesKey]);

  const insPlan    = (insCompany?.plans ?? []).find(p => p.id === insPlanId);
  const insCost    = parseFloat(insCustomPrice) || insPlan?.monthly || 0;
  /** Ξέρουμε ασφάλιστρο; Χωρίς αυτό, το «0,00€» θα σήμαινε «δεν πληρώνω». */

  const effectiveCovers     = insEditCovers && insCustomCovers ? insCustomCovers.split(',').map(s => s.trim()).filter(Boolean) : (insPlan?.covers || []);
  const effectiveEarthquake = insEditCovers ? insCustomEarthquake : (insPlan?.earthquake || false);
  const effectiveFloodState = insEditCovers ? insCustomFlood      : (insPlan?.flood      || false);
  const effectiveNatural    = insEditCovers ? insCustomNatural    : (insPlan?.natural    || false);

  // ── ΟΙ ΟΜΑΔΕΣ ΣΥΝΔΡΟΜΩΝ, ΜΕ ΤΑ ΔΙΚΑ ΤΟΥΣ ΣΥΝΟΛΑ ΚΑΙ ΧΕΙΡΙΣΜΟΥΣ ───────────
  // Ο υπολογισμός του κόστους ήταν γραμμένος δύο φορές, δίπλα δίπλα και ήδη
  // είχε αποκλίνει από το `subShare` που χρησιμοποιεί η ίδια οθόνη λίγο πιο
  // πάνω. Μία συνάρτηση, τρεις ομάδες.
  const subGroups = SUB_GROUPS.map(g => {
    const active = ps[g.key] || [];
    // Η TypeScript δεν στενεύει υπολογισμένο κλειδί που είναι ένωση τριών
    // ονομάτων, γι' αυτό το `Pick`: το κλειδί προέρχεται από τον `SubKey`,
    // δηλαδή είναι εξ ορισμού πεδίο των ρυθμίσεων.
    const write = (list: BookableEntry[]) => u({ [g.key]: list } as Pick<InsuranceSettings, SubKey>);
    return {
      ...g,
      active,
      cost: active.reduce((s, a) => s + subShare(g.catalog.find(x => x.value === a.service), a), 0),
      toggle: (svc: string) => write(
        active.some(a => a.service === svc)
          ? active.filter(a => a.service !== svc)
          : [...active, { service: svc, planId: entryPlanId(g.catalog, svc),
                          customPrice: '', splitPeople: 2, splitActive: false, renewalDate: '' }],
      ),
      update: <K extends keyof BookableEntry>(svc: string, field: K, val: BookableEntry[K]) =>
        write(active.map(a => a.service === svc ? { ...a, [field]: val } : a)),
    };
  });
  const otherCost = (otherSubs || []).reduce((s, o) => s + (parseFloat(o.price) || 0), 0);
  const total     = insCost + subGroups.reduce((s, g) => s + g.cost, 0) + otherCost;

  const renewalAlerts: { name: string; date: string; daysLeft: number; type: 'danger'|'warning'|'info' }[] = [];
  const checkRenewal = (name: string, dateStr: string, days: number) => {
    if (!dateStr) return;
    const diff = daysUntil(dateStr) ?? 0;
    if (diff >= 0 && diff <= days) renewalAlerts.push({ name, date: dateStr, daysLeft: diff, type: diff <= 3 ? 'danger' : diff <= 7 ? 'warning' : 'info' });
  };
  if (insRenewalDate) checkRenewal(`Ασφάλεια κατοικίας (${insCompany?.label})`, insRenewalDate, 60);
  subGroups.forEach(g => g.active.forEach(a => {
    if (a.renewalDate) checkRenewal(g.catalog.find(x => x.value === a.service)?.label || a.service, a.renewalDate, 5);
  }));
  (otherSubs || []).forEach(s => { if (s.renewalDate) checkRenewal(s.name, s.renewalDate, 7); });

  // ── Auto-detect insurance property type από property settings ──────────────
  // prop_type στη βάση είναι ελληνικό label (π.χ. 'Κατοικία', 'Επαγγελματικό Ακίνητο')
  // status_detail === 'rented' σημαίνει ενοικιαζόμενο, αυτό υπερισχύει του prop_type
  const detectedPropertyType = crossProperty.isRented
    ? 'Ενοικιαζόμενη'
    : crossProperty.propertyType === 'Κατοικία'
      ? 'Κύρια Κατοικία'
      : crossProperty.propertyType === 'Εξοχική Κατοικία'
        ? 'Εξοχική Κατοικία'
        : crossProperty.propertyType === 'Επαγγελματικό Ακίνητο'
          ? null  // δεν φιλτράρουμε ασφάλειες κατοικίας για επαγγελματικά ακίνητα
          : null;

  // ── Φιλτράρισμα εταιρειών βάσει πραγματικού τύπου ακινήτου ─────────────────
  const relevantCompanies = detectedPropertyType
    ? INSURANCE_COMPANIES.filter(c => !c.propertyTypes || c.propertyTypes.includes(detectedPropertyType))
    : INSURANCE_COMPANIES;

  const insOptions     = relevantCompanies.filter(c => c.value && c.label).map(c => ({ value: c.value!, label: c.label! }));
  // ΤΟ ΚΟΜΜΑ ΕΙΝΑΙ Η ΥΠΟΔΙΑΣΤΟΛΗ. «HOME EXTRA, ~14,50€» έβαζε δύο κόμματα σε
  // πέντε λέξεις, με δύο εντελώς διαφορετικές δουλειές: το ένα χώριζε όνομα από
  // τιμή, το άλλο ευρώ από λεπτά. Ο διαχωριστής της εφαρμογής είναι το «·».
  //
  // Και η περισπωμένη έφυγε: το «περίπου» το λέει ήδη το πεδίο δίπλα, που ζητά
  // ρητά το ΠΡΑΓΜΑΤΙΚΟ κόστος τον μήνα. Δύο φορές το ίδιο, με σύμβολο.
  const insPlanOptions = (insCompany?.plans ?? []).map(p => ({
    value: p.id,
    label: p.monthly > 0 ? `${p.name} · ${fe(p.monthly)}` : `${p.name} · Χειροκίνητο`,
  }));

  // ── Sync-back στο ακίνητο: μία πηγή αλήθειας για το υπόλοιπο app ──────────
  // Η κάρτα ακινήτου διαβάζει insurance_company / insurance_amount /
  // insurance_expiry από το ίδιο το ακίνητο.
  //
  // ΤΙ ΠΗΓΑΙΝΕ ΣΤΡΑΒΑ: το γράψιμο πήγαινε στον πίνακα `properties`, που δεν
  // υπάρχει και το αποτέλεσμα δεν ελεγχόταν ποτέ (`.then(() => {})`). Το
  // σφάλμα καταπινόταν αθόρυβα: ο ιδιοκτήτης καταχωρούσε ημερομηνία λήξης
  // ασφαλιστηρίου, η οθόνη συμπεριφερόταν σαν να αποθηκεύτηκε και η λήξη δεν
  // έφτανε ποτέ στο ακίνητο. Καμία υπενθύμιση, καμία ένδειξη ότι κάτι χάθηκε.
  //
  // Ο έλεγχος `loading` δεν είναι διακοσμητικός: όσο φορτώνουν οι ρυθμίσεις το
  // `ps` κρατά τις ΠΡΟΕΠΙΛΟΓΕΣ (Hellas Direct, χωρίς ημερομηνία). Τώρα που το
  // γράψιμο πιάνει στ' αλήθεια, ένα sync μέσα σε εκείνο το παράθυρο θα έσβηνε
  // την πραγματική ασφαλιστική και τη λήξη του χρήστη με τις προεπιλογές.
  const [syncError, setSyncError] = useState(false);
  const propertySyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── ΓΡΑΦΟΥΜΕ ΜΟΝΟ ΟΤΑΝ ΑΛΛΑΞΕ ΚΑΤΙ ΠΡΑΓΜΑΤΙΚΑ ──────────────────────────────
  //
  // Ο έλεγχος `loading` ΔΕΝ αρκεί και παραλίγο να κοστίσει δεδομένα χρήστη.
  // Το BillsSettings, όταν η ανάγνωση των ρυθμίσεων ΑΠΟΤΥΧΕΙ, δεν διαβάζει το
  // σφάλμα: πέφτει στις προεπιλογές και θέτει loading=false. Δηλαδή «απέτυχε η
  // ανάγνωση» και «δεν υπάρχει γραμμή» καταλήγουν στην ΙΔΙΑ κατάσταση.
  //
  // Με φύλακα μόνο το `loading`, 1,2 δευτερόλεπτα μετά το άνοιγμα της καρτέλας
  // το effect θα έγραφε «Hellas Direct», 8,50€ και ΚΕΝΗ ημερομηνία λήξης πάνω
  // από την πραγματική ασφαλιστική του χρήστη — σιωπηλά, χωρίς καμία ενέργειά
  // του. Θα έσβηνε μαζί και την υποχρέωση και το insight που διαβάζουν το
  // insurance_expiry, δηλαδή ΑΚΡΙΒΩΣ την υπενθύμιση που αυτή η διόρθωση
  // υποτίθεται ότι αποκατέστησε.
  //
  // Η υπογραφή της φορτωμένης κατάστασης κρατιέται μόλις τελειώσει η φόρτωση.
  // Όσο η τρέχουσα τιμή είναι ίδια με εκείνη, δεν υπάρχει τίποτα να γραφτεί —
  // ούτε όταν αυτή προήλθε από προεπιλογές μετά από αποτυχία. Γράφουμε μόνο
  // όταν ο χρήστης άλλαξε κάτι, που είναι και το μόνο που θέλαμε ποτέ.
  const insSignature = `${insCompany?.label ?? ''}|${insCost}|${insRenewalDate ?? ''}`;
  const loadedSignature = useRef<string | null>(null);
  useEffect(() => {
    if (loading) { loadedSignature.current = null; return; }
    if (loadedSignature.current === null) loadedSignature.current = insSignature;
  }, [loading, insSignature]);

  useEffect(() => {
    if (!propertyId || loading) return;
    if (loadedSignature.current === null) return;        // δεν κατοχυρώθηκε ακόμη βάση
    if (insSignature === loadedSignature.current) return; // τίποτα δεν άλλαξε
    if (propertySyncTimer.current) clearTimeout(propertySyncTimer.current);
    propertySyncTimer.current = setTimeout(async () => {
      // ΓΡΑΦΟΥΜΕ ΜΟΝΟ Ο,ΤΙ ΞΕΡΟΥΜΕ, ΠΟΤΕ null ΠΑΝΩ ΑΠΟ ΥΠΑΡΧΟΥΣΑ ΤΙΜΗ.
      //
      // Ο ΚΙΝΔΥΝΟΣ, ΣΥΓΚΕΚΡΙΜΕΝΑ: όταν το σαρωμένο ασφαλιστήριο ανήκει σε
      // εταιρεία ΕΚΤΟΣ καταλόγου, η αυτόματη συμπλήρωση κρατά το όνομα από το
      // χαρτί αλλά δεν επιλέγει `insProvider` — άρα το `insCompany` μένει κενό.
      // Ταυτόχρονα συμπληρώνει ασφάλιστρο και ημερομηνία, οπότε η υπογραφή
      // αλλάζει και ο συγχρονισμός ενεργοποιείται. Με σταθερό `?? null` θα
      // έγραφε κενή ασφαλιστική ΠΑΝΩ από το όνομα που μόλις διάβασε η σάρωση:
      // η εφαρμογή θα έσβηνε μόνη της αυτό που μόλις έμαθε.
      const patch: Record<string, string | number> = {};
      if (insCompany?.label) patch.insurance_company = insCompany.label;
      if (insCost > 0) patch.insurance_amount = insCost;
      if (insRenewalDate) patch.insurance_expiry = insRenewalDate;
      if (!Object.keys(patch).length) return;
      const { error } = await properties.update(supabase, propertyId, patch, userId);
      setSyncError(!!error);
    }, 1200); // debounce, αποφυγή write σε κάθε keystroke
    return () => { if (propertySyncTimer.current) clearTimeout(propertySyncTimer.current); };
  }, [propertyId, loading, insSignature, insCompany?.label, insCost, insRenewalDate, supabase, userId]);

  // ── Auto-sync ανανέωσης ασφάλειας → calendar_events ──────────────────────────
  useEffect(() => {
    if (!propertyId || !insRenewalDate || calendarSynced) return;
    (async () => {
      // Η ΚΑΤΗΓΟΡΙΑ ΕΙΝΑΙ ΤΟ ΚΛΕΙΔΙ ΤΗΣ ΜΟΝΑΔΙΚΟΤΗΤΑΣ ΕΔΩ και γι' αυτό μένει
      // 'insurance_renewal': η πηγή είναι 'system' και τη μοιράζεται με το
      // φυσικό αέριο, οπότε δεν ξεχωρίζει τις δύο υπενθυμίσεις.
      if (await calendar.exists(supabase, propertyId, { category: 'insurance_renewal', eventDate: insRenewalDate })) { setCalendarSynced(true); return; }

      // Το `.then(() => setCalendarSynced(true))` δήλωνε «καταχωρήθηκε» ακόμη κι
      // όταν το insert γύριζε σφάλμα. Η υπενθύμιση μαρκαριζόταν ως συγχρονισμένη
      // και δεν ξαναδοκίμαζε ποτέ, οπότε ο ιδιοκτήτης δεν έπαιρνε ειδοποίηση
      // λήξης — ούτε μάθαινε ποτέ ότι δεν πρόκειται να την πάρει.
      const { error } = await calendar.insert(supabase, [calendar.row({ propertyId, userId }, 'system', {
        title: `Ανανέωση Ασφάλειας Κατοικίας, ${insCompany?.label ?? ''}`,
        category: 'insurance_renewal',
        event_date: insRenewalDate,
        amount: insCost > 0 ? insCost : null,
        notes: `Πρόγραμμα: ${(insCompany?.plans ?? []).find(p => p.id === insPlanId)?.name ?? ''}. Σύγκρινε εναλλακτικές πριν ανανεώσεις.`,
      })]);
      if (!error) setCalendarSynced(true);
    })();
  }, [propertyId, userId, supabase, insRenewalDate, calendarSynced, insCompany?.label, insCompany?.plans, insCost, insPlanId]);

  // ── ΤΙ ΧΡΕΙΑΖΕΤΑΙ ΑΥΤΟ ΤΟ ΑΚΙΝΗΤΟ ────────────────────────────────────────
  // Οι ανάγκες βγαίνουν από όσα ξέρουμε γι' αυτό το συγκεκριμένο ακίνητο, με
  // γραμμένη την αιτιολογία της καθεμιάς. Όπου το δεδομένο λείπει, η ανάγκη δεν
  // ανεβαίνει σε «απαραίτητη»: δεν φτιάχνουμε επείγον από άγνοια.
  const risk: PropertyRisk = {
    sqm: parseFloat(effectiveSqm) || null,
    buildYear: crossProperty.yearBuilt ?? null,
    floor: effectiveFloor === 'basement' ? 'basement'
      : effectiveFloor === 'ground' ? 'ground'
      : effectiveFloor === 'top' ? 'top' : 'mid',
    hasLoan: !!crossProperty.hasLoan,
    rentalMode: crossProperty.rentalMode ?? '',
    furnished: !!crossProperty.furnished,
    contentsValue: parseFloat(insContentValue) || null,
    monthlyRent: crossProperty.monthlyRent ?? null,
  };
  const needs = assessNeeds(risk);

  // Η ΚΑΤΑΤΑΞΗ: πρώτα καταλληλότητα, μετά τιμή. Ένα πρόγραμμα που δεν καλύπτει
  // σεισμό, σε ακίνητο με δάνειο, δεν είναι φθηνό. Είναι άχρηστο, γιατί η
  // τράπεζα δεν το δέχεται.
  const ranked = matchPlans(
    liveQuotes.map(q => ({
      id: q.plan, name: q.planLabel, company: q.company, companyLabel: q.companyLabel,
      monthly: q.monthlyEstimate, annual: q.annualEstimate,
      earthquake: q.earthquake, flood: q.flood, covers: q.covers, url: q.url,
    })),
    needs,
  );
  const quoteOf = (id: string) => liveQuotes.find(q => q.plan === id)!;
  const orderedQuotes = ranked.map(r => quoteOf(r.plan.id)).filter(Boolean);
  const matchOf = new Map(ranked.map(r => [r.plan.id, r]));

  const filteredQuotes = orderedQuotes.filter(q =>
    quotesFilter === 'all'       ? true :
    quotesFilter === 'earthquake' ? q.earthquake :
    quotesFilter === 'flood'      ? q.flood :
    quotesFilter === 'natural'    ? q.natural : true
  );

  // Η πρόταση, με τον λόγο της γραμμένο. Ο χρήστης αποφασίζει, αλλά οφείλει να
  // έχει τα στοιχεία για να διαφωνήσει τεκμηριωμένα.
  // Η ΠΡΟΤΑΣΗ ΔΕΣΜΕΥΕΙ ΓΙΑ ΕΝΑΝ ΧΡΟΝΟ. Σε ασφάλιστρα καταλόγου που έχουν
  // παλιώσει, το «ΠΡΟΤΕΙΝΟΜΕΝΟ ΓΙΑ ΕΣΕΝΑ» είναι υπόσχεση που δεν στέκει.
  const insFresh = freshness(INSURANCE_VERIFIED, new Date(), INSURANCE_MAX_AGE_DAYS);
  const recommended: { q: LiveQuote; reason: string } | null = !insFresh.canRank ? null :
    ranked.length ? { q: quoteOf(ranked[0].plan.id), reason: explain(ranked[0], ranked, needs) } : null;

  // ══════════════════════════════════════════════════════════════════════
  //  ΟΙ ΣΥΝΔΡΟΜΕΣ ΩΣ ΔΑΠΑΝΕΣ
  // ──────────────────────────────────────────────────────────────────────
  //  Η απόφαση (ποιο ποσό, ποια κατηγορία, ποιος φόρος) ζει στο
  //  lib/expenses/subscriptionBooking.ts και δοκιμάζεται χωρίς βάση. Εδώ μένει
  //  μόνο η εκτέλεση: τι διαβάζεται, τι γράφεται, τι λέγεται στον χρήστη.
  // ══════════════════════════════════════════════════════════════════════
  const charges      = subscriptionCharges(ps);
  const chargesTotal = bookableTotal(charges);
  const vatTotal     = isBusiness ? reverseChargeTotal(charges) : 0;
  const needCountry  = isBusiness ? missingCountry(charges) : [];
  const intraEu      = charges.filter(c => c.supply === 'intra_eu');
  const thirdCountry = charges.filter(c => c.supply === 'third_country');
  const curMonth     = athensToday().slice(0, 7);

  // Λήξεις μέσα στις επόμενες δεκαπέντε ημέρες: αρκετά νωρίς για να προλάβεις
  // ακύρωση ή αλλαγή πακέτου, αρκετά αργά για να μην είναι θόρυβος όλο τον μήνα.
  const expiring = charges.filter(c => {
    const d = c.renewalDate ? daysUntil(c.renewalDate) : null;
    return d !== null && d >= 0 && d <= 15;
  });

  const [booking, setBooking] = useState(false);
  const [bookedCount, setBookedCount] = useState(0);

  /**
   * ΔΙΑΒΑΖΕΙ ΠΡΙΝ ΓΡΑΨΕΙ ΚΑΙ ΤΗ ΣΤΙΓΜΗ ΠΟΥ ΓΡΑΦΕΙ. Το τι έχει ήδη καταχωρηθεί
   * δεν κρατιέται σε κατάσταση της οθόνης: μια δεύτερη καρτέλα ανοιχτή, ή ένα
   * κλικ πριν από δέκα λεπτά, θα το είχαν κάνει ψέμα. Ο έλεγχος γίνεται πάνω
   * στη βάση, τη στιγμή του πατήματος.
   */
  const bookMonth = async () => {
    if (booking || !propertyId || !userId) return;
    setBooking(true);
    const from = `${curMonth}-01`;
    const to   = monthEndIso(+curMonth.slice(0, 4), +curMonth.slice(5, 7));
    const rows = await expenseStore.inRangeOfProperty(supabase, propertyId, from, to,
      'id,description,amount,category,date,store_vendor,bill_id');

    // ΔΥΟ ΔΡΟΜΟΙ ΟΔΗΓΟΥΝ ΣΤΗΝ ΙΔΙΑ ΓΡΑΜΜΗ ΚΑΙ ΠΡΕΠΕΙ ΝΑ ΤΟ ΞΕΡΟΥΝ Ο ΕΝΑΣ ΓΙΑ
    // ΤΟΝ ΑΛΛΟΝ. Το `recorded` πιάνει μόνο ό,τι έγραψε ΑΥΤΟ το κουμπί, γιατί
    // αναγνωρίζει την υπηρεσία από το δικό μας αναγνωριστικό («netflix»). Η
    // σάρωση όμως γράφει τον πάροχο όπως τον διάβασε («Netflix»), σε άλλη
    // ημερομηνία και με άλλη περιγραφή: για το `recorded` δεν υπάρχει και ο
    // μήνας έβγαινε διπλός.
    //
    // Ο έλεγχος ομοιότητας κοιτά αυτό που κοιτά και η σάρωση — ποσό, κοντινή
    // ημερομηνία, πάροχο, περιγραφή — οπότε οι δύο δρόμοι βλέπουν πλέον ο ένας
    // τη δουλειά του άλλου.
    const recorded = new Set(
      rows.filter(r => r.category === SUBSCRIPTION_CATEGORY && r.store_vendor)
          .map(r => String(r.store_vendor)),
    );
    const ledger = rows as ExpenseLike[];
    const planned = toExpenses(charges, { month: curMonth, recorded });
    const clashes = planned.filter(d => findDuplicates({
      description: d.description, amount: d.amount, category: d.category,
      date: d.date, store_vendor: d.store_vendor,
    }, ledger).length > 0);
    const drafts = planned.filter(d => !clashes.includes(d));
    if (!drafts.length) {
      setBooking(false);
      setBookedCount(0);
      notify(clashes.length
        ? `${clashes.length === 1 ? 'Η συνδρομή υπάρχει' : `${clashes.length} συνδρομές υπάρχουν`} ήδη στις δαπάνες, από σάρωση ή χειροκίνητη καταχώρηση.`
        : 'Ο μήνας είναι ήδη καταχωρημένος. Καμία διπλή γραμμή.');
      return;
    }
    const okWrite = await saved('Οι συνδρομές δεν μπήκαν στις δαπάνες',
      expenseStore.insert(supabase, drafts.map(d => expenseStore.row({ propertyId, userId }, d))));
    setBooking(false);
    if (!okWrite) return;
    setBookedCount(drafts.length);
    // Ό,τι παραλείφθηκε λέγεται. Ένας αριθμός μικρότερος από τον αναμενόμενο,
    // χωρίς εξήγηση, διαβάζεται ως σφάλμα.
    if (clashes.length) {
      notify(`${clashes.length === 1 ? 'Μία συνδρομή παραλείφθηκε' : `${clashes.length} συνδρομές παραλείφθηκαν`}: υπάρχουν ήδη στις δαπάνες.`);
    }
  };

  // ── ΟΙ ΑΝΑΝΕΩΣΕΙΣ ΣΤΟ ΗΜΕΡΟΛΟΓΙΟ ────────────────────────────────────────
  // Μία εγγραφή ανά συνδρομή, με πηγή `subscription:<υπηρεσία>`. Ο συγχρονισμός
  // αντικαθιστά ό,τι υπάρχει με αυτή την πηγή: αλλάζει η ημερομηνία ανανέωσης ή
  // σβήνει η συνδρομή και το ημερολόγιο το ακολουθεί χωρίς να μείνει ορφανή
  // υπενθύμιση για κάτι που ο χρήστης ακύρωσε πριν από τρεις μήνες.
  const renewalSignature = charges.map(c => `${c.service}:${c.renewalDate}:${c.monthly.toFixed(2)}`).join('|');
  useEffect(() => {
    if (!propertyId || !userId || loading) return;
    const drafts = subscriptionCharges(ps).filter(c => c.renewalDate).map(c => ({
      title: `Ανανέωση συνδρομής, ${c.label}`,
      category: 'contract' as const,
      event_date: c.renewalDate,
      amount: c.monthly > 0 ? c.monthly : null,
      notes: c.plan ? `Πακέτο ${c.plan}.` : '',
      source: `subscription:${c.service}`,
    }));
    void calendar.replaceSource(supabase, { propertyId, userId }, { prefix: 'subscription:' }, drafts);
    // Η υπογραφή είναι η εξάρτηση: χωρίς αυτήν ο συγχρονισμός θα έσβηνε και θα
    // ξανάγραφε τα ίδια γεγονότα σε κάθε απόδοση της οθόνης.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, userId, loading, renewalSignature]);

  /**
   * ΤΟ ΠΛΑΚΙΔΙΟ ΚΑΛΥΨΗΣ ΩΣ ΔΙΑΚΟΠΤΗΣ.
   *
   * ΤΡΕΙΣ ΚΑΛΥΨΕΙΣ ΕΧΟΥΝ ΔΙΚΟ ΤΟΥΣ ΠΕΔΙΟ ΚΑΙ ΟΧΙ ΓΙΑ ΛΟΓΟΥΣ ΟΘΟΝΗΣ: ο σεισμός,
   * η πλημμύρα και τα φυσικά φαινόμενα κρίνουν τη μείωση ΕΝΦΙΑ και τη σύγκριση
   * προσφορών, οπότε διαβάζονται από αλλού ως λογικές τιμές. Οι υπόλοιπες ζουν
   * στη λίστα κειμένου. Ο χρήστης δεν χρειάζεται να ξέρει τη διαφορά.
   *
   * ΤΟ ΠΡΩΤΟ ΠΑΤΗΜΑ ΓΡΑΦΕΙ ΚΑΙ ΤΑ ΥΠΟΛΟΙΠΑ. Χωρίς αυτό, το πέρασμα στη δική σου
   * εκδοχή θα ξεκινούσε από άδεια λίστα και θα έσβηνε τις εννέα καλύψεις που
   * μόλις έδειχνε το πρόγραμμα.
   */
  const toggleCover = (label: string, on: boolean) => {
    // ΤΟ ΠΡΩΤΟ ΠΑΤΗΜΑ ΞΕΚΙΝΑ ΑΠΟ ΟΣΑ ΒΛΕΠΕΙΣ, ΟΧΙ ΑΠΟ ΤΗ ΛΙΣΤΑ ΤΟΥ ΠΡΟΓΡΑΜΜΑΤΟΣ.
    //
    // Έπαιρνε το `effectiveCovers`, δηλαδή τις καλύψεις όπως τις γράφει ο
    // κατάλογος («Κλοπή, Φυσικά Φαινόμενα, Δαπάνες Μεταστέγασης»). Τα πλακίδια
    // όμως δεν βγαίνουν ΜΟΝΟ από εκεί: κάποια θεωρούνται δεδομένα σε κάθε
    // ασφαλιστήριο κατοικίας και δείχνουν «Ναι» χωρίς να γράφονται. Μόλις
    // περνούσε στη δική σου εκδοχή, η λίστα αντικαθιστούσε αυτή τη γνώση και
    // πέντε «Ναι» γίνονταν «Όχι» με ένα κλικ — σε πράγματα που ο χρήστης ούτε
    // άγγιξε. Αφετηρία είναι πλέον η ΕΙΚΟΝΑ: ό,τι έδειχνε «Ναι», μένει «Ναι».
    const shown = deriveCoverages(effectiveCovers, effectiveEarthquake, effectiveFloodState, effectiveNatural);
    const FLAGGED = ['Σεισμός', 'Πλημμύρα', 'Φυσικά Φαινόμενα'];
    const base = insEditCovers
      ? insCustomCovers
      : shown.filter(c => c.ok && !FLAGGED.includes(c.label)).map(c => c.label).join(', ');
    const list = base.split(',').map(x => x.trim()).filter(Boolean);
    const same = (a: string, b: string) =>
      a.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      === b.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    const flag =
      label === 'Σεισμός' ? 'insCustomEarthquake' as const
      : label === 'Πλημμύρα' ? 'insCustomFlood' as const
      : label === 'Φυσικά Φαινόμενα' ? 'insCustomNatural' as const
      : null;

    u({
      insEditCovers: true,
      // Η λίστα κρατά ΠΑΝΤΑ ό,τι φαινόταν και αλλάζει μόνο η μία κάλυψη.
      insCustomCovers: flag
        ? (insEditCovers ? insCustomCovers : base)
        : (on ? list.filter(x => !same(x, label)) : [...list, label]).join(', '),
      insCustomEarthquake: flag === 'insCustomEarthquake' ? !on : (insEditCovers ? insCustomEarthquake : effectiveEarthquake),
      insCustomFlood:      flag === 'insCustomFlood'      ? !on : (insEditCovers ? insCustomFlood      : effectiveFloodState),
      insCustomNatural:    flag === 'insCustomNatural'    ? !on : (insEditCovers ? insCustomNatural    : effectiveNatural),
    });
  };

  const [newSubName, setNewSubName] = useState('');
  const [newSubPrice, setNewSubPrice] = useState('');
  const [newSubRenewal, setNewSubRenewal] = useState('');

  const secHdr = (label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontFamily: T.font.sans }}>{label}</span>
    </div>
  );

  // Πριν, όσο φόρτωναν οι ρυθμίσεις η καρτέλα έδειχνε ΤΙΠΟΤΑ ενδεικτικό: τα πεδία
  // εμφανίζονταν άδεια και μετά γέμιζαν απότομα, σαν να έσβησε κάτι ο χρήστης.
  if (loading) return (
    <div style={{ fontFamily: T.font.sans }}>
      <SkeletonKPIs n={3} />
      {[0, 1].map(i => <Skeleton key={i} h={120} r={14} style={{ marginBottom: 12 }} />)}
    </div>
  );

  return (
    <div style={{ fontFamily: T.font.sans, color: 'var(--text-primary)' }}>

      {/* ── Checklist renewal banner ──────────────────────────────────────── */}
      {checklistRenewal && checklistRenewal.daysLeft !== null && checklistRenewal.daysLeft <= 60 && (
        <div style={{ background: checklistRenewal.daysLeft <= 7 ? 'var(--negative-soft)' : 'var(--warning-soft)', border: `1px solid ${checklistRenewal.daysLeft <= 7 ? 'var(--negative-border)' : 'var(--warning-border)'}`, borderRadius: T.radius.inner, padding: '11px 18px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: checklistRenewal.daysLeft <= 7 ? 'var(--negative)' : 'var(--warning)', flexShrink: 0 }}/>
          <div style={{ flex: 1, fontSize: 12, fontFamily: T.font.sans }}>
            <span style={{ fontWeight: 700, color: checklistRenewal.daysLeft <= 7 ? 'var(--negative)' : 'var(--warning)' }}>Ανανέωση ασφαλιστηρίου </span>
            <span style={{ color: 'var(--text-secondary)' }}>{checklistRenewal.daysLeft <= 0 ? 'έχει λήξει' : `σε ${checklistRenewal.daysLeft} ημέρες`}</span>
          </div>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', background: 'var(--bg-elevated)', padding: '2px 10px', borderRadius: T.radius.pill, fontFamily: T.font.sans }}>{navLabel('checklist')}</span>
        </div>
      )}

      {/* ── Auto-detected property type banner ──────────────────────────── */}
      {detectedPropertyType && (
        <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: T.radius.inner, padding: '10px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--fs-xs)', fontFamily: T.font.sans }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            Ανιχνεύθηκε τύπος ακινήτου: <strong style={{ color: 'var(--accent)' }}>{detectedPropertyType}</strong>, εμφανίζονται {insOptions.length} σχετικές ασφαλιστικές εταιρείες.
          </span>
        </div>
      )}

      {/* ── Standalone coverage gap notification (σεισμός/πλημμύρα) ───────── */}
      {/* ΟΙ ΕΙΔΟΠΟΙΗΣΕΙΣ ΑΝΗΚΟΥΝ ΣΤΗΝ ΑΣΦΑΛΕΙΑ, ΟΧΙ ΣΤΙΣ ΣΥΝΔΡΟΜΕΣ. Η λήξη
          ασφαλιστηρίου και η ελλιπής κάλυψη σεισμού δεν έχουν καμία σχέση με το
          Netflix· εμφανίζονταν όμως και στις δύο, γιατί το πάνελ ήταν ένα.

          Η σειρά τεσσάρων μεγάλων αριθμών στην κορυφή έφυγε για τον ίδιο λόγο
          με τους Παρόχους: αθροίσματα κατηγοριών που ο χρήστης δεν ζήτησε,
          μπροστά από αυτό που ζήτησε. Το σύνολο των συνδρομών μένει, κάτω από
          τις συνδρομές, όπου το διαβάζει όποιος τις κοιτάζει. */}

      {show('insurance') && (<>
        {insCompany && (() => {
          const hasEq = effectiveEarthquake;
          const hasFl = effectiveFloodState;
          if (hasEq && hasFl) return null;
          return (
            <div style={{ background: 'var(--warning-soft)', border: '1px solid var(--warning-border)', borderRadius: T.radius.inner, padding: '10px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--fs-xs)', fontFamily: T.font.sans }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)', flexShrink: 0 }}/>
              <span style={{ color: 'var(--text-secondary)' }}>
                {!hasEq && !hasFl ? 'Το πρόγραμμά σου δεν καλύπτει σεισμό ούτε πλημμύρα.' : !hasEq ? 'Το πρόγραμμά σου δεν καλύπτει σεισμό.' : 'Το πρόγραμμά σου δεν καλύπτει πλημμύρα.'}
                {' '}Σκέψου αναβάθμιση της κάλυψης.
              </span>
            </div>
          );
        })()}

        {/* Αν η ασφάλεια δεν έφτασε στο ακίνητο, ο χρήστης πρέπει να το μάθει από
            την οθόνη. Πριν, η αποτυχία ήταν αόρατη και η υπενθύμιση λήξης απλώς
            δεν ερχόταν ποτέ. */}
        {syncError && (
          <InfoBanner tone="warning">
            Τα στοιχεία ασφάλισης δεν αποθηκεύτηκαν στο ακίνητο. Η υπενθύμιση λήξης δεν θα λειτουργήσει μέχρι να ξαναδοκιμάσεις.
          </InfoBanner>
        )}

        {/* ── Renewal alerts ──────────────────────────────────────────────── */}
        {renewalAlerts.map((a, i) => (
          <div key={i} style={{ background: a.type === 'danger' ? 'var(--negative-soft)' : a.type === 'warning' ? 'var(--warning-soft)' : 'var(--accent-soft)', border: `1px solid ${a.type === 'danger' ? 'var(--negative)' : a.type === 'warning' ? 'var(--warning)' : 'var(--accent)'}`, borderRadius: T.radius.inner, padding: '10px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--fs-xs)', fontFamily: T.font.sans }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: a.type === 'danger' ? 'var(--negative)' : a.type === 'warning' ? 'var(--warning)' : 'var(--accent)', flexShrink: 0 }}/>
            <strong>{a.name}</strong>: {a.daysLeft === 0 ? 'Λήγει ΣΗΜΕΡΑ' : `Λήγει σε ${a.daysLeft} ημέρες`}
            {/* Η υπενθύμιση δίπλα στην ειδοποίηση, όχι σε άλλη οθόνη: τη στιγμή
                που ο χρήστης το μαθαίνει είναι και η μόνη στιγμή που θα κάνει
                κάτι γι' αυτό. */}
            <span style={{ marginLeft: 'auto' }}>
              <ReminderLinks subject={{
                what: `λήγει «${a.name}»`,
                when: a.date,
                action: 'Ανανέωσε ή διέκοψε πριν τη χρέωση',
              }}/>
            </span>
          </div>
        ))}

        {/* ── Ασφάλεια Κατοικίας ───────────────────────────────────────────── */}
        <div style={card}>
          {secHdr('Ασφάλεια κατοικίας')}

          {/* ── ΤΟ ΔΙΚΟ ΣΟΥ ΑΣΦΑΛΙΣΤΗΡΙΟ, ΠΡΩΤΑ ────────────────────────────────
              ΗΤΑΝ ΤΕΛΕΥΤΑΙΟ, ΜΕΤΑ ΑΠΟ ~150 ΓΡΑΜΜΕΣ ΚΑΤΑΛΟΓΟΥ ΑΓΟΡΑΣ: στοιχεία
              ακινήτου, φίλτρα, «τι χρειάζεται αυτό το ακίνητο», προτεινόμενο,
              τρεις κάρτες προσφορών και πλήρης πίνακας — και μετά, στο τέλος, το
              συμβόλαιο που ΕΧΕΙ ο ιδιοκτήτης.

              Η ίδια ανάποδη ιεραρχία που διορθώθηκε ένα επίπεδο πιο πάνω, στα
              Συμβόλαια: κανείς δεν ανοίγει την Ασφάλεια για να μελετήσει την
              αγορά, την ανοίγει για να δει τι έχει και πότε λήγει. Η αγορά είναι
              η ΔΕΥΤΕΡΗ ερώτηση και μένει ακέραιη από κάτω. */}
          {/* ── Current plan selection ────────────────────────────────────── */}
          {/* ΔΥΟ ΚΕΦΑΛΙΔΕΣ ΤΗ ΜΙΑ ΠΑΝΩ ΣΤΗΝ ΑΛΛΗ, ΜΕ ΜΙΑ ΓΡΑΜΜΗ ΑΝΑΜΕΣΑ ΚΑΙ
              ΤΙΠΟΤΕ ΜΕΣΑ. «Ασφάλεια κατοικίας» και από κάτω «Τρέχον πρόγραμμα»:
              η δεύτερη δεν πρόσθετε τίποτα που δεν έλεγε ήδη η πρώτη μαζί με το
              πρώτο πεδίο («Ασφαλιστική εταιρεία»). Έφυγε και μαζί ο διπλός
              κανόνας που έκοβε την κάρτα στα δύο πριν αρχίσει. */}
          <div>
            <div className="kpi-row" style={g3}>
              <CustomSelect label="Ασφαλιστική εταιρεία" value={insProvider}
                onChange={v => { u({ insProvider: v, insEditCovers: false }); const c = INSURANCE_COMPANIES.find(x => x.value === v); if (c) u({ insPlanId: c.plans[0].id }); }}
                options={insOptions}/>
              <CustomSelect label="Πρόγραμμα ασφάλισης" value={insPlanId}
                onChange={v => u({ insPlanId: v, insEditCovers: false })}
                options={insPlanOptions}/>
              <NumberInput label="Πραγματικό κόστος τον μήνα" value={insCustomPrice} onChange={v => u({ insCustomPrice: v })} suffix="€"/>
            </div>
            <div style={g4}>
              <TextInput   label={insCompany?.agent_label || 'Ασφαλιστής'} value={insAgentName}    onChange={v => u({ insAgentName: v })}    placeholder="Ονοματεπώνυμο"/>
              <TextInput   label="Τηλέφωνο ασφαλιστή"                      value={insAgentPhone}   onChange={v => u({ insAgentPhone: v })}   placeholder="69xxxxxxxx"/>
              <DatePicker  label="Ημερομηνία ανανέωσης"                     value={insRenewalDate}  onChange={v => u({ insRenewalDate: v })}/>
              {insCompany?.url && (
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                  <a href={insCompany.url} target="_blank" rel="noopener noreferrer" className="tap-link"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.btn, padding: '9px 14px', fontSize: 'var(--fs-xs)', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, fontFamily: T.font.sans }}>
                    Επίσημη σελίδα
                  </a>
                </div>
              )}
            </div>

            {/* Το `containerType` δίνει στα σπασίματα του `.tile-grid` κάτι να
                μετρήσουν: το πλάτος ΑΥΤΟΥ του κουτιού, όχι του παραθύρου. */}
            {insPlan && (
              <div style={{ background: 'var(--bg-elevated)', borderRadius: T.radius.inner, padding: 14, border: '1px solid var(--border-subtle)', marginTop: 4, containerType: 'inline-size' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontFamily: T.font.sans }}>Καλύψεις προγράμματος</div>
                  {/* ΤΟ «ΕΠΕΞΕΡΓΑΣΙΑ» ΕΦΥΓΕ, ΤΟ «ΕΠΑΝΑΦΟΡΑ» ΕΜΕΙΝΕ. Δεν χρειάζεται
                      άδεια για να πατήσεις μια κάλυψη· χρειάζεται όμως δρόμος
                      πίσω, όταν τα άλλαξες και θέλεις ό,τι λέει ο κατάλογος. */}
                  {insEditCovers && (
                    <Btn variant="secondary" onClick={() => u({ insEditCovers: false })}>Επαναφορά προγράμματος</Btn>
                  )}
                </div>
                {/* ══════════════════════════════════════════════════════════
                    ΟΙ ΚΑΛΥΨΕΙΣ ΠΑΤΙΟΥΝΤΑΙ.
                    ────────────────────────────────────────────────────────
                    ΗΤΑΝ ΔΕΚΑ ΤΑΜΠΕΛΑΚΙΑ ΠΟΥ ΔΕΝ ΕΚΑΝΑΝ ΤΙΠΟΤΑ. Για να πει ο
                    ιδιοκτήτης «το δικό μου καλύπτει και θραύση κρυστάλλων»
                    έπρεπε να βρει το «Επεξεργασία», να ανοίξει ένα πεδίο
                    ελεύθερου κειμένου και να γράψει ΞΑΝΑ ολόκληρη τη λίστα
                    με κόμματα — μαζί με όσα ήδη φαίνονταν σωστά από πάνω.
                    Ένα «Όχι» δίπλα σε κάτι που έχεις και ο μόνος τρόπος να
                    το διορθώσεις είναι να ξαναγράψεις τα πάντα.

                    Τώρα το πλακίδιο είναι ο διακόπτης. Το πρώτο πάτημα περνά
                    αυτόματα στη δική σου εκδοχή, κρατώντας ό,τι έδειχνε το
                    πρόγραμμα: αλλάζεις ΕΝΑ πράγμα, όχι δέκα.
                    ══════════════════════════════════════════════════════════ */}
                {/* ΤΟ ΟΝΟΜΑ ΤΗΣ ΚΑΛΥΨΗΣ ΗΤΑΝ ΜΙΚΡΟΤΕΡΟ ΑΠΟ ΤΗΝ ΑΠΑΝΤΗΣΗ ΤΗΣ.
                    Το «Ναι» στα 12 και έντονο, η «Πυρκαγιά» στα 10 και ξεθωριασμένη:
                    το μάτι διάβαζε πρώτα μια στήλη από «Ναι» και «Όχι» και μετά
                    έψαχνε σε τι αναφέρονται. Το ουσιαστικό είναι το θέμα, η
                    κατάσταση είναι το σχόλιο — και τα δέκα πλακίδια στέκονταν με
                    έξι εικονοστοιχεία ανάμεσά τους, δηλαδή κολλημένα, ενώ η σειρά
                    πεδίων από κάτω ανέπνεε με δεκατέσσερα. */}
                {/* ΤΕΣΣΕΡΙΣ ΣΤΗΛΕΣ ΚΑΙ ΔΩΔΕΚΑ ΚΑΛΥΨΕΙΣ ΠΟΥ ΤΙΣ ΓΕΜΙΖΟΥΝ.
                    Το `auto-fill` κρατά και ΚΕΝΕΣ στήλες: οι καλύψεις έβγαιναν
                    5+5, 6+4 ή 7+3 ανάλογα με το πλάτος και το zoom, με νεκρές
                    λωρίδες δεξιά. Με πέντε στήλες όμως και δέκα καλύψεις, το
                    `tile-grid` στένευε σε τρεις στα μεσαία πλάτη και άφηνε την
                    τελευταία σειρά με ΕΝΑ πλακίδιο μόνο του στη μέση.
                    Το δώδεκα διαιρείται ακριβώς με δύο, τρία, τέσσερα και έξι:
                    σε κάθε πλάτος οθόνης οι σειρές βγαίνουν γεμάτες. */}
                <div className="tile-grid" style={{ '--tg-n': 4, marginBottom: insEditCovers ? 14 : 0 } as React.CSSProperties}>
                  {deriveCoverages(effectiveCovers, effectiveEarthquake, effectiveFloodState, effectiveNatural).map(c => (
                    <button key={c.label} type="button" onClick={() => toggleCover(c.label, c.ok)}
                      aria-pressed={c.ok} title={`${c.ok ? 'Αφαίρεσε' : 'Πρόσθεσε'} την κάλυψη «${c.label}»`}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%', boxSizing: 'border-box',
                        minHeight: T.h.md, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                        background: c.ok ? 'var(--accent-soft)' : 'var(--bg-base)',
                        border: `1px solid ${c.ok ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                        borderRadius: T.radius.inner, padding: '9px 12px',
                        transition: 'background-color .15s, border-color .15s' }}>
                      <span style={{ fontSize: 12, fontWeight: c.ok ? 600 : 400, color: c.ok ? 'var(--text-primary)' : 'var(--text-tertiary)', fontFamily: T.font.sans, lineHeight: 1.3, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                      <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: c.ok ? 'var(--accent)' : 'var(--text-tertiary)', lineHeight: 1, flexShrink: 0 }}>{c.ok ? 'Ναι' : 'Όχι'}</span>
                    </button>
                  ))}
                </div>
                {/* ΕΦΥΓΕ Η ΜΠΑΡΑ ΚΕΙΜΕΝΟΥ ΚΑΙ ΟΙ ΤΡΕΙΣ ΔΙΑΚΟΠΤΕΣ. Έλεγαν ακριβώς ό,τι
                    λένε τα πλακίδια από πάνω, με άλλον τρόπο: μια λίστα με κόμματα
                    που έπρεπε να γραφτεί σωστά και τρεις διακόπτες για τρεις από
                    τις δέκα καλύψεις. Δύο διεπαφές για ένα πράγμα και η μία
                    χειρότερη. Το πλακίδιο είναι πλέον ο ΜΟΝΟΣ τρόπος. */}
                {insEditCovers && (
                  <p style={{ ...TT.caption, color: 'var(--text-tertiary)', margin: '10px 0 0', lineHeight: 1.55 }}>
                    Οι καλύψεις είναι δικές σου, όχι του καταλόγου. Πάτησε ό,τι
                    καλύπτει πραγματικά το συμβόλαιό σου και διόρθωσε το ασφάλιστρο
                    από πάνω αν διαφέρει από την τιμή του προγράμματος.
                  </p>
                )}
                {effectiveEarthquake && effectiveFloodState && (
                  <div title="ΕΝΦΙΑ: Ενιαίος Φόρος Ιδιοκτησίας Ακινήτων" style={{ marginTop: 10, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: T.radius.badge, padding: '8px 14px', fontSize: 'var(--fs-xs)', color: 'var(--accent)', fontFamily: T.font.sans }}>
                    {`Μπορεί να δικαιούσαι μείωση ΕΝΦΙΑ ${fpRate(INS_REDUCTION.pct)} για κατοικία αξίας έως ${feWhole(INS_REDUCTION_OVER.above)} ή ${fpRate(INS_REDUCTION_OVER.pct)} πάνω από αυτήν, βάσει Α.1005/2026. Δήλωσέ την στη ${navLabel('accounting')}, στον Υπολογισμό ΕΝΦΙΑ.`}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Property details for live quotes ──────────────────────────── */}
          {/* ΔΥΟ ΚΟΥΤΙΑ ΠΟΥ ΑΚΟΥΜΠΟΥΣΑΝ ΔΙΑΒΑΖΟΝΤΑΙ ΩΣ ΕΝΑ. Το κουτί των
              καλύψεων από πάνω δεν είχε κανένα κάτω περιθώριο και αυτό εδώ
              κανένα πάνω: δύο πλαίσια του ίδιου γκρι, με τα περιγράμματά τους
              κολλητά, φτιάχνουν μια χοντρή γραμμή στη μέση και μοιάζουν με ένα
              κουτί που κάποιος ξέχασε να κλείσει. Το περιθώριο μπαίνει ΕΔΩ και
              όχι στο από πάνω, γιατί εκείνο ζει μέσα σε συνθήκη: όταν δεν
              εμφανίζεται, το περιθώριό του θα έλειπε μαζί του. */}
          <div style={{ background: 'var(--bg-elevated)', borderRadius: T.radius.inner, padding: 14, marginTop: 14, marginBottom: 14, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 12, fontFamily: T.font.sans }}>
              Στοιχεία Ακινήτου, για Συγκριτική Εκτίμηση Ασφαλίστρων
            </div>
            {crossProperty.sqm && !insSqm && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontFamily: T.font.sans, marginBottom: 8 }}>
                ✓ Τα στοιχεία συμπληρώθηκαν αυτόματα από {crossProperty.sqmFrom === 'property' ? 'την καρτέλα του ακινήτου' : 'τη Λογιστική (ΕΝΦΙΑ)'}, μπορείς να τα επεξεργαστείς
              </div>
            )}
            {/* Τέσσερα στοιχεία του ίδιου ακινήτου, σε μία σειρά ίσα μοιρασμένη
                αντί για δύο σειρές των δύο με μισή κάρτα άδεια δεξιά. */}
            <div {...fieldRow(180, 14, { marginBottom: 14 })}>
              <NumberInput label="Εμβαδόν"           value={effectiveSqm}    onChange={v => u({ insSqm: v })}          suffix="τ.μ."/>
              <TextInput   label="Πόλη ή περιοχή"    value={effectiveCity}   onChange={v => u({ insCity: v })}         placeholder="Αθήνα"/>
              <NumberInput label="Αξία κτιρίου"      value={insPropValue}    onChange={v => u({ insPropValue: v })}    suffix="€"/>
              <NumberInput label="Αξία περιεχομένου" value={insContentValue} onChange={v => u({ insContentValue: v })} suffix="€"/>
            </div>
          </div>

          {/* ── Live Quotes Engine ────────────────────────────────────────── */}
          {(parseFloat(effectiveSqm) > 0 && parseFloat(insPropValue) > 0) && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: quotesLoading ? 'var(--text-tertiary)' : liveQuotes.length > 0 ? 'var(--accent)' : 'var(--border-default)', flexShrink: 0, transition: 'background 0.3s' }}/>
                  <span title="Εκτιμήσεις ασφαλίστρων ανά εταιρεία και πρόγραμμα" style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-primary)', fontFamily: T.font.sans }}>
                    {quotesLoading
                      ? 'Υπολογισμός…'
                      : `${liveQuotes.length} προγράμματα από ${distinctInsurers(liveQuotes.map(q => q.company))} ασφαλιστικές`}
                  </span>
                  {/* Η λέξη «ενδεικτικές» δεν είναι νομικίστικη προφύλαξη, είναι
                      η αλήθεια: πραγματική τιμή ασφάλισης κατοικίας δεν υπάρχει
                      δημοσιευμένη, παράγεται από τα στοιχεία του συγκεκριμένου
                      ακινήτου και προσώπου και τη δίνει μόνο η ασφαλιστική. */}
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: T.radius.pill, fontFamily: T.font.sans }}>
                    Ενδεικτικές τιμές, όχι προσφορές
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {QUOTE_FILTERS.map(f => (
                    <ChipToggle key={f.key} on={quotesFilter === f.key} onClick={() => setQuotesFilter(f.key)}>{f.label}</ChipToggle>
                  ))}
                  {/* Πλακίδιο και όχι κουμπί: κάθεται στην ίδια σειρά με τα φίλτρα
                      και κρατά κατάσταση (ανοιχτό ή κλειστό), οπότε τη λέει με
                      aria-pressed αντί να την αφήνει μόνο στο βελάκι. */}
                  <ChipToggle on={showQuotes} onClick={() => setShowQuotes(v => !v)}>
                    {showQuotes ? '▲ Σύμπτυξη' : '▼ Ανάπτυξη'}
                  </ChipToggle>
                </div>
              </div>
              {/* ΚΑΙ ΠΟΤΕ, ΑΠΟ ΠΟΥ (lib/facts/prices). Η ημερομηνία ζούσε μόνο στην
                  πύλη φρεσκάδας και δεν τη διάβαζε κανείς. */}
              <AsOfNote fact={PRICE_FACTS.insurance} style={{ margin: '-6px 0 12px' }} />

              {/* ── ΤΙ ΧΡΕΙΑΖΕΤΑΙ ΑΥΤΟ ΤΟ ΑΚΙΝΗΤΟ ────────────────────────────
                  Πριν από κάθε τιμή. Η κατάταξη βγαίνει από εδώ και ο χρήστης
                  πρέπει να μπορεί να δει τα κριτήρια και να διαφωνήσει: αν η
                  μηχανή λέει «απαραίτητος ο σεισμός επειδή έχεις δάνειο», αυτό
                  είναι ελέγξιμο. Ένα σκορ χωρίς αιτιολογία δεν είναι. */}
              {!quotesLoading && needs.length > 0 && (
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, padding: '12px 14px', marginBottom: 10 }}>
                  <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontFamily: T.font.sans, marginBottom: 8 }}>
                    Τι χρειάζεται αυτό το ακίνητο
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                    {needs.filter(n => n.weight === 'required' || n.weight === 'important').map(n => (
                      <div key={n.need} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 'var(--fs-xs)', fontFamily: T.font.sans, lineHeight: 1.5 }}>
                        <span style={{
                          flexShrink: 0, fontSize: 'var(--fs-xs)', fontWeight: 700, letterSpacing: '0.04em',
                          padding: '2px 7px', borderRadius: T.radius.pill,
                          color: n.weight === 'required' ? 'var(--accent-text)' : 'var(--text-secondary)',
                          background: n.weight === 'required' ? 'var(--accent)' : 'var(--bg-surface)',
                          border: n.weight === 'required' ? 'none' : '1px solid var(--border-subtle)',
                        }}>
                          {n.weight === 'required' ? 'ΑΠΑΡΑΙΤΗΤΟ' : 'ΚΑΛΟ ΝΑ ΥΠΑΡΧΕΙ'}
                        </span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600, flexShrink: 0 }}>{NEED_LABEL[n.need]}</span>
                        <span style={{ color: 'var(--text-tertiary)', minWidth: 0 }}>{n.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Προτεινόμενο πρόγραμμα βάσει ακινήτου */}
              {!quotesLoading && recommended && (
                <div {...pressable(() => u({ insProvider: recommended.q.company, insPlanId: recommended.q.plan, insEditCovers: false }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: T.radius.inner, padding: '10px 14px', marginBottom: 10, cursor: 'pointer' }}>
                  <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent-text)', background: 'var(--accent)', padding: '3px 8px', borderRadius: T.radius.pill, fontFamily: T.font.sans, whiteSpace: 'nowrap' as const, letterSpacing: '0.04em' }}>ΠΡΟΤΕΙΝΟΜΕΝΟ ΓΙΑ ΕΣΕΝΑ</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-primary)', fontFamily: T.font.sans }}>{recommended.q.companyLabel}, {recommended.q.planLabel}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontFamily: T.font.sans }}>{recommended.reason}</div>
                  </div>
                  <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', fontFamily: T.font.mono, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fe(recommended.q.monthlyEstimate)}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans }}>εκτίμηση / μήνα</div>
                  </div>
                </div>
              )}

              {!quotesLoading && filteredQuotes.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 8, marginBottom: showQuotes ? 12 : 0 }}>
                  {filteredQuotes.slice(0, 3).map((q, i) => {
                    const isCurrent = q.company === insProvider && q.plan === insPlanId;
                    const isBest    = i === 0;
                    return (
                      <div key={q.plan}
                        onClick={() => { u({ insProvider: q.company, insPlanId: q.plan, insEditCovers: false }); }}
                        style={{ background: isCurrent ? 'var(--accent-soft)' : 'var(--bg-elevated)', border: `1px solid ${isCurrent ? 'var(--accent)' : isBest ? 'var(--accent-border)' : 'var(--border-subtle)'}`, borderRadius: T.radius.inner, padding: 12, cursor: 'pointer', transition: 'background-color 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s, transform 0.15s, opacity 0.15s', position: 'relative' as const }}>
                        {/* ΟΧΙ «ΚΑΛΥΤΕΡΗ ΤΙΜΗ». Η πρώτη θέση ανήκει στο πιο
                            ΚΑΤΑΛΛΗΛΟ, που συχνά δεν είναι το φθηνότερο. Η παλιά
                            ετικέτα έλεγε ψέματα για το ίδιο το κριτήριο. */}
                        {isBest && !isCurrent && <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '2px 6px', borderRadius: T.radius.pill, fontFamily: T.font.sans }}>ΚΑΤΑΛΛΗΛΟΤΕΡΟ</div>}
                        {isCurrent && <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '2px 6px', borderRadius: T.radius.pill, fontFamily: T.font.sans }}>ΤΡΕΧΟΝ</div>}
                        <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-primary)', fontFamily: T.font.sans, marginBottom: 2 }}>{q.companyLabel}</div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontFamily: T.font.sans, marginBottom: 8 }}>{q.planLabel}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: isCurrent ? 'var(--accent)' : isBest ? 'var(--accent)' : 'var(--text-primary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fe(q.monthlyEstimate)}</div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans, marginTop: 2 }}>εκτίμηση / μήνα</div>
                        {q.savings !== undefined && q.savings > 0 && (
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontFamily: T.font.sans, marginTop: 4, fontWeight: 700 }}>Εξοικονόμηση {fe(q.savings)} τον μήνα</div>
                        )}
                        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' as const }}>
                          {q.earthquake && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', background: 'var(--bg-base)', padding: '1px 6px', borderRadius: 3, fontFamily: T.font.sans }}>Σεισμός</span>}
                          {q.flood     && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', background: 'var(--bg-base)', padding: '1px 6px', borderRadius: 3, fontFamily: T.font.sans }}>Πλημμύρα</span>}
                          {q.natural   && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', background: 'var(--bg-base)', padding: '1px 6px', borderRadius: 3, fontFamily: T.font.sans }}>Φυσικές καταστροφές</span>}
                        </div>
                        {/* ΤΙ ΤΟΥ ΛΕΙΠΕΙ, ΓΡΑΜΜΕΝΟ ΠΑΝΩ ΣΤΗΝ ΚΑΡΤΑ. Ένα φθηνό
                            πρόγραμμα χωρίς σεισμό δεν κρύβεται, αλλά ούτε
                            παρουσιάζεται σαν ισοδύναμο. */}
                        {(matchOf.get(q.plan)?.missingRequired.length ?? 0) > 0 && (
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--negative)', fontFamily: T.font.sans, marginTop: 6, lineHeight: 1.4, fontWeight: 600 }}>
                            Δεν καλύπτει {matchOf.get(q.plan)!.missingRequired.map(n => NEED_LABEL[n].toLowerCase()).join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Ο ΙΔΙΟΣ ΠΙΝΑΚΑΣ ΜΕ ΤΟΥ ΡΕΥΜΑΤΟΣ, ΜΕ ΤΗΝ ΙΔΙΑ ΚΛΑΣΗ. Οκτώ στήλες
                  και οκτώ αντίγραφα του ίδιου `padding: 6px 8px`. Οι τρεις
                  στήλες κάλυψης είναι «Ναι» ή «Όχι» και κεντράρονται· οι
                  τέσσερις των ποσών στοιχίζονται δεξιά, όπως κάθε στήλη αριθμών
                  του προϊόντος. Η `.pin-1` κρατά την εταιρεία ορατή όσο ο
                  χρήστης σέρνει προς την «Εξοικονόμηση». */}
              {showQuotes && !quotesLoading && filteredQuotes.length > 0 && (
                <>
                <div className="po-table-box">
                 <div className="po-scroll-x">
                  <table className="po-table pin-1" style={{ '--tbl-fs': 'var(--fs-xs)', '--tbl-min': '760px', '--row-bg': 'var(--bg-surface)' }}>
                    <thead>
                      <tr>{['Εταιρεία','Πρόγραμμα','Σεισμός','Πλημμύρα','Φυσικές καταστροφές','Εκτιμώμενο Μηνιαίο','Εκτιμώμενο Ετήσιο','Εξοικονόμηση/μήνα'].map((h, i) => (
                        <th key={i} scope="col" style={{ background: 'var(--bg-elevated)', whiteSpace: i < 4 ? ('nowrap' as const) : undefined, textAlign: i > 1 && i < 5 ? ('center' as const) : i >= 5 ? ('right' as const) : undefined }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {filteredQuotes.map(q => {
                        const isCur = q.company === insProvider && q.plan === insPlanId;
                        return (
                          <tr key={q.plan} onClick={() => { u({ insProvider: q.company, insPlanId: q.plan, insEditCovers: false }); }}
                            className={isCur ? 'is-on' : undefined}
                            style={{ cursor: 'pointer', transition: 'background 0.15s' }}>
                            <td style={{ fontWeight: isCur ? 700 : 400, color: isCur ? 'var(--accent)' : 'var(--text-primary)' }}>{q.companyLabel}{isCur ? ' ✓' : ''}</td>
                            <td>{q.planLabel}</td>
                            <td style={{ color: q.earthquake ? 'var(--text-primary)' : 'var(--text-tertiary)', textAlign: 'center' as const, fontWeight: 700 }}>{q.earthquake ? 'Ναι' : 'Όχι'}</td>
                            <td style={{ color: q.flood     ? 'var(--text-primary)' : 'var(--text-tertiary)', textAlign: 'center' as const, fontWeight: 700 }}>{q.flood     ? 'Ναι' : 'Όχι'}</td>
                            <td style={{ color: q.natural   ? 'var(--text-primary)' : 'var(--text-tertiary)', textAlign: 'center' as const, fontWeight: 700 }}>{q.natural   ? 'Ναι' : 'Όχι'}</td>
                            <td className="num" style={{ fontWeight: 600, color: isCur ? 'var(--accent)' : 'var(--text-primary)', whiteSpace: 'nowrap' as const }}>{fe(q.monthlyEstimate)}</td>
                            <td className="num" style={{ whiteSpace: 'nowrap' as const }}>{fe(q.annualEstimate)}</td>
                            <td className="num" style={{ fontWeight: 700, whiteSpace: 'nowrap' as const }}>
                              {q.savings !== undefined && q.savings !== 0 ? `${q.savings > 0 ? '+' : ''}${fe(q.savings)}` : fe(0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                 </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans, background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: T.radius.badge }}>
                  * Εκτιμώμενες τιμές βάσει στοιχείων ακινήτου, Χρησιμοποίησε <a href="https://www.insurancemarket.gr/katoikia/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>insurancemarket.gr</a> για ακριβή προσφορά · Πάτα γραμμή για επιλογή
                </div>
                </>
              )}
            </div>
          )}

          {(!parseFloat(effectiveSqm) || !parseFloat(insPropValue)) && (
            // Τα σκληροκωδικοποιημένα rgba(26,115,232,…) αγνοούσαν τα tokens: στο σκούρο
            // θέμα το πλαίσιο έμενε γαλάζιο-σε-γαλάζιο. Το InfoBanner παίρνει χρώμα από τον τόνο.
            <InfoBanner tone="info">Συμπλήρωσε εμβαδόν και αξία κτιρίου για συγκριτική εκτίμηση ασφαλίστρων.</InfoBanner>
          )}

        </div>

      </>)}

      {show('subscriptions') && (<>
        {subGroups.map(g => (
          <SubscriptionSection key={g.key} label={g.label} catalog={g.catalog}
            active={g.active} onToggle={g.toggle} onUpdate={g.update} total={g.cost} business={isBusiness}/>
        ))}

        {/* ══════════════════════════════════════════════════════════════════
            ΑΠΟ ΤΗ ΛΙΣΤΑ ΣΤΟ ΚΑΘΟΛΙΚΟ
            ────────────────────────────────────────────────────────────────
            Ως εδώ η καρτέλα ήταν λίστα: ο χρήστης δήλωνε δεκαπέντε συνδρομές,
            τις έβλεπε και τίποτα άλλο. Δεν έμπαιναν στις δαπάνες, δεν έφταναν
            στη λογιστική, δεν έβγαιναν στο Excel του λογιστή.

            ΕΝΑ ΚΟΥΜΠΙ ΚΑΙ ΟΧΙ ΕΝΑ ΑΝΑ ΣΥΝΔΡΟΜΗ. Δεκαπέντε κουμπιά «καταχώρηση»
            είναι δεκαπέντε ευκαιρίες να ξεχαστεί το ένα. Ο μήνας καταχωρείται
            ολόκληρος και όσα έχουν ήδη γραφτεί δεν ξαναγράφονται.
            ══════════════════════════════════════════════════════════════════ */}
        {charges.length > 0 && (
          <div style={card}>
            <SecHdr label="Στις δαπάνες"
              sub={`${monthNom(Number(curMonth.slice(5, 7)) - 1)}, με τα ποσοστά που όρισες.`}
              right={<span style={{ ...TT.kpi, fontSize: 18 }}>{fe(chargesTotal)}</span>}/>

            {/* Η ΓΡΑΜΜΗ ΤΟΥ ΦΟΡΟΥ ΥΠΑΡΧΕΙ ΜΟΝΟ ΟΤΑΝ ΥΠΑΡΧΕΙ ΦΟΡΟΣ. Ένα «0,00€
                αντίστροφη χρέωση» σε ιδιώτη είναι θόρυβος με νομικό ύφος. */}
            {isBusiness && vatTotal > 0 && (
              <p style={{ ...TT.bodySm, margin: '0 0 12px', lineHeight: 1.6 }}>
                Από αυτά, {fe(vatTotal)} είναι ΦΠΑ που αποδίδεις εσύ με αντίστροφη χρέωση:
                {' '}{intraEu.length > 0 && `${intraEu.length} ενδοκοινοτικές λήψεις`}
                {intraEu.length > 0 && thirdCountry.length > 0 && ' και '}
                {thirdCountry.length > 0 && `${thirdCountry.length} από τρίτες χώρες`}.
              </p>
            )}

            {/* ΤΟ ΑΓΝΩΣΤΟ ΛΕΓΕΤΑΙ, ΔΕΝ ΜΑΝΤΕΥΕΤΑΙ. Χωρίς χώρα, η συνδρομή
                καταχωρείται κανονικά ως δαπάνη — αλλά χωρίς κατάταξη και ο
                λογιστής θα το βρει τον Απρίλιο αντί για σήμερα. */}
            {isBusiness && needCountry.length > 0 && (
              <p style={{ ...TT.bodySm, color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.6 }}>
                {needCountry.length === 1 ? 'Μία συνδρομή δεν έχει' : `${needCountry.length} συνδρομές δεν έχουν`} δηλωμένη
                χώρα παρόχου: {needCountry.map(c => c.label).join(', ')}. Η χώρα γράφεται στο παραστατικό, δίπλα στα
                στοιχεία της εταιρείας και κρίνει αν η λήψη είναι ενδοκοινοτική ή από τρίτη χώρα.
              </p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {/* `field` και όχι size="lg": το addBtn έδινε ΚΑΙ πλήρες πλάτος, οπότε
                  το μήνυμα από δίπλα τυλιγόταν από κάτω. Μόνο το `field` κρατά
                  και το ύψος πεδίου και το πλάτος της σειράς. */}
              <Btn variant="primary" field onClick={bookMonth} disabled={booking || chargesTotal <= 0}>
                {booking ? 'Καταχωρείται…' : 'Καταχώρηση στις δαπάνες'}
              </Btn>
              {bookedCount > 0 && (
                <span style={{ ...TT.bodySm, color: 'var(--text-secondary)' }}>
                  {bookedCount === 1 ? 'Μία γραμμή μπήκε' : `${bookedCount} γραμμές μπήκαν`} στο καθολικό.
                </span>
              )}
            </div>

            {/* ΟΙ ΛΗΞΕΙΣ ΠΟΥ ΠΛΗΣΙΑΖΟΥΝ, ΜΕ ΤΡΟΠΟ ΝΑ ΤΙΣ ΘΥΜΗΘΕΙΣ. Οι σύνδεσμοι
                ανοίγουν το WhatsApp ή το Viber με έτοιμο το μήνυμα — καμία
                υπηρεσία στη μέση, κανένα κόστος, κανένας αριθμός που φεύγει από
                τη συσκευή. Η ίδια η ανανέωση μπαίνει ούτως ή άλλως στο
                ημερολόγιο, από τον συγχρονισμό παραπάνω. */}
            {expiring.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
                {expiring.map(c => (
                  <div key={c.service} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                    gap: 12, flexWrap: 'wrap', padding: '7px 0' }}>
                    <span style={{ ...TT.bodySm, color: 'var(--text-primary)' }}>
                      {c.label}, ανανέωση {localDay(c.renewalDate).toLocaleDateString('el-GR')}
                    </span>
                    <ReminderLinks subject={{
                      what: `η συνδρομή ${c.label} ανανεώνεται`,
                      when: c.renewalDate,
                      amount: c.monthly,
                      action: 'Πρόλαβε να την ακυρώσεις ή να αλλάξεις πακέτο πριν τη χρέωση',
                    }}/>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Άλλες Πάγιες Συνδρομές ───────────────────────────────────────── */}
        <div style={card}>
          {secHdr('Άλλες πάγιες συνδρομές')}
          <div style={{ background: 'var(--bg-elevated)', borderRadius: T.radius.inner, padding: 16, marginBottom: 14, border: '1px solid var(--border-subtle)' }}>
            {/* Η ΕΝΕΡΓΕΙΑ ΕΙΝΑΙ Η ΤΕΤΑΡΤΗ ΣΤΗΛΗ ΤΗΣ ΣΕΙΡΑΣ, όχι κουμπί κρεμασμένο
                από κάτω δεξιά. Τρία πεδία και μια ενέργεια είναι ΕΝΑ βήμα και
                διαβάζεται από αριστερά προς τα δεξιά σε μία ευθεία.
                Και δεν φαίνεται πια πατήσιμο όταν δεν είναι: ήταν πάντα σε
                χρώμα ενέργειας και, χωρίς ονομασία ή κόστος, δεν έκανε τίποτα. */}
            {/* Ιδιος λόγος με τις Εκτακτες Εισφορές: σε τηλέφωνο το πρόθεμα
                «Παράδειγμα: » έπιανε 105 από τα 132 του κουτιού. */}
            <div {...fixedCols(4, 14)}>
              <TextInput   label="Ονομασία"             value={newSubName}    onChange={setNewSubName}    placeholder="Netflix"/>
              <NumberInput label="Κόστος τον μήνα"      value={newSubPrice}   onChange={setNewSubPrice}   suffix="€"/>
              <DatePicker  label="Ημερομηνία ανανέωσης" value={newSubRenewal} onChange={setNewSubRenewal}/>
              <Btn variant="primary" field disabled={!newSubName.trim() || !newSubPrice}
                onClick={() => { u({ otherSubs: [...(otherSubs || []), { name: newSubName, price: newSubPrice, renewalDate: newSubRenewal }] }); setNewSubName(''); setNewSubPrice(''); setNewSubRenewal(''); }}>
                Προσθήκη
              </Btn>
            </div>
          </div>
          {(otherSubs || []).map((s, i) => {
            const daysLeft = s.renewalDate ? daysUntil(s.renewalDate) ?? 0 : null;
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: T.font.sans }}>{s.name}</span>
                  {s.renewalDate && <span style={{ fontSize: 'var(--fs-xs)', color: daysLeft !== null && daysLeft <= 7 ? 'var(--warning)' : 'var(--text-tertiary)', marginLeft: 12, fontFamily: T.font.sans }}>{localDay(s.renewalDate).toLocaleDateString('el-GR')}{daysLeft !== null && daysLeft <= 7 ? `, σε ${daysLeft} ημέρες` : ''}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>{fe(parseFloat(s.price))} / μήνα</span>
                  {/* `round` γιατί το παλιό radius ήταν 100, δηλαδή κύκλος. Το λεκτικό
                      έλειπε εντελώς: ο αναγνώστης οθόνης άκουγε μόνο «✕». */}
                  <IconBtn label={`Διαγραφή συνδρομής ${s.name}`} round onClick={() => u({ otherSubs: (otherSubs || []).filter((_, j) => j !== i) })}>
                    <span style={{ fontSize: 12 }}>✕</span>
                  </IconBtn>
                </div>
              </div>
            );
          })}
          {total > 0 && (
            <div style={{ marginTop: 16, background: 'var(--bg-elevated)', borderRadius: T.radius.inner, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-subtle)' }}>
              <div>
                {/* Η ετικέτα απαριθμούσε «ασφάλεια + streaming + cloud + άλλα»
                    ακόμη κι όταν υπήρχαν μόνο δύο από τα τέσσερα, ενώ η γραμμή
                    από κάτω έγραφε ήδη ποια ακριβώς αθροίζονται. Δύο απαντήσεις
                    στην ίδια ερώτηση και η μία λάθος. */}
                <div style={{ ...TT.bodySm, color: 'var(--text-secondary)' }}>Σύνολο ανά μήνα</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.sans, marginTop: 2 }}>
                  {[
                    insCost > 0 && `Ασφάλεια ${fe(insCost)}`,
                    ...subGroups.filter(g => g.cost > 0).map(g => `${g.short} ${fe(g.cost)}`),
                    otherCost > 0 && `Άλλα ${fe(otherCost)}`,
                  ].filter(Boolean).join(' + ')}
                </div>
              </div>
              <div style={{ textAlign: 'right' as const }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fe(total)} / μήνα</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{fe(total * 12)} / έτος</div>
              </div>
            </div>
          )}
        </div>
      </>)}

    </div>
  );
}