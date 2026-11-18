'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Η ΓΛΩΣΣΑ ΤΟΥ ΛΟΓΑΡΙΑΣΜΟΥ ΑΚΟΛΟΥΘΕΙ ΤΟΝ ΧΡΗΣΤΗ ΣΕ ΚΑΘΕ ΣΥΣΚΕΥΗ
// ─────────────────────────────────────────────────────────────────────────
// Η σελίδα αποδίδεται στη γλώσσα του cookie `pw_lang` (proxy.ts), γιατί
// μόνο αυτό φτάνει στον διακομιστή πριν από την απόδοση. Η ΕΠΙΛΟΓΗ όμως
// ανήκει στον λογαριασμό: οι Ρυθμίσεις τη γράφουν και στο `user_metadata`
// (lib/i18n/locale.ts, LOCALE_META_KEY), όπως και η αγγλική εγγραφή.
//
// Αν η συσκευή διαφωνεί με τον λογαριασμό (νέο κινητό, καθαρισμένα cookies,
// εγγραφή από το /en), το cookie διορθώνεται και η σελίδα ξαναφορτώνει ΜΙΑ
// φορά. Η σημαία της συνεδρίας κόβει τον βρόχο όταν ο περιηγητής δεν κρατά
// cookies: τότε η σελίδα μένει όπως αποδόθηκε, χωρίς ατέρμονη ανανέωση.
// Λογαριασμός χωρίς επιλογή δεν αλλάζει τίποτα: τα ελληνικά μένουν.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from 'react'
import { metaLocale, type Locale } from '@/lib/i18n/locale'
import { rememberAppLocale } from '@/lib/i18n/appEn'

const SYNC_FLAG = 'pw_lang_sync'

export function useAccountLocale(user: { user_metadata?: Record<string, unknown> | null } | null, locale: Locale): void {
  const want = metaLocale(user?.user_metadata)
  useEffect(() => {
    if (!want) return
    // Συμφωνούν: η σημαία φεύγει, ώστε μια μελλοντική διαφωνία να διορθωθεί κι αυτή.
    if (want === locale) { try { sessionStorage.removeItem(SYNC_FLAG) } catch { /* χωρίς αποθήκευση */ } return }
    try {
      if (sessionStorage.getItem(SYNC_FLAG) === want) return
      sessionStorage.setItem(SYNC_FLAG, want)
    } catch { return }
    rememberAppLocale(want)
    window.location.reload()
  }, [want, locale])
}
