// ─────────────────────────────────────────────────────────────────────────
// send-test-notification — στέλνει ΠΡΑΓΜΑΤΙΚΟ δοκιμαστικό email ειδοποίησης, ώστε
// ο χρήστης να επιβεβαιώσει ότι όντως φτάνει στα εισερχόμενά του (όχι απλός
// έλεγχος μορφής). Καλείται από τις Ρυθμίσεις → Ειδοποιήσεις («Δοκιμή»).
//
// Ασφάλεια: εκτελείται με το JWT του καλούντος (όχι service role). Στέλνει ΕΝΑ
// email στη διεύθυνση που όρισε ο ίδιος ο συνδεδεμένος χρήστης.
//
// Ενεργοποίηση:
//   supabase functions deploy send-test-notification
//   (RESEND_API_KEY / SUPABASE_URL / SUPABASE_ANON_KEY υπάρχουν ήδη)
// ─────────────────────────────────────────────────────────────────────────

import { NO_RESEND_KEY } from '../_shared/resendKey.ts'
// Τα δύο μηνύματα ζουν στο _shared/noticeEmails.ts, στη γλώσσα του κατόχου του λογαριασμού.
import { testEmailHtml, confirmEmailHtml } from '../_shared/noticeEmails.ts'
import { msgLangOfMeta } from '../_shared/msgLang.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import { APP_URL } from '../_shared/site.ts'
import { senderFrom, REPLY_TO } from '../_shared/sender.mjs'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON  = Deno.env.get('SUPABASE_ANON_KEY')!
const FROM_EMAIL     = senderFrom(Deno.env.get('RESEND_FROM'))

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr) {
    console.error('[send-test-notification] η ταυτότητα δεν διαβάστηκε:', userErr)
    return json({ error: 'identity_unavailable', detail: 'Η υπηρεσία δεν απάντησε. Δοκίμασε ξανά σε λίγο.' }, 503)
  }
  if (!userData?.user) return json({ error: 'unauthorized' }, 401)

  // ── ΠΟΤΕ ΔΕΝ ΣΤΕΛΝΕΤΑΙ ΔΙΕΥΘΥΝΣΗ ΑΠΟ ΤΟ ΣΩΜΑ ΤΟΥ ΑΙΤΗΜΑΤΟΣ ────────────────
  // Δύο πράγματα μπορεί να ζητήσει αυτή η function και κανένα από τα δύο δεν
  // δέχεται παραλήπτη από τον πελάτη:
  //
  //   • ΔΟΚΙΜΗ, στη διεύθυνση του ΙΔΙΟΥ του λογαριασμού. Την επαλήθευσε η εγγραφή.
  //   • ΕΠΙΒΕΒΑΙΩΣΗ, στη διεύθυνση που ο χρήστης ΑΠΟΘΗΚΕΥΣΕ στις ρυθμίσεις — και
  //     τη διαβάζουμε από τη ΒΑΣΗ, όχι από το αίτημα.
  //
  // Έτσι ο πελάτης δεν μπορεί να διαλέξει παραλήπτη ούτε περιεχόμενο: το κείμενο
  // και στις δύο περιπτώσεις είναι δικό μας και σταθερό.
  const accountEmail = String(userData.user.email || '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail)) return json({ error: 'invalid_email' }, 400)

  // Ποια διεύθυνση θέλει να επιβεβαιώσει; Το ερώτημα εκδίδει και το διακριτικό.
  // ΑΠΟΤΥΧΙΑ ΕΔΩ ΔΕΝ ΕΙΝΑΙ «ΔΕΝ ΕΧΕΙ ΑΠΟΘΗΚΕΥΜΕΝΗ ΔΙΕΥΘΥΝΣΗ». Χωρίς το `error`,
  // το `issued` ερχόταν κενό, το `saved` έμενε '' και το `needsConfirm` έπεφτε
  // σε `false`: η function έστελνε ΔΟΚΙΜΗ στη διεύθυνση του λογαριασμού αντί για
  // ΕΠΙΒΕΒΑΙΩΣΗ στη διεύθυνση που ζήτησε ο χρήστης — και το διακριτικό δεν
  // εκδόθηκε ποτέ. Ο χρήστης έβλεπε «στάλθηκε», περίμενε το email επιβεβαίωσης
  // στην άλλη του διεύθυνση και δεν ερχόταν τίποτα.
  const { data: issued, error: issuedErr } = await supabase.rpc('issue_reminder_email_token')
  if (issuedErr) {
    console.error('[send-test-notification] το διακριτικό δεν εκδόθηκε:', issuedErr)
    return json({ error: 'token_not_issued', detail: 'Η υπηρεσία δεν απάντησε. Δοκίμασε ξανά σε λίγο.' }, 503)
  }
  const row = (Array.isArray(issued) ? issued[0] : issued) as { email?: string; token?: string } | null
  const saved = String(row?.email || '').trim()
  const needsConfirm = !!saved && saved.toLowerCase() !== accountEmail.toLowerCase()
  const email = needsConfirm ? saved : accountEmail

  if (!RESEND_API_KEY) return json({ error: 'no_resend_key', detail: NO_RESEND_KEY }, 500)

  // ── Δέκα μηνύματα την ημέρα και τέλος ───────────────────────────────────
  // Ο παραλήπτης είναι είτε η διεύθυνση του λογαριασμού είτε η αποθηκευμένη και
  // το κείμενο είναι δικό μας και στις δύο περιπτώσεις — άρα δεν είναι
  // αναμεταδότης. Ήταν όμως ΑΠΕΡΙΟΡΙΣΤΟΣ: ένας βρόχος στην κονσόλα του
  // φυλλομετρητή χρέωνε τον λογαριασμό Resend όσο αντέχει η γραμμή και έκαιγε
  // τη φήμη αποστολής του domain με χιλιάδες πανομοιότυπα μηνύματα.
  //
  // Δέκα είναι γενναιόδωρο για μια δοκιμή που ή δουλεύει ή δεν δουλεύει.
  // Ιδιο με την πρόσκληση οργανισμού: «έφτασες τις 10» και «ο έλεγχος έσπασε»
  // δεν επιτρέπεται να είναι η ίδια απάντηση — πόσο μάλλον σε οθόνη που
  // υπάρχει για να ΔΙΑΓΝΩΣΕΙ γιατί δεν φτάνουν ειδοποιήσεις.
  const { data: quota, error: quotaErr } = await supabase.rpc('bump_send_quota', {
    p_kind: 'test_notification', p_units: 1, p_max: 10, p_window: '24 hours',
  })
  if (quotaErr) {
    console.error('[send-test-notification] μέτρηση ορίου:', quotaErr)
    return json({ error: 'quota_unavailable', detail: 'Ο έλεγχος ορίου απέτυχε. Δοκίμασε ξανά σε λίγο.' }, 500)
  }
  if (!quota?.allowed) {
    return json({
      error: 'daily_cap',
      detail: 'Έφτασες τις 10 δοκιμαστικές ειδοποιήσεις για σήμερα. Αν δεν έφτασε καμία, το πρόβλημα δεν είναι η δοκιμή.',
      resetsAt: quota?.resets_at ?? null,
    }, 429)
  }

  const { subject, html } = needsConfirm
    ? confirmEmailHtml(`${APP_URL}/epivevaiosi-email/${row?.token}`, accountEmail, msgLangOfMeta(userData.user.user_metadata))
    : testEmailHtml(msgLangOfMeta(userData.user.user_metadata))
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, reply_to: REPLY_TO, to: email, subject, html }),
    })
    if (!res.ok) {
      // Επίστρεψε το πραγματικό μήνυμα του Resend (π.χ. sandbox: μόνο η δική σου
      // διεύθυνση επιτρέπεται χωρίς επαληθευμένο domain), για σαφή διάγνωση.
      const detail = await res.text().catch(() => '')
      return json({ error: 'send_failed', status: res.status, detail: detail.slice(0, 500) }, 502)
    }
  } catch (err) {
    return json({ error: 'fetch_failed', detail: String(err) }, 500)
  }
  return json({ sent: true, mode: needsConfirm ? 'confirm' : 'test', to: email })
})
