// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΠΟΣΟ ΟΠΩΣ ΛΕΓΕΤΑΙ, ΟΧΙ ΟΠΩΣ ΓΡΑΦΕΤΑΙ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΛΕΞΕΙΣ ΚΑΙ ΟΧΙ ΤΟ ΓΡΑΜΜΕΝΟ ΠΟΣΟ. Η σύνθεση φωνής του συστήματος
// διαβάζει το ίδιο κείμενο αλλιώς σε κάθε συσκευή: μια αγγλική φωνή λέει την
// τελεία «point» και το κόμμα «comma», άλλη μηχανή διαβάζει «ένα, δύο, τρία,
// τέσσερα» και άλλη το «€» δεν το λέει καθόλου. Ποσό που ακούγεται λάθος σε
// εφαρμογή φόρου είναι χειρότερο από ποσό που δεν ακούγεται.
//
// Γι' αυτό το ποσό γράφεται εδώ ολογράφως, με τη σωστή ελληνική γραμματική:
// ουδέτερο για ευρώ και λεπτά («τρία ευρώ», «είκοσι ένα λεπτά»), θηλυκό για
// τις χιλιάδες («τρεις χιλιάδες», «διακόσιες χιλιάδες») και το «εκατόν» όταν
// ακολουθεί αριθμός. Η φωνή διαβάζει λέξεις, που δεν παρερμηνεύονται.
// ═══════════════════════════════════════════════════════════════════════════

type Gender = 'n' | 'f'

const UNITS_N = ['μηδέν', 'ένα', 'δύο', 'τρία', 'τέσσερα', 'πέντε', 'έξι', 'επτά', 'οκτώ', 'εννέα',
  'δέκα', 'έντεκα', 'δώδεκα', 'δεκατρία', 'δεκατέσσερα', 'δεκαπέντε', 'δεκαέξι', 'δεκαεπτά', 'δεκαοκτώ', 'δεκαεννέα']
const TENS = ['', '', 'είκοσι', 'τριάντα', 'σαράντα', 'πενήντα', 'εξήντα', 'εβδομήντα', 'ογδόντα', 'ενενήντα']
const HUNDREDS_N = ['', 'εκατό', 'διακόσια', 'τριακόσια', 'τετρακόσια', 'πεντακόσια', 'εξακόσια', 'επτακόσια', 'οκτακόσια', 'εννιακόσια']

/** Οι μονάδες που αλλάζουν στο θηλυκό. Οι υπόλοιπες είναι ίδιες. */
const FEMININE: Record<string, string> = {
  'ένα': 'μία', 'τρία': 'τρεις', 'τέσσερα': 'τέσσερις', 'δεκατρία': 'δεκατρείς', 'δεκατέσσερα': 'δεκατέσσερις',
}

function unit(n: number, g: Gender): string {
  const w = UNITS_N[n]
  return g === 'f' ? (FEMININE[w] ?? w) : w
}

function hundredWord(h: number, g: Gender, more: boolean): string {
  if (h === 1) return more ? 'εκατόν' : 'εκατό'
  const w = HUNDREDS_N[h]
  return g === 'f' ? w.replace(/α$/, 'ες') : w
}

/** 1 ως 999, στο γένος που ζητείται. */
function under1000(n: number, g: Gender): string {
  const h = Math.floor(n / 100)
  const rest = n % 100
  const out: string[] = []
  if (h) out.push(hundredWord(h, g, rest > 0))
  if (rest >= 20) {
    out.push(TENS[Math.floor(rest / 10)])
    if (rest % 10) out.push(unit(rest % 10, g))
  } else if (rest > 0) {
    out.push(unit(rest, g))
  }
  return out.join(' ')
}

/**
 * Ακέραιος σε λέξεις (0 ως 999.999.999.999). Το γένος αφορά τις μονάδες του
 * τελευταίου τριψήφιου, δηλαδή το ουσιαστικό που ακολουθεί.
 */
export function greekNumberWords(n: number, g: Gender = 'n'): string {
  n = Math.floor(Math.abs(n))
  if (n === 0) return UNITS_N[0]
  const parts: string[] = []
  const billions = Math.floor(n / 1e9)
  const millions = Math.floor((n % 1e9) / 1e6)
  const thousands = Math.floor((n % 1e6) / 1e3)
  const rest = n % 1e3
  if (billions) parts.push(billions === 1 ? 'ένα δισεκατομμύριο' : `${under1000(billions, 'n')} δισεκατομμύρια`)
  if (millions) parts.push(millions === 1 ? 'ένα εκατομμύριο' : `${under1000(millions, 'n')} εκατομμύρια`)
  if (thousands) parts.push(thousands === 1 ? 'χίλια' : `${under1000(thousands, 'f')} χιλιάδες`)
  if (rest) parts.push(under1000(rest, g))
  return parts.join(' ')
}

/**
 * Ποσό σε ευρώ, όπως το λέει άνθρωπος: «χίλια διακόσια τριάντα τέσσερα ευρώ
 * και πενήντα έξι λεπτά». Στρογγυλεύεται στο λεπτό, όπως γράφεται στην οθόνη.
 */
export function spokenEuro(amount: number): string {
  if (!Number.isFinite(amount)) return ''
  const cents = Math.round(Math.abs(amount) * 100)
  const euros = Math.floor(cents / 100)
  const c = cents % 100
  const sign = amount < 0 && cents > 0 ? 'μείον ' : ''
  const e = `${greekNumberWords(euros)} ευρώ`
  if (!c) return sign + e
  const l = `${greekNumberWords(c)} ${c === 1 ? 'λεπτό' : 'λεπτά'}`
  return euros ? `${sign}${e} και ${l}` : sign + l
}
