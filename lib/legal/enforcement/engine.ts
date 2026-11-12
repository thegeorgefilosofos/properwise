// ═══════════════════════════════════════════════════════════════════════════
// Η ΜΗΧΑΝΗ ΠΡΟΘΕΣΜΙΩΝ ΤΗΣ ΠΡΟΣΤΑΣΙΑΣ ΙΔΙΟΚΤΗΤΗ
// ─────────────────────────────────────────────────────────────────────────
// Καθαρή, ντετερμινιστική συνάρτηση: επιβεβαιωμένα στοιχεία + `today` →
// χρονοδιάγραμμα. Δεν διαβάζει βάση, δεν διαβάζει ρολόι, δεν κρατά τίποτα.
//
// ΠΟΤΕ ΨΕΥΔΟΑΚΡΙΒΕΙΑ. Επειδή οι συμβάσεις υπολογισμού (ΚΠολΔ 144 έως 146,
// ορισμός εργάσιμης, τοπικές αργίες) δεν επαληθεύτηκαν από δύο πηγές, κάθε
// προθεσμία βγαίνει ως ΕΥΡΟΣ, με την ασφαλή ημερομηνία τονισμένη. Μία μόνο
// ημερομηνία βγαίνει μόνο όταν τη γράφει ο ίδιος ο νόμος (π.χ. 30/06/2027).
//
// Κάθε κανόνας περνά από την πύλη (gate.ts) εδώ μέσα. Κανόνας που δεν
// επαληθεύτηκε δίνει στοιχείο «Επιβεβαίωσε με δικηγόρο», ποτέ ημερομηνία.
//
// Οι προθεσμίες του δικαστηρίου, του επιμελητή ή του servicer δεν
// παρουσιάζονται ως δικές σου: έχουν είδος 'expected' ή 'window'.
// ═══════════════════════════════════════════════════════════════════════════
import {
  addDays, addMonths, addMonthsDetail, assertIso, backWorking, forwardCalendar, isAugust,
  isWorking, mondayBefore, nextWorking, rollBack, rollForward, spansAugust,
} from './calc';
import { displayable, type Tier } from './gate';
import { rule } from './rules';
import type { Regime } from './types';

/** Ημερομηνία που έδωσε ο χρήστης· 'unknown' = «δεν ξέρω»· null = δεν υπάρχει. */
export type DateFact = string | 'unknown' | null;

export type Received = 'diatagi' | 'epitagi' | 'katasxesi' | 'perilipsi' | 'synexisi' | 'servicer' | 'dimosio';

export type CaseFacts = {
  /** Phase 1: μόνο ακίνητα. Κινητό: η μηχανή αρνείται. */
  asset: 'property' | 'movable';
  received: Received;
  epitagi: DateFact;
  seizure: DateFact;
  auction: DateFact;
  auctionFirst: 'yes' | 'no' | 'unknown';
  continuation: DateFact;
  servicerRequest: DateFact;
  publicDebt: 'yes' | 'no' | 'unknown';
  /** Πότε σκέφτεσαι να υποβάλεις στον εξωδικαστικό· null = σήμερα. */
  exodikastikos: DateFact;
};

export type FactKey = 'epitagi' | 'seizure' | 'auction' | 'continuation' | 'servicerRequest' | 'exodikastikos' | 'law';

export type Span = {
  earliest: string;
  latest: string;
  /** Η ημερομηνία που τονίζει η οθόνη: για τον χρήστη η νωρίτερη, για τρίτους η αργότερη. */
  safe: string;
};

export type ItemKind = 'deadline' | 'expected' | 'window' | 'cutoff' | 'fixed' | 'upcoming' | 'ask-lawyer';

export type Item = {
  key: string;
  kind: ItemKind;
  ruleIds: string[];
  /** null μόνο για 'ask-lawyer'. */
  tier: Tier | null;
  span?: Span;
  basis?: { fact: FactKey; date: string };
  /** Μόνο για 'cutoff': καλύπτει ο εξωδικαστικός τον πλειστηριασμό; */
  status?: 'covered' | 'not-covered' | 'boundary';
  /** Λόγοι για τους οποίους βγήκε εύρος ή «ρώτα δικηγόρο» (κείμενο για την οθόνη). */
  reasons: string[];
  /** Η ασφαλής ημερομηνία έχει περάσει. */
  past?: boolean;
};

