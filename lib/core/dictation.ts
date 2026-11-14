// ═══════════════════════════════════════════════════════════════════════════
// ΥΠΑΓΟΡΕΥΣΗ: Η ΜΗΧΑΝΗ, ΧΩΡΙΣ REACT
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΧΩΡΙΣΤΑ ΑΠΟ ΤΟ HOOK. Ολη η λογική που μπορεί να πάει στραβά ζει εδώ:
// η σειρά των καταστάσεων, η σιωπή που σταματά την ακρόαση, ο κωδικός σφάλματος
// που γίνεται μήνυμα, η στίξη που λέγεται με λέξεις και η εισαγωγή στη θέση του
// δρομέα. Ολα δοκιμάζονται σε Node με ψεύτικη αναγνώστρια, χωρίς περιηγητή.
//
// ΚΑΙ ΓΙΑΤΙ ΦΟΡΤΩΝΕΤΑΙ ΑΡΓΑ. Το μικρόφωνο φαίνεται σε δεκάδες πεδία, αλλά το
// πατάει μικρό μέρος των χρηστών. Το κουμπί είναι λίγες γραμμές στο κύριο
// πακέτο· αυτό το αρχείο κατεβαίνει την πρώτη φορά που κάποιος το πλησιάζει
// (`components/dictation/useDictation.ts`).
//
// ΧΩΡΙΣ ΚΛΕΙΔΙ ΚΑΙ ΧΩΡΙΣ ΚΟΣΤΟΣ. Μόνο το Web Speech API του περιηγητή. Οπου δεν
// υπάρχει (Firefox), το κουμπί δεν αποδίδεται καθόλου.
// ═══════════════════════════════════════════════════════════════════════════
import { speechRecognizer, type SpeechEvent, type SpeechErrorEvent, type SpeechRecognizer } from './speech'
import { PRODUCT_NAME } from './site'

/** Οι καταστάσεις που βλέπει ο χρήστης. */
export type DictationStatus = 'idle' | 'starting' | 'listening' | 'error'

/** Τα σφάλματα, ομαδοποιημένα με βάση το τι μπορεί να κάνει ο χρήστης. */
export type DictationError = 'denied' | 'no-speech' | 'no-mic' | 'network' | 'language' | 'unsupported' | 'other'

export interface DictationState {
  status: DictationStatus
  error: DictationError | null
  /** Ακούστηκε έστω μία λέξη σε αυτή τη συνεδρία. */
  heard: boolean
}

export const IDLE: DictationState = { status: 'idle', error: null, heard: false }

export type DictationEvent =
  | { type: 'start' }
  | { type: 'audio' }
  | { type: 'result' }
  | { type: 'error'; error: DictationError }
  | { type: 'end' }

/**
 * Η μία μετάβαση. Καθαρή συνάρτηση, ώστε κάθε σειρά συμβάντων να δοκιμάζεται.
 *
 * Το `end` μετά από σφάλμα κρατά το σφάλμα: ο περιηγητής στέλνει ΠΑΝΤΑ `end`
 * μετά το `error` και αλλιώς το μήνυμα θα έσβηνε πριν προλάβει να διαβαστεί.
 */
export function reduce(s: DictationState, e: DictationEvent): DictationState {
  switch (e.type) {
    case 'start': return { status: 'starting', error: null, heard: false }
    case 'audio': return s.status === 'starting' ? { ...s, status: 'listening' } : s
    case 'result': return s.status === 'error' ? s : { ...s, status: 'listening', heard: true }
    case 'error': return { ...s, status: 'error', error: e.error }
    case 'end': return s.status === 'error' ? s : { ...s, status: 'idle' }
  }
}

/**
 * Ο κωδικός του περιηγητή σε σφάλμα που καταλαβαίνει ο χρήστης. Το `aborted`
 * δεν είναι σφάλμα: το προκαλούμε εμείς όταν ο χρήστης πατήσει «σταμάτα».
 */
export function errorFromCode(code: string | undefined): DictationError | null {
  switch (code) {
    case 'aborted': return null
    case 'not-allowed':
    case 'service-not-allowed': return 'denied'
    case 'no-speech': return 'no-speech'
    case 'audio-capture': return 'no-mic'
    case 'network': return 'network'
    case 'language-not-supported': return 'language'
    default: return 'other'
  }
}

/** Ελληνικά ή αγγλικά, από τη γλώσσα της σελίδας (`<html lang>`). */
export const isEnglish = (lang: string): boolean => /^en\b/i.test(lang)

