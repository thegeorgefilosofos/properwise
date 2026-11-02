'use client'
import Link from 'next/link'
import { T } from '@/components/tokens'
import { Btn } from '@/components/Theme'
import { hy } from '@/components/Hyphen'
import { BackLink } from './BackLink'
import { HOME } from '@/lib/auth/redirect'
import { useLocale } from '@/lib/i18n/useLocale'
import { AUTH_EN } from '@/lib/i18n/en/auth'

// ═══════════════════════════════════════════════════════════════════════════
// AlreadySignedIn, ευγενική κατάσταση όταν ο επισκέπτης είναι ήδη συνδεδεμένος
// και ανοίγει τη σελίδα Σύνδεσης/Εγγραφής. Αντί για απότομη ανακατεύθυνση, του
// δίνουμε επιλογή: μετάβαση στον πίνακα ή αποσύνδεση για άλλον/νέο λογαριασμό.
//
// ── ΚΑΙ ΤΡΙΤΗ ΕΠΙΛΟΓΗ: ΠΙΣΩ ΣΤΗΝ ΑΡΧΙΚΗ ────────────────────────────────────
// Δύο κουμπιά και τα δύο δέσμευση: «μπες στον πίνακα» ή «αποσυνδέσου».
// Οποιος ήθελε απλώς να ξαναδεί την αρχική σελίδα δεν είχε δρόμο — το
// λογότυπο ζει στο αριστερό πάνελ, που κρύβεται κάτω από τις 900 και δεν
// είναι σύνδεσμος. Ιδιο αδιέξοδο με την οθόνη «Ανοιξε το email σου», που
// διορθώθηκε ήδη με τον ίδιο σύνδεσμο. Μπαίνει ΕΔΩ και όχι στις δύο σελίδες
// που το καλούν: μία κατάσταση, ένας δρόμος πίσω.
//
// ── ΚΑΙ ΤΟ ΚΥΡΙΟ ΚΟΥΜΠΙ ΠΑΕΙ ΕΚΕΙ ΠΟΥ ΠΗΓΑΙΝΕ Ο ΑΝΘΡΩΠΟΣ ────────────────
// Ηταν πάντα «/dashboard»: ο συνδεδεμένος που ερχόταν με πακέτο ή με «next»
// (π.χ. από τον χώρο του λογιστή) έχανε τον προορισμό του ακριβώς εδώ. Τον
// υπολογίζει η σελίδα που καλεί (lib/auth/continuation.ts)· εδώ μόνο δείχνεται.
// ═══════════════════════════════════════════════════════════════════════════

export default function AlreadySignedIn({
  email, onSignOut, signingOut, mode, next = HOME,
}: {
  email: string; onSignOut: () => void; signingOut: boolean; mode: 'login' | 'signup'
  /** Ο προορισμός του κύριου κουμπιού, ήδη ελεγμένος από το `continuation`. */
  next?: string
}) {
  const home = next === HOME
  const en = useLocale() === 'en', E = AUTH_EN.signedIn
  const enBody = E.body(home, mode === 'signup')
  return (
    <div>
      <BackLink home locale={en ? 'en' : 'el'} />
      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: '0 0 8px' }}>
        {en ? E.title : 'Έχεις ήδη συνδεθεί'}
      </h1>
      {/* ΤΡΕΙΣ ΓΡΑΜΜΕΣ ΜΕ ΡΙΓΜΕΝΗ ΔΕΞΙΑ ΑΚΡΗ, ΣΕ ΣΤΗΛΗ 400 — το `maxWidth: 400`
          της Σύνδεσης και της Εγγραφής που καλούν αυτή την κατάσταση. Μέτρο ~61
          χαρακτήρων στα 13: οι δύο πρώτες γραμμές τελείωναν όπου τύχει και στις
          δύο διατυπώσεις (σύνδεση - εγγραφή). Η στοίχιση κλείνει τη δεξιά άκρη,
          ο συλλαβισμός κρατά τα κενά στο φυσικό τους πλάτος αντί να τα τεντώσει.
          Η διεύθυνση μέσα στο `<strong>` είναι λατινική, μένει ακέραιη. */}
      {en ? <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 28px', textWrap: 'pretty' }}>
        {enBody[0]}<strong style={{ color: 'var(--text-primary)' }}>{email}</strong>{enBody[1]}
      </p> : <p className="po-just" style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 28px' }}>
        {hy(<>Ο λογαριασμός <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> είναι ενεργός σε αυτή τη συσκευή. Μπορείς να συνεχίσεις {home ? 'στον πίνακά σου' : 'εκεί που πήγαινες'}{mode === 'signup'
          ? ' ή, αν θέλεις, να αποσυνδεθείς για να δημιουργήσεις νέο λογαριασμό'
          : ' ή να αποσυνδεθείς για να συνδεθείς με άλλον λογαριασμό'}.</>)}
      </p>}

      <Link href={next} className="auth-cta" style={{ display: 'block', textAlign: 'center', padding: '12px', background: 'var(--accent)', borderRadius: T.radius.pill, color: 'var(--accent-text)', fontSize: 14, fontWeight: 700, textDecoration: 'none', letterSpacing: '-0.01em' }}>
        {home ? (en ? E.open : 'Άνοιξε τον πίνακά σου') : (en ? E.go : 'Συνέχισε')}
      </Link>

      {/* `field` γιατί η ενέργεια κρατά όλο το πλάτος κάτω από το κύριο κουμπί, όπως πριν.
          Το `.auth-hov` έφυγε μαζί με το στυλ: την αιώρηση τη δίνει πλέον το
          `.po-btn[data-variant=secondary]`, που ξέρει και εστίαση με πληκτρολόγιο. */}
      <div style={{ marginTop: 12 }}>
        <Btn variant="secondary" field onClick={onSignOut} disabled={signingOut}>
          {signingOut
            ? (en ? E.signingOut : 'Αποσύνδεση…')
            : mode === 'signup' ? (en ? E.outNew : 'Αποσύνδεση και δημιουργία νέου λογαριασμού') : (en ? E.outSwitch : 'Αποσύνδεση και αλλαγή λογαριασμού')}
        </Btn>
      </div>
    </div>
  )
}
