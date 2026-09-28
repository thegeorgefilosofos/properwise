'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΕΞΑΓΩΓΕΣ ΤΩΝ ΕΠΑΦΩΝ: ΚΑΡΤΑ ΓΙΑ ΕΚΤΥΠΩΣΗ, EXCEL, PDF
// ═══════════════════════════════════════════════════════════════════════════
import { downloadWorkbook } from '../sheets'
import { ABSENT, ABSENT_SHORT } from '@/components/Theme'
import type { ReportBranding } from '@/lib/reportBranding'
import {
  reportHead, reportHeader, reportSection, reportKpi, reportDisclaimer, openReport, rEsc,
} from '../reportPdf'
import { athensToday } from '@/lib/core/time'
import { INK, INK_FAINT, INK_MUTED, PAPER_ALT, RULE } from '@/lib/print/ink'
import { type Contact, GROUPS, roleMeta } from './model'

// ─── ΚΑΡΤΑ ΕΠΑΦΗΣ ΓΙΑ ΕΚΤΥΠΩΣΗ ───────────────────────────────────────────────
//
// ΗΤΑΝ ΤΟ ΕΝΑΤΟ ΧΕΙΡΟΓΡΑΦΟ ΕΓΓΡΑΦΟ και τα μισά του χρώματα δεν έκαναν τίποτα:
//
//   • `.cat{color:${meta.groupColor}}` — το groupColor είναι `var(--accent)`,
//     δηλαδή μεταβλητή CSS που ΔΕΝ ΥΠΑΡΧΕΙ σε αυτόνομο παράθυρο εκτύπωσης. Η
//     γραμμή κατηγορίας έβγαινε άχρωμη. (Το `#888` ήταν μόνο η εφεδρεία για
//     άγνωστο ρόλο — δηλαδή το μοναδικό χρώμα που δούλευε ήταν το λάθος.)
//   • `.status` — κλάση ορισμένη και ΠΟΥΘΕΝΑ χρησιμοποιημένη.
//   • `#333` για το κείμενο των γραμμών, δίπλα στο `INK` (#111): δύο «κύρια
//     μελάνια» στο ίδιο χαρτί. Και `#bbb` για το υποσέλιδο, δίπλα στο INK_FAINT.
//   • Τρία έγχρωμα σήματα (WhatsApp πράσινο, Viber μωβ, IRIS κεχριμπαρένιο) —
//     σημασιολογικό χρώμα σε τυπωμένο χαρτί, που ούτως ή άλλως βγαίνει γκρι.
//     Η πληροφορία λέγεται με τις ίδιες τρεις λέξεις, χωρίς χρώμα.
//
// Τυπογραφία και επικεφαλίδα έρχονται πλέον από το `reportPdf.ts`, όπως στα
// άλλα οκτώ έγγραφα. Δικό της μένει μόνο το πλάτος — μια κάρτα επαφής είναι
// στενή εξ ορισμού — και η διάταξη «ετικέτα δίπλα σε τιμή».
const CONTACT_CARD_CSS = `
  .page{max-width:460px}
  .crow{display:flex;gap:8px;align-items:flex-start;margin:6px 0;font-size:13px;color:${INK}}
  .clabel{min-width:88px;color:${INK_FAINT};font-size:11px;text-transform:uppercase;padding-top:1px;flex-shrink:0}
  .ctag{display:inline-block;padding:2px 9px;border-radius:20px;background:${PAPER_ALT};border:1px solid ${RULE};font-size:11px;color:${INK_MUTED};margin-right:4px}
  .cbadge{font-size: 11px;font-weight:700;color:${INK_MUTED};margin-left:6px;letter-spacing:.04em}
`

