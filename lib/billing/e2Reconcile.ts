// ═══════════════════════════════════════════════════════════════════════════
// «Η ΑΑΔΕ ΓΡΑΦΕΙ 7.200,00€. Η ΕΦΑΡΜΟΓΗ 6.900,00€. ΝΑ ΓΙΑΤΙ ΚΑΙ ΠΟΥ ΔΙΟΡΘΩΝΕΤΑΙ.»
//
// ΓΙΑΤΙ ΑΥΤΟ ΚΑΙ ΟΧΙ ΑΛΛΟ
// Η ΑΑΔΕ στέλνει πλέον το Ε2 ΠΡΟΣΥΜΠΛΗΡΩΜΕΝΟ, από τις δηλώσεις μισθώσεων και
// τα στοιχεία των πλατφορμών. Το προσυμπληρωμένο όμως είναι ΣΥΧΝΑ ΛΑΘΟΣ και ο
// ιδιοκτήτης δεν έχει τρόπο να το ξέρει, γιατί δεν κρατά δικό του αρχείο. Αυτή
// είναι η μόνη λειτουργία που το κράτος δεν μπορεί να αποκτήσει: δεν μπορεί να
// είναι ταυτόχρονα ο ελεγχόμενος και ο ελεγκτής.
//
// ΜΕ ΤΙ ΣΥΓΚΡΙΝΕΙ. Με τις ΑΠΟΘΗΚΕΥΜΕΝΕΣ γραμμές του προσυμπληρωμένου
// (`e2_prefilled`), όχι με νούμερα που πληκτρολογήθηκαν και χάθηκαν. Ίδιο έτος,
// ίδιο ΑΦΜ υπόχρεου. Η μονάδα είναι η ΜΙΣΘΩΣΗ, όχι το ακίνητο: ακίνητο που
// άλλαξε μισθωτή έχει δύο γραμμές στο έντυπο και δύο στην εφαρμογή.
//
// ΠΩΣ ΤΑΙΡΙΑΖΕΙ ΓΡΑΜΜΕΣ, ΜΕ ΣΕΙΡΑ ΒΕΒΑΙΟΤΗΤΑΣ
//   1. ΑΤΑΚ και ΑΦΜ μισθωτή ίδια στις δύο πλευρές.
//   2. Αριθμός δήλωσης μίσθωσης, ίδιος.
//   3. ΑΦΜ μισθωτή, μοναδικό και στις δύο πλευρές.
//   4. ΑΤΑΚ, όταν έχει ακριβώς μία γραμμή αζευγάρωτη σε κάθε πλευρά (ή, με
//      περισσότερες, όταν τα διαστήματα επικαλύπτονται).
// Ποτέ με διεύθυνση: γράφεται αλλιώς σε κάθε έντυπο και ένα λάθος ζευγάρι
// παράγει φανταστική διαφορά που στέλνει τον χρήστη σε λάθος κατεύθυνση.
//
// ΚΑΜΙΑ ΕΞΗΓΗΣΗ ΧΩΡΙΣ ΑΠΟΔΕΙΞΗ. Κάθε εύρημα κουβαλά τα δύο νούμερα και τη
// διαφορά τους. Λέει και ΠΟΥ διορθώνεται: «Διόρθωσε στο myAADE», «Διόρθωσε
// στην εφαρμογή» ή, όπου τα στοιχεία δεν φτάνουν για να το πουν, «Έλεγξε με
// τον λογιστή». Δεν υπολογίζει φόρο. Δεν υποβάλλει τίποτα.
// ═══════════════════════════════════════════════════════════════════════════
import type { E2Property, E2RowDetail } from './e2';
import type { AadeE2Row, E2IncomeColumn } from '@/lib/tax/aadeE2';
import { isValidAfm } from '@/lib/core/greek';
import { fe, fp } from '../core/format';
import { e2PowerSupply } from '@/lib/property/powerSupply';

/**
 * Ανοχή στρογγυλοποίησης, σε ευρώ. Το `buildE2Row` στρογγυλοποιεί το μερίδιο
 * συνιδιοκτησίας στο ευρώ, οπότε διαφορά ενός ευρώ είναι αριθμητική, όχι
 * ουσιαστική. Κάθε ευρώ πάνω από αυτό είναι πραγματικό.
 */