export type CheckKey =
  | 'order-epitagi-seizure' | 'order-seizure-auction' | 'auction-outside-993' | 'auction-august'
  | 'monday-holiday' | 'continuation-outside-973' | 'regime-unknown';

export type Check = { key: CheckKey; ruleId: string; dates: string[] };

export type Timeline = {
  regime: Regime | 'unknown';
  items: Item[];
  checks: Check[];
};

const isDate = (d: DateFact): d is string => typeof d === 'string' && d !== 'unknown';

/** Ο κανόνας και η βαθμίδα του, ή ο λόγος που δεν φτάνει στην οθόνη. */
function gateRule(id: string, today: string): { tier: Tier } | { reason: string } {
  const r = rule(id);
  const g = displayable(r, today);
  if (g.ok) return { tier: g.tier };
  if (g.reason === 'withheld') return { reason: r.withheldReason ?? 'Ο κανόνας δεν επαληθεύτηκε.' };
  if (g.reason === 'not-yet-in-force') return { reason: 'not-yet-in-force' };
  if (g.reason === 'expired') return { reason: 'expired' };
  return { reason: 'Ο κανόνας δεν έχει δύο πηγές.' };
}

const askLawyer = (key: string, ruleIds: string[], reason: string): Item =>
  ({ key, kind: 'ask-lawyer', ruleIds, tier: null, reasons: [reason] });

/** Το καθεστώς από την ημερομηνία επίδοσης της επιταγής (ν. 5221/2025 άρθρο 126 §7). */
export function regimeOf(epitagi: DateFact): Regime | 'unknown' {
  if (!isDate(epitagi)) return 'unknown';
  const pivot = rule('regime-126-7').params.date!;
  return assertIso(epitagi) >= pivot ? 'new' : 'old';
}

/** Η χαμηλότερη βαθμίδα: αν ένας κανόνας δεν έχει υπογραφή, το στοιχείο δεν την έχει. */
const minTier = (ts: Tier[]): Tier => (ts.every(t => t === 'lawyer') ? 'lawyer' : 'verified');

/**
 * Προθεσμία «το αργότερο Ν εργάσιμες πριν από την ημέρα Π».
 *   earliest: η αυστηρή ανάγνωση (C5), χωρίς τις εργάσιμες του Αυγούστου (C6).
 *   latest:   μία εργάσιμη αργότερα από την αυστηρή ανάγνωση, με τον Αύγουστο να μετρά.
 */
export function beforeWorkingSpan(day: string, n: number): Span {
  const earliest = backWorking(day, n, false);
  const latest = nextWorking(backWorking(day, n, true));
  return { earliest, latest, safe: earliest };
}

/**
 * Προθεσμία «Ν ημέρες από Χ» για τον ΧΡΗΣΤΗ.
 *   latest:   αφετηρία η επομένη (C1), μεταφορά σε εργάσιμη (C2).
 *   earliest: αφετηρία η ίδια ημέρα, χωρίς μεταφορά, στην τελευταία εργάσιμη έως τότε.
 */
export function afterCalendarSpanUser(start: string, n: number, skipAugust: boolean): Span {
  const latest = rollForward(forwardCalendar(start, n, skipAugust));
  const earliest = rollBack(forwardCalendar(start, n - 1, skipAugust));
  return { earliest, latest, safe: earliest };
}

/** Το ίδιο για προθεσμία ΤΡΙΤΟΥ (π.χ. του servicer): ασφαλές είναι το αργότερο. */
export function afterCalendarSpanCounterparty(start: string, n: number): Span {
  const earliest = forwardCalendar(start, n - 1, false);
  const latest = rollForward(forwardCalendar(start, n, false));
  return { earliest, latest, safe: latest };
}

/**
 * Το παράθυρο της ημέρας πλειστηριασμού ακινήτου (ΚΠολΔ 993 §2). ΑΡΝΕΙΤΑΙ να
 * εφαρμόσει τον κανόνα των κινητών (954 §2 ε') σε ακίνητο: ήταν το πιο εύκολο
 * λάθος της έρευνας και θα έδινε πλειστηριασμό δύο μήνες νωρίτερα.
 */
