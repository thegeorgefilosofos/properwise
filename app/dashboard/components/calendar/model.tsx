// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΜΟΝΤΕΛΟ ΤΟΥ ΗΜΕΡΟΛΟΓΙΟΥ: ΤΥΠΟΙ, ΚΑΤΑΛΟΓΟΙ, ΗΜΕΡΟΜΗΝΙΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Τι είναι ένα γεγονός, οι κατηγορίες, οι προτεραιότητες και οι καταστάσεις
// του, η κενή φόρμα και οι μικροί υπολογισμοί ημερομηνίας. Τα διαβάζουν όλα
// τα κομμάτια του ημερολογίου· κανένα δεν ξέρει από βάση.
// ═══════════════════════════════════════════════════════════════════════════
import { athensToday, daysUntil as athensDaysUntil } from '@/lib/core/time'
// Ο πίνακας των γεγονότων έχει ένα σπίτι: lib/data/calendar.
import * as calendar from '@/lib/data/calendar'
import { FileText, User, Bell, Receipt, Euro, Wrench, Landmark } from 'lucide-react'
import { taxKindMeta } from '@/lib/tax/greekTaxCalendar'
import { MONTHS_SHORT, DAY_NAMES_SHORT } from '@/lib/core/months'
import { STATUS_LABEL, statusColor, type StatusKind } from '@/lib/core/status'

// Οι τρεις απαριθμήσεις του γεγονότος ζουν στο στρώμα δεδομένων, όχι εδώ: τις
// γράφουν και άλλες οθόνες και μία λάθος συμβολοσειρά είναι αόρατη μέχρι να
// φτάσει στη βάση.
export type EventCategory = calendar.EventCategory
export type EventPriority = calendar.EventPriority
export type EventStatus   = calendar.EventStatus
// Μήνας + Ατζέντα. Οι προβολές Έτους/Εβδομάδας/Ημέρας έφυγαν: ο ιδιοκτήτης έχει μια
// ντουζίνα προθεσμίες τον χρόνο, όχι ραντεβού του λεπτού — και τα ίδια νούμερα
// επαναλαμβάνονταν με τρεις διαφορετικές εμβέλειες σε τρεις προβολές.
export type ViewMode      = 'month' | 'agenda'

export interface CalEvent {
  id: string; property_id: string; user_id: string; title: string
  category: EventCategory; event_date: string; event_time?: string | null; duration_minutes?: number | null
  amount?: number | null
  priority: EventPriority; status: EventStatus; recurring: boolean
  recurring_interval?: string | null; notes?: string | null
  source: string; attachment_url?: string | null; color?: string | null; created_at: string
  contact_phone?: string | null; contact_email?: string | null
  recurrence_until?: string | null; recurrence_count?: number | null; recurrence_exdates?: string[] | null
  _virtual?: boolean; _seriesId?: string  // εικονική εμφάνιση επαναλαμβανόμενου (μόνο για προβολή)
}

export interface FormState {
  title: string; category: EventCategory; event_date: string; event_time: string; duration: string; amount: string
  priority: EventPriority; status: EventStatus; recurring: boolean
  recurring_interval: string; recurrence_end_mode: 'none'|'until'|'count'; recurrence_until: string; recurrence_count: string
  notes: string; attachment_url: string; phone: string; email: string; add_expense: boolean
}

// Οι κατηγορίες είναι ΟΥΔΕΤΕΡΕΣ επίτηδες: το είδος λέγεται με εικονίδιο και λέξη,
// το χρώμα κρατιέται για την κατάσταση (lib/core/status.ts).
export const CATEGORIES: Record<EventCategory, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  tax:         { label: 'Φορολογικά',   color: 'var(--text-secondary)', bg: 'var(--bg-elevated)', border: 'var(--border-subtle)', icon: <Landmark size={11}/> },
  financial:   { label: 'Οικονομικά',   color: 'var(--text-secondary)', bg: 'var(--bg-elevated)', border: 'var(--border-subtle)', icon: <Euro size={11}/> },
  // Απόδειξη και όχι κεραυνός: ο λογαριασμός νερού ή κοινοχρήστων δεν είναι ρεύμα.
  bills:       { label: 'Λογαριασμοί', color: 'var(--text-secondary)', bg: 'var(--bg-elevated)', border: 'var(--border-subtle)', icon: <Receipt size={11}/> },
  maintenance: { label: 'Συντήρηση',   color: 'var(--text-secondary)', bg: 'var(--bg-elevated)', border: 'var(--border-subtle)', icon: <Wrench size={11}/> },
  contract:    { label: 'Συμβόλαιο',   color: 'var(--text-secondary)', bg: 'var(--bg-elevated)', border: 'var(--border-subtle)', icon: <FileText size={11}/> },
  tenant:      { label: 'Ενοικιαστής', color: 'var(--text-secondary)', bg: 'var(--bg-elevated)', border: 'var(--border-subtle)', icon: <User size={11}/> },
  reminder:    { label: 'Υπενθύμιση',  color: 'var(--text-secondary)', bg: 'var(--bg-elevated)', border: 'var(--border-subtle)', icon: <Bell size={11}/> },
}

