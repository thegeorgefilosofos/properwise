'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΤΑΣΤΑΣΗ ΤΟΥ ΠΙΝΑΚΑ: ΧΡΗΣΤΗΣ, ΑΚΙΝΗΤΑ, ΠΛΟΗΓΗΣΗ, ΡΥΘΜΙΣΕΙΣ, ΕΝΕΡΓΕΙΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Ό,τι φορτώνει και θυμάται το κέλυφος του πίνακα: ο χρήστης και το πλάνο
// του, τα ακίνητα και το ενεργό, η καρτέλα και η ορατότητά της, οι
// ειδοποιήσεις του μενού, η διαγραφή ακινήτου, η αποσύνδεση και οι εντολές
// της παλέτας. Η σελίδα (page.tsx) μόνο το αποδίδει.
// ═══════════════════════════════════════════════════════════════════════════
import { useNavHistory } from '../useNavHistory'
import { useEffect, useState, useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hardNavigate } from '@/lib/core/navigate'
import * as propertyStore from '@/lib/data/properties'
import * as calendarStore from '@/lib/data/calendar'
// Το προφίλ χρέωσης έχει ένα σπίτι: lib/data/billing.
import * as billing from '@/lib/data/billing'
import * as pushDevices from '@/lib/data/pushSubscriptions'
import { unsubscribeDevice, setDeviceNotify } from '@/lib/push/client'
import type { User } from '@supabase/supabase-js'
import { writeStatus, type PropertyStatus } from '@/lib/property/status'
import type { OwnerContext } from '@/lib/property/visibility'
import { LEGAL_FORMS, type LegalForm } from '@/lib/accounting/dossier'
import { confirmDialog } from '@/components/ConfirmDialog'
import { notifyError } from '@/components/Toast'
import { clearHistory as clearAssistantHistory } from '../assistantPersona'
import { leaveDevice } from '@/lib/localPrivacy'
import {
  effectivePlan, livePlan, canAddProperty, planAtLeast, trialState, PROFESSIONAL_MIN_PLAN, type EntitlementInput,
} from '@/lib/billing/entitlements'
import { reveal, sanitizeRevealed, coreTabs, type DisclosureSignals } from '@/lib/nav/disclosure'
import { startPanel } from '@/lib/home/start'
import { saved } from '@/components/dbWrite'
import { logActivity } from '@/lib/activity'
import type { Property } from './model'
import { NAV_ITEMS, LAUNCH } from './nav'
import { useInventoryAlerts, useChecklistAlerts } from './alerts'


/** Η πλατφόρμα δεν αλλάζει όσο είναι ανοιχτή η σελίδα: καμία συνδρομή. */
const KBD_NEVER_CHANGES = () => () => {};

