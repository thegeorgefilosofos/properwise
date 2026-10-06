'use client';

import BrandMark, { BrandLogo } from '@/components/BrandMark'
import Typesetter from '@/components/Typesetter';
import { propertyTypeLabel } from '@/lib/property/types';
import TabBoundary  from './components/TabBoundary';
// ΟΙ ΚΑΡΤΕΛΕΣ ΚΑΤΕΒΑΙΝΟΥΝ ΟΤΑΝ ΑΝΟΙΞΟΥΝ. Το «γιατί», μετρημένο, στο lazyTabs.tsx.
import {
  TabFinances,
  TabCalendar,
  TabRentROI,
  TabPricing,
  TabSettings,
  TabReferral,
  TabTenant,
  TabLoan,
  TabAccounting,
  TabInventory,
  TabContacts,
  TabChecklist,
  TabDocuments,
  TabComparison,
  TabPlan,
  TabClients,
  PortfolioTab,
  AddPropertyWizard,
  DocumentScan,
  WelcomeOnboarding,
} from './components/lazyTabs';
import { STATUSES, readStatus, statusLabel as statusLabelOf } from '@/lib/property/status';
import { tabDecision, canCompare } from '@/lib/property/visibility';
import AmaStrip from './components/AmaStrip';
import { ASSISTANT_NAME } from '@/lib/assistant/identity';
import { navLabel } from '@/lib/nav/labels';
import StartPanel from './components/StartPanel';
import DemoPreview from './components/DemoPreview';
import { CommandPalette, type CommandItem } from './components/CommandPalette';
import { T, Btn, Modal, Spinner, SecHdr } from '@/components/Theme';
import PropertyAssistant from './components/PropertyAssistant';
import PropertySwitcher from './components/PropertySwitcher';
import DpaModal from './components/DpaModal';
import CookieConsent from '@/app/CookieConsent';
import UpdateWatcher from './components/UpdateWatcher';
import { planBriefing } from './components/assistantPersona';
import UpgradeModal from './components/UpgradeModal';
import FeatureLock, { LockBadge } from './components/FeatureLock';
import { PLANS } from '@/lib/billing/plans';
import { isTabAllowed, isTabPurchasable, canAddProperty, hasFeature, planAtLeast, paidPlanForProfile, requiredPlanForFeature } from '@/lib/billing/entitlements';
import { hasAssistant } from '@/lib/billing/aiLimits';
import { isTabVisible, hiddenTabCount } from '@/lib/nav/disclosure';
import { askAssistant } from './components/AssistantStrip';
import {
  type Property,
  STATUS_COLORS,
} from './components/shell/model'
import {
  NAV_ITEMS, NAV_LABEL, NAV_ICON, NAV_GROUPS, SELF_DISCLOSING, ic, BOTTOM_NAV,
} from './components/shell/nav'
import { OverviewTab } from './components/OverviewTab'
import { useDashboard } from './components/shell/useDashboard'

