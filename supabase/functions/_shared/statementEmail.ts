// ═══════════════════════════════════════════════════════════════════════════
// Η ΜΗΝΙΑΙΑ ΚΑΤΑΣΤΑΣΗ ΕΙΣΠΡΑΞΕΩΝ (send-monthly-statements), ΣΕ ΔΥΟ ΓΛΩΣΣΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Ζούσε μέσα στο index.ts της συνάρτησης· εδώ είναι καθαρή συνάρτηση που ο
// έλεγχος αποδίδει. Τα ελληνικά μένουν ίδια ως το byte (messageLang.test.ts).
// Στα αγγλικά το υποσέλιδο λέει και ότι οι επίσημες καταστάσεις για την ΑΑΔΕ
// και τον λογιστή βγαίνουν στα ελληνικά.
// ═══════════════════════════════════════════════════════════════════════════
import { emailShell, eyebrow, grUp, h, p, button, dataTable, type Lang } from './emailTemplates.ts'
import { EMAIL_LIGHT as C, EMAIL_TONE, type EmailTone } from './emailPalette.ts'
import { APP_URL } from './site.ts'
import { eur } from './format.ts'

const MONTHS_EL = ['Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου']
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** «Οκτωβρίου 2026» / «October 2026». Ο μήνας είναι 1-12. */
export const periodLabelOf = (year: number, month: number, lang: Lang = 'el'): string =>
  `${(lang === 'en' ? MONTHS_EN : MONTHS_EL)[month - 1]} ${year}`

export interface StatementRow { primary: string; secondary: string; expected: number; paid: number }

const T = {
  el: {
    status: { none: 'Χωρίς μίσθωμα', full: 'Πλήρης', part: 'Μερική', late: 'Ληξιπρόθεσμο' },
    head: ['Ακίνητο / Ενοικιαστής', 'Εισπρ. / Αναμ.', 'Κατάσταση'],
    total: 'Σύνολο',
    pre: (c: string, e: string, per: string) => `Εισπράχθηκαν ${c} από ${e} τον ${per}.`,
    footer: 'Ενημερωτική κατάσταση με βάση τα δεδομένα σου. Δεν αποτελεί επίσημο λογιστικό ή φορολογικό έγγραφο. · properwise.gr',
    eyebrow: 'Μηνιαία κατάσταση',
    title: (per: string) => `Εισπράξεις ${per}`,
    line: (c: string, e: string) => `Εισπράχθηκαν ${c} από ${e}`,
    out: (o: string) => ` · ανείσπρακτα ${o}`,
    cta: 'Άνοιγμα στο PROPERWISE',
    subject: (per: string) => `PROPERWISE · Μηνιαία κατάσταση ${per}`,
    rent: 'Ενοίκιο', lease: 'Μίσθωμα',
  },
  en: {
    status: { none: 'No rent', full: 'Paid', part: 'Partial', late: 'Overdue' },
    head: ['Property / Tenant', 'Collected / Due', 'Status'],
    total: 'Total',
    pre: (c: string, e: string, per: string) => `${c} collected of ${e} in ${per}.`,
    footer: 'An information statement based on your data. It is not an official accounting or tax document; official statements for AADE (the Greek tax authority) and your accountant are issued in Greek in the app. · properwise.gr',
    eyebrow: 'Monthly statement',
    title: (per: string) => `Collections for ${per}`,
    line: (c: string, e: string) => `${c} collected of ${e}`,
    out: (o: string) => ` · outstanding ${o}`,
    cta: 'Open in PROPERWISE',
    subject: (per: string) => `PROPERWISE · Monthly statement for ${per}`,
    rent: 'Rent', lease: 'Rent',
  },
}

/** Το θέμα του μηνύματος. */
export const statementSubject = (periodLabel: string, lang: Lang = 'el'): string => T[lang].subject(periodLabel)

/** Η λέξη για γραμμή χωρίς ακίνητο και ενοικιαστή («Ενοίκιο») και για τη δεύτερη γραμμή («Μίσθωμα»). */
export const statementWords = (lang: Lang = 'el') => ({ rent: T[lang].rent, lease: T[lang].lease })

