// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΤΗΣ ΕΙΣΑΓΩΓΗΣ: ΓΡΑΜΜΕΣ, ΕΛΕΓΧΟΙ ΚΑΙ ΟΙ ΛΟΓΟΙ ΣΕ ΛΕΞΕΙΣ
// ─────────────────────────────────────────────────────────────────────────
// Καθαρές συναρτήσεις, χωρίς React: τις καλεί το παράθυρο (MyaadeImport.tsx)
// και ο πάγκος διάταξης (scripts/perf-bench/mobile.tsx). Τις ελέγχει το
// lib/myaade/myaade.test.ts.
//
// ΚΑΝΕΝΑ ΚΟΥΜΠΙ ΧΩΡΙΣ ΛΟΓΟ. Όσο κάτι εμποδίζει την αποθήκευση, το `blockers`
// το λέει σε μία πρόταση με τον αριθμό μέσα. Η οθόνη δείχνει την πρώτη κάτω από
// το κουμπί και πηγαίνει τον χρήστη στο σημείο αν πατήσει.
// ═══════════════════════════════════════════════════════════════════════════
import { plural, parseAmount } from '@/lib/core/greek';
import { atakDigits, isAtak, ATAK_DIGITS } from '@/lib/property/atak';
import { matchProperty, type KnownProperty, type MatchResult } from './match';
import { overLimit, excessOf, BULK_MAX } from './planLimit';
import type { MyAadeImport } from './types';

/** Μία γραμμή όπως τη διορθώνει ο χρήστης, μέχρι να αποθηκευτεί. */
export interface Draft {
  key: number;
  include: boolean;
  match: MatchResult;
  /** «Ίσως υπάρχει»: ο χρήστης είπε ότι είναι το ίδιο (`true`) ή άλλο (`false`). */
  same: boolean | null;
  name: string;
  address: string;
  atak: string;
  sqm: string;
  pct: string;
  floor: string;
  /** Τ.Κ. και έτος κατασκευής: γράφονται στο νέο ακίνητο, στο υπάρχον μόνο αν λείπουν. */
  postcode: string;
  yearBuilt: string;
  municipality: string | null;
  /** Μόνο για την προβολή: δεν γράφονται. */
  prefecture: string | null;
  district: string | null;
  category: string | null;
  right: string | null;
  auxSqm: number | null;
  kind: string | null;
  tax: number | null;
  /** Κάποιο πεδίο βγήκε από τη θέση του: «Έλεγξέ το». */
  check: boolean;
  /** Νέα γραμμή που δεν χώρεσε στο πακέτο όταν διαβάστηκε το αρχείο. */
  overPlan: boolean;
}

/** Ένας «Ιδιοκτήτης» του Πελατολογίου (επαγγελματικός λογαριασμός). */
export interface KnownOwner { id: string; name: string; afm: string | null }

/** Η επιλογή «δικά μου», δίπλα στις καρτέλες ιδιοκτητών. */
export const SELF_OWNER = 'self';

/** Ποσό για πεδίο: πάντα δύο δεκαδικά με κόμμα, από ακέραια λεπτά («843,20»). */
export const toMoneyText = (n: number | null | undefined): string =>
  (n == null ? '' : (Math.round(n * 100) / 100).toFixed(2).replace('.', ','));
/** Αριθμός για πεδίο χωρίς μονάδα (τ.μ., ποσοστό): όσα δεκαδικά έχει, με κόμμα. */
export const toText = (n: number | null | undefined): string => (n == null ? '' : String(n).replace('.', ','));
/**
 * Ό,τι γράφει ο χρήστης, με τον ΙΔΙΟ αναγνώστη που διαβάζει η υπόλοιπη
 * εφαρμογή (`parseAmount`): «1.234,56», «1 234,56», «843,2», «€ 12».
 */
export const toNumber = (s: string): number | null => {
  const n = parseAmount(s.replace(/\s/g, ''));
  return n === null || !Number.isFinite(n) ? null : n;
};
/** Σε ακέραια λεπτά και πίσω: η μόνη στρογγυλοποίηση ποσού της εισαγωγής. */
export const toCents = (n: number): number => Math.round(n * 100);

