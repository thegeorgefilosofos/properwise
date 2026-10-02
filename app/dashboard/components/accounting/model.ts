'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΣΤΑΘΕΡΕΣ ΚΑΙ ΟΙ ΜΟΡΦΟΠΟΙΗΤΕΣ ΤΗΣ ΛΟΓΙΣΤΙΚΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Ποσά, ποσοστά, η ημέρα της Αθήνας, οι καταστάσεις είσπραξης με τον τόνο
// τους, τα πλάτη του ισοζυγίου και η ανάγνωση των ρυθμίσεων από τη μνήμη.
// Τίποτα εδώ δεν αποδίδει και τίποτα δεν ξέρει από βάση.
// ═══════════════════════════════════════════════════════════════════════════
import { fe, fp } from '@/components/Theme'
import type { AdvisoryTone } from '@/lib/accounting/advisory'
import type { ReconStatus } from '@/lib/accounting/ledger'
import { INK, INK_MUTED } from '@/lib/print/ink'
import { STATUS_LABEL, STATUS_TONE, tonePill, type StatusTone } from '@/lib/core/status'

// ΔΥΟ ΟΝΟΜΑΤΑ ΓΙΑ ΤΗΝ ΙΔΙΑ ΣΥΝΑΡΤΗΣΗ. Ήταν `eur = fe(n,0)` και `eur2 = fe(n)`,
// δηλαδή «στρογγυλό» και «ακριβές» — αλλά το δεύτερο όρισμα του `fe` αγνοούνταν,
// οπότε οι δύο ήταν πανομοιότυπες και η πρόθεση είχε χαθεί σιωπηλά.
export const eur = fe
// Το ποσοστό ερχόταν από τέταρτο τοπικό μορφοποιητή, με ένα δεκαδικό.
export const pct = (n:number)=>fp(n*100)
export function athensNow(){ return new Date(new Date().toLocaleString('en-US',{timeZone:'Europe/Athens'})) }
export function athensYear(){ return athensNow().getFullYear() }
export function todayAthens(){ const d=athensNow(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

// Η ΚΑΤΑΣΤΑΣΗ ΛΕΓΕΤΑΙ ΜΕ ΤΗ ΛΕΞΗ ΚΑΙ ΦΩΤΙΖΕΤΑΙ ΜΕ ΤΟΝΟ. Η λέξη μένει ο φορέας
// της πληροφορίας (σαφής και σε όποιον δεν ξεχωρίζει χρώματα). Ο τόνος ήταν
// γκρι για όλες και ο ιδιοκτήτης το ζήτησε ρητά (25.09.2026): «θέλω το
// πληρώθηκε να φωτίζει λίγο, να είναι πιο ζωντανό». Απαλό φόντο και περίγραμμα
// του ίδιου ρόλου, όπως στα σήματα της υπόλοιπης εφαρμογής· το «Εκκρεμεί»
// μένει ουδέτερο, γιατί δεν έχει ακόμη συμβεί τίποτα.
// Λέξη και τόνος από το κοινό λεξιλόγιο (lib/core/status.ts).
export const STATUS_META:Record<ReconStatus,{label:string;color:string;strong:boolean;tone:StatusTone}> = {
  paid:     { label:STATUS_LABEL.paid,    color:'var(--text-tertiary)',  strong:false, tone:STATUS_TONE.paid    },
  partial:  { label:STATUS_LABEL.partial, color:'var(--text-primary)',   strong:true,  tone:STATUS_TONE.partial },
  unpaid:   { label:STATUS_LABEL.pending, color:'var(--text-secondary)', strong:false, tone:STATUS_TONE.pending },
  overdue:  { label:STATUS_LABEL.overdue, color:'var(--text-primary)',   strong:true,  tone:STATUS_TONE.overdue },
}
export const toneStyle = (t: StatusTone): React.CSSProperties => tonePill(t)

// Οι ίδιοι τόνοι για το τυπωμένο χαρτί, όπου δεν υπάρχουν μεταβλητές θέματος.
//
// ΤΟ ΧΑΡΤΙ ΕΧΕΙ ΕΝΑ ΜΕΛΑΝΟΔΟΧΕΙΟ, ΤΟ lib/print/ink.ts. Εδώ ζούσε δεύτερο
// αντίγραφο με τέσσερα ωμά χρώματα, που έλεγε ακριβώς ό,τι λέει ήδη το
// `strong` από πάνω: οι δύο καταστάσεις που πρέπει να ξεχωρίσουν παίρνουν
// κύριο μελάνι, οι άλλες δύο δευτερεύον. Ενας πίνακας που επαναλαμβάνει
// διπλανή του πληροφορία είναι πίνακας που μια μέρα θα διαφωνήσει μαζί της.
export const statusInk = (st: ReconStatus): string => (STATUS_META[st].strong ? INK : INK_MUTED)

// Τα ΠΕΡΙΕΧΟΜΕΝΑ πλάτη των στηλών του ισοζυγίου, ΜΙΑ φορά: το `<colgroup>` και
// το ελάχιστο πλάτος του πίνακα διαβάζουν την ίδια τιμή. Γραμμένα τρεις φορές
// —κεφαλίδα, γραμμές, σύνολα— μια αλλαγή σε δύο από τις τρεις έδινε πίνακα με
// μετατοπισμένα σύνολα: δεν σκάει πουθενά, απλώς είναι λάθος.
// Η πρώτη στήλη χωρά την επικεφαλίδα της. Ήταν 72px με «Κωδικός», στένεψε σε
// 64px ενώ η επικεφαλίδα μεγάλωνε σε «Κωδικός ΕΛΠ» και έσπαγε σε δύο γραμμές.
export const TRIAL_W = { code: 86, account: 120, debit: 92, credit: 92, balance: 100 } as const
// ΤΟ ΓΕΜΙΣΜΑ ΤΟΥ ΚΕΛΙΟΥ ΜΕΤΡΑΕΙ ΜΕΣΑ ΣΤΟ ΠΛΑΤΟΣ ΤΗΣ ΣΤΗΛΗΣ. Στο πλέγμα τα
// παραπάνω ήταν καθαρό περιεχόμενο κι ο αέρας ερχόταν από gap 8 συν 14 στις
// άκρες. Σε `table-layout: fixed` η στήλη μετρά ΚΑΙ τα 14+14 της `.po-table`,
// οπότε σκέτο το 86 θα άφηνε 58 για επικεφαλίδα που ζητά ~78 — δηλαδή πάλι δύο
// γραμμές, ακριβώς ό,τι διόρθωσε το 86. Κάθε στήλη παίρνει τα 28 της.
const TRIAL_PAD = 28
export const trialCol = (w: number) => `${w + TRIAL_PAD}px`
// Κάτω από αυτό ο πίνακας κυλά· δεν συμπιέζεται, γιατί συμπίεση εδώ σημαίνει
// στήλη που χάνεται. Ήταν 550 με τα κενά του πλέγματος, τώρα 630 με το γέμισμα
// των πέντε κελιών: η οριζόντια κύλιση αρχίζει 80 εικονοστοιχεία νωρίτερα.
export const TRIAL_MIN = TRIAL_W.code + TRIAL_W.account + TRIAL_W.debit + TRIAL_W.credit + TRIAL_W.balance + TRIAL_PAD * 5

// Χρώμα μόνο στη γραμμή αποτελέσματος, αλλού ουδέτερο (χωρίς θόρυβο).
// Ήπια, ουδέτερη ένδειξη τόνου για τη συμβουλευτική (χωρίς έντονα χρώματα/λίστες).
export const ADVISORY_TONE:Record<AdvisoryTone,string> = { opportunity:'Ευκαιρία', action:'Ενέργεια', insight:'Ιδέα', caution:'Προσοχή' }

export const readElp = (raw: string | null): 'personal' | 'business' | null => (raw === 'personal' || raw === 'business' ? raw : null)
export const writeElp = (v: 'personal' | 'business' | null) => v ?? ''
export const readNum = (raw: string | null): number | '' => { const n = Number(raw); return raw && Number.isFinite(n) && n ? n : '' }
export const writeNum = (v: number | '') => (v ? String(v) : '')
