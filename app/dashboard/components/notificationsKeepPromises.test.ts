// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΕΙΔΟΠΟΙΗΣΕΙΣ ΚΑΝΟΥΝ Ο,ΤΙ ΛΕΝΕ (έλεγχος υποσχέσεων, 10/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Κάθε έλεγχος εδώ είναι μια φράση της οθόνης δεμένη με τον κώδικα που την
// τηρεί. Αν ο κώδικας φύγει, η φράση γίνεται ψέμα και η δοκιμή κοκκινίζει.
// Τρέξε: npx tsx app/dashboard/components/notificationsKeepPromises.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { nameDaysLeft, nameLockedError, NAME_LOCK_DAYS } from './nameLock'

let passed = 0, failed = 0
const fails: string[] = []
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; fails.push(name) } }
const src = (p: string) => readFileSync(p, 'utf8')

// ── 1. «Δέκα λεπτά πριν από κάθε ραντεβού», σε κάθε καρτέλα ───────────────
{
  const dev = src('app/dashboard/components/DeviceNotifications.tsx')
  const page = src('app/dashboard/page.tsx')
  const hook = src('app/dashboard/components/useAppointmentReminders.ts')
  const cal = src('app/dashboard/components/TabCalendar.tsx')
  ok('η οθόνη το υπόσχεται', dev.includes('δέκα λεπτά πριν από κάθε ραντεβού'))
  ok('ο πίνακας στήνει τον χρονοδιακόπτη, όχι μια καρτέλα', page.includes('useAppointmentReminders(user?.id)'))
  ok('όλα τα ακίνητα: ανάγνωση ανά χρήστη', hook.includes('ofUserWithSeries') && !hook.includes('propertyId'))
  ok('και οι εμφανίσεις των σειρών', hook.includes('expandRecurring('))
  ok('ο κανόνας «ποιο χτυπά» είναι ο ίδιος', hook.includes('dueReminders(') && hook.includes('10'))
  ok('το ημερολόγιο δεν στήνει δεύτερο (διπλή ειδοποίηση)', !cal.includes('new Notification(') && !cal.includes('dueReminders('))
}

// ── 2. Υπενθυμίσεις για ΚΑΘΕ εμφάνιση σειράς, στο email και στο push ─────
{
  const sr = src('supabase/functions/send-reminders/index.ts')
  const push = src('app/api/push/route.ts')
  ok('email: αναπτύσσει τις σειρές με τη λογική του ημερολογίου', sr.includes("from '../../../lib/calendar/recurrence.ts'") && sr.includes('reminderOccurrences(events, todayStr, in7days)'))
  ok('email: μητρώο ανά εμφάνιση', sr.includes('reminderKey(e, check.type)') && sr.includes('logRows(toSend, check.type)'))
  ok('email: ληξιπρόθεσμο μόνο το μεμονωμένο', sr.includes(': overdueRows') && !sr.includes('events.filter(e => e.event_date < todayStr)'))
  ok('email: «Πλήρωσα» μόνο για αποθηκευμένη γραμμή', sr.includes('payable(toSend)'))
  ok('push: διαβάζει και τις σειρές πριν από το εύρος', push.includes('calendar.ofUserWithSeries') && push.includes('reminderOccurrences('))
  const rec = src('lib/calendar/recurrence.ts')
  ok('η κοινή λογική δεν έχει εισαγωγές (τη διαβάζει και η Deno)', !/^import /m.test(rec))
}

// ── 3. Κανένας διακόπτης χωρίς αποτέλεσμα ─────────────────────────────────
{
  const ns = src('app/dashboard/components/NotificationSettings.tsx')
  ok('ο διακόπτης «Αλλαγές νομοθεσίας» έφυγε (κανείς δεν τον διάβαζε)', !ns.includes('ariaLabel="Αλλαγές νομοθεσίας"'))
}