export function statementHtml(ownerRows: StatementRow[], expected: number, collected: number, periodLabel: string, lang: Lang = 'el'): string {
  const t = T[lang]
  const outstanding = Math.max(0, expected - collected)
  const rows = ownerRows.map(r => {
    // ΚΑΜΙΑ ΠΑΥΛΑ ΣΕ ΘΕΣΗ ΤΙΜΗΣ. Οταν δεν αναμένεται μίσθωμα, η κατάσταση δεν
    // είναι άγνωστη: είναι «δεν οφείλεται τίποτα». Η παύλα το έκρυβε πίσω από
    // ένα σημάδι που ο αναγνώστης οθόνης διαβάζει ως «παύλα».
    // Η κατάσταση αφορά τον ΠΡΟΗΓΟΥΜΕΝΟ μήνα και φεύγει την 1η του επόμενου:
    // ό,τι δεν πληρώθηκε έχει ήδη λήξει. Ελεγε «Εκκρεμεί» (λέξη για κάτι που
    // δεν έχει λήξει ακόμη) και το έβαφε κόκκινο· τώρα λέξη και τόνος συμφωνούν.
    // ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΗΣ ΕΦΑΡΜΟΓΗΣ (lib/core/status.ts): πληρωμένο θετικό, μερικό
    // προσοχή, ληξιπρόθεσμο αρνητικό, χωρίς οφειλή ουδέτερο. Ηταν τέσσερα
    // χρώματα του Google και τα δύο έκοβαν το 4,5:1 (#b8860b 3,25 · #80868b 3,68).
    const status = r.expected === 0 ? t.status.none : r.paid >= r.expected ? t.status.full : r.paid > 0 ? t.status.part : t.status.late
    const tone: EmailTone = r.expected === 0 ? 'neutral' : r.paid >= r.expected ? 'positive' : r.paid > 0 ? 'warning' : 'negative'
    const tn = EMAIL_TONE[tone]
    return `<tr>
      <td class="rule-b" style="padding:11px 0;border-bottom:1px solid ${C.rule};">
        <span class="ink" style="display:block;font-size:13px;color:${C.ink};font-weight:500;">${r.primary}</span>
        <span class="fa" style="display:block;font-size:12px;color:${C.mute};">${r.secondary}</span>
      </td>
      <td class="rule-b tx" style="padding:11px 0;border-bottom:1px solid ${C.rule};text-align:right;font-size:13px;color:${C.text};">${eur(r.paid)} / ${eur(r.expected)}</td>
      <td class="rule-b" style="padding:11px 0;border-bottom:1px solid ${C.rule};text-align:right;font-size:12px;font-weight:700;color:${tn.color};"><span class="${tn.cls}">${status}</span></td>
    </tr>`
  }).join('')
  // ΤΟ ΔΑΠΕΔΟ ΤΩΝ 11px ΙΣΧΥΕΙ ΚΑΙ ΕΔΩ ΚΑΙ ΤΑ ΚΕΦΑΛΑΙΑ ΔΕΝ ΚΡΑΤΟΥΝ ΤΟΝΟ. Ηταν
  // 10 εικονοστοιχεία, το μικρότερο κείμενο ολόκληρου του προϊόντος, σε email
  // που ανοίγει σχεδόν πάντα σε τηλέφωνο. Και το «uppercase» πάνω σε ωμό
  // ελληνικό έγραφε «ΑΚΊΝΗΤΟ» και «ΚΑΤΆΣΤΑΣΗ».
  const head = `<tr>${t.head.map((x, i) =>
    `<td class="fa rule-b" style="padding:0 0 7px;${i ? 'text-align:right;' : ''}font-size:11px;color:${C.mute};letter-spacing:.06em;font-weight:700;border-bottom:1px solid ${C.rule};">${grUp(x)}</td>`).join('')}</tr>`
  const total = `<tr><td class="ink" style="padding:13px 0 0;font-size:14px;font-weight:700;color:${C.ink};">${t.total}</td><td class="ink" style="padding:13px 0 0;text-align:right;font-size:14px;font-weight:700;color:${C.ink};">${eur(collected)} / ${eur(expected)}</td><td></td></tr>`
  return emailShell({
    preheader: t.pre(eur(collected), eur(expected), periodLabel),
    footerNote: t.footer,
    ...(lang === 'en' ? { lang } : {}),
    bodyHtml: eyebrow(t.eyebrow)
      + h(t.title(periodLabel))
      + p(`${t.line(`<b class="ink" style="color:${C.ink};">${eur(collected)}</b>`, eur(expected))}${outstanding > 0 ? t.out(`<b class="neg" style="color:${C.negative};">${eur(outstanding)}</b>`) : ''}.`)
      + dataTable(head + rows + total)
      + button(t.cta, `${APP_URL}/dashboard`),
  })
}