export const PRIORITIES: Record<EventPriority, { label: string; color: string }> = {
  low:      { label: 'Χαμηλή',  color: 'var(--text-secondary)' },
  medium:   { label: 'Μέτρια',  color: 'var(--text-secondary)' },
  high:     { label: 'Υψηλή',   color: 'var(--text-secondary)' },
  critical: { label: 'Κρίσιμη', color: 'var(--negative)' },
}

// ΤΟ ΛΕΞΙΛΟΓΙΟ ΑΠΟ ΤΟ lib/core/status.ts. Εδώ το «Εκκρεμεί» ήταν κίτρινο (σαν
// προειδοποίηση για κάτι που δεν έχει λήξει) και το «Ακυρώθηκε» κόκκινο, ίδιο
// με το ληξιπρόθεσμο: μια ακύρωση διαβαζόταν ως πρόβλημα.
const statusOf = (k: StatusKind) => ({ label: STATUS_LABEL[k], color: statusColor(k) })
export const STATUSES: Record<EventStatus, { label: string; color: string }> = {
  pending:     statusOf('pending'),
  paid:        statusOf('paid'),
  in_progress: statusOf('active'),
  cancelled:   statusOf('cancelled'),
}

// ── Κατηγορίες που γράφουν ΑΛΛΕΣ καρτέλες ─────────────────────────────────────
// Ο συγχρονισμός μίσθωσης, ασφάλισης και αερίου γράφει στη στήλη `category` τιμές
// που ΔΕΝ υπάρχουν στο `CATEGORIES`. Το ημερολόγιο έκανε `CATEGORIES[e.category].color`
// και έσπαγε στην πρώτη τέτοια εγγραφή· μεταφράζονται ΜΙΑ φορά, στην είσοδο.
//
// Ο πίνακας ψευδωνύμων ζει πλέον στο στρώμα δεδομένων, δίπλα στον τύπο που εξηγεί:
// τα ονόματα τα γράφουν τρεις οθόνες και τα διαβάζει αυτή.
export const canonicalCategory = calendar.canonicalCategory

// Τα σταθερά στοιχεία κάθε φορολογικής υποχρέωσης — ποιος το κάνει και πόσο σίγουρη
// είναι η ημερομηνία — ανά ΕΙΔΟΣ, ώστε να ισχύουν για γεγονός οποιουδήποτε έτους.
// Πηγή: lib/tax/greekTaxCalendar.ts. Δεν αντιγράφεται τίποτα εδώ.
export const TAX_META = taxKindMeta(new Date().getFullYear())

export const RECURRING_OPTIONS = [
  { value: 'weekly',    label: 'Κάθε εβδομάδα' },
  { value: 'monthly',   label: 'Κάθε μήνα' },
  { value: 'bimonthly', label: 'Κάθε 2 μήνες' },
  { value: 'quarterly', label: 'Κάθε 3 μήνες' },
  { value: 'biannual',  label: 'Κάθε 6 μήνες' },
  { value: 'annual',    label: 'Κάθε χρόνο' },
]

// «Γεγονότα Αύγουστος» δεν είναι ελληνικά. Ο μήνας μετά από ουσιαστικό μπαίνει
// σε γενική και η γενική δεν βγαίνει με κανόνα από την ονομαστική.

// ═══ ΤΟ ΓΕΜΙΣΜΑ ΠΟΥ ΕΓΙΝΕ ΔΕΔΟΜΕΝΟ ═══════════════════════════════════════
// Ο υπολογιστής δανείου αποθήκευε `bank: bankName || 'Μη καθορισμένη'`. Η φράση
// «Μη καθορισμένη» δεν είναι όνομα τράπεζας: είναι το κείμενο που θα έδειχνε η
// οθόνη ΑΝ έλειπε το όνομα. Γραμμένη στη στήλη, έγινε δεδομένο — και βγήκε
// στο ημερολόγιο ως «Δόση δανείου, Μη καθορισμένη», σε κάθε μία από τις εξήντα
// δόσεις. Η απουσία ανήκει στην οθόνη, όχι στη βάση.
export const UNSET_BANK = 'Μη καθορισμένη'
export const cleanBank = (b: string | null | undefined): string => {
  const v = (b || '').trim()
  return !v || v === UNSET_BANK ? '' : v
}
/** «Δόση δανείου, Πειραιώς» — ή σκέτο «Δόση δανείου» όταν η τράπεζα δεν έχει δηλωθεί. */
export const loanEventTitle = (bank: string | null | undefined): string => {
  const b = cleanBank(bank)
  return b ? `Δόση δανείου, ${b}` : 'Δόση δανείου'
}
// Τα ονόματα των ημερών και ο κανόνας «η εβδομάδα ξεκινά Δευτέρα» ζουν στο
// lib/core/months.ts, με ελέγχους πάνω σε πραγματικές ημερομηνίες.
export const DAY_NAMES_GR    = DAY_NAMES_SHORT

