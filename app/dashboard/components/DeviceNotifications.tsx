'use client'

// ═══════════════════════════════════════════════════════════════════════════
// ΕΝΑΣ ΔΙΑΚΟΠΤΗΣ ΓΙΑ ΤΙΣ ΕΙΔΟΠΟΙΗΣΕΙΣ ΤΗΣ ΣΥΣΚΕΥΗΣ, ΚΑΙ ΟΧΙ ΔΥΟ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΠΑΡΑΛΙΓΟ ΝΑ ΓΡΑΦΤΕΙ. Το ημερολόγιο είχε ήδη δικό του «Ειδοποιήσεις
// στη συσκευή» μέσα στο μενού «⋯», που άναβε τις προειδοποιήσεις δέκα λεπτά πριν
// από κάθε ραντεβού όσο η εφαρμογή είναι ανοιχτή. Ενας δεύτερος διακόπτης εδώ,
// με το ίδιο όνομα και άλλο νόημα, θα σήμαινε ότι ο ιδιοκτήτης ανάβει τον έναν,
// βλέπει τον άλλον σβηστό και δεν ξέρει τι ακριβώς λαμβάνει.
//
// ΤΩΡΑ ΕΙΝΑΙ ΕΝΑΣ, ΚΑΙ ΖΕΙ ΕΔΩ. Ανάβει και τα δύο: την άδεια του περιηγητή με τη
// συνδρομή που φέρνει την πρωινή ειδοποίηση με την εφαρμογή ΚΛΕΙΣΤΗ και την
// τοπική προειδοποίηση του ημερολογίου όσο είναι ΑΝΟΙΧΤΗ. Το ημερολόγιο ακούει
// την αλλαγή και ενημερώνεται χωρίς ανανέωση σελίδας.
//
// ΟΤΑΝ Η ΣΥΣΚΕΥΗ ΔΕΝ ΜΠΟΡΕΙ, Ο ΔΙΑΚΟΠΤΗΣ ΔΕΝ ΥΠΑΡΧΕΙ. Ενας διακόπτης που
// αποτυγχάνει πάντα είναι χειρότερος από απουσία λειτουργίας: υπόσχεται.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TT, Btn } from '@/components/Theme'
import { Toggle } from './UIComponents'
import { SetRow, SetGroup } from './SettingsKit'
import * as devices from '@/lib/data/pushSubscriptions'
import { readSubscription, type RawSubscription } from '@/lib/push/subscription'
import {
  pushSupported, pushConfigured, subscribeDevice, unsubscribeDevice,
  currentSubscription, setDeviceNotify,
} from '@/lib/push/client'
import { needsManualInstall } from '@/lib/pwa/install'

/** Τι λέει η οθόνη όταν η απόπειρα δεν πέτυχε. Κάθε λόγος, η δική του κίνηση. */
const REASONS: Record<string, string> = {
  denied: 'Ο περιηγητής δεν έδωσε άδεια. Δίνεται από τις ρυθμίσεις του για αυτή τη σελίδα.',
  failed: 'Η εγγραφή δεν ολοκληρώθηκε. Σε iPhone χρειάζεται πρώτα προσθήκη στην αρχική οθόνη.',
  unsupported: 'Αυτός ο περιηγητής δεν στέλνει ειδοποιήσεις με την εφαρμογή κλειστή.',
  unconfigured: 'Οι ειδοποιήσεις συσκευής δεν είναι ρυθμισμένες σε αυτή την εγκατάσταση.',
  stored: 'Η συνδρομή δεν αποθηκεύτηκε. Δοκίμασε ξανά σε λίγο.',
}

