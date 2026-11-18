// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΔΥΟ EMAIL ΤΗΣ ΠΡΩΙΝΗΣ ΕΡΓΑΣΙΑΣ (send-reminders): ΠΡΟΘΕΣΜΙΕΣ ΚΑΙ ΟΧΛΗΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Ζούσαν μέσα στο index.ts της συνάρτησης, δίπλα στο `Deno.serve`, όπου κανένας
// έλεγχος δεν μπορούσε να τα αποδώσει. Εδώ είναι καθαρές συναρτήσεις: γραμμές
// μέσα, { subject, html } έξω.
// ═══════════════════════════════════════════════════════════════════════════
import { emailShell, eyebrow, button, callout, dataTable, type Lang } from './emailTemplates.ts'
import { EMAIL_LIGHT as C } from './emailPalette.ts'
import { APP_URL } from './site.ts'
import { eur, grDate } from './format.ts'
// Η εισαγωγή είναι μόνο τύπων: σβήνεται στη μεταγλώττιση και δεν φτάνει στο Deno.
// Ο αγγλικός τίτλος της φορολογικής προθεσμίας βγαίνει από το είδος της (καμία εισαγωγή μέσα του).
import { taxEventTitleEn } from '../../../lib/i18n/en/taxTitle.ts'
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

