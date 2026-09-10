// ─────────────────────────────────────────────────────────────────────────
// send-newsletter — αυτόματο newsletter «Νέες δυνατότητες» στους χρήστες. Ο cron
// το τρέχει· στέλνει branded digest για τις published & αδημοσίευτες (emailed_at
// null) ανακοινώσεις του πίνακα product_updates σε όλους τους εγγεγραμμένους
// χρήστες (soft opt-in) που ΔΕΝ έχουν απεγγραφεί (email_marketing_prefs.product_news).
// Κάθε email φέρει μοναδικό link απεγγραφής (GDPR).
//
// Ενεργοποίηση: κανένα χειροκίνητο μυστικό δεν χρειάζεται — το pg_cron καλεί τη
// function με το service-role key (Authorization: Bearer, από το vault) και η
// authorized() το δέχεται. Προαιρετικά: RESEND_FROM (branded αποστολέας μετά την
// επαλήθευση domain) & APP_URL (μία πηγή: _shared/site.ts).
// ─────────────────────────────────────────────────────────────────────────
import { emailHeader, eyebrow } from '../_shared/emailTemplates.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.110.8'
import { authorizeCron, cronDenial, type CronAuth } from '../_shared/auth.ts'
import { APP_URL } from '../_shared/site.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET    = Deno.env.get('NEWSLETTER_CRON_SECRET') || ''
const FROM_EMAIL     = Deno.env.get('RESEND_FROM') || 'PROPERWISE <onboarding@resend.dev>'

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
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f3f4;font-family:-apple-system,'Inter',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    ${emailHeader()}
    <div style="background:#fff;border:1px solid #e8eaed;border-radius:14px;padding:26px 24px;">
      ${eyebrow('Νέες δυνατότητες')}
      ${inner}
    </div>
    <p style="text-align:center;font-size:11px;color:#80868b;margin:18px 0 4px;line-height:1.6;">
      Λαμβάνεις αυτό το email ως χρήστης του PROPERWISE.<br>
      <a href="${unsubUrl}" style="color:#80868b;text-decoration:underline;">Απεγγραφή από τα ενημερωτικά</a> · PROPERWISE
    </p>
  </div></body></html>`
}

function updateBlock(u: Update): string {
  const cta = u.cta_url ? `<p style="margin:12px 0 0;"><a href="${esc(u.cta_url)}" style="display:inline-block;background:#1a73e8;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:9px 16px;border-radius:8px;">${esc(u.cta_label || 'Δες περισσότερα')}</a></p>` : ''
  return `<div style="padding:16px 0;border-top:1px solid #f1f3f4;">
    <h2 style="margin:0 0 6px;font-size:17px;color:#111;font-weight:700;letter-spacing:-0.2px;">${esc(u.title)}</h2>
    <div style="font-size:14px;color:#3c4043;line-height:1.65;">${u.body_html || ''}</div>${cta}
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

  // Εξασφάλισε γραμμή προτιμήσεων (default: εγγεγραμμένος) → μοναδικό token ανά χρήστη.
  await supabase.from('email_marketing_prefs').upsert(users.map(u => ({ user_id: u.id })), { onConflict: 'user_id', ignoreDuplicates: true })
  // ═══ Η ΑΠΟΤΥΧΙΑ ΕΔΩ ΕΣΤΕΛΝΕ ΣΕ ΟΣΟΥΣ ΕΙΧΑΝ ΑΠΕΓΓΡΑΦΕΙ ══════════════════════
  // ΤΟ ΣΦΑΛΜΑ, ΓΡΑΜΜΗ ΠΡΟΣ ΓΡΑΜΜΗ. Χωρίς το `error`, μια αποτυχία γύριζε
  // `undefined` και το `|| []` έφτιαχνε ΚΕΝΟ χάρτη προτιμήσεων. Το φίλτρο από
  // κάτω ρωτά `prefMap.get(u.id)?.product_news !== false`: με κενό χάρτη η
  // απάντηση είναι `undefined !== false`, δηλαδή ΑΛΗΘΗΣ για ΚΑΘΕ χρήστη.
  //
  // Δηλαδή το μήνυμα έφευγε σε ΟΛΟΥΣ, μαζί με όσους είχαν πατήσει απεγγραφή.
  // Και το `unsubscribe_token` του καθενός ήταν κι αυτό `undefined`, οπότε ο
  // σύνδεσμος απεγγραφής του email γινόταν «/unsubscribe/undefined»: ο
  // παραλήπτης που δεν ήθελε το μήνυμα δεν είχε ούτε τρόπο να το σταματήσει.
  //
  // Δεν είναι σφάλμα παράδοσης, είναι παράβαση συναίνεσης. Οταν ο κατάλογος
  // προτιμήσεων δεν διαβάζεται, ΔΕΝ φεύγει τίποτα.
  const { data: prefs, error: prefsErr } = await supabase.from('email_marketing_prefs').select('user_id,product_news,unsubscribe_token')
  if (prefsErr) {
    console.error('[send-newsletter] οι προτιμήσεις μάρκετινγκ δεν διαβάστηκαν:', prefsErr)
    return json({ error: 'email_marketing_prefs unreadable', detail: prefsErr.message }, 500)
  }
  // Ο χάρτης προτιμήσεων ανά χρήστη. Το «any» έσβηνε τον έλεγχο του κλειδιού.
  type PrefRow = { user_id: string } & Record<string, unknown>
  const prefMap = new Map(((prefs || []) as PrefRow[]).map(p => [p.user_id, p]))
  const recipients = users.filter(u => prefMap.get(u.id)?.product_news !== false)
  if (!recipients.length) return json({ message: 'no_subscribers' })

  const inner = (updates as Update[]).map(updateBlock).join('')
  const subject = updates.length === 1 ? `PROPERWISE — ${updates[0].title}` : `PROPERWISE · ${updates.length} νέες δυνατότητες`

  let sent = 0, failed = 0
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100)
    const payload = chunk.map(u => ({
      from: FROM_EMAIL, to: u.email, subject,
      html: layout(inner, `${APP_URL}/unsubscribe/${prefMap.get(u.id)?.unsubscribe_token ?? ''}`),
    }))
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST', headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) sent += chunk.length; else failed += chunk.length
    } catch { failed += chunk.length }
  }

  await supabase.from('product_updates').update({ emailed_at: new Date().toISOString() }).in('id', (updates as Update[]).map(u => u.id))
  return json({ sent, failed, updates: updates.length, recipients: recipients.length })
})
