// Η λογική του components/Typesetter.tsx. Ζει εδώ ώστε να τη φορτώνουν και οι
// δημόσιες σελίδες ΜΕΤΑ την πρώτη οθόνη (components/JustifyPolish.tsx), χωρίς
// να μπαίνει στο αρχικό τους πακέτο.
//
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΣΤΟΙΧΕΙΟΘΕΤΗΣ ΤΗΣ ΕΦΑΡΜΟΓΗΣ: ΠΕΡΑ ΠΕΡΑ, ΜΕ ΕΝΩΤΙΚΟ, ΣΕ ΚΑΘΕ ΠΑΡΑΓΡΑΦΟ
// ─────────────────────────────────────────────────────────────────────────
// ΑΠΟΦΑΣΗ ΙΔΙΟΚΤΗΤΗ, 26.09.2026: κάθε κείμενο που είναι παράγραφος ξεκινά και
// τελειώνει στις ίδιες δύο κατακόρυφες με το κουτί του και η λέξη που δεν
// χωρά κόβεται με ενωτικό. Στις δημόσιες σελίδες αυτό γίνεται στην απόδοση
// (components/Hyphen.tsx, `hy`)· μέσα στην εφαρμογή οι παράγραφοι είναι
// εκατοντάδες, σκορπισμένες σε δεκάδες καρτέλες και καμία λίστα με το χέρι
// δεν θα έπιανε όλες ούτε όσες γραφτούν αύριο.
//
// ΤΙ ΚΑΝΕΙ. Παρακολουθεί το `.app-content` (MutationObserver) και για κάθε
// μπλοκ που είναι ΠΑΡΑΓΡΑΦΟΣ:
//   1. βάζει μαλακά ενωτικά στα ελληνικά του, με τον ίδιο συλλαβιστή
//      (lib/core/hyphenate.ts), ώστε η στοίχιση να κλείνει με κοψίματα και όχι
//      με τεντωμένα κενά·
//   2. το σημαδεύει `data-ts="j"`, που στοιχίζει πέρα πέρα (globals.css).
//
// ΤΙ ΕΙΝΑΙ ΠΑΡΑΓΡΑΦΟΣ. Μπλοκ (όχι flex ή grid) με δικό του κείμενο τουλάχιστον
// MIN_CHARS χαρακτήρων, σε σώμα ως 18px, στοιχισμένο αριστερά. ΔΕΝ είναι:
// τίτλος, κουμπί, ετικέτα, πεδίο, πίνακας αριθμών, ό,τι είναι κεντραρισμένο ή
// δεξιά (το αποφάσισε κάποιος ρητά) και ό,τι δηλώσει `data-nohy`.
//
// ΓΙΑΤΙ ΔΕΝ ΣΠΑΕΙ ΤΟ REACT. Αλλάζει μόνο το `data` κόμβων κειμένου και ένα
// data-attribute που το React δεν γράφει ποτέ. Αν το React ξαναγράψει το
// κείμενο, ο παρατηρητής το ξαναπιάνει· η σύγκριση με το ήδη συλλαβισμένο
// κείμενο κρατά τον βρόχο κλειστό.
// ═══════════════════════════════════════════════════════════════════════════
import { hyphenate, breakCitations } from '@/lib/core/hyphenate';

const MIN_CHARS = 48;
const MIN_CPL = 44;
const WIDE_CPL = 60;
const SHY = /­/g;
// ΟΙ ΖΩΝΤΑΝΕΣ ΠΕΡΙΟΧΕΣ ΔΕΝ ΑΓΓΙΖΟΝΤΑΙ (role=alert/status, aria-live): αλλαγή
// κειμένου εκεί μπορεί να ξαναδιαβαστεί από αναγνώστη οθόνης. Το έπιασε το
// e2e-a11y στο μήνυμα της εγγραφής, όταν ο στοιχειοθέτης πέρασε στις δημόσιες σελίδες.
const SKIP = 'h1,h2,h3,h4,h5,h6,button,label,input,textarea,select,option,code,pre,svg,th,summary,[contenteditable],[data-nohy],[role="button"],[role="tab"],[role="menuitem"],.num,[role="alert"],[role="status"],[aria-live]';

