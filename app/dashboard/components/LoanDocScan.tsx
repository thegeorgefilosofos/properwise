'use client'
import { useRef, useState, type ReactNode } from 'react'
import { T, TT, Spinner } from '@/components/Theme'
import { rankLoans, type UserLoanNeeds, type BankInput } from '@/lib/loans/recommend'
import { fmtEur, fmtPct, type SavedLoan } from './TabLoanData'
import { MAX_SCAN_MB } from './scanDoc'
import { athensToday } from '@/lib/core/time';
import { SAY } from '@/lib/core/dbError';

// ═══════════════════════════════════════════════════════════════════════════
// ΚΟΙΝΗ ΜΗΧΑΝΗ ΣΑΡΩΣΗΣ ΤΗΣ ΣΥΜΒΟΥΛΕΥΤΙΚΗΣ ΔΑΝΕΙΟΥ
//
// ΤΙ ΕΣΠΑΣΕ. Στην ίδια ενότητα στέκονταν δύο κουμπιά ανεβάσματος με το ΙΔΙΟ
// εικονίδιο φωτογραφικής και σχεδόν ίδιο κείμενο («Ανέβασε αρχείο» εδώ,
// «Ανέβασε προσφορά» στο EsisScanPanel). Διαβάζουν όμως ΔΙΑΦΟΡΕΤΙΚΟ χαρτί και
// βγάζουν διαφορετικό αποτέλεσμα, οπότε δεν ενώθηκαν: ξεχωρίστηκαν με τίτλο,
// περιγραφή και εικονίδιο και μοιράζονται από εδώ ό,τι ήταν κοινό.
//
// ΤΙ ΗΤΑΝ ΓΡΑΜΜΕΝΟ ΔΥΟ ΦΟΡΕΣ: 34 σχεδόν πανομοιότυπες γραμμές ανά αρχείο
// (FileReader, όριο 10 MB, κλήση /api/anthropic με claude-sonnet-5, ξεφλούδισμα
// των ``` από το JSON, ο μετατροπέας αριθμού `num`, το κουτί σφάλματος). Τα δύο
// αντίγραφα είχαν ΗΔΗ αποκλίνει και το ένα ήταν χαλασμένο: το LoanDocScan
// έγραφε στο ίδιο state άλλοτε κωδικό («key», «service») και άλλοτε ολόκληρη
// ελληνική πρόταση («Το αρχείο είναι πολύ μεγάλο…»), ενώ η απόδοση συνέκρινε
// ΜΟΝΟ κωδικούς. Αποτέλεσμα: για αρχείο 12 MB ή για λάθος τύπο αρχείου ο
// χρήστης έβλεπε «Δεν διαβάστηκε καθαρά το αρχείο» — δύο μηνύματα γραμμένα και
// νεκρά. Εδώ ο κωδικός σφάλματος είναι ένας τύπος και το κείμενο ένα.
//
// ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΕ ΔΙΚΟ ΤΟΥ ΑΡΧΕΙΟ: η ανάθεση περιόριζε ρητά την αλλαγή σε
// αυτά τα δύο components. Ο κώδικας ζει στο πάνω-πάνω τμήμα του αρχείου που
// αποδίδεται πάντα και το EsisScanPanel (μόνο σε λειτουργία επαγγελματία) τον
// εισάγει — όχι το αντίστροφο, ώστε η βασική οθόνη να μη σέρνει το ESIS.
// ═══════════════════════════════════════════════════════════════════════════

// ΤΟ ΟΡΙΟ ΜΕΓΕΘΟΥΣ ΓΡΑΦΤΗΚΕ ΓΙΑ ΤΡΙΤΗ ΦΟΡΑ: `MAX_SCAN_MB = 10` υπάρχει ήδη στο
// scanDoc.ts και το διαβάζουν τέσσερα σημεία (scanDocument, scanPhoto, scanFile,
// TabDocuments). Ένας δεύτερος ορισμός εδώ σημαίνει ότι μια αλλαγή του ορίου
// αφήνει σιωπηλά τη μία από τις δύο πλευρές στα 10 MB — και ο χρήστης βλέπει
// «όριο 10 MB» στο Αρχείο και άλλο όριο στο Δάνειο. Έρχεται από εκεί· δεν
// κοστίζει πακέτο, το scanDoc είναι ήδη στο ίδιο chunk (η page.tsx εισάγει
// στατικά και το Αρχείο και το Δάνειο).

