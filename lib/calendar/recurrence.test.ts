// Τεστ για την επέκταση επαναλαμβανόμενων (recurrence.ts). Τρέξε: npx tsx lib/calendar/recurrence.test.ts
import { nextOccurrence, occurrenceAt, expandRecurring, reminderOccurrences, reminderKey } from './recurrence'

let passed = 0, failed = 0
const fails: string[] = []
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; if (fails.length < 60) fails.push(name) } }

// ── nextOccurrence ──────────────────────────────────────────────────────────
ok('weekly +7', nextOccurrence('2026-07-01', 'weekly') === '2026-07-08')
ok('weekly crosses month', nextOccurrence('2026-07-29', 'weekly') === '2026-08-05')
ok('monthly +1', nextOccurrence('2026-01-15', 'monthly') === '2026-02-15')
ok('monthly clamps Jan31→Feb28', nextOccurrence('2026-01-31', 'monthly') === '2026-02-28')
ok('monthly leap Jan31→Feb29 (2028)', nextOccurrence('2028-01-31', 'monthly') === '2028-02-29')
ok('bimonthly +2', nextOccurrence('2026-01-10', 'bimonthly') === '2026-03-10')
ok('quarterly +3', nextOccurrence('2026-01-10', 'quarterly') === '2026-04-10')
ok('biannual +6', nextOccurrence('2026-01-10', 'biannual') === '2026-07-10')
ok('annual +12 crosses year', nextOccurrence('2026-05-20', 'annual') === '2027-05-20')
ok('monthly Dec→Jan next year', nextOccurrence('2026-12-15', 'monthly') === '2027-01-15')
ok('unknown interval → null', nextOccurrence('2026-01-01', 'nope') === null)

// ── expandRecurring ─────────────────────────────────────────────────────────
const monthly = [{ id: 'a', event_date: '2026-01-10', recurring: true, recurring_interval: 'monthly' }]
const occ = expandRecurring(monthly, '2026-01-01', '2026-06-30')
ok('monthly count Jan–Jun = 6', occ.length === 6)
ok('monthly dates', occ.map(o => o.event_date).join(',') === '2026-01-10,2026-02-10,2026-03-10,2026-04-10,2026-05-10,2026-06-10')
ok('base not virtual', occ[0]._virtual === undefined)
ok('later are virtual', occ[1]._virtual === true)
ok('virtual has synthetic id', occ[1].id === 'a__2026-02-10')
ok('virtual keeps seriesId', occ[1]._seriesId === 'a')

// range that starts AFTER base still yields occurrences in-range
const mid = expandRecurring(monthly, '2026-04-01', '2026-05-31')
ok('mid-range occurrences', mid.map(o => o.event_date).join(',') === '2026-04-10,2026-05-10')
ok('mid-range excludes base month', !mid.some(o => o.event_date === '2026-01-10'))

// non-recurring event: only itself if in range
const single = [{ id: 's', event_date: '2026-03-05', recurring: false, recurring_interval: null }]
ok('single in range', expandRecurring(single, '2026-03-01', '2026-03-31').length === 1)
ok('single out of range', expandRecurring(single, '2026-04-01', '2026-04-30').length === 0)

// weekly across a month range
const weekly = [{ id: 'w', event_date: '2026-07-01', recurring: true, recurring_interval: 'weekly' }]
const wk = expandRecurring(weekly, '2026-07-01', '2026-07-31')
ok('weekly July count', wk.map(o => o.event_date).join(',') === '2026-07-01,2026-07-08,2026-07-15,2026-07-22,2026-07-29')

// ── recurrence_until: λήξη σειράς ────────────────────────────────────────────
const untilCase = [{ id: 'u', event_date: '2026-01-10', recurring: true, recurring_interval: 'monthly', recurrence_until: '2026-03-10' }]
ok('until stops the series', expandRecurring(untilCase, '2026-01-01', '2026-12-31').map(o => o.event_date).join(',') === '2026-01-10,2026-02-10,2026-03-10')
const untilBefore = [{ id: 'u2', event_date: '2026-01-10', recurring: true, recurring_interval: 'monthly', recurrence_until: '2026-02-09' }]
ok('until before 2nd occ → only base', expandRecurring(untilBefore, '2026-01-01', '2026-12-31').map(o => o.event_date).join(',') === '2026-01-10')

