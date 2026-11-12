// npx tsx lib/legal/enforcement/engine.test.ts
// Τα διανύσματα δοκιμής TV-1 έως TV-18 της προδιαγραφής «Προστασία ιδιοκτήτη»
// (§2.5) και δοκιμές ιδιοτήτων. Οπου η μηχανή δίνει πια εύρος αντί για μία
// ημερομηνία (επειδή οι συμβάσεις υπολογισμού δεν επαληθεύτηκαν από δύο
// πηγές), η αναμενόμενη ημερομηνία της προδιαγραφής ελέγχεται ως το όριο του
// εύρους που της αντιστοιχεί και το άλλο όριο γράφεται ρητά.
import {
  addDays, addMonths, backWorking, isAugust, isWorking, nextWorking,
} from './calc';

/**
 * Ν εργάσιμες μετά, από την επομένη. Ζει εδώ και όχι στη μηχανή: η μόνη
 * προθεσμία που μετρά εργάσιμες προς τα εμπρός (632 §2) δεν εμφανίζεται, οπότε
 * η αριθμητική της ελέγχεται μόνο για να είναι έτοιμη για τον δικηγόρο.
 */
function forwardWorking(start: string, n: number, skipAugust: boolean): string {
  let d = start, k = 0;
  while (k < n) { d = addDays(d, 1); if (!isWorking(d) || (skipAugust && isAugust(d))) continue; k++; }
  return d;
}
import {
  afterCalendarSpanCounterparty, afterCalendarSpanUser, auctionWindow, beforeWorkingSpan,
  calmAllowed, CALM_WINDOW_DAYS, computeTimeline, regimeOf, type CaseFacts, type Item,
} from './engine';
import { displayable, hasTwoSources, sourcesHumanChecked, ENFORCEMENT_REGISTRY } from './gate';
import { ASK_LAWYER_BADGE, LAWYER_BADGE, VERIFIED_BADGE, cardBadge, itemBadge } from './badges';
import { statusOf } from '@/lib/legal/validity';
import { RULES, rule } from './rules';
import type { LegalRule } from './types';

let p = 0, f = 0;
const ok = (c: boolean, m: string) => { if (c) p++; else { f++; console.error('✗', m); } };
const eq = (a: unknown, b: unknown, m: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);

const TODAY = '2026-11-12';
const base: CaseFacts = {
  asset: 'property', received: 'epitagi', epitagi: null, seizure: null, auction: null,
  auctionFirst: 'unknown', continuation: null, servicerRequest: null, publicDebt: 'no', exodikastikos: null,
};
const facts = (o: Partial<CaseFacts>): CaseFacts => ({ ...base, ...o });
const item = (t: { items: Item[] }, key: string) => t.items.find(i => i.key === key);
const NEW = '2026-02-10', OLD = '2025-12-20';

// ── TV-1 έως TV-3: ΔΠ-632, ο υπολογισμός σωστός, η οθόνη ΔΕΝ τον δείχνει ──────
// Ο κανόνας είναι 'withheld': η αριθμητική ελέγχεται, η μηχανή γράφει «ρώτα δικηγόρο».
eq(forwardWorking('2026-11-12', 15, true), '2026-12-03', 'TV-1 15 εργάσιμες από 12/11/2026');
eq(nextWorking('2026-12-03'), '2026-12-04', 'TV-1 +1 εργάσιμη για τοπική αργία');
eq(forwardWorking('2026-11-12', 30, true), '2026-12-24', 'TV-2 30 εργάσιμες');
eq(nextWorking('2026-12-24'), '2026-12-28', 'TV-2 επόμενη εργάσιμη μετά τα Χριστούγεννα');
eq(forwardWorking('2026-07-20', 15, true), '2026-09-08', 'TV-3 με παράλειψη Αυγούστου');
ok(forwardWorking('2026-07-20', 15, false) === '2026-08-10', 'TV-3 χωρίς παράλειψη θα έβγαινε 10/08 (έλεγχος ότι η παράλειψη μετρά)');
{
  const t = computeTimeline(facts({ received: 'diatagi' }), TODAY);
  const i = item(t, 'dp-632');
  ok(i?.kind === 'ask-lawyer' && !i.span, 'TV-1/2/3: διαταγή πληρωμής → «Επιβεβαίωσε με δικηγόρο», καμία ημερομηνία');
}

