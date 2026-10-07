// ─────────────────────────────────────────────────────────────────────────
// send-client-email — μαζική & αυτοματοποιημένη επικοινωνία με πελάτες μέσω
// Resend. Δέχεται θέμα + ΚΕΙΜΕΝΟ + λίστα παραληπτών, στέλνει σε παρτίδες (batch API,
// έως 100/κλήση), κάνει personalization ({{name}}, {{email}}), βάζει reply-to τη
// διεύθυνση του ιδιοκτήτη (οι απαντήσεις πελατών πάνε σ' αυτόν) και καταγράφει
// αποτέλεσμα ανά παραλήπτη στους πίνακες email_campaigns / email_recipients.
//
// ΤΟ HTML ΤΟ ΓΡΑΦΕΙ Ο ΔΙΑΚΟΜΙΣΤΗΣ (06.10.2026). Ως τώρα το `bodyHtml` του
// αιτήματος έφευγε αυτούσιο από τη διεύθυνσή μας: όποιος είχε «Επαγγελματία»
// έστελνε ό,τι HTML ήθελε στους «πελάτες» που ο ίδιος καταχώρησε. Τώρα φτάνει
// `bodyText`, διαφεύγεται ολόκληρο και γίνεται παράγραφοι στο κοινό κέλυφος,
// με τον λογαριασμό-αποστολέα γραμμένο στο υποσέλιδο (emailTemplates.ts,
// `clientMessageEmail`). Το παλιό `bodyHtml` δεν γίνεται πια δεκτό καθόλου:
// μια ανοιχτή καρτέλα με τον παλιό κώδικα παίρνει 409 και το μήνυμα να
// ανανεώσει τη σελίδα. Η μετατροπή του παλιού HTML σε κείμενο ήταν ακριβώς το
// είδος καθαρισμού με κανονικές εκφράσεις που δεν κλείνει ποτέ πλήρως
// (CodeQL: incomplete multi-character sanitization).
//
// Ασφάλεια: εκτελείται με το JWT του καλούντος (RLS — γράφει μόνο δικές του
// εγγραφές). Το κλειδί Resend μένει server-side (secret), ποτέ στον browser.
//
// Ενεργοποίηση:
//   supabase secrets set RESEND_API_KEY=re_...           (κλειδί Resend)
//   supabase secrets set RESEND_FROM="PROPERWISE <no-reply@to-domain-sou.gr>"
//   supabase functions deploy send-client-email
// ─────────────────────────────────────────────────────────────────────────
import { NO_RESEND_KEY } from '../_shared/resendKey.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { senderFrom } from '../_shared/sender.mjs'
import { clientMessageEmail, fillClientHtml } from '../_shared/emailTemplates.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON  = Deno.env.get('SUPABASE_ANON_KEY')!
// Env-driven αποστολέας: μόλις επαληθεύσεις domain στο Resend, όρισε το RESEND_FROM
// και ΟΛΑ τα emails φεύγουν από τη δική σου διεύθυνση, χωρίς αλλαγή κώδικα.
const FROM_EMAIL     = senderFrom(Deno.env.get('RESEND_FROM'))

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
// Μόνο για το θέμα, που φεύγει ως απλό κείμενο. Το σώμα γεμίζει με το
// `fillClientHtml`, που διαφεύγει την τιμή.
const fill = (tpl: string, r: { name?: string; email: string }) =>
  tpl.replace(/\{\{\s*name\s*\}\}/g, r.name || '').replace(/\{\{\s*email\s*\}\}/g, r.email)

interface Recipient { email: string; name?: string; clientId?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
  if (!RESEND_API_KEY) return json({ error: 'no_resend_key', detail: NO_RESEND_KEY }, 500)

  let subject = '', bodyText = '', kind = 'broadcast', recipients: Recipient[] = [], legacy = false
  try {
    const b = await req.json()
    subject = String(b?.subject || '').trim()
    // Κείμενο, ποτέ HTML.
    if (typeof b?.bodyText === 'string') bodyText = b.bodyText
    else legacy = !!(b?.bodyHtml || b?.html)
    kind = String(b?.kind || 'broadcast')
    recipients = Array.isArray(b?.recipients) ? b.recipients : []
  } catch { return json({ error: 'bad_body' }, 400) }
  if (legacy) return json({ error: 'client_outdated', detail: 'Η εφαρμογή ενημερώθηκε. Ανανέωσε τη σελίδα και στείλε ξανά το μήνυμα.' }, 409)