export const TOLERANCE = 1;

/** Μία γραμμή του Ε2 της εφαρμογής: μία μίσθωση ενός ακινήτου στο έτος. */
export interface AppLeaseLine {
  key: string;
  propertyId: string;
  propertyName: string;
  atak: string | null;
  tenantName: string | null;
  tenantAfm: string | null;
  months: number | null;
  monthly: number | null;
  ownershipPct: number;
  /** Ακαθάριστο του μεριδίου του υπόχρεου. */
  gross: number;
  incomeColumn: E2IncomeColumn;
  /** Διάστημα μέσα στο έτος, ISO, όπου υπάρχει. */
  from: string | null;
  to: string | null;
  /** Οι μήνες βγήκαν από ημερομηνίες μίσθωσης ή διαμονές, όχι από εκτίμηση. */
  monthsFromRecords: boolean;
  /** Το ακαθάριστο είναι εκτίμηση (στόχος ή μηνιαίο × μήνες), όχι καταγραφή. */
  estimated: boolean;
  shortTerm: boolean;
  /** Ο αριθμός δήλωσης μίσθωσης (στ. 19): της μίσθωσης, αλλιώς του ακινήτου. */
  declRef: string | null;
  /** Ο αριθμός παροχής ρεύματος του ακινήτου (στ. 18), τα 9 πρώτα ψηφία. */
  powerSupply?: string | null;
  /** Στοιχεία που εξηγούν διαφορές ποσού (μόνο στην πρώτη γραμμή του ακινήτου). */
  platformFees?: number | null;
  climateLevy?: number | null;
  unpaid?: number | null;
}

/** Ό,τι ξέρουμε επιπλέον για ένα ακίνητο και βοηθά να εξηγηθεί μια διαφορά. */
export interface AppEvidence {
  platformFees?: number | null;
  climateLevy?: number | null;
  unpaid?: number | null;
}

/** «ΗΗ/ΜΜ/ΕΕΕΕ» του εντύπου σε ISO, για σύγκριση διαστημάτων. */
const iso = (dmy: string): string | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dmy);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

/**
 * Οι γραμμές της εφαρμογής, από το ίδιο `buildE2Row` που γράφει το Excel του
 * Ε2. Καμία δεύτερη αριθμητική: ό,τι συγκρίνεται είναι ό,τι θα υποβαλλόταν.
 */
export function appLinesOf(
  p: Pick<E2Property, 'id' | 'name' | 'address' | 'atak' | 'power_supply_no'>, row: E2RowDetail,
  opts: { declRef?: string | null; evidence?: AppEvidence; shortTerm?: boolean } = {},
): AppLeaseLine[] {
  const name = (p.name || '').trim() || p.address || p.atak || 'Ακίνητο';
  return row.lines.map((l, i) => ({
    key: `${p.id}:${i}`,
    propertyId: p.id,
    propertyName: name,
    atak: (p.atak || '').replace(/\s/g, '') || null,
    tenantName: l.tenantName || null,
    tenantAfm: l.tenantAfm ? l.tenantAfm.replace(/\s/g, '') : null,
    months: l.months === '' ? null : l.months,
    monthly: l.monthly === '' ? null : l.monthly,
    ownershipPct: row.ownershipPct,
    gross: l.gross,
    incomeColumn: l.source === 'own_use' ? 15 : 13,
    from: iso(l.from),
    to: iso(l.to),
    monthsFromRecords: !l.monthsEstimated && l.months !== '',
    estimated: !!l.estimated,
    shortTerm: !!opts.shortTerm,
    // Ο αριθμός της ίδιας της μίσθωσης πρώτα (tenants.aade_lease_decl_ref). Ο
    // αριθμός του ιστορικού είναι ένας ανά ακίνητο και πάει στην τελευταία.
    declRef: l.declRef || (i === row.lines.length - 1 ? (opts.declRef || null) : null),
    powerSupply: e2PowerSupply(p.power_supply_no) || null,
    ...(i === 0 ? opts.evidence : {}),
  }));
}

