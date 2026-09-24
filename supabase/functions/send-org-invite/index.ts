// ─────────────────────────────────────────────────────────────────────────
// send-org-invite — στέλνει πραγματικό email πρόσκλησης σε νέο μέλος ομάδας.
// Καλείται από την εφαρμογή (ο ιδιοκτήτης του οργανισμού) αμέσως μετά το
// invite_org_member. Η πρόσκληση στη βάση παραμένει η πηγή αλήθειας· αυτό το
// email είναι η φιλική ειδοποίηση προς τον προσκεκλημένο.
//
// Ασφάλεια (least privilege): εκτελείται με το JWT του καλούντος (όχι service
// role). Επιβεβαιώνει ότι ο καλών είναι ιδιοκτήτης οργανισμού και ότι το email
// ανήκει όντως σε προσκεκλημένο μέλος του (RLS), ώστε να μη γίνεται εργαλείο
// αποστολής σε αυθαίρετες διευθύνσεις.
//
// Ενεργοποίηση:
//   supabase functions deploy send-org-invite
//   (RESEND_API_KEY / SUPABASE_URL / SUPABASE_ANON_KEY υπάρχουν ήδη)
// ─────────────────────────────────────────────────────────────────────────

import { emailShell, eyebrow, h, p, button } from '../_shared/emailTemplates.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import { APP_URL } from '../_shared/site.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON  = Deno.env.get('SUPABASE_ANON_KEY')!
const FROM_EMAIL     = Deno.env.get('RESEND_FROM') || 'PROPERWISE <onboarding@resend.dev>'
const SIGNUP_URL     = `${APP_URL}/signup`

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const roleLabel = (r: string) => (r === 'admin' ? 'Διαχειριστής' : 'Μέλος')
const esc = (s: string) => s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] as string))