export function auctionWindow(seizure: string, asset: 'property' | 'movable', ruleId = 'ka-993-window'): { span: Span; reasons: string[] } {
  if (asset === 'property' && ruleId !== 'ka-993-window') {
    throw new Error(`enforcement/engine: ο κανόνας «${ruleId}» αφορά κινητά και δεν εφαρμόζεται σε ακίνητο`);
  }
  if (asset !== 'property') throw new Error('enforcement/engine: η Προστασία ιδιοκτήτη υπολογίζει μόνο για ακίνητα');
  const p = rule(ruleId).params;
  const from = p.count!, to = p.countTo!;
  const a = addMonthsDetail(seizure, from), b = addMonthsDetail(seizure, to);
  const reasons: string[] = [];
  let earliest = a.date, latest = b.date;
  if (isAugust(a.date)) {
    earliest = addMonths(seizure, from + 1);
    latest = addMonths(seizure, to + 1);
    reasons.push('august-993');
  } else if (isAugust(b.date)) {
    latest = addMonths(seizure, to + 1);
    reasons.push('august-993');
  }
  if (a.clamped || b.clamped) reasons.push('month-end');
  return { span: { earliest, latest, safe: earliest }, reasons };
}

/** Η τελευταία ημέρα υποβολής για την οποία ο πλειστηριασμός μένει έξω από το τρίμηνο. */
export function lastDayOutside(auction: string, months: number): string {
  let s = addDays(addMonths(auction, -months), 3);
  while (addMonths(s, months) >= auction) s = addDays(s, -1);
  return s;
}

