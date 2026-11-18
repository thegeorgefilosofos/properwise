// ─────────────────────────────────────────────────────────────────────────
// send-market-digest — εβδομαδιαίο ενημερωτικό για τα δεδομένα αγοράς (Euribor,
// επιτόκιο ΕΚΤ, επιτόκια στεγαστικών ΤτΕ) στους χρήστες που το θέλουν
// (email_marketing_prefs.market_news). Συγκρίνει την τελευταία γραμμή του
// market_rates με την τελευταία μιας εβδομάδας πίσω και στέλνει τις μεταβολές·
// αν δεν υπάρχει μεταβολή, δεν στέλνει.
//
// Ενεργοποίηση: κανένα χειροκίνητο μυστικό — το pg_cron καλεί με το service-role
// key (Authorization: Bearer, από το vault) και η authorized() το δέχεται.
// Προαιρετικά: RESEND_FROM (branded αποστολέας μετά την επαλήθευση domain).
// ─────────────────────────────────────────────────────────────────────────
import { listUnsubscribeHeaders } from '../_shared/emailTemplates.ts'
// Το email ζει στο _shared/marketDigestEmail.ts, σε δύο γλώσσες.
import { DIGEST_METRICS, digestLayout, digestRows, digestSubject } from '../_shared/marketDigestEmail.ts'
import { msgLangOfMeta } from '../_shared/msgLang.ts'
import type { Lang } from '../_shared/emailTemplates.ts'
import { audience, batchKey, ensurePrefs, readPrefs } from '../_shared/marketingAudience.ts'
;
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import { APP_URL } from '../_shared/site.ts'
import { authorizeCron, cronDenial, type CronAuth } from '../_shared/auth.ts'
import { senderFrom, REPLY_TO } from '../_shared/sender.mjs'
// Ο ΙΔΙΟΣ ΚΑΝΟΝΑΣ ΣΕΙΡΑΣ ΜΕ ΤΗΝ ΤΡΟΦΟΔΟΣΙΑ: το lib/market/ecb.ts φορτώνεται και
// από το Deno (όπως στη market-data-updater), χωρίς σχετικές εισαγωγές.
import { digestCutoff, weeklyDigest, type RatesRow } from '../../../lib/market/ecb.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET    = Deno.env.get('MARKET_DIGEST_CRON_SECRET') || ''
const FROM_EMAIL     = senderFrom(Deno.env.get('RESEND_FROM'))

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })

// Εξουσιοδότηση cron (zero-config): δέχεται (α) το service-role key (Bearer),
// (β) το προαιρετικό x-cron-secret env, ή (γ) το κοινό μυστικό cron από τη ΒΔ
// (public.cron_secrets) — η κύρια, μηδενικής-ρύθμισης οδός. Το pg_cron στέλνει
// την τιμή του πίνακα, το function την επαληθεύει με τον service-role client του.
async function authorized(req: Request): Promise<CronAuth> {
  return authorizeCron(req, { serviceKey: SERVICE_KEY, envSecret: CRON_SECRET, supabase })
}

async function listUsers(): Promise<{ id: string; email: string; lang: Lang }[]> {
  const out: { id: string; email: string; lang: Lang }[] = []
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users?.length) break
    for (const u of data.users) if (u.email && u.email_confirmed_at) out.push({ id: u.id, email: u.email, lang: msgLangOfMeta(u.user_metadata) })
    if (data.users.length < 1000) break
  }
  return out
}