export function printContactCard(contact: Contact, branding?: ReportBranding | null) {
  const meta = roleMeta(contact.role)
  const extra = contact._extra || {}
  const row = (label: string, value: string, mono = false) =>
    `<div class="crow"><span class="clabel">${rEsc(label)}</span><span${mono ? ' style="font-family:\'Roboto Mono\',monospace"' : ''}>${value}</span></div>`
  const badge = (text: string) => `<span class="cbadge">${rEsc(text)}</span>`

  const html = reportHead(`Επαφή · ${contact.full_name}`, CONTACT_CARD_CSS)
    + `<body><div class="page">`
    + reportHeader(branding, meta.groupLabel || 'Επαφή')
    + `
    <h1>${rEsc(contact.full_name)}</h1>
    <div class="sub">${rEsc(meta.label)}</div>

    ${reportSection('Στοιχεία επικοινωνίας')}
    ${contact.phone ? row('Τηλέφωνο', rEsc(contact.phone) + (extra.whatsapp ? badge('WhatsApp') : '') + (extra.viber ? badge('Viber') : '')) : ''}
    ${extra.phone2 ? row('Δεύτερο τηλέφωνο', rEsc(extra.phone2)) : ''}
    ${contact.email ? row('Ηλεκτρονικό ταχυδρομείο', rEsc(contact.email)) : ''}
    ${extra.website ? row('Ιστοσελίδα', rEsc(extra.website)) : ''}
    ${extra.office_address ? row('Διεύθυνση', rEsc(extra.office_address)) : ''}
    ${extra.afm ? row('ΑΦΜ', rEsc(extra.afm), true) : ''}
    ${extra.iban ? row('IBAN', rEsc(extra.iban) + (extra.iris ? badge('IRIS') : ''), true) : ''}
    ${(extra.tags || []).length > 0 ? `<div style="margin-top:14px">${(extra.tags || []).map(t => `<span class="ctag">${rEsc(t)}</span>`).join('')}</div>` : ''}
    ${contact._freeNotes ? reportSection('Σημειώσεις') + `<div class="note">${rEsc(contact._freeNotes)}</div>` : ''}

    ${reportDisclaimer('Κάρτα επαφής από το μητρώο συνεργατών του ακινήτου.', branding)}
    </div></body></html>`
  openReport(html)
}

