// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ Ε9 ΑΠΟ ΤΟ ΚΕΙΜΕΝΟ ΤΟΥ PDF, ΧΩΡΙΣ AI
// ─────────────────────────────────────────────────────────────────────────
// Η «Βεβαίωση δηλωθείσας περιουσιακής κατάστασης» του myAADE. Το κείμενο
// βγαίνει στον περιηγητή (lib/pdf/pdfText.ts, σε Web Worker): το PDF δεν φεύγει
// από τη συσκευή. Η διάταξη, όπως τη δίνει ο αναγνώστης, περιγράφεται στο
// `labels.ts` (E9_FORM): πέντε γραμμές ανά ακίνητο, ΑΤΑΚ σε δύο γραμμές,
// ποσοστό συνιδιοκτησίας σε τρία κομμάτια, επικεφαλίδες κάθετες και άχρηστες.
//
// ΙΔΙΟΙ ΚΑΝΟΝΕΣ ΜΕ ΤΗΝ ΠΡΑΞΗ ΕΝΦΙΑ (enfiaAct.ts):
//   · Κάθε τιμή αναγνωρίζεται από τη ΜΟΡΦΗ της (11 ψηφία, Τ.Κ. πέντε ψηφίων,
//     επιφάνεια με δύο δεκαδικά, έτος τεσσάρων ψηφίων) και από τη θέση της ως
//     προς αυτά τα σταθερά σημεία.
//   · Ό,τι δεν βγαίνει με βεβαιότητα μένει `null` και η γραμμή θέλει έλεγχο.
//     Ποσοστό που δεν διαβάστηκε ΔΕΝ γίνεται 100.
//   · Το Ε9 δεν έχει ΕΝΦΙΑ: σύνολο, φόροι και δόσεις μένουν κενά.
//   · Ο Πίνακας 2 (γήπεδα) δεν περνά αυτόματα: μετριέται και λέγεται.
//
// ΤΙ ΔΕΝ ΔΙΑΒΑΖΕΤΑΙ ΠΟΤΕ: ονοματεπώνυμο, πατρώνυμο, αριθμός παροχής ρεύματος.
// Το ΑΦΜ διαβάζεται μόνο για τον έλεγχο «άλλος ΑΦΜ» και δεν αποθηκεύεται.
// ═══════════════════════════════════════════════════════════════════════════
import { fold } from '@/lib/tax/aadeE2';
import { isValidAfm, plural } from '@/lib/core/greek';
import { ATAK_DIGITS } from '@/lib/property/atak';
import { detectDocKind, HEAD_LINES } from './detect';
import { E9_FORM } from './labels';
import type { MyAadeImport, MyAadeParse, MyAadeProperty } from './types';

const cellsOf = (line: string) => line.split('\t').map(c => c.trim()).filter(Boolean);
const tokensOf = (line: string) => line.split(/[\t ]+/).map(t => t.trim()).filter(Boolean);
const hasLetters = (s: string) => /\p{L}{2,}/u.test(s);

const RE_TK = /^\d{5}$/;
const RE_AREA = /^(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}$/;
const RE_YEAR = /^(?:1[89]\d{2}|20\d{2})$/;
const RE_INT = /^-?\d{1,4}$/;
/** Γραμμή μόνο με ψηφία: κομμάτι ΑΤΑΚ (ή όλος ο ΑΤΑΚ). */
const RE_DIGITS_LINE = /^\d{1,11}$/;
/** Το πάνω κομμάτι του ποσοστού: «100,». Και ολόκληρο, αν χωρά: «100,00000». */
const RE_PCT_TOP = /^\d{1,3},\d*$/;