// ═══ ΤΑ ΚΕΙΜΕΝΑ, ΑΝΑ ΓΛΩΣΣΑ ════════════════════════════════════════════
// Τα ελληνικά είναι αυτά που έφευγαν πάντα, λέξη προς λέξη. Τα αγγλικά λένε
// τα ίδια με την ίδια σειρά· τα ποσά και οι ημερομηνίες μένουν σε ελληνική
// μορφή («1.234,50€», «30/11/2026»), όπως σε όλη την εφαρμογή.
const T = {
  el: {
    // ΦΡΑΣΗ, ΟΧΙ ΕΤΙΚΕΤΑ. Το «σε ${typeLabel}» έβγαζε «σε αύριο» και το
    // «1 γεγονότα ΣΗΜΕΡΑ» μιλούσε με κεφαλαία και σε λάθος αριθμό.
    when: { '7days': 'σε 7 μέρες', '3days': 'σε 3 μέρες', '1day': 'αύριο', 'today': 'σήμερα' } as Record<string, string>,
    // ΤΟ ΟΥΡΑΝΙΟ ΤΟΞΟ ΒΓΗΚΕ. Κάθε κατηγορία είχε δική της λωρίδα σε χρώμα του
    // Google (μπλε, γαλάζιο, πράσινο, μωβ, πορτοκαλί, γκρι), ενώ το ημερολόγιο
    // της εφαρμογής έκανε ΣΚΟΠΙΜΑ τις κατηγορίες ουδέτερες
    // (app/dashboard/components/calendar/model.tsx): το χρώμα κρατιέται για την
    // κατάσταση, όχι για το είδος. Η κατηγορία λέγεται με λέξη στη δεύτερη γραμμή.
    // Οι φορολογικές προθεσμίες έφταναν ως «tax»: η κατηγορία έλειπε από τον
    // πίνακα και το κλειδί τυπωνόταν αυτούσιο κάτω από τον τίτλο.
    cat: { tax: 'Φορολογικά', financial: 'Οικονομικά', bills: 'Λογαριασμοί', maintenance: 'Συντήρηση', contract: 'Συμβόλαιο', tenant: 'Ενοικιαστής', reminder: 'Υπενθύμιση' } as Record<string, string>,
    noAmount: 'Χωρίς ποσό',
    paid: 'Πλήρωσα',
    overdueSubject: (n: number, title: string) => n === 1 ? `Ληξιπρόθεσμο: ${title}` : `Ληξιπρόθεσμα: ${n} προθεσμίες`,
    todaySubject: (n: number, title: string) => n === 1 ? `Σήμερα: ${title}` : `Σήμερα: ${n} προθεσμίες`,
    due: (n: number, when: string) => `${n === 1 ? '1 προθεσμία λήγει' : `${n} προθεσμίες λήγουν`} ${when}`,
    overdueHead: (n: number) => n === 1 ? '1 προθεσμία είναι ληξιπρόθεσμη' : `${n} προθεσμίες είναι ληξιπρόθεσμες`,
    footer: 'Αυτόματη ειδοποίηση ημερολογίου · properwise.gr',
    eyebrow: { overdue: 'Ληξιπρόθεσμο', today: 'Σήμερα', other: 'Υπενθύμιση' },
    total: 'Σύνολο: ',
    cta: 'Δες τις προθεσμίες',
    // Όχληση ενοικίου
    noName: 'Χωρίς όνομα',
    period: (p: string) => `Περίοδος ${p}`,
    dueOn: (d: string) => `Λήξη ${d}`,
    late: (d: number) => `${d} ${d === 1 ? 'μέρα' : 'μέρες'} καθυστέρηση`,
    rentSubject: (label: string, n: number) => `PROPERWISE · ${label}: ληξιπρόθεσμο ενοίκιο (${n} ${n === 1 ? 'δόση' : 'δόσεις'})`,
    rentHead: (n: number) => `${n} ${n === 1 ? 'δόση ενοικίου είναι ληξιπρόθεσμη' : 'δόσεις ενοικίου είναι ληξιπρόθεσμες'}`,
    rentFooter: 'Αυτόματη ειδοποίηση ληξιπρόθεσμου ενοικίου · properwise.gr',
    rentEyebrow: 'Ληξιπρόθεσμο ενοίκιο',
    notice: (label: string, n: number) => `${label} (ειδοποίηση Νο ${n})`,
    rentTotal: 'Σύνολο ληξιπρόθεσμων: ',
    rentCta: 'Δες τα ληξιπρόθεσμα',
    label: (n: number) => n >= 3 ? 'Τελική υπόμνηση' : n === 2 ? 'Δεύτερη υπενθύμιση' : 'Υπενθύμιση',
  },
  en: {
    when: { '7days': 'in 7 days', '3days': 'in 3 days', '1day': 'tomorrow', 'today': 'today' } as Record<string, string>,
    cat: { tax: 'Tax', financial: 'Financial', bills: 'Bills', maintenance: 'Maintenance', contract: 'Contract', tenant: 'Tenant', reminder: 'Reminder' } as Record<string, string>,
    noAmount: 'No amount',
    paid: 'I paid',
    overdueSubject: (n: number, title: string) => n === 1 ? `Overdue: ${title}` : `Overdue: ${n} deadlines`,
    todaySubject: (n: number, title: string) => n === 1 ? `Today: ${title}` : `Today: ${n} deadlines`,
    due: (n: number, when: string) => `${n === 1 ? '1 deadline is due' : `${n} deadlines are due`} ${when}`,
    overdueHead: (n: number) => n === 1 ? '1 deadline is overdue' : `${n} deadlines are overdue`,
    footer: 'Automatic calendar notification · properwise.gr',
    eyebrow: { overdue: 'Overdue', today: 'Today', other: 'Reminder' },
    total: 'Total: ',
    cta: 'See your deadlines',
    noName: 'No name',
    period: (p: string) => `Period ${p}`,
    dueOn: (d: string) => `Due ${d}`,
    late: (d: number) => `${d} ${d === 1 ? 'day' : 'days'} late`,
    rentSubject: (label: string, n: number) => `PROPERWISE · ${label}: overdue rent (${n} ${n === 1 ? 'installment' : 'installments'})`,
    rentHead: (n: number) => `${n} ${n === 1 ? 'rent installment is overdue' : 'rent installments are overdue'}`,
    rentFooter: 'Automatic overdue rent notification · properwise.gr',
    rentEyebrow: 'Overdue rent',
    notice: (label: string, n: number) => `${label} (notice no. ${n})`,
    rentTotal: 'Total overdue: ',
    rentCta: 'See overdue rent',
    label: (n: number) => n >= 3 ? 'Final notice' : n === 2 ? 'Second reminder' : 'Reminder',
  },
}

