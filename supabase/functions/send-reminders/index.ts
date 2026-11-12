import { emailShell, eyebrow, button, callout, dataTable } from '../_shared/emailTemplates.ts';
import { EMAIL_LIGHT as C } from '../_shared/emailPalette.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { APP_URL } from '../_shared/site.ts'
import { authorizeCron, cronDenial, type CronAuth } from '../_shared/auth.ts'
// Οι τύποι των γραμμών βγαίνουν από τα ίδια τα migrations (npm run db-types).
// Η εισαγωγή είναι μόνο τύπων: σβήνεται στη μεταγλώττιση και δεν φτάνει στο Deno.
import type { CalendarEventsRow, NotificationLogRow, RentPaymentsRow, TenantsRow, UserPropertiesRow } from '../../../lib/supabase/tables.ts'
import { eur, grDate } from '../_shared/format.ts'
import { senderFrom, REPLY_TO } from '../_shared/sender.mjs'
// Ο ΕΝΦΙΑ ΕΙΝΑΙ ΕΝΑ ΕΚΚΑΘΑΡΙΣΤΙΚΟ, ΟΧΙ ΕΝΑ ΑΝΑ ΑΚΙΝΗΤΟ. Οι προθεσμίες γράφονται
// πλέον μόνες τους σε κάθε ακίνητο· ο ίδιος κανόνας με τη συνδρομή και το push
// κρατά μία γραμμή ανά `tax:<id>`, ώστε δύο διαμερίσματα να μη δίνουν δύο email.
import { oneTaxCopy } from '../../../lib/calendar/taxOnce.ts'
// Οι σειρές αναπτύσσονται με την ΙΔΙΑ λογική που δείχνει το ημερολόγιο.
import { reminderOccurrences, reminderKey, reminderAllowed, incomeSameDayFallback, isIncomeInstalmentSource } from '../../../lib/calendar/recurrence.ts'
// «ΠΛΗΡΩΣΑ» ΜΕ ΕΝΑ ΠΑΤΗΜΑ (29/10/2026): κάθε γραμμή του email φέρνει σύνδεσμο
// που σημειώνει τη συγκεκριμένη προθεσμία πληρωμένη. Διακριτικό 256 bit, μόνο
// το αποτύπωμα στη βάση, μίας χρήσης, με λήξη (lib/reminders/payLink.ts).
import { newPayToken, payTokenExpiry, payUrl, isMissingTable } from '../../../lib/reminders/payLink.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Μυστικό cron: μόνο ο προγραμματιστής (pg_cron) που στέλνει το σωστό x-cron-secret
// μπορεί να πυροδοτήσει το sweep. Ίδιο μοτίβο με το ical-sync (least privilege — ΔΕΝ
// χρειάζεται πια το service-role key στην κλήση). Το function κρατά το δικό του
// service key εσωτερικά για τα queries.
const CRON_SECRET    = Deno.env.get('REMINDERS_CRON_SECRET') || ''
const FROM_EMAIL     = senderFrom(Deno.env.get('RESEND_FROM'))

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Τα δύο ερωτήματα ονόματος: ζητούν δύο στήλες, όχι ολόκληρη τη γραμμή.
type TenantName   = Pick<TenantsRow, 'id' | 'full_name'>
type PropertyName = Pick<UserPropertiesRow, 'id' | 'name'>

// Πύλη ασφαλείας cron (zero-config): εξουσιοδότηση αν η κλήση φέρει (α) το
// service-role key (Authorization: Bearer), (β) το προαιρετικό x-cron-secret env,
// ή (γ) το κοινό μυστικό cron που είναι αποθηκευμένο στη ΒΔ (public.cron_secrets).
// Η (γ) είναι η κύρια, μηδενικής-ρύθμισης οδός: το pg_cron στέλνει την ίδια τιμή
// από τον πίνακα και το function την επαληθεύει με τον service-role client του —
// άρα δεν χρειάζεται κανένα χειροκίνητο μυστικό στο dashboard.
async function authorized(req: Request): Promise<CronAuth> {
  return authorizeCron(req, { serviceKey: SUPABASE_KEY, envSecret: CRON_SECRET, supabase })
}

// ── Κείμενο χρήστη μέσα σε HTML email ──────────────────────────────────────
// Ο τίτλος γεγονότος, η κατηγορία, το όνομα μισθωτή και το όνομα ακινήτου τα
// γράφει ο χρήστης και ΜΠΑΙΝΑΝ ΑΥΤΟΥΣΙΑ σε HTML που φεύγει από το domain μας.
// Ένας τίτλος γεγονότος σαν
//
//     </span><a href="https://…">Πάτησε για να μη διακοπεί ο λογαριασμός σου</a>
//
// έφτιαχνε ολόκληρο μήνυμα ψαρέματος μέσα σε γνήσιο, υπογεγραμμένο email του
// προϊόντος — με το λογότυπό μας από πάνω. Εδώ σταματά: το κείμενο μένει κείμενο.
const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/**
 * Ένα διακριτικό «Πλήρωσα» ανά γεγονός. Αποτυχία εγγραφής δεν σταματά το email:
 * φεύγει όπως πριν, χωρίς τον σύνδεσμο.
 */
