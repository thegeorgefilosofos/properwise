'use client';

// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΛΩΤΗ ΠΡΟΣΚΛΗΣΗ ΕΓΚΑΤΑΣΤΑΣΗΣ, ΣΕ ΔΙΚΟ ΤΗΣ ΚΟΜΜΑΤΙ
// ─────────────────────────────────────────────────────────────────────────
// Φορτώνεται μόνο τη στιγμή που θα φανεί. Το PwaProvider ζει στο ριζικό
// layout, οπότε ό,τι γράφεται εκεί το κατεβάζει κάθε σελίδα· η δημόσια
// «καθαρή απόδοση» δεν έχει ούτε byte περιθώριο. Το μήνυμα το βλέπει ένας
// χρήστης δύο φορές στη ζωή του: δεν δικαιούται θέση στην πρώτη φόρτωση.
//
// ΔΥΟ ΜΟΡΦΕΣ. Στο Android και στους υπολογιστές ο περιηγητής έχει δικό του
// παράθυρο και το κουμπί το ανοίγει. Στο iPhone δεν υπάρχει τέτοιο παράθυρο:
// το μόνο που δουλεύει είναι να του δείξουμε πού να πατήσει και να του πούμε
// τι κερδίζει που εκεί είναι και οι ειδοποιήσεις.
// ═══════════════════════════════════════════════════════════════════════════

import { T } from '@/components/tokens';
import { Btn, RuntimeImg } from '@/components/Theme';
import { navLabel } from '@/lib/nav/labels';

/** Το εικονίδιο της «Κοινής χρήσης» του Safari: κουτί με βέλος προς τα πάνω. */
function ShareGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ verticalAlign: '-2px' }}>
      <path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

export default function InstallBanner({ mode, onInstall, onDismiss, note = '', busy = false }: {
  mode: 'prompt' | 'ios' | 'notify';
  onInstall: () => void;
  onDismiss: () => void;
  /** Γιατί δεν άνοιξαν οι ειδοποιήσεις, όταν δεν άνοιξαν. */
  note?: string;
  busy?: boolean;
}) {
  const asks = mode !== 'ios';
  // Κάθεται εκεί που κάθεται κάθε πλωτό στοιχείο (Toast, MonthlyFeedbackNudge).
  // Με 16px από το κάτω άκρο και z-index 900, στο κινητό έπεφτε πάνω στην κάτω
  // πλοήγηση, που έχει κι αυτή 900: σκέπαζε τα εικονίδιά της.
  return (
    <div role="dialog" aria-label={mode === 'notify' ? 'Ειδοποιήσεις' : 'Εγκατάσταση εφαρμογής'}
      style={{ position: 'fixed', left: 16, right: 16, bottom: 'var(--float-bottom)', zIndex: 'var(--float-z)', maxWidth: 420, margin: '0 auto', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.modal, boxShadow: 'var(--shadow-xl)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, fontFamily: T.font.sans }}>
      {/* ── ΤΟ `next/image` ΕΔΩ ΚΟΣΤΙΖΕΙ ΠΕΡΙΣΣΟΤΕΡΟ ΑΠ' ΟΣΟ ΓΛΙΤΩΝΕΙ ──────────
          Δοκιμάστηκε όταν το μήνυμα ζούσε στο ριζικό layout: 161,9 KB →
          177,5 KB και έσπασε ο προϋπολογισμός βάρους. Για ένα PNG 40×40 από τον
          δημόσιο φάκελο δεν υπάρχει τίποτα να βελτιστοποιηθεί. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <RuntimeImg src="/icons/icon-192.png" alt="" width={40} height={40} style={{ borderRadius: 10, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{mode === 'notify' ? 'Άνοιξε τις ειδοποιήσεις' : 'Βάλ’ το στην αρχική οθόνη'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.4, marginTop: 2 }}>{mode === 'notify' ? 'Ένα τελευταίο βήμα' : 'PROPERWISE, σαν εφαρμογή'}</div>
        </div>
      </div>
      {mode === 'notify' ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Για ό,τι λήγει: ΕΝΦΙΑ, ενοίκια που δεν μπήκαν, συμβόλαια και λογαριασμοί.
          {`Τις κλείνεις όποτε θέλεις από την καρτέλα «${navLabel('settings')}».`}
        </p>
      ) : mode === 'prompt' ? (
        <p className="po-just" style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          Ανοίγει με ένα πάτημα, σε πλήρη οθόνη και χωρίς μπάρα διεύθυνσης. Βολικό όταν φωτογραφίζεις έναν λογαριασμό εκεί που βρίσκεσαι.
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Πάτα <strong style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}><ShareGlyph /> Κοινή χρήση</strong> στην
          μπάρα του περιηγητή και μετά <strong style={{ color: 'var(--text-primary)' }}>«Προσθήκη στην οθόνη Αφετηρίας»</strong>.
          Στο iPhone μόνο έτσι φτάνουν οι ειδοποιήσεις για ό,τι λήγει.
        </p>
      )}
      {note && <p role="status" style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{note}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: asks ? '1fr 1fr' : '1fr', gap: 8 }}>
        {asks && (
          <Btn variant="primary" onClick={onInstall} disabled={busy}>
            {mode === 'notify' ? (busy ? 'Άνοιγμα…' : 'Άνοιγμα') : 'Εγκατάσταση'}
          </Btn>
        )}
        <Btn onClick={onDismiss}>{asks ? 'Όχι τώρα' : 'Εντάξει'}</Btn>
      </div>
    </div>
  );
}
