'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΜΟΝΤΕΛΟ ΤΗΣ ΝΟΑΣ: ΤΥΠΟΙ, ΜΗΝΥΜΑΤΑ, ΕΝΕΡΓΕΙΕΣ, ΘΕΣΗ ΤΟΥ ΚΟΥΜΠΙΟΥ
// ─────────────────────────────────────────────────────────────────────────
// Τι παίρνει η Νόα από τη σελίδα, πώς μοιάζει ένα μήνυμα και μια ενέργεια,
// οι μικροί βοηθοί κειμένου και η γεωμετρία του πλωτού κουμπιού.
// ═══════════════════════════════════════════════════════════════════════════
import { feAuto, feOr } from '@/components/Theme'
import { type Memory, type AssistantAction, NAV_MAP } from '../assistantPersona'
import { RECONCILE_NONE_LABEL } from '../scanDoc'
import type { PropertyStatus } from '@/lib/facts/status';

interface PropContext {
  name: string; propType?: string; address?: string; value?: number; sqm?: number; status?: string; targetRent?: number;
  /** Η αντικειμενική αξία ολόκληρου του ακινήτου· από αυτήν βγαίνει η εκτίμηση ΕΝΦΙΑ. */
  objValue?: number;
  /** Η κατάσταση ως κλειδί (lib/facts/status.ts): κρίνει αν υπάρχουν έσοδα ενοικίου και απόδοση. */
  statusKey?: PropertyStatus;
  /** Για τον ΕΝΦΙΑ του έτους (lib/facts/enfia.ts), ο ίδιος με την Επισκόπηση και τη Λογιστική. */
  enfia?: number; yearBuilt?: number; floor?: string | number; ownership?: number; postalCode?: string;
}
interface PropSummary { name: string; propType?: string; value?: number; targetRent?: number; sqm?: number; status?: string; }
export interface Props {
  propertyId: string; userId: string; propContext: PropContext; allProperties?: PropSummary[];
  onNavigate: (tab: string) => void; onScan: () => void;
  /**
   * Αν η καρτέλα είναι ΟΝΤΩΣ προσβάσιμη για αυτό το ακίνητο.
   *
   * ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΚΛΕΙΝΕΙ: το `onNavigate` του γονέα αγνοεί σιωπηλά όσες
   * καρτέλες κρύβει η ορατότητα. Το κουμπί «Πήγαινε: …» γκρίζαρε σαν να
   * χρησιμοποιήθηκε — και η οθόνη έμενε ίδια. Ο χρήστης πατούσε ξανά, το κουμπί
   * ήταν ήδη «χρησιμοποιημένο» και δεν είχε κανέναν τρόπο να καταλάβει γιατί.
   * Τώρα η υπόσχεση δεν γράφεται καν όταν δεν μπορεί να τηρηθεί.
   */
  canNavigate?: (tab: string) => boolean;
  /**
   * Το όνομα του πακέτου που ΙΣΧΥΕΙ τώρα (δοκιμή, προσφορά ή συνδρομή μαζί).
   *
   * Το prompt δηλώνει «Ξέρεις ακριβώς τι καλύπτει το πλάνο του χρήστη» και δεν
   * του δινόταν ποτέ. Το υπολογίζει ήδη η σελίδα με το `effectivePlan`· εδώ
   * απλώς ταξιδεύει μαζί με τα υπόλοιπα συμφραζόμενα.
   */
  planBrief?: string;
  /**
   * Το πακέτο που ισχύει δεν έχει τη Νόα (ο δωρεάν «Ιδιοκτήτης»). Η ερώτηση
   * δεν φεύγει καν προς τον διακομιστή: η απάντηση λέει πού υπάρχει ο βοηθός
   * και ανοίγει τις Ρυθμίσεις, όπου αλλάζει το πακέτο.
   */
  assistantLocked?: boolean;
}
export type Action = AssistantAction;
export interface Msg { role: 'user' | 'assistant'; text: string; action?: Action; }
// Σύστημα αναγνώρισης αντικειμένου από φωτο (συσκευασία/ετικέτα/booklet/απόδειξη).
// ΤΟ ΠΑΡΑΣΤΑΤΙΚΟ ΕΦΥΓΕ ΑΠΟ ΕΔΩ. Αυτό το prompt διάβαζε ΚΑΙ αποδείξεις, δηλαδή
// ήταν δεύτερος αναγνώστης παραστατικών δίπλα στον κανονικό (scanDoc) — με
// λιγότερα πεδία, χωρίς πάροχο, χωρίς περίοδο, χωρίς ΑΦΜ εκδότη. Ακριβώς τα
// πεδία που χρειάζεται η συμφωνία με εκκρεμή λογαριασμό. Τώρα διαβάζει μόνο
// αυτό που ο άλλος δεν κάνει: τι συσκευή δείχνει η φωτογραφία.
export const IMG_ITEM_SCAN_SYSTEM = `Είσαι σύστημα αναγνώρισης ΑΝΤΙΚΕΙΜΕΝΟΥ από φωτογραφία, για την απογραφή ενός ακινήτου. Επίστρεψε ΑΥΣΤΗΡΑ ΜΟΝΟ JSON:
{"name":"","brand":"","model":"","category":"<μία από: Έπιπλα, Ηλεκτρικές Συσκευές, Ηλεκτρονικά, Υδραυλικά, Θέρμανση & Ψύξη, Φωτιστικά, Διακόσμηση, Λοιπά>","price":"ακέραιος αριθμός ευρώ χωρίς σύμβολα ή κενό","warranty_expiry":"YYYY-MM-DD ή κενό"}
Το name περιγραφικό (π.χ. «Πλυντήριο Bosch WAU28»). Άφησε κενά όσα δεν διακρίνονται. Χωρίς κείμενο εκτός JSON.`
// Ελαφρύ ευρετήριο πελατών, ώστε να βρίσκει από όνομα/τηλέφωνο/ΑΦΜ.
export type ClientLite = { id: string; name: string; phone: string; afm: string };
// Ελαφρύ ευρετήριο επαφών (τεχνικοί/πάροχοι) για επικοινωνία (WhatsApp/Viber/email/κλήση).
export type ContactLite = { name: string; role: string; phone: string; email: string };