/**
 * Ο κωδικός σφάλματος της σάρωσης· το κενό σημαίνει «κανένα σφάλμα».
 * Λέγεται DocScanError και όχι ScanError επειδή το scanDoc.ts εξάγει ΗΔΗ
 * `ScanError` με ΑΛΛΑ μέλη ('key_missing' αντί 'key', χωρίς 'type'). Δύο
 * ομώνυμοι τύποι στον ίδιο φάκελο διαλέγονται λάθος από το αυτόματο import και
 * το λάθος φαίνεται μόνο όταν λείψει ένα κλειδί από πίνακα κειμένων.
 */
export type DocScanError = '' | 'key' | 'service' | 'unreadable' | 'type' | 'big' | 'quota'

const SCAN_ERROR_TEXT: Record<Exclude<DocScanError, ''>, string> = {
  key: 'Η υπηρεσία ανάλυσης δεν είναι διαθέσιμη αυτή τη στιγμή.',
  service: 'Προσωρινό πρόβλημα στην υπηρεσία. Δοκίμασε ξανά.',
  unreadable: 'Δεν διαβάστηκε καθαρά το αρχείο. Δοκίμασε πιο ευκρινή φωτογραφία ή αρχείο PDF.',
  type: 'Δεκτά είναι μόνο αρχεία εικόνας ή αρχεία PDF.',
  big: `Το αρχείο ξεπερνά το όριο των ${MAX_SCAN_MB} MB.`,
  // Οριο πακέτου, όχι βλάβη: η επανάληψη δεν πρόκειται να δουλέψει. Εφεδρεία,
  // γιατί κανονικά το κείμενο έρχεται από τον διακομιστή. Βλ. scanDoc.ts.
  quota: SAY.aiQuotaSpent,
}

/**
 * Ανθεκτική μετατροπή αριθμού από την απάντηση του μοντέλου: αφαιρεί σύμβολα,
 * τελείες χιλιάδων και δέχεται το ελληνικό κόμμα ως υποδιαστολή.
 */
export const scanNum = (v: unknown): number | undefined => {
  if (v == null) return undefined
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'))
  return isFinite(n) ? n : undefined
}

/** Το κουτί σφάλματος σάρωσης. Το `hint` λέει τι μπορεί να κάνει ο χρήστης αντ' αυτού. */
export function ScanErrorNote({ error, text, hint }: { error: DocScanError; text?: string; hint?: string }) {
  if (!error) return null
  return (
    <div style={{ padding: '11px 14px', background: 'var(--negative-dim)', border: '1px solid var(--negative-border)', borderRadius: 10 }}>
      <p style={{ fontSize: 'var(--fs-base)', color: 'var(--negative)', fontFamily: T.font.sans, lineHeight: 1.5 }}>
        {text || SCAN_ERROR_TEXT[error]}{hint ? ` ${hint}` : ''}
      </p>
    </div>
  )
}

/**
 * Η γραμμή ανεβάσματος: τι διαβάζει το εργαλείο (περιγραφή), με ποιο εικονίδιο
 * ξεχωρίζει και τι λέει το κουμπί. Το κρυφό πεδίο αρχείου ζει εδώ, ώστε καμία
 * οθόνη να μη χειρίζεται δικό της ref.
 */