// ─── Excel Export (SheetJS, ίδιο μοτίβο με τα υπόλοιπα φύλλα) ───────────────
export async function exportContactsExcel(contacts: Contact[]) {
  const XLSX = (await import('xlsx-js-style')).default
  const today = new Date().toLocaleDateString('el-GR')
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Σύνοψη ──────────────────────────────────────────────────────
  const byGroup: Record<string, number> = {}
  contacts.forEach(c => {
    const g = roleMeta(c.role).groupId
    byGroup[g] = (byGroup[g] || 0) + 1
  })
  const preferred = contacts.filter(c => c._extra?.preferred).length
  const withWhatsApp = contacts.filter(c => c._extra?.whatsapp).length
  const withViber = contacts.filter(c => c._extra?.viber).length
  const withIBAN = contacts.filter(c => c._extra?.iban).length
  const withIRIS = contacts.filter(c => c._extra?.iris).length
  const withAfm = contacts.filter(c => c._extra?.afm).length

  const summaryData: (string | number)[][] = [
    ['PROPERWISE, Κατάσταση Επαφών', ''],
    ['Ημερομηνία εξαγωγής:', today],
    ['Σύνολο εγγραφών:', contacts.length],
    [''],
    ['ΓΕΝΙΚΗ ΣΤΑΤΙΣΤΙΚΗ', ''],
    ['Σύνολο Επαφών', contacts.length],
    ['Προτιμώμενες Επαφές', preferred],
    ['Με WhatsApp', withWhatsApp],
    ['Με Viber', withViber],
    ['Με IBAN', withIBAN],
    ['Με IRIS', withIRIS],
    ['Με ΑΦΜ (ταιριάζουν με παραστατικά)', withAfm],
    [''],
    ['ΚΑΤΑΝΟΜΗ ΑΝΑ ΚΑΤΗΓΟΡΙΑ', '', ''],
    ['Κατηγορία', 'Αριθμός Επαφών', 'Ποσοστό %'],
    ...GROUPS.filter(g => byGroup[g.id]).map(g => [
      g.label,
      byGroup[g.id] || 0,
      Math.round(((byGroup[g.id] || 0) / contacts.length) * 1000) / 10,
    ]),
    ['ΣΥΝΟΛΟ', contacts.length, 100],
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData)
  ws1['!cols'] = [{ wch: 36 }, { wch: 18 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Σύνοψη')

  // ── Sheet 2: Αναλυτικές Επαφές ─────────────────────────────────────────
  const headers = [
    'Ονοματεπώνυμο', 'Κατηγορία', 'Ρόλος',
    'Κύριο Τηλέφωνο', 'WhatsApp', 'Viber', 'Κινητό', 'Ηλεκτρονικό ταχυδρομείο',
    'Ιστοσελίδα', 'Διεύθυνση Γραφείου',
    'ΑΦΜ', 'IBAN', 'IRIS',
    'Επόμενο Ραντεβού',
    'Ετικέτες', 'Αρχεία', 'Ελεύθερες Σημειώσεις', 'Σημειώσεις (log)',
  ]
  const detailRows: (string | number)[][] = [headers]

  GROUPS.forEach(g => {
    const grpContacts = contacts.filter(c => roleMeta(c.role).groupId === g.id)
    if (grpContacts.length === 0) return
    detailRows.push([g.label, `${grpContacts.length} επαφές`, ...Array(headers.length - 2).fill('')])
    grpContacts.sort((a, b) => a.full_name.localeCompare(b.full_name, 'el')).forEach(c => {
      const ex = c._extra || {}
      detailRows.push([
        c.full_name,
        roleMeta(c.role).groupLabel,
        roleMeta(c.role).label,
        c.phone || '',
        ex.whatsapp ? 'ΝΑΙ' : 'ΟΧΙ',
        ex.viber ? 'ΝΑΙ' : 'ΟΧΙ',
        ex.phone2 || '',
        c.email || '',
        ex.website || '',
        ex.office_address || '',
        ex.afm || '',
        ex.iban || '',
        ex.iris ? 'ΝΑΙ' : 'ΟΧΙ',
        ex.next_appointment ? new Date(ex.next_appointment + 'T00:00:00').toLocaleDateString('el-GR') : '',
        (ex.tags || []).join('; '),
        (ex.files || []).length,
        c._freeNotes || '',
        (ex.notes_log || []).map((n: {ts: string; text: string}) => `[${new Date(n.ts).toLocaleDateString('el-GR')}] ${n.text}`).join(' | '),
      ])
    })
    detailRows.push(Array(headers.length).fill(''))
  })

  const ws2 = XLSX.utils.aoa_to_sheet(detailRows)
  ws2['!cols'] = [
    { wch: 26 }, { wch: 22 }, { wch: 22 },
    { wch: 14 }, { wch: 9 }, { wch: 9 }, { wch: 14 }, { wch: 26 },
    { wch: 22 }, { wch: 22 },
    { wch: 12 }, { wch: 28 }, { wch: 9 },
    { wch: 16 },
    { wch: 26 }, { wch: 8 }, { wch: 32 }, { wch: 48 },
  ]
  XLSX.utils.book_append_sheet(wb, ws2, 'Αναλυτικές Επαφές')

  // ── Sheet 3: Κατάλογος Επαφών (ταχεία αναφορά) ─────────────────────────
  const dirHeaders = ['Ονοματεπώνυμο', 'Ρόλος', 'Τηλέφωνο', 'Ηλεκτρονικό ταχυδρομείο', 'ΑΦΜ', 'WhatsApp', 'IRIS']
  const dirRows: (string | number)[][] = [dirHeaders]
  contacts
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'el'))
    .forEach(c => {
      const ex = c._extra || {}
      dirRows.push([
        c.full_name,
        roleMeta(c.role).label,
        c.phone || ABSENT,
        c.email || ABSENT,
        ex.afm || ABSENT,
        ex.whatsapp ? 'WA' : '',
        ex.iris ? 'IRIS' : '',
      ])
    })
  const ws3 = XLSX.utils.aoa_to_sheet(dirRows)
  ws3['!cols'] = [{ wch: 26 }, { wch: 24 }, { wch: 16 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 6 }]
  XLSX.utils.book_append_sheet(wb, ws3, 'Κατάλογος')

  downloadWorkbook(wb, `Επαφές ${athensToday()}`)
}