export type FixIn = 'aade' | 'app' | 'check';
export type FindingKind = 'missing_in_aade' | 'missing_in_app' | 'gross' | 'column' | 'months' | 'tenant_afm' | 'decl_ref' | 'power_supply' | 'share';

/** Ενας λόγος που εξηγεί μέρος μιας διαφοράς ποσού, με το ποσό του. */
export interface Reason { code: string; text: string; amount: number | null }

export interface Finding {
  kind: FindingKind;
  /** Η διαπίστωση, με τα δύο νούμερα και τη διαφορά. */
  text: string;
  /** Τι γράφει η εφαρμογή και τι η ΑΑΔΕ, για πίνακα. */
  ours: string;
  theirs: string;
  /** εφαρμογή − ΑΑΔΕ, όπου είναι ποσό ή πλήθος. */
  diff: number | null;
  fixIn: FixIn;
  /** Η επόμενη κίνηση, σε μία πρόταση που ξεκινά με το πού. */
  action: string;
  reasons?: Reason[];
}

export interface ReconLine {
  key: string;
  propertyName: string;
  atak: string | null;
  /** Μισθωτής (όνομα ή ΑΦΜ), όπως τον ξέρει όποια πλευρά τον ξέρει. */
  tenant: string | null;
  app: AppLeaseLine | null;
  aade: AadeE2Row | null;
  matchedBy: 'atak_tenant' | 'decl' | 'tenant' | 'atak' | null;
  status: 'match' | 'differs' | 'missing_in_aade' | 'missing_in_app' | 'vacant';
  findings: Finding[];
}

export interface PrefilledReconciliation {
  lines: ReconLine[];
  totalOurs: number;
  totalTheirs: number;
  totalDiff: number;
  /** Πόσες γραμμές θέλουν διόρθωση κάπου. */
  differences: number;
  matched: number;
  status: 'not_uploaded' | 'matches' | 'differences';
  /** Η μία φράση για την κορυφή. `null` όταν δεν ανέβηκε τίποτα. */
  headline: string | null;
}

export const FIX_LABEL: Record<FixIn, string> = {
  aade: 'Διόρθωσε στο myAADE',
  app: 'Διόρθωσε στην εφαρμογή',
  check: 'Έλεγξε με τον λογιστή',
};

const COLUMN_LABEL: Record<E2IncomeColumn, string> = {
  13: 'στ. 13 (εκμίσθωση)', 14: 'στ. 14 (δωρεάν παραχώρηση)', 15: 'στ. 15 (ιδιοχρησιμοποίηση)', 16: 'στ. 16 (ανείσπρακτα)',
};

const norm = (s: string | null | undefined): string => String(s ?? '').replace(/\s/g, '').toUpperCase();
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const near = (a: number, b: number) => Math.abs(a - b) <= TOLERANCE;
/** Οι στήλες 13 και 16 είναι και οι δύο μίσθωμα: τα ανείσπρακτα είναι μίσθωμα που δεν εισπράχθηκε. */
const family = (c: E2IncomeColumn): 'rent' | 'free' | 'own_use' => (c === 15 ? 'own_use' : c === 14 ? 'free' : 'rent');

