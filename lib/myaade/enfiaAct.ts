// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΡΑΞΗ ΠΡΟΣΔΙΟΡΙΣΜΟΥ ΕΝΦΙΑ, ΑΠΟ ΤΟ ΚΕΙΜΕΝΟ ΤΟΥ PDF, ΧΩΡΙΣ AI
// ─────────────────────────────────────────────────────────────────────────
// ΑΠΟ ΠΟΥ ΕΡΧΕΤΑΙ ΤΟ ΚΕΙΜΕΝΟ. Από το lib/pdf/pdfText.ts, στον περιηγητή: μία
// γραμμή ανά γραμμή του εγγράφου, με tab όπου υπάρχει κενό στήλης. Το PDF δεν
// φεύγει από τη συσκευή. Το πρότυπο είναι το lib/tax/aadeE2.ts: κάθε τιμή
// αναγνωρίζεται από τη ΜΟΡΦΗ της (11 ψηφία ΑΤΑΚ, 9 ψηφία με ψηφίο ελέγχου ΑΦΜ,
// ποσά με ελληνική υποδιαστολή, RF με mod 97) και από την ΕΤΙΚΕΤΑ της.
//
// ΟΙ ΕΤΙΚΕΤΕΣ ΕΙΝΑΙ ΥΠΟΘΕΣΕΙΣ. Ζουν στο `labels.ts`, το καθένα με την πηγή του ή
// με τη σημείωση «να επιβεβαιωθεί με πραγματικό PDF». Ο αναλυτής δεν ξέρει καμία
// λέξη του εντύπου μόνος του.
//
// ΠΟΤΕ ΛΑΘΟΣ ΑΡΙΘΜΟΣ. Τρεις κανόνες:
//   1. Δύο διαφορετικές τιμές για το ίδιο πεδίο → `null` και προειδοποίηση.
//      Δεν διαλέγουμε «την πρώτη».
//   2. Κανένα ποσό δεν υπολογίζεται: ούτε το σύνολο από κύριο + συμπληρωματικό,
//      ούτε από το άθροισμα των ακινήτων. Το άθροισμα χρησιμεύει μόνο ως
//      αυτοέλεγχος.
//   3. Έγγραφο που δεν αναγνωρίζεται, ή που αναγνωρίζεται αλλά δεν δίνει ούτε
//      ποσό ούτε ακίνητο, επιστρέφει `unrecognized` με αιτία.
//
// ΟΙ ΔΟΣΕΙΣ ΔΕΝ ΔΙΑΒΑΖΟΝΤΑΙ ΑΠΟ ΕΔΩ. Αν τυπώνονται, κρατιούνται μόνο για να
// συγκριθούν με τη μηχανή (lib/tools/enfiaSchedule.ts). Πλήθος, ημερομηνίες και
// ποσά των υπενθυμίσεων βγαίνουν από το σύνολο, όπως και σήμερα.
// ═══════════════════════════════════════════════════════════════════════════
import { fold } from '@/lib/tax/aadeE2';
import { parseAmount, parseDate, isValidAfm } from '@/lib/core/greek';
import { ATAK_DIGITS } from '@/lib/property/atak';
import { roundHalfUp } from '@/lib/core/money';
import { fe } from '@/lib/core/format';
import { enfiaInstalmentCount } from '@/lib/tools/enfiaSchedule';
import { detectDocKind, HEAD_LINES } from './detect';
import { HEADER_LABELS, COLUMN_LABELS, CORRECTIVE, type ColumnField } from './labels';
import { isValidRf, rfCompact } from './rf';
import type { MyAadeImport, MyAadeParse, MyAadeProperty } from './types';

// ── Μορφές τιμών ─────────────────────────────────────────────────────────
/** Ποσό με ελληνική υποδιαστολή ΚΑΙ δύο δεκαδικά: «1.234,56». Χωρίς δεκαδικά δεν είναι ποσό εδώ. */
const RE_MONEY = /^-?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}$/;
const RE_NUMBER = /^\d+(?:[.,]\d{1,2})?$/;
const RE_DATE = /^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/;
const RE_ATAK = new RegExp(`(?<!\\d)\\d{${ATAK_DIGITS}}(?!\\d)`);
const RE_AFM = /(?<!\d)\d{9}(?!\d)/g;

const clean = (s: string) => s.replace(/€/g, '').replace(/\s+/g, ' ').trim();
const cellsOf = (line: string) => line.split('\t').map(c => c.trim()).filter(Boolean);