// ── TV-4: ανακοπή 934 §1α, νέο καθεστώς, ο Αύγουστος δεν μετρά ─────────────
{
  const t = computeTimeline(facts({ epitagi: NEW, seizure: '2026-06-20' }), TODAY);
  const i = item(t, 'an-934a')!;
  eq(i.kind, 'deadline', 'TV-4 είδος');
  eq(i.span?.latest, '2026-09-04', 'TV-4 όριο της προδιαγραφής (04/09/2026)');
  eq(i.span?.earliest, '2026-09-03', 'TV-4 ασφαλής (αφετηρία την ίδια ημέρα)');
  ok(i.span!.latest !== '2026-08-04', 'TV-4 χωρίς τον Αύγουστο θα έβγαινε 04/08');
}
{
  const t = computeTimeline(facts({ epitagi: NEW, seizure: '2026-11-12' }), TODAY);
  const i = item(t, 'an-934a')!;
  eq(i.span?.latest, '2026-12-28', 'TV-4β 45η ημέρα Κυριακή 27/12 → Δευτέρα 28/12');
  eq(i.span?.earliest, '2026-12-24', 'TV-4β ασφαλής: τελευταία εργάσιμη πριν τα Χριστούγεννα');
}
{
  const t = computeTimeline(facts({ epitagi: OLD, seizure: '2026-06-20' }), TODAY);
  eq(item(t, 'an-934a')?.kind, 'ask-lawyer', 'Παλιό καθεστώς 934: μία πηγή → καμία ημερομηνία');
}