async function payLinks(userId: string, events: readonly CalendarEventsRow[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const rows: { user_id: string; event_id: string; token_hash: string; channel: string; expires_at: string }[] = []
  const now = new Date()
  for (const e of events) {
    const { token, hash } = await newPayToken()
    rows.push({ user_id: userId, event_id: e.id, token_hash: hash, channel: 'email', expires_at: payTokenExpiry(now) })
    out.set(e.id, payUrl(APP_URL, token))
  }
  if (!rows.length) return out
  const { error } = await supabase.from('reminder_pay_tokens').insert(rows)
  if (error) {
    // Ο πίνακας μπορεί να μην υπάρχει ακόμη (η συνάρτηση ανεβαίνει πριν από τη
    // μετανάστευση): το email φεύγει όπως πριν, χωρίς «Πλήρωσα».
    if (isMissingTable(error)) console.info('[send-reminders] «Πλήρωσα» ανενεργό: δεν υπάρχει ακόμη ο πίνακας')
    else console.error('[send-reminders] διακριτικά «Πλήρωσα»:', error)
    return new Map()
  }
  return out
}

function buildEmail(events: CalendarEventsRow[], reminderType: string, pay: ReadonlyMap<string, string> = new Map()) {
  // ΦΡΑΣΗ, ΟΧΙ ΕΤΙΚΕΤΑ. Το «σε ${typeLabel}» έβγαζε «σε αύριο» και το
  // «1 γεγονότα ΣΗΜΕΡΑ» μιλούσε με κεφαλαία και σε λάθος αριθμό.
  const whenPhrase: Record<string, string> = { '7days': 'σε 7 μέρες', '3days': 'σε 3 μέρες', '1day': 'αύριο', 'today': 'σήμερα' }
  // ΤΟ ΟΥΡΑΝΙΟ ΤΟΞΟ ΒΓΗΚΕ. Κάθε κατηγορία είχε δική της λωρίδα σε χρώμα του
  // Google (μπλε, γαλάζιο, πράσινο, μωβ, πορτοκαλί, γκρι), ενώ το ημερολόγιο
  // της εφαρμογής έκανε ΣΚΟΠΙΜΑ τις κατηγορίες ουδέτερες
  // (app/dashboard/components/calendar/model.tsx): το χρώμα κρατιέται για την
  // κατάσταση, όχι για το είδος. Η κατηγορία λέγεται με λέξη στη δεύτερη γραμμή.
  const catLabels: Record<string, string> = {
    // Οι φορολογικές προθεσμίες έφταναν ως «tax»: η κατηγορία έλειπε από τον
    // πίνακα και το κλειδί τυπωνόταν αυτούσιο κάτω από τον τίτλο.
    tax: 'Φορολογικά', financial: 'Οικονομικά', bills: 'Λογαριασμοί', maintenance: 'Συντήρηση', contract: 'Συμβόλαιο', tenant: 'Ενοικιαστής', reminder: 'Υπενθύμιση',
  }
  const isUrgent = reminderType === 'today' || reminderType === 'overdue'
  const totalAmount = events.reduce((s, e) => s + (e.amount || 0), 0)

  const eventRows = events.map(e => {
    const label = catLabels[e.category] || e.category
    const dateStr = e.event_date ? grDate(e.event_date) : ''
    return `
      <tr>
        <td class="rule-b" style="padding:12px 0;border-bottom:1px solid ${C.rule};">
          <span class="ink" style="display:block;font-size:14px;color:${C.ink};font-weight:500;">${esc(e.title)}</span>
          <span class="fa" style="display:block;font-size:12px;color:${C.mute};">${esc(label)} · ${dateStr}</span>
        </td>
        <td class="rule-b" style="padding:12px 0;border-bottom:1px solid ${C.rule};text-align:right;vertical-align:middle;">
          ${e.amount ? `<span class="ink" style="font-family:monospace;font-size:14px;color:${C.ink};font-weight:600;">${eur(e.amount)}</span>` : `<span class="fa" style="color:${C.mute};font-size:12px;">Χωρίς ποσό</span>`}
          ${pay.has(e.id) ? `<a href="${esc(pay.get(e.id))}" class="ac" style="display:block;margin-top:6px;font-size:13px;color:${C.accent};font-weight:700;text-decoration:none;">Πλήρωσα</a>` : ''}
        </td>
      </tr>`
  }).join('')

  const n = events.length
  const when = whenPhrase[reminderType] || ''
  const subject = reminderType === 'overdue'
    ? (n === 1 ? `Ληξιπρόθεσμο: ${events[0].title}` : `Ληξιπρόθεσμα: ${n} προθεσμίες`)
    : reminderType === 'today'
      ? (n === 1 ? `Σήμερα: ${events[0].title}` : `Σήμερα: ${n} προθεσμίες`)
      : `${n === 1 ? '1 προθεσμία λήγει' : `${n} προθεσμίες λήγουν`} ${when}`
  const headline = reminderType === 'overdue'
    ? (n === 1 ? '1 προθεσμία είναι ληξιπρόθεσμη' : `${n} προθεσμίες είναι ληξιπρόθεσμες`)
    : `${n === 1 ? '1 προθεσμία λήγει' : `${n} προθεσμίες λήγουν`} ${when}`

  const html = emailShell({
    preheader: `${headline}.`,
    footerNote: 'Αυτόματη ειδοποίηση ημερολογίου · properwise.gr',
    bodyHtml: callout(
      eyebrow(reminderType === 'overdue' ? 'Ληξιπρόθεσμο' : reminderType === 'today' ? 'Σήμερα' : 'Υπενθύμιση', isUrgent ? 'negative' : undefined)
      + `<p class="ink" style="margin:0;font-size:15px;color:${C.ink};font-weight:600;mso-line-height-rule:exactly;line-height:22px;">${headline}</p>`
      + (totalAmount > 0 ? `<p class="ac" style="margin:6px 0 0;font-size:13px;color:${C.accent};font-weight:700;mso-line-height-rule:exactly;line-height:19px;">Σύνολο: ${eur(totalAmount)}</p>` : ''),
      isUrgent ? 'alert' : 'accent')
      + dataTable(eventRows)
      + button('Δες τις προθεσμίες', `${APP_URL}/dashboard?tab=calendar`),
  })

  return { subject, html }
}

// Dunning email προς τον ιδιοκτήτη για ληξιπρόθεσμες δόσεις ενοικίου.
// Ίδιο στυλ με buildEmail (header, κάρτα, accent του brand, CTA) αλλά πάντα
// «urgent» (αρνητικός τόνος) και ΧΩΡΙΣ emoji — καθαρό, επαγγελματικό κείμενο.
function buildDunningEmail(rows: RentPaymentsRow[], tenantMap: Record<string, TenantName>, propMap: Record<string, PropertyName>, today: Date, noticeLabel: string, noticeNumber: number) {
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)

  const rowsHtml = rows.map(r => {
    const tenant = r.tenant_id != null ? (tenantMap[r.tenant_id]?.full_name || null) : null
    const prop   = r.property_id != null ? (propMap[r.property_id]?.name || null) : null
    const primary = tenant || prop || 'Χωρίς όνομα'
    // ΚΑΜΙΑ ΠΑΥΛΑ ΣΕ ΘΕΣΗ ΤΙΜΗΣ. Εγραφε «Περίοδος —» και «Λήξη —», δηλαδή δύο
    // ετικέτες που δεν συνοδεύονται από τίποτα. Η απουσία λέγεται με απουσία:
    // το κομμάτι απλώς δεν μπαίνει στη γραμμή.
    const period = (r.period_month != null && r.period_year != null)
      ? `${String(r.period_month).padStart(2, '0')}/${r.period_year}` : null
    const dueStr = r.due_date ? grDate(r.due_date) : null
    const daysOverdue = r.due_date ? Math.floor((today.getTime() - new Date(r.due_date).getTime()) / 86400000) : 0
    const secondary = [tenant && prop ? prop : null, period && `Περίοδος ${period}`, dueStr && `Λήξη ${dueStr}`].filter(Boolean).join(' · ')
    return `
      <tr>
        <td class="rule-b" style="padding:12px 0;border-bottom:1px solid ${C.rule};">
          <span class="ink" style="display:block;font-size:14px;color:${C.ink};font-weight:500;">${esc(primary)}</span>
          <span class="fa" style="display:block;font-size:12px;color:${C.mute};">${esc(secondary)}</span>
        </td>
        <td class="rule-b" style="padding:12px 0;border-bottom:1px solid ${C.rule};text-align:right;vertical-align:middle;">
          <span class="ink" style="font-family:monospace;font-size:14px;color:${C.ink};font-weight:600;">${eur(r.amount || 0)}</span>
          <span class="neg" style="display:block;font-size:11px;color:${C.negative};font-family:monospace;font-weight:700;">${daysOverdue} ${daysOverdue === 1 ? 'μέρα' : 'μέρες'} καθυστέρηση</span>
        </td>
      </tr>`
  }).join('')

  const n = rows.length
  const subject = `PROPERWISE · ${noticeLabel}: ληξιπρόθεσμο ενοίκιο (${n} ${n === 1 ? 'δόση' : 'δόσεις'})`

  const html = emailShell({
    preheader: `${n} ${n === 1 ? 'δόση ενοικίου είναι ληξιπρόθεσμη' : 'δόσεις ενοικίου είναι ληξιπρόθεσμες'}.`,
    footerNote: 'Αυτόματη ειδοποίηση ληξιπρόθεσμου ενοικίου · properwise.gr',
    bodyHtml: callout(
      eyebrow('Ληξιπρόθεσμο ενοίκιο', 'negative')
      + `<p class="ink" style="margin:0;font-size:15px;color:${C.ink};font-weight:600;mso-line-height-rule:exactly;line-height:22px;">${n} ${n === 1 ? 'δόση ενοικίου είναι ληξιπρόθεσμη' : 'δόσεις ενοικίου είναι ληξιπρόθεσμες'}</p>`
      + `<p class="fa" style="margin:6px 0 0;font-size:12px;color:${C.mute};font-weight:600;mso-line-height-rule:exactly;line-height:18px;">${noticeLabel} (ειδοποίηση Νο ${noticeNumber})</p>`
      + (total > 0 ? `<p class="neg" style="margin:6px 0 0;font-size:13px;color:${C.negative};font-weight:700;mso-line-height-rule:exactly;line-height:19px;">Σύνολο ληξιπρόθεσμων: ${eur(total)}</p>` : ''),
      'alert')
      + dataTable(rowsHtml)
      + button('Δες τα ληξιπρόθεσμα', `${APP_URL}/dashboard?tab=tenant`),
  })

  return { subject, html }
}