/** Οι λόγοι μιας διαφοράς ποσού, πρώτα όσοι εξηγούν τα περισσότερα ευρώ. */
function explainGross(app: AppLeaseLine, aade: AadeE2Row, diff: number): Reason[] {
  const out: Reason[] = [];
  const abs = Math.abs(diff);
  // Μήνες: η συχνότερη πραγματική αιτία. Λέγεται ΜΟΝΟ όταν οι μήνες διαφέρουν.
  if (aade.months != null && app.months != null && aade.months !== app.months && app.months > 0 && app.gross > 0) {
    const d = app.months - aade.months;
    const pm = app.gross / app.months;
    out.push({
      code: 'months',
      text: `Η εφαρμογή μετρά ${plural(app.months, 'μήνα', 'μήνες')}, η ΑΑΔΕ ${aade.months}: ${plural(Math.abs(d), 'μήνας', 'μήνες')} × ${fe(pm)} = ${fe(Math.abs(pm * d))}.`,
      amount: Math.round(pm * d),
    });
  }
  // Συνιδιοκτησία: η ΑΑΔΕ δείχνει ολόκληρο το μίσθωμα, η εφαρμογή το μερίδιο.
  if (app.ownershipPct > 0 && app.ownershipPct < 100 && app.gross > 0 && aade.gross > 0) {
    const full = app.gross * 100 / app.ownershipPct;
    if (Math.abs(full - aade.gross) <= Math.max(TOLERANCE, aade.gross * 0.01)) {
      out.push({
        code: 'ownership',
        text: `Η ΑΑΔΕ γράφει ολόκληρο το μίσθωμα (${fe(aade.gross)}). Το μερίδιό σου, ${fp(app.ownershipPct)}, είναι ${fe(app.gross)}.`,
        amount: Math.round(app.gross - aade.gross),
      });
    }
  }
  // Βραχυχρόνια: η πλατφόρμα δηλώνει ΑΚΑΘΑΡΙΣΤΑ, πριν την προμήθειά της.
  const fees = app.platformFees ?? 0;
  if (app.shortTerm && fees > 0 && diff < 0 && Math.abs(abs - fees) <= Math.max(TOLERANCE, fees * 0.2)) {
    out.push({
      code: 'platform_fee',
      text: `Η διαφορά είναι όση η προμήθεια της πλατφόρμας (${fe(fees)}). Η πλατφόρμα δηλώνει ακαθάριστα· αν καταχώρησες το ποσό που μπήκε στον λογαριασμό σου, λείπει η προμήθεια, που είναι έξοδο και όχι μείωση του εσόδου.`,
      amount: -Math.round(fees),
    });
  }
  // Τέλος ανθεκτικότητας: το πληρώνει ο επισκέπτης και το αποδίδεις.
  const levy = app.climateLevy ?? 0;
  if (app.shortTerm && levy > 0 && diff < 0 && Math.abs(abs - levy) <= Math.max(TOLERANCE, levy * 0.2)) {
    out.push({
      code: 'climate_levy',
      text: `Η διαφορά είναι όσο το τέλος ανθεκτικότητας που εισέπραξες και απέδωσες (${fe(levy)}). Δεν είναι έσοδό σου.`,
      amount: -Math.round(levy),
    });
  }
  // Ανείσπρακτα: το Ε2 δηλώνει ΔΕΔΟΥΛΕΥΜΕΝΑ. Προειδοποίηση, όχι εξήγηση.
  const unpaid = app.unpaid ?? 0;
  if (unpaid > 0 && diff > 0) {
    out.push({
      code: 'unpaid',
      text: `Έχεις ${fe(unpaid)} ανείσπρακτα. Το Ε2 δηλώνει ό,τι οφείλεται, ανεξάρτητα από την είσπραξη· μεταφέρονται στη στ. 16 μόνο με διαταγή πληρωμής ή αγωγή.`,
      amount: null,
    });
  }
  if (app.estimated) {
    out.push({
      code: 'ours_estimated',
      text: 'Το ποσό της εφαρμογής είναι εκτίμηση από το μηνιαίο μίσθωμα, όχι καταγραφή εισπράξεων.',
      amount: null,
    });
  }
  return out.sort((a, b) => Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0));
}