// ── TV-5 έως TV-6β, TV-16: προθεσμίες προς τα πίσω από τον πλειστηριασμό ────
// Η αυστηρή ανάγνωση (η τιμή της προδιαγραφής) ελέγχεται με το backWorking.
// Η ασφαλής ημερομηνία της μηχανής είναι μία εργάσιμη νωρίτερα, γιατί δεν
// ξέρουμε τις τοπικές αργίες (C3, έλεγχος 12/11/2026)· το εύρος ανοίγει ±1.
eq(backWorking('2027-03-17', 30, false), '2027-02-02', 'TV-5 αυστηρή ανάγνωση = 02/02/2027 (προδιαγραφή)');
eq(backWorking('2027-03-17', 15, false), '2027-02-23', 'TV-5β αυστηρή ανάγνωση = 23/02/2027 (προδιαγραφή)');
eq(backWorking('2027-03-17', 5, false), '2027-03-09', 'TV-5γ αυστηρή ανάγνωση = 09/03/2027 (προδιαγραφή)');
{
  const t = computeTimeline(facts({ epitagi: NEW, auction: '2027-03-17' }), TODAY);
  eq(item(t, 'ka-954-4')?.span, { earliest: '2027-02-01', latest: '2027-02-03', safe: '2027-02-01' }, 'TV-5 954 §4 νέο (30 εργάσιμες), ±1');
  eq(item(t, 'as-938-4')?.span, { earliest: '2027-02-22', latest: '2027-02-24', safe: '2027-02-22' }, 'TV-5β 938 §4 νέο (15 εργάσιμες), ±1');
}
{
  const t = computeTimeline(facts({ epitagi: OLD, auction: '2027-03-17' }), TODAY);
  eq(t.regime, 'old', 'TV-5γ καθεστώς από την ημερομηνία της επιταγής');
  eq(item(t, 'as-938-4')?.span, { earliest: '2027-03-08', latest: '2027-03-10', safe: '2027-03-08' }, 'TV-5γ 938 §4 παλιό (5 εργάσιμες), ±1');
  eq(item(t, 'ka-954-4')?.span, { earliest: '2027-02-22', latest: '2027-02-24', safe: '2027-02-22' }, 'TV-5δ 954 §4 παλιό (15 εργάσιμες), ±1');
}
// ── Τοπική αργία μέσα στο διάστημα ───────────────────────────────────
// Θεσσαλονίκη: πλειστηριασμός 11/11/2027, μέσα στο διάστημα ο Αγίου
// Δημητρίου (26/10, τοπική αργία που η εφαρμογή δεν ξέρει). Με την αργία η
// αυστηρή ανάγνωση γίνεται 19/10· η ασφαλής ημερομηνία πρέπει να μην είναι αργότερα.
{
  const t = computeTimeline(facts({ epitagi: NEW, auction: '2027-11-11' }), TODAY);
  const s = item(t, 'as-938-4')!.span!;
  eq(backWorking('2027-11-11', 15, false), '2027-10-20', 'Τοπική αργία: αυστηρή ανάγνωση χωρίς τοπικές αργίες');
  eq(s.safe, '2027-10-19', 'Τοπική αργία: ασφαλής 19/10/2027, όχι 20/10/2027');
  ok(s.safe <= '2027-10-19' && '2027-10-26' > s.safe && '2027-10-26' < '2027-11-11', 'Τοπική αργία: η τοπική αργία είναι μέσα στο διάστημα και η ασφαλής την καλύπτει');
}
// ── Επιταγή πριν από την 01/01/2022 ───────────────────────────────────
{
  const t = computeTimeline(facts({ epitagi: '2021-11-15', seizure: '2026-06-20', auction: '2027-03-17', continuation: '2027-01-10' }), TODAY);
  eq(t.regime, 'pre2022', 'Πριν από το 2022: επιταγή 15/11/2021 → πριν από τον ν. 4842/2021');
  for (const k of ['as-938-4', 'ka-954-4', 'ka-993', 'an-934a', 'as-973']) {
    const i = item(t, k);
    ok(i?.kind === 'ask-lawyer' && !i.span, `Πριν από το 2022: ${k}: «Επιβεβαίωσε με δικηγόρο», καμία ημερομηνία`);
  }
  ok(!t.checks.some(c => c.key === 'monday-holiday'), 'Πριν από το 2022: καμία σημαία από κανόνα που δεν εφαρμόζεται');
  eq(regimeOf('2021-12-31'), 'pre2022', '31/12/2021 → pre2022');
  eq(regimeOf('2022-01-01'), 'old', '01/01/2022 → παλιό καθεστώς του ν. 4842/2021');
  ok(item(computeTimeline(facts({ epitagi: 'unknown', auction: '2027-03-17' }), TODAY), 'as-938-4')!.reasons.includes('pre2022-possible'), 'Πριν από το 2022: άγνωστη επιταγή: λόγος «μπορεί να είναι πριν από το 2022»');
}
{
  const t = computeTimeline(facts({ epitagi: NEW, auction: '2026-09-16' }), '2026-06-01');
  const a = item(t, 'ka-954-4')!.span!;
  eq(backWorking('2026-09-16', 30, false), '2026-07-07', 'TV-6 αυστηρή, ο Αύγουστος δεν μετρά (προδιαγραφή)');
  eq(a.earliest, '2026-07-06', 'TV-6 ασφαλής: και μία εργάσιμη για τοπική αργία');
  // Η προδιαγραφή γράφει 05/08 (ο Αύγουστος μετρά, αυστηρά)· η μηχανή προσθέτει
  // συνεπώς και τη μία εργάσιμη της σύμβασης C5, όπως σε κάθε άλλο εύρος.
  eq(backWorking('2026-09-16', 30, true), '2026-08-05', 'TV-6 αυστηρή ανάγνωση με τον Αύγουστο');
  eq(a.latest, '2026-08-06', 'TV-6 χαλαρό όριο = 05/08 + 1 εργάσιμη (C5)');
  ok(item(t, 'ka-954-4')!.reasons.includes('c6'), 'TV-6 λόγος C6 (Αύγουστος)');
  const b = item(t, 'as-938-4')!.span!;
  eq(b.earliest, '2026-07-27', 'TV-6β ασφαλής (28/07 της προδιαγραφής, -1 εργάσιμη)');
  eq(backWorking('2026-09-16', 15, true), '2026-08-26', 'TV-6β αυστηρή με τον Αύγουστο');
}
{
  const t = computeTimeline(facts({ epitagi: 'unknown', auction: '2027-03-17' }), TODAY);
  eq(t.regime, 'unknown', 'TV-16 άγνωστο καθεστώς');
  eq(item(t, 'as-938-4')?.span, { earliest: '2027-02-22', latest: '2027-03-10', safe: '2027-02-22' }, 'TV-16 εύρος και των δύο καθεστώτων, ±1');
  ok(t.checks.some(c => c.key === 'regime-unknown'), 'TV-16 σημαία «χρειάζεται η ημερομηνία της επιταγής»');
}

