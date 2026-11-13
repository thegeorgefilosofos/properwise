// ═══════════════════════════════════════════════════════════════════════════
// ΑΝΑΓΝΩΣΗ ΦΩΝΑΧΤΑ, ΜΕ ΤΗ ΦΩΝΗ ΤΟΥ ΣΥΣΤΗΜΑΤΟΣ
// ─────────────────────────────────────────────────────────────────────────
// Το `speechSynthesis` του περιηγητή: χωρίς κλειδί, χωρίς δίκτυο στις περισσότερες
// συσκευές, με τις φωνές που έχει εγκατεστημένες το λειτουργικό. Το
// χρησιμοποιούν η Νόα και το «Άκουσε» δίπλα στα ποσά.
// ═══════════════════════════════════════════════════════════════════════════

/** Υπάρχει σύνθεση φωνής σε αυτόν τον περιηγητή; */
export const ttsSupported = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'

/**
 * Μία ελληνική φωνή, χωρίς φύλο: η πιο ευκρινής που δίνει το σύστημα. Οι φωνές
 * του Google ακούγονται καθαρότερα από τις τοπικές όπου υπάρχουν και τις δύο.
 */
export function pickGreekVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const el = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('el'))
  if (!el.length) return null
  return el.find(v => /Google/i.test(v.name)) || el[0]
}

/**
 * Διαβάζει ένα κείμενο στα ελληνικά. Σταματά ό,τι διαβαζόταν πριν.
 * Επιστρέφει ψευδές όπου δεν υπάρχει σύνθεση φωνής.
 */
export function speakGreek(text: string, on: { start?: () => void; end?: () => void } = {}): boolean {
  if (!ttsSupported() || !text) return false
  try {
    const s = window.speechSynthesis
    s.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const v = pickGreekVoice(s.getVoices())
    if (v) u.voice = v
    u.lang = 'el-GR'
    u.rate = 1
    u.onstart = () => on.start?.()
    u.onend = () => on.end?.()
    u.onerror = () => on.end?.()
    s.speak(u)
    return true
  } catch { return false }
}

export function stopSpeaking(): void {
  try { if (ttsSupported()) window.speechSynthesis.cancel() } catch { /* τίποτα να σταματήσει */ }
}
