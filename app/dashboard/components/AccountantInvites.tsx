'use client'
// Τα αιτήματα πρόσβασης λογιστή προς εμένα. Ζουν σε δικό τους αρχείο γιατί
// φαίνονται σε δύο σημεία: μέσα στη Λογιστική και στην πρώτη οθόνη όποιου δεν
// έχει ακόμη ακίνητο. Το email της πρόσκλησης στέλνει στη Λογιστική και η
// Λογιστική ανοίγει μόνο με επιλεγμένο ακίνητο· χωρίς τη δεύτερη θέση ο πελάτης
// χωρίς ακίνητο δεν έβρισκε πουθενά το «Αποδοχή» ή το «Όχι».

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { T, Btn } from '@/components/Theme'
import { invitesForMe, answerInvite, inviteSender, type ReceivedInvite } from '@/lib/data/accountantInvites'
import { confirmDialog } from '@/components/confirmBus'
import * as accountantLink from '@/lib/data/accountantLink'
import { MFA_REQUIRED } from '@/lib/auth/mfa'
import { notify, notifyError } from '@/components/Toast'
import { FEATURE_MIN_PLAN } from '@/lib/billing/entitlements'
import { PLANS } from '@/lib/billing/plans'

/**
 * Ο ΛΟΓΙΣΤΗΣ ΖΗΤΑ ΠΡΟΣΒΑΣΗ ΚΑΙ ΑΠΟΦΑΣΙΖΕΙ Ο ΠΕΛΑΤΗΣ.
 *
 * Η μαζική πρόσκληση του λογιστή φτάνει εδώ ως μία γραμμή ανά λογιστή. Μέχρι το
 * «Αποδοχή» ο λογιστής δεν βλέπει τίποτα· με το «Αποδοχή» βγαίνει (ή ανανεώνεται)
 * ο ίδιος σύνδεσμος που θα έστελνε ο πελάτης με το χέρι και η σύνδεση γράφεται
 * με αυτόν. Ανακαλείται όπως κάθε άλλη, από τις Ρυθμίσεις.
 *
 * ΠΟΙΟΣ ΡΩΤΑ ΕΙΝΑΙ Η ΔΙΕΥΘΥΝΣΗ ΤΟΥ, ΟΧΙ ΤΟ ΟΝΟΜΑ ΠΟΥ ΕΓΡΑΨΕ (20261021120000).
 * Το όνομα το γράφει ελεύθερα ο αποστολέας· η διεύθυνση είναι επιβεβαιωμένη
 * από τον λογαριασμό του. Η οθόνη δεν λέει «ο λογιστής σου»: δεν το ξέρει. Και
 * το «Αποδοχή» ρωτά ξανά, με τη διεύθυνση γραμμένη, πριν ανοίξει ο φάκελος.
 *
 * ΔΕΝ ΚΑΤΑΛΑΜΒΑΝΕΙ ΧΩΡΟ ΟΤΑΝ ΔΕΝ ΕΧΕΙ ΝΑ ΠΕΙ ΤΙΠΟΤΑ, όπως και τα αιτήματα.
 */
export default function AccountantInvites({ userId, canShare }: { userId: string; canShare: boolean }) {
  const supabase = useMemo(() => createClient(), [])
  const [invites, setInvites] = useState<ReceivedInvite[]>([])
  const [busy, setBusy] = useState('')

  useEffect(() => { void invitesForMe(supabase).then(setInvites) }, [supabase])

  const answer = useCallback(async (inv: ReceivedInvite, accept: boolean) => {
    const { who } = inviteSender(inv)
    if (accept && !await confirmDialog({
      title: `Να βλέπει ο λογαριασμός ${who} τον φάκελό σου;`,
      message: `Θα βλέπει, μόνο για ανάγνωση, ό,τι έχει ο φάκελός σου: ΑΦΜ, ακίνητα, μισθωτήρια, ενοίκια, δαπάνες και τα στοιχεία των ενοικιαστών σου.\nΔέξου μόνο αν γνωρίζεις τον αποστολέα. Την πρόσβαση την ανακαλείς όποτε θέλεις από τις Ρυθμίσεις.`,
      confirmLabel: 'Ναι, δώσε πρόσβαση',
    })) return
    setBusy(inv.id)
    try {
      if (accept) {
        // Ο ΣΥΝΔΕΣΜΟΣ ΠΡΩΤΑ. Η σύνδεση γράφεται με τον ζωντανό σύνδεσμο του
        // πελάτη· η `issue` τον φτιάχνει ή ανανεώνει τη λήξη του υπάρχοντος.
        const link = await accountantLink.issue(supabase, userId)
        if (link === MFA_REQUIRED) { notifyError(accountantLink.MFA_LINK_SAY); return }
        if (!link?.live) { notifyError('Ο σύνδεσμος για τον λογιστή δεν δημιουργήθηκε'); return }
      }
      const r = await answerInvite(supabase, inv.id, accept)
      if (!r.ok) { notifyError(accept ? 'Η αποδοχή δεν ολοκληρώθηκε' : 'Η απάντηση δεν στάλθηκε'); return }
      setInvites(xs => xs.filter(x => x.id !== inv.id))
      if (accept) notify(`Ο λογαριασμός ${who} βλέπει πλέον τον φάκελό σου, μόνο για ανάγνωση`)
    } finally { setBusy('') }
  }, [supabase, userId])

  if (invites.length === 0) return null

  return (
    <div style={{ margin: '16px 0 0', paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
      <p style={{ fontWeight: 600, fontSize: 'var(--fs-base)', lineHeight: 1.3, color: 'var(--text-tertiary)', margin: 0, fontFamily: T.font.sans }}>
        {invites.length === 1 ? 'Αίτημα πρόσβασης στον φάκελό σου' : `${invites.length} αιτήματα πρόσβασης στον φάκελό σου`}
      </p>
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', margin: '6px 0 0', fontFamily: T.font.sans, lineHeight: 1.5 }}>
        {'Δέξου μόνο αν γνωρίζεις τον αποστολέα. Η διεύθυνση είναι του λογαριασμού που ρωτά· το όνομα το έγραψε ο ίδιος.'}
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'grid', gap: 0 }}>
        {invites.map(inv => { const { who, claimed } = inviteSender(inv); return (
          <li key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', fontFamily: T.font.sans, lineHeight: 1.5, minWidth: 0, overflowWrap: 'anywhere' }}>
              {who}
              <span style={{ color: 'var(--text-tertiary)' }}>{`${claimed ? ` · δηλώνει «${claimed}»` : ''} · ζητά να βλέπει τον φάκελό σου, μόνο για ανάγνωση`}</span>
              {!canShare && (
                <span style={{ display: 'block', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>
                  {`Ο σύνδεσμος για τον λογιστή περιλαμβάνεται από το πακέτο «${PLANS[FEATURE_MIN_PLAN.e2_export].name}» και πάνω.`}
                </span>
              )}
            </span>
            <span style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" onClick={() => void answer(inv, true)} disabled={!canShare || busy === inv.id}>Αποδοχή</Btn>
              <Btn variant="ghost" onClick={() => void answer(inv, false)} disabled={busy === inv.id}>Όχι</Btn>
            </span>
          </li>
        ) })}
      </ul>
    </div>
  )
}