// ── TV-7, TV-7β, TV-8: ημέρα πλειστηριασμού ακινήτου ────────────────────
{
  const w = auctionWindow('2026-01-15', 'property');
  eq(w.span.earliest, '2026-09-15', 'TV-7 οι 7 μήνες πέφτουν τον Αύγουστο → επόμενος μήνας');
  eq(w.span.latest, '2026-10-15', 'TV-7 και το όριο μετατοπίζεται (εύρος)');
  ok(w.reasons.includes('august-993'), 'TV-7 σημαία ερμηνείας του Αυγούστου');
  const t = computeTimeline(facts({ epitagi: NEW, seizure: '2026-01-15', auction: '2026-09-20' }), '2026-02-01');
  ok(!t.checks.some(c => c.key === 'auction-outside-993'), 'TV-7 πλειστηριασμός 20/09/2026: συνεπής');
}
{
  const t = computeTimeline(facts({ epitagi: NEW, seizure: '2026-11-10', auction: '2027-04-21' }), TODAY);
  eq(item(t, 'ka-993')?.span, { earliest: '2027-06-10', latest: '2027-07-10', safe: '2027-06-10' }, 'TV-7β παράθυρο 7 έως 8 μηνών');
  ok(t.checks.some(c => c.key === 'auction-outside-993'), 'TV-7β 21/04/2027 εκτός παραθύρου → σημαία');
  ok(item(t, 'ka-993')!.span!.earliest !== addMonths('2026-11-10', 5), 'TV-7β ΟΧΙ 5 μήνες (954 §2ε)');
}
{
  let threw = false;
  try { auctionWindow('2026-11-10', 'property', 'ka-954-2e-movable'); } catch { threw = true; }
  ok(threw, 'TV-8 ο κανόνας των κινητών σε ακίνητο → άρνηση');
  const t = computeTimeline(facts({ asset: 'movable', seizure: '2026-11-10' }), TODAY);
  ok(t.items.length === 1 && t.items[0].kind === 'ask-lawyer', 'TV-8 κινητό: καμία ημερομηνία');
}

// ── TV-9, TV-9β: εξωδικαστικός και πλειστηριασμός μέσα στο τρίμηνο ──────
{
  const t = computeTimeline(facts({ auction: '2027-01-20' }), TODAY);
  eq(item(t, 'ex-18')?.status, 'not-covered', 'TV-9 μέσα στο τρίμηνο: η αναστολή δεν τον καλύπτει');
  const t2 = computeTimeline(facts({ auction: '2027-02-12' }), TODAY);
  eq(item(t2, 'ex-18')?.status, 'boundary', 'TV-9β ακριβώς στο όριο');
  ok(item(t2, 'ex-18')!.reasons.includes('boundary') && !item(t, 'ex-18')!.reasons.includes('boundary'), 'λόγος «οριακή» μόνο στο όριο');
  ok(item(t, 'ex-18')!.past === true, 'TV-9 η ημερομηνία υποβολής έχει ήδη περάσει → σημαία');
  const t3 = computeTimeline(facts({ auction: '2027-03-20' }), TODAY);
  eq(item(t3, 'ex-18')?.status, 'covered', 'πέρα από το τρίμηνο: καλύπτεται');
  eq(item(t3, 'ex-18')?.span?.safe, '2026-12-19', 'υπέβαλε έως 19/12/2026 για πλειστηριασμό 20/03/2027');
}

// ── TV-10: servicer, 45 ημέρες (προθεσμία ΤΡΙΤΟΥ: ασφαλές το αργότερο) ──
{
  const t = computeTimeline(facts({ received: 'servicer', servicerRequest: '2026-11-20' }), TODAY);
  const i = item(t, 'sv-37a')!;
  eq(i.kind, 'expected', 'TV-10 είδος: προθεσμία του servicer');
  eq(i.span?.latest, '2027-01-04', 'TV-10 04/01/2027');
  eq(i.span?.safe, '2027-01-04', 'TV-10 τονίζεται η αργότερη');
}

// ── TV-11: Φορέας Απόκτησης ─────────────────────────────────────────────
{
  const t = computeTimeline(facts({ epitagi: NEW, seizure: '2026-10-01' }), TODAY);
  const i = item(t, 'faep-219')!;
  ok(i.kind === 'ask-lawyer' && /δεν λειτουργεί/.test(i.reasons[0]), 'TV-11 «ο Φορέας δεν λειτουργεί ακόμη»');
}