const asMoney = (s: string): number | null => {
  const t = clean(s).replace(/\s/g, '');
  return RE_MONEY.test(t) ? parseAmount(t) : null;
};
const asNumber = (s: string): number | null => {
  const t = clean(s).replace(/%$/, '').trim();
  return RE_NUMBER.test(t) ? parseAmount(t) : null;
};
const asDate = (s: string): string | null => (RE_DATE.test(clean(s)) ? parseDate(clean(s)) : null);
const asInt = (s: string): number | null => (/^\d{1,2}$/.test(clean(s)) ? Number(clean(s)) : null);
const asYear = (s: string): number | null => {
  const m = /^(20\d{2})$/.exec(clean(s));
  return m ? Number(m[1]) : null;
};

/**
 * Οι τιμές που ακολουθούν μια ετικέτα: το υπόλοιπο του ίδιου κελιού μετά την
 * ετικέτα («Έτος: 2026»), τα επόμενα κελιά της γραμμής και το πρώτο κελί της
 * επόμενης γραμμής, όταν η τιμή τυπώνεται από κάτω.
 */
function valuesAfter(lines: readonly string[], re: RegExp): string[][] {
  const out: string[][] = [];
  lines.forEach((line, i) => {
    const cells = cellsOf(line);
    cells.forEach((cell, j) => {
      const f = fold(cell);
      const m = re.exec(f);
      if (!m) return;
      const vals: string[] = [];
      // Ό,τι ακολουθεί την ετικέτα στο ίδιο κελί, από το αρχικό κείμενο (με
      // τελείες και κόμματα) και όχι από το διπλωμένο.
      const colon = cell.indexOf(':');
      if (colon >= 0) vals.push(cell.slice(colon + 1).trim());
      vals.push(...cells.slice(j + 1));
      if (j === cells.length - 1 && colon < 0 && i + 1 < lines.length) vals.push(cellsOf(lines[i + 1])[0] ?? '');
      out.push(vals.filter(Boolean));
    });
  });
  return out;
}

type Kind = 'money' | 'int' | 'year' | 'date';
const PARSERS: Record<Kind, (s: string) => number | string | null> = { money: asMoney, int: asInt, year: asYear, date: asDate };

/**
 * Η τιμή ενός πεδίου κεφαλίδας. Ετικέτες με σειρά προτεραιότητας: η πρώτη που
 * δίνει τιμή κρίνει. Αν η ίδια ετικέτα δίνει δύο ΔΙΑΦΟΡΕΤΙΚΕΣ τιμές, το πεδίο
 * μένει κενό και επιστρέφεται η σύγκρουση.
 */
function headerValue<T extends number | string>(
  lines: readonly string[], labels: readonly RegExp[], kind: Kind,
): { value: T | null; conflict: T[] } {
  for (const re of labels) {
    const found: T[] = [];
    for (const vals of valuesAfter(lines, re)) {
      const v = vals.map(PARSERS[kind]).find(x => x !== null);
      if (v !== undefined && v !== null) found.push(v as T);
    }
    const distinct = [...new Set(found)];
    if (distinct.length === 1) return { value: distinct[0], conflict: [] };
    if (distinct.length > 1) return { value: null, conflict: distinct };
  }
  return { value: null, conflict: [] };
}

// ── Ο Πίνακας 1: ένα ακίνητο ανά ΑΤΑΚ ───────────────────────────────────
interface Header { index: number; fields: (ColumnField | null)[] }

/** Η γραμμή επικεφαλίδων: έχει στήλη ΑΤΑΚ και τουλάχιστον δύο ακόμη γνωστές. */
function findHeader(lines: readonly string[]): Header | null {
  for (let i = 0; i < lines.length; i++) {
    if (RE_ATAK.test(lines[i])) continue;
    const cells = cellsOf(lines[i]);
    if (cells.length < 3) continue;
    const used = new Set<ColumnField>();
    const fields = cells.map(c => {
      const f = fold(c);
      const hit = COLUMN_LABELS.find(([field, re]) => !used.has(field) && re.test(f));
      if (!hit) return null;
      used.add(hit[0]);
      return hit[0];
    });
    if (used.has('atak') && used.size >= 3) return { index: i, fields };
  }
  return null;
}

const emptyProperty = (): MyAadeProperty => ({
  atak: null, address: null, municipality: null, sqm: null, ownershipPct: null, kind: null, floor: null, tax: null, check: false,
});

/** Μία γραμμή του πίνακα, κατά στήλη. Ό,τι δεν έχει τη μορφή του πεδίου του μένει κενό και σημαδεύεται. */
function byColumns(cells: string[], fields: (ColumnField | null)[]): MyAadeProperty {
  const p = emptyProperty();
  cells.forEach((cell, k) => {
    const field = fields[k];
    if (!field) return;
    switch (field) {
      case 'atak': { const m = RE_ATAK.exec(cell); if (m) p.atak = m[0]; else p.check = true; break; }
      case 'sqm': { const n = asNumber(cell); if (n !== null && n > 0) p.sqm = n; else p.check = true; break; }
      case 'ownershipPct': { const n = asNumber(cell); if (n !== null && n > 0 && n <= 100) p.ownershipPct = n; else p.check = true; break; }
      case 'tax': { const n = asMoney(cell); if (n !== null) p.tax = n; else p.check = true; break; }
      case 'address': p.address = clean(cell); break;
      case 'municipality': p.municipality = clean(cell); break;
      case 'kind': p.kind = clean(cell); break;
      case 'floor': p.floor = clean(cell); break;
    }
  });
  return p;
}