// ── recurrence_count: πλήθος (base μετράει ως 1η) ───────────────────────────
const countCase = [{ id: 'c', event_date: '2026-01-10', recurring: true, recurring_interval: 'monthly', recurrence_count: 3 }]
ok('count=3 yields 3', expandRecurring(countCase, '2026-01-01', '2026-12-31').map(o => o.event_date).join(',') === '2026-01-10,2026-02-10,2026-03-10')
ok('count=1 yields only base', expandRecurring([{ id: 'c1', event_date: '2026-01-10', recurring: true, recurring_interval: 'monthly', recurrence_count: 1 }], '2026-01-01', '2026-12-31').length === 1)

// ── recurrence_exdates: εξαιρέσεις (μετρούν στο count, δεν εμφανίζονται) ─────
const exCase = [{ id: 'e', event_date: '2026-01-10', recurring: true, recurring_interval: 'monthly', recurrence_exdates: ['2026-02-10'] }]
ok('exdate skipped', expandRecurring(exCase, '2026-01-01', '2026-04-30').map(o => o.event_date).join(',') === '2026-01-10,2026-03-10,2026-04-10')
const exCount = [{ id: 'ec', event_date: '2026-01-10', recurring: true, recurring_interval: 'monthly', recurrence_count: 3, recurrence_exdates: ['2026-02-10'] }]
ok('exdate counts toward count (iCal)', expandRecurring(exCount, '2026-01-01', '2026-12-31').map(o => o.event_date).join(',') === '2026-01-10,2026-03-10')
ok('base exdate removes base too', expandRecurring([{ id: 'b', event_date: '2026-01-10', recurring: true, recurring_interval: 'monthly', recurrence_count: 2, recurrence_exdates: ['2026-01-10'] }], '2026-01-01', '2026-12-31').map(o => o.event_date).join(',') === '2026-02-10')

// ── 02.10.2026: κάθε εμφάνιση από τη βάση, όχι από την προηγούμενη ─────────
// Πριν: μηνιαία από 31.1 έδινε 28.2, 28.3, 28.4 (η κλειδωμένη μέρα κολλούσε).
const endOfMonth = [{ id: 'm31', event_date: '2026-01-31', recurring: true, recurring_interval: 'monthly' }]
ok('μηνιαία από 31.1: η 31η επιστρέφει', expandRecurring(endOfMonth, '2026-01-01', '2026-06-30').map(o => o.event_date).join(',')
  === '2026-01-31,2026-02-28,2026-03-31,2026-04-30,2026-05-31,2026-06-30')
ok('τριμηνιαία από 30.11: 28.2 και μετά 30.5', expandRecurring([{ id: 'q', event_date: '2025-11-30', recurring: true, recurring_interval: 'quarterly' }], '2025-11-01', '2026-08-31').map(o => o.event_date).join(',')
  === '2025-11-30,2026-02-28,2026-05-30,2026-08-30')
ok('ετήσια από 29.2.2028: 28.2 και ξανά 29.2 το 2032', expandRecurring([{ id: 'l', event_date: '2028-02-29', recurring: true, recurring_interval: 'annual' }], '2028-01-01', '2032-12-31').map(o => o.event_date).join(',')
  === '2028-02-29,2029-02-28,2030-02-28,2031-02-28,2032-02-29')
ok('occurrenceAt n=0 είναι η βάση', occurrenceAt('2026-01-31', 'monthly', 0) === '2026-01-31')
ok('occurrenceAt εβδομαδιαία', occurrenceAt('2026-07-01', 'weekly', 4) === '2026-07-29')

