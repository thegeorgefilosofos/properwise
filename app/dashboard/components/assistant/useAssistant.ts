'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΝΟΑΣ: ΣΥΝΟΜΙΛΙΑ, ΠΛΑΙΣΙΟ ΤΟΥ ΑΚΙΝΗΤΟΥ, ΜΝΗΜΕΣ, ΕΚΚΡΕΜΟΤΗΤΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Ό,τι κρατά η Νόα ανάμεσα στις αποδόσεις και ό,τι φορτώνει για να ξέρει
// πού βρίσκεται: μηνύματα, ρυθμίσεις, το πλαίσιο του ακινήτου, πελάτες και
// επαφές. Οι ενέργειες, η φωνή και η ερώτηση ζουν στα επόμενα hooks.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as properties from '@/lib/data/properties'
import * as loanStore from '@/lib/data/loans'
// Οι ρυθμίσεις ανά ενότητα έχουν ένα σπίτι: lib/data/settings.
import * as settings from '@/lib/data/settings'
import * as stayStore from '@/lib/data/stays'
import * as billStore from '@/lib/data/bills'
import * as rentStore from '@/lib/data/rent'
import * as tenantStore from '@/lib/data/tenants'
import * as checklist from '@/lib/data/checklist'
import * as expenseStore from '@/lib/data/expenses'
import * as calendar from '@/lib/data/calendar'
import type {
  BillsRow, ChecklistItemsRow, ClientStaysRow, ClientsRow, ContactsRow, ExpensesRow,
  RentPaymentsRow, UserPropertiesRow,
} from '@/lib/supabase/tables'
import { fp } from '@/components/Theme'
import { resolveRent, resolveValue, computeYields } from '@/lib/billing/propertyFacts'
import { mergeLedger, ledgerTotal, ledgerUnpaid } from '@/lib/expenses/ledger'
import { computeInsights, type Insight } from '@/lib/insights/engine'
import {
  RENTAL_TAX_SUMMARY_2026, CLIMATE_LEVY_SUMMARY_2025, MUNICIPAL_ACCOM_SUMMARY,
} from '@/lib/billing/greekTax'
import { annuityMonthly, interestForYear } from '@/lib/loans/recommend'
import { incomeStatement, taxProvision } from '@/lib/accounting/statement'
import { clientStats, stayTotal, CLIENT_TYPE_LABELS, type ClientType } from '@/lib/clients/clients'
import { suggestBase, realizedAdr, indicativeMonthly } from '@/lib/pricing/dynamicPricing'
import {
  type AssistantPrefs, type Memory, DEFAULT_PREFS, loadPrefs, PREFS_KEY, readPrefs, memKey,
  loadHistory, saveHistory,
} from '../assistantPersona'
// Οι επαφές έχουν ένα σπίτι: lib/data/contacts.
import * as contactStore from '@/lib/data/contacts'
import { roleLabel } from '@/lib/contacts/roles'
import { upcomingHolidays, holidayName, isWeekend } from '@/lib/calendar/greekHolidays'
import type { OpenerContext } from '@/lib/assistant/openers'
import { contactFlags } from '@/lib/assistant/roster'
import type { ReconcileQuestion } from '../scanDoc'
import type { ScannedDoc } from '@/lib/billing/documents'
import type { QuotaSnapshot } from '@/lib/billing/aiLimits'
import { athensToday, daysUntil } from '@/lib/core/time'
import { MONTHS_SHORT, MONTHS_GEN } from '@/lib/core/months'
import { useRemembered } from '@/components/useRememberedFlag'
import { useLoad } from '@/app/hooks/useLoad'
import { type Props, type Msg, type ClientLite, type ContactLite, eur, navLabel, NO_MEMORIES } from './model'

