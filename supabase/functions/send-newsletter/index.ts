// ─────────────────────────────────────────────────────────────────────────
// send-newsletter — αυτόματο newsletter «Νέες δυνατότητες» στους χρήστες. Ο cron
// το τρέχει· στέλνει branded digest για τις published & αδημοσίευτες (emailed_at
// null) ανακοινώσεις του πίνακα product_updates σε όσους χρήστες έχουν ρητό
// «ναι» στο email_marketing_prefs.product_news (_shared/marketingAudience.ts).
// Κάθε email φέρει μοναδικό link απεγγραφής (GDPR).
//
// Ενεργοποίηση: κανένα χειροκίνητο μυστικό δεν χρειάζεται — το pg_cron καλεί τη
// function με το service-role key (Authorization: Bearer, από το vault) και η
// authorized() το δέχεται. Προαιρετικά: RESEND_FROM (branded αποστολέας μετά την
// επαλήθευση domain) & APP_URL (μία πηγή: _shared/site.ts).
// ─────────────────────────────────────────────────────────────────────────
import { emailShell, eyebrow, linkLine, listUnsubscribeHeaders } from '../_shared/emailTemplates.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { authorizeCron, cronDenial, type CronAuth } from '../_shared/auth.ts'
import { APP_URL } from '../_shared/site.ts'
import { senderFrom, REPLY_TO } from '../_shared/sender.mjs'
import { EMAIL_LIGHT as C } from '../_shared/emailPalette.ts'
import { audience, batchKey, ensurePrefs, readPrefs } from '../_shared/marketingAudience.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET    = Deno.env.get('NEWSLETTER_CRON_SECRET') || ''
const FROM_EMAIL     = senderFrom(Deno.env.get('RESEND_FROM'))

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })
const esc = (v: unknown) => String(v ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c))

// Εξουσιοδότηση cron (zero-config): δέχεται (α) το service-role key (Bearer),
// (β) το προαιρετικό x-cron-secret env, ή (γ) το κοινό μυστικό cron από τη ΒΔ
// (public.cron_secrets) — η κύρια, μηδενικής-ρύθμισης οδός. Το pg_cron στέλνει
// την τιμή του πίνακα, το function την επαληθεύει με τον service-role client του.
async function authorized(req: Request): Promise<CronAuth> {
  return authorizeCron(req, { serviceKey: SERVICE_KEY, envSecret: CRON_SECRET, supabase })
}

interface Update { id: string; title: string; body_html: string; cta_label?: string; cta_url?: string }

function layout(inner: string, unsubUrl: string): string {
  return emailShell({
    unsubUrl,
    bodyHtml: eyebrow('Νέες δυνατότητες') + inner,
  })
}

function updateBlock(u: Update): string {
  const cta = u.cta_url ? linkLine(u.cta_label || 'Δες περισσότερα', u.cta_url) : ''
  return `<div class="rule-t" style="padding:20px 0 4px;border-top:1px solid ${C.rule};">
    <h2 class="ink" style="margin:0 0 7px;font-size:17px;color:${C.ink};font-weight:600;letter-spacing:-0.2px;mso-line-height-rule:exactly;line-height:24px;">${esc(u.title)}</h2>
    <div class="tx" style="font-size:15px;color:${C.text};mso-line-height-rule:exactly;line-height:25px;">${u.body_html || ''}</div>${cta}
  </div>`
}

async function listUsers(): Promise<{ id: string; email: string }[]> {
  const out: { id: string; email: string }[] = []
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users?.length) break
    for (const u of data.users) if (u.email && u.email_confirmed_at) out.push({ id: u.id, email: u.email })
    if (data.users.length < 1000) break
  }
  return out
}