export const EMPTY_FORM: FormState = {
  title: '', category: 'reminder', event_date: '', event_time: '', duration: '', amount: '',
  priority: 'medium', status: 'pending', recurring: false,
  recurring_interval: 'monthly', recurrence_end_mode: 'none', recurrence_until: '', recurrence_count: '',
  notes: '', attachment_url: '', phone: '', email: '', add_expense: false,
}

export function fmt(date: string) { if (!date) return ''; const [y,m,d]=date.split('-'); return `${d}/${m}/${y}` }
export function fmtShort(date: string) { if (!date) return ''; const [,m,d]=date.split('-'); return `${d} ${MONTHS_SHORT[parseInt(m)-1]}` }
// Τρέχουσα στιγμή σε ώρα Ελλάδας (Europe/Athens), ανεξάρτητα από τη ζώνη της
// συσκευής — ώστε «σήμερα», η γραμμή «τώρα» και οι υπενθυμίσεις να είναι σωστές.
// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΘΗΝΑ ΔΕΝ ΒΓΑΙΝΕΙ ΜΕ ΣΤΡΟΓΓΥΛΟΠΟΙΗΣΗ ΜΕΣΩ ΚΕΙΜΕΝΟΥ.
// ─────────────────────────────────────────────────────────────────────────
// Εδώ ζούσε δεύτερη υλοποίηση ημέρας: `new Date(new Date().toLocaleString(
// 'en-US', {timeZone:'Europe/Athens'}))`. Το ιδίωμα μορφοποιεί σε κείμενο και
// το ΞΑΝΑΔΙΑΒΑΖΕΙ ως τοπική ώρα — δηλαδή στηρίζεται στο ότι ο αναλυτής του
// περιηγητή θα καταλάβει τη μορφή που παρήγαγε ο μορφοποιητής, κάτι που καμία
// προδιαγραφή δεν εγγυάται και που χάνει τα χιλιοστά.
//
// Και η μέτρηση ημερών απο πάνω του έφτιαχνε ΤΡΙΤΟ ζεύγος μεσάνυχτων με
// `setHours(0,0,0,0)` σε δύο διαφορετικές ζώνες. Το `lib/core/time` το κάνει
// σωστά, με `Intl.DateTimeFormat` και σύγκριση ημερολογιακών ημερών.
//
// ΤΟ `athensNow` ΜΕΝΕΙ, γιατί τρία σημεία θέλουν ΑΝΤΙΚΕΙΜΕΝΟ ημερομηνίας για
// τον μήνα που δείχνει το ημερολόγιο — αλλά χτίζεται πλέον απο το
// `athensToday()`, δηλαδή απο την ίδια πηγή, χωρίς γύρισμα απο κείμενο.
// ═══════════════════════════════════════════════════════════════════════════
export function athensNow(): Date { const t=athensToday(); return new Date(`${t}T00:00:00`) }
export function daysUntil(dateStr: string) { return athensDaysUntil(dateStr) ?? 0 }
export function isOverdue(e: CalEvent)  { return e.status==='pending'&&daysUntil(e.event_date)<0 }
// ═══ ΟΙ ΤΙΤΛΟΙ ΤΩΝ ΚΑΔΩΝ ΗΤΑΝ ΨΕΥΔΕΙΣ, ΟΧΙ ΑΝΑΚΡΙΒΕΙΣ ══════════════════════
// «Αυτόν τον μήνα» ήταν `d>7 && d<=30`, δηλαδή ΚΥΛΙΟΜΕΝΕΣ ημέρες. Στις 27
// Αυγούστου, γεγονός της 20ής Σεπτεμβρίου καθόταν στο «Αυτόν τον μήνα» ενώ
// γεγονός της 30ής Αυγούστου καθόταν στο «Επόμενες 7 μέρες». Οι δύο διπλανοί
// τίτλοι μετρούσαν το ίδιο πράγμα με δύο μονάδες· ο ένας από τους δύο έλεγε
// μήνα εκεί που υπήρχαν μόνο ημέρες.
//
// Και το «7» ήταν οκτώ: `d>=0 && d<=7` πιάνει τη σημερινή ΚΑΙ επτά ακόμη.
// Τώρα η μία ενότητα είναι ακριβώς επτά ημερολογιακές ημέρες, η άλλη οι επόμενες
// είκοσι τρεις, το άθροισμά τους τριάντα· η «Αργότερα» παίρνει ό,τι περισσεύει.
export function isThisWeek(e: CalEvent) { const d=daysUntil(e.event_date); return e.status==='pending'&&d>=0&&d<=6 }
export function isThisMonth(e: CalEvent){ const d=daysUntil(e.event_date); return e.status==='pending'&&d>6&&d<=29 }
export function isExpiring(e: CalEvent) { const d=daysUntil(e.event_date); return e.category==='contract'&&e.status==='pending'&&d>=0&&d<=60 }
export function todayStr() { return athensToday() }
export function addDaysStr(date:string, days:number) { const [y,m,d]=date.split('-').map(Number); const dt=new Date(Date.UTC(y,m-1,d+days)); return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}` }