/**
 * Χωρίς επικεφαλίδες που να ταιριάζουν στη γραμμή: μόνο ό,τι αναγνωρίζεται από
 * τη μορφή του (ΑΤΑΚ, ποσοστό με «%») και η διεύθυνση ως το μεγαλύτερο κελί με
 * γράμματα. Τα υπόλοιπα μένουν κενά και η γραμμή θέλει έλεγχο.
 */
function byShape(cells: string[]): MyAadeProperty {
  const p = emptyProperty();
  p.check = true;
  for (const cell of cells) {
    const atak = RE_ATAK.exec(cell);
    if (atak && !p.atak) { p.atak = atak[0]; continue; }
    if (/%\s*$/.test(cell)) {
      const n = asNumber(cell);
      if (n !== null && n > 0 && n <= 100) p.ownershipPct = n;
    }
  }
  const words = cells.filter(c => /\p{L}{3,}/u.test(c)).sort((a, b) => b.length - a.length);
  if (words[0]) p.address = clean(words[0]);
  return p;
}

function readProperties(lines: readonly string[], warnings: string[]): MyAadeProperty[] {
  const header = findHeader(lines);
  const out: MyAadeProperty[] = [];
  const seen = new Set<string>();
  const start = header ? header.index + 1 : 0;
  for (let i = start; i < lines.length; i++) {
    const atak = RE_ATAK.exec(lines[i]);
    if (!atak) continue;
    const cells = cellsOf(lines[i]);
    const p = header && cells.length === header.fields.length ? byColumns(cells, header.fields) : byShape(cells);
    if (!p.atak) continue;
    // Η ίδια γραμμή σε αλλαγή σελίδας: μία φορά.
    if (seen.has(p.atak)) { warnings.push(`Ο ΑΤΑΚ ${p.atak} εμφανίζεται δύο φορές· κρατήθηκε η πρώτη.`); continue; }
    seen.add(p.atak);
    out.push(p);
  }
  return out;
}

// ── Η ανάλυση ────────────────────────────────────────────────────────────

