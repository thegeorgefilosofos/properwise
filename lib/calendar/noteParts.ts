// ═══════════════════════════════════════════════════════════════════════════
// Η ΣΗΜΕΙΩΣΗ ΜΙΑΣ ΠΡΟΘΕΣΜΙΑΣ, ΣΕ ΚΟΜΜΑΤΙΑ ΑΝΤΙ ΓΙΑ ΤΟΙΧΟ ΚΕΙΜΕΝΟΥ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΕΒΛΕΠΕ Ο ΙΔΙΟΚΤΗΤΗΣ (21/10/2026). Η επεξήγηση του «Τέλος ανθεκτικότητας
// κλιματικής κρίσης, απόδοση» ήταν μία παράγραφος: περιγραφή, ωμές διευθύνσεις
// («(https://www.aade.gr/eforologiko-imerologio) και στο https://www.taxheaven.gr/
// calendar»), «Ποιος το κάνει: …», «Σταθερή προθεσμία…», «Πού γίνεται: myAADE ·
// … · …», όλα κολλητά.
//
// ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΗΝ ΠΗΓΗ. Η σημείωση γράφεται μία φορά από το
// lib/tax/greekTaxCalendar.ts και ταξιδεύει ως έχει στο .ics, στην εκτύπωση και
// στο Excel, όπου πρέπει να μένει πρόταση. Οι σημειώσεις που έχουν ήδη
// αποθηκευτεί στη βάση έχουν και την παλιά μορφή, με τις διευθύνσεις μέσα στο
// κείμενο. Η οθόνη λοιπόν διαβάζει ό,τι υπάρχει και το χωρίζει: σημάδια που
// γράφει η πηγή («Ποιος το κάνει:», «Πού γίνεται:», οι δύο φράσεις βεβαιότητας)
// και διευθύνσεις που γίνονται σύνδεσμοι με όνομα.
// ═══════════════════════════════════════════════════════════════════════════
import { CONFIDENCE_HINT } from '@/lib/tax/greekTaxCalendar';

export interface NoteLink { label: string; href: string }

export interface NoteParts {
  /** Η περιγραφή, χωρίς διευθύνσεις και χωρίς τα σημάδια. */
  summary: string;
  /** «Ο λογιστής», «Εσύ»… */
  who: string | null;
  /** Τα βήματα της διαδρομής: «myAADE», «Φορολογικές Υπηρεσίες», … */
  where: string[];
  /** Ημερομηνία του νόμου ή περυσινή που ανακοινώνεται ξανά. */
  deadline: 'statutory' | 'announced' | null;
  links: NoteLink[];
}

const HOST_LABEL: [RegExp, string][] = [
  [/(^|\.)myaade\.gov\.gr$/, 'myAADE'],
  [/(^|\.)aade\.gr$/, 'ΑΑΔΕ'],
  [/(^|\.)taxheaven\.gr$/, 'Taxheaven'],
  [/(^|\.)gov\.gr$/, 'gov.gr'],
];

/** Όνομα για τον σύνδεσμο: ποτέ η ίδια η διεύθυνση. */
export function linkLabel(href: string): string {
  let host = '';
  try { host = new URL(href).hostname.toLowerCase(); } catch { return 'Πηγή'; }
  for (const [re, label] of HOST_LABEL) if (re.test(host)) return label;
  return host.replace(/^www\./, '');
}

const URL_RE = /https?:\/\/[^\s<>"')]+/g;
const WHO_RE = /Ποιος το κάνει:\s*([^.]+)\.?/;
const WHERE_RE = /Πού γίνεται:\s*([^]*?)\.?\s*$/;

export function noteParts(notes: string | null | undefined): NoteParts {
  let text = (notes || '').replace(/\s+/g, ' ').trim();
  const out: NoteParts = { summary: '', who: null, where: [], deadline: null, links: [] };
  if (!text) return out;

  // Διευθύνσεις: σύνδεσμοι με όνομα, μία φορά η καθεμία.
  const seen = new Set<string>();
  for (const raw of text.match(URL_RE) || []) {
    const href = raw.replace(/[.,;:]+$/, '');
    if (seen.has(href)) continue;
    seen.add(href);
    out.links.push({ label: linkLabel(href), href });
  }
  // Η πρόταση που υπήρχε μόνο για να δείξει τη διεύθυνση («Δες στο φορολογικό
  // ημερολόγιο (…) και στο …») φεύγει ολόκληρη: οι πηγές λέγονται από κάτω.
  text = text.split(/(?<=[.;])\s+/).filter(s => !/https?:\/\//.test(s)).join(' ');
  text = text.replace(URL_RE, ' ');

  const where = text.match(WHERE_RE);
  if (where) {
    out.where = where[1].split(/\s*(?:·|→|›)\s*/).map(s => s.trim()).filter(Boolean);
    text = text.slice(0, where.index) + text.slice(where.index! + where[0].length);
  }
  const who = text.match(WHO_RE);
  if (who) {
    out.who = who[1].trim();
    text = text.replace(who[0], ' ');
  }
  for (const key of ['statutory', 'announced'] as const) {
    const hint = CONFIDENCE_HINT[key];
    if (text.includes(hint)) { out.deadline = key; text = text.replace(hint, ' '); }
  }

  // Ό,τι έμεινε από τις διευθύνσεις: άδειες παρενθέσεις και προθέσεις που
  // έδειχναν πια στο πουθενά («… στο ( ) και στο .»).
  out.summary = text
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s+(?:και\s+)?(?:στο|στη|στην|στον|από|σε)\s*(?=[.,;:]|$)/g, '')
    .replace(/\s+και\s*(?=[.,;:]|$)/g, '')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/([.,;:])(?:\s*[.,;:])+/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s.,;:]+/, '')
    .trim();
  return out;
}
