// ═══════════════════════════════════════════════════════════════════════════
// Ε9 Ή ΠΡΑΞΗ ΕΝΦΙΑ ΑΠΟ ΦΩΤΟΓΡΑΦΙΑ: ΤΟ PROMPT ΚΑΙ Ο ΑΥΣΤΗΡΟΣ ΕΛΕΓΧΟΣ ΤΗΣ ΑΠΑΝΤΗΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Απόφαση ιδιοκτήτη (09/11/2026): η φωτογραφία του Ε9 ή της πράξης διαβάζεται
// με AI στον διακομιστή, μέσα από τη σάρωση της εφαρμογής (scanDoc.ts →
// /api/anthropic). Η εικόνα δεν αποθηκεύεται. Η απάντηση ΔΕΝ γράφεται ποτέ
// κατευθείαν: περνά από εδώ, γίνεται το ίδιο `MyAadeImport` με το PDF και ο
// χρήστης τη βλέπει στην ίδια προεπισκόπηση πριν από κάθε καταχώρηση.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ. Κάθε πεδίο ξαναδιαβάζεται με τη δική του μορφή: ΑΤΑΚ μόνο με
// 11 ψηφία, Τ.Κ. με πέντε, επιφάνεια και ποσοστό σε λογικά όρια, έτος ως το
// τρέχον. Ό,τι δεν στέκει γίνεται `null` και η γραμμή θέλει έλεγχο. Άλλο
// έγγραφο (π.χ. Ε1) επιστρέφει `unrecognized` με λόγο, όχι άδεια λίστα.
// ═══════════════════════════════════════════════════════════════════════════
import { plural } from '@/lib/core/greek';
import { ATAK_DIGITS } from '@/lib/property/atak';
import { INCOME_TAX_REASON } from './parse';
import type { MyAadeImport, MyAadeParse, MyAadeProperty } from './types';

/** Πόσα ακίνητα ζητάμε από μία φωτογραφία: όσα χωρούν σε μία εισαγωγή. */
export const PHOTO_MAX_ROWS = 20;

/**
 * Το prompt της ανάγνωσης. Σύντομα κλειδιά: η απάντηση των 20 γραμμών πρέπει
 * να χωρά στο ταβάνι της σάρωσης (lib/assistant/scanShape.ts, maxTokens).
 */
