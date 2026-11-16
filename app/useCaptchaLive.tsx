'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΕΛΕΓΧΟΣ ΚΑΤΑ ΤΩΝ BOTS ΜΕΣΑ ΣΤΙΣ ΦΟΡΜΕΣ: ΑΟΡΑΤΟΣ ΟΣΟ ΔΕΝ ΧΡΕΙΑΖΕΤΑΙ (ενεργή έκδοση)
// ─────────────────────────────────────────────────────────────────────────
// Ο κανόνας και το γιατί: lib/auth/captcha.ts. Εδώ μόνο η απόδοση.
//
// ΔΕΝ ΜΑΚΡΑΙΝΕΙ ΤΗ ΦΟΡΜΑ. `appearance: 'interaction-only'`: ο επισκέπτης δεν
// βλέπει τίποτα, εκτός αν η Cloudflare ζητήσει ρητή επιβεβαίωση. Τότε μόνο
// εμφανίζεται το πλαίσιο, πάνω από το κουμπί υποβολής.
//
// ΤΟ ΣΕΝΑΡΙΟ ΦΟΡΤΩΝΕΤΑΙ ΑΠΟ ΚΩΔΙΚΑ, ΟΧΙ ΑΠΟ <script> ΣΤΗ ΣΕΛΙΔΑ. Η CSP έχει
// 'strict-dynamic': σενάριο που προσθέτει ένα ήδη εμπιστευμένο σενάριο
// επιτρέπεται, ενώ <script src> γραμμένο στη σελίδα θα ήθελε nonce. Το
// challenges.cloudflare.com μπαίνει στην CSP μόνο όταν υπάρχει κλειδί (proxy.ts).
//
// ΤΟ ΔΙΑΚΡΙΤΙΚΟ ΙΣΧΥΕΙ ΜΙΑ ΦΟΡΑ. Μετά από κάθε υποβολή, επιτυχημένη ή όχι, η
// φόρμα καλεί `reset()` και ο έλεγχος ξανατρέχει για την επόμενη.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useRef } from 'react'
import type { Locale } from '@/lib/i18n/locale'
import type { Captcha } from './useCaptcha'
import { TURNSTILE_SCRIPT, TURNSTILE_SITE_KEY, captchaBlockedMessage, captchaEnabled, captchaFailedMessage, waitForToken } from '@/lib/auth/captcha'

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id?: string) => void
  remove: (id?: string) => void
}
declare global { interface Window { turnstile?: TurnstileApi } }

let loading: Promise<TurnstileApi | null> | null = null

/** Φορτώνει το σενάριο μία φορά για όλη τη σελίδα. */
function loadTurnstile(): Promise<TurnstileApi | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!loading) {
    loading = new Promise(resolve => {
      const s = document.createElement('script')
      s.src = TURNSTILE_SCRIPT
      s.async = true
      s.onload = () => resolve(window.turnstile ?? null)
      s.onerror = () => { loading = null; resolve(null) }
      document.head.appendChild(s)
    })
  }
  return loading
}

/** Ο πραγματικός έλεγχος. Μπαίνει στο πακέτο μόνο όταν υπάρχει κλειδί (app/useCaptcha.tsx). */
export function useCaptchaLive(locale: Locale): Captcha {
  const enabled = captchaEnabled()
  const box = useRef<HTMLDivElement | null>(null)
  const widget = useRef<string | null>(null)
  const current = useRef<string | null>(null)
  // Το σενάριο δεν φόρτωσε: η αναμονή σταματά αμέσως και το μήνυμα λέει γιατί.
  const blocked = useRef(false)

  // ΤΟ ΚΟΥΤΙ ΕΡΧΕΤΑΙ ΚΑΙ ΦΕΥΓΕΙ. Η φόρμα κρύβεται και ξαναφαίνεται: «Γράψε
  // άλλη» μετά την αποστολή, ακύρωση του δεύτερου βήματος στη σύνδεση,
  // αποτυχημένη ανταλλαγή κωδικού στην επαναφορά. Με effect μία φορά στην
  // αρχή, το νέο κουτί έμενε άδειο και η υποβολή περίμενε 10 δευτερόλεπτα για
  // να αποτύχει. Το ref-συνάρτηση αποδίδει το πλαίσιο κάθε φορά που μπαίνει το
  // κουτί και το αφαιρεί όταν βγαίνει· με αλλαγή γλώσσας αλλάζει ταυτότητα, άρα
  // ξαναποδίδεται στη νέα γλώσσα.
  const attach = useCallback((el: HTMLDivElement | null) => {
    if (widget.current && window.turnstile) window.turnstile.remove(widget.current)
    widget.current = null
    current.current = null
    box.current = el
    if (!el || !enabled) return
    blocked.current = false
    void loadTurnstile().then(api => {
      if (!api) { if (box.current === el) blocked.current = true; return }
      if (box.current !== el || widget.current) return
      widget.current = api.render(el, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'auto',
        language: locale === 'en' ? 'en' : 'el',
        appearance: 'interaction-only',
        size: 'flexible',
        callback: (t: string) => { current.current = t },
        'expired-callback': () => { current.current = null },
        'error-callback': () => { current.current = null },
      })
    })
  }, [enabled, locale])

  const token = useCallback(() => {
    // ΔΕΥΤΕΡΗ ΕΥΚΑΙΡΙΑ ΣΤΟ ΣΕΝΑΡΙΟ. Αν δεν φόρτωσε (δίκτυο, επέκταση που ο
    // χρήστης μόλις απενεργοποίησε), η υποβολή το ξαναζητά πριν περιμένει.
    if (enabled && blocked.current && box.current) attach(box.current)
    return waitForToken(() => current.current, enabled, undefined, undefined, () => blocked.current)
  }, [enabled, attach])
  const reset = useCallback(() => {
    current.current = null
    if (widget.current && window.turnstile) window.turnstile.reset(widget.current)
  }, [])

  // `display: contents`: όσο ο έλεγχος είναι αόρατος, το κουτί δεν πιάνει θέση
  // ούτε προσθέτει κενό στη φόρμα· το πλαίσιο της Cloudflare, όταν φανεί, μπαίνει
  // στη ροή της φόρμας σαν κανονικό στοιχείο της.
  const slot = enabled ? <div ref={attach} style={{ display: 'contents' }} /> : null
  const failMessage = useCallback(
    () => (blocked.current ? captchaBlockedMessage(locale) : captchaFailedMessage(locale)),
    [locale],
  )
  return { slot, token, reset, failMessage }
}
