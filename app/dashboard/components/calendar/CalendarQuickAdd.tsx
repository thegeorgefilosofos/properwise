'use client'
// ═══════════════════════════════════════════════════════════════════════════
// «ΒΑΛΕ ΤΙΣ ΠΡΟΘΕΣΜΙΕΣ ΣΤΟ ΚΙΝΗΤΟ ΣΟΥ», ΕΚΕΙ ΟΠΟΥ ΦΑΙΝΟΝΤΑΙ ΟΙ ΠΡΟΘΕΣΜΙΕΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΔΕΝ ΠΗΓΑΙΝΕ (αξιολόγηση χρήστη 20.10.2026). Η συνδρομή ημερολογίου ζούσε
// στον «Λογαριασμό → Δεδομένα και απόρρητο» δίπλα στη διαγραφή λογαριασμού
// και στο μενού «⋯» του Ημερολογίου. Ο ιδιοκτήτης που θέλει «να μη χάνει
// προθεσμίες» βλέπει τις προθεσμίες στην Επισκόπηση και στο Ημερολόγιο· εκεί
// πρέπει να βρίσκει και το ένα πάτημα που τις φέρνει στο κινητό του.
//
// ΕΝΑ ΠΑΤΗΜΑ, ΟΧΙ ΑΝΤΙΓΡΑΦΗ. Το «Google» ανοίγει την οθόνη προσθήκης του Google
// Calendar με τη διεύθυνση έτοιμη· το «Apple / Outlook» παραδίδει `webcal:` στο
// ημερολόγιο της συσκευής, που γράφει ΣΥΝΔΡΟΜΗ και ανανεώνεται μόνη της.
//
// ΦΕΥΓΕΙ ΜΟΝΗ ΤΗΣ. Οταν ένα ημερολόγιο διαβάσει πράγματι τη διεύθυνση
// (`last_fetched_at`, το γράφει η /imerologio), η πρόταση δεν ξαναφαίνεται: μια
// πρόταση για κάτι που έγινε ήδη είναι θόρυβος. Χωρίς διεύθυνση, ή όσο
// διαβάζεται, δεν αποδίδεται τίποτα.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as feedStore from '@/lib/data/calendarFeed'
import { T, Btn } from '@/components/Theme'
import { Calendar, CalendarDays, CalendarPlus } from 'lucide-react'

// ═══ ΜΙΑ ΦΟΡΑ ΑΝΑ ΟΘΟΝΗ ════════════════════════════════════════════════════
// Ο ιδιοκτήτης είδε την ίδια πρόταση δύο φορές στην Επισκόπηση (21/10/2026),
// μία πάνω από τη Νόα και μία μέσα στην ατζέντα. Οποια κι αν είναι η δεύτερη
// διαδρομή που την προσαρτά, η πρόταση δεν επαναλαμβάνεται: όσο υπάρχει μία
// ορατή, κάθε επόμενη αποδίδει τίποτα.
let shownBy: symbol | null = null

export function CalendarQuickAdd({ userId, framed = false }: {
  userId: string
  /** Με δικό του περίγραμμα (Ημερολόγιο) ή ως τελευταία γραμμή κάρτας (Επισκόπηση). */
  framed?: boolean
}) {
  const [row, setRow] = useState<feedStore.FeedRow | null>(null)
  const [first, setFirst] = useState(false)

  useEffect(() => {
    let live = true
    const me = Symbol('calendar-quick-add')
    feedStore.feed(createClient(), userId).then(({ row: r }) => {
      if (!live) return
      if (shownBy === null) { shownBy = me; setFirst(true) }
      setRow(r)
    })
    return () => { live = false; if (shownBy === me) shownBy = null }
  }, [userId])

  if (!first || !row?.token || feedStore.feedConnected(row)) return null

  const box = framed
    ? { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, padding: '10px 16px' }
    : { borderTop: '1px solid var(--border-subtle)', padding: '12px 18px' }

  return (
    <div style={{ ...box, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 220px', minWidth: 0 }}>
        <CalendarPlus size={15} color="var(--accent)" aria-hidden="true" style={{ flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)', fontFamily: T.font.sans }}>
          Βάλε τις προθεσμίες στο ημερολόγιο του κινητού σου. Μία φορά, μετά ενημερώνεται μόνο του.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn href={feedStore.feedGoogleUrl(row.token)} newTab><Calendar size={15} />Google</Btn>
        <Btn href={feedStore.feedSubscribeUrl(row.token)}><CalendarDays size={15} />Apple / Outlook</Btn>
      </div>
    </div>
  )
}
