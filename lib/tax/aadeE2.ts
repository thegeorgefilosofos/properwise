// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΠΡΟΣΥΜΠΛΗΡΩΜΕΝΟ Ε2 ΤΗΣ ΑΑΔΕ, ΟΠΩΣ ΤΟ ΕΧΕΙ Ο ΧΡΗΣΤΗΣ ΣΤΑ ΧΕΡΙΑ ΤΟΥ
// ─────────────────────────────────────────────────────────────────────────
// ΑΠΟ ΠΟΥ ΕΡΧΕΤΑΙ. Η εφαρμογή Ε1/Ε2 του myAADE δείχνει τον Πίνακα I του Ε2
// προσυμπληρωμένο από τις δηλώσεις μίσθωσης και τα στοιχεία των πλατφορμών. Ο
// ιδιοκτήτης ή ο λογιστής του το παίρνει με έναν από τρεις τρόπους:
//
//   1. ΕΚΤΥΠΩΣΗ ΣΕ PDF. Το κείμενο βγαίνει από το lib/pdf/pdfText.ts, γραμμή
//      προς γραμμή, με tab όπου υπάρχει κενό στήλης. Οι κενές στήλες ΧΑΝΟΝΤΑΙ
//      (το PDF δεν τυπώνει τίποτα για κενό κελί), οπότε η θέση δεν αρκεί: κάθε
//      τιμή αναγνωρίζεται από τη μορφή της (11 ψηφία ΑΤΑΚ, 9 ψηφία με ψηφίο
//      ελέγχου ΑΦΜ, ημερομηνίες, ποσά με ελληνική υποδιαστολή).
//   2. ΑΝΤΙΓΡΑΦΗ ΤΟΥ ΠΙΝΑΚΑ από τη σελίδα. Ο browser δίνει tab ανάμεσα στα
//      κελιά και αλλαγή γραμμής ανάμεσα στις γραμμές: με επικεφαλίδες, η
//      αντιστοίχιση γίνεται κατά στήλη. Χωρίς επικεφαλίδες, όπως το 1.
//   3. ΠΡΟΒΟΛΗ ΛΕΠΤΟΜΕΡΕΙΩΝ, όπου κάθε πεδίο είναι «Ετικέτα: τιμή».
//
// Οι στήλες είναι του επίσημου εντύπου (lib/billing/e2.ts, E2_COLUMNS):
// 2 διεύθυνση, 4 κατηγορία, 6 μισθωτής, 7 ΑΦΜ, 8 και 9 διάστημα, 10 μήνες,
// 11 μηνιαίο, 12 ποσοστό, 13 έως 16 ακαθάριστο, 17 είδος, 18 παροχή ρεύματος,
// 19 αριθμός δήλωσης μίσθωσης. Ο ΑΤΑΚ, όπου εμφανίζεται, διαβάζεται επίσης.
//
// Η ΣΕΙΡΑ ΤΟΥ ΕΝΤΥΠΟΥ (Φ-01.002/Έκδοση 2026). Το έντυπο τυπώνει τις στήλες
// από αριστερά προς τα δεξιά ως 1, 2, 3, 4, 5, 17, 18, 6, 7, 19, 8, 9, 10, 11,
// 12, 13, 14, 15, 16: οι 17 έως 19 μπήκαν ανάμεσα. Ο αναγνώστης θεωρούσε το
// πρώτο εννιαψήφιο της γραμμής ΑΦΜ μισθωτή, οπότε στην εκτύπωση της νέας
// έκδοσης έπαιρνε τον αριθμό παροχής ρεύματος (στ. 18, πριν από τον μισθωτή)
// για ΑΦΜ και έχανε τον αριθμό δήλωσης (στ. 19), που πήγε πριν από τις
// ημερομηνίες.
//
// ΚΑΜΙΑ ΣΙΩΠΗΛΗ ΜΑΝΤΕΨΙΑ. Κάθε γραμμή επιστρέφει με τα προβλήματά της
// (`issues`) και με σημαία `check` όταν κάποιο πεδίο βγήκε από τη θέση του και
// όχι από επικεφαλίδα ή ετικέτα. Η οθόνη δείχνει όλες τις γραμμές για
// επιβεβαίωση πριν αποθηκευτεί οτιδήποτε.
// ═══════════════════════════════════════════════════════════════════════════
import { parseAmount, parseDate, isValidAfm, afmDigits } from '@/lib/core/greek';
import { ATAK_DIGITS } from '@/lib/property/atak';
import { fe, fp } from '@/lib/core/format';
import { roundHalfUp } from '../core/money';

/** Σε ποια στήλη ακαθαρίστου του εντύπου είναι το ποσό της γραμμής. */
export type E2IncomeColumn = 13 | 14 | 15 | 16;

/** Μία γραμμή του Πίνακα I του προσυμπληρωμένου, όπως αποθηκεύεται. */
export interface AadeE2Row {
  /** Α/Α του εντύπου, για να βρίσκεται η γραμμή στο myAADE. */
  rowNo: number | null;
  atak: string | null;
  address: string | null;
  category: string | null;
  tenantName: string | null;
  tenantAfm: string | null;
  /** Στ. 8 και 9, ISO. */
  from: string | null;
  to: string | null;
  months: number | null;
  monthlyRent: number | null;
  ownershipPct: number | null;
  /** Ακαθάριστο της γραμμής, στη στήλη `incomeColumn`. */
  gross: number;
  incomeColumn: E2IncomeColumn;
  /** Αριθμός Δήλωσης Πληροφοριακών Στοιχείων Μίσθωσης (στ. 19). */
  leaseDeclRef: string | null;
  /** Αριθμός παροχής ρεύματος (στ. 18, Φ-01.002/Έκδοση 2026), μόνο ψηφία. */
  powerSupplyNo?: string | null;
}

