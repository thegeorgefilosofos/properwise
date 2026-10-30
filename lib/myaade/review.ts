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
import { plural } from '@/lib/core/greek';
import { atakDigits, isAtak, ATAK_DIGITS } from '@/lib/property/atak';
import { matchProperty, type KnownProperty, type MatchResult } from './match';
import { overLimit, excessOf } from './planLimit';
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
  municipality: string | null;
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

export const toText = (n: number | null | undefined): string => (n == null ? '' : String(n).replace('.', ','));
export const toNumber = (s: string): number | null => {
  const t = s.trim().replace(/\./g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/** Πρόταση ονόματος για νέο ακίνητο: είδος, διεύθυνση, όροφος. */
export const suggestName = (kind: string | null, address: string | null, floor: string | null, i: number): string =>
  [kind || 'Ακίνητο', address || `από το myAADE ${i + 1}`].join(', ') + (floor ? ` (όροφος ${floor})` : '');

export const isNew = (d: Draft): boolean => d.match.status === 'new' || (d.match.status === 'maybe' && d.same === false);
export const existingIdOf = (d: Draft): string | null =>
  (d.match.status === 'exists' || (d.match.status === 'maybe' && d.same === true) ? d.match.id : null);

/** Οι γραμμές της πράξης, με ταίριασμα και όριο πακέτου. Οι νέες πέρα από το όριο ξεκινούν ξετσεκαρισμένες. */
export function buildDrafts(doc: MyAadeImport, known: readonly KnownProperty[], slots: number): Draft[] {
  const drafts: Draft[] = doc.properties.map((p, i) => ({
    key: i, include: true, match: matchProperty(p, known), same: null,
    name: suggestName(p.kind, p.address, p.floor, i), address: p.address ?? '', atak: p.atak ?? '',
    sqm: toText(p.sqm), pct: toText(p.ownershipPct), floor: p.floor ?? '',
    municipality: p.municipality, kind: p.kind, tax: p.tax, check: p.check, overPlan: false,
  }));
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
  /** Γιατί δεν γίνεται ακόμη η αποθήκευση, με σειρά προτεραιότητας. Κενό = γίνεται. */
  blockers: { id: 'limit' | 'owner' | 'none' | 'maybe' | 'excess' | 'atak' | 'name' | 'total' | 'year'; text: string }[];
}

/** Ό,τι χρειάζεται η οθόνη για να ξέρει αν και τι αποθηκεύεται. Καθαρή συνάρτηση. */
export function deriveReview(i: ReviewInput): ReviewState {
  const chosen = i.rows.filter(r => r.include);
  const newCount = chosen.filter(isNew).length;
  const unanswered = chosen.filter(r => r.match.status === 'maybe' && r.same === null).length;
  const excess = excessOf(newCount, i.slots);
  const leftOut = i.rows.filter(r => !r.include && r.overPlan).length;
  const totalN = toNumber(i.total);
  const y = Number(i.year);
  const yearN = Number.isInteger(y) && y >= 2014 && y <= 2100 ? y : null;
  const totalBad = i.total.trim() !== '' && !(totalN && totalN > 0);
  const needsOwner = i.owners.length > 1;
  const b: ReviewState['blockers'] = [];
  if (i.left === 0) b.push({ id: 'limit', text: `Έφτασες τις ${i.dailyLimit} εισαγωγές των τελευταίων 24 ωρών. Δοκίμασε αργότερα.` });
  if (needsOwner && !i.ownerId) b.push({ id: 'owner', text: 'Διάλεξε ποιου ιδιοκτήτη είναι η πράξη.' });
  if (!chosen.length) b.push({ id: 'none', text: 'Διάλεξε τουλάχιστον ένα ακίνητο.' });
  if (unanswered) b.push({ id: 'maybe', text: `Πες μας αν ${plural(unanswered, 'το ακίνητο με την ετικέτα «Ίσως υπάρχει» είναι', `τα ${unanswered} ακίνητα με την ετικέτα «Ίσως υπάρχει» είναι`)} ήδη στην εφαρμογή.` });
  if (excess) b.push({ id: 'excess', text: `Το πακέτο σου χωρά ${i.slots === 0 ? 'κανένα νέο ακίνητο' : `ακόμη ${i.slots} ${plural(i.slots, 'νέο ακίνητο', 'νέα ακίνητα')}`}. Ξετσέκαρε ${excess} ή δες τα πακέτα.` });
  if (chosen.some(r => r.atak.trim() !== '' && !isAtak(r.atak))) b.push({ id: 'atak', text: `Ένας ΑΤΑΚ δεν έχει ${ATAK_DIGITS} ψηφία. Διόρθωσέ τον ή άφησέ τον κενό.` });
  if (chosen.some(r => isNew(r) && !r.name.trim())) b.push({ id: 'name', text: 'Ένα νέο ακίνητο δεν έχει όνομα.' });
  if (totalBad) b.push({ id: 'total', text: 'Το ποσό για καταβολή δεν διαβάζεται. Γράψε το όπως το δείχνει η πράξη, με κόμμα στα δεκαδικά.' });
  if (totalN && totalN > 0 && yearN === null) b.push({ id: 'year', text: 'Γράψε το έτος της πράξης.' });
  return {
    chosen, newCount, filledCount: chosen.filter(r => existingIdOf(r)).length, unanswered, excess, leftOut,
    yearN, totalN: totalN && totalN > 0 ? totalN : null, writesTotal: !!(totalN && totalN > 0 && yearN), needsOwner, blockers: b,
  };
}

/** Η γραμμή όπως φεύγει για αποθήκευση. */
export function commitRowOf(d: Draft) {
  return {
    existingId: existingIdOf(d), name: d.name, address: d.address || null, atak: isAtak(d.atak) ? atakDigits(d.atak) : null,
    sqm: toNumber(d.sqm), ownershipPct: toNumber(d.pct), floor: d.floor || null,
  };
}