export function ScanUploadRow({ title, description, action, icon, scanning, onFile }: {
  title?: string
  description: string
  action: string
  icon: ReactNode
  scanning: boolean
  onFile: (f: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
      <input ref={inputRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = '' }} />
      {/* ΤΟ ΚΟΥΜΠΙ ΕΤΡΩΓΕ ΤΗ ΣΤΗΛΗ ΤΟΥ ΚΕΙΜΕΝΟΥ ΣΤΗΝ ΤΑΜΠΛΕΤΑ

          ΤΙ ΜΕΤΡΗΘΗΚΕ (Chromium, το self-hosted Inter, τα tokens της εφαρμογής).
          Σε συσκευή αφής το `--fs-base` γίνεται 14 και το `--h-lg` 44, οπότε το
          «Ανέβασε στοιχεία δανειολήπτη» πιάνει 273 εικονοστοιχεία· με
          `flexShrink: 0` δεν δίνει ούτε ένα πίσω. Η σειρά της κάρτας σε iPad
          όρθιο είναι 678 στα 768, 720 στα 810, 730 στα 820 και 744 στα 834. Με
          `flex: 1` (βάση 0) η στήλη του κειμένου δεν ζητούσε πλάτος: έπαιρνε ό,τι
          περίσσευε, δηλαδή 385 ώς 451, οπότε η περιγραφή έσπαγε σε τέσσερις
          γραμμές των 57 ώς 62 χαρακτήρων (τρεις στα 834). Το κουμπί όμως είναι 44
          ψηλό δίπλα σε κείμενο 84 ώς 125: από κάτω του έμεναν 40 ώς 81 άδεια
          στήλη. Η κάρτα δεν φαινόταν μισοάδεια, ΗΤΑΝ.

          ΤΙ ΑΛΛΑΞΕ. Η στήλη δηλώνει πλέον πόσο πλάτος ΧΡΕΙΑΖΕΤΑΙ, όχι πόσο της
          περισσεύει: βάση 520, κάτω από την οποία η περιγραφή παύει να διαβάζεται
          ως παράγραφος. Όσο η σειρά χωράει 520 συν 20 συν το κουμπί, τίποτα δεν
          κουνιέται: στα 934 της πλάγιας iPad και στα 933 του 1280 η στήλη μένει
          641 και 653 με δύο γραμμές, ίδια με πριν ώς τα 1920. Όταν δεν χωράει, το
          `flexWrap` της σειράς κατεβάζει το κουμπί σε δική του γραμμή: το κείμενο
          παίρνει ΟΛΟ το πλάτος της κάρτας και η άδεια στήλη μηδενίζεται. Στα 768
          η περιγραφή γίνεται δύο γραμμές των 97 και 105 χαρακτήρων, δηλαδή το
          ΙΔΙΟ σχήμα που μετρήθηκε στα 1.280 και ζητά το ύψος γραμμής από κάτω.
          Το ίδιο κερδίζει το δελτίο ESIS, που μοιράζεται αυτή τη σειρά: από τα
          768 ώς τα 820 πέφτει από τέσσερις γραμμές με κενό 35 σε τρεις χωρίς
          κενό, ενώ από τα 834 και πάνω μένει ως έχει.

          ΤΟ ΤΙΜΗΜΑ, ΓΡΑΜΜΕΝΟ. Η τυλιγμένη σειρά είναι ΨΗΛΟΤΕΡΗ: 128 αντί για 125
          στα 768, αντί για 104 στα 810 και στα 820, αντί για 84 στα 834. Ώς 44
          εικονοστοιχεία ύψους για να φύγει μια άδεια στήλη ώς 81 και να διαβαστεί
          η περιγραφή σε παράγραφο αντί για στήλη εφημερίδας.

          ΓΙΑΤΙ 520 ΚΑΙ ΟΧΙ ΜΕΓΑΛΥΤΕΡΟ. Για να μη γυρίσει η πλάγια iPad (σειρά
          934, κουμπί 273) η βάση δεν επιτρέπεται να ξεπεράσει τα 641· για το 1280
          (σειρά 933, κουμπί 260) το όριο είναι 653. Τα 520 αφήνουν πάνω από 120
          εικονοστοιχεία περιθώριο, ώστε ένα μακρύτερο λεκτικό κουμπιού να μη
          σύρει το κατώφλι πάνω σε οθόνη που σήμερα δεν τυλίγεται.

          ΤΟ `minWidth` ΑΠΟ 240 ΣΕ 0. Το κατώφλι της αναδίπλωσης το ορίζει τώρα η
          βάση, όχι ένα φρένο. Τα 240 δεν έπιαναν πουθενά από τα 320 και πάνω·
          στα 300 κρατούσαν τη στήλη 240 μέσα σε σειρά 238, δηλαδή δύο
          εικονοστοιχεία έξω από την κάρτα· το μηδέν τα μαζεύει. Η υπερχείλιση
          των 17 σε εκείνο το πλάτος είναι του κουμπιού που δεν συρρικνώνεται·
          δεν την αγγίζει αυτή η αλλαγή. */}
      <div style={{ flex: '1 1 520px', minWidth: 0 }}>
        {title && <p style={{ ...TT.h2, marginBottom: 4 }}>{title}</p>}
        {/* ΓΡΑΜΜΗ 101 ΧΑΡΑΚΤΗΡΩΝ ΜΕ ΥΨΟΣ 1,55. Πάνω από τους 95 χαρακτήρες το μάτι
            χάνει την αρχή της επόμενης γραμμής και χρειάζεται 1,6 για να τη βρει.
            Μετρημένο στα 1.280 και στα 1.440, όπου η περιγραφή απλώνεται σε όλο
            το πλάτος της κάρτας.
            ΓΙΑΤΙ 1,65 ΚΑΙ ΟΧΙ 1,6. Ο περιηγητής επιστρέφει το ύψος σε πίξελ:
            13 × 1,6 δίνει 20,7969 και η αναλογία ξαναβγαίνει 1,5997, δηλαδή
            ακριβώς κάτω από το όριο. Το ίδιο το κατώφλι γραμμένο ως τιμή πέφτει
            στη λάθος μεριά της στρογγυλοποίησης. */}
        {/* Το `lineHeight: undefined` σβήνει το 1,50 που φέρνει το `TT.bodySm`
            μέσα από το spread· αλλιώς το ενσωματωμένο στυλ νικά την κλάση. */}
        <p className="po-prose" style={{ ...TT.bodySm, lineHeight: undefined, color: 'var(--text-tertiary)' }}>{description}</p>
      </div>
      <button onClick={() => inputRef.current?.click()} disabled={scanning}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 16px', height: T.h.lg, borderRadius: T.radius.inner, background: 'var(--accent)', border: '1px solid transparent', color: 'var(--accent-text)', fontSize: 'var(--fs-base)', fontFamily: T.font.sans, fontWeight: 600, cursor: scanning ? 'wait' : 'pointer', flexShrink: 0 }}>
        {icon}
        {scanning ? 'Ανάλυση…' : action}
      </button>
    </div>
  )
}