/**
 * `true` μόνο αν ο πάροχος δέχτηκε το μήνυμα. ΚΑΜΙΑ ΕΞΑΙΡΕΣΗ ΔΕΝ ΒΓΑΙΝΕΙ ΠΡΟΣ ΤΑ
 * ΕΞΩ: μια πεσμένη σύνδεση πετούσε μέσα στον βρόχο, άφηνε τη δέσμευση της
 * όχλησης χωρίς email και σταματούσε την εργασία για όλους τους υπόλοιπους
 * ιδιοκτήτες. Τώρα είναι απλώς «δεν στάλθηκε»: η δέσμευση σβήνεται και ο
 * βρόχος συνεχίζει με τον επόμενο.
 */
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, reply_to: REPLY_TO, to, subject, html }),
    })
    return res.ok
  } catch (err) {
    console.error('[send-reminders] αποστολή email:', err)
    return false
  }
}

Deno.serve(async (req) => {
  const auth = await authorized(req)
  if (!auth.ok) {
    const [body, status] = cronDenial(auth)
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }

  // ── ΣΤΙΣ 08:00 ΩΡΑ ΑΘΗΝΑΣ, ΧΕΙΜΩΝΑ ΚΑΙ ΚΑΛΟΚΑΙΡΙ ──────────────────────
  // Η οθόνη ρυθμίσεων λέει «στις 08:00». Το cron τρέχει σε UTC, οπότε μία ώρα
  // UTC είναι 08:00 μόνο τη μισή χρονιά. Τρέχει πλέον στις 05:00 ΚΑΙ στις 06:00
  // UTC με `{"athens_hour":8}` και εδώ περνά μόνο η κλήση που πέφτει στις 08
  // Αθήνας (migration 20261110131000). Κλήση χωρίς το πεδίο (χειροκίνητη,
  // δοκιμή) τρέχει όπως πάντα.
  const want = await req.clone().json().then((b: { athens_hour?: unknown }) => b?.athens_hour, () => undefined)
  const athensHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Athens', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
  if (typeof want === 'number' && want !== athensHour) {
    return new Response(JSON.stringify({ success: true, skipped: 'not_this_hour', athensHour }), { headers: { 'Content-Type': 'application/json' } })
  }

  // Η ΗΜΕΡΑ ΕΙΝΑΙ Η ΜΕΡΑ ΤΗΣ ΑΘΗΝΑΣ, όχι του διακομιστή (UTC).
  const athensDay = (plus: number) => {
    const d = new Date(Date.now() + plus * 86_400_000)
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  }
  const todayStr = athensDay(0)
  const in1day = athensDay(1), in3days = athensDay(3), in7days = athensDay(7)
  const fmt = (d: string) => d
  /** Μεσάνυχτα της ημέρας της Αθήνας, για τις ημέρες καθυστέρησης του ενοικίου. */
  const today = new Date(`${todayStr}T00:00:00Z`)

  try {
    // ═══ ΔΥΟ ΑΝΑΓΝΩΣΕΙΣ ΠΟΥ ΕΣΒΗΝΑΝ ΟΛΟΚΛΗΡΗ ΤΗΝ ΕΡΓΑΣΙΑ ΜΕ ΠΡΑΣΙΝΟ ══════════
    // ΤΟ ΣΦΑΛΜΑ. Και οι δύο αγνοούσαν το `error`. Μια αποτυχία —δίκτυο, policy,
    // χρονικό όριο— γύριζε `undefined`, που εδώ διαβαζόταν ΑΚΡΙΒΩΣ όπως «κανείς
    // δεν θέλει ειδοποιήσεις»: η εργασία απαντούσε 200 «No users» και τελείωνε.
    // Καμία υπενθύμιση σε κανέναν ιδιοκτήτη εκείνη τη μέρα — και ένα πράσινο
    // τρέξιμο στον πίνακα για να το επιβεβαιώσει.
    //
    // Η ΔΕΥΤΕΡΗ ΕΙΝΑΙ ΧΕΙΡΟΤΕΡΗ, ΓΙΑΤΙ ΔΕΝ ΣΤΑΜΑΤΑΕΙ ΚΑΝ. Ο κατάλογος των
    // επιτρεπτών παραληπτών, άδειος από αποτυχία, κάνει το `mailbox()` να
    // γυρίζει κενό για ΚΑΘΕ χρήστη: η εργασία τρέχει ως το τέλος, δεν στέλνει
    // ούτε ένα email και απαντά `success: true, sent: 0`.
    //
    // Το σφάλμα των τριών παρακολουθητών που έγραφαν `raise warning` πάνω σε
    // αποτυχία ήταν το ίδιο πράγμα. Οταν μια εργασία δεν μπορεί να κάνει τη
    // δουλειά της, το λέει με 500.
    // Τα ληγμένα διακριτικά «Πλήρωσα» δεν κάνουν πια τίποτα: σβήνονται μία
    // φορά τη μέρα. Αποτυχία εδώ δεν σταματά τις υπενθυμίσεις.
    const { error: purgeErr } = await supabase.from('reminder_pay_tokens').delete().lt('expires_at', new Date().toISOString())
    if (purgeErr && !isMissingTable(purgeErr)) console.error('[send-reminders] ληγμένα διακριτικά «Πλήρωσα»:', purgeErr)

    const { data: prefs, error: prefsErr } = await supabase.from('notification_preferences').select('*').eq('email_enabled', true)
    if (prefsErr) {
      console.error('[send-reminders] οι προτιμήσεις δεν διαβάστηκαν:', prefsErr)
      return new Response(JSON.stringify({ error: 'notification_preferences unreadable', detail: prefsErr.message }), { status: 500 })
    }
    if (!prefs?.length) return new Response(JSON.stringify({ message: 'No users' }), { status: 200 })

    // ── ΣΕ ΠΟΙΟΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΣΤΑΛΕΙ ────────────────────────────────────
    // Η `reminder_email` είναι ελεύθερο κείμενο που γράφει ο χρήστης: μπορεί να
    // είναι γείτονας, πρώην, άγνωστος. Το μήνυμα φεύγει από ΤΟ ΔΙΚΟ ΜΑΣ domain,
    // με το δικό μας λογότυπο, σε άνθρωπο που δεν το ζήτησε ποτέ.
    //
    // Η απάντηση δεν κρίνεται εδώ. Τη δίνει η `reminder_recipients` της βάσης,
    // που είναι η ΜΙΑ πηγή: η διεύθυνση του ίδιου του λογαριασμού περνά (την
    // επαλήθευσε η εγγραφή), κάθε άλλη μόνο αφού επιβεβαιωθεί και η αλλαγή
    // διεύθυνσης ακυρώνει την επιβεβαίωση. Αν αύριο γραφτεί δεύτερος αποστολέας,
    // θα ρωτήσει το ίδιο πράγμα και θα πάρει την ίδια απάντηση.
    const { data: allowed, error: allowedErr } = await supabase.rpc('reminder_recipients')
    if (allowedErr) {
      console.error('[send-reminders] οι επιτρεπτοί παραλήπτες δεν διαβάστηκαν:', allowedErr)
      return new Response(JSON.stringify({ error: 'reminder_recipients unreadable', detail: allowedErr.message }), { status: 500 })
    }
    const inbox = new Map<string, string>()
    for (const r of ((allowed || []) as { user_id: string; email: string | null }[])) {
      if (r.email) inbox.set(r.user_id, r.email)
    }
    /** Η επιτρεπτή διεύθυνση αυτού του ιδιοκτήτη, ή κενό: τότε δεν στέλνεται τίποτα. */
    const mailbox = (userId: string) => inbox.get(userId) || ''

    // ── ΚΑΙ ΤΑ ΔΥΟ ΠΕΡΑΣΜΑΤΑ ΦΤΑΝΟΥΝ ΜΟΝΟ ΣΤΟΝ ΙΔΙΟΚΤΗΤΗ ──────────────────
    // Το ημερολόγιο και το ληξιπρόθεσμο ενοίκιο γράφουν στο mailbox(user_id).
    // Το tenants.email δεν το διαβάζει κανένας αποστολέας. Ως 10/11/2026 το
    // διάβαζε η lifecycle_enqueue για το `tenant_welcome`. Αφαιρέθηκε στο
    // 20261110130000 και το db-replay ελέγχει ότι δεν μπαίνει τίποτα στην ουρά.
    // Η οθόνη ρυθμίσεων το λέει πλέον ρητά, αντί για «διακριτική ενημέρωση»
    // με κλιμάκωση και όριο ανά δόση, που διαβαζόταν ως όχληση οφειλέτη.
    //
    // ΤΙ ΘΑ ΧΡΕΙΑΖΟΤΑΝ ΓΙΑ ΝΑ ΦΤΑΣΕΙ ΣΤΟΝ ΜΙΣΘΩΤΗ. Οχι σιωπηλά: μήνυμα από
    // το δικό μας domain σε τρίτον που δεν το ζήτησε είναι χειρότερο από το
    // κενό. Θα χρειαζόταν, με αυτή τη σειρά:
    //   1. Συγκατάθεση του ίδιου του μισθωτή, με το μοτίβο επιβεβαίωσης της
    //      reminder_recipients: token, λήξη 48 ωρών, ακύρωση σε αλλαγή.
    //   2. Στήλες tenants.email_verified/_token/_token_at και trigger
    //      επαναεπιβεβαίωσης, όπως το 20260810070000 για τον ιδιοκτήτη.
    //   3. Σύνδεσμο διαγραφής σε κάθε μήνυμα και έλεγχο άρνησης πριν από
    //      κάθε αποστολή, όχι μόνο στην πρώτη.
    //   4. Ενημέρωση απορρήτου και υπεργολάβων: ο μισθωτής γίνεται
    //      παραλήπτης, δεν είναι πια μόνο όνομα μέσα σε μήνυμα.
    //   5. Δικό του πρότυπο κειμένου. Το σημερινό dunning απευθύνεται στον
    //      ιδιοκτήτη («Ανοιγμα PROPERWISE»), δεν διαβάζεται από τρίτον.

    let totalSent = 0
    /** Πόσοι παραλήπτες πηδήχτηκαν επειδή μια ανάγνωση απέτυχε. Μπαίνει στην απάντηση. */
    let skipped = 0

    for (const pref of prefs) {
      const to = mailbox(pref.user_id)
      if (!to) continue
      // ΑΠΟΤΥΧΙΑ ΑΝΑΓΝΩΣΗΣ ΔΕΝ ΕΙΝΑΙ «ΔΕΝ ΕΧΕΙ ΠΡΟΘΕΣΜΙΕΣ». Χωρίς το `error`, μια
      // πεσμένη σύνδεση ή ένα δικαίωμα που άλλαξε έδινε κενή λίστα: ο ιδιοκτήτης
      // δεν έπαιρνε ΚΑΜΙΑ υπενθύμιση και η εργασία απαντούσε «success». Ο
      // μετρητής `skipped` ταξιδεύει ήδη στην απάντηση, όπως και στις άλλες
      // τρεις αναγνώσεις αυτού του βρόχου.
      const { data: rows, error: evErr } = await supabase.from('calendar_events').select('*').eq('user_id', pref.user_id).eq('status', 'pending')
      if (evErr) { console.error('[send-reminders] γεγονότα ημερολογίου:', evErr); skipped++; continue }
      const events = oneTaxCopy((rows || []) as CalendarEventsRow[]).kept
      if (!events.length) continue
      // ΚΑΘΕ ΕΜΦΑΝΙΣΗ ΜΙΑΣ ΣΕΙΡΑΣ, ΟΧΙ ΜΟΝΟ Η ΠΡΩΤΗ (lib/calendar/recurrence.ts).
      const { upcoming, overdue: overdueRows } = reminderOccurrences(events, todayStr, in7days)
      /** Τι έχει ήδη σταλεί, ως «event_id|είδος». Αποτυχία ανάγνωσης = null: δεν στέλνουμε. */
      const sentKeys = async (list: typeof upcoming, type: string): Promise<Set<string> | null> => {
        const keys = list.map(e => reminderKey(e, type))
        const { data, error } = await supabase.from('notification_log').select('event_id,reminder_type')
          .in('event_id', [...new Set(keys.map(k => k.event_id))]).in('reminder_type', [...new Set(keys.map(k => k.reminder_type))])
        if (error) { console.error('[send-reminders] μητρώο απεσταλμένων:', error); return null }
        return new Set(((data || []) as Pick<NotificationLogRow, 'event_id' | 'reminder_type'>[]).map(l => `${l.event_id}|${l.reminder_type}`))
      }
      const logRows = (list: typeof upcoming, type: string) =>
        list.map(e => ({ user_id: pref.user_id, ...reminderKey(e, type) }))
      // «Πλήρωσα» μόνο για αποθηκευμένη γραμμή: το διακριτικό δείχνει σε uuid
      // και η εικονική εμφάνιση δεν έχει δικό της (το ημερολόγιο τη σημειώνει
      // πληρωμένη αποσπώντας την από τη σειρά).
      const payable = (list: typeof upcoming) => list.filter(e => !e._virtual)

      const checks = [
        { type: '7days', enabled: pref.reminder_7days, date: fmt(in7days) },
        { type: '3days', enabled: pref.reminder_3days, date: fmt(in3days) },
        { type: '1day',  enabled: pref.reminder_1day,  date: fmt(in1day)  },
        // ΗΤΑΝ ΣΤΑΘΕΡΟ `true`. Ο διακόπτης «Ημέρα εκτέλεσης» υπήρχε στην οθόνη
        // ρυθμίσεων, δεν είχε στήλη στη βάση και εδώ αγνοούνταν ολότελα: ό,τι κι
        // αν επέλεγε ο χρήστης, το μήνυμα της ίδιας ημέρας έφευγε.
        { type: 'today', enabled: pref.reminder_today !== false, date: todayStr },
      ]

      for (const check of checks) {
        if (!check.enabled) continue
        // Οι δόσεις του φόρου εισοδήματος παίρνουν μόνο την υπενθύμιση των τριών
        // ημερών (lib/calendar/recurrence.ts, `reminderAllowed`).
        let matching = upcoming.filter(e => e.event_date === check.date && reminderAllowed(e, check.type))
        // Η ίδια μέρα για τη δόση που δεν πήρε υπενθύμιση τριών ημερών (κλειστή ή
        // γραμμή νεότερη). Χωρίς μητρώο, καμία αναπλήρωση: όχι διπλό email.
        const dueInc = check.type === 'today' ? upcoming.filter(e => e.event_date === check.date && isIncomeInstalmentSource(e.source)) : []
        if (dueInc.length) {
          const sent3 = pref.reminder_3days ? await sentKeys(dueInc, '3days') : new Set<string>()
          if (sent3) matching = [...matching, ...incomeSameDayFallback(dueInc, !!pref.reminder_3days, sent3)]
        }
        if (!matching.length) continue
        // ΤΟ ΜΗΤΡΩΟ ΑΠΕΣΤΑΛΜΕΝΩΝ ΕΙΝΑΙ Ο ΜΟΝΟΣ ΦΡΑΓΜΟΣ ΓΙΑ ΔΙΠΛΑ EMAIL. Αγνοώντας
        // το `error`, μια αποτυχία γινόταν «δεν έχει σταλεί τίποτα» και η ίδια
        // υπενθύμιση έφευγε ΞΑΝΑ στον ίδιο άνθρωπο. Το να μη σταλεί σήμερα μια
        // υπενθύμιση διορθώνεται αύριο· ένα διπλό email δεν ξαναπαίρνεται πίσω.
        const sent = await sentKeys(matching, check.type)
        if (!sent) { skipped++; continue }
        const toSend = matching.filter(e => { const k = reminderKey(e, check.type); return !sent.has(`${k.event_id}|${k.reminder_type}`) })
        if (!toSend.length) continue
        const { subject, html } = buildEmail(toSend, check.type, await payLinks(pref.user_id, payable(toSend)))
        const ok = await sendEmail(to, subject, html)
        if (ok) {
          await supabase.from('notification_log').insert(logRows(toSend, check.type))
          totalSent++
        }
      }

      // Το ίδιο ίσχυε για τα εκπρόθεσμα: ο διακόπτης υπήρχε και κανείς δεν τον διάβαζε.
      const overdue = pref.reminder_overdue === false ? [] : overdueRows
      if (overdue.length) {
        const { data: sentOD, error: sentODErr } = await supabase.from('notification_log').select('event_id').in('event_id', overdue.map(e=>e.id)).eq('reminder_type','overdue')
        // ΧΩΡΙΣ ΜΗΤΡΩΟ, ΧΩΡΙΣ EMAIL: όπως στα 7/3/1/σήμερα. Χωρίς το `continue`
        // η αποτυχία ανάγνωσης γινόταν «δεν έχει σταλεί τίποτα» και το ίδιο
        // ληξιπρόθεσμο ξανάφευγε. Το πέρασμα των οχλήσεων είναι χωριστό, πιο κάτω.
        if (sentODErr) { console.error('[send-reminders] μητρώο ληξιπρόθεσμων:', sentODErr); skipped++; continue }
        const sentODIds = new Set(((sentOD||[]) as Pick<NotificationLogRow,'event_id'>[]).map(l=>l.event_id))
        const toSendOD  = overdue.filter(e => !sentODIds.has(e.id))
        if (toSendOD.length) {
          const { subject, html } = buildEmail(toSendOD, 'overdue', await payLinks(pref.user_id, toSendOD))
          const ok = await sendEmail(to, subject, html)
          if (ok) {
            await supabase.from('notification_log').insert(toSendOD.map(e => ({ user_id: pref.user_id, event_id: e.id, reminder_type: 'overdue' })))
            totalSent++
          }
        }
      }
    }

    // ── Dunning pass: αυτόματο email στον ιδιοκτήτη για ληξιπρόθεσμες δόσεις ενοικίου ──
    // Ξεχωριστό pass πάνω στα prefs (ΟΧΙ μέσα στο calendar loop) ώστε ιδιοκτήτες
    // χωρίς calendar_events — που κόβονται από το `if (!events?.length) continue` —
    // να λαμβάνουν παρ' όλα αυτά dunning για το ενοίκιο.
    //
    // CADENCE + CAP GUARANTEE: at most `dunning_max` notices per instalment, spaced
    // ≥ `dunning_every_days` days, escalating tone; disabled when dunning_enabled=false.
    // Το notification_log ΔΕΝ ορίζεται σε καμία μετανάστευση και χρησιμοποιείται
    // πολυμορφικά (π.χ. ο market-data-updater γράφει rows χωρίς event_id), άρα το event_id
    // είναι απλό nullable uuid ΧΩΡΙΣ foreign key προς calendar_events. Επομένως αποθηκεύουμε
    // το rent_payment id στο event_id με reminder_type='rent_overdue' και κάνουμε escalation
    // βάσει του πλήθους/χρόνου των προηγούμενων ειδοποιήσεων ανά δόση.
    let dunningSent = 0
    for (const pref of prefs) {
      const to = mailbox(pref.user_id)
      if (!to) continue

      // Per-owner dunning settings, ασφαλή defaults (columns may be null on old rows).
      const dunningEnabled = pref.dunning_enabled !== false
      const everyDays = Number.isFinite(pref.dunning_every_days) && pref.dunning_every_days > 0 ? pref.dunning_every_days : 7
      const maxNotices = Number.isFinite(pref.dunning_max) && pref.dunning_max > 0 ? pref.dunning_max : 3
      if (!dunningEnabled) continue

      // Ιδιο σχήμα με τα γεγονότα: κενό σύνολο εκπρόθεσμων σημαίνει «πληρώθηκαν
      // όλα» — και είναι ψέμα όταν η ανάγνωση απέτυχε.
      const { data: overdueRent, error: odErr } = await supabase.from('rent_payments')
        .select('*').eq('user_id', pref.user_id).eq('paid', false).lt('due_date', todayStr)
      if (odErr) { console.error('[send-reminders] ληξιπρόθεσμες δόσεις:', odErr); skipped++; continue }
      // Μόνο δόσεις με non-null due_date αυστηρά πριν από σήμερα (belt-and-suspenders·
      // η .lt() ήδη αποκλείει NULL due_date στην Postgres).
      const overdue = ((overdueRent || []) as RentPaymentsRow[]).filter(r => r.due_date != null && r.due_date < todayStr)
      if (!overdue.length) continue

      const overdueIds = overdue.map(r => r.id)
      if (!overdueIds.length) continue
      // ΟΛΑ τα προηγούμενα dunning logs για αυτές τις δόσεις με μία query.
      // Η ΟΧΛΗΣΗ ΕΧΕΙ ΔΙΚΗ ΤΗΣ ΣΤΗΛΗ (20261110131500). Ως τις 10/11/2026 γραφόταν
      // στο `event_id`, που δείχνει στο calendar_events: η εισαγωγή αποτύγχανε,
      // το ιστορικό έμενε άδειο και κάθε εκτέλεση έστελνε ξανά «πρώτη» όχληση.
      const { data: priorLogs, error: priorErr } = await supabase.from('notification_log')
        .select('rent_payment_id, created_at').like('reminder_type', 'rent_overdue%')
        .in('rent_payment_id', overdueIds)
      // Ιδιο σκεπτικό: χωρίς το ιστορικό, ΚΑΘΕ ληξιπρόθεσμη δόση θα φαινόταν
      // ανειδοποίητη και η όχληση θα ξανάφευγε από την αρχή, με τον αριθμό
      // ειδοποίησης μηδενισμένο. Καλύτερα καμία όχληση σήμερα.
      if (priorErr) { console.error('[send-reminders] ιστορικό οχλήσεων:', priorErr); skipped++; continue }

      // Per-instalment: COUNT προηγούμενων ειδοποιήσεων + MAX(created_at) (πιο πρόσφατη).
      const priorCount: Record<string, number> = {}
      const lastNotice: Record<string, number> = {}
      for (const l of (priorLogs || []) as { rent_payment_id: string; created_at: string | null }[]) {
        const id = l.rent_payment_id
        priorCount[id] = (priorCount[id] || 0) + 1
        const t = l.created_at ? new Date(l.created_at).getTime() : NaN
        if (Number.isFinite(t) && (lastNotice[id] === undefined || t > lastNotice[id])) lastNotice[id] = t
      }

      // Eligible τώρα ⇔ (count < maxNotices) ΚΑΙ (καμία προηγούμενη ή η πιο πρόσφατη
      // είναι παλαιότερη από everyDays μέρες: now - lastNoticeTime >= everyDays*86400000).
      const now = new Date().getTime()
      // Δύο ώρες ανοχή: η εργασία τρέχει στις 08:00 Αθήνας, που την ημέρα της
      // αλλαγής ώρας απέχει 23 ώρες από την προηγούμενη. Χωρίς την ανοχή, η
      // όχληση εκείνης της μέρας θα πήγαινε μία μέρα πίσω.
      const spacingMs = everyDays * 86400000 - 2 * 3600000
      const toNotify = overdue.filter(r => {
        const count = priorCount[r.id] || 0
        if (count >= maxNotices) return false
        const last = lastNotice[r.id]
        return last === undefined || (now - last) >= spacingMs
      })
      if (!toNotify.length) continue

      // Escalation: notice number αυτού του send = priorCount + 1 ανά δόση· χρησιμοποιούμε
      // το MAX μεταξύ των eligible δόσεων για τον τόνο του subject.
      const noticeNumber = Math.max(...toNotify.map(r => (priorCount[r.id] || 0) + 1))
      const noticeLabel = noticeNumber >= 3 ? 'Τελική υπόμνηση' : noticeNumber === 2 ? 'Δεύτερη υπενθύμιση' : 'Υπενθύμιση'

      // Batched name lookups (κανένα N+1)· skip τα .in() όταν η λίστα ids είναι κενή.
      const tenantIds = [...new Set(toNotify.map(r => r.tenant_id).filter((v): v is string => v != null))]
      const propIds   = [...new Set(toNotify.map(r => r.property_id).filter((v): v is string => v != null))]
      const tenantMap: Record<string, TenantName> = {}
      const propMap: Record<string, PropertyName> = {}
      // ΤΑ ΟΝΟΜΑΤΑ ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΣΗ ΣΕ ΟΧΛΗΣΗ ΟΦΕΙΛΗΣ. Αν η αναζήτηση
      // αποτύχει, οι χάρτες μένουν άδειοι και το μήνυμα φεύγει λέγοντας «ο
      // ενοικιαστής» και «το ακίνητο» για συγκεκριμένο χρέος: έγγραφο που ο
      // παραλήπτης δεν μπορεί να αντιστοιχίσει σε τίποτα. Καλύτερα να μη φύγει.
      if (tenantIds.length) {
        const { data: tRows, error: tErr } = await supabase.from('tenants').select('id, full_name').in('id', tenantIds)
        if (tErr) { console.error('[send-reminders] ονόματα ενοικιαστών:', tErr); skipped++; continue }
        for (const t of (tRows || []) as TenantName[]) tenantMap[t.id] = t
      }
      if (propIds.length) {
        const { data: pRows, error: pErr } = await supabase.from('user_properties').select('id, name').in('id', propIds)
        if (pErr) { console.error('[send-reminders] ονόματα ακινήτων:', pErr); skipped++; continue }
        for (const p of (pRows || []) as PropertyName[]) propMap[p.id] = p
      }

      // ΠΡΩΤΑ ΤΟ ΜΗΤΡΩΟ, ΜΕΤΑ ΤΟ EMAIL. Αν το μητρώο δεν γραφτεί, δεν στέλνουμε:
      // μια όχληση που λείπει σήμερα φεύγει αύριο, μια διπλή όχληση σε οφειλέτη
      // δεν ξαναπαίρνεται πίσω. Το μοναδικό (rent_payment_id, είδος) κόβει και
      // δεύτερη ταυτόχρονη εκτέλεση. Αν το email δεν φύγει, το μητρώο σβήνεται.
      const { data: claimed, error: claimErr } = await supabase.from('notification_log').insert(toNotify.map(r => ({
        user_id: pref.user_id, event_id: null, rent_payment_id: r.id,
        reminder_type: `rent_overdue:${(priorCount[r.id] || 0) + 1}`, created_at: new Date().toISOString(),
      }))).select('id')
      if (claimErr) { console.error('[send-reminders] μητρώο οχλήσεων:', claimErr); skipped++; continue }
      const { subject, html } = buildDunningEmail(toNotify, tenantMap, propMap, today, noticeLabel, noticeNumber)
      const ok = await sendEmail(to, subject, html)
      if (ok) dunningSent++
      else {
        const ids = ((claimed || []) as { id: string }[]).map(c => c.id)
        if (ids.length) {
          const { error: undoErr } = await supabase.from('notification_log').delete().in('id', ids)
          if (undoErr) console.error('[send-reminders] αναίρεση μητρώου οχλήσεων:', undoErr)
        }
      }
    }

    // ΟΙ ΠΑΡΑΛΕΙΨΕΙΣ ΤΑΞΙΔΕΥΟΥΝ ΣΤΗΝ ΑΠΑΝΤΗΣΗ. Μια εργασία που πήδηξε δέκα
    // παραλήπτες επειδή δεν διάβασε το μητρώο τους ΔΕΝ είναι ίδια με μια που
    // δεν είχε τίποτα να στείλει· ο πίνακας πρέπει να ξεχωρίζει τις δύο.
    return new Response(JSON.stringify({ success: true, sent: totalSent, dunningSent, skipped }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})