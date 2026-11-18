// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΔΥΟ EMAIL ΤΗΣ ΠΡΩΙΝΗΣ ΕΡΓΑΣΙΑΣ (send-reminders): ΠΡΟΘΕΣΜΙΕΣ ΚΑΙ ΟΧΛΗΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Ζούσαν μέσα στο index.ts της συνάρτησης, δίπλα στο `Deno.serve`, όπου κανένας
// έλεγχος δεν μπορούσε να τα αποδώσει. Εδώ είναι καθαρές συναρτήσεις: γραμμές
// μέσα, { subject, html } έξω.
// ═══════════════════════════════════════════════════════════════════════════
import { emailShell, eyebrow, button, callout, dataTable } from './emailTemplates.ts'
import { EMAIL_LIGHT as C } from './emailPalette.ts'
import { APP_URL } from './site.ts'
import { eur, grDate } from './format.ts'
// Η εισαγωγή είναι μόνο τύπων: σβήνεται στη μεταγλώττιση και δεν φτάνει στο Deno.
import type { CalendarEventsRow, RentPaymentsRow, TenantsRow, UserPropertiesRow } from '../../../lib/supabase/tables.ts'

export type TenantName   = Pick<TenantsRow, 'id' | 'full_name'>
export type PropertyName = Pick<UserPropertiesRow, 'id' | 'name'>

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

export function buildEmail(events: CalendarEventsRow[], reminderType: string, pay: ReadonlyMap<string, string> = new Map()) {
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
export function buildDunningEmail(rows: RentPaymentsRow[], tenantMap: Record<string, TenantName>, propMap: Record<string, PropertyName>, today: Date, noticeLabel: string, noticeNumber: number) {
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