/** Τα ευρήματα ενός ζευγαριού γραμμών. Κενό σημαίνει ότι συμφωνούν. */
function compare(app: AppLeaseLine, aade: AadeE2Row): Finding[] {
  const out: Finding[] = [];

  // ── Ποσό και στήλη ─────────────────────────────────────────────────────
  if (family(app.incomeColumn) !== family(aade.incomeColumn) && (app.gross > 0 || aade.gross > 0)) {
    out.push({
      kind: 'column',
      text: `Η εφαρμογή γράφει το ποσό στη ${COLUMN_LABEL[app.incomeColumn]}, η ΑΑΔΕ στη ${COLUMN_LABEL[aade.incomeColumn]}.`,
      ours: COLUMN_LABEL[app.incomeColumn], theirs: COLUMN_LABEL[aade.incomeColumn], diff: null,
      fixIn: 'check',
      action: `${FIX_LABEL.check}: το είδος της χρήσης κρίνει τη στήλη και τον φόρο.`,
    });
  }
  const diff = Math.round((app.gross - aade.gross) * 100) / 100;
  if (!near(app.gross, aade.gross)) {
    const reasons = explainGross(app, aade, diff);
    const explained = reasons.reduce((s, r) => s + (r.amount ?? 0), 0);
    const rest = Math.round(diff - explained);
    const has = (c: string) => reasons.some(r => r.code === c);
    let fixIn: FixIn;
    let what: string;
    if (app.estimated) { fixIn = 'app'; what = 'καταχώρησε τα πραγματικά μισθώματα του έτους και ξαναδές τη σύγκριση.'; }
    else if (has('ownership') && Math.abs(rest) <= TOLERANCE) { fixIn = 'aade'; what = `δήλωσε μόνο το μερίδιό σου, ${fe(app.gross)}, με ποσοστό ${fp(app.ownershipPct)} στη στ. 12.`; }
    else if (has('platform_fee') && Math.abs(rest) <= TOLERANCE) { fixIn = 'app'; what = 'καταχώρησε τις διαμονές με το ακαθάριστο ποσό και την προμήθεια χωριστά.'; }
    else if (has('climate_levy') && Math.abs(rest) <= TOLERANCE) { fixIn = 'aade'; what = `αφαίρεσε το τέλος ανθεκτικότητας (${fe(app.climateLevy ?? 0)}) από το ακαθάριστο.`; }
    else if (has('months') && Math.abs(rest) <= TOLERANCE && app.monthsFromRecords) { fixIn = 'aade'; what = `οι μήνες είναι ${app.months} κατά τις ημερομηνίες της μίσθωσης· το ακαθάριστο είναι ${fe(app.gross)}.`; }
    else { fixIn = 'check'; what = Math.abs(rest) > TOLERANCE ? `${fe(Math.abs(rest))} δεν εξηγούνται από τα στοιχεία της εφαρμογής.` : 'η διαφορά εξηγείται, αλλά η διόρθωση θέλει απόφαση.'; }
    out.push({
      kind: 'gross',
      text: `Ακαθάριστο: η εφαρμογή ${fe(app.gross)}, η ΑΑΔΕ ${fe(aade.gross)}, διαφορά ${fe(Math.abs(diff))}.`,
      ours: fe(app.gross), theirs: fe(aade.gross), diff,
      fixIn, action: `${FIX_LABEL[fixIn]}: ${what}`, reasons,
    });
  }

  // ── Μήνες ──────────────────────────────────────────────────────────────
  if (aade.months != null && app.months != null && aade.months !== app.months) {
    const fixIn: FixIn = app.monthsFromRecords && !app.estimated ? 'aade' : 'app';
    out.push({
      kind: 'months',
      text: `Μήνες: η εφαρμογή ${app.months}, η ΑΑΔΕ ${aade.months}, διαφορά ${Math.abs(app.months - aade.months)}.`,
      ours: String(app.months), theirs: String(aade.months), diff: app.months - aade.months,
      fixIn,
      action: fixIn === 'aade'
        ? `${FIX_LABEL.aade}: στη στ. 10 γράψε ${app.months}, όσους μήνες καλύπτει η μίσθωση μέσα στο έτος.`
        : `${FIX_LABEL.app}: συμπλήρωσε τις ημερομηνίες της μίσθωσης, ώστε οι μήνες να βγαίνουν από αυτές.`,
    });
  }

  // ── Ποσοστό συνιδιοκτησίας ─────────────────────────────────────────────
  if (aade.ownershipPct != null && Math.abs(aade.ownershipPct - app.ownershipPct) > 0.01) {
    out.push({
      kind: 'share',
      text: `Ποσοστό: η εφαρμογή ${fp(app.ownershipPct)}, η ΑΑΔΕ ${fp(aade.ownershipPct)}.`,
      ours: fp(app.ownershipPct), theirs: fp(aade.ownershipPct), diff: Math.round((app.ownershipPct - aade.ownershipPct) * 100) / 100,
      fixIn: 'app',
      action: `${FIX_LABEL.app}: το ποσοστό της ΑΑΔΕ έρχεται από το Ε9. Αν το Ε9 είναι σωστό, γράψε ${fp(aade.ownershipPct)} στο ακίνητο.`,
    });
  }

  // ── ΑΦΜ μισθωτή ────────────────────────────────────────────────────────
  if (app.tenantAfm && aade.tenantAfm && norm(app.tenantAfm) !== norm(aade.tenantAfm)) {
    const appOk = isValidAfm(app.tenantAfm), aadeOk = isValidAfm(aade.tenantAfm);
    const fixIn: FixIn = !appOk && aadeOk ? 'app' : appOk && !aadeOk ? 'aade' : 'check';
    out.push({
      kind: 'tenant_afm',
      text: `ΑΦΜ μισθωτή: η εφαρμογή ${app.tenantAfm}${appOk ? '' : ' (άκυρο)'}, η ΑΑΔΕ ${aade.tenantAfm}${aadeOk ? '' : ' (άκυρο)'}.`,
      ours: app.tenantAfm, theirs: aade.tenantAfm, diff: null, fixIn,
      action: fixIn === 'app' ? `${FIX_LABEL.app}: το ΑΦΜ του μισθωτή δεν είναι έγκυρο· γράψε αυτό του μισθωτηρίου.`
        : fixIn === 'aade' ? `${FIX_LABEL.aade}: το ΑΦΜ στη δήλωση μίσθωσης δεν είναι έγκυρο· διόρθωσέ τη.`
        : `${FIX_LABEL.check}: ένα από τα δύο είναι λάθος· σύγκρινέ τα με το μισθωτήριο.`,
    });
  }

  // ── Αριθμός δήλωσης μίσθωσης ───────────────────────────────────────────
  if (app.declRef && aade.leaseDeclRef && norm(app.declRef) !== norm(aade.leaseDeclRef)) {
    out.push({
      kind: 'decl_ref',
      text: `Αριθμός δήλωσης μίσθωσης: η εφαρμογή ${app.declRef}, η ΑΑΔΕ ${aade.leaseDeclRef}.`,
      ours: app.declRef, theirs: aade.leaseDeclRef, diff: null, fixIn: 'app',
      action: `${FIX_LABEL.app}: τον αριθμό τον δίνει η ΑΑΔΕ· γράψε ${aade.leaseDeclRef} στη δήλωση μίσθωσης του ακινήτου.`,
    });
  }

  // ── Αριθμός παροχής ρεύματος (στ. 18, Φ-01.002/Έκδοση 2026) ────────────
  // Συγκρίνονται τα 9 πρώτα ψηφία, όσα ζητά η στήλη· μόνο όταν τα ξέρουν και οι δύο.
  const ourPower = e2PowerSupply(app.powerSupply), theirPower = e2PowerSupply(aade.powerSupplyNo);
  if (ourPower && theirPower && ourPower !== theirPower) {
    out.push({
      kind: 'power_supply',
      text: `Αριθμός παροχής ρεύματος: η εφαρμογή ${ourPower}, η ΑΑΔΕ ${theirPower}.`,
      ours: ourPower, theirs: theirPower, diff: null, fixIn: 'check',
      action: `${FIX_LABEL.check}: σύγκρινε με τον λογαριασμό ρεύματος του ακινήτου και διόρθωσε όποια πλευρά διαφέρει.`,
    });
  }
  return out;
}

