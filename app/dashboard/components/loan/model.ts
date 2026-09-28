'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΜΟΝΤΕΛΟ ΤΗΣ ΚΑΡΤΕΛΑΣ ΔΑΝΕΙΟΥ: ΤΟΝΟΙ, ΕΠΙΤΟΚΙΑ, ΣΤΟΙΧΕΙΑ ΠΡΟΓΡΑΜΜΑΤΩΝ
// ═══════════════════════════════════════════════════════════════════════════
import { fp } from '@/lib/core/format'
import type { LoanCalcState } from '../TabLoanCalculator'
import { type ComparisonProgram, fmtEur } from '../TabLoanData'
import { grDate } from '@/lib/core/format'

// Οι τόνοι της κατανομής ανά δάνειο: σκαλιά αρκετά μακριά ώστε δύο γειτονικά
// κομμάτια να ξεχωρίζουν και στα δύο θέματα. Το τέταρτο και πέρα κρατά το
// τελευταίο σκαλί· τέσσερα δάνεια στο ίδιο ακίνητο δεν είναι το συνηθισμένο.
const SHARE_STEPS = [100, 55, 30, 18] as const
export const shareTone = (i: number): string =>
  `color-mix(in srgb, var(--accent) ${SHARE_STEPS[Math.min(i, SHARE_STEPS.length - 1)]}%, var(--bg-elevated))`

// Μορφοποίηση επιτοκίων ως κείμενο: κόμμα δεκαδικό και σωστή παύλα εύρους (–),
// π.χ. «2.40-4.70» → «2,40–4,70». Καθαρά ελληνικά, χωρίς πρόχειρες παύλες.
// Πρώτος αριθμός (επιτόκιο «από») ενός εύρους ή μονής τιμής → number.
const rateNum = (v:unknown):number|null => { const m = String(v ?? '').match(/-?\d+[.,]?\d*/); return m ? parseFloat(m[0].replace(',','.')) : null }
// Κελί πίνακα/κάρτας: ενιαία μορφή, από τον ΕΝΑ μορφοποιητή της εφαρμογής.
// Εδώ ζούσε τρίτος τοπικός («n.toFixed(2).replace»), που έβγαζε το ίδιο
// αποτέλεσμα με το fp() για τιμές κάτω από χίλια και διαφορετικό από πάνω.
export const NO_RATE = 'Χωρίς στοιχεία'

// ── ΤΑ ΒΑΣΙΚΑ ΣΤΟΙΧΕΙΑ ΕΝΟΣ ΠΡΟΓΡΑΜΜΑΤΟΣ ───────────────────────────────────
// Ήταν πίνακας από `συνθήκη && [ετικέτα, τιμή, χρώμα, μέγεθος]` με `filter(Boolean)`
// και ανάγνωση με δείκτες (`item[3]`). Ο μεταγλωττιστής δεν μπορούσε να ξέρει
// ότι μετά το φιλτράρισμα δεν μένουν ψευδείς τιμές και το `item[3]` δεν έχει
// όνομα: μια μετατόπιση θέσης θα άλλαζε αθόρυβα το μέγεθος με το χρώμα.
interface ProgramFact { label: string; value: string; color: string; size: number }

export function programFacts(p: ComparisonProgram): ProgramFact[] {
  const facts: ProgramFact[] = []
  const add = (label: string, value: string, color: string, size: number) => facts.push({ label, value, color, size })
  if (p.maxAmount) add('Μέγιστο ποσό', fmtEur(p.maxAmount), 'var(--text-primary)', 16)
  if (p.maxLtv)    add('Μέγιστο δάνειο προς αξία', fp(p.maxLtv), 'var(--text-primary)', 14)
  if (p.maxSqm)    add('Μέγιστα τ.μ.', `${p.maxSqm} τ.μ.`, 'var(--text-primary)', 12)
  if (p.ageMax)    add('Ηλικία δικαιούχου', `${p.ageMin}–${p.ageMax} ετών`, 'var(--text-primary)', 12)
  if (p.duration)  add('Διάρκεια', p.duration, 'var(--text-secondary)', 12)
  if (p.deadline)  add('Προθεσμία', grDate(p.deadline), 'var(--text-primary)', 13)
  if (p.totalBudget) add('Προϋπολογισμός', p.totalBudget, 'var(--text-primary)', 13)
  return facts
}
export const cellRate = (v:unknown):string => { const n = rateNum(v); return n===null ? NO_RATE : fp(n) }

// Ο τύπος ζει εκεί που παράγεται η τιμή (TabLoanCalculator). Εδώ υπήρχε δεύτερη
// δήλωση του ίδιου σχήματος, με ένα πεδίο λιγότερο: ο υπολογιστής στέλνει και
// `propType`/`area`, που αυτή η δήλωση δεν ήξερε — και επειδή η άλλη πλευρά ήταν
// `any`, κανείς δεν το έμαθε ποτέ.
export type CalcState = LoanCalcState;