Deno.serve(async (req) => {
  const auth = await authorized(req)
  if (!auth.ok) return json(...cronDenial(auth))
  if (!RESEND_API_KEY) return json({ error: 'no_resend_key' }, 500)

  // ── Η ΕΒΔΟΜΑΔΑ, ΟΧΙ Η ΧΘΕΣΙΝΗ ΜΕΡΑ (19.10.2026) ────────────────────────────
  // Εδώ ήταν `.limit(2)`: οι δύο τελευταίες ημερήσιες γραμμές. Με το
  // χρονοδιάγραμμα της Δευτέρας 07:00 UTC, μία ώρα πριν από την τροφοδοσία,
  // αυτές ήταν η Κυριακή και το Σάββατο· μεταβολή άλλης μέρας δεν έφτανε ποτέ.
  // Η γραμμή σύγκρισης είναι πλέον η τελευταία με `updated_at` επτά ημέρες
  // πίσω (`digestCutoff`) και ο κανόνας ζει στο lib/market/ecb.ts.
  const nowIso = new Date().toISOString()
  const { data: curRow, error: curErr } = await supabase.from('market_rates')
    .select('provenance,updated_at')
    .order('updated_at', { ascending: false }).limit(1).maybeSingle()
  if (curErr) {
    console.error('[send-market-digest] τα επιτόκια δεν διαβάστηκαν:', curErr)
    return json({ error: 'market_rates unreadable', detail: curErr.message }, 500)
  }
  if (!curRow) return json({ message: 'no_data' })
  const { data: baseRow, error: baseErr } = await supabase.from('market_rates')
    .select('provenance,updated_at')
    .lte('updated_at', digestCutoff(nowIso))
    .order('updated_at', { ascending: false }).limit(1).maybeSingle()
  if (baseErr) {
    console.error('[send-market-digest] η γραμμή σύγκρισης δεν διαβάστηκε:', baseErr)
    return json({ error: 'market_rates unreadable', detail: baseErr.message }, 500)
  }
  // ΜΕΤΑΒΟΛΗ ΜΟΝΟ ΜΕΣΑ ΣΤΗΝ ΙΔΙΑ ΣΕΙΡΑ (13.10.2026) και τιμή μόνο από σειρά του
  // καταλόγου: η `weeklyDigest` ρωτά τη `sameSeries` και την ταυτότητα. Τιμή της
  // F κάτω από το `bog_housing_new` δεν γράφεται ως «Επιτόκιο νέων στεγαστικών».
  const digest = weeklyDigest(curRow as RatesRow, baseRow as RatesRow | null, DIGEST_METRICS.map(m => m.key))
  const cur: Record<string, number | null> = Object.fromEntries(digest.lines.map(l => [l.key, l.cur]))
  const prev: Record<string, number | null> = Object.fromEntries(digest.lines.map(l => [l.key, l.prev]))

  // Στείλε μόνο αν υπάρχει ουσιαστική μεταβολή σε κάποιο μέγεθος.
  if (!digest.changed) return json({ message: 'no_change' })

  const users = await listUsers()
  if (!users.length) return json({ message: 'no_users' })
  // Γραμμή προτιμήσεων ανά χρήστη, σε παρτίδες· η νέα περνά από τον trigger
  // της συγκατάθεσης της εγγραφής.
  const ensureErr = await ensurePrefs(supabase, users.map(u => u.id))
  if (ensureErr) {
    console.error('[send-market-digest] οι γραμμές προτιμήσεων δεν δημιουργήθηκαν:', ensureErr)
    return json({ error: 'email_marketing_prefs not ensured', detail: ensureErr.message }, 500)
  }
  // ΙΔΙΟ ΣΦΑΛΜΑ ΜΕ ΤΟ ΕΝΗΜΕΡΩΤΙΚΟ ΔΕΛΤΙΟ. Χάρτης από ΕΝΑ αίτημα κοβόταν στις
  // 1.000 και το φίλτρο `!== false` έστελνε σε όποιον έλειπε, μαζί με όσους
  // είχαν κάνει απεγγραφή, με σύνδεσμο «/unsubscribe/undefined». Τώρα: όλες οι
  // σελίδες και μόνο ρητό «ναι» με token (έλεγχος κλίμακας 10/11/2026).
  const { rows: prefs, error: prefsErr } = await readPrefs(supabase, 'market_news')
  if (prefsErr) {
    console.error('[send-market-digest] οι προτιμήσεις μάρκετινγκ δεν διαβάστηκαν:', prefsErr)
    return json({ error: 'email_marketing_prefs unreadable', detail: prefsErr.message }, 500)
  }
  const { recipients, skippedNoToken } = audience(users, prefs, 'market_news')
  if (skippedNoToken) console.error(`[send-market-digest] ${skippedNoToken} παραλήπτες χωρίς token απεγγραφής: δεν στάλθηκε`)
  if (!recipients.length) return json({ message: 'no_subscribers', skippedNoToken })

  // Η γλώσσα κάθε παραλήπτη από τη «Γλώσσα μηνυμάτων και email» του Λογαριασμού.
  const langOf = new Map(users.map(u => [u.id, u.lang]))
  const inner = { el: digestRows(cur, prev, 'el'), en: digestRows(cur, prev, 'en') }

  let sent = 0, failed = 0
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100)
    const payload = chunk.map(u => {
      const unsubUrl = `${APP_URL}/unsubscribe/${u.token}`
      const lang = langOf.get(u.id) ?? 'el'
      return { from: FROM_EMAIL, reply_to: REPLY_TO, to: u.email, subject: digestSubject(lang), html: digestLayout(inner[lang], unsubUrl, lang), headers: listUnsubscribeHeaders(unsubUrl) }
    })
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        // Ιδιοδύναμο ανά παρτίδα και ανά εβδομάδα: επανάληψη της ίδιας μέρας δεν ξαναστέλνει.
        method: 'POST', headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': await batchKey(`digest-${nowIso.slice(0, 10)}`, chunk, String(curRow.updated_at)) },
        body: JSON.stringify(payload),
      })
      if (res.ok) sent += chunk.length; else failed += chunk.length
    } catch { failed += chunk.length }
  }
  if (failed) console.error(`[send-market-digest] ${failed} από ${recipients.length} δεν στάλθηκαν`)
  return json({ sent, failed, recipients: recipients.length, skippedNoToken })
})