export default function DeviceNotifications({ userId }: { userId: string }) {
  const supabase = createClient()
  const [available, setAvailable] = useState(false)
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [iosHint, setIosHint] = useState(false)
  const [testNote, setTestNote] = useState<{ ok: boolean; text: string } | null>(null)

  // ΤΟ ΑΛΗΘΙΝΟ ΑΝΑΜΜΕΝΟ ΘΕΛΕΙ ΚΑΙ ΤΑ ΔΥΟ: συνδρομή στον περιηγητή ΚΑΙ γραμμή στη
  // βάση. Με μόνο το πρώτο, ο διακομιστής δεν ξέρει πού να στείλει· με μόνο το
  // δεύτερο, στέλνει σε διεύθυνση που ο περιηγητής έχει ήδη ακυρώσει.
  useEffect(() => {
    let alive = true
    ;(async () => {
      // ΣΤΟ iPhone Ο ΔΙΑΚΟΠΤΗΣ ΚΡΥΒΟΤΑΝ ΧΩΡΙΣ ΛΕΞΗ. Στον περιηγητή το Safari δεν
      // έχει `PushManager`, άρα «δεν υποστηρίζεται» και η γραμμή εξαφανιζόταν.
      // Υποστηρίζεται όμως, μόλις μπει στην αρχική οθόνη: αυτό λέμε.
      if (pushConfigured() && needsManualInstall()) { if (alive) setIosHint(true); return }
      if (!pushSupported() || !pushConfigured()) return
      if (alive) setAvailable(true)
      const sub = await currentSubscription()
      if (!alive) return
      if (!sub) { setOn(false); return }
      const known = await devices.has(supabase, userId, sub.endpoint)
      if (alive) setOn(known)
    })()
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Η ΕΠΙΚΕΦΑΛΙΔΑ ΖΕΙ ΕΔΩ, ΟΧΙ ΣΤΟΝ ΓΟΝΕΑ. Όταν η συσκευή δεν μπορεί, το
  // component δεν δείχνει τίποτα· ο τίτλος «Στη συσκευή» όμως γραφόταν από το
  // NotificationSettings και έμενε μόνος του, πάνω από κενό.
  if (iosHint) return (
    <>
      <SetGroup>Στη συσκευή</SetGroup>
      <SetRow
        title="Ειδοποιήσεις στη συσκευή"
        desc={<>Στο iPhone φτάνουν μόνο όταν το PROPERWISE είναι στην αρχική οθόνη. Πάτα <strong style={{ color: 'var(--text-primary)' }}>Κοινή χρήση</strong> στη μπάρα του Safari, μετά <strong style={{ color: 'var(--text-primary)' }}>«Προσθήκη στην οθόνη Αφετηρίας»</strong> και άνοιξέ το από το εικονίδιο. Ο διακόπτης θα είναι εδώ.</>} />
    </>
  )

  if (!available) return null

  async function turnOn() {
    setBusy(true); setNote('')
    const outcome = await subscribeDevice()
    if (!outcome.ok) { setBusy(false); setNote(REASONS[outcome.reason]); return }
    const checked = readSubscription(outcome.subscription.toJSON() as RawSubscription)
    if (!checked) { setBusy(false); setNote(REASONS.failed); return }
    const { error } = await devices.save(supabase, userId, checked, navigator.userAgent)
    setBusy(false)
    if (error) { setNote(REASONS.stored); return }
    setDeviceNotify(true)
    setOn(true)
  }

  async function sendTest() {
    setBusy(true); setTestNote(null)
    try {
      const sub = await currentSubscription()
      const res = await fetch('/api/push/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub?.endpoint ?? '' }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      setTestNote(res.ok
        ? { ok: true, text: 'Στάλθηκε. Αν δεν τη δεις σε λίγα δευτερόλεπτα, έλεγξε τις ειδοποιήσεις του περιηγητή στις ρυθμίσεις του τηλεφώνου.' }
        : { ok: false, text: data.error || 'Η δοκιμή δεν στάλθηκε.' })
    } catch {
      setTestNote({ ok: false, text: 'Χωρίς σύνδεση. Δοκίμασε ξανά όταν έρθει σήμα.' })
    }
    setBusy(false)
  }

  async function turnOff() {
    setBusy(true); setNote('')
    const endpoint = await unsubscribeDevice()
    if (endpoint) await devices.remove(supabase, endpoint)
    setDeviceNotify(false)
    setOn(false)
    setTestNote(null)
    setBusy(false)
  }

  return (<>
    <SetGroup>Στη συσκευή</SetGroup>
    <SetRow
      title="Ειδοποιήσεις στη συσκευή"
      desc="Μία ειδοποίηση το πρωί, μόνο όταν κάτι λήγει σήμερα ή αύριο, ακόμη και με την εφαρμογή κλειστή. Όσο είναι ανοιχτή, προειδοποιεί και δέκα λεπτά πριν από κάθε ραντεβού."
      control={<Toggle on={on} onChange={v => { if (!busy) void (v ? turnOn() : turnOff()) }} />}>
      {note && <div style={{ ...TT.bodySm, color: 'var(--negative)' }}>{note}</div>}
      {on && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
          <Btn onClick={() => { if (!busy) void sendTest() }} disabled={busy}>Στείλε δοκιμαστική ειδοποίηση</Btn>
          {testNote && <div style={{ ...TT.bodySm, color: testNote.ok ? 'var(--text-secondary)' : 'var(--negative)' }}>{testNote.text}</div>}
        </div>
      )}
    </SetRow>
  </>)
}