export const PHOTO_PROMPT = `Διαβάζεις φωτογραφία ελληνικού φορολογικού εγγράφου ακινήτων από το myAADE. Επίστρεψε ΑΥΣΤΗΡΑ ΜΟΝΟ JSON, χωρίς άλλο κείμενο, με αυτό το σχήμα:
{"doc":"e9|enfia_act|other","other":null,"year":null,"count":0,"total":null,"rows":[{"atak":null,"nomos":null,"dimos":null,"diam":null,"street":null,"no":null,"tk":null,"cat":null,"floor":null,"sqm":null,"aux":null,"built":null,"right":null,"pct":null,"tax":null}]}

ΕΙΔΟΣ ("doc"):
- "e9": «Βεβαίωση δηλωθείσας περιουσιακής κατάστασης» ή «Δήλωση στοιχείων ακινήτων» (έντυπο Ε9).
- "enfia_act": «Πράξη (διοικητικού) προσδιορισμού ΕΝΦΙΑ» ή εκκαθαριστικό ΕΝΦΙΑ.
- "other": οτιδήποτε άλλο (π.χ. εκκαθαριστικό φόρου εισοδήματος Ε1, Ε2, λογαριασμός). Τότε "other" = σύντομη ονομασία του εγγράφου και "rows" = [].

ΠΕΔΙΑ:
- "year": το έτος του εγγράφου (Ε9: «1η Ιανουαρίου ΕΤΟΣ», πράξη: έτος ΕΝΦΙΑ).
- "count": πόσα ακίνητα έχει ο Πίνακας 1 στη φωτογραφία, όλα.
- "total": μόνο στην πράξη, το τελικό ποσό ΕΝΦΙΑ για καταβολή, ως αριθμός. Στο Ε9 null.
- "rows": μία γραμμή ανά ακίνητο του Πίνακα 1 (οικόπεδα και κτίσματα), έως ${PHOTO_MAX_ROWS}, με τη σειρά του εγγράφου. Τα γήπεδα (Πίνακας 2) ΔΕΝ μπαίνουν.
  "atak": ο Αριθμός Ταυτότητας Ακινήτου, ${ATAK_DIGITS} ψηφία ως κείμενο (μπορεί να τυπώνεται σε δύο γραμμές: ένωσέ τες).
  "nomos","dimos","diam": νομός, δήμος ή κοινότητα, δημοτικό ή κοινοτικό διαμέρισμα, όπως γράφονται.
  "street","no","tk": οδός, αριθμός, ταχυδρομικός κώδικας (5 ψηφία).
  "cat": ο κωδικός «Κατηγορία ακινήτου». "floor": ο όροφος όπως γράφεται (0 = ισόγειο, -1 = υπόγειο).
  "sqm": επιφάνεια κύριων χώρων. "aux": επιφάνεια βοηθητικών χώρων. "built": έτος κατασκευής.
  "right": ο κωδικός «Είδος δικαιώματος». "pct": ποσοστό συνιδιοκτησίας ως αριθμός (π.χ. 100 ή 50).
  "tax": μόνο στην πράξη, ο κύριος φόρος της γραμμής.

ΚΑΝΟΝΕΣ:
- Αντέγραψε ό,τι τυπώνεται. ΜΗ μαντεύεις: ό,τι δεν διαβάζεται καθαρά είναι null.
- Αριθμοί με τελεία για υποδιαστολή (41,79 → 41.79). Χωρίς «€».
- ΜΗΝ επιστρέψεις ονοματεπώνυμο, ΑΦΜ, διεύθυνση κατοικίας του υπόχρεου, αριθμό παροχής ή ταυτότητα οφειλής.`;

/** Η οδηγία που συνοδεύει την εικόνα (μία, σύντομη: lib/assistant/scanShape.ts). */
export const PHOTO_ASK = 'Διάβασε τα ακίνητα αυτού του εγγράφου.';