// ── TV-12: πρόταση ρύθμισης 3 μήνες πριν ────────────────────────────────
{
  const t = computeTimeline(facts({ auction: '2027-05-19', auctionFirst: 'yes' }), TODAY);
  eq(item(t, 'sv-182')?.span?.safe, '2027-02-19', 'TV-12 αναμενόμενη έως 19/02/2027');
  ok(item(t, 'sv-182')!.reasons.includes('approx') && !item(t, 'sv-182')!.past, 'TV-12 «περίπου», δεν έχει περάσει');
  ok(item(computeTimeline(facts({ auction: '2027-01-20', auctionFirst: 'yes' }), TODAY), 'sv-182')!.past === true, 'sv-182: 20/10/2026 έχει περάσει → σημαία');
  const u = item(computeTimeline(facts({}), TODAY), 'sv-63a')!;
  ok(u.kind === 'upcoming' && u.span!.safe === '2027-02-09' && u.basis!.date === '2026-11-09' && u.reasons.includes('computed'), 'sv-63a: τρεις μήνες από τη δημοσίευση 09/11/2026, δικός μας υπολογισμός 09/02/2027');
  const t2 = computeTimeline(facts({ auction: '2027-05-19', auctionFirst: 'no' }), TODAY);
  ok(!item(t2, 'sv-182')?.span && item(t2, 'sv-182')!.reasons.includes('not-for-repeat'), 'TV-12 επαναλαμβανόμενος: δεν ισχύει');
}

// ── TV-13: δήλωση συνέχισης ─────────────────────────────────────────────
{
  const t = computeTimeline(facts({ epitagi: NEW, continuation: '2027-01-20' }), TODAY);
  eq(item(t, 'as-973')?.span, { earliest: '2027-03-20', latest: '2027-04-20', safe: '2027-03-20' }, 'TV-13 2 έως 3 μήνες');
  const a = item(computeTimeline(facts({ epitagi: NEW, continuation: '2027-06-20' }), TODAY), 'as-973')!;
  eq(a.span, { earliest: '2027-09-20', latest: '2027-10-20', safe: '2027-09-20' }, '973: ο Αύγουστος μετατοπίζει και τα δύο όρια');
  eq(item(computeTimeline(facts({ epitagi: OLD, continuation: '2027-01-20' }), TODAY), 'as-973')?.kind, 'ask-lawyer', '973 παλιό καθεστώς → ρώτα δικηγόρο');
  const c = computeTimeline(facts({ epitagi: NEW, seizure: '2026-01-15', continuation: '2027-01-20', auction: '2027-03-25' }), TODAY);
  ok(!c.checks.some(x => x.key === 'auction-outside-993'), '993: δεν σημαίνεται ημέρα που ταιριάζει στη δήλωση συνέχισης');
  const c2 = computeTimeline(facts({ epitagi: NEW, seizure: '2026-01-15', continuation: '2027-01-20', auction: '2027-06-25' }), TODAY);
  ok(c2.checks.some(x => x.key === 'auction-outside-993'), '993: σημαίνεται ημέρα που δεν ταιριάζει ούτε στη δήλωση συνέχισης');
}

// ── TV-14: ΚΠολΔ 1000 · αριθμητική ναι, οθόνη όχι ────────────────────────
eq(backWorking('2027-04-28', 15, true), '2027-04-07', 'TV-14 15 εργάσιμες πριν από 28/04/2027');
eq(nextWorking('2027-04-07'), '2027-04-08', 'TV-14 +1');
{
  const t = computeTimeline(facts({ epitagi: NEW, auction: '2027-04-28' }), TODAY);
  ok(item(t, 'as-1000')?.kind === 'ask-lawyer', 'TV-14 ΚΠολΔ 1000: καμία ημερομηνία');
}

// ── TV-15: η «Δευτέρα που προηγείται» είναι Καθαρά Δευτέρα ──────────────
{
  const t = computeTimeline(facts({ epitagi: NEW, auction: '2027-03-17' }), TODAY);
  ok(t.checks.some(c => c.key === 'monday-holiday' && c.dates[0] === '2027-03-15'), 'TV-15 σημαία για τη Δευτέρα 15/03/2027');
}