// ── 4. «Στις 08:00», χειμώνα και καλοκαίρι ───────────────────────────────
{
  const ns = src('app/dashboard/components/NotificationSettings.tsx')
  const sr = src('supabase/functions/send-reminders/index.ts')
  const mig = src('supabase/migrations/20261110131000_oi_eidopoiiseis_kanoun_o_ti_lene.sql')
  ok('η οθόνη λέει 08:00', ns.includes('08:00'))
  ok('cron σε 05:00 και 06:00 UTC με την ώρα Αθήνας στο σώμα', mig.includes("'0 5,6 * * *'") && mig.includes('{"athens_hour":8}'))
  ok('η συνάρτηση περνά μόνο τις 08 Αθήνας', sr.includes("timeZone: 'Europe/Athens', hour: '2-digit'") && sr.includes('want !== athensHour'))
  ok('η ημέρα είναι της Αθήνας, όχι του διακομιστή', sr.includes("const todayStr = athensDay(0)"))
  // Η ώρα 08 Αθήνας πέφτει σε ΜΙΑ από τις δύο ώρες UTC, κάθε μέρα του χρόνου.
  const hourAt = (iso: string) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Athens', hour: '2-digit', hourCycle: 'h23' }).format(new Date(iso)))
  for (const day of ['2026-01-15', '2026-03-28', '2026-03-29', '2026-07-15', '2026-10-24', '2026-10-25', '2026-12-31']) {
    const hits = [hourAt(`${day}T05:00:00Z`), hourAt(`${day}T06:00:00Z`)].filter(h => h === 8).length
    ok(`${day}: ακριβώς μία εκτέλεση στις 08:00 Αθήνας`, hits === 1)
  }
}

// ── 5. «Το όνομα αλλάζει μία φορά τον μήνα, για λόγους ασφάλειας» ─────────
{
  const mig = src('supabase/migrations/20261110131000_oi_eidopoiiseis_kanoun_o_ti_lene.sql')
  const settings = src('app/dashboard/components/TabSettings.tsx')
  const bill = src('app/dashboard/components/Billing.tsx')
  ok('η βάση το επιβάλλει', mig.includes("raise exception 'full_name_locked'") && mig.includes("interval '30 days'"))
  ok('ίδιες ημέρες στη βάση και στην οθόνη', NAME_LOCK_DAYS === 30)
  ok('τη σφραγίδα τη γράφει η βάση, όχι ο πελάτης', !settings.includes('full_name_changed_at: nowIso') && mig.includes('new.full_name_changed_at := now()'))
  ok('μόνο για τους ρόλους του πελάτη', mig.includes("current_user not in ('authenticated', 'anon')"))
  ok('και η φόρμα τιμολόγησης σέβεται το κλείδωμα', bill.includes('disabled={nameLockDays > 0}'))
  ok('η άρνηση αναγνωρίζεται', nameLockedError({ message: 'full_name_locked' }) && !nameLockedError({ message: 'other' }) && !nameLockedError(null))
  const now = Date.parse('2026-11-10T12:00:00Z')
  ok('αλλαγή πριν από 10 ημέρες: μένουν 20', nameDaysLeft('2026-10-31T12:00:00Z', now) === 20)
  ok('αλλαγή πριν από 31 ημέρες: ελεύθερο', nameDaysLeft('2026-10-10T12:00:00Z', now) === 0)
  ok('χωρίς αλλαγή: ελεύθερο', nameDaysLeft(null, now) === 0)
}

// ── 6. Διαγραφή εγγράφου πελάτη: πρώτα η γραμμή, μετά το αρχείο ──────────
{
  const uc = src('app/dashboard/components/clients/useClients.ts')
  const i = uc.indexOf('const delDoc')
  const body = uc.slice(i, uc.indexOf('};', i))
  ok('η γραμμή σβήνεται πριν από το αρχείο', body.indexOf("from('client_documents').delete()") > -1 && body.indexOf("from('client_documents').delete()") < body.indexOf('.remove([d.file_path])'))
  ok('αποτυχία γραμμής: το αρχείο μένει', /if \(!await saved\([^)]*client_documents[^\n]*\) return/.test(body))
}