/**
 * Μία εκτέλεση τη φορά: δεύτερο πάτημα όσο τρέχει η πρώτη επιστρέφει την ίδια
 * υπόσχεση, δεν ξεκινά δεύτερη καταχώρηση. Η κατάσταση του React ενημερώνεται
 * στην επόμενη απόδοση· δύο κλικ στο ίδιο καρέ τη βλέπουν και τα δύο «ελεύθερη».
 */
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let running: Promise<T> | null = null;
  return () => {
    if (running) return running;
    running = fn().finally(() => { running = null; });
    return running;
  };
}

/**
 * Πρόταση ονόματος για νέο ακίνητο: είδος, διεύθυνση, όροφος.
 *
 * Η ΔΙΕΥΘΥΝΣΗ ΜΕΝΕΙ ΟΠΩΣ ΤΗΝ ΤΥΠΩΝΕΙ Η ΑΑΔΕ, ΣΕ ΚΕΦΑΛΑΙΑ (απόφαση 09/11/2026).
 * Στα ελληνικά τα κεφαλαία γράφονται χωρίς τόνο, οπότε «ΑΘΗΝΑΙΩΝ» και
 * «ΟΔΟΣ ΠΑΡΑΔΕΙΓΜΑΤΟΣ (ΑΝΩΝΥΜΟΣ) 11» είναι σωστή ορθογραφία. Τα πεζά όμως
 * θέλουν τόνο σε σχεδόν κάθε λέξη με δύο συλλαβές και πάνω· ο τόνος δεν
 * βγαίνει από τα κεφαλαία χωρίς λεξικό: «Αθηναιων», «Οδος», «(Ανωνυμος)» θα
 * ήταν ορθογραφικά λάθη. Το τελικό «ς» είναι το μόνο που βγαίνει με κανόνα και
 * δεν αρκεί. Ούτε η μισή λύση (πεζά μόνο στις μονοσύλλαβες) στέκει: ανακατεύει
 * δύο γραφές στην ίδια διεύθυνση. Δεν υπάρχει βοηθός για τόνους στο αποθετήριο
 * (το lib/greekName.ts κάνει μόνο κλητική ονομάτων). Ο χρήστης διορθώνει το
 * όνομα στην Επεξεργασία, αν θέλει. Το φυλάει το bulk.test.ts (§8).
 */
export const suggestName = (kind: string | null, address: string | null, floor: string | null, i: number): string =>
  [kind || 'Ακίνητο', address || `από το myAADE ${i + 1}`].join(', ') + (floor ? ` (όροφος ${floor})` : '');

export const isNew = (d: Draft): boolean => d.match.status === 'new' || (d.match.status === 'maybe' && d.same === false);
export const existingIdOf = (d: Draft): string | null =>
  (d.match.status === 'exists' || (d.match.status === 'maybe' && d.same === true) ? d.match.id : null);

export { BULK_MAX };

/**
 * Ποια ακίνητα του εγγράφου φαίνονται: έως `max`, με τη σειρά του εγγράφου,
 * ΠΡΩΤΑ όσα δεν υπάρχουν ήδη (ίδιος ΑΤΑΚ). Έτσι η δεύτερη εισαγωγή του ίδιου
 * αρχείου δείχνει τα επόμενα και όχι ξανά τα ίδια. `hidden` είναι όσα έμειναν
 * έξω, μαζί με όσα το έγγραφο έχει αλλά δεν δόθηκαν (`found`, π.χ. φωτογραφία).
 */
export function bulkWindow(doc: MyAadeImport, known: readonly KnownProperty[], max = BULK_MAX): { shown: number[]; total: number; hidden: number } {
  const total = Math.max(doc.found ?? 0, doc.properties.length);
  const order = doc.properties.map((p, i) => ({ i, exists: matchProperty(p, known).status === 'exists' }));
  const shown = [...order.filter(o => !o.exists), ...order.filter(o => o.exists)].slice(0, max).map(o => o.i).sort((a, b) => a - b);
  return { shown, total, hidden: total - shown.length };
}