// ── TV-17, TV-18: η πύλη ────────────────────────────────────────────────
{
  const r = rule('as-938-4-new');
  const oneSource: LegalRule = { ...r, sources: r.sources.filter(s => s.kind === 'official') };
  eq(displayable(oneSource, TODAY), { ok: false, reason: 'sources' }, 'TV-17 κανόνας με μία πηγή → δεν φαίνεται');
  const sameUrl: LegalRule = { ...r, sources: r.sources.map(s => ({ ...s, url: r.sources[0].url })) };
  ok(!hasTwoSources(sameUrl), 'TV-17 δύο «πηγές» με την ίδια διεύθυνση δεν είναι δύο');
  const notVerified: LegalRule = { ...r, status: 'withheld' };
  eq(displayable(notVerified, TODAY).ok, false, 'TV-18 κανόνας που δεν επαληθεύτηκε → δεν φαίνεται');
  eq(displayable({ ...r, verifier: null }, TODAY).ok, false, 'χωρίς verifier → δεν φαίνεται');
  // Με ανθρώπινο `checkedAt` στο μητρώο (humanSeen = true): οι βαθμίδες όπως πριν.
  eq(displayable(r, TODAY, true), { ok: true, tier: 'verified' }, 'επαληθευμένος, χωρίς υπογραφή, με ανθρώπινο έλεγχο → βαθμίδα verified');
  eq(displayable({ ...r, lawyerReviewed: { reviewer: '', reviewedAt: '2026-12-01', version: r.version } }, TODAY, true), { ok: true, tier: 'verified' }, 'υπογραφή χωρίς όνομα δεν μετρά');
  eq(displayable({ ...r, lawyerReviewed: { reviewer: 'Δ-1', reviewedAt: '2026-12-01', version: r.version + 1 } }, TODAY, true), { ok: true, tier: 'verified' }, 'υπογραφή για άλλη έκδοση δεν μετρά');
  eq(displayable({ ...r, lawyerReviewed: { reviewer: 'Δ-1', reviewedAt: '2026-12-01', version: r.version } }, TODAY), { ok: true, tier: 'lawyer' }, 'έγκυρη υπογραφή → βαθμίδα lawyer');
  // Χωρίς ανθρώπινο έλεγχο (μόνο εργαλείο): βαθμίδα 'tool', ποτέ 'verified'.
  eq(displayable(r, TODAY, false), { ok: true, tier: 'tool' }, 'μόνο ανάγνωση εργαλείου → βαθμίδα tool');
  eq(displayable({ ...r, lawyerReviewed: { reviewer: '', reviewedAt: '2026-12-01', version: r.version } }, TODAY, false), { ok: true, tier: 'tool' }, 'άκυρη υπογραφή δεν ανεβάζει από tool');
  eq(displayable(rule('ds-120-aade'), '2027-07-01'), { ok: false, reason: 'expired' }, 'μετά τις 30/06/2027 οι 120 δόσεις δεν φαίνονται');
}

// ── «Υπάρχει χρόνος»: μόνο όταν η μηχανή μπορεί να το στηρίξει ─────────
// Η εκδοχή 978ae12 έλεγχε μόνο προθεσμίες με ημερομηνία και έλεγε «υπάρχει
// χρόνος» και στις τρεις πρώτες περιπτώσεις.
{
  const calm = (o: Partial<CaseFacts>) => { const f = facts(o); return calmAllowed(computeTimeline(f, TODAY), f, TODAY); };
  eq(calm({ received: 'diatagi' }), false, 'ήρεμο μήνυμα: διαταγή πληρωμής (ανακοπή χωρίς υπολογισμό) → όχι');
  eq(calm({ epitagi: '2021-06-01', auction: '2026-11-17' }), false, 'ήρεμο μήνυμα: επιταγή 2021, πλειστηριασμός σε 5 ημέρες → όχι');
  eq(calm({ epitagi: OLD, seizure: '2026-10-23' }), false, 'ήρεμο μήνυμα: κατάσχεση πριν από 20 ημέρες, παλιό καθεστώς → όχι');
  eq(calm({ epitagi: 'unknown', seizure: '2026-10-23' }), false, 'ήρεμο μήνυμα: κατάσχεση πριν από 20 ημέρες, άγνωστο καθεστώς → όχι');
  eq(calm({ epitagi: NEW, auction: '2027-06-30' }), false, 'ήρεμο μήνυμα: με πλειστηριασμό η αναστολή του 1000 δεν υπολογίζεται → όχι');
  eq(calm({ received: 'servicer', servicerRequest: '2026-11-20' }), true, 'ήρεμο μήνυμα: μόνο αίτημα στον servicer → ναι');
  eq(calm({ epitagi: NEW, seizure: '2026-11-10' }), true, `ήρεμο μήνυμα: νέα κατάσχεση, ασφαλής ημερομηνία πέρα από ${CALM_WINDOW_DAYS} ημέρες → ναι`);
  eq(calm({ epitagi: NEW, seizure: '2026-10-01' }), false, 'ήρεμο μήνυμα: ασφαλής ημερομηνία μέσα στο παράθυρο → όχι');
  // «Γιατί» σε επιταγή πριν από το 2022: μόνο ο κανόνας της μεταβατικής.
  const pre = computeTimeline(facts({ epitagi: '2021-06-01', seizure: '2026-06-20', auction: '2027-03-17', continuation: '2027-01-10' }), TODAY);
  for (const k of ['ka-954-4', 'as-938-4', 'ka-993', 'an-934a', 'as-973']) eq(item(pre, k)?.ruleIds, ['regime-4842-2022'], `πριν από το 2022: το «Γιατί» του ${k} δείχνει μόνο τη μεταβατική`);
}