/**
 * Η μία σάρωση: έλεγχος τύπου και μεγέθους, ανάγνωση αρχείου, κλήση του
 * μοντέλου με το prompt της κάθε οθόνης, αποκωδικοποίηση JSON. Ο καλών παίρνει
 * πίσω μόνο κατάσταση φόρτωσης, σφάλμα και τον χειριστή αρχείου.
 */
export function useDocScan<T>(opts: {
  /** Το system prompt της οθόνης — τι έγγραφο περιμένει και τι πεδία βγάζει. */
  system: string
  /** Η οδηγία που συνοδεύει το αρχείο. */
  ask: string
  /** Καθάρισμα προηγούμενου αποτελέσματος, πριν ξεκινήσει η νέα σάρωση. */
  onStart?: () => void
  onResult: (parsed: T) => void
}) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<DocScanError>('')
  // Το μήνυμα του διακομιστή, όταν ξέρει περισσότερα από τον πίνακα παραπάνω.
  const [errorText, setErrorText] = useState<string>()

  // Ο χειριστής ΔΕΝ απομνημονεύεται και δεν κρατά ref με τις επιλογές: φτιάχνεται
  // ξανά σε κάθε απόδοση, οπότε βλέπει πάντα τα τρέχοντα `system`/`onResult`
  // χωρίς ο καλών να χρειάζεται σταθερές αναφορές συναρτήσεων. Δεν υπάρχει
  // memo στη διαδρομή του, άρα δεν κοστίζει καμία επιπλέον απόδοση.
  const scanFile = (file: File) => {
    const mime = file.type
    if (!mime.startsWith('image/') && mime !== 'application/pdf') { setError('type'); return }
    if (file.size > MAX_SCAN_MB * 1024 * 1024) { setError('big'); return }
    setError(''); setErrorText(undefined); setScanning(true); opts.onStart?.()
    const reader = new FileReader()
    reader.onerror = () => { setError('unreadable'); setScanning(false) }
    reader.onload = async () => {
      const base64 = String(reader.result || '').split(',')[1] || ''
      const part = mime === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
        : { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } }
      try {
        const res = await fetch('/api/anthropic', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-5', max_tokens: 1200, system: opts.system,
            messages: [{ role: 'user', content: [part, { type: 'text', text: opts.ask }] }],
          }),
        })
        const data = await res.json()
        if (res.status === 429) {
          setError('quota')
          if (typeof data?.error === 'string') setErrorText(data.error)
          return
        }
        if (!res.ok || data?.error) { setError(String(data?.error || '').includes('API_KEY') ? 'key' : 'service'); return }
        const text = (data.content || []).find((c: { type: string }) => c.type === 'text')?.text || '{}'
        opts.onResult(JSON.parse(text.replace(/```json?|```/g, '').trim()) as T)
      } catch { setError('unreadable') }
      finally { setScanning(false) }
    }
    reader.readAsDataURL(file)
  }

  return { scanning, error, errorText, scanFile }
}

