// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΒΔΟΜΑΔΙΑΙΑ ΕΝΗΜΕΡΩΣΗ ΕΠΙΤΟΚΙΩΝ (send-market-digest), ΣΕ ΔΥΟ ΓΛΩΣΣΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Ζούσε μέσα στο index.ts της συνάρτησης· εδώ ο έλεγχος την αποδίδει. Τα
// ποσοστά γράφονται όπως στα ελληνικά («2,15%») και στις δύο γλώσσες.
// ═══════════════════════════════════════════════════════════════════════════
import { emailShell, eyebrow, h, note, dataTable, type Lang } from './emailTemplates.ts'
import { EMAIL_LIGHT as C } from './emailPalette.ts'
import { pct } from './format.ts'
import type { MarketKey } from '../../../lib/market/ecb.ts'

/** Οι δείκτες της ενημέρωσης, με τη σειρά που τυπώνονται. */
export const DIGEST_METRICS: { key: MarketKey; label: Record<Lang, string> }[] = [
  { key: 'euribor_3m', label: { el: 'Euribor 3 μηνών', en: 'Euribor 3 months' } },
  { key: 'euribor_6m', label: { el: 'Euribor 6 μηνών', en: 'Euribor 6 months' } },
  { key: 'euribor_12m', label: { el: 'Euribor 12 μηνών', en: 'Euribor 12 months' } },
  { key: 'ecb_rate', label: { el: 'Επιτόκιο ΕΚΤ', en: 'ECB rate' } },
  { key: 'bog_housing_new', label: { el: 'Επιτόκιο νέων στεγαστικών (ΤτΕ)', en: 'New mortgage rate (Bank of Greece)' } },
]

const T = {
  el: {
    none: 'Χωρίς σύγκριση', flat: 'Αμετάβλητο',
    pre: 'Τα επιτόκια της εβδομάδας.', eyebrow: 'Δεδομένα αγοράς', title: 'Εβδομαδιαία ενημέρωση επιτοκίων',
    note: 'Χρήσιμο για την αξιολόγηση δανείων και αποδόσεων στο PROPERWISE.',
    subject: 'PROPERWISE · Εβδομαδιαία ενημέρωση επιτοκίων',
  },
  en: {
    none: 'No comparison', flat: 'Unchanged',
    pre: 'This week’s interest rates.', eyebrow: 'Market data', title: 'Weekly interest rate update',
    note: 'Useful for weighing loans and yields in PROPERWISE.',
    subject: 'PROPERWISE · Weekly interest rate update',
  },
}

export const digestSubject = (lang: Lang = 'el'): string => T[lang].subject

export function digestRowHtml(label: string, cur: number | null, prev: number | null, lang: Lang = 'el'): string {
  // ΧΩΡΙΣ ΤΙΜΗ, ΧΩΡΙΣ ΓΡΑΜΜΗ. Ο τοπικός μορφοποιητής έγραφε «—» στη θέση της
  // τιμής· ο κοινός θα έγραφε «0,00%», που είναι χειρότερο — λέει ότι το
  // επιτόκιο ΕΙΝΑΙ μηδέν. Η απουσία λέγεται με απουσία, όπως και στην οθόνη.
  if (cur == null) return ''
  const t = T[lang]
  const d = prev != null ? cur - prev : null
  // ΚΑΜΙΑ ΠΑΥΛΑ ΣΕ ΘΕΣΗ ΤΙΜΗΣ ΚΑΙ ΟΙ ΔΥΟ ΣΙΩΠΕΣ ΔΕΝ ΕΙΝΑΙ Η ΙΔΙΑ. Το digest
  // φεύγει μόνο όταν κινηθεί ΤΟΥΛΑΧΙΣΤΟΝ ένα από τα πέντε μεγέθη, άρα σε κάθε
  // email που στέλνεται τα υπόλοιπα εμφανίζονταν με «—». Ενα σημάδι που σημαίνει
  // άλλοτε «δεν άλλαξε» και άλλοτε «δεν έχουμε προηγούμενη τιμή» δεν λέει τίποτα
  // από τα δύο· και ο αναγνώστης οθόνης το διαβάζει ως «παύλα».
  const arrow = d == null ? `<span class="fa" style="color:${C.mute};">${t.none}</span>`
    : Math.abs(d) < 0.001 ? `<span class="fa" style="color:${C.mute};">${t.flat}</span>`
    : d > 0 ? `<span class="neg" style="color:${C.negative};">▲ ${pct(Math.abs(d))}</span>` : `<span class="pos" style="color:${C.positive};">▼ ${pct(Math.abs(d))}</span>`
  return `<tr>
    <td class="rule-b tx" style="padding:11px 0;border-bottom:1px solid ${C.rule};font-size:13px;color:${C.text};">${label}</td>
    <td class="ink rule-b" style="padding:11px 0;border-bottom:1px solid ${C.rule};text-align:right;font-size:13px;font-weight:600;color:${C.ink};">${pct(cur)}</td>
    <td class="rule-b" style="padding:11px 0;border-bottom:1px solid ${C.rule};text-align:right;font-size:12px;">${arrow}</td>
  </tr>`
}

/** Οι γραμμές του πίνακα για όλους τους δείκτες. */
export const digestRows = (cur: Record<string, number | null>, prev: Record<string, number | null>, lang: Lang = 'el'): string =>
  DIGEST_METRICS.map(m => digestRowHtml(m.label[lang], cur[m.key], prev[m.key], lang)).join('')

export function digestLayout(inner: string, unsubUrl: string, lang: Lang = 'el'): string {
  const t = T[lang]
  return emailShell({
    unsubUrl,
    preheader: t.pre,
    ...(lang === 'en' ? { lang } : {}),
    bodyHtml: eyebrow(t.eyebrow)
      + h(t.title)
      + dataTable(inner)
      + note(t.note),
  })
}
