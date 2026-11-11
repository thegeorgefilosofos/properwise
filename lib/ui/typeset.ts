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
import { hyphenate, bindRefs } from '@/lib/core/hyphenate';

const MIN_CHARS = 48;
const MIN_CPL = 44;
const WIDE_CPL = 60;
const SHY = /­/g;
// ΟΙ ΖΩΝΤΑΝΕΣ ΠΕΡΙΟΧΕΣ ΔΕΝ ΑΓΓΙΖΟΝΤΑΙ (role=alert/status, aria-live): αλλαγή
// κειμένου εκεί μπορεί να ξαναδιαβαστεί από αναγνώστη οθόνης. Το έπιασε το
// e2e-a11y στο μήνυμα της εγγραφής, όταν ο στοιχειοθέτης πέρασε στις δημόσιες σελίδες.
const SKIP = 'h1,h2,h3,h4,h5,h6,button,label,input,textarea,select,option,code,pre,svg,th,summary,[contenteditable],[data-nohy],[role="button"],[role="tab"],[role="menuitem"],.num,[role="alert"],[role="status"],[aria-live]';
// ΚΑΙ ΜΕΣΑ ΣΕ ΣΥΝΔΕΣΜΟ ΔΕΝ ΣΤΟΙΧΕΙΟΘΕΤΕΙΤΑΙ ΤΙΠΟΤΑ (01.10.2026). Μπλοκ μέσα σε
// `<a>` είναι κάρτα, όχι παράγραφος: οι περιγραφές του ευρετηρίου των οδηγών
// (/odigos) γράφονται ΣΚΟΠΙΜΑ με ελεύθερη δεξιά άκρη (app/odigos/page.tsx) και
// ο στοιχειοθέτης τις ξαναστοίχιζε και τις έκοβε («διανυκτέρευ-ση,»).
const SKIP_BLOCK = SKIP + ',a';
// Ο σύνδεσμος μέσα στην παράγραφο μένει ακέραιος και το έντονο κόβεται μόνο
// σε μακριές λέξεις, όπως και στο `hy()` (components/Hyphen.tsx).
const SKIP_TEXT = SKIP + ',a';
const BOLD = 'strong,b';
const BOLD_MIN_WORD = 8;

/**
 * ΓΡΑΜΜΗ ΣΤΟΙΧΕΙΩΝ, ΟΧΙ ΠΑΡΑΓΡΑΦΟΣ (04.10.2026). «ΠΡΑΣΙΝΟ · 0,129€ ανά
 * κιλοβατώρα · Χωρίς πάγιο · Τιμή Αυγούστου 2026» είναι κομμάτια που ο
 * αναγνώστης σαρώνει ένα ένα. Σε tablet μέσα από το Instagram το πλάτος
 * περνούσε το όριο της παραγράφου και η στοίχιση πέρα πέρα άνοιγε τα κενά
 * ανάμεσα στα κομμάτια σε τρύπες. Δύο τελείες στο μέσο αρκούν: μια πρόταση
 * δεν χωρίζεται έτσι.
 */
export function isFactsLine(text: string): boolean {
  return (text.match(/ · /g) || []).length >= 2;
}

/** Το δικό του κείμενο, ή −1 αν έχει παιδί που δεν είναι μέσα στη σειρά (δοχείο). */
function ownText(el: HTMLElement): number {
  let own = 0;
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === Node.TEXT_NODE) own += (n.textContent || '').trim().length;
    else if (n.nodeType === Node.ELEMENT_NODE) {
      const d = getComputedStyle(n as HTMLElement).display;
      // ΜΟΝΟ ΚΕΙΜΕΝΟ ΜΕΣΑ ΣΕ ΣΕΙΡΑ. Ο,τι δεν είναι inline (μπλοκ, πλέγμα,
      // πίνακας και το `contents` που κρύβει μπλοκ από κάτω του) σημαίνει ότι
      // το στοιχείο είναι δοχείο, όχι παράγραφος: με τον πίνακα η στοίχιση
      // περνούσε στα κελιά, με το `contents` σε ολόκληρο το `main`.
      if (d !== 'inline' && d !== 'inline-block' && d !== 'none') return -1;
      own += ((n as HTMLElement).textContent || '').trim().length;
    }
  }
  return own;
}