// ─── PDF Export ───────────────────────────────────────────────────────────────
export function exportContactsPDF(contacts: Contact[], branding?: ReportBranding | null) {
  const preferred = contacts.filter(c => c._extra?.preferred)
  const byGroup: Record<string, Contact[]> = {}
  contacts.forEach(c => {
    const g = roleMeta(c.role).groupId
    if (!byGroup[g]) byGroup[g] = []
    byGroup[g].push(c)
  })

  // Διακριτικοί, ΑΣΠΡΟΜΑΥΡΟΙ δείκτες (WA/VB/IRIS): κείμενο, χωρίς χρώμα.
  const mark = (on: boolean | undefined, text: string) =>
    on ? ` <span class="muted" style="font-size: 11px;font-weight:600">${rEsc(text)}</span>` : ''

  const kpis = `<div class="kpis" style="grid-template-columns:repeat(3,1fr)">`
    + reportKpi('Σύνολο επαφών', String(contacts.length))
    + reportKpi('Προτιμώμενες', String(preferred.length))
    + reportKpi('WhatsApp', String(contacts.filter(c => c._extra?.whatsapp).length))
    + reportKpi('Viber', String(contacts.filter(c => c._extra?.viber).length))
    + reportKpi('Με IBAN', String(contacts.filter(c => c._extra?.iban).length))
    + reportKpi('Με ΑΦΜ', String(contacts.filter(c => c._extra?.afm).length))
    + `</div>`

  const preferredSection = preferred.length
    ? reportSection('Προτιμώμενες επαφές')
      + `<table><thead><tr><th>Ονοματεπώνυμο</th><th>Τηλέφωνο</th><th>Ηλεκτρονικό ταχυδρομείο</th></tr></thead><tbody>`
      + preferred.map(c => {
          const role = roleMeta(c.role).label
          return `<tr>`
            + `<td><div style="font-weight:600;color:${INK}">${rEsc(c.full_name)}</div>`
            +   `<div class="muted" style="font-size: 11px">${rEsc(role)}</div></td>`
            + `<td class="tnum">${c.phone ? rEsc(c.phone) : ABSENT_SHORT}</td>`
            + `<td>${rEsc(c.email || ABSENT)}</td>`
            + `</tr>`
        }).join('')
      + `</tbody></table>`
    : ''

  const groupSections = GROUPS.filter(g => byGroup[g.id]?.length).map(g => {
    const rows = byGroup[g.id].map(c => {
      const ex = c._extra || {}
      const role = roleMeta(c.role).label
      const iban = ex.iban ? `···${rEsc(ex.iban.slice(-4))}${mark(ex.iris, 'IRIS')}` : ABSENT_SHORT
      return `<tr>`
        + `<td><div style="font-weight:600;color:${INK}">${rEsc(c.full_name)}</div>`
        +   `<div class="muted" style="font-size: 11px">${rEsc(role)}</div></td>`
        + `<td class="tnum">${c.phone ? rEsc(c.phone) : ABSENT_SHORT}${mark(ex.whatsapp, 'WA')}${mark(ex.viber, 'VB')}</td>`
        + `<td>${rEsc(c.email || ABSENT)}</td>`
        + `<td class="tnum">${ex.afm ? rEsc(ex.afm) : ABSENT_SHORT}</td>`
        + `<td class="tnum">${iban}</td>`
        + `</tr>`
    }).join('')
    return reportSection(`${g.label} · ${byGroup[g.id].length} επαφές`)
      + `<table><thead><tr>`
      +   `<th>Ονοματεπώνυμο</th><th>Τηλέφωνο</th><th>Ηλεκτρονικό ταχυδρομείο</th>`
      +   `<th>ΑΦΜ</th><th>IBAN</th>`
      + `</tr></thead><tbody>${rows}</tbody></table>`
  }).join('')

  const title = 'Κατάσταση Επαφών'
  const html = reportHead(title)
    + `<body><div class="page">`
    + reportHeader(branding, 'Κατάλογος επαφών', { rightNote: `${contacts.length} επαφές` })
    + `<h1>${rEsc(title)}</h1>`
    + `<div class="sub">Κατάλογος συνεργατών, παρόχων και υπηρεσιών ακινήτου</div>`
    + reportSection('Σύνοψη')
    + kpis
    + preferredSection
    + groupSections
    + reportDisclaimer('Ο κατάλογος περιλαμβάνει τις καταχωρημένες επαφές του ακινήτου. Τα στοιχεία επικοινωνίας παρέχονται για ενημερωτική και οργανωτική χρήση.', branding)
    + `</div></body></html>`

  openReport(html)
}