export function useAssistant({ propertyId, userId, propContext, allProperties = [] }: Props) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  // ═══ Η ΠΡΟΣΚΛΗΣΗ ΜΑΖΕΥΕΤΑΙ ΜΟΛΙΣ ΚΥΛΗΣΕΙ Η ΣΕΛΙΔΑ ═══════════════════════
  // ΜΕΤΡΗΜΕΝΟ (scripts/e2e-noa-cover.mjs, 36 σκηνές × 3 πλάτη): στο τέλος της
  // κύλισης το κουμπί δεν σκέπαζε τίποτα — το κάτω περιθώριο του .app-content
  // κάνει τη δουλειά του. Στο πρώτο κάδρο σκέπαζε κείμενο σε 64 σημεία και
  // αυτό που το σκέπαζε ήταν η ΠΡΟΣΚΛΗΣΗ: «Ρώτα τη Νόα» κάνει το κουμπί 190
  // εικονοστοιχεία φαρδύ αντί για 52. Ο χρήστης το φωτογράφισε πάνω στη στήλη
  // «Δάνειο προς αξία» του πίνακα επιτοκίων.
  //
  // Η πρόσκληση υπάρχει για να μάθει ο χρήστης ΠΟΙΑ είναι· μόλις αρχίσει να
  // διαβάζει (κυλάει), το όνομα μαζεύεται στο σήμα, όπως κάθε εκτεταμένο
  // πλωτό κουμπί. Και σε οθόνη κάτω από 1.280 μένει σήμα από την αρχή: εκεί
  // το περιεχόμενο φτάνει ως την άκρη και δεν υπάρχει άδεια γωνία να καθίσει.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = document.querySelector('.app-content');
    if (!(el instanceof HTMLElement)) return;
    const read = () => setScrolled(el.scrollTop > 4);
    read();
    el.addEventListener('scroll', read, { passive: true });
    return () => el.removeEventListener('scroll', read);
  }, []);
  // ΟΙ ΠΡΟΤΙΜΗΣΕΙΣ ΤΟΥ ΒΟΗΘΟΥ ΖΟΥΝ ΣΤΟΝ ΠΕΡΙΗΓΗΤΗ. Ηταν προεπιλογή που ένα
  // effect αντικαθιστούσε μετά την πρώτη απόδοση: όποιος είχε ζητήσει πληθυντικό
  // άκουγε τη Νόα να τον προσφωνεί στον ενικό για ένα καρέ, σε κάθε άνοιγμα.
  const [prefs, setPrefs] = useRemembered<AssistantPrefs>(
    PREFS_KEY,
    raw => readPrefs(raw) ?? loadPrefs() ?? DEFAULT_PREFS,
    v => JSON.stringify(v),
    DEFAULT_PREFS,
  );
  // Η ανοιχτή ερώτηση συμφωνίας: ποιον εκκρεμή λογαριασμό εξοφλεί η απόδειξη.
  const [reconcile, setReconcile] = useState<ReconcileQuestion | null>(null);
  const [editing, setEditing] = useState(false);
  // ΤΟ ΙΣΤΟΡΙΚΟ ΔΙΑΒΑΖΕΤΑΙ ΜΙΑ ΦΟΡΑ, ΜΕ ΤΕΜΠΕΛΙΚΗ ΑΡΧΙΚΟΠΟΙΗΣΗ. Ηταν σημαία
  // `firstRunRef` μέσα σε effect που έγραφε κατάσταση σύγχρονα. Ο πίνακας
  // μηνυμάτων αποδίδεται ΜΟΝΟ με ανοιχτό το πάνελ (γραμμή «{open && …}» πιο
  // κάτω), οπότε δεν υπάρχει τίποτα να ενυδατωθεί λάθος: στον διακομιστή δεν
  // αποδίδεται καθόλου.
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    if (typeof window === 'undefined') return [];
    if (loadPrefs()?.memory === false) return [];
    return loadHistory(propertyId).map(m => ({ role: m.role, text: m.text }));
  });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  // Κουμπιά ενεργειών που έχουν ήδη εκτελεστεί (ώστε ένα δεύτερο πάτημα να μη διπλοκαταχωρεί).
  const [consumedActions, setConsumedActions] = useState<Set<number>>(() => new Set());
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // Μετρητής απαντήσεων· μετά τις ~12 πρώτες, προτείνουμε (μία φορά) αξιολόγηση.
  const answeredRef = useRef(0);
  const nudgedRef = useRef(false);
  const imgRef = useRef<HTMLInputElement>(null);   // λήψη/επιλογή φωτο αντικειμένου για αναγνώριση
  const [err, setErr] = useState('');
  // Το ακριβές κείμενο του server όταν χτυπηθεί όριο. ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΑ: το γενικό
  // «δεν μπόρεσα να απαντήσω» κάνει τον χρήστη να νομίζει ότι χάλασε κάτι. Το όριο
  // δεν είναι βλάβη — είναι κατάσταση με νούμερο και με ημερομηνία επιστροφής και
  // πρέπει να λέγεται όπως ακριβώς τη διατύπωσε ο server (lib/billing/aiLimits.ts).
  const [limitMsg, setLimitMsg] = useState('');
  const [errDetail, setErrDetail] = useState('');
  /**
   * Πόσες ερωτήσεις απομένουν αυτόν τον μήνα.
   *
   * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: η βάση επέστρεφε ήδη το υπόλοιπο σε κάθε κλήση και το
   * πετούσαμε. Ο χρήστης μάθαινε ότι έχει όριο μόνο τη στιγμή που το χτυπούσε,
   * δηλαδή πάντα ως έκπληξη και συνήθως στη μέση μιας δουλειάς.
   *
   * ΓΙΑΤΙ `null` ΣΤΗΝ ΑΡΧΗ: πριν από την πρώτη ερώτηση δεν ΞΕΡΟΥΜΕ το υπόλοιπο,
   * και ένα νούμερο που μαντεύεται είναι χειρότερο από κανένα. Η γραμμή
   * εμφανίζεται μόλις υπάρχει πραγματική απάντηση της βάσης.
   */
  const [quota, setQuota] = useState<QuotaSnapshot | null>(null);
  const [ctxStr, setCtxStr] = useState('');
  const [insightsStr, setInsightsStr] = useState('');
  const [marketStr, setMarketStr] = useState('');
  const [clientsStr, setClientsStr] = useState('');
  const [pricingStr, setPricingStr] = useState('');
  // Τα ΔΙΚΑ ΤΟΥ νούμερα, για τις προτάσεις εκκίνησης και τον χαιρετισμό.
  // `null` = «δεν έχουν φορτώσει ακόμη» και είναι ΔΙΑΦΟΡΕΤΙΚΟ από `{}` = «δεν
  // υπάρχουν δεδομένα». Με κενό αντικείμενο, ο χρήστης με τρία χρόνια δαπάνες
  // διάβαζε «μόλις καταχωρήσεις τα πρώτα στοιχεία…» για όσο κρατούσε το ερώτημα.
  const [openerCtx, setOpenerCtx] = useState<OpenerContext | null>(null);
  const [techStr, setTechStr] = useState('');   // επαφές τεχνικών/παρόχων (καρτέλα Επαφές)
  // Η ΜΟΝΙΜΗ ΜΝΗΜΗ ΕΠΙΣΗΣ. Οι `addMemory`/`removeMemory` γράφουν ήδη στον
  // localStorage και επιστρέφουν τη νέα λίστα· περνώντας την από τον setter
  // ειδοποιούνται και οι υπόλοιπες καρτέλες. Το δεύτερο γράψιμο είναι της ίδιας
  // τιμής, δηλαδή χωρίς συνέπεια.
  const [storedMemories, setMemories] = useRemembered<Memory[]>(
    memKey(userId),
    raw => { try { return raw ? (JSON.parse(raw) as Memory[]) : NO_MEMORIES } catch { return NO_MEMORIES } },
    v => JSON.stringify(v),
    NO_MEMORIES,
  );
  // Οταν η μνήμη είναι σβηστή, δεν διαβάζεται ΤΙΠΟΤΑ: η ρύθμιση δεν είναι
  // φίλτρο εμφάνισης, είναι υπόσχεση.
  const memories = prefs.memory ? storedMemories : NO_MEMORIES;
  const scrollRef = useRef<HTMLDivElement>(null);
  const listeningRef = useRef(false);
  // Ιδιο με το ευρετήριο επαφών: κατάσταση, όχι αναφορά. Διαβάζεται από τη
  // `findClient`, που την καλεί η `runAction` του κουμπιού κάθε μηνύματος.
  const [clientsLite, setClientsLite] = useState<ClientLite[]>([]);
  // ΤΟ ΕΥΡΕΤΗΡΙΟ ΕΠΑΦΩΝ ΕΙΝΑΙ ΚΑΤΑΣΤΑΣΗ, ΟΧΙ ΑΝΑΦΟΡΑ. Ηταν `useRef` και
  // διαβαζόταν ΚΑΤΑ ΤΗΝ ΑΠΟΔΟΣΗ, μέσα στο κουμπί «Κάλεσε τον υδραυλικό» κάθε
  // μηνύματος. Μια αναφορά που αλλάζει δεν ξαναποδίδει τίποτα: όταν έφταναν οι
  // επαφές, το κουμπί έμενε κρυμμένο ώσπου να αλλάξει κάτι άλλο στην οθόνη.
  const [contactsLite, setContactsLite] = useState<ContactLite[]>([]);
  // Ανοιχτά στοιχεία προς πληρωμή, για τη σήμανση «πληρωμένο» ([[paid:…]]).
  // ΟΙ ΑΝΟΙΧΤΟΙ ΛΟΓΑΡΙΑΣΜΟΙ ΚΑΙ ΟΙ ΑΝΕΞΟΦΛΗΤΕΣ ΔΟΣΕΙΣ ΕΙΝΑΙ ΚΑΤΑΣΤΑΣΗ, ΟΧΙ
  // ΑΝΑΦΟΡΑ. Ηταν `useRef` και τις διαβάζει η `markPaid`, δηλαδή ο χειριστής του
  // κουμπιού «Σήμανση πληρωμένο» κάθε μηνύματος. Ο μεταγλωττιστής της React
  // βλέπει την αλυσίδα από την απόδοση και δεν μπορεί να ξεχωρίσει τι είναι
  // χειριστής: το αποτέλεσμα ήταν να καταγγέλλεται ολόκληρος ο πίνακας
  // μηνυμάτων. Ως κατάσταση, λέει την αλήθεια και ξαναποδίδει όταν πρέπει.
  const [openBills, setOpenBills] = useState<{ id: string; name: string; category: string; amount: number }[]>([]);
  // Η ΠΡΟΘΕΣΜΙΑ ΤΑΞΙΔΕΥΕΙ ΜΑΖΙ: ο βοηθός σημειώνει δόσεις πληρωμένες και χωρίς
  // αυτήν η καταχώρηση δεν μπορεί να πει πόσο άργησε ο μισθωτής.
  const [openRent, setOpenRent] = useState<{ id: string; label: string; amount: number; due: string | null }[]>([]);
  // Το σαρωμένο παραστατικό που περιμένει έγκριση. Είναι ref και όχι κατάσταση:
  // δεν το ζωγραφίζει τίποτα — το μήνυμα δίπλα του το περιγράφει ήδη — και μία
  // σάρωση είναι σε εξέλιξη κάθε φορά.
  // ΤΟ ΣΑΡΩΜΕΝΟ ΠΑΡΑΣΤΑΤΙΚΟ ΠΟΥ ΠΕΡΙΜΕΝΕΙ ΕΓΚΡΙΣΗ ΕΙΝΑΙ ΚΑΤΑΣΤΑΣΗ. Ηταν
  // αναφορά, την οποία διαβάζει η `commitPendingDoc`, δηλαδή ο χειριστής του
  // κουμπιού «Καταχώρησε» μέσα στον πίνακα μηνυμάτων. Ο μεταγλωττιστής δεν
  // ξεχωρίζει χειριστή από απόδοση όταν η συνάρτηση ζει στο σώμα, οπότε
  // κατήγγελλε ολόκληρο τον πίνακα.
  const [pendingDoc, setPendingDoc] = useState<{ doc: ScannedDoc; file: File } | null>(null);
  // Το `ask` ορίζεται πολύ πιο κάτω και κλείνει πάνω σε κατάσταση που αλλάζει.
  // Ο ακροατής του `pos:ask` γράφεται μία φορά (deps []), οπότε τον φτάνει μέσω
  // ref — αλλιώς θα κρατούσε για πάντα το πρώτο, άδειο, στιγμιότυπο.
  const askRef = useRef<((q: string) => void) | null>(null);

  // Ο μηνιαίος nudge (ή άλλο σημείο) μπορεί να ανοίξει τη φόρμα αξιολόγησης.
  useEffect(() => {
    const openFb = () => { setOpen(true); setFeedbackOpen(true); };
    window.addEventListener('pos:open-feedback', openFb);
    // Άλλα σημεία (π.χ. έλεγχος ισοζυγίου) ανοίγουν το πάνελ με προ-συμπληρωμένη ερώτηση.
    // Το `send` στέλνει αμέσως, αντί να συμπληρώσει το πεδίο. Το χρειάζεται η
    // γραμμή της Επισκόπησης: εκεί ο χρήστης ΔΙΑΛΕΓΕΙ έτοιμη ερώτηση, ακριβώς
    // όπως και μέσα στο πάνελ — και εκεί το πάτημα στέλνει. Ίδια πράξη, ίδια
    // συμπεριφορά. Ο έλεγχος ισοζυγίου αντίθετα προτείνει διατύπωση που ο
    // χρήστης μπορεί να θέλει να αλλάξει, γι' αυτό μένει στο πεδίο.
    const openAsk = (e: Event) => {
      const d = (e as CustomEvent).detail as { q?: string; send?: boolean } | undefined;
      const q = String(d?.q || '').trim();
      setOpen(true);
      if (!q) return;
      if (d?.send) askRef.current?.(q); else setInput(q);
    };
    window.addEventListener('pos:ask', openAsk);
    // ΤΟ ΠΛΗΚΤΡΟΛΟΓΙΟ ΑΝΟΙΓΕΙ ΚΑΙ ΚΛΕΙΝΕΙ. Ο βοηθός ήταν προσβάσιμος μόνο με το
    // ποντίκι, πάνω σε ένα πλωτό κουμπί — για κάτι που θέλει να είναι το κύριο
    // μονοπάτι, αυτό είναι το μακρύτερο. Το Escape κλείνει, όπως κάθε άλλο
    // επίπεδο της εφαρμογής.
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); setOpen(o => !o); return; }
      if (e.key !== 'Escape' || listeningRef.current) return;
      // ΤΟ ESCAPE ΚΛΕΙΝΕΙ ΕΝΑ ΕΠΙΠΕΔΟ, ΟΧΙ ΔΥΟ. Το παράθυρο της αξιολόγησης
      // είναι πια <Modal> και ακούει μόνο του Escape (useOverlayShell). Χωρίς
      // αυτόν τον φρουρό, ΕΝΑ πάτημα έφτανε και στα δύο: έκλεινε το παράθυρο
      // ΚΑΙ το πάνελ από κάτω, δηλαδή έσβηνε μαζί και τις λέξεις που μόλις είχε
      // γράψει ο χρήστης. Ο έλεγχος γίνεται στο DOM (ίδιος τρόπος με το
      // `overlayOpen` παρακάτω) και πιάνει ΚΑΘΕ παράθυρο της εφαρμογής που
      // τυχαίνει να είναι ανοιχτό πάνω από το πάνελ, όχι μόνο αυτό εδώ.
      if (document.querySelector('[aria-modal="true"]')) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pos:open-feedback', openFb);
      window.removeEventListener('pos:ask', openAsk);
      window.removeEventListener('keydown', onKey);
    };
  }, []);


  // Κλείσιμο με κλικ εκτός πάνελ (χωρίς να χρειάζεται το «×»). Δεν κλείνει όταν
  // αλλάζεις ρυθμίσεις ή όταν «ακούει», για να μη χαθεί η ενέργεια.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (listeningRef.current) return; // μη διακόπτεις ενεργή φωνή
      const el = e.target as Element | null;
      if (el && el.closest('.pa-panel, .pa-fab')) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // ── Η ΣΥΖΗΤΗΣΗ ΑΛΛΑΖΕΙ ΜΕΣΑ ΣΤΗΝ ΑΠΟΔΟΣΗ, ΟΧΙ ΣΕ EFFECT ─────────────────
  // Ήταν σε effect και δίπλα του ζούσε δεύτερο effect που ΑΠΟΘΗΚΕΥΕΙ. Στην
  // αλλαγή ακινήτου έτρεχαν και τα δύο στην ίδια απόδοση, με τη σειρά που είναι
  // γραμμένα: το πρώτο έβαζε σε ουρά τη ΝΕΑ συζήτηση και το δεύτερο εκτελούνταν
  // ακόμη με την ΠΑΛΙΑ στα χέρια του και το ΝΕΟ αναγνωριστικό — δηλαδή έγραφε τη
  // συζήτηση της Κυψέλης στο κλειδί της Γλυφάδας. Αν η Γλυφάδα δεν είχε δική της
  // συζήτηση, το ψεύτικο ιστορικό έμενε εκεί μόνιμα και την επόμενη φορά ο
  // βοηθός διάβαζε τα οικονομικά ΑΛΛΟΥ ακινήτου και απαντούσε με βάση αυτά.
  //
  // Η προσαρμογή κατά την απόδοση ξαναποδίδει το component ΠΡΙΝ τρέξει
  // οποιοδήποτε effect, οπότε το effect αποθήκευσης βλέπει και τη νέα συζήτηση
  // και το νέο ακίνητο. Ίδιο μοτίβο με το CommandPalette και το TabDocuments.
  //
  // Η ΠΡΩΤΗ φόρτωση μένει στο effect από κάτω: το `localStorage` δεν υπάρχει στον
  // διακομιστή και μια ανάγνωσή του μέσα στην πρώτη απόδοση θα έδινε άλλο δέντρο
  // στον διακομιστή και άλλο στον περιηγητή.
  const [histPid, setHistPid] = useState(propertyId);
  if (propertyId !== histPid) {
    setHistPid(propertyId);
    const mem = loadPrefs()?.memory !== false;
    setMsgs(mem ? loadHistory(propertyId).map(m => ({ role: m.role, text: m.text })) : []);
  }

  // Ό,τι απλώς καθαρίζεται μένει σε effect: κανένα από αυτά δεν διαβάζεται από
  // effect αποθήκευσης, άρα δεν έχει το ίδιο πρόβλημα σειράς. Εδώ μέσα γίνεται
  // ΚΑΙ η πρώτη και μόνη φόρτωση ιστορικού, στην πρώτη προσάρτηση: το effect
  // αποθήκευσης δεν κινδυνεύει, γιατί η άδεια συζήτηση δεν αποθηκεύεται ποτέ.
  // ΤΟ ΣΒΗΣΙΜΟ ΤΩΝ ΣΥΜΦΡΑΖΟΜΕΝΩΝ ΓΙΝΕΤΑΙ ΚΑΤΑ ΤΗΝ ΑΠΟΔΟΣΗ. Ηταν επτά γραφές
  // κατάστασης μέσα σε effect: με την αλλαγή ακινήτου, η Νόα κρατούσε για ένα
  // καρέ τα συμφραζόμενα του προηγούμενου — δηλαδή μπορούσε να απαντήσει με
  // νούμερα άλλου ακινήτου αν προλάβαινε το πάτημα.
  const [propSeen, setPropSeen] = useState(propertyId);
  if (propertyId !== propSeen) {
    setPropSeen(propertyId);
    setCtxStr(''); setInsightsStr(''); setMarketStr(''); setClientsStr(''); setPricingStr(''); setTechStr(''); setOpenerCtx(null);
    // Το σαρωμένο παραστατικό ανήκει στο ακίνητο που ήταν ανοιχτό όταν
    // φωτογραφήθηκε. Χωρίς αυτό, ένα πάτημα «Καταχώρησε» μετά την αλλαγή
    // ακινήτου θα έγραφε τον λογαριασμό της Κυψέλης στη Γλυφάδα.
    setPendingDoc(null); setReconcile(null);
  }


  // Αποθήκευση συζήτησης όταν η μνήμη είναι ενεργή.
  useEffect(() => {
    if (prefs.memory && msgs.length) saveHistory(propertyId, msgs.map(({ role, text }) => ({ role, text })));
  }, [msgs, prefs.memory, propertyId]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [msgs, busy, editing]);

  // Σύγκριση ακινήτων, δίνεται στο μοντέλο μόνο αν το ζητήσει ο χρήστης.
  const allPropsContext = prefs.compare && allProperties.length > 1
    ? allProperties.map((p, i) => {
        const gy = computeYields(resolveRent({ targetRent: p.targetRent }).value, resolveValue(p.value).value, 0).grossYield;
        // ΤΟ `toFixed` ΒΓΑΖΕΙ ΤΕΛΕΙΑ ΚΑΙ ΤΟ ΚΕΙΜΕΝΟ ΕΙΝΑΙ ΕΛΛΗΝΙΚΟ. Εγραφε
        // «6.7%» μέσα στα συμφραζόμενα που διαβάζει το μοντέλο — δίπλα σε ποσά
        // «1.234,56€» της ίδιας γραμμής, όπου η τελεία χωρίζει ΧΙΛΙΑΔΕΣ.
        const y = gy > 0 ? fp(gy) : null;
        return `${i + 1}. ${p.name}${p.propType ? ` (${p.propType})` : ''}: αξία ${eur(p.value)}, ενοίκιο-στόχος ${eur(p.targetRent)}/μήνα${y ? `, μεικτή απόδοση ~${y}` : ''}${p.sqm ? `, ${p.sqm} τ.μ.` : ''}${p.status ? `, ${p.status}` : ''}`;
      }).join('\n')
    : undefined;

  // Φόρτωση δεδομένων ακινήτου (μία φορά όταν ανοίξει), για συγκεκριμένες απαντήσεις.
  const loadContext = useCallback(async () => {
    const now = new Date();
    const year = now.getFullYear();
    // Το «σήμερα» της εφαρμογής είναι ώρα Ελλάδας, όχι UTC: αλλιώς για δύο ως
    // τρεις ώρες κάθε νύχτα η Νόα νόμιζε ότι είναι χθες.
    const todayStr = athensToday(now);
    const [exp, bil, ten, st, cal, { data: rates }, loans, { data: clientRows }, stayRows, contactRows, chk] = await Promise.all([
      expenseStore.ledger(supabase, propertyId, { userId, from: `${year}-01-01`, columns: `${expenseStore.LEDGER_COLUMNS},payment_method` }),
      billStore.ofProperty<BillsRow>(supabase, propertyId, billStore.LEDGER_COLUMNS, userId),
      tenantStore.currentAll(supabase, propertyId, 'full_name,monthly_rent,lease_end,deposit_amount', userId),
      // Τα στοιχεία ασφάλισης ζουν στο `user_properties` (insurance_company /
      // insurance_amount / insurance_expiry), ΟΧΙ στο property_settings — που έχει
      // μόνο company/policy/expiry και καθόλου ποσό. Το ερώτημα απορριπτόταν
      // ολόκληρο, οπότε ο βοηθός δεν ήξερε ΠΟΤΕ για ασφάλιση.
      properties.one<{ insurance_company: string | null; insurance_expiry: string | null; insurance_amount: number | null }>(supabase, propertyId, 'insurance_company,insurance_expiry,insurance_amount', userId),
      calendar.upcoming(supabase, { propertyId, userId }, athensToday(), 10),
      supabase.from('market_rates').select('euribor_3m,bog_housing_new,updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      loanStore.ofProperty(supabase, propertyId, userId),
      supabase.from('clients').select('id,type,full_name,afm,phone,email,rating,do_not_rent,tags,budget,needs').eq('user_id', userId).order('created_at', { ascending: false }).limit(80),
      stayStore.ofUser<ClientStaysRow>(supabase, userId, `client_id,rating,damages,damage_cost,notes,${stayStore.PORTFOLIO_COLUMNS}`),
      contactStore.ofUser<ContactsRow>(supabase, userId, 'full_name,role,phone,email', { orderBy: 'created_at', ascending: false, limit: 100 }),
      checklist.upcoming<ChecklistItemsRow>(supabase, propertyId, 'description,category,priority,due_date,status,estimated_cost,assigned_contact_name', userId),
    ]);
    // Οι γραμμές παίρνουν τους τύπους τους από το σχήμα (lib/supabase/tables.ts,
    // παραγόμενο από τα migrations). Πριν, κάθε πρόσβαση σε στήλη περνούσε από
    // `as any` — δηλαδή ένα ορθογραφικό λάθος σε όνομα στήλης δεν το έπιανε
    // κανείς μέχρι να μην εμφανιστεί το νούμερο στην οθόνη.
    const expenses = (exp || []) as ExpensesRow[];
    const billRows = bil;
    const stays = stayRows;
    const contacts = contactRows;
    const insurance = st as Pick<UserPropertiesRow, 'insurance_company' | 'insurance_expiry' | 'insurance_amount'> | null;

    // ── ΤΑ ΝΟΥΜΕΡΑ ΠΟΥ ΘΑ ΠΕΙ Η ΝΟΑ ΒΓΑΙΝΟΥΝ ΑΠΟ ΤΟΝ ΚΟΙΝΟ ΠΥΡΗΝΑ ────────────
    //
    // Πριν, τα σύνολα υπολογίζονταν ΜΟΝΟ από τον πίνακα `expenses`. Ο απλήρωτος
    // λογαριασμός όμως δεν έχει δαπάνη πίσω του — η δαπάνη γεννιέται στην
    // πληρωμή. Άρα:
    //   • η καθαρή απόδοση που έλεγε ήταν ΑΙΣΙΟΔΟΞΗ: αγνοούσε ό,τι χρωστάς·
    //   • το «εκκρεμείς» μετρούσε μόνο δαπάνες με paid=false, δηλαδή σχεδόν
    //     πάντα 0 — ενώ ο ιδιοκτήτης μπορεί να έχει ΕΝΦΙΑ και ΔΕΗ απλήρωτα.
    //
    // Και το χειρότερο: οι Δαπάνες και η Σύγκριση ΜΕΤΡΟΥΝ τους απλήρωτους. Ο
    // ίδιος χρήστης έπαιρνε άλλη απάντηση από την οθόνη και άλλη από τη Νόα,
    // για το ίδιο ακίνητο την ίδια στιγμή. Σε βοηθό που δίνει συμβουλή με λόγια,
    // αυτό δεν διαβάζεται ως διαφορά πίνακα — διαβάζεται ως λάθος συμβουλή.
    const ledger = mergeLedger((bil || []) as never[], expenses as never[]);
    const ofYear = ledger.entries.filter(e => e.date >= `${year}-01-01` && e.date <= `${year}-12-31`);
    const total = ledgerTotal(ofYear);
    // Ταμειακή βάση για τη φορολογική εικόνα: ό,τι ΟΝΤΩΣ πληρώθηκε.
    const paid = ledgerTotal(ofYear.filter(e => e.paid));
    const owed = ledgerTotal(ledgerUnpaid(ofYear));

    const catMap: Record<string, number> = {};
    ofYear.forEach(e => { const k = e.category || 'Άλλο'; catMap[k] = (catMap[k] || 0) + e.amount; });
    const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const unpaid = billRows.filter(b => !b.paid);
    setOpenBills(unpaid.map(b => ({ id: b.id, name: b.name || 'λογαριασμός', category: b.category || '', amount: b.amount || 0 })));
    // Ανεξόφλητες δόσεις ενοικίου (για σήμανση «πληρωμένο» από τη συνομιλία)
    // ΟΛΕΣ ΟΙ ΔΟΣΕΙΣ, ΟΧΙ ΜΟΝΟ ΟΙ ΑΠΛΗΡΩΤΕΣ. Το φίλτρο `paid=false` σήμαινε ότι ο
    // βοηθός δεν είχε καμία εικόνα συνέπειας πληρωμών και ότι τα δεδουλευμένα
    // έσοδα της χρονιάς έπρεπε να μαντευτούν από το ενοίκιο επί δώδεκα.
    const rentAll = await rentStore.chronological<RentPaymentsRow>(supabase, propertyId, `id,due_date,${rentStore.PERIOD_COLUMNS}`, userId);
    // ── ΤΟ ΓΡΑΦΕ ΚΑΙ ΤΟ ΔΙΑΒΑΖΕ ΣΤΗΝ ΙΔΙΑ ΕΚΤΕΛΕΣΗ ─────────────────────────
    // Η κατάσταση της React ΔΕΝ αλλάζει μέσα στην ίδια συνάρτηση: το
    // `setOpenRent` προγραμματίζει, δεν αναθέτει. Εκατό γραμμές πιο κάτω το
    // `openRent.reduce(...)` και η γραμμή «Ανεξόφλητες δόσεις ενοικίου»
    // διάβαζαν την ΠΡΟΗΓΟΥΜΕΝΗ τιμή, δηλαδή κενή λίστα στο πρώτο άνοιγμα του
    // πάνελ. Ο ιδιοκτήτης με τρεις ανείσπρακτες δόσεις άνοιγε τη Νόα και οι
    // προτάσεις εκκίνησης δεν ανέφεραν ούτε μία — και τα συμφραζόμενα που
    // έφταναν στο μοντέλο έλεγαν ότι δεν υπάρχουν καθυστερήσεις.
    //
    // Ο πίνακας υπολογίζεται ΜΙΑ φορά σε τοπική μεταβλητή· η κατάσταση παίρνει
    // την ίδια τιμή· όλοι οι αναγνώστες αυτής της εκτέλεσης διαβάζουν αυτήν.
    const openRentNow = rentAll.filter(r => !r.paid).map(r => ({ id: r.id, label: `Ενοίκιο ${MONTHS_GEN[(r.period_month || 1) - 1]} ${r.period_year}`, amount: r.amount || 0, due: r.due_date }));
    setOpenRent(openRentNow);
    const t = ten?.[0];
    const rent = resolveRent({ tenantRent: t?.monthly_rent, targetRent: propContext.targetRent }).value;
    const value = resolveValue(propContext.value).value;
    const { grossYield: grossY, netYield: netY } = computeYields(rent, value, total);
    const leaseEnd = t?.lease_end || null;
    const daysLease = leaseEnd ? daysUntil(leaseEnd) ?? 0 : null;

    const loanRows = loans;
    const rateTypeGr = (rt?: string) => rt === 'variable' ? 'κυμαινόμενο' : rt === 'mixed' ? 'μεικτό' : 'σταθερό';
    const monthlyDebt = loanRows.reduce((s, l) => s + annuityMonthly(l.amount || 0, l.rate || 0, l.years || 0), 0);
    // Ο τόκος της φετινής χρήσης, ώστε το κεφάλαιο να ξεχωρίζει από τη δόση.
    const loanInterestYear = loanRows.reduce((s, l) => {
      const startY = l.start_date ? Number(String(l.start_date).slice(0, 4)) : year;
      return s + interestForYear(l.amount || 0, l.rate || 0, l.years || 0, year - startY + 1);
    }, 0);
    // ── Ο ΤΟΚΟΣ ΥΠΟΛΟΓΙΖΟΤΑΝ ΚΑΙ ΔΕΝ ΕΛΕΓΕΤΑΙ ΠΟΤΕ ───────────────────────────
    // Η γραμμή έλεγε μόνο τη ΔΟΣΗ. Στη δήλωση όμως δεν εκπίπτει η δόση —
    // εκπίπτει ο τόκος: το κεφάλαιο είναι εξόφληση χρέους, όχι δαπάνη. Ρωτώντας
    // «τι εκπίπτει από το δάνειο;» η Νόα είχε μπροστά της τον σωστό αριθμό
    // (`loanInterestYear`, υπολογισμένο τέσσερις γραμμές πιο πάνω) και απαντούσε
    // με τη δόση, γιατί ο τόκος δεν έμπαινε ποτέ στο κείμενο που της δινόταν.
    const loanLine = loanRows.length
      ? `Δάνεια (${loanRows.length}): εκτιμώμενη συνολική μηνιαία δόση ${eur(Math.round(monthlyDebt))}. Από τις δόσεις του ${year}, τόκοι περίπου ${eur(Math.round(loanInterestYear))}: ΜΟΝΟ αυτό το μέρος εκπίπτει, το κεφάλαιο όχι. ${loanRows.map(l => `${l.bank || 'τράπεζα'} ${eur(l.amount || 0)} με ${fp(Number(l.rate || 0))} ${rateTypeGr(l.rate_type ?? undefined)} σε ${l.years || 0} έτη`).join('; ')}`
      : 'Δεν έχει καταχωρηθεί δάνειο για αυτό το ακίνητο.';

    // Έσοδα φιλοξενίας (διαμονές επισκεπτών από το Πελατολόγιο συνδεδεμένες σε αυτό το ακίνητο).
    const propStays = stays.filter(s => s.property_id === propertyId);
    const propHostRevenue = propStays.reduce((sum, s) => sum + stayTotal(s), 0);
    const hostingLine = propStays.length
      ? `Έσοδα φιλοξενίας από διαμονές επισκεπτών σε αυτό το ακίνητο: ${eur(Math.round(propHostRevenue))} από ${propStays.length} διαμονές (πηγή: ${navLabel('clients')}).`
      : '';

    // ── Λογιστική εικόνα (ΙΔΙΑ μηχανή με την καρτέλα Λογιστική) ώστε Νόα να
    // συμβουλεύει με τον σωστό φόρο/καθαρό, όχι με πρόχειρες εκτιμήσεις. ──────────
    const isShortAcct = propStays.length > 0;
    const yearStays = propStays.filter(s => (s.check_in || '').slice(0, 4) === String(year));

    // ── ΤΟ ΜΕΙΚΤΟ ΕΙΣΟΔΗΜΑ ΕΙΝΑΙ ΤΙ ΟΦΕΙΛΕΤΑΙ ΚΑΙ ΤΟ ΤΑΜΕΙΟ ΕΙΝΑΙ ΤΙ ΜΠΗΚΕ ──
    // Εδώ γραφόταν `rent * 12`, όπου το `rent` μπορεί να προέρχεται από τον
    // ΣΤΟΧΟ του ακινήτου (resolveRent → πηγή 'target'). Δηλαδή ένας στόχος
    // γινόταν «μεικτά έσοδα» και θεωρούνταν δώδεκα μήνες εισπραγμένοι — ενώ
    // λίγες γραμμές πιο πάνω η ίδια συνάρτηση έχει τη λίστα των ανεξόφλητων
    // δόσεων. Πάνω σε αυτή την παραδοχή έβγαιναν πέντε ποσά σε ευρώ, ως γεγονότα.
    //
    // Τώρα: τα δεδουλευμένα βγαίνουν από τις ΚΑΤΑΧΩΡΗΜΕΝΕΣ δόσεις του έτους,
    // και όσα δεν εισπράχθηκαν δηλώνονται ρητά στη μηχανή ως `uncollectedIncome`
    // — πεδίο που υπάρχει ακριβώς γι' αυτό. Χωρίς καμία δόση, πέφτουμε στον
    // στόχο ΚΑΙ το λέμε στην ίδια πρόταση.
    const yearRent = (rentAll || []) as RentPaymentsRow[];
    const accruedRent = yearRent.filter(r => r.period_year === year).reduce((s, r) => s + (r.amount || 0), 0);
    const collectedRent = yearRent.filter(r => r.period_year === year && r.paid).reduce((s, r) => s + (r.amount || 0), 0);
    const rentFromTarget = accruedRent <= 0;
    const longGross = rentFromTarget ? rent * 12 : accruedRent;
    const acctGross = isShortAcct ? yearStays.reduce((sum, s) => sum + stayTotal(s), 0) : longGross;
    const acctStmt = incomeStatement({
      regime: isShortAcct ? 'individual_shortterm' : 'individual_longterm',
      grossIncome: acctGross, otherCashExpenses: paid,
      // ΤΟ ΠΕΔΙΟ ΖΗΤΑΕΙ ΚΕΦΑΛΑΙΟ ΟΤΑΝ Ο ΤΟΚΟΣ ΕΚΠΙΠΤΕΙ ΧΩΡΙΣΤΑ. ΕΔΩ ΔΕΝ ΕΚΠΙΠΤΕΙ.
      //
      // Η προηγούμενη διόρθωση αφαιρούσε τον τόκο από τη δόση και είχε δίκιο —
      // για καθεστώς επιχείρησης, όπου ο τόκος είναι δική του εκπεστέα γραμμή.
      // Σε `individual_*` όμως η `incomeStatement` μηδενίζει τον τόκο, οπότε το
      // ταμείο αφαιρούσε ΜΟΝΟ το κεφάλαιο: ο ιδιώτης πληρώνει ολόκληρη τη δόση
      // και δεν εκπίπτει τον τόκο πουθενά.
      //
      // Το αποτέλεσμα ήταν δύο διαφορετικά ταμειακά υπόλοιπα για το ίδιο ακίνητο
      // και το ίδιο έτος: η Νόα έλεγε 6.591,88€ περισσότερα από τη Λογιστική σε
      // δάνειο 190.000€ με 3,5%. Όποιος έβλεπε και τα δύο, δεν πίστευε κανένα.
      loanPrincipal: Math.max(0, Math.round(monthlyDebt * 12)),
      uncollectedIncome: isShortAcct || rentFromTarget ? 0 : Math.max(0, accruedRent - collectedRent),
    });
    const acctProv = taxProvision(acctStmt, now.getMonth() + 1);
    const accountingLine = acctGross > 0
      ? `Λογιστική ${year} (${isShortAcct ? 'βραχυχρόνια' : 'μακροχρόνια'} μίσθωση): μεικτά έσοδα ${eur(Math.round(acctStmt.grossIncome))}${!isShortAcct && rentFromTarget ? ' (βάσει ενοικίου-στόχου, δεν έχουν καταχωρηθεί δόσεις)' : ''}${!isShortAcct && !rentFromTarget && accruedRent > collectedRent ? `, από τα οποία ανείσπρακτα ${eur(Math.round(accruedRent - collectedRent))}` : ''}, φορολογητέο ${eur(Math.round(acctStmt.taxableIncome))}, εκτιμώμενος φόρος εισοδήματος ${eur(Math.round(acctStmt.incomeTax))} (μέσος συντελεστής ${fp((acctStmt.effectiveRate * 100))}), καθαρό αποτέλεσμα ${eur(Math.round(acctStmt.netProfit))}. Πρόταση πρόβλεψης φόρου: περίπου ${eur(Math.round(acctProv.monthly))} τον μήνα να μπαίνουν στην άκρη. Εκτίμηση με την κλίμακα 2026 (τεκμαρτή έκπτωση 5% σε μακροχρόνια και σε βραχυχρόνια χωρίς υπηρεσίες, εφόσον η είσπραξη γίνεται μέσω τράπεζας)· τα ποσά είναι ενδεικτικά, έλεγχος με λογιστή.`
      : '';

    // ── Εκκρεμότητες: πραγματικές ανοιχτές εργασίες (καρτέλα Εκκρεμότητες) ώστε Νόα
    // να απαντά «τι εκκρεμεί;» με στοιχεία, όχι υποθέσεις και να ξεχωρίζει τις ληξιπρόθεσμες.
    const openTasks = chk;
    const overdueTasks = openTasks.filter(i => i.due_date && i.due_date < todayStr);
    const taskCostSum = openTasks.reduce((s, i) => s + (Number(i.estimated_cost) || 0), 0);
    const checklistLine = openTasks.length
      ? `Ανοιχτές εκκρεμότητες (${openTasks.length}${overdueTasks.length ? `, εκ των οποίων ${overdueTasks.length} ληξιπρόθεσμες` : ''}${taskCostSum > 0 ? `, εκτιμώμενο κόστος ${eur(Math.round(taskCostSum))}` : ''}): ${openTasks.slice(0, 15).map(i => `${i.description}${i.due_date ? ` [προθεσμία ${i.due_date}${i.due_date < todayStr ? ', ΛΗΞΙΠΡΟΘΕΣΜΗ' : ''}]` : ''}${i.estimated_cost ? ` ~${eur(i.estimated_cost)}` : ''}${i.assigned_contact_name ? ` (ανάθεση: ${i.assigned_contact_name})` : ''}`).join('; ')}${openTasks.length > 15 ? ` (και ${openTasks.length - 15} ακόμη)` : ''}`
      : 'Δεν υπάρχουν ανοιχτές εκκρεμότητες.';

    // Τα νούμερα που τροφοδοτούν τις προτάσεις εκκίνησης. Ό,τι δεν υπάρχει
    // μένει undefined — η μηχανή προτάσεων δεν επινοεί ποτέ ποσά.
    setOpenerCtx({
      propertyName: propContext.name,
      monthlyRent: rent || undefined,
      propertyValue: value || undefined,
      expensesYtd: total || undefined,
      openTasks: openTasks.length,
      overdueRent: openRentNow.reduce((sum, r) => sum + (r.amount || 0), 0) || undefined,
      hasLoan: loanRows.length > 0,
      isShortTerm: propStays.length > 0,
      propertyCount: allProperties.length || undefined,
    });

    // ── Δυναμική τιμολόγηση: βάση + ενδεικτικός πίνακας ανά μήνα ──
    // Προτίμησε τη ΒΑΣΗ που έχει ορίσει ο χρήστης στην καρτέλα Τιμολόγηση (αν υπάρχει).
    // ── ΤΟ «ΔΕΝ ΔΙΑΒΑΣΤΗΚΕ» ΔΕΝ ΕΙΝΑΙ «ΔΕΝ ΕΧΕΙ ΟΡΙΣΕΙ ΒΑΣΗ» ─────────────────
    // Το σφάλμα πεταγόταν: σε αποτυχία το `pset` έρχεται null, ακριβώς όπως
    // στον χρήστη που δεν όρισε ποτέ βάση. Η Νόα έλεγε «Δεν έχει οριστεί
    // βασική τιμή» σε ιδιοκτήτη που την είχε ορίσει ή, με ιστορικό διαμονών,
    // έχτιζε πίνακα δώδεκα μηνών με ποσά ανά νύχτα πάνω σε δική της εκτίμηση:
    // τιμές που ο ιδιοκτήτης θα ανέβαζε στα κανάλια. Τώρα το «δεν ξέρουμε»
    // λέγεται: ούτε πίνακας ούτε βεβαίωση.
    const { data: pset, error: psetErr } = await supabase.from('pricing_settings').select('base,weekend_premium').eq('user_id', userId).eq('property_id', propertyId).maybeSingle();
    const wkndPrem = pset?.weekend_premium != null ? Number(pset.weekend_premium) : 0.18;
    // ΚΑΜΙΑ ΒΑΣΗ ΑΠΟ ΤΟ ΠΟΥΘΕΝΑ. Εδώ υπήρχε τρίτο εναλλακτικό:
    // `(ενοίκιο-στόχος / 30) × 2,2`. Είναι ακριβώς ο τύπος που το
    // lib/pricing/dynamicPricing.ts διέγραψε ρητά και εξηγεί γιατί: καμία πηγή,
    // κανένας γεωγραφικός διαχωρισμός, 60 τετραγωνικά στη Λάρισα έβγαζαν την
    // ίδια τιμή με 60 στη Μύκονο. Ο βοηθός τον ξαναέγραφε εδώ και πάνω του
    // έχτιζε ΠΛΗΡΗ πίνακα δώδεκα μηνών με συγκεκριμένα ποσά ανά νύχτα.
    // Η επιφύλαξη «εκτίμηση, χωρίς επαρκές ιστορικό» έμπαινε μόνο στη γραμμή της
    // βάσης, όχι στον πίνακα που διάβαζε ο χρήστης.
    //
    // Το `else` παρακάτω λέει ήδη τη σωστή αλήθεια: χωρίς ιστορικό, ο χρήστης
    // ορίζει βάση στην Τιμολόγηση.
    const priceBase = (pset?.base != null ? Number(pset.base) : 0) || suggestBase(propStays);
    if (psetErr) {
      setPricingStr(`Οι ρυθμίσεις τιμολόγησης αυτού του ακινήτου δεν διαβάστηκαν. Μη λες τιμή ανά νύχτα, μη δίνεις πίνακα μηνών· μην πεις ούτε ότι υπάρχει βάση ούτε ότι δεν έχει οριστεί. Πες ότι τα στοιχεία τιμολόγησης δεν φορτώθηκαν τώρα κι ότι ο χρήστης τα βλέπει στην καρτέλα ${navLabel('pricing')}.`);
    } else if (priceBase > 0) {
      const adrVal = realizedAdr(propStays);
      const table = indicativeMonthly(priceBase, wkndPrem).map(r => `${MONTHS_SHORT[r.month]} ${r.weekday}/${r.weekend}`).join(', ');
      setPricingStr([
        `Βάση: ${eur(priceBase)}/νύχτα${adrVal > 0 ? ` (μέση πραγματική ADR ${eur(Math.round(adrVal))} από ${propStays.length} διαμονές)` : ' (εκτίμηση, χωρίς επαρκές ιστορικό)'}.`,
        `Ενδεικτικές τιμές ανά μήνα (καθημερινή/Σαββατοκύριακο): ${table}.`,
        `Εμπειρικοί κανόνες της εφαρμογής (όχι στατιστικό αγοράς· πες το έτσι αν τους αναφέρεις): αργίες και υψηλή ζήτηση (Δεκαπενταύγουστος, Πάσχα, Εορτές, Πρωτοχρονιά) περίπου +25%. Last minute σε κενές κοντινές ημέρες περίπου -8% έως -15%. Υψηλή πληρότητα γύρω από την ημερομηνία ανεβάζει έως +12%.`,
        `Για ημερομηνία που ζητά ο χρήστης: πάρε τον μήνα από τον πίνακα (καθημερινή ή Σαββατοκύριακο) και πρόσθεσε αργία/ζήτηση αν ισχύει. Οι τιμές είναι ενδεικτικές προτάσεις.`,
      ].join('\n'));
    } else {
      setPricingStr('Δεν έχει οριστεί βασική τιμή ούτε υπάρχει ιστορικό διαμονών. Για προτάσεις τιμής, ο χρήστης ορίζει βασική τιμή στην καρτέλα Τιμολόγηση.');
    }

    // ── Προϋπολογισμός: μηνιαίος στόχος και ειδοποίηση υπέρβασης ─────────────
    // Οι «κουμπαράδες» αφαιρέθηκαν από το προϊόν: ο ιδιοκτήτης ακινήτου δεν
    // ήρθε εδώ για να αποταμιεύσει, ήρθε για δαπάνες, φόρους και ενοίκια.
    const bData = (await settings.section(supabase, propertyId, 'budgets', userId)) || {};
    // ΧΩΡΙΣ ΟΡΙΣΜΕΝΟ ΣΤΟΧΟ, ΚΑΝΕΝΑΣ ΑΡΙΘΜΟΣ.
    // Ήταν `|| 390`. Ο χρήστης που δεν είχε ορίσει ποτέ προϋπολογισμό, έπαιρνε
    // από τη Νόα προτάσεις πάνω σε «μηνιαίο στόχο 390€» — νούμερο που δεν
    // είπε ποτέ, διατυπωμένο σαν δικό του.
    const rawTarget = parseFloat(String(bData.total ?? ''));
    const monthlyTarget: number | null = Number.isFinite(rawTarget) && rawTarget > 0 ? rawTarget : null;
    const notifyOverspend = String(bData.notifyOverspend) === 'true';
    const budgetLine = [
      `Προϋπολογισμός: ${monthlyTarget !== null ? `μηνιαίος στόχος δαπανών ${eur(monthlyTarget)}` : 'δεν έχει οριστεί μηνιαίος στόχος δαπανών· μη μιλάς για στόχο σαν να υπάρχει, πρότεινε να τον ορίσει'}. Ειδοποίηση υπέρβασης: ${notifyOverspend ? 'ενεργή (email μέσω προτιμήσεων ειδοποιήσεων)' : 'ανενεργή'}.`,
    ].join(' ');

    const lines = [
      `Ακίνητο: ${propContext.name}${propContext.propType ? ` (${propContext.propType})` : ''}${propContext.address ? `, ${propContext.address}` : ''}`,
      propContext.sqm ? `Εμβαδόν: ${propContext.sqm} τ.μ.` : '',
      value ? `Εμπορική αξία: ${eur(value)}` : 'Εμπορική αξία: δεν έχει καταχωρηθεί',
      propContext.status ? `Κατάσταση: ${propContext.status}` : '',
      `Ενοίκιο: ${eur(rent)}/μήνα (ετήσιο ${eur(rent * 12)})`,
      value ? `Απόδοση: μεικτή ${fp(grossY)}, καθαρή ${fp(netY)}` : '',
      `Δαπάνες ${year}: σύνολο ${eur(total)} (πληρωμένες ${eur(paid)}, εκκρεμείς ${eur(owed)}). Κάθε ευρώ μετρημένο μία φορά· οι απλήρωτοι λογαριασμοί μετρούν στην ημερομηνία που λήγουν· ίδιος υπολογισμός με τις Δαπάνες και τη Σύγκριση.`,
      topCats.length ? `Μεγαλύτερες κατηγορίες: ${topCats.map(([c, a]) => `${c} ${eur(a)}`).join(', ')}` : '',
      unpaid.length ? `Απλήρωτοι λογαριασμοί (${unpaid.length}): ${unpaid.slice(0, 12).map(b => `${b.name || 'λογαριασμός'} ${eur(b.amount)}${b.due_date ? ` λήξη ${b.due_date}` : ''}`).join('; ')}` : 'Δεν υπάρχουν απλήρωτοι λογαριασμοί.',
      openRentNow.length ? `Ανεξόφλητες δόσεις ενοικίου (${openRentNow.length}): ${openRentNow.slice(0, 12).map(r => `${r.label} ${eur(r.amount)}`).join('; ')}` : '',
      t ? `Ενοικιαστής: ${t.full_name || 'καταχωρημένος'}${t.deposit_amount ? `, εγγύηση ${eur(t.deposit_amount)}` : ''}` : 'Δεν έχει καταχωρηθεί ενοικιαστής.',
      leaseEnd ? `Λήξη μίσθωσης: ${leaseEnd}${daysLease != null ? ` (σε ${daysLease} ημέρες)` : ''}` : '',
      insurance?.insurance_company || insurance?.insurance_expiry ? `Ασφάλεια: ${insurance?.insurance_company || 'εταιρεία άγνωστη'}${insurance?.insurance_expiry ? `, λήξη ${insurance.insurance_expiry}` : ''}` : 'Ασφάλεια: δεν έχει καταχωρηθεί.',
      loanLine,
      hostingLine,
      accountingLine,
      budgetLine,
      (cal || []).length ? `Επόμενα στο ημερολόγιο: ${(cal || []).map(c => `${c.event_date} ${c.title}${c.amount ? ` ${eur(c.amount)}` : ''}`).join('; ')}` : '',
      checklistLine,
      `Σήμερα είναι ${new Date(todayStr).toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${isWeekend(todayStr) ? ' (Σαββατοκύριακο)' : ''}${holidayName(todayStr) ? `, αργία: ${holidayName(todayStr)}` : ''}.`,
      `Επόμενες επίσημες αργίες Ελλάδας: ${upcomingHolidays(todayStr, 5).map(h => `${h.name} (${new Date(h.date).toLocaleDateString('el-GR', { day: 'numeric', month: 'short' })})`).join(', ')}. Όταν προτείνεις ημερομηνία/ώρα ραντεβού, απόφυγε Σαββατοκύριακα και αργίες εκτός αν το ζητήσει ο χρήστης και ανάφερέ το αν η ημέρα που διαλέγει πέφτει σε αργία/Σαββατοκύριακο.`,
    ].filter(Boolean);
    setCtxStr(lines.join('\n'));

    // ── Insights: τι εκκρεμεί / ευκαιρίες, με την ίδια μηχανή που τροφοδοτεί την Επισκόπηση.
    // Φιλτράρουμε το «λείπουν στοιχεία» γιατί εδώ δεν φορτώνουμε πλήρες προφίλ (το δείχνει η Επισκόπηση).
    const insights: Insight[] = computeInsights({
      now: now.getTime(),
      property: {
        name: propContext.name, prop_type: propContext.propType, value, sqm: propContext.sqm,
        target_rent: propContext.targetRent, insurance_expiry: insurance?.insurance_expiry, insurance_amount: insurance?.insurance_amount,
      },
      tenant: t ? { monthly_rent: t.monthly_rent, lease_end: t.lease_end } : null,
      rent, propValue: value, grossYield: grossY, netYield: netY, expensesYTD: total,
      expenses: expenses.map(e => ({ category: e.category, amount: e.amount || 0, date: e.date, // ΤΟ NULL ΔΕΝ ΕΙΝΑΙ «ΝΑΙ». Εδώ γραφόταν `e.paid !== false`, που περνά το
        // άγνωστο ως εξοφλημένο — ακριβώς το σφάλμα που το lib/expenses/ledger.ts
        // περιγράφει ως διορθωμένο και κρίνει με `paid === true`. Ο βοηθός
        // έλεγε στον ιδιοκτήτη ότι δεν χρωστά τίποτα, ενώ η κάρτα «Χρωστάω»
        // δίπλα του μετρούσε τις ίδιες δαπάνες ως ανοιχτές.
        paid: e.paid === true, payment_method: e.payment_method })),
      bills: billRows.map(b => ({ type: b.category ?? undefined, amount: b.amount, paid: b.paid, due_date: b.due_date })),
      tasks: [], inventory: [],
      checklist: openTasks.map(i => ({ due_date: i.due_date, status: i.status ?? undefined, priority: i.priority ?? undefined })),
    }).filter(i => i.id !== 'profile-incomplete');
    const KIND_TXT: Record<string, string> = { urgent: 'ΕΠΕΙΓΟΝ', attention: 'ΠΡΟΣΟΧΗ', opportunity: 'ΕΥΚΑΙΡΙΑ', positive: 'ΘΕΤΙΚΟ' };
    setInsightsStr(insights.slice(0, 6).map(i => `• [${KIND_TXT[i.kind]}] ${i.title}${i.metric ? ` (${i.metric})` : ''}: ${i.detail}`).join('\n'));

    // ── Αγορά: πραγματικά τρέχοντα νούμερα (επιτόκια, ρεύμα) + σταθερή φορο-κλίμακα 2026.
    const mLines: string[] = [];
    if (rates?.euribor_3m != null) mLines.push(`Euribor 3 μηνών: ${fp(Number(rates.euribor_3m))} (ο δείκτης πάνω στον οποίο πατούν τα κυμαινόμενα επιτόκια στεγαστικών).`);
    if (rates?.bog_housing_new != null) mLines.push(`Μέσο επιτόκιο νέου στεγαστικού δανείου (στοιχεία Τράπεζας της Ελλάδος): περίπου ${fp(Number(rates.bog_housing_new))}.`);
    // ΤΟ ΕΥΡΟΣ ΤΙΜΩΝ ΡΕΥΜΑΤΟΣ ΕΦΥΓΕ ΚΑΙ ΕΙΝΑΙ ΚΕΡΔΟΣ.
    //
    // Διαβαζόταν από τον πίνακα `energy_tariffs`, που γέμιζε από χειρόγραφη
    // λίστα σφραγισμένη με τον ΤΡΕΧΟΝΤΑ μήνα — δηλαδή τιμές Ιουνίου
    // ανακοινώνονταν ως αυγουστιάτικες. Και συγκρινόταν ΜΟΝΟ η τιμή μονάδας:
    // χωρίς πάγιο, χωρίς κλιμάκια, χωρίς ρήτρα αναπροσαρμογής, χωρίς δέσμευση.
    // Το φθηνότερο kWh του καταλόγου ανήκε σε τιμολόγιο χωρίς πάγιο αλλά με
    // ρήτρα — δηλαδή ακριβώς εκείνο που ΔΕΝ είναι φθηνότερο στον λογαριασμό.
    //
    // Ο βοηθός δεν σιωπά: η οδηγία του λέει να στείλει στη ΡΑΑΕΥ, με την
    // πραγματική κατανάλωση του χρήστη στο χέρι.
    mLines.push(RENTAL_TAX_SUMMARY_2026);
    mLines.push(CLIMATE_LEVY_SUMMARY_2025);
    mLines.push(MUNICIPAL_ACCOM_SUMMARY);
    setMarketStr(mLines.join('\n'));

    // ── Πελατολόγιο: ρόστερ με ιστορικό. Το όνομα πάει στο μοντέλο, τηλέφωνο και ΑΦΜ μένουν εδώ ──
    const clientRoster = (clientRows || []) as ClientsRow[];
    setClientsLite(clientRoster.map(c => ({ id: c.id, name: c.full_name || '', phone: String(c.phone || ''), afm: String(c.afm || '') })));
    if (clientRoster.length) {
      const staysByClient = new Map<string, ClientStaysRow[]>();
      stays.forEach(s => { const a = staysByClient.get(s.client_id) || []; a.push(s); staysByClient.set(s.client_id, a); });
      const nowMs = Date.now();
      const revSince = (arr: ClientStaysRow[], days: number) => arr.reduce((s, st) => {
        const d = st.check_out || st.check_in; if (!d) return s;
        const t = new Date(d).getTime(); if (isNaN(t) || (nowMs - t) > days * 86400000 || t > nowMs) return s;
        return s + (Number(st.total) || (Number(st.nights) || 0) * (Number(st.nightly_rate) || 0));
      }, 0);
      const cLines = clientRoster.slice(0, 50).map(c => {
        const arr = staysByClient.get(c.id) || [];
        const cs = clientStats(arr);
        const lastBooking = arr.map(s => s.check_in).filter(Boolean).sort().slice(-1)[0] || null;
        const lastNote = arr.slice().sort((a, b) => String(a.check_in || '').localeCompare(String(b.check_in || ''))).map(s => s.notes).filter(n => n && String(n).trim()).slice(-1)[0];
        const bits: string[] = [c.full_name, CLIENT_TYPE_LABELS[c.type as ClientType] || c.type];

        if (cs.stayCount >= 2) bits.push('επαναλαμβανόμενος (2+ διαμονές)');
        // Ενδείξεις, όχι αριθμοί: τα τηλέφωνα και τα ΑΦΜ μένουν στη συσκευή (`lib/assistant/roster.ts`).
        bits.push(...contactFlags({ phone: String(c.phone || ''), afm: String(c.afm || '') }));

        if (cs.stayCount) bits.push(`${cs.stayCount} διαμονές, ${cs.nights} νύχτες, συνολικά έσοδα ${eur(cs.revenue)}`);
        if (cs.stayCount) bits.push(`έσοδα: τελευταίος μήνας ${eur(revSince(arr, 30))}, εξάμηνο ${eur(revSince(arr, 182))}, έτος ${eur(revSince(arr, 365))}`);
        if (lastBooking) bits.push(`τελευταία κράτηση ${lastBooking}`);
        if (cs.hasDamage) bits.push(`φθορές ${eur(cs.damageTotal)}`);

        if (c.budget) bits.push(`προϋπολογισμός ${eur(c.budget)}`);
        if (c.needs) bits.push(`ανάγκες: ${c.needs}`);
        if (lastNote) bits.push(`σημείωση τελευταίας διαμονής: «${String(lastNote).slice(0, 160)}»`);
        return `• ${bits.filter(Boolean).join(' · ')}`;
      });
      const extra = clientRoster.length > 50 ? `\n(και ${clientRoster.length - 50} ακόμη, δες την καρτέλα ${navLabel('clients')})` : '';
      setClientsStr(`Σύνολο πελατών: ${clientRoster.length}\n${cLines.join('\n')}${extra}`);
    } else setClientsStr('');

    // ── Επαφές τεχνικών/παρόχων (καρτέλα Επαφές): για να προτείνει ΠΟΙΟΝ
    // να καλέσει/προγραμματίσει για μια εργασία, ή να παραπέμψει αν λείπει ο ρόλος ──
    const techRoster = contacts.filter(c => c.full_name);
    setContactsLite(techRoster.map(c => ({ name: c.full_name || '', role: c.role || 'other', phone: String(c.phone || ''), email: String(c.email || '') })));
    if (techRoster.length) {
      const tLines = techRoster.slice(0, 60).map(c => {
        const bits = [c.full_name, roleLabel(c.role || 'other'), ...contactFlags({ phone: String(c.phone || ''), email: String(c.email || '') })];
        return `• ${bits.filter(Boolean).join(' · ')}`;
      });
      setTechStr(`Σύνολο επαφών: ${techRoster.length}\n${tLines.join('\n')}`);
    } else setTechStr('');
  }, [propertyId, userId, propContext, supabase, allProperties.length]);

  // Τα συμφραζόμενα φορτώνονται ΜΙΑ φορά, όταν ανοίξει το πάνελ. Μέσα από το
  // κοινό `useLoad`, γιατί είναι ασύγχρονη φόρτωση όπως κάθε άλλη.
  const bootContext = useCallback(async () => { if (open && !ctxStr) await loadContext(); }, [open, ctxStr, loadContext]);
  useLoad(bootContext);

  return {
    supabase, open, setOpen, fabPos, setFabPos, dragging, setDragging, scrolled, prefs, setPrefs,
    reconcile, setReconcile, editing, setEditing, msgs, setMsgs, input, setInput, busy, setBusy,
    consumedActions, setConsumedActions, feedbackOpen, setFeedbackOpen, answeredRef, nudgedRef,
    imgRef, err, setErr, limitMsg, setLimitMsg, errDetail, setErrDetail, quota, setQuota, ctxStr,
    setCtxStr, insightsStr, marketStr, clientsStr, setClientsStr, pricingStr, openerCtx, techStr,
    setMemories, memories, scrollRef, listeningRef, clientsLite, contactsLite, openBills, openRent,
    pendingDoc, setPendingDoc, askRef, allPropsContext, loadContext,
  }
}

export type AssistantCore = ReturnType<typeof useAssistant>