/** Η κλιμάκωση της όχλησης στη γλώσσα του παραλήπτη: 1 υπενθύμιση, 2 δεύτερη, 3+ τελική. */
export const noticeLabelOf = (noticeNumber: number, lang: Lang = 'el'): string => T[lang].label(noticeNumber)

/**
 * Ο τίτλος της γραμμής. Τον γράφει ο χρήστης και μένει όπως τον έγραψε, εκτός
 * από τις φορολογικές προθεσμίες, που τις γράφει το ημερολόγιο στα ελληνικά:
 * στα αγγλικά ο τίτλος βγαίνει από το είδος τους.
 */
const titleOf = (e: CalendarEventsRow, lang: Lang): string =>
  (lang === 'en' ? taxEventTitleEn(e.source, e.title) : null) ?? e.title

export function buildEmail(events: CalendarEventsRow[], reminderType: string, pay: ReadonlyMap<string, string> = new Map(), lang: Lang = 'el') {
  const t = T[lang]
  const isUrgent = reminderType === 'today' || reminderType === 'overdue'
  const totalAmount = events.reduce((s, e) => s + (e.amount || 0), 0)

  const eventRows = events.map(e => {
    const label = t.cat[e.category] || e.category
    const dateStr = e.event_date ? grDate(e.event_date) : ''
    return `
      <tr>
        <td class="rule-b" style="padding:12px 0;border-bottom:1px solid ${C.rule};">
          <span class="ink" style="display:block;font-size:14px;color:${C.ink};font-weight:500;">${esc(titleOf(e, lang))}</span>
          <span class="fa" style="display:block;font-size:12px;color:${C.mute};">${esc(label)} · ${dateStr}</span>
        </td>
        <td class="rule-b" style="padding:12px 0;border-bottom:1px solid ${C.rule};text-align:right;vertical-align:middle;">
          ${e.amount ? `<span class="ink" style="font-family:monospace;font-size:14px;color:${C.ink};font-weight:600;">${eur(e.amount)}</span>` : `<span class="fa" style="color:${C.mute};font-size:12px;">${t.noAmount}</span>`}
          ${pay.has(e.id) ? `<a href="${esc(pay.get(e.id))}" class="ac" style="display:block;margin-top:6px;font-size:13px;color:${C.accent};font-weight:700;text-decoration:none;">${t.paid}</a>` : ''}
        </td>
      </tr>`
  }).join('')

  const n = events.length
  const when = t.when[reminderType] || ''
  const first = events[0] ? titleOf(events[0], lang) : ''
  const subject = reminderType === 'overdue'
    ? t.overdueSubject(n, first)
    : reminderType === 'today'
      ? t.todaySubject(n, first)
      : t.due(n, when)
  const headline = reminderType === 'overdue'
    ? t.overdueHead(n)
    : t.due(n, when)

  const html = emailShell({
    preheader: `${headline}.`,
    footerNote: t.footer,
    ...(lang === 'en' ? { lang } : {}),
    bodyHtml: callout(
      eyebrow(reminderType === 'overdue' ? t.eyebrow.overdue : reminderType === 'today' ? t.eyebrow.today : t.eyebrow.other, isUrgent ? 'negative' : undefined)
      + `<p class="ink" style="margin:0;font-size:15px;color:${C.ink};font-weight:600;mso-line-height-rule:exactly;line-height:22px;">${headline}</p>`
      + (totalAmount > 0 ? `<p class="ac" style="margin:6px 0 0;font-size:13px;color:${C.accent};font-weight:700;mso-line-height-rule:exactly;line-height:19px;">${t.total}${eur(totalAmount)}</p>` : ''),
      isUrgent ? 'alert' : 'accent')
      + dataTable(eventRows)
      + button(t.cta, `${APP_URL}/dashboard?tab=calendar`),
  })

  return { subject, html }
}

