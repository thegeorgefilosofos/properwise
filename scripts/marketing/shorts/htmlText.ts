// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΚΕΙΜΕΝΟ ΠΟΥ ΔΙΑΒΑΖΕΙ Ο ΘΕΑΤΗΣ, ΧΩΡΙΣ ΚΑΝΟΝΙΚΕΣ ΕΚΦΡΑΣΕΙΣ ΑΠΟΚΟΠΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Οι πύλες «κάθε ψηφίο από γεγονός» και «καμία επανάληψη του χθεσινού»
// κρίνουν το ορατό κείμενο κάθε σκηνής και story. Ως τις 12/10/2026 το
// έβγαζαν με `replace(/<style[\s\S]*?<\/style>/g, '')` και αποκωδικοποίηση
// οντοτήτων στη σειρά. Το CodeQL του #392 βρήκε τρία προβλήματα:
//   · η έκφραση δεν πιάνει «<SCRIPT>» ή «</style >» και μια φωλιασμένη μορφή
//     («<scr<script></script>ipt>») αφήνει πίσω της νέο «<script»
//   · το `&amp;` πρώτο και μετά το `&lt;` κάνει το «&amp;lt;» «<», δηλαδή
//     διπλή αποκωδικοποίηση
// Τα σενάρια τρέχουν μόνο τοπικά, πάνω σε HTML που φτιάχνουμε εμείς. Αλλά μια
// πύλη που διαβάζει λάθος κείμενο κρίνει λάθος, οπότε η αφαίρεση γίνεται εδώ
// με σάρωση χαρακτήρων και η αποκωδικοποίηση σε ένα πέρασμα.
// ═══════════════════════════════════════════════════════════════════════════

const RAW = ['style', 'script'] as const;

/** Η πρώτη θέση από `from` όπου ανοίγει `<style` ή `<script` ως ετικέτα, ή -1. */
function nextRawOpen(low: string, from: number): { at: number; tag: string } | null {
  let best: { at: number; tag: string } | null = null;
  for (const tag of RAW) {
    let at = low.indexOf('<' + tag, from);
    // «<styles>» ή «<scripted>» δεν είναι η ετικέτα· ψάχνει την επόμενη.
    while (at >= 0 && /[a-z0-9-]/.test(low.charAt(at + 1 + tag.length))) at = low.indexOf('<' + tag, at + 1);
    if (at >= 0 && (!best || at < best.at)) best = { at, tag };
  }
  return best;
}

/** Ένα πέρασμα αφαίρεσης· το `withoutRawBlocks` το επαναλαμβάνει. */
function rawBlocksOnce(html: string): string {
  const low = html.toLowerCase();
  let out = '';
  let i = 0;
  for (;;) {
    const open = nextRawOpen(low, i);
    if (!open) return out + html.slice(i);
    out += html.slice(i, open.at);
    const close = low.indexOf('</' + open.tag, open.at);
    if (close < 0) return out;
    const end = low.indexOf('>', close);
    if (end < 0) return out;
    i = end + 1;
  }
}

/**
 * Το HTML χωρίς τα μπλοκ `<style>…</style>` και `<script>…</script>`, με
 * οποιαδήποτε κεφαλαία και κενά πριν από το `>`. Ό,τι μένει ανοιχτό χωρίς
 * κλείσιμο κόβεται ως το τέλος: καλύτερα λιγότερο κείμενο παρά κώδικας ως
 * κείμενο. Επαναλαμβάνεται ώσπου να μην αλλάζει τίποτα, γιατί η αφαίρεση του
 * «<script></script>» μέσα στο «<scr<script></script>ipt>» αφήνει νέο
 * «<script>».
 */
export function withoutRawBlocks(html: string): string {
  let prev: string;
  let cur = html;
  do { prev = cur; cur = rawBlocksOnce(prev); } while (cur !== prev);
  return cur;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', '#39': "'" };

/** Οι οντότητες που γράφει η μηχανή, σε ΕΝΑ πέρασμα: το «&amp;lt;» μένει «&lt;». */
export const decodeEntities = (s: string): string =>
  s.replace(/&(amp|lt|gt|quot|nbsp|#39);/g, (_, e: string) => ENTITIES[e]);

/** Ό,τι διαβάζει ο θεατής: χωρίς στυλ, σενάρια και ετικέτες, με κενά αντί για ετικέτες. */
export function visibleText(html: string): string {
  const body = withoutRawBlocks(html);
  let out = '';
  let inTag = false;
  for (const ch of body) {
    if (inTag) { if (ch === '>') { inTag = false; out += ' '; } continue; }
    if (ch === '<') { inTag = true; continue; }
    out += ch;
  }
  return decodeEntities(out).replace(/\s+/g, ' ');
}