/** Η πράξη ΕΝΦΙΑ από τις γραμμές του PDF. Καθαρή συνάρτηση. */
export function parseEnfiaAct(lines: readonly string[]): MyAadeParse {
  const kind = detectDocKind(lines);
  if (kind === 'e9') {
    return { status: 'unrecognized', kind, reason: 'Αυτό είναι το Ε9. Προς το παρόν διαβάζουμε την πράξη ΕΝΦΙΑ, που έχει και τα ακίνητα και το ποσό.' };
  }
  if (kind !== 'enfia_act') {
    return { status: 'unrecognized', kind, reason: 'Δεν το αναγνωρίσαμε ως πράξη ΕΝΦΙΑ του myAADE.' };
  }

  const warnings: string[] = [];
  const head = lines.slice(0, HEAD_LINES).map(fold).join('\n');

  // Έτος: ετικέτα ή ο τίτλος («… έτους 2026»). Αν διαφωνούν, κανένα.
  const labelled = headerValue<number>(lines, HEADER_LABELS.year, 'year');
  const titled = /ΕΤΟΥΣ\s+(20\d{2})|ΕΝΦΙΑ\s+(20\d{2})/.exec(head);
  const fromTitle = titled ? Number(titled[1] ?? titled[2]) : null;
  let year: number | null = labelled.value ?? fromTitle;
  if (labelled.conflict.length || (labelled.value && fromTitle && labelled.value !== fromTitle)) {
    year = null;
    warnings.push('Το έτος της πράξης δεν διαβάστηκε με βεβαιότητα. Διάλεξέ το.');
  }

  // ΑΦΜ: εννιαψήφιο δίπλα στην ετικέτα, με σωστό ψηφίο ελέγχου.
  let afm: string | null = null;
  let afmBad = false;
  for (const re of HEADER_LABELS.afm) {
    for (const vals of valuesAfter(lines, re)) {
      for (const v of vals) for (const m of v.matchAll(RE_AFM)) {
        if (isValidAfm(m[0])) afm ??= m[0]; else afmBad = true;
      }
    }
    if (afm) break;
  }
  if (!afm && afmBad) warnings.push('Το ΑΦΜ της πράξης δεν περνά τον έλεγχο ψηφίου.');

  // Το ποσό: πρώτα «για καταβολή», μετά «συνολικός φόρος». Ποτέ υπολογισμένο.
  const payable = headerValue<number>(lines, HEADER_LABELS.payable, 'money');
  const gross = headerValue<number>(lines, HEADER_LABELS.total, 'money');
  for (const [name, r] of [['ποσό για καταβολή', payable], ['συνολικό φόρο', gross]] as const) {
    if (r.conflict.length) warnings.push(`Βρέθηκαν διαφορετικές τιμές για ${name}: ${r.conflict.map(fe).join(', ')}. Γράψε το σωστό.`);
  }
  const total = payable.conflict.length ? null : payable.value ?? (gross.conflict.length ? null : gross.value);
  if (payable.value != null && gross.value != null && payable.value !== gross.value) {
    warnings.push(`Ο συνολικός φόρος είναι ${fe(gross.value)} και το ποσό για καταβολή ${fe(payable.value)}. Οι δόσεις βγαίνουν από το ποσό για καταβολή.`);
  }
  if (total == null && !payable.conflict.length && !gross.conflict.length) warnings.push('Δεν βρέθηκε το ποσό του ΕΝΦΙΑ. Γράψε το σύνολο της πράξης.');

  const main = headerValue<number>(lines, HEADER_LABELS.mainTax, 'money');
  const supp = headerValue<number>(lines, HEADER_LABELS.supplementaryTax, 'money');
  const count = headerValue<number>(lines, HEADER_LABELS.instalmentCount, 'int');
  const each = headerValue<number>(lines, HEADER_LABELS.instalmentAmount, 'money');
  const printedInstalments = count.value != null || each.value != null ? { count: count.value, amount: each.value } : null;
  if (total != null && count.value != null && count.value !== enfiaInstalmentCount(total)) {
    warnings.push(`Η πράξη γράφει ${count.value} δόσεις· για ${fe(total)} η εφαρμογή βγάζει ${enfiaInstalmentCount(total)}. Οι υπενθυμίσεις ακολουθούν την εφαρμογή· έλεγξε τον «Λογαριασμό μου» στο myAADE.`);
  }

  // Ταυτότητα Οφειλής: ένα κελί που είναι ολόκληρο αναφορά RF, με σωστό mod 97.
  let paymentRef: string | null = null;
  let rfBad = false;
  for (const line of lines) for (const cell of cellsOf(line)) {
    const c = rfCompact(cell.replace(/^.*?:/, ''));
    if (!/^RF\d{2}[0-9A-Z]{1,21}$/.test(c)) continue;
    if (isValidRf(c)) paymentRef ??= c; else rfBad = true;
  }
  if (!paymentRef && rfBad) warnings.push('Βρέθηκε ταυτότητα οφειλής που δεν περνά τον έλεγχο. Πάρε τη σωστή από το myAADE.');

  const properties = readProperties(lines, warnings);
  if (!properties.length) warnings.push('Δεν βρέθηκαν ακίνητα με ΑΤΑΚ στην πράξη.');

  // Αυτοέλεγχος: το άθροισμα ανά ακίνητο, σε λεπτά, πρέπει να βγάζει το σύνολο.
  const taxed = properties.filter(p => p.tax != null);
  if (total != null && taxed.length && taxed.length === properties.length) {
    const sum = roundHalfUp(taxed.reduce((s, p) => s + (p.tax as number), 0), 2);
    if (Math.round(sum * 100) !== Math.round(total * 100)) {
      warnings.push(`Τα ποσά των ακινήτων αθροίζουν ${fe(sum)}, ενώ το σύνολο είναι ${fe(total)}. Έλεγξε τις γραμμές.`);
    }
  }

  if (total == null && !properties.length) {
    return { status: 'unrecognized', kind, reason: 'Μοιάζει με πράξη ΕΝΦΙΑ, αλλά δεν βρέθηκε ούτε ποσό ούτε ακίνητο. Η διάταξη του αρχείου διαφέρει από αυτή που περιμέναμε.' };
  }

  const doc: MyAadeImport = {
    kind: 'enfia_act', year, afm, total,
    mainTax: main.value, supplementaryTax: supp.value,
    printedInstalments,
    issueDate: headerValue<string>(lines, HEADER_LABELS.issueDate, 'date').value,
    firstDueDate: headerValue<string>(lines, HEADER_LABELS.firstDue, 'date').value,
    paymentRef, corrective: CORRECTIVE.test(head), properties, warnings,
  };
  // Έτος που δεν γράφεται πουθενά δεν μαντεύεται από άλλες ημερομηνίες.
  if (doc.year == null && !warnings.some(w => w.startsWith('Το έτος'))) warnings.push('Το έτος της πράξης δεν βρέθηκε. Διάλεξέ το.');
  return { status: 'ok', doc };
}