// Ο άγνωστος αριθμός γράφεται 0,00€, όχι παύλα: η παύλα δεν στοιχίζεται με
// τίποτα και σε στήλη ποσών διαβάζεται ως σφάλμα (lib/core/format.ts).
export const eur = (n?: number | null) => n == null ? feOr(null) : feAuto(n);
// Η ερώτηση συμφωνίας σε μία πρόταση. Οι ίδιοι λόγοι που δείχνει και η οθόνη
// σάρωσης — δεν εφευρίσκεται δεύτερη διατύπωση για την ίδια απόφαση.
export const reconcilePrompt = (q: { question: string; options: { label: string; reasons: string[] }[] }): string =>
  `${q.question} Βρήκα ${q.options.length === 1 ? 'έναν λογαριασμό που ταιριάζει' : `${q.options.length} λογαριασμούς που ταιριάζουν`}. Διάλεξε παρακάτω, ή «${RECONCILE_NONE_LABEL}» για νέα εγγραφή.`;
export const navLabel = (id: string) => NAV_MAP.find(n => n.id === id)?.label || id;
export const onlyDigits = (p: string) => (p || '').replace(/\D/g, '');
// Ετικέτα κουμπιού επικοινωνίας ανά κανάλι (χωρίς emoji, ελληνικά).
export const reachLabel = (ch: 'whatsapp' | 'viber' | 'email' | 'call', name: string) =>
  ch === 'call' ? `Κλήση ${name}`
    : ch === 'email' ? `Email προς ${name}`
    : ch === 'viber' ? `Άνοιγμα Viber προς ${name}`
    : `Άνοιγμα WhatsApp προς ${name}`;
export const CH_HUMAN: Record<'whatsapp' | 'viber' | 'email' | 'call', string> = { whatsapp: 'WhatsApp', viber: 'Viber', email: 'email', call: 'κλήση' };


// Σταθερή αναφορά για «καμία μνήμη».
export const NO_MEMORIES: Memory[] = [];

// ── ΤΟ ΠΛΩΤΟ ΚΟΥΜΠΙ: ΥΨΟΣ ΚΑΙ ΓΩΝΙΑ, ΕΞΩ ΑΠΟ ΤΟ COMPONENT ──────────────────
// Δεν διαβάζουν ούτε μία τιμή του component, οπότε γραμμένα μέσα του ήταν
// ΚΑΙΝΟΥΡΓΙΕΣ συναρτήσεις σε κάθε απόδοση: τρία useEffect τις κρατούσαν στις
// εξαρτήσεις τους και ο κανόνας των hooks το φώναζε. Εδώ γράφονται μία φορά.

// Εφεδρικό ύψος, όταν το κουμπί δεν έχει αποδοθεί ακόμη. Η ΠΗΓΗ είναι το
// `--fab-h` στο globals.css, γιατί την ίδια τιμή χρειάζεται και το κάτω
// περιθώριο του .app-content που κρατά το περιεχόμενο μακριά από εδώ.
export const FAB_H = 52;

/** Η θέση ανάπαυσης του κουμπιού, όπως τη λέει το CSS αυτής της οθόνης. */
const fabHome = () => {
  const probe = document.createElement('div');
  probe.className = 'pa-fab-home';
  document.body.appendChild(probe);
  const r = probe.getBoundingClientRect();
  probe.remove();
  return { side: window.innerWidth - r.right, bottom: window.innerHeight - r.bottom };
};

// Η ΓΩΝΙΑ ΜΕΤΡΙΕΤΑΙ, ΔΕΝ ΜΑΝΤΕΥΕΤΑΙ. Πρώτη γραφή: `parseFloat` πάνω στο
// `--float-bottom`. Στο κινητό η τιμή είναι `calc(82px + env(...) + …)` και το
// `parseFloat` επιστρέφει NaN, οπότε έπεφτε στα 24 — το κουμπί κούμπωνε 58
// εικονοστοιχεία ΧΑΜΗΛΟΤΕΡΑ από το σπίτι του, πάνω στην κάτω πλοήγηση. Δηλαδή
// το κούμπωμα προκαλούσε ακριβώς το σφάλμα που ήρθε να λύσει. Μόνο ο πάγκος
// αφής με αληθινά αγγίγματα το είδε.
export const snapCorner = (x: number, w: number) => {
  if (typeof window === 'undefined') return null;
  const { side, bottom } = fabHome();
  const vw = window.innerWidth, vh = window.innerHeight;
  const right = x + w / 2 > vw / 2;
  return { x: right ? vw - w - side : side, y: vh - FAB_H - bottom };
};