/** Η γλώσσα αναγνώρισης για τη γλώσσα της σελίδας. */
export const recognitionLang = (pageLang: string): string => (isEnglish(pageLang) ? 'en-US' : 'el-GR')

/**
 * Το μήνυμα για κάθε σφάλμα. Λέει τι έγινε ΚΑΙ τι κάνει ο χρήστης τώρα: ένα
 * «απέτυχε» χωρίς επόμενο βήμα αφήνει τον χρήστη μπροστά σε κουμπί που δεν
 * ξέρει αν θα δουλέψει την επόμενη φορά.
 */
/**
 * Πού ζει ο διακόπτης του μικροφώνου. Το «λουκέτο δίπλα στη διεύθυνση» είναι
 * σωστό μόνο στον Chrome και στον Edge του υπολογιστή. Στο iPhone ο διακόπτης
 * είναι στο «aA», στο Android στις Άδειες, στο Safari του Mac στις Ρυθμίσεις
 * του. Η εγκατεστημένη εφαρμογή δεν έχει καν γραμμή διεύθυνσης.
 */
export type Platform = 'ios' | 'ios-chrome' | 'android' | 'mac-safari' | 'pwa' | 'pwa-desktop' | 'desktop'

/**
 * @param ua         το User-Agent
 * @param standalone τρέχει ως εγκατεστημένη εφαρμογή (display-mode: standalone)
 * @param touch      `navigator.maxTouchPoints`: το iPad δηλώνει Mac αλλά έχει αφή
 */
export function platformOf(ua: string, standalone: boolean, touch = 0): Platform {
  const mobile = /iPhone|iPad|iPod|Android/i.test(ua) || (/Macintosh/i.test(ua) && touch > 1)
  // Εγκατεστημένη: στο κινητό ο διακόπτης είναι στις ρυθμίσεις της συσκευής,
  // στον υπολογιστή στο μενού του παραθύρου της εφαρμογής (Chrome, Edge).
  if (standalone) return mobile ? 'pwa' : 'pwa-desktop'
  // Ο Chrome στο iPhone δεν έχει «aA»: η άδεια ζει στις Ρυθμίσεις του iPhone.
  if (/CriOS/i.test(ua)) return 'ios-chrome'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  const safari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox/i.test(ua)
  if (/Macintosh/i.test(ua) && safari) return touch > 1 ? 'ios' : 'mac-safari'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

/** Η πλατφόρμα αυτού του περιηγητή. Εκτός περιηγητή: υπολογιστής. */
export function currentPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop'
  let standalone = false
  try { standalone = !!window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true } catch { /* παλιός περιηγητής */ }
  return platformOf(navigator.userAgent || '', standalone, navigator.maxTouchPoints || 0)
}