export function computeTimeline(f: CaseFacts, today: string): Timeline {
  assertIso(today);
  for (const k of ['epitagi', 'seizure', 'auction', 'continuation', 'servicerRequest', 'exodikastikos'] as const) {
    const v = f[k];
    if (isDate(v)) assertIso(v);
  }
  const items: Item[] = [];
  const checks: Check[] = [];
  const regime = regimeOf(f.epitagi);
  const regimes: Regime[] = regime === 'unknown' ? ['new', 'old'] : [regime];

  if (f.asset !== 'property') {
    return { regime, items: [askLawyer('movable', ['ka-954-2e-movable'], 'Η Προστασία ιδιοκτήτη υπολογίζει μόνο για ακίνητα.')], checks };
  }

  // ── Διαταγή πληρωμής ─────────────────────────────────────────────────
  if (f.received === 'diatagi') {
    const u = gateRule('dp-632', today);
    items.push(askLawyer('dp-632', ['dp-632'], 'reason' in u ? u.reason : ''));
  }

  // ── Μετά την επιταγή ─────────────────────────────────────────────────
  if (isDate(f.epitagi) && !isDate(f.seizure)) {
    const u = gateRule('ep-926', today);
    items.push(askLawyer('ep-926', ['ep-926'], 'reason' in u ? u.reason : ''));
  }
  if (regime === 'unknown' && (isDate(f.seizure) || isDate(f.auction))) {
    checks.push({ key: 'regime-unknown', ruleId: 'regime-126-7', dates: [rule('regime-126-7').params.date!] });
  }

  // ── Κατάσχεση ────────────────────────────────────────────────────────
  if (isDate(f.seizure)) {
    if (isDate(f.epitagi) && f.seizure < f.epitagi) checks.push({ key: 'order-epitagi-seizure', ruleId: 'regime-126-7', dates: [f.epitagi, f.seizure] });

    if (regime === 'new') {
      const u = gateRule('an-934a-new', today);
      const aug = gateRule('aug-147-2', today);
      if ('tier' in u && 'tier' in aug) {
        const n = rule('an-934a-new').params.count!;
        const span = afterCalendarSpanUser(f.seizure, n, true);
        items.push({
          key: 'an-934a', kind: 'deadline', ruleIds: ['an-934a-new', 'aug-147-2'], tier: minTier([u.tier, aug.tier]),
          span, basis: { fact: 'seizure', date: f.seizure }, reasons: ['c1', 'c2'], past: span.safe < today,
        });
      } else items.push(askLawyer('an-934a', ['an-934a-new'], 'reason' in u ? u.reason : 'reason' in aug ? aug.reason : ''));
    } else {
      const reason = regime === 'old' ? rule('an-934a-old').withheldReason! : 'Χρειάζεται η ημερομηνία επίδοσης της επιταγής για να ξέρουμε ποιο καθεστώς ισχύει.';
      items.push(askLawyer('an-934a', ['an-934a-old'], reason));
    }

    const w = gateRule('ka-993-window', today);
    if ('tier' in w) {
      const { span, reasons } = auctionWindow(f.seizure, f.asset);
      items.push({ key: 'ka-993', kind: 'window', ruleIds: ['ka-993-window'], tier: w.tier, span, basis: { fact: 'seizure', date: f.seizure }, reasons });
      if (isDate(f.auction) && !isDate(f.continuation) && (f.auction < span.earliest || f.auction > span.latest)) {
        checks.push({ key: 'auction-outside-993', ruleId: 'ka-993-window', dates: [f.auction, span.earliest, span.latest] });
      }
    }
    if (isDate(f.auction) && f.auction < f.seizure) checks.push({ key: 'order-seizure-auction', ruleId: 'ka-993-window', dates: [f.seizure, f.auction] });

    const faep = gateRule('faep-219', today);
    items.push(askLawyer('faep-219', ['faep-219'], 'reason' in faep ? faep.reason : ''));
  }

  // ── Ημέρα πλειστηριασμού ─────────────────────────────────────────────
  if (isDate(f.auction)) {
    const A = f.auction;
    for (const [key, base] of [['ka-954-4', 'ka-954-4'], ['as-938-4', 'as-938-4']] as const) {
      const ids = regimes.map(r => `${base}-${r}`);
      const uses = ids.map(id => gateRule(id, today));
      if (uses.every(u => 'tier' in u)) {
        const spans = ids.map(id => beforeWorkingSpan(A, rule(id).params.count!));
        const earliest = spans.map(s => s.earliest).sort()[0];
        const latest = spans.map(s => s.latest).sort().at(-1)!;
        const reasons = ['c5', 'c3'];
        if (spansAugust(earliest, A)) reasons.push('c6');
        if (regime === 'unknown') reasons.push('regime-unknown');
        items.push({
          key, kind: 'deadline', ruleIds: ids, tier: minTier(uses.map(u => (u as { tier: Tier }).tier)),
          span: { earliest, latest, safe: earliest }, basis: { fact: 'auction', date: A }, reasons, past: earliest < today,
        });
      } else {
        const bad = uses.find(u => 'reason' in u) as { reason: string };
        items.push(askLawyer(key, ids, bad.reason));
      }
    }
    // Η απόφαση επί της αναστολής δημοσιεύεται έως τη Δευτέρα που προηγείται.
    // Αν εκείνη η Δευτέρα είναι αργία, ο νόμος δεν λέει τι γίνεται.
    const mon = mondayBefore(A);
    if (!isWorking(mon)) checks.push({ key: 'monday-holiday', ruleId: regimes.includes('new') ? 'as-938-4-new' : 'as-938-4-old', dates: [mon, A] });

    if (regimes.includes('new') && isAugust(A) && 'tier' in gateRule('ka-998-2', today)) {
      checks.push({ key: 'auction-august', ruleId: 'ka-998-2', dates: [A] });
    }

    const as1000 = gateRule('as-1000', today);
    items.push(askLawyer('as-1000', ['as-1000'], 'reason' in as1000 ? as1000.reason : ''));

    // Εξωδικαστικός: καλύπτει την αναστολή τον ήδη ορισμένο πλειστηριασμό;
    const ex = gateRule('ex-18-cutoff', today);
    if ('tier' in ex) {
      const months = rule('ex-18-cutoff').params.count!;
      const S = isDate(f.exodikastikos) ? f.exodikastikos : today;
      const plus = addMonthsDetail(S, months);
      // Οριακή: ακριβώς στους τρεις μήνες, ή κοντά σε τέλος μήνα όπου η
      // αντιστοίχιση ημερών δεν είναι επαληθευμένη (σύμβαση C7).
      const nearClamp = plus.clamped && Math.abs(Date.parse(A) - Date.parse(plus.date)) <= 3 * 86400000;
      const status: Item['status'] = plus.date === A || nearClamp ? 'boundary' : A < plus.date ? 'not-covered' : 'covered';
      const submitBy = lastDayOutside(A, months);
      items.push({
        key: 'ex-18', kind: 'cutoff', ruleIds: ['ex-18-cutoff'], tier: ex.tier, status,
        span: { earliest: submitBy, latest: addDays(submitBy, 1), safe: submitBy },
        basis: { fact: isDate(f.exodikastikos) ? 'exodikastikos' : 'auction', date: isDate(f.exodikastikos) ? f.exodikastikos : A },
        reasons: ['boundary'],
      });
    }

    // Servicer: πρόταση ρύθμισης πριν από τον πρώτο πλειστηριασμό.
    if (f.received !== 'dimosio') {
      const sv = gateRule('sv-182', today);
      if ('tier' in sv) {
        const d = addMonthsDetail(A, -rule('sv-182').params.count!);
        const reasons = ['registration', 'which-law'];
        if (f.auctionFirst === 'unknown') reasons.push('first-unknown');
        if (d.clamped) reasons.push('month-end');
        if (f.auctionFirst === 'no') {
          items.push({ key: 'sv-182', kind: 'expected', ruleIds: ['sv-182'], tier: sv.tier, reasons: ['not-for-repeat'] });
        } else {
          items.push({ key: 'sv-182', kind: 'expected', ruleIds: ['sv-182'], tier: sv.tier, span: { earliest: d.date, latest: d.date, safe: d.date }, basis: { fact: 'auction', date: A }, reasons });
        }
      }
    }
  }

  // ── Δήλωση συνέχισης ─────────────────────────────────────────────────
  if (isDate(f.continuation)) {
    const u = gateRule('as-973-window', today);
    if ('tier' in u && regimes.includes('new')) {
      const p = rule('as-973-window').params;
      const earliest = addMonths(f.continuation, p.count!);
      let latest = addMonths(f.continuation, p.countTo!);
      const reasons: string[] = [];
      if (spansAugust(f.continuation, latest)) { latest = addMonths(latest, 1); reasons.push('august-973'); }
      if (regime === 'unknown') reasons.push('regime-unknown');
      items.push({ key: 'as-973', kind: 'window', ruleIds: ['as-973-window'], tier: u.tier, span: { earliest, latest, safe: earliest }, basis: { fact: 'continuation', date: f.continuation }, reasons });
      if (isDate(f.auction) && (f.auction < earliest || f.auction > latest)) {
        checks.push({ key: 'continuation-outside-973', ruleId: 'as-973-window', dates: [f.auction, earliest, latest] });
      }
    }
  }

  // ── Αίτημα στοιχείων στον servicer ───────────────────────────────────
  if (isDate(f.servicerRequest)) {
    const u = gateRule('sv-37a', today);
    if ('tier' in u) {
      const span = afterCalendarSpanCounterparty(f.servicerRequest, rule('sv-37a').params.count!);
      items.push({ key: 'sv-37a', kind: 'expected', ruleIds: ['sv-37a'], tier: u.tier, span, basis: { fact: 'servicerRequest', date: f.servicerRequest }, reasons: ['c1', 'c2'] });
    }
  }

  // ── Διμερής διαδικασία: έρχεται ──────────────────────────────────────
  {
    const r = rule('sv-63a');
    const u = gateRule('sv-63a', today);
    if ('reason' in u && u.reason === 'not-yet-in-force') {
      const g = displayable({ ...r, validFrom: today }, today);
      if (g.ok) items.push({ key: 'sv-63a', kind: 'upcoming', ruleIds: ['sv-63a'], tier: g.tier, span: { earliest: r.validFrom, latest: r.validFrom, safe: r.validFrom }, basis: { fact: 'law', date: r.validFrom }, reasons: [] });
    }
  }

  // ── Οφειλές στο Δημόσιο: μόνο ρυθμίσεις και παραπομπή ────────────────
  if (f.publicDebt === 'yes' || f.received === 'dimosio') {
    for (const id of ['ds-120-aade', 'ds-120-efka']) {
      const u = gateRule(id, today);
      const d = rule(id).params.date!;
      if ('tier' in u) items.push({ key: id, kind: 'fixed', ruleIds: [id], tier: u.tier, span: { earliest: d, latest: d, safe: d }, basis: { fact: 'law', date: d }, reasons: [] });
    }
    const pd = gateRule('public-debt-route', today);
    items.push(askLawyer('public-debt-route', ['public-debt-route'], 'reason' in pd ? pd.reason : ''));
  }

  items.sort((a, b) => (a.span?.safe ?? '9999').localeCompare(b.span?.safe ?? '9999') || a.key.localeCompare(b.key));
  return { regime, items, checks };
}
