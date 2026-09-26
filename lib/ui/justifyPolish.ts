// Η λογική του components/JustifyPolish.tsx, σε δικό της κομμάτι: φορτώνεται
// ΜΕΤΑ την πρώτη οθόνη, ώστε να μη βαραίνει το αρχικό JavaScript καμίας σελίδας.
import { breakCitations } from '@/lib/core/hyphenate';

// ΚΑΘΕ ΠΑΡΑΓΡΑΦΟΣ ΠΕΡΑ ΠΕΡΑ, ΑΠΟ ΟΠΟΥ ΚΙ ΑΝ ΗΡΘΕ Η ΣΤΟΙΧΙΣΗ. Οι κλάσεις
// (`po-just`, `data-ts`) δεν αρκούν: οι οδηγοί στοιχίζουν από το δικό τους CSS
// (`.gd .lg-p`) και έμεναν έξω, με κενό 3,4em στο κινητό.
const SEL = '.po-just, .po-just-c, [data-ts="j"], p, li, dd';
const SHY = /­/g;
/** Κενό (σε em) από το οποίο και πάνω το μάτι βλέπει τρύπα. */
const LIMIT = 0.55;
const TRIES: Array<[string, string]> = [
  ['-0.01em', ''], ['-0.02em', ''], ['', '-0.08em'], ['-0.01em', '-0.08em'],
  ['-0.03em', ''], ['0.01em', ''], ['0.02em', ''],
];

/** Το μεγαλύτερο κενό ανάμεσα σε λέξεις, σε em, χωρίς την τελευταία γραμμή. */
function worstGap(el: HTMLElement): number {
  const fs = parseFloat(getComputedStyle(el).fontSize) || 16;
  const lines = new Map<number, DOMRect[]>();
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const r = document.createRange();
  let n: Node | null;
  while ((n = tw.nextNode())) {
    const t = (n as Text).data;
    const re = /\S+/g; let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
      const box = r.getClientRects()[0];
      if (!box) continue;
      const k = Math.round(box.top);
      const row = lines.get(k); if (row) row.push(box); else lines.set(k, [box]);
    }
  }
  const keys = [...lines.keys()].sort((a, b) => a - b);
  keys.pop();
  let worst = 0;
  for (const k of keys) {
    const row = lines.get(k)!.sort((a, b) => a.left - b.left);
    for (let i = 1; i < row.length; i++) worst = Math.max(worst, (row[i].left - row[i - 1].right) / fs);
  }
  return worst;
}

export function polish(el: HTMLElement) {
  // Ζωντανές περιοχές: καμία αλλαγή κειμένου, ξαναδιαβάζονται (βλ. lib/ui/typeset.ts).
  if (el.closest('[role="alert"],[role="status"],[aria-live]')) return;
  if (!el.getClientRects().length || getComputedStyle(el).textAlign !== 'justify') return;
  const sig = `${Math.round(el.clientWidth)}:${(el.textContent || '').replace(SHY, '').length}`;
  if (el.dataset.jp === sig) return;
  el.dataset.jp = sig;
  // Η παραπομπή («ν.4223/2013») σπάει μετά την κάθετο (βλ. breakCitations).
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const t = n as Text, next = breakCitations(t.data);
    if (next !== t.data) t.data = next;
  }
  el.style.letterSpacing = ''; el.style.wordSpacing = '';
  const base = worstGap(el);
  if (base <= LIMIT) return;
  const h0 = el.offsetHeight;
  let best: [string, string] | null = null, bestGap = base;
  for (const [ls, ws] of TRIES) {
    el.style.letterSpacing = ls; el.style.wordSpacing = ws;
    if (el.offsetHeight > h0) continue;
    const g = worstGap(el);
    if (g < bestGap - 0.1) { best = [ls, ws]; bestGap = g; if (g <= LIMIT) break; }
  }
  el.style.letterSpacing = best ? best[0] : '';
  el.style.wordSpacing = best ? best[1] : '';
}


/** Ξεκινά την παρακολούθηση· επιστρέφει τη συνάρτηση που τη σταματά. */
export function start(): () => void {
    let timer = 0;
  const run = () => {
    timer = 0;
    document.querySelectorAll<HTMLElement>(SEL).forEach(polish);
  };
  // ΑΡΓΑ, ΟΧΙ ΜΕ ΚΑΘΕ ΑΛΛΑΓΗ. Η μέτρηση ζητά διάταξη· μαζεύεται και τρέχει
  // μία φορά όταν ησυχάσει η σελίδα.
  const later = () => { if (timer) clearTimeout(timer); timer = window.setTimeout(run, 400); };
  (document.fonts?.ready ?? Promise.resolve()).then(later);
  const mo = new MutationObserver(later);
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener('resize', later);
  // Ο,τι ανοίγει (<details>) δεν είχε διάταξη όσο ήταν κλειστό.
  document.addEventListener('toggle', later, true);
  return () => {
    mo.disconnect(); window.removeEventListener('resize', later);
    document.removeEventListener('toggle', later, true);
    if (timer) clearTimeout(timer);
  };
}