export interface ParsedE2Row extends AadeE2Row {
  /** Τι δεν στέκει στη γραμμή, με τα νούμερα μέσα. */
  issues: string[];
  /** Κάποιο πεδίο βγήκε από τη θέση του: ο χρήστης πρέπει να το κοιτάξει. */
  check: boolean;
}

export interface E2ParseResult {
  rows: ParsedE2Row[];
  /** Το ΑΦΜ του υπόχρεου, αν τυπώνεται στην κεφαλίδα. */
  ownerAfm: string | null;
  /** Το φορολογικό έτος, αν τυπώνεται. */
  year: number | null;
  layout: 'table' | 'labels' | 'text' | 'empty';
  /** Γραμμές με αριθμούς που δεν έγιναν γραμμή εντύπου: δεν σιωπούμε γι' αυτές. */
  unread: string[];
}

type Field =
  | 'rowNo' | 'atak' | 'address' | 'floor' | 'category' | 'sqm' | 'tenantName' | 'tenantAfm'
  | 'from' | 'to' | 'months' | 'monthly' | 'pct' | 'g13' | 'g14' | 'g15' | 'g16' | 'kind' | 'power' | 'decl';

/** Η επίσημη αρίθμηση στηλών του Πίνακα I. */
const BY_COLUMN: Record<number, Field> = {
  1: 'rowNo', 2: 'address', 3: 'floor', 4: 'category', 5: 'sqm', 6: 'tenantName', 7: 'tenantAfm',
  8: 'from', 9: 'to', 10: 'months', 11: 'monthly', 12: 'pct', 13: 'g13', 14: 'g14', 15: 'g15',
  16: 'g16', 17: 'kind', 18: 'power', 19: 'decl',
};

/** Κεφαλαία χωρίς τόνους, τελείες και διπλά κενά: «Α.Τ.ΑΚ.» και «ΑΤΑΚ» είναι το ίδιο. */
export const fold = (s: string): string =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .replace(/[.·]/g, '').replace(/\s+/g, ' ').trim();

/** Η σειρά μετράει: «ΑΦΜ μισθωτή» είναι ΑΦΜ πριν γίνει μισθωτής. */
const RULES: [Field, RegExp][] = [
  ['decl', /ΔΗΛΩΣΗΣ|ΔΗΛΩΣΗ ΜΙΣΘ|ΑΡ ΔΗΛ/],
  ['tenantAfm', /ΑΦΜ|Α Φ Μ/],
  ['atak', /ΑΤΑΚ|Α Τ ΑΚ|ΤΑΥΤΟΤΗΤΑΣ ΑΚΙΝΗΤΟΥ/],
  ['power', /ΠΑΡΟΧΗΣ|ΔΕΗ|ΡΕΥΜΑΤΟΣ/],
  ['kind', /ΕΙΔΟΣ/],
  ['from', /ΕΝΑΡΞΗ|^ΑΠΟ(?!\p{L})|(?<!\p{L})ΑΠΟ$/u],
  ['to', /ΛΗΞΗ|^ΕΩΣ(?!\p{L})|(?<!\p{L})ΕΩΣ$|ΜΕΧΡΙ/u],
  ['monthly', /ΜΗΝΙΑΙΟ/],
  ['months', /ΜΗΝΕΣ|ΜΗΝΩΝ|ΑΡ ΜΗΝ/],
  ['pct', /ΠΟΣΟΣΤΟ|ΣΥΝΙΔ|%/],
  ['g14', /ΔΩΡΕΑΝ/],
  ['g15', /ΙΔΙΟΧΡΗΣ/],
  ['g16', /ΑΝΕΙΣΠΡΑΚΤ/],
  ['g13', /ΑΚΑΘΑΡΙΣΤ|ΕΚΜΙΣΘΩΣΗ|ΕΙΣΟΔΗΜΑ/],
  // «Κατηγ.» και «Επιφάν.» είναι οι σύντομες επικεφαλίδες του Φ-01.002/Έκδοση 2026.
  ['category', /ΚΑΤΗΓ/],
  ['tenantName', /ΜΙΣΘΩΤ|ΕΝΟΙΚΙΑΣΤ|ΟΝΟΜΑΤΕΠΩΝΥΜΟ|ΕΠΩΝΥΜΙΑ/],
  ['address', /ΔΙΕΥΘΥΝΣΗ|ΤΟΠΟΘΕΣΙΑ|ΟΔΟΣ/],
  ['floor', /ΟΡΟΦΟΣ|ΘΕΣΗ/],
  ['sqm', /ΕΠΙΦΑΝ|ΤΜ$|ΤΕΤΡΑΓΩΝΙΚ/],
  ['rowNo', /^Α\/?Α$|^ΑΑ$/],
];

/** Σε ποιο πεδίο αντιστοιχεί μια επικεφαλίδα ή ετικέτα. Πρώτα ο αριθμός στήλης. */
export function fieldOf(label: string): Field | null {
  const f = fold(label);
  if (!f || f.length > 90) return null;
  const col = /(?<!\p{L})ΣΤ(?:ΗΛΗ)?\s*(\d{1,2})(?!\d)/u.exec(f);
  if (col && BY_COLUMN[Number(col[1])]) return BY_COLUMN[Number(col[1])];
  for (const [field, re] of RULES) if (re.test(f)) return field;
  return null;
}

