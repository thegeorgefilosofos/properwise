// npx tsx lib/facts/deadlines.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// ΜΙΑ ΠΡΟΘΕΣΜΙΑ, ΙΔΙΑ ΣΕ ΚΑΘΕ ΟΘΟΝΗ
// ─────────────────────────────────────────────────────────────────────────
// «Σήμερα» είναι 05.10.2026, ιδιοκτήτης με μακροχρόνια μίσθωση. Η επόμενη
// θεσμική πληρωμή είναι η 8η δόση ΕΝΦΙΑ του 2026. Οι έλεγχοι ρωτούν ΚΑΘΕ
// οθόνη που τη δείχνει (Επισκόπηση, Εκκρεμότητες, συγχρονισμός Ημερολογίου,
// Νόα, συνδρομή ημερολογίου) και απαιτούν την ίδια απάντηση. Απαιτούν και την ίδια
// αλλαγή όταν η δόση σημειωθεί πληρωμένη σε ΕΝΑ από τα δύο σημεία.
// ═══════════════════════════════════════════════════════════════════════════
import {
  CLOSED_STATUSES, isClosedStatus, daysFrom, isOverdue, dueText, dueTextStart,
  taskNoteOf, closedTaxRefs, upcomingTaxObligations, nextTaxObligations,
  taxEventsToWrite, nextEnfiaDue, enfiaDueDates, taxProfileOfStatus, incomeInstalmentsAfter,
} from './deadlines';
import { enfiaYear, ENFIA_DEFAULTS } from './enfia';
import { computeObligations } from '@/app/dashboard/components/obligations';
import { taxTaskDrafts } from '@/lib/checklist/obligationTasks';
import { deadlineItems } from '@/lib/calendar/deadlines';
import { dueLabel } from '@/lib/home/agenda';
import { taxObligationsHorizon, taxProfileOf } from '@/lib/tax/greekTaxCalendar';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) pass++;
  else { fail++; console.error(`✗ ${name}`, extra ?? ''); }
};

const TODAY = '2026-10-05';
// Στις 10:00 ώρα Ελλάδας: η Επισκόπηση παίρνει `Date`, οι υπόλοιπες ημέρα.
const NOW = new Date('2026-10-05T07:00:00Z');
const EIGHTH = 'tax:enfia-instalment-2026-8';
const NINTH = 'tax:enfia-instalment-2026-9';

// ── Η διατύπωση ─────────────────────────────────────────────────────────────
ok('σήμερα', dueText(0) === 'σήμερα');
ok('αύριο', dueText(1) === 'αύριο');
ok('χθες', dueText(-1) === 'χθες');
ok('σε 5 ημέρες', dueText(5) === 'σε 5 ημέρες');
ok('πριν από 3 ημέρες', dueText(-3) === 'πριν από 3 ημέρες');
ok('χωρίς ημερομηνία, τίποτα', dueText(null) === null);
ok('αρχή φράσης', dueTextStart(-3) === 'Πριν από 3 ημέρες' && dueTextStart(0) === 'Σήμερα');
ok('η ατζέντα λέει το ίδιο', dueLabel(-3) === dueText(-3) && dueLabel(9) === dueText(9));

// ── Το σήμερα και το «ληξιπρόθεσμο» ─────────────────────────────────────────
ok('ημερολογιακές ημέρες', daysFrom(TODAY, '2026-10-30') === 25 && daysFrom(TODAY, '2026-10-04') === -1);
ok('προθεσμία σήμερα δεν είναι ληξιπρόθεσμη', !isOverdue(TODAY, TODAY, 'pending'));
ok('χθεσινή ανοιχτή είναι', isOverdue('2026-10-04', TODAY, 'pending'));
ok('χθεσινή πληρωμένη δεν είναι', !isOverdue('2026-10-04', TODAY, 'paid'));
for (const s of ['done', 'skipped', 'paid', 'cancelled']) ok(`κλειστή: ${s}`, isClosedStatus(s) && CLOSED_STATUSES.has(s));
ok('ανοιχτή: pending', !isClosedStatus('pending') && !isClosedStatus('in_progress'));