export function useDashboard() {
  const supabase = createClient();
  // Ο χρήστης έρχεται από `supabase.auth.getUser()` — έχει δικό του τύπο. Με
  // `any` κανένα από τα ~30 σημεία που διαβάζουν `user.id`/`user.email`/
  // `user.created_at` δεν ελεγχόταν, ούτε το `user_metadata`.
  const [user, setUser] = useState<User | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  // Για την ουρά των εισερχομένων: φέρνει μηνύματα ΟΛΩΝ των ακινήτων και ο
  // χρήστης διαλέγει πού γράφεται το καθένα.
  const financeProperties = properties.map(p => ({ id: p.id, name: p.name }));
  const [selected, setSelected] = useState<Property | null>(null);
  // Η ΚΑΡΤΕΛΑ ΕΙΝΑΙ ΤΟΠΟΘΕΣΙΑ. Ήταν `useState`, οπότε η διεύθυνση έμενε
  // `/dashboard` όσο βαθιά κι αν πήγαινε ο χρήστης: το «πίσω» του περιηγητή τον
  // έβγαζε από την εφαρμογή αντί να τον γυρίσει καρτέλα, η ανανέωση τον πετούσε
  // στην Επισκόπηση και δεν μπορούσε να στείλει σύνδεσμο ούτε σελιδοδείκτη.
  // Ίδια διεπαφή — κανένα από τα είκοσι `setNav` δεν άλλαξε.
  const [nav, setNav] = useNavHistory('overview');
  // ΤΟ ΙΣΤΟΡΙΚΟ ΠΛΟΗΓΗΣΗΣ ΕΦΥΓΕ ΑΠΟ ΕΔΩ. Κρατούσε την προηγούμενη καρτέλα για
  // να τη δείχνει ο σύνδεσμος επιστροφής — τρία hooks και μια κατάσταση που
  // παρήγαγε κύκλους ανάμεσα σε καρτέλες που παραπέμπουν η μία στην άλλη.
  // Ο κανόνας του «πίσω» είναι πλέον ένας και σταθερός· βλ. `backTab` πιο κάτω.

  // Deep-link καρτέλα ενοικιαστή → Απογραφή/Παράδοση με προ-συμπληρωμένα στοιχεία.
  const [handoverIntent, setHandoverIntent] = useState<{tenantName?:string;tenantPhone?:string;type?:'check_in'|'check_out'}|null>(null);
  // ΤΟ ΑΚΟΡΝΤΕΟΝ ΕΦΥΓΕ ΜΑΖΙ ΜΕ ΤΙΣ ΟΜΑΔΕΣ. Εδώ ζούσαν δύο states —`openGroup` με
  // αρχική τιμή 'Οικονομικά' και ένας καθρέφτης `lastNav` που τα συγχρόνιζε
  // μέσα στην ίδια απόδοση για να μην τινάζεται η μπάρα. Δύο states, ένας
  // συγχρονισμός και ένα σχόλιο τεσσάρων γραμμών, για να ανοιγοκλείνουν δύο
  // ομάδες που δεν μπορούσαν να έχουν πάνω από τρεις γραμμές.
  // Σταδιακή αποκάλυψη: ποιες καρτέλες έχει ήδη ανοίξει ο χρήστης και αν ζήτησε
  // να τις βλέπει όλες. Φορτώνονται από τη βάση ώστε να τον ακολουθούν παντού.
  const [revealedTabs, setRevealedTabs] = useState<string[]>([]);
  // Καθρέφτης του revealedTabs για σύγχρονη ανάγνωση/γράψιμο μέσα σε effect —
  // αποτρέπει το «τελευταίο γράψιμο κερδίζει» σε γρήγορη διαδοχή πλοηγήσεων.
  const revealedRef = useRef<string[]>([]);
  // Ζωντανός μόνο όσο είναι mounted το component. ΔΕΝ μηδενίζεται σε κάθε αλλαγή
  // καρτέλας (αυτό ακριβώς ακύρωνε τις ενημερώσεις πριν).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;   // το StrictMode τρέχει setup→cleanup→setup
    return () => { mountedRef.current = false; };
  }, []);
  const [navShowAll, setNavShowAll] = useState(false);
  const [navPrefsLoaded, setNavPrefsLoaded] = useState(false);
  // ΤΡΙΤΗ ΚΑΤΑΣΤΑΣΗ, ΞΕΧΩΡΙΣΤΗ ΑΠΟ ΤΟ «ΔΕΝ ΦΟΡΤΩΘΗΚΕ ΑΚΟΜΗ».
  // Το fail-open παρακάτω είναι σωστό για ΑΠΟΤΥΧΙΑ ανάγνωσης, αλλά το
  // navPrefsLoaded=false σήμαινε ταυτόχρονα «φορτώνει» ΚΑΙ «απέτυχε». Επειδή
  // ξεκινά false, κάθε φόρτωση της σελίδας περνούσε από κατάσταση «δείξε τα
  // πάντα»: η πλαϊνή μπάρα άνοιγε με δεκαεπτά καρτέλες, οι μισές αχνές και
  // άσχετες με το ακίνητο και μετά μάζευε σε έξι. Ένα μενού που αναδιπλώνεται
  // μπροστά στα μάτια σου δεν διαβάζεται ως «φόρτωσε» — διαβάζεται ως χαλασμένο.
  const [navPrefsFailed, setNavPrefsFailed] = useState(false);
  const [navSignals, setNavSignals] = useState<DisclosureSignals>({});
  const [loading, setLoading] = useState(true);
  /** Η ανάγνωση ακινήτων απέτυχε — ΔΙΑΦΟΡΕΤΙΚΟ από «δεν έχει ακίνητα». */
  const [loadError, setLoadError] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusDropdown, setStatusDropdown] = useState(false);
  const [editProperty, setEditProperty] = useState<Property | null>(null);
  // Από πού άνοιξε ο οδηγός: η Λογιστική τον ανοίγει στο ΑΦΜ του ιδιοκτήτη.
  const [editFocus, setEditFocus] = useState<'owner_afm' | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);  // συρόμενο μενού σε κινητό/tablet
  // Η ΑΛΛΑΓΗ ΑΚΙΝΗΤΟΥ ΑΛΛΑΖΕΙ ΟΛΗ ΤΗΝ ΟΘΟΝΗ ΚΑΙ ΔΕΝ ΑΝΑΚΟΙΝΩΝΟΤΑΝ. Οποιος
  // διαβάζει με αναγνώστη οθόνης άκουγε σιωπή: τα δεδομένα κάτω από τα δάχτυλά
  // του γίνονταν άλλου ακινήτου χωρίς καμία ένδειξη. Μία ήσυχη ζώνη το λέει.
  const [announce, setAnnounce] = useState('');
  const [cmdkOpen, setCmdkOpen] = useState(false);        // command palette (⌘K)
  // Ανοιχτή από την πρώτη απόδοση όταν το ζήτησε η συντόμευση του εικονιδίου. Το
  // παράθυρο ούτως ή άλλως περιμένει χρήστη και ακίνητο, που φορτώνονται μετά,
  // οπότε η αρχική τιμή δεν αλλάζει τίποτα στην πρώτη εικόνα — αλλάζει το ότι
  // δεν χρειάζεται δεύτερη απόδοση για να φανεί.
  const [quickAddOpen, setQuickAddOpen] = useState(LAUNCH.scan);// γρήγορη προσθήκη με φωτογραφία/σάρωση
  // Ανοίγει τη χειροκίνητη φόρμα δαπάνης από το τέταρτο πλακίδιο της σάρωσης.
  const [manualExpense, setManualExpense] = useState(0);
  // Ποιο αίτημα του μετρητή έχει ήδη ανοίξει φόρμα. Οι Δαπάνες στήνονται μόλις
  // ανοίξει η καρτέλα, οπότε το καθολικό χρειάζεται να ξέρει αν ο αριθμός που
  // βρίσκει στην πρώτη του απόδοση είναι εκκρεμές αίτημα ή παλιό.
  const [handledExpense, setHandledExpense] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);// καλωσόρισμα πρώτης χρήσης

  // ── Ο ΠΙΝΑΚΑΣ «ΑΠΟ ΠΟΥ ΞΕΚΙΝΑΣ» ─────────────────────────────────────────
  // Τα σήματα διαβάζονται ΜΙΑ φορά, μαζί με τα υπόλοιπα counts της εκκίνησης:
  // ο πίνακας δεν δικαιολογεί δικό του ερώτημα σε κάθε φόρτωση της Επισκόπησης.
  const [startSignals, setStartSignals] = useState({ documents: 0, taxEvents: 0 });
  const [startCollapsed, setStartCollapsed] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [scanAfterAdd, setScanAfterAdd] = useState(false);// «Σάρωση εγγράφου» της υποδοχής: σάρωση μόλις αποθηκευτεί το ακίνητο
  const [plan, setPlan] = useState<string>('free');       // τρέχον πακέτο συνδρομής (billing_profiles)
  const [compPlan, setCompPlan] = useState<string|null>(null);   // δωρεάν πρόσβαση: επίπεδο (π.χ. από referral)
  const [compUntil, setCompUntil] = useState<string|null>(null); // δωρεάν πρόσβαση: λήξη (ISO)
  // Η σφραγίδα της δοκιμής. Οσο λείπει, ισχύει η τοπική δοκιμή των 30 ημερών·
  // μόλις μπει, η πρόσβαση βγαίνει ΑΠΟΚΛΕΙΣΤΙΚΑ από τη συνδρομή.
  const [trialUsedAt, setTrialUsedAt] = useState<string|null>(null);
  // ΚΡΑΤΗΣΗ ΥΠΟΒΑΘΜΙΣΗΣ: το πακέτο που έχει πληρωθεί και κρατιέται ως την
  // ανανέωση. Χωρίς αυτά τα δύο, ο πελάτης που ζήτησε να κατέβει έχανε την ίδια
  // ώρα ό,τι είχε πληρώσει για ολόκληρο τον μήνα.
  const [holdPlan, setHoldPlan] = useState<string|null>(null);
  // ΟΙ ΘΕΣΕΙΣ ΑΠΟ ΣΥΣΤΑΣΕΙΣ ΔΙΑΒΑΖΟΝΤΑΙ ΚΑΙ ΔΕΝ ΔΙΑΒΑΖΟΝΤΑΝ. Η βάση τις μετρά
  // στο όριο ακινήτων από τον Αύγουστο· η οθόνη δεν τις ήξερε, οπότε ο χρήστης
  // που έφερνε φίλο έβλεπε το κουμπί «Προσθήκη ακινήτου» κλειστό ενώ η βάση θα
  // δεχόταν το επόμενο ακίνητο.
  const [bonusProps, setBonusProps] = useState<number|null>(null);
  const [bonusUntil, setBonusUntil] = useState<string|null>(null);
  const [holdUntil, setHoldUntil] = useState<string|null>(null);
  // ΤΟ ΟΝΟΜΑ ΙΔΙΟΚΤΗΤΗ ΕΙΧΕ ΔΥΟ ΣΤΗΛΕΣ ΚΑΙ ΚΑΝΕΝΑΝ ΑΝΑΓΝΩΣΤΗ ΕΔΩ.
  // Διαβαζόταν από το `billing_profiles.owner_name`, κρατιόταν σε κατάσταση και
  // περνούσε στην Επισκόπηση μαζί με χειριστή αποθήκευσης — που δεν
  // χρησιμοποιούσε κανένα από τα δύο. Το όνομα που ΟΝΤΩΣ τυπώνεται στα επίσημα
  // έγγραφα και στη δήλωση μίσθωσης ζει στο `property_settings.owner_name`,
  // γράφεται στον οδηγό προσθήκης ακινήτου και είναι η μία πηγή.
  const [profileType, setProfileType] = useState<'individual'|'professional'>('individual'); // τύπος προφίλ → οδηγεί το interface
  // ΝΟΜΙΚΗ ΜΟΡΦΗ (φυσικό / νομικό πρόσωπο): ένα από τα τρία κριτήρια ορατότητας.
  //
  // ΔΕΝ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΜΕ ΤΟ profile_type. Το «Επαγγελματίας» περιγράφει τον ρόλο
  // στην εφαρμογή (διαχειρίζεται ξένα ακίνητα)· η νομική μορφή περιγράφει τον
  // φορολογούμενο. Ένας μεσίτης μπορεί να είναι ατομική επιχείρηση και ένας
  // ιδιώτης με τρία ακίνητα να τα έχει σε ΙΚΕ. Η μαντεψιά από το ένα στο άλλο θα
  // έδειχνε ΕΦΚΑ και αποσβέσεις κτιρίου σε κάποιον που δεν έχει επιχείρηση.
  //
  // Η στήλη `legal_form` υπάρχει πλέον στο billing_profiles (migration
  // 20260729120000_legal_form.sql) και διαβάζεται παρακάτω. Οι τέσσερις τιμές της
  // βάσης διπλώνουν στις δύο που χρειάζεται η μηχανή ορατότητας: ό,τι έχει
  // επιχειρηματική δραστηριότητα (ατομική, Ο.Ε./Ε.Ε., εταιρεία) μετρά ως 'company'
  // εδώ, γιατί το ερώτημα που απαντά αυτό το πεδίο είναι «να δείξω ΕΦΚΑ, Ε3 και
  // απόσβεση κτιρίου;». Ο ΙΣΟΛΟΓΙΣΜΟΣ δεν κρίνεται από εδώ — κρέμεται από τα
  // βιβλία (`bookkeeping`), γιατί μια Ο.Ε. μπορεί να είναι απλογραφικά.
  // Αν λείπει ή είναι άγνωστη η τιμή, μένει το ασφαλές 'individual': κρύβει τα
  // εταιρικά αντί να τα εφευρίσκει σε κάποιον που δεν έχει επιχείρηση.
  // ΜΙΑ ΤΙΜΗ, ΜΙΑ ΚΑΤΑΣΤΑΣΗ. Εδώ κρατιόνταν ΔΥΟ states γεμισμένα απο την ίδια
  // στήλη της βάσης: το `taxForm` με τις τέσσερις μορφές και το `legalForm` με
  // τη δυαδική περίληψή του. Δύο εντολές ενημέρωσης για μια πληροφορία που
  // είναι μία — και δύο πράγματα που μπορούν να ξεσυγχρονιστούν. Η ορατότητα
  // παίρνει πλέον την πραγματική μορφή και κάνει τη σύμπτυξη μέσα της.
  const [taxForm, setTaxForm] = useState<LegalForm>('individual');
  const [isPartner, setIsPartner] = useState(false);      // ιδιότητα Συνεργάτη (referral_partners)
  const [showUpgrade, setShowUpgrade] = useState(false);  // modal ορίου ακινήτων
  // Η ΕΝΔΕΙΞΗ ΣΥΝΤΟΜΕΥΣΗΣ ΔΕΝ ΕΙΝΑΙ ΚΑΤΑΣΤΑΣΗ, ΕΙΝΑΙ ΙΔΙΟΤΗΤΑ ΤΗΣ ΣΥΣΚΕΥΗΣ.
  // Ήταν κατάσταση με προεπιλογή «Ctrl K» και ένα effect που την άλλαζε σε «⌘K»
  // μετά την πρώτη απόδοση: ο χρήστης του Mac έβλεπε το «Ctrl K» να αναβοσβήνει.
  // Το `useSyncExternalStore` δέχεται ξεχωριστή τιμή για τον διακομιστή, οπότε το
  // React ξέρει ότι η διαφορά είναι δηλωμένη και όχι ασυμφωνία ενυδάτωσης.
  const kbdHint = useSyncExternalStore(
    KBD_NEVER_CHANGES,
    () => (/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '') ? '⌘K' : 'Ctrl K'),
    () => 'Ctrl K',
  );

  // Προσβασιμότητα: εφαρμογή αποθηκευμένων προτιμήσεων σε όλη την εφαρμογή.
  useEffect(() => {
    try {
      const r = document.documentElement;
      if (localStorage.getItem('po_reduce_motion') === '1') r.classList.add('a11y-reduce-motion');
      if (localStorage.getItem('po_large_text') === '1') r.classList.add('a11y-large-text');
    } catch { /* ignore */ }
  }, []);

  // Καθολικό ⌘K / Ctrl+K για άνοιγμα του command palette.
  //
  // ΚΑΙ ΤΟ ESCAPE, ΠΟΥ ΕΛΕΙΠΕ ΕΝΤΕΛΩΣ. Το συρόμενο μενού και το μενού
  // κατάστασης άνοιγαν με πληκτρολόγιο και ΔΕΝ έκλειναν με πληκτρολόγιο: ο
  // μόνος τρόπος ήταν κλικ πάνω σε ένα πέπλο που δεν εστιάζεται. Οποιος
  // πλοηγείται με Tab έμενε κλειδωμένος μέσα σε ένα μενού που είχε ανοίξει
  // μόνος του. Η μία συνδρομή στο πληκτρολόγιο κλείνει και τα δύο: το Escape
  // σημαίνει «πίσω» και δεν υπάρχει λόγος να το γράψει καθένα ξεχωριστά.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setCmdkOpen(v => !v); return; }
      if (e.key === 'Escape') { setSidebarOpen(false); setStatusDropdown(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { alertCount: inventoryAlerts, itemCount: inventoryItems, alertsUnknown: inventoryAlertsUnknown } = useInventoryAlerts(selected?.id||null, user?.id||null);
  const checklistAlerts = useChecklistAlerts(selected?.id||null);
  /** Οσες εκκρεμότητες ΞΕΡΟΥΜΕ: από την Απογραφή κι από τη Λίστα εργασιών. */
  const pendingCount = inventoryAlerts + checklistAlerts;
  /** Αν μια από τις αναγνώσεις δεν έγινε, το άθροισμα δεν είναι βεβαιότητα.
   *  Το δηλώνει προς το παρόν μόνο η Απογραφή: η `checklist.open` πετά το δικό
   *  της σφάλμα κι η διόρθωση ανήκει στο lib/data/checklist.ts. */
  const pendingUnknown = inventoryAlertsUnknown;

  // Δικαιώματα συνδρομής: το «ενεργό» πλάνο ορίζει τι βλέπεις (βασικό πλάνο,
  // ανυψωμένο από ενεργούς δωρεάν μήνες ή ιδιότητα Συνεργάτη).
  const ent: EntitlementInput = { plan, profileType, partner: isPartner, compPlan, compUntil, trialUsedAt, holdPlan, holdUntil, bonusProperties: bonusProps, bonusUntil, createdAt: user?.created_at ?? null };
  const effPlan = effectivePlan(ent);

  // ── ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ ΤΟΥ ΠΙΝΑΚΑ ΥΠΟΔΟΧΗΣ ──────────────────────────────────
  // Η ΔΟΚΙΜΗ ΡΩΤΙΕΤΑΙ ΑΠΟ ΤΗΝ ΙΔΙΑ ΠΗΓΗ ΜΕ ΤΟ ΠΛΑΝΟ. Ένας δεύτερος υπολογισμός
  // «είναι σε δοκιμή;» εδώ θα διαφωνούσε με το `effectivePlan` την ημέρα που θα
  // άλλαζε ο ορισμός — και ο χρήστης θα έβλεπε πίνακα δοκιμής με πληρωμένο πλάνο.
  const trial = trialState(ent);
  const startState = startPanel({
    properties: properties.length,
    documents: startSignals.documents,
    taxEvents: startSignals.taxEvents,
    trialActive: trial.active,
    daysLeft: trial.daysLeft,
  });
  const toggleStartPanel = (next: boolean) => {
    setStartCollapsed(next);
    if (!user) return;
    void saved('Η προτίμηση του πίνακα δεν αποθηκεύτηκε', supabase.from('onboarding_progress')
      .upsert({ user_id: user.id, start_collapsed: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }));
  };

  // Ο τρόπος «Επαγγελματίας» απαιτεί το πλάνο Επαγγελματίας (agency). Χωρίς αυτό, ο
  // χρήστης βλέπει ΜΟΝΟ την εμπειρία «Ιδιώτη» — δεν εμφανίζονται καθόλου οι
  // επαγγελματικές καρτέλες (η αλλαγή τρόπου στις Ρυθμίσεις παραπέμπει σε αναβάθμιση).
  const proEligible = planAtLeast(effPlan, PROFESSIONAL_MIN_PLAN);
  const effProfileType: 'individual' | 'professional' = proEligible ? profileType : 'individual';

  // ── ΤΙ ΑΦΟΡΑ ΑΥΤΟΝ ΤΟΝ ΧΡΗΣΤΗ ────────────────────────────────────────────
  // Τα τρία κριτήρια, μαζεμένα σε ένα αντικείμενο: νομική μορφή και ΟΛΑ τα ακίνητα
  // (η κατάσταση του επιλεγμένου δίνεται χωριστά, ανά απόφαση). Καμία μαντεψιά εδώ —
  // η λογική ζει στο lib/property/visibility.ts.
  const ownerCtx: OwnerContext = useMemo(() => ({ legalForm: taxForm, properties }), [taxForm, properties]);

  // «Δείξε μου τα πάντα»: ρητή επιλογή του χρήστη. Fail-open: αν οι προτιμήσεις δεν
  // διαβάστηκαν (σφάλμα δικτύου), δείχνουμε τα πάντα. Καλύτερα ένα γεμάτο μενού παρά
  // να «εξαφανιστούν» καρτέλες επειδή έπεσε ένα ερώτημα.
  // «Δείξε μου τα πάντα» ΜΟΝΟ όταν το ζήτησε ο χρήστης, ή όταν η ανάγνωση των
  // προτιμήσεων ΑΠΕΤΥΧΕ (fail-open: καλύτερα γεμάτο μενού παρά να «εξαφανιστούν»
  // καρτέλες επειδή έπεσε ένα ερώτημα). Όσο ΦΟΡΤΩΝΕΙ, δείχνουμε μόνο τις βασικές
  // — είναι εξ ορισμού σχετικές με κάθε ακίνητο, οπότε δεν μπορεί να είναι λάθος.
  const showAllTabsPref = navShowAll || navPrefsFailed;

  // ── Σταδιακή αποκάλυψη καρτελών ──────────────────────────────────────────
  const disclosure = useMemo(() => ({
    profileType: effProfileType,
    revealed: revealedTabs,
    showAll: showAllTabsPref,
    // Μόνο σήματα ΣΥΣΣΩΡΕΥΣΗΣ. Η κατάσταση του ακινήτου δεν περνά από εδώ: την
    // κρίνει το tabDecision και ήταν γραμμένη και στα δύο σημεία.
    signals: { ...navSignals, openTasks: checklistAlerts },
  }), [effProfileType, revealedTabs, showAllTabsPref, navSignals, checklistAlerts]);

  // Κάθε επίσκεψη σε καρτέλα την αποκαλύπτει μόνιμα — από όπου κι αν ήρθε
  // (μενού, ⌘K, βοηθός, πλακίδιο Επισκόπησης). Ένα σημείο, καμία διαρροή.
  useEffect(() => {
    if (!navPrefsLoaded || !user) return;
    // Καταγράφουμε ΚΑΘΕ επίσκεψη σε μη-βασική καρτέλα, ακόμη κι όταν είναι ήδη
    // ορατή. Παλιότερα βγαίναμε νωρίς αν η καρτέλα φαινόταν — που με ενεργό το
    // «Δες όλες τις καρτέλες» ισχύει ΠΑΝΤΑ, οπότε τίποτα δεν καταγραφόταν και
    // επιστρέφοντας στο απλοποιημένο μενού ο χρήστης έχανε ό,τι χρησιμοποιούσε.
    if (coreTabs(effProfileType).includes(nav)) return;
    if (revealedRef.current.includes(nav)) return;

    // Ο ref είναι η πηγή για το γράψιμο και ενημερώνεται ΣΥΓΧΡΟΝΑ: δύο γρήγορες
    // πλοηγήσεις συσσωρεύουν αντί να γράφει η δεύτερη πάνω στην πρώτη (το state
    // δεν προλαβαίνει να ενημερωθεί μέσα σε ένα round-trip δικτύου).
    const next = reveal(revealedRef.current, nav);
    revealedRef.current = next;
    const tab = nav;
    supabase.from('onboarding_progress').upsert({ user_id: user.id, revealed_tabs: next }, { onConflict: 'user_id' })
      .then(({ error }) => {
        if (error) {
          // ΠΡΟΣΟΧΗ στην επαναφορά: μια αποτυχία ΔΕΝ επιτρέπεται να σβήσει καρτέλα
          // που μια μεταγενέστερη, ΕΠΙΤΥΧΗΜΕΝΗ εγγραφή έχει ήδη αποθηκεύσει. Ο ref
          // είναι κοινός, οπότε αφαιρούμε μόνο αν είναι ακόμη το ΤΕΛΕΥΤΑΙΟ στοιχείο
          // — δηλαδή αν καμία άλλη εγγραφή δεν πρόλαβε να το «κλειδώσει» από πίσω.
          const cur = revealedRef.current;
          if (cur[cur.length - 1] === tab) revealedRef.current = cur.slice(0, -1);
          return;
        }
        // Δημοσιεύουμε ΜΟΝΟ ό,τι επιβεβαιωμένα γράφτηκε (`next`), όχι τον τρέχοντα
        // ref: αυτός μπορεί να περιέχει καρτέλες με εγγραφή ακόμη σε πτήση, που
        // ίσως αποτύχει. Η ενεργή καρτέλα φαίνεται ούτως ή άλλως (id===nav) και
        // η δική της εγγραφή θα τη δημοσιεύσει μόλις επιβεβαιωθεί.
        if (mountedRef.current) {
          setRevealedTabs(prev => (prev.includes(tab) ? prev : [...prev, tab]));
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, navPrefsLoaded, user, effProfileType]);

  // Μία πηγή αλήθειας για το «απλοποιημένο μενού»: το κουμπί στην μπάρα και ο
  // διακόπτης στις Ρυθμίσεις γράφουν εδώ, ώστε η αλλαγή να φαίνεται αμέσως.
  const setNavShowAllPref = (v: boolean) => {
    setNavShowAll(v);
    if (user) void saved('Η προτίμηση μενού δεν αποθηκεύτηκε',
      supabase.from('onboarding_progress').upsert({ user_id: user.id, nav_show_all: v }, { onConflict: 'user_id' }));
  };
  const showAllTabs = () => setNavShowAllPref(true);

  const fetchProperties = useCallback(async (uid: string) => {
    // ΤΟ «ΔΕΝ ΔΙΑΒΑΣΤΗΚΕ» ΔΕΝ ΕΙΝΑΙ «ΔΕΝ ΕΧΕΙΣ ΤΙΠΟΤΑ».
    //
    // Το `error` πεταγόταν και το `data || []` έκανε την αποτυχία να μοιάζει με
    // κενό χαρτοφυλάκιο: ο ιδιοκτήτης τριών ακινήτων, με κακό δίκτυο ή ληγμένο
    // token, έβλεπε «Καλωσήρθες — πρόσθεσε το πρώτο σου ακίνητο». Το χειρότερο
    // δεν είναι η λάθος οθόνη· είναι ότι πιστεύει πως έχασε τα δεδομένα του.
    const { rows: props, error } = await propertyStore.listWithError<Property>(supabase, uid, { columns: '*', orderBy: 'created_at' });
    if (error) { setLoadError(true); return null; }
    setLoadError(false);
    setProperties(props);
    if (props.length > 0 && !selected) setSelected(props[0]);
    else if (selected) setSelected(props.find(p => p.id === selected.id) || props[0] || null);
    // Η λίστα επιστρέφεται για όποιον θέλει να διαλέξει ΑΜΕΣΩΣ ένα ακίνητο
    // που μόλις γράφτηκε (οδηγός → σάρωση), χωρίς να περιμένει την απόδοση.
    return props;
  }, [selected, supabase]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { hardNavigate('/login'); return; }
      setUser(user);
      // Καταγραφή παραπομπής (referral) στην πρώτη σύνδεση, idempotent. Η RPC
      // αναλύει τον κωδικό στον κάτοχο, μπλοκάρει την αυτο-παραπομπή και γράφει
      // τον referrer, ώστε η σύσταση να προσμετράται σωστά στον συστήνοντα.
      const refBy = (user.user_metadata as { referred_by?: string } | null)?.referred_by;
      if (refBy) { supabase.rpc('redeem_referral', { p_code: String(refBy) }).then(() => {}); }
      // Ιδιότητα συνεργάτη (για το έμβλημα στο header), αν έχει κερδηθεί.
      supabase.from('referral_partners').select('user_id').eq('user_id', user.id).maybeSingle().then(({ data }) => setIsPartner(!!data));
      // Τρέχον πλάνο (για το όριο ακινήτων). Αν δεν υπάρχει προφίλ, δωρεάν.
      billing.profile<{ plan?: string|null; profile_type?: string|null; comp_plan?: string|null; comp_until?: string|null; trial_used_at?: string|null; hold_plan?: string|null; hold_until?: string|null; bonus_properties?: number|null; bonus_properties_until?: string|null; legal_form?: string|null; subscription_status?: string|null; mor_ends_at?: string|null }>(supabase, user.id, 'plan, profile_type, comp_plan, comp_until, trial_used_at, hold_plan, hold_until, bonus_properties, bonus_properties_until, legal_form, subscription_status, mor_ends_at').then((data) => { setPlan(livePlan(data)); setProfileType(data?.profile_type === 'professional' ? 'professional' : 'individual'); setCompPlan((data as { comp_plan?: string|null } | null)?.comp_plan ?? null); setCompUntil((data as { comp_until?: string|null } | null)?.comp_until ?? null); setTrialUsedAt((data as { trial_used_at?: string|null } | null)?.trial_used_at ?? null); setHoldPlan((data as { hold_plan?: string|null } | null)?.hold_plan ?? null); setHoldUntil((data as { hold_until?: string|null } | null)?.hold_until ?? null); setBonusProps((data as { bonus_properties?: number|null } | null)?.bonus_properties ?? null); setBonusUntil((data as { bonus_properties_until?: string|null } | null)?.bonus_properties_until ?? null); const raw = (data as { legal_form?: string|null } | null)?.legal_form ?? '';
        setTaxForm(LEGAL_FORMS.includes(raw as LegalForm) ? raw as LegalForm : 'individual'); });
      // Μετατροπή κερδισμένων μηνών referral σε ενεργή δωρεάν πρόσβαση (server-verified,
      // idempotent). Εφαρμόζεται για την επόμενη φόρτωση· δεν είναι gameable από τον client.
      supabase.rpc('sync_comp_from_referrals').then(() => {});
      // Αυτόματη αποδοχή προσκλήσεων οργανισμού για το email του χρήστη (idempotent).
      supabase.rpc('accept_org_invites_for_me').then(() => {});
      // Καλωσόρισμα πρώτης χρήσης: μόνο για νέο χρήστη (χωρίς ακίνητα) που δεν
      // έχει ξαναδεί το onboarding (πρόοδος στη βάση, όχι μόνο τοπικά).
      // Το `finally` εγγυάται ότι ο δείκτης φόρτωσης κλείνει ΠΑΝΤΑ: αν κάποιο
      // await (ανάγνωση ακινήτων ή τα ερωτήματα υποδοχής) πετάξει, χωρίς αυτό
      // η οθόνη θα έμενε για πάντα στο spinner.
      try {
        await fetchProperties(user.id);
        const cnt = (t: string) => supabase.from(t).select('id', { count: 'exact', head: true }).eq('user_id', user.id);
        // ΕΝΑ COUNT ΛΙΓΟΤΕΡΟ ΣΕ ΚΑΘΕ ΦΟΡΤΩΣΗ: ΕΦΥΓΕ ΤΟ cnt('contacts').
        // Γέμιζε το σήμα `hasContacts`, που έθρεφε τον κανόνα αποκάλυψης
        // 'contacts' — για καρτέλα που δεν υπάρχει ούτε στα NAV_GROUPS
        // (δεκατρείς κωδικοί) ούτε στο NAV_ORDER (δεκαέξι). Τα τρία σημεία που
        // διαβάζουν την αποκάλυψη διατρέχουν ΜΟΝΟ ids των NAV_GROUPS, άρα το
        // 'contacts' δεν ρωτήθηκε ποτέ. Οι Επαφές αποδίδονται ως ενότητα μέσα
        // στο Αρχείο και ο μόνος δρόμος στο nav==='contacts' (ο βοηθός) κρίνεται
        // από το tabDecision. Πέντε COUNT έγιναν τέσσερα, ίδια ακριβώς οθόνη.
        const [{ data: ob, error: obErr }, { count, error: countErr }, { count: docCount }, loanRes, invRes, taxEvents] = await Promise.all([
          supabase.from('onboarding_progress').select('welcomed, revealed_tabs, nav_show_all, start_collapsed').eq('user_id', user.id).maybeSingle(),
          cnt('user_properties'),
          cnt('property_documents'),
          cnt('loans'),
          cnt('inventory_items'),
          // Το τρίτο βήμα του πίνακα υποδοχής: «είδε τις προθεσμίες του». Το
          // σήμα δεν είναι επίσκεψη σε καρτέλα αλλά ΓΕΓΟΝΟΣ στο ημερολόγιό του —
          // μια επίσκεψη δεν αφήνει ίχνος και θα ζητούσε δικό της πεδίο, δηλαδή
          // δεύτερη αλήθεια για το ίδιο πράγμα.
          calendarStore.taxEventCount(supabase, user.id),
        ]);
        setStartSignals({ documents: docCount || 0, taxEvents: taxEvents });
        // ΑΓΝΩΣΤΟ ΔΕΝ ΣΗΜΑΙΝΕΙ ΜΗΔΕΝ. Αποτυχημένη μέτρηση γυρίζει `count: null`
        // και το `|| 0` έδειχνε το καλωσόρισμα πρώτης χρήσης σε ιδιοκτήτη με
        // ακίνητα. Ούτε το «δεν το έχει δει» το ξέρουμε όταν η πρόοδος δεν
        // διαβάστηκε. Μόνο μετρημένο μηδέν το ανοίγει.
        if (!obErr && !countErr && !ob?.welcomed && count === 0) setShowWelcome(true);
        // Σταδιακή αποκάλυψη: τι έχει ήδη ανοίξει + τι δικαιολογούν τα δεδομένα.
        //
        // ΚΡΙΣΙΜΟ: το supabase-js ΔΕΝ πετά εξαίρεση σε σφάλμα ερωτήματος — γυρίζει
        // { data: null, error }. Το try/catch από κάτω δεν πιάνει τίποτα. Αν δεν
        // ελέγξουμε ρητά το `error`, ένα αποτυχημένο read (π.χ. η εφαρμογή ανέβηκε
        // πριν εφαρμοστεί το migration που προσθέτει τις στήλες) θα περνούσε ως
        // «διαβάστηκαν κενές προτιμήσεις» και θα ΕΚΡΥΒΕ καρτέλες αντί να ανοίξει
        // fail-open. Μόνο όταν το read πετύχει δηλώνουμε τις προτιμήσεις φορτωμένες.
        const rec = ob as { revealed_tabs?: unknown; nav_show_all?: boolean; start_collapsed?: boolean | null } | null;
        setStartCollapsed(!!rec?.start_collapsed);
        if (obErr) {
          setNavPrefsFailed(true);    // → fail-open: φαίνονται ΟΛΕΣ οι καρτέλες
        } else {
          setNavPrefsFailed(false);
          const loadedTabs = sanitizeRevealed(rec?.revealed_tabs, NAV_ITEMS.map(i => i.id));
          revealedRef.current = loadedTabs;
          setRevealedTabs(loadedTabs);
          setNavShowAll(!!rec?.nav_show_all);
          setNavPrefsLoaded(true);
        }
        setNavSignals({
          hasLoan: (loanRes.count || 0) > 0,
          hasDocuments: (docCount || 0) > 0,
          hasInventory: (invRes.count || 0) > 0,
          daysSinceSignup: user.created_at
            ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000)
            : 0,
        });
        // Ενεργοποίηση σύστασης: ο νέος χρήστης έχει ≥1 ακίνητο & ≥1 σαρωμένο
        // έγγραφο → η σύστασή του «κλειδώνει» (idempotent, μόνο τη δική του γραμμή).
        if ((count || 0) >= 1 && (docCount || 0) >= 1) supabase.rpc('mark_referral_activated').then(() => {});
      } catch {}
      setLoading(false);
    };
    init();
    // ── ΤΡΕΧΕΙ ΜΙΑ ΦΟΡΑ ΚΑΙ ΠΡΕΠΕΙ ΝΑ ΤΡΕΧΕΙ ΜΙΑ ΦΟΡΑ ──────────────────────
    // Ο κανόνας ζητά `fetchProperties` στις εξαρτήσεις. Το `fetchProperties`
    // είναι `useCallback` με το `selected` μέσα του, δηλαδή αλλάζει ταυτότητα
    // κάθε φορά που ο χρήστης διαλέγει άλλο ακίνητο. Βάζοντάς το εδώ, ολόκληρη
    // η `init()` —έλεγχος ταυτότητας, προφίλ, πλάνο, συστάσεις, προσκλήσεις,
    // δώδεκα ερωτήματα— θα ξανάτρεχε σε ΚΑΘΕ αλλαγή ακινήτου.
    //
    // Η σιωπή δεν είναι άγνοια: γράφεται εδώ ώστε ο επόμενος να μη «διορθώσει»
    // μια εξάρτηση που είναι λάθος.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Προσθήκη ακινήτου με έλεγχο ορίου πλάνου: αν έφτασες το όριο, δείξε αναβάθμιση.
  const tryAddProperty = () => {
    if (canAddProperty(ent, properties.length)) setShowAddModal(true);
    else setShowUpgrade(true);
  };

  const updateStatus = async (status: PropertyStatus) => {
    if (!selected||!user) return;
    if (!await saved('Η κατάσταση του ακινήτου δεν άλλαξε',
      propertyStore.update(supabase, selected.id, writeStatus(status), user.id))) return;
    setStatusDropdown(false);
    await fetchProperties(user.id);
  };

  // Οριστική διαγραφή του τρέχοντος ακινήτου μαζί με τα συνδεδεμένα δεδομένα του.
  // Αν ήταν το τελευταίο ακίνητο, ανοίγει αυτόματα η νέα καταχώρηση (ξεκινάς από την αρχή).
  const deletePropertyById = async (pid: string, name: string) => {
    if (!user) return;
    // Το `wasLast` διαβάζεται ΠΡΙΝ τον διάλογο: το native confirm πάγωνε τη σελίδα,
    // οπότε «πλήθος ακινήτων» σήμαινε πάντα «τη στιγμή του κλικ». Ο νέος διάλογος δεν
    // παγώνει τίποτα — αν το μετρούσαμε μετά το await και εν τω μεταξύ φορτωνόταν άλλο
    // ακίνητο, ο οδηγός «νέα καταχώρηση» θα άνοιγε (ή δεν θα άνοιγε) άστοχα.
    const wasLast = properties.length <= 1;
    // ── ΟΤΑΝ ΣΒΗΝΕΙΣ ΞΕΝΟ ΑΚΙΝΗΤΟ, ΤΟ ΞΕΡΕΙΣ ΠΡΙΝ ΤΟ ΠΑΤΗΣΕΙΣ ─────────────
    // Ενα μέλος οργανισμού με δικαίωμα επεξεργασίας μπορεί να σβήσει ακίνητο
    // ΤΟΥ ΙΔΙΟΚΤΗΤΗ: η πολιτική org_del_properties το επιτρέπει ρητά. Ο
    // διάλογος έλεγε τα ίδια λόγια και στις δύο περιπτώσεις, σαν να ήταν δικό
    // του. Δεν αφαιρούμε το δικαίωμα που έδωσε ο ιδιοκτήτης· λέμε τι είναι.
    const mine = (properties.find(x => x.id === pid)?.user_id ?? user.id) === user.id;
    const ok = await confirmDialog(
      `Οριστική διαγραφή του ακινήτου «${name}»;\n\n`+
      `Θα διαγραφούν όλα τα συνδεδεμένα στοιχεία του (έσοδα, δαπάνες, λογαριασμοί, `+
      `ενοικιαστής, δάνεια, απογραφή, έγγραφα, διαμονές), μαζί με το ιστορικό `+
      `της συνομιλίας με τη Νόα γι’ αυτό. Η ενέργεια δεν αναιρείται.`+
      (mine ? `` : `\n\nΤο ακίνητο δεν είναι δικό σου: ανήκει στον ιδιοκτήτη που σε πρόσθεσε στην ομάδα. Η διαγραφή γράφεται στο ημερολόγιό του με το όνομά σου.`),
      { tone: 'negative', confirmLabel: 'Οριστική διαγραφή' }
    );
    if (!ok) return;
    // ── Η ΓΡΑΜΜΗ ΕΛΕΓΧΟΥ ΓΡΑΦΕΤΑΙ ΠΡΙΝ, ΟΧΙ ΜΕΤΑ ────────────────────────
    // Μετά τη διαγραφή το ακίνητο δεν υπάρχει και η log_activity δεν μπορεί
    // πια να βρει τον ιδιοκτήτη του — άρα η γραμμή θα κατέληγε στο ημερολόγιο
    // του δράστη, που είναι ακριβώς το σφάλμα που κλείνει η μετανάστευση
    // 20260824080000. Το όνομα ταξιδεύει στα μεταδεδομένα, γιατί ο πίνακας
    // κρατά μόνο αναγνωριστικό και το αναγνωριστικό δεν λέει τίποτα σε άνθρωπο.
    await logActivity(supabase, 'property_deleted', 'property', pid, { name });
    setStatusDropdown(false);
    // ── ΤΟ ΚΑΘΑΡΙΣΜΑ ΕΦΥΓΕ ΑΠΟ ΕΔΩ ────────────────────────────────────────
    // Εδώ καθόταν χειρόγραφη λίστα είκοσι πέντε πινάκων και είκοσι πέντε
    // ερωτήματα διαγραφής με `allSettled` — δηλαδή χωρίς κανείς να κοιτάζει τι
    // απάντησαν. Η λίστα ξεχνούσε έξι πίνακες (ανάμεσά τους τον ενεργό σύνδεσμο
    // δήλωσης άφιξης, με τα στοιχεία ταυτότητας των επισκεπτών), περιλάμβανε
    // έναν που δεν έχει καν στήλη `property_id` και ίσχυε μόνο για όποιον
    // σβήνει ακίνητο ΑΠΟ ΑΥΤΗ ΤΗΝ ΟΘΟΝΗ.
    //
    // Το καθάρισμα είναι πλέον ιδιότητα της βάσης: ξένα κλειδιά με CASCADE όπου
    // ο τύπος τα επιτρέπει, σκανδάλη όπου δεν τα επιτρέπει ακόμη. Ισχύει για
    // κάθε καλούντα — οθόνη, edge function, διαγραφή λογαριασμού — και δεν
    // ξεχνά, γιατί δεν είναι λίστα που συντηρεί άνθρωπος.
    // Βλ. supabase/migrations/20260814090000_referential_integrity.sql
    //
    // Το ακίνητο είναι η τελευταία γραμμή που φεύγει. Αν μείνει, ο χρήστης το
    // βλέπει άδειο στη λίστα και νομίζει ότι κάτι χάλασε μόνο του.
    if (!await saved('Το ακίνητο δεν διαγράφηκε',
      propertyStore.remove(supabase, pid, user.id))) return;
    // Σβήσε τη συνομιλία/μνήμη του βοηθού για το συγκεκριμένο ακίνητο (τοπικά στον browser).
    try { clearAssistantHistory(pid); } catch {}
    if (selected?.id === pid) setSelected(null);
    await fetchProperties(user.id);
    if (wasLast) { setNav('overview'); setShowAddModal(true); }
  };
  const deleteProperty = () => { if (selected) deletePropertyById(selected.id, selected.name); };

  // Καθάρισμα demo με ένα κλικ: σβήνει τα δείγματα ακίνητα/πελάτες/διαμονές.

  // ΟΣΟ ΔΙΑΒΑΖΕΤΑΙ ΤΟ ΕΓΓΡΑΦΟ, ΤΟ ΠΑΡΑΘΥΡΟ ΔΕΝ ΚΛΕΙΝΕΙ. Με Escape και
  // κλικ-στο-φόντο, ένα κατά λάθος πάτημα στη μέση της αναγνώρισης θα έχανε
  // τη σάρωση που πληρώθηκε.
  //
  // ΚΑΙ ΔΕΝ ΣΒΗΝΕΙ ΠΙΑ ΤΙΠΟΤΑ. Το κλείσιμο διέγραφε το «κενό προσχέδιο» που
  // έφτιαχνε σιωπηλά η «Σάρωση εγγράφου» της υποδοχής. Το προσχέδιο δεν
  // υπάρχει: η σάρωση ξεκινά πάνω σε ακίνητο που ο χρήστης αποθήκευσε από τον
  // οδηγό, με δική του κατάσταση· ένα κλείσιμο δεν έχει λόγο να το αγγίξει.
  const [scanBusy, setScanBusy] = useState(false);

  const closeQuickAdd = () => setQuickAddOpen(false);

  // Υγιεινή αποσύνδεσης σε κοινόχρηστη συσκευή.
  //
  // Οι caches του service worker ΔΕΝ κρατούν προσωπικά δεδομένα (μόνο στατικά),
  // οπότε από μόνες τους δεν ήταν το πρόβλημα. Το πραγματικό ρίσκο είναι το
  // localStorage: οι συνομιλίες του βοηθού κρατούν έως 40 μηνύματα ανά ακίνητο
  // και μέσα τους περνούν ονόματα ενοικιαστών, ΑΦΜ και ποσά. Αυτά σβήνονται.
  // Οι «αναμνήσεις» μένουν: είναι ρητή επιλογή του χρήστη, κλειδωμένες στο δικό
  // του id και καθαρίζονται από τις Ρυθμίσεις.
  const signOut = async () => {
    // ΠΡΩΤΑ η αποσύνδεση. Αν αποτύχει (π.χ. χαμένο δίκτυο), ο χρήστης παραμένει
    // συνδεδεμένος — και θα ήταν παράλογο να έχει ήδη χάσει τις συνομιλίες του
    // για μια αποσύνδεση που δεν έγινε. Το supabase-js επιστρέφει το σφάλμα ως
    // τιμή, δεν το πετά, οπότε το ελέγχουμε ρητά.
    // ΟΙ ΕΙΔΟΠΟΙΗΣΕΙΣ ΦΕΥΓΟΥΝ ΠΡΙΝ ΑΠΟ ΤΗ ΣΥΝΕΔΡΙΑ ΚΑΙ ΕΙΝΑΙ Η ΣΩΣΤΗ ΣΕΙΡΑ.
    // Η συνδρομή push ανήκει στη ΣΥΣΚΕΥΗ, όχι στη συνεδρία: χωρίς αυτό το βήμα,
    // ο αποσυνδεδεμένος υπολογιστής θα συνέχιζε να δείχνει κάθε πρωί τις
    // προθεσμίες του προηγούμενου χρήστη — και σε κοινή συσκευή αυτό είναι
    // διαρροή, όχι ενόχληση. Το σβήσιμο της γραμμής ΘΕΛΕΙ τη συνεδρία που
    // πρόκειται να λήξει: μετά την αποσύνδεση, η RLS δεν θα το επέτρεπε ποτέ.
    try {
      const gone = await unsubscribeDevice();
      if (gone) await pushDevices.remove(supabase, gone);
      setDeviceNotify(false);
    } catch { /* η αποσύνδεση δεν σταματά για μια συνδρομή */ }

    const { error } = await supabase.auth.signOut();
    if (error) {
      // duration 0 = μένει ώσπου να το κλείσει ο χρήστης, ίδιο βάρος με το alert που
      // αντικατέστησε. Οι δύο προτάσεις ενώθηκαν σε μία παράγραφο: το toast δεν
      // αποδίδει αλλαγές γραμμής και το «\n\n» θα κολλούσε τις προτάσεις μεταξύ τους.
      notifyError('Δεν έγινε η αποσύνδεση. Δες τη σύνδεσή σου στο δίκτυο και δοκίμασε ξανά. Τα δεδομένα σου στη συσκευή δεν πειράχτηκαν.', { duration: 0 });
      return;
    }
    leaveDevice();
    // ΠΛΗΡΗΣ ΦΟΡΤΩΣΗ, ΟΧΙ ΠΛΟΗΓΗΣΗ ΤΟΥ ROUTER: μετά την αποσύνδεση θέλουμε να
    // πεθάνει ΟΛΗ η μνήμη της εφαρμογής, όχι να μείνει ζωντανή με άδειο χρήστη.
    // Η σκληρή πλοήγηση (πλήρες reload) ζει στο lib/core/navigate.
    hardNavigate('/login');
  };

  return {
    user, properties, financeProperties, selected, setSelected, nav, setNav, handoverIntent,
    setHandoverIntent, navShowAll, loading, loadError, showAddModal, setShowAddModal,
    statusDropdown, setStatusDropdown, editProperty, setEditProperty, editFocus, setEditFocus, sidebarOpen, setSidebarOpen,
    announce, setAnnounce, cmdkOpen, setCmdkOpen, quickAddOpen, setQuickAddOpen, manualExpense,
    setManualExpense, handledExpense, setHandledExpense, showWelcome, setShowWelcome, startCollapsed, showPreview, setShowPreview,
    scanAfterAdd, setScanAfterAdd, plan, profileType, setProfileType, taxForm, showUpgrade, setShowUpgrade,
    kbdHint, inventoryItems, checklistAlerts, pendingCount, pendingUnknown, ent, effPlan, trial,
    startState, toggleStartPanel, effProfileType, ownerCtx, showAllTabsPref, disclosure,
    setNavShowAllPref, showAllTabs, fetchProperties, tryAddProperty, updateStatus, deleteProperty,
    scanBusy, setScanBusy, closeQuickAdd, signOut,
  }
}
