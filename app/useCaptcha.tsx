'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΕΛΕΓΧΟΣ ΚΑΤΑ ΤΩΝ BOTS: ΧΩΡΙΣ ΚΛΕΙΔΙ ΔΕΝ ΜΠΑΙΝΕΙ ΚΑΝ ΣΤΟ ΠΑΚΕΤΟ
// ─────────────────────────────────────────────────────────────────────────
// Το /signup είχε 0,9 KB περιθώριο στο perf:budget και ο έλεγχος πρόσθετε
// 1,7 KB (μέτρηση 11/11/2026, main 33bafbd). Χωρίς κλειδί ο κώδικας δεν
// κάνει τίποτα, άρα δεν έχει λόγο να κατεβαίνει.
//
// Η ΕΠΙΛΟΓΗ ΓΙΝΕΤΑΙ ΣΤΟ BUILD. Το Next γράφει την τιμή του
// `process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY` μέσα στον κώδικα· χωρίς κλειδί
// η συνθήκη γίνεται σταθερά και ο minifier πετά το `useCaptchaLive` μαζί με
// ό,τι φέρνει. Γι' αυτό η συνθήκη γράφεται γυμνή ΕΔΩ και όχι μέσα από
// συνάρτηση που δεν θα διπλωνόταν.
// ═══════════════════════════════════════════════════════════════════════════
import type React from 'react'
import type { Locale } from '@/lib/i18n/locale'
import { useCaptchaLive } from './useCaptchaLive'

export interface Captcha {
  /** Το σημείο του ελέγχου μέσα στη φόρμα· `null` όταν είναι ανενεργός. */
  slot: React.ReactNode
  /** Το διακριτικό: `undefined` αν ο έλεγχος είναι ανενεργός, `null` αν δεν ήρθε. */
  token: () => Promise<string | null | undefined>
  /** Ξανατρέχει ο έλεγχος μετά από κάθε υποβολή. */
  reset: () => void
  /**
   * Τι λέμε όταν το `token()` γύρισε `null`: «δεν φόρτωσε» αν το σενάριο της
   * Cloudflare δεν ήρθε ποτέ (δίκτυο ή επέκταση αποκλεισμού), αλλιώς «δεν
   * ολοκληρώθηκε».
   */
  failMessage: () => string
}

const OFF: Captcha = { slot: null, token: async () => undefined, reset: () => {}, failMessage: () => '' }

/** Χωρίς κλειδί: τίποτα δεν αποδίδεται, τίποτα δεν περιμένει. */
function useCaptchaOff(): Captcha {
  return OFF
}

export const useCaptcha: (locale: Locale) => Captcha =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? useCaptchaLive : useCaptchaOff