// ═══════════════════════════════════════════════════════════════════════════
// ΠΡΟΦΙΛ ΔΑΝΕΙΟΛΗΠΤΗ ΑΠΟ ΕΓΓΡΑΦΟ → ΚΑΤΑΤΑΞΗ ΤΡΑΠΕΖΩΝ
//
// Δέχεται τις ΑΝΑΓΚΕΣ του υποψήφιου δανειολήπτη (ποσό, εισόδημα, ακίνητο,
// οικογενειακή κατάσταση) ή ένα υπάρχον δάνειο, τρέχει τον recommender και
// γράφει: στον Υπολογιστή (onApply) και στα αποθηκευμένα δάνεια (onSaveLoan).
// Δεν διαβάζει προσφορά τράπεζας — αυτό το κάνει το EsisScanPanel.
// ═══════════════════════════════════════════════════════════════════════════

const PURPOSES = ['purchase','first_home','renovation','energy','investment','auction','construction','commercial','land','refinance'] as const
type Purpose = typeof PURPOSES[number]

const SYSTEM_PROMPT = `Είσαι εξειδικευμένος αναλυτής στεγαστικών δανείων στην Ελλάδα. Σου δίνεται φωτογραφία ή έγγραφο με τις επιθυμίες/ανάγκες ενός υποψήφιου δανειολήπτη ή τα στοιχεία ενός υπάρχοντος δανείου.
Εξήγαγε ΜΟΝΟ ό,τι αναφέρεται ρητά ή προκύπτει με ασφάλεια. Επίστρεψε ΑΠΟΚΛΕΙΣΤΙΚΑ ένα έγκυρο JSON, χωρίς σχόλια ή κείμενο εκτός JSON, με το εξής σχήμα (παρέλειψε όποιο πεδίο δεν προκύπτει):
{
  "loan_amount": number,            // ποσό δανείου σε ευρώ
  "property_value": number,          // αξία/τιμή ακινήτου σε ευρώ
  "years": number,                   // διάρκεια σε έτη
  "purpose": "purchase|first_home|renovation|energy|investment|auction|construction|commercial|land|refinance",
  "rate_preference": "fixed|variable|mixed",
  "age": number,
  "income_annual": number,           // ετήσιο καθαρό/δηλωθέν εισόδημα σε ευρώ
  "marital_status": "single|married|single_parent",
  "children": number,
  "first_home": boolean,             // αν πρόκειται για πρώτη κατοικία
  "energy_class": string,            // π.χ. "A+", "B", "Γ"
  "property_year_built": number,
  "property_sqm": number,
  "bank": string,                    // αν αναφέρεται τράπεζα
  "current_rate": number,            // αν είναι υπάρχον δάνειο, το επιτόκιό του (%)
  "summary": string,                 // μία σύντομη πρόταση για το τι ζητά ο δανειολήπτης
  "confidence": number               // 0-100
}
Οι αριθμοί χωρίς σύμβολα ή τελείες χιλιάδων. Αν δεν είσαι σίγουρος για ένα πεδίο, παρέλειψέ το.`