// ── Η σημείωση της εκκρεμότητας ─────────────────────────────────────────────
const packed = JSON.stringify({ __cv: 2, note: 'Με τον λογιστή', ref: EIGHTH, subtasks: [] });
ok('η σημείωση διαβάζεται, όχι το JSON', taskNoteOf(packed).note === 'Με τον λογιστή' && taskNoteOf(packed).ref === EIGHTH);
ok('απλό κείμενο μένει ως έχει', taskNoteOf('απλή σημείωση').note === 'απλή σημείωση' && taskNoteOf('απλή σημείωση').ref === null);
ok('χαλασμένο JSON δεν ρίχνει', taskNoteOf('{όχι json').note === '{όχι json');

// ── Κλειστή σε ΕΝΑ σημείο, κλειστή παντού ───────────────────────────────────
const paidInCalendar = closedTaxRefs([{ source: EIGHTH, status: 'paid' }], []);
const doneInChecklist = closedTaxRefs([], [{ note: packed, status: 'done' }]);
ok('πληρωμένη στο Ημερολόγιο', paidInCalendar.has(EIGHTH));
ok('ολοκληρωμένη στις Εκκρεμότητες', doneInChecklist.has(EIGHTH));
ok('ανοιχτή δεν κλείνει', closedTaxRefs([{ source: EIGHTH, status: 'pending' }], [{ note: packed, status: 'pending' }]).size === 0);

// ── Η επόμενη πληρωμή ΕΝΦΙΑ, σε κάθε οθόνη ──────────────────────────────────
const profile = taxProfileOf({ rental_mode: 'long_term', status_detail: null });
ok('προφίλ από κατάσταση = προφίλ από γραμμή', taxProfileOfStatus('rent_long') === profile && taxProfileOfStatus('rent_short') === 'short_term' && taxProfileOfStatus('vacant') === 'owner');

const enfiaOf = (ids: string[]) => ids.find(id => id.startsWith('enfia-instalment')) ?? null;
const screens = (closed: ReadonlySet<string>) => ({
  overview: enfiaOf(computeObligations({ rental_mode: 'long_term' }, null, [], NOW, profile, { closedTaxRefs: closed }).map(o => o.id)),
  checklist: enfiaOf(taxTaskDrafts(TODAY, profile, closed).map(d => d.ref.slice(4))),
  noa: nextEnfiaDue(TODAY, closed)?.ref.slice(4) ?? null,
  next: enfiaOf(nextTaxObligations(TODAY, profile, closed).map(o => o.id)),
});
const open = screens(new Set());
ok('Επισκόπηση: 8η δόση', open.overview === 'enfia-instalment-2026-8', open);
ok('Εκκρεμότητες: 8η δόση', open.checklist === 'enfia-instalment-2026-8', open);
ok('Νόα: 8η δόση', open.noa === 'enfia-instalment-2026-8', open);
ok('ίδια και στο facts', open.next === 'enfia-instalment-2026-8', open);

for (const [where, closed] of [['Ημερολόγιο', paidInCalendar], ['Εκκρεμότητες', doneInChecklist]] as const) {
  const s = screens(closed);
  ok(`πληρωμένη στο ${where}: η Επισκόπηση δείχνει την 9η`, s.overview === 'enfia-instalment-2026-9', s);
  ok(`πληρωμένη στο ${where}: οι Εκκρεμότητες προτείνουν την 9η αμέσως`, s.checklist === 'enfia-instalment-2026-9', s);
  ok(`πληρωμένη στο ${where}: η Νόα λέει την 9η`, s.noa === 'enfia-instalment-2026-9', s);
}

// Η ημερομηνία της 8ης: ίδια στο ημερολόγιο, στη Νόα και στο πρόγραμμα δόσεων.
const eighth = taxObligationsHorizon(TODAY, profile).find(o => o.id === 'enfia-instalment-2026-8')!;
const ef = enfiaYear(ENFIA_DEFAULTS, 2026, { stored: 340 });
ok('η Νόα δίνει την ημερομηνία του ημερολογίου', nextEnfiaDue(TODAY)?.date === eighth.date);
ok('το πρόγραμμα δόσεων έχει τις ημερομηνίες του ημερολογίου', ef.instalments.every(i => enfiaDueDates(2026).find(d => d.no === i.no)?.date === i.date), ef.instalments);
ok('εκδοθέν εκκαθαριστικό: ημερομηνίες του νόμου', ef.datesConfirmed === true);
ok('έτος χωρίς απόφαση: η προβολή λέγεται προβολή', enfiaYear(ENFIA_DEFAULTS, 2027, { stored: 340 }).datesConfirmed === false);