// ── Μορφές τιμών ─────────────────────────────────────────────────────────
const RE_DATE = /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/;
const RE_MONEY = /^-?(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?€?$|^-?\d+\.\d{1,2}€?$/;
const RE_PCT = /^\d{1,3}(,\d{1,2})?%$/;
const RE_INT = /^\d{1,3}$/;

const CATEGORY = /ΚΑΤΟΙΚΙΑ|ΔΙΑΜΕΡΙΣΜΑ|ΜΟΝΟΚΑΤΟΙΚΙΑ|ΜΕΖΟΝΕΤΑ|ΚΑΤΑΣΤΗΜΑ|ΓΡΑΦΕΙΟ|ΑΠΟΘΗΚΗ|ΣΤΑΘΜΕΥΣΗΣ|ΣΤΟΥΝΤΙΟ|ΟΙΚΟΠΕΔΟ|ΑΓΡΟΤΕΜΑΧΙΟ|ΓΗΠΕΔΟ|ΕΠΑΓΓΕΛΜΑΤΙΚΗ|ΒΙΟΜΗΧΑΝΙΚΟ|ΞΕΝΟΔΟΧ/;
const KIND_COLUMN: [RegExp, E2IncomeColumn | 'vacant'][] = [
  [/ΙΔΙΟΧΡΗΣ/, 15],
  [/ΔΩΡΕΑΝ/, 14],
  [/^ΚΕΝΟ|ΜΗ ΜΙΣΘΩΜΕΝΟ|ΚΕΝΟ ΑΚΙΝΗΤΟ/, 'vacant'],
];

/** Η στήλη 17 του Φ-01.002/Έκδοση 2026: το είδος της μίσθωσης και η χρήση. */
const USE_TEXT = /ΜΙΣΘΩΣΗ|ΒΡΑΧΥΧΡΟΝΙΑ|ΠΑΡΑΧΩΡΗΣΗ|39Α/;
/** Η στήλη 3: ισόγειο, 1ος όροφος κ.λπ. */
const FLOOR_TEXT = /^(ΙΣΟΓΕΙΟ|ΥΠΟΓΕΙΟ|ΗΜΙΥΠΟΓΕΙΟ|ΗΜΙΟΡΟΦΟΣ|ΡΕΤΙΡΕ|ΔΩΜΑ|\d{1,2}ΟΣ( ΟΡΟΦΟΣ| ΟΡ)?)$/;

const cleanDigits = (s: string): string => s.replace(/[\s.]/g, '');
const money = (s: string): number | null => {
  const v = parseAmount(s.replace(/€/g, ''));
  return v == null || !Number.isFinite(v) ? null : roundHalfUp(v, 2);
};
const pctOf = (s: string): number | null => money(s.replace('%', ''));

/** Οι έλεγχοι που ισχύουν σε κάθε γραμμή, απ' όπου κι αν ήρθε (και χειροκίνητη). */
export function validateAadeRow(r: AadeE2Row, year?: number | null): string[] {
  const out: string[] = [];
  if (!r.atak) out.push('Λείπει ο ΑΤΑΚ: η γραμμή ταιριάζεται μόνο με ΑΦΜ μισθωτή ή αριθμό δήλωσης.');
  else if (!new RegExp(`^\\d{${ATAK_DIGITS}}$`).test(r.atak)) out.push(`Ο ΑΤΑΚ «${r.atak}» δεν έχει ${ATAK_DIGITS} ψηφία.`);
  if (r.tenantAfm && !isValidAfm(r.tenantAfm)) out.push(`Το ΑΦΜ μισθωτή «${r.tenantAfm}» δεν είναι έγκυρο: το ψηφίο ελέγχου δεν ταιριάζει.`);
  if (r.months != null && (r.months < 0 || r.months > 12 || !Number.isInteger(r.months))) out.push(`Οι μήνες «${r.months}» δεν είναι από 0 έως 12.`);
  if (r.ownershipPct != null && (r.ownershipPct <= 0 || r.ownershipPct > 100)) out.push(`Το ποσοστό «${r.ownershipPct}» δεν είναι από 0 έως 100.`);
  if (!(r.gross >= 0)) out.push('Το ακαθάριστο δεν μπορεί να είναι αρνητικό.');
  if (r.from && r.to && r.from > r.to) out.push('Η έναρξη είναι μετά τη λήξη.');
  if (year && r.from && r.to && (r.to.slice(0, 4) < String(year) || r.from.slice(0, 4) > String(year))) {
    out.push(`Το διάστημα ${r.from.split('-').reverse().join('/')} έως ${r.to.split('-').reverse().join('/')} δεν πέφτει μέσα στο ${year}.`);
  }
  if (r.incomeColumn === 13 && r.monthlyRent && r.months && r.gross > 0) {
    const expected = Math.round(r.monthlyRent * r.months * (r.ownershipPct ?? 100)) / 100;
    if (Math.abs(expected - r.gross) > Math.max(1, r.gross * 0.01)) {
      out.push(`Μηνιαίο ${fe(r.monthlyRent)} × ${r.months} μήνες × ${fp(r.ownershipPct ?? 100)} κάνει ${fe(expected)}, ενώ το ακαθάριστο γράφει ${fe(r.gross)}.`);
    }
  }
  return out;
}

const blankRow = (): AadeE2Row => ({
  rowNo: null, atak: null, address: null, category: null, tenantName: null, tenantAfm: null,
  from: null, to: null, months: null, monthlyRent: null, ownershipPct: null,
  gross: 0, incomeColumn: 13, leaseDeclRef: null, powerSupplyNo: null,
});

/** Μία τιμή στο πεδίο της. Επιστρέφει false όταν η τιμή δεν είχε τη μορφή του πεδίου. */
function assign(row: AadeE2Row & { _g: Partial<Record<13 | 14 | 15 | 16, number>> }, field: Field, raw: string): boolean {
  const v = raw.trim();
  if (!v || v === '-' || v === '—') return true;
  switch (field) {
    case 'rowNo': { const n = Number(v.replace(/\D/g, '')); if (Number.isFinite(n) && n > 0) row.rowNo = n; return true; }
    case 'atak': { const d = cleanDigits(v); if (!/^\d+$/.test(d)) return false; row.atak = d; return true; }
    case 'tenantAfm': { const d = afmDigits(v).replace(/^EL/i, ''); if (!/^\d{8,10}$/.test(d)) return false; row.tenantAfm = d; return true; }
    case 'address': row.address = v; return true;
    case 'category': row.category = v; return true;
    case 'tenantName': row.tenantName = v; return true;
    case 'from': { const d = parseDate(v); if (!d) return false; row.from = d; return true; }
    case 'to': { const d = parseDate(v); if (!d) return false; row.to = d; return true; }
    case 'months': { const n = money(v); if (n == null) return false; row.months = n; return true; }
    case 'monthly': { const n = money(v); if (n == null) return false; row.monthlyRent = n; return true; }
    case 'pct': { const n = pctOf(v); if (n == null) return false; row.ownershipPct = n; return true; }
    case 'g13': case 'g14': case 'g15': case 'g16': {
      const n = money(v); if (n == null) return false;
      row._g[Number(field.slice(1)) as 13 | 14 | 15 | 16] = n; return true;
    }
    case 'kind': {
      const k = fold(v);
      for (const [re, col] of KIND_COLUMN) if (re.test(k)) { if (col !== 'vacant') row.incomeColumn = col; return true; }
      return true;
    }
    case 'decl': { const d = v.replace(/\s/g, ''); if (!/\d/.test(d)) return false; row.leaseDeclRef = d; return true; }
    // Στ. 18 (Φ-01.002/Έκδοση 2026): μόνο ψηφία, όσα γράφει η ΑΑΔΕ.
    case 'power': { const d = v.replace(/[\s.\-/]/g, ''); if (!/^\d+$/.test(d)) return false; row.powerSupplyNo = d; return true; }
    default: return true; // θέση, επιφάνεια: δεν συγκρίνονται
  }
}

/** Οι τέσσερις στήλες ακαθαρίστου γίνονται ένα ποσό με τη στήλη του. */
function settle(row: AadeE2Row & { _g: Partial<Record<13 | 14 | 15 | 16, number>> }): string[] {
  const issues: string[] = [];
  const set = (Object.entries(row._g) as [string, number][]).filter(([, n]) => n > 0);
  if (set.length === 1) { row.incomeColumn = Number(set[0][0]) as E2IncomeColumn; row.gross = set[0][1]; }
  else if (set.length > 1) {
    row.incomeColumn = 13;
    row.gross = set.reduce((s, [, n]) => s + n, 0);
    issues.push(`Ποσά σε περισσότερες από μία στήλες ακαθαρίστου (${set.map(([c, n]) => `στ. ${c}: ${fe(n)}`).join(', ')}): μετρήθηκαν μαζί.`);
  } else { row.gross = 0; }
  return issues;
}

const finish = (r: AadeE2Row & { _g?: unknown }, extra: string[], check: boolean, year: number | null): ParsedE2Row => {
  const { _g: _drop, ...clean } = r as AadeE2Row & { _g?: unknown };
  void _drop;
  const issues = [...extra, ...validateAadeRow(clean, year)];
  return { ...clean, issues, check: check || issues.length > 0 };
};

// ── Κεφαλίδα εγγράφου: ΑΦΜ υπόχρεου και έτος ───────────────────────────────
function headerFacts(lines: readonly string[]): { ownerAfm: string | null; year: number | null } {
  let ownerAfm: string | null = null, year: number | null = null;
  for (const line of lines.slice(0, 40)) {
    const f = fold(line);
    if (!year) {
      const y = /ΦΟΡΟΛΟΓΙΚΟ ΕΤΟΣ\s*:?\s*(20\d{2})/.exec(f) || /(?<!\p{L})ΕΤΟΣ\s*:?\s*(20\d{2})(?!\d)/u.exec(f);
      if (y) year = Number(y[1]);
    }
    if (!ownerAfm && !/ΜΙΣΘΩΤ|ΕΝΟΙΚΙΑΣΤ/.test(f)) {
      const m = /(?:ΑΦΜ|Α Φ Μ)[^0-9]{0,25}(\d{9})\b/.exec(f);
      if (m && isValidAfm(m[1]) && line.split('\t').length <= 3) ownerAfm = m[1];
    }
  }
  return { ownerAfm, year };
}

// ── 1. ΠΙΝΑΚΑΣ ΜΕ ΕΠΙΚΕΦΑΛΙΔΕΣ ────────────────────────────────────────────
function splitCells(line: string, sep: string): string[] {
  return line.split(sep).map(c => c.trim());
}

function isColumnNumberRow(cells: readonly string[]): boolean {
  const vals = cells.filter(c => c !== '');
  return vals.length >= 8 && vals.every(c => /^\d{1,2}$/.test(c) && Number(c) >= 1 && Number(c) <= 19)
    && new Set(vals).size === vals.length;
}

function tableLayout(lines: readonly string[], year: number | null): { rows: ParsedE2Row[]; unread: string[] } | null {
  const sep = lines.some(l => l.includes('\t')) ? '\t' : lines.some(l => (l.match(/;/g) || []).length >= 4) ? ';' : null;
  if (!sep) return null;
  let headerAt = -1;
  let fields: (Field | null)[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cells = splitCells(lines[i], sep);
    if (cells.length < 3 || /\d{4,}/.test(lines[i].replace(/\(ΣΤ\.?\s*\d+\)/gi, ''))) continue;
    const mapped = cells.map(fieldOf);
    const distinct = new Set(mapped.filter(Boolean));
    if (distinct.size >= 4 && (distinct.has('g13') || distinct.has('tenantAfm') || distinct.has('atak'))) {
      headerAt = i; fields = mapped; break;
    }
  }
  if (headerAt < 0) return null;
  const rows: ParsedE2Row[] = [];
  const unread: string[] = [];
  for (const line of lines.slice(headerAt + 1)) {
    if (!/\d/.test(line) || /ΣΥΝΟΛ|ΑΘΡΟΙΣΜΑ/.test(fold(line))) continue;
    const cells = splitCells(line, sep);
    // Η σειρά με τους αριθμούς των στηλών κάτω από τις επικεφαλίδες (1, 2, 3,
    // 4, 5, 17, 18, 6, …, Φ-01.002/Έκδοση 2026) δεν είναι γραμμή του εντύπου.
    if (isColumnNumberRow(cells)) continue;
    // ΟΤΑΝ ΤΑ ΚΕΛΙΑ ΔΕΝ ΣΤΟΙΧΙΖΟΝΤΑΙ ΜΕ ΤΙΣ ΕΠΙΚΕΦΑΛΙΔΕΣ, Η ΘΕΣΗ ΔΕΝ ΛΕΕΙ ΤΙΠΟΤΑ.
    // Το PDF ενώνει γειτονικά κελιά και παραλείπει τα κενά: τότε η γραμμή
    // διαβάζεται από τη μορφή των τιμών της, όπως στο ελεύθερο κείμενο.
    const row = { ...blankRow(), _g: {} as Partial<Record<13 | 14 | 15 | 16, number>> };
    const extra: string[] = [];
    if (cells.length <= fields.length) {
      cells.forEach((c, i) => {
        const f = fields[i];
        if (f && !assign(row, f, c)) extra.push(`Η τιμή «${c}» δεν έχει τη μορφή της στήλης.`);
      });
    }
    if (cells.length > fields.length || extra.length) {
      const byShape = textRow(line, year);
      if (byShape) { rows.push(byShape); continue; }
      if (cells.length > fields.length) { unread.push(line); continue; }
    }
    extra.push(...settle(row));
    rows.push(finish(row, extra, extra.length > 0, year));
  }
  return { rows, unread };
}

// ── 2. ΕΤΙΚΕΤΑ: ΤΙΜΗ ──────────────────────────────────────────────────────
function labelsLayout(lines: readonly string[], year: number | null): { rows: ParsedE2Row[]; unread: string[] } | null {
  const pairs: { field: Field; value: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const m = /^(.{2,60}?)\s*(?::|\t)\s*(.+)$/.exec(line);
    const field = m ? fieldOf(m[1]) : null;
    if (m && field) { pairs.push({ field, value: m[2] }); continue; }
    // Ετικέτα σε μία γραμμή και τιμή στην επόμενη, όπως τις αντιγράφει ο browser
    // από προβολή λεπτομερειών.
    const alone = !/\d/.test(line) && line.length <= 60 ? fieldOf(line.replace(/:$/, '')) : null;
    const next = lines[i + 1]?.trim();
    if (alone && next && !fieldOf(next)) { pairs.push({ field: alone, value: next }); i++; }
  }
  if (pairs.length < 4 || !pairs.some(p => p.field === 'g13' || p.field === 'months')) return null;
  const rows: ParsedE2Row[] = [];
  let cur: (AadeE2Row & { _g: Partial<Record<13 | 14 | 15 | 16, number>> }) | null = null;
  let seen = new Set<Field>();
  let extra: string[] = [];
  const flush = () => {
    if (cur) { extra.push(...settle(cur)); rows.push(finish(cur, extra, extra.length > 0, year)); }
    cur = null; seen = new Set(); extra = [];
  };
  for (const p of pairs) {
    // Ξεκινά νέα γραμμή όταν ένα πεδίο ξαναεμφανίζεται ή όταν έρχεται α/α.
    if (cur && (seen.has(p.field) || p.field === 'rowNo')) flush();
    if (!cur) cur = { ...blankRow(), _g: {} };
    seen.add(p.field);
    if (!assign(cur, p.field, p.value)) extra.push(`Η τιμή «${p.value}» δεν έχει τη μορφή του πεδίου.`);
  }
  flush();
  return { rows: rows.filter(r => r.gross > 0 || r.atak || r.tenantAfm), unread: [] };
}

// ── 3. ΕΛΕΥΘΕΡΟ ΚΕΙΜΕΝΟ (PDF, πίνακας χωρίς επικεφαλίδες) ───────────────────
interface Tok { t: string; cell: number; i: number }

function textRow(line: string, year: number | null): ParsedE2Row | null {
  const f = fold(line);
  if (/ΣΥΝΟΛ|ΑΘΡΟΙΣΜΑ/.test(f)) return null;
  // Κελιά: tab, ή δύο και περισσότερα κενά (κείμενο αντιγραμμένο από προβολέα PDF).
  const cells = line.split(/\t| {2,}/).map(c => c.trim()).filter(Boolean);
  const toks: Tok[] = [];
  cells.forEach((c, ci) => c.split(/\s+/).forEach(t => toks.push({ t, cell: ci, i: toks.length })));
  const atakRe = new RegExp(`^\\d{${ATAK_DIGITS}}$`);
  const dates = toks.filter(x => RE_DATE.test(x.t));
  const elevens = toks.filter(x => atakRe.test(x.t));
  const nines = toks.filter(x => /^\d{9}$/.test(x.t));
  const moneyToks = toks.filter(x => RE_MONEY.test(x.t) && /,\d{1,2}€?$|€$/.test(x.t));
  if (!moneyToks.length || (!elevens.length && !nines.length && !dates.length)) return null;

  const row = { ...blankRow(), _g: {} as Partial<Record<13 | 14 | 15 | 16, number>> };
  const extra: string[] = [];
  // Ό,τι βγαίνει από θέση και όχι από βέβαιη μορφή σημαδεύει τη γραμμή.
  let guessed = false;

  // Α/Α: σκέτος μικρός ακέραιος στην αρχή της γραμμής.
  if (toks[0] && RE_INT.test(toks[0].t) && cells[0] === toks[0].t) row.rowNo = Number(toks[0].t);
  if (elevens[0]) row.atak = elevens[0].t;

  const lastMoney = moneyToks[moneyToks.length - 1].i;
  const firstDate = dates[0]?.i ?? Infinity;
  const lastDate = dates.length ? dates[dates.length - 1].i : -1;
  if (dates[0]) row.from = parseDate(dates[0].t);
  if (dates[1]) row.to = parseDate(dates[1].t);

  // ── ΤΑ ΕΝΝΙΑΨΗΦΙΑ ΠΡΙΝ ΑΠΟ ΤΙΣ ΗΜΕΡΟΜΗΝΙΕΣ (Φ-01.002/Έκδοση 2026) ────────
  // Με τη σειρά του εντύπου: 18 παροχή ρεύματος, 6 μισθωτής, 7 ΑΦΜ, 19 αριθμός
  // δήλωσης, 8 από. Τρία εννιαψήφια είναι παροχή, ΑΦΜ, δήλωση. Με δύο, το όνομα
  // του μισθωτή ανάμεσά τους λέει «παροχή και ΑΦΜ»· αλλιώς κρίνει το ψηφίο
  // ελέγχου του ΑΦΜ. Ένα μόνο είναι ΑΦΜ, εκτός αν ακολουθεί όνομα (τότε είναι
  // παροχή) ή η γραμμή δηλώνει χρήση χωρίς μισθωτή (ΚΕΝΟ, ιδιοχρησιμοποίηση).
  // Ό,τι κρίθηκε χωρίς βέβαιο σημάδι σημαδεύει τη γραμμή.
  const pre = nines.filter(x => x.i < firstDate);
  const lettersBetween = (a: number, b: number) => toks.some(t => t.i > a && t.i < b && /\p{L}{2,}/u.test(t.t));
  const noTenantUse = KIND_COLUMN.some(([re]) => re.test(f));
  let afmTok: Tok | undefined, powerTok: Tok | undefined, declTok: Tok | undefined;
  if (pre.length >= 3) {
    [powerTok, afmTok, declTok] = pre;
    // Το μεσαίο που δεν περνά τον έλεγχο ΑΦΜ δεν γράφεται ως ΑΦΜ (02.10.2026):
    // διαλέγεται το έγκυρο από τα τρία και η γραμμή σημαδεύεται.
    if (!isValidAfm(afmTok.t)) {
      const valid = pre.find(x => isValidAfm(x.t));
      if (valid) {
        const rest = pre.filter(x => x !== valid);
        afmTok = valid; powerTok = rest[0]; declTok = rest[1];
      }
      guessed = true;
    }
  }
  else if (pre.length === 2) {
    const [x, y] = pre;
    if (lettersBetween(x.i, y.i)) { powerTok = x; afmTok = y; }
    else if (isValidAfm(x.t) && !isValidAfm(y.t)) { afmTok = x; declTok = y; }
    else if (!isValidAfm(x.t) && isValidAfm(y.t)) { powerTok = x; afmTok = y; }
    else { afmTok = x; declTok = y; guessed = true; }
  } else if (pre.length === 1) {
    const x = pre[0];
    const before = Math.min(firstDate, ...moneyToks.filter(m => m.i > x.i).map(m => m.i));
    if (noTenantUse || lettersBetween(x.i, before)) powerTok = x;
    else if (!isValidAfm(x.t)) {
      // ΜΟΝΟ ΕΝΑ ΕΝΝΙΑΨΗΦΙΟ ΠΟΥ ΔΕΝ ΕΙΝΑΙ ΑΦΜ (02.10.2026). Γραφόταν ως ΑΦΜ
      // μισθωτή, ενώ ήταν η παροχή ρεύματος. Πάει στη στήλη της και λέγεται.
      powerTok = x; guessed = true;
      extra.push(`Το εννιαψήφιο «${x.t}» δεν περνά τον έλεγχο ΑΦΜ και γράφτηκε ως αριθμός παροχής ρεύματος. Αν είναι ΑΦΜ μισθωτή με λάθος ψηφίο, διόρθωσέ το.`);
    } else afmTok = x;
  }
  if (afmTok) row.tenantAfm = afmTok.t;
  if (powerTok) row.powerSupplyNo = powerTok.t;
  // Αριθμός δήλωσης άλλου μήκους, ανάμεσα στο ΑΦΜ και στις ημερομηνίες (στ. 19).
  declTok ??= afmTok ? toks.find(x => x.i > afmTok!.i && x.i < firstDate && /^\d{6,12}$/.test(x.t) && x.t.length !== 9 && x !== elevens[0]) : undefined;
  if (declTok) row.leaseDeclRef = declTok.t;
  else {
    // Παλιότερες εκτυπώσεις: ο αριθμός δήλωσης μετά τα ποσά.
    const tail = toks.filter(x => x.i > lastMoney && /^\d{6,12}$/.test(x.t) && x !== elevens[0]);
    if (tail.length) row.leaseDeclRef = tail[tail.length - 1].t;
  }

  // Μήνες: ο πρώτος μικρός ακέραιος (έως 12) μετά τις ημερομηνίες· χωρίς
  // ημερομηνίες, μετά τον ΑΦΜ, τον αριθμό δήλωσης, την παροχή ή τον ΑΤΑΚ και πριν
  // από τα ποσά. Η επιφάνεια (στ. 5) είναι πάντα πριν από αυτά και δεν μετρά.
  const after = lastDate >= 0 ? lastDate : Math.max(afmTok?.i ?? -1, declTok?.i ?? -1, powerTok?.i ?? -1, elevens[0]?.i ?? -1);
  const monthsTok = toks.find(x => x.i > after && x.i < lastMoney && /^\d{1,2}$/.test(x.t) && Number(x.t) <= 12);
  if (monthsTok) row.months = Number(monthsTok.t);
  else guessed = true;

  // Τα ποσά, με τη σειρά του εντύπου: μηνιαίο (11), ποσοστό (12), ακαθάριστο (13).
  // Οι κενές στήλες δεν τυπώνονται, οπότε η σειρά επιβεβαιώνεται με την πράξη
  // μηνιαίο × μήνες × ποσοστό. Οπου δεν επιβεβαιώνεται, η γραμμή σημαδεύεται.
  const pctTok = toks.find(x => x.i > after && RE_PCT.test(x.t));
  if (pctTok) row.ownershipPct = pctOf(pctTok.t);
  const nums = toks
    .filter(x => x.i > after && x.i <= lastMoney && x !== monthsTok && x !== pctTok && RE_MONEY.test(x.t) && !/^\d{6,}$/.test(x.t))
    .map(x => money(x.t))
    .filter((n): n is number => n != null);
  const m = row.months;
  const fits = (monthly: number | null, pct: number | null, gross: number) =>
    m != null && monthly != null && Math.abs(monthly * m * (pct ?? 100) / 100 - gross) <= Math.max(1, gross * 0.01);
  const known = row.ownershipPct;
  if (nums.length === 1) {
    row._g[13] = nums[0];
    guessed = true;
  } else if (nums.length === 2) {
    const [a, b] = nums;
    if (known != null || fits(a, null, b)) { row.monthlyRent = a; row._g[13] = b; guessed = guessed || !fits(a, known, b); }
    else if (a > 0 && a <= 100) { row.ownershipPct = a; row._g[13] = b; guessed = true; }
    else { row.monthlyRent = a; row._g[13] = b; guessed = true; }
  } else if (nums.length >= 3) {
    const [a, b, c, ...more] = nums;
    if (known == null && b > 0 && b <= 100) { row.monthlyRent = a; row.ownershipPct = b; row._g[13] = c; }
    else { row.monthlyRent = a; row._g[13] = b; more.unshift(c); }
    guessed = guessed || !fits(row.monthlyRent, row.ownershipPct, row._g[13] ?? 0);
    if (more.length) extra.push(`Περισσότερα ποσά από όσα αναμένονται (${more.map(fe).join(', ')}): έλεγξε τις στήλες 13 έως 16.`);
  }

  // Κείμενο: είδος, κατηγορία, διεύθυνση και μισθωτής.
  const textCells: { c: string; ci: number }[] = [];
  cells.forEach((c, ci) => {
    const words = c.split(/\s+/).filter(t => !/^\d{9}$/.test(t) && !atakRe.test(t) && !RE_DATE.test(t)).join(' ');
    if (/\p{L}{2,}/u.test(words)) textCells.push({ c: words.replace(/^\d{1,3}\s+(?=\p{L})/u, '').trim(), ci });
  });
  const rest: { c: string; ci: number }[] = [];
  for (const x of textCells) {
    const fx = fold(x.c);
    const kind = KIND_COLUMN.find(([re]) => re.test(fx));
    if (kind) { if (kind[1] !== 'vacant') row.incomeColumn = kind[1]; continue; }
    if (/^(\d+\s*)?(ΒΡΑΧΥΧΡΟΝΙΑ|ΕΚΜΙΣΘΩΣΗ)/.test(fx) && x.c.length < 40) continue;
    // Στ. 17 και στ. 3 του Φ-01.002/Έκδοση 2026: είδος μίσθωσης και θέση δεν
    // είναι ούτε διεύθυνση ούτε μισθωτής.
    if (USE_TEXT.test(fx) && x.c.length < 60) continue;
    if (FLOOR_TEXT.test(fx)) continue;
    if (!row.category && CATEGORY.test(fx) && x.c.length < 40) { row.category = x.c; continue; }
    rest.push(x);
  }
  // Στο έντυπο ο μισθωτής (στ. 6) είναι ακριβώς πριν από το ΑΦΜ του (στ. 7).
  // Μερικές εκτυπώσεις τον βάζουν μετά. Ό,τι μένει πριν είναι η διεύθυνση.
  const afmCell = afmTok?.cell ?? -1;
  const before = rest.filter(x => afmCell < 0 || x.ci < afmCell);
  const same = rest.filter(x => x.ci === afmCell);
  const between = rest.filter(x => afmCell >= 0 && x.ci > afmCell && x.ci <= (dates[0]?.cell ?? x.ci));
  const isAddress = (s: string) => /\d/.test(s) || s.includes(',');
  if (same.length || between.length) {
    row.tenantName = (same[0] ?? between[0]).c;
    if (before.length) row.address = before.map(x => x.c).join(', ');
  } else if (before.length >= 2) {
    row.tenantName = before[before.length - 1].c;
    row.address = before.slice(0, -1).map(x => x.c).join(', ');
  } else if (before.length === 1) {
    if (isAddress(before[0].c) || !afmTok) row.address = before[0].c; else row.tenantName = before[0].c;
    guessed = true;
  }
  if (!row.atak && !row.tenantAfm) guessed = true;

  extra.push(...settle(row));
  return finish(row, extra, guessed, year);
}

function textLayout(lines: readonly string[], year: number | null): { rows: ParsedE2Row[]; unread: string[] } {
  const rows: ParsedE2Row[] = [];
  const unread: string[] = [];
  for (const line of lines) {
    const r = textRow(line, year);
    if (r) rows.push(r);
    else if (/\d{1,3}(\.\d{3})*,\d{2}/.test(line) && !/ΣΥΝΟΛ|ΑΘΡΟΙΣΜΑ/.test(fold(line))) unread.push(line);
  }
  return { rows, unread };
}

/**
 * Το κείμενο του προσυμπληρωμένου γίνεται γραμμές του εντύπου.
 *
 * Δοκιμάζει πρώτα τις δύο μορφές με ρητή αντιστοίχιση (επικεφαλίδες,
 * ετικέτες) και μόνο αν δεν ταιριάξει καμία, τη θέση και τη μορφή των τιμών.
 */
export function parseAadeE2(text: string): E2ParseResult {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\u00a0/g, ' ').replace(/ +$/, '')).filter(l => l.trim());
  const { ownerAfm, year } = headerFacts(lines);
  if (!lines.length) return { rows: [], ownerAfm, year, layout: 'empty', unread: [] };
  const table = tableLayout(lines, year);
  if (table && table.rows.length) return { ...table, ownerAfm, year, layout: 'table' };
  const labels = labelsLayout(lines, year);
  if (labels && labels.rows.length) return { ...labels, ownerAfm, year, layout: 'labels' };
  const free = textLayout(lines, year);
  return { ...free, ownerAfm, year, layout: free.rows.length ? 'text' : 'empty' };
}

