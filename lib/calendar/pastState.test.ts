// npx tsx lib/calendar/pastState.test.ts
//
// Η υπενθύμιση λήξης ΠΕΑ που πέρασε δεν είναι «ληξιπρόθεσμη» στην οθόνη: η ημέρα
// λήξης λέει «Έληξε», οι 90 και 30 ημερών δεν λένε τίποτα. Οι προθεσμίες μένουν
// ληξιπρόθεσμες όπως πριν. Ο έλεγχος περνά και από το ίδιο το μοντέλο του
// ημερολογίου (`isOverdue`), που διαβάζουν η κάρτα, ο μήνας και οι λίστες.
import { pastState, PAST_LABEL, NEVER_OVERDUE, PEA_EXPIRY_DAY_SOURCE } from './pastState';
import { onceOnDay } from './onceOnDay';
import { peaSource } from '../property/peaExpiry';
import { isOverdue, isPastNotice, pastStateOf, type CalEvent } from '../../app/dashboard/components/calendar/model';
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++; else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}
function ok(name: string, cond: boolean) { if (cond) pass++; else { fail++; console.error(`✗ ${name}`); } }

const T = '2026-11-12';
const ev = (source: string, event_date: string, status = 'pending') => ({ source, event_date, status });

// ── Ο κανόνας ───────────────────────────────────────────────────────────────
{
  eq('η πηγή της ημέρας λήξης είναι αυτή που γράφει ο συγχρονισμός', PEA_EXPIRY_DAY_SOURCE, peaSource(0));
  eq('ΠΕΑ, ημέρα λήξης που πέρασε: «έληξε»', pastState(ev(peaSource(0), '2026-11-11'), T), 'expired');
  eq('ΠΕΑ, 90 ημέρες πριν, πέρασε: απλώς πέρασε', pastState(ev(peaSource(90), '2026-08-01'), T), 'passed');
  eq('ΠΕΑ, 30 ημέρες πριν, πέρασε: απλώς πέρασε', pastState(ev(peaSource(30), '2026-10-01'), T), 'passed');
  eq('ΠΕΑ σήμερα: τίποτα ακόμη', pastState(ev(peaSource(0), T), T), null);
  eq('ΠΕΑ που έκλεισε: τίποτα', pastState(ev(peaSource(0), '2026-01-01', 'paid'), T), null);
  eq('λογαριασμός που πέρασε ανοιχτός: ληξιπρόθεσμο', pastState(ev('bills', '2026-10-15'), T), 'overdue');
  eq('χειροκίνητο που πέρασε: ληξιπρόθεσμο', pastState(ev('manual', '2026-11-11'), T), 'overdue');
  eq('προθεσμία σε εξέλιξη: όχι ληξιπρόθεσμο', pastState(ev('manual', '2026-11-11', 'in_progress'), T), null);
  eq('οι λέξεις', [PAST_LABEL.overdue, PAST_LABEL.expired], ['Ληξιπρόθεσμο', 'Έληξε']);
  ok('ο κατάλογος χρησιμοποιεί το ίδιο κατηγόρημα με τα email', NEVER_OVERDUE.includes(onceOnDay));
}

// ── Το μοντέλο του ημερολογίου ──────────────────────────────────────────────
{
  const cal = (source: string, event_date: string): CalEvent => ({
    id: 'x', property_id: 'p', user_id: 'u', title: 't', category: 'contract', event_date,
    priority: 'medium', status: 'pending', recurring: false, source, created_at: '2020-01-01',
  });
  const past = '2020-01-01', future = '2099-01-01';
  ok('ΠΕΑ που πέρασε: όχι ληξιπρόθεσμο στην οθόνη', !isOverdue(cal(peaSource(0), past)) && !isOverdue(cal(peaSource(90), past)));
  ok('αλλά φαίνεται ως περασμένη υπενθύμιση', isPastNotice(cal(peaSource(0), past)) && isPastNotice(cal(peaSource(30), past)));
  eq('η κάρτα παίρνει «έληξε» για την ημέρα λήξης', pastStateOf(cal(peaSource(0), past)), 'expired');
  ok('προθεσμία που πέρασε: ληξιπρόθεσμο', isOverdue(cal('manual', past)) && !isPastNotice(cal('manual', past)));
  ok('μελλοντικό: τίποτα', !isOverdue(cal(peaSource(0), future)) && !isPastNotice(cal(peaSource(0), future)));
}

// ── Οι οθόνες διαβάζουν τον κανόνα ──────────────────────────────────────────
{
  const read = (p: string) => readFileSync(p, 'utf8');
  const card = read('app/dashboard/components/calendar/EventCard.tsx');
  ok('η κάρτα: η λέξη από την κατάσταση, όχι σκέτο «Ληξιπρόθεσμο»', card.includes('const past    = pastStateOf(event)') && !card.includes('>Ληξιπρόθεσμο</span>'));
  const tab = read('app/dashboard/components/TabCalendar.tsx');
  ok('η ατζέντα έχει τις περασμένες υπενθυμίσεις χωριστά', tab.includes('const pastNotices=filtered.filter(isPastNotice)') && tab.includes('events={pastNotices}'));
  ok('η εξαγωγή γράφει «Έληξε», όχι «Εντός προθεσμίας»', tab.includes("const p=pastStateOf(e); return p?PAST_LABEL[p]:'Εντός προθεσμίας'"));
}

console.log(fail === 0 ? `✓ pastState: ${pass} έλεγχοι πέρασαν` : `✗ pastState: ${fail} απέτυχαν από ${pass + fail}`);
if (fail) process.exit(1);
