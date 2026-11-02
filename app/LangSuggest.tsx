'use client';
// ═══════════════════════════════════════════════════════════════════════════
// «THIS PAGE IS ALSO IN ENGLISH»: ΜΙΑ ΓΡΑΜΜΗ, ΟΧΙ ΑΝΑΚΑΤΕΥΘΥΝΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Ο περιηγητής που δεν μιλά καθόλου ελληνικά, σε ελληνική σελίδα με αγγλικό
// ζεύγος, βλέπει μία διακριτική γραμμή στα αγγλικά. Δεν τον πάμε μόνοι μας:
// η Google ζητά η ίδια διεύθυνση να δίνει την ίδια σελίδα σε όλους. Το αν θα
// φανεί το κρίνει το proxy.ts (κεφαλίδα x-pw-suggest-en).
//
// Και οι δύο κινήσεις θυμούνται την επιλογή (cookie `pw_lang`): «English»
// μεταφέρει και κρατά στα αγγλικά, το «×» λέει «μένω στα ελληνικά» και η
// γραμμή δεν ξαναβγαίνει.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { rememberLocale } from './LangSwitcher';

export default function LangSuggest({ href }: { href: string }) {
  const [shown, setShown] = useState(true);
  if (!shown) return null;
  return (
    <div lang="en" role="region" aria-label="Language" className="po-noprint pw-lang-suggest">
      <p>
        This page is also available in English.{' '}
        <a href={href} hrefLang="en" onClick={() => rememberLocale('en')}>View in English</a>
      </p>
      <button type="button" aria-label="Dismiss" className="pw-lang-suggest-x"
        onClick={() => { rememberLocale('el'); setShown(false); }}>
        <svg aria-hidden="true" focusable="false" width={16} height={16} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
  );
}