type Extracted = {
  loan_amount?: number; property_value?: number; years?: number; purpose?: string
  rate_preference?: string; age?: number; income_annual?: number; marital_status?: string
  children?: number; first_home?: boolean; energy_class?: string; property_year_built?: number
  property_sqm?: number; bank?: string; current_rate?: number; summary?: string; confidence?: number
}

export interface AppliedLoan { v: number; loanAmount?: number; propValue?: number; rate?: number; years?: number; rateType?: 'fixed'|'variable'|'mixed'; loanType?: string; income?: number; marital?: 'single'|'married'; children?: number }

export default function LoanDocScan({ banks, euribor, defaultPropertyValue, onApply, onSaveLoan, onOpenCalculator }: {
  // Οι τράπεζες περνούν αυτούσιες στο `rankLoans`, που έχει τον δικό του τύπο
  // εισόδου: τον δηλώνουμε εδώ αντί για `any`, ώστε ένα λάθος σχήμα να πέσει
  // στο σημείο που περνά — και όχι σιωπηλά μέσα στην κατάταξη.
  banks: BankInput[]; euribor: number; defaultPropertyValue?: number
  onApply?: (a: AppliedLoan) => void
  onSaveLoan?: (loan: Partial<SavedLoan>) => Promise<void> | void
  onOpenCalculator?: () => void
}) {
  const [ex, setEx] = useState<Extracted | null>(null)
  const [saving, setSaving] = useState(false)

  const { scanning, error, errorText, scanFile } = useDocScan<Extracted>({
    system: SYSTEM_PROMPT,
    ask: 'Εξήγαγε τα στοιχεία δανείου με ακρίβεια και επίστρεψε μόνο το JSON.',
    onStart: () => setEx(null),
    onResult: parsed => {
      // Ντετερμινιστική εξομάλυνση αριθμών (το AI μπορεί να δώσει strings/σύμβολα).
      ;(['loan_amount','property_value','years','age','income_annual','children','property_year_built','property_sqm','current_rate','confidence'] as const)
        // Τα κλειδιά είναι όλα αριθμητικά πεδία του `Extracted`, οπότε η γραφή
        // είναι έγκυρη· ο μεταγλωττιστής όμως δεν συνδέει το κλειδί με τον τύπο
        // της τιμής σε δυναμική ανάθεση. Η μετατροπή περιορίζεται στα αριθμητικά
        // πεδία και δεν ανοίγει ολόκληρο το αντικείμενο, όπως έκανε το `any`.
        .forEach(k => { if (parsed[k] != null) (parsed as Record<typeof k, number | undefined>)[k] = scanNum(parsed[k]) })
      setEx(parsed)
    },
  })

  // Χτίζει τις ανάγκες δανειολήπτη από τα εξαγόμενα, με ασφαλείς προεπιλογές.
  const needs: UserLoanNeeds | null = ex && (ex.loan_amount || ex.property_value) ? {
    amount: ex.loan_amount || Math.round((ex.property_value || 0) * 0.8) || 0,
    propertyValue: ex.property_value || defaultPropertyValue || 0,
    years: ex.years || 25,
    purpose: (PURPOSES.includes(ex.purpose as Purpose) ? ex.purpose : (ex.first_home ? 'first_home' : 'purchase')) as Purpose,
    ratePreference: (ex.rate_preference === 'variable' || ex.rate_preference === 'mixed') ? ex.rate_preference : 'fixed',
    age: ex.age,
    income: ex.income_annual,
    maritalStatus: (ex.marital_status === 'married' || ex.marital_status === 'single_parent') ? ex.marital_status : 'single',
    children: ex.children,
    firstHome: ex.first_home ?? (ex.purpose === 'first_home'),
    propertySqm: ex.property_sqm,
    propertyYearBuilt: ex.property_year_built,
    energyClass: ex.energy_class,
  } : null

  const ranked = needs ? rankLoans(needs, banks, euribor, athensToday()) : []
  const best = ranked.find(r => r.eligible) || ranked[0]

  // ── ΤΟ «v» ΕΙΝΑΙ ΚΛΕΙΔΙ ΑΛΛΑΓΗΣ, ΟΧΙ ΧΡΟΝΟΣ ───────────────────────────────
  // Ο υπολογιστής ακούει `[applied?.v]` για να ξέρει ότι ήρθε ΝΕΑ εφαρμογή. Το
  // κλειδί βγαινε από `Date.now() % 1e9 + confidence`: ρολόι μέσα σε τιμή που
  // δεν έχει καμία σχέση με χρόνο και δύο εφαρμογές στο ίδιο χιλιοστό με ίδια
  // βεβαιότητα θα έδιναν το ΙΔΙΟ κλειδί, δηλαδή η δεύτερη δεν θα περνούσε.
  // Ένας μετρητής που ανεβαίνει λέει ακριβώς αυτό που θέλουμε και δεν μπορεί
  // ποτέ να συμπέσει.
  const applyCount = useRef(0)

  const applyToCalc = () => {
    if (!needs) return
    onApply?.({
      v: ++applyCount.current,
      loanAmount: needs.amount, propValue: needs.propertyValue, years: needs.years,
      rate: best?.effectiveRatePct ?? ex?.current_rate,
      rateType: needs.ratePreference,
      loanType: needs.purpose,
      income: ex?.income_annual ? Math.round(ex.income_annual / 12) : undefined,
      marital: needs.maritalStatus === 'married' ? 'married' : 'single',
      children: needs.children,
    })
    onOpenCalculator?.()
  }

  const saveAsLoan = async () => {
    if (!needs || !best) return
    setSaving(true)
    try {
      await onSaveLoan?.({
        bank: best.bankName || ex?.bank || '', amount: needs.amount,
        rate: Number((best.effectiveRatePct ?? ex?.current_rate ?? 3.5).toFixed(2)),
        years: needs.years, rate_type: needs.ratePreference === 'variable' ? 'variable' : 'fixed',
        property_value: needs.propertyValue, loan_type: needs.purpose,
        start_date: athensToday(), status: 'active',
        notes: `Από σάρωση στοιχείων δανειολήπτη${ex?.summary ? ` · ${ex.summary}` : ''}`,
      })
    } finally { setSaving(false) }
  }

  const chips: { k: string; v: string }[] = ex ? [
    ex.loan_amount ? { k: 'Ποσό δανείου', v: fmtEur(ex.loan_amount) } : null,
    ex.property_value ? { k: 'Αξία ακινήτου', v: fmtEur(ex.property_value) } : null,
    ex.years ? { k: 'Διάρκεια', v: `${ex.years} έτη` } : null,
    ex.income_annual ? { k: 'Εισόδημα (έτος)', v: fmtEur(ex.income_annual) } : null,
    ex.age ? { k: 'Ηλικία', v: `${ex.age} ετών` } : null,
    ex.children != null ? { k: 'Τέκνα', v: String(ex.children) } : null,
    ex.first_home ? { k: 'Κατοικία', v: 'Πρώτη κατοικία' } : null,
    ex.energy_class ? { k: 'Ενεργειακή κλάση', v: ex.energy_class } : null,
    ex.bank ? { k: 'Τράπεζα', v: ex.bank } : null,
  ].filter(Boolean) as { k: string; v: string }[] : []

  const font = T.font.sans
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: '16px 20px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ScanUploadRow
        title="Εύρεση δανείου από τα στοιχεία του δανειολήπτη"
        description="Ανέβασε έγγραφο ή φωτογραφία με τις ανάγκες ενός υποψήφιου δανειολήπτη (ποσό, εισόδημα, ακίνητο, οικογενειακή κατάσταση) ή ένα υπάρχον δάνειο. Το εργαλείο εξάγει τα στοιχεία και κατατάσσει τις τράπεζες."
        action="Ανέβασε στοιχεία δανειολήπτη"
        scanning={scanning}
        onFile={scanFile}
        icon={<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
      />

      <ScanErrorNote error={error} text={errorText} />

      {scanning && <Spinner size={18} label="Ανάγνωση και ανάλυση εγγράφου…" />}

      {ex && !scanning && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {ex.summary && <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', fontFamily: font, lineHeight: 1.6, padding: '11px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>{ex.summary}</p>}

          {chips.length > 0 && (
            <div>
              <p style={{ ...TT.label, color: 'var(--text-tertiary)', marginBottom: 8 }}>Στοιχεία που εντοπίστηκαν</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {chips.map(c => (
                  <span key={c.k} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, padding: '6px 11px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: font }}>{c.k}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: font, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{c.v}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {best ? (
            <div style={{ padding: '16px 18px', background: 'var(--accent-dim)', border: '1px solid var(--border-accent)', borderRadius: T.radius.card }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ ...TT.label, color: 'var(--accent)', marginBottom: 4 }}>Προτεινόμενο δάνειο</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: font, letterSpacing: '-0.01em' }}>{best.bankName}{best.spitiMouApplied ? ' · Σπίτι μου ΙΙ' : ''}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, fontFamily: font, lineHeight: 1.5 }}>{best.eligible ? best.why : best.blockers.join(' · ')}</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', fontFamily: font, fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.02em' }}>{fmtPct(best.effectiveRatePct)}</p>
                  <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', marginTop: 4, fontFamily: font, fontVariantNumeric: 'tabular-nums' }}>{fmtEur(best.monthlyPayment)} τον μήνα</p>
                  <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 1, fontFamily: font, fontVariantNumeric: 'tabular-nums' }}>Σύνολο {fmtEur(best.totalCost)}</p>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-tertiary)', fontFamily: font }}>Δεν προέκυψαν αρκετά στοιχεία (ποσό ή αξία ακινήτου) για πρόταση. Δοκίμασε πιο πλήρες έγγραφο.</p>
          )}

          {needs && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={applyToCalc} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 16px', height: T.h.lg, borderRadius: 10, background: 'var(--accent)', border: 'none', color: 'var(--accent-text)', fontSize: 'var(--fs-base)', fontFamily: font, fontWeight: 600, cursor: 'pointer' }}>Εφαρμογή στον υπολογιστή</button>
              {onSaveLoan && best && <button onClick={saveAsLoan} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 16px', height: T.h.lg, borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: 'var(--fs-base)', fontFamily: font, fontWeight: 500, cursor: saving ? 'wait' : 'pointer' }}>{saving ? 'Αποθήκευση…' : 'Αποθήκευση ως δάνειο'}</button>}
              <button onClick={() => setEx(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 14px', height: T.h.lg, borderRadius: 10, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: 'var(--fs-base)', fontFamily: font, fontWeight: 500, cursor: 'pointer' }}>Καθαρισμός</button>
            </div>
          )}
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', lineHeight: 1.6, fontFamily: font }}>Ενδεικτική ανάλυση βάσει των στοιχείων του εγγράφου. Επιβεβαίωσε τους ακριβείς όρους με την τράπεζα.</p>
        </div>
      )}
    </div>
  )
}
