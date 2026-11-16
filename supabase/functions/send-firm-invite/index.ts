// ─────────────────────────────────────────────────────────────────────────
// send-firm-invite — στέλνει το email της πρόσκλησης σε νέο μέλος λογιστικού
// γραφείου. Καλείται από τον χώρο του γραφείου (FirmView) αμέσως μετά το
// `firm_invite`. Η γραμμή στο `firm_members` μένει η πηγή αλήθειας: αν το
// email δεν φύγει, η πρόσκληση υπάρχει και ο προσκεκλημένος τη βρίσκει μόλις
// συνδεθεί με αυτή τη διεύθυνση.
//
// ΙΔΙΟ ΜΟΝΟΠΑΤΙ ΜΕ ΤΟ send-org-invite: JWT του καλούντος (όχι service role),
// ίδιος αποστολέας και Reply-To, ίδιο κέλυφος, ίδιος μετρητής.
//
// Ασφάλεια:
//   · ταυτότητα από την υπηρεσία ταυτοποίησης, ρόλος και γραφείο από την
//     `my_firm()` με το ίδιο JWT (που ζητά και το δεύτερο βήμα)· το σώμα του
//     αιτήματος δίνει μόνο τη διεύθυνση (_shared/firmInvite.ts)·
//   · μόνο σε εκκρεμή πρόσκληση του δικού του γραφείου·
//   · μετρητής `org_invite` της `bump_send_quota` (20 ανά 24 ώρες, από τη
//     `send_quota_rule` της βάσης): η πρόσκληση μέλους ομάδας είναι το ίδιο
//     είδος αποστολής, οπότε δεν χρειάζεται νέο είδος ούτε νέα μετάβαση·
//   · η απάντηση δεν λέει ποτέ αν η διεύθυνση έχει λογαριασμό.
//
// Ενεργοποίηση: ανεβαίνει με το supabase-deploy.yml όπως οι υπόλοιπες.
// Χρειάζεται τα μυστικά RESEND_API_KEY (χωρίς αυτό απαντά `no_resend_key`, 500)
// και προαιρετικά RESEND_FROM· τα SUPABASE_URL / SUPABASE_ANON_KEY τα δίνει
// η πλατφόρμα.
// ─────────────────────────────────────────────────────────────────────────

import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { senderFrom, REPLY_TO } from '../_shared/sender.mjs'
import { firmInviteEmail, firmInviteVerdict, type MyFirmRow } from '../_shared/firmInvite.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
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
const busy = (error: string) => json({ error, detail: 'Η υπηρεσία δεν απάντησε. Δοκίμασε ξανά σε λίγο.' }, 503)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)

  let email = ''
  try { const body = await req.json(); email = String(body?.email || '').trim().toLowerCase() } catch { /* χωρίς σώμα */ }
  if (!email || !email.includes('@')) return json({ error: 'invalid_email' }, 400)

  // Client με το JWT του καλούντος: όλα περνούν από RLS και από τις
  // συναρτήσεις της βάσης με τα δικά του δικαιώματα.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, { global: { headers: { Authorization: authHeader } } })

  // «Δεν απάντησε» δεν είναι «δεν δικαιούσαι» (βλ. send-org-invite): η άρνηση
  // μένει άρνηση, η σιωπή της υπηρεσίας λέγεται 503.
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr) {
    console.error('[send-firm-invite] η ταυτότητα δεν διαβάστηκε:', userErr)
    return busy('identity_unavailable')
  }
  if (!userData?.user) return json({ error: 'unauthorized' }, 401)

  const { data: firm, error: firmErr } = await supabase.rpc('my_firm')
  if (firmErr) {
    if (/mfa_required/.test(firmErr.message ?? '')) return json({ error: 'mfa_required' }, 403)
    console.error('[send-firm-invite] το γραφείο δεν διαβάστηκε:', firmErr)
    return busy('firm_unreadable')
  }

  const verdict = firmInviteVerdict(firm as MyFirmRow | null, email, userData.user.id)
  if (!verdict.ok) return json({ error: verdict.error }, verdict.status)

  // ΧΩΡΙΣ ΠΑΡΟΧΟ, ΧΩΡΙΣ ΑΠΟΣΤΟΛΗ. Λέγεται ρητά (και πριν από τον μετρητή, για
  // να μην καίει όριο), ώστε η οθόνη να μη γράψει «στάλθηκε» ούτε «απέτυχε».
  if (!RESEND_API_KEY) return json({ error: 'no_resend_key' }, 500)

  // Ο ΜΕΤΡΗΤΗΣ ΠΡΙΝ ΑΠΟ ΤΗΝ ΑΠΟΣΤΟΛΗ. Το σύνολο των επιτρεπτών παραληπτών το
  // ορίζει ο ίδιος ο Υπεύθυνος με τη `firm_invite`· χωρίς όριο θα ήταν
  // απεριόριστη αποστολή από το επαληθευμένο μας domain. Αποτυχία της
  // μέτρησης δεν είναι «έφτασες το όριο»: απαντά 500 και δεν στέλνει.
  const { data: quota, error: quotaErr } = await supabase.rpc('bump_send_quota', {
    p_kind: 'org_invite', p_units: 1, p_max: 20, p_window: '24 hours',
  })
  if (quotaErr) {
    console.error('[send-firm-invite] μέτρηση ορίου:', quotaErr)
    return json({ error: 'quota_unavailable', detail: 'Ο έλεγχος ορίου απέτυχε. Δοκίμασε ξανά σε λίγο.' }, 500)
  }
  if (!quota?.allowed) {
    return json({ error: 'daily_cap', detail: 'Ξεπεράστηκε το ημερήσιο όριο προσκλήσεων. Δοκίμασε ξανά αργότερα.' }, 429)
  }

  const { subject, html } = firmInviteEmail({
    firmName: verdict.firmName, role: verdict.role,
    inviterEmail: userData.user.email || '', inviterName: verdict.inviterName, inviteeEmail: email,
  })
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, reply_to: REPLY_TO, to: email, subject, html }),
    })
    if (!res.ok) {
      console.error('[send-firm-invite] ο πάροχος αρνήθηκε:', res.status)
      return json({ error: 'send_failed' }, 502)
    }
  } catch (err) {
    console.error('[send-firm-invite] αποστολή:', err)
    return json({ error: 'send_failed' }, 502)
  }
  return json({ sent: true })
})
