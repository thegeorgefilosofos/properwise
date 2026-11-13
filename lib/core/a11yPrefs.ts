// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΡΥΘΜΙΣΕΙΣ ΠΡΟΣΒΑΣΙΜΟΤΗΤΑΣ: ΜΙΑ ΕΓΓΡΑΦΗ, ΜΙΑ ΑΝΑΓΝΩΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Μέγεθος κειμένου, υψηλή αντίθεση, λιγότερη κίνηση και ανάγνωση ποσών. Ζουν
// στον περιηγητή (localStorage) γιατί αφορούν τη ΣΥΣΚΕΥΗ: το μεγάλο κείμενο
// που χρειάζεσαι στο κινητό δεν το θέλεις απαραίτητα στην οθόνη του γραφείου.
//
// ΤΑ ΠΑΛΙΑ ΚΛΕΙΔΙΑ ΔΙΑΒΑΖΟΝΤΑΙ. Πριν από αυτό το αρχείο υπήρχαν δύο σκέτοι
// διακόπτες, `po_large_text` και `po_reduce_motion`. Οποιος τους είχε ανάψει
// τους βρίσκει ανοιχτούς και εδώ, χωρίς να τους ξαναψάξει.
//
// ΕΦΑΡΜΟΖΟΝΤΑΙ ΠΡΙΝ ΤΟ ΠΡΩΤΟ PAINT. Το `A11Y_INIT_SCRIPT` μπαίνει στο σενάριο
// του θέματος (app/layout.tsx) και γράφει τις ίδιες ιδιότητες με το
// `applyA11y`. Οι δύο εκδοχές ελέγχονται μαζί στο a11yPrefs.test.ts.
// ═══════════════════════════════════════════════════════════════════════════

export type TextSize = 'normal' | 'large' | 'xlarge'
export type MotionPref = 'system' | 'reduce'

export interface A11yPrefs {
  text: TextSize
  contrast: boolean
  motion: MotionPref
  /** Κουμπί «Άκουσε» δίπλα στα βασικά ποσά. */
  speakAmounts: boolean
}

export const A11Y_KEY = 'po_a11y'
export const LEGACY_LARGE = 'po_large_text'
export const LEGACY_MOTION = 'po_reduce_motion'

export const A11Y_DEFAULTS: A11yPrefs = Object.freeze({
  text: 'normal', contrast: false, motion: 'system', speakAmounts: false,
}) as A11yPrefs

const TEXT: readonly TextSize[] = ['normal', 'large', 'xlarge']

/**
 * Από ωμό κείμενο σε ρυθμίσεις. Ό,τι δεν διαβάζεται γίνεται προεπιλογή,
 * πεδίο προς πεδίο: μια χαλασμένη τιμή δεν σβήνει τις υπόλοιπες.
 *
 * @param legacy οι τιμές των δύο παλιών κλειδιών, όταν η νέα εγγραφή λείπει
 */
export function parseA11y(raw: string | null, legacy?: { large?: string | null; motion?: string | null }): A11yPrefs {
  let o: Record<string, unknown> = {}
  if (raw) {
    try {
      const v = JSON.parse(raw)
      if (v && typeof v === 'object' && !Array.isArray(v)) o = v as Record<string, unknown>
    } catch { /* χαλασμένο: προεπιλογές */ }
  } else if (legacy) {
    if (legacy.large === '1') o.text = 'large'
    if (legacy.motion === '1') o.motion = 'reduce'
  }
  return {
    text: TEXT.includes(o.text as TextSize) ? (o.text as TextSize) : A11Y_DEFAULTS.text,
    contrast: o.contrast === true,
    motion: o.motion === 'reduce' ? 'reduce' : 'system',
    speakAmounts: o.speakAmounts === true,
  }
}

export const serializeA11y = (p: A11yPrefs): string => JSON.stringify({
  text: p.text, contrast: p.contrast, motion: p.motion, speakAmounts: p.speakAmounts,
})

/** Οι ιδιότητες στο <html>. Οι προεπιλογές ΑΦΑΙΡΟΥΝ την ιδιότητα, δεν γράφουν «normal». */
export function a11yAttributes(p: A11yPrefs): Record<'data-text' | 'data-contrast' | 'data-motion', string | null> {
  return {
    'data-text': p.text === 'normal' ? null : p.text,
    'data-contrast': p.contrast ? 'high' : null,
    'data-motion': p.motion === 'reduce' ? 'reduce' : null,
  }
}

/** Γράφει τις ιδιότητες σε ένα στοιχείο (στην πράξη το <html>). */
export function applyA11y(el: { setAttribute(n: string, v: string): void; removeAttribute(n: string): void }, p: A11yPrefs): void {
  for (const [name, value] of Object.entries(a11yAttributes(p))) {
    if (value == null) el.removeAttribute(name); else el.setAttribute(name, value)
  }
}

/**
 * Το ίδιο, ως σενάριο που τρέχει πριν την ενυδάτωση. Γραμμένο σε ES5 και
 * χωρίς εισαγωγές: εκτελείται ως κείμενο μέσα στο <head>.
 */
export const A11Y_INIT_SCRIPT = `
  try {
    var a = localStorage.getItem(${JSON.stringify(A11Y_KEY)}), p = {};
    if (a) { try { p = JSON.parse(a) || {}; } catch (e) {} }
    else {
      if (localStorage.getItem(${JSON.stringify(LEGACY_LARGE)}) === '1') p.text = 'large';
      if (localStorage.getItem(${JSON.stringify(LEGACY_MOTION)}) === '1') p.motion = 'reduce';
    }
    var r = document.documentElement;
    if (p.text === 'large' || p.text === 'xlarge') r.setAttribute('data-text', p.text);
    if (p.contrast === true) r.setAttribute('data-contrast', 'high');
    if (p.motion === 'reduce') r.setAttribute('data-motion', 'reduce');
  } catch (e) {}
`