  // Καθάρισμα/έλεγχος παραληπτών (έγκυρο email, χωρίς διπλότυπα).
  const seen = new Set<string>()
  recipients = recipients
    .map(r => ({ email: String(r?.email || '').trim().toLowerCase(), name: r?.name?.toString().trim(), clientId: r?.clientId }))
    .filter(r => isEmail(r.email) && !seen.has(r.email) && (seen.add(r.email), true))
  if (!subject) return json({ error: 'no_subject' }, 400)
  if (!recipients.length) return json({ error: 'no_recipients' }, 400)
  if (recipients.length > 2000) return json({ error: 'too_many', detail: 'Έως 2000 παραλήπτες ανά αποστολή.' }, 400)

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, { global: { headers: { Authorization: authHeader } } })
  // Η ίδια διάκριση με τους πελάτες πιο κάτω: «δεν είσαι συνδεδεμένος» και «δεν
  // απάντησε η υπηρεσία ταυτοποίησης» έδιναν και τα δύο 401.
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr) {
    console.error('[send-client-email] η ταυτότητα δεν διαβάστηκε:', userErr)
    return json({ error: 'identity_unavailable', detail: 'Η ταυτοποίηση δεν απάντησε. Δοκίμασε ξανά σε λίγο.' }, 503)
  }
  const user = userData?.user
  if (!user) return json({ error: 'unauthorized' }, 401)

  // ── ΤΟ ΠΑΚΕΤΟ ΚΡΙΝΕΤΑΙ ΕΔΩ, ΟΧΙ ΜΟΝΟ ΣΤΗΝ ΟΘΟΝΗ (02.10.2026) ────────────────
  // Το CRM και η αποστολή σε πελάτες είναι του «Επαγγελματία» (rank 3), αλλά η
  // συνάρτηση δεν το ρωτούσε: ένας δωρεάν λογαριασμός έγραφε «πελάτες» μέσω της
  // βάσης και έστελνε δικό του HTML από το domain μας, έως 3.000 την ημέρα.
  const { data: rank, error: rankErr } = await supabase.rpc('my_plan_rank')
  if (rankErr) {
    console.error('[send-client-email] το πακέτο δεν διαβάστηκε:', rankErr)
    return json({ error: 'plan_unavailable', detail: 'Ο έλεγχος πακέτου απέτυχε. Δοκίμασε ξανά σε λίγο.' }, 503)
  }
  if (!(Number(rank) >= 3)) {
    return json({ error: 'plan_required', detail: 'Η αποστολή email σε πελάτες είναι στο πακέτο «Επαγγελματίας».' }, 403)
  }
  const replyTo = user.email || undefined
  // Ο αποστολέας ονομάζεται στο υποσέλιδο με τη ΔΙΕΥΘΥΝΣΗ του λογαριασμού, όχι
  // με όνομα που γράφει ο ίδιος: «Εθνική Τράπεζα» ως όνομα προφίλ δεν περνά.
  const bodyHtml = clientMessageEmail({ text: bodyText, senderEmail: user.email })

  // ── Anti-relay: recipients MUST be the caller's own CRM clients ──────────────
  // Without this, any authenticated account could send arbitrary HTML to an
  // arbitrary list under our sending domain. The caller's JWT already scopes
  // `clients` via RLS; we build the allow-set from it (+ the owner's own address
  // for self-tests) and silently drop anything else, reporting the count.
  // Η ΑΠΟΤΥΧΙΑ ΕΔΩ ΑΠΟΤΥΓΧΑΝΕΙ ΚΛΕΙΣΤΑ ΚΑΙ ΕΙΝΑΙ ΣΩΣΤΟ: κενός κατάλογος
  // επιτρεπτών σημαίνει ότι κόβονται ΟΛΟΙ οι παραλήπτες. Λάθος ήταν μόνο η
  // ΑΙΤΙΑ που διάβαζε ο χρήστης — «οι παραλήπτες πρέπει να είναι καταχωρημένοι
  // πελάτες», ενώ οι δικοί του πελάτες απλώς δεν διαβάστηκαν.
  const { data: myClients, error: clientsErr } = await supabase.from('clients').select('email').eq('user_id', user.id)
  if (clientsErr) {
    console.error('[send-client-email] οι πελάτες δεν διαβάστηκαν:', clientsErr)
    return json({ error: 'clients unreadable', detail: 'Οι πελάτες σου δεν διαβάστηκαν, οπότε δεν στάλθηκε τίποτα. Δοκίμασε ξανά.' }, 500)
  }
  const allow = new Set<string>(
    (myClients || []).map((c: { email: string | null }) => (c.email || '').trim().toLowerCase()).filter(Boolean),
  )
  if (user.email) allow.add(user.email.trim().toLowerCase())
  const requested = recipients.length
  recipients = recipients.filter(r => allow.has(r.email))
  const droppedNotClient = requested - recipients.length
  if (!recipients.length) {
    return json({ error: 'no_permitted_recipients', detail: 'Οι παραλήπτες πρέπει να είναι καταχωρημένοι πελάτες σου στο CRM.' }, 400)
  }

  // ── Ταβάνι όγκου ανά χρήστη, 24 κυλιόμενες ώρες ──────────────────────────────
  // ΤΟ ΜΕΤΡΟΥΣΕ Ο ΜΕΤΡΟΥΜΕΝΟΣ. Το άθροισμα έβγαινε από το `email_campaigns`, που
  // ο χρήστης το διαγράφει (πολιτική `FOR ALL`, `GRANT ALL` στον authenticated):
  // ένα `delete` μηδένιζε το ταβάνι και η επανάληψη έδινε απεριόριστη μαζική
  // αποστολή από το domain μας, με χρέωση στον λογαριασμό μας.
  //
  // Ο μετρητής ζει τώρα στο `send_quota`, που κανένας ρόλος πελάτη δεν αγγίζει.
  // Και εδώ: αν η μέτρηση αποτύχει, ο χρήστης διάβαζε «ξεπέρασες τις 3.000
  // αποστολές» έχοντας στείλει δέκα. Η κατεύθυνση μένει ασφαλής, η αιτία
  // γίνεται αληθινή.
  const { data: quota, error: quotaErr } = await supabase.rpc('bump_send_quota', {
    p_kind: 'client_email', p_units: recipients.length, p_max: 3000, p_window: '24 hours',
  })
  if (quotaErr) {
    console.error('[send-client-email] μέτρηση ορίου:', quotaErr)
    return json({ error: 'quota_unavailable', detail: 'Ο έλεγχος ορίου απέτυχε. Δοκίμασε ξανά σε λίγο.' }, 500)
  }
  if (!quota?.allowed) {
    return json({
      error: 'daily_cap',
      detail: 'Ξεπεράστηκε το ημερήσιο όριο αποστολών (3.000 παραλήπτες / 24ω).',
      resetsAt: quota?.resets_at ?? null,
    }, 429)
  }

  // Καμπάνια + παραλήπτες (RLS — γράφει μόνο δικές του εγγραφές).
  const { data: camp, error: cErr } = await supabase.from('email_campaigns')
    .insert({ user_id: user.id, subject, body_html: bodyHtml, kind, recipient_count: recipients.length, status: 'sending' })
    .select('id').single()
  if (cErr || !camp) return json({ error: 'campaign_insert_failed', detail: 'Η υπηρεσία δεν απάντησε. Δοκίμασε ξανά σε λίγο.' }, 500)
  const campaignId = camp.id as string

  const recRows = recipients.map(r => ({ campaign_id: campaignId, user_id: user.id, client_id: r.clientId || null, email: r.email, name: r.name || null, status: 'pending' }))
  await supabase.from('email_recipients').insert(recRows)

  // Αποστολή σε παρτίδες των 100 (Resend batch API).
  let sent = 0, failed = 0
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100)
    const payload = chunk.map(r => ({
      from: FROM_EMAIL, to: r.email, subject: fill(subject, r), html: fillClientHtml(bodyHtml, r),
      ...(replyTo ? { reply_to: replyTo } : {}),
    }))
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const out = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(out?.data)) {
        for (let j = 0; j < chunk.length; j++) {
          const id = out.data[j]?.id || null
          sent++
          await supabase.from('email_recipients').update({ status: 'sent', resend_id: id, sent_at: new Date().toISOString() })
            .eq('campaign_id', campaignId).eq('email', chunk[j].email)
        }
      } else {
        const detail = (typeof out === 'object' ? JSON.stringify(out) : String(out)).slice(0, 400)
        for (const r of chunk) {
          failed++
          await supabase.from('email_recipients').update({ status: 'failed', error: detail })
            .eq('campaign_id', campaignId).eq('email', r.email)
        }
      }
    } catch (err) {
      for (const r of chunk) {
        failed++
        await supabase.from('email_recipients').update({ status: 'failed', error: String(err).slice(0, 400) })
          .eq('campaign_id', campaignId).eq('email', r.email)
      }
    }
  }

  const status = failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial'
  await supabase.from('email_campaigns')
    .update({ sent_count: sent, failed_count: failed, status, sent_at: new Date().toISOString() })
    .eq('id', campaignId)

  return json({ campaignId, sent, failed, status, droppedNotClient })
})