/** Το έτος κατασκευής για πεδίο: τέσσερα ψηφία ή κενό. */
const yearText = (n: number | null | undefined): string => (n != null && Number.isInteger(n) ? String(n) : '');

/** Οι γραμμές του εγγράφου (έως BULK_MAX), με ταίριασμα και όριο πακέτου. Οι νέες πέρα από το όριο ξεκινούν ξετσεκαρισμένες. */
export function buildDrafts(doc: MyAadeImport, known: readonly KnownProperty[], slots: number): Draft[] {
  const drafts: Draft[] = bulkWindow(doc, known).shown.map(i => {
    const p = doc.properties[i];
    return {
      key: i, include: true, match: matchProperty(p, known), same: null,
      name: suggestName(p.kind, p.address, p.floor, i), address: p.address ?? '', atak: p.atak ?? '',
      sqm: toText(p.sqm), pct: toText(p.ownershipPct), floor: p.floor ?? '',
      postcode: p.postcode ?? '', yearBuilt: yearText(p.yearBuilt),
      municipality: p.municipality, prefecture: p.prefecture ?? null, district: p.district ?? null,
      category: p.category ?? null, right: p.right ?? null, auxSqm: p.auxSqm ?? null,
      kind: p.kind, tax: p.tax, check: p.check, overPlan: false,
    };
  });
  const over = new Set(overLimit(drafts.filter(r => r.match.status === 'new').map(r => r.key), slots));
  return drafts.map(r => (over.has(r.key) ? { ...r, include: false, overPlan: true } : r));
}

/** Ο ιδιοκτήτης που προτείνεται: αυτός με το ΑΦΜ της πράξης, αλλιώς κανένας (ρωτάμε). */
export function preselectOwner(owners: readonly KnownOwner[], afm: string | null): string | null {
  if (owners.length < 2) return null;
  return (afm && owners.find(o => o.afm === afm)?.id) || null;
}

export interface ReviewInput {
  rows: readonly Draft[];
  year: string;
  total: string;
  slots: number;
  /** Εισαγωγές που μένουν στις 24 ώρες· `null` = άγνωστο, δεν εμποδίζει. */
  left: number | null;
  owners: readonly KnownOwner[];
  ownerId: string | null;
  dailyLimit: number;
  /** Το τρέχον έτος, για την ένδειξη «πράξη άλλου έτους». */
  currentYear: number;
}

export interface ReviewState {
  chosen: Draft[];
  newCount: number;
  filledCount: number;
  unanswered: number;
  excess: number;
  /** Νέα που έμειναν εκτός, γιατί δεν χωρούν. */
  leftOut: number;
  yearN: number | null;
  totalN: number | null;
  /** Θα γραφτεί σύνολο ΕΝΦΙΑ: υπάρχει ποσό και σωστό έτος. */
  writesTotal: boolean;
  needsOwner: boolean;
  /** Ποσό μηδέν ή πιστωτικό: δεν είναι οφειλή, δεν γράφονται δόσεις. */
  noDebt: boolean;
  /** Η πράξη είναι άλλου έτους από το τρέχον (π.χ. περσινή). */
  otherYear: boolean;
  /** Γιατί δεν γίνεται ακόμη η αποθήκευση, με σειρά προτεραιότητας. Κενό = γίνεται. Σύντομα: χωρούν σε μία γραμμή. */
  blockers: { id: 'limit' | 'owner' | 'none' | 'maybe' | 'excess' | 'atak' | 'name' | 'postcode' | 'built' | 'total' | 'year'; text: string }[];
}