Deno.serve(async (req) => {
  const auth = await authorized(req)
  if (!auth.ok) return json(...cronDenial(auth))
  if (!RESEND_API_KEY) return json({ error: 'no_resend_key' }, 500)

  const { data: updates, error: updErr } = await supabase.from('product_updates')
    .select('id,title,body_html,cta_label,cta_url').eq('published', true).is('emailed_at', null).order('created_at', { ascending: true })
  if (updErr) {
    console.error('[send-newsletter] οι ανακοινώσεις δεν διαβάστηκαν:', updErr)
    return json({ error: 'product_updates unreadable', detail: updErr.message }, 500)
  }
  if (!updates?.length) return json({ message: 'no_updates' })

  const users = await listUsers()
  if (!users.length) return json({ message: 'no_users' })

  // ΓΡΑΜΜΗ ΠΡΟΤΙΜΗΣΕΩΝ ΑΝΑ ΧΡΗΣΤΗ, ΣΕ ΠΑΡΤΙΔΕΣ. Η νέα γραμμή περνά από τον
  // trigger `marketing_prefs_from_signup`, που την κλείνει για όποιον δεν
  // συναίνεσε στην εγγραφή. Υπάρχουσα γραμμή δεν αγγίζεται.
  const ensureErr = await ensurePrefs(supabase, users.map(u => u.id))
  if (ensureErr) {
    console.error('[send-newsletter] οι γραμμές προτιμήσεων δεν δημιουργήθηκαν:', ensureErr)
    return json({ error: 'email_marketing_prefs not ensured', detail: ensureErr.message }, 500)
  }
  // ΟΛΕΣ ΟΙ ΠΡΟΤΙΜΗΣΕΙΣ, ΣΕ ΣΕΛΙΔΕΣ (έλεγχος κλίμακας 10/11/2026). Σε ΕΝΑ
  // αίτημα το PostgREST κόβει στις 1.000 και ο χάρτης έμενε μισός. Το φίλτρο
  // ήταν `!== false`, οπότε όποιος έλειπε έπαιρνε το μήνυμα μαζί με όποιον είχε
  // κάνει απεγγραφή, με σύνδεσμο «/unsubscribe/». Οταν ο κατάλογος
  // δεν διαβάζεται ολόκληρος, ΔΕΝ φεύγει τίποτα.
  const { rows: prefs, error: prefsErr } = await readPrefs(supabase, 'product_news')
  if (prefsErr) {
    console.error('[send-newsletter] οι προτιμήσεις μάρκετινγκ δεν διαβάστηκαν:', prefsErr)
    return json({ error: 'email_marketing_prefs unreadable', detail: prefsErr.message }, 500)
  }
  // Μόνο ρητό «ναι» με token απεγγραφής (_shared/marketingAudience.ts).
  const { recipients, skippedNoToken } = audience(users, prefs, 'product_news')
  if (skippedNoToken) console.error(`[send-newsletter] ${skippedNoToken} παραλήπτες χωρίς token απεγγραφής: δεν στάλθηκε`)
  if (!recipients.length) return json({ message: 'no_subscribers', skippedNoToken })

  // ΔΕΣΜΕΥΣΗ ΠΡΙΝ ΤΗΝ ΑΠΟΣΤΟΛΗ. Το `emailed_at` γραφόταν στο ΤΕΛΟΣ: μια
  // κομμένη εκτέλεση (όριο χρόνου, σφάλμα) άφηνε τις ανακοινώσεις «ανεπίδοτες»
  // και την επόμενη εβδομάδα το μήνυμα ξανάφευγε σε ΟΛΟΥΣ. Τώρα οι
  // ανακοινώσεις δεσμεύονται πρώτα, με όρο `emailed_at is null`, ώστε και δύο
  // παράλληλες εκτελέσεις να μη στείλουν δύο φορές. Αν η εκτέλεση κοπεί, όσοι
  // έμειναν χάνουν ΑΥΤΟ το δελτίο· κανείς δεν το παίρνει δεύτερη φορά. Αν δεν
  // φύγει τίποτα σε κανέναν, η δέσμευση αίρεται στο τέλος. Για
  // επανάληψη της ίδιας μέρας, το κλειδί ιδιοδυναμίας του Resend κρατά κάθε
  // παρτίδα μία φορά.
  const claimedAt = new Date().toISOString()
  const { data: claimed, error: claimErr } = await supabase.from('product_updates')
    .update({ emailed_at: claimedAt }).in('id', (updates as Update[]).map(u => u.id)).is('emailed_at', null).select('id')
  if (claimErr) {
    console.error('[send-newsletter] οι ανακοινώσεις δεν δεσμεύτηκαν:', claimErr)
    return json({ error: 'product_updates not claimed', detail: claimErr.message }, 500)
  }
  const claimedIds = new Set(((claimed ?? []) as { id: string }[]).map(c => c.id))
  const toSend = (updates as Update[]).filter(u => claimedIds.has(u.id))
  if (!toSend.length) return json({ message: 'already_claimed' })

  const inner = toSend.map(updateBlock).join('')
  // Χωρίς πρόθεμα «PROPERWISE»: το όνομα του αποστολέα το λέει ήδη στη λίστα.
  const subject = toSend.length === 1 ? toSend[0].title : `${toSend.length} νέες δυνατότητες`

  let sent = 0, failed = 0
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100)
    const payload = chunk.map(u => {
      const unsubUrl = `${APP_URL}/unsubscribe/${u.token}`
      return { from: FROM_EMAIL, reply_to: REPLY_TO, to: u.email, subject, html: layout(inner, unsubUrl), headers: listUnsubscribeHeaders(unsubUrl) }
    })
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST', headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': await batchKey(`newsletter-${claimedAt.slice(0, 10)}`, chunk, toSend.map(u => u.id).join(',')) },
        body: JSON.stringify(payload),
      })
      if (res.ok) sent += chunk.length; else failed += chunk.length
    } catch { failed += chunk.length }
  }

  // ΟΛΙΚΗ ΑΠΟΤΥΧΙΑ (π.χ. ο πάροχος δεν απαντά): δεν έφυγε τίποτα σε κανέναν,
  // οπότε η δέσμευση αίρεται και η επόμενη εκτέλεση ξαναδοκιμάζει. Σε ΜΕΡΙΚΗ
  // αποτυχία μένει: όσοι το πήραν δεν πρέπει να το πάρουν δεύτερη φορά.
  if (sent === 0 && failed > 0) {
    const { error: releaseErr } = await supabase.from('product_updates')
      .update({ emailed_at: null }).in('id', toSend.map(u => u.id)).eq('emailed_at', claimedAt)
    if (releaseErr) console.error('[send-newsletter] η δέσμευση δεν αποδεσμεύτηκε:', releaseErr)
  }
  if (failed) console.error(`[send-newsletter] ${failed} από ${recipients.length} δεν στάλθηκαν`)
  return json({ sent, failed, updates: toSend.length, recipients: recipients.length, skippedNoToken })
})