// Dunning email προς τον ιδιοκτήτη για ληξιπρόθεσμες δόσεις ενοικίου.
// Ίδιο στυλ με buildEmail (header, κάρτα, accent του brand, CTA) αλλά πάντα
// «urgent» (αρνητικός τόνος) και ΧΩΡΙΣ emoji — καθαρό, επαγγελματικό κείμενο.
export function buildDunningEmail(rows: RentPaymentsRow[], tenantMap: Record<string, TenantName>, propMap: Record<string, PropertyName>, today: Date, noticeLabel: string, noticeNumber: number, lang: Lang = 'el') {
  const t = T[lang]
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)

  const rowsHtml = rows.map(r => {
    const tenant = r.tenant_id != null ? (tenantMap[r.tenant_id]?.full_name || null) : null
    const prop   = r.property_id != null ? (propMap[r.property_id]?.name || null) : null
    const primary = tenant || prop || t.noName
    // ΚΑΜΙΑ ΠΑΥΛΑ ΣΕ ΘΕΣΗ ΤΙΜΗΣ. Εγραφε «Περίοδος —» και «Λήξη —», δηλαδή δύο
    // ετικέτες που δεν συνοδεύονται από τίποτα. Η απουσία λέγεται με απουσία:
    // το κομμάτι απλώς δεν μπαίνει στη γραμμή.
    const period = (r.period_month != null && r.period_year != null)
      ? `${String(r.period_month).padStart(2, '0')}/${r.period_year}` : null
    const dueStr = r.due_date ? grDate(r.due_date) : null
    const daysOverdue = r.due_date ? Math.floor((today.getTime() - new Date(r.due_date).getTime()) / 86400000) : 0
    const secondary = [tenant && prop ? prop : null, period && t.period(period), dueStr && t.dueOn(dueStr)].filter(Boolean).join(' · ')
    return `
      <tr>
        <td class="rule-b" style="padding:12px 0;border-bottom:1px solid ${C.rule};">
          <span class="ink" style="display:block;font-size:14px;color:${C.ink};font-weight:500;">${esc(primary)}</span>
          <span class="fa" style="display:block;font-size:12px;color:${C.mute};">${esc(secondary)}</span>
        </td>
        <td class="rule-b" style="padding:12px 0;border-bottom:1px solid ${C.rule};text-align:right;vertical-align:middle;">
          <span class="ink" style="font-family:monospace;font-size:14px;color:${C.ink};font-weight:600;">${eur(r.amount || 0)}</span>
          <span class="neg" style="display:block;font-size:11px;color:${C.negative};font-family:monospace;font-weight:700;">${t.late(daysOverdue)}</span>
        </td>
      </tr>`
  }).join('')

  const n = rows.length
  const subject = t.rentSubject(noticeLabel, n)

  const html = emailShell({
    preheader: `${t.rentHead(n)}.`,
    footerNote: t.rentFooter,
    ...(lang === 'en' ? { lang } : {}),
    bodyHtml: callout(
      eyebrow(t.rentEyebrow, 'negative')
      + `<p class="ink" style="margin:0;font-size:15px;color:${C.ink};font-weight:600;mso-line-height-rule:exactly;line-height:22px;">${t.rentHead(n)}</p>`
      + `<p class="fa" style="margin:6px 0 0;font-size:12px;color:${C.mute};font-weight:600;mso-line-height-rule:exactly;line-height:18px;">${t.notice(noticeLabel, noticeNumber)}</p>`
      + (total > 0 ? `<p class="neg" style="margin:6px 0 0;font-size:13px;color:${C.negative};font-weight:700;mso-line-height-rule:exactly;line-height:19px;">${t.rentTotal}${eur(total)}</p>` : ''),
      'alert')
      + dataTable(rowsHtml)
      + button(t.rentCta, `${APP_URL}/dashboard?tab=tenant`),
  })

  return { subject, html }
}
