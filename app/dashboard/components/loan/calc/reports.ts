// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΤΡΕΙΣ ΕΞΑΓΩΓΕΣ ΤΟΥ ΤΟΚΟΧΡΕΟΛΥΣΙΟΥ: EXCEL, PDF ΕΚΤΥΠΩΣΗΣ, ΕΠΙΣΗΜΟ PDF ΜΕ QR
// ─────────────────────────────────────────────────────────────────────────
// Ζούσαν μέσα στο TabLoanCalculator.tsx ως συναρτήσεις πάνω στη μνήμη της
// καρτέλας. Τώρα παίρνουν ρητά ό,τι διαβάζουν· το σώμα τους είναι το ίδιο,
// οπότε το αρχείο, το HTML και το PDF βγαίνουν ίδια. Η καρτέλα κρατά τα
// κουμπιά και την κατάσταση «Δημιουργία…».
// ═══════════════════════════════════════════════════════════════════════════
import { downloadTableXlsx } from '../../exportCsv'
import { reportHead, reportHeader, reportSection, reportRow, reportKpi, reportDisclaimer, openReport, rEur, rPct, rEsc } from '../../reportPdf'
import { ABSENT } from '@/components/Theme'
import type { ReportBranding } from '@/lib/reportBranding'
import { generateReportPdf, pEur, pPct, type PdfReportModel, type PdfSection } from '@/lib/pdf/pdfReport'
import { issueDocument } from '@/lib/documents/issue'
import { notify, notifyOk } from '@/components/Toast'
import { rateTypeLabel, type AmortRow, type RateType } from '../../TabLoanData'

/** Ό,τι διαβάζουν οι εξαγωγές από τον υπολογιστή, με τα ονόματα του υπολογιστή. */
export interface AmortExport {
  amort: AmortRow[]; installmentDate: (i: number) => Date; bankName: string; Y: number
  LA: number; monthly: number; totalInt: number; effRate: number; rateType: RateType
  branding: ReportBranding | null
}

// ── Εξαγωγή πλήρους πίνακα τοκοχρεολυσίου σε CSV (ανοίγει σε Excel) ───────────
export function amortXlsx({ amort, installmentDate, amortFileBase, bankName, Y }: Pick<AmortExport, 'amort' | 'installmentDate' | 'bankName' | 'Y'> & { amortFileBase: () => string }) {
  if(!amort.length){notify('Δεν υπάρχουν δόσεις προς εξαγωγή',{tone:'warning'});return}
  // ΤΑ ΠΟΣΑ ΩΣ ΑΡΙΘΜΟΙ. Περνούσαν από τη `csvEur()`, που παράγει κείμενο:
  // ολόκληρος ο πίνακας χρεολυσίων έφτανε ως συμβολοσειρές και η γραμμή
  // ΣΥΝΟΛΟ έβγαζε «0,00€» κάτω από τριακόσιες εξήντα δόσεις.
  //
  // Το υπόλοιπο και οι σωρευτικοί τόκοι ΔΕΝ αθροίζονται — είναι μεγέθη
  // αποθέματος, όχι ροής. Γι' αυτό η επικεφαλίδα τους δεν ξεκινά με λέξη
  // ποσού και μένουν έξω από το σύνολο: άθροισμα υπολοίπων δεν σημαίνει τίποτα.
  downloadTableXlsx(amortFileBase(), {
    title: 'Πίνακας τοκοχρεολυσίου',
    subject: `${bankName || 'Χωρίς τράπεζα'} · ${Y} έτη`,
    headers: ['Δόση','Ημερομηνία','Έτος','Ποσό δόσης (€)','Κεφάλαιο (€)','Τόκος (€)','Υπόλοιπο κεφαλαίου (€)','Τόκοι σωρευτικά (€)'],
    rows: amort.map(r=>{
      const dt=installmentDate(r.month)
      return [
        r.month,
        dt.toLocaleDateString('el-GR',{month:'2-digit',year:'numeric'}),
        Math.ceil(r.month/12),
        r.payment, r.principal, r.interest, r.balance, r.totalInterestPaid,
      ]
    }),
  })
  notifyOk('Ο πίνακας τοκοχρεολυσίου εξήχθη')
}