// ── 02.10.2026: το «yearly» που έγραφε η Φροντίδα μισθωτή ───────────────────
// Πριν: άγνωστο interval, η σειρά έδειχνε μόνο την πρώτη εμφάνιση.
ok('yearly = annual', nextOccurrence('2026-05-20', 'yearly') === '2027-05-20')
ok('yearly αναπτύσσεται', expandRecurring([{ id: 'y', event_date: '2026-03-01', recurring: true, recurring_interval: 'yearly' }], '2026-01-01', '2028-12-31').length === 3)

// ── 10.11.2026: οι υπενθυμίσεις του διακομιστή αναπτύσσουν τις σειρές ──────
{
  const evs = [
    { id: 's', event_date: '2026-09-01', recurring: true, recurring_interval: 'monthly' },
    { id: 'one', event_date: '2026-11-12' },
    { id: 'late', event_date: '2026-11-01' },
    { id: 'gone', event_date: '2026-09-15', recurring: true, recurring_interval: 'weekly', recurrence_until: '2026-10-01' },
  ]
  const { upcoming, overdue } = reminderOccurrences(evs, '2026-11-10', '2026-12-05')
  ok('σειρά: εμφανίζονται οι εμφανίσεις μέσα στο παράθυρο', upcoming.filter(e => e._seriesId === 's').map(e => e.event_date).join(',') === '2026-12-01')
  ok('μεμονωμένο μέσα στο παράθυρο', upcoming.some(e => e.id === 'one' && !e._virtual))
  ok('ληξιπρόθεσμο μόνο το μεμονωμένο', overdue.map(e => e.id).join(',') === 'late')
  ok('η βάση της σειράς δεν γίνεται ληξιπρόθεσμη', !overdue.some(e => e.id === 's'))
  ok('σειρά που έληξε δεν φέρνει τίποτα', !upcoming.some(e => e.id.startsWith('gone')))
  ok('ίδιες εμφανίσεις με το ημερολόγιο', JSON.stringify(upcoming.map(e => e.id)) === JSON.stringify(expandRecurring(evs, '2026-11-10', '2026-12-05').map(e => e.id)))
  const v = upcoming.find(e => e._seriesId === 's')!
  ok('κλειδί εμφάνισης: id της βάσης και ημερομηνία στο είδος', JSON.stringify(reminderKey(v, '1day')) === JSON.stringify({ event_id: 's', reminder_type: '1day@2026-12-01' }))
  ok('κλειδί μεμονωμένου: όπως πριν', JSON.stringify(reminderKey({ id: 'one', event_date: '2026-11-12' }, 'today')) === JSON.stringify({ event_id: 'one', reminder_type: 'today' }))
}

// ── 10.11.2026: η γραμμή της βάσης περνά όπως είναι (null, jsonb) ──────────
{
  const row = { id: 'r', event_date: '2026-01-10', recurring: true as boolean | null, recurring_interval: 'monthly',
    recurrence_until: null, recurrence_count: null, recurrence_exdates: ['2026-02-10', 7, null] as unknown }
  const d = expandRecurring([row], '2026-01-01', '2026-03-31').map(e => e.event_date).join(',')
  ok('jsonb εξαιρέσεις: μετρά μόνο το κείμενο', d === '2026-01-10,2026-03-10')
  ok('jsonb που δεν είναι πίνακας: καμία εξαίρεση', expandRecurring([{ ...row, recurrence_exdates: { x: 1 } }], '2026-01-01', '2026-03-31').length === 3)
  ok('recurring null: μόνο η βάση', expandRecurring([{ ...row, recurring: null }], '2026-01-01', '2026-03-31').length === 1)
  const r = reminderOccurrences([row], '2026-03-01', '2026-03-31')
  ok('ο τύπος της γραμμής διατηρείται (χωρίς as)', r.upcoming[0].recurrence_until === null && r.overdue.length === 0)
}

console.log(`recurrence.ts, ${passed} passed, ${failed} failed (σύνολο ${passed + failed})`)
if (failed) { console.log('Απέτυχαν:\n - ' + fails.join('\n - ')); process.exit(1) }
else console.log('όλα πέρασαν')