const DENIED_EL: Record<Platform, [string, string]> = {
  'desktop': [
    'Το μικρόφωνο είναι κλειστό για την εφαρμογή. Πάτησε το λουκέτο δίπλα στη διεύθυνση, επίτρεψε το Μικρόφωνο και δοκίμασε ξανά.',
    'Το μικρόφωνο είναι κλειστό για την εφαρμογή. Πατήστε το λουκέτο δίπλα στη διεύθυνση, επιτρέψτε το Μικρόφωνο και δοκιμάστε ξανά.'],
  'ios': [
    'Το μικρόφωνο είναι κλειστό για την εφαρμογή. Πάτησε «aA» στη γραμμή διεύθυνσης, μετά Ρυθμίσεις ιστοτόπου, επίτρεψε το Μικρόφωνο και δοκίμασε ξανά.',
    'Το μικρόφωνο είναι κλειστό για την εφαρμογή. Πατήστε «aA» στη γραμμή διεύθυνσης, μετά Ρυθμίσεις ιστοτόπου, επιτρέψτε το Μικρόφωνο και δοκιμάστε ξανά.'],
  'android': [
    'Το μικρόφωνο είναι κλειστό για την εφαρμογή. Πάτησε το εικονίδιο αριστερά από τη διεύθυνση, μετά Άδειες, επίτρεψε το Μικρόφωνο και δοκίμασε ξανά.',
    'Το μικρόφωνο είναι κλειστό για την εφαρμογή. Πατήστε το εικονίδιο αριστερά από τη διεύθυνση, μετά Άδειες, επιτρέψτε το Μικρόφωνο και δοκιμάστε ξανά.'],
  'mac-safari': [
    'Το μικρόφωνο είναι κλειστό για την εφαρμογή. Στο μενού Safari άνοιξε Ρυθμίσεις, μετά Ιστότοποι και Μικρόφωνο, επίτρεψέ το για αυτή τη σελίδα και δοκίμασε ξανά.',
    'Το μικρόφωνο είναι κλειστό για την εφαρμογή. Στο μενού Safari ανοίξτε Ρυθμίσεις, μετά Ιστότοποι και Μικρόφωνο, επιτρέψτε το για αυτή τη σελίδα και δοκιμάστε ξανά.'],
  'ios-chrome': [
    'Το μικρόφωνο είναι κλειστό για τον Chrome. Άνοιξε τις Ρυθμίσεις του iPhone, μετά Chrome, άνοιξε το Μικρόφωνο και δοκίμασε ξανά.',
    'Το μικρόφωνο είναι κλειστό για τον Chrome. Ανοίξτε τις Ρυθμίσεις του iPhone, μετά Chrome, ανοίξτε το Μικρόφωνο και δοκιμάστε ξανά.'],
  'pwa': [
    `Το μικρόφωνο είναι κλειστό για την εφαρμογή. Άνοιξε τις ρυθμίσεις της συσκευής για το ${PRODUCT_NAME}, επίτρεψε το Μικρόφωνο και δοκίμασε ξανά.`,
    `Το μικρόφωνο είναι κλειστό για την εφαρμογή. Ανοίξτε τις ρυθμίσεις της συσκευής για το ${PRODUCT_NAME}, επιτρέψτε το Μικρόφωνο και δοκιμάστε ξανά.`],
  'pwa-desktop': [
    'Το μικρόφωνο είναι κλειστό για την εφαρμογή. Άνοιξε το μενού του παραθύρου (⋮ ή …), μετά Πληροφορίες εφαρμογής, επίτρεψε το Μικρόφωνο και δοκίμασε ξανά.',
    'Το μικρόφωνο είναι κλειστό για την εφαρμογή. Ανοίξτε το μενού του παραθύρου (⋮ ή …), μετά Πληροφορίες εφαρμογής, επιτρέψτε το Μικρόφωνο και δοκιμάστε ξανά.'],
}
const DENIED_EN: Record<Platform, string> = {
  'desktop': 'The microphone is blocked for this site. Click the lock icon next to the address, allow Microphone and try again.',
  'ios': 'The microphone is blocked for this site. Tap "aA" in the address bar, then Site Settings, allow Microphone and try again.',
  'android': 'The microphone is blocked for this site. Tap the icon left of the address, then Permissions, allow Microphone and try again.',
  'mac-safari': 'The microphone is blocked for this site. In the Safari menu open Settings, then Websites and Microphone, allow it for this page and try again.',
  'ios-chrome': 'The microphone is blocked for Chrome. Open iPhone Settings, then Chrome, turn on Microphone and try again.',
  'pwa': `The microphone is blocked for this app. Open your device settings for ${PRODUCT_NAME}, allow Microphone and try again.`,
  'pwa-desktop': 'The microphone is blocked for this app. Open the window menu (⋮ or …), then App info, allow Microphone and try again.',
}

export function errorMessage(error: DictationError, opts: { lang?: string; formal?: boolean; platform?: Platform } = {}): string {
  const platform = opts.platform ?? 'desktop'
  if (isEnglish(opts.lang || '')) {
    switch (error) {
      case 'denied': return DENIED_EN[platform]
      case 'no-speech': return 'I did not hear anything. Tap the microphone and speak.'
      case 'no-mic': return 'No microphone found. Connect one and try again.'
      case 'network': return 'Dictation needs an internet connection. Try again in a moment.'
      case 'language': return 'Your browser cannot recognise this language.'
      case 'unsupported': return 'Your browser does not support dictation. Try Chrome, Edge or Safari.'
      case 'other': return 'Dictation stopped unexpectedly. Try again.'
    }
  }
  const f = !!opts.formal
  switch (error) {
    case 'denied': return DENIED_EL[platform][f ? 1 : 0]
    case 'no-speech': return f
      ? 'Δεν άκουσα κάτι. Πατήστε το μικρόφωνο και μιλήστε.'
      : 'Δεν άκουσα κάτι. Πάτησε το μικρόφωνο και μίλα.'
    case 'no-mic': return f
      ? 'Δεν βρέθηκε μικρόφωνο. Συνδέστε ένα και δοκιμάστε ξανά.'
      : 'Δεν βρέθηκε μικρόφωνο. Σύνδεσε ένα και δοκίμασε ξανά.'
    case 'network': return f
      ? 'Η υπαγόρευση θέλει σύνδεση στο διαδίκτυο. Δοκιμάστε ξανά σε λίγο.'
      : 'Η υπαγόρευση θέλει σύνδεση στο διαδίκτυο. Δοκίμασε ξανά σε λίγο.'
    case 'language': return 'Ο περιηγητής δεν αναγνωρίζει ελληνική ομιλία.'
    case 'unsupported': return f
      ? 'Ο περιηγητής σας δεν υποστηρίζει υπαγόρευση. Δοκιμάστε Chrome, Edge ή Safari.'
      : 'Ο περιηγητής σου δεν υποστηρίζει υπαγόρευση. Δοκίμασε Chrome, Edge ή Safari.'
    case 'other': return f
      ? 'Η υπαγόρευση σταμάτησε απρόσμενα. Δοκιμάστε ξανά.'
      : 'Η υπαγόρευση σταμάτησε απρόσμενα. Δοκίμασε ξανά.'
  }
}