function isProse(el: HTMLElement): boolean {
  // Δομικά στοιχεία δεν είναι ποτέ παράγραφος, ό,τι κι αν περιέχουν.
  if (/^(MAIN|SECTION|ARTICLE|BODY|HEADER|FOOTER|NAV|ASIDE)$/.test(el.tagName)) return false;
  // ΠΡΩΤΑ ΟΙ ΦΘΗΝΟΙ ΕΛΕΓΧΟΙ (11/11/2026). Οι όροι είναι όλοι «και» και κανένας
  // δεν γράφει τίποτα, οπότε η σειρά δεν αλλάζει την απάντηση· αλλάζει μόνο το
  // κόστος. Πρώτα έτρεχε το `textContent` ολόκληρου του υποδέντρου και το
  // `closest` με τριάντα επιλογείς, για ΚΑΘΕ div της σελίδας: σε χαρτοφυλάκιο
  // διακοσίων ακινήτων, σε κινητό με επεξεργαστή /4, ένα πέρασμα κρατούσε το
  // κύριο νήμα 400 χιλιοστά. Ενα δοχείο απορρίπτεται στο πρώτο παιδί-μπλοκ.
  const own = ownText(el);
  if (own < MIN_CHARS) return false;
  if (el.closest(SKIP_BLOCK)) return false;
  if (isFactsLine(el.textContent || '')) return false;
  const cs = getComputedStyle(el);
  // ΚΕΦΑΛΑΙΑ ΑΠΟ ΤΟ CSS: ΕΤΙΚΕΤΑ, ΟΧΙ ΠΑΡΑΓΡΑΦΟΣ. Το «ΡΕΥΜΑ-ΤΟΣ» της ζώνης
  // μετρήσεων ήταν πεζά στην πηγή, άρα ο συλλαβιστής δεν το αναγνώριζε ως
  // αρκτικόλεξο (ALL_CAPS) και το έκοβε.
  if (cs.textTransform === 'uppercase') return false;
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
  return cpl >= MIN_CPL && (lines >= 3 || cpl >= WIDE_CPL);
}

function hyphenateTextIn(el: HTMLElement) {
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = tw.nextNode(); n; n = tw.nextNode()) nodes.push(n as Text);
  // Η ΤΕΛΕΥΤΑΙΑ ΛΕΞΗ ΤΗΣ ΠΑΡΑΓΡΑΦΟΥ ΔΕΝ ΑΦΗΝΕΙ ΘΡΑΥΣΜΑ (βλ. `keepLast`): ζει στον
  // τελευταίο κόμβο κειμένου που έχει γράμμα ή ψηφίο.
  let last = -1;
  nodes.forEach((n, i) => { if (/[\p{L}\p{N}]/u.test(n.data)) last = i; });
  nodes.forEach((n, i) => {
    const parent = n.parentElement;
    if (!parent || parent.closest(SKIP_TEXT)) return;
    const raw = n.data;
    const minWord = parent.closest(BOLD) ? BOLD_MIN_WORD : undefined;
    const next = hyphenate(bindRefs(raw.replace(SHY, '')), { keepLast: i === last, minWord });
    if (next !== raw) n.data = next;
  });
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