/** Ημέρες επικάλυψης δύο διαστημάτων· 0 όταν λείπει κάποια ημερομηνία. */
const overlapDays = (a: AppLeaseLine, b: AadeE2Row): number => {
  if (!a.from || !a.to || !b.from || !b.to) return 0;
  const s = a.from > b.from ? a.from : b.from, e = a.to < b.to ? a.to : b.to;
  return e < s ? 0 : (Date.parse(e) - Date.parse(s)) / 86_400_000 + 1;
};

/**
 * Η σύγκριση των γραμμών της εφαρμογής με τις αποθηκευμένες γραμμές του
 * προσυμπληρωμένου. Ιδιο έτος και ίδιο ΑΦΜ υπόχρεου: η επιλογή γίνεται από
 * τον καλούντα.
 */
export function reconcilePrefilled(app: readonly AppLeaseLine[], aade: readonly AadeE2Row[]): PrefilledReconciliation {
  const freeApp = new Set(app.map((_, i) => i));
  const freeAade = new Set(aade.map((_, i) => i));
  const pairs: { a: number; d: number; by: NonNullable<ReconLine['matchedBy']> }[] = [];
  const take = (a: number, d: number, by: NonNullable<ReconLine['matchedBy']>) => {
    freeApp.delete(a); freeAade.delete(d); pairs.push({ a, d, by });
  };

  // 1. ΑΤΑΚ και ΑΦΜ μισθωτή.
  for (const a of [...freeApp]) {
    const x = app[a];
    if (!x.atak || !x.tenantAfm) continue;
    const d = [...freeAade].find(i => norm(aade[i].atak) === norm(x.atak) && norm(aade[i].tenantAfm) === norm(x.tenantAfm));
    if (d !== undefined) take(a, d, 'atak_tenant');
  }
  // 2. Αριθμός δήλωσης μίσθωσης.
  for (const a of [...freeApp]) {
    const x = app[a];
    if (!x.declRef) continue;
    const d = [...freeAade].find(i => norm(aade[i].leaseDeclRef) === norm(x.declRef));
    if (d !== undefined) take(a, d, 'decl');
  }
  // 3. ΑΦΜ μισθωτή, μοναδικό και στις δύο πλευρές.
  for (const a of [...freeApp]) {
    const x = app[a];
    if (!x.tenantAfm) continue;
    const ds = [...freeAade].filter(i => norm(aade[i].tenantAfm) === norm(x.tenantAfm));
    const as = [...freeApp].filter(i => norm(app[i].tenantAfm) === norm(x.tenantAfm));
    if (ds.length === 1 && as.length === 1 && (!aade[ds[0]].atak || !x.atak || norm(aade[ds[0]].atak) === norm(x.atak))) take(a, ds[0], 'tenant');
  }
  // 4. ΑΤΑΚ: μία προς μία, αλλιώς με επικάλυψη διαστημάτων.
  const ataks = new Set([...freeApp].map(i => norm(app[i].atak)).filter(Boolean));
  for (const k of ataks) {
    const as = [...freeApp].filter(i => norm(app[i].atak) === k);
    const ds = [...freeAade].filter(i => norm(aade[i].atak) === k);
    if (as.length === 1 && ds.length === 1) { take(as[0], ds[0], 'atak'); continue; }
    // Περισσότερες μισθώσεις στο ίδιο ακίνητο: ζευγάρι μόνο όπου τα διαστήματα
    // επικαλύπτονται, με τη μεγαλύτερη επικάλυψη. Χωρίς ημερομηνίες δεν
    // μαντεύουμε: οι γραμμές μένουν αζευγάρωτες και λέγονται.
    for (const a of as) {
      let best = -1, bestDays = 0;
      for (const i of ds) {
        if (!freeAade.has(i)) continue;
        const days = overlapDays(app[a], aade[i]);
        if (days > bestDays) { best = i; bestDays = days; }
      }
      if (best >= 0) take(a, best, 'atak');
    }
  }

  const lines: ReconLine[] = [];
  for (const { a, d, by } of pairs) {
    const x = app[a], y = aade[d];
    const findings = compare(x, y);
    lines.push({
      key: x.key, propertyName: x.propertyName, atak: x.atak ?? y.atak,
      tenant: x.tenantName || y.tenantName || x.tenantAfm || y.tenantAfm || null,
      app: x, aade: y, matchedBy: by, status: findings.length ? 'differs' : 'match', findings,
    });
  }
  for (const a of freeApp) {
    const x = app[a];
    if (!(x.gross > 0)) {
      lines.push({ key: x.key, propertyName: x.propertyName, atak: x.atak, tenant: x.tenantName || x.tenantAfm, app: x, aade: null, matchedBy: null, status: 'vacant', findings: [] });
      continue;
    }
    const fixIn: FixIn = x.estimated ? 'app' : 'aade';
    lines.push({
      key: x.key, propertyName: x.propertyName, atak: x.atak, tenant: x.tenantName || x.tenantAfm,
      app: x, aade: null, matchedBy: null, status: 'missing_in_aade',
      findings: [{
        kind: 'missing_in_aade',
        text: `Λείπει από την ΑΑΔΕ: η εφαρμογή έχει ${fe(x.gross)}${x.months ? ` για ${plural(x.months, 'μήνα', 'μήνες')}` : ''}${x.atak ? '' : ' (χωρίς ΑΤΑΚ στην εφαρμογή)'}.`,
        ours: fe(x.gross), theirs: '', diff: x.gross, fixIn,
        action: fixIn === 'app'
          ? `${FIX_LABEL.app}: το ποσό είναι εκτίμηση· αν η μίσθωση δεν υπήρξε, άλλαξε την κατάσταση του ακινήτου.`
          : `${FIX_LABEL.aade}: πρόσθεσε τη γραμμή στο Ε2${x.atak ? '' : ' και συμπλήρωσε τον ΑΤΑΚ στην εφαρμογή για να γίνεται η ταύτιση'}.`,
      }],
    });
  }
  for (const d of freeAade) {
    const y = aade[d];
    lines.push({
      key: `aade:${d}`, propertyName: y.address || (y.atak ? `ΑΤΑΚ ${y.atak}` : 'Γραμμή της ΑΑΔΕ'),
      atak: y.atak, tenant: y.tenantName || y.tenantAfm, app: null, aade: y, matchedBy: null, status: 'missing_in_app',
      findings: [{
        kind: 'missing_in_app',
        text: `Λείπει από την εφαρμογή: η ΑΑΔΕ γράφει ${fe(y.gross)}${y.months ? ` για ${plural(y.months, 'μήνα', 'μήνες')}` : ''}${y.tenantAfm ? `, μισθωτής ${y.tenantAfm}` : ''}.`,
        ours: '', theirs: fe(y.gross), diff: -y.gross, fixIn: 'app',
        action: `${FIX_LABEL.app}: καταχώρησε τη μίσθωση με ΑΤΑΚ και ΑΦΜ μισθωτή. Αν δεν υπήρξε τέτοια μίσθωση, ζήτα διόρθωση στο myAADE.`,
      }],
    });
  }

  const totalOurs = Math.round(app.reduce((s, x) => s + x.gross, 0) * 100) / 100;
  const totalTheirs = Math.round(aade.reduce((s, y) => s + y.gross, 0) * 100) / 100;
  const totalDiff = Math.round((totalOurs - totalTheirs) * 100) / 100;
  const differences = lines.filter(l => l.status === 'differs' || l.status === 'missing_in_aade' || l.status === 'missing_in_app').length;
  const matched = lines.filter(l => l.status === 'match').length;
  // Πρώτα όσα θέλουν διόρθωση, μετά τα σύμφωνα· μέσα σε κάθε ομάδα κατά ακίνητο.
  const rank = { missing_in_app: 0, missing_in_aade: 1, differs: 2, match: 3, vacant: 4 } as const;
  lines.sort((p, q) => rank[p.status] - rank[q.status] || p.propertyName.localeCompare(q.propertyName, 'el'));

  let headline: string | null = null;
  const status: PrefilledReconciliation['status'] = aade.length === 0 ? 'not_uploaded' : differences === 0 ? 'matches' : 'differences';
  if (status === 'matches') headline = `Η ΑΑΔΕ και η εφαρμογή συμφωνούν ${matched === 1 ? 'στη μία γραμμή' : `και στις ${matched} γραμμές`}: ${fe(totalTheirs)}.`;
  else if (status === 'differences') {
    headline = `Η ΑΑΔΕ γράφει ${fe(totalTheirs)}, η εφαρμογή ${fe(totalOurs)}. ${differences === 1 ? 'Μία γραμμή θέλει' : `${differences} γραμμές θέλουν`} διόρθωση.`;
  }
  return { lines, totalOurs, totalTheirs, totalDiff, differences, matched, status, headline };
}