// ── Το κείμενο που ακούστηκε ──────────────────────────────────────────────

/**
 * Ολο το κείμενο της συνεδρίας, ξαναχτισμένο από την αρχή σε κάθε συμβάν.
 *
 * Ο περιηγητής στέλνει τη λίστα ΟΛΩΝ των αποτελεσμάτων της συνεδρίας και το
 * `resultIndex` λέει από πού άλλαξε. Η άθροιση από το `resultIndex` μόνο
 * διπλασιάζει λέξεις όταν ένα ενδιάμεσο αποτέλεσμα ξαναστέλνεται ως τελικό.
 * Το ξαναχτίσιμο από το μηδέν δεν μπορεί να διπλασιάσει τίποτα.
 */
export function transcriptOf(e: SpeechEvent): { final: string; interim: string } {
  const finals: string[] = []
  const interims: string[] = []
  const res = e.results
  if (res) {
    for (let i = 0; i < res.length; i++) {
      const t = (res[i]?.[0]?.transcript || '').trim()
      if (!t) continue
      if (res[i].isFinal) finals.push(t); else interims.push(t)
    }
  }
  return { final: finals.join(' '), interim: interims.join(' ') }
}

/** Λέξεις που λέγονται και γράφονται ως σημεία στίξης, όπως στην υπαγόρευση του Google. */
const SPOKEN_EL: [RegExp, string][] = [
  [/(?<!\p{L})(νέα παράγραφος|νέα παράγραφο)(?!\p{L})/giu, '\n\n'],
  [/(?<!\p{L})(νέα γραμμή|αλλαγή γραμμής)(?!\p{L})/giu, '\n'],
  [/(?<!\p{L})άνω κάτω τελεία(?!\p{L})/giu, ':'],
  [/(?<!\p{L})τελεία(?!\p{L})/giu, '.'],
  [/(?<!\p{L})κόμμα(?!\p{L})/giu, ','],
  [/(?<!\p{L})ερωτηματικό(?!\p{L})/giu, ';'],
  [/(?<!\p{L})θαυμαστικό(?!\p{L})/giu, '!'],
]
const SPOKEN_EN: [RegExp, string][] = [
  [/(?<!\p{L})new paragraph(?!\p{L})/giu, '\n\n'],
  [/(?<!\p{L})new line(?!\p{L})/giu, '\n'],
  [/(?<!\p{L})(full stop|period)(?!\p{L})/giu, '.'],
  [/(?<!\p{L})comma(?!\p{L})/giu, ','],
  [/(?<!\p{L})question mark(?!\p{L})/giu, '?'],
  [/(?<!\p{L})exclamation mark(?!\p{L})/giu, '!'],
  [/(?<!\p{L})colon(?!\p{L})/giu, ':'],
]

/** Τα σημεία που κλείνουν πρόταση. Το ελληνικό ερωτηματικό γράφεται «;». */
const SENTENCE_END = /[.!?;]\s*$|\n\s*$/

/** Κεφαλαίο το πρώτο γράμμα. Με `toUpperCase` και όχι με ελληνική τοπική ρύθμιση: εκείνη σβήνει τον τόνο («ά» σε «Α»), ενώ στο αρχικό κεφαλαίο ο τόνος μένει («Ά»). */
const capFirst = (s: string): string => s.replace(/\p{L}/u, ch => ch.toUpperCase())

/**
 * Η στίξη που ειπώθηκε με λέξεις γίνεται σημείο, χωρίς κενό πριν και με ένα
 * κενό μετά. Η πρόταση μετά από τελεία ξεκινά με κεφαλαίο.
 */