// Τον Ιανουάριο του 2027 η επόμενη είναι η 11η του 2026, όχι κάποια του 2027.
const jan = nextEnfiaDue('2027-01-15');
ok('Ιανουάριος: 11η δόση του 2026', jan?.year === 2026 && jan?.no === 11, jan);

// ── Ο συγχρονισμός του Ημερολογίου ──────────────────────────────────────────
const fresh = taxEventsToWrite(TODAY, profile, []);
ok('καμία περασμένη δεν γεννιέται εκκρεμής', fresh.every(e => (e.event_date ?? '') >= TODAY), fresh.filter(e => (e.event_date ?? '') < TODAY).map(e => e.source));
ok('όλες οι επόμενες γράφονται', fresh.length === upcomingTaxObligations(TODAY, profile).length);
const resync = taxEventsToWrite(TODAY, profile, [
  { source: EIGHTH, status: 'paid' },
  { source: 'tax:enfia-instalment-2026-7', status: 'pending' },
  { source: 'tax:enfia-first-2026', status: 'paid' },
]);
ok('πληρωμένη μένει πληρωμένη', resync.find(e => e.source === EIGHTH)?.status === 'paid');
ok('περασμένη που υπήρχε ανοιχτή μένει, ως υπενθύμιση', resync.find(e => e.source === 'tax:enfia-instalment-2026-7')?.status === 'pending');
ok('περασμένη πληρωμένη μένει στο ιστορικό', resync.find(e => e.source === 'tax:enfia-first-2026')?.status === 'paid');
ok('νέα: εκκρεμής', resync.find(e => e.source === NINTH)?.status === 'pending');
ok('οι επόμενες χωρίς τις κλειστές', !upcomingTaxObligations(TODAY, profile, paidInCalendar).some(o => `tax:${o.id}` === EIGHTH));

// ── Συνδρομή ημερολογίου και ειδοποιήσεις ───────────────────────────────────
const feed = deadlineItems({
  properties: [{ id: 'p1', name: 'Παγκράτι' }],
  events: [
    { id: 'e-paid', property_id: 'p1', title: 'ΕΝΦΙΑ, 7η δόση', event_date: '2026-10-01', status: 'paid', source: 'tax:enfia-instalment-2026-7' },
    { id: 'e-8', property_id: 'p1', title: 'ΕΝΦΙΑ, 8η δόση', event_date: '2026-10-30', status: 'pending', source: EIGHTH },
    { id: 'e-bill', property_id: 'p1', title: 'ΔΕΗ', event_date: '2026-10-12', status: 'pending', source: 'bills' },
    { id: 'e-rent', property_id: 'p1', title: 'Ενοίκιο', event_date: '2026-10-05', status: 'pending', source: 'tenant:t1:rent_due' },
  ],
  tasks: [
    { id: 't-8', property_id: 'p1', description: 'ΕΝΦΙΑ, 8η δόση', due_date: '2026-10-30', note: packed },
    { id: 't-own', property_id: 'p1', description: 'Βάψιμο', due_date: '2026-10-20', note: JSON.stringify({ __cv: 2, note: 'Ρώτα τον Νίκο', subtasks: [] }) },
  ],
  bills: [{ id: 'b1', property_id: 'p1', name: 'ΔΕΗ', amount: 80, due_date: '2026-10-10', paid: false }],
  rent: [{ id: 'r1', property_id: 'p1', amount: 650, due_date: '2026-10-05', paid: false }],
  from: '2026-09-05', to: '2027-10-05',
});
const uids = feed.map(f => f.uid);
ok('το πληρωμένο δεν ταξιδεύει', !uids.includes('event-e-paid@properwise'), uids);
ok('η ίδια θεσμική προθεσμία μία φορά, ως γεγονός', uids.includes('event-e-8@properwise') && !uids.includes('task-t-8@properwise'), uids);
ok('ο λογαριασμός από τον πίνακά του, όχι από το αντίγραφο', uids.includes('bill-b1@properwise') && !uids.includes('event-e-bill@properwise'), uids);
ok('το ενοίκιο από τη γραμμή του, όχι από την υπενθύμιση', uids.includes('rent-r1@properwise') && !uids.includes('event-e-rent@properwise'), uids);
ok('η σημείωση της εκκρεμότητας χωρίς JSON', feed.find(f => f.uid === 'task-t-own@properwise')?.note === 'Ρώτα τον Νίκο', feed.find(f => f.uid === 'task-t-own@properwise'));