const area = (s: string): number | null => {
  if (!RE_AREA.test(s)) return null;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Ό,τι διαβάζεται από την κύρια γραμμή ενός ακινήτου. */
interface MainRow {
  prefecture: string | null;
  municipality: string | null;
  district: string | null;
  street: string;
  number: string | null;
  postcode: string;
  category: string | null;
  floor: string | null;
  sqm: number;
  auxSqm: number | null;
  yearBuilt: number | null;
  right: string | null;
  /** Το μεσαίο κομμάτι του ποσοστού, ή όλο το ποσοστό όταν τυπώθηκε ολόκληρο. */
  pctMid: string | null;
  /** ΑΤΑΚ ολόκληρος μέσα στη γραμμή (όταν δεν τυλίγεται). */
  atak: string | null;
  /** Θέσεις που δεν βγήκαν καθαρές. */
  check: boolean;
}

/**
 * Η κύρια γραμμή: Τ.Κ. πέντε ψηφίων και μετά του επιφάνεια με δύο δεκαδικά.
 * Κάθε άλλη γραμμή (επικεφαλίδες, κομμάτια, υποσέλιδο) δίνει `null`.
 */
function mainRow(line: string): MainRow | null {
  const toks = tokensOf(line);
  const ti = toks.findIndex((t, i) => i > 0 && RE_TK.test(t) && Number(t) >= 10000 && Number(t) <= 85999);
  if (ti < 0) return null;
  const si = toks.findIndex((t, i) => i > ti && area(t) !== null);
  if (si < 0) return null;
  let check = false;

  // ΤΟΠΟΣ: τα κελιά πριν από το κελί του Τ.Κ. (νομός, δήμος, διαμέρισμα). Κενό
  // κελί δεν τυπώνεται, οπότε με δύο κελιά το δεύτερο είναι ο τόπος του ακινήτου.
  const cells = cellsOf(line);
  let seen = 0;
  const ci = cells.findIndex(c => { const n = tokensOf(c).length; seen += n; return seen > ti; });
  const place = cells.slice(0, Math.max(0, ci));
  const before = tokensOf(cells[ci] ?? '').slice(0, ti - (seen - tokensOf(cells[ci] ?? '').length));
  let prefecture: string | null = null, municipality: string | null = null, district: string | null = null;
  if (place.length >= 3) { [prefecture, municipality] = place; district = place.slice(2).join(' '); }
  else if (place.length === 2) { [prefecture, municipality] = place; }
  else { check = true; if (place[0]) prefecture = place[0]; }
  // ΟΔΟΣ ΚΑΙ ΑΡΙΘΜΟΣ: ό,τι προηγείται του Τ.Κ. στο ίδιο κελί. Ο αριθμός είναι η τελευταία λέξη, αν είναι αριθμός.
  const num = before.length > 1 && /^\d{1,4}[\p{L}]?$/u.test(before[before.length - 1]) ? before[before.length - 1] : null;
  const street = (num ? before.slice(0, -1) : before).join(' ');
  if (!hasLetters(street)) check = true;

  // ΟΙ ΑΚΕΡΑΙΟΙ ΠΡΙΝ ΑΠΟ ΤΗΝ ΕΠΙΦΑΝΕΙΑ: πλήθος προσόψεων, οικοδομικό τετράγωνο,
  // ΑΠΑΑ, κατηγορία, (ειδικές συνθήκες), όροφος. Ο τελευταίος είναι ο όροφος, ο
  // προηγούμενος η κατηγορία. Άλλο πλήθος από 4 έως 6: θέλει έλεγχο.
  const run: string[] = [];
  for (let k = si - 1; k > ti && RE_INT.test(toks[k]); k--) run.unshift(toks[k]);
  const floor = run.length >= 1 ? run[run.length - 1] : null;
  const category = run.length >= 3 ? run[run.length - 2] : null;
  if (run.length < 4 || run.length > 6) check = true;

  // ΜΕΤΑ ΤΗΝ ΕΠΙΦΑΝΕΙΑ: βοηθητικοί χώροι (και μήκος πρόσοψης), έτος, δικαίωμα, ποσοστό.
  let k = si + 1;
  const decimals: number[] = [];
  while (k < toks.length && area(toks[k]) !== null) { decimals.push(area(toks[k]) as number); k++; }
  if (decimals.length > 1) check = true;
  const yearBuilt = RE_YEAR.test(toks[k] ?? '') ? Number(toks[k++]) : null;
  const right = /^\d$/.test(toks[k] ?? '') && yearBuilt !== null ? toks[k++] : null;
  let pctMid: string | null = null;
  if (right !== null && (/^\d+$/.test(toks[k] ?? '') || RE_PCT_TOP.test(toks[k] ?? '')) && !E9_FORM.powered.test(toks[k] ?? '')) pctMid = toks[k];

  const atak = toks.find(t => new RegExp(`^\\d{${ATAK_DIGITS}}$`).test(t)) ?? null;
  return {
    prefecture, municipality, district, street, number: num, postcode: toks[ti], category, floor,
    sqm: area(toks[si]) as number, auxSqm: decimals[0] ?? null, yearBuilt, right, pctMid, atak, check,
  };
}

/** Το ποσοστό από τα κομμάτια του: «100,» + «0000» + «0». Μόνο αν βγαίνει αριθμός 0–100. */
function joinPct(top: string | null, mid: string | null, bottom: string | null): number | null {
  if (mid && /^\d{1,3},\d+$/.test(mid)) { top = mid; mid = null; }
  if (!top) return null;
  const s = `${top}${mid ?? ''}${bottom ?? ''}`;
  if (!/^\d{1,3},\d+$/.test(s) && !/^\d{1,3},$/.test(s)) return null;
  const n = Number(s.replace(',', '.').replace(/\.$/, ''));
  return Number.isFinite(n) && n > 0 && n <= 100 ? Math.round(n * 100) / 100 : null;
}

/** Οι γραμμές μιας ενότητας: 1 = Πίνακας 1, 2 = Πίνακας 2, 0 = πριν από τους πίνακες. */
function sections(lines: readonly string[]): number[] {
  let cur = 0;
  return lines.map(l => {
    const f = fold(l);
    if (E9_FORM.table2.test(f)) cur = 2;
    else if (E9_FORM.table1.test(f)) cur = 1;
    return cur;
  });
}

/** Το Ε9 από τις γραμμές του PDF. Καθαρή συνάρτηση. */
export function parseE9(lines: readonly string[]): MyAadeParse {
  const kind = detectDocKind(lines);
  if (kind !== 'e9') return { status: 'unrecognized', kind, reason: 'Δεν το αναγνωρίσαμε ως Ε9 του myAADE.' };

  const warnings: string[] = [];
  const head = lines.slice(0, HEAD_LINES).map(fold).join('\n');
  const asOf = E9_FORM.asOf.exec(head);
  const year = asOf ? Number(asOf[1]) : null;

  let afm: string | null = null;
  for (const l of lines) {
    if (!E9_FORM.afm.test(fold(l))) continue;
    const m = /(?<!\d)\d{9}(?!\d)/.exec(l);
    if (m && isValidAfm(m[0])) { afm = m[0]; break; }
  }

  const sec = sections(lines);
  const rows = lines.map((l, i) => (sec[i] === 1 ? mainRow(l) : null));
  const isMain = (i: number) => i >= 0 && i < lines.length && rows[i] !== null;

  // ΤΑ ΚΟΜΜΑΤΙΑ ΤΟΥ ΑΤΑΚ: η γραμμή από πάνω και από κάτω, μόνο ψηφία, που μαζί κάνουν ακριβώς 11.
  const fragment = new Set<number>();
  const atakOf = new Map<number, string>();
  rows.forEach((r, i) => {
    if (!r) return;
    const up = (lines[i - 1] ?? '').trim(), down = (lines[i + 1] ?? '').trim();
    if (r.atak) { atakOf.set(i, r.atak); return; }
    if (RE_DIGITS_LINE.test(up) && RE_DIGITS_LINE.test(down) && (up + down).length === ATAK_DIGITS) {
      atakOf.set(i, up + down); fragment.add(i - 1); fragment.add(i + 1); return;
    }
    if (new RegExp(`^\\d{${ATAK_DIGITS}}$`).test(up)) { atakOf.set(i, up); fragment.add(i - 1); }
  });

  // ΟΙ ΓΡΑΜΜΕΣ ΑΠΟ ΠΑΝΩ ΚΑΙ ΑΠΟ ΚΑΤΩ: η οδός που τυλίγεται και τα κομμάτια του
  // ποσοστού. Η πάνω γίνεται δεκτή μόνο αν τελειώνει σε «100,»· η κάτω μόνο αν
  // τελειώνει σε ψηφία. Έτσι μια επικεφαλίδα ή το υποσέλιδο της σελίδας δεν
  // γίνονται ποτέ κομμάτι διεύθυνσης.
  const usable = (j: number) => j >= 0 && j < lines.length && sec[j] === 1 && !isMain(j) && !fragment.has(j);
  const properties: MyAadeProperty[] = [];
  const seen = new Set<string>();
  let noPct = 0;
  rows.forEach((r, i) => {
    if (!r) return;
    const topIdx = fragment.has(i - 1) ? i - 2 : i - 1;
    const botIdx = fragment.has(i + 1) ? i + 2 : i + 1;
    let top: string | null = null, bottom: string | null = null;
    const above: string[] = [], below: string[] = [];
    if (usable(topIdx)) {
      const c = cellsOf(lines[topIdx]);
      if (c.length && RE_PCT_TOP.test(c[c.length - 1])) { top = c[c.length - 1]; above.push(...c.slice(0, -1).filter(hasLetters)); }
    }
    if (usable(botIdx)) {
      const c = cellsOf(lines[botIdx]);
      if (c.length && /^\d{1,6}$/.test(c[c.length - 1])) { bottom = c[c.length - 1]; below.push(...c.slice(0, -1).filter(hasLetters)); }
    }
    const pct = joinPct(top, r.pctMid, bottom);
    if (pct === null) noPct++;
    const street = [...above, r.street, ...below].filter(Boolean).join(' ');
    const atak = atakOf.get(i) ?? null;
    if (atak && seen.has(atak)) { warnings.push(`Ο ΑΤΑΚ ${atak} εμφανίζεται δύο φορές· κρατήθηκε η πρώτη.`); return; }
    if (atak) seen.add(atak);
    properties.push({
      atak, address: [street, r.number].filter(Boolean).join(' ') || null,
      municipality: r.municipality, sqm: r.sqm, ownershipPct: pct, kind: null, floor: r.floor, tax: null,
      check: r.check || !atak || pct === null,
      postcode: r.postcode, prefecture: r.prefecture, district: r.district, category: r.category,
      auxSqm: r.auxSqm, yearBuilt: r.yearBuilt, right: r.right,
    });
  });

  // Ο ΠΙΝΑΚΑΣ 2: γραμμές με επιφάνεια και Τ.Κ., ή με ΑΤΑΚ. Μετριούνται, δεν περνούν.
  const landRows = lines.filter((l, i) => sec[i] === 2 && (
    new RegExp(`(?<!\\d)\\d{${ATAK_DIGITS}}(?!\\d)`).test(l)
    || (tokensOf(l).some(t => RE_TK.test(t)) && tokensOf(l).some(t => area(t) !== null))
  )).length;

  if (noPct) {
    warnings.push(`Σε ${noPct} ${plural(noPct, 'ακίνητο', 'ακίνητα')} δεν διαβάστηκε το ποσοστό συνιδιοκτησίας. Συμπλήρωσέ το στην Επεξεργασία.`);
  }
  // Ο Πίνακας 2 λέγεται σε δική του γραμμή της οθόνης (`landRows`), όχι μέσα στις προειδοποιήσεις.
  if (!properties.length) {
    return {
      status: 'unrecognized', kind,
      reason: landRows
        ? 'Το Ε9 έχει μόνο γήπεδα (Πίνακας 2). Αυτά δεν περνούν αυτόματα· πρόσθεσέ τα με το «Νέο ακίνητο».'
        : 'Μοιάζει με Ε9, αλλά δεν βρέθηκε ακίνητο στον Πίνακα 1. Η διάταξη του αρχείου διαφέρει από αυτή που περιμέναμε.',
    };
  }
  if (year === null) warnings.push('Το έτος του Ε9 δεν βρέθηκε.');

  const doc: MyAadeImport = {
    kind: 'e9', source: 'pdf', year, afm, total: null, mainTax: null, supplementaryTax: null,
    printedInstalments: null, issueDate: null, firstDueDate: null, paymentRef: null, corrective: false,
    properties, warnings, landRows,
  };
  return { status: 'ok', doc };
}
