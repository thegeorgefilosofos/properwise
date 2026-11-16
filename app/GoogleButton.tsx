'use client'
// ═══════════════════════════════════════════════════════════════════════════
// «ΣΥΝΕΧΙΣΕ ΜΕ GOOGLE», ΜΕ ΜΙΑ ΕΞΑΙΡΕΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Μέσα στον ενσωματωμένο περιηγητή του Instagram, του Facebook, του LinkedIn
// κ.ά. η Google αρνείται τη σύνδεση και δείχνει «403: disallowed_useragent».
// Εκεί το κουμπί δεν εμφανίζεται. Στη θέση του μπαίνει οδηγία, με κουμπί που
// ανοίγει τη σελίδα στον Chrome (Android) ή στο Safari (iOS 17 και νεότερο) και
// ο επισκέπτης μπορεί να συνεχίσει με email στην ίδια σελίδα.
//
// ΣΤΗΝ ΕΦΑΡΜΟΓΗ ΤΟ EMAIL ΕΡΧΕΤΑΙ ΠΡΩΤΟ (13.11.2026). Ως τότε η οδηγία για τη
// Google έμενε πρώτη όπου υπήρχε κουμπί προς Safari ή Chrome. Το χωνί μιας
// εβδομάδας: 3 επισκέψεις από το Instagram, 3 φορές η οδηγία, καμία υποβολή.
// Το πλαίσιο της οδηγίας έπιανε ~340px και έσπρωχνε το πεδίο του email στην
// κάτω άκρη της οθόνης (y=792 σε 812). Τώρα σε κάθε ενσωματωμένο περιηγητή η
// φόρμα του email είναι πάνω και η οδηγία, με το κουμπί της, από κάτω.
// Μία πηγή για Σύνδεση και Εγγραφή, όπως και το σήμα της Google.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useSyncExternalStore } from 'react'
import { useAuthEn } from '@/lib/i18n/authEn'
import { Btn } from '@/components/ThemeCore'
import { T } from '@/components/tokens'
import GoogleG from './GoogleG'
import { inAppBrowser, chromeIntent, safariLink, emailFirst } from '@/lib/core/inAppBrowser'
import { countSignupStep } from '@/lib/analytics/signupFunnel'

const NEVER_CHANGES = () => () => {}
const readUa = () => navigator.userAgent
// Στον διακομιστή δεν υπάρχει User-Agent περιηγητή: αποδίδεται το κουμπί και
// η οδηγία παίρνει τη θέση του μόλις φορτώσει η σελίδα.
const serverUa = () => ''

/** Ο ενσωματωμένος περιηγητής, αν υπάρχει. Στον διακομιστή πάντα `null`. */
export function useInAppBrowser() {
  return inAppBrowser(useSyncExternalStore(NEVER_CHANGES, readUa, serverUa))
}

/** Μέσα σε εφαρμογή η Google δεν δουλεύει: η φόρμα του email έρχεται πρώτη (`emailFirst`). */
export function useEmailFirst() {
  return emailFirst(useInAppBrowser())
}

/** `funnel`: μόνο η εγγραφή μετρά τα βήματά της· η σύνδεση όχι. */
export default function GoogleButton({ onClick, funnel = false }: { onClick: () => void; funnel?: boolean }) {
  const iab = useInAppBrowser()
  const A = useAuthEn(), E = A?.inApp
  const noted = iab !== null
  useEffect(() => { if (funnel && noted) countSignupStep('app_note') }, [funnel, noted])
  if (!iab) {
    return (
      <Btn variant="secondary" field onClick={onClick}>
        <GoogleG />{A ? A.google : 'Συνέχισε με Google'}
      </Btn>
    )
  }
  // Πού ανοίγει η σελίδα: το όνομα του περιηγητή όπου υπάρχει κουμπί, αλλιώς γενικά.
  const target = E
    ? (iab.android ? E.chrome : iab.safari ? E.safari : E.browser)
    : iab.android ? 'στον Chrome' : iab.safari ? 'στο Safari' : 'στον περιηγητή σου'
  return (
    <div role="note" style={{ padding: '14px 16px', borderRadius: T.radius.inner, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
        {E ? <><b style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{E.title(target)}</b>{' '}{E.body}</> : <>
        <b style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Για σύνδεση με Google, άνοιξε τη σελίδα {target}.</b>{' '}
        Η Google δεν επιτρέπει σύνδεση μέσα από {iab.where}. Με το email από πάνω δεν χρειάζεται να φύγεις.</>}
      </p>
      {iab.android ? (
        <Btn variant="secondary" field href={chromeIntent(window.location.href)} onClick={funnel ? () => countSignupStep('chrome') : undefined}>
          {E ? E.openChrome : 'Άνοιγμα στον Chrome'}
        </Btn>
      ) : iab.safari ? (
        <>
          <Btn variant="secondary" field href={safariLink(window.location.href)}>
            {E ? E.openSafari : 'Άνοιγμα στο Safari'}
          </Btn>
          {/* Κάθε εφαρμογή αποφασίζει μόνη της αν θα περάσει τον σύνδεσμο στο
              σύστημα. Αν τον κρατήσει, μένει ο δρόμος με το χέρι. */}
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text-tertiary)' }}>
            {E ? E.safariHint : 'Αν δεν ανοίξει, πάτα τις τρεις τελείες πάνω δεξιά και διάλεξε το άνοιγμα στο Safari.'}
          </p>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text-tertiary)' }}>
          {E ? (iab.ios ? E.menuSafari : E.menuBrowser) : iab.ios
            ? 'Πάτα τις τρεις τελείες πάνω δεξιά και διάλεξε το άνοιγμα στο Safari.'
            : 'Άνοιξε το μενού της εφαρμογής και διάλεξε το άνοιγμα στον περιηγητή.'}
        </p>
      )}
    </div>
  )
}