export function formatSpoken(text: string, lang: string): string {
  let t = ` ${text} `
  for (const [re, mark] of isEnglish(lang) ? SPOKEN_EN : SPOKEN_EL) t = t.replace(re, mark)
  t = t
    .replace(/[ \t]+([.,;:!?])/g, '$1')       // κανένα κενό πριν από σημείο
    .replace(/([.,;:!?])(?=[^\s.,;:!?\d])/g, '$1 ') // ένα κενό μετά
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]+|[ \t]+$/g, '')
  // Κεφαλαίο μετά από τέλος πρότασης μέσα στο ίδιο κομμάτι.
  t = t.replace(/([.!?;]\s+|\n)(\p{Ll})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
  return t
}

/** Πεδίο που δέχεται υπαγόρευση: η τιμή του και η επιλογή τη στιγμή που ξεκίνησε. */
export interface InsertionPoint {
  value: string
  start: number
  end: number
  /** Πολλές γραμμές. Στα μονογραμμικά, η «νέα γραμμή» γίνεται κενό. */
  multiline: boolean
}

/**
 * Φτιάχνει τη συνάρτηση που βάζει το κείμενο στη θέση του δρομέα.
 *
 * Η θέση παγώνει τη στιγμή που πατήθηκε το μικρόφωνο. Κάθε νέο αποτέλεσμα
 * ξαναγράφει ΜΟΝΟ το κομμάτι ανάμεσα, οπότε τα ενδιάμεσα αποτελέσματα
 * διορθώνονται επιτόπου χωρίς να συσσωρεύονται. Ό,τι ήταν επιλεγμένο
 * αντικαθίσταται, όπως με την πληκτρολόγηση.
 */
export function composer(at: InsertionPoint): (spoken: string) => { value: string; caret: number } {
  const start = Math.max(0, Math.min(at.start, at.value.length))
  const end = Math.max(start, Math.min(at.end, at.value.length))
  const before = at.value.slice(0, start)
  const after = at.value.slice(end)
  return (spoken: string) => {
    let text = at.multiline ? spoken : spoken.replace(/\s*\n+\s*/g, ' ')
    if (!text) return { value: before + after, caret: before.length }
    if (!before.trim() || SENTENCE_END.test(before)) text = capFirst(text)
    const lead = before && !/\s$/.test(before) && !/^[.,;:!?\n]/.test(text) ? ' ' : ''
    const trail = after && !/^[\s.,;:!?]/.test(after) ? ' ' : ''
    const inserted = lead + text + trail
    return { value: before + inserted + after, caret: before.length + lead.length + text.length }
  }
}

/**
 * Ο συγγραφέας ενός πεδίου για μία συνεδρία: γράφει ΜΟΝΟ πάνω σε τιμή που
 * έγραψε ο ίδιος.
 *
 * ΓΙΑΤΙ. Οταν ο χρήστης αρχίσει να πληκτρολογεί, η υπαγόρευση σταματά. Ομως
 * το `stop()` του περιηγητή παραδίδει ακόμη ένα τελικό αποτέλεσμα για τον ήχο
 * που είχε ήδη πιάσει. Ο ελληνικός IME βγάζει κι αυτός συμβάντα `input`.
 * Εκείνο το τελευταίο αποτέλεσμα χτιζόταν από την τιμή της στιγμής που πατήθηκε
 * το μικρόφωνο και έσβηνε όσα πληκτρολογήθηκαν στο μεταξύ. Τώρα, μόλις η τιμή
 * του πεδίου διαφέρει από την τελευταία που γράψαμε, ο συγγραφέας παραιτείται
 * για όλη τη συνεδρία: η πληκτρολόγηση κερδίζει πάντα.
 */
export function fieldWriter(at: InsertionPoint): {
  apply(spoken: string, current: string): { value: string; caret: number } | null
} {
  const compose = composer(at)
  let expected: string | null = at.value
  return {
    apply(spoken, current) {
      if (expected === null || current !== expected) { expected = null; return null }
      const r = compose(spoken)
      expected = r.value
      return r
    },
  }
}

// ── Η συνεδρία ────────────────────────────────────────────────────────────