function inviteEmail(orgName: string, inviter: string, role: string): { subject: string; html: string } {
  const org = orgName ? esc(orgName) : 'μια ομάδα στο PROPERWISE'
  const who = inviter ? esc(inviter) : 'Ο διαχειριστής της ομάδας'
  // Το θέμα είναι απλό κείμενο: το esc() εκεί θα έγραφε «&amp;» αυτούσιο.
  const subject = orgName ? `Πρόσκληση στην ομάδα «${orgName}»` : 'Πρόσκληση στο PROPERWISE'
  const html = emailShell({
    preheader: `${who} σε προσκάλεσε στο ${org}.`,
    footerNote: 'Ελαβες αυτό το email επειδή προστέθηκες σε ομάδα. Αν δεν το περίμενες, αγνόησέ το. · properwise.gr',
    bodyHtml: eyebrow('Πρόσκληση σε ομάδα')
      + h(`Προσκλήθηκες στο ${org}`)
      + p(`${who} σε προσκάλεσε να συνεργαστείς στο PROPERWISE με ρόλο <strong class="ink" style="color:#1d1d1f;">${roleLabel(role)}</strong>. Δημιούργησε λογαριασμό με αυτό το email και θα βρεις την ομάδα να σε περιμένει.`)
      + button('Δημιουργία λογαριασμού', SIGNUP_URL),
  })
  return { subject, html }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)

  let email = ''
  try { const body = await req.json(); email = String(body?.email || '').trim().toLowerCase() } catch { /* no body */ }
  if (!email || !email.includes('@')) return json({ error: 'invalid_email' }, 400)

  // Client με το JWT του καλούντος: όλα τα queries περνούν από RLS.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, { global: { headers: { Authorization: authHeader } } })

  // ═══ ΤΡΕΙΣ ΕΛΕΓΧΟΙ ΠΟΥ ΕΛΕΓΑΝ ΟΛΟΙ «ΟΧΙ» ΚΑΙ ΓΙΑ ΤΟΝ ΙΔΙΟ ΛΟΓΟ ═══════════
  // Ταυτότητα, κυριότητα οργανισμού, ιδιότητα μέλους: και οι τρεις διάβαζαν
  // μόνο το `data`. Οταν η υπηρεσία ταυτοποίησης ή η βάση δεν απαντούσε, το
  // αποτέλεσμα ήταν κενό — δηλαδή ΤΑΥΤΟΣΗΜΟ με «δεν είσαι συνδεδεμένος», «δεν
  // είσαι ιδιοκτήτης», «δεν είναι μέλος». Ο χρήστης έβλεπε τρία διαφορετικά
  // μηνύματα λάθους για ΕΝΑ πρόβλημα που δεν ήταν δικό του, ξανάγραφε το email
  // του και ξαναδοκίμαζε. Η άρνηση μένει άρνηση· το 503 λέει «ξαναδοκίμασε σε
  // λίγο» αντί για «δεν έχεις δικαίωμα».
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr) {
    console.error('[send-org-invite] η ταυτότητα δεν διαβάστηκε:', userErr)
    return json({ error: 'identity_unavailable', detail: userErr.message }, 503)
  }
  const inviter = userData?.user?.email || ''
  if (!userData?.user) return json({ error: 'unauthorized' }, 401)

  // Ο καλών πρέπει να είναι ιδιοκτήτης οργανισμού (RLS: owner-only select).
  const { data: orgRow, error: orgErr } = await supabase
    .from('organizations').select('id, name').eq('owner_user_id', userData.user.id).maybeSingle()
  if (orgErr) {
    console.error('[send-org-invite] ο οργανισμός δεν διαβάστηκε:', orgErr)
    return json({ error: 'org_unreadable', detail: orgErr.message }, 503)
  }
  if (!orgRow) return json({ error: 'not_owner' }, 403)

  // Το email πρέπει να είναι όντως προσκεκλημένο μέλος αυτού του οργανισμού.
  const { data: member, error: memberErr } = await supabase
    .from('organization_members').select('role, status').eq('org_id', orgRow.id).eq('email', email).maybeSingle()
  if (memberErr) {
    console.error('[send-org-invite] το μέλος δεν διαβάστηκε:', memberErr)
    return json({ error: 'membership_unreadable', detail: memberErr.message }, 503)
  }
  if (!member) return json({ error: 'not_a_member' }, 404)

  // ── ΤΟ «ΠΡΕΠΕΙ ΝΑ ΕΙΝΑΙ ΜΕΛΟΣ» ΔΕΝ ΕΙΝΑΙ ΦΡΑΓΜΟΣ, ΕΙΝΑΙ ΚΥΚΛΟΣ ──────────
  // Ο ίδιος ο καλών φτιάχνει τον οργανισμό, ο ίδιος γράφει το μέλος: το σύνολο
  // των επιτρεπτών παραληπτών είναι ό,τι αποφασίσει εκείνος. Και το όνομα του
  // οργανισμού μπαίνει αυτούσιο στο θέμα και στην επικεφαλίδα του μηνύματος.
  // Χωρίς μετρητή, αυτό ήταν απεριόριστη αποστολή σε οποιαδήποτε διεύθυνση, με
  // κείμενο της επιλογής του αποστολέα, από το επαληθευμένο μας domain.
  //
  // Οι άλλες πέντε συναρτήσεις αποστολής μετρούν ήδη. Αυτή ξεχάστηκε.
  // ΤΟ ΟΡΙΟ ΠΟΥ ΔΕΝ ΜΕΤΡΗΘΗΚΕ ΔΕΝ ΕΙΝΑΙ ΟΡΙΟ ΠΟΥ ΞΕΠΕΡΑΣΤΗΚΕ. Χωρίς το `error`,
  // μια αποτυχία της συνάρτησης —δικαίωμα, μετονομασία ή πεσμένη σύνδεση— έδινε
  // `quota === null`, δηλαδή ακριβώς το ίδιο με «έφτασες τις 20». Ο χρήστης
  // διάβαζε «ξεπεράστηκε το όριο προσκλήσεων» ενώ δεν είχε στείλει καμία —
  // χωρίς τρόπο να το καταλάβει: το 429 λέει «περίμενε», το 500 λέει
  // «κάτι έσπασε». Η κατεύθυνση της αποτυχίας μένει ασφαλής — δεν στέλνουμε —
  // αλλάζει μόνο η αλήθεια της απάντησης.
  const { data: quota, error: quotaErr } = await supabase.rpc('bump_send_quota', {
    p_kind: 'org_invite', p_units: 1, p_max: 20, p_window: '24 hours',
  })
  if (quotaErr) {
    console.error('[send-org-invite] μέτρηση ορίου:', quotaErr)
    return json({ error: 'quota_unavailable', detail: 'Ο έλεγχος ορίου απέτυχε. Δοκίμασε ξανά σε λίγο.' }, 500)
  }
  if (!quota?.allowed) {
    return json({
      error: 'daily_cap',
      detail: 'Ξεπεράστηκε το όριο προσκλήσεων (20 ανά 24 ώρες).',
    }, 429)
  }

  const { subject, html } = inviteEmail(orgRow.name || '', inviter, member.role || 'member')
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: email, subject, html }),
    })
    if (!res.ok) return json({ error: 'send_failed' }, 502)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
  return json({ sent: true })
})