// ═══ ΕΝΑΣ ΣΤΟΙΧΕΙΟΘΕΤΗΣ, ΣΕ ΚΟΜΜΑΤΙΑ, ΜΟΝΟ ΣΤΗΝ ΑΛΛΑΓΗ ΠΛΑΤΟΥΣ (11/11/2026) ═══
// ΤΙ ΜΕΤΡΗΘΗΚΕ, σε κινητό με επεξεργαστή /4 και αφή:
//   · ΚΑΘΕ `resize` ξανάτρεχε όλη τη σελίδα. Στο τηλέφωνο το `resize` έρχεται
//     κάθε φορά που η μπάρα διευθύνσεων μαζεύεται ή ανοίγει, δηλαδή σε κάθε
//     αλλαγή φοράς της κύλισης. Στην αρχική 60 ως 77 χιλιοστά, στο
//     χαρτοφυλάκιο των διακοσίων ακινήτων 200 ως 420, κάθε φορά. Το πλάτος
//     όμως δεν άλλαζε· και η αλλαγή γραμμής εξαρτάται μόνο από το πλάτος.
//   · Στον πίνακα έτρεχαν ΔΥΟ στοιχειοθέτες στο ίδιο δέντρο: ένας στο
//     `.app-content` (Typesetter) και ένας στο `main` (JustifyPolish), που το
//     περιέχει. Ο,τι άλλαζε κρινόταν δύο φορές.
//   · Ολο το πέρασμα γινόταν σε μία εργασία, οπότε ένα άγγιγμα την ώρα που
//     έτρεχε περίμενε να τελειώσει.
// ΤΩΡΑ: ένας παρατηρητής για όλα τα πεδία, πέρασμα στην αλλαγή ΠΛΑΤΟΥΣ μόνο και
// δουλειά σε κομμάτια των SLICE_MS, με επιστροφή στον περιηγητή ανάμεσα.
const SLICE_MS = 8;
const scopes = new Map<string, number>();
const dirty = new Set<HTMLElement>();
const work: HTMLElement[] = [];
let mo: MutationObserver | null = null;
let pending = false;
let lastWidth = 0;
const scopeSel = () => [...scopes.keys()].join(',');
const inScope = (el: HTMLElement) => scopes.size > 0 && !!el.closest(scopeSel());

function expand() {
  // Ο ίδιος κόμβος μία φορά, ακόμη κι αν βρίσκεται κάτω από δύο βρώμικες ρίζες.
  const seen = new Set<HTMLElement>(work);
  for (const root of dirty) {
    if (!root.isConnected || !inScope(root)) continue;
    if (!seen.has(root)) { seen.add(root); work.push(root); }
    root.querySelectorAll<HTMLElement>('p, li, dd, div, span').forEach(el => {
      if (!seen.has(el)) { seen.add(el); work.push(el); }
    });
  }
  dirty.clear();
}

function run() {
  pending = false;
  expand();
  const until = performance.now() + SLICE_MS;
  let i = 0;
  // Τουλάχιστον ένα στοιχείο ανά κομμάτι, ώστε η ουρά να αδειάζει πάντα.
  do { const el = work[i++]; if (el?.isConnected) visit(el); } while (i < work.length && performance.now() < until);
  work.splice(0, i);
  if (work.length || dirty.size) schedule();
}

function schedule() {
  if (pending) return;
  pending = true;
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(run, { timeout: 400 }); else setTimeout(run, 120);
}

function all() {
  if (scopes.size) document.querySelectorAll<HTMLElement>(scopeSel()).forEach(el => dirty.add(el));
  schedule();
}

function onResize() {
  if (window.innerWidth === lastWidth) return;
  lastWidth = window.innerWidth;
  all();
}

/** Ξεκινά τον στοιχειοθέτη στο `selector`· επιστρέφει τη συνάρτηση που τον σταματά. */
export function startTypesetter(selector: string): () => void {
  // ΜΟΝΟ Ο,ΤΙ ΑΛΛΑΞΕ. Μια πληκτρολόγηση σε πεδίο ξαναζωγραφίζει μια κάρτα, όχι
  // όλη την εφαρμογή· το πλήρες πέρασμα γίνεται μία φορά και στην αλλαγή
  // πλάτους, όπου μπορεί να αλλάξει ποιο κουτί είναι παράγραφος.
  scopes.set(selector, (scopes.get(selector) || 0) + 1);
  if (!mo) {
    lastWidth = window.innerWidth;
    mo = new MutationObserver(records => {
      for (const r of records) {
        if (r.type === 'characterData') { const p = r.target.parentElement; if (p) dirty.add(p.parentElement || p); continue; }
        if (r.target instanceof HTMLElement) dirty.add(r.target);
      }
      schedule();
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', onResize);
  }
  document.querySelectorAll<HTMLElement>(selector).forEach(el => dirty.add(el));
  schedule();
  return () => {
    const n = (scopes.get(selector) || 1) - 1;
    if (n > 0) scopes.set(selector, n); else scopes.delete(selector);
    if (scopes.size || !mo) return;
    mo.disconnect(); mo = null;
    window.removeEventListener('resize', onResize);
    dirty.clear(); work.length = 0;
  };
}