// ── ΔΟΣΕΙΣ ΦΟΡΟΥ ΕΙΣΟΔΗΜΑΤΟΣ (12.11.2026) ─────────────────────────────────
// Μία γραμμή, η επόμενη δόση· η περασμένη δεν μένει ως εκπρόθεσμη. Κανένα ποσό:
// η εφαρμογή δεν το ξέρει και δεν το γράφει με το χέρι.
{
  const nextInc = (d: string, p: 'owner' | 'long_term' = 'long_term') =>
    nextTaxObligations(d, p).filter(o => o.kind === 'income-instalment');
  ok('12.11.2026: η επόμενη δόση είναι η 5η, 30/11/2026', nextInc('2026-11-12').map(o => `${o.id}@${o.date}`).join() === 'income-instalment-2026-5@2026-11-30', nextInc('2026-11-12'));
  ok('1.12.2026: η 5η πέρασε και δεν μένει, η επόμενη είναι η 6η', nextInc('2026-12-01').map(o => o.id).join() === 'income-instalment-2026-6', nextInc('2026-12-01'));
  ok('15.3.2027: μετά την 8η, καμία περασμένη δόση', nextInc('2027-03-15').every(o => o.date >= '2027-03-15'), nextInc('2027-03-15'));
  ok('ιδιοκατοίκηση: καμία δόση', nextInc('2026-11-12', 'owner').length === 0);
  const evs = taxEventsToWrite('2026-11-12', 'long_term').filter(e => String(e.source).startsWith('tax:income-instalment-'));
  ok('12.11.2026: γράφονται οι 5η ως 8η', evs.map(e => e.event_date).join() === '2026-11-30,2026-12-31,2027-01-29,2027-02-26', evs.map(e => e.event_date));
  ok('χωρίς ποσό: δεν υπάρχει ποσό από τον κώδικα', evs.every(e => e.amount === null || e.amount === undefined), evs.map(e => e.amount));
}

// ── ΠΕΡΑΣΜΕΝΗ ΔΟΣΗ ΦΟΡΟΥ ΕΙΣΟΔΗΜΑΤΟΣ, ΕΦΑΠΑΞ ΕΞΟΦΛΗΣΗ (12.11.2026) ───────────
{
  const src = (k: number) => `tax:income-instalment-2026-${k}`;
  const had = [{ source: src(3), status: 'pending' }, { source: src(4), status: 'paid' }];
  const evs = taxEventsToWrite('2026-11-12', 'long_term', had).map(e => String(e.source));
  ok('περασμένη ανοιχτή δόση: δεν ξαναγράφεται', !evs.includes(src(3)), evs);
  ok('περασμένη πληρωμένη δόση: μένει με την κατάστασή της', evs.includes(src(4)));
  const ev = (id: string, k: number, status = 'pending', date = '') => ({ id, source: src(k), status, event_date: date || ['', '2026-07-31', '2026-08-31', '2026-09-30', '2026-10-30', '2026-11-30', '2026-12-31', '2027-01-29', '2027-02-26'][k] });
  const all = [ev('a', 1, 'paid'), ev('b', 2), ev('c', 3), ev('d', 4, 'paid'), { id: 'x', source: 'tax:income-instalment-2027-2', status: 'pending', event_date: '2027-08-31' }, { id: 'y', source: 'tax:enfia-instalment-2026-9', status: 'pending', event_date: '2026-11-30' }];
  ok('εφάπαξ: οι ανοιχτές μεταγενέστερες της ίδιας δήλωσης', incomeInstalmentsAfter(all, all[0]).map(e => e.id).join() === 'b,c');
  ok('εφάπαξ: όχι άλλης δήλωσης, όχι ΕΝΦΙΑ, όχι πληρωμένες', !incomeInstalmentsAfter(all, all[0]).some(e => ['x', 'y', 'd'].includes(e.id)));
  ok('εφάπαξ: τίποτα για άλλο γεγονός', incomeInstalmentsAfter(all, all[5]).length === 0);
}

console.log(fail ? `✗ deadlines: ${fail} απέτυχαν, ${pass} πέρασαν` : `✓ deadlines: ${pass} έλεγχοι πέρασαν`);
if (fail) process.exit(1);