/**
 * Ό,τι εμποδίζει την αποθήκευση μιας γραμμής: τιμή που η βάση θα απέρριπτε.
 * Τα υπόλοιπα προβλήματα (ασυνέπεια ποσών, άκυρο ψηφίο ελέγχου) ΔΕΝ εμποδίζουν:
 * είναι αυτό που γράφει η ΑΑΔΕ και η σύγκριση πρέπει να μπορεί να το δείξει.
 */
export function blockingProblem(r: AadeE2Row): string | null {
  if (r.atak && !new RegExp(`^\\d{${ATAK_DIGITS}}$`).test(r.atak)) return `Ο ΑΤΑΚ πρέπει να έχει ${ATAK_DIGITS} ψηφία.`;
  if (r.tenantAfm && !/^\d{9}$/.test(r.tenantAfm)) return 'Το ΑΦΜ μισθωτή πρέπει να έχει 9 ψηφία.';
  if (r.months != null && (!Number.isInteger(r.months) || r.months < 0 || r.months > 12)) return 'Οι μήνες είναι ακέραιος από 0 έως 12.';
  if (r.ownershipPct != null && (r.ownershipPct <= 0 || r.ownershipPct > 100)) return 'Το ποσοστό είναι από 0 έως 100.';
  if (!(r.gross >= 0)) return 'Το ακαθάριστο δεν μπορεί να είναι αρνητικό.';
  // Τα όρια του πίνακα e2_prefilled (20261001120000, 20261001130000): χωρίς
  // αυτά μια μόνο γραμμή έριχνε όλη την αποθήκευση με γενικό μήνυμα.
  if (r.monthlyRent != null && !(r.monthlyRent >= 0)) return 'Το μηνιαίο μίσθωμα δεν μπορεί να είναι αρνητικό.';
  if (r.leaseDeclRef && r.leaseDeclRef.length > 40) return 'Ο αριθμός δήλωσης μίσθωσης είναι έως 40 ψηφία.';
  if (r.powerSupplyNo && !/^\d{1,40}$/.test(r.powerSupplyNo)) return 'Ο αριθμός παροχής ρεύματος είναι έως 40 ψηφία.';
  if (r.address && r.address.length > 300) return 'Η διεύθυνση είναι έως 300 χαρακτήρες.';
  if (r.category && r.category.length > 120) return 'Η κατηγορία είναι έως 120 χαρακτήρες.';
  if (r.tenantName && r.tenantName.length > 200) return 'Το όνομα μισθωτή είναι έως 200 χαρακτήρες.';
  if (r.from && r.to && r.from > r.to) return 'Η έναρξη είναι μετά τη λήξη.';
  if (!r.atak && !r.tenantAfm && !r.leaseDeclRef) return 'Χρειάζεται ΑΤΑΚ, ΑΦΜ μισθωτή ή αριθμός δήλωσης για να γίνει η σύγκριση.';
  return null;
}
