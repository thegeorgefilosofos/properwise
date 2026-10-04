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
// Η GOOGLE ΜΕΝΕΙ ΠΡΩΤΗ (04.10.2026). Την πρώτη μέρα του συνδέσμου στο bio του
// Instagram, όσοι έβλεπαν μόνο οδηγία στην κορυφή το έλεγαν «δεν μπορώ να μπω με
// Google». Τώρα η οδηγία λέει πρώτα τι να κάνει κανείς και, όπου γίνεται, το
// κάνει με ένα πάτημα. Μόνο όπου δεν υπάρχει τέτοιο κουμπί η Εγγραφή και η
// Σύνδεση (`useEmailFirst`) βάζουν τη φόρμα του email πάνω και την οδηγία κάτω.
// Μία πηγή για Σύνδεση και Εγγραφή, όπως και το σήμα της Google.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useSyncExternalStore } from 'react'
import { Btn } from '@/components/Theme'
import { T } from '@/components/tokens'
import GoogleG from './GoogleG'
import { inAppBrowser, chromeIntent, safariLink } from '@/lib/core/inAppBrowser'
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

/**
 * Η Google μένει η πρώτη επιλογή όπου υπάρχει κουμπί που ανοίγει τη σελίδα στο
 * Safari ή στον Chrome με ένα πάτημα. Μόνο όπου δεν υπάρχει (παλαιότερο iOS,
 * άγνωστη εφαρμογή) η φόρμα του email έρχεται πρώτη: εκεί η Google θέλει
 * μενού και αντιγραφή, το email ένα λεπτό.
 */
export function useEmailFirst() {
  const iab = useInAppBrowser()
  return iab !== null && !iab.android && !iab.safari
}

/** `funnel`: μόνο η εγγραφή μετρά τα βήματά της· η σύνδεση όχι. */
export default function GoogleButton({ onClick, funnel = false }: { onClick: () => void; funnel?: boolean }) {
  const iab = useInAppBrowser()
  const noted = iab !== null
  useEffect(() => { if (funnel && noted) countSignupStep('app_note') }, [funnel, noted])
  if (!iab) {
    return (
      <Btn variant="secondary" field onClick={onClick}>
        <GoogleG />Συνέχισε με Google
      </Btn>
    )
  }
  // Πού ανοίγει η σελίδα: το όνομα του περιηγητή όπου υπάρχει κουμπί, αλλιώς γενικά.
  const target = iab.android ? 'στον Chrome' : iab.safari ? 'στο Safari' : 'στον περιηγητή σου'
  return (
    <div role="note" style={{ padding: '14px 16px', borderRadius: T.radius.inner, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
        <b style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Για σύνδεση με Google, άνοιξε τη σελίδα {target}.</b>{' '}
        Η Google δεν επιτρέπει σύνδεση μέσα από {iab.where}. Αλλιώς, με email είσαι μέσα σε ένα λεπτό.
      </p>
      {iab.android ? (
        <Btn variant="secondary" field href={chromeIntent(window.location.href)} onClick={funnel ? () => countSignupStep('chrome') : undefined}>
          Άνοιγμα στον Chrome
        </Btn>
      ) : iab.safari ? (
        <>
          <Btn variant="secondary" field href={safariLink(window.location.href)}>
            Άνοιγμα στο Safari
          </Btn>
          {/* Κάθε εφαρμογή αποφασίζει μόνη της αν θα περάσει τον σύνδεσμο στο
              σύστημα. Αν τον κρατήσει, μένει ο δρόμος με το χέρι. */}
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text-tertiary)' }}>
            Αν δεν ανοίξει, πάτα τις τρεις τελείες πάνω δεξιά και διάλεξε το άνοιγμα στο Safari.
          </p>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text-tertiary)' }}>
          {iab.ios
            ? 'Πάτα τις τρεις τελείες πάνω δεξιά και διάλεξε το άνοιγμα στο Safari.'
            : 'Άνοιξε το μενού της εφαρμογής και διάλεξε το άνοιγμα στον περιηγητή.'}
        </p>
      )}
    </div>
  )
}