// ── Το μητρώο ───────────────────────────────────────────────────────────
for (const r of RULES) {
  if (r.status === 'verified') ok(hasTwoSources(r), `${r.id}: επαληθευμένος χωρίς δύο πηγές`);
  ok(r.lawyerReviewed === null, `${r.id}: υπογραφή δικηγόρου χωρίς να έχει γίνει έλεγχος`);
  if (r.status === 'withheld') ok(!!r.withheldReason && Object.keys(r.params).length === 0, `${r.id}: 'withheld' με αριθμούς ή χωρίς λόγο`);
}
eq(regimeOf('2025-12-31'), 'old', '31/12/2025 → παλιό καθεστώς');
eq(regimeOf('2026-01-01'), 'new', '01/01/2026 → νέο καθεστώς');
eq(regimeOf('unknown'), 'unknown', '«δεν ξέρω» → άγνωστο');

// ── Δοκιμές ιδιοτήτων: 2026 έως 2030, ντετερμινιστικά ───────────────────
{
  let seed = 20261112;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const day0 = Date.UTC(2026, 0, 1), span = Date.UTC(2030, 11, 31) - day0;
  const randDay = () => new Date(day0 + Math.floor(rnd() * span / 86400000) * 86400000).toISOString().slice(0, 10);
  let bad = 0;
  for (let k = 0; k < 600; k++) {
    const d = randDay();
    for (const n of [5, 15, 30]) {
      const s = beforeWorkingSpan(d, n);
      if (!(s.earliest <= s.latest && s.latest < d)) bad++;
      if (!isWorking(s.earliest) || !isWorking(s.latest)) bad++;
    }
    const u = afterCalendarSpanUser(d, 45, true);
    if (!(u.earliest <= u.latest && u.earliest > d && isWorking(u.earliest) && isWorking(u.latest))) bad++;
    const c = afterCalendarSpanCounterparty(d, 45);
    if (!(c.earliest <= c.latest && c.earliest > d)) bad++;
    const w = auctionWindow(d, 'property');
    if (!(w.span.earliest >= addMonths(d, 7) && w.span.earliest <= w.span.latest)) bad++;
    if (w.span.earliest <= addMonths(d, 6)) bad++;
    if (isAugust(w.span.earliest)) bad++;
    const t1 = JSON.stringify(computeTimeline(facts({ epitagi: d, seizure: d, auction: addMonths(d, 7) }), '2026-01-01'));
    const t2 = JSON.stringify(computeTimeline(facts({ epitagi: d, seizure: d, auction: addMonths(d, 7) }), '2026-01-01'));
    if (t1 !== t2) bad++;
    // Καμία προθεσμία του χρήστη πριν από το γεγονός που την ξεκινά.
    for (const i of JSON.parse(t1).items as Item[]) {
      if (i.kind === 'deadline' && i.basis?.fact === 'seizure' && i.span!.earliest <= d) bad++;
      if (i.kind === 'deadline' && i.basis?.fact === 'auction' && i.span!.latest >= i.basis.date) bad++;
    }
  }
  eq(bad, 0, 'ιδιότητες: εύρος σε τάξη, εργάσιμες, 993 ποτέ 5 ή 6 μήνες, ντετερμινισμός, καμία προθεσμία πριν από την αφετηρία');
}

