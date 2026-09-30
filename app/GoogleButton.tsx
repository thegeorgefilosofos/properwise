'use client'
// ═══════════════════════════════════════════════════════════════════════════
// «ΣΥΝΕΧΙΣΕ ΜΕ GOOGLE», ΜΕ ΜΙΑ ΕΞΑΙΡΕΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Μέσα στον ενσωματωμένο περιηγητή του Instagram, του Facebook, του LinkedIn
// κ.ά. η Google αρνείται τη σύνδεση και δείχνει «403: disallowed_useragent».
// Εκεί το κουμπί δεν εμφανίζεται. Στη θέση του μπαίνει οδηγία (στο Android και
// σύνδεσμος για τον Chrome) και ο επισκέπτης συνεχίζει με email στην ίδια σελίδα.
// Μία πηγή για Σύνδεση και Εγγραφή, όπως και το σήμα της Google.
// ═══════════════════════════════════════════════════════════════════════════
import { useSyncExternalStore } from 'react'
import { Btn } from '@/components/Theme'
import GoogleG from './GoogleG'
import { inAppBrowser, chromeIntent } from '@/lib/core/inAppBrowser'

const NEVER_CHANGES = () => () => {}
const readUa = () => navigator.userAgent
// Στον διακομιστή δεν υπάρχει User-Agent περιηγητή: αποδίδεται το κουμπί και
// η οδηγία παίρνει τη θέση του μόλις φορτώσει η σελίδα.
const serverUa = () => ''

export default function GoogleButton({ onClick }: { onClick: () => void }) {
  const iab = inAppBrowser(useSyncExternalStore(NEVER_CHANGES, readUa, serverUa))
  if (!iab) {
    return (
      <Btn variant="secondary" field onClick={onClick}>
        <GoogleG />Συνέχισε με Google
      </Btn>
    )
  }
  return (
    <div role="note" style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
        <b style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Η Google δεν επιτρέπει σύνδεση μέσα από {iab.where}.</b>{' '}
        Συνέχισε με email παρακάτω ή άνοιξε τη σελίδα στον περιηγητή σου.
      </p>
      {iab.android ? (
        <Btn variant="secondary" field href={chromeIntent(window.location.href)}>
          Άνοιγμα στον Chrome
        </Btn>
      ) : (
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text-tertiary)' }}>
          Πάτα τις τρεις τελείες πάνω δεξιά και διάλεξε το άνοιγμα στον περιηγητή.
        </p>
      )}
    </div>
  )
}