/** Ό,τι χρειάζεται η οθόνη για να ξέρει αν και τι αποθηκεύεται. Καθαρή συνάρτηση. */
export function deriveReview(i: ReviewInput): ReviewState {
  const chosen = i.rows.filter(r => r.include);
  const newCount = chosen.filter(isNew).length;
  const unanswered = chosen.filter(r => r.match.status === 'maybe' && r.same === null).length;
  const excess = excessOf(newCount, i.slots);
  const leftOut = i.rows.filter(r => !r.include && r.overPlan).length;
  const parsed = i.total.trim() === '' ? null : toNumber(i.total);
  const totalN = parsed === null ? null : toCents(parsed) / 100;
  const y = Number(i.year);
  const yearN = Number.isInteger(y) && y >= 2014 && y <= 2100 ? y : null;
  // Κάτι γράφτηκε και δεν διαβάζεται ως ποσό: εμποδίζει. Μηδέν ή αρνητικό ΔΙΑΒΑΖΕΤΑΙ
  // και απλώς δεν γράφει δόσεις: τα ακίνητα της πράξης περνούν κανονικά.
  const totalBad = i.total.trim() !== '' && parsed === null;
  const noDebt = totalN !== null && totalN <= 0;
  const needsOwner = i.owners.length > 1;
  const b: ReviewState['blockers'] = [];
  if (i.left === 0) b.push({ id: 'limit', text: `Έφτασες τις ${i.dailyLimit} εισαγωγές της ημέρας.` });
  if (needsOwner && !i.ownerId) b.push({ id: 'owner', text: 'Διάλεξε ιδιοκτήτη.' });
  if (!chosen.length) b.push({ id: 'none', text: 'Διάλεξε τουλάχιστον ένα ακίνητο.' });
  if (unanswered) b.push({ id: 'maybe', text: `Απάντησε για ${unanswered} ${plural(unanswered, 'ακίνητο', 'ακίνητα')}: «Ίσως υπάρχει».` });
  if (excess) b.push({ id: 'excess', text: `Ξετσέκαρε ${excess} ή δες τα πακέτα.` });
  if (chosen.some(r => r.atak.trim() !== '' && !isAtak(r.atak))) b.push({ id: 'atak', text: `Ο ΑΤΑΚ θέλει ${ATAK_DIGITS} ψηφία.` });
  if (chosen.some(r => isNew(r) && !r.name.trim())) b.push({ id: 'name', text: 'Δώσε όνομα στο νέο ακίνητο.' });
  if (chosen.some(r => r.postcode.trim() !== '' && !/^\d{5}$/.test(r.postcode.trim()))) b.push({ id: 'postcode', text: 'Ο Τ.Κ. θέλει 5 ψηφία.' });
  if (chosen.some(r => r.yearBuilt.trim() !== '' && yearBuiltOf(r.yearBuilt, i.currentYear) === null)) b.push({ id: 'built', text: 'Διόρθωσε το έτος κατασκευής.' });
  if (totalBad) b.push({ id: 'total', text: 'Διόρθωσε το ποσό.' });
  if (totalN !== null && totalN > 0 && yearN === null) b.push({ id: 'year', text: 'Συμπλήρωσε το έτος.' });
  return {
    chosen, newCount, filledCount: chosen.filter(r => existingIdOf(r)).length, unanswered, excess, leftOut,
    yearN, totalN, writesTotal: totalN !== null && totalN > 0 && yearN !== null, needsOwner,
    noDebt, otherYear: yearN !== null && yearN !== i.currentYear, blockers: b,
  };
}

/** Έτος κατασκευής από πεδίο: ακέραιος από 1800 ως το επόμενο έτος, αλλιώς `null`. */
export function yearBuiltOf(s: string, currentYear: number): number | null {
  const t = s.trim();
  if (!/^\d{4}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1800 && n <= currentYear + 1 ? n : null;
}

/**
 * Η γραμμή όπως φεύγει για αποθήκευση. Το έτος κατασκευής το έχει ήδη ελέγξει
 * το εμπόδιο «built» με το τρέχον έτος· εδώ μένει μόνο το εύρος της μορφής.
 * (Ένα όρισμα μόνο: καλείται ως `rows.map(commitRowOf)`.)
 */
export function commitRowOf(d: Draft) {
  return {
    existingId: existingIdOf(d), name: d.name, address: d.address || null, atak: isAtak(d.atak) ? atakDigits(d.atak) : null,
    sqm: toNumber(d.sqm), ownershipPct: toNumber(d.pct), floor: d.floor || null,
    postalCode: /^\d{5}$/.test(d.postcode.trim()) ? d.postcode.trim() : null, yearBuilt: yearBuiltOf(d.yearBuilt, 2099),
  };
}