// ── Ανθρωπος ή εργαλείο: «Επαληθευμένο» μόνο με ανθρώπινο έλεγχο ─────────
// Το μητρώο ισχύος γράφει `checkedAt: null, toolReadAt` για τις πέντε εγγραφές
// των κανόνων εκτέλεσης (12/11/2026): την αντιπαραβολή την έκανε εργαλείο. Ως
// τότε η οθόνη έδειχνε «Επαληθευμένο» σαν να το είχε δει άνθρωπος.
{
  ok(ENFORCEMENT_REGISTRY.length >= 3, 'το μητρώο ισχύος έχει εγγραφές για τα αρχεία των κανόνων εκτέλεσης');
  const unseen = ENFORCEMENT_REGISTRY.filter(x => x.checkedAt === null);
  ok(unseen.every(x => statusOf(x, TODAY) === 'unchecked'), "checkedAt null με πρόσφατο toolReadAt → 'unchecked', όχι 'ok'");
  ok(unseen.every(x => statusOf({ ...x, toolReadAt: undefined }, TODAY) === 'stale'), "checkedAt null χωρίς toolReadAt → 'stale'");
  ok(unseen.every(x => statusOf({ ...x, toolReadAt: 'kati' }, TODAY) === 'stale'), "toolReadAt που δεν είναι ημερομηνία → 'stale', όχι NaN που περνά");
  ok(unseen.every(x => statusOf(x, '2028-01-01') !== 'ok' && statusOf(x, '2028-01-01') !== 'unchecked'), 'toolReadAt πάνω από 12 μηνών → δεν περνά');
  ok(unseen.every(x => statusOf({ ...x, checkedAt: 'kati' }, TODAY) === 'stale'), "checkedAt που δεν είναι ημερομηνία → 'stale', όχι 'ok'");

  // Οσο έστω μία εγγραφή είναι 'unchecked', καμία σήμανση της οθόνης δεν λέει «Επαληθευμένο».
  if (unseen.length) {
    ok(!sourcesHumanChecked(TODAY), 'με εγγραφή χωρίς ανθρώπινο έλεγχο, οι πηγές δεν λογίζονται ελεγμένες');
    eq(displayable(rule('as-938-4-new'), TODAY), { ok: true, tier: 'tool' }, 'ο κανόνας από το μητρώο σήμερα → βαθμίδα tool');
    const all = [
      computeTimeline(facts({ epitagi: NEW, seizure: '2026-06-20' }), TODAY),
      computeTimeline(facts({ epitagi: NEW, seizure: '2026-06-20', auction: '2027-03-17' }), TODAY),
      computeTimeline(facts({ epitagi: OLD, seizure: '2026-01-20', auction: '2026-12-16', received: 'synexisi', continuation: '2026-10-01' }), TODAY),
      computeTimeline(facts({ epitagi: NEW, servicerRequest: '2026-11-01' }), TODAY),
    ].flatMap(t => t.items);
    ok(all.some(i => i.tier !== null), 'υπάρχουν σημεία με βαθμίδα για να ελεγχθούν');
    ok(all.every(i => itemBadge(i.kind, i.tier, false) !== VERIFIED_BADGE), 'κανένα σημείο του χρονοδιαγράμματος δεν δείχνει «Επαληθευμένο» χωρίς ανθρώπινο έλεγχο');
    ok(all.filter(i => i.tier !== null).every(i => itemBadge(i.kind, i.tier, false) === ASK_LAWYER_BADGE), '…δείχνει «Επιβεβαίωσε με δικηγόρο»');
    eq(cardBadge(RULES.filter(x => x.status === 'verified').map(x => displayable(x, TODAY)), false), ASK_LAWYER_BADGE, 'οι κάρτες επιλογών επίσης «Επιβεβαίωσε με δικηγόρο»');
  }
  // Οι συναρτήσεις της σήμανσης, για κάθε βαθμίδα.
  eq(itemBadge('deadline', 'tool', false), ASK_LAWYER_BADGE, 'tool → Επιβεβαίωσε με δικηγόρο');
  eq(itemBadge('deadline', 'verified', false), VERIFIED_BADGE, 'verified → Επαληθευμένο');
  eq(itemBadge('deadline', 'lawyer', false), LAWYER_BADGE, 'lawyer → Ελέγχθηκε από δικηγόρο');
  eq(itemBadge('deadline', 'verified', true), ASK_LAWYER_BADGE, 'διαφορά πηγών → Επιβεβαίωσε με δικηγόρο');
  eq(itemBadge('ask-lawyer', null, false), ASK_LAWYER_BADGE, 'ask-lawyer → Επιβεβαίωσε με δικηγόρο');
  eq(cardBadge([{ ok: true, tier: 'verified' }, { ok: true, tier: 'tool' }], false), ASK_LAWYER_BADGE, 'κάρτα με έναν κανόνα tool → Επιβεβαίωσε με δικηγόρο');
  eq(cardBadge([{ ok: true, tier: 'verified' }, { ok: true, tier: 'lawyer' }], false), VERIFIED_BADGE, 'κάρτα με ελεγμένους κανόνες → Επαληθευμένο');
  eq(cardBadge([], false), ASK_LAWYER_BADGE, 'κάρτα χωρίς κανόνα → Επιβεβαίωσε με δικηγόρο');
}

console.log(`\nlegal/enforcement/engine — ${p} passed, ${f} failed`);
if (f > 0) process.exit(1);
console.log('όλα πέρασαν');