// ── Εξαγωγή πίνακα τοκοχρεολυσίου σε εκτυπώσιμο PDF (κοινό ασπρόμαυρο σύστημα αναφορών) ─
export function amortPrintPdf({ amort, installmentDate, bankName, Y, LA, monthly, totalInt, effRate, rateType, branding }: AmortExport) {
  if(!amort.length){notify('Δεν υπάρχουν δόσεις προς εξαγωγή',{tone:'warning'});return}
  const docTitle=['Πίνακας τοκοχρεολυσίου',bankName].filter(Boolean).join(' · ')
  const summaryKpis=[
    reportKpi('Ποσό δανείου', rEur(LA)),
    reportKpi('Μηνιαία δόση', rEur(monthly)),
    reportKpi('Σύνολο τόκων', rEur(totalInt)),
    reportKpi('Συνολική αποπληρωμή', rEur(LA+totalInt)),
  ].join('')
  const detailRows=[
    reportRow('Τράπεζα', bankName.trim()||ABSENT),
    reportRow('Επιτόκιο', `${rPct(effRate)} · ${rateTypeLabel(rateType).toLowerCase()}`),
    reportRow('Διάρκεια', `${Y} έτη (${Y*12} δόσεις)`),
  ].join('')
  const bodyRows=amort.map(r=>{
    const dt=installmentDate(r.month).toLocaleDateString('el-GR',{month:'2-digit',year:'numeric'})
    return `<tr><td>${r.month}</td><td>${rEsc(dt)}</td><td class="n">${rEsc(rEur(r.payment))}</td><td class="n">${rEsc(rEur(r.principal))}</td><td class="np">${rEsc(rEur(r.interest))}</td><td class="n">${rEsc(rEur(r.balance))}</td><td class="np">${rEsc(rEur(r.totalInterestPaid))}</td></tr>`
  }).join('')
  const html=reportHead(docTitle)
    + `<body><div class="page">`
    + reportHeader(branding, 'Πίνακας τοκοχρεολυσίου')
    + `<h1>Πίνακας τοκοχρεολυσίου</h1>`
    + `<div class="sub">Ανάλυση αποπληρωμής ανά δόση</div>`
    + reportSection('Σύνοψη δανείου')
    + `<div class="kpis">${summaryKpis}</div>`
    + reportSection('Στοιχεία δανείου')
    + `<table><tbody>${detailRows}</tbody></table>`
    + reportSection('Πρόγραμμα αποπληρωμής')
    + `<table><thead><tr><th>Δόση</th><th>Ημερομηνία</th><th class="n">Ποσό</th><th class="n">Κεφάλαιο</th><th class="np">Τόκος</th><th class="n">Υπόλοιπο</th><th class="np">Σωρευτικοί τόκοι</th></tr></thead><tbody>${bodyRows}</tbody></table>`
    + reportDisclaimer('Ενδεικτικός υπολογισμός με σταθερή τοκοχρεολυτική δόση. Οι πραγματικοί όροι εξαρτώνται από την τράπεζα και τυχόν έξοδα, ασφάλιστρα ή μεταβολές επιτοκίου.', branding)
    + `</div></body></html>`
  openReport(html)
  notify('Άνοιξε το παράθυρο εκτύπωσης PDF',{tone:'info'})
}

// ── Επίσημο true-PDF τοκοχρεολυσίου (vector PDF με αρ. εγγράφου & QR επαλήθευσης) ─
// Καταχωρείται στο μητρώο εγγράφων ώστε να είναι επαληθεύσιμο στο /verify/<id>.
// Η μηχανή σελιδοποιεί αυτόματα τον πλήρη πίνακα δόσεων σε πολλές σελίδες.
// Το `genOfficial` και το μήνυμα αποτυχίας μένουν στην καρτέλα: εδώ μια
// αποτυχία πετά προς τα έξω, όπως πετούσε μέσα στο `try` της.
export async function amortOfficialPdf(supabase: Parameters<typeof issueDocument>[0], { amort, installmentDate, bankName, Y, LA, monthly, totalInt, effRate, rateType, branding }: AmortExport) {
  const bankLabel = bankName.trim() || ABSENT
  const termLabel = `${Y} έτη (${Y*12} δόσεις)`
  const totalRepayment = LA+totalInt
  const sections: PdfSection[] = [
    { type:'kpis', title:'Σύνοψη δανείου', items:[
      { label:'Ποσό δανείου', value:pEur(LA) },
      { label:'Μηνιαία δόση', value:pEur(monthly) },
      { label:'Σύνολο τόκων', value:pEur(totalInt) },
      { label:'Συνολική αποπληρωμή', value:pEur(totalRepayment) },
    ] },
    { type:'rows', title:'Στοιχεία δανείου', rows:[
      { label:'Τράπεζα', value:bankLabel },
      { label:'Επιτόκιο', value:`${pPct(effRate)} · ${rateTypeLabel(rateType).toLowerCase()}` },
      { label:'Διάρκεια', value:termLabel },
    ] },
    { type:'table', title:'Πίνακας τοκοχρεολυσίου',
      head:['Δόση','Ημερομηνία','Ποσό','Κεφάλαιο','Τόκος','Υπόλοιπο','Σωρευτικοί τόκοι'],
      align:['l','l','r','r','r','r','r'],
      rows: amort.map(r=>{
        const dt=installmentDate(r.month).toLocaleDateString('el-GR',{month:'2-digit',year:'numeric'})
        return [String(r.month), dt, pEur(r.payment), pEur(r.principal), pEur(r.interest), pEur(r.balance), pEur(r.totalInterestPaid)]
      }) },
  ]
  const issued = await issueDocument(supabase, {
    docType:'Πίνακας τοκοχρεολυσίου',
    subject: bankLabel||'Δάνειο', period: termLabel,
    summary:{ amount:LA, rate:effRate, totalInterest:totalInt },
  })
  const model: PdfReportModel = {
    branding, docType:'Πίνακας τοκοχρεολυσίου', title:'Πίνακας τοκοχρεολυσίου',
    subtitle:[bankLabel, termLabel].filter(Boolean).join(' · '),
    meta:{ id:issued.id, issuedAt:issued.issuedAt, verifyUrl:issued.verifyUrl, checksum:issued.checksum },
    sections,
    disclaimer:'Ενδεικτικός υπολογισμός με σταθερή τοκοχρεολυτική δόση. Οι πραγματικοί όροι εξαρτώνται από την τράπεζα και τυχόν έξοδα, ασφάλιστρα ή μεταβολές επιτοκίου.',
  }
  await generateReportPdf(model, 'Τοκοχρεολύσιο_'+(bankLabel||'δάνειο'))
}