export interface SessionOptions {
  lang: string
  /**
   * Συνεχής ακρόαση με δικό μας χρονόμετρο σιωπής, ώστε μια παύση για σκέψη
   * να μην κόβει τη φράση. Η Νόα θέλει το αντίθετο: σταματά στην πρώτη παύση
   * για να απαντήσει. Στο Android η συνεχής λειτουργία ξαναστέλνει τα
   * τελικά αποτελέσματα, οπότε εκεί κλείνει πάντα.
   */
  continuous?: boolean
  /** Πόση σιωπή μετά την τελευταία λέξη σταματά την ακρόαση. */
  silenceMs?: number
  /** Πόση σιωπή χωρίς ΚΑΜΙΑ λέξη σταματά με «δεν άκουσα κάτι». */
  noSpeechMs?: number
  onState: (s: DictationState) => void
  /** Ολο το κείμενο ως τώρα, με στίξη: τελικό και ενδιάμεσο μαζί. */
  onText: (text: string, final: string) => void
  /** Τέλος συνεδρίας: το τελικό κείμενο (ίσως κενό) και το σφάλμα, αν υπήρξε. */
  onEnd: (final: string, error: DictationError | null) => void
}

export interface Session { stop(): void; abort(): void }

const isAndroid = (): boolean =>
  typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '')

/**
 * Ξεκινά μία συνεδρία. Επιστρέφει `null` όπου ο περιηγητής δεν έχει
 * αναγνώριση ομιλίας· ο καλών το έχει ήδη κρύψει, αλλά η μηχανή δεν το υποθέτει.
 */
export function startSession(o: SessionOptions): Session | null {
  const SR = speechRecognizer()
  let state = reduce(IDLE, { type: 'start' })
  const set = (e: DictationEvent) => { state = reduce(state, e); o.onState(state) }
  if (!SR) {
    o.onState(state)
    set({ type: 'error', error: 'unsupported' })
    o.onEnd('', 'unsupported')
    return null
  }
  const continuous = o.continuous !== false && !isAndroid()
  const silenceMs = o.silenceMs ?? 2500
  const noSpeechMs = o.noSpeechMs ?? 8000

  let rec: SpeechRecognizer
  try { rec = new SR() } catch {
    o.onState(state)
    set({ type: 'error', error: 'unsupported' })
    o.onEnd('', 'unsupported')
    return null
  }
  rec.lang = o.lang
  rec.interimResults = true
  rec.continuous = continuous
  rec.maxAlternatives = 1

  let final = ''
  let ended = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const arm = (ms: number, then: () => void) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(then, ms)
  }
  const disarm = () => { if (timer) { clearTimeout(timer); timer = null } }
  const finish = () => {
    if (ended) return
    ended = true
    disarm()
    set({ type: 'end' })
    o.onEnd(final, state.error)
  }

  rec.onresult = (e: SpeechEvent) => {
    if (ended) return
    const t = transcriptOf(e)
    final = formatSpoken(t.final, o.lang)
    const all = formatSpoken([t.final, t.interim].filter(Boolean).join(' '), o.lang)
    if (all) set({ type: 'result' })
    o.onText(all, final)
    // Η σιωπή μετρά από την τελευταία λέξη, όχι από την αρχή.
    if (continuous) arm(silenceMs, () => { try { rec.stop() } catch { finish() } })
  }
  rec.onerror = (ev: SpeechErrorEvent) => {
    const err = errorFromCode(ev?.error)
    if (err) set({ type: 'error', error: err })
  }
  rec.onend = finish

  o.onState(state)
  try { rec.start() } catch {
    set({ type: 'error', error: 'other' })
    finish()
    return null
  }
  // Ο περιηγητής δεν έχει συμβάν «άνοιξε το μικρόφωνο» κοινό σε όλους· η
  // αναγνώστρια που ξεκίνησε χωρίς εξαίρεση ακούει.
  set({ type: 'audio' })
  arm(noSpeechMs, () => {
    if (state.heard) return
    set({ type: 'error', error: 'no-speech' })
    try { rec.stop() } catch { finish() }
  })

  return {
    stop() { disarm(); try { rec.stop() } catch { finish() } },
    // ΧΩΡΙΣ ΚΕΙΜΕΝΟ. Το abort σημαίνει «ο χρήστης έφυγε» (κλείσιμο οθόνης,
    // πληκτρολόγηση): ό,τι είχε ακουστεί δεν παραδίδεται, αλλιώς η Νόα θα
    // έστελνε ερώτηση από σελίδα που ο χρήστης έχει ήδη αφήσει.
    abort() {
      disarm()
      final = ''
      try { if (rec.abort) rec.abort(); else rec.stop() } catch { /* ήδη κλειστή */ }
      finish()
    },
  }
}