function isProse(el: HTMLElement): boolean {
  // Δομικά στοιχεία δεν είναι ποτέ παράγραφος, ό,τι κι αν περιέχουν.
  if (/^(MAIN|SECTION|ARTICLE|BODY|HEADER|FOOTER|NAV|ASIDE)$/.test(el.tagName)) return false;
  if (el.closest(SKIP)) return false;
  const cs = getComputedStyle(el);
  if (cs.display !== 'block' && cs.display !== 'list-item') return false;
  if (cs.textAlign !== 'start' && cs.textAlign !== 'left' && cs.textAlign !== 'justify') return false;
  if (parseFloat(cs.fontSize) > 18) return false;
  if (cs.whiteSpace === 'nowrap' || cs.whiteSpace === 'pre') return false;
  // ΛΕΖΑΝΤΑ ΔΥΟ ΓΡΑΜΜΩΝ ΣΕ ΣΤΕΝΟ ΚΟΥΤΙ ΔΕΝ ΕΙΝΑΙ ΠΑΡΑΓΡΑΦΟΣ. Στο πλακίδιο
  // δεικτών χωρούν γύρω στους 40 χαρακτήρες τη γραμμή· εκεί κάθε ποσό
  // («505,51€») είναι λέξη που δεν κόβεται και η στοίχιση άνοιγε τα κενά σε
  // τρύπες. Πολύ στενό μέτρο δεν στοιχίζεται ποτέ· κείμενο κάτω από τρεις
  // γραμμές στοιχίζεται μόνο σε φαρδύ μέτρο. Η παράγραφος του κινητού (τρεις
  // γραμμές και πάνω, 46 ως 53 χαρακτήρες) στοιχίζεται κανονικά· η κάρτα στο
  // πάνελ της Νόας (41) μένει αριστερά.
  const fs = parseFloat(cs.fontSize);
  const cpl = el.clientWidth / (fs * 0.52);
  const lines = Math.round(el.clientHeight / (parseFloat(cs.lineHeight) || fs * 1.5));
  if (cpl < MIN_CPL || (lines < 3 && cpl < WIDE_CPL)) return false;
  let own = 0;
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === Node.TEXT_NODE) own += (n.textContent || '').trim().length;
    else if (n.nodeType === Node.ELEMENT_NODE) {
      const d = getComputedStyle(n as HTMLElement).display;
      // ΜΟΝΟ ΚΕΙΜΕΝΟ ΜΕΣΑ ΣΕ ΣΕΙΡΑ. Ο,τι δεν είναι inline (μπλοκ, πλέγμα,
      // πίνακας και το `contents` που κρύβει μπλοκ από κάτω του) σημαίνει ότι
      // το στοιχείο είναι δοχείο, όχι παράγραφος: με τον πίνακα η στοίχιση
      // περνούσε στα κελιά, με το `contents` σε ολόκληρο το `main`.
      if (d !== 'inline' && d !== 'inline-block' && d !== 'none') return false;
      own += ((n as HTMLElement).textContent || '').trim().length;
    }
  }
  return own >= MIN_CHARS;
}

function hyphenateTextIn(el: HTMLElement) {
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = tw.nextNode())) {
    const parent = (n as Text).parentElement;
    if (!parent || parent.closest(SKIP)) continue;
    const raw = (n as Text).data;
    const next = breakCitations(hyphenate(raw.replace(SHY, '')));
    if (next !== raw) (n as Text).data = next;
  }
}

function visit(el: HTMLElement) {
  if (!el.getClientRects().length) return;
  if (isProse(el)) {
    hyphenateTextIn(el);
    if (el.dataset.ts !== 'j') el.dataset.ts = 'j';
  } else if (el.dataset.ts === 'j') {
    // Άλλαξε το πλάτος και το κουτί δεν είναι πια παράγραφος: ξεστοιχίζεται.
    delete el.dataset.ts;
  }
}

function set(root: HTMLElement) {
  visit(root);
  root.querySelectorAll<HTMLElement>('p, li, dd, div, span').forEach(visit);
}

/** Ξεκινά τον στοιχειοθέτη στο `selector`· επιστρέφει τη συνάρτηση που τον σταματά. */
export function startTypesetter(selector: string): () => void {
  // ΜΟΝΟ Ο,ΤΙ ΑΛΛΑΞΕ. Μια πληκτρολόγηση σε πεδίο ξαναζωγραφίζει μια κάρτα, όχι
  // όλη την εφαρμογή· το πλήρες πέρασμα γίνεται μία φορά και στην αλλαγή
  // πλάτους, όπου μπορεί να αλλάξει ποιο κουτί είναι παράγραφος.
  const dirty = new Set<HTMLElement>();
  let pending = false;
  const inScope = (el: HTMLElement) => !!el.closest(selector);
  const run = () => {
    pending = false;
    const roots = [...dirty];
    dirty.clear();
    for (const el of roots) if (el.isConnected && inScope(el)) set(el);
  };
  const schedule = () => {
    if (pending) return;
    pending = true;
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(run, { timeout: 400 }); else setTimeout(run, 120);
  };
  const all = () => { document.querySelectorAll<HTMLElement>(selector).forEach(el => dirty.add(el)); schedule(); };
  all();
  const mo = new MutationObserver(records => {
    for (const r of records) {
      if (r.type === 'characterData') { const p = r.target.parentElement; if (p) dirty.add(p.parentElement || p); continue; }
      if (r.target instanceof HTMLElement) dirty.add(r.target);
    }
    schedule();
  });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener('resize', all);
  return () => { mo.disconnect(); window.removeEventListener('resize', all); };
}