const str = (v: unknown, max = 80): string | null => {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  return s || null;
};
/** Αριθμός από JSON: αριθμός, ή κείμενο με τελεία ή ελληνικό κόμμα. */
const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  let t = v.replace(/[€\s%]/g, '');
  if (/,\d+$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const inRange = (n: number | null, lo: number, hi: number): number | null => (n !== null && n > lo && n <= hi ? n : null);
const code = (v: unknown): string | null => { const s = str(v, 3); return s && /^\d{1,2}$/.test(s) ? s : null; };

/** Μία γραμμή της απάντησης, ελεγμένη πεδίο προς πεδίο. */
function rowOf(r: Record<string, unknown>, isAct: boolean, currentYear: number): MyAadeProperty {
  const digits = (str(r.atak, 30) ?? '').replace(/\D/g, '');
  const atak = digits.length === ATAK_DIGITS ? digits : null;
  const tk = (str(r.tk, 10) ?? '').replace(/\s/g, '');
  const built = num(r.built);
  const floor = str(r.floor, 6);
  const street = str(r.street), no = str(r.no, 8);
  const sqm = inRange(num(r.sqm), 0, 100_000);
  const tax = isAct ? num(r.tax) : null;
  return {
    atak, address: [street, no].filter(Boolean).join(' ') || null, municipality: str(r.dimos),
    sqm, ownershipPct: inRange(num(r.pct), 0, 100), kind: null,
    floor: floor && /^-?\d{1,2}$/.test(floor) ? floor : null,
    tax: tax !== null && tax >= 0 && tax < 1_000_000 ? Math.round(tax * 100) / 100 : null,
    // Η φωτογραφία δεν έχει σταθερά σημεία: ό,τι λείπει από τα βασικά θέλει έλεγχο.
    check: !atak || sqm === null,
    postcode: /^\d{5}$/.test(tk) ? tk : null, prefecture: str(r.nomos), district: str(r.diam),
    category: code(r.cat), auxSqm: inRange(num(r.aux), 0, 100_000),
    yearBuilt: built !== null && Number.isInteger(built) && built >= 1800 && built <= currentYear + 1 ? built : null,
    right: code(r.right),
  };
}

/** Η απάντηση της ανάγνωσης, ως `MyAadeParse`. Καθαρή συνάρτηση. */
export function parsePhotoReply(raw: unknown, currentYear: number): MyAadeParse {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { status: 'unrecognized', kind: 'unknown', reason: 'Η φωτογραφία δεν διαβάστηκε. Τράβηξέ τη ξανά, ίσια και με καλό φως.' };
  }
  const o = raw as Record<string, unknown>;
  if (o.doc !== 'e9' && o.doc !== 'enfia_act') {
    const what = str(o.other, 60);
    return {
      status: 'unrecognized', kind: 'unknown',
      reason: what && /Ε ?1(?!\d)|ΕΙΣΟΔΗΜ|εισοδήμ/i.test(what) ? INCOME_TAX_REASON
        : what ? `Η φωτογραφία δείχνει: «${what}».` : 'Η φωτογραφία δεν δείχνει Ε9 ούτε πράξη ΕΝΦΙΑ.',
    };
  }
  const isAct = o.doc === 'enfia_act';
  const list = Array.isArray(o.rows) ? o.rows.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && !Array.isArray(r)) : [];
  const properties: MyAadeProperty[] = [];
  const seen = new Set<string>();
  const warnings: string[] = [];
  for (const r of list.slice(0, PHOTO_MAX_ROWS)) {
    const p = rowOf(r, isAct, currentYear);
    if (!p.atak && !p.address && p.sqm === null) continue;
    if (p.atak && seen.has(p.atak)) { warnings.push(`Ο ΑΤΑΚ ${p.atak} εμφανίζεται δύο φορές· κρατήθηκε η πρώτη.`); continue; }
    if (p.atak) seen.add(p.atak);
    properties.push(p);
  }
  if (!properties.length) {
    return { status: 'unrecognized', kind: isAct ? 'enfia_act' : 'e9', reason: 'Δεν βρήκαμε ακίνητα στη φωτογραφία. Τράβηξε ολόκληρο τον πίνακα των ακινήτων, ίσια και με καλό φως.' };
  }
  const noAtak = properties.filter(p => !p.atak).length;
  if (noAtak) warnings.push(`Σε ${noAtak} ${plural(noAtak, 'ακίνητο', 'ακίνητα')} ο ΑΤΑΚ δεν διαβάστηκε καθαρά. Γράψ’ τον από το έγγραφο.`);
  const noPct = properties.filter(p => p.ownershipPct === null).length;
  if (noPct) warnings.push(`Σε ${noPct} ${plural(noPct, 'ακίνητο', 'ακίνητα')} δεν διαβάστηκε το ποσοστό συνιδιοκτησίας. Συμπλήρωσέ το στην Επεξεργασία.`);

  const y = num(o.year);
  const year = y !== null && Number.isInteger(y) && y >= 2014 && y <= currentYear + 1 ? y : null;
  const t = isAct ? num(o.total) : null;
  const total = t !== null && t >= 0 && t < 1_000_000 ? Math.round(t * 100) / 100 : null;
  const count = num(o.count);
  const found = count !== null && Number.isInteger(count) && count > properties.length && count <= 500 ? count : undefined;
  const doc: MyAadeImport = {
    kind: isAct ? 'enfia_act' : 'e9', source: 'photo', found, year, afm: null, total,
    mainTax: null, supplementaryTax: null, printedInstalments: null, issueDate: null, firstDueDate: null,
    paymentRef: null, corrective: false, properties, warnings,
  };
  return { status: 'ok', doc };
}