// ── 7. Ευρήματα του ανεξάρτητου ελέγχου (10/11/2026) ──────────────────────
{
  const sr = src('supabase/functions/send-reminders/index.ts')
  const fix = src('supabase/migrations/20261110131500_to_mitroo_ton_ochliseon_grafei_sosta.sql')
  const i = sr.indexOf('ΠΡΩΤΑ ΤΟ ΜΗΤΡΩΟ, ΜΕΤΑ ΤΟ EMAIL')
  const dun = sr.slice(i, i + 2200)
  ok('όχληση: γράφει στη δική της στήλη, όχι στο event_id του ημερολογίου', dun.includes('rent_payment_id: r.id') && dun.includes('event_id: null') && !sr.includes("event_id: r.id, reminder_type: 'rent_overdue'"))
  ok('όχληση: το ιστορικό διαβάζεται από την ίδια στήλη', sr.includes(".in('rent_payment_id', overdueIds)"))
  ok('όχληση: μητρώο πριν από το email, χωρίς μητρώο δεν στέλνει', dun.indexOf('claimErr') > -1 && dun.indexOf('claimErr') < dun.indexOf('sendEmail(') && /if \(claimErr\)[^\n]*continue/.test(dun))
  ok('όχληση: email που δεν έφυγε σβήνει το μητρώο', dun.includes(".delete().in('id', ids)"))
  // κυριολεκτικό-πρότυπο: ψάχνουμε το κείμενο της πηγής, όχι τιμή.
  ok('όχληση: μία ειδοποίηση ανά στάδιο και δόση', fix.includes('notification_log_rent_payment_key') && fix.includes('(rent_payment_id, reminder_type)') && dun.includes('rent_overdue:${'))
  ok('η διαγραφή γεγονότος σβήνει το log του (CASCADE)', /references public\.calendar_events\(id\) on delete cascade/.test(fix))
  ok('το μηνιαίο μοναδικό αφορά μόνο τα μηνιαία', fix.includes('where event_id is null and rent_payment_id is null'))
  const mig = src('supabase/migrations/20261110131000_oi_eidopoiiseis_kanoun_o_ti_lene.sql')
  const t = mig.indexOf('if new.full_name is distinct from old.full_name then')
  const body = mig.slice(t, t + 900)
  ok('όνομα: ο έλεγχος του μήνα ισχύει και από κενό (Α → κενό → Β)', body.indexOf("raise exception 'full_name_locked'") > -1 && body.indexOf("raise exception 'full_name_locked'") < body.indexOf("coalesce(btrim(old.full_name), '') <> ''"))
  const bill = src('app/dashboard/components/Billing.tsx')
  ok('τιμολόγηση: αναγνωρίζει την άρνηση της βάσης', bill.includes('nameLockedError(error) ? NAME_LOCKED_TEXT'))
  ok('τιμολόγηση: κλειδώνει αμέσως μετά από αλλαγή', bill.includes('setNameLockDays(NAME_LOCK_DAYS)'))
  const hook = src('app/dashboard/components/useAppointmentReminders.ts')
  // κυριολεκτικό-πρότυπο: ψάχνουμε το κείμενο της πηγής, όχι τιμή.
  ok('ραντεβού: ξαναδιαβάζει σε κάθε αλλαγή γεγονότος', hook.includes("table: 'calendar_events', filter: `user_id=eq.${userId}`") && hook.includes('removeChannel(ch)'))
  ok('ραντεβού: και όταν η καρτέλα ξαναγίνει ορατή', hook.includes("'visibilitychange'"))
}

// ── 8. Δεύτερος γύρος του ανεξάρτητου ελέγχου (10/11/2026) ───────────────
{
  const sr = src('supabase/functions/send-reminders/index.ts')
  const se = sr.slice(sr.indexOf('async function sendEmail('), sr.indexOf('Deno.serve('))
  ok('αποστολή: εξαίρεση του fetch γίνεται «δεν στάλθηκε», δεν σταματά τον βρόχο', /try \{[\s\S]*await fetch\([\s\S]*\} catch[\s\S]*return false/.test(se))
  ok('ληξιπρόθεσμα: χωρίς μητρώο, χωρίς email (continue)', /if \(sentODErr\) \{[^}]*skipped\+\+; continue \}/.test(sr))
  const hook = src('app/dashboard/components/useAppointmentReminders.ts')
  ok('ραντεβού: μοναδικό κανάλι ανά προσάρτηση', /supabase\.channel\([^)]*randomSuffix\(/.test(hook))
  const mig = src('supabase/migrations/20261110131000_oi_eidopoiiseis_kanoun_o_ti_lene.sql')
  ok('η σειρά ανάπτυξης γράφεται σωστά (ανάποδα φεύγει διπλή όχληση)', mig.includes('ΥΠΟΧΡΕΩΤΙΚΗ') && !mig.includes('διπλό email δεν φεύγει'))
}

// ── 9. Ο έλεγχος Deno δέχεται τη γραμμή της βάσης χωρίς `as` (CI, 10/11/2026) ──
{
  const sr = src('supabase/functions/send-reminders/index.ts')
  ok('καμία μετατροπή τύπου προς CalendarEventsRow στις υπενθυμίσεις', !sr.includes('toSend as CalendarEventsRow[]') && !/filter\(e => !e\._virtual\) as /.test(sr))
  const rec = src('lib/calendar/recurrence.ts')
  ok('το Recurrable δέχεται recurring null', rec.includes('recurring?: boolean | null'))
}

console.log(`οι ειδοποιήσεις κάνουν ό,τι λένε: ${passed} ✓ · ${failed} ✗`)
if (failed) { console.log('Απέτυχαν:\n - ' + fails.join('\n - ')); process.exit(1) }