export default function Dashboard() {
  const {
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
  } = useDashboard()

  // Ο χειροποίητος κύκλος είχε ΔΙΚΟ ΤΟΥ inline <style> με @keyframes spin — ακριβές
  // διπλότυπο του globals.css. Δύο ορισμοί της ίδιας κίνησης σημαίνει ότι μια αλλαγή
  // ταχύτητας στο ένα σημείο άφηνε το άλλο πίσω.
  // ΤΟ `!user` ΔΕΝ ΕΙΝΑΙ ΑΜΥΝΤΙΚΟ — ΤΟ ΑΠΟΚΑΛΥΨΕ Ο ΤΥΠΟΣ.
  // Με `useState<any>` περνούσαν αμέτρητα `user.id` στις καρτέλες παρακάτω
  // χωρίς κανέναν έλεγχο· ο σωστός τύπος έβγαλε 20 σφάλματα «possibly null».
  // Ο έλεγχος μπαίνει ΕΔΩ και όχι σε κάθε χρήση, γιατί εδώ είναι η αλήθεια:
  // το `init()` κάνει `setUser` ΠΡΙΝ το `fetchProperties` και όταν ο χρήστης
  // λείπει κάνει redirect στο /login ΧΩΡΙΣ `setLoading(false)` — άρα το
  // `loading===false` συνεπάγεται ήδη `user !== null` (μοναδικό
  // `setLoading(false)` αυτού του component: γραμμή 1340, στο τέλος του init·
  // το άλλο, στη γραμμή 449, ανήκει στο τοπικό `loading` του OverviewTab).
  // ΓΙ' ΑΥΤΟ ΤΟ `!user` ΔΕΝ ΑΛΛΑΖΕΙ ΣΥΜΠΕΡΙΦΟΡΑ: στο μονοπάτι του redirect το
  // `loading` μένει true και ο δείκτης φόρτωσης έδειχνε ήδη. Γράφεται εδώ,
  // στο υπάρχον gate, για να ΚΩΔΙΚΟΠΟΙΗΣΕΙ την αναλλοίωτη μία φορά και να
  // στενέψει τον τύπο για ΟΛΗ την απόδοση — αντί για 20 `!` ή cast στα σημεία
  // χρήσης, που θα σιώπαγαν τον έλεγχο αντί να τον ικανοποιήσουν.
  if (loading || !user) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--bg-base)'}}>
      <Spinner size={48} label="Φόρτωση…" />
    </div>
  );

  // ΟΝΟΜΑ, ΟΧΙ ΚΟΜΜΑΤΙ ΤΟΥ EMAIL (02.10.2026). Το μενού έγραφε «DE demo»: τα δύο
  // πρώτα γράμματα και το τοπικό μέρος της διεύθυνσης. Αρχικά από το όνομα που
  // δήλωσε ο χρήστης· χωρίς όνομα, ένα γράμμα και η λέξη «Λογαριασμός».
  const fullName = String(user?.user_metadata?.full_name ?? '').trim();
  const nameWords = fullName.split(/\s+/).filter(Boolean);
  const userInitials = nameWords.length
    ? (nameWords[0][0] + (nameWords.length > 1 ? nameWords[nameWords.length - 1][0] : '')).toUpperCase()
    : (user?.email?.[0] ?? '·').toUpperCase();
  const userLabel = fullName || 'Λογαριασμός';
  const statusColor = selected ? STATUS_COLORS[readStatus(selected)] : 'var(--text-secondary)';
  const statusLabel = selected ? statusLabelOf(selected) : '';
  // Η `getBadge` έφυγε: απαντούσε μόνο για `inventory` και `checklist`, που δεν
  // είναι καρτέλες του μενού. Τα δύο πλήθη τα διαβάζει απευθείας η κάτω μπάρα.

  // ── ΜΙΑ ΑΠΟΦΑΣΗ ΟΡΑΤΟΤΗΤΑΣ, ΕΝΑ ΣΗΜΕΙΟ ───────────────────────────────────
  //
  // Πριν αποφάσιζαν ΔΥΟ φίλτρα που δεν ήξεραν το ένα το άλλο: το `isTabRelevant`
  // κοιτούσε μόνο τον τύπο προφίλ, το `tabFitsStatus` μόνο την κατάσταση του
  // ακινήτου. Κανένα δεν ήξερε πόσα ακίνητα έχει ο χρήστης ούτε αν είναι φυσικό ή
  // νομικό πρόσωπο — δύο από τα τρία κριτήρια που ορίζουν τι βλέπει ο καθένας.
  // Τώρα αποφασίζει ένα αρχείο, το lib/property/visibility.ts· εδώ μένει η όψη.
  //
  // ΔΥΟ ΕΡΩΤΗΣΕΙΣ ΠΟΥ ΔΕΝ ΜΠΕΡΔΕΥΟΝΤΑΙ:
  //   • «Με αφορά;»          → tabDecision — κρύβει, με γραμμένο λόγο
  //   • «Θέλει αναβάθμιση;»  → isTabAllowed / FeatureLock — κλειδώνει, δεν κρύβει
  // Καρτέλα που δεν σε αφορά ΔΕΝ γίνεται ποτέ upsell: το λουκέτο πάνω σε κάτι που
  // δεν θα χρειαστείς είναι υπόσχεση αξίας που δεν υπάρχει.
  //
  // ΔΕΝ ΔΙΑΓΡΑΦΕΤΑΙ ΤΙΠΟΤΑ. Οι καρτέλες φεύγουν από την πλοήγηση, τα δεδομένα
  // μένουν ακέραια και επιστρέφουν τη στιγμή που το ακίνητο αλλάζει κατάσταση.
  const decide = (id: string) => tabDecision(id, ownerCtx, selected, { hasInventory: inventoryItems > 0 });

  // Ορατή στην πλοήγηση: ό,τι αφορά τον χρήστη — και, αν ζήτησε «δείξε τα όλα»,
  // και τα υπόλοιπα, αχνά και με τον λόγο ως tooltip.
  // Το «δείξε τα όλα» ανασταίνει ό,τι κρύβεται επειδή δεν χρειάζεται ΑΚΟΜΗ. ΔΕΝ
  // ανασταίνει ό,τι δεν ισχύει καθόλου για αυτό το ακίνητο: ο Ενοικιαστής σε
  // βραχυχρόνια, οι Αποδόσεις σε ιδιοχρησία. Εκεί το αχνό κουμπί δεν είναι
  // δυνατότητα που δεν έχει ανοίξει, είναι λάθος στην οθόνη.
  // ΨΕΥΔΟ-ΚΑΡΤΕΛΕΣ: δεν είναι οθόνες του μενού αλλά ΕΝΕΡΓΕΙΕΣ που ανοίγουν
  // παράθυρο πάνω από την τρέχουσα οθόνη — η σάρωση και η επεξεργασία των
  // στοιχείων του ακινήτου. Δεν περνούν από τη μηχανή ορατότητας γιατί δεν
  // εξαρτώνται από την κατάσταση: ισχύουν πάντα. Χωρίς αυτή τη γραμμή, το
  // φίλτρο της ατζέντας θα τις έκοβε ως «αόρατες καρτέλες».
  const PSEUDO_TABS = new Set(['scan', 'edit']);
  const navVisible = (id: string) => {
    if (PSEUDO_TABS.has(id)) return true;
    const d = decide(id); return d.visible || (showAllTabsPref && d.applies);
  };

  // Αν ο χρήστης βρίσκεται σε καρτέλα που μόλις έπαψε να τον αφορά (άλλαξε την
  // κατάσταση, διέγραψε ακίνητο), δεν τον αφήνουμε σε οθόνη που δεν ισχύει.
  // Παράγεται κατά την απόδοση, όχι σε effect: το effect θα έδειχνε για ένα καρέ
  // την παλιά οθόνη.
  const navSafe = navVisible(nav) ? nav : 'overview';

  // ── ΤΟ «ΠΙΣΩ» ΔΕΙΧΝΕΙ ΠΑΝΩ, ΟΧΙ ΠΙΣΩ ────────────────────────────────────
  //
  // Έδειχνε την ΠΡΟΗΓΟΥΜΕΝΗ καρτέλα που είχε επισκεφθεί ο χρήστης και αυτό
  // παρήγαγε πινγκ-πονγκ: από το Αρχείο ανοίγεις τα Έπιπλα, γυρνάς στο Αρχείο,
  // και το «πίσω» σου προτείνει ξανά τα Έπιπλα — δηλαδή εκεί που μόλις ήσουν και
  // έφυγες. Δύο καρτέλες που παραπέμπουν η μία στην άλλη κλειδώνουν τον χρήστη
  // σε κύκλο, χωρίς έξοδο προς τα πάνω.
  //
  // Το «πίσω» δεν είναι ιστορικό — αυτό το κάνει ήδη ο περιηγητής. Είναι ΕΞΟΔΟΣ
  // προς το επίπεδο από πάνω και το επίπεδο από πάνω είναι πάντα ένα: η
  // Επισκόπηση. Ένας κανόνας, καμία κατάσταση να συντηρηθεί, κανένας κύκλος.
  //
  // ΜΙΑ ΕΞΑΙΡΕΣΗ ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΙΣΤΟΡΙΚΟ: ΤΑ ΕΠΙΠΛΑ ΖΟΥΝ ΜΕΣΑ ΣΤΟΝ ΦΑΚΕΛΟ.
  // Ο κανόνας παραπάνω λέει «το πίσω δείχνει προς τα πάνω» και για τα Έπιπλα το
  // επίπεδο από πάνω ΔΕΝ είναι η Επισκόπηση: είναι ο Φάκελος ακινήτου, από όπου
  // και ανοίγουν. Πηγαίνοντας στην Επισκόπηση ο χρήστης έχανε δύο επίπεδα με μία
  // κίνηση και ξαναέμπαινε από την αρχή για να δει το επόμενο χαρτί.
  //
  // ΚΑΙ ΔΕΝ ΞΑΝΑΝΟΙΓΕΙ Ο ΚΥΚΛΟΣ ΠΟΥ ΕΚΛΕΙΣΕ. Ο κύκλος γεννιόταν από ΙΣΤΟΡΙΚΟ:
  // δύο καρτέλες που η καθεμία θυμόταν την άλλη. Εδώ η σχέση είναι σταθερή και
  // μονόδρομη — τα Έπιπλα δείχνουν στον Φάκελο, ο Φάκελος στην Επισκόπηση, η
  // Επισκόπηση πουθενά. Αλυσίδα, όχι βρόχος.
  const PARENT_TAB: Record<string, string> = { inventory: 'documents' };
  const backTab = PARENT_TAB[navSafe] ?? 'overview';
  const backLabel = navLabel(backTab);

  // ── ΑΛΛΑΓΗ ΑΚΙΝΗΤΟΥ ΧΩΡΙΣ ΝΑ ΧΑΝΕΤΑΙ Η ΘΕΣΗ ────────────────────────────────
  //
  // Κάθε αλλαγή ακινήτου έκανε `setNav('overview')`. Ο ιδιοκτήτης με τρία ακίνητα
  // που ήθελε να δει τις Δαπάνες και των τριών, έκανε έξι κλικ αντί για τρία:
  // ακίνητο → Επισκόπηση (αθέλητα) → Δαπάνες, ξανά και ξανά. Η μία κίνηση που
  // ζητούσε («δείξε μου το επόμενο») τον πήγαινε κάπου που δεν ζήτησε.
  //
  // Η επαναφορά ήταν και περιττή: το `navSafe` παραπάνω ήδη γυρίζει στην
  // Επισκόπηση όταν η καρτέλα δεν ισχύει για το επιλεγμένο ακίνητο (κενό ακίνητο
  // δεν έχει Απόδοση, μη μισθωμένο δεν έχει Ενοικιαστή). Δηλαδή ο μηδενισμός δεν
  // προστάτευε από τίποτα· απλώς πετούσε τη θέση του χρήστη σε κάθε περίπτωση,
  // ενώ ο έλεγχος έτρεχε ούτως ή άλλως.
  //
  // Τώρα: η καρτέλα κρατιέται όταν στέκει και πέφτει στην Επισκόπηση μόνο όταν
  // πραγματικά δεν αφορά το νέο ακίνητο.
  const switchProperty = (p: Property) => {
    setSelected(p);
    setSidebarOpen(false);
    setAnnounce(`Ενεργό ακίνητο: ${p.name}`);
  };

  // Εντολές command palette: μετάβαση σε tab, εναλλαγή ακινήτου, γρήγορες ενέργειες
  const cmdItems: CommandItem[] = [
    ...NAV_ITEMS.filter(item => isTabPurchasable(effProfileType, item.id) && navVisible(item.id)).map(item => ({
      id: `nav-${item.id}`, label: item.label, hint: 'Μετάβαση', group: 'Πλοήγηση',
      keywords: item.id, action: () => { if (selected) setNav(item.id); },
    })),
    ...properties.map(p => ({
      id: `prop-${p.id}`, label: p.name, hint: 'Ακίνητο', group: 'Ακίνητα',
      keywords: `${p.address||''} ${propertyTypeLabel(p.prop_type)}`,
      // Η καρτέλα ΔΕΝ μηδενίζεται στην αλλαγή ακινήτου — δες switchProperty.
      action: () => switchProperty(p),
    })),
    // Η ΝΟΑ ΕΛΕΙΠΕ ΑΠΟ ΤΗΝ ΠΑΛΕΤΑ ΕΝΤΟΛΩΝ. Ο μόνος δρόμος ήταν το πλωτό κουμπί,
    // δηλαδή το ποντίκι — και μπαίνει πρώτη, γιατί είναι ο συντομότερος δρόμος
    // προς οτιδήποτε άλλο στη λίστα.
    { id: 'act-ask', label: `Ρώτα τη ${ASSISTANT_NAME}`, hint: 'Ενέργεια', keywords: 'noa βοηθός assistant ρώτα σάρωσε',
      action: () => askAssistant() },
    { id: 'act-add', label: 'Προσθήκη ακινήτου', hint: 'Ενέργεια', keywords: 'new property add', action: () => tryAddProperty() },
    { id: 'act-signout', label: 'Αποσύνδεση', hint: 'Ενέργεια', keywords: 'logout sign out exit', action: () => signOut() },
  ];

  return (
    <div className="app-shell">
      {/* Η ζώνη που ανακοινώνει την αλλαγή ενεργού ακινήτου. Κενή στην πρώτη
          απόδοση: μια ήσυχη ζώνη με περιεχόμενο από την αρχή διαβάζεται μαζί με
          τη σελίδα και χάνει τον λόγο ύπαρξής της. */}
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>

      {/* Σκίαση πίσω από το συρόμενο μενού (μόνο κινητό/tablet).
          `aria-hidden`: είναι πέπλο, όχι χειριστήριο — δεν πρέπει να εστιάζεται
          ούτε να ανακοινώνεται. Ο δρόμος του πληκτρολογίου είναι το Escape, που
          μέχρι τώρα δεν υπήρχε καθόλου. */}
      <div aria-hidden className={`app-scrim ${sidebarOpen?'open':''}`} onClick={()=>setSidebarOpen(false)}/>
      <aside className={`app-sidebar ${sidebarOpen?'open':''}`}>
        {/* ΤΟ ΛΟΓΟΤΥΠΟ ΕΙΝΑΙ ΞΑΝΑ ΠΟΡΤΑ ΚΑΙ ΤΩΡΑ ΔΕΝ ΕΙΝΑΙ Η ΜΟΝΗ.
            Είχε γίνει απλό σήμα επειδή ως μοναδικός δρόμος προς την Επισκόπηση
            δεν μπορούσε να πει «είσαι ήδη εδώ»: πλοήγηση χωρίς κατάσταση. Το
            πρόβλημα το έλυσε η γραμμή «Επισκόπηση», που υπάρχει πλέον πρώτη στο
            μενού με aria-current. Το σήμα μπορεί λοιπόν να ξαναγίνει πόρτα χωρίς
            να ξαναφέρει το ελάττωμα: όποιος θέλει να ξέρει πού βρίσκεται το
            διαβάζει στη γραμμή και όποιος έμαθε από κάθε άλλη εφαρμογή ότι το
            λογότυπο γυρίζει στην αρχή, το πατά και γυρίζει.

            Το `aria-label` λέει τον προορισμό και όχι το όνομα του προϊόντος:
            ένας αναγνώστης οθόνης που ανακοινώνει «PROPERWISE, κουμπί» δεν
            πληροφορεί κανέναν για το τι θα συμβεί. */}
        <button type="button" className="sidebar-logo" aria-label={`Πήγαινε στην ${navLabel('overview')}`}
          onClick={()=>{ setNav('overview'); setSidebarOpen(false); }}>
          <BrandLogo size={22} />
        </button>

        {/* Κεντρικό κουμπί: μια φωτογραφία → αυτόματη καταχώρηση παντού.
            Το εικονίδιο ήταν 20 μέσα σε δικό του γυάλινο πλαίσιο 42×42, με άλλη
            ακτίνα και τρεις δικές του εσωτερικές σκιές — κουτί μέσα σε κουτί.
            Πλέον είναι 18, στη ΙΔΙΑ στήλη με κάθε άλλο εικονίδιο της μπάρας. */}
        <button
          onClick={()=>{ setQuickAddOpen(true); setSidebarOpen(false); }}
          className="quick-add-btn"
          disabled={!selected}
          title={selected ? 'Φωτογράφισε ή ανέβασε οποιοδήποτε έγγραφο: λογαριασμό, απόδειξη πληρωμής, μισθωτήριο, ασφαλιστήριο' : 'Πρόσθεσε πρώτα ένα ακίνητο'}>
          <span className="quick-add-icon" aria-hidden>
            <svg aria-hidden="true" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </span>
          <span className="quick-add-label">Σάρωσε έγγραφο</span>
        </button>

        {/* Η ΛΙΣΤΑ ΑΚΙΝΗΤΩΝ ΕΦΥΓΕ ΑΠΟ ΕΔΩ, ΣΤΗΝ ΠΑΝΩ ΜΠΑΡΑ.
            Απέδιδε ΚΑΘΕ ακίνητο ως γραμμή 46 εικονοστοιχείων. Με το πακέτο
            «Επαγγελματίας» (15 ακίνητα) αυτό είναι 908 εικονοστοιχεία ΠΑΝΩ από
            την πρώτη γραμμή πλοήγησης: σε οθόνη 900 ο χρήστης κυλούσε για να
            βρει τις «Δαπάνες», σε 768 δεν έβλεπε καμία καρτέλα χωρίς κύλιση.
            Δηλαδή όσο πιο πολλά πλήρωνε, τόσο χειρότερα δούλευε η εφαρμογή.
            Το ύψος του μενού δεν εξαρτάται πια από το πλήθος των ακινήτων.
            Βλ. components/PropertySwitcher.tsx. */}
        <div className="sidebar-nav" style={{flex:1}}>
          {NAV_GROUPS.map((group,gi) => {
            // Χωρίς διπλότυπα: τα εργαλεία (Απογραφή/Αρχείο/Εκκρεμότητες) είναι δωρεάν
            // και στα δύο προφίλ· εμφανίζονται όμως σε ΕΝΑ σημείο ανά προφίλ — στον
            // Ιδιώτη μέσα στην Επισκόπηση, στον Επαγγελματία στην πλαϊνή μπάρα.
            // Οι Επαφές δεν αναφέρονται εδώ γιατί ΔΕΝ είναι εργαλείο του μενού:
            // αποδίδονται ως ενότητα μέσα στο Αρχείο, όπου και ανήκουν.
            // ΤΡΙΑ ΦΙΛΤΡΑ, ΤΡΕΙΣ ΔΙΑΦΟΡΕΤΙΚΕΣ ΕΡΩΤΗΣΕΙΣ:
            //   1. Θα το φτάσει ποτέ με πλάνο του προφίλ του; (αλλιώς ούτε λουκέτο)
            //   2. Έχει ήδη νόημα να το δει τώρα; (σταδιακή αποκάλυψη, συν η ενεργή
            //      καρτέλα ώστε να μη «φεύγει» κάτω από τα πόδια του)
            //   3. Τον αφορά; (κατάσταση, πλήθος ακινήτων, νομική μορφή)
            // Το τρίτο κρατά και τον ΛΟΓΟ: με «δείξε τα όλα» η καρτέλα μένει αχνή και
            // ο λόγος γίνεται tooltip, αντί να εξαφανίζεται χωρίς εξήγηση.
            const items = group.ids
              .filter(id => isTabPurchasable(effProfileType, id)
                         && (id===nav || SELF_DISCLOSING.has(id) || isTabVisible(id, disclosure)))
              .map(id => ({ id, d: decide(id) }))
              .filter(x => x.d.visible || (showAllTabsPref && x.d.applies));
            if (items.length === 0) return null;
            return (
            <div className="sidebar-section" key={gi}>
              {items.map(({ id, d }) => { const locked=!isTabAllowed(ent, id); return (
                // Η μη-σχετική καρτέλα (ορατή μόνο με «δείξε τα όλα») είναι αχνή και
                // λέει γιατί. Χωρίς λουκέτο και χωρίς έμβλημα: δεν της ζητάμε τίποτα,
                // την αφήνουμε στη θέση της για όποιον θέλει να ξέρει ότι υπάρχει.
                //
                // ΤΟ ΕΜΒΛΗΜΑ ΕΦΥΓΕ ΑΠΟ ΕΔΩ. Ηταν κόκκινος μετρητής που δεν
                // εμφανίστηκε ΠΟΤΕ: η `getBadge` απαντούσε μόνο για `inventory` και
                // `checklist` και κανένα από τα δύο δεν είναι καρτέλα του μενού.
                // Κώδικας που παραβίαζε και τον κανόνα του κόκκινου, για μια
                // περίπτωση που δεν υπήρχε.
                // ΤΟ `data-nav` ΕΙΝΑΙ ΓΙΑ ΤΟΝ ΕΛΕΓΧΟ ΚΑΙ ΓΙ' ΑΥΤΟ ΔΕΝ ΕΙΝΑΙ ΠΕΡΙΤΤΟ.
                // Το σενάριο e2e ανοίγει ΚΑΘΕ καρτέλα και βεβαιώνεται ότι κατέβηκε
                // και αποδόθηκε. Χωρίς σταθερή λαβή θα έπρεπε να πατά ελληνικές
                // ετικέτες — που αλλάζουν με τον τύπο προφίλ («Πρόγραμμα
                // Συνεργατών» αντί για «Προσκλήσεις») και με κάθε διόρθωση
                // κειμένου, δηλαδή ο έλεγχος θα έσπαγε για λόγους άσχετους με
                // αυτό που ελέγχει.
                <button key={id} data-nav={id} className={`sidebar-item ${nav===id?'active':''}`} onClick={()=>{setNav(id);setSidebarOpen(false);}} disabled={!selected}
                  aria-current={nav===id ? 'page' : undefined}
                  style={d.visible ? undefined : { opacity: 0.45 }}
                  title={d.visible ? (locked ? 'Διαθέσιμο σε ανώτερο πακέτο' : undefined) : d.reason}>
                  <span className="sidebar-item-icon" aria-hidden>{ic(NAV_ICON[id]||'')}</span>
                  <span className="sidebar-item-label">{id==='referral' && effProfileType==='professional' ? 'Πρόγραμμα συνεργατών' : NAV_LABEL[id]}</span>
                  {d.visible && locked && <LockBadge/>}
                </button>
              );})}
            </div>
          );})}

          {/* ΟΙ ΚΡΥΜΜΕΝΕΣ ΚΑΡΤΕΛΕΣ ΔΕΝ ΕΙΝΑΙ ΜΥΣΤΙΚΟ ΚΑΙ Ο ΔΙΑΚΟΠΤΗΣ ΕΧΕΙ ΔΥΟ ΚΑΤΕΥΘΥΝΣΕΙΣ.
              Το κουμπί ήταν μονόδρομος: μόλις πατιόταν, το πλήθος των κρυμμένων
              γινόταν μηδέν και το ίδιο το κουμπί ΕΞΑΦΑΝΙΖΟΤΑΝ. Το μενού έμενε
              γεμάτο για πάντα, εκτός αν ο χρήστης μάντευε ότι η αναίρεση λέγεται
              «Απλοποιημένο μενού», βρίσκεται σε άλλη καρτέλα, μέσα σε πτυσσόμενη
              ενότητα. Τώρα η επιστροφή είναι στο ίδιο σημείο με τη μετάβαση. */}
          {(() => {
            // Μετρώνται μόνο όσες ΑΦΟΡΟΥΝ τον χρήστη: το «+3» δεν πρέπει να υπόσχεται
            // καρτέλες που, μόλις τις αποκαλύψει, θα του πουν ότι δεν τον αφορούν.
            const candidates = NAV_GROUPS.flatMap(g => g.ids)
              .filter(id => isTabPurchasable(effProfileType, id) && decide(id).visible
                         && id !== nav && !SELF_DISCLOSING.has(id));
            if (navShowAll) {
              // Χωρίς κρυμμένες, δεν υπάρχει τι να επαναφέρεις.
              if (hiddenTabCount(candidates, { ...disclosure, showAll: false }) === 0) return null;
              return (
                <button type="button" onClick={() => setNavShowAllPref(false)} className="sidebar-item" style={{ color: 'var(--text-tertiary)' }}
                  title="Κρύβει ξανά όσες καρτέλες δεν χρειάζεσαι αυτή τη στιγμή. Δεν χάνεται τίποτα: επανέρχονται με ένα κλικ.">
                  <span className="sidebar-item-icon" aria-hidden>{ic('M4 6h16|M4 12h10|M4 18h6')}</span>
                  <span className="sidebar-item-label">Λιγότερες καρτέλες</span>
                </button>
              );
            }
            const hidden = hiddenTabCount(candidates, disclosure);
            if (hidden === 0) return null;
            return (
              <button type="button" onClick={showAllTabs} className="sidebar-item" style={{ color: 'var(--text-tertiary)' }}
                title="Η εφαρμογή δείχνει πρώτα όσα χρειάζεσαι τώρα. Οι υπόλοιπες καρτέλες εμφανίζονται μόλις αποκτήσουν νόημα, ή τώρα με ένα κλικ.">
                <span className="sidebar-item-icon" aria-hidden>{ic('M4 6h16|M4 12h16|M4 18h16')}</span>
                <span className="sidebar-item-label">Όλες οι καρτέλες</span>
                <span style={{ marginLeft: 'auto', fontFamily: T.font.sans, fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>+{hidden}</span>
              </button>
            );
          })()}
        </div>
        {/* ΤΟ ΥΠΟΣΕΛΙΔΟ ΗΤΑΝ ΝΑΡΚΗ. Ολόκληρη η γραμμή του χρήστη ήταν ΕΝΑ κουμπί
            αποσύνδεσης και η μόνη ένδειξη ήταν η λέξη «Αποσύνδεση» γραμμένη
            ως υπότιτλος — δηλαδή ακριβώς εκεί όπου κάθε εφαρμογή γράφει το
            email σου. Οποιος πατούσε νομίζοντας «ο λογαριασμός μου» έβγαινε
            έξω. Η γραμμή πάει τώρα στον Λογαριασμό· η αποσύνδεση έχει δικό της
            κουμπί, με δικό της όνομα και δικό της στόχο αφής. */}
        <div className="sidebar-footer">
          <button className="user-row" onClick={()=>{setNav('settings');setSidebarOpen(false);}} title="Λογαριασμός και ρυθμίσεις">
            <span className="user-avatar" aria-hidden>{userInitials}</span>
            <span className="user-name po-elide">{userLabel}</span>
          </button>
          <button className="sign-out-btn" onClick={signOut} aria-label="Αποσύνδεση" title="Αποσύνδεση">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
          </button>
        </div>
      </aside>

      <main className="app-main">
        <header className="app-topbar">
          {/* ΤΟ ΣΗΜΑ ΑΚΟΛΟΥΘΕΙ ΤΗΝ ΠΟΡΤΑ. Οι εκκρεμότητες Απογραφής και Λίστας
              ζουν σε καρτέλες που ανοίγουν ΜΟΝΟ από την πλαϊνή μπάρα· όσο
              υπήρχαν δύο πόρτες, το σήμα ήταν στην κάτω. Τώρα είναι εδώ. */}
          {/* ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΟΧΙ ΔΥΟ. Οταν η ανάγνωση της Απογραφής αποτύχει, το
              κουμπί έλεγε «Μενού» σκέτο: ίδια οθόνη με το «όλα καθαρά», ενώ
              μπορεί να τρέχει ληγμένη συντήρηση. Η κουκκίδα μένει ώστε να μη
              χαθεί η προειδοποίηση, ο αριθμός όμως δεν λέγεται και το μήνυμα
              λέει τι δεν έγινε και τι να κάνει ο χρήστης. */}
          <button className="nav-toggle" onClick={()=>setSidebarOpen(v=>!v)}
            aria-label={pendingUnknown
              ? 'Μενού, οι εκκρεμότητες δεν ελέγχθηκαν: ανανέωσε τη σελίδα'
              : pendingCount > 0
                ? `Μενού, ${pendingCount} ${pendingCount === 1 ? 'εκκρεμότητα' : 'εκκρεμότητες'}`
                : 'Μενού'}
            title={pendingUnknown ? 'Οι εκκρεμότητες δεν ελέγχθηκαν. Ανανέωσε τη σελίδα.' : undefined}
            style={{ position: 'relative' }}>
            {(pendingCount > 0 || pendingUnknown) && <span className="bottom-nav-badge"/>}
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
          </button>
          {selected ? (
            <>
              <div className="topbar-main">
                {/* ΤΟ ΚΟΥΜΠΙ ΚΑΤΑΣΤΑΣΗΣ ΕΠΕΦΤΕ ΠΑΝΩ ΣΤΟΝ ΦΑΚΟ ΣΕ ΚΙΝΗΤΟ.
                    Η γραμμή δεν τύλιγε και κανένα από τα δύο παιδιά της δεν
                    μπορούσε να συρρικνωθεί: ο επιλογέας ακινήτου φτάνει τα
                    46vw και το κουμπί κατάστασης γράφει ολόκληρο το
                    «Βραχυχρόνια μίσθωση». Στα 390 εικονοστοιχεία, με το μενού
                    αριστερά και τον φακό δεξιά, το άθροισμα ξεπερνά το πλάτος
                    και το πλεόνασμα ΔΕΝ κόβεται: ξεχειλίζει από πάνω του.

                    Το τύλιγμα δίνει στην κατάσταση δική της γραμμή αντί να της
                    κόψει το κείμενο. Η κατάσταση ορίζει ΠΟΙΕΣ καρτέλες
                    εμφανίζονται, οπότε ένα «Βραχυχρόνια μίσ…» θα ήταν χειρότερο
                    από μια γραμμή παραπάνω. Σε πλάτος που χωρά, τίποτα δεν
                    αλλάζει: το wrap ενεργοποιείται μόνο όταν δεν χωρά. */}
                <div className="topbar-row">
                  {/* Ο ΤΙΤΛΟΣ ΗΤΑΝ ΝΕΚΡΟ <span>. Δίπλα του καθόταν ήδη ένα κουμπί
                      που ανοίγει μενού και 250 εικονοστοιχεία αριστερότερα η
                      πλαϊνή μπάρα ξανάλεγε το ίδιο όνομα με άλλη τελεία και άλλο
                      μέγεθος. Δύο σπίτια για ένα αντικείμενο· τώρα ένα και
                      κάνει και τη δουλειά. Δύο κουμπιά, δύο ερωτήσεις που δεν
                      μπερδεύονται: «ποιο ακίνητο» και «σε τι κατάσταση είναι». */}
                  <PropertySwitcher
                    items={properties.map(p => ({ id: p.id, name: p.name, status: statusLabelOf(p), address: p.address }))}
                    activeId={selected.id}
                    onSelect={(id)=>{ const p = properties.find(x=>x.id===id); if (p) switchProperty(p); }}
                    onAdd={()=>tryAddProperty()}
                    canAdd={canAddProperty(ent, properties.length)} />
                  {/* Ένα κουμπί: κατάσταση ακινήτου + εργαλεία (επεξεργασία, διαγραφή) στο ίδιο μενού. */}
                  {/* ΜΕΝΕΙ ΧΕΙΡΟΠΟΙΗΤΟ. Δεν είναι πλακίδιο επιλογής αλλά άνοιγμα μενού:
                      θέλει `aria-haspopup` και `aria-expanded` που το ChipToggle δεν
                      δέχεται — και την κλάση `topbar-status`, που κάνει το ψαλίδισμα
                      της ετικέτας σε στενή οθόνη. */}
                  <div className="topbar-status-wrap" style={{position:'relative',minWidth:0}}>
                    <button onClick={()=>setStatusDropdown(v=>!v)} className="topbar-status" title="Κατάσταση ακινήτου και εργαλεία (επεξεργασία, διαγραφή)" aria-haspopup="menu" aria-expanded={statusDropdown} style={{display:'flex',alignItems:'center',gap: 8,minHeight:T.h.sm,padding:'0 10px 0 12px',borderRadius: T.radius.chip,border:'1px solid var(--border-default)',background:statusDropdown?'var(--bg-hover)':'transparent',cursor:'pointer',fontFamily: T.font.sans,fontSize:12,fontWeight:500,color:'var(--text-primary)',transition:'background 0.15s'}} onMouseEnter={e=>{if(!statusDropdown)e.currentTarget.style.background='var(--bg-hover)'}} onMouseLeave={e=>{if(!statusDropdown)e.currentTarget.style.background='transparent'}}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:statusColor,flexShrink:0}}/>
                      {/* ΤΟ ΨΑΛΙΔΙ ΘΕΛΕΙ ΣΤΟΙΧΕΙΟ ΓΙΑ ΝΑ ΠΙΑΣΕΙ. Η ετικέτα ήταν
                          γυμνό κείμενο ανάμεσα σε δύο στοιχεία, οπότε το
                          `text-overflow: ellipsis` δεν είχε πάνω σε τι να
                          εφαρμοστεί: το chip δεν μίκραινε, ξεχείλιζε — και σε
                          Galaxy A ζωγραφιζόταν ΠΑΝΩ στο κουμπί αναζήτησης. */}
                      <span className="topbar-status-label">{statusLabel}</span>
                      <svg aria-hidden="true" width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.65,marginLeft:1,flexShrink:0,transform:statusDropdown?'rotate(180deg)':'none',transition:'transform 0.15s'}}><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                    {statusDropdown && (
                      <>
                      {/* Κλείσιμο με κλικ οπουδήποτε αλλού. Πέπλο, όχι κουμπί:
                          `aria-hidden` ώστε να μη μπει στη σειρά του Tab. Με
                          πληκτρολόγιο κλείνει με Escape. */}
                      <div aria-hidden onClick={()=>setStatusDropdown(false)} style={{position:'fixed',inset:0,zIndex:99}}/>
                      <div role="menu" style={{position:'absolute',top:'calc(100% + 8px)',left:0,maxHeight:'min(440px, calc(100vh - 96px))',overflowY:'auto',overscrollBehavior:'contain',background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius:10,padding:'6px 0',zIndex:100,minWidth:224,boxShadow:'var(--shadow-lg)'}}>
                        <div style={{fontFamily: T.font.sans,fontSize: 'var(--fs-xs)',fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--text-tertiary)',padding:'6px 16px 4px'}}>Κατάσταση</div>
                        {STATUSES.map(({ key: k, label: v, hint }) => {
                          const active = readStatus(selected)===k;
                          return (
                            <button className="po-hov-fill" key={k} role="menuitem" onClick={()=>updateStatus(k)} style={{display:'flex',alignItems:'flex-start',gap:12,width:'100%',padding:'10px 16px',border:'none',cursor:'pointer',fontFamily: T.font.sans,fontSize:14,fontWeight:active?600:400,color:'var(--text-primary)',textAlign:'left'}} >
                              <div style={{width:8,height:8,borderRadius:'50%',background:STATUS_COLORS[k],flexShrink:0,marginTop:4}}/>
                              {/* Η εξήγηση δεν είναι διακόσμηση: «Βραχυχρόνια»
                                  και «Μακροχρόνια» καθορίζουν ΠΟΙΑ εργαλεία
                                  εμφανίζονται, οπότε η επιλογή πρέπει να είναι
                                  συνειδητή και όχι μαντεψιά. */}
                              <span style={{flex:1,minWidth:0}}>
                                <span style={{display:'block'}}>{v}</span>
                                <span className="po-subline" style={{display:'block',fontSize:12,color:'var(--text-tertiary)',fontWeight:400,lineHeight:1.4}}>{hint}</span>
                              </span>
                              {active && <svg aria-hidden="true" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
                            </button>
                          );
                        })}
                        <div style={{height:1,background:'var(--border-subtle)',margin:'6px 12px'}}/>
                        <div style={{fontFamily: T.font.sans,fontSize: 'var(--fs-xs)',fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--text-tertiary)',padding:'6px 16px 4px'}}>Εργαλεία ακινήτου</div>
                        <button className="po-hov-fill" role="menuitem" onClick={()=>{setStatusDropdown(false);setEditProperty(selected);}} style={{display:'flex',alignItems:'center',gap:12,width:'100%',padding:'9px 16px',border:'none',cursor:'pointer',fontFamily: T.font.sans,fontSize:14,color:'var(--text-primary)',textAlign:'left'}} >
                          <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                          Επεξεργασία στοιχείων
                        </button>
                        <button className="po-hov-fill" role="menuitem" onClick={deleteProperty} style={{ '--hov-fill': 'var(--negative-dim)',display:'flex',alignItems:'center',gap:12,width:'100%',padding:'9px 16px',border:'none',cursor:'pointer',fontFamily: T.font.sans,fontSize:14,color:'var(--negative)',textAlign:'left'}} >
                          <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/></svg>
                          Διαγραφή ακινήτου
                        </button>
                      </div>
                      </>
                    )}
                  </div>
                </div>
                {/* ═══ Η ΤΑΥΤΟΤΗΤΑ ΤΟΥ ΑΚΙΝΗΤΟΥ ΕΦΥΓΕ ΑΠΟ ΤΗ ΜΟΝΙΜΗ ΜΠΑΡΑ ═══════
                    Η δεύτερη σειρά έγραφε «Κατοικία · 42 τ.μ. · Δράκου 12,
                    Αθήνα» πάνω από ΚΑΘΕ οθόνη της εφαρμογής, από τις Δαπάνες
                    ως το Ημερολόγιο. Τίποτα από τα τρία δεν αλλάζει ποτέ και
                    τίποτα δεν χρειάζεται για να διαβαστεί η οθόνη από κάτω:
                    είναι στοιχεία που ο ιδιοκτήτης ξέρει απέξω για το δικό του
                    σπίτι. Πλήρωναν όμως μόνιμα μια σειρά στην πιο ακριβή θέση
                    της διεπαφής και έσπρωχναν το όνομα εκτός κέντρου, ώστε να
                    μη ζυγίζει με το λογότυπο αριστερά και τον φακό δεξιά.

                    ΔΕΝ ΧΑΝΕΤΑΙ ΤΙΠΟΤΑ. Ο τύπος, το εμβαδόν, η διεύθυνση και ο
                    ταχυδρομικός κώδικας ζουν στα στοιχεία του ακινήτου, όπου
                    και συμπληρώνονται. Στη μπάρα μένει ό,τι ΞΕΧΩΡΙΖΕΙ το ένα
                    ακίνητο από το άλλο και ό,τι ΑΛΛΑΖΕΙ: το όνομα και η
                    κατάσταση μίσθωσης, που ορίζει ποιες καρτέλες βλέπεις. */}
              </div>
              {/* Η «Αντιγραφή απογραφής» έφυγε από ΕΔΩ. Ήταν κουμπί στην καθολική
                  μπάρα του ακινήτου — chrome που ανήκει σε ΟΛΗ την εφαρμογή —
                  και εμφανιζόταν για μία μόνο καρτέλα. Ζει τώρα στο μενού της
                  ίδιας της απογραφής, μαζί με τις άλλες της ενέργειες. */}
              {/* ΤΟ ΜΕΤΑΛΛΙΟ ΙΔΙΟΤΗΤΑΣ ΕΦΥΓΕ ΑΠΟ ΕΔΩ ΚΑΙ ΑΠΟ ΠΑΝΤΟΥ.
                  Ηταν ένα χτυπημένο «νόμισμα» με ανάγλυφη στεφάνη, ακτινική
                  διαβάθμιση και σπιτάκι μέσα, στην πιο ακριβή θέση της
                  εφαρμογής. Δεν έλεγε τίποτα που ο χρήστης να μη ξέρει: ότι
                  είναι ιδιώτης. Δεν πατιόταν, δεν άλλαζε, δεν προειδοποιούσε.
                  Και το σκεύωμα του μεταλλίου —γυαλάδες, στεφάνες, σκιές— ήταν
                  ξένο σώμα σε μια επίπεδη, ήσυχη διεπαφή. */}
              {/* ΜΕΝΕΙ ΧΕΙΡΟΠΟΙΗΤΟ. Το `IconBtn` δεν δέχεται className και εδώ η
                  `topbar-search` είναι που το κάνει 44 κεντραρισμένο στο κινητό·
                  σε υπολογιστή δείχνει και το πλακίδιο του ⌘K, άρα δεν είναι
                  ούτε καθαρό εικονοκούμπι. */}
              <button onClick={()=>setCmdkOpen(true)} className="topbar-search po-hov-fill" title={`Αναζήτηση και γρήγορες ενέργειες (${kbdHint})`} aria-label="Αναζήτηση" style={{display:'flex',alignItems:'center',gap:8,height:T.h.md,padding:'0 10px 0 12px',borderRadius: T.radius.modal,border:'1px solid var(--border-default)',color:'var(--text-secondary)',cursor:'pointer',flexShrink:0}} >
                <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
                <span className="desktop-only" style={{fontSize: 'var(--fs-xs)',fontFamily: T.font.mono,color:'var(--text-tertiary)',border:'1px solid var(--border-subtle)',borderRadius: T.radius.xs,padding:'1px 5px'}}>{kbdHint}</span>
              </button>
            </>
          ) : (
            <><div style={{flex:1,fontFamily: T.font.sans,fontSize:14,color:'var(--text-secondary)'}}>Κανένα ακίνητο ακόμη</div></>
          )}
        </header>

        {!selected && loadError ? (
          <div className="app-content" style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{maxWidth:460,width:'100%',textAlign:'center'}}>
              <h1 style={{fontFamily: T.font.sans,fontSize:22,fontWeight:700,color:'var(--text-primary)',margin:'0 0 10px'}}>Τα ακίνητά σου δεν φορτώθηκαν</h1>
              <p style={{fontFamily: T.font.sans,fontSize:14,color:'var(--text-secondary)',lineHeight:1.6,margin:'0 auto 20px',maxWidth:400}}>
                Τα δεδομένα σου είναι ασφαλή. Συνήθως φταίει η σύνδεση.
              </p>
              <Btn variant="primary" onClick={()=>{ if(user) fetchProperties(user.id); }}>Δοκίμασε ξανά</Btn>
            </div>
          </div>
        ) : !selected ? (
          <div className="app-content" style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{maxWidth:640,width:'100%',textAlign:'center'}}>
              {/* Η ΠΡΩΤΗ ΟΘΟΝΗ ΛΕΕΙ ΤΙ ΓΙΝΕΤΑΙ ΜΕΤΑ, ΜΕ ΤΗ ΣΕΙΡΑ ΠΟΥ ΓΙΝΕΤΑΙ. Ηταν ένα
                  γενικό σπιτάκι, «ξεκλείδωσε… όλα σε ένα σημείο» και τρεις κάρτες
                  δυνατοτήτων με αριθμό παρόχων χωρίς πηγή. Τώρα είναι το σήμα και τα
                  τρία βήματα του πρώτου λεπτού: τα βασικά του ακινήτου (μόνο το όνομα
                  είναι υποχρεωτικό, όπως στον οδηγό), ένας λογαριασμός με φωτογραφία,
                  ο ΕΝΦΙΑ και το φύλλο «Τι λείπει». Η αρίθμηση είναι αληθινή σειρά. */}
              <div style={{width:80,height:80,borderRadius: T.radius.modal,background:'var(--accent-dim)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 22px',color:'var(--accent)'}}>
                <BrandMark size={52} />
              </div>
              <h1 style={{fontFamily: T.font.sans,fontSize:28,fontWeight:700,letterSpacing:'-0.025em',color:'var(--text-primary)',margin:'0 0 10px',textWrap:'balance'}}>Ξεκίνα από ένα ακίνητο</h1>
              <p style={{fontFamily: T.font.sans,fontSize: 'var(--fs-base)',color:'var(--text-secondary)',lineHeight:1.6,margin:'0 auto 28px',maxWidth:600,textWrap:'balance'}}>Φτάνουν ο τύπος, η κατάσταση και ένα όνομα, π.χ. «Διαμέρισμα στο κέντρο». Τα υπόλοιπα τα συμπληρώνεις όποτε θέλεις.</p>
              <ol style={{listStyle:'none',padding:0,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,170px),1fr))',gap:12,margin:'0 0 30px',textAlign:'left'}}>
                {[
                  {t:'Τα βασικά',d:'Όνομα, διεύθυνση και τετραγωνικά.'},
                  {t:'Ένας λογαριασμός',d:'Τον φωτογραφίζεις, ελέγχεις τα ποσά και καταχωρείται στο ακίνητο.'},
                  {t:'Ο ΕΝΦΙΑ σου',d:'Ενδεικτικά, μαζί με ό,τι λείπει για τον λογιστή.'},
                ].map((f,i)=>(
                  <li key={i} style={{background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius: T.radius.popup,padding:'16px 16px 18px'}}>
                    <div style={{fontFamily: T.font.mono,fontSize: 'var(--fs-xs)',fontWeight:600,color:'var(--accent)',marginBottom:10}}>{i+1}</div>
                    <div style={{fontFamily: T.font.sans,fontSize: 'var(--fs-base)',fontWeight:700,color:'var(--text-primary)',marginBottom:4}}>{f.t}</div>
                    <div style={{fontFamily: T.font.sans,fontSize: 'var(--fs-xs)',color:'var(--text-tertiary)',lineHeight:1.5}}>{f.d}</div>
                  </li>
                ))}
              </ol>
              {/* Η ΜΟΝΑΔΙΚΗ ΧΡΗΣΗ ΤΟΥ ΠΑΛΙΟΥ `.btn`. Είχε δικό της ύψος, ακτίνα και
                  μέγεθος γραμματοσειράς, δηλαδή έμοιαζε με κουμπί άλλης
                  εφαρμογής δίπλα σε κάθε άλλο κουμπί της ίδιας οθόνης. */}
              <Btn variant="primary" onClick={() => tryAddProperty()}>Πρόσθεσε το ακίνητό σου</Btn>
            </div>
          </div>
        ) : (
          <>
            {/* ΚΑΘΕ ΚΑΡΤΕΛΑ ΣΕ ΔΙΚΟ ΤΗΣ ΔΙΧΤΥ.
                Είκοσι δύο καρτέλες ζουν σε ΕΝΑ δέντρο React. Χωρίς αυτό, ένα
                σφάλμα σε οποιαδήποτε ανέβαινε ως το boundary ΟΛΗΣ της διαδρομής
                και η εφαρμογή δεν άνοιγε καθόλου: ο ιδιοκτήτης έχανε ενοίκια,
                ημερολόγιο και έγγραφα επειδή κάπου αλλού κάτι βρήκε ένα null.
                Το `key` ξαναστήνει το δίχτυ σε κάθε αλλαγή καρτέλας, ώστε ένα
                σφάλμα σε μία να μην κρατά κλειδωμένες τις υπόλοιπες. */}
            <TabBoundary name={nav} key={nav}>
            <div className="app-content">
              {/* Πέρα πέρα, με ενωτικό, σε κάθε παράγραφο της καρτέλας (26.09.2026). */}
              <Typesetter />
              <CookieConsent inline />
              {/* Ο κανόνας ήταν ήδη γραμμένη αρχή — «η έξοδος είναι πάντα ένα
                  επίπεδο πάνω, δηλαδή η Επισκόπηση» — αλλά εφαρμοζόταν σε πέντε
                  καρτέλες από τις είκοσι δύο, γραμμένες με το χέρι. Δηλαδή στην
                  Αξιοποίηση, στη Λογιστική, στο Δάνειο, στις Δαπάνες, στην
                  Πρόσκληση και στον Λογαριασμό ο μόνος δρόμος πίσω ήταν η πλαϊνή
                  μπάρα — που σε κινητό είναι κλειστή.
                  Τώρα το ερώτημα δεν είναι «ποια καρτέλα το δείχνει» αλλά
                  «υπάρχει επίπεδο από πάνω;». Δεν υπάρχει σε δύο: στην ίδια την
                  Επισκόπηση και στο Χαρτοφυλάκιο που στέκει πάνω από αυτήν. */}
              {navSafe !== 'overview' && navSafe !== 'portfolio' && (
                // ΜΕΝΕΙ ΧΕΙΡΟΠΟΙΗΤΟ. Το γέμισμα «4px 4px 4px 0» ακουμπά το βελάκι
                // στο αριστερό όριο του κειμένου της σελίδας· το `Btn` γράφει
                // «9px 18px» και θα το έσπρωχνε δεκαοκτώ μέσα, δηλαδή το «Πίσω»
                // θα έπαυε να στοιχίζεται με τον τίτλο από κάτω του.
                <button onClick={()=>setNav(backTab)} title={`Πίσω: ${backLabel}`} aria-label={`Πίσω: ${backLabel}`}
                  style={{display:'inline-flex',alignItems:'center',gap:6,marginBottom:14,padding:'4px 4px 4px 0',border:'none',background:'transparent',color:'var(--text-tertiary)',fontFamily: T.font.sans,fontSize: 'var(--fs-base)',fontWeight:600,cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.color='var(--text-primary)'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-tertiary)'}>
                  <svg aria-hidden="true" width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                  {backLabel}
                </button>
              )}
              {/* ΤΟ ΚΛΕΙΔΩΜΑ ΑΚΟΛΟΥΘΕΙ ΤΟΝ ΠΙΝΑΚΑ ΤΟΥ /paketa. Επαγγελματίας: η
                  συγκεντρωτική εικόνα. Ιδιοκτήτης+: η σύγκριση ακινήτων, που ο
                  πίνακας του δίνει, όποια κι αν είναι η κατάσταση του επιλεγμένου.
                  Κάτω από αυτό: λουκέτο στη σύγκριση, με το πακέτο που την ανοίγει. */}
              {navSafe==='portfolio' && (hasFeature(ent,'portfolio')
                ? <PortfolioTab properties={properties} userId={user.id} onSelectProperty={(id)=>{ const p=properties.find(x=>x.id===id); if(p){ setSelected(p); setNav('overview'); } }}/>
                : isTabAllowed(ent,'comparison')
                  ? <div>
                      <SecHdr label="Σύγκριση ακινήτων"/>
                      {canCompare(properties)
                        ? <TabComparison properties={properties} userId={user.id} onNavigate={(t)=>setNav(t)} profileType={effProfileType}/>
                        : <p style={{fontSize:'var(--fs-sm)',color:'var(--text-secondary)',fontFamily:T.font.sans,lineHeight:1.55}}>Δεν υπάρχουν δύο ακίνητα ίδιου τύπου για σύγκριση. Η σύγκριση βάζει δίπλα δίπλα ακίνητα της ίδιας αγοράς.</p>}
                      {/* Η ΠΡΟΣΚΛΗΣΗ ΜΟΝΟ ΣΕ ΟΠΟΙΟΝ ΜΠΟΡΕΙ ΝΑ ΤΗ ΔΕΧΤΕΙ. Ο ιδιώτης
                          δεν αγοράζει το πακέτο της συγκεντρωτικής εικόνας με
                          κανένα πλάνο του προφίλ του· γι' αυτόν η γραμμή ήταν
                          υπόσχεση χωρίς δρόμο. */}
                      {planAtLeast(paidPlanForProfile(effProfileType), requiredPlanForFeature('portfolio')) && (
                        <p style={{marginTop:T.sp.section,fontSize:'var(--fs-xs)',color:'var(--text-tertiary)',fontFamily:T.font.sans,lineHeight:1.55}}>{`Η συγκεντρωτική εικόνα, με έσοδα και εκκρεμότητες όλων των ακινήτων σε μία λίστα, είναι στο πακέτο ${PLANS[requiredPlanForFeature('portfolio')].name}.`}</p>
                      )}
                    </div>
                  : <FeatureLock title="Σύγκρινε τα ακίνητά σου δίπλα-δίπλα" benefit={`Απόδοση, δαπάνες και πάροχοι όλων των ακινήτων σου σε έναν πίνακα. Ξεκλειδώνει με το πακέτο ${PLANS.owner.name}.`} requiredPlan="owner" currentPlanName={PLANS[effPlan].name} onManage={()=>setNav('settings')} />)}
              {/* ═══ Ο ΠΙΝΑΚΑΣ ΤΗΣ ΔΟΚΙΜΗΣ, ΠΑΝΩ ΑΠΟ ΤΑ ΠΑΝΤΑ ═══════════════
                  Ζει ΕΔΩ και όχι μέσα στην Επισκόπηση για δύο λόγους: είναι
                  πλαίσιο του λογαριασμού, όχι του ακινήτου (τα βήματά του
                  μετρούν ό,τι έχει ο ΧΡΗΣΤΗΣ) και η Επισκόπηση θα κουβαλούσε
                  έξι ακόμη props για κάτι που δεν την αφορά. */}
              {navSafe==='overview' && (
                <StartPanel state={startState} collapsed={startCollapsed} onToggle={toggleStartPanel}
                  onNavigate={(t)=> t==='scan' ? setQuickAddOpen(true) : setNav(t)}
                  onPreview={()=>setShowPreview(true)} onAsk={()=>askAssistant('', false)} />
              )}
              {/* ═══ ΤΟ `key` ΕΙΝΑΙ Ο ΔΙΑΚΟΠΤΗΣ ΤΗΣ ΚΟΥΡΣΑΣ ═══════════════════════
                  ΤΟ ΣΦΑΛΜΑ: αλλάζεις ακίνητο ενώ φορτώνει το προηγούμενο. Η
                  `load` δεν έχει ακύρωση και το component ΔΕΝ ξαναστηνόταν —
                  άρα οι δεκατρείς παράλληλες ερωτήσεις του παλιού ακινήτου
                  γύριζαν αργότερα και έγραφαν πάνω στις καινούργιες. Ο χρήστης
                  έβλεπε το όνομα, τη διεύθυνση και την κατάσταση του ακινήτου Β
                  με τις δαπάνες, τους λογαριασμούς, τον μισθωτή και τον
                  ΕΚΤΙΜΩΜΕΝΟ ΦΟΡΟ του ακινήτου Α. Χωρίς σφάλμα, χωρίς σπίνερ
                  και απολύτως πειστικά.

                  Με `key`, η αλλαγή ακινήτου δεν είναι ενημέρωση· είναι νέος
                  πίνακας. Ό,τι επιστρέψει από την προηγούμενη φόρτωση γράφει σε
                  component που δεν υπάρχει πια και η React το αγνοεί. Το ίδιο
                  ισχύει για κάθε καρτέλα που φορτώνει δικά της δεδομένα. */}
              {navSafe==='overview'  && <OverviewTab key={selected.id} prop={selected} properties={properties} userId={user.id} onNavigate={(t)=> t==='scan' ? setQuickAddOpen(true) : t==='edit' ? setEditProperty(selected) : setNav(t)} tabVisible={navVisible} profileType={effProfileType} legalForm={taxForm}/>}
              {nav==='finances'  && <TabFinances key={selected.id} propertyId={selected.id} userId={user.id} propertyName={selected.name} properties={financeProperties} profileType={effProfileType} legalForm={taxForm} onScan={()=>setQuickAddOpen(true)} openAddNonce={manualExpense} handledAddNonce={handledExpense} onAddHandled={setHandledExpense} />}
              {nav==='calendar'  && <TabCalendar key={selected.id} propertyId={selected.id} userId={user.id} openTasks={checklistAlerts} onOpenTasks={()=>setNav('checklist')}/>}
              {/* ═══ Η ΒΡΑΧΥΧΡΟΝΙΑ ΣΤΕΚΕΤΑΙ ΜΟΝΗ ΤΗΣ ═══════════════════════════
                  Ζούσε μέσα στην καρτέλα «Πελάτης», που απαιτεί πακέτο
                  Επαγγελματία. Ο ιδιώτης με ακίνητο σε Airbnb δεν έφτανε ΠΟΤΕ
                  στη δυναμική τιμή ούτε στο «τι μου μένει» — τα δύο εργαλεία που
                  τον αφορούν περισσότερο από κάθε άλλο. Το πελατολόγιο μένει
                  επαγγελματικό εργαλείο· η βραχυχρόνια μίσθωση δεν είναι. */}
              {navSafe==='pricing'   && (<>
                <AmaStrip userId={user.id} propertyId={selected.id}/>
                <TabPricing key={selected.id} propertyId={selected.id} userId={user.id} propertyName={selected.name} propertyRent={(selected.target_rent??undefined)} propertySqm={selected.sqm??undefined} profileType={effProfileType} legalForm={taxForm} onNavigate={(t)=>setNav(t)}/>
              </>)}
              {/* Η ΚΕΦΑΛΙΔΑ ΤΗΣ ΑΞΙΟΠΟΙΗΣΗΣ ΕΦΥΓΕ ΑΠΟ ΕΔΩ. Γραφόταν δύο φορές:
                  εδώ ως «ΑΞΙΟΠΟΙΗΣΗ ΑΚΙΝΗΤΟΥ / Κενό· πώς θα μισθωθεί…» και
                  αμέσως μετά μέσα στην καρτέλα ως «ΚΕΝΟ · Όνομα» πάνω από τον
                  δικό της τίτλο. Η κατάσταση εμφανιζόταν δύο φορές σε εξήντα
                  εικονοστοιχεία και ο υπότιτλος του PLAN_SUB έλεγε ό,τι λέει
                  ήδη ο τίτλος της καρτέλας με καλύτερα λόγια. Η επικεφαλίδα ζει
                  μέσα στο component, όπως σε κάθε άλλη καρτέλα. */}
              {navSafe==='plan'      && <TabPlan key={selected.id} propertyId={selected.id} userId={user.id} status={readStatus(selected)} property={selected}/>}
              {navSafe==='tenant'    && <TabTenant key={selected.id} propertyId={selected.id} userId={user.id} plan={effPlan} onStartHandover={(tenantName,tenantPhone,type)=>{ setHandoverIntent({tenantName,tenantPhone,type}); setNav('inventory'); }}/>}
              {/* ═══ ΑΠΟΔΟΣΗ — ΜΙΑ ΚΑΡΤΕΛΑ ΓΙΑ ΜΙΑ ΕΡΩΤΗΣΗ ═══════════════════════
                  Τρεις καρτέλες απαντούσαν στο ίδιο πράγμα από τρεις μεριές:
                  «Αποδόσεις» (πόσο αποδίδει ΑΥΤΟ), «Σύγκριση» (πόσο αποδίδει σε
                  σχέση με τα άλλα), «Σχέδιο» (τι να το κάνω). Ο ιδιοκτήτης δεν
                  σκέφτεται σε τρεις καρτέλες — σκέφτεται «αξίζει;».
                  Τώρα μία, με ενότητες που εμφανίζονται ΜΟΝΟ όταν έχουν νόημα:
                  το Σχέδιο μόνο σε κενό/προς πώληση/ανακαίνιση/νομική εκκρεμότητα,
                  η Σύγκριση μόνο με δεύτερο ακίνητο. Καμία υποκαρτέλα. */}
              {navSafe==='roi' && (
                <>
                  <TabRentROI key={selected.id} propertyId={selected.id} userId={user.id} propertyValue={selected.value??undefined} profileType={effProfileType} legalForm={taxForm} plan={effPlan}/>
                  {/* ═══ ΤΟ «ΣΧΕΔΙΟ» ΗΤΑΝ ΕΔΩ ΚΑΙ ΔΕΝ ΤΟ ΕΒΛΕΠΕ ΚΑΝΕΙΣ ═══════════
                      Αποδιδόταν μέσα στην Απόδοση, με συνθήκη τις τέσσερις
                      καταστάσεις κενό / προς πώληση / ανακαίνιση / αμφισβητούμενο.
                      Μόνο που η Απόδοση φαίνεται ΑΚΡΙΒΩΣ στις δύο άλλες
                      καταστάσεις — μακροχρόνια και βραχυχρόνια — γιατί χωρίς
                      έσοδο δεν υπάρχει απόδοση να μετρηθεί. Οι δύο συνθήκες ήταν
                      αλληλοαποκλειόμενες: το Σχέδιο δεν εμφανίστηκε ποτέ σε
                      κανέναν χρήστη. Τετρακόσιες εβδομήντα οκτώ γραμμές
                      συμβουλευτικής, γραμμένες και απρόσιτες.

                      Τώρα στέκει μόνο του στο μενού, ακριβώς εκεί που λείπει. */}
                  {/* ΔΥΟ ΚΑΝΟΝΕΣ ΓΙΑ ΕΝΑ ΕΡΩΤΗΜΑ. Εδώ αρκούσε «πάνω από ένα
                      ακίνητο», ενώ η ίδια η εφαρμογή ορίζει τη σύγκριση ως δύο
                      ακίνητα ΙΔΙΟΥ ΤΥΠΟΥ (canCompare). Με διαμέρισμα και θέση
                      στάθμευσης, η οθόνη τύπωνε τίτλο και υπότιτλο «2 ακίνητα
                      δίπλα-δίπλα» και από κάτω η ίδια η σύγκριση απαντούσε
                      «δεν υπάρχουν δύο ακίνητα ίδιου τύπου». */}
                  {canCompare(properties) && (
                    <div style={{marginTop:T.sp.section}}>
                      <SecHdr label="Σε σχέση με τα υπόλοιπα ακίνητά σου"/>
                      {isTabAllowed(ent,'comparison')
                        ? <TabComparison properties={properties} userId={user.id} onNavigate={(t)=>setNav(t)} profileType={effProfileType}/>
                        : <FeatureLock title="Σύγκρινε τα ακίνητά σου δίπλα-δίπλα" benefit={`Απόδοση, δαπάνες και πάροχοι όλων των ακινήτων σου σε έναν πίνακα, για να δεις καθαρά πού κερδίζεις και πού χρειάζεται να λάβεις αποφάσεις. Ξεκλειδώνει με το πακέτο ${PLANS.owner.name}.`} requiredPlan="owner" currentPlanName={PLANS[effPlan].name} onManage={()=>setNav('settings')} />}
                    </div>
                  )}
                </>
              )}
              {nav==='loan'      && <TabLoan key={selected.id} propertyId={selected.id} userId={user.id} propertyValue={selected.value??undefined} propertySqm={selected.sqm??undefined} propertyYearBuilt={selected.year_built??undefined} profileType={effProfileType}/>}
              {nav==='accounting'&& <TabAccounting key={selected.id} propertyId={selected.id} userId={user.id} profileType={effProfileType} legalForm={taxForm} plan={effPlan} status={readStatus(selected)} onNavigate={(t)=>setNav(t)} onAddExpense={()=>{ setNav('finances'); setManualExpense(n=>n+1); }} onEditProperty={(id)=>{ const p=properties.find(x=>x.id===id); if(p){ setEditFocus('owner_afm'); setEditProperty(p); } }}/>}
              {navSafe==='inventory' && <TabInventory key={selected.id} propertyId={selected.id} userId={user.id} profileType={effProfileType} handoverIntent={handoverIntent} onIntentConsumed={()=>setHandoverIntent(null)} properties={properties}/>}
              {nav==='checklist' && <TabChecklist key={selected.id} propertyId={selected.id} userId={user.id} profileType={effProfileType}/>}
              {/* Ο ΕΛΕΓΧΟΣ ΤΟΥ ΑΜΑ ΕΙΝΑΙ ΕΞΩ ΑΠΟ ΤΟ FeatureLock, ΣΚΟΠΙΜΑ.
                  Ο ΑΜΑ που λείπει ή δεν αναγράφεται στην αγγελία κλείνει την
                  καταχώρηση — 12.145 στάλθηκαν για απενεργοποίηση το 2025. Κανείς
                  δεν πληρώνει συνδρομή για να μάθει ότι έχει πρόβλημα. Το CRM από
                  κάτω κλειδώνει· η προειδοποίηση ποτέ. */}
              {navSafe==='clients'   && (
                <>
                  <AmaStrip userId={user.id} propertyId={selected.id}/>
                  {isTabAllowed(ent,'clients')
                    ? <TabClients userId={user.id} onSelectProperty={(id)=>{ const p=properties.find(x=>x.id===id); if(p){ setSelected(p); setNav('overview'); } }}/>
                    : <FeatureLock title={`${navLabel('clients')} και υποψήφιοι`} benefit={`Οργάνωσε επισκέπτες, ιστορικό διαμονών και υποψήφιους σε ένα σημείο. Ξεκλειδώνει με το πακέτο ${PLANS.agency.name}.`} requiredPlan="agency" currentPlanName={PLANS[effPlan].name} onManage={()=>setNav('settings')} />}
                  {/* Η δυναμική τιμή ανά νύχτα αφορά ΜΟΝΟ βραχυχρόνια — δηλαδή
                      ακριβώς τους επισκέπτες αυτής της καρτέλας. Ως χωριστή
                      καρτέλα ήταν ένας προορισμός που κανείς δεν σκεφτόταν να
                      επισκεφθεί όταν όριζε τιμή. */}
                </>
              )}
              {/* Πάροχοι, τεχνικοί, τράπεζες: είναι στοιχεία ΤΟΥ ΑΚΙΝΗΤΟΥ, όπως
                  τα έγγραφά του. Δύο καρτέλες για «πού βρίσκω αυτό που χρειάζομαι
                  για το ακίνητο» ήταν μία παραπάνω. */}
              {/* ΤΟ «contacts» ΔΕΝ ΕΙΧΕ ΟΘΟΝΗ ΚΑΙ Ο ΒΟΗΘΟΣ ΕΣΤΕΛΝΕ ΕΚΕΙ.
                  Μετά την ενοποίηση, οι Επαφές ζουν ΜΕΣΑ στο Αρχείο. Κανένας
                  κλάδος όμως δεν απέδιδε τίποτα για nav==='contacts': η Νόα
                  έγραφε [[go:contacts]] σε τέσσερις απαντήσεις, ο χρήστης
                  πατούσε και έβλεπε ΜΟΝΟ το κουμπί «Πίσω» πάνω από κενή οθόνη.
                  Ο κωδικός μένει ζωντανός —τον ξέρει το NAV_LABELS και τον
                  στέλνει ο βοηθός— και οδηγεί εκεί που όντως είναι οι επαφές. */}
              {(nav==='documents' || nav==='contacts') && (
                <>
                  <TabDocuments key={selected.id} propertyId={selected.id} userId={user.id}/>
                  {/* Η επικεφαλίδα ζει ΜΕΣΑ στο component, μαζί με τις ενέργειές
                      της. Εδώ γραφόταν δεύτερη φορά και από κάτω το ίδιο το
                      component τύπωνε τίτλο σελίδας με υπότιτλο που έλεγε την
                      ίδια πρόταση με άλλες λέξεις. */}
                  <div style={{marginTop:T.sp.section}}>
                    <TabContacts key={selected.id} propertyId={selected.id} userId={user.id} embedded profileType={effProfileType} properties={properties}/>
                  </div>
                  {/* ΤΑ ΠΡΑΓΜΑΤΑ ΤΟΥ ΑΚΙΝΗΤΟΥ, ΜΑΖΙ ΜΕ ΤΑ ΧΑΡΤΙΑ ΚΑΙ ΤΟΥΣ
                      ΑΝΘΡΩΠΟΥΣ ΤΟΥ. Ο εξοπλισμός ήταν «εργαλείο» στην πλαϊνή
                      μπάρα, δίπλα στο Αρχείο, κάτω από ένα όνομα ομάδας που δεν
                      έλεγε τίποτα για κανένα από τα δύο. Εδώ είναι μία γραμμή
                      που οδηγεί στην πλήρη σελίδα, όχι δεύτερο αντίγραφό της. */}
                  {/* Ο ΣΥΝΔΕΣΜΟΣ ΕΜΦΑΝΙΖΟΤΑΝ ΧΩΡΙΣ ΚΑΜΙΑ ΣΥΝΘΗΚΗ.
                      Η καρτέλα του όμως φαίνεται μόνο σε μίσθωση: σε ιδιοχρησία,
                      κενό, ανακαίνιση, προς πώληση ή αμφισβητούμενο, ο χρήστης
                      διάβαζε τίτλο ενότητας και κάρτα «Άνοιγμα απογραφής» και
                      το πάτημα τον γύριζε σιωπηλά στην Επισκόπηση. Πέντε από τις
                      επτά καταστάσεις. Ίδιος κανόνας με το μενού, ένα σημείο. */}
                  {navVisible('inventory') && (
                  <div style={{marginTop:T.sp.section}}>
                    <SecHdr label={navLabel('inventory')} sub="Αξία, εγγυήσεις, συντήρηση και παράδοση"/>
                    <button onClick={()=>setNav('inventory')}
                      style={{display:'flex',alignItems:'center',gap:12,width:'100%',textAlign:'left',padding:'14px 16px',borderRadius: T.radius.popup,border:'1px solid var(--border-subtle)',background:'var(--bg-elevated)',cursor:'pointer',fontFamily:'inherit'}}>
                      <div style={{minWidth:0,flex:1}}>
                        <p style={{fontSize:14,fontWeight:500,color:'var(--text-primary)',marginBottom:2}}>Άνοιγμα απογραφής</p>
                        <p style={{fontSize:12,color:'var(--text-tertiary)',lineHeight:1.5}}>Ό,τι υπάρχει μέσα στο ακίνητο, με την αξία του, την εγγύησή του και το πρωτόκολλο παράδοσης.</p>
                      </div>
                      <svg aria-hidden="true" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                  </div>
                  )}
                </>
              )}
              {nav==='referral'  && <TabReferral userId={user.id} plan={plan} profileType={effProfileType}/>}
              {nav==='settings'  && <TabSettings key={selected.id} propertyId={selected.id} userId={user.id} profileType={effProfileType} declaredType={profileType} onProfileChange={setProfileType}/>}
            </div>
            </TabBoundary>
          </>
        )}
      </main>

      {/* Κάτω μπάρα πλοήγησης, μόνο σε κινητό (≤768px, μέσω CSS) */}
      {selected && (
        <nav className="bottom-nav" aria-label="Κύρια πλοήγηση">
          {BOTTOM_NAV.map(item => {
            const isActive = nav === item.id;
            const onTap = () => setNav(item.id);
            return (
              // Η ΕΝΕΡΓΗ ΚΑΡΤΕΛΑ ΛΕΓΟΤΑΝ ΜΟΝΟ ΜΕ ΧΡΩΜΑ και η κόκκινη τελεία
              // ήταν σκέτη τελεία: δύο πληροφορίες που ο αναγνώστης οθόνης δεν
              // μπορούσε να μεταφέρει με κανέναν τρόπο. Το `aria-current` λέει
              // πού βρίσκεσαι και το σήμα αποκτά τον αριθμό του.
              <button key={item.id} className={`bottom-nav-item ${isActive?'active':''}`} onClick={onTap}
                aria-current={isActive ? 'page' : undefined}>
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Η μηνιαία παρότρυνση για γνώμη δεν αιωρείται πια εδώ πάνω από το
          περιεχόμενο· αποδίδεται στη ροή, στο τέλος της Επισκόπησης (02.10.2026). */}
      <UpdateWatcher/>

      {/* Βοηθός ακινήτου, ορατός σε ΚΑΘΕ καρτέλα, πλωτό κουμπί κάτω δεξιά */}
      {selected&&user&&(
        <PropertyAssistant
          propertyId={selected.id} userId={user.id}
          propContext={{
            name: selected.name,
            propType: propertyTypeLabel(selected.prop_type)||undefined,
            address: selected.address||undefined, value: selected.value||undefined,
            sqm: selected.sqm||undefined, status: statusLabelOf(selected),
            targetRent: selected.target_rent||undefined,
            statusKey: readStatus(selected),
            enfia: selected.enfia!=null ? Number(selected.enfia) : undefined,
            yearBuilt: selected.year_built||undefined, floor: selected.floor??undefined,
            ownership: selected.ownership!=null ? Number(selected.ownership) : undefined,
            postalCode: selected.postal_code||undefined,
          }}
          allProperties={properties.map(p=>({
            name: p.name, propType: propertyTypeLabel(p.prop_type)||undefined,
            value: p.value||undefined, targetRent: p.target_rent||undefined,
            sqm: p.sqm||undefined, status: statusLabelOf(p),
          }))}
          // Ο ΒΟΗΘΟΣ ΔΕΝ ΠΑΡΑΚΑΜΠΤΕΙ ΤΗΝ ΟΡΑΤΟΤΗΤΑ.
          // Το parseAction επικυρώνει το [[go:x]] μόνο απέναντι στον στατικό
          // NAV_MAP — τον κατάλογο ΟΛΩΝ των καρτελών. Χωρίς αυτόν τον έλεγχο, η
          // Νόα μπορούσε να στείλει τον ιδιοκτήτη ενός ιδιοκατοικούμενου
          // ακινήτου στην «Τιμολόγηση», δηλαδή σε οθόνη που η ίδια η εφαρμογή
          // έχει κρίνει ότι δεν τον αφορά.
          onNavigate={(tab)=>{ if (navVisible(tab)) setNav(tab); }}
          canNavigate={navVisible}
          // Ο δωρεάν «Ιδιοκτήτης» δεν έχει τη Νόα· η δοκιμή την έχει (ανεβάζει
          // το επίπεδο στο «Ιδιοκτήτης+»), γι' αυτό κρίνει το ενεργό πακέτο.
          assistantLocked={!hasAssistant(effPlan)}
          planBrief={planBriefing(effPlan, plan, trial.active ? trial.daysLeft : undefined)}
          onScan={()=>setQuickAddOpen(true)}
        />
      )}

      <CommandPalette open={cmdkOpen} onClose={()=>setCmdkOpen(false)} items={cmdItems} />

      {/* Η ΣΑΡΩΣΗ ΗΤΑΝ ΤΟ ΤΕΛΕΥΤΑΙΟ ΧΕΙΡΟΓΡΑΦΟ ΠΑΡΑΘΥΡΟ ΤΗΣ ΣΕΛΙΔΑΣ.
          Είχε ωμό `rgba(0,0,0,0.32)` για φόντο — πιο ανοιχτό από το T.scrim
          (0,55) που φοράει κάθε άλλο παράθυρο, οπότε η ΠΙΟ κεντρική ενέργεια
          της εφαρμογής σκοτείνιαζε λιγότερο από μια επιβεβαίωση διαγραφής.
          Ακτίνα 14 αντί 18, δικό του «×» σε κύκλο 34 εικονοστοιχείων, καμία
          αντίδραση στο Escape, καμία επιστροφή εστίασης και καμία κλειδαριά
          κύλισης: το φόντο κυλούσε πίσω από τον σαρωτή. */}
      {/* ΧΩΡΙΣ ΥΠΟΤΙΤΛΟ, ΓΙΑΤΙ ΤΟΝ ΕΧΕΙ ΗΔΗ ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ. Το ίδιο το
          DocumentScan ανοίγει με «Πρόσθεσε ένα έγγραφο» και από κάτω τη γραμμή
          «Φωτογράφισε ή ανέβασε οτιδήποτε…». Ο υπότιτλος του παραθύρου έλεγε τα
          ίδια με άλλες λέξεις, δηλαδή δύο τίτλοι και δύο υπότιτλοι στη σειρά —
          και έμεναν και πάνω από την οθόνη επιτυχίας («Καταχωρήθηκε»), όπου δεν
          σαρώνει πια τίποτα. Ο τίτλος μένει: είναι το όνομα του παραθύρου δίπλα
          στο «×» και το μόνο που ακούει ο αναγνώστης οθόνης — το χειρόγραφο
          παράθυρο δεν είχε κανένα. */}
      <Modal open={!!(quickAddOpen&&user&&selected)} onClose={()=>{ if(!scanBusy) closeQuickAdd(); }} size="lg"
        title="Σάρωση εγγράφου">
        {user&&selected&&<DocumentScan propertyId={selected.id} userId={user.id} onBusyChange={setScanBusy}
          onManual={()=>{ closeQuickAdd(); setNav('finances'); setManualExpense(n=>n+1); }}
          onSaved={async()=>{await fetchProperties(user.id);}}/>}
      </Modal>

      {showWelcome&&user&&<WelcomeOnboarding userId={user.id}
        onAddProperty={()=>{ setShowWelcome(false); setShowAddModal(true); }}
        // ═══ Η ΣΑΡΩΣΗ ΠΕΡΝΑΕΙ ΑΠΟ ΤΟΝ ΟΔΗΓΟ ═════════════════════════════════
        // Εδώ δημιουργούνταν σιωπηλά «Νέο ακίνητο», διαμέρισμα, με κατάσταση
        // «Κενό», χωρίς καμία ερώτηση. Ο οδηγός όμως δεν έχει προεπιλογή
        // κατάστασης επίτηδες: αυτή κρίνει καρτέλες και φορολογία. Ενα
        // νοικιασμένο διαμέρισμα γραφόταν ως κενό. Τώρα ανοίγει ο οδηγός (τύπος,
        // κατάσταση, όνομα· «Αποθήκευση τώρα» υπάρχει από το δεύτερο βήμα) και η
        // σάρωση ξεκινά πάνω στο ακίνητο που αποθηκεύτηκε.
        onScanCreate={()=>{ setShowWelcome(false); setScanAfterAdd(true); setShowAddModal(true); }}
        onProfile={setProfileType}
        onClose={()=>setShowWelcome(false)} />}
      {/* ΤΟ ΠΑΡΑΔΕΙΓΜΑ ΔΕΝ ΓΡΑΦΕΙ ΤΙΠΟΤΑ. Ήταν ακίνητο μέσα στον λογαριασμό, με
          κουμπί καθαρισμού που έψαχνε λάθος όνομα και δεν εμφανιζόταν ποτέ. */}
      <DemoPreview open={showPreview} onClose={()=>setShowPreview(false)}
        onAddProperty={()=>{ setShowPreview(false); tryAddProperty(); }} />
      {showAddModal&&user&&<AddPropertyWizard userId={user.id} onClose={()=>{setShowAddModal(false);setScanAfterAdd(false);}} onSaved={async(id)=>{
        setShowAddModal(false);
        const list = await fetchProperties(user.id);
        const added = scanAfterAdd && id ? list?.find(p => p.id === id) : undefined;
        setScanAfterAdd(false);
        if (added) { setSelected(added); setNav('overview'); setQuickAddOpen(true); }
      }}/>}
      {editProperty&&user&&<AddPropertyWizard userId={user.id} existing={editProperty} focus={editFocus} onClose={()=>{setEditProperty(null);setEditFocus(null);}} onSaved={async()=>{setEditProperty(null);setEditFocus(null);await fetchProperties(user.id);}}/>}
      {showUpgrade&&<UpgradeModal currentCount={properties.length} planId={effPlan} onClose={()=>setShowUpgrade(false)} onManage={()=>{setShowUpgrade(false);setNav('settings');}}/>}
      <DpaModal />
    </div>
  );
}