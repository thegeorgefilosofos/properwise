// npx tsx lib/calendar/onceOnDay.test.ts
//
// Οι υπενθυμίσεις λήξης ΠΕΑ στέλνουν ΕΝΑ email η καθεμία, τη δική της μέρα, χωρίς
// ληξιπρόθεσμο και χωρίς «Πλήρωσα». Η προσομοίωση περνά μέρα με μέρα από τους
// ίδιους κανόνες που εφαρμόζει η send-reminders (σκάλα 7/3/1/σήμερα, ληξιπρόθεσμο,
// μητρώο απεσταλμένων), με όλους τους διακόπτες ανοιχτούς.
import { onceOnDay, remindsAs, payableReminder, PEA_SOURCE_PREFIX } from './onceOnDay';
import { reminderOccurrences, reminderKey } from './recurrence';
import { peaReminderDrafts, PEA_SOURCE_PREFIX as FROM_PEA } from '../property/peaExpiry';
import { shiftIso } from '../property/peaExpiry';
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++; else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}
function ok(name: string, cond: boolean) { if (cond) pass++; else { fail++; console.error(`✗ ${name}`); } }

{
  eq('ένα πρόθεμα για ΠΕΑ, ένα σπίτι', FROM_PEA, PEA_SOURCE_PREFIX);
  ok('ΠΕΑ: ειδοποίηση μιας ημέρας', onceOnDay({ source: 'pea:expiry:90' }) && onceOnDay({ source: 'pea:expiry:0' }));
  ok('προθεσμία: όχι', !onceOnDay({ source: 'tax:enfia_1' }) && !onceOnDay({ source: null }) && !onceOnDay({}));
  ok('ΠΕΑ: μόνο «σήμερα»', remindsAs({ source: 'pea:expiry:30' }, 'today') && !['7days', '3days', '1day', 'overdue'].some(t => remindsAs({ source: 'pea:expiry:30' }, t)));
  ok('προθεσμία: όλη η σκάλα', ['7days', '3days', '1day', 'today', 'overdue'].every(t => remindsAs({ source: 'bills' }, t)));
  ok('ΠΕΑ: χωρίς «Πλήρωσα»', !payableReminder({ source: 'pea:expiry:0' }) && payableReminder({ source: 'bills' }));
}

// ── Προσομοίωση της send-reminders, μέρα με μέρα ─────────────────────────────
{
  const expiry = '2027-06-30';
  const drafts = peaReminderDrafts(expiry, '2026-11-12');
  type Ev = { id: string; event_date: string; source: string | null; title: string };
  const rows: Ev[] = drafts.map((d, i) => ({ id: `pea-${i}`, event_date: d.event_date, source: d.source ?? null, title: d.title }));
  rows.push({ id: 'bill-1', event_date: '2027-05-15', source: 'bills', title: 'Λογαριασμός' });
  const sent = new Set<string>();
  const mails: { id: string; type: string; day: string }[] = [];
  const pays: string[] = [];
  for (let day = '2027-03-01'; day <= '2027-07-31'; day = shiftIso(day, 1)) {
    const in7 = shiftIso(day, 7);
    const { upcoming, overdue } = reminderOccurrences(rows, day, in7);
    for (const [type, date] of [['7days', in7], ['3days', shiftIso(day, 3)], ['1day', shiftIso(day, 1)], ['today', day]] as const) {
      for (const e of upcoming.filter(x => x.event_date === date && remindsAs(x, type))) {
        const k = reminderKey(e, type);
        if (sent.has(`${k.event_id}|${k.reminder_type}`)) continue;
        sent.add(`${k.event_id}|${k.reminder_type}`); mails.push({ id: e.id, type, day });
        if (!e._virtual && payableReminder(e)) pays.push(e.id);
      }
    }
    for (const e of overdue.filter(x => remindsAs(x, 'overdue'))) {
      if (sent.has(`${e.id}|overdue`)) continue;
      sent.add(`${e.id}|overdue`); mails.push({ id: e.id, type: 'overdue', day });
      if (payableReminder(e)) pays.push(e.id);
    }
  }
  for (const r of rows.filter(x => x.source?.startsWith('pea:'))) {
    const mine = mails.filter(m => m.id === r.id);
    eq(`${r.title}: ένα email, την ημέρα του`, mine.map(m => [m.type, m.day]), [['today', r.event_date]]);
  }
  eq('συνολικά τρία email ΠΕΑ', mails.filter(m => m.id.startsWith('pea-')).length, 3);
  ok('κανένα ληξιπρόθεσμο ΠΕΑ', !mails.some(m => m.id.startsWith('pea-') && m.type === 'overdue'));
  ok('κανένα «Πλήρωσα» ΠΕΑ', !pays.some(id => id.startsWith('pea-')));
  eq('η προθεσμία κρατά όλη τη σκάλα', mails.filter(m => m.id === 'bill-1').map(m => m.type), ['7days', '3days', '1day', 'today', 'overdue']);
  ok('και το «Πλήρωσα» της', pays.includes('bill-1'));
}

// ── Η send-reminders και η ειδοποίηση κινητού εφαρμόζουν τον κανόνα ──────────
{
  const fn = readFileSync('supabase/functions/send-reminders/index.ts', 'utf8');
  ok('send-reminders: εισάγει τον κανόνα', fn.includes("import { remindsAs, payableReminder } from '../../../lib/calendar/onceOnDay.ts'"));
  ok('send-reminders: η σκάλα ανά είδος', fn.includes('e.event_date === check.date && remindsAs(e, check.type)'));
  ok('send-reminders: χωρίς ληξιπρόθεσμο', fn.includes("overdueRows.filter(e => remindsAs(e, 'overdue'))"));
  ok('send-reminders: χωρίς «Πλήρωσα»', fn.includes('!e._virtual && payableReminder(e)') && fn.includes('toSendOD.filter(payableReminder)'));
  const push = readFileSync('app/api/push/route.ts', 'utf8');
  ok('push: μόνο τη δική τους μέρα', push.includes('.filter(e => !onceOnDay(e) || e.event_date === today)'));
  ok('push: χωρίς «Πλήρωσα»', push.includes('payableReminder(e)'));
  // Χωρίς εισαγωγές: τη διαβάζει η Deno.
  ok('onceOnDay.ts χωρίς εισαγωγές', !/^import /m.test(readFileSync('lib/calendar/onceOnDay.ts', 'utf8')));
}

console.log(fail === 0 ? `✓ onceOnDay: ${pass} έλεγχοι πέρασαν` : `✗ onceOnDay: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
